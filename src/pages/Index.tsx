import { useState } from 'react';
import Onboarding from '@/components/Onboarding';
import Auth from '@/components/Auth';
import ProfileCompletion from '@/components/ProfileCompletion';
import Dashboard from '@/components/Dashboard';
import WalkPlanning from '@/components/WalkPlanning';

const Index = () => {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showWalkPlanning, setShowWalkPlanning] = useState(false);

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
    setShowDashboard(true);
  };

  const handlePlanifyWalk = () => {
    setShowDashboard(false);
    setShowWalkPlanning(true);
  };

  const handleWalkPlanningComplete = () => {
    setShowWalkPlanning(false);
    setShowDashboard(true);
  };

  const handleBackToDashboard = () => {
    setShowWalkPlanning(false);
    setShowDashboard(true);
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

  if (showDashboard) {
    return <Dashboard onPlanifyWalk={handlePlanifyWalk} />;
  }

  if (showWalkPlanning) {
    return <WalkPlanning onComplete={handleWalkPlanningComplete} onBack={handleBackToDashboard} />;
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
