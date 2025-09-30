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
 * Calculate target distance based on steps and user height with validation
 */
export const calculateTargetDistance = (steps: number, height: number, activityType: 'walk' | 'run' = 'walk', pace: string = 'moderate'): number => {
  const stepCount = Math.max(1000, steps || 10000); // Min 1000 steps
  const heightInMeters = Math.max(1.2, Math.min(2.5, height || 1.70)); // Height range 1.2-2.5m
  
  let strideLength: number;
  if (activityType === 'run') {
    // Course : foulée selon l'allure
    strideLength = pace === 'slow' ? 0.65 * heightInMeters 
                 : pace === 'fast' ? 1.1 * heightInMeters 
                 : 0.9 * heightInMeters; // moderate
  } else {
    strideLength = 0.415 * heightInMeters;
  }
  
  return (stepCount * strideLength) / 1000; // km
};

/**
 * Calculate calories based on distance, weight, and pace with validation
 */
export const calculateCalories = (distanceKm: number, weight: number, pace: string, activityType: 'walk' | 'run' = 'walk'): number => {
  const weightKg = Math.max(40, Math.min(200, weight || 70)); // Weight range 40-200kg
  const validPace = ['slow', 'moderate', 'fast'].includes(pace) ? pace : 'moderate';
  
  if (activityType === 'run') {
    // MET (Metabolic Equivalent of Task) selon la vitesse
    const speed = validPace === 'slow' ? 8 : validPace === 'moderate' ? 11 : 15;
    const met = validPace === 'slow' ? 8.3 : validPace === 'moderate' ? 10 : 14;
    const timeHours = Math.max(0.1, distanceKm / speed);
    return Math.round(met * weightKg * timeHours);
  } else {
    // Calcul pour la marche (existant)
    const met = validPace === 'slow' ? 3.0 : validPace === 'moderate' ? 4.0 : 5.0;
    const speed = validPace === 'slow' ? 4 : validPace === 'moderate' ? 5 : 6;
    const timeHours = Math.max(0.1, distanceKm / speed); // Minimum 0.1 hours
    return Math.round(met * weightKg * timeHours);
  }
};

/**
 * Calculate route metrics with input validation
 */
export const calculateRouteMetrics = (
  distance: number, 
  planningData: PlanningData,
  activityType: 'walk' | 'run' = 'walk'
) => {
  // Validate distance
  const validDistance = Math.max(0.1, Math.min(100, distance)); // 0.1km to 100km range
  
  const calories = calculateCalories(validDistance, planningData.weight, planningData.pace, activityType);
  const validPace = ['slow', 'moderate', 'fast'].includes(planningData.pace) ? planningData.pace : 'moderate';
  
  // Vitesses différentes pour marche et course
  const speed = activityType === 'run'
    ? (validPace === 'slow' ? 8 : validPace === 'moderate' ? 11 : 15)
    : (validPace === 'slow' ? 4 : validPace === 'moderate' ? 5 : 6);
  const durationMin = Math.round((validDistance / speed) * 60);
  
  // Calculate steps with height validation
  const heightInMeters = Math.max(1.2, Math.min(2.5, planningData.height || 1.70));
  let strideLength: number;
  if (activityType === 'run') {
    strideLength = validPace === 'slow' ? 0.65 * heightInMeters 
                 : validPace === 'fast' ? 1.1 * heightInMeters 
                 : 0.9 * heightInMeters; // moderate
  } else {
    strideLength = 0.415 * heightInMeters;
  }
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
 * Generate random coordinates around a center point using more accurate geographic projection
 */
export const generateRandomCoordinates = (
  center: Coordinates,
  maxRadiusKm: number
): Coordinates => {
  // Use proper polar coordinate generation for more uniform distribution
  const angle = Math.random() * 2 * Math.PI;
  // Square root for uniform area distribution
  const radius = Math.sqrt(Math.random()) * maxRadiusKm;
  
  // More accurate Earth radius and coordinate conversion
  const R = 6371; // Earth radius in km
  const userLatRad = center.lat * Math.PI / 180;
  
  const deltaLat = (radius * Math.cos(angle)) / R;
  const deltaLng = (radius * Math.sin(angle)) / (R * Math.cos(userLatRad));
  
  return {
    lat: center.lat + (deltaLat * 180 / Math.PI),
    lng: center.lng + (deltaLng * 180 / Math.PI)
  };
};