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
    const { userLocation, planningData, variantIndex } = await req.json();
    
    // Get Mapbox token from environment
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    if (!mapboxToken) {
      throw new Error('MAPBOX_PUBLIC_TOKEN not configured');
    }

    console.log('Generating destinations for variant:', variantIndex, planningData);

    // Calculate target distance based on steps and pace
    const steps = parseInt(planningData.steps);
    const stepToKm = 0.00075; // 1 step = 0.75m
    let targetDistance = steps * stepToKm;
    
    if (planningData.tripType === 'round-trip') {
      targetDistance = targetDistance / 2;
    }

    // Create search radius around target distance (±20%)
    const minDistance = targetDistance * 0.8;
    const maxDistance = targetDistance * 1.2;

    // Generate candidate points around user location
    const candidatePoints = generateCandidatePoints(
      userLocation, 
      minDistance, 
      maxDistance, 
      variantIndex
    );

    // Find POIs near candidate points using Mapbox Geocoding
    const destinations = [];
    let poiIndex = 0;

    for (const point of candidatePoints) {
      if (destinations.length >= 3) break;

      try {
        // Search for POIs near this point
        const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.lng},${point.lat}.json?types=poi&limit=5&access_token=${mapboxToken}`;
        
        const geocodingResponse = await fetch(geocodingUrl);
        const geocodingData = await geocodingResponse.json();

        if (geocodingData.features && geocodingData.features.length > 0) {
          // Pick the first relevant POI
          const poi = geocodingData.features[0];
          
          // Get walking directions to this POI
          const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${poi.center[0]},${poi.center[1]}?geometries=geojson&access_token=${mapboxToken}`;
          
          const directionsResponse = await fetch(directionsUrl);
          const directionsData = await directionsResponse.json();

          if (directionsData.routes && directionsData.routes.length > 0) {
            const route = directionsData.routes[0];
            let actualDistance = route.distance / 1000; // Convert to km
            let actualDuration = route.duration / 60; // Convert to minutes

            // For round-trip, double the values
            if (planningData.tripType === 'round-trip') {
              actualDistance *= 2;
              actualDuration *= 2;
            }

            // Calculate calories (50 cal per km approximation)
            const calories = Math.round(actualDistance * 50);

            destinations.push({
              id: String.fromCharCode(65 + poiIndex), // A, B, C
              name: poi.place_name?.split(',')[0] || `Destination ${poiIndex + 1}`,
              distance: `${actualDistance.toFixed(1)} km`,
              duration: `${Math.round(actualDuration)} min`,
              calories,
              description: getDestinationDescription(poi, planningData.tripType),
              coordinates: {
                lng: poi.center[0],
                lat: poi.center[1]
              },
              route: route.geometry
            });

            poiIndex++;
          }
        }
        
        // If no POI found, create a generic destination
        if (destinations.length < poiIndex + 1) {
          let actualDistance = calculateDistance(userLocation, point);
          let actualDuration = actualDistance / getPaceSpeed(planningData.pace) * 60;

          if (planningData.tripType === 'round-trip') {
            actualDistance *= 2;
            actualDuration *= 2;
          }

          const calories = Math.round(actualDistance * 50);

          destinations.push({
            id: String.fromCharCode(65 + poiIndex),
            name: getGenericDestinationName(poiIndex, planningData.tripType),
            distance: `${actualDistance.toFixed(1)} km`,
            duration: `${Math.round(actualDuration)} min`,
            calories,
            description: getGenericDescription(planningData.tripType),
            coordinates: point,
            route: null // Will be straight line
          });

          poiIndex++;
        }
      } catch (error) {
        console.error('Error processing candidate point:', error);
        continue;
      }
    }

    // Ensure we have exactly 3 destinations
    while (destinations.length < 3) {
      const index = destinations.length;
      const fallbackPoint = candidatePoints[index % candidatePoints.length];
      
      let actualDistance = calculateDistance(userLocation, fallbackPoint);
      let actualDuration = actualDistance / getPaceSpeed(planningData.pace) * 60;

      if (planningData.tripType === 'round-trip') {
        actualDistance *= 2;
        actualDuration *= 2;
      }

      const calories = Math.round(actualDistance * 50);

      destinations.push({
        id: String.fromCharCode(65 + index),
        name: getGenericDestinationName(index, planningData.tripType),
        distance: `${actualDistance.toFixed(1)} km`,
        duration: `${Math.round(actualDuration)} min`,
        calories,
        description: getGenericDescription(planningData.tripType),
        coordinates: fallbackPoint,
        route: null
      });
    }

    console.log('Generated destinations:', destinations.length);

    return new Response(
      JSON.stringify({ destinations }),
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

function generateCandidatePoints(
  userLocation: { lat: number; lng: number }, 
  minDistance: number, 
  maxDistance: number, 
  variantIndex: number
): { lat: number; lng: number }[] {
  const points = [];
  const baseAngles = [0, 120, 240]; // Base angles for 3 points
  const angleOffset = variantIndex * 40; // Rotate by 40° for each variant
  
  for (let i = 0; i < 3; i++) {
    const angle = (baseAngles[i] + angleOffset) * (Math.PI / 180);
    const distance = minDistance + (maxDistance - minDistance) * (i * 0.3 + 0.1);
    
    // Convert distance to degrees (rough approximation)
    const distanceInDegrees = distance / 111.32;
    
    const lat = userLocation.lat + Math.sin(angle) * distanceInDegrees;
    const lng = userLocation.lng + Math.cos(angle) * distanceInDegrees;
    
    points.push({ lat, lng });
  }
  
  return points;
}

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

function getPaceSpeed(pace: string): number {
  const speeds = {
    slow: 4,     // 4 km/h
    moderate: 5, // 5 km/h  
    fast: 6.5    // 6.5 km/h
  };
  return speeds[pace] || 5;
}

function getDestinationDescription(poi: any, tripType: string): string {
  const poiType = poi.properties?.category || 'lieu';
  if (tripType === 'round-trip') {
    return `Circuit incluant ${poi.place_name?.split(',')[0]} avec retour au point de départ`;
  } else {
    return `Marche vers ${poi.place_name?.split(',')[0]} (${poiType})`;
  }
}

function getGenericDestinationName(index: number, tripType: string): string {
  const names = {
    roundTrip: ['Circuit du Quartier', 'Boucle Découverte', 'Tour Panoramique'],
    oneWay: ['Point de Vue', 'Zone Piétonne', 'Espace Vert']
  };
  
  const nameList = tripType === 'round-trip' ? names.roundTrip : names.oneWay;
  return nameList[index % nameList.length];
}

function getGenericDescription(tripType: string): string {
  if (tripType === 'round-trip') {
    return 'Circuit urbain avec retour automatique au point de départ';
  } else {
    return 'Destination accessible à pied depuis votre position';
  }
}