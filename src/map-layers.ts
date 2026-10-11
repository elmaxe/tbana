// What the map (src/minimap.ts) draws of the network, in world x, z (+x east, +z south, so north
// is up): the track coloured by its line, the platforms beside it, the stations' halls, passages,
// stairs and exits, and the stations' names. Built once from the data the game loads.
import { LINES } from './lines';
import type { LineId } from './lines';
import { PLATFORM_EDGE } from './sections';
import { inclineCorners, liftCorners } from './station-layout';
import type { StationLayout, StationLayouts } from './station-layout';
import type { TrackGraph } from './track-graph';
import type { TrackGeometry } from './track-geometry';

export type XZ = [number, number];
export interface Box { x0: number; z0: number; x1: number; z1: number }

// A run of track: tunnel (in rock or a concrete box) or out in the open.
export interface TrackRun { path: Path2D; box: Box; colour: string; main: boolean; tunnel: boolean }

// The trains calling at a platform's track: the line, its number and where it goes.
export interface Call { line: LineId; number: string; dest: string }

// A platform of a station on the network: the strips beside each of its tracks (an island has
// one from each), and the trains calling at each track.
export interface MapPlatform {
  station: string;
  strips: { outline: XZ[]; path: Path2D }[];
  box: Box;
  y: number; // its floor's height
  tracks: Call[][];
}

// A station's plan: its floors, stairs and lifts, each at its height, and its exits.
export interface PlanPart { kind: 'hall' | 'passage' | 'platform' | 'stairs' | 'escalator' | 'lift'; path: Path2D; y0: number; y1: number }
export interface StationPlan { name: string; box: Box; parts: PlanPart[]; exits: { x: number; z: number }[] }

export interface MapStation { name: string; x: number; z: number; lines: LineId[] }

export interface MapLayers {
  tracks: TrackRun[];
  platforms: MapPlatform[];
  plans: StationPlan[];
  stations: MapStation[];
  box: Box; // round all the track
}

const box = (pts: XZ[], pad = 0): Box => {
  const b = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const [x, z] of pts) {
    b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x);
    b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z);
  }
  b.x0 -= pad; b.z0 -= pad; b.x1 += pad; b.z1 += pad;
  return b;
};

export const overlaps = (a: Box, b: Box) => a.x0 <= b.x1 && a.x1 >= b.x0 && a.z0 <= b.z1 && a.z1 >= b.z0;

const polygon = (pts: XZ[]) => {
  const p = new Path2D();
  pts.forEach(([x, z], i) => (i ? p.lineTo(x, z) : p.moveTo(x, z)));
  p.closePath();
  return p;
};

export function inPolygon(x: number, z: number, pts: XZ[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function buildLayers(graph: TrackGraph, geometry: TrackGeometry, layouts: StationLayouts | null): MapLayers {
  const pieces = new Map(graph.pieces.map((p) => [p.id, p]));

  // ---------------------------------------------------------------- the track
  // Each piece the game draws (track-geometry), in runs of tunnel and open track; a piece no
  // service runs on (a yard's, a siding, a crossover) is grey.
  const tracks: TrackRun[] = [];
  for (const [id, g] of Object.entries(geometry.pieces)) {
    const piece = pieces.get(Number(id));
    const line = piece?.lines[0] as LineId | undefined;
    const main = piece?.service === 'main' && !!line && !!LINES[line];
    const colour = main ? LINES[line!].color : '#66717f';
    let start = 0;
    for (let i = 1; i <= g.x.length; i++) {
      const tunnel = (k: number) => g.kind[k] <= 1; // rock or box
      if (i < g.x.length && tunnel(i) === tunnel(start)) continue;
      const pts: XZ[] = [];
      for (let k = start; k <= Math.min(i, g.x.length - 1); k++) pts.push([g.x[k], g.z[k]]);
      if (pts.length > 1) {
        const path = new Path2D();
        pts.forEach(([x, z], k) => (k ? path.lineTo(x, z) : path.moveTo(x, z)));
        tracks.push({ path, box: box(pts, 5), colour, main, tunnel: tunnel(start) });
      }
      start = i;
    }
  }
  // the yards under the running lines
  tracks.sort((a, b) => Number(a.main) - Number(b.main));

  // ---------------------------------------------------------------- the platforms
  // The trains calling at each track of a station, from the routes: where they go from there.
  const calls = new Map<string, Call[]>();
  for (const r of graph.routes) {
    const dest = r.stops[r.stops.length - 1].station;
    const number = r.service.replace(/^T/, '');
    for (const st of r.stops) {
      if (st.station === dest) continue;
      const key = `${st.station}|${st.piece}`;
      const list = calls.get(key) ?? calls.set(key, []).get(key)!;
      if (!list.some((c) => c.number === number && c.dest === dest)) list.push({ line: r.line as LineId, number, dest });
    }
  }
  for (const list of calls.values()) list.sort((a, b) => a.number.localeCompare(b.number));

  // Each strip of platform the network draws (track-geometry), from the edge to the back (to the
  // middle of an island), joined to the platform in the track graph it belongs to.
  const platforms = new Map<string, MapPlatform>();
  const graphPlatform = (station: string, piece: number, s0: number, s1: number) => {
    const st = graph.stations.find((s) => s.name === station);
    return st?.platforms.find((p) => p.tracks.some((t) => t.piece === piece && t.s0 < s1 && t.s1 > s0)) ?? null;
  };
  for (const [id, g] of Object.entries(geometry.pieces)) {
    for (const pl of g.platforms) {
      const edge: XZ[] = [], back: XZ[] = [];
      let ySum = 0, n = 0;
      const out = pl.side * (PLATFORM_EDGE + (pl.island ? pl.width / 2 : pl.width));
      const at = (s: number) => {
        // the point at s along the piece, and the way it runs there
        let k = 0;
        while (k + 2 < g.s.length && g.s[k + 1] < s) k++;
        const t = Math.max(0, Math.min(1, (s - g.s[k]) / (g.s[k + 1] - g.s[k] || 1)));
        const x = g.x[k] + (g.x[k + 1] - g.x[k]) * t, z = g.z[k] + (g.z[k + 1] - g.z[k]) * t;
        const dx = g.x[k + 1] - g.x[k], dz = g.z[k + 1] - g.z[k], l = Math.hypot(dx, dz) || 1;
        // to the right looking along the piece
        const rx = -dz / l, rz = dx / l;
        edge.push([x + rx * pl.side * PLATFORM_EDGE, z + rz * pl.side * PLATFORM_EDGE]);
        back.push([x + rx * out, z + rz * out]);
        ySum += g.y[k] + (g.y[k + 1] - g.y[k]) * t; n++;
      };
      at(pl.s0);
      for (let k = 0; k < g.s.length; k++) if (g.s[k] > pl.s0 && g.s[k] < pl.s1) at(g.s[k]);
      at(pl.s1);
      const outline = [...edge, ...back.reverse()];
      const gp = graphPlatform(pl.station, Number(id), pl.s0, pl.s1);
      const key = gp ? `${pl.station}|${gp.osm}` : `${pl.station}|${id}|${pl.s0}`;
      let p = platforms.get(key);
      if (!p) {
        const pieceIds = gp ? gp.tracks.map((t) => t.piece) : [Number(id)];
        const tracks = pieceIds.map((pc) => calls.get(`${pl.station}|${pc}`) ?? []).filter((c) => c.length);
        // the same calls on two tracks (both ways from the end of a line) once
        const seen = new Set<string>();
        platforms.set(key, p = {
          station: pl.station, strips: [], box: box(outline), y: 0,
          tracks: tracks.filter((c) => { const k = c.map((x) => x.number + x.dest).join(); return !seen.has(k) && seen.add(k); }),
        });
      }
      p.strips.push({ outline, path: polygon(outline) });
      p.y = ySum / n + 1; // the floor is about a metre over the rail
      p.box = box([[p.box.x0, p.box.z0], [p.box.x1, p.box.z1], ...outline]);
    }
  }

  // ---------------------------------------------------------------- the stations' plans
  const plans: StationPlan[] = (layouts?.stations ?? []).map(plan);

  // ---------------------------------------------------------------- the stations
  const linesAt = new Map<string, Set<LineId>>();
  for (const r of graph.routes) for (const st of r.stops) (linesAt.get(st.station) ?? linesAt.set(st.station, new Set()).get(st.station)!).add(r.line as LineId);
  const middle = new Map((layouts?.stations ?? []).map((s) => [s.name, s]));
  const order = Object.keys(LINES);
  const stations: MapStation[] = graph.stations.map((s) => {
    // the middle of its platforms where the station is described, else its node in the map data
    const m = middle.get(s.name);
    const lines = [...(linesAt.get(s.name) ?? [])].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return { name: s.name, x: m?.x ?? s.x, z: m?.z ?? s.z, lines };
  });

  const all = graph.pieces.flatMap((p) => p.points);
  return { tracks, platforms: [...platforms.values()], plans, stations, box: box(all) };
}

function plan(st: StationLayout): StationPlan {
  const parts: PlanPart[] = [];
  const pts: XZ[] = [];
  for (const p of st.parts) {
    if (p.kind === 'floor') {
      const c = p.corners.map(([x, , z]): XZ => [x, z]);
      const ys = p.corners.map((q) => q[1]);
      parts.push({ kind: p.room, path: polygon(c), y0: Math.min(...ys), y1: Math.max(...ys) });
      pts.push(...c);
    } else if (p.kind === 'incline') {
      const c = inclineCorners(p);
      parts.push({ kind: p.lanes.includes('E') ? 'escalator' : 'stairs', path: polygon(c), y0: Math.min(p.a[1], p.b[1]), y1: Math.max(p.a[1], p.b[1]) });
      pts.push(...c);
    } else if (p.kind === 'lift') {
      parts.push({ kind: 'lift', path: polygon(liftCorners(p)), y0: Math.min(...p.levels), y1: Math.max(...p.levels) });
    }
  }
  // the halls and passages under the stairs, the lifts over all
  const rank = { platform: 0, hall: 1, passage: 2, stairs: 3, escalator: 3, lift: 4 };
  parts.sort((a, b) => rank[a.kind] - rank[b.kind]);
  return { name: st.name, box: pts.length ? box(pts, 2) : box([[st.x, st.z]], 10), parts, exits: st.exits.map((e) => ({ x: e.x, z: e.z })) };
}
