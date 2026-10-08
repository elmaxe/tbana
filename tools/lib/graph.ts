// Helpers for reading the track graph (src/track-graph.ts) in the tools.
import { existsSync, readFileSync } from 'node:fs';
import { runningWays } from '../../src/track-graph.ts';
import type { Route, TrackGraph, TrackPiece } from '../../src/track-graph.ts';

// distance along a piece of each of its points
export function chainage(p: TrackPiece) {
  const cum = [0];
  for (let i = 1; i < p.points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(p.points[i][0] - p.points[i - 1][0], p.points[i][1] - p.points[i - 1][1]));
  }
  return cum;
}

// the point s metres along a piece from its `from` end
export function pointAt(p: TrackPiece, s: number): [number, number] {
  for (let i = 1; i < p.points.length; i++) {
    const [ax, az] = p.points[i - 1], [bx, bz] = p.points[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (s <= len || i === p.points.length - 1) {
      const t = len ? Math.min(1, Math.max(0, s / len)) : 0;
      return [ax + (bx - ax) * t, az + (bz - az) * t];
    }
    s -= len;
  }
  return p.points[0];
}

// How far each node of the given tunnel pieces is from the nearest tunnel mouth, through tunnel
// pieces. A mouth is where a tunnel meets track in the open; it may also be a switch, so the
// node's kind doesn't say.
export function mouthDistances(graph: TrackGraph, pieces: TrackPiece[]) {
  const tunnelPieces = pieces.filter((p) => p.structure === 'tunnel');
  const dist = new Map<number, number>();
  const open = new Set(graph.pieces.filter((p) => p.structure !== 'tunnel').flatMap((p) => [p.from, p.to]));
  for (const p of tunnelPieces) for (const n of [p.from, p.to]) if (open.has(n)) dist.set(n, 0);
  for (let changed = true; changed;) {
    changed = false;
    for (const p of tunnelPieces) {
      for (const [a, b] of [[p.from, p.to], [p.to, p.from]]) {
        const d = (dist.get(a) ?? Infinity) + p.length;
        if (d < (dist.get(b) ?? Infinity)) { dist.set(b, d); changed = true; }
      }
    }
  }
  return dist;
}

// linear interpolation in a sorted table
export function interp(xs: number[], ys: number[], x: number) {
  if (x <= xs[0]) return ys[0];
  let lo = 0, hi = xs.length - 1;
  if (x >= xs[hi]) return ys[hi];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid; else hi = mid;
  }
  return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo] || 1);
}

export interface ProfilePoint { s: number; x: number; z: number; y: number; piece: number; structure: TrackPiece['structure'] }

// A route's track as one line from its first stop to its last, with heights from
// public/data/track-heights.json: every point of every piece in running order.
export function routeProfile(graph: TrackGraph, route: Route, heights: Record<string, number[]>) {
  const out: ProfilePoint[] = [];
  let base = 0;
  route.path.forEach((step, i) => {
    const p = graph.pieces[step.piece];
    const cum = chainage(p), hs = heights[p.id];
    if (!hs) throw new Error(`no heights for piece ${p.id}`);
    // the part of the piece that is run: from the first stop on the first piece, to the last
    // stop on the last
    const first = i === 0 ? route.stops[0].s : step.dir === 1 ? 0 : p.length;
    const last = i === route.path.length - 1 ? route.stops[route.stops.length - 1].s : step.dir === 1 ? p.length : 0;
    const lo = Math.min(first, last), hi = Math.max(first, last);
    const idx = cum.map((_, k) => k).filter((k) => cum[k] >= lo && cum[k] <= hi);
    if (step.dir === -1) idx.reverse();
    const at = (s: number) => {
      const [x, z] = pointAt(p, s);
      out.push({ s: base + Math.abs(s - first), x, z, y: interp(cum, hs, s), piece: p.id, structure: p.structure });
    };
    at(first);
    for (const k of idx) at(cum[k]);
    at(last);
    base += Math.abs(last - first);
  });
  // drop repeated points where pieces meet
  return out.filter((p, i) => i === 0 || p.s - out[i - 1].s > 0.01);
}

// The lines the game draws: those with a traced service.
export const drawnLines = (graph: TrackGraph) => [...new Set(graph.routes.map((r) => r.line))];

// The pieces of the lines' track the game draws: those their services run on, and the rest of the
// lines' track joined to them (crossovers, sidings, turnback tracks, the depots, and the tracks
// joining one of the lines to another), as far as the running lines of other lines. Left out:
// - a piece that touches the track of a line not drawn, so a connecting track to it ends short
//   of it
// - track no service runs on beside a platform (the middle tracks at Alby and Sätra, the third
//   track at Liljeholmen): the stations are described without them
// - and then what is left of such a track that leads nowhere
export function lineTrack(graph: TrackGraph, lines: string | string[] = drawnLines(graph)) {
  const own = typeof lines === 'string' ? [lines] : lines;
  const run = new Set([...runningWays(graph), ...graph.routes].filter((r) => own.includes(r.line)).flatMap((r) => r.path.map((s) => s.piece)));
  const at = new Map<number, TrackPiece[]>();
  for (const p of graph.pieces) for (const n of new Set([p.from, p.to])) (at.get(n) ?? at.set(n, []).get(n)!).push(p);
  const foreign = (p: TrackPiece) => p.lines.length > 0 && !p.lines.some((l) => own.includes(l));
  const touchesForeign = (p: TrackPiece) => [p.from, p.to].some((n) => at.get(n)!.some(foreign));
  const atPlatform = new Set(graph.stations.flatMap((st) => st.platforms.flatMap((pl) => pl.tracks.map((t) => t.piece))));
  const out = new Set(run), queue = [...run];
  while (queue.length) {
    const p = graph.pieces[queue.pop()!];
    for (const n of [p.from, p.to]) {
      for (const q of at.get(n)!) {
        if (out.has(q.id) || foreign(q) || touchesForeign(q) || atPlatform.has(q.id)) continue;
        out.add(q.id);
        queue.push(q.id);
      }
    }
  }
  // a piece whose end was joined only to track left out
  for (let changed = true; changed;) {
    changed = false;
    for (const id of out) {
      if (run.has(id)) continue;
      const p = graph.pieces[id];
      if ([p.from, p.to].some((n) => at.get(n)!.length > 1 && !at.get(n)!.some((q) => q !== p && out.has(q.id)))) {
        out.delete(id);
        changed = true;
      }
    }
  }
  return out;
}

// The sidings and turnback tracks among the given pieces: track no service runs on (but not a
// depot's yard, nor a crossover) that OpenStreetMap tags as a siding or spur, or that leads to a
// buffer stop without passing a running line (OSM leaves the turnback track east of
// Östermalmstorg untagged). Not the arms of a scissors crossover, which meet at a diamond
// between the running lines (OSM tags those south of Ropsten as sidings); nor, untagged, the ends
// of a station's middle track left out of the given pieces (lineTrack: Alby's), which run on
// between tracks still the platforms' width apart.
export function sidingPieces(graph: TrackGraph, used: Set<number>) {
  const run = new Set(runningWays(graph).flatMap((r) => r.path.map((st) => st.piece)));
  const at = new Map<number, TrackPiece[]>();
  for (const p of graph.pieces) for (const n of new Set([p.from, p.to])) (at.get(n) ?? at.set(n, []).get(n)!).push(p);
  const kind = new Map(graph.nodes.map((n) => [n.id, n.kind]));
  const onRun = (n: number) => at.get(n)!.some((q) => run.has(q.id));
  const scissors = (p: TrackPiece) => [[p.from, p.to], [p.to, p.from]].some(([a, b]) => kind.get(a) === 'crossing' && onRun(b));
  const candidate = (p: TrackPiece) => used.has(p.id) && !run.has(p.id) && p.service !== 'yard' && p.service !== 'crossover' && !scissors(p);
  const out = new Set<number>(), seen = new Set<number>();
  for (const p of graph.pieces) {
    if (!candidate(p) || seen.has(p.id)) continue;
    // the track no service runs on joined to it, as far as the running lines
    const group: TrackPiece[] = [], queue = [p];
    seen.add(p.id);
    while (queue.length) {
      const q = queue.pop()!;
      group.push(q);
      for (const n of [q.from, q.to]) {
        if (onRun(n)) continue;
        for (const o of at.get(n)!) if (candidate(o) && !seen.has(o.id)) { seen.add(o.id); queue.push(o); }
      }
    }
    const deadEnd = group.some((q) => [q.from, q.to].some((n) => at.get(n)!.length === 1))
      && !group.some((q) => [q.from, q.to].some((n) => at.get(n)!.some((o) => !used.has(o.id))));
    for (const q of group) if (deadEnd || q.service === 'siding' || q.service === 'spur') out.add(q.id);
  }
  return out;
}

// Where the running tracks of two services ('T13' and 'T14', or 'T13+T14' and 'T17+T18+T19') cross
// in OpenStreetMap's plan, other than where they meet at a switch: one passes over the other, at
// a flying junction (east of Östermalmstorg, at Gullmarsplan and Liljeholmen), or where two lines
// part (the red and green lines north of T-Centralen). The two pieces, the point, and how far
// along each piece it is.
export interface Crossing { a: number; b: number; x: number; z: number; sa: number; sb: number }
export function runningCrossings(graph: TrackGraph) {
  const services = new Map<number, Set<string>>();
  for (const r of runningWays(graph)) for (const st of r.path) (services.get(st.piece) ?? services.set(st.piece, new Set()).get(st.piece)!).add(r.service);
  const key = (id: number) => [...services.get(id)!].sort().join('+');
  const pieces = graph.pieces.filter((p) => services.has(p.id));
  const nodeAt = new Map(graph.nodes.map((n) => [n.id, n]));
  const boxes = new Map(pieces.map((p) => {
    const xs = p.points.map((q) => q[0]), zs = p.points.map((q) => q[1]);
    return [p.id, [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]];
  }));
  const out: Crossing[] = [];
  for (const pa of pieces) for (const pb of pieces) {
    if (pb.id <= pa.id || key(pa.id) === key(pb.id)) continue;
    const [a0, a1, a2, a3] = boxes.get(pa.id)!, [b0, b1, b2, b3] = boxes.get(pb.id)!;
    if (a0 > b2 || b0 > a2 || a1 > b3 || b1 > a3) continue;
    const shared = [pa.from, pa.to].filter((n) => n === pb.from || n === pb.to).map((n) => nodeAt.get(n)!);
    const ca = chainage(pa), cb = chainage(pb);
    for (let i = 1; i < pa.points.length; i++) for (let j = 1; j < pb.points.length; j++) {
      const [px, pz] = pa.points[i - 1], [qx, qz] = pa.points[i], [rx, rz] = pb.points[j - 1], [sx, sz] = pb.points[j];
      const dx = qx - px, dz = qz - pz, ex = sx - rx, ez = sz - rz, den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((rx - px) * ez - (rz - pz) * ex) / den, u = ((rx - px) * dz - (rz - pz) * dx) / den;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      const x = px + dx * t, z = pz + dz * t;
      if (shared.some((n) => Math.hypot(n.x - x, n.z - z) < 1)) continue;
      out.push({ a: pa.id, b: pb.id, x, z, sa: ca[i - 1] + (ca[i] - ca[i - 1]) * t, sb: cb[j - 1] + (cb[j] - cb[j - 1]) * u });
    }
  }
  return out;
}

// The ground under the drawn lines' track, from Lantmäteriet's elevation model
// (tools/fetch-ground.ts): [world x, world z, height], from every line's file.
export function groundSamples(graph: TrackGraph): [number, number, number][] {
  return drawnLines(graph).flatMap((line) => {
    const file = groundFile(line);
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).samples : [];
  });
}
export const groundFile = (line: string) => `data/ground/${line}-line.json`;
