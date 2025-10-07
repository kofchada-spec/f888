import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

interface UseTrackingFeedbackProps {
  currentProgress: number; // Percentage 0-100
  isTracking: boolean;
  currentPosition: { lat: number; lng: number } | null;
  destinationCoords: { lat: number; lng: number };
  totalDistance: number; // in km
}

/**
 * Hook for providing feedback during tracking
 * Handles milestone vibrations and alerts
 */
export const useTrackingFeedback = ({
  currentProgress,
  isTracking,
  currentPosition,
  destinationCoords,
  totalDistance
}: UseTrackingFeedbackProps) => {
  const milestonesReached = useRef<Set<number>>(new Set());
  const lastDistanceToDestination = useRef<number | null>(null);

  /**
   * Trigger vibration feedback
   */
  const triggerVibration = useCallback(async (style: ImpactStyle = ImpactStyle.Medium) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style });
      } catch (error) {
        console.log('Haptics not available:', error);
      }
    } else {
      // Web fallback
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
    }
  }, []);

  /**
   * Calculate distance to destination
   */
  const calculateDistanceToDestination = useCallback((
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  /**
   * Check and trigger milestone notifications
   */
  useEffect(() => {
    if (!isTracking) return;

    const milestones = [25, 50, 75, 100];
    
    milestones.forEach(milestone => {
      if (currentProgress >= milestone && !milestonesReached.current.has(milestone)) {
        milestonesReached.current.add(milestone);
        
        // Trigger vibration
        triggerVibration(milestone === 100 ? ImpactStyle.Heavy : ImpactStyle.Medium);
        
        // Show toast notification
        if (milestone === 100) {
          toast.success('🎉 Objectif atteint ! Félicitations !', {
            duration: 5000
          });
        } else {
          toast.info(`✨ ${milestone}% de votre objectif atteint !`, {
            duration: 3000
          });
        }
        
        console.log(`🎯 Milestone reached: ${milestone}%`);
      }
    });
  }, [currentProgress, isTracking, triggerVibration]);

  /**
   * Check if user is moving away from destination
   */
  useEffect(() => {
    if (!isTracking || !currentPosition) return;

    const distanceToDestination = calculateDistanceToDestination(
      currentPosition.lat,
      currentPosition.lng,
      destinationCoords.lat,
      destinationCoords.lng
    );

    // Check if user is moving away (distance increased by more than 50m)
    if (lastDistanceToDestination.current !== null) {
      const distanceChange = distanceToDestination - lastDistanceToDestination.current;
      
      if (distanceChange > 0.05 && totalDistance > 0.1) { // More than 50m away
        toast.warning('⚠️ Vous vous éloignez de votre destination', {
          duration: 4000
        });
        triggerVibration(ImpactStyle.Light);
      }
    }

    lastDistanceToDestination.current = distanceToDestination;
  }, [currentPosition, isTracking, destinationCoords, calculateDistanceToDestination, totalDistance, triggerVibration]);

  /**
   * Reset feedback state
   */
  const resetFeedback = useCallback(() => {
    milestonesReached.current.clear();
    lastDistanceToDestination.current = null;
  }, []);

  /**
   * Get remaining distance to destination
   */
  const getRemainingDistance = useCallback((): string => {
    if (!currentPosition) return '--';
    
    const distance = calculateDistanceToDestination(
      currentPosition.lat,
      currentPosition.lng,
      destinationCoords.lat,
      destinationCoords.lng
    );

    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  }, [currentPosition, destinationCoords, calculateDistanceToDestination]);

  return {
    triggerVibration,
    resetFeedback,
    getRemainingDistance
  };
};
