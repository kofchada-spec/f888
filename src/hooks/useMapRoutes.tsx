import { useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { RouteGeoJSON, Coordinates, RouteData } from '@/types/route';
import { 
  clearMapRoutes, 
  addRouteMarkers, 
  addRoundTripRoute, 
  addOneWayRoute, 
  fitMapToRoute 
} from '@/utils/mapRouteDisplay';

export const useMapRoutes = (map: React.MutableRefObject<mapboxgl.Map | null>) => {

  const waitForMapReady = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (!map.current) {
        resolve();
        return;
      }

      if (map.current.isStyleLoaded()) {
        resolve();
      } else {
        map.current.once('style.load', () => resolve());
      }
    });
  }, [map]);

  const clearRoutes = useCallback(() => {
    if (!map.current) return;
    
    console.log('🧹 Nettoyage des itinéraires existants');
    clearMapRoutes(map.current);
    
    // Remove markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());
  }, [map]);

  const displayRoundTripRoute = useCallback(async (
    routeData: RouteData,
    userLocation: Coordinates
  ) => {
    if (!map.current || !routeData.routeGeoJSON) {
      console.error('❌ Carte ou données d\'itinéraire manquantes');
      return;
    }

    console.log('🗺️ Affichage itinéraire aller-retour');
    
    try {
      await waitForMapReady();
      
      clearRoutes();
      
      const destinationCoords: [number, number] = [
        routeData.endCoordinates.lng,
        routeData.endCoordinates.lat
      ];
      
      // Add markers
      addRouteMarkers(map.current, userLocation, destinationCoords);
      
      // Add round-trip route
      addRoundTripRoute(map.current, routeData.routeGeoJSON);
      
      // Fit map to route
      const allCoordinates = [
        ...(routeData.routeGeoJSON.outboundCoordinates || []),
        ...(routeData.routeGeoJSON.returnCoordinates || [])
      ];
      
      fitMapToRoute(
        map.current,
        allCoordinates,
        userLocation,
        destinationCoords
      );
      
      console.log('✅ Itinéraire aller-retour affiché avec succès');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage de l\'itinéraire aller-retour:', error);
      throw error;
    }
  }, [map, waitForMapReady, clearRoutes]);

  const displayOneWayRoute = useCallback(async (
    routeData: RouteData,
    userLocation: Coordinates
  ) => {
    if (!map.current) {
      console.error('❌ Carte non disponible');
      return;
    }

    console.log('🗺️ Affichage itinéraire aller simple');
    
    try {
      await waitForMapReady();
      
      clearRoutes();
      
      const destinationCoords: [number, number] = [
        routeData.endCoordinates.lng,
        routeData.endCoordinates.lat
      ];
      
      // Add markers
      addRouteMarkers(map.current, userLocation, destinationCoords);
      
      // Determine route coordinates
      let routeCoordinates: [number, number][];
      
      if (routeData.routeGeoJSON?.outboundCoordinates) {
        routeCoordinates = routeData.routeGeoJSON.outboundCoordinates;
        console.log('✅ Utilisation de la géométrie Mapbox réelle');
      } else {
        // Fallback to straight line
        routeCoordinates = [
          [userLocation.lng, userLocation.lat],
          destinationCoords
        ];
        console.log('⚠️ Utilisation d\'une ligne droite de substitution');
      }
      
      // Add one-way route
      addOneWayRoute(map.current, routeCoordinates);
      
      // Fit map to route
      fitMapToRoute(
        map.current,
        routeCoordinates,
        userLocation,
        destinationCoords
      );
      
      console.log('✅ Itinéraire aller simple affiché avec succès');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage de l\'itinéraire aller simple:', error);
      throw error;
    }
  }, [map, waitForMapReady, clearRoutes]);

  const displayRoute = useCallback(async (
    routeData: RouteData,
    userLocation: Coordinates,
    tripType: 'one-way' | 'round-trip'
  ) => {
    console.log(`🎯 Affichage itinéraire ${tripType}`);
    
    if (tripType === 'round-trip') {
      await displayRoundTripRoute(routeData, userLocation);
    } else {
      await displayOneWayRoute(routeData, userLocation);
    }
  }, [displayRoundTripRoute, displayOneWayRoute]);

  return {
    displayRoute,
    displayRoundTripRoute,
    displayOneWayRoute,
    clearRoutes,
    waitForMapReady,
  };
};