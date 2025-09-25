import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Zap, RotateCcw } from 'lucide-react';

interface EnhancedMapProps {
  planningData: {
    steps: string;
    pace: 'slow' | 'moderate' | 'fast';
    tripType: 'one-way' | 'round-trip';
    height: string;
    weight: string;
  };
  onBack?: () => void;
  className?: string;
  canClick?: boolean;
  onUserClick?: () => void;
  onRouteCalculated?: (routeData: {
    distance: number;
    duration: number;
    calories: number;
    steps: number;
    startCoordinates: { lat: number; lng: number };
    endCoordinates: { lat: number; lng: number };
    routeGeoJSON?: any;
  }) => void;
}

interface RouteData {
  distance: number; // in km
  duration: number; // in minutes
  calories: number;
  steps: number;
  coordinates: number[][]; // [lng, lat] pairs
  outboundCoordinates?: number[][]; // For round-trip: outbound path
  returnCoordinates?: number[][]; // For round-trip: return path
}

const EnhancedMap: React.FC<EnhancedMapProps> = ({ 
  planningData, 
  className = '', 
  canClick = true, 
  onUserClick, 
  onRouteCalculated 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);
  
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [defaultRouteData, setDefaultRouteData] = useState<{ route: RouteData; destination: { lat: number; lng: number } } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showWarningMessage, setShowWarningMessage] = useState<string | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Calculate steps based on distance and user data
  const calculateSteps = useCallback((distanceKm: number) => {
    const heightM = parseFloat(planningData.height);
    const strideM = heightM ? 0.415 * heightM : 0.72;
    const distanceM = distanceKm * 1000;
    return Math.round(distanceM / strideM);
  }, [planningData.height]);

  // Calculate time based on distance and pace
  const calculateTime = useCallback((distanceKm: number) => {
    const speedKmh = {
      slow: 4,
      moderate: 5,
      fast: 6
    }[planningData.pace];
    return Math.round((distanceKm / speedKmh) * 60);
  }, [planningData.pace]);

  // Calculate calories based on distance and user data
  const calculateCalories = useCallback((distanceKm: number) => {
    const weightKg = parseFloat(planningData.weight) || 70;
    const calorieCoefficients = {
      slow: 0.35,
      moderate: 0.50,
      fast: 0.70
    };
    const coefficient = calorieCoefficients[planningData.pace];
    return Math.round(distanceKm * weightKg * coefficient);
  }, [planningData.weight, planningData.pace]);

  // Validate route against step target with ±5% tolerance
  const validateRouteSteps = useCallback((route: RouteData, targetSteps: number) => {
    const tolerance = 0.05; // 5% tolerance
    const minAcceptableSteps = targetSteps * (1 - tolerance);
    const maxAcceptableSteps = targetSteps * (1 + tolerance);
    
    return route.steps >= minAcceptableSteps && route.steps <= maxAcceptableSteps;
  }, []);

  // Get Mapbox token
  useEffect(() => {
    const getMapboxToken = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('mapbox-token');
        
        if (error) throw error;
        if (data?.token && typeof data.token === 'string' && data.token.startsWith('pk.')) {
          console.log('Mapbox token loaded successfully');
          setMapboxToken(data.token);
        } else {
          throw new Error('Invalid token received');
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
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
            console.log('User location obtained:', position.coords);
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => {
            console.error('Geolocation error:', error);
            setPermissionDenied(true);
            setUserLocation({ lat: 48.8566, lng: 2.3522 }); // Default to Paris
          }
        );
      }
    };

    getUserLocation();
  }, []);

  // Compute route using Mapbox Directions API
  const computeRoute = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }): Promise<RouteData | null> => {
    if (!mapboxToken) return null;

    try {
      const profile = 'walking';
      
      if (planningData.tripType === 'round-trip') {
        // For round-trip, calculate outbound route then return route
        const outboundCoords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
        const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${outboundCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
        const outboundResponse = await fetch(outboundUrl);
        const outboundData = await outboundResponse.json();
        
        if (outboundData.routes && outboundData.routes.length > 0) {
          const outboundRoute = outboundData.routes[0];
          
          // Calculate return route (can be same path for simplicity)
          const returnCoords = `${end.lng},${end.lat};${start.lng},${start.lat}`;
          const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${returnCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
          const returnResponse = await fetch(returnUrl);
          const returnData = await returnResponse.json();
          
          if (returnData.routes && returnData.routes.length > 0) {
            const returnRoute = returnData.routes[0];
            const totalDistanceKm = (outboundRoute.distance + returnRoute.distance) / 1000;
            const steps = calculateSteps(totalDistanceKm);
            const durationMin = calculateTime(totalDistanceKm);
            const calories = calculateCalories(totalDistanceKm);

            return {
              distance: totalDistanceKm,
              duration: durationMin,
              calories,
              steps,
              coordinates: [...outboundRoute.geometry.coordinates, ...returnRoute.geometry.coordinates],
              outboundCoordinates: outboundRoute.geometry.coordinates,
              returnCoordinates: returnRoute.geometry.coordinates
            };
          }
        }
      } else {
        // One-way route
        const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
        const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?access_token=${mapboxToken}&geometries=geojson&overview=full`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distanceKm = route.distance / 1000;
          const steps = calculateSteps(distanceKm);
          const durationMin = calculateTime(distanceKm);
          const calories = calculateCalories(distanceKm);

          return {
            distance: distanceKm,
            duration: durationMin,
            calories,
            steps,
            coordinates: route.geometry.coordinates
          };
        }
      }
    } catch (error) {
      console.error('Error computing route:', error);
    }
    return null;
  }, [mapboxToken, planningData.tripType, calculateSteps, calculateTime, calculateCalories]);

  // Generate optimal route that meets step target within ±5%
  const generateOptimalRoute = useCallback(async (userLoc: { lat: number; lng: number }): Promise<{ route: RouteData; destination: { lat: number; lng: number } } | null> => {
    if (!mapboxToken) return null;

    const targetSteps = parseInt(planningData.steps);
    const heightM = parseFloat(planningData.height);
    const strideM = heightM ? 0.415 * heightM : 0.72;
    const targetDistanceKm = (targetSteps * strideM) / 1000;

    // Try different directions to find optimal route
    const bearings = [45, 90, 135, 180, 225, 270, 315, 0];
    const distanceMultipliers = [0.9, 1.0, 1.1, 0.8, 1.2];

    let bestRoute = null;
    let bestScore = Infinity;
    let bestDestination = null;

    for (const bearing of bearings) {
      for (const multiplier of distanceMultipliers) {
        try {
          const testRadius = planningData.tripType === 'round-trip' ? 
            (targetDistanceKm / 2.2) * multiplier :
            targetDistanceKm * multiplier * 0.9;

          const bearingRad = (bearing * Math.PI) / 180;
          const earthRadiusKm = 6371;
          const userLatRad = (userLoc.lat * Math.PI) / 180;
          const userLngRad = (userLoc.lng * Math.PI) / 180;

          const destLatRad = Math.asin(
            Math.sin(userLatRad) * Math.cos(testRadius / earthRadiusKm) +
            Math.cos(userLatRad) * Math.sin(testRadius / earthRadiusKm) * Math.cos(bearingRad)
          );

          const destLngRad = userLngRad + Math.atan2(
            Math.sin(bearingRad) * Math.sin(testRadius / earthRadiusKm) * Math.cos(userLatRad),
            Math.cos(testRadius / earthRadiusKm) - Math.sin(userLatRad) * Math.sin(destLatRad)
          );

          const testDestination = {
            lat: (destLatRad * 180) / Math.PI,
            lng: (destLngRad * 180) / Math.PI
          };

          const testRoute = await computeRoute(userLoc, testDestination);
          
          if (testRoute && validateRouteSteps(testRoute, targetSteps)) {
            const stepDeviation = Math.abs(testRoute.steps - targetSteps) / targetSteps;
            
            if (stepDeviation < bestScore) {
              bestScore = stepDeviation;
              bestRoute = testRoute;
              bestDestination = testDestination;
              
              // If we found a very good match, stop searching
              if (stepDeviation < 0.01) break;
            }
          }
        } catch (error) {
          continue;
        }
      }
      if (bestScore < 0.01) break; // Good enough, stop searching
    }

    if (bestRoute && bestDestination) {
      console.log(`Generated default route: ${bestRoute.steps} steps (target: ${targetSteps})`);
      return { route: bestRoute, destination: bestDestination };
    }

    console.warn(`No valid default route found within ±5% tolerance. Target: ${targetSteps} steps`);
    return null;
  }, [mapboxToken, planningData, computeRoute, validateRouteSteps]);

  // Adjust clicked route to meet step requirements
  const adjustRouteForSteps = useCallback(async (start: { lat: number; lng: number }, clickedEnd: { lat: number; lng: number }): Promise<{ route: RouteData; destination: { lat: number; lng: number } } | null> => {
    const targetSteps = parseInt(planningData.steps);
    
    // First try the exact clicked route
    const initialRoute = await computeRoute(start, clickedEnd);
    if (initialRoute && validateRouteSteps(initialRoute, targetSteps)) {
      return { route: initialRoute, destination: clickedEnd };
    }
    
    // If not valid, try adjusting the destination slightly
    const adjustmentDistances = [0.1, 0.2, 0.3]; // km adjustments
    const bearings = [0, 45, 90, 135, 180, 225, 270, 315];
    
    for (const distance of adjustmentDistances) {
      for (const bearing of bearings) {
        try {
          const bearingRad = (bearing * Math.PI) / 180;
          const earthRadiusKm = 6371;
          
          const adjustedLatRad = Math.asin(
            Math.sin((clickedEnd.lat * Math.PI) / 180) * Math.cos(distance / earthRadiusKm) +
            Math.cos((clickedEnd.lat * Math.PI) / 180) * Math.sin(distance / earthRadiusKm) * Math.cos(bearingRad)
          );
          
          const adjustedLngRad = (clickedEnd.lng * Math.PI) / 180 + Math.atan2(
            Math.sin(bearingRad) * Math.sin(distance / earthRadiusKm) * Math.cos((clickedEnd.lat * Math.PI) / 180),
            Math.cos(distance / earthRadiusKm) - Math.sin((clickedEnd.lat * Math.PI) / 180) * Math.sin(adjustedLatRad)
          );
          
          const adjustedDestination = {
            lat: (adjustedLatRad * 180) / Math.PI,
            lng: (adjustedLngRad * 180) / Math.PI
          };
          
          const adjustedRoute = await computeRoute(start, adjustedDestination);
          
          if (adjustedRoute && validateRouteSteps(adjustedRoute, targetSteps)) {
            return { route: adjustedRoute, destination: adjustedDestination };
          }
        } catch (error) {
          continue;
        }
      }
    }
    
    return null;
  }, [computeRoute, validateRouteSteps, planningData.steps]);

  // Reset to default route
  const resetToDefault = useCallback(() => {
    if (defaultRouteData) {
      setDestinationLocation(defaultRouteData.destination);
      setRouteData(defaultRouteData.route);
      setShowWarningMessage(null);
      
      if (onRouteCalculated) {
        const simpleRouteData = {
          distance: defaultRouteData.route.distance,
          duration: defaultRouteData.route.duration,
          calories: defaultRouteData.route.calories,
          steps: defaultRouteData.route.steps,
          startCoordinates: userLocation!,
          endCoordinates: defaultRouteData.destination,
          routeGeoJSON: {
            type: 'LineString',
            coordinates: defaultRouteData.route.coordinates,
            outboundCoordinates: defaultRouteData.route.outboundCoordinates,
            returnCoordinates: defaultRouteData.route.returnCoordinates
          }
        };
        onRouteCalculated(simpleRouteData);
      }
    }
  }, [defaultRouteData, userLocation, onRouteCalculated]);

  // Update route display on map
  const updateRouteDisplay = useCallback((route: RouteData, destination: { lat: number; lng: number }) => {
    if (!map.current || !userLocation || !mapInitialized) return;

    // Remove existing markers
    if (userMarker.current) {
      userMarker.current.remove();
    }
    if (destinationMarker.current) {
      destinationMarker.current.remove();
    }

    // Add user marker
    userMarker.current = new mapboxgl.Marker({ color: '#10b981' })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);

    // Add destination marker
    destinationMarker.current = new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat([destination.lng, destination.lat])
      .addTo(map.current);

    // Add route to map
    const routeGeojson = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: route.coordinates
      }
    };

    // Remove existing route source and layer
    if (map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    // Add new route
    map.current.addSource('route', {
      type: 'geojson',
      data: routeGeojson
    });

    map.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': planningData.tripType === 'round-trip' ? '#10b981' : '#3b82f6',
        'line-width': 4,
        'line-opacity': 0.8
      }
    });

    // For round-trip, add return route
    if (planningData.tripType === 'round-trip' && route.returnCoordinates) {
      const returnGeojson = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: route.returnCoordinates
        }
      };

      if (map.current.getSource('return-route')) {
        map.current.removeLayer('return-route');
        map.current.removeSource('return-route');
      }

      map.current.addSource('return-route', {
        type: 'geojson',
        data: returnGeojson
      });

      map.current.addLayer({
        id: 'return-route',
        type: 'line',
        source: 'return-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-opacity': 0.6,
          'line-dasharray': [2, 2]
        }
      });
    }

    // Fit map to route bounds
    const bounds = new mapboxgl.LngLatBounds();
    route.coordinates.forEach((coord: number[]) => bounds.extend(coord as [number, number]));
    map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
  }, [userLocation, planningData.tripType, mapInitialized]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !userLocation) {
      console.log('Map initialization waiting for:', { 
        container: !!mapContainer.current, 
        token: !!mapboxToken,
        userLocation: !!userLocation
      });
      return;
    }

    if (mapInitialized) {
      console.log('Map already initialized, skipping');
      return;
    }

    console.log('Initializing Mapbox map...');
    
    try {
      mapboxgl.accessToken = mapboxToken;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [userLocation.lng, userLocation.lat],
        zoom: 13,
        preserveDrawingBuffer: true
      });

      map.current.on('load', () => {
        console.log('Map loaded successfully');
        setMapInitialized(true);
        
        // Trigger map resize to ensure proper rendering
        setTimeout(() => {
          if (map.current) {
            map.current.resize();
          }
        }, 100);
        
        // Generate default route after map loads
        if (!defaultRouteData) {
          setIsLoading(true);
          generateOptimalRoute(userLocation).then((result) => {
            if (result) {
              setDefaultRouteData(result);
              setDestinationLocation(result.destination);
              setRouteData(result.route);
              updateRouteDisplay(result.route, result.destination);
              
              if (onRouteCalculated) {
                const simpleRouteData = {
                  distance: result.route.distance,
                  duration: result.route.duration,
                  calories: result.route.calories,
                  steps: result.route.steps,
                  startCoordinates: userLocation,
                  endCoordinates: result.destination,
                  routeGeoJSON: {
                    type: 'LineString',
                    coordinates: result.route.coordinates,
                    outboundCoordinates: result.route.outboundCoordinates,
                    returnCoordinates: result.route.returnCoordinates
                  }
                };
                onRouteCalculated(simpleRouteData);
              }
            }
            setIsLoading(false);
          }).catch((error) => {
            console.error('Error generating default route:', error);
            setIsLoading(false);
          });
        }
      });

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e.error);
        setMapInitialized(false);
      });

      map.current.on('styledata', () => {
        if (map.current && map.current.isStyleLoaded()) {
          map.current.resize();
        }
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );
      
    } catch (error) {
      console.error('Error initializing map:', error);
      setMapInitialized(false);
    }

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken, userLocation]);

  // Handle map clicks for destination selection
  useEffect(() => {
    if (!map.current || !mapInitialized || !userLocation) return;

    const handleMapClick = async (e: any) => {
      if (!canClick || isLoading) return;

      const clickedDestination = {
        lat: e.lngLat.lat,
        lng: e.lngLat.lng
      };
      
      setIsLoading(true);
      setShowWarningMessage(null);
      
      try {
        const adjustedResult = await adjustRouteForSteps(userLocation, clickedDestination);
        
        if (adjustedResult) {
          // Valid route found - trigger user click callback
          if (onUserClick) {
            onUserClick();
          }
          
          setDestinationLocation(adjustedResult.destination);
          setRouteData(adjustedResult.route);
          
          if (onRouteCalculated) {
            const simpleRouteData = {
              distance: adjustedResult.route.distance,
              duration: adjustedResult.route.duration,
              calories: adjustedResult.route.calories,
              steps: adjustedResult.route.steps,
              startCoordinates: userLocation,
              endCoordinates: adjustedResult.destination,
              routeGeoJSON: {
                type: 'LineString',
                coordinates: adjustedResult.route.coordinates,
                outboundCoordinates: adjustedResult.route.outboundCoordinates,
                returnCoordinates: adjustedResult.route.returnCoordinates
              }
            };
            onRouteCalculated(simpleRouteData);
          }
        } else {
          // No valid route found within tolerance
          setShowWarningMessage('Aucun itinéraire trouvé dans la tolérance de ±5%. Essayez un autre point.');
          setTimeout(() => setShowWarningMessage(null), 4000);
        }
      } catch (error) {
        console.error('Error calculating route:', error);
        setShowWarningMessage('Erreur lors du calcul de l\'itinéraire. Veuillez réessayer.');
        setTimeout(() => setShowWarningMessage(null), 4000);
      }
      
      setIsLoading(false);
    };

    map.current.on('click', handleMapClick);

    return () => {
      if (map.current) {
        map.current.off('click', handleMapClick);
      }
    };
  }, [mapInitialized, canClick, isLoading, userLocation, onUserClick, onRouteCalculated, adjustRouteForSteps]);

  // Update route display when data changes
  useEffect(() => {
    if (routeData && destinationLocation && map.current && mapInitialized) {
      updateRouteDisplay(routeData, destinationLocation);
    }
  }, [routeData, destinationLocation, updateRouteDisplay, mapInitialized]);

  if (permissionDenied) {
    return (
      <div className={`${className} min-h-[500px] bg-muted rounded-2xl flex items-center justify-center`}>
        <div className="text-center p-8">
          <div className="text-4xl mb-4">📍</div>
          <h3 className="text-lg font-semibold mb-2">Géolocalisation requise</h3>
          <p className="text-muted-foreground mb-4">
            Veuillez autoriser l'accès à votre position pour planifier votre marche.
          </p>
        </div>
      </div>
    );
  }

  if (!mapboxToken || !userLocation) {
    return (
      <div className={`${className} min-h-[500px] bg-muted rounded-2xl flex items-center justify-center`}>
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-[500px] rounded-2xl shadow-lg" style={{ minHeight: '500px' }} />
      
      {!mapInitialized && mapboxToken && userLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm rounded-2xl">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Initialisation de la carte...</p>
          </div>
        </div>
      )}
      
      {/* Route summary */}
      {routeData && (
        <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-4 shadow-lg max-w-xs">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-primary" />
            Itinéraire planifié
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                📏
              </div>
              <div>
                <div className="font-medium text-blue-600">{routeData.distance.toFixed(1)} km</div>
                <div className="text-muted-foreground">Distance</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                ⏱️
              </div>
              <div>
                <div className="font-medium text-orange-600">{routeData.duration} min</div>
                <div className="text-muted-foreground">Durée</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">
                🔥
              </div>
              <div>
                <div className="font-medium text-red-600">{routeData.calories}</div>
                <div className="text-muted-foreground">Calories</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                👣
              </div>
              <div>
                <div className="font-medium text-green-600">{routeData.steps}</div>
                <div className="text-muted-foreground">Pas</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Calcul de l'itinéraire...</p>
          </div>
        </div>
      )}

      {/* Warning message */}
      {showWarningMessage && (
        <div className="absolute top-20 left-4 right-4 bg-yellow-100 border-l-4 border-yellow-500 p-3 rounded shadow-lg">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-600 text-sm font-medium">⚠️</span>
            <p className="text-yellow-700 text-sm">{showWarningMessage}</p>
          </div>
        </div>
      )}

      {/* Reset button */}
      {defaultRouteData && routeData && routeData !== defaultRouteData.route && (
        <div className="absolute bottom-20 right-4">
          <Button
            onClick={resetToDefault}
            variant="outline"
            size="sm"
            className="bg-card/95 backdrop-blur-sm shadow-lg"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Réinitialiser
          </Button>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 right-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 text-center">
        <p className="text-sm text-muted-foreground">
          {!canClick 
            ? "🔒 Limite d'essais atteinte. Utilisez 'Réinitialiser' pour restaurer." 
            : "📍 Tapez sur la carte pour choisir une destination (dans ±5% de votre objectif)"
          }
        </p>
      </div>
    </div>
  );
};

export default EnhancedMap;