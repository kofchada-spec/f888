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
    isValid: boolean;
  } | null>(null);

  const defaultRouteRef = useRef<{ geojson: GeoJSON.FeatureCollection; color: string } | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const accuracyCircleRef = useRef<string | null>(null);
  const destinationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const routeCacheRef = useRef<RouteCache>({});
  const debounceRef = useRef<number | null>(null);

  const maxClicks = planningData?.mapConfig?.maxValidClicks ?? 3;

  // Calculs basés sur les paramètres utilisateur
  const stepGoal = parseInt(planningData.steps);
  const heightM = parseFloat(planningData.height);
  const stride = heightM ? 0.415 * heightM : 0.75; // longueur de foulée en mètres
  const targetMeters = stepGoal * stride;
  const minMeters = targetMeters * 0.95;
  const maxMeters = targetMeters * 1.05;
  const speedKmh = planningData.pace === 'slow' ? 4 : planningData.pace === 'moderate' ? 5 : 6;

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

  const addOrUpdateSourceLayer = useCallback((id: string, fc: GeoJSON.FeatureCollection, color: string, width = 4) => {
    if (!map) return;
    if (map.getSource(id)) {
      (map.getSource(id) as mapboxgl.GeoJSONSource).setData(fc);
    } else {
      map.addSource(id, { type: 'geojson', data: fc });
      map.addLayer({
        id,
        type: 'line',
        source: id,
        paint: { 'line-color': color, 'line-width': width },
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

    // Cercle de précision
    if (accuracyCircleRef.current) {
      clearRoute(accuracyCircleRef.current);
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

  // Génération des candidats pour destination par défaut
  const generateCandidateDestinations = useCallback((center: [number, number], targetDistance: number) => {
    const candidates: Array<[number, number]> = [];
    const angles = [0, 45, 90, 135, 180, 225, 270, 315]; // 8 directions
    
    // Approximation: 1 degré ≈ 111km à l'équateur
    const degreeToMeters = 111000;
    const deltaLat = targetDistance / degreeToMeters;
    const deltaLng = targetDistance / (degreeToMeters * Math.cos(center[1] * Math.PI / 180));
    
    angles.forEach(angle => {
      const rad = (angle * Math.PI) / 180;
      const lat = center[1] + deltaLat * Math.sin(rad);
      const lng = center[0] + deltaLng * Math.cos(rad);
      candidates.push([lng, lat]);
    });
    
    return candidates;
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

  // Calcul de la destination par défaut
  const calculateDefaultDestination = useCallback(async () => {
    if (!userLocation || !map || !mapboxToken) {
      console.log('calculateDefaultDestination: conditions not met', { userLocation, map: !!map, mapboxToken: !!mapboxToken });
      return;
    }

    // En mode aller simple : cibler l'objectif complet
    // En mode aller-retour : cibler environ la moitié pour l'aller (sera ajusté avec le retour)
    const initialTargetMeters = planningData.tripType === 'round-trip' ? targetMeters / 2 : targetMeters;
    console.log('Calculating default destination. Mode:', planningData.tripType, 'Total target:', targetMeters, 'Initial aller target:', initialTargetMeters);
    
    const start: [number, number] = [userLocation.lng, userLocation.lat];
    const candidates = generateCandidateDestinations(start, initialTargetMeters);
    
    console.log('Generated candidates:', candidates.length);
    
    let bestCandidate: [number, number] | null = null;
    let bestDistance = Infinity;
    let bestRoute: { featureCollection: GeoJSON.FeatureCollection; distance: number } | null = null;
    let fallbackCandidate: [number, number] | null = null;
    let fallbackRoute: { featureCollection: GeoJSON.FeatureCollection; distance: number } | null = null;

    // Tester chaque candidat
    for (const candidate of candidates) {
      try {
        const allerRoute = await fetchRoute(start, candidate);
        let totalDistance = allerRoute.distance;
        let retourDistance = 0;
        
        // Si aller-retour, calculer aussi le retour pour avoir la distance totale
        if (planningData.tripType === 'round-trip') {
          try {
            const retourRoute = await fetchRoute(candidate, start);
            retourDistance = retourRoute.distance;
            totalDistance = allerRoute.distance + retourDistance;
          } catch (error) {
            // Fallback : doubler l'aller
            retourDistance = allerRoute.distance;
            totalDistance = allerRoute.distance * 2;
          }
        }
        
        console.log(`Candidate: aller=${allerRoute.distance}m, retour=${retourDistance}m, total=${totalDistance}m (target: ${targetMeters}m)`);
        
        const totalDiff = Math.abs(totalDistance - targetMeters);
        
        // Priorité 1: candidat qui respecte les règles de validation
        if (isValidRoute(allerRoute.distance, retourDistance) && totalDiff < bestDistance) {
          bestDistance = totalDiff;
          bestCandidate = candidate;
          bestRoute = allerRoute;
          console.log('Found valid candidate within target range');
        }
        
        // Fallback: garder le plus proche même si hors plage
        if (!fallbackRoute || totalDiff < Math.abs((fallbackRoute.distance * (planningData.tripType === 'round-trip' ? 2 : 1)) - targetMeters)) {
          fallbackCandidate = candidate;
          fallbackRoute = allerRoute;
        }
      } catch (error) {
        console.warn('Route calculation failed for candidate:', candidate, error);
      }
    }

    // Utiliser le meilleur candidat ou le fallback
    const finalCandidate = bestCandidate || fallbackCandidate;
    const finalRoute = bestRoute || fallbackRoute;

    if (finalRoute && finalCandidate) {
      console.log('Using final route with distance:', finalRoute.distance);
      
      // Nettoyer les routes précédentes
      clearRoute('route-default');
      clearRoute('route-return');
      
      // Tracer l'itinéraire aller
      addOrUpdateSourceLayer('route-default', finalRoute.featureCollection, '#2ECC71', 4);
      
      let totalDistance = finalRoute.distance;
      let returnRouteCalculated = false;
      
      // Si aller-retour, calculer le retour
      if (planningData.tripType === 'round-trip') {
        try {
          const returnRoute = await fetchRoute(finalCandidate, start, [finalRoute.featureCollection]);
          addOrUpdateSourceLayer('route-return', returnRoute.featureCollection, '#3498DB', 4);
          totalDistance = finalRoute.distance + returnRoute.distance;
          returnRouteCalculated = true;
          console.log('Return route calculated:', returnRoute.distance, 'total:', totalDistance);
        } catch (error) {
          console.warn('Return route calculation failed, doubling distance');
          totalDistance = finalRoute.distance * 2;
        }
      }

      const estimatedSteps = Math.round(totalDistance / stride);
      const duration = Math.round((totalDistance / 1000) / speedKmh * 60);
      const isValid = totalDistance >= totalRange.min && totalDistance <= totalRange.max;
      
      console.log('Route stats:', { totalDistance, estimatedSteps, duration, isValid, stepGoal });
      
      setRouteStats({
        distance: totalDistance,
        duration,
        steps: estimatedSteps,
        isValid
      });

      // Marqueur destination
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
        .setLngLat(finalCandidate)
        .addTo(map);

      // Mémoriser comme trajet par défaut
      defaultRouteRef.current = { 
        geojson: finalRoute.featureCollection, 
        color: '#2ECC71' 
      };

      // Ajuster la vue pour inclure le trajet
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([userLocation.lng, userLocation.lat]);
      bounds.extend(finalCandidate);
      map.fitBounds(bounds, { padding: 80, duration: 1000 });
      
      console.log('Default destination calculation completed successfully');
    } else {
      console.error('No route could be calculated for any candidate');
    }
  }, [userLocation, map, mapboxToken, targetMeters, minMeters, maxMeters, planningData.tripType, fetchRoute, addOrUpdateSourceLayer, generateCandidateDestinations, stride, speedKmh, clearRoute, stepGoal]);

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
      
      // Vérifier si le trajet respecte les règles selon le mode
      if (!isValidRoute(distance, retourDistance)) {
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
          // Route de retour en bleu pointillé (approximation avec couleur différente)
          addOrUpdateSourceLayer('route-return-click', returnRoute.featureCollection, '#3498DB', 4);
        } catch (error) {
          console.warn('Failed to display return route visualization');
        }
      }

      const duration = Math.round((totalDistance / 1000) / speedKmh * 60);

      const estimatedSteps = Math.round(totalDistance / stride);
      const isValid = totalDistance >= totalRange.min && totalDistance <= totalRange.max;

      setRouteStats({
        distance: totalDistance,
        duration,
        steps: estimatedSteps,
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

        {/* Route Stats */}
        {routeStats && (
          <div className={`bg-card rounded-xl p-4 mb-6 shadow-sm border-l-4 ${
            routeStats.isValid ? 'border-l-green-500' : 'border-l-orange-500'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-6">
                <span>≈ {(routeStats.distance / 1000).toFixed(1)} km</span>
                <span>≈ {routeStats.duration} min</span>
                <span>{routeStats.steps} pas</span>
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
              calories: routeStats ? Math.round(routeStats.distance / 20) : 50
            })}
            disabled={!routeStats}
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