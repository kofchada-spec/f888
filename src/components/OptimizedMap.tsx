import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Skeleton } from '@/components/ui/skeleton';
import { useMapPerformance } from '@/hooks/useMapPerformance';

interface Destination {
  id: string;
  name: string;
  distance: string;
  duration: string;
  calories: number;
  description: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  route?: any;
}

interface MapProps {
  userLocation: { lat: number; lng: number };
  destinations: Destination[];
  selectedDestination?: string;
  onDestinationSelect?: (destinationId: string) => void;
  planningData: {
    tripType: 'one-way' | 'round-trip';
    steps: string;
    pace: 'slow' | 'moderate' | 'fast';
    height: string;
    weight: string;
  };
}

interface MapRef {
  fitToRoute: () => void;
}

const OptimizedMap = React.forwardRef<MapRef, MapProps>(({
  userLocation,
  destinations,
  selectedDestination,
  onDestinationSelect,
  planningData
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const lastDestinationKey = useRef<string>('');
  const isInitializedRef = useRef(false);
  const routeUpdateBatchRef = useRef<{[key: string]: any[]}>({});

  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);

  const { startTimer, logPerformanceSummary } = useMapPerformance();

  // Expose map methods via ref
  React.useImperativeHandle(ref, () => ({
    fitToRoute: () => {
      if (map.current && userLocation && destinations.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend([userLocation.lng, userLocation.lat]);
        
        if (destinations[0]?.coordinates) {
          bounds.extend([destinations[0].coordinates.lng, destinations[0].coordinates.lat]);
        }
        
        map.current.fitBounds(bounds, { padding: 50 });
      }
    }
  }));

  // Get Mapbox token with performance tracking
  useEffect(() => {
    const getMapboxToken = async () => {
      const endTimer = startTimer('geocode');
      
      try {
        console.log('🔑 Fetching Mapbox token...');
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('mapbox-token');
        
        if (error) throw error;
        if (data?.token && typeof data.token === 'string' && data.token.startsWith('pk.')) {
          setMapboxToken(data.token);
          console.log('✅ Mapbox token loaded');
        } else {
          throw new Error('Invalid token received');
        }
      } catch (error) {
        console.error('❌ Error fetching Mapbox token:', error);
      } finally {
        endTimer();
      }
    };
    getMapboxToken();
  }, [startTimer]);

  // Fast map initialization with skeleton UI
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || isInitializedRef.current) return;

    console.log('🗺️ Initializing optimized map...');
    const endTilesTimer = startTimer('tilesFirstRender');

    // Set camera position instantly - no waiting for network
    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [userLocation.lng, userLocation.lat],
      zoom: 14,
      antialias: true,
      attributionControl: false
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({ 
        visualizePitch: true,
        showZoom: true,
        showCompass: true
      }),
      'top-right'
    );

    // Add geolocate control for re-centering
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showAccuracyCircle: true
      }),
      'top-right'
    );

    // Performance tracking for tiles
    map.current.on('styledata', () => {
      if (map.current?.isStyleLoaded() && !tilesLoaded) {
        setTilesLoaded(true);
        endTilesTimer();
        console.log('🎨 Map tiles loaded');
      }
    });

    map.current.on('load', () => {
      setIsMapLoaded(true);
      console.log('🗺️ Map fully loaded');
    });

    // Handle map errors
    map.current.on('error', (e) => {
      console.error('Map error:', e.error);
    });

    // Setup POI click handling
    map.current.on('click', (e) => {
      if (onDestinationSelect) {
        console.log('📍 Map clicked at:', e.lngLat);
        // Could implement click-to-destination selection here
      }
    });

    isInitializedRef.current = true;

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [mapboxToken, userLocation.lng, userLocation.lat, startTimer, onDestinationSelect, tilesLoaded]);

  // Update user location marker only (lightweight)
  useEffect(() => {
    if (!map.current || !userLocation) return;

    // Update camera smoothly without jarring movements
    if (map.current.getZoom() < 10) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        duration: 1000
      });
    }
  }, [userLocation]);

  // Optimized destination and route rendering - prevent flicker
  useEffect(() => {
    if (!map.current || !userLocation || destinations.length === 0) return;

    // Only update if destinations array actually changed, not user location updates
    const destinationKey = destinations.map(d => `${d.id}-${d.name}-${!!d.route}`).join('|');
    
    if (lastDestinationKey.current === destinationKey) {
      console.log('📍 Destinations unchanged, keeping stable routes');
      return; // Skip re-render if destinations haven't actually changed
    }
    
    lastDestinationKey.current = destinationKey;
    console.log('🎯 Rendering routes for destinations:', destinationKey);

    const endRouteTimer = startTimer('routeRender');

    // Clear existing markers only when destinations actually change
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Remove existing routes
    if (map.current.getSource('route-outbound')) {
      map.current.removeLayer('route-outbound');
      map.current.removeSource('route-outbound');
    }
    if (map.current.getSource('route-return')) {
      map.current.removeLayer('route-return');
      map.current.removeSource('route-return');
    }

    // Add user location marker
    const userMarkerEl = document.createElement('div');
    userMarkerEl.className = 'w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg';
    userMarkerEl.innerHTML = '<div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>';

    const userMarker = new mapboxgl.Marker(userMarkerEl)
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);

    markers.current.push(userMarker);

    // Add destinations with batch processing
    const isRoundTrip = planningData.tripType === 'round-trip';

    destinations.forEach((destination, index) => {
      console.log(`🎯 Adding destination ${index + 1}:`, {
        id: destination.id,
        name: destination.name,
        coordinates: destination.coordinates,
        hasRoute: !!destination.route
      });

      const isSelected = destination.id === selectedDestination;
      let destLng = userLocation.lng + 0.01;
      let destLat = userLocation.lat + 0.01;

      // Use real coordinates if available
      if (destination.coordinates && destination.coordinates.lat && destination.coordinates.lng) {
        destLng = destination.coordinates.lng;
        destLat = destination.coordinates.lat;
        console.log(`🎯 Using real coordinates for ${destination.name}:`, { lat: destLat, lng: destLng });
      } else {
        // Fallback to calculated positions around user location
        const angle = (index * 120) * (Math.PI / 180);
        const distance = 0.01; // ~1km in degrees
        destLng = userLocation.lng + Math.cos(angle) * distance;
        destLat = userLocation.lat + Math.sin(angle) * distance;
        console.log(`🎯 Using calculated coordinates for ${destination.name}:`, { lat: destLat, lng: destLng });
      }

      const markerEl = document.createElement('div');
      markerEl.className = 'cursor-pointer transform transition-transform hover:scale-110';
      
      const markerColor = isSelected ? 'bg-red-500' : 'bg-green-500';
      const markerSize = isSelected ? 'w-6 h-6' : 'w-5 h-5';

      markerEl.innerHTML = `
        <div class="${markerSize} ${markerColor} border-2 border-white rounded-full shadow-lg flex items-center justify-center">
          <div class="text-white text-xs font-bold">${index + 1}</div>
        </div>
      `;

      // Add click handler
      markerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onDestinationSelect) {
          console.log(`🎯 Selected destination: ${destination.name}`);
          onDestinationSelect(destination.id);
        }
      });

      const marker = new mapboxgl.Marker(markerEl, { anchor: 'center' })
        .setLngLat([destLng, destLat])
        .addTo(map.current!);

      // Add popup with destination info
      const popup = new mapboxgl.Popup({ 
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '300px'
      }).setHTML(`
        <div class="p-2">
          <h3 class="font-semibold text-sm mb-1">${destination.name}</h3>
          <p class="text-xs text-gray-600 mb-2">${destination.description || 'Walking destination'}</p>
          <div class="flex justify-between text-xs">
            <span>🚶 ${destination.distance}</span>
            <span>⏱️ ${destination.duration}</span>
            <span>🔥 ${destination.calories} cal</span>
          </div>
        </div>
      `);

      marker.setPopup(popup);
      markers.current.push(marker);

      // Add route immediately - stable rendering
      if (map.current?.isStyleLoaded()) {
        if (destination.route) {
          console.log('🛣️ Rendering preconfigured route');
          addRouteFromGeometry(destination.id, destination.route, isSelected);
        } else {
          addRouteLine(destination.id, userLocation, { lat: destLat, lng: destLng }, isRoundTrip, isSelected);
        }
      } else {
        map.current?.on('styledata', () => {
          if (map.current?.isStyleLoaded()) {
            if (destination.route) {
              console.log('🛣️ Rendering preconfigured route (delayed)');
              addRouteFromGeometry(destination.id, destination.route, isSelected);
            } else {
              addRouteLine(destination.id, userLocation, { lat: destLat, lng: destLng }, isRoundTrip, isSelected);
            }
          }
        });
      }
    });

    endRouteTimer();
    logPerformanceSummary();
  }, [destinations, selectedDestination, userLocation, planningData.tripType, startTimer, logPerformanceSummary, onDestinationSelect]);

  // Add route from geometry data (for preconfigured routes)
  const addRouteFromGeometry = useCallback((destinationId: string, routeData: any, isSelected: boolean) => {
    if (!map.current || !routeData) return;

    try {
      const outboundGeometry = routeData.outbound || routeData.geometry || routeData;
      const returnGeometry = routeData.return;
      
      // Define consistent colors
      const outboundStyle = {
        color: '#22c55e', // green-500  
        width: isSelected ? 4 : 3,
        opacity: isSelected ? 0.9 : 0.7
      };

      const returnStyle = {
        color: '#3b82f6', // blue-500
        width: isSelected ? 4 : 3,
        opacity: isSelected ? 0.9 : 0.7
      };

      // Add outbound route
      if (outboundGeometry && outboundGeometry.coordinates) {
        const outboundSourceId = `route-outbound-${destinationId}`;
        const outboundLayerId = `route-outbound-layer-${destinationId}`;

        if (!map.current.getSource(outboundSourceId)) {
          map.current.addSource(outboundSourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: outboundGeometry
            }
          });

          map.current.addLayer({
            id: outboundLayerId,
            type: 'line',
            source: outboundSourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': outboundStyle.color,
              'line-width': outboundStyle.width,
              'line-opacity': outboundStyle.opacity
            }
          });
        }
      }

      // Add return route for round trips
      if (returnGeometry && returnGeometry.coordinates) {
        const returnSourceId = `route-return-${destinationId}`;
        const returnLayerId = `route-return-layer-${destinationId}`;

        if (!map.current.getSource(returnSourceId)) {
          map.current.addSource(returnSourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: returnGeometry
            }
          });

          map.current.addLayer({
            id: returnLayerId,
            type: 'line',
            source: returnSourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': returnStyle.color,
              'line-width': returnStyle.width,
              'line-opacity': returnStyle.opacity,
              'line-dasharray': [5, 5] // Dashed for return route
            }
          });
        }
      }
    } catch (error) {
      console.error('❌ Error adding route geometry:', error);
    }
  }, []);

  // Add simple route line between points
  const addRouteLine = useCallback((
    destinationId: string,
    start: { lat: number; lng: number },
    end: { lat: number; lng: number },
    isRoundTrip: boolean,
    isSelected: boolean
  ) => {
    if (!map.current) return;

    const routeSourceId = `simple-route-${destinationId}`;
    const routeLayerId = `simple-route-layer-${destinationId}`;

    // Create simple straight line (fallback when no real route data)
    const routeGeoJSON = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [start.lng, start.lat],
          [end.lng, end.lat]
        ]
      }
    };

    if (!map.current.getSource(routeSourceId)) {
      map.current.addSource(routeSourceId, {
        type: 'geojson',
        data: routeGeoJSON
      });

      map.current.addLayer({
        id: routeLayerId,
        type: 'line',
        source: routeSourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': isRoundTrip ? '#22c55e' : '#3b82f6',
          'line-width': isSelected ? 4 : 3,
          'line-opacity': isSelected ? 0.9 : 0.7,
          'line-dasharray': isRoundTrip ? [5, 5] : [1]
        }
      });
    }
  }, []);

  // Show skeleton while loading
  if (!mapboxToken || !isMapLoaded) {
    return (
      <div className="relative w-full h-full rounded-lg overflow-hidden bg-muted">
        <Skeleton className="w-full h-full" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-background/90 rounded-lg p-4 shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-muted-foreground">Loading map...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state for invalid token
  if (mapboxToken && !mapboxToken.startsWith('pk.')) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg">
        <div className="text-center p-6">
          <p className="text-red-600 font-medium mb-2">Invalid Mapbox Token</p>
          <p className="text-sm text-muted-foreground">Please check your Mapbox configuration</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 rounded-lg shadow-lg" />
      
      {/* Route Legend */}
      <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <h3 className="font-semibold text-sm mb-2">Legend</h3>
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5 bg-blue-500"></div>
            <span>Départ</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5 bg-green-500"></div>
            <span>Route</span>
          </div>
          {planningData.tripType === 'round-trip' && (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-0.5 bg-blue-500 border-dashed" style={{borderTopStyle: 'dashed', borderTopWidth: '1px'}}></div>
              <span>Retour</span>
            </div>
          )}
        </div>
      </div>

      {/* Trip Info */}
      <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <div className="text-sm font-medium">
          {planningData.tripType === 'round-trip' ? 'Aller-retour' : 'Aller simple'}
        </div>
        <div className="text-xs text-muted-foreground">
          {planningData.steps} pas • {planningData.pace}
        </div>
      </div>

      {/* Performance indicator */}
      {!tilesLoaded && (
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span>Loading tiles...</span>
          </div>
        </div>
      )}
    </div>
  );
});

OptimizedMap.displayName = 'OptimizedMap';

export default OptimizedMap;
export type { MapRef };