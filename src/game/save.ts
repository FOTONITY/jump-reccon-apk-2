import { ACHIEVEMENTS, DAILY_POOL, LIFETIME_MISSIONS, WORLDS } from './config';
import { EV, firebase, trackEvent } from './firebase';
import type { MissionDef, RunResult, SaveData } from './types';

const KEY = 'raccoon-sky-jump-save-v2';
const LEGACY_KEYS = ['raccoon-sky-jump-save-v1'];

export function defaultSave(): SaveData {
  return {
    version: 2,
    bestAltitude: 0,
    bestScore: 0,
    coins: 0,
    unlocked: ['classic'],
    selected: 'classic',
    achievements: [],
    stats: { coins: 0, platforms: 0, perfect: 0, powerups: 0, stomps: 0, runs: 0, maxWorld: 0, bestNoRevive: 0 },
    bestRun: { coins: 0, combo: 0, altitude: 0, platforms: 0, powerups: 0 },
    claimed: [],
    daily: { date: todayKey(), progress: {}, claimed: [] },
    highScores: [],
    settings: { sfx: true, music: true, shake: true, haptic: true, controls: 'buttons', boundary: 'border', sensitivity: 50, difficulty: 'normal', startWorld: 0 },
    removeAds: false,
    runsSinceAd: 0,
  };
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Normalise anything (old versions, cloud docs) into a complete SaveData. */
export function hydrate(parsed: Partial<SaveData> | null | undefined): SaveData {
  const base = defaultSave();
  if (!parsed || typeof parsed !== 'object') return base;
  const merged: SaveData = {
    ...base, ...parsed,
    version: 2,
    stats: { ...base.stats, ...(parsed.stats || {}) },
    bestRun: { ...base.bestRun, ...(parsed.bestRun || {}) },
    daily: parsed.daily || base.daily,
    unlocked: Array.isArray(parsed.unlocked) ? [...parsed.unlocked] : base.unlocked,
    highScores: Array.isArray(parsed.highScores) ? parsed.highScores : [],
    removeAds: !!parsed.removeAds,
    runsSinceAd: typeof parsed.runsSinceAd === 'number' ? parsed.runsSinceAd : 0,
    settings: {
      ...base.settings, ...(parsed.settings || {}),
      // Migration: saves created before the boundary option existed were played
      // with wrap, so long-time players keep the feel they know. Fresh installs
      // (no progression yet) get the recommended BORDER default.
      boundary: parsed.settings?.boundary === 'wrap' || parsed.settings?.boundary === 'border'
        ? parsed.settings.boundary
        : (parsed.stats?.runs || parsed.bestAltitude || (Array.isArray(parsed.unlocked) && parsed.unlocked.length > 1) ? 'wrap' : 'border'),
      sensitivity: typeof parsed.settings?.sensitivity === 'number'
        ? Math.max(0, Math.min(100, Math.round(parsed.settings.sensitivity))) : 50,
      difficulty: parsed.settings?.difficulty === 'easy' || parsed.settings?.difficulty === 'normal' || parsed.settings?.difficulty === 'hard'
        ? parsed.settings.difficulty : 'normal',
      startWorld: typeof parsed.settings?.startWorld === 'number'
        ? Math.max(0, Math.min(WORLDS.length - 1, Math.round(parsed.settings.startWorld))) : 0,
    },
  };
  if (merged.daily.date !== todayKey()) merged.daily = { date: todayKey(), progress: {}, claimed: [] };
  if (!merged.unlocked.includes('classic')) merged.unlocked.push('classic');
  if (!merged.unlocked.includes(merged.selected)) merged.selected = 'classic';
  return merged;
}

export function loadSave(): SaveData {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) for (const k of LEGACY_KEYS) { raw = localStorage.getItem(k); if (raw) break; }
    if (!raw) return defaultSave();
    return hydrate(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

// ------------------------------------------------------------ persistence (local first, cloud optional)
let cloudTimer: number | undefined;
let cloudBusy = false;
let cloudDirty: SaveData | null = null;

/**
 * Writes localStorage synchronously (never lost), then debounces an optional
 * cloud write. With no Firebase keys the mock adapter mirrors to localStorage;
 * with no signed-in user nothing else happens at all.
 */
export function persist(save: SaveData) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* quota / private mode */ }
  if (!save.uid) return;
  cloudDirty = save;
  if (cloudTimer) window.clearTimeout(cloudTimer);
  cloudTimer = window.setTimeout(flushCloud, 1500);
}

async function flushCloud() {
  if (cloudBusy || !cloudDirty?.uid) return;
  const snapshot = cloudDirty; cloudDirty = null; cloudBusy = true;
  try {
    await firebase.saveUserProgress(snapshot.uid!, snapshot);
    trackEvent(EV.CLOUD_SYNC, { ok: true, mode: firebase.mode });
  } catch (e) {
    console.warn('[save] cloud sync failed (local copy is safe)', e);
    trackEvent(EV.CLOUD_SYNC, { ok: false });
  } finally {
    cloudBusy = false;
    if (cloudDirty) flushCloud();
  }
}

/** Force any pending cloud write now (call on app background / logout). */
export async function flushCloudNow(): Promise<void> { if (cloudTimer) { window.clearTimeout(cloudTimer); cloudTimer = undefined; } await flushCloud(); }

/**
 * Conflict-free merge of two saves: keep the best of every progression field
 * and the union of every unlock. Used when a player signs in on a new device.
 */
export function mergeSaves(a: SaveData, b: SaveData): SaveData {
  const uniq = <T,>(x: T[], y: T[]) => Array.from(new Set([...x, ...y]));
  const merged: SaveData = {
    ...a,
    bestAltitude: Math.max(a.bestAltitude, b.bestAltitude),
    bestScore: Math.max(a.bestScore, b.bestScore),
    coins: Math.max(a.coins, b.coins),
    unlocked: uniq(a.unlocked, b.unlocked),
    selected: a.selected,
    achievements: uniq(a.achievements, b.achievements),
    claimed: uniq(a.claimed, b.claimed),
    stats: {
      coins: Math.max(a.stats.coins, b.stats.coins), platforms: Math.max(a.stats.platforms, b.stats.platforms),
      perfect: Math.max(a.stats.perfect, b.stats.perfect), powerups: Math.max(a.stats.powerups, b.stats.powerups),
      stomps: Math.max(a.stats.stomps, b.stats.stomps), runs: Math.max(a.stats.runs, b.stats.runs),
      maxWorld: Math.max(a.stats.maxWorld, b.stats.maxWorld), bestNoRevive: Math.max(a.stats.bestNoRevive, b.stats.bestNoRevive),
    },
    bestRun: {
      coins: Math.max(a.bestRun.coins, b.bestRun.coins), combo: Math.max(a.bestRun.combo, b.bestRun.combo),
      altitude: Math.max(a.bestRun.altitude, b.bestRun.altitude), platforms: Math.max(a.bestRun.platforms, b.bestRun.platforms),
      powerups: Math.max(a.bestRun.powerups, b.bestRun.powerups),
    },
    highScores: [...a.highScores, ...b.highScores]
      .filter((h, i, arr) => arr.findIndex((o) => o.date === h.date && o.score === h.score) === i)
      .sort((x, y) => y.score - x.score).slice(0, 10),
    removeAds: a.removeAds || b.removeAds,
    daily: a.daily.date === todayKey() ? a.daily : b.daily.date === todayKey() ? b.daily : a.daily,
  };
  return hydrate(merged);
}

/** Pull the cloud document for `uid` and merge it into the local save. Falls back to local on any error. */
export async function pullCloudSave(local: SaveData, uid: string): Promise<SaveData> {
  try {
    const remote = await firebase.loadUserProgress(uid);
    const merged = remote ? mergeSaves(local, hydrate(remote)) : local;
    return { ...merged, uid, cloudSyncedAt: Date.now() };
  } catch (e) {
    console.warn('[save] cloud load failed, using local', e);
    return { ...local, uid };
  }
}

function seededPick(seed: string, count: number): MissionDef[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const pool = [...DAILY_POOL];
  const out: MissionDef[] = [];
  while (out.length < count && pool.length) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  return out;
}

export function dailyMissions(save: SaveData): MissionDef[] {
  return seededPick(save.daily.date, 3);
}

export function missionProgress(save: SaveData, m: MissionDef): number {
  if (m.scope === 'daily') return save.daily.progress[m.id] || 0;
  switch (m.stat) {
    case 'coins': return save.stats.coins;
    case 'platforms': return save.stats.platforms;
    case 'powerups': return save.stats.powerups;
    case 'perfect': return save.stats.perfect;
    case 'stomps': return save.stats.stomps;
    case 'runs': return save.stats.runs;
    case 'altitude': return save.bestRun.altitude;
    case 'runCoins': return save.bestRun.coins;
    case 'combo': return save.bestRun.combo;
    case 'world': return save.stats.maxWorld + 1;
  }
}

export function isMissionClaimed(save: SaveData, m: MissionDef): boolean {
  return m.scope === 'daily' ? save.daily.claimed.includes(m.id) : save.claimed.includes(m.id);
}

export function claimMission(save: SaveData, m: MissionDef): SaveData {
  if (isMissionClaimed(save, m) || missionProgress(save, m) < m.target) return save;
  const next = { ...save, coins: save.coins + m.reward };
  if (m.scope === 'daily') next.daily = { ...save.daily, claimed: [...save.daily.claimed, m.id] };
  else next.claimed = [...save.claimed, m.id];
  return next;
}

export function checkAchievements(save: SaveData, live?: { altitude: number; world: number; revived: boolean }): { save: SaveData; unlocked: string[] } {
  const alt = Math.max(save.bestAltitude, live?.altitude || 0);
  const world = Math.max(save.stats.maxWorld, live?.world || 0);
  const noRevive = Math.max(save.stats.bestNoRevive, live && !live.revived ? live.altitude : 0);
  const conds: Record<string, boolean> = {
    first_jump: alt >= 100,
    sky_explorer: alt >= 1000,
    coin_collector: save.stats.coins >= 1000,
    master_jumper: save.stats.perfect >= 50,
    space_raccoon: world >= 6,
    unstoppable: noRevive >= 2500,
    candy_lover: world >= 1,
    ocean_diver: world >= 2,
    ice_climber: world >= 4,
    bug_squasher: save.stats.stomps >= 25,
  };
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!save.achievements.includes(a.id) && conds[a.id]) unlocked.push(a.id);
  }
  if (!unlocked.length) return { save, unlocked };
  return { save: { ...save, achievements: [...save.achievements, ...unlocked] }, unlocked };
}

// `prev` is the result already applied earlier in the same run (before a revive); only the delta is added.
export function applyRunResult(save: SaveData, full: RunResult, prev?: RunResult | null): { save: SaveData; unlocked: string[]; newBest: boolean } {
  const r: RunResult = prev ? {
    ...full,
    coins: full.coins - prev.coins, platforms: full.platforms - prev.platforms, perfect: full.perfect - prev.perfect,
    powerups: full.powerups - prev.powerups, stomps: full.stomps - prev.stomps,
  } : full;
  let s: SaveData = { ...save };
  if (s.daily.date !== todayKey()) s.daily = { date: todayKey(), progress: {}, claimed: [] };
  s.coins = save.coins + r.coins;
  const newBest = full.altitude > save.bestAltitude;
  s.bestAltitude = Math.max(save.bestAltitude, full.altitude);
  s.bestScore = Math.max(save.bestScore, full.score);
  s.stats = {
    coins: save.stats.coins + r.coins,
    platforms: save.stats.platforms + r.platforms,
    perfect: save.stats.perfect + r.perfect,
    powerups: save.stats.powerups + r.powerups,
    stomps: save.stats.stomps + r.stomps,
    runs: save.stats.runs + (prev ? 0 : 1),
    maxWorld: Math.max(save.stats.maxWorld, r.world),
    bestNoRevive: r.revived ? save.stats.bestNoRevive : Math.max(save.stats.bestNoRevive, r.altitude),
  };
  s.bestRun = {
    coins: Math.max(save.bestRun.coins, full.coins),
    combo: Math.max(save.bestRun.combo, full.maxCombo),
    altitude: Math.max(save.bestRun.altitude, full.altitude),
    platforms: Math.max(save.bestRun.platforms, full.platforms),
    powerups: Math.max(save.bestRun.powerups, full.powerups),
  };
  // daily progress
  const prog = { ...s.daily.progress };
  for (const m of dailyMissions(s)) {
    const cur = prog[m.id] || 0;
    switch (m.stat) {
      case 'coins': prog[m.id] = cur + r.coins; break;
      case 'platforms': prog[m.id] = cur + r.platforms; break;
      case 'powerups': prog[m.id] = cur + r.powerups; break;
      case 'perfect': prog[m.id] = cur + r.perfect; break;
      case 'stomps': prog[m.id] = cur + r.stomps; break;
      case 'runs': prog[m.id] = cur + (prev ? 0 : 1); break;
      case 'altitude': prog[m.id] = Math.max(cur, full.altitude); break;
      case 'combo': prog[m.id] = Math.max(cur, full.maxCombo); break;
      case 'runCoins': prog[m.id] = Math.max(cur, full.coins); break;
      case 'world': prog[m.id] = Math.max(cur, full.world + 1); break;
    }
  }
  s.daily = { ...s.daily, progress: prog };
  // high scores (a revived run replaces its earlier entry)
  const hs = [...save.highScores.filter((h) => h.date !== full.date), { altitude: full.altitude, score: full.score, coins: full.coins, date: full.date, skin: full.skin }]
    .sort((a, b) => b.score - a.score).slice(0, 10);
  s.highScores = hs;
  const ach = checkAchievements(s, { altitude: full.altitude, world: full.world, revived: full.revived });
  return { save: ach.save, unlocked: ach.unlocked, newBest };
}

export function allMissions(save: SaveData): { daily: MissionDef[]; lifetime: MissionDef[] } {
  return { daily: dailyMissions(save), lifetime: LIFETIME_MISSIONS };
}
