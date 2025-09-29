import { useState, useCallback } from 'react';
import { 
  calculateTargetDistance, 
  calculateDistance, 
  calculateRouteMetrics, 
  getToleranceRange,
  generateRandomCoordinates
} from '@/utils/routeCalculations';
import { PlanningData, Coordinates, RouteData } from '@/types/route';

// Helper function to get Mapbox token
const getMapboxToken = async (): Promise<string | null> => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase.functions.invoke('mapbox-token');
    
    if (error) {
      console.error('Error fetching Mapbox token:', error);
      return null;
    }
    
    return data?.token || null;
  } catch (error) {
    console.error('Failed to fetch Mapbox token:', error);
    return null;
  }
};

export const useRouteGeneration = (
  planningData: PlanningData | undefined,
  userLocation: Coordinates | null,
  onRouteCalculated?: (data: RouteData) => void
) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  /**
   * Generate round-trip route with real Mapbox routes and ±5% tolerance validation
   */
  const generateRoundTripRoute = useCallback(async () => {
    if (!planningData || !userLocation || planningData.tripType !== 'round-trip') return null;

    const targetDistance = calculateTargetDistance(planningData.steps, planningData.height);
    const { min, max } = getToleranceRange(targetDistance);
    
    setIsCalculating(true);
    setRouteError(null);

    try {
      console.log(`🎯 Génération itinéraire aller-retour avec routes réelles - cible: ${targetDistance.toFixed(2)}km (±5% = ${min.toFixed(2)}-${max.toFixed(2)}km)`);

      const mapboxToken = await getMapboxToken();
      if (!mapboxToken) {
        throw new Error('No Mapbox token available');
      }

      const maxAttempts = 10;
      let bestRoute = null;
      let bestDifference = Infinity;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          // Generate random destination around user location
          const approximateOneWayDistance = targetDistance / 2;
          const destination = generateRandomCoordinates(userLocation, approximateOneWayDistance * 1.5);
          
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
          const difference = Math.abs(totalDistance - targetDistance);

          console.log(`Tentative ${attempt}: Aller ${outboundDistanceKm.toFixed(2)}km + Retour ${returnDistanceKm.toFixed(2)}km = Total ${totalDistance.toFixed(2)}km (diff: ${difference.toFixed(2)}km)`);

          // Save best option
          if (difference < bestDifference) {
            bestDifference = difference;
            bestRoute = {
              outboundCoordinates: outboundRoute.geometry.coordinates,
              returnCoordinates: returnRoute.geometry.coordinates,
              totalDistance,
              destLat: destination.lat,
              destLng: destination.lng
            };
          }

          // Check if within ±5% tolerance
          if (totalDistance >= min && totalDistance <= max) {
            console.log(`✅ Itinéraire aller-retour réel trouvé à la tentative ${attempt} (${totalDistance.toFixed(2)}km)`);
            
            const routeData = createRouteData(bestRoute, planningData, userLocation);
            setIsCalculating(false);
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
        setIsCalculating(false);
        return routeData;
      }

      setRouteError(`Aucun itinéraire aller-retour trouvé dans la tolérance ±5%.`);
      setIsCalculating(false);
      return null;
    } catch (error) {
      console.error('Erreur génération aller-retour:', error);
      setRouteError('Erreur lors de la génération de l\'itinéraire');
      setIsCalculating(false);
      return null;
    }
  }, [planningData, userLocation, onRouteCalculated]);

  /**
   * Generate one-way route with ±5% tolerance using real Mapbox routes
   */
  const generateOneWayRoute = useCallback(async () => {
    if (!planningData || !userLocation || planningData.tripType !== 'one-way') return null;

    const targetDistance = calculateTargetDistance(planningData.steps, planningData.height);
    const { min, max } = getToleranceRange(targetDistance);
    
    setIsCalculating(true);
    setRouteError(null);

    const maxAttempts = 10;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const destination = generateRandomCoordinates(userLocation, targetDistance * 1.2);
        
        console.log(`🎯 Tentative ${attempt}: Utilisateur à ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)} -> Destination ${destination.lat.toFixed(6)}, ${destination.lng.toFixed(6)}`);
        
        // Get real route from Mapbox instead of just calculating straight-line distance
        const mapboxToken = await getMapboxToken();
        if (!mapboxToken) {
          throw new Error('No Mapbox token available');
        }

        const routeUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${destination.lng},${destination.lat}?geometries=geojson&access_token=${mapboxToken}`;
        
        const response = await fetch(routeUrl);
        if (!response.ok) {
          throw new Error(`Mapbox API error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.routes || data.routes.length === 0) {
          continue; // Try next attempt
        }

        const route = data.routes[0];
        const routeDistanceKm = route.distance / 1000; // Convert to km
        
        if (routeDistanceKm >= min && routeDistanceKm <= max) {
          const metrics = calculateRouteMetrics(routeDistanceKm, planningData);
          
          const routeData: RouteData = {
            distance: routeDistanceKm,
            duration: metrics.durationMin,
            calories: metrics.calories,
            steps: metrics.steps,
            startCoordinates: userLocation,
            endCoordinates: destination,
            routeGeoJSON: route.geometry // Real Mapbox route geometry
          };

          onRouteCalculated?.(routeData);
          setIsCalculating(false);
          return routeData;
        }
      } catch (error) {
        console.warn(`One-way route attempt ${attempt} failed:`, error);
      }
    }

    setRouteError(`Aucun itinéraire trouvé dans la tolérance ±5%.`);
    setIsCalculating(false);
    return null;
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
        outboundCoordinates,
        returnCoordinates,
        samePathReturn: false
      }
    };

    onRouteCalculated?.(routeData);
    return routeData;
  };

  return {
    generateRoundTripRoute,
    generateOneWayRoute,
    isCalculating,
    routeError,
    setRouteError
  };
};