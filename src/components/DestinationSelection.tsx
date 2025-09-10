import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, MapPin, Clock, Zap, Loader2 } from 'lucide-react';
import Map from './Map';
import { useDestinationVariants } from '@/hooks/useDestinationVariants';

interface DestinationSelectionProps {
  onComplete: (destination: Destination) => void;
  onBack: () => void;
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
  distance: string;
  duration: string;
  calories: number;
  description: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  route?: any;
}

const DestinationSelection = ({ onComplete, onBack, planningData }: DestinationSelectionProps) => {
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const { destinations, loading, error, fetchDestinations } = useDestinationVariants();

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
          // Position par défaut (Paris)
          setUserLocation({ lat: 48.8566, lng: 2.3522 });
        }
      );
    } else {
      // Position par défaut si géolocalisation non supportée
      setUserLocation({ lat: 48.8566, lng: 2.3522 });
    }
  }, []);

  // Charger les destinations quand localisation et données de planification sont prêtes
  useEffect(() => {
    if (userLocation && planningData) {
      fetchDestinations(userLocation, planningData);
    }
  }, [userLocation, planningData, fetchDestinations]);


  const handleDestinationSelect = (destination: Destination) => {
    setSelectedDestination(destination.id);
  };

  const handleStartWalk = () => {
    const selected = destinations.find(d => d.id === selectedDestination);
    if (selected) {
      onComplete(selected);
    }
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
          
          <div className="flex items-center space-x-3">
            <img 
              src="/lovable-uploads/5216fdd6-d0d7-446b-9260-86d15d06f4ba.png" 
              alt="FitPaS" 
              className="h-8 w-auto"
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
            <p>FitPaS calcule la distance en fonction de ton allure et du nombre de pas.</p>
            <p>Voici 3 destinations proposées pour atteindre ton objectif.</p>
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

        {/* Carte interactive avec localisation utilisateur */}
        <div className="bg-card rounded-2xl shadow-lg overflow-hidden mb-8" style={{ height: '360px' }}>
          {loading ? (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Recherche de destinations...</p>
                <p className="text-xs text-muted-foreground mt-1">Génération de la variante en cours</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-destructive/10 to-muted/10 rounded-2xl">
              <div className="text-center max-w-md p-6">
                <p className="text-sm text-destructive mb-2">Erreur lors du chargement</p>
                <p className="text-xs text-muted-foreground">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => userLocation && fetchDestinations(userLocation, planningData)}
                >
                  Réessayer
                </Button>
              </div>
            </div>
          ) : (
            <Map 
              userLocation={userLocation}
              destinations={destinations}
              selectedDestination={selectedDestination}
              onDestinationSelect={handleDestinationSelect}
              planningData={planningData}
            />
          )}
        </div>

        {/* Liste des destinations */}
        <div className="grid gap-6 mb-8">
          {destinations.map((destination) => (
            <Card
              key={destination.id}
              className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                selectedDestination === destination.id 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-card/80'
              }`}
              onClick={() => handleDestinationSelect(destination)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                    selectedDestination === destination.id ? 'bg-primary' : 'bg-secondary'
                  }`}>
                    {destination.id}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-foreground mb-1">
                      {destination.name}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {destination.description}
                    </p>
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="flex items-center space-x-2">
                        <MapPin size={16} className="text-primary" />
                        <span className="font-medium">{destination.distance}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock size={16} className="text-secondary" />
                        <span className="font-medium">{destination.duration}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Zap size={16} className="text-orange-500" />
                        <span className="font-medium">{destination.calories} cal</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Bouton CTA */}
        <div className="text-center">
          <Button
            onClick={handleStartWalk}
            disabled={!selectedDestination}
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