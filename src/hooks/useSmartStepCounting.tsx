import { useState, useEffect } from 'react';
import { useStepDetection } from './useStepDetection';

interface UseSmartStepCountingProps {
  totalDistance: number; // Distance GPS en km
  height: number; // Taille en mètres
  activityType: 'walk' | 'run';
  isTracking: boolean;
}

interface SmartStepResult {
  displayedSteps: number;
  isUsingRealSteps: boolean;
  estimatedSteps: number;
  realSteps: number;
}

const CALIBRATION_DISTANCE_KM = 0.5;

/**
 * Hook intelligent de comptage de pas
 * - 0 à 0.5 km : Affiche les pas estimés (calculés sur distance GPS)
 * - Après 0.5 km : Bascule vers les pas réels détectés par capteur
 */
export const useSmartStepCounting = ({
  totalDistance,
  height,
  activityType,
  isTracking
}: UseSmartStepCountingProps): SmartStepResult => {
  const [hasReachedCalibration, setHasReachedCalibration] = useState(false);

  // Détection des pas réels via capteurs
  const { currentSteps: realSteps, resetStepDetection } = useStepDetection({
    isTracking,
    activityType
  });

  // Vérifier si on a atteint la distance de calibration
  useEffect(() => {
    if (totalDistance >= CALIBRATION_DISTANCE_KM && !hasReachedCalibration) {
      setHasReachedCalibration(true);
      console.log(`🎯 Calibration atteinte à ${totalDistance.toFixed(2)} km - Basculement vers pas réels`);
    }
  }, [totalDistance, hasReachedCalibration]);

  // Reset quand le tracking s'arrête
  useEffect(() => {
    if (!isTracking) {
      setHasReachedCalibration(false);
      resetStepDetection();
    }
  }, [isTracking, resetStepDetection]);

  /**
   * Calcule les pas estimés basés sur la distance GPS
   */
  const calculateEstimatedSteps = (): number => {
    const strideM = activityType === 'walk' 
      ? 0.415 * height  // Foulée marche
      : 0.5 * height;   // Foulée course
    const distanceM = totalDistance * 1000;
    return Math.round(distanceM / strideM);
  };

  const estimatedSteps = calculateEstimatedSteps();

  // Logique de basculement
  const isUsingRealSteps = hasReachedCalibration;
  const displayedSteps = isUsingRealSteps ? realSteps : estimatedSteps;

  return {
    displayedSteps,
    isUsingRealSteps,
    estimatedSteps,
    realSteps
  };
};
