import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import EnhancedMap from '@/components/EnhancedMap';
import { useMapClickLimiter } from '@/hooks/useMapClickLimiter';

interface MapScreenProps {
  onComplete: (destination: any) => void;
  onBack: () => void;
  onGoToDashboard: () => void;
  planningData: {
    steps: number;
    pace: 'slow' | 'moderate' | 'fast';
    tripType: 'one-way' | 'round-trip';
    height: number;
    weight: number;
  };
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
    routeGeoJSON?: any;
  } | null>(null);
  
  const [hasReset, setHasReset] = useState(false);
  const { attemptCount, canClick, isLocked, incrementAttempts, reset, resetToDefault, remainingAttempts } = useMapClickLimiter(3);

  const handleRouteCalculated = (data: {
    distance: number;
    duration: number;
    calories: number;
    steps: number;
    startCoordinates: { lat: number; lng: number };
    endCoordinates: { lat: number; lng: number };
    routeGeoJSON?: any;
  }) => {
    setRouteData(data);
    setIsReadyToStart(true);
  };

  const handleResetToDefault = () => {
    setHasReset(true);
    resetToDefault();
  };

  const handleStartWalk = () => {
    if (!routeData) return;
    
    // Create destination object with the actual calculated route data
    const destination = {
      id: 'map-selected-destination',
      name: 'Destination sélectionnée',
      coordinates: routeData.endCoordinates,
      distanceKm: routeData.distance,
      durationMin: routeData.duration,
      calories: routeData.calories,
      routeGeoJSON: routeData.routeGeoJSON
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

        {/* Enhanced Map */}
        <div className="mb-6 relative h-[500px] rounded-xl overflow-hidden shadow-lg">
          <EnhancedMap 
            planningData={planningData}
            onRouteCalculated={handleRouteCalculated}
            manualSelectionEnabled={canClick}
          />
          
          {/* Click Counter & Reset */}
          <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
            <div className="text-sm text-center mb-2">
              <span className="text-muted-foreground">Essais: </span>
              <span className="font-semibold text-primary">{attemptCount}/3</span>
            </div>
            
            {isLocked && (
              <Button
                onClick={handleResetToDefault}
                size="sm"
                variant="outline"
                className="w-full text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Réinitialiser
              </Button>
            )}
            
            {!isLocked && remainingAttempts > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {remainingAttempts} essai{remainingAttempts > 1 ? 's' : ''} restant{remainingAttempts > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Walk Estimation - Enhanced for round-trip */}
        {routeData && (
          <div className="bg-card rounded-xl p-6 mb-6 shadow-lg">
            <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
              Estimation de votre marche
              {planningData.tripType === 'round-trip' && (
                <span className="text-sm font-normal text-muted-foreground ml-2">(Aller-retour)</span>
              )}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg">
                <div className="text-2xl font-bold text-primary mb-1">
                  {routeData.distance.toFixed(1)} km
                </div>
                <p className="text-sm text-muted-foreground">Distance totale</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-secondary/5 to-secondary/10 rounded-lg">
                <div className="text-2xl font-bold text-secondary mb-1">
                  {Math.round((routeData.distance * 1000) / (0.415 * planningData.height)).toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">Pas estimés</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-orange-500/5 to-orange-500/10 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 mb-1">
                  {routeData.calories} kcal
                </div>
                <p className="text-sm text-muted-foreground">Calories</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-500/5 to-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {Math.round(routeData.duration)} min
                </div>
                <p className="text-sm text-muted-foreground">Durée estimée</p>
              </div>
            </div>
            
            {/* Route type indicator for round-trip */}
            {planningData.tripType === 'round-trip' && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-1 bg-green-500 rounded"></div>
                    <span className="text-muted-foreground">Trajet aller</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-1 bg-blue-500 rounded" style={{
                      backgroundImage: 'repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 3px, transparent 3px, transparent 6px)'
                    }}></div>
                    <span className="text-muted-foreground">Trajet retour</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t text-center">
              <p className="text-sm text-muted-foreground">
                ✅ Itinéraire calculé • Prêt à commencer
              </p>
            </div>
          </div>
        )}

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