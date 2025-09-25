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
  
  // Refs pour éviter les recalculs automatiques
  const isDefaultRouteCalculated = useRef(false);
  const sourcesInitialized = useRef(false);
  const locationUpdateTimeoutRef = useRef<number | null>(null);

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

  // Géolocalisation avec throttling pour éviter les recalculs
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
      
      // Throttle les mises à jour de position (500ms)
      if (locationUpdateTimeoutRef.current) {
        clearTimeout(locationUpdateTimeoutRef.current);
      }
      
      locationUpdateTimeoutRef.current = window.setTimeout(() => {
        setUserLocation(location);
        setLocationError(null);
        console.log('User location updated:', location);
      }, 500);
    };

    const onError = (error: GeolocationPositionError) => {
      console.error('Geolocation error:', error);
      setLocationError("Impossible d'obtenir votre position. Autorisez la localisation dans les réglages.");
      // Fallback sur Paris
      setUserLocation({ lat: 48.8566, lng: 2.3522, accuracy: 1000 });
    };

    // Première position (pas de throttling pour la première)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setUserLocation(location);
        setLocationError(null);
        console.log('Initial user location set:', location);
      }, 
      onError, 
      options
    );

    // Watch position si disponible (avec throttling)
    if (navigator.geolocation.watchPosition) {
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
        ...options,
        maximumAge: 5000 // Accepter positions pas plus vieilles que 5s
      });
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (locationUpdateTimeoutRef.current) {
        clearTimeout(locationUpdateTimeoutRef.current);
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
    
    // Utiliser setData si la source existe déjà pour éviter le flicker
    if (map.getSource(id)) {
      (map.getSource(id) as mapboxgl.GeoJSONSource).setData(fc);
    } else {
      // N'ajouter source et layer qu'une seule fois
      map.addSource(id, { type: 'geojson', data: fc });
      const paintProps: any = { 
        'line-color': color, 
        'line-width': width,
        'line-opacity': 1 // Pas d'animation d'opacité
      };
      if (dashed) {
        paintProps['line-dasharray'] = [2, 2];
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

  // Mise à jour des marqueurs utilisateur (optimisé pour éviter le flicker)
  const updateUserMarkers = useCallback(() => {
    if (!map || !userLocation) return;

    // Marqueur utilisateur - mise à jour position uniquement
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

    // Cercle de précision - utiliser setData au lieu de recréer
    const circle = turf.circle([userLocation.lng, userLocation.lat], userLocation.accuracy / 1000, {
      steps: 64,
      units: 'kilometers'
    });
    
    if (map.getSource('accuracy-circle')) {
      // Mettre à jour les données existantes
      (map.getSource('accuracy-circle') as mapboxgl.GeoJSONSource).setData(circle);
    } else {
      // Créer une seule fois
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
    }
  }, [map, userLocation]);

  // Calcul simple d'un trajet par défaut (garantit une route dans ±5%)
  const calculateDefaultDestination = useCallback(async () => {
    if (!userLocation || !map || !mapboxToken || isDefaultRouteCalculated.current) {
      return;
    }

    console.log('Calculating default route - SINGLE TIME ONLY. Mode:', planningData.tripType, 'Target:', targetMeters, 'meters');
    
    const start: [number, number] = [userLocation.lng, userLocation.lat];
    const isOneWay = planningData.tripType === 'one-way';
    
    try {
      // Recherche simplifiée avec 8 directions principales
      const searchRadius = isOneWay ? targetMeters : targetMeters / 2;
      const bearings = [0, 45, 90, 135, 180, 225, 270, 315];
      
      for (const bearing of bearings) {
        try {
          // Calculer destination candidate
          const destination = turf.destination(turf.point(start), searchRadius / 1000, bearing, { units: 'kilometers' });
          const candidate = destination.geometry.coordinates as [number, number];
          
          // Calculer route aller
          const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${candidate[0]},${candidate[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
          const outboundRes = await fetch(outboundUrl);
          
          if (!outboundRes.ok) continue;
          
          const outboundData = await outboundRes.json();
          if (!outboundData?.routes?.[0]) continue;
          
          const outboundDistance = outboundData.routes[0].distance;
          let totalDistance = outboundDistance;
          let returnRoute: { featureCollection: GeoJSON.FeatureCollection; distance: number } | undefined;
          
          if (!isOneWay) {
            // Pour round-trip, calculer le retour
            try {
              const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${candidate[0]},${candidate[1]};${start[0]},${start[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
              const returnRes = await fetch(returnUrl);
              
              if (returnRes.ok) {
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
              }
            } catch (error) {
              console.warn('Return route calculation failed, using doubled outbound');
              totalDistance = outboundDistance * 2;
            }
          }
          
          // Vérifier si dans la plage ±5%
          if (totalDistance >= minMeters && totalDistance <= maxMeters) {
            console.log('✓ Default route found and validated');
            
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
            
            // Sauvegarder le trajet par défaut
            defaultRouteRef.current = {
              geojson: outboundRoute.featureCollection,
              color: '#2ECC71'
            };
            
            // Afficher immédiatement
            addOrUpdateSourceLayer('route-default', outboundRoute.featureCollection, '#2ECC71', 4);
            
            if (returnRoute) {
              addOrUpdateSourceLayer('route-return', returnRoute.featureCollection, '#3498DB', 4, true);
            }
            
            // Calculer les statistiques par défaut
            const distanceKm = totalDistance / 1000;
            const duration = Math.round(distanceKm / speedKmh * 60);
            const calories = Math.round(distanceKm * weightKg * calorieCoefficient);
            const estimatedSteps = Math.round(totalDistance / stride);

            setRouteStats({
              distance: totalDistance,
              duration,
              steps: estimatedSteps,
              calories,
              isValid: true
            });
            
            setRouteError(null);
            console.log(`✓ Default route displayed. Distance: ${totalDistance}m, Steps: ${estimatedSteps}`);
            return; // Succès - sortir
          }
        } catch (error) {
          console.warn('Default route candidate failed, trying next:', error);
          continue;
        }
      }
      
      console.error('No default route found within ±5% tolerance');
      setRouteError('Impossible de calculer un itinéraire par défaut dans la plage souhaitée.');
      
    } catch (error) {
      console.error('Default route calculation failed:', error);
      setRouteError('Erreur lors du calcul de l\'itinéraire par défaut.');
    }
  }, [userLocation, map, mapboxToken, planningData.tripType, targetMeters, minMeters, maxMeters, addOrUpdateSourceLayer, speedKmh, weightKg, calorieCoefficient, stride]);

  // Fonction de clic utilisateur (avec validation stricte ±5%)
  const onValidClick = useCallback(async (lngLat: {lng:number; lat:number}) => {
    if (!map || !userLocation) {
      throw new Error('Map or user location not available');
    }
    
    console.log('User clicked on map, calculating route from clicked point...');
    
    const start: [number,number] = [userLocation.lng, userLocation.lat];
    const clickedPoint: [number,number] = [lngLat.lng, lngLat.lat];

    try {
      // Calculer route directe depuis le point cliqué
      const outboundUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${clickedPoint[0]},${clickedPoint[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
      const outboundRes = await fetch(outboundUrl);
      
      if (!outboundRes.ok) {
        throw new Error('Failed to fetch route');
      }
      
      const outboundData = await outboundRes.json();
      if (!outboundData?.routes?.[0]) {
        throw new Error('No route found');
      }
      
      const outboundDistance = outboundData.routes[0].distance;
      let totalDistance = outboundDistance;
      let returnRoute: { featureCollection: GeoJSON.FeatureCollection; distance: number } | undefined;
      
      if (planningData.tripType === 'round-trip') {
        // Pour aller-retour, calculer le retour
        try {
          const returnUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${clickedPoint[0]},${clickedPoint[1]};${start[0]},${start[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
          const returnRes = await fetch(returnUrl);
          
          if (returnRes.ok) {
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
          }
        } catch (error) {
          console.warn('Return route calculation failed, using doubled outbound');
          totalDistance = outboundDistance * 2;
        }
      }
      
      // Validation stricte ±5%
      if (totalDistance < minMeters || totalDistance > maxMeters) {
        setRouteError("Aucun itinéraire valide trouvé dans votre plage d'objectif de pas depuis ce point. Veuillez réessayer ailleurs.");
        setRouteStats(null);
        throw new Error('Route outside ±5% tolerance');
      }
      
      // Afficher les routes trouvées
      clearRoute('route-click');
      clearRoute('route-return-click');
      
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
      
      // Route aller (verte)
      addOrUpdateSourceLayer('route-click', outboundRoute.featureCollection, '#2ECC71', 4);
      
      // Route retour (bleue pointillée) si nécessaire
      if (returnRoute) {
        addOrUpdateSourceLayer('route-return-click', returnRoute.featureCollection, '#3498DB', 4, true);
      }
      
      // Calculer les statistiques finales
      const distanceKm = totalDistance / 1000;
      const duration = Math.round(distanceKm / speedKmh * 60);
      const calories = Math.round(distanceKm * weightKg * calorieCoefficient);
      const estimatedSteps = Math.round(totalDistance / stride);

      setRouteStats({
        distance: totalDistance,
        duration,
        steps: estimatedSteps,
        calories,
        isValid: true
      });
      
      // Mettre à jour le marqueur de destination
      if (destinationMarkerRef.current) {
        destinationMarkerRef.current.setLngLat([lngLat.lng, lngLat.lat]);
      } else {
        const el = document.createElement('div');
        el.style.cssText = `
          width: 20px;
          height: 20px;
          background-color: #E74C3C;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        
        destinationMarkerRef.current = new mapboxgl.Marker(el)
          .setLngLat([lngLat.lng, lngLat.lat])
          .addTo(map);
      }
      
      setRouteError(null);
      console.log(`✓ User click processed successfully. Total distance: ${totalDistance}m, Steps: ${estimatedSteps}`);
      
    } catch (error) {
      console.error('Route calculation failed:', error);
      // Ne pas définir d'erreur ici - elle est gérée au-dessus si nécessaire
      throw error; // Rethrow pour que le hook ne compte pas l'essai
    }
  }, [map, userLocation, planningData.tripType, minMeters, maxMeters, clearRoute, addOrUpdateSourceLayer, speedKmh, weightKg, calorieCoefficient, stride]);

  const onLock = useCallback(() => {
    console.log('Limite de clics atteinte');
  }, []);

  const onResetStartDefault = useCallback(() => {
    if (defaultRouteRef.current && map) {
      console.log('Resetting to default route (no recalculation)');
      addOrUpdateSourceLayer('route-default', defaultRouteRef.current.geojson, defaultRouteRef.current.color);
      clearRoute('route-click');
      clearRoute('route-return-click');
      
      // Restaurer les stats du trajet par défaut SANS recalculer
      setRouteError(null);
      // Les stats sont déjà bonnes depuis le calcul par défaut
    }
  }, [map, addOrUpdateSourceLayer, clearRoute]);

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

  // Initialisation de la carte et calcul du trajet par défaut (UNE SEULE FOIS)
  useEffect(() => {
    if (!map || !userLocation || !mapboxToken) return;
    
    // Centrer la carte et mettre à jour les marqueurs (sans recalculer la route)
    map.setCenter([userLocation.lng, userLocation.lat]);
    updateUserMarkers();
    
    // Calculer la destination par défaut UNIQUEMENT la première fois
    if (!isDefaultRouteCalculated.current) {
      console.log('Calculating default route for the first time');
      isDefaultRouteCalculated.current = true;
      calculateDefaultDestination();
    }
    
  }, [map, userLocation, mapboxToken, updateUserMarkers, calculateDefaultDestination]);

  // Abonnement clic carte - déléguer complètement au hook useMapClickLimiter
  useEffect(() => {
    if (!map) return;
    
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      // PAS de debounce ici - le hook s'en charge
      handleMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    };
    
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [map, handleMapClick]);

  // Affichage des états de chargement
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

  if (!userLocation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="animate-pulse rounded-full h-12 w-12 bg-primary/20 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Localisation en cours...</h3>
          <p className="text-muted-foreground text-sm">
            {locationError || "Nous avons besoin de votre position pour calculer l'itinéraire."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 bg-card/90 backdrop-blur rounded-lg shadow-lg border hover:bg-card/95 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Retour</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col h-screen pt-16">
        {/* Route Info Bar */}
        {routeStats && (
          <div className="bg-card/95 backdrop-blur border-b px-4 py-3">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{routeStats.steps.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">pas</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{(routeStats.distance / 1000).toFixed(1)} km</div>
                  <div className="text-xs text-muted-foreground">distance</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{routeStats.duration} min</div>
                  <div className="text-xs text-muted-foreground">durée</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{routeStats.calories}</div>
                  <div className="text-xs text-muted-foreground">cal</div>
                </div>
              </div>
              {routeStats.isValid && (
                <div className="text-green-600 text-sm font-medium">
                  ✓ Objectif respecté
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {routeError && (
          <div className="bg-destructive/10 border-destructive/20 border-b px-4 py-3">
            <div className="max-w-4xl mx-auto">
              <p className="text-destructive text-sm font-medium">{routeError}</p>
            </div>
          </div>
        )}

        {/* Map Container */}
        <div className="flex-1 relative">
          <div ref={containerRef} className="absolute inset-0" />
          
          {/* Map Locked Overlay */}
          {isLocked && (
            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
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
        <div className="text-center p-4">
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