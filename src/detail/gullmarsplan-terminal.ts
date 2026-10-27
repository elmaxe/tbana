import * as T from '../textures';
import type { Builder, V2, V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';
import { type Ground } from './gubbangen.ts';
import { barRailing, chainFence, CONCRETE, UNDER } from './farsta-line-north.ts';

// Gullmarsplan's bus terminal: a concrete deck over the metro south of the station, from the ticket
// hall's back (src/open-styles.ts draws the hall) 170 m south to where it comes down to the hill
// south-west of Nynäsvägen. On the deck:
//
// - the buses' lanes, round a long island in the middle with rounded ends;
// - along both sides a glazed gallery, 5 m wide, under a barrel roof of ribbed metal, the buses
//   pulling up to its inner face under a flat canopy; the eastern one 150 m long, the western one
//   in two parts on either side of a notch in the deck's western edge, fenced off as a building
//   site in the laser scan (2021) and in Google's 3D mesh;
// - two round glass pavilions, one at each end of the island, under flat white roofs whose
//   undersides flare out to them like a bell.
//
// Under the deck, among columns, the tracks to Skärmarbrink and Globen leave the station: the
// southbound track to Skärmarbrink runs in the open, falling from the platforms to the gap between
// the terminal and Nynäsvägen's deck (src/detail/farsta-line-north.ts), where it is open to the sky
// for 40 m before it passes under the road; the northbound one and the two to Globen in their boxes.
// The street along the terminal's eastern side is 4 m above the southbound track, behind a
// retaining wall under the deck's edge (data/ground-corrections.json keeps the street level), and
// the eastern gallery overhangs the street on slender columns.
//
// The deck's edges and heights, the galleries' roofs and the pavilions' roofs from Lantmäteriet's
// laser scan (Laserdata Nedladdning, skog, 2021, CC BY 4.0): the deck's top is a gentle curve
// along it (8 cm rms). The galleries' glazing, roofs and columns and the pavilions' shapes from
// Google's 3D mesh; a photograph of the southern pavilion on Wikimedia Commons for its white roof
// and glass. Neither shows the columns under the deck, which stand where the tracks leave room.

// ------------------------------------------------------------------ the frame
// t metres south along the terminal from O, u to the east
const O: V2 = [1290, 3702], D: V2 = [0.3258, 0.9454];
const at = (t: number, u: number): V2 => [O[0] + D[0] * t + D[1] * u, O[1] + D[1] * t - D[0] * u];
const p3 = (t: number, u: number, y: number): V3 => { const [x, z] = at(t, u); return [x, y, z]; };
// a direction in (t, u) in the world
const dir = (dt: number, du: number, y = 0): V3 => [D[0] * dt + D[1] * du, y, D[1] * dt - D[0] * du];

// the deck's top along it (the laser scan's points on it, 8 cm rms), falling more steeply over its
// last 25 m to the street on the hill; the slab under it
const TOP = (t: number) => 47.308 - 0.01137 * t - 0.000017 * t * t - 0.022 * Math.max(0, t - 66);
const SLAB = 1.0;

// its edges, north to south: the east and the west, at (t, u); two points at one t make a step.
// Where a gallery stands on it, its edge is the gallery's outer face.
type Edge = [number, number][];
const EAST: Edge = [
  [-76.3, 16.0], [-48, 16.0], [-44, 14.5], [-32, 14.5], [-24, 15.2], [-8, 14.8], [24, 14.5], [44, 14.3], [46, 12.8], [72, 12.5],
  [73.5, 12.4], [75, 8.8], [81, 8.5], [84, 10.8], [91, 11.0],
];
const WEST: Edge = [
  [-76.3, -38.3], [-46, -38.4], [-46, -17.5], [-29, -17.5], [-29, -38.5], [44, -38.8], [48, -36.5], [52, -37], [56, -40], [62, -46],
  [76, -27], [80, -12], [86, -4], [91, 0],
];
export const TERMINAL_ANCHOR: V2 = at(0, -10);
export const TERMINAL_OUTLINE: V2[] = [...EAST, ...[...WEST].reverse()].map(([t, u]) => at(t, u));

// the edge's u at t, just after it (or, `after` false, just before it)
function edge(e: Edge, t: number, after = true): number {
  for (let i = 0; i + 1 < e.length; i++) {
    const [a, ua] = e[i], [b, ub] = e[i + 1];
    if (b === a) continue;
    if ((t > a && t < b) || (t === a && after) || (t === b && !after)) return ua + ((ub - ua) * (t - a)) / (b - a);
  }
  return t <= e[0][0] ? e[0][1] : e[e.length - 1][1];
}
// the points along t from t0 to t1: the edges' corners between them, and a point every `every` m
function along(t0: number, t1: number, every: number, e: Edge[] = [EAST, WEST]): number[] {
  const ts = new Set<number>([t0, t1]);
  for (const x of e) for (const [t] of x) if (t > t0 && t < t1) ts.add(t);
  const s = [...ts].sort((a, b) => a - b), out: number[] = [];
  for (let i = 0; i + 1 < s.length; i++) {
    const n = Math.max(1, Math.ceil((s[i + 1] - s[i]) / every));
    for (let k = 0; k < n; k++) out.push(s[i] + ((s[i + 1] - s[i]) * k) / n);
  }
  out.push(t1);
  return out;
}

// the galleries: the length of each along its edge, its width, and its roof's: from the inner
// face to the outer, and its eaves; the glazing to the roof's springing, the barrel's rise, the
// canopy's reach inwards over the buses' kerb and its height
const GALLERIES: { side: 1 | -1; from: number; to: number }[] = [
  { side: 1, from: -76.3, to: 73.5 }, { side: -1, from: -76.3, to: -46 }, { side: -1, from: -29, to: 44 },
];
const GALLERY = { width: 5.0, eaves: 0.3, spring: 3.0, rise: 1.25, canopy: 3.6, canopyAt: 3.05 };
// the buses' kerbs along the galleries, inside them, and the island between the lanes: its sides
// (u), and its ends, rounded; the kerbs' height
const KERB_WIDTH = 2.0, ISLAND = { lo: -20.5, hi: -3.5, from: 0.5, to: 69.5 }, KERB_H = 0.15;
// the pavilions: middle, radius; the glass drum's radius and height, the roof's underside flaring
// out to its edge (how far out, of the way from the drum to the edge, at each height), the fascia
const PAVILIONS: { c: V2; r: number }[] = [{ c: [1261.76, 3654.93], r: 9.97 }, { c: [1296.01, 3758.89], r: 10.14 }];
const DRUM = { r: 7.3, h: 3.2 }, FLARE: V2[] = [[0, 3.2], [0.05, 3.6], [0.2, 4.0], [0.45, 4.35], [0.75, 4.6], [1, 4.75]], FASCIA = [4.75, 5.25];
// the columns under the deck, (t, u): in rows 10 m apart, where the tracks and their boxes leave
// 3 m or more (3.5 m from a box's track; never between the boxes' two tracks to Globen)
const COLUMNS: V2[] = [
  [-68, -30], [-68, -25], [-68, -17], [-68, -1], [-58, -30], [-58, -25], [-58, -17], [-58, -1], [-48, -7], [-48, -1], [-38, -9], [-38, -1],
  [-28, -9], [-28, -1], [-18, -34], [-18, -15], [-18, -9], [-18, -1], [-18, 8], [-8, -33], [-8, -17], [-8, -9], [-8, -1], [-8, 8], [2, -36],
  [2, -17], [2, -9], [2, -1], [2, 8], [12, -25], [12, -17], [12, -9], [12, -1], [12, 8], [22, -33], [22, -25], [22, -9], [22, -1], [22, 8],
  [32, -33], [32, -25], [32, -17], [32, -8], [32, -1], [42, -33], [42, -25], [42, -17], [42, -12], [42, -1], [42, 5], [52, -33], [52, -25],
  [52, -17], [52, -9], [52, 7], [62, -33], [62, -25], [62, -17], [62, -9], [62, -1], [62, 9], [72, -25], [72, -17], [72, -9], [72, -1], [72, 7],
  [82, -1], [82, 6], [48, -35.9], [56, -39.4], [60, -43.4],
];
// the galleries' slender columns at their outer faces, t: down to the street, the gap or the ground
const GALLERY_COLUMNS: Record<1 | -1, number[]> = {
  1: [-71, -61, -51, -41, -31, -21, -11, -1, 9, 19, 29, 39, 45, 59, 67],
  [-1]: [-71, -61, -51, -27, -21, -11, -1, 7, 31, 39],
};
// the street and its pavement along the deck's eastern side, by t (the laser scan's ground points
// under and beside the gallery), and the hill south of the deck
const STREET: V2[] = [
  [-76.3, 38.2], [-64, 38.4], [-52, 38.65], [-40, 38.85], [-28, 39.05], [-16, 39.3], [-4, 39.55], [8, 39.85], [20, 40.0], [26, 40.1],
  [32, 40.3], [38, 40.4], [44, 40.5],
];
const street = (t: number) => edge(STREET, t);
const hill = (t: number) => 45.6 - 0.03 * (t - 90);
// the retaining walls, each (t, u) along it with the low side on its left as seen from above, and
// its top by t: between the street and the southbound track under the deck's eastern edge, turning
// out to Nynäsvägen's wall where the gap opens, a parapet a metre over the pavement; and down from
// the deck's edge and the hill south of it into the gap
const WALLS: { pts: V2[]; top: (t: number) => number }[] = [
  { pts: [[42.5, 19.6], [41, 17.4], [36, 14.8], [33, 13.3], [30, 12.6], [24, 11.8], [-76.3, 11.8]], top: (t) => street(t) + 1.0 },
  { pts: [[75, 8.8], [81, 8.5], [84, 10.8], [91, 11.0], [112, 11.5]], top: (t) => (t < 91 ? TOP(t) - SLAB : hill(t) + 1.0) },
];
// the pavement along the first, out from its face
const PAVEMENT = 3.5;
// Before the first, the city's ground climbs to the street behind it across its 5 m grid, so that
// it rises in steps along the wall's foot. Over it a slope of concrete from the track's side to
// the wall: as steep as the ground across (`slope`, height over width), and high enough at the
// wall to stay over it for `smooth` metres either way, but clear of the southbound track (its
// centre line at (t, u) and its rails' height, from public/data/track-geometry.json) by `clear`
// metres beside its rails.
const BANK = { slope: 0.75, smooth: 5, clear: 2.4 };
// The same before Nynäsvägen's wall along the gap's eastern side (src/detail/farsta-line-north.ts),
// from its deck south of the gap to where the first wall meets it: its line a wall's half width in
// from its face, and its kerb's height.
const BANKS: { pts: V2[]; top: (t: number) => number }[] = [
  WALLS[0],
  { pts: [[51.6, 19.98], [42.5, 20.08]], top: (t) => 39.58 + 0.02325 * t },
];
const SOUTHBOUND: [number, number, number][] = [
  [-80, 5.6, 37.27], [-66.3, 5.8, 37.07], [-56.8, 6.9, 36.93], [-46.8, 6.1, 36.79], [-36.9, 5.6, 36.65], [-27, 5.1, 36.52], [-17.1, 4.7, 36.38],
  [-7.2, 4.3, 36.24], [2.7, 4.0, 36.1], [12.5, 4.1, 35.96], [22.3, 4.7, 35.82], [31.9, 6.0, 35.7], [41.3, 8.3, 35.63], [50.4, 11.5, 35.56],
];
// the stairs down from the eastern gallery to the street beside it, each glazed, in a straight
// flight along the gallery's outer face: t at its top and at its foot, and its width
const STAIRS: { top: number; foot: number }[] = [{ top: 23, foot: 10 }, { top: -64, foot: -75.5 }];
const STAIR = { width: 2.6, rise: 0.17, head: 2.5 };
// over the northbound track's box where it comes out into the gap: the wall over its mouth, from
// the box's roof to the deck
const MOUTH: { from: V2; to: V2; roof: number } = { from: [74.2, 9.3], to: [70.8, 14.1], roof: 40.2 };

const GLASS = 0xffffff, ROOF = 0xc4c8cb, CANOPY = 0xe2e4e3, FASCIA_WHITE = 0xebe9e3, PAVING = 0xcbc6be, ASPHALT = 0x68696a, POSTS = 0xd9dbda;
const FOOTWAY = 0x76777a, MEMBRANE = 0x8a8d8f;

addMaterial('gm-glass', () => standard(T.curtainWall({ spandrel: '#8d989d', share: 0, tint: null, frame: '#c8cdcf', mullion: 5 }), 0.25, 0.1));

export function buildTerminal(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const groundAt = (t: number, u: number, fall: number) => ground(...at(t, u)) ?? fall;

  // ---------------------------------------------------------------- the deck
  const ts = along(-76.3, 91, 6);
  for (let i = 0; i + 1 < ts.length; i++) {
    const a = ts[i], b = ts[i + 1];
    const q: V2[] = [[a, edge(WEST, a)], [b, edge(WEST, b, false)], [b, edge(EAST, b, false)], [a, edge(EAST, a)]];
    B.tint(ASPHALT);
    B.poly(q.map(([t, u]) => p3(t, u, TOP(t))), [0, 1, 0], 'rp-asphalt', 6);
    B.tint(UNDER);
    B.poly(q.map(([t, u]) => p3(t, u, TOP(t) - SLAB)), [0, -1, 0], 'fl-under', 3);
  }
  // its edges, all round
  const ring: V2[] = [...EAST, ...[...WEST].reverse()];
  B.tint(CONCRETE);
  for (let i = 0; i < ring.length; i++) {
    const [ta, ua] = ring[i], [tb, ub] = ring[(i + 1) % ring.length];
    if (Math.hypot(tb - ta, ub - ua) < 1e-6) continue;
    // outward: the edge turned a quarter towards the west as it runs south, round the ring
    const n = dir(-(ub - ua), tb - ta);
    B.poly([p3(ta, ua, TOP(ta) - SLAB), p3(tb, ub, TOP(tb) - SLAB), p3(tb, ub, TOP(tb) + 0.05), p3(ta, ua, TOP(ta) + 0.05)], n, 'concrete', 3);
  }

  // ---------------------------------------------------------------- the columns under it
  B.tint(CONCRETE);
  for (const [t, u] of COLUMNS) {
    const [x, z] = at(t, u), top = TOP(t) - SLAB, foot = groundAt(t, u, top - 11) - 0.4;
    if (foot > top - 1.5) continue;
    B.lathe(x, z, [[0.4, foot], [0.4, top - 0.9], [0.95, top - 0.2], [0.95, top]], 'concrete', 12);
  }
  B.tint(POSTS);
  for (const side of [1, -1] as const) {
    for (const t of GALLERY_COLUMNS[side]) {
      const u = edge(side === 1 ? EAST : WEST, t) - side * 0.6, [x, z] = at(t, u), top = TOP(t) - SLAB;
      const foot = groundAt(t, u, top - 9) - 0.3;
      B.lathe(x, z, [[0.24, foot], [0.24, top]], 'metal', 10);
    }
  }

  // ---------------------------------------------------------------- the retaining walls
  for (const [k, w] of WALLS.entries()) wall(B, w.pts, w.top, k === 0 ? PAVEMENT : 0, groundAt);
  for (const b of BANKS) bank(B, b.pts, b.top, groundAt);
  // over the box's mouth
  {
    const [a, b] = [MOUTH.from, MOUTH.to], n = dir(b[1] - a[1], -(b[0] - a[0]));
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), m: V2 = [-(b[1] - a[1]) / len * 0.25, (b[0] - a[0]) / len * 0.25];
    B.tint(CONCRETE);
    for (const k of [1, -1]) {
      const pa: V2 = [a[0] + m[0] * k, a[1] + m[1] * k], pb: V2 = [b[0] + m[0] * k, b[1] + m[1] * k];
      B.poly([p3(...pa, MOUTH.roof), p3(...pb, MOUTH.roof), p3(...pb, TOP(pb[0]) - SLAB), p3(...pa, TOP(pa[0]) - SLAB)],
        [n[0] * -k, 0, n[2] * -k], 'concrete', 3);
    }
  }

  // ---------------------------------------------------------------- the kerbs and the island
  B.tint(PAVING);
  for (const g of GALLERIES) {
    const e = g.side === 1 ? EAST : WEST, inner = (t: number, after = true) => edge(e, t, after) - g.side * GALLERY.width;
    strip(B, along(g.from, g.to, 6, [e]), (t, af) => inner(t, af), (t, af) => inner(t, af) - g.side * KERB_WIDTH, g.side === 1);
  }
  island(B);

  // ---------------------------------------------------------------- the galleries
  for (const g of GALLERIES) gallery(B, g.side, g.from, g.to);

  for (const s of STAIRS) stair(B, s.top, s.foot, groundAt);

  // ---------------------------------------------------------------- the pavilions
  for (const p of PAVILIONS) pavilion(B, p.c, p.r);

  // ---------------------------------------------------------------- railings and fences
  // along the deck's free edges: the east beyond the gallery, the west south of it
  B.tint(0x5d6265);
  const feet = (e: Edge, t0: number, t1: number, inset: number) =>
    along(t0, t1, 2.5, [e]).map((t) => { const u = edge(e, t, t < t1) + inset; return p3(t, u, TOP(t)); });
  barRailing(B, feet(EAST, 73.5, 91, -0.25), 1.1);
  barRailing(B, feet(WEST, 44, 62, 0.25), 1.1);
  // round the notch: a building site's fence
  const notch: V2[] = [[-46, -38.4], [-46, -17.5], [-29, -17.5], [-29, -38.5]];
  const fence: V3[] = [];
  for (let i = 0; i + 1 < notch.length; i++) {
    const [a, b] = [notch[i], notch[i + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
    for (let k = i ? 1 : 0; k <= n; k++) {
      const t = a[0] + ((b[0] - a[0]) * k) / n, u = a[1] + ((b[1] - a[1]) * k) / n;
      // set back from the edge into the deck
      const tt = t + (i === 0 ? -0.4 : i === 2 ? 0.4 : 0), uu = u + (i === 1 ? 0.4 : 0);
      fence.push(p3(tt, uu, TOP(tt)));
    }
  }
  chainFence(B, fence, 2.0);
}

// A strip of paving a kerb high along the deck, between two edges at t (each just after or before
// it), from t to t.
function strip(B: Builder, ts: number[], lo: (t: number, after: boolean) => number, hi: (t: number, after: boolean) => number, east: boolean) {
  for (let i = 0; i + 1 < ts.length; i++) {
    const a = ts[i], b = ts[i + 1];
    const q: V2[] = [[a, lo(a, true)], [b, lo(b, false)], [b, hi(b, false)], [a, hi(a, true)]];
    B.tint(PAVING);
    B.poly(q.map(([t, u]) => p3(t, u, TOP(t) + KERB_H)), [0, 1, 0], 'rp-paving', 3);
    // the kerb's face towards the lanes
    B.tint(CONCRETE);
    B.poly([p3(a, q[3][1], TOP(a) - 0.05), p3(b, q[2][1], TOP(b) - 0.05), p3(b, q[2][1], TOP(b) + KERB_H), p3(a, q[3][1], TOP(a) + KERB_H)],
      dir(0, east ? -1 : 1), 'concrete', 2);
  }
}

// The island between the lanes: straight sides, half-round ends, a kerb high.
function island(B: Builder) {
  const { lo, hi, from, to } = ISLAND, r = (hi - lo) / 2, mid = (lo + hi) / 2;
  const outline: V2[] = [];
  for (let k = 0; k <= 12; k++) { const a = Math.PI * (k / 12); outline.push([from - Math.sin(a) * r, mid - Math.cos(a) * r]); }
  for (let k = 0; k <= 12; k++) { const a = Math.PI * (k / 12); outline.push([to + Math.sin(a) * r, mid + Math.cos(a) * r]); }
  // its top in strips across, and its kerb all round
  const ts = along(from - r, to + r, 4, []);
  const side = (t: number, s: 1 | -1) => {
    const e = t < from ? Math.sqrt(Math.max(0, r * r - (from - t) ** 2)) : t > to ? Math.sqrt(Math.max(0, r * r - (t - to) ** 2)) : r;
    return mid + s * e;
  };
  B.tint(PAVING);
  for (let i = 0; i + 1 < ts.length; i++) {
    const a = ts[i], b = ts[i + 1];
    B.poly([p3(a, side(a, -1), TOP(a) + KERB_H), p3(b, side(b, -1), TOP(b) + KERB_H), p3(b, side(b, 1), TOP(b) + KERB_H), p3(a, side(a, 1), TOP(a) + KERB_H)],
      [0, 1, 0], 'rp-paving', 3);
  }
  B.tint(CONCRETE);
  for (let i = 0; i < outline.length; i++) {
    const [ta, ua] = outline[i], [tb, ub] = outline[(i + 1) % outline.length];
    B.poly([p3(ta, ua, TOP(ta) - 0.05), p3(tb, ub, TOP(tb) - 0.05), p3(tb, ub, TOP(tb) + KERB_H), p3(ta, ua, TOP(ta) + KERB_H)], dir(-(ub - ua), tb - ta), 'concrete', 2);
  }
}

// A gallery along the deck's edge on `side` (1 east, -1 west), from t0 to t1: glass walls on its
// outer and inner faces and across its ends, the barrel roof over it, and the canopy over the kerb.
function gallery(B: Builder, side: 1 | -1, t0: number, t1: number) {
  const e = side === 1 ? EAST : WEST, G = GALLERY;
  const ts = along(t0, t1, 3, [e]);
  // u across it, from its outer face inwards
  const outer = (t: number, after: boolean) => edge(e, t, after);
  const U = (t: number, after: boolean, d: number) => outer(t, after) - side * d;
  // the roof's section: from the outer eaves to the inner, [d in from the outer face, height]
  const N = 10, w = G.width + 2 * G.eaves;
  const section: V2[] = Array.from({ length: N + 1 }, (_, k) => { const f = k / N; return [-G.eaves + w * f, G.spring + G.rise * (1 - (2 * f - 1) ** 2)]; });
  let run = 0;
  for (let i = 0; i + 1 < ts.length; i++) {
    const a = ts[i], b = ts[i + 1];
    const la = Math.hypot(b - a, outer(b, false) - outer(a, true));
    // the glass, outer and inner
    B.tint(GLASS);
    for (const d of [0.15, G.width]) {
      const pa = U(a, true, d), pb = U(b, false, d);
      const n = dir(-(pb - pa) * side, (b - a) * side);
      B.poly([p3(a, pa, TOP(a)), p3(b, pb, TOP(b)), p3(b, pb, TOP(b) + G.spring), p3(a, pa, TOP(a) + G.spring)], d < 1 ? n : [-n[0], 0, -n[2]], 'gm-glass', 1,
        [[run / 6, 0], [(run + la) / 6, 0], [(run + la) / 6, 0.25], [run / 6, 0.25]]);
    }
    // the roof, above and below
    B.tint(ROOF);
    let arc = 0;
    for (let k = 0; k < N; k++) {
      const [d0, h0] = section[k], [d1, h1] = section[k + 1];
      const pts = [p3(a, U(a, true, d0), TOP(a) + h0), p3(b, U(b, false, d0), TOP(b) + h0), p3(b, U(b, false, d1), TOP(b) + h1), p3(a, U(a, true, d1), TOP(a) + h1)];
      const l = Math.hypot(d1 - d0, h1 - h0), up = dir(0, side * (h1 - h0)), n: V3 = [up[0], d1 - d0, up[2]];
      const uv: V2[] = [[run / 4, arc / 4], [(run + la) / 4, arc / 4], [(run + la) / 4, (arc + l) / 4], [run / 4, (arc + l) / 4]];
      B.poly(pts, n, 'roof', 4, uv);
      B.poly(pts, [-n[0], -n[1], -n[2]], 'roof', 4, uv);
      arc += l;
    }
    // the canopy over the kerb, inside the inner eaves
    B.tint(CANOPY);
    const c0 = G.width + G.eaves, c1 = G.width + G.canopy, y = G.canopyAt;
    const cq = [p3(a, U(a, true, c0), TOP(a) + y), p3(b, U(b, false, c0), TOP(b) + y), p3(b, U(b, false, c1), TOP(b) + y), p3(a, U(a, true, c1), TOP(a) + y)];
    B.poly(cq, [0, 1, 0], 'metal', 4);
    B.poly(cq.map(([x, yy, z]): V3 => [x, yy - 0.18, z]), [0, -1, 0], 'metal', 4);
    B.poly([cq[3], cq[2], [cq[2][0], cq[2][1] - 0.18, cq[2][2]], [cq[3][0], cq[3][1] - 0.18, cq[3][2]]], dir(0, -side), 'metal', 4);
    run += la;
  }
  // the ends: glass across, the roof's section over it, and the canopy's
  for (const [t, after, s] of [[t0, true, -1], [t1, false, 1]] as [number, boolean, number][]) {
    const n = dir(s, 0);
    B.tint(GLASS);
    B.poly([p3(t, U(t, after, 0.15), TOP(t)), p3(t, U(t, after, G.width), TOP(t)), p3(t, U(t, after, G.width), TOP(t) + G.spring), p3(t, U(t, after, 0.15), TOP(t) + G.spring)],
      n, 'gm-glass', 1, [[0, 0], [G.width / 6, 0], [G.width / 6, 0.25], [0, 0.25]]);
    B.tint(ROOF);
    const pts = section.map(([d, h]) => p3(t, U(t, after, d), TOP(t) + h));
    for (let k = 1; k + 1 < pts.length; k++) B.poly([pts[0], pts[k], pts[k + 1]], n, 'roof', 4);
    B.tint(CANOPY);
    const c0 = G.width + G.eaves, c1 = G.width + G.canopy, y = TOP(t) + G.canopyAt;
    B.poly([p3(t, U(t, after, c0), y), p3(t, U(t, after, c1), y), p3(t, U(t, after, c1), y - 0.18), p3(t, U(t, after, c0), y - 0.18)], n, 'metal', 4);
  }
}

// A stair outside the eastern gallery, from the deck at t0 down to the street at t1 (north of it):
// concrete steps on a sloping slab between glass walls, under a sloping roof.
function stair(B: Builder, t0: number, t1: number, groundAt: (t: number, u: number, fall: number) => number) {
  const u0 = Math.max(edge(EAST, t0), edge(EAST, t1)) + 0.1, w = STAIR.width, L = t0 - t1;
  const yTop = TOP(t0), yFoot = Math.max(groundAt(t1 - 0.5, u0 + w / 2, yTop - 8), street(t1)), n = Math.max(1, Math.round((yTop - yFoot) / STAIR.rise));
  const rise = (yTop - yFoot) / n, going = L / n;
  const o = p3(t1, u0, 0), h = dir(1, 0), across = dir(0, 1);
  B.tint(CONCRETE);
  for (let k = 0; k < n; k++) B.wallBox(o, h, across, k * going, (k + 1) * going, yFoot + k * rise - 0.35, yFoot + (k + 1) * rise, 0, w, 'concrete', 2);
  // the walls and the roof: from its foot up to the deck
  const P = (a: number, d: number, y: number) => p3(t1 + a, u0 + d, y);
  B.tint(GLASS);
  for (const [d, s] of [[0, -1], [w, 1]] as [number, number][]) {
    B.poly([P(0, d, yFoot), P(L, d, yTop), P(L, d, yTop + STAIR.head), P(0, d, yFoot + STAIR.head)], dir(0, s), 'gm-glass', 1,
      [[0, 0], [L / 6, (yTop - yFoot) / 12], [L / 6, (yTop - yFoot + STAIR.head) / 12], [0, STAIR.head / 12]]);
  }
  B.poly([P(0, 0, yFoot), P(0, w, yFoot), P(0, w, yFoot + STAIR.head), P(0, 0, yFoot + STAIR.head)], dir(-1, 0), 'gm-glass', 1,
    [[0, 0], [w / 6, 0], [w / 6, STAIR.head / 12], [0, STAIR.head / 12]]);
  B.tint(ROOF);
  const roof = [P(0, -0.15, yFoot + STAIR.head), P(L, -0.15, yTop + STAIR.head), P(L, w + 0.15, yTop + STAIR.head), P(0, w + 0.15, yFoot + STAIR.head)];
  const up: V3 = [-dir(1, 0)[0] * (yTop - yFoot), L, -dir(1, 0)[2] * (yTop - yFoot)];
  B.poly(roof, up, 'roof', 4);
  B.poly(roof, [-up[0], -up[1], -up[2]], 'roof', 4);
}

// A pavilion on the deck: a round glass drum under a white flat roof, its underside flaring out
// from the drum to the roof's edge, with a deep fascia.
function pavilion(B: Builder, c: V2, r: number) {
  const t = (c[0] - O[0]) * D[0] + (c[1] - O[1]) * D[1], y0 = TOP(t) - 0.15;
  // the drum, its panes 1.5 m wide
  const n = 32, h = DRUM.h;
  B.tint(GLASS);
  for (let k = 0; k < n; k++) {
    const a0 = (2 * Math.PI * k) / n, a1 = (2 * Math.PI * (k + 1)) / n, am = (a0 + a1) / 2;
    const P = (a: number, y: number): V3 => [c[0] + DRUM.r * Math.cos(a), y, c[1] + DRUM.r * Math.sin(a)];
    const s0 = (DRUM.r * a0) / 6, s1 = (DRUM.r * a1) / 6, lift = 0.15 / 12;
    B.poly([P(a0, y0), P(a1, y0), P(a1, y0 + h), P(a0, y0 + h)], [Math.cos(am), 0, Math.sin(am)], 'gm-glass', 1,
      [[s0, lift], [s1, lift], [s1, 0.25 + lift], [s0, 0.25 + lift]]);
  }
  // the roof's underside, out from the drum to the edge, and its fascia and top
  B.tint(0xd6d8d8);
  const span = r - DRUM.r;
  B.lathe(c[0], c[1], FLARE.map(([f, y]): V2 => [DRUM.r + span * f, y0 + y]), 'metal', 40);
  B.tint(FASCIA_WHITE);
  B.lathe(c[0], c[1], [[r, y0 + FASCIA[0]], [r, y0 + FASCIA[1]]], 'concrete', 40);
  B.tint(MEMBRANE);
  B.lathe(c[0], c[1], [[r, y0 + FASCIA[1]], [r - 0.3, y0 + FASCIA[1]], [0, y0 + FASCIA[1] + 0.12]], 'roof', 40);
}

// A retaining wall along (t, u) points, 0.5 m thick, from below the ground on its low side up to
// `top`; and on its high side a pavement `pavement` m wide, at the street's height (or over the
// city's ground, where its 5 m grid slopes down to the track across the wall).
// points every `every` metres or less along a wall, each with the way to its low side
type Foot = { p: V2; n: V2 };
function feetAlong(pts: V2[], every = 3) {
  const feet: Foot[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [a, b] = [pts[i], pts[i + 1]], l = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(l / every));
    // the low side: to the left of the way along, as seen from above
    const n: V2 = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    for (let j = i ? 1 : 0; j <= k; j++) feet.push({ p: [a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k], n });
  }
  return feet;
}
const off = (f: Foot, d: number): V2 => [f.p[0] + f.n[0] * d, f.p[1] + f.n[1] * d];

function wall(B: Builder, pts: V2[], top: (t: number) => number, pavement: number, groundAt: (t: number, u: number, fall: number) => number) {
  const feet = feetAlong(pts);
  const H = feet.map((f) => {
    const lowY = groundAt(...off(f, 1.2), 35), highY = groundAt(...off(f, -1.2), lowY + 4);
    return { bottom: Math.min(lowY, highY) - 0.5, top: top(f.p[0]) };
  });
  B.tint(CONCRETE);
  for (let i = 0; i + 1 < feet.length; i++) {
    const [fa, fb] = [feet[i], feet[i + 1]], [ha, hb] = [H[i], H[i + 1]];
    for (const s of [1, -1]) {
      B.poly([p3(...off(fa, 0.25 * s), ha.bottom), p3(...off(fb, 0.25 * s), hb.bottom), p3(...off(fb, 0.25 * s), hb.top), p3(...off(fa, 0.25 * s), ha.top)],
        dir(fa.n[0] * s, fa.n[1] * s), 'concrete', 3);
    }
    B.poly([p3(...off(fa, 0.25), ha.top), p3(...off(fb, 0.25), hb.top), p3(...off(fb, -0.25), hb.top), p3(...off(fa, -0.25), ha.top)], [0, 1, 0], 'concrete', 3);
  }
  if (!pavement) return;
  // the pavement, in strips across
  B.tint(FOOTWAY);
  const across = [0.25, 1.25, 2.25, pavement];
  const y = (f: Foot, d: number) => { const q = off(f, -d); return Math.max(street(f.p[0]) + 0.02, groundAt(...q, 0) + 0.05); };
  for (let i = 0; i + 1 < feet.length; i++) {
    const [fa, fb] = [feet[i], feet[i + 1]];
    for (let k = 0; k + 1 < across.length; k++) {
      const [d0, d1] = [across[k], across[k + 1]];
      B.poly([p3(...off(fa, -d0), y(fa, d0)), p3(...off(fb, -d0), y(fb, d0)), p3(...off(fb, -d1), y(fb, d1)), p3(...off(fa, -d1), y(fa, d1))], [0, 1, 0], 'rp-asphalt', 6);
    }
  }
}

// the slope of concrete before a wall (BANK, BANKS)
function bank(B: Builder, pts: V2[], top: (t: number) => number, groundAt: (t: number, u: number, fall: number) => number) {
  const feet = feetAlong(pts, 1), K = BANK.slope;
  const across = Array.from({ length: 27 }, (_, k) => 0.25 + 0.25 * k);
  const rows = feet.map((f) => {
    const g = across.map((d) => groundAt(...off(f, d), 0));
    // the ground before the track, and how high at the wall's face the slope must start to pass over the rest
    const floor = Math.min(...g.filter((_, k) => across[k] >= 2.5));
    let need = floor;
    g.forEach((y, k) => { if (y > floor + 0.15) need = Math.max(need, y + 0.05 + K * (across[k] - 0.25)); });
    // and how high it may start: down to the rails' height `clear` from the track's middle
    const [d, rail] = toTrack(f);
    return { floor, need, most: Math.min(top(f.p[0]) - 0.3, rail - 0.1 + K * (d - BANK.clear - 0.25)) };
  });
  const near = (i: number) => rows.slice(Math.max(0, i - BANK.smooth), i + BANK.smooth + 1);
  const high = rows.map((_, i) => Math.max(...near(i).map((r) => r.need)));
  const y0 = rows.map((r, i) => {
    const run = high.slice(Math.max(0, i - BANK.smooth), i + BANK.smooth + 1);
    return Math.min(r.most, Math.max(r.need, run.reduce((a, b) => a + b, 0) / run.length));
  });
  // down to under the floor
  const edge = rows.map((r, i) => ({ y: y0[i], d: 0.25 + (y0[i] - r.floor + 0.3) / K, low: r.floor - 0.3 }));
  B.tint(UNDER);
  for (let i = 0; i + 1 < feet.length; i++) {
    const [fa, fb] = [feet[i], feet[i + 1]], [ea, eb] = [edge[i], edge[i + 1]];
    B.poly([p3(...off(fa, 0.25), ea.y), p3(...off(fb, 0.25), eb.y), p3(...off(fb, eb.d), eb.low), p3(...off(fa, ea.d), ea.low)],
      dir(fa.n[0] * K, fa.n[1] * K, 1), 'concrete', 3);
  }
  // its ends
  for (const [i, j] of [[0, 1], [feet.length - 1, feet.length - 2]]) {
    const f = feet[i], e = edge[i], [ti, ui] = f.p, [tj, uj] = feet[j].p;
    B.poly([p3(...off(f, 0.25), e.y), p3(...off(f, e.d), e.low), p3(...off(f, 0.25), e.low)], dir(ti - tj, ui - uj), 'concrete', 3);
  }
}
// across from a wall's foot to the southbound track's middle, and its rails' height there
function toTrack(f: Foot): [number, number] {
  let best: [number, number] = [Infinity, 0];
  for (let k = 0; k + 1 < SOUTHBOUND.length; k++) {
    const [a, b] = [SOUTHBOUND[k], SOUTHBOUND[k + 1]];
    // where the line from the foot along its low side meets this piece of the track
    const et = b[0] - a[0], eu = b[1] - a[1], den = f.n[0] * eu - f.n[1] * et;
    if (Math.abs(den) < 1e-9) continue;
    const wt = a[0] - f.p[0], wu = a[1] - f.p[1];
    const d = (wt * eu - wu * et) / den, s = (wt * f.n[1] - wu * f.n[0]) / den;
    if (s >= 0 && s <= 1 && d > 0 && d < best[0]) best = [d, a[2] + (b[2] - a[2]) * s];
  }
  return best;
}
