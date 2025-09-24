import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Zap, RotateCcw } from 'lucide-react';

interface GoogleMapProps {
  planningData: {
    steps: string;
    pace: 'slow' | 'moderate' | 'fast';
    tripType: 'one-way' | 'round-trip';
    height: string;
    weight: string;
  };
  onBack?: () => void;
  className?: string;
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
  startCoordinates: { lat: number; lng: number };
  endCoordinates: { lat: number; lng: number };
}

const containerStyle = {
  width: '100%',
  height: '400px'
};

const GoogleMapComponent: React.FC<GoogleMapProps> = ({ 
  planningData, 
  onBack, 
  className = '', 
  onRouteCalculated 
}) => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsService = useRef<google.maps.DirectionsService | null>(null);
  
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showWarningMessage, setShowWarningMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Calculate target distance based on planning data
  const getTargetDistance = useCallback(() => {
    const steps = parseInt(planningData.steps);
    const heightM = parseFloat(planningData.height);
    const strideM = 0.415 * heightM;
    const totalKm = (steps * strideM) / 1000;
    return totalKm;
  }, [planningData]);

  // Calculate steps based on distance and user data
  const calculateSteps = useCallback((distanceKm: number) => {
    const heightM = parseFloat(planningData.height);
    const strideM = heightM ? 0.415 * heightM : 0.72;
    const distanceM = distanceKm * 1000;
    return Math.round(distanceM / strideM);
  }, [planningData.height]);

  // Calculate time based on distance
  const calculateTime = useCallback((distanceKm: number) => {
    const walkingSpeedKmh = 5.0;
    return Math.round((distanceKm / walkingSpeedKmh) * 60);
  }, []);

  // Calculate calories based on distance and user data
  const calculateCalories = useCallback((distanceKm: number) => {
    const weightKg = parseFloat(planningData.weight) || 70;
    return Math.round(weightKg * distanceKm * 0.9);
  }, [planningData.weight]);

  // Get Google Maps API key
  useEffect(() => {
    const getGoogleMapsApiKey = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('google-maps-key');
        
        if (error) throw error;
        if (data?.apiKey && typeof data.apiKey === 'string') {
          setGoogleMapsApiKey(data.apiKey);
        } else {
          throw new Error('Invalid API key received');
        }
      } catch (error) {
        console.error('Error fetching Google Maps API key:', error);
      }
    };
    getGoogleMapsApiKey();
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
            setUserLocation({ lat: 48.8566, lng: 2.3522 }); // Default to Paris
          }
        );
      }
    };

    getUserLocation();
  }, []);

  // Generate optimal route based on target steps
  const generateOptimalRoute = useCallback(async (userLoc: { lat: number; lng: number }) => {
    if (!directionsService.current) return;

    const targetSteps = parseInt(planningData.steps);
    const targetDistanceKm = getTargetDistance();
    
    // Try different bearings to find good destinations
    const bearings = [45, 90, 135, 180, 225, 270, 315, 0];
    const radius = planningData.tripType === 'round-trip' ? targetDistanceKm / 2 : targetDistanceKm * 0.8;

    for (const bearing of bearings) {
      try {
        const bearingRad = (bearing * Math.PI) / 180;
        const earthRadiusKm = 6371;
        
        const destLatRad = Math.asin(
          Math.sin((userLoc.lat * Math.PI) / 180) * Math.cos(radius / earthRadiusKm) +
          Math.cos((userLoc.lat * Math.PI) / 180) * Math.sin(radius / earthRadiusKm) * Math.cos(bearingRad)
        );
        
        const destLngRad = (userLoc.lng * Math.PI) / 180 + Math.atan2(
          Math.sin(bearingRad) * Math.sin(radius / earthRadiusKm) * Math.cos((userLoc.lat * Math.PI) / 180),
          Math.cos(radius / earthRadiusKm) - Math.sin((userLoc.lat * Math.PI) / 180) * Math.sin(destLatRad)
        );

        const testDestination = {
          lat: (destLatRad * 180) / Math.PI,
          lng: (destLngRad * 180) / Math.PI
        };

        await calculateRoute(userLoc, testDestination);
        break; // Use first successful route
      } catch (error) {
        continue;
      }
    }
  }, [planningData, getTargetDistance]);

  // Calculate route using Google Directions API
  const calculateRoute = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    if (!directionsService.current || !start || !end) return;

    setIsLoading(true);
    
    try {
      const request: google.maps.DirectionsRequest = {
        origin: start,
        destination: end,
        travelMode: google.maps.TravelMode.WALKING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: true,
        avoidTolls: true
      };

      directionsService.current.route(request, (result, status) => {
        setIsLoading(false);
        
        if (status === 'OK' && result) {
          setDirections(result);
          
          const route = result.routes[0];
          const leg = route.legs[0];
          const distanceKm = leg.distance!.value / 1000;
          
          // For round-trip, double the distance
          const totalDistanceKm = planningData.tripType === 'round-trip' ? distanceKm * 2 : distanceKm;
          
          const steps = calculateSteps(totalDistanceKm);
          const duration = calculateTime(totalDistanceKm);
          const calories = calculateCalories(totalDistanceKm);

          const routeInfo: RouteData = {
            distance: totalDistanceKm,
            duration,
            calories,
            steps,
            startCoordinates: start,
            endCoordinates: end
          };

          setRouteData(routeInfo);

          // Call parent callback if provided
          if (onRouteCalculated) {
            onRouteCalculated({
              ...routeInfo,
              routeGeoJSON: result
            });
          }
        } else {
          console.error('Directions request failed due to ' + status);
          setShowWarningMessage('Impossible de calculer l\'itinéraire. Veuillez essayer un autre point.');
        }
      });
    } catch (error) {
      setIsLoading(false);
      console.error('Error calculating route:', error);
    }
  }, [planningData.tripType, calculateSteps, calculateTime, calculateCalories, onRouteCalculated]);

  // Handle map click to set destination
  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (isLocked || !userLocation || !event.latLng) return;

    const clickedLocation = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    };

    setDestinationLocation(clickedLocation);
    calculateRoute(userLocation, clickedLocation);
    
    setClickCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 3) {
        setIsLocked(true);
        setShowWarningMessage('Vous avez atteint la limite de 3 clics. Utilisez le bouton "Réinitialiser" pour recommencer.');
      }
      return newCount;
    });
  }, [userLocation, isLocked, calculateRoute]);

  // Reset to default route
  const resetToDefault = useCallback(() => {
    setClickCount(0);
    setIsLocked(false);
    setShowWarningMessage(null);
    setDestinationLocation(null);
    setDirections(null);
    setRouteData(null);
    
    if (userLocation) {
      generateOptimalRoute(userLocation);
    }
  }, [userLocation, generateOptimalRoute]);

  // Initialize map and generate initial route
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    directionsService.current = new google.maps.DirectionsService();

    if (userLocation) {
      generateOptimalRoute(userLocation);
    }
  }, [userLocation, generateOptimalRoute]);

  // Generate initial route when user location is available
  useEffect(() => {
    if (userLocation && directionsService.current && !destinationLocation) {
      generateOptimalRoute(userLocation);
    }
  }, [userLocation, generateOptimalRoute, destinationLocation]);

  if (!googleMapsApiKey) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  const defaultCenter = userLocation || { lat: 48.8566, lng: 2.3522 };

  return (
    <div className={`relative ${className}`}>
      <LoadScript googleMapsApiKey={googleMapsApiKey}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={14}
          onLoad={onMapLoad}
          onClick={handleMapClick}
          options={{
            zoomControl: true,
            mapTypeControl: false,
            scaleControl: true,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: true
          }}
        >
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                url: 'data:image/svg+xml;base64,' + btoa(`
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="8" fill="#ef4444" stroke="white" stroke-width="3"/>
                    <circle cx="12" cy="12" r="3" fill="white"/>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(24, 24)
              }}
              title="Votre position"
            />
          )}

          {destinationLocation && (
            <Marker
              position={destinationLocation}
              icon={{
                url: 'data:image/svg+xml;base64,' + btoa(`
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="12" fill="#10b981" stroke="white" stroke-width="3"/>
                    <circle cx="16" cy="16" r="4" fill="white"/>
                    <circle cx="16" cy="16" r="2" fill="#10b981"/>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(32, 32)
              }}
              title="Destination"
            />
          )}

          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                polylineOptions: {
                  strokeColor: '#10b981',
                  strokeWeight: 5,
                  strokeOpacity: 0.9
                },
                suppressMarkers: true
              }}
            />
          )}
        </GoogleMap>
      </LoadScript>

      {/* Route Information Overlay */}
      {routeData && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
          <h3 className="font-semibold text-sm mb-3">Informations du trajet</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <MapPin className="w-4 h-4 text-primary" />
                <span>Distance</span>
              </span>
              <span className="font-medium">{routeData.distance.toFixed(1)} km</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Clock className="w-4 h-4 text-primary" />
                <span>Durée</span>
              </span>
              <span className="font-medium">{routeData.duration} min</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Zap className="w-4 h-4 text-primary" />
                <span>Calories</span>
              </span>
              <span className="font-medium">{routeData.calories} kcal</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Pas estimés</span>
              <span className="font-medium">{routeData.steps.toLocaleString()}</span>
            </div>
          </div>
          
          {planningData.tripType === 'round-trip' && (
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              🔄 Trajet aller-retour
            </div>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg">
          <div className="bg-white rounded-lg p-4 shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm">Calcul de l'itinéraire...</p>
          </div>
        </div>
      )}

      {/* Warning Message */}
      {showWarningMessage && (
        <div className="absolute bottom-4 left-4 right-4 bg-orange-100 border border-orange-300 text-orange-700 px-4 py-3 rounded">
          {showWarningMessage}
        </div>
      )}

      {/* Reset Button */}
      <div className="absolute bottom-4 right-4">
        <Button
          onClick={resetToDefault}
          variant="secondary"
          size="sm"
          className="shadow-lg"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Réinitialiser
        </Button>
      </div>

      {/* Instructions */}
      {!isLocked && (
        <div className="absolute bottom-4 left-4 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-sm max-w-xs">
          Cliquez sur la carte pour choisir votre destination ({3 - clickCount} clics restants)
        </div>
      )}
    </div>
  );
};

export default GoogleMapComponent;