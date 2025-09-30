import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Onboarding from '@/components/Onboarding';
import Auth from '@/components/Auth';
import ProfileCompletion from '@/components/ProfileCompletion';
import Dashboard from '@/components/Dashboard';
import WalkPlanning from '@/components/WalkPlanning';
import RunPlanning from '@/components/RunPlanning';
import MapScreen from '@/components/MapScreen';
import WalkTracking from '@/components/WalkTracking';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [hasCompletedProfile, setHasCompletedProfile] = useState(false);
  const [skipAuth, setSkipAuth] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showWalkPlanning, setShowWalkPlanning] = useState(false);
  const [showRunPlanning, setShowRunPlanning] = useState(false);
  const [showDestinationSelection, setShowDestinationSelection] = useState(false);
  const [showWalkTracking, setShowWalkTracking] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const [activityType, setActivityType] = useState<'walk' | 'run'>('walk');
  const [planningData, setPlanningData] = useState({ 
    steps: 10000, 
    pace: 'moderate' as 'slow' | 'moderate' | 'fast',
    tripType: 'one-way' as 'one-way' | 'round-trip',
    height: 1.70,
    weight: 70
  });

  // Check stored completion states on mount
  useEffect(() => {
    const onboardingComplete = localStorage.getItem('fitpas-onboarding-complete');
    const profileComplete = localStorage.getItem('fitpas-profile-complete');
    const skipAuthSaved = localStorage.getItem('fitpas-skip-auth');
    
    // Set completion states based on localStorage
    setHasCompletedOnboarding(!!onboardingComplete);
    setHasCompletedProfile(!!profileComplete);
    
    // Set skipAuth based on localStorage (defaults to true if not set)
    setSkipAuth(skipAuthSaved !== null ? skipAuthSaved === 'true' : true);
    
    // Mark as initialized after reading localStorage
    setIsInitialized(true);
  }, []);

  // Check for URL parameters
  useEffect(() => {
    const destinationParam = searchParams.get('destination');
    const dashboardParam = searchParams.get('dashboard');
    
    if (dashboardParam === 'true') {
      // Force return to dashboard - hide green background if onboarding shows
      setShowWalkPlanning(false);
      setShowDestinationSelection(false);
      setShowWalkTracking(false);
      setSelectedDestination(null);
    } else if (destinationParam === 'true' && hasCompletedOnboarding && hasCompletedProfile && (user || skipAuth)) {
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
    setActivityType('walk');
    setShowWalkPlanning(true);
  };

  const handlePlanifyRun = () => {
    setActivityType('run');
    setShowRunPlanning(true);
  };

  const handleWalkPlanningComplete = (data: { steps: number; pace: 'slow' | 'moderate' | 'fast'; tripType: 'one-way' | 'round-trip'; height: number; weight: number }) => {
    setPlanningData(data);
    setShowWalkPlanning(false);
    // Reset any previous map/destination state when entering map screen
    setSelectedDestination(null);
    setShowDestinationSelection(true);
  };

  const handleGoToDashboard = () => {
    setShowWalkPlanning(false);
    setShowRunPlanning(false);
    setShowDestinationSelection(false);
    setShowWalkTracking(false);
    setSelectedDestination(null);
  };

  const handleBackToDashboard = () => {
    setShowWalkPlanning(false);
    setShowRunPlanning(false);
  };

  const handleRunPlanningComplete = (data: { steps: number; pace: 'slow' | 'moderate' | 'fast'; tripType: 'one-way' | 'round-trip'; height: number; weight: number }) => {
    setPlanningData(data);
    setShowRunPlanning(false);
    setSelectedDestination(null);
    setShowDestinationSelection(true);
  };

  const handleDestinationComplete = (destination: any) => {
    console.log('Destination sélectionnée:', destination);
    setSelectedDestination(destination);
    setShowDestinationSelection(false);
    setShowWalkTracking(true);
  };

  const handleBackToPlanning = () => {
    setShowDestinationSelection(false);
    if (activityType === 'walk') {
      setShowWalkPlanning(true);
    } else {
      setShowRunPlanning(true);
    }
  };

  const handleBackToDestination = () => {
    setShowWalkTracking(false);
    setShowDestinationSelection(true);
  };

  // Show loading while auth or initialization is loading
  if (loading || !isInitialized) {
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

  // Show profile completion if not completed (and user is authenticated OR auth is skipped)
  if (!hasCompletedProfile && (user || skipAuth)) {
    return <ProfileCompletion onComplete={handleProfileComplete} />;
  }

  // Show Walk Planning if active
  if (showWalkPlanning) {
    return <WalkPlanning onComplete={handleWalkPlanningComplete} onBack={handleBackToDashboard} onGoToDashboard={handleGoToDashboard} />;
  }

  // Show Run Planning if active
  if (showRunPlanning) {
    return <RunPlanning onComplete={handleRunPlanningComplete} onBack={handleBackToDashboard} onGoToDashboard={handleGoToDashboard} />;
  }

  // Show Destination Selection if active
  if (showDestinationSelection) {
    return (
      <MapScreen 
        onComplete={handleDestinationComplete} 
        onBack={handleBackToPlanning}
        onGoToDashboard={handleGoToDashboard}
        planningData={planningData}
        activityType={activityType}
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
  return <Dashboard onPlanifyWalk={handlePlanifyWalk} onPlanifyRun={handlePlanifyRun} />;
};

export default Index;
