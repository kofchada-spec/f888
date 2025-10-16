import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface ProfileStatus {
  hasCompletedOnboarding: boolean | null;
  hasCompletedProfile: boolean | null;
  isLoading: boolean;
  isInitialized: boolean;
}

export const useProfileStatus = (user: User | null, loading: boolean): ProfileStatus => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [hasCompletedProfile, setHasCompletedProfile] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Don't start checking until auth is loaded
    if (loading) {
      return;
    }

    const checkProfileStatus = async () => {
      setIsLoading(true);

      if (user) {
        try {
          // Fetch profile from Supabase with all required fields
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('onboarding_complete, profile_complete, first_name, last_name, gender, birth_date, height_m, weight_kg')
            .eq('user_id', user.id)
            .maybeSingle();

          if (profile && !error) {
            // Verify ALL required fields are present for a complete profile
            const isProfileComplete = !!(
              profile.profile_complete &&
              profile.first_name &&
              profile.last_name &&
              profile.gender &&
              profile.birth_date &&
              profile.height_m &&
              profile.weight_kg
            );

            const isOnboardingComplete = profile.onboarding_complete || false;

            // Update states synchronously to avoid flash
            setHasCompletedOnboarding(isOnboardingComplete);
            setHasCompletedProfile(isProfileComplete);

            // Sync with localStorage
            if (isOnboardingComplete) {
              localStorage.setItem('fitpas-onboarding-complete', 'true');
            }
            if (isProfileComplete) {
              localStorage.setItem('fitpas-profile-complete', 'true');
            } else {
              localStorage.removeItem('fitpas-profile-complete');
            }
          } else {
            // No profile found or error
            const localOnboarding = localStorage.getItem('fitpas-onboarding-complete') === 'true';
            setHasCompletedOnboarding(localOnboarding);
            setHasCompletedProfile(false);
            localStorage.removeItem('fitpas-profile-complete');
          }
        } catch (error) {
          console.error('Error checking profile status:', error);
          // Fallback to localStorage on error
          setHasCompletedOnboarding(localStorage.getItem('fitpas-onboarding-complete') === 'true');
          setHasCompletedProfile(false);
        }
      } else {
        // Not authenticated - check localStorage only
        setHasCompletedOnboarding(localStorage.getItem('fitpas-onboarding-complete') === 'true');
        setHasCompletedProfile(false);
      }

      setIsLoading(false);
      setIsInitialized(true);
    };

    checkProfileStatus();
  }, [user, loading]);

  return {
    hasCompletedOnboarding,
    hasCompletedProfile,
    isLoading,
    isInitialized
  };
};
