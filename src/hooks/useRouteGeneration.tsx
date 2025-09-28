import { useState, useCallback } from 'react';
import { 
  calculateTargetDistance, 
  calculateDistance, 
  calculateRouteMetrics, 
  getToleranceRange,
  generateRandomCoordinates
} from '@/utils/routeCalculations';
import { PlanningData, Coordinates, RouteData } from '@/types/route';

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
          // Simplified approach: generate destination at half target distance
          const halfDistance = targetDistance / 2;
          const angle = Math.random() * 2 * Math.PI;
          
          // Convert km to approximate degrees
          const distDegrees = halfDistance / 111.32;
          const destLat = userLocation.lat + Math.sin(angle) * distDegrees;
          const destLng = userLocation.lng + Math.cos(angle) * distDegrees / Math.cos(userLocation.lat * Math.PI / 180);
          
          // Simple round trip - straight line there and back
          const outboundCoordinates: [number, number][] = [
            [userLocation.lng, userLocation.lat],
            [destLng, destLat]
          ];
          
          const returnCoordinates: [number, number][] = [
            [destLng, destLat],
            [userLocation.lng, userLocation.lat]
          ];

          // Calculate total distance (double the one-way distance)
          const oneWayDistance = calculateDistance(userLocation.lat, userLocation.lng, destLat, destLng);
          const totalDistance = oneWayDistance * 2;
          const difference = Math.abs(totalDistance - targetDistance);

          console.log(`Tentative ${attempt}: Distance = ${totalDistance.toFixed(2)}km (diff: ${difference.toFixed(2)}km)`);

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
   * Generate one-way route with ±5% tolerance
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
        const actualDistance = calculateDistance(
          userLocation.lat, userLocation.lng,
          destination.lat, destination.lng
        );

        if (actualDistance >= min && actualDistance <= max) {
          const metrics = calculateRouteMetrics(actualDistance, planningData);
          
          const routeData: RouteData = {
            distance: actualDistance,
            duration: metrics.durationMin,
            calories: metrics.calories,
            steps: metrics.steps,
            startCoordinates: userLocation,
            endCoordinates: destination,
          };

          onRouteCalculated?.(routeData);
          setIsCalculating(false);
          return routeData;
        }
      } catch (error) {
        console.error(`Erreur tentative ${attempt}:`, error);
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