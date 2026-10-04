import * as THREE from 'three';
import { profile, box, merge, corrugationNormalMap, noseSkirtGeometry, DARK } from './kit';

// SL C20 — three-section articulated unit, Adtranz/Bombardier (Kalmar Verkstad), 1997–2004.
// 46.5 m over couplers, 2.90 m wide, 3.68 m high. Four bogies per unit: two under the middle car,
// one under each cab end; the end cars rest on the middle car at their inner ends. Bare corrugated
// stainless steel sides, SL-blue doors and cab ends, a black window band wrapping round the cab.
// End cars have two double doors per side, the middle car three.

const W = 1.45;
const prof = profile([[0, 0.93], [W, 0.93, 0.05], [W, 1.95, 0.6], [1.39, 3.02, 0.25], [1.1, 3.6, 0.45], [0, 3.68]]);
const T = prof.T;

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
  white: { c: '#f3f5f7', r: 0.4, m: 0 },
};

export const DOOR = 1.6; // double door, outer width

// Window panes between doors: split each free stretch into equal panes no wider than `max`.
function panes(xa, xb, max = 1.8, post = 0.12) {
  const n = Math.max(1, Math.ceil((xb - xa + post) / (max + post)));
  const w = (xb - xa - post * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => [xa + i * (w + post), xa + i * (w + post) + w]);
}

function freeSpans(from, to, doors) {
  const spans = [];
  let a = from;
  for (const d of [...doors].sort((p, q) => p - q)) {
    if (d - DOOR / 2 - 0.22 > a) spans.push([a, d - DOOR / 2 - 0.22]);
    a = d + DOOR / 2 + 0.22;
  }
  if (to > a) spans.push([a, to]);
  return spans.filter(([p, q]) => q - p > 0.5);
}

// Window panes (the glass, [a, b] along the car). The interior cuts its windows from the same list.
export function windowPanes(def, x0, x1) {
  const passengerEnd = def.cab ? x1 - 3.45 : x1 - 0.3;
  return freeSpans(x0 + 0.3, passengerEnd, def.doors).flatMap(([a, b]) => panes(a, b));
}

function paintSide(p, def, x0, x1) {
  const X = (dx) => x1 - dx; // distance back from the cab nose
  p.rectT(x0, x1, prof.tMin, prof.tMax, M.roof);
  p.rect(x0, x1, 0.6, 3.06, M.steel);
  p.rect(x0, x1, 0.6, 0.975, M.black);
  // drip rail and roof seam
  p.rect(x0, x1, 3.03, 3.06, M.roof);

  for (const [pa, pb] of windowPanes(def, x0, x1)) {
    p.rect(pa - 0.04, pb + 0.04, 1.89, 2.92, M.black, 0.07);
    p.rect(pa, pb, 1.93, 2.88, M.glass, 0.05);
    p.rect(pa + 0.05, pb - 0.05, 2.8, 2.86, M.glassLit);
  }
  for (const d of def.doors) {
    const a = d - DOOR / 2, b = d + DOOR / 2;
    p.rect(a, b, 0.95, 3.0, M.blue);
    p.rectT(a, b, T(3.0), T(3.38), M.blue); // blue cap on the cant above each door
    p.frame(a, b, 0.95, 3.0, 0.022, M.black);
    p.rect(d - 0.01, d + 0.01, 0.95, 3.0, M.black);
    for (const s of [-1, 1]) {
      const c = d + s * DOOR / 4;
      p.rect(c - 0.23, c + 0.23, 1.7, 2.88, M.black, 0.06);
      p.rect(c - 0.2, c + 0.2, 1.73, 2.85, M.glass, 0.05);
      p.rect(c - 0.17, c + 0.17, 2.77, 2.83, M.glassLit);
    }
  }
  if (def.cab) {
    p.rect(X(3.12), x1, 0.6, 3.06, M.blue);
    p.rectT(X(3.12), x1, T(3.0), T(3.42), M.blue);
    p.rectT(X(2.3), x1, T(3.3), prof.tMax, M.blue); // the blue wraps over the cab roof
    p.rect(X(3.12), x1, 0.6, 0.975, M.black);
    // the black band: from the light band at the nose, up and back round the cab side window
    p.poly([[x1, 1.52], [X(1.6), 1.58], [X(2.15), 1.72], [X(2.42), 2.05], [X(2.42), 3.12], [X(1.1), 3.3],
      [X(0.62), 1.86], [x1, 1.8]], M.black);
    p.poly([[X(2.3), 2.0], [X(2.3), 2.98], [X(1.2), 3.12], [X(0.9), 2.02]], M.glassCab);
    // driver's door
    p.frame(X(3.06), X(2.5), 0.97, 3.0, 0.02, M.black);
    p.rect(X(2.96), X(2.6), 2.02, 2.86, M.glassCab, 0.05);
    p.rect(X(2.66), X(2.6), 1.83, 1.93, M.steel);
    // ventilation grille behind the cab
    p.rect(X(3.38), X(3.18), 1.55, 2.95, M.grille);
    for (let y = 1.6; y < 2.92; y += 0.05) p.rect(X(3.38), X(3.18), y, y + 0.02, M.black);
    p.text(X(1.65), 3.23, def.number, 0.15, M.white);
    p.text(X(2.75), 3.25, def.name, 0.13, M.white, { font: 'italic 600 {px}px Georgia, serif' });
  } else if (def.number) {
    p.text(x1 - 1.2, 3.16, def.number, 0.13, M.black);
  }
}

function paintFront(p, def) {
  p.rect(-1.6, 1.6, 0.8, 3.75, M.blue);
  p.rect(-1.19, 1.19, 1.9, 3.44, M.black, 0.14);
  p.rect(-1.09, 1.09, 1.99, 3.07, M.glassFront, 0.09);
  p.rect(-0.45, -0.4, 1.99, 3.07, M.black);
  p.rect(0.4, 0.45, 1.99, 3.07, M.black);
  // wipers parked along the bottom of the outer panes
  p.poly([[-1.0, 2.06], [-0.55, 2.06], [-0.55, 2.08], [-1.0, 2.085]], M.black);
  p.poly([[0.55, 2.06], [1.0, 2.06], [1.0, 2.085], [0.55, 2.08]], M.black);
  p.rect(-1.6, 1.6, 1.52, 1.8, M.black);
  p.rect(-1.6, 1.6, 0.8, 1.06, M.black);
  p.logo(0.72, 1.3, 0.32, M.white);
  p.text(-0.25, 1.86, def.number, 0.1, M.white);
}

// Lower side panels are corrugated: separate panels with a tiling normal map.
let corrMat;
function corrugation(def, x0, x1) {
  corrMat ??= new THREE.MeshStandardMaterial({
    color: 0xb6bcc2, roughness: 0.3, metalness: 0.85, normalMap: corrugationNormalMap(),
    normalScale: new THREE.Vector2(1, 1),
  });
  const ya = 1.0, yb = 1.86, period = 0.05;
  const end = def.cab ? x1 - 3.42 : x1 - 0.06;
  const spans = [];
  let a = x0 + 0.06;
  for (const d of [...def.doors].sort((p, q) => p - q)) {
    if (d - DOOR / 2 - 0.02 > a) spans.push([a, d - DOOR / 2 - 0.02]);
    a = d + DOOR / 2 + 0.02;
  }
  if (end > a) spans.push([a, end]);
  const pos = [], uv = [], idx = [];
  for (const s of [1, -1]) {
    const z = s * (W + 0.004);
    for (const [xa, xb] of spans) {
      const i = pos.length / 3;
      pos.push(xa, ya, z, xb, ya, z, xb, yb, z, xa, yb, z);
      uv.push(0, 0, xb - xa, 0, xb - xa, (yb - ya) / period, 0, (yb - ya) / period);
      if (s > 0) idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
      else idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, corrMat);
}


function extras(def, x0, x1) {
  const out = [corrugation(def, x0, x1)];
  // underframe equipment boxes between the bogies
  const parts = [];
  for (const [a, b, h, d] of def.under) {
    parts.push(box(b - a, h, d, (a + b) / 2, 0.93 - h / 2, 0));
  }
  // solebar along the bottom edge, stopping short of the nose
  const sx1 = def.cab ? x1 - 1.1 : x1 - 0.1;
  parts.push(box(sx1 - x0 - 0.1, 0.12, 2.82, (sx1 + x0 + 0.1) / 2, 0.88, 0));
  out.push(new THREE.Mesh(merge(parts), DARK.bogie));
  if (def.cab) {
    // obstacle deflector under the nose, following its curve in plan
    const f = C20.nose.face;
    const g = noseSkirtGeometry((z) => x1 - f(z, 0.93) - 0.3 - 0.35 * (z / W) ** 4, x1 - 1.2, 1.3, 0.42, 0.95);
    out.push(new THREE.Mesh(g, DARK.bogie));
  }
  return out;
}

const cars = {
  // end car, cab at +x. Bogie under the cab; the inner end rides on the middle car.
  A: {
    length: 14.9, cab: true, number: '2201A', name: 'Ivo',
    doors: [7.45 - 5.25, 7.45 - 10.65],
    bogies: [7.45 - 2.4],
    under: [[-7.2, -4.4, 0.42, 2.3], [-4.1, -0.6, 0.5, 2.4], [-0.3, 3.5, 0.38, 2.2]],
  },
  // middle car with a bogie at each end
  C: {
    length: 16.1, cab: false, number: '2201C',
    doors: [-5.45, 0, 5.45],
    bogies: [-6.5, 6.5],
    under: [[-5.0, -1.4, 0.48, 2.4], [-1.0, 2.2, 0.4, 2.2], [2.5, 4.9, 0.5, 2.3]],
  },
};

export const C20 = {
  id: 'C20',
  title: 'C20',
  prof,
  nose: {
    k: 0.2, R: 0.32, cy: 2.3,
    face: (z, y) => 0.18 * (z / W) ** 2 + (y > 2.0 ? 0.5 * ((y - 2.0) / 1.68) ** 1.5 : 0),
  },
  cars,
  formation: [['A', false], ['C', false], ['A', true]],
  gap: 0.25,
  unitGap: 0.3,
  bellows: { scale: 0.9, pleat: 0.05, depth: 0.03 },
  endColor: 0x5f666d,
  bogie: { wheelbase: 2.0, wheelR: 0.39, inside: false },
  coupler: { len: 0.6, y: 0.74, setback: 0.62 },
  sign: { y: 3.24, w: 1.1, h: 0.2 },
  lights: [
    { kind: 'head', z: 0.95, y: 1.66, w: 0.15, h: 0.15, round: true },
    { kind: 'head', z: -0.95, y: 1.66, w: 0.15, h: 0.15, round: true },
    { kind: 'tail', z: 1.18, y: 1.66, w: 0.17, h: 0.11 },
    { kind: 'tail', z: -1.18, y: 1.66, w: 0.17, h: 0.11 },
  ],
  paintSide, paintFront, extras,
};
