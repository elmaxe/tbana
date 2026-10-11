import * as THREE from 'three';
import * as T from '../textures';
import type { Builder, V2, V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';

// Slussen as it stands in 2026, in view east of the metro's bridge over Söderström: Guldbron (the
// golden road bridge of 2020 from Södermalmstorg to Slussplan), the water square below it with the
// new lock, Victoriaslussen, and its two basins between granite quays, the two granite pavilions
// with glass prisms on their roofs that flank the stairs up to Södermalmstorg (Mälartrappan),
// Katarinahissen's black lattice tower with its walkway to Katarinahuset, and the new cycle and
// footbridge beside the metro's (Lilla Söderströmsbron, complete in 2026, opening in 2027).
//
// Measured from Lantmäteriet's laser scan of March 2021 (Laserdata Nedladdning, skog, CC BY 4.0:
// Guldbron's deck every 5 m along it and its width, Katarinahissen's walkway and cabin, the
// square's and the quays' levels), Google's 3D mesh of the city (Guldbron's edges, lanes and
// walks, the tower and walkway) and OpenStreetMap (the lock's, the basins', the pavilions' and the
// cycle bridge's outlines, © OpenStreetMap contributors, ODbL); the looks from photographs on
// Wikimedia Commons (Guldbron's golden sides and railings, the pavilions' granite and prisms, the
// walkway's band of lights). The elevation model is older than all of this: data/ground-
// corrections.json brings the ground down to the quays. World coordinates (src/geo.ts); heights
// RH 2000.

type Ground = (x: number, z: number) => number | null;

addMaterial('sl-gold', () => standard(null, 0.55, 0.25));
addMaterial('sl-granite', () => standard(T.graniteBlocks(), 0.85));
addMaterial('sl-wire', () => standard(T.wireRails(), 0.5, 0.5, { alphaTest: 0.5, side: THREE.DoubleSide }));
addMaterial('sl-lattice', () => standard(T.lattice(), 0.6, 0.4, { alphaTest: 0.5, side: THREE.DoubleSide }));
addMaterial('sl-led', () => { const m = T.ledBand(); return standard(m, 0.6, 0, { emissive: new THREE.Color(0xff4a4a), emissiveMap: m, emissiveIntensity: 0.9 }); });
addMaterial('sl-water', () => standard(null, 0.3, 0.05, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));

// colours
const GOLD = 0xd2a64c, GOLD_UNDER = 0xa8843a, PAVING = 0xb9b7b0, ASPHALT = 0x6b6c6d, PAINT = 0xe8e8e2;
const GRANITE = 0xa39b90, GRANITE_PALE = 0xb5aea3, GLASS = 0x9fb3bf, GLASS_DARK = 0x6e7e88, DARK = 0x3a3d40;
const POST = 0xaab0b4, MAST = 0x8d9195, PIER = 0xa8a59f, WATER = 0x2d5a78, STEEL_LIGHT = 0xa9adb0, STEEL_DARK = 0x6f7377;
const LATTICE = 0x2b2b2e, ROOF = 0x9a9893;

const UP: V3 = [0, 1, 0], DOWN: V3 = [0, -1, 0];
const v3 = ([x, z]: V2, y: number): V3 => [x, y, z];

// ------------------------------------------------------------------ drawing helpers
// Quads between rows of points (each row across, the rows along), each facing the side of `hint`.
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
// A railing of posts and wires along a line of points at their heights, `h` high, facing `out`.
function wires(B: Builder, pts: V3[], h: number, out: (i: number) => V3) {
  let s = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (l < 1e-6) continue;
    B.poly([a, b, [b[0], b[1] + h, b[2]], [a[0], a[1] + h, a[2]]], out(i), 'sl-wire', 1, [[s / 2, 0], [(s + l) / 2, 0], [(s + l) / 2, 1], [s / 2, 1]]);
    s += l;
  }
}
// The walls of a hole in the quay (a basin, the lock), facing in over the water, from y1 at the
// quay down to y0.
function holeWalls(B: Builder, poly: V2[], y0: number, y1: number) {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const e: V2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    const inward: V3 = area > 0 ? [-e[1], 0, e[0]] : [e[1], 0, -e[0]];
    B.poly([v3(a, y0), v3(b, y0), v3(b, y1), v3(a, y1)], inward, 'sl-granite', 2);
  }
}
// A flat surface over an outline with holes in it, facing up.
function capWithHoles(B: Builder, outer: V2[], holes: V2[][], y: number, mat: string, tile = 4) {
  const tri = THREE.ShapeUtils.triangulateShape(outer.map(([x, z]) => new THREE.Vector2(x, z)), holes.map((h) => h.map(([x, z]) => new THREE.Vector2(x, z))));
  const pts = [...outer, ...holes.flat()].map((p) => v3(p, y));
  B.tris(pts, tri, UP, mat, tile);
}
// A wedge of glass on a roof, in the current frame: its base x 0 → l, z 0 → w at y0; its ridge
// along z = 0 at y0 + h, that side upright, the other a slope down to z = w.
function wedge(B: Builder, l: number, w: number, y0: number, h: number) {
  B.tint(GLASS);
  B.poly([[0, y0, w], [l, y0, w], [l, y0 + h, 0], [0, y0 + h, 0]], [0, w, h], 'gs-glass', 2);
  B.poly([[0, y0, 0], [l, y0, 0], [l, y0 + h, 0], [0, y0 + h, 0]], [0, 0, -1], 'gs-glass', 2);
  B.poly([[0, y0, 0], [0, y0, w], [0, y0 + h, 0]], [-1, 0, 0], 'gs-glass', 2);
  B.poly([[l, y0, 0], [l, y0, w], [l, y0 + h, 0]], [1, 0, 0], 'gs-glass', 2);
  // the ridge's dark edge
  B.tint(DARK);
  B.poly([[0, y0 + h, -0.12], [l, y0 + h, -0.12], [l, y0 + h, 0.12], [0, y0 + h, 0.12]], UP, 'gs-paint', 2);
}
// The walls of a pavilion whose roof is the square above: granite from the ground up, a band of
// glass under the roof and a dark fascia; the walls facing the square (where the ground is near
// the roof) left out.
function pavilionWalls(B: Builder, poly: V2[], top: number, ground: Ground) {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const e: V2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    const out: V3 = area > 0 ? [e[1], 0, -e[0]] : [-e[1], 0, e[0]];
    const foot = Math.min(ground(a[0], a[1]) ?? 2, ground(b[0], b[1]) ?? 2) - 0.4;
    if (foot > top - 1.5) continue;
    const glass = top - 3.1, band = top - 0.45;
    B.tint(GRANITE);
    B.poly([v3(a, foot), v3(b, foot), v3(b, glass), v3(a, glass)], out, 'sl-granite', 2);
    B.tint(GLASS);
    B.poly([v3(a, glass), v3(b, glass), v3(b, band), v3(a, band)], out, 'gs-glass', 2);
    B.tint(DARK);
    B.poly([v3(a, band), v3(b, band), v3(b, top), v3(a, top)], out, 'gs-paint', 2);
  }
}

// ------------------------------------------------------------------ Guldbron
// Slussbron, the "golden bridge" (2020) over the lock from Södermalmstorg to Slussplan: one steel
// deck 45 m wide, golden yellow along its sides and underneath, falling from the square at 12.4 m
// to 4.3 m where it meets the ground at Slussplan 190 m away, deeper at the Söder end. Its own
// frame: x along it towards Slussplan, z across it towards Saltsjön, about the middle of the
// laser scan's rows (which gave the deck 8.87 m there, −4.75 % up to the Söder end and −4 % on
// to the square, 45.5 m wide between z −32.5 and 13; Google's mesh the lanes and walks on it).
// The west half is a promenade, then six lanes and a walk on the east; railings of posts and
// wires, tall lamp masts. The Söder end stands on an abutment whose tinted glass fronts
// stand under the deck down to the quays on both sides; the rest is on round piers.
const GB = { x: 836.5, z: 1176.5, turn: 1.1414 };
const GB_X0 = -96, GB_X1 = 94, GB_W = -32.5, GB_E = 13, GB_KERB_W = -18.5, GB_KERB_E = 3.5, GB_TERMINAL = -45;
const gbTop = (x: number) => Math.min(12.5, x >= -55 ? 8.87 - 0.0475 * x : 11.48 + (-55 - x) * 0.04);
const gbDepth = (x: number) => 1.3 + (2.3 * (GB_X1 - x)) / (GB_X1 - GB_X0);
const GB_ROWS = [-96, -85, -75, -65, -58, -55, -45, -35, -25, -15, -5, 5, 15, 25, 35, 45, 55, 65, 75, 85, 94];

export function buildGuldbron(B: Builder, ground: Ground) {
  const c = Math.cos(GB.turn), s = Math.sin(GB.turn);
  const gw = (x: number, z: number) => ground(GB.x + x * c + z * s, GB.z - x * s + z * c);
  B.place([GB.x, 0, GB.z], GB.turn);
  const WALK = 0.12;
  const rows = GB_ROWS;
  const at = (x: number, z: number, dy = 0): V3 => [x, gbTop(x) + dy, z];

  // the deck's top: the raised walks either side of the lanes
  B.tint(PAVING);
  loft(B, rows.map((x) => [at(x, GB_W, WALK), at(x, GB_KERB_W, WALK)]), 'concrete', () => UP, 2);
  loft(B, rows.map((x) => [at(x, GB_KERB_E, WALK), at(x, GB_E, WALK)]), 'concrete', () => UP, 2);
  B.tint(0xd8d6d0);
  loft(B, rows.map((x) => [at(x, GB_KERB_W, WALK), at(x, GB_KERB_W)]), 'concrete', () => [0, 0, 1], 2);
  loft(B, rows.map((x) => [at(x, GB_KERB_E), at(x, GB_KERB_E, WALK)]), 'concrete', () => [0, 0, -1], 2);
  B.tint(ASPHALT);
  loft(B, rows.map((x) => [at(x, GB_KERB_W), at(x, GB_KERB_E)]), 'gs-asphalt', () => UP, 6);
  // the lane lines: dashed between the lanes, a double line down the middle
  B.tint(PAINT);
  const lane = (GB_KERB_E - GB_KERB_W) / 6;
  for (const k of [1, 2, 4, 5]) {
    const z = GB_KERB_W + lane * k;
    for (let x = GB_X0 + 2; x + 3 < GB_X1; x += 12) {
      B.poly([at(x, z - 0.08, 0.012), at(x + 3, z - 0.08, 0.012), at(x + 3, z + 0.08, 0.012), at(x, z + 0.08, 0.012)], UP, 'gs-paint', 4);
    }
  }
  for (const dz of [-0.18, 0.18]) {
    const z = GB_KERB_W + lane * 3 + dz;
    loft(B, rows.map((x) => [at(x, z - 0.07, 0.012), at(x, z + 0.07, 0.012)]), 'gs-paint', () => UP, 4);
  }

  // the golden sides and underside
  for (const [z, out] of [[GB_W, [0, 0, -1]], [GB_E, [0, 0, 1]]] as [number, V3][]) {
    B.tint(GOLD);
    loft(B, rows.map((x) => [at(x, z, WALK), [x, gbTop(x) - gbDepth(x), z] as V3]), 'sl-gold', () => out, 3);
  }
  B.tint(GOLD_UNDER);
  loft(B, rows.map((x) => [[x, gbTop(x) - gbDepth(x), GB_W] as V3, [x, gbTop(x) - gbDepth(x), GB_E] as V3]), 'sl-gold', () => DOWN, 6);

  // the abutment under the Söder end: tinted glass from the deck's underside down to the quays
  const term = rows.filter((x) => x <= GB_TERMINAL);
  for (const [z, out] of [[GB_W, [0, 0, -1]], [GB_E, [0, 0, 1]]] as [number, V3][]) {
    B.tint(GLASS_DARK);
    loft(B, term.map((x) => [[x, gbTop(x) - gbDepth(x), z] as V3, [x, Math.min(gw(x, z) ?? 1.8, 1.8) - 0.3, z] as V3]), 'gs-glass', () => out, 3);
  }
  B.tint(GLASS_DARK);
  B.poly([[GB_TERMINAL, 1.5, GB_W], [GB_TERMINAL, 1.5, GB_E], [GB_TERMINAL, gbTop(GB_TERMINAL) - gbDepth(GB_TERMINAL), GB_E], [GB_TERMINAL, gbTop(GB_TERMINAL) - gbDepth(GB_TERMINAL), GB_W]], [1, 0, 0], 'gs-glass', 3);

  // the railings along both edges
  B.tint(POST);
  wires(B, rows.map((x) => at(x, GB_W + 0.15, WALK)), 1.15, () => [0, 0, -1]);
  wires(B, rows.map((x) => at(x, GB_E - 0.15, WALK)), 1.15, () => [0, 0, 1]);

  // the lamp masts: 12 m, with twin lamps at the top, along both edges in turn
  B.tint(MAST);
  for (const [x, z] of [[-85, GB_W], [-55, GB_W], [-25, GB_W], [5, GB_W], [35, GB_W], [65, GB_W], [-70, GB_E], [-40, GB_E], [-10, GB_E], [20, GB_E], [50, GB_E], [80, GB_E]] as V2[]) {
    const foot = gbTop(x) + WALK, zz = z + (z < 0 ? 0.6 : -0.6);
    B.lathe(x, zz, [[0.1, foot], [0.08, foot + 7], [0.06, foot + 12]], 'metal', 6);
    B.box([x - 0.9, foot + 11.8, zz - 0.14], [x + 0.9, foot + 11.95, zz + 0.14], 'metal', 1);
    B.tint(0xf4f2e6);
    B.box([x - 1.05, foot + 11.6, zz - 0.2], [x - 0.6, foot + 11.9, zz + 0.2], 'gs-paint', 1);
    B.box([x + 0.6, foot + 11.6, zz - 0.2], [x + 1.05, foot + 11.9, zz + 0.2], 'gs-paint', 1);
    B.tint(MAST);
  }

  // the piers under the open part: rows of four round columns
  B.tint(PIER);
  for (const x of [-28, 26, 62]) {
    const top = gbTop(x) - gbDepth(x);
    for (const z of [-27, -15, -4.5, 7]) {
      const g = gw(x, z) ?? 1.8;
      B.lathe(x, z, [[0.65, g - 1.5], [0.65, top + 0.05]], 'concrete', 12);
    }
  }
  B.place([0, 0, 0], 0);
}

// ------------------------------------------------------------------ Vattentorget
// The water square under and west of Guldbron: granite quays about 1.8 m over the water round
// the lock, Victoriaslussen (12 m wide between the lock bridges at each end), and two basins,
// with two footbridges over the lock (the west one and the pair at the east end). OpenStreetMap's
// outlines; the quays' level from the laser scan of the finished east quay.
const QUAY = 1.83, WATER_LEVEL = 0.25, BED = -1.2;
// the quays' outline, between the shores and the pavilions
const VT_OUTER: V2[] = [
  [735.5, 1133.6], [722.4, 1133.9], [707.7, 1164.5], [673.1, 1148.5], [660, 1140], [657, 1172], [664.3, 1183.7], [671.6, 1178.6],
  [710.2, 1196.2], [712.5, 1199.5], [727.9, 1207.9], [756, 1221.5], [764.9, 1228.3], [770, 1236], [783, 1216], [824.2, 1234.6],
  [835.3, 1224.5], [849.8, 1194], [858, 1192.5], [852.2, 1189], [857.5, 1178], [864, 1180.4], [866.3, 1177.6], [859.9, 1173],
  [875, 1140.6], [887.5, 1121.1], [866.3, 1111.9], [841.1, 1100.9], [762, 1065], [757, 1062.8], [747.4, 1084.1], [733.5, 1113.4],
  [730.1, 1117.7], [740, 1122.7],
];
// the lock between its bridges, a hole in the quays, and the whole of it, mouth to mouth
const LOCK_HOLE: V2[] = [[744.5, 1124.7], [847.3, 1173], [843.6, 1181], [842.1, 1184.1], [739.5, 1135.9]];
const LOCK: V2[] = [[730.1, 1117.7], [736.3, 1121], [746, 1125.4], [847.3, 1173], [857.5, 1178], [864, 1180.4], [858, 1192.5], [852.2, 1189], [842.1, 1184.1], [740.7, 1136.4], [731.2, 1131.7]];
const BASIN_N: V2[] = [[755.6, 1120.9], [768.8, 1093.1], [819.6, 1117.5], [806.2, 1144.9]];
const BASIN_S: V2[] = [[731.2, 1172.5], [743.7, 1146.6], [794.6, 1170.5], [781.9, 1196.3]];

export function buildVattentorget(B: Builder) {
  B.place([0, 0, 0], 0);
  // the quays' paving over the ground, which the lock's and basins' digging has disturbed
  B.tint(PAVING);
  capWithHoles(B, VT_OUTER, [LOCK_HOLE, BASIN_N, BASIN_S], QUAY, 'concrete', 2);
  // the water and the quay walls down into it
  B.tint(WATER);
  for (const w of [LOCK, BASIN_N, BASIN_S]) B.cap(w, WATER_LEVEL, 'sl-water', 8);
  B.tint(GRANITE_PALE);
  holeWalls(B, BASIN_N, BED, QUAY);
  holeWalls(B, BASIN_S, BED, QUAY);
  holeWalls(B, LOCK.slice(1, 5), BED, QUAY);
  holeWalls(B, [LOCK[0], ...LOCK.slice(7, 11)].reverse(), BED, QUAY);
  // the lock bridges' undersides and railings
  B.tint(STEEL_DARK);
  for (const [a, b, w] of [[[737.9, 1135.9], [743, 1124.7], 2.3], [[850.5, 1189], [855.5, 1178], 3.5]] as [V2, V2, number][]) {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]), d: V3 = [(b[0] - a[0]) / l, 0, (b[1] - a[1]) / l], n: V3 = [-d[2], 0, d[0]];
    B.wallBox([a[0], 0, a[1]], d, n, 0, l, QUAY - 0.5, QUAY - 0.02, -w, w, 'gs-paint', 2, ['top']);
    B.tint(POST);
    for (const side of [-1, 1]) {
      const o = (t: number): V3 => [a[0] + d[0] * t + n[0] * side * (w - 0.1), QUAY, a[1] + d[2] * t + n[2] * side * (w - 0.1)];
      wires(B, [o(0), o(l)], 1.1, () => [n[0] * side, 0, n[2] * side]);
    }
    B.tint(STEEL_DARK);
  }
}

// ------------------------------------------------------------------ Mälartrappan
// The stairs from the water square up to Södermalmstorg, 11 m higher, between two pavilions of
// grey-brown granite with bands of glass under their roofs, which are at the square's level,
// and a prism of glass on each roof (Commons photos). The west one is Mälarterrassen (2025), the
// restaurant building under the square's north edge from the metro bridge's end to the stairs,
// drawn as one front (its terraces down to the water are not); the east one stands between the
// stairs and Guldbron's approach. The outlines are from OpenStreetMap's square. The lower flight
// stands out on the quay, the upper between the pavilions.
const SQUARE = 12.6;
const TERMINAL: V2[] = [[664.3, 1183.7], [671.6, 1178.6], [710.2, 1196.2], [712.5, 1199.5], [716.7, 1234.8], [712.1, 1240.7], [703.8, 1241.6]];
const EAST_PAVILION: V2[] = [[727.9, 1207.9], [756, 1221.5], [764.9, 1228.3], [755.4, 1233.4], [729.4, 1239.7], [725.6, 1235.6]];
// the stairs' foot and top (world z), and their sides: the pavilions' walls
const STAIR_FOOT = 1183, STAIR_LANDING = 1201, STAIR_UP = 1203, STAIR_TOP = 1235, STAIR_END = 1247;
// both pavilions and the stairs between them, for the landmarks' outline (the city's blocks of
// the pavilions are left out)
export const MALARTRAPPAN_OUTLINE: V2[] = [[664.3, 1183.7], [671.6, 1178.6], [710.2, 1196.2], [727.9, 1207.9], [756, 1221.5], [764.9, 1228.3], [755.4, 1233.4], [729.4, 1239.7], [716.7, 1236], [712.1, 1240.7], [703.8, 1241.6]];
const stairWest = (z: number) => (z <= 1199.5 ? 712.5 : 712.5 + (z - 1199.5) * 0.119);
const stairEast = (z: number) => (z <= 1207.9 ? 727.9 : 727.9 - (z - 1207.9) * 0.083);

export function buildMalartrappan(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  for (const p of [TERMINAL, EAST_PAVILION]) {
    pavilionWalls(B, p, SQUARE, ground);
    B.tint(ROOF);
    B.cap(p, SQUARE, 'concrete', 4);
  }
  // the prisms of glass on the roofs, along the stairs
  B.place([711.9, 0, 1202.6], -1.452);
  wedge(B, 30, 12, SQUARE, 5);
  B.place([726.85, 0, 1232.7], 1.488);
  wedge(B, 22, 10, SQUARE, 4.5);
  B.place([0, 0, 0], 0);

  // the stairs: 36 steps up to a landing, 39 more to the top, then the landing on the square
  const RISE = (SQUARE - QUAY) / 75;
  let y = QUAY, z = STAIR_FOOT;
  const flights: [number, number, number][] = [[36, (STAIR_LANDING - STAIR_FOOT) / 36, STAIR_LANDING], [0, 0, STAIR_UP], [39, (STAIR_TOP - STAIR_UP) / 39, STAIR_TOP]];
  const profile: V2[] = [[STAIR_FOOT, QUAY]];
  B.tint(0xc9c5bc);
  const tread = (z0: number, z1: number, yy: number) => {
    B.poly([[stairWest(z0), yy, z0], [stairEast(z0), yy, z0], [stairEast(z1), yy, z1], [stairWest(z1), yy, z1]], UP, 'concrete', 2);
  };
  const riser = (zz: number, y0: number, y1: number) => {
    B.poly([[stairWest(zz), y0, zz], [stairEast(zz), y0, zz], [stairEast(zz), y1, zz], [stairWest(zz), y1, zz]], [0, 0, -1], 'concrete', 2);
  };
  for (const [steps, run, end] of flights) {
    for (let k = 0; k < steps; k++) {
      riser(z, y, y + RISE);
      profile.push([z, y + RISE]);
      y += RISE;
      tread(z, z + run, y);
      z += run;
      profile.push([z, y]);
    }
    if (!steps) { tread(z, end, y); z = end; profile.push([z, y]); }
  }
  // the landing on the square, over what the elevation model has left behind the stairs
  tread(z, STAIR_END, y);
  B.poly([[stairWest(STAIR_END), y - 10, STAIR_END], [stairEast(STAIR_END), y - 10, STAIR_END], [stairEast(STAIR_END), y, STAIR_END], [stairWest(STAIR_END), y, STAIR_END]], [0, 0, 1], 'concrete', 2);
  // the lower flight's sides, out on the quay
  const lower = profile.filter(([zz]) => zz <= STAIR_UP + 0.01);
  for (const [x, nx] of [[stairWest(STAIR_FOOT), -1], [stairEast(STAIR_FOOT), 1]] as [number, number][]) {
    const pts: V3[] = [[x, QUAY, STAIR_UP], ...lower.map(([zz, yy]): V3 => [x, yy, zz]), [x, lower[lower.length - 1][1], STAIR_UP]];
    B.poly(pts, [nx, 0, 0], 'sl-granite', 2);
  }
}

// ------------------------------------------------------------------ Katarinahissen
// The lift tower of 1936 beside Slussen, rebuilt with a new lift in 2023: a black steel lattice
// tower about 4.4 m square from Katarinavägen's lower level, with a glazed cabin on top (its
// roof at 45 m, the laser scan) and a flagpole, and the glazed walkway, 3 m wide, from the tower
// south to the roof of Katarinahuset 32 m away, its roof at 41.3 m and under its floor the red
// band of lights that runs its length (Commons photos, 2025). Its own frame at the tower's
// middle, x along the walkway.
const KH = { x: 800.4, z: 1292.4, turn: -1.676 };
const KH_HALF = 2.2, KH_TOP = 41.4, KH_CABIN = 45.2, KH_WALK = 32;

export function buildKatarinahissen(B: Builder, ground: Ground) {
  const foot = (ground(KH.x, KH.z) ?? 12) - 0.3;
  B.place([KH.x, 0, KH.z], KH.turn);
  const h = KH_HALF;
  // the lattice on the four sides, in panels 3.2 m high, with the dark shaft inside
  B.tint(LATTICE);
  const panels = (KH_TOP - foot) / 3.2;
  for (const [pts, n] of [
    [[[-h, foot, -h], [h, foot, -h], [h, KH_TOP, -h], [-h, KH_TOP, -h]], [0, 0, -1]],
    [[[h, foot, h], [-h, foot, h], [-h, KH_TOP, h], [h, KH_TOP, h]], [0, 0, 1]],
    [[[h, foot, -h], [h, foot, h], [h, KH_TOP, h], [h, KH_TOP, -h]], [1, 0, 0]],
    [[[-h, foot, h], [-h, foot, -h], [-h, KH_TOP, -h], [-h, KH_TOP, h]], [-1, 0, 0]],
  ] as [V3[], V3][]) B.poly(pts, n, 'sl-lattice', 1, [[0, 0], [1, 0], [1, panels], [0, panels]]);
  B.tint(0x1e2022);
  B.box([-1, foot, -1], [1, KH_TOP, 1], 'gs-paint', 2);
  // the cabin and the flagpole
  B.tint(GLASS);
  B.box([-h - 0.4, KH_TOP, -h - 0.4], [h + 0.4, KH_CABIN, h + 0.4], 'gs-glass', 2, ['-y']);
  B.tint(DARK);
  B.box([-h - 0.5, KH_CABIN, -h - 0.5], [h + 0.5, KH_CABIN + 0.4, h + 0.5], 'gs-paint', 2);
  B.box([-h - 0.4, KH_TOP - 0.5, -h - 0.4], [h + 0.4, KH_TOP, h + 0.4], 'gs-paint', 2);
  B.tint(MAST);
  B.lathe(0, 0, [[0.07, KH_CABIN + 0.4], [0.05, KH_CABIN + 7]], 'metal', 6);
  B.tint(0xf4f4f0);
  B.poly([[0, KH_CABIN + 5.6, 0], [0, KH_CABIN + 5.6, 1.6], [0, KH_CABIN + 6.7, 1.6], [0, KH_CABIN + 6.7, 0]], [1, 0, 0], 'gs-paint', 1);
  // the walkway: the band of lights under its floor, the glazed walk and its roof
  const w = 1.6, x0 = h, x1 = KH_WALK;
  B.tint(0xffffff);
  B.poly([[x0, 37.0, -w], [x1, 37.0, -w], [x1, 38.0, -w], [x0, 38.0, -w]], [0, 0, -1], 'sl-led', 1, [[x0 / 8, 0], [x1 / 8, 0], [x1 / 8, 1], [x0 / 8, 1]]);
  B.poly([[x1, 37.0, w], [x0, 37.0, w], [x0, 38.0, w], [x1, 38.0, w]], [0, 0, 1], 'sl-led', 1, [[x1 / 8, 0], [x0 / 8, 0], [x0 / 8, 1], [x1 / 8, 1]]);
  B.tint(DARK);
  B.box([x0, 36.9, -w], [x1, 37.0, w], 'gs-paint', 2);
  B.box([x0, 38.0, -w - 0.05], [x1, 38.5, w + 0.05], 'gs-paint', 2);
  B.box([x0, KH_TOP - 0.4, -w - 0.1], [x1, KH_TOP, w + 0.1], 'gs-paint', 2);
  B.tint(GLASS);
  B.poly([[x0, 38.5, -w], [x1, 38.5, -w], [x1, KH_TOP - 0.4, -w], [x0, KH_TOP - 0.4, -w]], [0, 0, -1], 'gs-glass', 2);
  B.poly([[x1, 38.5, w], [x0, 38.5, w], [x0, KH_TOP - 0.4, w], [x1, KH_TOP - 0.4, w]], [0, 0, 1], 'gs-glass', 2);
  B.place([0, 0, 0], 0);
}
// the tower's plan, for the landmarks' outline (the city's block of it is left out)
export const KATARINAHISSEN_OUTLINE: V2[] = [[797, 1289], [804.5, 1289], [804.5, 1296], [797, 1296]];

// ------------------------------------------------------------------ Lilla Söderströmsbron
// The new cycle and footbridge from Munkbron to Söder beside the metro's bridge, 30–45 m east of
// it, lifted in in April–June 2026 and opening in 2027: a shallow light grey steel box deck 7 m
// wide on four round piers in the water, low over it, bending south at its Söder end. Its line
// from OpenStreetMap; its height a guess from the photographs of its first sections (about 4.8 m
// over the water in the middle, down to the quays at each end).
const LSB: V2[] = [
  [523.1, 986.9], [535.9, 1001.4], [550.3, 1015.9], [573.4, 1037.6], [596.8, 1059.5], [612.8, 1075.8], [628.2, 1092.6], [632.6, 1099.2],
  [635, 1104.3], [637.4, 1110.3], [637.9, 1114.9], [638, 1123.5], [638, 1129.5], [638, 1134.9], [639.4, 1141.6], [640.7, 1145.8],
  [643.3, 1151.7], [646.2, 1155.4],
];
const LSB_HALF = 3.5, LSB_DEEP = 1.1;
const lsbHeight = (s: number) => (s < 70 ? 2.6 + ((4.8 - 2.6) * s) / 70 : s < 170 ? 4.8 : 4.8 - ((4.8 - 2.4) * (s - 170)) / 46);

export function buildCycleBridge(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const n = LSB.length;
  const along = LSB.reduce<number[]>((a, p, i) => a.concat(i ? a[i - 1] + Math.hypot(p[0] - LSB[i - 1][0], p[1] - LSB[i - 1][1]) : 0), []);
  // the deck's edges, square to its line
  const side = LSB.map((_, i): V2 => {
    const a = LSB[Math.max(0, i - 1)], b = LSB[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
  });
  const at = (i: number, d: number, dy = 0): V3 => [LSB[i][0] + side[i][0] * d, lsbHeight(along[i]) + dy, LSB[i][1] + side[i][1] * d];
  const idx = LSB.map((_, i) => i);
  B.tint(0x77797b);
  loft(B, idx.map((i) => [at(i, -LSB_HALF + 0.3), at(i, LSB_HALF - 0.3)]), 'gs-asphalt', () => UP, 4);
  B.tint(STEEL_LIGHT);
  loft(B, idx.map((i) => [at(i, -LSB_HALF, 0.05), at(i, -LSB_HALF + 0.3, 0.05)]), 'gs-paint', () => UP, 2);
  loft(B, idx.map((i) => [at(i, LSB_HALF - 0.3, 0.05), at(i, LSB_HALF, 0.05)]), 'gs-paint', () => UP, 2);
  loft(B, idx.map((i) => [at(i, -LSB_HALF, 0.05), at(i, -LSB_HALF, -LSB_DEEP)]), 'gs-paint', (i) => [side[i][0], 0, side[i][1]], 2);
  loft(B, idx.map((i) => [at(i, LSB_HALF, -LSB_DEEP), at(i, LSB_HALF, 0.05)]), 'gs-paint', (i) => [-side[i][0], 0, -side[i][1]], 2);
  B.tint(STEEL_DARK);
  loft(B, idx.map((i) => [at(i, -LSB_HALF, -LSB_DEEP), at(i, LSB_HALF, -LSB_DEEP)]), 'gs-paint', () => DOWN, 4);
  B.tint(POST);
  wires(B, idx.map((i) => at(i, -LSB_HALF + 0.12, 0.05)), 1.3, (i) => [side[i][0], 0, side[i][1]]);
  wires(B, idx.map((i) => at(i, LSB_HALF - 0.12, 0.05)), 1.3, (i) => [-side[i][0], 0, -side[i][1]]);
  // the piers
  B.tint(PIER);
  for (const i of [3, 4, 6, 11]) {
    const g = ground(LSB[i][0], LSB[i][1]) ?? 0;
    B.lathe(LSB[i][0], LSB[i][1], [[0.9, g - 2], [0.9, lsbHeight(along[i]) - LSB_DEEP + 0.05]], 'concrete', 12);
  }
}
