import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, MapPin, Clock, Zap, Loader2, RefreshCw } from 'lucide-react';
import Map, { MapRef } from './Map';
import { useSingleDestination } from '@/hooks/useSingleDestination';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DestinationSelectionProps {
  onComplete: (destination: Destination) => void;
  onBack: () => void;
  onGoToDashboard: () => void;
  planningData: {
    steps: string;
    pace: 'slow' | 'moderate' | 'fast';
    tripType: 'one-way' | 'round-trip';
    height: string;
    weight: string;
  };
}

interface Destination {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  routeGeoJSON?: any;
  distanceKm: number;
  durationMin: number;
  calories: number;
}

const DestinationSelection = ({ onComplete, onBack, onGoToDashboard, planningData }: DestinationSelectionProps) => {
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [currentDestination, setCurrentDestination] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);
  const { user } = useAuth();
  const { subscriptionData } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Calculate target distance from steps and height
  const calculateTargetDistance = (steps: string, height: string) => {
    const stepCount = parseInt(steps);
    const heightInMeters = parseFloat(height);
    const strideLength = 0.415 * heightInMeters;
    return (stepCount * strideLength) / 1000; // km
  };

  // Calculate calories based on distance, weight, and pace
  const calculateCalories = (distanceKm: number, weight: string, pace: string) => {
    const weightKg = parseFloat(weight);
    const met = pace === 'slow' ? 3.0 : pace === 'moderate' ? 4.0 : 5.0;
    const timeHours = distanceKm / (pace === 'slow' ? 4 : pace === 'moderate' ? 5 : 6);
    return Math.round(met * weightKg * timeHours);
  };

  // Get route from Mapbox Directions API
  const getRoute = async (start: [number, number], end: [number, number]) => {
    if (!mapboxToken) return null;
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${mapboxToken}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch route');
      
      const data = await response.json();
      return data.routes[0];
    } catch (error) {
      console.error('Route fetch error:', error);
      return null;
    }
  };

  // Generate random destinations around user location and find one within tolerance
  const findValidOneWayDestination = async (userLoc: { lat: number; lng: number }) => {
    if (!mapboxToken || planningData.tripType !== 'one-way') return;

    const targetDistance = calculateTargetDistance(planningData.steps, planningData.height);
    const tolerance = 0.05; // 5%
    const minDistance = targetDistance * (1 - tolerance);
    const maxDistance = targetDistance * (1 + tolerance);

    setLoading(true);
    setError(null);

    // Try multiple random destinations around user location
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      // Generate random point within reasonable radius (roughly targetDistance * 1.2)
      const maxRadius = targetDistance * 1.2;
      const angle = Math.random() * 2 * Math.PI;
      const radius = Math.random() * maxRadius;
      
      // Convert km to approximate degrees (rough approximation)
      const latOffset = (radius * Math.cos(angle)) / 111.32; // 1 degree lat ≈ 111.32 km
      const lngOffset = (radius * Math.sin(angle)) / (111.32 * Math.cos(userLoc.lat * Math.PI / 180));
      
      const destinationCoords: [number, number] = [
        userLoc.lng + lngOffset,
        userLoc.lat + latOffset
      ];
      
      const startCoords: [number, number] = [userLoc.lng, userLoc.lat];
      const route = await getRoute(startCoords, destinationCoords);
      
      if (route) {
        const routeDistanceKm = route.distance / 1000;
        
        if (routeDistanceKm >= minDistance && routeDistanceKm <= maxDistance) {
          // Found a valid route!
          const calories = calculateCalories(routeDistanceKm, planningData.weight, planningData.pace);
          const durationMin = Math.round(route.duration / 60);
          
          const destination: Destination = {
            id: 'auto-generated-one-way',
            name: `Destination à ${routeDistanceKm.toFixed(1)} km`,
            coordinates: { lat: destinationCoords[1], lng: destinationCoords[0] },
            routeGeoJSON: route.geometry,
            distanceKm: routeDistanceKm,
            durationMin,
            calories
          };
          
          setCurrentDestination(destination);
          setLoading(false);
          return;
        }
      }
    }

    // No valid route found within tolerance
    setError(`Aucun itinéraire trouvé dans la tolérance de ±5% (cible: ${targetDistance.toFixed(2)}km).`);
    setLoading(false);
  };

  // Get Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        setError('Erreur lors du chargement de la carte');
      }
    };
    fetchToken();
  }, []);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation error:', error);
          // Default to France center if geolocation is denied
          setUserLocation({ lat: 46.603354, lng: 1.888334 });
        }
      );
    } else {
      // Default to France center if geolocation is not available
      setUserLocation({ lat: 46.603354, lng: 1.888334 });
    }
  }, []);

  // Auto-compute one-way destination when everything is ready
  useEffect(() => {
    if (userLocation && mapboxToken && planningData.tripType === 'one-way' && !currentDestination && !loading && !error) {
      findValidOneWayDestination(userLocation);
    }
  }, [userLocation, mapboxToken, planningData, currentDestination, loading, error]);

  // For non-one-way trips, use the original logic (commented out for now)
  const { 
    currentDestination: fallbackDestination, 
    refreshRemaining, 
    loading: fallbackLoading, 
    error: fallbackError, 
    fetchDestinations, 
    refreshDestination, 
    resetSession,
    canRefresh 
  } = useSingleDestination();

  // Use fallback for round-trip
  useEffect(() => {
    if (planningData.tripType === 'round-trip' && userLocation && !fallbackDestination && !fallbackLoading) {
      fetchDestinations(userLocation, planningData, {
        heightM: parseFloat(planningData.height),
        weightKg: parseFloat(planningData.weight)
      });
    }
  }, [planningData.tripType, userLocation, fallbackDestination, fallbackLoading, fetchDestinations]);

  // Use appropriate destination and state based on trip type
  const activeDestination = planningData.tripType === 'one-way' ? currentDestination : fallbackDestination;
  const activeLoading = planningData.tripType === 'one-way' ? loading : fallbackLoading;
  const activeError = planningData.tripType === 'one-way' ? error : fallbackError;

  const handleRefresh = () => {
    if (planningData.tripType === 'one-way') {
      if (userLocation) {
        setCurrentDestination(null);
        setError(null);
        findValidOneWayDestination(userLocation);
      }
    } else {
      if (canRefresh) {
        refreshDestination();
      }
    }
  };

  const handleStartWalk = () => {
    if (!activeDestination) return;
    
    // Lancer le suivi de marche pour tous les utilisateurs
    onComplete(activeDestination);
  };

  const handleDestinationClick = () => {
    // Center the map on the current route
    if (mapRef.current && activeDestination && userLocation) {
      mapRef.current.fitToRoute();
    }
  };

  // Calculer l'écart avec la distance cible
  const getTargetDistance = () => {
    const steps = parseInt(planningData.steps);
    const heightM = parseFloat(planningData.height);
    const strideM = 0.415 * heightM;
    const totalKm = (steps * strideM) / 1000;
    // Return full target distance - route calculation handles round-trip logic internally
    return totalKm;
  };

  const getDeviation = () => {
    if (!activeDestination) return '0 km';
    const target = getTargetDistance();
    const deviation = activeDestination.distanceKm - target;
    const sign = deviation >= 0 ? '+' : '';
    return `${sign}${deviation.toFixed(1)} km`;
  };

  const getDeviationColor = () => {
    if (!activeDestination) return 'bg-gray-400';
    const target = getTargetDistance();
    const deviation = Math.abs(activeDestination.distanceKm - target);
    if (deviation <= 0.2) return 'bg-green-500';
    if (deviation <= 0.5) return 'bg-orange-500';
    return 'bg-red-500';
  };

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
      <div className="container max-w-4xl mx-auto px-6 py-8">
        {/* Titre et description */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Choisis ta destination
          </h1>
          <div className="space-y-2 text-muted-foreground max-w-2xl mx-auto">
            <p>Fitpas calcule la distance en fonction de ton allure et du nombre de pas.</p>
            <p>Voici une destination proposée pour atteindre ton objectif.</p>
          </div>
        </div>

        {/* Résumé de la planification */}
        <div className="bg-card rounded-xl p-4 mb-8 shadow-sm">
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

        {/* Section Destination avec bouton Réactualiser séparé */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Destination proposée</h2>
            {activeDestination && (
              <Button
                onClick={handleRefresh}
                disabled={activeLoading}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
                title={planningData.tripType === 'one-way' ? 'Rechercher une nouvelle destination' : `Réactualiser (${refreshRemaining} restant${refreshRemaining > 1 ? 's' : ''})`}
              >
                <RefreshCw size={16} className={activeLoading ? 'animate-spin' : ''} />
                <span>
                  {planningData.tripType === 'one-way' ? 'Nouvelle destination' : `Réactualiser (${refreshRemaining})`}
                </span>
              </Button>
            )}
          </div>

          {/* Carte interactive avec destination unique */}
          <div className="bg-card rounded-2xl shadow-lg overflow-hidden mb-4" style={{ height: '360px' }}>
            {activeLoading ? (
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    {planningData.tripType === 'one-way' ? 'Calcul de destination automatique...' : 'Recherche de destination...'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {planningData.tripType === 'one-way' ? 'Recherche dans la tolérance ±5%' : 'Calcul de l\'itinéraire optimal'}
                  </p>
                </div>
              </div>
            ) : activeError ? (
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-destructive/10 to-muted/10 rounded-2xl">
                <div className="text-center max-w-md p-6">
                  <p className="text-sm text-destructive mb-2">
                    {planningData.tripType === 'one-way' ? 'Aucun itinéraire dans la tolérance' : 'Erreur lors du chargement'}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">{activeError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      if (planningData.tripType === 'one-way' && userLocation) {
                        setCurrentDestination(null);
                        setError(null);
                        findValidOneWayDestination(userLocation);
                      } else if (userLocation) {
                        fetchDestinations(userLocation, planningData, { heightM: parseFloat(planningData.height), weightKg: parseFloat(planningData.weight) });
                      }
                    }}
                  >
                    Réessayer
                  </Button>
                </div>
              </div>
            ) : activeDestination ? (
              <>
                {console.log('Destination à afficher:', {
                  id: activeDestination.id,
                  name: activeDestination.name,
                  coordinates: activeDestination.coordinates,
                  routeGeoJSON: activeDestination.routeGeoJSON,
                  distanceKm: activeDestination.distanceKm
                })}
                <Map 
                  ref={mapRef}
                  userLocation={userLocation}
                  destinations={[{
                    id: activeDestination.id,
                    name: activeDestination.name,
                    distance: `${activeDestination.distanceKm.toFixed(1)} km`,
                    duration: `${activeDestination.durationMin} min`,
                    calories: activeDestination.calories,
                    description: `Destination à ${activeDestination.distanceKm.toFixed(1)} km`,
                    coordinates: activeDestination.coordinates || {
                      lat: userLocation?.lat ? userLocation.lat + 0.01 : 48.8566,
                      lng: userLocation?.lng ? userLocation.lng + 0.01 : 2.3522
                    },
                    route: activeDestination.routeGeoJSON
                  }]}
                  selectedDestination={activeDestination.id}
                  onDestinationSelect={() => {}} // Pas de sélection nécessaire avec une seule destination
                  planningData={planningData}
                />
              </>
            ) : (
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-muted/10 to-secondary/10 rounded-2xl">
                <p className="text-muted-foreground">Aucune destination trouvée</p>
              </div>
            )}
          </div>
        </div>

        {/* Carte-info de destination (clickable) */}
        {activeDestination && (
          <Card 
            className="p-6 mb-8 shadow-lg cursor-pointer hover:shadow-xl transition-shadow duration-200 border-2 hover:border-primary/20"
            onClick={handleDestinationClick}
          >
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground">
                🎯
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  {activeDestination.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {planningData.tripType === 'one-way' 
                    ? 'Destination calculée automatiquement dans la tolérance ±5%' 
                    : 'Cliquez sur cette carte pour centrer la vue sur l\'itinéraire'
                  }
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <MapPin size={16} className="text-primary" />
                    <div>
                      <span className="font-medium">{activeDestination.distanceKm.toFixed(1)} km</span>
                      <p className="text-xs text-muted-foreground">Distance aller</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock size={16} className="text-secondary" />
                    <div>
                      <span className="font-medium">{activeDestination.durationMin} min</span>
                      <p className="text-xs text-muted-foreground">Durée aller</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Zap size={16} className="text-orange-500" />
                    <div>
                      <span className="font-medium">{activeDestination.calories} cal</span>
                      <p className="text-xs text-muted-foreground">Calories totales</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-4 h-4 rounded-full ${getDeviationColor()}`}></div>
                    <div>
                      <span className="font-medium">{getDeviation()}</span>
                      <p className="text-xs text-muted-foreground">Écart cible</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Bouton CTA */}
        <div className="text-center">
          <Button
            onClick={handleStartWalk}
            disabled={!activeDestination}
            size="lg"
            className="w-full max-w-md h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
          >
            Lancer cette marche
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DestinationSelection;