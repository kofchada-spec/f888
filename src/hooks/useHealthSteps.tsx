import { useState, useEffect, useRef } from 'react';
import { CapacitorHealthkit, QueryOutput } from '@perfood/capacitor-healthkit';
import { Capacitor } from '@capacitor/core';

interface UseHealthStepsProps {
  isTracking: boolean;
  activityType: 'walk' | 'run';
}

interface UseHealthStepsReturn {
  currentSteps: number;
  isMovementDetected: boolean;
  resetStepDetection: () => void;
}

export const useHealthSteps = ({ 
  isTracking,
  activityType 
}: UseHealthStepsProps): UseHealthStepsReturn => {
  const [currentSteps, setCurrentSteps] = useState(0);
  const [isMovementDetected, setIsMovementDetected] = useState(false);
  const startSteps = useRef<number>(0);
  const intervalId = useRef<NodeJS.Timeout | null>(null);
  const lastStepCount = useRef<number>(0);
  const startTime = useRef<Date | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Health tracking only available on native platforms');
      return;
    }

    const initHealthKit = async () => {
      try {
        // Demander les permissions
        await CapacitorHealthkit.requestAuthorization({
          all: [],
          read: ['steps'],
          write: []
        });
        console.log('HealthKit permissions granted');
      } catch (error) {
        console.error('Error requesting HealthKit permissions:', error);
      }
    };

    initHealthKit();
  }, []);

  useEffect(() => {
    if (!isTracking || !Capacitor.isNativePlatform()) {
      if (intervalId.current) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
      return;
    }

    const startTracking = async () => {
      try {
        startTime.current = new Date();
        
        // Obtenir le nombre de pas au début
        const initialSteps = await getStepCount(startTime.current, new Date());
        startSteps.current = initialSteps;
        lastStepCount.current = initialSteps;
        
        console.log('Health tracking started, initial steps:', initialSteps);

        // Vérifier les pas toutes les 2 secondes
        intervalId.current = setInterval(async () => {
          if (!startTime.current) return;
          
          const currentStepCount = await getStepCount(startTime.current, new Date());
          const newSteps = currentStepCount - startSteps.current;
          
          setCurrentSteps(Math.max(0, newSteps));
          
          // Détecter le mouvement (si les pas augmentent)
          if (currentStepCount > lastStepCount.current) {
            setIsMovementDetected(true);
            lastStepCount.current = currentStepCount;
          } else {
            // Pas de nouveaux pas depuis 4 secondes = pas de mouvement
            setIsMovementDetected(false);
          }
        }, 2000);
      } catch (error) {
        console.error('Error starting health tracking:', error);
      }
    };

    startTracking();

    return () => {
      if (intervalId.current) {
        clearInterval(intervalId.current);
        intervalId.current = null;
      }
    };
  }, [isTracking]);

  const getStepCount = async (startDate: Date, endDate: Date): Promise<number> => {
    try {
      const result: QueryOutput = await CapacitorHealthkit.queryHKitSampleType({
        sampleName: 'stepCount',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 0
      });

      if (result.resultData && result.resultData.length > 0) {
        // Sommer tous les pas de la période
        const totalSteps = result.resultData.reduce((sum, sample: any) => {
          return sum + (sample.quantity || 0);
        }, 0);
        return totalSteps;
      }
      
      return 0;
    } catch (error) {
      console.error('Error querying step count:', error);
      return 0;
    }
  };

  const resetStepDetection = () => {
    setCurrentSteps(0);
    setIsMovementDetected(false);
    startSteps.current = 0;
    lastStepCount.current = 0;
    startTime.current = null;
    
    if (intervalId.current) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }
  };

  return {
    currentSteps,
    isMovementDetected,
    resetStepDetection
  };
};
