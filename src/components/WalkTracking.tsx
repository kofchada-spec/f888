import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Play, Pause, Square, Clock, MapPin, Zap, Target, Timer } from 'lucide-react';
import Map, { MapRef } from './Map';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
    steps: string;
    pace: 'slow' | 'moderate' | 'fast';
    tripType: 'one-way' | 'round-trip';
    height: string;
    weight: string;
  };
  onBack: () => void;
  onGoToDashboard: () => void;
}

const WalkTracking = ({ destination, planningData, onBack, onGoToDashboard }: WalkTrackingProps) => {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [walkStartTime, setWalkStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentSteps, setCurrentSteps] = useState(0);
  const mapRef = useRef<MapRef>(null);

  // Simulate step counting during walk (could be enhanced with actual step detection)
  useEffect(() => {
    let stepInterval: NodeJS.Timeout;
    if (isTracking && walkStartTime) {
      // Simulate steps increment (roughly 2 steps per second during active walking)
      stepInterval = setInterval(() => {
        setCurrentSteps(prev => prev + Math.floor(Math.random() * 3) + 1); // 1-3 steps every second
      }, 1000);
    }
    return () => {
      if (stepInterval) clearInterval(stepInterval);
    };
  }, [isTracking, walkStartTime]);
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
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation error:', error);
          // Position par défaut
          setUserLocation({ lat: 48.8566, lng: 2.3522 });
        }
      );
    }
  }, []);

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
  };

  const handlePauseWalk = () => {
    setIsTracking(false);
  };

  const handleStopWalk = () => {
    // Save walk session data before resetting
    if (walkStartTime && elapsedTime > 0) {
      const heightM = parseFloat(planningData.height) || 1.75;
      const weightKg = parseFloat(planningData.weight) || 70;
      const strideM = 0.415 * heightM;
      const distanceKm = (currentSteps * strideM) / 1000;
      const calories = Math.round(distanceKm * weightKg * 0.9); // Walking calories formula
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
      
      // Show success toast
      toast.success(`Marche terminée ! ${currentSteps} pas, ${distanceKm.toFixed(1)} km, ${calories} kcal`);
    }

    setIsTracking(false);
    setWalkStartTime(null);
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
    const targetSteps = parseInt(planningData.steps);
    return Math.min((currentSteps / targetSteps) * 100, 100);
  };

  // Calculate estimated steps for the selected route
  const getEstimatedSteps = () => {
    const heightM = parseFloat(planningData.height);
    const strideM = heightM ? 0.415 * heightM : 0.72;
    const distanceM = destination.distanceKm * 1000;
    return Math.round(distanceM / strideM);
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
              alt="FitPaS" 
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

        {/* Stats de marche actuelles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Timer size={20} className="text-primary" />
            </div>
            <div className="text-2xl font-bold text-foreground">{formatTime(elapsedTime)}</div>
            <div className="text-sm text-muted-foreground">Temps</div>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Target size={20} className="text-secondary" />
            </div>
            <div className="text-2xl font-bold text-foreground">{currentSteps}</div>
            <div className="text-sm text-muted-foreground">Pas actuels</div>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <MapPin size={20} className="text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {((currentSteps * 0.415 * parseFloat(planningData.height)) / 1000).toFixed(1)}
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
              <div className="text-2xl font-bold text-orange-500">{destination.durationMin} min</div>
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
              className="bg-primary h-3 rounded-full transition-all duration-300 ease-out"
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
                duration: `${destination.durationMin} min`,
                calories: destination.calories,
                description: `Destination à ${destination.distanceKm.toFixed(1)} km - ${getEstimatedSteps()} pas estimés`,
                coordinates: destination.coordinates,
                route: destination.routeGeoJSON
              }]}
              selectedDestination={destination.id}
              onDestinationSelect={() => {}}
              planningData={planningData}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
              <p className="text-muted-foreground">Chargement de la carte...</p>
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
              Commencer la marche
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