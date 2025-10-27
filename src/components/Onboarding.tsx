import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, User, Target, Footprints } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, CarouselApi } from '@/components/ui/carousel';
import { useTranslation } from 'react-i18next';
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

  const goToComplete = async () => {
    // Save onboarding completion to Supabase if user is authenticated
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await supabase
          .from('profiles')
          .upsert({
            user_id: user.id,
            onboarding_complete: true
          }, {
            onConflict: 'user_id'
          });
      } else {
        // Fallback to localStorage if not authenticated
        localStorage.setItem('fitpas-onboarding-complete', 'true');
      }
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      // Fallback to localStorage on error
      localStorage.setItem('fitpas-onboarding-complete', 'true');
    }
    
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
    <div className="native-screen">
      <Carousel
        setApi={setApi} 
        className="w-full h-full flex flex-col"
        opts={{
          align: "start",
          loop: false,
          dragFree: false,
        }}
      >
        <CarouselContent className="flex-1 h-full m-0 p-0">
          <CarouselItem className="h-full m-0 p-0 flex-[0_0_100%]">
            <WelcomeScreen onNext={nextSlide} onSkip={goToComplete} showBack={false} />
          </CarouselItem>
          <CarouselItem className="h-full m-0 p-0 flex-[0_0_100%]">
            <PresentationScreen onNext={nextSlide} onBack={prevSlide} showBack={true} />
          </CarouselItem>
          <CarouselItem className="h-full m-0 p-0 flex-[0_0_100%]">
            <GoalsScreen onNext={goToComplete} onBack={prevSlide} showBack={true} />
          </CarouselItem>
        </CarouselContent>
      </Carousel>
    </div>
  );
};

const WelcomeScreen = ({ onNext, onSkip, showBack }: { onNext: () => void; onSkip: () => void; showBack: boolean }) => {
  const { t } = useTranslation();
  
  return (
    <div className="h-full w-full relative">
      {/* Background extends everywhere */}
      <div className="bg-extend bg-gradient-to-br from-green-400 via-green-500 to-green-600" />
      
      {/* Content respects safe areas */}
      <div className="relative h-full w-full flex flex-col items-center justify-between text-center native-content px-6 py-8">
        {/* Skip button - top right */}
        <div className="w-full flex justify-end mb-4">
          <button 
            onClick={onSkip}
            className="px-6 py-2 text-white/90 hover:text-white font-medium text-base transition-colors"
          >
            Passer
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Icon with circle background */}
          <div className="mb-12 relative">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Footprints className="w-12 h-12 md:w-14 md:h-14 text-white" strokeWidth={2.5} />
            </div>
          </div>
          
          <div className="space-y-4 text-center max-w-md mx-auto">
            <h1 className="font-raleway text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight leading-tight">
              {t('onboarding.welcome.title')}
            </h1>
            <p className="font-raleway text-white/90 text-base md:text-lg font-normal leading-relaxed">
              {t('onboarding.welcome.subtitle')}
            </p>
          </div>
        </div>

        <div className="w-full space-y-4">
          <Button 
            onClick={onNext}
            className="w-full py-6 text-lg font-semibold rounded-3xl bg-white text-green-600 hover:bg-white/95 border-0 shadow-lg"
          >
            Suivant
          </Button>

          {/* Bottom indicator */}
          <div className="flex justify-center pb-2">
            <div className="w-12 h-1 bg-white/30 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PresentationScreen = ({ onNext, onBack, showBack }: { onNext: () => void; onBack: () => void; showBack: boolean }) => {
  const { t } = useTranslation();
  
  return (
    <div className="h-full w-full relative">
      <div className="bg-extend bg-gradient-to-br from-green-50 via-blue-50 to-white" />
      <div className="relative w-full h-full flex flex-col items-center justify-between text-center native-content px-6 py-4">
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
              className="w-24 h-24 md:w-36 md:h-36 mx-auto drop-shadow-2xl"
            />
          </div>

          <div className="space-y-8 text-center px-4">
            <h1 className="font-raleway text-2xl font-bold text-gray-900 leading-tight max-w-sm tracking-tight" dangerouslySetInnerHTML={{ __html: t('onboarding.presentation.title') }} />

            <div className="flex items-center justify-center space-x-2">
              <div className="h-0.5 w-8 bg-gradient-to-r from-primary to-transparent"></div>
              <div className="h-1 w-1 rounded-full bg-primary"></div>
              <div className="h-0.5 w-8 bg-gradient-to-l from-primary to-transparent"></div>
            </div>

            <p className="font-raleway text-base text-gray-600 max-w-sm leading-relaxed font-light">
              {t('onboarding.presentation.subtitle')}
            </p>
          </div>
        </div>


        <Button 
          onClick={onNext}
          className="w-full py-4 text-lg font-semibold rounded-2xl bg-secondary hover:bg-secondary/90 text-white border-0"
        >
          {t('onboarding.next')}
        </Button>

        {/* Bottom indicator */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-black/20 rounded-full"></div>
      </div>
    </div>
  );
};

const GoalsScreen = ({ onNext, onBack, showBack }: { onNext: () => void; onBack: () => void; showBack: boolean }) => {
  const { t } = useTranslation();
  
  return (
    <div className="h-full w-full relative">
      <div className="bg-extend bg-gradient-to-br from-green-50 via-blue-50 to-white" />
      <div className="relative w-full h-full flex flex-col items-center justify-between text-center native-content px-6 py-4">
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
              className="w-24 h-24 md:w-36 md:h-36 mx-auto drop-shadow-2xl"
            />
          </div>

          <div className="space-y-8 text-center">
            <h1 className="font-raleway text-2xl font-bold text-gray-900 max-w-sm leading-tight tracking-tight">
              {t('onboarding.goals.title')}
            </h1>

            <div className="flex items-center justify-center space-x-2">
              <div className="h-0.5 w-10 bg-gradient-to-r from-secondary to-transparent"></div>
              <div className="h-1 w-1 rounded-full bg-secondary"></div>
              <div className="h-0.5 w-10 bg-gradient-to-l from-secondary to-transparent"></div>
            </div>

            <p className="font-raleway text-base text-gray-600 max-w-sm leading-relaxed font-light" dangerouslySetInnerHTML={{ __html: t('onboarding.goals.subtitle') }} />
          </div>
        </div>


        <Button 
          onClick={onNext}
          className="w-full py-4 text-lg font-semibold rounded-2xl bg-secondary hover:bg-secondary/90 text-white border-0"
        >
          {t('onboarding.welcome.start')}
        </Button>

        {/* Bottom indicator */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-black/20 rounded-full"></div>
      </div>
    </div>
  );
};

export default Onboarding;