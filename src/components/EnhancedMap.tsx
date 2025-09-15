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

const EnhancedMap: React.FC<EnhancedMapProps> = ({ planningData, onBack, className = '', onRouteCalculated }) => {
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
    // Return the full target distance - radius calculation will be done elsewhere
    return totalKm;
  }, [planningData]);

  // Calculate steps based on distance and user data
  const calculateSteps = useCallback((distanceKm: number) => {
    const heightM = parseFloat(planningData.height);
    const strideM = heightM ? 0.415 * heightM : 0.72; // Use user height or default stride
    // distanceKm is already the total route distance from Mapbox (including round-trip if requested)
    const distanceM = distanceKm * 1000;
    return Math.round(distanceM / strideM);
  }, [planningData.height]);

  // Calculate time based on distance
  const calculateTime = useCallback((distanceKm: number) => {
    const walkingSpeedKmh = 5.0; // Default walking speed
    // distanceKm is already the total route distance from Mapbox (including round-trip if requested)
    return Math.round((distanceKm / walkingSpeedKmh) * 60);
  }, []);

  // Calculate calories based on distance and user data
  const calculateCalories = useCallback((distanceKm: number) => {
    const weightKg = parseFloat(planningData.weight) || 70; // Default 70kg
    // distanceKm is already the total route distance from Mapbox (including round-trip if requested)
    return Math.round(weightKg * distanceKm * 0.9);
  }, [planningData.weight]);

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

  // Smart route generation that targets specific step count
  const generateOptimalRoute = useCallback(async (userLoc: { lat: number; lng: number }) => {
    if (!mapboxToken) return null;

    const targetSteps = parseInt(planningData.steps);
    const heightM = parseFloat(planningData.height);
    const strideM = heightM ? 0.415 * heightM : 0.72;
    const targetDistanceKm = (targetSteps * strideM) / 1000;
    
    // For round-trip, we need to find a destination that creates a route with total distance = targetDistanceKm
    // For one-way, we need a route with distance = targetDistanceKm
    const tolerance = 0.05; // 5% tolerance
    const minAcceptableSteps = targetSteps * (1 - tolerance);
    const maxAcceptableSteps = targetSteps * (1 + tolerance);

    // Try different bearings and distances to find the best match
    const bearings = [45, 90, 135, 180, 225, 270, 315, 0]; // 8 directions
    const distanceMultipliers = [0.8, 1.0, 1.2, 0.6, 1.4]; // Try different distances from target

    let bestRoute = null;
    let bestScore = Infinity;
    let bestDestination = null;

    for (const bearing of bearings) {
      for (const multiplier of distanceMultipliers) {
        try {
          // Calculate test destination radius
          // For round-trip: Mapbox calculates start->dest->start, we need to be more conservative
          // Street routing adds distance, so use less than half for round-trip
          // For one-way: Use slightly less than target due to street routing
          const testRadius = planningData.tripType === 'round-trip' ? 
            (targetDistanceKm / 2.5) * multiplier : // More conservative for round-trip to account for street routing
            targetDistanceKm * multiplier * 0.8; // Adjusted for street routing in one-way

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

          // Test this route
          const profile = 'walking';
          
          if (planningData.tripType === 'round-trip') {
            // For round-trip, generate separate outbound and return paths that don't overlap
            const outboundCoords = `${userLoc.lng},${userLoc.lat};${testDestination.lng},${testDestination.lat}`;
            
            // Get outbound route
            const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${outboundCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
            const outboundResponse = await fetch(outboundUrl);
            const outboundData = await outboundResponse.json();
            
            if (outboundData.routes && outboundData.routes.length > 0) {
              const outboundRoute = outboundData.routes[0];
              const outboundDistanceKm = outboundRoute.distance / 1000;
              const targetReturnDistanceKm = targetDistanceKm - outboundDistanceKm;
              
              // Generate intermediate waypoints to force different return paths
              const returnWaypoints = [];
              const centerLat = (userLoc.lat + testDestination.lat) / 2;
              const centerLng = (userLoc.lng + testDestination.lng) / 2;
              
              // Create waypoints perpendicular to the direct line between destination and start
              const directBearing = Math.atan2(
                userLoc.lat - testDestination.lat,
                userLoc.lng - testDestination.lng
              ) * 180 / Math.PI;
              
              // Generate waypoints at 90° and 270° from direct bearing to force different paths
              const perpendicularBearings = [directBearing + 90, directBearing - 90];
              const waypointDistances = [0.3, 0.5, 0.7]; // Different distances in km from center point
              
              for (const perpBearing of perpendicularBearings) {
                for (const distance of waypointDistances) {
                  const bearingRad = (perpBearing * Math.PI) / 180;
                  const earthRadiusKm = 6371;
                  
                  const waypointLatRad = Math.asin(
                    Math.sin((centerLat * Math.PI) / 180) * Math.cos(distance / earthRadiusKm) +
                    Math.cos((centerLat * Math.PI) / 180) * Math.sin(distance / earthRadiusKm) * Math.cos(bearingRad)
                  );
                  
                  const waypointLngRad = (centerLng * Math.PI) / 180 + Math.atan2(
                    Math.sin(bearingRad) * Math.sin(distance / earthRadiusKm) * Math.cos((centerLat * Math.PI) / 180),
                    Math.cos(distance / earthRadiusKm) - Math.sin((centerLat * Math.PI) / 180) * Math.sin(waypointLatRad)
                  );
                  
                  returnWaypoints.push({
                    lat: (waypointLatRad * 180) / Math.PI,
                    lng: (waypointLngRad * 180) / Math.PI
                  });
                }
              }
              
              let bestReturnRoute = null;
              let bestReturnScore = Infinity;
              let bestOverlapScore = Infinity;
              
              // Test return routes through different waypoints
              for (const waypoint of returnWaypoints) {
                try {
                  const returnCoords = `${testDestination.lng},${testDestination.lat};${waypoint.lng},${waypoint.lat};${userLoc.lng},${userLoc.lat}`;
                  const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${returnCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
                  const returnResponse = await fetch(returnUrl);
                  const returnData = await returnResponse.json();
                  
                  if (returnData.routes && returnData.routes.length > 0) {
                    const returnRoute = returnData.routes[0];
                    const returnDistanceKm = returnRoute.distance / 1000;
                    const totalDistanceKm = outboundDistanceKm + returnDistanceKm;
                    
                    // Calculate step deviation from target
                    const totalSteps = Math.round((totalDistanceKm * 1000) / strideM);
                    const stepDeviation = Math.abs(totalSteps - targetSteps) / targetSteps;
                    
                    // Calculate route overlap (simplified - check coordinate proximity)
                    const overlapScore = calculateRouteOverlap(outboundRoute.geometry.coordinates, returnRoute.geometry.coordinates);
                    
                    // Combined score: prioritize low overlap, then step accuracy
                    const combinedScore = overlapScore * 2 + stepDeviation;
                    
                    if (combinedScore < bestReturnScore) {
                      bestReturnScore = combinedScore;
                      bestOverlapScore = overlapScore;
                      bestReturnRoute = returnRoute;
                    }
                  }
                } catch (returnError) {
                  // Continue to next waypoint
                }
              }
              
              // If no good waypoint route found, try direct return with different approach
              if (!bestReturnRoute || bestOverlapScore > 0.5) {
                try {
                  const directReturnCoords = `${testDestination.lng},${testDestination.lat};${userLoc.lng},${userLoc.lat}`;
                  const directReturnUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${directReturnCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full&alternatives=true`;
                  const directReturnResponse = await fetch(directReturnUrl);
                  const directReturnData = await directReturnResponse.json();
                  
                  if (directReturnData.routes && directReturnData.routes.length > 0) {
                    // Try alternative routes if available
                    for (const alternativeRoute of directReturnData.routes) {
                      const returnDistanceKm = alternativeRoute.distance / 1000;
                      const totalDistanceKm = outboundDistanceKm + returnDistanceKm;
                      const totalSteps = Math.round((totalDistanceKm * 1000) / strideM);
                      const stepDeviation = Math.abs(totalSteps - targetSteps) / targetSteps;
                      
                      const overlapScore = calculateRouteOverlap(outboundRoute.geometry.coordinates, alternativeRoute.geometry.coordinates);
                      const combinedScore = overlapScore * 2 + stepDeviation;
                      
                      if (combinedScore < bestReturnScore) {
                        bestReturnScore = combinedScore;
                        bestReturnRoute = alternativeRoute;
                      }
                    }
                  }
                } catch (directReturnError) {
                  // Use the best waypoint route if direct alternatives fail
                }
              }
              
              if (bestReturnRoute) {
                const returnDistanceKm = bestReturnRoute.distance / 1000;
                const totalDistanceKm = outboundDistanceKm + returnDistanceKm;
                const routeSteps = Math.round((totalDistanceKm * 1000) / strideM);
                
                // Calculate how close this is to our target
                const stepDifference = Math.abs(routeSteps - targetSteps);
                const score = stepDifference / targetSteps;

                // If this route is within tolerance, prefer it
                if (routeSteps >= minAcceptableSteps && routeSteps <= maxAcceptableSteps) {
                  if (score < bestScore) {
                    bestScore = score;
                    bestRoute = {
                      distance: totalDistanceKm,
                      duration: calculateTime(totalDistanceKm),
                      calories: calculateCalories(totalDistanceKm),
                      steps: routeSteps,
                      coordinates: [...outboundRoute.geometry.coordinates, ...bestReturnRoute.geometry.coordinates],
                      outboundCoordinates: outboundRoute.geometry.coordinates,
                      returnCoordinates: bestReturnRoute.geometry.coordinates
                    };
                    bestDestination = testDestination;
                  }
                } else if (!bestRoute) {
                  if (score < bestScore) {
                    bestScore = score;
                    bestRoute = {
                      distance: totalDistanceKm,
                      duration: calculateTime(totalDistanceKm),
                      calories: calculateCalories(totalDistanceKm),
                      steps: routeSteps,
                      coordinates: [...outboundRoute.geometry.coordinates, ...bestReturnRoute.geometry.coordinates],
                      outboundCoordinates: outboundRoute.geometry.coordinates,
                      returnCoordinates: bestReturnRoute.geometry.coordinates
                    };
                    bestDestination = testDestination;
                  }
                }
              }
            }
          } else {
            // One-way route logic (unchanged)
            const coordinates = `${userLoc.lng},${userLoc.lat};${testDestination.lng},${testDestination.lat}`;
            const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
              const route = data.routes[0];
              const routeDistanceKm = route.distance / 1000;
              const routeSteps = Math.round((routeDistanceKm * 1000) / strideM);
              
              const stepDifference = Math.abs(routeSteps - targetSteps);
              const score = stepDifference / targetSteps;

              if (routeSteps >= minAcceptableSteps && routeSteps <= maxAcceptableSteps) {
                if (score < bestScore) {
                  bestScore = score;
                  bestRoute = {
                    distance: routeDistanceKm,
                    duration: calculateTime(routeDistanceKm),
                    calories: calculateCalories(routeDistanceKm),
                    steps: routeSteps,
                    coordinates: route.geometry.coordinates
                  };
                  bestDestination = testDestination;
                }
              } else if (!bestRoute) {
                if (score < bestScore) {
                  bestScore = score;
                  bestRoute = {
                    distance: routeDistanceKm,
                    duration: calculateTime(routeDistanceKm),
                    calories: calculateCalories(routeDistanceKm),
                    steps: routeSteps,
                    coordinates: route.geometry.coordinates
                  };
                  bestDestination = testDestination;
                }
              }
            }
          }
        } catch (error) {
          console.log(`Error testing route at bearing ${bearing}, multiplier ${multiplier}:`, error);
        }
      }
    }

    return { route: bestRoute, destination: bestDestination };
  }, [mapboxToken, planningData, calculateTime, calculateCalories]);

  // Helper function to calculate route overlap
  const calculateRouteOverlap = useCallback((outboundCoords: number[][], returnCoords: number[][]) => {
    const overlapThresholdKm = 0.05; // 50m threshold for considering overlap
    let overlapCount = 0;
    let totalReturnSegments = 0;
    
    for (let i = 0; i < returnCoords.length - 1; i++) {
      totalReturnSegments++;
      const returnPoint = returnCoords[i];
      
      // Check if this return point is close to any outbound segment
      for (let j = 0; j < outboundCoords.length - 1; j++) {
        const outboundPoint = outboundCoords[j];
        const distance = getDistanceBetweenPoints(
          { lat: returnPoint[1], lng: returnPoint[0] },
          { lat: outboundPoint[1], lng: outboundPoint[0] }
        );
        
        if (distance <= overlapThresholdKm) {
          overlapCount++;
          break; // Found overlap for this segment
        }
      }
    }
    
    return totalReturnSegments > 0 ? overlapCount / totalReturnSegments : 0;
  }, []);

  // Helper function to calculate distance between two points in km
  const getDistanceBetweenPoints = useCallback((point1: { lat: number; lng: number }, point2: { lat: number; lng: number }) => {
    const earthRadiusKm = 6371;
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }, []);

  // Calculate default destination position (fallback method)
  const calculateDefaultDestination = useCallback((userLoc: { lat: number; lng: number }) => {
    const targetKm = getTargetDistance();
    const bearing = 45; // Fixed bearing in degrees
    // For round-trip, use less than half target distance to account for street routing
    // For one-way, use the full target distance as radius
    const radiusKm = planningData.tripType === 'round-trip' ? targetKm / 2.5 : targetKm;

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
      
      if (planningData.tripType === 'round-trip') {
        // For round-trip, generate separate outbound and return paths that avoid overlap
        const outboundCoords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
        const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${outboundCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
        const outboundResponse = await fetch(outboundUrl);
        const outboundData = await outboundResponse.json();
        
        if (outboundData.routes && outboundData.routes.length > 0) {
          const outboundRoute = outboundData.routes[0];
          const outboundDistanceKm = outboundRoute.distance / 1000;
          
          // Generate alternative return paths using intermediate waypoints
          const centerLat = (start.lat + end.lat) / 2;
          const centerLng = (start.lng + end.lng) / 2;
          
          const directBearing = Math.atan2(start.lat - end.lat, start.lng - end.lng) * 180 / Math.PI;
          const perpendicularBearings = [directBearing + 90, directBearing - 90];
          
          let bestReturnRoute = null;
          let bestReturnScore = Infinity;
          
          // Try return routes through perpendicular waypoints
          for (const perpBearing of perpendicularBearings) {
            for (const distance of [0.3, 0.5]) {
              try {
                const bearingRad = (perpBearing * Math.PI) / 180;
                const earthRadiusKm = 6371;
                
                const waypointLatRad = Math.asin(
                  Math.sin((centerLat * Math.PI) / 180) * Math.cos(distance / earthRadiusKm) +
                  Math.cos((centerLat * Math.PI) / 180) * Math.sin(distance / earthRadiusKm) * Math.cos(bearingRad)
                );
                
                const waypointLngRad = (centerLng * Math.PI) / 180 + Math.atan2(
                  Math.sin(bearingRad) * Math.sin(distance / earthRadiusKm) * Math.cos((centerLat * Math.PI) / 180),
                  Math.cos(distance / earthRadiusKm) - Math.sin((centerLat * Math.PI) / 180) * Math.sin(waypointLatRad)
                );
                
                const waypoint = {
                  lat: (waypointLatRad * 180) / Math.PI,
                  lng: (waypointLngRad * 180) / Math.PI
                };
                
                const returnCoords = `${end.lng},${end.lat};${waypoint.lng},${waypoint.lat};${start.lng},${start.lat}`;
                const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${returnCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
                const returnResponse = await fetch(returnUrl);
                const returnData = await returnResponse.json();
                
                if (returnData.routes && returnData.routes.length > 0) {
                  const returnRoute = returnData.routes[0];
                  const overlapScore = calculateRouteOverlap(outboundRoute.geometry.coordinates, returnRoute.geometry.coordinates);
                  
                  if (overlapScore < bestReturnScore) {
                    bestReturnScore = overlapScore;
                    bestReturnRoute = returnRoute;
                  }
                }
              } catch (error) {
                // Continue to next waypoint
              }
            }
          }
          
          // If no good alternative found, try alternatives=true for direct return
          if (!bestReturnRoute || bestReturnScore > 0.3) {
            try {
              const directReturnCoords = `${end.lng},${end.lat};${start.lng},${start.lat}`;
              const directReturnUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${directReturnCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full&alternatives=true`;
              const directReturnResponse = await fetch(directReturnUrl);
              const directReturnData = await directReturnResponse.json();
              
              if (directReturnData.routes && directReturnData.routes.length > 1) {
                // Try alternative routes
                for (const alternativeRoute of directReturnData.routes.slice(1)) {
                  const overlapScore = calculateRouteOverlap(outboundRoute.geometry.coordinates, alternativeRoute.geometry.coordinates);
                  
                  if (overlapScore < bestReturnScore) {
                    bestReturnScore = overlapScore;
                    bestReturnRoute = alternativeRoute;
                  }
                }
              }
              
              // Fallback to primary route if no alternatives
              if (!bestReturnRoute && directReturnData.routes && directReturnData.routes.length > 0) {
                bestReturnRoute = directReturnData.routes[0];
              }
            } catch (error) {
              // Continue with existing best route
            }
          }
          
          if (bestReturnRoute) {
            const returnDistanceKm = bestReturnRoute.distance / 1000;
            const totalDistanceKm = outboundDistanceKm + returnDistanceKm;
            const steps = calculateSteps(totalDistanceKm);
            const durationMin = calculateTime(totalDistanceKm);
            const calories = calculateCalories(totalDistanceKm);

            return {
              distance: totalDistanceKm,
              duration: durationMin,
              calories,
              steps,
              coordinates: [...outboundRoute.geometry.coordinates, ...bestReturnRoute.geometry.coordinates],
              outboundCoordinates: outboundRoute.geometry.coordinates,
              returnCoordinates: bestReturnRoute.geometry.coordinates
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

    map.current.on('load', async () => {
      // Generate optimal route that matches target steps
      setIsLoading(true);
      const optimalResult = await generateOptimalRoute(userLocation);
      
      if (optimalResult?.route && optimalResult?.destination) {
        setDestinationLocation(optimalResult.destination);
        setRouteData(optimalResult.route);
        
        // Notify parent component with complete route data
        if (onRouteCalculated) {
          onRouteCalculated({
            distance: optimalResult.route.distance,
            duration: optimalResult.route.duration,
            calories: optimalResult.route.calories,
            steps: optimalResult.route.steps,
            startCoordinates: { lat: userLocation.lat, lng: userLocation.lng },
            endCoordinates: { lat: optimalResult.destination.lat, lng: optimalResult.destination.lng },
            routeGeoJSON: {
              type: 'LineString',
              coordinates: optimalResult.route.coordinates,
              // Include outbound/return data for round-trip routes
              outboundCoordinates: optimalResult.route.outboundCoordinates,
              returnCoordinates: optimalResult.route.returnCoordinates
            }
          });
        }
      } else {
        // Fallback to default positioning
        const defaultDest = calculateDefaultDestination(userLocation);
        setDestinationLocation(defaultDest);
      }
      setIsLoading(false);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken, userLocation, calculateDefaultDestination, generateOptimalRoute]);

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
          
          // Notify parent component with complete route data
          if (onRouteCalculated) {
            onRouteCalculated({
              distance: route.distance,
              duration: route.duration,
              calories: route.calories,
              steps: route.steps,
              startCoordinates: { lat: userLocation.lat, lng: userLocation.lng },
              endCoordinates: { lat: destinationLocation.lat, lng: destinationLocation.lng },
              routeGeoJSON: {
                type: 'LineString',
                coordinates: route.coordinates,
                // Include outbound/return data for round-trip routes
                outboundCoordinates: route.outboundCoordinates,
                returnCoordinates: route.returnCoordinates
              }
            });
          }
          
          // Add route line(s) to map
          if (map.current && map.current.isStyleLoaded()) {
            // Remove existing routes
            ['walking-route', 'outbound-route', 'return-route'].forEach(routeId => {
              if (map.current?.getLayer(routeId)) {
                map.current.removeLayer(routeId);
              }
              if (map.current?.getSource(routeId)) {
                map.current.removeSource(routeId);
              }
            });

            if (route.outboundCoordinates && route.returnCoordinates) {
              // Round-trip: Show distinct outbound and return paths
              
              // Outbound route (green solid)
              map.current.addSource('outbound-route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: route.outboundCoordinates
                  }
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
                  'line-width': 5,
                  'line-opacity': 0.9
                }
              });

              // Return route (blue dashed)
              map.current.addSource('return-route', {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates: route.returnCoordinates
                  }
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
                  'line-opacity': 0.8,
                  'line-dasharray': [2, 3]
                }
              });
            } else {
              // One-way: Show single route
              map.current.addSource('walking-route', {
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
                id: 'walking-route',
                type: 'line',
                source: 'walking-route',
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
            }

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

  const resetToDefault = async () => {
    if (userLocation) {
      setIsLoading(true);
      const optimalResult = await generateOptimalRoute(userLocation);
      
      if (optimalResult?.route && optimalResult?.destination) {
        setDestinationLocation(optimalResult.destination);
        setRouteData(optimalResult.route);
        
        // Notify parent component with complete route data
        if (onRouteCalculated) {
          onRouteCalculated({
            distance: optimalResult.route.distance,
            duration: optimalResult.route.duration,
            calories: optimalResult.route.calories,
            steps: optimalResult.route.steps,
            startCoordinates: { lat: userLocation.lat, lng: userLocation.lng },
            endCoordinates: { lat: optimalResult.destination.lat, lng: optimalResult.destination.lng },
            routeGeoJSON: {
              type: 'LineString',
              coordinates: optimalResult.route.coordinates,
              // Include outbound/return data for round-trip routes
              outboundCoordinates: optimalResult.route.outboundCoordinates,
              returnCoordinates: optimalResult.route.returnCoordinates
            }
          });
        }
      } else {
        const defaultDest = calculateDefaultDestination(userLocation);
        setDestinationLocation(defaultDest);
      }
      setIsLoading(false);
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
            
            {/* Route type indicator for round-trip */}
            {planningData.tripType === 'round-trip' && routeData.outboundCoordinates && routeData.returnCoordinates && (
              <div className="flex items-center space-x-4 mb-3 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-0.5 bg-emerald-500"></div>
                  <span className="text-muted-foreground">Aller</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-0.5 bg-blue-500 border-dashed border-t border-blue-500" style={{borderTopStyle: 'dashed'}}></div>
                  <span className="text-muted-foreground">Retour</span>
                </div>
              </div>
            )}
            
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