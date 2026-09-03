import { useState } from 'react';
import type { DifficultyMode, RewardType, RunResult, SaveData } from '../game/types';
import { DIFF_MODES, SKINS, WORLDS } from '../game/config';
import { useUser } from '../context/UserContext';
import { Btn, CoinBadge, CoinIcon, Pill, SkinPreview, WoodPanel } from './ui';
import { cn } from '../utils/cn';

export type NavTarget = 'shop' | 'characters' | 'missions' | 'settings' | 'scores' | 'leaderboard';

export function Logo({ small }: { small?: boolean }) {
  return (
    <div className={small ? 'scale-75 origin-top' : ''}>
      <div className="relative text-center leading-none select-none">
        <div className="logo-raccoon text-[3.1rem] font-black tracking-wide" style={{ transform: 'rotate(-3deg)' }}>RACCOON</div>
        <div className="logo-sky text-[2.1rem] font-black tracking-[0.2em] -mt-1" style={{ transform: 'rotate(-3deg)' }}>SKY JUMP</div>
        <span className="absolute -top-3 -right-1 text-2xl anim-float">🍃</span>
        <span className="absolute -bottom-2 -left-2 text-xl anim-float" style={{ animationDelay: '0.6s' }}>✨</span>
      </div>
    </div>
  );
}

/** Compact cloud-account chip: sign in → link Google → signed in. */
export function ProfileChip({ onOpen }: { onOpen: () => void }) {
  const { user, busy, mode } = useUser();
  return (
    <button type="button" onClick={onOpen} className="glass-chip tap rounded-xl px-2.5 py-1 flex items-center gap-1.5 text-[#fff8e6] font-bold text-xs max-w-[9.5rem]">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${user ? 'bg-gradient-to-b from-[#7fc4ff] to-[#3f8fe8]' : 'bg-white/15'}`}>{busy ? '…' : user ? '🦝' : '👤'}</span>
      <span className="truncate">{user ? user.displayName : 'Sign in'}</span>
      {user?.provider === 'google' && <span className="text-[0.55rem] text-[#ffd166]">G</span>}
      {!user && mode === 'live' && <span className="text-[0.55rem] text-[#7fd4ff]">☁</span>}
    </button>
  );
}

export function HomeScreen({ save, onPlay, onNav, onClaimDailyGift, canClaimGift, onProfile }: {
  save: SaveData; onPlay: () => void; onNav: (s: NavTarget) => void; onClaimDailyGift: () => void; canClaimGift: boolean; onProfile: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col pointer-events-none anim-fade">
      <div className="flex items-start justify-between gap-2 p-3 pointer-events-auto">
        <div className="flex flex-col gap-1.5 items-start">
          <div className="glass-chip rounded-xl px-3 py-1 text-[#fff8e6] font-extrabold flex items-center gap-1.5 tabular-nums">
            <span>🏆</span> {Math.floor(save.bestAltitude).toLocaleString()} m
          </div>
          <ProfileChip onOpen={onProfile} />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <CoinBadge value={save.coins} />
          {canClaimGift && (
            <button type="button" onClick={onClaimDailyGift} className="tap rounded-xl bg-gradient-to-b from-[#ff8a7a] to-[#e2483c] border-2 border-[#9c2a20] px-3 py-1 text-white font-extrabold text-xs shadow-[0_0_18px_rgba(255,120,100,0.5)] anim-pulse flex items-center gap-1">
              🎁 <span>+100 COINS</span>
            </button>
          )}
        </div>
      </div>
      <div className="mt-1"><Logo /></div>
      <div className="flex-1" />
      <div className="home-cluster flex flex-col items-center gap-3 pb-5 pointer-events-auto stagger">
        <Btn color="green" size="lg" glow onClick={onPlay} className="text-3xl px-12 py-4">▶ PLAY</Btn>
        <div className="grid grid-cols-3 gap-2 px-4 w-full max-w-[22rem]">
          <Btn color="gold" size="sm" onClick={() => onNav('shop')} className="w-full">🛒 SHOP</Btn>
          <Btn color="blue" size="sm" onClick={() => onNav('characters')} className="w-full">🐾 SKINS</Btn>
          <Btn color="red" size="sm" onClick={() => onNav('missions')} className="w-full">⭐ MISSIONS</Btn>
          <Btn color="purple" size="sm" onClick={() => onNav('leaderboard')} className="w-full">🌍 RANKS</Btn>
          <Btn color="cream" size="sm" onClick={() => onNav('scores')} className="w-full">🏆 SCORES</Btn>
          <Btn color="wood" size="sm" onClick={() => onNav('settings')} className="w-full">⚙️ SETTINGS</Btn>
        </div>
        <p className="home-hint text-white/85 text-[0.7rem] font-semibold game-title-shadow">Move with ← → / A D · tap left or right on mobile</p>
      </div>
    </div>
  );
}

export function PauseScreen({ save, onResume, onRestart, onHome, onToggleSfx, onToggleMusic }: {
  save: SaveData; onResume: () => void; onRestart: () => void; onHome: () => void; onToggleSfx: () => void; onToggleMusic: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-[3px] p-6 py-8 anim-fade">
      <WoodPanel title="PAUSED" className="w-full max-w-[18rem] anim-pop my-auto">
        <div className="flex flex-col gap-2.5 items-stretch pt-2 stagger">
          <Btn color="green" size="md" onClick={onResume}>▶ RESUME</Btn>
          <Btn color="gold" size="md" onClick={onRestart}>↻ RESTART</Btn>
          <Btn color="cream" size="md" onClick={onHome}>🏠 HOME</Btn>
          <div className="flex justify-center gap-3 pt-1">
            <Btn color={save.settings.sfx ? 'blue' : 'cream'} size="icon" onClick={onToggleSfx} title="Sound effects">{save.settings.sfx ? '🔊' : '🔇'}</Btn>
            <Btn color={save.settings.music ? 'blue' : 'cream'} size="icon" onClick={onToggleMusic} title="Music"><span className={save.settings.music ? '' : 'opacity-40'}>🎵</span></Btn>
          </div>
        </div>
      </WoodPanel>
    </div>
  );
}

export function GameOverScreen({ result, save, newBest, canRevive, onRetry, onHome, onWatchAd, newAchievements, adBusy, coinsDoubled }: {
  result: RunResult; save: SaveData; newBest: boolean; canRevive: boolean; onRetry: () => void; onHome: () => void;
  /** Opens a rewarded ad; the parent applies the reward on success. */
  onWatchAd: (type: RewardType) => void;
  newAchievements: string[]; adBusy: boolean; coinsDoubled: boolean;
}) {
  const [confirmHome, setConfirmHome] = useState(false);
  const shownCoins = coinsDoubled ? result.coins * 2 : result.coins;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/45 backdrop-blur-[3px] p-5 py-8 anim-fade">
      <WoodPanel title="GAME OVER" className="w-full max-w-[19.5rem] anim-pop my-auto" badge={newBest ? <Pill tone="gold" className="anim-pulse">🎉 NEW BEST</Pill> : undefined}>
        <div className="flex flex-col gap-2 pt-1 stagger">
          <div className="rounded-xl bg-white/60 border border-[#d9c4a0] p-2 text-center">
            <div className="text-[0.7rem] font-bold text-[#8a5a2b] tracking-widest">SCORE</div>
            <div className="text-3xl font-black text-[#3b2415] leading-tight tabular-nums">{result.score.toLocaleString()}</div>
            <div className="text-sm font-bold text-[#5a3410]">{result.altitude.toLocaleString()} m · {WORLDS[result.world].name}</div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <Stat label="BEST" value={`${Math.floor(save.bestScore).toLocaleString()}`} />
            <Stat label="COINS" value={<span className={`inline-flex items-center gap-1 ${coinsDoubled ? 'text-[#2f7a17]' : ''}`}><CoinIcon className="w-4 h-4" />{shownCoins}{coinsDoubled && ' ✓'}</span>} />
            <Stat label="COMBO" value={`x${result.maxCombo}`} />
          </div>
          {newAchievements.length > 0 && (
            <div className="rounded-xl bg-[#ffe9a8] border border-[#e0b040] px-2 py-1 text-center text-xs font-bold text-[#7a4a10]">🏅 {newAchievements.join(' · ')}</div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Btn color="gold" size="sm" disabled={!canRevive || adBusy} onClick={() => onWatchAd('revive')} className="w-full flex-col gap-0 py-2">
              <span className="text-base">💛 REVIVE</span>
              <span className="text-[0.6rem] bg-[#5a3410] text-[#ffe27a] rounded px-1.5 py-0.5">{canRevive ? '▶ WATCH AD' : 'USED'}</span>
            </Btn>
            <Btn color="purple" size="sm" disabled={coinsDoubled || adBusy || result.coins === 0} onClick={() => onWatchAd('doubleCoins')} className="w-full flex-col gap-0 py-2">
              <span className="text-base">✨ 2× COINS</span>
              <span className="text-[0.6rem] bg-[#2a1550] text-[#e6d2ff] rounded px-1.5 py-0.5">{coinsDoubled ? 'CLAIMED' : `▶ +${result.coins}`}</span>
            </Btn>
          </div>

          <Btn color="green" size="lg" glow disabled={adBusy} onClick={onRetry} className="w-full text-2xl">{adBusy ? '…' : '↻ RETRY'}</Btn>
          {confirmHome
            ? <div className="flex gap-2"><Btn color="cream" size="sm" className="flex-1" onClick={() => setConfirmHome(false)}>Stay</Btn><Btn color="red" size="sm" className="flex-1" disabled={adBusy} onClick={onHome}>Leave</Btn></div>
            : <Btn color="cream" size="md" disabled={adBusy} onClick={() => (canRevive && !coinsDoubled ? setConfirmHome(true) : onHome())}>🏠 HOME</Btn>}
        </div>
      </WoodPanel>
    </div>
  );
}

/** Pre-game setup: pick a start LOCATION, DIFFICULTY and confirm the CHARACTER.
    Location options are clamped to the furthest world reached (locked beyond it). */
export function SetupScreen({ save, onStart, onBack, onCharacters }: {
  save: SaveData; onStart: (loc: number, diff: DifficultyMode) => void; onBack: () => void; onCharacters: () => void;
}) {
  const maxW = Math.min(WORLDS.length - 1, save.stats.maxWorld);
  const [loc, setLoc] = useState<number>(() => Math.min(save.settings.startWorld, maxW));
  const [diff, setDiff] = useState<DifficultyMode>(save.settings.difficulty);
  const skin = SKINS.find((s) => s.id === save.selected) || SKINS[0];
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/50 backdrop-blur-[3px] p-5 py-8 anim-fade">
      <WoodPanel title="GAME SETUP" className="w-full max-w-[20rem] anim-pop my-auto">
        <div className="flex flex-col gap-4 pt-2">
          <div>
            <div className="text-[0.62rem] font-extrabold tracking-widest text-[#8a5a2b]">LOCATION</div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {WORLDS.map((wd, i) => {
                const unlocked = i <= maxW;
                return (
                  <button key={wd.id} type="button" disabled={!unlocked} title={unlocked ? wd.name : 'Reach this height to unlock'}
                    onClick={() => setLoc(i)}
                    className={cn('tap rounded-lg px-2.5 py-1 text-[0.7rem] font-extrabold border border-b-2', loc === i ? 'bg-gradient-to-b from-[#ffe27a] to-[#f2b62a] border-[#b57a10] text-[#5a3410]' : 'bg-white/50 border-[#cbb27a] text-[#5a3410]', !unlocked && 'opacity-40 grayscale cursor-not-allowed')}>
                    {unlocked ? wd.name : `🔒 ${wd.name}`}
                  </button>
                );
              })}
            </div>
            {loc > 0 && <p className="text-[0.6rem] text-[#7a5a3a] font-semibold mt-1">Start climbing in {WORLDS[loc].name} at {WORLDS[loc].startM.toLocaleString()} m.</p>}
          </div>

          <div>
            <div className="text-[0.62rem] font-extrabold tracking-widest text-[#8a5a2b]">DIFFICULTY</div>
            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
              {(['easy', 'normal', 'hard'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setDiff(m)}
                  className={cn('tap rounded-lg py-1.5 text-[0.72rem] font-extrabold border border-b-2', diff === m ? 'bg-gradient-to-b from-[#8fe05a] to-[#4fb52a] border-[#2f7a17] text-white' : 'bg-white/50 border-[#cbb27a] text-[#5a3410]')}>
                  {DIFF_MODES[m].label.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="text-[0.6rem] text-[#7a5a3a] font-semibold mt-1">{DIFF_MODES[diff].desc}.</p>
          </div>

          <div>
            <div className="text-[0.62rem] font-extrabold tracking-widest text-[#8a5a2b]">CHARACTER</div>
            <div className="glass-inner flex items-center gap-3 p-2 mt-1.5">
              <div className="rounded-xl bg-gradient-to-b from-[#9ad9ff] to-[#5fb6f0] border-2 border-[#3f8fd0]"><SkinPreview skin={skin} size={58} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-[#3b2415] truncate">{skin.name}</div>
                <div className="text-[0.62rem] font-semibold text-[#7a5a3a]">Uses your unlocked roster.</div>
              </div>
              <Btn color="cream" size="sm" onClick={onCharacters}>CHANGE</Btn>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Btn color="cream" size="md" className="flex-1" onClick={onBack}>CANCEL</Btn>
            <Btn color="green" size="md" glow className="flex-1" onClick={() => onStart(loc, diff)}>▶ START</Btn>
          </div>
        </div>
      </WoodPanel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white/55 border border-[#d9c4a0] py-1">
      <div className="text-[0.6rem] font-bold text-[#8a5a2b] tracking-widest">{label}</div>
      <div className="text-base font-black text-[#3b2415] tabular-nums">{value}</div>
    </div>
  );
}

/** Small "tap to enable sound" nudge when the WebView blocked the AudioContext. */
export function AudioNudge({ state }: { state: 'idle' | 'blocked' | 'running' | 'unavailable' }) {
  if (state !== 'blocked') return null;
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-[6.2rem] z-[45] anim-slide-up pointer-events-none">
      <div className="glass-chip rounded-xl px-3 py-1 text-[0.65rem] font-bold text-[#ffd166]">🔇 Tap anywhere to enable sound</div>
    </div>
  );
}
