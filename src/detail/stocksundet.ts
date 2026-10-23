import * as THREE from 'three';
import * as T from '../textures';
import type { Builder, V2, V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';
import { deck, lampMast, Line, loft, post, table } from './ropsten.ts';

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

// ------------------------------------------------------------------ the E18's bridge
// Stocksundsbron for the road, 320 m east of the metro's: the E18 (Norrtäljevägen) on two bridges
// side by side, the southbound one opened in 1990 and the northbound in May 1992 in place of the
// arch bridge of 1936. Each a concrete box girder with wide cantilevers, in three spans (64, 121
// and 74 m), deep over its two piers and shallow between them, on a gentle curve to the east and
// banked for it; 12 m clear over the water.
//
// - the decks: the southbound one to the west, 19.5 m wide, four lanes; the northbound 15.5 m,
//   three lanes and a path for walking and cycling outside a guardrail on its east side, widening
//   at the north end for the slip road from Inverness; a gap of 0.8 m between them;
// - the edges: on the west a railing of bars, on the east a screen of glass panels 1.4 m high, in
//   the middle guardrails;
// - the piers: one big block under each girder at the shores, darker at its foot;
// - lamp masts in the middle every 38.5 m, 12 m high with an arm over each carriageway;
// - two sign gantries at each end, the signs as photographed: northbound to Norrtälje and the exit
//   to Inverness and Stocksund, southbound to Stockholm and to the E4 north and the E18 to Oslo.
//
// The decks' plan, heights, edges and banking, the masts and the gantries from Lantmäteriet's
// laser scan (2021); the piers and the abutments from Google's 3D mesh; the girders' depth, the
// edges and the signs from photographs on Wikimedia Commons (2014) and Mapillary (2024–2026); the
// spans, the widths, the lanes and the dates from Swedish Wikipedia ("Stocksundsbron
// (vägtrafik)"). OpenStreetMap leaves road bridges out of the city (tools/build-city.ts), so
// without this there would be water here.
//
// Drawn along a straight line through the middle of the river, northwards: s metres from there,
// u to the east (right); the decks' edges curve off it.
addMaterial('e18-signs', () => standard(T.e18Signs(), 0.6, 0));
const E18 = new Line([[-995.05, -5744.24], [-994.758, -5745.196]]);
// the middle of the gap between the decks, and their widths, every 10 m (the scan's deck)
const E18_GAP = table([[-140, 1.08], [-130, 0.84], [-120, 0.66], [-110, 0.53], [-100, 0.45], [-90, 0.42], [-80, 0.43], [-70, 0.48],
  [-60, 0.57], [-50, 0.69], [-40, 0.84], [-30, 1.02], [-20, 1.22], [-10, 1.45], [0, 1.69], [10, 1.94], [20, 2.21], [30, 2.49], [40, 2.77],
  [50, 3.05], [60, 3.33], [70, 3.6], [80, 3.87], [90, 4.13], [100, 4.37], [110, 4.59], [120, 4.8], [130, 4.98], [140, 5.13]]);
const E18_WEST_W = table([[-140, 22.29], [-120, 21.65], [-100, 21.08], [-80, 20.59], [-60, 20.17], [-40, 19.83], [-20, 19.57], [0, 19.38],
  [20, 19.27], [40, 19.24], [60, 19.28], [80, 19.4], [100, 19.59], [120, 19.86], [140, 20.21]]);
const E18_EAST_W = table([[-140, 16.76], [-120, 16.42], [-100, 16.14], [-80, 15.95], [-60, 15.85], [-40, 15.87], [-20, 16.03], [0, 16.33],
  [10, 16.55], [20, 16.8], [30, 17.1], [40, 17.45], [50, 17.85], [60, 18.3], [70, 18.81], [80, 19.37], [90, 19.99], [100, 20.67],
  [110, 21.41], [120, 22.21], [130, 23.08], [140, 24.02]]);
// the roads' heights in their middles, and their banking (rise to the east per metre)
const E18_WEST_TOP = table([[-140, 16.16], [-130, 16.16], [-120, 16.2], [-110, 16.3], [-100, 16.42], [-90, 16.55], [-80, 16.7], [-70, 16.84],
  [-60, 16.96], [-50, 17.08], [-40, 17.17], [-30, 17.24], [-20, 17.28], [-10, 17.28], [0, 17.25], [10, 17.18], [20, 17.08], [30, 16.93],
  [40, 16.76], [50, 16.55], [60, 16.32], [70, 16.06], [80, 15.79], [90, 15.52], [100, 15.23], [110, 14.96], [120, 14.7], [130, 14.48], [140, 14.29]]);
const E18_EAST_TOP = table([[-140, 15.19], [-130, 15.34], [-120, 15.51], [-110, 15.68], [-100, 15.85], [-90, 16.02], [-80, 16.16], [-70, 16.31],
  [-60, 16.43], [-50, 16.54], [-40, 16.63], [-30, 16.7], [-20, 16.74], [-10, 16.75], [0, 16.74], [10, 16.71], [20, 16.64], [30, 16.56],
  [40, 16.43], [50, 16.29], [60, 16.12], [70, 15.94], [80, 15.72], [90, 15.49], [100, 15.24], [110, 14.98], [120, 14.7], [130, 14.42], [140, 14.14]]);
const E18_WEST_CROSS = table([[-140, -0.054], [-120, -0.045], [-100, -0.04], [-60, -0.037], [-20, -0.032], [0, -0.028], [20, -0.021],
  [40, -0.013], [60, -0.003], [80, 0.006], [100, 0.014], [120, 0.018], [140, 0.018]]);
const E18_EAST_CROSS = table([[-140, -0.041], [-120, -0.029], [-100, -0.021], [-80, -0.015], [-60, -0.012], [-40, -0.01], [0, -0.01],
  [40, -0.014], [80, -0.016], [120, -0.017], [140, -0.017]]);
const HALF_GAP = 0.4;
// the decks, from west to east
const E18_DECKS = [
  { left: (s: number) => E18_GAP(s) - HALF_GAP - E18_WEST_W(s), right: (s: number) => E18_GAP(s) - HALF_GAP, top: E18_WEST_TOP, cross: E18_WEST_CROSS, inset: 4.6 },
  { left: (s: number) => E18_GAP(s) + HALF_GAP, right: (s: number) => E18_GAP(s) + HALF_GAP + E18_EAST_W(s), top: E18_EAST_TOP, cross: E18_EAST_CROSS, inset: 3.9 },
];
// the abutments' faces, the piers (the mesh's), and the deck's ends beyond the abutments (the scan's)
const E18_SOUTH = -133, E18_NORTH = 131, E18_PIERS = [-66, 55], E18_ENDS = [-146, 146];
// The girders' depth under the road: 3.4 m, and 6.5 m over the piers, the soffit curving down to
// them over 40 m of the main span and 24 m of the side spans.
const E18_DEPTH = (s: number) => {
  let f = 0;
  for (const p of E18_PIERS) {
    const main = (p < 0) === (s > p), t = Math.abs(s - p) / (main ? 40 : 24);
    if (t < 1) f = Math.max(f, (1 - t) * (1 - t));
  }
  return 3.4 + 3.1 * f;
};
const E18_EDGE = 1.0;
const E18_CONCRETE = 0xb0afa9, E18_UNDER = 0x908f8a, E18_KERB = 0xbdbbb4, E18_ROAD = 0x5d5f62, E18_PATH = 0x77797b, E18_PAINT = 0xe6e6e0;
const E18_FOOT = 0x6f6e69, E18_RAIL = 0xc9ccca, E18_STEEL = 0x9ea3a6;
// lamp masts and the gantries (s, and which deck)
const E18_MASTS = [-111, -72.6, -34.2, 4.6, 43, 81.4, 120];
const E18_GANTRIES = [
  { s: -84.5, deck: 1, signs: [{ sign: 'northbound', u: 0.42, y: 4.9 }, { sign: 'exit177', u: 0.87, y: 7.05 }] },
  { s: -71, deck: 0, signs: [{ sign: 'stockholm', u: 0.62, y: 5.2 }, { sign: 'oslo', u: 0.15, y: 4.8 }] },
  { s: 87.5, deck: 1, signs: [{ sign: 'norrtalje', u: 0.4, y: 5.6 }, { sign: 'inverness', u: 0.82, y: 5.9 }, { sign: 'exit177', u: 0.93, y: 6.95 }] },
  { s: 90.5, deck: 0, signs: [{ sign: 'southbound', u: 0.5, y: 4.8 }] },
] as const;

export function buildE18Bridge(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const whole: V2 = [-1e4, 1e4];
  const topAt = (k: number, s: number, u: number) => {
    const d = E18_DECKS[k];
    return d.top(s) + d.cross(s) * (u - (d.left(s) + d.right(s)) / 2);
  };
  const p3 = (k: number, s: number, u: number, dy = 0): V3 => v3(E18.at(s, u), topAt(k, s, u) + dy);
  const along = E18.along(0), dir: V2 = [along[0], along[2]], right = E18.right(0);

  // the girders, the roads on them, their kerbs and railings
  E18_DECKS.forEach((d, k) => {
    deck(B, {
      line: E18, from: E18_ENDS[0], to: E18_ENDS[1], step: 4, left: d.left, right: d.right, top: d.top, cross: d.cross,
      edge: E18_EDGE, inset: d.inset, depth: E18_DEPTH, road: E18_ROAD, fascia: E18_CONCRETE, under: E18_UNDER, underMat: 'st-under', kerb: E18_KERB,
      rails: k === 0 ? { left: true, right: false, colour: E18_RAIL, height: 1.1 } : { left: false, right: true, colour: 0xd2dcd8, height: 1.15, mat: 'rp-glass' },
      ends: { from: true, to: true },
    }, whole, ground);
  });
  const ss: number[] = [];
  for (let s = E18_ENDS[0]; s <= E18_ENDS[1] + 0.01; s += 4) ss.push(s);
  // the glass screen's posts
  B.tint(E18_STEEL);
  for (let s = E18_ENDS[0] + 1; s < E18_ENDS[1]; s += 3) {
    const u = E18_DECKS[1].right(s) - 0.2;
    post(B, E18.at(s, u), dir, 0.1, 0.1, topAt(1, s, u) + 0.25, topAt(1, s, u) + 1.42, 'metal', 1);
  }

  // guardrails: along the gap on both decks, and on the northbound deck between the lanes and the path
  const guardrail = (k: number, u: (s: number) => number, side: 1 | -1) => {
    B.tint(E18_STEEL);
    const face = (sign: number) => (i: number): V3 => [right[0] * side * sign, 0, right[2] * side * sign];
    for (const sign of [1, -1]) {
      const du = sign * 0.03;
      loft(B, ss.map((s) => [p3(k, s, u(s) + du, 0.45), p3(k, s, u(s) + du, 0.78)]), 'metal', face(sign), 2);
    }
    for (let s = E18_ENDS[0] + 2; s < E18_ENDS[1]; s += 4) post(B, E18.at(s, u(s) - side * 0.12), dir, 0.12, 0.12, topAt(k, s, u(s)), topAt(k, s, u(s)) + 0.72, 'metal', 1);
  };
  guardrail(0, (s) => E18_DECKS[0].right(s) - 0.8, -1);
  guardrail(1, (s) => E18_DECKS[1].left(s) + 0.8, 1);
  guardrail(1, (s) => E18_DECKS[1].right(s) - 3.6, 1);

  // the lines on the roads: solid at the edges, dashed between the lanes (3 m in 12); and the path
  const paint = (k: number, u: (s: number) => number, dashed: boolean, where: (s: number) => boolean = () => true) => {
    B.tint(E18_PAINT);
    const w = 0.08;
    if (dashed) {
      for (let s = Math.ceil(E18_ENDS[0] / 12) * 12; s + 3 <= E18_ENDS[1]; s += 12) {
        if (!where(s)) continue;
        B.poly([p3(k, s, u(s) - w, 0.015), p3(k, s + 3, u(s + 3) - w, 0.015), p3(k, s + 3, u(s + 3) + w, 0.015), p3(k, s, u(s) + w, 0.015)], UP, 'gs-paint', 4);
      }
    } else loft(B, ss.map((s) => [p3(k, s, u(s) - w, 0.015), p3(k, s, u(s) + w, 0.015)]), 'gs-paint', () => UP, 4);
  };
  // the lanes between a and b, n of them (a lane line only where there are that many)
  const lanes = (k: number, a: (s: number) => number, b: (s: number) => number, n: (s: number) => number) => {
    paint(k, a, false); paint(k, b, false);
    for (let j = 1; j < 4; j++) paint(k, (s) => a(s) + ((b(s) - a(s)) * j) / n(s), true, (s) => j < n(s));
  };
  const W = E18_DECKS[0], E = E18_DECKS[1];
  lanes(0, (s) => W.left(s) + 1.9, (s) => W.right(s) - 1.3, () => 4);
  lanes(1, (s) => E.left(s) + 1.3, (s) => E.right(s) - 4.4, (s) => (E.right(s) - E.left(s) - 5.7 > 12.6 ? 4 : 3));
  B.tint(E18_PATH);
  loft(B, ss.map((s) => [p3(1, s, E.right(s) - 3.45, 0.012), p3(1, s, E.right(s) - 0.5, 0.012)]), 'rp-asphalt', () => UP, 6);

  // the abutments: under the deck from its end to the face, down to the ground
  for (const [a, b] of [[E18_ENDS[0], E18_SOUTH], [E18_NORTH, E18_ENDS[1]]]) {
    const s = (a + b) / 2, l = W.left(s) - 0.3, r = E.right(s) + 0.3;
    const low = Math.min(...[l, (l + r) / 2, r].flatMap((u) => [a, s, b].map((t) => { const p = E18.at(t, u); return ground(p[0], p[1]) ?? 0; })));
    const under = Math.min(topAt(0, s, W.right(s)), topAt(1, s, E.left(s))) - E18_DEPTH(s) + 0.1;
    if (low >= under) continue;
    B.tint(PIER);
    post(B, E18.at(s, (l + r) / 2), dir, Math.abs(b - a), r - l, low - 1, under, 'concrete', 4);
  }

  // the piers: under each girder, as wide as its bottom, darker at the foot
  for (const s of E18_PIERS) {
    E18_DECKS.forEach((d, k) => {
      const a = d.left(s), b = d.right(s), D = E18_DEPTH(s), I = Math.min(d.inset, (b - a) / 2 - 0.6);
      const web = Math.min(0.25 * (D - E18_EDGE), (b - a) / 2 - I - 0.3), half = (b - a) / 2 - I - web, mid = (a + b) / 2;
      const c = E18.at(s, mid), g = ground(c[0], c[1]), wet = g === null || g < 0.6;
      const foot = wet ? Math.min(g ?? -2, -1) - 1 : (g ?? 0) - 0.5, under = topAt(k, s, mid) - D + 0.02;
      B.tint(PIER);
      post(B, c, dir, 3.6, 2 * half - 0.2, foot, under, 'concrete', 4);
      B.tint(E18_FOOT);
      post(B, c, dir, 3.64, 2 * half - 0.16, foot, Math.max(g ?? 0.35, 0.35) + 2.2, 'concrete', 4);
    });
  }

  // the lamp masts, on the southbound deck's edge by the gap
  for (const s of E18_MASTS) {
    const u = W.right(s) - 0.25;
    lampMast(B, E18.at(s, u), topAt(0, s, u) + 0.25, 12.1, dir, [-4.4, 4.6]);
  }

  // the gantries: a lattice tower at each edge of the deck, a lattice beam across, the signs
  // hung on the side facing the traffic, lamps over them
  const sheet = T.E18_SIGNS;
  for (const g of E18_GANTRIES) {
    const d = E18_DECKS[g.deck], s = g.s, a = d.left(s) + 0.3, b = d.right(s) - 0.3, k = g.deck;
    const y0 = Math.min(topAt(k, s, a), topAt(k, s, b)) + 0.25, beam = Math.max(topAt(k, s, a), topAt(k, s, b)) + 6.0;
    // northbound signs face south, against the line; southbound ones north
    const face = g.deck === 1 ? -1 : 1;
    B.tint(E18_STEEL);
    for (const u of [a, b]) post(B, E18.at(s, u), dir, 0.7, 0.7, y0 - 0.25, beam + 1.0, 'sl-lattice', 0.9);
    B.wallBox(v3(E18.at(s, (a + b) / 2), 0), right, along, -(b - a) / 2 - 0.4, (b - a) / 2 + 0.4, beam, beam + 1.0, -0.45, 0.45, 'sl-lattice', 0.9);
    for (const sg of g.signs) {
      const r = sheet[sg.sign], w = r.w / 60, h = r.h / 60, u = a + (b - a) * sg.u, y = topAt(k, s, u) + sg.y;
      const o = v3(E18.at(s + face * 0.62, u), 0), n: V3 = [along[0] * face, 0, along[2] * face];
      // the panel: its face, and a grey back and edges
      B.tint(0x8a8f92);
      B.wallBox(o, right, along, -w / 2, w / 2, y, y + h, -0.06, 0.06, 'metal', 2);
      B.tint(0xffffff);
      const P = (du: number, dy: number): V3 => [o[0] + right[0] * du + n[0] * 0.075, y + dy, o[2] + right[2] * du + n[2] * 0.075];
      const U0 = r.x / 1024, U1 = (r.x + r.w) / 1024, V0 = 1 - (r.y + r.h) / 1024, V1 = 1 - r.y / 1024;
      // (seen from in front, the panel's left is to the west for a south-facing sign)
      const [ul, ur] = face < 0 ? [U0, U1] : [U1, U0];
      B.poly([P(-w / 2, 0), P(w / 2, 0), P(w / 2, h), P(-w / 2, h)], n, 'e18-signs', 1, [[ul, V0], [ur, V0], [ur, V1], [ul, V1]]);
      // and lamps on stalks over the bigger ones
      if (h < 1) continue;
      B.tint(E18_STEEL);
      for (let x = -w / 2 + 0.9; x < w / 2 - 0.5; x += 1.8) {
        const c: V2 = [o[0] + right[0] * x + n[0] * 0.5, o[2] + right[2] * x + n[2] * 0.5];
        post(B, c, dir, 0.06, 0.06, y + h - 0.2, y + h + 0.45, 'metal', 1);
        post(B, c, dir, 0.32, 0.2, y + h + 0.45, y + h + 0.6, 'metal', 1);
      }
    }
  }
}
