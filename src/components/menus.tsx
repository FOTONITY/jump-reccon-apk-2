import { useEffect, useState } from 'react';
import { ACHIEVEMENTS, SKINS } from '../game/config';
import { allMissions, isMissionClaimed, missionProgress } from '../game/save';
import { REMOVE_ADS_PRICE } from '../game/ads';
import { firebase } from '../game/firebase';
import { useUser } from '../context/UserContext';
import type { ControlMode, LeaderboardEntry, MissionDef, SaveData, SkinDef } from '../game/types';
import { Btn, CoinBadge, CoinIcon, Modal, Pill, ProgressBar, SkinPreview, TopBar, WoodPanel } from './ui';
import { cn } from '../utils/cn';

/** Skins that get the animated conic "premium" ring + glow. */
const PREMIUM = new Set(['golden', 'royal', 'robot', 'astronaut', 'samurai']);

// ------------------------------------------------------------ SHOP / CHARACTERS
export function ShopScreen({ save, mode, onBack, onBuy, onSelect, onBuyRemoveAds }: {
  save: SaveData; mode: 'shop' | 'characters'; onBack: () => void; onBuy: (s: SkinDef) => void; onSelect: (s: SkinDef) => void; onBuyRemoveAds: () => void;
}) {
  const [preview, setPreview] = useState<SkinDef>(SKINS.find((s) => s.id === save.selected) || SKINS[0]);
  const [confirm, setConfirm] = useState<SkinDef | 'ads' | null>(null);
  const [tab, setTab] = useState<'all' | 'owned' | 'locked'>(mode === 'characters' ? 'owned' : 'all');
  const owned = save.unlocked.includes(preview.id);
  const selected = save.selected === preview.id;
  const list = SKINS.filter((s) => tab === 'all' ? true : tab === 'owned' ? save.unlocked.includes(s.id) : !save.unlocked.includes(s.id));

  return (
    <div className="absolute inset-0 flex flex-col bg-black/35 backdrop-blur-[2px] anim-fade">
      <TopBar title={mode === 'shop' ? 'SHOP' : 'CHARACTERS'} onBack={onBack} right={<CoinBadge value={save.coins} />} />

      {/* Preview card */}
      <div className="px-3 pt-4 anim-slide-up">
        <WoodPanel className={cn('w-full', PREMIUM.has(preview.id) && 'shadow-[0_0_40px_rgba(255,209,102,0.35)]')}>
          <div className="flex items-center gap-3">
            <div className={cn('relative rounded-2xl p-1 border-2 shadow-inner overflow-hidden', PREMIUM.has(preview.id) ? 'bg-gradient-to-b from-[#ffe9a8] to-[#f2b62a] border-[#b57a10]' : 'bg-gradient-to-b from-[#9ad9ff] to-[#5fb6f0] border-[#3f8fd0]')}>
              {PREMIUM.has(preview.id) && <div className="absolute inset-0 shimmer pointer-events-none" />}
              <SkinPreview skin={preview} size={96} className={PREMIUM.has(preview.id) ? 'store-thumb store-card--premium' : ''} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-xl font-black text-[#3b2415] leading-tight truncate">{preview.name}</div>
                {PREMIUM.has(preview.id) && <Pill tone="gold">✦ PREMIUM</Pill>}
              </div>
              <div className="text-xs text-[#7a5a3a] font-semibold mt-0.5">{preview.desc}</div>
              <div className="mt-2">
                {selected ? <Pill tone="green" className="text-xs px-3 py-1.5">✓ SELECTED</Pill>
                  : owned ? <Btn color="green" size="sm" onClick={() => onSelect(preview)}>SELECT</Btn>
                    : <Btn color="gold" size="sm" onClick={() => setConfirm(preview)} disabled={save.coins < preview.price}><CoinIcon className="w-4 h-4" /> {preview.price.toLocaleString()} · BUY</Btn>}
              </div>
            </div>
          </div>
        </WoodPanel>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 px-3 pt-3">
        {(['all', 'owned', 'locked'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn('glass-tab tap flex-1 rounded-xl py-1.5 text-xs font-extrabold tracking-wider text-[#fff3dd]', tab === t && 'glass-tab-active')}>
            {t.toUpperCase()} <span className="opacity-60">{t === 'all' ? SKINS.length : t === 'owned' ? save.unlocked.length : SKINS.length - save.unlocked.length}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 scroll-y px-3 pt-3 pb-6">
        <div className="grid grid-cols-3 gap-2 stagger">
          {mode === 'shop' && tab !== 'owned' && (
            <button type="button" onClick={() => !save.removeAds && setConfirm('ads')} className={cn('store-card col-span-3 flex items-center gap-3 p-3 text-left', save.removeAds ? 'store-card--owned' : 'store-card--selected')}>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#ff8a7a] to-[#e2483c] flex items-center justify-center text-2xl shadow-md">🚫</div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-[#3b2415] text-sm">Remove Ads Pass</div>
                <div className="text-[0.65rem] font-semibold text-[#7a5a3a]">No banners, no interstitials — forever. Reward videos stay optional.</div>
              </div>
              {save.removeAds ? <Pill tone="green">OWNED</Pill> : <span className="inline-flex items-center gap-1 text-sm font-black text-[#b57a10]"><CoinIcon className="w-4 h-4" />{REMOVE_ADS_PRICE.toLocaleString()}</span>}
            </button>
          )}
          {list.map((s) => {
            const isOwned = save.unlocked.includes(s.id);
            const isSel = save.selected === s.id;
            const isPrev = preview.id === s.id;
            const premium = PREMIUM.has(s.id);
            return (
              <button key={s.id} type="button" onClick={() => setPreview(s)}
                className={cn('store-card p-1.5 pt-2 flex flex-col items-center', isSel ? 'store-card--selected' : isOwned ? 'store-card--owned' : 'store-card--locked', premium && isOwned && 'store-card--premium', isPrev && 'ring-4 ring-[#7fd4ff]/70')}>
                <div className="store-thumb"><SkinPreview skin={s} size={62} animate={isPrev} /></div>
                <div className={cn('text-[0.7rem] font-extrabold leading-tight text-center mt-1 truncate w-full', isOwned ? 'text-[#3b2415]' : 'text-white/90')}>{s.name}</div>
                <div className="text-[0.62rem] font-bold mt-0.5">
                  {isSel ? <span className="text-[#2f7a17]">✓ IN USE</span> : isOwned ? <span className="text-[#5a3410]">OWNED</span>
                    : <span className={cn('inline-flex items-center gap-0.5', save.coins >= s.price ? 'text-[#ffd166]' : 'text-white/50')}><CoinIcon className="w-3 h-3" />{s.price.toLocaleString()}</span>}
                </div>
                {!isOwned && <span className="absolute top-1 right-1 text-xs drop-shadow">🔒</span>}
                {premium && <span className="absolute top-1 left-1 text-[0.55rem] font-black text-[#b57a10] bg-[#ffd166] rounded px-1">✦</span>}
              </button>
            );
          })}
        </div>
        {list.length === 0 && <div className="text-center text-white/80 font-bold py-10">Nothing here yet 🐾</div>}
      </div>

      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <WoodPanel title="CONFIRM">
            <div className="flex flex-col items-center gap-3 pt-1">
              {confirm === 'ads'
                ? <><div className="text-5xl">🚫</div><div className="text-center font-bold text-[#3b2415]">Remove all ads for <span className="inline-flex items-center gap-1 text-[#b57a10]"><CoinIcon className="w-4 h-4" />{REMOVE_ADS_PRICE.toLocaleString()}</span>?<div className="text-xs font-semibold text-[#7a5a3a] mt-1">Reward videos remain available if you want them.</div></div></>
                : <><SkinPreview skin={confirm} size={90} /><div className="text-center font-bold text-[#3b2415]">Buy <b>{confirm.name}</b> for <span className="inline-flex items-center gap-1 text-[#b57a10]"><CoinIcon className="w-4 h-4" />{confirm.price.toLocaleString()}</span>?</div></>}
              <div className="flex gap-2">
                <Btn color="cream" size="sm" onClick={() => setConfirm(null)}>CANCEL</Btn>
                <Btn color="gold" size="sm" disabled={save.coins < (confirm === 'ads' ? REMOVE_ADS_PRICE : confirm.price)} onClick={() => { if (confirm === 'ads') onBuyRemoveAds(); else onBuy(confirm); setConfirm(null); }}>BUY</Btn>
              </div>
            </div>
          </WoodPanel>
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------ MISSIONS
export function MissionsScreen({ save, onBack, onClaim }: { save: SaveData; onBack: () => void; onClaim: (m: MissionDef) => void }) {
  const [tab, setTab] = useState<'daily' | 'lifetime' | 'achievements'>('daily');
  const { daily, lifetime } = allMissions(save);
  const list = tab === 'daily' ? daily : lifetime;
  const claimable = (ms: MissionDef[]) => ms.filter((m) => !isMissionClaimed(save, m) && missionProgress(save, m) >= m.target).length;
  return (
    <div className="absolute inset-0 flex flex-col bg-black/35 backdrop-blur-[2px] anim-fade">
      <TopBar title="MISSIONS" onBack={onBack} right={<CoinBadge value={save.coins} />} />
      <div className="flex gap-1.5 px-3 pt-3">
        {(['daily', 'lifetime', 'achievements'] as const).map((t) => {
          const n = t === 'daily' ? claimable(daily) : t === 'lifetime' ? claimable(lifetime) : 0;
          return (
            <button key={t} type="button" onClick={() => setTab(t)} className={cn('glass-tab tap relative flex-1 rounded-xl py-1.5 text-xs font-extrabold tracking-wider text-[#fff3dd]', tab === t && 'glass-tab-active')}>
              {t.toUpperCase()}
              {n > 0 && <span className="absolute -top-1.5 -right-1 w-5 h-5 rounded-full bg-[#e8323c] text-white text-[0.6rem] flex items-center justify-center border-2 border-[#1a1030]">{n}</span>}
            </button>
          );
        })}
      </div>
      <div className="flex-1 scroll-y px-3 pt-3 pb-6 flex flex-col gap-2 stagger">
        {tab !== 'achievements' && list.map((m) => {
          const prog = Math.min(m.target, missionProgress(save, m));
          const done = prog >= m.target; const claimed = isMissionClaimed(save, m);
          return (
            <div key={m.id} className={cn('rounded-2xl p-2.5 border', claimed ? 'bg-white/10 border-white/10 opacity-70' : done ? 'bg-gradient-to-r from-[#fff6d6] to-[#ffe4a3] border-[#f2b62a] shadow-[0_0_18px_rgba(255,209,102,0.35)]' : 'glass-inner')}>
              <div className="flex items-center justify-between gap-2">
                <div className={cn('font-extrabold text-sm leading-tight', claimed ? 'text-white/80' : 'text-[#3b2415]')}>{claimed ? '✅ ' : done ? '🎁 ' : '⭐ '}{m.title}</div>
                {claimed ? <Pill tone="grey">CLAIMED</Pill>
                  : done ? <Btn color="gold" size="sm" glow onClick={() => onClaim(m)}>CLAIM <CoinIcon className="w-4 h-4" />{m.reward}</Btn>
                    : <span className="inline-flex items-center gap-1 text-xs font-bold text-[#b57a10]"><CoinIcon className="w-3.5 h-3.5" />{m.reward}</span>}
              </div>
              {!claimed && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1"><ProgressBar value={prog} max={m.target} color={done ? '#ffc42e' : '#5fd648'} /></div>
                  <div className="text-[0.65rem] font-bold text-[#7a5a3a] w-16 text-right tabular-nums">{Math.floor(prog).toLocaleString()} / {m.target.toLocaleString()}</div>
                </div>
              )}
            </div>
          );
        })}
        {tab === 'achievements' && ACHIEVEMENTS.map((a) => {
          const got = save.achievements.includes(a.id);
          return (
            <div key={a.id} className={cn('rounded-2xl p-2.5 flex items-center gap-3 border', got ? 'bg-gradient-to-r from-[#fff1c2] to-[#ffe4a3] border-[#e0b040]' : 'bg-white/10 border-white/10')}>
              <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-2xl', got ? 'bg-[#ffd166] shadow-[0_0_14px_rgba(255,209,102,0.6)]' : 'bg-white/10 grayscale')}>{got ? a.icon : '🔒'}</div>
              <div>
                <div className={cn('font-extrabold text-sm', got ? 'text-[#3b2415]' : 'text-white/90')}>{a.title}</div>
                <div className={cn('text-xs font-semibold', got ? 'text-[#7a5a3a]' : 'text-white/60')}>{a.desc}</div>
              </div>
            </div>
          );
        })}
        {tab === 'daily' && <div className="text-center text-white/85 text-xs font-semibold game-title-shadow mt-1">New daily missions every day!</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ SETTINGS
export function SettingsScreen({ save, onBack, onChange, onReset, onProfile }: {
  save: SaveData; onBack: () => void; onChange: (patch: Partial<SaveData['settings']>) => void; onReset: () => void; onProfile: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const { user } = useUser();
  const s = save.settings;
  const pickControls = async (mode: ControlMode) => {
    if (mode === 'tilt') {
      const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function') { try { await DOE.requestPermission(); } catch { /* ignore */ } }
    }
    onChange({ controls: mode });
  };
  return (
    <div className="absolute inset-0 flex flex-col bg-black/35 backdrop-blur-[2px] anim-fade">
      <TopBar title="SETTINGS" onBack={onBack} />
      <div className="flex-1 scroll-y px-3 pt-4 pb-6 flex flex-col gap-4 stagger">
        <WoodPanel title="ACCOUNT" className="mt-3">
          <div className="flex items-center gap-3 pt-1">
            <div className={cn('w-11 h-11 rounded-full flex items-center justify-center text-xl', user ? 'bg-gradient-to-b from-[#7fc4ff] to-[#3f8fe8]' : 'bg-[#d9c4a0]')}>{user ? '🦝' : '👤'}</div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-[#3b2415] truncate">{user ? user.displayName : 'Not signed in'}</div>
              <div className="text-[0.65rem] font-semibold text-[#7a5a3a]">{user ? (user.provider === 'google' ? 'Google · cloud save on' : 'Guest · cloud save on') : 'Sign in to back up progress & join the leaderboard'}</div>
            </div>
            <Btn color={user ? 'cream' : 'blue'} size="sm" onClick={onProfile}>{user ? 'MANAGE' : 'SIGN IN'}</Btn>
          </div>
        </WoodPanel>
        <WoodPanel title="AUDIO" className="mt-2">
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Toggle label="Sound FX" on={s.sfx} onClick={() => onChange({ sfx: !s.sfx })} icon="🔊" />
            <Toggle label="Music" on={s.music} onClick={() => onChange({ music: !s.music })} icon="🎵" />
          </div>
        </WoodPanel>
        <WoodPanel title="CONTROLS" className="mt-2">
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {([['buttons', '👆', 'Tap sides'], ['drag', '↔️', 'Drag'], ['tilt', '📱', 'Tilt']] as const).map(([m, ic, label]) => (
              <Toggle key={m} label={label} on={s.controls === m} onClick={() => pickControls(m)} icon={ic} className="flex-1 min-w-[6.6rem]" />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 pt-3">
            <span className="text-xs font-extrabold text-[#5a3410]">Movement boundary</span>
            <div className="flex gap-1.5">
              <Btn color={s.boundary === 'wrap' ? 'green' : 'cream'} size="xs" onClick={() => onChange({ boundary: 'wrap' })}>WRAP</Btn>
              <Btn color={s.boundary === 'border' ? 'green' : 'cream'} size="xs" onClick={() => onChange({ boundary: 'border' })}>BORDER</Btn>
            </div>
          </div>
          <p className="text-[0.62rem] text-[#7a5a3a] font-semibold mt-1">WRAP: exit right → enter left. BORDER: solid walls at the screen edges.</p>
          <div className="pt-3">
            <div className="flex items-center justify-between text-xs font-extrabold text-[#5a3410]">
              <span>Sensitivity</span><span className="tabular-nums">{s.sensitivity}%</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[0.6rem] font-extrabold text-[#8a5a2b]">LOW</span>
              <input type="range" min={0} max={100} step={5} value={s.sensitivity} aria-label="Control sensitivity"
                onChange={(e) => onChange({ sensitivity: Number(e.target.value) })} className="rsj-range flex-1" />
              <span className="text-[0.6rem] font-extrabold text-[#8a5a2b]">HIGH</span>
            </div>
            <p className="text-[0.62rem] text-[#7a5a3a] font-semibold mt-1">How quickly tap, drag and tilt inputs reach full speed.</p>
          </div>
          <p className="text-[0.65rem] text-[#7a5a3a] font-semibold text-center mt-2">Keyboard: ← → or A / D · P / Esc to pause</p>
        </WoodPanel>
        <WoodPanel title="EFFECTS" className="mt-2">
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Toggle label="Screen shake" on={s.shake} onClick={() => onChange({ shake: !s.shake })} icon="💥" />
            <Toggle label="Haptics" on={s.haptic} onClick={() => onChange({ haptic: !s.haptic })} icon="📳" />
          </div>
          <div className="mt-2 rounded-xl bg-white/50 border border-[#d9c4a0] px-3 py-1.5 text-[0.65rem] font-bold text-[#7a5a3a] flex items-center gap-2">
            {save.removeAds ? '🚫 Remove Ads pass active' : '📺 Ads: banner on menus + 1 interstitial per 3 runs · remove in Shop'}
          </div>
        </WoodPanel>
        <div className="flex justify-center pt-1"><Btn color="red" size="sm" onClick={() => setConfirm(true)}>RESET PROGRESS</Btn></div>
        <p className="text-center text-white/75 text-[0.65rem] font-semibold game-title-shadow">Raccoon Sky Jump · v1.1 · Firebase: {firebase.mode}</p>
      </div>
      {confirm && (
        <Modal onClose={() => setConfirm(false)}>
          <WoodPanel title="ARE YOU SURE?">
            <div className="flex flex-col items-center gap-3 pt-1 text-center font-bold text-[#3b2415]">
              <div>This deletes all coins, characters, missions and scores on this device.</div>
              <div className="flex gap-2"><Btn color="cream" size="sm" onClick={() => setConfirm(false)}>CANCEL</Btn><Btn color="red" size="sm" onClick={() => { onReset(); setConfirm(false); }}>RESET</Btn></div>
            </div>
          </WoodPanel>
        </Modal>
      )}
    </div>
  );
}

function Toggle({ label, on, onClick, icon, className }: { label: string; on: boolean; onClick: () => void; icon: string; className?: string }) {
  return (
    <Btn color={on ? 'green' : 'cream'} size="sm" onClick={onClick} className={cn('justify-start', className ?? 'w-full')}>
      <span>{icon}</span><span className="text-xs">{label}</span><span className="ml-auto text-xs">{on ? 'ON' : 'OFF'}</span>
    </Btn>
  );
}

// ------------------------------------------------------------ LOCAL SCORES
export function ScoresScreen({ save, onBack }: { save: SaveData; onBack: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-black/35 backdrop-blur-[2px] anim-fade">
      <TopBar title="HIGH SCORES" onBack={onBack} />
      <div className="flex-1 scroll-y px-3 pt-4 pb-6">
        <WoodPanel title="TOP 10" className="mt-3">
          {save.highScores.length === 0 && <div className="text-center font-bold text-[#7a5a3a] py-6">No runs yet — go jump! 🐾</div>}
          <div className="flex flex-col gap-1 pt-1 stagger">
            {save.highScores.map((h, i) => (
              <div key={`${h.date}-${i}`} className={cn('flex items-center gap-2 rounded-xl px-2 py-1.5', i === 0 ? 'bg-gradient-to-r from-[#ffe9a8] to-[#ffd166]/60' : i % 2 ? 'bg-white/40' : 'bg-transparent')}>
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center font-black text-sm', i < 3 ? 'bg-[#ffd166] text-[#5a3410] shadow-[0_0_10px_rgba(255,209,102,0.6)]' : 'bg-[#d9c4a0] text-[#5a3410]')}>{i + 1}</div>
                <div className="flex-1">
                  <div className="font-extrabold text-[#3b2415] text-sm leading-tight tabular-nums">{h.score.toLocaleString()} pts</div>
                  <div className="text-[0.65rem] font-semibold text-[#7a5a3a]">{h.altitude.toLocaleString()} m · {new Date(h.date).toLocaleDateString()} · {SKINS.find((s) => s.id === h.skin)?.name || 'Classic'}</div>
                </div>
                <div className="inline-flex items-center gap-1 text-xs font-bold text-[#b57a10]"><CoinIcon className="w-3.5 h-3.5" />{h.coins}</div>
              </div>
            ))}
          </div>
        </WoodPanel>
        <div className="mt-4 grid grid-cols-2 gap-2 stagger">
          <Mini label="BEST ALTITUDE" value={`${Math.floor(save.bestAltitude).toLocaleString()} m`} />
          <Mini label="TOTAL RUNS" value={`${save.stats.runs}`} />
          <Mini label="COINS EARNED" value={save.stats.coins.toLocaleString()} />
          <Mini label="PERFECT LANDINGS" value={`${save.stats.perfect}`} />
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-inner px-2 py-1.5 text-center">
      <div className="text-[0.6rem] font-bold text-[#8a5a2b] tracking-widest">{label}</div>
      <div className="text-base font-black text-[#3b2415] tabular-nums">{value}</div>
    </div>
  );
}

// ------------------------------------------------------------ GLOBAL LEADERBOARD (cloud)
export function LeaderboardScreen({ save, onBack, onProfile }: { save: SaveData; onBack: () => void; onProfile: () => void }) {
  const { user } = useUser();
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    firebase.fetchLeaderboards(25).then((r) => { if (alive) setRows(r); }).catch((e) => { if (alive) setErr(e instanceof Error ? e.message : 'Could not load'); });
    return () => { alive = false; };
  }, []);
  return (
    <div className="absolute inset-0 flex flex-col bg-black/35 backdrop-blur-[2px] anim-fade">
      <TopBar title="WORLD RANKS" onBack={onBack} right={<Pill tone={firebase.mode === 'live' ? 'green' : 'grey'}>{firebase.mode === 'live' ? 'LIVE' : 'DEMO'}</Pill>} />
      <div className="flex-1 scroll-y px-3 pt-4 pb-6">
        {!user && (
          <div className="glass-inner p-3 mb-3 flex items-center gap-3 anim-slide-up">
            <div className="text-2xl">🌍</div>
            <div className="flex-1 text-xs font-bold text-[#3b2415]">Sign in to post your best score ({Math.floor(save.bestScore).toLocaleString()}) to the world ranks.</div>
            <Btn color="blue" size="sm" onClick={onProfile}>SIGN IN</Btn>
          </div>
        )}
        <WoodPanel title="TOP 25" className="mt-3">
          {rows === null && !err && <div className="text-center font-bold text-[#7a5a3a] py-6 anim-pulse">Loading ranks…</div>}
          {err && <div className="text-center font-bold text-[#a02020] py-6 text-sm">{err}</div>}
          <div className="flex flex-col gap-1 pt-1 stagger">
            {rows?.map((r, i) => {
              const me = user && r.uid === user.uid;
              const skin = SKINS.find((s) => s.id === r.skin) || SKINS[0];
              return (
                <div key={r.uid} className={cn('flex items-center gap-2 rounded-xl px-2 py-1', me ? 'bg-gradient-to-r from-[#d6f5ff] to-[#9ed0ff]/70 ring-2 ring-[#3f9cff]' : i === 0 ? 'bg-gradient-to-r from-[#ffe9a8] to-[#ffd166]/60' : i % 2 ? 'bg-white/40' : '')}>
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center font-black text-sm', i < 3 ? 'bg-[#ffd166] text-[#5a3410]' : 'bg-[#d9c4a0] text-[#5a3410]')}>{i + 1}</div>
                  <SkinPreview skin={skin} size={34} animate={false} />
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-[#3b2415] text-sm leading-tight truncate">{r.name}{me ? ' (you)' : ''}</div>
                    <div className="text-[0.65rem] font-semibold text-[#7a5a3a]">{r.altitude.toLocaleString()} m</div>
                  </div>
                  <div className="font-black text-[#3b2415] tabular-nums text-sm">{r.score.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </WoodPanel>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ PROFILE MODAL
export function ProfileModal({ onClose, save }: { onClose: () => void; save: SaveData }) {
  const { user, busy, error, mode, loginAnonymously, linkWithGoogle, logout } = useUser();
  return (
    <Modal onClose={onClose}>
      <WoodPanel title="CLOUD SAVE">
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex items-center gap-3">
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center text-3xl', user ? 'bg-gradient-to-b from-[#7fc4ff] to-[#3f8fe8] shadow-[0_0_18px_rgba(63,156,255,0.5)]' : 'bg-[#d9c4a0]')}>{user ? '🦝' : '👤'}</div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-[#3b2415] truncate">{user ? user.displayName : 'Play as guest'}</div>
              <div className="text-[0.65rem] font-semibold text-[#7a5a3a]">
                {user ? `${user.provider === 'google' ? 'Google account' : 'Guest account'} · synced ${save.cloudSyncedAt ? new Date(save.cloudSyncedAt).toLocaleTimeString() : 'pending'}` : 'Progress is stored on this device only'}
              </div>
            </div>
          </div>
          {mode === 'mock' && <div className="rounded-xl bg-[#e8f4ff] border border-[#9ed0ff] px-2 py-1 text-[0.65rem] font-bold text-[#215ba8]">Demo mode — add VITE_FIREBASE_* keys to .env for real cloud saves.</div>}
          {error && <div className="rounded-xl bg-[#ffe1e1] border border-[#e8323c] px-2 py-1 text-[0.65rem] font-bold text-[#a02020]">{error}</div>}
          <div className="flex flex-col gap-2 stagger">
            {!user && <Btn color="blue" size="md" disabled={busy} onClick={() => void loginAnonymously()}>👤 CONTINUE AS GUEST</Btn>}
            {(!user || user.provider !== 'google') && <Btn color="cream" size="md" disabled={busy} onClick={() => void linkWithGoogle()}><span className="font-black text-[#4285f4]">G</span> {user ? 'LINK GOOGLE ACCOUNT' : 'SIGN IN WITH GOOGLE'}</Btn>}
            {user && <Btn color="red" size="sm" disabled={busy} onClick={() => void logout()}>SIGN OUT</Btn>}
            <Btn color="ghost" size="sm" onClick={onClose}>CLOSE</Btn>
          </div>
        </div>
      </WoodPanel>
    </Modal>
  );
}
