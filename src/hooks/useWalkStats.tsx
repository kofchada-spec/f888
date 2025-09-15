import { useState, useEffect } from 'react';

export interface WalkSession {
  id: string;
  date: string; // ISO date string
  steps: number;
  distanceKm: number;
  calories: number;
  durationMin: number;
  startTime: Date;
  endTime: Date;
}

export interface DayStats {
  dateISO: string;
  steps: number;
  distanceKm: number;
  kcal: number;
  walkMin: number;
}

export const useWalkStats = () => {
  const [walkSessions, setWalkSessions] = useState<WalkSession[]>([]);

  // Load saved walk sessions on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('walkSessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setWalkSessions(parsed);
      } catch (error) {
        console.error('Error loading walk sessions:', error);
        setWalkSessions([]);
      }
    }
  }, []);

  // Save walk sessions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('walkSessions', JSON.stringify(walkSessions));
  }, [walkSessions]);

  const saveWalkSession = (sessionData: {
    steps: number;
    distanceKm: number;
    calories: number;
    durationMin: number;
    startTime: Date;
    endTime: Date;
  }) => {
    const session: WalkSession = {
      id: `walk_${Date.now()}`,
      date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
      ...sessionData
    };

    setWalkSessions(prev => [...prev, session]);
    return session;
  };

  // Get today's total stats
  const getTodayStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = walkSessions.filter(session => session.date === today);
    
    return todaySessions.reduce(
      (totals, session) => ({
        steps: totals.steps + session.steps,
        distanceKm: totals.distanceKm + session.distanceKm,
        calories: totals.calories + session.calories,
        walkTime: totals.walkTime + session.durationMin
      }),
      { steps: 0, distanceKm: 0, calories: 0, walkTime: 0 }
    );
  };

  // Get weekly stats (Monday to Sunday)
  const getWeeklyStats = (): DayStats[] => {
    const today = new Date();
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 1);
    
    const weekDays: DayStats[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateISO = date.toISOString().split('T')[0];
      
      const daySessions = walkSessions.filter(session => session.date === dateISO);
      const dayTotals = daySessions.reduce(
        (totals, session) => ({
          steps: totals.steps + session.steps,
          distanceKm: totals.distanceKm + session.distanceKm,
          kcal: totals.kcal + session.calories,
          walkMin: totals.walkMin + session.durationMin
        }),
        { steps: 0, distanceKm: 0, kcal: 0, walkMin: 0 }
      );
      
      weekDays.push({
        dateISO,
        ...dayTotals
      });
    }
    
    return weekDays;
  };

  // Get total weekly stats
  const getWeekTotals = () => {
    const weeklyStats = getWeeklyStats();
    return weeklyStats.reduce(
      (totals, day) => ({
        steps: totals.steps + day.steps,
        distanceKm: totals.distanceKm + day.distanceKm,
        kcal: totals.kcal + day.kcal,
        walkMin: totals.walkMin + day.walkMin
      }),
      { steps: 0, distanceKm: 0, kcal: 0, walkMin: 0 }
    );
  };

  return {
    walkSessions,
    saveWalkSession,
    getTodayStats,
    getWeeklyStats,
    getWeekTotals
  };
};