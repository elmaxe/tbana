import type { Builder, V2 } from './builder.ts';
import { lampMast, lines, Line, railBar, table } from './ropsten.ts';
import { block, Frame, type Ground, pipeRailing, v3 } from './gubbangen.ts';
import { band, barrier, barRailing, CONCRETE, type Edge, FLOOR, KERB, line, off, RAILING, railAt, type Rows, steps, track, UNDER } from './farsta-line-north.ts';
import { buildViaduct, CURVED, deckBetween, deckOn, each, RAILINGS, type Support, type Viaduct } from './skarpnack-line.ts';
import { alongTop, bents, buildRoadDeck, type RoadDeck } from './road-bridges.ts';

// What the green line looks out on west of Fridhemsplan, beyond what the city draws there itself
// (its blocks with facades, the streets and the trees: see the areas in src/detail/areas.ts).

// FRIDHEMSPLAN TO KRISTINEBERG
//
// The roads over the line between Fridhemsplan's tunnel and Kristineberg, on bridges OpenStreetMap has and the city leaves
// out (tools/build-city.ts), each from Lantmäteriet's laser scan (its deck's edges and surface, the
// ground under it), Google's 3D mesh (the lines on it) and photographs on Mapillary (2017–2026: its
// looks), with the streets and the paths under it from OpenStreetMap; built by
// src/detail/road-bridges.ts.

// ------------------------------------------------------------------ Lindhagensplan
// East of Thorildsplan the metro runs in a cutting between Drottningholmsvägen's two carriageways,
// and Lindhagensplan's roundabout crosses all three on a deck 25 m long: t metres southwards along
// its middle, u to the right (west). The laser scan has its surface on a plane falling 3 % eastwards,
// its straight western edge and its eastern one along the roundabout's curve; the mesh the two lanes
// and the footway and cycleway along the western side; the photographs a slab with a thin edge beam
// and a railing of upright bars, on square columns under a crossbeam where the fences part the
// tracks from the roads.
const LH_EAST = table([[0, -9.4], [6, -8.0], [13, -7.0], [20, -7.6], [26, -9.2]]);
const LINDHAGENSPLAN: RoadDeck = {
  line: [[-2289.75, -26.74], [-2287.25, -0.86]], from: 0.5, to: 25.8,
  edges: (t) => [LH_EAST(t), 9.3], top: alongTop([[0, 9.33], [4, 9.28], [10, 9.32], [20, 9.34], [26, 9.38]], 0.027),
  depth: 0.9, paths: [[3, 9.3]], dashed: [(t) => (LH_EAST(t) + 3.4) / 2],
  columns: { at: [8.4, 17.2], us: [-6, -1.5, 3, 7.5], square: 0.5, beam: { w: 0.8, depth: 0.5 } },
  abutments: [2, 2],
};
export const LINDHAGENSPLAN_ANCHOR: V2 = [-2288.5, -13.8];
export const buildLindhagensplan = (B: Builder, ground: Ground) => buildRoadDeck(B, ground, LINDHAGENSPLAN);

// ------------------------------------------------------------------ Drottningholmsvägen's trench
// From Fridhemsplan's tunnel to 40 m short of Thorildsplan's platform, the metro and
// Drottningholmsvägen's two carriageways either side of it run in a trench between concrete
// retaining walls, under Lindhagensplan's deck, with the roads and pavements beside it on the level
// above: s metres westwards from the tunnel's mouth, u to the right (north). The laser scan has the
// walls' faces (NORTH, SOUTH), the trench's floor rising 4.6 m westwards (TRENCH_FLOOR) and the
// ground above them (ABOVE_*), the walls 5.4 m high at the tunnel and fading out to 1.4 m 190 m
// west of it; the photographs a low parapet with a railing along their tops. The elevation model's
// 5 m grid can't hold a wall: data/ground-corrections.json lays the floor up to 5 m behind them, and
// a strip of pavement over the ground's dip behind each wall hides the step up to the level above.
export const TRENCH = new Frame([-2219, -18.3], [-0.9955, 0.0947]);
const TRENCH_NORTH = table([[0, 15.0], [20, 14.8], [40, 13.9], [55, 14.0], [80, 14.6], [92, 15.9], [104, 16.4], [120, 17.1], [150, 17.2], [170, 17.7], [192, 18.4]]);
const TRENCH_SOUTH = table([[0, -13.5], [22, -12.8], [45, -12.2], [52, -12.6], [58, -10.3], [79, -9.9], [86, -11.3], [104, -10.9], [122, -11.7], [134, -12.0],
  [140, -13.2], [152, -14.0], [164, -14.6], [170, -15.0], [176, -16.2], [182, -17.6], [192, -18.2]]);
const TRENCH_FLOOR = table([[0, 3.8], [15, 3.69], [30, 3.63], [45, 3.7], [57, 3.85], [79, 4.26], [91, 4.63], [103, 5.07], [115, 5.54], [127, 6.02], [139, 6.47],
  [151, 6.96], [163, 7.41], [175, 7.87], [192, 8.45]]);
const ABOVE_NORTH = table([[0, 9.15], [45, 9.18], [79, 9.28], [103, 9.46], [127, 9.52], [151, 9.61], [175, 9.77], [192, 9.84]]);
const ABOVE_SOUTH = table([[0, 9.3], [45, 9.25], [79, 9.33], [103, 9.41], [127, 9.53], [151, 9.61], [175, 9.75], [192, 9.82]]);
const TRENCH_ENDS: V2 = [1.5, 190], UNDER_LINDHAGENSPLAN: V2 = [61, 79], WALL = 0.5, PARAPET = 0.3, BEHIND = 10.5;
const PAVEMENT = 0xa29f98;
// in two parts along it
export const TRENCH_PARTS = [[1.5, 96], [96, 190]].map(([a, b]) => ({ range: [a, b] as V2, anchor: TRENCH.at((a + b) / 2, 0) }));

export function buildTrench(B: Builder, ground: Ground, [a, b]: V2) {
  B.place([0, 0, 0], 0);
  const F = TRENCH;
  const ss = steps(Math.max(a, TRENCH_ENDS[0]), Math.min(b, TRENCH_ENDS[1]), [...UNDER_LINDHAGENSPLAN], 3);
  const foot = (s: number) => TRENCH_FLOOR(s) - 0.6;
  for (const [face, above, side] of [[TRENCH_NORTH, ABOVE_NORTH, 1], [TRENCH_SOUTH, ABOVE_SOUTH, -1]] as const) {
    const back = off(face, side * WALL), top = (s: number) => above(s) + PARAPET;
    // the wall, its face to the trench
    B.tint(CONCRETE);
    band(B, F, ss, side > 0 ? face : back, side > 0 ? back : face, foot, top, 'concrete', 3);
    // the pavement over the dip behind it, falling a little to meet the ground at its far edge
    // (not where Lindhagensplan's deck is the level above)
    const far = off(face, side * BEHIND), pave = (s: number, u: number) => above(s) + 0.03 - (0.15 * Math.abs(u - back(s))) / (BEHIND - WALL);
    B.tint(PAVEMENT);
    const runs = [ss.filter((s) => s <= UNDER_LINDHAGENSPLAN[0]), ss.filter((s) => s >= UNDER_LINDHAGENSPLAN[1])].filter((r) => r.length > 1);
    for (const r of runs) band(B, F, r, side > 0 ? back : far, side > 0 ? far : back, (s, u) => pave(s, u) - 0.3, pave, 'rp-asphalt', 4, { faces: 'top' });
    // the railing along its top
    B.tint(RAILING);
    for (const r of runs) pipeRailing(B, line(F, r, off(face, side * WALL / 2), (s) => top(s)), 1.0, 2.4);
  }
}

// ------------------------------------------------------------------ Essingeleden
// Between Kristineberg and Thorildsplan the metro runs in a box 124 m long under Fredhällsmotet,
// where Essingeleden crosses Drottningholmsvägen and the box on a viaduct 140 m long: t metres
// northwards along its middle from 110 m south of the box, u to the right (east).
// - The laser scan has its edges, 26–29 m apart, and its surface rising 2.9 m northwards and 3 %
//   eastwards, with the ground under it: Drottningholmsvägen's westbound lanes 9 m under its
//   southern half, the eastbound ones, the box and the paths 15 m under its northern half.
// - The mesh has three lanes each way (four southbound north of the box, where Fredhällsavfarten
//   leaves), the median's barrier and the shoulders; the photographs round columns under crossbeams
//   and railings along the edges.
// - Under its southern half Fredhällspåfarten's ramp crosses it diagonally on a deck of its own,
//   12 m wide and 5–6 m over Drottningholmsvägen, from the hill east of it to the slope west of it,
//   where its lane runs on south beside the motorway.
// Neither the scan nor the mesh sees under the decks: the columns stand where the streets, the paths
// and the box under them leave room, in rows where the photographs have them.
const ES_LINE: V2[] = [[-2794.4, 110], [-2794.4, 79.5], [-2792.9, 61.1], [-2792.2, 42.4], [-2792.6, 16.7], [-2794.8, -16.5], [-2797.7, -49.3], [-2798.5, -70]];
const ES_MEDIAN = table([[30, 1.05], [100, 1.1], [125, 2.0], [168, 2.15]]);
const ES_BENTS: [number, number[]][] = [[42, [-6, 0, 6, 12]], [66, [-11.8, -9.8, 9, 12]], [94, [-10, -3.5, 3, 9.5]], [128, [-10, -4, 7, 11.5]], [150, [-10, -4, 2, 8]]];
const ESSINGELEDEN: RoadDeck = {
  line: ES_LINE, from: 30.5, to: 168,
  edges: ((w, e) => (t: number): V2 => [w(t), e(t)])(
    table([[30, -12.8], [60, -13.0], [72, -12.1], [90, -12.8], [120, -13.5], [144, -14.5], [156, -15.1], [168, -15.3]]),
    table([[30, 13.5], [66, 13.0], [96, 14.0], [120, 13.4], [138, 13.9], [150, 14.3], [168, 14.0]])),
  top: alongTop([[30, 20.99], [42, 21.45], [54, 21.88], [66, 22.24], [84, 22.7], [102, 23.1], [114, 23.34], [126, 23.51], [138, 23.66], [150, 23.75], [168, 23.84]], 0.03),
  depth: 1.4,
  barriers: [ES_MEDIAN],
  solid: [(t) => ES_MEDIAN(t) - 0.65, (t) => ES_MEDIAN(t) + 0.65, table([[30, -9.7], [112, -9.7], [124, -12.3], [168, -12.5]]),
    table([[30, 10.7], [65, 10.4], [100, 11.0], [125, 11.4], [168, 11.8]])],
  dashed: [table([[30, -6.2], [100, -6.0], [125, -5.2], [168, -5.1]]), table([[30, -2.9], [100, -2.7], [125, -2.1], [168, -2.0]]), { u: -8.8, range: [122, 168] },
    table([[30, 4.2], [100, 4.4], [125, 5.2], [168, 5.5]]), table([[30, 7.3], [100, 7.6], [125, 8.3], [168, 8.5]])],
  lamps: { at: [50, 90, 130], u: ES_MEDIAN, h: 12, arms: [-3.4, 3.4], raise: 0.81 },
  columns: { ...bents(ES_BENTS), r: 0.6, beam: { w: 1.4, depth: 0.9 } },
  abutments: [2.5, 8],
};
// Fredhällspåfarten's deck: t metres south-westwards from 10 m east of OpenStreetMap's bridge
const ES_RAMP: RoadDeck = {
  line: [[-2759.17, 17.82], [-2767.4, 23.5], [-2778.4, 31.1], [-2789.2, 42.2], [-2798.7, 53.5], [-2806.3, 66.5]], from: 2, to: 68.5,
  edges: () => [-4.2, 7.7], top: alongTop([[2, 14.34], [16, 14.4], [26, 14.5], [66, 15.0]], 0.03),
  depth: 1.2, surface: 0x7d7e80, solid: [-3.2, 6.7],
  columns: { at: [18, 50], us: [-1, 5], r: 0.5 },
  abutments: [8, 3],
};
// in two parts, each built with the tile it is in (they meet over the box), the ramp with the first
const ES_PARTS: V2[] = [[30.5, 110], [110, 168]];
export const ESSINGELEDEN_PARTS = ES_PARTS.map((range) => ({ range, anchor: new Line(ES_LINE).at((range[0] + range[1]) / 2, 0) }));
export function buildEssingeleden(B: Builder, ground: Ground, range: V2) {
  buildRoadDeck(B, ground, ESSINGELEDEN, range);
  if (range[0] === ES_PARTS[0][0]) buildRoadDeck(B, ground, ES_RAMP);
}

// ------------------------------------------------------------------ Mariebergsavfarten
// East of Essingeleden Mariebergsavfarten leaves it on a deck 9–11 m over Drottningholmsvägen,
// which splits into two ramps sinking eastwards beside the line, the northern one over the road
// that runs under it at a slant, the southern one landing on the bank south of it. In metres along
// each from 14 m west of where OpenStreetMap's bridges begin, u to the right (south-south-east): the
// laser scan has the shared deck 12–13 m wide, each ramp 8 m, their surfaces falling 2.9 m and 1.9 m
// to their ends; the columns stand clear of the road under them.
const MA_NORTH: RoadDeck = {
  line: [[-2743.0, 74.9], [-2732.9, 65.2], [-2721.4, 54.2], [-2706.4, 46.4], [-2689.1, 38.5], [-2664.4, 30.6], [-2650.8, 27.3], [-2634.4, 25.1]], from: 2, to: 122.3,
  edges: ((l, r) => (t: number): V2 => [l(t), r(t)])(
    table([[2, -7.2], [8, -6.6], [14, -6.1], [20, -5.4], [26, -4.6], [38, -4.1], [74, -4.8], [80, -5.1], [134, -3.5]]),
    table([[2, 4.4], [8, 5.5], [14, 6.2], [20, 7.8], [26, 8.6], [32, 8.9], [74, 8.5], [77, 8.3], [80, 3.7], [134, 4.1]])),
  top: alongTop([[2, 20.02], [14, 20.07], [26, 20.11], [32, 20.06], [44, 19.84], [56, 19.63], [68, 19.31], [80, 18.91], [92, 18.46], [104, 18.0], [116, 17.51], [122.3, 17.2]], -0.035),
  depth: 1.2, solid: [(t) => table([[2, -6.3], [20, -4.5], [26, -3.7], [38, -3.2], [80, -4.2], [134, -2.6]])(t), 2.8, { u: 7.6, range: [20, 74] }],
  columns: { ...bents([[26, [-2, 5]], [50, [0, 6]], [75, [6.5]], [100, [-2]]]), r: 0.55 },
  abutments: [3, 4],
};
const MA_SOUTH: RoadDeck = {
  line: [[-2732.9, 65.2], [-2719.4, 59.3], [-2704.2, 54.4], [-2691.6, 51.1], [-2679.1, 49.3], [-2653.7, 47.3]], from: 54, to: 84,
  edges: ((l) => (t: number): V2 => [l(t), 3.1])(table([[54, -6], [60, -5.0], [72, -5.3], [84, -4.9]])),
  top: alongTop([[54, 19.01], [60, 18.86], [66, 18.7], [72, 18.54], [78, 18.34], [84, 18.14]], -0.03),
  depth: 1.2, solid: [-4.0, 2.2], columns: { at: [68], us: [-2], r: 0.55 }, abutments: [0, 4],
};
export const MARIEBERGSAVFARTEN_ANCHOR: V2 = [-2690, 45];
export function buildMariebergsavfarten(B: Builder, ground: Ground) {
  buildRoadDeck(B, ground, MA_NORTH);
  buildRoadDeck(B, ground, MA_SOUTH);
}

// TRANEBERGSBRON
//
// The bridge over Tranebergssund between Kungsholmen (Kristineberg) and Traneberg, 450 m long: s
// metres westwards from the southern track's bridge's eastern end in OpenStreetMap, u to the right
// (north); the southern track is the first.
//
// - Opened in 1934 (Paul Hedqvist and David Dahl, architects; Swedish Wikipedia), when its concrete
//   arch, 181 m across, was the world's longest: two arches side by side, the trams' (the metro's
//   since 1952) on the north and the road's; a third, south of them, was added in 1999–2002 for the
//   eastbound lanes, the cycleway and the footway, and the decks and the walls carrying them were
//   renewed on the old arches by 2005. Only the arches are the old ones.
// - The metro's deck on the north, 10.6 m wide; a gap of 4–5 m; the road's, 30 m wide: a narrow
//   walkway along its northern edge, two lanes westbound, a median with the lamp masts, two lanes
//   eastbound, a barrier and the cycleway and footway along its southern edge. At the ends the decks
//   meet and the road's widens south, where ramps and the cycleway leave it.
// - The decks stand on walls across the bridge 12.7–13 m apart, one under each deck: on the land at
//   either end, on the arches' footings at the water's edges and on the arches; the metro's on the
//   approaches about 14 m apart, as its deck curves away from the road's. Near the crown the arches
//   carry the decks themselves. Yellow fenders across the sound guard the arches' feet, with round
//   dolphins at their ends.
//
// The decks' edges and heights, the ground under them and the tracks' ballast from Lantmäteriet's
// laser scan (Laserdata Nedladdning, skog, 2021, CC BY 4.0); the arches' spans, their tops and
// undersides, the walls, the footings, the fenders and dolphins from Google's 3D mesh; the road's
// lanes from the mesh and OpenStreetMap; the looks from photographs on Wikimedia Commons. The
// tracks' heights are the laser scan's (data/height-corrections.json). The network draws the tracks
// on the metro's deck and leaves its girders, piers and railings to this (src/detail/viaducts.ts);
// the city leaves out the road on it, OpenStreetMap's bridge, which this lays on its deck.
export const TRANEBERGSBRON = new Frame([-3414.44, -203.18], [-0.9964, -0.0851]);
const TB = TRANEBERGSBRON;
const TB_TRACKS: Rows = [
  [-40, -10.28, 24.273, -4.67, 24.353], [-36, -9.26, 24.422, -3.74, 24.5], [-32, -8.23, 24.573, -2.85, 24.64], [-28, -7.21, 24.724, -1.91, 24.785],
  [-24, -6.19, 24.871, -0.97, 24.928], [-20, -5.12, 25.025, -0.08, 25.064], [-16, -4.09, 25.172, 0.86, 25.211], [-12, -3.07, 25.319, 1.8, 25.358],
  [-8, -2.04, 25.466, 2.74, 25.505], [-4, -1.02, 25.613, 3.63, 25.645], [0, 0, 25.76, 4.57, 25.787], [4, 1.03, 25.89, 5.47, 25.911],
  [8, 2.05, 26.02, 6.41, 26.041], [12, 3.02, 26.144, 7.35, 26.175], [16, 4.03, 26.275, 8.24, 26.303], [20, 5.03, 26.406, 9.18, 26.436],
  [24, 6.02, 26.54, 10.11, 26.566], [28, 7.01, 26.674, 10.99, 26.69], [32, 7.93, 26.799, 11.89, 26.82], [36, 8.87, 26.929, 12.75, 26.944],
  [40, 9.8, 27.06, 13.64, 27.074], [44, 10.7, 27.19, 14.46, 27.198], [48, 11.55, 27.314, 15.32, 27.329], [52, 12.38, 27.444, 16.13, 27.459],
  [56, 13.2, 27.574, 16.91, 27.583], [60, 13.95, 27.698, 17.63, 27.707], [64, 14.7, 27.828, 18.38, 27.837], [68, 15.4, 27.952, 19.07, 27.961],
  [72, 16.05, 28.083, 19.74, 28.091], [76, 16.68, 28.207, 20.37, 28.215], [80, 17.28, 28.334, 20.94, 28.336], [84, 17.82, 28.454, 21.51, 28.462],
  [88, 18.35, 28.575, 22.03, 28.583], [92, 18.83, 28.705, 22.49, 28.707], [96, 19.28, 28.829, 22.94, 28.831], [100, 19.68, 28.953, 23.34, 28.958],
  [104, 20.06, 29.083, 23.7, 29.078], [108, 20.41, 29.207, 24.02, 29.2], [112, 20.68, 29.331, 24.29, 29.324], [116, 20.96, 29.455, 24.56, 29.448],
  [120, 21.18, 29.582, 24.77, 29.582], [124, 21.37, 29.702, 24.95, 29.71], [128, 21.54, 29.823, 25.1, 29.836], [132, 21.66, 29.947, 25.21, 29.96],
  [136, 21.79, 30.078, 25.33, 30.084], [140, 21.87, 30.194, 25.39, 30.2], [144, 21.93, 30.31, 25.45, 30.316], [148, 21.98, 30.423, 25.49, 30.429],
  [152, 22.01, 30.531, 25.51, 30.537], [156, 22.04, 30.645, 25.53, 30.645], [160, 22.04, 30.749, 25.52, 30.754], [164, 22.05, 30.853, 25.51, 30.858],
  [168, 22.04, 30.957, 25.49, 30.962], [172, 22.03, 31.061, 25.47, 31.066], [176, 22.02, 31.17, 25.45, 31.17], [180, 22, 31.278, 25.42, 31.274],
  [184, 21.98, 31.386, 25.39, 31.378], [188, 21.96, 31.492, 25.37, 31.484], [192, 21.95, 31.596, 25.34, 31.592], [196, 21.93, 31.7, 25.31, 31.7],
  [200, 21.91, 31.809, 25.28, 31.809], [204, 21.89, 31.913, 25.26, 31.913], [208, 21.88, 31.978, 25.23, 31.973], [212, 21.87, 32.01, 25.22, 31.997],
  [216, 21.85, 32.04, 25.2, 32.02], [220, 21.84, 32.044, 25.18, 32.024], [224, 21.83, 32.048, 25.16, 32.028], [228, 21.83, 32.052, 25.14, 32.032],
  [232, 21.82, 32.056, 25.13, 32.036], [236, 21.81, 32.06, 25.11, 32.04], [240, 21.8, 32.065, 25.1, 32.049], [244, 21.8, 32.069, 25.09, 32.057],
  [248, 21.79, 32.073, 25.08, 32.062], [252, 21.79, 32.077, 25.08, 32.066], [256, 21.78, 32.069, 25.07, 32.062], [260, 21.78, 31.989, 25.07, 31.982],
  [264, 21.78, 31.913, 25.06, 31.902], [268, 21.79, 31.823, 25.06, 31.815], [272, 21.79, 31.727, 25.06, 31.723], [276, 21.8, 31.632, 25.07, 31.631],
  [280, 21.81, 31.535, 25.07, 31.534], [284, 21.81, 31.443, 25.08, 31.442], [288, 21.82, 31.351, 25.09, 31.348], [292, 21.83, 31.259, 25.1, 31.252],
  [296, 21.83, 31.166, 25.11, 31.156], [300, 21.84, 31.065, 25.13, 31.064], [304, 21.85, 30.969, 25.15, 30.972], [308, 21.85, 30.854, 25.17, 30.859],
  [312, 21.86, 30.734, 25.18, 30.735], [316, 21.85, 30.613, 25.2, 30.612], [320, 21.84, 30.483, 25.21, 30.492], [324, 21.83, 30.359, 25.21, 30.366],
  [328, 21.8, 30.235, 25.2, 30.243], [332, 21.76, 30.111, 25.18, 30.119], [336, 21.71, 29.987, 25.15, 29.995], [340, 21.64, 29.863, 25.09, 29.871],
  [344, 21.55, 29.732, 25.04, 29.747], [348, 21.43, 29.608, 24.93, 29.626], [352, 21.29, 29.484, 24.81, 29.506], [356, 21.13, 29.36, 24.68, 29.385],
  [360, 20.92, 29.23, 24.49, 29.261], [364, 20.71, 29.106, 24.29, 29.131], [368, 20.41, 28.978, 24.02, 29.007], [372, 20.11, 28.85, 23.73, 28.883],
  [376, 19.74, 28.718, 23.42, 28.76], [380, 19.32, 28.594, 23.01, 28.64], [384, 18.91, 28.47, 22.59, 28.514], [388, 18.34, 28.34, 22.1, 28.391],
  [392, 17.79, 28.216, 21.58, 28.267], [396, 17.14, 28.086, 21.02, 28.143], [400, 16.47, 27.962, 20.35, 28.013], [404, 15.74, 27.832, 19.7, 27.889],
  [408, 14.94, 27.712, 18.92, 27.758], [412, 14.09, 27.586, 18.16, 27.634], [416, 13.16, 27.46, 17.3, 27.506], [420, 12.19, 27.334, 16.42, 27.386],
  [424, 11.24, 27.218, 15.5, 27.26], [428, 10.15, 27.104, 14.46, 27.147], [432, 9.07, 26.991, 13.42, 27.033], [436, 7.9, 26.877, 12.38, 26.925],
  [440, 6.72, 26.764, 11.26, 26.812], [444, 5.44, 26.66, 10.11, 26.702], [448, 4.18, 26.571, 8.91, 26.61], [452, 2.91, 26.483, 7.71, 26.518],
  [456, 1.59, 26.395, 6.46, 26.425], [460, 0.27, 26.307, 5.2, 26.333], [464, -1.17, 26.241, 3.88, 26.254], [468, -2.54, 26.183, 2.56, 26.197],
  [472, -3.94, 26.124, 1.29, 26.142], [476, -5.43, 26.059, -0.08, 26.085], [480, -6.88, 26.01, -1.45, 26.028]
];
const A = (s: number) => track(TB_TRACKS, s, 0)[0], N = (s: number) => track(TB_TRACKS, s, 1)[0];
// the metro's deck, 3.3 m either side of its tracks
const RAIL_LO: Edge = (s) => A(s) - 3.3, RAIL_HI: Edge = (s) => N(s) + 3.3;
// the road's: its southern edge (the laser scan's), widening at the ends where the ramps and the
// cycleway leave it; its northern edge, along the gap to the metro's or meeting it at the ends
const ROAD_LO = table([[-20, -33], [-8, -32.5], [0, -33.5], [8, -29], [16, -27.5], [24, -25.5], [32, -24.5], [40, -23], [48, -22], [56, -20],
  [64, -18.5], [80, -17], [96, -16.3], [104, -15.8], [344, -16], [360, -17], [368, -18], [376, -18.5], [384, -19], [392, -21], [400, -22.5],
  [408, -24], [416, -26], [424, -29.5], [432, -30], [440, -33], [448, -35], [456, -31], [464, -24]]);
const NORTH = table([[40, 30], [56, 9.9], [72, 10.2], [80, 11.5], [88, 11.5], [96, 12.5], [112, 12.5], [120, 13], [128, 13.6], [344, 13.6],
  [352, 13.2], [368, 13], [376, 12], [384, 11.2], [392, 10.8], [400, 9], [408, 8], [416, 6], [424, 4.5], [432, 2.5], [440, -0.3], [448, -1.5],
  [464, -2]]);
const ROAD_HI: Edge = (s) => Math.min(NORTH(s), RAIL_LO(s));
// the road's surface along it (the laser scan's, its middle every 8 m): rising with the tracks to
// the crown, 0.3 m over the metro's ballast there
const ROAD = table([[-24, 24.65], [-16, 24.78], [-8, 25.13], [0, 25.42], [8, 25.72], [16, 26.11], [24, 26.37], [32, 26.66], [40, 26.99],
  [48, 27.31], [56, 27.61], [64, 27.97], [72, 28.22], [80, 28.54], [88, 28.9], [96, 29.19], [104, 29.47], [112, 29.78], [120, 30.13],
  [128, 30.39], [136, 30.68], [144, 31.01], [152, 31.3], [160, 31.4], [168, 31.64], [176, 31.8], [184, 31.94], [192, 32.03], [200, 32.15],
  [208, 32.29], [216, 32.3], [224, 32.34], [232, 32.39], [240, 32.34], [248, 32.3], [256, 32.25], [264, 32.13], [272, 31.98], [280, 31.9],
  [288, 31.71], [296, 31.46], [304, 31.28], [312, 31.04], [320, 30.78], [328, 30.56], [336, 30.25], [344, 29.94], [352, 29.68], [360, 29.39],
  [368, 29.15], [376, 28.85], [384, 28.46], [392, 28.22], [400, 27.9], [408, 27.54], [416, 27.36], [424, 27.03], [432, 26.67], [440, 26.39],
  [448, 26.1], [456, 25.96], [464, 26.01]]);
// the middle of the median (between OpenStreetMap's two carriageways), which bends south at the ends
const MEDIAN = table([[0, -13], [45, -4], [65, -1], [87, 1], [124, 2], [253, 1], [342, 1], [374, -0.5], [393, -2.5], [410, -5.5], [425, -9],
  [453, -14.5]]);
// (as a track down its middle, for the viaduct's heights)
const TB_ROAD: Rows = steps(-24, 468, [], 4).map((s) => [s, MEDIAN(s), ROAD(s) - 0.1]);
// across from the median's middle: its half-width, the lanes each way, the walkway on the north;
// the barrier and the path on the south, from the southern edge
const MEDIAN_HALF = 3, LANES = 6.6, WALKWAY = 1.8, PATH_W = 7.6, BARRIER = 0.8;
// where the road is OpenStreetMap's bridge (the city draws it on the ground beyond)
const ROAD_ENDS: V2 = [5, 453];

// the arches: across (u), and along them their undersides and tops (Google's mesh, the same for all
// three to within its 0.3 m), springing from the footings at the water's edges
const ARCH = [[143, 1.5, 4.9], [147, 3.56, 6.97], [150, 5.66, 8.58], [155, 8.46, 11.22], [160, 11.34, 13.9], [165, 13.78, 16.51],
  [170, 16.03, 18.31], [175, 18.28, 20.15], [180, 20.08, 22.0], [185, 21.79, 23.77], [190, 23.47, 25.19], [195, 24.62, 26.25],
  [200, 25.87, 27.3], [205, 26.97, 28.38], [210, 27.71, 29.43], [215, 28.39, 29.89], [220, 29.1, 30.2], [225, 29.31, 30.46],
  [230, 29.5, 30.7], [235, 29.69, 30.95], [240, 29.46, 30.8], [245, 29.25, 30.52], [250, 28.99, 30.15], [255, 28.26, 29.82],
  [260, 27.52, 29.3], [265, 26.74, 28.21], [270, 25.56, 27.13], [280, 23.08, 25.01], [290, 19.68, 21.72], [300, 15.49, 18.05],
  [310, 10.73, 13.47], [320, 5.06, 8.18], [323, 3.2, 6.3], [327, 1.5, 4.9]];
const ARCH_UNDER = table(ARCH.map(([s, y]) => [s, y])), ARCH_TOP = table(ARCH.map(([s, , y]) => [s, y]));
const SPAN: V2 = [143, 327];
// the metro's arch, and the road's two: the old one under the westbound lanes and the new one
const RIBS: V2[] = [[19.8, 28.6], [1.0, 14.0], [-10.5, -0.5]];
// the footings at the water's edges, their top, and the fenders and dolphins in the water
const FOOTINGS: [V2, V2][] = [[[115.5, 145.5], [-10.5, 30]], [[323.8, 340.5], [-11.3, 28.8]]];
const FOOTING_TOP = 4.9, WATER = 0.89;
const FENDERS: V2[][] = [[[166, 47.5], [171.5, 42], [171.5, -34], [162.5, -44.5]], [[306, 46.5], [299.5, 41], [299.5, -31], [321.5, -52.5]]];
const DOLPHINS: V2[] = [[165.8, 40.4], [168.7, -26.2], [305.5, 37.6], [304.6, -29.5]];

// the walls: the road's, across both its arches, 12.7–13 m apart and the same either side of the
// crown; the metro's, on the arch at the same places, on the approaches 14 m or so apart
const ROAD_WALLS = [25.7, 38.1, 51.4, 64.4, 77.2, 90.1, 103.4, 116.6, 129.4, 142.3, 155, 168, 181, 194, 207, 263, 276, 289, 301.5, 314.6,
  327.5, 340.4, 352.7, 365.3, 378.1, 390.7, 403.3, 416, 428.7, 441.4];
const RAIL_WALLS = [29.2, 43.5, 57.8, 71.5, 86.1, 100.4, 115.4, 130, 142.3, 155, 168, 181, 194, 207, 263, 276, 289, 301.5, 314.6, 327.5,
  340.6, 353, 366.5, 381, 395, 409, 423.5, 438];
const SHAPE = { fascia: -1.35, edge: 0.45, soffit: -2.0, overhang: { wide: 2.4, under: -0.85 } };
const RAIL: Viaduct = {
  frame: TB, rows: TB_TRACKS, shape: SHAPE,
  decks: [{ from: -20, to: 464, lo: RAIL_LO, hi: RAIL_HI }],
  supports: RAIL_WALLS.map((s): Support => ({ s, kind: 'wall', thick: 1.3, inset: 0, span: [A(s) - 2.3, N(s) + 2.0] })),
  abutments: [{ from: -20, to: 11 }, { from: 452, to: 464 }],
};
const ROAD_DECK: Viaduct = {
  frame: TB, rows: TB_ROAD, shape: SHAPE,
  decks: [{ from: -20, to: 464, lo: ROAD_LO, hi: ROAD_HI }],
  supports: ROAD_WALLS.map((s): Support => ({ s, kind: 'wall', thick: 1.1, inset: 0, span: [Math.max(ROAD_LO(s) + 1.5, MEDIAN(s) - 12), Math.min(ROAD_HI(s) - 1.5, MEDIAN(s) + 11)] })),
  abutments: [{ from: -20, to: 11 }, { from: 452, to: 464 }],
};

const YELLOW = 0xd9a520, DOLPHIN = 0x8f8c86;

// The parts, each built with the tile it is in: s from and to.
export const TRANEBERGSBRON_PARTS: { range: V2; anchor: V2 }[] = [[-24, 120], [120, 235], [235, 350], [350, 470]].map(([a, b]) => ({ range: [a, b], anchor: TB.at((a + b) / 2, 10) }));

export function buildTranebergsbron(B: Builder, ground: Ground, [s0, s1]: V2) {
  B.place([0, 0, 0], 0);
  const local = (x: number, z: number): V2 => {
    const dx = x - TB.o[0], dz = z - TB.o[1];
    return [dx * TB.t[0] + dz * TB.t[1], -dx * TB.t[1] + dz * TB.t[0]];
  };
  // what the walls stand on: the arches' tops (the gap between the road's two counts as theirs),
  // the footings, and the ground elsewhere
  const onGround: Ground = (x, z) => {
    const [s, u] = local(x, z);
    if (s > SPAN[0] && s < SPAN[1] && ((u > RIBS[0][0] - 0.1 && u < RIBS[0][1] + 0.1) || (u > RIBS[2][0] - 0.1 && u < RIBS[1][1] + 0.1))) return ARCH_TOP(s);
    for (const [[a, b], [c, d]] of FOOTINGS) if (s >= a && s <= b && u >= c && u <= d) return FOOTING_TOP;
    return ground(x, z);
  };

  // the decks, their walls and abutments, within the part
  const part = (v: Viaduct): Viaduct => ({
    ...v,
    decks: v.decks.filter((d) => d.to > s0 && d.from < s1).map((d) => ({ ...d, from: Math.max(d.from, s0), to: Math.min(d.to, s1) })),
    supports: v.supports.filter((p) => p.s >= s0 && p.s < s1),
    abutments: v.abutments?.filter((a) => a.from >= s0 && a.from < s1),
  });
  buildViaduct(B, onGround, part(RAIL));
  buildViaduct(B, onGround, part(ROAD_DECK));

  // the arches, between the footings
  B.tint(CONCRETE);
  const a0 = Math.max(SPAN[0], s0), a1 = Math.min(SPAN[1], s1);
  if (a1 > a0) {
    const ss = steps(a0, a1, ARCH.map(([s]) => s), 2.5);
    // (their undersides in the soffits' concrete, which the light off the water reaches)
    for (const [lo, hi] of RIBS) {
      B.tint(CONCRETE);
      band(B, TB, ss, () => lo, () => hi, (s) => ARCH_UNDER(s), (s) => ARCH_TOP(s), 'concrete', 3, { faces: 'sides' });
      band(B, TB, ss, () => lo, () => hi, (s) => ARCH_UNDER(s), (s) => ARCH_TOP(s), 'concrete', 3, { faces: 'top' });
      B.tint(UNDER);
      band(B, TB, ss, () => lo, () => hi, (s) => ARCH_UNDER(s), (s) => ARCH_UNDER(s) + 0.02, 'fl-under', 3);
    }
  }
  // the footings, from the water up
  for (const [[a, b], [c, d]] of FOOTINGS) {
    if (b <= s0 || a >= s1) continue;
    block(B, TB, [[a, c], [b, c], [b, d], [a, d]], () => WATER - 3, () => FOOTING_TOP, 'concrete', 3);
  }
  // the fenders and the dolphins at their ends
  for (const [k, f] of FENDERS.entries()) {
    const mid = (f[1][0] + f[2][0]) / 2;
    if (mid < s0 || mid >= s1) continue;
    B.tint(YELLOW);
    for (let i = 0; i + 1 < f.length; i++) {
      const [p, q] = [f[i], f[i + 1]], l = Math.hypot(q[0] - p[0], q[1] - p[1]), n: V2 = [-(q[1] - p[1]) / l * 0.6, (q[0] - p[0]) / l * 0.6];
      block(B, TB, [[p[0] - n[0], p[1] - n[1]], [q[0] - n[0], q[1] - n[1]], [q[0] + n[0], q[1] + n[1]], [p[0] + n[0], p[1] + n[1]]], () => WATER - 1, () => WATER + 2.1, 'concrete', 2);
    }
    B.tint(DOLPHIN);
    for (const d of DOLPHINS.slice(2 * k, 2 * k + 2)) {
      const c = TB.at(d[0], d[1]);
      B.lathe(c[0], c[1], [[4.6, WATER - 1], [4.6, WATER + 2.3], [4.3, WATER + 2.5]], 'concrete', 20, 3);
    }
  }

  // the road: asphalt between the edge beams, the walkway, the median and the path raised a kerb, the
  // barrier between the path and the lanes, the lanes' lines, the lamp masts on the median
  const r0 = Math.max(ROAD_ENDS[0], s0), r1 = Math.min(ROAD_ENDS[1], s1);
  if (r1 > r0) {
    const ss = steps(r0, r1, [], 4), y = ROAD, kerb = (s: number) => y(s) + 0.15;
    const m = (d: number): Edge => (s) => MEDIAN(s) + d;
    // the path's northern edge, and the barrier's
    const pathHi: Edge = (s) => Math.min(ROAD_LO(s) + PATH_W, MEDIAN(s) - MEDIAN_HALF - LANES - BARRIER);
    B.tint(0x67696b);
    band(B, TB, ss, off(ROAD_LO, 0.45), off(ROAD_HI, -0.45), (s) => y(s) - 0.7, y, 'rp-asphalt', 6, { faces: 'top' });
    B.tint(0x7a7b7c);
    band(B, TB, ss, off(ROAD_LO, 0.45), pathHi, (s) => y(s) - 0.1, kerb, 'rp-asphalt', 6);
    band(B, TB, ss, off(ROAD_HI, -WALKWAY), off(ROAD_HI, -0.45), (s) => y(s) - 0.1, kerb, 'rp-asphalt', 6);
    B.tint(CONCRETE);
    band(B, TB, ss, pathHi, off(pathHi, BARRIER), (s) => y(s) - 0.1, (s) => y(s) + 0.85, 'concrete', 3);
    band(B, TB, ss, m(-MEDIAN_HALF), m(MEDIAN_HALF), (s) => y(s) - 0.1, kerb, 'concrete', 3);
    // the median's guardrail
    B.tint(RAILING);
    barRailing(B, line(TB, ss, m(0), kerb), 0.8);
    const L = new Line(ss.map((s) => TB.at(s, 0)));
    // (the line's s is the frame's, from r0)
    const at = (d: number) => (t: number) => MEDIAN(t + r0) + d;
    const top = (t: number) => y(t + r0);
    lines(B, L, top, 0, r1 - r0, [0, r1 - r0], [at(MEDIAN_HALF + LANES / 2), at(-MEDIAN_HALF - LANES / 2)], true);
    lines(B, L, top, 0, r1 - r0, [0, r1 - r0], [at(MEDIAN_HALF + 0.3), at(MEDIAN_HALF + LANES - 0.3), at(-MEDIAN_HALF - 0.3), at(-MEDIAN_HALF - LANES + 0.3)], false);
    // the lamp masts along the median, every 39 m or so (the mesh's)
    for (const s of [41.5, 80.8, 119.3, 157.8, 197, 238, 278, 318, 356.7, 393.5]) {
      if (s < r0 || s >= r1) continue;
      lampMast(B, TB.at(s, MEDIAN(s)), kerb(s), 11, TB.t, [-3.4, 3.4]);
    }
    // the railings along the edges: the south always, the north where the gap to the metro's deck is
    B.tint(RAILING);
    barRailing(B, line(TB, steps(r0, r1, [], 2), off(ROAD_LO, 0.2), kerb), 1.2);
    const g0 = Math.max(r0, 60), g1 = Math.min(r1, 453);
    if (g1 > g0) barRailing(B, line(TB, steps(g0, g1, [], 2), off(ROAD_HI, -0.2), kerb), 1.2);
  }
  // the railings along the metro's deck: the north always, the south where the gap is
  const t0 = Math.max(-9, s0), t1 = Math.min(464, s1);
  if (t1 > t0) {
    B.tint(RAILING);
    const y = (s: number, u: number) => railAt(TB_TRACKS, s, u) + KERB;
    barRailing(B, line(TB, steps(t0, t1, [], 2), off(RAIL_HI, -0.2), y), 1.2);
    const g0 = Math.max(t0, 60), g1 = Math.min(t1, 453);
    if (g1 > g0) barRailing(B, line(TB, steps(g0, g1, [], 2), off(RAIL_LO, 0.2), y), 1.2);
  }
}

// WEST OF TRANEBERGSBRON
//
// The metro's bridges on to Stora mossen and the trams' viaducts over it, each from Lantmäteriet's
// laser scan (its decks' edges and heights, the ground and the tracks' ballast under them), with
// the streets they cross from OpenStreetMap and their looks from photographs on Mapillary
// (2015–2026) and Google's 3D mesh. The network draws the tracks on the metro's decks and leaves
// their girders, piers and railings to this (src/detail/viaducts.ts).

// ------------------------------------------------------------------ Tranebergsslingan's bridge
// Between Tranebergsbron and Alvik, over Tranebergsslingan and the path beside it, with
// Drottningholmsvägen's bridges over them 7 m south of it: s metres east-north-eastwards from the
// bridge's western end in OpenStreetMap, u to the right (south); the southern track is the first.
// The laser scan has the deck from 1 m before OpenStreetMap's bridge to its end, 11 m wide and 8 m
// over the street, and the photographs a slab with deep edge beams and a railing of posts. Neither
// the scan nor the mesh sees under it: one pier stands between the street and the bank, where the
// path under the northern track has left it.
export const TRANEBERGSSLINGAN = new Frame([-3954.47, -217.86], [0.9516, -0.3074]);
const TS_TRACKS: Rows = [
  [-16, 0.18, 25.94, -6.12, 25.974], [-12, 0.13, 25.94, -6.18, 25.978], [-8, 0.08, 25.942, -6.21, 25.98], [-4, 0.04, 25.946, -6.24, 25.98],
  [0, 0, 25.95, -6.26, 25.978], [4, -0.03, 25.946, -6.25, 25.97], [8, -0.06, 25.941, -6.25, 25.962], [12, -0.09, 25.937, -6.22, 25.957],
  [16, -0.11, 25.933, -6.19, 25.952], [20, -0.13, 25.929, -6.14, 25.946], [24, -0.13, 25.924, -6.08, 25.938], [28, -0.14, 25.92, -6.01, 25.93],
  [32, -0.12, 25.916, -5.92, 25.925], [36, -0.11, 25.912, -5.83, 25.921], [40, -0.08, 25.907, -5.72, 25.914], [44, -0.03, 25.903, -5.6, 25.906],
  [48, 0.02, 25.907, -5.46, 25.908], [52, 0.11, 25.932, -5.28, 25.934], [56, 0.19, 25.958, -5.11, 25.959], [60, 0.33, 25.984, -4.89, 25.984],
  [64, 0.46, 26.009, -4.67, 26.009],
];
export const TRANEBERGSSLINGAN_BRIDGE: Viaduct = {
  frame: TRANEBERGSSLINGAN, rows: TS_TRACKS, shape: CURVED, railing: RAILINGS,
  decks: [deckBetween(TS_TRACKS, -1, 47.5, [1, -2.9], [0, 2.6])],
  supports: [{ s: 30, kind: 'wall', thick: 0.7, inset: 0.6 }],
  abutments: [{ from: -1, to: 1.5 }, { from: 45, to: 47.5 }],
};

// ------------------------------------------------------------------ Drottningholmsvägen beside it
// Drottningholmsvägen crosses the same hollow on decks of its own beside the metro's, in its frame:
// - the road's, 27 m wide and 47 m long, 2 m south of the metro's: along its northern edge the lane
//   off it to Margretelundsvägen, the westbound lanes with the bus lane, a concrete barrier, the
//   eastbound lanes with theirs, and Tranebergsslingan's lane onto it along its southern edge;
// - past a slot 2.6 m wide, the cycleway and footway's, 6.2 m wide;
// - and from the middle of that a ramp of the path, 4.6 m wide, curving away south over the street's
//   loop to the hill beyond it.
// The laser scan has the road on a plane (4 cm rms) rising 3.8 % eastwards and falling 2.1 %
// southwards, the path's deck on one rising 3.9 % eastwards and 1.8 % southwards, the ramp falling
// 0.8 m from it to its end, and their edges and ends; Google's 3D mesh the lanes' lines and the
// round columns under the ramp, flaring into it; the photographs (Mapillary, 2025–2026) the barrier,
// the steel railings on the edge beams and the lamp masts on the barrier. OpenStreetMap has them as
// bridges, which the city leaves out, so this lays the road and the path on them.
const TS_ROAD = (s: number, u: number) => 23.273 + 0.0379 * s - 0.0207 * u;
const TS_PATH = (s: number, u: number) => 22.213 + 0.0394 * s + 0.018 * u;
// the decks' edges (u) and ends (s)
const ROAD_U: V2 = [4.8, 31.6], ROAD_S: V2 = [1.5, 49], PATH_U: V2 = [34.2, 40.4], PATH_S: V2 = [4, 48];
// (as two tracks along the edges, for the decks' heights: the slab under the road's surface)
const edgeRows = (top: (s: number, u: number) => number, [lo, hi]: V2, [a, b]: V2): Rows =>
  steps(a - 4, b + 4, [], 4).map((s) => [s, lo, top(s, lo) - 0.1, hi, top(s, hi) - 0.1]);
const TS_ROAD_ROWS = edgeRows(TS_ROAD, ROAD_U, ROAD_S), TS_PATH_ROWS = edgeRows(TS_PATH, PATH_U, PATH_S);
const TS_DECK = { fascia: -1.1, edge: 0.4, soffit: -1.5, curve: 1.6 };
const TS_ROAD_DECK: Viaduct = {
  frame: TRANEBERGSSLINGAN, rows: TS_ROAD_ROWS, shape: TS_DECK, railing: { h: 1.2, every: 2.4 },
  decks: [{ from: ROAD_S[0], to: ROAD_S[1], lo: () => ROAD_U[0], hi: () => ROAD_U[1] }],
  supports: [{ s: 30, kind: 'wall', thick: 0.7, inset: 0.8 }],
  abutments: [{ from: ROAD_S[0], to: ROAD_S[0] + 2.5 }, { from: ROAD_S[1] - 2.5, to: ROAD_S[1] }],
};
const TS_PATH_DECK: Viaduct = {
  frame: TRANEBERGSSLINGAN, rows: TS_PATH_ROWS, shape: TS_DECK, railing: { h: 1.2, every: 2.4 },
  decks: [{ from: PATH_S[0], to: PATH_S[1], lo: () => PATH_U[0], hi: () => PATH_U[1] }],
  supports: [{ s: 30, kind: 'wall', thick: 0.7, inset: 0.6 }],
  abutments: [{ from: PATH_S[0], to: PATH_S[0] + 2.5 }, { from: PATH_S[1] - 2.5, to: PATH_S[1] }],
};
// the lines on the road: solid along its edges and either side of the barrier, dashed between the
// lanes; the barrier's line; the lamp masts on it
const SOLID = [6.2, 18.5, 20.5, 28.6], DASHED = [9.8, 13.8, 24.6], BARRIER_U = 19.5, LAMPS = [8, 40];
// the ramp: its middle from where it leaves the path's deck to its end on the hill (s, u in the
// frame), its surface along it (metres from its start, height), its columns clear of the paths under
// it, and the abutment under its last 2.5 m
const TS_RAMP: RoadDeck = (() => {
  const line = ([[32, 41.5], [27, 46], [23.4, 49.4], [19.5, 54.4], [15.5, 59.5], [12.2, 63.6], [9.3, 67], [8, 69.8]] as V2[]).map(([s, u]) => TRANEBERGSSLINGAN.at(s, u));
  const to = new Line(line).length;
  return {
    line, from: 0, to, edges: () => [-2.3, 2.3], top: alongTop([[0, 24.15], [8, 24.0], [20, 23.7], [32, 23.42], [40, 23.3]]),
    depth: 1.1, surface: 0x7a7b7c, columns: { at: [10, 24], us: [0], r: 0.4, flare: 1.1 }, abutments: [0, 2.5],
  };
})();

export const TS_ROADS_ANCHOR = TRANEBERGSSLINGAN.at(25, 30);

export function buildTranebergsslinganRoads(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const F = TRANEBERGSSLINGAN;
  buildViaduct(B, ground, TS_ROAD_DECK);
  buildViaduct(B, ground, TS_PATH_DECK);

  // the road: asphalt between the edge beams, the barrier, the lines, the lamp masts
  const [r0, r1] = ROAD_S;
  const plan = ([s0, s1]: V2, [u0, u1]: V2): V2[] => [[s0, u0], [s1, u0], [s1, u1], [s0, u1]];
  B.tint(0x67696b);
  block(B, F, plan(ROAD_S, [ROAD_U[0] + 0.4, ROAD_U[1] - 0.4]), (s, u) => TS_ROAD(s, u) - 0.7, TS_ROAD, 'rp-asphalt', 6, { faces: 'top' });
  B.tint(0x7a7b7c);
  block(B, F, plan(PATH_S, [PATH_U[0] + 0.4, PATH_U[1] - 0.4]), (s, u) => TS_PATH(s, u) - 0.7, TS_PATH, 'rp-asphalt', 6, { faces: 'top' });
  B.tint(0xc4c1ba);
  barrier(B, F, r0, r1, BARRIER_U, TS_ROAD);
  const L = new Line([F.at(r0, 0), F.at(r1, 0)]);
  for (const [us, dashed] of [[SOLID, false], [DASHED, true]] as const) {
    for (const u of us) lines(B, L, (t) => TS_ROAD(t + r0, u), 0, r1 - r0, [0, r1 - r0], [() => u], dashed);
  }
  for (const s of LAMPS) lampMast(B, F.at(s, BARRIER_U), TS_ROAD(s, BARRIER_U) + 0.81, 10, F.t, [-3.4, 3.4]);

  buildRoadDeck(B, ground, TS_RAMP);
}

// ------------------------------------------------------------------ Drottningholmsvägen over Tvärbanan
// East of Alvik Drottningholmsvägen crosses Tvärbanan's tracks and the street beside them on a deck
// of its own, south of the metro's: t metres east-north-eastwards, u to the right (south). The laser
// scan has it 38 m long and 26 m wide, its surface rising 0.2 m eastwards, and the ground 5–7 m under
// it; the mesh three lanes westbound, two eastbound and the cycleway and footway along its southern
// edge; the photographs a concrete barrier in the median with the lamp masts on it and steel
// railings on the edge beams. Its columns stand in a row between the street and the tracks.
const DV_TVARBANAN: RoadDeck = {
  line: [[-4530, -207.6], [-4475, -196.3]], from: 8, to: 46,
  edges: () => [-16.2, 9.6], top: alongTop([[8, 12.28], [28, 12.36], [46, 12.45]], 0.005),
  depth: 1.1, paths: [[4, 9.6]], solid: [-15.3, -5.1, -3.9, 3.3], dashed: [-11.7, -8.2, -0.4], barriers: [-4.5],
  lamps: { at: [27], u: -4.5, arms: [-3.5, 3.5], raise: 0.81 },
  columns: { at: [25], us: [-13, -7.5, -1.5, 4, 8], r: 0.45 },
  abutments: [2, 2],
};
export const DV_TVARBANAN_ANCHOR: V2 = [-4502.5, -201.9];
export const buildDvTvarbanan = (B: Builder, ground: Ground) => buildRoadDeck(B, ground, DV_TVARBANAN);

// ------------------------------------------------------------------ the flyover west of Alvik
// West of Alvik the northern track climbs out of the dip west of the station, along a retaining
// wall over the sidings from Alvik to the depot, and crosses them on a bridge of its own: s metres
// westwards from where OpenStreetMap's bridge starts, u to the right (north). The laser scan has
// the wall 5 m over the sidings to 36 m along, where the deck starts, 34 m long to the bank beyond,
// the sidings 6 m under it. Neither the scan nor the mesh sees anything under the deck: it is drawn
// as one span, on its abutments.
export const FLYOVER = new Frame([-4699.21, -289.17], [-0.9747, 0.2236]);
const FO_TRACKS: Rows = [
  [-4, -0.85, 19.341], [0, 0, 19.4], [4, 0.62, 19.422], [8, 1.25, 19.444],
  [12, 1.72, 19.45], [16, 2.14, 19.45], [20, 2.47, 19.438], [24, 2.67, 19.412],
  [28, 2.84, 19.382], [32, 2.84, 19.34], [36, 2.84, 19.296], [40, 2.66, 19.229],
  [44, 2.45, 19.159], [48, 2.11, 19.078], [52, 1.68, 18.99], [56, 1.19, 18.899],
  [60, 0.56, 18.802], [64, -0.09, 18.706], [68, -0.93, 18.609], [72, -1.82, 18.508],
  [76, -2.84, 18.411], [80, -3.94, 18.31], [84, -5.17, 18.214],
];
export const ALVIK_FLYOVER: Viaduct = {
  frame: FLYOVER, rows: FO_TRACKS, shape: { fascia: -1.7, edge: 0.45, soffit: -2.0, curve: 1.3 }, railing: RAILINGS,
  decks: [deckOn(FO_TRACKS, 0, 70, 0, 2.8)],
  supports: [],
  // the walled bank up to the deck (OpenStreetMap's bridge from its start), in three straight
  // lengths along the curve, and the abutment at the far end
  abutments: [{ from: 0, to: 12.5, top: FLOOR - 0.02 }, { from: 12, to: 24.5, top: FLOOR - 0.02 }, { from: 24, to: 37, top: FLOOR - 0.02 }, { from: 66, to: 70 }],
};

// ------------------------------------------------------------------ the bridge over Drottningholmsvägen
// West of the flyover both tracks cross Drottningholmsvägen at a slant on one deck, with
// Nockebybanan's viaduct over the road south of it: s metres west-south-westwards from 6 m before
// the deck, u to the right (north-west); the northern track is the first. The laser scan has the
// deck 8.5 m wide from 4 m to 68 m along, 5.5 m over the road. Neither it nor the mesh sees under
// it, and the photographs (Mapillary, 2025–2026) only past the trams' viaduct: a slab with deep
// edge beams. Walls stand along the road where its medians leave room: between the service road and
// the westbound lanes, and between those and the eastbound.
export const DROTTNINGHOLMSVAGEN = new Frame([-4805, -247.9], [-0.7656, 0.6433]);
const DV_TRACKS: Rows = [
  [-8, -0.32, 17.831, -6.15, 17.174], [-4, -0.15, 17.787, -5.55, 17.249], [0, -0.05, 17.752, -4.96, 17.325], [4, 0.03, 17.718, -4.55, 17.395],
  [8, 0.01, 17.696, -4.24, 17.459], [12, -0.01, 17.675, -3.96, 17.522], [16, -0.09, 17.673, -3.85, 17.57], [20, -0.18, 17.677, -3.74, 17.618],
  [24, -0.27, 17.682, -3.73, 17.659], [28, -0.37, 17.69, -3.75, 17.695], [32, -0.47, 17.698, -3.78, 17.728], [36, -0.54, 17.706, -3.83, 17.756],
  [40, -0.58, 17.714, -3.88, 17.784], [44, -0.6, 17.725, -3.89, 17.806], [48, -0.53, 17.745, -3.88, 17.826], [52, -0.46, 17.765, -3.83, 17.844],
  [56, -0.25, 17.785, -3.69, 17.856], [60, 0, 17.805, -3.54, 17.868], [64, 0.33, 17.826, -3.22, 17.877], [68, 0.8, 17.846, -2.88, 17.885],
  [72, 1.3, 17.867, -2.42, 17.895], [76, 2.01, 17.888, -1.81, 17.907], [80, 2.73, 17.908, -1.23, 17.919],
];
export const DROTTNINGHOLMSVAGEN_BRIDGE: Viaduct = {
  frame: DROTTNINGHOLMSVAGEN, rows: DV_TRACKS, shape: CURVED, railing: RAILINGS,
  decks: [deckBetween(DV_TRACKS, 4, 68, [1, -2.3], [0, 2.8])],
  // (the road crosses 0.57 m along per metre across)
  supports: each([24.5, 36.2], { kind: 'wall', thick: 0.7, inset: 0.6, skew: 0.57 }),
  abutments: [{ from: 4, to: 7 }, { from: 65, to: 68 }],
};

// ------------------------------------------------------------------ Stora Mossens backe's bridge
// At Stora mossen's eastern end, over Stora Mossens backe's two carriageways: s metres
// west-south-westwards from the bridge's eastern end in OpenStreetMap, u to the right (north); the
// northern track is the first. The laser scan has the deck 10 m wide, 2 m to 27 m along, 5 m over
// the road; the photographs (Mapillary, 2019–2025) a thin slab with white edges between abutments
// of granite blocks, on a row of slim round columns between the carriageways, which cross it at a
// slant (0.86 m along per metre across), and mesh fences on its railings.
export const STORA_MOSSENS_BACKE = new Frame([-5187.79, -309.34], [-0.9585, -0.2851]);
const SMB_TRACKS: Rows = [
  [-4, -0.01, 16.952, -4.7, 16.906], [0, 0, 16.92, -4.79, 16.878], [4, 0.01, 16.892, -4.89, 16.849], [8, 0.01, 16.865, -5.02, 16.825],
  [12, 0.01, 16.835, -5.15, 16.801], [16, 0.01, 16.803, -5.31, 16.776], [20, 0.01, 16.773, -5.46, 16.752], [24, 0, 16.746, -5.65, 16.728],
  [28, 0, 16.721, -5.83, 16.704], [32, -0.02, 16.701, -6.05, 16.686],
];
export const STORA_MOSSEN_BRIDGE: Viaduct = {
  frame: STORA_MOSSENS_BACKE, rows: SMB_TRACKS, shape: { fascia: -0.8, edge: 0.35, soffit: -1.05 }, railing: RAILINGS, tint: 0xd6d5cf,
  decks: [deckBetween(SMB_TRACKS, 2, 27, [1, -2.7], [0, 2.2])],
  supports: [-3.5, 0, 3.5].map((d): Support => ({ s: 13.7 - 0.86 * d, kind: 'columns', n: 1, at: [d], r: 0.2, inset: 0, mat: 'metal', paint: 0x8d9296 })),
  abutments: [{ from: 2, to: 5, mat: 'sl-granite' }, { from: 24, to: 27, mat: 'sl-granite' }],
};

// ------------------------------------------------------------------ Nockebybanan's viaducts
// Nockebybanan's trams leave Alvik between the metro's tracks and climb on a viaduct over the
// southern track and the sidings beside it, run on a walled bank, and cross Drottningholmsvägen on
// a second viaduct, south to Alléparken. The laser scan has the first deck 9.3 m wide from s 2 to
// 109 along its frame (s west-north-westwards, u to the right, north-north-east), 4 m over the
// metro's rails where they pass under it, and the second 9 m wide from s 0 to 95 along its own (s
// south-south-westwards, u to the right, west-north-west), 6.5 m over the road; their middles and
// tops every few metres (MID, TOP). The photographs (Mapillary, 2024–2026): a concrete slab with
// thin overhanging edges and a railing of upright bars, on pairs of round columns that flare into
// it, 10–14 m apart; two tracks with catenary masts on the deck. The columns stand where the
// metro's tracks and the road's lanes leave room, at s and across from the deck's middle.
export const NOCKEBY_1 = new Frame([-4655, -270], [-0.9898, 0.1425]);
export const NOCKEBY_2 = new Frame([-4776.4, -238.5], [-0.6674, 0.7447]);
const NB_HALF = 4.6, NB_TRACK = 1.9;
interface TramViaduct { frame: Frame; mid: (s: number) => number; top: (s: number) => number; from: number; to: number; columns: [number, number[]][] }
const NOCKEBY: TramViaduct[] = [
  {
    frame: NOCKEBY_1, from: 2, to: 109,
    mid: table([[2, 0.6], [10, 1.3], [20, 2.6], [30, 3.0], [40, 3.2], [50, 3.2], [60, 2.9], [66, 2.6], [70, 1.9], [76, 1.2], [82, 0], [88, -1.5],
      [92, -2.6], [98, -2.9], [104, -3.0], [110, -2.9]]),
    top: table([[4, 19.57], [10, 19.86], [16, 20.07], [24, 20.36], [32, 20.52], [40, 20.73], [48, 20.84], [56, 20.94], [64, 20.97], [72, 20.97],
      [80, 20.9], [88, 20.79], [96, 20.62], [104, 20.46], [110, 20.4]]),
    columns: [[6, [-2.5, 2.5]], [18, [-2.5, 2.5]], [30, [0, 3.2]], [40, [3.2]], [56, [-3.2, 2.5]], [66, [-2.5]], [76, [-2.5, 1.5]], [88, [-2.5, 2.5]], [99, [-2.5, 2.5]]],
  },
  {
    frame: NOCKEBY_2, from: 0, to: 95,
    mid: table([[0, 0.5], [4, 2.2], [8, 3.4], [12, 3.9], [16, 4.6], [20, 5.4], [24, 6.0], [30, 6.6], [36, 7.3], [42, 7.7], [50, 7.8], [58, 8.2],
      [66, 7.9], [72, 7.5], [78, 7.1], [84, 6.0], [90, 5.0], [96, 3.5]]),
    top: table([[0, 19.9], [6, 19.72], [12, 19.54], [18, 19.4], [24, 19.32], [30, 19.25], [36, 19.2], [42, 19.11], [48, 19.07], [54, 19.0], [60, 18.94],
      [66, 18.9], [72, 18.83], [78, 18.86], [84, 18.8], [90, 18.74], [96, 18.68]]),
    // (over the road: along its medians, skewed as they are)
    columns: [[4, [-2.5, 2.5]], [14, [-2.5, 2.5]], [24.3, [-2]], [28.3, [2]], [38.5, [-2]], [40, [1.5]], [52.4, [-2]], [54.2, [2]], [69, [-2.5, 2.5]], [81, [-2.5, 2.5]]],
  },
];
// the rails' tops (the laser scan's top of the deck is the ballast's and the rails')
const nbRows = (v: TramViaduct): Rows => steps(v.from - 4, v.to + 4, [], 2).map((s) => [s, v.mid(s) - NB_TRACK, v.top(s) + 0.1, v.mid(s) + NB_TRACK, v.top(s) + 0.1]);
const NB_SHAPE = { fascia: -0.95, edge: 0.3, soffit: -1.35, overhang: { wide: 1.2, under: -0.85 } };
const MAST = 0x9a9ea2, RAIL_STEEL = 0x8a8580, BALLAST = 0x8a8178;

export const NOCKEBY_ANCHORS: V2[] = NOCKEBY.map((v) => v.frame.at((v.from + v.to) / 2, v.mid((v.from + v.to) / 2)));

export function buildNockebyViaduct(B: Builder, ground: Ground, k: number) {
  B.place([0, 0, 0], 0);
  const v = NOCKEBY[k], F = v.frame, rows = nbRows(v);
  const lo: Edge = (s) => v.mid(s) - NB_HALF, hi: Edge = (s) => v.mid(s) + NB_HALF;
  buildViaduct(B, ground, {
    frame: F, rows, shape: NB_SHAPE, supports: [],
    decks: [{ from: v.from, to: v.to, lo, hi }],
    abutments: [{ from: v.from, to: v.from + 3 }, { from: v.to - 3, to: v.to }],
  });
  const rail = (s: number, u: number) => railAt(rows, s, u);
  // the columns, flaring into the slab
  B.tint(CONCRETE);
  for (const [s, us] of v.columns) {
    for (const d of us) {
      const u = v.mid(s) + d, [x, z] = F.at(s, u), top = rail(s, u) + NB_SHAPE.soffit, foot = (ground(x, z) ?? top - 6) - 0.3;
      B.lathe(x, z, [[0.4, foot], [0.4, top - 1.5], [0.55, top - 0.9], [0.95, top - 0.25], [1.05, top + 0.02]], 'concrete', 16, 3);
    }
  }
  // the ballast, the sleepers and the rails of the two tracks
  const ss = steps(v.from, v.to, [], 2);
  B.tint(BALLAST);
  band(B, F, ss, off(lo, 0.5), off(hi, -0.5), (s, u) => rail(s, u) + FLOOR, (s, u) => rail(s, u) - 0.2, 'stone', 3, { faces: 'top' });
  for (const side of [-1, 1]) {
    const u0 = (s: number) => v.mid(s) + side * NB_TRACK;
    B.tint(0xffffff);
    band(B, F, ss, off(u0, -1.3), off(u0, 1.3), (s, u) => rail(s, u) - 0.25, (s, u) => rail(s, u) - 0.15, 'gs-bed', 4, { faces: 'top' });
    B.tint(RAIL_STEEL);
    for (const g of [-0.7175, 0.7175]) {
      for (let i = 0; i + 1 < ss.length; i++) {
        const [a, b] = [ss[i], ss[i + 1]];
        railBar(B, v3(F.at(a, u0(a) + g), rail(a, u0(a))), v3(F.at(b, u0(b) + g), rail(b, u0(b))));
      }
    }
    // the contact wire over it
    B.tint(0x3a3a3a);
    for (let i = 0; i + 1 < ss.length; i++) {
      const [a, b] = [ss[i], ss[i + 1]];
      railBar(B, v3(F.at(a, u0(a)), rail(a, u0(a)) + 5.6), v3(F.at(b, u0(b)), rail(b, u0(b)) + 5.6), 0.02, 0.02);
    }
  }
  // the catenary's masts, every 30 m or so on the deck's northern edge, an arm over both tracks
  B.tint(MAST);
  const n = Math.max(1, Math.round((v.to - v.from - 8) / 30));
  for (let i = 0; i <= n; i++) {
    const s = v.from + 4 + ((v.to - v.from - 8) * i) / n, u = (k ? lo : hi)(s) + (k ? 0.45 : -0.45), [x, z] = F.at(s, u), y = rail(s, u) + KERB;
    B.lathe(x, z, [[0.12, y], [0.09, y + 7.0]], 'metal', 8);
    const a = F.at(s, v.mid(s) + (k ? 1 : -1) * (NB_TRACK + 1)), b: V2 = [x, z];
    railBar(B, v3(a, y + 6.4), v3(b, y + 6.4), 0.08, 0.12);
  }
  // the railings of upright bars along both edges
  B.tint(RAILING);
  for (const e of [off(lo, 0.2), off(hi, -0.2)]) barRailing(B, line(F, ss, e, (s, u) => rail(s, u) + KERB), 1.2);
}

// ABRAHAMSBERG TO ISLANDSTORGET
//
// The metro's bridges between the two stations, from east to west, each from Lantmäteriet's laser
// scan (its deck's ends and edges, the ground under it), the streets and paths under it from
// OpenStreetMap, and its looks from photographs on Mapillary (2016–2025); the decks follow the
// tracks (public/data/track-geometry.json). Neither the scan nor Google's mesh sees under them: the
// supports are placed from the photographs, where the streets under the decks leave room.

// ------------------------------------------------------------------ Abrahamsbergsvägen's bridge
// West of Abrahamsberg both tracks cross Abrahamsbergsvägen, with a footway east of it and a
// cycleway west of it, on a deck 12.6 m wide: s metres west-south-westwards from where OpenStreetMap's
// bridge starts, u to the right (north-north-west); the northern track is the first. The laser scan
// has the deck from 2 m to 30 m along and the street 5.5 m under the rails between abutment faces
// 4.5 m and 25.5 m along. The photographs: a slab with a deep edge beam that curves down into the
// abutments' faces, a row of square columns between the road and each path, and a railing of
// horizontal bars.
export const ABRAHAMSBERGSVAGEN = new Frame([-6054.08, -572.06], [-0.9663, -0.2575]);
const AB_TRACKS: Rows = [
  [-4, 0, 11.855, -8.15, 11.862], [0, 0, 11.85, -7.93, 11.853], [4, 0, 11.845, -7.71, 11.843], [8, 0.01, 11.841, -7.5, 11.834],
  [12, 0, 11.836, -7.28, 11.824], [16, -0.01, 11.831, -7.08, 11.815], [20, -0.01, 11.823, -6.85, 11.808], [24, -0.01, 11.813, -6.65, 11.803],
  [28, -0.01, 11.807, -6.42, 11.796], [32, 0, 11.802, -6.21, 11.787], [36, 0, 11.797, -5.98, 11.777],
];
export const ABRAHAMSBERGSVAGEN_BRIDGE: Viaduct = {
  frame: ABRAHAMSBERGSVAGEN, rows: AB_TRACKS, railing: RAILINGS,
  shape: { fascia: -1.5, edge: 0.45, soffit: -1.5, haunch: { at: [4.5, 25.5], depth: 0.9, length: 2.4 } },
  decks: [deckBetween(AB_TRACKS, 2, 30, [1, -2.6], [0, 2.6])],
  supports: each([10.6, 21.2], { kind: 'columns', n: 3, square: 0.75, inset: 1.6, beam: { w: 1.0, depth: 0.3 } }),
  abutments: [{ from: 2, to: 4.5 }, { from: 25.5, to: 30 }],
};

// ------------------------------------------------------------------ Brommaplan's viaduct
// West of Brommaplan both tracks run on the viaduct of 1944 that brought the trams out to Brommaplan,
// over the service roads, Drottningholmsvägen and Knypplerskevägen: s metres west-south-westwards
// from the southern track's start west of the station's decks (src/detail/viaducts.ts), u to the
// right (north-north-west); the southern track is the first. The laser scan has the deck 9–10 m wide
// out to 168 m along, 23 m further west than OpenStreetMap's bridge, where the ground rises to it,
// and the ground 5–7 m under it; the photographs a slab with a deep, flat edge beam and a railing of
// pipes on pairs of square piers, about 12.5 m apart and 16.5 m over Drottningholmsvägen.
export const BROMMAPLAN_WEST = new Frame([-6843.96, -762.91], [-0.8671, -0.4981]);
const BP_TRACKS: Rows = [
  [40, -3.31, 11.358, 2.2, 11.35], [44, -3.46, 11.354, 1.85, 11.35], [48, -3.61, 11.351, 1.45, 11.35], [52, -3.72, 11.346, 1.17, 11.347],
  [56, -3.8, 11.342, 0.9, 11.343], [60, -3.86, 11.34, 0.64, 11.338], [64, -3.89, 11.34, 0.46, 11.335], [68, -3.91, 11.339, 0.29, 11.331],
  [72, -3.88, 11.335, 0.19, 11.326], [76, -3.85, 11.332, 0.09, 11.322], [80, -3.8, 11.328, 0.04, 11.318], [84, -3.71, 11.323, 0.03, 11.314],
  [88, -3.63, 11.319, 0.03, 11.31], [92, -3.51, 11.315, 0.11, 11.31], [96, -3.39, 11.311, 0.18, 11.31], [100, -3.22, 11.31, 0.3, 11.308],
  [104, -3.05, 11.31, 0.46, 11.303], [108, -2.87, 11.31, 0.62, 11.299], [112, -2.67, 11.31, 0.83, 11.295], [116, -2.44, 11.31, 1.07, 11.29],
  [120, -2.18, 11.306, 1.34, 11.29], [124, -1.92, 11.302, 1.61, 11.29], [128, -1.59, 11.3, 1.95, 11.288], [132, -1.27, 11.3, 2.28, 11.284],
  [136, -0.94, 11.3, 2.62, 11.28], [140, -0.55, 11.3, 3.05, 11.28], [144, -0.1, 11.3, 3.44, 11.28], [148, 0.37, 11.303, 3.87, 11.28],
  [152, 0.85, 11.307, 4.33, 11.28], [156, 1.36, 11.311, 4.79, 11.28], [160, 1.98, 11.316, 5.36, 11.28], [164, 2.54, 11.319, 5.87, 11.28],
  [168, 3.14, 11.327, 6.42, 11.28], [172, 3.75, 11.335, 6.97, 11.28],
];
// (the laser scan's edges, which keep the deck's width where the network's tracks close up)
const BP_LO = table([[40, -5.4], [60, -5.8], [84, -5.6], [100, -5.3], [108, -5.0], [112, -4.6], [124, -3.9], [136, -2.9], [148, -1.6], [160, -0.3], [172, 0.6]]);
const BP_HI = table([[40, 5.4], [52, 4.8], [60, 4.3], [72, 3.8], [92, 3.5], [104, 3.6], [112, 4.0], [120, 4.5], [128, 5.2], [140, 6.2], [148, 6.9], [156, 7.9], [164, 8.8], [172, 9.2]]);
export const BROMMAPLAN_VIADUCT: Viaduct = {
  frame: BROMMAPLAN_WEST, rows: BP_TRACKS, railing: RAILINGS,
  shape: { fascia: -1.25, edge: 0.45, soffit: -1.25 },
  decks: [{ from: 42, to: 168, lo: BP_LO, hi: BP_HI }],
  supports: each([50, 62.5, 75, 87.5, 104, 116.5, 129, 141.5, 154], { kind: 'columns', n: 2, square: 0.9, across: 1.5, inset: 1.9 }),
  abutments: [{ from: 165, to: 168 }],
};

// ------------------------------------------------------------------ Åkeshovsvägen's bridge
// East of Åkeshov both tracks cross Åkeshovsvägen on a steel deck: s metres west-north-westwards from
// where OpenStreetMap's northern track's bridge starts, u to the right (north-north-east); the
// northern track is the first. The laser scan has the deck 8.5 m wide from 4 m before that to 24 m
// along, the street 4.9 m under the rails between granite abutments 20 m apart; the photographs
// steel girders, a row of slim steel columns on a concrete island between the carriageways, and a
// railing with a mesh fence.
export const AKESHOVSVAGEN = new Frame([-7384.22, -1080.99], [-0.8959, -0.4443]);
const AK_TRACKS: Rows = [
  [-8, -0.01, 13.896, -3.44, 13.845], [-4, 0, 13.908, -3.44, 13.857], [0, 0, 13.92, -3.44, 13.87], [4, 0, 13.932, -3.44, 13.882],
  [8, 0, 13.944, -3.44, 13.894], [12, 0, 13.955, -3.45, 13.906], [16, 0, 13.967, -3.46, 13.918], [20, 0, 13.979, -3.48, 13.928],
  [24, 0, 13.991, -3.5, 13.942], [28, 0, 14.002, -3.52, 13.955],
];
export const AKESHOVSVAGEN_BRIDGE: Viaduct = {
  frame: AKESHOVSVAGEN, rows: AK_TRACKS, railing: RAILINGS, mat: 'metal', tint: 0x9a9fa3,
  shape: { fascia: -1.15, edge: 0.35, soffit: -1.15 },
  decks: [deckBetween(AK_TRACKS, -4, 24, [1, -2.4], [0, 2.7])],
  supports: [{ s: 11.7, kind: 'columns', n: 4, r: 0.17, inset: 0.9, mat: 'metal', paint: 0xa4a8ab, plinth: { h: 0.9, out: 0.45 } }],
  abutments: [{ from: -4, to: -1, mat: 'sl-granite' }, { from: 19.5, to: 24, mat: 'sl-granite' }],
};

// ------------------------------------------------------------------ the path under the line east of Ängbyplan
// Between Åkeshov and Ängbyplan a path passes under both tracks in a concrete underpass: s metres
// eastwards from where OpenStreetMap's northern track's bridge starts, u to the right (south). The
// laser scan has the deck 9 m wide from 4 m before that to 10 m along and the path 3.4 m under the
// rails; the photographs a slab between the underpass's walls, under a mesh fence.
export const ANGBY_UNDERPASS = new Frame([-8028.31, -1185.05], [0.9985, -0.0543]);
const UB_TRACKS: Rows = [
  [-8, 0, 17.59, 4.01, 17.541], [-4, 0, 17.59, 4.13, 17.535], [0, 0, 17.59, 4.25, 17.529], [4, 0, 17.59, 4.37, 17.523],
  [8, 0, 17.59, 4.49, 17.517], [12, 0, 17.59, 4.61, 17.512], [16, 0, 17.59, 4.73, 17.506],
];
export const ANGBY_UNDERPASS_BRIDGE: Viaduct = {
  frame: ANGBY_UNDERPASS, rows: UB_TRACKS, railing: RAILINGS,
  shape: { fascia: -0.85, edge: 0.35, soffit: -0.85 },
  decks: [deckBetween(UB_TRACKS, -4, 10, [0, -2.5], [1, 2.2])],
  supports: [],
  abutments: [{ from: -4, to: 0.6 }, { from: 4.8, to: 10 }],
};
