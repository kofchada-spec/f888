import { PlanningData, Coordinates } from '@/types/route';

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculate target distance based on steps and user height
 */
export const calculateTargetDistance = (steps: string, height: string): number => {
  const stepCount = parseInt(steps);
  const heightInMeters = parseFloat(height);
  const strideLength = 0.415 * heightInMeters;
  return (stepCount * strideLength) / 1000; // km
};

/**
 * Calculate calories based on distance, weight, and pace
 */
export const calculateCalories = (distanceKm: number, weight: string, pace: string): number => {
  const weightKg = parseFloat(weight);
  const met = pace === 'slow' ? 3.0 : pace === 'moderate' ? 4.0 : 5.0;
  const timeHours = distanceKm / (pace === 'slow' ? 4 : pace === 'moderate' ? 5 : 6);
  return Math.round(met * weightKg * timeHours);
};

/**
 * Calculate route metrics (duration, calories, steps)
 */
export const calculateRouteMetrics = (
  distance: number, 
  planningData: PlanningData
) => {
  const calories = calculateCalories(distance, planningData.weight, planningData.pace);
  const speed = planningData.pace === 'slow' ? 4 : planningData.pace === 'moderate' ? 5 : 6;
  const durationMin = Math.round((distance / speed) * 60);
  const steps = Math.round((distance * 1000) / (0.415 * parseFloat(planningData.height)));
  
  return { calories, durationMin, steps };
};

/**
 * Get tolerance range for distance validation (±5%)
 */
export const getToleranceRange = (targetDistance: number) => {
  const tolerance = 0.05; // 5%
  return {
    min: targetDistance * (1 - tolerance),
    max: targetDistance * (1 + tolerance),
    tolerance
  };
};

/**
 * Generate random coordinates around a center point
 */
export const generateRandomCoordinates = (
  center: Coordinates,
  maxRadiusKm: number
): Coordinates => {
  const angle = Math.random() * 2 * Math.PI;
  const radius = Math.random() * maxRadiusKm;
  
  const latOffset = (radius * Math.cos(angle)) / 111.32;
  const lngOffset = (radius * Math.sin(angle)) / (111.32 * Math.cos(center.lat * Math.PI / 180));
  
  return {
    lat: center.lat + latOffset,
    lng: center.lng + lngOffset
  };
};