import * as T from '../textures';
import type { Builder, V2, V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';
import { lampMast, post } from './ropsten.ts';
import { bar, block, Frame, pipeRailing, sign, v3, type Ground } from './gubbangen.ts';

// What the green line looks out on from Tallkrogen north to Gullmarsplan, beyond what the city draws
// there itself (its blocks with facades, the streets and the trees: see the areas in
// src/detail/areas.ts), the metro's bridges between them:
//
// - a short concrete slab over the footpath through the woods north-east of Tallkrogen;
// - the long bridge over Nynäsvägen and its ramps on the way to Skogskyrkogården, 160 m: one broad
//   concrete slab for both tracks and a cycleway along its south-eastern side, fenced off from them,
//   its soffit curving up to thin edges, on single blade piers of concrete cast against boards set
//   along the road, with a railing of upright bars along both edges and lamps along the cycleway;
// - the bridge over Sockenvägen north of Skogskyrkogården: a concrete slab on deep edge beams cast
//   against boards, one deck for both tracks that parts into one for each as they draw apart into
//   the station, on a rectangular column under each track, galvanised railings of two rails on
//   posts, and the height clear under it, "4,2 m", over Sockenvägen on both faces;
// - south of Blåsut, over Sofielundsvägen, and east of Gullmarsplan, over Hammarbybacken, steel
//   bridges: a concrete deck on a row of plate girders braced underneath, on crossheads carried by
//   rows of round steel columns, between abutments of concrete cast against boards (Blåsut's) or of
//   granite blocks (Hammarbybacken's); at Blåsut a footway along the eastern side.
//
// The bridges' plans, heights, edges and the ground under them from Lantmäteriet's laser scan
// (Laserdata Nedladdning, skog, 2021, CC BY 4.0), the streets they cross from OpenStreetMap, their
// looks from photographs on Mapillary (2015–2024) and Google's 3D mesh; their decks follow the
// tracks (public/data/track-geometry.json). The network draws the tracks on them and leaves their
// girders, piers and railings to this (src/detail/viaducts.ts); OpenStreetMap's footways on bridges
// are left out of the city (tools/build-city.ts), so this draws Nynäsvägen's cycleway and Blåsut's
// footway.

addMaterial('fl-sign42', () => standard(T.heightLimitSign('4,2 m'), 0.5, 0, { alphaTest: 0.5 }));
addMaterial('fl-granite', () => standard(T.finish('granite'), 0.95));

// ------------------------------------------------------------------ in a bridge's frame
// A bridge's tracks every 4 m along its frame: s, then each track's u and its rails' top.
type Rows = number[][];
// at s: track k's u and its rails' top
function track(rows: Rows, s: number, k: number): V2 {
  const step = rows[1][0] - rows[0][0], i = Math.max(0, Math.min(rows.length - 2, Math.floor((s - rows[0][0]) / step)));
  const a = rows[i], b = rows[i + 1], f = (s - a[0]) / step;
  return [a[1 + 2 * k] + (b[1 + 2 * k] - a[1 + 2 * k]) * f, a[2 + 2 * k] + (b[2 + 2 * k] - a[2 + 2 * k]) * f];
}
// the rails' top at (s, u): from track to track across, level beyond the outer ones
function railAt(rows: Rows, s: number, u: number): number {
  const ts = Array.from({ length: (rows[0].length - 1) / 2 }, (_, k) => track(rows, s, k)).sort((p, q) => p[0] - q[0]);
  if (u <= ts[0][0]) return ts[0][1];
  for (let k = 0; k + 1 < ts.length; k++) {
    if (u <= ts[k + 1][0]) return ts[k][1] + ((ts[k + 1][1] - ts[k][1]) * (u - ts[k][0])) / (ts[k + 1][0] - ts[k][0]);
  }
  return ts[ts.length - 1][1];
}
// from s0 to s1 about every `every` metres, and at each of `at` between
function steps(s0: number, s1: number, at: number[] = [], every = 4): number[] {
  const n = Math.max(1, Math.round((s1 - s0) / every)), ss = Array.from({ length: n + 1 }, (_, i) => s0 + ((s1 - s0) * i) / n);
  for (const s of at) if (s > s0 + 0.05 && s < s1 - 0.05) ss.push(s);
  return ss.sort((a, b) => a - b).filter((s, i, a) => i === 0 || s - a[i - 1] > 0.05);
}
type Edge = (s: number) => number;
// a band along a frame between u = lo(s) and hi(s), a step at a time
function band(B: Builder, F: Frame, ss: number[], lo: Edge, hi: Edge, bottom: (s: number, u: number) => number,
  top: (s: number, u: number) => number, mat: string, tile: number, opts: { faces?: 'all' | 'sides' | 'top' } = {}) {
  for (let i = 0; i + 1 < ss.length; i++) {
    const [a, b] = [ss[i], ss[i + 1]];
    block(B, F, [[a, lo(a)], [b, lo(b)], [b, hi(b)], [a, hi(a)]], bottom, top, mat, tile, opts);
  }
}
const off = (e: Edge, d: number): Edge => (s) => e(s) + d;
// the feet of a line along a frame at u = e(s), at heights y(s, u)
const line = (F: Frame, ss: number[], e: Edge, y: (s: number, u: number) => number): V3[] => ss.map((s) => v3(F.at(s, e(s)), y(s, e(s))));

// A railing of upright bars along a line of feet, `h` high, a rail along its top and a post every
// 2.5 m or so.
function barRailing(B: Builder, feet: V3[], h: number) {
  let run = 0, next = 0;
  for (let i = 0; i + 1 < feet.length; i++) {
    const p = feet[i], q = feet[i + 1], l = Math.hypot(q[0] - p[0], q[2] - p[2]);
    if (l < 1e-6) continue;
    const t: V2 = [(q[0] - p[0]) / l, (q[2] - p[2]) / l];
    B.poly([p, q, [q[0], q[1] + h, q[2]], [p[0], p[1] + h, p[2]]], [-t[1], 0, t[0]], 'gt-bars', 1, [[run, 0], [run + l, 0], [run + l, 1], [run, 1]]);
    bar(B, [p[0], p[1] + h, p[2]], [q[0], q[1] + h, q[2]], 0.08, 0.05, 'metal');
    for (; next <= run + l; next += 2.5) {
      const f = (next - run) / l;
      post(B, [p[0] + (q[0] - p[0]) * f, p[2] + (q[2] - p[2]) * f], t, 0.07, 0.07, p[1] + (q[1] - p[1]) * f - 0.05, p[1] + (q[1] - p[1]) * f + h, 'metal', 1);
    }
    run += l;
  }
}
// A chain-link fence along a line of feet, `h` high, on posts every 3 m or so.
function chainFence(B: Builder, feet: V3[], h: number) {
  let run = 0, next = 0;
  for (let i = 0; i + 1 < feet.length; i++) {
    const p = feet[i], q = feet[i + 1], l = Math.hypot(q[0] - p[0], q[2] - p[2]);
    if (l < 1e-6) continue;
    B.tint(0xffffff);
    B.poly([p, q, [q[0], q[1] + h, q[2]], [p[0], p[1] + h, p[2]]], [-(q[2] - p[2]) / l, 0, (q[0] - p[0]) / l], 'gt-chain', 0.5);
    B.tint(0xa7acad);
    bar(B, [p[0], p[1] + h, p[2]], [q[0], q[1] + h, q[2]], 0.045, 0.045, 'metal');
    for (; next <= run + l; next += 3) {
      const f = (next - run) / l;
      B.lathe(p[0] + (q[0] - p[0]) * f, p[2] + (q[2] - p[2]) * f, [[0.03, p[1] + (q[1] - p[1]) * f - 0.1], [0.03, p[1] + (q[1] - p[1]) * f + h + 0.05]], 'metal', 6);
    }
    run += l;
  }
}

// heights from the rails' top: the network's floor (the decks' top is just under it) and the
// kerbs along the edges
const FLOOR = -0.62, KERB = 0.25;
const CONCRETE = 0xb4b1a9, UNDER = 0x9a978f, BOARDS = 0xe6e3dc, RAILING = 0xaeb3b3, PAINT = 0x6d7274, ASPHALT = 0x5f6164;

// A concrete deck between lo and hi: an edge beam along each side, cast against boards, from
// `fascia` to the kerb, and the slab between them, its underside at `soffit`.
function slabDeck(B: Builder, F: Frame, rows: Rows, ss: number[], lo: Edge, hi: Edge, fascia: number, soffit: number, edge = 0.45) {
  const at = (y: number) => (s: number, u: number) => railAt(rows, s, u) + y;
  B.tint(UNDER);
  band(B, F, ss, off(lo, edge), off(hi, -edge), at(soffit), at(FLOOR), 'fl-under', 3);
  B.tint(BOARDS);
  band(B, F, ss, lo, off(lo, edge), at(fascia), at(KERB), 'gt-boards', 2.4);
  band(B, F, ss, off(hi, -edge), hi, at(fascia), at(KERB), 'gt-boards', 2.4);
}
// An abutment under a deck from s0 to s1, between lo and hi and a little beyond, from below the
// lowest ground under it to `top` under the rails.
function abutment(B: Builder, F: Frame, rows: Rows, ground: Ground, s0: number, s1: number, lo: Edge, hi: Edge, top: number, mat: string) {
  const plan: V2[] = [[s0, lo(s0) - 0.3], [s1, lo(s1) - 0.3], [s1, hi(s1) + 0.3], [s0, hi(s0) + 0.3]];
  const foot = Math.min(...plan.map(([s, u]) => ground(...F.at(s, u)) ?? railAt(rows, s, u) - 5)) - 0.6;
  block(B, F, plan, () => foot, (s, u) => railAt(rows, s, u) + top, mat, 2.4);
}

// ------------------------------------------------------------------ the path bridge at Tallkrogen
// Over the footpath through the woods 80 m north-east of Tallkrogen's platform: s metres from the
// woods' side towards the station (south-west), u to the right (north-west). A single span of 13 m
// between abutments under both tracks.
export const TALLKROGEN_PATH = new Frame([1700, 6527], [-0.707, 0.707]);
const TP = TALLKROGEN_PATH;
const TP_TRACKS: Rows = [
  [0, -0.31, 35.763, 3.13, 35.758], [4, -0.33, 35.655, 3.08, 35.651], [8, -0.35, 35.551, 3.04, 35.549], [12, -0.37, 35.451, 3.00, 35.453],
  [16, -0.39, 35.352, 2.96, 35.356], [20, -0.43, 35.256, 2.94, 35.255], [24, -0.46, 35.160, 2.91, 35.155], [28, -0.50, 35.095, 2.91, 35.072],
  [32, -0.54, 35.034, 2.90, 34.991],
];
// where the network's tracks are a bridge (half-way to their next samples), the abutments' faces
const TP_ENDS: V2 = [1.0, 29.4], TP_FACES: V2 = [9.5, 22.5];
const tpLo: Edge = (s) => track(TP_TRACKS, s, 0)[0] - 2.55, tpHi: Edge = (s) => track(TP_TRACKS, s, 1)[0] + 2.8;

export function buildTallkrogenPath(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const ss = steps(TP_ENDS[0], TP_ENDS[1], [...TP_FACES]);
  slabDeck(B, TP, TP_TRACKS, ss, tpLo, tpHi, -0.9, -0.95);
  B.tint(BOARDS);
  abutment(B, TP, TP_TRACKS, ground, TP_ENDS[0], TP_FACES[0], tpLo, tpHi, -0.95, 'gt-boards');
  abutment(B, TP, TP_TRACKS, ground, TP_FACES[1], TP_ENDS[1], tpLo, tpHi, -0.95, 'gt-boards');
  B.tint(RAILING);
  for (const e of [off(tpLo, 0.2), off(tpHi, -0.2)]) pipeRailing(B, line(TP, ss, e, (s, u) => railAt(TP_TRACKS, s, u) + KERB), 1.1, 2);
}

// ------------------------------------------------------------------ Nynäsvägen's bridge
// s metres from the bridge's north-eastern end towards Tallkrogen (south-west), u to the right
// (north-west). The south-eastern track is the first, the cycleway beyond it.
export const NYNASVAGEN = new Frame([1978, 6274.4], [-0.750, 0.662]);
const NY = NYNASVAGEN;
const NY_TRACKS: Rows = [
  [-12, 1.36, 42.382, 5.84, 42.203], [-8, 0.86, 42.378, 5.28, 42.199], [-4, 0.44, 42.374, 4.80, 42.195], [0, 0.01, 42.370, 4.33, 42.191],
  [4, -0.29, 42.358, 3.96, 42.180], [8, -0.59, 42.346, 3.61, 42.168], [12, -0.84, 42.334, 3.30, 42.155], [16, -1.03, 42.322, 3.07, 42.143],
  [20, -1.21, 42.309, 2.83, 42.131], [24, -1.32, 42.289, 2.68, 42.112], [28, -1.42, 42.269, 2.53, 42.092], [32, -1.48, 42.249, 2.42, 42.072],
  [36, -1.51, 42.229, 2.36, 42.052], [40, -1.54, 42.208, 2.29, 42.032], [44, -1.52, 42.184, 2.28, 42.012], [48, -1.49, 42.160, 2.27, 41.992],
  [52, -1.45, 42.136, 2.28, 41.970], [56, -1.39, 42.112, 2.31, 41.946], [60, -1.33, 42.087, 2.35, 41.922], [64, -1.26, 42.050, 2.41, 41.891],
  [68, -1.19, 42.014, 2.47, 41.859], [72, -1.12, 41.980, 2.53, 41.827], [76, -1.04, 41.948, 2.61, 41.795], [80, -0.96, 41.915, 2.68, 41.763],
  [84, -0.89, 41.875, 2.76, 41.723], [88, -0.81, 41.835, 2.83, 41.683], [92, -0.73, 41.792, 2.90, 41.643], [96, -0.65, 41.748, 2.97, 41.603],
  [100, -0.58, 41.703, 3.04, 41.563], [104, -0.51, 41.659, 3.10, 41.519], [108, -0.44, 41.615, 3.17, 41.475], [112, -0.38, 41.571, 3.23, 41.433],
  [116, -0.31, 41.526, 3.28, 41.393], [120, -0.25, 41.480, 3.34, 41.352], [124, -0.20, 41.424, 3.40, 41.297], [128, -0.14, 41.367, 3.46, 41.241],
  [132, -0.09, 41.311, 3.52, 41.185], [136, -0.04, 41.255, 3.58, 41.129], [140, 0.02, 41.197, 3.63, 41.073], [144, 0.07, 41.137, 3.70, 41.020],
  [148, 0.12, 41.077, 3.76, 40.968], [152, 0.17, 41.019, 3.83, 40.914], [156, 0.23, 40.963, 3.90, 40.858], [160, 0.29, 40.902, 3.97, 40.802],
  [164, 0.35, 40.828, 4.05, 40.736], [168, 0.41, 40.754, 4.13, 40.670], [172, 0.48, 40.679, 4.22, 40.601],
];
// where the network's tracks are a bridge, the abutments' faces (where the scan's ground drops away),
// and the piers: in the verges and the medians between the cycleways, the ramps and Nynäsvägen's
// two carriageways, set along them
const NY_ENDS: V2 = [-5, 165], NY_FACES: V2 = [3, 153.5];
const NY_PIERS = [15.2, 30.5, 46, 61.5, 84, 105, 126, 145], NY_ROAD: V2 = [-0.131, -0.991];
// the edges (the scan's, 6.25 m out from the south-eastern track and 2.75 m from the other), and
// the cycleway's fence 2.8 m out from the track
const nyLo: Edge = (s) => track(NY_TRACKS, s, 0)[0] - 6.25, nyHi: Edge = (s) => track(NY_TRACKS, s, 1)[0] + 2.75;
const nyFence: Edge = (s) => track(NY_TRACKS, s, 0)[0] - 2.8;
// heights from the rails' top: the edge beams' bottom, the soffit in the middle; how far in from
// the edges the soffit curves down to it
const NY_EDGE = 0.45, NY_FASCIA = -0.95, NY_SOFFIT = -1.5, NY_CURVE = 2.25;
// the cycleway's ends, on at grade past the deck's (OpenStreetMap's), and the lamps along it
const NY_CYCLE: V2 = [-12, 172], NY_LAMPS = 26;

export function buildNynasvagen(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (s: number, u: number) => railAt(NY_TRACKS, s, u);
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  const ss = steps(NY_ENDS[0], NY_ENDS[1], [...NY_FACES, ...NY_PIERS]);
  // the slab, its underside curving down from the edge beams to the soffit in the middle
  const soffit = (s: number, u: number) => {
    const d = Math.min(u - nyLo(s), nyHi(s) - u), f = Math.max(0, Math.min(1, (d - NY_EDGE) / (NY_CURVE - NY_EDGE)));
    return rail(s, u) + NY_FASCIA + 0.1 + (NY_SOFFIT - NY_FASCIA - 0.1) * (1 - (1 - f) ** 2);
  };
  const cuts = [NY_EDGE, 0.9, 1.5, NY_CURVE];
  B.tint(UNDER);
  for (let i = 0; i + 1 < cuts.length; i++) {
    band(B, NY, ss, off(nyLo, cuts[i]), off(nyLo, cuts[i + 1]), soffit, at(FLOOR), 'fl-under', 3);
    band(B, NY, ss, off(nyHi, -cuts[i + 1]), off(nyHi, -cuts[i]), soffit, at(FLOOR), 'fl-under', 3);
  }
  band(B, NY, ss, off(nyLo, NY_CURVE), off(nyHi, -NY_CURVE), at(NY_SOFFIT), at(FLOOR), 'fl-under', 3);
  B.tint(CONCRETE);
  band(B, NY, ss, nyLo, off(nyLo, NY_EDGE), at(NY_FASCIA), at(KERB), 'concrete', 3);
  band(B, NY, ss, off(nyHi, -NY_EDGE), nyHi, at(NY_FASCIA), at(KERB), 'concrete', 3);

  // the cycleway at the rails' height, its kerb and the fence between it and the tracks
  B.tint(ASPHALT);
  band(B, NY, ss, off(nyLo, NY_EDGE), off(nyFence, -0.2), at(FLOOR), at(0), 'rp-asphalt', 6);
  for (const [s0, s1] of [[NY_CYCLE[0], NY_ENDS[0]], [NY_ENDS[1], NY_CYCLE[1]]]) {
    band(B, NY, steps(s0, s1, [], 2), off(nyLo, NY_EDGE), off(nyFence, -0.2), () => 0,
      (s, u) => (ground(...NY.at(s, u)) ?? rail(s, u)) + 0.04, 'rp-asphalt', 6, { faces: 'top' });
  }
  B.tint(CONCRETE);
  band(B, NY, ss, off(nyFence, -0.2), nyFence, at(FLOOR), at(0.15), 'concrete', 3);
  chainFence(B, line(NY, ss, off(nyFence, -0.1), at(0.15)), 1.6);

  // the piers, blades cast against boards under the middle of the slab
  B.tint(BOARDS);
  for (const s of NY_PIERS) {
    const u = (nyLo(s) + nyHi(s)) / 2, c = NY.at(s, u), g = ground(c[0], c[1]) ?? rail(s, u) - 6;
    post(B, c, NY_ROAD, 3.2, s === 46 ? 0.8 : 1.0, g - 0.3, rail(s, u) + NY_SOFFIT + 0.02, 'gt-boards', 2.4);
  }
  // the abutments
  abutment(B, NY, NY_TRACKS, ground, NY_ENDS[0], NY_FACES[0], nyLo, nyHi, NY_FASCIA + 0.1, 'gt-boards');
  abutment(B, NY, NY_TRACKS, ground, NY_FACES[1], NY_ENDS[1], nyLo, nyHi, NY_FASCIA + 0.1, 'gt-boards');

  // the railings along both edges, and the lamps along the cycleway's, their arms over it
  B.tint(0x8c9092);
  for (const e of [off(nyLo, 0.2), off(nyHi, -0.2)]) barRailing(B, line(NY, ss, e, at(KERB)), 1.15);
  for (let s = NY_ENDS[0] + 8; s < NY_ENDS[1] - 4; s += NY_LAMPS) lampMast(B, NY.at(s, nyLo(s) + 0.25), rail(s, nyLo(s)) + KERB, 6, NY.t, [1.1]);
}

// ------------------------------------------------------------------ Sockenvägen's bridge
// s metres southwards from the bridge's north end into Skogskyrkogården, u to the right (west). The
// eastern track is the first. One deck for both as far as SO_SPLIT, then one for each.
export const SOCKENVAGEN = new Frame([2072, 5730], [0, 1]);
const SO = SOCKENVAGEN;
const SO_TRACKS: Rows = [
  [4, -0.74, 39.594, 3.58, 39.592], [8, -1.29, 39.635, 3.07, 39.633], [12, -1.83, 39.676, 2.57, 39.674], [16, -2.30, 39.715, 2.16, 39.713],
  [20, -2.78, 39.754, 1.75, 39.752], [24, -3.19, 39.789, 1.42, 39.791], [28, -3.60, 39.824, 1.09, 39.830], [32, -3.97, 39.860, 0.82, 39.869],
  [36, -4.32, 39.899, 0.58, 39.908], [40, -4.65, 39.937, 0.36, 39.946], [44, -4.95, 39.972, 0.22, 39.981], [48, -5.25, 40.006, 0.07, 40.015],
  [52, -5.51, 40.037, -0.01, 40.046], [56, -5.76, 40.067, -0.08, 40.077], [60, -5.99, 40.099, -0.11, 40.109], [64, -6.21, 40.134, -0.10, 40.144],
  [68, -6.41, 40.165, -0.08, 40.175], [72, -6.60, 40.187, -0.01, 40.197], [76, -6.78, 40.208, 0.07, 40.219], [80, -6.93, 40.230, 0.20, 40.244],
  [84, -7.08, 40.251, 0.33, 40.270], [88, -7.20, 40.273, 0.50, 40.293], [92, -7.30, 40.294, 0.69, 40.315], [96, -7.38, 40.313, 0.89, 40.334],
  [100, -7.43, 40.326, 1.13, 40.347], [104, -7.48, 40.339, 1.36, 40.360], [108, -7.48, 40.352, 1.63, 40.369], [112, -7.47, 40.365, 1.89, 40.377],
  [116, -7.44, 40.378, 2.17, 40.389], [120, -7.38, 40.391, 2.46, 40.402], [124, -7.31, 40.400, 2.75, 40.410], [128, -7.20, 40.400, 3.05, 40.410],
  [132, -7.09, 40.400, 3.34, 40.410],
];
// where the network's tracks are a bridge (its southern end at the platform's north end), the
// abutments' faces, the piers (the service road, a cycleway, Sockenvägen and another cycleway pass
// between them), where the deck parts, and Sockenvägen
const SO_ENDS: V2 = [6.5, 127.8], SO_FACES: V2 = [14, 117], SO_PIERS = [30, 46, 63.5, 74.5, 92, 108], SO_SPLIT = 62, SO_ROAD = 68.1;
const soE: Edge = (s) => track(SO_TRACKS, s, 0)[0], soW: Edge = (s) => track(SO_TRACKS, s, 1)[0];
// the decks' edges (the scan's): out from the tracks, and in from them where they part
const soLo = off(soE, -2.85), soHi = off(soW, 2.9);
const SO_DECKS: { from: number; to: number; lo: Edge; hi: Edge }[] = [
  { from: SO_ENDS[0], to: SO_SPLIT, lo: soLo, hi: soHi },
  { from: SO_SPLIT, to: SO_ENDS[1], lo: soLo, hi: off(soE, 2.45) },
  { from: SO_SPLIT, to: SO_ENDS[1], lo: off(soW, -2.5), hi: soHi },
];
// heights from the rails' top; the platform's north end, where the inner railings stop
const SO_FASCIA = -1.35, SO_SOFFIT = -1.05, SO_PLATFORM = 122.5;

export function buildSockenvagen(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (s: number, u: number) => railAt(SO_TRACKS, s, u);
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  for (const d of SO_DECKS) slabDeck(B, SO, SO_TRACKS, steps(d.from, d.to, [...SO_FACES, ...SO_PIERS]), d.lo, d.hi, SO_FASCIA, SO_SOFFIT);
  // a rectangular column under each track at each pier
  B.tint(BOARDS);
  for (const s of SO_PIERS) {
    for (const u of [soE(s), soW(s)]) {
      const c = SO.at(s, u), g = ground(c[0], c[1]) ?? rail(s, u) - 5.5;
      post(B, c, SO.t, 0.9, 1.6, g - 0.3, rail(s, u) + SO_SOFFIT + 0.02, 'gt-boards', 2.4);
    }
  }
  // the abutments, the southern one under each deck
  abutment(B, SO, SO_TRACKS, ground, SO_ENDS[0], SO_FACES[0], soLo, soHi, SO_SOFFIT, 'gt-boards');
  for (const d of SO_DECKS.slice(1)) abutment(B, SO, SO_TRACKS, ground, SO_FACES[1], SO_ENDS[1], d.lo, d.hi, SO_SOFFIT, 'gt-boards');
  // the railings: the outer ones the whole length, the inner ones as far as the platform
  B.tint(RAILING);
  for (const e of [off(soLo, 0.2), off(soHi, -0.2)]) pipeRailing(B, line(SO, steps(SO_ENDS[0], SO_ENDS[1]), e, at(KERB)), 1.1, 2.4);
  for (const e of [off(SO_DECKS[1].hi, -0.2), off(SO_DECKS[2].lo, 0.2)]) pipeRailing(B, line(SO, steps(SO_SPLIT, SO_PLATFORM), e, at(KERB)), 1.1, 2.4);
  // the height clear, over Sockenvägen on both faces
  const r = SO.right;
  for (const [e, n] of [[soLo, -1], [soHi, 1]] as const) {
    sign(B, v3(SO.at(SO_ROAD, e(SO_ROAD)), rail(SO_ROAD, e(SO_ROAD)) + (SO_FASCIA + KERB) / 2), [r[0] * n, 0, r[2] * n], 0.75, 'fl-sign42');
  }
}

// ------------------------------------------------------------------ the steel bridges
// A concrete deck on plate girders between its abutments' faces, braced underneath with a cross of
// angles in each bay, on steel crossheads carried by rows of round columns.
interface Steel {
  F: Frame; rows: Rows; ends: V2; faces: V2; columns: number[]; lo: Edge; hi: Edge;
  girders: number; across: number; depth: number; abutment: string; stone: number;
}
const STEEL_SLAB = -0.9;

function buildSteel(B: Builder, ground: Ground, d: Steel) {
  const { F, rows, lo, hi } = d;
  const rail = (s: number, u: number) => railAt(rows, s, u);
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  // the deck slab, and a kerb along each edge
  const ss = steps(d.ends[0], d.ends[1], [...d.faces, ...d.columns]);
  B.tint(UNDER);
  band(B, F, ss, off(lo, 0.3), off(hi, -0.3), at(STEEL_SLAB), at(FLOOR), 'fl-under', 3);
  B.tint(CONCRETE);
  band(B, F, ss, lo, off(lo, 0.3), at(STEEL_SLAB), at(KERB), 'concrete', 3);
  band(B, F, ss, off(hi, -0.3), hi, at(STEEL_SLAB), at(KERB), 'concrete', 3);

  // the girders, from abutment to abutment: a web and a bottom flange each, the outer ones the
  // fascias
  const g = (k: number): Edge => (s) => lo(s) + 0.2 + ((hi(s) - lo(s) - 0.4) * k) / (d.girders - 1);
  const bottom = -d.depth;
  const gs = steps(d.faces[0] - 0.4, d.faces[1] + 0.4, d.columns);
  B.tint(PAINT);
  for (let k = 0; k < d.girders; k++) {
    const e = g(k), w = k === 0 || k === d.girders - 1 ? 0.06 : 0.03;
    band(B, F, gs, off(e, -w), off(e, w), at(bottom), at(STEEL_SLAB), 'metal', 1);
    band(B, F, gs, off(e, -0.2), off(e, 0.2), at(bottom - 0.04), at(bottom), 'metal', 1);
  }
  // the bays, about 4.5 m, between the faces and the column rows: a cross frame at each end, a
  // cross of angles between each two girders
  const marks = [d.faces[0], ...d.columns, d.faces[1]], bays: number[] = [];
  for (let i = 0; i + 1 < marks.length; i++) {
    const n = Math.max(1, Math.round((marks[i + 1] - marks[i]) / 4.5));
    for (let j = 0; j < n; j++) bays.push(marks[i] + ((marks[i + 1] - marks[i]) * j) / n);
  }
  bays.push(d.faces[1]);
  const p = (s: number, u: number, y: number): V3 => v3(F.at(s, u), rail(s, u) + y);
  B.tint(0x55595b);
  for (let i = 0; i < bays.length; i++) {
    const s = bays[i];
    bar(B, p(s, g(0)(s), bottom + 0.35), p(s, g(d.girders - 1)(s), bottom + 0.35), 0.12, 0.3, 'metal');
    if (i + 1 === bays.length) continue;
    const t = bays[i + 1];
    for (let k = 0; k + 1 < d.girders; k++) {
      bar(B, p(s, g(k)(s), bottom + 0.12), p(t, g(k + 1)(t), bottom + 0.12), 0.08, 0.08, 'metal');
      bar(B, p(s, g(k + 1)(s), bottom + 0.12), p(t, g(k)(t), bottom + 0.12), 0.08, 0.08, 'metal');
    }
  }
  // the crossheads, and the columns under them
  for (const s of d.columns) {
    B.tint(PAINT);
    band(B, F, [s - 0.3, s + 0.3], off(lo, 0.3), off(hi, -0.3), at(bottom - 0.65), at(bottom - 0.04), 'metal', 1);
    B.tint(0x8e9394);
    for (let k = 0; k < d.across; k++) {
      const u = lo(s) + 1 + ((hi(s) - lo(s) - 2) * k) / (d.across - 1), c = F.at(s, u), y = ground(c[0], c[1]) ?? rail(s, u) - 5;
      B.lathe(c[0], c[1], [[0.2, y - 0.3], [0.2, rail(s, u) + bottom - 0.63]], 'metal', 12, 1);
    }
  }
  // the abutments, a seat under the girders' ends and the wall behind it up to the slab
  B.tint(d.stone);
  for (const [face, end, seat] of [[d.faces[0], d.ends[0], d.faces[0] - 0.6], [d.faces[1], d.ends[1], d.faces[1] + 0.6]]) {
    const [a, b] = face < end ? [face, seat] : [seat, face];
    abutment(B, F, rows, ground, a, b, lo, hi, bottom - 0.04, d.abutment);
    const [c, e] = face < end ? [seat, end] : [end, seat];
    abutment(B, F, rows, ground, c, e, lo, hi, STEEL_SLAB, d.abutment);
  }
  // the railings along both edges
  B.tint(RAILING);
  for (const e of [off(lo, 0.15), off(hi, -0.15)]) pipeRailing(B, line(F, steps(d.ends[0], d.ends[1]), e, at(KERB)), 1.1, 2);
}

// Blåsut's bridge over Sofielundsvägen: s metres southwards from its north end, u to the right
// (west). The western track is the first. The footway runs along its eastern side.
export const SOFIELUNDSVAGEN = new Frame([1824, 4715], [0.06, 1]);
const SF = SOFIELUNDSVAGEN;
const SF_TRACKS: Rows = [
  [-4, 2.42, 37.766, -1.28, 37.784], [0, 2.48, 37.771, -1.10, 37.792], [4, 2.53, 37.779, -0.96, 37.800], [8, 2.58, 37.787, -0.81, 37.808],
  [12, 2.63, 37.793, -0.70, 37.814], [16, 2.69, 37.798, -0.59, 37.819], [20, 2.74, 37.805, -0.49, 37.827], [24, 2.79, 37.815, -0.40, 37.836],
  [28, 2.85, 37.822, -0.32, 37.843], [32, 2.91, 37.827, -0.26, 37.848], [36, 2.97, 37.832, -0.19, 37.853], [40, 3.03, 37.837, -0.14, 37.857],
  [44, 3.10, 37.841, -0.09, 37.860], [48, 3.17, 37.846, -0.06, 37.860], [52, 3.24, 37.850, -0.02, 37.860],
];
// the footway between its kerb and the railing on the tracks' side, its height from the rails' top,
// and its northern end (OpenStreetMap's)
const SF_WALK: V2 = [-8.45, -3.45], SF_WALK_TOP = -0.3, SF_WALK_END = -3.1;
const SF_STEEL: Steel = {
  F: SF, rows: SF_TRACKS, ends: [3.8, 47.5], faces: [7.5, 41.5], columns: [15.5, 24.4, 33.5],
  lo: () => -8.75, hi: (s) => track(SF_TRACKS, s, 0)[0] + 2.75, girders: 7, across: 4, depth: 1.9, abutment: 'gt-boards', stone: BOARDS,
};

export function buildSofielundsvagen(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  buildSteel(B, ground, SF_STEEL);
  const rail = (s: number, u: number) => railAt(SF_TRACKS, s, u);
  // the footway on the deck, and north of it down a ramp to the ground at its end (it ends on the
  // deck at the south)
  const [w0, w1] = SF_WALK, [e0, e1] = SF_STEEL.ends, r0 = SF_WALK_END;
  B.tint(ASPHALT);
  band(B, SF, steps(e0, e1), () => w0, () => w1, (s, u) => rail(s, u) + FLOOR, (s, u) => rail(s, u) + SF_WALK_TOP, 'rp-asphalt', 6);
  const at = (s: number, u: number) => ground(...SF.at(s, u)) ?? rail(s, u) + SF_WALK_TOP;
  const ramp = (s: number, u: number) => at(r0, u) + 0.04 + (rail(e0, u) + SF_WALK_TOP - at(r0, u) - 0.04) * (s - r0) / (e0 - r0);
  band(B, SF, steps(r0, e0, [], 1.5), () => w0, () => w1, (s, u) => Math.min(at(s, u), ramp(s, u)) - 0.2, ramp, 'rp-asphalt', 6);
  // and the railing between it and the tracks
  B.tint(RAILING);
  pipeRailing(B, line(SF, steps(e0, e1), () => w1 + 0.1, (s, u) => rail(s, u) + SF_WALK_TOP), 1.1, 2);
}

// The bridge over Hammarbybacken between Skärmarbrink and Gullmarsplan: s metres west-north-westwards
// from its eastern end, u to the right (north-north-east). Three tracks, the northern one first.
export const HAMMARBYBACKEN = new Frame([1565, 3852], [-0.929, -0.370]);
const HB = HAMMARBYBACKEN;
const HB_TRACKS: Rows = [
  [-4, 0.03, 41.378, -3.24, 41.432, -7.40, 41.460], [0, 0.15, 41.318, -3.12, 41.377, -7.21, 41.408], [4, 0.26, 41.258, -3.00, 41.323, -7.05, 41.356],
  [8, 0.32, 41.191, -2.94, 41.253, -6.96, 41.293], [12, 0.35, 41.123, -2.88, 41.182, -6.88, 41.231], [16, 0.35, 41.050, -2.86, 41.117, -6.85, 41.173],
  [20, 0.34, 40.979, -2.85, 41.049, -6.84, 41.114], [24, 0.29, 40.911, -2.86, 40.978, -6.88, 41.051], [28, 0.21, 40.836, -2.90, 40.903, -6.95, 40.983],
  [32, 0.11, 40.754, -2.95, 40.824, -7.06, 40.907], [36, 0.00, 40.673, -3.02, 40.745, -7.17, 40.830],
];
const HB_STEEL: Steel = {
  F: HB, rows: HB_TRACKS, ends: [-0.2, 31.6], faces: [7.5, 26.5], columns: [11.8, 22.2],
  lo: (s) => track(HB_TRACKS, s, 2)[0] - 2.9, hi: (s) => track(HB_TRACKS, s, 0)[0] + 2.85, girders: 7, across: 6, depth: 1.6,
  abutment: 'fl-granite', stone: 0xd8d4cc,
};

export function buildHammarbybacken(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  buildSteel(B, ground, HB_STEEL);
}
