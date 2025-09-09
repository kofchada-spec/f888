import { useState } from 'react';
import Onboarding from '@/components/Onboarding';
import Auth from '@/components/Auth';
import ProfileCompletion from '@/components/ProfileCompletion';
import Dashboard from '@/components/Dashboard';
import WalkPlanning from '@/components/WalkPlanning';
import DestinationSelection from '@/components/DestinationSelection';

const Index = () => {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showWalkPlanning, setShowWalkPlanning] = useState(false);
  const [showDestinationSelection, setShowDestinationSelection] = useState(false);
  const [planningData, setPlanningData] = useState({ 
    steps: '10000', 
    pace: 'moderate' as 'slow' | 'moderate' | 'fast',
    tripType: 'one-way' as 'one-way' | 'round-trip'
  });

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

  const handleWalkPlanningComplete = (data: { steps: string; pace: 'slow' | 'moderate' | 'fast'; tripType: 'one-way' | 'round-trip' }) => {
    setPlanningData(data);
    setShowWalkPlanning(false);
    setShowDestinationSelection(true);
  };

  const handleBackToDashboard = () => {
    setShowWalkPlanning(false);
    setShowDashboard(true);
  };

  const handleDestinationComplete = (destination: any) => {
    console.log('Destination sélectionnée:', destination);
    // Ici on naviguera vers l'écran de navigation
    setShowDestinationSelection(false);
    setShowDashboard(true);
  };

  const handleBackToPlanning = () => {
    setShowDestinationSelection(false);
    setShowWalkPlanning(true);
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

  if (showDestinationSelection) {
    return (
      <DestinationSelection 
        onComplete={handleDestinationComplete} 
        onBack={handleBackToPlanning}
        planningData={planningData}
      />
    );
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
