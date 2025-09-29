import { useState, useEffect } from 'react';
import { PlanningData } from '@/types/route';

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

  const fetchDestinations = async (userLocation: UserLocation, planningData: PlanningData, variantIndex: number) => {
    setLoading(true);
    setError(null);

    try {
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
    const calculateMetrics = (targetDistanceKm: number) => {
      const steps = planningData.steps;
      const heightInM = planningData.height;
      const weightInKg = planningData.weight || 70;
      
      // Formule de foulée : 0.415 × taille (m) ou défaut 0.72m
      const strideLength = heightInM > 0 ? 0.415 * heightInM : 0.72;
      
      // Distance cible (km) = pas × foulée / 1000  
      const userTargetDistance = (steps * strideLength) / 1000;
      
      // Pour aller-retour, la distance de route est la moitié de la distance totale
      const routeDistance = planningData.tripType === 'round-trip' ? userTargetDistance / 2 : userTargetDistance;
      
      // Utiliser la distance cible de l'utilisateur avec de légères variations (±5%)
      const variance = (Math.random() - 0.5) * 0.1; // -5% à +5%
      const adjustedDistance = routeDistance * (1 + variance);
      
      // Distance totale pour l'affichage
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
        ...calculateMetrics(0) // Use target distance calculation
      },
      {
        id: 'B', 
        name: 'Tour du Quartier',
        description: 'Circuit urbain avec découverte du quartier',
        ...calculateMetrics(0) // Use target distance calculation
      },
      {
        id: 'C',
        name: 'Promenade Riverside',
        description: 'Boucle le long de la rivière avec points d\'intérêt',
        ...calculateMetrics(0) // Use target distance calculation
      }
    ] : [
      {
        id: 'A',
        name: 'Parc de la Citadelle',
        description: 'Promenade paisible vers le parc historique',
        ...calculateMetrics(0) // Use target distance calculation
      },
      {
        id: 'B', 
        name: 'Bords de Seine',
        description: 'Marche le long des quais avec vue sur le fleuve',
        ...calculateMetrics(0) // Use target distance calculation
      },
      {
        id: 'C',
        name: 'Centre Historique',
        description: 'Découverte du patrimoine architectural en centre-ville',
        ...calculateMetrics(0) // Use target distance calculation
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