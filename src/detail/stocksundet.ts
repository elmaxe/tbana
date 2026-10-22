import * as THREE from 'three';
import * as T from '../textures';
import type { Builder, V2, V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';
import { Line, loft, post, table } from './ropsten.ts';

// The red line's bridge over Stocksundet, between Bergshamra and Danderyds sjukhus, opened with
// the line to Mörby centrum in January 1978: 231 m of concrete in four spans (71, 55, 54 and 51 m)
// on a gentle curve, from the tunnel's mouth in Bergshamra's hillside to a short cutting in
// Danderyd, 13 m clear over the water.
//
// - the girder: one box with wide cantilevers, pale grey, 3 m deep from the edge beams' tops to
//   its flat bottom, its webs curving down and in from under the cantilevers;
// - the piers: three slim walls, 1.5 m by 4 m, with a cap and bearings under the girder; the two
//   in the water painted white at the waterline;
// - the edges: white railings of bars on both sides, and on the west side of the northern half,
//   from the last pier in the water to the cutting, a solid screen 1.5 m high;
// - over the channel, between the two piers in the water, the yellow disc giving the clearance,
//   "13 m", on both faces.
//
// The deck's plan, edges, heights and screen from Lantmäteriet's laser scan (Laserdata Nedladdning,
// skog, March 2021, CC BY 4.0); the girder's depth and the piers from Google's 3D mesh of the city;
// the looks from photographs on Wikimedia Commons (2012–2014), the spans, the date and the
// clearance from Swedish Wikipedia ("Stocksundsbron (tunnelbana)"). The network draws the track on
// it (src/network.ts) and leaves the girder, the piers and the railings to this
// (src/detail/viaducts.ts).
//
// Drawn along the middle between its two tracks, northwards: s metres from 25 m south of the
// southern abutment, u to the east (right). World coordinates (src/geo.ts), heights RH 2000.

type Ground = (x: number, z: number) => number | null;

addMaterial('st-bars', () => standard(T.railingBars(), 0.6, 0.3, { alphaTest: 0.5, side: THREE.DoubleSide }));
addMaterial('st-sign', () => standard(T.clearanceSign('13 m'), 0.5, 0, { alphaTest: 0.5 }));
// (the girder's underside and webs, lit from below by the water: so they glow a little, as
// Ropsten's decks do)
addMaterial('st-under', () => { const m = T.concrete(17, 228); return standard(m, 0.9, 0, { emissive: new THREE.Color(0x5c5b57), emissiveMap: m }); });

// colours
const GIRDER = 0xb6b5af, DECK = 0x8d8a84, PIER = 0xb1afa8, WATERLINE = 0xecebe6, BEARING = 0x55585a;
const RAILING = 0xd6d9d7, SCREEN = 0xc3c4bf;

const UP: V3 = [0, 1, 0];
const v3 = ([x, z]: V2, y: number): V3 => [x, y, z];

// The middle between the tracks every 5 m (the game's tracks, as public/data/track-geometry.json
// has them, which data/track-corrections.json lays on the scan's deck)
const LINE = new Line([[-1294.84, -5811.03], [-1293.93, -5815.95], [-1293.01, -5820.86], [-1292.08, -5825.77], [-1291.11, -5830.68],
  [-1290.13, -5835.58], [-1289.11, -5840.48], [-1288.07, -5845.37], [-1286.98, -5850.25], [-1285.87, -5855.12], [-1284.69, -5859.98],
  [-1283.49, -5864.84], [-1282.23, -5869.67], [-1280.94, -5874.5], [-1279.58, -5879.32], [-1278.2, -5884.12], [-1276.75, -5888.91],
  [-1275.27, -5893.68], [-1273.71, -5898.43], [-1272.13, -5903.18], [-1270.46, -5907.89], [-1268.78, -5912.6], [-1267.01, -5917.27],
  [-1265.22, -5921.94], [-1263.35, -5926.58], [-1261.46, -5931.21], [-1259.47, -5935.8], [-1257.48, -5940.38], [-1255.39, -5944.92],
  [-1253.29, -5949.46], [-1251.09, -5953.96], [-1248.89, -5958.44], [-1246.59, -5962.88], [-1244.28, -5967.32], [-1241.88, -5971.7],
  [-1239.46, -5976.08], [-1236.96, -5980.41], [-1234.45, -5984.73], [-1231.84, -5989.0], [-1229.23, -5993.26], [-1226.54, -5997.48],
  [-1223.84, -6001.69], [-1221.07, -6005.85], [-1218.29, -6010.0], [-1215.45, -6014.12], [-1212.61, -6018.23], [-1209.71, -6022.3],
  [-1206.8, -6026.37], [-1203.84, -6030.4], [-1200.86, -6034.42], [-1197.84, -6038.41], [-1194.81, -6042.38], [-1191.75, -6046.34]]);
// the rails' top between the tracks, and how much higher the eastern track's are than the western's
const RAIL = table([[0, 13.75], [10, 14.11], [20, 14.47], [30, 14.82], [40, 15.15], [50, 15.46], [60, 15.75], [70, 16.03], [80, 16.28],
  [90, 16.51], [100, 16.69], [110, 16.86], [120, 17.0], [130, 17.09], [140, 17.16], [150, 17.21], [160, 17.23], [170, 17.2], [180, 17.15],
  [190, 17.09], [200, 16.99], [210, 16.85], [220, 16.7], [230, 16.56], [240, 16.41], [250, 16.23], [260, 16.02]]);
const TILT = table([[0, -0.23], [40, -0.22], [60, -0.14], [80, -0.15], [100, -0.07], [120, -0.07], [140, -0.02], [160, 0.01], [200, 0.04], [240, 0.01]]);
const TRACKS = 4;
const railAt = (s: number, u: number) => RAIL(s) + (TILT(s) * u) / TRACKS;

// the deck's ends (the scan's), the piers' middles (the mesh's), and where the screen starts
const SOUTH = 14, NORTH = 245.5, PIERS = [85, 140.2, 194.4], SCREEN_FROM = 158;
// the middle of the deck, a little west of the tracks', and half its width
const MID = -0.1, HALF = 4.95;
// The cross-section, (u from the deck's middle, height above the rails), round it from the western
// edge beam's inner foot: up the edge beam and down its fascia, in under the cantilever, down the
// web (a quarter ellipse), along the bottom and up the other side in turn; closed by the deck's
// top under the ballast.
const EDGE = 0.4, TOP = 0.2, FASCIA = -0.75, BOTTOM = -2.8, BOTTOM_HALF = 2.2, WEB = { u: 3.7, y: -1.0 };
const SECTION: V2[] = (() => {
  const west: V2[] = [[-HALF + EDGE, -0.62], [-HALF + EDGE, TOP], [-HALF, TOP], [-HALF, FASCIA], [-WEB.u, WEB.y]];
  const a = WEB.u - BOTTOM_HALF, b = WEB.y - BOTTOM;
  for (let k = 1; k <= 6; k++) {
    const t = (k / 6) * (Math.PI / 2);
    west.push([-BOTTOM_HALF - a * Math.cos(t), WEB.y - b * Math.sin(t)]);
  }
  return [...west, ...west.map(([u, y]): V2 => [-u, y]).reverse()];
})();
// stations every 2.5 m from a to b, and at both
const stations = (a: number, b: number) => {
  const out = [a];
  for (let s = Math.floor(a / 2.5) * 2.5 + 2.5; s < b - 0.01; s += 2.5) out.push(s);
  out.push(b);
  return out;
};

export function buildStocksundsbron(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const ss = stations(SOUTH, NORTH);
  const point = (s: number, [u, dy]: V2): V3 => v3(LINE.at(s, MID + u), railAt(s, MID + u) + dy);
  // outward from the section's edge k: to the right of the way round
  const outward = (s: number, k: number): V3 => {
    const [ua, ya] = SECTION[k], [ub, yb] = SECTION[k + 1], r = LINE.right(s);
    return [r[0] * (yb - ya), -(ub - ua), r[2] * (yb - ya)];
  };

  // the girder, and the deck's top under the ballast between the edge beams
  B.tint(GIRDER);
  for (let k = 0; k + 1 < SECTION.length; k++) {
    const under = SECTION[k][1] < FASCIA + 0.01 && SECTION[k + 1][1] < FASCIA + 0.01;
    loft(B, ss.map((s) => [point(s, SECTION[k]), point(s, SECTION[k + 1])]), under ? 'st-under' : 'concrete', (i) => outward(ss[i], k), 4);
  }
  B.tint(DECK);
  loft(B, ss.map((s) => [point(s, SECTION[SECTION.length - 1]), point(s, SECTION[0])]), 'concrete', () => UP, 4);
  // its ends, on the abutments
  const tri = THREE.ShapeUtils.triangulateShape(SECTION.map(([u, y]) => new THREE.Vector2(u, y)), []);
  B.tint(GIRDER);
  for (const [s, sign] of [[SOUTH, -1], [NORTH, 1]] as const) {
    const al = LINE.along(s);
    B.tris(SECTION.map((p) => point(s, p)), tri, [al[0] * sign, 0, al[2] * sign], 'concrete', 4);
  }

  // the abutments: the southern one in the hillside at the tunnel's mouth, the northern one at the
  // head of the cutting, where the shore's road passes under the last span
  B.tint(PIER);
  for (const [from, to] of [[SOUTH - 4, SOUTH], [NORTH, NORTH + 6]]) {
    const s = (from + to) / 2, c = LINE.at(s, MID), t = LINE.along(s), top = railAt(s, 0) - 0.63;
    const low = Math.min(...[-HALF, 0, HALF].map((u) => { const p = LINE.at(s, MID + u); return ground(p[0], p[1]) ?? top - 4; }));
    if (low < top) post(B, c, [t[0], t[2]], to - from, 2 * HALF + 0.3, low - 1, top, 'concrete', 4);
  }

  // the piers: each on its foot, under a cap with the bearings on it
  for (const s of PIERS) {
    const c = LINE.at(s, MID), t = LINE.along(s), dir: V2 = [t[0], t[2]];
    const g = ground(c[0], c[1]), wet = g === null || g < 1;
    const foot = wet ? Math.min(g ?? -2, -1) - 1 : (g ?? 0) - 0.5, under = railAt(s, MID) + BOTTOM;
    B.tint(PIER);
    post(B, c, dir, 1.5, 4, foot, under - 0.8, 'concrete', 4);
    post(B, c, dir, 1.8, 4.4, under - 0.8, under - 0.3, 'concrete', 4);
    if (wet) {
      B.tint(WATERLINE);
      post(B, c, dir, 1.54, 4.04, foot, 2.1, 'concrete', 4);
    }
    B.tint(BEARING);
    for (const u of [-1.3, 1.3]) post(B, LINE.at(s, MID + u), dir, 0.7, 0.7, under - 0.3, under + 0.02, 'metal', 1);
  }

  // the railings, and on the west side of the northern half the screen
  const rails = (side: -1 | 1, from: number, to: number) => {
    const us = stations(from, to), u = MID + side * (HALF - 0.15);
    const foot = us.map((s) => v3(LINE.at(s, u), railAt(s, u) + TOP));
    const out = (s: number): V3 => { const r = LINE.right(s); return [r[0] * side, 0, r[2] * side]; };
    B.tint(RAILING);
    let run = 0;
    for (let i = 0; i + 1 < us.length; i++) {
      const a = foot[i], b = foot[i + 1], l = Math.hypot(b[0] - a[0], b[2] - a[2]);
      B.poly([a, b, [b[0], b[1] + 1.0, b[2]], [a[0], a[1] + 1.0, a[2]]], out(us[i]), 'st-bars', 1, [[run, 0], [run + l, 0], [run + l, 1], [run, 1]]);
      run += l;
    }
    loft(B, us.map((s, i) => {
      const r = LINE.right(s), p = foot[i], y = p[1] + 1.0;
      return [[p[0] - r[0] * 0.05, y, p[2] - r[2] * 0.05], [p[0] + r[0] * 0.05, y, p[2] + r[2] * 0.05]];
    }), 'metal', () => UP, 2);
  };
  rails(1, SOUTH, NORTH);
  rails(-1, SOUTH, SCREEN_FROM);
  const sc = stations(SCREEN_FROM, NORTH);
  B.tint(SCREEN);
  for (const [d, sign] of [[-0.06, 1], [0.06, -1]] as const) {
    const u = MID - HALF + 0.15 + d;
    loft(B, sc.map((s) => [v3(LINE.at(s, u), railAt(s, u) + TOP), v3(LINE.at(s, u), railAt(s, u) + TOP + 1.5)]), 'concrete', (i) => {
      const r = LINE.right(sc[i]);
      return [r[0] * sign, 0, r[2] * sign];
    }, 3);
  }
  loft(B, sc.map((s) => {
    const a = MID - HALF + 0.09, b = MID - HALF + 0.21;
    return [v3(LINE.at(s, a), railAt(s, a) + TOP + 1.5), v3(LINE.at(s, b), railAt(s, b) + TOP + 1.5)];
  }), 'concrete', () => UP, 3);

  // the clearance over the channel, on both faces
  const sign = (PIERS[0] + PIERS[1]) / 2;
  B.tint(0xffffff);
  for (const side of [-1, 1]) {
    const al = LINE.along(sign), r = LINE.right(sign), u = MID + side * (HALF + 0.04), y = railAt(sign, u) - 0.3;
    const at = (a: number, h: number): V3 => { const p = LINE.at(sign, u); return [p[0] + al[0] * a * side, y + h, p[1] + al[2] * a * side]; };
    B.poly([at(-0.5, -0.5), at(0.5, -0.5), at(0.5, 0.5), at(-0.5, 0.5)], [r[0] * side, 0, r[2] * side], 'st-sign', 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
}

// ------------------------------------------------------------------ Svedenreservoaren
// The water tower on the hill west of the bridge's southern end, the tallest thing in sight from
// the bridge: a wide drum of ribbed panels, 50 m across and 8.5 m deep, on a ring of 22 slim
// square columns, round a plain round core that stands 20 m high under it; a plant room on its
// roof and a mast beside it. Its plan and heights from the laser scan, the columns, the core and
// the drum's depth from Google's mesh.
const TOWER = { c: [-1402.1, -5800.4] as V2, r: 24.9, under: 62.0, top: 70.5, columns: 22, ring: 22.1, core: 13, coreTop: 54.5 };
const DRUM = 0xd3ccbf, TOWER_ROOF = 0x5f6264, CORE = 0xe6e3dc, COLUMN = 0xcfcac0, PLANT = 0xdcdfe0, MAST = 0x9a9ea2;
addMaterial('st-ribs', () => standard(T.corrugated(true), 0.8));

const circle = ([cx, cz]: V2, r: number, n: number): V2[] =>
  Array.from({ length: n }, (_, k): V2 => [cx + r * Math.cos((k / n) * Math.PI * 2), cz + r * Math.sin((k / n) * Math.PI * 2)]);
export const SVEDEN_OUTLINE = circle(TOWER.c, TOWER.r + 1, 24);

export function buildSvedenreservoaren(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const [cx, cz] = TOWER.c, foot = (ground(cx, cz) ?? 34.2) - 0.5;
  // the drum, its roof and its underside
  B.tint(DRUM);
  B.lathe(cx, cz, [[TOWER.r, TOWER.under], [TOWER.r, TOWER.top]], 'st-ribs', 64, 1.5);
  const rim = circle(TOWER.c, TOWER.r, 64);
  B.tint(TOWER_ROOF);
  B.cap(rim, TOWER.top, 'concrete', 4);
  B.tint(DRUM);
  B.cap(rim, TOWER.under, 'st-under', 4, true);
  // the core under it
  B.tint(CORE);
  B.lathe(cx, cz, [[TOWER.core, foot], [TOWER.core, TOWER.coreTop]], 'concrete', 48, 4);
  B.cap(circle(TOWER.c, TOWER.core, 48), TOWER.coreTop, 'concrete', 4);
  // the columns
  B.tint(COLUMN);
  for (let k = 0; k < TOWER.columns; k++) {
    const a = ((k + 0.5) / TOWER.columns) * Math.PI * 2, p: V2 = [cx + TOWER.ring * Math.cos(a), cz + TOWER.ring * Math.sin(a)];
    post(B, p, [-Math.sin(a), Math.cos(a)], 1.3, 1.3, (ground(p[0], p[1]) ?? foot) - 0.5, TOWER.under, 'concrete', 4);
  }
  // the plant room on the roof, and the mast
  B.tint(PLANT);
  B.box([cx - 5.2, TOWER.top - 0.1, cz - 4.9], [cx + 5.0, 73.4, cz + 5.0], 'concrete', 4, ['-y']);
  B.tint(MAST);
  B.lathe(cx - 3.1, cz + 1.1, [[0.4, 73.4], [0.32, 80], [0.25, 87.4]], 'metal', 8);
}
