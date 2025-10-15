import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/**
 * Haptic feedback utilities for creating tactile sensations
 */
export const haptics = {
  /**
   * Light tap - for subtle interactions
   */
  light: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  },

  /**
   * Medium tap - for standard interactions
   */
  medium: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
  },

  /**
   * Heavy tap - for important actions
   */
  heavy: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }
  },

  /**
   * Success notification - for completed actions
   */
  success: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Success });
    }
  },

  /**
   * Warning notification - for cautionary actions
   */
  warning: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Warning });
    }
  },

  /**
   * Error notification - for failed actions
   */
  error: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.notification({ type: NotificationType.Error });
    }
  },

  /**
   * Selection changed - for picker interactions
   */
  selection: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.selectionStart();
      setTimeout(() => Haptics.selectionEnd(), 50);
    }
  },

  /**
   * Celebration - multiple taps for achievements
   */
  celebrate: async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Light }), 100);
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 200);
    }
  }
};
