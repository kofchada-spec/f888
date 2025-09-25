import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import EnhancedMap from './EnhancedMap';
import { useMapClickLimiter } from '@/hooks/useMapClickLimiter';
import { type PlanningData } from '@/lib/routeHelpers';

interface MapScreenProps {
  onComplete: (destination: any) => void;
  onBack: () => void;
  onGoToDashboard: () => void;
  planningData: PlanningData;
}

const MapScreen = ({ onComplete, onBack, onGoToDashboard, planningData }: MapScreenProps) => {
  const [isReadyToStart, setIsReadyToStart] = useState(false);
  const [routeData, setRouteData] = useState<{
    distance: number;
    duration: number;
    calories: number;
    steps: number;
    startCoordinates: { lat: number; lng: number };
    endCoordinates: { lat: number; lng: number };
    routes: {
      go: GeoJSON.Feature<GeoJSON.LineString>;
      back?: GeoJSON.Feature<GeoJSON.LineString>;
    };
  } | null>(null);
  
  const { attemptCount, canClick, isLocked, hasReset, incrementAttempts, reset, remainingAttempts } = useMapClickLimiter(3);

  const handleRouteCalculated = (data: {
    distance: number;
    duration: number;
    calories: number;
    steps: number;
    startCoordinates: { lat: number; lng: number };
    endCoordinates: { lat: number; lng: number };
    routes: {
      go: GeoJSON.Feature<GeoJSON.LineString>;
      back?: GeoJSON.Feature<GeoJSON.LineString>;
    };
  }) => {
    setRouteData(data);
    setIsReadyToStart(true);
    // Only increment attempts when a valid route is calculated
    incrementAttempts(true);
  };

  const handleUserClick = () => {
    // This is called on every click, but we only increment attempts when a valid route is found
    // The actual increment happens in handleRouteCalculated
  };

  const handleStartWalk = () => {
    if (!routeData) return;
    
    const destination = {
      id: 'map-selected-destination',
      name: 'Destination sélectionnée',
      coordinates: routeData.endCoordinates,
      distanceKm: routeData.distance,
      durationMin: routeData.duration,
      calories: routeData.calories,
      routes: routeData.routes
    };
    
    onComplete(destination);
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
      <div className="container max-w-6xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Choisis ta destination
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

        {/* Enhanced Map */}
        <div className="mb-6 relative h-[500px] rounded-xl overflow-hidden bg-muted">
          <EnhancedMap 
            planningData={planningData}
            className="w-full h-full"
            canClick={canClick}
            onUserClick={handleUserClick}
            onRouteCalculated={handleRouteCalculated}
          />
          
          {/* Click Counter & Reset */}
          <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
            <div className="text-sm text-center mb-2">
              <span className="text-muted-foreground">Essais: </span>
              <span className="font-semibold text-primary">{attemptCount}/3</span>
            </div>
            
            {isLocked && !hasReset && (
              <Button
                onClick={reset}
                size="sm"
                variant="outline"
                className="w-full text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Réinitialiser
              </Button>
            )}
            
            {hasReset && (
              <p className="text-xs text-amber-600 text-center font-medium">
                Itinéraire par défaut restauré
              </p>
            )}
            
            {!isLocked && !hasReset && remainingAttempts > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {remainingAttempts} essai{remainingAttempts > 1 ? 's' : ''} restant{remainingAttempts > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center">
          <Button
            onClick={handleStartWalk}
            disabled={!isReadyToStart}
            size="lg"
            className="w-full max-w-md h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-50"
          >
            {isReadyToStart ? 'Commencer la marche' : 'Calcul de l\'itinéraire...'}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            L'itinéraire sera sauvegardé et le suivi GPS commencera
          </p>
        </div>
      </div>
    </div>
  );
};

export default MapScreen;