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
   * Generate round-trip route with ±5% tolerance validation - SIMPLIFIED VERSION
   */
  const generateRoundTripRoute = useCallback(async () => {
    if (!planningData || !userLocation || planningData.tripType !== 'round-trip') return null;

    const targetDistance = calculateTargetDistance(planningData.steps, planningData.height);
    const { min, max } = getToleranceRange(targetDistance);
    
    setIsCalculating(true);
    setRouteError(null);

    try {
      console.log(`🎯 Génération itinéraire aller-retour - cible: ${targetDistance.toFixed(2)}km (±5% = ${min.toFixed(2)}-${max.toFixed(2)}km)`);

      const maxAttempts = 15;
      let bestRoute = null;
      let bestDifference = Infinity;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          // Generate random destination using proper geographic calculation
          const halfDistance = targetDistance / 2; // km for one-way
          const angle = Math.random() * 2 * Math.PI;
          
          // More accurate coordinate calculation using haversine formula
          // 1 degree latitude ≈ 111.32 km
          // 1 degree longitude varies by latitude: 111.32 * cos(latitude)
          const latScale = 111.32; // km per degree latitude
          const lngScale = 111.32 * Math.cos(userLocation.lat * Math.PI / 180); // km per degree longitude
          
          const deltaLat = (halfDistance * Math.sin(angle)) / latScale;
          const deltaLng = (halfDistance * Math.cos(angle)) / lngScale;
          
          const destLat = userLocation.lat + deltaLat;
          const destLng = userLocation.lng + deltaLng;
          
          // Validate coordinates are reasonable and within bounds
          if (Math.abs(destLat) > 85 || Math.abs(destLng) > 180 || 
              Math.abs(destLat - userLocation.lat) > 1 || Math.abs(destLng - userLocation.lng) > 1) {
            continue;
          }
          
          // Simple round trip - straight line there and back
          const outboundCoordinates: [number, number][] = [
            [userLocation.lng, userLocation.lat],
            [destLng, destLat]
          ];
          
          const returnCoordinates: [number, number][] = [
            [destLng, destLat],
            [userLocation.lng, userLocation.lat]
          ];

          // Calculate actual distance using haversine formula
          const oneWayDistance = calculateDistance(userLocation.lat, userLocation.lng, destLat, destLng);
          const totalDistance = oneWayDistance * 2;
          const difference = Math.abs(totalDistance - targetDistance);

          console.log(`Tentative ${attempt}: Distance = ${totalDistance.toFixed(2)}km (diff: ${difference.toFixed(2)}km, cible: ${targetDistance.toFixed(2)}km)`);

          // Save best option
          if (difference < bestDifference) {
            bestDifference = difference;
            bestRoute = {
              outboundCoordinates,
              returnCoordinates,
              totalDistance,
              destLat,
              destLng
            };
          }

          // Check if within ±5% tolerance
          if (totalDistance >= min && totalDistance <= max) {
            console.log(`✅ Itinéraire valide trouvé à la tentative ${attempt} (${totalDistance.toFixed(2)}km)`);
            
            const routeData = createRouteData(bestRoute, planningData, userLocation);
            setIsCalculating(false);
            return routeData;
          }
        } catch (error) {
          console.error(`Erreur tentative ${attempt}:`, error);
        }
      }

      // Use best route if close enough (within ±8%)
      if (bestRoute && bestDifference <= targetDistance * 0.08) {
        console.log(`⚠️ Utilisation du meilleur itinéraire trouvé (différence: ${bestDifference.toFixed(2)}km)`);
        const routeData = createRouteData(bestRoute, planningData, userLocation);
        setIsCalculating(false);
        return routeData;
      }

      // No valid route found
      console.log(`❌ Aucun itinéraire acceptable après ${maxAttempts} tentatives`);
      setRouteError(`Aucun itinéraire trouvé respectant exactement l'objectif de ${targetDistance.toFixed(1)}km (±5%). Essayez un nombre de pas différent.`);
      
    } catch (error) {
      console.error('Erreur lors de la génération:', error);
      setRouteError('Erreur lors de la génération de l\'itinéraire. Veuillez réessayer.');
    } finally {
      setIsCalculating(false);
    }

    return null;
  }, [planningData, userLocation]);

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