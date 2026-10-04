// Keyboard + mouse (pointer lock) + touch (virtual stick on the left, look on the right).
export class Input {
  constructor(canvas, { onLook, onKey }) {
    this.keys = new Set();
    this.onLook = onLook;
    this.onKey = onKey;
    this.stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this.lookTouch = { id: null, x: 0, y: 0 };
    this.touchUI = null;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.onKey?.(e.code, e);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) this.onLook(e.movementX * 0.0022, e.movementY * 0.0022);
    });

    canvas.addEventListener('touchstart', (e) => this.touch(e, 'start'), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.touch(e, 'move'), { passive: false });
    canvas.addEventListener('touchend', (e) => this.touch(e, 'end'), { passive: false });
    canvas.addEventListener('touchcancel', (e) => this.touch(e, 'end'), { passive: false });
  }

  touch(e, phase) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (phase === 'start') {
        if (t.clientX < innerWidth * 0.45 && this.stick.id === null) {
          Object.assign(this.stick, { id: t.identifier, ox: t.clientX, oy: t.clientY, x: 0, y: 0 });
          this.touchUI?.showStick(t.clientX, t.clientY);
        } else if (this.lookTouch.id === null) {
          Object.assign(this.lookTouch, { id: t.identifier, x: t.clientX, y: t.clientY });
        }
      } else if (phase === 'move') {
        if (t.identifier === this.stick.id) {
          const dx = t.clientX - this.stick.ox, dy = t.clientY - this.stick.oy;
          const len = Math.hypot(dx, dy), max = 55;
          const k = len > max ? max / len : 1;
          this.stick.x = (dx * k) / max; this.stick.y = (dy * k) / max;
          this.touchUI?.moveStick(dx * k, dy * k);
        } else if (t.identifier === this.lookTouch.id) {
          this.onLook((t.clientX - this.lookTouch.x) * 0.005, (t.clientY - this.lookTouch.y) * 0.005);
          this.lookTouch.x = t.clientX; this.lookTouch.y = t.clientY;
        }
      } else {
        if (t.identifier === this.stick.id) {
          Object.assign(this.stick, { id: null, x: 0, y: 0 });
          this.touchUI?.hideStick();
        }
        if (t.identifier === this.lookTouch.id) this.lookTouch.id = null;
      }
    }
  }

  state() {
    const k = (...codes) => codes.some((c) => this.keys.has(c));
    let forward = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
    let strafe = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
    let run = k('ShiftLeft', 'ShiftRight');
    if (this.stick.id !== null) {
      forward -= this.stick.y; strafe += this.stick.x;
      run = run || Math.hypot(this.stick.x, this.stick.y) > 0.95;
    }
    const up = (k('Space') ? 1 : 0) - (k('KeyC', 'ControlLeft') ? 1 : 0);
    return { forward, strafe, run, up };
  }
}
