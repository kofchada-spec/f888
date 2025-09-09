import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, MapPin, Clock, Zap } from 'lucide-react';

interface DestinationSelectionProps {
  onComplete: (destination: Destination) => void;
  onBack: () => void;
  planningData: {
    steps: string;
    pace: 'slow' | 'moderate' | 'fast';
    tripType: 'one-way' | 'round-trip';
  };
}

interface Destination {
  id: string;
  name: string;
  distance: string;
  duration: string;
  calories: number;
  description: string;
}

const DestinationSelection = ({ onComplete, onBack, planningData }: DestinationSelectionProps) => {
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

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

  // Calcul des données basé sur les paramètres de planification
  const calculateMetrics = (baseDistance: number) => {
    const steps = parseInt(planningData.steps);
    const stepToKm = 0.00075; // Approximation: 1 pas = 0.75m
    let targetDistance = steps * stepToKm;
    
    // Si c'est un aller-retour, diviser par 2 la distance cible
    if (planningData.tripType === 'round-trip') {
      targetDistance = targetDistance / 2;
    }
    
    // Ajustement de la distance selon le ratio
    const adjustedDistance = (baseDistance * targetDistance) / 5; // Base de 5km
    
    // Pour l'affichage, multiplier par 2 si aller-retour
    const displayDistance = planningData.tripType === 'round-trip' ? adjustedDistance * 2 : adjustedDistance;
    
    // Calcul du temps selon l'allure
    const paceSpeed = {
      slow: 4,     // 4 km/h
      moderate: 5, // 5 km/h  
      fast: 6.5    // 6.5 km/h
    };
    
    const speed = paceSpeed[planningData.pace];
    const duration = displayDistance / speed * 60; // en minutes
    
    // Calcul des calories (approximation: 50 calories par km)
    const calories = Math.round(displayDistance * 50);
    
    return {
      distance: displayDistance.toFixed(1),
      duration: Math.round(duration),
      calories
    };
  };

  const destinations: Destination[] = [
    {
      id: 'A',
      name: 'Parc de la Citadelle',
      description: 'Promenade paisible à travers le parc historique',
      ...calculateMetrics(4.2)
    },
    {
      id: 'B', 
      name: 'Bords de Seine',
      description: 'Marche le long des quais avec vue sur le fleuve',
      ...calculateMetrics(5.8)
    },
    {
      id: 'C',
      name: 'Centre Historique',
      description: 'Découverte du patrimoine architectural',
      ...calculateMetrics(3.6)
    }
  ].map(dest => ({
    ...dest,
    distance: `${dest.distance} km`,
    duration: `${dest.duration} min`
  }));

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
          <div className="flex justify-center items-center space-x-8 text-sm">
            <div className="text-center">
              <p className="text-muted-foreground">Objectif</p>
              <p className="font-semibold">{planningData.steps} pas</p>
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
                {planningData.tripType === 'one-way' ? 'Aller simple' : 'Aller-retour'}
              </p>
            </div>
          </div>
        </div>

        {/* Carte interactive avec localisation utilisateur */}
        <div className="bg-card rounded-2xl shadow-lg overflow-hidden mb-8">
          <div className="relative h-64 bg-gradient-to-br from-primary/10 to-secondary/10">
            {/* Fond de carte stylisé */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20">
              {/* Lignes de grille pour simuler une carte */}
              <svg className="w-full h-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#grid)" />
              </svg>
            </div>

            {/* Position de l'utilisateur au centre */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
                {/* Point utilisateur */}
                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>
                <div className="absolute -inset-2 border-2 border-blue-500 rounded-full animate-ping opacity-50"></div>
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">Vous</span>
                </div>
              </div>
            </div>

            {/* Destinations avec ramifications */}
            {destinations.map((dest, index) => {
              const positions = [
                { top: '20%', left: '25%' }, // Position A
                { top: '30%', right: '25%' }, // Position B  
                { bottom: '25%', left: '40%' } // Position C
              ];
              
              const position = positions[index];
              
              return (
                <div key={dest.id}>
                  {/* Ligne de connexion vers la destination */}
                  <svg className="absolute inset-0 pointer-events-none">
                    <line
                      x1="50%"
                      y1="50%"
                      x2={position.left ? position.left : position.right ? `${100 - parseInt(position.right)}%` : '50%'}
                      y2={position.top ? position.top : position.bottom ? `${100 - parseInt(position.bottom)}%` : '50%'}
                      stroke={selectedDestination === dest.id ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      className="opacity-60"
                    />
                  </svg>
                  
                  {/* Marqueur destination */}
                  <div 
                    className="absolute transform -translate-x-1/2 -translate-y-1/2"
                    style={position}
                  >
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg cursor-pointer transition-all hover:scale-110 ${
                        selectedDestination === dest.id ? 'bg-primary scale-110' : 'bg-secondary'
                      }`}
                      onClick={() => handleDestinationSelect(dest)}
                    >
                      {dest.id}
                    </div>
                    {/* Distance indicator */}
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        selectedDestination === dest.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {dest.distance}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Légende */}
            <div className="absolute top-4 left-4 bg-white/90 dark:bg-black/90 rounded-lg p-2 text-xs">
              <div className="flex items-center space-x-2 mb-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>Votre position</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-secondary rounded-full"></div>
                <span>Destinations</span>
              </div>
            </div>
          </div>
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