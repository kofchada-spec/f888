import { useState, useCallback } from 'react';
import { Coordinates, RouteData } from '@/types/route';

export interface MapState {
  userLocation: Coordinates | null;
  currentRoute: RouteData | null;
  isCalculating: boolean;
  routeError: string | null;
  mapReady: boolean;
  manualSelectionActive: boolean;
}

export const useMapState = () => {
  const [state, setState] = useState<MapState>({
    userLocation: null,
    currentRoute: null,
    isCalculating: false,
    routeError: null,
    mapReady: false,
    manualSelectionActive: false,
  });

  const updateState = useCallback((updates: Partial<MapState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const setUserLocation = useCallback((location: Coordinates) => {
    console.log('📍 Position utilisateur mise à jour:', location);
    updateState({ userLocation: location });
  }, [updateState]);

  const setCurrentRoute = useCallback((route: RouteData | null) => {
    console.log('🛣️ Itinéraire mis à jour:', route ? 'Nouveau itinéraire' : 'Itinéraire supprimé');
    updateState({ currentRoute: route });
  }, [updateState]);

  const setCalculating = useCallback((calculating: boolean) => {
    console.log('⏳ Calcul d\'itinéraire:', calculating ? 'En cours...' : 'Terminé');
    updateState({ isCalculating: calculating });
  }, [updateState]);

  const setRouteError = useCallback((error: string | null) => {
    if (error) {
      console.error('❌ Erreur itinéraire:', error);
    }
    updateState({ routeError: error });
  }, [updateState]);

  const setMapReady = useCallback((ready: boolean) => {
    console.log('🗺️ État carte:', ready ? 'Prête' : 'En attente');
    updateState({ mapReady: ready });
  }, [updateState]);

  const setManualSelectionActive = useCallback((active: boolean) => {
    console.log('👆 Sélection manuelle:', active ? 'Activée' : 'Désactivée');
    updateState({ manualSelectionActive: active });
  }, [updateState]);

  const resetState = useCallback(() => {
    console.log('🔄 Réinitialisation de l\'état de la carte');
    setState({
      userLocation: null,
      currentRoute: null,
      isCalculating: false,
      routeError: null,
      mapReady: false,
      manualSelectionActive: false,
    });
  }, []);

  return {
    state,
    setUserLocation,
    setCurrentRoute,
    setCalculating,
    setRouteError,
    setMapReady,
    setManualSelectionActive,
    resetState,
    updateState,
  };
};