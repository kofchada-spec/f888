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

  // Compute route using Mapbox Directions API with step validation
  const computeRoute = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }): Promise<RouteData | null> => {
    if (!mapboxToken) return null;

    try {
      const profile = 'walking';
      
      if (planningData.tripType === 'round-trip') {
        // For round-trip, create non-retracing outbound and return routes
        const outboundCoords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
        const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${outboundCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
        const outboundResponse = await fetch(outboundUrl);
        const outboundData = await outboundResponse.json();
        
        if (outboundData.routes && outboundData.routes.length > 0) {
          const outboundRoute = outboundData.routes[0];
          const targetSteps = parseInt(planningData.steps);
          
          // Create non-retracing return route using strategic waypoints
          const returnRoute = await computeNonRetracingReturn(start, end, outboundRoute.geometry.coordinates, targetSteps);
          
          if (returnRoute) {
            const totalDistanceKm = (outboundRoute.distance + returnRoute.distance) / 1000;
            const steps = calculateSteps(totalDistanceKm);
            const durationMin = calculateTime(totalDistanceKm);
            const calories = calculateCalories(totalDistanceKm);

            // Validate that total steps are within ±5% of target
            const stepDeviation = Math.abs(steps - targetSteps) / targetSteps;
            
            if (stepDeviation <= 0.05) {
              console.log(`Valid A-R route: ${steps} steps (target: ${targetSteps}, deviation: ${(stepDeviation * 100).toFixed(1)}%)`);
              return {
                distance: totalDistanceKm,
                duration: durationMin,
                calories,
                steps,
                coordinates: [...outboundRoute.geometry.coordinates, ...returnRoute.geometry.coordinates],
                outboundCoordinates: outboundRoute.geometry.coordinates,
                returnCoordinates: returnRoute.geometry.coordinates
              };
            } else {
              console.warn(`A-R route step deviation too high: ${(stepDeviation * 100).toFixed(1)}% (target: ±5%)`);
              throw new Error(`Route step count (${steps}) exceeds ±5% tolerance for target (${targetSteps})`);
            }
          } else {
            throw new Error('No different return route found within your step goal. Please adjust your target.');
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

  // Compute non-retracing return route using aggressive different path strategy
  const computeNonRetracingReturn = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }, outboundCoords: number[][], targetSteps: number): Promise<any> => {
    if (!mapboxToken || outboundCoords.length < 2) return null;

    try {
      // Step 1: Try Mapbox alternatives first (most likely to succeed)
      const returnCoords = `${end.lng},${end.lat};${start.lng},${start.lat}`;
      const alternativesUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${returnCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full&alternatives=true&alternative_count=5`;
      
      const alternativesResponse = await fetch(alternativesUrl);
      const alternativesData = await alternativesResponse.json();
      
      if (alternativesData.routes && alternativesData.routes.length > 1) {
        // Evaluate all alternative routes for overlap and step count
        let bestRoute = null;
        let bestScore = Infinity;
        
        for (let i = 1; i < alternativesData.routes.length; i++) { // Skip index 0 (shortest route)
          const route = alternativesData.routes[i];
          const overlap = calculatePathOverlap(outboundCoords, route.geometry.coordinates);
          
          // Calculate total steps for outbound + return
          const outboundDistance = outboundCoords.reduce((total, coord, index) => {
            if (index === 0) return 0;
            return total + calculateDistance(outboundCoords[index - 1], coord);
          }, 0);
          
          const returnDistance = route.distance / 1000; // Convert to km
          const totalDistance = outboundDistance + returnDistance;
          const totalSteps = Math.round((totalDistance * 1000) / (parseFloat(planningData.height) * 0.415 || 0.72));
          const stepDeviation = Math.abs(totalSteps - targetSteps) / targetSteps;
          
          // Score: prioritize low overlap and meeting step target
          const score = overlap * 2 + stepDeviation; // Overlap weighted more heavily
          
          if (overlap < 0.15 && stepDeviation <= 0.05 && score < bestScore) { // Max 15% overlap, ±5% steps
            bestScore = score;
            bestRoute = route;
          }
        }
        
        if (bestRoute) {
          console.log(`Found alternative return route with ${(bestScore * 100).toFixed(1)}% overlap`);
          return bestRoute;
        }
      }
      
      // Step 2: Aggressive waypoint strategy with multiple perpendicular offsets
      const aggressiveWaypoints = calculateAggressiveAvoidanceWaypoints(start, end, outboundCoords);
      
      const waypointStrategies = [
        aggressiveWaypoints.slice(0, 2), // First 2 waypoints
        aggressiveWaypoints.slice(-2), // Last 2 waypoints
        [aggressiveWaypoints[0], aggressiveWaypoints[Math.floor(aggressiveWaypoints.length/2)]], // First and middle
        aggressiveWaypoints // All waypoints (last resort)
      ];

      for (const waypoints of waypointStrategies) {
        try {
          const waypointCoords = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
          const waypointedCoords = `${end.lng},${end.lat};${waypointCoords};${start.lng},${start.lat}`;
          
          const waypointUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${waypointedCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
          const waypointResponse = await fetch(waypointUrl);
          const waypointData = await waypointResponse.json();
          
          if (waypointData.routes && waypointData.routes.length > 0) {
            const route = waypointData.routes[0];
            const overlap = calculatePathOverlap(outboundCoords, route.geometry.coordinates);
            
            // Calculate step validation for waypoint route
            const outboundDistance = outboundCoords.reduce((total, coord, index) => {
              if (index === 0) return 0;
              return total + calculateDistance(outboundCoords[index - 1], coord);
            }, 0);
            
            const returnDistance = route.distance / 1000;
            const totalDistance = outboundDistance + returnDistance;
            const totalSteps = Math.round((totalDistance * 1000) / (parseFloat(planningData.height) * 0.415 || 0.72));
            const stepDeviation = Math.abs(totalSteps - targetSteps) / targetSteps;
            
            if (overlap < 0.1 && stepDeviation <= 0.05) { // Very strict criteria: <10% overlap, ±5% steps
              console.log(`Found waypointed return route with ${(overlap * 100).toFixed(1)}% overlap`);
              return route;
            }
          }
        } catch (error) {
          continue;
        }
      }

      // Step 3: Last resort - use best alternative even if not perfect
      if (alternativesData.routes && alternativesData.routes.length > 1) {
        let fallbackRoute = null;
        let minOverlap = 1.0;
        
        for (let i = 1; i < alternativesData.routes.length; i++) {
          const route = alternativesData.routes[i];
          const overlap = calculatePathOverlap(outboundCoords, route.geometry.coordinates);
          
          if (overlap < minOverlap) {
            minOverlap = overlap;
            fallbackRoute = route;
          }
        }
        
        if (fallbackRoute && minOverlap < 0.4) { // Accept up to 40% overlap as last resort
          console.warn(`Using fallback return route with ${(minOverlap * 100).toFixed(1)}% overlap`);
          return fallbackRoute;
        }
      }

      throw new Error('No suitable different return route found');
      
    } catch (error) {
      console.error('Error computing non-retracing return:', error);
      return null;
    }
  }, [mapboxToken, planningData.height]);

  // Helper function to calculate distance between two coordinates  
  const calculateDistance = useCallback((coord1: number[], coord2: number[]): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Calculate aggressive waypoints that force route to use different streets
  const calculateAggressiveAvoidanceWaypoints = useCallback((start: { lat: number; lng: number }, end: { lat: number; lng: number }, outboundCoords: number[][]) => {
    const waypoints = [];
    const numWaypoints = Math.min(4, Math.max(2, Math.floor(outboundCoords.length / 15))); // 2-4 waypoints
    
    // Calculate more aggressive perpendicular offsets from key points on outbound path
    for (let i = 1; i <= numWaypoints; i++) {
      const segmentIndex = Math.floor((outboundCoords.length * i) / (numWaypoints + 1));
      const point = outboundCoords[segmentIndex];
      
      if (point && segmentIndex > 0 && segmentIndex < outboundCoords.length - 1) {
        // Calculate bearing of the outbound path at this point
        const prevPoint = outboundCoords[segmentIndex - 1];
        const nextPoint = outboundCoords[segmentIndex + 1];
        
        const bearing = Math.atan2(
          nextPoint[0] - prevPoint[0],
          nextPoint[1] - prevPoint[1]
        );
        
        // Create multiple waypoints with different offset strategies
        const offsetDistances = [0.0015, 0.0020, 0.0025]; // ~100-200m in degrees - more aggressive
        const perpendicularAngles = [Math.PI / 2, -Math.PI / 2, Math.PI / 3, -Math.PI / 3]; // Different angles
        
        for (const offsetDistance of offsetDistances) {
          for (const angle of perpendicularAngles) {
            const perpendicularBearing = bearing + angle;
            
            const waypoint = {
              lat: point[1] + Math.cos(perpendicularBearing) * offsetDistance,
              lng: point[0] + Math.sin(perpendicularBearing) * offsetDistance
            };
            
            waypoints.push(waypoint);
            
            // Limit total waypoints to avoid overly complex routes
            if (waypoints.length >= 6) break;
          }
          if (waypoints.length >= 6) break;
        }
      }
    }
    
    return waypoints;
  }, []);

  // Calculate overlap percentage between two paths
  const calculatePathOverlap = useCallback((path1: number[][], path2: number[][]) => {
    if (!path1.length || !path2.length) return 0;
    
    const bufferRadius = 0.0001; // ~10m buffer in degrees
    let overlapCount = 0;
    
    // Sample points from path2 and check how many are close to path1
    const sampleSize = Math.min(50, path2.length); // Sample max 50 points
    const sampleStep = Math.floor(path2.length / sampleSize);
    
    for (let i = 0; i < path2.length; i += sampleStep) {
      const point2 = path2[i];
      
      for (const point1 of path1) {
        const distance = Math.sqrt(
          Math.pow(point2[0] - point1[0], 2) + 
          Math.pow(point2[1] - point1[1], 2)
        );
        
        if (distance < bufferRadius) {
          overlapCount++;
          break; // Found overlap for this point, move to next
        }
      }
    }
    
    return overlapCount / sampleSize;
  }, []);

  // Smart route generation that targets specific step count
  const generateOptimalRoute = useCallback(async (userLoc: { lat: number; lng: number }): Promise<{ route: RouteData; destination: { lat: number; lng: number } } | null> => {
    if (!mapboxToken) return null;

    const targetSteps = parseInt(planningData.steps);
    const heightM = parseFloat(planningData.height);
    const strideM = heightM ? 0.415 * heightM : 0.72;
    const targetDistanceKm = (targetSteps * strideM) / 1000;

    // Try different bearings and distances to find the best match
    const bearings = [45, 90, 135, 180, 225, 270, 315, 0];
    const distanceMultipliers = [0.8, 0.9, 1.0, 1.1, 1.2, 0.7, 1.3, 0.6, 1.4];

    let bestRoute = null;
    let bestScore = Infinity;
    let bestDestination = null;

    for (const bearing of bearings) {
      for (const multiplier of distanceMultipliers) {
        try {
          const testRadius = planningData.tripType === 'round-trip' ? 
            (targetDistanceKm / 2.5) * multiplier :
            targetDistanceKm * multiplier * 0.8;

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
            }
          }
        } catch (error) {
          continue;
        }
      }
    }

    if (bestRoute && bestDestination) {
      console.log(`Found valid route: ${bestRoute.steps} steps (target: ${targetSteps}, deviation: ${(bestScore * 100).toFixed(1)}%)`);
      return { route: bestRoute, destination: bestDestination };
    }

    console.warn(`No valid route found within ±5% tolerance. Target: ${targetSteps} steps`);
    return null;
  }, [mapboxToken, planningData, computeRoute, validateRouteSteps]);

  // Validate and adjust clicked route to meet step requirements
  const validateAndAdjustRoute = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }): Promise<{ route: RouteData; destination: { lat: number; lng: number } } | null> => {
    const targetSteps = parseInt(planningData.steps);
    
    // First try the exact route
    const initialRoute = await computeRoute(start, end);
    if (initialRoute && validateRouteSteps(initialRoute, targetSteps)) {
      return { route: initialRoute, destination: end };
    }
    
    // If route doesn't match, try to adjust by finding nearby destinations
    const adjustmentDistances = [0.1, 0.2, 0.3, 0.5];
    const bearings = [0, 45, 90, 135, 180, 225, 270, 315];
    
    for (const distance of adjustmentDistances) {
      for (const bearing of bearings) {
        try {
          const bearingRad = (bearing * Math.PI) / 180;
          const earthRadiusKm = 6371;
          
          const adjustedLatRad = Math.asin(
            Math.sin((end.lat * Math.PI) / 180) * Math.cos(distance / earthRadiusKm) +
            Math.cos((end.lat * Math.PI) / 180) * Math.sin(distance / earthRadiusKm) * Math.cos(bearingRad)
          );
          
          const adjustedLngRad = (end.lng * Math.PI) / 180 + Math.atan2(
            Math.sin(bearingRad) * Math.sin(distance / earthRadiusKm) * Math.cos((end.lat * Math.PI) / 180),
            Math.cos(distance / earthRadiusKm) - Math.sin((end.lat * Math.PI) / 180) * Math.sin(adjustedLatRad)
          );
          
          const adjustedDestination = {
            lat: (adjustedLatRad * 180) / Math.PI,
            lng: (adjustedLngRad * 180) / Math.PI
          };
          
          const adjustedRoute = await computeRoute(start, adjustedDestination);
          if (adjustedRoute && validateRouteSteps(adjustedRoute, targetSteps)) {
            console.log(`Adjusted route found: ${adjustedRoute.steps} steps (target: ${targetSteps})`);
            return { route: adjustedRoute, destination: adjustedDestination };
          }
        } catch (error) {
          continue;
        }
      }
    }
    
    return null;
  }, [computeRoute, validateRouteSteps, planningData.steps]);

  // Calculate default destination position
  const calculateDefaultDestination = useCallback((userLoc: { lat: number; lng: number }) => {
    const targetDistance = getTargetDistance();
    const radius = planningData.tripType === 'round-trip' ? targetDistance / 2.5 : targetDistance * 0.8;
    const bearing = 45;
    const bearingRad = (bearing * Math.PI) / 180;
    const earthRadiusKm = 6371;

    const userLatRad = (userLoc.lat * Math.PI) / 180;
    const userLngRad = (userLoc.lng * Math.PI) / 180;

    const destLatRad = Math.asin(
      Math.sin(userLatRad) * Math.cos(radius / earthRadiusKm) +
      Math.cos(userLatRad) * Math.sin(radius / earthRadiusKm) * Math.cos(bearingRad)
    );

    const destLngRad = userLngRad + Math.atan2(
      Math.sin(bearingRad) * Math.sin(radius / earthRadiusKm) * Math.cos(userLatRad),
      Math.cos(radius / earthRadiusKm) - Math.sin(userLatRad) * Math.sin(destLatRad)
    );

    return {
      lat: (destLatRad * 180) / Math.PI,
      lng: (destLngRad * 180) / Math.PI
    };
  }, [getTargetDistance, planningData.tripType]);

  // Initialize map only once (prevent re-initialization)
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !userLocation || map.current) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [userLocation.lng, userLocation.lat],
      zoom: 14
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Store initial values to avoid dependency changes
    const initialUserLocation = userLocation;
    const targetSteps = parseInt(planningData.steps);
    
    // Handle map click for destination selection with validation
    map.current.on('click', async (e) => {
      const clickedDestination = {
        lat: e.lngLat.lat,
        lng: e.lngLat.lng
      };
      
      setIsLoading(true);
      
      try {
        const validatedResult = await validateAndAdjustRoute(initialUserLocation, clickedDestination);
        
        if (validatedResult) {
          setDestinationLocation(validatedResult.destination);
          setRouteData(validatedResult.route);
          
          // Simplified route data to prevent DataCloneError
          const simpleRouteData = {
            distance: validatedResult.route.distance,
            duration: validatedResult.route.duration,
            calories: validatedResult.route.calories,
            steps: validatedResult.route.steps,
            startCoordinates: { lat: initialUserLocation.lat, lng: initialUserLocation.lng },
            endCoordinates: validatedResult.destination,
            routeGeoJSON: {
              type: 'LineString',
              coordinates: validatedResult.route.coordinates.slice(), // Clone coordinates array
              outboundCoordinates: validatedResult.route.outboundCoordinates ? validatedResult.route.outboundCoordinates.slice() : undefined,
              returnCoordinates: validatedResult.route.returnCoordinates ? validatedResult.route.returnCoordinates.slice() : undefined
            }
          };
          
          if (onRouteCalculated) {
            onRouteCalculated(simpleRouteData);
          }
        } else {
          const tolerance = Math.round(targetSteps * 0.05);
          console.warn(`No valid route found. Target: ${targetSteps} steps (±${tolerance} tolerance)`);
          
          if (planningData.tripType === 'round-trip') {
            alert(`Aucun itinéraire aller-retour avec des trajets différents trouvé pour votre objectif de pas.\n\nObjectif: ${targetSteps} pas (tolérance: ±${tolerance} pas)\n\nVeuillez:\n• Ajuster votre destination\n• Modifier votre objectif de pas\n• Ou essayer un autre lieu`);
          } else {
            alert(`Aucun itinéraire trouvé correspondant à votre objectif de pas.\n\nObjectif: ${targetSteps} pas (tolérance: ±${tolerance} pas)\nVeuillez ajuster votre destination ou votre objectif de pas.`);
          }
        }
      } catch (error) {
        console.error('Error calculating route:', error);
        alert('Erreur lors du calcul de l\'itinéraire. Veuillez réessayer.');
      }
      
      setIsLoading(false);
    });

    // Generate optimal route on map load (only once)
    map.current.on('load', async () => {
      setIsLoading(true);
      
      try {
        const optimalResult = await generateOptimalRoute(initialUserLocation);
        
        if (optimalResult?.route && optimalResult?.destination) {
          setDestinationLocation(optimalResult.destination);
          setRouteData(optimalResult.route);
          
          // Simplified route data to prevent DataCloneError
          const simpleRouteData = {
            distance: optimalResult.route.distance,
            duration: optimalResult.route.duration,
            calories: optimalResult.route.calories,
            steps: optimalResult.route.steps,
            startCoordinates: { lat: initialUserLocation.lat, lng: initialUserLocation.lng },
            endCoordinates: { lat: optimalResult.destination.lat, lng: optimalResult.destination.lng },
            routeGeoJSON: {
              type: 'LineString',
              coordinates: optimalResult.route.coordinates.slice(), // Clone coordinates array
              outboundCoordinates: optimalResult.route.outboundCoordinates ? optimalResult.route.outboundCoordinates.slice() : undefined,
              returnCoordinates: optimalResult.route.returnCoordinates ? optimalResult.route.returnCoordinates.slice() : undefined
            }
          };
          
          if (onRouteCalculated) {
            onRouteCalculated(simpleRouteData);
          }
        } else {
          console.warn(`No route found matching step goal. Target: ${targetSteps} steps`);
          // Set default destination without route
          const defaultDest = calculateDefaultDestination(initialUserLocation);
          setDestinationLocation(defaultDest);
        }
      } catch (error) {
        console.error('Error generating optimal route:', error);
        // Set default destination on error
        const defaultDest = calculateDefaultDestination(initialUserLocation);
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
  }, [mapboxToken, userLocation]); // Only essential dependencies

  // Static route display - only update when route data changes, not on user location updates  
  useEffect(() => {
    if (!map.current || !routeData || !destinationLocation || !userLocation) return;

    // Wait for map to be loaded before drawing
    const addRouteToMap = () => {
      if (!map.current?.isStyleLoaded()) {
        map.current?.on('styledata', addRouteToMap);
        return;
      }

      // Remove existing routes (clean slate)
      ['walking-route', 'outbound-route', 'return-route'].forEach(routeId => {
        if (map.current?.getLayer(routeId)) {
          map.current.removeLayer(routeId);
        }
        if (map.current?.getSource(routeId)) {
          map.current.removeSource(routeId);
        }
      });

      try {
        if (routeData.outboundCoordinates && routeData.returnCoordinates) {
          // Round-trip: Show distinct outbound and return paths
          
          // Outbound route (green solid) - STATIC
          map.current.addSource('outbound-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeData.outboundCoordinates
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
              'line-color': '#10b981', // STATIC green - NO ANIMATION
              'line-width': 5,
              'line-opacity': 0.9
            }
          });

          // Return route (blue dashed) - STATIC
          map.current.addSource('return-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeData.returnCoordinates
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
              'line-color': '#3b82f6', // STATIC blue - NO ANIMATION
              'line-width': 4,
              'line-opacity': 0.8,
              'line-dasharray': [2, 3] // Static dashed line
            }
          });
        } else {
          // One-way: Show single route - STATIC
          map.current.addSource('walking-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeData.coordinates
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
              'line-color': '#10b981', // STATIC green - NO ANIMATION
              'line-width': 4,
              'line-opacity': 0.8
            }
          });
        }

        // Fit map to show entire route ONCE
        const bounds = new mapboxgl.LngLatBounds();
        routeData.coordinates.forEach((coord: number[]) => bounds.extend([coord[0], coord[1]]));
        map.current.fitBounds(bounds, { padding: 50 });
        
        console.log('Route displayed successfully - STATIC, no more updates');
      } catch (error) {
        console.error('Error displaying route:', error);
      }
    };

    addRouteToMap();
  }, [routeData]); // Only depend on routeData, not user location

  // Separate effect for markers only - prevent route redraw
  useEffect(() => {
    if (!map.current || !userLocation) return;

    // Update/create user marker
    if (userMarker.current) {
      // Just update position, don't recreate
      userMarker.current.setLngLat([userLocation.lng, userLocation.lat]);
    } else {
      const userEl = document.createElement('div');
      userEl.className = 'user-marker';
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
    }

    // Update/create destination marker
    if (destinationLocation) {
      if (destinationMarker.current) {
        // Just update position, don't recreate
        destinationMarker.current.setLngLat([destinationLocation.lng, destinationLocation.lat]);
      } else {
        const destEl = document.createElement('div');
        destEl.innerHTML = `
          <div style="
            width: 30px;
            height: 30px;
            background: #10b981;
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            font-size: 16px;
          ">🎯</div>
        `;

        destinationMarker.current = new mapboxgl.Marker(destEl)
          .setLngLat([destinationLocation.lng, destinationLocation.lat])
          .addTo(map.current);
      }
    }
  }, [userLocation, destinationLocation]); // Update markers when locations change

  const resetToDefault = async () => {
    if (!userLocation) return;
    
    setIsLoading(true);
    
    try {
      const optimalResult = await generateOptimalRoute(userLocation);
      
      if (optimalResult?.route && optimalResult?.destination) {
        setDestinationLocation(optimalResult.destination);
        setRouteData(optimalResult.route);
        
        // Simplified route data to prevent DataCloneError
        const simpleRouteData = {
          distance: optimalResult.route.distance,
          duration: optimalResult.route.duration,
          calories: optimalResult.route.calories,
          steps: optimalResult.route.steps,
          startCoordinates: { lat: userLocation.lat, lng: userLocation.lng },
          endCoordinates: { lat: optimalResult.destination.lat, lng: optimalResult.destination.lng },
          routeGeoJSON: {
            type: 'LineString',
            coordinates: optimalResult.route.coordinates.slice(),
            outboundCoordinates: optimalResult.route.outboundCoordinates ? optimalResult.route.outboundCoordinates.slice() : undefined,
            returnCoordinates: optimalResult.route.returnCoordinates ? optimalResult.route.returnCoordinates.slice() : undefined
          }
        };
        
        if (onRouteCalculated) {
          onRouteCalculated(simpleRouteData);
        }
      } else {
        const targetSteps = parseInt(planningData.steps);
        const tolerance = Math.round(targetSteps * 0.05);
        console.warn(`No optimal route found. Target: ${targetSteps} steps (±${tolerance} tolerance)`);
        
        // Show user-friendly error message based on trip type
        if (planningData.tripType === 'round-trip') {
          alert(`Aucun itinéraire aller-retour optimal trouvé avec des trajets différents.\n\nObjectif: ${targetSteps} pas (±${tolerance} tolérance)\n\nSuggestions:\n• Ajustez votre objectif de pas\n• Essayez un autre lieu de départ\n• Ou utilisez le mode "Aller simple"`);
        } else {
          alert(`Aucun itinéraire optimal trouvé.\n\nObjectif: ${targetSteps} pas\nVeuillez ajuster votre objectif de pas ou réessayer.`);
        }
        
        // Set default destination position
        const defaultDest = calculateDefaultDestination(userLocation);
        setDestinationLocation(defaultDest);
      }
    } catch (error) {
      console.error('Error resetting to default route:', error);
      alert('Erreur lors de la génération de l\'itinéraire. Veuillez réessayer.');
    }
    
    setIsLoading(false);
  };

  if (!mapboxToken || !userLocation) {
    return (
      <div className={`h-96 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground mb-2">
            {permissionDenied ? "Géolocalisation refusée" : "Chargement de la carte..."}
          </p>
          {permissionDenied && (
            <p className="text-xs text-muted-foreground">
              Position par défaut: Paris
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`h-96 relative rounded-2xl overflow-hidden shadow-lg ${className}`}>
      <div 
        ref={mapContainer} 
        className="absolute inset-0 w-full h-full" 
      />
      
      {/* Route summary */}
      {routeData && (
        <div className="absolute top-4 left-4 bg-white/95 dark:bg-black/95 rounded-lg p-4 shadow-lg max-w-xs">
          <h3 className="font-semibold text-sm mb-2 flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-primary" />
            Itinéraire planifié
          </h3>
          
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
                <div className="font-medium">{routeData.distance.toFixed(1)} km</div>
                <div className="text-xs text-muted-foreground">Distance</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <div>
                <div className="font-medium">{routeData.duration} min</div>
                <div className="text-xs text-muted-foreground">Durée</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-orange-500" />
              <div>
                <div className="font-medium">{routeData.calories}</div>
                <div className="text-xs text-muted-foreground">kcal</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                👣
              </div>
              <div>
                <div className="font-medium text-green-600">{routeData.steps}</div>
                <div className="text-xs text-muted-foreground">pas</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-2xl">
          <div className="bg-white/95 dark:bg-black/95 rounded-lg p-4 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span className="text-sm font-medium">Calcul de l'itinéraire optimal...</span>
          </div>
        </div>
      )}

      {/* Reset button */}
      <div className="absolute top-4 right-4">
        <Button
          onClick={resetToDefault}
          size="sm"
          variant="outline"
          className="bg-white/95 dark:bg-black/95 backdrop-blur-sm"
          disabled={isLoading}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Réinitialiser
        </Button>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 right-4 bg-white/95 dark:bg-black/95 rounded-lg p-3 text-center">
        <p className="text-sm text-muted-foreground">
          📍 Tapez sur la carte pour placer votre destination
        </p>
      </div>
    </div>
  );
};

export default EnhancedMap;