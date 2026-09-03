#!/usr/bin/env node
/**
 * Headless engine smoke test: bundles src/game/engine.ts, mocks the DOM +
 * canvas, lets a simple AI play several runs and asserts:
 *   • no runtime exceptions in update/render
 *   • procedural generation never produces an unreachable main path
 *   • the performance governor reacts to slow frames and recovers
 * Run: npm run sim
 */
import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'node:fs';

mkdirSync('.tmp', { recursive: true });
await build({ entryPoints: ['src/game/engine.ts'], bundle: true, format: 'esm', outfile: '.tmp/engine.mjs', platform: 'neutral', logLevel: 'silent' });

const noop = () => {};
const ctxProxy = new Proxy({}, {
  get(_t, prop) {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop: noop });
    if (prop === 'measureText') return () => ({ width: 10 });
    return typeof prop === 'string' ? noop : undefined;
  },
  set() { return true; },
});
globalThis.window = { addEventListener: noop, removeEventListener: noop, innerWidth: 400, innerHeight: 711, devicePixelRatio: 1, setInterval, clearInterval, setTimeout, clearTimeout };
globalThis.navigator = { maxTouchPoints: 0 };
globalThis.document = { addEventListener: noop, removeEventListener: noop, hidden: false };
globalThis.location = { search: '' };
globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = noop; globalThis.performance = { now: () => 0 };
const canvas = { getContext: () => ctxProxy, addEventListener: noop, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 711 }), width: 400, height: 711, setPointerCapture: noop };

const { Game } = await import('../.tmp/engine.mjs');
const W = 400, G = 2600;

function ai(game) {
  const p = game.debugPlayer; let best = null, bestScore = -Infinity; const v0 = -p.vy;
  for (const pl of game.platforms) {
    if (pl.dead || pl.broken || pl.type === 'vanish' || pl.hasEnemy || pl.type === 'breakable') continue;
    const dy = p.y - pl.y; if (dy < -20 || dy > 135) continue; // 135 ≈ max height at JUMP_V=820
    let dx = pl.x - p.x; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W;
    const disc = v0 * v0 - 2 * G * dy; if (disc < 0) continue;
    const tAvail = (v0 + Math.sqrt(disc)) / G; if (Math.abs(dx) > 300 * Math.max(0, tAvail - 0.1) + pl.w / 2) continue;
    const score = dy - Math.abs(dx) * 0.5; if (score > bestScore) { bestScore = score; best = { pl, dx }; }
  }
  const keys = game.debugKeys;
  if (best && Math.abs(best.dx) > 28) { keys.left = best.dx < 0; keys.right = best.dx > 0; }
  else if (Math.abs(p.vx) > 80) { keys.left = p.vx > 0; keys.right = p.vx < 0; } else { keys.left = false; keys.right = false; }
}

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error('✖', msg); } else console.log('✔', msg); };

// ---- runs
// Settings must include every field in the current Settings interface.
const settings = {
  sfx: false, music: false, shake: true, haptic: false,
  controls: 'buttons', boundary: 'border', sensitivity: 50,
  difficulty: 'normal', startWorld: 0,
};
const skin = { id: 'classic', name: 'Classic', price: 0, desc: '', hat: 'none' };

// JUMP_V must match config.ts exactly so reachability checks are accurate.
const JUMP_V_SIM = 820;

/** True if at least one platform above `last` was physically reachable
 *  using the CURRENT engine physics (JUMP_V_SIM, GRAVITY from config). */
function hadReachableNext(game, last) {
  const MAX_VX = 340;
  for (const p of game.platforms) {
    if (p === last || p.dead || (p.type === 'breakable' && p.broken)) continue;
    const dy = last.y - p.y; if (dy <= 0 || dy > 135) continue; // 135 ≈ JUMP_V_SIM²/(2*G)
    const disc = JUMP_V_SIM * JUMP_V_SIM - 2 * G * dy; if (disc < 0) continue;
    const t2 = (JUMP_V_SIM + Math.sqrt(disc)) / G;
    const reach = MAX_VX * Math.max(0.1, t2 - 0.12) + p.w / 2 + 14 + (p.type === 'moving' && p.axis === 'x' ? p.range : 0);
    let dx = p.x - last.x; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W;
    if (Math.abs(dx) <= reach) return true;
  }
  return false;
}

let fell = 0, unfair = 0, enemyDeaths = 0, totalAlt = 0;
const RUNS = 8;
for (let i = 0; i < RUNS; i++) {
  let over = null;
  const g = new Game(canvas, settings, skin, { onGameOver: (r) => { over = r; }, onWorldReached: noop, onAltitude: noop, onKey: noop });
  g.resize(400, 711); g.start();
  let t = 0;
  while (t < 240 && !over) { ai(g); g.step(1 / 60); g.draw(); t += 1 / 60; }
  const r = over ?? g.getResult();
  const cause = !over ? 'alive' : g.debugPlayer.state === 'hurt' ? 'enemy' : 'fell';
  let note = '';
  if (cause === 'fell') {
    fell++;
    const last = g.platforms.find((pl) => pl.id === g.debugRun.lastPlatformId);
    const ok = last ? hadReachableNext(g, last) : true;
    if (!ok) unfair++;
    note = ok ? ' (AI miss — a reachable platform existed)' : ' (UNFAIR: nothing reachable)';
  }
  if (cause === 'enemy') enemyDeaths++;
  totalAlt += r.altitude;
  console.log(`  run ${i}: ${cause} alt=${r.altitude}m score=${r.score} coins=${r.coins} world=${r.world} combo=${r.maxCombo}${note}`);
}
check(unfair === 0, `fairness: every fall had a reachable platform (falls=${fell}, unfair=${unfair}, enemy=${enemyDeaths})`);
check(totalAlt / RUNS > 250, `progression: average altitude ${Math.round(totalAlt / RUNS)} m > 250 m`);

// ---- performance governor
{
  const g = new Game(canvas, settings, skin, { onGameOver: noop, onWorldReached: noop, onAltitude: noop, onKey: noop });
  g.resize(400, 711); g.start();
  check(Math.abs(g.perfScale - 1) < 0.01 && !g.lowPerf, 'governor starts at full quality');
  for (let i = 0; i < 120; i++) g.samplePerf(33.3); // 30 FPS for 2 s
  check(g.lowPerf && g.perfScale < 0.6, `governor enters budget mode at 30 FPS (q=${g.perfScale.toFixed(2)}, fps≈${g.fps.toFixed(0)})`);
  for (let i = 0; i < 400; i++) g.samplePerf(16.7); // back to 60 FPS
  check(!g.lowPerf && g.perfScale > 0.95, `governor recovers at 60 FPS (q=${g.perfScale.toFixed(2)})`);
  g.samplePerf(900);
  check(g.fps > 55, 'a single 900 ms stall (tab switch) is ignored');
}

rmSync('.tmp', { recursive: true, force: true });
if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll engine checks passed.');
