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
  const defaultDestinationMarkers = useRef<mapboxgl.Marker[]>([]);
  
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showWarningMessage, setShowWarningMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [defaultDestinations, setDefaultDestinations] = useState<Array<{ destination: { lat: number; lng: number }; route: RouteData; label: string }>>([]);
  const [selectedDestinationIndex, setSelectedDestinationIndex] = useState<number | null>(null);

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
          
          // Create non-retracing return route using strategic waypoints
          const returnRoute = await computeNonRetracingReturn(start, end, outboundRoute.geometry.coordinates);
          
          if (returnRoute) {
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

  // Compute non-retracing return route using strategic waypoints
  const computeNonRetracingReturn = useCallback(async (start: { lat: number; lng: number }, end: { lat: number; lng: number }, outboundCoords: number[][]): Promise<any> => {
    if (!mapboxToken || outboundCoords.length < 2) return null;

    try {
      // Calculate strategic waypoints to avoid outbound path
      const waypoints = calculateAvoidanceWaypoints(start, end, outboundCoords);
      
      // Try different waypoint combinations to find the best non-retracing route
      const waypointAttempts = [
        waypoints, // All waypoints
        [waypoints[0], waypoints[waypoints.length - 1]], // Just first and last
        waypoints.filter((_, i) => i % 2 === 0) // Every other waypoint
      ];

      for (const currentWaypoints of waypointAttempts) {
        try {
          // Build coordinates string with waypoints: end -> waypoint1 -> waypoint2 -> start
          const waypointCoords = currentWaypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
          const returnCoords = `${end.lng},${end.lat};${waypointCoords};${start.lng},${start.lat}`;
          
          const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${returnCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full`;
          const returnResponse = await fetch(returnUrl);
          const returnData = await returnResponse.json();
          
          if (returnData.routes && returnData.routes.length > 0) {
            const returnRoute = returnData.routes[0];
            
            // Check if return route sufficiently avoids outbound path
            const overlapPercentage = calculatePathOverlap(outboundCoords, returnRoute.geometry.coordinates);
            
            if (overlapPercentage < 0.3) { // Less than 30% overlap is acceptable
              return returnRoute;
            }
          }
        } catch (error) {
          continue; // Try next waypoint combination
        }
      }

      // Fallback: Use simple alternative route if waypoint approach fails
      const returnCoords = `${end.lng},${end.lat};${start.lng},${start.lat}`;
      const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${returnCoords}?access_token=${mapboxToken}&geometries=geojson&overview=full&alternatives=true`;
      const returnResponse = await fetch(returnUrl);
      const returnData = await returnResponse.json();
      
      if (returnData.routes && returnData.routes.length > 1) {
        // Try alternative routes and pick the one with least overlap
        let bestRoute = null;
        let minOverlap = 1.0;
        
        for (const route of returnData.routes) {
          const overlap = calculatePathOverlap(outboundCoords, route.geometry.coordinates);
          if (overlap < minOverlap) {
            minOverlap = overlap;
            bestRoute = route;
          }
        }
        
        return bestRoute || returnData.routes[1]; // Return best or alternative
      }

      return returnData.routes?.[0] || null; // Fallback to primary route
    } catch (error) {
      console.error('Error computing non-retracing return:', error);
      return null;
    }
  }, [mapboxToken]);

  // Calculate waypoints that force route to avoid outbound path
  const calculateAvoidanceWaypoints = useCallback((start: { lat: number; lng: number }, end: { lat: number; lng: number }, outboundCoords: number[][]) => {
    const waypoints = [];
    const numWaypoints = Math.min(3, Math.max(1, Math.floor(outboundCoords.length / 20))); // 1-3 waypoints based on route length
    
    // Calculate perpendicular offsets from key points on outbound path
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
        
        // Create waypoint perpendicular to outbound path (offset by ~50-100m)
        const offsetDistance = 0.0008; // ~50-100m in degrees
        const perpendicularBearing = bearing + Math.PI / 2; // 90 degrees offset
        
        const waypoint = {
          lat: point[1] + Math.cos(perpendicularBearing) * offsetDistance,
          lng: point[0] + Math.sin(perpendicularBearing) * offsetDistance
        };
        
        waypoints.push(waypoint);
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

  // Generate multiple default destinations that match step target
  const generateDefaultDestinations = useCallback(async (userLoc: { lat: number; lng: number }): Promise<Array<{ destination: { lat: number; lng: number }; route: RouteData; label: string }>> => {
    if (!mapboxToken) return [];

    const targetSteps = parseInt(planningData.steps);
    const heightM = parseFloat(planningData.height);
    const strideM = heightM ? 0.415 * heightM : 0.72;
    const targetDistanceKm = (targetSteps * strideM) / 1000;

    // Try different directions to create variety
    const directions = [
      { bearing: 45, label: "Nord-Est" },
      { bearing: 135, label: "Sud-Est" }, 
      { bearing: 225, label: "Sud-Ouest" },
      { bearing: 315, label: "Nord-Ouest" },
      { bearing: 90, label: "Est" }
    ];

    const validDestinations: Array<{ destination: { lat: number; lng: number }; route: RouteData; label: string }> = [];
    const distanceMultipliers = [0.85, 1.0, 1.15];

    for (const direction of directions) {
      for (const multiplier of distanceMultipliers) {
        try {
          const testRadius = planningData.tripType === 'round-trip' ? 
            (targetDistanceKm / 2.5) * multiplier :
            targetDistanceKm * multiplier * 0.8;

          const bearingRad = (direction.bearing * Math.PI) / 180;
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
            validDestinations.push({
              destination: testDestination,
              route: testRoute,
              label: direction.label
            });
            
            // Stop after finding one valid destination per direction
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      // Limit to 3-4 destinations max
      if (validDestinations.length >= 4) break;
    }

    console.log(`Generated ${validDestinations.length} valid destinations for ${targetSteps} steps`);
    return validDestinations;
  }, [mapboxToken, planningData, computeRoute, validateRouteSteps]);

  // Smart route generation that targets specific step count (keep for compatibility)
  const generateOptimalRoute = useCallback(async (userLoc: { lat: number; lng: number }): Promise<{ route: RouteData; destination: { lat: number; lng: number } } | null> => {
    // Use the first valid destination from the multi-destination generator
    const destinations = await generateDefaultDestinations(userLoc);
    if (destinations.length > 0) {
      return {
        route: destinations[0].route,
        destination: destinations[0].destination
      };
    }
    return null;
  }, [generateDefaultDestinations]);

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
    
    // Handle map click for destination selection with validation and attempt limiting
    map.current.on('click', async (e) => {
      // Check if map is locked or click limit reached
      if (isLocked || clickCount >= 3) {
        return; // Completely ignore clicks
      }

      const clickedDestination = {
        lat: e.lngLat.lat,
        lng: e.lngLat.lng
      };
      
      setIsLoading(true);
      setShowWarningMessage(null);
      
      try {
        const validatedResult = await validateAndAdjustRoute(initialUserLocation, clickedDestination);
        
        if (validatedResult) {
          // Valid click - increment counter and proceed
          const newClickCount = clickCount + 1;
          setClickCount(newClickCount);
          
          // Check if we've reached the limit after this click
          if (newClickCount >= 3) {
            setIsLocked(true);
            setShowWarningMessage("Limite atteinte — utilisez 'Réinitialiser' pour restaurer la marche par défaut.");
          }
          
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
          // Invalid click - do NOT increment counter, show warning
          const tolerance = Math.round(targetSteps * 0.05);
          setShowWarningMessage("Destination hors de votre plage d'objectif de pas.");
          setTimeout(() => setShowWarningMessage(null), 4000);
          console.warn(`Invalid click - out of range. Target: ${targetSteps} steps (±${tolerance} tolerance)`);
        }
      } catch (error) {
        console.error('Error calculating route:', error);
        setShowWarningMessage('Erreur lors du calcul de l\'itinéraire. Veuillez réessayer.');
        setTimeout(() => setShowWarningMessage(null), 4000);
      }
      
      setIsLoading(false);
    });

    // Generate multiple default destinations on map load
    map.current.on('load', async () => {
      setIsLoading(true);
      
      try {
        const destinations = await generateDefaultDestinations(initialUserLocation);
        
        if (destinations.length > 0) {
          setDefaultDestinations(destinations);
          
          // Select the first destination by default
          const firstDestination = destinations[0];
          setDestinationLocation(firstDestination.destination);
          setRouteData(firstDestination.route);
          setSelectedDestinationIndex(0);
          
          // Simplified route data to prevent DataCloneError
          const simpleRouteData = {
            distance: firstDestination.route.distance,
            duration: firstDestination.route.duration,
            calories: firstDestination.route.calories,
            steps: firstDestination.route.steps,
            startCoordinates: { lat: initialUserLocation.lat, lng: initialUserLocation.lng },
            endCoordinates: { lat: firstDestination.destination.lat, lng: firstDestination.destination.lng },
            routeGeoJSON: {
              type: 'LineString',
              coordinates: firstDestination.route.coordinates.slice(),
              outboundCoordinates: firstDestination.route.outboundCoordinates ? firstDestination.route.outboundCoordinates.slice() : undefined,
              returnCoordinates: firstDestination.route.returnCoordinates ? firstDestination.route.returnCoordinates.slice() : undefined
            }
          };
          
          if (onRouteCalculated) {
            onRouteCalculated(simpleRouteData);
          }
        } else {
          console.warn(`No destinations found matching step goal. Target: ${targetSteps} steps`);
          // Set default destination without route
          const defaultDest = calculateDefaultDestination(initialUserLocation);
          setDestinationLocation(defaultDest);
        }
      } catch (error) {
        console.error('Error generating default destinations:', error);
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

    // Update default destination markers
    if (defaultDestinations.length > 0) {
      // Remove existing default markers
      defaultDestinationMarkers.current.forEach(marker => marker.remove());
      defaultDestinationMarkers.current = [];

      // Create new markers for each default destination
      defaultDestinations.forEach((dest, index) => {
        const isSelected = index === selectedDestinationIndex;
        const markerEl = document.createElement('div');
        markerEl.innerHTML = `
          <div style="
            width: 24px;
            height: 24px;
            background: ${isSelected ? '#10b981' : '#6b7280'};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-size: 12px;
            transition: all 0.2s ease;
          " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">${index + 1}</div>
        `;

        const marker = new mapboxgl.Marker(markerEl)
          .setLngLat([dest.destination.lng, dest.destination.lat])
          .addTo(map.current);

        // Add click handler to select this destination
        markerEl.addEventListener('click', () => {
          setSelectedDestinationIndex(index);
          setDestinationLocation(dest.destination);
          setRouteData(dest.route);
          
          if (onRouteCalculated) {
            const simpleRouteData = {
              distance: dest.route.distance,
              duration: dest.route.duration,
              calories: dest.route.calories,
              steps: dest.route.steps,
              startCoordinates: { lat: userLocation.lat, lng: userLocation.lng },
              endCoordinates: dest.destination,
              routeGeoJSON: {
                type: 'LineString',
                coordinates: dest.route.coordinates.slice(),
                outboundCoordinates: dest.route.outboundCoordinates ? dest.route.outboundCoordinates.slice() : undefined,
                returnCoordinates: dest.route.returnCoordinates ? dest.route.returnCoordinates.slice() : undefined
              }
            };
            onRouteCalculated(simpleRouteData);
          }
        });

        defaultDestinationMarkers.current.push(marker);
      });
    }
  }, [userLocation, destinationLocation, defaultDestinations, selectedDestinationIndex, onRouteCalculated]); // Update markers when locations change

  const resetToDefault = async () => {
    if (!userLocation) return;
    
    setIsLoading(true);
    setShowWarningMessage(null);
    
    try {
      const destinations = await generateDefaultDestinations(userLocation);
      
      if (destinations.length > 0) {
        setDefaultDestinations(destinations);
        
        // Select the first destination by default
        const firstDestination = destinations[0];
        setDestinationLocation(firstDestination.destination);
        setRouteData(firstDestination.route);
        setSelectedDestinationIndex(0);
        
        // Reset only restores default route - does NOT unlock the map
        // Do not modify isLocked or clickCount
        
        // Show permanent block message
        setShowWarningMessage("Destinations par défaut rétablies — modifications désactivées.");
        
        // Simplified route data to prevent DataCloneError
        const simpleRouteData = {
          distance: firstDestination.route.distance,
          duration: firstDestination.route.duration,
          calories: firstDestination.route.calories,
          steps: firstDestination.route.steps,
          startCoordinates: { lat: userLocation.lat, lng: userLocation.lng },
          endCoordinates: { lat: firstDestination.destination.lat, lng: firstDestination.destination.lng },
          routeGeoJSON: {
            type: 'LineString',
            coordinates: firstDestination.route.coordinates.slice(),
            outboundCoordinates: firstDestination.route.outboundCoordinates ? firstDestination.route.outboundCoordinates.slice() : undefined,
            returnCoordinates: firstDestination.route.returnCoordinates ? firstDestination.route.returnCoordinates.slice() : undefined
          }
        };
        
        if (onRouteCalculated) {
          onRouteCalculated(simpleRouteData);
        }
      } else {
        const targetSteps = parseInt(planningData.steps);
        const tolerance = Math.round(targetSteps * 0.05);
        console.warn(`No optimal destinations found. Target: ${targetSteps} steps (±${tolerance} tolerance)`);
        
        // Show user-friendly error message
        setShowWarningMessage(`Aucun itinéraire optimal trouvé. Objectif: ${targetSteps} pas. Veuillez ajuster votre objectif de pas ou réessayer.`);
        setTimeout(() => setShowWarningMessage(null), 4000);
        
        // Set default destination position
        const defaultDest = calculateDefaultDestination(userLocation);
        setDestinationLocation(defaultDest);
      }
    } catch (error) {
      console.error('Error resetting to default destinations:', error);
      setShowWarningMessage('Erreur lors de la génération des itinéraires. Veuillez réessayer.');
      setTimeout(() => setShowWarningMessage(null), 4000);
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
      
      {/* Overlay when map is blocked */}
      {isLocked && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-2xl pointer-events-none">
          <div className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gray-600/90">
            🔒 Limite atteinte — utilisez 'Réinitialiser' pour restaurer la marche par défaut.
          </div>
        </div>
      )}
      
      {/* Route summary */}
      {routeData && (
        <div className="absolute top-4 left-4 bg-white/95 dark:bg-black/95 rounded-lg p-4 shadow-lg max-w-xs">
          <h3 className="font-semibold text-sm mb-2 flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-primary" />
            Itinéraire planifié
          </h3>
          
          {/* Click attempts counter */}
          <div className="mb-3 text-xs">
            <span className="text-muted-foreground">Tentatives: </span>
            <span className={`font-semibold ${clickCount >= 3 ? 'text-red-500' : 'text-primary'}`}>
              {clickCount}/3
            </span>
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

      {/* Warning message */}
      {showWarningMessage && (
        <div className="absolute top-20 left-4 right-4 bg-orange-500/95 text-white rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-center">
            ⚠️ {showWarningMessage}
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 right-4 bg-white/95 dark:bg-black/95 rounded-lg p-3 text-center">
        <p className="text-sm text-muted-foreground">
          {isLocked 
            ? "🔒 Carte verrouillée. Utilisez 'Réinitialiser' pour restaurer la marche par défaut." 
            : `📍 Tapez sur la carte pour choisir une destination (${3 - clickCount} tentatives restantes)`
          }
        </p>
      </div>
    </div>
  );
};

export default EnhancedMap;