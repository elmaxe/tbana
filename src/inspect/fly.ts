// The inspector's free camera: drag to look, W A S D to fly where it looks, E / Q (or Space / C)
// to rise and sink, Shift to go fast, the wheel for the speed. Yaw and pitch are as the
// player's (src/player.ts): yaw 0 looks north (−z), so a view can be opened in the game.
import * as THREE from 'three';

const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'Space', 'KeyC', 'ShiftLeft', 'ShiftRight',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export class Fly {
  pos = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  speed = 12; // m/s
  moved = false; // since last asked
  // whether a pointer at (clientX, clientY) is in this camera's view
  accepts: (x: number, y: number) => boolean = () => true;
  private down = new Set<string>();

  constructor(private canvas: HTMLCanvasElement, private camera: THREE.PerspectiveCamera, private onSpeed: (speed: number) => void = () => {}) {
    // keys go to the view, unless typing into something
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    addEventListener('keydown', (e) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey || !KEYS.includes(e.code)) return;
      this.down.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());

    let drag: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !this.accepts(e.clientX, e.clientY)) return;
      canvas.setPointerCapture(e.pointerId);
      canvas.focus();
      drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.look((e.clientX - drag.x) * 0.0035, (e.clientY - drag.y) * 0.0035);
      drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('wheel', (e) => {
      if (!this.accepts(e.clientX, e.clientY)) return;
      e.preventDefault();
      this.speed = THREE.MathUtils.clamp(this.speed * Math.pow(1.0015, -e.deltaY), 0.5, 600);
      this.onSpeed(this.speed);
    }, { passive: false });
  }

  look(dx: number, dy: number) {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy, -1.55, 1.55);
    this.moved = true;
  }

  set(pos: THREE.Vector3 | [number, number, number], yaw = this.yaw, pitch = 0) {
    if (Array.isArray(pos)) this.pos.fromArray(pos); else this.pos.copy(pos);
    this.yaw = yaw;
    this.pitch = pitch;
    this.moved = true;
    this.apply();
  }

  // Looks at a point from where the camera is.
  lookAt(x: number, y: number, z: number) {
    const dx = x - this.pos.x, dy = y - this.pos.y, dz = z - this.pos.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    this.apply();
  }

  update(dt: number) {
    const k = (code: string) => (this.down.has(code) ? 1 : 0);
    const forward = k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown');
    const strafe = k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft');
    const up = k('KeyE') + k('Space') - k('KeyQ') - k('KeyC');
    if (forward || strafe || up) {
      const speed = this.speed * (k('ShiftLeft') || k('ShiftRight') ? 4 : 1);
      const look = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const v = new THREE.Vector3().addScaledVector(look, forward).addScaledVector(right, strafe).addScaledVector(THREE.Object3D.DEFAULT_UP, up);
      if (v.lengthSq() > 1) v.normalize();
      this.pos.addScaledVector(v, speed * dt);
      this.moved = true;
    }
    this.apply();
  }

  private apply() {
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  // As the game's ?cam=: x, y, z of the eye, heading and pitch. The game puts the eye 1.65 m over
  // what it's given.
  cam(eye = 1.65) {
    const r = (n: number, d = 2) => Number(n.toFixed(d));
    return [r(this.pos.x), r(this.pos.y - eye), r(this.pos.z), r(this.yaw, 3), r(this.pitch, 3)];
  }
}
