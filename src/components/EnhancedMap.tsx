import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { 
  calculateStrideLength, 
  stepsFromKm, 
  calculateTime, 
  calculateCalories, 
  inBand,
  calculateDestination,
  generateLateralWaypoint,
  type PlanningData 
} from '@/lib/routeHelpers';

interface EnhancedMapProps {
  planningData: PlanningData;
  className?: string;
  onRouteCalculated?: (data: {
    distance: number;
    duration: number;
    calories: number;
    steps: number;
    startCoordinates: { lat: number; lng: number };
    endCoordinates: { lat: number; lng: number };
    routes: {
      go: GeoJSON.Feature<GeoJSON.LineString>;
      back?: GeoJSON.Feature<GeoJSON.LineString>;
    };
  }) => void;
  canClick: boolean;
  onUserClick?: () => void;
}

interface RouteData {
  distance: number;
  duration: number;
  calories: number;
  steps: number;
  startCoordinates: { lat: number; lng: number };
  endCoordinates: { lat: number; lng: number };
  outboundCoordinates: number[][];
  returnCoordinates?: number[][];
}

const EnhancedMap = ({ planningData, className = '', onRouteCalculated, canClick, onUserClick }: EnhancedMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  
  const [currentRoute, setCurrentRoute] = useState<RouteData | null>(null);
  const [defaultRoute, setDefaultRoute] = useState<RouteData | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [routeError, setRouteError] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [requestId, setRequestId] = useState(0);

  // Fetch Mapbox token
  useEffect(() => {
    const getMapboxToken = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('mapbox-token');
        
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        setError('Failed to load map token');
      }
    };
    getMapboxToken();
  }, []);

  // Get user location
  useEffect(() => {
    const getUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => {
            console.error('Geolocation error:', error);
            setPermissionDenied(true);
            // Fallback to Paris center
            setUserLocation({ lat: 48.8566, lng: 2.3522 });
          }
        );
      }
    };
    getUserLocation();
  }, []);

  // Compute route using Mapbox Directions API
  const computeRoute = async (startLat: number, startLng: number, endLat: number, endLng: number, waypoints?: number[][]) => {
    if (!mapboxToken) return null;

    try {
      let url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startLng},${startLat}`;
      
      // Add waypoints if provided
      if (waypoints && waypoints.length > 0) {
        for (const waypoint of waypoints) {
          url += `;${waypoint[1]},${waypoint[0]}`;
        }
      }
      
      url += `;${endLng},${endLat}?steps=true&geometries=geojson&access_token=${mapboxToken}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        return {
          distance: data.routes[0].distance,
          geometry: data.routes[0].geometry,
          coordinates: data.routes[0].geometry.coordinates
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error computing route:', error);
      return null;
    }
  };

  // Generate optimal round-trip route with lateral waypoints
  const generateOptimalRoute = async (startLat: number, startLng: number, endLat: number, endLng: number): Promise<{ outbound: any; return: any } | null> => {
    if (planningData.tripType === 'one-way') {
      const route = await computeRoute(startLat, startLng, endLat, endLng);
      return route ? { outbound: route, return: null } : null;
    }

    // For round-trip, try different lateral waypoints to force different return path
    const angles = [25, -25, 40, -40, 60, -60];
    const distances = [100, 200, 300, 400];

    for (const angle of angles) {
      for (const distance of distances) {
        try {
          const waypoint = generateLateralWaypoint(endLat, endLng, startLat, startLng, angle, distance);
          
          const outboundRoute = await computeRoute(startLat, startLng, endLat, endLng);
          const returnRoute = await computeRoute(endLat, endLng, startLat, startLng, [[waypoint.lat, waypoint.lng]]);
          
          if (outboundRoute && returnRoute) {
            const totalDistance = (outboundRoute.distance + returnRoute.distance) / 1000;
            const heightCm = parseFloat(planningData.height) * 100;
            const totalSteps = stepsFromKm(totalDistance, heightCm);
            const targetSteps = parseInt(planningData.steps);
            
            if (inBand(totalSteps, targetSteps)) {
              return { outbound: outboundRoute, return: returnRoute };
            }
          }
        } catch (error) {
          continue;
        }
      }
    }

    // Fallback to simple round-trip if no lateral route works
    try {
      const outboundRoute = await computeRoute(startLat, startLng, endLat, endLng);
      const returnRoute = await computeRoute(endLat, endLng, startLat, startLng);
      
      if (outboundRoute && returnRoute) {
        return { outbound: outboundRoute, return: returnRoute };
      }
    } catch (error) {
      console.error('Error with fallback route:', error);
    }

    return null;
  };

  // Generate default route within step tolerance at startup
  const generateDefaultRoute = async (startLat: number, startLng: number): Promise<RouteData | null> => {
    const targetSteps = parseInt(planningData.steps);
    const heightCm = parseFloat(planningData.height) * 100;
    const strideLength = calculateStrideLength(heightCm);
    const targetDistanceKm = (targetSteps * strideLength) / 100000;
    
    const searchDistance = planningData.tripType === 'round-trip' ? targetDistanceKm / 2 : targetDistanceKm;
    
    for (let bearing = 0; bearing < 360; bearing += 30) {
      const endPoint = calculateDestination(startLat, startLng, searchDistance, bearing);
      
      try {
        const routes = await generateOptimalRoute(startLat, startLng, endPoint.lat, endPoint.lng);
        
        if (routes && routes.outbound) {
          const totalDistance = routes.return 
            ? (routes.outbound.distance + routes.return.distance) / 1000
            : routes.outbound.distance / 1000;
          
          const totalSteps = stepsFromKm(totalDistance, heightCm);
          
          if (inBand(totalSteps, targetSteps)) {
            const duration = calculateTime(totalDistance, planningData.pace);
            const calories = calculateCalories(totalDistance, duration, parseFloat(planningData.weight), planningData.pace);
            
            return {
              distance: totalDistance,
              duration,
              calories,
              steps: totalSteps,
              startCoordinates: { lat: startLat, lng: startLng },
              endCoordinates: endPoint,
              outboundCoordinates: routes.outbound.coordinates,
              returnCoordinates: routes.return?.coordinates
            };
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  };

  // Find nearest valid destination that meets step target
  const findNearestValidDestination = async (clickedLat: number, clickedLng: number, startLat: number, startLng: number): Promise<RouteData | null> => {
    const currentRequestId = requestId + 1;
    setRequestId(currentRequestId);
    
    const targetSteps = parseInt(planningData.steps);
    const heightCm = parseFloat(planningData.height) * 100;
    setIsCalculating(true);
    setRouteError('');
    
    // First try the exact clicked location
    try {
      const routes = await generateOptimalRoute(startLat, startLng, clickedLat, clickedLng);
      
      // Check if this is still the latest request
      if (currentRequestId !== requestId) return null;
      
      if (routes && routes.outbound) {
        const totalDistance = routes.return 
          ? (routes.outbound.distance + routes.return.distance) / 1000
          : routes.outbound.distance / 1000;
        
        const totalSteps = stepsFromKm(totalDistance, heightCm);
        
        if (inBand(totalSteps, targetSteps)) {
          const duration = calculateTime(totalDistance, planningData.pace);
          const calories = calculateCalories(totalDistance, duration, parseFloat(planningData.weight), planningData.pace);
          
          setIsCalculating(false);
          return {
            distance: totalDistance,
            duration,
            calories,
            steps: totalSteps,
            startCoordinates: { lat: startLat, lng: startLng },
            endCoordinates: { lat: clickedLat, lng: clickedLng },
            outboundCoordinates: routes.outbound.coordinates,
            returnCoordinates: routes.return?.coordinates
          };
        }
      }
      
      // If clicked location doesn't work, try to find nearest valid point
      const strideLength = calculateStrideLength(heightCm);
      let targetDistanceKm = (targetSteps * strideLength) / 100000;
      
      if (planningData.tripType === 'round-trip') {
        targetDistanceKm = targetDistanceKm / 2;
      }
      
      // Calculate bearing from start to clicked point
      const bearing = Math.atan2(
        clickedLng - startLng,
        clickedLat - startLat
      ) * 180 / Math.PI;
      
      // Try adjusting the destination along the same bearing
      for (let factor of [0.8, 0.9, 1.1, 1.2, 0.7, 1.3]) {
        // Check if this is still the latest request
        if (currentRequestId !== requestId) return null;
        
        const adjustedDistance = targetDistanceKm * factor;
        const adjustedDestination = calculateDestination(startLat, startLng, adjustedDistance, bearing);
        
        try {
          const routes = await generateOptimalRoute(startLat, startLng, adjustedDestination.lat, adjustedDestination.lng);
          
          if (routes && routes.outbound) {
            const totalDistance = routes.return 
              ? (routes.outbound.distance + routes.return.distance) / 1000
              : routes.outbound.distance / 1000;
            
            const totalSteps = stepsFromKm(totalDistance, heightCm);
            
            if (inBand(totalSteps, targetSteps)) {
              const duration = calculateTime(totalDistance, planningData.pace);
              const calories = calculateCalories(totalDistance, duration, parseFloat(planningData.weight), planningData.pace);
              
              setIsCalculating(false);
              setRouteError('No direct route found — auto-adjusting to the nearest target.');
              return {
                distance: totalDistance,
                duration,
                calories,
                steps: totalSteps,
                startCoordinates: { lat: startLat, lng: startLng },
                endCoordinates: adjustedDestination,
                outboundCoordinates: routes.outbound.coordinates,
                returnCoordinates: routes.return?.coordinates
              };
            }
          }
        } catch (error) {
          continue;
        }
      }
      
    } catch (error) {
      console.error('Error finding nearest valid destination:', error);
    }
    
    setIsCalculating(false);
    return null;
  };

  // Reset to default route
  const resetToDefault = () => {
    if (defaultRoute) {
      setCurrentRoute(defaultRoute);
      setRouteError('');
      
      // Convert to expected format for callback
      const routes = {
        go: {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            coordinates: defaultRoute.outboundCoordinates
          }
        },
        ...(defaultRoute.returnCoordinates && {
          back: {
            type: 'Feature' as const,
            properties: {},
            geometry: {
              type: 'LineString' as const,
              coordinates: defaultRoute.returnCoordinates
            }
          }
        })
      };
      
      onRouteCalculated?.({
        ...defaultRoute,
        routes
      });
    }
  };

  // Create persistent map sources and layers
  const initializeMapLayers = () => {
    if (!map.current) return;

    // Add persistent route sources with empty data
    map.current.addSource('route-go', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    map.current.addSource('route-back', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection', 
        features: []
      }
    });

    // Add start and end point sources
    map.current.addSource('start-point', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    map.current.addSource('end-point', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    // Add route-go layer (green solid line)
    map.current.addLayer({
      id: 'route-go',
      type: 'line',
      source: 'route-go',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#10b981',
        'line-width': 4
      }
    });

    // Add route-back layer (blue dashed line)
    map.current.addLayer({
      id: 'route-back',
      type: 'line',
      source: 'route-back',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3b82f6',
        'line-width': 3,
        'line-dasharray': [2, 2]
      }
    });

    // Add start point layer
    map.current.addLayer({
      id: 'start-point',
      type: 'circle',
      source: 'start-point',
      paint: {
        'circle-radius': 8,
        'circle-color': '#3b82f6',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Add end point layer
    map.current.addLayer({
      id: 'end-point',
      type: 'circle',
      source: 'end-point',
      paint: {
        'circle-radius': 8,
        'circle-color': '#ef4444',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });
  };

  // Update route display using setData to eliminate flicker
  const updateRouteDisplay = () => {
    if (!map.current || !currentRoute) return;

    // Update outbound route
    const goSource = map.current.getSource('route-go') as mapboxgl.GeoJSONSource;
    if (goSource) {
      goSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: currentRoute.outboundCoordinates
        }
      });
    }

    // Update return route
    const backSource = map.current.getSource('route-back') as mapboxgl.GeoJSONSource;
    if (backSource) {
      if (currentRoute.returnCoordinates) {
        backSource.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: currentRoute.returnCoordinates
          }
        });
      } else {
        // Clear return route for one-way trips
        backSource.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    }

    // Update start point
    const startSource = map.current.getSource('start-point') as mapboxgl.GeoJSONSource;
    if (startSource) {
      startSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [currentRoute.startCoordinates.lng, currentRoute.startCoordinates.lat]
        }
      });
    }

    // Update end point
    const endSource = map.current.getSource('end-point') as mapboxgl.GeoJSONSource;
    if (endSource) {
      endSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [currentRoute.endCoordinates.lng, currentRoute.endCoordinates.lat]
        }
      });
    }

    // Fit bounds to show both routes
    const bounds = new mapboxgl.LngLatBounds();
    
    // Add outbound coordinates to bounds
    currentRoute.outboundCoordinates.forEach(coord => {
      bounds.extend([coord[0], coord[1]]);
    });
    
    // Add return coordinates to bounds if they exist
    if (currentRoute.returnCoordinates) {
      currentRoute.returnCoordinates.forEach(coord => {
        bounds.extend([coord[0], coord[1]]);
      });
    }
    
    map.current.fitBounds(bounds, { padding: 50 });
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !userLocation) return;
    if (map.current) return; // Map already initialized

    try {
      mapboxgl.accessToken = mapboxToken;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [userLocation.lng, userLocation.lat],
        zoom: 13
      });

      map.current.on('load', () => {
        console.log('Map loaded successfully');
        initializeMapLayers();
        setLoading(false);
        
        // Generate initial default route when user location is available
        if (userLocation && mapboxToken && !defaultRoute && !currentRoute) {
          generateDefaultRoute(userLocation.lat, userLocation.lng)
            .then(route => {
              if (route) {
                setDefaultRoute(route);
                setCurrentRoute(route);
                
                // Convert to expected format for callback
                const routes = {
                  go: {
                    type: 'Feature' as const,
                    properties: {},
                    geometry: {
                      type: 'LineString' as const,
                      coordinates: route.outboundCoordinates
                    }
                  },
                  ...(route.returnCoordinates && {
                    back: {
                      type: 'Feature' as const,
                      properties: {},
                      geometry: {
                        type: 'LineString' as const,
                        coordinates: route.returnCoordinates
                      }
                    }
                  })
                };
                
                onRouteCalculated?.({
                  ...route,
                  routes
                });
              }
            })
            .catch(error => {
              console.error('Error generating initial route:', error);
            });
        }
      });

      return () => {
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing map:', error);
      setLoading(false);
    }
  }, [mapboxToken, userLocation]);

  // Handle map clicks for destination selection
  useEffect(() => {
    if (map.current && canClick && userLocation) {
      const handleMapClick = async (e: mapboxgl.MapMouseEvent) => {
        const { lng, lat } = e.lngLat;
        onUserClick?.();
        
        const newRoute = await findNearestValidDestination(lat, lng, userLocation.lat, userLocation.lng);
        if (newRoute) {
          setCurrentRoute(newRoute);
          
          // Convert to expected format for callback
          const routes = {
            go: {
              type: 'Feature' as const,
              properties: {},
              geometry: {
                type: 'LineString' as const,
                coordinates: newRoute.outboundCoordinates
              }
            },
            ...(newRoute.returnCoordinates && {
              back: {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: newRoute.returnCoordinates
                }
              }
            })
          };
          
          onRouteCalculated?.({
            ...newRoute,
            routes
          });
        } else {
          // Show toast for invalid route, don't consume attempt
          toast({
            title: "Aucun itinéraire valide trouvé",
            description: "Essayez de cliquer sur un autre endroit.",
            variant: "destructive"
          });
        }
      };

      map.current.on('click', handleMapClick);

      return () => {
        map.current?.off('click', handleMapClick);
      };
    }
  }, [canClick, userLocation, onUserClick, planningData]);

  // Update route display when route changes
  useEffect(() => {
    if (currentRoute && map.current) {
      updateRouteDisplay();
    }
  }, [currentRoute]);

  if (permissionDenied) {
    return (
      <div className={`${className} flex items-center justify-center bg-muted rounded-xl`}>
        <div className="text-center p-8">
          <div className="text-4xl mb-4">📍</div>
          <h3 className="text-lg font-semibold mb-2">Géolocalisation requise</h3>
          <p className="text-muted-foreground">
            Veuillez autoriser l'accès à votre position pour utiliser la carte.
          </p>
        </div>
      </div>
    );
  }

  if (!mapboxToken || !userLocation || loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-muted rounded-xl`}>
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-full rounded-xl" />
      
      {/* Transparent overlay when attempts exhausted */}
      {!canClick && (
        <div className="absolute inset-0 bg-transparent rounded-xl pointer-events-none z-10" />
      )}
      
      {/* Route Summary */}
      {currentRoute && (
        <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg p-4 shadow-lg max-w-xs">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Distance:</span>
              <p className="font-semibold">{currentRoute.distance.toFixed(1)} km</p>
            </div>
            <div>
              <span className="text-muted-foreground">Durée:</span>
              <p className="font-semibold">{currentRoute.duration} min</p>
            </div>
            <div>
              <span className="text-muted-foreground">Calories:</span>
              <p className="font-semibold">{currentRoute.calories}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Pas:</span>
              <p className="font-semibold text-primary">{currentRoute.steps.toLocaleString()}</p>
            </div>
          </div>
          
          {planningData.tripType === 'round-trip' && (
            <div className="mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-emerald-500"></div>
                <span>Aller</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-blue-500 border-dashed border-t-2"></div>
                <span>Retour</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Route Error Message */}
      {routeError && (
        <div className="absolute bottom-4 left-4 right-4 bg-amber-50 border border-amber-200 rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">{routeError}</span>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isCalculating && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card rounded-lg p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="text-foreground font-medium">Calcul de l'itinéraire...</span>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 text-center">
        <p className="text-sm text-muted-foreground">
          {!canClick 
            ? "🔒 Limite d'essais atteinte. Utilisez 'Réinitialiser' pour restaurer l'itinéraire par défaut." 
            : "📍 Tapez sur la carte pour choisir une destination"
          }
        </p>
      </div>
    </div>
  );
};

export default EnhancedMap;