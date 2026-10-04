// Helpers for reading the track graph (src/track-graph.ts) in the tools.
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
