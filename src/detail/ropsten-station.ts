import * as THREE from 'three';
import * as T from '../textures';
import type { Builder, V2, V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';
import { ROPSTEN, SNAKE_WALL, ropstenWorld } from './viaducts.ts';

// Ropsten's metro station (1967): the red line's end, high over the bus square. Not an island
// platform but two concrete viaducts side by side, each with one track on its outer side and a
// platform on its inner side, and an open gap between them down to the bus square:
//
// - the viaducts: board-marked concrete on one row of round columns each, their decks' soffits
//   sloping up to a fascia along the gap; a rust-red railing along their outer edges;
// - the platforms: grey asphalt with a light edge and a tactile strip; along the gap a white
//   railing on the north-west platform, glass windscreens with frosted panels low down on the
//   south-east one;
// - the roofs: one over each platform, light grey trapezoidal sheet under dark grey, on dark
//   blue-grey steel: a column with a V-head every 7.6 m near the gap, beams across; a tube light
//   along each; name boards hung over the platforms facing the track, clocks and departure boards;
// - at the south-west end, where the tracks come out of the hill, the two platforms are joined in
//   a covered concourse under a dark roof, closed at its end by Roland Kempe's red wall with his
//   snake (1971); from the concourse's other end escalators and stairs go down in the gap, in a
//   house of light grey sheet, to the ticket hall on the ground beneath;
// - halfway along a crossbridge with a glass lift down to the ticket hall; at the north-east end,
//   beyond the tracks' ends, a landing across both platforms in front of a glazed hall with
//   "↓ Lidingöbanan ↓" over its doors, from which escalators and stairs go down to the trams.
//
// Sizes from Lantmäteriet's laser scan (Laserdata Nedladdning, skog, March 2021, CC BY 4.0) and
// Google's 3D mesh, read relative to the game's tracks; the ways through it from OpenStreetMap's
// indoor mapping (© OpenStreetMap contributors, ODbL); the looks from photographs on Wikimedia
// Commons (2006–2026). The network draws the tracks, the platforms' slabs and the decks under the
// tracks (src/network.ts), and leaves its own piers and railings here to this
// (src/detail/viaducts.ts); the station's floors, stairs, lift and ticket hall are its layout's
// (data/station-descriptions.json, src/stations.ts).
//
// Drawn in the station's frame: s along the platforms towards the north-east, u to the south-east.

type Ground = (x: number, z: number) => number | null;

// (the roofs' undersides are lit from below, by the platforms and the lamps, which light nothing
// here: so they glow a little, as the network's ceilings do)
addMaterial('rs-sheet', () => { const m = T.corrugated(); return standard(m, 0.6, 0.2, { emissive: new THREE.Color(0x8a8d8f), emissiveMap: m }); });
addMaterial('rs-sheet-dark', () => { const m = T.corrugated(); return standard(m, 0.6, 0.2, { emissive: new THREE.Color(0x303336), emissiveMap: m }); });
addMaterial('rs-clad', () => standard(T.corrugated(true), 0.55, 0.25));
addMaterial('rs-snake', () => standard(T.kempeSnake(), 0.85));
addMaterial('rs-board-se', () => standard(T.ropstenBoard(false), 0.5));
addMaterial('rs-board-nw', () => standard(T.ropstenBoard(true), 0.5));
addMaterial('rs-fascia', () => standard(T.lidingobananFascia(), 0.5));
addMaterial('rs-lightbox', () => { const m = T.lidingotagenBox(); return standard(m, 0.5, 0, { emissive: new THREE.Color(0xffffff), emissiveMap: m, emissiveIntensity: 0.35 }); });
addMaterial('rs-departures', () => { const m = T.departureBoard(); return standard(m, 0.5, 0, { emissive: new THREE.Color(0xffffff), emissiveMap: m, emissiveIntensity: 0.9 }); });
addMaterial('rs-frosted', () => standard(null, 0.7, 0, { transparent: true, opacity: 0.82, side: THREE.DoubleSide }));
addMaterial('rs-letters', () => standard(T.letters('STATION ROPSTEN', '#ded4b8'), 0.5, 0.3, { alphaTest: 0.4 }));
addMaterial('rs-bars', () => standard(T.railingBars(), 0.6, 0.3, { alphaTest: 0.5, side: THREE.DoubleSide }));
addMaterial('rs-glass', () => standard(null, 0.08, 0.1, { transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
addMaterial('rs-light', () => standard(null, 0.6, 0, { emissive: new THREE.Color(0xfff6e2), emissiveIntensity: 0.6 }));
addMaterial('rs-asphalt', () => standard(T.asphalt(), 0.92));
// (the decks' undersides, lit from below by the square: so they glow a little, as the roofs do)
addMaterial('rs-soffit', () => { const m = T.concrete(17, 228); return standard(m, 0.9, 0, { emissive: new THREE.Color(0x4a4844), emissiveMap: m }); });
addMaterial('rs-band-letters', () => standard(T.letters('ROPSTEN', '#ffffff'), 0.5, 0, { alphaTest: 0.4 }));

// colours
const CONCRETE = 0xa7a49d, COLUMN = 0x9f9c95, FASCIA_CONCRETE = 0xb3b0a8, ASPHALT = 0x75777a, EDGE = 0xd4d1c9, TACTILE = 0x8f9193;
const KERB = 0xc4c1b9, SHEET = 0xd8dadb, SHEET_DARK = 0x5a5d61, ROOF_TOP = 0x585c60, ROOF_EDGE = 0x3c4045, STEEL = 0x3a4350;
const WHITE_RAIL = 0xeef0ee, RUST_RAIL = 0x6b4535, POST = 0x5b6672, FROSTED = 0xc4bf9f, GLASS = 0xd6e2e4, BED = 0x857c72;
const CLAD_LIGHT = 0xd7d9da, CLAD_GREY = 0x979b9f, CLAD_DARK = 0x6c7175, RED_WALL = 0xa3383a, TUBE = 0xfff4dc, NAVY = 0x1f3470;

const R = ROPSTEN.rail, PY = ROPSTEN.platform, FLOOR = R - 0.6;
const ROOF = { top: 16.5, sheet: 16.32, beam: 15.97, spine: 15.87, head: 15.22 };
const TAN30 = Math.tan(Math.PI / 6);

// a point in the frame, and a direction, as the builder's model coordinates (placed in the frame)
const L = (s: number, u: number, y: number): V3 => [u, y, -s];
const N = (ns: number, nu: number, ny = 0): V3 => [nu, ny, -ns];
const UP: V3 = [0, 1, 0], DOWN: V3 = [0, -1, 0];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ------------------------------------------------------------------ the tracks
// The two tracks as public/data/track-geometry.json has them (pieces 1111 and 0), their points
// about 10 m apart, which the network makes into a smooth line (Catmull–Rom, as src/network.ts
// densify does). Beyond their ends (the buffer stops) they run straight on, as the decks do.
const NW_POINTS: V2[] = [[2397.11, -2817.44], [2402.21, -2826.13], [2407.57, -2834.61], [2413.18, -2842.9], [2419.03, -2851], [2425.05, -2858.96],
  [2431.2, -2866.82], [2437.42, -2874.63], [2443.67, -2882.41], [2449.92, -2890.19], [2456.18, -2897.97], [2462.43, -2905.76], [2468.67, -2913.54]];
const SE_POINTS: V2[] = [[2411.17, -2806.65], [2418.07, -2813.85], [2424.73, -2821.24], [2431.14, -2828.84], [2437.3, -2836.62], [2443.33, -2844.53],
  [2449.27, -2852.5], [2455.17, -2860.5], [2461.04, -2868.52], [2466.89, -2876.56], [2472.69, -2884.64], [2478.45, -2892.74], [2484.18, -2900.86],
  [2489.9, -2908.98]];

const toFrame = ([x, z]: V2): V2 => {
  const dx = x - ROPSTEN.x, dz = z - ROPSTEN.z;
  return [ROPSTEN.tx * dx + ROPSTEN.tz * dz, -ROPSTEN.tz * dx + ROPSTEN.tx * dz];
};

class Track {
  private s: number[] = [];
  private u: number[] = [];
  readonly from: number;
  readonly end: number;
  // `side`: which way the gap is from it, in u
  constructor(world: V2[], readonly side: 1 | -1) {
    const p = world.map(toFrame), n = p.length;
    const P = (i: number, k: 0 | 1) => (i < 0 ? 2 * p[0][k] - p[1][k] : i >= n ? 2 * p[n - 1][k] - p[n - 2][k] : p[i][k]);
    const cr = (q: number, k: 0 | 1) => {
      const i = Math.min(n - 2, Math.floor(q)), t = q - i;
      const p0 = P(i - 1, k), p1 = P(i, k), p2 = P(i + 1, k), p3 = P(i + 2, k);
      return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    };
    for (let q = 0; q <= n - 1 + 1e-9; q += 0.05) { this.s.push(cr(q, 0)); this.u.push(cr(q, 1)); }
    this.from = this.s[0];
    this.end = this.s[this.s.length - 1];
  }
  // the track's middle at s (u), and its direction (ts, tu)
  private mid(s: number) {
    const S = this.s, U = this.u, m = S.length - 1;
    const line = (a: number, b: number) => {
      const ds = S[b] - S[a], du = U[b] - U[a], l = Math.hypot(ds, du);
      return { u: U[a] + ((s - S[a]) * du) / ds, ts: ds / l, tu: du / l };
    };
    if (s <= S[0]) return line(0, 4);
    if (s >= S[m]) return line(m - 4, m);
    let lo = 0, hi = m;
    while (hi - lo > 1) { const k = (lo + hi) >> 1; if (S[k] <= s) lo = k; else hi = k; }
    return line(lo, hi);
  }
  // the frame's [s, u] of the point v metres from the track's middle towards the gap, square to it
  p(s: number, v: number): V2 {
    const { u, ts, tu } = this.mid(s), ns = -tu * this.side, nu = ts * this.side;
    return [s + ns * v, u + nu * v];
  }
  // the direction towards the gap
  n(s: number): V2 { const { ts, tu } = this.mid(s); return [-tu * this.side, ts * this.side]; }
  at(s: number, v: number, y: number): V3 { const [a, b] = this.p(s, v); return L(a, b, y); }
  // a normal facing towards the gap (`k` 1) or away (-1), tilted up by `up`
  out(s: number, k: number, up = 0): V3 { const [a, b] = this.n(s); return N(a * k, b * k, up); }
}
const NW = new Track(NW_POINTS, 1), SE = new Track(SE_POINTS, -1);
const TRACKS = [NW, SE];

// ------------------------------------------------------------------ the plan
// Where the decks begin (at the hill, where the tracks go into their tunnels) and end
const DECK_FROM = new Map([[NW, -61.5], [SE, -61.8]]), DECK_TO = 86;
// the platform's edge, its inner edge along the gap (the network's platforms are 5.8 m wide,
// data/track-corrections.json), the deck's outer edge and its soffit's lowest part
const V = { edge: 1.57, inner: 7.37, fascia: 7.42, outer: -3.0, upstand: -2.75, column: 2.2 };
// the joined floors across the gap: the concourse, the head of the stairs down, the crossbridge
// and the landing at the north-east end (as data/station-descriptions.json lays them out)
const CONCOURSE = { s0: SNAKE_WALL.s1, s1: -1 };
const STAIR_HEAD = { s0: -1, s1: 1, u0: -2.4, u1: 2.8 };
const BRIDGE = { s0: 29.5, s1: 34.5 };
const LANDING = { s0: 80, s1: 88, u0: -4, u1: 6 };
// the stair house over the escalators and stairs down to the ticket hall: from the head of the
// flights to their foot, 8.5 m down at 30°, between walls either side of the flights' 5.2 m
const STAIRS = { s0: 1, s1: 1 + 8.5 / TAN30, u: 0.2, half: 2.75 };
// the ticket hall under the gap (its walls the layout's), and its roof
const HALL = { s0: STAIRS.s1 - 0.1, s1: 30.2, u0: -3.95, u1: 4.35, floor: PY - 8.5, roof: PY - 8.5 + 3.2 };
// the glass lift from the crossbridge down to the hall (the layout's shaft)
const LIFT = { u0: -0.6, u1: 1.8 };
// the glazed hall over Lidingöbanan's stop, above the trams' building (which the city draws)
const VESTIBULE = { s0: 88, s1: 96, u0: -2.7, u1: 4.0, base: 10.4, top: 15.7, door: [-1.3, 2.5] as V2 };
// where each platform runs along the gap, with a railing: between the joined floors
const ALONG_GAP: V2[] = [[CONCOURSE.s1, BRIDGE.s0], [BRIDGE.s1, LANDING.s0]];
// the roofs' columns, every 7.6 m
const COLUMNS = Array.from({ length: 18 }, (_, k) => -50.2 + 7.6 * k).filter((s) => s < 82).concat(85.5);
// the viaducts' columns, rough (Google's mesh), where the ground is low enough
const PIERS = [-26, -3, 19, 44, 71, 84];

const steps = (a: number, b: number, step: number) => {
  const n = Math.max(1, Math.ceil((b - a) / step));
  return Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);
};

// Quads between rows of points (each row across, the rows along), each facing the side of `hint`.
function loft(B: Builder, rows: V3[][], mat: string, hint: (i: number, k: number) => V3, tile: number | V2 = 4, uv?: (i: number, k: number) => V2) {
  for (let i = 0; i + 1 < rows.length; i++) {
    for (let k = 0; k + 1 < rows[i].length; k++) {
      const p = [rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]];
      const a = sub(p[1], p[0]), b = sub(p[3], p[0]), c = sub(p[2], p[1]);
      let n = cross(Math.hypot(...a) > 1e-6 ? a : c, Math.hypot(...b) > 1e-6 ? b : sub(p[2], p[3]));
      if (Math.hypot(...n) < 1e-9) continue;
      const h = hint(i, k);
      if (n[0] * h[0] + n[1] * h[1] + n[2] * h[2] < 0) n = [-n[0], -n[1], -n[2]];
      B.poly(p, n, mat, tile, uv && [uv(i, k), uv(i, k + 1), uv(i + 1, k + 1), uv(i + 1, k)]);
    }
  }
}

// A strip along a track from s0 to s1, from v0 to v1, at heights y0 (at v0) and y1 (at v1).
function strip(B: Builder, t: Track, s0: number, s1: number, v0: number, v1: number, y0: number, y1: number, mat: string, hint: (s: number) => V3, tile: number | V2 = 4) {
  const ss = steps(s0, s1, 2);
  loft(B, ss.map((s) => [t.at(s, v0, y0), t.at(s, v1, y1)]), mat, (i) => hint(ss[i]), tile);
}

// A straight box from a to b (in the frame: [s, u, y] of its top's middle), `w` wide and `h` deep.
function beam(B: Builder, a: V3, b: V3, w: number, h: number, mat: string, tile = 2) {
  const ds = b[0] - a[0], du = b[1] - a[1], l = Math.hypot(ds, du);
  if (l < 1e-6) return;
  const d: V3 = N(ds / l, du / l), n: V3 = N(-du / l, ds / l);
  B.wallBox(L(a[0], a[1], 0), d, n, 0, l, Math.min(a[2], b[2]) - h, Math.max(a[2], b[2]), -w / 2, w / 2, mat, tile);
}
// A slanting rod from a to b (frame [s, u, y]), square, `w` thick.
function rod(B: Builder, a: V3, b: V3, w: number, mat: string) {
  const A = L(a[0], a[1], a[2]), Bp = L(b[0], b[1], b[2]);
  const d = sub(Bp, A), l = Math.hypot(...d);
  if (l < 1e-6) return;
  const f: V3 = [d[0] / l, d[1] / l, d[2] / l];
  const hz = Math.hypot(f[0], f[2]);
  const side: V3 = hz > 1e-3 ? [-f[2] / hz, 0, f[0] / hz] : [1, 0, 0];
  const up = cross(side, f);
  const P = (t: number, i: number, j: number): V3 => [A[0] + d[0] * t + (side[0] * i + up[0] * j) * w / 2, A[1] + d[1] * t + (side[1] * i + up[1] * j) * w / 2, A[2] + d[2] * t + (side[2] * i + up[2] * j) * w / 2];
  for (const [i0, j0, i1, j1, n] of [[-1, -1, 1, -1, [-up[0], -up[1], -up[2]]], [1, -1, 1, 1, side], [1, 1, -1, 1, up], [-1, 1, -1, -1, [-side[0], -side[1], -side[2]]]] as [number, number, number, number, V3][]) {
    B.poly([P(0, i0, j0), P(0, i1, j1), P(1, i1, j1), P(1, i0, j0)], n, mat, 2);
  }
}
// A box in the frame from (s0, u0, y0) to (s1, u1, y1).
function block(B: Builder, s0: number, s1: number, u0: number, u1: number, y0: number, y1: number, mat: string, tile = 2, skip: string[] = []) {
  B.box(L(s1, u0, y0), L(s0, u1, y1), mat, tile, skip.map((k) => ({ '+s': '-z', '-s': '+z', '+u': '+x', '-u': '-x', '+y': '+y', '-y': '-y' } as Record<string, string>)[k]));
}
// A vertical face in the frame from (sa, ua) to (sb, ub), y0 to y1, facing `n` (frame [ns, nu]).
function wall(B: Builder, sa: number, ua: number, sb: number, ub: number, y0: number, y1: number, n: V2, mat: string, tile: number | V2 = 2, uvs?: V2[]) {
  B.poly([L(sa, ua, y0), L(sb, ub, y0), L(sb, ub, y1), L(sa, ua, y1)], N(n[0], n[1]), mat, tile, uvs);
}

// A railing of upright bars from a to b (frame [s, u] at floor height y), `h` high, with a
// handrail and posts every 2 m.
function railing(B: Builder, pts: V2[], y: number | ((i: number) => number), h: number, colour: number) {
  const Y = typeof y === 'number' ? () => y : y;
  B.tint(colour);
  let run = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [sa, ua] = pts[i], [sb, ub] = pts[i + 1], l = Math.hypot(sb - sa, ub - ua);
    if (l < 1e-6) continue;
    const n: V2 = [-(ub - ua) / l, (sb - sa) / l];
    const ya = Y(i), yb = Y(i + 1);
    B.poly([L(sa, ua, ya), L(sb, ub, yb), L(sb, ub, yb + h), L(sa, ua, ya + h)], N(n[0], n[1]), 'rs-bars', 1, [[run, 0], [run + l, 0], [run + l, 1], [run, 1]]);
    beam(B, [sa, ua, ya + h + 0.03], [sb, ub, yb + h + 0.03], 0.07, 0.06, 'metal', 1);
    const posts = Math.max(1, Math.round(l / 2));
    for (let k = 0; k <= posts; k++) {
      const t = k / posts, s = sa + (sb - sa) * t, u = ua + (ub - ua) * t, yy = ya + (yb - ya) * t;
      block(B, s - 0.03, s + 0.03, u - 0.03, u + 0.03, yy, yy + h, 'metal', 1);
    }
    run += l;
  }
}

// ------------------------------------------------------------------ the viaducts
// The deck's cross-section, (v, up from the rails), round from the upstand's inside: the upstand
// along the outer edge, the outer fascia, the soffit sloping down to the column line and up again
// to the fascia along the gap, which rises to the platform's top.
const DECK: [number, number][] = [[V.upstand, -0.6], [V.upstand, 0.15], [V.outer, 0.15], [V.outer, -1.7], [1.2, -2.0], [3.2, -2.0], [V.fascia, -1.1], [V.fascia, 1.0]];
// which way each of its faces looks: (towards the gap, up)
const DECK_FACES: V2[] = [[1, 0], [0, 1], [-1, 0], [-0.07, -1], [0, -1], [0.2, -1], [1, 0]];

function buildDecks(B: Builder, ground: Ground) {
  const gw = (s: number, u: number) => ground(...ropstenWorld(s, u));
  for (const t of TRACKS) {
    const ss = steps(DECK_FROM.get(t)!, DECK_TO, 2);
    B.tint(CONCRETE);
    for (let k = 0; k + 1 < DECK.length; k++) {
      if (k === 6) B.tint(FASCIA_CONCRETE);
      const mat = DECK_FACES[k][1] < 0 ? 'rs-soffit' : 'concrete';
      loft(B, ss.map((s) => [t.at(s, DECK[k][0], R + DECK[k][1]), t.at(s, DECK[k + 1][0], R + DECK[k + 1][1])]), mat, (i) => t.out(ss[i], DECK_FACES[k][0], DECK_FACES[k][1]), 3);
    }
    // beyond the track's end: the bed, and the platform's face over it
    const bed = steps(t.end, DECK_TO, 2);
    B.tint(BED);
    loft(B, bed.map((s) => [t.at(s, V.upstand, FLOOR), t.at(s, V.edge, FLOOR)]), 'stone', () => UP, 3);
    B.tint(FASCIA_CONCRETE);
    loft(B, bed.map((s) => [t.at(s, V.edge, FLOOR), t.at(s, V.edge, PY)]), 'concrete', (i) => t.out(bed[i], -1), 2);
    // the deck's end: its section closed, with the platform's block over the bed
    const end: [number, number][] = [[V.outer, 0.15], [V.outer, -1.7], [1.2, -2.0], [3.2, -2.0], [V.fascia, -1.1], [V.fascia, 1.0], [V.edge, 1.0], [V.edge, -0.6], [V.upstand, -0.6], [V.upstand, 0.15]];
    const tri = THREE.ShapeUtils.triangulateShape(end.map(([v, y]) => new THREE.Vector2(v, y)), []);
    B.tint(CONCRETE);
    B.tris(end.map(([v, y]) => t.at(DECK_TO, v, R + y)), tri, N(1, 0), 'concrete', 3);
    // the round columns under it, on the ground
    B.tint(COLUMN);
    for (const s of PIERS) {
      const [cs, cu] = t.p(s, V.column), g = gw(cs, cu);
      if (g === null || g > R - 2.6) continue;
      B.lathe(cu, -cs, [[0.7, g - 0.5], [0.7, R - 1.95]], 'concrete', 20, 2);
    }
    // the rust-red railing along the outer edge, on the upstand
    const rs = steps(DECK_FROM.get(t)! + 0.5, DECK_TO, 4);
    railing(B, rs.map((s) => t.p(s, V.outer + 0.12)), R + 0.15, 1.1, RUST_RAIL);
  }
  // the slabs under the floors joined across the gap, flush with the fascias' foot
  const under = R - 1.1;
  B.tint(CONCRETE);
  for (const [s0, s1] of [[CONCOURSE.s0, CONCOURSE.s1], [BRIDGE.s0, BRIDGE.s1], [LANDING.s0, DECK_TO]]) {
    const ss = steps(s0, s1, 2);
    loft(B, ss.map((s) => [NW.at(s, V.fascia, under), SE.at(s, V.fascia, under)]), 'rs-soffit', () => DOWN, 3);
    for (const s of [s0, s1]) {
      if (s === CONCOURSE.s0) continue;
      const a = NW.p(s, V.fascia), b = SE.p(s, V.fascia), k = s === s0 ? -1 : 1;
      B.tint(FASCIA_CONCRETE);
      wall(B, a[0], a[1], b[0], b[1], under, PY, [k, 0], 'concrete', 2);
      B.tint(CONCRETE);
    }
  }
  // the landing's part beyond the decks' ends, and the head of the stairs
  for (const [s0, s1, u0, u1] of [[DECK_TO, LANDING.s1, LANDING.u0, LANDING.u1], [STAIR_HEAD.s0, STAIR_HEAD.s1, STAIR_HEAD.u0, STAIR_HEAD.u1]]) {
    B.tint(CONCRETE);
    block(B, s0, s1, u0, u1, under, PY, 'concrete', 2, ['+y', ...(s0 === STAIR_HEAD.s0 ? ['-s', '+s'] : ['-s'])]);
  }
}

// ------------------------------------------------------------------ the platforms' tops
function buildFloors(B: Builder) {
  const y = PY + 0.02;
  for (const t of TRACKS) {
    const s0 = DECK_FROM.get(t)! + 0.25;
    B.tint(EDGE);
    strip(B, t, s0, DECK_TO, V.edge, V.edge + 0.35, y, y, 'concrete', () => UP, 1);
    B.tint(TACTILE);
    strip(B, t, s0, DECK_TO, V.edge + 0.38, V.edge + 0.88, y + 0.004, y + 0.004, 'stone', () => UP, 0.5);
    B.tint(ASPHALT);
    strip(B, t, s0, DECK_TO, V.edge + 0.35, V.fascia, y, y, 'rs-asphalt', () => UP, 4);
    // the kerb along the gap, where the railing stands
    for (const [a, b] of ALONG_GAP) {
      B.tint(KERB);
      strip(B, t, a, b, V.inner - 0.3, V.fascia, PY + 0.1, PY + 0.1, 'concrete', () => UP, 1);
      strip(B, t, a, b, V.inner - 0.3, V.inner - 0.3, y, PY + 0.1, 'concrete', (s) => t.out(s, -1), 1);
    }
  }
  // across the gap: the concourse, the crossbridge, the landing and the head of the stairs
  B.tint(ASPHALT);
  for (const [s0, s1] of [[CONCOURSE.s0, CONCOURSE.s1], [BRIDGE.s0, BRIDGE.s1], [LANDING.s0, DECK_TO]]) {
    const ss = steps(s0, s1, 2);
    loft(B, ss.map((s) => [NW.at(s, V.fascia, y), SE.at(s, V.fascia, y)]), 'rs-asphalt', () => UP, 4);
  }
  B.poly([L(DECK_TO, LANDING.u0, y), L(LANDING.s1, LANDING.u0, y), L(LANDING.s1, LANDING.u1, y), L(DECK_TO, LANDING.u1, y)], UP, 'rs-asphalt', 4);
  B.poly([L(STAIR_HEAD.s0, STAIR_HEAD.u0, y), L(STAIR_HEAD.s1, STAIR_HEAD.u0, y), L(STAIR_HEAD.s1, STAIR_HEAD.u1, y), L(STAIR_HEAD.s0, STAIR_HEAD.u1, y)], UP, 'rs-asphalt', 4);
}

// ------------------------------------------------------------------ along the gap
// The north-west platform has a white railing along the gap; the south-east one glass
// windscreens 2.4 m high on blue-grey posts every 1.25 m, frosted low down, with the same white
// railing in front of them.
function buildGapEdges(B: Builder) {
  const v = V.inner - 0.12;
  for (const t of TRACKS) {
    for (const [a, b] of ALONG_GAP) {
      const ss = steps(a, b, 1.25);
      if (t === NW) {
        railing(B, ss.map((s) => t.p(s, v)), PY + 0.1, 1.1, WHITE_RAIL);
        continue;
      }
      // the windscreen's posts, rails, frosted panels and glass
      B.tint(POST);
      for (const s of ss) {
        const [ps, pu] = t.p(s, v + 0.05);
        block(B, ps - 0.04, ps + 0.04, pu - 0.04, pu + 0.04, PY + 0.1, PY + 2.45, 'rp-steel', 1);
      }
      for (const h of [0.18, 1.15, 2.42]) {
        for (let i = 0; i + 1 < ss.length; i++) beam(B, [...t.p(ss[i], v + 0.05), PY + h] as V3, [...t.p(ss[i + 1], v + 0.05), PY + h] as V3, 0.05, 0.05, 'rp-steel', 1);
      }
      B.tint(FROSTED);
      loft(B, ss.map((s) => [t.at(s, v + 0.05, PY + 0.18), t.at(s, v + 0.05, PY + 1.12)]), 'rs-frosted', (i) => t.out(ss[i], -1), 2);
      B.tint(GLASS);
      loft(B, ss.map((s) => [t.at(s, v + 0.05, PY + 1.15), t.at(s, v + 0.05, PY + 2.4)]), 'rs-glass', (i) => t.out(ss[i], -1), 2);
      railing(B, steps(a, b, 2).map((s) => t.p(s, v - 0.15)), PY + 0.1, 1.1, WHITE_RAIL);
    }
  }
  // round the floors across the gap: the concourse's end at the stairs, the stairs' head, the
  // crossbridge (but for the lift's door) and the landing's edges
  const at = (t: Track, s: number) => t.p(s, V.inner - 0.05);
  const c = CONCOURSE.s1 + 0.05;
  railing(B, [at(NW, c), [c, STAIR_HEAD.u0]], PY, 1.1, WHITE_RAIL);
  railing(B, [[c, STAIR_HEAD.u1], at(SE, c)], PY, 1.1, WHITE_RAIL);
  for (const u of [STAIR_HEAD.u0 + 0.05, STAIR_HEAD.u1 - 0.05]) railing(B, [[c, u], [STAIR_HEAD.s1, u]], PY, 1.1, WHITE_RAIL);
  const b0 = BRIDGE.s0 + 0.05, b1 = BRIDGE.s1 - 0.05;
  railing(B, [at(NW, b0), [b0, LIFT.u0]], PY, 1.1, WHITE_RAIL);
  railing(B, [[b0, LIFT.u1], at(SE, b0)], PY, 1.1, WHITE_RAIL);
  railing(B, [at(NW, b1), at(SE, b1)], PY, 1.1, WHITE_RAIL);
  const l0 = LANDING.s0 + 0.05, l1 = LANDING.s1 - 0.05;
  railing(B, [at(NW, l0), at(SE, l0)], PY, 1.1, WHITE_RAIL);
  railing(B, [NW.p(DECK_TO - 0.05, V.edge + 0.1), [DECK_TO - 0.05, LANDING.u0 + 0.05], [l1, LANDING.u0 + 0.05], [l1, VESTIBULE.u0]], PY, 1.1, WHITE_RAIL);
  railing(B, [SE.p(DECK_TO - 0.05, V.edge + 0.1), [DECK_TO - 0.05, LANDING.u1 - 0.05], [l1, LANDING.u1 - 0.05], [l1, VESTIBULE.u1]], PY, 1.1, WHITE_RAIL);
}

// ------------------------------------------------------------------ the roofs
// Over each platform from over its track to a little over the gap; joined across the gap over the
// concourse (dark underneath), over the crossbridge and over the landing.
function buildRoofs(B: Builder) {
  const OUT = 1.2, IN = 8.1;
  const sheet = (rows: V3[][], dark: boolean) => {
    B.tint(dark ? SHEET_DARK : SHEET);
    loft(B, rows.map((r) => r.map((p): V3 => [p[0], ROOF.sheet, p[2]])), dark ? 'rs-sheet-dark' : 'rs-sheet', () => DOWN, 1);
    B.tint(ROOF_TOP);
    loft(B, rows.map((r) => r.map((p): V3 => [p[0], ROOF.top, p[2]])), 'roof', () => UP, 4);
  };
  // the joined parts: from one roof's edge to the other's
  const joined: [number, number, boolean][] = [[CONCOURSE.s0 - 1, CONCOURSE.s1, true], [26, 35, false], [LANDING.s0, LANDING.s1, false]];
  for (const [s0, s1, dark] of joined) {
    const ss = steps(s0, s1, 2);
    sheet(ss.map((s) => dark ? [NW.at(s, OUT, 0), SE.at(s, OUT, 0)] : [NW.at(s, IN, 0), SE.at(s, IN, 0)]), dark);
  }
  // each platform's own, beyond the concourse
  for (const t of TRACKS) {
    const ss = steps(CONCOURSE.s1, LANDING.s1, 2);
    sheet(ss.map((s) => [t.at(s, OUT, 0), t.at(s, IN, 0)]), false);
  }
  // the edges' faces
  B.tint(ROOF_EDGE);
  const edgeFace = (pts: V2[], k: number) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [sa, ua] = pts[i], [sb, ub] = pts[i + 1], l = Math.hypot(sb - sa, ub - ua) || 1;
      const n: V2 = [(-(ub - ua) / l) * k, ((sb - sa) / l) * k];
      wall(B, sa, ua, sb, ub, ROOF.sheet - 0.12, ROOF.top + 0.04, n, 'metal', 2);
    }
  };
  for (const t of TRACKS) {
    const ss = steps(CONCOURSE.s0 - 1, LANDING.s1, 4);
    // the outer edge, over the track (facing away from the gap)
    const outer = ss.map((s) => t.p(s, OUT));
    edgeFace(outer, t === NW ? 1 : -1);
    // the inner edge, where the roof is not joined to the other
    for (const [a, b] of [[CONCOURSE.s1, 26], [35, LANDING.s0]]) edgeFace(steps(a, b, 3).map((s) => t.p(s, IN)), t === NW ? -1 : 1);
  }
  // the ends
  for (const [s, k] of [[CONCOURSE.s0 - 1, -1], [LANDING.s1, 1]]) {
    const pts: V2[] = [NW.p(s, OUT), SE.p(s, OUT)];
    edgeFace(pts, -k);
  }
  for (const s of [26, 35]) edgeFace([NW.p(s, IN), SE.p(s, IN)], s === 26 ? 1 : -1);
  edgeFace([NW.p(CONCOURSE.s1, IN), SE.p(CONCOURSE.s1, IN)], -1);
  edgeFace([NW.p(LANDING.s0, IN), SE.p(LANDING.s0, IN)], 1);

  // the steel: a beam along the columns' line and one along the outer edge, a beam across at
  // each column, the columns with their V-heads, and a tube light along each platform
  const COL = 6.1;
  B.tint(STEEL);
  for (const t of TRACKS) {
    const ss = steps(CONCOURSE.s0 - 1, LANDING.s1, 4);
    for (let i = 0; i + 1 < ss.length; i++) {
      beam(B, [...t.p(ss[i], COL), ROOF.sheet] as V3, [...t.p(ss[i + 1], COL), ROOF.sheet] as V3, 0.24, ROOF.sheet - ROOF.spine, 'rp-steel', 2);
      beam(B, [...t.p(ss[i], OUT + 0.15), ROOF.sheet] as V3, [...t.p(ss[i + 1], OUT + 0.15), ROOF.sheet] as V3, 0.14, 0.25, 'rp-steel', 2);
    }
    for (const s of COLUMNS) {
      const inConcourse = s < CONCOURSE.s1;
      // the beam across: over the concourse, from one roof's outer edge to the other's
      if (!inConcourse || t === NW) {
        const a = t.p(s, OUT + 0.1), b = inConcourse ? SE.p(s, OUT + 0.1) : t.p(s, IN - 0.1);
        beam(B, [...a, ROOF.sheet] as V3, [...b, ROOF.sheet] as V3, 0.2, inConcourse ? 0.5 : ROOF.sheet - ROOF.beam, 'rp-steel', 2);
      }
      const [cs, cu] = t.p(s, COL);
      block(B, cs - 0.12, cs + 0.12, cu - 0.12, cu + 0.12, PY, ROOF.head, 'rp-steel', 1);
      for (const d of [-1, 1]) rod(B, [cs, cu, ROOF.head - 0.05], [cs + d * 0.9, cu, ROOF.spine + 0.02], 0.14, 'rp-steel');
    }
    // the tube light, hung under the beams
    B.tint(TUBE);
    const ts = steps(CONCOURSE.s0, LANDING.s1 - 0.5, 4);
    for (let i = 0; i + 1 < ts.length; i++) beam(B, [...t.p(ts[i], 3.0), ROOF.beam - 0.12] as V3, [...t.p(ts[i + 1], 3.0), ROOF.beam - 0.12] as V3, 0.16, 0.1, 'rs-light', 1);
    B.tint(STEEL);
  }
  // over the concourse, rows of tubes across the joined floor too
  B.tint(TUBE);
  for (const f of [0.35, 0.65]) {
    const ss = steps(CONCOURSE.s0, CONCOURSE.s1, 4);
    const at = (s: number): V2 => { const a = NW.p(s, V.inner), b = SE.p(s, V.inner); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
    for (let i = 0; i + 1 < ss.length; i++) beam(B, [...at(ss[i]), ROOF.sheet - 0.62] as V3, [...at(ss[i + 1]), ROOF.sheet - 0.62] as V3, 0.16, 0.1, 'rs-light', 1);
  }
}

// ------------------------------------------------------------------ bins and benches
// Round stainless bins on posts beside every other column, on the platform's side; benches of
// wooden slats on steel along the concourse's sides.
function buildFurniture(B: Builder) {
  for (const t of TRACKS) {
    COLUMNS.forEach((s, i) => {
      if (i % 2 || s < CONCOURSE.s1) return;
      const [bs, bu] = t.p(s + 0.45, 6.1 - 0.05);
      B.tint(0xc9ccce);
      B.lathe(bu, -bs, [[0, PY + 0.3], [0.18, PY + 0.3], [0.18, PY + 0.95], [0.16, PY + 0.97], [0.16, PY + 1.0], [0, PY + 1.0]], 'metal', 16, 1);
      B.tint(0x3a3d40);
      block(B, bs - 0.025, bs + 0.025, bu - 0.025, bu + 0.025, PY, PY + 0.3, 'metal', 1);
    });
  }
  for (const [s, t] of [[-44, NW], [-30, SE], [-16, NW]] as [number, Track][]) {
    const [cs, cu] = t.p(s, V.inner - 0.9), k = -t.side;
    B.tint(0x8a5a36);
    for (let j = 0; j < 4; j++) block(B, cs - 0.9, cs + 0.9, cu + k * (0.05 + j * 0.11) - 0.04, cu + k * (0.05 + j * 0.11) + 0.04, PY + 0.43, PY + 0.47, 'concrete', 1);
    for (let j = 0; j < 3; j++) block(B, cs - 0.9, cs + 0.9, cu - k * 0.02 - 0.015, cu - k * 0.02 + 0.015, PY + 0.55 + j * 0.13, PY + 0.65 + j * 0.13, 'concrete', 1);
    B.tint(0x2e3134);
    for (const e of [-0.75, 0.75]) {
      block(B, cs + e - 0.03, cs + e + 0.03, cu - 0.04, cu + 0.04, PY, PY + 0.95, 'rp-steel', 1);
      block(B, cs + e - 0.03, cs + e + 0.03, cu + k * 0.38 - 0.03, cu + k * 0.38 + 0.03, PY, PY + 0.43, 'rp-steel', 1);
      block(B, cs + e - 0.03, cs + e + 0.03, Math.min(cu, cu + k * 0.38), Math.max(cu, cu + k * 0.38), PY + 0.38, PY + 0.43, 'rp-steel', 1);
    }
  }
}

// ------------------------------------------------------------------ signs, clocks and boards
function buildSigns(B: Builder) {
  for (const t of TRACKS) {
    // the name boards, hung between the columns and the gap, along the track
    for (const s of [-30, 8, 41, 66]) {
      const [as, au] = t.p(s - 1.9, 6.75), [bs, bu] = t.p(s + 1.9, 6.75), n = t.n(s);
      const y0 = PY + 2.35, y1 = PY + 3.42;
      // lettered on both faces, each for those looking at it: a face towards the south-east read
      // from the north-west, the north-east end on the right, and the other the other way round
      const off = (k: number) => (p: V3): V3 => [p[0] + n[1] * 0.04 * k, p[1], p[2] - n[0] * 0.04 * k];
      const face = [L(as, au, y0), L(bs, bu, y0), L(bs, bu, y1), L(as, au, y1)];
      B.tint(0xffffff);
      for (const k of [-1, 1]) {
        const southEast = k * n[1] > 0;
        B.poly(face.map(off(k)), N(n[0] * k, n[1] * k), southEast ? 'rs-board-se' : 'rs-board-nw', 1,
          southEast ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[1, 0], [0, 0], [0, 1], [1, 1]]);
      }
      B.tint(0x4a5160);
      for (const [p, q, d] of [[face[0], face[1], DOWN], [face[3], face[2], UP]] as [V3, V3, V3][]) B.poly([off(-1)(p), off(-1)(q), off(1)(q), off(1)(p)], d, 'metal', 2);
      for (const e of [s - 1.6, s + 1.6]) {
        const [es, eu] = t.p(e, 6.75);
        block(B, es - 0.02, es + 0.02, eu - 0.02, eu + 0.02, y1, ROOF.beam, 'metal', 1);
      }
    }
    // a clock over the gap's edge, its faces along the platform
    clock(B, t.p(50, 6.9), PY + 2.95);
    // the departure boards, near the crossbridge and at the concourse
    for (const s of [24, -20]) departures(B, t.p(s, 4.2), PY + 2.55);
  }
  // the light box over the landing, facing the platforms
  B.tint(0xffffff);
  const lb = { s: 84.5, u0: 2.2, u1: 5.4, y0: ROOF.beam - 0.65, y1: ROOF.beam - 0.15 };
  block(B, lb.s - 0.1, lb.s + 0.1, lb.u0, lb.u1, lb.y0, lb.y1, 'rp-steel', 1);
  B.poly([L(lb.s - 0.11, lb.u0, lb.y0), L(lb.s - 0.11, lb.u1, lb.y0), L(lb.s - 0.11, lb.u1, lb.y1), L(lb.s - 0.11, lb.u0, lb.y1)], N(-1, 0), 'rs-lightbox', 1,
    [[0, 0], [1, 0], [1, 1], [0, 1]]);
}

// A clock hung from the roof: two white faces in a dark rim, along s.
function clock(B: Builder, [s, u]: V2, y: number) {
  const r = 0.36;
  B.tint(0x2c2e31);
  block(B, s - 0.02, s + 0.02, u - 0.02, u + 0.02, y + r, ROOF.beam, 'metal', 1);
  const ring = (rad: number, d: number): V3[] => Array.from({ length: 20 }, (_, k) => {
    const a = (k / 20) * Math.PI * 2;
    return L(s + d, u + Math.cos(a) * rad, y + Math.sin(a) * rad);
  });
  for (const k of [-1, 1]) {
    B.tint(0x2c2e31);
    B.poly(ring(r + 0.05, k * 0.07), N(k, 0), 'rp-steel');
    B.tint(0xf4f2ea);
    B.poly(ring(r, k * 0.075), N(k, 0), 'rs-light');
    B.tint(0x1e1f21);
    for (const [ang, l] of [[Math.PI / 2 + 0.6, r * 0.8], [-0.4, r * 0.55]]) {
      const e: V2 = [u + Math.cos(ang) * l, y + Math.sin(ang) * l], w = 0.018;
      const q: V2 = [-Math.sin(ang) * w, Math.cos(ang) * w];
      B.poly([L(s + k * 0.08, u - q[0], y - q[1]), L(s + k * 0.08, e[0] - q[0], e[1] - q[1]), L(s + k * 0.08, e[0] + q[0], e[1] + q[1]), L(s + k * 0.08, u + q[0], y + q[1])], N(k, 0), 'rp-steel');
    }
  }
}

// A departure board hung from the roof: lit on both faces, along s.
function departures(B: Builder, [s, u]: V2, y: number) {
  const w = 1.6, h = 0.4;
  B.tint(0x202226);
  block(B, s - 0.06, s + 0.06, u - w / 2 - 0.04, u + w / 2 + 0.04, y - 0.04, y + h + 0.04, 'rp-steel', 1);
  for (const e of [u - 0.6, u + 0.6]) block(B, s - 0.02, s + 0.02, e - 0.02, e + 0.02, y + h, ROOF.beam, 'metal', 1);
  B.tint(0xffffff);
  for (const k of [-1, 1]) {
    const a = k < 0 ? u + w / 2 : u - w / 2, b = k < 0 ? u - w / 2 : u + w / 2;
    B.poly([L(s + k * 0.065, a, y), L(s + k * 0.065, b, y), L(s + k * 0.065, b, y + h), L(s + k * 0.065, a, y + h)], N(k, 0), 'rs-departures', 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
}

// ------------------------------------------------------------------ the snake wall
// The red wall closing the concourse between the platforms, where the tracks go into the hill,
// with Kempe's snake along it over a black skirting.
function buildSnakeWall(B: Builder) {
  const { s0, s1, u0, u1 } = SNAKE_WALL, h = 3.04;
  B.tint(0xffffff);
  wall(B, s1, u1, s1, u0, PY, PY + h, [1, 0], 'rs-snake', 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  B.tint(RED_WALL);
  wall(B, s1, u1, s1, u0, PY + h, ROOF.sheet, [1, 0], 'plaster', 3);
  wall(B, s0, u0, s1, u0, PY - 0.1, ROOF.sheet, [0, -1], 'plaster', 3);
  wall(B, s0, u1, s1, u1, PY - 0.1, ROOF.sheet, [0, 1], 'plaster', 3);
  B.tint(0x1b1b1d);
  for (const u of [u0, u1]) wall(B, s0, u, s1, u, PY - 0.1, PY + 0.19, [0, Math.sign(u)], 'plaster', 2);
}

// ------------------------------------------------------------------ the stair house and the hall
// The escalators and stairs go down in the gap in a house clad in light grey sheet, its roof
// sloping with them, into the ticket hall on the ground: a glazed pavilion in black frames under a
// black fascia with "STATION ROPSTEN" in pale letters, its doors under SL's navy band.
function buildStairHouse(B: Builder, ground: Ground) {
  const gw = (s: number, u: number) => ground(...ropstenWorld(s, u)) ?? HALL.floor;
  const roof = (s: number) => PY - (Math.min(Math.max(s, STAIRS.s0), STAIRS.s1) - STAIRS.s0) * TAN30 + 3.2 + 0.15;
  const ss = steps(STAIRS.s0, STAIRS.s1, 1);
  for (const k of [-1, 1]) {
    const u = STAIRS.u + k * STAIRS.half;
    B.tint(CLAD_LIGHT);
    loft(B, ss.map((s) => [L(s, u, Math.min(gw(s, u), HALL.floor) - 0.3), L(s, u, roof(s) + 0.3)]), 'rs-clad', () => N(0, k), 1);
  }
  B.tint(CLAD_GREY);
  loft(B, ss.map((s) => [L(s, STAIRS.u - STAIRS.half - 0.15, roof(s) + 0.3), L(s, STAIRS.u + STAIRS.half + 0.15, roof(s) + 0.3)]), 'rs-clad', () => UP, 1);
  B.tint(ROOF_EDGE);
  wall(B, STAIRS.s0, STAIRS.u - STAIRS.half - 0.15, STAIRS.s0, STAIRS.u + STAIRS.half + 0.15, PY + 3.2, roof(STAIRS.s0) + 0.3, [-1, 0], 'metal', 2);
  // the hall's roof and fascia
  const { s0, s1, u0, u1, roof: y } = HALL;
  B.tint(ROOF_TOP);
  B.poly([L(s0, u0, y + 0.42), L(s1, u0, y + 0.42), L(s1, u1, y + 0.42), L(s0, u1, y + 0.42)], UP, 'roof', 4);
  B.tint(0x1c1d1f);
  for (const [a, b, n] of [[[s0, u0], [s1, u0], [0, -1]], [[s1, u0], [s1, u1], [1, 0]], [[s1, u1], [s0, u1], [0, 1]], [[s0, u1], [s0, u0], [-1, 0]]] as [V2, V2, V2][]) {
    wall(B, a[0], a[1], b[0], b[1], y - 0.02, y + 0.42, n, 'metal', 2);
  }
  B.tint(0xffffff);
  for (const [a, b, n] of [[[s0 + 1.5, u1 + 0.02], [s1 - 1.5, u1 + 0.02], [0, 1]], [[s1 - 1.5, u0 - 0.02], [s0 + 1.5, u0 - 0.02], [0, -1]]] as [V2, V2, V2][]) {
    wall(B, a[0], a[1], b[0], b[1], y + 0.04, y + 0.38, n, 'rs-letters', 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  // its walls: glass in black frames on a low plinth, but for the doors at the north-east end and
  // round the east corner, where the ways out to the square leave (the layout's)
  const f = HALL.floor, door = 25.6;
  const side = (a: V2, b: V2, n: V2, doors: boolean) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(l / (doors ? 1.15 : 1.6)));
    const P = (t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const sq = (p: V2, w: number, y0: number, y1: number) => block(B, p[0] - w, p[0] + w, p[1] - w, p[1] + w, y0, y1, 'rp-steel', 1);
    const bar = (y0: number, y1: number) => wall(B, a[0] + n[0] * 0.05, a[1] + n[1] * 0.05, b[0] + n[0] * 0.05, b[1] + n[1] * 0.05, y0, y1, n, 'rp-steel', 1);
    B.tint(doors ? 0xb9bec2 : 0x1e2124);
    for (let i = 0; i <= k; i++) sq(P(i / k), 0.045, f, doors ? f + 2.25 : y);
    B.tint(0x1e2124);
    if (doors) {
      for (const t of [0, 1]) sq(P(t), 0.06, f, y);
      // the navy band over the doors, with a yellow edge and the station's name
      B.tint(NAVY);
      bar(f + 2.3, f + 2.75);
      B.tint(0xf2c200);
      wall(B, a[0] + n[0] * 0.06, a[1] + n[1] * 0.06, b[0] + n[0] * 0.06, b[1] + n[1] * 0.06, f + 2.3, f + 2.35, n, 'gs-paint', 1);
      B.tint(0xffffff);
      // (left to right for one facing it)
      const m = P(0.5), d: V2 = [n[1], -n[0]], w = Math.min(1.6, l / 2 - 0.2);
      wall(B, m[0] - d[0] * w + n[0] * 0.07, m[1] - d[1] * w + n[1] * 0.07, m[0] + d[0] * w + n[0] * 0.07, m[1] + d[1] * w + n[1] * 0.07, f + 2.36, f + 2.7, n, 'rs-band-letters', 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      B.tint(0x1e2124);
      bar(f + 2.75, f + 2.8);
      B.tint(GLASS);
      wall(B, a[0], a[1], b[0], b[1], f + 2.8, y - 0.02, n, 'rs-glass', 2);
      return;
    }
    B.tint(CONCRETE);
    wall(B, a[0] + n[0] * 0.03, a[1] + n[1] * 0.03, b[0] + n[0] * 0.03, b[1] + n[1] * 0.03, f - 0.3, f + 0.3, n, 'concrete', 2);
    B.tint(0x1e2124);
    bar(f + 2.4, f + 2.48);
    B.tint(GLASS);
    wall(B, a[0], a[1], b[0], b[1], f + 0.3, y - 0.02, n, 'rs-glass', 2);
  };
  side([s0, u0], [s1, u0], [0, -1], false);
  side([s0, u1], [door, u1], [0, 1], false);
  side([door, u1], [s1, u1], [0, 1], true);
  side([s1, u0], [s1, u1], [1, 0], true);
  for (const [a, b] of [[u0, STAIRS.u - STAIRS.half], [STAIRS.u + STAIRS.half, u1]]) side([s0, a], [s0, b], [-1, 0], false);
}

// ------------------------------------------------------------------ the north-east end
// Under the landing a tower clad in dark grey sheet, braced; on it the glazed hall to Lidingöbanan:
// stainless doors under the navy fascia, its sides and back in grey sheet over the trams' building.
function buildNorthEast(B: Builder, ground: Ground) {
  const gw = (s: number, u: number) => ground(...ropstenWorld(s, u)) ?? 3.5;
  const under = R - 1.1;
  const tw = { s0: 80.6, s1: 87.4, u0: -2.2, u1: 3.2 };
  const g = Math.min(gw(tw.s0, tw.u0), gw(tw.s1, tw.u1), gw(tw.s0, tw.u1), gw(tw.s1, tw.u0)) - 0.3;
  B.tint(CLAD_DARK);
  for (const [a, b, n] of [[[tw.s0, tw.u0], [tw.s1, tw.u0], [0, -1]], [[tw.s1, tw.u0], [tw.s1, tw.u1], [1, 0]], [[tw.s1, tw.u1], [tw.s0, tw.u1], [0, 1]], [[tw.s0, tw.u1], [tw.s0, tw.u0], [-1, 0]]] as [V2, V2, V2][]) {
    wall(B, a[0], a[1], b[0], b[1], g, under, n, 'rs-clad', 1);
  }
  B.tint(0x33373b);
  rod(B, [tw.s0 - 0.15, tw.u0 + 0.3, g + 0.3], [tw.s0 - 0.15, tw.u1 - 0.3, under - 0.2], 0.16, 'rp-steel');
  for (const u of [tw.u0 + 0.2, tw.u1 - 0.2]) block(B, tw.s0 - 0.3, tw.s0 - 0.05, u - 0.12, u + 0.12, g, under, 'rp-steel', 1);

  // the glazed hall
  const { s0, s1, u0, u1, base, top } = VESTIBULE;
  B.tint(CLAD_GREY);
  wall(B, s0, u0, s1, u0, base, top, [0, -1], 'rs-clad', 1);
  wall(B, s0, u1, s1, u1, base, top, [0, 1], 'rs-clad', 1);
  wall(B, s1, u0, s1, u1, base, top, [1, 0], 'rs-clad', 1);
  wall(B, s0, u0, s0, u1, base, PY, [-1, 0], 'rs-clad', 1);
  B.tint(0x4c5054);
  B.poly([L(s0, u0, top), L(s1, u0, top), L(s1, u1, top), L(s0, u1, top)], UP, 'roof', 4);
  // its front: the fascia, stainless frames, glass but at the open door to the flights
  const fy = 15.0;
  B.tint(0xffffff);
  wall(B, s0 - 0.06, u0, s0 - 0.06, u1, fy, fy + 0.57, [-1, 0], 'rs-fascia', 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  B.tint(0x2a2c30);
  wall(B, s0 - 0.05, u1, s0 - 0.05, u0, fy + 0.57, top, [-1, 0], 'metal', 2);
  B.tint(0xb9bec2);
  const xs = [u0, -2.0, VESTIBULE.door[0], VESTIBULE.door[1], 3.25, u1];
  for (const x of xs) block(B, s0 - 0.08, s0 + 0.02, x - 0.05, x + 0.05, PY, fy, 'metal', 1);
  for (const [a, b] of [[u0, VESTIBULE.door[0]], [VESTIBULE.door[1], u1]]) {
    for (const yy of [PY + 0.25, fy - 0.04]) block(B, s0 - 0.08, s0 + 0.02, a, b, yy - 0.06, yy + 0.04, 'metal', 1);
  }
  block(B, s0 - 0.08, s0 + 0.02, u0, u1, fy - 0.1, fy, 'metal', 1);
  B.tint(GLASS);
  for (const [a, b] of [[u0 + 0.05, VESTIBULE.door[0] - 0.05], [VESTIBULE.door[1] + 0.05, u1 - 0.05]]) {
    B.poly([L(s0 - 0.03, a, PY + 0.25), L(s0 - 0.03, b, PY + 0.25), L(s0 - 0.03, b, fy - 0.1), L(s0 - 0.03, a, fy - 0.1)], N(-1, 0), 'rs-glass', 2);
  }
  // the blue band with the white roundels on the doors, as on SL's doors
  B.tint(NAVY);
  for (const [a, b] of [[u0 + 0.05, VESTIBULE.door[0] - 0.05], [VESTIBULE.door[1] + 0.05, u1 - 0.05]]) block(B, s0 - 0.05, s0 - 0.03, a, b, PY + 1.25, PY + 1.4, 'gs-paint', 1);
  // the doors at the passage's far end, out to the tram platforms
  B.tint(0xb9bec2);
  const e = 122.45;
  block(B, e - 0.05, e + 0.05, -1.6, 2.8, 8.35 + 2.1, 8.35 + 2.2, 'metal', 1);
  for (const x of [-1.6, -0.5, 0.6, 1.7, 2.8]) block(B, e - 0.05, e + 0.05, x - 0.04, x + 0.04, 8.35, 8.35 + 2.1, 'metal', 1);
  B.tint(GLASS);
  B.poly([L(e, -1.6, 8.35), L(e, 2.8, 8.35), L(e, 2.8, 10.45), L(e, -1.6, 10.45)], N(-1, 0), 'rs-glass', 2);
}

export function buildRopstenStation(B: Builder, ground: Ground) {
  B.place([ROPSTEN.x, 0, ROPSTEN.z], Math.atan2(-ROPSTEN.tx, -ROPSTEN.tz));
  buildDecks(B, ground);
  buildFloors(B);
  buildGapEdges(B);
  buildRoofs(B);
  buildSigns(B);
  buildFurniture(B);
  buildSnakeWall(B);
  buildStairHouse(B, ground);
  buildNorthEast(B, ground);
  B.place([0, 0, 0], 0);
}
