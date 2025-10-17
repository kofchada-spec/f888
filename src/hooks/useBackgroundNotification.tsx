import { useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

interface UseBackgroundNotificationProps {
  isTracking: boolean;
  activityType: 'walk' | 'run';
  distance?: number;
  duration?: number;
  currentSteps?: number;
  targetSteps?: number;
  remainingDistance?: number;
}

export const useBackgroundNotification = ({
  isTracking,
  activityType,
  distance = 0,
  duration = 0,
  currentSteps = 0,
  targetSteps = 0,
  remainingDistance = 0
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

      let notificationBody = '';

      if (activityType === 'walk') {
        // Pour la marche : afficher les pas effectués et restants
        const stepsRemaining = targetSteps > 0 ? Math.max(0, targetSteps - currentSteps) : 0;
        const stepsText = `${currentSteps.toLocaleString()} pas`;
        const remainingText = stepsRemaining > 0 
          ? `${stepsRemaining.toLocaleString()} restants` 
          : 'Objectif atteint !';
        
        notificationBody = `${stepsText} • ${remainingText}\n${distanceText} • ${timeText}`;
      } else {
        // Pour la course : afficher la distance et la vitesse
        const remainingKm = remainingDistance > 0 ? `${remainingDistance.toFixed(2)} km restants` : 'Arrivée proche';
        notificationBody = `${distanceText} parcourus • ${timeText}\n${remainingKm}`;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 1,
            title: activityType === 'walk' ? "Marche en cours 🚶" : "Course en cours 🏃",
            body: notificationBody,
            ongoing: true,
            autoCancel: false,
            extra: {
              activityType,
              distance,
              duration,
              currentSteps,
              targetSteps
            }
          }
        ]
      });
    };

    // Mettre à jour toutes les 30 secondes
    const interval = setInterval(updateNotification, 30000);

    return () => clearInterval(interval);
  }, [isTracking, distance, duration, currentSteps, targetSteps, remainingDistance, isNative, activityType]);

  return null;
};
