import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlanningData, RouteData, Coordinates } from '@/types/route';
import { initializeMap, getMapboxToken } from '@/utils/mapboxHelpers';
import { useRunOneWayRouteGeneration } from '@/hooks/useRunOneWayRouteGeneration';
import { useRunRoundTripRouteGeneration } from '@/hooks/useRunRoundTripRouteGeneration';
import { useMapClickLimiter } from '@/hooks/useMapClickLimiter';
import { calculateDistance, getToleranceRange, calculateTargetDistance, calculateRunRouteMetrics } from '@/utils/runCalculations';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface RunEnhancedMapProps {
  planningData?: PlanningData;
  onRouteCalculated?: (route: RouteData) => void;
  manualSelectionEnabled?: boolean;
}

const RunEnhancedMap: React.FC<RunEnhancedMapProps> = ({ 
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
  const hasGeneratedInitialRoute = useRef(false); // Prevent re-generation on swipe
  
  // Sauvegarder l'itinéraire actuel dans localStorage
  useEffect(() => {
    if (currentRoute && userLocation) {
      const routeState = {
        route: currentRoute,
        userLocation,
        planningData,
        timestamp: Date.now()
      };
      localStorage.setItem('current_run_route_state', JSON.stringify(routeState));
      console.log('💾 Itinéraire de course et données de planification sauvegardés:', routeState);
    }
  }, [currentRoute, userLocation, planningData]);

  // Restaurer l'itinéraire après un swipe/refresh
  useEffect(() => {
    const savedRouteState = localStorage.getItem('current_run_route_state');
    if (savedRouteState && !currentRoute && userLocation) {
      try {
        const routeState = JSON.parse(savedRouteState);
        // Vérifier que l'itinéraire n'est pas trop ancien (5 minutes max)
        if (Date.now() - routeState.timestamp < 300000) {
          console.log('♻️ Restauration de l\'itinéraire de course et des données sauvegardés:', routeState);
          setCurrentRoute(routeState.route);
          if (onRouteCalculated) {
            onRouteCalculated(routeState.route);
          }
          displayRouteOnMap(routeState.route);
          
          // Restaurer les données de planification si disponibles
          if (routeState.planningData) {
            console.log('♻️ Données de planification de course restaurées:', routeState.planningData);
          }
        } else {
          localStorage.removeItem('current_run_route_state');
        }
      } catch (error) {
        console.error('Erreur lors de la restauration de l\'itinéraire de course:', error);
        localStorage.removeItem('current_run_route_state');
      }
    }
  }, [userLocation, currentRoute, onRouteCalculated]);
  
  const { canClick, isLocked, incrementAttempts, remainingAttempts } = useMapClickLimiter(3);

  const userLocationRef = useRef<Coordinates | null>(null);
  const canClickRef = useRef(canClick);
  const planningDataRef = useRef<PlanningData | undefined>(planningData);
  
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);
  
  useEffect(() => {
    canClickRef.current = canClick;
  }, [canClick]);
  
  useEffect(() => {
    planningDataRef.current = planningData;
  }, [planningData]);

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

  const oneWayHook = useRunOneWayRouteGeneration(planningData, userLocation, (route) => handleRouteCalculated(route, true));
  const roundTripHook = useRunRoundTripRouteGeneration(planningData, userLocation, (route) => handleRouteCalculated(route, true));

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

      const straightLineDistance = calculateDistance(
        currentUserLocation.lat,
        currentUserLocation.lng,
        clickedPoint.lat,
        clickedPoint.lng
      );

      // Use distance directly for running
      const targetDistance = calculateTargetDistance(planningData.distance || 5);

      const tolerance = getToleranceRange(targetDistance);

      const distanceToCompare = planningData.tripType === 'round-trip' 
        ? straightLineDistance * 2 
        : straightLineDistance;

      console.log({
        straightLineDistance: straightLineDistance.toFixed(2),
        distanceToCompare: distanceToCompare.toFixed(2),
        targetDistance: targetDistance.toFixed(2),
        min: tolerance.min.toFixed(2),
        max: tolerance.max.toFixed(2),
        tripType: planningData.tripType
      });

      if (distanceToCompare >= tolerance.min && distanceToCompare <= tolerance.max) {
        console.log('✅ Phase 1: Point cliqué valide, génération directe de l\'itinéraire');
        toast.success(`Génération de l'itinéraire vers la destination...`);
        incrementAttempts();
        
        try {
          await generateRouteToPoint(clickedPoint);
        } catch (error) {
          toast.error('Erreur lors de la génération de l\'itinéraire');
          console.error('Error generating route:', error);
        }
      } else {
        console.log('🔄 Phase 2: Recherche d\'itinéraires alternatifs dans un rayon de 500m...');
        const loadingToast = toast.loading('Recherche du meilleur itinéraire...');
        
        try {
          const bestRoute = await findBestRouteNearClick(clickedPoint);
          toast.dismiss(loadingToast);
          
          if (bestRoute) {
            incrementAttempts();
            handleRouteCalculated(bestRoute, false);
            toast.success(`Itinéraire trouvé: ${bestRoute.distance.toFixed(2)}km`);
          } else {
            if (distanceToCompare < tolerance.min) {
              toast.error(`Aucun itinéraire valide trouvé. Zone trop proche (${distanceToCompare.toFixed(2)}km). Distance souhaitée: ${targetDistance.toFixed(2)}km ±5%`);
            } else {
              toast.error(`Aucun itinéraire valide trouvé. Zone trop éloignée (${distanceToCompare.toFixed(2)}km). Distance souhaitée: ${targetDistance.toFixed(2)}km ±5%`);
            }
          }
        } catch (error) {
          toast.error('Erreur lors de la recherche d\'itinéraires');
          console.error('Error finding best route:', error);
        }
      }
    });

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
          const metrics = calculateRunRouteMetrics(distanceKm, planningData);
          
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
          const metrics = calculateRunRouteMetrics(totalDistance, planningData);

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

  const findBestRouteNearClick = async (clickedPoint: Coordinates): Promise<RouteData | null> => {
    const currentUserLocation = userLocationRef.current;
    const currentPlanningData = planningDataRef.current;
    
    if (!currentUserLocation || !currentPlanningData) {
      console.error('❌ findBestRouteNearClick: missing userLocation or planningData');
      return null;
    }

    const targetDistance = calculateTargetDistance(
      currentPlanningData.distance || 5
    );

    const tolerance = getToleranceRange(targetDistance);
    
    console.log('🔍 Recherche d\'un itinéraire valide près du point cliqué...');

    const searchRadiusKm = 0.5;
    const candidateAngles = [0, 60, 120, 180, 240, 300];

    for (const angle of candidateAngles) {
      console.log(`\n🧭 Test angle ${angle}°...`);
      const angleRad = (angle * Math.PI) / 180;
      const latOffset = (searchRadiusKm / 111.32) * Math.cos(angleRad);
      const lngOffset = (searchRadiusKm / (111.32 * Math.cos(clickedPoint.lat * Math.PI / 180))) * Math.sin(angleRad);

      const candidatePoint: Coordinates = {
        lat: clickedPoint.lat + latOffset,
        lng: clickedPoint.lng + lngOffset
      };

      try {
        const token = await getMapboxToken();
        if (!token) continue;

        const start = `${currentUserLocation.lng},${currentUserLocation.lat}`;
        const end = `${candidatePoint.lng},${candidatePoint.lat}`;

        if (currentPlanningData.tripType === 'one-way') {
          const response = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/walking/${start};${end}?geometries=geojson&access_token=${token}`
          );
          const data = await response.json();

          if (data.routes && data.routes[0]) {
            const route = data.routes[0];
            const distanceKm = route.distance / 1000;

          if (distanceKm >= tolerance.min && distanceKm <= tolerance.max) {
            console.log(`   ✅ TROUVÉ ! Itinéraire valide à ${angle}°: ${distanceKm.toFixed(3)}km`);
            const metrics = calculateRunRouteMetrics(distanceKm, currentPlanningData);
            const routeData: RouteData = {
              distance: distanceKm,
              duration: route.duration / 60,
              calories: metrics.calories,
              steps: metrics.steps,
              startCoordinates: currentUserLocation,
              endCoordinates: candidatePoint,
              routeGeoJSON: {
                outboundCoordinates: route.geometry.coordinates
              }
            };
            return routeData;
          }
          }
        } else {
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

          if (totalDistance >= tolerance.min && totalDistance <= tolerance.max) {
            console.log(`   ✅ TROUVÉ ! Itinéraire aller-retour valide à ${angle}°: ${totalDistance.toFixed(3)}km`);
            const totalDuration = (outboundData.routes[0].duration + returnData.routes[0].duration) / 60;
            const metrics = calculateRunRouteMetrics(totalDistance, currentPlanningData);

            const routeData: RouteData = {
              distance: totalDistance,
              duration: totalDuration,
              calories: metrics.calories,
              steps: metrics.steps,
              startCoordinates: currentUserLocation,
              endCoordinates: candidatePoint,
              routeGeoJSON: {
                outboundCoordinates: outboundData.routes[0].geometry.coordinates,
                returnCoordinates: returnData.routes[0].geometry.coordinates
              }
            };
            return routeData;
          }
          }
        }
      } catch (error) {
        console.error(`   ❌ Erreur lors de la requête à ${angle}°:`, error);
      }
    }

    console.log('\n❌ AUCUN ITINÉRAIRE VALIDE trouvé après test des 6 directions');
    return null;
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

            userMarker.current = new mapboxgl.Marker({ color: '#EA580C' })
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
    console.log('=== DISPLAY RUN ROUTE ON MAP ===');

    if (!map.current || !route.routeGeoJSON) {
      console.error('Cannot display route: missing map or GeoJSON');
      return;
    }

    clearRoute();

    const { outboundCoordinates, returnCoordinates } = route.routeGeoJSON;

    if (outboundCoordinates) {
      try {
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
            'line-color': '#f97316',
            'line-width': 5,
            'line-opacity': 0.8
          }
        });
        console.log('✓ Outbound route displayed successfully');
      } catch (error) {
        console.error('✗ Error adding outbound route:', error);
      }
    }

    if (returnCoordinates && planningData?.tripType === 'round-trip') {
      try {
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
            'line-color': '#ef4444',
            'line-width': 5,
            'line-dasharray': [2, 2],
            'line-opacity': 0.9,
            'line-offset': 3
          }
        });
        console.log('✓ Return route displayed successfully');
      } catch (error) {
        console.error('✗ Error adding return route:', error);
      }
    }

    if (destinationMarker.current) {
      destinationMarker.current.remove();
    }
    destinationMarker.current = new mapboxgl.Marker({ color: '#DC2626' })
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

    console.log('=== DISPLAY RUN ROUTE COMPLETED ===');
  };

  useEffect(() => {
    // Only generate route once, prevent re-generation on swipe/unmount
    if (mapReady && userLocation && planningData && !hasGeneratedInitialRoute.current && !isCalculating) {
      hasGeneratedInitialRoute.current = true; // Mark as generated
      
      const generateRoute = async () => {
        if (planningData.tripType === 'one-way') {
          await oneWayHook.generateOneWayRoute();
        } else if (planningData.tripType === 'round-trip') {
          await roundTripHook.generateRoundTripRoute();
        }
      };
      
      generateRoute();
    }
  }, [mapReady, userLocation, planningData?.tripType, planningData?.steps, planningData?.height, isCalculating]);

  const handleReset = () => {
    if (initialRoute) {
      setCurrentRoute(initialRoute);
      displayRouteOnMap(initialRoute);
      if (onRouteCalculated) {
        onRouteCalculated(initialRoute);
      }
      hasGeneratedInitialRoute.current = true; // Keep generation blocked
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

export default RunEnhancedMap;
