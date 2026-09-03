import type { Expression, PlayerState, SkinDef } from './types';
import { circ, ell, rr, star, shade } from './utils';

export interface RaccoonPose {
  x: number; y: number;
  scaleX: number; scaleY: number;
  facing: number;
  state: PlayerState;
  t: number;
  vx: number; vy: number;
  skin: SkinDef;
  expression: Expression;
  blink: boolean;
  size: number;
  shield: number;
  spin: number;
  lean: number;
}

const CREAM = '#f7e6c8';
const PINK = '#f29aa0';

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(s, s);
  ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(-1, -1, -2, -4); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.quadraticCurveTo(4, -14, 12, -12);
  ctx.quadraticCurveTo(10, -3, -2, -4);
  ctx.closePath();
  ctx.fillStyle = '#5fd648'; ctx.fill();
  ctx.strokeStyle = '#3f9e2c'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1, -4.5); ctx.quadraticCurveTo(5, -9, 10, -11); ctx.strokeStyle = '#3f9e2c'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.restore();
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, expr: Expression, blink: boolean, look: number) {
  if (blink || expr === 'joy') {
    ctx.strokeStyle = '#1a1010'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath();
    if (expr === 'joy') ctx.arc(x, y + 1.5, r * 0.8, Math.PI * 1.15, Math.PI * 1.85);
    else { ctx.moveTo(x - r * 0.8, y); ctx.lineTo(x + r * 0.8, y); }
    ctx.stroke();
    return;
  }
  if (expr === 'dizzy') {
    ctx.strokeStyle = '#1a1010'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4);
    ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4);
    ctx.stroke();
    return;
  }
  if (expr === 'scared') { circ(ctx, x, y, r + 1, '#ffffff'); r *= 0.75; }
  circ(ctx, x + look, y, r, '#15100f');
  circ(ctx, x + look - r * 0.35, y - r * 0.35, r * 0.36, '#ffffff');
  circ(ctx, x + look + r * 0.3, y + r * 0.3, r * 0.16, 'rgba(255,255,255,0.85)');
  if (expr === 'wow' || expr === 'excited') {
    ctx.fillStyle = '#fff6b0'; star(ctx, x + look + r * 0.25, y - r * 0.2, r * 0.32, 4, 0.45); ctx.fill();
  }
}

function drawOutfit(ctx: CanvasRenderingContext2D, sk: SkinDef, t: number) {
  switch (sk.outfit) {
    case 'vest': {
      ctx.fillStyle = '#f3ead2'; rr(ctx, -16, -36, 32, 22, 8); ctx.fill();
      ctx.fillStyle = '#cbb27a';
      ctx.beginPath(); ctx.moveTo(-16, -28); ctx.lineTo(-16, -10); ctx.lineTo(-4, -8); ctx.lineTo(-6, -32); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(16, -28); ctx.lineTo(16, -10); ctx.lineTo(4, -8); ctx.lineTo(6, -32); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a6a3a'; circ(ctx, -8, -22, 1.4); ctx.fill(); circ(ctx, 8, -22, 1.4); ctx.fill();
      break;
    }
    case 'robe': {
      ctx.fillStyle = '#3d6fe0';
      ctx.beginPath(); ctx.moveTo(-20, -40); ctx.lineTo(-22, 2); ctx.quadraticCurveTo(0, 8, 22, 2); ctx.lineTo(20, -40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2f58c4'; rr(ctx, -8, -38, 16, 6, 3); ctx.fill();
      ctx.fillStyle = '#ffd23f'; circ(ctx, 0, -34, 2.4); ctx.fill();
      break;
    }
    case 'spacesuit': {
      ctx.fillStyle = '#f4f7fb';
      ctx.beginPath(); ctx.ellipse(0, -22, 26, 24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8323c'; rr(ctx, -22, 0, 44, 4, 2); ctx.fill();
      ctx.fillStyle = '#dfe6f0'; rr(ctx, -10, -22, 20, 14, 4); ctx.fill();
      ctx.fillStyle = '#e8323c'; circ(ctx, -4, -16, 2.4); ctx.fill();
      ctx.fillStyle = '#3f9cff'; circ(ctx, 4, -16, 2.4); ctx.fill();
      ctx.fillStyle = '#ffffff'; rr(ctx, -8, -10, 6, 3, 1); ctx.fill();
      break;
    }
    case 'stripes': {
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, -26, 24, 26, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#eef6ff'; ctx.fillRect(-30, -40, 60, 40);
      ctx.fillStyle = '#3d7ad6';
      for (let i = 0; i < 6; i++) ctx.fillRect(-30, -36 + i * 7, 60, 3.5);
      ctx.restore();
      break;
    }
    case 'puffer': {
      ctx.fillStyle = '#3da4f0';
      ctx.beginPath(); ctx.roundRect(-22, -40, 44, 36, 12); ctx.fill();
      ctx.strokeStyle = '#2b86cc'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-18, -32 + i * 7); ctx.lineTo(18, -32 + i * 7); ctx.stroke(); }
      ctx.fillStyle = '#7ec8ff'; rr(ctx, -22, -28, 6, 16, 3); ctx.fill(); rr(ctx, 16, -28, 6, 16, 3); ctx.fill();
      break;
    }
    case 'hero': {
      ctx.fillStyle = '#3b63e8';
      ctx.beginPath(); ctx.ellipse(0, -22, 24, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8323c'; rr(ctx, -18, -8, 36, 12, 6); ctx.fill();
      ctx.fillStyle = '#ffd23f'; rr(ctx, -20, -10, 40, 6, 3); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(7, -16); ctx.lineTo(2, -16); ctx.lineTo(2, -10); ctx.lineTo(-2, -10); ctx.lineTo(-2, -16); ctx.lineTo(-7, -16); ctx.closePath(); ctx.fill();
      ctx.font = '900 8px "Arial Rounded MT Bold", Arial, sans-serif'; ctx.fillStyle = '#e8323c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('A', 0, -18);
      break;
    }
    case 'wrap': {
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, -26, 24, 26, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#2b3556'; ctx.fillRect(-30, -22, 60, 9); ctx.fillStyle = '#3f4c78'; ctx.fillRect(-30, -22, 60, 2);
      ctx.restore();
      break;
    }
    case 'chef': {
      ctx.fillStyle = '#ffffff'; rr(ctx, -18, -20, 36, 16, 6); ctx.fill();
      ctx.fillStyle = '#e8323c'; ctx.beginPath(); ctx.moveTo(-14, -22); ctx.lineTo(14, -22); ctx.lineTo(0, -10); ctx.closePath(); ctx.fill();
      break;
    }
    case 'royal': {
      ctx.fillStyle = '#b3202e'; rr(ctx, -18, -24, 36, 20, 8); ctx.fill();
      ctx.fillStyle = '#ffd23f'; rr(ctx, -18, -8, 36, 4, 2); ctx.fill();
      break;
    }
    case 'cowboy': {
      ctx.fillStyle = '#c97a3a'; rr(ctx, -16, -22, 32, 18, 6); ctx.fill();
      ctx.fillStyle = '#6b3f1d'; rr(ctx, -14, -8, 28, 5, 2); ctx.fill();
      break;
    }
    case 'samurai': {
      ctx.fillStyle = '#c45a3a';
      ctx.beginPath(); ctx.moveTo(-20, -38); ctx.lineTo(-18, 2); ctx.lineTo(18, 2); ctx.lineTo(20, -38); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a2a32'; rr(ctx, -16, -18, 32, 6, 2); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-2, -38, 4, 40);
      break;
    }
    case 'diver': {
      ctx.fillStyle = '#1f8f7a';
      ctx.beginPath(); ctx.ellipse(0, -20, 24, 20, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd23f'; rr(ctx, -12, -24, 24, 6, 3); ctx.fill();
      ctx.fillStyle = '#0e6e5c'; rr(ctx, -8, -8, 16, 8, 3); ctx.fill();
      break;
    }
    case 'fire': {
      ctx.fillStyle = '#d62828'; rr(ctx, -20, -36, 40, 30, 8); ctx.fill();
      ctx.fillStyle = '#ffd23f'; rr(ctx, -8, -18, 16, 10, 3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 9px "Arial Rounded MT Bold", Arial'; ctx.textAlign = 'center'; ctx.fillText('F', 0, -12);
      break;
    }
    case 'detective': {
      ctx.fillStyle = '#4a3a2a'; rr(ctx, -18, -24, 36, 20, 6); ctx.fill();
      ctx.fillStyle = '#c9a06a'; rr(ctx, -6, -8, 12, 8, 2); ctx.fill();
      break;
    }
    case 'flower': {
      ctx.fillStyle = '#7ad16a'; rr(ctx, -18, -20, 36, 16, 8); ctx.fill();
      const cols = ['#ff8ad0', '#ffe14a', '#8f7bff'];
      for (let i = 0; i < 3; i++) { circ(ctx, -10 + i * 10, -14, 3, cols[i]); ctx.fill(); }
      break;
    }
    case 'robot': {
      ctx.fillStyle = '#9aacbe';
      ctx.beginPath(); ctx.roundRect(-20, -40, 40, 34, 8); ctx.fill();
      ctx.fillStyle = '#5ef2ff'; rr(ctx, -8, -22, 16, 8, 2); ctx.fill();
      ctx.fillStyle = '#ff4b6e'; circ(ctx, -10, -30, 2); ctx.fill();
      ctx.fillStyle = '#5fd648'; circ(ctx, 10, -30, 2); ctx.fill();
      break;
    }
    case 'bee': {
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, -26, 24, 26, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#ffe14a'; ctx.fillRect(-30, -50, 60, 50);
      ctx.fillStyle = '#3a2a14';
      for (let i = 0; i < 5; i++) ctx.fillRect(-30, -40 + i * 8, 60, 4);
      ctx.restore();
      ctx.fillStyle = 'rgba(200,230,255,0.55)';
      ctx.beginPath(); ctx.ellipse(-20, -36, 10, 6, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(20, -36, 10, 6, 0.4, 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
  if (sk.extra === 'scarf') {
    ctx.fillStyle = '#7ec8ff'; rr(ctx, -19, -44, 38, 8, 4); ctx.fill();
    ctx.fillStyle = '#5ab0ee'; rr(ctx, 6, -42, 8, 14 + Math.sin(t * 8) * 2, 3); ctx.fill();
  }
  if (sk.extra === 'neckerchief') {
    ctx.fillStyle = '#e8323c'; ctx.beginPath(); ctx.moveTo(-14, -44); ctx.lineTo(14, -44); ctx.lineTo(0, -32); ctx.closePath(); ctx.fill();
  }
}

function drawHat(ctx: CanvasRenderingContext2D, sk: SkinDef, t: number, leafAng: number, airborne: boolean) {
  switch (sk.hat) {
    case 'none': leaf(ctx, 3, -52, leafAng); break;
    case 'explorer': {
      ctx.fillStyle = '#cbb27a'; ell(ctx, 0, -50, 28, 5); ctx.fill();
      ctx.fillStyle = '#d8c08a'; ctx.beginPath(); ctx.ellipse(0, -56, 16, 10, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a6a3a'; ctx.fillRect(-16, -52, 32, 3);
      leaf(ctx, 10, -54, leafAng - 0.4, 0.7);
      break;
    }
    case 'wizard': {
      ctx.fillStyle = '#5b3fb5'; ell(ctx, 0, -50, 24, 5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-15, -50); ctx.quadraticCurveTo(2, -60, 6 + Math.sin(t * 3) * 2, -86); ctx.quadraticCurveTo(8, -62, 15, -50); ctx.closePath();
      ctx.fillStyle = '#5a4ad8'; ctx.fill();
      ctx.fillStyle = '#c9a0ff'; rr(ctx, -12, -56, 24, 5, 2); ctx.fill();
      ctx.fillStyle = '#ffd23f'; star(ctx, -2, -64, 3.5, 5, 0.5); ctx.fill();
      leaf(ctx, 8 + Math.sin(t * 3) * 2, -86, leafAng, 0.7);
      break;
    }
    case 'helmet': {
      ctx.fillStyle = 'rgba(190,230,255,0.35)'; circ(ctx, 0, -37, 26); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -37, 26, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#eef3f8'; ctx.beginPath(); ctx.arc(0, -37, 26, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -37, 19, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
      ctx.fillStyle = '#c9d2e3'; rr(ctx, -16, -16, 32, 6, 3); ctx.fill();
      leaf(ctx, 3, -58, leafAng, 0.65);
      break;
    }
    case 'bandana': {
      ctx.fillStyle = '#e24b4b'; ctx.beginPath(); ctx.ellipse(0, -49, 20, 7, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillRect(-20, -50, 40, 4);
      ctx.fillStyle = '#fff8e6';
      for (let i = -2; i <= 2; i++) circ(ctx, i * 7, -52, 1.6); ctx.fill();
      ctx.fillStyle = '#c43a3a'; ctx.beginPath(); ctx.moveTo(-19, -48); ctx.lineTo(-30 - Math.sin(t * 8) * 2, -40); ctx.lineTo(-19, -42); ctx.closePath(); ctx.fill();
      leaf(ctx, 8, -54, leafAng - 0.3, 0.7);
      break;
    }
    case 'ushanka': {
      ctx.fillStyle = '#3b82d6'; ctx.beginPath(); ctx.ellipse(0, -52, 18, 12, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#efe6d4';
      ell(ctx, -18, -48, 7, 9); ctx.fill(); ell(ctx, 18, -48, 7, 9); ctx.fill();
      rr(ctx, -18, -54, 36, 7, 3); ctx.fill();
      leaf(ctx, 12, -60, leafAng - 0.4, 0.65);
      break;
    }
    case 'ninja': {
      ctx.fillStyle = '#2b3556'; rr(ctx, -20, -50, 40, 6, 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-18, -47); ctx.lineTo(-34 - Math.sin(t * 7) * 3, -44 + Math.cos(t * 7) * 3); ctx.lineTo(-30 - Math.sin(t * 7) * 3, -38); ctx.lineTo(-18, -44); ctx.closePath(); ctx.fill();
      leaf(ctx, 3, -52, leafAng, 0.8);
      break;
    }
    case 'toque': {
      ctx.fillStyle = '#ffffff'; rr(ctx, -16, -54, 32, 7, 2); ctx.fill();
      circ(ctx, -9, -60, 8); ctx.fill(); circ(ctx, 0, -64, 9); ctx.fill(); circ(ctx, 9, -60, 8); ctx.fill();
      leaf(ctx, 9, -66, leafAng - 0.3, 0.7);
      break;
    }
    case 'crown': {
      ctx.fillStyle = '#ffc42e';
      ctx.beginPath(); ctx.moveTo(-13, -49); ctx.lineTo(-13, -62); ctx.lineTo(-6, -55); ctx.lineTo(0, -65); ctx.lineTo(6, -55); ctx.lineTo(13, -62); ctx.lineTo(13, -49); ctx.closePath(); ctx.fill();
      circ(ctx, -13, -62, 2, '#ff4b6e'); circ(ctx, 0, -65, 2.2, '#3f9cff'); circ(ctx, 13, -62, 2, '#5fd648');
      leaf(ctx, 9, -50, leafAng - 0.5, 0.7);
      break;
    }
    case 'cowboy': {
      ctx.fillStyle = '#c48a3a'; ell(ctx, 0, -50, 30, 5); ctx.fill();
      ctx.fillStyle = '#a86b2a'; ctx.beginPath(); ctx.ellipse(0, -58, 14, 10, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b3f1d'; ctx.fillRect(-14, -52, 28, 3);
      leaf(ctx, 10, -56, leafAng - 0.3, 0.65);
      break;
    }
    case 'samurai': {
      ctx.fillStyle = '#2a2a32'; ctx.beginPath(); ctx.moveTo(-22, -50); ctx.lineTo(0, -64); ctx.lineTo(22, -50); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c45a3a'; rr(ctx, -16, -54, 32, 6, 2); ctx.fill();
      leaf(ctx, 8, -62, leafAng, 0.65);
      break;
    }
    case 'diver': {
      ctx.fillStyle = '#cfd8e3'; circ(ctx, 0, -36, 24); ctx.fill();
      ctx.fillStyle = 'rgba(160,210,230,0.35)'; circ(ctx, 0, -36, 20); ctx.fill();
      ctx.strokeStyle = '#8aa0b4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -36, 24, 0, Math.PI * 2); ctx.stroke();
      leaf(ctx, 3, -58, leafAng, 0.6);
      break;
    }
    case 'firehat': {
      ctx.fillStyle = '#d62828'; ell(ctx, 0, -50, 26, 5); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -58, 14, 10, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-3, -64, 6, 10);
      leaf(ctx, 10, -56, leafAng, 0.65);
      break;
    }
    case 'detective': {
      ctx.fillStyle = '#3a2a1a'; ell(ctx, 0, -50, 26, 4); ctx.fill();
      ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.ellipse(0, -56, 13, 8, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9a06a'; ctx.fillRect(-13, -52, 26, 3);
      leaf(ctx, 10, -54, leafAng, 0.65);
      break;
    }
    case 'flower': {
      const cols = ['#ff8ad0', '#ffe14a', '#8f7bff', '#5fd648'];
      for (let i = 0; i < 6; i++) {
        const a = t * 0.6 + i * Math.PI / 3;
        circ(ctx, Math.cos(a) * 10, -58 + Math.sin(a) * 6, 4.5, cols[i % 4]); ctx.fill();
      }
      circ(ctx, 0, -58, 4, '#ffe14a'); ctx.fill();
      leaf(ctx, 12, -52, leafAng, 0.7);
      break;
    }
    case 'antenna': {
      ctx.strokeStyle = '#6a7a8a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-6, -50); ctx.lineTo(-10, -66); ctx.moveTo(6, -50); ctx.lineTo(10, -66); ctx.stroke();
      circ(ctx, -10, -68, 3.2, sk.outfit === 'bee' ? '#ffe14a' : '#ff4b6e'); ctx.fill();
      circ(ctx, 10, -68, 3.2, sk.outfit === 'bee' ? '#ffe14a' : '#5ef2ff'); ctx.fill();
      leaf(ctx, 4, -52, leafAng, 0.7);
      break;
    }
    case 'hero': {
      ctx.fillStyle = '#6a4dff';
      ctx.beginPath(); ctx.moveTo(-20, -42); ctx.quadraticCurveTo(-22, -50, -8, -46); ctx.lineTo(8, -46); ctx.quadraticCurveTo(22, -50, 20, -42); ctx.quadraticCurveTo(0, -36, -20, -42); ctx.closePath(); ctx.fill();
      leaf(ctx, 10, -52, leafAng, 0.65);
      break;
    }
  }
  if (airborne) { /* keep leaf motion already applied */ }
}

function drawProp(ctx: CanvasRenderingContext2D, sk: SkinDef, ax: number, ay: number, t: number) {
  ctx.save();
  ctx.translate(ax + 4, ay);
  switch (sk.prop) {
    case 'compass': {
      circ(ctx, 0, 0, 6, '#e0a020'); ctx.fill();
      circ(ctx, 0, 0, 4.2, '#f4f7fb'); ctx.fill();
      ctx.strokeStyle = '#e8323c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t) * 3, Math.sin(t) * 3); ctx.stroke();
      ctx.strokeStyle = '#3f9cff'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-Math.cos(t) * 3, -Math.sin(t) * 3); ctx.stroke();
      break;
    }
    case 'staff': {
      ctx.strokeStyle = '#8a5530'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(2, -18); ctx.stroke();
      const g = 0.6 + Math.sin(t * 6) * 0.4;
      ctx.fillStyle = `rgba(80,180,255,${0.35 * g})`; circ(ctx, 2, -20, 7); ctx.fill();
      circ(ctx, 2, -20, 3.5, '#7fd4ff'); ctx.fill();
      break;
    }
    case 'cutlass': {
      ctx.fillStyle = '#c0c8d4';
      ctx.beginPath(); ctx.moveTo(-2, 6); ctx.lineTo(2, 6); ctx.lineTo(6, -16); ctx.lineTo(2, -18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e0a020'; rr(ctx, -5, 4, 10, 4, 1); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

export function drawRaccoon(ctx: CanvasRenderingContext2D, p: RaccoonPose) {
  const sk = p.skin;
  const body = sk.body || '#a8704a';
  const belly = sk.belly || CREAM;
  const mask = sk.mask || '#4b2f22';
  const dark = sk.dark || '#5b3b2b';
  const bodyDark = shade(body, -0.22);
  const bodyLight = shade(body, 0.18);
  const t = p.t;
  const st = p.state;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.size, p.size);
  ctx.rotate(p.spin);
  ctx.translate(0, -22);
  ctx.rotate(p.lean);
  ctx.scale(p.scaleX * p.facing, p.scaleY);
  ctx.translate(0, 22);

  const airborne = st === 'jump' || st === 'fall' || st === 'super' || st === 'hurt';
  const wag = Math.sin(t * (airborne ? 9 : 4)) * (airborne ? 1 : 0.6);

  if (sk.cape) {
    const flow = airborne ? (p.vy < 0 ? 1 : -0.6) : 0;
    const f = Math.sin(t * 10) * 3;
    ctx.beginPath();
    ctx.moveTo(-15, -40);
    ctx.quadraticCurveTo(-30 - f, -20 + flow * 8, -26 - f * 1.5, 2 + flow * 14);
    ctx.lineTo(26 + f * 1.5, 2 + flow * 14);
    ctx.quadraticCurveTo(30 + f, -20 + flow * 8, 15, -40);
    ctx.closePath();
    if (sk.id === 'hero') {
      const g = ctx.createLinearGradient(-20, -40, 20, 10);
      g.addColorStop(0, '#e8323c'); g.addColorStop(0.5, '#ff9a2e'); g.addColorStop(1, '#ffd23f');
      ctx.fillStyle = g;
    } else ctx.fillStyle = sk.cape;
    ctx.fill();
    if (sk.id === 'royal') {
      ctx.fillStyle = '#fff8e6';
      ctx.beginPath(); ctx.moveTo(-26 - f * 1.5, 2 + flow * 14); ctx.lineTo(26 + f * 1.5, 2 + flow * 14);
      ctx.lineTo(26 + f * 1.5, -3 + flow * 14); ctx.lineTo(-26 - f * 1.5, -3 + flow * 14); ctx.closePath(); ctx.fill();
    }
  }

  const tailSegs = 6;
  for (let i = 0; i < tailSegs; i++) {
    const k = i / (tailSegs - 1);
    const ang = -0.6 - k * 1.4 + wag * 0.25 * k;
    const dist = 12 + k * 26;
    const tx = -8 + Math.cos(Math.PI + ang * -1) * dist * 0.95;
    const ty = -12 + Math.sin(Math.PI + ang * -1) * dist * 0.6 - k * 14 + wag * k * 4;
    const r = 8.5 - Math.abs(k - 0.45) * 5;
    circ(ctx, tx, ty, r, i % 2 === 0 ? bodyDark : mask);
  }

  let fx = 10, fy = -3, fSpread = 0;
  if (st === 'jump' || st === 'super') { fx = 8; fy = -6; }
  if (st === 'fall') { fx = 12; fy = -2; fSpread = 0.3; }
  if (st === 'hurt') { fx = 12; fy = -4; fSpread = 0.5; }
  const boot = sk.outfit === 'hero' ? '#e8323c' : sk.outfit === 'puffer' ? '#2b6cb0' : sk.outfit === 'spacesuit' ? '#e8323c' : dark;
  ctx.save(); ctx.translate(-fx, fy); ctx.rotate(-fSpread); ell(ctx, 0, 0, 8, 5, boot); ctx.restore();
  ctx.save(); ctx.translate(fx, fy); ctx.rotate(fSpread); ell(ctx, 0, 0, 8, 5, boot); ctx.restore();

  const g = ctx.createRadialGradient(-8, -38, 4, 0, -24, 34);
  g.addColorStop(0, bodyLight); g.addColorStop(0.55, body); g.addColorStop(1, bodyDark);
  ctx.beginPath(); ctx.ellipse(0, -26, 24, 26, 0, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();

  if (!sk.outfit || sk.outfit === 'vest' || sk.outfit === 'stripes' || sk.outfit === 'bee' || sk.outfit === 'wrap') {
    ell(ctx, 0, -14, 13, 11, belly);
    ctx.fillStyle = shade(belly, -0.12);
    ell(ctx, -4, -14, 1.2, 2.2); ctx.fill(); ell(ctx, 0, -12, 1.2, 2.2); ctx.fill(); ell(ctx, 4, -14, 1.2, 2.2); ctx.fill();
  }

  drawOutfit(ctx, sk, t);

  let ax = 22, ay = -22;
  if (st === 'jump' || st === 'super') { ax = 23; ay = -40 + Math.sin(t * 12) * 1.5; }
  else if (st === 'fall') { ax = 26; ay = -30; }
  else if (st === 'land') { ax = 24; ay = -13; }
  else if (st === 'hurt') { ax = 24; ay = -38 + Math.sin(t * 20) * 4; }
  else if (st === 'celebrate') { ax = 21; ay = -46 + Math.sin(t * 14) * 3; }
  else { ay = -22 + Math.sin(t * 2.5) * 1; }
  circ(ctx, -ax, ay, 6.5, dark); circ(ctx, ax, ay, 6.5, dark);
  circ(ctx, -ax - 1, ay - 1.5, 2.2, shade(dark, 0.25)); circ(ctx, ax + 1, ay - 1.5, 2.2, shade(dark, 0.25));
  if (sk.prop) drawProp(ctx, sk, ax, ay, t);

  const earY = -47;
  circ(ctx, -15, earY, 7.5, bodyDark); circ(ctx, 15, earY, 7.5, bodyDark);
  circ(ctx, -15, earY + 0.5, 4, PINK); circ(ctx, 15, earY + 0.5, 4, PINK);

  ell(ctx, 0, -34, 18, 14, CREAM);
  ctx.fillStyle = mask;
  ctx.beginPath(); ctx.ellipse(-9.5, -37, 11, 8, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(9.5, -37, 11, 8, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-9, -42, 18, 9);
  const look = Math.max(-2, Math.min(2, p.vx / 200)) * p.facing;
  const er = p.expression === 'excited' ? 6.8 : 6.2;
  eye(ctx, -9, -37, er, p.expression, p.blink, look);
  eye(ctx, 9, -37, er, p.expression, p.blink, look);
  if (sk.extra === 'eyepatch' || sk.extra === 'mask') {
    if (sk.extra === 'eyepatch') {
      ctx.strokeStyle = '#1a1010'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-1, -44); ctx.lineTo(-19, -40); ctx.stroke();
      circ(ctx, -9, -37, 6.6, '#1a1010'); circ(ctx, -11, -39, 1.4, 'rgba(255,255,255,0.35)');
    } else {
      ctx.fillStyle = '#6a4dff';
      ctx.beginPath(); ctx.moveTo(-20, -44); ctx.quadraticCurveTo(-22, -32, -8, -32); ctx.lineTo(8, -32); ctx.quadraticCurveTo(22, -32, 20, -44); ctx.closePath(); ctx.fill();
      eye(ctx, -9, -37, er * 0.9, p.expression, p.blink, look);
      eye(ctx, 9, -37, er * 0.9, p.expression, p.blink, look);
    }
  }
  ell(ctx, 0, -27.5, 9, 6.5, CREAM);
  ell(ctx, 0, -30.5, 3.2, 2.3, '#2a1a14');
  circ(ctx, -1, -31.2, 0.9, 'rgba(255,255,255,0.6)');
  ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  if (p.expression === 'excited' || p.expression === 'joy') {
    ctx.beginPath(); ctx.ellipse(0, -25.5, 4, 3.6, 0, 0, Math.PI); ctx.fillStyle = '#4a1e1e'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -23.5, 2.5, 1.6, 0, 0, Math.PI); ctx.fillStyle = '#f26d7d'; ctx.fill();
  } else if (p.expression === 'wow' || p.expression === 'scared') {
    circ(ctx, 0, -25.5, p.expression === 'scared' ? 2.6 : 2, '#4a1e1e');
  } else if (p.expression === 'dizzy') {
    ctx.beginPath(); ctx.moveTo(-4, -25); ctx.quadraticCurveTo(-2, -27, 0, -25); ctx.quadraticCurveTo(2, -23, 4, -25); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(0, -27, 3.2, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  }
  circ(ctx, -15, -29, 3.2, 'rgba(242,120,120,0.45)'); circ(ctx, 15, -29, 3.2, 'rgba(242,120,120,0.45)');

  const leafAng = Math.sin(t * 3) * 0.12 - p.vx / 2500 * p.facing + (airborne ? -p.vy / 6000 : 0);
  drawHat(ctx, sk, t, leafAng, airborne);

  if (sk.extra === 'sparkle') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 3; i++) {
      const ph = t * 2 + i * 2.1; const s = (Math.sin(ph * 2) + 1) * 0.5;
      star(ctx, Math.cos(ph) * 22, -30 + Math.sin(ph * 1.3) * 18, 1.5 + s * 2.5, 4, 0.4); ctx.fill();
    }
  }
  if (p.expression === 'dizzy') {
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      star(ctx, Math.cos(a) * 16, -60 + Math.sin(a) * 5, 3.5, 5, 0.5); ctx.fill();
    }
  }
  ctx.restore();

  if (p.shield > 0) {
    ctx.save();
    ctx.translate(p.x, p.y - 26 * p.size);
    const pulse = 1 + Math.sin(t * 6) * 0.04;
    const r = 38 * p.size * pulse;
    const sg = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r);
    sg.addColorStop(0, 'rgba(120,200,255,0.05)'); sg.addColorStop(1, `rgba(120,200,255,${0.35 * p.shield})`);
    circ(ctx, 0, 0, r); ctx.fillStyle = sg; ctx.fill();
    ctx.strokeStyle = `rgba(200,240,255,${0.8 * p.shield})`; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
}
