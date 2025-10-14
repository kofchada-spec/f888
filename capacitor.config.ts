import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fitpas.app',
  appName: 'Fitpas',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://8af8d277-c44b-4c95-a879-2e40739d5fe8.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Motion: {
      interval: 1000
    },
    BackgroundGeolocation: {
      notificationTitle: "Suivi d'activité en cours",
      notificationText: "Votre parcours est enregistré",
      notificationChannelName: "Suivi GPS",
      requestPermissions: true,
      backgroundMessage: "Tracking actif en arrière-plan"
    }
  },
  ios: {
    contentInset: 'always',
    infoPlist: {
      NSLocationAlwaysAndWhenInUseUsageDescription: "Fitpas utilise votre position pour suivre vos parcours de marche et de course, même lorsque l'application est en arrière-plan, afin d'enregistrer votre activité physique avec précision.",
      NSLocationWhenInUseUsageDescription: "Fitpas a besoin d'accéder à votre position pour calculer vos itinéraires de marche et de course et suivre votre progression en temps réel."
    }
  }
};

export default config;