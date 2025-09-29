import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlanningData, RouteData, Coordinates } from '@/types/route';
import { getMapboxToken } from '@/utils/mapboxHelpers';
import { calculateTargetDistance } from '@/utils/routeCalculations';

interface EnhancedMapProps {
  planningData: PlanningData;
  onRouteCalculated: (route: RouteData) => void;
  canClick: boolean;
  onMapClick: () => void;
  forceReset?: boolean;
  onResetComplete?: () => void;
}

const EnhancedMap: React.FC<EnhancedMapProps> = ({
  planningData,
  onRouteCalculated,
  canClick,
  onMapClick,
  forceReset,
  onResetComplete
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialiser la carte et obtenir la position utilisateur
  useEffect(() => {
    if (!mapContainer.current) return;

    const initMap = async () => {
      try {
        // Récupérer le token Mapbox
        const token = await getMapboxToken();
        if (!token) {
          console.error('Mapbox token non disponible');
          return;
        }

        // Obtenir la position utilisateur
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords: Coordinates = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setUserLocation(coords);

            // Initialiser la carte
            mapboxgl.accessToken = token;
            map.current = new mapboxgl.Map({
              container: mapContainer.current!,
              style: 'mapbox://styles/mapbox/streets-v12',
              center: [coords.lng, coords.lat],
              zoom: 13
            });

            // Ajouter un marker pour la position utilisateur
            new mapboxgl.Marker({ color: '#3b82f6' })
              .setLngLat([coords.lng, coords.lat])
              .addTo(map.current);

            setIsLoading(false);
          },
          (error) => {
            console.error('Erreur géolocalisation:', error);
            // Position par défaut (Toulouse)
            const defaultCoords: Coordinates = { lat: 43.6047, lng: 1.4442 };
            setUserLocation(defaultCoords);

            mapboxgl.accessToken = token;
            map.current = new mapboxgl.Map({
              container: mapContainer.current!,
              style: 'mapbox://styles/mapbox/streets-v12',
              center: [defaultCoords.lng, defaultCoords.lat],
              zoom: 13
            });

            new mapboxgl.Marker({ color: '#3b82f6' })
              .setLngLat([defaultCoords.lng, defaultCoords.lat])
              .addTo(map.current);

            setIsLoading(false);
          }
        );
      } catch (error) {
        console.error('Erreur initialisation carte:', error);
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      map.current?.remove();
    };
  }, []);

  // Gérer le clic sur la carte pour calculer l'itinéraire
  useEffect(() => {
    if (!map.current || !userLocation) return;

    const handleMapClick = async (e: mapboxgl.MapMouseEvent) => {
      if (!canClick) return;
      
      onMapClick();
      
      const destination: Coordinates = {
        lat: e.lngLat.lat,
        lng: e.lngLat.lng
      };

      try {
        const token = await getMapboxToken();
        if (!token) return;

        // Appel API Mapbox pour calculer l'itinéraire
        const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${userLocation.lng},${userLocation.lat};${destination.lng},${destination.lat}?geometries=geojson&access_token=${token}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distanceKm = route.distance / 1000;
          const durationMin = Math.round(route.duration / 60);

          // Calcul calories
          const pace = planningData.pace;
          const met = pace === 'slow' ? 3.0 : pace === 'moderate' ? 4.0 : 5.0;
          const speed = pace === 'slow' ? 4 : pace === 'moderate' ? 5 : 6;
          const timeHours = distanceKm / speed;
          const calories = Math.round(met * planningData.weight * timeHours);

          // Calcul pas
          const strideLength = 0.415 * planningData.height;
          const steps = Math.round((distanceKm * 1000) / strideLength);

          // Afficher l'itinéraire sur la carte
          if (map.current?.getSource('route')) {
            (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
              type: 'Feature',
              properties: {},
              geometry: route.geometry
            });
          } else {
            map.current?.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: route.geometry
              }
            });

            map.current?.addLayer({
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
          }

          // Ajouter marker destination
          new mapboxgl.Marker({ color: '#ef4444' })
            .setLngLat([destination.lng, destination.lat])
            .addTo(map.current!);

          // Notifier le parent
          onRouteCalculated({
            distance: distanceKm,
            duration: durationMin,
            calories,
            steps,
            startCoordinates: userLocation,
            endCoordinates: destination,
            routeGeoJSON: {
              outboundCoordinates: route.geometry.coordinates
            }
          });
        }
      } catch (error) {
        console.error('Erreur calcul itinéraire:', error);
      }
    };

    map.current.on('click', handleMapClick);

    return () => {
      map.current?.off('click', handleMapClick);
    };
  }, [map.current, userLocation, canClick, planningData, onMapClick, onRouteCalculated]);

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden shadow-lg">
      <div ref={mapContainer} className="w-full h-full" />
      
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement de la carte...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedMap;
