import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlanningData, RouteData } from '@/types/route';
import { initializeMap, getMapboxToken } from '@/utils/mapboxHelpers';
import { useMapClickLimiter } from '@/hooks/useMapClickLimiter';
import { useRouteGeneration } from '@/hooks/useRouteGeneration';
import { useMapState } from '@/hooks/useMapState';
import { useMapRoutes } from '@/hooks/useMapRoutes';
import { calculateDistance, calculateTargetDistance, getToleranceRange, calculateRouteMetrics } from '@/utils/routeCalculations';

interface EnhancedMapProps {
  className?: string;
  planningData?: PlanningData;
  onRouteCalculated?: (routeData: RouteData) => void;
  onMapClick?: (coordinates: { lat: number; lng: number }) => void;
  canClick?: boolean;
  forceReset?: boolean;
  onResetComplete?: () => void;
}

const EnhancedMap: React.FC<EnhancedMapProps> = ({
  className = '',
  planningData,
  onRouteCalculated,
  onMapClick,
  canClick = true,
  forceReset = false,
  onResetComplete,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  
  const { canClick: canClickFromLimiter } = useMapClickLimiter();
  const { 
    generateRoundTripRoute, 
    generateOneWayRoute,
    isCalculating,
    routeError,
    setRouteError 
  } = useRouteGeneration(planningData, null, onRouteCalculated);
  
  const {
    state,
    setUserLocation,
    setCurrentRoute,
    setCalculating,
    setMapReady,
    setManualSelectionActive,
    resetState
  } = useMapState();
  
  const { displayRoute, clearRoutes } = useMapRoutes(map);

  // Initialize map and get token
  useEffect(() => {
    const initializeMapAndToken = async () => {
      console.log('🚀 Initialisation de la carte...');
      
      try {
        const token = await getMapboxToken();
        if (!token || !mapContainer.current) {
          console.error('❌ Token Mapbox ou conteneur manquant');
          return;
        }

        const mapInstance = initializeMap(
          mapContainer.current,
          token,
          state.userLocation ? [state.userLocation.lng, state.userLocation.lat] : undefined
        );

        map.current = mapInstance;

        mapInstance.on('style.load', () => {
          console.log('🗺️ Style de carte chargé');
          setMapReady(true);
        });

      } catch (error) {
        console.error('❌ Erreur initialisation carte:', error);
      }
    };

    if (!map.current) {
      initializeMapAndToken();
    }
  }, [state.userLocation, setMapReady]);

  // Get user location
  useEffect(() => {
    console.log('🌍 Demande de géolocalisation...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          console.log('✅ Position géolocalisée obtenue:', newLocation);
          setUserLocation(newLocation);
        },
        (error) => {
          console.warn('⚠️ Erreur géolocalisation:', error.message);
          console.log('Please enable location services for accurate routes');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    } else {
      console.log('❌ Geolocation not supported by this browser');
    }
  }, [setUserLocation]);

  // Auto-generate route when everything is ready
  useEffect(() => {
    const autoGenerateRoute = async () => {
      if (!state.mapReady || !state.userLocation || !planningData || state.currentRoute) {
        return;
      }

      console.log('🎯 Génération automatique d\'itinéraire...');
      setCalculating(true);

      try {
        let routeData: RouteData | null = null;

        if (planningData.tripType === 'round-trip') {
          routeData = await generateRoundTripRoute();
        } else {
          routeData = await generateOneWayRoute();
        }

        if (routeData) {
          setCurrentRoute(routeData);
          await displayRoute(routeData, state.userLocation, planningData.tripType);
          onRouteCalculated?.(routeData);
        }
      } catch (error) {
        console.error('❌ Erreur génération automatique:', error);
        setRouteError(error instanceof Error ? error.message : 'Erreur inconnue');
      } finally {
        setCalculating(false);
      }
    };

    autoGenerateRoute();
  }, [
    state.mapReady,
    state.userLocation,
    planningData,
    state.currentRoute,
    generateRoundTripRoute,
    generateOneWayRoute,
    displayRoute,
    onRouteCalculated,
    setCurrentRoute,
    setCalculating,
    setRouteError
  ]);

  // Handle reset
  useEffect(() => {
    if (forceReset) {
      console.log('🔄 Réinitialisation de la carte...');
      clearRoutes();
      resetState();
      onResetComplete?.();
    }
  }, [forceReset, clearRoutes, resetState, onResetComplete]);

  // Handle manual selection via map clicks
  useEffect(() => {
    if (!map.current || !state.mapReady || !state.userLocation || !planningData) {
      return;
    }

    const handleClick = async (e: mapboxgl.MapMouseEvent) => {
      if (state.isCalculating || !state.currentRoute || !canClick || !canClickFromLimiter) return;

      console.log('👆 Clic manuel sur la carte');
      setManualSelectionActive(true);
      onMapClick?.(e.lngLat);

      const clickedCoords = e.lngLat;
      const targetDistance = calculateTargetDistance(planningData.steps, planningData.height);
      const { min, max } = getToleranceRange(targetDistance);

      // Calculate distance to clicked point
      const oneWayDistance = calculateDistance(
        state.userLocation!.lat, state.userLocation!.lng,
        clickedCoords.lat, clickedCoords.lng
      );
      const totalDistance = planningData.tripType === 'round-trip' ? oneWayDistance * 2 : oneWayDistance;

      // Check if within tolerance
      if (totalDistance >= min && totalDistance <= max) {
        console.log('✅ Destination valide sélectionnée');
        
        // Create new route data
        const metrics = calculateRouteMetrics(totalDistance, planningData);
        const newRouteData: RouteData = {
          distance: totalDistance,
          duration: metrics.durationMin,
          calories: metrics.calories,
          steps: metrics.steps,
          startCoordinates: state.userLocation!,
          endCoordinates: { lat: clickedCoords.lat, lng: clickedCoords.lng },
        };

        // Add route geometry for round-trip
        if (planningData.tripType === 'round-trip') {
          newRouteData.routeGeoJSON = {
            outboundCoordinates: [
              [state.userLocation!.lng, state.userLocation!.lat],
              [clickedCoords.lng, clickedCoords.lat]
            ],
            returnCoordinates: [
              [clickedCoords.lng, clickedCoords.lat],
              [state.userLocation!.lng, state.userLocation!.lat]
            ],
            samePathReturn: true
          };
        }

        setCurrentRoute(newRouteData);
        await displayRoute(newRouteData, state.userLocation!, planningData.tripType);
        onRouteCalculated?.(newRouteData);
        
      } else {
        const diff = Math.abs(totalDistance - targetDistance);
        const message = `Destination trop ${totalDistance > targetDistance ? 'éloignée' : 'proche'} (${totalDistance.toFixed(1)}km vs ${targetDistance.toFixed(1)}km ciblé)`;
        console.warn('⚠️', message);
        setRouteError(message);
        setTimeout(() => setRouteError(null), 4000);
      }
    };

    map.current.on('click', handleClick);

    return () => {
      map.current?.off('click', handleClick);
    };
  }, [
    map.current,
    state.mapReady,
    state.userLocation,
    state.isCalculating,
    state.currentRoute,
    planningData,
    displayRoute,
    onMapClick,
    onRouteCalculated,
    setCurrentRoute,
    setManualSelectionActive,
    setRouteError
  ]);

  // Restore original route function
  const restoreOriginalRoute = async () => {
    if (!state.userLocation || !planningData) return;

    console.log('🔄 Restauration de l\'itinéraire original...');
    setManualSelectionActive(false);
    setCalculating(true);

    try {
      let routeData: RouteData | null = null;

      if (planningData.tripType === 'round-trip') {
        routeData = await generateRoundTripRoute();
      } else {
        routeData = await generateOneWayRoute();
      }

      if (routeData) {
        setCurrentRoute(routeData);
        await displayRoute(routeData, state.userLocation, planningData.tripType);
        onRouteCalculated?.(routeData);
      }
    } catch (error) {
      console.error('❌ Erreur restauration:', error);
      setRouteError('Erreur lors de la restauration');
    } finally {
      setCalculating(false);
    }
  };

  // Loading state
  if (!state.mapReady && !state.userLocation) {
    return (
      <div style={{ height: '400px' }} className={`relative bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center ${className}`}>
        <div className="text-center max-w-md p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground mb-2">Initialisation de la carte...</p>
          <p className="text-xs text-muted-foreground">Configuration en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ height: '400px' }}>
      <div 
        ref={mapContainer} 
        style={{ width: '100%', height: '100%' }}
        className="absolute inset-0 rounded-lg" 
      />
      
      {/* Loading overlay - waiting for location */}
      {!state.userLocation && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
          <div className="bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-pulse rounded-full h-5 w-5 bg-primary/50"></div>
              <span className="text-sm font-medium">Localisation en cours...</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">Veuillez autoriser l'accès à votre position</p>
          </div>
        </div>
      )}
      
      {/* Loading overlay - route calculation */}
      {state.userLocation && state.isCalculating && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
          <div className="bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              <span className="text-sm font-medium">Génération de l'itinéraire...</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {state.routeError && (
        <div className="absolute top-4 left-4 right-4 bg-destructive/90 text-destructive-foreground p-3 rounded-lg shadow-lg z-20">
          <p className="text-sm font-medium text-center">{state.routeError}</p>
        </div>
      )}

      {/* Restore button */}
      {state.manualSelectionActive && state.currentRoute && (
        <button
          onClick={restoreOriginalRoute}
          className="absolute bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg hover:bg-primary/90 transition-colors z-10"
        >
          Restaurer l'itinéraire automatique
        </button>
      )}

      {/* Instructions */}
      {planningData && !state.routeError && !state.isCalculating && state.currentRoute && state.mapReady && (
        <div className="absolute bottom-4 left-4 right-20 bg-card/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
          <p className="text-sm text-center text-muted-foreground">
            {planningData.tripType === 'round-trip' 
              ? "Cliquez sur la carte pour personnaliser votre destination aller-retour" 
              : "Cliquez sur la carte pour choisir une nouvelle destination"}
          </p>
        </div>
      )}
    </div>
  );
};

export default EnhancedMap;