import { useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { RouteGeoJSON, Coordinates } from '@/types/route';

export const useMapDisplay = (map: React.MutableRefObject<mapboxgl.Map | null>) => {

  /**
   * Clear all existing routes and markers from the map
   */
  const clearMap = useCallback(() => {
    if (!map.current) return;

    // Remove all route layers and sources
    const routeLayers = ['outbound-route', 'return-route', 'route'];
    const routeSources = ['outbound-route', 'return-route', 'route'];

    routeLayers.forEach(layerId => {
      if (map.current?.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
    });

    routeSources.forEach(sourceId => {
      if (map.current?.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
    });
  }, [map]);

  /**
   * Add markers to the map
   */
  const addMarkers = useCallback((
    userLocation: Coordinates,
    destinationCoords: [number, number]
  ) => {
    if (!map.current) return { userMarker: null, destinationMarker: null };

    // Add user marker (green)
    const userMarker = new mapboxgl.Marker({ color: '#10b981' })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);

    // Add destination marker (red)
    const destinationMarker = new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat(destinationCoords)
      .addTo(map.current);

    return { userMarker, destinationMarker };
  }, [map]);

  /**
   * Display round-trip route on the map
   */
  const displayRoundTripRoute = useCallback((
    destinationCoords: [number, number],
    routeGeoJSON: RouteGeoJSON,
    userLocation: Coordinates
  ) => {
    if (!map.current || !map.current.isStyleLoaded()) {
      console.log('⏳ Map style not loaded, waiting...');
      if (map.current) {
        map.current.once('styledata', () => {
          if (map.current?.isStyleLoaded()) {
            displayRoundTripRoute(destinationCoords, routeGeoJSON, userLocation);
          }
        });
      }
      return;
    }

    if (!routeGeoJSON.outboundCoordinates || !routeGeoJSON.returnCoordinates) {
      console.error('Missing route coordinates');
      return;
    }

    console.log('🗺️ Displaying round-trip route');

    // Clear existing routes
    clearMap();

    // Add markers
    addMarkers(userLocation, destinationCoords);

    // Add outbound route (solid green)
    map.current.addSource('outbound-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeGeoJSON.outboundCoordinates
        }
      }
    });

    map.current.addLayer({
      id: 'outbound-route',
      type: 'line',
      source: 'outbound-route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#10b981', // Green
        'line-width': 4
      }
    });

    // Add return route (dashed blue)
    map.current.addSource('return-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeGeoJSON.returnCoordinates
        }
      }
    });

    map.current.addLayer({
      id: 'return-route',
      type: 'line',
      source: 'return-route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3b82f6', // Blue
        'line-width': 4,
        'line-dasharray': [2, 2]
      }
    });

    // Fit map to both routes
    const allCoordinates = [...routeGeoJSON.outboundCoordinates, ...routeGeoJSON.returnCoordinates];
    const bounds = allCoordinates.reduce((bounds: any, coord: any) => {
      return bounds.extend(coord);
    }, new mapboxgl.LngLatBounds(allCoordinates[0], allCoordinates[0]));
    
    map.current.fitBounds(bounds, { padding: 50 });

    console.log('✅ Round-trip route displayed successfully');
  }, [map, clearMap, addMarkers]);

  /**
   * Display one-way route on the map
   */
  const displayOneWayRoute = useCallback((
    startCoords: Coordinates,
    endCoords: Coordinates
  ) => {
    if (!map.current || !map.current.isStyleLoaded()) {
      console.log('⏳ Map style not loaded for one-way route');
      return;
    }

    console.log('🗺️ Displaying one-way route');

    // Clear existing routes
    clearMap();

    // Add markers
    addMarkers(startCoords, [endCoords.lng, endCoords.lat]);

    // Add simple route line
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [
            [startCoords.lng, startCoords.lat],
            [endCoords.lng, endCoords.lat]
          ]
        }
      }
    });

    map.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#10b981',
        'line-width': 4
      }
    });

    // Fit map to route
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([startCoords.lng, startCoords.lat]);
    bounds.extend([endCoords.lng, endCoords.lat]);
    map.current.fitBounds(bounds, { padding: 50 });

    console.log('✅ One-way route displayed successfully');
  }, [map, clearMap, addMarkers]);

  return {
    displayRoundTripRoute,
    displayOneWayRoute,
    clearMap,
    addMarkers
  };
};