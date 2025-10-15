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
      NSLocationAlwaysAndWhenInUseUsageDescription: "FitPaS a besoin d'accéder à votre position en permanence pour assurer le suivi continu de vos itinéraires de marche et de course, même lorsque l'application est en arrière-plan. Cela nous permet d'enregistrer avec précision votre parcours complet, de calculer les distances parcourues, de suivre votre progression en temps réel et de vous fournir des indications de navigation étape par étape tout au long de votre séance d'entraînement.",
      NSLocationWhenInUseUsageDescription: "FitPaS a besoin d'accéder à votre position pour générer des itinéraires de marche et de course personnalisés en fonction de votre position actuelle. Nous utilisons votre localisation pour planifier des itinéraires optimaux, suivre votre progression en temps réel pendant vos activités, calculer les distances et la vitesse, et vous fournir une navigation précise pour vous aider à atteindre vos objectifs de remise en forme.",
      NSMotionUsageDescription: "FitPaS utilise les capteurs de mouvement pour détecter vos mouvements et compter vos pas, ce qui améliore la précision du suivi de la distance et de la surveillance de l'activité pendant vos marches et courses."
    }
  }
};

export default config;