import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, User, Target } from 'lucide-react';
import fitpasLogo from '@/assets/fitpas-logo.png';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      id: 'welcome',
      component: <WelcomeScreen onNext={() => setCurrentStep(1)} />
    },
    {
      id: 'presentation',
      component: <PresentationScreen onNext={() => setCurrentStep(2)} />
    },
    {
      id: 'goals',
      component: <GoalsScreen onNext={onComplete} />
    }
  ];

  return (
    <div className="min-h-screen">
      {steps[currentStep].component}
    </div>
  );
};

const WelcomeScreen = ({ onNext }: { onNext: () => void }) => {
  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-between p-6 text-center">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="mb-8">
          <img 
            src={fitpasLogo} 
            alt="FitPaS Logo" 
            className="w-32 h-32 mx-auto filter brightness-0 invert"
          />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">
          Bienvenue
        </h1>
      </div>

      {/* Navigation dots */}
      <div className="flex gap-2 mb-6">
        <div className="w-3 h-3 rounded-full bg-white"></div>
        <div className="w-3 h-3 rounded-full bg-white/30"></div>
        <div className="w-3 h-3 rounded-full bg-white/30"></div>
      </div>

      <Button 
        onClick={onNext}
        variant="secondary"
        size="lg"
        className="w-full max-w-sm py-4 text-lg font-semibold rounded-full"
      >
        Suivant
      </Button>
    </div>
  );
};

const PresentationScreen = ({ onNext }: { onNext: () => void }) => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between p-6 text-center">
      <div className="flex-1 flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-foreground mb-8">
          Présentation<br />de l'app
        </h1>
        
        {/* Walking person illustration */}
        <div className="mb-8">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-yellow-400 to-blue-500 rounded-full flex items-center justify-center">
            <User className="w-16 h-16 text-white" />
          </div>
        </div>

        <p className="text-lg text-muted-foreground max-w-sm leading-relaxed">
          Planifie tes marches,<br />
          accède à des statistiques,<br />
          et bien plus encore.
        </p>
      </div>

      {/* Navigation dots */}
      <div className="flex gap-2 mb-6">
        <div className="w-3 h-3 rounded-full bg-muted"></div>
        <div className="w-3 h-3 rounded-full bg-secondary"></div>
        <div className="w-3 h-3 rounded-full bg-muted"></div>
      </div>

      <Button 
        onClick={onNext}
        variant="secondary"
        size="lg"
        className="w-full max-w-sm py-4 text-lg font-semibold rounded-full"
      >
        Suivant
      </Button>
    </div>
  );
};

const GoalsScreen = ({ onNext }: { onNext: () => void }) => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between p-6 text-center">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="mb-8">
          <Target className="w-20 h-20 mx-auto text-secondary" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-8 max-w-sm leading-tight">
          Planifie ta marche en fonction de ton objectif et nombre de pas à atteindre
        </h1>
      </div>

      {/* Navigation dots */}
      <div className="flex gap-2 mb-6">
        <div className="w-3 h-3 rounded-full bg-muted"></div>
        <div className="w-3 h-3 rounded-full bg-muted"></div>
        <div className="w-3 h-3 rounded-full bg-secondary"></div>
      </div>

      <Button 
        onClick={onNext}
        variant="secondary"
        size="lg"
        className="w-full max-w-sm py-4 text-lg font-semibold rounded-full"
      >
        Continuer
      </Button>
    </div>
  );
};

export default Onboarding;