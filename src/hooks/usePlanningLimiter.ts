import { useState, useEffect, useCallback } from 'react';

interface PlanningLimiterData {
  dailyPlansUsed: number;
  lastPlanDate: string;
  currentStreak: number;
  lastActivityDate: string;
}

const STORAGE_KEY = 'planning_limiter_data';
const BASE_DAILY_LIMIT = 3;
const MAX_DAILY_LIMIT = 6;

// 🧪 MODE TEST: Désactive temporairement les limites de planification pour les tests
const TEST_MODE = true;

export const usePlanningLimiter = () => {
  const [dailyPlansUsed, setDailyPlansUsed] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate bonus plans based on streak
  const getBonusPlans = useCallback((streak: number): number => {
    if (streak >= 30) return 3;
    if (streak >= 14) return 2;
    if (streak >= 7) return 1;
    return 0;
  }, []);

  const dailyLimit = TEST_MODE ? 999 : BASE_DAILY_LIMIT + getBonusPlans(currentStreak);
  const remainingPlans = TEST_MODE ? 999 : Math.max(0, dailyLimit - dailyPlansUsed);
  const canPlan = TEST_MODE ? true : remainingPlans > 0;

  // Load data from localStorage
  useEffect(() => {
    const loadData = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const today = new Date().toDateString();

        if (stored) {
          const data: PlanningLimiterData = JSON.parse(stored);
          
          // Reset daily counter if it's a new day
          if (data.lastPlanDate !== today) {
            setDailyPlansUsed(0);
          } else {
            setDailyPlansUsed(data.dailyPlansUsed);
          }

          // Check if streak should be broken
          const lastActivity = new Date(data.lastActivityDate);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          
          if (data.lastActivityDate === today || data.lastActivityDate === yesterday.toDateString()) {
            setCurrentStreak(data.currentStreak);
          } else {
            // Streak broken - reset to 0
            setCurrentStreak(0);
            const newData: PlanningLimiterData = {
              ...data,
              currentStreak: 0
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
          }
        } else {
          // Initialize data
          const initialData: PlanningLimiterData = {
            dailyPlansUsed: 0,
            lastPlanDate: today,
            currentStreak: 0,
            lastActivityDate: ''
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
        }
      } catch (error) {
        console.error('Error loading planning limiter data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Increment plan count
  const incrementPlanCount = useCallback(() => {
    // En mode test, toujours permettre la planification
    if (TEST_MODE) return true;
    if (!canPlan) return false;

    const today = new Date().toDateString();
    const stored = localStorage.getItem(STORAGE_KEY);
    const data: PlanningLimiterData = stored ? JSON.parse(stored) : {
      dailyPlansUsed: 0,
      lastPlanDate: today,
      currentStreak: 0,
      lastActivityDate: ''
    };

    const newPlansUsed = dailyPlansUsed + 1;
    const newData: PlanningLimiterData = {
      ...data,
      dailyPlansUsed: newPlansUsed,
      lastPlanDate: today
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    setDailyPlansUsed(newPlansUsed);
    return true;
  }, [canPlan, dailyPlansUsed]);

  // Validate activity completion (increments streak)
  const validateActivityCompletion = useCallback(() => {
    const today = new Date().toDateString();
    const stored = localStorage.getItem(STORAGE_KEY);
    const data: PlanningLimiterData = stored ? JSON.parse(stored) : {
      dailyPlansUsed: 0,
      lastPlanDate: today,
      currentStreak: 0,
      lastActivityDate: ''
    };

    // Only increment streak if last activity was not today
    if (data.lastActivityDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      let newStreak: number;
      if (data.lastActivityDate === yesterday.toDateString()) {
        // Continue streak
        newStreak = data.currentStreak + 1;
      } else if (data.lastActivityDate === '') {
        // First activity ever
        newStreak = 1;
      } else {
        // Streak was broken, start new
        newStreak = 1;
      }

      const newData: PlanningLimiterData = {
        ...data,
        currentStreak: newStreak,
        lastActivityDate: today
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      setCurrentStreak(newStreak);
    }
  }, []);

  return {
    dailyPlansUsed,
    dailyLimit,
    remainingPlans,
    canPlan,
    currentStreak,
    bonusPlans: getBonusPlans(currentStreak),
    isLoading,
    incrementPlanCount,
    validateActivityCompletion
  };
};
