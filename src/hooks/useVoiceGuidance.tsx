import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface VoiceGuidanceOptions {
  enabled: boolean;
  announcementInterval: number; // in meters (250, 500, 1000, 2000)
}

export const useVoiceGuidance = (options: VoiceGuidanceOptions) => {
  const { i18n } = useTranslation();
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const lastAnnouncementRef = useRef<number>(0);
  const isAnnouncingRef = useRef<boolean>(false);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    } else {
      console.warn('Speech synthesis not supported in this browser');
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const getVoice = useCallback(() => {
    if (!synthRef.current) return null;

    const voices = synthRef.current.getVoices();
    
    // Check if user has selected a specific voice
    const selectedVoiceName = localStorage.getItem('selectedVoiceName');
    if (selectedVoiceName) {
      const selectedVoice = voices.find(v => v.name === selectedVoiceName);
      if (selectedVoice) return selectedVoice;
    }

    // Fallback to automatic selection based on language
    const lang = i18n.language;
    let voice = voices.find(v => v.lang.startsWith(lang));
    
    if (!voice && lang.startsWith('fr')) {
      voice = voices.find(v => v.lang.startsWith('fr'));
    } else if (!voice && lang.startsWith('en')) {
      voice = voices.find(v => v.lang.startsWith('en'));
    }

    return voice || voices[0];
  }, [i18n.language]);

  const speak = useCallback((text: string, priority: 'low' | 'high' = 'low') => {
    if (!options.enabled || !synthRef.current || !text) return;

    // Cancel ongoing announcements if high priority
    if (priority === 'high' && isAnnouncingRef.current) {
      synthRef.current.cancel();
      isAnnouncingRef.current = false;
    }

    // Don't overlap announcements
    if (isAnnouncingRef.current) return;

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getVoice();
    
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    
    utterance.rate = 0.95; // Slightly slower for better clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      isAnnouncingRef.current = true;
      console.log('🔊 Voice guidance:', text);
    };

    utterance.onend = () => {
      isAnnouncingRef.current = false;
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      isAnnouncingRef.current = false;
    };

    synthRef.current.speak(utterance);
  }, [options.enabled, getVoice]);

  // Distance announcements
  const announceDistance = useCallback((totalDistance: number) => {
    if (!options.enabled) return;

    const distanceInMeters = Math.floor(totalDistance);
    const interval = options.announcementInterval;

    // Check if we've reached an announcement interval
    const shouldAnnounce = 
      distanceInMeters > 0 && 
      distanceInMeters % interval === 0 &&
      distanceInMeters !== lastAnnouncementRef.current;

    if (shouldAnnounce) {
      lastAnnouncementRef.current = distanceInMeters;
      
      const distanceInKm = (distanceInMeters / 1000).toFixed(1);
      const text = i18n.language.startsWith('fr')
        ? `${distanceInKm} kilomètre${parseFloat(distanceInKm) > 1 ? 's' : ''} parcouru${parseFloat(distanceInKm) > 1 ? 's' : ''}`
        : i18n.language.startsWith('es')
        ? `${distanceInKm} kilómetro${parseFloat(distanceInKm) > 1 ? 's' : ''} recorrido${parseFloat(distanceInKm) > 1 ? 's' : ''}`
        : `${distanceInKm} kilometer${parseFloat(distanceInKm) > 1 ? 's' : ''} completed`;
      
      speak(text);
    }
  }, [options.enabled, options.announcementInterval, speak, i18n.language]);

  // Pace announcements
  const announcePace = useCallback((pace: number) => {
    if (!options.enabled) return;

    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    
    const text = i18n.language.startsWith('fr')
      ? `Allure actuelle : ${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} seconde${seconds > 1 ? 's' : ''} par kilomètre`
      : i18n.language.startsWith('es')
      ? `Ritmo actual: ${minutes} minuto${minutes > 1 ? 's' : ''} ${seconds} segundo${seconds > 1 ? 's' : ''} por kilómetro`
      : `Current pace: ${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds > 1 ? 's' : ''} per kilometer`;
    
    speak(text);
  }, [options.enabled, speak, i18n.language]);

  // Navigation instructions
  const announceNavigation = useCallback((instruction: string, distanceToTurn?: number) => {
    if (!options.enabled) return;

    let text = '';
    
    if (distanceToTurn && distanceToTurn > 50) {
      const distance = Math.round(distanceToTurn);
      const distanceText = i18n.language.startsWith('fr')
        ? `dans ${distance} mètres`
        : i18n.language.startsWith('es')
        ? `en ${distance} metros`
        : `in ${distance} meters`;
      
      text = `${instruction} ${distanceText}`;
    } else {
      const now = i18n.language.startsWith('fr')
        ? 'maintenant'
        : i18n.language.startsWith('es')
        ? 'ahora'
        : 'now';
      
      text = `${instruction} ${now}`;
    }
    
    speak(text, 'high'); // High priority for navigation
  }, [options.enabled, speak, i18n.language]);

  // Session events
  const announceStart = useCallback(() => {
    const text = i18n.language.startsWith('fr')
      ? 'Parcours démarré'
      : i18n.language.startsWith('es')
      ? 'Recorrido iniciado'
      : 'Activity started';
    
    speak(text, 'high');
  }, [speak, i18n.language]);

  const announcePause = useCallback(() => {
    const text = i18n.language.startsWith('fr')
      ? 'Parcours en pause'
      : i18n.language.startsWith('es')
      ? 'Recorrido pausado'
      : 'Activity paused';
    
    speak(text, 'high');
  }, [speak, i18n.language]);

  const announceResume = useCallback(() => {
    const text = i18n.language.startsWith('fr')
      ? 'Reprise du parcours'
      : i18n.language.startsWith('es')
      ? 'Reanudando recorrido'
      : 'Activity resumed';
    
    speak(text, 'high');
  }, [speak, i18n.language]);

  const announceComplete = useCallback((distance: number, duration: number) => {
    const distanceInKm = (distance / 1000).toFixed(1);
    const minutes = Math.floor(duration / 60);
    
    const text = i18n.language.startsWith('fr')
      ? `Parcours terminé. ${distanceInKm} kilomètres en ${minutes} minutes`
      : i18n.language.startsWith('es')
      ? `Recorrido completado. ${distanceInKm} kilómetros en ${minutes} minutos`
      : `Activity completed. ${distanceInKm} kilometers in ${minutes} minutes`;
    
    speak(text, 'high');
  }, [speak, i18n.language]);

  // Alerts
  const announceOffRoute = useCallback(() => {
    const text = i18n.language.startsWith('fr')
      ? 'Vous vous éloignez de l\'itinéraire'
      : i18n.language.startsWith('es')
      ? 'Te estás alejando de la ruta'
      : 'You are moving away from the route';
    
    speak(text, 'high');
  }, [speak, i18n.language]);

  const announceGPSIssue = useCallback(() => {
    const text = i18n.language.startsWith('fr')
      ? 'Signal GPS faible'
      : i18n.language.startsWith('es')
      ? 'Señal GPS débil'
      : 'Weak GPS signal';
    
    speak(text, 'high');
  }, [speak, i18n.language]);

  return {
    announceDistance,
    announcePace,
    announceNavigation,
    announceStart,
    announcePause,
    announceResume,
    announceComplete,
    announceOffRoute,
    announceGPSIssue,
  };
};
