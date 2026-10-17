import * as THREE from 'three';
import { profile, box, merge, noseSkirtGeometry, DARK } from './kit';
import type { Painter } from './kit';
import type { CarDef, LightDef, TrainSpec } from './train';
import type { DoorStyle } from './doors';

// SL C30 — Bombardier (now Alstom) MOVIA, built in Hennigsdorf, in service from 2020.
// Four-car unit A1–B1–B2–A2, 70.0 m over couplers, 2.915 m wide. Each car has its own two FLEXX
// Eco inside-frame bogies, 11.0 m apart; 0.92 m open gangways with bellows join the cars. Smooth
// painted aluminium: white body, azure plug doors, rounded black-framed windows, a dark lower
// skirt, and a white cab with a big black window frame ringed by an LED light collar, over a grey
// fairing.
//
// Lengths, door, window and bogie positions are from the side view and plan in SL's press
// presentation of the C30 (docs/rolling-stock.md).

const W = 1.4575;
const prof = profile([[0, 0.95], [W, 0.95, 0.06], [W, 1.9, 0.9], [1.385, 3.1, 0.32], [1.05, 3.68, 0.55], [0, 3.75]]);
const T = prof.T;

const M = {
  white: { c: '#eceeef', r: 0.32, m: 0 },
  roof: { c: '#d5d9dc', r: 0.45, m: 0 },
  blue: { c: '#0a6db0', r: 0.3, m: 0 },
  black: { c: '#121417', r: 0.35, m: 0.05 },
  skirt: { c: '#4b5157', r: 0.5, m: 0.1 },
  // the cab's lower fairing and its slatted bumper
  fairing: { c: '#7d7c81', r: 0.5, m: 0.1 },
  slat: { c: '#dedbd7', r: 0.5, m: 0 },
  // side glass: `a` is its opacity when the interior shows through
  glass: { c: '#1b2229', r: 0.05, m: 0.2, e: '#26261f', a: 0.3 },
  glassLit: { c: '#262c32', r: 0.05, m: 0.2, e: '#5e5848', a: 0.34 },
  glassFront: { c: '#11161b', r: 0.04, m: 0.3, e: '#0b0b0a' },
  collar: { c: '#e8eef3', r: 0.2, m: 0, e: '#8fa5ba' },
  seam: { c: '#c3c8cc', r: 0.4, m: 0 },
  mark: { c: '#1d2126', r: 0.4, m: 0 },
  // a doorway: dark from outside, clear when the interior is drawn
  opening: { c: '#0b0d10', r: 0.9, m: 0, a: 0 },
};

export const DOOR = 1.56;

// Window frames, as [a, b] along the car (the glass is 5 cm inside the frame): pairs of 1.26 m
// windows between the doors, 0.6 m from the door leaves with a 0.31 m post between them, and a
// narrow window near each gangway end. None between the cab door and the first door. The interior
// cuts its window openings from the same list.
const WIN = 1.26, POST = 0.31, FROM_DOOR = DOOR / 2 + 0.6;

export function windowFrames(def: CarDef, x0: number, x1: number) {
  const out: [number, number][] = [[x0 + 0.45, x0 + 0.95]];
  const doors = [...def.doors].sort((a, b) => a - b);
  for (let i = 1; i < doors.length; i++) {
    const a = doors[i - 1] + FROM_DOOR, b = doors[i] - FROM_DOOR;
    const n = Math.max(1, Math.round((b - a + POST) / (WIN + POST)));
    const w = (b - a - POST * (n - 1)) / n;
    for (let k = 0; k < n; k++) out.push([a + k * (w + POST), a + k * (w + POST) + w]);
  }
  if (!def.cab) out.push([x1 - 0.95, x1 - 0.45]);
  return out;
}

function paintSide(p: Painter, def: CarDef, x0: number, x1: number) {
  const X = (dx: number) => x1 - dx;
  p.rectT(x0, x1, prof.tMin, prof.tMax, M.roof);
  p.rect(x0, x1, 0.6, 3.12, M.white);
  p.rect(x0, x1, 0.6, 1.0, M.skirt);
  p.rect(x0, x1, 3.12, 3.135, M.seam);

  const doors = [...def.doors].sort((a, b) => a - b);
  for (const [a, b] of windowFrames(def, x0, x1)) {
    const r = b - a < 0.8 ? 0.22 : 0.16;
    p.rect(a, b, 1.9, 2.93, M.black, r);
    p.rect(a + 0.05, b - 0.05, 1.95, 2.88, M.glass, r - 0.04);
    p.rect(a + 0.12, b - 0.12, 2.8, 2.86, M.glassLit);
  }

  for (const d of doors) {
    const da = d - DOOR / 2, db = d + DOOR / 2;
    p.rect(da - 0.025, db + 0.025, 0.97, 3.065, M.black, 0.17);
    p.rect(da, db, 0.99, 3.04, M.opening, 0.15);
  }
  if (def.cab) {
    // cab side window: a dark slot just behind the nose; then the driver's door, with a tall
    // narrow window
    p.rect(X(1.05), X(0.6), 1.92, 3.2, M.black, 0.1);
    p.frame(X(1.91), X(1.095), 0.99, 3.06, 0.012, M.seam, 0.05);
    p.rect(X(1.69), X(1.25), 1.95, 2.85, M.black, 0.08);
    p.text(X(2.9), 3.28, def.number, 0.14, M.mark, { font: 'italic 700 {px}px Arial, Helvetica, sans-serif' });
  } else {
    p.text(x1 - 1.2, 3.28, def.number, 0.14, M.mark, { font: 'italic 700 {px}px Arial, Helvetica, sans-serif' });
  }
  p.text(x0 + 1.0, 1.12, `C30-${def.number}`, 0.07, M.white, { font: '600 {px}px Arial, Helvetica, sans-serif' });
}

function paintFront(p: Painter, def: CarDef) {
  p.rect(-1.6, 1.6, 0.8, 3.8, M.white);
  p.rect(-1.6, 1.6, 0.8, 1.2, M.fairing);
  for (let k = 0; k < 4; k++) p.rect(-0.75, 0.75, 1.0 + k * 0.045, 1.025 + k * 0.045, M.slat, 0.01);
  // the big black frame round the windscreen and the destination sign, up to the roof
  p.rect(-1.13, 1.13, 1.58, 3.78, M.black, 0.36);
  // the LED light collar: a U down both sides of the frame and across its foot, ending below
  // the sign
  p.fill((ctx) => {
    ctx.roundRect(-1.1, 1.61, 2.2, 1.75, 0.333);
    ctx.roundRect(-1.065, 1.645, 2.13, 2.1, 0.298);
  }, M.collar, 'evenodd');
  p.rect(-0.93, 0.93, 2.05, 3.08, M.glassFront, 0.17);
  // cab side windows, seen at the corners
  for (const s of [-1, 1]) p.rect(s * 1.24, s * 1.62, 1.92, 3.2, M.black, 0.06);
  // light clusters below the frame corners
  for (const s of [-1, 1]) p.rect(s * 1.17, s * 1.36, 1.24, 1.62, M.black, 0.04);
  // a big SL roundel lit in the foot of the frame, the unit number on the white below
  p.logo(0, 1.86, 0.3, M.collar);
  p.text(0.72, 1.42, def.number, 0.1, M.mark, { font: 'italic 700 {px}px Arial, Helvetica, sans-serif' });
  // coupler pocket
  p.rect(-0.38, 0.38, 0.8, 1.1, M.black, 0.06);
}

// Blue plug door leaves: on each, black from the centre seal out over the window, which is in the
// leaf's outer part, from about 0.75 to 1.85 m above its foot.
const doors: DoorStyle = {
  width: DOOR, y0: 0.99, y1: 3.04, plug: 0.05,
  outside(p, w) {
    p.rect(-0.2, w, 0.99, 3.04, M.blue, 0.15);
    p.rect(0, 0.012, 0.99, 3.04, M.black);
    p.rect(0.03, w - 0.12, 1.72, 2.86, M.black, 0.1);
    p.rect(0.2, w - 0.16, 1.76, 2.82, M.glass, 0.08);
  },
};

// The LED collar round the windscreen frame, as short pieces along its U over the strip painted
// in paintFront: white when the cab leads, red when it trails.
function collar(kind: 'head' | 'tail') {
  const w = 0.035, z0 = 1.0825, y0 = 1.6275, r = 0.315;
  const out: LightDef[] = [];
  const n = 6, ya = y0 + r, yb = 3.1;
  for (let i = 0; i < n; i++) {
    const h = (yb - ya) / n;
    for (const s of [-1, 1]) out.push({ kind, glow: true, z: s * z0, y: ya + h * (i + 0.5), w, h: h + 0.002 });
  }
  const za = z0 - r;
  for (let i = 0; i < 3; i++) out.push({ kind, glow: true, z: -za + (2 * za * (i + 0.5)) / 3, y: y0, w: (2 * za) / 3 + 0.002, h: w });
  // round the corners with overlapping discs
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * (Math.PI / 2);
    for (const s of [-1, 1]) out.push({ kind, glow: true, round: true, z: s * (za + r * Math.sin(a)), y: ya - r * Math.cos(a), w, h: w });
  }
  return out;
}

const skirtMat = new THREE.MeshStandardMaterial({ color: 0x4b5157, roughness: 0.55, metalness: 0.15 });
const fairingMat = new THREE.MeshStandardMaterial({ color: 0x7d7c81, roughness: 0.5, metalness: 0.1 });

function extras(def: CarDef, x0: number, x1: number) {
  const out = [];
  const under = [], skirt = [];
  const [b0, b1] = def.bogies;
  // equipment boxes and the side skirts that hide them, between the bogies
  under.push(box(b1 - b0 - 3.1, 0.42, 2.4, (b0 + b1) / 2, 0.74, 0));
  const sx1 = def.cab ? x1 - 1.8 : x1 - 0.1;
  under.push(box(sx1 - x0 - 0.1, 0.1, 2.8, (sx1 + x0 + 0.1) / 2, 0.9, 0));
  for (const s of [-1, 1]) {
    skirt.push(box(b1 - b0 - 3.0, 0.42, 0.05, (b0 + b1) / 2, 0.74, s * 1.405));
    if (!def.cab) skirt.push(box(x1 - b1 - 1.6, 0.42, 0.05, x1 - (x1 - b1 - 1.6) / 2 - 0.05, 0.74, s * 1.405));
    skirt.push(box(b0 - x0 - 1.6, 0.42, 0.05, x0 + (b0 - x0 - 1.6) / 2 + 0.05, 0.74, s * 1.405));
  }
  out.push(new THREE.Mesh(merge(under), DARK.bogie));
  if (def.cab) {
    // front skirt under the nose, following its curve in plan
    const f = C30.nose.face;
    out.push(new THREE.Mesh(noseSkirtGeometry((z) => x1 - f(z, 0.95) - 0.42 - 0.3 * (z / W) ** 4, x1 - 1.9, 1.4, 0.48, 0.97), fairingMat));
  }
  out.push(new THREE.Mesh(merge(skirt), skirtMat));
  return out;
}

// From the drawing: 18.246 m from the coupler face to the first gangway's centre, 16.756 m between
// gangway centres, 0.92 m gangways. The nose is 0.35 m behind the coupler face, so a cab car's
// body is 17.436 m and a middle car's 15.836 m. Doors 5.585 m apart, the first 4.283 m from the
// coupler face; bogies 11.0 m apart, the leading one 4.368 m from the coupler face.
const A_LEN = 17.436, HALF = A_LEN / 2, B_LEN = 15.836;
const cars = {
  A: {
    length: A_LEN, cab: true, number: '2303A1',
    doors: [HALF - 3.933, HALF - 9.518, HALF - 15.103],
    bogies: [HALF - 15.018, HALF - 4.018],
  },
  B: {
    length: B_LEN, cab: false, number: '2303B1',
    doors: [-5.585, 0, 5.585],
    bogies: [-5.5, 5.5],
  },
  // the B car turned round, for its seats (c30-interior.ts)
  B2: {
    length: B_LEN, cab: false, number: '2303B2', flip: true,
    doors: [-5.585, 0, 5.585],
    bogies: [-5.5, 5.5],
  },
};

export const C30: TrainSpec = {
  id: 'C30',
  title: 'C30',
  prof,
  nose: {
    k: 0.28, R: 0.5, cy: 2.3,
    face: (z, y) => 0.28 * (z / W) ** 2 + (y > 2.1 ? 0.42 * ((y - 2.1) / 1.65) ** 1.8 : 0)
      + (y < 1.35 ? 0.12 * ((1.35 - y) / 0.4) ** 2 : 0),
  },
  cars,
  formation: [['A', false], ['B', false], ['B2', false], ['A', true]],
  gap: 0.92,
  unitGap: 0.7,
  bellows: { scale: 0.975, pleat: 0.045, depth: 0.035 },
  endColor: 0x9aa0a6,
  bogie: { wheelbase: 1.9, wheelR: 0.39, inside: true },
  coupler: { len: 0.75, y: 0.74, setback: 0.55 },
  sign: { y: 3.25, w: 1.45, h: 0.22 },
  lights: [
    { kind: 'head', z: 1.265, y: 1.52, w: 0.13, h: 0.14 },
    { kind: 'head', z: -1.265, y: 1.52, w: 0.13, h: 0.14 },
    { kind: 'tail', z: 1.265, y: 1.34, w: 0.13, h: 0.14 },
    { kind: 'tail', z: -1.265, y: 1.34, w: 0.13, h: 0.14 },
    ...collar('head'), ...collar('tail'),
  ],
  doors,
  paintSide, paintFront, extras,
};
