import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
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

const MapScreen = ({ onComplete, onBack, onGoToDashboard, planningData }: MapScreenProps) => {
  const containerRef = useRef<HTMLDivElement|null>(null);
  const [map, setMap] = useState<mapboxgl.Map|null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  // Trajet par défaut mémorisé pour le "Réinitialiser"
  const defaultRouteRef = useRef<{ geojson: GeoJSON.FeatureCollection; color: string } | null>(null);

  const maxClicks = planningData?.mapConfig?.maxValidClicks ?? 3;

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

  // ========= Helpers routing (Mapbox Directions API) =========
  async function fetchRoute(start: [number,number], end: [number,number]) {
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;
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
    return { featureCollection: fc, distanceMeters: data.routes[0].distance };
  }

  function addOrUpdateSourceLayer(id: string, fc: GeoJSON.FeatureCollection, color: string, width = 4) {
    if (!map) return;
    if (map.getSource(id)) {
      (map.getSource(id) as mapboxgl.GeoJSONSource).setData(fc);
    } else {
      map.addSource(id, { type: 'geojson', data: fc });
      map.addLayer({
        id,
        type: 'line',
        source: id,
        paint: { 'line-color': color, 'line-width': width }
      });
    }
  }

  function clearRoute(id: string) {
    if (!map) return;
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  }

  function drawDefaultRoute(fc: GeoJSON.FeatureCollection, color = '#2ECC71') {
    addOrUpdateSourceLayer('route-default', fc, color, 4);
  }

  // ========= Limiteur 3 clics =========
  const onValidClick = async (lngLat: {lng:number; lat:number}) => {
    if (!map) return;

    // Exemple simple : on trace un itinéraire depuis le centre actuel vers le point cliqué
    const center = map.getCenter();
    const start: [number,number] = [center.lng, center.lat];
    const end: [number,number] = [lngLat.lng, lngLat.lat];

    const { featureCollection } = await fetchRoute(start, end);
    addOrUpdateSourceLayer('route-click', featureCollection, '#2ECC71', 4); // vert pour l'aller

    // (Optionnel) Si tripType === 'round-trip', tu peux calculer un retour différent ici
    // et le dessiner en bleu :
    // const { featureCollection: back } = await fetchRoute(end, start);
    // addOrUpdateSourceLayer('route-back', back, '#3498DB', 4);
  };

  const onLock = () => {
    // Ici tu peux afficher un toast si tu veux
    // console.log('Limite de clics atteinte');
  };

  const onResetStartDefault = () => {
    if (defaultRouteRef.current) {
      // Réaffiche le trajet par défaut (pas de déverrouillage)
      drawDefaultRoute(defaultRouteRef.current.geojson, defaultRouteRef.current.color);
      // Nettoie les routes testées
      clearRoute('route-click');
      clearRoute('route-back');
    }
  };

  const { clickCount, isLocked, handleMapClick, reset } = useMapClickLimiter({
    maxValidClicks: maxClicks,
    resetMode: planningData?.mapConfig?.resetMode ?? 'LOCK_AND_START_DEFAULT',
    onValidClick,
    onLock,
    onResetStartDefault
  });

  // ========= Init map + trajet par défaut =========
  useEffect(() => {
    if (!containerRef.current || !mapboxToken) return;

    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [2.3522, 48.8566], // Paris par défaut
      zoom: 13
    });
    setMap(m);

    m.on('load', async () => {
      // Calcule un "trajet par défaut" simple : centre → centre déplacé de 500m à l'est (exemple)
      const c = m.getCenter();
      const start: [number,number] = [c.lng, c.lat];
      const end: [number,number] = [c.lng + 0.0065, c.lat]; // ≈ 500–600 m à l'est selon latitude

      try {
        const { featureCollection } = await fetchRoute(start, end);
        drawDefaultRoute(featureCollection, '#2ECC71');
        defaultRouteRef.current = { geojson: featureCollection, color: '#2ECC71' };
      } catch (e) {
        console.error('Default route error', e);
      }
    });

    return () => m.remove();
  }, [mapboxToken]);

  // Abonnement clic carte
  useEffect(() => {
    if (!map) return;
    const onClick = (e: mapboxgl.MapMouseEvent) => {
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
            Tapez sur la carte pour placer votre destination. Un itinéraire sera calculé automatiquement.
          </p>
        </div>

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
              coordinates: { lat: 48.8566, lng: 2.3522 },
              distanceKm: 1.2,
              durationMin: 15,
              calories: 50
            })}
            className="w-full max-w-md h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] border-0"
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