import { useEffect, useState } from 'react';
import { BANNER_HEIGHT, adsStore, type AdsState } from '../game/ads';
import { audio } from '../game/audio';
import { Btn } from './ui';

/** Subscribe React to the tiny ads store. */
export function useAdsState(): AdsState {
  const [s, setS] = useState<AdsState>(() => adsStore.get());
  useEffect(() => adsStore.subscribe(setS), []);
  return s;
}

/**
 * Simulated ad surface used by the Mock adapter.
 * Real AdMob renders natively *over* the WebView, so this component simply
 * never receives a `pending` value in live mode — no branching needed.
 */
export function AdOverlay() {
  const { pending } = useAdsState();
  const [left, setLeft] = useState(0);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    if (!pending) return;
    audio.setPaused(true);
    setLeft(pending.seconds); setCanSkip(false);
    const started = performance.now();
    const id = window.setInterval(() => {
      const remain = Math.max(0, pending.seconds - (performance.now() - started) / 1000);
      setLeft(Math.ceil(remain));
      if (remain <= 0) { window.clearInterval(id); if (pending.kind === 'interstitial') adsStore.close(true); else setCanSkip(true); }
    }, 100);
    return () => { window.clearInterval(id); audio.setPaused(false); };
  }, [pending]);

  if (!pending) return null;
  const rewarded = pending.kind === 'rewarded';
  const label = pending.rewardType === 'revive' ? 'Revive' : pending.rewardType === 'doubleCoins' ? 'Double Coins' : 'Bonus Coins';

  return (
    <div className="absolute inset-0 z-[80] flex flex-col items-center justify-center bg-[#0d0a1c]/95 backdrop-blur-sm anim-fade">
      <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-4">
        <span className="glass-chip rounded-lg px-2 py-1 text-[0.6rem] font-extrabold tracking-widest text-[#ffd166]">AD · {rewarded ? 'REWARDED' : 'INTERSTITIAL'} · TEST</span>
        {rewarded && !canSkip && <span className="glass-chip rounded-lg px-2 py-1 text-[0.65rem] font-bold text-white/80">Reward in {left}s</span>}
        {!rewarded && <span className="glass-chip rounded-lg px-2 py-1 text-[0.65rem] font-bold text-white/80">Closes in {left}s</span>}
      </div>

      <div className="w-[82%] max-w-[18rem] aspect-[4/5] glass-panel flex flex-col items-center justify-center gap-3 text-center p-5">
        <div className="text-6xl anim-float">🦝</div>
        <div className="text-2xl font-black text-white glass-text">Raccoon Sky Jump</div>
        <div className="text-xs font-semibold text-white/70 leading-snug">
          This is a <b>simulated ad placeholder</b>. Wire <code className="text-[#ffd166]">@capacitor-community/admob</code> in
          <code className="text-[#ffd166]"> src/game/ads.ts</code> and real ads appear here.
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#ffd166] to-[#5fd648]" style={{ animation: `adBar ${pending.seconds}s linear forwards` }} />
        </div>
        {rewarded && (
          <div className="text-[0.7rem] font-bold text-[#ffd166]">Watch to the end to earn: {label}</div>
        )}
      </div>

      <div className="mt-5 flex gap-3">
        {rewarded && canSkip && <Btn color="green" size="md" glow onClick={() => adsStore.close(true)}>🎁 CLAIM {label.toUpperCase()}</Btn>}
        {rewarded && !canSkip && <Btn color="ghost" size="sm" onClick={() => adsStore.close(false)}>✕ Skip (no reward)</Btn>}
        {!rewarded && left <= 0 && <Btn color="cream" size="sm" onClick={() => adsStore.close(true)}>✕ CLOSE</Btn>}
      </div>
    </div>
  );
}

/**
 * Banner slot anchored to the bottom safe-area edge.
 * It reserves `--ad-h` on <html> so `.app-root` shrinks the playfield and no
 * canvas button can sit underneath the banner. Live AdMob draws its own view
 * in exactly this space; the mock draws a placeholder.
 */
export function BannerAd({ mock }: { mock: boolean }) {
  const { bannerVisible } = useAdsState();
  useEffect(() => {
    document.documentElement.style.setProperty('--ad-h', bannerVisible ? `${BANNER_HEIGHT}px` : '0px');
    return () => { document.documentElement.style.setProperty('--ad-h', '0px'); };
  }, [bannerVisible]);
  if (!bannerVisible || !mock) return null;
  return (
    <div className="fixed left-0 right-0 z-[70] flex items-center justify-center anim-slide-up" style={{ bottom: 'env(safe-area-inset-bottom, 0px)', height: BANNER_HEIGHT }}>
      <div className="h-full w-full max-w-[420px] mx-auto flex items-center justify-between gap-3 px-4 bg-gradient-to-r from-[#24163f] via-[#2f1d52] to-[#24163f] border-t border-[#ffd166]/40 text-white">
        <span className="text-[0.55rem] font-extrabold tracking-widest text-[#ffd166]/80">AD · BANNER · TEST</span>
        <span className="text-xs font-bold truncate">🍃 Raccoon Sky Jump — remove ads in the Shop</span>
        <span className="text-[0.55rem] font-bold text-white/50">320×50</span>
      </div>
    </div>
  );
}
