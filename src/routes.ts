import * as THREE from 'three';
import type { Route } from './track-graph';
import type { TrackGeometry } from './track-geometry';

// A route's line through the track network: the points of public/data/track-geometry.json along
// the pieces it runs over, in running order.

// A point of a route's line, at distance r from its start (in plan), on a piece at distance s
// along it; the piece is run in direction dir.
export interface RoutePoint { x: number; y: number; z: number; r: number; piece: number; s: number; dir: 1 | -1 }

export function routeLine(geometry: TrackGeometry, path: Route['path']): RoutePoint[] | null {
  const out: RoutePoint[] = [];
  let r = 0;
  for (const step of path) {
    const g = geometry.pieces[step.piece];
    if (!g) return null;
    const idx = g.s.map((_, k) => k);
    if (step.dir < 0) idx.reverse();
    for (const k of idx) {
      const last = out[out.length - 1];
      if (last) {
        const d = Math.hypot(g.x[k] - last.x, g.z[k] - last.z);
        if (d < 0.01) continue;
        r += d;
      }
      out.push({ x: g.x[k], y: g.y[k], z: g.z[k], r, piece: step.piece, s: g.s[k], dir: step.dir });
    }
  }
  return out;
}

// Where on the line a place on a piece is: the segment (from point i - 1 to point i) and how far
// along it, or null if the line doesn't pass it.
export function locateSegment(line: RoutePoint[], piece: number, s: number) {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    if (a.piece !== piece || b.piece !== piece) continue;
    if ((s - a.s) * (s - b.s) <= 0) return { i, t: (s - a.s) / (b.s - a.s || 1) };
  }
  return null;
}

// The segment of the line (from point i - 1 to point i) at distance r along it, and how far along
// that segment.
export function segmentAt(line: RoutePoint[], r: number) {
  let i = 1;
  while (i < line.length - 1 && line[i].r < r) i++;
  const a = line[i - 1], b = line[i];
  return { i, t: Math.max(0, Math.min(1, (r - a.r) / (b.r - a.r || 1))) };
}

// the distance along the line of a place on a piece
export function locate(line: RoutePoint[], piece: number, s: number) {
  const at = locateSegment(line, piece, s);
  if (!at) return null;
  const a = line[at.i - 1], b = line[at.i];
  return a.r + (b.r - a.r) * at.t;
}

export function pointAt(line: RoutePoint[], r: number) {
  let i = 1;
  while (i < line.length - 1 && line[i].r < r) i++;
  const a = line[i - 1], b = line[i], t = Math.max(0, Math.min(1, (r - a.r) / (b.r - a.r || 1)));
  return new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}
