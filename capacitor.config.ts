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
      NSLocationAlwaysAndWhenInUseUsageDescription: "Fitpas needs your location to track your walking and running routes in the background, ensuring your entire activity is recorded even when the app is not open.",
      NSLocationWhenInUseUsageDescription: "Fitpas uses your location to create personalized routes, track your real-time progress, and count your steps during activities.",
      NSMotionUsageDescription: "Fitpas uses motion sensors to accurately count your steps during walking and running activities.",
      UIBackgroundModes: ["location"]
    }
  }
};

export default config;