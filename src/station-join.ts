import * as THREE from 'three';
import { Polyline } from './polyline';
import type { Track } from './station';
import type { TrackGraph } from './track-graph';
import type { TrackGeometry } from './track-geometry';
import type { Exclusion } from './network';
import { RAIL_TOP } from './trains';

// Joins a station model's tracks to the track network. The model's tracks end a little way into
// the tunnels, on lines it only sketches; where the network has a track that runs through one of
// its platforms, the model's track is replaced by the network's beyond the platform, out to near
// the stations on either side, so that trains run in the network's tunnels. The station still
// draws the platform stretch, and the network leaves that stretch out.

const HANDOVER = 6;        // the station draws its platform and walls this far past their ends
const BLEND = 40;          // over which the track runs from the model's line to the network's
const SHORT_OF_NEXT = 140; // the track ends this far short of the next stop on either side

export class StationJoin {
  exclusions: Exclusion[] = [];

  constructor(private graph: TrackGraph, private geometry: TrackGeometry, private station: string) {}

  join(tracks: Track[]) {
    for (const tr of tracks) if (tr.platform) this.joinTrack(tr);
  }

  private joinTrack(tr: Track) {
    const { platform } = tr;
    if (!platform) return;
    const mid = (platform.s0 + platform.s1) / 2;
    const p = tr.path.pointAt(mid), run = tr.path.tangentAt(mid).multiplyScalar(tr.dir);
    // the route through the network that stops here, at this platform, in this direction
    let best: { line: RoutePoint[]; stop: number; d: number } | null = null;
    for (const route of this.graph.routes) {
      const k = route.stops.findIndex((st) => st.station === this.station);
      if (k < 0) continue;
      const line = routeLine(this.geometry, route.path);
      if (!line) continue;
      const stop = locate(line, route.stops[k].piece, route.stops[k].s);
      if (stop === null) continue;
      const q = pointAt(line, stop), dir = pointAt(line, stop + 5).sub(pointAt(line, stop - 5));
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d > 5 || Math.abs(q.y + RAIL_TOP - p.y) > 3 || dir.x * run.x + dir.z * run.z <= 0) continue;
      if (best && d >= best.d) continue;
      // out to near the stops before and after
      const prev = k > 0 ? locate(line, route.stops[k - 1].piece, route.stops[k - 1].s) : null;
      const next = k + 1 < route.stops.length ? locate(line, route.stops[k + 1].piece, route.stops[k + 1].s) : null;
      const r0 = prev === null ? 0 : prev + SHORT_OF_NEXT, r1 = next === null ? line[line.length - 1].r : next - SHORT_OF_NEXT;
      best = { line: line.filter((pt) => pt.r >= r0 && pt.r <= r1), stop, d };
    }
    if (!best || best.line.length < 2) return;
    const { line, stop } = best;
    // The model's track along the platform, and the network's beyond it, blended over BLEND
    // metres. Distances along the model's track from the platform's middle match distances along
    // the network's from the stop.
    const half = (platform.s1 - platform.s0) / 2 + HANDOVER;
    const pts = line.map((pt) => {
      const off = pt.r - stop, m = mid + off * tr.dir;
      const w = 1 - smooth((Math.abs(off) - half) / BLEND);
      const net = new THREE.Vector3(pt.x, pt.y + RAIL_TOP, pt.z);
      return w > 0 ? net.lerp(tr.path.pointAt(m), w) : net;
    });
    if (tr.dir < 0) pts.reverse();
    const path = new Polyline(pts);
    // the platform and the handover in the new path's distances
    const s0 = nearestS(path, tr.path.pointAt(platform.s0)), s1 = nearestS(path, tr.path.pointAt(platform.s1));
    tr.path = path;
    tr.platform = { ...platform, s0: Math.min(s0, s1), s1: Math.max(s0, s1) };
    // The station draws the track until it is back on the network's line, and the platform and
    // its walls a little past the platform's ends; the network leaves out the same.
    tr.drawn = [Math.max(0, tr.platform.s0 - HANDOVER - BLEND), Math.min(path.length, tr.platform.s1 + HANDOVER + BLEND)];
    const halfLength = (tr.platform.s1 - tr.platform.s0) / 2;
    this.exclude(line, stop - halfLength - HANDOVER, stop + halfLength + HANDOVER, false);
    this.exclude(line, stop - halfLength - HANDOVER - BLEND, stop + halfLength + HANDOVER + BLEND, true);
  }

  // The stretch of the line between distances lo and hi, piece by piece.
  private exclude(line: RoutePoint[], lo: number, hi: number, trackOnly: boolean) {
    const byPiece = new Map<number, [number, number]>();
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      if (b.r < lo || a.r > hi || a.piece !== b.piece) continue;
      const f = (r: number) => a.s + ((b.s - a.s) * (r - a.r)) / (b.r - a.r || 1);
      const sa = f(Math.max(lo, a.r)), sb = f(Math.min(hi, b.r));
      const cur = byPiece.get(a.piece) ?? [Infinity, -Infinity];
      byPiece.set(a.piece, [Math.min(cur[0], sa, sb), Math.max(cur[1], sa, sb)]);
    }
    for (const [piece, [s0, s1]] of byPiece) this.exclusions.push({ piece, s0, s1, trackOnly });
  }
}

// A point of a route's line through the network, at distance r from its start.
interface RoutePoint { x: number; y: number; z: number; r: number; piece: number; s: number }

function routeLine(geometry: TrackGeometry, path: TrackGraph['routes'][number]['path']): RoutePoint[] | null {
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
      out.push({ x: g.x[k], y: g.y[k], z: g.z[k], r, piece: step.piece, s: g.s[k] });
    }
  }
  return out;
}

// the distance along the line of a place on a piece
function locate(line: RoutePoint[], piece: number, s: number) {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    if (a.piece !== piece || b.piece !== piece) continue;
    if ((s - a.s) * (s - b.s) <= 0) return a.r + ((b.r - a.r) * (s - a.s)) / (b.s - a.s || 1);
  }
  return null;
}

function pointAt(line: RoutePoint[], r: number) {
  let i = 1;
  while (i < line.length - 1 && line[i].r < r) i++;
  const a = line[i - 1], b = line[i], t = Math.max(0, Math.min(1, (r - a.r) / (b.r - a.r || 1)));
  return new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
}

// the distance along a polyline of its nearest point to p, in plan
function nearestS(path: Polyline, p: THREE.Vector3) {
  let best = 0, bestD = Infinity;
  for (let i = 1; i < path.pts.length; i++) {
    const a = path.pts[i - 1], b = path.pts[i];
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
    const d = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
    if (d < bestD) { bestD = d; best = path.cum[i - 1] + (path.cum[i] - path.cum[i - 1]) * t; }
  }
  return best;
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
