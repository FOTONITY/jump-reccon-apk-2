/**
 * AdMob integration for Raccoon Sky Jump
 * --------------------------------------
 * Game code calls `ads.*` only. Three adapters implement `AdsAdapter`:
 *
 *   • LiveAdMobAdapter  — real @capacitor-community/admob on a native shell.
 *                         Selected when running natively AND production unit
 *                         IDs exist in .env (VITE_ADMOB_<PLATFORM>_*) or, in
 *                         DEV builds only, Google's public test units.
 *   • MockAdsAdapter    — simulated ads, DEV BUILDS ONLY (browser preview).
 *                         Clearly labelled TEST; never compiled into
 *                         production reward paths (see selection below).
 *   • DisabledAdsAdapter— production without configured units: every call
 *                         resolves harmlessly, no UI, no reward. The game
 *                         continues normally when ads are unavailable.
 *
 * Safety rules baked in:
 *   - Rewarded rewards resolve true ONLY when the SDK fires its `Rewarded`
 *     callback (or, in dev mock, when the labelled TEST overlay completes).
 *   - Test unit IDs are unreachable in production builds (import.meta.env.DEV).
 *   - Interstitial cadence: every 3rd completed run, skipped with Remove-Ads.
 *   - Banner only on menus; the reserved --ad-h slot keeps it clear of controls.
 *   - UMP consent (requestConsentInfo/showConsentForm) runs at init on native.
 */
import { AdMob, BannerAdPluginEvents, BannerAdPosition, BannerAdSize, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { PluginListenerHandle } from '@capacitor/core';
import type { RewardType } from './types';
import { EV, trackEvent } from './firebase';
import { isNative, platform } from '../native';

// ------------------------------------------------------------------ config
const env = (import.meta as unknown as { env: Record<string, unknown> }).env || {};
/** Vite dev-server / dev build flag (boolean at runtime). */
const isDevBuild = (): boolean => env.DEV === true || env.DEV === 'true';

export interface AdUnitIds { banner: string; interstitial: string; rewarded: string; }

/** Google's public TEST units. Reachable in DEV builds only. */
const TEST_IDS: Record<'android' | 'ios', AdUnitIds> = {
  android: { banner: 'ca-app-pub-3940256099942544/6300978111', interstitial: 'ca-app-pub-3940256099942544/1033173712', rewarded: 'ca-app-pub-3940256099942544/5224354917' },
  ios: { banner: 'ca-app-pub-3940256099942544/2934735716', interstitial: 'ca-app-pub-3940256099942544/4411468910', rewarded: 'ca-app-pub-3940256099942544/1712485313' },
};

/**
 * Production units come exclusively from .env. In DEV, fall back to Google's
 * test units so device testing works out of the box. Production builds NEVER
 * fall back to test units.
 */
export function readAdUnitIds(): AdUnitIds | null {
  const p = platform === 'ios' ? 'IOS' : 'ANDROID';
  const str = (k: string) => (typeof env[k] === 'string' ? (env[k] as string) : '');
  const ids: AdUnitIds = {
    banner: str(`VITE_ADMOB_${p}_BANNER`),
    interstitial: str(`VITE_ADMOB_${p}_INTERSTITIAL`),
    rewarded: str(`VITE_ADMOB_${p}_REWARDED`),
  };
  if (ids.banner && ids.interstitial && ids.rewarded) return ids;
  if (isDevBuild()) return TEST_IDS[platform === 'ios' ? 'ios' : 'android'];
  return null;
}
export const isAdMobConfigured = (): boolean => isNative && readAdUnitIds() !== null;

export const INTERSTITIAL_EVERY_N_RUNS = 3;
export const BANNER_HEIGHT = 50; // dp — standard AdMob adaptive banner on phones
export const REMOVE_ADS_PRICE = 1500; // coins (economy unchanged; swap for IAP later if desired)

// ------------------------------------------------------------------ store (observable by React)
export interface PendingAd { kind: 'interstitial' | 'rewarded'; rewardType?: RewardType; seconds: number; }
export interface AdsState { bannerVisible: boolean; pending: PendingAd | null; }
type Listener = (s: AdsState) => void;

class AdsStore {
  private state: AdsState = { bannerVisible: false, pending: null };
  private listeners = new Set<Listener>();
  private resolver: ((completed: boolean) => void) | null = null;
  get() { return this.state; }
  subscribe(l: Listener) { this.listeners.add(l); return () => { this.listeners.delete(l); }; }
  private set(patch: Partial<AdsState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((l) => l(this.state)); }
  setBanner(v: boolean) { if (this.state.bannerVisible !== v) this.set({ bannerVisible: v }); }
  /** Opens the simulated (DEV-only) ad and returns a promise the overlay resolves. */
  open(p: PendingAd): Promise<boolean> {
    this.close(false);
    this.set({ pending: p });
    return new Promise<boolean>((res) => { this.resolver = res; });
  }
  /** Called by <AdOverlay/> when the user finishes or skips. */
  close(completed: boolean) {
    const r = this.resolver; this.resolver = null;
    if (this.state.pending) this.set({ pending: null });
    r?.(completed);
  }
}
export const adsStore = new AdsStore();

// ------------------------------------------------------------------ adapter contract
export interface AdsAdapter {
  readonly mode: 'live' | 'mock' | 'disabled';
  init(): Promise<void>;
  showBanner(): Promise<void>;
  hideBanner(): Promise<void>;
  /** Resolves when the ad is closed (true) or could not be shown (false). */
  showInterstitial(): Promise<boolean>;
  /** Resolves true only if the real rewarded callback confirmed the reward. */
  showRewarded(type: RewardType): Promise<boolean>;
}

// ------------------------------------------------------------------ LIVE (real AdMob)
class LiveAdMobAdapter implements AdsAdapter {
  readonly mode = 'live' as const;
  private units: AdUnitIds;
  private ready: Promise<void>;
  constructor(units: AdUnitIds) { this.units = units; this.ready = this.boot(); }

  /** Initialize SDK + UMP consent. Never throws: any failure leaves ready resolved
      but subsequent calls fail soft (resolve false), so gameplay continues. */
  private async boot(): Promise<void> {
    try {
      await AdMob.initialize();
      try {
        const info = await AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable) await AdMob.showConsentForm();
      } catch (e) { console.warn('[admob] consent flow unavailable', e); }
      AdMob.addListener(BannerAdPluginEvents.SizeChanged, (s) => adsStore.setBanner((s.height || 0) > 0))
        .catch(() => undefined);
    } catch (e) {
      console.warn('[admob] SDK init failed; ads disabled for this session', e);
      this.units = { banner: '', interstitial: '', rewarded: '' };
    }
  }
  private async usable(): Promise<boolean> {
    await this.ready;
    return isNative && !!this.units.rewarded;
  }

  async init() { await this.ready; }

  async showBanner() {
    if (!(await this.usable())) { adsStore.setBanner(false); return; }
    try {
      await AdMob.showBanner({
        adId: this.units.banner,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
      });
      adsStore.setBanner(true);
    } catch (e) { console.warn('[admob] banner failed', e); adsStore.setBanner(false); }
  }

  async hideBanner() {
    try { if (isNative) await AdMob.hideBanner(); } catch { /* already hidden */ }
    adsStore.setBanner(false);
  }

  async showInterstitial() {
    if (!(await this.usable())) return false;
    try {
      await AdMob.prepareInterstitial({ adId: this.units.interstitial });
      await AdMob.showInterstitial();
      trackEvent(EV.AD_IMPRESSION, { format: 'interstitial', mode: 'live' });
      return true;
    } catch (e) { console.warn('[admob] interstitial unavailable', e); return false; }
  }

  async showRewarded(type: RewardType): Promise<boolean> {
    if (!(await this.usable())) return false;
    const holders: PluginListenerHandle[] = [];
    try {
      let rewarded = false;
      holders.push(await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewarded = true; }));
      const outcome = await new Promise<boolean>((resolve) => {
        let settled = false;
        const done = (v: boolean) => { if (!settled) { settled = true; resolve(v); } };
        AdMob.addListener(RewardAdPluginEvents.Dismissed, () => done(rewarded)).then((h) => holders.push(h));
        AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => done(false)).then((h) => holders.push(h));
        AdMob.prepareRewardVideoAd({ adId: this.units.rewarded })
          .then(() => AdMob.showRewardVideoAd())
          .catch(() => done(false));
      });
      // Reward is granted ONLY because the SDK fired `Rewarded`.
      if (outcome) trackEvent(EV.AD_REWARD, { reward: type, mode: 'live' });
      return outcome;
    } catch (e) {
      console.warn('[admob] rewarded unavailable', e);
      return false;
    } finally {
      for (const h of holders) h.remove().catch(() => undefined);
    }
  }
}

// ------------------------------------------------------------------ MOCK (DEV builds only)
class MockAdsAdapter implements AdsAdapter {
  readonly mode = 'mock' as const;
  async init() { /* nothing to load */ }
  async showBanner() { adsStore.setBanner(true); }
  async hideBanner() { adsStore.setBanner(false); }
  async showInterstitial() {
    trackEvent(EV.AD_IMPRESSION, { format: 'interstitial', mode: 'mock' });
    return adsStore.open({ kind: 'interstitial', seconds: 3 });
  }
  async showRewarded(type: RewardType) {
    trackEvent(EV.AD_IMPRESSION, { format: 'rewarded', reward: type, mode: 'mock' });
    const ok = await adsStore.open({ kind: 'rewarded', rewardType: type, seconds: 5 });
    if (ok) trackEvent(EV.AD_REWARD, { reward: type, mode: 'mock' });
    return ok;
  }
}

// ------------------------------------------------------------------ DISABLED (production without units)
class DisabledAdsAdapter implements AdsAdapter {
  readonly mode = 'disabled' as const;
  async init() { /* no units configured: ads stay off, game runs normally */ }
  async showBanner() { adsStore.setBanner(false); }
  async hideBanner() { adsStore.setBanner(false); }
  async showInterstitial() { return false; }
  async showRewarded(_type: RewardType) { return false; }
}

// ------------------------------------------------------------------ singleton + gated helpers
/**
 * Selection matrix:
 *   native + production units  → LiveAdMobAdapter
 *   native + dev build         → LiveAdMobAdapter with Google test units
 *   web/dev build              → MockAdsAdapter (labelled TEST overlay)
 *   production without units   → DisabledAdsAdapter (no fake ads, no rewards)
 */
const units = readAdUnitIds();
export const ads: AdsAdapter =
  isNative && units ? new LiveAdMobAdapter(units)
    : isDevBuild() ? new MockAdsAdapter()
      : new DisabledAdsAdapter();

/** Call once at startup. Never throws. */
export async function initAds(): Promise<void> { try { await ads.init(); } catch (e) { console.warn('[ads] init failed', e); } }

export async function showBannerAd(removeAds: boolean): Promise<void> {
  if (removeAds) { await ads.hideBanner().catch(() => undefined); return; }
  await ads.showBanner().catch(() => undefined);
}
export async function hideBannerAd(): Promise<void> { await ads.hideBanner().catch(() => undefined); }

/**
 * Interstitial cadence. Returns the new `runsSinceAd` counter so the caller
 * can persist it. Shows nothing when the pass is owned.
 */
export async function maybeShowInterstitialAd(removeAds: boolean, runsSinceAd: number): Promise<{ shown: boolean; runsSinceAd: number }> {
  if (removeAds) return { shown: false, runsSinceAd: 0 };
  const next = runsSinceAd + 1;
  if (next < INTERSTITIAL_EVERY_N_RUNS) return { shown: false, runsSinceAd: next };
  const shown = await ads.showInterstitial().catch(() => false);
  return { shown, runsSinceAd: 0 };
}

/** Rewarded ads are opt-in, so they are NOT gated by removeAds. */
export async function showRewardedAd(type: RewardType): Promise<boolean> {
  try { return await ads.showRewarded(type); } catch (e) { console.warn('[ads] rewarded failed', e); return false; }
}
