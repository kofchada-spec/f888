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
      NSLocationAlwaysAndWhenInUseUsageDescription: "Pour planifier et suivre vos itinéraires de marche et course.",
      NSLocationWhenInUseUsageDescription: "Pour créer des itinéraires adaptés et suivre votre progression.",
      NSMotionUsageDescription: "Pour compter vos pas pendant vos activités.",
      NSHealthShareUsageDescription: "Pour lire vos données de pas depuis Apple Santé.",
      NSHealthUpdateUsageDescription: "Pour enregistrer vos activités dans Apple Santé."
    }
  }
};

export default config;