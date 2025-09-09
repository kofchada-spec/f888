import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, User, Target } from 'lucide-react';
const fitpasLogo = '/lovable-uploads/4c20a048-5819-4d0f-b867-b91d67ca59ee.png';

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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-primary rounded-3xl p-8 w-full max-w-sm h-[600px] flex flex-col items-center justify-between text-center relative overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="mb-8">
            <img 
              src={fitpasLogo} 
              alt="FitPaS Logo" 
              className="w-24 h-24 mx-auto filter brightness-0 invert"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">
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
          className="w-full py-4 text-lg font-semibold rounded-2xl bg-secondary hover:bg-secondary/90 text-white border-0"
        >
          Suivant
        </Button>

        {/* Bottom indicator */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-black/20 rounded-full"></div>
      </div>
    </div>
  );
};

const PresentationScreen = ({ onNext }: { onNext: () => void }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm h-[600px] flex flex-col items-center justify-between text-center relative">
        <div className="flex-1 flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-8 leading-tight">
            Présentation<br />de l'app
          </h1>
          
          {/* Walking person illustration */}
          <div className="mb-8">
            <div className="relative">
              <div className="w-20 h-20 bg-yellow-400 rounded-full mb-2"></div>
              <div className="w-16 h-24 bg-blue-500 rounded-lg mx-auto mb-2"></div>
              <div className="flex gap-1 justify-center">
                <div className="w-6 h-3 bg-gray-800 rounded"></div>
                <div className="w-6 h-3 bg-gray-800 rounded"></div>
              </div>
            </div>
          </div>

          <p className="text-base text-gray-600 max-w-xs leading-relaxed">
            Planifie tes marches,<br />
            accède à des statistiques,<br />
            et bien plus encore.
          </p>
        </div>

        {/* Navigation dots */}
        <div className="flex gap-2 mb-6">
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
          <div className="w-3 h-3 rounded-full bg-secondary"></div>
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
        </div>

        <Button 
          onClick={onNext}
          className="w-full py-4 text-lg font-semibold rounded-2xl bg-secondary hover:bg-secondary/90 text-white border-0"
        >
          Suivant
        </Button>

        {/* Bottom indicator */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-black/20 rounded-full"></div>
      </div>
    </div>
  );
};

const GoalsScreen = ({ onNext }: { onNext: () => void }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm h-[600px] flex flex-col items-center justify-between text-center relative">
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-8 max-w-xs leading-tight">
            Planifie ta marche en fonction de ton objectif et nombre de pas à atteindre
          </h1>
        </div>

        {/* Navigation dots */}
        <div className="flex gap-2 mb-6">
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
          <div className="w-3 h-3 rounded-full bg-secondary"></div>
        </div>

        <Button 
          onClick={onNext}
          className="w-full py-4 text-lg font-semibold rounded-2xl bg-secondary hover:bg-secondary/90 text-white border-0"
        >
          Continuer
        </Button>

        {/* Bottom indicator */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-black/20 rounded-full"></div>
      </div>
    </div>
  );
};

export default Onboarding;