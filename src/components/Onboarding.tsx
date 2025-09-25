import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, User, Target } from 'lucide-react';
import mapDestination from '@/assets/map-destination.png';
const fitpasLogo = '/lovable-uploads/4c20a048-5819-4d0f-b867-b91d67ca59ee.png';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      id: 'welcome',
      component: <WelcomeScreen 
        onNext={() => setCurrentStep(1)} 
        showBack={false}
      />
    },
    {
      id: 'presentation',
      component: <PresentationScreen 
        onNext={() => setCurrentStep(2)} 
        onBack={() => setCurrentStep(0)}
        showBack={true}
      />
    },
    {
      id: 'goals',
      component: <GoalsScreen 
        onNext={onComplete} 
        onBack={() => setCurrentStep(1)}
        showBack={true}
      />
    }
  ];

  return (
    <div className="min-h-screen">
      {steps[currentStep].component}
    </div>
  );
};

const WelcomeScreen = ({ onNext, showBack }: { onNext: () => void; showBack: boolean }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#27AE60' }}>
      <div className="bg-transparent rounded-3xl p-8 w-full max-w-sm h-[600px] flex flex-col items-center justify-between text-center relative overflow-hidden">
        {/* Back button */}
        {showBack && (
          <button 
            onClick={() => {}} 
            className="absolute top-6 left-6 text-white hover:text-white/80"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="mb-8 transform animate-pulse">
            <img 
              src={fitpasLogo} 
              alt="Fitpas Logo" 
              className="w-24 h-24 mx-auto drop-shadow-lg"
            />
          </div>
          <div className="space-y-4 text-center">
            <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
              Bienvenue
            </h1>
            <p className="text-white/95 text-lg font-semibold leading-relaxed px-4">
              Ta marche, ton rythme, ton objectif.
            </p>
          </div>
        </div>

        {/* Navigation dots */}
        <div className="flex gap-2 mb-6">
          <div className="w-3 h-3 rounded-full bg-white"></div>
          <div className="w-3 h-3 rounded-full bg-white/40"></div>
          <div className="w-3 h-3 rounded-full bg-white/40"></div>
        </div>

        <Button 
          onClick={onNext}
          className="w-full py-4 text-lg font-semibold rounded-2xl bg-white text-green-700 hover:bg-white/90 border-0"
        >
          Suivant
        </Button>

        {/* Bottom indicator */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-white/30 rounded-full"></div>
      </div>
    </div>
  );
};

const PresentationScreen = ({ onNext, onBack, showBack }: { onNext: () => void; onBack: () => void; showBack: boolean }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm h-[600px] flex flex-col items-center justify-between text-center relative">
        {/* Back button */}
        {showBack && (
          <button 
            onClick={onBack} 
            className="absolute top-6 left-6 text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Walking person illustration */}
          <div className="mb-8 transform hover:scale-105 transition-transform duration-300">
            <img 
              src="/lovable-uploads/18d7c199-1173-482f-9050-fbbb00132134.png"
              alt="Personne qui marche"
              className="w-32 h-32 mx-auto drop-shadow-lg"
            />
          </div>

          <div className="space-y-6 text-center px-2">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight max-w-sm">
              Planifie ta marche en fonction de ton objectif de pas à atteindre.
            </h1>

            <div className="h-px w-12 bg-gradient-to-r from-primary to-secondary mx-auto"></div>

            <p className="text-base text-gray-700 max-w-sm leading-relaxed">
              Définis ton objectif et laisse Fitpas t'accompagner.
            </p>
          </div>
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

const GoalsScreen = ({ onNext, onBack, showBack }: { onNext: () => void; onBack: () => void; showBack: boolean }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm h-[600px] flex flex-col items-center justify-between text-center relative">
        {/* Back button */}
        {showBack && (
          <button 
            onClick={onBack} 
            className="absolute top-6 left-6 text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Map/destination illustration */}
          <div className="mb-8 transform hover:scale-105 transition-transform duration-300">
            <img 
              src={mapDestination}
              alt="Carte avec destinations"
              className="w-32 h-32 mx-auto drop-shadow-lg"
            />
          </div>

          <div className="space-y-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 max-w-sm leading-tight">
              Fitpas te propose des destinations selon tes objectifs à atteindre.
            </h1>

            <div className="h-px w-12 bg-gradient-to-r from-primary to-secondary mx-auto"></div>

            <p className="text-base text-gray-700 max-w-sm leading-relaxed">
              Fitpas estime l'heure et la distance à parcourir en fonction de ton allure et du nombre de pas.
            </p>
          </div>
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
          Commencer
        </Button>

        {/* Bottom indicator */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-black/20 rounded-full"></div>
      </div>
    </div>
  );
};

export default Onboarding;