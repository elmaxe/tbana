import * as THREE from 'three';
import { loopOf, profile } from './kit';
import type { Painter, Profile, ProfileCtrl } from './kit';
import type { CabinLights } from './cabin-light';
import type { CarDef } from './train';

// Building blocks for the passenger interiors. Same car axes as kit.js: +x forward, +y up from the
// top of the rail, +z right. An interior is an inner lining (floor, walls and ceiling swept from a
// cross-section, painted like a livery, with the windows cut out), end walls with gangway portals
// or a cab bulkhead, and seats, poles and rails placed from a layout. The ceiling lights are
// described as strips (`lights`) that light every interior material (see cabin-light.ts).

export interface LiningProfile extends Profile { floorY: number }
export interface Portal { w: number; y0: number; y1: number; r: number; chamfer?: boolean; foot?: number; z?: number }
export interface SeatOptions {
  width?: number; height?: number; depth?: number; back?: number; recline?: number; shellT?: number;
  cushion?: number; cushionBack?: number; grip?: boolean; gripSide?: number;
}
export type Vec3 = [number, number, number];
export type InteriorMaterials = Record<string, THREE.Material>;
export interface InteriorContext { x0: number; x1: number; xa: number; xb: number; mats: InteriorMaterials; prof: LiningProfile }
export interface InteriorSpec {
  key?: string;
  lining: LiningProfile;
  floorY: number;
  lights: CabinLights;
  endWall: number;
  cabDepth: number;
  portal: Portal;
  pleat?: number;
  noPlate?: boolean;
  gangway?(xc: number, mats: InteriorMaterials): THREE.Object3D[];
  materials(): InteriorMaterials;
  paint(p: Painter, def: CarDef, ctx: InteriorContext): void;
  furnish(def: CarDef, ctx: InteriorContext): THREE.Object3D[];
  // the inside face of a door leaf (see doors.ts)
  doorLeaf?(p: Painter, w: number): void;
}

// Lining cross-section. ctrl goes from the floor centre [0, floorY] round the right side to the
// ceiling centre, as in profile(). The floor is part of the lining, so its arc length starts at
// −w (the floor centre) instead of just below the side.
export function liningProfile(ctrl: ProfileCtrl[], step = 0.08): LiningProfile {
  const p = profile(ctrl, step);
  return { ...p, tMin: p.pts[0].t, floorY: ctrl[0][1] };
}

// Lining surface between x0 and x1, facing inwards. UVs are laid out for sidePainter(…, { inside:
// true }): seen from inside, the u axis runs the other way round to the shell's.
export function liningGeometry(prof: Profile, x0: number, x1: number) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const L = x1 - x0;
  const vb = (t: number) => (THREE.MathUtils.clamp(t, prof.tMin, prof.tMax) - prof.tMin) / (prof.tMax - prof.tMin) * 0.49;
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (const p of prof.pts) {
      for (const x of [x0, x1]) {
        pos.push(x, p.y, p.z * side);
        nor.push(0, -p.ny, -p.nz * side);
        uv.push(side > 0 ? (x1 - x) / L : (x - x0) / L, (side > 0 ? 0 : 0.51) + vb(p.t));
      }
    }
    for (let j = 0; j < prof.pts.length - 1; j++) {
      const a = base + j * 2, b = a + 1, c = a + 2, d = a + 3;
      if (side > 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// A gangway portal or doorway in the cross-section plane, centred on z = 0: a rectangle from y0 to y1,
// w wide, with rounded top corners of radius r, or with `chamfer` set, an octagon whose top corners
// are cut back by r and bottom corners by `foot`.
export function portalPath({ w, y0, y1, r, chamfer = false, foot = 0 }: Portal) {
  const p = new THREE.Path(), h = w / 2;
  if (chamfer) {
    p.moveTo(-h + foot, y0);
    p.lineTo(h - foot, y0);
    p.lineTo(h, y0 + foot);
    p.lineTo(h, y1 - r);
    p.lineTo(h - r, y1);
    p.lineTo(-h + r, y1);
    p.lineTo(-h, y1 - r);
    p.lineTo(-h, y0 + foot);
    p.closePath();
    return p;
  }
  p.moveTo(-h, y0);
  p.lineTo(h, y0);
  p.lineTo(h, y1 - r);
  p.absarc(h - r, y1 - r, r, 0, Math.PI / 2, false);
  p.lineTo(-h + r, y1);
  p.absarc(-h + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  p.closePath();
  return p;
}

// Points round a portal (for tubes), counter-clockwise seen from +x.
export function portalLoop(portal: Portal, n = 48) {
  return portalPath(portal).getSpacedPoints(n).slice(0, -1).map((p) => ({ z: p.x, y: p.y }));
}

// Flat wall across the car at x, its face pointing along `facing` (±1). The outline is the cross-
// section; holes are portals { w, y0, y1, r, z }.
export function endWallGeometry(prof: Profile, x: number, facing: number, holes: Portal[] = []) {
  const loop = loopOf(prof);
  const shape = new THREE.Shape(loop.map((p) => new THREE.Vector2(p.z, p.y)));
  // shape x → −z for facing +x (a rotation of +90° about y), → +z for facing −x
  const sx = (z: number) => (facing > 0 ? -z : z);
  for (const h of holes) {
    const pts = portalPath(h).getPoints(8);
    shape.holes.push(new THREE.Path(pts.map((p) => new THREE.Vector2(sx(p.x + (h.z ?? 0)), p.y))));
  }
  const g = new THREE.ShapeGeometry(shape, 8);
  g.rotateY(facing > 0 ? Math.PI / 2 : -Math.PI / 2);
  g.translate(x, 0, 0);
  return g;
}

// Tube round a portal from xa to xb, optionally pleated like bellows, facing inwards.
export function portalTube(portal: Portal, xa: number, xb: number, { pleat = 0, depth = 0, floor = true }: { pleat?: number; depth?: number; floor?: boolean } = {}) {
  const { y0, y1 } = portal;
  const loop = portalLoop(portal).filter((p) => floor || p.y > y0 + 1e-3);
  const n = pleat ? Math.max(2, Math.round((xb - xa) / (pleat / 2))) : 1;
  const pos: number[] = [], idx: number[] = [], uv: number[] = [];
  const cy = (y0 + y1) / 2;
  for (let i = 0; i <= n; i++) {
    const x = xa + ((xb - xa) * i) / n;
    const s = i % 2 ? 1 + depth : 1;
    for (const p of loop) {
      // pleats bulge outwards, away from the walkway
      pos.push(x, p.y <= y0 + 1e-3 ? y0 : Math.max(y0, cy + (p.y - cy) * s), p.z * s);
      uv.push(x, p.y);
    }
  }
  const M = loop.length, closed = floor;
  for (let i = 0; i < n; i++) {
    for (let m = 0; m < (closed ? M : M - 1); m++) {
      const a = i * M + m, b = i * M + ((m + 1) % M), c = (i + 1) * M + m, d = (i + 1) * M + ((m + 1) % M);
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ seats

function extrudeSide(shape: THREE.Shape, width: number, bevel = 0.012) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1,
    curveSegments: 3,
  });
  g.translate(0, 0, -(width - 2 * bevel) / 2);
  return g;
}

// One passenger seat facing +x, standing on the floor at y = 0, its back against x = 0, centred
// on z = 0. Returns geometry per part: shell (the moulded seat), cushion (upholstery), grip.
//   height: seat top above the floor, depth: seat pan, back: top of the back above the floor,
//   recline: back angle in radians, cushionBack: how far up the back the upholstery goes (0–1).
export function seatGeometry({
  width = 0.46, height = 0.45, depth = 0.44, back = 1.0, recline = 0.2, shellT = 0.035,
  cushion = 0.04, cushionBack = 0.85, grip = false, gripSide = 1,
}: SeatOptions = {}) {
  const tan = Math.tan(recline);
  const bx = (y: number) => 0.09 - (y - height) * tan; // front face of the back at height y
  const back0 = bx(height), backTop = bx(back);
  // shell: side outline of pan + back
  const s = new THREE.Shape();
  s.moveTo(0.05, height - shellT - 0.03);
  s.lineTo(depth - 0.02, height - shellT);
  s.quadraticCurveTo(depth + 0.02, height - shellT * 0.5, depth, height);
  s.lineTo(back0 + 0.04, height - 0.005);
  s.quadraticCurveTo(back0, height, back0 - 0.002, height + 0.05);
  s.lineTo(backTop, back - 0.04);
  s.quadraticCurveTo(backTop - 0.005, back, backTop - shellT - 0.01, back);
  s.lineTo(backTop - shellT - 0.02, back - 0.03);
  s.lineTo(0.03, height + 0.02);
  s.closePath();
  const shell = [extrudeSide(s, width)];
  // upholstery: pan cushion and back cushion
  const pan = new THREE.Shape();
  pan.moveTo(back0 + 0.03, height - 0.005);
  pan.lineTo(depth - 0.03, height - 0.005);
  pan.quadraticCurveTo(depth - 0.005, height + cushion * 0.4, depth - 0.04, height + cushion);
  pan.lineTo(back0 + 0.04, height + cushion);
  pan.closePath();
  const cushions = [extrudeSide(pan, width - 0.05, 0.01)];
  const yb0 = height + cushion + 0.02, yb1 = height + (back - height) * cushionBack;
  const bk = new THREE.Shape();
  bk.moveTo(bx(yb0) - 0.004, yb0);
  bk.lineTo(bx(yb0) + cushion * 0.8, yb0);
  bk.lineTo(bx(yb1) + cushion * 0.8, yb1 - 0.02);
  bk.quadraticCurveTo(bx(yb1) + cushion * 0.6, yb1, bx(yb1) - 0.004, yb1);
  bk.closePath();
  cushions.push(extrudeSide(bk, width - 0.06, 0.01));
  const grips: THREE.BufferGeometry[] = [];
  if (grip) {
    // a loop handle on top of the back at the aisle side
    const t = new THREE.TorusGeometry(0.055, 0.012, 6, 14, Math.PI);
    t.rotateY(Math.PI / 2);
    t.translate(backTop - shellT / 2 - 0.005, back - 0.005, gripSide * (width / 2 - 0.09));
    grips.push(t);
  }
  return { shell, cushion: cushions, grip: grips };
}

// Place a list of geometries with a transform (position and yaw), returning clones.
export function place(list: THREE.BufferGeometry[], x: number, y: number, z: number, yaw = 0) {
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  return list.map((g) => g.clone().applyMatrix4(m));
}

// Yaw so that a seat built facing +x faces the given direction.
export const FACE = { fwd: 0, back: Math.PI, right: -Math.PI / 2, left: Math.PI / 2 };

// ------------------------------------------------------------------ poles and rails

export function pole(x: number, z: number, y0: number, y1: number, r = 0.018) {
  return new THREE.CylinderGeometry(r, r, y1 - y0, 8, 1, true).translate(x, (y0 + y1) / 2, z);
}

// Rail along a polyline of [x, y, z] points with rounded corners: one segment per straight run and
// a few per bend, swept with a parallel-transported frame.
export function rail(points: Vec3[], r = 0.017, bend = 0.08, radial = 6) {
  const P = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const pts = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const p = P[i], a = p.clone().addScaledVector(P[i - 1].clone().sub(p).normalize(), Math.min(bend, P[i - 1].distanceTo(p) / 2));
    const b = p.clone().addScaledVector(P[i + 1].clone().sub(p).normalize(), Math.min(bend, P[i + 1].distanceTo(p) / 2));
    const q = new THREE.QuadraticBezierCurve3(a, p, b);
    for (let k = 0; k <= 4; k++) pts.push(q.getPoint(k / 4));
  }
  pts.push(P[P.length - 1]);
  const clean = pts.filter((p, i) => i === 0 || p.distanceToSquared(pts[i - 1]) > 1e-8);
  const n = clean.length;
  const tang = clean.map((p, i) => clean[Math.min(n - 1, i + 1)].clone().sub(clean[Math.max(0, i - 1)]).normalize());
  // first frame: any vector perpendicular to the first tangent
  const t0 = tang[0];
  let nrm = Math.abs(t0.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  nrm = nrm.sub(t0.clone().multiplyScalar(nrm.dot(t0))).normalize();
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      // parallel transport the normal onto the new tangent
      const ax = tang[i - 1].clone().cross(tang[i]);
      if (ax.lengthSq() > 1e-10) nrm.applyAxisAngle(ax.normalize(), Math.acos(THREE.MathUtils.clamp(tang[i - 1].dot(tang[i]), -1, 1)));
    }
    const bin = tang[i].clone().cross(nrm).normalize();
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const d = nrm.clone().multiplyScalar(Math.cos(a)).addScaledVector(bin, Math.sin(a));
      pos.push(clean[i].x + d.x * r, clean[i].y + d.y * r, clean[i].z + d.z * r);
      nor.push(d.x, d.y, d.z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k, b = i * radial + ((k + 1) % radial), c = a + radial, d = b + radial;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// ------------------------------------------------------------------ textures and materials

// Seat moquette: a repeating canvas pattern `size` metres across. draw(ctx, n) paints an n×n tile.
// Upholstery is extruded sideways (seatGeometry), so its UVs run across the seat; `turn` rotates
// the pattern a quarter turn so that it stands upright on the seat backs.
export function moquette(draw: (ctx: CanvasRenderingContext2D, n: number) => void, size = 0.2, n = 128, turn = true) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = n;
  draw(cv.getContext('2d')!, n);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / size, 1 / size);
  if (turn) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; }
  t.anisotropy = 4;
  return t;
}

// A plain interior material; the car's own lights are added when the train is built.
export function interiorMat(color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra });
}

// A small emissive screen with its own canvas (passenger information displays).
export function screenTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------------ assembling

// Collects geometry per material key, then turns it into one mesh per key.
export class Parts {
  bins: Map<string, THREE.BufferGeometry[]>;
  constructor() { this.bins = new Map(); }
  add(key: string, ...geos: (THREE.BufferGeometry | THREE.BufferGeometry[])[]) {
    if (!this.bins.has(key)) this.bins.set(key, []);
    this.bins.get(key)!.push(...geos.flat());
    return this;
  }
  meshes(mats: InteriorMaterials, merge: (list: THREE.BufferGeometry[]) => THREE.BufferGeometry) {
    const out: THREE.Mesh[] = [];
    for (const [key, list] of this.bins) {
      if (!list.length) continue;
      if (!mats[key]) throw new Error(`No interior material "${key}"`);
      out.push(new THREE.Mesh(merge(list), mats[key]));
    }
    return out;
  }
}

// Stretches of floor along one side between doors (and the ends of the saloon), as [a, b].
export function freeStretches(xa: number, xb: number, doors: number[], doorW: number, clear = 0) {
  const out: [number, number][] = [];
  let a = xa;
  for (const d of [...doors].sort((p, q) => p - q)) {
    if (d - doorW / 2 - clear > a) out.push([a, d - doorW / 2 - clear]);
    a = Math.max(a, d + doorW / 2 + clear);
  }
  if (xb > a) out.push([a, xb]);
  return out;
}

// A canvas-textured material for a flat end wall made by endWallGeometry: draw(ctx) paints in
// metres, z from −w to w (as seen from inside the saloon, left to right) and y from y0 to y1.
export function endWallMaterial({ w, y0, y1, ppm = 160, draw }: {
  w: number; y0: number; y1: number; ppm?: number; draw: (ctx: CanvasRenderingContext2D) => void;
}) {
  const W = Math.ceil(2 * w * ppm), H = Math.ceil((y1 - y0) * ppm);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(ppm, 0, 0, -ppm, w * ppm, y1 * ppm);
  draw(ctx);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  // shape UVs are metres: u = shape x, v = y
  t.repeat.set(1 / (2 * w), 1 / (y1 - y0));
  t.offset.set(0.5, -y0 / (y1 - y0));
  return new THREE.MeshStandardMaterial({
    map: t, roughness: 0.6, metalness: 0,
  });
}

// Seat placement for a type: one seat geometry, placed crossways (back at x, facing ±x) or along
// the wall (back to the wall on side s, facing the aisle). Upholstery goes to the material keys
// pan/back, or panY/backY for priority seats; the moulded shell to `shellKey`.
export type Seating = ReturnType<typeof seating>;

export function seating({ F, IW, seat, shellKey = 'shell', wallGap = 0.07 }: { F: number; IW: number; seat: SeatOptions; shellKey?: string; wallGap?: number }) {
  const geo = seatGeometry(seat);
  const put = (parts: Parts, x: number, z: number, yaw: number, priority: boolean) => {
    parts.add(shellKey, place(geo.shell, x, F, z, yaw));
    parts.add(priority ? 'panY' : 'pan', place([geo.cushion[0]], x, F, z, yaw));
    parts.add(priority ? 'backY' : 'back', place([geo.cushion[1]], x, F, z, yaw));
    if (geo.grip.length) parts.add('grip', place(geo.grip, x, F, z, yaw));
  };
  return {
    geo,
    width: seat.width,
    // a seat with its back at x facing +x (dir 1) or −x (dir −1)
    across(parts: Parts, x: number, z: number, dir: number, priority = false) { put(parts, x, z, dir > 0 ? FACE.fwd : FACE.back, priority); },
    // a seat against the wall on side s (±1), centred at x, facing across the car
    along(parts: Parts, x: number, s: number, priority = false) { put(parts, x, s * (IW - wallGap), s > 0 ? FACE.left : FACE.right, priority); },
  };
}
