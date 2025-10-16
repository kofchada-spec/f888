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
      NSLocationWhenInUseUsageDescription: "Fitpas utilise votre position GPS pour planifier et afficher vos itinéraires de marche et de course en temps réel.",
      NSLocationAlwaysAndWhenInUseUsageDescription: "Fitpas suit votre parcours GPS en arrière-plan pendant vos activités de marche et de course pour enregistrer votre trajet et calculer la distance parcourue.",
      NSMotionUsageDescription: "Fitpas utilise les capteurs de mouvement pour détecter et compter vos pas pendant vos activités physiques.",
      UIBackgroundModes: ["location"]
    }
  }
};

export default config;