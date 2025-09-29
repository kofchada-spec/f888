import { useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { Coordinates, RouteData } from '@/types/route';

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
    
    // Remove route layers
    ['route-outbound-layer', 'route-return-layer'].forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId);
      }
    });
    
    // Remove route sources
    ['route-outbound-src', 'route-return-src'].forEach(sourceId => {
      if (map.current!.getSource(sourceId)) {
        map.current!.removeSource(sourceId);
      }
    });
    
    // Remove markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());
  }, [map]);

  const addRouteMarkers = useCallback((userLocation: Coordinates, destinationCoords: [number, number]) => {
    if (!map.current) return;

    // User location marker (blue)
    const userMarker = new mapboxgl.Marker({ color: '#3b82f6' })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);

    // Destination marker (red)
    const destMarker = new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat(destinationCoords)
      .addTo(map.current);
  }, [map]);

  const displayRoute = useCallback(async (
    routeData: RouteData,
    userLocation: Coordinates,
    tripType: 'one-way' | 'round-trip'
  ) => {
    if (!map.current || !routeData.routeGeoJSON) {
      console.error('❌ Carte ou données d\'itinéraire manquantes');
      return;
    }

    console.log(`🗺️ Affichage itinéraire ${tripType}`);
    
    try {
      await waitForMapReady();
      clearRoutes();
      
      const destinationCoords: [number, number] = [
        routeData.endCoordinates.lng,
        routeData.endCoordinates.lat
      ];
      
      // Add markers
      addRouteMarkers(userLocation, destinationCoords);
      
      // Add outbound route (green)
      if (routeData.routeGeoJSON.outboundCoordinates) {
        map.current.addSource('route-outbound-src', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeData.routeGeoJSON.outboundCoordinates
            }
          }
        });

        map.current.addLayer({
          id: 'route-outbound-layer',
          type: 'line',
          source: 'route-outbound-src',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#22c55e',
            'line-width': 4
          }
        });
      }
      
      // Add return route for round-trip (blue dashed)
      if (tripType === 'round-trip' && routeData.routeGeoJSON.returnCoordinates) {
        map.current.addSource('route-return-src', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeData.routeGeoJSON.returnCoordinates
            }
          }
        });

        map.current.addLayer({
          id: 'route-return-layer',
          type: 'line',
          source: 'route-return-src',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 4,
            'line-dasharray': [2, 2]
          }
        });
      }
      
      // Fit map to route
      const allCoordinates = [
        ...(routeData.routeGeoJSON.outboundCoordinates || []),
        ...(routeData.routeGeoJSON.returnCoordinates || [])
      ];
      
      if (allCoordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        allCoordinates.forEach(coord => bounds.extend(coord as [number, number]));
        bounds.extend([userLocation.lng, userLocation.lat]);
        bounds.extend(destinationCoords);
        
        map.current.fitBounds(bounds, {
          padding: 80,
          maxZoom: 15
        });
      }
      
      console.log(`✅ Itinéraire ${tripType} affiché avec succès`);
      
    } catch (error) {
      console.error(`❌ Erreur lors de l'affichage de l'itinéraire ${tripType}:`, error);
      throw error;
    }
  }, [map, waitForMapReady, clearRoutes, addRouteMarkers]);

  return {
    displayRoute,
    clearRoutes,
    waitForMapReady,
  };
};