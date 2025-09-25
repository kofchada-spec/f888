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

  // UNIQUEMENT les clics utilisateur sur la carte comptent, et seulement s'ils réussissent
  const handleMapClick = useCallback(async (lngLat: {lng:number; lat:number}) => {
    if (isLocked) {
      console.log('Click ignored: map is locked');
      return;
    }

    // Anti double-tap strict (600ms)
    if (debounceRef.current) {
      console.log('Click ignored: debounce active');
      return;
    }
    
    debounceRef.current = window.setTimeout(() => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }, 600);

    console.log(`User click detected: processing attempt ${clickCount + 1}/${maxValidClicks}`);

    try {
      // 1) Traiter le clic (calcul / tracé) - ATTENDRE le résultat
      await onValidClick(lngLat);
      
      // 2) SEULEMENT si le traitement a réussi, incrémenter le compteur
      const next = clickCount + 1;
      console.log(`User click processed successfully: ${next}/${maxValidClicks}`);
      
      setClickCount(next);
      if (next >= maxValidClicks) {
        setIsLocked(true);
        console.log('Map locked after maximum successful clicks reached');
        onLock?.();
      }
    } catch (error) {
      console.log('Click processing failed, not counting as attempt:', error);
      // Ne pas incrémenter le compteur si le traitement échoue
    }
  }, [clickCount, isLocked, maxValidClicks, onValidClick, onLock]);

  // Reset ne consomme PAS d'essai et garde la carte bloquée
  const reset = useCallback(() => {
    console.log('Reset triggered - restoring default route');
    if (resetMode === 'LOCK_AND_START_DEFAULT') {
      onResetStartDefault();          // réaffiche le trajet par défaut
      setIsLocked(true);              // on reste verrouillé après reset
      setClickCount(maxValidClicks);  // compteur reste figé à 3/3
    }
  }, [maxValidClicks, onResetStartDefault, resetMode]);

  return { clickCount, isLocked, handleMapClick, reset };
}