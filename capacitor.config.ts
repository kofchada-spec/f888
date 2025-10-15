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
      NSLocationAlwaysAndWhenInUseUsageDescription: "FitPaS utilise votre position pour planifier des itinéraires de marche et suivre votre activité pendant vos sorties.",
      NSLocationWhenInUseUsageDescription: "FitPaS a besoin de votre position pour créer des itinéraires de marche adaptés depuis votre position actuelle et pour suivre votre progression en temps réel."
    }
  }
};

export default config;