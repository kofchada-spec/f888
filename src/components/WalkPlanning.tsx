import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, User, Weight, Target, Timer, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { usePlanningLimiter } from '@/hooks/usePlanningLimiter';
import { toast } from 'sonner';

interface WalkPlanningProps {
  onComplete: (data: {
    steps: number;
    pace: WalkPace;
    tripType: TripType;
    height: number;
    weight: number;
  }) => void;
  onBack: () => void;
  onGoToDashboard: () => void;
}

type WalkPace = 'slow' | 'moderate' | 'fast';
type TripType = 'one-way' | 'round-trip';

const WalkPlanning = ({ onComplete, onBack, onGoToDashboard }: WalkPlanningProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { canPlan, incrementPlanCount, remainingPlans, dailyLimit } = usePlanningLimiter();
  const [steps, setSteps] = useState(3000);
  const [selectedPace, setSelectedPace] = useState<WalkPace>('moderate');
  const [tripType, setTripType] = useState<TripType>('one-way');
  const [height, setHeight] = useState('1.70');
  const [weight, setWeight] = useState('70');
  const [isLoading, setIsLoading] = useState(true);

  // Charger les données du profil utilisateur
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('height_m, weight_kg')
            .eq('user_id', user.id)
            .single();

          if (error) {
            console.error('Error loading profile:', error);
            setIsLoading(false);
            return;
          }

          if (profile) {
            // Utiliser les données du profil s'elles existent
            if (profile.height_m && profile.height_m > 0) {
              setHeight(profile.height_m.toString());
            }
            if (profile.weight_kg && profile.weight_kg > 0) {
              setWeight(profile.weight_kg.toString());
            }
          }
        } catch (error) {
          console.error('Error loading profile:', error);
        }
      } else {
        // Charger depuis localStorage pour les utilisateurs non connectés
        try {
          const localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
          if (localProfile.height_m && localProfile.height_m > 0) {
            setHeight(localProfile.height_m.toString());
          }
          if (localProfile.weight_kg && localProfile.weight_kg > 0) {
            setWeight(localProfile.weight_kg.toString());
          }
        } catch (error) {
          console.error('Error loading local profile:', error);
        }
      }
      setIsLoading(false);
    };

    loadUserProfile();
  }, [user]);

  const handleValidate = () => {
    if (!canPlan) {
      toast.error('Limite de planifications atteinte pour aujourd\'hui');
      return;
    }

    const success = incrementPlanCount();
    if (!success) {
      toast.error('Impossible de créer une nouvelle planification');
      return;
    }

    onComplete({
      steps,
      pace: selectedPace,
      tripType,
      height: parseFloat(height),
      weight: parseFloat(weight)
    });
  };

  // Calculs préliminaires pour affichage
  const calculatePreview = () => {
    const stepCount = steps;
    const heightInM = parseFloat(height);
    const weightInKg = parseFloat(weight);
    
    // Formule de foulée : 0.415 × taille (m) ou défaut 0.72m
    const strideLength = heightInM > 0 ? 0.415 * heightInM : 0.72;
    
    // Distance cible (km) = pas × foulée / 1000 (total distance to walk)
    const targetDistanceKm = (stepCount * strideLength) / 1000;
    
    // The target distance is already the total distance the user wants to walk
    const displayDistance = targetDistanceKm;
    
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
      strideLength: (strideLength * 100).toFixed(1), // en cm pour affichage
      targetDistanceKm, // Distance cible pour la génération de routes
      targetSteps: stepCount // Pas cibles
    };
  };

  const preview = calculatePreview();

  const paceOptions = [
    { id: 'slow' as WalkPace, label: 'Lente', icon: '🚶‍♀️' },
    { id: 'moderate' as WalkPace, label: 'Modérée', icon: '🚶‍♂️' },
    { id: 'fast' as WalkPace, label: 'Rapide', icon: '🏃‍♀️' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <div className="bg-card shadow-sm">
        <div className="px-4 py-4 flex items-center justify-between">
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
      <div className="container max-w-md md:max-w-2xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Planifier ma marche
          </h1>
          <p className="text-muted-foreground">
            Définissez vos paramètres personnels pour une marche optimisée
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-lg p-8 space-y-8">
          {/* Objectif de pas */}
          <div className="space-y-6">
            <Label className="text-lg font-medium text-foreground flex items-center space-x-2">
              <Target className="w-5 h-5 text-primary" />
              <span>Nombre de pas souhaités</span>
            </Label>
            
            <div className="space-y-4">
              <div className="px-6">
                <Slider
                  value={[steps]}
                  onValueChange={(value) => setSteps(value[0])}
                  max={100000}
                  min={1000}
                  step={500}
                  className="w-full"
                />
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{steps.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">pas</div>
              </div>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
                Allure {selectedPace === 'slow' ? 'lente' : selectedPace === 'moderate' ? 'modérée' : 'rapide'}
              </p>
            </div>
          </div>
        </div>

        {/* Limit indicator */}
        <div className="mt-6 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl border border-primary/20">
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary">{remainingPlans}</span>
                <span className="text-sm text-muted-foreground font-medium">sur {dailyLimit}</span>
              </div>
            </div>
            <div className="h-8 w-px bg-border"></div>
            <span className="text-sm text-muted-foreground">planifications disponibles</span>
          </div>
        </div>

        {/* Bouton de validation */}
        <div className="mt-4">
          <Button
            onClick={handleValidate}
            size="lg"
            disabled={!canPlan}
            className="w-full h-14 text-lg font-semibold bg-primary active:bg-primary/90 text-primary-foreground shadow-lg active:shadow-md touch-manipulation transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {canPlan ? 'Trouver mes destinations' : 'Limite atteinte'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WalkPlanning;