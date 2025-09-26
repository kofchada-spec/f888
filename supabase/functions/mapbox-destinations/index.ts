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
    const speedKmh = { slow: 4, moderate: 5, fast: 6 }[planningData.pace as 'slow' | 'moderate' | 'fast'];
    const durationMin = (totalDistanceKm / speedKmh) * 60;
    const calorieCoeff = { slow: 0.35, moderate: 0.50, fast: 0.70 }[planningData.pace as 'slow' | 'moderate' | 'fast'];
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
          poiCandidates.push(...data.features.map((poi: any) => ({
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
                  returnCoordinates: routeResult.returnRoute.geometry.coordinates,
                  samePathReturn: routeResult.samePathReturn
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
                  returnCoordinates: routeResult.returnRoute.geometry.coordinates,
                  samePathReturn: routeResult.samePathReturn
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
                returnCoordinates: routeResult.returnRoute.geometry.coordinates,
                samePathReturn: routeResult.samePathReturn
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

    if (bestDestination) {
      console.log('Generated single destination:', bestDestination.name);
    }

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
      JSON.stringify({ error: (error as Error).message }),
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

// Calculate separate outbound and return routes for round trips with meaningful differentiation
async function calculateRoundTripRoute(
  start: { lat: number; lng: number }, 
  destination: { lat: number; lng: number },
  mapboxToken: string
): Promise<{
  outboundRoute: any;
  returnRoute: any; 
  outboundDistance: number;
  returnDistance: number;
  samePathReturn?: boolean;
} | null> {
  const startTime = Date.now();
  const MAX_ROUTING_TIME = 8000; // 8 seconds max
  
  try {
    console.log('Starting enhanced round-trip route calculation...');
    
    // Calculate outbound route
    const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${start.lng},${start.lat};${destination.lng},${destination.lat}?geometries=geojson&steps=true&access_token=${mapboxToken}`;
    const outboundResponse = await fetch(outboundUrl);
    const outboundData = await outboundResponse.json();
    
    if (!outboundData.routes || outboundData.routes.length === 0) {
      return null;
    }
    
    const outboundRoute = outboundData.routes[0];
    console.log(`Outbound route calculated: ${(outboundRoute.distance / 1000).toFixed(2)}km`);
    
    let bestReturnRoute = null;
    let minOverlap = 1.0;
    let samePathReturn = false;
    
    // Strategy 1: Try basic alternatives with relaxed thresholds
    try {
      const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${destination.lng},${destination.lat};${start.lng},${start.lat}?geometries=geojson&steps=true&alternatives=true&access_token=${mapboxToken}`;
      const returnResponse = await fetch(returnUrl);
      const returnData = await returnResponse.json();
      
      if (returnData.routes && returnData.routes.length > 0) {
        for (const route of returnData.routes.slice(0, 5)) {
          if (Date.now() - startTime > MAX_ROUTING_TIME) break;
          
          const overlap = calculatePathOverlap(
            outboundRoute.geometry.coordinates,
            route.geometry.coordinates
          );
          
          // More flexible thresholds based on route quality
          const acceptableThreshold = overlap > 0.80 ? 0.75 : 0.60;
          console.log(`Route overlap: ${(overlap * 100).toFixed(1)}% (threshold: ${(acceptableThreshold * 100).toFixed(0)}%)`);
          
          if (overlap < minOverlap) {
            minOverlap = overlap;
            bestReturnRoute = route;
          }
          
          // Accept routes with reasonable differentiation
          if (overlap <= acceptableThreshold) {
            console.log(`✓ Found good alternative with ${((1-overlap) * 100).toFixed(1)}% differentiation`);
            break;
          }
        }
      }
    } catch (error) {
      console.log('Error fetching basic alternatives:', error);
    }
    
    // Strategy 2: Smart waypoint routing if needed
    if ((!bestReturnRoute || minOverlap > 0.65) && Date.now() - startTime < MAX_ROUTING_TIME) {
      console.log(`Need better route differentiation (current: ${((1-minOverlap) * 100).toFixed(1)}%), trying smart waypoints...`);
      
      const enhancedRoutes = await calculateEnhancedWaypointRoutes(
        start, 
        destination, 
        outboundRoute, 
        mapboxToken,
        MAX_ROUTING_TIME - (Date.now() - startTime)
      );
      
      for (const route of enhancedRoutes) {
        const overlap = calculatePathOverlap(
          outboundRoute.geometry.coordinates,
          route.geometry.coordinates
        );
        
        console.log(`Enhanced waypoint overlap: ${(overlap * 100).toFixed(1)}%`);
        
        if (overlap < minOverlap) {
          minOverlap = overlap;
          bestReturnRoute = route;
        }
        
        if (overlap <= 0.65) {
          console.log(`✓ Enhanced route achieved ${((1-overlap) * 100).toFixed(1)}% differentiation`);
          break;
        }
      }
    }
    
    // Strategy 3: Create intelligent return route with strategic variation
    if (!bestReturnRoute || minOverlap > 0.70) {
      console.log(`Creating strategic return route (current best: ${((1-minOverlap) * 100).toFixed(1)}% different)`);
      
      const strategicRoute = await createStrategicReturnRoute(start, destination, outboundRoute, mapboxToken);
      if (strategicRoute) {
        const strategicOverlap = calculatePathOverlap(
          outboundRoute.geometry.coordinates,
          strategicRoute.geometry.coordinates
        );
        
        if (strategicOverlap < minOverlap) {
          minOverlap = strategicOverlap;
          bestReturnRoute = strategicRoute;
          console.log(`Strategic route improved differentiation to ${((1-strategicOverlap) * 100).toFixed(1)}%`);
        }
      }
    }
    
    // Final fallback: enhanced reverse route
    if (!bestReturnRoute) {
      console.log('Using enhanced reverse route as final fallback');
      bestReturnRoute = {
        ...outboundRoute,
        geometry: {
          ...outboundRoute.geometry,
          coordinates: [...outboundRoute.geometry.coordinates].reverse()
        }
      };
      samePathReturn = true;
    }
    
    const totalTime = Date.now() - startTime;
    const finalDifferentiation = ((1 - minOverlap) * 100).toFixed(1);
    console.log(`✓ Round-trip completed in ${totalTime}ms with ${finalDifferentiation}% route differentiation`);
    
    return {
      outboundRoute,
      returnRoute: bestReturnRoute,
      outboundDistance: outboundRoute.distance / 1000,
      returnDistance: bestReturnRoute.distance / 1000,
      samePathReturn
    };
    
  } catch (error) {
    console.log('Error calculating round-trip route:', error);
    return null;
  }
}

// Calculate path overlap percentage using improved algorithm
function calculatePathOverlap(path1: number[][], path2: number[][]): number {
  if (!path1.length || !path2.length) return 0;
  
  const bufferRadius = 0.0002; // ~20m buffer in degrees
  let overlappingSegments = 0;
  const totalPath2Segments = path2.length - 1;
  
  if (totalPath2Segments <= 0) return 0;
  
  // Check each segment of path2 against all segments of path1
  for (let i = 0; i < path2.length - 1; i++) {
    const seg2Start = path2[i];
    const seg2End = path2[i + 1];
    
    let segmentOverlaps = false;
    for (let j = 0; j < path1.length - 1; j++) {
      const seg1Start = path1[j];
      const seg1End = path1[j + 1];
      
      // Check if segments are within buffer distance
      if (segmentsWithinBuffer(seg1Start, seg1End, seg2Start, seg2End, bufferRadius)) {
        segmentOverlaps = true;
        break;
      }
    }
    
    if (segmentOverlaps) {
      overlappingSegments++;
    }
  }
  
  return overlappingSegments / totalPath2Segments;
}

// Check if two line segments are within buffer distance
function segmentsWithinBuffer(
  seg1Start: number[], seg1End: number[], 
  seg2Start: number[], seg2End: number[], 
  buffer: number
): boolean {
  // Simple point-to-segment distance check
  const distances = [
    pointToSegmentDistance(seg2Start, seg1Start, seg1End),
    pointToSegmentDistance(seg2End, seg1Start, seg1End),
    pointToSegmentDistance(seg1Start, seg2Start, seg2End),
    pointToSegmentDistance(seg1End, seg2Start, seg2End)
  ];
  
  return Math.min(...distances) <= buffer;
}

// Calculate distance from point to line segment
function pointToSegmentDistance(point: number[], segStart: number[], segEnd: number[]): number {
  const A = point[0] - segStart[0];
  const B = point[1] - segStart[1];
  const C = segEnd[0] - segStart[0];
  const D = segEnd[1] - segStart[1];
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) {
    return Math.sqrt(A * A + B * B);
  }
  
  const param = dot / lenSq;
  
  let xx, yy;
  if (param < 0) {
    xx = segStart[0];
    yy = segStart[1];
  } else if (param > 1) {
    xx = segEnd[0];
    yy = segEnd[1];
  } else {
    xx = segStart[0] + param * C;
    yy = segStart[1] + param * D;
  }
  
  const dx = point[0] - xx;
  const dy = point[1] - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Try to calculate return route with enhanced waypoint strategies
async function calculateEnhancedWaypointRoutes(
  start: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  outboundRoute: any,
  mapboxToken: string,
  remainingTime: number
): Promise<any[]> {
  const routes: any[] = [];
  const startTime = Date.now();
  
  try {
    // Strategy 1: Multiple perpendicular waypoints
    const outboundCoords = outboundRoute.geometry.coordinates;
    const midPoint = outboundCoords[Math.floor(outboundCoords.length / 2)];
    
    const bearing = Math.atan2(
      destination.lat - start.lat,
      destination.lng - start.lng
    );
    
    // Create waypoints at different distances and angles
    const waypointConfigs = [
      { distance: 0.003, angle: Math.PI / 2 },     // 90° right, ~300m
      { distance: 0.003, angle: -Math.PI / 2 },    // 90° left, ~300m
      { distance: 0.002, angle: Math.PI / 3 },     // 60° right, ~200m
      { distance: 0.002, angle: -Math.PI / 3 },    // 60° left, ~200m
    ];
    
    for (const config of waypointConfigs) {
      if (Date.now() - startTime > remainingTime) break;
      
      const waypointLat = midPoint[1] + Math.sin(bearing + config.angle) * config.distance;
      const waypointLng = midPoint[0] + Math.cos(bearing + config.angle) * config.distance;
      
      try {
        const waypointUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${destination.lng},${destination.lat};${waypointLng},${waypointLat};${start.lng},${start.lat}?geometries=geojson&steps=true&access_token=${mapboxToken}`;
        
        const response = await fetch(waypointUrl);
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          routes.push(data.routes[0]);
        }
      } catch (error) {
        console.log('Waypoint route error:', error);
      }
    }
    
    return routes;
  } catch (error) {
    console.log('Error in enhanced waypoint calculation:', error);
    return routes;
  }
}

// Create a strategic return route using intelligent routing
async function createStrategicReturnRoute(
  start: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  outboundRoute: any,
  mapboxToken: string
): Promise<any | null> {
  try {
    const outboundCoords = outboundRoute.geometry.coordinates;
    
    // Find the quarter and three-quarter points of the outbound route
    const quarterIndex = Math.floor(outboundCoords.length * 0.25);
    const threeQuarterIndex = Math.floor(outboundCoords.length * 0.75);
    
    const quarterPoint = outboundCoords[quarterIndex];
    const threeQuarterPoint = outboundCoords[threeQuarterIndex];
    
    // Create strategic waypoints that avoid the middle section of outbound route
    const strategicWaypoints = [];
    
    // Calculate perpendicular offset from quarter point
    const bearing = Math.atan2(
      threeQuarterPoint[1] - quarterPoint[1],
      threeQuarterPoint[0] - quarterPoint[0]
    );
    
    const offsetDistance = 0.002; // ~200m
    const perpBearing = bearing + Math.PI / 2;
    
    strategicWaypoints.push({
      lat: quarterPoint[1] + Math.sin(perpBearing) * offsetDistance,
      lng: quarterPoint[0] + Math.cos(perpBearing) * offsetDistance
    });
    
    // Try routing through strategic waypoint
    const waypoint = strategicWaypoints[0];
    const strategicUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${destination.lng},${destination.lat};${waypoint.lng},${waypoint.lat};${start.lng},${start.lat}?geometries=geojson&steps=true&access_token=${mapboxToken}`;
    
    const response = await fetch(strategicUrl);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      return data.routes[0];
    }
    
    return null;
  } catch (error) {
    console.log('Error creating strategic return route:', error);
    return null;
  }
}

// Try to calculate return route with waypoints to avoid the outbound path
async function calculateWaypointReturn(
  start: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  outboundCoordinates: number[][],
  mapboxToken: string,
  bufferMeters: number = 30
): Promise<any | null> {
  try {
    console.log(`Calculating waypoint return with ${bufferMeters}m buffer...`);
    
    // Create multiple waypoint candidates to avoid the outbound path
    const waypoints = findAvoidanceWaypoints(start, destination, outboundCoordinates, bufferMeters);
    
    if (!waypoints.length) {
      console.log('No suitable waypoints found');
      return null;
    }
    
    // Try each waypoint configuration
    for (const waypoint of waypoints) {
      try {
        const waypointUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${destination.lng},${destination.lat};${waypoint.lng},${waypoint.lat};${start.lng},${start.lat}?geometries=geojson&steps=true&access_token=${mapboxToken}`;
        
        const response = await fetch(waypointUrl);
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          console.log(`Waypoint route found via ${waypoint.lng.toFixed(4)},${waypoint.lat.toFixed(4)}: ${(route.distance / 1000).toFixed(2)}km`);
          return route;
        }
      } catch (error) {
        console.log('Error with waypoint:', waypoint, error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.log('Error calculating waypoint return:', error);
    return null;
  }
}

// Find waypoints that help avoid the outbound path
function findAvoidanceWaypoints(
  start: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  outboundCoordinates: number[][],
  bufferMeters: number
): { lat: number; lng: number }[] {
  if (!outboundCoordinates.length) return [];
  
  const waypoints: { lat: number; lng: number }[] = [];
  const bufferDegrees = bufferMeters / 111320; // Convert meters to degrees (approximate)
  
  // Strategy 1: Perpendicular waypoint from path midpoint
  const midIndex = Math.floor(outboundCoordinates.length / 2);
  const pathMidpoint = outboundCoordinates[midIndex];
  
  const mainAngle = Math.atan2(
    destination.lat - start.lat,
    destination.lng - start.lng
  );
  
  // Create waypoints on both sides of the path
  const offsetDistance = bufferDegrees * 3; // 3x buffer distance for clear avoidance
  const perpendicularAngles = [mainAngle + Math.PI / 2, mainAngle - Math.PI / 2];
  
  for (const perpAngle of perpendicularAngles) {
    waypoints.push({
      lat: pathMidpoint[1] + Math.sin(perpAngle) * offsetDistance,
      lng: pathMidpoint[0] + Math.cos(perpAngle) * offsetDistance
    });
  }
  
  // Strategy 2: Wide arc waypoints
  const centerLat = (start.lat + destination.lat) / 2;
  const centerLng = (start.lng + destination.lng) / 2;
  const radius = offsetDistance * 1.5;
  
  // Create waypoints in an arc around the center
  const arcAngles = [-Math.PI/3, -Math.PI/6, Math.PI/6, Math.PI/3];
  for (const arcAngle of arcAngles) {
    const adjustedAngle = mainAngle + arcAngle;
    waypoints.push({
      lat: centerLat + Math.sin(adjustedAngle) * radius,
      lng: centerLng + Math.cos(adjustedAngle) * radius
    });
  }
  
  console.log(`Generated ${waypoints.length} avoidance waypoints with ${bufferMeters}m buffer`);
  return waypoints;
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
              samePathReturn: routeResult.samePathReturn,
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
              returnCoordinates: poi.returnRoute.geometry.coordinates,
              samePathReturn: poi.samePathReturn
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
    const angle: number = (destinations.length * 120) * (Math.PI / 180);
    const distance: number = targetOutKm * (1 + destinations.length * 0.1);
    const distanceInDegrees: number = distance / 111.32;
    
    const destLat: number = userLocation.lat + Math.sin(angle) * distanceInDegrees;
    const destLng: number = userLocation.lng + Math.cos(angle) * distanceInDegrees;
    
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