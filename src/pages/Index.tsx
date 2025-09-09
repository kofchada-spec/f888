import { useState, useEffect } from 'react';
import Onboarding from '@/components/Onboarding';
import Auth from '@/components/Auth';
import ProfileCompletion from '@/components/ProfileCompletion';
import Dashboard from '@/components/Dashboard';
import WalkPlanning from '@/components/WalkPlanning';
import DestinationSelection from '@/components/DestinationSelection';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [hasCompletedProfile, setHasCompletedProfile] = useState(false);
  const [showWalkPlanning, setShowWalkPlanning] = useState(false);
  const [showDestinationSelection, setShowDestinationSelection] = useState(false);
  const [planningData, setPlanningData] = useState({ 
    steps: '10000', 
    pace: 'moderate' as 'slow' | 'moderate' | 'fast',
    tripType: 'one-way' as 'one-way' | 'round-trip'
  });

  // Check stored completion states on mount
  useEffect(() => {
    const onboardingComplete = localStorage.getItem('fitpas-onboarding-complete');
    const profileComplete = localStorage.getItem('fitpas-profile-complete');
    
    if (onboardingComplete) {
      setHasCompletedOnboarding(true);
    }
    if (profileComplete) {
      setHasCompletedProfile(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
    localStorage.setItem('fitpas-onboarding-complete', 'true');
  };

  const handleAuthComplete = () => {
    // This will be handled by useAuth hook automatically
  };

  const handleProfileComplete = () => {
    setHasCompletedProfile(true);
    localStorage.setItem('fitpas-profile-complete', 'true');
  };

  const handlePlanifyWalk = () => {
    setShowWalkPlanning(true);
  };

  const handleWalkPlanningComplete = (data: { steps: string; pace: 'slow' | 'moderate' | 'fast'; tripType: 'one-way' | 'round-trip' }) => {
    setPlanningData(data);
    setShowWalkPlanning(false);
    setShowDestinationSelection(true);
  };

  const handleBackToDashboard = () => {
    setShowWalkPlanning(false);
  };

  const handleDestinationComplete = (destination: any) => {
    console.log('Destination sélectionnée:', destination);
    // Ici on naviguera vers l'écran de navigation
    setShowDestinationSelection(false);
  };

  const handleBackToPlanning = () => {
    setShowDestinationSelection(false);
    setShowWalkPlanning(true);
  };

  // Show loading while auth is loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Show onboarding if not completed
  if (!hasCompletedOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Show auth if user is not authenticated
  if (!user) {
    return <Auth onComplete={handleAuthComplete} />;
  }

  // Show profile completion if not completed (and user is authenticated)
  if (!hasCompletedProfile) {
    return <ProfileCompletion onComplete={handleProfileComplete} />;
  }

  // Show Walk Planning if active
  if (showWalkPlanning) {
    return <WalkPlanning onComplete={handleWalkPlanningComplete} onBack={handleBackToDashboard} />;
  }

  // Show Destination Selection if active
  if (showDestinationSelection) {
    return (
      <DestinationSelection 
        onComplete={handleDestinationComplete} 
        onBack={handleBackToPlanning}
        planningData={planningData}
      />
    );
  }

  // Show Dashboard (default authenticated state)
  return <Dashboard onPlanifyWalk={handlePlanifyWalk} />;
};

export default Index;
