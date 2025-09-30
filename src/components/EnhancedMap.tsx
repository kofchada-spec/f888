import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlanningData, RouteData, Coordinates } from '@/types/route';
import { initializeMap, getMapboxToken } from '@/utils/mapboxHelpers';
import { useOneWayRouteGeneration } from '@/hooks/useOneWayRouteGeneration';
import { useRoundTripRouteGeneration } from '@/hooks/useRoundTripRouteGeneration';

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
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentRoute, setCurrentRoute] = useState<RouteData | null>(null);

  const handleRouteCalculated = (route: RouteData) => {
    setCurrentRoute(route);
    if (onRouteCalculated) {
      onRouteCalculated(route);
    }
    displayRouteOnMap(route);
  };

  const oneWayHook = useOneWayRouteGeneration(planningData, userLocation, handleRouteCalculated);
  const roundTripHook = useRoundTripRouteGeneration(planningData, userLocation, handleRouteCalculated);

  const routeHook = planningData?.tripType === 'one-way' ? oneWayHook : roundTripHook;
  const { isCalculating, routeError } = routeHook;

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
      if (destinationMarker.current) {
        destinationMarker.current.remove();
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

  const clearRoute = () => {
    if (!map.current) return;

    if (map.current.getSource('route-outbound')) {
      map.current.removeLayer('route-outbound-layer');
      map.current.removeSource('route-outbound');
    }

    if (map.current.getSource('route-return')) {
      map.current.removeLayer('route-return-layer');
      map.current.removeSource('route-return');
    }

    if (destinationMarker.current) {
      destinationMarker.current.remove();
    }
  };

  const displayRouteOnMap = (route: RouteData) => {
    if (!map.current || !route.routeGeoJSON) return;

    clearRoute();

    const { outboundCoordinates, returnCoordinates } = route.routeGeoJSON;

    if (outboundCoordinates) {
      map.current.addSource('route-outbound', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: outboundCoordinates
          }
        }
      });

      map.current.addLayer({
        id: 'route-outbound-layer',
        type: 'line',
        source: 'route-outbound',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4
        }
      });
    }

    if (returnCoordinates && planningData?.tripType === 'round-trip') {
      map.current.addSource('route-return', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: returnCoordinates
          }
        }
      });

      map.current.addLayer({
        id: 'route-return-layer',
        type: 'line',
        source: 'route-return',
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

    destinationMarker.current = new mapboxgl.Marker({ color: '#EF4444' })
      .setLngLat([route.endCoordinates.lng, route.endCoordinates.lat])
      .addTo(map.current);

    const coordinates = outboundCoordinates || [];
    if (coordinates.length > 0) {
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord as [number, number]);
      }, new mapboxgl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]));

      map.current.fitBounds(bounds, {
        padding: 80,
        maxZoom: 15
      });
    }
  };

  useEffect(() => {
    if (mapReady && userLocation && planningData && !currentRoute && !isCalculating) {
      if (planningData.tripType === 'one-way') {
        oneWayHook.generateOneWayRoute();
      } else if (planningData.tripType === 'round-trip') {
        roundTripHook.generateRoundTripRoute();
      }
    }
  }, [mapReady, userLocation, planningData, currentRoute, isCalculating]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      {locationError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg z-10">
          {locationError}
        </div>
      )}
      {routeError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg z-10">
          {routeError}
        </div>
      )}
      {isCalculating && (
        <div className="absolute top-4 right-4 bg-background/90 text-foreground px-4 py-2 rounded-lg shadow-lg z-10">
          Calcul de l'itinéraire...
        </div>
      )}
    </div>
  );
};

export default EnhancedMap;
