import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chalkboard.canvas',
  appName: 'Chalkboard',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
