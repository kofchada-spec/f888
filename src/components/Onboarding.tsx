import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, User, Target } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from '@/components/ui/carousel';
import mapOnboarding from '@/assets/map-onboarding.jpg';
const fitpasLogo = '/lovable-uploads/4c20a048-5819-4d0f-b867-b91d67ca59ee.png';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding = ({ onComplete }: OnboardingProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  const nextSlide = () => {
    if (api) {
      api.scrollNext();
    }
  };

  const prevSlide = () => {
    if (api) {
      api.scrollPrev();
    }
  };

  const goToComplete = () => {
    onComplete();
  };

  // Effet pour suivre le slide actuel
  useState(() => {
    if (!api) return;

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  });

  return (
    <div className="min-h-screen relative">
      <Carousel 
        setApi={setApi} 
        className="w-full h-screen"
        opts={{
          align: "start",
          loop: false,
          dragFree: false,
        }}
      >
        <CarouselContent className="h-screen">
          <CarouselItem className="h-full">
            <WelcomeScreen onNext={nextSlide} showBack={false} />
          </CarouselItem>
          <CarouselItem className="h-full">
            <PresentationScreen onNext={nextSlide} onBack={prevSlide} showBack={true} />
          </CarouselItem>
          <CarouselItem className="h-full">
            <GoalsScreen onNext={goToComplete} onBack={prevSlide} showBack={true} />
          </CarouselItem>
        </CarouselContent>
      </Carousel>
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
          <div className="mb-10 transform animate-pulse">
            <img 
              src={fitpasLogo} 
              alt="Fitpas Logo" 
              className="w-28 h-28 mx-auto drop-shadow-2xl"
            />
          </div>
          <div className="space-y-6 text-center">
            <h1 className="font-inter text-4xl font-black text-white mb-3 tracking-tight leading-none">
              Bienvenue
            </h1>
            <p className="font-inter text-white/95 text-lg font-light leading-relaxed px-6 tracking-wide">
              Ta marche, ton rythme, ton objectif.
            </p>
          </div>
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
          <div className="mb-10 transform hover:scale-105 transition-all duration-500">
            <img 
              src="/lovable-uploads/18d7c199-1173-482f-9050-fbbb00132134.png"
              alt="Personne qui marche"
              className="w-36 h-36 mx-auto drop-shadow-2xl"
            />
          </div>

          <div className="space-y-8 text-center px-4">
            <h1 className="font-inter text-2xl font-bold text-gray-900 leading-tight max-w-sm tracking-tight">
              Planifie ta marche en fonction de ton{' '}
              <span className="text-primary">objectif de pas</span>{' '}
              à atteindre.
            </h1>

            <div className="flex items-center justify-center space-x-2">
              <div className="h-0.5 w-8 bg-gradient-to-r from-primary to-transparent"></div>
              <div className="h-1 w-1 rounded-full bg-primary"></div>
              <div className="h-0.5 w-8 bg-gradient-to-l from-primary to-transparent"></div>
            </div>

            <p className="font-inter text-base text-gray-600 max-w-sm leading-relaxed font-light">
              Définis ton <span className="font-semibold">objectif</span> et laisse{' '}
              <span className="font-semibold text-primary">Fitpas</span>{' '}
              t'accompagner.
            </p>
          </div>
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
          <div className="mb-10 transform hover:scale-105 transition-all duration-500">
            <img 
              src={mapOnboarding}
              alt="Carte avec destinations"
              className="w-36 h-36 mx-auto drop-shadow-2xl"
            />
          </div>

          <div className="space-y-8 text-center">
            <h1 className="font-inter text-2xl font-bold text-gray-900 max-w-sm leading-tight tracking-tight">
              <span className="text-primary">Fitpas</span> te propose des{' '}
              <span className="text-secondary">destinations</span>{' '}
              selon tes objectifs à atteindre.
            </h1>

            <div className="flex items-center justify-center space-x-2">
              <div className="h-0.5 w-10 bg-gradient-to-r from-secondary to-transparent"></div>
              <div className="h-1 w-1 rounded-full bg-secondary"></div>
              <div className="h-0.5 w-10 bg-gradient-to-l from-secondary to-transparent"></div>
            </div>

            <p className="font-inter text-base text-gray-600 max-w-sm leading-relaxed font-light">
              <span className="font-semibold text-primary">Fitpas</span> estime <span className="font-semibold">l'heure</span> et la <span className="font-semibold">distance</span> à parcourir en fonction de ta <span className="font-semibold">marche</span> ou ta <span className="font-semibold">course</span>.
            </p>
          </div>
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