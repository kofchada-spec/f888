import { useState, useEffect, useCallback } from 'react';

interface UseLiveMetricsProps {
  totalDistance: number; // in km
  currentSpeed: number; // in km/h
  elapsedTime: number; // in seconds
  weight: number; // in kg
  activityType: 'walk' | 'run';
  pace: 'slow' | 'moderate' | 'fast';
}

interface LiveMetrics {
  currentPace: string; // min/km format
  averageSpeed: number; // km/h
  calories: number;
  estimatedEndTime: string;
}

/**
 * Hook for calculating live metrics during activity
 * Provides real-time pace, speed, calories, and ETA
 */
export const useLiveMetrics = ({
  totalDistance,
  currentSpeed,
  elapsedTime,
  weight,
  activityType,
  pace
}: UseLiveMetricsProps): LiveMetrics => {
  const [currentPace, setCurrentPace] = useState<string>('--:--');
  const [averageSpeed, setAverageSpeed] = useState<number>(0);
  const [calories, setCalories] = useState<number>(0);
  const [estimatedEndTime, setEstimatedEndTime] = useState<string>('--:--');

  /**
   * Calculate current pace in min/km
   */
  const calculatePace = useCallback((speed: number): string => {
    if (speed === 0) return '--:--';
    const paceMinPerKm = 60 / speed;
    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Calculate average speed
   */
  const calculateAverageSpeed = useCallback((): number => {
    if (elapsedTime === 0) return 0;
    return (totalDistance / elapsedTime) * 3600; // Convert to km/h
  }, [totalDistance, elapsedTime]);

  /**
   * Calculate calories burned
   * Uses MET (Metabolic Equivalent of Task) values
   */
  const calculateCalories = useCallback((): number => {
    if (elapsedTime === 0) return 0;
    
    const hours = elapsedTime / 3600;
    let met: number;

    if (activityType === 'walk') {
      // Walking MET values based on pace
      met = pace === 'slow' ? 3.0 : pace === 'moderate' ? 3.5 : 4.5;
    } else {
      // Running MET values based on pace
      met = pace === 'slow' ? 7.0 : pace === 'moderate' ? 9.0 : 11.0;
    }

    // Calories = MET × weight (kg) × time (hours)
    return Math.round(met * weight * hours);
  }, [elapsedTime, weight, activityType, pace]);

  /**
   * Update metrics in real-time
   */
  useEffect(() => {
    // Update current pace
    setCurrentPace(calculatePace(currentSpeed));

    // Update average speed
    setAverageSpeed(calculateAverageSpeed());

    // Update calories
    setCalories(calculateCalories());

    // Update estimated end time (placeholder for now)
    setEstimatedEndTime('En cours');
  }, [totalDistance, currentSpeed, elapsedTime, calculatePace, calculateAverageSpeed, calculateCalories]);

  return {
    currentPace,
    averageSpeed,
    calories,
    estimatedEndTime
  };
};
