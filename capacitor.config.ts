import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Source of truth for the native shell.
 * `npx cap sync` serialises this file to
 *   android/app/src/main/assets/capacitor.config.json
 * and `npm run cap:sync` validates the generated JSON afterwards
 * (scripts/validate-cap-config.mjs) so a malformed config can never
 * reach a device and cause a white screen.
 */
const config: CapacitorConfig = {
  appId: 'com.raccoonskyjump.game',
  appName: 'Raccoon Sky Jump',
  webDir: 'dist',

  android: {
    // RELEASE-SAFE: WebView debugging is OFF by default. To inspect on a dev
    // device temporarily set true, run `npx cap sync android`, then revert.
    webContentsDebuggingEnabled: false,
    backgroundColor: '#1a1030',
    allowMixedContent: false,
  },

  ios: {
    contentInset: 'never',
    backgroundColor: '#1a1030',
    preferredContentMode: 'mobile',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#1a1030',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1030',
      overlaysWebView: false,
    },
    // ---- Placeholders for the real SDKs (see src/game/ads.ts / firebase.ts) ----
    // AdMob: {                     // @capacitor-community/admob
    //   appId: { android: 'ca-app-pub-XXXX~YYYY', ios: 'ca-app-pub-XXXX~ZZZZ' },
    //   initializeForTesting: true,
    // },
  },
};

export default config;
