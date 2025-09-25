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

  return {
    attemptCount,
    canClick,
    isLocked,
    incrementAttempts,
    reset,
    remainingAttempts: Math.max(0, maxAttempts - attemptCount)
  };
};