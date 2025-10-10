import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Play, Pause, Square, Clock, MapPin, Zap, Target, Timer, Navigation } from 'lucide-react';
import Map, { MapRef } from './Map';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Motion } from '@capacitor/motion';
import { Capacitor } from '@capacitor/core';
import { usePlanningLimiter } from '@/hooks/usePlanningLimiter';
import { useGPSTracking } from '@/hooks/useGPSTracking';
import { useLiveMetrics } from '@/hooks/useLiveMetrics';
import { useTrackingFeedback } from '@/hooks/useTrackingFeedback';
import { useStepDetection } from '@/hooks/useStepDetection';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Destination {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  routeGeoJSON?: any; // Can contain outboundCoordinates and returnCoordinates for round-trip
  distanceKm: number;
  durationMin: number;
  calories: number;
}

interface WalkTrackingProps {
  destination: Destination;
  planningData: {
    steps?: number;
    distance?: number;
    pace: 'slow' | 'moderate' | 'fast';
    tripType: 'one-way' | 'round-trip';
    height: number;
    weight: number;
  };
  onBack: () => void;
  onGoToDashboard: () => void;
}

const WalkTracking = ({ destination, planningData, onBack, onGoToDashboard }: WalkTrackingProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { validateActivityCompletion } = usePlanningLimiter();
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [walkStartTime, setWalkStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const mapRef = useRef<MapRef>(null);

  // Enhanced step detection
  const { currentSteps, isMovementDetected, resetStepDetection } = useStepDetection({
    isTracking,
    activityType: 'walk'
  });

  // GPS Tracking with real-time path recording
  const { 
    currentPosition, 
    pathCoordinates, 
    totalDistance, 
    currentSpeed,
    resetTracking: resetGPS
  } = useGPSTracking({
    isTracking,
    onPositionUpdate: (position) => {
      setUserLocation({ lat: position.lat, lng: position.lng });
    }
  });

  // Live metrics calculation
  const liveMetrics = useLiveMetrics({
    totalDistance,
    currentSpeed,
    elapsedTime,
    weight: planningData.weight,
    activityType: 'walk',
    pace: planningData.pace
  });

  // Calculate progress percentage
  const currentProgress = planningData.steps ? Math.min((currentSteps / planningData.steps) * 100, 100) : 0;

  // Tracking feedback (milestones, alerts)
  const { resetFeedback, getRemainingDistance } = useTrackingFeedback({
    currentProgress,
    isTracking,
    currentPosition: currentPosition ? { lat: currentPosition.lat, lng: currentPosition.lng } : null,
    destinationCoords: destination.coordinates,
    totalDistance
  });

  // Step detection is now handled by useStepDetection hook
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTracking && walkStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - walkStartTime.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, walkStartTime]);

  // Obtenir la localisation de l'utilisateur
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(newLocation);
          
          // Fit map to route once location is obtained
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.fitToRoute();
            }
          }, 500);
        },
        (error) => {
          console.log('Geolocation error:', error);
          // Position par défaut
          const defaultLocation = { lat: 48.8566, lng: 2.3522 };
          setUserLocation(defaultLocation);
          
          // Fit map to route even with default location
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.fitToRoute();
            }
          }, 500);
        }
      );
    }
  }, []);

  // Fit map to route when destination or user location is available
  useEffect(() => {
    if (userLocation && destination.routeGeoJSON && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.fitToRoute();
      }, 1000);
    }
  }, [userLocation, destination]);

  // Surveillance de la position pendant le tracking (optionnel)
  useEffect(() => {
    let watchId: number;
    
    if (isTracking && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Position tracking error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 5000
        }
      );
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isTracking]);

  const handleStartWalk = () => {
    setIsTracking(true);
    setWalkStartTime(new Date());
    setElapsedTime(0);
    resetStepDetection();
    resetGPS();
    resetFeedback();
    
    validateActivityCompletion();
    
    toast.info("🚶 Marche démarrée ! GPS activé.");
  };

  const handlePauseWalk = () => {
    setIsTracking(false);
  };

  const handleStopWalk = async () => {
    if (walkStartTime && elapsedTime > 0 && user) {
      const distanceKm = totalDistance > 0 ? totalDistance : (currentSteps * 0.415 * planningData.height) / 1000;
      const calories = liveMetrics.calories;
      const durationMin = Math.round(elapsedTime / 60);

      // Save to Supabase
      const { error } = await supabase
        .from('activities')
        .insert({
          user_id: user.id,
          activity_type: 'walk',
          date: new Date().toISOString().split('T')[0],
          steps: currentSteps,
          distance_km: Number(distanceKm.toFixed(2)),
          calories,
          duration_min: durationMin,
          start_time: walkStartTime.toISOString(),
          end_time: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving walk session:', error);
        toast.error('Erreur lors de la sauvegarde');
      } else {
        console.log('Walk session saved');
        toast.success(`🎉 Marche terminée ! ${distanceKm.toFixed(1)} km, ${calories} kcal`);
      }
    }

    setIsTracking(false);
    setWalkStartTime(null);
    setElapsedTime(0);
    resetStepDetection();
    resetGPS();
    resetFeedback();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getPaceText = (pace: string) => {
    switch(pace) {
      case 'slow': return 'Lente';
      case 'moderate': return 'Modérée';
      case 'fast': return 'Rapide';
      default: return 'Modérée';
    }
  };

  const getProgress = () => {
    const targetSteps = planningData.steps;
    return Math.min((currentSteps / targetSteps) * 100, 100);
  };

  // Calculate estimated steps for the selected route
  const getEstimatedSteps = () => {
    const heightM = planningData.height;
    const strideM = heightM ? 0.415 * heightM : 0.72;
    const distanceM = destination.distanceKm * 1000;
    return Math.round(distanceM / strideM);
  };

  const handleLogoClick = () => {
    // Si une activité est en cours, afficher le dialog de confirmation
    if (isTracking || walkStartTime) {
      setShowExitDialog(true);
    } else {
      onGoToDashboard();
    }
  };

  const handleConfirmExit = () => {
    setShowExitDialog(false);
    onGoToDashboard();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <div className="bg-card shadow-sm">
        <div className="px-6 py-4 flex items-center justify-end">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={handleLogoClick}>
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
        {/* Titre */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Navigation vers
          </h1>
          <h2 className="text-xl text-primary font-semibold mb-4">
            {destination.name}
          </h2>
        </div>

        {/* Stats de marche actuelles - LIVE */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Timer size={20} className="text-primary" />
            </div>
            <div className="text-2xl font-bold text-foreground">{formatTime(elapsedTime)}</div>
            <div className="text-sm text-muted-foreground">Temps</div>
          </Card>
          
          <Card className="p-4 text-center bg-gradient-to-br from-primary/5 to-primary/10">
            <div className="flex items-center justify-center mb-2">
              <Target size={20} className={isMovementDetected ? "text-secondary" : "text-muted-foreground"} />
            </div>
            <div className="text-2xl font-bold text-foreground">{currentSteps}</div>
            <div className="text-sm text-muted-foreground">
              {isTracking && !isMovementDetected ? "En attente..." : "Pas détectés"}
            </div>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Zap size={20} className="text-secondary" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {currentSpeed > 0 ? currentSpeed.toFixed(1) : "0.0"}
            </div>
            <div className="text-sm text-muted-foreground">km/h</div>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Target size={20} className="text-green-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {liveMetrics.calories}
            </div>
            <div className="text-sm text-muted-foreground">kcal</div>
          </Card>
        </div>

        {/* Route planifiée - Estimation */}
        <Card className="p-6 mb-6 bg-gradient-to-br from-primary/5 to-secondary/5">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
            <Target className="w-5 h-5 text-primary" />
            <span>Route planifiée</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{getEstimatedSteps()}</div>
              <div className="text-sm text-muted-foreground">Pas estimés</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">{destination.distanceKm.toFixed(1)} km</div>
              <div className="text-sm text-muted-foreground">Distance totale</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">{Math.round(destination.durationMin)} min</div>
              <div className="text-sm text-muted-foreground">Durée estimée</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">{destination.calories} kcal</div>
              <div className="text-sm text-muted-foreground">Calories</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              {planningData.tripType === 'round-trip' ? '🔄 Aller-retour' : '➡️ Aller simple'} • 
              Allure {getPaceText(planningData.pace)}
            </p>
          </div>
        </Card>

        {/* Barre de progression */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Progression vers l'objectif</span>
            <span>{currentSteps} / {planningData.steps} pas (cible: {getEstimatedSteps()} pas estimés)</span>
          </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-primary h-3 rounded-full"
                style={{ width: `${getProgress()}%` }}
              ></div>
            </div>
        </div>

        {/* Carte de suivi */}
        <div className="bg-card rounded-2xl shadow-lg overflow-hidden mb-6" style={{ height: '400px' }}>
          {userLocation ? (
            <Map 
              ref={mapRef}
              userLocation={userLocation}
              destinations={[{
                id: destination.id,
                name: destination.name,
                distance: `${destination.distanceKm.toFixed(1)} km`,
                duration: `${Math.round(destination.durationMin)} min`,
                calories: destination.calories,
                description: `Destination à ${destination.distanceKm.toFixed(1)} km - ${getEstimatedSteps()} pas estimés`,
                coordinates: destination.coordinates,
                routeGeoJSON: destination.routeGeoJSON
              }]}
              selectedDestination={destination.id}
              onDestinationSelect={() => {}}
              planningData={planningData}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Chargement de votre position...</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Activation du GPS
                </p>
              </div>
            </div>
          )}
        </div>


        {/* Contrôles de la marche */}
        <div className="flex justify-center space-x-4">
          {!isTracking && !walkStartTime && (
            <Button
              onClick={handleStartWalk}
              size="lg"
              className="bg-primary active:bg-primary/90 text-primary-foreground px-8 py-3 text-lg font-semibold shadow-lg active:shadow-md touch-manipulation transition-all duration-150"
            >
              <Play size={20} className="mr-2" />
              Go!
            </Button>
          )}
          
          {isTracking && (
            <Button
              onClick={handlePauseWalk}
              size="lg"
              variant="outline"
              className="px-8 py-3 text-lg font-semibold"
            >
              <Pause size={20} className="mr-2" />
              Pause
            </Button>
          )}
          
          {!isTracking && walkStartTime && (
            <Button
              onClick={handleStartWalk}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg font-semibold"
            >
              <Play size={20} className="mr-2" />
              Reprendre
            </Button>
          )}
          
          {walkStartTime && (
            <Button
              onClick={handleStopWalk}
              size="lg"
              variant="destructive"
              className="px-8 py-3 text-lg font-semibold"
            >
              <Square size={20} className="mr-2" />
              Terminer
            </Button>
          )}
        </div>
      </div>

      {/* Dialog de confirmation de sortie */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arrêter l'activité ?</DialogTitle>
            <DialogDescription>
              Votre activité est en cours. Êtes-vous sûr de vouloir quitter ? Vos données ne seront pas sauvegardées si vous n'avez pas terminé l'activité.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Continuer l'activité
            </Button>
            <Button variant="destructive" onClick={handleConfirmExit}>
              Quitter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalkTracking;