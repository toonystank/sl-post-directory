import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.toonystank.slpostdirectory',
  appName: 'sl-post-directory',
  webDir: 'out',
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-3940256099942544~3347511713', // Test App ID
    }
  }
};

export default config;
