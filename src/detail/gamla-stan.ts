import * as THREE from 'three';
import * as T from '../textures';
import type { Builder, V2, V3 } from './builder.ts';
import * as S from '../sections.ts';
import { addMaterial, standard } from './materials.ts';

// Gamla stan station and what stands over and beside it, as seen from the metro's bridge over
// Söderström and from the quays.
//
// The station (1957) lies along the west shore of Stadsholmen under Centralbron (1967), the road
// bridge from Tegelbacken to Södermalm: the bridge's deck is the roof over the platforms' northern
// half and the west of the southern half, and the rest of the southern half has its own roof, low
// and brownish grey with seven glazed lanterns across it. Its east wall stands along Munkbroleden,
// light grey with pilasters, an entrance in its southern part and a railing along the top. West of
// it, a few metres lower, runs the railway between Stockholm C and Södra (two tracks, the narrow
// "Getingmidjan"), on a bank behind a white wall along the quay of Riddarfjärden, with the
// station's entrance from the quay through it under a blue sign. South of the station all three
// cross Söderström side by side, the railway and the road on one long low bridge on concrete
// piers, the metro on its own; on Södermalm the railway and the road run into tunnels under the
// block at Söder Mälarstrand.
//
// Measured from Lantmäteriet's laser scan (Laserdata Nedladdning, skog, CC BY 4.0: the decks'
// edges and heights every 10–20 m, the roof and its lanterns) and Google's 3D mesh of the city
// (where the decks run, the lanes and tracks on them, the roof's colour); the looks from
// photographs on Wikimedia Commons (the quay's entrance, the east entrance, the bridges from
// Södermalm). Where the game's station box is wider than the real one, as at its north end, the
// decks are fitted round it. World coordinates (src/geo.ts); heights RH 2000.

type Ground = (x: number, z: number) => number | null;

// ------------------------------------------------------------------ the station box
// The station in its own frame, as the game's track has it: x across to the east-north-east, z
// along the tracks to the south-south-east, from (449, 910) turned 0.465 rad (as Builder.place).
const ST = { x: 449, z: 910, turn: 0.465 };
const SC = Math.cos(ST.turn), SS = Math.sin(ST.turn);
const toWorld = ([x, z]: V2): V2 => [ST.x + x * SC + z * SS, ST.z - x * SS + z * SC];
const toFrame = ([x, z]: V2): V2 => { const dx = x - ST.x, dz = z - ST.z; return [dx * SC - dz * SS, dx * SS + dz * SC]; };
// The outer faces of the box's walls in the frame, north to south (src/network.ts draws its
// inside: 2.425 m from the outer tracks to the wall, 0.55 m thick), and where it ends in the south.
const EAST_WALL: V2[] = [[18.1, -86], [16.6, -56], [14.7, -26], [13.8, 4], [14.3, 34], [15.7, 64.3]];
const WEST_WALL: V2[] = [[-14.1, -84], [-17.2, -54.5], [-18.5, -24.6], [-19.0, 5.3], [-18.4, 35.2], [-15.9, 64.3]];
const BOX_END = 64.3;
// The top of anything over the box: the real deck is at 7.0–7.6 m, but the game's box roof
// reaches 7.72 m (4.8 m over its rails), so the decks over it are a little higher.
const OVER_BOX = 7.85;
// Its own roof: from where the lanterns begin to the box's end, its lanterns' middles (frame z).
const ROOF = { north: 1.5, y: 8.35, lanterns: [6, 15.2, 24.4, 33.6, 42.8, 52, 61.2] };

const xAt = (line: V2[], z: number) => {
  if (z <= line[0][1]) return line[0][0];
  for (let i = 1; i < line.length; i++) {
    if (z <= line[i][1]) return line[i - 1][0] + ((line[i][0] - line[i - 1][0]) * (z - line[i - 1][1])) / (line[i][1] - line[i - 1][1]);
  }
  return line[line.length - 1][0];
};
// (the walls in world coordinates run south steeply enough for xAt to read them by world z)
const WEST_W = WEST_WALL.map(toWorld), EAST_W = EAST_WALL.map(toWorld);
const BOX_Z: V2 = [WEST_W[0][1], WEST_W[WEST_W.length - 1][1]];
const boxWest = (z: number) => (z < BOX_Z[0] || z > BOX_Z[1] ? null : xAt(WEST_W, z));
const BOX_PLAN: V2[] = [...WEST_W, ...[...EAST_W].reverse()];

function inPlan(x: number, z: number, ring: V2[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const overBox = (x: number, z: number) => inPlan(x, z, BOX_PLAN);

// ------------------------------------------------------------------ the decks
// Across each deck every 10–20 m: z, its west and east edges (world x) there, and its top (the
// road's surface; the rails' top). From the laser scan, the road's edges over the water evened out
// along a curve, as the bridge is built (they read a metre or two out from row to row).
const ROAD: [number, number, number, number][] = [
  [846, 407, 433, 7.0], [860, 410, 439, 7.05], [870, 413, 443.5, 7.15], [880, 416.5, 447.5, 7.2], [890, 420, 449, 7.25],
  [900, 422.5, 450, 7.3], [920, 429, 451, 7.4], [940, 435, 457.5, 7.5], [960, 441.5, 464, 7.55], [980, 447.5, 470.5, 7.65],
  [1000, 453.5, 476.5, 7.85], [1020, 459.5, 483, 8.0], [1040, 465.5, 489, 8.25], [1060, 471.5, 495.5, 8.45], [1080, 477.5, 501.5, 8.7],
  [1100, 483, 507, 8.9], [1120, 489, 513, 9.05], [1140, 494.5, 519, 9.25], [1160, 500, 527, 9.4], [1180, 505.5, 532, 9.6],
  [1200, 511, 535.5, 9.85], [1220, 516, 539, 10.1],
];
const RAIL: [number, number, number, number][] = [
  [848, 393, 403, 2.6], [860, 398.5, 409, 2.9], [870, 403, 412, 3.2], [880, 407, 416, 3.5], [890, 410.5, 419.5, 3.75],
  [900, 412.5, 422, 4.0], [910, 415.5, 425, 4.2], [920, 418.5, 428.5, 4.5], [940, 424.5, 434.5, 5.0], [960, 430.5, 440.5, 5.5],
  [980, 436, 446, 5.9], [1000, 442, 452, 6.2], [1020, 447.5, 457.5, 6.35], [1040, 453.5, 463.5, 6.65], [1060, 459.5, 469.5, 6.85],
  [1080, 465.5, 475.5, 7.05], [1100, 471.5, 482, 7.3], [1120, 477, 487.5, 7.45], [1140, 482, 492, 7.65], [1160, 487.5, 498, 7.9],
  [1180, 492, 502.5, 8.15], [1200, 495.5, 507, 8.3], [1220, 499, 511, 8.4],
];
// The north face of the block at Söder Mälarstrand that both run into, in tunnels under it.
const PORTAL: [V2, V2] = [[501, 1240], [546, 1229]];
// Söderström between the shores, along both decks (world z); the railway is on a bank north of it.
const WATER: V2 = [992, 1158];
const DEPTH = { road: 1.9, rail: 1.4 };
// the railway's tracks either side of its middle, and its rails either side of each track's
const TRACKS = 2.25, GAUGE = 0.75;

interface Cut { w: V2; e: V2; y: number; s: number; along: V2; k: number }

// A deck from its rows: each edge carried on to the portal, then resampled every `step` metres
// along its middle. `along` is the deck's direction there, `k` how much longer a distance across
// is on a row than square to the deck.
function deck(rows: [number, number, number, number][], step: number): Cut[] {
  const raw = rows.map(([z, w, e, y]) => ({ w: [w, z] as V2, e: [e, z] as V2, y }));
  const [a, b] = raw.slice(-2);
  const meet = (p: V2, q: V2): V2 => {
    // where the line p → q carries on to meet the portal's face
    const [u, v] = PORTAL, d: V2 = [q[0] - p[0], q[1] - p[1]], f: V2 = [v[0] - u[0], v[1] - u[1]];
    const t = ((u[0] - p[0]) * f[1] - (u[1] - p[1]) * f[0]) / (d[0] * f[1] - d[1] * f[0]);
    return [p[0] + d[0] * t, p[1] + d[1] * t];
  };
  const w = meet(a.w, b.w), e = meet(a.e, b.e);
  const run = (w[1] + e[1]) / 2 - (b.w[1] + b.e[1]) / 2;
  raw.push({ w, e, y: b.y + ((b.y - a.y) * run) / (b.w[1] - a.w[1]) });
  const mids = raw.map((r) => [(r.w[0] + r.e[0]) / 2, (r.w[1] + r.e[1]) / 2] as V2);
  const cum = [0];
  for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(mids[i][0] - mids[i - 1][0], mids[i][1] - mids[i - 1][1]));
  const out: Cut[] = [];
  const L = cum[cum.length - 1], n = Math.ceil(L / step);
  for (let j = 0; j <= n; j++) {
    const s = (L * j) / n;
    let i = 1;
    while (i < raw.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1]), p = raw[i - 1], q = raw[i];
    const dl = Math.hypot(mids[i][0] - mids[i - 1][0], mids[i][1] - mids[i - 1][1]);
    const along: V2 = [(mids[i][0] - mids[i - 1][0]) / dl, (mids[i][1] - mids[i - 1][1]) / dl];
    const wq: V2 = [p.w[0] + (q.w[0] - p.w[0]) * t, p.w[1] + (q.w[1] - p.w[1]) * t];
    const eq: V2 = [p.e[0] + (q.e[0] - p.e[0]) * t, p.e[1] + (q.e[1] - p.e[1]) * t];
    const ax = [eq[0] - wq[0], eq[1] - wq[1]], al = Math.hypot(ax[0], ax[1]);
    // square to the deck, a row's metre across is 1/k of a metre
    const k = al / Math.abs(ax[0] * -along[1] + ax[1] * along[0]);
    out.push({ w: wq, e: eq, y: p.y + (q.y - p.y) * t, s, along, k });
  }
  return out;
}

// the road's rows fitted over the station box (its west edge out to the box's wall) and lifted
// over its roof; the railway's kept clear of the box, at its full width
const roadRows = ROAD.map(([z, w, e, y]): [number, number, number, number] => {
  const b = boxWest(z);
  return [z, b === null ? w : Math.min(w, b - 0.3), e, Math.max(y, OVER_BOX)];
});
const railRows = RAIL.map(([z, w, e, y]): [number, number, number, number] => {
  const b = boxWest(z), e2 = b === null ? e : Math.min(e, b - 0.3);
  return [z, Math.min(w, e2 - 9.6), e2, y];
});

// a point across a cut: d metres (square to the deck) from its west edge
const across = (c: Cut, d: number): V2 => {
  const l = Math.hypot(c.e[0] - c.w[0], c.e[1] - c.w[1]), f = (d * c.k) / l;
  return [c.w[0] + (c.e[0] - c.w[0]) * f, c.w[1] + (c.e[1] - c.w[1]) * f];
};
const width = (c: Cut) => Math.hypot(c.e[0] - c.w[0], c.e[1] - c.w[1]) / c.k;
const v3 = ([x, z]: V2, y: number): V3 => [x, y, z];
const mid = (a: V2, b: V2): V2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// ------------------------------------------------------------------ drawing helpers
// Quads between rows of points (each row across, the rows along), each facing the side of `hint`;
// uvs given, or planar over `tile` metres.
function loft(B: Builder, rows: V3[][], mat: string, hint: (i: number) => V3, tile: number | V2 = 4, uv?: (i: number, k: number) => V2) {
  for (let i = 0; i + 1 < rows.length; i++) {
    for (let k = 0; k + 1 < rows[i].length; k++) {
      const p = [rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]];
      const a = sub(p[1], p[0]), b = sub(p[3], p[0]), c = sub(p[2], p[1]);
      let n = cross(Math.hypot(...a) > 1e-6 ? a : c, Math.hypot(...b) > 1e-6 ? b : sub(p[2], p[3]));
      if (Math.hypot(...n) < 1e-9) continue;
      const h = hint(i);
      if (n[0] * h[0] + n[1] * h[1] + n[2] * h[2] < 0) n = [-n[0], -n[1], -n[2]];
      B.poly(p, n, mat, tile, uv ? [uv(i, k), uv(i, k + 1), uv(i + 1, k + 1), uv(i + 1, k)] : undefined);
    }
  }
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// square to the deck, towards its west and east sides
const west = (c: Cut): V3 => [-c.along[1], 0, c.along[0]];
const east = (c: Cut): V3 => [c.along[1], 0, -c.along[0]];
const UP: V3 = [0, 1, 0], DOWN: V3 = [0, -1, 0];

// A beam from a to b (its top), `w` wide and `h` deep.
function beam(B: Builder, a: V3, b: V3, w: number, h: number, mat: string, tile = 2) {
  const l = Math.hypot(b[0] - a[0], b[2] - a[2]);
  if (l < 1e-6) return;
  const d: V3 = [(b[0] - a[0]) / l, 0, (b[2] - a[2]) / l], n: V3 = [-d[2], 0, d[0]];
  B.wallBox(a, d, n, 0, l, Math.min(a[1], b[1]) - h, Math.max(a[1], b[1]), -w / 2, w / 2, mat, tile);
}
// A thin rod from a to b (wires, rails, arms): `w` wide and `h` high, its top on the line.
function rod(B: Builder, a: V3, b: V3, w: number, h: number, mat: string) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  if (l < 1e-6) return;
  const d: V3 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l];
  const hz = Math.hypot(d[0], d[2]);
  const n: V3 = hz > 1e-3 ? [-d[2] / hz, 0, d[0] / hz] : [1, 0, 0];
  const u = cross(n, d);
  const up: V3 = u[1] < 0 ? [-u[0], -u[1], -u[2]] : u;
  const P = (t: number, s: number, r: number): V3 => [a[0] + d[0] * t + n[0] * s + up[0] * r, a[1] + d[1] * t + n[1] * s + up[1] * r, a[2] + d[2] * t + n[2] * s + up[2] * r];
  const W = w / 2;
  const faces: [V3[], V3][] = [
    [[P(0, -W, 0), P(l, -W, 0), P(l, W, 0), P(0, W, 0)], up],
    [[P(0, -W, -h), P(l, -W, -h), P(l, W, -h), P(0, W, -h)], [-up[0], -up[1], -up[2]]],
    [[P(0, W, 0), P(l, W, 0), P(l, W, -h), P(0, W, -h)], n],
    [[P(0, -W, 0), P(l, -W, 0), P(l, -W, -h), P(0, -W, -h)], [-n[0], -n[1], -n[2]]],
  ];
  for (const [pts, nn] of faces) B.poly(pts, nn, mat, 2);
}
// A railing of bars along a line of points at their heights, `h` high, facing `out`.
function railing(B: Builder, pts: V3[], h: number, out: (i: number) => V3) {
  let s = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (l < 1e-6) continue;
    B.poly([a, b, [b[0], b[1] + h, b[2]], [a[0], a[1] + h, a[2]]], out(i), 'gs-bars', 1, [[s, 0], [s + l, 0], [s + l, 1], [s, 1]]);
    s += l;
  }
}

addMaterial('gs-asphalt', () => standard(T.concrete(23, 118), 0.95));
addMaterial('gs-bars', () => standard(T.railingBars(), 0.6, 0.4, { alphaTest: 0.5, side: THREE.DoubleSide }));
addMaterial('gs-bed', () => standard(T.trackBed(), 0.95));
addMaterial('gs-paint', () => standard(null, 0.75));
addMaterial('gs-glass', () => standard(null, 0.12, 0.5));
addMaterial('gs-dark', () => standard(null, 1));
addMaterial('gs-sign', () => standard(T.entranceSign('GAMLA STAN'), 0.5));
addMaterial('gs-boards', () => standard(T.boardWalk(), 0.9));

// colours
const ASPHALT = 0x6d7076, FASCIA = 0x5f6265, CONCRETE = 0xa8a59f, PIER = 0xb3b0a8, WHITE_WALL = 0xf0eee8;
const STATION_WALL = 0xcfccc4, ROOF_TINT = 0x9a8c84, DECK_PAVING = 0xbfc0b8, RAIL_STEEL = 0x8a8580;
const BARS_DARK = 0x3a3d40, BARS_RUST = 0x6a5446, GALVANISED = 0x9a9ea2, WIRE = 0x3a3a3a, BALLAST = 0x7d746b;

// ------------------------------------------------------------------ Centralbron
export function buildCentralbron(B: Builder, ground: Ground, part: 'north' | 'south') {
  const all = deck(roadRows, 2);
  const rail = deck(railRows, 2);
  const cuts = part === 'north' ? all.filter((c) => mid(c.w, c.e)[1] <= 1001) : all.filter((c) => mid(c.w, c.e)[1] >= 999);
  if (cuts.length < 2) return;
  const z = (c: Cut) => mid(c.w, c.e)[1];
  const free = (p: V2) => !overBox(p[0], p[1]);
  // the railway's east edge under the road's west edge (they meet from the station to the shore)
  const railEast = (p: V2) => {
    let best = Infinity, y = 0;
    for (const r of rail) { const d = Math.hypot(r.e[0] - p[0], r.e[1] - p[1]); if (d < best) { best = d; y = r.y; } }
    return best < 1.6 ? y : null;
  };

  // the roadway
  B.tint(ASPHALT);
  loft(B, cuts.map((c) => [v3(c.w, c.y), v3(c.e, c.y)]), 'gs-asphalt', () => UP, 6);
  // its edges: a parapet 0.45 m high and 0.5 m wide; outside, the fascia down to the deck's foot,
  // or by the railway down to its bank
  for (const side of [-1, 1] as const) {
    const edge = (c: Cut) => (side < 0 ? c.w : c.e);
    const inward = (c: Cut) => across(c, side < 0 ? 0.5 : width(c) - 0.5);
    B.tint(CONCRETE);
    loft(B, cuts.map((c) => [v3(edge(c), c.y + 0.45), v3(inward(c), c.y + 0.45)]), 'concrete', () => UP, 2);
    loft(B, cuts.map((c) => [v3(inward(c), c.y + 0.45), v3(inward(c), c.y)]), 'concrete', (i) => (side < 0 ? east(cuts[i]) : west(cuts[i])), 2);
    // the outer face, in runs of the same foot
    const foot = (c: Cut) => {
      const e = edge(c);
      if (side < 0) { const r = railEast(e); if (r !== null) return r - 0.35; }
      return free(e) ? c.y - DEPTH.road : c.y;
    };
    B.tint(FASCIA);
    loft(B, cuts.map((c) => [v3(edge(c), c.y + 0.45), v3(edge(c), foot(c))]), 'concrete', (i) => (side < 0 ? west(cuts[i]) : east(cuts[i])), 3);
    // the railing on the parapet
    B.tint(BARS_DARK);
    railing(B, cuts.map((c) => v3(across(c, side < 0 ? 0.15 : width(c) - 0.15), c.y + 0.45)), 0.75, (i) => (side < 0 ? west(cuts[i]) : east(cuts[i])));
  }
  // the deck's underside where it stands clear of the station box, in strips across
  B.tint(FASCIA);
  const strips = 6;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i], b = cuts[i + 1];
    for (let k = 0; k < strips; k++) {
      const pa = across(a, (width(a) * k) / strips), pa1 = across(a, (width(a) * (k + 1)) / strips);
      const pb = across(b, (width(b) * k) / strips), pb1 = across(b, (width(b) * (k + 1)) / strips);
      const m = mid(mid(pa, pa1), mid(pb, pb1));
      if (overBox(m[0], m[1])) continue;
      B.poly([v3(pa, a.y - DEPTH.road), v3(pa1, a.y - DEPTH.road), v3(pb1, b.y - DEPTH.road), v3(pb, b.y - DEPTH.road)], DOWN, 'concrete', 4);
    }
  }
  // the median: a concrete barrier
  B.tint(CONCRETE);
  const med = (c: Cut, d: number) => across(c, width(c) / 2 + d);
  loft(B, cuts.map((c) => [v3(med(c, -0.3), c.y), v3(med(c, -0.12), c.y + 0.8), v3(med(c, 0.12), c.y + 0.8), v3(med(c, 0.3), c.y)]), 'concrete',
    () => UP, 2);
  // the lane lines: three lanes each way, dashed (3 m in 12) between them, solid at the edges
  B.tint(0xe8e8e2);
  const lines: { d: (c: Cut) => number; dashed: boolean }[] = [];
  const lane = (c: Cut) => (width(c) - 2.0 - 1.4) / 6;
  lines.push({ d: () => 1.0, dashed: false }, { d: (c) => width(c) - 1.0, dashed: false });
  lines.push({ d: (c) => width(c) / 2 - 0.7, dashed: false }, { d: (c) => width(c) / 2 + 0.7, dashed: false });
  for (const k of [1, 2]) {
    lines.push({ d: (c) => 1.0 + lane(c) * k, dashed: true }, { d: (c) => width(c) - 1.0 - lane(c) * k, dashed: true });
  }
  for (const ln of lines) {
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1];
      if (ln.dashed && (a.s % 12) > 3) continue;
      const pa0 = across(a, ln.d(a) - 0.08), pa1 = across(a, ln.d(a) + 0.08), pb0 = across(b, ln.d(b) - 0.08), pb1 = across(b, ln.d(b) + 0.08);
      B.poly([v3(pa0, a.y + 0.012), v3(pa1, a.y + 0.012), v3(pb1, b.y + 0.012), v3(pb0, b.y + 0.012)], UP, 'gs-paint', 4);
    }
  }
  // lamp posts on either side, every 50 m or so in turn: a grey pole 10 m high, its arm over the road
  B.tint(GALVANISED);
  for (const c of cuts) {
    const k = Math.round(c.s / 2);
    if (k % 25 !== 0 || c.s < 4) continue;
    const side = (k / 25) % 2 ? -1 : 1;
    const foot = across(c, side < 0 ? 0.25 : width(c) - 0.25);
    B.lathe(foot[0], foot[1], [[0.11, c.y + 0.45], [0.09, c.y + 6], [0.06, c.y + 10]], 'metal', 8);
    const inn = side < 0 ? east(c) : west(c);
    const tip: V3 = [foot[0] + inn[0] * 2.2, c.y + 10.2, foot[1] + inn[2] * 2.2];
    rod(B, [foot[0], c.y + 10, foot[1]], tip, 0.08, 0.08, 'metal');
    rod(B, [tip[0] - inn[0] * 0.4, tip[1], tip[2] - inn[2] * 0.4], [tip[0] + inn[0] * 0.3, tip[1] - 0.05, tip[2] + inn[2] * 0.3], 0.28, 0.14, 'metal');
  }
  // the piers, every 24 m where the deck stands clear: a pair of round columns under a crosshead
  for (const c of cuts) {
    if (Math.round(c.s / 2) % 12 !== 6) continue;
    const zc = z(c);
    if (zc < 930) continue;
    const top = c.y - DEPTH.road, wd = width(c);
    const cols = [0.25, 0.75].map((f) => across(c, wd * f)).filter((p) => !overBox(p[0], p[1]) && !overBox(p[0] + 1, p[1]) && !overBox(p[0] - 1, p[1]));
    if (!cols.length) continue;
    B.tint(PIER);
    const ends = [across(c, wd * 0.12), across(c, wd * 0.88)];
    if (cols.length === 2) beam(B, v3(ends[0], top), v3(ends[1], top), 1.6, 1.1, 'concrete');
    for (const p of cols) {
      const g = ground(p[0], p[1]) ?? 0;
      B.lathe(p[0], p[1], [[0.75, g - 1.5], [0.75, top - (cols.length === 2 ? 1.1 : 0)]], 'concrete', 14);
    }
  }
}

// ------------------------------------------------------------------ the railway
export function buildRailway(B: Builder, ground: Ground, part: 'north' | 'south') {
  const all = deck(railRows, 2);
  const cuts = part === 'north' ? all.filter((c) => mid(c.w, c.e)[1] <= 1001) : all.filter((c) => mid(c.w, c.e)[1] >= 999);
  if (cuts.length < 2) return;
  const z = (c: Cut) => mid(c.w, c.e)[1];
  const bank = (c: Cut) => z(c) < WATER[0];
  const bed = (c: Cut) => c.y - 0.25;
  const road = deck(roadRows, 2);
  // the road's west edge over the railway's east edge
  const underRoad = (p: V2) => road.some((r) => Math.hypot(r.w[0] - p[0], r.w[1] - p[1]) < 1.6);

  // the ballast, with the two tracks' sleepers in it
  const mids = (c: Cut) => [width(c) / 2 - TRACKS, width(c) / 2 + TRACKS];
  B.tint(BALLAST);
  for (const [f0, f1] of [[(c: Cut) => 0, (c: Cut) => mids(c)[0] - 1.5], [(c: Cut) => mids(c)[0] + 1.5, (c: Cut) => mids(c)[1] - 1.5],
    [(c: Cut) => mids(c)[1] + 1.5, (c: Cut) => width(c)]]) {
    loft(B, cuts.map((c) => [v3(across(c, f0(c)), bed(c) + 0.1), v3(across(c, f1(c)), bed(c) + 0.1)]), 'stone', () => UP, 3);
  }
  B.tint(0xffffff);
  for (const t of [0, 1]) {
    loft(B, cuts.map((c) => {
      const m = mids(c)[t];
      return [v3(across(c, m - 1.5), bed(c) + 0.1), v3(across(c, m + 1.5), bed(c) + 0.1)];
    }), 'gs-bed', () => UP, 4, (i, k) => [k, cuts[i].s / 2.6]);
  }
  // the rails
  B.tint(RAIL_STEEL);
  for (const t of [0, 1]) for (const g of [-GAUGE, GAUGE]) {
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1];
      rod(B, v3(across(a, mids(a)[t] + g), a.y), v3(across(b, mids(b)[t] + g), b.y), 0.07, 0.16, 'metal');
    }
  }
  // its sides: on the bank, walls down to the ground (the west one white along the quay, with the
  // station's entrance through it); over the water and the street on Södermalm, a deck's fascia
  // over piers. The east side is the road's wall from the station to the shore.
  const QUAY_DOOR: V2 = [431, 962.4];
  for (const side of [-1, 1] as const) {
    const edge = (c: Cut) => (side < 0 ? c.w : c.e);
    const out = (i: number) => (side < 0 ? west(cuts[i]) : east(cuts[i]));
    const covered = (c: Cut) => side > 0 && underRoad(c.e);
    // the coping and railing
    const rows: V3[][] = [];
    for (const c of cuts) {
      const e = edge(c);
      rows.push([v3(e, bed(c) + 0.45), v3(across(c, side < 0 ? 0.45 : width(c) - 0.45), bed(c) + 0.45)]);
    }
    B.tint(CONCRETE);
    loft(B, rows, 'concrete', () => UP, 2);
    loft(B, cuts.map((c) => [v3(across(c, side < 0 ? 0.45 : width(c) - 0.45), bed(c) + 0.45), v3(across(c, side < 0 ? 0.45 : width(c) - 0.45), bed(c) + 0.1)]),
      'concrete', (i) => (side < 0 ? east(cuts[i]) : west(cuts[i])), 2);
    // the face: by run, the white wall, the concrete wall or the fascia
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1];
      if (covered(a) && covered(b)) continue;
      const ea = edge(a), eb = edge(b);
      const ga = ground(ea[0], ea[1]) ?? 0, gb = ground(eb[0], eb[1]) ?? 0;
      const onBank = bank(a) && bank(b);
      const fa = onBank ? ga - 0.4 : bed(a) - DEPTH.rail, fb = onBank ? gb - 0.4 : bed(b) - DEPTH.rail;
      // the band at the top
      B.tint(onBank && side < 0 ? 0xc9c6bf : FASCIA);
      B.poly([v3(ea, bed(a) + 0.45), v3(eb, bed(b) + 0.45), v3(eb, bed(b) - 0.15), v3(ea, bed(a) - 0.15)], out(i), 'concrete', 2);
      if (onBank && side < 0) {
        // the white wall; the entrance's opening
        const dm = mid(ea, eb), door = Math.hypot(dm[0] - QUAY_DOOR[0], dm[1] - QUAY_DOOR[1]) < 3.1;
        B.tint(WHITE_WALL);
        if (door) {
          const top = Math.min(1.6 + 2.8, bed(a) - 0.15);
          B.poly([v3(ea, top), v3(eb, top), v3(eb, bed(b) - 0.15), v3(ea, bed(a) - 0.15)], out(i), 'plaster', 3);
          B.tint(0x2b2c2e);
          const o = out(i);
          const back = (p: V2): V2 => [p[0] - o[0] * 3, p[1] - o[2] * 3];
          B.poly([v3(back(ea), fa), v3(back(eb), fb), v3(back(eb), top), v3(back(ea), top)], o, 'gs-dark', 3);
          B.tint(0xbfcad0);
          B.poly([v3(ea, top), v3(eb, top), v3(back(eb), top), v3(back(ea), top)], DOWN, 'stone', 1);
        } else {
          B.poly([v3(ea, fa), v3(eb, fb), v3(eb, bed(b) - 0.15), v3(ea, bed(a) - 0.15)], out(i), 'plaster', 3);
        }
      } else {
        B.tint(onBank ? CONCRETE : FASCIA);
        B.poly([v3(ea, fa), v3(eb, fb), v3(eb, bed(b) - 0.15), v3(ea, bed(a) - 0.15)], out(i), 'concrete', 3);
      }
    }
    // the railing
    B.tint(side < 0 ? BARS_RUST : BARS_DARK);
    const pts: V3[] = [], outs: V3[] = [];
    for (let i = 0; i < cuts.length; i++) {
      const c = cuts[i];
      if (covered(c)) {
        if (pts.length > 1) railing(B, pts, 1.1, (j) => outs[j]);
        pts.length = 0; outs.length = 0;
        continue;
      }
      pts.push(v3(across(c, side < 0 ? 0.12 : width(c) - 0.12), bed(c) + 0.45));
      outs.push(side < 0 ? west(c) : east(c));
    }
    if (pts.length > 1) railing(B, pts, 1.1, (j) => outs[j]);
  }
  // the quay entrance's sign, over the opening
  {
    const c = cuts.reduce((m, q) => (Math.hypot(q.w[0] - QUAY_DOOR[0], q.w[1] - QUAY_DOOR[1]) < Math.hypot(m.w[0] - QUAY_DOOR[0], m.w[1] - QUAY_DOOR[1]) ? q : m), cuts[0]);
    if (Math.hypot(c.w[0] - QUAY_DOOR[0], c.w[1] - QUAY_DOOR[1]) < 4) {
      const o = west(c), dir: V2 = [c.along[0], c.along[1]];
      const p = (d: number): V2 => [QUAY_DOOR[0] + dir[0] * d + o[0] * 0.08, QUAY_DOOR[1] + dir[1] * d + o[2] * 0.08];
      B.tint(0xffffff);
      // read from the quay, north to south
      B.poly([v3(p(-2.3), 4.5), v3(p(2.3), 4.5), v3(p(2.3), 5.3), v3(p(-2.3), 5.3)], o, 'gs-sign', 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  }
  // the underside and the piers where it is a bridge
  B.tint(FASCIA);
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i], b = cuts[i + 1];
    if (bank(a) || bank(b)) continue;
    B.poly([v3(a.w, bed(a) - DEPTH.rail), v3(a.e, bed(a) - DEPTH.rail), v3(b.e, bed(b) - DEPTH.rail), v3(b.w, bed(b) - DEPTH.rail)], DOWN, 'concrete', 4);
  }
  B.tint(PIER);
  for (const c of cuts) {
    if (bank(c) || Math.round(c.s / 2) % 12 !== 3) continue;
    const top = bed(c) - DEPTH.rail, m = mid(c.w, c.e), g = ground(m[0], m[1]) ?? 0;
    const a = across(c, 0.8), b = across(c, width(c) - 0.8);
    beam(B, v3(a, top), v3(b, top), 1.5, top - g + 1.5, 'concrete');
  }
  // the overhead line: a mast on the west side every 42 m or so with its arm over both tracks,
  // and over each track the contact wire under its catenary
  B.tint(GALVANISED);
  for (const c of cuts) {
    if (Math.round(c.s / 2) % 21 !== 10) continue;
    const foot = across(c, 0.3), o = east(c);
    B.box([foot[0] - 0.14, bed(c) + 0.45, foot[1] - 0.14], [foot[0] + 0.14, c.y + 7.6, foot[1] + 0.14], 'metal', 2);
    const tip = across(c, width(c) / 2 + TRACKS + 1.2);
    rod(B, [foot[0] + o[0] * 0.14, c.y + 6.9, foot[1] + o[2] * 0.14], v3(tip, c.y + 6.9), 0.1, 0.12, 'metal');
    rod(B, [foot[0] + o[0] * 0.14, c.y + 7.55, foot[1] + o[2] * 0.14], v3(tip, c.y + 6.95), 0.06, 0.06, 'metal');
  }
  B.tint(WIRE);
  for (const t of [0, 1]) {
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1];
      const pa = across(a, (t ? width(a) / 2 + TRACKS : width(a) / 2 - TRACKS)), pb = across(b, (t ? width(b) / 2 + TRACKS : width(b) / 2 - TRACKS));
      rod(B, v3(pa, a.y + 5.5), v3(pb, b.y + 5.5), 0.025, 0.025, 'metal');
      rod(B, v3(pa, a.y + 6.6), v3(pb, b.y + 6.6), 0.025, 0.025, 'metal');
    }
  }
}

// ------------------------------------------------------------------ the tunnels' mouths on Södermalm
export function buildPortals(B: Builder) {
  const [u, v] = PORTAL, l = Math.hypot(v[0] - u[0], v[1] - u[1]);
  const d: V2 = [(v[0] - u[0]) / l, (v[1] - u[1]) / l], n: V3 = [d[1], 0, -d[0]];
  const along = (p: V2) => (p[0] - u[0]) * d[0] + (p[1] - u[1]) * d[1];
  const P = (a: number, y: number, off: number): V3 => [u[0] + d[0] * a + n[0] * off, y, u[1] + d[1] * a + n[2] * off];
  for (const [rows, h] of [[roadRows, 5.2], [railRows, 6.2]] as const) {
    const cuts = deck(rows as [number, number, number, number][], 2), c = cuts[cuts.length - 1];
    const a0 = along(c.w), a1 = along(c.e), y = rows === railRows ? c.y - 0.25 : c.y;
    // the opening, dark, and a concrete frame round it
    B.tint(0x1d1e20);
    B.poly([P(a0, y, 0.1), P(a1, y, 0.1), P(a1, y + h, 0.1), P(a0, y + h, 0.1)], n, 'gs-dark', 4);
    B.tint(PIER);
    B.wallBox(P(0, 0, 0), [d[0], 0, d[1]], n, a0 - 0.6, a1 + 0.6, y + h, y + h + 0.9, 0, 0.35, 'concrete', 2);
  }
}

// ------------------------------------------------------------------ the station
export function buildStation(B: Builder, ground: Ground) {
  // in the station's frame
  B.place([ST.x, 0, ST.z], ST.turn);
  const g = (x: number, z: number) => { const w = toWorld([x, z]); return ground(w[0], w[1]) ?? 2.6; };
  // the road's east edge in the frame: the deck's own roof reaches from it to the east wall
  const road = deck(roadRows, 2).map((c) => toFrame(c.e));
  const roadWest = deck(roadRows, 2).map((c) => toFrame(c.w));
  const fromRoad = (z: number) => xAt(road, z);
  const wallX = (z: number) => xAt(EAST_WALL, z) + 0.3;
  const zs = (z0: number, z1: number, step: number) => {
    const n = Math.max(1, Math.ceil((z1 - z0) / step));
    return Array.from({ length: n + 1 }, (_, k) => z0 + ((z1 - z0) * k) / n);
  };
  const north = road[0][1] + 0.5;

  // the deck east of the road, paved, with a railing along its east edge
  const flat = zs(north, ROOF.north, 3);
  B.tint(DECK_PAVING);
  loft(B, flat.map((z) => [[fromRoad(z) - 0.2, OVER_BOX, z], [wallX(z), OVER_BOX, z]] as V3[]), 'stone', () => UP, 3);
  B.tint(BARS_DARK);
  railing(B, flat.map((z) => [wallX(z) - 0.15, OVER_BOX + 0.2, z] as V3), 1.0, () => [1, 0, 0]);

  // the roof over the rest, with its lanterns
  const lz = zs(ROOF.north, BOX_END + 0.3, 2);
  B.tint(ROOF_TINT);
  loft(B, lz.map((z) => [[fromRoad(z) + 0.3, ROOF.y, z], [wallX(z), ROOF.y, z]] as V3[]), 'roof', () => UP, 4);
  // its edges: a step up from the road and the deck, the fascia over the east wall and the south end
  B.tint(0x77706b);
  loft(B, lz.map((z) => [[fromRoad(z) + 0.3, ROOF.y + 0.25, z], [fromRoad(z) + 0.3, OVER_BOX, z]] as V3[]), 'concrete', () => [-1, 0, 0], 2);
  loft(B, lz.map((z) => [[fromRoad(z) + 0.3, ROOF.y + 0.25, z], [fromRoad(z) + 0.6, ROOF.y + 0.25, z]] as V3[]), 'concrete', () => UP, 2);
  {
    const z0 = ROOF.north, x0 = fromRoad(z0) + 0.3, x1 = wallX(z0);
    B.poly([[x0, OVER_BOX, z0], [x1, OVER_BOX, z0], [x1, ROOF.y + 0.25, z0], [x0, ROOF.y + 0.25, z0]], [0, 0, -1], 'concrete', 2);
    const z1 = BOX_END + 0.3, x2 = fromRoad(z1) + 0.3, x3 = wallX(z1);
    B.poly([[x2, ROOF.y - 0.6, z1], [x3, ROOF.y - 0.6, z1], [x3, ROOF.y + 0.25, z1], [x2, ROOF.y + 0.25, z1]], [0, 0, 1], 'concrete', 2);
  }
  for (const zc of ROOF.lanterns) {
    const x0 = fromRoad(zc) + 1.2, x1 = wallX(zc) - 0.9, h = 0.85, hw = 0.8;
    const ridge = (x: number): V3 => [x, ROOF.y + h, zc];
    B.tint(0xc4d2da);
    B.poly([[x0, ROOF.y, zc - hw], [x1, ROOF.y, zc - hw], ridge(x1), ridge(x0)], [0, hw, -h], 'gs-glass', 2);
    B.poly([[x0, ROOF.y, zc + hw], [x1, ROOF.y, zc + hw], ridge(x1), ridge(x0)], [0, hw, h], 'gs-glass', 2);
    B.tint(0x6e6862);
    B.poly([[x0, ROOF.y, zc - hw], [x0, ROOF.y, zc + hw], ridge(x0)], [-1, 0, 0], 'metal', 2);
    B.poly([[x1, ROOF.y, zc - hw], [x1, ROOF.y, zc + hw], ridge(x1)], [1, 0, 0], 'metal', 2);
    rod(B, [x0, ROOF.y + h + 0.05, zc], [x1, ROOF.y + h + 0.05, zc], 0.12, 0.08, 'metal');
  }

  // the east wall along Munkbroleden: light grey between pilasters, a band at the top, and the
  // entrance in its southern part
  const DOOR = { z0: 46.6, z1: 51.2, h: 2.9 };
  const wz = zs(north, BOX_END + 0.3, 1.5).filter((z) => z <= DOOR.z0 || z >= DOOR.z1);
  wz.push(DOOR.z0, DOOR.z1);
  wz.sort((a, b) => a - b);
  const topAt = (z: number) => (z < ROOF.north ? OVER_BOX + 0.2 : ROOF.y + 0.25);
  for (let i = 0; i + 1 < wz.length; i++) {
    const za = wz[i], zb = wz[i + 1];
    if (zb - za < 1e-3) continue;
    const xa = wallX(za), xb = wallX(zb), n: V3 = [zb - za, 0, -(xb - xa)];
    const ga = g(xa, za) - 0.5, gb = g(xb, zb) - 0.5;
    const door = za >= DOOR.z0 - 1e-6 && zb <= DOOR.z1 + 1e-6;
    // the top's step where the roof begins
    const ta = topAt(za + 1e-4), tb = topAt(zb - 1e-4);
    B.tint(STATION_WALL);
    if (door) {
      const dg = Math.max(g(xa, za), g(xb, zb));
      B.poly([[xa, dg + DOOR.h, za], [xb, dg + DOOR.h, zb], [xb, tb - 0.6, zb], [xa, ta - 0.6, za]], n, 'plaster', 3);
      // the passage behind, dark, its reveals tiled
      B.tint(0x303234);
      B.poly([[xa - 3, dg - 0.5, za], [xb - 3, dg - 0.5, zb], [xb - 3, dg + DOOR.h, zb], [xa - 3, dg + DOOR.h, za]], n, 'gs-dark', 3);
      B.tint(0xb9c6cc);
      B.poly([[xa, dg + DOOR.h, za], [xb, dg + DOOR.h, zb], [xb - 3, dg + DOOR.h, zb], [xa - 3, dg + DOOR.h, za]], DOWN, 'stone', 1);
      B.poly([[xa, dg - 0.5, za], [xa - 3, dg - 0.5, za], [xa - 3, dg + DOOR.h, za], [xa, dg + DOOR.h, za]], [0, 0, 1], 'stone', 1);
      B.poly([[xb, dg - 0.5, zb], [xb - 3, dg - 0.5, zb], [xb - 3, dg + DOOR.h, zb], [xb, dg + DOOR.h, zb]], [0, 0, -1], 'stone', 1);
      // the sign over it, read from the street
      B.tint(0xffffff);
      const zc = (za + zb) / 2, xc = wallX(zc) + 0.2;
      B.poly([[xc, dg + DOOR.h + 0.15, zc + 2.3], [xc, dg + DOOR.h + 0.15, zc - 2.3], [xc, dg + DOOR.h + 0.95, zc - 2.3], [xc, dg + DOOR.h + 0.95, zc + 2.3]],
        [1, 0, 0], 'gs-sign', 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    } else {
      B.poly([[xa, ga, za], [xb, gb, zb], [xb, tb - 0.6, zb], [xa, ta - 0.6, za]], n, 'plaster', 3);
    }
    // the band at the top
    B.tint(0xb7b3ab);
    B.poly([[xa, ta - 0.6, za], [xb, tb - 0.6, zb], [xb + 0.12, tb - 0.6, zb], [xa + 0.12, ta - 0.6, za]], DOWN, 'concrete', 2);
    B.poly([[xa + 0.12, ta - 0.6, za], [xb + 0.12, tb - 0.6, zb], [xb + 0.12, tb, zb], [xa + 0.12, ta, za]], n, 'concrete', 2);
    B.poly([[xa, ta, za], [xb, tb, zb], [xb + 0.12, tb, zb], [xa + 0.12, ta, za]], UP, 'concrete', 2);
  }
  // the pilasters, every 6 m
  B.tint(0xd6d3cc);
  for (let z = north + 3; z < BOX_END - 1; z += 6) {
    if (z > DOOR.z0 - 1.2 && z < DOOR.z1 + 1.2) continue;
    const x = wallX(z), gz = g(x, z) - 0.5;
    B.box([x, gz, z - 0.45], [x + 0.22, topAt(z) - 0.6, z + 0.45], 'plaster', 2, ['-x']);
  }
  // the box's west wall, where it stands clear under the road's deck
  B.tint(0xa9a69f);
  const west = zs(-10, BOX_END, 1.5);
  for (let i = 0; i + 1 < west.length; i++) {
    const za = west[i], zb = west[i + 1];
    const xa = xAt(WEST_WALL, za) - 0.3, xb = xAt(WEST_WALL, zb) - 0.3;
    if (xAt(roadWest, za) > xa - 1.5 || xAt(roadWest, zb) > xb - 1.5) continue;
    B.poly([[xa, g(xa, za) - 0.5, za], [xb, g(xb, zb) - 0.5, zb], [xb, OVER_BOX, zb], [xa, OVER_BOX, za]], [-(zb - za), 0, xb - xa], 'concrete', 3);
  }
  B.place([0, 0, 0], 0);
}

// ------------------------------------------------------------------ the station's south end
// South of its roof the four tracks run out in the open over the quay to the metro's bridge,
// between low concrete walls: the green line's outside, the red line's in the middle (the game's
// track, public/data/track-geometry.json: frame z, frame x and the rails' top, every 9 m). The two
// island platforms reach some 17 m out from under the roof, each with a canopy (Google's mesh).
const SOUTH: { [k in 'wg' | 'wr' | 'er' | 'eg']: V3[] } = {
  wg: [[55.0, -14.12, 2.94], [64.8, -12.93, 2.97], [73.6, -11.53, 3.06], [82.4, -9.86, 3.14], [91.1, -8.0, 3.3], [99.8, -6.05, 3.49], [108.5, -4.04, 3.68], [117.2, -1.97, 3.87]],
  wr: [[54.4, -2.86, 3], [64.4, -2.08, 3.04], [73.2, -1.28, 3.16], [82.1, -0.35, 3.27], [90.9, 0.7, 3.43], [99.7, 1.89, 3.62], [108.5, 3.22, 3.82], [117.2, 4.66, 4.03]],
  er: [[54.2, 1.18, 2.99], [64.2, 1.99, 3.03], [73.1, 2.88, 3.15], [82.0, 3.93, 3.28], [90.9, 5.15, 3.44], [99.7, 6.57, 3.64], [108.5, 8.17, 3.84], [117.3, 9.93, 4.04]],
  eg: [[53.8, 12.46, 2.96], [63.8, 12.71, 2.97], [73.0, 12.86, 3.07], [82.2, 13.07, 3.17], [91.4, 13.47, 3.32], [100.5, 14.1, 3.51], [109.7, 14.99, 3.72], [118.8, 16.1, 3.94]],
};
// where the platforms end, and the bridge begins
const PLATFORM_END = 82, SOUTH_END = 116;
// a track's frame x and rails' top at frame z
const trackAt = (t: V3[], z: number): V2 => {
  let i = 0;
  while (i + 2 < t.length && z > t[i + 1][0]) i++;
  const f = (z - t[i][0]) / (t[i + 1][0] - t[i][0]);
  return [t[i][1] + (t[i + 1][1] - t[i][1]) * f, t[i][2] + (t[i + 1][2] - t[i][2]) * f];
};

export function buildSouthEnd(B: Builder, ground: Ground) {
  B.place([ST.x, 0, ST.z], ST.turn);
  const g = (x: number, z: number) => { const w = toWorld([x, z]); return ground(w[0], w[1]) ?? 2.6; };
  const n = Math.ceil((SOUTH_END - BOX_END) / 2);
  const zs = Array.from({ length: n + 1 }, (_, k) => BOX_END + ((SOUTH_END - BOX_END) * k) / n);
  const at = (z: number) => ({ wg: trackAt(SOUTH.wg, z), wr: trackAt(SOUTH.wr, z), er: trackAt(SOUTH.er, z), eg: trackAt(SOUTH.eg, z) });
  // the formation's floor between and beside the tracks (the ballast stands on it), a walk outside
  // each green track, and the walls down to the quay with a railing along their top
  const FORM = -0.58, WALK = 2.4, EDGE = 5.2;
  // (each track's part at its own level, as the network draws its formation: across to 3.8 m from
  // it, or halfway to the next)
  const floor = (z: number): V3[] => {
    const t = at(z), p = (v: V2, dx: number): V3 => [v[0] + dx, v[1] + FORM, z];
    const half = (a: V2, b: V2) => Math.min(S.EMBANKMENT.formation, (b[0] - a[0]) / 2);
    const w = half(t.wg, t.wr), e = half(t.er, t.eg);
    return [p(t.wg, -WALK), p(t.wg, 0), p(t.wg, w), p(t.wr, -w), p(t.wr, 0), p(t.er, 0), p(t.er, e), p(t.eg, -e), p(t.eg, 0), p(t.eg, WALK)];
  };
  B.tint(BALLAST);
  loft(B, zs.map(floor), 'stone', () => UP, 3);
  B.tint(0xa9a69f);
  for (const side of [-1, 1]) {
    const k = side < 0 ? 'wg' : 'eg';
    const edge = (z: number, d: number): V3 => { const t = trackAt(SOUTH[k], z); return [t[0] + side * d, t[1] + FORM, z]; };
    loft(B, zs.map((z) => side < 0 ? [edge(z, EDGE), edge(z, WALK)] : [edge(z, WALK), edge(z, EDGE)]), 'concrete', () => UP, 3);
    loft(B, zs.map((z) => { const e = edge(z, EDGE); return [[e[0], e[1] + 0.25, z], [e[0], g(e[0], z) - 0.5, z]] as V3[]; }), 'concrete', () => [side, 0, 0], 3);
    loft(B, zs.map((z) => { const e = edge(z, EDGE); return [[e[0], e[1] + 0.25, z], [e[0] - side * 0.25, e[1] + 0.25, z]] as V3[]; }), 'concrete', () => UP, 2);
    loft(B, zs.map((z) => { const e = edge(z, EDGE - 0.25); return [[e[0], e[1] + 0.25, z], [e[0], e[1], z]] as V3[]; }), 'concrete', () => [-side, 0, 0], 2);
  }
  B.tint(BARS_DARK);
  for (const side of [-1, 1]) {
    const k = side < 0 ? 'wg' : 'eg';
    railing(B, zs.map((z) => { const t = trackAt(SOUTH[k], z); return [t[0] + side * (EDGE - 0.12), t[1] + FORM + 0.25, z] as V3; }), 1.0, () => [side, 0, 0]);
  }

  // the island platforms' open ends, each between a green and a red track, and their canopies
  const pz = zs.filter((z) => z < PLATFORM_END).concat(PLATFORM_END);
  for (const [a, b] of [['wg', 'wr'], ['er', 'eg']] as const) {
    const side = (z: number) => {
      const p = trackAt(SOUTH[a], z), q = trackAt(SOUTH[b], z), y = (p[1] + q[1]) / 2 + S.PLATFORM_HEIGHT;
      return { x0: p[0] + S.PLATFORM_EDGE, x1: q[0] - S.PLATFORM_EDGE, y, f0: p[1] + FORM, f1: q[1] + FORM };
    };
    B.tint(0xb3b0a8);
    loft(B, pz.map((z) => { const e = side(z); return [[e.x0 + 0.35, e.y, z], [e.x1 - 0.35, e.y, z]] as V3[]; }), 'concrete', () => UP, 3);
    B.tint(0xe2e0da);
    loft(B, pz.map((z) => { const e = side(z); return [[e.x0, e.y, z], [e.x0 + 0.35, e.y, z]] as V3[]; }), 'stone', () => UP, 1);
    loft(B, pz.map((z) => { const e = side(z); return [[e.x1 - 0.35, e.y, z], [e.x1, e.y, z]] as V3[]; }), 'stone', () => UP, 1);
    B.tint(0x9c9890);
    loft(B, pz.map((z) => { const e = side(z); return [[e.x0, e.y, z], [e.x0, e.f0, z]] as V3[]; }), 'concrete', () => [-1, 0, 0], 2);
    loft(B, pz.map((z) => { const e = side(z); return [[e.x1, e.y, z], [e.x1, e.f1, z]] as V3[]; }), 'concrete', () => [1, 0, 0], 2);
    const e = side(PLATFORM_END);
    B.poly([[e.x0, e.f0, PLATFORM_END], [e.x1, e.f1, PLATFORM_END], [e.x1, e.y, PLATFORM_END], [e.x0, e.y, PLATFORM_END]], [0, 0, 1], 'concrete', 2);
    // the canopy: a light roof on a row of posts down the middle
    const CANOPY = { z0: BOX_END + 0.3, z1: PLATFORM_END - 2, h: 3.1 };
    const cz = pz.filter((z) => z > CANOPY.z0 && z < CANOPY.z1).concat([CANOPY.z0, CANOPY.z1]).sort((p, q) => p - q);
    B.tint(0xc9cbc8);
    loft(B, cz.map((z) => { const c = side(z); return [[c.x0 + 0.5, c.y + CANOPY.h, z], [c.x1 - 0.5, c.y + CANOPY.h, z]] as V3[]; }), 'metal', () => UP, 2);
    loft(B, cz.map((z) => { const c = side(z); return [[c.x0 + 0.5, c.y + CANOPY.h - 0.25, z], [c.x1 - 0.5, c.y + CANOPY.h - 0.25, z]] as V3[]; }), 'metal', () => DOWN, 2);
    for (const sd of [-1, 1]) {
      loft(B, cz.map((z) => { const c = side(z), x = sd < 0 ? c.x0 + 0.5 : c.x1 - 0.5; return [[x, c.y + CANOPY.h, z], [x, c.y + CANOPY.h - 0.25, z]] as V3[]; }), 'metal', () => [sd, 0, 0], 2);
    }
    const c1 = side(CANOPY.z1);
    B.poly([[c1.x0 + 0.5, c1.y + CANOPY.h - 0.25, CANOPY.z1], [c1.x1 - 0.5, c1.y + CANOPY.h - 0.25, CANOPY.z1], [c1.x1 - 0.5, c1.y + CANOPY.h, CANOPY.z1], [c1.x0 + 0.5, c1.y + CANOPY.h, CANOPY.z1]], [0, 0, 1], 'metal', 2);
    B.tint(0x5d6064);
    for (let z = CANOPY.z0 + 2; z < CANOPY.z1; z += 5) {
      const c = side(z), x = (c.x0 + c.x1) / 2;
      B.box([x - 0.12, c.y, z - 0.12], [x + 0.12, c.y + CANOPY.h - 0.25, z + 0.12], 'metal', 1);
    }
  }
  B.place([0, 0, 0], 0);
}

// ------------------------------------------------------------------ Söderströmsbron
// The metro's bridge to Slussen. The network draws its deck, tracks and piers; near the camera this
// adds what its edges look like since the rebuild of 2015–19 (Commons photos): galvanised railings
// of upright bars along both edges, the steel spans' dark grey edge girders over the water (the
// spans over Söder Mälarstrand are concrete), and the timber walkway along the west edge.
// Its deck edges, 2.6 m out from the outer tracks (S.BRIDGE.deck) as the network draws them, from
// track-geometry.json: world x, z and the rail's y, from Gamla stan to Söder.
type EdgeRow = [number, number, number];
const METRO_WEST: EdgeRow[] = [
  [497.8, 1017.3, 3.87], [503.6, 1024.1, 4.13], [509.3, 1030.9, 4.38], [515.1, 1037.7, 4.64], [520.9, 1044.4, 4.9],
  [526.6, 1051.4, 5.15], [532.9, 1057.6, 5.41], [538.6, 1065.1, 5.65], [544.8, 1072.4, 5.89], [551.0, 1079.6, 6.13],
  [557.2, 1086.8, 6.37], [563.3, 1093.9, 6.61], [569.5, 1101.1, 6.85], [575.7, 1108.3, 7.09], [581.9, 1115.5, 7.27],
  [588.0, 1122.7, 7.41], [594.2, 1129.9, 7.54], [600.3, 1137.1, 7.68], [606.3, 1144.4, 7.79], [612.3, 1151.7, 7.86],
  [618.2, 1159.1, 7.92], [624.0, 1166.6, 7.95], [629.7, 1174.1, 7.97], [635.3, 1181.7, 7.95], [640.9, 1189.3, 7.94],
  [646.4, 1197.0, 7.92],
];
const METRO_EAST: EdgeRow[] = [
  [518.8, 1007.4, 3.94], [524.5, 1015.5, 4.22], [530.6, 1023.5, 4.5], [535.9, 1031.8, 4.82], [542.5, 1039.1, 5.11],
  [548.8, 1046.8, 5.41], [555.1, 1054.4, 5.63], [561.5, 1061.9, 5.85], [568.0, 1069.4, 6.06], [574.5, 1076.9, 6.27],
  [581.0, 1084.4, 6.49], [587.5, 1091.9, 6.7], [594.0, 1099.4, 6.92], [600.4, 1106.9, 7.13], [606.9, 1114.5, 7.34],
  [613.3, 1122.0, 7.56], [619.7, 1129.6, 7.77], [626.0, 1137.3, 7.84], [632.3, 1144.9, 7.92], [638.6, 1152.7, 7.95],
  [644.8, 1160.4, 7.98], [651.1, 1168.1, 7.97], [657.3, 1175.8, 7.95], [663.6, 1183.6, 7.94],
];
const GIRDER_GREY = 0x55595c, RAILING_GALVANISED = 0xb9bdbf, WALKWAY = 0x8c7a62;

export function buildMetroBridge(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  // the edge girder's top and foot, as the network draws it (to 0.25 m out from the edge)
  const top = S.FLOOR + 0.3, foot = S.FLOOR - S.BRIDGE.depth;
  for (const [side, edge] of [[-1, METRO_WEST], [1, METRO_EAST]] as const) {
    // outward, square to the edge (going south, east is (dz, −dx))
    const outs = edge.map((_, i): V3 => {
      const a = edge[Math.max(0, i - 1)], b = edge[Math.min(edge.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [(side * (b[1] - a[1])) / l, 0, (-side * (b[0] - a[0])) / l];
    });
    const at = (i: number, d: number, dy: number): V3 => [edge[i][0] + outs[i][0] * d, edge[i][2] + dy, edge[i][1] + outs[i][2] * d];
    const along = edge.reduce<number[]>((s, r, i) => s.concat(i ? s[i - 1] + Math.hypot(r[0] - edge[i - 1][0], r[1] - edge[i - 1][1]) : 0), []);
    const idx = edge.map((_, i) => i);

    // the railing, under the network's handrail
    B.tint(RAILING_GALVANISED);
    railing(B, idx.map((i) => at(i, 0.12, top)), S.BRIDGE.railing - 0.3, (i) => outs[i]);

    // the steel spans' edge girder, a little proud of the network's, where the bridge is over water
    const water = idx.map((i) => (ground(edge[i][0], edge[i][1]) ?? 0) < 1.6);
    B.tint(GIRDER_GREY);
    for (let i = 0; i + 1 < edge.length; i++) {
      if (!water[i] || !water[i + 1]) continue;
      loft(B, [i, i + 1].map((k) => [at(k, 0.28, top + 0.02), at(k, 0.28, foot - 0.1)]), 'gs-paint', () => outs[i], 2);
      loft(B, [i, i + 1].map((k) => [at(k, 0, top + 0.02), at(k, 0.28, top + 0.02)]), 'gs-paint', () => UP, 2);
    }

    // the walkway, inside the west edge's railing
    if (side < 0) {
      B.tint(WALKWAY);
      loft(B, idx.map((i) => [at(i, -0.95, -0.2), at(i, -0.1, -0.2)]), 'gs-boards', () => UP, 2, (i, k) => [k, along[i] / 2]);
      loft(B, idx.map((i) => [at(i, -0.95, -0.2), at(i, -0.95, S.FLOOR)]), 'gs-boards', () => [-outs[0][0], 0, -outs[0][2]], 2, (i, k) => [k * 0.1, along[i] / 2]);
      loft(B, idx.map((i) => [at(i, -0.1, -0.2), at(i, 0, top)]), 'gs-boards', () => outs[0], 2, (i, k) => [k * 0.1, along[i] / 2]);
    }
  }
}

// The station's plan, for the landmarks' outline (the city's own roofs over it are left out).
export function stationOutline(): V2[] {
  return [...WEST_WALL.map(([x, z]) => toWorld([x - 1, z])), ...[...EAST_WALL].reverse().map(([x, z]) => toWorld([x + 1, z]))];
}
