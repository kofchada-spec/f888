import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface TrackingState {
  isTracking: boolean;
  startTime: string | null;
  elapsedTime: number;
  totalDistance: number;
  currentSteps: number;
  // Ajouter l'état de la page
  currentPage?: string;
  pageState?: any;
  timestamp: number;
}

interface UseAppLifecycleProps {
  isTracking: boolean;
  startTime: Date | null;
  elapsedTime: number;
  totalDistance: number;
  currentSteps: number;
  activityType: 'walk' | 'run';
  currentPage?: string;
  pageState?: any;
  onRestore: (state: TrackingState) => void;
}

/**
 * Hook pour gérer le cycle de vie de l'app (background/foreground)
 * Sauvegarde et restaure l'état du tracking automatiquement
 */
export const useAppLifecycle = ({
  isTracking,
  startTime,
  elapsedTime,
  totalDistance,
  currentSteps,
  activityType,
  currentPage,
  pageState,
  onRestore
}: UseAppLifecycleProps) => {
  const storageKey = `tracking_state_${activityType}`;

  // Sauvegarder l'état dans le localStorage à chaque changement
  useEffect(() => {
    if (isTracking && startTime) {
      const state: TrackingState = {
        isTracking,
        startTime: startTime.toISOString(),
        elapsedTime,
        totalDistance,
        currentSteps,
        currentPage,
        pageState,
        timestamp: Date.now()
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
      console.log('💾 État du tracking et de la page sauvegardé:', state);
    } else if (!isTracking) {
      // Nettoyer le state quand le tracking s'arrête
      localStorage.removeItem(storageKey);
      console.log('🗑️ État du tracking supprimé');
    }
  }, [isTracking, startTime, elapsedTime, totalDistance, currentSteps, currentPage, pageState, storageKey]);

  // Gérer les événements de cycle de vie de l'app (uniquement sur mobile)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('🌐 Mode web - pas de gestion du cycle de vie');
      return;
    }

    const handleAppStateChange = (state: { isActive: boolean }) => {
      console.log('📱 État de l\'app:', state.isActive ? 'foreground' : 'background');
      
      if (state.isActive) {
        // L'app revient au foreground - restaurer l'état si nécessaire
        const savedState = localStorage.getItem(storageKey);
        if (savedState) {
          try {
            const parsedState: TrackingState = JSON.parse(savedState);
            console.log('♻️ Restauration de l\'état du tracking:', parsedState);
            onRestore(parsedState);
          } catch (error) {
            console.error('Erreur lors de la restauration:', error);
            // Nettoyer l'état corrompu
            localStorage.removeItem(storageKey);
          }
        }
      } else {
        // L'app passe en background - sauvegarder l'état immédiatement si tracking actif
        if (isTracking && startTime) {
          const currentState: TrackingState = {
            isTracking,
            startTime: startTime.toISOString(),
            elapsedTime,
            totalDistance,
            currentSteps,
            currentPage,
            pageState,
            timestamp: Date.now()
          };
          localStorage.setItem(storageKey, JSON.stringify(currentState));
          console.log('💾 État complet sauvegardé avant background:', currentState);
        }
      }
    };

    // S'abonner aux changements d'état
    const listener = App.addListener('appStateChange', handleAppStateChange);

    // Nettoyer l'écouteur lors du démontage
    return () => {
      listener.then(l => l.remove());
    };
  }, [storageKey, onRestore, isTracking, startTime, elapsedTime, totalDistance, currentSteps, currentPage, pageState]);

  // Restaurer l'état au montage du composant (si l'app a été tuée et relancée)
  useEffect(() => {
    const savedState = localStorage.getItem(storageKey);
    if (savedState && !isTracking) {
      try {
        const state: TrackingState = JSON.parse(savedState);
        // Ne restaurer que si le tracking était actif
        if (state.isTracking) {
          console.log('🔄 Restauration au démarrage:', state);
          onRestore(state);
        }
      } catch (error) {
        console.error('Erreur lors de la restauration au démarrage:', error);
      }
    }
  }, []); // Uniquement au montage
};
