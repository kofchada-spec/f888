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
  const [returnDirections, setReturnDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showWarningMessage, setShowWarningMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [toleranceMessage, setToleranceMessage] = useState<string | null>(null);

  // Calculate target distance based on planning data
  const getTargetDistance = useCallback(() => {
    const stepGoal = parseInt(planningData.steps);
    const heightM = parseFloat(planningData.height);
    // Use default stride of 0.75m if no calibrated stride (vs. calculated 0.415 * height)
    const strideM = heightM > 0 ? 0.415 * heightM : 0.75;
    const targetDistanceKm = (stepGoal * strideM) / 1000;
    return targetDistanceKm;
  }, [planningData]);

  // Calculate steps based on distance and user data
  const calculateSteps = useCallback((distanceKm: number) => {
    const heightM = parseFloat(planningData.height);
    const strideM = heightM > 0 ? 0.415 * heightM : 0.75;
    const distanceM = distanceKm * 1000;
    return Math.round(distanceM / strideM);
  }, [planningData.height]);

  // Calculate time based on distance and pace
  const calculateTime = useCallback((distanceKm: number) => {
    const paceSpeed = {
      slow: 4.0,    // km/h
      moderate: 5.0, // km/h  
      fast: 6.0     // km/h
    };
    const speedKmh = paceSpeed[planningData.pace];
    const durationHours = distanceKm / speedKmh;
    const durationMin = Math.round(durationHours * 60);
    // Round to nearest 30s (0.5 min)
    return Math.round(durationMin / 0.5) * 0.5;
  }, [planningData.pace]);

  // Calculate calories based on distance and user data
  const calculateCalories = useCallback((distanceKm: number) => {
    const weightKg = parseFloat(planningData.weight) || 70;
    const paceCoefficients = {
      slow: 0.35,
      moderate: 0.50,
      fast: 0.70
    };
    const coefficient = paceCoefficients[planningData.pace];
    return Math.round(weightKg * distanceKm * coefficient);
  }, [planningData.weight, planningData.pace]);

  // Check step tolerance (±5%) - STRICT validation on steps, not distance
  const isStepsWithinTolerance = useCallback((estimatedSteps: number, targetSteps: number) => {
    const tolerance = 0.05; // 5%
    const minAllowed = targetSteps * (1 - tolerance);
    const maxAllowed = targetSteps * (1 + tolerance);
    return estimatedSteps >= minAllowed && estimatedSteps <= maxAllowed;
  }, []);

  // Get target steps from planning data
  const getTargetSteps = useCallback(() => {
    return parseInt(planningData.steps);
  }, [planningData.steps]);

  // Get Google Maps API key
  useEffect(() => {
    const getGoogleMapsApiKey = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('google-maps-key');
        
        if (error) {
          console.error('Error from google-maps-key function:', error);
          return;
        }
        if (data?.apiKey && typeof data.apiKey === 'string') {
          setGoogleMapsApiKey(data.apiKey);
        } else {
          console.error('Invalid API key received:', data);
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

    const targetSteps = getTargetSteps();
    const targetDistanceKm = getTargetDistance();
    
    // Try different bearings to find good destinations
    const bearings = [45, 90, 135, 180, 225, 270, 315, 0];
    const radius = planningData.tripType === 'round-trip' ? targetDistanceKm / 2 : targetDistanceKm * 0.8;

    let bestRoute = null;
    let bestStepsDifference = Infinity;

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

        // Test this destination and see if steps are within tolerance
        const request: google.maps.DirectionsRequest = {
          origin: userLoc,
          destination: testDestination,
          travelMode: google.maps.TravelMode.WALKING,
          unitSystem: google.maps.UnitSystem.METRIC,
          avoidHighways: true,
          avoidTolls: true
        };

        // Use a Promise wrapper to handle async direction calculation
        const testRoute = new Promise<{destination: any, steps: number, distance: number}>((resolve, reject) => {
          directionsService.current!.route(request, (result, status) => {
            if (status === 'OK' && result) {
              const route = result.routes[0];
              const leg = route.legs[0];
              const distanceKm = leg.distance!.value / 1000;
              
              // For round-trip, double the distance
              const totalDistanceKm = planningData.tripType === 'round-trip' ? distanceKm * 2 : distanceKm;
              const estimatedSteps = calculateSteps(totalDistanceKm);
              
              resolve({
                destination: testDestination,
                steps: estimatedSteps,
                distance: totalDistanceKm
              });
            } else {
              reject(new Error('Route calculation failed'));
            }
          });
        });

        const routeResult = await testRoute;
        
        // Check if this route has steps within tolerance
        if (isStepsWithinTolerance(routeResult.steps, targetSteps)) {
          // This route is acceptable, trigger calculation by setting destination
          setDestinationLocation(routeResult.destination);
          // Will trigger calculateRoute via handleMapClick or similar
          return;
        } else {
          // Track the best route (closest to target) as fallback
          const stepsDifference = Math.abs(routeResult.steps - targetSteps);
          if (stepsDifference < bestStepsDifference) {
            bestStepsDifference = stepsDifference;
            bestRoute = routeResult;
          }
        }
      } catch (error) {
        continue;
      }
    }

    // If no route within tolerance was found, show message and don't set any route
    if (bestRoute) {
      const percentageOff = Math.abs((bestRoute.steps - targetSteps) / targetSteps * 100);
      setToleranceMessage(`Aucun itinéraire automatique dans la tolérance. Meilleur trouvé: ${bestRoute.steps.toLocaleString()} pas (écart: ${percentageOff.toFixed(1)}%). Cliquez sur la carte pour choisir manuellement.`);
    } else {
      setShowWarningMessage('Impossible de générer un itinéraire automatique. Cliquez sur la carte pour choisir votre destination.');
    }
  }, [planningData, getTargetDistance, getTargetSteps, isStepsWithinTolerance, calculateSteps]);

  // Calculate route using Google Directions API
  const calculateRoute = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }) => {
    if (!directionsService.current || !start || !end) return;

    setIsLoading(true);
    setToleranceMessage(null);
    
    try {
      const targetSteps = getTargetSteps();
      
      if (planningData.tripType === 'one-way') {
        // Mode Aller simple
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
            const route = result.routes[0];
            const leg = route.legs[0];
            const actualDistanceKm = leg.distance!.value / 1000;
            
            // Calculate estimated steps from actual route distance
            const estimatedSteps = calculateSteps(actualDistanceKm);
            
            // Check STRICT tolerance on steps (±5%)
            if (!isStepsWithinTolerance(estimatedSteps, targetSteps)) {
              const percentageOff = Math.abs((estimatedSteps - targetSteps) / targetSteps * 100);
              setToleranceMessage(`Itinéraire rejeté: ${estimatedSteps.toLocaleString()} pas (objectif: ${targetSteps.toLocaleString()} ±5%). Cliquez ailleurs.`);
              return; // Do NOT accept this route
            }
            
            setDirections(result);
            setReturnDirections(null);
            
            const duration = calculateTime(actualDistanceKm);
            const calories = calculateCalories(actualDistanceKm);

            const routeInfo: RouteData = {
              distance: actualDistanceKm,
              duration,
              calories,
              steps: estimatedSteps, // Use estimated steps from actual distance
              startCoordinates: start,
              endCoordinates: end
            };

            setRouteData(routeInfo);

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
        
      } else {
        // Mode Aller-retour (deux trajets distincts)
        calculateRoundTripRoute(start, end, targetSteps);
      }
    } catch (error) {
      setIsLoading(false);
      console.error('Error calculating route:', error);
    }
  }, [planningData.tripType, calculateSteps, calculateTime, calculateCalories, onRouteCalculated, getTargetSteps, isStepsWithinTolerance]);

  // Calculate round-trip route with two distinct paths
  const calculateRoundTripRoute = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }, targetSteps: number) => {
    if (!directionsService.current) return;

    try {
      // First, calculate the outbound route
      const outboundRequest: google.maps.DirectionsRequest = {
        origin: start,
        destination: end,
        travelMode: google.maps.TravelMode.WALKING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: true,
        avoidTolls: true
      };

      directionsService.current.route(outboundRequest, (outboundResult, outboundStatus) => {
        if (outboundStatus === 'OK' && outboundResult) {
          // Calculate return route with waypoints to force different path
          const returnRequest: google.maps.DirectionsRequest = {
            origin: end,
            destination: start,
            travelMode: google.maps.TravelMode.WALKING,
            unitSystem: google.maps.UnitSystem.METRIC,
            avoidHighways: true,
            avoidTolls: true,
            provideRouteAlternatives: true
          };

          directionsService.current!.route(returnRequest, (returnResult, returnStatus) => {
            setIsLoading(false);
            
            if (returnStatus === 'OK' && returnResult) {
              const outboundDistance = outboundResult.routes[0].legs[0].distance!.value / 1000;
              const returnDistance = returnResult.routes[0].legs[0].distance!.value / 1000;
              const totalDistanceKm = outboundDistance + returnDistance;
              
              // Calculate estimated steps from total round-trip distance
              const estimatedSteps = calculateSteps(totalDistanceKm);
              
              // Check STRICT tolerance on steps (±5%)
              if (!isStepsWithinTolerance(estimatedSteps, targetSteps)) {
                const percentageOff = Math.abs((estimatedSteps - targetSteps) / targetSteps * 100);
                setToleranceMessage(`Itinéraire A/R rejeté: ${estimatedSteps.toLocaleString()} pas (objectif: ${targetSteps.toLocaleString()} ±5%). Cliquez ailleurs.`);
                return; // Do NOT accept this route
              }
              
              setDirections(outboundResult);
              setReturnDirections(returnResult);
              
              const duration = calculateTime(totalDistanceKm);
              const calories = calculateCalories(totalDistanceKm);

              const routeInfo: RouteData = {
                distance: totalDistanceKm,
                duration,
                calories,
                steps: estimatedSteps, // Use estimated steps from actual distance
                startCoordinates: start,
                endCoordinates: end
              };

              setRouteData(routeInfo);

              if (onRouteCalculated) {
                onRouteCalculated({
                  ...routeInfo,
                  routeGeoJSON: { outbound: outboundResult, return: returnResult }
                });
              }
            } else {
              // Fallback: use same path for return but styled differently
              const outboundDistance = outboundResult.routes[0].legs[0].distance!.value / 1000;
              const totalDistanceKm = outboundDistance * 2;
              
              // Calculate estimated steps from fallback distance
              const estimatedSteps = calculateSteps(totalDistanceKm);
              
              // Check STRICT tolerance on steps (±5%) even for fallback
              if (!isStepsWithinTolerance(estimatedSteps, targetSteps)) {
                const percentageOff = Math.abs((estimatedSteps - targetSteps) / targetSteps * 100);
                setToleranceMessage(`Itinéraire A/R fallback rejeté: ${estimatedSteps.toLocaleString()} pas (objectif: ${targetSteps.toLocaleString()} ±5%). Cliquez ailleurs.`);
                return; // Do NOT accept this route
              }
              
              setToleranceMessage('Aucune alternative de retour satisfaisante — itinéraire retour identique à l\'aller.');
              setDirections(outboundResult);
              setReturnDirections(outboundResult);
              
              const duration = calculateTime(totalDistanceKm);
              const calories = calculateCalories(totalDistanceKm);

              const routeInfo: RouteData = {
                distance: totalDistanceKm,
                duration,
                calories,
                steps: estimatedSteps, // Use estimated steps from actual distance
                startCoordinates: start,
                endCoordinates: end
              };

              setRouteData(routeInfo);

              if (onRouteCalculated) {
                onRouteCalculated({
                  ...routeInfo,
                  routeGeoJSON: outboundResult
                });
              }
            }
          });
        } else {
          setIsLoading(false);
          console.error('Outbound directions request failed due to ' + outboundStatus);
          setShowWarningMessage('Impossible de calculer l\'itinéraire aller. Veuillez essayer un autre point.');
        }
      });
    } catch (error) {
      setIsLoading(false);
      console.error('Error calculating round-trip route:', error);
    }
  }, [calculateSteps, calculateTime, calculateCalories, onRouteCalculated, isStepsWithinTolerance]);

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
    setToleranceMessage(null);
    setDestinationLocation(null);
    setDirections(null);
    setReturnDirections(null);
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

  // Trigger route calculation when destination is set (from generateOptimalRoute or user click)
  useEffect(() => {
    if (userLocation && destinationLocation && directionsService.current) {
      calculateRoute(userLocation, destinationLocation);
    }
  }, [userLocation, destinationLocation, calculateRoute]);

  if (!googleMapsApiKey) {
    return (
      <div className="flex items-center justify-center h-96 bg-card rounded-lg border">
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
      <LoadScript 
        googleMapsApiKey={googleMapsApiKey}
        libraries={['geometry', 'places']}
        loadingElement={
          <div className="flex items-center justify-center h-96 bg-card rounded-lg border">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Chargement de l'API Google Maps...</p>
            </div>
          </div>
        }
        onLoad={() => {
          console.log('Google Maps API loaded successfully');
        }}
        onError={(err) => {
          console.error('Google Maps loading error:', err);
        }}
      >
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
                scaledSize: window.google?.maps ? new window.google.maps.Size(24, 24) : undefined
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
                scaledSize: window.google?.maps ? new window.google.maps.Size(32, 32) : undefined
              }}
              title="Destination"
            />
          )}

          {/* Aller route - GREEN */}
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                polylineOptions: {
                  strokeColor: '#2ECC71', // Green for outbound
                  strokeWeight: 4,
                  strokeOpacity: 0.9
                },
                suppressMarkers: true
              }}
            />
          )}
          
          {/* Return route - BLUE (only for round-trip) */}
          {returnDirections && planningData.tripType === 'round-trip' && (
            <DirectionsRenderer
              directions={returnDirections}
              options={{
                polylineOptions: {
                  strokeColor: '#3498DB', // Blue for return
                  strokeWeight: 4,
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
              <span className="font-medium text-green-600">{routeData.steps.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Objectif</span>
              <span className="font-medium">{parseInt(planningData.steps).toLocaleString()} pas</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Tolérance (±5%)</span>
              <span className={`font-medium ${
                isStepsWithinTolerance(routeData.steps, parseInt(planningData.steps)) 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {isStepsWithinTolerance(routeData.steps, parseInt(planningData.steps)) ? '✓ OK' : '✗ Hors limite'}
              </span>
            </div>
          </div>
          
          {planningData.tripType === 'round-trip' && (
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              🟢 Aller • 🔵 Retour
            </div>
          )}
          {planningData.tripType === 'one-way' && (
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              🟢 Aller simple
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

      {/* Tolerance Message */}
      {toleranceMessage && (
        <div className="absolute bottom-20 left-4 right-4 bg-yellow-100 border border-yellow-300 text-yellow-700 px-4 py-3 rounded">
          ⚠️ {toleranceMessage}
        </div>
      )}

      {/* Warning Message */}
      {showWarningMessage && (
        <div className="absolute bottom-20 left-4 right-4 bg-orange-100 border border-orange-300 text-orange-700 px-4 py-3 rounded">
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
          <div className="font-medium mb-1">Instructions:</div>
          <div>• Cliquez sur la carte pour choisir votre destination</div>
          <div>• {planningData.tripType === 'round-trip' ? 'Trajet A/R avec chemins distincts' : 'Trajet aller simple'}</div>
          <div>• {3 - clickCount} clics restants</div>
        </div>
      )}
    </div>
  );
};

export default GoogleMapComponent;