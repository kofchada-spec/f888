import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlanningData, RouteData } from '@/types/route';
import { initializeMap, getMapboxToken } from '@/utils/mapboxHelpers';
import { useMapClickLimiter } from '@/hooks/useMapClickLimiter';
import { useRouteGeneration } from '@/hooks/useRouteGeneration';
import { useMapState } from '@/hooks/useMapState';
import { useMapRoutes } from '@/hooks/useMapRoutes';
import { calculateTargetDistance, getToleranceRange, calculateRouteMetrics } from '@/utils/routeCalculations';

interface EnhancedMapProps {
  className?: string;
  planningData?: PlanningData;
  onRouteCalculated?: (routeData: RouteData) => void;
  onMapClick?: (coordinates: { lat: number; lng: number }) => void;
  canClick?: boolean;
  forceReset?: boolean;
  onResetComplete?: () => void;
}

const EnhancedMap: React.FC<EnhancedMapProps> = ({
  className = '',
  planningData,
  onRouteCalculated,
  onMapClick,
  canClick = true,
  forceReset = false,
  onResetComplete,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  
  const { canClick: canClickFromLimiter } = useMapClickLimiter();
  
  const {
    state,
    setUserLocation,
    setCurrentRoute,
    setCalculating,
    setMapReady,
    setManualSelectionActive,
    resetState
  } = useMapState();
  
  const { 
    generateRoundTripRoute, 
    generateOneWayRoute,
    isCalculating,
    routeError,
    setRouteError 
  } = useRouteGeneration(planningData, state.userLocation, onRouteCalculated);
  
  const { displayRoute, clearRoutes } = useMapRoutes(map);

  // Initialize map and get token
  useEffect(() => {
    const initializeMapAndToken = async () => {
      console.log('🚀 [EnhancedMap] Initialisation de la carte...');
      console.log('🚀 [EnhancedMap] mapContainer.current:', !!mapContainer.current);
      console.log('🚀 [EnhancedMap] map.current:', !!map.current);
      
      try {
        const token = await getMapboxToken();
        console.log('🚀 [EnhancedMap] Token reçu:', !!token);
        
        if (!token || !mapContainer.current) {
          console.error('❌ [EnhancedMap] Token Mapbox ou conteneur manquant', { 
            token: !!token, 
            container: !!mapContainer.current 
          });
          return;
        }

        console.log('✅ [EnhancedMap] Token et conteneur disponibles, création de la carte...');
        const mapInstance = initializeMap(
          mapContainer.current,
          token,
          undefined // Don't use user location for initial center yet
        );

        console.log('✅ [EnhancedMap] Map instance créée:', !!mapInstance);
        map.current = mapInstance;

        mapInstance.on('style.load', () => {
          console.log('🗺️ [EnhancedMap] Style de carte chargé');
          setMapReady(true);
        });

        mapInstance.on('load', () => {
          console.log('🗺️ [EnhancedMap] Carte complètement chargée');
        });

        mapInstance.on('error', (e) => {
          console.error('❌ [EnhancedMap] Erreur carte:', e);
        });

      } catch (error) {
        console.error('❌ [EnhancedMap] Erreur initialisation carte:', error);
      }
    };

    if (!map.current && mapContainer.current) {
      console.log('🚀 [EnhancedMap] Démarrage initialisation carte');
      initializeMapAndToken();
    } else {
      console.log('🚀 [EnhancedMap] Initialisation ignorée - map:', !!map.current, 'container:', !!mapContainer.current);
    }
  }, [setMapReady]);

  // Get user location
  useEffect(() => {
    console.log('🌍 Demande de géolocalisation...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          console.log('✅ Position géolocalisée obtenue:', newLocation);
          setUserLocation(newLocation);
          
          // Move map to user location once we have it
          if (map.current) {
            map.current.flyTo({
              center: [newLocation.lng, newLocation.lat],
              zoom: 14,
              duration: 1000
            });
          }
        },
        (error) => {
          console.warn('⚠️ Erreur géolocalisation:', error.message);
          console.log('Using default location for demo purposes');
          // Set default location for demo
          const defaultLocation = { lat: 43.6047, lng: 1.4442 }; // Toulouse
          setUserLocation(defaultLocation);
          
          if (map.current) {
            map.current.flyTo({
              center: [defaultLocation.lng, defaultLocation.lat],
              zoom: 14,
              duration: 1000
            });
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    } else {
      console.log('❌ Geolocation not supported by this browser');
      // Set default location for demo
      const defaultLocation = { lat: 43.6047, lng: 1.4442 }; // Toulouse
      setUserLocation(defaultLocation);
    }
  }, [setUserLocation]);

  // Auto-generate route when everything is ready with fallback
  useEffect(() => {
    const generateCardinalDirection = (centerLat: number, centerLng: number, distanceKm: number, angleDegrees: number) => {
      const R = 6371; // Earth radius in km
      const lat1 = centerLat * Math.PI / 180;
      const lng1 = centerLng * Math.PI / 180;
      const bearing = angleDegrees * Math.PI / 180;
      
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distanceKm / R) + 
                           Math.cos(lat1) * Math.sin(distanceKm / R) * Math.cos(bearing));
      const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(distanceKm / R) * Math.cos(lat1),
                                     Math.cos(distanceKm / R) - Math.sin(lat1) * Math.sin(lat2));
      
      return {
        lat: lat2 * 180 / Math.PI,
        lng: lng2 * 180 / Math.PI
      };
    };

    const autoGenerateRoute = async () => {
      if (!state.mapReady || !state.userLocation || !planningData || state.currentRoute) {
        return;
      }

      console.log('🎯 Génération automatique d\'itinéraire...');
      setCalculating(true);

      try {
        let routeData: RouteData | null = null;

        // Try the original generation first
        if (planningData.tripType === 'round-trip') {
          routeData = await generateRoundTripRoute();
        } else {
          routeData = await generateOneWayRoute();
        }

        // If no route found, use cardinal direction fallback
        if (!routeData) {
          console.log('🧭 Génération fallback avec directions cardinales...');
          
          const targetDistance = calculateTargetDistance(planningData.steps, planningData.height);
          const searchDistance = planningData.tripType === 'round-trip' ? targetDistance / 2 : targetDistance;
          const directions = [0, 90, 180, 270]; // N, E, S, W
          const token = await getMapboxToken();
          
          if (!token) {
            throw new Error('Token Mapbox manquant pour fallback');
          }

          for (const angle of directions) {
            try {
              const destination = generateCardinalDirection(
                state.userLocation.lat, 
                state.userLocation.lng, 
                searchDistance, 
                angle
              );

              // Test this direction with Mapbox Directions
              const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${state.userLocation.lng},${state.userLocation.lat};${destination.lng},${destination.lat}?geometries=geojson&access_token=${token}`;
              
              const outboundResponse = await fetch(outboundUrl);
              const outboundData = await outboundResponse.json();

              if (outboundData.routes && outboundData.routes.length > 0) {
                const outboundRoute = outboundData.routes[0];
                let outboundDistance = outboundRoute.distance / 1000;
                let returnRoute = null;
                let returnDistance = 0;

                if (planningData.tripType === 'round-trip') {
                  const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${destination.lng},${destination.lat};${state.userLocation.lng},${state.userLocation.lat}?geometries=geojson&access_token=${token}`;
                  
                  const returnResponse = await fetch(returnUrl);
                  const returnData = await returnResponse.json();

                  if (returnData.routes && returnData.routes.length > 0) {
                    returnRoute = returnData.routes[0];
                    returnDistance = returnRoute.distance / 1000;
                  } else {
                    returnRoute = {
                      geometry: {
                        coordinates: [...outboundRoute.geometry.coordinates].reverse()
                      }
                    };
                    returnDistance = outboundDistance;
                  }
                }

                const totalDistance = planningData.tripType === 'round-trip' 
                  ? outboundDistance + returnDistance 
                  : outboundDistance;

                const { min, max } = getToleranceRange(targetDistance);
                
                if (totalDistance >= min && totalDistance <= max) {
                  console.log(`✅ Fallback direction ${angle}° validée: ${totalDistance.toFixed(2)}km`);
                  
                  const metrics = calculateRouteMetrics(totalDistance, planningData);
                  routeData = {
                    distance: totalDistance,
                    duration: metrics.durationMin,
                    calories: metrics.calories,
                    steps: metrics.steps,
                    startCoordinates: state.userLocation,
                    endCoordinates: destination,
                    routeGeoJSON: {
                      outboundCoordinates: outboundRoute.geometry.coordinates,
                      returnCoordinates: returnRoute?.geometry.coordinates,
                      samePathReturn: false
                    }
                  };
                  break;
                }
              }
            } catch (dirError) {
              console.warn(`⚠️ Erreur direction ${angle}°:`, dirError);
              continue;
            }
          }
        }

        if (routeData) {
          setCurrentRoute(routeData);
          await displayRoute(routeData, state.userLocation, planningData.tripType);
          onRouteCalculated?.(routeData);
        } else {
          throw new Error('Aucun itinéraire valide trouvé dans toutes les directions');
        }
      } catch (error) {
        console.error('❌ Erreur génération automatique:', error);
        setRouteError(error instanceof Error ? error.message : 'Erreur génération itinéraire');
      } finally {
        setCalculating(false);
      }
    };

    autoGenerateRoute();
  }, [
    state.mapReady,
    state.userLocation,
    planningData,
    state.currentRoute,
    generateRoundTripRoute,
    generateOneWayRoute,
    displayRoute,
    onRouteCalculated,
    setCurrentRoute,
    setCalculating,
    setRouteError
  ]);

  // Handle reset
  useEffect(() => {
    if (forceReset) {
      console.log('🔄 Réinitialisation de la carte...');
      clearRoutes();
      resetState();
      onResetComplete?.();
    }
  }, [forceReset, clearRoutes, resetState, onResetComplete]);

  // Handle manual selection via map clicks with real Mapbox Directions API
  useEffect(() => {
    if (!map.current || !state.mapReady || !state.userLocation || !planningData) {
      return;
    }

    const handleClick = async (e: mapboxgl.MapMouseEvent) => {
      if (state.isCalculating || !canClick || !canClickFromLimiter) return;

      console.log('👆 Clic manuel sur la carte - génération itinéraire réel');
      setManualSelectionActive(true);
      setCalculating(true);
      onMapClick?.(e.lngLat);

      const clickedCoords = e.lngLat;
      const targetDistance = calculateTargetDistance(planningData.steps, planningData.height);
      const { min, max } = getToleranceRange(targetDistance);

      try {
        // Get Mapbox token
        const token = await getMapboxToken();
        if (!token) {
          throw new Error('Token Mapbox manquant');
        }

        // Generate outbound route using Mapbox Directions API
        const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${state.userLocation!.lng},${state.userLocation!.lat};${clickedCoords.lng},${clickedCoords.lat}?alternatives=true&geometries=geojson&access_token=${token}`;
        
        const outboundResponse = await fetch(outboundUrl);
        const outboundData = await outboundResponse.json();

        if (!outboundData.routes || outboundData.routes.length === 0) {
          throw new Error('Aucun itinéraire trouvé pour cette destination');
        }

        const outboundRoute = outboundData.routes[0];
        let outboundDistance = outboundRoute.distance / 1000; // Convert to km
        let returnRoute = null;
        let returnDistance = 0;

        // For round-trip, generate return route
        if (planningData.tripType === 'round-trip') {
          const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${clickedCoords.lng},${clickedCoords.lat};${state.userLocation!.lng},${state.userLocation!.lat}?alternatives=true&geometries=geojson&access_token=${token}`;
          
          const returnResponse = await fetch(returnUrl);
          const returnData = await returnResponse.json();

          if (returnData.routes && returnData.routes.length > 0) {
            // Try to use a different alternative for return if available
            const alternativeIndex = returnData.routes.length > 1 ? 1 : 0;
            returnRoute = returnData.routes[alternativeIndex];
            returnDistance = returnRoute.distance / 1000;
          } else {
            // Fallback: reverse the outbound coordinates
            returnRoute = {
              geometry: {
                coordinates: [...outboundRoute.geometry.coordinates].reverse()
              },
              distance: outboundRoute.distance
            };
            returnDistance = outboundDistance;
          }
        }

        // Calculate total real distance
        const totalRealDistance = planningData.tripType === 'round-trip' 
          ? outboundDistance + returnDistance 
          : outboundDistance;

        console.log(`🛤️ Distance réelle calculée: ${totalRealDistance.toFixed(2)}km (cible: ${targetDistance.toFixed(2)}km)`);

        // Check tolerance on REAL distance (not straight-line)
        if (totalRealDistance >= min && totalRealDistance <= max) {
          console.log('✅ Itinéraire réel validé dans la tolérance ±5%');
          
          // Create route data with real metrics
          const metrics = calculateRouteMetrics(totalRealDistance, planningData);
          const newRouteData: RouteData = {
            distance: totalRealDistance,
            duration: metrics.durationMin,
            calories: metrics.calories,
            steps: metrics.steps,
            startCoordinates: state.userLocation!,
            endCoordinates: { lat: clickedCoords.lat, lng: clickedCoords.lng },
            routeGeoJSON: {
              outboundCoordinates: outboundRoute.geometry.coordinates,
              returnCoordinates: returnRoute?.geometry.coordinates,
              samePathReturn: false
            }
          };

          setCurrentRoute(newRouteData);
          await displayRoute(newRouteData, state.userLocation!, planningData.tripType);
          onRouteCalculated?.(newRouteData);
          
        } else {
          const message = `Itinéraire hors plage ±5% : ${totalRealDistance.toFixed(1)}km vs ${targetDistance.toFixed(1)}km ciblé. Essayez un autre point.`;
          console.warn('⚠️', message);
          setRouteError(message);
          setTimeout(() => setRouteError(null), 4000);
          setManualSelectionActive(false);
        }

      } catch (error) {
        console.error('❌ Erreur génération itinéraire:', error);
        setRouteError(error instanceof Error ? error.message : 'Erreur génération itinéraire');
        setTimeout(() => setRouteError(null), 4000);
        setManualSelectionActive(false);
      } finally {
        setCalculating(false);
      }
    };

    map.current.on('click', handleClick);

    return () => {
      map.current?.off('click', handleClick);
    };
  }, [
    map.current,
    state.mapReady,
    state.userLocation,
    state.isCalculating,
    planningData,
    displayRoute,
    onMapClick,
    onRouteCalculated,
    setCurrentRoute,
    setManualSelectionActive,
    setCalculating,
    setRouteError,
    canClick,
    canClickFromLimiter
  ]);

  // Restore original route function
  const restoreOriginalRoute = async () => {
    if (!state.userLocation || !planningData) return;

    console.log('🔄 Restauration de l\'itinéraire original...');
    setManualSelectionActive(false);
    setCalculating(true);

    try {
      let routeData: RouteData | null = null;

      if (planningData.tripType === 'round-trip') {
        routeData = await generateRoundTripRoute();
      } else {
        routeData = await generateOneWayRoute();
      }

      if (routeData) {
        setCurrentRoute(routeData);
        await displayRoute(routeData, state.userLocation, planningData.tripType);
        onRouteCalculated?.(routeData);
      }
    } catch (error) {
      console.error('❌ Erreur restauration:', error);
      setRouteError('Erreur lors de la restauration');
    } finally {
      setCalculating(false);
    }
  };

  const isLoading = !state.mapReady && !state.userLocation;

  return (
    <div className={`relative ${className}`} style={{ height: '400px' }}>
      {/* Map container - always present */}
      <div 
        ref={mapContainer} 
        style={{ width: '100%', height: '100%' }}
        className="absolute inset-0 rounded-lg" 
      />
      
      {/* Loading overlay - shows over the map */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center z-20">
          <div className="text-center max-w-md p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground mb-2">Initialisation de la carte...</p>
            <p className="text-xs text-muted-foreground">Configuration en cours...</p>
          </div>
        </div>
      )}
      
      {/* Loading overlay - waiting for location */}
      {!state.userLocation && !isLoading && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
          <div className="bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-pulse rounded-full h-5 w-5 bg-primary/50"></div>
              <span className="text-sm font-medium">Localisation en cours...</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">Veuillez autoriser l'accès à votre position</p>
          </div>
        </div>
      )}
      
      {/* Loading overlay - route calculation */}
      {state.userLocation && (state.isCalculating || isCalculating) && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center rounded-lg z-10">
          <div className="bg-card/90 backdrop-blur-sm p-4 rounded-lg shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              <span className="text-sm font-medium">Génération de l'itinéraire...</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {state.routeError && (
        <div className="absolute top-4 left-4 right-4 bg-destructive/90 text-destructive-foreground p-3 rounded-lg shadow-lg z-20">
          <p className="text-sm font-medium text-center">{state.routeError}</p>
        </div>
      )}

      {/* Restore button */}
      {state.manualSelectionActive && state.currentRoute && (
        <button
          onClick={restoreOriginalRoute}
          className="absolute bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg hover:bg-primary/90 transition-colors z-10"
        >
          Restaurer l'itinéraire automatique
        </button>
      )}

      {/* Instructions */}
      {planningData && !state.routeError && !state.isCalculating && state.currentRoute && state.mapReady && (
        <div className="absolute bottom-4 left-4 right-20 bg-card/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
          <p className="text-sm text-center text-muted-foreground">
            {planningData.tripType === 'round-trip' 
              ? "Cliquez sur la carte pour personnaliser votre destination aller-retour" 
              : "Cliquez sur la carte pour choisir une nouvelle destination"}
          </p>
        </div>
      )}
    </div>
  );
};

export default EnhancedMap;