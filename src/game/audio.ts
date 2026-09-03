// Procedural audio: all sound effects and music are synthesized with the Web Audio API.
type Wave = OscillatorType;

interface WorldMusic {
  tempo: number;
  root: number; // midi
  scale: number[];
  chords: number[][]; // scale degree offsets (semitones from root)
  lead: Wave;
  bass: Wave;
  filter: number;
  echo: number;
  drums: number; // 0 soft, 1 normal, 2 heavy
  melody: number[]; // scale indices (-1 = rest)
}

const MAJ_PENT = [0, 2, 4, 7, 9, 12, 14, 16];
const MIN_PENT = [0, 3, 5, 7, 10, 12, 15, 17];

/**
 * Lobby music — a single calm, slow, ambient track. Distinct from the
 * gameplay/world tracks so the menu doesn't feel repetitive.
 */
const LOBBY_MUSIC: WorldMusic = {
  tempo: 80, root: 60, scale: MAJ_PENT,
  chords: [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]],
  lead: 'sine', bass: 'sine', filter: 1400, echo: 0.4, drums: 0,
  melody: [0, -1, 4, -1, 7, -1, 4, -1, 2, -1, 5, -1, 7, -1, 4, -1,
           9, -1, 7, -1, 5, -1, 4, -1, 2, -1, 4, -1, 2, -1, -1, -1],
};

const MUSIC: WorldMusic[] = [
  { tempo: 126, root: 60, scale: MAJ_PENT, chords: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], lead: 'triangle', bass: 'triangle', filter: 2400, echo: 0.15, drums: 1,
    melody: [0, 2, 4, 2, 5, 4, 2, -1, 3, 4, 5, 4, 2, 1, 0, -1, 4, 5, 6, 5, 4, 2, -1, 2, 3, 2, 1, 2, 0, -1, -1, -1] },
  { tempo: 140, root: 65, scale: MAJ_PENT, chords: [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]], lead: 'square', bass: 'triangle', filter: 1500, echo: 0.2, drums: 1,
    melody: [5, 4, 5, 7, -1, 5, 4, 2, 4, 5, 4, 2, 0, -1, 2, 4, 6, 5, 4, 5, -1, 6, 7, 6, 5, 4, 2, 4, 5, -1, -1, -1] },
  { tempo: 118, root: 62, scale: MAJ_PENT, chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], lead: 'triangle', bass: 'sine', filter: 2200, echo: 0.35, drums: 1,
    melody: [4, 5, 7, 5, 4, 2, 0, -1, 2, 4, 5, -1, 7, 5, 4, 2, 5, 4, 2, 0, -1, 2, 4, 5, 7, 5, 4, 2, 0, -1, -1, -1] },
  { tempo: 100, root: 57, scale: MIN_PENT, chords: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]], lead: 'sine', bass: 'sine', filter: 3000, echo: 0.45, drums: 0,
    melody: [4, -1, 5, -1, 7, -1, 5, 4, -1, 2, -1, 4, -1, -1, -1, -1, 5, -1, 6, -1, 7, -1, 6, 5, -1, 4, -1, 2, -1, -1, -1, -1] },
  { tempo: 108, root: 67, scale: MAJ_PENT, chords: [[0, 4, 7], [5, 9, 12], [2, 5, 9], [7, 11, 14]], lead: 'sine', bass: 'triangle', filter: 3800, echo: 0.4, drums: 0,
    melody: [7, -1, 5, -1, 4, 2, 4, -1, 5, -1, 7, 5, 4, -1, 2, 0, 4, -1, 5, 7, -1, 5, 4, 2, 0, -1, 2, 4, 5, -1, -1, -1] },
  { tempo: 150, root: 62, scale: MIN_PENT, chords: [[0, 3, 7], [0, 3, 7], [10, 14, 17], [8, 12, 15]], lead: 'sawtooth', bass: 'sawtooth', filter: 1200, echo: 0.12, drums: 2,
    melody: [0, 0, 3, 0, 4, 0, 3, 2, 0, 0, 3, 0, 5, 4, 3, 2, 0, 0, 3, 0, 4, 0, 3, 2, 6, 5, 4, 3, 2, 1, 0, -1] },
  { tempo: 116, root: 64, scale: MAJ_PENT, chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], lead: 'sine', bass: 'triangle', filter: 4000, echo: 0.5, drums: 0,
    melody: [7, -1, 5, -1, 4, -1, 5, -1, 2, -1, -1, -1, 4, -1, -1, -1, 6, -1, 5, -1, 4, -1, 2, -1, 0, -1, -1, -1, 2, -1, -1, -1] },
];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private delay!: DelayNode;
  private delayGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  sfxOn = true;
  musicOn = true;
  private musicPlaying = false;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private world = 0;
  private targetWorld = 0;
  private lastJetpack = 0;
  /** 'menu' = calm lobby track at lower volume; 'game' = world tracks at gameplay volume. */
  private context: 'menu' | 'game' = 'menu';
  /** Continuous filtered-noise wind for gameplay atmosphere. */
  private windSrc: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;

  /**
   * 'idle'        – not created yet (waiting for the first user gesture)
   * 'blocked'     – created but the browser/WebView refuses to run it until a gesture
   * 'running'     – audible
   * 'unavailable' – no Web Audio at all (very old WebView) → game runs silently
   */
  state: 'idle' | 'blocked' | 'running' | 'unavailable' = 'idle';
  private stateListeners = new Set<(s: AudioManager['state']) => void>();
  onStateChange(cb: (s: AudioManager['state']) => void) { this.stateListeners.add(cb); cb(this.state); return () => { this.stateListeners.delete(cb); }; }
  private setState(s: AudioManager['state']) { if (this.state !== s) { this.state = s; this.stateListeners.forEach((l) => l(s)); } }

  /**
   * Safe to call from any event, any number of times. Never throws and never
   * blocks the render loop: every async step is fire-and-forget with .catch().
   */
  init() {
    if (this.state === 'unavailable') return;
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume().then(() => this.setState('running')).catch(() => this.setState('blocked'));
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) { this.setState('unavailable'); return; }
    let ctx: AudioContext;
    try { ctx = new AC(); } catch (e) { console.warn('[audio] AudioContext unavailable', e); this.setState('unavailable'); return; }
    this.ctx = ctx;
    try {
      this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
      this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = 0.5; this.sfxGain.connect(this.master);
      this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0.32; this.musicGain.connect(this.master);
      this.delay = ctx.createDelay(1.0); this.delay.delayTime.value = 0.28;
      this.delayGain = ctx.createGain(); this.delayGain.gain.value = 0.25;
      this.delay.connect(this.delayGain); this.delayGain.connect(this.delay); this.delayGain.connect(this.musicGain);
      const len = ctx.sampleRate * 1;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      console.warn('[audio] graph setup failed, running silent', e);
      this.ctx = null; this.setState('unavailable'); return;
    }
    ctx.addEventListener('statechange', () => this.setState(ctx.state === 'running' ? 'running' : 'blocked'));
    this.setState(ctx.state === 'running' ? 'running' : 'blocked');
    if (ctx.state !== 'running') ctx.resume().then(() => this.setState('running')).catch(() => this.setState('blocked'));
    // iOS Safari/WKWebView sometimes needs a silent buffer kick on the first gesture.
    try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start(0); } catch { /* ignore */ }
    if (this.musicOn) this.startMusic();
  }

  /** Call when the app goes to the background so the WebView can sleep the audio thread. */
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => undefined); }

  get ready() { return !!this.ctx && this.state === 'running'; }

  setSfx(on: boolean) { this.sfxOn = on; }
  setMusic(on: boolean) {
    this.musicOn = on;
    if (!this.ctx) return;
    if (on) this.startMusic(); else this.stopMusic();
  }

  setWorld(i: number) { this.targetWorld = Math.max(0, Math.min(MUSIC.length - 1, i)); }
  /**
   * Switches between 'menu' (calm lobby music, quieter) and 'game' (world
   * tracks, gameplay volume). SFX volume is unchanged so jump/land/coin still
   * cut through. Safe to call anytime — no-op if already in that context.
   */
  setContext(ctx: 'menu' | 'game') {
    if (!this.ctx || !this.musicGain || this.context === ctx) return;
    this.context = ctx;
    const g = this.musicGain.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    if (ctx === 'menu') { g.linearRampToValueAtTime(0.24, t + 0.25); }
    else { g.linearRampToValueAtTime(0.16, t + 0.25); }
  }
  /**
   * Procedural wind / air ambience — quiet filtered noise, only during
   * gameplay. Stops automatically when paused or back on menu.
   */
  startWind() {
    if (!this.ctx || this.windSrc || !this.sfxOn) return;
    try {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 0.5;
      const g = this.ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.6);
      src.connect(f); f.connect(g); g.connect(this.master); this.windSrc = src; this.windGain = g;
      src.start(0);
    } catch { /* ignore */ }
  }
  stopWind() {
    if (this.windSrc && this.ctx) {
      try { const t = this.ctx.currentTime; this.windGain!.gain.cancelScheduledValues(t); this.windGain!.gain.setValueAtTime(this.windGain!.gain.value, t); this.windGain!.gain.linearRampToValueAtTime(0, t + 0.4); this.windSrc!.stop(t + 0.5); } catch { /* ignore */ }
    }
    this.windSrc = null; this.windGain = null;
  }

  setPaused(paused: boolean) {
    if (!this.ctx || !this.musicGain) return;
    const g = this.musicGain.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    if (paused) g.linearRampToValueAtTime(0.04, t + 0.12);
    else g.linearRampToValueAtTime(this.context === 'menu' ? 0.24 : 0.16, t + 0.18);
    if (paused) this.stopWind(); else if (this.context === 'game') this.startWind();
  }

  // ---------- SFX primitives ----------
  private tone(freq: number, dur: number, type: Wave = 'sine', vol = 0.3, slideTo?: number, when = 0, dest?: AudioNode) {
    if (!this.ctx || !this.sfxOn) return;
    const ctx = this.ctx; const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol = 0.2, when = 0, freq = 1200, q = 0.7, type: BiquadFilterType = 'lowpass') {
    if (!this.ctx || !this.sfxOn) return;
    const ctx = this.ctx; const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t); s.stop(t + dur + 0.02);
  }

  // ---------- Named SFX ----------
  jump() { this.tone(320, 0.14, 'triangle', 0.18, 620); }
  land() { this.tone(160, 0.09, 'sine', 0.22, 70); this.noise(0.05, 0.05, 0, 800); }
  superJump() { this.tone(220, 0.4, 'square', 0.12, 1300); this.tone(440, 0.4, 'triangle', 0.15, 1800, 0.03); this.noise(0.25, 0.08, 0, 2500, 1, 'bandpass'); }
  spring() { this.tone(180, 0.08, 'triangle', 0.2, 120); this.tone(300, 0.45, 'square', 0.1, 1500, 0.06); }
  mushroom() { this.tone(200, 0.12, 'sine', 0.25, 90); this.tone(400, 0.35, 'triangle', 0.16, 1100, 0.08); }
  coin(pitch = 0) {
    const f = 1318 * Math.pow(1.06, pitch);
    this.tone(f, 0.07, 'sine', 0.16); this.tone(f * 1.5, 0.16, 'sine', 0.16, undefined, 0.06);
  }
  powerup() { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.14, undefined, i * 0.06)); }
  shield() { this.tone(300, 0.5, 'sine', 0.14, 600); this.tone(450, 0.5, 'sine', 0.1, 900, 0.05); }
  shieldPop() { this.noise(0.15, 0.15, 0, 3000, 1, 'highpass'); this.tone(900, 0.2, 'sine', 0.14, 300); }
  magnet() { for (let i = 0; i < 6; i++) this.tone(200 + i * 60, 0.08, 'square', 0.06, 300 + i * 60, i * 0.05); }
  jetpack(time: number) {
    if (time - this.lastJetpack < 0.09) return; this.lastJetpack = time;
    this.noise(0.12, 0.09, 0, 600 + Math.random() * 300, 0.5);
  }
  slow() { this.tone(800, 0.6, 'sine', 0.12, 200); this.tone(1200, 0.6, 'triangle', 0.06, 300, 0.05); }
  fever() { [659, 784, 988, 1175, 1318, 1568].forEach((f, i) => this.tone(f, 0.12, 'square', 0.07, undefined, i * 0.05)); }
  warning() { this.tone(520, 0.1, 'square', 0.08); this.tone(520, 0.1, 'square', 0.08, undefined, 0.15); }
  hit() { this.tone(380, 0.35, 'sawtooth', 0.16, 90); this.noise(0.2, 0.15, 0, 900); }
  stomp() { this.tone(500, 0.08, 'square', 0.12, 200); this.tone(250, 0.22, 'triangle', 0.18, 700, 0.06); this.noise(0.08, 0.1, 0, 1500); }
  breakPlat() { this.noise(0.18, 0.2, 0, 1800, 0.8, 'bandpass'); this.tone(240, 0.12, 'square', 0.06, 80); }
  combo(level: number) { const b = 660 + Math.min(level, 10) * 60; this.tone(b, 0.08, 'triangle', 0.12); this.tone(b * 1.25, 0.1, 'triangle', 0.12, undefined, 0.07); this.tone(b * 1.5, 0.16, 'triangle', 0.12, undefined, 0.14); }
  gameOver() { [523, 466, 415, 349].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.16, undefined, i * 0.18)); this.tone(120, 0.7, 'sine', 0.2, 50, 0.6); }
  click() { this.tone(900, 0.05, 'sine', 0.12, 600); this.noise(0.03, 0.05, 0, 3000, 1, 'highpass'); }
  purchase() { this.noise(0.08, 0.15, 0, 4000, 1, 'highpass'); this.tone(1046, 0.1, 'sine', 0.15, undefined, 0.05); this.tone(1568, 0.3, 'sine', 0.15, undefined, 0.15); }
  achievement() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, i === 3 ? 0.5 : 0.14, 'triangle', 0.14, undefined, i * 0.1)); }
  worldEnter() { [523, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.12, undefined, i * 0.12)); }
  revive() { [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, undefined, i * 0.07)); }
  whoosh() { this.noise(0.3, 0.12, 0, 1200, 0.8, 'bandpass'); }

  /** Exciting short reward jingle: big coin-collect / milestone feel. */
  reward() {
    [784, 988, 1175, 1318, 1568].forEach((f, i) => this.tone(f, i === 4 ? 0.32 : 0.12, 'triangle', 0.14, undefined, i * 0.05));
    this.tone(2093, 0.4, 'sine', 0.1, undefined, 0.25);
  }
  /** Milestone SFX: fanfare-style, shorter than reward but still exciting. */
  milestone() { [523, 659, 784, 1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, i === 6 ? 0.45 : 0.1, 'triangle', 0.13, undefined, i * 0.04)); }
  /** New-best high-score celebratory blast. */
  newBest() {
    [523, 659, 784, 1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.13, undefined, i * 0.06));
    this.tone(2637, 0.5, 'sine', 0.12, undefined, 0.42);
  }
  /** Quiet but satisfying "you've reached a new height" chime. */
  altitudePing() { this.tone(1318, 0.18, 'sine', 0.08); this.tone(1568, 0.25, 'sine', 0.08, undefined, 0.1); }
  /** Calm wind-up for a location transition (subtle). */
  locationShift() { [392, 440, 523, 587].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.08, undefined, i * 0.07)); }

  // ---------- Music ----------
  startMusic() {
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  private schedule() {
    if (!this.ctx) return;
    // While blocked/suspended currentTime is frozen; re-anchor so that when the
    // context resumes we don't burst-play every note that "should" have happened.
    if (this.ctx.state !== 'running') { this.nextTime = this.ctx.currentTime + 0.1; return; }
    const ahead = this.ctx.currentTime + 0.18;
    if (this.nextTime < this.ctx.currentTime - 0.5) this.nextTime = this.ctx.currentTime + 0.05;
    let guard = 0;
    try {
      while (this.nextTime < ahead && guard++ < 64) {
        this.playStep(this.step, this.nextTime);
        // When context is 'menu', use the calm lobby track (ignoring targetWorld);
        // in 'game' context, use the current world track.
        const m = this.context === 'menu' ? LOBBY_MUSIC : MUSIC[this.world];
        this.nextTime += 60 / m.tempo / 4; // 16th notes
        this.step++;
        if (this.context === 'game' && this.step % 32 === 0 && this.world !== this.targetWorld) this.world = this.targetWorld;
      }
    } catch (e) {
      // A failing node must never take the interval (or the game loop) down.
      console.warn('[audio] scheduler error', e);
    }
  }

  private mTone(time: number, freq: number, dur: number, type: Wave, vol: number, filter: number, echo = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = filter;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(f); f.connect(g); g.connect(this.musicGain);
    if (echo > 0) { const eg = ctx.createGain(); eg.gain.value = echo; g.connect(eg); eg.connect(this.delay); }
    o.start(time); o.stop(time + dur + 0.03);
  }

  private mNoise(time: number, dur: number, vol: number, freq: number, type: BiquadFilterType = 'highpass') {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, time); g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    s.connect(f); f.connect(g); g.connect(this.musicGain);
    s.start(time); s.stop(time + dur + 0.02);
  }

  private playStep(step: number, time: number) {
    const m = this.context === 'menu' ? LOBBY_MUSIC : MUSIC[this.world];
    const bar = Math.floor(step / 16) % 4;
    const s16 = step % 16;
    const chord = m.chords[bar];
    const beatLen = 60 / m.tempo;
    // bass: root on beats, fifth on off-beats
    if (s16 % 4 === 0) {
      const note = m.root - 12 + chord[0];
      this.mTone(time, mtof(note), beatLen * 0.8, m.bass, 0.22, 600);
    } else if (s16 % 4 === 2 && m.drums > 0) {
      this.mTone(time, mtof(m.root - 12 + chord[2]), beatLen * 0.35, m.bass, 0.12, 600);
    }
    // chord stab on beat 2 & 4 (soft)
    if (s16 === 4 || s16 === 12) {
      for (let i = 0; i < 3; i++) this.mTone(time, mtof(m.root + chord[i]), beatLen * 0.6, 'triangle', 0.05, 1800);
    }
    // melody
    const mi = m.melody[step % 32];
    if (mi >= 0) {
      const deg = m.scale[mi % m.scale.length];
      const note = m.root + 12 + deg;
      this.mTone(time, mtof(note), beatLen * 0.55, m.lead, m.lead === 'sawtooth' || m.lead === 'square' ? 0.07 : 0.13, m.filter, m.echo);
    }
    // drums
    if (m.drums >= 1) {
      if (s16 % 8 === 0) { // kick
        const ctx = this.ctx!; const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.setValueAtTime(150, time); o.frequency.exponentialRampToValueAtTime(40, time + 0.12);
        g.gain.setValueAtTime(m.drums === 2 ? 0.5 : 0.35, time); g.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
        o.connect(g); g.connect(this.musicGain); o.start(time); o.stop(time + 0.16);
      }
      if (s16 % 8 === 4) this.mNoise(time, 0.12, 0.12, 1500, 'bandpass'); // snare
      if (s16 % 2 === 1) this.mNoise(time, 0.03, 0.05, 7000); // hat
    } else if (s16 % 4 === 2) {
      this.mNoise(time, 0.05, 0.03, 8000);
    }
  }
}

export const audio = new AudioManager();
