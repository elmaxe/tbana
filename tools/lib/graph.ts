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

// The ground under the drawn lines' track, from Lantmäteriet's elevation model
// (tools/fetch-ground.ts): [world x, world z, height], from every line's file.
export function groundSamples(graph: TrackGraph): [number, number, number][] {
  return drawnLines(graph).flatMap((line) => {
    const file = groundFile(line);
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).samples : [];
  });
}
export const groundFile = (line: string) => `data/ground/${line}-line.json`;
