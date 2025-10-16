import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Onboarding from '@/components/Onboarding';
import Auth from '@/components/Auth';
import ProfileCompletion from '@/components/ProfileCompletion';
import Dashboard from '@/components/Dashboard';
import WalkPlanning from '@/components/WalkPlanning';
import RunPlanning from '@/components/RunPlanning';
import MapScreen from '@/components/MapScreen';
import RunMapScreen from '@/components/RunMapScreen';
import WalkTracking from '@/components/WalkTracking';
import RunTracking from '@/components/RunTracking';
import { LoadingScreen } from '@/components/LoadingScreen';
import { PageTransition } from '@/components/PageTransition';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useProfileStatus } from '@/hooks/useProfileStatus';

const Index = () => {
  const { user, loading } = useAuth();
  const { subscriptionData, loading: subscriptionLoading } = useSubscription();
  const { hasCompletedOnboarding, hasCompletedProfile, isLoading: isLoadingProfile, isInitialized } = useProfileStatus(user, loading);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [showWalkPlanning, setShowWalkPlanning] = useState(false);
  const [showRunPlanning, setShowRunPlanning] = useState(false);
  const [showDestinationSelection, setShowDestinationSelection] = useState(false);
  const [showWalkTracking, setShowWalkTracking] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const [activityType, setActivityType] = useState<'walk' | 'run'>('walk');
  const [planningData, setPlanningData] = useState<{ 
    steps?: number;
    distance?: number;
    pace: 'slow' | 'moderate' | 'fast';
    tripType: 'one-way' | 'round-trip';
    height: number;
    weight: number;
  }>({ 
    steps: 10000, 
    pace: 'moderate',
    tripType: 'one-way',
    height: 1.70,
    weight: 70
  });

  // Handle onboarding completion
  const handleOnboardingComplete = () => {
    localStorage.setItem('fitpas-onboarding-complete', 'true');
    // Force reload to trigger profile check
    window.location.reload();
  };

  const handleAuthComplete = () => {
    // Auth state will trigger profile check automatically
  };

  const handleProfileComplete = () => {
    localStorage.setItem('fitpas-profile-complete', 'true');
    // Force reload to trigger profile check
    window.location.reload();
  };

  // Check for URL parameters
  useEffect(() => {
    const destinationParam = searchParams.get('destination');
    const dashboardParam = searchParams.get('dashboard');
    
    if (dashboardParam === 'true') {
      // Force return to dashboard
      setShowWalkPlanning(false);
      setShowRunPlanning(false);
      setShowDestinationSelection(false);
      setShowWalkTracking(false);
      setSelectedDestination(null);
    } else if (destinationParam === 'true' && hasCompletedOnboarding && hasCompletedProfile && user) {
      setShowDestinationSelection(true);
    }
  }, [searchParams, hasCompletedOnboarding, hasCompletedProfile, user]);

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

  const handleRunPlanningComplete = (data: { distance: number; pace: 'slow' | 'moderate' | 'fast'; tripType: 'one-way' | 'round-trip'; height: number; weight: number }) => {
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

  // Check subscription status and redirect if expired
  // TEMPORARILY DISABLED - Subscription check for testing
  // useEffect(() => {
  //   if (user && subscriptionData && !subscriptionLoading && hasCompletedProfile) {
  //     // If trial expired and not subscribed, redirect to subscription page
  //     if (!subscriptionData.hasAccess && location.pathname !== '/subscription') {
  //       navigate('/subscription', { replace: true });
  //     }
  //   }
  // }, [user, subscriptionData, subscriptionLoading, hasCompletedProfile, navigate, location.pathname]);

  // Show loading while auth or profile check is in progress
  // CRITICAL: Block ALL rendering until we know the profile status for certain
  if (loading || isLoadingProfile || !isInitialized || subscriptionLoading || hasCompletedProfile === null || hasCompletedOnboarding === null) {
    return <LoadingScreen />;
  }

  // Show onboarding if not completed
  if (hasCompletedOnboarding === false) {
    return (
      <PageTransition>
        <Onboarding onComplete={handleOnboardingComplete} />
      </PageTransition>
    );
  }

  // Show auth if user is not authenticated
  if (!user) {
    return (
      <PageTransition>
        <Auth onComplete={handleAuthComplete} />
      </PageTransition>
    );
  }

  // Show profile completion if not completed (after authentication)
  // Only show if we're CERTAIN the profile is incomplete
  if (hasCompletedProfile === false) {
    return (
      <PageTransition>
        <ProfileCompletion onComplete={handleProfileComplete} />
      </PageTransition>
    );
  }

  // Show Walk Planning if active
  if (showWalkPlanning) {
    return (
      <PageTransition>
        <WalkPlanning onComplete={handleWalkPlanningComplete} onBack={handleBackToDashboard} onGoToDashboard={handleGoToDashboard} />
      </PageTransition>
    );
  }

  // Show Run Planning if active
  if (showRunPlanning) {
    return (
      <PageTransition>
        <RunPlanning onComplete={handleRunPlanningComplete} onBack={handleBackToDashboard} onGoToDashboard={handleGoToDashboard} />
      </PageTransition>
    );
  }

  // Show Destination Selection if active
  if (showDestinationSelection) {
    // Use different map screens based on activity type
    if (activityType === 'run') {
      return (
        <PageTransition>
          <RunMapScreen 
            onComplete={handleDestinationComplete} 
            onBack={handleBackToPlanning}
            onGoToDashboard={handleGoToDashboard}
            planningData={planningData}
          />
        </PageTransition>
      );
    } else {
      return (
        <PageTransition>
          <MapScreen 
            onComplete={handleDestinationComplete} 
            onBack={handleBackToPlanning}
            onGoToDashboard={handleGoToDashboard}
            planningData={planningData}
            activityType={activityType}
          />
        </PageTransition>
      );
    }
  }

  // Show Walk/Run Tracking if active
  if (showWalkTracking && selectedDestination) {
    if (activityType === 'run') {
      return (
        <PageTransition>
          <RunTracking 
            destination={selectedDestination}
            planningData={planningData}
            onBack={handleBackToDestination}
            onGoToDashboard={handleGoToDashboard}
          />
        </PageTransition>
      );
    } else {
      return (
        <PageTransition>
          <WalkTracking 
            destination={selectedDestination}
            planningData={planningData}
            onBack={handleBackToDestination}
            onGoToDashboard={handleGoToDashboard}
          />
        </PageTransition>
      );
    }
  }

  // Show Dashboard (default authenticated state)
  return (
    <PageTransition>
      <Dashboard onPlanifyWalk={handlePlanifyWalk} onPlanifyRun={handlePlanifyRun} />
    </PageTransition>
  );
};

export default Index;
