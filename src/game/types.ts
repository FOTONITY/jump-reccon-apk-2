export type PlatformType =
  | 'grass' | 'wood' | 'stone' | 'moving' | 'breakable' | 'vanish'
  | 'ice' | 'cloud' | 'mushroom' | 'spring';

export type EnemyType = 'bat' | 'hooded' | 'storm' | 'rock' | 'spiky' | 'bee' | 'ghost' | 'fish' | 'slime';
export type PowerUpType = 'leaf' | 'jetpack' | 'magnet' | 'shield' | 'double' | 'slow' | 'bounce' | 'fever';
export type PlayerState = 'idle' | 'jump' | 'fall' | 'land' | 'super' | 'hurt' | 'celebrate';
export type Expression = 'happy' | 'excited' | 'scared' | 'dizzy' | 'wow' | 'joy';
export type ControlMode = 'buttons' | 'drag' | 'tilt';

export interface Platform {
  id: number;
  type: PlatformType;
  x: number; // center x (world)
  y: number; // top y (world)
  prevY: number;
  w: number;
  h: number;
  world: number;
  // moving
  axis: 'x' | 'y';
  range: number;
  speed: number;
  phase: number;
  baseX: number;
  baseY: number;
  // breakable
  broken: boolean;
  breakT: number;
  // vanish
  cycle: number;
  alpha: number;
  solid: boolean;
  // bounce animation
  bounce: number;
  bounceV: number;
  // misc
  landedCount: number;
  dead: boolean;
  hasEnemy: boolean;
}

export interface Coin {
  x: number; y: number;
  baseX: number; baseY: number;
  phase: number;
  dead: boolean;
  vx: number; vy: number;
}

export interface FlyingCoin { x: number; y: number; t: number; sx: number; sy: number; }

export interface PowerUpItem { type: PowerUpType; x: number; y: number; phase: number; dead: boolean; }

export interface Enemy {
  type: EnemyType;
  x: number; y: number;
  vx: number; vy: number;
  w: number; h: number;
  dir: number;
  timer: number;
  phase: number;
  platformId: number;
  dead: boolean;
  dodged: boolean;
  near: boolean;
  bolt: number; // storm: >0 while lightning active
  charge: number; // storm charge / ghost visibility
  warn: number; // rock: warning time remaining
  squash: number;
  baseY: number;
}

export interface Particle {
  active: boolean;
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  size: number; color: string;
  kind: number; // 0 circle, 1 star, 2 shard, 3 ring, 4 line
  grav: number; rot: number; rotV: number;
  screen: boolean;
}

export interface FloatText {
  x: number; y: number; text: string; t: number; life: number;
  color: string; size: number; screen: boolean;
}

export interface RunResult {
  altitude: number;
  score: number;
  coins: number;
  platforms: number;
  maxCombo: number;
  perfect: number;
  powerups: number;
  stomps: number;
  world: number;
  revived: boolean;
  skin: string;
  date: number;
}

export interface LifetimeStats {
  coins: number;
  platforms: number;
  perfect: number;
  powerups: number;
  stomps: number;
  runs: number;
  maxWorld: number;
  bestNoRevive: number;
}

export type BoundaryMode = 'wrap' | 'border';
export type DifficultyMode = 'easy' | 'normal' | 'hard';

export interface Settings {
  sfx: boolean;
  music: boolean;
  shake: boolean;
  haptic: boolean;
  controls: ControlMode;
  /** WRAP = screen edges connect (classic). BORDER = solid walls. */
  boundary: BoundaryMode;
  /** 0..100, default 50 == legacy response curve. */
  sensitivity: number;
  /** Mode difficulty ramp (Game Setup). */
  difficulty: DifficultyMode;
  /** Start world chosen in Game Setup, clamped to the furthest world reached. */
  startWorld: number;
}

export interface HighScore { altitude: number; score: number; coins: number; date: number; skin: string; }

export interface SaveData {
  version: number;
  bestAltitude: number;
  bestScore: number;
  coins: number;
  unlocked: string[];
  selected: string;
  achievements: string[];
  stats: LifetimeStats;
  bestRun: { coins: number; combo: number; altitude: number; platforms: number; powerups: number };
  claimed: string[];
  daily: { date: string; progress: Record<string, number>; claimed: string[] };
  highScores: HighScore[];
  settings: Settings;
  /** Purchased the "Remove Ads" pass (coins in-game, or a real IAP later). */
  removeAds: boolean;
  /** Completed runs since the last interstitial — drives the every-3rd-run cadence. */
  runsSinceAd: number;
  /** Cloud identity, if the player has signed in (see src/game/firebase.ts). */
  uid?: string;
  /** Epoch ms of the last successful cloud write. */
  cloudSyncedAt?: number;
}

export interface LeaderboardEntry { uid: string; name: string; score: number; altitude: number; skin: string; date: number; }
export type RewardType = 'revive' | 'doubleCoins' | 'bonusCoins';

export interface MissionDef {
  id: string;
  title: string;
  target: number;
  reward: number;
  stat: 'coins' | 'altitude' | 'powerups' | 'platforms' | 'runCoins' | 'combo' | 'world' | 'perfect' | 'stomps' | 'runs';
  scope: 'lifetime' | 'run' | 'daily';
}

export interface AchievementDef { id: string; title: string; desc: string; icon: string; }

export interface SkinDef {
  id: string;
  name: string;
  price: number;
  desc: string;
  body?: string; belly?: string; mask?: string; dark?: string;
  hat: 'none' | 'explorer' | 'wizard' | 'helmet' | 'bandana' | 'ushanka' | 'ninja' | 'toque' | 'crown' | 'cowboy' | 'samurai' | 'diver' | 'firehat' | 'detective' | 'flower' | 'antenna' | 'hero';
  outfit?: 'vest' | 'robe' | 'spacesuit' | 'stripes' | 'puffer' | 'hero' | 'wrap' | 'chef' | 'royal' | 'cowboy' | 'samurai' | 'diver' | 'fire' | 'detective' | 'flower' | 'robot' | 'bee';
  prop?: 'compass' | 'staff' | 'cutlass';
  cape?: string;
  extra?: 'eyepatch' | 'scarf' | 'emblem' | 'neckerchief' | 'sparkle' | 'wrap' | 'mask';
}

export interface WorldDef {
  id: number;
  name: string;
  startM: number;
  sky: [string, string, string];
  plat: { top: string; side: string; edge: string; glow?: string };
  particle: 'leaf' | 'sprinkle' | 'bubble' | 'firefly' | 'snow' | 'ember' | 'stardust';
  fog: string;
}
