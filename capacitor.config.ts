import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.toonystank.slpostdirectory',
  appName: 'Lanka Post',
  webDir: 'out',
  backgroundColor: '#FBF7EF',
  android: {
    backgroundColor: '#FBF7EF',
  },
  ios: {
    backgroundColor: '#FBF7EF',
    contentInset: 'never',
  },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-3940256099942544~3347511713', // Test App ID
    }
  }
};

export default config;
