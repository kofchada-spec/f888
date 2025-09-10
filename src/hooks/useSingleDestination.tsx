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
  const [refreshRemaining, setRefreshRemaining] = useState(3);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDestination = useCallback(async (
    userLocation: UserLocation, 
    planningData: PlanningData,
    profileData?: ProfileData
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('mapbox-destinations', {
        body: { 
          userLocation, 
          planningData,
          profileData,
          excludedIds: seenIds
        }
      });
      
      if (error) {
        throw error;
      }
      
      if (data?.destination) {
        setCurrentDestination(data.destination);
        setSeenIds(prev => [...prev, data.destination.id]);
      } else {
        throw new Error('Aucune destination trouvée');
      }
    } catch (err) {
      console.error('Erreur lors de la récupération de destination:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [seenIds]);

  const refreshDestination = useCallback(async (
    userLocation: UserLocation, 
    planningData: PlanningData,
    profileData?: ProfileData
  ) => {
    if (refreshRemaining <= 0) return;
    
    setRefreshRemaining(prev => prev - 1);
    await fetchDestination(userLocation, planningData, profileData);
  }, [refreshRemaining, fetchDestination]);

  const resetSession = useCallback(() => {
    setRefreshRemaining(3);
    setSeenIds([]);
    setCurrentDestination(null);
    setError(null);
  }, []);

  return {
    currentDestination,
    refreshRemaining,
    loading,
    error,
    fetchDestination,
    refreshDestination,
    resetSession,
    canRefresh: refreshRemaining > 0
  };
};