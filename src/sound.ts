// Tiny soundscape: a synthesised tunnel rumble for moving trains and door chime, and recorded
// clips (public/sounds/) for a train coming into a station and the C30's doors closing.
export type ChimeKind = 'open' | 'close';

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

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  lp: BiquadFilterNode;
  rumble: GainNode;
}

export class Sound {
  muted = false;
  private g: Graph | null = null;
  private clips = new Map<Clip, AudioBuffer>();

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
    master.gain.value = this.muted ? 0 : 0.8;
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

  setMuted(m: boolean) {
    this.muted = m;
    if (this.g) this.g.master.gain.value = m ? 0 : 0.8;
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
