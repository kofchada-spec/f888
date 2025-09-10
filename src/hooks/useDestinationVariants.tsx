import { useState, useEffect } from 'react';

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

interface Destination {
  id: string;
  name: string;
  distance: string;
  duration: string;
  calories: number;
  description: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  route?: any;
}

export const useDestinationVariants = () => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateScenarioKey = (userLocation: UserLocation, planningData: PlanningData): string => {
    // Round coordinates to 3 decimal places for consistent grouping
    const roundedLat = Math.round(userLocation.lat * 1000) / 1000;
    const roundedLng = Math.round(userLocation.lng * 1000) / 1000;
    
    return `${roundedLat}_${roundedLng}_${planningData.steps}_${planningData.pace}_${planningData.tripType}_${planningData.height}_${planningData.weight}`;
  };

  const getVariantIndex = (scenarioKey: string): number => {
    const storageKey = `destination_variant_${scenarioKey}`;
    const currentIndex = parseInt(localStorage.getItem(storageKey) || '0');
    
    // Increment for next time (cycle 0, 1, 2)
    const nextIndex = (currentIndex + 1) % 3;
    localStorage.setItem(storageKey, nextIndex.toString());
    
    console.log(`Scenario: ${scenarioKey}, Current variant: ${currentIndex}, Next: ${nextIndex}`);
    
    return currentIndex;
  };

  const fetchDestinations = async (userLocation: UserLocation, planningData: PlanningData) => {
    setLoading(true);
    setError(null);

    try {
      const scenarioKey = generateScenarioKey(userLocation, planningData);
      const variantIndex = getVariantIndex(scenarioKey);

      console.log('Fetching destinations for variant:', variantIndex);

      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('mapbox-destinations', {
        body: {
          userLocation,
          planningData,
          variantIndex
        }
      });

      if (error) {
        console.error('Error calling mapbox-destinations:', error);
        throw new Error(`Failed to fetch destinations: ${error.message}`);
      }

      if (data?.destinations) {
        setDestinations(data.destinations);
        console.log('Loaded destinations:', data.destinations.length);
      } else {
        throw new Error('No destinations received from API');
      }
    } catch (err) {
      console.error('Error fetching destinations:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      
      // Fallback to static destinations
      setDestinations(generateFallbackDestinations(planningData));
    } finally {
      setLoading(false);
    }
  };

  const generateFallbackDestinations = (planningData: PlanningData): Destination[] => {
    const calculateMetrics = (baseDistance: number) => {
      const steps = parseInt(planningData.steps);
      const heightInM = parseFloat(planningData.height);
      const weightInKg = parseFloat(planningData.weight) || 70; // fallback weight
      
      // Formule de foulée : 0.415 × taille (m)
      const strideLength = 0.415 * heightInM;
      
      // Distance (km) = pas × foulée / 1000
      let targetDistance = (steps * strideLength) / 1000;
      
      if (planningData.tripType === 'round-trip') {
        targetDistance = targetDistance / 2;
      }
      
      // Ajustement avec le ratio de base
      const adjustedDistance = (baseDistance * targetDistance) / 5;
      const displayDistance = planningData.tripType === 'round-trip' ? adjustedDistance * 2 : adjustedDistance;
      
      // Vitesse selon l'allure
      const paceSpeed = {
        slow: 4,
        moderate: 5,
        fast: 6
      };
      
      const speed = paceSpeed[planningData.pace];
      const duration = displayDistance / speed * 60; // en minutes
      
      // Calories : distance × poids × coefficient
      const calorieCoefficients = {
        slow: 0.35,
        moderate: 0.50,
        fast: 0.70
      };
      
      const coefficient = calorieCoefficients[planningData.pace];
      const calories = displayDistance * weightInKg * coefficient;
      
      return {
        distance: displayDistance.toFixed(1),
        duration: Math.round(duration),
        calories: Math.round(calories)
      };
    };

    const baseDestinations = planningData.tripType === 'round-trip' ? [
      {
        id: 'A',
        name: 'Circuit du Parc',
        description: 'Boucle complète dans le parc avec retour au point de départ',
        ...calculateMetrics(3.5)
      },
      {
        id: 'B', 
        name: 'Tour du Quartier',
        description: 'Circuit urbain avec découverte du quartier',
        ...calculateMetrics(4.8)
      },
      {
        id: 'C',
        name: 'Promenade Riverside',
        description: 'Boucle le long de la rivière avec points d\'intérêt',
        ...calculateMetrics(2.9)
      }
    ] : [
      {
        id: 'A',
        name: 'Parc de la Citadelle',
        description: 'Promenade paisible vers le parc historique',
        ...calculateMetrics(4.2)
      },
      {
        id: 'B', 
        name: 'Bords de Seine',
        description: 'Marche le long des quais avec vue sur le fleuve',
        ...calculateMetrics(5.8)
      },
      {
        id: 'C',
        name: 'Centre Historique',
        description: 'Découverte du patrimoine architectural en centre-ville',
        ...calculateMetrics(3.6)
      }
    ];

    return baseDestinations.map(dest => ({
      ...dest,
      distance: `${dest.distance} km`,
      duration: `${dest.duration} min`
    }));
  };

  return {
    destinations,
    loading,
    error,
    fetchDestinations
  };
};