import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';

interface WalkPlanningProps {
  onComplete: () => void;
  onBack: () => void;
}

type WalkPace = 'slow' | 'moderate' | 'fast';

const WalkPlanning = ({ onComplete, onBack }: WalkPlanningProps) => {
  const [steps, setSteps] = useState('10000');
  const [selectedPace, setSelectedPace] = useState<WalkPace>('moderate');

  const paceOptions = [
    { id: 'slow' as WalkPace, label: 'Lente' },
    { id: 'moderate' as WalkPace, label: 'Modérée' },
    { id: 'fast' as WalkPace, label: 'Rapide' }
  ];

  const handleValidate = () => {
    // Ici on pourrait sauvegarder les données de planification
    console.log('Planification validée:', { steps, pace: selectedPace });
    onComplete();
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
      <div className="container max-w-md mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Planifier ma marche
          </h1>
          <p className="text-muted-foreground">
            Définissez votre objectif et votre rythme
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-lg p-8 space-y-8">
          {/* Nombre de pas */}
          <div className="space-y-3">
            <Label htmlFor="steps" className="text-base font-semibold text-foreground">
              Nombre de pas
            </Label>
            <Input
              id="steps"
              type="number"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              className="text-lg h-12 text-center"
              placeholder="10 000"
            />
          </div>

          {/* Choix d'allure */}
          <div className="space-y-4">
            <Label className="text-base font-semibold text-foreground">
              Allure de marche
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {paceOptions.map((option) => (
                <Button
                  key={option.id}
                  variant={selectedPace === option.id ? "default" : "outline"}
                  size="lg"
                  onClick={() => setSelectedPace(option.id)}
                  className={`h-14 text-sm font-medium transition-all ${
                    selectedPace === option.id 
                      ? "bg-primary text-primary-foreground shadow-md transform scale-105" 
                      : "hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                  }`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Informations sur l'allure sélectionnée */}
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Allure sélectionnée</p>
              <p className="font-semibold text-foreground text-base">
                {paceOptions.find(p => p.id === selectedPace)?.label}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedPace === 'slow' && 'Idéal pour une promenade relaxante'}
                {selectedPace === 'moderate' && 'Parfait pour un exercice régulier'}
                {selectedPace === 'fast' && 'Excellent pour un entraînement intense'}
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
            Valider
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WalkPlanning;