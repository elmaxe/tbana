// Tiny soundscape: a synthesised tunnel rumble for moving trains, door chime and C20 door warning,
// and recorded clips (public/sounds/) for a train coming into a station and the C30's doors closing.
export type ChimeKind = 'open' | 'close';

// The player's volume (0 to 1, where the slider is) and mute, kept in the browser between visits.
// Full volume is the level the game always had. The gain is the slider's square, which makes its
// middle sound about half as loud.
const FULL = 0.8;
const VOLUME_KEY = 'tbana-volume', MUTED_KEY = 'tbana-muted';
const stored = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const store = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* not kept */ }
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const savedVolume = () => {
  const v = Number.parseFloat(stored(VOLUME_KEY) ?? '');
  return Number.isNaN(v) ? 1 : clamp01(v);
};

// platform: the chime on the platform as a train comes in; next: the one inside the train as it
// comes into the next station; closing: the C30's warning as its doors close, which drops in
// level when they have shut (C30_SHUT in src/service.ts); shut: the doors themselves
const CLIPS = {
  platform: 'sounds/platform-arrival.mp3',
  next: 'sounds/next-station.mp3',
  closing: 'sounds/c30-doors-closing.mp3',
  shut: 'sounds/c30-doors-shut.mp3',
};
export type Clip = keyof typeof CLIPS;
// seconds into the shut clip at which the doors meet
export const SHUT_SLAM = 0.78;

export const HEARD = 90; // metres: a train's sounds aren't heard further away than this
const falloff = (distance: number) => Math.max(0, 1 - distance / HEARD) ** 1.5;

// The C20's door warning, measured from a recording made aboard one: a whistle, and 0.37 s after
// it a buzz from the car's loudspeakers. The buzz is a 336.4 Hz square wave, whose odd harmonics
// the small speakers lift round 2 kHz, made raspy by sidebands 143 Hz either side of each
// harmonic (the timing of whatever generates it). It swells over its first 3 s and stops just
// after the doors meet (C20_SHUT in src/service.ts); the whistle fades as they close.
const C20_F0 = 336.4;
const C20_WHISTLE = 1866;
// dB of the buzz's harmonics 1, 3 … 15 (middle column) and of the sidebands 3, 2 and 1 × 144 Hz
// below them and 1, 2 and 3 × 144 Hz above, against the fundamental (null: not heard). 144 Hz is
// 3/7 of the fundamental, so the buzz is one periodic wave on a seventh of it.
const C20_BUZZ: (number | null)[][] = [
  [null, null, -7, 0, -8, null, -11],
  [null, null, -19, 2, -11, -19, -25],
  [-15, -8, -12, 6, -14, -17, -21],
  [-25, -12, -18, 7, -17, -18, -27],
  [-21, -24, -26, -7, -14, -30, -31],
  [-31, -27, -35, -12, -24, -29, -36],
  [-38, -36, -33, -26, -28, -33, null],
  [-35, -37, -28, -23, -28, -36, -32],
];
const C20_LOUD = 0.032;     // the buzz's RMS at its loudest, as loud as the C30's warning clip
const C20_WHISTLE_DB = -2;  // the whistle against the buzz's fundamental at its loudest
const c20Waves = new WeakMap<BaseAudioContext, { wave: PeriodicWave; fundamental: number }>();

function c20Buzz(ctx: BaseAudioContext) {
  let w = c20Waves.get(ctx);
  if (w) return w;
  const n = 7 * 15 + 3 * 3 + 1;
  const real = new Float32Array(n), imag = new Float32Array(n);
  let power = 0;
  C20_BUZZ.forEach((row, i) => row.forEach((db, j) => {
    if (db === null) return;
    const a = 10 ** (db / 20), m = j - 3;
    // sine phase, as in a square wave, and the sidebands below three eighths of a turn on: between
    // a tremolo and a vibrato, which gives the buzz the slight flutter the recording has
    const p = m < 0 ? (3 * Math.PI) / 4 : 0;
    real[7 * (2 * i + 1) + 3 * m] = a * Math.sin(p);
    imag[7 * (2 * i + 1) + 3 * m] = a * Math.cos(p);
    power += (a * a) / 2;
  }));
  const k = C20_LOUD / Math.sqrt(power);
  for (let i = 0; i < n; i++) { real[i] *= k; imag[i] *= k; }
  w = { wave: ctx.createPeriodicWave(real, imag, { disableNormalization: true }), fundamental: k };
  c20Waves.set(ctx, w);
  return w;
}

// Plays the C20's door warning into `out` from `t0` on, at `vol` (1: beside the train). The buzz
// stops 0.25 s after the doors meet (C20_SHUT).
export function c20Warning(ctx: BaseAudioContext, out: AudioNode, t0: number, vol = 1) {
  const { wave, fundamental } = c20Buzz(ctx);
  const buzz = ctx.createOscillator();
  buzz.setPeriodicWave(wave);
  buzz.frequency.value = C20_F0 / 7;
  const bg = ctx.createGain();
  const on = t0 + 0.37, off = t0 + 4.45;
  bg.gain.setValueAtTime(0, on);
  bg.gain.linearRampToValueAtTime(0.28 * vol, on + 0.01);
  bg.gain.setTargetAtTime(vol, on + 0.01, 1.2);
  bg.gain.setTargetAtTime(0, off, 0.17);
  buzz.connect(bg).connect(out);
  buzz.start(on); buzz.stop(off + 1.2);

  // the whistle wavers 12 Hz either way 31 times a second
  const whistle = ctx.createOscillator();
  whistle.frequency.value = C20_WHISTLE;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 31.4;
  const depth = ctx.createGain();
  depth.gain.value = 12;
  lfo.connect(depth).connect(whistle.frequency);
  const wg = ctx.createGain();
  const level = vol * fundamental * 10 ** (C20_WHISTLE_DB / 20);
  wg.gain.setValueAtTime(0, t0);
  wg.gain.linearRampToValueAtTime(level, t0 + 0.15);
  wg.gain.setTargetAtTime(0, t0 + 2.8, 0.7);
  whistle.connect(wg).connect(out);
  whistle.start(t0); lfo.start(t0);
  whistle.stop(t0 + 6.5); lfo.stop(t0 + 6.5);
}

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  lp: BiquadFilterNode;
  rumble: GainNode;
}

export class Sound {
  muted = stored(MUTED_KEY) === '1';
  volume = savedVolume();
  private g: Graph | null = null;
  private clips = new Map<Clip, AudioBuffer>();
  private listeners: (() => void)[] = [];

  get ctx(): AudioContext | null {
    return this.g?.ctx ?? null;
  }

  // Must be called from a user gesture.
  start() {
    if (this.g) { this.g.ctx.resume(); return; }
    const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = this.level;
    master.connect(ctx.destination);

    // brown noise → low-pass → rumble gain
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 300;
    const rumble = ctx.createGain();
    rumble.gain.value = 0;
    src.connect(lp).connect(rumble).connect(master);
    src.start();

    // faint station ambience
    const amb = ctx.createBufferSource();
    amb.buffer = buf; amb.loop = true; amb.playbackRate.value = 0.5;
    const ambF = ctx.createBiquadFilter(); ambF.type = 'bandpass'; ambF.frequency.value = 500; ambF.Q.value = 0.4;
    const ambG = ctx.createGain(); ambG.gain.value = 0.05;
    amb.connect(ambF).connect(ambG).connect(master);
    amb.start();
    this.g = { ctx, master, lp, rumble };

    for (const [name, url] of Object.entries(CLIPS) as [Clip, string][]) {
      fetch(url)
        .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.arrayBuffer(); })
        .then((data) => ctx.decodeAudioData(data))
        .then((buf) => this.clips.set(name, buf), (err) => console.warn(`no sound ${url}:`, err));
    }
  }

  // the master gain
  private get level() {
    return this.muted ? 0 : FULL * this.volume ** 2;
  }

  // Unmuting with the volume all the way down turns it up halfway, to be heard.
  setMuted(m: boolean) {
    this.muted = m;
    if (!m && this.volume === 0) this.volume = 0.5;
    this.changed();
  }

  // Setting the volume unmutes.
  setVolume(v: number) {
    this.volume = clamp01(v);
    this.muted = false;
    this.changed();
  }

  // nothing heard: muted, or the volume all the way down
  get silent() {
    return this.muted || this.volume === 0;
  }

  // `fn` is called whenever the volume or mute changes.
  onChange(fn: () => void) {
    this.listeners.push(fn);
  }

  private changed() {
    // glided to, so a slider dragged doesn't click
    if (this.g) this.g.master.gain.setTargetAtTime(this.level, this.g.ctx.currentTime, 0.02);
    store(VOLUME_KEY, String(this.volume));
    store(MUTED_KEY, this.muted ? '1' : '0');
    for (const fn of this.listeners) fn();
  }

  setRumble(level: number) {
    if (!this.g) return;
    const t = this.g.ctx.currentTime;
    this.g.rumble.gain.setTargetAtTime(level * 1.4, t, 0.15);
    this.g.lp.frequency.setTargetAtTime(160 + level * 420, t, 0.2);
  }

  // Plays a recorded clip `delay` seconds from now, attenuated by distance. False if it isn't
  // loaded (yet).
  play(clip: Clip, distance: number, delay = 0) {
    const g = this.g, buf = this.clips.get(clip);
    if (!g || !buf) return false;
    if (distance > HEARD) return true;
    const src = g.ctx.createBufferSource();
    src.buffer = buf;
    const gain = g.ctx.createGain();
    gain.gain.value = falloff(distance);
    src.connect(gain).connect(g.master);
    src.start(g.ctx.currentTime + delay);
    return true;
  }

  // The C20's door warning, attenuated by distance.
  c20Closing(distance: number) {
    const g = this.g;
    if (!g || distance > HEARD) return;
    c20Warning(g.ctx, g.master, g.ctx.currentTime, falloff(distance));
  }

  // SL-style two-tone chime, attenuated by distance.
  chime(distance: number, kind: ChimeKind) {
    const g = this.g;
    if (!g || distance > HEARD) return;
    const vol = 0.25 * falloff(distance);
    const notes = kind === 'open' ? [880, 698.5] : [698.5, 587.3, 698.5];
    const t0 = g.ctx.currentTime;
    notes.forEach((f, i) => {
      const o = g.ctx.createOscillator();
      const gain = g.ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = t0 + i * 0.32;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(gain).connect(g.master);
      o.start(t); o.stop(t + 1);
    });
  }
}
