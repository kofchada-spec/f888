import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fitpas.app',
  appName: 'Fitpas',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // url: 'https://8af8d277-c44b-4c95-a879-2e40739d5fe8.lovableproject.com?forceHideBadge=true',
    // cleartext: true
  },
  plugins: {
    Motion: {
      interval: 1000
    },
    BackgroundGeolocation: {
      notificationTitle: "Suivi d'activité Fitpas",
      notificationText: "Votre parcours est enregistré",
      notificationChannelName: "Suivi GPS",
      requestPermissions: true,
      backgroundMessage: "Suivi actif en arrière-plan"
    }
  },
  ios: {
    contentInset: 'always',
    infoPlist: {
      NSLocationAlwaysAndWhenInUseUsageDescription: "Fitpas needs access to your location at all times to provide continuous route tracking during your walks and runs, even when the app is in the background. This allows us to accurately record your complete route, calculate distances, track your progress in real-time, and provide turn-by-turn navigation guidance throughout your entire workout session.",
      NSLocationWhenInUseUsageDescription: "Fitpas needs access to your location to generate personalized walking and running routes based on your current position. We use your location to plan optimal routes, track your real-time progress during activities, calculate distances and speed, and provide accurate navigation to help you reach your fitness destinations."
    }
  }
};

export default config;