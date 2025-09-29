import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Zap } from 'lucide-react';

interface SimpleMapProps {
  planningData: {
    steps: string;
    pace: 'slow' | 'moderate' | 'fast';
    tripType: 'one-way' | 'round-trip';
    height: string;
    weight: string;
  };
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

const SimpleMap: React.FC<SimpleMapProps> = ({ 
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
  const [currentRoute, setCurrentRoute] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const calculateSteps = useCallback((distanceKm: number) => {
    try {
      const heightM = Math.max(1.2, Math.min(2.5, parseFloat(planningData.height) || 1.70));
      const strideM = 0.415 * heightM;
      return Math.round((Math.max(0.1, distanceKm) * 1000) / strideM);
    } catch (error) {
      console.error('Error calculating steps:', error);
      return 5000; // Fallback value
    }
  }, [planningData.height]);

  // Calculate time from distance
  const calculateTime = useCallback((distanceKm: number) => {
    try {
      const speeds = { slow: 4, moderate: 5, fast: 6 };
      const validPace = ['slow', 'moderate', 'fast'].includes(planningData.pace) ? planningData.pace : 'moderate';
      return Math.round((Math.max(0.1, distanceKm) / speeds[validPace]) * 60);
    } catch (error) {
      console.error('Error calculating time:', error);
      return 30; // Fallback: 30 minutes
    }
  }, [planningData.pace]);

  // Calculate calories from distance
  const calculateCalories = useCallback((distanceKm: number) => {
    try {
      const weightKg = Math.max(40, Math.min(200, parseFloat(planningData.weight) || 70));
      const coefficients = { slow: 0.35, moderate: 0.50, fast: 0.70 };
      const validPace = ['slow', 'moderate', 'fast'].includes(planningData.pace) ? planningData.pace : 'moderate';
      return Math.round(Math.max(0.1, distanceKm) * weightKg * coefficients[validPace]);
    } catch (error) {
      console.error('Error calculating calories:', error);
      return 100; // Fallback value
    }
  }, [planningData.weight, planningData.pace]);

  // Get Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('mapbox-token');
        
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
      }
    };
    fetchToken();
  }, []);

  // Get user location
  useEffect(() => {
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
          // Fallback to Toulouse
          setUserLocation({ lat: 43.6047, lng: 1.4442 });
        }
      );
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !userLocation || mapReady) return;

    console.log('Initializing map...');
    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [userLocation.lng, userLocation.lat],
      zoom: 14
    });

    map.current.on('load', () => {
      console.log('Map loaded successfully');
      setMapReady(true);
      
      // Add user marker immediately
      if (userMarker.current) userMarker.current.remove();
      userMarker.current = new mapboxgl.Marker({ color: '#10b981' })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map.current!);

      // Generate default route
      generateDefaultRoute();
    });

    // Handle map clicks
    map.current.on('click', handleMapClick);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken, userLocation]);

  // Generate a default route
  const generateDefaultRoute = useCallback(async () => {
    if (!userLocation || !mapboxToken) return;

    console.log('Generating default route...');
    setIsLoading(true);

    try {
      const targetSteps = parseInt(planningData.steps);
      const heightM = parseFloat(planningData.height);
      const strideM = heightM ? 0.415 * heightM : 0.72;
      const targetDistanceKm = (targetSteps * strideM) / 1000;

      // For round-trip, we need half the distance for outbound
      const searchRadius = planningData.tripType === 'round-trip' ? 
        targetDistanceKm / 2.5 : // A bit less than half to account for routing
        targetDistanceKm * 0.9;

      // Try a simple bearing (northeast)
      const bearing = 45; // degrees
      const bearingRad = (bearing * Math.PI) / 180;
      const earthRadiusKm = 6371;
      
      const userLatRad = (userLocation.lat * Math.PI) / 180;
      const userLngRad = (userLocation.lng * Math.PI) / 180;

      const destLatRad = Math.asin(
        Math.sin(userLatRad) * Math.cos(searchRadius / earthRadiusKm) +
        Math.cos(userLatRad) * Math.sin(searchRadius / earthRadiusKm) * Math.cos(bearingRad)
      );

      const destLngRad = userLngRad + Math.atan2(
        Math.sin(bearingRad) * Math.sin(searchRadius / earthRadiusKm) * Math.cos(userLatRad),
        Math.cos(searchRadius / earthRadiusKm) - Math.sin(userLatRad) * Math.sin(destLatRad)
      );

      const destination = {
        lat: (destLatRad * 180) / Math.PI,
        lng: (destLngRad * 180) / Math.PI
      };

      const route = await calculateRoute(userLocation, destination);
      
      if (route) {
        displayRoute(route, destination);
        console.log(`Default route generated: ${route.steps} steps (target: ${targetSteps})`);
      } else {
        // Generate a simple fallback route if calculation fails
        const fallbackDestination = {
          lat: userLocation.lat + 0.01,
          lng: userLocation.lng + 0.01
        };
        const fallbackRoute = await calculateRoute(userLocation, fallbackDestination);
        if (fallbackRoute) {
          displayRoute(fallbackRoute, fallbackDestination);
        }
      }
    } catch (error) {
      console.error('Error generating default route:', error);
      // Create minimal fallback route
      const targetSteps = parseInt(planningData.steps);
      setCurrentRoute({
        distance: 1.0,
        steps: targetSteps,
        duration: 15,
        calories: 50,
        coordinates: [[userLocation.lng, userLocation.lat]]
      });
    }
    
    setIsLoading(false);
  }, [userLocation, mapboxToken, planningData]);

  // Calculate route using Mapbox API
  const calculateRoute = async (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    if (!mapboxToken) return null;

    try {
      const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?access_token=${mapboxToken}&geometries=geojson&overview=full`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        let totalDistance = route.distance / 1000; // Convert to km

        // For round-trip, double the distance
        if (planningData.tripType === 'round-trip') {
          totalDistance *= 2;
        }

        return {
          distance: totalDistance,
          steps: calculateSteps(totalDistance),
          duration: calculateTime(totalDistance),
          calories: calculateCalories(totalDistance),
          coordinates: route.geometry.coordinates
        };
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    }
    return null;
  };

  // Display route on map
  const displayRoute = (route: any, destination: { lat: number; lng: number }) => {
    if (!map.current || !mapReady) return;

    console.log('Displaying route on map...');

    // Remove existing destination marker
    if (destinationMarker.current) {
      destinationMarker.current.remove();
    }

    // Add destination marker
    destinationMarker.current = new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat([destination.lng, destination.lat])
      .addTo(map.current);

    // Remove existing route if any
    if (map.current.getSource('route')) {
      map.current.removeLayer('route');
      map.current.removeSource('route');
    }

    // Add route
    const routeGeoJSON = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: route.coordinates
      }
    };

    map.current.addSource('route', {
      type: 'geojson',
      data: routeGeoJSON
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

    // Fit bounds
    const bounds = new mapboxgl.LngLatBounds();
    route.coordinates.forEach((coord: number[]) => bounds.extend(coord as [number, number]));
    bounds.extend([userLocation!.lng, userLocation!.lat]);
    bounds.extend([destination.lng, destination.lat]);
    
    map.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });

    setCurrentRoute(route);

    // Notify parent
    if (onRouteCalculated) {
      onRouteCalculated({
        distance: route.distance,
        duration: route.duration,
        calories: route.calories,
        steps: route.steps,
        startCoordinates: userLocation!,
        endCoordinates: destination,
        routeGeoJSON
      });
    }
  };

  // Handle map clicks
  const handleMapClick = async (e: any) => {
    if (!canClick || isLoading) return;

    const clickedLocation = {
      lat: e.lngLat.lat,
      lng: e.lngLat.lng
    };

    setIsLoading(true);

    const route = await calculateRoute(userLocation!, clickedLocation);
    
    if (route) {
      displayRoute(route, clickedLocation);
      if (onUserClick) {
        onUserClick();
      }
    }
    
    setIsLoading(false);
  };

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
      <div ref={mapContainer} className="w-full h-[500px] rounded-2xl shadow-lg" />
      
      {/* Route info */}
      {currentRoute && (
        <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm rounded-lg p-4 shadow-lg max-w-xs">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-primary" />
            Itinéraire {planningData.tripType === 'round-trip' ? 'aller-retour' : 'simple'}
          </h3>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">{currentRoute.distance.toFixed(1)} km</div>
                <div className="text-xs text-muted-foreground">Distance</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <div>
                <div className="font-medium">{currentRoute.duration} min</div>
                <div className="text-xs text-muted-foreground">Durée</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <div>
                <div className="font-medium">{currentRoute.calories}</div>
                <div className="text-xs text-muted-foreground">kcal</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                👣
              </div>
              <div>
                <div className="font-medium text-green-600">{currentRoute.steps}</div>
                <div className="text-xs text-muted-foreground">pas</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-2xl">
          <div className="bg-card/95 backdrop-blur-sm rounded-lg p-4 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span className="text-sm font-medium">Calcul de l'itinéraire...</span>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 right-4 bg-card/95 backdrop-blur-sm rounded-lg p-3 text-center">
        <p className="text-sm text-muted-foreground">
          {!canClick 
            ? "🔒 Limite d'essais atteinte" 
            : "📍 Cliquez sur la carte pour choisir une destination"
          }
        </p>
      </div>
    </div>
  );
};

export default SimpleMap;