import * as THREE from 'three';
import * as T from '../textures';
import type { Builder, V2, V3 } from './builder.ts';
import { buildFacades } from './facades.ts';
import { addMaterial, standard } from './materials.ts';

// Ropsten, the red line's end, and what is seen from its platforms and from the trains coming in:
// the two bridges to Lidingö over Lilla Värtan.
//
// - Lidingöbron (1971), the road bridge: a single concrete box girder, painted a pale mauve, 25 m
//   wide with three lanes each way, on pairs of square piers 73.5 m apart over the water and on
//   wall piers every 25 m over Ropsten's bus square, where its two halves part for the ramps;
//   lamp masts down the middle, steel railings along the edges. Its deck from Lantmäteriet's
//   laser scan (Laserdata Nedladdning, skog, March 2021, CC BY 4.0), every 10 m along it and its
//   edges; its piers and lamps from the scan and from Google's 3D mesh of the city.
// - Lilla Lidingöbron (2025), the new bridge for Lidingöbanan's trams, cyclists and walkers,
//   in the place of the old bridge of 1925 (taken down since): a slim white deck on single
//   piers, two tracks on its south-east side and a path on the north-west, between white
//   railings. It is newer than the scan; its deck is from Google's mesh, its course from
//   OpenStreetMap (© OpenStreetMap contributors, ODbL).
//
// The looks are from photographs on Wikimedia Commons. World coordinates (src/geo.ts); heights
// RH 2000.

type Ground = (x: number, z: number) => number | null;

addMaterial('rp-asphalt', () => standard(T.asphalt(), 0.92));

// colours
const MAUVE = 0xb4a5b0, MAUVE_UNDER = 0xd6cad0, PIER = 0xa9a7a1, KERB = 0xbdbab2, ASPHALT = 0x5f6164, PAINT = 0xe6e6e0;
const BARS = 0x4a4e52, MAST = 0x9a9ea2, LAMP = 0xf4f2e6, WHITE = 0xdcdedb, WHITE_RAIL = 0xe8eae8, PATH = 0x6a6b6c;
const BALLAST = 0x8a8178, RAIL_STEEL = 0x8a8580;

const UP: V3 = [0, 1, 0];
const v3 = ([x, z]: V2, y: number): V3 => [x, y, z];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ------------------------------------------------------------------ drawing helpers
// A line on the ground, resampled every metre and its direction smoothed over a few metres, so
// that lines offset far to its side bend smoothly at its corners. `s` is metres along it from its
// first point; before and after it, it runs straight on.
class Line {
  private p: V2[] = [];
  private t: V2[] = [];
  readonly length: number;
  constructor(pts: V2[]) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.length = cum[cum.length - 1];
    const raw = (s: number): V2 => {
      let i = 0;
      while (i < pts.length - 2 && cum[i + 1] < s) i++;
      const f = (s - cum[i]) / (cum[i + 1] - cum[i]);
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    };
    const n = Math.ceil(this.length);
    for (let k = 0; k <= n; k++) this.p.push(raw(Math.min(k, this.length)));
    for (let k = 0; k <= n; k++) {
      const a = this.p[Math.max(0, k - 4)], b = this.p[Math.min(n, k + 4)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      this.t.push([(b[0] - a[0]) / l, (b[1] - a[1]) / l]);
    }
  }
  // the point and the direction along at s
  frame(s: number): { p: V2; t: V2 } {
    const n = this.p.length - 1;
    if (s <= 0 || s >= n) {
      const k = s <= 0 ? 0 : n, t = this.t[k], d = s <= 0 ? s : s - n;
      return { p: [this.p[k][0] + t[0] * d, this.p[k][1] + t[1] * d], t };
    }
    const k = Math.floor(s), f = s - k, a = this.p[k], b = this.p[k + 1], ta = this.t[k], tb = this.t[k + 1];
    const tx = ta[0] + (tb[0] - ta[0]) * f, tz = ta[1] + (tb[1] - ta[1]) * f, l = Math.hypot(tx, tz) || 1;
    return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], t: [tx / l, tz / l] };
  }
  // the point u metres to the right of the line at s
  at(s: number, u: number): V2 {
    const { p, t } = this.frame(s);
    return [p[0] - t[1] * u, p[1] + t[0] * u];
  }
  right(s: number): V3 { const { t } = this.frame(s); return [-t[1], 0, t[0]]; }
  along(s: number): V3 { const { t } = this.frame(s); return [t[0], 0, t[1]]; }
}

// straight between [s, value] rows, level beyond the first and last
function table(rows: [number, number][]) {
  return (s: number) => {
    if (s <= rows[0][0]) return rows[0][1];
    for (let i = 1; i < rows.length; i++) {
      if (s <= rows[i][0]) {
        const [a, va] = rows[i - 1], [b, vb] = rows[i];
        return va + ((vb - va) * (s - a)) / (b - a);
      }
    }
    return rows[rows.length - 1][1];
  };
}

// Quads between rows of points (each row across, the rows along), each facing the side of `hint`.
function loft(B: Builder, rows: V3[][], mat: string, hint: (i: number, k: number) => V3, tile: number | V2 = 4) {
  for (let i = 0; i + 1 < rows.length; i++) {
    for (let k = 0; k + 1 < rows[i].length; k++) {
      const p = [rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]];
      const a = sub(p[1], p[0]), b = sub(p[3], p[0]), c = sub(p[2], p[1]);
      let n = cross(Math.hypot(...a) > 1e-6 ? a : c, Math.hypot(...b) > 1e-6 ? b : sub(p[2], p[3]));
      if (Math.hypot(...n) < 1e-9) continue;
      const h = hint(i, k);
      if (n[0] * h[0] + n[1] * h[1] + n[2] * h[2] < 0) n = [-n[0], -n[1], -n[2]];
      B.poly(p, n, mat, tile);
    }
  }
}
// A box standing on the ground, turned to a line's direction `t` (x, z): `along` by `across`, from
// y0 to y1.
function post(B: Builder, c: V2, t: V2, along: number, across: number, y0: number, y1: number, mat: string, tile = 2) {
  B.wallBox([c[0], 0, c[1]], [t[0], 0, t[1]], [-t[1], 0, t[0]], -along / 2, along / 2, y0, y1, -across / 2, across / 2, mat, tile);
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
// the stations along a part from `from` to `to`, every `step`, inside [s0, s1]
function stations(from: number, to: number, step: number, [s0, s1]: V2) {
  const a = Math.max(from, s0), b = Math.min(to, s1);
  if (b - a < 0.01) return [];
  const out = [a];
  for (let s = Math.floor(a / step) * step + step; s < b - 0.01; s += step) out.push(s);
  out.push(b);
  return out;
}

// ------------------------------------------------------------------ decks
// A part of a bridge's deck along a line: from `left` to `right` metres across it (to its right),
// its road `top` high, cut as a box girder: the road between kerbed edge beams, a fascia `edge`
// deep, the slab running in `inset` to the girder's sloping webs and its bottom `depth` under the
// road.
interface Deck {
  line: Line; from: number; to: number; step: number;
  left: (s: number) => number; right: (s: number) => number; top: (s: number) => number;
  edge: number; inset: number; depth: (s: number) => number;
  road: number; fascia: number; under: number; kerb: number;
  // the railings along the edges (none where false), their colour and height
  rails?: { left: boolean; right: boolean; colour: number; height: number; mat?: string };
  // an abutment's wall at an end, down to the ground
  ends?: { from?: boolean; to?: boolean };
  roadMat?: string;
}
function deck(B: Builder, d: Deck, range: V2, ground: Ground) {
  const ss = stations(d.from, d.to, d.step, range);
  if (ss.length < 2) return;
  // the cross-section, (u, up from the road), clockwise round the girder from the left kerb
  const KERB_W = 0.5, KERB_H = 0.25;
  const section = (s: number): V2[] => {
    const a = d.left(s), b = d.right(s), D = d.depth(s), E = d.edge, I = Math.min(d.inset, (b - a) / 2 - 0.6);
    const web = Math.min(0.25 * (D - E), (b - a) / 2 - I - 0.3);
    return [[a + KERB_W, 0], [a + KERB_W, KERB_H], [a, KERB_H], [a, -E], [a + I, -E - 0.3], [a + I + web, -D],
      [b - I - web, -D], [b - I, -E - 0.3], [b, -E], [b, KERB_H], [b - KERB_W, KERB_H], [b - KERB_W, 0]];
  };
  const point = (s: number, [u, dy]: V2): V3 => v3(d.line.at(s, u), d.top(s) + dy);
  const secs = ss.map(section);
  const hint = (i: number, k: number): V3 => {
    const s = ss[i], [ua, ya] = secs[i][k], [ub, yb] = secs[i][(k + 1) % secs[i].length];
    // outward: to the right of the way round
    const nu = yb - ya, ny = -(ub - ua), r = d.line.right(s);
    return [r[0] * nu, ny, r[2] * nu];
  };
  const strip = (k0: number, k1: number, mat: string, colour: number, tile: number | V2 = 4) => {
    B.tint(colour);
    for (let k = k0; k < k1; k++) loft(B, ss.map((s, i) => [point(s, secs[i][k]), point(s, secs[i][(k + 1) % secs[i].length])]), mat, (i) => hint(i, k), tile);
  };
  strip(11, 12, d.roadMat ?? 'rp-asphalt', d.road, 6);
  strip(0, 2, 'concrete', d.kerb, 2);
  strip(9, 11, 'concrete', d.kerb, 2);
  strip(2, 3, 'concrete', d.fascia, 3);
  strip(8, 9, 'concrete', d.fascia, 3);
  strip(3, 8, 'concrete', d.under, 6);
  // the ends: the section closed, and an abutment's wall under it down to the ground
  for (const [end, s, i] of [['from', ss[0], 0], ['to', ss[ss.length - 1], ss.length - 1]] as const) {
    const want = end === 'from' ? d.ends?.from && s <= d.from + 0.01 : d.ends?.to && s >= d.to - 0.01;
    if (!want) continue;
    const sec = secs[i], al = d.line.along(s), out: V3 = end === 'from' ? [-al[0], 0, -al[2]] : al;
    const tri = THREE.ShapeUtils.triangulateShape(sec.map(([u, y]) => new THREE.Vector2(u, y)), []);
    B.tint(d.under);
    B.tris(sec.map((p) => point(s, p)), tri, out, 'concrete', 4);
    const a = d.line.at(s, d.left(s)), b = d.line.at(s, d.right(s)), y = d.top(s) - d.depth(s);
    const ga = ground(a[0], a[1]) ?? y, gb = ground(b[0], b[1]) ?? y;
    if (Math.min(ga, gb) < y - 0.2) {
      B.tint(PIER);
      B.poly([v3(a, Math.min(ga, y) - 1), v3(b, Math.min(gb, y) - 1), v3(b, d.top(s) - d.edge), v3(a, d.top(s) - d.edge)], out, 'concrete', 4);
    }
  }
  // the railings
  if (d.rails) {
    B.tint(d.rails.colour);
    for (const side of ['left', 'right'] as const) {
      if (!d.rails[side]) continue;
      const u = (s: number) => (side === 'left' ? d.left(s) + 0.2 : d.right(s) - 0.2);
      const pts = ss.map((s) => v3(d.line.at(s, u(s)), d.top(s) + KERB_H));
      const out = (i: number): V3 => { const r = d.line.right(ss[i]); return side === 'left' ? [-r[0], 0, -r[2]] : r; };
      if (d.rails.mat) loft(B, ss.map((s, i) => [pts[i], [pts[i][0], pts[i][1] + d.rails!.height, pts[i][2]]]), d.rails.mat, (i) => out(i), 2);
      else railing(B, pts, d.rails.height, out);
      // the handrail along the top
      loft(B, ss.map((s, i) => {
        const r = d.line.right(s), p = pts[i], y = p[1] + d.rails!.height;
        return [[p[0] - r[0] * 0.06, y, p[2] - r[2] * 0.06], [p[0] + r[0] * 0.06, y, p[2] + r[2] * 0.06]];
      }), 'metal', () => UP, 2);
    }
  }
}

// Dashed and solid lines on a deck's road, `lane` lines at these u (by s), dashed or not.
function lines(B: Builder, line: Line, top: (s: number) => number, from: number, to: number, range: V2, us: ((s: number) => number)[], dashed: boolean) {
  B.tint(PAINT);
  const w = 0.075;
  if (dashed) {
    for (const u of us) {
      for (let s = Math.ceil(from / 12) * 12; s + 3 <= to; s += 12) {
        if (s < range[0] || s >= range[1]) continue;
        const P = (t: number, du: number) => v3(line.at(t, u(t) + du), top(t) + 0.015);
        B.poly([P(s, -w), P(s + 3, -w), P(s + 3, w), P(s, w)], UP, 'gs-paint', 4);
      }
    }
  } else {
    const ss = stations(from, to, 6, range);
    if (ss.length < 2) return;
    for (const u of us) loft(B, ss.map((s) => [v3(line.at(s, u(s) - w), top(s) + 0.015), v3(line.at(s, u(s) + w), top(s) + 0.015)]), 'gs-paint', () => UP, 4);
  }
}

// A lamp mast `h` high at the side of a road, its arm out over the road to the right of `t`
// (or both ways), the lamp a flat box.
function lampMast(B: Builder, p: V2, foot: number, h: number, t: V2, arms: number[]) {
  B.tint(MAST);
  B.lathe(p[0], p[1], [[0.11, foot], [0.09, foot + h * 0.6], [0.065, foot + h]], 'metal', 6);
  const r: V2 = [-t[1], t[0]];
  for (const a of arms) {
    const e: V2 = [p[0] + r[0] * a, p[1] + r[1] * a];
    B.tint(MAST);
    B.wallBox([p[0], 0, p[1]], [r[0] * Math.sign(a), 0, r[1] * Math.sign(a)], [t[0], 0, t[1]], 0, Math.abs(a), foot + h - 0.12, foot + h, -0.05, 0.05, 'metal', 1);
    B.tint(LAMP);
    post(B, e, t, 0.35, 0.7, foot + h - 0.2, foot + h - 0.02, 'gs-paint', 1);
  }
}

// ------------------------------------------------------------------ Lidingöbron
// Along the middle of its south-east carriageway (OpenStreetMap's eastbound lanes), from the
// abutment at Ropsten to Torsvik on Lidingö.
const LB = new Line([[2570.0, -2853.3], [2578.1, -2873.5], [2583.9, -2886.1], [2591.4, -2898.4], [2602.1, -2910.2], [2612.7, -2922.2],
  [2622.9, -2934.1], [2643.7, -2957.0], [2693.8, -3007.4], [3030.5, -3327.0], [3062.9, -3355.7], [3090.3, -3378.2], [3124.9, -3406.4],
  [3158.0, -3431.7], [3202.5, -3463.5], [3221.7, -3476.2], [3242.6, -3490.9], [3258.6, -3499.2], [3274.0, -3506.1], [3297.3, -3514.3]]);
// The road's height along it (the scan's deck, its median every 10 m): rising at 5 % from the
// abutment over the bus square, nearly level over the water, and climbing to Lidingö's shore.
const LB_TOP = table([[0, 9.93], [20, 10.91], [40, 11.96], [60, 12.97], [80, 13.96], [100, 14.93], [120, 15.78], [140, 16.36], [160, 16.71],
  [180, 16.88], [200, 16.91], [250, 16.94], [300, 17.07], [350, 17.29], [400, 17.57], [450, 17.82], [500, 18.05], [550, 18.34], [600, 18.63],
  [650, 18.91], [700, 19.28], [750, 19.69], [770, 19.98], [800, 20.38], [840, 21.02], [880, 21.73], [920, 22.41], [950, 22.88], [992, 23.9]]);
// Over the bus square the westbound half (to the left) is a ramp of its own, a gap between them
// closing at 140 m; the two halves' heights a little apart. South of the abutment the roads come up
// onto it on the hill's shoulder, at 5 % (the scan's ground, 9.4 m 12 m back).
const LB_TOP_NW = table([[-10, 9.66], [0, 10.14], [20, 11.1], [40, 12.23], [60, 13.35], [80, 14.28], [100, 15.18], [120, 15.94], [140, 16.47]]);
const LB_TOP_SE = table([[-10, 9.37], [0, 9.86], [20, 10.84], [40, 11.82], [60, 12.83], [80, 13.83], [100, 14.84], [120, 15.68], [140, 16.27]]);
// the edges (the scan's deck points, the outermost)
const LB_LEFT = table([[0, -35.6], [10, -34], [20, -32.6], [30, -31.6], [40, -30.9], [50, -31.4], [60, -32.5], [70, -33], [80, -32.6],
  [90, -31.7], [100, -31.1], [110, -30.2], [120, -29.2], [130, -28.4], [140, -27.4], [150, -26.8], [160, -26.2], [170, -25.5], [180, -25],
  [190, -24.5], [200, -23.9], [220, -23.2], [240, -22.8], [260, -22.3], [280, -21.8], [300, -21.9], [350, -21.4], [400, -21.4], [450, -21.2],
  [500, -21.1], [550, -20.7], [600, -20.6], [650, -21], [670, -21.6], [690, -22.7], [710, -24.1], [730, -26], [750, -28.1], [765, -30.2]]);
const LB_RIGHT = table([[0, 11.6], [20, 11.2], [40, 11.1], [50, 10.3], [60, 9], [70, 8.2], [80, 7.7], [100, 7.3], [120, 6.7], [130, 5.9],
  [150, 5.2], [200, 5.1], [220, 4.2], [250, 3.8], [400, 3.9], [500, 4.2], [600, 4.7], [640, 5.2], [660, 6], [700, 6.5], [760, 6.7], [800, 7.1],
  [900, 7.3], [920, 8.9], [950, 9.6], [992, 10]]);
// the gap between the halves at the Ropsten end
const LB_GAP_L = table([[0, -15.7], [10, -16.2], [20, -17], [30, -17.3], [50, -17.4], [60, -19], [70, -19.3], [80, -19.2], [90, -18.3], [100, -17.5],
  [110, -17], [120, -15.4], [130, -14.8], [140, -13.7]]);
const LB_GAP_R = table([[0, -9.1], [10, -11.2], [20, -11.5], [30, -11.1], [40, -10.9], [50, -12.2], [60, -13.1], [70, -13.5], [80, -13.8],
  [90, -13.4], [110, -13], [130, -12.6], [140, -13.7]]);
// and at the Lidingö end, where Elfvikskopplet, the ramp to Elfvik, leaves the westbound lanes
const LB_SPLIT = 765;
const LB_C_LEFT = -14.5;
const EV_GAP = table([[765, -16], [770, -17.6], [780, -18.7], [790, -20.4], [800, -22.2], [810, -23.9], [820, -25.9], [830, -29.9], [840, -33.6]]);
const EV_LEFT = table([[765, -30.2], [770, -30.9], [780, -31.9], [790, -33.5], [800, -35.4], [810, -38.3], [820, -41.8], [830, -45.7], [840, -49.6]]);
const EV_TOP = table([[760, 19.54], [770, 19.39], [780, 19.22], [790, 19.03], [800, 18.77], [810, 18.48], [820, 18.13], [830, 17.87], [840, 17.7]]);
// Elfvikskopplet on from there down to Lidingö's shore (OpenStreetMap; the scan's deck)
const EV_ON: V2[] = [[3149.6, -3484.4], [3154.6, -3494.7], [3160.5, -3507.0], [3166.0, -3523.7], [3169.3, -3538.5], [3172.3, -3553.5], [3173.8, -3569.8]];
const EV_ON_TOP = table([[0, 17.7], [9, 16.96], [19, 16.67], [29, 16.37], [39, 16.02], [49, 15.67], [59, 15.39], [69, 15.11], [79, 15], [100, 14.8]]);
// The girder: shallow over the bus square, where the spans are 25 m, deep over the water.
const LB_DEPTH = table([[150, 1.7], [185, 3.3]]);
// piers: wall piers under each half over the bus square, pairs of square piers further on
const LB_WALLS = [24, 47.5, 71, 96.5, 122.5, 150.5];
const LB_PAIRS = [177.5, 251, 324.7, 398.2, 472, 545.7, 619, 692, 762, 834, 900, 928];
const LB_MEDIAN = -8.5;

// the part of the bridge in each tile, by s: the tiles are 500 m, x and z
export const LIDINGOBRON_PARTS: { anchor: V2; range: V2 }[] = [
  { anchor: [2620, -2930], range: [-20, 189.3] },
  { anchor: [2800, -3150], range: [189.3, 621.9] },
  { anchor: [3100, -3400], range: [621.9, 1000] },
];

export function buildLidingobron(B: Builder, ground: Ground, range: V2) {
  B.place([0, 0, 0], 0);
  const common = { line: LB, step: 4, edge: 0.75, road: ASPHALT, fascia: MAUVE, under: MAUVE_UNDER, kerb: KERB,
    rails: { left: true, right: true, colour: BARS, height: 1.0 } };
  const lb = { ...common, inset: 3.4, depth: LB_DEPTH };
  // the halves over the bus square
  deck(B, { ...lb, from: -10, to: 140, left: LB_LEFT, right: LB_GAP_L, top: LB_TOP_NW, inset: 2.5, ends: { from: true } }, range, ground);
  deck(B, { ...lb, from: -10, to: 140, left: LB_GAP_R, right: LB_RIGHT, top: LB_TOP_SE, inset: 2.5, ends: { from: true } }, range, ground);
  // the whole deck
  deck(B, { ...lb, from: 140, to: LB_SPLIT, left: LB_LEFT, right: LB_RIGHT, top: LB_TOP }, range, ground);
  // and the halves at Lidingö
  deck(B, { ...lb, from: LB_SPLIT, to: 992, left: () => LB_C_LEFT, right: LB_RIGHT, top: LB_TOP, inset: 3, ends: { to: true } }, range, ground);
  deck(B, { ...lb, from: LB_SPLIT, to: 840, left: EV_LEFT, right: EV_GAP, top: EV_TOP, inset: 2.5 }, range, ground);
  if (range[1] > 840) {
    // Elfvikskopplet on, from the end of the part above
    const link = LB.at(840, (EV_LEFT(840) + EV_GAP(840)) / 2);
    const ev = new Line([link, ...EV_ON]);
    deck(B, { ...lb, line: ev, from: 0, to: ev.length, left: () => -5, right: () => 5, top: EV_ON_TOP, inset: 2.2, depth: () => 2,
      ends: { to: true } }, [-1, 1e4], ground);
  }

  // the lane lines: three lanes each way, the median between them
  const top = LB_TOP;
  lines(B, LB, LB_TOP_SE, -10, 140, range, [(s) => LB_GAP_R(s) + 0.8, (s) => LB_RIGHT(s) - 0.8], false);
  lines(B, LB, LB_TOP_NW, -10, 140, range, [(s) => LB_LEFT(s) + 0.8, (s) => LB_GAP_L(s) - 0.8], false);
  lines(B, LB, LB_TOP_SE, -10, 140, range, [1, 2].map((k) => (s: number) => LB_GAP_R(s) + 0.8 + ((LB_RIGHT(s) - LB_GAP_R(s) - 1.6) * k) / 3), true);
  lines(B, LB, LB_TOP_NW, -10, 140, range, [(s: number) => (LB_LEFT(s) + LB_GAP_L(s)) / 2], true);
  lines(B, LB, top, 140, LB_SPLIT, range, [(s) => LB_LEFT(s) + 0.8, () => LB_MEDIAN - 0.6, () => LB_MEDIAN + 0.6, (s) => LB_RIGHT(s) - 0.8], false);
  lines(B, LB, top, 140, LB_SPLIT, range, [1, 2].map((k) => (s: number) => LB_MEDIAN + 0.6 + ((LB_RIGHT(s) - 0.8 - LB_MEDIAN - 0.6) * k) / 3), true);
  lines(B, LB, top, 140, LB_SPLIT, range, [1, 2].map((k) => (s: number) => LB_LEFT(s) + 0.8 + ((LB_MEDIAN - 0.6 - LB_LEFT(s) - 0.8) * k) / 3), true);
  // the median's barrier
  const ms = stations(140, LB_SPLIT, 8, range);
  if (ms.length > 1) {
    B.tint(KERB);
    const m = (s: number, du: number, dy: number) => v3(LB.at(s, LB_MEDIAN + du), top(s) + dy);
    loft(B, ms.map((s) => [m(s, -0.3, 0), m(s, -0.12, 0.8), m(s, 0.12, 0.8), m(s, 0.3, 0)]), 'concrete', (i, k) => {
      const r = LB.right(ms[i]);
      return k === 0 ? [-r[0], 0.3, -r[2]] : k === 1 ? UP : [r[0], 0.3, r[2]];
    }, 2);
  }

  // the piers
  B.tint(PIER);
  const inRange = (s: number) => s >= range[0] && s < range[1];
  for (const s of LB_WALLS.filter(inRange)) {
    const { t } = LB.frame(s);
    for (const [a, b, y] of [[LB_LEFT(s), LB_GAP_L(s), LB_TOP_NW(s)], [LB_GAP_R(s), LB_RIGHT(s), LB_TOP_SE(s)]]) {
      if (s > 140 && a !== LB_LEFT(s)) continue;
      const c = LB.at(s, (a + b) / 2), w = Math.min(6, (s > 140 ? LB_RIGHT(s) - LB_LEFT(s) : b - a) - 5);
      const g = ground(c[0], c[1]) ?? 3;
      post(B, c, t, 1.2, w, g - 1, y - LB_DEPTH(s) + 0.05, 'concrete');
    }
  }
  for (const s of LB_PAIRS.filter(inRange)) {
    const { t } = LB.frame(s);
    // over the halves at Lidingö, a pair under the eastbound half and one pier under the ramp
    const halves: [number, number, number][] = s > LB_SPLIT ? [[LB_C_LEFT, LB_RIGHT(s), LB_TOP(s)]] : [[LB_LEFT(s), LB_RIGHT(s), LB_TOP(s)]];
    for (const [a, b, y] of halves) {
      const mid = (a + b) / 2, half = Math.min(6.8, (b - a) / 2 - 3.2);
      for (const u of [mid - half, mid + half]) {
        const c = LB.at(s, u), g = Math.min(ground(c[0], c[1]) ?? -1, 0.2);
        post(B, c, t, 2.6, 4, g - 2, y - LB_DEPTH(s) + 0.05, 'concrete');
      }
    }
    if (s > LB_SPLIT && s <= 840) {
      const c = LB.at(s, (EV_LEFT(s) + EV_GAP(s)) / 2), g = Math.min(ground(c[0], c[1]) ?? -1, 0.2);
      post(B, c, t, 2.4, 5, g - 2, EV_TOP(s) - LB_DEPTH(s) + 0.05, 'concrete');
    }
  }

  // lamp masts: over the bus square on both edges of the eastbound half, further on down the
  // median, every 32 m, 12 m tall with an arm over each carriageway
  for (const s of [2.5, 28.8, 53.5, 82.6, 110, 139].filter(inRange)) {
    const { t } = LB.frame(s);
    lampMast(B, LB.at(s, LB_GAP_R(s) + 0.35), LB_TOP_SE(s) + 0.25, 11.5, t, [1.6]);
    lampMast(B, LB.at(s, LB_RIGHT(s) - 0.35), LB_TOP_SE(s) + 0.25, 11.5, t, [-1.6]);
  }
  for (let s = 237.2; s < LB_SPLIT; s += 31.9) {
    if (!inRange(s)) continue;
    const { t } = LB.frame(s);
    lampMast(B, LB.at(s, LB_MEDIAN), top(s) + 0.8, 11.4, t, [-2.2, 2.2]);
  }
}

// ------------------------------------------------------------------ Lilla Lidingöbron
// Along its north-west track (OpenStreetMap), from the shore at Ropsten.
const LL = new Line([[2594.7, -3035.7], [2597.6, -3045.1], [2601.6, -3053.1], [2607.4, -3061.6], [2612.9, -3067.7], [3066.2, -3495.5],
  [3073.4, -3501.8], [3081.3, -3507.1], [3091.7, -3512.8], [3100.3, -3516.5], [3110.1, -3519.9], [3119.4, -3521.8], [3129.0, -3522.5]]);
// its deck over the tracks, from Google's mesh every 20 m: rising from the shore to a crest over
// the fairway, 11.8 m, and down to Lidingö
const LL_TOP = table([[0, 6.1], [20, 5.9], [40, 6.2], [60, 6.6], [80, 6.9], [100, 7.2], [120, 7.6], [140, 7.9], [160, 8.0], [180, 8.4], [200, 8.8],
  [220, 9.0], [240, 9.4], [260, 9.7], [280, 10.0], [300, 10.3], [320, 10.8], [340, 11.1], [360, 11.5], [380, 11.8], [400, 11.7], [440, 11.6],
  [480, 11.5], [520, 11.3], [560, 11.1], [580, 11.0], [600, 10.5], [620, 10.0], [640, 9.6], [660, 9.5], [680, 9.3], [700, 9.0], [722, 8.3]]);
const LL_END = 722;
const LL_PIERS = [42.5, 114, 185.5, 257, 329.4, 400.6, 471.9, 543.8, 614.6, 680];
// the tracks 3.2 m apart, to the right of the line; the path on the left
const LL_TRACKS = [0, 3.2], LL_LEFT = -10, LL_RIGHT = 6, LL_SPLIT = -2.2;
export const LILLA_LIDINGOBRON_PARTS: { anchor: V2; range: V2 }[] = [
  { anchor: [2700, -3150], range: [-1, 569.6] },
  { anchor: [3050, -3480], range: [569.6, 800] },
];

export function buildLillaLidingobron(B: Builder, ground: Ground, range: V2) {
  B.place([0, 0, 0], 0);
  const common = { line: LL, step: 4, edge: 0.6, inset: 2.2, depth: () => 1.5, fascia: WHITE, under: 0xc8cac6, kerb: 0xc9c9c4,
    rails: { left: true, right: true, colour: WHITE_RAIL, height: 1.2 } };
  // the tracks' half: the ballast and sleepers between the kerbs
  deck(B, { ...common, from: 0, to: LL_END, left: () => LL_SPLIT, right: () => LL_RIGHT, top: LL_TOP, road: BALLAST, roadMat: 'stone',
    rails: { ...common.rails, left: false }, ends: { from: true, to: true } }, range, ground);
  // the path's, a little lower, from where it comes on to the bridge from the shore
  const pathTop = (s: number) => LL_TOP(s) - 0.4;
  deck(B, { ...common, from: 12, to: LL_END, left: () => LL_LEFT, right: () => LL_SPLIT, top: pathTop, road: PATH,
    ends: { from: true, to: true } }, range, ground);
  // the sleepers and rails
  const ss = stations(0, LL_END, 2, range);
  for (const u0 of LL_TRACKS) {
    B.tint(0xffffff);
    loft(B, ss.map((s) => [v3(LL.at(s, u0 - 1.3), LL_TOP(s) + 0.02), v3(LL.at(s, u0 + 1.3), LL_TOP(s) + 0.02)]), 'gs-bed', () => UP, 4);
    B.tint(RAIL_STEEL);
    for (const g of [-0.7175, 0.7175]) {
      for (let i = 0; i + 1 < ss.length; i++) {
        const a = v3(LL.at(ss[i], u0 + g), LL_TOP(ss[i]) + 0.17), b = v3(LL.at(ss[i + 1], u0 + g), LL_TOP(ss[i + 1]) + 0.17);
        railBar(B, a, b);
      }
    }
  }
  // the railing between the path and the tracks
  B.tint(WHITE_RAIL);
  const mid = ss.filter((s) => s >= 12);
  if (mid.length > 1) {
    const pts = mid.map((s) => v3(LL.at(s, LL_SPLIT - 0.1), pathTop(s) + 0.25));
    railing(B, pts, 1.2, (i) => { const r = LL.right(mid[i]); return [-r[0], 0, -r[2]]; });
  }
  // the catenary's masts, every 30 m on the outer edge, with an arm over both tracks
  for (let s = 20; s < LL_END - 5; s += 30) {
    if (s < range[0] || s >= range[1]) continue;
    const { t } = LL.frame(s), p = LL.at(s, LL_RIGHT - 0.35), y = LL_TOP(s) + 0.25;
    B.tint(MAST);
    B.lathe(p[0], p[1], [[0.1, y], [0.08, y + 6.6]], 'metal', 6);
    B.wallBox([p[0], 0, p[1]], [t[1], 0, -t[0]], [t[0], 0, t[1]], 0, LL_RIGHT - 0.35 + 0.6, y + 6.2, y + 6.32, -0.04, 0.04, 'metal', 1);
  }
  // the wires over each track
  B.tint(0x3a3a3a);
  for (const u0 of LL_TRACKS) {
    for (let i = 0; i + 1 < ss.length; i++) {
      const a = v3(LL.at(ss[i], u0), LL_TOP(ss[i]) + 5.7), b = v3(LL.at(ss[i + 1], u0), LL_TOP(ss[i + 1]) + 5.7);
      railBar(B, a, b, 0.02, 0.02);
    }
  }
  // the piers: single walls across under the deck, from the bottom of the water
  B.tint(PIER);
  for (const s of LL_PIERS) {
    if (s < range[0] || s >= range[1]) continue;
    const { t } = LL.frame(s), c = LL.at(s, (LL_LEFT + LL_RIGHT) / 2), g = Math.min(ground(c[0], c[1]) ?? -1, 0.2);
    post(B, c, t, 1.4, 7, g - 2, LL_TOP(s) - 1.45, 'concrete');
  }
}
const unit2 = (v: V3): V3 => { const l = Math.hypot(v[0], v[2]) || 1; return [v[0] / l, 0, v[2] / l]; };
// a bar from a to b: its top on the line, `w` wide and `h` deep
function railBar(B: Builder, a: V3, b: V3, w = 0.07, h = 0.15) {
  const l = Math.hypot(b[0] - a[0], b[2] - a[2]);
  if (l < 1e-6) return;
  const d = unit2(sub(b, a)), n: V3 = [-d[2], 0, d[0]];
  const P = (p: V3, s: number, dy: number): V3 => [p[0] + n[0] * s, p[1] + dy, p[2] + n[2] * s];
  B.poly([P(a, -w / 2, 0), P(b, -w / 2, 0), P(b, w / 2, 0), P(a, w / 2, 0)], UP, 'metal', 2);
  B.poly([P(a, -w / 2, -h), P(b, -w / 2, -h), P(b, -w / 2, 0), P(a, -w / 2, 0)], [-n[0], 0, -n[2]], 'metal', 2);
  B.poly([P(a, w / 2, -h), P(b, w / 2, -h), P(b, w / 2, 0), P(a, w / 2, 0)], n, 'metal', 2);
}

// ------------------------------------------------------------------ Ropstensplan
// The bus square under the platforms' east end: bus lanes between raised islands, their kerbs
// the stops' edges, a railing along each island's back; SL's dark green shelters of steel and
// glass at the stops, with a light box for posters at one end and a bench; twin-headed lamps on
// tall grey poles and a clock on a pole by the kiosks. The islands, stops, railings and the clock
// from OpenStreetMap; the shelters and lamps as photographs on Wikimedia Commons show them
// (Ropsten bussterminal, 2023 and 2026), set where Google's mesh has them.

addMaterial('rp-steel', () => standard(null, 0.55, 0.2));
addMaterial('rp-glass', () => standard(null, 0.08, 0.1, { transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
addMaterial('rp-paving', () => standard(T.pavingSlabs(), 0.9));
addMaterial('rp-light', () => standard(null, 0.6, 0, { emissive: new THREE.Color(0xfff8ec), emissiveIntensity: 0.35 }));

const SL_GREEN = 0x2f4a3d, GLASS = 0xd4e2e2, POSTER = 0xe9e5da, SIGN = 0x3a3d41, SL_RED = 0xb8352a, BENCH = 0xa4825a;
const PAVING = 0xb7b3ab, KERB_STONE = 0xaaa79f, RAIL_GREY = 0x969ca0, POLE = 0x8e9397;

// An island or a pavement a kerb's height over the ground: from a kerb line (the buses' side)
// `width` to its right (to its left where negative), paved, its kerbs round it.
function island(B: Builder, ground: Ground, kerb: V2[], width: number, h = 0.15) {
  const L = new Line(kerb), n = Math.max(2, Math.ceil(L.length / 3));
  const ss = Array.from({ length: n + 1 }, (_, i) => (L.length * i) / n);
  const lo = Math.min(0, width), hi = Math.max(0, width);
  const g = (s: number, u: number) => { const p = L.at(s, u); return ground(p[0], p[1]) ?? 3.3; };
  const y = ss.map((s) => Math.max(g(s, lo), g(s, hi), g(s, (lo + hi) / 2)) + h);
  B.tint(PAVING);
  loft(B, ss.map((s, i) => [v3(L.at(s, lo), y[i]), v3(L.at(s, hi), y[i])]), 'rp-paving', () => UP, 1.4);
  B.tint(KERB_STONE);
  for (const [u, sgn] of [[lo, -1], [hi, 1]]) {
    loft(B, ss.map((s, i) => [v3(L.at(s, u), y[i]), v3(L.at(s, u), g(s, u) - 0.3)]), 'concrete', (i) => {
      const r = L.right(ss[i]);
      return [r[0] * sgn, 0, r[2] * sgn];
    }, 2);
  }
  for (const [i, sgn] of [[0, -1], [ss.length - 1, 1]]) {
    const s = ss[i], a = L.at(s, lo), b = L.at(s, hi), al = L.along(s);
    B.poly([v3(a, y[i]), v3(b, y[i]), v3(b, g(s, hi) - 0.3), v3(a, g(s, lo) - 0.3)], [al[0] * sgn, 0, al[2] * sgn], 'concrete', 2);
  }
  return { line: L, top: (s: number) => y[Math.min(n, Math.max(0, Math.round((s / L.length) * n)))] };
}

// A railing of bars on posts along a line of points, following the ground, `base` over it.
function fence(B: Builder, ground: Ground, pts: V2[], h: number, base: number, colour: number) {
  const L = new Line(pts), n = Math.max(1, Math.ceil(L.length / 2));
  const ss = Array.from({ length: n + 1 }, (_, i) => (L.length * i) / n);
  const at = ss.map((s) => { const p = L.at(s, 0); return v3(p, (ground(p[0], p[1]) ?? 3.3) + base); });
  B.tint(colour);
  railing(B, at, h, (i) => L.right(ss[i]));
  loft(B, ss.map((s, i) => {
    const r = L.right(s), p = at[i];
    return [[p[0] - r[0] * 0.03, p[1] + h, p[2] - r[2] * 0.03], [p[0] + r[0] * 0.03, p[1] + h, p[2] + r[2] * 0.03]];
  }), 'metal', () => UP, 2);
}

// An SL bus shelter `len` long, its middle at `c` on a floor `y`, along `t`, open to the side
// `open` (+1 the right of t, -1 the left): posts and a thin flat roof of dark green steel, glass
// at the back and at one end, a light box for posters at the other, a bench along the back, and
// the stop's sign at the front of the roof.
function shelter(B: Builder, c: V2, t: V2, open: number, y: number, len = 4.2) {
  const n: V2 = [-t[1] * open, t[0] * open], D = 1.5, H = 2.45, a = len / 2;
  const o: V3 = [c[0], 0, c[1]], h: V3 = [t[0], 0, t[1]], out: V3 = [n[0], 0, n[1]];
  // d: out from the middle towards the open front (D / 2) and the back (-D / 2)
  const box = (a0: number, a1: number, y0: number, y1: number, d0: number, d1: number, mat: string, colour: number) => {
    B.tint(colour);
    B.wallBox(o, h, out, a0, a1, y + y0, y + y1, d0, d1, mat, 1);
  };
  for (let k = 0; k <= 3; k++) {
    const x = -a + (len * k) / 3;
    box(x - 0.04, x + 0.04, 0, H, -D / 2, -D / 2 + 0.08, 'rp-steel', SL_GREEN);
  }
  for (const x of [-a, a]) box(x - 0.04, x + 0.04, 0, H, D / 2 - 0.35, D / 2 - 0.27, 'rp-steel', SL_GREEN);
  // the roof, a little over all round, and the rails top and bottom of the glass
  box(-a - 0.15, a + 0.15, H, H + 0.14, -D / 2 - 0.1, D / 2 + 0.1, 'rp-steel', SL_GREEN);
  box(-a, a, 0.08, 0.16, -D / 2, -D / 2 + 0.06, 'rp-steel', SL_GREEN);
  box(-a, a, H - 0.12, H, -D / 2, -D / 2 + 0.06, 'rp-steel', SL_GREEN);
  // the glass: the back, and the end away from the light box
  const P = (x: number, yy: number, d: number): V3 => [c[0] + t[0] * x + n[0] * d, y + yy, c[1] + t[1] * x + n[1] * d];
  B.tint(GLASS);
  B.poly([P(-a, 0.16, -D / 2 + 0.03), P(a, 0.16, -D / 2 + 0.03), P(a, H - 0.12, -D / 2 + 0.03), P(-a, H - 0.12, -D / 2 + 0.03)], [-n[0], 0, -n[1]], 'rp-glass');
  B.poly([P(-a, 0.16, -D / 2), P(-a, 0.16, D / 2 - 0.3), P(-a, H - 0.12, D / 2 - 0.3), P(-a, H - 0.12, -D / 2)], [-t[0], 0, -t[1]], 'rp-glass');
  // the light box: lit posters on both faces, in a green frame
  box(a - 0.1, a + 0.1, 0.12, 2.15, -D / 2 + 0.1, D / 2 - 0.3, 'rp-steel', SL_GREEN);
  B.tint(POSTER);
  for (const s of [-1, 1]) {
    const x = a + s * 0.105;
    B.poly([P(x, 0.25, -D / 2 + 0.2), P(x, 0.25, D / 2 - 0.4), P(x, 2.02, D / 2 - 0.4), P(x, 2.02, -D / 2 + 0.2)], [t[0] * s, 0, t[1] * s], 'rp-light');
  }
  // the bench
  box(-a + 0.6, a - 0.6, 0.42, 0.47, -D / 2 + 0.1, -D / 2 + 0.5, 'rp-steel', BENCH);
  for (const x of [-a + 0.8, a - 0.8]) box(x - 0.03, x + 0.03, 0, 0.42, -D / 2 + 0.2, -D / 2 + 0.4, 'rp-steel', SIGN);
  // the stop's sign, under the front of the roof at the light box's end: dark grey over a red band
  box(a - 1.4, a - 0.1, H - 0.42, H - 0.02, D / 2 - 0.02, D / 2 + 0.02, 'rp-steel', SIGN);
  box(a - 1.4, a - 0.1, H - 0.5, H - 0.42, D / 2 - 0.02, D / 2 + 0.02, 'rp-steel', SL_RED);
}

// A street lamp: a tall grey pole with its lamps on short arms
function streetLamp(B: Builder, p: V2, y: number, h: number, t: V2, arms: number[]) {
  B.tint(POLE);
  B.lathe(p[0], p[1], [[0.13, y], [0.1, y + h * 0.5], [0.07, y + h]], 'metal', 8);
  const r: V2 = [-t[1], t[0]];
  for (const a of arms) {
    B.tint(POLE);
    B.wallBox([p[0], 0, p[1]], [r[0] * Math.sign(a), 0, r[1] * Math.sign(a)], [t[0], 0, t[1]], 0, Math.abs(a), y + h - 0.1, y + h, -0.04, 0.04, 'metal', 1);
    const e: V2 = [p[0] + r[0] * a, p[1] + r[1] * a];
    B.tint(0x5c6064);
    post(B, e, t, 0.32, 0.55, y + h - 0.16, y + h + 0.02, 'metal', 1);
    B.tint(LAMP);
    post(B, e, t, 0.26, 0.45, y + h - 0.2, y + h - 0.16, 'rp-light', 1);
  }
}

// The square's clock on its pole: two white faces in a dark rim, turned along `t`
function clock(B: Builder, p: V2, y: number, t: V2) {
  B.tint(POLE);
  B.lathe(p[0], p[1], [[0.08, y], [0.06, y + 3.3]], 'metal', 8);
  const r = 0.38, c = y + 3.6, ring = (rad: number, d: number): V3[] => Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * Math.PI * 2;
    return [p[0] + t[0] * Math.cos(a) * rad - t[1] * d, c + Math.sin(a) * rad, p[1] + t[1] * Math.cos(a) * rad + t[0] * d];
  });
  for (const s of [-1, 1]) {
    B.tint(0x2c2e31);
    B.poly(ring(r + 0.05, s * 0.08), [-t[1] * s, 0, t[0] * s], 'rp-steel');
    B.tint(0xf4f2ea);
    B.poly(ring(r, s * 0.085), [-t[1] * s, 0, t[0] * s], 'rp-light');
    // the hands
    B.tint(0x1e1f21);
    const hand = (ang: number, l: number) => {
      const e: V3 = [p[0] + t[0] * Math.cos(ang) * l - t[1] * s * 0.09, c + Math.sin(ang) * l, p[1] + t[1] * Math.cos(ang) * l + t[0] * s * 0.09];
      const q: V3 = [-Math.sin(ang) * 0.02, Math.cos(ang) * 0.02, 0];
      const m: V3 = [p[0] - t[1] * s * 0.09, c, p[1] + t[0] * s * 0.09];
      B.poly([[m[0] - t[0] * q[0], m[1] - q[1], m[2] - t[1] * q[0]], [e[0] - t[0] * q[0], e[1] - q[1], e[2] - t[1] * q[0]],
        [e[0] + t[0] * q[0], e[1] + q[1], e[2] + t[1] * q[0]], [m[0] + t[0] * q[0], m[1] + q[1], m[2] + t[1] * q[0]]], [-t[1] * s, 0, t[0] * s], 'rp-steel');
    };
    hand(Math.PI / 2, r * 0.8); hand(-0.3, r * 0.55);
  }
  B.tint(0x2c2e31);
  B.wallBox([p[0], 0, p[1]], [t[0], 0, t[1]], [-t[1], 0, t[0]], -r - 0.05, r + 0.05, c - r - 0.05, c + r + 0.05, -0.08, 0.08, 'rp-steel', 1, ['front', 'back']);
}

// the islands: their kerbs (OpenStreetMap's platforms, the buses' side) and widths, to the
// railings along their backs (OpenStreetMap's fences) and a little past them
const ISLANDS: { kerb: V2[]; width: number; fence?: V2[] }[] = [
  { kerb: [[2503.4, -2909.3], [2547.4, -2890.4], [2572.2, -2880.1]], width: 2.4, fence: [[2505.4, -2906.5], [2572.1, -2878.9]] },
  { kerb: [[2499.2, -2898.9], [2517.1, -2891.7], [2542.5, -2881.6], [2565.7, -2872.3], [2568.6, -2871.1]], width: 4.1,
    fence: [[2498.1, -2893.9], [2525.2, -2885.4], [2535.3, -2881.8], [2542.8, -2879], [2563.1, -2871.7], [2567.7, -2869.8]] },
  // the pavement on the north side, along the car park, the stops H and Y at its kerb
  { kerb: [[2533.9, -2912.6], [2538.5, -2910.7], [2570.1, -2897.2], [2574, -2895.6], [2589.5, -2885.9], [2602.2, -2876.8]], width: -4.5 },
];
// the shelters: the stop (OpenStreetMap), the way along the kerb, which side the buses are,
// and whether it stands on an island
const SHELTERS: { at: V2; t: V2; open: number; raised: boolean; len?: number }[] = [
  { at: [2501.5, -2879.8], t: [0.92, 0.39], open: -1, raised: false },  // A
  { at: [2522.9, -2872.5], t: [0.92, 0.39], open: -1, raised: false },  // B
  { at: [2516.0, -2889.6], t: [0.93, 0.37], open: -1, raised: true },   // G
  { at: [2541.6, -2879.5], t: [0.93, 0.37], open: -1, raised: true },   // F
  { at: [2564.4, -2870.3], t: [0.93, 0.37], open: -1, raised: true, len: 2.8 },   // E
  { at: [2541.2, -2912.4], t: [0.92, 0.39], open: 1, raised: true, len: 5.6 },  // H
  { at: [2559.6, -2860.0], t: [0.93, 0.37], open: -1, raised: false, len: 2.8 },  // C
  { at: [2532.6, -2935.6], t: [0.85, -0.53], open: 1, raised: false },  // Ö, by the tram's hall
];

export function buildRopstensplan(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const g = (p: V2) => ground(p[0], p[1]) ?? 3.3;
  for (const s of ISLANDS) {
    const isl = island(B, ground, s.kerb, s.width);
    // twin lamps down the islands, every 25 m
    if (s.width > 0) {
      for (let x = 10; x < isl.line.length - 4; x += 25) {
        const p = isl.line.at(x, s.width / 2), { t } = isl.line.frame(x);
        streetLamp(B, p, isl.top(x), 9, t, [-0.9, 0.9]);
      }
    }
    if (s.fence) fence(B, ground, s.fence, 1.0, 0.15, RAIL_GREY);
  }
  // the railing round the steps down from the subway's exit at the square's west end
  fence(B, ground, [[2493.1, -2895.5], [2481.3, -2900.7], [2488.8, -2900.8], [2495.3, -2898.9]], 1.0, 0, RAIL_GREY);
  for (const s of SHELTERS) {
    const l = Math.hypot(s.t[0], s.t[1]), t: V2 = [s.t[0] / l, s.t[1] / l];
    shelter(B, s.at, t, s.open, g(s.at) + (s.raised ? 0.15 : 0.02), s.len);
  }
  clock(B, [2497.8, -2871.5], g([2497.8, -2871.5]), [0.92, 0.39]);
  // lamps on the square
  for (const p of [[2508, -2866], [2489, -2852], [2531, -2868]] as V2[]) streetLamp(B, p, g(p), 9, [0.92, 0.39], [-0.9, 0.9]);
  // the covered bicycle stands by the car park: a dark roof on posts
  const bc: V2 = [2550.0, -2919.0], bt: V2 = [0.81, 0.59], bn: V2 = [-0.59, 0.81], by = g(bc);
  B.tint(0x4c5054);
  for (let x = -8; x <= 8; x += 4) for (const d of [-1.8, 1.8]) {
    const p: V2 = [bc[0] + bt[0] * x + bn[0] * d, bc[1] + bt[1] * x + bn[1] * d];
    post(B, p, bt, 0.1, 0.1, by, by + 2.4, 'rp-steel', 1);
  }
  B.wallBox([bc[0], 0, bc[1]], [bt[0], 0, bt[1]], [bn[0], 0, bn[1]], -8.6, 8.6, by + 2.4, by + 2.55, -2.5, 2.5, 'rp-steel', 2);
}

// ------------------------------------------------------------------ Lidingöbanan's stop
// Lidingöbanan's end, on a terrace behind the tram's hall, 4 m over the bus square: two tracks
// between three low platforms, the northern under a long dark canopy against the trees, buffer
// stops at the hall; from there the tracks run down to Lilla Lidingöbron. Tracks and platforms
// from OpenStreetMap, the canopy from Google's mesh, the heights from the laser scan; the looks
// from photographs on Wikimedia Commons (2023 and 2026).

// the tracks from their buffer stops on to the bridge, and their tops (the sleepers'): level at
// the stop, down to the bridge at 3 %
const TRAM_N = new Line([[2518, -2957.8], [2537.2, -2969.6], [2551.3, -2978.3], [2555.3, -2980.4], [2564.8, -2984.4], [2568.3, -2986.2],
  [2570.7, -2987.7], [2573.5, -2989.9], [2577.3, -2993.7], [2581.3, -2999.2], [2584.8, -3005.5], [2588, -3012.8], [2594.7, -3035.7]]);
const TRAM_S = new Line([[2521.6, -2951.8], [2540.4, -2963.6], [2556.3, -2973.5], [2579.3, -2988.3], [2583.1, -2991.8], [2585.7, -2995],
  [2588.1, -2998.5], [2590.2, -3002.8], [2591.8, -3007.8], [2598.6, -3035.1]]);
const TRAM_N_TOP = table([[0, 7.85], [45, 7.95], [60, 7.5], [80, 6.75], [100, 6.25], [TRAM_N.length, LL_TOP(0)]]);
const TRAM_S_TOP = table([[0, 7.85], [45, 7.95], [65, 7.3], [85, 6.6], [105, 6.2], [TRAM_S.length, LL_TOP(0)]]);
// the stop's frame: from the north track's buffer stop along the tracks (s), and across (w) to
// the south-east; the platforms' top
const STOP_O: V2 = [2518, -2957.8], STOP_A: V2 = [0.852, -0.523], STOP_TOP = 8.35;
const PLATFORMS: [number, number, number, number][] = [
  // s0, s1, w0, w1
  [-1.2, 47.6, -4.0, -1.45],
  [-0.4, 47.8, 1.45, 5.45],
  [-0.2, 48.3, 8.35, 10.8],
];

function groundTrack(B: Builder, ground: Ground, line: Line, top: (s: number) => number) {
  const ss = stations(0, line.length, 2, [0, line.length]);
  const gAt = (s: number, u: number) => { const p = line.at(s, u); return ground(p[0], p[1]) ?? top(s) - 0.4; };
  // the ballast, sloping out to the ground; the sleepers; the rails
  B.tint(BALLAST);
  loft(B, ss.map((s) => {
    const y = top(s);
    return [v3(line.at(s, -2.7), Math.min(gAt(s, -2.7), y - 0.3)), v3(line.at(s, -1.6), y), v3(line.at(s, 1.6), y), v3(line.at(s, 2.7), Math.min(gAt(s, 2.7), y - 0.3))];
  }), 'stone', () => UP, 3);
  B.tint(0xffffff);
  loft(B, ss.map((s) => [v3(line.at(s, -1.3), top(s) + 0.02), v3(line.at(s, 1.3), top(s) + 0.02)]), 'gs-bed', () => UP, 4);
  B.tint(RAIL_STEEL);
  for (const g of [-0.7175, 0.7175]) {
    for (let i = 0; i + 1 < ss.length; i++) railBar(B, v3(line.at(ss[i], g), top(ss[i]) + 0.17), v3(line.at(ss[i + 1], g), top(ss[i + 1]) + 0.17));
  }
  // the buffer stop: a steel frame across the track's end
  const { t } = line.frame(-0.4), c = line.at(-0.4, 0), y = top(0);
  B.tint(0x7d2a22);
  post(B, c, t, 0.3, 2.0, y, y + 1.05, 'rp-steel', 1);
  B.tint(0xe2c23a);
  B.wallBox([c[0], 0, c[1]], [-t[1], 0, t[0]], [t[0], 0, t[1]], -0.6, 0.6, y + 0.55, y + 0.85, 0.15, 0.2, 'gs-paint', 1);
}

export function buildTramStop(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const A = STOP_A, W: V2 = [-A[1], A[0]];
  const P = (s: number, w: number): V2 => [STOP_O[0] + A[0] * s + W[0] * w, STOP_O[1] + A[1] * s + W[1] * w];
  groundTrack(B, ground, TRAM_N, TRAM_N_TOP);
  groundTrack(B, ground, TRAM_S, TRAM_S_TOP);
  // the platforms: grey asphalt, a white band along the edges by the tracks, concrete sides
  const g = (p: V2) => ground(p[0], p[1]) ?? STOP_TOP - 0.5;
  for (const [s0, s1, w0, w1] of PLATFORMS) {
    const c: V2[] = [P(s0, w0), P(s1, w0), P(s1, w1), P(s0, w1)];
    B.tint(0x8d8e8f);
    B.poly(c.map((p) => v3(p, STOP_TOP)), UP, 'rp-asphalt', 4);
    for (const [w, d] of [[w0, 0.35], [w1, -0.35]]) {
      if (Math.min(Math.abs(w), Math.abs(w - 6.9)) < 1.6) {
        B.tint(0xe4e2dc);
        B.poly([P(s0, w), P(s1, w), P(s1, w + d), P(s0, w + d)].map((p) => v3(p, STOP_TOP + 0.005)), UP, 'gs-paint', 4);
      }
    }
    B.tint(0xb8b6b0);
    for (let k = 0; k < 4; k++) {
      const a = c[k], b = c[(k + 1) % 4], m: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const mid: V2 = [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2], out: V3 = [m[0] - mid[0], 0, m[1] - mid[1]];
      B.poly([v3(a, STOP_TOP), v3(b, STOP_TOP), v3(b, Math.min(g(b), STOP_TOP) - 0.5), v3(a, Math.min(g(a), STOP_TOP) - 0.5)], out, 'concrete', 2);
    }
  }
  // the canopy over the northern platform: a dark ribbed roof on posts at its back, sloping
  // down a little towards the track
  const y0 = STOP_TOP;
  B.tint(0x45494d);
  for (let s = 2; s <= 38; s += 6) post(B, P(s, -3.7), A, 0.16, 0.16, y0, y0 + 3.45, 'rp-steel', 1);
  const roof = (w: number, dy: number, s: number) => v3(P(s, w), y0 + dy);
  B.tint(0x55595e);
  B.poly([roof(-1.2, 3.25, 0.5), roof(-1.2, 3.25, 39.5), roof(-4.3, 3.6, 39.5), roof(-4.3, 3.6, 0.5)], UP, 'roof', 4);
  B.tint(0x6a6e72);
  B.poly([roof(-1.2, 3.1, 0.5), roof(-1.2, 3.1, 39.5), roof(-4.3, 3.45, 39.5), roof(-4.3, 3.45, 0.5)], [0, -1, 0], 'concrete', 4);
  B.tint(0x3c4044);
  B.poly([roof(-1.2, 3.1, 0.5), roof(-1.2, 3.1, 39.5), roof(-1.2, 3.25, 39.5), roof(-1.2, 3.25, 0.5)], [W[0], 0, W[1]], 'rp-steel', 2);
  // lamps under it, and benches
  B.tint(LAMP);
  for (let s = 4; s < 38; s += 7) post(B, P(s, -2.2), A, 1.2, 0.12, y0 + 3.0, y0 + 3.1, 'rp-light', 1);
  for (const s of [8, 22]) { B.tint(BENCH); post(B, P(s, -3.2), A, 1.8, 0.45, y0 + 0.42, y0 + 0.47, 'rp-steel', 1); }
  // the railings at the platforms' backs (OpenStreetMap's fences)
  fence(B, ground, [[2532.4, -2970.8], [2557.1, -2986.2]], 1.2, 0, 0x44484c);
  fence(B, ground, [[2523.5, -2948.4], [2564.9, -2974.9]], 1.2, 0, 0x44484c);
  // lamps along the middle platform
  for (const s of [12, 30, 44]) streetLamp(B, P(s, 3.45), y0, 4.5, A, [0.3]);
  // the overhead line: masts on the south-east side, an arm over both tracks, a wire over each
  for (const s of [6, 36, 66, 96]) {
    const { t } = TRAM_S.frame(s), r = TRAM_S.right(s), y = TRAM_S_TOP(s);
    const m = TRAM_S.at(s, 3.6), other = nearest(TRAM_N, TRAM_S.at(s, 0));
    const reach = 3.6 + other + 0.8;
    B.tint(MAST);
    B.lathe(m[0], m[1], [[0.12, (g(m)) - 0.2], [0.09, y + 6.8]], 'metal', 8);
    B.wallBox([m[0], 0, m[1]], [-r[0], 0, -r[2]], [t[0], 0, t[1]], 0, reach, y + 6.25, y + 6.37, -0.04, 0.04, 'metal', 1);
  }
  B.tint(0x3a3a3a);
  for (const [line, top] of [[TRAM_N, TRAM_N_TOP], [TRAM_S, TRAM_S_TOP]] as const) {
    const ss = stations(2, line.length, 4, [0, line.length]);
    for (let i = 0; i + 1 < ss.length; i++) railBar(B, v3(line.at(ss[i], 0), top(ss[i]) + 5.85), v3(line.at(ss[i + 1], 0), top(ss[i + 1]) + 5.85), 0.02, 0.02);
  }
}
// how far a point is from a line (its nearest metre)
function nearest(line: Line, p: V2) {
  let best = Infinity;
  for (let s = 0; s <= line.length; s += 1) { const q = line.at(s, 0); best = Math.min(best, Math.hypot(q[0] - p[0], q[1] - p[1])); }
  return best;
}

// ------------------------------------------------------------------ Energihamnen's tanks
// The oil tanks of the power station's harbour across the motorway, in view from the platforms:
// steel cylinders of pale grey plate in courses, under shallow cone roofs with a railing round
// the edge, a stair winding up each one's side. Where and how wide from OpenStreetMap's outlines,
// how high from the laser scan (as the city has them), the colours from Google's mesh; one has a
// floating roof, open at the top.
interface Tank { c: V2; r: number; top: number; rise: number; wall: number; roof: number; stair: number; open?: boolean }
const TANKS: Tank[] = [
  { c: [2622.9, -2778.0], r: 11.0, top: 24.4, rise: 1.7, wall: 0xb5babe, roof: 0xe6eaea, stair: 2.4 },
  { c: [2618.5, -2750.5], r: 11.8, top: 24.1, rise: 2.3, wall: 0xadb2b6, roof: 0xc0c4c9, stair: 3.0 },
  { c: [2643.8, -2736.1], r: 12.3, top: 20.9, rise: 0, wall: 0xb0b4b8, roof: 0x3a3a3f, stair: 3.6, open: true },
  { c: [2660.9, -2714.8], r: 12.6, top: 24.0, rise: 2.4, wall: 0xb3b7bb, roof: 0xa6abb1, stair: 2.2 },
  { c: [2691.4, -2794.2], r: 20.3, top: 26.6, rise: 3.7, wall: 0xb7bbbf, roof: 0xbcc1c6, stair: 2.8 },
  { c: [2722.0, -2818.2], r: 8.6, top: 26.8, rise: 1.0, wall: 0x5d6064, roof: 0xe2e1d8, stair: 2.0 },
  { c: [2737.4, -2802.4], r: 7.5, top: 26.8, rise: 0.9, wall: 0xa9adb1, roof: 0xe6e5dc, stair: 4.0 },
];
const circle = (c: V2, r: number, n: number): V2[] => Array.from({ length: n }, (_, k) => [c[0] + r * Math.cos((k / n) * Math.PI * 2), c[1] + r * Math.sin((k / n) * Math.PI * 2)]);
export const ENERGIHAMNEN_TANKS = TANKS.map((t) => ({ outline: circle(t.c, t.r + 1, 24), anchor: t.c, build: (B: Builder, g: Ground) => buildTank(B, g, t) }));

function buildTank(B: Builder, ground: Ground, k: Tank) {
  B.place([0, 0, 0], 0);
  const [cx, cz] = k.c, r = k.r, g = ground(cx + r, cz) ?? 2.8, seg = Math.max(28, Math.round(r * 3));
  B.tint(k.wall);
  B.lathe(cx, cz, [[r, g - 0.5], [r, k.top]], 'rp-steel', seg, 3);
  // the courses of plate, and the angle round the top
  B.tint(k.wall - 0x0a0a0a);
  for (let y = g + 2.4; y < k.top - 0.6; y += 2.4) B.lathe(cx, cz, [[r + 0.03, y], [r + 0.03, y + 0.1]], 'rp-steel', seg);
  B.lathe(cx, cz, [[r + 0.12, k.top - 0.3], [r + 0.12, k.top]], 'rp-steel', seg);
  B.tint(k.roof);
  if (k.open) {
    // the floating roof down inside, the shell's inside over it
    B.lathe(cx, cz, [[r - 0.02, k.top], [r - 0.02, k.top - 1.6]], 'rp-steel', seg);
    B.cap(circle(k.c, r - 0.02, seg), k.top - 1.6, 'rp-steel', 4);
  } else {
    B.lathe(cx, cz, [[r + 0.12, k.top], [0.8, k.top + k.rise], [0, k.top + k.rise + 0.05]], 'rp-steel', seg, 4);
  }
  // the railing round the roof's edge
  B.tint(0x9da1a5);
  const ring = circle(k.c, r - 0.15, seg).map(([x, z]) => v3([x, z], k.top + (k.open ? 0 : k.rise * 0.02)));
  ring.push(ring[0]);
  railing(B, ring, 1.1, (i) => { const p = ring[i]; return unit2([p[0] - cx, 0, p[2] - cz]); });
  // the stair: a ramp of steps winding a third of the way round, up from the ground to the roof
  const a0 = k.stair, turn = Math.min(Math.PI * 0.9, (k.top - g) / r), n = 18;
  const rows = Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (turn * i) / n, y = g + ((k.top - g) * i) / n;
    return [[cx + (r + 0.05) * Math.cos(a), y, cz + (r + 0.05) * Math.sin(a)], [cx + (r + 1.0) * Math.cos(a), y, cz + (r + 1.0) * Math.sin(a)]] as V3[];
  });
  B.tint(0x8f9397);
  loft(B, rows, 'gs-boards', () => UP, 1);
  loft(B, rows, 'rp-steel', () => [0, -1, 0], 1);
  railing(B, rows.map((row) => row[1]), 1.0, (i) => { const p = rows[i][1]; return unit2([p[0] - cx, 0, p[2] - cz]); });
}

// ------------------------------------------------------------------ Värtaverket's chimneys
// The power station's two concrete chimneys south of Ropsten, the tallest things in sight from
// the platforms: the taller, 140.4 m to +160 m, for the flue gases of KVV1, KVV6, KVV8 and VV3,
// a darker grey with a dark steel crown and a gallery under it; the lower, 100 m to +118 m, for
// VV1 and VV2, pale with a dark band at the top (Stockholm Exergi's environmental report for
// 2025; a photograph on Wikimedia Commons, 2017). Where and how wide from OpenStreetMap; each
// narrows a fifth towards its top.
interface Chimney { c: V2; r: number; top: number; wall: number; crown: number; gallery: boolean }
export const CHIMNEYS: Chimney[] = [
  { c: [2508.6, -2440.8], r: 5.3, top: 160, wall: 0x8c867c, crown: 0x55524e, gallery: true },
  { c: [2377.1, -2427.2], r: 4.8, top: 118, wall: 0xc4c0b6, crown: 0x4c4a48, gallery: false },
];

export function buildChimney(B: Builder, ground: Ground, k: Chimney) {
  B.place([0, 0, 0], 0);
  const [cx, cz] = k.c, g = ground(cx, cz) ?? k.top - 140, rt = k.r * 0.8, crown = k.gallery ? 7 : 4.5, seg = 28;
  const rAt = (y: number) => k.r + ((rt - k.r) * (y - g)) / (k.top - g);
  B.tint(k.wall);
  B.lathe(cx, cz, [[k.r, g - 1], [rAt(k.top - crown), k.top - crown]], 'concrete', seg, 6);
  // the crown: a dark band, a little wider, over the gallery's ring and railing
  B.tint(k.crown);
  const rc = rAt(k.top - crown) + 0.25;
  B.lathe(cx, cz, [[rc, k.top - crown], [rc, k.top], [rc - 0.5, k.top], [rc - 0.5, k.top - 2]], 'metal', seg, 2);
  if (k.gallery) {
    const y = k.top - crown, rg = rc + 1.2;
    B.lathe(cx, cz, [[rc, y - 0.6], [rg, y], [rg, y + 0.15], [rc, y + 0.15]], 'metal', seg, 2);
    const ring = circle(k.c, rg - 0.1, seg).map(([x, z]) => v3([x, z], y + 0.15));
    ring.push(ring[0]);
    railing(B, ring, 1.1, (i) => { const p = ring[i]; return unit2([p[0] - cx, 0, p[2] - cz]); });
    // a lower band of the same steel, as on the photograph
    B.lathe(cx, cz, [[rAt(y - 15.2) + 0.12, y - 15.2], [rAt(y - 14) + 0.12, y - 14]], 'metal', seg, 2);
  }
}

// ------------------------------------------------------------------ Värmeverk Ropsten
// Stockholm Exergi's heat-pump plant on the shore north of the station: a long low block of
// white panels with a raised spine down its middle, which comes down at its south end, toward
// the station, as a raked white tower with the plant's name on it in blue (a photograph on
// Wikimedia Commons, 2021). Its outline from OpenStreetMap, which has it 2.4 m east of where
// the laser scan finds its walls, moved back; its heights from the scan: the roof at 12.3 m,
// the spine at 15.4 m, the tower's face from the ground at 3.4 m up to the spine over 6 m.
const VVR_DX = -2.4;
export const VVR_OUTLINE: V2[] = ([[2463.9, -2979.8], [2464.4, -2992.5], [2460, -2992.6], [2461, -3016.6], [2465.4, -3016.5], [2467.9, -3079.4],
  [2486, -3078.7], [2486.5, -3078.7], [2513.7, -3077.6], [2511.2, -3014.6], [2513.6, -3014.5], [2512.6, -2990.3], [2510.3, -2990.4],
  [2509.8, -2977.3], [2490.1, -2978.1], [2483.5, -2979]] as V2[]).map(([x, z]): V2 => [x + VVR_DX, z]);
const VVR_X0 = 2481.0, VVR_X1 = 2487.7, VVR_FOOT = -2972.3, VVR_HEAD = -2978.3, VVR_ROOF = 12.3, VVR_SPINE = 15.4;
addMaterial('rp-vvr1', () => standard(T.letters('VÄRMEVERK', '#2c6cd2'), 0.5, 0, { alphaTest: 0.4 }));
addMaterial('rp-vvr2', () => standard(T.letters('ROPSTEN', '#2c6cd2'), 0.5, 0, { alphaTest: 0.4 }));

export function buildVarmeverk(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  // the block: walls and windows as the city's other buildings near the camera have them
  const wall = new THREE.Color(0xe9ebe8).lerp(new THREE.Color(0xd8d2c8), 0.35);
  buildFacades(B, { kind: 'building', roof: 'flat', bottom: 2.8, top: VVR_ROOF, roofHeight: 0, colour: 0xe9ebe8, roofColour: 0x97999c, wall: 'plain', rings: [VVR_OUTLINE] },
    -1, [wall.r, wall.g, wall.b], { ground, insideOther: () => false });
  B.tint(0x75787c);
  B.cap(VVR_OUTLINE, VVR_ROOF, 'concrete', 6);
  // the spine, along the block (it turns 2.3° from north) and out past its north end
  B.tint(0xe4e4df);
  const [ax, az] = [0.04, -0.999], L = 105;
  B.prism([[VVR_X0, VVR_HEAD], [VVR_X1, VVR_HEAD], [VVR_X1 + ax * L, VVR_HEAD + az * L], [VVR_X0 + ax * L, VVR_HEAD + az * L]] as V2[],
    VVR_ROOF - 0.2, VVR_SPINE, 'concrete', { tile: 3 });
  // the tower: its raked face, from the pavement up to the spine, and its sides
  const g = (ground(VVR_X0, VVR_FOOT + 1) ?? 3.4) - 0.3, back = VVR_HEAD - 1;
  const zAt = (y: number) => VVR_FOOT - (y - 3.4) * ((VVR_HEAD - VVR_FOOT) / (3.4 - VVR_SPINE));
  const N: V3 = [0, -(VVR_HEAD - VVR_FOOT), VVR_SPINE - 3.4], n = N.map((v) => v / Math.hypot(...N)) as V3;
  B.poly([[VVR_X0, g, zAt(g)], [VVR_X1, g, zAt(g)], [VVR_X1, VVR_SPINE, VVR_HEAD], [VVR_X0, VVR_SPINE, VVR_HEAD]], n, 'concrete', 3);
  for (const [x, s] of [[VVR_X0, -1], [VVR_X1, 1]] as const) {
    B.poly([[x, g, zAt(g)], [x, VVR_SPINE, VVR_HEAD], [x, VVR_SPINE, back], [x, g, back]], [s, 0, 0], 'concrete', 3);
  }
  // its panels' joints, every 0.8 m up the face
  B.tint(0xbfc3c2);
  for (let y = g + 0.9; y < VVR_SPINE - 0.3; y += 0.8) {
    const z = zAt(y), o = 0.01;
    B.poly([[VVR_X0 + 0.02, y + n[1] * o, z + n[2] * o], [VVR_X1 - 0.02, y + n[1] * o, z + n[2] * o],
      [VVR_X1 - 0.02, y + 0.05 + n[1] * o, zAt(y + 0.05) + n[2] * o], [VVR_X0 + 0.02, y + 0.05 + n[1] * o, zAt(y + 0.05) + n[2] * o]], n, 'concrete', 3);
  }
  // the name, in two lines on the face
  B.tint([1, 1, 1]);
  const mid = (VVR_X0 + VVR_X1) / 2, w = 3.3, h = 0.52;
  for (const [mat, yc] of [['rp-vvr1', 11.4], ['rp-vvr2', 10.3]] as const) {
    const lo = yc - h * n[2], hi = yc + h * n[2], o = 0.03;
    B.poly([[mid - w, lo + n[1] * o, zAt(lo) + n[2] * o], [mid + w, lo + n[1] * o, zAt(lo) + n[2] * o],
      [mid + w, hi + n[1] * o, zAt(hi) + n[2] * o], [mid - w, hi + n[1] * o, zAt(hi) + n[2] * o]], n, mat, 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  // a mast of aerials on the tower's top
  B.tint(0x9a9ea2);
  const mx = VVR_X1 - 0.8, mz = VVR_HEAD - 3;
  B.box([mx - 0.08, VVR_SPINE, mz - 0.08], [mx + 0.08, VVR_SPINE + 4.2, mz + 0.08], 'metal');
  for (const [dx, dz] of [[0.25, 0], [-0.15, 0.2], [-0.15, -0.2]]) B.box([mx + dx - 0.1, VVR_SPINE + 2.6, mz + dz - 0.1], [mx + dx + 0.1, VVR_SPINE + 3.9, mz + dz + 0.1], 'metal');
}
