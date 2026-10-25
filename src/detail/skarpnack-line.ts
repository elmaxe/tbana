import type { Builder, V2 } from './builder.ts';
import { post } from './ropsten.ts';
import { block, Frame, pipeRailing, type Ground } from './gubbangen.ts';
import { band, CONCRETE, type Edge, FLOOR, KERB, line, off, RAILING, railAt, type Rows, steps, track, UNDER } from './farsta-line-north.ts';
import { bank } from './hagsatra-line.ts';

// What the green line looks out on from Skärmarbrink to Bagarmossen, beyond what the city draws there
// itself (its blocks with facades, the streets and the trees: see the areas in src/detail/areas.ts),
// the metro's bridges between them, from west to east:
//
// BRIDGES
//
// The bridges' plans, heights, edges and the ground under them from Lantmäteriet's laser scan
// (Laserdata Nedladdning, skog, 2021, CC BY 4.0), the streets they cross from OpenStreetMap, their
// looks from photographs on Mapillary (2015–2024) and Google's 3D mesh; their decks follow the
// tracks (public/data/track-geometry.json). The network draws the tracks on them and leaves their
// girders, piers and railings to this (src/detail/viaducts.ts).

// ------------------------------------------------------------------ a viaduct from its parts
// A deck between lo(s) and hi(s) from `from` to `to` along a bridge's frame.
export interface Deck { from: number; to: number; lo: Edge; hi: Edge }
// A deck's section, in metres from the rails' top: edge beams `edge` wide from `fascia` up to the
// kerb, and between them the slab's underside at `soffit`; either curving up to the edge beams over
// `curve` from each edge, or with thin overhangs `wide` from each edge, their underside at `under`.
// Over the supports at `haunch.at` the slab deepens by `depth`, in a curve `length` long either side.
export interface Shape {
  fascia: number; edge: number; soffit: number;
  curve?: number;
  overhang?: { wide: number; under: number };
  haunch?: { at: number[]; depth: number; length: number };
}
// What carries a deck at s (all its decks, or the one `deck`):
// - a row of `n` round columns `r` across (square ones `square` wide, or `square` along the deck by
//   `across`), evenly from `inset` in from each edge (or at `at` from the deck's middle), under a
//   crossbeam `beam` wide along the deck and `depth` under its soffit, maybe on a low plinth shared
//   by the row;
// - a wall across the deck `thick` thick, from `inset` in from each edge (or from u = span[0] to
//   span[1]), skewed `skew` metres along per metre across from the deck's middle (to stand along a
//   street crossing it at a slant);
// - a pier `wide` across and `thick` along under the deck's middle, maybe under a head `head`
//   across and `depth` deep.
export type Support = { s: number; deck?: number; mat?: string; paint?: number } & (
  | { kind: 'columns'; n: number; r?: number; square?: number; across?: number; at?: number[]; inset: number; beam?: { w: number; depth: number }; plinth?: { h: number; out: number } }
  | { kind: 'wall'; thick: number; inset: number; skew?: number; span?: V2 }
  | { kind: 'pier'; wide: number; thick: number; head?: { wide: number; depth: number } }
);
export interface Viaduct {
  frame: Frame; rows: Rows; decks: Deck[]; shape: Shape; supports: Support[];
  // the abutments: from each end of the deck to its face, its top `top` under the rails
  abutments?: { from: number; to: number; deck?: number; top?: number; mat?: string }[];
  // where OpenStreetMap's bridge runs on past the real one: the bank under the network's floor
  banks?: { from: number; to: number; lo: Edge; hi: Edge }[];
  // railings along the decks' edges, `h` high (where the decks are side by side, only the outer ones)
  railing?: { h: number; every: number; inner?: boolean };
  // the edge beams' and slab's material and tint
  mat?: string; tint?: number;
}

export function buildViaduct(B: Builder, ground: Ground, v: Viaduct) {
  B.place([0, 0, 0], 0);
  const { frame: F, rows, shape: d } = v;
  const rail = (s: number, u: number) => railAt(rows, s, u);
  const at = (y: number) => (s: number, u: number) => rail(s, u) + y;
  const g = (s: number, u: number) => ground(...F.at(s, u)) ?? rail(s, u) - 6;
  const haunch = (s: number) => (d.haunch ? d.haunch.at.reduce((h, p) => h + d.haunch!.depth * Math.max(0, 1 - Math.abs(s - p) / d.haunch!.length) ** 2, 0) : 0);
  const mat = v.mat ?? 'concrete', tint = v.tint ?? CONCRETE;
  const marks = v.supports.flatMap((p) => [p.s - 0.5, p.s, p.s + 0.5]).concat((v.abutments ?? []).flatMap((a) => [a.from, a.to]));
  const soffits = v.decks.map((dk) => {
    const ss = steps(dk.from, dk.to, marks, d.haunch ? 1.5 : 3);
    // the slab's underside at (s, u)
    const soffit = (s: number, u: number) => {
      const w = Math.min(u - dk.lo(s), dk.hi(s) - u);
      if (d.overhang && w < d.overhang.wide) return rail(s, u) + d.overhang.under;
      if (d.curve) {
        const f = Math.max(0, Math.min(1, (w - d.edge) / (d.curve - d.edge)));
        return rail(s, u) + d.fascia + 0.1 + (d.soffit - haunch(s) - d.fascia - 0.1) * (1 - (1 - f) ** 2);
      }
      return rail(s, u) + d.soffit - haunch(s);
    };
    // across: the edge beams, then strips to the middle
    const cuts = d.overhang ? [d.edge, d.overhang.wide] : d.curve ? [d.edge, d.edge + 0.5, d.edge + (d.curve - d.edge) * 0.55, d.curve] : [d.edge];
    B.tint(UNDER);
    for (let i = 0; i + 1 < cuts.length; i++) {
      band(B, F, ss, off(dk.lo, cuts[i]), off(dk.lo, cuts[i + 1]), soffit, at(FLOOR), 'fl-under', 3);
      band(B, F, ss, off(dk.hi, -cuts[i + 1]), off(dk.hi, -cuts[i]), soffit, at(FLOOR), 'fl-under', 3);
    }
    const c = cuts[cuts.length - 1];
    band(B, F, ss, off(dk.lo, c), (s) => (dk.lo(s) + dk.hi(s)) / 2, soffit, at(FLOOR), 'fl-under', 3);
    band(B, F, ss, (s) => (dk.lo(s) + dk.hi(s)) / 2, off(dk.hi, -c), soffit, at(FLOOR), 'fl-under', 3);
    B.tint(tint);
    band(B, F, ss, dk.lo, off(dk.lo, d.edge), at(d.fascia), at(KERB), mat, 3);
    band(B, F, ss, off(dk.hi, -d.edge), dk.hi, at(d.fascia), at(KERB), mat, 3);
    return soffit;
  });

  // the supports
  for (const p of v.supports) {
    for (const [k, dk] of v.decks.entries()) {
      if ((p.deck !== undefined && p.deck !== k) || p.s < dk.from || p.s > dk.to) continue;
      const soffit = soffits[k], lo = dk.lo(p.s), hi = dk.hi(p.s), mid = (lo + hi) / 2;
      B.tint(p.paint ?? tint);
      const m = p.mat ?? mat;
      if (p.kind === 'columns') {
        let top = (u: number) => soffit(p.s, u);
        if (p.beam) {
          const y = (s: number, u: number) => soffit(p.s, mid) - p.beam!.depth + (rail(s, u) - rail(p.s, mid));
          band(B, F, [p.s - p.beam.w / 2, p.s + p.beam.w / 2], () => lo + Math.max(0.6, p.inset - 0.8), () => hi - Math.max(0.6, p.inset - 0.8), y, (s, u) => soffit(s, u) + 0.05, m, 3);
          top = (u) => y(p.s, u);
        }
        const us = p.at ? p.at.map((d) => mid + d) : p.n === 1 ? [mid] : Array.from({ length: p.n }, (_, i) => lo + p.inset + ((hi - lo - 2 * p.inset) * i) / (p.n - 1));
        const base = Math.min(...us.map((u) => g(p.s, u)));
        if (p.plinth) {
          const plan: V2[] = [[p.s - p.plinth.out, us[0] - p.plinth.out], [p.s + p.plinth.out, us[0] - p.plinth.out], [p.s + p.plinth.out, us[us.length - 1] + p.plinth.out], [p.s - p.plinth.out, us[us.length - 1] + p.plinth.out]];
          block(B, F, plan, () => base - 0.5, () => Math.max(...plan.map(([s, u]) => g(s, u))) + p.plinth!.h, m, 3);
        }
        for (const u of us) {
          const c = F.at(p.s, u), foot = (p.plinth ? Math.max(...us.map((w) => g(p.s, w))) + p.plinth.h : g(p.s, u)) - 0.1;
          if (p.square) post(B, c, F.t, p.square, p.across ?? p.square, foot, top(u) + 0.02, m, 3);
          else B.lathe(c[0], c[1], [[p.r ?? 0.35, foot - 0.2], [p.r ?? 0.35, top(u) + 0.02]], m, 16, 3);
        }
      } else if (p.kind === 'wall') {
        const h = p.thick / 2, u0 = p.span?.[0] ?? lo + p.inset, u1 = p.span?.[1] ?? hi - p.inset, k = p.skew ?? 0;
        const plan: V2[] = [[p.s - h + k * (u0 - mid), u0], [p.s + h + k * (u0 - mid), u0], [p.s + h + k * (u1 - mid), u1], [p.s - h + k * (u1 - mid), u1]];
        const foot = Math.min(...plan.map(([s, u]) => g(s, u))) - 0.6;
        block(B, F, plan, () => foot, (s, u) => soffit(s, u) + 0.02, m, 2.4);
      } else {
        const u = mid, c = F.at(p.s, u);
        let top = soffit(p.s, u);
        if (p.head) {
          const y = soffit(p.s, mid) - p.head.depth;
          band(B, F, [p.s - p.thick / 2, p.s + p.thick / 2], () => mid - p.head!.wide / 2, () => mid + p.head!.wide / 2, () => y, (s, w) => soffit(s, w) + 0.05, m, 3);
          top = y;
        }
        post(B, c, F.t, p.thick, p.wide, g(p.s, u) - 0.5, top + 0.02, m, 3);
      }
    }
  }

  // the abutments, and the banks beyond them
  for (const a of v.abutments ?? []) {
    const dk = v.decks[a.deck ?? 0];
    B.tint(tint);
    const s0 = Math.min(a.from, a.to), s1 = Math.max(a.from, a.to);
    const plan: V2[] = [[s0, dk.lo(s0) - 0.3], [s1, dk.lo(s1) - 0.3], [s1, dk.hi(s1) + 0.3], [s0, dk.hi(s0) + 0.3]];
    const foot = Math.min(...plan.map(([s, u]) => g(s, u))) - 0.6;
    block(B, F, plan, () => foot, at(a.top ?? d.fascia + 0.1), a.mat ?? mat, 2.4);
  }
  for (const b of v.banks ?? []) bank(B, F, rows, ground, () => b.from, () => b.to, b.lo, b.hi);

  // the railings
  if (v.railing) {
    B.tint(RAILING);
    const r = v.railing;
    for (const [k, dk] of v.decks.entries()) {
      const ss = steps(dk.from, dk.to, [], 2);
      const sides = v.decks.length === 1 || r.inner ? [0, 1] : k === 0 ? [0] : k === v.decks.length - 1 ? [1] : [];
      for (const side of sides) pipeRailing(B, line(F, ss, side ? off(dk.hi, -0.2) : off(dk.lo, 0.2), at(KERB)), r.h, r.every);
    }
  }
}

// the edges of a deck `half` either side of track k, and an edge `d` to the right of track k
export const around = (rows: Rows, k: number, half: number): [Edge, Edge] => [(s) => track(rows, s, k)[0] - half, (s) => track(rows, s, k)[0] + half];
const beside = (rows: Rows, k: number, d: number): Edge => (s) => track(rows, s, k)[0] + d;
// a deck from `from` to `to` along the tracks, `half` either side of track k
export const deckOn = (rows: Rows, from: number, to: number, k: number, half: number): Deck => {
  const [lo, hi] = around(rows, k, half);
  return { from, to, lo, hi };
};
// one from `d0` to the right of track k0 to `d1` to the right of track k1
export const deckBetween = (rows: Rows, from: number, to: number, [k0, d0]: V2, [k1, d1]: V2): Deck => ({ from, to, lo: beside(rows, k0, d0), hi: beside(rows, k1, d1) });

// The supports at each of `at`, alike.
type Unplaced = Support extends infer T ? (T extends unknown ? Omit<T, 's'> : never) : never;
export const each = (at: number[], p: Unplaced): Support[] => at.map((s) => ({ ...p, s }) as Support);
// A slab whose underside curves up to thin edge beams (most of the line's bridges of 1958), and
// one whose edges overhang a deeper middle (Halmstadsvägen's and Kärrtorpsvägen's, on crossheads).
export const CURVED: Shape = { fascia: -0.9, edge: 0.4, soffit: -1.5, curve: 1.8 };
export const OVERHUNG: Shape = { fascia: -0.95, edge: 0.35, soffit: -1.65, overhang: { wide: 1.3, under: -1.15 } };
export const RAILINGS = { h: 1.1, every: 2.4 };

// ------------------------------------------------------------------ Skärmarbrink's flyover
// East of Skärmarbrink, where the Skarpnäck line's southern track climbs over the Farsta and
// Hagsätra lines' four tracks to its side of the station: s metres west-north-westwards from the
// deck's eastern end, u to the right (north-north-east). The laser scan has the deck 5.8 m wide
// from 1 m east of OpenStreetMap's bridge to 3 m past its western end, over the tracks 6–7 m
// below, and the bank's slopes at either end. Single round columns stand where the tracks under
// it leave room, two of them 2.5 m from the tracks either side (the photographs of it are of the
// path beside it and show nothing of them; Google's mesh is too coarse under it).
export const SKARMARBRINK_FLYOVER = new Frame([1885.51, 4123.14], [-0.8869, -0.4620]);
const SM_TRACKS: Rows = [
  [-8, 0.65, 46.149], [-4, 0.33, 46.079], [0, 0, 46.01], [4, -0.32, 45.942],
  [8, -0.64, 45.875], [12, -0.88, 45.796], [16, -1.07, 45.724], [20, -1.18, 45.646],
  [24, -1.25, 45.565], [28, -1.24, 45.46], [32, -1.18, 45.352], [36, -1.07, 45.241],
  [40, -0.88, 45.124], [44, -0.64, 44.992], [48, -0.32, 44.866], [52, -0.04, 44.754],
  [56, 0.33, 44.609], [60, 0.66, 44.48], [64, 0.98, 44.35],
];
export const SKARMARBRINK: Viaduct = {
  frame: SKARMARBRINK_FLYOVER, rows: SM_TRACKS, shape: CURVED, railing: RAILINGS,
  decks: [deckOn(SM_TRACKS, -1, 55, 0, 3.0)],
  supports: [...each([14], { kind: 'columns', n: 1, r: 0.4, inset: 0 }), ...each([25.5, 38.8], { kind: 'columns', n: 1, r: 0.35, inset: 0 })],
  abutments: [{ from: -1, to: 3 }, { from: 52, to: 55 }],
};

// ------------------------------------------------------------------ Sparrmansvägen's bridge
// Between Skärmarbrink and Hammarbyhöjden, over Sparrmansvägen, a cycleway and a footway: s metres
// eastwards from the bridge's western end, u to the right (south); the northern track is the
// first. One deck for both tracks, 8.9 m wide (the laser scan), from the top of the bank's slope
// on the west to that on the east, 6.2 m over the road. Photographs (Mapillary, 2021): a slab with
// deep edge beams and a railing of upright bars, on one broad pier at the road's eastern edge,
// between it and the cycleway; both cross at a slant, and the pier stands along them.
export const SPARRMANSVAGEN = new Frame([2134.13, 4122.97], [0.9924, -0.1233]);
const HL_TRACKS: Rows = [
  [-12, -0.05, 45.631, 3.7, 45.812], [-8, -0.03, 45.64, 3.67, 45.808], [-4, -0.02, 45.65, 3.65, 45.804], [0, 0, 45.66, 3.61, 45.799],
  [4, 0.02, 45.67, 3.59, 45.795], [8, 0.03, 45.68, 3.56, 45.791], [12, 0.04, 45.684, 3.53, 45.79], [16, 0.04, 45.689, 3.5, 45.79],
  [20, 0.04, 45.699, 3.47, 45.789], [24, 0.03, 45.709, 3.44, 45.785], [28, 0.03, 45.714, 3.41, 45.781], [32, 0.02, 45.719, 3.39, 45.78],
  [36, 0.01, 45.728, 3.37, 45.78], [40, 0, 45.738, 3.34, 45.78], [44, -0.01, 45.747, 3.32, 45.78], [48, -0.02, 45.757, 3.29, 45.78],
];
export const SPARRMANS: Viaduct = {
  frame: SPARRMANSVAGEN, rows: HL_TRACKS, railing: RAILINGS,
  shape: { fascia: -0.95, edge: 0.45, soffit: -1.45, curve: 1.8, haunch: { at: [20.6], depth: 0.45, length: 6 } },
  decks: [deckBetween(HL_TRACKS, -5, 38.5, [0, -2.8], [1, 2.6])],
  supports: [{ s: 20.6, kind: 'wall', thick: 0.6, inset: 0.5, skew: -0.26 }],
  abutments: [{ from: -5, to: -2 }, { from: 35.5, to: 38.5 }],
  // (OpenStreetMap's bridge runs on 3 m past the eastern abutment)
  banks: [{ from: 38.5, to: 41.5, lo: beside(HL_TRACKS, 0, -2.8), hi: beside(HL_TRACKS, 1, 2.6) }],
};

// ------------------------------------------------------------------ Ulricehamnsvägen's bridges
// Between Hammarbyhöjden and Björkhagen, over Ulricehamnsvägen, the footways beside it and a
// service road: s metres eastwards from the bridges' western ends, u to the right (south); the
// northern track is the first. The laser scan has a deck for each track, 6 m wide, 3–4 m apart,
// from the bank's end on the west to 12 m short of OpenStreetMap's bridge's eastern end, 6 m over
// the road. Between them at their western ends stands Hammarbyhöjden's eastern entrance, and its
// hall at the street under the northern deck (the station's, src/open-styles.ts). No photographs
// of them were found: they are drawn as the line's other bridges of 1958, with a round column
// under each deck where the streets and the hall under them leave room.
export const ULRICEHAMNSVAGEN = new Frame([2688.04, 4079.54], [0.9992, 0.0404]);
const HH_TRACKS: Rows = [
  [-8, 0.26, 44.142, 12.19, 44.215], [-4, 0.13, 44.051, 11.95, 44.114], [0, 0, 43.96, 11.7, 44.014], [4, -0.12, 43.872, 11.45, 43.908],
  [8, -0.26, 43.773, 11.22, 43.812], [12, -0.36, 43.68, 10.99, 43.716], [16, -0.45, 43.584, 10.73, 43.608], [20, -0.53, 43.488, 10.5, 43.512],
  [24, -0.58, 43.38, 10.28, 43.416], [28, -0.62, 43.284, 10.05, 43.308], [32, -0.64, 43.179, 9.84, 43.212], [36, -0.66, 43.071, 9.65, 43.116],
  [40, -0.66, 42.947, 9.44, 43.008], [44, -0.63, 42.831, 9.27, 42.9], [48, -0.61, 42.715, 9.11, 42.78], [52, -0.56, 42.599, 8.93, 42.645],
  [56, -0.5, 42.468, 8.81, 42.529], [60, -0.44, 42.352, 8.68, 42.413], [64, -0.36, 42.236, 8.55, 42.28], [68, -0.28, 42.12, 8.44, 42.16],
  [72, -0.15, 41.989, 8.34, 42.04], [76, -0.04, 41.873, 8.25, 41.905], [80, 0.07, 41.754, 8.17, 41.785], [84, 0.19, 41.634, 8.08, 41.658],
  [88, 0.3, 41.514, 7.99, 41.533],
];
export const ULRICEHAMNS: Viaduct = {
  frame: ULRICEHAMNSVAGEN, rows: HH_TRACKS, shape: CURVED, railing: RAILINGS,
  decks: [deckOn(HH_TRACKS, -3, 65, 0, 3.0), deckOn(HH_TRACKS, -3, 65, 1, 3.0)],
  supports: [{ s: 10, deck: 1, kind: 'columns', n: 1, r: 0.4, inset: 0 }, ...each([22, 33, 42, 52], { kind: 'columns', n: 1, r: 0.4, inset: 0 })],
  abutments: [{ from: -3, to: 0.5 }, { from: 62, to: 65 }, { from: -3, to: 0.5, deck: 1 }, { from: 62, to: 65, deck: 1 }],
  banks: [{ from: 65, to: 80, lo: beside(HH_TRACKS, 0, -3), hi: beside(HH_TRACKS, 1, 3) }],
};

// ------------------------------------------------------------------ Malmövägen's viaduct
// North of Björkhagen, curving over Karlskronavägen, a path, Malmövägen's two carriageways and a
// cycleway: s metres south-south-eastwards from its northern end, u to the right
// (west-south-west); the eastern track is the first. One deck for both tracks, 9.4 m wide (the
// laser scan), 128 m from the bank's end on the north to that on the south, 6–7 m over the
// streets. Photographs (Mapillary, 2016–2021): a slab with thin edges and a railing of upright
// bars, on pairs of round columns standing on a low plinth each; the streets cross under it at a
// slant, so the spans over Malmövägen are longer.
export const MALMOVAGEN = new Frame([3136.55, 4234.12], [0.4032, 0.9151]);
const BH_TRACKS: Rows = [
  [-12, 2.47, 35.291, -1.1, 35.341], [-8, 1.65, 35.408, -1.88, 35.452], [-4, 0.82, 35.524, -2.67, 35.562], [0, 0, 35.64, -3.46, 35.674],
  [4, -0.79, 35.752, -4.22, 35.782], [8, -1.69, 35.878, -4.99, 35.89], [12, -2.4, 35.987, -5.71, 36.016], [16, -3.06, 36.096, -6.36, 36.128],
  [20, -3.7, 36.204, -6.92, 36.24], [24, -4.29, 36.335, -7.44, 36.352], [28, -4.81, 36.451, -7.94, 36.465], [32, -5.22, 36.567, -8.34, 36.581],
  [36, -5.59, 36.683, -8.74, 36.697], [40, -5.93, 36.799, -9.07, 36.813], [44, -6.16, 36.915, -9.35, 36.928], [48, -6.41, 37.046, -9.61, 37.044],
  [52, -6.52, 37.165, -9.78, 37.16], [56, -6.61, 37.285, -9.96, 37.291], [60, -6.65, 37.404, -10.05, 37.41], [64, -6.62, 37.52, -10.11, 37.53],
  [68, -6.59, 37.636, -10.14, 37.649], [72, -6.45, 37.752, -10.1, 37.765], [76, -6.29, 37.867, -10.05, 37.881], [80, -6.06, 37.996, -9.91, 37.994],
  [84, -5.79, 38.108, -9.75, 38.106], [88, -5.52, 38.22, -9.55, 38.218], [92, -5.13, 38.336, -9.26, 38.33], [96, -4.74, 38.452, -8.96, 38.442],
  [100, -4.3, 38.562, -8.57, 38.551], [104, -3.74, 38.679, -8.15, 38.659], [108, -3.23, 38.783, -7.69, 38.766], [112, -2.61, 38.887, -7.09, 38.883],
  [116, -2, 38.991, -6.55, 38.987], [120, -1.24, 39.108, -5.94, 39.087], [124, -0.53, 39.212, -5.31, 39.188], [128, 0.18, 39.317, -4.65, 39.288],
  [132, 0.92, 39.424, -3.96, 39.388], [136, 1.65, 39.532, -3.27, 39.487], [140, 2.38, 39.639, -2.53, 39.595], [144, 3.11, 39.747, -1.83, 39.697],
];
export const MALMO: Viaduct = {
  frame: MALMOVAGEN, rows: BH_TRACKS, shape: { ...CURVED, curve: 2.2 }, railing: RAILINGS,
  decks: [deckBetween(BH_TRACKS, -6, 125.5, [1, -3.2], [0, 3.0])],
  supports: each([10, 22, 34, 46, 61, 84, 105.2, 118], { kind: 'columns', n: 2, r: 0.35, inset: 1.6, plinth: { h: 0.4, out: 0.6 } }),
  abutments: [{ from: -6, to: -3 }, { from: 122, to: 125.5 }],
  banks: [{ from: 125.5, to: 136.5, lo: beside(BH_TRACKS, 1, -3.2), hi: beside(BH_TRACKS, 0, 3.0) }],
};

// ------------------------------------------------------------------ Halmstadsvägen's bridges
// South of Björkhagen's platform, over Halmstadsvägen and a footway: s metres northwards from the
// bridges' southern ends, u to the right (east); the eastern track is the first. The laser scan
// has a deck for each track, 5.2 and 5.6 m wide, 3 m apart, 45 m long, 6 m over the street.
// Photographs (Mapillary, 2019–2021): each deck on square columns under a crosshead, its edges
// overhanging, a railing of upright bars; a pair of bents either side of the street.
export const HALMSTADSVAGEN = new Frame([3223.61, 4630.14], [0.0447, -0.9990]);
const BS_TRACKS: Rows = [
  [-8, -0.22, 40.64, -7.81, 40.64], [-4, -0.11, 40.64, -7.95, 40.64], [0, 0, 40.64, -8.09, 40.64], [4, 0.11, 40.64, -8.22, 40.64],
  [8, 0.23, 40.64, -8.36, 40.64], [12, 0.29, 40.643, -8.5, 40.64], [16, 0.34, 40.648, -8.65, 40.64], [20, 0.36, 40.65, -8.77, 40.64],
  [24, 0.37, 40.65, -8.91, 40.64], [28, 0.36, 40.65, -9.09, 40.64], [32, 0.31, 40.65, -9.26, 40.641], [36, 0.25, 40.65, -9.47, 40.646],
  [40, 0.15, 40.65, -9.68, 40.65], [44, 0.05, 40.65, -9.92, 40.65], [48, -0.06, 40.65, -10.16, 40.65], [52, -0.17, 40.65, -10.4, 40.65],
];
export const HALMSTADS: Viaduct = {
  frame: HALMSTADSVAGEN, rows: BS_TRACKS, shape: OVERHUNG, railing: RAILINGS,
  decks: [deckOn(BS_TRACKS, 0, 45, 0, 2.6), deckOn(BS_TRACKS, 0, 45, 1, 2.8)],
  supports: each([10.5, 19, 28.5, 34], { kind: 'columns', n: 1, square: 0.7, inset: 0, beam: { w: 0.9, depth: 0.6 } }),
  abutments: [{ from: 0, to: 3 }, { from: 42, to: 45 }, { from: 0, to: 3, deck: 1 }, { from: 42, to: 45, deck: 1 }],
};

// ------------------------------------------------------------------ Ystadsvägen's viaduct
// Between Björkhagen and Kärrtorp, over the park along Ystadsvägen, the street, a footway, a path,
// Fyrskeppsvägen and a cycleway: s metres southwards from its northern end, u to the right (west);
// the western track is the first. One deck for both tracks, 9 m wide (the laser scan), 140 m from
// the bank's end on the north to that on the south, 8–9 m over the park. Photographs (Mapillary,
// 2016–2020): a slab curving up to thin edges and a railing of upright bars, on single columns.
export const YSTADSVAGEN = new Frame([3198.46, 4757.18], [-0.2228, 0.9749]);
const BK_TRACKS: Rows = [
  [-16, 0.26, 40.984, -3.69, 40.998], [-12, 0.19, 41.02, -3.68, 41.035], [-8, 0.13, 41.057, -3.67, 41.071], [-4, 0.06, 41.093, -3.66, 41.108],
  [0, 0, 41.13, -3.65, 41.144], [4, -0.06, 41.166, -3.65, 41.181], [8, -0.13, 41.202, -3.64, 41.218], [12, -0.18, 41.238, -3.63, 41.254],
  [16, -0.22, 41.279, -3.63, 41.289], [20, -0.26, 41.315, -3.62, 41.325], [24, -0.29, 41.351, -3.62, 41.361], [28, -0.32, 41.386, -3.62, 41.398],
  [32, -0.33, 41.422, -3.62, 41.436], [36, -0.34, 41.459, -3.62, 41.468], [40, -0.35, 41.495, -3.62, 41.5], [44, -0.35, 41.531, -3.62, 41.54],
  [48, -0.34, 41.571, -3.62, 41.58], [52, -0.33, 41.613, -3.62, 41.62], [56, -0.31, 41.657, -3.62, 41.66], [60, -0.3, 41.7, -3.62, 41.7],
  [64, -0.28, 41.74, -3.61, 41.736], [68, -0.26, 41.78, -3.61, 41.776], [72, -0.23, 41.82, -3.61, 41.815], [76, -0.21, 41.86, -3.61, 41.855],
  [80, -0.18, 41.905, -3.61, 41.895], [84, -0.16, 41.945, -3.61, 41.931], [88, -0.14, 41.985, -3.61, 41.966], [92, -0.12, 42.025, -3.61, 42.005],
  [96, -0.1, 42.065, -3.6, 42.045], [100, -0.08, 42.104, -3.6, 42.085], [104, -0.06, 42.139, -3.6, 42.125], [108, -0.04, 42.18, -3.59, 42.17],
  [112, -0.03, 42.22, -3.58, 42.207], [116, -0.01, 42.26, -3.57, 42.243], [120, -0.01, 42.3, -3.56, 42.28], [124, 0, 42.34, -3.55, 42.32],
  [128, 0, 42.375, -3.53, 42.36], [132, 0, 42.422, -3.51, 42.401],
];
export const YSTADS: Viaduct = {
  frame: YSTADSVAGEN, rows: BK_TRACKS, shape: { ...CURVED, soffit: -1.6, curve: 2.6 }, railing: RAILINGS,
  decks: [deckBetween(BK_TRACKS, -12, 128, [1, -2.9], [0, 2.6])],
  supports: each([4, 20, 36, 50, 66, 80, 96, 108, 117], { kind: 'columns', n: 1, r: 0.45, inset: 0 }),
  abutments: [{ from: -12, to: -9 }, { from: 125, to: 128 }],
};

// ------------------------------------------------------------------ Kärrtorpsvägen's bridges
// South of Kärrtorp, over Kärrtorpsvägen and Kärrtorpsplan: s metres north-north-westwards from
// the bridges' southern ends, u to the right (east-north-east); the western track is the first.
// The laser scan has a deck for each track, 5.8 m wide, 4 m apart, from the bank's end on the
// south to the station's ticket hall under their northern ends, which, with the square in front of
// it and the bents over that, is the station's (src/open-styles.ts); 5.5 m over the street.
// Photographs (Mapillary, 2019–2021): each deck on pairs of pale round columns under a crosshead.
export const KARRTORPSVAGEN = new Frame([3211.12, 5379.68], [-0.4284, -0.9036]);
const KT_TRACKS: Rows = [
  [-8, 0.78, 40.556, 8.19, 40.719], [-4, 0.39, 40.648, 8.01, 40.824], [0, 0, 40.74, 7.83, 40.932], [4, -0.37, 40.828, 7.66, 41.036],
  [8, -0.79, 40.927, 7.48, 41.14], [12, -1.14, 41.015, 7.37, 41.236], [16, -1.51, 41.114, 7.25, 41.332], [20, -1.83, 41.202, 7.17, 41.43],
  [24, -2.11, 41.29, 7.11, 41.53], [28, -2.42, 41.389, 7.06, 41.63], [32, -2.64, 41.474, 7.08, 41.714], [36, -2.84, 41.557, 7.1, 41.798],
  [40, -3.03, 41.652, 7.16, 41.884], [44, -3.15, 41.736, 7.27, 41.972], [48, -3.27, 41.83, 7.37, 42.06], [52, -3.27, 41.905, 7.55, 42.132],
  [56, -3.28, 41.981, 7.74, 42.204], [60, -3.21, 42.064, 7.99, 42.288], [64, -3.11, 42.136, 8.26, 42.364], [68, -2.99, 42.206, 8.54, 42.438],
  [72, -2.78, 42.278, 8.88, 42.498], [76, -2.59, 42.342, 9.22, 42.557], [80, -2.33, 42.403, 9.6, 42.612], [84, -2.03, 42.47, 10, 42.664],
  [88, -1.72, 42.524, 10.41, 42.715], [92, -1.33, 42.578, 10.86, 42.751], [96, -0.98, 42.626, 11.31, 42.786], [100, -0.57, 42.674, 11.8, 42.825],
  [104, -0.1, 42.728, 12.3, 42.865],
];
export const KARRTORPS: Viaduct = {
  frame: KARRTORPSVAGEN, rows: KT_TRACKS, shape: OVERHUNG, railing: RAILINGS,
  decks: [deckOn(KT_TRACKS, -2, 99.5, 0, 2.9), deckOn(KT_TRACKS, -2, 99.5, 1, 2.9)],
  supports: each([12, 32, 44, 56, 68, 78], { kind: 'columns', n: 2, r: 0.35, inset: 1.0, beam: { w: 0.9, depth: 0.45 } }),
  abutments: [{ from: -2, to: 1 }, { from: -2, to: 1, deck: 1 }],
};

// ------------------------------------------------------------------ Bagarmossen's viaduct
// Between Kärrtorp and Bagarmossen, over Länsmansvägen, Sockenvägen and the cycleways beside it:
// s metres north-westwards from its south-eastern end, u to the right (north-east); the
// south-western track is the first. One deck for both tracks, 9.5 m wide (the laser scan), 95 m
// from the bank's end on the south-east to that on the north-west, 5.5 m over the streets (the
// tracks laid on the laser's ballast: data/height-corrections.json). Photographs (Mapillary,
// 2016–2021): a slab with thin edges and a railing of upright bars, on pairs of columns, with a
// longer span over Sockenvägen.
export const BAGARMOSSEN_VIADUCT = new Frame([3469.87, 5739.02], [-0.5954, -0.8035]);
const BG_TRACKS: Rows = [
  [-8, 0.35, 41.326, 4.18, 41.317], [-4, 0.17, 41.313, 3.98, 41.304], [0, 0, 41.3, 3.79, 41.291], [4, -0.18, 41.286, 3.61, 41.278],
  [8, -0.34, 41.275, 3.42, 41.264], [12, -0.49, 41.261, 3.25, 41.251], [16, -0.61, 41.248, 3.13, 41.239], [20, -0.72, 41.234, 3, 41.225],
  [24, -0.79, 41.222, 2.91, 41.212], [28, -0.86, 41.207, 2.82, 41.197], [32, -0.9, 41.18, 2.78, 41.173], [36, -0.93, 41.156, 2.74, 41.146],
  [40, -0.93, 41.118, 2.72, 41.112], [44, -0.93, 41.078, 2.72, 41.08], [48, -0.91, 41.042, 2.73, 41.046], [52, -0.88, 41.002, 2.77, 41.015],
  [56, -0.83, 40.961, 2.8, 40.985], [60, -0.77, 40.921, 2.86, 40.94], [64, -0.71, 40.885, 2.92, 40.895], [68, -0.62, 40.82, 3, 40.838],
  [72, -0.52, 40.752, 3.07, 40.786], [76, -0.43, 40.695, 3.16, 40.725], [80, -0.32, 40.632, 3.25, 40.662], [84, -0.21, 40.568, 3.33, 40.606],
  [88, -0.11, 40.508, 3.42, 40.543], [92, -0.01, 40.447, 3.51, 40.48], [96, 0.11, 40.374, 3.59, 40.421], [100, 0.22, 40.308, 3.68, 40.36],
];
export const BAGARMOSSEN: Viaduct = {
  frame: BAGARMOSSEN_VIADUCT, rows: BG_TRACKS, shape: { ...CURVED, fascia: -0.95, curve: 2.2 }, railing: RAILINGS,
  decks: [deckBetween(BG_TRACKS, -3, 92, [0, -3.0], [1, 2.8])],
  supports: each([10, 21.5, 33, 44.5, 56, 64, 82], { kind: 'columns', n: 2, r: 0.35, inset: 1.5 }),
  abutments: [{ from: -3, to: 1 }, { from: 88, to: 92 }],
};

export const buildSkarpnackViaduct = (v: Viaduct) => (B: Builder, ground: Ground) => buildViaduct(B, ground, v);
