/**
 * Thin Capacitor wrapper.
 * Every call is a no-op in a normal browser, so `npm run dev` and the
 * web build keep working exactly as before.
 */
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'web' | 'android' | 'ios'

/** Status bar colours + hide the splash once React has painted the first frame. */
export async function initNativeShell(): Promise<void> {
  if (!isNative) return;
  try {
    // overlay:false => the WebView starts *below* the status bar, so the HUD
    // can never end up underneath the clock / battery icons.
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark });
    if (platform === 'android') await StatusBar.setBackgroundColor({ color: '#1a1030' });
  } catch { /* status bar unavailable (e.g. tablet kiosk) */ }
  try {
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch { /* no splash configured */ }
}

/** Android hardware / gesture back button. Returns an unsubscribe function. */
export function onBackButton(handler: () => void): () => void {
  if (!isNative) return () => undefined;
  const handle = CapApp.addListener('backButton', handler);
  return () => { handle.then((h) => h.remove()).catch(() => undefined); };
}

/** Fires when the app is sent to the background / brought back. */
export function onAppStateChange(handler: (isActive: boolean) => void): () => void {
  if (!isNative) return () => undefined;
  const handle = CapApp.addListener('appStateChange', ({ isActive }) => handler(isActive));
  return () => { handle.then((h) => h.remove()).catch(() => undefined); };
}

export async function exitApp(): Promise<void> {
  if (!isNative) return;
  try { await CapApp.exitApp(); } catch { /* ignore */ }
}
