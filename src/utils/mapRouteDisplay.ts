import mapboxgl from 'mapbox-gl';
import { RouteGeoJSON, Coordinates } from '@/types/route';

export interface RouteDisplayConfig {
  outboundColor: string;
  returnColor: string;
  outboundWidth: number;
  returnWidth: number;
  returnDashArray?: number[];
}

export const DEFAULT_ROUTE_CONFIG: RouteDisplayConfig = {
  outboundColor: '#10b981', // Green
  returnColor: '#3b82f6',   // Blue
  outboundWidth: 4,
  returnWidth: 4,
  returnDashArray: [2, 2],
};

export const clearMapRoutes = (map: mapboxgl.Map) => {
  const routeLayers = ['outbound-route', 'return-route', 'route'];
  const routeSources = ['outbound-route', 'return-route', 'route'];

  routeLayers.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
  });

  routeSources.forEach(sourceId => {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  });
};

export const addRouteMarkers = (
  map: mapboxgl.Map,
  userLocation: Coordinates,
  destinationCoords: [number, number]
) => {
  // Remove existing markers
  const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
  existingMarkers.forEach(marker => marker.remove());

  // Add user marker (green)
  new mapboxgl.Marker({ color: '#10b981' })
    .setLngLat([userLocation.lng, userLocation.lat])
    .addTo(map);

  // Add destination marker (red)
  new mapboxgl.Marker({ color: '#ef4444' })
    .setLngLat(destinationCoords)
    .addTo(map);
};

export const addRoundTripRoute = (
  map: mapboxgl.Map,
  routeGeoJSON: RouteGeoJSON,
  config: RouteDisplayConfig = DEFAULT_ROUTE_CONFIG
) => {
  if (!routeGeoJSON.outboundCoordinates || !routeGeoJSON.returnCoordinates) {
    throw new Error('Routes aller et retour manquantes');
  }

  // Add outbound route
  map.addSource('outbound-route', {
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

  map.addLayer({
    id: 'outbound-route',
    type: 'line',
    source: 'outbound-route',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': config.outboundColor,
      'line-width': config.outboundWidth
    }
  });

  // Add return route
  map.addSource('return-route', {
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

  const returnLayerPaint: any = {
    'line-color': config.returnColor,
    'line-width': config.returnWidth
  };

  if (config.returnDashArray) {
    returnLayerPaint['line-dasharray'] = config.returnDashArray;
  }

  map.addLayer({
    id: 'return-route',
    type: 'line',
    source: 'return-route',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: returnLayerPaint
  });
};

export const addOneWayRoute = (
  map: mapboxgl.Map,
  routeCoordinates: [number, number][],
  config: Partial<RouteDisplayConfig> = {}
) => {
  const finalConfig = { ...DEFAULT_ROUTE_CONFIG, ...config };

  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routeCoordinates
      }
    }
  });

  map.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': finalConfig.outboundColor,
      'line-width': finalConfig.outboundWidth
    }
  });
};

export const fitMapToRoute = (
  map: mapboxgl.Map,
  coordinates: [number, number][],
  userLocation?: Coordinates,
  destinationCoords?: [number, number],
  padding = 80,
  maxZoom = 15
) => {
  if (coordinates.length === 0) return;

  const bounds = new mapboxgl.LngLatBounds();
  
  // Add route coordinates
  coordinates.forEach(coord => bounds.extend(coord));
  
  // Add user location if provided
  if (userLocation) {
    bounds.extend([userLocation.lng, userLocation.lat]);
  }
  
  // Add destination if provided
  if (destinationCoords) {
    bounds.extend(destinationCoords);
  }

  map.fitBounds(bounds, { 
    padding,
    maxZoom
  });
};