import * as THREE from 'three';
import { profile, box, merge, corrugationNormalMap, DARK } from './kit';
import type { Painter } from './kit';
import { sideZ } from './doors';
import type { DoorStyle } from './doors';
import type { CarDef, TrainSpec } from './train';

// SL C20 — three-section articulated unit, Adtranz/Bombardier (Kalmar Verkstad), 1997–2004.
// 46.5 m over couplers, 2.90 m wide. Four bogies per unit: two under the middle car, one under
// each cab end; the end cars rest on the middle car at their inner ends. Bare corrugated stainless
// steel below the windows, a black band through the windows, SL-blue doors and cab ends.
// End cars have two double doors per side, the middle car three.
//
// Lengths, door and window positions, heights, the cross-section and the nose are measured from a
// detailed SketchUp model of the C20 (docs/rolling-stock.md), and checked against photos. All
// heights are 0.17 m lower than on the real train, whose floor is 1.17 m above the rail, so that
// the floor is at the game's 1.0 m.

const W = 1.45;
// The lower side leans out to the widest point at 1.5–1.7 m, the window band leans in, then a
// steeper cant and a low, wide roof.
const prof = profile([
  [0, 0.74], [1.338, 0.74, 0.02], [1.376, 1.0], [W, 1.51, 0.08], [W, 1.71, 0.08], [1.434, 1.86, 0.06],
  [1.322, 2.88, 0.1], [1.223, 3.23, 0.15], [1.09, 3.49, 0.1], [0.88, 3.585, 0.1], [0, 3.63],
]);
const T = prof.T;

// the black band through the windows, from just under them to the top of the doors
const BAND0 = 1.82, BAND1 = 3.23;
// window frames and glass
const WIN0 = 1.856, WIN1 = 2.881, GLASS0 = 1.876, GLASS1 = 2.861;
// the blue cab end reaches this far back from the nose
const CAB = 2.075;

const M = {
  roof: { c: '#9aa1a8', r: 0.45, m: 0.75 },
  steel: { c: '#b3b9bf', r: 0.3, m: 0.85 },
  blue: { c: '#0b5fc6', r: 0.32, m: 0.05 },
  black: { c: '#14171b', r: 0.4, m: 0.1 },
  // side glass: `a` is its opacity when the interior shows through; the cab's stays opaque
  glass: { c: '#1b2229', r: 0.05, m: 0.2, e: '#26261f', a: 0.3 },
  glassLit: { c: '#262c32', r: 0.05, m: 0.2, e: '#5e5848', a: 0.34 },
  glassCab: { c: '#1b2229', r: 0.05, m: 0.2, e: '#26261f' },
  glassFront: { c: '#12171c', r: 0.04, m: 0.3, e: '#0b0b0a' },
  grille: { c: '#2b2f34', r: 0.6, m: 0.4 },
  lamp: { c: '#c9cccf', r: 0.3, m: 0.4 },
  bumper: { c: '#3a3e43', r: 0.5, m: 0.4 },
  white: { c: '#f3f5f7', r: 0.4, m: 0 },
  // a doorway: dark from outside, clear when the interior is drawn
  opening: { c: '#0b0d10', r: 0.9, m: 0, a: 0 },
};

export const DOOR = 1.6; // double door, outer width

export interface C20Car extends CarDef {
  // equipment boxes under the floor as [x0, x1, half-depth], and the side skirts that hide them
  under: [number, number, number][];
  skirts: [number, number][];
}

// Window frames: 1.1 m wide, 0.45 m from the door frames and the car ends, two to a bay with a
// 0.5 m pier between them. The cab end has one, behind the grille.
function windowFrames(def: CarDef, x0: number, x1: number) {
  const out: [number, number][] = [];
  const fill = (a: number, b: number) => {
    const n = Math.round((b - a + 0.5) / 1.6);
    if (n < 1 || b - a < 1.0) return;
    const w = Math.min(1.1, b - a), gap = n > 1 ? (b - a - n * w) / (n - 1) : 0;
    const start = n > 1 ? a : (a + b - w) / 2;
    for (let i = 0; i < n; i++) out.push([start + i * (w + gap), start + i * (w + gap) + w]);
  };
  let a = x0 + 0.45;
  for (const d of [...def.doors].sort((p, q) => p - q)) {
    fill(a, d - DOOR / 2 - 0.45);
    a = d + DOOR / 2 + 0.45;
  }
  fill(a, def.cab ? x1 - CAB - 0.25 : x1 - 0.45);
  return out;
}

// Window glass, [a, b] along the car, 2 cm inside the frames. The interior cuts its windows from
// the same list.
export function windowPanes(def: CarDef, x0: number, x1: number) {
  return windowFrames(def, x0, x1).map(([a, b]): [number, number] => [a + 0.02, b - 0.02]);
}

// t on the roof at a distance z from the centre line
function roofT(z: number) {
  const top = prof.pts.filter((p) => p.y > 3.4);
  for (let i = 1; i < top.length; i++) {
    const a = top[i - 1], b = top[i];
    if (b.z <= z) return a.t + ((a.z - z) / (a.z - b.z || 1)) * (b.t - a.t);
  }
  return prof.tMax;
}

function paintSide(p: Painter, def: CarDef, x0: number, x1: number) {
  const X = (dx: number) => x1 - dx; // distance back from the cab nose
  p.rectT(x0, x1, prof.tMin, prof.tMax, M.roof);
  p.rect(x0, x1, 0.6, BAND0, M.steel);
  // a steel bead under the band, the band, and the satin cant above it
  p.rect(x0, x1, 1.76, BAND0, M.roof);
  p.rect(x0, x1, BAND0, BAND1, M.black);
  p.rect(x0, x1, 0.6, 0.76, M.black);

  const frames = windowFrames(def, x0, x1);
  for (const [a, b] of frames) {
    p.rect(a, b, WIN0, WIN1, M.black, 0.07);
    p.rect(a + 0.02, b - 0.02, GLASS0, GLASS1, M.glass, 0.06);
    p.rect(a + 0.07, b - 0.07, 2.8, 2.84, M.glassLit);
  }
  if (def.cab) {
    // a small SL roundel on the pier between the windows of the bay behind the first door
    const [d1, d2] = [...def.doors].sort((p, q) => q - p);
    const pier = frames.filter(([a, b]) => a > d2 && b < d1).sort((p, q) => p[0] - q[0]);
    if (pier.length === 2) p.logo((pier[0][1] + pier[1][0]) / 2, 2.37, 0.17, M.white);
  }
  for (const d of def.doors) {
    const a = d - DOOR / 2, b = d + DOOR / 2;
    p.rectT(a, b, T(BAND1), roofT(1.04), M.blue); // blue cap on the cant above each door
    p.frame(a - 0.022, b + 0.022, 0.93, BAND1 + 0.012, 0.022, M.black);
    p.rect(a, b, 0.95, BAND1, M.opening);
  }
  if (def.cab) {
    // the blue cab end: below the band, over the cant and the roof
    p.rect(X(CAB), x1, 0.76, BAND0, M.blue);
    p.rectT(X(CAB), x1, T(BAND1), prof.tMax, M.blue);
    // the black band sweeps down round the cab side window to the lamp band at the front
    p.poly([[X(1.075), BAND0], [X(1.0), 1.71], [X(0.75), 1.62], [X(0.5), 1.47], [X(0.25), 1.34], [x1, 1.24],
      [x1, 3.5], [X(0.6), 3.3], [X(0.9), 3.18], [X(1.075), BAND1]], M.black);
    p.poly([[X(0.35), 1.62], [X(0.9), 1.72], [X(0.9), 2.95], [X(0.82), 2.97]], M.glassCab);
    // driver's door: blue below the band with a handle, a window in the band
    p.frame(X(1.775), X(1.075), 0.95, BAND1, 0.02, M.black);
    p.rect(X(1.685), X(1.165), WIN0, WIN1, M.black, 0.06);
    p.rect(X(1.665), X(1.185), GLASS0, GLASS1, M.glassCab, 0.05);
    p.rect(X(1.16), X(1.12), 1.28, 1.42, M.black, 0.01);
    // ventilation grille behind it
    p.rect(X(2.005), X(1.845), WIN0, WIN1, M.grille);
    for (let y = WIN0 + 0.04; y < WIN1 - 0.03; y += 0.05) p.rect(X(2.0), X(1.85), y, y + 0.02, M.black);
    // the cab's air conditioner, flush with the roof over the first window, with a rain guard at
    // each end
    p.rectT(X(3.645), X(2.275), roofT(0.8), prof.tMax, { c: '#80878e', r: 0.5, m: 0.6 });
    for (let x = 2.4; x < 3.55; x += 0.08) p.rectT(X(x + 0.03), X(x), roofT(0.7), roofT(0.15), M.grille);
    for (const x of [2.265, 3.655]) p.rectT(X(x + 0.012), X(x - 0.012), roofT(0.88), prof.tMax, M.black);
    p.text(X(1.42), 3.4, def.name!, 0.13, M.white, { font: 'italic 600 {px}px Georgia, serif' });
    p.text(X(2.6), 3.4, def.number, 0.15, M.black);
  } else if (def.number) {
    p.text(x1 - 1.0, 3.4, def.number, 0.13, M.black);
  }
}

function paintFront(p: Painter, def: CarDef) {
  p.rect(-1.6, 1.6, 0.6, 3.75, M.blue);
  // windscreen: one black frame round three panes, the middle one the emergency door, and the
  // destination display above them
  p.rect(-1.14, 1.14, 1.54, 3.5, M.black, 0.28);
  p.rect(-1.05, 1.05, 1.79, 2.92, M.glassFront, 0.1);
  p.rect(-0.43, 0.43, 1.62, 2.95, M.glassFront, 0.04);
  p.rect(-0.47, -0.43, 1.62, 2.95, M.black);
  p.rect(0.43, 0.47, 1.62, 2.95, M.black);
  // wipers parked along the bottom of the outer panes
  p.poly([[-1.0, 1.84], [-0.55, 1.84], [-0.55, 1.86], [-1.0, 1.865]], M.black);
  p.poly([[0.55, 1.84], [1.0, 1.84], [1.0, 1.865], [0.55, 1.86]], M.black);
  // the lamp band, which sweeps up at the corners round the cab side windows
  for (const s of [-1, 1]) {
    p.poly([[0, 1.24], [s * 1.0, 1.24], [s * 1.2, 1.3], [s * 1.35, 1.45], [s * 1.6, 1.62], [s * 1.6, 3.3], [s * 1.43, 3.2],
      [s * 1.36, 2.9], [s * 1.2, 1.7], [s * 1.08, 1.42], [0, 1.42]], M.black);
    p.poly([[s * 1.24, 1.66], [s * 1.6, 1.74], [s * 1.6, 2.95], [s * 1.42, 2.92], [s * 1.36, 2.7]], M.glassCab);
    // the lamp units: a grey housing with the round headlight and the tail light
    p.rect(s * 0.34, s * 0.71, 1.25, 1.41, M.lamp, 0.02);
  }
  p.logo(0.62, 1.07, 0.26, M.white);
  p.text(-0.42, 1.48, def.number, 0.09, M.white);
  // the ribbed buffer beam
  p.rect(-1.3, 1.3, 0.8, 0.95, M.bumper, 0.03);
  for (let y = 0.82; y < 0.94; y += 0.03) p.rect(-1.28, 1.28, y, y + 0.012, M.black);
}

// Blue sliding leaves, black-edged, with a window each as tall as the side windows.
const doors: DoorStyle = {
  width: DOOR, y0: 0.95, y1: BAND1, plug: 0.045,
  outside(p, w) {
    p.rect(0, w, 0.95, BAND1, M.blue);
    p.rect(w - 0.022, w, 0.95, BAND1, M.black);
    p.rect(0, w, 0.95, 0.972, M.black);
    p.rect(0, w, BAND1 - 0.022, BAND1, M.black);
    p.rect(0, 0.01, 0.95, BAND1, M.black);
    p.rect(0.13, 0.63, WIN0, WIN1, M.black, 0.06);
    p.rect(0.15, 0.61, GLASS0, GLASS1, M.glass, 0.05);
    p.rect(0.19, 0.57, 2.8, 2.84, M.glassLit);
  },
};

// Lower side panels are corrugated: separate panels with a tiling normal map, under the windows.
let corrMat: THREE.MeshStandardMaterial | undefined;
function corrugation(def: CarDef, x0: number, x1: number) {
  corrMat ??= new THREE.MeshStandardMaterial({
    color: 0xb6bcc2, roughness: 0.3, metalness: 0.85, normalMap: corrugationNormalMap(),
    normalScale: new THREE.Vector2(1, 1),
  });
  const ya = 1.0, yb = 1.76, period = 0.05;
  const end = def.cab ? x1 - CAB - 0.08 : x1 - 0.06;
  const spans: [number, number][] = [];
  let a = x0 + 0.06;
  for (const d of [...def.doors].sort((p, q) => p - q)) {
    if (d - DOOR / 2 - 0.08 > a) spans.push([a, d - DOOR / 2 - 0.08]);
    a = d + DOOR / 2 + 0.08;
  }
  if (end > a) spans.push([a, end]);
  // the panels stand just proud of the side, following its lean
  const rows = [ya, 1.25, 1.51, 1.71, yb];
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const s of [1, -1]) {
    for (const [xa, xb] of spans) {
      const i = pos.length / 3;
      for (const y of rows) {
        const z = s * (sideZ(prof, y) + 0.006), v = (y - ya) / period;
        pos.push(xa, y, z, xb, y, z);
        uv.push(0, v, xb - xa, v);
      }
      for (let r = 0; r < rows.length - 1; r++) {
        const a = i + r * 2, b = a + 1, c = a + 2, d = a + 3;
        if (s > 0) idx.push(a, b, d, a, d, c);
        else idx.push(a, d, b, a, c, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, corrMat);
}

const skirtMat = new THREE.MeshStandardMaterial({ color: 0x8e959c, roughness: 0.4, metalness: 0.7 });

// A panel low on one corner of the nose (side s), between z = 0.72 and 1.3, its front edge
// following the nose in plan.
function cornerSkirt(xFront: (z: number) => number, xBack: number, s: number, y0: number, y1: number, seg = 10) {
  const sh = new THREE.Shape();
  // drawn in (x, −z) so that rotating the extrusion up maps the shape onto the ground plane
  sh.moveTo(xBack, -s * 0.72);
  for (let i = 0; i <= seg; i++) {
    const z = s * (0.72 + (0.58 * i) / seg);
    sh.lineTo(xFront(z), -z);
  }
  sh.lineTo(xBack, -s * 1.3);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  g.computeVertexNormals();
  return g;
}

function extras(def: C20Car, x0: number, x1: number) {
  const out: THREE.Object3D[] = [corrugation(def, x0, x1)];
  // underframe equipment boxes, mostly hidden behind the stainless side skirts
  const parts = [], skirts = [];
  for (const [a, b, d] of def.under) parts.push(box(b - a, 0.43, 2 * d, (a + b) / 2, 0.57, 0));
  for (const [a, b] of def.skirts) {
    for (const s of [-1, 1]) skirts.push(box(b - a, 0.34, 0.04, (a + b) / 2, 0.525, s * 1.27));
  }
  // the floor's edge under the body
  const sx1 = def.cab ? x1 - 0.9 : x1 - 0.05;
  parts.push(box(sx1 - x0 - 0.05, 0.06, 2.6, (sx1 + x0 + 0.05) / 2, 0.71, 0));
  out.push(new THREE.Mesh(merge(parts), DARK.bogie));
  if (def.cab) {
    // stainless panels low on the nose corners, either side of the coupler
    const f = C20.nose.face;
    for (const s of [-1, 1]) skirts.push(cornerSkirt((z) => x1 - f(z, 0.9) - 0.1, x1 - 1.9, s, 0.36, 0.74));
    // the life guards ahead of the leading wheels
    const lg = [];
    for (const s of [-1, 1]) lg.push(box(0.04, 0.6, 0.4, x1 - 1.9, 0.33, s * 0.9));
    out.push(new THREE.Mesh(merge(lg), DARK.bogie));
  }
  out.push(new THREE.Mesh(merge(skirts), skirtMat));
  return out;
}

// End car: 14.275 m from the nose to the gangway, cab at +x, its bogie 3.58 m behind the nose; the
// inner end rides on the middle car. Middle car: 16.0 m with a bogie at each end, 11.51 m apart.
// Gangways 0.8 m. Door centres 5.2 m apart.
const A_LEN = 14.275, HALF = A_LEN / 2;
const cars: Record<string, C20Car> = {
  A: {
    length: A_LEN, cab: true, number: '2201A', name: 'Ivo',
    doors: [HALF - 4.675, HALF - 9.875],
    bogies: [HALF - 3.584],
    under: [[-7.0, -5.2, 1.1], [-4.6, -3.0, 1.1], [-2.6, -0.5, 1.1], [0.0, 1.7, 1.1]],
    skirts: [[-HALF + 0.02, HALF - 5.085]],
  },
  C: {
    length: 16.0, cab: false, number: '2201C',
    doors: [-5.2, 0, 5.2],
    bogies: [-5.755, 5.755],
    under: [[-3.7, -1.7, 1.1], [-1.4, 1.2, 1.1], [1.6, 3.4, 1.1]],
    skirts: [[-4.25, 4.25], [-7.98, -7.26], [7.26, 7.98]],
  },
};

export const C20: TrainSpec = {
  id: 'C20',
  title: 'C20',
  prof,
  nose: {
    k: 0.05, R: 0.1, cy: 2.2,
    // rounded in plan, the windscreen leaning back above the lamp band and rounding into the roof
    face: (z, y) => {
      const u = Math.min(1, Math.abs(z) / W);
      return 0.2 * u ** 2 + 0.55 * u ** 4 + (y > 1.63 ? 0.2 * (y - 1.63) + 0.25 * Math.max(0, y - 2.9) ** 2 : 0);
    },
  },
  cars,
  formation: [['A', false], ['C', false], ['A', true]],
  gap: 0.8,
  unitGap: 0.35,
  bellows: { scale: 0.97, pleat: 0.06, depth: 0.03 },
  endColor: 0x5f666d,
  bogie: { wheelbase: 2.3, wheelR: 0.39, inside: false },
  coupler: { len: 0.6, y: 0.59, setback: 0.62 },
  sign: { y: 3.28, w: 1.1, h: 0.17 },
  lights: [
    { kind: 'head', z: 0.62, y: 1.33, w: 0.12, h: 0.12, round: true },
    { kind: 'head', z: -0.62, y: 1.33, w: 0.12, h: 0.12, round: true },
    { kind: 'tail', z: 0.44, y: 1.33, w: 0.15, h: 0.1 },
    { kind: 'tail', z: -0.44, y: 1.33, w: 0.15, h: 0.1 },
  ],
  doors,
  paintSide, paintFront, extras,
};
