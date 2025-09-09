import { useState } from 'react';
import Onboarding from '@/components/Onboarding';
import Auth from '@/components/Auth';
import ProfileCompletion from '@/components/ProfileCompletion';

const Index = () => {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setShowAuth(true);
  };

  const handleAuthComplete = () => {
    setShowAuth(false);
    setShowProfileCompletion(true);
  };

  const handleProfileComplete = () => {
    setShowProfileCompletion(false);
    // Ici on peut rediriger vers le dashboard principal
  };

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (showAuth) {
    return <Auth onComplete={handleAuthComplete} />;
  }

  if (showProfileCompletion) {
    return <ProfileCompletion onComplete={handleProfileComplete} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">Bienvenue dans FitPaS!</h1>
        <p className="text-xl text-muted-foreground">Application prête à être utilisée!</p>
      </div>
    </div>
  );
};

export default Index;
