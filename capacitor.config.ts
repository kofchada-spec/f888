import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.8af8d277c44b4c95a8792e40739d5fe8',
  appName: 'fitpas',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://8af8d277-c44b-4c95-a879-2e40739d5fe8.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Motion: {
      interval: 1000
    }
  }
};

export default config;