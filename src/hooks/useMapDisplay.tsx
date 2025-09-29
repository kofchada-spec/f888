import { useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { RouteGeoJSON, Coordinates } from '@/types/route';
import { clearMapRoutes, addRouteMarkers } from '@/utils/mapRouteDisplay';

export const useMapDisplay = (map: React.MutableRefObject<mapboxgl.Map | null>) => {

  /**
   * Clear all existing routes and markers from the map
   */
  const clearMap = useCallback(() => {
    if (!map.current) return;

    console.log('🧹 Nettoyage de la carte');
    clearMapRoutes(map.current);
    
    // Remove markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());
  }, [map]);

  /**
   * Add markers to the map
   */
  const addMarkers = useCallback((
    userLocation: Coordinates,
    destinationCoords: [number, number]
  ) => {
    if (!map.current) return;
    
    console.log('📍 Ajout des marqueurs');
    addRouteMarkers(map.current, userLocation, destinationCoords);
  }, [map]);

  /**
   * Display round-trip route on the map
   * @deprecated Use useMapRoutes hook instead
   */
  const displayRoundTripRoute = useCallback((
    destinationCoords: [number, number],
    routeGeoJSON: RouteGeoJSON,
    userLocation: Coordinates
  ) => {
    console.warn('⚠️ displayRoundTripRoute is deprecated, use useMapRoutes instead');
    // This method is kept for backward compatibility but should not be used
  }, []);

  /**
   * Display one-way route on the map
   * @deprecated Use useMapRoutes hook instead
   */
  const displayOneWayRoute = useCallback((
    startCoords: Coordinates,
    endCoords: Coordinates,
    routeGeoJSON?: any
  ) => {
    console.warn('⚠️ displayOneWayRoute is deprecated, use useMapRoutes instead');
    // This method is kept for backward compatibility but should not be used
  }, []);

  return {
    displayRoundTripRoute,
    displayOneWayRoute,
    clearMap,
    addMarkers
  };
};