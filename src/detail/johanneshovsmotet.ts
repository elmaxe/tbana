import * as THREE from 'three';
import type { Builder, V2, V3 } from './builder.ts';
import { type Ground, v3 } from './gubbangen.ts';
import { barRailing, CONCRETE, KERB, RAILING, UNDER } from './farsta-line-north.ts';
import { Line, lines, loft, table } from './ropsten.ts';
import { buildRoadDeck, type RoadDeck } from './road-bridges.ts';
import { buildStreets } from './streets.ts';
import { STREET_ONEWAY, type Street } from '../city-tile.ts';
import type { LandmarkStreets } from './index.ts';
import { locate, OFF_RAMP, ON_RAMP } from './johanneshovsbron.ts';

// Johanneshovsmotet, the roundabout at Gullmarsplan where Söderleden, off Johanneshovsbron
// (src/detail/johanneshovsbron.ts), meets Nynäsvägen and the roads up from Skanstullsbron:
//
// - The ring lies on a concrete deck over Nynäsvägen's main lanes, which run under it in their
//   cutting and are open to the sky in its middle, a round well 30 m across with a railing round
//   it, and over the local lanes beside them. Its road rises a little outwards; on the west it
//   meets the deck that carries Johanneshovsvägen over the metro's platforms (which the station
//   draws, src/open-styles.ts), level with it and with the square in front of the bus terminal.
//   The deck stands on mushroom columns where they keep clear of the roads under it.
// - Its arms, each a deck of its own as far as it bridges the ground under it: on the north-west
//   Johanneshovsbron's off-ramp and the road up from Skanstullsbron side by side, which meet at the
//   ring; on the north-east the road down to Skanstullsbron and the on-ramp beside it; on the
//   south-east Nynäsvägen's local lanes over the main lanes' cutting, falling to the hill beyond;
//   and on the south the street along the bus terminal's eastern side over the tracks.
// - Under them the roads at ground level from Skanstullsbron: Nynäsvägen's southbound local
//   lanes, which run on under the ring, and the roads up to the ring before they leave the ground.
//   OpenStreetMap has each of these on a bridge for all its length, so that the city leaves them
//   out, and they are drawn here as far as they are at ground level.
//
// The ring, its well, the arms' edges and their heights from Lantmäteriet's laser scan (Laserdata
// Nedladdning, skog, 2021, CC BY 4.0) and Google's 3D mesh; the roads' lines from OpenStreetMap's
// ways, smoothed. Neither the mesh nor photographs show what stands under the deck, and the
// columns are where the roads and tracks under it leave room.

// ------------------------------------------------------------------ the ring
const C: V2 = [1292.36, 3582.04];
const WELL = 14.8, RING = 26.5;
// the road: rising 1.2 % outwards from the well
const cone = (r: number) => 43.0 + 0.012 * (Math.min(r, RING) - 13);
// the station's deck west of it (the plane through its block's corners there, src/open-styles.ts),
// which its edge meets
const deckPlane = (p: V2) => 6.23337 + 0.0084878 * p[0] + 0.007322 * p[1];
// the deck's outline: the ring's edge at RING, the arms' ends, the bus terminal's corner, and the
// station's deck along the west
const PLATE: V2[] = [
  [1318.86, 3582], [1322.47, 3583.31], [1312.11, 3604.51], [1308.09, 3603.36], [1306.64, 3604.36], [1305.13, 3605.26], [1303.56, 3606.06],
  [1301.94, 3606.75], [1300.28, 3607.33], [1298.58, 3607.8], [1296.86, 3608.16], [1295.12, 3608.4], [1293.36, 3608.52], [1291.6, 3608.53],
  [1292.23, 3610.21], [1281.98, 3614.19], [1272.82, 3604.79], [1271.39, 3605.22], [1260.1, 3568.73], [1263.75, 3567.3], [1262.46, 3563.17],
  [1268.77, 3561.2], [1268.73, 3561.02], [1275.47, 3559.44], [1275.91, 3561.26], [1277.36, 3560.2], [1278.87, 3559.23], [1280.45, 3558.37],
  [1282.08, 3557.61], [1283.76, 3556.97], [1285.48, 3556.45], [1287.23, 3556.04], [1289.01, 3555.75], [1290.8, 3555.59], [1292.6, 3555.54],
  [1291.91, 3553.74], [1298.73, 3551.13], [1298.79, 3551.31], [1305.45, 3549.18], [1309.51, 3561.83], [1310.81, 3563.02], [1312.04, 3564.29],
  [1313.17, 3565.64], [1314.22, 3567.06], [1315.17, 3568.55], [1316.02, 3570.1], [1316.76, 3571.7], [1317.39, 3573.34], [1317.92, 3575.03],
  [1318.33, 3576.74], [1318.62, 3578.48], [1318.8, 3580.24],
];
// each edge's kind, from each point to the next: f free (an edge beam and a railing), j where an
// arm's deck goes on, c where it meets the station's deck or the bus terminal
const EDGES = 'fjffffffffffffjfccffjjjffffffffffffjjjffffffffffffff';
const SLAB = { depth: 1.0, edge: 0.5, fascia: 1.2 };
// the columns, at radius and angle (degrees from east, clockwise as seen from above)
const COLUMNS: V2[] = [[20.7, 103], [20.7, 117], [20.7, 208], [20.7, 222], [20.7, 293], [20.7, 307], [23.5, 350], [23.5, 0]];
// the lane lines: dashed between the ring's two lanes, solid along the inside
const DASHED = 20.7, SOLID = 15.8;

const polar = (p: V2): V2 => [Math.hypot(p[0] - C[0], p[1] - C[1]), ((Math.atan2(p[1] - C[1], p[0] - C[0]) * 180) / Math.PI + 360) % 360];
const onCircle = (r: number, a: number): V2 => [C[0] + r * Math.cos((a * Math.PI) / 180), C[1] + r * Math.sin((a * Math.PI) / 180)];
const clamp = (x: number) => Math.min(1, Math.max(0, x));
// how far its top is the station's deck's, by angle
const west = (a: number) => (a < 128 ? clamp((a - 110) / 18) : a <= 204 ? 1 : clamp((212 - a) / 8));

// ------------------------------------------------------------------ the arms
// Each along its road's line from OpenStreetMap, smoothed: t metres along it, u to the right.
// The roads off Skanstullsbron's southern end, t from there: on the west Nynäsvägen's local lanes
// southwards, down to the ground and on under the ring (the city's way from 220 m), and the road
// up to the ring beside the off-ramp; on the east the local lanes northwards, up from under the
// ring, and the road down from the ring beside the on-ramp. Each one way.
const S1_LINE: V2[] = [
  [1193.3, 3293.7], [1195.02, 3303.12], [1196.74, 3312.55], [1198.46, 3321.97], [1200.18, 3331.39], [1201.9, 3340.81], [1203.62, 3350.24],
  [1205.34, 3359.66], [1207.06, 3369.08], [1208.78, 3378.5], [1210.5, 3387.93], [1212.22, 3397.35], [1213.94, 3406.77], [1215.66, 3416.19],
  [1217.41, 3425.61], [1219.63, 3434.93], [1222.46, 3444.07], [1225.56, 3453.14], [1228.67, 3462.2], [1231.78, 3471.26], [1234.88, 3480.32],
  [1237.99, 3489.38], [1241.09, 3498.44], [1244.2, 3507.5],
];
const S2_LINE: V2[] = [
  [1193.3, 3293.7], [1196.0, 3303.02], [1198.71, 3312.33], [1201.41, 3321.65], [1204.11, 3330.96], [1206.74, 3340.3], [1209.3, 3349.66],
  [1211.83, 3359.02], [1214.37, 3368.38], [1216.9, 3377.75], [1219.43, 3387.11], [1221.97, 3396.48], [1224.5, 3405.84], [1227.04, 3415.2],
  [1229.57, 3424.57], [1232.1, 3433.93], [1234.64, 3443.29], [1237.21, 3452.65], [1239.98, 3461.94], [1242.97, 3471.17], [1246.02, 3480.38],
  [1249.07, 3489.58], [1252.12, 3498.79], [1255.18, 3508.0], [1258.23, 3517.21], [1261.28, 3526.41], [1264.33, 3535.62], [1267.36, 3544.84],
  [1270.25, 3554.1], [1272.55, 3563.52], [1273.9, 3573.1],
];
const S3_LINE: V2[] = [
  [1226.5, 3359.4], [1231.34, 3367.98], [1236.19, 3376.56], [1241.03, 3385.14], [1245.87, 3393.73], [1250.59, 3402.37], [1255.18, 3411.09],
  [1259.71, 3419.84], [1264.24, 3428.6], [1268.71, 3437.37], [1272.71, 3446.38], [1276.14, 3455.62], [1279.37, 3464.92], [1282.6, 3474.23],
  [1285.82, 3483.54], [1289.05, 3492.85], [1292.28, 3502.16], [1295.51, 3511.47], [1298.74, 3520.78], [1301.97, 3530.09], [1305.2, 3539.4],
];
const S4_LINE: V2[] = [
  [1226.5, 3359.4], [1230.14, 3368.67], [1233.77, 3377.93], [1237.41, 3387.2], [1241.05, 3396.46], [1244.68, 3405.73], [1248.32, 3414.99],
  [1251.95, 3424.26], [1255.59, 3433.53], [1259.21, 3442.8], [1262.64, 3452.14], [1265.82, 3461.57], [1268.92, 3471.03], [1272.02, 3480.49],
  [1275.12, 3489.95], [1278.22, 3499.41], [1281.32, 3508.87], [1284.41, 3518.33], [1287.51, 3527.79], [1290.61, 3537.25], [1293.71, 3546.7],
  [1297.27, 3556.0], [1301.5, 3565.0],
];
// the street south along the bus terminal, and Nynäsvägen's local lanes out to the south-east (t
// away from the ring; the lanes in from there run beside them on the left)
const SARM_LINE: V2[] = [
  [1283.3, 3600.3], [1287.43, 3608.8], [1290.76, 3617.66], [1293.63, 3626.69], [1296.5, 3635.71], [1299.42, 3644.72], [1302.44, 3653.7],
  [1305.52, 3662.65], [1308.62, 3671.6], [1311.71, 3680.55], [1314.8, 3689.5],
];
const SE_LINE: V2[] = [
  [1305.6, 3597.6], [1314.73, 3600.35], [1322.23, 3606.26], [1327.1, 3614.53], [1330.89, 3623.39], [1334.57, 3632.29], [1338.17, 3641.22],
  [1341.75, 3650.15], [1345.33, 3659.09],
];

const ARM_SLAB = { depth: 0.9, edge: 0.4, fascia: 1.05 };
// the road up from Skanstullsbron leaves the ground at 226 m; its right edge meets the off-ramp's
// left, halfway between them, and the off-ramp's side stands over it till they meet at the ring
const S2_HI = table([[226, 3.12], [232, 3.13], [238, 3.15], [244, 3.19], [250, 3.23], [256, 3.27], [262, 3.32], [268, 3.32], [274, 3.25], [278, 3.12]]);
const S2_TOP = table([[226, 40.2], [230, 40.5], [240, 41.05], [250, 41.6], [260, 42.1], [270, 42.55], [280, 42.95]]);
const S2_DECK: RoadDeck = {
  line: S2_LINE, from: 226, to: 278, edges: (t) => [-3.8, S2_HI(t)], top: (t) => S2_TOP(t), ...ARM_SLAB,
  solid: [-2.8, (t: number) => S2_HI(t) - 0.6], railings: [true, false], ends: [true, false], abutments: [10, 0],
  columns: { at: [251, 276], us: [-0.2], r: 0.45, flare: 1.3 },
};
// the road down to Skanstullsbron, two lanes, beside the on-ramp, on the ground from 152 m
const S4_LO = table([[152, -3.44], [158, -3.43], [164, -3.41], [170, -3.39], [176, -3.36], [182, -3.34], [188, -3.32], [194, -3.29], [200, -3.24], [205, -3.1]]);
const S4_TOP = table([[150, 40.17], [160, 40.63], [170, 41.1], [180, 41.61], [190, 42.1], [200, 42.58], [209.5, 43.1]]);
const S4_DECK: RoadDeck = {
  line: S4_LINE, from: 152, to: 205, edges: (t) => [S4_LO(t), 4.2], top: (t) => S4_TOP(t), ...ARM_SLAB,
  solid: [(t: number) => S4_LO(t) + 0.6, 3.5], dashed: [0.3], railings: [false, true], ends: [true, false], abutments: [10, 0],
  columns: { at: [177, 202], us: [0.4], r: 0.45, flare: 1.3 },
};
// the street along the bus terminal, two ways, down to the ground at 64 m
const SARM_HI = table([[12.5, 7.0], [52, 7.0], [58, 5.2], [64, 4.2]]);
const SARM_TOP = table([[12, 42.94], [16, 42.74], [20, 42.55], [24, 42.34], [28, 42.15], [32, 41.94], [36, 41.73], [40, 41.56], [44, 41.34], [48, 41.16],
  [52, 40.96], [56, 40.71], [60, 40.53], [64, 40.37]]);
const SARM_DECK: RoadDeck = {
  line: SARM_LINE, from: 12.5, to: 64, edges: (t) => [-4.0, SARM_HI(t)], top: (t) => SARM_TOP(t), ...ARM_SLAB,
  solid: [-3.4, (t: number) => SARM_HI(t) - 0.6], dashed: [(t: number) => (SARM_HI(t) - 4.0) / 2], ends: [false, true], abutments: [0, 3],
  columns: { at: [22, 42], us: [1.5], r: 0.45, flare: 1.4 },
};
// Nynäsvägen's lanes to and from the south-east, splayed at the ring round an island, down to the
// ground at 36 m
const SE_LO = table([[9, -18.8], [10, -18.8], [14, -17.8], [16, -15.5], [18, -13], [22, -12], [26, -11.2]]);
const SE_HI = table([[9, 4.8], [14, 4.2], [18, 4.3], [22, 5], [26, 5.6], [30, 5.6], [36, 5]]);
const SE_TOP = table([[8, 42.95], [12, 42.8], [16, 42.62], [20, 42.45], [24, 42.26], [28, 42.07], [32, 41.88], [36, 41.6], [40, 41.39]]);
const SE_DECK: RoadDeck = {
  line: SE_LINE, from: 9, to: 36, edges: (t) => [SE_LO(t), SE_HI(t)], top: (t) => SE_TOP(t), ...ARM_SLAB,
  solid: [(t: number) => SE_HI(t) - 0.8, -2.6, (t: number) => Math.min(-2.9, SE_LO(t) + 7.2), (t: number) => SE_LO(t) + 0.8], ends: [false, true], abutments: [0, 3],
  columns: { at: [24], us: [1, -6], r: 0.5, beam: { w: 1.2, depth: 0.7 } },
};

// The arms as the ring's deck meets them: the line, the station at the ring's edge, which way the
// ring lies along it, the road's height and its edges there.
interface Stub { line: Line; end: number; inward: 1 | -1; top: (t: number, u: number) => number; edges: V2 }
const stub = (d: RoadDeck, end: number, inward: 1 | -1): Stub => ({ line: new Line(d.line), end, inward, top: d.top, edges: d.edges(end) });
const STUBS: Stub[] = [
  stub(SE_DECK, SE_DECK.from, -1), stub(SARM_DECK, SARM_DECK.from, -1), stub(OFF_RAMP.deck, OFF_RAMP.deck.to, 1), stub(S2_DECK, S2_DECK.to, 1),
  stub(S4_DECK, S4_DECK.to, 1), stub(ON_RAMP.deck, ON_RAMP.deck.to, 1),
];

// The road's height on the ring's deck at p: the ring's, on the west the station's deck's from a
// little inside the ring's edge, and on an arm's end falling or rising to the arm's road.
function plateTop(p: V2): number {
  const [r, a] = polar(p), ring = cone(RING);
  if (r <= RING) return cone(r) + (deckPlane(p) - cone(r)) * west(a) * clamp((r - 23.6) / (RING - 23.6));
  for (const s of STUBS) {
    const [t, u] = locate(s.line, p, s.end);
    if (u < s.edges[0] - 0.3 || u > s.edges[1] + 0.3 || (t - s.end) * s.inward < -0.5) continue;
    const q = s.line.at(s.end, u), w = clamp((r - RING) / Math.max(0.1, Math.hypot(q[0] - C[0], q[1] - C[1]) - RING));
    return ring + (s.top(s.end, u) - ring) * w;
  }
  return ring + (deckPlane(p) - ring) * west(a);
}

// The deck's top as rings about the well, at the same angles, out to RING, and the pieces beyond it
// (the arms' ends and the rim on the west), each a polygon closed along RING.
function plateParts() {
  const n = PLATE.length, ang = PLATE.map((p) => polar(p)[1]);
  const on = PLATE.map((p) => Math.abs(polar(p)[0] - RING) < 0.05);
  const outer: { p: V2; a: number }[] = [], pieces: V2[][] = [];
  const s0 = on.indexOf(true);
  let i = s0;
  do {
    const j = (i + 1) % n;
    if (on[j]) { outer.push({ p: PLATE[i], a: ang[i] }); i = j; continue; }
    let k = j;
    while (!on[k]) k = (k + 1) % n;
    const a0 = ang[i], a1 = ang[k] > a0 ? ang[k] : ang[k] + 360, m = Math.max(1, Math.ceil((a1 - a0) / 4));
    const arc = Array.from({ length: m - 1 }, (_, q) => a0 + ((a1 - a0) * (q + 1)) / m);
    outer.push({ p: PLATE[i], a: a0 }, ...arc.map((a) => ({ p: onCircle(RING, a), a })));
    const piece: V2[] = [];
    for (let q = i; q !== k; q = (q + 1) % n) piece.push(PLATE[q]);
    piece.push(PLATE[k], ...arc.reverse().map((a) => onCircle(RING, a)));
    pieces.push(piece);
    i = k;
  } while (i !== s0);
  // the angles, rising all the way round
  for (let q = 1; q < outer.length; q++) while (outer[q].a < outer[q - 1].a) outer[q].a += 360;
  const radii = [WELL, 17.7, DASHED, 23.6];
  const rings = [...radii.map((r) => outer.map(({ a }) => onCircle(r, a))), outer.map(({ p }) => p)];
  return { rings, pieces };
}

export function buildRing(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const { rings, pieces } = plateParts();
  // the top and the soffit, over the same points
  const pts: V2[] = [], tris: number[][] = [];
  const m = rings[0].length, base = (k: number) => k * m;
  rings.forEach((ring) => pts.push(...ring));
  for (let k = 0; k + 1 < rings.length; k++) {
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m, a = base(k) + i, b = base(k) + j, c = base(k + 1) + j, d = base(k + 1) + i;
      tris.push([a, b, c], [a, c, d]);
    }
  }
  for (const piece of pieces) {
    const b = pts.length;
    pts.push(...piece);
    for (const t of THREE.ShapeUtils.triangulateShape(piece.map(([x, z]) => new THREE.Vector2(x, z)), [])) tris.push(t.map((q) => b + q));
  }
  const tops = pts.map(plateTop);
  B.tint(0x67696b);
  B.tris(pts.map((p, k) => v3(p, tops[k] + 0.005)), tris, [0, 1, 0], 'rp-asphalt', 6);
  B.tint(UNDER);
  B.tris(pts.map((p, k) => v3(p, tops[k] - SLAB.depth)), tris, [0, -1, 0], 'fl-under', 3);

  // the edges: an edge beam with a railing where it is free, round the well too, and a face down
  // to the soffit where it meets the station's deck
  const n = PLATE.length;
  for (const kind of ['f', 'c']) {
    for (let i = 0; i < n; i++) {
      if (EDGES[i] !== kind || EDGES[(i + n - 1) % n] === kind) continue;
      const run = [PLATE[i]];
      for (let k = i; EDGES[k % n] === kind && run.length <= n; k++) run.push(PLATE[(k + 1) % n]);
      if (kind === 'f') rim(B, run, 1);
      else {
        B.tint(CONCRETE);
        for (let k = 0; k + 1 < run.length; k++) {
          const [p, q] = [run[k], run[k + 1]], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
          B.poly([v3(p, plateTop(p) - SLAB.fascia), v3(q, plateTop(q) - SLAB.fascia), v3(q, plateTop(q)), v3(p, plateTop(p))],
            [(q[1] - p[1]) / l, 0, -(q[0] - p[0]) / l], 'concrete', 3);
        }
      }
    }
  }
  rim(B, [...rings[0], rings[0][0]], -1);

  // the lane lines, round the ring
  for (const [r, dashed] of [[DASHED, true], [SOLID, false]] as const) {
    const L = new Line(Array.from({ length: 145 }, (_, k) => onCircle(r, k * 2.5)));
    lines(B, L, (s) => plateTop(L.at(s, 0)) + 0.005, 0, L.length, [0, L.length], [() => 0], dashed);
  }

  // the columns: mushrooms, flaring to the soffit
  B.tint(CONCRETE);
  for (const [r, a] of COLUMNS) {
    const p = onCircle(r, a), y = plateTop(p) - SLAB.depth + 0.02, foot = (ground(p[0], p[1]) ?? y - 6) - 0.3;
    B.lathe(p[0], p[1], [[0.45, foot], [0.45, y - 2.2], [0.6, y - 1.4], [1.4, y - 0.35], [1.5, y]], 'concrete', 20, 3);
  }
}

// An edge beam along a run of the outline (or round the well): its top a kerb over the road, its
// outer face down past the soffit, and a railing on it. `side`: where the deck lies, to the left
// (-1) or the right (1) of the run.
function rim(B: Builder, run: V2[], side: 1 | -1) {
  const N = run.map((_, k) => {
    const a = run[Math.max(0, k - 1)], b = run[Math.min(run.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(-(b[1] - a[1]) / l) * side, ((b[0] - a[0]) / l) * side] as V2;  // towards the deck
  });
  const P = (k: number, d: number, dy: number) => { const p: V2 = [run[k][0] + N[k][0] * d, run[k][1] + N[k][1] * d]; return v3(p, plateTop(p) + dy); };
  const out = (k: number): V3 => [-N[k][0], 0, -N[k][1]], inn = (k: number): V3 => [N[k][0], 0, N[k][1]];
  B.tint(CONCRETE);
  loft(B, run.map((_, k) => [P(k, SLAB.edge, -SLAB.depth), P(k, 0, -SLAB.fascia), P(k, 0, KERB), P(k, SLAB.edge, KERB), P(k, SLAB.edge, 0)]), 'concrete',
    (k, j) => (j === 0 ? [0, -1, 0] : j === 1 ? out(k) : j === 2 ? [0, 1, 0] : inn(k)), 3);
  B.tint(RAILING);
  barRailing(B, run.map((_, k) => P(k, 0.2, KERB)), 1.15);
}

export const ARMS: { name: string; deck: RoadDeck }[] = [
  { name: 'north-west', deck: S2_DECK }, { name: 'north-east', deck: S4_DECK }, { name: 'south', deck: SARM_DECK }, { name: 'south-east', deck: SE_DECK },
];
export const armAnchor = (d: RoadDeck) => new Line(d.line).at((d.from + d.to) / 2, 0);

// ------------------------------------------------------------------ the roads on the ground
// Each as far as it is on the ground: from where it leaves Skanstullsbron's deck, or the ground
// under it, to where it leaves the ground for its own deck, or where the city's way goes on.
const GROUND_ROADS: { line: V2[]; range: V2; kind: Street['kind']; lanes: number; width: number }[] = [
  { line: S1_LINE, range: [122, 220.3], kind: 'trunk', lanes: 1, width: 6.5 },
  { line: S2_LINE, range: [122, 226], kind: 'secondary', lanes: 1, width: 6.5 },
  { line: S3_LINE, range: [50, 197.1], kind: 'trunk', lanes: 2, width: 7.5 },
  { line: S4_LINE, range: [49, 152], kind: 'trunk', lanes: 2, width: 7.5 },
];
// Each in runs along it as far as the city's ground under all its width is there to draw on: the
// ground beside the metro's tracks north of Gullmarsplan is the tracks' (the city keeps a margin
// round them) for part of their width, where a road cut to the ground's triangles would leave
// triangles of asphalt.
function groundStreets(G: LandmarkStreets['ground']): Street[] {
  const out: Street[] = [];
  for (const r of GROUND_ROADS) {
    const L = new Line(r.line), half = r.width / 2 + 0.5;
    const ok = (t: number) => [-half, 0, half].every((u) => { const [x, z] = L.at(t, u); return G.bare(x, z); });
    const run = (a: number, b: number) => {
      if (b - a < 6) return;
      const n = Math.ceil((b - a) / 3);
      out.push({
        kind: r.kind, surface: 'asphalt', flags: STREET_ONEWAY, lanes: r.lanes, width: r.width,
        line: Array.from({ length: n + 1 }, (_, k) => L.at(a + ((b - a) * k) / n, 0)),
      });
    };
    let from: number | null = null;
    for (let t = r.range[0]; ; t = Math.min(t + 1, r.range[1])) {
      if (ok(t)) from ??= t;
      else if (from !== null) { run(from, t - 1); from = null; }
      if (t >= r.range[1]) break;
    }
    if (from !== null) run(from, r.range[1]);
  }
  return out;
}
// the tiles they lie in, by a point in each (the streets drawn in a tile are those it has the
// middles of)
export const GROUND_ROAD_TILES: V2[] = [[1230, 3450], [1280, 3530]];
export function buildGroundRoads(B: Builder, anchor: V2, streets?: LandmarkStreets) {
  if (!streets) return;
  const size = 500, x0 = Math.floor(anchor[0] / size) * size, z0 = Math.floor(anchor[1] / size) * size;
  buildStreets(B, { streets: groundStreets(streets.ground), ground: { ...streets.ground, bare: () => true } }, x0, z0, size);
}

// ------------------------------------------------------------------ the station's deck
// Johanneshovsvägen and the street along the bus terminal's front on the deck over the platforms,
// which the station draws (src/open-styles.ts), and over which the city leaves its streets out, the
// ground there being the tracks' or under the deck: the city's own streets laid again on the deck's
// two blocks, each as its top is drawn (two triangles from its first corner), wherever the city
// doesn't draw them at the deck's level itself.
const STATION_DECK: { corners: V2[]; tops: number[] }[] = [
  { corners: [[1192.88, 3586.58], [1204.99, 3625.75], [1253.71, 3610.69], [1242.96, 3575.91]], tops: [42.6, 43.009, 43.312, 42.903] },
  { corners: [[1242.96, 3575.91], [1253.71, 3610.69], [1271.39, 3605.22], [1260.1, 3568.73]], tops: [42.949, 43.312, 43.422, 43.059] },
];
export const STATION_DECK_ANCHOR: V2 = [1240, 3600];
function quadTop({ corners: c, tops: h }: { corners: V2[]; tops: number[] }, x: number, z: number) {
  let best = -Infinity, y = h[0];
  for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
    const [a, b, d] = [c[i], c[j], c[k]];
    const det = (b[0] - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (b[1] - a[1]);
    const v = ((x - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (z - a[1])) / det, w = ((b[0] - a[0]) * (z - a[1]) - (x - a[0]) * (b[1] - a[1])) / det;
    const m = Math.min(1 - v - w, v, w);
    if (m > best) { best = m; y = h[i] * (1 - v - w) + h[j] * v + h[k] * w; }
  }
  return y;
}
// OpenStreetMap's ways from the ring out onto the deck, mapped as bridges and so left out by the
// city, as far as the deck (the ring's own plate is asphalt, its lanes its own): Johanneshovsvägen
// in from the west and out to it, the off-ramp from Johanneshovsbron down to it, and the bus lane
// along the terminal's front
const DECK_STREETS: Street[] = ([
  ['secondary', 3, [[1254.3, 3592.7], [1268.3, 3593.4], [1276.9, 3594.2]]],
  ['service', 0, [[1256, 3600.5], [1278.9, 3596.4]]],
  ['secondary', 1, [[1272, 3578.8], [1269.8, 3581], [1266.8, 3583.1], [1263.6, 3583.9], [1259.9, 3583.6], [1250.4, 3581.3]]],
  ['trunk', 1, [[1266.1, 3563.1], [1266.4, 3566.2], [1266.2, 3568.5], [1264.5, 3571.7], [1263.2, 3573.2], [1258.4, 3577.5], [1250.4, 3581.3]]],
] as [Street['kind'], number, V2[]][]).map(([kind, lanes, line]) => ({ kind, surface: 'asphalt', flags: STREET_ONEWAY, lanes, width: 0, line }));
export function buildStationDeckStreets(B: Builder, streets?: LandmarkStreets) {
  if (!streets) return;
  const city = streets.ground, x0 = Math.floor(STATION_DECK_ANCHOR[0] / 500) * 500, z0 = Math.floor(STATION_DECK_ANCHOR[1] / 500) * 500;
  for (const q of STATION_DECK) {
    const top = (x: number, z: number) => quadTop(q, x, z);
    const ground = { step: city.step, height: top, bare: (x: number, z: number) => !city.bare(x, z) || city.height(x, z) < top(x, z) - 0.3, water: () => null, outline: q.corners };
    streets.draw(ground);
    buildStreets(B, { streets: DECK_STREETS, ground: { ...ground, bare: () => true } }, x0, z0, 500);
  }
}

// for checks
export const CHECKS: Record<string, (B: Builder, g: Ground) => void> = {
  ring: (B, g) => buildRing(B, g),
  ...Object.fromEntries(ARMS.map((a) => [`arm ${a.name}`, (B: Builder, g: Ground) => buildRoadDeck(B, g, a.deck)])),
};
