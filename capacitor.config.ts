import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.habit.hibitty',
  appName: 'Hibitty',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#F6F6F6',
      showSpinner: false,
    },
  },
};

export default config;
