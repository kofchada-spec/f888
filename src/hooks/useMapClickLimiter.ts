import { useState, useCallback } from 'react';

export const useMapClickLimiter = (maxAttempts: number = 3) => {
  const [attemptCount, setAttemptCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [hasReset, setHasReset] = useState(false);

  const canClick = attemptCount < maxAttempts && !isLocked && !hasReset;

  const incrementAttempts = useCallback(() => {
    if (attemptCount < maxAttempts && !hasReset) {
      const newCount = attemptCount + 1;
      setAttemptCount(newCount);
      
      if (newCount >= maxAttempts) {
        setIsLocked(true);
      }
    }
  }, [attemptCount, maxAttempts, hasReset]);

  const reset = useCallback(() => {
    setAttemptCount(0);
    setIsLocked(false);
    setHasReset(true); // After reset, no more clicks allowed
  }, []);

  return {
    attemptCount,
    canClick,
    isLocked,
    hasReset,
    incrementAttempts,
    reset,
    remainingAttempts: Math.max(0, maxAttempts - attemptCount)
  };
};