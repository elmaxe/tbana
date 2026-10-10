import * as THREE from 'three';
import * as T from '../textures';
import { offset, outward, type Builder, type V2, type V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';

// The five Hötorget towers (Hötorgsskraporna, 1955–66; numbered from Hötorget, by David Helldén,
// Sven Markelius, Anders Tengbom, Lars-Erik Lallerstedt, and Backström & Reinius). Each is two
// slabs side by side and shifted along each other: a deep one to the south-south-west, 61 m high,
// and a shallow one to the north-north-east about two storeys lower, with a set-back storey on it
// against the deep one. Their long sides are curtain walls of glass and aluminium, each tower's in
// its architect's colours; their ends are clad in marble without windows, a glazed slot where the
// slabs meet. Each has its number in blue neon on its end towards Sveavägen, and a plant room on
// its roof. They stand on a glazed ground storey among the low shops of Hötorgscity.
//
// Measured from Lantmäteriet's laser scan (Laserdata Nedladdning, skog, CC BY 4.0; RH 2000): in
// each tower's frame, x along it towards Sveavägen, z across it (the shallow slab at −z), metres.
// The looks are drawn from photographs.

interface Tower {
  n: number;
  at: V2; ground: number; turn: number; // its frame: middle (world x, z), ground (RH 2000), degrees
  shallow: [number, number, number]; shallowTop: number; // x from, to; z of its outer side
  deep: [number, number, number]; deepTop: number;       // x from, to; z of its outer side
  join: number;                                          // z where the slabs meet
  setback: [number, number, number]; setbackTop: number; // x from, to; z of its outer side
  plant: [number, number, number, number]; plantTop: number;
  panel: number;                                         // the curtain wall's panels, m along
  curtain: T.CurtainStyle;
  fins?: boolean;                                        // deep aluminium fins on its long sides
}

const TOWERS_DATA: Tower[] = [
  {
    n: 1, at: [253.65, -345.59], ground: 12.2, turn: 25.17,
    shallow: [-19.3, 19.0, -8.9], shallowTop: 67.1, deep: [-20.7, 23.6, 7.4], deepTop: 73.4, join: -3.0,
    setback: [-13.5, 17.9, -6.2], setbackTop: 70.0, plant: [-14.9, 16.0, -2.1, 4.4], plantTop: 77.8, panel: 1.3,
    // dark green spandrels under bands of glass
    curtain: { spandrel: '#2c4537', share: 0.42, tint: 'rgba(40,80,60,0.12)', frame: '#c4c9c9', mullion: 6 },
  },
  {
    n: 2, at: [266.93, -305.0], ground: 11.6, turn: 24.9,
    shallow: [-19.9, 18.4, -8.4], shallowTop: 67.2, deep: [-20.7, 23.1, 8.4], deepTop: 73.9, join: -2.8,
    setback: [-15.7, 15.1, -5.6], setbackTop: 70.0, plant: [-18.6, 16.0, 0.0, 5.6], plantTop: 77.5, panel: 1.3,
    // blue glass, light bands at the floors
    curtain: { spandrel: '#3b506a', share: 0.3, tint: 'rgba(40,80,160,0.22)', frame: '#cdd3d8', mullion: 5, band: '#d6dadc' },
  },
  {
    n: 3, at: [281.3, -263.79], ground: 10.9, turn: 25.08,
    shallow: [-20.6, 17.5, -9.0], shallowTop: 67.0, deep: [-22.1, 22.5, 8.1], deepTop: 73.4, join: -3.4,
    setback: [-16.6, 14.7, -6.8], setbackTop: 69.8, plant: [-15.3, 15.2, -2.2, 4.8], plantTop: 78.1, panel: 1.3,
    // blue-green glass all over, dark frames
    curtain: { spandrel: '#36575a', share: 0.3, tint: 'rgba(30,100,105,0.2)', frame: '#58646a', mullion: 5 },
  },
  {
    n: 4, at: [293.25, -223.11], ground: 10.7, turn: 24.51,
    shallow: [-18.7, 18.8, -8.6], shallowTop: 67.1, deep: [-21.3, 23.7, 8.8], deepTop: 73.4, join: -3.3,
    setback: [-13.8, 15.5, -6.5], setbackTop: 69.6, plant: [-5.6, 16.2, -1.9, 4.0], plantTop: 76.2, panel: 1.3,
    // light grey spandrels, grey glass
    curtain: { spandrel: '#aab1b2', share: 0.4, tint: 'rgba(60,70,80,0.1)', frame: '#cfd3d4', mullion: 6 },
  },
  {
    n: 5, at: [306.78, -180.18], ground: 10.4, turn: 25.24,
    shallow: [-19.3, 19.3, -9.6], shallowTop: 66.1, deep: [-21.6, 23.7, 8.9], deepTop: 72.6, join: -3.1,
    setback: [-18.9, 19.0, -6.1], setbackTop: 68.7, plant: [-18.5, 11.5, 1.0, 7.6], plantTop: 75.9, panel: 1.5,
    // Sergelskrapan: bronze-anodised aluminium, faded to champagne, in deep fins round tall windows
    curtain: { spandrel: '#b1a68f', share: 0.32, tint: null, frame: '#c4b89c', mullion: 14, inset: 10 },
    fins: true,
  },
];

const GROUND_STOREY = 4.4, STOREY = 3.3, PARAPET = 0.3, INSET = 0.8;
const WHITE: V3 = [1, 1, 1], MARBLE: V3 = [0.97, 0.97, 0.955], SLOT: V3 = [0.62, 0.66, 0.68];
const ALU: V3 = [0.86, 0.87, 0.88], BRONZE: V3 = [0.4, 0.36, 0.31], ROOF: V3 = [0.62, 0.62, 0.6];

for (const t of TOWERS_DATA) {
  addMaterial(`curtain${t.n}`, () => standard(T.curtainWall(t.curtain), 0.35, 0.05));
  addMaterial(`neon${t.n}`, () => {
    const digit = T.neonDigit(String(t.n));
    return standard(digit, 0.5, 0, { alphaTest: 0.35, emissive: new THREE.Color(0x2c5cff), emissiveMap: digit, emissiveIntensity: 1.4 });
  });
}
addMaterial('marble', () => standard(T.marble(), 0.65));

const toWorld = (t: Tower) => {
  const a = (t.turn * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  // Builder.place: x' = x cos + z sin, z' = −x sin + z cos
  return ([x, z]: V2): V2 => [t.at[0] + x * c + z * s, t.at[1] - x * s + z * c];
};

export const TOWERS = TOWERS_DATA.map((t) => {
  const f = toWorld(t);
  const [x0, x1] = [t.deep[0], t.deep[1]], [z0, z1] = [t.shallow[2], t.deep[2]];
  return { tower: t, at: t.at, outline: ([[x0, z0], [x1, z0], [x1, z1], [x0, z1]] as V2[]).map(f) };
});

export function buildTower(B: Builder, t: Tower) {
  B.place([t.at[0], t.ground, t.at[1]], (t.turn * Math.PI) / 180);
  const G = GROUND_STOREY, top1 = t.shallowTop - t.ground, top2 = t.deepTop - t.ground;
  const [sx0, sx1, sz] = t.shallow, [dx0, dx1, dz] = t.deep, j = t.join;
  const curtain = `curtain${t.n}`;
  // a wall from a to b (x, z) between y0 and y1, its panels and storeys counted from the ground
  // storey's top (the texture holds four by four)
  const wall = (a: V2, b: V2, y0: number, y1: number, n: V3, mat: string, tile?: number | V2) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const pts: V3[] = [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]];
    if (tile !== undefined) { B.poly(pts, n, mat, tile); return; }
    const u = len / t.panel / 4, v0 = (y0 - G) / STOREY / 4, v1 = (y1 - G) / STOREY / 4;
    // left to right as seen from outside
    const flip = (b[0] - a[0]) * n[2] - (b[1] - a[1]) * n[0] < 0;
    const [ua, ub] = flip ? [u, 0] : [0, u];
    B.poly(pts, n, mat, 1, [[ua, v0], [ub, v0], [ub, v1], [ua, v1]]);
  };
  const N: V3 = [0, 0, -1], S: V3 = [0, 0, 1], E: V3 = [1, 0, 0], W: V3 = [-1, 0, 0];

  // ---- the ground storey: shop windows set back under the slabs
  const foot: V2[] = [[sx0, sz], [sx1, sz], [sx1, j], [dx1, j], [dx1, dz], [dx0, dz], [dx0, j], [sx0, j]];
  const inner = offset(foot, -INSET);
  B.tint(WHITE);
  const outs = outward(inner);
  inner.forEach((a, i) => {
    const b = inner[(i + 1) % inner.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.5) return;
    const out: V3 = [outs[i][0], 0, outs[i][1]];
    const k = Math.max(1, Math.round(len / 3.2));
    for (let q = 0; q < k; q++) {
      const p0: V2 = [a[0] + ((b[0] - a[0]) * q) / k, a[1] + ((b[1] - a[1]) * q) / k];
      const p1: V2 = [a[0] + ((b[0] - a[0]) * (q + 1)) / k, a[1] + ((b[1] - a[1]) * (q + 1)) / k];
      const flip = (p1[0] - p0[0]) * out[2] - (p1[1] - p0[1]) * out[0] < 0;
      B.poly([[p0[0], -0.6, p0[1]], [p1[0], -0.6, p1[1]], [p1[0], G, p1[1]], [p0[0], G, p0[1]]], out, 'shop', 1,
        flip ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  });
  B.tint([0.86, 0.86, 0.84]);
  B.cap(foot, G, 'concrete', 4, true);
  // the columns along the long sides
  for (const [x0, x1, z] of [[sx0, sx1, sz + 0.45], [dx0, dx1, dz - 0.45]]) {
    const k = Math.max(2, Math.round((x1 - x0) / 6.5));
    for (let q = 0; q <= k; q++) {
      const x = x0 + 0.45 + ((x1 - x0 - 0.9) * q) / k;
      B.box([x - 0.25, -0.6, z - 0.25], [x + 0.25, G, z + 0.25], 'concrete', 2, ['+y', '-y']);
    }
  }

  // ---- the deep slab
  B.tint(WHITE);
  wall([dx1, dz], [dx0, dz], G, top2 - PARAPET, S, curtain);
  wall([dx0, j], [dx1, j], top1, top2 - PARAPET, N, curtain);
  // the marble in slabs 1.25 × 1.65 m, two by two to its texture
  B.tint(MARBLE);
  wall([dx1, j], [dx1, dz], G, top2 - PARAPET, E, 'marble', [2.5, 3.3]);
  wall([dx0, dz], [dx0, j], G, top2 - PARAPET, W, 'marble', [2.5, 3.3]);
  // where it reaches past the shallow slab: the glazed slots
  B.tint(SLOT);
  wall([dx0, j], [sx0, j], G, top1, N, curtain);
  wall([sx1, j], [dx1, j], G, top1, N, curtain);
  // ---- the shallow slab
  B.tint(WHITE);
  wall([sx0, sz], [sx1, sz], G, top1 - PARAPET, N, curtain);
  B.tint(MARBLE);
  wall([sx1, sz], [sx1, j], G, top1 - PARAPET, E, 'marble', [2.5, 3.3]);
  wall([sx0, j], [sx0, sz], G, top1 - PARAPET, W, 'marble', [2.5, 3.3]);
  // ---- the fins
  if (t.fins) {
    B.tint([0.8, 0.75, 0.64]);
    for (const [x0, x1, z, out, y1] of [[dx0, dx1, dz, 1, top2 - PARAPET], [sx0, sx1, sz, -1, top1 - PARAPET]]) {
      const k = Math.round((x1 - x0) / t.panel);
      for (let q = 1; q < k; q++) {
        const x = x0 + ((x1 - x0) * q) / k, [za, zb] = out > 0 ? [z, z + 0.32] : [z - 0.32, z];
        B.box([x - 0.06, G, za], [x + 0.06, y1, zb], 'metal', 2, ['+y', '-y', out > 0 ? '-z' : '+z']);
      }
    }
  }
  // ---- the parapets and roofs
  B.tint(ALU);
  B.box([dx0 - 0.06, top2 - PARAPET, j - 0.06], [dx1 + 0.06, top2, dz + 0.06], 'metal', 2, ['+y', '-y']);
  B.box([sx0 - 0.06, top1 - PARAPET, sz - 0.06], [sx1 + 0.06, top1, j], 'metal', 2, ['+y', '-y', '+z']);
  B.tint(ROOF);
  B.cap([[dx0, j], [dx1, j], [dx1, dz], [dx0, dz]], top2, 'concrete', 4);
  B.cap([[sx0, sz], [sx1, sz], [sx1, j], [sx0, j]], top1, 'concrete', 4);
  // the set-back storey on the shallow slab, against the deep one
  const [bx0, bx1, bz] = t.setback, by = t.setbackTop - t.ground;
  B.tint(BRONZE);
  B.box([Math.max(bx0, sx0), top1, bz], [Math.min(bx1, sx1), by, j], 'metal', 2, ['-y', '+y', '+z']);
  B.tint(ROOF);
  B.cap([[Math.max(bx0, sx0), bz], [Math.min(bx1, sx1), bz], [Math.min(bx1, sx1), j], [Math.max(bx0, sx0), j]], by, 'concrete', 4);
  // the plant room on the deep slab, its louvres, and the masts on it
  const [px0, px1, pz0, pz1] = t.plant, py = t.plantTop - t.ground;
  B.tint(BRONZE);
  B.box([px0, top2, pz0], [px1, py, pz1], 'metal', 2, ['-y']);
  B.tint([0.28, 0.28, 0.28]);
  wall([dx1 + 0.03, j + 1.2], [dx1 + 0.03, j + 4.2], top2 - 4.2, top2 - 1.6, E, 'metal', 2);
  B.tint([0.55, 0.56, 0.57]);
  for (const x of [px0 + 2, px1 - 3]) B.box([x - 0.15, py, pz0 + 1 - 0.15], [x + 0.15, py + 6, pz0 + 1 + 0.15], 'metal', 2, ['-y']);
  // ---- its number in blue neon on its end towards Sveavägen
  B.tint(WHITE);
  const nz = j + 2.8, ny = G + 9.5, w = 3.2, h = 4.8, nx = dx1 + 0.04;
  B.poly([[nx, ny - h / 2, nz + w / 2], [nx, ny - h / 2, nz - w / 2], [nx, ny + h / 2, nz - w / 2], [nx, ny + h / 2, nz + w / 2]], E, `neon${t.n}`, 1,
    [[0, 0], [1, 0], [1, 1], [0, 1]]);
  B.place([0, 0, 0], 0);
}
