import type { Builder, V2, V3 } from './builder.ts';
import { lampMast, lines, Line, loft, post, table } from './ropsten.ts';
import { block, Frame, type Ground, v3 } from './gubbangen.ts';
import { barRailing, CONCRETE, KERB, RAILING, UNDER } from './farsta-line-north.ts';

// A road's bridge drawn along its middle line, for the roads OpenStreetMap has on bridges: the
// city leaves those out entirely (tools/build-city.ts), so the deck carries its own road. t metres
// along the line from its first point, u to the right of it.
//
// The deck: a slab `depth` under the road's surface between edge beams `edge` wide, which rise a
// kerb over it; the road's asphalt between them, raised a kerb where a footway or cycleway runs
// (`paths`); its lines, solid or dashed, and concrete barriers along it, each at u constant or along
// t, over all the deck or a stretch of it; lamp masts on the barriers or the paths; railings of
// upright bars along both edges (or one). Under it rows of
// columns at t across the deck, round or square, maybe under a crossbeam, or walls; at its ends
// abutments down into the ground.
type U = number | ((t: number) => number);
// a line or a barrier: at u, or at u over a stretch of t
export type Mark = U | { u: U; range: V2 };

export interface RoadDeck {
  line: V2[];
  from: number; to: number;
  // the deck's edges at t, left (u < 0 usually) and right
  edges: (t: number) => V2;
  // the road's surface at (t, u)
  top: (t: number, u: number) => number;
  depth?: number; edge?: number; fascia?: number;
  paths?: V2[];
  solid?: Mark[]; dashed?: Mark[]; barriers?: Mark[];
  // lamp masts at t, standing `raise` over the road (on a barrier: 0.81)
  lamps?: { at: number[]; u: U; h?: number; arms: number[]; raise?: number };
  railings?: [boolean, boolean];
  columns?: { at: number[]; us: number[] | ((t: number) => number[]); r?: number; flare?: number; square?: number; beam?: { w: number; depth: number } };
  walls?: { at: number; span: V2; thick: number }[];
  abutments?: [number, number];
  surface?: number;
}

const PATH = 0x7a7b7c, ROAD = 0x67696b, BARRIER = 0xc4c1ba;
const fn = (u: U) => (typeof u === 'number' ? () => u : u);

// a deck's line and its ends' stations, about every `step` metres and at each of `marks`
export function deckLine(d: RoadDeck) { return new Line(d.line); }
function stations(from: number, to: number, step: number, marks: number[]) {
  const n = Math.max(1, Math.ceil((to - from) / step));
  const ts = Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
  for (const m of marks) if (m > from && m < to && !ts.some((t) => Math.abs(t - m) < 0.05)) ts.push(m);
  return ts.sort((a, b) => a - b);
}

export function buildRoadDeck(B: Builder, ground: Ground, d: RoadDeck, range?: V2) {
  B.place([0, 0, 0], 0);
  const L = new Line(d.line);
  const depth = d.depth ?? 1.0, edge = d.edge ?? 0.4, fascia = d.fascia ?? depth + 0.15;
  // the stretch built: all of it, or a part (what stands at t in [from, to), and the deck's own ends)
  const from = Math.max(d.from, range?.[0] ?? d.from), to = Math.min(d.to, range?.[1] ?? d.to);
  const inPart = (t: number) => (t >= from && t < to) || (t === d.to && to === d.to);
  const colAt = (d.columns?.at ?? []).filter(inPart), wallAt = (d.walls ?? []).map((w) => w.at).filter(inPart);
  const ts = stations(from, to, 2, [...colAt, ...wallAt, ...(d.abutments ? [d.from + d.abutments[0], d.to - d.abutments[1]] : [])]);
  const P = (t: number, u: number, dy: number) => v3(L.at(t, u), d.top(t, u) + dy);
  const lo = (t: number) => d.edges(t)[0], hi = (t: number) => d.edges(t)[1];
  // points across the deck about every 4 m, as many at every station
  const n = Math.max(1, ...ts.map((t) => Math.ceil((hi(t) - lo(t)) / 4)));
  const across = (a: number, b: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  const right = (t: number): V3 => L.right(t);
  const down: V3 = [0, -1, 0], up: V3 = [0, 1, 0];

  // the slab's underside, and the edge beams with their fascias
  B.tint(UNDER);
  loft(B, ts.map((t) => across(lo(t) + edge, hi(t) - edge).map((u) => P(t, u, -depth))), 'fl-under', () => down, 3);
  B.tint(CONCRETE);
  for (const side of [-1, 1]) {
    const e = (t: number) => (side < 0 ? lo(t) : hi(t)), i = (t: number) => e(t) - side * edge;
    const out = (t: number) => right(t).map((c) => c * side) as V3;
    loft(B, ts.map((t) => [P(t, i(t), -depth), P(t, e(t), -fascia), P(t, e(t), KERB), P(t, i(t), KERB), P(t, i(t), 0)]), 'concrete',
      (k, j) => (j === 0 ? down : j === 1 ? out(ts[k]) : j === 2 ? up : (out(ts[k]).map((c) => -c) as V3)), 3);
  }
  // the ends of the slab
  for (const [t, dir] of [[d.from, -1], [d.to, 1]] as const) {
    if (t !== from && t !== to) continue;
    const a = L.along(t), n: V3 = [a[0] * dir, 0, a[2] * dir];
    B.poly([P(t, lo(t), -fascia), P(t, hi(t), -fascia), P(t, hi(t), KERB), P(t, lo(t), KERB)], n, 'concrete', 3);
  }

  // the road, and the paths raised a kerb
  B.tint(d.surface ?? ROAD);
  loft(B, ts.map((t) => across(lo(t) + edge, hi(t) - edge).map((u) => P(t, u, 0.005))), 'rp-asphalt', () => up, 6);
  for (const [a, b] of d.paths ?? []) {
    const u0 = (t: number) => Math.max(a, lo(t) + edge), u1 = (t: number) => Math.min(b, hi(t) - edge);
    B.tint(PATH);
    loft(B, ts.map((t) => [P(t, u0(t), 0), P(t, u0(t), 0.15), P(t, u1(t), 0.15), P(t, u1(t), 0)]), 'rp-asphalt',
      (k, j) => (j === 1 ? up : (right(ts[k]).map((c) => (j === 0 ? -c : c)) as V3)), 6);
  }
  const mark = (m: Mark): [(t: number) => number, number, number] => {
    const [u, [a, b]] = typeof m === 'object' ? [fn(m.u), m.range] : [fn(m), [d.from, d.to]];
    return [u, Math.max(a, from), Math.min(b, to)];
  };
  for (const [ms, dashed] of [[d.solid ?? [], false], [d.dashed ?? [], true]] as const) {
    for (const m of ms) {
      const [u, a, b] = mark(m);
      if (b <= a) continue;
      lines(B, L, (t) => d.top(t, u(t)), a, b, [a, b], [u], dashed);
    }
  }
  B.tint(BARRIER);
  for (const m of d.barriers ?? []) {
    const [u, a, b] = mark(m);
    if (b <= a) continue;
    barrierAlong(B, L, [a, ...ts.filter((t) => t > a + 0.05 && t < b - 0.05), b], u, d.top);
  }
  if (d.lamps) {
    const u = fn(d.lamps.u), raise = d.lamps.raise ?? 0.15;
    for (const t of d.lamps.at.filter(inPart)) {
      const a = L.along(t);
      lampMast(B, L.at(t, u(t)), d.top(t, u(t)) + raise, d.lamps.h ?? 10, [a[0], a[2]], d.lamps.arms);
    }
  }
  B.tint(RAILING);
  const [rl, rr] = d.railings ?? [true, true];
  if (rl) barRailing(B, ts.map((t) => P(t, lo(t) + 0.2, KERB)), 1.15);
  if (rr) barRailing(B, ts.map((t) => P(t, hi(t) - 0.2, KERB)), 1.15);

  // the columns, the walls and the abutments
  B.tint(CONCRETE);
  const soffit = (t: number, u: number) => d.top(t, u) - depth;
  const foot = (p: V2, y: number) => (ground(p[0], p[1]) ?? y - 6) - 0.3;
  if (d.columns) {
    const c = d.columns;
    for (const t of colAt) {
      const us = typeof c.us === 'function' ? c.us(t) : c.us, a = L.along(t);
      let top = (u: number) => soffit(t, u);
      if (c.beam) {
        const bw = c.beam.w, bd = c.beam.depth, u0 = Math.min(...us) - 0.7, u1 = Math.max(...us) + 0.7;
        const F = new Frame(L.at(t, 0), [a[0], a[2]]);
        block(B, F, [[-bw / 2, u0], [bw / 2, u0], [bw / 2, u1], [-bw / 2, u1]], (s, u) => soffit(t, u) - bd, (s, u) => soffit(t, u) + 0.05, 'concrete', 3);
        top = (u) => soffit(t, u) - bd;
      }
      for (const u of us) {
        const p = L.at(t, u), y = top(u) + 0.02;
        if (c.square) post(B, p, [a[0], a[2]], c.square, c.square, foot(p, y), y, 'concrete', 3);
        else if (c.flare) {
          const r = c.r ?? 0.4;
          B.lathe(p[0], p[1], [[r, foot(p, y)], [r, y - 1.6], [r + 0.2, y - 0.9], [c.flare, y - 0.25], [c.flare + 0.1, y]], 'concrete', 16, 3);
        } else B.lathe(p[0], p[1], [[c.r ?? 0.4, foot(p, y)], [c.r ?? 0.4, y]], 'concrete', 16, 3);
      }
    }
  }
  for (const w of (d.walls ?? []).filter((w) => inPart(w.at))) {
    const a = L.along(w.at), F = new Frame(L.at(w.at, 0), [a[0], a[2]]), h = w.thick / 2;
    const plan: V2[] = [[-h, w.span[0]], [h, w.span[0]], [h, w.span[1]], [-h, w.span[1]]];
    const base = Math.min(...plan.map(([s, u]) => foot(F.at(s, u), soffit(w.at, u))));
    block(B, F, plan, () => base, (s, u) => soffit(w.at, u) + 0.02, 'concrete', 3);
  }
  if (d.abutments) {
    for (const [t0, t1] of [[d.from, d.from + d.abutments[0]], [d.to - d.abutments[1], d.to]]) {
      if (t1 <= t0 || !inPart(t0)) continue;
      const a = L.along((t0 + t1) / 2), F = new Frame(L.at(t0, 0), [a[0], a[2]]), l = t1 - t0;
      const plan: V2[] = [[0, lo(t0) + 0.1], [l, lo(t1) + 0.1], [l, hi(t1) - 0.1], [0, hi(t0) - 0.1]];
      const base = Math.min(...plan.map(([s, u]) => foot(F.at(s, u), soffit(t0 + s, u)))) - 0.5;
      block(B, F, plan, () => base, (s, u) => soffit(t0 + s, u) + 0.02, 'concrete', 3);
    }
  }
}

// A concrete safety barrier along a line at u, on the road at y(t, u): 0.6 m wide at its foot, 0.81 m
// high (as farsta-line-north.ts's, along a curving line).
const BARRIER_PROFILE: V2[] = [[-0.3, 0], [-0.2, 0.25], [-0.08, 0.81], [0.08, 0.81], [0.2, 0.25], [0.3, 0]];
function barrierAlong(B: Builder, L: Line, ts: number[], u: (t: number) => number, y: (t: number, u: number) => number) {
  const P = (t: number, du: number, h: number) => v3(L.at(t, u(t) + du), y(t, u(t) + du) + h - 0.02);
  loft(B, ts.map((t) => BARRIER_PROFILE.map(([du, h]) => P(t, du, h))), 'concrete',
    (k, j) => { const r = L.right(ts[k]); return j < 2 ? [-r[0], 0.3, -r[2]] : j === 2 ? [0, 1, 0] : [r[0], 0.3, r[2]]; }, 2);
  for (const [t, dir] of [[ts[0], -1], [ts[ts.length - 1], 1]] as const) {
    const a = L.along(t);
    B.poly(BARRIER_PROFILE.map(([du, h]) => P(t, du, h)), [a[0] * dir, 0, a[2] * dir], 'concrete', 2);
  }
}

// columns in rows across the deck, from [t, us] rows
export const bents = (rows: [number, number[]][]) => ({ at: rows.map(([t]) => t), us: (t: number) => rows.find(([b]) => b === t)![1] });

// a surface along a deck's line from [t, height] rows, with a constant cross slope (per metre, rising
// to the right)
export const alongTop = (rows: [number, number][], cross = 0) => { const f = table(rows); return (t: number, u: number) => f(t) + cross * u; };
