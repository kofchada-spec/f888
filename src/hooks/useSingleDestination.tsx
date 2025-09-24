import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setLoading(true);
    setError(null);
    
    try {
      const scenarioKey = generateScenarioKey(userLocation, planningData);
      
      // Force un nouveau fetch en ignorant le cache temporairement pour tester les nouvelles routes
      console.log('Forçage du nouveau fetch pour tester les routes réelles');
      
      // Générer 3 nouvelles destinations
      const { data, error } = await supabase.functions.invoke('mapbox-destinations', {
        body: { 
          userLocation, 
          planningData,
          profileData,
          generateThree: true
        }
      });
      
      if (error) {
        throw error;
      }
      
      if (data?.destinations && data.destinations.length > 0) {
        const list = data.destinations;
        setDestinationsList(list);
        setCurrentDestination(list[0]);
        setCurrentIndex(0);
        setRefreshRemaining(2);
        
        // Sauvegarder en cache (commenté temporairement pour forcer le refresh)
        // localStorage.setItem(`destinations_${scenarioKey}`, JSON.stringify({ list }));
        console.log('Nouvelles destinations générées avec routes:', list[0]);
      } else {
        throw new Error('Aucune destination trouvée');
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des destinations:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [generateScenarioKey]);

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
    setError(null);
  }, []);

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