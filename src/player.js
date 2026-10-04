import * as THREE from 'three';

const EYE = 1.65;
const STEP_UP = 0.62;
const STEP_DOWN = 0.68;
const WALK = 3.2, RUN = 8, FLY = 22;

// First-person walker. Collision is purely "is there a walkable surface under the next position
// within step range?" — every slab outline either continues into another surface or has a wall,
// railing or platform edge generated on it, so this matches what you see.
export class Player {
  constructor(camera, walk) {
    this.camera = camera;
    this.walk = walk;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.eyeY = 0;
    this.fly = false;
    this.surface = null;
    this.bob = 0;
    this._hits = [];
  }

  teleport(pos, yaw) {
    this.pos.copy(pos);
    this.yaw = yaw ?? this.yaw;
    this.pitch = 0;
    this.vel.set(0, 0, 0);
    this.eyeY = pos.y + EYE;
    this.surface = this.groundAt(pos.x, pos.z, pos.y)?.data ?? null;
    this.applyCamera(0);
  }

  look(dx, dy) {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy, -1.5, 1.5);
  }

  // Highest surface under (x, z) reachable from height y (stepping up or down a little).
  groundAt(x, z, y, offsets = true) {
    const hits = this.walk.query(x, z, this._hits);
    let best = null;
    for (const h of hits) {
      if (h.y <= y + STEP_UP && h.y >= y - STEP_DOWN && (!best || h.y > best.y)) best = { y: h.y, data: h.data };
    }
    if (best || !offsets) return best;
    // Bridge hairline gaps between neighbouring slabs in the drawing.
    for (const [ox, oz] of [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) {
      const g = this.groundAt(x + ox, z + oz, y, false);
      if (g && (!best || g.y > best.y)) best = g;
    }
    return best;
  }

  update(dt, input) {
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3()
      .addScaledVector(fwd, input.forward)
      .addScaledVector(right, input.strafe);
    if (wish.lengthSq() > 1) wish.normalize();

    if (this.fly) {
      const speed = FLY * (input.run ? 2.5 : 1);
      const look = new THREE.Vector3(
        -Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      const v = new THREE.Vector3()
        .addScaledVector(look, input.forward)
        .addScaledVector(right, input.strafe)
        .addScaledVector(new THREE.Vector3(0, 1, 0), input.up);
      this.pos.addScaledVector(v, speed * dt);
      this.eyeY = this.pos.y + EYE;
      this.surface = null;
      this.applyCamera(dt);
      return;
    }

    const speed = input.run ? RUN : WALK;
    const target = wish.multiplyScalar(speed);
    const k = 1 - Math.exp(-dt * 12);
    this.vel.x += (target.x - this.vel.x) * k;
    this.vel.z += (target.z - this.vel.z) * k;

    // Sub-step so fast movement can't skip over thin gaps.
    const dist = Math.hypot(this.vel.x, this.vel.z) * dt;
    const n = Math.max(1, Math.ceil(dist / 0.25));
    for (let i = 0; i < n; i++) {
      const dx = (this.vel.x * dt) / n, dz = (this.vel.z * dt) / n;
      let g = this.groundAt(this.pos.x + dx, this.pos.z + dz, this.pos.y);
      if (g) { this.pos.x += dx; this.pos.z += dz; }
      else if ((g = this.groundAt(this.pos.x + dx, this.pos.z, this.pos.y))) { this.pos.x += dx; this.vel.z *= 0.5; }
      else if ((g = this.groundAt(this.pos.x, this.pos.z + dz, this.pos.y))) { this.pos.z += dz; this.vel.x *= 0.5; }
      else { this.vel.x *= 0.3; this.vel.z *= 0.3; g = this.groundAt(this.pos.x, this.pos.z, this.pos.y); }
      if (g) {
        this.pos.y = g.y;
        this.surface = g.data;
      }
    }

    const moving = Math.hypot(this.vel.x, this.vel.z);
    this.bob += moving * dt * 1.9;
    this.applyCamera(dt, moving);
  }

  applyCamera(dt, moving = 0) {
    const targetEye = this.pos.y + EYE;
    // smooth stair stepping, but follow big jumps (lifts/teleports) instantly
    if (dt === 0 || Math.abs(targetEye - this.eyeY) > 2) this.eyeY = targetEye;
    else this.eyeY += (targetEye - this.eyeY) * (1 - Math.exp(-dt * 18));
    const bob = this.fly ? 0 : Math.sin(this.bob * Math.PI) * 0.035 * Math.min(1, moving / 3);
    this.camera.position.set(this.pos.x, this.eyeY + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
