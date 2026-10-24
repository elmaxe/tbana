import * as T from '../textures';
import type { Builder, V2, V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';
import { Line, loft, post, railBar, table } from './ropsten.ts';
import { rod } from './gamla-stan.ts';
import { block, Frame, pipeRailing, sign, UP, v3, type Ground } from './gubbangen.ts';
import { abutment, ASPHALT, band, barRailing, BOARDS, chainFence, CONCRETE, type Edge, FLOOR, KERB, line, off, RAILING, railAt, type Rows, slabDeck, steps, track, UNDER } from './farsta-line-north.ts';

// What the green line looks out on from Gullmarsplan to Hagsätra, beyond what the city draws there
// itself (its blocks with facades, the streets and the trees: see the areas in src/detail/areas.ts),
// the metro's bridges between them, from north to south:
//
// - Sockenplan's viaduct north of the platform, 127 m over the car park, Sockenplan, the paths
//   beside it and Sockenvägen: one concrete deck for both tracks, its soffit curving up to thin edge
//   beams, that parts into one for each track 30 m before the station; on crossbeams carried by rows
//   of slender round steel columns, and in Sockenvägen's median by a board-cast pier under each
//   track; galvanised railings of two rails on posts, mesh screens over Sockenvägen, and on both
//   faces over its lanes the height clear, "3,8 m" (east) and "4,0 m" (west), over a yellow and
//   blue band.
// - Svedmyra's viaduct north of its platform, a deck for each track side by side.
// - Skönviksvägen's bridge in the woods between Svedmyra and Stureby, and Bandhagsvägen's west of
//   Stureby: one broad deck on a row of dull red columns between the road's carriageways.
// - The two bridges side by side over Örbyleden north of Bandhagen, decks on flat concrete arches.
// - The short slab over the cycleway through the park south of Högdalen, and the depot tracks' long
//   skew slab over the trough that takes the main line's southbound track under them.
// - The slab bridges over Magelungsvägen and over the Nynäs railway, each beside Rågsvedsvägen's.
// - Bjursätragatan's three spans east of Rågsved, Rågsvedsvägen's flat arch west of it, and the
//   viaduct over Olshammarsgatan into Hagsätra.
//
// The bridges' plans, heights, edges and the ground under them from Lantmäteriet's laser scan
// (Laserdata Nedladdning, skog, 2021, CC BY 4.0), the streets they cross from OpenStreetMap, their
// looks from photographs on Mapillary (2014–2026) and Google's 3D mesh; their decks follow the
// tracks (public/data/track-geometry.json). The network draws the tracks on them and leaves their
// girders, piers and railings to this (src/detail/viaducts.ts).

addMaterial('hl-sign38', () => standard(T.heightLimitSign('3,8 m'), 0.5, 0, { alphaTest: 0.5 }));
addMaterial('hl-sign40', () => standard(T.heightLimitSign('4,0 m'), 0.5, 0, { alphaTest: 0.5 }));
// the warning band over a road under a bridge, yellow and blue stripes about 0.45 m wide
addMaterial('hl-band', () => standard(T.colourStripe(Array.from({ length: 12 }, (_, k) => (k % 2 ? '#1d4f9c' : '#e3b52a'))), 0.6));

// ------------------------------------------------------------------ concrete decks
// A concrete deck's section, in metres from the rails' top: its edge beams `edge` wide from
// `fascia` to the kerb, its soffit curving down from them to `soffit` over `curve` from each edge.
interface Section { edge: number; fascia: number; soffit: number; curve: number }

// A deck between lo and hi along a frame, of the section `d`. Returns its soffit's height at (s, u).
function curvedDeck(B: Builder, F: Frame, rows: Rows, ss: number[], lo: Edge, hi: Edge, d: Section) {
  const rail = (s: number, u: number) => railAt(rows, s, u);
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  const soffit = (s: number, u: number) => {
    const w = Math.min(u - lo(s), hi(s) - u), f = Math.max(0, Math.min(1, (w - d.edge) / (d.curve - d.edge)));
    return rail(s, u) + d.fascia + 0.1 + (d.soffit - d.fascia - 0.1) * (1 - (1 - f) ** 2);
  };
  const cuts = [d.edge, d.edge + 0.5, d.edge + (d.curve - d.edge) * 0.55, d.curve];
  B.tint(UNDER);
  for (let i = 0; i + 1 < cuts.length; i++) {
    band(B, F, ss, off(lo, cuts[i]), off(lo, cuts[i + 1]), soffit, at(FLOOR), 'fl-under', 3);
    band(B, F, ss, off(hi, -cuts[i + 1]), off(hi, -cuts[i]), soffit, at(FLOOR), 'fl-under', 3);
  }
  band(B, F, ss, off(lo, d.curve), off(hi, -d.curve), at(d.soffit), at(FLOOR), 'fl-under', 3);
  B.tint(CONCRETE);
  band(B, F, ss, lo, off(lo, d.edge), at(d.fascia), at(KERB), 'concrete', 3);
  band(B, F, ss, off(hi, -d.edge), hi, at(d.fascia), at(KERB), 'concrete', 3);
  return soffit;
}

// A crossbeam under a deck at s, `w` wide along it and `depth` under its soffit, between lo and hi
// a metre in from the edges; returns its underside at u.
function crossbeam(B: Builder, F: Frame, rows: Rows, s: number, w: number, lo: Edge, hi: Edge, d: Section, depth: number) {
  const y = (s: number, u: number) => railAt(rows, s, u) + d.soffit - depth;
  B.tint(UNDER);
  band(B, F, [s - w / 2, s + w / 2], off(lo, 1), off(hi, -1), y, (s, u) => railAt(rows, s, u) + FLOOR - 0.05, 'fl-under', 3);
  return (u: number) => y(s, u);
}

// A slender round steel column from the ground to y, with a cap plate under what it carries.
function column(B: Builder, c: V2, ground: number, y: number, r = 0.2, paint = 0xd0d3d3) {
  B.tint(paint);
  B.lathe(c[0], c[1], [[r, ground - 0.3], [r, y - 0.07], [r + 0.13, y - 0.07], [r + 0.13, y + 0.02]], 'metal', 12, 1);
}

// The bank under the network's floor where OpenStreetMap's bridge runs on past the real one's end
// (the network leaves its girder there to the landmark as well): from s0(u) to s1(u), its top just
// under the floor between lo and hi, and its sides, where `sides` has them, falling at 1 in 1.5 to
// a little under the city's ground a metre beyond.
const TURF = 0x6a7a4b;
export function bank(B: Builder, F: Frame, rows: Rows, ground: Ground, s0: (u: number) => number, s1: (u: number) => number, lo: Edge, hi: Edge,
  sides: [boolean, boolean] = [true, true]) {
  const n = Math.max(1, Math.round(Math.abs(s1(0) - s0(0)) / 2)), sections: V3[][] = [];
  for (let i = 0; i <= n; i++) {
    const at = (u: number) => s0(u) + ((s1(u) - s0(u)) * i) / n, ul = lo(at(0)), uh = hi(at(0));
    const top = (u: number) => railAt(rows, at(u), u) + FLOOR - 0.03;
    const foot = (u: number, out: number) => { const p = F.at(at(u), u + out); return Math.min(ground(p[0], p[1]) ?? top(u) - 2, top(u)) - 0.3; };
    const pt = (u: number, y: number) => v3(F.at(at(u), u), y);
    const row = [pt(ul, top(ul)), pt(uh, top(uh))];
    if (sides[0]) { const w = 1.5 * Math.max(0.3, top(ul) - foot(ul, -1)); row.unshift(pt(ul - w, foot(ul, -1))); }
    if (sides[1]) { const w = 1.5 * Math.max(0.3, top(uh) - foot(uh, 1)); row.push(pt(uh + w, foot(uh, 1))); }
    sections.push(row);
  }
  B.tint(TURF);
  loft(B, sections, 'gt-turf', () => UP, 8);
}

// ------------------------------------------------------------------ Sockenplan's viaduct
// s metres from the viaduct's northern end (where it leaves the bank) southwards to the platform
// (south-south-west), u to the right (west-north-west). The eastern track is the first. The station's
// style (src/open-styles.ts) draws the ticket hall and the square under its last 18 m, from
// SP_ENDS[1], and the network the deck over them.
export const SOCKENPLAN = new Frame([721.44, 5260.03], [-0.4566, 0.8897]);
const SP = SOCKENPLAN;
const SP_TRACKS: Rows = [
  [-4, -0.2, 22.647, 3.05, 22.597], [0, 0, 22.7, 3.21, 22.657], [4, 0.2, 22.763, 3.37, 22.716], [8, 0.4, 22.826, 3.53, 22.774],
  [12, 0.59, 22.889, 3.68, 22.83], [16, 0.78, 22.952, 3.85, 22.884], [20, 0.96, 23.014, 4.01, 22.939], [24, 1.13, 23.073, 4.18, 22.997],
  [28, 1.3, 23.132, 4.34, 23.055], [32, 1.44, 23.187, 4.52, 23.114], [36, 1.58, 23.242, 4.69, 23.172], [40, 1.7, 23.294, 4.87, 23.23],
  [44, 1.81, 23.345, 5.06, 23.288], [48, 1.91, 23.394, 5.24, 23.347], [52, 1.96, 23.431, 5.44, 23.389], [56, 2.02, 23.469, 5.63, 23.431],
  [60, 2.04, 23.504, 5.83, 23.455], [64, 2.04, 23.538, 6.04, 23.463], [68, 2.03, 23.564, 6.24, 23.471], [72, 1.99, 23.577, 6.45, 23.48],
  [76, 1.95, 23.589, 6.65, 23.488], [80, 1.87, 23.594, 6.87, 23.493], [84, 1.8, 23.598, 7.09, 23.497], [88, 1.7, 23.6, 7.31, 23.503],
  [92, 1.6, 23.6, 7.53, 23.511], [96, 1.49, 23.6, 7.75, 23.52], [100, 1.37, 23.6, 7.96, 23.528], [104, 1.25, 23.6, 8.17, 23.536],
  [108, 1.13, 23.603, 8.38, 23.542], [112, 1, 23.608, 8.59, 23.546], [116, 0.88, 23.61, 8.8, 23.551], [120, 0.76, 23.61, 9, 23.56],
  [124, 0.64, 23.61, 9.19, 23.568], [128, 0.54, 23.614, 9.37, 23.573],
];
// its ends (where it leaves the bank, and the station's hall), the abutment's face, and where the
// deck parts into two
const SP_ENDS: V2 = [-2, 125.5], SP_FACE = 3, SP_SPLIT = 94;
// the edges (the scan's): the outer ones, and the inner ones of the two decks south of the split
const spLo = table([[-2, -2.8], [8, -2.8], [14, -2.3], [26, -2.2], [32, -2.0], [125.5, -2.0]]);
const spHi = table([[-2, 6.3], [8, 6.8], [16, 7.2], [24, 7.7], [36, 8.1], [48, 8.7], [60, 9.1], [72, 9.7], [84, 10.1], [96, 10.6], [108, 11.3], [125.5, 11.9]]);
const spInE = table([[94, 4.0], [112, 4.0], [125.5, 3.8]]), spInW = table([[94, 4.9], [104, 5.1], [112, 5.5], [125.5, 6.1]]);
const SP_DECKS: { from: number; to: number; lo: Edge; hi: Edge }[] = [
  { from: SP_ENDS[0], to: SP_SPLIT, lo: spLo, hi: spHi },
  { from: SP_SPLIT, to: SP_ENDS[1], lo: spLo, hi: spInE },
  { from: SP_SPLIT, to: SP_ENDS[1], lo: spInW, hi: spHi },
];
const SP_SECTION: Section = { edge: 0.45, fascia: -0.95, soffit: -1.6, curve: 2.5 };
// The supports, between the streets and paths under it (OpenStreetMap's): rows of round columns
// in the car park, between Sockenplan and the paths beside it, south of Sockenvägen, and either
// side of the service road's loop; in Sockenvägen's median a board-cast pier under each track. The
// photographs show the columns' rows north of the paths and south of Sockenvägen and the piers in
// the median; where along the gaps each row stands is a guess.
const SP_COLUMNS = [20, 39, 54.2, 86.5, 100.5, 117.5], SP_PIERS = 72.2;
// Sockenvägen's two lanes, westbound (under the eastern face) and eastbound (under the western)
const SP_LANES: V2 = [67.6, 76.6], SP_SCREENS: V2 = [63.5, 81];

export function buildSockenplan(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (s: number, u: number) => railAt(SP_TRACKS, s, u);
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  const marks = [SP_FACE, ...SP_COLUMNS, SP_PIERS - 0.8, SP_PIERS + 0.8, ...SP_COLUMNS.map((s) => s - 0.5), ...SP_COLUMNS.map((s) => s + 0.5)];
  for (const d of SP_DECKS) curvedDeck(B, SP, SP_TRACKS, steps(d.from, d.to, marks), d.lo, d.hi, SP_SECTION);
  const deckAt = (s: number) => SP_DECKS.filter((d, i) => (i === 0) === (s < SP_SPLIT));
  const g = (c: V2, s: number, u: number) => ground(c[0], c[1]) ?? rail(s, u) - 5.4;

  // the rows of columns, two under each deck south of the split and three under the one north of it
  for (const s of SP_COLUMNS) {
    for (const d of deckAt(s)) {
      const under = crossbeam(B, SP, SP_TRACKS, s, 1.0, d.lo, d.hi, SP_SECTION, 0.45);
      const n = d === SP_DECKS[0] ? 3 : 2, u0 = d.lo(s) + 1.5, u1 = d.hi(s) - 1.5;
      for (let k = 0; k < n; k++) {
        const u = u0 + ((u1 - u0) * k) / (n - 1), c = SP.at(s, u);
        column(B, c, g(c, s, u), under(u));
      }
    }
  }
  // the median's piers, on a deeper crossbeam
  const under = crossbeam(B, SP, SP_TRACKS, SP_PIERS, 1.6, spLo, spHi, SP_SECTION, 0.6);
  B.tint(BOARDS);
  for (const k of [0, 1]) {
    const u = track(SP_TRACKS, SP_PIERS, k)[0], c = SP.at(SP_PIERS, u);
    post(B, c, SP.t, 1.3, 2.2, g(c, SP_PIERS, u) - 0.3, under(u) + 0.02, 'gt-boards', 2.4);
  }
  // the abutment at the bank's end, up into the deck
  B.tint(BOARDS);
  const plan: V2[] = [[SP_ENDS[0], spLo(SP_ENDS[0]) - 0.3], [SP_FACE, spLo(SP_FACE) - 0.3], [SP_FACE, spHi(SP_FACE) + 0.3], [SP_ENDS[0], spHi(SP_ENDS[0]) + 0.3]];
  const foot = Math.min(...plan.map(([s, u]) => g(SP.at(s, u), s, u))) - 0.6;
  band(B, SP, [SP_ENDS[0], SP_FACE], off(spLo, -0.3), off(spHi, 0.3), () => foot, at(SP_SECTION.fascia + 0.1), 'gt-boards', 2.4);

  // lamps under the soffit, along its middle
  B.tint(0xe4e3dc);
  for (let s = 8; s < SP_ENDS[1]; s += 12) {
    for (const d of deckAt(s)) {
      const u = (d.lo(s) + d.hi(s)) / 2, c = SP.at(s, u), y = rail(s, u) + SP_SECTION.soffit;
      B.box([c[0] - 0.3, y - 0.1, c[1] - 0.3], [c[0] + 0.3, y + 0.02, c[1] + 0.3], 'metal', 1);
    }
  }

  // the railings: the outer ones the whole length, the inner ones where the decks have drawn apart
  B.tint(RAILING);
  for (const e of [off(spLo, 0.2), off(spHi, -0.2)]) pipeRailing(B, line(SP, steps(SP_ENDS[0], SP_ENDS[1]), e, at(KERB)), 1.1, 2.4);
  for (const e of [off(spInE, -0.2), off(spInW, 0.2)]) pipeRailing(B, line(SP, steps(100, SP_ENDS[1]), e, at(KERB)), 1.1, 2.4);
  // the mesh screens over Sockenvägen, on the railings' line
  for (const e of [off(spLo, 0.25), off(spHi, -0.25)]) chainFence(B, line(SP, steps(SP_SCREENS[0], SP_SCREENS[1], [], 2.5), e, at(KERB)), 1.8);

  // over each of Sockenvägen's lanes, on the face its traffic comes to: the band along the edge
  // beam's foot and the height clear over it
  const r = SP.right;
  for (const [s, e, n, mat] of [[SP_LANES[0], spLo, -1, 'hl-sign38'], [SP_LANES[1], spHi, 1, 'hl-sign40']] as const) {
    const y = (u: number) => rail(s, u) + SP_SECTION.fascia;
    const face = (q: number): V2 => SP.at(q, e(q) + n * 0.02);
    const [a, b] = n < 0 ? [s + 3, s - 3] : [s - 3, s + 3];
    const pa = face(a), pb = face(b), ya = y(e(a)), yb = y(e(b));
    B.tint(0xffffff);
    B.poly([v3(pa, ya + 0.08), v3(pb, yb + 0.08), v3(pb, yb + 0.4), v3(pa, ya + 0.4)], [r[0] * n, 0, r[2] * n], 'hl-band', 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    sign(B, v3(SP.at(s, e(s)), rail(s, e(s)) + (SP_SECTION.fascia + KERB) / 2 + 0.15), [r[0] * n, 0, r[2] * n], 0.75, mat);
  }
}

// ------------------------------------------------------------------ Svedmyra's viaduct
// s metres from the viaduct's northern end southwards (south-south-west) to the platform's north
// end, u to the right (west-north-west). The eastern track is the first. Two decks, one for each
// track, side by side with a joint between them that widens as the tracks part for the island
// platform; from the platform's north end on (SV_ENDS[1]) the network draws the decks under the
// platform, and the station's style (src/open-styles.ts) its screens and the ticket hall under them.
export const SVEDMYRA = new Frame([546.17, 5902.98], [-0.4684, 0.8835]);
const SV = SVEDMYRA;
const SV_TRACKS: Rows = [
  [-8, 0.77, 26.254, 7.85, 26.294], [-4, 0.38, 26.332, 7.49, 26.373], [0, 0, 26.41, 7.14, 26.451], [4, -0.28, 26.478, 6.89, 26.52],
  [8, -0.56, 26.546, 6.65, 26.587], [12, -0.76, 26.611, 6.5, 26.654], [16, -0.95, 26.675, 6.38, 26.722], [20, -1.09, 26.738, 6.32, 26.787],
  [24, -1.2, 26.802, 6.32, 26.849], [28, -1.27, 26.858, 6.35, 26.91], [32, -1.3, 26.903, 6.48, 26.959], [36, -1.32, 26.95, 6.61, 27.008],
  [40, -1.28, 26.999, 6.86, 27.058], [44, -1.24, 27.049, 7.1, 27.107], [48, -1.13, 27.09, 7.45, 27.146], [52, -1.01, 27.131, 7.82, 27.183],
  [56, -0.84, 27.165, 8.26, 27.214], [60, -0.66, 27.197, 8.75, 27.241], [64, -0.43, 27.228, 9.28, 27.268], [68, -0.17, 27.26, 9.88, 27.295],
  [72, 0.13, 27.283, 10.49, 27.32], [76, 0.48, 27.291, 11.21, 27.324],
];
// its ends (the abutment at the bank, the platform's north end) and the abutment's face
const SV_ENDS: V2 = [-6, 73], SV_FACE = 0;
// the decks' edges (the scan's): the outer ones and those either side of the joint. The network's
// tracks run about a metre east of the real ones here (see the station's style), so the eastern
// deck's edge is further from its track than the western's.
const svLo = table([[-6, -4.8], [8, -5.3], [28, -5.3], [36, -4.9], [56, -4.6], [62, -3.8], [66, -3.0], [73, -2.2]]);
const svHi = table([[-6, 9.6], [4, 9.8], [20, 9.3], [28, 9.0], [36, 9.4], [44, 9.9], [52, 10.8], [60, 11.4], [64, 12.3], [68, 12.9], [73, 14.0]]);
const svInE = table([[-6, 1.8], [40, 1.6], [44, 2.0], [52, 2.5], [60, 3.0], [64, 3.5], [68, 4.0]]);
const svInW = table([[-6, 2.3], [20, 2.4], [36, 2.8], [44, 3.0], [48, 3.5], [52, 4.0], [60, 4.5], [64, 5.0], [68, 6.0], [73, 7.2]]);
const SV_DECKS = [{ lo: svLo, hi: svInE }, { lo: svInW, hi: svHi }];
const SV_SECTION: Section = { edge: 0.4, fascia: -0.95, soffit: -1.45, curve: 1.6 };
// The supports, one under each deck, between the streets and paths under it (OpenStreetMap's): rows
// of round columns north of Tussmötevägen, and board-cast square piers south of it (the
// photographs); where along the gaps each row stands is a guess.
const SV_COLUMNS = [10, 26, 37.5], SV_PIERS = 61.5;

export function buildSvedmyra(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (s: number, u: number) => railAt(SV_TRACKS, s, u);
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  const g = (c: V2, s: number, u: number) => ground(c[0], c[1]) ?? rail(s, u) - 5;
  const ss = steps(SV_ENDS[0], SV_ENDS[1], [SV_FACE, ...SV_COLUMNS, SV_PIERS]);
  for (const d of SV_DECKS) curvedDeck(B, SV, SV_TRACKS, ss, d.lo, d.hi, SV_SECTION);
  for (const d of SV_DECKS) {
    for (const s of SV_COLUMNS) {
      const u = (d.lo(s) + d.hi(s)) / 2, c = SV.at(s, u);
      column(B, c, g(c, s, u), rail(s, u) + SV_SECTION.soffit, 0.25);
    }
    const u = (d.lo(SV_PIERS) + d.hi(SV_PIERS)) / 2, c = SV.at(SV_PIERS, u);
    B.tint(BOARDS);
    post(B, c, SV.t, 1.3, 1.3, g(c, SV_PIERS, u) - 0.3, rail(SV_PIERS, u) + SV_SECTION.soffit + 0.02, 'gt-boards', 2.4);
  }
  // the abutment at the bank's end, up into the decks
  B.tint(BOARDS);
  const plan: V2[] = [[SV_ENDS[0], svLo(SV_ENDS[0]) - 0.3], [SV_FACE, svLo(SV_FACE) - 0.3], [SV_FACE, svHi(SV_FACE) + 0.3], [SV_ENDS[0], svHi(SV_ENDS[0]) + 0.3]];
  const foot = Math.min(...plan.map(([s, u]) => g(SV.at(s, u), s, u))) - 0.6;
  band(B, SV, [SV_ENDS[0], SV_FACE], off(svLo, -0.3), off(svHi, 0.3), () => foot, at(SV_SECTION.fascia + 0.1), 'gt-boards', 2.4);
  // the railings along the outer edges, as far as the platform's screens
  B.tint(RAILING);
  for (const e of [off(svLo, 0.2), off(svHi, -0.2)]) pipeRailing(B, line(SV, steps(SV_ENDS[0], SV_ENDS[1]), e, at(KERB)), 1.1, 2.4);
}

// ------------------------------------------------------------------ Skönviksvägen's bridge
// Between Svedmyra and Stureby, over Skönviksvägen in the woods: s metres westwards (west-south-west)
// from the bridge's eastern end, u to the right (north-north-west). The southern track is the first.
// One deck at the eastern end, then one for each track; the laser scan has nothing standing under
// them between the abutment wall at the eastern end and the bank's slope 27 m on, so they span it
// in one, deeper than Svedmyra's. No photographs of it were found; the woods hide it from the air.
export const SKONVIKSVAGEN = new Frame([-3.92, 6297.74], [-0.9386, 0.3451]);
const SK = SKONVIKSVAGEN;
const SK_TRACKS: Rows = [
  [-8, 0.26, 35.499, 6.82, 35.509], [-4, 0.13, 35.52, 6.87, 35.525], [0, 0, 35.54, 6.96, 35.536], [4, -0.07, 35.549, 7.07, 35.544],
  [8, -0.14, 35.557, 7.19, 35.553], [12, -0.16, 35.566, 7.36, 35.565], [16, -0.16, 35.575, 7.53, 35.577], [20, -0.13, 35.583, 7.75, 35.586],
  [24, -0.06, 35.592, 7.98, 35.594], [28, 0.01, 35.6, 8.23, 35.601], [32, 0.15, 35.604, 8.52, 35.605], [36, 0.29, 35.608, 8.82, 35.609],
];
// its ends, the eastern abutment's face and the western one's (at the foot of the bank's slope),
// and where the deck parts in two
const SK_ENDS: V2 = [-4, 34], SK_FACES: V2 = [-0.5, 27], SK_SPLIT = 5;
const skLo = table([[-4, -3.0], [34, -3.0]]), skHi = table([[-4, 9.4], [4, 9.6], [12, 10.0], [22, 10.0], [26, 10.7], [30, 11.2], [34, 11.3]]);
const skInE = table([[5, 1.8], [12, 2.3], [34, 2.2]]), skInW = table([[5, 4.8], [14, 5.3], [20, 5.8], [28, 6.0], [34, 6.5]]);
const SK_DECKS: { from: number; to: number; lo: Edge; hi: Edge }[] = [
  { from: SK_ENDS[0], to: SK_SPLIT, lo: skLo, hi: skHi },
  { from: SK_SPLIT, to: SK_ENDS[1], lo: skLo, hi: skInE },
  { from: SK_SPLIT, to: SK_ENDS[1], lo: skInW, hi: skHi },
];
const SK_SECTION: Section = { edge: 0.4, fascia: -1.15, soffit: -1.75, curve: 1.6 };

export function buildSkonviksvagen(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (s: number, u: number) => railAt(SK_TRACKS, s, u);
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  for (const d of SK_DECKS) curvedDeck(B, SK, SK_TRACKS, steps(d.from, d.to, [...SK_FACES]), d.lo, d.hi, SK_SECTION);
  // the abutments, up into the decks
  B.tint(BOARDS);
  for (const [a, b] of [[SK_ENDS[0], SK_FACES[0]], [SK_FACES[1], SK_ENDS[1]]]) {
    const ends = [a, b], plan: V2[] = [[a, skLo(a) - 0.3], [b, skLo(b) - 0.3], [b, skHi(b) + 0.3], [a, skHi(a) + 0.3]];
    const foot = Math.min(...plan.map(([s, u]) => ground(...SK.at(s, u)) ?? rail(s, u) - 5)) - 0.6;
    band(B, SK, ends, off(skLo, -0.3), off(skHi, 0.3), () => foot, at(SK_SECTION.fascia + 0.1), 'gt-boards', 2.4);
  }
  B.tint(RAILING);
  for (const e of [off(skLo, 0.2), off(skHi, -0.2)]) pipeRailing(B, line(SK, steps(SK_ENDS[0], SK_ENDS[1]), e, at(KERB)), 1.1, 2.4);
}

// ------------------------------------------------------------------ Bandhagsvägen's bridge
// West of Stureby, over Bandhagsvägen: s metres eastwards (east-south-east) from the bridge's
// western abutment, u to the right (south-south-west). The southern track is the first; the
// northern runs 9.5 m from it, and the long crossover between them on the deck. One broad concrete
// deck for all three, on an abutment wall at its western end and a row of round steel columns,
// painted dull red, in the island between Bandhagsvägen's two carriageways (the photographs), and
// another east of the road where the bank's slope begins (a guess), with the height clear, "4,0 m",
// over the road on both faces (the southern one in the photographs).
export const BANDHAGSVAGEN = new Frame([-320.57, 6383.22], [0.9025, -0.4306]);
const BV = BANDHAGSVAGEN;
const BV_TRACKS: Rows = [
  [-8, 0.56, 35.277, -8.55, 35.381], [-4, 0.28, 35.293, -8.96, 35.395], [0, 0, 35.31, -9.3, 35.41], [4, -0.16, 35.324, -9.59, 35.424],
  [8, -0.31, 35.338, -9.8, 35.435], [12, -0.37, 35.357, -9.96, 35.445], [16, -0.42, 35.376, -10.06, 35.457], [20, -0.39, 35.387, -10.08, 35.471],
  [24, -0.33, 35.397, -10.05, 35.484], [28, -0.22, 35.409, -9.95, 35.493], [32, -0.07, 35.423, -9.81, 35.503], [36, 0.14, 35.437, -9.57, 35.512],
  [40, 0.4, 35.449, -9.31, 35.521], [44, 0.67, 35.461, -8.95, 35.525], [48, 1.05, 35.473, -8.58, 35.529],
];
const BV_ENDS: V2 = [-6, 44], BV_FACES: V2 = [-0.5, 41], BV_COLUMNS = [13.4, 28.5];
// Bandhagsvägen's two carriageways, under the northern face and the southern
const BV_LANES: V2 = [9.0, 17.8];
const bvLo = table([[-6, -12.3], [8, -12.5], [24, -12.8], [34, -12.2], [40, -11.5], [44, -11.2]]);
const bvHi = table([[-6, 3.0], [0, 3.2], [2, 2.5], [30, 2.4], [36, 3.0], [44, 3.1]]);
const BV_SECTION: Section = { edge: 0.4, fascia: -1.0, soffit: -1.45, curve: 1.4 };

export function buildBandhagsvagen(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (s: number, u: number) => railAt(BV_TRACKS, s, u);
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  curvedDeck(B, BV, BV_TRACKS, steps(BV_ENDS[0], BV_ENDS[1], [...BV_FACES, ...BV_COLUMNS]), bvLo, bvHi, BV_SECTION);
  for (const s of BV_COLUMNS) {
    const under = crossbeam(B, BV, BV_TRACKS, s, 0.9, bvLo, bvHi, BV_SECTION, 0.4);
    for (let k = 0; k < 3; k++) {
      const u = bvLo(s) + 2 + ((bvHi(s) - bvLo(s) - 4) * k) / 2, c = BV.at(s, u);
      column(B, c, ground(c[0], c[1]) ?? rail(s, u) - 5.5, under(u), 0.22, 0x8a5f52);
    }
  }
  B.tint(BOARDS);
  for (const [a, b] of [[BV_ENDS[0], BV_FACES[0]], [BV_FACES[1], BV_ENDS[1]]]) {
    const plan: V2[] = [[a, bvLo(a) - 0.3], [b, bvLo(b) - 0.3], [b, bvHi(b) + 0.3], [a, bvHi(a) + 0.3]];
    const foot = Math.min(...plan.map(([s, u]) => ground(...BV.at(s, u)) ?? rail(s, u) - 5.5)) - 0.6;
    band(B, BV, [a, b], off(bvLo, -0.3), off(bvHi, 0.3), () => foot, at(BV_SECTION.fascia + 0.1), 'gt-boards', 2.4);
  }
  B.tint(RAILING);
  for (const e of [off(bvLo, 0.2), off(bvHi, -0.2)]) pipeRailing(B, line(BV, steps(BV_ENDS[0], BV_ENDS[1]), e, at(KERB)), 1.1, 2.4);
  const r = BV.right;
  for (const [s, e, n] of [[BV_LANES[0], bvLo, -1], [BV_LANES[1], bvHi, 1]] as const) {
    sign(B, v3(BV.at(s, e(s)), rail(s, e(s)) + (BV_SECTION.fascia + KERB) / 2), [r[0] * n, 0, r[2] * n], 0.75, 'hl-sign40');
  }
}

// ------------------------------------------------------------------ Örbyleden's arches
// North of Bandhagen, over Örbyleden in its cutting: s metres northwards (north-north-east) from
// the platform's north end, u to the right (east-south-east). The eastern track is the first. Two
// bridges side by side, one for each track and 2.5 m apart, the eastern one carrying the cycleway
// along its eastern edge, fenced off from the track. Each is a deck on a flat concrete arch over
// both carriageways that springs from the tops of the paved slopes at either side, askew as the
// road crosses, and rises into the deck over its middle third; between the two, rectangular
// columns stand on the arch, and beyond its springings on the ledges where the paths cross under
// the decks' ends (the photographs and the laser scan).
export const ORBYLEDEN = new Frame([-495.23, 6678.61], [0.2394, -0.9709]);
const OB = ORBYLEDEN;
const OB_TRACKS: Rows = [
  [-8, -0.1, 35.56, -10.44, 35.53], [-4, -0.05, 35.56, -10.29, 35.53], [0, 0, 35.56, -10.13, 35.53], [4, 0.03, 35.533, -9.98, 35.526],
  [8, 0.06, 35.506, -9.82, 35.522], [12, 0.07, 35.479, -9.65, 35.507], [16, 0.07, 35.452, -9.49, 35.477], [20, 0.06, 35.426, -9.32, 35.447],
  [24, 0.04, 35.399, -9.15, 35.417], [28, 0.02, 35.372, -8.98, 35.387], [32, -0.01, 35.345, -8.81, 35.36], [36, -0.03, 35.318, -8.63, 35.335],
  [40, -0.06, 35.291, -8.46, 35.307], [44, -0.09, 35.264, -8.29, 35.277], [48, -0.11, 35.237, -8.11, 35.247], [52, -0.14, 35.211, -7.94, 35.217],
  [56, -0.16, 35.184, -7.76, 35.187], [60, -0.16, 35.157, -7.58, 35.157], [64, -0.16, 35.13, -7.41, 35.127], [68, -0.15, 35.103, -7.23, 35.099],
  [72, -0.13, 35.076, -7.05, 35.073], [76, -0.07, 35.049, -6.86, 35.047], [80, -0.01, 35.022, -6.67, 35.016], [84, 0.11, 34.992, -6.47, 34.986],
  [88, 0.22, 34.962, -6.26, 34.957],
];
// the decks' ends and the abutments' faces at the tops of the banks
const OB_ENDS: V2 = [3, 81], OB_FACES: V2 = [6, 78];
// the decks' edges (the scan's): the eastern one's, the cycleway's fence on it, and the western's
// either side of its track
const obWest = (d: number): Edge => (s) => track(OB_TRACKS, s, 1)[0] + d;
const OB_DECKS = [{ lo: (() => -3.0) as Edge, hi: (() => 5.0) as Edge }, { lo: obWest(-2.5), hi: obWest(2.8) }];
const OB_FENCE = 2.6;
const OB_SECTION: Section = { edge: 0.4, fascia: -1.0, soffit: -1.45, curve: 1.2 };
// The arches: where they spring along the tops of the paved slopes (at u, southern and northern),
// as askew as the road; the springings' heights, and the arches' thickness at the crown and the
// springings. Their crowns are under the decks' soffits.
const obSpring = (u: number): V2 => [18.5 - 0.45 * (u - 5.5), 60.5 - 0.45 * (u - 5.5)];
const OB_SPRING_Y: V2 = [30.0, 30.6], OB_THICK: V2 = [0.8, 1.4];
// the columns: on the arches this far in from their springings, and on the ledges beyond them
// (south of the path under the southern end, and north of the northern springing under the eastern
// deck; the western one's reaches nearly to the path under its northern end)
const OB_ON_ARCH = [2.5, 6.5, 10.5], OB_LEDGE: V2 = [11, 69];
// the cycleway's ends, on at grade past the deck's (OpenStreetMap's)
const OB_CYCLE: V2 = [-4, 82];

// An arch under a deck from u = lo to hi, springing along `spring` at heights `ys`, `th` thick at
// its crown and its springings, its crown at the deck's soffit over its faces (the edge beams'
// foot); where it reaches the soffit it rises into the deck. Returns where it is along its span at
// (s, u) and its extrados there.
function arch(B: Builder, F: Frame, lo: number, hi: number, spring: (u: number) => V2, ys: V2, th: V2, soffit: (s: number, u: number) => number) {
  const tOf = (s: number, u: number) => { const [a, b] = spring(u); return (s - a) / (b - a); };
  const sOf = (t: number, u: number) => { const [a, b] = spring(u); return a + (b - a) * t; };
  const um = (lo + hi) / 2, rise = soffit(sOf(0.5, um), lo) - th[0] - (ys[0] + ys[1]) / 2;
  const intrados = (t: number) => ys[0] + (ys[1] - ys[0]) * t + rise * 4 * t * (1 - t);
  const extrados = (s: number, u: number) => {
    const t = tOf(s, u);
    return Math.min(intrados(t) + th[0] + (th[1] - th[0]) * (2 * t - 1) ** 2, soffit(s, u) + 0.02);
  };
  // from a little beyond each springing, into the slope's top, about every 1.5 m: its faces and
  // extrados cast against boards, its soffit lit as the decks' are
  const span = spring(um)[1] - spring(um)[0], n = Math.round(span / 1.5), ts = [-0.03, ...Array.from({ length: n + 1 }, (_, i) => i / n), 1.03];
  for (let i = 0; i + 1 < ts.length; i++) {
    const [a, b] = [ts[i], ts[i + 1]], plan: V2[] = [[sOf(a, lo), lo], [sOf(b, lo), lo], [sOf(b, hi), hi], [sOf(a, hi), hi]];
    B.tint(CONCRETE);
    block(B, F, plan, (s, u) => intrados(tOf(s, u)), extrados, 'concrete', 3, { faces: 'sides' });
    for (const [y, up, mat] of [[(s: number, u: number) => intrados(tOf(s, u)), false, 'fl-under'], [extrados, true, 'concrete']] as const) {
      const p = plan.map(([s, u]) => v3(F.at(s, u), y(s, u)));
      // (the normal across its diagonals)
      const d1 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]], d2 = [p[3][0] - p[1][0], p[3][1] - p[1][1], p[3][2] - p[1][2]];
      const nrm: V3 = [d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0]];
      if ((nrm[1] > 0) !== up) for (let k = 0; k < 3; k++) nrm[k] = -nrm[k];
      B.tint(up ? CONCRETE : UNDER);
      B.poly(p, nrm, mat, 3);
    }
  }
  return { tOf, sOf, extrados };
}

export function buildOrbyleden(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (s: number, u: number) => railAt(OB_TRACKS, s, u);
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  const g = (s: number, u: number) => ground(...OB.at(s, u)) ?? rail(s, u) - 5;
  const ss = steps(OB_ENDS[0], OB_ENDS[1], [...OB_FACES, ...OB_LEDGE]);
  for (const [k, d] of OB_DECKS.entries()) {
    const soffit = curvedDeck(B, OB, OB_TRACKS, ss, d.lo, d.hi, OB_SECTION);
    const lo = d.lo(42) + 0.3, hi = d.hi(42) - 0.3;
    const a = arch(B, OB, lo, hi, obSpring, OB_SPRING_Y, OB_THICK, soffit);
    // the footings behind the springings, a little over the ledges
    for (const [t, back] of [[-0.03, -1.2], [1.03, 1.2]]) {
      const plan: V2[] = [[a.sOf(t, lo - 0.2), lo - 0.2], [a.sOf(t, lo - 0.2) + back, lo - 0.2], [a.sOf(t, hi + 0.2) + back, hi + 0.2], [a.sOf(t, hi + 0.2), hi + 0.2]];
      const foot = Math.min(...plan.map(([s, u]) => g(s, u))) - 0.6, y = OB_SPRING_Y[t < 0 ? 0 : 1] + 0.3;
      block(B, OB, plan, () => foot, () => y, 'concrete', 3);
    }
    // the columns, two in each row
    for (const u of [d.lo(42) + 1.3, d.hi(42) - 1.3]) {
      const [s0, s1] = obSpring(u);
      for (const dd of OB_ON_ARCH) {
        for (const s of [s0 + dd, s1 - dd]) {
          const base = a.extrados(s, u), top = soffit(s, u);
          if (top - base > 0.45) post(B, OB.at(s, u), OB.t, 0.6, 0.8, base - 0.1, top + 0.02, 'concrete', 3);
        }
      }
      for (const s of OB_LEDGE) {
        if (s > 60 && k === 1) continue;
        post(B, OB.at(s, u), OB.t, 0.6, 0.8, g(s, u) - 0.3, soffit(s, u) + 0.02, 'concrete', 3);
      }
    }
    // the abutments at the banks' tops
    B.tint(CONCRETE);
    for (const [a0, b0] of [[OB_ENDS[0], OB_FACES[0]], [OB_FACES[1], OB_ENDS[1]]]) abutment(B, OB, OB_TRACKS, ground, a0, b0, d.lo, d.hi, OB_SECTION.fascia + 0.1, 'concrete');
  }

  // the cycleway at the rails' height on the eastern deck, on at grade past its ends, and the fence
  // between it and the track
  const east = OB_DECKS[0];
  B.tint(ASPHALT);
  band(B, OB, ss, () => OB_FENCE + 0.2, off(east.hi, -OB_SECTION.edge), at(FLOOR), at(0), 'rp-asphalt', 6);
  for (const [s0, s1] of [[OB_CYCLE[0], OB_ENDS[0]], [OB_ENDS[1], OB_CYCLE[1]]]) {
    band(B, OB, steps(s0, s1, [], 2), () => OB_FENCE + 0.2, off(east.hi, -OB_SECTION.edge), () => 0, (s, u) => g(s, u) + 0.04, 'rp-asphalt', 6, { faces: 'top' });
  }
  B.tint(CONCRETE);
  band(B, OB, ss, () => OB_FENCE, () => OB_FENCE + 0.2, at(FLOOR), at(0.15), 'concrete', 3);
  chainFence(B, line(OB, ss, () => OB_FENCE + 0.1, at(0.15)), 1.6);

  // the railings along all four edges
  B.tint(RAILING);
  for (const d of OB_DECKS) for (const e of [off(d.lo, 0.2), off(d.hi, -0.2)]) pipeRailing(B, line(OB, ss, e, at(KERB)), 1.1, 2.4);
}

// ------------------------------------------------------------------ Magelungsvägen's bridges
// Between Högdalen and Rågsved, over Magelungsvägen in its valley: s metres westwards
// (west-south-west) from the bridges' eastern end, u to the right (north-north-west). The southern
// track is the first. Two concrete slab bridges side by side, as askew as the road crosses: the
// metro's, and Rågsvedsvägen's north of it, which OpenStreetMap has as a bridge and the city leaves
// out of its streets. Each spans the valley in two: the slab deepens in a curve over a row of round
// columns in Magelungsvägen's median, and rests at either end on a short wall at the top of a paved
// slope that comes down to a low wall along the paths beside the road. The road's bridge carries a
// cycleway beside the tracks behind a railing of bars, two lanes, and a pavement along its northern
// edge behind another (the photographs, the laser scan and OpenStreetMap).
export const MAGELUNGSVAGEN = new Frame([-1206.63, 7965.11], [-0.8781, 0.4786]);
const MG = MAGELUNGSVAGEN;
const MG_TRACKS: Rows = [
  [-8, 0.2, 28.718, 5.77, 29.28], [-4, 0.1, 28.759, 5.49, 29.276], [0, 0, 28.8, 5.21, 29.272], [4, -0.05, 28.85, 4.97, 29.283],
  [8, -0.11, 28.899, 4.77, 29.31], [12, -0.14, 28.953, 4.59, 29.336], [16, -0.16, 29.007, 4.44, 29.359], [20, -0.16, 29.058, 4.3, 29.382],
  [24, -0.15, 29.108, 4.21, 29.409], [28, -0.13, 29.159, 4.12, 29.436], [32, -0.11, 29.214, 4.05, 29.459], [36, -0.08, 29.267, 3.99, 29.481],
  [40, -0.04, 29.317, 3.95, 29.507], [44, 0, 29.367, 3.92, 29.534], [48, 0.04, 29.449, 3.9, 29.582], [52, 0.08, 29.533, 3.89, 29.664],
  [56, 0.13, 29.618, 3.88, 29.745], [60, 0.17, 29.703, 3.89, 29.822], [64, 0.22, 29.787, 3.9, 29.899],
];
// at u, eastern and western: the decks' ends (the scan's), their walls' faces at the slopes' tops,
// and the slopes' toes along the paths, as far out as the scan's banks beside the bridges begin; the
// paths' height there, and the walls' height under the slabs
const mgEnd = (u: number): V2 => [4 + 0.48 * u, 52.3 + 0.33 * u];
const mgFace = (u: number): V2 => [10.3 + 0.55 * u, 42.8 + 0.46 * u];
const mgToe = (u: number): V2 => [13.8 + 0.55 * u, 39.3 + 0.46 * u];
const MG_PATHS = 22.4, MG_WALL = 1.8, MG_LOW_WALL = 1.2;
// the pier's line along Magelungsvägen's median, between its carriageways (OpenStreetMap's), its
// columns across both bridges, and how much deeper the slab is over it, and over how far either side
const mgPier = (u: number) => 27.2 + 0.53 * u;
const MG_COLUMNS = [-0.8, 3.6, 8.0, 12.4, 16.8, 21.0];
const MG_HAUNCH: V2 = [1.0, 10];
// across: the metro's deck; the road's, its edge beams, cycleway, lanes and pavement
const MG_METRO: V2 = [-2.8, 7.0];
const MG_ROAD = { lo: 7.0, cycle: 7.4, lanes: [9.8, 17.0] as V2, walk: 21.6, hi: 22.0 };
// the road's top, a plane (the scan's); its slab's depth under it at the ends; the metro's slab's
// under the rails, and its edge beams' foot
const mgRoad = (s: number, u: number) => 28.987 + 0.01 * s - 0.0323 * u;
const MG_ROAD_DEPTH = 1.05, MG_SOFFIT = -1.45, MG_FASCIA = -1.0;
const MG_BARS = 0x9d988e, MG_SLOPE = 0xa29f97, MG_ASPHALT = 0x6b6c6d;

// A strip of an askew bridge from u0 to u1 between its ends (s at u), in n pieces.
function skewStrip(B: Builder, F: Frame, ends: (u: number) => V2, n: number, u0: number, u1: number, bottom: (s: number, u: number) => number,
  top: (s: number, u: number) => number, mat: string, tile: number, opts: { faces?: 'all' | 'sides' | 'top' } = {}) {
  const sAt = (f: number, u: number) => { const [a, b] = ends(u); return a + (b - a) * f; };
  for (let i = 0; i < n; i++) {
    const [f0, f1] = [i / n, (i + 1) / n];
    block(B, F, [[sAt(f0, u0), u0], [sAt(f1, u0), u0], [sAt(f1, u1), u1], [sAt(f0, u1), u1]], bottom, top, mat, tile, opts);
  }
}
// (Magelungsvägen's, in pieces about 1.5 m long)
const mgStrip = (B: Builder, u0: number, u1: number, bottom: (s: number, u: number) => number, top: (s: number, u: number) => number, mat: string, tile: number) =>
  skewStrip(B, MG, mgEnd, 32, u0, u1, bottom, top, mat, tile);

export function buildMagelungsvagen(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (s: number, u: number) => railAt(MG_TRACKS, s, u);
  const haunch = (s: number, u: number) => MG_HAUNCH[0] * Math.max(0, 1 - Math.abs(s - mgPier(u)) / MG_HAUNCH[1]) ** 2;
  // each bridge's top (the metro's under the network's floor), its slab's underside and its edge beams' foot
  const decks = [
    { lo: MG_METRO[0], hi: MG_METRO[1], top: (s: number, u: number) => rail(s, u) + FLOOR, kerb: (s: number, u: number) => rail(s, u) + KERB,
      soffit: (s: number, u: number) => rail(s, u) + MG_SOFFIT - haunch(s, u), fascia: (s: number, u: number) => rail(s, u) + MG_FASCIA },
    { lo: MG_ROAD.lo, hi: MG_ROAD.hi, top: (s: number, u: number) => mgRoad(s, u) - 0.03, kerb: (s: number, u: number) => mgRoad(s, u) + 0.3,
      soffit: (s: number, u: number) => mgRoad(s, u) - MG_ROAD_DEPTH - haunch(s, u), fascia: (s: number, u: number) => mgRoad(s, u) - 0.6 },
  ];
  const g = (s: number, u: number) => ground(...MG.at(s, u)) ?? MG_PATHS;

  for (const d of decks) {
    // the slab, and the edge beams along its faces
    B.tint(UNDER);
    mgStrip(B, d.lo + 0.4, (d.lo + d.hi) / 2, d.soffit, d.top, 'fl-under', 3);
    mgStrip(B, (d.lo + d.hi) / 2, d.hi - 0.4, d.soffit, d.top, 'fl-under', 3);
    B.tint(CONCRETE);
    mgStrip(B, d.lo, d.lo + 0.4, d.fascia, d.kerb, 'concrete', 3);
    mgStrip(B, d.hi - 0.4, d.hi, d.fascia, d.kerb, 'concrete', 3);

    // at each end the wall under the slab, and the paved slope in front of it down to the low wall
    // along the path
    for (const k of [0, 1]) {
      const lo = d.lo, hi = d.hi, e = (u: number) => mgEnd(u)[k], f = (u: number) => mgFace(u)[k], t = (u: number) => mgToe(u)[k];
      const wall: V2[] = [[e(lo), lo], [f(lo), lo], [f(hi), hi], [e(hi), hi]];
      const slope: V2[] = [[f(lo), lo], [t(lo), lo], [t(hi), hi], [f(hi), hi]];
      const foot = Math.min(...[...wall, ...slope].map(([s, u]) => g(s, u)), MG_PATHS) - 0.6;
      const under = (s: number, u: number) => d.soffit(s, Math.min(Math.max(u, d.lo + 0.4), d.hi - 0.4));
      B.tint(CONCRETE);
      block(B, MG, wall, () => foot, (s, u) => under(s, u) - 0.01, 'concrete', 3);
      const faceY = (u: number) => under(f(u), u) - MG_WALL;
      B.tint(MG_SLOPE);
      block(B, MG, slope, () => foot, (s, u) => {
        const w = (s - t(u)) / (f(u) - t(u));
        return MG_PATHS + MG_LOW_WALL + (faceY(u) - MG_PATHS - MG_LOW_WALL) * w;
      }, 'concrete', 3);
    }
  }

  // the columns under the pier's line, round, cast in place
  B.tint(CONCRETE);
  for (const u of MG_COLUMNS) {
    const s = mgPier(u), c = MG.at(s, u), d = decks[u < MG_METRO[1] ? 0 : 1];
    B.lathe(c[0], c[1], [[0.4, g(s, u) - 0.3], [0.4, d.soffit(s, u) + 0.05]], 'concrete', 16, 3);
  }

  // the road: the cycleway and the pavement a kerb higher than the lanes, the lanes' centre line, and
  // on at grade past the eastern end, where the city's streets end short of it
  const R = MG_ROAD, road = (y: number) => (s: number, u: number) => mgRoad(s, u) + y;
  const east = (u: number) => mgEnd(u)[0];
  const kerbs: V2 = [R.lanes[0] - 0.15, R.lanes[1] + 0.15];
  for (const [u0, u1, y, mat] of [[R.cycle, kerbs[0], 0.15, 'rp-asphalt'], [kerbs[0], R.lanes[0], 0.15, 'concrete'], [R.lanes[0], R.lanes[1], 0, 'rp-asphalt'],
    [R.lanes[1], kerbs[1], 0.15, 'concrete'], [kerbs[1], R.walk, 0.15, 'rp-asphalt']] as const) {
    B.tint(mat === 'concrete' ? CONCRETE : MG_ASPHALT);
    mgStrip(B, u0, u1, road(-0.1), road(y), mat, mat === 'concrete' ? 3 : 6);
    block(B, MG, [[east(u0) - 6, u0], [east(u0), u0], [east(u1), u1], [east(u1) - 6, u1]], () => 0,
      (s, u) => Math.max(mgRoad(s, u), g(s, u) + 0.03) + y, mat, 6, { faces: 'top' });
  }
  B.tint(0xe6e6e0);
  const mid = (R.lanes[0] + R.lanes[1]) / 2;
  const lanes = (s: number, u: number) => (s < mgEnd(u)[0] ? Math.max(mgRoad(s, u), g(s, u) + 0.03) : mgRoad(s, u));
  for (let s = mgEnd(mid)[0] - 4; s + 3 <= mgEnd(mid)[1]; s += 12) {
    const p = [[s, mid - 0.05], [s + 3, mid - 0.05], [s + 3, mid + 0.05], [s, mid + 0.05]].map(([a, b]) => v3(MG.at(a, b), lanes(a, b) + 0.015));
    B.poly(p, [0, 1, 0], 'st-paint', 4);
  }

  // the railings: the metro's along its southern face, and the road's bars either side of it
  const feet = (u: number, y: (s: number, u: number) => number) => steps(...mgEnd(u), [], 2).map((s) => v3(MG.at(s, u), y(s, u)));
  B.tint(RAILING);
  pipeRailing(B, feet(MG_METRO[0] + 0.2, decks[0].kerb), 1.1, 2.4);
  B.tint(MG_BARS);
  for (const u of [R.lo + 0.2, R.hi - 0.2]) barRailing(B, feet(u, decks[1].kerb), 1.15);
}

// ------------------------------------------------------------------ over the Nynäs railway
// West of Magelungsvägen, where the line and Rågsvedsvägen beside it cross the Nynäs railway in its
// cutting: s metres westwards (west-south-west) along the line, u to the right (north-north-west),
// the southern track first, in Magelungsvägen's frame moved 128 m on. Two concrete slabs side by
// side over the cutting in one span, as askew as the railway runs under them, on walls cast against
// boards either side of its tracks: the metro's, and Rågsvedsvägen's, with the cycleway beside the
// tracks behind its railing of bars and the pavement along its northern edge behind a concrete
// parapet with a rail on it (the photographs). The slabs' ends and edges, their tops and the cutting
// from the laser scan, the railway's line from OpenStreetMap; the parapet and railings from
// photographs on Mapillary (2024); no photograph of the slabs' faces or the walls was found.
export const NYNAS_RAILWAY = new Frame([-1319.03, 8026.37], [-0.8781, 0.4786]);
const NR = NYNAS_RAILWAY;
const NR_TRACKS: Rows = [
  [-8, 0.91, 30.983, 4.34, 31.019], [-4, 0.98, 31.067, 4.39, 31.099], [0, 1.04, 31.152, 4.45, 31.181], [4, 1.11, 31.256, 4.51, 31.275],
  [8, 1.18, 31.369, 4.57, 31.389], [12, 1.25, 31.488, 4.64, 31.506], [16, 1.32, 31.606, 4.7, 31.625], [20, 1.4, 31.72, 4.77, 31.74],
  [24, 1.48, 31.838, 4.84, 31.854], [28, 1.56, 31.963, 4.91, 31.978], [32, 1.63, 32.088, 4.98, 32.104], [36, 1.71, 32.209, 5.04, 32.23],
];
// at u, eastern and western: the slabs' ends, and the walls' faces, either side of the railway
// (5.1 m from the middle of its two tracks); the walls' wings beyond the bridges' faces, and how far
// down they step there
const nrEnd = (u: number): V2 => [5.65 + 0.4 * u, 18.55 + 0.4 * u];
const nrFace = (u: number): V2 => [6.6 + 0.4 * u, 17.6 + 0.4 * u];
const NR_WINGS: V2 = [-6, 24.5], NR_WING_DROP = 2.5, NR_FLOOR = 23.3;
// across: the metro's slab; the road's, its edge beam, cycleway, lanes, pavement and parapet
const NR_METRO: V2 = [-3.0, 7.0];
const NR_ROAD = { lo: 7.0, cycle: 7.4, lanes: [9.8, 17.0] as V2, walk: 21.0, hi: 21.5 };
// the road's top (the scan's), and how far it is laid at grade past the slabs' ends, eastern and
// western, where the city's streets end short of them (OpenStreetMap's bridge is longer)
const nrRoad = (s: number, u: number) => 30.49 + 0.036 * s + 0 * u;
const NR_REACH: V2 = [5, 7.5];
const NR_SOFFIT = -1.6, NR_FASCIA = -1.2, NR_ROAD_DEPTH = 1.05, NR_PARAPET = 1.05;
// where the network's tracks are a bridge (OpenStreetMap's, longer than the slab: the bank under it
// beyond the slab's ends)
const NR_BANK: V2 = [-3.4, 27.5];

export function buildNynasRailwayBridges(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (s: number, u: number) => railAt(NR_TRACKS, s, u);
  const g = (s: number, u: number) => ground(...NR.at(s, u)) ?? NR_FLOOR;
  const R = NR_ROAD, road = (y: number) => (s: number, u: number) => nrRoad(s, u) + y;
  const decks = [
    { lo: NR_METRO[0], hi: NR_METRO[1], top: (s: number, u: number) => rail(s, u) + FLOOR, kerb: (s: number, u: number) => rail(s, u) + KERB,
      soffit: (s: number, u: number) => rail(s, u) + NR_SOFFIT, fascia: (s: number, u: number) => rail(s, u) + NR_FASCIA },
    { lo: R.lo, hi: R.hi, top: road(-0.03), kerb: road(0.3), soffit: road(-NR_ROAD_DEPTH), fascia: road(-0.6) },
  ];
  const strip = (u0: number, u1: number, bottom: (s: number, u: number) => number, top: (s: number, u: number) => number, mat: string, tile: number) =>
    skewStrip(B, NR, nrEnd, 8, u0, u1, bottom, top, mat, tile);

  for (const [k, d] of decks.entries()) {
    B.tint(UNDER);
    strip(d.lo + 0.4, (d.lo + d.hi) / 2, d.soffit, d.top, 'fl-under', 3);
    strip((d.lo + d.hi) / 2, d.hi - 0.4, d.soffit, d.top, 'fl-under', 3);
    B.tint(CONCRETE);
    strip(d.lo, d.lo + 0.4, d.fascia, d.kerb, 'concrete', 3);
    // (the road's parapet along its northern edge)
    strip(d.hi - 0.4, d.hi, d.fascia, k === 1 ? road(NR_PARAPET) : d.kerb, 'concrete', 3);
    // the walls under the slab's ends, from below the cutting's floor, and their wings beyond the
    // bridges' outer faces, stepping down
    B.tint(BOARDS);
    for (const e of [0, 1]) {
      const end = (u: number) => nrEnd(u)[e], face = (u: number) => nrFace(u)[e];
      const foot = NR_FLOOR - 0.6;
      block(B, NR, [[end(d.lo), d.lo], [face(d.lo), d.lo], [face(d.hi), d.hi], [end(d.hi), d.hi]], () => foot, (s, u) => d.soffit(s, u) - 0.01, 'gt-boards', 2.4);
      const wing = k === 0 ? [NR_WINGS[0], d.lo] : [d.hi, NR_WINGS[1]];
      const out = k === 0 ? wing[0] : wing[1], y0 = d.soffit(face(k === 0 ? d.lo : d.hi), k === 0 ? d.lo : d.hi);
      const top = (s: number, u: number) => y0 - (NR_WING_DROP * Math.abs(u - (k === 0 ? d.lo : d.hi))) / Math.abs(out - (k === 0 ? d.lo : d.hi));
      block(B, NR, [[end(wing[0]), wing[0]], [face(wing[0]), wing[0]], [face(wing[1]), wing[1]], [end(wing[1]), wing[1]]], () => foot, top, 'gt-boards', 2.4);
    }
  }

  // the bank under the network's floor beyond the metro's slab, against the road on its north side
  const mlo: Edge = () => NR_METRO[0], mhi: Edge = () => NR_METRO[1];
  bank(B, NR, NR_TRACKS, ground, () => NR_BANK[0], (u) => nrEnd(u)[0], mlo, mhi, [true, false]);
  bank(B, NR, NR_TRACKS, ground, (u) => nrEnd(u)[1], () => NR_BANK[1], mlo, mhi, [true, false]);

  // the road: the cycleway and the pavement a kerb higher than the lanes, with concrete kerbs, the
  // lanes' centre line, and on at grade past the slabs' ends
  const kerbs: V2 = [R.lanes[0] - 0.15, R.lanes[1] + 0.15];
  const parts = [[R.cycle, kerbs[0], 0.15, 'rp-asphalt'], [kerbs[0], R.lanes[0], 0.15, 'concrete'], [R.lanes[0], R.lanes[1], 0, 'rp-asphalt'],
    [R.lanes[1], kerbs[1], 0.15, 'concrete'], [kerbs[1], R.walk, 0.15, 'rp-asphalt']] as const;
  const grade = (y: number) => (s: number, u: number) => Math.max(nrRoad(s, u), g(s, u) + 0.03) + y;
  for (const [u0, u1, y, mat] of parts) {
    B.tint(mat === 'concrete' ? CONCRETE : MG_ASPHALT);
    strip(u0, u1, road(-0.1), road(y), mat, mat === 'concrete' ? 3 : 6);
    for (const [a, b] of [[(u: number) => nrEnd(u)[0] - NR_REACH[0], (u: number) => nrEnd(u)[0]], [(u: number) => nrEnd(u)[1], (u: number) => nrEnd(u)[1] + NR_REACH[1]]]) {
      block(B, NR, [[a(u0), u0], [b(u0), u0], [b(u1), u1], [a(u1), u1]], () => 0, grade(y), mat, 6, { faces: 'top' });
    }
  }
  B.tint(0xe6e6e0);
  const mid = (R.lanes[0] + R.lanes[1]) / 2, lanes = (s: number, u: number) => (s < nrEnd(u)[0] || s > nrEnd(u)[1] ? grade(0)(s, u) : nrRoad(s, u));
  for (let s = nrEnd(mid)[0] - NR_REACH[0]; s + 3 <= nrEnd(mid)[1] + NR_REACH[1]; s += 12) {
    const p = [[s, mid - 0.05], [s + 3, mid - 0.05], [s + 3, mid + 0.05], [s, mid + 0.05]].map(([a, b]) => v3(NR.at(a, b), lanes(a, b) + 0.015));
    B.poly(p, [0, 1, 0], 'st-paint', 4);
  }

  // the railings: the metro's along its southern face, the road's bars by the tracks, and the rail on
  // the parapet
  const feet = (u: number, y: (s: number, u: number) => number) => steps(...nrEnd(u), [], 2).map((s) => v3(NR.at(s, u), y(s, u)));
  B.tint(RAILING);
  pipeRailing(B, feet(NR_METRO[0] + 0.2, decks[0].kerb), 1.1, 2.4);
  pipeRailing(B, feet(R.hi - 0.2, road(NR_PARAPET)), 0.3, 2.4);
  B.tint(MG_BARS);
  barRailing(B, feet(R.lo + 0.2, decks[1].kerb), 1.15);
}

// The Nynäs railway itself, which the city leaves out, as far as it is in sight from the bridges:
// its two tracks on their ballast and the overhead line over them, on masts along its south-western
// side. The tracks' middle from OpenStreetMap's two lines, from the north-west; their top from the
// laser scan, which has the ballast level at 23.6 m all along (and a train standing on the
// western track); the masts every 60 m or so, where they stand a guess.
export const NYNAS_LINE = new Line([[-1417.23, 7959.66], [-1349.8, 8016.38], [-1324.98, 8035.82], [-1278.28, 8073.14], [-1228.79, 8109.18], [-1195.7, 8130.9]]);
const NL_TOP = 23.7, NL_TRACKS = 2.35, NL_GAUGE = 0.7175;
// where the line is under the bridges (s along it), the masts' and the arms' places
const NL_BRIDGE: V2 = [89, 116.5], NL_MASTS = [20, 80, 140, 200, 260], NL_MAST = 5.8;
const NL_STEEL = 0x8a8580, NL_BALLAST = 0x847b72, NL_MASTS_TINT = 0x9a9ea2, NL_WIRE = 0x3a3a3a;

export function buildNynasLine(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const L = NYNAS_LINE, ss = steps(0, L.length, [], 2);
  const g = (s: number, u: number) => { const p = L.at(s, u); return ground(p[0], p[1]); };
  // the sleepers' top: the scan's, a little over the city's ground wherever that is higher
  const top = (s: number) => Math.max(NL_TOP, ...[-NL_TRACKS, 0, NL_TRACKS].map((u) => (g(s, u) ?? 0) + 0.08));
  const tops = ss.map(top);
  // the ballast, sloping out to the ground either side; the sleepers; the rails
  B.tint(NL_BALLAST);
  const w = NL_TRACKS + 1.6, foot = NL_TRACKS + 2.9;
  loft(B, ss.map((s, i) => [
    v3(L.at(s, -foot), Math.min(g(s, -foot) ?? tops[i] - 0.5, tops[i] - 0.4)), v3(L.at(s, -w), tops[i] - 0.03),
    v3(L.at(s, w), tops[i] - 0.03), v3(L.at(s, foot), Math.min(g(s, foot) ?? tops[i] - 0.5, tops[i] - 0.4)),
  ]), 'stone', () => UP, 3);
  B.tint(0xffffff);
  for (const c of [-NL_TRACKS, NL_TRACKS]) {
    loft(B, ss.map((s, i) => [v3(L.at(s, c - 1.3), tops[i]), v3(L.at(s, c + 1.3), tops[i])]), 'gs-bed', () => UP, 4, (i, k) => [k, ss[i] / 2.6]);
  }
  B.tint(NL_STEEL);
  for (const c of [-NL_TRACKS, NL_TRACKS]) for (const d of [-NL_GAUGE, NL_GAUGE]) {
    for (let i = 0; i + 1 < ss.length; i++) railBar(B, v3(L.at(ss[i], c + d), tops[i] + 0.17), v3(L.at(ss[i + 1], c + d), tops[i + 1] + 0.17));
  }

  // the overhead line: over each track the contact wire 5.4 m over the rails and the catenary over
  // it, brought down to pass under the bridges
  const rails = (s: number) => top(s) + 0.17;
  const catenary = (s: number) => {
    const d = Math.max(0, Math.max(NL_BRIDGE[0] - s, s - NL_BRIDGE[1]));
    return 6.4 - 0.6 * Math.max(0, 1 - d / 20);
  };
  B.tint(NL_MASTS_TINT);
  for (const s of NL_MASTS) {
    const p = L.at(s, NL_MAST), t = L.frame(s).t, y = rails(s), gr = g(s, NL_MAST) ?? y - 0.4;
    post(B, p, t, 0.26, 0.3, gr - 0.5, y + 7.6, 'metal', 2);
    const tip = L.at(s, -NL_TRACKS - 0.9), arm = L.at(s, NL_MAST - 0.15);
    rod(B, v3(arm, y + catenary(s) + 0.1), v3(tip, y + catenary(s) + 0.1), 0.08, 0.08, 'metal');
    rod(B, v3(arm, y + 5.6), v3(tip, y + 5.6), 0.06, 0.06, 'metal');
    rod(B, v3(arm, y + 7.5), v3(L.at(s, 0), y + catenary(s) + 0.15), 0.05, 0.05, 'metal');
  }
  B.tint(NL_WIRE);
  const ws = steps(0, L.length, [...NL_BRIDGE], 5);
  for (const c of [-NL_TRACKS, NL_TRACKS]) {
    for (let i = 0; i + 1 < ws.length; i++) {
      const [a, b] = [ws[i], ws[i + 1]];
      rod(B, v3(L.at(a, c), rails(a) + 5.4), v3(L.at(b, c), rails(b) + 5.4), 0.025, 0.025, 'metal');
      rod(B, v3(L.at(a, c), rails(a) + catenary(a)), v3(L.at(b, c), rails(b) + catenary(b)), 0.025, 0.025, 'metal');
    }
  }
}

// ------------------------------------------------------------------ the path under the line at Högdalen
// South of Högdalen, where the cycleway through the park passes under the line: s metres south-west
// along the line from the bridge's northern end, u to the right (west-north-west), the eastern track
// first. A short concrete slab over the path, on walls at the tops of the grass slopes down to it
// (the laser scan and Google's mesh; no photograph of it was found).
export const HOGDALEN_PATH = new Frame([-723.23, 7241.11], [-0.601, 0.7992]);
const HP = HOGDALEN_PATH;
const HP_TRACKS: Rows = [
  [-12, 0, 33.712, 3.59, 33.687], [-8, 0, 33.688, 3.59, 33.66], [-4, 0, 33.664, 3.61, 33.636], [0, 0, 33.64, 3.62, 33.612],
  [4, 0, 33.614, 3.64, 33.586], [8, 0, 33.588, 3.66, 33.56], [12, 0, 33.563, 3.69, 33.534], [16, 0, 33.537, 3.71, 33.508],
  [20, 0, 33.511, 3.73, 33.482], [24, 0, 33.485, 3.76, 33.456], [28, -0.01, 33.459, 3.78, 33.43],
];
// its ends and the walls' faces, and its edges (the scan's)
const HP_ENDS: V2 = [0.5, 16.8], HP_FACES: V2 = [2.5, 14.8], HP_EDGES: V2 = [-2.3, 6.3];
// where the network's tracks are a bridge (OpenStreetMap's is longer: the bank beyond the slab)
const HP_BANK: V2 = [-5, 20.2];

export function buildHogdalenPath(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const at = (y: number) => (s: number, u: number) => railAt(HP_TRACKS, s, u) + y;
  const lo: Edge = () => HP_EDGES[0], hi: Edge = () => HP_EDGES[1], ss = steps(HP_ENDS[0], HP_ENDS[1], [...HP_FACES]);
  slabDeck(B, HP, HP_TRACKS, ss, lo, hi, -1.0, -1.15, 0.4);
  B.tint(BOARDS);
  for (const [a, b] of [[HP_ENDS[0], HP_FACES[0]], [HP_FACES[1], HP_ENDS[1]]]) abutment(B, HP, HP_TRACKS, ground, a, b, lo, hi, -1.15, 'gt-boards');
  for (const [a, b] of [[HP_BANK[0], HP_ENDS[0]], [HP_ENDS[1], HP_BANK[1]]]) bank(B, HP, HP_TRACKS, ground, () => a, () => b, lo, hi);
  B.tint(RAILING);
  for (const e of [off(lo, 0.2), off(hi, -0.2)]) pipeRailing(B, line(HP, ss, e, at(KERB)), 1.1, 2.4);
}

// ------------------------------------------------------------------ the depot tracks' bridge
// South of Högdalen, where the two tracks to the depot cross over the main line's southbound track
// and the cycleway beside it, which run down through a trough under them beside Rågsvedsvägen: s
// metres northwards along the depot tracks from the bridge's southern end, u to the right (east),
// the eastern track first. The trough crosses them only 21° off their line, so the slab over it is
// a long parallelogram, 30 m along the tracks for a span of 9 m: its ends rest on the trough's
// walls. Beyond the bank the walls turn: on the north-eastern side the one beside the main line runs
// on along it for 30 m, its top level with the tracks' bank behind it, and the others turn away
// short of the slopes down into the trough, each with a railing along its top (Google's mesh, the
// laser scan, whose points class only the slab's middle 16 m a bridge's, and photographs on
// Mapillary, 2023–2024).
export const DEPOT_BRIDGE = new Frame([-1010.5, 7788.6], [0.127, -0.992]);
const DC = DEPOT_BRIDGE;
const DC_TRACKS: Rows = [
  [-24, 5.21, 33.982, 0.88, 34.1], [-20, 3.99, 34.041, -0.22, 34.151], [-16, 3.01, 34.089, -1.18, 34.201], [-12, 2.08, 34.134, -1.97, 34.25],
  [-8, 1.28, 34.182, -2.77, 34.3], [-4, 0.65, 34.231, -3.31, 34.332], [0, 0.01, 34.28, -3.82, 34.364], [4, -0.35, 34.308, -4.18, 34.39],
  [8, -0.71, 34.336, -4.49, 34.416], [12, -0.85, 34.352, -4.67, 34.437], [16, -0.96, 34.365, -4.75, 34.447], [20, -0.91, 34.37, -4.69, 34.439],
  [24, -0.79, 34.37, -4.64, 34.431], [28, -0.56, 34.363, -4.34, 34.423], [32, -0.23, 34.349, -4.03, 34.414], [36, 0.18, 34.329, -3.61, 34.384],
  [40, 0.72, 34.298, -3.07, 34.327], [44, 1.28, 34.266, -2.54, 34.27], [48, 2.02, 34.216, -1.81, 34.217], [52, 2.76, 34.167, -1.08, 34.164],
  [56, 3.64, 34.106, -0.25, 34.099], [60, 4.55, 34.043, 0.65, 34.025], [64, 5.55, 33.974, 1.57, 33.95], [68, 6.6, 33.901, 2.61, 33.866],
  [72, 7.7, 33.831, 3.65, 33.783], [76, 8.87, 33.762, 4.77, 33.703], [80, 10.05, 33.692, 5.92, 33.623], [84, 11.3, 33.619, 7.1, 33.545],
  [88, 12.55, 33.546, 8.32, 33.469], [92, 13.85, 33.486, 9.55, 33.393], [96, 15.15, 33.426, 10.79, 33.321], [100, 16.49, 33.366, 12.03, 33.25],
];
// the trough's middle along the tracks at u, how far either side of it along them its walls' faces
// (the main line 2.1–3 m from the northern, the cycleway 1.3–2.4 m from the southern) and their
// backs (the slab's ends) are; the bank's edges, beyond the tracks; the slab's underside and its
// edges' foot
const dcMiddle = (u: number) => 16.3 + 2.6 * u;
const DC_FACE = 13, DC_BACK = 15, DC_EDGES: V2 = [-7.6, 4.0], DC_SOFFIT = -1.1, DC_FASCIA = -0.9;
// the walls beyond the bank, from the slab's corner (the northern wall's, k 1, or the southern's,
// k 0, at the bank's edge `out`) to the end of their face, where the scan's ground falls into the
// trough; how thick they are
const DC_WINGS: { k: 0 | 1; out: number; end: V2 }[] = [
  { k: 1, out: -7.6, end: [6.5, -15] }, { k: 0, out: -7.6, end: [-21.5, -8.5] },
  { k: 1, out: 4.0, end: [dcMiddle(16) + 13, 16] }, { k: 0, out: 4.0, end: [16.5, 7.5] },
];
const DC_WALL = 0.6;
// south of the slab, the bank under the network's floor track by track, from where it is cut low
// beside the main line, or the network's tracks are a bridge (OpenStreetMap's, longer than the
// slab), to its end; and north of it, behind the slab's end and the wall beside the main line, the
// bank under them all, as far behind the wall's face as the city's ground there is the main line's
// cutting's (tools/build-city.ts: data/ground-corrections.json has the ground's own beyond)
const DC_BANKS = [{ lo: -7.6, hi: -1.6, end: -26 }, { lo: -1.6, hi: 4.0, end: -5 }];
const DC_FILL = 28;

export function buildDepotBridge(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (s: number, u: number) => railAt(DC_TRACKS, s, u);
  const g = (s: number, u: number) => ground(...DC.at(s, u)) ?? rail(s, u) - 5;
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  const ends = (u: number): V2 => [dcMiddle(u) - DC_BACK, dcMiddle(u) + DC_BACK];
  const [lo, hi] = DC_EDGES;
  // the slab, and its edge beams along the bank's edges
  B.tint(UNDER);
  skewStrip(B, DC, ends, 10, lo + 0.4, hi - 0.4, at(DC_SOFFIT), at(FLOOR), 'fl-under', 3);
  B.tint(CONCRETE);
  skewStrip(B, DC, ends, 10, lo, lo + 0.4, at(DC_FASCIA), at(KERB), 'concrete', 3);
  skewStrip(B, DC, ends, 10, hi - 0.4, hi, at(DC_FASCIA), at(KERB), 'concrete', 3);
  // the trough's walls under the slab's ends
  const foot = (p: V2[]) => Math.min(...p.map(([s, u]) => g(s, u))) - 0.6;
  for (const k of [0, 1]) {
    const back = (u: number) => ends(u)[k], face = (u: number) => dcMiddle(u) + (k ? DC_FACE : -DC_FACE);
    const under: V2[] = [[back(lo), lo], [face(lo), lo], [face(hi), hi], [back(hi), hi]];
    block(B, DC, under, () => foot(under), (s, u) => rail(s, u) + DC_SOFFIT - 0.01, 'concrete', 3);
  }
  // and beyond the bank, in pieces about 4 m long: their tops a little over the ground behind them,
  // never under the bank's side falling away from its edge, nor less than half a metre over the
  // trough's floor in front
  for (const { k, out, end } of DC_WINGS) {
    const c: V2 = [dcMiddle(out) + (k ? DC_FACE : -DC_FACE), out], len = Math.hypot(end[0] - c[0], end[1] - c[1]);
    const d: V2 = [(end[0] - c[0]) / len, (end[1] - c[1]) / len];
    // (towards the bank)
    let n: V2 = [-d[1], d[0]];
    if (n[0] * (k ? 1 : -1) < 0) n = [-n[0], -n[1]];
    const bankTop = rail(ends(out)[k], out) + FLOOR;
    const along = (t: number, w: number): V2 => [c[0] + d[0] * t + n[0] * w, c[1] + d[1] * t + n[1] * w];
    // (the long one beside the main line level with the tracks' bank behind it)
    const behind = (t: number) => (k && out > 0 ? rail(...along(t, 0)) + FLOOR + 0.05 : Math.max(g(...along(t, 8)), bankTop + 0.15 - Math.abs(along(t, 0)[1] - out) / 1.5));
    const top = (t: number) => Math.max(behind(t) + 0.2, g(...along(t, -1)) + 0.5);
    const ts = steps(0, len, [], 4);
    for (let i = 1; i < ts.length; i++) {
      const piece = [along(ts[i - 1], 0), along(ts[i], 0), along(ts[i], DC_WALL), along(ts[i - 1], DC_WALL)];
      block(B, DC, piece, () => foot(piece), (s, u) => top((s - c[0]) * d[0] + (u - c[1]) * d[1]), 'concrete', 3);
    }
    B.tint(RAILING);
    pipeRailing(B, ts.map((t) => v3(DC.at(...along(t, DC_WALL / 2)), top(t))), 1.0, 2.4);
    B.tint(CONCRETE);
  }
  // the bank under the network's floor beyond the slab (south of it, ending against the back of the
  // wall turning away from the trough on its eastern side)
  const se = DC_WINGS[3], seFace: V2 = [dcMiddle(se.out) - DC_FACE, se.out];
  const seBack = (u: number) => seFace[0] - DC_WALL + ((se.end[0] - seFace[0]) * (u - seFace[1])) / (se.end[1] - seFace[1]);
  for (const b of DC_BANKS) {
    const sides: [boolean, boolean] = [b.lo === lo, b.hi === hi];
    bank(B, DC, DC_TRACKS, ground, () => b.end, (u) => Math.max(b.end, Math.min(ends(u)[0], seBack(u))), () => b.lo, () => b.hi, sides);
  }
  // (north of it, from the slab's end and the back of the wall beside the main line and, beyond the
  // bank's western edge, of the one turning away from the trough)
  const nw = DC_WINGS[0], nwFace: V2 = [dcMiddle(nw.out) + DC_FACE, nw.out];
  const nwBack = (u: number) => nwFace[0] + DC_WALL + ((nw.end[0] - nwFace[0]) * (u - nwFace[1])) / (nw.end[1] - nwFace[1]);
  const fill0 = (u: number) => (u < lo ? nwBack(u) : ends(u)[1]);
  bank(B, DC, DC_TRACKS, ground, fill0, (u) => fill0(u) + DC_FILL, () => lo, () => DC_WINGS[2].end[1], [true, true]);
  // the railings along the slab's edges
  B.tint(RAILING);
  for (const u of [lo + 0.2, hi - 0.2]) pipeRailing(B, steps(...ends(u), [], 2).map((s) => v3(DC.at(s, u), rail(s, u) + KERB)), 1.1, 2.4);
}

// ------------------------------------------------------------------ Bjursätragatan's bridge
// East of Rågsved, over Bjursätragatan and the paths either side of it in their valley: s metres
// westwards (west-south-west) from the bridge's eastern end, u to the right (north-north-west), the
// southern track first. One concrete deck in three spans, its slab deepening in curves to the two
// piers, walls cast against boards either side of the street and its pavements, so that from the
// street the span over it looks like a flat arch (the photographs and Google's mesh); on abutments
// at the tops of the slopes at its ends. The piers' places from the street and the paths under it
// (OpenStreetMap's) and the photographs.
export const BJURSATRAGATAN = new Frame([-1603.38, 8226.72], [-0.742, 0.6704]);
const BJ = BJURSATRAGATAN;
const BJ_TRACKS: Rows = [
  [-8, 0.06, 39.837, 4.2, 39.87], [-4, 0.03, 39.874, 4.26, 39.903], [0, 0, 39.91, 4.32, 39.933], [4, -0.02, 39.929, 4.41, 39.95],
  [8, -0.03, 39.947, 4.49, 39.968], [12, -0.04, 39.966, 4.6, 39.986], [16, -0.04, 39.984, 4.71, 40.003], [20, -0.04, 40.006, 4.85, 40.021],
  [24, -0.04, 40.029, 4.99, 40.039], [28, -0.04, 40.05, 5.15, 40.058], [32, -0.04, 40.068, 5.32, 40.08], [36, -0.03, 40.087, 5.49, 40.101],
  [40, -0.02, 40.106, 5.71, 40.119], [44, -0.02, 40.124, 5.93, 40.137], [48, -0.01, 40.143, 6.19, 40.154], [52, 0, 40.161, 6.45, 40.172],
  [56, 0.01, 40.169, 6.75, 40.182],
];
const BJ_ENDS: V2 = [0, 51.7], BJ_FACES: V2 = [3, 48.7], BJ_PIERS = [17, 37];
// where the network's tracks are a bridge (OpenStreetMap's is longer: the bank beyond the deck)
const BJ_BANK: V2 = [-4.95, 56.65];
// the edges (the scan's), widening as the northern track draws away from the southern
const bjLo: Edge = () => -2.9, bjHi = table([[0, 7.0], [20, 7.6], [40, 8.2], [52, 8.7]]);
// the slab under the rails at its middles and the edge beams' foot; how much deeper it is over the
// piers, and over how far either side
const BJ_SOFFIT = -1.45, BJ_FASCIA = -1.0, BJ_HAUNCH: V2 = [1.1, 7.5];

export function buildBjursatragatan(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (s: number, u: number) => railAt(BJ_TRACKS, s, u);
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  const haunch = (s: number) => BJ_PIERS.reduce((h, p) => h + BJ_HAUNCH[0] * Math.max(0, 1 - Math.abs(s - p) / BJ_HAUNCH[1]) ** 2, 0);
  const soffit = (s: number, u: number) => rail(s, u) + BJ_SOFFIT - haunch(s);
  const ss = steps(BJ_ENDS[0], BJ_ENDS[1], [...BJ_FACES, ...BJ_PIERS.flatMap((p) => [p - 0.5, p + 0.5])], 1.5);
  // the slab, and the edge beams along its faces
  B.tint(UNDER);
  band(B, BJ, ss, off(bjLo, 0.4), (s) => (bjLo(s) + bjHi(s)) / 2, soffit, at(FLOOR), 'fl-under', 3);
  band(B, BJ, ss, (s) => (bjLo(s) + bjHi(s)) / 2, off(bjHi, -0.4), soffit, at(FLOOR), 'fl-under', 3);
  B.tint(CONCRETE);
  band(B, BJ, ss, bjLo, off(bjLo, 0.4), at(BJ_FASCIA), at(KERB), 'concrete', 3);
  band(B, BJ, ss, off(bjHi, -0.4), bjHi, at(BJ_FASCIA), at(KERB), 'concrete', 3);
  // the piers, walls under the slab's middle, and the abutments
  B.tint(BOARDS);
  for (const p of BJ_PIERS) {
    const plan: V2[] = [[p - 0.5, bjLo(p) + 0.6], [p + 0.5, bjLo(p) + 0.6], [p + 0.5, bjHi(p) - 0.6], [p - 0.5, bjHi(p) - 0.6]];
    const foot = Math.min(...plan.map(([s, u]) => ground(...BJ.at(s, u)) ?? rail(s, u) - 7)) - 0.6;
    block(B, BJ, plan, () => foot, (s, u) => soffit(s, u) + 0.02, 'gt-boards', 2.4);
  }
  for (const [a, b] of [[BJ_ENDS[0], BJ_FACES[0]], [BJ_FACES[1], BJ_ENDS[1]]]) abutment(B, BJ, BJ_TRACKS, ground, a, b, bjLo, bjHi, BJ_SOFFIT, 'gt-boards');
  for (const [a, b] of [[BJ_BANK[0], BJ_ENDS[0]], [BJ_ENDS[1], BJ_BANK[1]]]) bank(B, BJ, BJ_TRACKS, ground, () => a, () => b, bjLo, bjHi);
  B.tint(RAILING);
  for (const e of [off(bjLo, 0.2), off(bjHi, -0.2)]) pipeRailing(B, line(BJ, steps(BJ_ENDS[0], BJ_ENDS[1]), e, at(KERB)), 1.1, 2.4);
}

// ------------------------------------------------------------------ Rågsvedsvägen's arch
// Between Rågsved and Hagsätra, over Rågsvedsvägen, the cycleway and the path in their valley:
// s metres eastwards (east-south-east) from the bridge's western end, u to the right
// (south-south-west), the southern track first. A concrete deck, curving with the tracks, on a flat
// concrete arch that springs from the slopes a couple of metres over the valley's floor and rises
// into the deck over its middle third; between them, rows of two slender square columns stand on
// the arch, and at either end the deck rests on an abutment at the top of the slope (photographs on
// Mapillary, 2015–2023, and the laser scan). Its railings of three rails on posts.
export const RAGSVEDSVAGEN = new Frame([-2199.70, 8398.20], [0.9480, 0.3184]);
const RS = RAGSVEDSVAGEN;
const RS_TRACKS: Rows = [
  [-8, -0.93, 43.533, -4.49, 43.375], [-4, -0.47, 43.477, -4.02, 43.318], [0, 0, 43.42, -3.54, 43.261], [4, 0.37, 43.366, -3.15, 43.203],
  [8, 0.74, 43.312, -2.79, 43.146], [12, 1.04, 43.258, -2.46, 43.09], [16, 1.32, 43.205, -2.22, 43.037], [20, 1.55, 43.151, -1.98, 42.983],
  [24, 1.75, 43.097, -1.83, 42.933], [28, 1.91, 43.045, -1.7, 42.885], [32, 2, 42.996, -1.6, 42.835], [36, 2.08, 42.946, -1.59, 42.782],
  [40, 2.08, 42.897, -1.57, 42.729], [44, 2.08, 42.848, -1.63, 42.679], [48, 2.01, 42.799, -1.72, 42.63], [52, 1.91, 42.75, -1.84, 42.583],
  [56, 1.76, 42.7, -2.01, 42.538], [60, 1.58, 42.651, -2.19, 42.493], [64, 1.36, 42.602, -2.44, 42.445], [68, 1.07, 42.552, -2.71, 42.396],
  [72, 0.78, 42.504, -3.01, 42.349], [76, 0.4, 42.459, -3.37, 42.304], [80, 0.03, 42.414, -3.73, 42.259], [84, -0.43, 42.372, -4.17, 42.213],
  [88, -0.9, 42.331, -4.62, 42.168],
];
// its ends and the abutments' faces (the scan's), and its edges, which follow the tracks
const RS_ENDS: V2 = [-5, 82], RS_FACES: V2 = [-2.5, 78];
// where the network's tracks are a bridge eastwards (OpenStreetMap's is longer: the bank beyond the deck)
const RS_BANK = 85.35;
const rsLo: Edge = (s) => track(RS_TRACKS, s, 1)[0] - 3.0, rsHi: Edge = (s) => track(RS_TRACKS, s, 0)[0] + 2.7;
const RS_SECTION: Section = { edge: 0.4, fascia: -1.0, soffit: -1.45, curve: 1.2 };
// The arch: straight, as wide as the deck where it is narrowest; where it springs, at what heights,
// how thick it is at its crown and its springings. The columns on it, this far from each springing,
// and across it.
const RS_ARCH: V2 = [-4.3, 3.5], RS_SPRING: V2 = [12.5, 63.5], RS_SPRING_Y: V2 = [34.3, 35.6], RS_THICK: V2 = [0.9, 1.3];
const RS_ON_ARCH = [1.5, 6, 10.5, 15], RS_COLUMNS: V2 = [-3.4, 2.6];

export function buildRagsvedsvagen(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const g = (s: number, u: number) => ground(...RS.at(s, u)) ?? railAt(RS_TRACKS, s, u) - 8;
  const ss = steps(RS_ENDS[0], RS_ENDS[1], [...RS_FACES, ...RS_SPRING]);
  const soffit = curvedDeck(B, RS, RS_TRACKS, ss, rsLo, rsHi, RS_SECTION);
  const [lo, hi] = RS_ARCH, a = arch(B, RS, lo, hi, () => RS_SPRING, RS_SPRING_Y, RS_THICK, soffit);
  // the footings behind the springings, buried in the slopes
  B.tint(CONCRETE);
  for (const [t, back] of [[-0.03, -1.4], [1.03, 1.4]]) {
    const plan: V2[] = [[a.sOf(t, lo - 0.2), lo - 0.2], [a.sOf(t, lo - 0.2) + back, lo - 0.2], [a.sOf(t, hi + 0.2) + back, hi + 0.2], [a.sOf(t, hi + 0.2), hi + 0.2]];
    const foot = Math.min(...plan.map(([s, u]) => g(s, u))) - 0.6, y = RS_SPRING_Y[t < 0 ? 0 : 1] + 0.3;
    block(B, RS, plan, () => foot, () => y, 'concrete', 3);
  }
  // the columns on the arch, two in each row
  for (const u of RS_COLUMNS) {
    for (const d of RS_ON_ARCH) {
      for (const s of [RS_SPRING[0] + d, RS_SPRING[1] - d]) {
        const base = a.extrados(s, u), top = soffit(s, u);
        if (top - base > 0.45) post(B, RS.at(s, u), RS.t, 0.5, 0.5, base - 0.1, top + 0.02, 'concrete', 3);
      }
    }
  }
  // the abutments at the slopes' tops
  for (const [s0, s1] of [[RS_ENDS[0], RS_FACES[0]], [RS_FACES[1], RS_ENDS[1]]]) abutment(B, RS, RS_TRACKS, ground, s0, s1, rsLo, rsHi, RS_SECTION.fascia + 0.1, 'concrete');
  bank(B, RS, RS_TRACKS, ground, () => RS_ENDS[1], () => RS_BANK, rsLo, rsHi);
  B.tint(RAILING);
  const at = (y: number) => (s: number, u: number) => railAt(RS_TRACKS, s, u) + y;
  for (const e of [off(rsLo, 0.2), off(rsHi, -0.2)]) pipeRailing(B, line(RS, steps(RS_ENDS[0], RS_ENDS[1], [], 2), e, at(KERB)), 1.1, 2.6);
}

// ------------------------------------------------------------------ the viaduct over Olshammarsgatan
// South-east of Hagsätra, where the line comes off its bank over the open ground under it and
// Olshammarsgatan: s metres north-north-west from the viaduct's south-eastern end towards the
// station, u to the right (east-north-east), the western track first. A concrete deck in three
// spans: its edges overhang thin from the slab's middle, which is deeper; on two piers of two round
// columns each, and at the station's end on an abutment whose wall stands at the street's northern
// pavement, from the ground to the deck, with a wing beyond each edge. At the south-eastern end on
// an abutment in the slope (the laser scan, Google's mesh and photographs on Mapillary, 2018–2023).
// The art cut into the wall facing the street, rays from a sun at its foot, isn't drawn.
export const OLSHAMMARSGATAN = new Frame([-2549.25, 7898.43], [-0.2782, -0.9605]);
const OL = OLSHAMMARSGATAN;
const OL_TRACKS: Rows = [
  [-16, -0.02, 46.26, 3.23, 46.247], [-12, -0.04, 46.233, 3.26, 46.223], [-8, -0.06, 46.207, 3.28, 46.198], [-4, -0.04, 46.179, 3.31, 46.174],
  [0, 0, 46.15, 3.33, 46.149], [4, 0.01, 46.122, 3.36, 46.125], [8, 0.03, 46.094, 3.38, 46.101], [12, 0.02, 46.07, 3.41, 46.077],
  [16, 0, 46.047, 3.44, 46.052], [20, -0.04, 46.022, 3.48, 46.028], [24, -0.1, 45.996, 3.52, 46.004], [28, -0.17, 45.971, 3.56, 45.98],
  [32, -0.28, 45.95, 3.6, 45.955], [36, -0.39, 45.928, 3.63, 45.931], [40, -0.55, 45.902, 3.67, 45.907], [44, -0.7, 45.876, 3.69, 45.883],
  [48, -0.89, 45.849, 3.72, 45.858], [52, -1.1, 45.823, 3.72, 45.834], [56, -1.33, 45.799, 3.71, 45.81], [60, -1.6, 45.778, 3.69, 45.786],
  [64, -1.88, 45.756, 3.63, 45.766], [68, -2.21, 45.734, 3.58, 45.746], [72, -2.54, 45.712, 3.48, 45.726], [76, -2.92, 45.691, 3.36, 45.705],
  [80, -3.3, 45.669, 3.24, 45.684], [84, -3.72, 45.647, 3.06, 45.66], [88, -4.16, 45.625, 2.89, 45.636], [92, -4.62, 45.603, 2.67, 45.618],
  [96, -5.12, 45.581, 2.44, 45.601], [100, -5.61, 45.56, 2.19, 45.584], [104, -6.16, 45.542, 1.9, 45.564], [108, -6.71, 45.525, 1.61, 45.543],
  [112, -7.31, 45.508, 1.28, 45.526], [116, -7.92, 45.492, 0.95, 45.51], [120, -8.54, 45.476, 0.59, 45.494], [124, -9.21, 45.459, 0.21, 45.478],
  [128, -9.87, 45.443, -0.17, 45.462], [132, -10.58, 45.427, -0.59, 45.445], [136, -11.3, 45.411, -1.01, 45.428],
];
// its ends, the abutments' faces (the south-eastern where the slope reaches the deck, the wall's
// by the pavement) and the piers; its edges (the scan's), the western following its track
const OL_ENDS: V2 = [-9, 68], OL_FACES: V2 = [-4.5, 57.5], OL_PIERS = [19.5, 34.5];
const olLo: Edge = (s) => track(OL_TRACKS, s, 0)[0] - 2.9, olHi = table([[-10, 5.9], [0, 5.9], [20, 6.3], [40, 6.7], [56, 6.6], [68, 6.0]]);
// from the rails' top: the edge beams' foot, the overhangs' underside and how wide they are, the
// slab's underside between them; the columns' radius and how far in from the edges they stand; the
// wings' length
const OL_FASCIA = -1.0, OL_OVERHANG = -0.75, OL_EDGE = 1.3, OL_SOFFIT = -1.85, OL_COLUMN = 0.4, OL_COLUMN_IN = 2.4, OL_WING = 4;
// OpenStreetMap has the tracks on a bridge on to 128 m from the viaduct's end, where in the laser
// scan they run on a bank between the trees, the western track drawing away to the station's: the
// bank under the network's floor from the abutment on, either side of the tracks
const OL_BANK = 133;
const olBankLo: Edge = (s) => track(OL_TRACKS, s, 0)[0] - 2.6, olBankHi: Edge = (s) => track(OL_TRACKS, s, 1)[0] + 2.6;

export function buildOlshammarsgatan(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (s: number, u: number) => railAt(OL_TRACKS, s, u);
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  const g = (s: number, u: number) => ground(...OL.at(s, u)) ?? rail(s, u) - 6;
  const ss = steps(OL_ENDS[0], OL_ENDS[1], [...OL_FACES, ...OL_PIERS]);
  // the slab's deep middle and its overhangs, and the edge beams along its faces
  B.tint(UNDER);
  band(B, OL, ss, off(olLo, OL_EDGE), off(olHi, -OL_EDGE), at(OL_SOFFIT), at(FLOOR), 'fl-under', 3);
  band(B, OL, ss, off(olLo, 0.4), off(olLo, OL_EDGE), at(OL_OVERHANG), at(FLOOR), 'fl-under', 3);
  band(B, OL, ss, off(olHi, -OL_EDGE), off(olHi, -0.4), at(OL_OVERHANG), at(FLOOR), 'fl-under', 3);
  B.tint(CONCRETE);
  band(B, OL, ss, olLo, off(olLo, 0.4), at(OL_FASCIA), at(KERB), 'concrete', 3);
  band(B, OL, ss, off(olHi, -0.4), olHi, at(OL_FASCIA), at(KERB), 'concrete', 3);
  // the piers' columns
  for (const s of OL_PIERS) {
    for (const u of [olLo(s) + OL_COLUMN_IN, olHi(s) - OL_COLUMN_IN]) {
      const c = OL.at(s, u);
      B.lathe(c[0], c[1], [[OL_COLUMN, g(s, u) - 0.3], [OL_COLUMN, rail(s, u) + OL_SOFFIT + 0.05]], 'concrete', 16, 3);
    }
  }
  // the abutments, the station's end's wall up to the slab, and its wings
  for (const [s0, s1] of [[OL_ENDS[0], OL_FACES[0]], [OL_FACES[1], OL_ENDS[1]]]) abutment(B, OL, OL_TRACKS, ground, s0, s1, olLo, olHi, OL_SOFFIT + 0.02, 'concrete');
  const f = OL_FACES[1];
  for (const [u0, u1] of [[olLo(f) - 0.3 - OL_WING, olLo(f) - 0.3], [olHi(f) + 0.3, olHi(f) + 0.3 + OL_WING]]) {
    const plan: V2[] = [[f, u0], [f + 0.6, u0], [f + 0.6, u1], [f, u1]];
    const foot = Math.min(...plan.map(([s, u]) => g(s, u))) - 0.6;
    block(B, OL, plan, () => foot, (s) => rail(s, olLo(s)) + OL_FASCIA, 'concrete', 3);
  }
  bank(B, OL, OL_TRACKS, ground, () => OL_ENDS[1], () => OL_BANK, olBankLo, olBankHi);
  B.tint(RAILING);
  for (const e of [off(olLo, 0.2), off(olHi, -0.2)]) pipeRailing(B, line(OL, steps(OL_ENDS[0], OL_ENDS[1], [], 2), e, at(KERB)), 1.1, 2.4);
}
