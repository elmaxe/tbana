// Tiny synthesised soundscape: tunnel rumble for moving trains and the door chime.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // Must be called from a user gesture.
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);

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
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass'; this.lp.frequency.value = 300;
    this.rumble = ctx.createGain();
    this.rumble.gain.value = 0;
    src.connect(this.lp).connect(this.rumble).connect(this.master);
    src.start();

    // faint station ambience
    const amb = ctx.createBufferSource();
    amb.buffer = buf; amb.loop = true; amb.playbackRate.value = 0.5;
    const ambF = ctx.createBiquadFilter(); ambF.type = 'bandpass'; ambF.frequency.value = 500; ambF.Q.value = 0.4;
    const ambG = ctx.createGain(); ambG.gain.value = 0.05;
    amb.connect(ambF).connect(ambG).connect(this.master);
    amb.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }

  setRumble(level) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rumble.gain.setTargetAtTime(level * 1.4, t, 0.15);
    this.lp.frequency.setTargetAtTime(160 + level * 420, t, 0.2);
  }

  // SL-style two-tone chime, attenuated by distance.
  chime(distance, kind) {
    if (!this.ctx || distance > 90) return;
    const vol = 0.25 * Math.max(0, 1 - distance / 90) ** 1.5;
    const notes = kind === 'open' ? [880, 698.5] : [698.5, 587.3, 698.5];
    const t0 = this.ctx.currentTime;
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = t0 + i * 0.32;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 1);
    });
  }
}
