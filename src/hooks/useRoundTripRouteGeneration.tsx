import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Coordinates, RouteData, PlanningData } from '@/types/route';
import { calculateTargetDistance, calculateRouteMetrics, generateRandomCoordinates } from '@/utils/routeCalculations';

// Get Mapbox token from Supabase function
const getMapboxToken = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('mapbox-token');
    if (error) throw error;
    return data?.token || null;
  } catch (error) {
    console.error('Error getting Mapbox token:', error);
    return null;
  }
};

export const useRoundTripRouteGeneration = (
  planningData: PlanningData | undefined,
  userLocation: Coordinates | null,
  onRouteCalculated?: (data: RouteData) => void,
  externalSetCalculating?: (calculating: boolean) => void
) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  
  // Use external setter if provided, otherwise use internal one
  const setCalculating = externalSetCalculating || setIsCalculating;

  /**
   * Generate round-trip route with real Mapbox routes and ±5% tolerance validation
   */
  const generateRoundTripRoute = useCallback(async () => {
    if (!planningData || !userLocation || planningData.tripType !== 'round-trip') return null;

    const targetDistance = calculateTargetDistance(planningData.steps, planningData.height);
    const tolerance = 0.05; // ±5%
    const min = targetDistance * (1 - tolerance);
    const max = targetDistance * (1 + tolerance);

    try {
      setCalculating(true);
      setRouteError(null);

      const mapboxToken = await getMapboxToken();
      if (!mapboxToken) throw new Error('Failed to get Mapbox token');

      let bestRoute = null;
      let bestDifference = Infinity;
      const maxAttempts = 15;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          // Generate destination around half the target distance
          const searchDistance = targetDistance / 2;
          const destination = generateRandomCoordinates(userLocation, searchDistance);
          
          console.log(`🎯 Tentative ${attempt}: Utilisateur à ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)} -> Destination ${destination.lat.toFixed(6)}, ${destination.lng.toFixed(6)}`);

          // Get real outbound route from user location to destination
          const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${destination.lng},${destination.lat}?geometries=geojson&access_token=${mapboxToken}`;
          const outboundResponse = await fetch(outboundUrl);
          
          if (!outboundResponse.ok) continue;
          
          const outboundData = await outboundResponse.json();
          if (!outboundData.routes || outboundData.routes.length === 0) continue;
          
          // Get real return route from destination back to user location
          const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${destination.lng},${destination.lat};${userLocation.lng},${userLocation.lat}?geometries=geojson&access_token=${mapboxToken}`;
          const returnResponse = await fetch(returnUrl);
          
          if (!returnResponse.ok) continue;
          
          const returnData = await returnResponse.json();
          if (!returnData.routes || returnData.routes.length === 0) continue;

          const outboundRoute = outboundData.routes[0];
          const returnRoute = returnData.routes[0];
          
          const outboundDistanceKm = outboundRoute.distance / 1000;
          const returnDistanceKm = returnRoute.distance / 1000;
          const totalDistance = outboundDistanceKm + returnDistanceKm;

          console.log(`📏 Distance totale: ${totalDistance.toFixed(2)}km (Aller: ${outboundDistanceKm.toFixed(2)}km + Retour: ${returnDistanceKm.toFixed(2)}km)`);

          const difference = Math.abs(totalDistance - targetDistance);
          
          // Track best route for fallback
          if (difference < bestDifference) {
            bestDifference = difference;
            bestRoute = {
              totalDistance,
              destLat: destination.lat,
              destLng: destination.lng,
              outboundCoordinates: outboundRoute.geometry.coordinates,
              returnCoordinates: returnRoute.geometry.coordinates
            };
          }

          // Check if within ±5% tolerance
          if (totalDistance >= min && totalDistance <= max) {
            console.log(`✅ Itinéraire aller-retour réel trouvé à la tentative ${attempt} (${totalDistance.toFixed(2)}km)`);
            
            const routeData = createRouteData(bestRoute, planningData, userLocation);
            setCalculating(false);
            return routeData;
          }
        } catch (error) {
          console.warn(`Round-trip attempt ${attempt} failed:`, error);
        }
      }

      // Use best route if close enough (within ±8%)
      if (bestRoute && bestDifference <= targetDistance * 0.08) {
        console.log(`⚠️ Utilisation du meilleur itinéraire aller-retour réel (différence: ${bestDifference.toFixed(2)}km)`);
        const routeData = createRouteData(bestRoute, planningData, userLocation);
        setCalculating(false);
        return routeData;
      }

      setRouteError(`Aucun itinéraire aller-retour trouvé dans la tolérance ±5%.`);
      setCalculating(false);
      return null;
    } catch (error) {
      console.error('Erreur génération aller-retour:', error);
      setRouteError('Erreur lors de la génération de l\'itinéraire');
      setCalculating(false);
      return null;
    }
  }, [planningData, userLocation, onRouteCalculated]);

  // Helper function to create RouteData from route info
  const createRouteData = (routeInfo: any, planningData: PlanningData, userLocation: Coordinates): RouteData => {
    const { totalDistance, destLat, destLng, outboundCoordinates, returnCoordinates } = routeInfo;
    const metrics = calculateRouteMetrics(totalDistance, planningData);

    const routeData: RouteData = {
      distance: totalDistance,
      duration: metrics.durationMin,
      calories: metrics.calories,
      steps: metrics.steps,
      startCoordinates: userLocation,
      endCoordinates: { lat: destLat, lng: destLng },
      routeGeoJSON: {
        outboundCoordinates: outboundCoordinates,
        returnCoordinates: returnCoordinates,
        samePathReturn: false
      }
    };

    onRouteCalculated?.(routeData);
    return routeData;
  };

  return {
    generateRoundTripRoute,
    isCalculating,
    routeError,
    setRouteError
  };
};