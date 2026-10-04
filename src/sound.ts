// Tiny synthesised soundscape: tunnel rumble for moving trains and the door chime.
export type ChimeKind = 'open' | 'close';

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  lp: BiquadFilterNode;
  rumble: GainNode;
}

export class Sound {
  muted = false;
  private g: Graph | null = null;

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

  // SL-style two-tone chime, attenuated by distance.
  chime(distance: number, kind: ChimeKind) {
    const g = this.g;
    if (!g || distance > 90) return;
    const vol = 0.25 * Math.max(0, 1 - distance / 90) ** 1.5;
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
