import { ACCEL, AIR_ACCEL, FLOAT_COLORS, FRICTION, GRAVITY, JUMP_V, MAX_FALL, MAX_VX, PARTICLE_KIND, POWERUPS, PX_PER_M, W, WORLDS, difficultyAtM, gameSpeedAt, worldIndexAt } from './config';
import { audio } from './audio';
import { drawRaccoon } from './raccoon';
import { drawBackground, drawCoin, drawEnemy, drawParticles, drawPlatform, drawPowerIcon, drawPowerUp } from './render';
import type { Coin, Enemy, EnemyType, Expression, FloatText, FlyingCoin, Particle, Platform, PlatformType, PlayerState, PowerUpItem, PowerUpType, RunResult, Settings, SkinDef } from './types';
import { circ, clamp, easeOutBack, lerp, pick, rand, randInt, rr, textOutline } from './utils';

export type GameMode = 'menu' | 'play' | 'pause' | 'dying' | 'over';

export interface GameCallbacks {
  onGameOver: (r: RunResult) => void;
  onWorldReached: (idx: number) => void;
  onAltitude: (m: number) => void;
  onKey: (code: string) => void;
}

interface Player {
  x: number; y: number; vx: number; vy: number;
  state: PlayerState; stateT: number; facing: number;
  sx: number; sy: number; svx: number; svy: number; // squash spring
  iceT: number; spin: number; blinkT: number; coinFlash: number; powerFlash: number; superT: number;
}

interface Ambient { x: number; y: number; vx: number; vy: number; size: number; phase: number; kind: number; }

const PLAYER_HW = 14;
const PLAYER_H = 40;
const POOL = 280;
/** Slightly zoomed-out gameplay view (0.94 ≈ ~6% more world visible vertically and
    horizontally) so upcoming platforms and enemies are readable earlier. Collision
    coordinates are untouched — this only scales the camera transform. */
const BASE_ZOOM = 0.94;

function circDist(a: number, b: number): number {
  let d = Math.abs(a - b);
  if (d > W / 2) d = W - d;
  return d;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  H = 711;
  private scale = 1;
  private dpr = 1;
  mode: GameMode = 'menu';
  settings: Settings;
  skin: SkinDef;
  bestAltitude = 0;
  private cb: GameCallbacks;
  private time = 0;
  private raf = 0;
  private lastTs = 0;
  isTouch = false;

  // input
  private keys = { left: false, right: false };
  get debugKeys() { return this.keys; }
  private pointers = new Map<number, number>();
  private anchorX = 0;
  private dragDir = 0;
  private tilt = 0;
  private pointerDownHandler?: (e: PointerEvent) => void;
  private pointerMoveHandler?: (e: PointerEvent) => void;
  private pointerUpHandler?: (e: PointerEvent) => void;

  // world
  private platforms: Platform[] = [];
  private coins: Coin[] = [];
  private flying: FlyingCoin[] = [];
  private powerups: PowerUpItem[] = [];
  private enemies: Enemy[] = [];
  private particles: Particle[] = [];
  private pIdx = 0;
  private ambient: Ambient[] = [];
  private floats: FloatText[] = [];
  private nextId = 1;

  private player: Player = this.newPlayer();
  /** Debug/test hooks used by scripts/sim.mjs; not consumed by gameplay UI. */
  get debugPlayer() { return this.player; }
  private cam = { y: 0, targetY: 0, shake: 0, sx: 0, sy: 0, zoom: BASE_ZOOM, zoomV: 0 };

  private genY = 0; private genX = W / 2; private genCount = 0; private sincePower = 0; private nextPower = 12;
  private rockTimer = 6; private feverTimer = 0; private hitStop = 0; private dyingT = 0;
  private worldBannerT = 0; private worldBannerIdx = 0; private newBestShown = false; private lastMilestone = 0;
  private comboPop = 0; private hudCoins = 0; private hudPop = 0; private shieldPopT = 0;
  private menuHop = 0; private menuHopV = 0; private menuT = 0; private runT = 0;
  private spd = 0.9; private speedPop = 0; private spdStep = 9;

  private run = { altitude: 0, bonus: 0, coins: 0, platforms: 0, combo: 0, maxCombo: 0, perfect: 0, powerups: 0, stomps: 0, world: 0, revived: false, lastPlatformId: -1, rushCount: 0, rushT: 0 };
  get debugRun() { return this.run; }
  private fx = { leaf: 0, jetpack: 0, magnet: 0, double: 0, slow: 0, fever: 0, shield: false, superBounces: 0, invuln: 0 };

  constructor(canvas: HTMLCanvasElement, settings: Settings, skin: SkinDef, cb: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.settings = settings;
    this.skin = skin;
    this.cb = cb;
    for (let i = 0; i < POOL; i++) this.particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', kind: 0, grav: 0, rot: 0, rotV: 0, screen: false });
    for (let i = 0; i < 26; i++) this.ambient.push({ x: Math.random() * W, y: Math.random() * 800, vx: 0, vy: 0, size: 1 + Math.random() * 3, phase: Math.random() * 10, kind: 0 });
    this.isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
    this.bindInput();
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  // ------------------------------------------------------------------ setup
  private newPlayer(): Player {
    return { x: W / 2, y: 0, vx: 0, vy: 0, state: 'idle', stateT: 0, facing: 1, sx: 1, sy: 1, svx: 0, svy: 0, iceT: 0, spin: 0, blinkT: 2, coinFlash: 0, powerFlash: 0, superT: 0 };
  }

  resize(cssW: number, cssH: number) {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.scale = this.canvas.width / W;
    this.H = (cssH / cssW) * W;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('deviceorientation', this.onTilt);
    if (this.pointerDownHandler) this.canvas.removeEventListener('pointerdown', this.pointerDownHandler);
    if (this.pointerMoveHandler) this.canvas.removeEventListener('pointermove', this.pointerMoveHandler);
    if (this.pointerUpHandler) {
      this.canvas.removeEventListener('pointerup', this.pointerUpHandler);
      this.canvas.removeEventListener('pointercancel', this.pointerUpHandler);
    }
    this.pointers.clear();
  }

  setSettings(s: Settings) { this.settings = s; }
  setSkin(s: SkinDef) { this.skin = s; }

  // ------------------------------------------------------------------ input
  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('deviceorientation', this.onTilt);
    const c = this.canvas;
    c.style.touchAction = 'none';
    const toX = (e: PointerEvent) => { const r = c.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * W; };
    this.pointerDownHandler = (e: PointerEvent) => {
      if (e.pointerType === 'touch') this.isTouch = true;
      try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const x = toX(e);
      if (this.pointers.size === 0) { this.anchorX = x; this.dragDir = 0; }
      this.pointers.set(e.pointerId, x);
      audio.init();
      e.preventDefault();
    };
    this.pointerMoveHandler = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      const x = toX(e);
      this.pointers.set(e.pointerId, x);
      if (this.settings.controls === 'drag') {
        const first = this.pointers.keys().next().value;
        if (first === e.pointerId) {
          const dead = this.dragDead();
          let d = x - this.anchorX;
          if (Math.abs(d) > dead) { this.anchorX = x - Math.sign(d) * dead; d = Math.sign(d) * dead; }
          this.dragDir = clamp(d / dead, -1, 1);
        }
      }
    };
    this.pointerUpHandler = (e: PointerEvent) => { this.pointers.delete(e.pointerId); if (this.pointers.size === 0) this.dragDir = 0; };
    c.addEventListener('pointerdown', this.pointerDownHandler);
    c.addEventListener('pointermove', this.pointerMoveHandler);
    c.addEventListener('pointerup', this.pointerUpHandler);
    c.addEventListener('pointercancel', this.pointerUpHandler);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { this.keys.left = true; e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { this.keys.right = true; e.preventDefault(); }
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter' || e.code === 'Space') { this.cb.onKey(e.code); if (e.code === 'Space') e.preventDefault(); }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = false;
  };
  private onTilt = (e: DeviceOrientationEvent) => { if (e.gamma !== null) this.tilt = e.gamma; };

  private inputDir(): number {
    let d = 0;
    if (this.keys.left) d -= 1;
    if (this.keys.right) d += 1;
    if (this.pointers.size > 0) {
      if (this.settings.controls === 'drag') d = this.dragDir;
      else { let s = 0; this.pointers.forEach((x) => { s += x < W / 2 ? -1 : 1; }); d = clamp(s, -1, 1); }
    } else if (this.settings.controls === 'tilt' && d === 0) {
      const g = this.tilt;
      d = Math.abs(g) < 3 ? 0 : clamp(g / this.tiltSpan(), -1, 1);
    }
    return clamp(d, -1, 1);
  }

  touchSide(): number {
    if (this.pointers.size === 0) return 0;
    let s = 0; this.pointers.forEach((x) => { s += x < W / 2 ? -1 : 1; }); return Math.sign(s);
  }

  // ---- control sensitivity (0..100; 50 reproduces the legacy response) ----
  private sensNorm(): number { return clamp(this.settings.sensitivity ?? 50, 0, 100) / 100; }
  /** >1 below default sensitivity: drag/tilt need more physical travel. */
  private sensSpan(): number { return 1 + (0.5 - this.sensNorm()) * 1.2; }
  private dragDead(): number { return clamp(42 * this.sensSpan(), 14, 70); }
  private tiltSpan(): number { return clamp(22 * this.sensSpan(), 8, 36); }
  private accelMult(): number { return 0.6 + 0.8 * this.sensNorm(); }
  private topSpeedMult(): number { return 0.85 + 0.3 * this.sensNorm(); }
  /** Horizontal distance under the active movement-boundary rule. */
  private hd(a: number, b: number): number {
    return this.settings.boundary === 'border' ? Math.abs(a - b) : circDist(a, b);
  }

  // ------------------------------------------------------------------ run control
  start() {
    this.platforms = []; this.coins = []; this.flying = []; this.powerups = []; this.enemies = []; this.floats = [];
    for (const p of this.particles) p.active = false;
    // Start location from Game Setup: clamped to the furthest world reached so the
    // player can never begin somewhere they have not unlocked. Starts that world's
    // altitude and difficulty/speed reflect it naturally.
    const sw = clamp(Math.round(this.settings.startWorld ?? 0), 0, WORLDS.length - 1);
    const startAlt = WORLDS[sw].startM;
    const y0 = -startAlt * PX_PER_M;
    this.player = this.newPlayer();
    this.player.x = W / 2; this.player.y = y0; this.player.vy = -JUMP_V; this.player.state = 'jump';
    this.cam.y = y0 - this.H * 0.72; this.cam.targetY = this.cam.y; this.cam.shake = 0; this.cam.zoom = BASE_ZOOM; this.cam.zoomV = 0;
    this.nextId = 1;
    this.addPlatform('grass', W / 2, y0, 170, sw);
    this.genY = y0; this.genX = W / 2; this.genCount = 0; this.sincePower = 0; this.nextPower = randInt(10, 16);
    this.run = { altitude: startAlt, bonus: 0, coins: 0, platforms: 0, combo: 0, maxCombo: 0, perfect: 0, powerups: 0, stomps: 0, world: sw, revived: false, lastPlatformId: -1, rushCount: 0, rushT: 0 };
    this.fx = { leaf: 0, jetpack: 0, magnet: 0, double: 0, slow: 0, fever: 0, shield: false, superBounces: 0, invuln: 0 };
    this.rockTimer = 6; this.hitStop = 0; this.worldBannerT = 0; this.newBestShown = false; this.lastMilestone = 0; this.hudCoins = 0; this.comboPop = 0;
    this.ensurePlatforms();
    this.runStart = Date.now(); this.runT = 0; this.spd = gameSpeedAt(startAlt, this.settings.difficulty); this.spdStep = Math.floor(this.spd * 10 + 1e-6); this.speedPop = 0;
    this.mode = 'play';
    audio.setWorld(sw);
    audio.setContext('game');
    audio.setPaused(false);
    audio.jump();
  }

  toMenu() { this.mode = 'menu'; this.menuT = 0; audio.setWorld(0); audio.setContext('menu'); audio.setPaused(false); }
  pause() { if (this.mode === 'play') { this.mode = 'pause'; audio.setPaused(true); } }
  resume() { if (this.mode === 'pause') { this.mode = 'play'; this.lastTs = performance.now(); audio.setPaused(false); } }

  revive() {
    const p = this.player;
    this.mode = 'play';
    this.run.revived = true;
    p.state = 'jump'; p.spin = 0; p.vx = 0; p.vy = -JUMP_V * 0.6; p.x = W / 2;
    p.y = this.cam.y + this.H * 0.5;
    this.cam.targetY = this.cam.y;
    const plat = this.addPlatform('grass', W / 2, p.y + 6, 150, this.run.world);
    plat.landedCount = 1;
    this.fx.shield = true; this.fx.invuln = 3; this.fx.jetpack = 0;
    for (const e of this.enemies) if (e.y > this.cam.y - 100 && e.y < this.cam.y + this.H + 100) e.dead = true;
    this.burst(p.x, p.y - 20, 18, '#9ed0ff', 1, 220);
    this.ring(p.x, p.y - 20, '#ffffff');
    this.float(p.x, p.y - 60, 'REVIVED!', FLOAT_COLORS.blue, 20);
    audio.revive();
  }

  getResult(): RunResult {
    return {
      altitude: Math.floor(this.run.altitude), score: this.score(), coins: this.run.coins, platforms: this.run.platforms,
      maxCombo: this.run.maxCombo, perfect: this.run.perfect, powerups: this.run.powerups, stomps: this.run.stomps,
      world: this.run.world, revived: this.run.revived, skin: this.skin.id, date: this.runStart,
    };
  }
  private runStart = 0;

  private score(): number { return Math.floor(this.run.altitude * 10 + this.run.bonus); }

  // ------------------------------------------------------------------ helpers
  private addPlatform(type: PlatformType, x: number, y: number, w: number, world: number): Platform {
    const p: Platform = {
      id: this.nextId++, type, x: this.settings.boundary === 'border' ? clamp(x, w / 2 + 6, W - w / 2 - 6) : ((x % W) + W) % W, y, prevY: y, w, h: 18, world,
      axis: 'x', range: 0, speed: 0, phase: Math.random() * Math.PI * 2, baseX: 0, baseY: y,
      broken: false, breakT: 0, cycle: 3, alpha: 1, solid: true, bounce: 0, bounceV: 0, landedCount: 0, dead: false, hasEnemy: false,
    };
    p.baseX = p.x;
    this.platforms.push(p);
    return p;
  }

  // ---------------------------------------------------------------- performance governor
  /** Exponential moving average of the frame time (ms). ~16.7 at a locked 60 FPS. */
  frameEma = 16.7;
  /** 0..1 quality multiplier derived from frameEma: 1 = full FX, 0.35 = budget mode. */
  perfScale = 1;
  /** True while the device is under ~45 FPS: cheaper alpha blending, fewer trails. */
  lowPerf = false;
  private perfCooldown = 0;
  private frameCount = 0;
  /** `?debug` in the URL shows FPS + quality in the HUD. */
  debugHud = typeof location !== 'undefined' && /[?&]debug/.test(location.search);
  get fps() { return 1000 / Math.max(1, this.frameEma); }

  private samplePerf(frameMs: number) {
    // Ignore tab-switch / pause gaps so a single 300 ms frame doesn't trip budget mode.
    if (frameMs > 250) return;
    this.frameEma += (frameMs - this.frameEma) * 0.08;
    const fps = 1000 / this.frameEma;
    // Hysteresis: drop into budget mode below 45 FPS, climb out only above 55 FPS.
    if (!this.lowPerf && fps < 45) { this.lowPerf = true; this.perfCooldown = 2; }
    else if (this.lowPerf && fps > 55 && this.perfCooldown <= 0) this.lowPerf = false;
    if (this.perfCooldown > 0) this.perfCooldown -= frameMs / 1000;
    // Smooth 60→30 FPS maps to 1.0→0.35 particle density.
    const target = clamp((fps - 30) / 30, 0, 1) * 0.65 + 0.35;
    this.perfScale += (target - this.perfScale) * 0.05;
  }
  /** Scale an emitter count by the current quality; always keeps at least one particle for feedback. */
  private pcount(n: number): number { return n <= 1 ? n : Math.max(1, Math.round(n * this.perfScale)); }

  private spawnParticle(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, kind = 0, grav = 0, screen = false) {
    const p = this.particles[this.pIdx]; this.pIdx = (this.pIdx + 1) % POOL;
    p.active = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.maxLife = life; p.size = size; p.color = color; p.kind = kind; p.grav = grav; p.rot = Math.random() * 6; p.rotV = rand(-6, 6); p.screen = screen;
  }
  private burst(x: number, y: number, n: number, color: string, kind = 0, speed = 160, grav = 300) {
    const count = this.pcount(n);
    for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2; const s = rand(speed * 0.3, speed); this.spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s - speed * 0.3, rand(0.35, 0.7), rand(2, 5), color, kind, grav); }
  }
  private ring(x: number, y: number, color: string) { this.spawnParticle(x, y, 0, 0, 0.4, 30, color, 3); }
  private float(x: number, y: number, text: string, color: string, size = 18, screen = false) {
    this.floats.push({ x, y, text, t: 0, life: 1.0, color, size, screen });
    if (this.floats.length > 10) this.floats.shift();
  }
  private addBonus(n: number) { this.run.bonus += n; }
  private buzz(ms: number) {
    if (!this.settings.haptic) return;
    try { navigator.vibrate?.(ms); } catch { /* ignore */ }
  }

  // ------------------------------------------------------------------ generation
  private reachFor(gap: number): number {
    const disc = Math.max(0, JUMP_V * JUMP_V - 2 * GRAVITY * gap);
    const t2 = (JUMP_V + Math.sqrt(disc)) / GRAVITY;
    return MAX_VX * Math.max(0.1, t2 - 0.12);
  }

  private ensurePlatforms() {
    const limit = this.cam.y - this.H * 1.3;
    let guard = 0;
    while (this.genY > limit && guard++ < 200) this.generateStep();
  }

  private generateStep() {
    const alt = -this.genY / PX_PER_M;
    const d = difficultyAtM(alt, this.settings.difficulty);
    const world = worldIndexAt(alt);
    const early = this.genCount < 6;
    // ---- gap ranges tuned to JUMP_V=820 / GRAVITY=2600 (max height ≈ 129 px).
    // Gaps are capped below the physics limit in generateStep's maxPhysicalGap guard.
    // Easy: tighter lower-bound so gaps are forgiving; Hard: wider spread for challenge.
    const diffMode = this.settings.difficulty ?? 'normal';
    const gapMinBase = early ? 42 : lerp(46, 72, d);
    const gapMaxBase = early ? 66 : lerp(80, 112, d);
    const gapMin = diffMode === 'easy' ? gapMinBase * 0.88 : diffMode === 'hard' ? gapMinBase * 1.08 : gapMinBase;
    const gapMax = diffMode === 'easy' ? gapMaxBase * 0.88 : diffMode === 'hard' ? gapMaxBase * 1.08 : gapMaxBase;
    let gap = rand(gapMin, gapMax);
    const w = (early ? 110 : lerp(100, 64, d)) * rand(0.92, 1.1);

    // choose type for the main (always landable) path
    let type: PlatformType = 'grass';
    const r = Math.random();
    if (!early) {
      const pMove = lerp(0, 0.28, Math.max(0, (d - 0.08) / 0.92));
      const pIce = (world === 4 || world === 1) && d > 0.15 ? 0.22 : d > 0.45 ? 0.06 : 0;
      const pCloud = world >= 1 && d > 0.15 ? 0.14 : 0;
      const pWood = world === 0 ? 0.18 : 0.06;
      const pStone = world === 0 || world === 3 ? 0.12 : 0.05;
      let acc = 0;
      if (r < (acc += pMove)) type = 'moving';
      else if (r < (acc += pIce)) type = 'ice';
      else if (r < (acc += pCloud)) type = 'cloud';
      else if (r < (acc += pWood)) type = 'wood';
      else if (r < (acc += pStone)) type = 'stone';
    }
    let range = 0;
    let axis: 'x' | 'y' = 'x';
    if (type === 'moving') {
      axis = d > 0.4 && Math.random() < 0.3 ? 'y' : 'x';
      range = axis === 'x' ? rand(30, 75) : rand(20, 35);
      if (axis === 'y') gap = Math.min(gap, 100);
    }
    // Hard cap: gap must never exceed the physical jump height minus a safety buffer.
    // JUMP_V²/(2*GRAVITY) gives max pixel height; subtract 12 px as a comfortable margin.
    const maxPhysicalGap = Math.floor(JUMP_V * JUMP_V / (2 * GRAVITY)) - 12;
    gap = Math.min(gap, maxPhysicalGap);

    const y = this.genY - gap;
    const reach = this.reachFor(gap) * lerp(0.6, 0.9, d) - (axis === 'x' ? range * 0.5 : 0);
    // bias away from tiny offsets at higher difficulty so the path zig-zags more
    let dx = rand(-reach, reach);
    if (d > 0.3 && Math.abs(dx) < reach * 0.25) dx = Math.sign(dx || 1) * reach * rand(0.25, 0.6);
    let x = this.genX + dx;

    // ---- overlap / separation validation with fallback.
    // Re-roll the x position up to MAX_TRIES if horizontal overlap is detected.
    // After MAX_TRIES, fall back to placing the platform directly above the previous
    // one (dx=0 after clamping) — always reachable, never overlaps vertically.
    const MIN_DX = 16; // min horizontal edge-to-edge clearance
    const MAX_TRIES = 6;
    const checkOverlap = (cx: number): boolean => {
      for (let k = this.platforms.length - 1; k >= 0; k--) {
        const q = this.platforms[k];
        if (q.y < this.genY - 280) break; // far above; no longer relevant
        if (q.y <= y) continue;           // above the candidate; skip
        const hdx = this.settings.boundary === 'border' ? Math.abs(q.x - cx) : circDist(q.x, cx);
        const qHalf = q.w / 2 + (q.type === 'moving' && q.axis === 'x' ? q.range : 0);
        if (hdx < w / 2 + qHalf + MIN_DX) return true; // overlap detected
      }
      return false;
    };
    let overlapping = checkOverlap(x);
    for (let try_ = 1; try_ < MAX_TRIES && overlapping; try_++) {
      dx = rand(-reach * 0.9, reach * 0.9);
      x = this.genX + dx;
      overlapping = checkOverlap(x);
    }
    // Clamp to screen bounds AFTER overlap resolution so the final position is validated.
    if (this.settings.boundary === 'border') {
      x = clamp(x, w / 2 + 6, W - w / 2 - 6);
    } else {
      x = ((x % W) + W) % W;
    }
    // Final reachability guard: if after all retries the horizontal distance to
    // the previous platform still exceeds what the player can cover with a full
    // jump, pull x toward genX enough to guarantee a path.
    {
      const hd2 = this.settings.boundary === 'border' ? Math.abs(x - this.genX) : circDist(x, this.genX);
      if (hd2 > reach && reach > 0) {
        const dir2 = this.settings.boundary !== 'border' && (x - this.genX) > W / 2 ? -1 : Math.sign(x - this.genX) || 1;
        x = this.genX + dir2 * Math.min(hd2, reach * 0.95);
        if (this.settings.boundary === 'border') x = clamp(x, w / 2 + 6, W - w / 2 - 6);
        else x = ((x % W) + W) % W;
      }
    }

    const p = this.addPlatform(type, x, y, w, world);
    if (type === 'moving') {
      p.axis = axis; p.range = range; p.speed = lerp(0.8, 2.2, d) * rand(0.8, 1.2);
      p.baseX = p.x; p.baseY = y;
    }
    this.genY = y; this.genX = p.x; this.genCount++;

    // helper stepping stone for wide gaps (threshold adjusted for JUMP_V=820: 100 px)
    const helperThreshold = 100;
    if (gap > helperThreshold && Math.random() < 0.50) {
      const hx = p.x + (Math.random() < 0.5 ? -1 : 1) * rand(60, Math.min(120, reach * 0.8));
      const helperType: PlatformType = world >= 3 ? 'cloud' : world >= 1 ? 'cloud' : 'grass';
      this.addPlatform(helperType, hx, y + gap * 0.48, w * 0.82, world);
    }

    // extras (risky routes / rewards) — reduce spawn rate on Easy for calmer experience
    const extChance = (this.settings.difficulty === 'easy') ? lerp(0.20, 0.40, d)
                    : (this.settings.difficulty === 'hard') ? lerp(0.42, 0.65, d)
                    : lerp(0.32, 0.55, d);
    if (!early && Math.random() < extChance) this.addExtra(p, d, world, gap);

    // coins
    if (Math.random() < 0.42) this.coinPattern(p.x, y, pick(['line', 'arc', 'vertical', 'spiral']));

    // power-up
    if (++this.sincePower >= this.nextPower) {
      this.sincePower = 0; this.nextPower = randInt(13, 24);
      this.powerups.push({ type: this.pickPower(d), x: p.x, y: y - 70, phase: Math.random() * 6, dead: false });
    }

    // enemies — placed only when:
    // 1. Player has climbed past the initial easy zone (alt > 130)
    // 2. No other enemy is within a generous vertical window (reaction time)
    // 3. Enemy is vertically centred in the gap, never right above a platform top
    if (alt > 130) {
      const pBat   = lerp(0.03, 0.14, d);
      const pStorm = alt > 500 ? lerp(0, 0.08, d) : 0;
      // Hard mode has slightly more enemies; Easy has fewer
      const diffMode2 = this.settings.difficulty ?? 'normal';
      const enemyScale = diffMode2 === 'easy' ? 0.6 : diffMode2 === 'hard' ? 1.25 : 1.0;
      const rr2 = Math.random();
      // Minimum 280 px between any two enemies for reaction time
      const farFromOthers = this.enemies.every((e) => Math.abs(e.y - y) > 280);
      if (farFromOthers && rr2 < enemyScale) {
        // Place enemy in the mid-to-upper part of the gap so the player sees it
        // before the preceding platform disappears off the bottom of the viewport.
        const ey = y + gap * 0.42;
        if      (world === 2 && rr2 < 0.2 * enemyScale)              this.spawnEnemy('fish',  rand(35, W - 35), ey, -1);
        else if (world === 1 && rr2 < 0.16 * enemyScale)             this.spawnEnemy('bee',   rand(35, W - 35), ey, -1);
        else if (world === 3 && rr2 < 0.16 * enemyScale)             this.spawnEnemy('ghost', rand(35, W - 35), ey, -1);
        else if (rr2 < pBat * enemyScale)                             this.spawnEnemy('bat',   rand(35, W - 35), ey, -1);
        else if (rr2 < (pBat + pStorm) * enemyScale)                 this.spawnEnemy('storm', rand(45, W - 45), y + gap * 0.48, -1);
      }
    }
  }

  private addExtra(main: Platform, d: number, world: number, gap: number) {
    const r = Math.random();
    let type: PlatformType = 'breakable';
    if (r < 0.32) type = 'breakable';
    else if (r < 0.47 && d > 0.22) type = 'vanish';
    else if (r < 0.62 && d > 0.08) type = 'mushroom';
    else if (r < 0.68 && d > 0.18) type = 'spring';
    else if (r < 0.82 && d > 0.2) type = 'grass'; // dangerous (enemy) platform
    else type = world >= 1 ? 'cloud' : 'grass';
    const w = lerp(90, 60, d);
    const side = Math.random() < 0.5 ? -1 : 1;
    const dist = main.w / 2 + w / 2 + rand(30, 110);
    const x = main.x + side * dist;
    const y = main.y + rand(-gap * 0.45, 20);
    const p = this.addPlatform(type, x, y, w, world);
    if (type === 'vanish') { p.cycle = lerp(3.4, 2.0, d); p.phase = Math.random() * p.cycle; }
    // Only put enemies on a solid grass platform large enough to be visible
    if (type === 'grass' && r < 0.82 && r >= 0.68 && p.w >= 72) {
      p.hasEnemy = true; p.w = Math.max(p.w, 84);
      const et: EnemyType = world === 4 ? 'slime' : Math.random() < 0.5 ? 'spiky' : 'hooded';
      this.spawnEnemy(et, p.x, p.y - 17, p.id);
      this.coinPattern(p.x, p.y, 'arc');
    } else if (Math.random() < 0.65) {
      this.coinPattern(p.x, p.y, type === 'mushroom' || type === 'spring' ? 'vertical' : pick(['line', 'arc', 'spiral']));
    }
    // risk/reward trail hanging over the void
    if (type === 'breakable' && Math.random() < 0.5) {
      const tx = x + side * (w / 2 + 40);
      for (let i = 0; i < 5; i++) this.addCoin(tx, y - 20 - i * 28);
    }
  }

  private pickPower(d: number): PowerUpType {
    const weights: [PowerUpType, number][] = [
      ['shield', 20], ['magnet', 18], ['double', 16], ['leaf', 14], ['bounce', 12], ['slow', d > 0.15 ? 10 : 0], ['jetpack', 8], ['fever', 6],
    ];
    let total = 0; for (const wgt of weights) total += wgt[1];
    let r = Math.random() * total;
    for (const [t, wgt] of weights) { r -= wgt; if (r <= 0) return t; }
    return 'shield';
  }

  private addCoin(x: number, y: number) {
    if (this.coins.length > 70) return;
    const wx = this.settings.boundary === 'border' ? clamp(x, 16, W - 16) : ((x % W) + W) % W;
    this.coins.push({ x: wx, y, baseX: wx, baseY: y, phase: Math.random() * 6, dead: false, vx: 0, vy: 0 });
  }

  private coinPattern(px: number, py: number, kind: string) {
    switch (kind) {
      case 'line': { const n = randInt(3, 5); for (let i = 0; i < n; i++) this.addCoin(px + (i - (n - 1) / 2) * 26, py - 48); break; }
      case 'arc': for (let i = 0; i < 5; i++) { const k = (i - 2) / 2; this.addCoin(px + k * 52, py - 45 - (1 - k * k) * 34); } break;
      case 'vertical': for (let i = 0; i < 4; i++) this.addCoin(px, py - 48 - i * 30); break;
      case 'spiral': for (let i = 0; i < 6; i++) this.addCoin(px + Math.sin(i * 1.15) * 30, py - 40 - i * 24); break;
    }
  }

  private spawnEnemy(type: EnemyType, x: number, y: number, platformId: number) {
    const d = difficultyAtM(this.run.altitude, this.settings.difficulty);
    const e: Enemy = {
      type, x: this.settings.boundary === 'border' ? clamp(x, 24, W - 24) : ((x % W) + W) % W, y, vx: 0, vy: 0, w: 30, h: 26, dir: Math.random() < 0.5 ? -1 : 1, timer: rand(1, 3), phase: Math.random() * 6,
      platformId, dead: false, dodged: false, near: false, bolt: 0, charge: 0, warn: 0, squash: 0, baseY: y,
    };
    if (type === 'bat') { e.vx = (60 + d * 120) * e.dir; e.w = 30; e.h = 22; }
    if (type === 'hooded') { e.w = 26; e.h = 32; e.timer = rand(1.2, 2.2) * (1 + d); }
    if (type === 'storm') { e.w = 44; e.h = 28; e.timer = rand(1.5, 3); e.vx = 30 * e.dir; }
    if (type === 'rock') { e.w = 26; e.h = 26; e.warn = 0.9; e.vy = 0; }
    this.enemies.push(e);
  }

  // ------------------------------------------------------------------ update
  private tick = (ts: number) => {
    const frameMs = ts - this.lastTs;
    let dt = Math.min(0.05, frameMs / 1000);
    this.lastTs = ts;
    if (dt <= 0) dt = 0.001;
    this.step(dt);
    try { this.render(); } catch (e) { console.error('[engine] render error', e); }
    this.raf = requestAnimationFrame(this.tick);
  };

  /** Single simulation step. Public for deterministic headless tests only. */
  step(dt: number) {
    this.frameCount++;
    if (this.mode === 'play') this.samplePerf(dt * 1000);
    let rem = dt;
    while (rem > 0) { const s = Math.min(rem, 1 / 60); this.update(s); rem -= s; }
  }

  /** Public render entry for the headless smoke test. */
  draw() {
    try { this.render(); } catch (e) { console.error('[engine] render error', e); }
  }

  private update(dt: number) {
    if (this.mode === 'menu') { this.updateMenu(dt); return; }
    if (this.mode === 'pause' || this.mode === 'over') return;
    if (this.mode === 'dying') {
      this.dyingT += dt; this.time += dt * 0.3;
      this.updateParticles(dt * 0.3); this.updateFloats(dt * 0.5);
      this.cam.shake *= Math.exp(-6 * dt);
      if (this.dyingT > 0.85) { this.mode = 'over'; this.cb.onGameOver(this.getResult()); }
      return;
    }
    if (this.hitStop > 0) { this.hitStop -= dt; this.updateParticles(dt); return; }
    // Gameplay speed is a deterministic function of altitude (config.gameSpeedAt),
    // refreshed in the altitude section below. Applied here as a uniform time
    // dilation: physics, platforms, enemies and timers all integrate with the same
    // scaled dt, so spatial relationships — and generation fairness — are unchanged.
    // Completely independent of the FPS/performance governor (frameEma/perfScale).
    this.speedPop = Math.max(0, this.speedPop - dt);
    dt *= this.spd;
    this.time += dt; this.runT += dt;
    const p = this.player;
    const slowF = this.fx.slow > 0 ? 0.35 : 1;

    // timers
    for (const k of ['leaf', 'jetpack', 'magnet', 'double', 'slow', 'fever', 'invuln'] as const) if (this.fx[k] > 0) this.fx[k] = Math.max(0, this.fx[k] - dt);
    p.coinFlash = Math.max(0, p.coinFlash - dt); p.powerFlash = Math.max(0, p.powerFlash - dt); p.superT = Math.max(0, p.superT - dt); p.iceT = Math.max(0, p.iceT - dt);
    this.shieldPopT = Math.max(0, this.shieldPopT - dt); this.comboPop = Math.max(0, this.comboPop - dt); this.hudPop = Math.max(0, this.hudPop - dt);
    if (this.worldBannerT > 0) this.worldBannerT -= dt;
    if (this.run.rushT > 0) { this.run.rushT -= dt; if (this.run.rushT <= 0) this.run.rushCount = 0; }
    p.blinkT -= dt; if (p.blinkT < -0.12) p.blinkT = rand(2, 5);

    // ---- horizontal movement
    const dir = this.inputDir();
    const hurt = p.state === 'hurt';
    if (!hurt) {
      const icy = p.iceT > 0;
      const accel = (p.state === 'idle' ? ACCEL : AIR_ACCEL) * (icy ? 0.35 : 1) * this.accelMult();
      if (dir !== 0) {
        p.vx += dir * accel * dt;
        const max = (MAX_VX * Math.abs(dir) + 40) * this.topSpeedMult();
        if (Math.abs(p.vx) > max) p.vx = Math.sign(p.vx) * Math.max(max, Math.abs(p.vx) - FRICTION * dt);
        if (Math.abs(dir) > 0.2) p.facing = dir > 0 ? 1 : -1;
      } else {
        const f = FRICTION * (icy ? 0.15 : 1) * dt;
        p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
      }
    } else {
      p.vx *= Math.exp(-1.5 * dt);
      p.spin += 7 * dt * p.facing;
    }

    // ---- vertical movement
    const prevY = p.y;
    if (this.fx.jetpack > 0) {
      p.vy = lerp(p.vy, -1250, Math.min(1, 9 * dt));
      audio.jetpack(this.time);
      if (!this.lowPerf || (this.frameCount & 1) === 0) for (let i = 0, n = this.pcount(2); i < n; i++) this.spawnParticle(p.x + rand(-8, 8), p.y - 6, rand(-40, 40), rand(150, 320), rand(0.25, 0.5), rand(3, 7), pick(['#ff9a2e', '#ffe14a', '#ff5a3c']), 0, -200);
      if (this.fx.jetpack < 0.05) p.superT = 0;
    } else {
      p.y += p.vy * dt + 0.5 * GRAVITY * dt * dt;
      p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
    }
    if (this.fx.jetpack > 0) p.y += p.vy * dt;
    p.x += p.vx * dt;
    if (this.settings.boundary === 'border') p.x = clamp(p.x, PLAYER_HW * 0.5, W - PLAYER_HW * 0.5);
    else if (p.x < 0) p.x += W; else if (p.x >= W) p.x -= W;

    // ---- state
    p.stateT += dt;
    if (!hurt) {
      if (p.state === 'land' && p.stateT < 0.1) { /* keep */ }
      else if (this.fx.jetpack > 0 || p.superT > 0) p.state = 'super';
      else p.state = p.vy < 0 ? 'jump' : 'fall';
    }

    // ---- squash spring
    const k = 420, c = 16;
    p.svx += (-(p.sx - 1) * k - p.svx * c) * dt; p.sx += p.svx * dt;
    p.svy += (-(p.sy - 1) * k - p.svy * c) * dt; p.sy += p.svy * dt;

    // ---- platforms
    this.updatePlatforms(dt, slowF);
    if (!hurt && this.fx.jetpack <= 0 && p.vy > 0) {
      for (const pl of this.platforms) {
        if (pl.dead || pl.broken || !pl.solid) continue;
        if (this.hd(p.x, pl.x) > pl.w / 2 + PLAYER_HW * 0.7) continue;
        if (prevY <= pl.prevY + 3 && p.y >= pl.y) { this.land(pl); break; }
      }
    }

    // ---- coins
    this.updateCoins(dt);
    // ---- power-ups
    for (const pu of this.powerups) {
      if (pu.dead) continue;
      if (this.hd(p.x, pu.x) < 30 && Math.abs(p.y - 22 - pu.y) < 34) { pu.dead = true; this.activatePower(pu.type); }
    }
    // ---- enemies
    this.updateEnemies(dt, slowF);
    // ---- fever coins
    if (this.fx.fever > 0) {
      this.feverTimer -= dt;
      if (this.feverTimer <= 0) { this.feverTimer = 0.11; this.addCoin(rand(20, W - 20), this.cam.y - rand(20, 120)); if (!this.lowPerf) this.spawnParticle(rand(0, W), this.cam.y + rand(0, this.H), rand(-30, 30), rand(-60, -20), 0.8, 4, pick(['#ff4b6e', '#ffc42e', '#5fd648', '#3f9cff', '#c85cff']), 1); }
    }
    // ---- rocks
    const rockWorld = this.run.world >= 5 || (this.run.world === 4 && this.run.altitude > 2500);
    // Easy: disable rocks entirely; Normal/Hard: keep existing behaviour
    if (rockWorld && this.run.altitude > 300 && this.settings.difficulty !== 'easy') {
      this.rockTimer -= dt;
      if (this.rockTimer <= 0) {
        const d = difficultyAtM(this.run.altitude, this.settings.difficulty);
        this.rockTimer = rand(5, 10) - d * 3;
        const rx = clamp(p.x + rand(-120, 120), 30, W - 30);
        this.spawnEnemy('rock', rx, this.cam.y - 40, -1);
        audio.warning();
      }
    }

    // ---- camera
    // Raccoon is framed in the lower-middle of the screen, leaving generous
    // look-ahead above (upcoming platforms/enemies). The upper clamp at 14% is
    // still in place so during big jumps the raccoon can still approach the top
    // boundary without being artificially held down.
    const line = this.H * 0.55;
    if (p.y - this.cam.y < line) this.cam.targetY = Math.min(this.cam.targetY, p.y - line);
    this.cam.y += (this.cam.targetY - this.cam.y) * Math.min(1, 10 * dt);
    if (p.y - this.cam.y < this.H * 0.14) { this.cam.y = p.y - this.H * 0.14; this.cam.targetY = Math.min(this.cam.targetY, this.cam.y); }
    if (this.cam.shake > 0) { this.cam.shake *= Math.exp(-7 * dt); if (this.cam.shake < 0.15) this.cam.shake = 0; this.cam.sx = rand(-1, 1) * this.cam.shake; this.cam.sy = rand(-1, 1) * this.cam.shake; } else { this.cam.sx = 0; this.cam.sy = 0; }
    this.cam.zoomV += (-(this.cam.zoom - BASE_ZOOM) * 260 - this.cam.zoomV * 18) * dt; this.cam.zoom += this.cam.zoomV * dt;

    // ---- altitude / score / world
    const alt = Math.max(this.run.altitude, -p.y / PX_PER_M);
    if (alt > this.run.altitude) this.run.altitude = alt;
    // Gradual, deterministic speed progression (altitude-driven, smooth curve).
    const gs = gameSpeedAt(alt, this.settings.difficulty);
    if (gs !== this.spd) {
      this.spd = gs;
      const step = Math.floor(gs * 10 + 1e-6);
      if (step > this.spdStep) { // notify on each +0.1x, never a big jump
        this.spdStep = step; this.speedPop = 1.4;
        this.float(W / 2, this.H * 0.36, 'SPEED UP!', FLOAT_COLORS.gold, 20, true);
        audio.combo(6); this.buzz(20);
      }
    }
    if (!this.newBestShown && this.bestAltitude > 0 && alt > this.bestAltitude) { this.newBestShown = true; this.float(W / 2, this.H * 0.3, 'NEW BEST!', FLOAT_COLORS.gold, 26, true); audio.newBest(); }
    if (Math.floor(alt / 100) > this.lastMilestone) {
      this.lastMilestone = Math.floor(alt / 100);
      this.cb.onAltitude(this.lastMilestone * 100);
      // Play an exciting reward SFX every 500 m, a quieter ping for each 100 m.
      if (this.lastMilestone % 5 === 0) audio.milestone();
      else audio.altitudePing();
    }
    const wi = worldIndexAt(alt);
    if (wi > this.run.world) {
      this.run.world = wi; this.worldBannerT = 1.6; this.worldBannerIdx = wi; audio.setWorld(wi); audio.locationShift(); this.cb.onWorldReached(wi);
    }

    // ---- death
    if (p.y - this.cam.y > this.H + 60) this.die();

    // ---- generation & cleanup
    this.ensurePlatforms();
    const killY = this.cam.y + this.H + 160;
    if (this.platforms.length && this.platforms[0].y > killY) this.platforms = this.platforms.filter((pl) => !pl.dead && pl.y < killY);
    else if (this.platforms.some((pl) => pl.dead)) this.platforms = this.platforms.filter((pl) => !pl.dead);
    if (this.coins.some((cn) => cn.dead || cn.y > killY)) this.coins = this.coins.filter((cn) => !cn.dead && cn.y < killY);
    if (this.powerups.some((pu) => pu.dead || pu.y > killY)) this.powerups = this.powerups.filter((pu) => !pu.dead && pu.y < killY);
    if (this.enemies.some((e) => e.dead || e.y > killY)) this.enemies = this.enemies.filter((e) => !e.dead && e.y < killY);

    this.updateParticles(dt);
    this.updateFloats(dt);
    this.updateFlying(dt);
    this.updateAmbient(dt, (this.cam.y - this.camPrev));
    this.camPrev = this.cam.y;
  }
  private camPrev = 0;

  private updatePlatforms(dt: number, slowF: number) {
    for (const pl of this.platforms) {
      pl.prevY = pl.y;
      if (pl.type === 'moving') {
        pl.phase += dt * pl.speed * slowF;
        if (pl.axis === 'x') {
          const nx = pl.baseX + Math.sin(pl.phase) * pl.range;
          pl.x = this.settings.boundary === 'border' ? clamp(nx, pl.w / 2 + 4, W - pl.w / 2 - 4) : ((nx % W) + W) % W;
        }
        else pl.y = pl.baseY + Math.sin(pl.phase) * pl.range;
      } else if (pl.type === 'breakable' && pl.broken) {
        pl.breakT += dt; if (pl.breakT > 0.7) pl.dead = true;
      } else if (pl.type === 'vanish') {
        pl.phase += dt;
        const cyc = pl.phase % pl.cycle;
        pl.solid = cyc < pl.cycle * 0.62;
        pl.alpha += ((pl.solid ? 1 : 0) - pl.alpha) * Math.min(1, 8 * dt);
      }
      if (pl.bounce !== 0 || pl.bounceV !== 0) {
        pl.bounceV += (-pl.bounce * 380 - pl.bounceV * 9) * dt; pl.bounce += pl.bounceV * dt;
        if (Math.abs(pl.bounce) < 0.05 && Math.abs(pl.bounceV) < 1) { pl.bounce = 0; pl.bounceV = 0; }
      }
    }
  }

  private land(pl: Platform) {
    const p = this.player;
    p.y = pl.y;
    const sameAsLast = pl.id === this.run.lastPlatformId;
    const special = pl.type === 'mushroom' || pl.type === 'spring';
    let mult = 1;
    if (pl.type === 'mushroom') { mult = 1.6; this.addBonus(20); audio.mushroom(); }
    else if (pl.type === 'spring') { mult = 2.15; this.addBonus(40); audio.spring(); }
    if (this.fx.leaf > 0) mult *= 1.4;
    if (this.fx.superBounces > 0) { mult *= 1.55; this.fx.superBounces--; }
    const superJump = mult >= 1.5;
    p.vy = -JUMP_V * mult;
    p.state = 'land'; p.stateT = 0;
    p.sx = 1.38; p.sy = 0.62; p.svx = 0; p.svy = 0;
    if (pl.type === 'ice') p.iceT = 0.55;
    pl.bounceV = pl.type === 'cloud' ? 90 : 150;
    if (!pl.landedCount && !sameAsLast) {
      this.run.platforms++;
      this.run.combo++;
      this.run.maxCombo = Math.max(this.run.maxCombo, this.run.combo);
      this.addBonus(Math.min(this.run.combo, 20) * 2);
      const cmb = this.run.combo;
      if (cmb === 5) { this.float(p.x, p.y - 70, 'COMBO x5!', FLOAT_COLORS.orange, 20); this.addBonus(50); audio.combo(5); this.comboPop = 0.4; }
      else if (cmb === 10) { this.float(p.x, p.y - 70, 'AMAZING! x10', FLOAT_COLORS.pink, 22); this.addBonus(150); audio.combo(8); this.comboPop = 0.4; }
      else if (cmb === 20) { this.float(p.x, p.y - 70, 'INCREDIBLE! x20', FLOAT_COLORS.gold, 22); this.addBonus(400); audio.combo(10); this.comboPop = 0.4; }
      else if (cmb > 20 && cmb % 10 === 0) { this.float(p.x, p.y - 70, `UNSTOPPABLE! x${cmb}`, FLOAT_COLORS.gold, 22); this.addBonus(400); audio.combo(10); this.comboPop = 0.4; }
      else if (cmb >= 3) this.comboPop = 0.25;
      const perfect = this.hd(p.x, pl.x) < pl.w * 0.12;
      if (perfect && !special) { this.run.perfect++; this.addBonus(25); this.float(p.x, p.y - 50, 'PERFECT!', FLOAT_COLORS.green, 17); this.burst(p.x, p.y, 8, '#fff6a0', 1, 120, 0); }
      else if (Math.abs(p.vx) > MAX_VX * 0.85 && !special) { this.addBonus(15); this.float(p.x, p.y - 50, 'SPEEDY!', FLOAT_COLORS.blue, 16); }
    } else if (sameAsLast) {
      this.run.combo = 0;
    }
    pl.landedCount++;
    this.run.lastPlatformId = pl.id;
    if (pl.type === 'breakable') { pl.broken = true; pl.breakT = 0; audio.breakPlat(); this.burst(pl.x, pl.y + 6, 8, '#8a7a66', 2, 140); }
    // dust
    const dust = pl.type === 'cloud' ? '#ffffff' : pl.type === 'ice' ? '#d9f3ff' : WORLDS[pl.world].plat.top;
    for (let i = 0, n = this.pcount(6); i < n; i++) this.spawnParticle(p.x + rand(-10, 10), pl.y, rand(-90, 90), rand(-60, -10), rand(0.25, 0.45), rand(2, 4), dust, 0, 200);
    if (superJump) {
      p.superT = 0.7; p.state = 'super';
      this.cam.shake = this.settings.shake ? 7 : 0; this.cam.zoomV = 1.2;
      this.ring(p.x, p.y - 20, '#ffffff');
      this.burst(p.x, p.y, 12, '#ffe14a', 1, 220, 100);
      this.float(p.x, p.y - 90, 'SUPER JUMP!', FLOAT_COLORS.gold, 21);
      audio.superJump();
    } else {
      audio.land(); audio.jump(); this.buzz(10);
    }
  }

  private updateCoins(dt: number) {
    const p = this.player;
    const px = p.x, py = p.y - 22;
    for (const cn of this.coins) {
      if (cn.dead) continue;
      if (this.fx.magnet > 0) {
        let dx = px - cn.baseX; if (this.settings.boundary !== 'border') { if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; }
        const dy = py - cn.baseY; const dist = Math.hypot(dx, dy);
        if (dist < 170) { const s = 900 * dt / Math.max(1, dist); cn.baseX += dx * s; cn.baseY += dy * s; cn.baseX = ((cn.baseX % W) + W) % W; }
      }
      cn.x = cn.baseX; cn.y = cn.baseY + Math.sin(this.time * 3 + cn.phase) * 3;
      if (this.hd(px, cn.x) < 27 && Math.abs(py - cn.y) < 32) this.collectCoin(cn);
    }
  }

  private collectCoin(cn: Coin) {
    cn.dead = true;
    const val = this.fx.double > 0 ? 2 : 1;
    this.run.coins += val;
    this.addBonus(5 * val * (this.fx.fever > 0 ? 2 : 1));
    this.player.coinFlash = 0.25;
    this.run.rushCount++; this.run.rushT = 1.2;
    audio.coin(Math.min(this.run.rushCount, 12));
    if (this.run.rushCount === 5) { this.float(this.player.x, this.player.y - 60, 'COIN RUSH!', FLOAT_COLORS.gold, 20); this.addBonus(50); audio.combo(6); this.run.rushCount = 0; }
    this.burst(cn.x, cn.y, 6, '#ffe14a', 1, 110, 0);
    if (val > 1) this.float(cn.x, cn.y - 14, '+2', FLOAT_COLORS.gold, 14);
    this.flying.push({ x: cn.x, y: cn.y - this.cam.y, t: 0, sx: cn.x, sy: cn.y - this.cam.y });
  }

  private activatePower(type: PowerUpType) {
    const p = this.player; const def = POWERUPS[type];
    this.run.powerups++; this.addBonus(40); p.powerFlash = 0.7;
    switch (type) {
      case 'leaf': this.fx.leaf = def.duration; audio.powerup(); break;
      case 'jetpack': this.fx.jetpack = def.duration; p.superT = def.duration; p.state = 'super'; this.cam.shake = this.settings.shake ? 5 : 0; this.cam.zoomV = 1.2; audio.superJump(); break;
      case 'magnet': this.fx.magnet = def.duration; audio.magnet(); break;
      case 'shield': this.fx.shield = true; audio.shield(); break;
      case 'double': this.fx.double = def.duration; audio.powerup(); break;
      case 'slow': this.fx.slow = def.duration; audio.slow(); break;
      case 'bounce': this.fx.superBounces = 3; audio.powerup(); break;
      case 'fever': this.fx.fever = def.duration; this.feverTimer = 0; audio.fever(); break;
    }
    this.float(p.x, p.y - 80, def.name + '!', def.color, 21);
    this.ring(p.x, p.y - 22, def.color);
    this.burst(p.x, p.y - 22, 14, def.color, 1, 200, 60);
  }

  private updateEnemies(dt: number, slowF: number) {
    const p = this.player;
    const px = p.x, py = p.y - PLAYER_H / 2;
    const d = difficultyAtM(this.run.altitude, this.settings.difficulty);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const sdt = dt * slowF;
      switch (e.type) {
        case 'bat': {
          e.x += e.vx * sdt; e.timer -= sdt;
          if (e.x < 18) { e.x = 18; e.dir = 1; e.vx = Math.abs(e.vx); } else if (e.x > W - 18) { e.x = W - 18; e.dir = -1; e.vx = -Math.abs(e.vx); }
          if (e.timer <= 0) { e.timer = rand(1, 3); if (Math.random() < 0.5) { e.dir *= -1; e.vx *= -1; } }
          break;
        }
        case 'hooded': {
          const pl = this.platforms.find((q) => q.id === e.platformId);
          if (!pl || pl.dead) { e.dead = true; break; }
          e.phase += sdt * (1.4 + d);
          e.x = pl.x + Math.sin(e.phase) * (pl.w / 2 - 14); e.y = pl.y - 17 + pl.bounce; e.dir = Math.cos(e.phase) > 0 ? 1 : -1;
          break;
        }
        case 'storm': {
          e.x += e.vx * sdt;
          if (e.x < 30) { e.x = 30; e.vx = Math.abs(e.vx); } else if (e.x > W - 30) { e.x = W - 30; e.vx = -Math.abs(e.vx); }
          e.timer -= sdt;
          if (e.bolt > 0) { e.bolt -= sdt; e.charge = 0; }
          else if (e.timer < 0.7) { if (e.charge <= 0 && e.y > this.cam.y - 50 && e.y < this.cam.y + this.H) audio.warning(); e.charge = 1; }
          if (e.timer <= 0) { e.bolt = 0.55; e.timer = 3.3 - d * 1.2; e.charge = 0; }
          break;
        }
        case 'rock': {
          if (e.warn > 0) { e.warn -= sdt; e.y = this.cam.y - 40; }
          else { e.vy = (400 + d * 160) * slowF; e.y += e.vy * dt; if (this.run.world >= 5 && Math.random() < 0.5 * this.perfScale) this.spawnParticle(e.x + rand(-6, 6), e.y - 10, rand(-20, 20), rand(-120, -40), 0.3, rand(2, 5), pick(['#ff9a2e', '#ffe14a']), 0, 0); }
          break;
        }
        case 'spiky': {
          const pl = this.platforms.find((q) => q.id === e.platformId);
          if (!pl || pl.dead) { e.dead = true; break; }
          e.phase += sdt * (1.2 + d);
          e.x = pl.x + Math.sin(e.phase) * (pl.w / 2 - 16); e.y = pl.y - 16 + pl.bounce; e.dir = Math.cos(e.phase) > 0 ? 1 : -1;
          break;
        }
        case 'bee': {
          e.x += e.vx * sdt;
          if (e.x < 20) { e.x = 20; e.dir = 1; e.vx = Math.abs(e.vx); } else if (e.x > W - 20) { e.x = W - 20; e.dir = -1; e.vx = -Math.abs(e.vx); }
          e.y = e.baseY + Math.sin(this.time * 4 + e.phase) * 18;
          break;
        }
        case 'ghost': {
          e.phase += sdt;
          e.charge = 0.25 + (Math.sin(e.phase * 1.4) + 1) * 0.38;
          e.x += e.vx * sdt * 0.6;
          if (e.x < 20) { e.x = 20; e.vx = Math.abs(e.vx); e.dir = 1; } else if (e.x > W - 20) { e.x = W - 20; e.vx = -Math.abs(e.vx); e.dir = -1; }
          e.y = e.baseY + Math.sin(e.phase) * 10;
          break;
        }
        case 'fish': {
          e.x += e.vx * sdt;
          if (e.x < 16) { e.x = 16; e.vx = Math.abs(e.vx); e.dir = 1; } else if (e.x > W - 16) { e.x = W - 16; e.vx = -Math.abs(e.vx); e.dir = -1; }
          e.y = e.baseY + Math.sin(this.time * 3 + e.phase) * 12;
          break;
        }
        case 'slime': {
          const pl = this.platforms.find((q) => q.id === e.platformId);
          if (!pl || pl.dead) { e.dead = true; break; }
          e.phase += sdt * (2 + d);
          e.x = pl.x + Math.sin(e.phase) * (pl.w / 2 - 14);
          e.y = pl.y - 14 + pl.bounce - Math.abs(Math.sin(e.phase * 2)) * 8;
          e.dir = Math.cos(e.phase) > 0 ? 1 : -1;
          break;
        }
      }
      // ---- interaction
      let dx = px - e.x; if (this.settings.boundary !== 'border') { if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; }
      const dy = py - e.y;
      const hitX = Math.abs(dx) < (PLAYER_HW + e.w / 2) * 0.8;
      const hitY = Math.abs(dy) < (PLAYER_H / 2 + e.h / 2) * 0.8;
      let boltHit = false;
      if (e.type === 'storm' && e.bolt > 0) boltHit = Math.abs(dx) < 12 + PLAYER_HW * 0.6 && py > e.y && py < e.y + 122;
      const dist = Math.hypot(dx, dy);
      if (!e.dodged) {
        if (dist < 62) e.near = true;
        else if (e.near && dist > 95) { e.dodged = true; this.addBonus(30); this.float(p.x, p.y - 55, 'CLOSE CALL!', FLOAT_COLORS.blue, 16); }
      }
      if (p.state === 'hurt' || e.warn > 0) continue;
      if ((hitX && hitY) || boltHit) {
        if (e.type === 'ghost' && e.charge < 0.4) continue;
        const stompable = e.type === 'bat' || e.type === 'hooded' || e.type === 'bee' || e.type === 'ghost' || e.type === 'fish' || e.type === 'slime';
        const prevFeet = p.y - p.vy * dt;
        if (stompable && p.vy > 0 && prevFeet <= e.y - e.h / 2 + 10 && !boltHit) {
          e.dead = true; e.dodged = true;
          this.run.stomps++; this.addBonus(50);
          p.vy = -JUMP_V * 0.9; p.sx = 1.3; p.sy = 0.7;
          this.float(e.x, e.y - 20, 'SQUASH!', FLOAT_COLORS.orange, 18);
          this.burst(e.x, e.y, 10, e.type === 'bat' ? '#a76bff' : '#e8683d', 0, 180);
          this.burst(e.x, e.y, 6, '#ffffff', 1, 120, 0);
          audio.stomp();
          if (e.type === 'hooded') { const pl = this.platforms.find((q) => q.id === e.platformId); if (pl) pl.hasEnemy = false; }
        } else {
          this.hitPlayer(e);
        }
      }
    }
  }

  private hitPlayer(e: Enemy) {
    const p = this.player;
    if (this.fx.invuln > 0) return;
    e.dodged = true;
    if (this.fx.shield) {
      this.fx.shield = false; this.shieldPopT = 0.5; this.fx.invuln = 1.2;
      if (e.type !== 'storm') { e.dead = true; this.burst(e.x, e.y, 10, '#ffffff', 0, 160); }
      p.vy = Math.min(p.vy, -JUMP_V * 0.6);
      this.ring(p.x, p.y - 22, '#9ed0ff'); this.burst(p.x, p.y - 22, 12, '#9ed0ff', 1, 220, 0);
      this.float(p.x, p.y - 70, 'SHIELD!', FLOAT_COLORS.blue, 19);
      this.cam.shake = this.settings.shake ? 5 : 0;
      audio.shieldPop();
      return;
    }
    p.state = 'hurt'; p.stateT = 0; p.vy = -260; p.vx = -p.facing * 120;
    this.run.combo = 0;
    this.hitStop = 0.12;
    this.cam.shake = this.settings.shake ? 11 : 0;
    this.burst(p.x, p.y - 22, 10, '#ffd23f', 1, 200, 100);
    this.float(p.x, p.y - 70, 'OUCH!', '#ff6b6b', 20);
    audio.hit(); this.buzz(40);
  }

  private die() {
    if (this.mode !== 'play') return;
    this.mode = 'dying'; this.dyingT = 0;
    this.cam.shake = this.settings.shake ? 6 : 0;
    audio.gameOver();
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt; if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.rotV * dt;
    }
  }
  private updateFloats(dt: number) {
    for (const f of this.floats) f.t += dt;
    if (this.floats.length && this.floats[0].t > this.floats[0].life) this.floats = this.floats.filter((f) => f.t < f.life);
  }
  private updateFlying(dt: number) {
    const tx = W - 36, ty = 30;
    for (const f of this.flying) {
      f.t += dt * 2.1;
      const k = Math.min(1, f.t); const e = k * k;
      f.x = lerp(f.sx, tx, e); f.y = lerp(f.sy, ty, e) - Math.sin(k * Math.PI) * 40;
      if (f.t >= 1) { this.hudCoins += this.fx.double > 0 ? 2 : 1; this.hudPop = 0.3; }
    }
    if (this.flying.length && this.flying[0].t >= 1) this.flying = this.flying.filter((f) => f.t < 1);
    if (this.hudCoins > this.run.coins) this.hudCoins = this.run.coins;
  }
  private updateAmbient(dt: number, camDy: number) {
    const kind = PARTICLE_KIND[WORLDS[this.mode === 'menu' ? 0 : this.run.world].particle];
    for (const a of this.ambient) {
      switch (a.kind) {
        case 0: a.vx = Math.sin(this.time * 1.5 + a.phase) * 25; a.vy = 28 + a.size * 6; break; // leaves
        case 1: a.vx = Math.sin(this.time + a.phase) * 12; a.vy = 20 + a.size * 5; break; // sprinkles
        case 2: a.vx = Math.sin(this.time * 1.2 + a.phase) * 10; a.vy = -(18 + a.size * 8); break;
        case 3: a.vx = Math.sin(this.time * 0.7 + a.phase) * 18; a.vy = Math.cos(this.time * 0.9 + a.phase) * 14; break;
        case 4: a.vx = Math.sin(this.time + a.phase) * 16; a.vy = 30 + a.size * 8; break;
        case 5: a.vx = Math.sin(this.time * 2 + a.phase) * 20; a.vy = -(40 + a.size * 12); break;
        case 6: a.vx = 0; a.vy = -8 - a.size * 3; break;
      }
      a.x += a.vx * dt; a.y += a.vy * dt - camDy * 0.6;
      if (a.y > this.H + 20) { a.y = -20; a.x = Math.random() * W; a.kind = kind; }
      else if (a.y < -20) { a.y = this.H + 20; a.x = Math.random() * W; a.kind = kind; }
      if (a.x < -10) a.x = W + 10; else if (a.x > W + 10) a.x = -10;
    }
  }

  private updateMenu(dt: number) {
    this.time += dt; this.menuT += dt;
    this.menuHopV += 900 * dt; this.menuHop += this.menuHopV * dt;
    if (this.menuHop > 0) { this.menuHop = 0; this.menuHopV = 0; }
    if (this.menuT > 2.6) { this.menuT = 0; this.menuHopV = -230; this.player.sx = 1.3; this.player.sy = 0.7; }
    const p = this.player; const k = 420, c = 16;
    p.svx += (-(p.sx - 1) * k - p.svx * c) * dt; p.sx += p.svx * dt;
    p.svy += (-(p.sy - 1) * k - p.svy * c) * dt; p.sy += p.svy * dt;
    p.blinkT -= dt; if (p.blinkT < -0.12) p.blinkT = rand(2, 5);
    this.cam.y = -this.time * 14;
    this.updateAmbient(dt, -14 * dt);
    this.updateParticles(dt);
  }

  // ------------------------------------------------------------------ render
  private render() {
    const ctx = this.ctx; const H = this.H;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (this.mode === 'menu') { this.renderMenu(); return; }
    const alt = this.run.altitude;
    const wi = worldIndexAt(alt);
    const next = Math.min(WORLDS.length - 1, wi + 1);
    const span = 120;
    let blend = 0;
    if (next !== wi) { const m = WORLDS[next].startM; if (alt > m - span) blend = clamp((alt - (m - span)) / span, 0, 1); }
    // ensure banner world uses camera-based idx (blend fully = next world reached)
    drawBackground(ctx, W, H, this.cam.y, this.time, wi, next, blend);
    this.drawAmbient();

    ctx.save();
    ctx.translate(W / 2 + this.cam.sx, H / 2 + this.cam.sy); ctx.scale(this.cam.zoom, this.cam.zoom); ctx.translate(-W / 2, -H / 2);
    const cy = this.cam.y;
    // platforms
    for (const pl of this.platforms) {
      const sy = pl.y - cy + pl.bounce;
      if (sy < -60 || sy > H + 60) continue;
      drawPlatform(ctx, pl, pl.x, sy, this.time);
      if (this.settings.boundary !== 'border') {
        if (pl.x - pl.w / 2 < 0) drawPlatform(ctx, pl, pl.x + W, sy, this.time);
        else if (pl.x + pl.w / 2 > W) drawPlatform(ctx, pl, pl.x - W, sy, this.time);
      }
    }
    // coins
    for (const cn of this.coins) {
      const sy = cn.y - cy; if (cn.dead || sy < -30 || sy > H + 30) continue;
      drawCoin(ctx, cn.x, sy, this.time, cn.phase);
      if (this.settings.boundary !== 'border') { if (cn.x < 14) drawCoin(ctx, cn.x + W, sy, this.time, cn.phase); else if (cn.x > W - 14) drawCoin(ctx, cn.x - W, sy, this.time, cn.phase); }
    }
    for (const pu of this.powerups) { const sy = pu.y - cy; if (pu.dead || sy < -40 || sy > H + 40) continue; drawPowerUp(ctx, pu.x, sy, pu.type, POWERUPS[pu.type].color, this.time, pu.phase); }
    // enemies
    for (const e of this.enemies) {
      if (e.dead || e.warn > 0) continue;
      const sy = e.y - cy; if (sy < -140 || sy > H + 60) continue;
      const slow = this.fx.slow > 0;
      if (slow) { ctx.save(); ctx.globalAlpha = 0.85; }
      drawEnemy(ctx, e, e.x, sy, slow ? this.time * 0.35 : this.time);
      if (slow) ctx.restore();
    }
    drawParticles(ctx, this.particles, cy, this.lowPerf);
    this.drawPlayer();
    // world-space floats
    for (const f of this.floats) if (!f.screen) this.drawFloat(f, f.x, f.y - cy);
    ctx.restore();

    // screen-space
    this.drawSpeedLines();
    for (const f of this.flying) drawCoin(ctx, f.x, f.y, this.time, 0, 9);
    for (const f of this.floats) if (f.screen) this.drawFloat(f, f.x, f.y);
    this.drawWarnings();
    this.drawHUD();
    if (this.mode === 'dying' || this.mode === 'over') { ctx.fillStyle = `rgba(30,15,40,${Math.min(0.45, this.dyingT * 0.6)})`; ctx.fillRect(0, 0, W, H); }
  }

  private drawAmbient() {
    const ctx = this.ctx;
    const step = this.lowPerf ? 2 : 1;
    for (let ai = 0; ai < this.ambient.length; ai += step) {
      const a = this.ambient[ai];
      const tw = 0.5 + Math.sin(this.time * 3 + a.phase) * 0.5;
      switch (a.kind) {
        case 0: ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(this.time * 2 + a.phase); ctx.fillStyle = a.phase > 5 ? 'rgba(120,200,80,0.8)' : 'rgba(230,200,80,0.8)'; ctx.beginPath(); ctx.ellipse(0, 0, a.size * 1.6, a.size * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); break;
        case 1: ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(this.time + a.phase); ctx.fillStyle = ['#ff8fc2', '#5fd1c8', '#ffe14a', '#8f7bff'][Math.floor(a.phase) % 4]; ctx.fillRect(-a.size, -a.size * 0.4, a.size * 2, a.size * 0.8); ctx.restore(); break;
        case 2: ctx.fillStyle = `rgba(180,240,255,${0.35 + tw * 0.4})`; circ(ctx, a.x, a.y, a.size * 1.4); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; circ(ctx, a.x - 1, a.y - 1, a.size * 0.4); ctx.fill(); break;
        case 3: ctx.fillStyle = `rgba(200,255,150,${0.25 * tw})`; circ(ctx, a.x, a.y, a.size * 2.5); ctx.fill(); ctx.fillStyle = `rgba(230,255,180,${0.5 + tw * 0.5})`; circ(ctx, a.x, a.y, a.size * 0.6); ctx.fill(); break;
        case 4: ctx.fillStyle = `rgba(255,255,255,${0.55 + tw * 0.4})`; circ(ctx, a.x, a.y, a.size * 0.7); ctx.fill(); break;
        case 5: ctx.fillStyle = `rgba(255,${120 + tw * 100},40,${0.5 + tw * 0.5})`; circ(ctx, a.x, a.y, a.size * 0.7); ctx.fill(); break;
        case 6: ctx.fillStyle = `rgba(200,240,255,${0.3 + tw * 0.7})`; circ(ctx, a.x, a.y, a.size * 0.45); ctx.fill(); break;
      }
    }
  }

  private expression(): Expression {
    const p = this.player;
    if (p.state === 'hurt') return 'dizzy';
    if (p.state === 'celebrate') return 'joy';
    if (p.powerFlash > 0 || p.superT > 0) return 'excited';
    if (p.coinFlash > 0) return 'wow';
    if (p.vy > 1150) return 'scared';
    return 'happy';
  }

  private drawPlayer() {
    const p = this.player;
    const sy = p.y - this.cam.y;
    const air = p.state !== 'idle' && p.state !== 'land';
    const stretch = air && this.mode !== 'over' ? clamp(Math.abs(p.vy) / 4200, 0, 0.22) : 0;
    const pose = {
      x: p.x, y: sy, scaleX: p.sx * (1 - stretch * 0.5), scaleY: p.sy * (1 + stretch), facing: p.facing, state: p.state, t: this.time,
      vx: p.vx, vy: p.vy, skin: this.skin, expression: this.expression(), blink: p.blinkT < 0, size: 1, shield: this.fx.shield ? 1 : this.shieldPopT > 0 ? this.shieldPopT * 2 : 0,
      spin: p.spin, lean: clamp(p.vx / MAX_VX, -1, 1) * 0.14,
    };
    if (this.fx.invuln > 0 && Math.floor(this.time * 14) % 2 === 0) this.ctx.globalAlpha = 0.55;
    drawRaccoon(this.ctx, pose);
    if (this.settings.boundary !== 'border') {
      if (p.x < 40) drawRaccoon(this.ctx, { ...pose, x: p.x + W });
      else if (p.x > W - 40) drawRaccoon(this.ctx, { ...pose, x: p.x - W });
    }
    this.ctx.globalAlpha = 1;
    // magnet field
    if (this.fx.magnet > 0) { this.ctx.strokeStyle = `rgba(255,75,110,${0.25 + Math.sin(this.time * 8) * 0.1})`; this.ctx.lineWidth = 2; this.ctx.setLineDash([6, 8]); circ(this.ctx, p.x, sy - 22, 60 + Math.sin(this.time * 4) * 4); this.ctx.stroke(); this.ctx.setLineDash([]); }
  }

  private drawFloat(f: FloatText, x: number, y: number) {
    const k = f.t / f.life;
    const s = k < 0.2 ? easeOutBack(k / 0.2) : 1;
    const a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    this.ctx.save(); this.ctx.globalAlpha = a; this.ctx.translate(x, y - k * 46); this.ctx.scale(s, s);
    textOutline(this.ctx, f.text, 0, 0, f.size, f.color);
    this.ctx.restore();
  }

  private drawSpeedLines() {
    const p = this.player; if (p.vy > -1100 || this.mode !== 'play') return;
    const ctx = this.ctx; const n = this.pcount(8); const k = clamp((-p.vy - 1100) / 900, 0, 1);
    ctx.fillStyle = `rgba(255,255,255,${0.25 * k})`;
    for (let i = 0; i < n; i++) { const x = ((i * 53 + Math.floor(this.time * 30) * 17) % W); const len = 40 + ((i * 37) % 60) * k; const y = ((i * 97 + this.time * 900) % (this.H + len)) - len; ctx.fillRect(x, y, 2, len); }
  }

  private drawWarnings() {
    const ctx = this.ctx;
    for (const e of this.enemies) {
      if (e.type !== 'rock' || e.warn <= 0 || e.dead) continue;
      if (Math.floor(this.time * 10) % 2 === 0) continue;
      ctx.fillStyle = '#ff4b4b'; rr(ctx, e.x - 12, 64, 24, 24, 6); ctx.fill();
      textOutline(ctx, '!', e.x, 77, 18, '#fff', '#a01818');
      ctx.beginPath(); ctx.moveTo(e.x - 6, 88); ctx.lineTo(e.x + 6, 88); ctx.lineTo(e.x, 96); ctx.closePath(); ctx.fillStyle = '#ff4b4b'; ctx.fill();
    }
  }

  private panel(x: number, y: number, w: number, h: number, r = 12) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(30,15,5,0.25)'; rr(ctx, x, y + 3, w, h, r); ctx.fill();
    ctx.fillStyle = '#6b3f1d'; rr(ctx, x, y, w, h, r); ctx.fill();
    ctx.fillStyle = '#a9713d'; rr(ctx, x + 3, y + 3, w - 6, h - 6, r - 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 6, y + 5, w - 12, h * 0.35, r - 5); ctx.fill();
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5; rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1); ctx.stroke();
  }

  private drawHUD() {
    const ctx = this.ctx; const H = this.H;
    this.panel(W / 2 - 74, 8, 148, 54, 14);
    textOutline(ctx, `${Math.floor(this.run.altitude)} m`, W / 2, 28, 24, '#fff8e6', '#3b2415');
    textOutline(ctx, `SCORE ${this.score()}`, W / 2, 49, 11, '#ffe9a8', '#3b2415', 600);
    this.panel(W - 104, 12, 92, 36, 12);
    const pop = 1 + this.hudPop * 0.8;
    ctx.save(); ctx.translate(W - 36, 30); ctx.scale(pop, pop); drawCoin(ctx, 0, 0, 0.3, 0, 11); ctx.restore();
    textOutline(ctx, `${this.hudCoins}`, W - 54, 30, 18, '#fff8e6', '#3b2415', 700, 'right');
    if (this.bestAltitude > 0) textOutline(ctx, `BEST ${Math.floor(Math.max(this.bestAltitude, this.run.altitude))} m`, W / 2, 70, 11, this.run.altitude > this.bestAltitude ? '#ffe14a' : '#ffffff', 'rgba(40,20,10,0.8)', 600);
    if (this.debugHud) textOutline(ctx, `${this.fps.toFixed(0)} FPS · q${this.perfScale.toFixed(2)}${this.lowPerf ? ' · BUDGET' : ''}`, W - 12, 60, 10, this.lowPerf ? '#ff8a7a' : '#9ed0ff', 'rgba(40,20,10,0.75)', 600, 'right');
    textOutline(ctx, `SPEED ${this.spd.toFixed(2)}×`, W / 2, 84, 11, this.speedPop > 0 ? '#ffe14a' : 'rgba(255,255,255,0.9)', 'rgba(40,20,10,0.75)', 700);
    if (this.speedPop > 0) {
      const k = Math.min(1, this.speedPop);
      ctx.save(); ctx.globalAlpha = k; ctx.translate(W / 2, H * 0.38); ctx.scale(0.9 + (1 - k) * 0.4, 0.9 + (1 - k) * 0.4);
      textOutline(ctx, 'SPEED UP! +5%', 0, 0, 22, '#ffe14a', '#3b2415');
      ctx.restore();
    }
    // power-up indicators
    const active: { type: PowerUpType; frac: number; label?: string }[] = [];
    if (this.fx.shield) active.push({ type: 'shield', frac: 1 });
    if (this.fx.superBounces > 0) active.push({ type: 'bounce', frac: this.fx.superBounces / 3, label: `x${this.fx.superBounces}` });
    for (const k of ['leaf', 'jetpack', 'magnet', 'double', 'slow', 'fever'] as const) if (this.fx[k] > 0) active.push({ type: k, frac: this.fx[k] / POWERUPS[k].duration });
    let ix = 16;
    for (const a of active) {
      const col = POWERUPS[a.type].color;
      ctx.fillStyle = 'rgba(40,20,10,0.45)'; circ(ctx, ix + 16, 92, 17); ctx.fill();
      ctx.fillStyle = '#fff6e0'; circ(ctx, ix + 16, 92, 14); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ix + 16, 92, 15.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * a.frac); ctx.stroke();
      ctx.save(); ctx.translate(ix + 16, 92); drawPowerIcon(ctx, a.type, 0.65); ctx.restore();
      if (a.label) textOutline(ctx, a.label, ix + 28, 104, 11, '#fff', '#3b2415');
      ix += 40;
    }
    // combo
    if (this.run.combo >= 3 && this.mode === 'play') {
      const s = 1 + this.comboPop * 1.2;
      ctx.save(); ctx.translate(W / 2, 92); ctx.scale(s, s);
      textOutline(ctx, `COMBO x${this.run.combo}`, 0, 0, 15, this.run.combo >= 10 ? '#ffe14a' : '#ffffff', '#5a2a10');
      ctx.restore();
    }
    // Location label — subtle & brief: a small pill tucked under the HUD, simple
    // fade in/out, no center overlay, no pop, no gameplay interruption.
    if (this.worldBannerT > 0) {
      const t = 1.6 - this.worldBannerT; // time since it started
      const a = t < 0.22 ? t / 0.22 : t > 1.26 ? (1.6 - t) / 0.34 : 1;
      ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
      ctx.translate(W / 2, 104);
      ctx.fillStyle = 'rgba(24,14,40,0.72)'; rr(ctx, -88, -12, 176, 24, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(255,209,102,0.55)'; ctx.lineWidth = 1; rr(ctx, -88, -12, 176, 24, 12); ctx.stroke();
      textOutline(ctx, WORLDS[this.worldBannerIdx].name, 0, 0, 12, '#ffe9a8', 'rgba(30,16,10,0.9)', 600);
      ctx.restore();
    }
    // virtual buttons
    if (this.isTouch && this.settings.controls !== 'drag' && this.mode === 'play') {
      const side = this.touchSide();
      for (const s of [-1, 1]) {
        const x = s < 0 ? 44 : W - 44; const on = side === s;
        ctx.fillStyle = on ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)'; circ(ctx, x, H - 52, 30); ctx.fill();
        ctx.fillStyle = on ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.moveTo(x + s * 10, H - 52); ctx.lineTo(x - s * 6, H - 64); ctx.lineTo(x - s * 6, H - 40); ctx.closePath(); ctx.fill();
      }
    }
    // controls hint at start
    if (this.run.altitude < 15 && this.mode === 'play' && this.runT < 6) {
      ctx.globalAlpha = 0.85;
      textOutline(ctx, this.isTouch ? 'TAP LEFT / RIGHT TO MOVE' : '← →  OR  A / D  TO MOVE', W / 2, H * 0.6, 14, '#fff', 'rgba(40,20,10,0.8)', 600);
      ctx.globalAlpha = 1;
    }
  }

  private renderMenu() {
    const ctx = this.ctx; const H = this.H;
    drawBackground(ctx, W, H, this.cam.y, this.time, 0, 1, 0);
    this.drawAmbient();
    const py = H * 0.585;
    const plat: Platform = { id: 7, type: 'grass', x: W / 2, y: py, prevY: py, w: 170, h: 20, world: 0, axis: 'x', range: 0, speed: 0, phase: 0, baseX: 0, baseY: 0, broken: false, breakT: 0, cycle: 0, alpha: 1, solid: true, bounce: 0, bounceV: 0, landedCount: 0, dead: false, hasEnemy: false };
    // floating island underside
    ctx.fillStyle = '#a86b3c'; ctx.beginPath(); ctx.moveTo(W / 2 - 85, py + 10); ctx.quadraticCurveTo(W / 2 - 40, py + 70, W / 2, py + 78); ctx.quadraticCurveTo(W / 2 + 40, py + 70, W / 2 + 85, py + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a5530'; ctx.beginPath(); ctx.moveTo(W / 2 - 40, py + 40); ctx.quadraticCurveTo(W / 2 - 10, py + 70, W / 2, py + 78); ctx.quadraticCurveTo(W / 2 + 40, py + 70, W / 2 + 85, py + 10); ctx.lineTo(W / 2 + 60, py + 20); ctx.closePath(); ctx.fill();
    drawPlatform(ctx, plat, W / 2, py + Math.sin(this.time * 2) * 2, this.time);
    // orbiting coins
    for (let i = 0; i < 3; i++) { const a = this.time * 1.2 + i * 2.1; drawCoin(ctx, W / 2 + Math.cos(a) * 120, py - 70 + Math.sin(a) * 26, this.time, i * 2); }
    drawParticles(ctx, this.particles, this.cam.y);
    const p = this.player;
    const breathe = 1 + Math.sin(this.time * 3) * 0.02;
    drawRaccoon(ctx, {
      x: W / 2, y: py + Math.sin(this.time * 2) * 2 + this.menuHop, scaleX: p.sx * (2 - breathe), scaleY: p.sy * breathe, facing: 1, state: this.menuHop < -5 ? 'jump' : 'idle', t: this.time,
      vx: 0, vy: 0, skin: this.skin, expression: 'happy', blink: p.blinkT < 0, size: 1.55, shield: 0, spin: 0, lean: 0,
    });
  }
}

