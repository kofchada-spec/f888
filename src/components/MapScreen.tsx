import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import EnhancedMap from './EnhancedMap';

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
  };
}

const MapScreen = ({ onComplete, onBack, onGoToDashboard, planningData }: MapScreenProps) => {
  const [isReadyToStart, setIsReadyToStart] = useState(false);

  const handleStartWalk = () => {
    // Create a destination object that matches what's expected
    // This is a simplified version - in a real app you'd get actual route data
    const destination = {
      id: 'map-selected-destination',
      name: 'Destination sélectionnée',
      coordinates: { lat: 0, lng: 0 }, // Would be filled by the map
      distanceKm: 0, // Would be calculated by the map
      durationMin: 0, // Would be calculated by the map
      calories: 0, // Would be calculated by the map
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
        <div className="mb-6">
          <EnhancedMap 
            planningData={planningData}
            className="w-full"
          />
        </div>

        {/* Action Button */}
        <div className="text-center">
          <Button
            onClick={handleStartWalk}
            size="lg"
            className="w-full max-w-md h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
          >
            Commencer la marche
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