import type { Builder, V2 } from './builder.ts';
import { block, Frame, type Ground } from './gubbangen.ts';
import { band, chainFence, CONCRETE, type Edge, FLOOR, line, off, RAILING, railAt, type Rows, steps, track, UNDER } from './farsta-line-north.ts';
import { buildViaduct, CURVED, deckBetween, each, OVERHUNG, RAILINGS, type Viaduct } from './skarpnack-line.ts';
import { alongTop, buildRoadDeck, type RoadDeck } from './road-bridges.ts';

// What the green line looks out on from Blackeberg to Hässelby strand, beyond what the city draws
// there itself (its blocks with facades, the streets and the trees: see the areas in
// src/detail/areas.ts), as src/detail/vasterort.ts east of it.
//
// BLACKEBERG TO JOHANNELUND
//
// The metro's bridges, from east to west, each from Lantmäteriet's laser scan (Laserdata
// Nedladdning, skog, 2021, CC BY 4.0: its deck's ends and edges, the ground and the streets under
// it), the streets it crosses from OpenStreetMap, and its looks from photographs on Mapillary
// (2015–2026) and Google's 3D mesh; the decks follow the tracks (public/data/track-geometry.json).
// The network draws the tracks on them and leaves their girders, piers and railings to this
// (src/detail/viaducts.ts). Neither the scan nor the mesh sees well under a deck: the supports are
// placed from the photographs, where the streets under the decks leave room.

// ------------------------------------------------------------------ Björnsonsgatan's bridge
// North of Blackeberg both tracks cross Björnsonsgatan and the footway beside it, on two decks side
// by side with a slot between them: s metres north-north-westwards from where OpenStreetMap's bridge
// starts, u to the right (east-north-east); the eastern track is the first. The laser scan has the
// decks from the start to 32 m along, the slot 3.2 m wide at the start and 1.6 m at the end, and
// the ground sloping 5 m down from either end to the street; the photographs a flat slab with a
// thick edge beam and a railing of pipes, on two rows of square columns either side of the street,
// the northern one on a low plinth by the footway.
export const BJORNSONSGATAN = new Frame([-10091.47, -1976.08], [-0.4699, -0.8827]);
const BJ_TRACKS: Rows = [
  [-12, 0.47, 30.757, -8.98, 30.776], [-8, 0.31, 30.728, -8.88, 30.747], [-4, 0.16, 30.699, -8.79, 30.719], [0, 0, 30.67, -8.69, 30.691],
  [4, -0.16, 30.64, -8.59, 30.661], [8, -0.31, 30.613, -8.47, 30.63], [12, -0.38, 30.578, -8.33, 30.598], [16, -0.44, 30.543, -8.15, 30.564],
  [20, -0.4, 30.516, -7.94, 30.537], [24, -0.35, 30.486, -7.69, 30.507], [28, -0.2, 30.456, -7.42, 30.475], [32, -0.05, 30.429, -7.11, 30.44],
  [36, 0.12, 30.399, -6.81, 30.406], [40, 0.28, 30.37, -6.51, 30.373], [44, 0.45, 30.341, -6.21, 30.339], [48, 0.61, 30.312, -5.92, 30.306],
];
export const BJORNSONSGATAN_BRIDGE: Viaduct = {
  frame: BJORNSONSGATAN, rows: BJ_TRACKS, railing: RAILINGS,
  shape: { fascia: -1.3, edge: 0.5, soffit: -1.25 },
  decks: [deckBetween(BJ_TRACKS, 0, 32, [1, -2.6], [1, 2.8]), deckBetween(BJ_TRACKS, 0, 32, [0, -2.5], [0, 2.5])],
  supports: [
    { s: 11.3, kind: 'columns', n: 2, square: 0.7, inset: 1.3 },
    { s: 21.8, kind: 'columns', n: 2, square: 0.7, inset: 1.3, plinth: { h: 0.45, out: 0.6 } },
  ],
  abutments: [0, 1].flatMap((deck) => [{ from: 0, to: 2, deck }, { from: 30.5, to: 32, deck }]),
};

// ------------------------------------------------------------------ the arches over Kanaans väg and Grimstagatan
// Between Blackeberg and Råcksta both tracks cross the valley of Kanaans väg, Grimstagatan, their
// paths and the brook on one deck 164 m long, on two concrete arches: s metres northwards from
// where OpenStreetMap's bridge starts, u to the right (east); the eastern track is the first. The
// laser scan has the deck from 2 m before that to 162 m along, 9–11 m over the valley's floor; the
// photographs and the mesh each arch as two ribs side by side under the tracks, rising from their
// footings in the valley to just under the deck at their crowns, square columns from the ribs and
// the ground up to the deck, a thin slab and a railing of panels on posts. The southern arch springs
// from the slope beyond Kanaans väg 10 m along and from the valley's floor 79 m along, the northern
// one beside it 85 m along to the slope beyond Grimstagatan 146 m along (where the mesh has them:
// the trees hide the southern one's southern half, which the scan has rising from 10 m along).
export const RACKSTA_ARCHES = new Frame([-10136.74, -2164.21], [0.1320, -0.9912]);
const RA_TRACKS: Rows = [
  [-12, 1.4, 25.845, -2.6, 25.804], [-8, 0.93, 25.77, -3.11, 25.719], [-4, 0.47, 25.695, -3.61, 25.634], [0, 0, 25.62, -4.1, 25.55],
  [4, -0.45, 25.548, -4.64, 25.46], [8, -0.95, 25.467, -5.1, 25.381], [12, -1.36, 25.393, -5.55, 25.295], [16, -1.74, 25.317, -5.95, 25.219],
  [20, -2.15, 25.235, -6.33, 25.148], [24, -2.46, 25.175, -6.66, 25.087], [28, -2.78, 25.115, -6.98, 25.024], [32, -3.05, 25.064, -7.22, 24.972],
  [36, -3.33, 25.01, -7.46, 24.92], [40, -3.56, 24.96, -7.65, 24.861], [44, -3.75, 24.909, -7.82, 24.809], [48, -3.97, 24.85, -7.97, 24.769],
  [52, -4.1, 24.806, -8.08, 24.741], [56, -4.23, 24.762, -8.18, 24.709], [60, -4.33, 24.724, -8.24, 24.681], [64, -4.42, 24.688, -8.31, 24.65],
  [68, -4.48, 24.656, -8.33, 24.626], [72, -4.5, 24.624, -8.35, 24.602], [76, -4.52, 24.588, -8.36, 24.573], [80, -4.5, 24.559, -8.34, 24.544],
  [84, -4.47, 24.531, -8.31, 24.514], [88, -4.42, 24.504, -8.26, 24.49], [92, -4.33, 24.477, -8.2, 24.463], [96, -4.25, 24.453, -8.11, 24.439],
  [100, -4.12, 24.429, -8.02, 24.415], [104, -3.98, 24.405, -7.89, 24.388], [108, -3.8, 24.378, -7.76, 24.364], [112, -3.6, 24.354, -7.6, 24.337],
  [116, -3.41, 24.33, -7.43, 24.317], [120, -3.16, 24.303, -7.23, 24.295], [124, -2.93, 24.279, -7.01, 24.272], [128, -2.68, 24.255, -6.76, 24.245],
  [132, -2.42, 24.231, -6.53, 24.221], [136, -2.12, 24.204, -6.27, 24.197], [140, -1.84, 24.18, -5.98, 24.17], [144, -1.56, 24.156, -5.69, 24.146],
  [148, -1.23, 24.129, -5.37, 24.119], [152, -0.94, 24.105, -5.08, 24.098], [156, -0.64, 24.081, -4.74, 24.075], [160, -0.3, 24.054, -4.45, 24.054],
  [164, -0.04, 24.033, -4.12, 24.027], [168, 0.31, 24.006, -3.83, 24.003], [172, 0.62, 23.981, -3.52, 23.977], [176, 0.93, 23.956, -3.21, 23.952],
];
const RA_MID: Edge = (s) => (track(RA_TRACKS, s, 0)[0] + track(RA_TRACKS, s, 1)[0]) / 2;
const raRail = (s: number) => railAt(RA_TRACKS, s, RA_MID(s));
// an arch: where it springs on either side (s, height) and its crown's s, its top there 1.4 m under
// the rails; its ribs RIB wide either side of the deck's middle, RIB_AT from it to theirs, and deeper
// towards the springings
interface Arch { from: V2; crown: number; to: V2 }
const ARCHES: Arch[] = [{ from: [10, 16.2], crown: 44, to: [79, 13.6] }, { from: [85, 13.6], crown: 115, to: [146, 15.0] }];
const RIB = 1.3, RIB_AT = 2.3;
const archF = (a: Arch, s: number) => (s < a.crown ? (a.crown - s) / (a.crown - a.from[0]) : (s - a.crown) / (a.to[0] - a.crown));
const archTop = (a: Arch, s: number) => {
  const crown = raRail(a.crown) - 1.4, end = s < a.crown ? a.from[1] : a.to[1];
  return crown - (crown - end) * archF(a, s) ** 2;
};
const archUnder = (a: Arch, s: number) => archTop(a, s) - 0.9 - 0.5 * archF(a, s) ** 2;
const archAt = (s: number) => ARCHES.find((a) => s >= a.from[0] && s <= a.to[0]);
// the columns: on the ribs every 6 m or so where they are 0.8 m or more under the deck, and on the
// ground between the abutments and the arches and between the arches' footings
const RA_COLUMNS = [6, 82, 151.5, ...ARCHES.flatMap((a) => steps(a.from[0], a.to[0], [], 6).slice(1, -1).filter((s) => raRail(s) - 1.5 - archTop(a, s) > 0.8))];
export const RACKSTA_ARCHES_BRIDGE: Viaduct = {
  frame: RACKSTA_ARCHES, rows: RA_TRACKS, shape: CURVED, railing: RAILINGS,
  decks: [deckBetween(RA_TRACKS, -2, 162, [1, -2.4], [0, 2.4])],
  supports: each(RA_COLUMNS, { kind: 'columns', n: 2, at: [-RIB_AT, RIB_AT], square: 0.6, inset: 0 }),
  abutments: [{ from: -2, to: 2 }, { from: 157, to: 162 }],
};

export function buildRackstaArches(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const F = RACKSTA_ARCHES;
  const local = (x: number, z: number): V2 => {
    const dx = x - F.o[0], dz = z - F.o[1];
    return [dx * F.t[0] + dz * F.t[1], -dx * F.t[1] + dz * F.t[0]];
  };
  // what the columns stand on: the ribs, and the ground elsewhere
  const onGround: Ground = (x, z) => {
    const [s, u] = local(x, z), a = archAt(s), d = Math.abs(u - RA_MID(s));
    if (a && d > RIB_AT - RIB / 2 - 0.1 && d < RIB_AT + RIB / 2 + 0.1) return archTop(a, s);
    return ground(x, z);
  };
  buildViaduct(B, onGround, RACKSTA_ARCHES_BRIDGE);

  // the ribs, and the footings they spring from (one between the two arches)
  for (const a of ARCHES) {
    const ss = steps(a.from[0], a.to[0], [a.crown], 2);
    const top = (s: number) => archTop(a, s), under = (s: number) => archUnder(a, s);
    for (const side of [-1, 1]) {
      const lo: Edge = (s) => RA_MID(s) + side * RIB_AT - RIB / 2, hi: Edge = (s) => RA_MID(s) + side * RIB_AT + RIB / 2;
      B.tint(CONCRETE);
      band(B, F, ss, lo, hi, under, top, 'concrete', 3, { faces: 'sides' });
      band(B, F, ss, lo, hi, under, top, 'concrete', 3, { faces: 'top' });
      B.tint(UNDER);
      band(B, F, ss, lo, hi, under, (s) => under(s) + 0.02, 'fl-under', 3);
    }
  }
  B.tint(CONCRETE);
  const w = RIB_AT + RIB / 2 + 0.5;
  for (const [s0, s1, y] of [[8, 12, 16.2], [77, 87, 13.6], [144, 148, 15.0]]) {
    const plan: V2[] = [[s0, RA_MID(s0) - w], [s1, RA_MID(s1) - w], [s1, RA_MID(s1) + w], [s0, RA_MID(s0) + w]];
    const foot = Math.min(...plan.map(([s, u]) => ground(...F.at(s, u)) ?? y)) - 1;
    block(B, F, plan, () => foot, () => y + 0.3, 'concrete', 3);
  }
}

// ------------------------------------------------------------------ Bergslagsvägen's bridge at Råcksta
// South of Råcksta's platform both tracks cross Bergslagsvägen's two carriageways and the cycleways
// either side of them: s metres northwards from where OpenStreetMap's western track's bridge starts,
// u to the right (east); the western track is the first. The laser scan has the deck 11–12.5 m wide
// from 5 m before that to 48 m along; the photographs a thin slab with rounded edges and a railing of
// pipes on three rows of round columns that flare into wide caps under it, between the cycleways
// and the carriageways and along the median.
export const BERGSLAGSVAGEN_RACKSTA = new Frame([-10097.77, -2439.94], [0.1026, -0.9947]);
const BR_TRACKS: Rows = [
  [-16, -0.45, 23.168, 4.15, 23.172], [-12, -0.34, 23.146, 4.41, 23.148], [-8, -0.22, 23.124, 4.68, 23.124], [-4, -0.11, 23.102, 4.94, 23.1],
  [0, 0, 23.08, 5.21, 23.075], [4, 0.12, 23.058, 5.45, 23.052], [8, 0.23, 23.035, 5.7, 23.027], [12, 0.29, 23.012, 5.92, 23.006],
  [16, 0.33, 22.985, 6.14, 22.986], [20, 0.36, 22.96, 6.36, 22.965], [24, 0.34, 22.938, 6.54, 22.942], [28, 0.33, 22.917, 6.73, 22.918],
  [32, 0.28, 22.89, 6.87, 22.895], [36, 0.22, 22.863, 7.03, 22.87], [40, 0.13, 22.84, 7.15, 22.845], [44, 0.04, 22.82, 7.26, 22.823],
  [48, -0.06, 22.797, 7.38, 22.798], [52, -0.15, 22.775, 7.5, 22.774], [56, -0.25, 22.753, 7.62, 22.75], [60, -0.34, 22.731, 7.73, 22.726],
];
export const BERGSLAGSVAGEN_RACKSTA_BRIDGE: Viaduct = {
  frame: BERGSLAGSVAGEN_RACKSTA, rows: BR_TRACKS, railing: RAILINGS,
  shape: { fascia: -0.85, edge: 0.4, soffit: -1.25, curve: 1.6 },
  decks: [deckBetween(BR_TRACKS, -5, 48, [0, -2.9], [1, 2.4])],
  supports: each([10, 25, 39.5], { kind: 'columns', n: 3, r: 0.4, flare: 2.8, inset: 2.0 }),
  abutments: [{ from: -5, to: -2 }, { from: 45.5, to: 48 }],
};

// ------------------------------------------------------------------ the bridge over the depot's tracks
// Between Råcksta and Vällingby the northern track climbs out of its cutting and crosses the tracks
// into Vällingby's depot on a deck of its own: s metres north-westwards from where OpenStreetMap's
// bridge starts, u to the right (north-east). The laser scan has the deck 5.4 m wide from 8 m before
// that to 56 m along, 5–6 m over the depot's tracks; the mesh single columns under it 8, 24 and 41 m
// along.
export const DEPOT_FLYOVER = new Frame([-10379.82, -3269.88], [-0.7449, -0.6671]);
const DF_TRACKS: Rows = [
  [-16, 0.32, 20.8], [-12, 0.24, 20.89], [-8, 0.16, 20.98], [-4, 0.08, 21.07],
  [0, 0, 21.16], [4, -0.08, 21.25], [8, -0.16, 21.34], [12, -0.23, 21.427],
  [16, -0.31, 21.512], [20, -0.37, 21.6], [24, -0.42, 21.69], [28, -0.47, 21.779],
  [32, -0.49, 21.864], [36, -0.51, 21.948], [40, -0.49, 22.015], [44, -0.46, 22.082],
  [48, -0.4, 22.154], [52, -0.33, 22.226], [56, -0.21, 22.295], [60, -0.08, 22.363],
  [64, 0.06, 22.43], [68, 0.2, 22.498], [72, 0.34, 22.565], [76, 0.47, 22.633],
];
export const DEPOT_FLYOVER_BRIDGE: Viaduct = {
  frame: DEPOT_FLYOVER, rows: DF_TRACKS, shape: CURVED, railing: RAILINGS,
  decks: [deckBetween(DF_TRACKS, -8, 56, [0, -2.9], [0, 2.5])],
  supports: each([8, 24, 41], { kind: 'columns', n: 1, r: 0.55, inset: 0 }),
  abutments: [{ from: -8, to: -5 }, { from: 53, to: 56 }],
};

// ------------------------------------------------------------------ Abiskovägen's bridge
// West of Vällingby both tracks cross Abiskovägen: s metres east-south-eastwards from where
// OpenStreetMap's bridge starts, u to the right (south-south-west); the northern track is the
// first. The laser scan has the deck from 3 m to 26 m along, the street 5.4 m under the rails
// between the abutments' faces 7 m and 21 m along; it is one span, its edge beams deep.
export const ABISKOVAGEN = new Frame([-11050.42, -3944.62], [0.8191, 0.5736]);
const AV_TRACKS: Rows = [
  [-16, 0.21, 23.525, 3.85, 23.629], [-12, 0.16, 23.439, 3.78, 23.536], [-8, 0.1, 23.352, 3.71, 23.443], [-4, 0.05, 23.266, 3.65, 23.35],
  [0, 0, 23.18, 3.57, 23.25], [4, -0.05, 23.09, 3.51, 23.165], [8, -0.1, 23.009, 3.44, 23.069], [12, -0.11, 22.915, 3.41, 22.979],
  [16, -0.11, 22.829, 3.39, 22.898], [20, -0.06, 22.738, 3.42, 22.804], [24, -0.02, 22.657, 3.46, 22.709], [28, 0.04, 22.566, 3.5, 22.616],
  [32, 0.09, 22.48, 3.54, 22.523], [36, 0.14, 22.394, 3.58, 22.429], [40, 0.19, 22.308, 3.62, 22.336],
];
export const ABISKOVAGEN_BRIDGE: Viaduct = {
  frame: ABISKOVAGEN, rows: AV_TRACKS, railing: RAILINGS,
  shape: { fascia: -1.6, edge: 0.45, soffit: -1.45 },
  decks: [deckBetween(AV_TRACKS, 3, 26, [0, -2.4], [1, 3.0])],
  supports: [],
  abutments: [{ from: 3, to: 7 }, { from: 21, to: 26 }],
};

// ------------------------------------------------------------------ Bergslagsvägen's viaduct
// East of Johannelund both tracks cross Bergslagsvägen and the fields either side of it on a
// viaduct 166 m long: s metres westwards from where OpenStreetMap's bridge starts, u to the right
// (north); the southern track is the first. The laser scan has the deck 9 m wide from 4 m before
// that to 166 m along, the ground 6–9 m under it; the mesh and the photographs a continuous girder
// deepening in curves over four piers, 34 m apart, and a railing of pipes. The network has the line
// about 0.9 m higher at its western end than the scan (Johannelund's platform is level in it), and
// the deck follows the tracks.
export const BERGSLAGSVAGEN_VIADUCT = new Frame([-11224.95, -4025.67], [-0.9792, -0.2028]);
const BV_TRACKS: Rows = [
  [-16, -1.09, 26.564, -4.59, 26.512], [-12, -0.82, 26.643, -4.38, 26.595], [-8, -0.54, 26.722, -4.16, 26.678], [-4, -0.27, 26.801, -3.94, 26.761],
  [0, 0, 26.88, -3.73, 26.84], [4, 0.26, 26.956, -3.5, 26.93], [8, 0.56, 27.041, -3.29, 27.01], [12, 0.8, 27.117, -3.1, 27.087],
  [16, 1.02, 27.194, -2.91, 27.172], [20, 1.27, 27.279, -2.74, 27.25], [24, 1.46, 27.355, -2.59, 27.33], [28, 1.65, 27.431, -2.45, 27.41],
  [32, 1.84, 27.517, -2.32, 27.492], [36, 1.99, 27.593, -2.21, 27.564], [40, 2.12, 27.666, -2.11, 27.634], [44, 2.23, 27.733, -2.02, 27.71],
  [48, 2.35, 27.81, -1.94, 27.779], [52, 2.41, 27.878, -1.9, 27.846], [56, 2.47, 27.946, -1.85, 27.915], [60, 2.52, 28.023, -1.82, 27.994],
  [64, 2.55, 28.09, -1.8, 28.066], [68, 2.57, 28.157, -1.79, 28.134], [72, 2.56, 28.22, -1.8, 28.19], [76, 2.55, 28.276, -1.81, 28.253],
  [80, 2.52, 28.329, -1.85, 28.309], [84, 2.48, 28.381, -1.88, 28.365], [88, 2.43, 28.441, -1.93, 28.428], [92, 2.37, 28.497, -1.99, 28.484],
  [96, 2.32, 28.553, -2.05, 28.54], [100, 2.25, 28.612, -2.12, 28.596], [104, 2.19, 28.664, -2.2, 28.659], [108, 2.11, 28.71, -2.29, 28.703],
  [112, 2.03, 28.755, -2.38, 28.738], [116, 1.94, 28.794, -2.49, 28.779], [120, 1.85, 28.831, -2.6, 28.815], [124, 1.76, 28.866, -2.7, 28.851],
  [128, 1.64, 28.91, -2.82, 28.887], [132, 1.52, 28.95, -2.94, 28.927], [136, 1.4, 28.986, -3.06, 28.96], [140, 1.23, 29.013, -3.2, 28.988],
  [144, 1.08, 29.037, -3.34, 29.02], [148, 0.9, 29.058, -3.49, 29.04], [152, 0.69, 29.08, -3.63, 29.06], [156, 0.47, 29.1, -3.79, 29.082],
  [160, 0.24, 29.12, -3.97, 29.109], [164, -0.02, 29.141, -4.12, 29.13], [168, -0.26, 29.162, -4.3, 29.158], [172, -0.51, 29.183, -4.47, 29.183],
  [176, -0.76, 29.204, -4.64, 29.208],
];
const BV_PIERS = [29.3, 63.5, 97.8, 130.7];
export const BERGSLAGSVAGEN_VIADUCT_BRIDGE: Viaduct = {
  frame: BERGSLAGSVAGEN_VIADUCT, rows: BV_TRACKS, railing: RAILINGS,
  shape: { fascia: -1.7, edge: 0.45, soffit: -2.0, haunch: { at: BV_PIERS, depth: 1.3, length: 11 } },
  decks: [deckBetween(BV_TRACKS, -4, 166, [1, -2.1], [0, 2.7])],
  supports: each(BV_PIERS, { kind: 'pier', wide: 4.2, thick: 1.4 }),
  abutments: [{ from: -4, to: 2 }, { from: 158, to: 166 }],
};

// ------------------------------------------------------------------ Lövstavägen's viaduct
// West of Johannelund both tracks cross Liljeörnsgatan, Lövstavägen's two carriageways and two
// cycleways on a viaduct 108 m long, with a footway along its southern side: s metres eastwards from
// where OpenStreetMap's bridge starts, u to the right (south); the northern track is the first. The
// laser scan has the deck 10.5 m wide from 6 m before that to 102 m along, flat across at the
// ballast's level, the ground 5–6 m under it; the photographs pairs of round columns under
// crossbeams 12–16 m apart, a slab with overhanging edges, a railing of pipes and a fence between
// the footway and the tracks. (The scan's northern edge is 1 m from the network's northern track,
// which OpenStreetMap has about a metre too far north: the deck runs on 1.9 m past it, for the
// trains.)
export const LOVSTAVAGEN = new Frame([-11642.10, -4074.55], [0.9998, 0.0192]);
const LV_TRACKS: Rows = [
  [-16, 0.41, 30.779, 4.56, 30.717], [-12, 0.31, 30.727, 4.49, 30.665], [-8, 0.21, 30.675, 4.43, 30.614], [-4, 0.1, 30.622, 4.37, 30.562],
  [0, 0, 30.57, 4.3, 30.51], [4, -0.11, 30.516, 4.24, 30.456], [8, -0.2, 30.468, 4.18, 30.408], [12, -0.27, 30.411, 4.11, 30.354],
  [16, -0.33, 30.352, 4.08, 30.306], [20, -0.37, 30.296, 4.05, 30.252], [24, -0.39, 30.248, 4.03, 30.207], [28, -0.41, 30.194, 4.02, 30.157],
  [32, -0.4, 30.14, 4.01, 30.106], [36, -0.4, 30.092, 4.02, 30.058], [40, -0.38, 30.038, 4.02, 30.004], [44, -0.37, 29.984, 4.03, 29.956],
  [48, -0.35, 29.928, 4.04, 29.902], [52, -0.33, 29.875, 4.05, 29.848], [56, -0.3, 29.818, 4.06, 29.8], [60, -0.28, 29.764, 4.07, 29.746],
  [64, -0.27, 29.716, 4.08, 29.698], [68, -0.24, 29.662, 4.09, 29.644], [72, -0.22, 29.608, 4.1, 29.59], [76, -0.2, 29.56, 4.1, 29.542],
  [80, -0.17, 29.506, 4.12, 29.492], [84, -0.15, 29.45, 4.13, 29.448], [88, -0.11, 29.392, 4.15, 29.396], [92, -0.08, 29.34, 4.16, 29.342],
  [96, -0.05, 29.286, 4.18, 29.294], [100, -0.01, 29.232, 4.21, 29.24], [104, 0.03, 29.182, 4.23, 29.192], [108, 0.06, 29.13, 4.26, 29.139],
  [112, 0.1, 29.077, 4.29, 29.087], [116, 0.14, 29.025, 4.31, 29.035],
];
const LV_LO: Edge = (s) => track(LV_TRACKS, s, 0)[0] - 5.3, LV_FENCE: Edge = (s) => track(LV_TRACKS, s, 0)[0] - 2.2;
const LV_ENDS: V2 = [-6, 102];
export const LOVSTAVAGEN_BRIDGE: Viaduct = {
  frame: LOVSTAVAGEN, rows: LV_TRACKS, shape: OVERHUNG, railing: RAILINGS,
  decks: [{ from: LV_ENDS[0], to: LV_ENDS[1], lo: LV_LO, hi: (s) => track(LV_TRACKS, s, 1)[0] + 1.9 }],
  supports: each([14.5, 27, 41, 56.9, 72, 86], { kind: 'columns', n: 2, at: [-1.7, 1.7], r: 0.4, inset: 0, beam: { w: 1.3, depth: 0.6 } }),
  abutments: [{ from: -6, to: -2.5 }, { from: 98.5, to: 102 }],
};

export function buildLovstavagen(B: Builder, ground: Ground) {
  buildViaduct(B, ground, LOVSTAVAGEN_BRIDGE);
  // the footway along the southern side, at the ballast's level, and the fence beside the tracks
  const F = LOVSTAVAGEN, ss = steps(LV_ENDS[0], LV_ENDS[1], [], 2);
  const rail = (s: number, u: number) => railAt(LV_TRACKS, s, u);
  B.tint(0x7a7b7c);
  band(B, F, ss, off(LV_LO, 0.4), LV_FENCE, (s, u) => rail(s, u) + FLOOR, (s, u) => rail(s, u) - 0.15, 'rp-asphalt', 6, { faces: 'top' });
  B.tint(RAILING);
  chainFence(B, line(F, ss, LV_FENCE, (s, u) => rail(s, u) - 0.15), 1.8);
}

// HÄSSELBY
//
// The roads and paths over the line on bridges OpenStreetMap has, which the city leaves out
// (tools/build-city.ts): each from the laser scan (its deck's edges and surface, the tracks under
// it), the lines of the street from OpenStreetMap and its looks from Google's 3D mesh and
// photographs on Mapillary; built by src/detail/road-bridges.ts, t metres along OpenStreetMap's
// line, u to the right.

const PATH = 0x7a7b7c;
// Kirunagatan's cycleway between Vällingby and Johannelund, over both tracks in their cutting on a
// slab 9 m wide, 5 m over the rails (t south-south-eastwards)
const KIRUNAGATAN: RoadDeck = {
  line: [[-11116.1, -3972.7], [-11106.6, -3990.7]], from: 1.5, to: 16,
  edges: () => [-3.8, 5.3], top: alongTop([[0, 29.1], [8, 29.15], [16, 29.35]]),
  depth: 0.9, surface: PATH, abutments: [1.5, 1.5],
};
// Viveka Trolles gränd at Hässelby gård, a street with a pavement either side, rising 5 % south
// over both tracks on a slab 11.7 m wide (t south-south-westwards)
const VIVEKA_TROLLES_GRAND: RoadDeck = {
  line: [[-12014.3, -4018.4], [-12019.5, -4031.7]], from: 2, to: 13.5,
  edges: () => [-6.3, 5.4], top: alongTop([[0, 39.2], [4, 39.4], [8, 39.6], [12, 39.8], [16, 40.0]]),
  depth: 0.9, paths: [[-6.3, -4.0], [3.2, 5.4]], abutments: [1.5, 1.5],
};
// Melongatan east of Hässelby strand, over the three tracks into the terminus on a deck 17.7 m wide
// where it meets the street along the line, flat (t north-eastwards)
const MELONGATAN: RoadDeck = {
  line: [[-12747.5, -3637], [-12728.3, -3621.8]], from: 3, to: 21,
  edges: () => [-9.1, 8.6], top: alongTop([[0, 36.05], [24, 36.15]]),
  depth: 1.0, paths: [[-9.1, -6.6], [6.1, 8.6]], abutments: [1.5, 1.5],
};
// (the footbridge over Hässelby strand's tracks is the station's, src/open-styles.ts)
const ROADS = [KIRUNAGATAN, VIVEKA_TROLLES_GRAND, MELONGATAN];
const mid = (d: RoadDeck): V2 => {
  const [[x0, z0], [x1, z1]] = d.line, f = (d.from + d.to) / 2 / Math.hypot(x1 - x0, z1 - z0);
  return [x0 + (x1 - x0) * f, z0 + (z1 - z0) * f];
};
export const HASSELBY_ROADS = ROADS.map((d, k) => ({
  name: ['Kirunagatan bridge', 'Viveka Trolles gränd bridge', 'Melongatan bridge'][k],
  anchor: mid(d), build: (B: Builder, ground: Ground) => buildRoadDeck(B, ground, d),
}));

