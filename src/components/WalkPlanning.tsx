import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, User, Ruler, Weight, Target, Timer, Zap } from 'lucide-react';

interface WalkPlanningProps {
  onComplete: (data: {
    steps: string;
    pace: WalkPace;
    tripType: TripType;
    height: string;
    weight: string;
  }) => void;
  onBack: () => void;
}

type WalkPace = 'slow' | 'moderate' | 'fast';
type TripType = 'one-way' | 'round-trip';

const WalkPlanning = ({ onComplete, onBack }: WalkPlanningProps) => {
  const [steps, setSteps] = useState('3000');
  const [selectedPace, setSelectedPace] = useState<WalkPace>('moderate');
  const [tripType, setTripType] = useState<TripType>('one-way');
  const [height, setHeight] = useState('1.70');
  const [weight, setWeight] = useState('70');

  const handleValidate = () => {
    onComplete({
      steps,
      pace: selectedPace,
      tripType,
      height,
      weight
    });
  };

  // Calculs préliminaires pour affichage
  const calculatePreview = () => {
    const stepCount = parseInt(steps);
    const heightInM = parseFloat(height);
    const weightInKg = parseFloat(weight);
    
    // Formule de foulée : 0.415 × taille (m)
    const strideLength = 0.415 * heightInM;
    
    // Distance (km) = pas × foulée / 1000
    let targetDistance = (stepCount * strideLength) / 1000;
    
    // Si aller-retour, la distance affichée est le double
    const displayDistance = tripType === 'round-trip' ? targetDistance * 2 : targetDistance;
    
    // Vitesse selon l'allure
    const paceSpeed = {
      slow: 4,
      moderate: 5, 
      fast: 6
    };
    
    const speed = paceSpeed[selectedPace];
    const duration = displayDistance / speed * 60; // en minutes
    
    // Calories : distance × poids × coefficient
    const calorieCoefficients = {
      slow: 0.35,
      moderate: 0.50,
      fast: 0.70
    };
    
    const coefficient = calorieCoefficients[selectedPace];
    const calories = displayDistance * weightInKg * coefficient;
    
    return {
      distance: displayDistance.toFixed(1),
      duration: Math.round(duration),
      calories: Math.round(calories),
      strideLength: (strideLength * 100).toFixed(1) // en cm pour affichage
    };
  };

  const preview = calculatePreview();

  const paceOptions = [
    { id: 'slow' as WalkPace, label: 'Lente', speed: '4 km/h', icon: '🚶‍♀️' },
    { id: 'moderate' as WalkPace, label: 'Modérée', speed: '5 km/h', icon: '🚶‍♂️' },
    { id: 'fast' as WalkPace, label: 'Rapide', speed: '6 km/h', icon: '🏃‍♀️' }
  ];

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
      <div className="container max-w-2xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Planifier ma marche
          </h1>
          <p className="text-muted-foreground">
            Définissez vos paramètres personnels pour une marche optimisée
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-lg p-8 space-y-8">
          {/* Paramètres personnels */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4 flex items-center space-x-2">
                <User className="w-5 h-5 text-primary" />
                <span>Paramètres personnels</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Taille */}
                <div className="space-y-2">
                  <Label htmlFor="height" className="text-sm font-medium text-foreground flex items-center space-x-2">
                    <Ruler className="w-4 h-4 text-primary" />
                    <span>Taille (m)</span>
                  </Label>
                  <Input
                    id="height"
                    type="number"
                    step="0.01"
                    min="1.20"
                    max="2.50"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full"
                    placeholder="1.70"
                  />
                </div>

                {/* Poids */}
                <div className="space-y-2">
                  <Label htmlFor="weight" className="text-sm font-medium text-foreground flex items-center space-x-2">
                    <Weight className="w-4 h-4 text-primary" />
                    <span>Poids (kg)</span>
                  </Label>
                  <Input
                    id="weight"
                    type="number"
                    step="1"
                    min="30"
                    max="200"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full"
                    placeholder="70"
                  />
                </div>
              </div>
            </div>

            {/* Objectif de pas */}
            <div className="space-y-2">
              <Label htmlFor="steps" className="text-sm font-medium text-foreground flex items-center space-x-2">
                <Target className="w-4 h-4 text-primary" />
                <span>Nombre de pas souhaités</span>
              </Label>
              <Input
                id="steps"
                type="number"
                step="100"
                min="1000"
                max="50000"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                className="w-full text-lg h-12 text-center"
                placeholder="3000"
              />
            </div>
          </div>

          {/* Choix d'allure */}
          <div className="space-y-4">
            <Label className="text-base font-semibold text-foreground">
              Allure de marche
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {paceOptions.map((option) => {
                const isSelected = selectedPace === option.id;
                const getButtonStyles = () => {
                  if (isSelected) {
                    switch (option.id) {
                      case 'slow':
                        return "bg-secondary text-secondary-foreground shadow-md transform scale-105";
                      case 'fast':
                        return "bg-orange-600 text-white shadow-md transform scale-105";
                      default:
                        return "bg-primary text-primary-foreground shadow-md transform scale-105";
                    }
                  }
                  return "hover:bg-primary/10 hover:text-primary hover:border-primary/30";
                };

                return (
                  <Button
                    key={option.id}
                    variant={isSelected ? "default" : "outline"}
                    size="lg"
                    onClick={() => setSelectedPace(option.id)}
                    className={`h-16 text-sm font-medium transition-all ${getButtonStyles()}`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">{option.icon}</div>
                      <div className="font-semibold">{option.label}</div>
                      <div className="text-xs opacity-80">{option.speed}</div>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Type de trajet */}
          <div className="space-y-4">
            <Label className="text-base font-semibold text-foreground">
              Type de trajet
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={tripType === 'one-way' ? "default" : "outline"}
                size="lg"
                onClick={() => setTripType('one-way')}
                className={`h-14 text-sm font-medium transition-all ${
                  tripType === 'one-way' 
                    ? "bg-primary text-primary-foreground shadow-md transform scale-105" 
                    : "hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                }`}
              >
                <div className="text-center">
                  <div className="text-xl mb-1">➡️</div>
                  <div>Aller simple</div>
                </div>
              </Button>
              <Button
                variant={tripType === 'round-trip' ? "default" : "outline"}
                size="lg"
                onClick={() => setTripType('round-trip')}
                className={`h-14 text-sm font-medium transition-all ${
                  tripType === 'round-trip' 
                    ? "bg-primary text-primary-foreground shadow-md transform scale-105" 
                    : "hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                }`}
              >
                <div className="text-center">
                  <div className="text-xl mb-1">🔄</div>
                  <div>Aller-retour</div>
                </div>
              </Button>
            </div>
          </div>

          {/* Résumé de la planification */}
          <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl p-6 border">
            <h3 className="text-lg font-medium text-foreground mb-4 text-center">Aperçu de votre marche</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center p-3 bg-card rounded-lg">
                <Ruler className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-muted-foreground mb-1">Foulée</p>
                <p className="font-semibold text-primary">{preview.strideLength} cm</p>
              </div>
              <div className="text-center p-3 bg-card rounded-lg">
                <Target className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-muted-foreground mb-1">Distance</p>
                <p className="font-semibold text-primary">{preview.distance} km</p>
              </div>
              <div className="text-center p-3 bg-card rounded-lg">
                <Timer className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-muted-foreground mb-1">Durée</p>
                <p className="font-semibold text-primary">{preview.duration} min</p>
              </div>
              <div className="text-center p-3 bg-card rounded-lg">
                <Zap className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-muted-foreground mb-1">Calories</p>
                <p className="font-semibold text-primary">{preview.calories} kcal</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t text-center">
              <p className="text-sm text-muted-foreground">
                {tripType === 'round-trip' ? '🔄 Aller-retour' : '➡️ Aller simple'} • 
                Allure {selectedPace === 'slow' ? 'lente (4 km/h)' : selectedPace === 'moderate' ? 'modérée (5 km/h)' : 'rapide (6 km/h)'}
              </p>
            </div>
          </div>
        </div>

        {/* Bouton de validation */}
        <div className="mt-8">
          <Button
            onClick={handleValidate}
            size="lg"
            className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
          >
            Trouver mes destinations
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WalkPlanning;