import type { Builder, V2, V3 } from './builder.ts';
import { rod } from './gamla-stan.ts';
import { type Ground, v3 } from './gubbangen.ts';
import { CONCRETE, KERB, UNDER } from './farsta-line-north.ts';
import { Line, loft, post, table } from './ropsten.ts';
import { buildRoadDeck, type RoadDeck } from './road-bridges.ts';

// Johanneshovsbron, Söderleden's bridge out of Söderledstunneln at Skanstull, over Hammarby kanal
// and over the southern end of Skanstullsbron to Johanneshovsmotet at Gullmarsplan (prestressed
// concrete, opened in 1984): t metres along the middle of its deck from Skanstull, u to the right
// (west).
//
// - Four lanes and a median barrier on a single box girder with wide cantilevers, 19.4 m across,
//   on bents about 51 m apart: two slender columns side by side, and single round ones where it
//   stands among Skanstullsbron's decks (one in the gap between their metro and road decks, one in
//   the gore where Skanstullsbron's ramps part). Lamp masts on the median, lattice gantries with
//   signs and the congestion tax's cameras.
// - South of the canal it widens for its ramps, which part from it over Skanstullsbron's end: the
//   off-ramp for Gullmarsplan on the west, the on-ramp from it on the east, each on its own box and
//   round columns, over the roads up from Skanstullsbron at the ground. Between them the main lanes
//   come down to an embankment and on into the cutting under the roundabout
//   (src/detail/johanneshovsmotet.ts).
//
// The deck's edges, its heights and its cross slope from Lantmäteriet's laser scan (Laserdata
// Nedladdning, skog, 2021, CC BY 4.0); the bents where Google's 3D mesh has them, and the box and
// the columns as photographs on Wikimedia Commons show them (the mesh is no help under the deck);
// the ramps' lines from OpenStreetMap's ways, smoothed, which the city leaves out, being bridges.
export const JB_LINE: V2[] = [
  [927.64, 2809.88], [932.92, 2829.17], [938.34, 2848.42], [944.13, 2867.56], [950.02, 2886.68], [956.1, 2905.73], [962.46, 2924.69],
  [969.08, 2943.56], [975.96, 2962.34], [983.2, 2980.98], [990.44, 2999.63], [997.69, 3018.27], [1005.39, 3036.72], [1013.44, 3055.03],
  [1021.49, 3073.34], [1029.56, 3091.64], [1038.13, 3109.71], [1047.0, 3127.63], [1056.29, 3145.35], [1066.13, 3162.76], [1076.26, 3180.0],
  [1086.74, 3197.04], [1097.59, 3213.84], [1109.06, 3230.22], [1120.84, 3246.38], [1132.77, 3262.43], [1144.9, 3278.33], [1157.04, 3294.23],
  [1168.96, 3310.29], [1180.31, 3326.75], [1191.62, 3343.25], [1202.92, 3359.75], [1213.68, 3376.61], [1223.64, 3393.95], [1232.68, 3411.78],
  [1240.9, 3430.02], [1248.38, 3448.56], [1254.95, 3467.45], [1261.17, 3486.46], [1267.38, 3505.47], [1273.6, 3524.48],
];
export const JB = new Line(JB_LINE);
// the road's height along the middle (the scan's deck, every 16 m), and its cross slope (rising to
// the right): falling 2 % to the west to the canal, then turning over to fall to the east, the
// side the bridge bends to
const Y = table([
  [-18, 20.15], [-16, 20.24], [0, 20.91], [16, 21.56], [32, 22.23], [48, 22.93], [64, 23.59], [80, 24.28], [96, 24.95], [112, 25.61],
  [128, 26.26], [144, 26.96], [160, 27.65], [176, 28.32], [192, 28.98], [208, 29.65], [224, 30.32], [240, 30.98], [256, 31.66], [272, 32.34],
  [288, 33.02], [304, 33.71], [320, 34.37], [336, 35.03], [352, 35.7], [368, 36.4], [384, 37.06], [400, 37.76], [416, 38.43], [432, 39.08],
  [448, 39.74], [464, 40.41], [480, 41.09], [496, 41.75], [512, 42.39], [520, 42.7], [528, 42.97], [536, 43.19], [544, 43.41], [552, 43.58],
  [560, 43.75], [568, 43.87], [576, 43.98], [584, 44.03], [592, 44.08], [600, 44.16], [608, 44.22], [616, 44.28], [624, 44.33], [632, 44.34],
  [640, 44.29], [648, 44.22], [656, 44.12], [664, 43.99], [672, 43.86], [680, 43.71], [688, 43.52], [696, 43.32], [704, 43.15], [712, 42.88],
  [720, 42.58], [728, 42.29], [736, 41.97], [744, 41.65], [752, 41.29], [760, 40.9], [768, 40.5], [776, 40.15],
]);
const X = table([
  [500, 0.02], [512, 0.017], [520, 0.012], [528, 0.0084], [536, 0.0044], [544, 0.0006], [552, -0.0024], [560, -0.0058], [568, -0.0121],
  [576, -0.0145], [584, -0.0177], [592, -0.0206], [600, -0.0223], [608, -0.0245], [616, -0.0255], [624, -0.0287], [632, -0.0306],
  [640, -0.0312], [648, -0.0317], [656, -0.0377], [664, -0.0421], [672, -0.0395], [680, -0.039], [688, -0.0367], [696, -0.034],
  [704, -0.029], [712, -0.026], [720, -0.024], [728, -0.022], [736, -0.0208], [744, -0.0168], [752, -0.0105], [760, -0.008], [768, -0.0035],
]);
// where the off-ramp's lane runs on the deck before it parts, it rises over the deck's slope
const RISE = table([[648, 0], [656, 0.19], [664, 0.36]]);
const jbTop = (t: number, u: number) => Y(t) + X(t) * u;
const wideTop = (t: number, u: number) => jbTop(t, u) + (t < 664 ? RISE(t) * Math.min(1, Math.max(0, (u - 9) / 2)) : 0);
// its edges: 19.4 m across, and wider from 500 m for the ramps, which part from it at 664 m
const LO = table([[500, -9.7], [512, -10.3], [528, -10.7], [544, -11.0], [560, -11.2], [584, -11.4], [600, -12.4], [608, -13.0], [640, -13.4],
  [648, -13.6], [656, -14.4], [664, -15.2]]);
const HI = table([[500, 9.7], [512, 10.2], [528, 10.6], [544, 11.0], [568, 11.3], [584, 12.2], [600, 12.3], [616, 13.2], [632, 14.2], [640, 15.0],
  [648, 15.5], [656, 16.3], [664, 17.0]]);
const SPLIT = 664, END = 772;
// the ramps' middles on the deck before they part (u at t)
const OFF_U = table([[557.3, 5.03], [565.4, 5.75], [573.4, 6.39], [581.4, 7.02], [589.4, 7.63], [597.3, 8.24], [605.3, 8.85], [613.3, 9.46],
  [621.5, 10.02], [629.6, 10.42], [637.7, 10.99], [646.1, 11.6], [654.0, 12.49], [662.6, 13.38], [664, 13.5]]);
const ON_U = table([[555.2, -5.46], [563.0, -6.55], [570.8, -7.73], [578.8, -8.65], [586.7, -9.27], [594.7, -9.64], [602.7, -9.96],
  [610.7, -10.28], [618.6, -10.51], [626.4, -10.87], [634.3, -11.18], [641.9, -11.51], [649.8, -12.05], [657.6, -12.55], [664, -13.2]]);

// the slab, its edge beams and fascias, its road and fittings
const SLAB = { depth: 0.5, edge: 0.45, fascia: 0.95 };
const LAMPS = { at: Array.from({ length: 19 }, (_, i) => 6 + 42 * i), u: 0, h: 12, arms: [-3.4, 3.4], raise: 0.81 };
const MAIN_LINES = {
  solid: [-8.2, -0.75, 0.75, 8.2, { u: (t: number) => HI(t) - 1.0, range: [512, SPLIT] as V2 }, { u: (t: number) => LO(t) + 1.0, range: [512, SPLIT] as V2 },
    { u: (t: number) => OFF_U(t) - 2.5, range: [640, SPLIT] as V2 }, { u: (t: number) => ON_U(t) + 2.5, range: [630, SPLIT] as V2 }],
  dashed: [-4.45, 4.45],
  barriers: [0],
};
const WIDE: RoadDeck = {
  line: JB_LINE, from: -18, to: SPLIT, edges: (t) => [LO(t), HI(t)], top: wideTop, ...SLAB, ...MAIN_LINES, lamps: LAMPS, abutments: [16, 0],
};
const MAIN_B: RoadDeck = {
  line: JB_LINE, from: SPLIT, to: END, edges: () => [-9.7, 9.7], top: jbTop, ...SLAB, ...MAIN_LINES, lamps: LAMPS, abutments: [0, 30], ends: [false, true],
};

// the box under it: its webs from under the slab 5 m either side of the middle down to its floor,
// 2.6 m under the road and 6.4 m across, from the northern abutment to the southern
const BOX: V2[] = [[-5.0, -0.5], [-3.2, -2.6], [3.2, -2.6], [5.0, -0.5]];
const BOX_SPAN: V2 = [-2, END - 30];
// the bents: two columns side by side under the box, or one, round, at u
type Bent = { t: number; u?: number };
const BENTS: Bent[] = [43.4, 93.4, 144.9, 194.4, 245.9, 297.4, 348.4, 403.4, 456.4, 509.4, 557, { t: 606.4, u: 0 }, { t: 658, u: -5 }, 710]
  .map((b) => (typeof b === 'number' ? { t: b } : b));
const TWIN = 1.45, TWIN_W: V2 = [1.5, 1.3], ROUND = 0.9;
// the gantries: signs over both carriageways, or the congestion tax's cameras
const GANTRIES: { t: number; signs: boolean }[] = [{ t: 40, signs: true }, { t: 93, signs: true }, { t: 298, signs: false }, { t: 318, signs: false }];

// The parts, each built with the tile it is in: t from and to.
export const JOHANNESHOVSBRON_PARTS: { range: V2; anchor: V2 }[] = [[-18, 150], [150, 330], [330, 500], [500, SPLIT], [SPLIT, END]]
  .map(([a, b]) => ({ range: [a, b] as V2, anchor: JB.at((a + b) / 2, 0) }));

export function buildJohanneshovsbron(B: Builder, ground: Ground, [t0, t1]: V2) {
  B.place([0, 0, 0], 0);
  const L = JB, inPart = (t: number) => t >= t0 && t < t1;
  if (t0 < SPLIT) buildRoadDeck(B, ground, WIDE, [t0, Math.min(t1, SPLIT)]);
  if (t1 > SPLIT) buildRoadDeck(B, ground, MAIN_B, [Math.max(t0, SPLIT), t1]);

  // the box
  const b0 = Math.max(t0, BOX_SPAN[0]), b1 = Math.min(t1, BOX_SPAN[1]);
  if (b1 > b0) {
    const ts = steps(b0, b1, 2);
    B.tint(UNDER);
    loft(B, ts.map((t) => BOX.map(([u, dy]) => v3(L.at(t, u), jbTop(t, u) + dy))), 'fl-under', (i, k) => web(L, ts[i], k), 3);
  }
  // the bents, from the ground to the box's floor
  B.tint(CONCRETE);
  for (const b of BENTS.filter((b) => inPart(b.t))) {
    const a = L.along(b.t), dir: V2 = [a[0], a[2]];
    if (b.u !== undefined) {
      const p = L.at(b.t, b.u), y = jbTop(b.t, b.u) - 2.6 + 0.02;
      B.lathe(p[0], p[1], [[ROUND, foot(ground, p, y)], [ROUND, y]], 'concrete', 20, 3);
      continue;
    }
    for (const u of [-TWIN, TWIN]) {
      const p = L.at(b.t, u), y = jbTop(b.t, u) - 2.6 + 0.02;
      post(B, p, dir, TWIN_W[0], TWIN_W[1], foot(ground, p, y), y, 'concrete', 3);
    }
  }
  // the gantries
  for (const g of GANTRIES.filter((g) => inPart(g.t))) gantry(B, L, g.t, [LO(g.t), HI(g.t)], jbTop, g.signs);
}

// the stations from a to b, about every `step` metres
function steps(a: number, b: number, step: number) {
  const n = Math.max(1, Math.ceil((b - a) / step));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}
// a box's faces' sides: its left web, its floor, its right web
function web(L: Line, t: number, k: number): V3 {
  const r = L.right(t);
  return k === 0 ? [-r[0], -0.5, -r[2]] : k === 1 ? [0, -1, 0] : [r[0], -0.5, r[2]];
}
// a column's foot: under the ground, or 6 m under its top where the ground isn't known
const foot = (ground: Ground, p: V2, y: number) => (ground(p[0], p[1]) ?? y - 6) - 0.3;

// A lattice gantry across the deck at t: a tower of four angles braced on each edge, 7.4 m tall,
// and a truss between them, with a sign over each carriageway on the side facing its traffic, or
// cameras.
function gantry(B: Builder, L: Line, t: number, [lo, hi]: V2, top: (t: number, u: number) => number, signs: boolean) {
  const a = L.along(t);
  const P = (s: number, u: number, h: number): V3 => { const p = L.at(t + s, u); return [p[0], top(t, u) + h, p[1]]; };
  const H = 7.4, W = 0.35, A = 0.05;
  B.tint(0x8f9497);
  for (const uc of [lo + 0.8, hi - 0.8]) {
    const c = [[-W, -W], [W, -W], [W, W], [-W, W]] as V2[];
    for (const [s, du] of c) rod(B, P(s, uc + du, KERB + H), P(s, uc + du, KERB), A, A, 'metal');
    for (let h = KERB + 0.6; h < KERB + H; h += 1.2) {
      for (let k = 0; k < 4; k++) {
        const [s0, d0] = c[k], [s1, d1] = c[(k + 1) % 4];
        rod(B, P(s0, uc + d0, h + 0.03), P(s1, uc + d1, h + 0.03), A, A, 'metal');
        rod(B, P(s0, uc + d0, h + 0.03), P(s1, uc + d1, Math.min(h + 1.23, KERB + H)), 0.04, 0.04, 'metal');
      }
    }
  }
  // the truss: four chords and their bracing
  const u0 = lo + 0.8, u1 = hi - 0.8, y0 = KERB + H - 1.0, y1 = KERB + H;
  for (const s of [-W, W]) for (const y of [y0, y1]) rod(B, P(s, u0, y + 0.03), P(s, u1, y + 0.03), 0.07, 0.07, 'metal');
  const n = Math.round((u1 - u0) / 1.2);
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n, un = u0 + ((u1 - u0) * Math.min(n, i + 1)) / n;
    for (const s of [-W, W]) {
      rod(B, P(s, u, y1), P(s, u, y0), A, A, 'metal');
      if (i < n) rod(B, P(s, u, y0 + 0.03), P(s, un, y1), 0.04, 0.04, 'metal');
    }
    rod(B, P(-W, u, y1 + 0.03), P(W, u, y1 + 0.03), A, A, 'metal');
  }
  // signs on its faces, or the cameras' boxes under it
  for (const [ua, ub, side] of [[1.2, 8.4, -1], [-8.4, -1.2, 1]] as const) {
    if (!signs) {
      B.tint(0x3a3d40);
      for (const u of [ua + 1.9, ub - 1.9]) {
        const p = L.at(t, u);
        B.box([p[0] - 0.2, top(t, u) + y0 - 0.45, p[1] - 0.2], [p[0] + 0.2, top(t, u) + y0 - 0.05, p[1] + 0.2], 'metal', 1);
      }
      continue;
    }
    const s = side * (W + 0.08), ym = (y0 + y1) / 2, n3: V3 = [a[0] * side, 0, a[2] * side];
    const face = (u: number, h: number) => P(s, u, ym + h);
    const panel = [face(ua + 0.4, -1.1), face(ub - 0.4, -1.1), face(ub - 0.4, 1.1), face(ua + 0.4, 1.1)];
    B.tint(0x1f5aa6);
    B.poly(panel, n3, 'metal', 1);
    B.tint(0x8f9497);
    B.poly(panel.map((p): V3 => [p[0] - n3[0] * 0.06, p[1], p[2] - n3[2] * 0.06]), [-n3[0], 0, -n3[2]], 'metal', 1);
    B.tint(0xf2f2f0);
    for (const k of [0, 1, 2]) {
      const v = 0.55 - k * 0.55, ul = ua + 1.0, ur = ua + 1.0 + (ub - ua - 2.0) * (k === 1 ? 0.62 : 0.8);
      const lift = (p: V3): V3 => [p[0] + n3[0] * 0.01, p[1], p[2] + n3[2] * 0.01];
      B.poly([face(ul, v - 0.12), face(ur, v - 0.12), face(ur, v + 0.12), face(ul, v + 0.12)].map(lift), n3, 'metal', 1);
    }
  }
}

// ------------------------------------------------------------------ the ramps
// Off the bridge for Gullmarsplan on the west and onto it from there on the east: along OpenStreetMap's
// ways, smoothed, s from where they leave the main lanes' edge on the deck. Each lies on the deck
// till it parts (s 106 and 111) and then on its own box on single round columns, falling to the
// roundabout's deck, where it meets the road up from Skanstullsbron beside it (the off-ramp) or
// leaves the road down to it (the on-ramp): there the two decks' edges meet halfway between them.
export const OFF_LINE: V2[] = [
  [1163.3, 3311.1], [1168.19, 3319.55], [1173.07, 3328.0], [1177.96, 3336.45], [1182.85, 3344.9], [1187.73, 3353.35], [1192.62, 3361.8],
  [1197.51, 3370.25], [1202.27, 3378.77], [1206.59, 3387.52], [1210.48, 3396.48], [1214.19, 3405.5], [1217.72, 3414.61], [1220.97, 3423.81],
  [1224.01, 3433.08], [1227.01, 3442.37], [1230.03, 3451.66], [1233.07, 3460.93], [1236.14, 3470.2], [1239.21, 3479.47], [1242.28, 3488.73],
  [1245.34, 3498.0], [1248.38, 3507.28], [1251.43, 3516.55], [1254.44, 3525.84], [1257.38, 3535.14], [1260.29, 3544.46], [1263.19, 3553.78],
  [1266.1, 3563.1],
];
export const ON_LINE: V2[] = [
  [1170.5, 3303.2], [1177.24, 3310.27], [1183.89, 3317.43], [1190.15, 3324.93], [1196.05, 3332.72], [1201.89, 3340.55], [1207.72, 3348.39],
  [1213.45, 3356.31], [1219.03, 3364.32], [1224.53, 3372.4], [1229.96, 3380.52], [1235.34, 3388.68], [1240.64, 3396.89], [1245.76, 3405.21],
  [1250.65, 3413.67], [1255.35, 3422.24], [1259.77, 3430.94], [1263.92, 3439.79], [1267.72, 3448.79], [1271.2, 3457.92], [1274.42, 3467.15],
  [1277.62, 3476.38], [1280.83, 3485.61], [1283.98, 3494.86], [1287.01, 3504.14], [1289.98, 3513.45], [1292.94, 3522.76], [1295.91, 3532.07],
  [1298.87, 3541.38], [1301.84, 3550.69], [1304.82, 3559.99], [1307.8, 3569.3],
];
interface Ramp {
  deck: RoadDeck;
  // from where its box runs under the main deck, and where it parts from it
  box: number; parts: number;
  // its columns: s and u
  columns: V2[];
}
const RAMP_SLAB = { depth: 0.5, edge: 0.4, fascia: 0.9 };
const OFF_TOP = table([[106, 43.77], [116, 43.73], [124, 43.67], [132, 43.62], [140, 43.62], [148, 43.6], [156, 43.53], [164, 43.5], [172, 43.47],
  [180, 43.43], [188, 43.38], [196, 43.33], [204, 43.31], [212, 43.28], [220, 43.23], [228, 43.2], [236, 43.18], [244, 43.1], [252, 42.99],
  [260, 42.96], [268, 42.92], [273.3, 42.9]]);
const ON_TOP = table([[111, 44.55], [120, 44.48], [126, 44.42], [134, 44.36], [142, 44.28], [150, 44.28], [158, 44.23], [166, 44.15], [174, 44.08],
  [182, 44.02], [190, 43.96], [198, 43.89], [206, 43.82], [214, 43.76], [222, 43.7], [230, 43.65], [238, 43.59], [254, 43.45], [262, 43.39],
  [270, 43.33], [278, 43.27], [291.5, 43.17]]);
const OFF_LO = table([[106, -3.3], [205, -3.3], [215, -3.11], [226, -3.13], [238, -3.18], [250, -3.27], [256, -3.3], [262, -3.3], [268, -3.25],
  [272.3, -3.12]]);
const ON_LO = table([[106, -2.0], [127, -2.6], [135, -3.2], [150, -3.8], [300, -3.9]]);
const ON_HI = table([[106, 3.5], [120, 3.3], [268, 3.3], [272, 3.29], [278, 3.24], [283, 3.09]]);
export const OFF_RAMP: Ramp = {
  deck: {
    line: OFF_LINE, from: 106, to: 272.3, edges: (s) => [OFF_LO(s), 3.5], top: (s, u) => OFF_TOP(s) - 0.035 * u, ...RAMP_SLAB,
    solid: [-2.5, 2.5], lamps: { at: [128, 168, 208, 248], u: 3.0, h: 10, arms: [-2.6], raise: KERB }, ends: [false, false],
  },
  box: 40, parts: 106,
  columns: [[131, 0], [156, 0], [181, 0], [206, 0], [231, 0], [256, 0]],
};
export const ON_RAMP: Ramp = {
  deck: {
    line: ON_LINE, from: 111, to: 283, edges: (s) => [ON_LO(s), ON_HI(s)], top: (s, u) => ON_TOP(s) - 0.025 * u, ...RAMP_SLAB,
    solid: [(s: number) => ON_LO(s) + 1.0, 2.5], lamps: { at: [138, 178, 218, 258], u: (s: number) => ON_LO(s) + 0.5, h: 10, arms: [2.6], raise: KERB },
    ends: [false, false],
  },
  box: 24, parts: 111,
  columns: [[144, -1], [169, 0], [194, 0], [219, 0], [244, 0], [269, 0]],
};
const RAMP_BOX: V2[] = [[-2.6, -0.5], [-1.9, -1.9], [1.9, -1.9], [2.6, -0.5]];

// where a point is along a line, from a guess: t and u
export function locate(L: Line, p: V2, t: number): V2 {
  for (let k = 0; k < 8; k++) {
    const q = L.at(t, 0), a = L.along(t);
    t += (p[0] - q[0]) * a[0] + (p[1] - q[1]) * a[2];
  }
  const q = L.at(t, 0), r = L.right(t);
  return [t, (p[0] - q[0]) * r[0] + (p[1] - q[1]) * r[2]];
}

export function buildRamp(B: Builder, ground: Ground, R: Ramp) {
  B.place([0, 0, 0], 0);
  const d = R.deck, L = new Line(d.line);
  buildRoadDeck(B, ground, d);
  // its surface: the bridge's where it lies on it
  let guess = 557;
  const top = (s: number, u: number) => {
    if (s >= R.parts) return d.top(s, u);
    const [t, v] = locate(JB, L.at(s, u), guess);
    guess = t;
    return wideTop(t, v);
  };
  const ss = steps(R.box, d.to, 2);
  B.tint(UNDER);
  const rows = ss.map((s) => RAMP_BOX.map(([u, dy]) => v3(L.at(s, u), top(s, u) + dy)));
  loft(B, rows, 'fl-under', (i, k) => web(L, ss[i], k), 3);
  // (its end under the bridge's deck)
  const a = L.along(R.box);
  B.poly([...rows[0]].reverse(), [-a[0], 0, -a[2]], 'fl-under', 3);
  B.tint(CONCRETE);
  for (const [s, u] of R.columns) {
    const p = L.at(s, u), y = top(s, u) - 1.9 + 0.02;
    B.lathe(p[0], p[1], [[0.65, foot(ground, p, y)], [0.65, y]], 'concrete', 16, 3);
  }
}
