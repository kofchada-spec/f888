import { useEffect, useState, useRef } from 'react';
import { Motion } from '@capacitor/motion';
import { Capacitor } from '@capacitor/core';

interface UseStepDetectionProps {
  isTracking: boolean;
  activityType: 'walk' | 'run';
}

interface StepPattern {
  timestamp: number;
  magnitude: number;
}

/**
 * Advanced step detection hook with filtering and pattern analysis
 * Prevents false positives from micro-movements and device vibrations
 */
export const useStepDetection = ({ isTracking, activityType }: UseStepDetectionProps) => {
  const [currentSteps, setCurrentSteps] = useState(0);
  const [isMovementDetected, setIsMovementDetected] = useState(false);
  
  const motionListenerId = useRef<(() => void) | null>(null);
  const stepPatternBuffer = useRef<StepPattern[]>([]);
  const lastStepTime = useRef<number>(0);
  const movementTimeout = useRef<NodeJS.Timeout | null>(null);

  // Activity-specific thresholds
  const THRESHOLDS = {
    walk: {
      minMagnitude: 3.5,      // Increased from 1.2 to 3.5 (more strict)
      stepMagnitude: 4.5,     // Increased from 2.5 to 4.5 (clear step peak)
      minStepInterval: 300,   // Minimum 300ms between steps (max 200 steps/min)
      maxStepInterval: 2000,  // Maximum 2s between steps (min 30 steps/min)
      patternWindow: 5000     // Analyze last 5 seconds
    },
    run: {
      minMagnitude: 4.5,      // Increased from 2.0 to 4.5
      stepMagnitude: 6.0,     // Increased from 3.5 to 6.0 (running has stronger impact)
      minStepInterval: 200,   // Minimum 200ms between steps (max 300 steps/min)
      maxStepInterval: 1500,  // Maximum 1.5s between steps (min 40 steps/min)
      patternWindow: 4000     // Analyze last 4 seconds
    }
  };

  const config = THRESHOLDS[activityType];

  /**
   * Analyze movement pattern to detect regular walking/running rhythm
   */
  const isRegularPattern = (): boolean => {
    const now = Date.now();
    const recentSteps = stepPatternBuffer.current.filter(
      step => now - step.timestamp < config.patternWindow
    );

    if (recentSteps.length < 3) return false;

    // Calculate intervals between steps
    const intervals: number[] = [];
    for (let i = 1; i < recentSteps.length; i++) {
      intervals.push(recentSteps[i].timestamp - recentSteps[i - 1].timestamp);
    }

    // Check if intervals are consistent (regular rhythm)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - avgInterval, 2);
    }, 0) / intervals.length;
    const standardDeviation = Math.sqrt(variance);

    // Pattern is regular if standard deviation is less than 40% of average
    return standardDeviation < avgInterval * 0.4;
  };

  /**
   * Reset movement detection after timeout
   */
  const scheduleMovementReset = () => {
    if (movementTimeout.current) {
      clearTimeout(movementTimeout.current);
    }
    
    movementTimeout.current = setTimeout(() => {
      setIsMovementDetected(false);
      console.log('💤 No movement detected for a while');
    }, config.maxStepInterval);
  };

  /**
   * Process acceleration data and detect steps
   */
  const processAcceleration = (event: any) => {
    const now = Date.now();
    
    // Calculate acceleration magnitude
    const magnitude = Math.sqrt(
      event.acceleration.x ** 2 + 
      event.acceleration.y ** 2 + 
      event.acceleration.z ** 2
    );

    // Basic movement detection (threshold crossing)
    if (magnitude > config.minMagnitude) {
      setIsMovementDetected(true);
      scheduleMovementReset();
      
      // Step detection with peak analysis
      if (magnitude > config.stepMagnitude) {
        const timeSinceLastStep = now - lastStepTime.current;
        
        // Ensure minimum interval between steps (debounce)
        if (timeSinceLastStep >= config.minStepInterval) {
          
          // Add to pattern buffer
          stepPatternBuffer.current.push({ timestamp: now, magnitude });
          
          // Keep only recent patterns
          stepPatternBuffer.current = stepPatternBuffer.current.filter(
            step => now - step.timestamp < config.patternWindow
          );
          
          // Only count step if pattern is regular OR we're just starting
          const shouldCountStep = stepPatternBuffer.current.length < 3 || isRegularPattern();
          
          if (shouldCountStep) {
            setCurrentSteps(prev => prev + 1);
            lastStepTime.current = now;
            console.log(`✅ Step detected: ${magnitude.toFixed(2)} m/s² (Total: ${currentSteps + 1})`);
          } else {
            console.log(`❌ Irregular pattern rejected: ${magnitude.toFixed(2)} m/s²`);
          }
        } else {
          console.log(`⏱️ Step too soon, ignored: ${timeSinceLastStep}ms`);
        }
      }
    }
  };

  /**
   * Initialize motion detection
   */
  useEffect(() => {
    const startMotionDetection = async () => {
      if (!isTracking) return;

      // Only works on native platforms
      if (Capacitor.isNativePlatform()) {
        try {
          console.log(`🎯 Starting ${activityType} step detection (enhanced)`);
          
          const listenerId = await Motion.addListener('accel', processAcceleration);
          motionListenerId.current = listenerId.remove;
          
          console.log('✅ Motion sensor active');
        } catch (error) {
          console.error('❌ Motion detection failed:', error);
          console.log('ℹ️ Step detection not available in web browser');
        }
      } else {
        console.log('ℹ️ Motion sensors only work in native app (not in web browser)');
      }
    };

    startMotionDetection();

    return () => {
      if (motionListenerId.current) {
        motionListenerId.current();
        motionListenerId.current = null;
      }
      if (movementTimeout.current) {
        clearTimeout(movementTimeout.current);
      }
    };
  }, [isTracking, activityType]);

  /**
   * Reset step detection
   */
  const resetStepDetection = () => {
    setCurrentSteps(0);
    setIsMovementDetected(false);
    stepPatternBuffer.current = [];
    lastStepTime.current = 0;
    
    if (movementTimeout.current) {
      clearTimeout(movementTimeout.current);
    }
  };

  return {
    currentSteps,
    isMovementDetected,
    resetStepDetection
  };
};

