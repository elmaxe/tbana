import * as THREE from 'three';
import { Polyline } from './polyline';
import type { Track } from './station';
import type { TrackGraph } from './track-graph';
import type { TrackGeometry } from './track-geometry';
import type { Exclusion } from './network';
import { RAIL_TOP } from './service';
import { locate, pointAt, routeLine } from './routes';
import type { RoutePoint } from './routes';

// Joins a station model's tracks to the track network. The model's tracks end a little way into
// the tunnels, on lines it only sketches; where the network has a track that runs through one of
// its platforms, the model's track is replaced by the network's beyond the platform, out to near
// the stations on either side, so that trains run in the network's tunnels. The station still
// draws the platform stretch, and the network leaves that stretch out.

const HANDOVER = 6;        // the station draws its platform and walls this far past their ends
const BLEND = 40;          // over which the track runs from the model's line to the network's
const SHORT_OF_NEXT = 140; // the track ends this far short of the next stop on either side
const STOP_REACH = 60;     // the middle of the model's platform is looked for this far from a stop

// A route's line where it runs through a joined platform: from point `from` of its line (see
// src/routes.ts), the points `pts` at platform level, blended onto the model's track; and its stop
// `k` there, at distance `stop` along its line: where the line passes the middle of the model's
// platform.
export interface RouteStretch { from: number; pts: THREE.Vector3[]; k: number; stop: number }

export class StationJoin {
  exclusions: Exclusion[] = [];
  // the routes that stop at each joined track: the route's name and the index of its stop here
  served = new Map<Track, { route: string; stop: number }[]>();
  // where the routes run through the joined platforms, by route name
  stretches = new Map<string, RouteStretch[]>();

  constructor(private graph: TrackGraph, private geometry: TrackGeometry, readonly station: string) {}

  join(tracks: Track[]) {
    for (const tr of tracks) if (tr.platform) this.joinTrack(tr);
  }

  private joinTrack(tr: Track) {
    const { platform } = tr;
    if (!platform) return;
    const mid = (platform.s0 + platform.s1) / 2;
    const p = tr.path.pointAt(mid), run = tr.path.tangentAt(mid).multiplyScalar(tr.dir);
    // the routes through the network that stop here, at this platform, in this direction
    const found: { route: string; k: number; line: RoutePoint[]; from: number; stop: number; d: number }[] = [];
    for (const route of this.graph.routes) {
      const k = route.stops.findIndex((st) => st.station === this.station);
      if (k < 0) continue;
      const line = routeLine(this.geometry, route.path);
      if (!line) continue;
      const at = locate(line, route.stops[k].piece, route.stops[k].s);
      if (at === null) continue;
      // where the line passes nearest the middle of the model's platform: the graph's stop is
      // the middle of OpenStreetMap's platform, which may be a few metres off
      const stop = nearestR(line, p, at - STOP_REACH, at + STOP_REACH);
      const q = pointAt(line, stop), dir = pointAt(line, stop + 5).sub(pointAt(line, stop - 5));
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d > 5 || Math.abs(q.y + RAIL_TOP - p.y) > 3 || dir.x * run.x + dir.z * run.z <= 0) continue;
      // out to near the stops before and after
      const prev = k > 0 ? locate(line, route.stops[k - 1].piece, route.stops[k - 1].s) : null;
      const next = k + 1 < route.stops.length ? locate(line, route.stops[k + 1].piece, route.stops[k + 1].s) : null;
      const r0 = prev === null ? 0 : prev + SHORT_OF_NEXT, r1 = next === null ? line[line.length - 1].r : next - SHORT_OF_NEXT;
      const from = line.findIndex((pt) => pt.r >= r0);
      found.push({ route: route.name, k, line: line.filter((pt) => pt.r >= r0 && pt.r <= r1), from, stop, d });
    }
    found.sort((a, b) => a.d - b.d);
    const best = found[0];
    if (!best || best.line.length < 2) return;
    // The model's track along the platform, and the network's beyond it, blended over BLEND
    // metres. Distances along the model's track from the platform's middle match distances along
    // the network's from the stop.
    const half = (platform.s1 - platform.s0) / 2 + HANDOVER;
    const blend = (line: RoutePoint[], stop: number) => line.map((pt) => {
      const off = pt.r - stop, m = mid + off * tr.dir;
      const w = 1 - smooth((Math.abs(off) - half) / BLEND);
      const net = new THREE.Vector3(pt.x, pt.y + RAIL_TOP, pt.z);
      return w > 0 ? net.lerp(tr.path.pointAt(m), w) : net;
    });
    // every route stopping here runs through the blended stretch, so that its trains stand at the
    // model's platform
    for (const f of found) {
      if (f.line.length < 2) continue;
      (this.stretches.get(f.route) ?? this.stretches.set(f.route, []).get(f.route)!).push({ from: f.from, pts: blend(f.line, f.stop), k: f.k, stop: f.stop });
      (this.served.get(tr) ?? this.served.set(tr, []).get(tr)!).push({ route: f.route, stop: f.k });
    }
    const { line, stop } = best;
    const pts = blend(line, stop);
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

// the distance along a route's line, between r0 and r1, of its nearest point to p, in plan
function nearestR(line: RoutePoint[], p: THREE.Vector3, r0: number, r1: number) {
  let best = r0, bestD = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    if (b.r < r0 || a.r > r1) continue;
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2));
    const d = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
    if (d < bestD) { bestD = d; best = Math.max(r0, Math.min(r1, a.r + (b.r - a.r) * t)); }
  }
  return best;
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
