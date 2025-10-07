import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  const { validateActivityCompletion } = usePlanningLimiter();
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [walkStartTime, setWalkStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentSteps, setCurrentSteps] = useState(0);
  const [isMovementDetected, setIsMovementDetected] = useState(false);
  const [lastStepCount, setLastStepCount] = useState(0);
  const mapRef = useRef<MapRef>(null);
  const motionListenerId = useRef<(() => void) | null>(null);

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

  // Real step detection using device motion sensors
  useEffect(() => {
    const startMotionDetection = async () => {
      if (isTracking && Capacitor.isNativePlatform()) {
        try {
          // Start motion listener for acceleration data
          const listenerId = await Motion.addListener('accel', (event) => {
            // Calculate magnitude of acceleration
            const magnitude = Math.sqrt(
              event.acceleration.x ** 2 + 
              event.acceleration.y ** 2 + 
              event.acceleration.z ** 2
            );
            
            // Detect movement threshold (typical walking is 1.5-4 m/s²)
            if (magnitude > 1.2) {
              setIsMovementDetected(true);
              
              // Simple step detection based on acceleration peaks
              // This is a basic implementation - could be enhanced with more sophisticated algorithms
              if (magnitude > 2.5) {
                setCurrentSteps(prev => prev + 1);
              }
            }
          });
          
          motionListenerId.current = listenerId.remove;
        } catch (error) {
          console.log('Motion detection error:', error);
          // Fallback to web-based detection
          fallbackStepDetection();
        }
      } else if (isTracking) {
        // Web fallback - use simulated movement detection
        fallbackStepDetection();
      }
    };

    const fallbackStepDetection = () => {
      // For web or when motion sensors are not available
      const detectMovement = () => {
        if (navigator.geolocation) {
          navigator.geolocation.watchPosition(
            (position) => {
              setIsMovementDetected(true);
              // Simulate step increment based on GPS movement
              setCurrentSteps(prev => prev + Math.floor(Math.random() * 2) + 1);
            },
            (error) => console.log('GPS error:', error),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
          );
        }
      };
      
      setTimeout(detectMovement, 2000); // Wait 2 seconds before starting fallback
    };

    startMotionDetection();

    return () => {
      if (motionListenerId.current) {
        motionListenerId.current();
        motionListenerId.current = null;
      }
    };
  }, [isTracking]);
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
    setCurrentSteps(0);
    setElapsedTime(0);
    setIsMovementDetected(false);
    setLastStepCount(0);
    resetGPS();
    resetFeedback();
    
    validateActivityCompletion();
    
    toast.info("🚶 Marche démarrée ! GPS activé.");
  };

  const handlePauseWalk = () => {
    setIsTracking(false);
  };

  const handleStopWalk = () => {
    if (walkStartTime && elapsedTime > 0) {
      // Use real GPS distance instead of step-based estimation
      const distanceKm = totalDistance > 0 ? totalDistance : (currentSteps * 0.415 * planningData.height) / 1000;
      const calories = liveMetrics.calories;
      const durationMin = Math.round(elapsedTime / 60);

      // Save to localStorage for now - can be enhanced to sync with database later
      const walkSession = {
        id: `walk_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        steps: currentSteps,
        distanceKm: Number(distanceKm.toFixed(2)),
        calories,
        durationMin,
        startTime: walkStartTime,
        endTime: new Date()
      };

      // Get existing sessions and add new one
      const existingSessions = JSON.parse(localStorage.getItem('walkSessions') || '[]');
      existingSessions.push(walkSession);
      localStorage.setItem('walkSessions', JSON.stringify(existingSessions));

      console.log('Walk session saved:', walkSession);
      
      toast.success(`🎉 Marche terminée ! ${distanceKm.toFixed(1)} km, ${calories} kcal`);
    }

    setIsTracking(false);
    setWalkStartTime(null);
    setElapsedTime(0);
    setCurrentSteps(0);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <div className="bg-card shadow-sm">
        <div className="px-6 py-4 flex items-center justify-end">
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
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
    </div>
  );
};

export default WalkTracking;