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
      NSLocationAlwaysAndWhenInUseUsageDescription: "Fitpas enregistre votre parcours en arrière-plan pour suivre vos activités.",
      NSLocationWhenInUseUsageDescription: "Fitpas utilise votre position pour créer des itinéraires adaptés, suivre votre progression en temps réel et compter vos pas pendant vos activités.",
      NSMotionUsageDescription: "Fitpas utilise le capteur de mouvement pour compter vos pas avec précision pendant vos activités de marche et course.",
      UIBackgroundModes: ["location"]
    }
  }
};

export default config;