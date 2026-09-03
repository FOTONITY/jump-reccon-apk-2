import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/engine';
import { audio } from './game/audio';
import { ACHIEVEMENTS, SKINS, WORLDS } from './game/config';
import { applyRunResult, checkAchievements, claimMission, defaultSave, flushCloudNow, loadSave, persist, pullCloudSave } from './game/save';
import { EV, firebase, trackEvent, type CloudUser } from './game/firebase';
import { REMOVE_ADS_PRICE, hideBannerAd, initAds, maybeShowInterstitialAd, showBannerAd, showRewardedAd, ads } from './game/ads';
import type { DifficultyMode, MissionDef, RewardType, RunResult, SaveData, SkinDef } from './game/types';
import { UserProvider } from './context/UserContext';
import { AudioNudge, GameOverScreen, HomeScreen, PauseScreen, SetupScreen, type NavTarget } from './components/screens';
import { LeaderboardScreen, MissionsScreen, ProfileModal, ScoresScreen, SettingsScreen, ShopScreen } from './components/menus';
import { AdOverlay, BannerAd } from './components/ads';
import { Btn } from './components/ui';
import { exitApp, initNativeShell, onAppStateChange, onBackButton } from './native';

type Screen = 'home' | 'playing' | 'paused' | 'gameover' | 'setup' | NavTarget;

/**
 * Size the playfield from the *safe* area: `.app-root` already carries the
 * env(safe-area-inset-*) padding plus the banner reservation, so measuring it
 * excludes the notch, the gesture bar and the ad slot automatically.
 */
function computeFrame(box?: { w: number; h: number }) {
  const vv = window.visualViewport;
  const vw = box?.w || vv?.width || window.innerWidth;
  const vh = box?.h || vv?.height || window.innerHeight;
  const ratio = vw / vh;
  let w = vw, h = vh;
  if (ratio > 0.62) { h = vh; w = Math.round(vh * 0.5625); }
  else if (ratio < 0.42) { w = vw; h = Math.round(vw / 0.42); }
  return { w: Math.max(240, Math.round(w)), h: Math.max(360, Math.round(h)) };
}

export default function App() {
  return (
    <UserProvider>
      <GameShell />
    </UserProvider>
  );
}

function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  const [screen, setScreen] = useState<Screen>('home');
  const screenRef = useRef(screen);
  const [frame, setFrame] = useState(computeFrame);
  const [result, setResult] = useState<RunResult | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [newAch, setNewAch] = useState<string[]>([]);
  const [reviveUsed, setReviveUsed] = useState(false);
  const [coinsDoubled, setCoinsDoubled] = useState(false);
  const [adBusy, setAdBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [audioState, setAudioState] = useState(audio.state);
  const appliedRef = useRef<RunResult | null>(null);
  const [toast, setToast] = useState<{ title: string; icon: string; sub?: string } | null>(null);
  const toastTimer = useRef(0);

  saveRef.current = save;
  screenRef.current = screen;

  // ------------------------------------------------------------ helpers
  const pushToast = useCallback((title: string, icon: string, sub?: string) => {
    setToast({ title, icon, sub });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const showAchievements = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const a = ACHIEVEMENTS.find((x) => x.id === ids[0]);
    if (!a) return;
    pushToast(a.title, a.icon, 'ACHIEVEMENT UNLOCKED');
    audio.achievement();
    for (const id of ids) trackEvent(EV.ACHIEVEMENT, { id });
  }, [pushToast]);

  const liveAchievementCheck = useCallback(() => {
    const g = gameRef.current; if (!g) return;
    const live = g.getResult();
    const { save: s2, unlocked } = checkAchievements(saveRef.current, { altitude: live.altitude, world: live.world, revived: live.revived });
    if (unlocked.length) { setSave(s2); showAchievements(unlocked); }
  }, [showAchievements]);

  // ------------------------------------------------------------ actions
  /** Open the compact Game Setup (PLAY → setup → START). */
  const openSetup = useCallback(() => { audio.init(); setScreen('setup'); }, []);
  /** Start the run with the chosen location + difficulty, persisting the choice. */
  const startFromSetup = useCallback((loc: number, diff: DifficultyMode) => {
    const g = gameRef.current; if (!g) return;
    const updated = { ...saveRef.current, settings: { ...saveRef.current.settings, startWorld: loc, difficulty: diff } };
    saveRef.current = updated;
    setSave(updated); // persist via the save effect
    g.setSettings(updated.settings); // engine must see the mode BEFORE start()
    g.start(); setScreen('playing');
    trackEvent(EV.RUN_START, { skin: updated.selected, runs: updated.stats.runs, difficulty: diff, startWorld: loc });
  }, []);
  const play = useCallback(() => {
    const g = gameRef.current; if (!g) return;
    audio.init();
    appliedRef.current = null; setReviveUsed(false); setCoinsDoubled(false); setNewAch([]);
    void hideBannerAd();
    g.start(); setScreen('playing');
    trackEvent(EV.RUN_START, { skin: saveRef.current.selected, runs: saveRef.current.stats.runs });
  }, []);
  const pause = useCallback(() => { gameRef.current?.pause(); setScreen('paused'); }, []);
  const resume = useCallback(() => { audio.init(); gameRef.current?.resume(); setScreen('playing'); }, []);
  const home = useCallback(() => { gameRef.current?.toMenu(); setScreen('home'); }, []);

  /**
   * A run is "completed" when the player leaves the Game Over screen — after
   * the revive decision, never before it. Every 3rd completed run shows an
   * interstitial (skipped entirely with the Remove Ads pass), then continues.
   */
  const finishRun = useCallback(async (next: () => void) => {
    const cur = saveRef.current;
    if (screenRef.current !== 'gameover') { next(); return; }
    setAdBusy(true);
    try {
      const { runsSinceAd } = await maybeShowInterstitialAd(cur.removeAds, cur.runsSinceAd);
      setSave((s) => (s.runsSinceAd === runsSinceAd ? s : { ...s, runsSinceAd }));
    } finally { setAdBusy(false); }
    next();
  }, []);
  const retryAfterGameOver = useCallback(() => { void finishRun(play); }, [finishRun, play]);
  const homeAfterGameOver = useCallback(() => { void finishRun(home); }, [finishRun, home]);

  /** Rewarded-ad state machine: one promise, one reward, one place. */
  const watchAd = useCallback(async (type: RewardType) => {
    if (adBusy) return;
    setAdBusy(true);
    try {
      const earned = await showRewardedAd(type);
      if (!earned) { pushToast('No reward this time', '📺', 'AD SKIPPED'); return; }
      const g = gameRef.current;
      if (type === 'revive' && g) {
        setReviveUsed(true); g.revive(); setScreen('playing');
        trackEvent(EV.REVIVE, { altitude: g.getResult().altitude });
      } else if (type === 'doubleCoins' && result) {
        const bonus = result.coins;
        setCoinsDoubled(true);
        setSave((s) => ({ ...s, coins: s.coins + bonus, stats: { ...s.stats, coins: s.stats.coins + bonus } }));
        pushToast(`+${bonus} coins`, '✨', 'COINS DOUBLED');
        audio.purchase();
      } else if (type === 'bonusCoins') {
        setSave((s) => ({ ...s, coins: s.coins + 100 }));
        pushToast('+100 coins', '🎁', 'BONUS');
      }
    } finally { setAdBusy(false); }
  }, [adBusy, result, pushToast]);

  // ------------------------------------------------------------ game instance
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const s = saveRef.current;
    const skin = SKINS.find((k) => k.id === s.selected) || SKINS[0];
    const game = new Game(canvas, s.settings, skin, {
      onGameOver: (r) => {
        const prev = saveRef.current;
        const { save: s2, unlocked, newBest: nb } = applyRunResult(prev, r, appliedRef.current);
        appliedRef.current = r;
        setSave(s2); setResult(r); setNewBest(nb);
        setNewAch(unlocked.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.title || id));
        if (unlocked.length) showAchievements(unlocked);
        setScreen('gameover');
        trackEvent(EV.RUN_END, { score: r.score, altitude: r.altitude, coins: r.coins, world: r.world, revived: r.revived, skin: r.skin });
        if (nb) trackEvent(EV.NEW_BEST, { score: r.score, altitude: r.altitude });
        // Cloud leaderboard (fire-and-forget)
        if (s2.uid && nb) {
          const u = firebase.currentUser();
          firebase.submitScore({ uid: s2.uid, name: u?.displayName || 'Raccoon', score: r.score, altitude: r.altitude, skin: r.skin, date: Date.now() }).catch(() => undefined);
        }
      },
      onWorldReached: (idx) => { liveAchievementCheck(); trackEvent(EV.WORLD_REACHED, { world: idx, name: WORLDS[idx]?.name }); },
      onAltitude: () => liveAchievementCheck(),
      onKey: (code) => {
        const sc = screenRef.current;
        if (code === 'Escape' || code === 'KeyP') { if (sc === 'playing') pause(); else if (sc === 'paused') resume(); }
        if (code === 'Enter' || code === 'Space') { if (sc === 'home') openSetup(); else if (sc === 'setup') startFromSetup(saveRef.current.settings.startWorld, saveRef.current.settings.difficulty); else if (sc === 'paused') resume(); else if (sc === 'gameover') void finishRun(play); }
      },
    });
    game.bestAltitude = s.bestAltitude;
    gameRef.current = game;
    const f = computeFrame(); game.resize(f.w, f.h);
    return () => { game.destroy(); gameRef.current = null; };
  }, [pause, resume, play, finishRun, openSetup, startFromSetup, showAchievements, liveAchievementCheck]);

  // ------------------------------------------------------------ resize (safe-area + banner aware)
  useEffect(() => {
    const onResize = () => {
      const el = rootRef.current;
      const box = el ? { w: el.clientWidth, h: el.clientHeight } : undefined;
      const f = computeFrame(box);
      setFrame(f);
      document.documentElement.style.fontSize = `${Math.max(11, Math.min(22, (f.w / 400) * 16))}px`;
      gameRef.current?.resize(f.w, f.h);
    };
    onResize();
    const settle = window.setTimeout(onResize, 300);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && rootRef.current) { ro = new ResizeObserver(onResize); ro.observe(rootRef.current); }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(settle); ro?.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);

  // ------------------------------------------------------------ persistence + settings sync
  useEffect(() => {
    persist(save);
    const g = gameRef.current;
    if (g) {
      g.bestAltitude = save.bestAltitude;
      g.setSettings(save.settings);
      g.setSkin(SKINS.find((k) => k.id === save.selected) || SKINS[0]);
    }
    audio.setSfx(save.settings.sfx);
    audio.setMusic(save.settings.music);
  }, [save]);

  // ------------------------------------------------------------ banner: menus only, never in play, never with the pass
  const inGame = screen === 'playing' || screen === 'paused' || screen === 'gameover';
  useEffect(() => {
    if (inGame) void hideBannerAd();
    else void showBannerAd(save.removeAds);
  }, [inGame, screen, save.removeAds]);

  // ------------------------------------------------------------ audio unlock + auto-pause + audio state
  useEffect(() => {
    const vis = () => { if (document.hidden) { if (screenRef.current === 'playing') pause(); audio.suspend(); } else audio.init(); };
    const unlock = () => audio.init();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    const off = audio.onStateChange(setAudioState);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); off(); };
  }, [pause]);

  // ------------------------------------------------------------ native shell + ads init
  useEffect(() => {
    void initNativeShell();
    void initAds();
    // Privacy gate: Firebase Analytics stays OFF unless the deployment
    // explicitly records a consent default. See RELEASE.md §Consent.
    firebase.setAnalyticsConsent(
      (import.meta as unknown as { env: Record<string, unknown> }).env?.VITE_FIREBASE_ANALYTICS_CONSENT === 'granted',
    );
    const offState = onAppStateChange((active) => {
      if (!active) { if (screenRef.current === 'playing') pause(); audio.suspend(); void flushCloudNow(); }
      else audio.init();
    });
    const offBack = onBackButton(() => {
      const sc = screenRef.current;
      if (profileOpen) { setProfileOpen(false); return; }
      if (sc === 'playing') { pause(); return; }
      if (sc === 'paused') { resume(); return; }
      if (sc === 'gameover') { void finishRun(home); return; }
      if (sc !== 'home') { home(); return; }
      void exitApp();
    });
    return () => { offState(); offBack(); };
  }, [pause, resume, home, finishRun, profileOpen]);

  // ------------------------------------------------------------ cloud identity → merge save
  useEffect(() => firebase.onAuthStateChanged((u: CloudUser | null) => {
    const cur = saveRef.current;
    if (!u) { if (cur.uid) setSave({ ...cur, uid: undefined, cloudSyncedAt: undefined }); return; }
    if (cur.uid === u.uid) return;
    firebase.setUserProperty('skin', cur.selected);
    pullCloudSave(cur, u.uid).then((merged) => { setSave(merged); pushToast(u.displayName, '☁️', 'CLOUD SAVE LINKED'); });
  }), [pushToast]);

  // ------------------------------------------------------------ save mutations
  const buySkin = (s: SkinDef) => {
    if (save.coins < s.price || save.unlocked.includes(s.id)) return;
    audio.purchase();
    setSave({ ...save, coins: save.coins - s.price, unlocked: [...save.unlocked, s.id], selected: s.id });
    trackEvent(EV.SKIN_UNLOCKED, { skin: s.id, price: s.price });
    pushToast(s.name, '🎉', 'NEW CHARACTER');
  };
  const selectSkin = (s: SkinDef) => { setSave({ ...save, selected: s.id }); trackEvent(EV.SKIN_SELECTED, { skin: s.id }); };
  const buyRemoveAds = () => {
    if (save.removeAds || save.coins < REMOVE_ADS_PRICE) return;
    audio.purchase();
    setSave({ ...save, coins: save.coins - REMOVE_ADS_PRICE, removeAds: true, runsSinceAd: 0 });
    void hideBannerAd();
    trackEvent(EV.REMOVE_ADS, { price: REMOVE_ADS_PRICE, currency: 'coins' });
    pushToast('Ads removed', '🚫', 'THANK YOU!');
  };
  const claim = (m: MissionDef) => { audio.purchase(); setSave(claimMission(save, m)); trackEvent(EV.MISSION_CLAIMED, { id: m.id, reward: m.reward }); };
  const changeSettings = (patch: Partial<SaveData['settings']>) => setSave({ ...save, settings: { ...save.settings, ...patch } });
  const resetProgress = () => { setSave({ ...defaultSave(), uid: save.uid }); trackEvent('progress_reset'); };
  const canClaimGift = !save.daily.claimed.includes('daily_gift');
  const claimDailyGift = () => {
    audio.purchase();
    setSave({ ...save, coins: save.coins + 100, daily: { ...save.daily, claimed: [...save.daily.claimed, 'daily_gift'] } });
    trackEvent('daily_gift_claimed');
  };
  const nav = (s: NavTarget) => setScreen(s);
  const openProfile = () => setProfileOpen(true);

  return (
    <div className="app-root" ref={rootRef}>
      <div className="game-frame" data-short={frame.h < 620 ? 'true' : undefined} style={{ width: frame.w, height: frame.h }}>
        <canvas ref={canvasRef} style={{ width: frame.w, height: frame.h }} className="block" />

        {screen === 'playing' && (
          <div className="absolute left-3 top-3 z-30">
            <Btn color="ghost" size="icon" onClick={pause} title="Pause"><span className="font-black tracking-tighter">❚❚</span></Btn>
          </div>
        )}
        {screen === 'playing' && <AudioNudge state={audioState} />}

        {screen === 'home' && <HomeScreen save={save} onPlay={openSetup} onNav={nav} onClaimDailyGift={claimDailyGift} canClaimGift={canClaimGift} onProfile={openProfile} />}
        {screen === 'setup' && <SetupScreen save={save} onStart={startFromSetup} onBack={home} onCharacters={() => setScreen('characters')} />}
        {screen === 'paused' && (
          <PauseScreen save={save} onResume={resume} onRestart={play} onHome={home}
            onToggleSfx={() => changeSettings({ sfx: !save.settings.sfx })} onToggleMusic={() => changeSettings({ music: !save.settings.music })} />
        )}
        {screen === 'gameover' && result && (
          <GameOverScreen result={result} save={save} newBest={newBest} canRevive={!reviveUsed} onRetry={retryAfterGameOver} onHome={homeAfterGameOver}
            onWatchAd={(t) => void watchAd(t)} newAchievements={newAch} adBusy={adBusy} coinsDoubled={coinsDoubled} />
        )}
        {(screen === 'shop' || screen === 'characters') && <ShopScreen save={save} mode={screen} onBack={home} onBuy={buySkin} onSelect={selectSkin} onBuyRemoveAds={buyRemoveAds} />}
        {screen === 'missions' && <MissionsScreen save={save} onBack={home} onClaim={claim} />}
        {screen === 'settings' && <SettingsScreen save={save} onBack={home} onChange={changeSettings} onReset={resetProgress} onProfile={openProfile} />}
        {screen === 'scores' && <ScoresScreen save={save} onBack={home} />}
        {screen === 'leaderboard' && <LeaderboardScreen save={save} onBack={home} onProfile={openProfile} />}

        {profileOpen && <ProfileModal save={save} onClose={() => setProfileOpen(false)} />}

        {toast && (
          <div className={`absolute left-1/2 -translate-x-1/2 z-[60] anim-toast ${inGame ? 'top-[7.5rem]' : 'top-16'}`}>
            <div className="glass-panel flex items-center gap-2 rounded-2xl px-4 py-2">
              <span className="text-2xl">{toast.icon}</span>
              <div>
                {toast.sub && <div className="text-[0.6rem] font-bold text-[#ffd166] tracking-widest">{toast.sub}</div>}
                <div className="font-black text-white glass-text">{toast.title}</div>
              </div>
            </div>
          </div>
        )}

        <AdOverlay />
      </div>
      <BannerAd mock={ads.mode === 'mock'} />
    </div>
  );
}
