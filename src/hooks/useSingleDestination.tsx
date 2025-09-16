import { useState, useCallback } from 'react';
import { useOptimizedRouting } from './useOptimizedRouting';
import { useMapPerformance } from './useMapPerformance';

interface Destination {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  routeGeoJSON?: any;
  distanceKm: number;
  durationMin: number;
  calories: number;
}

interface PlanningData {
  steps: string;
  pace: 'slow' | 'moderate' | 'fast';
  tripType: 'one-way' | 'round-trip';
  height: string;
  weight: string;
}

interface UserLocation {
  lat: number;
  lng: number;
}

interface ProfileData {
  heightM?: number;
  weightKg?: number;
}

export const useSingleDestination = () => {
  const [currentDestination, setCurrentDestination] = useState<Destination | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [refreshRemaining, setRefreshRemaining] = useState(2);
  const [destinationsList, setDestinationsList] = useState<Destination[]>([]);
  
  const { loading, error, fetchOptimizedRoute, clearCache } = useOptimizedRouting();
  const { startTimer, logPerformanceSummary, resetMetrics } = useMapPerformance();

  // Fonction pour générer une clé de scénario
  const generateScenarioKey = useCallback((
    userLocation: UserLocation,
    planningData: PlanningData
  ) => {
    // Arrondir la position à ±0.001°
    const roundedLat = Math.round(userLocation.lat * 1000) / 1000;
    const roundedLng = Math.round(userLocation.lng * 1000) / 1000;
    
    return `${roundedLat}_${roundedLng}_${planningData.steps}_${planningData.pace}_${planningData.tripType}_${planningData.height}`;
  }, []);

  const fetchDestinations = useCallback(async (
    userLocation: UserLocation, 
    planningData: PlanningData,
    profileData?: ProfileData
  ) => {
    resetMetrics();
    const endGeocodeTimer = startTimer('geocode');
    
    try {
      console.log('🚀 Starting optimized destination fetch');
      
      // End geocode timer (location already available)
      endGeocodeTimer();
      
      const endRoutingTimer = startTimer('routing');
      
      // Use optimized routing with caching and debouncing
      const data = await fetchOptimizedRoute(userLocation, planningData, profileData);
      
      endRoutingTimer();
      
      if (data?.destinations && data.destinations.length > 0) {
        const list = data.destinations;
        setDestinationsList(list);
        setCurrentDestination(list[0]);
        setCurrentIndex(0);
        setRefreshRemaining(2);
        
        console.log('✅ Optimized destinations loaded:', list[0]);
        logPerformanceSummary();
      } else {
        throw new Error('No destinations found');
      }
    } catch (err) {
      console.error('❌ Error fetching destinations:', err);
      throw err; // Let the optimized routing handle error states
    }
  }, [generateScenarioKey, fetchOptimizedRoute, startTimer, logPerformanceSummary, resetMetrics]);

  const refreshDestination = useCallback(() => {
    if (refreshRemaining <= 0 || currentIndex >= destinationsList.length - 1) return;
    
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setCurrentDestination(destinationsList[nextIndex]);
    setRefreshRemaining(prev => prev - 1);
  }, [refreshRemaining, currentIndex, destinationsList]);

  const resetSession = useCallback(() => {
    setRefreshRemaining(2);
    setCurrentIndex(0);
    setDestinationsList([]);
    setCurrentDestination(null);
    clearCache();
    resetMetrics();
  }, [clearCache, resetMetrics]);

  return {
    currentDestination,
    refreshRemaining,
    loading,
    error,
    fetchDestinations,
    refreshDestination,
    resetSession,
    canRefresh: refreshRemaining > 0 && currentIndex < destinationsList.length - 1
  };
};