import { useEffect, useRef, type ReactNode } from 'react';
import { drawRaccoon } from '../game/raccoon';
import type { SkinDef } from '../game/types';
import { audio } from '../game/audio';
import { cn } from '../utils/cn';

type Color = 'green' | 'gold' | 'cream' | 'red' | 'blue' | 'wood' | 'purple' | 'ghost';

const colors: Record<Color, string> = {
  green: 'bg-gradient-to-b from-[#8fe05a] to-[#4fb52a] border-[#2f7a17] text-white',
  gold: 'bg-gradient-to-b from-[#ffe27a] to-[#f2b62a] border-[#b57a10] text-[#5a3410]',
  cream: 'bg-gradient-to-b from-[#fff8e8] to-[#f1dfc0] border-[#b8925f] text-[#5a3410]',
  red: 'bg-gradient-to-b from-[#ff8a7a] to-[#e2483c] border-[#9c2a20] text-white',
  blue: 'bg-gradient-to-b from-[#7fc4ff] to-[#3f8fe8] border-[#215ba8] text-white',
  wood: 'bg-gradient-to-b from-[#c98a4b] to-[#8b5a2b] border-[#5a3a1a] text-[#fff3dd]',
  purple: 'bg-gradient-to-b from-[#c48cff] to-[#7d4fe0] border-[#4a2a9c] text-white',
  ghost: 'glass-chip text-[#fff8e6] border-b-[rgba(255,209,102,0.55)]',
};

export function Btn({ color = 'green', size = 'md', className, children, onClick, disabled, silent, glow, title }: {
  color?: Color; size?: 'lg' | 'md' | 'sm' | 'xs' | 'icon'; className?: string; children: ReactNode; onClick?: () => void; disabled?: boolean; silent?: boolean; glow?: boolean; title?: string;
}) {
  const sizes = {
    lg: 'px-8 py-3.5 text-2xl min-w-[11rem]', md: 'px-5 py-2.5 text-lg', sm: 'px-3 py-1.5 text-sm', xs: 'px-2.5 py-1 text-xs', icon: 'w-11 h-11 text-xl p-0',
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onPointerDown={() => { if (!silent) { audio.init(); audio.click(); } }}
      onClick={onClick}
      className={cn(
        'game-btn relative inline-flex items-center justify-center gap-2 rounded-2xl border-b-[5px] font-bold tracking-wide select-none',
        'shadow-[0_6px_14px_rgba(40,20,0,0.25)] transition-[transform,filter,box-shadow] duration-100 ease-out',
        'active:translate-y-[3px] active:border-b-[2px] active:shadow-none active:scale-[0.98] active:brightness-110',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffd166]/60',
        'disabled:opacity-50 disabled:pointer-events-none disabled:saturate-50',
        glow && 'anim-glow', colors[color], sizes[size], className,
      )}
    >
      <span className="absolute inset-x-2 top-1 h-[35%] rounded-xl bg-white/25 pointer-events-none" />
      <span className="relative drop-shadow-[0_1px_0_rgba(0,0,0,0.25)] flex items-center gap-2">{children}</span>
    </button>
  );
}

/**
 * Glassmorphic container (kept under the historical `WoodPanel` name so every
 * screen upgrades without churn). `inner` renders the cream content plate.
 */
export function WoodPanel({ children, className, title, inner = true, badge }: { children: ReactNode; className?: string; title?: string; inner?: boolean; badge?: ReactNode }) {
  return (
    <div className={cn('glass-panel p-2.5', className)}>
      {title && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10 px-5 py-1 rounded-xl bg-gradient-to-b from-[#ffe27a] to-[#f2b62a] border-2 border-[#b57a10] text-[#5a3410] font-extrabold text-lg tracking-wider whitespace-nowrap shadow-[0_6px_18px_rgba(255,209,102,0.45)]">
          {title}
        </div>
      )}
      {badge && <div className="absolute -top-3 right-3 z-10">{badge}</div>}
      {inner
        ? <div className={cn('relative glass-inner p-3', title && 'pt-5')}>{children}</div>
        : <div className="relative">{children}</div>}
    </div>
  );
}
export const GlassPanel = WoodPanel;

export function CoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('w-5 h-5 inline-block', className)} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#e0a020" />
      <circle cx="12" cy="12" r="8.5" fill="#ffd23f" />
      <path d="M12 6.5l1.6 3.4 3.7.4-2.8 2.5.8 3.7L12 14.6l-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z" fill="#e0a020" />
      <ellipse cx="9" cy="8" rx="3" ry="1.4" fill="#fff0a0" opacity="0.8" />
    </svg>
  );
}

export function CoinBadge({ value, className, pulse }: { value: number; className?: string; pulse?: boolean }) {
  return (
    <div className={cn('glass-chip inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-[#fff8e6] font-extrabold tabular-nums', pulse && 'anim-pulse', className)}>
      <CoinIcon className="w-5 h-5 drop-shadow-[0_0_6px_rgba(255,210,63,0.8)]" /> {value.toLocaleString()}
    </div>
  );
}

export function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 pt-3">
      <Btn color="ghost" size="icon" onClick={onBack} title="Back"><span className="text-2xl leading-none">‹</span></Btn>
      <h2 className="text-2xl font-extrabold text-white game-title-shadow tracking-wider">{title}</h2>
      <div className="min-w-[2.75rem] flex justify-end">{right}</div>
    </div>
  );
}

export function SkinPreview({ skin, size = 80, animate = true, className }: { skin: SkinDef; size?: number; animate?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let raf = 0; let t = Math.random() * 10; let last = performance.now();
    const draw = () => {
      const now = performance.now(); t += (now - last) / 1000; last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const breathe = 1 + Math.sin(t * 3) * 0.02;
      drawRaccoon(ctx, {
        x: size / 2, y: size * 0.9, scaleX: 2 - breathe, scaleY: breathe, facing: 1, state: 'idle', t, vx: 0, vy: 0, skin,
        expression: 'happy', blink: (t % 3.7) < 0.12, size: size / 78, shield: 0, spin: 0, lean: 0,
      });
      if (animate) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [skin, size, animate]);
  return <canvas ref={ref} style={{ width: size, height: size }} className={className} />;
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-6 anim-fade" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[20rem] anim-pop">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, max, color = '#5fd648' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-3 w-full rounded-full bg-[#d9c4a0] overflow-hidden border border-[#b8925f]">
      <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, #fff6a0)` }} />
    </div>
  );
}

export function Pill({ children, tone = 'gold', className }: { children: ReactNode; tone?: 'gold' | 'green' | 'blue' | 'grey' | 'red'; className?: string }) {
  const tones = {
    gold: 'bg-[#ffd166] text-[#5a3410] border-[#b57a10]',
    green: 'bg-[#5fd648] text-white border-[#2f7a17]',
    blue: 'bg-[#3f9cff] text-white border-[#215ba8]',
    grey: 'bg-[#d9c4a0] text-[#5a3410] border-[#b8925f]',
    red: 'bg-[#e8323c] text-white border-[#9c2a20]',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[0.65rem] font-extrabold tracking-wider', tones[tone], className)}>{children}</span>;
}
