// Builds the metro's stations from their descriptions: data/station-descriptions.json
// -> public/data/station-layouts.json (format in src/station-layout.ts), which the game builds
// (src/stations.ts).
//
//   node tools/build-stations.ts                  build them all, and check them
//   node tools/build-stations.ts --frame Slussen  print a station's frame, for writing its description
//
// A description gives each way through the station as a route of steps, starting on the platform:
// walk to a point, stairs or escalators up or down, a lift, ticket gates, and an exit at one of
// OpenStreetMap's subway entrances. Points are [s, u] in the station's frame: s metres along the
// platforms from their middle (towards `axis`, by default north or east), u metres to the right.
// Heights are metres above the platform. An exit comes up to the street at the entrance, at the
// height of the ground there (data/ground/entrances.json, from tools/fetch-ground.ts).
//
// The build fails on:
// - a step that can't be made: stairs that don't fit before their point, an exit too close
// - a part that runs into the trains' space over a track
// - a platform from which the street can't be walked to, or an exit that can't be reached
import { readFileSync, writeFileSync } from 'node:fs';
import { subtractAll } from '../src/clip.ts';
import type { Volume } from '../src/clip.ts';
import { STRUCTURE_KINDS } from '../src/track-geometry.ts';
import type { GeometryPiece, TrackGeometry } from '../src/track-geometry.ts';
import type { TrackGraph } from '../src/track-graph.ts';
import { HALL, BOX, ISLAND_WIDTH, PLATFORM_EDGE, PLATFORM_HEIGHT } from '../src/sections.ts';
import { CANOPY_HEIGHT, ESCALATOR_SLOPE, LANE, STAIR_SLOPE, floorHeights, inclineCorners, solidOf, spaceOf } from '../src/station-layout.ts';
import type { CanopyPart, Exit, FloorPart, InclinePart, Part, StationLayout, StreetPart, VoidPart, XYZ } from '../src/station-layout.ts';
import { interp } from './lib/graph.ts';

const DESCRIPTIONS = 'data/station-descriptions.json';
const OUT = 'public/data/station-layouts.json';

type SU = [number, number];
type Segment =
  | { walk: SU | number; width?: number; dh?: number; ceiling?: number; open?: boolean }
  | { stairs: number; toward?: SU; to?: SU; lanes?: string; ceiling?: number }
  | { escalators: number; toward?: SU; to?: SU; lanes?: string; ceiling?: number }
  | { lift: number; above?: number; through?: boolean }
  | { gates: true }
  | { mark: string }
  | { exit: number | string | { at: SU; name?: string }; by?: 'stairs' | 'escalators' | 'walk' | 'lift'; lanes?: string; ceiling?: number; open?: boolean };
interface RouteDesc { from: SU | string; h?: number; width?: number; go: Segment[] }
interface Description {
  drawing?: string;
  note?: string;
  axis?: 'north' | 'south' | 'east' | 'west';
  canopy?: boolean;
  routes: RouteDesc[];
}

const graph: TrackGraph = JSON.parse(readFileSync('public/data/track-graph.json', 'utf8'));
const geometry: TrackGeometry = JSON.parse(readFileSync('public/data/track-geometry.json', 'utf8'));
interface Patch { x: number; z: number; h: (number | null)[] }
interface Entrance extends Patch { osm: number; name: string | null; station: string }
const ground: { step: number; size: number; stationSize: number; entrances: Entrance[]; stations: (Patch & { station: string })[] }
  = JSON.parse(readFileSync('data/ground/entrances.json', 'utf8'));
const descriptions: Record<string, Description> = JSON.parse(readFileSync(DESCRIPTIONS, 'utf8')).stations;

const r2 = (n: number) => Math.round(n * 100) / 100;
const p3 = (p: XYZ): XYZ => [r2(p[0]), r2(p[1]), r2(p[2])];

// ------------------------------------------------------------------ the station's frame
interface PlatformTrack { piece: number; g: GeometryPiece; s0: number; s1: number; side: 1 | -1; width: number; island: boolean }

function platformTracks(name: string): PlatformTrack[] {
  const out: PlatformTrack[] = [];
  for (const [id, g] of Object.entries(geometry.pieces)) {
    for (const p of g.platforms) if (p.station === name) out.push({ piece: Number(id), g, s0: p.s0, s1: p.s1, side: p.side, width: p.width, island: p.island });
  }
  return out;
}

const at = (g: GeometryPiece, s: number) => ({ x: interp(g.s, g.x, s), z: interp(g.s, g.z, s), y: interp(g.s, g.y, s) });
function tangentAt(g: GeometryPiece, s: number) {
  const a = at(g, s - 5), b = at(g, s + 5), l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { tx: (b.x - a.x) / l, tz: (b.z - a.z) / l };
}

interface Frame { x: number; z: number; y: number; tx: number; tz: number }
function frameOf(name: string, axis?: Description['axis']): Frame {
  const tracks = platformTracks(name);
  if (!tracks.length) throw new Error(`${name}: no platform in the track geometry`);
  let x = 0, z = 0, y = 0;
  for (const t of tracks) {
    const m = at(t.g, (t.s0 + t.s1) / 2);
    x += m.x; z += m.z; y += m.y;
  }
  x /= tracks.length; z /= tracks.length; y /= tracks.length;
  let { tx, tz } = tangentAt(tracks[0].g, (tracks[0].s0 + tracks[0].s1) / 2);
  const want = axis ?? (Math.abs(tz) > Math.abs(tx) ? 'north' : 'east');
  const [wx, wz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[want];
  if (tx * wx + tz * wz < 0) { tx = -tx; tz = -tz; }
  return { x, z, y: y + PLATFORM_HEIGHT, tx, tz };
}
// [s, u] to world x, z; u is to the right of +s
const world = (f: Frame, [s, u]: SU): [number, number] => [f.x + f.tx * s - f.tz * u, f.z + f.tz * s + f.tx * u];
const local = (f: Frame, x: number, z: number): SU => [f.tx * (x - f.x) + f.tz * (z - f.z), -f.tz * (x - f.x) + f.tx * (z - f.z)];

// ------------------------------------------------------------------ the street
// The ground around the entrances and the stations, from their squares of samples.
function patchHeight(e: Patch, x: number, z: number) {
  const n = Math.round(Math.sqrt(e.h.length)), half = ((n - 1) / 2) * ground.step;
  const fx = (x - e.x + half) / ground.step, fz = (z - e.z + half) / ground.step;
  if (fx < 0 || fz < 0 || fx > n - 1 || fz > n - 1) return null;
  const i = Math.min(n - 2, Math.floor(fz)), j = Math.min(n - 2, Math.floor(fx)), a = fz - i, b = fx - j;
  const h = (ii: number, jj: number) => e.h[ii * n + jj];
  const v = [h(i, j), h(i, j + 1), h(i + 1, j), h(i + 1, j + 1)];
  if (v.some((q) => q === null)) return null;
  return (v[0]! * (1 - b) + v[1]! * b) * (1 - a) + (v[2]! * (1 - b) + v[3]! * b) * a;
}

// the ground at x, z: from the nearest entrance's square that covers it, or the station's
function groundAt(station: string, x: number, z: number) {
  const near = ground.entrances.map((e) => ({ e, d: Math.max(Math.abs(e.x - x), Math.abs(e.z - z)) })).sort((a, b) => a.d - b.d);
  for (const { e } of near.slice(0, 3)) {
    const h = patchHeight(e, x, z);
    if (h !== null) return h;
  }
  const st = ground.stations.find((p) => p.station === station);
  return st ? patchHeight(st, x, z) : null;
}

// One grid of ground per group of exits near each other, 4 m apart on the world grid, out to
// STREET m from each exit.
const STREET = 30, STREET_STEP = 4;
function streets(station: string, exits: { x: number; z: number }[]): StreetPart[] {
  const groups: (typeof exits)[] = [];
  for (const e of exits) {
    const near = groups.filter((g) => g.some((o) => Math.hypot(o.x - e.x, o.z - e.z) < 2 * STREET + 10));
    const merged = [e, ...near.flat()];
    for (const g of near) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  return groups.map((g) => {
    const x0 = Math.floor((Math.min(...g.map((e) => e.x)) - STREET) / STREET_STEP) * STREET_STEP;
    const z0 = Math.floor((Math.min(...g.map((e) => e.z)) - STREET) / STREET_STEP) * STREET_STEP;
    const x1 = Math.ceil((Math.max(...g.map((e) => e.x)) + STREET) / STREET_STEP) * STREET_STEP;
    const z1 = Math.ceil((Math.max(...g.map((e) => e.z)) + STREET) / STREET_STEP) * STREET_STEP;
    const nx = (x1 - x0) / STREET_STEP + 1, nz = (z1 - z0) / STREET_STEP + 1;
    const h: (number | null)[] = [];
    for (let i = 0; i < nz; i++) {
      for (let j = 0; j < nx; j++) {
        const x = x0 + j * STREET_STEP, z = z0 + i * STREET_STEP;
        const near = g.some((e) => Math.max(Math.abs(e.x - x), Math.abs(e.z - z)) <= STREET);
        const v = near ? groundAt(station, x, z) : null;
        h.push(v === null ? null : r2(v));
      }
    }
    return { kind: 'street', x0, z0, step: STREET_STEP, nx, nz, h };
  });
}

function streetHeight(parts: Part[], x: number, z: number) {
  for (const p of parts) {
    if (p.kind !== 'street') continue;
    const fx = (x - p.x0) / p.step, fz = (z - p.z0) / p.step;
    if (fx < 0 || fz < 0 || fx > p.nx - 1 || fz > p.nz - 1) continue;
    const i = Math.min(p.nz - 2, Math.floor(fz)), j = Math.min(p.nx - 2, Math.floor(fx)), a = fz - i, b = fx - j;
    const v = [p.h[i * p.nx + j], p.h[i * p.nx + j + 1], p.h[(i + 1) * p.nx + j], p.h[(i + 1) * p.nx + j + 1]];
    if (v.some((q) => q === null)) continue;
    return (v[0]! * (1 - b) + v[1]! * b) * (1 - a) + (v[2]! * (1 - b) + v[3]! * b) * a;
  }
  return null;
}

// ------------------------------------------------------------------ routes
const CEILING = { passage: 3.0, hall: 3.6, incline: 3.4 };
const HALL_WIDTH = 7;

class Problems {
  list: string[] = [];
  add(msg: string) { this.list.push(msg); }
}

// an exit's entrance: OpenStreetMap's, by its id or name, or a point in the frame
function entranceOf(station: string, f: Frame, ref: number | string | { at: SU; name?: string }): { x: number; z: number; name: string | null } {
  if (typeof ref === 'object') {
    const [x, z] = world(f, ref.at);
    return { x, z, name: ref.name ?? null };
  }
  const all = ground.entrances.filter((e) => (typeof ref === 'number' ? e.osm === ref : e.name === ref));
  const mine = all.filter((e) => e.station === station);
  const list = mine.length ? mine : all;
  if (list.length !== 1) throw new Error(`${station}: ${list.length} entrances match ${JSON.stringify(ref)}`);
  return list[0];
}

function buildStation(name: string, d: Description, problems: Problems): StationLayout {
  const f = frameOf(name, d.axis);
  const parts: Part[] = [];
  const exits: Exit[] = [];
  const exitEntrances: { x: number; z: number }[] = [];
  // the street comes first: exits need its height
  for (const r of d.routes) for (const sg of r.go) if ('exit' in sg) exitEntrances.push(entranceOf(name, f, sg.exit));
  parts.push(...streets(name, exitEntrances));

  const marks = new Map<string, { x: number; z: number; y: number; hx: number; hz: number; width: number }>();
  for (const [ri, r] of d.routes.entries()) {
    const where = `${name}, route ${ri + 1}`;
    let x: number, z: number, y: number, hx = 0, hz = 0, width = r.width ?? 4;
    if (typeof r.from === 'string') {
      const m = marks.get(r.from);
      if (!m) throw new Error(`${where}: no mark called ${r.from}`);
      ({ x, z, y, hx, hz } = m);
      width = r.width ?? m.width;
    } else {
      [x, z] = world(f, r.from);
      y = f.y + (r.h ?? 0);
    }
    // the last step's kind and heading, for the joints between steps
    let last: 'walk' | 'incline' | null = null;
    const joint = (nx: number, nz: number, w: number, ceiling: number = CEILING.passage) => {
      if (!last || hx * nx + hz * nz > Math.cos((10 * Math.PI) / 180)) return;
      // a square landing where the way turns, so that the corner is floored
      const s = Math.max(w, width) / 2;
      const rx = -hz, rz = hx;
      const corners: XYZ[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [x + hx * s * i + rx * s * j, y, z + hz * s * i + rz * s * j]);
      parts.push({ kind: 'floor', corners: corners.map(p3), ceiling, room: 'passage', label: `${name} · passage` });
    };
    const walkTo = (tx: number, tz: number, dh = 0, ceiling?: number, open = false) => {
      const dx = tx - x, dz = tz - z, l = Math.hypot(dx, dz);
      if (l < 0.01) return;
      const nx = dx / l, nz = dz / l;
      if (Math.abs(dh) / l > 1 / 12 + 1e-6) problems.add(`${where}: a ramp of ${(Math.abs(dh) / l * 100).toFixed(0)}% (at most 8%)`);
      // (the landing as high as the way on from it)
      joint(nx, nz, width, open ? undefined : ceiling);
      const rx = -nz * width / 2, rz = nx * width / 2;
      const room = open ? 'platform' : width >= HALL_WIDTH ? 'hall' : 'passage';
      parts.push({
        kind: 'floor',
        corners: [[x - rx, y, z - rz], [x + rx, y, z + rz], [tx + rx, y + dh, tz + rz], [tx - rx, y + dh, tz - rz]].map((p) => p3(p as XYZ)),
        ceiling: open ? null : ceiling ?? CEILING[room as 'hall' | 'passage'], room,
        label: `${name} · ${{ platform: 'platform', hall: 'ticket hall', passage: 'passage' }[room]}`,
      });
      x = tx; z = tz; y += dh; hx = nx; hz = nz; last = 'walk';
    };
    // stairs or escalators climbing dh (down if negative) from here, heading (nx, nz)
    const incline = (kind: 'stairs' | 'escalators', dh: number, nx: number, nz: number, lanes: string, ceiling = CEILING.incline, open?: number) => {
      const slope = kind === 'stairs' ? STAIR_SLOPE : ESCALATOR_SLOPE;
      const run = Math.abs(dh) / slope;
      const w = [...lanes].reduce((a, c) => a + LANE[c as keyof typeof LANE], 0);
      joint(nx, nz, w);
      const ex = x + nx * run, ez = z + nz * run;
      const lo: XYZ = dh > 0 ? [x, y, z] : [ex, y + dh, ez];
      const hi: XYZ = dh > 0 ? [ex, y + dh, ez] : [x, y, z];
      // lanes are listed from the left looking up
      parts.push({ kind: 'incline', a: p3(lo), b: p3(hi), width: w, lanes: dh > 0 ? lanes : [...lanes].reverse().join(''), ceiling, ...(open === undefined ? {} : { open: r2(open) }), label: `${name} · ${kind}` });
      x = ex; z = ez; y += dh; hx = nx; hz = nz; last = 'incline';
    };
    const heading = (to: SU | undefined) => {
      if (!to) {
        if (!last) throw new Error(`${where}: an incline with no direction`);
        return [hx, hz];
      }
      const [tx, tz] = world(f, to), l = Math.hypot(tx - x, tz - z);
      return [(tx - x) / l, (tz - z) / l];
    };
    for (const sg of r.go) {
      if ('walk' in sg) {
        if (sg.width) width = sg.width;
        if (typeof sg.walk === 'number') walkTo(x + hx * sg.walk, z + hz * sg.walk, sg.dh ?? 0, sg.ceiling, sg.open);
        else walkTo(...world(f, sg.walk), sg.dh ?? 0, sg.ceiling, sg.open);
      } else if ('stairs' in sg || 'escalators' in sg) {
        const kind = 'stairs' in sg ? 'stairs' : 'escalators';
        const dh = 'stairs' in sg ? sg.stairs : sg.escalators;
        const lanes = sg.lanes ?? (kind === 'stairs' ? 'S'.repeat(Math.max(1, Math.round(width / LANE.S))) : 'EE');
        if (sg.to) {
          // stairs that end at the point: walk on first to where they must start
          const [tx, tz] = world(f, sg.to), l = Math.hypot(tx - x, tz - z);
          const run = Math.abs(dh) / (kind === 'stairs' ? STAIR_SLOPE : ESCALATOR_SLOPE);
          if (l < run - 0.5) problems.add(`${where}: ${kind} of ${dh} m need ${run.toFixed(1)} m to ${JSON.stringify(sg.to)}, but it is ${l.toFixed(1)} m away`);
          if (l > run + 0.1) walkTo(x + ((tx - x) / l) * (l - run), z + ((tz - z) / l) * (l - run));
          incline(kind, dh, (tx - x) / l || hx, (tz - z) / l || hz, lanes, sg.ceiling);
        } else {
          const [nx, nz] = heading(sg.toward);
          incline(kind, dh, nx, nz, lanes, sg.ceiling);
        }
      } else if ('lift' in sg) {
        // the shaft just beyond where the way ends, its door facing back along it (and, walked
        // through, on the far side at the other stop, where the way goes on)
        const yaw = Math.atan2(hx, hz);
        const dist = 0.3 + 2.4 / 2;
        parts.push({
          kind: 'lift', x: r2(x + hx * dist), z: r2(z + hz * dist), yaw: r2(yaw), levels: [r2(y), r2(y + sg.lift)],
          ...(sg.above === undefined ? {} : { above: sg.above }), ...(sg.through ? { through: true } : {}),
        });
        y += sg.lift;
        // (from just inside its far side, where the car hides the floor's end)
        if (sg.through) { x += hx * (dist + 0.7); z += hz * (dist + 0.7); }
      } else if ('gates' in sg) {
        parts.push({ kind: 'gates', x: r2(x), y: r2(y), z: r2(z), yaw: r2(Math.atan2(-hx, -hz)), width: r2(width) });
      } else if ('mark' in sg) {
        marks.set(sg.mark, { x, z, y, hx, hz, width });
      } else if ('exit' in sg) {
        const e = entranceOf(name, f, sg.exit);
        const ey = streetHeight(parts, e.x, e.z);
        if (ey === null) throw new Error(`${where}: no ground at entrance ${sg.exit}`);
        const by = sg.by ?? 'stairs';
        const dh = ey - y, l = Math.hypot(e.x - x, e.z - z);
        const nx = l > 0.01 ? (e.x - x) / l : hx, nz = l > 0.01 ? (e.z - z) / l : hz;
        if (by === 'walk') walkTo(e.x, e.z, dh, sg.ceiling, sg.open);
        else if (by === 'lift') {
          walkTo(e.x, e.z);
          const yaw = Math.atan2(hx, hz);
          parts.push({ kind: 'lift', x: r2(x + hx * 1.5), z: r2(z + hz * 1.5), yaw: r2(yaw), levels: [r2(y), r2(ey)] });
          y = ey;
        } else {
          const run = Math.abs(dh) / (by === 'stairs' ? STAIR_SLOPE : ESCALATOR_SLOPE);
          if (l < run - 0.5) problems.add(`${where}: the exit ${sg.exit} is ${l.toFixed(1)} m away, and ${by} up ${dh.toFixed(1)} m need ${run.toFixed(1)} m`);
          if (l > run + 0.1) walkTo(x + nx * (l - run), z + nz * (l - run));
          const lanes = sg.lanes ?? (by === 'stairs' ? 'S'.repeat(Math.max(1, Math.round(width / LANE.S))) : 'EES');
          incline(by, dh, nx, nz, lanes, CEILING.incline, ey);
        }
        const yaw = Math.atan2(-hx, -hz);
        const label = e.name ?? name;
        exits.push({ name: label, x: r2(x), y: r2(y), z: r2(z), yaw: r2(yaw) });
        // the sign beside the way down, facing the street
        const rx = -hz, rz = hx;
        parts.push({ kind: 'sign', x: r2(x + rx * 3), y: r2(y), z: r2(z + rz * 3), yaw: r2(yaw), text: name });
      }
    }
  }
  parts.push(...hallVoids(name), ...canopies(name, d));
  return { name, x: r2(f.x), z: r2(f.z), yaw: +Math.atan2(-f.tx, -f.tz).toFixed(5), platformY: r2(f.y), parts, exits };
}

// The insides of the platform halls the network draws, in 10 m pieces along each platform track:
// from the track's far side to the wall behind the platform, up to where the vault or the roof
// begins.
function hallVoids(name: string): VoidPart[] {
  const out: VoidPart[] = [];
  for (const t of platformTracks(name)) {
    const { g } = t;
    for (let k = 0; k + 1 < g.s.length; k++) {
      if (g.s[k + 1] < t.s0 || g.s[k] > t.s1) continue;
      const kind = STRUCTURE_KINDS[g.kind[k]];
      if (kind !== 'rock' && kind !== 'box') continue;
      const ends = [k, k + 1].map((i) => {
        const a = Math.max(0, i - 1), b = Math.min(g.s.length - 1, i + 1), l = Math.hypot(g.x[b] - g.x[a], g.z[b] - g.z[a]) || 1;
        return { x: g.x[i], z: g.z[i], y: g.y[i], rx: -(g.z[b] - g.z[a]) / l, rz: (g.x[b] - g.x[a]) / l };
      });
      const lo = -t.side * 2.0, hi = t.side * (PLATFORM_EDGE + t.width + HALL.behindPlatform - 0.05);
      const corners: [number, number][] = [
        [ends[0].x + ends[0].rx * lo, ends[0].z + ends[0].rz * lo], [ends[0].x + ends[0].rx * hi, ends[0].z + ends[0].rz * hi],
        [ends[1].x + ends[1].rx * hi, ends[1].z + ends[1].rz * hi], [ends[1].x + ends[1].rx * lo, ends[1].z + ends[1].rz * lo],
      ];
      const y = Math.min(ends[0].y, ends[1].y);
      const top = kind === 'rock' ? HALL.spring : BOX.height;
      out.push({ kind: 'void', corners: corners.map(([a, b]) => [r2(a), r2(b)]), y0: r2(y - 0.55), y1: r2(Math.max(ends[0].y, ends[1].y) + top - 0.05) });
    }
  }
  return out;
}

// Roofs over the platforms out in the open, unless the description says there are none.
function canopies(name: string, d: Description): CanopyPart[] {
  if (d.canopy === false) return [];
  const out: CanopyPart[] = [];
  for (const t of platformTracks(name)) {
    const { g } = t;
    const points: XYZ[] = [];
    for (let k = 0; k < g.s.length; k++) {
      if (g.s[k] < t.s0 || g.s[k] > t.s1) continue;
      const kind = STRUCTURE_KINDS[g.kind[k]];
      if (kind === 'rock' || kind === 'box') continue;
      const a = Math.max(0, k - 1), b = Math.min(g.s.length - 1, k + 1), l = Math.hypot(g.x[b] - g.x[a], g.z[b] - g.z[a]) || 1;
      const u = t.side * (PLATFORM_EDGE + t.width / 2);
      points.push(p3([g.x[k] - ((g.z[b] - g.z[a]) / l) * u, g.y[k] + PLATFORM_HEIGHT + CANOPY_HEIGHT, g.z[k] + ((g.x[b] - g.x[a]) / l) * u]));
    }
    if (points.length < 2) continue;
    const mid = points[Math.floor(points.length / 2)];
    // an island platform has a track on each side: one roof (its points needn't fall at the same
    // places along the two tracks)
    if (out.some((c) => c.points.some((p, i) => i > 0 && segmentDistance(mid, c.points[i - 1], p) < 4))) continue;
    out.push({ kind: 'canopy', points, width: r2(Math.min(t.width, ISLAND_WIDTH + 4) - 0.6) });
  }
  return out;
}

// how far p is from the segment a–b, across the ground
function segmentDistance(p: XYZ, a: XYZ, b: XYZ) {
  const dx = b[0] - a[0], dz = b[2] - a[2], l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / l2));
  return Math.hypot(p[0] - a[0] - dx * t, p[2] - a[2] - dz * t);
}

// ------------------------------------------------------------------ checks
// Nothing may stand in the trains' way: over each track, from the ballast up to the top of the
// trains, this far either side of the centre line.
const TRAIN = { half: 1.5, below: 0.6, above: 4.0 };

function checkClearance(st: StationLayout, problems: Problems) {
  const near = Object.values(geometry.pieces).filter((g) => g.x.some((x, k) => Math.hypot(x - st.x, g.z[k] - st.z) < 600));
  for (const p of st.parts) {
    if (p.kind !== 'floor' && p.kind !== 'incline') continue;
    if (p.kind === 'floor' && p.room === 'platform') continue;
    const vol = spaceOf(p)!;
    const corners = p.kind === 'floor' ? p.corners.map((c): [number, number] => [c[0], c[2]]) : inclineCorners(p);
    const h = floorHeights(p);
    const bottom = Math.min(...h) - 0.6, top = vol.max[1] + 0.3;
    for (const g of near) {
      for (let k = 0; k + 1 < g.s.length; k++) {
        const n = Math.ceil(Math.hypot(g.x[k + 1] - g.x[k], g.z[k + 1] - g.z[k]) / 1);
        for (let j = 0; j < n; j++) {
          const t = j / n, x = g.x[k] + (g.x[k + 1] - g.x[k]) * t, z = g.z[k] + (g.z[k + 1] - g.z[k]) * t, y = g.y[k] + (g.y[k + 1] - g.y[k]) * t;
          if (y + TRAIN.above < bottom || y - TRAIN.below > top) continue;
          if (distToPolygon(x, z, corners) > TRAIN.half) continue;
          // the part's own floor and ceiling where the track passes
          const fy = heightOn(p, x, z);
          const c = p.kind === 'floor' ? (p.ceiling ?? 3) : p.ceiling;
          if (fy - 0.6 > y + TRAIN.above || fy + c + 0.3 < y - TRAIN.below) continue;
          // where, in the station's frame
          const tx = -Math.sin(st.yaw), tz = -Math.cos(st.yaw), dx = x - st.x, dz = z - st.z;
          const su = `[${(tx * dx + tz * dz).toFixed(0)}, ${(-tz * dx + tx * dz).toFixed(0)}]`;
          problems.add(`${st.name}: ${p.label} runs into the trains' space over the track at ${x.toFixed(0)}, ${z.toFixed(0)}, ${su} in its frame (rail ${y.toFixed(1)} m, floor ${fy.toFixed(1)} m)`);
          j = n; k = g.s.length;
        }
      }
    }
  }
}

function distToPolygon(x: number, z: number, poly: [number, number][]) {
  let inside = false, best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j], [bx, bz] = poly[i];
    if ((az > z) !== (bz > z) && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return inside ? 0 : best;
}

// the height of a floor's or incline's surface over x, z (its plane)
function heightOn(p: FloorPart | InclinePart, x: number, z: number) {
  if (p.kind === 'incline') {
    const dx = p.b[0] - p.a[0], dz = p.b[2] - p.a[2], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - p.a[0]) * dx + (z - p.a[2]) * dz) / l2));
    return p.a[1] + (p.b[1] - p.a[1]) * t;
  }
  const [a, b, , d] = p.corners;
  const ux = b[0] - a[0], uz = b[2] - a[2], vx = d[0] - a[0], vz = d[2] - a[2];
  const det = ux * vz - uz * vx || 1;
  const s = ((x - a[0]) * vz - (z - a[2]) * vx) / det, t = (ux * (z - a[2]) - uz * (x - a[0])) / det;
  return a[1] + (b[1] - a[1]) * s + (d[1] - a[1]) * t;
}

// Walks the station: every walkable point on a 0.5 m grid, joined to its neighbours where the
// step between them is small, from the platforms out. Every platform must reach the street, and
// every exit be reached. Floors are cut as in the game: by the open space of stairs and lifts
// that pass through them, and under stairs.
const CELL = 0.5, STEP = 0.6;
type Tri = [number, number, number][];

function checkWalk(st: StationLayout, problems: Problems) {
  const tris: { tri: Tri; platform: boolean }[] = [];
  const parts = st.parts;
  const cutters: Volume[] = [], solids: Volume[] = [];
  for (const p of parts) {
    if (p.kind === 'incline') { cutters.push(spaceOf(p)!); solids.push(solidOf(p)); }
    if (p.kind === 'lift') cutters.push(spaceOf(p)!);
  }
  const add = (tri: Tri, cut: boolean, platform = false) => {
    const vols = cut ? [...cutters, ...solids] : [];
    for (const piece of subtractAll(tri, vols)) {
      for (let k = 1; k + 1 < piece.length; k++) tris.push({ tri: [piece[0], piece[k], piece[k + 1]] as Tri, platform });
    }
  };
  for (const p of parts) {
    if (p.kind === 'floor') {
      const c = p.corners;
      add([c[0], c[1], c[2]], true); add([c[0], c[2], c[3]], true);
    } else if (p.kind === 'incline') {
      const c = inclineCorners(p), h = floorHeights(p);
      const v = c.map(([x, z], i): [number, number, number] => [x, h[i], z]);
      add([v[0], v[1], v[2]], false); add([v[0], v[2], v[3]], false);
    } else if (p.kind === 'street') {
      for (let i = 0; i + 1 < p.nz; i++) for (let j = 0; j + 1 < p.nx; j++) {
        const q = [[i, j], [i, j + 1], [i + 1, j + 1], [i + 1, j]].map(([a, b]) => [p.x0 + b * p.step, p.h[a * p.nx + b], p.z0 + a * p.step]);
        if (q.some((v) => v[1] === null)) continue;
        const v = q as [number, number, number][];
        add([v[0], v[1], v[2]], true); add([v[0], v[2], v[3]], true);
      }
    }
  }
  // the platforms, from the track geometry, as the network draws them
  for (const t of platformTracks(st.name)) {
    const { g } = t;
    const pts: { e: [number, number, number]; o: [number, number, number] }[] = [];
    const ss = [t.s0, ...g.s.filter((s) => s > t.s0 && s < t.s1), t.s1];
    for (const s of ss) {
      const c = at(g, s), { tx, tz } = tangentAt(g, s), rx = -tz, rz = tx;
      const e = t.side * PLATFORM_EDGE, o = t.side * (PLATFORM_EDGE + t.width), y = c.y + PLATFORM_HEIGHT;
      pts.push({ e: [c.x + rx * e, y, c.z + rz * e], o: [c.x + rx * o, y, c.z + rz * o] });
    }
    for (let k = 0; k + 1 < pts.length; k++) {
      add([pts[k].e, pts[k].o, pts[k + 1].o], true, true);
      add([pts[k].e, pts[k + 1].o, pts[k + 1].e], true, true);
    }
  }
  // the grid
  const cells = new Map<string, { y: number; platform: boolean; id: number }[]>();
  let ids = 0;
  for (const { tri, platform } of tris) {
    const [a, b, c] = tri;
    const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(det) < 1e-9) continue;
    const x0 = Math.floor(Math.min(a[0], b[0], c[0]) / CELL), x1 = Math.ceil(Math.max(a[0], b[0], c[0]) / CELL);
    const z0 = Math.floor(Math.min(a[2], b[2], c[2]) / CELL), z1 = Math.ceil(Math.max(a[2], b[2], c[2]) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const x = i * CELL, z = j * CELL;
      const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
      const l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const y = l1 * a[1] + l2 * b[1] + l3 * c[1];
      const key = `${i},${j}`;
      const list = cells.get(key) ?? [];
      if (!list.some((q) => Math.abs(q.y - y) < 0.05)) list.push({ y, platform, id: ids++ });
      else if (platform) list.find((q) => Math.abs(q.y - y) < 0.05)!.platform = true;
      cells.set(key, list);
    }
  }
  // lifts join their levels
  const liftLinks: { at: { x: number; z: number; y: number }[] }[] = [];
  for (const p of parts) if (p.kind === 'lift') {
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    liftLinks.push({ at: p.levels.map((y, i) => { const k = p.through && i === 1 ? -2 : 2; return { x: p.x + fx * k, z: p.z + fz * k, y }; }) });
  }
  // flood from one platform point; then every platform point, and every exit, must be reached
  const reached = new Set<number>();
  const nodeAt = (x: number, z: number, y: number, tol = 0.3) => {
    const list = cells.get(`${Math.round(x / CELL)},${Math.round(z / CELL)}`) ?? [];
    return list.find((q) => Math.abs(q.y - y) < tol) ?? null;
  };
  const flood = (startKey: string, start: { id: number }) => {
    const queue: [string, number][] = [[startKey, start.id]];
    reached.add(start.id);
    while (queue.length) {
      const [key, id] = queue.pop()!;
      const [i, j] = key.split(',').map(Number);
      const me = cells.get(key)!.find((q) => q.id === id)!;
      const next: [string, { id: number; y: number }][] = [];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k2 = `${i + di},${j + dj}`;
        for (const q of cells.get(k2) ?? []) if (Math.abs(q.y - me.y) <= STEP) next.push([k2, q]);
      }
      for (const l of liftLinks) {
        if (!l.at.some((a) => Math.hypot(i * CELL - a.x, j * CELL - a.z) <= 1.5 && Math.abs(a.y - me.y) < 0.3)) continue;
        for (const a of l.at) {
          const q = nodeAt(a.x, a.z, a.y, 0.5);
          if (q) next.push([`${Math.round(a.x / CELL)},${Math.round(a.z / CELL)}`, q]);
        }
      }
      for (const [k2, q] of next) if (!reached.has(q.id)) { reached.add(q.id); queue.push([k2, q.id]); }
    }
  };
  const platformNodes: { key: string; node: { id: number; y: number } }[] = [];
  for (const [key, list] of cells) for (const q of list) if (q.platform) platformNodes.push({ key, node: q });
  if (!platformNodes.length) { problems.add(`${st.name}: no platform to walk on`); return; }
  // each platform track, from near its middle (not under stairs), flooded in turn
  for (const t of platformTracks(st.name)) {
    let start: { id: number; y: number } | null = null, px = 0, pz = 0;
    for (const ds of [0, 10, -10, 20, -20, 30, -30]) {
      const sm = (t.s0 + t.s1) / 2 + ds;
      const c = at(t.g, sm), { tx, tz } = tangentAt(t.g, sm);
      const u = t.side * (PLATFORM_EDGE + Math.min(1.5, t.width / 2));
      px = c.x - tz * u; pz = c.z + tx * u;
      start = nodeAt(px, pz, c.y + PLATFORM_HEIGHT, 0.5);
      if (start) break;
    }
    if (!start) { problems.add(`${st.name}: no floor on the platform beside piece ${t.piece}`); continue; }
    reached.clear();
    flood(`${Math.round(px / CELL)},${Math.round(pz / CELL)}`, start);
    const out = st.exits.filter((e) => {
      const q = nodeAt(e.x, e.z, e.y, 0.5);
      return q && reached.has(q.id);
    });
    if (!out.length) problems.add(`${st.name}: no way from the platform beside piece ${t.piece} to the street`);
  }
  // every exit must lead to a platform
  for (const e of st.exits) {
    const q = nodeAt(e.x, e.z, e.y, 0.5);
    if (!q) { problems.add(`${st.name}: no floor at the exit ${e.name}`); continue; }
    reached.clear();
    flood(`${Math.round(e.x / CELL)},${Math.round(e.z / CELL)}`, q);
    if (!platformNodes.some((p) => reached.has(p.node.id))) problems.add(`${st.name}: the exit ${e.name} leads to no platform`);
  }
}

// ------------------------------------------------------------------ the frame, for writing descriptions
function printFrame(name: string) {
  const d = descriptions[name];
  const f = frameOf(name, d?.axis);
  const lc = (x: number, z: number) => local(f, x, z).map((v) => v.toFixed(1)).join(', ');
  console.log(`${name}: middle of the platforms at ${f.x.toFixed(1)}, ${f.z.toFixed(1)}; +s points ${bearing(f.tx, f.tz)}; platform level ${f.y.toFixed(2)} m`);
  for (const t of platformTracks(name)) {
    const kinds = new Set<string>();
    t.g.s.forEach((s, k) => { if (s >= t.s0 && s <= t.s1) kinds.add(STRUCTURE_KINDS[t.g.kind[k]]); });
    const ends = [t.s0, t.s1].map((s) => at(t.g, s));
    const { tx, tz } = tangentAt(t.g, (t.s0 + t.s1) / 2);
    const dir = tx * f.tx + tz * f.tz > 0 ? 1 : -1;
    const sideU = t.side * dir; // the platform's side in the frame: +1 towards +u
    const mid = at(t.g, (t.s0 + t.s1) / 2);
    const [, u] = local(f, mid.x, mid.z);
    console.log(`  track (piece ${t.piece}) at u ${u.toFixed(1)}, rail ${(mid.y - f.y).toFixed(2)} m; platform ${t.island ? 'island' : 'side'} ${t.width} m wide on its ${sideU > 0 ? '+u' : '-u'} side, u ${(u + sideU * PLATFORM_EDGE).toFixed(1)} to ${(u + sideU * (PLATFORM_EDGE + t.width)).toFixed(1)}; from s ${ends.map((e) => local(f, e.x, e.z)[0].toFixed(1)).join(' to ')}; ${[...kinds].join(', ')}`);
    // the track's u, every 20 m along the frame, out to 120 m beyond the platforms
    const row: string[] = [];
    for (let sv = -200; sv <= 200; sv += 20) {
      let best: { d: number; u: number; y: number } | null = null;
      for (let k = 0; k < t.g.x.length; k++) {
        const [ls, lu] = local(f, t.g.x[k], t.g.z[k]);
        if (Math.abs(ls - sv) < 6 && Math.abs(lu - u) < 40 && (!best || Math.abs(ls - sv) < best.d)) best = { d: Math.abs(ls - sv), u: lu, y: t.g.y[k] - f.y };
      }
      if (best) row.push(`${sv}: ${best.u.toFixed(1)}${Math.abs(best.y + 1) > 0.3 ? ` (rail ${best.y.toFixed(1)})` : ''}`);
    }
    console.log(`    u at s ${row.join(', ')}`);
  }
  const street: string[] = [];
  for (let sv = -160; sv <= 160; sv += 20) {
    const h = groundAt(name, ...world(f, [sv, 0]));
    if (h !== null) street.push(`${sv}: ${(h - f.y).toFixed(1)}`);
  }
  console.log(`  street over the middle, at s ${street.join(', ')}`);
  const near = ground.entrances.filter((e) => Math.hypot(e.x - f.x, e.z - f.z) < 450).map((e) => ({ e, d: Math.hypot(e.x - f.x, e.z - f.z) })).sort((a, b) => a.d - b.d);
  for (const { e } of near) {
    const h = patchHeight(e, e.x, e.z);
    console.log(`  entrance ${e.osm} ${JSON.stringify(e.name)} (${e.station}) at [${lc(e.x, e.z)}], street ${h === null ? '?' : (h - f.y).toFixed(1)} m`);
  }
}
function bearing(tx: number, tz: number) {
  const deg = ((Math.atan2(tx, -tz) * 180) / Math.PI + 360) % 360;
  return `${deg.toFixed(0)}° (${['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(deg / 45) % 8]})`;
}

// ------------------------------------------------------------------ main
const arg = process.argv.indexOf('--frame');
if (arg >= 0) {
  for (const name of process.argv.slice(arg + 1)) printFrame(name);
  process.exit(0);
}

const problems = new Problems();
const stations: StationLayout[] = [];
for (const [name, d] of Object.entries(descriptions)) {
  try {
    const st = buildStation(name, d, problems);
    checkClearance(st, problems);
    checkWalk(st, problems);
    stations.push(st);
    const n = (k: Part['kind']) => st.parts.filter((p) => p.kind === k).length;
    console.log(`${name}: ${st.exits.length} exits, ${n('floor')} floors, ${n('incline')} stairs and escalators, ${n('lift')} lifts; platform level ${st.platformY} m`);
  } catch (err) {
    problems.add((err as Error).message);
  }
}
const served = new Set(graph.routes.flatMap((r) => r.stops.map((s) => s.station)));
// the stations drawn from a model (src/station-models.ts) need no description
const modelled = new Set(Object.values(JSON.parse(readFileSync('public/data/stations.json', 'utf8')) as Record<string, { name: string }>).map((m) => m.name));
const missing = [...served].filter((s) => !modelled.has(s) && !descriptions[s]);
if (missing.length) console.log(`not described yet: ${missing.join(', ')}`);

writeFileSync(OUT, JSON.stringify({
  attribution: 'Map data © OpenStreetMap contributors, ODbL 1.0; Markhöjdmodell © Lantmäteriet, CC BY 4.0',
  note: `Built by tools/build-stations.ts from ${DESCRIPTIONS}; format in src/station-layout.ts.`,
  stations,
}) + '\n');
console.log(`wrote ${OUT} (${Math.round(readFileSync(OUT).length / 1024)} kB)`);
if (problems.list.length) {
  for (const p of problems.list) console.error(`  ${p}`);
  console.error(`${problems.list.length} problems`);
  process.exit(1);
}
