// Centralized route calculation helpers
export interface PlanningData {
  steps: string;
  pace: 'slow' | 'moderate' | 'fast';
  tripType: 'one-way' | 'round-trip';
  height: string;
  weight: string;
}

// Stride length calculation helper
export const calculateStrideLength = (heightCm: number): number => {
  return heightCm * 0.45; // Average stride length formula
};

// Convert distance to steps
export const stepsFromKm = (distanceKm: number, heightCm: number): number => {
  const strideLength = calculateStrideLength(heightCm);
  const distanceInCm = distanceKm * 100000;
  return Math.round(distanceInCm / strideLength);
};

// Calculate walking speed based on pace
export const calculateSpeed = (pace: 'slow' | 'moderate' | 'fast'): number => {
  const paceMultiplier = {
    'slow': 0.8,    // 4 km/h
    'moderate': 1.0, // 5 km/h  
    'fast': 1.25    // 6.25 km/h
  };
  
  const baseSpeedKmh = 5;
  return baseSpeedKmh * paceMultiplier[pace];
};

// Calculate time based on distance and pace
export const calculateTime = (distanceKm: number, pace: 'slow' | 'moderate' | 'fast'): number => {
  const speedKmh = calculateSpeed(pace);
  return Math.round((distanceKm / speedKmh) * 60); // in minutes
};

// Calorie coefficient based on pace
export const getCalorieCoef = (pace: 'slow' | 'moderate' | 'fast'): number => {
  const paceMultiplier = {
    'slow': 0.8,
    'moderate': 1.0,
    'fast': 1.2
  };
  
  // MET values for walking at different paces
  return 3.5 * paceMultiplier[pace];
};

// Calculate calories burned
export const calculateCalories = (distanceKm: number, timeMinutes: number, weight: number, pace: 'slow' | 'moderate' | 'fast'): number => {
  const met = getCalorieCoef(pace);
  return Math.round((met * weight * (timeMinutes / 60)));
};

// Check if route is within ±5% tolerance of target steps
export const inBand = (actualSteps: number, targetSteps: number, tolerance: number = 0.05): boolean => {
  const toleranceValue = targetSteps * tolerance;
  return Math.abs(actualSteps - targetSteps) <= toleranceValue;
};

// Calculate destination point given start, distance and bearing
export const calculateDestination = (startLat: number, startLng: number, distanceKm: number, bearing: number) => {
  const R = 6371; // Earth's radius in km
  const lat1 = (startLat * Math.PI) / 180;
  const lng1 = (startLng * Math.PI) / 180;
  const bearingRad = (bearing * Math.PI) / 180;
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceKm / R) +
    Math.cos(lat1) * Math.sin(distanceKm / R) * Math.cos(bearingRad)
  );
  
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(distanceKm / R) * Math.cos(lat1),
    Math.cos(distanceKm / R) - Math.sin(lat1) * Math.sin(lat2)
  );
  
  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI
  };
};

// Generate lateral waypoint for different return path
export const generateLateralWaypoint = (destLat: number, destLng: number, startLat: number, startLng: number, angle: number, distance: number = 200) => {
  // Calculate perpendicular bearing
  const bearing = Math.atan2(destLng - startLng, destLat - startLat) * 180 / Math.PI;
  const lateralBearing = bearing + angle;
  
  // Convert distance from meters to km
  const distanceKm = distance / 1000;
  
  return calculateDestination(destLat, destLng, distanceKm, lateralBearing);
};