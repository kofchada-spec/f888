import { useState, useEffect } from 'react';

export interface RunSession {
  id: string;
  date: string; // ISO date string
  distanceKm: number;
  calories: number;
  durationMin: number;
  steps: number;
  pace: 'slow' | 'moderate' | 'fast';
  startTime: Date;
  endTime: Date;
}

export interface RunDayStats {
  dateISO: string;
  distanceKm: number;
  kcal: number;
  runMin: number;
  steps: number;
}

export const useRunStats = () => {
  const [runSessions, setRunSessions] = useState<RunSession[]>([]);

  // Load saved run sessions on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('runSessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        setRunSessions(parsed);
      } catch (error) {
        console.error('Error loading run sessions:', error);
        setRunSessions([]);
      }
    }
  }, []);

  // Save run sessions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('runSessions', JSON.stringify(runSessions));
  }, [runSessions]);

  const getLocalDateString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const saveRunSession = (sessionData: {
    distanceKm: number;
    calories: number;
    durationMin: number;
    steps: number;
    pace: 'slow' | 'moderate' | 'fast';
    startTime: Date;
    endTime: Date;
  }) => {
    const session: RunSession = {
      id: `run_${Date.now()}`,
      date: getLocalDateString(), // Today's date in YYYY-MM-DD format (local time)
      ...sessionData
    };

    setRunSessions(prev => [...prev, session]);
    return session;
  };

  // Get today's total stats
  const getTodayStats = () => {
    const today = getLocalDateString();
    const todaySessions = runSessions.filter(session => session.date === today);
    
    return todaySessions.reduce(
      (totals, session) => ({
        distanceKm: totals.distanceKm + session.distanceKm,
        calories: totals.calories + session.calories,
        runTime: totals.runTime + session.durationMin,
        steps: totals.steps + session.steps
      }),
      { distanceKm: 0, calories: 0, runTime: 0, steps: 0 }
    );
  };

  // Get weekly stats (Monday to Sunday)
  const getWeeklyStats = (): RunDayStats[] => {
    const today = new Date();
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 1);
    
    const weekDays: RunDayStats[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateISO = getLocalDateString(date);
      
      const daySessions = runSessions.filter(session => session.date === dateISO);
      const dayTotals = daySessions.reduce(
        (totals, session) => ({
          distanceKm: totals.distanceKm + session.distanceKm,
          kcal: totals.kcal + session.calories,
          runMin: totals.runMin + session.durationMin,
          steps: totals.steps + session.steps
        }),
        { distanceKm: 0, kcal: 0, runMin: 0, steps: 0 }
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
        distanceKm: totals.distanceKm + day.distanceKm,
        kcal: totals.kcal + day.kcal,
        runMin: totals.runMin + day.runMin,
        steps: totals.steps + day.steps
      }),
      { distanceKm: 0, kcal: 0, runMin: 0, steps: 0 }
    );
  };

  return {
    runSessions,
    saveRunSession,
    getTodayStats,
    getWeeklyStats,
    getWeekTotals
  };
};