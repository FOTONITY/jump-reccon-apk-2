import { WORLDS } from './config';
import type { Enemy, Particle, Platform, PowerUpType } from './types';
import { circ, ell, hash, mixHex, rr, star, shade } from './utils';

// ---------------------------------------------------------------- BACKGROUNDS
type ElementDrawer = (ctx: CanvasRenderingContext2D, x: number, y: number, r1: number, r2: number, t: number, W: number) => void;

function layer(ctx: CanvasRenderingContext2D, W: number, H: number, camY: number, t: number, parallax: number, band: number, count: number, seed: number, draw: ElementDrawer) {
  const ly = camY * parallax;
  const b0 = Math.floor(ly / band) - 1;
  const b1 = Math.floor((ly + H) / band) + 1;
  for (let b = b0; b <= b1; b++) {
    for (let k = 0; k < count; k++) {
      const n = b * 97 + k * 13;
      const x = hash(n, seed) * W;
      const y = b * band + hash(n, seed + 1) * band - ly;
      if (y < -200 || y > H + 200) continue;
      draw(ctx, x, y, hash(n, seed + 2), hash(n, seed + 3), t, W);
    }
  }
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  circ(ctx, x, y, 16 * s); ctx.fill();
  circ(ctx, x + 18 * s, y + 4 * s, 13 * s); ctx.fill();
  circ(ctx, x - 18 * s, y + 5 * s, 12 * s); ctx.fill();
  circ(ctx, x + 6 * s, y - 8 * s, 12 * s); ctx.fill();
  rr(ctx, x - 26 * s, y + 4 * s, 52 * s, 12 * s, 6 * s); ctx.fill();
}

function island(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, top: string, side: string, deco: number) {
  // dirt body (rounded, tapering)
  ctx.fillStyle = side;
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x - w * 0.3, y + w * 0.55, x, y + w * 0.6); ctx.quadraticCurveTo(x + w * 0.3, y + w * 0.55, x + w / 2, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = top; rr(ctx, x - w / 2, y - 6, w, 12, 6); ctx.fill();
  if (deco < 0.5) { // tree
    ctx.fillStyle = shade(side, -0.2); ctx.fillRect(x - 2, y - 24, 4, 20);
    ctx.fillStyle = shade(top, -0.1); circ(ctx, x, y - 30, 12); ctx.fill(); circ(ctx, x - 8, y - 24, 9); ctx.fill(); circ(ctx, x + 8, y - 24, 9); ctx.fill();
  } else { // waterfall
    ctx.fillStyle = 'rgba(150,210,255,0.8)'; rr(ctx, x + w * 0.15, y, 8, w * 0.7, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; rr(ctx, x + w * 0.15 + 2, y + 4, 2, w * 0.5, 1); ctx.fill();
  }
  // flowers
  ctx.fillStyle = '#ff7eb6'; circ(ctx, x - w * 0.3, y - 6, 2); ctx.fill();
  ctx.fillStyle = '#ffe14a'; circ(ctx, x + w * 0.28, y - 6, 2); ctx.fill();
}

const drawWorldLayers = [
  // 0 GREEN HILLS
  (ctx: CanvasRenderingContext2D, W: number, H: number, camY: number, t: number) => {
    layer(ctx, W, H, camY, t, 0.12, 420, 2, 11, (c, x, y, r1) => cloud(c, x + Math.sin(t * 0.2 + r1 * 6) * 10, y, 1.2 + r1 * 0.8, 'rgba(255,255,255,0.85)'));
    layer(ctx, W, H, camY, t, 0.3, 480, 1, 23, (c, x, y, r1, r2) => island(c, x, y, 60 + r1 * 60, '#6fcf3f', '#a86b3c', r2));
    layer(ctx, W, H, camY, t, 0.55, 360, 2, 37, (c, x, y, r1) => cloud(c, x - Math.sin(t * 0.3 + r1 * 4) * 14, y, 0.6 + r1 * 0.5, 'rgba(255,255,255,0.55)'));
  },
  // 1 CANDY SKY
  (ctx: CanvasRenderingContext2D, W: number, H: number, camY: number, t: number) => {
    const pastel = ['rgba(255,220,240,0.9)', 'rgba(220,225,255,0.9)', 'rgba(220,255,240,0.9)'];
    layer(ctx, W, H, camY, t, 0.12, 400, 2, 41, (c, x, y, r1, r2) => cloud(c, x + Math.sin(t * 0.25 + r2 * 6) * 10, y, 1.1 + r1 * 0.8, pastel[Math.floor(r2 * 3)]));
    layer(ctx, W, H, camY, t, 0.3, 500, 1, 53, (c, x, y, r1, r2) => {
      const w = 70 + r1 * 50;
      island(c, x, y, w, '#ff9fcf', '#f4d7a1', 1);
      // lollipop or candy cane
      if (r2 < 0.5) {
        c.fillStyle = '#ffffff'; c.fillRect(x - 2, y - 36, 4, 32);
        c.fillStyle = '#ff5fa2'; circ(c, x, y - 40, 12); c.fill();
        c.strokeStyle = '#ffffff'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y - 40, 7, 0, Math.PI * 1.5); c.stroke();
      } else {
        c.fillStyle = '#5fd1c8'; circ(c, x, y - 26, 14); c.fill();
        c.fillStyle = '#ff9fcf'; circ(c, x, y - 26, 6); c.fill();
        c.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) { circ(c, x + Math.cos(i * 1.26) * 10, y - 26 + Math.sin(i * 1.26) * 10, 1.5); c.fill(); }
      }
    });
    layer(ctx, W, H, camY, t, 0.6, 300, 3, 67, (c, x, y, r1, r2) => {
      const cols = ['#ffd6ea', '#c8f7ff', '#fff3b0'];
      const pulse = 0.7 + Math.sin(t * 3 + r1 * 10) * 0.3;
      c.fillStyle = cols[Math.floor(r2 * 3)]; c.globalAlpha *= 0.5 * pulse; circ(c, x, y, 4 + r1 * 4); c.fill(); c.globalAlpha /= 0.5 * pulse;
    });
  },
  // 2 OCEAN CLOUDS
  (ctx: CanvasRenderingContext2D, W: number, H: number, camY: number, t: number) => {
    layer(ctx, W, H, camY, t, 0.12, 400, 2, 161, (c, x, y, r1) => cloud(c, x + Math.sin(t * 0.2 + r1 * 6) * 12, y, 1.2 + r1 * 0.7, 'rgba(255,255,255,0.9)'));
    layer(ctx, W, H, camY, t, 0.28, 500, 1, 173, (c, x, y, r1, r2) => {
      const w = 70 + r1 * 50;
      island(c, x, y, w, '#3ecfbb', '#e8c07a', 1);
      c.fillStyle = '#2aa89a'; c.fillRect(x - 2, y - 28, 4, 22);
      c.fillStyle = '#2fbf6a'; circ(c, x, y - 30, 10); c.fill(); circ(c, x - 8, y - 24, 7); c.fill();
      c.fillStyle = '#ff8ad0'; circ(c, x + w * 0.2, y - 4, 3); c.fill();
      if (r2 > 0.5) { c.fillStyle = 'rgba(90,200,255,0.7)'; rr(c, x + w * 0.15, y, 7, w * 0.55, 3); c.fill(); }
    });
    layer(ctx, W, H, camY, t, 0.55, 280, 3, 181, (c, x, y, r1, r2, tm) => {
      const bob = Math.sin(tm * 2 + r1 * 8) * 6;
      c.fillStyle = `rgba(180,240,255,${0.35 + r2 * 0.3})`; circ(c, x, y + bob, 3 + r1 * 4); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.7)'; circ(c, x - 1, y + bob - 1, 1.2); c.fill();
    });
  },
  // 3 MAGICAL NIGHT
  (ctx: CanvasRenderingContext2D, W: number, H: number, camY: number, t: number) => {
    // moon (almost fixed)
    const my = H * 0.18 - camY * 0.02 % H;
    const mx = W * 0.76;
    ctx.fillStyle = 'rgba(255,240,200,0.12)'; circ(ctx, mx, my, 70); ctx.fill();
    ctx.fillStyle = '#fff2c4'; circ(ctx, mx, my, 42); ctx.fill();
    ctx.fillStyle = '#eadba8'; circ(ctx, mx - 14, my - 8, 8); ctx.fill(); circ(ctx, mx + 12, my + 12, 6); ctx.fill(); circ(ctx, mx + 8, my - 18, 4); ctx.fill();
    layer(ctx, W, H, camY, t, 0.08, 200, 6, 71, (c, x, y, r1, r2) => {
      const tw = 0.5 + Math.sin(t * (2 + r2 * 3) + r1 * 20) * 0.5;
      c.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.6})`; circ(c, x, y, 0.8 + r1 * 1.4); c.fill();
    });
    layer(ctx, W, H, camY, t, 0.3, 520, 1, 83, (c, x, y, r1, r2) => {
      const w = 60 + r1 * 60;
      island(c, x, y, w, '#4a9a8a', '#3b2d6b', 1);
      // glowing plants
      for (let i = 0; i < 3; i++) {
        const px = x - w * 0.3 + i * w * 0.3, glow = 0.6 + Math.sin(t * 2 + i + r2 * 5) * 0.4;
        c.fillStyle = `rgba(123,224,200,${0.25 * glow})`; circ(c, px, y - 14, 10); c.fill();
        c.fillStyle = i === 1 ? '#ff8ad0' : '#7be0c8'; circ(c, px, y - 14, 4); c.fill();
        c.fillStyle = '#d6fff4'; c.fillRect(px - 1, y - 12, 2, 8);
      }
    });
  },
  // 4 FROZEN PEAKS
  (ctx: CanvasRenderingContext2D, W: number, H: number, camY: number, t: number) => {
    layer(ctx, W, H, camY, t, 0.1, 420, 2, 191, (c, x, y, r1) => cloud(c, x + Math.sin(t * 0.15 + r1 * 5) * 8, y, 1.3 + r1 * 0.8, 'rgba(255,255,255,0.92)'));
    layer(ctx, W, H, camY, t, 0.3, 520, 1, 199, (c, x, y, r1) => {
      const w = 70 + r1 * 50;
      c.fillStyle = '#8fb8d8';
      c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x, y + w * 0.55); c.lineTo(x + w / 2, y); c.closePath(); c.fill();
      c.fillStyle = '#e8f6ff'; rr(c, x - w / 2, y - 8, w, 14, 7); c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(x - 10, y - 8); c.lineTo(x, y - 28 - r1 * 12); c.lineTo(x + 10, y - 8); c.closePath(); c.fill();
    });
    layer(ctx, W, H, camY, t, 0.6, 220, 4, 211, (c, x, y, r1, r2, tm) => {
      c.save(); c.translate(x, y); c.rotate(tm * 0.4 + r2 * 4);
      c.strokeStyle = `rgba(220,240,255,0.85)`; c.lineWidth = 1.2;
      c.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.moveTo(0, 0); c.lineTo(Math.cos(a) * (3 + r1 * 3), Math.sin(a) * (3 + r1 * 3)); }
      c.stroke();
      c.restore();
    });
  },
  // 5 VOLCANO
  (ctx: CanvasRenderingContext2D, W: number, H: number, camY: number, t: number) => {
    layer(ctx, W, H, camY, t, 0.12, 420, 2, 91, (c, x, y, r1) => cloud(c, x + Math.sin(t * 0.2 + r1 * 6) * 8, y, 1.3 + r1 * 0.8, 'rgba(70,40,40,0.5)'));
    layer(ctx, W, H, camY, t, 0.3, 480, 1, 101, (c, x, y, r1, r2) => {
      const w = 60 + r1 * 60;
      c.fillStyle = '#3a2a2a';
      c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w * 0.35, y + w * 0.5); c.lineTo(x + w * 0.1, y + w * 0.62); c.lineTo(x + w / 2, y + 4); c.lineTo(x + w * 0.4, y - 8); c.lineTo(x - w * 0.3, y - 6); c.closePath(); c.fill();
      // lava
      const glow = 0.7 + Math.sin(t * 3 + r2 * 9) * 0.3;
      c.fillStyle = `rgba(255,120,40,${0.35 * glow})`; ell(c, x, y - 2, w * 0.45, 10); c.fill();
      c.fillStyle = '#ff8a3c'; ell(c, x, y - 3, w * 0.35, 5); c.fill();
      c.fillStyle = '#ffd166'; ell(c, x - w * 0.1, y - 4, w * 0.12, 2); c.fill();
      // lava drip
      c.fillStyle = '#ff6a1a'; rr(c, x + w * 0.2, y, 4, 14 + Math.sin(t * 2 + r1 * 4) * 4, 2); c.fill();
    });
    layer(ctx, W, H, camY, t, 0.65, 320, 2, 113, (c, x, y, r1) => cloud(c, x + Math.sin(t * 0.4 + r1 * 4) * 10, y, 0.7 + r1 * 0.5, 'rgba(60,40,40,0.35)'));
    // lava haze at the bottom
    const g = ctx.createLinearGradient(0, H * 0.7, 0, H);
    g.addColorStop(0, 'rgba(255,110,30,0)'); g.addColorStop(1, 'rgba(255,110,30,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.7, W, H * 0.3);
  },
  // 6 SPACE
  (ctx: CanvasRenderingContext2D, W: number, H: number, camY: number, t: number) => {
    layer(ctx, W, H, camY, t, 0.05, 600, 1, 121, (c, x, y, r1, r2) => {
      const cols = ['rgba(200,90,255,', 'rgba(255,120,200,', 'rgba(90,220,255,'];
      const col = cols[Math.floor(r2 * 3)];
      const g = c.createRadialGradient(x, y, 0, x, y, 120 + r1 * 80);
      g.addColorStop(0, col + '0.28)'); g.addColorStop(1, col + '0)');
      c.fillStyle = g; c.fillRect(x - 220, y - 220, 440, 440);
    });
    layer(ctx, W, H, camY, t, 0.08, 200, 7, 131, (c, x, y, r1, r2) => {
      const tw = 0.5 + Math.sin(t * (2 + r2 * 4) + r1 * 20) * 0.5;
      c.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.7})`; circ(c, x, y, 0.7 + r1 * 1.5); c.fill();
    });
    layer(ctx, W, H, camY, t, 0.22, 560, 1, 143, (c, x, y, r1, r2) => {
      const r = 18 + r1 * 22;
      const cols = [['#ff9a6b', '#c2553a'], ['#6bd3ff', '#2f7fbf'], ['#c9a0ff', '#7a4fd0'], ['#ffd76b', '#c98a10']];
      const [a, b] = cols[Math.floor(r2 * 4)];
      const g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, a); g.addColorStop(1, b);
      circ(c, x, y, r); c.fillStyle = g; c.fill();
      c.fillStyle = 'rgba(255,255,255,0.15)'; ell(c, x, y - r * 0.3, r * 0.8, r * 0.15); c.fill();
      if (r2 > 0.5) { c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, r * 1.7, r * 0.45, -0.3, 0, Math.PI * 2); c.stroke(); }
    });
    layer(ctx, W, H, camY, t, 0.5, 380, 1, 151, (c, x, y, r1, r2) => {
      c.save(); c.translate(x, y); c.rotate(t * 0.3 + r2 * 6);
      const r = 8 + r1 * 10;
      c.fillStyle = '#6a6f80'; c.beginPath();
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const rad = r * (0.75 + hash(i, 5) * 0.4); c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
      c.closePath(); c.fill();
      c.fillStyle = '#4c5060'; circ(c, r * 0.2, -r * 0.1, r * 0.25); c.fill();
      c.restore();
    });
  },
];

export function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number, camY: number, t: number, wa: number, wb: number, blend: number) {
  const A = WORLDS[wa], B = WORLDS[wb];
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, blend > 0 ? mixHex(A.sky[0], B.sky[0], blend) : A.sky[0]);
  g.addColorStop(0.55, blend > 0 ? mixHex(A.sky[1], B.sky[1], blend) : A.sky[1]);
  g.addColorStop(1, blend > 0 ? mixHex(A.sky[2], B.sky[2], blend) : A.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (blend < 1) { ctx.globalAlpha = 1 - blend; drawWorldLayers[wa](ctx, W, H, camY, t); ctx.globalAlpha = 1; }
  if (blend > 0) { ctx.globalAlpha = blend; drawWorldLayers[wb](ctx, W, H, camY, t); ctx.globalAlpha = 1; }
}

// ---------------------------------------------------------------- PLATFORMS
function naturalPlatform(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, world: number, id: number, t: number) {
  const pal = WORLDS[world].plat;
  const l = x - w / 2;
  if (pal.glow) { ctx.fillStyle = pal.glow; ctx.globalAlpha *= 0.22; rr(ctx, l - 4, y - 3, w + 8, h + 8, 9); ctx.fill(); ctx.globalAlpha /= 0.22; }

  // ---- subtle readability backing (works on every world without darkening)
  // A soft shadow underneath separates the platform from bright sky, clouds,
  // candy gradients, etc. A faint dark rim adds crisp edges without neon.
  ctx.fillStyle = 'rgba(12,8,22,0.28)';
  rr(ctx, l + 2, y + h + 1, w - 4, 8, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,30,0.35)'; ctx.lineWidth = 1;
  rr(ctx, l + 0.5, y + 0.5, w - 1, h - 1, 7); ctx.stroke();

  ctx.fillStyle = pal.side; rr(ctx, l, y, w, h, 7); ctx.fill();
  ctx.fillStyle = shade(pal.side, -0.25); rr(ctx, l + 3, y + h - 6, w - 6, 5, 3); ctx.fill();
  ctx.fillStyle = pal.top; rr(ctx, l, y, w, h * 0.5, 6); ctx.fill();
  ctx.fillStyle = shade(pal.top, 0.25); rr(ctx, l + 6, y + 2, w - 12, 3, 2); ctx.fill();
  switch (world) {
    case 0: { // grass tufts + flowers
      ctx.fillStyle = pal.edge;
      for (let i = 0; i < w / 14; i++) { const gx = l + 6 + i * 14 + hash(id + i, 3) * 6; ctx.beginPath(); ctx.moveTo(gx - 3, y + 1); ctx.lineTo(gx, y - 5 - hash(id, i) * 3); ctx.lineTo(gx + 3, y + 1); ctx.closePath(); ctx.fill(); }
      if (hash(id, 9) > 0.5) { ctx.fillStyle = '#ff7eb6'; circ(ctx, l + w * 0.25, y - 2, 2.2); ctx.fill(); ctx.fillStyle = '#fff'; circ(ctx, l + w * 0.25, y - 2, 0.9); ctx.fill(); }
      if (hash(id, 10) > 0.5) { ctx.fillStyle = '#ffe14a'; circ(ctx, l + w * 0.72, y - 2, 2.2); ctx.fill(); }
      break;
    }
    case 1: { // frosting drips + sprinkles
      ctx.fillStyle = pal.top;
      for (let i = 0; i < w / 16; i++) { const dx = l + 8 + i * 16; circ(ctx, dx, y + h * 0.5 + 2 + hash(id + i, 4) * 4, 4); ctx.fill(); }
      const cols = ['#ffffff', '#5fd1c8', '#ffe14a', '#8f7bff'];
      for (let i = 0; i < w / 12; i++) { const sx = l + 6 + i * 12 + hash(id, i) * 5; ctx.strokeStyle = cols[i % 4]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, y + 3); ctx.lineTo(sx + 3, y + 6); ctx.stroke(); }
      break;
    }
    case 2: { // ocean shells
      ctx.fillStyle = '#fff1c2'; circ(ctx, l + w * 0.25, y + 4, 3.5); ctx.fill();
      ctx.fillStyle = '#ff8ad0'; circ(ctx, l + w * 0.7, y + 3, 2.6); ctx.fill();
      ctx.strokeStyle = '#2aa89a'; ctx.lineWidth = 1.4;
      for (let i = 0; i < w / 16; i++) { const gx = l + 8 + i * 16; ctx.beginPath(); ctx.moveTo(gx, y + 1); ctx.quadraticCurveTo(gx + 4, y - 6, gx + 8, y + 1); ctx.stroke(); }
      break;
    }
    case 3: { // glowing mushrooms
      for (let i = 0; i < 2; i++) { const mx = l + w * (0.25 + i * 0.5) + hash(id, i) * 8 - 4; const gl = 0.6 + Math.sin(t * 3 + i + id) * 0.4;
        ctx.fillStyle = `rgba(255,138,208,${0.3 * gl})`; circ(ctx, mx, y - 5, 8); ctx.fill();
        ctx.fillStyle = '#e9fff8'; ctx.fillRect(mx - 1, y - 6, 2, 6); ctx.fillStyle = i ? '#ff8ad0' : '#c085ff'; ell(ctx, mx, y - 6, 4, 2.5); ctx.fill(); }
      break;
    }
    case 4: { // frost sparkle
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; rr(ctx, l + 4, y + 2, w * 0.4, 3, 1); ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < w / 18; i++) { const sx = l + 8 + i * 18; ctx.beginPath(); ctx.moveTo(sx, y - 2); ctx.lineTo(sx, y + 6); ctx.moveTo(sx - 3, y + 2); ctx.lineTo(sx + 3, y + 2); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.stroke(); }
      break;
    }
    case 5: { // lava cracks
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i < w / 18; i++) { const cx = l + 6 + i * 18; ctx.moveTo(cx, y + 3); ctx.lineTo(cx + 4, y + 6); ctx.lineTo(cx + 2, y + 9); }
      ctx.stroke();
      const gl = 0.5 + Math.sin(t * 4 + id) * 0.5; ctx.fillStyle = `rgba(255,220,100,${0.25 * gl})`; rr(ctx, l + 2, y + 1, w - 4, h * 0.45, 4); ctx.fill();
      break;
    }
    case 6: { // neon lights
      ctx.fillStyle = '#e8fdff'; rr(ctx, l + 2, y + 1, w - 4, 3, 1.5); ctx.fill();
      for (let i = 0; i < w / 20; i++) { const lx = l + 10 + i * 20; const on = Math.sin(t * 5 + i + id) > 0; ctx.fillStyle = on ? '#5ef2ff' : '#2b5f6e'; circ(ctx, lx, y + h - 5, 1.8); ctx.fill(); }
      break;
    }
  }
}

function woodPlatform(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const l = x - w / 2;
  ctx.fillStyle = 'rgba(12,8,22,0.28)'; rr(ctx, l + 2, y + h + 1, w - 4, 7, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,30,0.35)'; ctx.lineWidth = 1; rr(ctx, l + 0.5, y + 0.5, w - 1, h - 1, 4); ctx.stroke();
  ctx.fillStyle = '#8b5a2b'; rr(ctx, l, y, w, h, 4); ctx.fill();
  ctx.fillStyle = '#c98a4b'; rr(ctx, l, y, w, h * 0.55, 4); ctx.fill();
  ctx.fillStyle = '#e0a86a'; rr(ctx, l + 4, y + 2, w - 8, 2, 1); ctx.fill();
  ctx.strokeStyle = '#7a4a20'; ctx.lineWidth = 1.5;
  for (let i = 1; i < w / 24; i++) { const px = l + i * 24; ctx.beginPath(); ctx.moveTo(px, y + 1); ctx.lineTo(px, y + h - 1); ctx.stroke(); }
  ctx.fillStyle = '#5a3a1a'; circ(ctx, l + 6, y + h * 0.3, 1.5); ctx.fill(); circ(ctx, l + w - 6, y + h * 0.3, 1.5); ctx.fill();
}

function stonePlatform(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, id: number, cracked = false) {
  const l = x - w / 2;
  ctx.fillStyle = 'rgba(12,8,22,0.28)'; rr(ctx, l + 2, y + h + 1, w - 4, 7, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,30,0.35)'; ctx.lineWidth = 1; rr(ctx, l + 0.5, y + 0.5, w - 1, h + 1, 5); ctx.stroke();
  ctx.fillStyle = cracked ? '#8a7a66' : '#7d8089'; rr(ctx, l, y, w, h + 2, 5); ctx.fill();
  ctx.fillStyle = cracked ? '#b3a48c' : '#b4b7bf'; rr(ctx, l, y, w, h * 0.6, 5); ctx.fill();
  ctx.fillStyle = cracked ? '#cbbda4' : '#d2d5db'; rr(ctx, l + 5, y + 2, w - 10, 2.5, 1); ctx.fill();
  ctx.strokeStyle = cracked ? '#5a4a3a' : '#5c5f68'; ctx.lineWidth = cracked ? 1.6 : 1.2; ctx.beginPath();
  const n = cracked ? 3 : 1;
  for (let i = 0; i < n; i++) { const cx = l + w * (0.2 + hash(id, i) * 0.6); ctx.moveTo(cx, y + 1); ctx.lineTo(cx - 3, y + 6); ctx.lineTo(cx + 2, y + 10); ctx.lineTo(cx - 1, y + h); }
  ctx.stroke();
}

export function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, sx: number, sy: number, t: number) {
  const { w, h } = p;
  switch (p.type) {
    case 'grass': naturalPlatform(ctx, sx, sy, w, h, p.world, p.id, t); break;
    case 'wood': woodPlatform(ctx, sx, sy, w, h); break;
    case 'stone': stonePlatform(ctx, sx, sy, w, h, p.id); break;
    case 'moving': {
      ctx.fillStyle = '#4a4f5c'; rr(ctx, sx - w / 2 + 6, sy + h - 2, w - 12, 7, 3); ctx.fill();
      naturalPlatform(ctx, sx, sy, w, h, p.world, p.id, t);
      ctx.fillStyle = '#ffd23f';
      if (p.axis === 'x') {
        ctx.beginPath(); ctx.moveTo(sx - w / 2 - 6, sy + h / 2); ctx.lineTo(sx - w / 2, sy + h / 2 - 5); ctx.lineTo(sx - w / 2, sy + h / 2 + 5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(sx + w / 2 + 6, sy + h / 2); ctx.lineTo(sx + w / 2, sy + h / 2 - 5); ctx.lineTo(sx + w / 2, sy + h / 2 + 5); ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(sx - w / 2 - 6, sy + h / 2 - 2); ctx.lineTo(sx - w / 2 - 2, sy + h / 2 - 8); ctx.lineTo(sx - w / 2 - 10, sy + h / 2 - 8); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(sx - w / 2 - 6, sy + h / 2 + 8); ctx.lineTo(sx - w / 2 - 2, sy + h / 2 + 2); ctx.lineTo(sx - w / 2 - 10, sy + h / 2 + 2); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'breakable': {
      if (!p.broken) { stonePlatform(ctx, sx, sy, w, h, p.id, true); break; }
      const k = p.breakT;
      const fall = k * k * 500;
      ctx.save(); ctx.globalAlpha *= Math.max(0, 1 - k * 1.2);
      ctx.save(); ctx.translate(sx - w / 4 - k * 25, sy + fall); ctx.rotate(-k * 1.5); stonePlatform(ctx, 0, 0, w / 2, h, p.id, true); ctx.restore();
      ctx.save(); ctx.translate(sx + w / 4 + k * 25, sy + fall * 1.1); ctx.rotate(k * 1.5); stonePlatform(ctx, 0, 0, w / 2, h, p.id + 1, true); ctx.restore();
      ctx.restore();
      break;
    }
    case 'vanish': {
      const l = sx - w / 2;
      ctx.save();
      ctx.globalAlpha *= Math.max(0.12, p.alpha);
      ctx.fillStyle = '#d6c6ff'; rr(ctx, l, sy, w, h, 7); ctx.fill();
      ctx.fillStyle = '#efe6ff'; rr(ctx, l, sy, w, h * 0.5, 6); ctx.fill();
      ctx.fillStyle = '#b9a0ff'; rr(ctx, l + 3, sy + h - 5, w - 6, 4, 2); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.globalAlpha *= 0.7; ctx.setLineDash([5, 4]); ctx.strokeStyle = '#b39dff'; ctx.lineWidth = 1.5; rr(ctx, l, sy, w, h, 7); ctx.stroke(); ctx.restore();
      break;
    }
    case 'ice': {
      const l = sx - w / 2;
      ctx.fillStyle = '#8fd0f5'; rr(ctx, l, sy, w, h, 6); ctx.fill();
      ctx.fillStyle = '#d9f3ff'; rr(ctx, l, sy, w, h * 0.55, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; rr(ctx, l + 6, sy + 2, w * 0.35, 3, 1.5); ctx.fill();
      ctx.fillStyle = '#b6e3fb';
      for (let i = 0; i < w / 22; i++) { const ix = l + 10 + i * 22 + hash(p.id, i) * 6; const len = 6 + hash(p.id + 3, i) * 8; ctx.beginPath(); ctx.moveTo(ix - 3, sy + h - 1); ctx.lineTo(ix, sy + h + len); ctx.lineTo(ix + 3, sy + h - 1); ctx.closePath(); ctx.fill(); }
      break;
    }
    case 'cloud': {
      const bob = Math.sin(t * 2 + p.phase) * 1.5;
      ctx.fillStyle = 'rgba(180,200,225,0.6)'; ell(ctx, sx, sy + h + 4 + bob, w * 0.45, 6); ctx.fill();
      ctx.fillStyle = '#ffffff';
      const n = Math.max(3, Math.round(w / 22));
      for (let i = 0; i < n; i++) { const cx = sx - w / 2 + (i + 0.5) * (w / n); const r = 11 + (i % 2) * 4; circ(ctx, cx, sy + 6 + bob, r); ctx.fill(); }
      rr(ctx, sx - w / 2 + 4, sy + 2 + bob, w - 8, h + 2, 8); ctx.fill();
      ctx.fillStyle = 'rgba(200,215,235,0.7)'; rr(ctx, sx - w / 2 + 10, sy + h + 1 + bob, w - 20, 4, 2); ctx.fill();
      break;
    }
    case 'mushroom': {
      const squash = Math.max(0, p.bounce) * 0.02;
      ctx.fillStyle = '#f0dcb8'; rr(ctx, sx - w * 0.18, sy + 4, w * 0.36, 20, 6); ctx.fill();
      ctx.fillStyle = '#d9c39a'; rr(ctx, sx - w * 0.18, sy + 18, w * 0.36, 6, 3); ctx.fill();
      ctx.save(); ctx.translate(sx, sy + 6); ctx.scale(1 + squash, 1 - squash * 1.5);
      ctx.fillStyle = '#e8434a'; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, 16, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c92f38'; rr(ctx, -w / 2, -2, w, 6, 3); ctx.fill();
      ctx.fillStyle = '#fff5f0'; circ(ctx, -w * 0.25, -6, 4); ctx.fill(); circ(ctx, w * 0.1, -10, 5); ctx.fill(); circ(ctx, w * 0.35, -4, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, -w * 0.15, -11, w * 0.2, 2.5); ctx.fill();
      ctx.restore();
      break;
    }
    case 'spring': {
      const comp = Math.min(12, Math.max(0, p.bounce) * 0.6);
      const baseY = sy + 22;
      ctx.fillStyle = '#8b5a2b'; rr(ctx, sx - w * 0.35, baseY - 6, w * 0.7, 8, 3); ctx.fill();
      ctx.fillStyle = '#c98a4b'; rr(ctx, sx - w * 0.35, baseY - 6, w * 0.7, 3, 2); ctx.fill();
      const top = sy + 4 + comp;
      ctx.strokeStyle = '#9aa0ab'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
      const coils = 4; const ch = (baseY - 6 - top) / coils;
      ctx.moveTo(sx - 12, baseY - 6);
      for (let i = 0; i < coils; i++) { ctx.lineTo(sx + 12, baseY - 6 - ch * (i + 0.5)); ctx.lineTo(sx - 12, baseY - 6 - ch * (i + 1)); }
      ctx.stroke();
      ctx.fillStyle = '#ff9a2e'; rr(ctx, sx - w * 0.4, top - 4, w * 0.8, 8, 4); ctx.fill();
      ctx.fillStyle = '#ffc06b'; rr(ctx, sx - w * 0.4 + 5, top - 3, w * 0.8 - 10, 2.5, 1); ctx.fill();
      break;
    }
  }
}

// ---------------------------------------------------------------- COINS & POWER-UPS
export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, phase: number, r = 11) {
  const sc = Math.cos(t * 4 + phase);
  const gl = 0.7 + Math.sin(t * 5 + phase) * 0.3;
  ctx.fillStyle = `rgba(255,215,80,${0.18 * gl})`; circ(ctx, x, y, r * 1.9); ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.12, Math.abs(sc)), 1);
  ctx.fillStyle = sc > 0 ? '#e0a020' : '#c98a10'; circ(ctx, 0, 0, r); ctx.fill();
  ctx.fillStyle = '#ffd23f'; circ(ctx, 0, 0, r - 2.2); ctx.fill();
  ctx.fillStyle = '#ffe98a'; ell(ctx, -2, -4, r * 0.45, r * 0.25); ctx.fill();
  if (Math.abs(sc) > 0.35) { ctx.fillStyle = '#e0a020'; star(ctx, 0, 0.5, r * 0.55, 5, 0.5); ctx.fill(); }
  ctx.restore();
  if ((t * 1.5 + phase) % 3 < 0.35) { ctx.fillStyle = '#fff'; star(ctx, x + r * 0.7, y - r * 0.7, 3.5, 4, 0.35); ctx.fill(); }
}

export function drawPowerIcon(ctx: CanvasRenderingContext2D, type: PowerUpType, s = 1) {
  ctx.save(); ctx.scale(s, s);
  switch (type) {
    case 'leaf':
      ctx.beginPath(); ctx.moveTo(-9, 8); ctx.quadraticCurveTo(-8, -9, 9, -9); ctx.quadraticCurveTo(9, 8, -9, 8); ctx.closePath();
      ctx.fillStyle = '#5fd648'; ctx.fill(); ctx.strokeStyle = '#3f9e2c'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 7); ctx.lineTo(7, -7); ctx.stroke();
      break;
    case 'jetpack':
      ctx.fillStyle = '#ff9a2e'; ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(0, 15); ctx.lineTo(4, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(0, 12); ctx.lineTo(2, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8323c'; rr(ctx, -5, -6, 10, 15, 4); ctx.fill();
      ctx.fillStyle = '#f2f4f8'; ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(0, -13); ctx.lineTo(5, -5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8323c'; ctx.beginPath(); ctx.moveTo(-5, 3); ctx.lineTo(-9, 9); ctx.lineTo(-5, 9); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(5, 3); ctx.lineTo(9, 9); ctx.lineTo(5, 9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3f9cff'; circ(ctx, 0, 0, 2.5); ctx.fill();
      break;
    case 'magnet':
      ctx.strokeStyle = '#ff4b6e'; ctx.lineWidth = 6; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(0, -1, 7, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7, -1); ctx.lineTo(-7, 8); ctx.moveTo(7, -1); ctx.lineTo(7, 8); ctx.stroke();
      ctx.fillStyle = '#e9edf5'; ctx.fillRect(-10, 5, 6, 5); ctx.fillRect(4, 5, 6, 5);
      break;
    case 'shield':
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(10, -7); ctx.quadraticCurveTo(10, 6, 0, 11); ctx.quadraticCurveTo(-10, 6, -10, -7); ctx.closePath();
      ctx.fillStyle = '#3f9cff'; ctx.fill(); ctx.strokeStyle = '#2465c0'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#9ed0ff'; ctx.beginPath(); ctx.moveTo(-1, -8); ctx.lineTo(-7, -6); ctx.quadraticCurveTo(-7, 3, -1, 7); ctx.closePath(); ctx.fill();
      break;
    case 'double':
      ctx.fillStyle = '#e0a020'; circ(ctx, 0, 0, 10); ctx.fill(); ctx.fillStyle = '#ffd23f'; circ(ctx, 0, 0, 8); ctx.fill();
      ctx.fillStyle = '#7a4a10'; ctx.font = '700 11px "Arial Rounded MT Bold", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('2x', 0, 1);
      break;
    case 'slow':
      ctx.fillStyle = '#8fd9ff'; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(8, 10); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(4, 10); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a4a10'; rr(ctx, -10, -13, 20, 3, 1); ctx.fill(); rr(ctx, -10, 10, 20, 3, 1); ctx.fill();
      break;
    case 'bounce':
      ctx.strokeStyle = '#ff9a2e'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(6, 7); ctx.lineTo(-6, 4); ctx.lineTo(6, 1); ctx.lineTo(-6, -2); ctx.stroke();
      ctx.fillStyle = '#ff9a2e'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(8, -4); ctx.lineTo(3, -4); ctx.lineTo(3, 0); ctx.lineTo(-3, 0); ctx.lineTo(-3, -4); ctx.lineTo(-8, -4); ctx.closePath(); ctx.fill();
      break;
    case 'fever': {
      const cols = ['#ff4b6e', '#ffc42e', '#5fd648', '#3f9cff', '#c85cff'];
      for (let i = 0; i < 5; i++) { ctx.strokeStyle = cols[i]; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(0, 0, 10 - i * 2, i * 1.1, i * 1.1 + 4.2); ctx.stroke(); }
      ctx.fillStyle = '#fff'; circ(ctx, 0, 0, 2); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

export function drawPowerUp(ctx: CanvasRenderingContext2D, x: number, y: number, type: PowerUpType, color: string, t: number, phase: number) {
  const bob = Math.sin(t * 3 + phase) * 4;
  const gl = 0.6 + Math.sin(t * 4 + phase) * 0.4;
  ctx.save(); ctx.translate(x, y + bob);
  ctx.fillStyle = color; ctx.globalAlpha *= 0.25 * gl; circ(ctx, 0, 0, 26); ctx.fill(); ctx.globalAlpha /= 0.25 * gl;
  circ(ctx, 0, 0, 17, color); ctx.fill();
  circ(ctx, 0, 0, 14, '#fff6e0'); ctx.fill();
  drawPowerIcon(ctx, type, 0.85);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(ctx, -5, -9, 5, 2.5); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- ENEMIES
export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, sx: number, sy: number, t: number) {
  ctx.save(); ctx.translate(sx, sy);
  if (e.squash > 0) ctx.scale(1 + e.squash * 0.6, 1 - e.squash * 0.7);

  // ---- readability: contrast backing (drawn behind the art, unchanged artwork)
  // A soft dark ground-shadow lifts the enemy off LIGHT skies; a faint light rim
  // separates it on DARK skies. Context-aware and never bright enough to look bad.
  const bR = Math.max(e.w, e.h) * 0.62;
  ctx.fillStyle = 'rgba(10,8,20,0.32)';
  ctx.beginPath(); ctx.ellipse(0, bR * 0.55, bR * 1.05, bR * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  const halo = ctx.createRadialGradient(0, -bR * 0.1, bR * 0.3, 0, -bR * 0.1, bR * 1.7);
  halo.addColorStop(0, 'rgba(255,255,255,0)');
  halo.addColorStop(0.8, 'rgba(255,255,255,0.11)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, -bR * 0.1, bR * 1.7, 0, Math.PI * 2); ctx.fill();

  switch (e.type) {
    case 'bat': {
      const flap = Math.sin(t * 16 + e.phase) * 0.7;
      ctx.fillStyle = '#6f3fc4';
      for (const s of [-1, 1]) {
        ctx.save(); ctx.scale(s, 1); ctx.rotate(-flap * 0.6);
        ctx.beginPath(); ctx.moveTo(6, 0); ctx.quadraticCurveTo(14, -14, 26, -10); ctx.quadraticCurveTo(22, -2, 26, 4); ctx.quadraticCurveTo(18, 2, 16, 8); ctx.quadraticCurveTo(12, 4, 6, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      const g = ctx.createRadialGradient(-3, -4, 2, 0, 0, 13); g.addColorStop(0, '#a76bff'); g.addColorStop(1, '#7a45d8');
      circ(ctx, 0, 0, 12); ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = '#7a45d8'; ctx.beginPath(); ctx.moveTo(-9, -7); ctx.lineTo(-7, -16); ctx.lineTo(-2, -10); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(9, -7); ctx.lineTo(7, -16); ctx.lineTo(2, -10); ctx.closePath(); ctx.fill();
      circ(ctx, 0, -1, 6, '#ffffff'); circ(ctx, e.dir * 1.5, -1, 3.4, '#1a1020'); circ(ctx, e.dir * 1.5 - 1, -2.2, 1.2, '#fff');
      ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 5, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-3, 6.5); ctx.lineTo(-2, 9.5); ctx.lineTo(-1, 6.5); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(1, 6.5); ctx.lineTo(2, 9.5); ctx.lineTo(3, 6.5); ctx.closePath(); ctx.fill();
      break;
    }
    case 'hooded': {
      const bob = Math.abs(Math.sin(t * 8 + e.phase)) * 2;
      ctx.translate(0, -bob);
      ell(ctx, -6, 16, 5, 3, '#3a1f1a'); ell(ctx, 6, 16, 5, 3, '#3a1f1a');
      ctx.fillStyle = '#e8683d';
      ctx.beginPath(); ctx.moveTo(-14, 14); ctx.quadraticCurveTo(-14, -6, 0, -18); ctx.quadraticCurveTo(14, -6, 14, 14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#b9432a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#c94f2c'; ctx.beginPath(); ctx.moveTo(-12, 14); ctx.lineTo(12, 14); ctx.lineTo(10, 10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a1520'; ell(ctx, 0, 2, 8.5, 8); ctx.fill();
      const gl = 0.7 + Math.sin(t * 6) * 0.3;
      ctx.fillStyle = `rgba(255,224,102,${0.4 * gl})`; circ(ctx, -3.5, 1, 4); ctx.fill(); circ(ctx, 3.5, 1, 4); ctx.fill();
      ctx.fillStyle = '#ffe066'; circ(ctx, -3.5 + e.dir, 1, 2); ctx.fill(); circ(ctx, 3.5 + e.dir, 1, 2); ctx.fill();
      ctx.fillStyle = '#ffd23f'; circ(ctx, 0, -14, 2.2); ctx.fill();
      break;
    }
    case 'storm': {
      const flash = e.charge > 0 ? Math.sin(t * 40) * 0.5 + 0.5 : 0;
      const base = flash > 0.5 ? '#8a84a8' : '#5a5474';
      ctx.fillStyle = base;
      circ(ctx, -14, 2, 11); ctx.fill(); circ(ctx, 0, -6, 15); ctx.fill(); circ(ctx, 15, 1, 12); ctx.fill(); rr(ctx, -22, 0, 44, 13, 6); ctx.fill();
      ctx.fillStyle = flash > 0.5 ? '#aaa4c8' : '#7a7494'; circ(ctx, -4, -10, 7); ctx.fill(); circ(ctx, 8, -8, 5); ctx.fill();
      // angry face
      circ(ctx, -6, 2, 4, '#ffffff'); circ(ctx, 6, 2, 4, '#ffffff'); circ(ctx, -5, 2.5, 2, '#1a1020'); circ(ctx, 7, 2.5, 2, '#1a1020');
      ctx.strokeStyle = '#2a2440'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-3, -1.5); ctx.moveTo(10, -4); ctx.lineTo(3, -1.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 11, 3.5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      if (e.bolt > 0) {
        const a = 0.6 + Math.sin(t * 50) * 0.4;
        const len = 110;
        ctx.globalAlpha *= a;
        ctx.fillStyle = '#ffe14a';
        ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(4, 12); ctx.lineTo(-2, 12 + len * 0.4); ctx.lineTo(6, 12 + len * 0.4); ctx.lineTo(-4, 12 + len); ctx.lineTo(-1, 12 + len * 0.55); ctx.lineTo(-9, 12 + len * 0.55); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.moveTo(-3, 12); ctx.lineTo(1, 12); ctx.lineTo(0, 12 + len * 0.4); ctx.lineTo(3, 12 + len * 0.4); ctx.lineTo(-2, 12 + len * 0.9); ctx.lineTo(-1, 12 + len * 0.55); ctx.lineTo(-5, 12 + len * 0.55); ctx.closePath(); ctx.fill();
        ctx.globalAlpha /= a;
      } else if (e.charge > 0) {
        ctx.fillStyle = `rgba(255,225,74,${0.5 * flash})`; circ(ctx, 0, 14, 6); ctx.fill();
      }
      break;
    }
    case 'rock': {
      ctx.rotate(e.phase + t * 2);
      ctx.fillStyle = '#5a4a3a'; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const rad = 15 * (0.8 + hash(i, 7) * 0.35); ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a6a5a'; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const rad = 12 * (0.8 + hash(i, 7) * 0.35); ctx.lineTo(Math.cos(a) * rad - 1, Math.sin(a) * rad - 1); }
      ctx.closePath(); ctx.fill();
      ctx.rotate(-(e.phase + t * 2));
      circ(ctx, -5, -2, 3.5, '#fff'); circ(ctx, 5, -2, 3.5, '#fff'); circ(ctx, -4.5, -1.5, 1.8, '#1a1010'); circ(ctx, 5.5, -1.5, 1.8, '#1a1010');
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-9, -7); ctx.lineTo(-2, -5); ctx.moveTo(9, -7); ctx.lineTo(2, -5); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 7, 3.5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,120,40,0.85)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-2, 6); ctx.moveTo(6, -8); ctx.lineTo(2, 4); ctx.stroke();
      break;
    }
    case 'spiky': {
      ctx.fillStyle = '#e8323c';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.25) * 10, Math.sin(a - 0.25) * 10); ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); ctx.lineTo(Math.cos(a + 0.25) * 10, Math.sin(a + 0.25) * 10); ctx.closePath(); ctx.fill();
      }
      const sg = ctx.createRadialGradient(-3, -3, 2, 0, 0, 12); sg.addColorStop(0, '#ff7a6a'); sg.addColorStop(1, '#d02030');
      circ(ctx, 0, 0, 11); ctx.fillStyle = sg; ctx.fill();
      circ(ctx, -3.5, -2, 3.2, '#fff'); circ(ctx, 3.5, -2, 3.2, '#fff');
      circ(ctx, -3 + e.dir, -1.5, 1.6, '#1a1010'); circ(ctx, 4 + e.dir, -1.5, 1.6, '#1a1010');
      ctx.strokeStyle = '#4a1010'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 5, 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      break;
    }
    case 'bee': {
      const flap = Math.sin(t * 22 + e.phase) * 0.5;
      ctx.fillStyle = 'rgba(200,230,255,0.7)';
      ctx.save(); ctx.rotate(-flap); ell(ctx, -10, -8, 8, 5); ctx.fill(); ctx.restore();
      ctx.save(); ctx.rotate(flap); ell(ctx, 10, -8, 8, 5); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#ffe14a'; ell(ctx, 0, 0, 12, 9); ctx.fill();
      ctx.fillStyle = '#3a2a14'; rr(ctx, -8, -4, 16, 3, 1); ctx.fill(); rr(ctx, -8, 2, 16, 3, 1); ctx.fill();
      circ(ctx, -3, -2, 2.4, '#fff'); circ(ctx, 3, -2, 2.4, '#fff'); circ(ctx, -2.5, -2, 1.2, '#1a1010'); circ(ctx, 3.5, -2, 1.2, '#1a1010');
      ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, -10); ctx.lineTo(-4, -16); ctx.moveTo(2, -10); ctx.lineTo(4, -16); ctx.stroke();
      circ(ctx, -4, -17, 1.6, '#3a2a14'); circ(ctx, 4, -17, 1.6, '#3a2a14');
      break;
    }
    case 'ghost': {
      const a = 0.35 + e.charge * 0.65;
      ctx.globalAlpha *= a;
      ctx.fillStyle = '#e8f0ff';
      ctx.beginPath(); ctx.arc(0, -2, 13, Math.PI, 0); ctx.lineTo(13, 14); ctx.quadraticCurveTo(8, 8, 4, 14); ctx.quadraticCurveTo(0, 8, -4, 14); ctx.quadraticCurveTo(-8, 8, -13, 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a4a78'; ell(ctx, -4, -2, 3, 4); ctx.fill(); ell(ctx, 4, -2, 3, 4); ctx.fill();
      ctx.fillStyle = '#fff'; circ(ctx, -4, -3, 1.2); ctx.fill(); circ(ctx, 4, -3, 1.2); ctx.fill();
      ctx.strokeStyle = '#3a4a78'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 4, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      break;
    }
    case 'fish': {
      ctx.fillStyle = '#3ecfbb';
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-22, -8); ctx.lineTo(-22, 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff8ad0'; ell(ctx, 4, -2, 4, 3); ctx.fill();
      circ(ctx, 6, -2, 2.6, '#fff'); circ(ctx, 6.5, -2, 1.3, '#1a1010');
      ctx.strokeStyle = '#2aa89a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-2, 6); ctx.quadraticCurveTo(4, 10, 8, 4); ctx.stroke();
      break;
    }
    case 'slime': {
      const squash = 0.15 + Math.abs(Math.sin(t * 6 + e.phase)) * 0.1;
      ctx.save(); ctx.scale(1 + squash, 1 - squash);
      ctx.fillStyle = '#7ad16a';
      ctx.beginPath(); ctx.ellipse(0, 4, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(ctx, -4, -2, 5, 3); ctx.fill();
      circ(ctx, -4, 0, 3, '#fff'); circ(ctx, 4, 0, 3, '#fff'); circ(ctx, -3.5, 0.5, 1.5, '#1a1010'); circ(ctx, 4.5, 0.5, 1.5, '#1a1010');
      ctx.restore();
      break;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- PARTICLES
/**
 * @param low  budget mode (engine.lowPerf): draws every other particle and
 *             quantises alpha to 4 levels so the canvas changes blend state far
 *             less often — the dominant cost on low-end GPUs.
 */
export function drawParticles(ctx: CanvasRenderingContext2D, pool: Particle[], camY: number, low = false) {
  const step = low ? 2 : 1;
  for (let i = 0; i < pool.length; i += step) {
    const p = pool[i];
    if (!p.active) continue;
    const k = p.life / p.maxLife;
    const y = p.screen ? p.y : p.y - camY;
    const a = Math.min(1, k * 1.5);
    ctx.globalAlpha = low ? Math.ceil(a * 4) / 4 : a;
    ctx.fillStyle = p.color;
    switch (p.kind) {
      case 0: circ(ctx, p.x, y, p.size * (0.4 + k * 0.6)); ctx.fill(); break;
      case 1: ctx.save(); ctx.translate(p.x, y); ctx.rotate(p.rot); star(ctx, 0, 0, p.size * (0.5 + k * 0.5), 4, 0.4); ctx.fill(); ctx.restore(); break;
      case 2: ctx.save(); ctx.translate(p.x, y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66); ctx.restore(); break;
      case 3: ctx.strokeStyle = p.color; ctx.lineWidth = 3 * k; circ(ctx, p.x, y, p.size * (1.6 - k)); ctx.stroke(); break;
      case 4: ctx.fillRect(p.x - 1, y, 2, p.size * k); break;
    }
  }
  ctx.globalAlpha = 1;
}
