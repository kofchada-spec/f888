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

// Helper function to get tolerance range
const getToleranceRange = (targetDistance: number) => {
  const tolerance = 0.05; // ±5%
  return {
    min: targetDistance * (1 - tolerance),
    max: targetDistance * (1 + tolerance)
  };
};

export const useOneWayRouteGeneration = (
  planningData: PlanningData | undefined,
  userLocation: Coordinates | null,
  onRouteCalculated?: (data: RouteData) => void,
  externalSetCalculating?: (calculating: boolean) => void,
  activityType: 'walk' | 'run' = 'walk'
) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  
  // Use external setter if provided, otherwise use internal one
  const setCalculating = externalSetCalculating || setIsCalculating;

  /**
   * Generate one-way route with ±5% tolerance using real Mapbox routes
   */
  const generateOneWayRoute = useCallback(async () => {
    if (!planningData || !userLocation || planningData.tripType !== 'one-way') return null;

    const targetDistance = calculateTargetDistance(planningData.steps, planningData.height, activityType);
    const { min, max } = getToleranceRange(targetDistance);
    
    setCalculating(true);
    setRouteError(null);

    const maxAttempts = 10;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const destination = generateRandomCoordinates(userLocation, targetDistance * 1.2);
        
        console.log(`🎯 Tentative ${attempt}: Utilisateur à ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)} -> Destination ${destination.lat.toFixed(6)}, ${destination.lng.toFixed(6)}`);

        const mapboxToken = await getMapboxToken();
        if (!mapboxToken) throw new Error('Failed to get Mapbox token');

        const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${destination.lng},${destination.lat}?geometries=geojson&access_token=${mapboxToken}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distanceKm = route.distance / 1000;
          
          console.log(`📏 Distance trouvée: ${distanceKm.toFixed(2)}km (cible: ${targetDistance.toFixed(2)}km)`);

          if (distanceKm >= min && distanceKm <= max) {
            console.log(`✅ Itinéraire aller simple trouvé à la tentative ${attempt}`);
            const metrics = calculateRouteMetrics(distanceKm, planningData, activityType);

            const routeData: RouteData = {
              distance: distanceKm,
              duration: metrics.durationMin,
              calories: metrics.calories,
              steps: metrics.steps,
              startCoordinates: userLocation,
              endCoordinates: destination,
              routeGeoJSON: {
                outboundCoordinates: route.geometry.coordinates,
                samePathReturn: false
              }
            };

            onRouteCalculated?.(routeData);
            setCalculating(false);
            return routeData;
          }
        }
      } catch (error) {
        console.warn(`One-way route attempt ${attempt} failed:`, error);
      }
    }

    setRouteError(`Aucun itinéraire trouvé dans la tolérance ±5%.`);
    setCalculating(false);
    return null;
  }, [planningData, userLocation, onRouteCalculated]);

  return {
    generateOneWayRoute,
    isCalculating,
    routeError,
    setRouteError
  };
};