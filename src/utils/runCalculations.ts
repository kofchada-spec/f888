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
 * Calculate target distance for running based on distance objective
 */
export const calculateTargetDistance = (distance: number): number => {
  return Math.max(0.1, Math.min(100, distance)); // 0.1km to 100km range
};

/**
 * Get stride length for running based on pace and height
 */
export const getRunStrideLength = (height: number, pace: string): number => {
  const heightInMeters = Math.max(1.2, Math.min(2.5, height || 1.70));
  const validPace = ['slow', 'moderate', 'fast'].includes(pace) ? pace : 'moderate';
  
  // Course : foulée selon l'allure
  if (validPace === 'slow') return 0.65 * heightInMeters;
  if (validPace === 'fast') return 1.1 * heightInMeters;
  return 0.9 * heightInMeters; // moderate
};

/**
 * Get running speed in km/h based on pace
 */
export const getRunSpeed = (pace: string): number => {
  const validPace = ['slow', 'moderate', 'fast'].includes(pace) ? pace : 'moderate';
  if (validPace === 'slow') return 8;
  if (validPace === 'fast') return 15;
  return 11; // moderate
};

/**
 * Get MET (Metabolic Equivalent of Task) for running based on pace
 */
export const getRunMET = (pace: string): number => {
  const validPace = ['slow', 'moderate', 'fast'].includes(pace) ? pace : 'moderate';
  if (validPace === 'slow') return 8.3;
  if (validPace === 'fast') return 14;
  return 10; // moderate
};

/**
 * Calculate calories burned for running using MET formula
 */
export const calculateRunCalories = (distanceKm: number, weight: number, pace: string): number => {
  const weightKg = Math.max(40, Math.min(200, weight || 70));
  const validDistance = Math.max(0.1, distanceKm);
  
  const speed = getRunSpeed(pace);
  const met = getRunMET(pace);
  const timeHours = Math.max(0.1, validDistance / speed);
  
  return Math.round(met * weightKg * timeHours);
};

/**
 * Calculate route metrics for running
 */
export const calculateRunRouteMetrics = (
  distance: number, 
  planningData: PlanningData
) => {
  const validDistance = Math.max(0.1, Math.min(100, distance));
  
  const calories = calculateRunCalories(validDistance, planningData.weight, planningData.pace);
  const speed = getRunSpeed(planningData.pace);
  const durationMin = Math.round((validDistance / speed) * 60);
  
  const strideLength = getRunStrideLength(planningData.height, planningData.pace);
  const steps = Math.round((validDistance * 1000) / strideLength);
  
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
 * Generate random coordinates around a center point using geographic projection
 */
export const generateRandomCoordinates = (
  center: Coordinates,
  maxRadiusKm: number
): Coordinates => {
  const angle = Math.random() * 2 * Math.PI;
  const radius = Math.sqrt(Math.random()) * maxRadiusKm;
  
  const R = 6371; // Earth radius in km
  const userLatRad = center.lat * Math.PI / 180;
  
  const deltaLat = (radius * Math.cos(angle)) / R;
  const deltaLng = (radius * Math.sin(angle)) / (R * Math.cos(userLatRad));
  
  return {
    lat: center.lat + (deltaLat * 180 / Math.PI),
    lng: center.lng + (deltaLng * 180 / Math.PI)
  };
};
