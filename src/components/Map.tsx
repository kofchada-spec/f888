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
  };
}

const Map = ({ userLocation, destinations, selectedDestination, onDestinationSelect, planningData }: MapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  // Get Mapbox token from edge function
  useEffect(() => {
    const getMapboxToken = async () => {
      try {
        const response = await fetch('/api/mapbox-token');
        if (response.ok) {
          const data = await response.json();
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        // Fallback: use a placeholder token for development
        setMapboxToken('pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw');
      }
    };
    getMapboxToken();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !userLocation || !mapboxToken) return;

    // Initialize map
    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      zoom: 14,
      center: [userLocation.lng, userLocation.lat],
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

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

    new mapboxgl.Marker(userLocationEl)
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add destination markers
    destinations.forEach((destination, index) => {
      // Calculate destination position (simulate different locations around user)
      const angle = (index * 120) * (Math.PI / 180); // 120 degrees apart
      const distance = 0.01; // Approximate distance in degrees
      const destLng = userLocation.lng + Math.cos(angle) * distance;
      const destLat = userLocation.lat + Math.sin(angle) * distance;

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

      // Add route line
      if (map.current?.isStyleLoaded()) {
        addRouteLine(destination.id, userLocation, { lat: destLat, lng: destLng }, isRoundTrip, isSelected);
      } else {
        map.current?.on('style.load', () => {
          addRouteLine(destination.id, userLocation, { lat: destLat, lng: destLng }, isRoundTrip, isSelected);
        });
      }
    });

    // Cleanup
    return () => {
      markers.current.forEach(marker => marker.remove());
      map.current?.remove();
    };
  }, [userLocation, destinations, selectedDestination, planningData, mapboxToken]);

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

  if (!mapboxToken) {
    return (
      <div className="relative h-80 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-80 rounded-2xl overflow-hidden shadow-lg">
      <div ref={mapContainer} className="absolute inset-1 rounded-lg" />
      
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