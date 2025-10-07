import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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
  const { user } = useAuth();
  const [walkSessions, setWalkSessions] = useState<WalkSession[]>([]);

  // Load walk sessions from Supabase
  useEffect(() => {
    if (!user) return;

    const loadActivities = async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .eq('activity_type', 'walk')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error loading walk sessions:', error);
        return;
      }

      if (data) {
        const sessions: WalkSession[] = data.map(activity => ({
          id: activity.id,
          date: activity.date,
          steps: activity.steps,
          distanceKm: activity.distance_km,
          calories: activity.calories,
          durationMin: activity.duration_min,
          startTime: new Date(activity.start_time),
          endTime: new Date(activity.end_time)
        }));
        setWalkSessions(sessions);
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

  const saveWalkSession = async (sessionData: {
    steps: number;
    distanceKm: number;
    calories: number;
    durationMin: number;
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
        activity_type: 'walk',
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
      console.error('Error saving walk session:', error);
      return null;
    }

    if (data) {
      const newSession: WalkSession = {
        id: data.id,
        date: data.date,
        steps: data.steps,
        distanceKm: data.distance_km,
        calories: data.calories,
        durationMin: data.duration_min,
        startTime: new Date(data.start_time),
        endTime: new Date(data.end_time)
      };
      setWalkSessions(prev => [newSession, ...prev]);
      return newSession;
    }

    return null;
  };

  // Get today's total stats
  const getTodayStats = () => {
    const today = getLocalDateString();
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
      const dateISO = getLocalDateString(date);
      
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