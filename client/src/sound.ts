// Synthesized sound effects via Web Audio. No external assets.
// All sounds are kept short and "arcade-like".

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) {
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  }
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function setMuted(v: boolean): void {
  muted = v;
}
export function isMuted(): boolean {
  return muted;
}

/** Call on any first user click to unlock audio on browsers that gate it. */
export function unlockAudio(): void {
  getCtx();
}

// ─── Primitives ──────────────────────────────────────────────────────────

function noiseBurst(
  c: AudioContext,
  durationS: number,
  gain: number,
  filterFreq: number,
  filterType: BiquadFilterType = 'lowpass',
): void {
  const sr = c.sampleRate;
  const len = Math.floor(sr * durationS);
  const buf = c.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 6);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(c.destination);
  src.start();
  src.stop(c.currentTime + durationS);
}

function tone(
  c: AudioContext,
  freq: number,
  durationS: number,
  gain: number,
  type: OscillatorType = 'sine',
  pitchDecayTo?: number,
): void {
  const osc = c.createOscillator();
  osc.type = type;
  const now = c.currentTime;
  osc.frequency.setValueAtTime(freq, now);
  if (pitchDecayTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, pitchDecayTo), now + durationS);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durationS);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + durationS + 0.05);
}

// ─── Effects ─────────────────────────────────────────────────────────────

export function playShot(): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  // Sharp click + descending whoosh — like a cannon firing
  tone(c, 220, 0.12, 0.35, 'sawtooth', 80);
  noiseBurst(c, 0.08, 0.25, 3500, 'highpass');
}

export function playSplash(): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  // Soft watery whoosh — bandpass through a noise burst
  noiseBurst(c, 0.55, 0.45, 1800, 'lowpass');
  // Tiny secondary droplet
  window.setTimeout(() => {
    const c2 = getCtx();
    if (!c2) return;
    noiseBurst(c2, 0.18, 0.25, 4000, 'bandpass');
  }, 120);
}

export function playExplosion(): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  // Hit — short boom
  noiseBurst(c, 0.45, 0.55, 900, 'lowpass');
  tone(c, 110, 0.35, 0.4, 'square', 50);
}

export function playBigExplosion(): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  // Sunk — bigger, layered boom
  noiseBurst(c, 0.9, 0.7, 700, 'lowpass');
  tone(c, 90, 0.7, 0.55, 'sawtooth', 35);
  tone(c, 140, 0.55, 0.35, 'square', 50);
  window.setTimeout(() => {
    const c2 = getCtx();
    if (!c2) return;
    noiseBurst(c2, 0.6, 0.5, 600, 'lowpass');
    tone(c2, 100, 0.45, 0.35, 'sawtooth', 40);
  }, 140);
}

export function playWin(): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((f, i) => {
    window.setTimeout(() => {
      const cc = getCtx();
      if (!cc) return;
      tone(cc, f, 0.35, 0.3, 'triangle');
    }, i * 130);
  });
}

export function playPlace(): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  tone(c, 520, 0.05, 0.15, 'sine');
  tone(c, 340, 0.06, 0.12, 'sine');
}

export function playEmote(): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  tone(c, 700, 0.08, 0.18, 'sine');
  window.setTimeout(() => {
    const c2 = getCtx();
    if (!c2) return;
    tone(c2, 950, 0.1, 0.18, 'sine');
  }, 80);
}
