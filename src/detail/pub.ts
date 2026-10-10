import * as THREE from 'three';
import * as T from '../textures';
import { type Builder, type V2, type V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';
import { wallWithOpenings, type Opening, type WallStyle } from './wall.ts';

// PUB, Paul U. Bergström's department store on the west side of Hötorget (since 2016 the hotel
// Haymarket by Scandic): one block in OpenStreetMap, but six buildings of 1912–37 grown together
// round a copper top storey with a glass pyramid on it.
// - On Hötorget (Edvard Bernhard, 1924–25, facades reworked by Hakon Ahlberg): twelve bays of
//   salmon-pink plaster between giant pilasters of grey stone, four storeys under the cornice, a
//   stone-clad ground floor of shop windows and a hotel canopy, and a copper mansard with four big
//   dormers. It wraps round onto Gamla Brogatan, where a pink tower with a copper lantern stands
//   behind the eaves.
// - At the corner of Kungsgatan (Cyrillus Johansson, 1915–17): pink too, its tall stepped gable
//   to the square; on Kungsgatan a mansard with small dormers and a dark storey over it.
// - At Kungsgatan and Drottninggatan (Ove Gormsen, 1929–30): modernist, white marble, ribbon
//   windows, a stair tower at the corner rising two storeys higher, and storeys set back over it.
// - Along Drottninggatan and Gamla Brogatan (1912–14 refaced 1929–30, and Artur von Schmalensee,
//   1936–37): a white band of four storeys of ribbon windows over dark granite shop fronts and a
//   canopy, and over it four pink storeys stepping back, each behind a terrace.
//
// Heights from Lantmäteriet's laser scan (Laserdata Nedladdning, skog, CC BY 4.0; RH 2000), where
// the city had the block as one gabled roof 45 m high; storeys, bays and colours from Google's 3D
// mesh of the city and photographs on Wikimedia Commons; history from Swedish Wikipedia. The walls
// stand where the laser scan has them, 1–2 m outside OSM's outline on Kungsgatan and Gamla
// Brogatan. Frame: x across the block to the east-north-east (Hötorget), z along it to the
// south-south-east (Kungsgatan at −z), y up; metres.

const AT: V2 = [119, -344], TURN = (26 * Math.PI) / 180, C = Math.cos(TURN), S = Math.sin(TURN);
const world = ([x, z]: V2): V2 => [AT[0] + x * C + z * S, AT[1] - x * S + z * C];

// the block's walls
const X0 = -23.6, X1 = 23.8, Z0 = -29.0, Z1 = 29.3;
// where the buildings meet: Gormsen | Cyrillus Johansson along Kungsgatan (x), the white band and
// Bernhard's (x), Cyrillus Johansson | Bernhard along Hötorget (z), Gormsen | the white band (z)
const CYRILLUS_X = -2.5, BERNHARD_X = 4.5, CYRILLUS_Z = -17, GORMSEN_Z = -8;

// heights (RH 2000)
const EAVES = 33.0;                     // Bernhard's and Cyrillus Johansson's cornices
const SHOPS = 14.3, STOREY = 3.2;       // the white buildings' ground floor, and their storeys
const MANSARD: V2[] = [[0, EAVES], [4.5, 38.2], [8.8, 40.3]]; // in from the eaves, up
const RIDGE = 39.7, RIDGE_Z = -23;     // Cyrillus Johansson's roof behind the gable
const CORE = 43.3, PYRAMID = 48.0;     // the copper top storey, the glass pyramid's tip
const TOWER_TOP = 42.0, LANTERN = 47.1; // the pink tower's shaft and its copper lantern

const PINK = 0xf6c3ad, PINK_CY = 0xf7c9b5, STEP_PINK = 0xf0baa4, STONE = 0xdcd8cc, GRANITE = 0x7e4a40;
const MARBLE = 0xf3f1eb, DARK = 0x9aa0a4, SLATE = 0x8a8f92, CANOPY = 0x37312d, COPPER = 0xffffff, GOLD = 0xd0a64e;

addMaterial('marble', () => standard(T.marble(), 0.65));
// Gormsen's ribbon windows have dark green frames
addMaterial('ribbon', () => standard(T.detailWindow('#3f4d46'), 0.5));
addMaterial('pubglass', () => standard(T.curtainWall({ spandrel: '#8a9aa2', share: 0.02, tint: null, frame: '#b9c3c2', mullion: 5 }), 0.2, 0.1));
addMaterial('publetters', () => standard(T.letters('PAUL U. BERGSTRÖMS AB', '#d4ab52'), 0.4, 0.6, { alphaTest: 0.4 }));
addMaterial('pubyear', () => standard(T.letters('1916', '#7a5646'), 0.8, 0, { alphaTest: 0.4 }));
addMaterial('haymarket', () => standard(T.letters('HAYMARKET', '#f2e6c4'), 0.4, 0.3, { alphaTest: 0.4 }));

type Ground = (x: number, z: number) => number | null;
type Side = 'N' | 'E' | 'S' | 'W';
interface Face { o: V2; h: V2; n: V2; W: number; side: Side }
// a stretch of a face to draw: s0 → s1 along it, y0 → y1; g(s) the ground in front of it
interface Run { f: Face; s0: number; s1: number; y0: number; y1: number; g: (s: number) => number }
type Look = (B: Builder, r: Run) => void;
interface Part { x: V2; z: V2; top: number; look: Look | null; cap?: string }

const faces = ({ x: [x0, x1], z: [z0, z1] }: Part): Face[] => [
  { o: [x0, z0], h: [1, 0], n: [0, -1], W: x1 - x0, side: 'N' },
  { o: [x1, z0], h: [0, 1], n: [1, 0], W: z1 - z0, side: 'E' },
  { o: [x1, z1], h: [-1, 0], n: [0, 1], W: x1 - x0, side: 'S' },
  { o: [x0, z1], h: [0, -1], n: [-1, 0], W: z1 - z0, side: 'W' },
];
const at = (f: Face, s: number, d = 0): V2 => [f.o[0] + f.h[0] * s + f.n[0] * d, f.o[1] + f.h[1] * s + f.n[1] * d];
const v3 = ([x, z]: V2, y = 0): V3 => [x, y, z];

// the middles of bays about `w` wide along a length
function bays(W: number, w: number) {
  const k = Math.max(1, Math.round(W / w)), b = W / k;
  return Array.from({ length: k }, (_, i) => (i + 0.5) * b);
}

// a wall between s0 and s1, y0 and y1, with those of a face's openings that fit in it
function wall(B: Builder, r: Run, y0: number, y1: number, ops: Opening[], style: WallStyle) {
  y0 = Math.max(y0, r.y0); y1 = Math.min(y1, r.y1);
  if (y1 - y0 < 0.02 || r.s1 - r.s0 < 0.02) return;
  wallWithOpenings(B, v3(at(r.f, r.s0)), v3(r.f.h), v3(r.f.n), r.s1 - r.s0, y0, y1,
    ops.filter((p) => p.a0 >= r.s0 && p.a1 <= r.s1).map((p) => ({ ...p, a0: p.a0 - r.s0, a1: p.a1 - r.s0 })), style);
}
// a strip standing out of the face (a ledge, a cornice, a canopy) along the run, clipped to it
function strip(B: Builder, r: Run, y0: number, y1: number, d0: number, d1: number, mat: string, a0 = r.s0, a1 = r.s1) {
  a0 = Math.max(a0, r.s0); a1 = Math.min(a1, r.s1);
  if (a1 - a0 < 0.02 || y1 <= y0) return;
  B.wallBox(v3(r.f.o), v3(r.f.h), v3(r.f.n), a0, a1, y0, y1, d0, d1, mat, 2, d0 < 0 ? [] : ['back']);
}
// a railing on the terrace at a run's top, a little in from its edge
function railing(B: Builder, r: Run) {
  B.tint(0x4d5a55);
  for (const y of [r.y1 + 0.5, r.y1 + 1.0]) strip(B, r, y - 0.05, y + 0.03, -0.25, -0.18, 'metal');
  for (let s = Math.ceil(r.s0 / 1.6) * 1.6; s < r.s1; s += 1.6) strip(B, r, r.y1, r.y1 + 1.0, -0.25, -0.18, 'metal', s - 0.03, s + 0.03);
}

// ---- the looks of the walls

// Bernhard's facade on Hötorget (and round the corner on Gamla Brogatan): a stone ground floor and
// first floor, then four storeys of pink between giant pilasters, a frieze and the cornice
const BASE_TOP = 18.4, PILASTER_TOP = 31.6, ROWS = [20.2, 23.1, 26.0, 28.9];
const bernhard: Look = (B, r) => {
  const { f } = r, giant = f.side === 'E' || f.side === 'S', ms = bays(f.W, 3.86), ops: Opening[] = [];
  for (const m of ms) {
    if (r.y0 < BASE_TOP) {
      ops.push({ a0: m - 1.45, a1: m + 1.45, b0: r.g(m) + 0.35, b1: 15.4, kind: 'shop' });
      ops.push({ a0: m - 1.25, a1: m + 1.25, b0: 16.1, b1: 17.8, kind: 'win' });
    }
    for (const y of ROWS) ops.push({ a0: m - 0.72, a1: m + 0.72, b0: y - 1.0, b1: y + 1.0, kind: 'win' });
  }
  B.tint(STONE);
  wall(B, r, r.y0, BASE_TOP, ops, { wall: 'concrete', trim: null, depth: 0.35 });
  B.tint(PINK);
  wall(B, r, BASE_TOP, r.y1, ops, { wall: 'plaster', trim: 'plaster', depth: 0.25, surround: 0.1, sill: true });
  B.tint(STONE);
  if (giant) {
    const b = f.W / ms.length;
    for (let k = 0; k <= ms.length; k++) {
      const s = k * b, y0 = Math.max(r.y0, BASE_TOP);
      if (PILASTER_TOP - y0 < 1) continue;
      strip(B, r, y0, PILASTER_TOP, 0, 0.28, 'concrete', s - 0.5, s + 0.5);
      strip(B, r, PILASTER_TOP - 0.45, PILASTER_TOP, 0, 0.4, 'concrete', s - 0.65, s + 0.65);
    }
  }
  if (r.y0 < BASE_TOP) strip(B, r, BASE_TOP - 0.3, BASE_TOP, 0, 0.3, 'concrete');
  strip(B, r, PILASTER_TOP, PILASTER_TOP + 0.25, 0, 0.3, 'concrete');
  strip(B, r, r.y1 - 0.55, r.y1, 0, 0.7, 'concrete');
};

// Cyrillus Johansson's corner house: shop windows in a stone ground floor, then pink with rows of
// windows (three to the square, at 2.45 m on Kungsgatan), a small row under the cornice there
const CY_BASE = 16.6, CY_ROWS = [18.4, 21.6, 24.8, 28.0];
const cyrillus: Look = (B, r) => {
  const { f } = r, ops: Opening[] = [];
  const cols = f.side === 'E' ? [f.W / 2 - 3.4, f.W / 2, f.W / 2 + 3.4] : bays(f.W, 2.45);
  if (r.y0 < CY_BASE) for (const m of bays(f.W, 4.9)) ops.push({ a0: m - 1.9, a1: m + 1.9, b0: r.g(m) + 0.3, b1: 15.6, kind: 'shop' });
  for (const m of cols) {
    for (const y of CY_ROWS) ops.push({ a0: m - 0.62, a1: m + 0.62, b0: y - 0.95, b1: y + 0.95, kind: 'win' });
    if (f.side === 'N') ops.push({ a0: m - 0.5, a1: m + 0.5, b0: 30.8, b1: 31.7, kind: 'win' });
  }
  B.tint(0xb9aea4);
  wall(B, r, r.y0, CY_BASE, ops, { wall: 'stone', trim: null, depth: 0.35 });
  B.tint(PINK_CY);
  wall(B, r, CY_BASE, r.y1, ops, { wall: 'plaster', trim: 'plaster', depth: 0.22, surround: 0, sill: true });
  B.tint(0xd9cdbf);
  if (r.y0 < CY_BASE) strip(B, r, CY_BASE - 0.3, CY_BASE, 0, 0.25, 'stone');
  strip(B, r, r.y1 - 0.5, r.y1, 0, 0.55, 'plaster');
};

// the white buildings: dark granite shop fronts under a canopy, then storeys of ribbon windows in
// marble (Gormsen's first one glazed nearly whole), a parapet and a railing
const white = (gormsen: boolean): Look => (B, r) => {
  const { f } = r, ops: Opening[] = [];
  if (r.y0 < SHOPS) for (const m of bays(f.W, 4.2)) ops.push({ a0: m - 1.75, a1: m + 1.75, b0: r.g(m) + 0.35, b1: SHOPS - 1.1, kind: 'shop' });
  for (let k = 0; SHOPS + (k + 1) * STOREY <= r.y1 + 0.3; k++) {
    const y = SHOPS + k * STOREY, glass = gormsen && k === 0;
    for (const m of bays(f.W, 2.9)) ops.push({ a0: m - (glass ? 1.4 : 1.18), a1: m + (glass ? 1.4 : 1.18), b0: y + (glass ? 0.2 : 0.75), b1: y + 2.75, kind: 'win' });
  }
  B.tint(GRANITE);
  wall(B, r, r.y0, SHOPS, ops, { wall: 'stone', trim: null, depth: 0.3 });
  B.tint(MARBLE);
  wall(B, r, SHOPS, r.y1, ops, { wall: 'marble', wallTile: [2.5, 3.3], trim: null, depth: 0.18, pane: 'ribbon' });
  if (r.y0 < SHOPS) {
    B.tint(CANOPY);
    strip(B, r, SHOPS - 0.4, SHOPS, 0, 1.5, 'metal');
  }
  B.tint(0x9fc3b2);
  strip(B, r, r.y1 - 0.12, r.y1 + 0.08, 0, 0.12, 'copper');
  railing(B, r);
};

// one storey set back over the one below: windows in pink plaster or marble, a copper ledge, a railing
const step = (tint: number, mat: string, tile: number | [number, number], bay: number): Look => (B, r) => {
  const ops = bays(r.f.W, bay).map((m): Opening => ({ a0: m - 0.68, a1: m + 0.68, b0: r.y1 - 2.5, b1: r.y1 - 0.85, kind: 'win' }));
  B.tint(tint);
  wall(B, r, r.y0, r.y1, ops, { wall: mat, wallTile: tile, trim: null, flush: true, pane: mat === 'marble' ? 'ribbon' : undefined });
  B.tint(0x9fc3b2);
  strip(B, r, r.y1 - 0.22, r.y1 + 0.06, 0, 0.32, 'copper');
  railing(B, r);
};
const pinkStep = step(STEP_PINK, 'plaster', 4, 2.9), whiteStep = step(MARBLE, 'marble', [2.5, 3.3], 2.9);

// Gormsen's stair tower: marble, a window a storey, two copper bands at its top
const stairTower: Look = (B, r) => {
  const ops: Opening[] = [];
  for (const y of [31.1, 34.3]) ops.push({ a0: r.f.W / 2 - 1.3, a1: r.f.W / 2 + 1.3, b0: y, b1: y + 1.8, kind: 'win' });
  B.tint(MARBLE);
  wall(B, r, r.y0, r.y1, ops, { wall: 'marble', wallTile: [2.5, 3.3], trim: null, depth: 0.15, pane: 'ribbon' });
  B.tint(0x9fc3b2);
  for (const y of [r.y1 - 0.5, r.y1 - 1.0]) strip(B, r, y - 0.1, y, 0, 0.06, 'copper');
};

// the dark storey over Cyrillus Johansson's house, and the copper one over everything
const band = (tint: number, mat: string, bay: number, w: number): Look => (B, r) => {
  const ops = bays(r.f.W, bay).map((m): Opening => ({ a0: m - w / 2, a1: m + w / 2, b0: r.y1 - 2.4, b1: r.y1 - 0.8, kind: 'win' }));
  B.tint(tint);
  wall(B, r, r.y0, r.y1, ops, { wall: mat, trim: null, flush: true });
};

// the pink tower on Gamla Brogatan, small windows high up
const tower: Look = (B, r) => {
  const ops: Opening[] = [];
  for (const y of [37.0, 39.6]) ops.push({ a0: r.f.W / 2 - 0.45, a1: r.f.W / 2 + 0.45, b0: y, b1: y + 1.2, kind: 'win' });
  B.tint(0xd99a85);
  wall(B, r, r.y0, r.y1, ops, { wall: 'plaster', trim: null, depth: 0.2 });
  B.tint(0xe6cfc4);
  strip(B, r, r.y1 - 0.45, r.y1, 0, 0.3, 'plaster');
};

// ---- the block as boxes, each a storey or a building's walls, its top flat
const PARTS: Part[] = [
  // Gormsen, its stair tower and its storeys set back
  { x: [X0, CYRILLUS_X], z: [Z0, GORMSEN_Z], top: 30.3, look: white(true), cap: 'copper' },
  { x: [-22.0, CYRILLUS_X], z: [-27.0, GORMSEN_Z], top: 33.5, look: whiteStep, cap: 'copper' },
  { x: [-18.0, CYRILLUS_X], z: [-25.0, GORMSEN_Z], top: 36.7, look: whiteStep, cap: 'copper' },
  { x: [-16.0, CYRILLUS_X], z: [-22.0, GORMSEN_Z], top: 40.2, look: whiteStep, cap: 'copper' },
  { x: [-22.2, -16.2], z: [-27.5, -20.3], top: 37.8, look: stairTower, cap: 'concrete' },
  // the white band on Drottninggatan and Gamla Brogatan, and the pink storeys stepping back over it
  { x: [X0, BERNHARD_X], z: [GORMSEN_Z, Z1], top: 27.2, look: white(false), cap: 'copper' },
  { x: [-20.2, BERNHARD_X], z: [GORMSEN_Z, 26.3], top: 30.5, look: pinkStep, cap: 'copper' },
  { x: [-18.0, BERNHARD_X], z: [GORMSEN_Z, 24.0], top: 34.1, look: pinkStep, cap: 'copper' },
  { x: [-15.0, BERNHARD_X], z: [GORMSEN_Z, 22.0], top: 37.3, look: pinkStep, cap: 'copper' },
  { x: [-12.0, BERNHARD_X], z: [GORMSEN_Z, 20.0], top: 40.5, look: pinkStep, cap: 'copper' },
  // Cyrillus Johansson's corner house, the dark storey on it
  { x: [CYRILLUS_X, X1], z: [Z0, CYRILLUS_Z], top: EAVES, look: cyrillus },
  { x: [CYRILLUS_X, 12.5], z: [-26.5, -20.5], top: 40.3, look: band(DARK, 'roof', 2.6, 1.2), cap: 'copper' },
  // Bernhard's, and the flat over its mansard (drawn below)
  { x: [BERNHARD_X, X1], z: [CYRILLUS_Z, Z1], top: EAVES, look: bernhard },
  { x: [BERNHARD_X, X1 - MANSARD[2][0]], z: [CYRILLUS_Z, Z1 - MANSARD[2][0]], top: MANSARD[2][1], look: null, cap: 'copper' },
  // the pink tower, and the copper storey over everything
  { x: [4.75, 11.25], z: [21.0, 27.5], top: TOWER_TOP, look: tower, cap: 'copper' },
  { x: [-10.0, 12.5], z: [-20.5, 17.0], top: CORE, look: band(COPPER, 'copper', 3.0, 1.6), cap: 'copper' },
];

const inside = (p: Part, x: number, z: number) => x > p.x[0] && x < p.x[1] && z > p.z[0] && z < p.z[1];
const height = (x: number, z: number) => PARTS.reduce((h, p) => (inside(p, x, z) ? Math.max(h, p.top) : h), -Infinity);

// Each part's walls where they show: on stretches of a face where nothing higher stands inside
// (another part owns those) and something lower, or nothing, outside; from the outside's height (or
// the ground) up. Stretches split where any part's edge meets the face, and join again where alike.
function walls(B: Builder, ground: (x: number, z: number) => number) {
  for (const p of PARTS) {
    if (!p.look) continue;
    for (const f of faces(p)) {
      const along = f.side === 'N' || f.side === 'S' ? 0 : 1, from = f.o[along], dir = f.h[along];
      const cuts = [...new Set([0, f.W, ...PARTS.flatMap((q) => (along ? q.z : q.x)).map((c) => (c - from) * dir)])]
        .filter((s) => s >= 0 && s <= f.W).sort((a, b) => a - b);
      const g = (s: number) => ground(...at(f, s, 0.8));
      const runs: { s0: number; s1: number; out: number }[] = [];
      for (let i = 0; i + 1 < cuts.length; i++) {
        const m = (cuts[i] + cuts[i + 1]) / 2, [ix, iz] = at(f, m, -0.05), [ox, oz] = at(f, m, 0.05);
        const out = height(ox, oz), last = runs[runs.length - 1];
        if (height(ix, iz) > p.top + 0.01 || out >= p.top - 0.05) continue;
        if (last && last.s1 === cuts[i] && last.out === out) last.s1 = cuts[i + 1];
        else runs.push({ s0: cuts[i], s1: cuts[i + 1], out });
      }
      for (const { s0, s1, out } of runs) {
        const low = Math.min(g(s0), g((s0 + s1) / 2), g(s1)) - 1.0;
        p.look(B, { f, s0, s1, y0: out === -Infinity ? low : out, y1: p.top, g });
      }
    }
  }
}

// ---- the roofs

// Bernhard's copper mansard, along Hötorget and round onto Gamla Brogatan (hipped at the corner),
// and its four dormers on the square
function mansard(B: Builder) {
  B.tint(COPPER);
  const [, [i1, y1], [i2, y2]] = MANSARD, y0 = EAVES;
  const slope = (pts: V3[]) => {
    const a = pts[0], b = pts[1], c = pts[2];
    const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
    B.poly(pts, n, 'copper', 3);
  };
  // east: the lower, steep slope and the upper one; south likewise, meeting them at the hip
  slope([[X1, y0, CYRILLUS_Z], [X1, y0, Z1], [X1 - i1, y1, Z1 - i1], [X1 - i1, y1, CYRILLUS_Z]]);
  slope([[X1 - i1, y1, CYRILLUS_Z], [X1 - i1, y1, Z1 - i1], [X1 - i2, y2, Z1 - i2], [X1 - i2, y2, CYRILLUS_Z]]);
  slope([[X1, y0, Z1], [BERNHARD_X, y0, Z1], [BERNHARD_X, y1, Z1 - i1], [X1 - i1, y1, Z1 - i1]]);
  slope([[X1 - i1, y1, Z1 - i1], [BERNHARD_X, y1, Z1 - i1], [BERNHARD_X, y2, Z1 - i2], [X1 - i2, y2, Z1 - i2]]);
  // its ends, over Cyrillus Johansson's roof and the pink storeys
  B.poly([[X1, y0, CYRILLUS_Z], [X1 - i1, y1, CYRILLUS_Z], [X1 - i2, y2, CYRILLUS_Z], [X1 - i2, y0, CYRILLUS_Z]], [0, 0, -1], 'copper', 3);
  B.poly([[BERNHARD_X, y0, Z1], [BERNHARD_X, y1, Z1 - i1], [BERNHARD_X, y2, Z1 - i2], [BERNHARD_X, y0, Z1 - i2]], [-1, 0, 0], 'copper', 3);
  // the dormers: copper fronts with a tall window, cheeks back into the roof, a pediment
  for (const zc of [-11.4, 0.2, 12.1, 23.2]) {
    const fx = X1 - 0.7, bx = X1 - 4.0, top = 37.4, hw = 1.7;
    const f: Face = { o: [fx, zc - hw], h: [0, 1], n: [1, 0], W: 2 * hw, side: 'E' };
    B.tint(0xcfe3d6);
    wall(B, { f, s0: 0, s1: 2 * hw, y0: y0, y1: top, g: () => 0 }, y0, top,
      [{ a0: hw - 0.8, a1: hw + 0.8, b0: 34.0, b1: 36.7, kind: 'tall' }], { wall: 'copper', trim: 'copper', depth: 0.25, surround: 0.15 });
    B.box([bx, y0, zc - hw], [fx, top, zc + hw], 'copper', 2, ['+x', '-y']);
    B.tint(COPPER);
    B.poly([[fx + 0.1, top, zc - hw - 0.15], [fx + 0.1, top, zc + hw + 0.15], [fx + 0.1, top + 1.3, zc]], [1, 0, 0], 'copper', 2);
    B.poly([[fx + 0.1, top, zc - hw - 0.15], [fx + 0.1, top + 1.3, zc], [bx, top + 1.3, zc], [bx, top, zc - hw - 0.15]], [0, 1, -1], 'copper', 2);
    B.poly([[fx + 0.1, top, zc + hw + 0.15], [bx, top, zc + hw + 0.15], [bx, top + 1.3, zc], [fx + 0.1, top + 1.3, zc]], [0, 1, 1], 'copper', 2);
    B.tint(GOLD);
    B.box([fx - 0.05, top + 1.3, zc - 0.06], [fx + 0.07, top + 2.2, zc + 0.06], 'metal', 2, ['-y']);
  }
}

// Cyrillus Johansson's house: its stepped gable to the square, the dark roof behind it, and on
// Kungsgatan a mansard with small dormers in front of the dark storey
const GABLE: V2[] = (() => {
  const half: V2[] = [[0, EAVES], [0, 34.0], [0.8, 34.0], [1.0, 34.6], [1.7, 34.9], [2.0, 35.8], [2.7, 36.1], [3.0, 37.1],
    [3.7, 37.4], [4.0, 38.5], [4.6, 38.8], [4.8, 39.7], [5.4, 39.9], [6.0, 40.7]];
  return [...half, ...half.slice(0, -1).reverse().map(([s, y]): V2 => [12 - s, y])];
})();
function corner(B: Builder) {
  const gx = X1 - 0.6, z = (s: number) => Z0 + s;
  // the gable: a slab with its stepped outline, front and back, and its coping
  const tris = THREE.ShapeUtils.triangulateShape(GABLE.map(([s, y]) => new THREE.Vector2(s, y)), []);
  B.tint(PINK_CY);
  B.tris(GABLE.map(([s, y]): V3 => [X1, y, z(s)]), tris, [1, 0, 0], 'plaster', 4);
  B.tris(GABLE.map(([s, y]): V3 => [gx, y, z(s)]), tris, [-1, 0, 0], 'plaster', 4);
  B.tint(0xeadbd0);
  for (let i = 0; i + 1 < GABLE.length; i++) {
    const [s0, y0] = GABLE[i], [s1, y1] = GABLE[i + 1];
    B.poly([[gx, y0, z(s0)], [X1 + 0.05, y0, z(s0)], [X1 + 0.05, y1, z(s1)], [gx, y1, z(s1)]], [0, s1 - s0, -(y1 - y0)], 'stone', 2);
  }
  // its small windows, and the house's year
  for (const s of [3.2, 5.1, 6.9, 8.8]) {
    B.tint([1, 1, 1]);
    B.poly([[X1 + 0.02, 34.2, z(s - 0.4)], [X1 + 0.02, 34.2, z(s + 0.4)], [X1 + 0.02, 35.3, z(s + 0.4)], [X1 + 0.02, 35.3, z(s - 0.4)]], [1, 0, 0], 'window', 1,
      [[0.25, 0], [0, 0], [0, 1], [0.25, 1]]);
  }
  // the gilt ring of the hotel's monogram, and the year over it (the text reads towards −z)
  B.tint(GOLD);
  for (let k = 0; k < 24; k++) {
    const a0 = (k / 24) * Math.PI * 2, a1 = ((k + 1) / 24) * Math.PI * 2;
    const P = (a: number, r: number): V3 => [X1 + 0.03, 37.5 + r * Math.sin(a), z(6) + r * Math.cos(a)];
    B.poly([P(a0, 0.85), P(a1, 0.85), P(a1, 1.0), P(a0, 1.0)], [1, 0, 0], 'metal', 2);
  }
  B.tint([1, 1, 1]);
  B.poly([[X1 + 0.03, 38.75, z(7.7)], [X1 + 0.03, 38.75, z(4.3)], [X1 + 0.03, 39.3, z(4.3)], [X1 + 0.03, 39.3, z(7.7)]], [1, 0, 0], 'pubyear', 1,
    [[0, 0], [1, 0], [1, 1], [0, 1]]);
  // the roof behind it, ridged along x, in dark sheet metal
  B.tint(SLATE);
  const north: V3[] = [[gx, EAVES, Z0], [CYRILLUS_X, EAVES, Z0], [CYRILLUS_X, 35.8, -26.5], [gx, 35.8, -26.5]];
  B.poly(north, [0, 1, -0.9], 'roof', 3);
  B.poly([[gx, 35.8, -26.5], [12.5, 35.8, -26.5], [12.5, RIDGE, RIDGE_Z], [gx, RIDGE, RIDGE_Z]], [0, 1, -0.9], 'roof', 3);
  B.poly([[gx, RIDGE, RIDGE_Z], [12.5, RIDGE, RIDGE_Z], [12.5, EAVES, CYRILLUS_Z], [gx, EAVES, CYRILLUS_Z]], [0, 1, 0.9], 'roof', 3);
  B.poly([[CYRILLUS_X, EAVES, Z0], [CYRILLUS_X, EAVES, -26.5], [CYRILLUS_X, 35.8, -26.5]], [-1, 0, 0], 'roof', 3);
  // the small dormers on Kungsgatan
  for (let k = 0; k < 6; k++) {
    const xc = 0.2 + k * 3.9, fz = Z0 + 0.5;
    B.tint(SLATE);
    B.box([xc - 0.8, EAVES, fz], [xc + 0.8, 35.3, fz + 1.9], 'roof', 2, ['-y']);
    B.tint([1, 1, 1]);
    B.poly([[xc - 0.5, 33.6, fz - 0.02], [xc + 0.5, 33.6, fz - 0.02], [xc + 0.5, 34.9, fz - 0.02], [xc - 0.5, 34.9, fz - 0.02]], [0, 0, -1], 'window', 1,
      [[0.25, 0], [0.5, 0], [0.5, 1], [0.25, 1]]);
    B.tint(SLATE);
    B.hipped([xc - 0.95, xc + 0.95, fz - 0.05, fz + 1.85], 35.3, 35.9, 'roof');
  }
}

// the glass pyramid on the top storey, the tower's lantern, Gormsen's flagpole, signs and canopy
function crowns(B: Builder) {
  const [px, pz, ph] = [1.0, 0, 5.2];
  B.tint(0x9fc3b2);
  B.box([px - ph - 0.3, CORE, pz - ph - 0.3], [px + ph + 0.3, CORE + 0.4, pz + ph + 0.3], 'copper', 2, ['-y']);
  B.tint([1, 1, 1]);
  const tip: V3 = [px, PYRAMID, pz], b = CORE + 0.4;
  const base: V3[] = [[px - ph, b, pz - ph], [px + ph, b, pz - ph], [px + ph, b, pz + ph], [px - ph, b, pz + ph]];
  for (let i = 0; i < 4; i++) {
    const a = base[i], c = base[(i + 1) % 4], mx = (a[0] + c[0]) / 2 - px, mz = (a[2] + c[2]) / 2 - pz;
    B.tris([a, c, tip], [[0, 1, 2]], [mx, ph * ph / (PYRAMID - b), mz], 'pubglass', 2.6);
  }
  // the lantern: a copper cornice, an open octagon, a spire
  B.tint(COPPER);
  B.lathe(8.0, 24.25, [[0.1, TOWER_TOP - 0.1], [3.7, TOWER_TOP - 0.1], [3.7, TOWER_TOP + 0.5], [2.4, TOWER_TOP + 1.2], [2.4, 45.3],
    [2.8, 45.5], [1.2, 46.4], [0.12, LANTERN]], 'copper', 8);
  B.tint(GOLD);
  B.box([7.95, LANTERN, 24.2], [8.05, LANTERN + 1.0, 24.3], 'metal', 2, ['-y']);
  B.tint(0xdddddd);
  B.box([-19.25, 37.8, -23.95], [-19.15, 44.0, -23.85], 'metal', 2, ['-y']);
  // the hotel's canopy and name over its door on Hötorget; the store's name on Drottninggatan
  B.tint(0x2d2a28);
  B.box([X1, 15.0, -4.5], [X1 + 2.8, 15.6, 4.5], 'metal', 2);
  B.tint([1, 1, 1]);
  B.poly([[X1 + 2.6, 15.6, 4.2], [X1 + 2.6, 15.6, -4.2], [X1 + 2.6, 16.95, -4.2], [X1 + 2.6, 16.95, 4.2]], [1, 0, 0], 'haymarket', 1,
    [[0, 0], [1, 0], [1, 1], [0, 1]]);
  B.poly([[X0 - 0.03, 12.6, -2.0], [X0 - 0.03, 12.6, 18.0], [X0 - 0.03, 13.6, 18.0], [X0 - 0.03, 13.6, -2.0]], [-1, 0, 0], 'publetters', 1,
    [[0, 0], [1, 0], [1, 1], [0, 1]]);
}

export function buildPub(B: Builder, ground: Ground) {
  B.place([AT[0], 0, AT[1]], TURN);
  const g = (x: number, z: number) => ground(...world([x, z])) ?? 10.5;
  walls(B, g);
  for (const p of PARTS) {
    if (!p.cap) continue;
    B.tint(COPPER);
    B.cap([[p.x[0], p.z[0]], [p.x[1], p.z[0]], [p.x[1], p.z[1]], [p.x[0], p.z[1]]], p.top, p.cap, 4);
  }
  mansard(B);
  corner(B);
  crowns(B);
  B.place([0, 0, 0], 0);
}

// the outline, world x, z: the walls where the laser scan has them
const OUTLINE: V2[] = [[X0, Z0], [X1, Z0], [X1, Z1], [X0, Z1]].map((p) => world(p as V2));
export const PUB = { name: 'PUB', outline: OUTLINE, anchor: AT, build: buildPub };
