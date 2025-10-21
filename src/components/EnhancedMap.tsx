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
  activityType?: 'walk' | 'run';
}

const EnhancedMap: React.FC<EnhancedMapProps> = ({ 
  planningData, 
  onRouteCalculated,
  manualSelectionEnabled = true,
  activityType = 'walk'
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
      localStorage.setItem('current_route_state', JSON.stringify(routeState));
      console.log('💾 Itinéraire et données de planification sauvegardés:', routeState);
    }
  }, [currentRoute, userLocation, planningData]);

  // Restaurer l'itinéraire arcès un swipe/refresh
  useEffect(() => {
    const savedRouteState = localStorage.getItem('current_route_state');
    if (savedRouteState && !currentRoute && userLocation) {
      try {
        const routeState = JSON.parse(savedRouteState);
        // Vérifier que l'itinéraire n'est pas trop ancien (5 minutes max)
        if (Date.now() - routeState.timestamp < 300000) {
          console.log('♻️ Restauration de l\'itinéraire et des données sauvegardés:', routeState);
          setCurrentRoute(routeState.route);
          if (onRouteCalculated) {
            onRouteCalculated(routeState.route);
          }
          displayRouteOnMap(routeState.route);
          
          // Restaurer les données de planification si disponibles
          if (routeState.planningData) {
            console.log('♻️ Données de planification restaurées:', routeState.planningData);
          }
        } else {
          localStorage.removeItem('current_route_state');
        }
      } catch (error) {
        console.error('Erreur lors de la restauration de l\'itinéraire:', error);
        localStorage.removeItem('current_route_state');
      }
    }
  }, [userLocation, currentRoute, onRouteCalculated]);
  
  const { canClick, isLocked, incrementAttempts, remainingAttempts } = useMapClickLimiter(3);

  // Refs pour accéder aux valeurs actuelles dans les event listeners
  const userLocationRef = useRef<Coordinates | null>(null);
  const canClickRef = useRef(canClick);
  const planningDataRef = useRef<PlanningData | undefined>(planningData);
  
  // Mettre à jour les refs quand les valeurs changent
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

      // Calculer la distance en ligne droite
      const straightLineDistance = calculateDistance(
        currentUserLocation.lat,
        currentUserLocation.lng,
        clickedPoint.lat,
        clickedPoint.lng
      );

      // Calculer la distance cible totale selon les pas et la taille
      const targetDistance = calculateTargetDistance(
        planningData.steps || 10000,
        planningData.height || 1.70
      );

      const tolerance = getToleranceRange(targetDistance);

      // Pour aller-retour, la distance en ligne droite doit être la moitié de la distance cible
      // Pour aller simple, on compare directement
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

      // Phase 1: Vérifier si le point cliqué correspond directement
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
        // Phase 2: Rechercher le meilleur itinéraire dans un rayon de 500m
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

  const findBestRouteNearClick = async (clickedPoint: Coordinates): Promise<RouteData | null> => {
    const currentUserLocation = userLocationRef.current;
    const currentPlanningData = planningDataRef.current;
    
    if (!currentUserLocation || !currentPlanningData) {
      console.error('❌ findBestRouteNearClick: missing userLocation or planningData', {
        hasUserLocation: !!currentUserLocation,
        hasPlanningData: !!currentPlanningData
      });
      return null;
    }

    const targetDistance = calculateTargetDistance(
      currentPlanningData.steps || 10000,
      currentPlanningData.height || 1.70
    );

    const tolerance = getToleranceRange(targetDistance);
    
    console.log('🔍 Recherche d\'un itinéraire valide près du point cliqué...');
    console.log('🎯 Distance cible:', targetDistance.toFixed(3), 'km');
    console.log('📊 Plage acceptable:', tolerance.min.toFixed(3), '-', tolerance.max.toFixed(3), 'km');
    console.log('📍 Point cliqué:', clickedPoint);
    console.log('📍 Position utilisateur:', userLocation);

    const searchRadiusKm = 0.5;
    const candidateAngles = [0, 60, 120, 180, 240, 300];
    
    console.log(`🔄 Test de ${candidateAngles.length} directions dans un rayon de ${searchRadiusKm}km`);

    for (const angle of candidateAngles) {
      console.log(`\n🧭 Test angle ${angle}°...`);
      const angleRad = (angle * Math.PI) / 180;
      const latOffset = (searchRadiusKm / 111.32) * Math.cos(angleRad);
      const lngOffset = (searchRadiusKm / (111.32 * Math.cos(clickedPoint.lat * Math.PI / 180))) * Math.sin(angleRad);

      const candidatePoint: Coordinates = {
        lat: clickedPoint.lat + latOffset,
        lng: clickedPoint.lng + lngOffset
      };
      
      console.log(`   📍 Point candidat: ${candidatePoint.lat.toFixed(6)}, ${candidatePoint.lng.toFixed(6)}`);

      try {
        const token = await getMapboxToken();
        if (!token) {
          console.error(`   ❌ Pas de token Mapbox`);
          continue;
        }

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
            
            console.log(`   📏 Distance trouvée: ${distanceKm.toFixed(3)}km (plage: ${tolerance.min.toFixed(3)}-${tolerance.max.toFixed(3)}km)`);

          if (distanceKm >= tolerance.min && distanceKm <= tolerance.max) {
            console.log(`   ✅ TROUVÉ ! Itinéraire valide à ${angle}°: ${distanceKm.toFixed(3)}km`);
            const metrics = calculateRouteMetrics(distanceKm, currentPlanningData);
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

            console.log(`   🎉 Retour de l'itinéraire valide`);
            return routeData;
          } else {
            console.log(`   ❌ Hors plage: ${distanceKm.toFixed(3)}km`);
          }
          } else {
            console.log(`   ❌ Pas de route dans la réponse Mapbox`);
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
            
            console.log(`   📏 Distance totale trouvée: ${totalDistance.toFixed(3)}km (plage: ${tolerance.min.toFixed(3)}-${tolerance.max.toFixed(3)}km)`);

          if (totalDistance >= tolerance.min && totalDistance <= tolerance.max) {
            console.log(`   ✅ TROUVÉ ! Itinéraire aller-retour valide à ${angle}°: ${totalDistance.toFixed(3)}km`);
            const totalDuration = (outboundData.routes[0].duration + returnData.routes[0].duration) / 60;
            const metrics = calculateRouteMetrics(totalDistance, currentPlanningData);

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

            console.log(`   🎉 Retour de l'itinéraire valide`);
            return routeData;
          } else {
            console.log(`   ❌ Hors plage: ${totalDistance.toFixed(3)}km`);
          }
          } else {
            console.log(`   ❌ Pas de routes aller-retour dans la réponse Mapbox`);
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
    console.log('=== DISPLAY ROUTE ON MAP ===');
    console.log('Map instance exists:', !!map.current);
    console.log('Route has GeoJSON:', !!route.routeGeoJSON);
    console.log('Route data:', route);

    if (!map.current || !mapReady) {
      console.error('Cannot display route: missing map instance or map not ready');
      return;
    }

    console.log('Clearing previous route...');
    clearRoute();

    // Vérifier si on a des coordonnées dans routeGeoJSON ou dans route directement
    let outboundCoordinates = null;
    let returnCoordinates = null;

    if (route.routeGeoJSON) {
      outboundCoordinates = route.routeGeoJSON.outboundCoordinates;
      returnCoordinates = route.routeGeoJSON.returnCoordinates;
    } else if (route.startCoordinates && route.endCoordinates) {
      // Fallback : créer une route simple entre start et end
      outboundCoordinates = [
        [route.startCoordinates.lng, route.startCoordinates.lat],
        [route.endCoordinates.lng, route.endCoordinates.lat]
      ];
    }

    console.log('Outbound coordinates count:', outboundCoordinates?.length || 0);
    console.log('Return coordinates count:', returnCoordinates?.length || 0);

    if (outboundCoordinates) {
      console.log('Adding outbound route source and layer...');
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
            'line-color': '#3b82f6',
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
      console.log('Adding return route source and layer...');
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
            'line-color': '#10b981',
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

    console.log('Adding destination marker...');
    if (destinationMarker.current) {
      destinationMarker.current.remove();
    }
    destinationMarker.current = new mapboxgl.Marker({ color: '#EF4444' })
      .setLngLat([route.endCoordinates.lng, route.endCoordinates.lat])
      .addTo(map.current);

    const coordinates = outboundCoordinates || [];
    if (coordinates.length > 0) {
      console.log('Fitting map bounds to route...');
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord as [number, number]);
      }, new mapboxgl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]));

      map.current.fitBounds(bounds, {
        padding: 80,
        maxZoom: 15
      });
      console.log('✓ Map bounds adjusted');
    }

    console.log('=== DISPLAY ROUTE COMPLETED ===');
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

export default EnhancedMap;
