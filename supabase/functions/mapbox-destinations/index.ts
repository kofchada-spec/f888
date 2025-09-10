import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userLocation, planningData, profileData, excludedIds = [] } = await req.json();
    
    // Get Mapbox token from environment
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    if (!mapboxToken) {
      throw new Error('MAPBOX_PUBLIC_TOKEN not configured');
    }

    console.log('Generating single destination with exclusions:', excludedIds, planningData);

    // Calculs selon les spécifications
    const steps = parseInt(planningData.steps);
    const heightM = profileData?.heightM || parseFloat(planningData.height);
    const weightKg = profileData?.weightKg || parseFloat(planningData.weight) || 70;
    
    // stride = 0.415 × heightM
    const stride = 0.415 * heightM;
    
    // totalDistanceKm = steps × stride / 1000
    const totalDistanceKm = (steps * stride) / 1000;
    
    // targetOutKm = (tripType === 'round-trip') ? totalDistanceKm / 2 : totalDistanceKm
    const targetOutKm = (planningData.tripType === 'round-trip') ? totalDistanceKm / 2 : totalDistanceKm;
    
    // Calcul durée et calories
    const speedKmh = { slow: 4, moderate: 5, fast: 6 }[planningData.pace];
    const durationMin = (totalDistanceKm / speedKmh) * 60;
    const calorieCoeff = { slow: 0.35, moderate: 0.50, fast: 0.70 }[planningData.pace];
    const calories = Math.round(totalDistanceKm * weightKg * calorieCoeff);

    // Anneau de distance pour filtrage (85% à 115% du targetOutKm, min +0.2km)
    const minRing = 0.85 * targetOutKm;
    const maxRing = Math.max(1.15 * targetOutKm, 0.85 * targetOutKm + 0.2);

    // Rechercher des POI candidats avec Mapbox Geocoding
    const poiCategories = ['park', 'cafe', 'bakery', 'supermarket', 'pharmacy', 'gym', 'museum'];
    const poiCandidates = [];
    
    // Rechercher des POI dans chaque catégorie
    for (const category of poiCategories) {
      try {
        const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${category}.json?types=poi&proximity=${userLocation.lng},${userLocation.lat}&language=fr&limit=20&access_token=${mapboxToken}`;
        
        const response = await fetch(geocodingUrl);
        const data = await response.json();
        
        if (data.features) {
          poiCandidates.push(...data.features.map(poi => ({
            ...poi,
            category: category,
            distance: calculateDistance(userLocation, { lat: poi.center[1], lng: poi.center[0] })
          })));
        }
      } catch (error) {
        console.log(`Error fetching ${category} POIs:`, error);
      }
    }
    
    // Filtrer par anneau de distance et exclure les IDs déjà vus
    const validPois = poiCandidates.filter(poi => {
      const poiDistance = poi.distance;
      const isInRing = poiDistance >= minRing && poiDistance <= maxRing;
      const notExcluded = !excludedIds.includes(poi.id);
      return isInRing && notExcluded;
    });
    
    console.log(`Found ${validPois.length} valid POIs in distance ring ${minRing.toFixed(2)}-${maxRing.toFixed(2)}km`);
    
    // Calculer les routes pour un sous-ensemble et trouver le meilleur score
    const poisToEvaluate = validPois.slice(0, 12); // Limiter à 12 pour les performances
    let bestDestination = null;
    let bestScore = Infinity;
    
    for (const poi of poisToEvaluate) {
      try {
        // Calculer la route walking avec Mapbox Directions
        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${poi.center[0]},${poi.center[1]}?geometries=geojson&steps=true&access_token=${mapboxToken}`;
        
        const dirResponse = await fetch(directionsUrl);
        const dirData = await dirResponse.json();
        
        if (dirData.routes && dirData.routes.length > 0) {
          const route = dirData.routes[0];
          const routeDistanceKm = route.distance / 1000; // Distance aller de l'itinéraire
          
          // Score = |distanceItinéraireKm - targetOutKm|
          const score = Math.abs(routeDistanceKm - targetOutKm);
          
          if (score < bestScore) {
            bestScore = score;
            bestDestination = {
              id: poi.id || `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: poi.place_name?.split(',')[0] || poi.text || 'Point d\'intérêt',
              coordinates: { lat: poi.center[1], lng: poi.center[0] },
              routeGeoJSON: route.geometry,
              distanceKm: routeDistanceKm,
              durationMin: Math.round(route.duration / 60),
              calories: calories // Calculé sur la distance totale (A/R si nécessaire)
            };
          }
        }
      } catch (error) {
        console.log('Error calculating route for POI:', error);
      }
    }
    
    // Fallback si aucun POI trouvé : élargir l'anneau
    if (!bestDestination) {
      console.log('No POI found, trying expanded ring...');
      const expandedMin = 0.75 * targetOutKm;
      const expandedMax = 1.25 * targetOutKm;
      
      const expandedPois = poiCandidates.filter(poi => {
        const poiDistance = poi.distance;
        const isInExpandedRing = poiDistance >= expandedMin && poiDistance <= expandedMax;
        const notExcluded = !excludedIds.includes(poi.id);
        return isInExpandedRing && notExcluded;
      });
      
      if (expandedPois.length > 0) {
        const randomPoi = expandedPois[Math.floor(Math.random() * expandedPois.length)];
        bestDestination = {
          id: randomPoi.id || `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: randomPoi.place_name?.split(',')[0] || randomPoi.text || 'Point d\'intérêt',
          coordinates: { lat: randomPoi.center[1], lng: randomPoi.center[0] },
          routeGeoJSON: null, // Sera une ligne droite
          distanceKm: randomPoi.distance,
          durationMin: Math.round(durationMin),
          calories: calories
        };
      }
    }
    
    // Dernier fallback : destination générique
    if (!bestDestination) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = targetOutKm * 1.1;
      const distanceInDegrees = distance / 111.32;
      
      const destLat = userLocation.lat + Math.sin(angle) * distanceInDegrees;
      const destLng = userLocation.lng + Math.cos(angle) * distanceInDegrees;
      
      bestDestination = {
        id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: planningData.tripType === 'round-trip' ? 'Circuit Découverte' : 'Point de Vue',
        coordinates: { lat: destLat, lng: destLng },
        routeGeoJSON: null,
        distanceKm: targetOutKm,
        durationMin: Math.round(durationMin),
        calories: calories
      };
    }

    console.log('Generated single destination:', bestDestination.name);

    return new Response(
      JSON.stringify({ destination: bestDestination }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in mapbox-destinations:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})

// Fonction utilitaire pour calculer la distance entre deux points

function calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
  const R = 6371; // Earth's radius in km
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Fonctions utilitaires supprimées car non utilisées dans la nouvelle logique