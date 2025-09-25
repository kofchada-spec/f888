import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { RotateCcw, AlertTriangle } from 'lucide-react';

interface EnhancedMapProps {
  planningData: {
    steps: string;
    pace: 'slow' | 'moderate' | 'fast';
    tripType: 'one-way' | 'round-trip';
    height: string;
    weight: string;
  };
  className?: string;
  onRouteCalculated?: (data: {
    distance: number;
    duration: number;
    calories: number;
    steps: number;
    startCoordinates: { lat: number; lng: number };
    endCoordinates: { lat: number; lng: number };
    routeGeoJSON?: any;
  }) => void;
  canClick: boolean;
  onUserClick?: () => void;
  onBack?: () => void;
}

interface RouteData {
  distance: number;
  duration: number;
  calories: number;
  steps: number;
  startCoordinates: { lat: number; lng: number };
  endCoordinates: { lat: number; lng: number };
  routeGeoJSON?: any;
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

  // Calculate steps based on distance and user data
  const calculateSteps = (distanceKm: number): number => {
    const heightCm = parseFloat(planningData.height) * 100;
    const strideLength = heightCm * 0.45; // Average stride length formula
    const distanceInCm = distanceKm * 100000;
    return Math.round(distanceInCm / strideLength);
  };

  // Calculate time based on distance and pace
  const calculateTime = (distanceKm: number): number => {
    const paceMultiplier = {
      'slow': 0.8, // 4 km/h
      'moderate': 1.0, // 5 km/h
      'fast': 1.25 // 6.25 km/h
    };
    
    const baseSpeedKmh = 5;
    const actualSpeedKmh = baseSpeedKmh * paceMultiplier[planningData.pace];
    return Math.round((distanceKm / actualSpeedKmh) * 60); // in minutes
  };

  // Calculate calories based on distance, weight and pace
  const calculateCalories = (distanceKm: number, timeMinutes: number): number => {
    const weight = parseFloat(planningData.weight);
    const paceMultiplier = {
      'slow': 0.8,
      'moderate': 1.0,
      'fast': 1.2
    };
    
    // MET values for walking at different paces
    const met = 3.5 * paceMultiplier[planningData.pace];
    return Math.round((met * weight * (timeMinutes / 60)));
  };

  // Check if route is within ±5% tolerance of target steps
  const isWithinTolerance = (actualSteps: number, targetSteps: number): boolean => {
    const tolerance = targetSteps * 0.05;
    return Math.abs(actualSteps - targetSteps) <= tolerance;
  };

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

  // Generate optimal route within step tolerance at startup
  const generateDefaultRoute = async (startLat: number, startLng: number): Promise<RouteData | null> => {
    const targetSteps = parseInt(planningData.steps);
    const heightCm = parseFloat(planningData.height) * 100;
    const strideLength = heightCm * 0.45;
    const targetDistanceKm = (targetSteps * strideLength) / 100000;
    
    if (planningData.tripType === 'round-trip') {
      // For round-trip, target distance is half since we go out and back
      const oneWayDistance = targetDistanceKm / 2;
      
      // Try multiple bearings to find valid routes
      for (let bearing = 0; bearing < 360; bearing += 30) {
        const endPoint = calculateDestination(startLat, startLng, oneWayDistance, bearing);
        
        try {
          const outboundRoute = await computeRoute(startLat, startLng, endPoint.lat, endPoint.lng);
          const returnRoute = await computeRoute(endPoint.lat, endPoint.lng, startLat, startLng);
          
          if (outboundRoute && returnRoute) {
            const totalDistance = (outboundRoute.distance + returnRoute.distance) / 1000;
            const totalSteps = calculateSteps(totalDistance);
            
            if (isWithinTolerance(totalSteps, targetSteps)) {
              return {
                distance: totalDistance,
                duration: calculateTime(totalDistance),
                calories: calculateCalories(totalDistance, calculateTime(totalDistance)),
                steps: totalSteps,
                startCoordinates: { lat: startLat, lng: startLng },
                endCoordinates: endPoint,
                routeGeoJSON: {
                  outbound: outboundRoute.geometry,
                  return: returnRoute.geometry
                }
              };
            }
          }
        } catch (error) {
          continue;
        }
      }
    } else {
      // One-way route
      for (let bearing = 0; bearing < 360; bearing += 30) {
        const endPoint = calculateDestination(startLat, startLng, targetDistanceKm, bearing);
        
        try {
          const route = await computeRoute(startLat, startLng, endPoint.lat, endPoint.lng);
          
          if (route) {
            const distanceKm = route.distance / 1000;
            const calculatedSteps = calculateSteps(distanceKm);
            
            if (isWithinTolerance(calculatedSteps, targetSteps)) {
              return {
                distance: distanceKm,
                duration: calculateTime(distanceKm),
                calories: calculateCalories(distanceKm, calculateTime(distanceKm)),
                steps: calculatedSteps,
                startCoordinates: { lat: startLat, lng: startLng },
                endCoordinates: endPoint,
                routeGeoJSON: route.geometry
              };
            }
          }
        } catch (error) {
          continue;
        }
      }
    }
    
    return null;
  };

  // Calculate destination point given start, distance and bearing
  const calculateDestination = (startLat: number, startLng: number, distanceKm: number, bearing: number) => {
    const R = 6371; // Earth's radius in km
    const lat1 = (startLat * Math.PI) / 180;
    const lng1 = (startLng * Math.PI) / 180;
    const bearingRad = (bearing * Math.PI) / 180;
    
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(distanceKm / R) +
      Math.cos(lat1) * Math.sin(distanceKm / R) * Math.cos(bearingRad)
    );
    
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearingRad) * Math.sin(distanceKm / R) * Math.cos(lat1),
      Math.cos(distanceKm / R) - Math.sin(lat1) * Math.sin(lat2)
    );
    
    return {
      lat: (lat2 * 180) / Math.PI,
      lng: (lng2 * 180) / Math.PI
    };
  };

  // Compute route using Mapbox Directions API
  const computeRoute = async (startLat: number, startLng: number, endLat: number, endLng: number) => {
    if (!mapboxToken) return null;

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${startLng},${startLat};${endLng},${endLat}?steps=true&geometries=geojson&access_token=${mapboxToken}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        return data.routes[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error computing route:', error);
      return null;
    }
  };

  // Find nearest valid destination that meets step target
  const findNearestValidDestination = async (clickedLat: number, clickedLng: number, startLat: number, startLng: number): Promise<RouteData | null> => {
    const targetSteps = parseInt(planningData.steps);
    setIsCalculating(true);
    setRouteError('');
    
    // First try the exact clicked location
    try {
      let route, totalSteps, totalDistance;
      
      if (planningData.tripType === 'round-trip') {
        const outboundRoute = await computeRoute(startLat, startLng, clickedLat, clickedLng);
        const returnRoute = await computeRoute(clickedLat, clickedLng, startLat, startLng);
        
        if (outboundRoute && returnRoute) {
          totalDistance = (outboundRoute.distance + returnRoute.distance) / 1000;
          totalSteps = calculateSteps(totalDistance);
          
          if (isWithinTolerance(totalSteps, targetSteps)) {
            setIsCalculating(false);
            return {
              distance: totalDistance,
              duration: calculateTime(totalDistance),
              calories: calculateCalories(totalDistance, calculateTime(totalDistance)),
              steps: totalSteps,
              startCoordinates: { lat: startLat, lng: startLng },
              endCoordinates: { lat: clickedLat, lng: clickedLng },
              routeGeoJSON: {
                outbound: outboundRoute.geometry,
                return: returnRoute.geometry
              }
            };
          }
        }
      } else {
        route = await computeRoute(startLat, startLng, clickedLat, clickedLng);
        
        if (route) {
          totalDistance = route.distance / 1000;
          totalSteps = calculateSteps(totalDistance);
          
          if (isWithinTolerance(totalSteps, targetSteps)) {
            setIsCalculating(false);
            return {
              distance: totalDistance,
              duration: calculateTime(totalDistance),
              calories: calculateCalories(totalDistance, calculateTime(totalDistance)),
              steps: totalSteps,
              startCoordinates: { lat: startLat, lng: startLng },
              endCoordinates: { lat: clickedLat, lng: clickedLng },
              routeGeoJSON: route.geometry
            };
          }
        }
      }
      
      // If clicked location doesn't work, try to find nearest valid point
      const heightCm = parseFloat(planningData.height) * 100;
      const strideLength = heightCm * 0.45;
      let targetDistanceKm = (targetSteps * strideLength) / 100000;
      
      if (planningData.tripType === 'round-trip') {
        targetDistanceKm = targetDistanceKm / 2; // Half distance for round-trip
      }
      
      // Calculate bearing from start to clicked point
      const bearing = Math.atan2(
        clickedLng - startLng,
        clickedLat - startLat
      ) * 180 / Math.PI;
      
      // Try adjusting the destination along the same bearing
      for (let factor of [0.8, 0.9, 1.1, 1.2, 0.7, 1.3]) {
        const adjustedDistance = targetDistanceKm * factor;
        const adjustedDestination = calculateDestination(startLat, startLng, adjustedDistance, bearing);
        
        try {
          if (planningData.tripType === 'round-trip') {
            const outboundRoute = await computeRoute(startLat, startLng, adjustedDestination.lat, adjustedDestination.lng);
            const returnRoute = await computeRoute(adjustedDestination.lat, adjustedDestination.lng, startLat, startLng);
            
            if (outboundRoute && returnRoute) {
              totalDistance = (outboundRoute.distance + returnRoute.distance) / 1000;
              totalSteps = calculateSteps(totalDistance);
              
              if (isWithinTolerance(totalSteps, targetSteps)) {
                setIsCalculating(false);
                setRouteError('No direct route found — auto-adjusting to the nearest target.');
                return {
                  distance: totalDistance,
                  duration: calculateTime(totalDistance),
                  calories: calculateCalories(totalDistance, calculateTime(totalDistance)),
                  steps: totalSteps,
                  startCoordinates: { lat: startLat, lng: startLng },
                  endCoordinates: adjustedDestination,
                  routeGeoJSON: {
                    outbound: outboundRoute.geometry,
                    return: returnRoute.geometry
                  }
                };
              }
            }
          } else {
            route = await computeRoute(startLat, startLng, adjustedDestination.lat, adjustedDestination.lng);
            
            if (route) {
              totalDistance = route.distance / 1000;
              totalSteps = calculateSteps(totalDistance);
              
              if (isWithinTolerance(totalSteps, targetSteps)) {
                setIsCalculating(false);
                setRouteError('No direct route found — auto-adjusting to the nearest target.');
                return {
                  distance: totalDistance,
                  duration: calculateTime(totalDistance),
                  calories: calculateCalories(totalDistance, calculateTime(totalDistance)),
                  steps: totalSteps,
                  startCoordinates: { lat: startLat, lng: startLng },
                  endCoordinates: adjustedDestination,
                  routeGeoJSON: route.geometry
                };
              }
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
    setRouteError('No direct route found — auto-adjusting to the nearest target.');
    return null;
  };

  // Reset to default route
  const resetToDefault = () => {
    if (defaultRoute) {
      setCurrentRoute(defaultRoute);
      setRouteError('');
      onRouteCalculated?.(defaultRoute);
    }
  };

  // Update route display on map
  const updateRouteDisplay = () => {
    if (!map.current || !currentRoute) return;

    // Remove existing layers and sources
    ['route', 'outbound-route', 'return-route', 'start-point', 'end-point'].forEach(id => {
      if (map.current?.getLayer(id)) {
        map.current.removeLayer(id);
      }
      if (map.current?.getSource(id)) {
        map.current.removeSource(id);
      }
    });

    // Handle round-trip routes
    if (planningData.tripType === 'round-trip' && currentRoute.routeGeoJSON?.outbound && currentRoute.routeGeoJSON?.return) {
      // Add outbound route (solid green)
      map.current.addSource('outbound-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: currentRoute.routeGeoJSON.outbound
        }
      });

      map.current.addLayer({
        id: 'outbound-route',
        type: 'line',
        source: 'outbound-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#10b981',
          'line-width': 4
        }
      });

      // Add return route (dashed blue)
      map.current.addSource('return-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: currentRoute.routeGeoJSON.return
        }
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
          'line-width': 4,
          'line-dasharray': [2, 2]
        }
      });
    } else if (currentRoute.routeGeoJSON) {
      // Add single route line
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: currentRoute.routeGeoJSON
        }
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
          'line-color': '#10b981',
          'line-width': 4
        }
      });
    }

    // Add start point
    map.current.addSource('start-point', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [currentRoute.startCoordinates.lng, currentRoute.startCoordinates.lat]
        }
      }
    });

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

    // Add end point
    map.current.addSource('end-point', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [currentRoute.endCoordinates.lng, currentRoute.endCoordinates.lat]
        }
      }
    });

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
        setLoading(false);
        
        // Generate initial default route when user location is available
        if (userLocation && mapboxToken && !defaultRoute && !currentRoute) {
          generateDefaultRoute(userLocation.lat, userLocation.lng)
            .then(route => {
              if (route) {
                setDefaultRoute(route);
                setCurrentRoute(route);
                onRouteCalculated?.(route);
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
    // Handle map clicks for destination selection
    if (map.current && canClick && userLocation) {
      const handleMapClick = async (e: mapboxgl.MapMouseEvent) => {
        const { lng, lat } = e.lngLat;
        onUserClick?.();
        
        const newRoute = await findNearestValidDestination(lat, lng, userLocation.lat, userLocation.lng);
        if (newRoute) {
          setCurrentRoute(newRoute);
          onRouteCalculated?.(newRoute);
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