import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as turf from '@turf/turf';
import { useMapClickLimiter } from '@/hooks/useMapClickLimiter';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';

interface MapScreenProps {
  onComplete: (destination: any) => void;
  onBack: () => void;
  onGoToDashboard: () => void;
  planningData: {
    steps: string;
    pace: 'slow' | 'moderate' | 'fast';
    tripType: 'one-way' | 'round-trip';
    height: string;
    weight: string;
    mapConfig?: { maxValidClicks: number; resetMode: 'LOCK_AND_START_DEFAULT' };
  };
}

interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

interface RouteCache {
  [key: string]: {
    featureCollection: GeoJSON.FeatureCollection;
    distance: number;
  };
}

const MapScreen = ({ onComplete, onBack, onGoToDashboard, planningData }: MapScreenProps) => {
  const containerRef = useRef<HTMLDivElement|null>(null);
  const [map, setMap] = useState<mapboxgl.Map|null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [routeStats, setRouteStats] = useState<{
    distance: number;
    duration: number;
    steps: number;
    calories: number;
    isValid: boolean;
  } | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const defaultRouteRef = useRef<{ geojson: GeoJSON.FeatureCollection; color: string } | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const accuracyCircleRef = useRef<string | null>(null);
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const routeCacheRef = useRef<RouteCache>({});
  const debounceRef = useRef<number | null>(null);

  const maxClicks = planningData?.mapConfig?.maxValidClicks ?? 3;

  // Calculs basés sur les paramètres utilisateur (formules exactes des spécifications)
  const stepGoal = parseInt(planningData.steps);
  const heightM = parseFloat(planningData.height);
  const weightKg = parseFloat(planningData.weight);
  const stride = heightM ? 0.415 * heightM : 0.72; // longueur de foulée = 0.415 × taille (m)
  const targetMeters = stepGoal * stride; // distance cible en mètres
  const minMeters = targetMeters * 0.95; // -5% tolérance
  const maxMeters = targetMeters * 1.05; // +5% tolérance
  
  // Vitesses selon l'allure (km/h)
  const speedKmh = planningData.pace === 'slow' ? 4 : planningData.pace === 'moderate' ? 5 : 6;
  
  // Coefficients pour calories
  const calorieCoefficient = planningData.pace === 'slow' ? 0.35 : planningData.pace === 'moderate' ? 0.5 : 0.7;

  // Plage de validation pour l'objectif total
  const totalRange = { min: minMeters, max: maxMeters };

  // Fetch Mapbox token from Supabase
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
          mapboxgl.accessToken = data.token;
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
      }
    };

    fetchMapboxToken();
  }, []);

  // Géolocalisation
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Géolocalisation non supportée par ce navigateur");
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    const onSuccess = (position: GeolocationPosition) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      setUserLocation(location);
      setLocationError(null);
    };

    const onError = (error: GeolocationPositionError) => {
      console.error('Geolocation error:', error);
      setLocationError("Impossible d'obtenir votre position. Autorisez la localisation dans les réglages.");
      // Fallback sur Paris
      setUserLocation({ lat: 48.8566, lng: 2.3522, accuracy: 1000 });
    };

    // Première position
    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);

    // Watch position si disponible
    if (navigator.geolocation.watchPosition) {
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // ========= Helpers routing (Mapbox Directions API) =========
  const fetchRoute = useCallback(async (start: [number,number], end: [number,number], excludeRoutes: GeoJSON.FeatureCollection[] = []) => {
    const cacheKey = `${start[0]},${start[1]}-${end[0]},${end[1]}`;
    
    if (routeCacheRef.current[cacheKey]) {
      return routeCacheRef.current[cacheKey];
    }

    let url = `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
    
    // Tentative d'éviter les routes existantes (approximation)
    if (excludeRoutes.length > 0) {
      url += '&exclude=ferry';
    }

    const res = await fetch(url);
    const data = await res.json();
    if (!data?.routes?.[0]) throw new Error('No route');
    
    const route = data.routes[0].geometry;
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: route,
        properties: {}
      }]
    };

    const result = { 
      featureCollection: fc, 
      distance: data.routes[0].distance 
    };
    
    routeCacheRef.current[cacheKey] = result;
    return result;
  }, []);

  const addOrUpdateSourceLayer = useCallback((id: string, fc: GeoJSON.FeatureCollection, color: string, width = 4, dashed = false) => {
    if (!map) return;
    if (map.getSource(id)) {
      (map.getSource(id) as mapboxgl.GeoJSONSource).setData(fc);
    } else {
      map.addSource(id, { type: 'geojson', data: fc });
      const paintProps: any = { 'line-color': color, 'line-width': width };
      if (dashed) {
        paintProps['line-dasharray'] = [2, 2]; // Ligne pointillée
      }
      map.addLayer({
        id,
        type: 'line',
        source: id,
        paint: paintProps,
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
    }
  }, [map]);

  const clearRoute = useCallback((id: string) => {
    if (!map) return;
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  }, [map]);

  // Mise à jour des marqueurs utilisateur
  const updateUserMarkers = useCallback(() => {
    if (!map || !userLocation) return;

    // Marqueur utilisateur
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    } else {
      const el = document.createElement('div');
      el.className = 'user-marker';
      el.style.cssText = `
        width: 16px;
        height: 16px;
        background-color: #3B82F6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;
      
      userMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    }

    // Cercle de précision - nettoyer d'abord si existe
    if (map.getLayer('accuracy-circle')) {
      map.removeLayer('accuracy-circle');
    }
    if (map.getLayer('accuracy-circle-border')) {
      map.removeLayer('accuracy-circle-border');
    }
    if (map.getSource('accuracy-circle')) {
      map.removeSource('accuracy-circle');
    }

    const circle = turf.circle([userLocation.lng, userLocation.lat], userLocation.accuracy / 1000, {
      steps: 64,
      units: 'kilometers'
    });
    
    accuracyCircleRef.current = 'accuracy-circle';
    map.addSource('accuracy-circle', { type: 'geojson', data: circle });
    map.addLayer({
      id: 'accuracy-circle',
      type: 'fill',
      source: 'accuracy-circle',
      paint: {
        'fill-color': '#3B82F6',
        'fill-opacity': 0.1
      }
    });
    map.addLayer({
      id: 'accuracy-circle-border',
      type: 'line',
      source: 'accuracy-circle',
      paint: {
        'line-color': '#3B82F6',
        'line-width': 1,
        'line-opacity': 0.3
      }
    });
  }, [map, userLocation, clearRoute]);

  // Génération complète des candidats avec recherche exhaustive
  const generateRingCandidates = useCallback((center: [number, number], radius: number, bearingCount: number = 20) => {
    const candidates: Array<[number, number]> = [];
    
    // Générer des candidats uniformément répartis sur un cercle
    for (let i = 0; i < bearingCount; i++) {
      const bearing = (i * 360) / bearingCount;
      const destination = turf.destination(turf.point(center), radius / 1000, bearing, { units: 'kilometers' });
      candidates.push(destination.geometry.coordinates as [number, number]);
    }
    
    return candidates;
  }, []);

  // Génération de waypoints de détour pour ajustement fin
  const generateDetourWaypoints = useCallback((start: [number, number], end: [number, number], offsetDistance: number = 200) => {
    const waypoints: Array<[number, number]> = [];
    
    // Point milieu de la route
    const midpoint = turf.midpoint(turf.point(start), turf.point(end));
    
    // Générer des points de détour perpendiculaires à la ligne principale
    const bearing = turf.bearing(turf.point(start), turf.point(end));
    const perpBearing1 = bearing + 90;
    const perpBearing2 = bearing - 90;
    
    // Waypoints à gauche et à droite
    const waypoint1 = turf.destination(midpoint, offsetDistance / 1000, perpBearing1, { units: 'kilometers' });
    const waypoint2 = turf.destination(midpoint, offsetDistance / 1000, perpBearing2, { units: 'kilometers' });
    
    waypoints.push(waypoint1.geometry.coordinates as [number, number]);
    waypoints.push(waypoint2.geometry.coordinates as [number, number]);
    
    return waypoints;
  }, []);

  // Validation selon le mode de trajet
  const isValidRoute = useCallback((allerDistance: number, retourDistance: number = 0) => {
    const totalDistance = allerDistance + retourDistance;
    
    if (planningData.tripType === 'one-way') {
      // Mode aller simple : l'aller seul doit respecter l'objectif ±5%
      return allerDistance >= totalRange.min && allerDistance <= totalRange.max;
    } else {
      // Mode aller-retour : la somme (aller + retour) doit respecter l'objectif ±5%
      return totalDistance >= totalRange.min && totalDistance <= totalRange.max;
    }
  }, [planningData.tripType, totalRange]);

  // Fonction d'ajustement fin pour respecter exactement les ±5%
  const adjustRouteToTargetRange = useCallback(async (
    start: [number, number],
    bestCandidate: [number, number],
    bestDistance: number,
    isOneWay: boolean
  ): Promise<{
    candidate: [number, number];
    outboundRoute: { featureCollection: GeoJSON.FeatureCollection; distance: number };
    returnRoute?: { featureCollection: GeoJSON.FeatureCollection; distance: number };
  } | null> => {
    
    console.log(`Adjusting route to fit ±5% range. Current distance: ${bestDistance}m, Target range: [${minMeters}, ${maxMeters}]`);
    
    // Calculer l'ajustement nécessaire
    const targetCenter = (minMeters + maxMeters) / 2;
    const currentDistance = isOneWay ? bestDistance : bestDistance / 2; // Distance aller pour round-trip
    const targetDistance = isOneWay ? targetCenter : targetCenter / 2;
    
    // Ratio d'ajustement
    const adjustmentRatio = targetDistance / currentDistance;
    
    // Calculer nouvelle position ajustée
    const bearing = turf.bearing(turf.point(start), turf.point(bestCandidate));
    const currentDistanceKm = turf.distance(turf.point(start), turf.point(bestCandidate), { units: 'kilometers' });
    const newDistanceKm = currentDistanceKm * adjustmentRatio;
    
    const adjustedCandidate = turf.destination(turf.point(start), newDistanceKm, bearing, { units: 'kilometers' });
    const adjustedCoords = adjustedCandidate.geometry.coordinates as [number, number];
    
    console.log(`Adjusted candidate from ${currentDistanceKm.toFixed(3)}km to ${newDistanceKm.toFixed(3)}km`);
    
    try {
      // Tester la route ajustée
      const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${adjustedCoords[0]},${adjustedCoords[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
      const outboundRes = await fetch(outboundUrl);
      const outboundData = await outboundRes.json();
      
      if (!outboundData?.routes?.[0]) {
        console.warn('Adjusted route failed, using original candidate');
        return null;
      }
      
      const outboundDistance = outboundData.routes[0].distance;
      let totalDistance = outboundDistance;
      let returnRoute: { featureCollection: GeoJSON.FeatureCollection; distance: number } | undefined;
      
      if (!isOneWay) {
        try {
          const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${adjustedCoords[0]},${adjustedCoords[1]};${start[0]},${start[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
          const returnRes = await fetch(returnUrl);
          const returnData = await returnRes.json();
          
          if (returnData?.routes?.[0]) {
            const returnDistance = returnData.routes[0].distance;
            totalDistance = outboundDistance + returnDistance;
            
            returnRoute = {
              featureCollection: {
                type: 'FeatureCollection' as const,
                features: [{
                  type: 'Feature' as const,
                  geometry: returnData.routes[0].geometry,
                  properties: {}
                }]
              },
              distance: returnDistance
            };
          }
        } catch (error) {
          totalDistance = outboundDistance * 2;
        }
      }
      
      console.log(`Adjusted route total distance: ${totalDistance}m (target range: [${minMeters}, ${maxMeters}])`);
      
      const outboundRoute = {
        featureCollection: {
          type: 'FeatureCollection' as const,
          features: [{
            type: 'Feature' as const,
            geometry: outboundData.routes[0].geometry,
            properties: {}
          }]
        },
        distance: outboundDistance
      };
      
      return { candidate: adjustedCoords, outboundRoute, returnRoute };
      
    } catch (error) {
      console.warn('Route adjustment failed:', error);
      return null;
    }
  }, [minMeters, maxMeters]);

  // Recherche exhaustive de routes avec multiples stratégies + fallback garanti
  const findValidRouteWithExhaustiveSearch = useCallback(async (
    start: [number, number], 
    targetDistance: number, 
    isOneWay: boolean = true
  ): Promise<{ 
    candidate: [number, number]; 
    outboundRoute: { featureCollection: GeoJSON.FeatureCollection; distance: number };
    returnRoute?: { featureCollection: GeoJSON.FeatureCollection; distance: number };
  } | null> => {
    
    const toleranceFactors = [0, 0.01, 0.02, 0.03, 0.04, 0.05]; // 0%, ±1%, ±2%, ±3%, ±4%, ±5%
    const bearingCounts = [16, 20, 24]; // Nombre de directions à tester
    const detourOffsets = [0, 100, 200, 300]; // Distances de détour en mètres
    
    console.log(`Starting exhaustive search for ${isOneWay ? 'one-way' : 'round-trip'} route. Target: ${targetDistance}m`);
    
    // Variables pour garder la meilleure route trouvée (même si hors ±5%)
    let bestCandidate: [number, number] | null = null;
    let bestDistance = Infinity;
    let bestDifference = Infinity;
    
    // Phase 1: Recherche directe avec cercles concentriques
    for (const bearingCount of bearingCounts) {
      for (const toleranceFactor of toleranceFactors) {
        const radiusVariations = toleranceFactor === 0 
          ? [targetDistance] 
          : [
              targetDistance * (1 - toleranceFactor), 
              targetDistance * (1 + toleranceFactor)
            ];
            
        for (const radius of radiusVariations) {
          const searchRadius = isOneWay ? radius : radius / 2; // Pour round-trip, chercher à mi-distance
          const candidates = generateRingCandidates(start, searchRadius, bearingCount);
          
          console.log(`Testing ${candidates.length} candidates with radius ${searchRadius}m, tolerance ±${toleranceFactor * 100}%`);
          
          for (const candidate of candidates) {
            try {
              // Tester la route aller avec alternatives
              const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${candidate[0]},${candidate[1]}?geometries=geojson&overview=full&alternatives=true&access_token=${mapboxgl.accessToken}`;
              const outboundRes = await fetch(outboundUrl);
              const outboundData = await outboundRes.json();
              
              if (!outboundData?.routes?.length) continue;
              
              // Tester toutes les alternatives de route aller
              for (const outboundRouteData of outboundData.routes.slice(0, 3)) { // Max 3 alternatives
                const outboundDistance = outboundRouteData.distance;
                let totalDistance = outboundDistance;
                let returnRoute: { featureCollection: GeoJSON.FeatureCollection; distance: number } | undefined;
                
                if (!isOneWay) {
                  // Pour round-trip, calculer le retour avec alternatives
                  try {
                    const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${candidate[0]},${candidate[1]};${start[0]},${start[1]}?geometries=geojson&overview=full&alternatives=true&access_token=${mapboxgl.accessToken}`;
                    const returnRes = await fetch(returnUrl);
                    const returnData = await returnRes.json();
                    
                    if (returnData?.routes?.length) {
                      // Choisir une route de retour différente si possible
                      const returnRouteData = returnData.routes.length > 1 ? returnData.routes[1] : returnData.routes[0];
                      const returnDistance = returnRouteData.distance;
                      totalDistance = outboundDistance + returnDistance;
                      
                      returnRoute = {
                        featureCollection: {
                          type: 'FeatureCollection' as const,
                          features: [{
                            type: 'Feature' as const,
                            geometry: returnRouteData.geometry,
                            properties: {}
                          }]
                        },
                        distance: returnDistance
                      };
                    }
                  } catch (error) {
                    console.warn('Return route calculation failed, using doubled outbound');
                    totalDistance = outboundDistance * 2;
                  }
                }
                
                const difference = Math.abs(totalDistance - targetDistance);
                
                // Validation stricte ±5% - retourner immédiatement si trouvé
                if (totalDistance >= minMeters && totalDistance <= maxMeters) {
                  console.log(`✓ Found valid route! Outbound: ${outboundDistance}m, Return: ${returnRoute?.distance || 0}m, Total: ${totalDistance}m`);
                  
                  const outboundRoute = {
                    featureCollection: {
                      type: 'FeatureCollection' as const,
                      features: [{
                        type: 'Feature' as const,
                        geometry: outboundRouteData.geometry,
                        properties: {}
                      }]
                    },
                    distance: outboundDistance
                  };
                  
                  return { candidate, outboundRoute, returnRoute };
                }
                
                // Garder la meilleure route même si hors ±5%
                if (difference < bestDifference) {
                  bestDifference = difference;
                  bestCandidate = candidate;
                  bestDistance = totalDistance;
                }
              }
            } catch (error) {
              console.warn('Route calculation failed for candidate:', candidate, error);
            }
          }
        }
      }
    }
    
    // Phase 2: Recherche avec waypoints de détour
    console.log('Phase 1 failed, trying detour waypoints...');
    
    for (const detourOffset of detourOffsets.slice(1)) { // Skip 0 offset
      const baseRadius = isOneWay ? targetDistance : targetDistance / 2;
      const baseCandidates = generateRingCandidates(start, baseRadius, 12); // Moins de candidats pour cette phase
      
      for (const candidate of baseCandidates) {
        const detourWaypoints = generateDetourWaypoints(start, candidate, detourOffset);
        
        for (const waypoint of detourWaypoints) {
          try {
            // Route avec détour: start -> waypoint -> candidate
            const leg1Url = `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${waypoint[0]},${waypoint[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
            const leg2Url = `https://api.mapbox.com/directions/v5/mapbox/walking/${waypoint[0]},${waypoint[1]};${candidate[0]},${candidate[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
            
            const [leg1Res, leg2Res] = await Promise.all([fetch(leg1Url), fetch(leg2Url)]);
            const [leg1Data, leg2Data] = await Promise.all([leg1Res.json(), leg2Res.json()]);
            
            if (!leg1Data?.routes?.[0] || !leg2Data?.routes?.[0]) continue;
            
            const outboundDistance = leg1Data.routes[0].distance + leg2Data.routes[0].distance;
            let totalDistance = outboundDistance;
            let returnRoute: { featureCollection: GeoJSON.FeatureCollection; distance: number } | undefined;
            
            if (!isOneWay) {
              // Retour direct pour simplifier
              try {
                const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${candidate[0]},${candidate[1]};${start[0]},${start[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
                const returnRes = await fetch(returnUrl);
                const returnData = await returnRes.json();
                
                if (returnData?.routes?.[0]) {
                  const returnDistance = returnData.routes[0].distance;
                  totalDistance = outboundDistance + returnDistance;
                  
                  returnRoute = {
                    featureCollection: {
                      type: 'FeatureCollection' as const,
                      features: [{
                        type: 'Feature' as const,
                        geometry: returnData.routes[0].geometry,
                        properties: {}
                      }]
                    },
                    distance: returnDistance
                  };
                }
              } catch (error) {
                totalDistance = outboundDistance * 2;
              }
            }
            
            const difference = Math.abs(totalDistance - targetDistance);
            
            // Validation stricte ±5% - retourner immédiatement si trouvé
            if (totalDistance >= minMeters && totalDistance <= maxMeters) {
              console.log(`✓ Found valid route with detour! Total: ${totalDistance}m`);
              
              // Combiner les deux segments pour la route aller
              const combinedFeatures = [
                ...leg1Data.routes[0].geometry.coordinates,
                ...leg2Data.routes[0].geometry.coordinates
              ];
              
              const outboundRoute = {
                featureCollection: {
                  type: 'FeatureCollection' as const,
                  features: [{
                    type: 'Feature' as const,
                    geometry: {
                      type: 'LineString' as const,
                      coordinates: combinedFeatures
                    },
                    properties: {}
                  }]
                },
                distance: outboundDistance
              };
              
              return { candidate, outboundRoute, returnRoute };
            }
            
            // Garder la meilleure route même si hors ±5%
            if (difference < bestDifference) {
              bestDifference = difference;
              bestCandidate = candidate;
              bestDistance = totalDistance;
            }
          } catch (error) {
            console.warn('Detour route calculation failed:', error);
          }
        }
      }
    }
    
    // Phase 3: FALLBACK GARANTI - ajuster la meilleure route trouvée
    if (bestCandidate && bestDistance < Infinity) {
      console.log(`No perfect route found within ±5%, adjusting best route (${bestDistance}m) to fit target range`);
      
      const adjustedResult = await adjustRouteToTargetRange(start, bestCandidate, bestDistance, isOneWay);
      if (adjustedResult) {
        console.log('✓ Successfully adjusted route to fit ±5% constraint');
        return adjustedResult;
      }
    }
    
    console.log('All search strategies failed - this should never happen');
    return null;
  }, [generateRingCandidates, generateDetourWaypoints, minMeters, maxMeters]);

  // Calcul de la destination par défaut avec recherche exhaustive
  const calculateDefaultDestination = useCallback(async () => {
    if (!userLocation || !map || !mapboxToken) {
      console.log('calculateDefaultDestination: conditions not met', { userLocation, map: !!map, mapboxToken: !!mapboxToken });
      return;
    }

    console.log('Starting comprehensive route search. Mode:', planningData.tripType, 'Target:', targetMeters, 'meters');
    
    const start: [number, number] = [userLocation.lng, userLocation.lat];
    const isOneWay = planningData.tripType === 'one-way';
    
    // Recherche exhaustive
    const result = await findValidRouteWithExhaustiveSearch(start, targetMeters, isOneWay);
    
    if (result) {
      const { candidate, outboundRoute, returnRoute } = result;
      
      console.log('Valid route found with comprehensive search');
      
      // Nettoyer les erreurs et routes précédentes
      setRouteError(null);
      clearRoute('route-default');
      clearRoute('route-return');
      
      // Tracer l'itinéraire aller (vert)
      addOrUpdateSourceLayer('route-default', outboundRoute.featureCollection, '#2ECC71', 4);
      
      let totalDistance = outboundRoute.distance;
      
      // Si aller-retour et qu'on a une route de retour, la tracer (bleu pointillé)
      if (!isOneWay && returnRoute) {
        addOrUpdateSourceLayer('route-return', returnRoute.featureCollection, '#3498DB', 4, true);
        totalDistance = outboundRoute.distance + returnRoute.distance;
      } else if (!isOneWay) {
        // Fallback: doubler la distance aller
        totalDistance = outboundRoute.distance * 2;
      }

      // Calculs selon les spécifications exactes
      const estimatedSteps = Math.round(totalDistance / stride);
      const distanceKm = totalDistance / 1000;
      const duration = Math.round(distanceKm / speedKmh * 60); // durée (minutes) = distance ÷ vitesse
      const calories = Math.round(distanceKm * weightKg * calorieCoefficient); // calories = distance × poids × coefficient
      const isValid = totalDistance >= totalRange.min && totalDistance <= totalRange.max;
      
      console.log('Route stats:', { totalDistance, estimatedSteps, duration, calories, isValid, stepGoal });
      
      setRouteStats({
        distance: totalDistance,
        duration,
        steps: estimatedSteps,
        calories,
        isValid
      });

      // Marqueur destination (vert)
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.remove();
      }

      const el = document.createElement('div');
      el.className = 'destination-marker';
      el.style.cssText = `
        width: 20px;
        height: 20px;
        background-color: #2ECC71;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;

      destinationMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat(candidate)
        .addTo(map);

      // Mémoriser comme trajet par défaut
      defaultRouteRef.current = { 
        geojson: outboundRoute.featureCollection, 
        color: '#2ECC71' 
      };

      // Ajuster la vue pour inclure le trajet
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([userLocation.lng, userLocation.lat]);
      bounds.extend(candidate);
      map.fitBounds(bounds, { padding: 80, duration: 1000 });
      
      console.log('Default destination calculation completed successfully');
    } else {
      console.error('Comprehensive search failed - no valid route found within ±5% tolerance');
      setRouteError("Aucun itinéraire valide trouvé dans votre plage d'objectif de pas. Veuillez réessayer.");
      setRouteStats(null);
    }
  }, [userLocation, map, mapboxToken, targetMeters, planningData.tripType, findValidRouteWithExhaustiveSearch, stride, speedKmh, weightKg, calorieCoefficient, totalRange, stepGoal, clearRoute, addOrUpdateSourceLayer]);

  // ========= Limiteur 3 clics =========
  const onValidClick = async (lngLat: {lng:number; lat:number}) => {
    if (!map || !userLocation) return;

    const start: [number,number] = [userLocation.lng, userLocation.lat];
    const end: [number,number] = [lngLat.lng, lngLat.lat];

    try {
      const { featureCollection, distance } = await fetchRoute(start, end);
      
      // Calculer d'abord le retour si nécessaire pour valider le total
      let retourDistance = 0;
      if (planningData.tripType === 'round-trip') {
        try {
          const returnRoute = await fetchRoute(end, start);
          retourDistance = returnRoute.distance;
        } catch (error) {
          // Fallback : doubler l'aller
          retourDistance = distance;
        }
      }
      
      // Vérifier si le trajet respecte les règles selon le mode - validation stricte
      if (!isValidRoute(distance, retourDistance)) {
        setRouteError("Aucun itinéraire valide trouvé dans votre plage d'objectif de pas. Veuillez réessayer.");
        setRouteStats(null);
        return;
        console.log(`Route rejected: aller=${distance}m, retour=${retourDistance}m, total=${distance + retourDistance}m (target range: [${totalRange.min}, ${totalRange.max}])`);
        return;
      }
      
      addOrUpdateSourceLayer('route-click', featureCollection, '#2ECC71', 4);

      let totalDistance = distance + retourDistance;

      // Tracer les routes
      addOrUpdateSourceLayer('route-click', featureCollection, '#2ECC71', 4);
      
      if (planningData.tripType === 'round-trip' && retourDistance > 0) {
        try {
          const returnRoute = await fetchRoute(end, start, [featureCollection]);
          // Route de retour en bleu pointillé
          addOrUpdateSourceLayer('route-return-click', returnRoute.featureCollection, '#3498DB', 4, true);
        } catch (error) {
          console.warn('Failed to display return route visualization');
        }
      }

      // Calculs selon les spécifications exactes pour le clic utilisateur
      const distanceKm = totalDistance / 1000;
      const duration = Math.round(distanceKm / speedKmh * 60); // durée (minutes) = distance ÷ vitesse
      const calories = Math.round(distanceKm * weightKg * calorieCoefficient); // calories = distance × poids × coefficient
      const estimatedSteps = Math.round(totalDistance / stride);
      const isValid = totalDistance >= totalRange.min && totalDistance <= totalRange.max;

      setRouteStats({
        distance: totalDistance,
        duration,
        steps: estimatedSteps,
        calories,
        isValid
      });

      // Mettre à jour le marqueur destination
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLngLat([lngLat.lng, lngLat.lat]);
      }

    } catch (error) {
      console.error('Route calculation failed:', error);
    }
  };

  const onLock = () => {
    console.log('Limite de clics atteinte');
  };

  const onResetStartDefault = () => {
    if (defaultRouteRef.current && map) {
      addOrUpdateSourceLayer('route-default', defaultRouteRef.current.geojson, defaultRouteRef.current.color);
      clearRoute('route-click');
      clearRoute('route-return-click');
      
      // Recalculer les stats du trajet par défaut
      calculateDefaultDestination();
    }
  };

  const { clickCount, isLocked, handleMapClick, reset } = useMapClickLimiter({
    maxValidClicks: maxClicks,
    resetMode: planningData?.mapConfig?.resetMode ?? 'LOCK_AND_START_DEFAULT',
    onValidClick,
    onLock,
    onResetStartDefault
  });

  // ========= Init map =========
  useEffect(() => {
    if (!containerRef.current || !mapboxToken) return;

    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [2.3522, 48.8566], // Paris par défaut
      zoom: 15
    });
    setMap(m);

    m.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => m.remove();
  }, [mapboxToken]);

  // Mise à jour de la carte quand userLocation change
  useEffect(() => {
    if (!map || !userLocation || !mapboxToken) return;
    
    console.log('User location updated:', userLocation);
    map.setCenter([userLocation.lng, userLocation.lat]);
    updateUserMarkers();
    
    // Calculer immédiatement la destination par défaut
    calculateDefaultDestination();
    
  }, [map, userLocation, mapboxToken, updateUserMarkers, calculateDefaultDestination]);

  // Abonnement clic carte
  useEffect(() => {
    if (!map) return;
    
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      // Debounce
      if (debounceRef.current) return;
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
      }, 600);

      handleMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    };
    
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [map, handleMapClick]);

  if (!mapboxToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <div className="bg-card shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center space-x-2 text-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Retour</span>
          </button>
          
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onGoToDashboard}>
            <img 
              src="/lovable-uploads/5216fdd6-d0d7-446b-9260-86d15d06f4ba.png" 
              alt="Fitpas" 
              className="h-8 w-auto hover:scale-105 transition-transform"
              style={{ 
                filter: 'invert(0) sepia(1) saturate(5) hue-rotate(120deg) brightness(0.8)',
                color: '#10b981' 
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-6xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Planifiez votre marche
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {userLocation ? 
              "Votre position est détectée. Tapez sur la carte pour personnaliser votre itinéraire." :
              "Localisation en cours..."
            }
          </p>
          {locationError && (
            <p className="text-destructive text-sm mt-2">{locationError}</p>
          )}
        </div>

        {/* Route Error */}
        {routeError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-6 shadow-sm">
            <div className="text-center">
              <h3 className="text-lg font-medium text-destructive mb-2">Aucun itinéraire trouvé</h3>
              <p className="text-sm text-destructive/80">{routeError}</p>
            </div>
          </div>
        )}

        {/* Route Stats */}
        {routeStats && !routeError && (
          <div className={`bg-card rounded-xl p-4 mb-6 shadow-sm border-l-4 ${
            routeStats.isValid ? 'border-l-green-500' : 'border-l-orange-500'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-6">
                <span>≈ {(routeStats.distance / 1000).toFixed(1)} km</span>
                <span>≈ {routeStats.duration} min</span>
                <span>{routeStats.steps} pas</span>
                <span>≈ {routeStats.calories} kcal</span>
                <span className="text-muted-foreground">(objectif {stepGoal})</span>
              </div>
              {!routeStats.isValid && (
                <span className="text-orange-600 font-medium">
                  Ajusté au plus proche de votre objectif
                </span>
              )}
            </div>
          </div>
        )}

        {/* Planning Summary */}
        <div className="bg-card rounded-xl p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center">
              <p className="text-muted-foreground">Objectif</p>
              <p className="font-semibold">{planningData.steps} pas</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Taille</p>
              <p className="font-semibold">{planningData.height} m</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Poids</p>
              <p className="font-semibold">{planningData.weight} kg</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Allure</p>
              <p className="font-semibold capitalize">
                {planningData.pace === 'slow' ? 'Lente' : 
                 planningData.pace === 'moderate' ? 'Modérée' : 'Rapide'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Type</p>
              <p className="font-semibold">
                {planningData.tripType === 'one-way' ? 'Aller' : 'A-R'}
              </p>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="relative w-full h-[calc(100vh-400px)] min-h-[400px] mb-6">
          <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden shadow-lg" />

          {/* Overlay anti-clic quand verrouillé */}
          {isLocked && (
            <div
              className="absolute inset-0 z-20 rounded-xl"
              style={{ pointerEvents: 'auto', background: 'transparent' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur px-4 py-3 rounded-md text-sm shadow-lg border">
                Limite atteinte — utilisez « Réinitialiser » pour le trajet par défaut
              </div>
            </div>
          )}

          {/* Barre compteur + Reset */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-10 bg-card/90 backdrop-blur px-4 py-2 rounded-lg shadow border">
            <span className="text-sm font-medium">Essais : {Math.min(clickCount, maxClicks)}/{maxClicks}</span>
            <button className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors" onClick={reset}>
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center">
          <button
            onClick={() => onComplete({ 
              id: 'map-selected', 
              name: 'Destination sélectionnée',
              coordinates: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : { lat: 48.8566, lng: 2.3522 },
              distanceKm: routeStats ? routeStats.distance / 1000 : 1.2,
              durationMin: routeStats ? routeStats.duration : 15,
              calories: routeStats ? routeStats.calories : 50
            })}
            disabled={!routeStats || !!routeError}
            className="w-full max-w-md h-14 text-lg font-semibold bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] border-0"
          >
            Commencer la marche
          </button>
          <p className="text-xs text-muted-foreground mt-2">
            L'itinéraire sera sauvegardé et le suivi GPS commencera
          </p>
        </div>
      </div>
    </div>
  );
};

export default MapScreen;