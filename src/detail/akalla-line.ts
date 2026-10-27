import * as T from '../textures';
import type { Builder, V2, V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';
import { loft, post } from './ropsten.ts';
import { bar, block, Frame, type Ground, pipeRailing, UP, v3 } from './gubbangen.ts';
import { band, chainFence, CONCRETE, type Edge, off, railAt, type Rows, steps, track, UNDER } from './farsta-line-north.ts';
import { deckBetween, each, RAILINGS, type Support, type Viaduct } from './skarpnack-line.ts';

// What the blue line looks out on between Hallonbergen and Husby, the only stretch of it in the
// open, beyond what the city draws there itself (its blocks with facades, the streets and the trees:
// see the areas in src/detail/areas.ts): from south-east to north-west, the twin bridges over
// Igelbäcken's valley, Kymlinge's unused station at their northern end, the cutting at Ärvinge under
// Kymlingelänken, and the viaduct through Kista.
//
// Each from Lantmäteriet's laser scan (Laserdata Nedladdning, skog, 2021, CC BY 4.0: the decks'
// ends, edges and heights, the platform, the ground and the cutting's sides), the streets they cross
// from OpenStreetMap, and their looks from photographs on Mapillary (2015–2025) and Wikimedia
// Commons and Google's 3D mesh; the decks follow the tracks (public/data/track-geometry.json). The
// network draws the tracks on them and leaves their girders, piers and railings to this
// (src/detail/viaducts.ts).

addMaterial('ak-asphalt', () => standard(T.asphalt(), 0.92));
addMaterial('ak-timber', () => standard(T.finish('boardConcrete'), 0.95));
addMaterial('ak-gravel', () => standard(T.gravel(), 1));

const PAINT = 0xe6e6e0, ROAD = 0x67696b, STEEL = 0xa9aeb0, TIMBER = 0x8c8478;

// ------------------------------------------------------------------ the bridges over Igelbäcken
// North of Hallonbergen the line leaves its tunnel and crosses the valley of Igelbäcken, its brook,
// paths and meadows, on two single-track bridges side by side, 17–18 m between their tracks, in one
// long curve bending westwards and back: s metres north-north-westwards from the south-eastern
// end of the western track's deck, u to the right (east-north-east); the western track is the
// first. The laser scan has the western deck from 3.5 m to 375.5 m along, the eastern from 3 m
// before that to 365.5 m, each 6 m wide, the rails climbing from 15.8 m to 21.7 m over the valley's
// floor at 7 m. The photographs show a slab thickening in a smooth curve from thin edges to its
// middle, a railing of posts and rails, and one round column under each deck every 42 m, which
// trees hide from the laser and the mesh: these are where they stand in the panoramas from the
// paths under them, sighted from two places each.
export const IGELBACKEN = new Frame([-5122.9, -6651.0], [-0.4730, -0.8810]);
const IG_TRACKS: Rows = [
  [-16, -4.39, 15.312, 13.7, 15.487], [-12, -3.32, 15.438, 14.92, 15.598], [-8, -2.25, 15.564, 16.06, 15.716], [-4, -1.16, 15.691, 17.2, 15.834],
  [0, -0.07, 15.818, 18.26, 15.945], [4, 1.0, 15.926, 19.3, 16.055], [8, 2.07, 16.034, 20.29, 16.165], [12, 3.09, 16.144, 21.24, 16.275],
  [16, 4.08, 16.256, 22.18, 16.384], [20, 5.06, 16.367, 23.03, 16.493], [24, 5.95, 16.474, 23.89, 16.602], [28, 6.85, 16.581, 24.67, 16.71],
  [32, 7.67, 16.688, 25.43, 16.819], [36, 8.47, 16.795, 26.16, 16.926], [40, 9.24, 16.9, 26.82, 17.034], [44, 9.93, 17.002, 27.49, 17.141],
  [48, 10.63, 17.104, 28.07, 17.248], [52, 11.26, 17.206, 28.64, 17.355], [56, 11.87, 17.307, 29.18, 17.46], [60, 12.44, 17.409, 29.67, 17.563],
  [64, 12.95, 17.51, 30.15, 17.665], [68, 13.46, 17.612, 30.58, 17.76], [72, 13.88, 17.709, 31.0, 17.854], [76, 14.3, 17.806, 31.38, 17.946],
  [80, 14.68, 17.901, 31.75, 18.036], [84, 15.01, 17.993, 32.11, 18.127], [88, 15.33, 18.086, 32.43, 18.221], [92, 15.58, 18.178, 32.75, 18.316],
  [96, 15.83, 18.271, 33.03, 18.407], [100, 16.05, 18.363, 33.3, 18.497], [104, 16.24, 18.455, 33.55, 18.587], [108, 16.44, 18.548, 33.77, 18.678],
  [112, 16.59, 18.64, 33.99, 18.768], [116, 16.73, 18.732, 34.16, 18.847], [120, 16.87, 18.819, 34.31, 18.925], [124, 16.98, 18.899, 34.45, 19.003],
  [128, 17.09, 18.979, 34.56, 19.081], [132, 17.17, 19.055, 34.67, 19.159], [136, 17.25, 19.131, 34.73, 19.232], [140, 17.31, 19.206, 34.8, 19.306],
  [144, 17.36, 19.278, 34.84, 19.38], [148, 17.42, 19.35, 34.88, 19.453], [152, 17.45, 19.426, 34.91, 19.528], [156, 17.48, 19.503, 34.92, 19.605],
  [160, 17.49, 19.579, 34.92, 19.683], [164, 17.48, 19.655, 34.9, 19.758], [168, 17.48, 19.731, 34.87, 19.832], [172, 17.43, 19.807, 34.83, 19.906],
  [176, 17.38, 19.884, 34.76, 19.979], [180, 17.31, 19.951, 34.69, 20.053], [184, 17.22, 20.012, 34.57, 20.111], [188, 17.12, 20.072, 34.45, 20.164],
  [192, 16.98, 20.128, 34.31, 20.217], [196, 16.84, 20.184, 34.14, 20.271], [200, 16.67, 20.24, 33.97, 20.324], [204, 16.5, 20.297, 33.78, 20.377],
  [208, 16.32, 20.353, 33.58, 20.43], [212, 16.11, 20.409, 33.37, 20.484], [216, 15.91, 20.465, 33.15, 20.537], [220, 15.69, 20.521, 32.92, 20.59],
  [224, 15.45, 20.578, 32.67, 20.644], [228, 15.21, 20.634, 32.43, 20.697], [232, 14.94, 20.69, 32.17, 20.748], [236, 14.67, 20.747, 31.9, 20.797],
  [240, 14.37, 20.801, 31.62, 20.847], [244, 14.06, 20.853, 31.32, 20.9], [248, 13.75, 20.902, 31.02, 20.953], [252, 13.39, 20.927, 30.69, 20.993],
  [256, 13.03, 20.951, 30.34, 21.026], [260, 12.65, 20.977, 29.99, 21.057], [264, 12.25, 21.006, 29.62, 21.086], [268, 11.86, 21.033, 29.25, 21.115],
  [272, 11.44, 21.057, 28.86, 21.14], [276, 11.02, 21.082, 28.46, 21.165], [280, 10.6, 21.109, 28.05, 21.19], [284, 10.17, 21.137, 27.64, 21.214],
  [288, 9.74, 21.164, 27.23, 21.239], [292, 9.3, 21.188, 26.8, 21.264], [296, 8.87, 21.213, 26.38, 21.288], [300, 8.43, 21.24, 25.95, 21.315],
  [304, 8.0, 21.268, 25.53, 21.344], [308, 7.56, 21.295, 25.11, 21.373], [312, 7.13, 21.32, 24.68, 21.397], [316, 6.69, 21.344, 24.26, 21.422],
  [320, 6.26, 21.371, 23.83, 21.447], [324, 5.83, 21.399, 23.4, 21.471], [328, 5.4, 21.426, 22.98, 21.496], [332, 4.97, 21.451, 22.55, 21.521],
  [336, 4.54, 21.475, 22.12, 21.545], [340, 4.11, 21.502, 21.68, 21.573], [344, 3.67, 21.53, 21.24, 21.602], [348, 3.24, 21.557, 20.79, 21.629],
  [352, 2.8, 21.582, 20.34, 21.654], [356, 2.36, 21.606, 19.88, 21.679], [360, 1.9, 21.633, 19.4, 21.704], [364, 1.44, 21.662, 18.92, 21.728],
  [368, 0.97, 21.688, 18.43, 21.735], [372, 0.49, 21.713, 17.92, 21.727], [376, 0.01, 21.737, 17.41, 21.719], [380, -0.49, 21.733, 16.89, 21.715],
  [384, -1.0, 21.725, 16.36, 21.71], [388, -1.52, 21.716, 15.82, 21.702], [392, -2.05, 21.708, 15.28, 21.693],
];
const IG_SHAPE = { fascia: -0.9, edge: 0.4, soffit: -2.3, curve: 2.6 };
const IG_COLUMN = { kind: 'columns', n: 1, r: 0.7, inset: 0 } as const;
export const IGELBACKEN_WEST: Viaduct = {
  frame: IGELBACKEN, rows: IG_TRACKS, shape: IG_SHAPE, railing: RAILINGS,
  decks: [deckBetween(IG_TRACKS, 3.5, 375.5, [0, -2.7], [0, 3.25])],
  supports: each([46.9, 88.4, 130.3, 172.1, 214.0, 255.8, 297.5, 339.1], IG_COLUMN),
  abutments: [{ from: 3.5, to: 6.5 }, { from: 372.5, to: 375.5 }],
};
export const IGELBACKEN_EAST: Viaduct = {
  frame: IGELBACKEN, rows: IG_TRACKS, shape: IG_SHAPE, railing: RAILINGS,
  decks: [deckBetween(IG_TRACKS, -3, 365.5, [1, -2.7], [1, 3.25])],
  supports: each([39.5, 81.5, 123.7, 165.7, 207.9, 250.0, 289.9, 329.6], IG_COLUMN),
  abutments: [{ from: -3, to: 0 }, { from: 362.5, to: 365.5 }],
};

// ------------------------------------------------------------------ Kymlinge
// The station built in 1977 for a town that was never built, and never opened: an island platform
// between the tracks at the bridges' northern end, in the open for its last 40 m before the tunnel's
// mouth and on under the roof over it (photographs on Wikimedia Commons, 2008–2023): s metres along
// the western track north-north-westwards from the western deck's end, u to the right; the western
// track is the first. The laser scan has the platform's top at 22.6 m falling to 22.5 m from 78 m
// along to the tunnel's mouth 118 m along, 14.5 m wide, and between the tracks south of it a level
// strip of gravel at the tracks' foot, 15–18 m wide; the photographs a plain concrete slab, its
// edges hung with cables, and on it timber trestles and frames from the work there. (The network's
// tracks run about a metre inside the scan's platform edges, the eastern one 3 m at the tunnel's
// mouth: the platform keeps 1.56 m from each, as the stations do, and narrows towards the mouth.)
export const KYMLINGE = new Frame([-5301.0, -6982.7], [-0.5701, -0.8216]);
const KY_TRACKS: Rows = [
  [-12, 0.02, 21.666, 17.38, 21.739], [-8, 0.01, 21.692, 17.33, 21.73], [-4, -0.01, 21.716, 17.28, 21.721], [0, -0.03, 21.74, 17.22, 21.716],
  [4, -0.08, 21.732, 17.15, 21.712], [8, -0.13, 21.724, 17.07, 21.706], [12, -0.19, 21.716, 16.99, 21.697], [16, -0.27, 21.707, 16.9, 21.689],
  [20, -0.35, 21.7, 16.82, 21.685], [24, -0.44, 21.696, 16.73, 21.681], [28, -0.54, 21.691, 16.64, 21.673], [32, -0.64, 21.685, 16.54, 21.664],
  [36, -0.75, 21.677, 16.45, 21.658], [40, -0.86, 21.668, 16.36, 21.653], [44, -0.97, 21.66, 16.28, 21.648], [48, -1.09, 21.652, 16.19, 21.639],
  [52, -1.2, 21.644, 16.1, 21.631], [56, -1.31, 21.636, 16.0, 21.622], [60, -1.42, 21.629, 15.91, 21.614], [64, -1.51, 21.625, 15.8, 21.608],
  [68, -1.6, 21.621, 15.68, 21.603], [72, -1.65, 21.613, 15.55, 21.598], [76, -1.69, 21.605, 15.39, 21.589], [80, -1.7, 21.597, 15.23, 21.581],
  [84, -1.66, 21.589, 15.01, 21.576], [88, -1.63, 21.581, 14.78, 21.572], [92, -1.51, 21.572, 14.5, 21.565], [96, -1.38, 21.564, 14.19, 21.556],
  [100, -1.21, 21.558, 13.85, 21.549], [104, -0.99, 21.554, 13.45, 21.544], [108, -0.77, 21.55, 13.05, 21.54], [112, -0.46, 21.542, 12.57, 21.532],
  [116, -0.15, 21.533, 12.08, 21.523],
];
const KY_PLATFORM: V2 = [78, 117.7];
const KY_LO: Edge = (s) => track(KY_TRACKS, s, 0)[0] + 1.56, KY_HI: Edge = (s) => track(KY_TRACKS, s, 1)[0] - 1.56;
const kyTop = (s: number) => 22.57 - (s - KY_PLATFORM[0]) * 0.0018;
// the trestles across the platform: s, and their u from its western edge
const KY_TRESTLES: V2[] = [[104, 2], [109, 6.5], [113, 3.5]];
// The tunnel's mouth (the laser scan, and the photographs): one flat roof over the cutting's whole
// width, its front 117 m along, its top at 26.95 m, on a deep beam along its front with a chain-link
// fence on it; under the beam the two tracks' tunnels and between them the platform running on into
// the hall, dark, to a wall where the tracks close in.
const KY_MOUTH = 117.2, KY_ROOF = 26.95, KY_BEAM = 25.1, KY_CEILING = 25.6, KY_SPAN: V2 = [-7.5, 17.5], KY_HALL = 130;

export function buildKymlinge(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const F = KYMLINGE, ss = steps(KY_PLATFORM[0], KY_HALL, [KY_PLATFORM[1]], 4);
  const rail = (s: number, u: number) => railAt(KY_TRACKS, s, u);
  // the platform: its slab on walls down to the tracks' foot, and its top
  B.tint(0xa9a6a0);
  band(B, F, ss, KY_LO, KY_HI, (s, u) => rail(s, u) - 0.9, kyTop, 'concrete', 3, { faces: 'sides' });
  B.tint(0xbab7b0);
  band(B, F, ss, KY_LO, KY_HI, kyTop, kyTop, 'concrete', 3, { faces: 'top' });
  // the cable trays along both edges, under the slab's lip
  B.tint(0x55595c);
  for (const [e, d] of [[KY_LO, 1], [KY_HI, -1]] as const) band(B, F, ss, off(e, d * 0.05), off(e, d * 0.35), (s) => kyTop(s) - 0.55, (s) => kyTop(s) - 0.2, 'metal', 1);
  // the timber trestles: two A-frames joined by a rail, 2.4 m wide
  B.tint(TIMBER);
  for (const [s, du] of KY_TRESTLES) {
    const u = KY_LO(s) + du, y = kyTop(s);
    for (const a of [-1.2, 1.2]) {
      const c = F.at(s, u + a);
      for (const k of [-1, 1]) bar(B, v3(F.at(s + k * 0.6, u + a), y), v3(c, y + 1.1), 0.08, 0.08, 'ak-timber');
      post(B, c, F.t, 0.1, 0.1, y + 0.9, y + 1.15, 'ak-timber', 1);
    }
    bar(B, v3(F.at(s, u - 1.3), y + 1.1), v3(F.at(s, u + 1.3), y + 1.1), 0.1, 0.1, 'ak-timber');
    bar(B, v3(F.at(s, u - 1.2), y + 0.4), v3(F.at(s, u + 1.2), y + 1.0), 0.06, 0.06, 'ak-timber');
  }
  // the mouth: the beam along the roof's front, the walls beside the tunnels under it, and the
  // piers between the tunnels and the hall
  const m0 = KY_MOUTH, m1 = KY_MOUTH + 0.9, foot = rail(m0, 0) - 0.9;
  const t0 = track(KY_TRACKS, m0, 0)[0], t1 = track(KY_TRACKS, m0, 1)[0], across = (a: number, b: number): V2[] => [[m0, a], [m1, a], [m1, b], [m0, b]];
  B.tint(0xa9a6a0);
  block(B, F, across(...KY_SPAN), () => KY_BEAM, () => KY_ROOF, 'concrete', 3);
  for (const [a, b] of [[KY_SPAN[0], t0 - 2.4], [t0 + 2.4, t0 + 3], [t1 - 3, t1 - 2.4], [t1 + 2.4, KY_SPAN[1]]]) {
    block(B, F, across(a, b), () => foot, () => KY_BEAM, 'concrete', 3, { faces: 'sides' });
  }
  chainFence(B, [KY_SPAN[0], KY_SPAN[1]].map((u) => v3(F.at(m0 + 0.3, u), KY_ROOF)), 2.3);
  // the hall's inside, seen from the platform: its sides, its ceiling and the wall at its end
  B.tint(0x77746e);
  const hs = steps(m1, KY_HALL, [], 4), lo: Edge = (s) => track(KY_TRACKS, s, 0)[0] + 3, hi: Edge = (s) => track(KY_TRACKS, s, 1)[0] - 3;
  const P = (s: number, u: number, y: number) => v3(F.at(s, u), y), [rx, , rz] = F.right, [ax, , az] = F.along;
  for (let i = 0; i + 1 < hs.length; i++) {
    const [a, b] = [hs[i], hs[i + 1]];
    B.poly([P(a, lo(a), kyTop(a)), P(b, lo(b), kyTop(b)), P(b, lo(b), KY_CEILING), P(a, lo(a), KY_CEILING)], [rx, 0, rz], 'fl-under', 3);
    B.poly([P(a, hi(a), kyTop(a)), P(b, hi(b), kyTop(b)), P(b, hi(b), KY_CEILING), P(a, hi(a), KY_CEILING)], [-rx, 0, -rz], 'fl-under', 3);
    B.poly([P(a, lo(a), KY_CEILING), P(b, lo(b), KY_CEILING), P(b, hi(b), KY_CEILING), P(a, hi(a), KY_CEILING)], [0, -1, 0], 'fl-under', 3);
  }
  B.poly([P(KY_HALL, lo(KY_HALL), kyTop(KY_HALL)), P(KY_HALL, hi(KY_HALL), kyTop(KY_HALL)), P(KY_HALL, hi(KY_HALL), KY_CEILING), P(KY_HALL, lo(KY_HALL), KY_CEILING)], [-ax, 0, -az], 'fl-under', 3);
  // the gravel between the tracks south of it, at their foot (and over the city's ground there,
  // which the elevation model smooths)
  B.tint(0x8a8781);
  const gs = steps(-2, KY_PLATFORM[0], [], 2), gravel = (s: number, u: number) => Math.max(rail(s, u) - 0.35, (ground(...F.at(s, u)) ?? -1e3) + 0.15);
  const strip = (k: number): Edge => (s) => {
    const a = track(KY_TRACKS, s, 0)[0] + 1.9, b = track(KY_TRACKS, s, 1)[0] - 1.9;
    return a + ((b - a) * k) / 6;
  };
  for (let k = 0; k < 6; k++) band(B, F, gs, strip(k), strip(k + 1), gravel, gravel, 'ak-gravel', 2, { faces: 'top' });
}

// ------------------------------------------------------------------ the cutting at Ärvinge
// North-west of Kymlinge the line runs in a tunnel under the hill and comes out at Ärvinge into a
// cutting, Kymlingelänken (the E18) crossing it on a broad deck, and on along the ground to Kista's
// viaduct: s metres east-south-eastwards along the tracks, u to the right (south-south-west); the
// south-western track is the first.
export const ARVINGE = new Frame([-5850.58, -7523.32], [0.9546, 0.298]);
const AR_TRACKS: Rows = [
  [-12, 0.88, 23.02, -5.98, 22.824], [-8, 0.58, 22.975, -6.3, 22.775], [-4, 0.29, 22.931, -6.63, 22.726], [0, -0.01, 22.887, -6.95, 22.678],
  [4, -0.28, 22.843, -7.27, 22.629], [8, -0.55, 22.799, -7.6, 22.58], [12, -0.81, 22.754, -7.93, 22.531], [16, -1.05, 22.71, -8.26, 22.483],
  [20, -1.29, 22.665, -8.58, 22.434], [24, -1.49, 22.613, -8.9, 22.385], [28, -1.68, 22.561, -9.22, 22.335], [32, -1.85, 22.502, -9.52, 22.283],
  [36, -2.0, 22.437, -9.82, 22.23], [40, -2.14, 22.373, -10.07, 22.168], [44, -2.24, 22.309, -10.32, 22.103], [48, -2.33, 22.245, -10.54, 22.038],
  [52, -2.38, 22.176, -10.69, 21.974], [56, -2.41, 22.104, -10.84, 21.909], [60, -2.44, 22.031, -10.92, 21.844], [64, -2.4, 21.959, -10.99, 21.78],
  [68, -2.36, 21.887, -11.02, 21.717], [72, -2.27, 21.81, -10.99, 21.656], [76, -2.15, 21.729, -10.96, 21.595], [80, -2.02, 21.649, -10.85, 21.527],
  [84, -1.83, 21.569, -10.73, 21.459], [88, -1.63, 21.488, -10.57, 21.391], [92, -1.38, 21.408, -10.36, 21.327], [96, -1.1, 21.328, -10.15, 21.262],
  [100, -0.81, 21.248, -9.86, 21.192], [104, -0.49, 21.167, -9.55, 21.123], [108, -0.16, 21.087, -9.21, 21.056], [112, 0.19, 21.01, -8.81, 20.99],
  [116, 0.56, 20.934, -8.41, 20.924], [120, 0.93, 20.858, -7.93, 20.854], [124, 1.32, 20.787, -7.44, 20.783], [128, 1.71, 20.715, -6.89, 20.718],
  [132, 2.12, 20.646, -6.32, 20.655], [136, 2.54, 20.578, -5.71, 20.592], [140, 2.98, 20.511, -5.03, 20.529], [144, 3.48, 20.443, -4.36, 20.466],
  [148, 3.98, 20.375, -3.6, 20.403],
];

// Kymlingelänken's deck: its four carriageways, the exit to Ärvinge, the motorway's two and the slip
// road on, side by side on one slab crossing the tracks at 45°, which OpenStreetMap has as four
// bridges 25 m long. The laser scan has the slab 31 m wide across the roads and 50 m long along them
// between the abutments either side of the cutting, its surface at 27.8–29.0 m, rising northwards,
// 6 m over the rails; Mapillary's pictures from the motorway show steel guardrails between the
// carriageways, along the median and along the edges, with a railing on the edge beams. Drawn in its
// own frame: w metres across the roads, north-north-eastwards, from the tracks' frame's origin, v
// along them west-south-westwards; the deck from w = 15.56 to 46.66, between the abutments' lines.
const KL = new Frame(ARVINGE.o, [0.4643, 0.8857]);
const KL_W: V2 = [15.56, 46.66];
export const KL_ANCHOR = KL.at(31, -41);
const KL_END_A: Edge = (w) => -43.7 - 1.478 * (w - KL_W[0]), KL_END_B: Edge = (w) => 6.28 - 1.443 * (w - KL_W[0]);
const klTop = (w: number, v: number) => 28.177 - 0.02015 * w - 0.02086 * v;
// across the roads (w): the guardrails between the carriageways, the lane lines (dashed between the
// motorway's lanes) and the edge lines
const KL_RAILS = [24.3, 32.4, 32.8, 40.6];
const KL_SOLID = [16.6, 23.7, 25.0, 31.8, 33.4, 40.0, 41.2, 45.8], KL_DASHED = [28.4, 36.6];

export function buildKymlingelanken(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const F = KL, ws = steps(KL_W[0], KL_W[1], [...KL_RAILS, ...KL_SOLID, ...KL_DASHED], 2);
  const top = (w: number, v: number) => klTop(w, v);
  // the rails' foot under the deck, for the abutments' walls: from the tracks' frame
  const floor = (w: number, v: number) => {
    const s = (w - v) / Math.SQRT2, u = (w + v) / Math.SQRT2;
    return railAt(AR_TRACKS, Math.max(-12, Math.min(148, s)), u) - 0.9;
  };
  // the slab, its underside and its fascias, and the asphalt on it
  B.tint(CONCRETE);
  band(B, F, ws, KL_END_A, KL_END_B, (w, v) => top(w, v) - 1.3, (w, v) => top(w, v) - 0.03, 'concrete', 3, { faces: 'sides' });
  B.tint(UNDER);
  band(B, F, ws, KL_END_A, KL_END_B, (w, v) => top(w, v) - 1.3, (w, v) => top(w, v) - 1.3, 'fl-under', 3, { faces: 'top' });
  B.tint(ROAD);
  band(B, F, ws, KL_END_A, KL_END_B, top, top, 'ak-asphalt', 6, { faces: 'top' });
  // the edge beams along both sides, a railing on each
  B.tint(CONCRETE);
  for (const [w0, w1] of [[KL_W[0], KL_W[0] + 0.5], [KL_W[1] - 0.5, KL_W[1]]]) {
    band(B, F, [w0, w1], KL_END_A, KL_END_B, (w, v) => top(w, v) - 0.02, (w, v) => top(w, v) + 0.25, 'concrete', 3);
  }
  B.tint(STEEL);
  for (const w of [KL_W[0] + 0.2, KL_W[1] - 0.2]) {
    const vs = steps(KL_END_A(w), KL_END_B(w), [], 3);
    pipeRailing(B, vs.map((v) => v3(F.at(w, v), top(w, v) + 0.25)), 1.1, 2.4);
  }
  // the guardrails: a steel beam on posts every 2 m
  for (const w of [KL_W[0] + 0.9, ...KL_RAILS, KL_W[1] - 0.9]) guardrail(B, F, w, KL_END_A(w) + 0.3, KL_END_B(w) - 0.3, top);
  // the lines
  B.tint(PAINT);
  for (const w of KL_SOLID) band(B, F, [w - 0.075, w + 0.075], KL_END_A, KL_END_B, (ww, v) => top(ww, v) + 0.012, (ww, v) => top(ww, v) + 0.012, 'gs-paint', 4, { faces: 'top' });
  for (const w of KL_DASHED) {
    for (let v = Math.ceil(KL_END_A(w) / 12) * 12; v + 3 < KL_END_B(w); v += 12) {
      const P = (dw: number, dv: number) => v3(F.at(w + dw, v + dv), top(w, v + dv) + 0.012);
      B.poly([P(-0.075, 0), P(0.075, 0), P(0.075, 3), P(-0.075, 3)], UP, 'gs-paint', 4);
    }
  }
  // the abutments: walls along the cutting's sides under the deck's ends, from the tracks' foot
  B.tint(CONCRETE);
  for (const [e, d] of [[KL_END_A, 1], [KL_END_B, -1]] as const) {
    const plan = (w: number) => [e(w), e(w) + d * 1.4].sort((a, b) => a - b) as V2;
    band(B, F, ws, (w) => plan(w)[0], (w) => plan(w)[1], (w, v) => Math.min(floor(w, v), (ground(...F.at(w, v)) ?? 1e3) - 0.3), (w, v) => top(w, v) - 1.28, 'concrete', 3);
  }
}

function guardrail(B: Builder, F: Frame, w: number, v0: number, v1: number, top: (w: number, v: number) => number) {
  B.tint(STEEL);
  const vs = steps(v0, v1, [], 4);
  for (let i = 0; i + 1 < vs.length; i++) {
    bar(B, v3(F.at(w, vs[i]), top(w, vs[i]) + 0.62), v3(F.at(w, vs[i + 1]), top(w, vs[i + 1]) + 0.62), 0.08, 0.32, 'metal');
  }
  for (let v = v0; v <= v1; v += 2) post(B, F.at(w, v), [-F.t[1], F.t[0]], 0.1, 0.14, top(w, v), top(w, v) + 0.72, 'metal', 1);
}

// The cutting's sides east of the deck to the tunnel's mouth: blasted rock rising 3–7 m over the
// tracks on both sides, its foot about 4.5 m beyond the outer tracks (the laser scan), wooded over
// the top. Each a line of its foot's points: world x, z, the foot's and the crest's heights.
type Rock = [number, number, number, number][];
const ROCK_SOUTH: Rock = [
  [-5771.0, -7496.4, 20.84, 24.30], [-5768.1, -7495.6, 20.81, 24.39], [-5765.3, -7494.5, 20.88, 24.65], [-5762.5, -7493.4, 20.64, 25.14],
  [-5759.7, -7492.3, 20.61, 25.54], [-5757.0, -7490.7, 20.61, 25.80], [-5754.2, -7489.6, 20.49, 25.80], [-5751.4, -7488.5, 20.60, 25.45],
  [-5748.7, -7487.4, 20.48, 25.45], [-5740.8, -7482.5, 20.26, 25.71], [-5737.5, -7482.8, 20.27, 26.27], [-5734.8, -7481.6, 20.23, 26.70],
  [-5732.3, -7479.5, 20.16, 26.82], [-5729.5, -7478.3, 20.07, 27.21], [-5726.6, -7477.3, 20.07, 27.60],
];
const ROCK_NORTH: Rock = [
  [-5765.5, -7513.9, 21.89, 24.74], [-5762.6, -7513.3, 21.33, 25.33], [-5760.0, -7511.4, 21.43, 25.74], [-5756.9, -7511.3, 21.16, 26.30],
  [-5754.7, -7508.3, 21.38, 25.94], [-5751.7, -7507.7, 21.11, 25.94], [-5749.1, -7506.1, 21.11, 25.62], [-5746.3, -7505.0, 21.01, 25.35],
  [-5743.5, -7503.8, 20.93, 25.35], [-5740.7, -7502.7, 20.93, 25.36], [-5737.8, -7502.0, 20.90, 25.37], [-5735.1, -7500.8, 20.84, 25.37],
  [-5732.3, -7499.5, 20.73, 25.44], [-5729.5, -7498.3, 20.74, 25.45], [-5726.6, -7497.5, 20.80, 25.63],
];
export const ARVINGE_ROCK: V2 = [-5750, -7495];
const ROCK_FACE = 0xb9b6b0, ROCK_TURF = 0x6a7a4b, ROCK_LEAN = 0.2, ROCK_ROWS = 6;
const bumps = (x: number, y: number, z: number) => Math.sin(x * 1.7 + z * 0.9) * 0.5 + Math.sin(z * 2.3 - y * 1.9) * 0.3 + Math.sin(y * 3.1 + x * 0.7) * 0.2;

export function buildArvingeRock(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  // (the southern face's line runs eastwards with the track to its left, the northern's to its right)
  for (const [pts, side] of [[ROCK_SOUTH, 1], [ROCK_NORTH, -1]] as const) {
    const n = pts.length;
    const out = (i: number): V2 => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return [(-(b[1] - a[1]) / l) * side, ((b[0] - a[0]) / l) * side];
    };
    const face: V3[][] = [], turf: V3[][] = [];
    pts.forEach(([x, z, foot, crest], i) => {
      // (down to its foot at either end)
      const f = Math.min(1, i / 2, (n - 1 - i) / 2), y1 = foot + 0.4 + (crest - foot - 0.4) * f, o = out(i);
      const col: V3[] = [];
      for (let k = 0; k <= ROCK_ROWS; k++) {
        const y = foot - 0.3 + ((y1 - foot + 0.3) * k) / ROCK_ROWS, d = (y - foot) * ROCK_LEAN + (k > 0 && k < ROCK_ROWS ? 0.3 * bumps(x, y, z) : 0);
        col.push([x + o[0] * d, y, z + o[1] * d]);
      }
      face.push(col);
      const [tx, , tz] = col[ROCK_ROWS];
      turf.push([col[ROCK_ROWS], ...[0.6, 2, 4].map((b): V3 => {
        const px = tx + o[0] * b, pz = tz + o[1] * b;
        return [px, Math.max(y1 - 0.15 * b, (ground(px, pz) ?? -1e3) + 0.08), pz];
      })]);
    });
    B.tint(ROCK_FACE);
    loft(B, face, 'gt-rock', (i) => { const o = out(i); return [-o[0], 0.2, -o[1]]; }, 4.8);
    B.tint(ROCK_TURF);
    loft(B, turf, 'gt-turf', () => UP, 8);
  }
}

// ------------------------------------------------------------------ Kista's viaduct
// From Ärvinge the line runs on a viaduct 1.1 km long over Kista: over Kistavägen, Hanstavägen and
// Danmarksgatan, past the offices, over the bus terminal and Kistagången into the station
// (src/open-styles.ts draws it and the deck there), and on over the car parks to Husby's tunnel.
// The laser scan has its decks from 4.5 m south-east of OpenStreetMap's bridge to 7 m past its
// north-western end, the rails at 24.5 m and 9–15 m over the ground; Google's mesh and the
// photographs from the streets under it one slab 13 m wide under both tracks for the first 250 m,
// then two single-track decks 6 m wide parting round the station's island platform and coming
// together again beyond it. Their sides are deep flat fascias of pale concrete, a railing of posts
// and two rails along their edges; under them round columns 1.6 m across, one under each track, at
// the same places along it under both, 33–36 m apart south-east of the station and 23–28 m north-west
// of it (the scan's points on them where they stand clear of the trees and the cars, and the mesh).
// Drawn in four parts, each in a frame along its chord: s metres north-westwards, u to the right
// (north-east); the south-western track (towards Akalla) is the first.
const KISTA_SHAPE = { fascia: -1.9, edge: 0.45, soffit: -2.3, curve: 1.4 };
const KISTA_TINT = 0xb0aba2;
const kc = (deck?: number) => ({ kind: 'columns', n: 1, r: 0.8, inset: 0, deck }) as const;
const kistaPart = (frame: Frame, rows: Rows, decks: Viaduct['decks'], supports: Support[], abutments: Viaduct['abutments'] = [], inner = true): Viaduct => ({
  frame, rows, shape: KISTA_SHAPE, tint: KISTA_TINT, railing: { ...RAILINGS, inner }, decks, supports, abutments,
});
// both tracks, from Ärvinge to where the decks part
export const KISTA_1 = new Frame([-5996.69, -7557.23], [-0.9738, -0.2274]);
const K1_TRACKS: Rows = [
  [-8, 0.01, 24.432, 6.64, 24.41], [-4, 0.0, 24.476, 6.63, 24.459], [0, 0.0, 24.52, 6.62, 24.507], [4, -0.01, 24.52, 6.61, 24.51],
  [8, -0.02, 24.52, 6.6, 24.51], [12, -0.02, 24.52, 6.59, 24.51], [16, -0.03, 24.52, 6.58, 24.51], [20, -0.03, 24.52, 6.56, 24.51],
  [24, -0.03, 24.52, 6.56, 24.51], [28, -0.04, 24.52, 6.55, 24.51], [32, -0.04, 24.522, 6.54, 24.512], [36, -0.05, 24.526, 6.53, 24.516],
  [40, -0.06, 24.53, 6.51, 24.52], [44, -0.06, 24.53, 6.5, 24.52], [48, -0.07, 24.53, 6.49, 24.52], [52, -0.07, 24.53, 6.48, 24.52],
  [56, -0.08, 24.53, 6.47, 24.52], [60, -0.09, 24.53, 6.46, 24.52], [64, -0.1, 24.53, 6.44, 24.52], [68, -0.1, 24.53, 6.43, 24.52],
  [72, -0.11, 24.53, 6.42, 24.52], [76, -0.11, 24.53, 6.41, 24.52], [80, -0.12, 24.53, 6.41, 24.52], [84, -0.12, 24.53, 6.4, 24.52],
  [88, -0.13, 24.53, 6.38, 24.52], [92, -0.13, 24.53, 6.37, 24.522], [96, -0.14, 24.53, 6.36, 24.526], [100, -0.15, 24.531, 6.35, 24.53],
  [104, -0.15, 24.535, 6.34, 24.53], [108, -0.16, 24.539, 6.33, 24.53], [112, -0.16, 24.54, 6.31, 24.53], [116, -0.17, 24.54, 6.3, 24.53],
  [120, -0.18, 24.54, 6.29, 24.53], [124, -0.18, 24.54, 6.28, 24.53], [128, -0.19, 24.54, 6.27, 24.53], [132, -0.19, 24.54, 6.25, 24.53],
  [136, -0.2, 24.54, 6.24, 24.53], [140, -0.21, 24.54, 6.22, 24.53], [144, -0.22, 24.54, 6.2, 24.53], [148, -0.22, 24.54, 6.19, 24.53],
  [152, -0.23, 24.54, 6.17, 24.53], [156, -0.23, 24.54, 6.16, 24.53], [160, -0.24, 24.54, 6.14, 24.531], [164, -0.25, 24.54, 6.12, 24.535],
  [168, -0.27, 24.54, 6.1, 24.539], [172, -0.27, 24.543, 6.08, 24.54], [176, -0.28, 24.547, 6.07, 24.54], [180, -0.29, 24.55, 6.05, 24.54],
  [184, -0.3, 24.55, 6.04, 24.54], [188, -0.32, 24.55, 6.04, 24.54], [192, -0.33, 24.55, 6.04, 24.537], [196, -0.34, 24.55, 6.06, 24.533],
  [200, -0.35, 24.55, 6.08, 24.53], [204, -0.36, 24.55, 6.12, 24.53], [208, -0.38, 24.55, 6.16, 24.53], [212, -0.38, 24.55, 6.23, 24.53],
  [216, -0.38, 24.55, 6.31, 24.53], [220, -0.37, 24.55, 6.41, 24.53], [224, -0.36, 24.55, 6.55, 24.53], [228, -0.35, 24.55, 6.69, 24.53],
  [232, -0.31, 24.553, 6.87, 24.53], [236, -0.27, 24.558, 7.07, 24.53], [240, -0.21, 24.56, 7.29, 24.531], [244, -0.13, 24.56, 7.55, 24.535],
  [248, -0.05, 24.56, 7.81, 24.54], [252, 0.07, 24.56, 8.14, 24.54], [256, 0.19, 24.56, 8.47, 24.54],
];
// (a column under each track: from the slab's middle, half the tracks' spacing either way)
const K1_HALF = (s: number) => (track(K1_TRACKS, s, 1)[0] - track(K1_TRACKS, s, 0)[0]) / 2;
export const KISTA_VIADUCT_1 = kistaPart(KISTA_1, K1_TRACKS, [deckBetween(K1_TRACKS, -4.5, 250, [0, -2.9], [1, 2.9])],
  [29, 60.3, 93.4, 126.2, 159.3, 186.4, 213.2, 247].map((s): Support => ({ ...kc(), n: 2, at: [-K1_HALF(s), K1_HALF(s)], s })),
  [{ from: -4.5, to: -1.5 }]);
// the two decks parting, past Hanstavägen and the offices to Danmarksgatan
export const KISTA_2 = new Frame([-6240.14, -7614.08], [-0.9044, -0.4268]);
const K2_TRACKS: Rows = [
  [-8, 1.54, 24.56, 9.19, 24.532], [-4, 0.76, 24.56, 8.6, 24.536], [0, 0.0, 24.56, 8.01, 24.54], [4, -0.73, 24.56, 7.49, 24.54],
  [8, -1.46, 24.56, 6.98, 24.54], [12, -2.13, 24.56, 6.5, 24.54], [16, -2.81, 24.56, 6.06, 24.54], [20, -3.44, 24.56, 5.62, 24.54],
  [24, -4.05, 24.56, 5.26, 24.544], [28, -4.65, 24.56, 4.89, 24.548], [32, -5.18, 24.56, 4.57, 24.55], [36, -5.72, 24.56, 4.28, 24.55],
  [40, -6.21, 24.56, 3.99, 24.55], [44, -6.67, 24.56, 3.78, 24.55], [48, -7.12, 24.56, 3.56, 24.55], [52, -7.5, 24.555, 3.39, 24.55],
  [56, -7.89, 24.551, 3.25, 24.55], [60, -8.22, 24.55, 3.11, 24.55], [64, -8.53, 24.55, 3.04, 24.55], [68, -8.82, 24.55, 2.97, 24.55],
  [72, -9.06, 24.55, 2.95, 24.55], [76, -9.29, 24.55, 2.95, 24.55], [80, -9.47, 24.55, 2.97, 24.55], [84, -9.63, 24.55, 3.05, 24.55],
  [88, -9.78, 24.55, 3.12, 24.55], [92, -9.86, 24.55, 3.25, 24.55], [96, -9.95, 24.55, 3.4, 24.55], [100, -9.99, 24.55, 3.56, 24.55],
  [104, -10.01, 24.55, 3.78, 24.55], [108, -10.01, 24.55, 4.0, 24.55], [112, -9.96, 24.55, 4.27, 24.55], [116, -9.9, 24.55, 4.56, 24.55],
  [120, -9.79, 24.55, 4.86, 24.55], [124, -9.67, 24.55, 5.23, 24.55], [128, -9.52, 24.55, 5.59, 24.55], [132, -9.33, 24.55, 6.02, 24.55],
  [136, -9.13, 24.55, 6.46, 24.55], [140, -8.87, 24.55, 6.92, 24.549], [144, -8.59, 24.55, 7.43, 24.545], [148, -8.29, 24.55, 7.94, 24.541],
  [152, -7.95, 24.55, 8.52, 24.54], [156, -7.6, 24.55, 9.11, 24.54], [160, -7.19, 24.55, 9.72, 24.54], [164, -6.77, 24.55, 10.38, 24.54],
  [168, -6.33, 24.55, 11.04, 24.54], [172, -5.83, 24.55, 11.77, 24.54], [176, -5.34, 24.55, 12.5, 24.54], [180, -4.78, 24.55, 13.27, 24.54],
  [184, -4.21, 24.55, 14.08, 24.54], [188, -3.61, 24.548, 14.89, 24.54], [192, -2.97, 24.544, 15.77, 24.54], [196, -2.33, 24.54, 16.66, 24.54],
  [200, -1.61, 24.54, 17.59, 24.537], [204, -0.89, 24.54, 18.55, 24.533], [208, -0.14, 24.54, 19.52, 24.531], [212, 0.64, 24.54, 20.55, 24.535],
  [216, 1.44, 24.54, 21.58, 24.539],
];
const kd = (rows: Rows, k: number, from: number, to: number) => deckBetween(rows, from, to, [k, -2.9], [k, 2.9]);
export const KISTA_VIADUCT_2 = kistaPart(KISTA_2, K2_TRACKS, [kd(K2_TRACKS, 0, -1.5, 208.7), kd(K2_TRACKS, 1, -1.5, 208.7)], [
  ...each([29.2, 64.7, 99.9, 135.8, 169.6, 204.4], kc(0)), ...each([33.5, 66.4, 99.2, 132.8, 165.6, 199.1], kc(1)),
]);
// on over Danmarksgatan, Helsingörsgatan and the bus terminal to the station
export const KISTA_3 = new Frame([-6428.88, -7703.15], [-0.6788, -0.7343]);
const K3_TRACKS: Rows = [
  [-8, 1.62, 24.54, 20.61, 24.54], [-4, 0.78, 24.54, 19.95, 24.54], [0, -0.0, 24.54, 19.35, 24.536], [4, -0.77, 24.54, 18.74, 24.532],
  [8, -1.52, 24.54, 18.18, 24.532], [12, -2.21, 24.54, 17.66, 24.536], [16, -2.9, 24.54, 17.13, 24.54], [20, -3.52, 24.537, 16.68, 24.54],
  [24, -4.14, 24.533, 16.23, 24.54], [28, -4.73, 24.532, 15.82, 24.54], [32, -5.27, 24.536, 15.44, 24.54], [36, -5.82, 24.54, 15.07, 24.54],
  [40, -6.29, 24.54, 14.77, 24.54], [44, -6.76, 24.54, 14.46, 24.54], [48, -7.19, 24.54, 14.2, 24.543], [52, -7.59, 24.54, 13.97, 24.547],
  [56, -7.98, 24.54, 13.75, 24.55], [60, -8.31, 24.544, 13.59, 24.55], [64, -8.63, 24.548, 13.43, 24.55], [68, -8.91, 24.552, 13.32, 24.55],
  [72, -9.16, 24.556, 13.23, 24.55], [76, -9.4, 24.56, 13.16, 24.551], [80, -9.58, 24.56, 13.15, 24.555], [84, -9.76, 24.56, 13.13, 24.559],
  [88, -9.89, 24.562, 13.17, 24.56], [92, -9.99, 24.566, 13.23, 24.56], [96, -10.08, 24.57, 13.31, 24.56], [100, -10.11, 24.57, 13.45, 24.56],
  [104, -10.13, 24.57, 13.58, 24.56], [108, -10.12, 24.572, 13.77, 24.563], [112, -10.07, 24.576, 13.98, 24.567], [116, -10.02, 24.58, 14.21, 24.57],
  [120, -9.9, 24.58, 14.49, 24.57], [124, -9.79, 24.58, 14.77, 24.57], [128, -9.63, 24.58, 15.12, 24.57], [132, -9.45, 24.58, 15.47, 24.57],
  [136, -9.26, 24.58, 15.85, 24.57], [140, -9.01, 24.58, 16.28, 24.57], [144, -8.76, 24.58, 16.71, 24.57], [148, -8.47, 24.577, 17.19, 24.57],
  [152, -8.15, 24.573, 17.67, 24.57], [156, -7.82, 24.57, 18.19, 24.568], [160, -7.43, 24.57, 18.73, 24.564], [164, -7.05, 24.57, 19.28, 24.56],
  [168, -6.61, 24.567, 19.87, 24.56], [172, -6.16, 24.563, 20.45, 24.56], [176, -5.69, 24.559, 21.06, 24.558], [180, -5.17, 24.555, 21.68, 24.554],
  [184, -4.66, 24.551, 22.3, 24.55], [188, -4.09, 24.55, 22.94, 24.55], [192, -3.52, 24.55, 23.58, 24.55], [196, -2.93, 24.55, 24.23, 24.55],
  [200, -2.32, 24.55, 24.88, 24.55], [204, -1.71, 24.55, 25.53, 24.55], [208, -1.07, 24.55, 26.19, 24.55], [212, -0.43, 24.55, 26.84, 24.55],
  [216, 0.21, 24.548, 27.5, 24.547], [220, 0.86, 24.544, 28.16, 24.543],
];
export const KISTA_VIADUCT_3 = kistaPart(KISTA_3, K3_TRACKS, [kd(K3_TRACKS, 0, -1.5, 214.3), kd(K3_TRACKS, 1, -1.5, 203.4)], [
  ...each([30.6, 65.9, 100.3, 137.3, 171.7, 205.8], kc(0)), ...each([31.0, 65.5, 90.0, 115.9, 133.9, 167.6, 183.9], kc(1)),
]);
// north-west of the station, over the car parks to the bank before Husby's tunnel (the station's
// style draws the first columns, 132 m from its platform's middle)
export const KISTA_4 = new Frame([-6695.02, -8042.58], [-0.6542, -0.7563]);
const K4_TRACKS: Rows = [
  [-8, -1.05, 24.512, 26.21, 24.52], [-4, -0.53, 24.516, 26.7, 24.52], [0, -0.0, 24.52, 27.2, 24.52], [4, 0.52, 24.52, 27.67, 24.524],
  [8, 1.05, 24.52, 28.14, 24.528], [12, 1.57, 24.522, 28.59, 24.53], [16, 2.09, 24.526, 29.03, 24.53], [20, 2.61, 24.53, 29.46, 24.53],
  [24, 3.12, 24.534, 29.85, 24.53], [28, 3.63, 24.538, 30.24, 24.53], [32, 4.14, 24.544, 30.59, 24.53], [36, 4.63, 24.553, 30.92, 24.53],
  [40, 5.12, 24.56, 31.25, 24.531], [44, 5.6, 24.56, 31.51, 24.535], [48, 6.07, 24.56, 31.78, 24.539], [52, 6.52, 24.563, 32.0, 24.54],
  [56, 6.95, 24.567, 32.2, 24.54], [60, 7.37, 24.571, 32.39, 24.541], [64, 7.75, 24.575, 32.53, 24.545], [68, 8.14, 24.579, 32.66, 24.549],
  [72, 8.48, 24.583, 32.75, 24.55], [76, 8.81, 24.587, 32.82, 24.55], [80, 9.12, 24.59, 32.87, 24.55], [84, 9.39, 24.59, 32.87, 24.55],
  [88, 9.65, 24.59, 32.86, 24.55], [92, 9.87, 24.59, 32.81, 24.553], [96, 10.06, 24.59, 32.75, 24.557], [100, 10.25, 24.59, 32.66, 24.56],
  [104, 10.38, 24.59, 32.53, 24.56], [108, 10.51, 24.59, 32.4, 24.56], [112, 10.59, 24.59, 32.21, 24.56], [116, 10.65, 24.59, 32.01, 24.56],
  [120, 10.7, 24.589, 31.79, 24.56], [124, 10.7, 24.585, 31.52, 24.56], [128, 10.7, 24.581, 31.25, 24.56], [132, 10.64, 24.577, 30.94, 24.557],
  [136, 10.58, 24.573, 30.61, 24.553], [140, 10.49, 24.566, 30.25, 24.547], [144, 10.35, 24.554, 29.85, 24.539], [148, 10.22, 24.542, 29.45, 24.531],
  [152, 10.02, 24.523, 28.99, 24.519], [156, 9.82, 24.503, 28.52, 24.507], [160, 9.59, 24.482, 28.03, 24.491], [164, 9.31, 24.457, 27.49, 24.471],
  [168, 9.04, 24.433, 26.95, 24.451], [172, 8.71, 24.402, 26.35, 24.423], [176, 8.36, 24.37, 25.75, 24.394], [180, 7.99, 24.334, 25.12, 24.361],
  [184, 7.58, 24.294, 24.45, 24.325], [188, 7.17, 24.253, 23.78, 24.287], [192, 6.7, 24.205, 23.04, 24.238], [196, 6.23, 24.156, 22.3, 24.189],
  [200, 5.72, 24.102, 21.52, 24.134], [204, 5.17, 24.041, 20.72, 24.077], [208, 4.63, 23.98, 19.9, 24.018], [212, 4.01, 23.907, 19.03, 23.952],
  [216, 3.4, 23.834, 18.15, 23.886], [220, 2.75, 23.758, 17.23, 23.81], [224, 2.07, 23.68, 16.28, 23.732], [228, 1.39, 23.601, 15.32, 23.652],
  [232, 0.64, 23.503, 14.3, 23.568], [236, -0.1, 23.405, 13.29, 23.485], [240, -0.89, 23.307, 12.22, 23.388], [244, -1.71, 23.209, 11.15, 23.29],
];
export const KISTA_VIADUCT_4 = kistaPart(KISTA_4, K4_TRACKS, [kd(K4_TRACKS, 0, -2, 234.5), kd(K4_TRACKS, 1, -1.8, 237.2)], [
  ...each([27.8, 50.6, 73.5, 101.4, 123.4, 148.4, 175.4, 203.2], kc(0)), ...each([31.0, 55.0, 75.9, 101.9, 127.9, 156.8, 187.4, 206.1], kc(1)),
], [{ from: 231.5, to: 234.5, deck: 0 }, { from: 234.2, to: 237.2, deck: 1 }]);
