import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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
  userLocation: { lat: number; lng: number } | null;
  destinations: Destination[];
  selectedDestination: string | null;
  onDestinationSelect: (destination: Destination) => void;
  planningData: {
    tripType: 'one-way' | 'round-trip';
    steps: string;
    pace: 'slow' | 'moderate' | 'fast';
    height: string;
    weight: string;
  };
}

const Map = ({ userLocation, destinations, selectedDestination, onDestinationSelect, planningData }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  // Get Mapbox token from Supabase edge function (only once)
  useEffect(() => {
    const getMapboxToken = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('mapbox-token');
        
        if (error) {
          console.error('Error calling mapbox-token function:', error);
          throw error;
        }
        
        if (data?.token && typeof data.token === 'string' && data.token.startsWith('pk.')) {
          console.log('Valid Mapbox token received');
          setMapboxToken(data.token);
        } else {
          console.error('Invalid token received:', data);
          throw new Error('Invalid token received');
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        // Fallback: ask user to provide token directly in console for debugging
        console.log('Please check your MAPBOX_PUBLIC_TOKEN in Supabase secrets');
        setMapboxToken(null);
      }
    };
    getMapboxToken();
  }, []);

  // Initialize map once when token is available
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !mapboxToken.startsWith('pk.')) {
      console.log('Map initialization waiting for:', { 
        container: !!mapContainer.current, 
        token: !!mapboxToken,
        validToken: !!mapboxToken && mapboxToken.startsWith('pk.')
      });
      return;
    }

    // Prevent re-initialization if map already exists
    if (map.current) {
      console.log('Map already initialized, skipping');
      return;
    }

    console.log('Initializing map with token:', mapboxToken.substring(0, 20) + '...');
    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      zoom: 14,
      center: userLocation ? [userLocation.lng, userLocation.lat] : [2.3522, 48.8566], // Paris par défaut
    });

    // Add error handling
    map.current.on('error', (e) => {
      console.error('Mapbox error:', e.error);
      console.error('Error type:', e.error?.message);
      if (e.error?.message?.includes('401') || e.error?.message?.includes('403')) {
        console.error('Authentication error - check your Mapbox token');
      }
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Wait for map to load before adding POI interactions
    map.current.on('load', () => {
      // Resize map to ensure proper rendering
      setTimeout(() => {
        if (map.current) {
          map.current.resize();
        }
      }, 100);

      // Protéger les événements POI avec getLayer
      if (map.current?.getLayer('poi-label')) {
        map.current.on('click', 'poi-label', (e) => {
          const coordinates = e.lngLat;
          const properties = e.features![0].properties;
          
          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
              <div class="p-2">
                <h3 class="font-semibold">${properties.name || 'Point d\'intérêt'}</h3>
                <p class="text-sm text-gray-600">${properties.class || 'Lieu'}</p>
              </div>
            `)
            .addTo(map.current!);
        });

        map.current.on('mouseenter', 'poi-label', () => {
          map.current!.getCanvas().style.cursor = 'pointer';
        });

        map.current.on('mouseleave', 'poi-label', () => {
          map.current!.getCanvas().style.cursor = '';
        });
      }
    });

    // Cleanup
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  // Update camera when userLocation changes
  useEffect(() => {
    if (map.current && userLocation) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        speed: 1.2,
        curve: 1.42
      });
    }
  }, [userLocation]);

  // Update markers and routes when destinations or selection changes
  useEffect(() => {
    if (!map.current || !userLocation) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add user location marker
    const userLocationEl = document.createElement('div');
    userLocationEl.className = 'user-location-marker';
    userLocationEl.innerHTML = `
      <div style="
        width: 20px;
        height: 20px;
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        position: relative;
      ">
        <div style="
          position: absolute;
          top: -30px;
          left: 50%;
          transform: translateX(-50%);
          background: #3b82f6;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        ">
          📍 Départ
        </div>
      </div>
    `;

    const userMarker = new mapboxgl.Marker(userLocationEl)
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);
    
    markers.current.push(userMarker);

    // Add destination markers
    destinations.forEach((destination, index) => {
      let destLng, destLat;
      
      // Use real coordinates if available, otherwise calculate position
      if (destination.coordinates) {
        destLng = destination.coordinates.lng;
        destLat = destination.coordinates.lat;
      } else {
        // Fallback to calculated positions
        const angle = (index * 120) * (Math.PI / 180);
        const distance = 0.01;
        destLng = userLocation.lng + Math.cos(angle) * distance;
        destLat = userLocation.lat + Math.sin(angle) * distance;
      }

      const markerEl = document.createElement('div');
      markerEl.className = 'destination-marker';
      const isSelected = selectedDestination === destination.id;
      const isRoundTrip = planningData.tripType === 'round-trip';
      
      markerEl.innerHTML = `
        <div style="
          width: 40px;
          height: 40px;
          background: ${isSelected ? 'hsl(var(--primary))' : 'hsl(var(--secondary))'};
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          transition: all 0.3s ease;
          transform: ${isSelected ? 'scale(1.1)' : 'scale(1)'};
        ">
          ${destination.id}
        </div>
        <div style="
          position: absolute;
          top: 45px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          color: black;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          border: ${isSelected ? '2px solid hsl(var(--primary))' : '1px solid #e5e7eb'};
          opacity: ${isSelected ? '1' : '0.8'};
        ">
          ${destination.name}
        </div>
      `;

      markerEl.addEventListener('click', () => {
        onDestinationSelect(destination);
      });

      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat([destLng, destLat])
        .addTo(map.current!);

      markers.current.push(marker);

      // Add route line when map is ready
      if (map.current?.isStyleLoaded()) {
        if (destination.route) {
          addRouteFromGeometry(destination.id, destination.route, isSelected);
        } else {
          addRouteLine(destination.id, userLocation, { lat: destLat, lng: destLng }, isRoundTrip, isSelected);
        }
      } else {
        map.current?.on('styledata', () => {
          if (map.current?.isStyleLoaded()) {
            if (destination.route) {
              addRouteFromGeometry(destination.id, destination.route, isSelected);
            } else {
              addRouteLine(destination.id, userLocation, { lat: destLat, lng: destLng }, isRoundTrip, isSelected);
            }
          }
        });
      }
    });
  }, [destinations, selectedDestination, planningData, userLocation]);

  // IntersectionObserver to resize map when it becomes visible (must be before any returns)
  useEffect(() => {
    if (!mapContainer.current || !map.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && map.current) {
            setTimeout(() => {
              map.current?.resize();
            }, 100);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(mapContainer.current);

    return () => {
      observer.disconnect();
    };
  }, [map.current]);

  const addRouteFromGeometry = (
    destId: string,
    routeGeometry: any,
    isSelected: boolean
  ) => {
    if (!map.current) return;

    const sourceId = `route-${destId}`;
    const layerId = `route-layer-${destId}`;

    // Remove existing route if it exists
    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: routeGeometry
    });

    map.current.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': isSelected ? '#10b981' : '#6b7280',
        'line-width': isSelected ? 4 : 2,
        'line-opacity': isSelected ? 1 : 0.6
      }
    });
  };

  const addRouteLine = (
    destId: string, 
    start: { lat: number; lng: number }, 
    end: { lat: number; lng: number }, 
    isRoundTrip: boolean,
    isSelected: boolean
  ) => {
    if (!map.current) return;

    const sourceId = `route-${destId}`;
    const layerId = `route-layer-${destId}`;

    // Remove existing route if it exists
    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    let coordinates;
    if (isRoundTrip) {
      // Create a curved path that returns to start
      const midLng = (start.lng + end.lng) / 2;
      const midLat = (start.lat + end.lat) / 2;
      const offset = 0.005; // Create curve
      coordinates = [
        [start.lng, start.lat],
        [end.lng, end.lat],
        [midLng + offset, midLat + offset],
        [start.lng, start.lat]
      ];
    } else {
      // Simple straight line
      coordinates = [
        [start.lng, start.lat],
        [end.lng, end.lat]
      ];
    }

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates
        }
      }
    });

    map.current.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': isSelected ? '#10b981' : '#6b7280',
        'line-width': isSelected ? 4 : 2,
        'line-opacity': isSelected ? 1 : 0.6,
        'line-dasharray': [2, 2]
      }
    });
  };

  if (!mapboxToken || !mapboxToken.startsWith('pk.')) {
    return (
      <div style={{ height: '360px' }} className="relative bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground mb-2">
            {!mapboxToken ? 'Chargement du token Mapbox...' : 'Token Mapbox invalide'}
          </p>
          <p className="text-xs text-muted-foreground">
            Vérifiez que votre token Mapbox est configuré dans les secrets Supabase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '360px' }} className="relative rounded-2xl overflow-hidden shadow-lg">
      <div 
        ref={mapContainer} 
        style={{ width: '100%', height: '100%' }}
        className="absolute inset-0 rounded-lg" 
      />
      
      {/* Légende */}
      <div className="absolute top-4 left-4 bg-white/95 dark:bg-black/95 rounded-lg p-3 text-xs shadow-lg border">
        <div className="flex items-center space-x-2 mb-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full border border-white"></div>
          <span>{planningData.tripType === 'round-trip' ? 'Point de départ/arrivée' : 'Point de départ'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-500 rounded-full border border-white"></div>
          <span>{planningData.tripType === 'round-trip' ? 'Points de passage' : 'Destinations'}</span>
        </div>
      </div>

      {/* Info trajet */}
      <div className="absolute top-4 right-4 bg-primary/90 text-primary-foreground rounded-lg p-3 text-sm shadow-lg">
        <div className="font-semibold">
          {planningData.tripType === 'round-trip' ? '🔄 Aller-Retour' : '➡️ Aller Simple'}
        </div>
      </div>
    </div>
  );
};

export default Map;