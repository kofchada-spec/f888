import { useRef, useState, useCallback } from 'react';

type ResetMode = 'LOCK_AND_START_DEFAULT';

type LimiterOptions = {
  maxValidClicks: number;                             // ex: 3
  onValidClick: (lngLat: {lng:number; lat:number}) => Promise<void> | void;
  onLock?: () => void;                                // appelé au 3e clic
  onResetStartDefault: () => void;                    // relance trajet par défaut
  resetMode: ResetMode;                               // 'LOCK_AND_START_DEFAULT'
};

export function useMapClickLimiter(opts: LimiterOptions) {
  const { maxValidClicks, onValidClick, onLock, onResetStartDefault, resetMode } = opts;

  const [clickCount, setClickCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const handleMapClick = useCallback(async (lngLat: {lng:number; lat:number}) => {
    if (isLocked) return;

    // Anti double-tap (600ms)
    if (debounceRef.current) return;
    debounceRef.current = window.setTimeout(() => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }, 600);

    const next = clickCount + 1;

    // 1) Traiter le clic (calcul / tracé)
    await onValidClick(lngLat);

    // 2) Incrémenter + verrouiller au 3e
    setClickCount(next);
    if (next >= maxValidClicks) {
      setIsLocked(true);
      onLock?.();
    }
  }, [clickCount, isLocked, maxValidClicks, onValidClick, onLock]);

  const reset = useCallback(() => {
    if (resetMode === 'LOCK_AND_START_DEFAULT') {
      onResetStartDefault();          // réaffiche le trajet par défaut
      setIsLocked(true);              // on reste verrouillé
      setClickCount(maxValidClicks);  // figé à 3/3
    }
  }, [maxValidClicks, onResetStartDefault, resetMode]);

  return { clickCount, isLocked, handleMapClick, reset };
}