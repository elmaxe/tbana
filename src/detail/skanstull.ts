import type { Builder, V2 } from './builder.ts';
import { lampMast, lines, Line, table } from './ropsten.ts';
import { block, Frame, type Ground } from './gubbangen.ts';
import { band, barRailing, chainFence, CONCRETE, type Edge, KERB, line, off, RAILING, railAt, type Rows, steps, track } from './farsta-line-north.ts';
import { buildViaduct, type Support, type Viaduct } from './skarpnack-line.ts';

// Skanstullsbron, which carries the green line and Götgatan's continuation (the road to
// Johanneshov and Nynäsvägen) side by side over Hammarby kanal from Gullmarsplan to Södermalm: s
// metres northwards (north-north-west) from the southern end of the eastern track's bridge in
// OpenStreetMap, u to the right (east-north-east); the western track is the second.
//
// - The metro's deck on the west, 7.5 m wide, and where the turnback siding runs between its
//   tracks, south of the canal, up to 14 m; on the east the road's, 28 m wide: a cycleway and a
//   footway along the metro's side, behind a fence, two lanes southbound, a raised median with the
//   lamp masts, two lanes northbound, and another cycleway and footway along its eastern edge.
// - Concrete, 1946–47 (David Dahl, architect; Swedish Wikipedia). Over the slopes down from
//   Gullmarsplan, the canal and the shore north of it, the decks stand on tall bents about 25–28 m
//   apart: a slender rectangular column under the metro's deck and three under the road's, each
//   pair of decks deepening in a haunch over them. North of that both decks cross the low ground at
//   Södermalm's foot on a concrete arch each, about 100 m across, their crowns 4 m under the rails,
//   carrying the decks on short columns 9–10 m apart, as do the short spans at the arches' ends.
//
// The decks' edges and heights, the arches' crowns and the ground under them from Lantmäteriet's
// laser scan (Laserdata Nedladdning, skog, 2021, CC BY 4.0); the bents, the arches' spans and
// springings and the columns from Google's 3D mesh; the streets, paths and Tvärbanan's tracks under
// it from OpenStreetMap, which the bents keep clear of. The tracks' heights are the laser scan's
// (data/height-corrections.json). The network draws the tracks on the metro's deck and leaves its
// girders, piers and railings to this (src/detail/viaducts.ts); the city leaves out the road on
// it, OpenStreetMap's bridge, which this lays on its deck. Johanneshovsbron beside it and the
// roundabout at its southern end are src/detail/johanneshovsbron.ts and johanneshovsmotet.ts.
export const SKANSTULLSBRON = new Frame([1194.73, 3352.91], [-0.2973, -0.9548]);
const SB = SKANSTULLSBRON;
const SB_TRACKS: Rows = [
  [-100, -8.79, 37.096, -22.56, 37.11], [-96, -8.5, 37.078, -21.97, 37.093], [-92, -8.2, 37.06, -21.38, 37.076], [-88, -7.93, 37.043, -20.78, 37.059],
  [-84, -7.66, 37.026, -20.19, 37.043], [-80, -7.34, 37.009, -19.6, 37.026], [-76, -7, 36.991, -19.01, 37.009], [-72, -6.65, 36.975, -18.41, 36.992],
  [-68, -6.29, 36.963, -17.82, 36.975], [-64, -5.93, 36.949, -17.21, 36.958], [-60, -5.54, 36.936, -16.62, 36.941], [-56, -5.15, 36.923, -16.05, 36.926],
  [-52, -4.76, 36.913, -15.51, 36.913], [-48, -4.39, 36.905, -14.98, 36.901], [-44, -4.01, 36.894, -14.49, 36.884], [-40, -3.63, 36.881, -14, 36.867],
  [-36, -3.25, 36.868, -13.56, 36.851], [-32, -2.88, 36.854, -13.11, 36.834], [-28, -2.54, 36.842, -12.67, 36.818], [-24, -2.18, 36.829, -12.26, 36.801],
  [-20, -1.82, 36.815, -11.85, 36.784], [-16, -1.46, 36.802, -11.46, 36.767], [-12, -1.1, 36.789, -11.08, 36.75], [-8, -0.75, 36.776, -10.7, 36.732],
  [-4, -0.38, 36.763, -10.34, 36.711], [0, 0, 36.75, -9.97, 36.69], [4, 0.41, 36.73, -9.64, 36.67], [8, 0.83, 36.71, -9.3, 36.649],
  [12, 1.24, 36.689, -8.97, 36.63], [16, 1.6, 36.669, -8.66, 36.614], [20, 1.97, 36.649, -8.37, 36.596], [24, 2.29, 36.629, -8.13, 36.575],
  [28, 2.62, 36.609, -7.9, 36.554], [32, 2.92, 36.591, -7.78, 36.534], [36, 3.2, 36.575, -7.68, 36.514], [40, 3.48, 36.558, -7.57, 36.495],
  [44, 3.71, 36.538, -7.43, 36.479], [48, 3.93, 36.518, -7.28, 36.463], [52, 4.12, 36.498, -7.09, 36.444], [56, 4.27, 36.478, -6.89, 36.424],
  [60, 4.43, 36.458, -6.68, 36.404], [64, 4.52, 36.438, -6.42, 36.383], [68, 4.61, 36.418, -6.17, 36.363], [72, 4.67, 36.398, -5.89, 36.346],
  [76, 4.72, 36.377, -5.61, 36.33], [80, 4.75, 36.357, -5.32, 36.314], [84, 4.77, 36.337, -5.02, 36.298], [88, 4.78, 36.317, -4.71, 36.282],
  [92, 4.78, 36.297, -4.4, 36.266], [96, 4.76, 36.277, -4.1, 36.25], [100, 4.75, 36.257, -3.77, 36.234], [104, 4.72, 36.237, -3.47, 36.218],
  [108, 4.7, 36.217, -3.17, 36.202], [112, 4.67, 36.2, -2.88, 36.186], [116, 4.63, 36.184, -2.59, 36.17], [120, 4.59, 36.167, -2.31, 36.155],
  [124, 4.55, 36.146, -2.06, 36.143], [128, 4.52, 36.126, -1.8, 36.131], [132, 4.48, 36.106, -1.57, 36.116], [136, 4.44, 36.086, -1.33, 36.099],
  [140, 4.4, 36.066, -1.12, 36.083], [144, 4.36, 36.046, -0.94, 36.067], [148, 4.32, 36.026, -0.75, 36.051], [152, 4.28, 36.006, -0.6, 36.027],
  [156, 4.24, 35.986, -0.46, 36.003], [160, 4.2, 35.967, -0.33, 35.981], [164, 4.16, 35.951, -0.23, 35.961], [168, 4.11, 35.935, -0.13, 35.941],
  [172, 4.07, 35.888, -0.06, 35.898], [176, 4.02, 35.832, 0, 35.854], [180, 3.98, 35.766, 0.05, 35.787], [184, 3.93, 35.67, 0.09, 35.691],
  [188, 3.88, 35.574, 0.12, 35.59], [192, 3.83, 35.478, 0.13, 35.494], [196, 3.79, 35.382, 0.14, 35.398], [200, 3.74, 35.286, 0.14, 35.302],
  [204, 3.68, 35.19, 0.13, 35.206], [208, 3.63, 35.094, 0.12, 35.11], [212, 3.57, 34.998, 0.1, 35.01], [216, 3.51, 34.902, 0.08, 34.91],
  [220, 3.45, 34.806, 0.06, 34.812], [224, 3.39, 34.705, 0.03, 34.716], [228, 3.33, 34.609, 0, 34.62], [232, 3.27, 34.513, -0.03, 34.524],
  [236, 3.2, 34.417, -0.07, 34.428], [240, 3.14, 34.318, -0.11, 34.328], [244, 3.07, 34.21, -0.15, 34.224], [248, 3, 34.102, -0.2, 34.12],
  [252, 2.93, 33.958, -0.25, 33.96], [256, 2.85, 33.806, -0.31, 33.808], [260, 2.78, 33.654, -0.36, 33.656], [264, 2.71, 33.502, -0.42, 33.504],
  [268, 2.64, 33.35, -0.48, 33.352], [272, 2.57, 33.191, -0.53, 33.2], [276, 2.51, 33.039, -0.59, 33.048], [280, 2.46, 32.885, -0.64, 32.892],
  [284, 2.41, 32.729, -0.69, 32.732], [288, 2.36, 32.573, -0.74, 32.572], [292, 2.32, 32.417, -0.78, 32.416], [296, 2.28, 32.261, -0.82, 32.26],
  [300, 2.25, 32.104, -0.86, 32.104], [304, 2.21, 31.944, -0.89, 31.948], [308, 2.18, 31.784, -0.93, 31.792], [312, 2.15, 31.627, -0.97, 31.632],
  [316, 2.12, 31.471, -1, 31.464], [320, 2.09, 31.308, -1.04, 31.306], [324, 2.06, 31.152, -1.07, 31.15], [328, 2.03, 30.996, -1.1, 30.994],
  [332, 2, 30.84, -1.14, 30.838], [336, 1.97, 30.684, -1.17, 30.682], [340, 1.93, 30.524, -1.21, 30.522], [344, 1.9, 30.36, -1.25, 30.358],
  [348, 1.86, 30.196, -1.3, 30.194], [352, 1.82, 30.036, -1.34, 30.034], [356, 1.78, 29.876, -1.38, 29.874], [360, 1.73, 29.716, -1.42, 29.714],
  [364, 1.68, 29.556, -1.46, 29.554], [368, 1.63, 29.396, -1.51, 29.394], [372, 1.58, 29.224, -1.56, 29.23], [376, 1.53, 29.06, -1.6, 29.066],
  [380, 1.48, 28.898, -1.65, 28.896], [384, 1.43, 28.738, -1.7, 28.736], [388, 1.38, 28.578, -1.74, 28.576], [392, 1.33, 28.418, -1.79, 28.416],
  [396, 1.27, 28.258, -1.84, 28.256], [400, 1.22, 28.096, -1.89, 28.096], [404, 1.17, 27.932, -1.94, 27.936], [408, 1.13, 27.768, -1.99, 27.775],
  [412, 1.08, 27.608, -2.03, 27.611], [416, 1.04, 27.448, -2.08, 27.447], [420, 0.99, 27.28, -2.12, 27.286], [424, 0.95, 27.12, -2.17, 27.126],
  [428, 0.91, 26.96, -2.22, 26.966], [432, 0.88, 26.796, -2.26, 26.806], [436, 0.84, 26.632, -2.31, 26.646], [440, 0.81, 26.47, -2.36, 26.483],
  [444, 0.78, 26.31, -2.41, 26.311], [448, 0.75, 26.15, -2.46, 26.148], [452, 0.73, 25.986, -2.5, 25.988], [456, 0.71, 25.822, -2.55, 25.828],
  [460, 0.69, 25.66, -2.59, 25.665], [464, 0.67, 25.5, -2.64, 25.501], [468, 0.65, 25.332, -2.69, 25.338], [472, 0.63, 25.168, -2.73, 25.178],
  [476, 0.6, 25.004, -2.78, 25.018], [480, 0.58, 24.842, -2.82, 24.855], [484, 0.55, 24.682, -2.86, 24.691], [488, 0.53, 24.522, -2.9, 24.528],
  [492, 0.5, 24.358, -2.94, 24.368], [496, 0.48, 24.194, -2.99, 24.208], [500, 0.45, 24.032, -3.03, 24.048], [504, 0.41, 23.872, -3.07, 23.888],
  [508, 0.38, 23.712, -3.11, 23.72], [512, 0.34, 23.548, -3.15, 23.56], [516, 0.31, 23.384, -3.19, 23.4], [520, 0.27, 23.214, -3.24, 23.237],
  [524, 0.22, 23.054, -3.28, 23.073], [528, 0.18, 22.894, -3.32, 22.91], [532, 0.14, 22.73, -3.36, 22.75], [536, 0.1, 22.566, -3.41, 22.59],
  [540, 0.06, 22.404, -3.44, 22.43], [544, 0.02, 22.244, -3.48, 22.27], [548, -0.01, 22.086, -3.51, 22.113], [552, -0.05, 21.927, -3.54, 21.95]
];
const A = (s: number) => track(SB_TRACKS, s, 0)[0], W = (s: number) => track(SB_TRACKS, s, 1)[0];
// the metro's deck, from 2.6 m west of its western track to 1.5 m east of its eastern track (the
// laser scan's edges, and the gap at the fence between it and the road's)
const RAIL_LO: Edge = (s) => W(s) - 2.6, RAIL_HI: Edge = (s) => A(s) + 1.5;
// the road's deck, from the metro's to its eastern edge: 29.2 m east of the eastern track, and
// wider south of the canal where the interchange's ramps leave it
const ROAD_LO: Edge = RAIL_HI;
const ROAD_EAST = table([[-64, 45.0], [-48, 44.9], [-40, 44.9], [-32, 44.1], [-24, 42.7], [-16, 41.6], [-8, 40.7], [0, 39.7], [8, 38.6],
  [16, 37.8], [32, 36.4], [40, 36.0], [48, 34.9], [56, 34.8], [64, 34.4]]);
const ROAD_HI: Edge = (s) => (s < 72 ? ROAD_EAST(s) : A(s) + 29.2);
// the road's surface along it (the laser scan's deck, the median every 16 m): the rails' height to
// the arches, then levelling out more slowly than the tracks, which dive into the cutting at its
// northern end
const ROAD = table([[-64, 36.7], [-32, 36.61], [-16, 36.62], [0, 36.56], [16, 36.48], [32, 36.43], [48, 36.39], [64, 36.34], [80, 36.28],
  [96, 36.22], [112, 36.16], [128, 36.09], [144, 36.03], [160, 35.96], [176, 35.91], [192, 35.8], [208, 35.58], [224, 35.23], [240, 34.74],
  [256, 34.15], [272, 33.5], [288, 32.83], [304, 32.16], [320, 31.5], [336, 30.84], [352, 30.17], [368, 29.47], [384, 28.74], [400, 27.98],
  [416, 27.27], [432, 26.67], [448, 26.09], [464, 25.47], [480, 24.88], [496, 24.32], [512, 23.8], [528, 23.34], [544, 22.93], [560, 22.62]]);
// (as a track down its middle, for the viaduct's heights)
const SB_ROAD: Rows = steps(-72, 556, [], 8).map((s) => [s, A(s) + 15.35, ROAD(s) - 0.1]);
// the cross-section from the eastern track: the fence, the western cycleway and footway, the
// southbound lanes, the median, the northbound lanes; the eastern path to the edge
const PATH_W = 8.0, SOUTHBOUND: V2 = [8.0, 14.8], MEDIAN: V2 = [14.8, 17.6], NORTHBOUND: V2 = [17.6, 24.4];
// where the road has its four lanes and median (south of it the ramps part)
const LANES: V2 = [44, 548];

// the bents (the mesh's, moved to clear the streets and the quay's path under them), the short
// columns at the arches' ends, and the arches' columns
const BENTS = [-18, 8, 34, 56.6, 80.6, 105.6, 130.6, 156.6, 182.6, 207.5, 238.6, 268.1, 296.6, 325, 353.6];
const SHORT_RAIL = [364, 374, 383, 497, 515], SHORT_ROAD = [364, 374, 483, 494, 534];
// the arches: from and to, the springings' heights, the crown's top under the rails, and across
interface Arch { from: number; to: number; feet: V2; crown: number; half: number }
const RAIL_ARCH: Arch = { from: 391.6, to: 489.6, feet: [7.8, 7.8], crown: 4.0, half: 2.6 };
const ROAD_ARCH: Arch = { from: 384.6, to: 473.6, feet: [6.6, 8.0], crown: 4.0, half: 11 };
const onArch = (a: Arch, n: number) => Array.from({ length: n }, (_, i) => a.from + ((a.to - a.from) * (i + 1)) / (n + 1));

const SHAPE = { fascia: -1.35, edge: 0.45, soffit: -1.9, haunch: { at: BENTS.slice(3), depth: 1.3, length: 8 } };
const each = (at: number[], p: Omit<Extract<Support, { kind: 'columns' }>, 's'>): Support[] => at.map((s) => ({ ...p, s }));
const TALL = { kind: 'columns', square: 2.2, across: 1.6, beam: { w: 2.6, depth: 0.9 } } as const;
const SHORT = { kind: 'columns', square: 0.9, beam: { w: 1.2, depth: 0.5 } } as const;
// the metro's deck: one column, or two where the siding runs between its tracks
const railColumns = (s: number) => (RAIL_HI(s) - RAIL_LO(s) > 10 ? [-3.2, 3.2] : [0]);
const RAIL: Viaduct = {
  frame: SB, rows: SB_TRACKS, shape: SHAPE,
  decks: [{ from: -44, to: 548, lo: RAIL_LO, hi: RAIL_HI }],
  supports: [
    ...BENTS.map((s): Support => ({ ...TALL, s, n: 1, inset: 2, at: railColumns(s) })),
    ...each([...SHORT_RAIL, ...onArch(RAIL_ARCH, 9)], { ...SHORT, n: 2, inset: 2, at: [-1.6, 1.6] }),
  ],
  abutments: [{ from: -44, to: -40 }, { from: 544, to: 548 }],
  // (OpenStreetMap's bridge runs on to Gullmarsplan's platforms over the ground at the rails' height)
  banks: [{ from: -100, to: -44, lo: RAIL_LO, hi: RAIL_HI }],
};
const ROAD_COLUMNS = [-9.45, 0, 9.45];
const ROAD_DECK: Viaduct = {
  frame: SB, rows: SB_ROAD, shape: SHAPE,
  decks: [{ from: -64, to: 548, lo: ROAD_LO, hi: ROAD_HI }],
  supports: [
    // (Sundstabacken passes under the eastern column's place at 156.6)
    ...BENTS.map((s): Support => ({ ...TALL, s, n: 3, inset: 4.4, at: s === 156.6 ? ROAD_COLUMNS.slice(0, 2) : ROAD_COLUMNS })),
    ...each([...SHORT_ROAD, ...onArch(ROAD_ARCH, 9)], { ...SHORT, n: 3, inset: 4.4, at: ROAD_COLUMNS }),
  ],
  abutments: [{ from: -64, to: -60 }, { from: 544, to: 548 }],
};

// The parts, each built with the tile it is in: s from and to.
export const SKANSTULLSBRON_PARTS: { range: V2; anchor: V2 }[] = [[-100, 120], [120, 360], [360, 560]].map(([a, b]) => ({ range: [a, b], anchor: SB.at((a + b) / 2, 10) }));

export function buildSkanstullsbron(B: Builder, ground: Ground, [s0, s1]: V2) {
  B.place([0, 0, 0], 0);
  const rail = (s: number) => track(SB_TRACKS, s, 0)[1];
  const road = (s: number) => ROAD(s);
  // the arches' tops, which the columns over them stand on, and the ground elsewhere
  const local = (x: number, z: number): V2 => {
    const dx = x - SB.o[0], dz = z - SB.o[1];
    return [dx * SB.t[0] + dz * SB.t[1], -dx * SB.t[1] + dz * SB.t[0]];
  };
  const arches: [Arch, Edge, (s: number) => number][] = [
    [RAIL_ARCH, (s) => (RAIL_LO(s) + RAIL_HI(s)) / 2, rail],
    [ROAD_ARCH, (s) => (ROAD_LO(s) + ROAD_HI(s)) / 2, road],
  ];
  const archTop = (a: Arch, top: (s: number) => number, s: number) => {
    const f = (s - a.from) / (a.to - a.from), c = (a.from + a.to) / 2;
    const rise = top(c) - a.crown - (a.feet[0] + a.feet[1]) / 2;
    return a.feet[0] + (a.feet[1] - a.feet[0]) * f + rise * 4 * f * (1 - f);
  };
  const archDepth = (a: Arch, s: number) => { const f = (s - a.from) / (a.to - a.from); return 1.5 + 1.1 * (2 * f - 1) ** 2; };
  const onGround: Ground = (x, z) => {
    const [s, u] = local(x, z);
    for (const [a, mid, top] of arches) if (s > a.from && s < a.to && Math.abs(u - mid(s)) <= a.half + 0.05) return archTop(a, top, s);
    return ground(x, z);
  };

  // the decks, their bents and columns, the abutments and the bank, within the part
  const part = (v: Viaduct): Viaduct => ({
    ...v,
    decks: v.decks.filter((d) => d.to > s0 && d.from < s1).map((d) => ({ ...d, from: Math.max(d.from, s0), to: Math.min(d.to, s1) })),
    supports: v.supports.filter((p) => p.s >= s0 && p.s < s1),
    abutments: v.abutments?.filter((a) => a.from >= s0 && a.from < s1),
    banks: v.banks?.filter((b) => b.to > s0 && b.from < s1).map((b) => ({ ...b, from: Math.max(b.from, s0), to: Math.min(b.to, s1) })),
  });
  buildViaduct(B, onGround, part(RAIL));
  buildViaduct(B, onGround, part(ROAD_DECK));

  // the arches, thickening towards their springings, on footings down to the ground
  B.tint(CONCRETE);
  for (const [a, mid, top] of arches) {
    const a0 = Math.max(a.from, s0), a1 = Math.min(a.to, s1);
    if (a1 <= a0) continue;
    const lo = off(mid, -a.half), hi = off(mid, a.half);
    const y = (s: number) => archTop(a, top, s);
    band(B, SB, steps(a0, a1, [], 2), lo, hi, (s) => y(s) - archDepth(a, s), (s) => y(s), 'concrete', 3);
    for (const [s, dir] of [[a.from, 1], [a.to, -1]]) {
      if (s < s0 || s >= s1) continue;
      const plan: V2[] = [[s - 2 * dir, lo(s) - 0.4], [s + 2.5 * dir, lo(s) - 0.4], [s + 2.5 * dir, hi(s) + 0.4], [s - 2 * dir, hi(s) + 0.4]];
      const foot = Math.min(...plan.map(([ps, pu]) => ground(...SB.at(ps, pu)) ?? y(s) - 2)) - 1;
      block(B, SB, dir > 0 ? plan : [plan[1], plan[0], plan[3], plan[2]], () => foot, () => y(s) - archDepth(a, s) + 0.4, 'concrete', 3);
    }
  }

  // the road: asphalt between the edge beams, the paths and the median raised a kerb, the lanes'
  // lines where it has its four lanes
  const r0 = Math.max(-64, s0), r1 = Math.min(548, s1);
  if (r1 > r0) {
    const ss = steps(r0, r1, [], 4), y = (s: number) => road(s);
    const e = (d: number): Edge => (s) => A(s) + d;
    B.tint(0x67696b);
    band(B, SB, ss, off(ROAD_LO, 0.45), off(ROAD_HI, -0.45), (s) => y(s) - 0.7, y, 'rp-asphalt', 6, { faces: 'top' });
    B.tint(0x7a7b7c);
    const kerb = (s: number) => y(s) + 0.15;
    band(B, SB, ss, off(ROAD_LO, 0.45), e(PATH_W), (s) => y(s) - 0.1, kerb, 'rp-asphalt', 6);
    band(B, SB, ss, off(ROAD_HI, -PATH_W + 3.2), off(ROAD_HI, -0.45), (s) => y(s) - 0.1, kerb, 'rp-asphalt', 6);
    const m0 = Math.max(r0, LANES[0]), m1 = Math.min(r1, LANES[1]);
    if (m1 > m0) {
      const ms = steps(m0, m1, [], 4);
      B.tint(CONCRETE);
      band(B, SB, ms, e(MEDIAN[0]), e(MEDIAN[1]), (s) => y(s) - 0.1, kerb, 'concrete', 3);
      const L = new Line(ms.map((s) => SB.at(s, 0)));
      // (the line's s is the frame's, from m0)
      const at = (u: number) => (t: number) => A(t + m0) + u;
      const top = (t: number) => y(t + m0);
      lines(B, L, top, 0, m1 - m0, [0, m1 - m0], [at((SOUTHBOUND[0] + SOUTHBOUND[1]) / 2), at((NORTHBOUND[0] + NORTHBOUND[1]) / 2)], true);
      lines(B, L, top, 0, m1 - m0, [0, m1 - m0], [at(SOUTHBOUND[0] + 0.3), at(SOUTHBOUND[1] - 0.3), at(NORTHBOUND[0] + 0.3), at(NORTHBOUND[1] - 0.3)], false);
      // the lamp masts along the median, every 30 m or so
      for (let s = Math.ceil(m0 / 30) * 30 + 6; s < m1; s += 30) {
        lampMast(B, SB.at(s, A(s) + (MEDIAN[0] + MEDIAN[1]) / 2), kerb(s), 10, SB.t, [-3.2, 3.2]);
      }
    }
    // the fence between the metro and the path, and the railing along the road's eastern edge
    const rs = steps(r0, r1, [], 2);
    chainFence(B, line(SB, rs.filter((s) => s >= -40), off(ROAD_LO, 0.25), kerb), 2.0);
    B.tint(RAILING);
    barRailing(B, line(SB, rs, off(ROAD_HI, -0.2), kerb), 1.2);
  }
  // the railing along the metro's western edge
  const t0 = Math.max(-44, s0), t1 = Math.min(548, s1);
  if (t1 > t0) {
    B.tint(RAILING);
    barRailing(B, line(SB, steps(t0, t1, [], 2), off(RAIL_LO, 0.2), (s, u) => railAt(SB_TRACKS, s, u) + KERB), 1.2);
  }
}
