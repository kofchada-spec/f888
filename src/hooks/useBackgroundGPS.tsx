import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

export interface BackgroundGPSPosition {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

interface UseBackgroundGPSProps {
  isTracking: boolean;
  onPositionUpdate?: (position: BackgroundGPSPosition) => void;
}

export const useBackgroundGPS = ({ isTracking, onPositionUpdate }: UseBackgroundGPSProps) => {
  const [currentPosition, setCurrentPosition] = useState<BackgroundGPSPosition | null>(null);
  const [isBackgroundEnabled, setIsBackgroundEnabled] = useState(false);

  // Vérifier si on est sur mobile
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isNative || !isTracking) {
      return;
    }

    console.log('🔧 Configuration du suivi GPS en arrière-plan');

    const startBackgroundTracking = async () => {
      try {
        // Démarrer le tracking GPS en arrière-plan avec Geolocation API
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            console.log('📍 Position background reçue:', position);
            
            const gpsPosition: BackgroundGPSPosition = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: position.timestamp,
              accuracy: position.coords.accuracy,
              speed: position.coords.speed || undefined
            };

            setCurrentPosition(gpsPosition);
            onPositionUpdate?.(gpsPosition);
          },
          (error) => {
            console.error('❌ Erreur GPS:', error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );

        setIsBackgroundEnabled(true);
        console.log('✅ Suivi GPS activé:', watchId);

        return watchId;
      } catch (error) {
        console.error('❌ Erreur lors du démarrage du GPS:', error);
      }
    };

    const watcherId = startBackgroundTracking();

    return () => {
      watcherId.then(id => {
        if (id !== undefined) {
          navigator.geolocation.clearWatch(id);
          console.log('🛑 Suivi GPS arrêté');
        }
      });
      setIsBackgroundEnabled(false);
    };
  }, [isNative, isTracking, onPositionUpdate]);

  const stopBackgroundTracking = useCallback(() => {
    setIsBackgroundEnabled(false);
    console.log('🛑 Tracker GPS arrêté');
  }, []);

  return {
    currentPosition,
    isBackgroundEnabled,
    isNative,
    stopBackgroundTracking
  };
};
