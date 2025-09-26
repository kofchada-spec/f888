import { useState, useCallback } from 'react';

export const useMapClickLimiter = (maxAttempts: number = 3) => {
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const canClick = attemptCount < maxAttempts && !isLocked;

  const incrementAttempts = useCallback(() => {
    if (attemptCount < maxAttempts) {
      const newCount = attemptCount + 1;
      setAttemptCount(newCount);
      
      if (newCount >= maxAttempts) {
        setIsLocked(true);
      }
    }
  }, [attemptCount, maxAttempts]);

  const reset = useCallback(() => {
    setAttemptCount(0);
    setIsLocked(false);
  }, []);

  const resetToDefault = useCallback(() => {
    // Ne remet PAS le compteur à zéro, garde le lock
    // Juste pour signaler qu'on veut revenir à l'itinéraire par défaut
  }, []);

  return {
    attemptCount,
    canClick,
    isLocked,
    incrementAttempts,
    reset,
    resetToDefault,
    remainingAttempts: Math.max(0, maxAttempts - attemptCount)
  };
};