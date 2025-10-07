import { useState, useEffect, useCallback, useRef } from 'react';

export interface GPSPosition {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

interface UseGPSTrackingProps {
  isTracking: boolean;
  onPositionUpdate?: (position: GPSPosition) => void;
}

/**
 * Hook for real-time GPS tracking with path recording
 * Records user's path and calculates real distance traveled
 */
export const useGPSTracking = ({ isTracking, onPositionUpdate }: UseGPSTrackingProps) => {
  const [currentPosition, setCurrentPosition] = useState<GPSPosition | null>(null);
  const [pathCoordinates, setPathCoordinates] = useState<[number, number][]>([]);
  const [totalDistance, setTotalDistance] = useState(0); // in kilometers
  const [currentSpeed, setCurrentSpeed] = useState(0); // in km/h
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<GPSPosition | null>(null);

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   */
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  /**
   * Calculate current speed based on recent positions
   */
  const calculateSpeed = useCallback((distance: number, timeDiffSeconds: number): number => {
    if (timeDiffSeconds === 0) return 0;
    const speedKmh = (distance / timeDiffSeconds) * 3600; // Convert to km/h
    return speedKmh;
  }, []);

  /**
   * Handle new GPS position
   */
  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const newPosition: GPSPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: position.timestamp,
      accuracy: position.coords.accuracy
    };

    setCurrentPosition(newPosition);
    
    // Add to path coordinates
    setPathCoordinates(prev => [...prev, [newPosition.lng, newPosition.lat]]);

    // Calculate distance and speed if we have a previous position
    if (lastPositionRef.current) {
      const distance = calculateDistance(
        lastPositionRef.current.lat,
        lastPositionRef.current.lng,
        newPosition.lat,
        newPosition.lng
      );

      // Only update if distance is significant (more than 5 meters to filter GPS noise)
      if (distance > 0.005) {
        setTotalDistance(prev => prev + distance);

        // Calculate speed
        const timeDiff = (newPosition.timestamp - lastPositionRef.current.timestamp) / 1000;
        const speed = calculateSpeed(distance, timeDiff);
        
        // Smooth speed updates (filter unrealistic values)
        if (speed < 50) { // Max 50 km/h to filter GPS errors
          setCurrentSpeed(speed);
        }
      }
    }

    lastPositionRef.current = newPosition;
    onPositionUpdate?.(newPosition);
  }, [calculateDistance, calculateSpeed, onPositionUpdate]);

  /**
   * Start GPS tracking
   */
  useEffect(() => {
    if (isTracking && navigator.geolocation) {
      console.log('🛰️ Starting GPS tracking');
      
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        (error) => {
          console.error('GPS tracking error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000
        }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        console.log('🛑 Stopping GPS tracking');
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isTracking, handlePositionUpdate]);

  /**
   * Reset tracking data
   */
  const resetTracking = useCallback(() => {
    setPathCoordinates([]);
    setTotalDistance(0);
    setCurrentSpeed(0);
    setCurrentPosition(null);
    lastPositionRef.current = null;
  }, []);

  return {
    currentPosition,
    pathCoordinates,
    totalDistance,
    currentSpeed,
    resetTracking
  };
};
