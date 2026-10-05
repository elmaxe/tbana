// The outside camera: a second view that follows the first-person camera from above and to the
// side, and shows where it is and where it looks with a marker. Drag in its view to swing it
// round, the wheel to come closer or go further off.
//
// Underground it would see only rock and streets, so while the first-person camera is indoors
// (or always, or never) everything above its head is cut away in this view: a section through
// the tunnel or station at that height.
import * as THREE from 'three';
import type { Fly } from './fly';

export type CutMode = 'auto' | 'on' | 'off';

// the marker's layer: the outside camera sees it, the first-person camera and picking don't
export const MARKER_LAYER = 1;
const MARKER = 0xff4fd8;
// how far over the first-person camera's eye the cut is
const CUT_OVER_EYE = 1.2;

export class Outside {
  camera = new THREE.PerspectiveCamera(50, 1, 0.5, 6000);
  marker = new THREE.Group();
  // where it is round the first-person camera: the angle from straight behind it (to its right),
  // how high (radians over the level), and how far off (m)
  around = 1.2;
  elevation = 0.62;
  distance = 45;
  cut: CutMode = 'auto';
  private heading = 0; // the first-person camera's heading as followed, smoothed
  private head = new THREE.Group();
  private frustum: THREE.LineSegments;
  private started = false;

  constructor() {
    this.camera.layers.enable(MARKER_LAYER);
    const mat = { color: MARKER, depthTest: false, depthWrite: false, transparent: true };
    // the head turns and grows with distance: a body behind the eye, and the view's frustum; a
    // stalk stands down to where the feet would be
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8).translate(0, 0, 0.4), new THREE.MeshBasicMaterial({ ...mat, opacity: 0.9 }));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), new THREE.MeshBasicMaterial({ ...mat, color: 0xffffff }));
    this.frustum = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ ...mat, opacity: 0.85 }));
    const stalk = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -1.65, 0)]),
      new THREE.LineBasicMaterial({ ...mat, opacity: 0.6 }));
    this.head.add(body, eye, this.frustum);
    this.marker.add(this.head, stalk);
    this.marker.traverse((o) => { o.layers.set(MARKER_LAYER); o.renderOrder = 999; });
    this.marker.name = 'first-person camera';
  }

  // Swings the camera round (drag) or in and out (wheel).
  orbit(dx: number, dy: number) {
    this.around -= dx * 0.006;
    this.elevation = THREE.MathUtils.clamp(this.elevation + dy * 0.006, 0.05, 1.53);
  }

  zoom(deltaY: number) {
    this.distance = THREE.MathUtils.clamp(this.distance * Math.pow(1.0015, deltaY), 4, 3000);
  }

  // Follows the first-person camera, turning with it, a little behind.
  update(dt: number, fly: Fly, fpCamera: THREE.PerspectiveCamera) {
    // the shortest way round to its heading
    const d = Math.atan2(Math.sin(fly.yaw - this.heading), Math.cos(fly.yaw - this.heading));
    this.heading = this.started ? this.heading + d * Math.min(1, dt * 2.5) : fly.yaw;
    this.started = true;
    // behind the camera is (sin yaw, cos yaw); turning that by `around` towards its right
    const a = this.heading + this.around, flat = Math.cos(this.elevation) * this.distance;
    const target = fly.pos;
    this.camera.position.set(target.x + Math.sin(a) * flat, target.y + Math.sin(this.elevation) * this.distance, target.z + Math.cos(a) * flat);
    this.camera.lookAt(target);

    // the marker: the size of a few metres however far off, so it can be seen
    const s = Math.max(1, this.distance / 30);
    this.marker.position.copy(target);
    this.head.rotation.set(fly.pitch, fly.yaw, 0, 'YXZ');
    this.head.scale.setScalar(s);
    const len = 6, h = Math.tan(THREE.MathUtils.degToRad(fpCamera.fov) / 2) * len, w = h * fpCamera.aspect;
    const c = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => new THREE.Vector3(x, y, -len));
    const pts = c.flatMap((p, i) => [new THREE.Vector3(), p, p, c[(i + 1) % 4]]);
    this.frustum.geometry.setFromPoints(pts);
  }

  // The height everything over is cut away at in this view, or null for none.
  cutAt(fly: Fly, outdoors: number) {
    const on = this.cut === 'on' || (this.cut === 'auto' && outdoors < 0.5);
    return on ? fly.pos.y + CUT_OVER_EYE : null;
  }
}
