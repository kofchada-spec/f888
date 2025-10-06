import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [hasCompletedProfile, setHasCompletedProfile] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
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

  // Check stored completion states on mount and verify profile in Supabase
  useEffect(() => {
    const checkProfileCompletion = async () => {
      const onboardingComplete = localStorage.getItem('fitpas-onboarding-complete');
      setHasCompletedOnboarding(!!onboardingComplete);
      
      // If user is authenticated, check if profile exists in Supabase
      if (user) {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (profile && !error) {
          // Profile exists in database
          setHasCompletedProfile(true);
          localStorage.setItem('fitpas-profile-complete', 'true');
        } else {
          // No profile in database
          setHasCompletedProfile(false);
          localStorage.removeItem('fitpas-profile-complete');
        }
      } else {
        // Not authenticated, check localStorage
        const profileComplete = localStorage.getItem('fitpas-profile-complete');
        setHasCompletedProfile(!!profileComplete);
      }
      
      setIsInitialized(true);
    };
    
    checkProfileCompletion();
  }, [user]);

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
    } else if (destinationParam === 'true' && hasCompletedOnboarding && hasCompletedProfile && user) {
      setShowDestinationSelection(true);
    }
  }, [searchParams, hasCompletedOnboarding, hasCompletedProfile, user]);

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

  // Show auth if user is not authenticated
  if (!user) {
    return <Auth onComplete={handleAuthComplete} />;
  }

  // Show profile completion if not completed (after authentication)
  if (!hasCompletedProfile) {
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
    // Use different map screens based on activity type
    if (activityType === 'run') {
      return (
        <RunMapScreen 
          onComplete={handleDestinationComplete} 
          onBack={handleBackToPlanning}
          onGoToDashboard={handleGoToDashboard}
          planningData={planningData}
        />
      );
    } else {
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
  }

  // Show Walk/Run Tracking if active
  if (showWalkTracking && selectedDestination) {
    if (activityType === 'run') {
      return (
        <RunTracking 
          destination={selectedDestination}
          planningData={planningData}
          onBack={handleBackToDestination}
          onGoToDashboard={handleGoToDashboard}
        />
      );
    } else {
      return (
        <WalkTracking 
          destination={selectedDestination}
          planningData={planningData}
          onBack={handleBackToDestination}
          onGoToDashboard={handleGoToDashboard}
        />
      );
    }
  }

  // Show Dashboard (default authenticated state)
  return <Dashboard onPlanifyWalk={handlePlanifyWalk} onPlanifyRun={handlePlanifyRun} />;
};

export default Index;
