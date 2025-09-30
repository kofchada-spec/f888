import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlanningData, RouteData, Coordinates } from '@/types/route';
import { initializeMap, getMapboxToken } from '@/utils/mapboxHelpers';
import { useOneWayRouteGeneration } from '@/hooks/useOneWayRouteGeneration';
import { useRoundTripRouteGeneration } from '@/hooks/useRoundTripRouteGeneration';
import { useMapClickLimiter } from '@/hooks/useMapClickLimiter';
import { calculateDistance, getToleranceRange, calculateTargetDistance, calculateRouteMetrics } from '@/utils/routeCalculations';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
  const [initialRoute, setInitialRoute] = useState<RouteData | null>(null);
  
  const { canClick, isLocked, incrementAttempts, remainingAttempts } = useMapClickLimiter(3);

  // Refs pour accéder aux valeurs actuelles dans les event listeners
  const userLocationRef = useRef<Coordinates | null>(null);
  const canClickRef = useRef(canClick);
  
  // Mettre à jour les refs quand les valeurs changent
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);
  
  useEffect(() => {
    canClickRef.current = canClick;
  }, [canClick]);

  const handleRouteCalculated = (route: RouteData, isInitial: boolean = false) => {
    setCurrentRoute(route);
    if (isInitial && !initialRoute) {
      setInitialRoute(route);
    }
    if (onRouteCalculated) {
      onRouteCalculated(route);
    }
    displayRouteOnMap(route);
  };

  const oneWayHook = useOneWayRouteGeneration(planningData, userLocation, (route) => handleRouteCalculated(route, true));
  const roundTripHook = useRoundTripRouteGeneration(planningData, userLocation, (route) => handleRouteCalculated(route, true));

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
          setupMapClickListener();
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

  const setupMapClickListener = () => {
    if (!map.current) return;

    map.current.on('click', async (e) => {
      // Utiliser les refs pour avoir toujours les valeurs actuelles
      const currentUserLocation = userLocationRef.current;
      const currentCanClick = canClickRef.current;
      
      console.log('Map clicked!', { canClick: currentCanClick, isLocked, userLocation: currentUserLocation, planningData: !!planningData });
      
      if (!currentCanClick || !currentUserLocation || !planningData) {
        if (isLocked) {
          toast.error('Vous avez utilisé vos 3 tentatives. Utilisez le bouton Réinitialiser pour revenir à l\'itinéraire initial.');
        } else if (!currentUserLocation) {
          toast.error('Position utilisateur non disponible');
        } else if (!planningData) {
          toast.error('Données de planification manquantes');
        }
        return;
      }

      const clickedPoint: Coordinates = {
        lat: e.lngLat.lat,
        lng: e.lngLat.lng
      };

      const distance = calculateDistance(
        currentUserLocation.lat,
        currentUserLocation.lng,
        clickedPoint.lat,
        clickedPoint.lng
      );

      const targetDistance = calculateTargetDistance(
        planningData.steps || 10000,
        planningData.height || 1.70
      );

      const tolerance = getToleranceRange(targetDistance);

      // Vérifier si la distance est dans la tolérance
      if (distance >= tolerance.min && distance <= tolerance.max) {
        incrementAttempts();
        toast.success(`Tentative ${3 - remainingAttempts + 1}/3 - Génération de l'itinéraire...`);
        
        try {
          await generateRouteToPoint(clickedPoint);
        } catch (error) {
          toast.error('Erreur lors de la génération de l\'itinéraire');
        }
      } else if (distance < tolerance.min) {
        toast.error(`Destination trop proche (${distance.toFixed(2)}km). Distance souhaitée: ${targetDistance.toFixed(2)}km ±5%`);
      } else {
        toast.error(`Destination trop éloignée (${distance.toFixed(2)}km). Distance souhaitée: ${targetDistance.toFixed(2)}km ±5%`);
      }
    });

    // Changer le curseur en fonction du statut
    map.current.on('mousemove', () => {
      if (map.current) {
        const currentCanClick = canClickRef.current;
        const currentUserLocation = userLocationRef.current;
        const cursor = !currentCanClick ? 'not-allowed' : (!currentUserLocation || !planningData) ? 'default' : 'pointer';
        map.current.getCanvas().style.cursor = cursor;
      }
    });
  };

  const generateRouteToPoint = async (destination: Coordinates) => {
    if (!userLocation || !planningData) return;

    try {
      const token = await getMapboxToken();
      if (!token) {
        throw new Error('Mapbox token not available');
      }

      const start = `${userLocation.lng},${userLocation.lat}`;
      const end = `${destination.lng},${destination.lat}`;

      if (planningData.tripType === 'one-way') {
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/walking/${start};${end}?geometries=geojson&access_token=${token}`
        );
        const data = await response.json();

        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          const distanceKm = route.distance / 1000;
          const metrics = calculateRouteMetrics(distanceKm, planningData);
          
          const routeData: RouteData = {
            distance: distanceKm,
            duration: route.duration / 60,
            calories: metrics.calories,
            steps: metrics.steps,
            startCoordinates: userLocation,
            endCoordinates: destination,
            routeGeoJSON: {
              outboundCoordinates: route.geometry.coordinates
            }
          };
          handleRouteCalculated(routeData, false);
        }
      } else {
        // Round trip
        const outboundResponse = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/walking/${start};${end}?geometries=geojson&access_token=${token}`
        );
        const returnResponse = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/walking/${end};${start}?geometries=geojson&access_token=${token}`
        );

        const outboundData = await outboundResponse.json();
        const returnData = await returnResponse.json();

        if (outboundData.routes?.[0] && returnData.routes?.[0]) {
          const totalDistance = (outboundData.routes[0].distance + returnData.routes[0].distance) / 1000;
          const totalDuration = (outboundData.routes[0].duration + returnData.routes[0].duration) / 60;
          const metrics = calculateRouteMetrics(totalDistance, planningData);

          const routeData: RouteData = {
            distance: totalDistance,
            duration: totalDuration,
            calories: metrics.calories,
            steps: metrics.steps,
            startCoordinates: userLocation,
            endCoordinates: destination,
            routeGeoJSON: {
              outboundCoordinates: outboundData.routes[0].geometry.coordinates,
              returnCoordinates: returnData.routes[0].geometry.coordinates
            }
          };
          handleRouteCalculated(routeData, false);
        }
      }
    } catch (error) {
      console.error('Error generating route to point:', error);
      throw error;
    }
  };

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
    } else {
      setLocationError('Géolocalisation non disponible sur ce navigateur.');
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
          'line-width': 5,
          'line-opacity': 0.8
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
          'line-color': '#10b981',
          'line-width': 5,
          'line-dasharray': [2, 2],
          'line-opacity': 0.9,
          'line-offset': 3
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
      const generateRoute = async () => {
        if (planningData.tripType === 'one-way') {
          await oneWayHook.generateOneWayRoute();
        } else if (planningData.tripType === 'round-trip') {
          await roundTripHook.generateRoundTripRoute();
        }
      };
      
      generateRoute();
    }
  }, [mapReady, userLocation, planningData?.tripType, planningData?.steps, planningData?.height, currentRoute, isCalculating]);

  const handleReset = () => {
    if (initialRoute) {
      setCurrentRoute(initialRoute);
      displayRouteOnMap(initialRoute);
      if (onRouteCalculated) {
        onRouteCalculated(initialRoute);
      }
      toast.success('Itinéraire initial restauré');
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
      {manualSelectionEnabled && (
        <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2 z-10">
          <div className="bg-background/90 text-foreground px-4 py-2 rounded-lg shadow-lg text-sm">
            {isLocked ? (
              <span>Vous avez utilisé vos 3 tentatives. Cliquez sur Réinitialiser pour revenir à l'itinéraire initial.</span>
            ) : (
              <span>Cliquez sur la carte pour choisir une destination ({remainingAttempts} tentative{remainingAttempts > 1 ? 's' : ''} restante{remainingAttempts > 1 ? 's' : ''})</span>
            )}
          </div>
          {isLocked && initialRoute && (
            <Button 
              onClick={handleReset}
              variant="default"
              className="w-full"
            >
              Réinitialiser l'itinéraire initial
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedMap;
