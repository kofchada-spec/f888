import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, User, Weight, Target, Timer, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface RunPlanningProps {
  onComplete: (data: {
    distance: number;
    pace: RunPace;
    tripType: TripType;
    height: number;
    weight: number;
  }) => void;
  onBack: () => void;
  onGoToDashboard: () => void;
}

type RunPace = 'slow' | 'moderate' | 'fast';
type TripType = 'one-way' | 'round-trip';

const RunPlanning = ({ onComplete, onBack, onGoToDashboard }: RunPlanningProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [distance, setDistance] = useState(5);
  const [selectedPace, setSelectedPace] = useState<RunPace>('moderate');
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
    onComplete({
      distance,
      pace: selectedPace,
      tripType,
      height: parseFloat(height),
      weight: parseFloat(weight)
    });
  };

  // Calculs préliminaires pour affichage (adaptés à la course)
  const calculatePreview = () => {
    const heightInM = parseFloat(height);
    const weightInKg = parseFloat(weight);
    
    // Utiliser directement la distance sélectionnée
    const displayDistance = distance;
    
    // Vitesse selon l'allure de course (km/h)
    const paceSpeed = {
      slow: 8,     // Course lente
      moderate: 10, // Course modérée
      fast: 12      // Course rapide
    };
    
    const speed = paceSpeed[selectedPace];
    const duration = displayDistance / speed * 60; // en minutes
    
    // Calories : distance × poids × coefficient (plus élevé pour la course)
    const calorieCoefficients = {
      slow: 0.75,
      moderate: 1.00,
      fast: 1.30
    };
    
    const coefficient = calorieCoefficients[selectedPace];
    const calories = displayDistance * weightInKg * coefficient;
    
    return {
      distance: displayDistance.toFixed(1),
      duration: Math.round(duration),
      calories: Math.round(calories)
    };
  };

  const preview = calculatePreview();

  const paceOptions = [
    { id: 'slow' as RunPace, label: 'Lente', icon: '🏃' },
    { id: 'moderate' as RunPace, label: 'Modérée', icon: '🏃‍♂️' },
    { id: 'fast' as RunPace, label: 'Rapide', icon: '🏃‍♀️💨' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-background to-red-50">
      {/* Header */}
      <div className="bg-card shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center space-x-2 text-foreground hover:text-orange-600 transition-colors"
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
      <div className="container max-w-2xl mx-auto px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Planifier ma course
          </h1>
          <p className="text-muted-foreground">
            Définissez vos paramètres pour une course optimisée
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-lg p-8 space-y-8">
          {/* Distance à parcourir */}
          <div className="space-y-6">
            <Label className="text-lg font-medium text-foreground flex items-center space-x-2">
              <Target className="w-5 h-5 text-orange-600" />
              <span>Distance à parcourir</span>
            </Label>
            
            <div className="space-y-4">
              <div className="px-6">
                <Slider
                  value={[distance]}
                  onValueChange={(value) => setDistance(value[0])}
                  max={42}
                  min={1}
                  step={0.5}
                  className="w-full"
                />
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">{distance.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">km</div>
              </div>
            </div>
          </div>

          {/* Choix d'allure */}
          <div className="space-y-4">
            <Label className="text-base font-semibold text-foreground">
              Allure de course
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {paceOptions.map((option) => {
                const isSelected = selectedPace === option.id;
                const getButtonStyles = () => {
                  if (isSelected) {
                    switch (option.id) {
                      case 'slow':
                        return "bg-orange-500 text-white shadow-md transform scale-105";
                      case 'fast':
                        return "bg-red-600 text-white shadow-md transform scale-105";
                      default:
                        return "bg-orange-600 text-white shadow-md transform scale-105";
                    }
                  }
                  return "hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300";
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
                    ? "bg-orange-600 text-white shadow-md transform scale-105" 
                    : "hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300"
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
                    ? "bg-orange-600 text-white shadow-md transform scale-105" 
                    : "hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300"
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
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
            <h3 className="text-lg font-medium text-foreground mb-4 text-center">Aperçu de votre course</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-card rounded-lg">
                <Target className="w-5 h-5 text-orange-600 mx-auto mb-2" />
                <p className="text-muted-foreground mb-1">Distance</p>
                <p className="font-semibold text-orange-600">{preview.distance} km</p>
              </div>
              <div className="text-center p-3 bg-card rounded-lg">
                <Timer className="w-5 h-5 text-orange-600 mx-auto mb-2" />
                <p className="text-muted-foreground mb-1">Durée</p>
                <p className="font-semibold text-orange-600">{preview.duration} min</p>
              </div>
              <div className="text-center p-3 bg-card rounded-lg">
                <Zap className="w-5 h-5 text-orange-600 mx-auto mb-2" />
                <p className="text-muted-foreground mb-1">Calories</p>
                <p className="font-semibold text-orange-600">{preview.calories} kcal</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-orange-200 text-center">
              <p className="text-sm text-muted-foreground">
                {tripType === 'round-trip' ? '🔄 Aller-retour' : '➡️ Aller simple'} • 
                Allure {selectedPace === 'slow' ? 'lente' : selectedPace === 'moderate' ? 'modérée' : 'rapide'}
              </p>
            </div>
          </div>
        </div>

        {/* Bouton de validation */}
        <div className="mt-8">
          <Button
            onClick={handleValidate}
            size="lg"
            className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
          >
            Trouver mes destinations
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RunPlanning;