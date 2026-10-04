import * as THREE from 'three';
import { profile, box, merge, noseSkirtGeometry, DARK } from './kit';

// SL C30 — Bombardier (now Alstom) MOVIA, built in Hennigsdorf, in service from 2020.
// Four-car unit A1–B1–B2–A2, 70.0 m over couplers, 2.915 m wide. Each 16.756 m car has its own
// two FLEXX Eco inside-frame bogies; full-width open gangways with bellows join the cars. Smooth
// painted aluminium: white body, SL-blue plug doors, rounded black-framed windows, a dark lower
// skirt, and a white cab with a big black window frame ringed by an LED light collar.

const W = 1.4575;
const prof = profile([[0, 0.95], [W, 0.95, 0.06], [W, 1.9, 0.9], [1.385, 3.1, 0.32], [1.05, 3.68, 0.55], [0, 3.75]]);
const T = prof.T;

const M = {
  white: { c: '#eceeef', r: 0.32, m: 0 },
  roof: { c: '#d5d9dc', r: 0.45, m: 0 },
  blue: { c: '#0e52bd', r: 0.3, m: 0 },
  black: { c: '#121417', r: 0.35, m: 0.05 },
  skirt: { c: '#4b5157', r: 0.5, m: 0.1 },
  // side glass: `a` is its opacity when the interior shows through
  glass: { c: '#1b2229', r: 0.05, m: 0.2, e: '#26261f', a: 0.3 },
  glassLit: { c: '#262c32', r: 0.05, m: 0.2, e: '#5e5848', a: 0.34 },
  glassFront: { c: '#11161b', r: 0.04, m: 0.3, e: '#0b0b0a' },
  collar: { c: '#e8eef3', r: 0.2, m: 0, e: '#8fa5ba' },
  seam: { c: '#c3c8cc', r: 0.4, m: 0 },
  mark: { c: '#1d2126', r: 0.4, m: 0 },
};

export const DOOR = 1.56;

// Window frames between the doors, as [a, b] along the car (the glass is 5 cm inside the frame).
// The interior cuts its window openings from the same list.
function windowsBetween(out, xa, xb) {
  const post = 0.32, max = 1.65;
  const n = Math.max(1, Math.ceil((xb - xa + post) / (max + post)));
  const w = (xb - xa - post * (n - 1)) / n;
  for (let i = 0; i < n; i++) out.push([xa + i * (w + post), xa + i * (w + post) + w]);
}

export function windowFrames(def, x0, x1) {
  const out = [];
  const doors = [...def.doors].sort((a, b) => a - b);
  let a = x0 + 0.42;
  const end = def.cab ? x1 - 2.3 : x1 - 0.42;
  for (const d of doors) {
    if (d - DOOR / 2 - 0.3 - a > 0.6) windowsBetween(out, a, d - DOOR / 2 - 0.3);
    a = d + DOOR / 2 + 0.3;
  }
  if (end - a > 0.6) windowsBetween(out, a, end);
  return out;
}

function paintSide(p, def, x0, x1) {
  const X = (dx) => x1 - dx;
  p.rectT(x0, x1, prof.tMin, prof.tMax, M.roof);
  p.rect(x0, x1, 0.6, 3.12, M.white);
  p.rect(x0, x1, 0.6, 1.0, M.skirt);
  p.rect(x0, x1, 3.12, 3.135, M.seam);

  const doors = [...def.doors].sort((a, b) => a - b);
  for (const [a, b] of windowFrames(def, x0, x1)) {
    p.rect(a, b, 1.9, 2.93, M.black, 0.16);
    p.rect(a + 0.05, b - 0.05, 1.95, 2.88, M.glass, 0.12);
    p.rect(a + 0.12, b - 0.12, 2.8, 2.86, M.glassLit);
  }

  for (const d of doors) {
    const da = d - DOOR / 2, db = d + DOOR / 2;
    p.rect(da - 0.025, db + 0.025, 0.97, 3.065, M.black, 0.17);
    p.rect(da, db, 0.99, 3.04, M.blue, 0.15);
    p.rect(d - 0.012, d + 0.012, 0.99, 3.04, M.black);
    for (const s of [-1, 1]) {
      const c = d + s * DOOR / 4;
      p.rect(c - 0.25, c + 0.25, 1.48, 2.9, M.black, 0.12);
      p.rect(c - 0.21, c + 0.21, 1.52, 2.86, M.glass, 0.09);
    }
  }
  if (def.cab) {
    // cab side window: a dark slot just behind the nose; then the driver's door outline
    p.rect(X(1.18), X(0.6), 1.92, 3.2, M.black, 0.1);
    p.frame(X(2.05), X(1.38), 0.99, 3.02, 0.012, M.seam, 0.05);
    p.rect(X(1.95), X(1.5), 2.05, 2.85, M.black, 0.08);
    p.text(X(2.05) - 0.9, 3.28, def.number, 0.14, M.mark, { font: 'italic 700 {px}px Arial, Helvetica, sans-serif' });
  } else {
    p.text(x1 - 1.2, 3.28, def.number, 0.14, M.mark, { font: 'italic 700 {px}px Arial, Helvetica, sans-serif' });
  }
  p.text(x0 + 1.0, 1.12, `C30-${def.number}`, 0.07, M.white, { font: '600 {px}px Arial, Helvetica, sans-serif' });
}

function paintFront(p, def) {
  p.rect(-1.6, 1.6, 0.8, 3.8, M.white);
  p.rect(-1.6, 1.6, 0.8, 1.2, M.skirt);
  p.rect(-1.1, 1.1, 1.64, 3.5, M.collar, 0.34);
  p.rect(-1.045, 1.045, 1.69, 3.45, M.black, 0.3);
  p.rect(-0.93, 0.93, 1.83, 3.08, M.glassFront, 0.17);
  // cab side windows, seen at the corners
  for (const s of [-1, 1]) p.rect(s * 1.24, s * 1.62, 1.92, 3.2, M.black, 0.06);
  // light clusters below the frame corners
  for (const s of [-1, 1]) p.rect(s * 0.98, s * 1.2, 1.28, 1.64, M.black, 0.05);
  p.logo(0, 1.76, 0.12, M.white);
  p.text(-0.62, 1.52, def.number, 0.09, M.mark, { font: 'italic 700 {px}px Arial, Helvetica, sans-serif' });
  // coupler pocket
  p.rect(-0.38, 0.38, 0.8, 1.1, M.black, 0.06);
}

const skirtMat = new THREE.MeshStandardMaterial({ color: 0x4b5157, roughness: 0.55, metalness: 0.15 });

function extras(def, x0, x1) {
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
    skirt.push(noseSkirtGeometry((z) => x1 - f(z, 0.95) - 0.42 - 0.3 * (z / W) ** 4, x1 - 1.9, 1.4, 0.48, 0.97));
  }
  out.push(new THREE.Mesh(merge(skirt), skirtMat));
  return out;
}

// B cars are the listed 16.756 m. The cab cars are taken a little longer so that the unit comes
// to the listed 70.0 m over couplers.
const A_LEN = 17.3, HALF = A_LEN / 2;
const cars = {
  A: {
    length: A_LEN, cab: true, number: '2303A1',
    doors: [HALF - 4.5, HALF - 9.75, HALF - 15.0],
    bogies: [-5.5, 5.5],
  },
  B: {
    length: 16.756, cab: false, number: '2303B1',
    doors: [-5.35, 0, 5.35],
    bogies: [-5.5, 5.5],
  },
  B2: {
    length: 16.756, cab: false, number: '2303B2',
    doors: [-5.35, 0, 5.35],
    bogies: [-5.5, 5.5],
  },
};

export const C30 = {
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
  gap: 0.6,
  unitGap: 0.3,
  bellows: { scale: 0.975, pleat: 0.045, depth: 0.035 },
  endColor: 0x9aa0a6,
  bogie: { wheelbase: 1.9, wheelR: 0.39, inside: true },
  coupler: { len: 0.75, y: 0.74, setback: 0.85 },
  sign: { y: 3.25, w: 1.45, h: 0.22 },
  lights: [
    { kind: 'head', z: 1.09, y: 1.53, w: 0.15, h: 0.15 },
    { kind: 'head', z: -1.09, y: 1.53, w: 0.15, h: 0.15 },
    { kind: 'tail', z: 1.09, y: 1.37, w: 0.15, h: 0.1 },
    { kind: 'tail', z: -1.09, y: 1.37, w: 0.15, h: 0.1 },
  ],
  paintSide, paintFront, extras,
};
