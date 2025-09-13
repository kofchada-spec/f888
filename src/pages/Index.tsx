import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Onboarding from '@/components/Onboarding';
import Auth from '@/components/Auth';
import ProfileCompletion from '@/components/ProfileCompletion';
import Dashboard from '@/components/Dashboard';
import WalkPlanning from '@/components/WalkPlanning';
import DestinationSelection from '@/components/DestinationSelection';
import WalkTracking from '@/components/WalkTracking';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [hasCompletedProfile, setHasCompletedProfile] = useState(false);
  const [skipAuth, setSkipAuth] = useState(false);
  const [showWalkPlanning, setShowWalkPlanning] = useState(false);
  const [showDestinationSelection, setShowDestinationSelection] = useState(false);
  const [showWalkTracking, setShowWalkTracking] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const [planningData, setPlanningData] = useState({ 
    steps: '10000', 
    pace: 'moderate' as 'slow' | 'moderate' | 'fast',
    tripType: 'one-way' as 'one-way' | 'round-trip',
    height: '1.70',
    weight: '70'
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

  // Check for destination parameter to show destination selection
  useEffect(() => {
    const destinationParam = searchParams.get('destination');
    if (destinationParam === 'true' && hasCompletedOnboarding && hasCompletedProfile && (user || skipAuth)) {
      setShowDestinationSelection(true);
    }
  }, [searchParams, hasCompletedOnboarding, hasCompletedProfile, user, skipAuth]);

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
    localStorage.setItem('fitpas-onboarding-complete', 'true');
  };

  const handleAuthComplete = () => {
    // This will be handled by useAuth hook automatically
  };

  const handleSkipAuth = () => {
    setSkipAuth(true);
  };

  const handleProfileComplete = () => {
    setHasCompletedProfile(true);
    localStorage.setItem('fitpas-profile-complete', 'true');
  };

  const handlePlanifyWalk = () => {
    setShowWalkPlanning(true);
  };

  const handleWalkPlanningComplete = (data: { steps: string; pace: 'slow' | 'moderate' | 'fast'; tripType: 'one-way' | 'round-trip'; height: string; weight: string }) => {
    setPlanningData(data);
    setShowWalkPlanning(false);
    setShowDestinationSelection(true);
  };

  const handleGoToDashboard = () => {
    setShowWalkPlanning(false);
    setShowDestinationSelection(false);
    setShowWalkTracking(false);
    setSelectedDestination(null);
  };

  const handleBackToDashboard = () => {
    setShowWalkPlanning(false);
  };

  const handleDestinationComplete = (destination: any) => {
    console.log('Destination sélectionnée:', destination);
    setSelectedDestination(destination);
    setShowDestinationSelection(false);
    setShowWalkTracking(true);
  };

  const handleBackToPlanning = () => {
    setShowDestinationSelection(false);
    setShowWalkPlanning(true);
  };

  const handleBackToDestination = () => {
    setShowWalkTracking(false);
    setShowDestinationSelection(true);
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

  // Show auth if user is not authenticated and auth is not skipped
  if (!user && !skipAuth) {
    return <Auth onComplete={handleAuthComplete} onSkipAuth={handleSkipAuth} />;
  }

  // Show profile completion if not completed (and user is authenticated)
  if (!hasCompletedProfile) {
    return <ProfileCompletion onComplete={handleProfileComplete} />;
  }

  // Show Walk Planning if active
  if (showWalkPlanning) {
    return <WalkPlanning onComplete={handleWalkPlanningComplete} onBack={handleBackToDashboard} onGoToDashboard={handleGoToDashboard} />;
  }

  // Show Destination Selection if active
  if (showDestinationSelection) {
    return (
      <DestinationSelection 
        onComplete={handleDestinationComplete} 
        onBack={handleBackToPlanning}
        onGoToDashboard={handleGoToDashboard}
        planningData={planningData}
      />
    );
  }

  // Show Walk Tracking if active
  if (showWalkTracking && selectedDestination) {
    return (
      <WalkTracking 
        destination={selectedDestination}
        planningData={planningData}
        onBack={handleBackToDestination}
        onGoToDashboard={handleGoToDashboard}
      />
    );
  }

  // Show Dashboard (default authenticated state)
  return <Dashboard onPlanifyWalk={handlePlanifyWalk} />;
};

export default Index;
