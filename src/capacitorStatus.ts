// src/capacitorStatus.ts
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

export async function configureStatusBarOverlay() {
  // Only run on native platforms
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Allow webview to draw under the status bar
    await StatusBar.setOverlaysWebView({ overlay: true });
    // Set icon style (Light for white icons)
    await StatusBar.setStyle({ style: Style.Light });
    // Set background color (optional, for native side)
    await StatusBar.setBackgroundColor({ color: '#10b981' });
    console.log('StatusBar overlay configured');
  } catch (err) {
    console.warn('StatusBar plugin failed:', err);
  }
}
