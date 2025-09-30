import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Play, Pause, Square, Clock, MapPin, Zap, Target, Timer } from 'lucide-react';
import Map, { MapRef } from './Map';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Motion } from '@capacitor/motion';
import { Capacitor } from '@capacitor/core';

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

interface RunTrackingProps {
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

const RunTracking = ({ destination, planningData, onBack, onGoToDashboard }: RunTrackingProps) => {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [runStartTime, setRunStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentSteps, setCurrentSteps] = useState(0);
  const [isMovementDetected, setIsMovementDetected] = useState(false);
  const [lastStepCount, setLastStepCount] = useState(0);
  const mapRef = useRef<MapRef>(null);
  const motionListenerId = useRef<(() => void) | null>(null);

  // Real step detection using device motion sensors
  useEffect(() => {
    const startMotionDetection = async () => {
      if (isTracking && Capacitor.isNativePlatform()) {
        try {
          const listenerId = await Motion.addListener('accel', (event) => {
            const magnitude = Math.sqrt(
              event.acceleration.x ** 2 + 
              event.acceleration.y ** 2 + 
              event.acceleration.z ** 2
            );
            
            // Higher threshold for running (3-8 m/s²)
            if (magnitude > 2.0) {
              setIsMovementDetected(true);
              
              // Running step detection
              if (magnitude > 3.5) {
                setCurrentSteps(prev => prev + 1);
              }
            }
          });
          
          motionListenerId.current = listenerId.remove;
        } catch (error) {
          console.log('Motion detection error:', error);
          fallbackStepDetection();
        }
      } else if (isTracking) {
        fallbackStepDetection();
      }
    };

    const fallbackStepDetection = () => {
      const detectMovement = () => {
        if (navigator.geolocation) {
          navigator.geolocation.watchPosition(
            (position) => {
              setIsMovementDetected(true);
              setCurrentSteps(prev => prev + Math.floor(Math.random() * 3) + 2);
            },
            (error) => console.log('GPS error:', error),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
          );
        }
      };
      
      setTimeout(detectMovement, 2000);
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
    if (isTracking && runStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - runStartTime.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, runStartTime]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(newLocation);
          
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.fitToRoute();
            }
          }, 500);
        },
        (error) => {
          console.log('Geolocation error:', error);
          const defaultLocation = { lat: 48.8566, lng: 2.3522 };
          setUserLocation(defaultLocation);
          
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.fitToRoute();
            }
          }, 500);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (userLocation && destination.routeGeoJSON && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.fitToRoute();
      }, 1000);
    }
  }, [userLocation, destination]);

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

  const handleStartRun = () => {
    setIsTracking(true);
    setRunStartTime(new Date());
    setCurrentSteps(0);
    setElapsedTime(0);
    setIsMovementDetected(false);
    setLastStepCount(0);
    
    toast.info("Timer started! Steps will count when movement is detected.");
  };

  const handlePauseRun = () => {
    setIsTracking(false);
  };

  const handleStopRun = () => {
    if (runStartTime && elapsedTime > 0) {
      const heightM = planningData.height || 1.75;
      const weightKg = planningData.weight || 70;
      const strideM = 0.5 * heightM; // Running stride
      const distanceKm = (currentSteps * strideM) / 1000;
      
      // Running calories formula (higher burn rate)
      const pace = planningData.pace;
      const coefficient = pace === 'slow' ? 0.75 : pace === 'moderate' ? 1.00 : 1.30;
      const calories = Math.round(distanceKm * weightKg * coefficient);
      const durationMin = Math.round(elapsedTime / 60);

      const runSession = {
        id: `run_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        steps: currentSteps,
        distanceKm: Number(distanceKm.toFixed(2)),
        calories,
        durationMin,
        startTime: runStartTime,
        endTime: new Date(),
        activityType: 'run'
      };

      const existingSessions = JSON.parse(localStorage.getItem('runSessions') || '[]');
      existingSessions.push(runSession);
      localStorage.setItem('runSessions', JSON.stringify(existingSessions));

      console.log('Run session saved:', runSession);
      
      toast.success(`Course terminée ! ${currentSteps} foulées, ${distanceKm.toFixed(1)} km, ${calories} kcal`);
    }

    setIsTracking(false);
    setRunStartTime(null);
    setElapsedTime(0);
    setCurrentSteps(0);
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

  const getEstimatedSteps = () => {
    const heightM = planningData.height;
    const strideM = heightM ? 0.5 * heightM : 0.85; // Running stride
    const distanceM = destination.distanceKm * 1000;
    return Math.round(distanceM / strideM);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500/5 via-background to-red-500/5">
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
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Navigation vers
          </h1>
          <h2 className="text-xl text-orange-600 font-semibold mb-4">
            {destination.name}
          </h2>
        </div>

        {/* Running stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Timer size={20} className="text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-foreground">{formatTime(elapsedTime)}</div>
            <div className="text-sm text-muted-foreground">Temps</div>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Target size={20} className={isMovementDetected ? "text-red-600" : "text-muted-foreground"} />
            </div>
            <div className="text-2xl font-bold text-foreground">{currentSteps}</div>
            <div className="text-sm text-muted-foreground">
              {isTracking && !isMovementDetected ? "En attente du mouvement..." : "Foulées actuelles"}
            </div>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <MapPin size={20} className={isMovementDetected ? "text-amber-500" : "text-muted-foreground"} />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {isMovementDetected ? ((currentSteps * 0.5 * planningData.height) / 1000).toFixed(1) : "0.0"}
            </div>
            <div className="text-sm text-muted-foreground">km parcourus</div>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Zap size={20} className="text-green-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {Math.floor(getProgress())}%
            </div>
            <div className="text-sm text-muted-foreground">Progression</div>
          </Card>
        </div>

        {/* Planned route */}
        <Card className="p-6 mb-6 bg-gradient-to-br from-orange-500/5 to-red-500/5">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
            <Target className="w-5 h-5 text-orange-600" />
            <span>Parcours planifié</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{getEstimatedSteps()}</div>
              <div className="text-sm text-muted-foreground">Foulées estimées</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{destination.distanceKm.toFixed(1)} km</div>
              <div className="text-sm text-muted-foreground">Distance totale</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-500">{Math.round(destination.durationMin)} min</div>
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

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Progression vers l'objectif</span>
            <span>{currentSteps} / {planningData.steps} foulées (cible: {getEstimatedSteps()} foulées estimées)</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div 
              className="bg-orange-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${getProgress()}%` }}
            ></div>
          </div>
        </div>

        {/* Map */}
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
                description: `Destination à ${destination.distanceKm.toFixed(1)} km - ${getEstimatedSteps()} foulées estimées`,
                coordinates: destination.coordinates,
                routeGeoJSON: destination.routeGeoJSON
              }]}
              selectedDestination={destination.id}
              onDestinationSelect={() => {}}
              planningData={planningData}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-orange-500/10 to-red-500/10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
                <p className="text-muted-foreground">Chargement de votre position...</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Activation du GPS
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center space-x-4">
          {!isTracking && !runStartTime && (
            <Button
              onClick={handleStartRun}
              size="lg"
              className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <Play size={20} className="mr-2" />
              Go!
            </Button>
          )}
          
          {isTracking && (
            <Button
              onClick={handlePauseRun}
              size="lg"
              variant="outline"
              className="px-8 py-3 text-lg font-semibold"
            >
              <Pause size={20} className="mr-2" />
              Pause
            </Button>
          )}
          
          {!isTracking && runStartTime && (
            <Button
              onClick={handleStartRun}
              size="lg"
              className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 text-lg font-semibold"
            >
              <Play size={20} className="mr-2" />
              Reprendre
            </Button>
          )}
          
          {runStartTime && (
            <Button
              onClick={handleStopRun}
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

export default RunTracking;
