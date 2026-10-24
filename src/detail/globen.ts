import * as THREE from 'three';
import * as T from '../textures';
import { type Builder, outward, unit, type V2, type V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';
import { pipeRailing } from './gubbangen.ts';

// Avicii Arena (Globen, 1989, Berg Arkitektkontor), east of Globen's station: the white sphere,
// 110.4 m across, cut off by the ground 85 m under its top, its arena sunk below the squares
// round it. The city draws the blocks north and west of it (Annexet, Hovet); this draws the sphere
// and the low buildings round it in place of the city's two blocks:
//
// - the cladding: lacquered sheet-metal cassettes in 96 columns round it and rows of 2.3° up it,
//   3.6 by 2.2 m at the equator, in a near-white with grey joints;
// - just above the equator, 5 to 10 m up, round windows in three rows, in groups of five columns
//   with two columns between, the groups in four sets of three; between the sets, east and west,
//   two columns of them running down towards the podium, and north and south, vents;
// - three rings of 48 small square windows 61° to 70° up, and above them the cap, 30 m across,
//   of grey metal, with a railing round it and a mast in its middle;
// - SkyView (2010): two steel lattice rails, 3.4 m wide and 7 m apart, standing a metre off the
//   sphere from its top down its west side into the podium, where the two glass gondolas start
//   from Arenatorget (they are parked inside, so they are not drawn);
// - the low buildings round it, their roofs a terrace 11 m over Globentorget behind a railing:
//   concrete pillars with dark glass between them, on the south-east and south-west corners
//   glazing in orange frames, on the north-east corner white tiles with a grid of orange-framed
//   windows, and on the west SkyView's single storey of glass on the square. On the east they
//   stop short of the sphere, which comes down bare to the street there between concrete struts.
//
// The sphere's middle and radius from Lantmäteriet's laser scan (Laserdata Nedladdning, skog,
// March 2021, CC BY 4.0): (1373.06, 4224.67) in world x, z, 72.43 m up (RH 2000), 55.4 m; the
// cladding's joints, the windows, vents and rails from Google's 3D mesh of the city, unwrapped
// round the sphere; the rails' line and height off the sphere from the laser scan; the sizes,
// dates and materials from Swedish Wikipedia ("Avicii Arena", "SkyView") and the looks from
// photographs on Wikimedia Commons (2007–2021). The low buildings' plan from OpenStreetMap, their
// roofs' heights from the laser scan, their walls from Google's mesh and the photographs.
//
// Bearings are clockwise from north in degrees; latitudes are up from the sphere's equator.

addMaterial('gl-panels', () => standard(T.globenPanels(), 0.55, 0.05));
addMaterial('gl-cap', () => standard(T.globenPanels(), 0.4, 0.45));
addMaterial('gl-porthole', () => standard(T.porthole(), 0.3, 0.2, { alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
addMaterial('gl-glass', () => standard(null, 0.2, 0.4, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
addMaterial('gl-vent', () => standard(T.louvres(), 0.6, 0.3, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
addMaterial('gl-lattice', () => standard(T.lattice(), 0.5, 0.5, { alphaTest: 0.5, side: THREE.DoubleSide }));
addMaterial('gl-podium', () => standard(T.globenPodium(), 0.6, 0.1));
addMaterial('gl-tiles', () => standard(T.globenTiles(), 0.5));
addMaterial('gl-orange', () => standard(T.curtainWall({ spandrel: '#e39a2c', share: 0.3, tint: 'rgba(40,70,60,0.18)', frame: '#e0962a', mullion: 9 }), 0.35, 0.1));
addMaterial('gl-grid', () => standard(T.curtainWall({ spandrel: '#e0962a', share: 0.1, tint: 'rgba(20,30,40,0.3)', frame: '#e0962a', mullion: 16 }), 0.35, 0.1, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
addMaterial('gl-front', () => standard(T.globenFront(), 0.3, 0.2));
addMaterial('gl-paint', () => standard(null, 0.7, 0, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));

// colours
const CLADDING = 0xe9ecee, CAP = 0xb4bec6, GLASS = 0x3e4b56, STEEL = 0xd6dadc, MAST = 0x9aa0a4;

const C: V2 = [1373.06, 4224.67], CY = 72.43, R = 55.4;
const COLUMN = 3.75, ROW = 90 / 39;  // the cladding's columns and rows, degrees
const RAD = Math.PI / 180;

// the blocks the city has in the sphere's place and round it (their outlines' middles), and where
// this is built
export const GLOBEN_OUTLINE: V2[] = [[1378, 4218], [1386, 4218], [1386, 4224], [1378, 4224]];
export const GLOBEN_ANCHOR: V2 = C;

// out from the middle at bearing b and latitude f
const dir = (b: number, f: number): V3 => [Math.cos(f * RAD) * Math.sin(b * RAD), Math.sin(f * RAD), -Math.cos(f * RAD) * Math.cos(b * RAD)];
const at = (b: number, f: number, out = 0): V3 => {
  const d = dir(b, f), r = R + out;
  return [C[0] + d[0] * r, CY + d[1] * r, C[1] + d[2] * r];
};
// the panel columns' middles
const col = (k: number) => (k + 0.5) * COLUMN;

// the round windows: [column, latitudes]
const BAND = [3.45, 5.72, 8.12];
const GROUPS = [5, 12, 19, 31, 38, 53, 60, 67, 79, 86];
const CROSS_A = [8.2, 5.7, 3.45, -1.4, -5.95, -10.95, -15.55], CROSS_B = [10.3, 5.7, 1.1, -3.6, -8.45, -13.3, -18.05];
const PORTHOLES: [number, number[]][] = [
  ...GROUPS.flatMap((k0) => [0, 1, 2, 3, 4].map((i): [number, number[]] => [k0 + i, BAND])),
  // east, the lowest down the sphere where the podium leaves it bare
  [23, [-10.95, -18.45, -23.05, -27.6]], [24, [-10.95, -18.45, -23.05]],
  [25, [...BAND, -10.95, -18.45, -23.05]], [26, CROSS_B], [28, [8.2, -10.95, -18.45, -23.05]],
  // west, under SkyView
  [71, [-10.95, -15.55]], [73, CROSS_A], [74, CROSS_B], [76, [8.2, -10.95, -15.55]],
  // north and south, beside the vents
  [95, [8.2, 5.7, 3.45, -1.4, -3.6, -5.95]], [0, [8.2, 5.7, 3.45, -1.4, -3.6, -5.95]],
  [47, [8.2]], [48, [8.2]],
];
// the vents: [column, row]
const VENTS: [number, number][] = [93, 94, 1, 2, 49, 50].flatMap((k): [number, number][] => [[k, 3], [k, -1]]);
// the square windows near the top
const RINGS = [61.04, 65.72, 70.24];

// SkyView's rails: down the sphere at this bearing, either side of its middle, a metre off it
const SKYVIEW = { bearing: 251, rails: [-3.45, 3.45], half: 1.7, top: 1.25, bottom: 0.35, foot: 55.5 };

// a point at bearing b, r from the sphere's middle
const polar = (b: number, r: number): V2 => [C[0] + r * Math.sin(b * RAD), C[1] - r * Math.cos(b * RAD)];
const bearing = (p: V2) => ((Math.atan2(p[0] - C[0], C[1] - p[1]) / RAD) % 360 + 360) % 360;

// The low buildings' outline: OpenStreetMap's (from the sphere's middle, east and south), from the
// north-east corner round by the north, west and south to the south-east, where it is cut back
// to inside the sphere (its foot is 45.6 m out) as far as the north-east corner.
const PODIUM: V2[] = [
  ...([
    [66.3, -53.0], [65.8, -70.3], [53.0, -70.1], [53.6, -64.6], [47.1, -64.8], [47.2, -70.1], [37.7, -70.0], [-25.6, -69.4],
    [-26.5, -69.6], [-29.6, -70.3], [-35.0, -70.3], [-49.3, -70.1], [-49.6, -46.2], [-53.1, -42.5], [-58.9, -34.6], [-61.3, -27.2],
    [-62.8, -21.8], [-63.8, -9.8], [-64.5, 2.7], [-64.4, 4.2], [-63.2, 13.8], [-59.6, 25.3], [-54.3, 36.2], [-45.2, 47.9],
    [-32.8, 58.0], [-20.7, 64.2], [-12.7, 66.8], [-2.2, 68.6], [5.6, 68.9], [16.4, 67.9], [29.6, 62.2], [43.5, 53.8],
    [51.4, 45.5], [61.2, 33.5], [63.1, 29.1], [61.0, 27.8],
  ] as V2[]).map(([x, z]): V2 => [C[0] + x, C[1] + z]),
  ...Array.from({ length: 9 }, (_, i) => polar(114.5 - (i * (114.5 - 72.1)) / 8, 45)),
  [C[0] + 66.8, C[1] - 21.6],
];
// Its roofs, between bearings: mostly at 61 m, higher on the south and a little on the
// north-west, lowest over SkyView's front on the west.
const SECTORS = [
  { from: -34, to: 20, roof: 61 }, { from: 20, to: 100, roof: 61 }, { from: 100, to: 157, roof: 61 }, { from: 157, to: 197, roof: 65.2 },
  { from: 197, to: 243, roof: 61 }, { from: 243, to: 287, roof: 54.6 }, { from: 287, to: 315, roof: 61 }, { from: 315, to: 326, roof: 65 },
];
// Their walls by bearing: [from, to, material], the first that fits (the rest concrete and glass);
// how far each material's texture reaches along and up, and how far down it its top is.
const WALLS: [number, number, string][] = [[25, 75, 'gl-tiles'], [100, 157, 'gl-orange'], [197, 243, 'gl-orange'], [243, 287, 'gl-front']];
const MAPS: Record<string, { w: number; h: number; top: number }> = {
  'gl-podium': { w: 7, h: 28, top: 1 }, 'gl-tiles': { w: 3.6, h: 3.6, top: 1 }, 'gl-orange': { w: 6, h: 14, top: 0.825 },
  'gl-front': { w: 8, h: 4.6, top: 1 }, concrete: { w: 4, h: 4, top: 1 },
};
// the north-east corner's white walls: where they are, and their grids of orange-framed windows
// ([from, to] in the sphere's frame, from the bottom to the top)
const TILED = (p: V2) => p[0] - C[0] > 46.5;
const GRIDS: { a: V2; b: V2; y0: number; y1: number; cols: number; rows: number }[] = [
  { a: [66.6, -42.7], b: [66.1, -61.8], y0: 46.5, y1: 59, cols: 4, rows: 4 },
  { a: [48.0, -64.9], b: [52.7, -64.9], y0: 50, y1: 58, cols: 1, rows: 2.5 },
];
// the concrete struts against the sphere in the gap on the east
const STRUTS = [72.6, 80.5, 88.4, 96.4, 104.4, 112.3];

export function buildGloben(B: Builder, ground: (x: number, z: number) => number | null) {
  B.place([0, 0, 0], 0);
  // ---------------------------------------------------------------- the sphere
  // from below the ground in the pit east of it to the cap, then the cap
  const n0 = -16, nCap = 32, nTop = 39;
  shell(B, n0, nCap, 'gl-panels', CLADDING);
  shell(B, nCap, nTop, 'gl-cap', CAP);

  // ---------------------------------------------------------------- windows and vents
  B.tint(0xffffff);
  for (const [k, lats] of PORTHOLES) for (const f of lats) patch(B, col(k), f, 1.25, 1.25, 'gl-porthole', [[0, 0], [1, 0], [1, 1], [0, 1]]);
  B.tint(0xffffff);
  for (const [k, n] of VENTS) {
    const f = (n + 0.5) * ROW, w = (COLUMN * RAD * R * Math.cos(f * RAD)) - 0.3;
    patch(B, col(k), f, w, ROW * RAD * R - 0.3, 'gl-vent', [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  B.tint(GLASS);
  for (const f of RINGS) for (let j = 0; j < 48; j++) patch(B, col(2 * j), f, 1.3, 1.6, 'gl-glass');

  // ---------------------------------------------------------------- the cap
  // the railing round its edge, and the mast
  const edge = nCap * ROW, ring: V3[] = [];
  for (let k = 0; k <= 96; k++) ring.push(at(k * COLUMN, edge, 0.05));
  B.tint(STEEL);
  pipeRailing(B, ring, 1.1, 2.4);
  B.tint(MAST);
  B.lathe(C[0] + 0.8, C[1] - 0.8, [[0.35, CY + R - 0.2], [0.22, CY + R + 4], [0.12, CY + R + 6.4]], 'metal', 8);

  // ---------------------------------------------------------------- SkyView
  skyview(B);

  // ---------------------------------------------------------------- the low buildings round it
  const g = (p: V2) => ground(p[0], p[1]) ?? 42;
  podium(B, g);
  struts(B, g);
}

// The low buildings, a sector at a time: each sector's roof, the walls of its part of the outline
// from the ground up, and a step up to a higher neighbour's roof; a railing round the roofs.
function podium(B: Builder, g: (p: V2) => number) {
  const same = (a: number, b: number) => Math.abs((((a - b) % 360) + 360) % 360) < 1e-6;
  const near = (p: V2, q: V2) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-3;
  for (const s of SECTORS) {
    const plan = wedge(PODIUM, s.from, s.to);
    B.tint(0xb5b3ad);
    B.cap(plan, s.roof, 'concrete', 4);
    const edge: V3[][] = [];
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i], q = plan[(i + 1) % plan.length];
      if (near(p, C) || near(q, C)) {
        // a side of the sector: a step up from a lower neighbour's roof, from the sphere out
        const o = near(p, C) ? q : p, b = bearing(o);
        const next = SECTORS.find((t) => t !== s && (same(t.to, b) || same(t.from, b)));
        if (!next || next.roof >= s.roof) continue;
        const r = Math.sqrt(R * R - (CY - next.roof) ** 2) - 0.5, a = polar(b, r);
        // (facing the neighbour: round the sphere one way or the other)
        const k = same(s.to, b) ? 1 : -1;
        wall(B, a, o, () => next.roof, s.roof, 'concrete', 0xc9c8c2, 0, [k * Math.cos(b * RAD), 0, k * Math.sin(b * RAD)]);
        continue;
      }
      const rp = Math.hypot(p[0] - C[0], p[1] - C[1]), rq = Math.hypot(q[0] - C[0], q[1] - C[1]);
      if (rp < 50 && rq < 50) continue;
      const m = bearing([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
      let mat = WALLS.find(([b0, b1]) => m >= b0 && m < b1)?.[2] ?? 'gl-podium';
      if (mat === 'gl-tiles' && !(TILED(p) && TILED(q))) mat = 'gl-podium';
      wall(B, p, q, g, s.roof, mat, 0xffffff);
      if (mat === 'gl-tiles') wall(B, p, q, g, (y) => y + 2.6, 'gl-paint', 0xe0962a, 0.06);
      // (over SkyView's front, a concrete parapet under the railing)
      const up = s.roof < 58 ? 1.2 : 0;
      if (up) wall(B, p, q, () => s.roof + 0.3, s.roof + up, 'concrete', 0xd2d1cb);
      edge.push([[p[0], s.roof + up, p[1]], [q[0], s.roof + up, q[1]]]);
    }
    // the railing round the roof's edge, a little in from it
    B.tint(0xb9bcbd);
    for (const [a, b] of edge) pipeRailing(B, [lerp3(a, b, 0), lerp3(a, b, 1)].map((v) => inward(v, 0.25)), 1.1, 2.4);
  }
  // the north-east corner's windows
  B.tint(0xffffff);
  for (const w of GRIDS) {
    const a: V2 = [C[0] + w.a[0], C[1] + w.a[1]], b: V2 = [C[0] + w.b[0], C[1] + w.b[1]];
    const d = unit([b[0] - a[0], 0, b[1] - a[1]]), n: V3 = [d[2], 0, -d[0]];
    // (facing away from the sphere)
    const f: V3 = (a[0] - C[0]) * n[0] + (a[1] - C[1]) * n[2] > 0 ? n : [-n[0], 0, -n[2]];
    const o = (p: V2, y: number): V3 => [p[0] + f[0] * 0.08, y, p[1] + f[2] * 0.08];
    B.poly([o(a, w.y0), o(b, w.y0), o(b, w.y1), o(a, w.y1)], f, 'gl-grid', 1, [[0, 0], [w.cols / 4, 0], [w.cols / 4, w.rows / 4], [0, w.rows / 4]]);
  }
}

// A wall from p to q, from `bottom` (the ground, or a height) up to `top` (a height, or one from
// the bottom), facing away from the sphere (or `face`), in pieces of up to 4 m; `out` off the
// outline.
function wall(B: Builder, p: V2, q: V2, bottom: number | ((p: V2) => number), top: number | ((y: number) => number), mat: string, tint: number, out = 0, face?: V3) {
  const map = MAPS[mat] ?? MAPS.concrete, l = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.ceil(l / 4));
  const d: V2 = [(q[0] - p[0]) / l, (q[1] - p[1]) / l];
  let f: V3 = [d[1], 0, -d[0]];
  const mid: V2 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  if ((mid[0] - C[0]) * f[0] + (mid[1] - C[1]) * f[2] < 0) f = [-f[0], 0, -f[2]];
  if (face) f = face;
  const lo = (s: V2) => (typeof bottom === 'number' ? bottom : bottom(s) - 0.3);
  const hi = (s: V2) => (typeof top === 'number' ? top : top(lo(s) + 0.3));
  const roof = typeof top === 'number' ? top : 0;
  const v = (y: number) => (typeof top === 'number' ? map.top + (y - roof) / map.h : (y - lo(p)) / map.h);
  B.tint(tint);
  for (let k = 0; k < n; k++) {
    const a: V2 = [p[0] + (q[0] - p[0]) * (k / n), p[1] + (q[1] - p[1]) * (k / n)];
    const b: V2 = [p[0] + (q[0] - p[0]) * ((k + 1) / n), p[1] + (q[1] - p[1]) * ((k + 1) / n)];
    const ua = (l * k) / n / map.w, ub = (l * (k + 1)) / n / map.w;
    const P = (s: V2, y: number): V3 => [s[0] + f[0] * out, y, s[1] + f[2] * out];
    B.poly([P(a, lo(a)), P(b, lo(b)), P(b, hi(b)), P(a, hi(a))], f, mat, 1, [[ua, v(lo(a))], [ub, v(lo(b))], [ub, v(hi(b))], [ua, v(hi(a))]]);
  }
}

// ---------------------------------------------------------------- Annexet
// Annexet (1989), the small arena north-west of the sphere, in front of it from Globen's station:
// OpenStreetMap's outline; its roof at the laser scan's 63.1 m, with a raised part at 68 m on the
// south-west (OpenStreetMap's height of 20 m stood it 6 m too tall); white tiles over a yellow
// base, as in a photograph on Wikimedia Commons (October 2014).
const ANNEXET: V2[] = [
  [1320, 4182.2], [1314.2, 4190.1], [1311.8, 4197.5], [1310.3, 4202.9], [1261.5, 4203], [1261.3, 4199], [1261, 4196.9],
  [1261.5, 4193.6], [1261.3, 4187.3], [1260.9, 4155.3], [1303.4, 4154.9], [1323.8, 4154.6], [1323.5, 4178.5],
];
const ANNEXET_RAISED: V2[] = [[1281, 4187.5], [1301, 4187.5], [1301, 4202.9], [1281, 4202.9]];
// the city's block (its outline's middle), and where this is built
export const ANNEXET_OUTLINE: V2[] = [[1288, 4182], [1293, 4182], [1293, 4187], [1288, 4187]];
export const ANNEXET_ANCHOR: V2 = [1292, 4180];

export function buildAnnexet(B: Builder, ground: (x: number, z: number) => number | null) {
  B.place([0, 0, 0], 0);
  const g = (p: V2) => ground(p[0], p[1]) ?? 49.5;
  for (const [plan, roof, base] of [[ANNEXET, 63.1, true], [ANNEXET_RAISED, 68, false]] as [V2[], number, boolean][]) {
    B.tint(0xb5b3ad);
    B.cap(plan, roof, 'concrete', 4);
    const N = outward(plan);
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i], q = plan[(i + 1) % plan.length], f: V3 = [N[i][0], 0, N[i][1]];
      wall(B, p, q, base ? g : () => 63.4, roof, 'gl-tiles', 0xffffff, 0, f);
      if (base) wall(B, p, q, g, (y) => y + 4.5, 'gl-paint', 0xdcae2e, 0.06, f);
    }
  }
}

// The part of an outline between bearings b0 and b1 (less than 180° apart) round the sphere's
// middle: the outline cut by the two lines through the middle (the middle is one of its corners).
function wedge(ring: V2[], b0: number, b1: number): V2[] {
  let out = ring;
  for (const [b, side] of [[b0, 1], [b1, -1]]) {
    const f = (p: V2) => side * ((p[0] - C[0]) * Math.cos(b * RAD) + (p[1] - C[1]) * Math.sin(b * RAD));
    const res: V2[] = [];
    for (let i = 0; i < out.length; i++) {
      const p = out[i], q = out[(i + 1) % out.length], fp = f(p), fq = f(q);
      if (fp >= 0) res.push(p);
      if (fp >= 0 !== fq >= 0) {
        const t = fp / (fp - fq);
        res.push(Math.abs(fp - fq) < 1e-9 ? p : [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    out = res;
  }
  // (the middle, where the two cuts meet, exactly)
  return out.map((p) => (Math.hypot(p[0] - C[0], p[1] - C[1]) < 1e-6 ? C : p));
}

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// a point moved d towards the sphere's middle
const inward = (p: V3, d: number): V3 => {
  const l = Math.hypot(p[0] - C[0], p[2] - C[1]) || 1;
  return [p[0] - ((p[0] - C[0]) / l) * d, p[1], p[2] - ((p[2] - C[1]) / l) * d];
};

// The struts in the gap on the east: concrete wedges from the street up to the sphere, 1.4 m
// across, leaning on it 8 m up.
function struts(B: Builder, g: (p: V2) => number) {
  B.tint(0xd6d4cd);
  for (const b of STRUTS) {
    const y0 = g(polar(b, 50)) - 0.3, y1 = y0 + 8.3, r1 = Math.sqrt(R * R - (CY - y1) ** 2) - 0.1;
    const r0 = Math.sqrt(R * R - (CY - y0) ** 2) - 0.2;
    const e: V2 = [Math.cos(b * RAD), Math.sin(b * RAD)];
    const at = (r: number, side: number, y: number): V3 => { const p = polar(b, r); return [p[0] + e[0] * side * 0.7, y, p[1] + e[1] * side * 0.7]; };
    const foot = r1 + 3.2;
    // the two sides, the sloping back and the top of the foot
    for (const side of [-1, 1]) B.poly([at(r0, side, y0), at(foot, side, y0), at(r1, side * 0.3, y1)], [e[0] * side, 0, e[1] * side], 'concrete', 2);
    const back = [at(foot, -1, y0), at(foot, 1, y0), at(r1, 0.3, y1), at(r1, -0.3, y1)];
    const u = sub(back[3], back[0]), w = sub(back[1], back[0]);
    const n: V3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    B.poly(back, n[1] < 0 ? [-n[0], -n[1], -n[2]] : n, 'concrete', 2);
  }
}

// The sphere between rows n0 and n1: smooth, a panel to each column and row of the texture.
function shell(B: Builder, n0: number, n1: number, mat: string, tint: number) {
  B.tint(tint);
  const pts: V3[] = [], nrm: V3[] = [], uvs: V2[] = [], tris: number[] = [];
  const W = 96 + 1;
  for (let n = n0; n <= n1; n++) {
    // (the bottom row starts a little below the ground in the pit east of it)
    const f = Math.min(n * ROW, 90);
    for (let k = 0; k <= 96; k++) {
      pts.push(at(k * COLUMN, f));
      nrm.push(dir(k * COLUMN, f));
      uvs.push([k / 8, n / 8]);
    }
  }
  for (let n = 0; n < n1 - n0; n++) for (let k = 0; k < 96; k++) {
    const a = n * W + k, b = a + 1, c = a + W + 1, d = a + W;
    tris.push(...wound(pts, nrm, a, b, c), ...wound(pts, nrm, a, c, d));
  }
  B.mesh(pts, nrm, uvs, tris, mat);
}

// a triangle wound to face out
function wound(pts: V3[], nrm: V3[], a: number, b: number, c: number) {
  const p = pts[a], q = pts[b], r = pts[c];
  const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
  const x = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const n = nrm[a];
  return x[0] * n[0] + x[1] * n[1] + x[2] * n[2] >= 0 ? [a, b, c] : [a, c, b];
}

// A flat patch on the sphere, w across and h up, centred at bearing b and latitude f.
function patch(B: Builder, b: number, f: number, w: number, h: number, mat: string, uvs?: V2[]) {
  const o = at(b, f, 0.08), n = dir(b, f);
  const e: V3 = [Math.cos(b * RAD), 0, Math.sin(b * RAD)];
  const t: V3 = [-Math.sin(f * RAD) * Math.sin(b * RAD), Math.cos(f * RAD), Math.sin(f * RAD) * Math.cos(b * RAD)];
  const p = (i: number, j: number): V3 => [o[0] + e[0] * i * w / 2 + t[0] * j * h / 2, o[1] + e[1] * i * w / 2 + t[1] * j * h / 2, o[2] + e[2] * i * w / 2 + t[2] * j * h / 2];
  B.poly([p(-1, -1), p(1, -1), p(1, 1), p(-1, 1)], n, mat, 2, uvs);
}

// SkyView's two rails. Each lies in an upright plane `v` from the sphere's middle, across the
// bearing: on the circle where that plane cuts the sphere, from its top down to the podium. Each is
// a lattice girder: a chord at each edge on top and underneath, the lattice between them on its
// sides and across its top.
function skyview(B: Builder) {
  const S = SKYVIEW, a = S.bearing * RAD;
  const u: V2 = [Math.sin(a), -Math.cos(a)], n: V2 = [-u[1], u[0]];
  // a point on the rail at across offset v, `off` off the sphere, angle g from the top
  const p = (v: number, off: number, g: number): V3 => {
    const r = Math.sqrt(R * R - v * v) + off;
    return [C[0] + n[0] * v + u[0] * r * Math.sin(g), CY + r * Math.cos(g), C[1] + n[1] * v + u[1] * r * Math.sin(g)];
  };
  const end = Math.acos((S.foot - CY) / (R + S.top)), steps = 72;
  const gs = Array.from({ length: steps + 1 }, (_, i) => (end * i) / steps);
  B.tint(STEEL);
  for (const v of S.rails) {
    const lo = v - S.half, hi = v + S.half;
    // the chords
    for (const e of [lo, hi]) for (const off of [S.top, S.bottom]) chord(B, gs.map((g) => p(e, off, g)), gs.map((g) => p(e, off + 1, g)), [n[0], 0, n[1]], 0.22);
    // the lattice on the sides and across the top, a panel to every 1.6 m or so
    let s = 0;
    for (let i = 0; i < steps; i++) {
      const l = Math.hypot(...sub(p(v, S.top, gs[i + 1]), p(v, S.top, gs[i])));
      const uv: V2[] = [[s / 1.6, 0], [(s + l) / 1.6, 0], [(s + l) / 1.6, 1], [s / 1.6, 1]];
      for (const e of [lo, hi]) B.poly([p(e, S.bottom, gs[i]), p(e, S.bottom, gs[i + 1]), p(e, S.top, gs[i + 1]), p(e, S.top, gs[i])], [n[0], 0, n[1]], 'gl-lattice', 1, uv);
      const up = sub(p(v, S.top + 1, gs[i]), p(v, S.top, gs[i]));
      B.poly([p(lo, S.top, gs[i]), p(lo, S.top, gs[i + 1]), p(hi, S.top, gs[i + 1]), p(hi, S.top, gs[i])], up, 'gl-lattice', 1, uv.map(([x, y]) => [x * 0.75, y]));
      s += l;
    }
  }
  // the top station where the rails meet, low on the top of the sphere
  B.tint(STEEL);
  const top = CY + R;
  B.wallBox([C[0], 0, C[1]], [u[0], 0, u[1]], [n[0], 0, n[1]], -2.5, 3, top - 0.6, top + 1.2, -5.6, 5.6, 'metal', 2);
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// A square tube along a line of points, `w` thick, its faces turned by the points `up` beside them
// (out from the sphere) and `side`.
function chord(B: Builder, pts: V3[], ups: V3[], side: V3, w: number) {
  for (let i = 0; i + 1 < pts.length; i++) {
    const q = [pts[i], pts[i + 1]], up = [0, 1].map((j) => unit(sub(ups[i + j], pts[i + j])));
    const c = (j: number, a: number, b: number): V3 => [q[j][0] + (up[j][0] * a + side[0] * b) * w / 2, q[j][1] + (up[j][1] * a + side[1] * b) * w / 2, q[j][2] + (up[j][2] * a + side[2] * b) * w / 2];
    for (const [a0, b0, a1, b1, nn] of [[1, -1, 1, 1, up[0]], [-1, -1, -1, 1, up[0].map((x) => -x)], [-1, 1, 1, 1, side], [-1, -1, 1, -1, side.map((x) => -x)]] as [number, number, number, number, V3][]) {
      B.poly([c(0, a0, b0), c(1, a0, b0), c(1, a1, b1), c(0, a1, b1)], nn, 'metal', 2);
    }
  }
}
