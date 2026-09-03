import type { AchievementDef, MissionDef, PowerUpType, SkinDef, WorldDef } from './types';

export const W = 400;
export const GRAVITY = 2600;
// Medium jump: comfortable but still gives useful airtime.
// Max height = JUMP_V²/(2*GRAVITY) ≈ 129 px. Generation enforces gap < 117 px.
export const JUMP_V = 820;
export const MAX_VX = 340;
export const ACCEL = 2400;
export const AIR_ACCEL = 2000;
export const FRICTION = 1800;
export const PX_PER_M = 10;
export const MAX_FALL = 1500;

/**
 * Gameplay speed as a deterministic function of ALTITUDE.
 * Starts at a comfortable baseline (0.90x) and eases toward the cap (1.45x)
 * using the same smooth difficulty curve as platform generation, so the ramp
 * is gradual, predictable and monotonic — no sudden spikes.
 * This is strictly gameplay progression; it is NOT derived from device FPS
 * (performance scaling lives separately in engine.frameEma / perfScale).
 */
export const SPEED_BASE = 0.90;
export function gameSpeedAt(altitudeM: number, mode: DifficultyMode = 'normal'): number {
  const speedMax = DIFF_MODES[mode]?.speedMax ?? 1.45;
  return SPEED_BASE + (speedMax - SPEED_BASE) * difficultyAtM(Math.max(0, altitudeM), mode);
}

export const WORLDS: WorldDef[] = [
  {
    id: 0, name: 'GREEN HILLS', startM: 0,
    sky: ['#3d9be9', '#79c6f5', '#c9ecff'],
    plat: { top: '#6fcf3f', side: '#a86b3c', edge: '#4ea52a' },
    particle: 'leaf', fog: '#ffffff',
  },
  {
    id: 1, name: 'CANDY SKY', startM: 600,
    sky: ['#f06fa6', '#f9a8cf', '#ffe1ef'],
    plat: { top: '#ff8fc2', side: '#f4d7a1', edge: '#ffffff' },
    particle: 'sprinkle', fog: '#ffd6ea',
  },
  {
    id: 2, name: 'OCEAN CLOUDS', startM: 1400,
    sky: ['#1b8fd4', '#5ec8f0', '#c8f4ff'],
    plat: { top: '#3ecfbb', side: '#e8c07a', edge: '#2aa89a' },
    particle: 'bubble', fog: '#b8ecff',
  },
  {
    id: 3, name: 'MAGICAL NIGHT', startM: 2200,
    sky: ['#1a1440', '#3b2a78', '#6a4aa8'],
    plat: { top: '#7be0c8', side: '#4a3a7a', edge: '#b8ffe9', glow: '#7be0c8' },
    particle: 'firefly', fog: '#3b2a78',
  },
  {
    id: 4, name: 'FROZEN PEAKS', startM: 3000,
    sky: ['#9fd4ff', '#d4eeff', '#f4fbff'],
    plat: { top: '#e8f6ff', side: '#8fb8d8', edge: '#ffffff', glow: '#c8e8ff' },
    particle: 'snow', fog: '#e8f4ff',
  },
  {
    id: 5, name: 'VOLCANO', startM: 3900,
    sky: ['#3a0f0f', '#8a2a14', '#e0602a'],
    plat: { top: '#ff8a3c', side: '#3a2a2a', edge: '#ffd166', glow: '#ff6a1a' },
    particle: 'ember', fog: '#5a1a10',
  },
  {
    id: 6, name: 'SPACE', startM: 4800,
    sky: ['#05041a', '#181446', '#2a2470'],
    plat: { top: '#5ef2ff', side: '#4b5a78', edge: '#e8fdff', glow: '#5ef2ff' },
    particle: 'stardust', fog: '#181446',
  },
];

export function worldIndexAt(m: number): number {
  let idx = 0;
  for (let i = 0; i < WORLDS.length; i++) if (m >= WORLDS[i].startM) idx = i;
  return idx;
}

// ---- Difficulty modes ----------------------------------------------------
// `slope` stretches how fast in-altitude difficulty ramps ( >1 = easier/slower,
// <1 = harder/faster). `speedMax` caps the gameplay-speed ramp per mode.
import type { DifficultyMode } from './types';
export const DIFF_MODES: Record<DifficultyMode, { slope: number; speedMax: number; label: string; desc: string }> = {
  easy: { slope: 1.6, speedMax: 1.25, label: 'Easy', desc: 'Slower climb, wider gaps' },
  normal: { slope: 1.0, speedMax: 1.45, label: 'Normal', desc: 'The intended default' },
  hard: { slope: 0.72, speedMax: 1.55, label: 'Hard', desc: 'Faster, tighter, busier' },
};

export function difficultyAt(m: number): number {
  const d = Math.min(1, m / 4400);
  return Math.pow(d, 0.8);
}
export function difficultyAtM(m: number, mode: DifficultyMode = 'normal'): number {
  const slope = DIFF_MODES[mode]?.slope ?? 1;
  const d = Math.min(1, m / (4400 * slope));
  return Math.pow(d, 0.8);
}

export interface PowerUpDef { name: string; color: string; duration: number; desc: string; }
export const POWERUPS: Record<PowerUpType, PowerUpDef> = {
  leaf: { name: 'SUPER LEAF', color: '#5fd648', duration: 9, desc: 'Massive jumps!' },
  jetpack: { name: 'JETPACK', color: '#ff6b3d', duration: 2.1, desc: 'Blast off!' },
  magnet: { name: 'COIN MAGNET', color: '#ff4b6e', duration: 9, desc: 'Coins come to you!' },
  shield: { name: 'SHIELD', color: '#3f9cff', duration: 0, desc: 'Blocks one hit!' },
  double: { name: 'DOUBLE COIN', color: '#ffc42e', duration: 11, desc: 'Coins x2!' },
  slow: { name: 'SLOW TIME', color: '#8fd9ff', duration: 7, desc: 'Enemies slow down!' },
  bounce: { name: 'SUPER BOUNCE', color: '#ff9a2e', duration: 0, desc: 'Next 3 bounces huge!' },
  fever: { name: 'FEVER', color: '#c85cff', duration: 6, desc: 'Coin frenzy!' },
};

// Skin prices follow newPrice = max(oldPrice × 5, 5000). The `price` field below is
// the single source of truth for BOTH the displayed price and purchase validation,
// so they can never diverge. Owned/unlocked items and the starter skin are untouched.
export const SKINS: SkinDef[] = [
  { id: 'classic', name: 'Classic', price: 0, desc: 'The original sky-jumping raccoon.', hat: 'none' },
  { id: 'explorer', name: 'Forest Explorer', price: 5000, desc: 'Pith helmet, khaki vest, trusty compass.', hat: 'explorer', outfit: 'vest', prop: 'compass' },
  { id: 'wizard', name: 'Wizard', price: 5000, desc: 'A blue robe and a sparkly sky staff.', hat: 'wizard', outfit: 'robe', prop: 'staff' },
  { id: 'astronaut', name: 'Astronaut', price: 5000, desc: 'Ready for the final world.', hat: 'helmet', outfit: 'spacesuit', body: '#e9edf5', belly: '#ffffff' },
  { id: 'pirate', name: 'Pirate', price: 5000, desc: 'Arr! Treasure is up in the sky.', hat: 'bandana', outfit: 'stripes', extra: 'eyepatch', prop: 'cutlass' },
  { id: 'winter', name: 'Winter Outfit', price: 5000, desc: 'Ushanka, puffer, and a warm scarf.', hat: 'ushanka', outfit: 'puffer', extra: 'scarf' },
  { id: 'hero', name: 'Superhero', price: 5000, desc: 'Cape, mask, and a heroic A.', hat: 'hero', outfit: 'hero', cape: '#e8323c', extra: 'mask' },
  { id: 'ninja', name: 'Ninja', price: 5000, desc: 'Silent, swift, extremely fluffy.', hat: 'ninja', outfit: 'wrap', extra: 'wrap' },
  { id: 'chef', name: 'Chef', price: 5000, desc: 'Cooks up perfect landings.', hat: 'toque', outfit: 'chef', extra: 'neckerchief' },
  { id: 'cowboy', name: 'Cowboy', price: 5000, desc: 'Yee-haw across the clouds.', hat: 'cowboy', outfit: 'cowboy' },
  { id: 'samurai', name: 'Samurai', price: 5000, desc: 'Honor, fluff, and a tiny helmet.', hat: 'samurai', outfit: 'samurai' },
  { id: 'diver', name: 'Deep Diver', price: 5000, desc: 'Best dressed in Ocean Clouds.', hat: 'diver', outfit: 'diver' },
  { id: 'firefighter', name: 'Firefighter', price: 5000, desc: 'Not even volcanoes scare this raccoon.', hat: 'firehat', outfit: 'fire' },
  { id: 'detective', name: 'Detective', price: 5000, desc: 'Always on the case of missing coins.', hat: 'detective', outfit: 'detective' },
  { id: 'flower', name: 'Bloom Buddy', price: 5000, desc: 'A walking meadow with a leaf crown.', hat: 'flower', outfit: 'flower' },
  { id: 'robot', name: 'Robo Coon', price: 5000, desc: 'Beep boop bounce.', hat: 'antenna', outfit: 'robot', body: '#8aa0b8', belly: '#dce6f0', mask: '#4a5a70', dark: '#3a4a58' },
  { id: 'bee', name: 'Buzzy', price: 5000, desc: 'Stripes, wings, and extra pollen.', hat: 'antenna', outfit: 'bee' },
  { id: 'royal', name: 'Royal Outfit', price: 6000, desc: 'King of the floating islands.', hat: 'crown', outfit: 'royal', cape: '#b3202e' },
  { id: 'golden', name: 'Golden Raccoon', price: 12500, desc: 'Shiny. Legendary. Fabulous.', hat: 'none', body: '#f4c542', belly: '#fff3c4', mask: '#b8860b', dark: '#8a6508', extra: 'sparkle' },
];

export const LIFETIME_MISSIONS: MissionDef[] = [
  { id: 'l_coins100', title: 'Collect 100 coins', target: 100, reward: 50, stat: 'coins', scope: 'lifetime' },
  { id: 'l_alt500', title: 'Reach 500 meters', target: 500, reward: 100, stat: 'altitude', scope: 'run' },
  { id: 'l_alt1000', title: 'Reach 1,000 meters', target: 1000, reward: 200, stat: 'altitude', scope: 'run' },
  { id: 'l_power3', title: 'Use 3 power-ups', target: 3, reward: 60, stat: 'powerups', scope: 'lifetime' },
  { id: 'l_land20', title: 'Land on 20 platforms', target: 20, reward: 40, stat: 'platforms', scope: 'lifetime' },
  { id: 'l_run50', title: 'Collect 50 coins in one run', target: 50, reward: 120, stat: 'runCoins', scope: 'run' },
  { id: 'l_combo10', title: '10 consecutive landings', target: 10, reward: 100, stat: 'combo', scope: 'run' },
  { id: 'l_ocean', title: 'Reach Ocean Clouds', target: 3, reward: 180, stat: 'world', scope: 'run' },
  { id: 'l_volcano', title: 'Reach the Volcano world', target: 6, reward: 300, stat: 'world', scope: 'run' },
  { id: 'l_space', title: 'Reach Space', target: 7, reward: 500, stat: 'world', scope: 'run' },
  { id: 'l_coins1000', title: 'Collect 1,000 coins', target: 1000, reward: 250, stat: 'coins', scope: 'lifetime' },
  { id: 'l_perfect50', title: '50 perfect landings', target: 50, reward: 200, stat: 'perfect', scope: 'lifetime' },
  { id: 'l_stomp10', title: 'Squash 10 enemies', target: 10, reward: 150, stat: 'stomps', scope: 'lifetime' },
];

export const DAILY_POOL: MissionDef[] = [
  { id: 'd_coins60', title: 'Collect 60 coins today', target: 60, reward: 40, stat: 'coins', scope: 'daily' },
  { id: 'd_alt300', title: 'Reach 300 m in a run', target: 300, reward: 40, stat: 'altitude', scope: 'daily' },
  { id: 'd_alt800', title: 'Reach 800 m in a run', target: 800, reward: 80, stat: 'altitude', scope: 'daily' },
  { id: 'd_land40', title: 'Land on 40 platforms today', target: 40, reward: 30, stat: 'platforms', scope: 'daily' },
  { id: 'd_power2', title: 'Use 2 power-ups today', target: 2, reward: 40, stat: 'powerups', scope: 'daily' },
  { id: 'd_combo6', title: '6 consecutive landings', target: 6, reward: 50, stat: 'combo', scope: 'daily' },
  { id: 'd_runs3', title: 'Play 3 runs today', target: 3, reward: 30, stat: 'runs', scope: 'daily' },
  { id: 'd_perfect5', title: '5 perfect landings today', target: 5, reward: 40, stat: 'perfect', scope: 'daily' },
  { id: 'd_stomp3', title: 'Squash 3 enemies today', target: 3, reward: 50, stat: 'stomps', scope: 'daily' },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_jump', title: 'FIRST JUMP', desc: 'Reach 100 meters.', icon: '🐾' },
  { id: 'sky_explorer', title: 'SKY EXPLORER', desc: 'Reach 1,000 meters.', icon: '☁️' },
  { id: 'coin_collector', title: 'COIN COLLECTOR', desc: 'Collect 1,000 coins in total.', icon: '🪙' },
  { id: 'master_jumper', title: 'MASTER JUMPER', desc: 'Perform 50 perfect landings.', icon: '⭐' },
  { id: 'space_raccoon', title: 'SPACE RACCOON', desc: 'Reach the Space world.', icon: '🚀' },
  { id: 'unstoppable', title: 'UNSTOPPABLE', desc: 'Reach 2,500 m without a revive.', icon: '🔥' },
  { id: 'candy_lover', title: 'SWEET TOOTH', desc: 'Reach the Candy Sky.', icon: '🍭' },
  { id: 'ocean_diver', title: 'SEA RACCOON', desc: 'Reach Ocean Clouds.', icon: '🌊' },
  { id: 'ice_climber', title: 'ICE CLIMBER', desc: 'Reach Frozen Peaks.', icon: '❄️' },
  { id: 'bug_squasher', title: 'BUG SQUASHER', desc: 'Squash 25 enemies.', icon: '💥' },
];

export const FLOAT_COLORS = {
  gold: '#ffd54a',
  green: '#7dff6a',
  blue: '#7fd4ff',
  pink: '#ff8ad0',
  white: '#ffffff',
  orange: '#ffa63d',
};

export const PARTICLE_KIND: Record<WorldDef['particle'], number> = {
  leaf: 0, sprinkle: 1, bubble: 2, firefly: 3, snow: 4, ember: 5, stardust: 6,
};
