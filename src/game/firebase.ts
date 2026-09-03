/**
 * Firebase abstraction for Raccoon Sky Jump
 * ------------------------------------------
 * Game code NEVER imports the Firebase SDK directly. It talks to the
 * `firebase` object exported here, which implements `CloudAdapter`.
 *
 *   • No VITE_FIREBASE_* keys  -> MockAdapter  (localStorage, works offline)
 *   • Keys present in .env     -> RealAdapter  (Firebase Web SDK, lazy imports)
 *
 * Local-first rule: save.ts ALWAYS writes localStorage first. Cloud sync is
 * an optional, debounced mirror — losing the network never loses progress.
 *
 * Privacy: analytics collection is OFF until `setAnalyticsConsent(true)`
 * is called by the host app after the player opts in. See RELEASE.md.
 */
import type { SaveData, LeaderboardEntry } from './types';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Analytics } from 'firebase/analytics';

// ------------------------------------------------------------------ types
export type AuthProvider = 'anonymous' | 'google';
export interface CloudUser { uid: string; displayName: string; provider: AuthProvider; photoURL?: string; }
export type AuthListener = (user: CloudUser | null) => void;
export type AnalyticsParams = Record<string, string | number | boolean | undefined>;

export interface CloudAdapter {
  readonly mode: 'live' | 'mock';
  /** Auth */
  currentUser(): CloudUser | null;
  onAuthStateChanged(cb: AuthListener): () => void;
  loginAnonymously(): Promise<CloudUser>;
  linkWithGoogle(): Promise<CloudUser>;
  logout(): Promise<void>;
  /** Firestore */
  saveUserProgress(uid: string, save: SaveData): Promise<void>;
  loadUserProgress(uid: string): Promise<SaveData | null>;
  submitScore(entry: LeaderboardEntry): Promise<void>;
  fetchLeaderboards(limit?: number): Promise<LeaderboardEntry[]>;
  /** Analytics */
  trackEvent(name: string, params?: AnalyticsParams): void;
  setUserProperty(name: string, value: string): void;
  /**
   * Privacy gate: analytics collection stays OFF until the host app records
   * consent. Default is OFF (privacy-safe); call with true only after the
   * player opts in (or your policy allows it). See RELEASE.md.
   */
  setAnalyticsConsent(granted: boolean): void;
}

// ------------------------------------------------------------------ config
export interface FirebaseWebConfig {
  apiKey: string; authDomain: string; projectId: string; storageBucket: string;
  messagingSenderId: string; appId: string; measurementId?: string;
}

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env || {};

export function readFirebaseConfig(): FirebaseWebConfig | null {
  const cfg: FirebaseWebConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || '',
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  };
  return cfg.apiKey && cfg.projectId && cfg.appId ? cfg : null;
}

export const isFirebaseConfigured = (): boolean => readFirebaseConfig() !== null;

// ------------------------------------------------------------------ helpers
const LS_AUTH = 'rsj-cloud-auth';
const LS_DOC = (uid: string) => `rsj-cloud-doc-${uid}`;
const LS_BOARD = 'rsj-cloud-leaderboard';
const latency = (ms = 120) => new Promise<void>((r) => setTimeout(r, ms));
const rid = () => Math.random().toString(36).slice(2, 10);
const lsGet = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const lsSet = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };

const BOT_NAMES = ['Sky Bandit', 'Leaf Lord', 'Nutty Nova', 'Captain Fluff', 'Cloud Hopper', 'Moon Paws', 'Zippy Tail', 'Pixel Coon'];
function seededBots(): LeaderboardEntry[] {
  return BOT_NAMES.map((name, i) => ({
    uid: `bot_${i}`, name, skin: ['classic', 'wizard', 'astronaut', 'pirate', 'hero', 'ninja', 'royal', 'golden'][i],
    altitude: 3200 - i * 310, score: 34000 - i * 3350, date: Date.now() - i * 86400000,
  }));
}

// ------------------------------------------------------------------ MOCK
class MockAdapter implements CloudAdapter {
  readonly mode = 'mock' as const;
  private user: CloudUser | null = lsGet<CloudUser>(LS_AUTH);
  private listeners = new Set<AuthListener>();
  private events: { name: string; params?: AnalyticsParams; at: number }[] = [];

  private emit() { lsSet(LS_AUTH, this.user); this.listeners.forEach((l) => l(this.user)); }

  currentUser() { return this.user; }
  onAuthStateChanged(cb: AuthListener) { this.listeners.add(cb); queueMicrotask(() => cb(this.user)); return () => { this.listeners.delete(cb); }; }

  async loginAnonymously() {
    await latency();
    if (!this.user) this.user = { uid: `anon_${rid()}`, displayName: `Raccoon #${Math.floor(1000 + Math.random() * 9000)}`, provider: 'anonymous' };
    this.emit(); this.trackEvent('login', { method: 'anonymous' });
    return this.user;
  }
  async linkWithGoogle() {
    await latency(400);
    const base = this.user ?? { uid: `anon_${rid()}`, displayName: 'Raccoon', provider: 'anonymous' as const };
    this.user = { ...base, provider: 'google', displayName: base.displayName.startsWith('Raccoon #') ? `Sky Raccoon ${base.displayName.slice(9)}` : base.displayName };
    this.emit(); this.trackEvent('login', { method: 'google' });
    return this.user;
  }
  async logout() { await latency(60); this.user = null; this.emit(); this.trackEvent('logout'); }

  async saveUserProgress(uid: string, save: SaveData) { await latency(80); lsSet(LS_DOC(uid), { ...save, cloudSyncedAt: Date.now() }); }
  async loadUserProgress(uid: string) { await latency(80); return lsGet<SaveData>(LS_DOC(uid)); }
  async submitScore(entry: LeaderboardEntry) {
    await latency(60);
    const board = lsGet<LeaderboardEntry[]>(LS_BOARD) ?? [];
    const idx = board.findIndex((e) => e.uid === entry.uid);
    if (idx >= 0) { if (entry.score > board[idx].score) board[idx] = entry; } else board.push(entry);
    lsSet(LS_BOARD, board);
  }
  async fetchLeaderboards(limit = 25) {
    await latency(200);
    const board = lsGet<LeaderboardEntry[]>(LS_BOARD) ?? [];
    return [...seededBots(), ...board].sort((a, b) => b.score - a.score).slice(0, limit);
  }

  trackEvent(name: string, params?: AnalyticsParams) {
    this.events.push({ name, params, at: Date.now() });
    if (this.events.length > 200) this.events.shift();
    if (env.DEV) console.debug(`[analytics] ${name}`, params ?? '');
  }
  setUserProperty(name: string, value: string) { if (env.DEV) console.debug(`[analytics] user_property ${name}=${value}`); }
  setAnalyticsConsent(_granted: boolean) { /* mock: nothing is collected */ }
  /** Debug helper (mock only) */
  recentEvents() { return [...this.events]; }
}

// ------------------------------------------------------------------ REAL
/**
 * Live adapter backed by the Firebase Web SDK (runs inside the Capacitor
 * WebView on Android/iOS and in the browser). SDK modules are imported
 * lazily so an unconfigured build never pays their startup cost; every call
 * awaits `boot`, and failures propagate to callers — all of which already
 * catch, so local save stays authoritative.
 *
 * Go live: fill VITE_FIREBASE_* in .env (see .env.example and RELEASE.md).
 */
class RealAdapter implements CloudAdapter {
  readonly mode = 'live' as const;
  private user: CloudUser | null = null;
  private listeners = new Set<AuthListener>();
  private bootPromise: Promise<void>;
  private auth: Auth | null = null;
  private db: Firestore | null = null;
  private analytics: Analytics | null = null;
  private analyticsEnabled = false; // OFF until consent is recorded

  constructor(cfg: FirebaseWebConfig) {
    this.bootPromise = this.boot(cfg);
    this.bootPromise.catch((e) => console.warn('[firebase] boot failed; cloud features off', e));
  }

  private async boot(cfg: FirebaseWebConfig): Promise<void> {
    const { initializeApp } = await import('firebase/app');
    const app = initializeApp(cfg);
    const authMod = await import('firebase/auth');
    const fsMod = await import('firebase/firestore');
    this.auth = authMod.getAuth(app);
    this.db = fsMod.getFirestore(app);
    try {
      const anMod = await import('firebase/analytics');
      this.analytics = anMod.getAnalytics(app);
      anMod.setAnalyticsCollectionEnabled(this.analytics, this.analyticsEnabled);
    } catch { this.analytics = null; }
    authMod.onAuthStateChanged(this.auth, (u) => {
      this.user = u ? RealAdapter.toUser(u) : null;
      this.listeners.forEach((l) => l(this.user));
    });
  }
  private static toUser(u: User): CloudUser {
    return {
      uid: u.uid,
      displayName: u.displayName || (u.isAnonymous ? 'Guest Raccoon' : 'Raccoon'),
      provider: u.isAnonymous ? 'anonymous' : 'google',
      photoURL: u.photoURL ?? undefined,
    };
  }
  private async ready(): Promise<void> { await this.bootPromise; }

  currentUser() { return this.user; }
  onAuthStateChanged(cb: AuthListener) {
    this.listeners.add(cb);
    queueMicrotask(() => cb(this.user));
    return () => { this.listeners.delete(cb); };
  }

  async loginAnonymously(): Promise<CloudUser> {
    await this.ready();
    const { signInAnonymously } = await import('firebase/auth');
    const cred = await signInAnonymously(this.auth!);
    return RealAdapter.toUser(cred.user);
  }
  async linkWithGoogle(): Promise<CloudUser> {
    await this.ready();
    const { GoogleAuthProvider, linkWithPopup, signInWithPopup } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    const cred = this.auth!.currentUser
      ? await linkWithPopup(this.auth!.currentUser, provider)
      : await signInWithPopup(this.auth!, provider);
    return RealAdapter.toUser(cred.user);
  }
  async logout(): Promise<void> {
    await this.ready();
    const { signOut } = await import('firebase/auth');
    await signOut(this.auth!);
  }

  async saveUserProgress(uid: string, save: SaveData): Promise<void> {
    await this.ready();
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(this.db!, 'players', uid), { ...save, cloudSyncedAt: Date.now() }, { merge: true });
  }
  async loadUserProgress(uid: string): Promise<SaveData | null> {
    await this.ready();
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(this.db!, 'players', uid));
    return snap.exists() ? (snap.data() as SaveData) : null;
  }
  async submitScore(entry: LeaderboardEntry): Promise<void> {
    await this.ready();
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(this.db!, 'leaderboard', entry.uid), entry, { merge: true });
  }
  async fetchLeaderboards(limit = 25): Promise<LeaderboardEntry[]> {
    await this.ready();
    const { collection, query, orderBy, limit: qLimit, getDocs } = await import('firebase/firestore');
    const q = query(collection(this.db!, 'leaderboard'), orderBy('score', 'desc'), qLimit(limit));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as LeaderboardEntry);
  }

  trackEvent(name: string, params?: AnalyticsParams): void {
    if (!this.analytics || !this.analyticsEnabled) return;
    void import('firebase/analytics').then(({ logEvent }) => {
      const clean: Record<string, string | number | boolean> = {};
      for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) clean[k] = v;
      logEvent(this.analytics!, name, clean);
    }).catch(() => undefined);
  }
  setUserProperty(name: string, value: string): void {
    if (!this.analytics || !this.analyticsEnabled) return;
    void import('firebase/analytics').then(({ setUserProperties }) => {
      setUserProperties(this.analytics!, { [name]: value });
    }).catch(() => undefined);
  }
  setAnalyticsConsent(granted: boolean): void {
    this.analyticsEnabled = granted;
    if (this.analytics) {
      void import('firebase/analytics').then(({ setAnalyticsCollectionEnabled }) => {
        setAnalyticsCollectionEnabled(this.analytics!, granted);
      }).catch(() => undefined);
    }
  }
}

// ------------------------------------------------------------------ singleton
function createAdapter(): CloudAdapter {
  const cfg = readFirebaseConfig();
  if (!cfg) return new MockAdapter();
  try { return new RealAdapter(cfg); } catch (e) { console.warn('[firebase] live adapter failed, falling back to mock', e); return new MockAdapter(); }
}

export const firebase: CloudAdapter = createAdapter();

/** Shorthand used all over the game: `trackEvent('world_reached', { world: 3 })` */
export const trackEvent = (name: string, params?: AnalyticsParams) => { try { firebase.trackEvent(name, params); } catch { /* analytics must never break gameplay */ } };

/** Well-known event names (keeps dashboards consistent). */
export const EV = {
  RUN_START: 'run_start',
  RUN_END: 'run_end',
  NEW_BEST: 'new_best_score',
  WORLD_REACHED: 'world_reached',
  ACHIEVEMENT: 'achievement_unlocked',
  MISSION_CLAIMED: 'mission_claimed',
  SKIN_UNLOCKED: 'skin_unlocked',
  SKIN_SELECTED: 'skin_selected',
  REMOVE_ADS: 'remove_ads_purchased',
  AD_IMPRESSION: 'ad_impression',
  AD_REWARD: 'ad_reward_earned',
  REVIVE: 'revive_used',
  CLOUD_SYNC: 'cloud_sync',
} as const;
