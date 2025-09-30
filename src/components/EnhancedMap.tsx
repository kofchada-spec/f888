import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlanningData, RouteData } from '@/types/route';
import { initializeMap, getMapboxToken } from '@/utils/mapboxHelpers';

interface EnhancedMapProps {
  planningData?: PlanningData;
  onRouteCalculated?: (route: RouteData) => void;
  manualSelectionEnabled?: boolean;
}

const EnhancedMap: React.FC<EnhancedMapProps> = ({ 
  planningData, 
  onRouteCalculated,
  manualSelectionEnabled = true
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const setupMap = async () => {
      try {
        const token = await getMapboxToken();
        if (!token) {
          console.error('Failed to get Mapbox token');
          return;
        }

        map.current = initializeMap(mapContainer.current!, token);
        
        map.current.on('load', () => {
          setMapReady(true);
          getUserLocation();
        });
      } catch (error) {
        console.error('Error setting up map:', error);
      }
    };

    setupMap();

    return () => {
      if (userMarker.current) {
        userMarker.current.remove();
      }
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  const getUserLocation = () => {
    if (!map.current) return;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          setUserLocation({ lat: latitude, lng: longitude });
          
          if (map.current) {
            map.current.flyTo({
              center: [longitude, latitude],
              zoom: 14,
              essential: true
            });

            if (userMarker.current) {
              userMarker.current.remove();
            }

            userMarker.current = new mapboxgl.Marker({ color: '#3B82F6' })
              .setLngLat([longitude, latitude])
              .addTo(map.current);
          }
        },
        (error) => {
          console.error('Error getting user location:', error);
          setLocationError('Impossible de vous géolocaliser. Veuillez autoriser l\'accès à votre position.');
        }
      );
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      {locationError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg z-10">
          {locationError}
        </div>
      )}
    </div>
  );
};

export default EnhancedMap;
