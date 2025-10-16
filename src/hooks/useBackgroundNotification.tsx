import { useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

interface UseBackgroundNotificationProps {
  isTracking: boolean;
  activityType: 'walk' | 'run';
  distance?: number;
  duration?: number;
}

export const useBackgroundNotification = ({
  isTracking,
  activityType,
  distance = 0,
  duration = 0
}: UseBackgroundNotificationProps) => {
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isNative) return;

    const setupNotifications = async () => {
      // Demander la permission
      const permission = await LocalNotifications.requestPermissions();
      
      if (permission.display !== 'granted') {
        console.log('Notification permission not granted');
        return;
      }

      if (isTracking) {
        // Afficher la notification de suivi actif
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 1,
              title: activityType === 'walk' ? "Marche en cours 🚶" : "Course en cours 🏃",
              body: "Votre parcours est enregistré en continu",
              ongoing: true, // Notification persistante
              autoCancel: false,
              extra: {
                activityType
              }
            }
          ]
        });
      } else {
        // Annuler la notification quand on arrête
        await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
      }
    };

    setupNotifications();

    return () => {
      // Nettoyer la notification au démontage
      if (isNative) {
        LocalNotifications.cancel({ notifications: [{ id: 1 }] });
      }
    };
  }, [isTracking, isNative, activityType]);

  // Mettre à jour la notification avec les stats
  useEffect(() => {
    if (!isNative || !isTracking) return;

    const updateNotification = async () => {
      const minutes = Math.floor(duration / 60);
      const distanceText = distance > 0 ? `${distance.toFixed(2)} km` : '...';
      const timeText = `${minutes} min`;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 1,
            title: activityType === 'walk' ? "Marche en cours 🚶" : "Course en cours 🏃",
            body: `${distanceText} • ${timeText} - Enregistrement actif`,
            ongoing: true,
            autoCancel: false,
            extra: {
              activityType,
              distance,
              duration
            }
          }
        ]
      });
    };

    // Mettre à jour toutes les 30 secondes
    const interval = setInterval(updateNotification, 30000);

    return () => clearInterval(interval);
  }, [isTracking, distance, duration, isNative, activityType]);

  return null;
};
