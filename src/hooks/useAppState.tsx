import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

interface AppState {
  currentPage: string;
  pageState: any;
  isTracking: boolean;
  activityType: 'walk' | 'run' | null;
  timestamp: number;
}

const APP_STATE_KEY = 'fitpas_app_state';

/**
 * Hook pour gérer l'état global de l'application
 * Sauvegarde et restaure l'état de navigation
 */
export const useAppState = () => {
  const [appState, setAppState] = useState<AppState>({
    currentPage: 'dashboard',
    pageState: null,
    isTracking: false,
    activityType: null,
    timestamp: Date.now()
  });

  // Sauvegarder l'état dans localStorage
  const saveAppState = useCallback((newState: Partial<AppState>) => {
    const updatedState = {
      ...appState,
      ...newState,
      timestamp: Date.now()
    };
    
    setAppState(updatedState);
    
    if (Capacitor.isNativePlatform()) {
      localStorage.setItem(APP_STATE_KEY, JSON.stringify(updatedState));
      console.log('💾 État de l\'app sauvegardé:', updatedState);
    }
  }, [appState]);

  // Restaurer l'état depuis localStorage
  const restoreAppState = useCallback(() => {
    if (!Capacitor.isNativePlatform()) return null;

    try {
      const savedState = localStorage.getItem(APP_STATE_KEY);
      if (savedState) {
        const parsedState: AppState = JSON.parse(savedState);
        
        // Vérifier que l'état n'est pas trop ancien (10 minutes max)
        if (Date.now() - parsedState.timestamp < 600000) {
          console.log('♻️ État de l\'app restauré:', parsedState);
          setAppState(parsedState);
          return parsedState;
        } else {
          localStorage.removeItem(APP_STATE_KEY);
          console.log('🗑️ État de l\'app expiré, supprimé');
        }
      }
    } catch (error) {
      console.error('Erreur lors de la restauration de l\'état de l\'app:', error);
      localStorage.removeItem(APP_STATE_KEY);
    }
    
    return null;
  }, []);

  // Nettoyer l'état
  const clearAppState = useCallback(() => {
    setAppState({
      currentPage: 'dashboard',
      pageState: null,
      isTracking: false,
      activityType: null,
      timestamp: Date.now()
    });
    
    if (Capacitor.isNativePlatform()) {
      localStorage.removeItem(APP_STATE_KEY);
      console.log('🗑️ État de l\'app nettoyé');
    }
  }, []);

  // Restaurer l'état au montage
  useEffect(() => {
    restoreAppState();
  }, [restoreAppState]);

  return {
    appState,
    saveAppState,
    restoreAppState,
    clearAppState
  };
};
