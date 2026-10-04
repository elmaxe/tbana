// Keyboard + mouse (pointer lock) + touch (floating stick on the left, drag to look on the right).
// Switches between mouse and touch mode automatically, so hybrid devices work too.
export class Input {
  constructor(canvas, { onLook, onKey, onModeChange }) {
    this.keys = new Set();
    this.onLook = onLook;
    this.onKey = onKey;
    this.onModeChange = onModeChange;
    this.touchMode = matchMedia('(pointer: coarse)').matches;
    this.stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
    this.look = { id: null, x: 0, y: 0 };
    this.hold = { up: false, down: false };
    this.touchUI = null;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.onKey?.(e.code, e);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.release(); });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) this.onLook(e.movementX * 0.0022, e.movementY * 0.0022);
    });

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') { this.setTouchMode(false); return; }
      this.setTouchMode(true);
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      if (e.clientX < innerWidth * 0.45 && this.stick.id === null) {
        Object.assign(this.stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
        this.touchUI?.showStick(e.clientX, e.clientY);
      } else if (this.look.id === null) {
        Object.assign(this.look, { id: e.pointerId, x: e.clientX, y: e.clientY });
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stick.id) {
        const dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
        const len = Math.hypot(dx, dy), max = 60;
        const k = len > max ? max / len : 1;
        this.stick.x = (dx * k) / max;
        this.stick.y = (dy * k) / max;
        this.touchUI?.moveStick(dx * k, dy * k);
      } else if (e.pointerId === this.look.id) {
        // ~1 screen width of drag ≈ a half turn, independent of device size
        const s = Math.PI / Math.max(320, Math.min(innerWidth, 1000));
        this.onLook((e.clientX - this.look.x) * s, (e.clientY - this.look.y) * s);
        this.look.x = e.clientX;
        this.look.y = e.clientY;
      }
    });
    const end = (e) => {
      if (e.pointerId === this.stick.id) {
        Object.assign(this.stick, { id: null, x: 0, y: 0 });
        this.touchUI?.hideStick();
      }
      if (e.pointerId === this.look.id) this.look.id = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);

    // Safari pinch-zoom / double-tap gestures would otherwise fight the controls.
    for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) {
      document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    }
  }

  setTouchMode(on) {
    if (on === this.touchMode) return;
    this.touchMode = on;
    if (!on) this.release();
    this.onModeChange?.(on);
  }

  release() {
    Object.assign(this.stick, { id: null, x: 0, y: 0 });
    this.look.id = null;
    this.hold.up = this.hold.down = false;
    this.touchUI?.hideStick();
  }

  state() {
    const k = (...codes) => codes.some((c) => this.keys.has(c));
    let forward = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
    let strafe = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
    let run = k('ShiftLeft', 'ShiftRight');
    if (this.stick.id !== null) {
      forward -= this.stick.y;
      strafe += this.stick.x;
      run = run || Math.hypot(this.stick.x, this.stick.y) > 0.92;
    }
    const up = (k('Space') || this.hold.up ? 1 : 0) - (k('KeyC', 'ControlLeft') || this.hold.down ? 1 : 0);
    return { forward, strafe, run, up };
  }
}
