import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlanningData, RouteData, Coordinates } from '@/types/route';
import { getMapboxToken, initializeMap } from '@/utils/mapboxHelpers';
import { useMapState } from '@/hooks/useMapState';
import { useOneWayRouteGeneration } from '@/hooks/useOneWayRouteGeneration';
import { useRoundTripRouteGeneration } from '@/hooks/useRoundTripRouteGeneration';
import { useMapRoutes } from '@/hooks/useMapRoutes';

interface EnhancedMapProps {
  planningData: PlanningData;
  onRouteCalculated: (route: RouteData) => void;
  manualSelectionEnabled?: boolean;
}

const EnhancedMap: React.FC<EnhancedMapProps> = ({ 
  planningData, 
  onRouteCalculated,
  manualSelectionEnabled = true
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  // State management
  const {
    state,
    setUserLocation,
    setCurrentRoute,
    setMapReady,
    setManualSelectionActive,
  } = useMapState();

  // Route generation hooks
  const oneWayGeneration = useOneWayRouteGeneration(
    planningData,
    state.userLocation,
    (route) => {
      setCurrentRoute(route);
      onRouteCalculated(route);
    }
  );

  const roundTripGeneration = useRoundTripRouteGeneration(
    planningData,
    state.userLocation,
    (route) => {
      setCurrentRoute(route);
      onRouteCalculated(route);
    }
  );

  // Route display hook
  const { displayRoute } = useMapRoutes(map);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const initMap = async () => {
      try {
        const token = await getMapboxToken();
        if (!token) {
          console.error('❌ Mapbox token non disponible');
          return;
        }

        map.current = initializeMap(mapContainer.current!, token);
        
        map.current.on('load', () => {
          console.log('✅ Carte chargée');
          setMapReady(true);
        });

      } catch (error) {
        console.error('❌ Erreur initialisation carte:', error);
      }
    };

    initMap();

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [setMapReady]);

  // Get user location
  useEffect(() => {
    if (!map.current || state.userLocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userCoords: Coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        
        setUserLocation(userCoords);
        
        // Center map on user
        map.current?.flyTo({
          center: [userCoords.lng, userCoords.lat],
          zoom: 14,
          duration: 1000,
        });
      },
      (error) => {
        console.error('❌ Erreur géolocalisation:', error);
      }
    );
  }, [state.userLocation, setUserLocation]);

  // Generate default route automatically
  useEffect(() => {
    if (!state.userLocation || !state.mapReady || state.currentRoute) return;

    console.log('🚀 Génération de l\'itinéraire par défaut');
    
    if (planningData.tripType === 'one-way') {
      oneWayGeneration.generateOneWayRoute();
    } else {
      roundTripGeneration.generateRoundTripRoute();
    }
  }, [state.userLocation, state.mapReady, state.currentRoute, planningData.tripType]);

  // Display route on map
  useEffect(() => {
    if (!state.currentRoute || !state.userLocation || !state.mapReady) return;

    displayRoute(state.currentRoute, state.userLocation, planningData.tripType);
  }, [state.currentRoute, state.userLocation, state.mapReady, planningData.tripType, displayRoute]);

  // Handle map clicks for manual destination selection
  useEffect(() => {
    if (!map.current || !manualSelectionEnabled) return;

    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      if (!state.userLocation) return;

      console.log('🎯 Clic sur la carte:', e.lngLat);
      setManualSelectionActive(true);

      // Generate new route to clicked location
      if (planningData.tripType === 'one-way') {
        oneWayGeneration.generateOneWayRoute();
      } else {
        roundTripGeneration.generateRoundTripRoute();
      }
    };

    map.current.on('click', handleMapClick);

    return () => {
      map.current?.off('click', handleMapClick);
    };
  }, [
    manualSelectionEnabled,
    state.userLocation,
    planningData.tripType,
    setManualSelectionActive,
    oneWayGeneration,
    roundTripGeneration,
  ]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {(oneWayGeneration.isCalculating || roundTripGeneration.isCalculating) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
          <p className="text-sm">Calcul de l'itinéraire...</p>
        </div>
      )}
      
      {(oneWayGeneration.routeError || roundTripGeneration.routeError) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-destructive/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg">
          <p className="text-sm text-destructive-foreground">
            {oneWayGeneration.routeError || roundTripGeneration.routeError}
          </p>
        </div>
      )}
    </div>
  );
};

export default EnhancedMap;


