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
    const { userLocation, planningData, profileData, generateThree = false } = await req.json();
    
    // Get Mapbox token from environment
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    if (!mapboxToken) {
      throw new Error('MAPBOX_PUBLIC_TOKEN not configured');
    }

    console.log('Generating destinations with generateThree:', generateThree, planningData);

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
    
    // Filtrer par anneau de distance
    const validPois = poiCandidates.filter(poi => {
      const poiDistance = poi.distance;
      return poiDistance >= minRing && poiDistance <= maxRing;
    });
    
    console.log(`Found ${validPois.length} valid POIs in distance ring ${minRing.toFixed(2)}-${maxRing.toFixed(2)}km`);
    
    if (generateThree) {
      // Générer 3 destinations fixes (déterministiques)
      return await generateThreeDestinations(validPois, userLocation, targetOutKm, durationMin, calories, mapboxToken, corsHeaders, planningData, heightM, steps);
    }
    
    // Mode original : une seule destination
    const poisToEvaluate = validPois.slice(0, 12);
    let bestDestination = null;
    let bestScore = Infinity;
    
    for (const poi of poisToEvaluate) {
      try {
        if (planningData.tripType === 'round-trip') {
          // For round-trip, calculate separate outbound and return routes
          const routeResult = await calculateRoundTripRoute(userLocation, { lat: poi.center[1], lng: poi.center[0] }, mapboxToken);
          
          if (routeResult) {
            const totalDistanceKm = routeResult.outboundDistance + routeResult.returnDistance;
            const totalSteps = calculateStepsFromDistance(totalDistanceKm, heightM);
            
            // Check if total steps are within ±5% of target
            const stepDeviation = Math.abs(totalSteps - steps) / steps;
            
            if (stepDeviation <= 0.05 && stepDeviation < bestScore) {
              bestScore = stepDeviation;
              bestDestination = {
                id: poi.id || `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: poi.place_name?.split(',')[0] || poi.text || 'Point d\'intérêt',
                coordinates: { lat: poi.center[1], lng: poi.center[0] },
                routeGeoJSON: {
                  outboundCoordinates: routeResult.outboundRoute.geometry.coordinates,
                  returnCoordinates: routeResult.returnRoute.geometry.coordinates
                },
                distanceKm: totalDistanceKm,
                durationMin: Math.round((routeResult.outboundRoute.duration + routeResult.returnRoute.duration) / 60),
                calories: calories
              };
            }
          }
        } else {
          // One-way route calculation (existing logic)
          const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${poi.center[0]},${poi.center[1]}?geometries=geojson&steps=true&access_token=${mapboxToken}`;
          
          const dirResponse = await fetch(directionsUrl);
          const dirData = await dirResponse.json();
          
          if (dirData.routes && dirData.routes.length > 0) {
            const route = dirData.routes[0];
            const routeDistanceKm = route.distance / 1000;
            const routeSteps = calculateStepsFromDistance(routeDistanceKm, heightM);
            
            // Check if steps are within ±5% of target
            const stepDeviation = Math.abs(routeSteps - steps) / steps;
            
            if (stepDeviation <= 0.05 && stepDeviation < bestScore) {
              bestScore = stepDeviation;
              bestDestination = {
                id: poi.id || `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: poi.place_name?.split(',')[0] || poi.text || 'Point d\'intérêt',
                coordinates: { lat: poi.center[1], lng: poi.center[0] },
                routeGeoJSON: route.geometry,
                distanceKm: routeDistanceKm,
                durationMin: Math.round(route.duration / 60),
                calories: calories
              };
            }
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
        return poiDistance >= expandedMin && poiDistance <= expandedMax;
      });
      
      if (expandedPois.length > 0) {
        const randomPoi = expandedPois[Math.floor(Math.random() * expandedPois.length)];
        
        // Calculer la route réelle même pour l'expanded POI
        try {
          if (planningData.tripType === 'round-trip') {
            const routeResult = await calculateRoundTripRoute(userLocation, { lat: randomPoi.center[1], lng: randomPoi.center[0] }, mapboxToken);
            
            if (routeResult) {
              const totalDistanceKm = routeResult.outboundDistance + routeResult.returnDistance;
              bestDestination = {
                id: randomPoi.id || `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: randomPoi.place_name?.split(',')[0] || randomPoi.text || 'Point d\'intérêt',
                coordinates: { lat: randomPoi.center[1], lng: randomPoi.center[0] },
                routeGeoJSON: {
                  outboundCoordinates: routeResult.outboundRoute.geometry.coordinates,
                  returnCoordinates: routeResult.returnRoute.geometry.coordinates
                },
                distanceKm: totalDistanceKm,
                durationMin: Math.round((routeResult.outboundRoute.duration + routeResult.returnRoute.duration) / 60),
                calories: calories
              };
            }
          } else {
            const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${randomPoi.center[0]},${randomPoi.center[1]}?geometries=geojson&steps=true&access_token=${mapboxToken}`;
            
            const dirResponse = await fetch(directionsUrl);
            const dirData = await dirResponse.json();
            
            let routeGeoJSON = null;
            let actualDistanceKm = randomPoi.distance;
            let actualDurationMin = Math.round(durationMin);
            
            if (dirData.routes && dirData.routes.length > 0) {
              const route = dirData.routes[0];
              routeGeoJSON = route.geometry;
              actualDistanceKm = route.distance / 1000;
              actualDurationMin = Math.round(route.duration / 60);
            }
            
            bestDestination = {
              id: randomPoi.id || `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: randomPoi.place_name?.split(',')[0] || randomPoi.text || 'Point d\'intérêt',
              coordinates: { lat: randomPoi.center[1], lng: randomPoi.center[0] },
              routeGeoJSON: routeGeoJSON,
              distanceKm: actualDistanceKm,
              durationMin: actualDurationMin,
              calories: calories
            };
          }
        } catch (error) {
          console.log('Error calculating expanded POI route:', error);
          // Fallback sans route réelle
          bestDestination = {
            id: randomPoi.id || `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: randomPoi.place_name?.split(',')[0] || randomPoi.text || 'Point d\'intérêt',
            coordinates: { lat: randomPoi.center[1], lng: randomPoi.center[0] },
            routeGeoJSON: null,
            distanceKm: randomPoi.distance,
            durationMin: Math.round(durationMin),
            calories: calories
          };
        }
      }
    }
    
    // Dernier fallback : destination générique avec route réelle
    if (!bestDestination) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = targetOutKm * 1.1;
      const distanceInDegrees = distance / 111.32;
      
      const destLat = userLocation.lat + Math.sin(angle) * distanceInDegrees;
      const destLng = userLocation.lng + Math.cos(angle) * distanceInDegrees;
      
      // Calculer la route réelle même pour le fallback générique
      try {
        if (planningData.tripType === 'round-trip') {
          const routeResult = await calculateRoundTripRoute(userLocation, { lat: destLat, lng: destLng }, mapboxToken);
          
          if (routeResult) {
            const totalDistanceKm = routeResult.outboundDistance + routeResult.returnDistance;
            bestDestination = {
              id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: 'Circuit Découverte',
              coordinates: { lat: destLat, lng: destLng },
              routeGeoJSON: {
                outboundCoordinates: routeResult.outboundRoute.geometry.coordinates,
                returnCoordinates: routeResult.returnRoute.geometry.coordinates
              },
              distanceKm: totalDistanceKm,
              durationMin: Math.round((routeResult.outboundRoute.duration + routeResult.returnRoute.duration) / 60),
              calories: calories
            };
          }
        } else {
          const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${destLng},${destLat}?geometries=geojson&steps=true&access_token=${mapboxToken}`;
          
          const dirResponse = await fetch(directionsUrl);
          const dirData = await dirResponse.json();
          
          let routeGeoJSON = null;
          let actualDistanceKm = targetOutKm;
          let actualDurationMin = Math.round(durationMin);
          
          if (dirData.routes && dirData.routes.length > 0) {
            const route = dirData.routes[0];
            routeGeoJSON = route.geometry;
            actualDistanceKm = route.distance / 1000;
            actualDurationMin = Math.round(route.duration / 60);
          }
          
          bestDestination = {
            id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Point de Vue',
            coordinates: { lat: destLat, lng: destLng },
            routeGeoJSON: routeGeoJSON,
            distanceKm: actualDistanceKm,
            durationMin: actualDurationMin,
            calories: calories
          };
        }
      } catch (error) {
        console.log('Error calculating generic fallback route:', error);
        // Dernier recours sans route réelle
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

// Helper function to calculate steps from distance
function calculateStepsFromDistance(distanceKm: number, heightM: number): number {
  const stride = 0.415 * heightM;
  const distanceM = distanceKm * 1000;
  return Math.round(distanceM / stride);
}

// Calculate separate outbound and return routes for round trips
async function calculateRoundTripRoute(
  start: { lat: number; lng: number }, 
  destination: { lat: number; lng: number },
  mapboxToken: string
): Promise<{
  outboundRoute: any;
  returnRoute: any; 
  outboundDistance: number;
  returnDistance: number;
} | null> {
  try {
    // Calculate outbound route
    const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${start.lng},${start.lat};${destination.lng},${destination.lat}?geometries=geojson&steps=true&access_token=${mapboxToken}`;
    const outboundResponse = await fetch(outboundUrl);
    const outboundData = await outboundResponse.json();
    
    if (!outboundData.routes || outboundData.routes.length === 0) {
      return null;
    }
    
    const outboundRoute = outboundData.routes[0];
    
    // Calculate return route with alternatives to avoid retracing
    const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${destination.lng},${destination.lat};${start.lng},${start.lat}?geometries=geojson&steps=true&alternatives=true&access_token=${mapboxToken}`;
    const returnResponse = await fetch(returnUrl);
    const returnData = await returnResponse.json();
    
    if (!returnData.routes || returnData.routes.length === 0) {
      return null;
    }
    
    // Try to find a return route that's different from outbound
    let bestReturnRoute = returnData.routes[0];
    let minOverlap = 1.0;
    
    // Check all alternative routes and pick the one with least overlap
    for (const route of returnData.routes) {
      const overlap = calculatePathOverlap(
        outboundRoute.geometry.coordinates,
        route.geometry.coordinates
      );
      
      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestReturnRoute = route;
      }
    }
    
    // If still too much overlap, try waypoint-based routing
    if (minOverlap > 0.4) {
      const waypointRoute = await calculateWaypointReturn(start, destination, outboundRoute.geometry.coordinates, mapboxToken);
      if (waypointRoute) {
        bestReturnRoute = waypointRoute;
      }
    }
    
    return {
      outboundRoute,
      returnRoute: bestReturnRoute,
      outboundDistance: outboundRoute.distance / 1000,
      returnDistance: bestReturnRoute.distance / 1000
    };
    
  } catch (error) {
    console.log('Error calculating round-trip route:', error);
    return null;
  }
}

// Calculate path overlap percentage
function calculatePathOverlap(path1: number[][], path2: number[][]): number {
  if (!path1.length || !path2.length) return 0;
  
  const bufferRadius = 0.0002; // ~20m buffer in degrees
  let overlapCount = 0;
  const sampleSize = Math.min(30, path2.length);
  const sampleStep = Math.floor(path2.length / sampleSize);
  
  for (let i = 0; i < path2.length; i += sampleStep) {
    const point2 = path2[i];
    
    for (const point1 of path1) {
      const distance = Math.sqrt(
        Math.pow(point2[0] - point1[0], 2) + 
        Math.pow(point2[1] - point1[1], 2)
      );
      
      if (distance < bufferRadius) {
        overlapCount++;
        break;
      }
    }
  }
  
  return overlapCount / sampleSize;
}

// Calculate return route with strategic waypoints to avoid outbound path
async function calculateWaypointReturn(
  start: { lat: number; lng: number },
  destination: { lat: number; lng: number }, 
  outboundCoords: number[][],
  mapboxToken: string
): Promise<any | null> {
  try {
    // Calculate perpendicular waypoint to force different path
    const midIndex = Math.floor(outboundCoords.length / 2);
    const midPoint = outboundCoords[midIndex];
    
    if (!midPoint) return null;
    
    // Calculate bearing of outbound path at midpoint
    const prevPoint = outboundCoords[Math.max(0, midIndex - 5)];
    const nextPoint = outboundCoords[Math.min(outboundCoords.length - 1, midIndex + 5)];
    
    const bearing = Math.atan2(
      nextPoint[0] - prevPoint[0],
      nextPoint[1] - prevPoint[1]
    );
    
    // Create waypoint perpendicular to outbound path
    const offsetDistance = 0.002; // ~200m offset
    const perpendicularBearing = bearing + Math.PI / 2;
    
    const waypoint = {
      lat: midPoint[1] + Math.cos(perpendicularBearing) * offsetDistance,
      lng: midPoint[0] + Math.sin(perpendicularBearing) * offsetDistance
    };
    
    // Calculate route: destination -> waypoint -> start
    const waypointUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${destination.lng},${destination.lat};${waypoint.lng},${waypoint.lat};${start.lng},${start.lat}?geometries=geojson&steps=true&access_token=${mapboxToken}`;
    const waypointResponse = await fetch(waypointUrl);
    const waypointData = await waypointResponse.json();
    
    if (waypointData.routes && waypointData.routes.length > 0) {
      return waypointData.routes[0];
    }
    
    return null;
  } catch (error) {
    console.log('Error calculating waypoint return route:', error);
    return null;
  }
}

// Fonction pour générer exactement 3 destinations déterministiques
async function generateThreeDestinations(
  validPois: any[], 
  userLocation: { lat: number; lng: number }, 
  targetOutKm: number, 
  durationMin: number, 
  calories: number, 
  mapboxToken: string,
  corsHeaders: any,
  planningData: any,
  heightM: number,
  steps: number
) {
  const destinations = [];
  const poisToEvaluate = validPois.slice(0, 20); // Plus de candidats pour avoir 3 destinations
  const evaluatedPois = [];
  
  // Calculer les scores pour tous les POI candidats
  for (const poi of poisToEvaluate) {
    try {
      if (planningData.tripType === 'round-trip') {
        // For round-trip, calculate separate outbound and return routes
        const routeResult = await calculateRoundTripRoute(userLocation, { lat: poi.center[1], lng: poi.center[0] }, mapboxToken);
        
        if (routeResult) {
          const totalDistanceKm = routeResult.outboundDistance + routeResult.returnDistance;
          const totalSteps = calculateStepsFromDistance(totalDistanceKm, heightM);
          const stepDeviation = Math.abs(totalSteps - steps) / steps;
          
          // Only include routes within ±5% of step target
          if (stepDeviation <= 0.05) {
            evaluatedPois.push({
              ...poi,
              outboundRoute: routeResult.outboundRoute,
              returnRoute: routeResult.returnRoute,
              routeDistanceKm: totalDistanceKm,
              score: stepDeviation
            });
          }
        }
      } else {
        // One-way route calculation
        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${poi.center[0]},${poi.center[1]}?geometries=geojson&steps=true&access_token=${mapboxToken}`;
        
        const dirResponse = await fetch(directionsUrl);
        const dirData = await dirResponse.json();
        
        if (dirData.routes && dirData.routes.length > 0) {
          const route = dirData.routes[0];
          const routeDistanceKm = route.distance / 1000;
          const routeSteps = calculateStepsFromDistance(routeDistanceKm, heightM);
          const stepDeviation = Math.abs(routeSteps - steps) / steps;
          
          // Only include routes within ±5% of step target
          if (stepDeviation <= 0.05) {
            evaluatedPois.push({
              ...poi,
              route,
              routeDistanceKm,
              score: stepDeviation
            });
          }
        }
      }
    } catch (error) {
      console.log('Error calculating route for POI:', error);
    }
  }
  
  // Trier par score (meilleur en premier) et prendre les 3 meilleurs
  evaluatedPois.sort((a, b) => a.score - b.score);
  const topThree = evaluatedPois.slice(0, 3);
  
  // Créer les objets destinations
  for (let i = 0; i < topThree.length; i++) {
    const poi = topThree[i];
    
    if (planningData.tripType === 'round-trip' && poi.outboundRoute && poi.returnRoute) {
      // Round-trip destination with separate routes
      destinations.push({
        id: `dest_${i + 1}_${poi.id || Math.random().toString(36).substr(2, 9)}`,
        name: poi.place_name?.split(',')[0] || poi.text || `Destination ${i + 1}`,
        coordinates: { lat: poi.center[1], lng: poi.center[0] },
        routeGeoJSON: {
          outboundCoordinates: poi.outboundRoute.geometry.coordinates,
          returnCoordinates: poi.returnRoute.geometry.coordinates
        },
        distanceKm: poi.routeDistanceKm,
        durationMin: Math.round((poi.outboundRoute.duration + poi.returnRoute.duration) / 60),
        calories: calories
      });
    } else {
      // One-way destination
      destinations.push({
        id: `dest_${i + 1}_${poi.id || Math.random().toString(36).substr(2, 9)}`,
        name: poi.place_name?.split(',')[0] || poi.text || `Destination ${i + 1}`,
        coordinates: { lat: poi.center[1], lng: poi.center[0] },
        routeGeoJSON: poi.route.geometry,
        distanceKm: poi.routeDistanceKm,
        durationMin: Math.round(poi.route.duration / 60),
        calories: calories
      });
    }
  }
  
  // Fallback si moins de 3 destinations trouvées
  while (destinations.length < 3) {
    const angle = (destinations.length * 120) * (Math.PI / 180);
    const distance = targetOutKm * (1 + destinations.length * 0.1);
    const distanceInDegrees = distance / 111.32;
    
    const destLat = userLocation.lat + Math.sin(angle) * distanceInDegrees;
    const destLng = userLocation.lng + Math.cos(angle) * distanceInDegrees;
    
    // Calculer la route réelle même pour les destinations fallback
    try {
      if (planningData.tripType === 'round-trip') {
        const routeResult = await calculateRoundTripRoute(userLocation, { lat: destLat, lng: destLng }, mapboxToken);
        
        if (routeResult) {
          const totalDistanceKm = routeResult.outboundDistance + routeResult.returnDistance;
          destinations.push({
            id: `fallback_${destinations.length + 1}_${Date.now()}`,
            name: `Circuit ${destinations.length + 1}`,
            coordinates: { lat: destLat, lng: destLng },
            routeGeoJSON: {
              outboundCoordinates: routeResult.outboundRoute.geometry.coordinates,
              returnCoordinates: routeResult.returnRoute.geometry.coordinates
            },
            distanceKm: totalDistanceKm,
            durationMin: Math.round((routeResult.outboundRoute.duration + routeResult.returnRoute.duration) / 60),
            calories: calories
          });
        }
      } else {
        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${destLng},${destLat}?geometries=geojson&steps=true&access_token=${mapboxToken}`;
        
        const dirResponse = await fetch(directionsUrl);
        const dirData = await dirResponse.json();
        
        let routeGeoJSON = null;
        let actualDistanceKm = targetOutKm;
        let actualDurationMin = Math.round(durationMin);
        
        if (dirData.routes && dirData.routes.length > 0) {
          const route = dirData.routes[0];
          routeGeoJSON = route.geometry;
          actualDistanceKm = route.distance / 1000;
          actualDurationMin = Math.round(route.duration / 60);
        }
        
        destinations.push({
          id: `fallback_${destinations.length + 1}_${Date.now()}`,
          name: `Destination ${destinations.length + 1}`,
          coordinates: { lat: destLat, lng: destLng },
          routeGeoJSON: routeGeoJSON,
          distanceKm: actualDistanceKm,
          durationMin: actualDurationMin,
          calories: calories
        });
      }
    } catch (error) {
      console.log('Error calculating fallback route:', error);
      // Si le calcul de route échoue, utiliser les données de base
      destinations.push({
        id: `fallback_${destinations.length + 1}_${Date.now()}`,
        name: `Destination ${destinations.length + 1}`,
        coordinates: { lat: destLat, lng: destLng },
        routeGeoJSON: null,
        distanceKm: targetOutKm,
        durationMin: Math.round(durationMin),
        calories: calories
      });
    }
  }
  
  console.log(`Generated ${destinations.length} destinations`);
  
  return new Response(
    JSON.stringify({ destinations }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    },
  );
}