import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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
  const { user } = useAuth();
  const [runSessions, setRunSessions] = useState<RunSession[]>([]);

  // Load run sessions from Supabase
  useEffect(() => {
    if (!user) return;

    const loadActivities = async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .eq('activity_type', 'run')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error loading run sessions:', error);
        return;
      }

      if (data) {
        const sessions: RunSession[] = data.map(activity => ({
          id: activity.id,
          date: activity.date,
          distanceKm: activity.distance_km,
          calories: activity.calories,
          durationMin: activity.duration_min,
          steps: activity.steps,
          pace: 'moderate' as 'slow' | 'moderate' | 'fast',
          startTime: new Date(activity.start_time),
          endTime: new Date(activity.end_time)
        }));
        setRunSessions(sessions);
      }
    };

    loadActivities();
  }, [user]);

  const getLocalDateString = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const saveRunSession = async (sessionData: {
    distanceKm: number;
    calories: number;
    durationMin: number;
    steps: number;
    pace: 'slow' | 'moderate' | 'fast';
    startTime: Date;
    endTime: Date;
  }) => {
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    const { data, error } = await supabase
      .from('activities')
      .insert({
        user_id: user.id,
        activity_type: 'run',
        date: getLocalDateString(),
        steps: sessionData.steps,
        distance_km: sessionData.distanceKm,
        calories: sessionData.calories,
        duration_min: sessionData.durationMin,
        start_time: sessionData.startTime.toISOString(),
        end_time: sessionData.endTime.toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving run session:', error);
      return null;
    }

    if (data) {
      const newSession: RunSession = {
        id: data.id,
        date: data.date,
        distanceKm: data.distance_km,
        calories: data.calories,
        durationMin: data.duration_min,
        steps: data.steps,
        pace: sessionData.pace,
        startTime: new Date(data.start_time),
        endTime: new Date(data.end_time)
      };
      setRunSessions(prev => [newSession, ...prev]);
      return newSession;
    }

    return null;
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