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
}

interface RouteData {
  distance: number; // in km
  duration: number; // in minutes
  calories: number;
  steps: number;
  coordinates: number[][]; // [lng, lat] pairs
}

const EnhancedMap: React.FC<EnhancedMapProps> = ({ planningData, onBack, className = '' }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);
  
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Calculate target distance based on planning data
  const getTargetDistance = useCallback(() => {
    const steps = parseInt(planningData.steps);
    const heightM = parseFloat(planningData.height);
    const strideM = 0.415 * heightM;
    const totalKm = (steps * strideM) / 1000;
    return planningData.tripType === 'round-trip' ? totalKm / 2 : totalKm;
  }, [planningData]);

  // Calculate steps based on distance and user data
  const calculateSteps = useCallback((distanceKm: number) => {
    const heightM = parseFloat(planningData.height);
    const strideM = heightM ? 0.415 * heightM : 0.72; // Use user height or default stride
    const totalDistance = planningData.tripType === 'round-trip' ? distanceKm * 2 : distanceKm;
    const distanceM = totalDistance * 1000;
    return Math.round(distanceM / strideM);
  }, [planningData.height, planningData.tripType]);

  // Calculate time based on distance
  const calculateTime = useCallback((distanceKm: number) => {
    const walkingSpeedKmh = 5.0; // Default walking speed
    const totalDistance = planningData.tripType === 'round-trip' ? distanceKm * 2 : distanceKm;
    return Math.round((totalDistance / walkingSpeedKmh) * 60);
  }, [planningData.tripType]);

  // Calculate calories based on distance and user data
  const calculateCalories = useCallback((distanceKm: number) => {
    const weightKg = parseFloat(planningData.weight) || 70; // Default 70kg
    const totalDistance = planningData.tripType === 'round-trip' ? distanceKm * 2 : distanceKm;
    return Math.round(weightKg * totalDistance * 0.9);
  }, [planningData.weight, planningData.tripType]);

  // Get Mapbox token
  useEffect(() => {
    const getMapboxToken = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('mapbox-token');
        
        if (error) throw error;
        if (data?.token && typeof data.token === 'string' && data.token.startsWith('pk.')) {
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

  // Get user location with permission handling
  useEffect(() => {
    const getUserLocation = () => {
      if (!navigator.geolocation) {
        // Fallback to Paris
        setUserLocation({ lat: 48.8566, lng: 2.3522 });
        return;
      }

      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setPermissionDenied(false);
          setIsLoading(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          if (error.code === 1) {
            setPermissionDenied(true);
          }
          // Fallback to Paris
          setUserLocation({ lat: 48.8566, lng: 2.3522 });
          setIsLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    };

    getUserLocation();
  }, []);

  // Calculate default destination position
  const calculateDefaultDestination = useCallback((userLoc: { lat: number; lng: number }) => {
    const targetKm = getTargetDistance();
    const bearing = 45; // Fixed bearing in degrees
    const radiusKm = targetKm;

    // Convert to radians
    const bearingRad = (bearing * Math.PI) / 180;
    const earthRadiusKm = 6371;

    // Calculate destination coordinates
    const userLatRad = (userLoc.lat * Math.PI) / 180;
    const userLngRad = (userLoc.lng * Math.PI) / 180;

    const destLatRad = Math.asin(
      Math.sin(userLatRad) * Math.cos(radiusKm / earthRadiusKm) +
      Math.cos(userLatRad) * Math.sin(radiusKm / earthRadiusKm) * Math.cos(bearingRad)
    );

    const destLngRad = userLngRad + Math.atan2(
      Math.sin(bearingRad) * Math.sin(radiusKm / earthRadiusKm) * Math.cos(userLatRad),
      Math.cos(radiusKm / earthRadiusKm) - Math.sin(userLatRad) * Math.sin(destLatRad)
    );

    return {
      lat: (destLatRad * 180) / Math.PI,
      lng: (destLngRad * 180) / Math.PI
    };
  }, [getTargetDistance]);

  // Compute route using Mapbox Directions API
  const computeRoute = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    if (!mapboxToken) return null;

    try {
      const profile = 'walking';
      let coordinates: string;
      
      if (planningData.tripType === 'round-trip') {
        coordinates = `${start.lng},${start.lat};${end.lng},${end.lat};${start.lng},${start.lat}`;
      } else {
        coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
      }

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
    } catch (error) {
      console.error('Error computing route:', error);
    }
    return null;
  }, [mapboxToken, planningData.tripType, calculateCalories]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !userLocation) return;

    // Reset any existing map
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [userLocation.lng, userLocation.lat],
      zoom: 14
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add geolocate control
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserLocation: true
      }),
      'top-right'
    );

    // Add click handler for destination placement
    map.current.on('click', (e) => {
      const newDestination = {
        lat: e.lngLat.lat,
        lng: e.lngLat.lng
      };
      setDestinationLocation(newDestination);
    });

    map.current.on('load', () => {
      // Initialize with default destination
      const defaultDest = calculateDefaultDestination(userLocation);
      setDestinationLocation(defaultDest);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken, userLocation, calculateDefaultDestination]);

  // Update markers and route when locations change
  useEffect(() => {
    if (!map.current || !userLocation) return;

    // Add/update user marker
    if (userMarker.current) {
      userMarker.current.remove();
    }

    const userEl = document.createElement('div');
    userEl.innerHTML = `
      <div style="
        width: 20px;
        height: 20px;
        background: #ef4444;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      "></div>
    `;

    userMarker.current = new mapboxgl.Marker(userEl)
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);

    // Add/update destination marker
    if (destinationLocation) {
      if (destinationMarker.current) {
        destinationMarker.current.remove();
      }

      const destEl = document.createElement('div');
      destEl.innerHTML = `
        <div style="
          width: 30px;
          height: 30px;
          background: #10b981;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 16px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          cursor: pointer;
        ">🎯</div>
      `;

      destinationMarker.current = new mapboxgl.Marker(destEl)
        .setLngLat([destinationLocation.lng, destinationLocation.lat])
        .addTo(map.current);

      // Compute and display route
      computeRoute(userLocation, destinationLocation).then(route => {
        if (route) {
          setRouteData(route);
          
          // Add route line to map
          if (map.current && map.current.isStyleLoaded()) {
            const routeId = 'walking-route';
            
            // Remove existing route
            if (map.current.getLayer(routeId)) {
              map.current.removeLayer(routeId);
            }
            if (map.current.getSource(routeId)) {
              map.current.removeSource(routeId);
            }

            // Add new route
            map.current.addSource(routeId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: route.coordinates
                }
              }
            });

            map.current.addLayer({
              id: routeId,
              type: 'line',
              source: routeId,
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': '#10b981',
                'line-width': 4,
                'line-opacity': 0.8
              }
            });

            // Fit map to show entire route
            const bounds = new mapboxgl.LngLatBounds();
            route.coordinates.forEach((coord: number[]) => bounds.extend([coord[0], coord[1]]));
            map.current.fitBounds(bounds, { padding: 50 });
          }
        }
      });
    }
  }, [userLocation, destinationLocation, computeRoute]);

  const requestLocationPermission = () => {
    setPermissionDenied(false);
    // Re-trigger location request
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setPermissionDenied(false);
        },
        () => setPermissionDenied(true)
      );
    }
  };

  const resetToDefault = () => {
    if (userLocation) {
      const defaultDest = calculateDefaultDestination(userLocation);
      setDestinationLocation(defaultDest);
    }
  };

  const targetDistance = getTargetDistance();
  const deviation = routeData ? ((routeData.distance - targetDistance) / targetDistance * 100) : 0;

  return (
    <div className={`relative ${className}`}>
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-96 rounded-lg overflow-hidden bg-gray-100" />
      
      {/* Loading/Permission Overlay */}
      {(isLoading || permissionDenied) && (
        <div className="absolute inset-0 bg-white/90 flex items-center justify-center rounded-lg">
          <div className="text-center p-6">
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-sm text-muted-foreground">Localisation en cours...</p>
              </>
            ) : permissionDenied ? (
              <>
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-foreground mb-2">Permission de localisation requise</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Activez la géolocalisation pour une expérience optimale
                </p>
                <Button onClick={requestLocationPermission} size="sm">
                  Autoriser la localisation
                </Button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Route Summary Banner */}
      {routeData && (
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground">Itinéraire calculé</h3>
            <div className="flex space-x-2">
              <Button onClick={resetToDefault} size="sm" variant="outline">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">{routeData.distance.toFixed(1)} km</p>
                <p className="text-xs text-muted-foreground">Distance</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 text-secondary flex items-center justify-center text-xs">👣</div>
              <div>
                <p className="font-medium">{routeData.steps.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  Steps
                  {(() => {
                    const targetSteps = parseInt(planningData.steps);
                    const deviation = ((routeData.steps - targetSteps) / targetSteps) * 100;
                    const isWithinTolerance = Math.abs(deviation) <= 5;
                    
                    if (!isWithinTolerance) {
                      return (
                        <span className={`ml-1 ${deviation > 0 ? 'text-orange-500' : 'text-blue-500'}`}>
                          ({deviation > 0 ? '+' : ''}{deviation.toFixed(0)}%)
                        </span>
                      );
                    }
                    return null;
                  })()}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-secondary" />
              <div>
                <p className="font-medium">{routeData.duration} min</p>
                <p className="text-xs text-muted-foreground">Time</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <div>
                <p className="font-medium">{routeData.calories} cal</p>
                <p className="text-xs text-muted-foreground">Calories</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute top-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <p className="text-sm text-foreground">
          📍 Tapez sur la carte pour placer votre destination
        </p>
      </div>
    </div>
  );
};

export default EnhancedMap;