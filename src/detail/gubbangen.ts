import * as THREE from 'three';
import * as T from '../textures';
import type { Builder, V2, V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';
import { loft, post } from './ropsten.ts';

// What the green line looks out on between Tallkrogen and Gubbängen (1950), beyond what the city
// draws there itself (its villas and blocks with facades, the streets and the trees: see the
// areas in src/detail/areas.ts):
//
// - Tallkrogen's two bridges over Victor Balcks väg, one for each track, at the south-west end of
//   its platform: concrete slabs on deep edge beams in two spans, on a square column each in the
//   middle of the road, between abutments of concrete cast against boards; galvanised railings of
//   two rails on posts along their outer edges, and the sign for the height clear under them,
//   "3,7 m", over each half of the road on both faces;
// - Herrhagsvägen's bridge over the tracks at Gubbängen's north end, beside the ticket hall: a
//   concrete slab, skewed to cross the tracks at 53°, with the road and its pavements on it and a
//   railing of dark grey bars along its edges, on abutment walls beside the tracks;
// - chain-link fences on galvanised posts along both sides of the line between the stations.
//
// The bridges' plans, heights and edges from Lantmäteriet's laser scan (Laserdata Nedladdning,
// skog, April 2021, CC BY 4.0), Herrhagsvägen's joints over the abutments from Google's 3D mesh,
// the looks from photographs on Mapillary (2019–2024) and Wikimedia Commons (2016–2018); the fences'
// lines follow the tracks (public/data/track-geometry.json). The network draws the tracks on
// Tallkrogen's bridges and leaves their girders, columns and railings to this
// (src/detail/viaducts.ts); OpenStreetMap's road bridges are left out of the city
// (tools/build-city.ts), so without this Herrhagsvägen would stop at the cutting's edges.

type Ground = (x: number, z: number) => number | null;
type V3s = V3[];

addMaterial('gt-boards', () => standard(T.finish('boardConcrete'), 0.95));
addMaterial('gt-sign', () => standard(T.heightLimitSign('3,7 m'), 0.5, 0, { alphaTest: 0.5 }));
addMaterial('gt-chain', () => standard(T.chainLink(), 0.6, 0.4, { alphaTest: 0.5, side: THREE.DoubleSide }));
addMaterial('gt-bars', () => standard(T.railingBars(), 0.6, 0.3, { alphaTest: 0.5, side: THREE.DoubleSide }));

const UP: V3 = [0, 1, 0];
const v3 = ([x, z]: V2, y: number): V3 => [x, y, z];

// A straight frame on the ground: s metres along `t` from `o`, u to its right.
class Frame {
  readonly t: V2;
  constructor(readonly o: V2, t: V2) { const l = Math.hypot(t[0], t[1]); this.t = [t[0] / l, t[1] / l]; }
  at(s: number, u: number): V2 { return [this.o[0] + this.t[0] * s - this.t[1] * u, this.o[1] + this.t[1] * s + this.t[0] * u]; }
  get along(): V3 { return [this.t[0], 0, this.t[1]]; }
  get right(): V3 { return [-this.t[1], 0, this.t[0]]; }
}

// A block standing on a convex plan (s, u) in a frame, between a bottom and a top by (s, u): its top,
// its underside and its sides.
function block(B: Builder, F: Frame, plan: V2[], bottom: (s: number, u: number) => number, top: (s: number, u: number) => number,
  mat: string, tile: number, { faces = 'all' as 'all' | 'sides' | 'top' } = {}) {
  const lo = plan.map(([s, u]) => v3(F.at(s, u), bottom(s, u))), hi = plan.map(([s, u]) => v3(F.at(s, u), top(s, u)));
  if (faces !== 'sides') B.poly(hi, UP, mat, tile);
  if (faces === 'top') return;
  if (faces === 'all') B.poly(lo, [0, -1, 0], mat, tile);
  // (the plan's way round, to find each side's outside)
  let area = 0;
  for (let k = 0; k < plan.length; k++) { const [a, b] = [plan[k], plan[(k + 1) % plan.length]]; area += a[0] * b[1] - b[0] * a[1]; }
  const al = F.along, r = F.right;
  for (let k = 0; k < plan.length; k++) {
    const j = (k + 1) % plan.length, ds = plan[j][0] - plan[k][0], du = plan[j][1] - plan[k][1];
    // outward in (s, u): the edge turned a quarter away from the inside
    const [ns, nu] = area > 0 ? [du, -ds] : [-du, ds];
    B.poly([lo[k], lo[j], hi[j], hi[k]], [al[0] * ns + r[0] * nu, 0, al[2] * ns + r[2] * nu], mat, tile);
  }
}

// A bar from p to q, w wide and h deep, its ends open (rails, tubes).
function bar(B: Builder, p: V3, q: V3, w: number, h: number, mat: string) {
  const d: V3 = [q[0] - p[0], 0, q[2] - p[2]], l = Math.hypot(d[0], d[2]) || 1, n: V3 = [-d[2] / l * w / 2, 0, d[0] / l * w / 2];
  const at = (o: V3, a: number, b: number): V3 => [o[0] + n[0] * a, o[1] + (h / 2) * b, o[2] + n[2] * a];
  const side = (a0: number, b0: number, a1: number, b1: number, nn: V3) =>
    B.poly([at(p, a0, b0), at(q, a0, b0), at(q, a1, b1), at(p, a1, b1)], nn, mat, 1);
  side(-1, 1, 1, 1, UP);
  side(-1, -1, 1, -1, [0, -1, 0]);
  side(1, -1, 1, 1, n);
  side(-1, -1, -1, 1, [-n[0], 0, -n[2]]);
}

// A railing of rails on posts along a line of feet: the top rail `h` high and one halfway, a post
// every `every` metres or so.
function pipeRailing(B: Builder, feet: V3[], h: number, every: number) {
  for (let i = 0; i + 1 < feet.length; i++) {
    const a = feet[i], b = feet[i + 1];
    for (const y of [h, h / 2]) bar(B, [a[0], a[1] + y, a[2]], [b[0], b[1] + y, b[2]], 0.05, 0.05, 'metal');
  }
  let run = 0;
  for (let i = 0; i + 1 < feet.length; i++) {
    const a = feet[i], b = feet[i + 1], l = Math.hypot(b[0] - a[0], b[2] - a[2]), t: V2 = [(b[0] - a[0]) / l, (b[2] - a[2]) / l];
    for (; run <= l; run += every) {
      const f = run / l;
      post(B, [a[0] + (b[0] - a[0]) * f, a[2] + (b[2] - a[2]) * f], t, 0.06, 0.06, a[1] + (b[1] - a[1]) * f - 0.1, a[1] + (b[1] - a[1]) * f + h, 'metal', 1);
    }
    run -= l;
  }
}

// A sign facing `n`, its middle at c, w wide.
function sign(B: Builder, c: V3, n: V3, w: number, mat: string) {
  const r: V3 = [-n[2], 0, n[0]];
  const P = (a: number, b: number): V3 => [c[0] + r[0] * a + n[0] * 0.02, c[1] + b, c[2] + r[2] * a + n[2] * 0.02];
  B.tint(0xffffff);
  B.poly([P(w / 2, -w / 2), P(-w / 2, -w / 2), P(-w / 2, w / 2), P(w / 2, w / 2)], n, mat, 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
}

// ------------------------------------------------------------------ Tallkrogen's bridges
// Drawn from the middle of their spans, between the two tracks: s metres along them towards the
// station (north-east), u to the right (south-east). The road under them is at 28.0–28.2 m.
export const TALLKROGEN_BRIDGES = new Frame([1490.5, 6736.7], [0.653, -0.757]);
const TK = TALLKROGEN_BRIDGES;
// the rails' top (the tracks' own, public/data/track-geometry.json)
const TK_RAIL = (s: number) => 33.835 + 0.0045 * s;
// the abutments' faces, the ends of the network's bridge on them (its tracks are a bridge for 22 m
// either side), the slabs' underside and the edge beams' bottom (the clearance is signed 3.7 m)
const TK_FACES: V2 = [-10.6, 13.0], TK_ENDS: V2 = [-22.5, 22.5], TK_SOFFIT = 31.95, TK_FASCIA = 31.85;
// the two decks across (the scan's edges; a gap of 0.6 m between them, the eastern one widening a
// little towards the station as its track parts from the other), which side of each is outside,
// and its column (the scan's)
const TK_DECKS = [
  { u0: () => -6.9, u1: () => -1.0, outer: -1, column: [1.79, -3.21] as V2 },
  { u0: () => -0.4, u1: (s: number) => 5.75 + 0.04 * s, outer: 1, column: [1.31, 3.4] as V2 },
];
const TK_EDGE = 0.45, TK_RAILING = 1.1;
const TK_CONCRETE = 0xb3afa6, TK_UNDER = 0x8d8a84, TK_BOARDS = 0xf0ede6, TK_STEEL = 0xaeb3b3;

export function buildTallkrogenBridges(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const [a, b] = [TK_FACES[0] - 0.8, TK_FACES[1] + 0.8];
  for (const d of TK_DECKS) {
    const outer = d.outer < 0 ? d.u0 : d.u1, inner = d.outer < 0 ? d.u1 : d.u0;
    // the edge beam on the outside, and the slab in from it to the gap, under the network's floor
    const beamIn = (s: number) => outer(s) - d.outer * TK_EDGE;
    const at = (f: (s: number) => number, g: (s: number) => number): V2[] => [[a, f(a)], [b, f(b)], [b, g(b)], [a, g(a)]];
    B.tint(TK_CONCRETE);
    block(B, TK, at(outer, beamIn), () => TK_FASCIA, (s) => TK_RAIL(s) - 0.3, 'concrete', 3);
    B.tint(TK_UNDER);
    block(B, TK, at(beamIn, inner), () => TK_SOFFIT, (s) => TK_RAIL(s) - 0.64, 'concrete', 3);
    // the column in the middle of the road
    B.tint(TK_CONCRETE);
    const c = TK.at(...d.column), al = TK.along;
    post(B, c, [al[0], al[2]], 0.6, 0.8, (ground(c[0], c[1]) ?? 28.1) - 0.3, TK_SOFFIT + 0.02, 'concrete', 2);
    // the railing along the outer edge, the whole length of the bridge and its abutments
    B.tint(TK_STEEL);
    const feet: V3[] = [];
    for (let s = TK_ENDS[0]; s <= TK_ENDS[1] + 0.01; s += 2.5) feet.push(v3(TK.at(s, outer(s) - d.outer * 0.2), TK_RAIL(s) - 0.3));
    pipeRailing(B, feet, TK_RAILING, 1.7);
    // the height clear under them, over each half of the road
    const r = TK.right, n: V3 = [r[0] * d.outer, 0, r[2] * d.outer];
    for (const s of [(TK_FACES[0] + d.column[0]) / 2, (d.column[0] + TK_FACES[1]) / 2]) {
      sign(B, v3(TK.at(s, outer(s)), (TK_FASCIA + TK_RAIL(s) - 0.3) / 2), n, 0.75, 'gt-sign');
    }
  }
  // the abutments, cast against boards: across both decks at the south-west end; at the station's
  // end either side of its stair house, whose door onto the road is a metre behind their faces
  // (src/open-styles.ts)
  const east = (s: number) => TK_DECKS[1].u1(s) + 0.3;
  const foot = (plan: V2[]) => Math.min(...plan.map(([s, u]) => { const p = TK.at(s, u); return ground(p[0], p[1]) ?? 28.1; })) - 1;
  const top = (s: number) => TK_RAIL(s) - 0.66;
  B.tint(TK_BOARDS);
  for (const plan of [
    [[TK_ENDS[0], -7.4], [TK_FACES[0], -7.4], [TK_FACES[0], east(TK_FACES[0])], [TK_ENDS[0], east(TK_ENDS[0])]],
    [[TK_FACES[1], -7.4], [TK_ENDS[1], -7.4], [TK_ENDS[1], -1.5], [TK_FACES[1], -1.5]],
    [[TK_FACES[1], 2.2], [TK_ENDS[1], 2.2], [TK_ENDS[1], east(TK_ENDS[1])], [TK_FACES[1], east(TK_FACES[1])]],
  ] as V2[][]) {
    const y0 = foot(plan);
    block(B, TK, plan, () => y0, (s) => top(s), 'gt-boards', 2.4);
  }
}

// ------------------------------------------------------------------ Herrhagsvägen's bridge
// Drawn along the road's middle, east-south-eastwards: s metres from over the middle of the
// cutting, u to the right (south-south-west). Its ends run with the tracks, so they move 0.743 m
// along the road for every metre across it.
export const HERRHAGSVAGEN = new Frame([1309.25, 7504.85], [0.870, 0.494]);
const HV = HERRHAGSVAGEN;
// the road's top (the scan's), the joints over the abutments at the middle, the skew
const HV_TOP = (s: number) => 39.91 + 0.0085 * s;
const HV_JOINTS: V2 = [-8.9, 9.5], HV_SKEW = 0.743;
const HV_END = (k: 0 | 1, u: number) => HV_JOINTS[k] + HV_SKEW * u;
// the deck's edges, the road between its kerbs, and where the ticket hall's front meets the
// southern edge (the hall is the station's own: src/open-styles.ts)
const HV_EDGES: V2 = [-8.6, 6.6], HV_ROAD: V2 = [-4.5, 2.7], HV_HALL = 2.5;
const HV_DEPTH = 1.1, HV_KERB = 0.12, HV_BEAM = 0.3;
const HV_CONCRETE = 0xb4b1a9, HV_UNDER = 0x8f8c86, HV_ASPHALT = 0x606265, HV_PAVEMENT = 0xa29f98, HV_BARS = 0x3c4044;

export function buildHerrhagsvagen(B: Builder) {
  B.place([0, 0, 0], 0);
  // a strip across the deck from u0 to u1, end to end
  const strip = (u0: number, u1: number): V2[] => [[HV_END(0, u0), u0], [HV_END(1, u0), u0], [HV_END(1, u1), u1], [HV_END(0, u1), u1]];
  const top = (s: number) => HV_TOP(s);
  // the slab, its edge beams, the road and the pavements on it
  B.tint(HV_UNDER);
  block(B, HV, strip(HV_EDGES[0] + HV_BEAM, HV_EDGES[1] - HV_BEAM), (s) => top(s) - HV_DEPTH, (s) => top(s) - 0.02, 'concrete', 3);
  B.tint(HV_CONCRETE);
  for (const [u0, u1] of [[HV_EDGES[0], HV_EDGES[0] + HV_BEAM], [HV_EDGES[1] - HV_BEAM, HV_EDGES[1]]]) {
    block(B, HV, strip(u0, u1), (s) => top(s) - HV_DEPTH - 0.05, (s) => top(s) + 0.3, 'concrete', 3);
  }
  B.tint(HV_ASPHALT);
  block(B, HV, strip(...HV_ROAD), () => 0, top, 'rp-asphalt', 6, { faces: 'top' });
  B.tint(HV_PAVEMENT);
  for (const [u0, u1] of [[HV_EDGES[0] + HV_BEAM, HV_ROAD[0]], [HV_ROAD[1], HV_EDGES[1] - HV_BEAM]]) {
    block(B, HV, strip(u0, u1), (s) => top(s) - 0.05, (s) => top(s) + HV_KERB, 'rp-paving', 2);
  }

  // the abutments: walls with the tracks under the deck's ends, reaching out beyond its edges to hold
  // the cutting's sides, down to the tracks' formation
  B.tint(HV_CONCRETE);
  for (const k of [0, 1] as const) {
    const back = k === 0 ? -0.8 : 0.8, u0 = HV_EDGES[0] - 2.5, u1 = HV_EDGES[1] + 2.5;
    const plan: V2[] = [[HV_END(k, u0), u0], [HV_END(k, u0) + back, u0], [HV_END(k, u1) + back, u1], [HV_END(k, u1), u1]];
    block(B, HV, plan, () => 33.4, (s) => top(s) - 0.2, 'gt-boards', 2.4);
  }

  // the railings: bars on the edge beams, the southern one only as far as the ticket hall
  const al = HV.along, r = HV.right;
  for (const [u, from, to, side] of [[HV_EDGES[0] + 0.15, HV_END(0, HV_EDGES[0]), HV_END(1, HV_EDGES[0]), -1],
    [HV_EDGES[1] - 0.15, HV_END(0, HV_EDGES[1]), HV_HALL, 1]] as const) {
    const n: V3 = [r[0] * side, 0, r[2] * side];
    const ss: number[] = [];
    for (let s = from; s < to - 0.01; s += 2) ss.push(s);
    ss.push(to);
    B.tint(HV_BARS);
    let run = 0;
    for (let i = 0; i + 1 < ss.length; i++) {
      const p = v3(HV.at(ss[i], u), top(ss[i]) + 0.3), q = v3(HV.at(ss[i + 1], u), top(ss[i + 1]) + 0.3), l = ss[i + 1] - ss[i];
      B.poly([p, q, [q[0], q[1] + 1.0, q[2]], [p[0], p[1] + 1.0, p[2]]], n, 'gt-bars', 1, [[run, 0], [run + l, 0], [run + l, 1], [run, 1]]);
      bar(B, [p[0], p[1] + 1.0, p[2]], [q[0], q[1] + 1.0, q[2]], 0.08, 0.05, 'metal');
      run += l;
    }
    for (const s of [from, to]) post(B, HV.at(s, u), [al[0], al[2]], 0.1, 0.1, top(s) + 0.3, top(s) + 1.05, 'metal', 1);
  }
}

// ------------------------------------------------------------------ the rock face
// North of Herrhagsvägen the tracks run in a cutting blasted through the rock. On its east side a
// face of grey granite rises 4.5–5.5 m from beside the eastern track to the hillside, for 60 m (the
// laser scan); its west side is a gentler slope of rock, grass and trees, as the city's ground has
// it. The face is drawn 4.6 m from the track, where the city's ground beside the track starts to
// rise, and the hillside is the elevation model's from 10.5 m (data/ground-corrections.json,
// `walled`): the face's top, turf over the rock, runs back over the track's slope between to meet
// it. Its foot every 2–2.5 m: world x, z, the formation's height and the crest's (the scan's).
addMaterial('gt-rock', () => standard(T.finish('blastedRock'), 0.95));
// (the city's own ground, coloured as its grass)
addMaterial('gt-turf', () => standard(T.ground(), 1));
const ROCK: [number, number, number, number][] = [
  [1302.2, 7330, 33.96, 36.6], [1302.3, 7332, 33.96, 36.8], [1302.3, 7334, 33.96, 37.1], [1302.4, 7336, 33.95, 37.3],
  [1302.5, 7338, 33.95, 37.6], [1302.6, 7340.5, 33.95, 38], [1302.7, 7343, 33.95, 38.6], [1302.8, 7345.5, 33.94, 39.1],
  [1302.9, 7348, 33.94, 39.4], [1303, 7350.4, 33.94, 39.5], [1303.1, 7352.4, 33.94, 39.5],
  [1303.3, 7354.4, 33.93, 39.7], [1303.4, 7356.4, 33.93, 39.9], [1303.5, 7358.4, 33.93, 39.8],
  [1303.6, 7360.9, 33.93, 39.7], [1303.8, 7363.4, 33.92, 39.3], [1304, 7365.9, 33.92, 39],
  [1304.1, 7368.4, 33.91, 38.7], [1304.3, 7370.8, 33.91, 38.5], [1304.4, 7372.8, 33.91, 38.5],
  [1304.6, 7374.8, 33.9, 38.8], [1304.7, 7376.8, 33.9, 39], [1304.8, 7378.8, 33.9, 39.4], [1305, 7380.9, 33.9, 39.7],
  [1305.2, 7383.4, 33.9, 39.9], [1305.4, 7385.9, 33.89, 39.8], [1305.6, 7388.4, 33.89, 39.6],
  [1305.8, 7390.8, 33.89, 39.6], [1305.9, 7392.8, 33.88, 39.5], [1306.1, 7394.8, 33.88, 39.2],
  [1306.3, 7396.8, 33.87, 39], [1306.4, 7398.8, 33.87, 38.6], [1306.6, 7400.8, 33.87, 38.2],
  [1306.8, 7403.3, 33.87, 37.7]
];
export const ROCK_ANCHOR: V2 = [1304.5, 7367];
// how far it comes down to the foot at either end, how far it leans back for each metre up, and how
// far its top runs back to the hillside
const ROCK_TAPER = 8, ROCK_LEAN = 0.15, ROCK_BACK = [0.6, 2, 4, 6.5], ROCK_ROWS = 7;
const ROCK_FACE = 0xd6d8d8, ROCK_TURF = 0x6a7a4b;

// a little relief over the face, smooth, by world position: −1 to 1
const bumps = (x: number, y: number, z: number) => Math.sin(x * 1.7 + z * 0.9) * 0.5 + Math.sin(z * 2.3 - y * 1.9) * 0.3 + Math.sin(y * 3.1 + x * 0.7) * 0.2;

export function buildRockFace(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const n = ROCK.length, run = [0];
  for (let i = 1; i < n; i++) run.push(run[i - 1] + Math.hypot(ROCK[i][0] - ROCK[i - 1][0], ROCK[i][1] - ROCK[i - 1][1]));
  // away from the track: the line runs southwards, so east is to its left
  const out = (i: number): V2 => {
    const a = ROCK[Math.max(0, i - 1)], b = ROCK[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
  };
  const face: V3[][] = [], top: V3[][] = [];
  ROCK.forEach(([x, z, foot, crest], i) => {
    const o = out(i), f = Math.min(1, run[i] / ROCK_TAPER, (run[n - 1] - run[i]) / ROCK_TAPER), y1 = foot + 0.3 + (crest - foot - 0.3) * f;
    const col: V3[] = [];
    for (let k = 0; k <= ROCK_ROWS; k++) {
      const y = foot - 0.3 + ((y1 - foot + 0.3) * k) / ROCK_ROWS, d = (y - foot) * ROCK_LEAN + (k > 0 && k < ROCK_ROWS ? 0.25 * bumps(x, y, z) : 0);
      col.push([x + o[0] * d, y, z + o[1] * d]);
    }
    face.push(col);
    const [tx, , tz] = col[ROCK_ROWS];
    top.push([col[ROCK_ROWS], ...ROCK_BACK.map((b): V3 => {
      const px = tx + o[0] * b, pz = tz + o[1] * b;
      return [px, Math.max(y1 - 0.15 * b, (ground(px, pz) ?? -1e3) + 0.08), pz];
    })]);
  });
  // (facing the track, west, and the top up)
  B.tint(ROCK_FACE);
  loft(B, face, 'gt-rock', (i) => { const o = out(i); return [-o[0], 0.2, -o[1]]; }, 4.8);
  B.tint(ROCK_TURF);
  loft(B, top, 'gt-turf', () => UP, 8);
}

// ------------------------------------------------------------------ the fences
// Chain-link, 1.8 m high on galvanised posts 3 m apart with a rail along the top, 3.6 m out from
// each track on its outer side, on the formation: from Tallkrogen's bridges to the cutting under
// Herrhagsvägen (the stations' own fences go on along their platforms: src/open-styles.ts). Where
// the ground rises well over the formation beside the track, in the cuttings, the rock and the
// slopes keep people out instead, and so does the rock face; on Tallkrogen's bridges, their
// railings. The fences' feet every 8 m: world x, z and the formation's height.
const FENCE_H = 1.8, FENCE_POSTS = 3;
const FENCE_WEST: V3s = [
  [1473.5, 6746.1, 33.15], [1468.3, 6752.2, 33.1], [1463.2, 6758.3, 33.05], [1458.1, 6764.5, 33], [1453, 6770.7, 32.95],
  [1448, 6777, 32.89], [1443.1, 6783.2, 32.84], [1438.2, 6789.6, 32.79], [1433.3, 6796, 32.74], [1428.6, 6802.5, 32.68],
  [1423.9, 6809, 32.63], [1419.3, 6815.6, 32.58], [1414.9, 6822.3, 32.53], [1410.5, 6829.1, 32.49], [1406.3, 6835.9, 32.45],
  [1402.1, 6842.8, 32.41], [1398.1, 6849.7, 32.38], [1394.2, 6856.8, 32.36], [1390.4, 6863.9, 32.33], [1386.7, 6871, 32.32],
  [1383.1, 6878.2, 32.31], [1379.7, 6885.5, 32.3], [1376.4, 6892.8, 32.3], [1373.2, 6900.2, 32.31], [1370.1, 6907.6, 32.32],
  [1367.1, 6915.1, 32.34], [1364.2, 6922.5, 32.36], [1361.5, 6930.1, 32.39], [1358.8, 6937.7, 32.42], [1356.2, 6945.3, 32.46],
  [1353.7, 6952.9, 32.5], [1351.4, 6960.6, 32.55], [1349.1, 6968.2, 32.6], [1346.8, 6975.9, 32.67], [1344.6, 6983.6, 32.73],
  [1342.4, 6991.3, 32.78], [1340.3, 6999, 32.84], [1338.2, 7006.7, 32.91], [1336.1, 7014.5, 32.98], [1334, 7022.2, 33.04],
  [1332, 7029.9, 33.11], [1330, 7037.7, 33.17], [1328, 7045.4, 33.24], [1326.1, 7053.2, 33.31], [1324.2, 7061, 33.37],
  [1322.3, 7068.7, 33.43], [1320.5, 7076.5, 33.49], [1318.7, 7084.3, 33.55], [1316.9, 7092.1, 33.61], [1315.1, 7099.9, 33.66],
  [1313.4, 7107.7, 33.71], [1311.7, 7115.6, 33.76], [1310.1, 7123.4, 33.8], [1308.6, 7131.2, 33.84], [1307.1, 7139.1, 33.88],
  [1305.6, 7147, 33.91], [1304.3, 7154.9, 33.93], [1302.9, 7162.8, 33.95], [1301.7, 7170.7, 33.98], [1300.5, 7178.6, 34],
  [1299.3, 7186.5, 34.01], [1298.2, 7194.5, 34.02], [1297.2, 7202.4, 34.04], [1296.3, 7210.4, 34.04], [1295.4, 7218.4, 34.04],
  [1294.6, 7226.3, 34.05], [1293.8, 7234.3, 34.05], [1293.2, 7242.3, 34.05], [1292.6, 7250.3, 34.05], [1292, 7258.3, 34.05],
  [1291.5, 7266.3, 34.04], [1291.1, 7274.3, 34.03], [1290.8, 7282.3, 34.02], [1290.5, 7290.3, 34.01], [1290.3, 7298.3, 34.01],
  [1290.2, 7306.3, 34], [1290.1, 7314.4, 33.98], [1290.2, 7322.3, 33.97], [1290.3, 7330.4, 33.96], [1290.4, 7338.4, 33.96],
  [1290.7, 7346.4, 33.95], [1291, 7354.4, 33.93], [1291.4, 7362.4, 33.92], [1291.8, 7370.4, 33.91], [1292.3, 7378.4, 33.89],
  [1292.8, 7386.4, 33.88], [1293.4, 7394.4, 33.87], [1294, 7402.3, 33.85], [1294.7, 7410.3, 33.84], [1295.3, 7418.3, 33.83],
  [1296, 7426.2, 33.82], [1296.7, 7434.2, 33.8], [1297.4, 7443.3, 33.79], [1298.2, 7452.8, 33.77], [1298.9, 7460.9, 33.76],
  [1299.6, 7469, 33.75], [1300.2, 7477.2, 33.75], [1300.9, 7485.3, 33.74]
];
const FENCE_EAST: V3s = [
  [1482.7, 6754.8, 33.13], [1477.3, 6760.6, 33.09], [1472, 6766.5, 33.04], [1466.8, 6772.4, 32.99], [1461.6, 6778.4, 32.93],
  [1456.6, 6784.5, 32.88], [1451.5, 6790.6, 32.83], [1446.7, 6796.8, 32.77], [1441.9, 6803.1, 32.72], [1437.2, 6809.5, 32.66],
  [1432.6, 6815.9, 32.62], [1428.1, 6822.4, 32.57], [1423.7, 6829, 32.53], [1419.5, 6835.6, 32.49], [1415.3, 6842.3, 32.45],
  [1411.3, 6849.1, 32.41], [1407.3, 6855.9, 32.38], [1403.5, 6862.9, 32.35], [1399.7, 6869.8, 32.34], [1396.1, 6876.9, 32.32],
  [1392.6, 6883.9, 32.31], [1389.2, 6891, 32.3], [1385.9, 6898.3, 32.3], [1382.7, 6905.5, 32.31], [1379.6, 6912.7, 32.32],
  [1376.7, 6920.1, 32.34], [1373.9, 6927.4, 32.36], [1371.2, 6934.9, 32.39], [1368.6, 6942.3, 32.42], [1366.1, 6949.8, 32.46],
  [1363.8, 6957.4, 32.5], [1361.5, 6965, 32.54], [1359.2, 6972.6, 32.6], [1357, 6980.2, 32.66], [1354.9, 6987.9, 32.71],
  [1352.7, 6995.5, 32.77], [1350.6, 7003.2, 32.84], [1348.5, 7010.8, 32.9], [1346.4, 7018.5, 32.98], [1344.4, 7026.2, 33.04],
  [1342.4, 7033.9, 33.11], [1340.4, 7041.6, 33.18], [1338.5, 7049.3, 33.25], [1336.5, 7057, 33.31], [1334.7, 7064.7, 33.38],
  [1332.8, 7072.4, 33.44], [1331, 7080.2, 33.5], [1329.2, 7087.9, 33.56], [1327.4, 7095.6, 33.61], [1325.6, 7103.4, 33.67],
  [1323.9, 7111.1, 33.72], [1322.2, 7118.9, 33.76], [1320.6, 7126.6, 33.81], [1319, 7134.5, 33.84], [1317.5, 7142.2, 33.88],
  [1316.1, 7150, 33.91], [1314.7, 7157.8, 33.94], [1313.4, 7165.6, 33.96], [1312.1, 7173.5, 33.98], [1310.9, 7181.3, 34],
  [1309.8, 7189.2, 34.01], [1308.8, 7197, 34.02], [1307.8, 7204.9, 34.03], [1306.8, 7212.7, 34.03], [1305.9, 7220.7, 34.04],
  [1305.1, 7228.5, 34.04], [1304.3, 7236.4, 34.04], [1303.6, 7244.3, 34.04], [1303, 7252.2, 34.04], [1302.5, 7260.1, 34.03],
  [1302, 7268, 34.02], [1301.6, 7275.9, 34.02], [1301.3, 7283.8, 34.02], [1301.1, 7291.7, 34.01], [1300.9, 7299.7, 34],
  [1300.9, 7307.6, 33.99], [1300.9, 7315.5, 33.98], [1301, 7323.4, 33.97], [1301.2, 7331.3, 33.96], [1301.5, 7339.3, 33.95],
  [1301.9, 7347.2, 33.94], [1302.3, 7355.1, 33.93], [1302.8, 7363, 33.92], [1303.3, 7370.9, 33.91], [1303.8, 7378.9, 33.9],
  [1304.5, 7387.1, 33.89], [1305.1, 7395.2, 33.88], [1305.8, 7403.3, 33.87], [1306.5, 7411.4, 33.85], [1307.2, 7419.4, 33.84],
  [1308, 7427.5, 33.83], [1308.8, 7435.6, 33.81], [1309.6, 7443.7, 33.8], [1310.5, 7451.7, 33.79], [1311.4, 7459.8, 33.78],
  [1312.3, 7467.9, 33.77], [1313.3, 7475.9, 33.76], [1314.3, 7484, 33.75]
];
const FENCE_PART = 12;
// each fence in parts of 12 stretches, each built with the tile its middle is in
// (the western fence's outside is to the right of its way south, the eastern's to the left)
export const FENCE_PARTS = ([[FENCE_WEST, 1], [FENCE_EAST, -1]] as const).flatMap(([line, out]) => {
  const parts: { anchor: V2; pts: V3s; out: 1 | -1 }[] = [];
  for (let i = 0; i + 1 < line.length; i += FENCE_PART) {
    const pts = line.slice(i, i + FENCE_PART + 1), m = pts[pts.length >> 1];
    parts.push({ anchor: [m[0], m[1]], pts, out });
  }
  return parts;
});

export function buildFence(B: Builder, ground: Ground, pts: V3s, out: 1 | -1) {
  B.place([0, 0, 0], 0);
  let run = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az, ay] = pts[i], [bx, bz, by] = pts[i + 1], l = Math.hypot(bx - ax, bz - az);
    const a: V3 = [ax, ay, az], b: V3 = [bx, by, bz], n: V3 = [-(bz - az) / l, 0, (bx - ax) / l];
    // is the ground 3 m beyond it well over the formation (a cutting's side)?
    const cut = (x: number, y: number, z: number) => (ground(x + n[0] * out * 3, z + n[2] * out * 3) ?? -1e3) > y + 2;
    const m: V2 = [(ax + bx) / 2, (az + bz) / 2];
    const rock = ROCK.some(([x, z]) => Math.hypot(x - m[0], z - m[1]) < 3);
    // (on Tallkrogen's bridges and abutments, their railings)
    const d: V2 = [m[0] - TK.o[0], m[1] - TK.o[1]];
    const bridge = Math.abs(d[0] * TK.t[0] + d[1] * TK.t[1]) < TK_ENDS[1] && Math.abs(d[1] * TK.t[0] - d[0] * TK.t[1]) < 15;
    if (rock || bridge || cut(ax, ay, az) || cut(bx, by, bz) || cut((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)) { run = 0; continue; }
    B.tint(0xffffff);
    B.poly([a, b, [bx, by + FENCE_H, bz], [ax, ay + FENCE_H, az]], n, 'gt-chain', 0.5);
    B.tint(0xa7acad);
    bar(B, [ax, ay + FENCE_H, az], [bx, by + FENCE_H, bz], 0.045, 0.045, 'metal');
    for (; run <= l; run += FENCE_POSTS) {
      const f = run / l;
      B.lathe(ax + (bx - ax) * f, az + (bz - az) * f, [[0.03, ay + (by - ay) * f - 0.2], [0.03, ay + (by - ay) * f + FENCE_H + 0.05]], 'metal', 6);
    }
    run -= l;
  }
}
