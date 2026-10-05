// Builds the metro's track graph from OpenStreetMap and traces the services through it.
//
//   node tools/build-track-graph.ts
//
// Reads data/osm/network.json (tools/fetch-osm.ts network), data/routes.json and
// data/track-corrections.json; writes public/data/track-graph.json (see src/track-graph.ts),
// with the services' timetable from data/routes.json.
//
// 1. Every railway=subway way is cut into pieces at its switches, ends, and where the track type
//    or structure (tunnel, bridge, surface) changes.
// 2. At each switch, two pieces connect if their tracks leave it in nearly opposite directions.
//    Many switches in the tunnels lack OSM's railway=switch tag, so they are found from where
//    the track branches.
// 3. Platforms are matched to the tracks running beside them, and to the nearest station.
// 4. Each service is traced from its first station to its last through the platforms of every
//    station in turn, the train never reversing, keeping left on double track and preferring
//    running lines of its own colour, and arriving at each end on the track the trains the other
//    way leave from, where they turn. A service that can't be traced, or a station without a
//    platform track, fails the build.
//
// Where OSM is wrong, data/track-corrections.json adds links, crossovers or platform tracks.
// DEBUG=1 also lists stations with a single platform track and stretches run on the wrong track.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { lonLatToWorld, ORIGIN } from '../src/geo.ts';
import type {
  NodeKind, Platform, PlatformTrack, Route, RouteStop, Service, Station, Structure, TrackGraph, TrackNode, TrackPiece,
} from '../src/track-graph.ts';

const OSM = 'data/osm/network.json';
const ROUTES = 'data/routes.json';
const CORRECTIONS = 'data/track-corrections.json';
const OUT = 'public/data/track-graph.json';

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  geometry?: { lat: number; lon: number }[];
  members?: { type: string; ref: number; role: string; geometry?: { lat: number; lon: number }[] }[];
  tags?: Record<string, string>;
}
interface Corrections {
  // links between OSM nodes to add or remove before the graph is built
  links?: { op: 'add' | 'remove'; nodes: [number, number]; why: string; structure?: Structure; service?: Service }[];
  // crossovers missing from OSM, between two points given in SWEREF 99 18 00 (east, north); each
  // point is snapped onto the nearest track within 5 m
  crossovers?: { a: [number, number]; b: [number, number]; why: string }[];
  // stations whose platform OSM doesn't put beside every track: each running line passing within
  // `reach` m (default 12) of the station's node gets a 145 m platform track centred on its
  // nearest point, unless it already has one. With `replace`, OSM's platforms there are dropped
  // first (for a platform drawn on the wrong side of a track).
  platforms?: { station: string; why: string; reach?: number; replace?: boolean }[];
}

const osm: { timestamp?: string; attribution: string; elements: OsmElement[] } = JSON.parse(readFileSync(OSM, 'utf8'));
const routeDefs: { timetable?: TrackGraph['timetable']; routes: Record<string, { line: string; stations: string[] }> } = JSON.parse(readFileSync(ROUTES, 'utf8'));
const corrections: Corrections = existsSync(CORRECTIONS) ? JSON.parse(readFileSync(CORRECTIONS, 'utf8')) : {};

const round = (v: number) => Math.round(v * 100) / 100;
const LINE_NAMES: Record<string, string> = { 'röda linjen': 'red', 'gröna linjen': 'green', 'blå linjen': 'blue' };

// ------------------------------------------------------------------ 1. links between OSM nodes
interface Link { a: number; b: number; structure: Structure; service: Service; line: string | null; way: number; covered: boolean; layer: number | null }

const pos = new Map<number, { x: number; z: number }>();
const osmNodeTags = new Map<number, Record<string, string>>();
const links: Link[] = [];

function structureOf(t: Record<string, string>): Structure {
  if (t.tunnel && t.tunnel !== 'no') return 'tunnel';
  // a depot's tracks under cover run through its halls, on the ground
  if (t.covered === 'yes') return serviceOf(t) === 'yard' || serviceOf(t) === 'siding' ? 'surface' : 'tunnel';
  if (t.bridge && t.bridge !== 'no') return 'bridge';
  return 'surface';
}
function serviceOf(t: Record<string, string>): Service {
  const s = t.service;
  return s === 'crossover' || s === 'siding' || s === 'yard' || s === 'spur' ? s : 'main';
}

for (const el of osm.elements) {
  if (el.type === 'node' && el.tags) osmNodeTags.set(el.id, el.tags);
  if (el.type !== 'way' || el.tags?.railway !== 'subway' || !el.nodes || !el.geometry) continue;
  el.nodes.forEach((id, i) => pos.set(id, lonLatToWorld(el.geometry![i].lon, el.geometry![i].lat)));
  const structure = structureOf(el.tags), service = serviceOf(el.tags);
  const line = LINE_NAMES[(el.tags.name || '').toLowerCase()] ?? null;
  const covered = structure === 'surface' && el.tags.covered === 'yes';
  const layerTag = el.tags.layer ?? el.tags.level;
  const layer = layerTag !== undefined && Number.isFinite(parseFloat(layerTag)) ? parseFloat(layerTag) : null;
  for (let i = 1; i < el.nodes.length; i++) {
    if (el.nodes[i] !== el.nodes[i - 1]) links.push({ a: el.nodes[i - 1], b: el.nodes[i], structure, service, line, way: el.id, covered, layer });
  }
}

for (const c of corrections.links ?? []) {
  const [a, b] = c.nodes;
  if (c.op === 'remove') {
    const i = links.findIndex((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
    if (i < 0) throw new Error(`correction: no link ${a}–${b} to remove (${c.why})`);
    links.splice(i, 1);
  } else {
    if (!pos.has(a) || !pos.has(b)) throw new Error(`correction: node ${pos.has(a) ? b : a} is not on a track (${c.why})`);
    links.push({ a, b, structure: c.structure ?? 'tunnel', service: c.service ?? 'main', line: null, way: 0, covered: false, layer: null });
  }
}

// Each missing crossover: split the nearest link at both ends and join the new nodes.
let synthetic = -1;
function splitAt(e: number, n: number, why: string) {
  const x = e - ORIGIN.e, z = ORIGIN.n - n;
  let best: { l: Link; d: number; px: number; pz: number } | null = null;
  for (const l of links) {
    const a = pos.get(l.a)!, b = pos.get(l.b)!;
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    if (!best || d < best.d) best = { l, d, px: a.x + dx * t, pz: a.z + dz * t };
  }
  if (!best || best.d > 5) throw new Error(`correction: no track within 5 m of ${e}, ${n} (${why})`);
  const id = synthetic--;
  pos.set(id, { x: best.px, z: best.pz });
  const { l } = best;
  links.splice(links.indexOf(l), 1, { ...l, b: id }, { ...l, a: id });
  return { id, link: l };
}
for (const c of corrections.crossovers ?? []) {
  const a = splitAt(c.a[0], c.a[1], c.why), b = splitAt(c.b[0], c.b[1], c.why);
  links.push({ a: a.id, b: b.id, structure: a.link.structure, service: 'crossover', line: a.link.line, way: 0, covered: false, layer: null });
}

const linksAt = new Map<number, Link[]>();
for (const l of links) {
  for (const n of [l.a, l.b]) {
    const list = linksAt.get(n);
    if (list) list.push(l); else linksAt.set(n, [l]);
  }
}

// ------------------------------------------------------------------ 2. nodes and pieces
// A node ends a piece unless exactly two links meet there and they agree on everything that
// matters downstream.
function nodeKind(n: number): NodeKind | null {
  const ls = linksAt.get(n)!;
  if (ls.length === 1) return 'end';
  if (ls.length === 3) return 'switch';
  if (ls.length > 3) return 'crossing';
  const [p, q] = ls;
  if (p.structure !== q.structure) return 'portal';
  if (p.service !== q.service || p.line !== q.line || p.covered !== q.covered) return 'join';
  return null;
}

const nodes = new Map<number, TrackNode>();
for (const n of linksAt.keys()) {
  const kind = nodeKind(n);
  if (kind) nodes.set(n, { id: n, x: round(pos.get(n)!.x), z: round(pos.get(n)!.z), kind });
}

const pieces: TrackPiece[] = [];
const used = new Set<Link>();
const other = (l: Link, n: number) => (l.a === n ? l.b : l.a);

function walk(start: number, first: Link) {
  const chain = [start];
  const ways = new Set<number>();
  let l = first, n = start;
  for (;;) {
    used.add(l);
    if (l.way) ways.add(l.way);
    n = other(l, n);
    chain.push(n);
    if (nodes.has(n)) break;
    const next = linksAt.get(n)!.find((k) => k !== l && !used.has(k));
    if (!next) break;
    l = next;
  }
  const points = chain.map((id) => [round(pos.get(id)!.x), round(pos.get(id)!.z)] as [number, number]);
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  pieces.push({
    id: pieces.length, from: start, to: n, points, length: round(length),
    structure: first.structure, service: first.service, lines: first.line ? [first.line] : [], ways: [...ways],
    ...(first.covered ? { covered: true } : {}),
    ...(first.layer !== null ? { layer: first.layer } : {}),
  });
}
for (const n of nodes.keys()) for (const l of linksAt.get(n)!) if (!used.has(l)) walk(n, l);
// closed loops without any node (none expected, but don't lose them)
for (const l of links) {
  if (used.has(l)) continue;
  nodes.set(l.a, { id: l.a, x: round(pos.get(l.a)!.x), z: round(pos.get(l.a)!.z), kind: 'join' });
  walk(l.a, l);
}

// Unnamed pieces take the line of their neighbours when all named neighbours agree, repeatedly,
// so that crossovers and tunnel stretches mapped without a name still belong to a line.
const piecesAt = new Map<number, TrackPiece[]>();
for (const p of pieces) {
  for (const n of new Set([p.from, p.to])) {
    const list = piecesAt.get(n);
    if (list) list.push(p); else piecesAt.set(n, [p]);
  }
}
for (let changed = true; changed;) {
  changed = false;
  for (const p of pieces) {
    if (p.lines.length) continue;
    const around = new Set([p.from, p.to].flatMap((n) => piecesAt.get(n)!.filter((q) => q !== p).flatMap((q) => q.lines)));
    if (around.size === 1) { p.lines = [...around]; changed = true; }
  }
}

// Direction a piece leaves node n in, looking ~8 m along it.
function leaving(p: TrackPiece, n: number) {
  const pts = p.from === n ? p.points : [...p.points].reverse();
  const [x0, z0] = pts[0];
  let k = 1, d = 0;
  while (k < pts.length - 1 && d < 8) { d = Math.hypot(pts[k][0] - x0, pts[k][1] - z0); if (d < 8) k++; }
  const dx = pts[k][0] - x0, dz = pts[k][1] - z0, len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len };
}

// Two tracks at a switch connect when they leave it at more than 110° to each other.
const THROUGH_COS = Math.cos((110 * Math.PI) / 180);
for (const node of nodes.values()) {
  if (node.kind !== 'switch' && node.kind !== 'crossing') continue;
  const at = piecesAt.get(node.id)!;
  const through: [number, number][] = [];
  for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
    const a = leaving(at[i], node.id), b = leaving(at[j], node.id);
    if (a.x * b.x + a.z * b.z < THROUGH_COS) through.push([at[i].id, at[j].id]);
  }
  node.through = through;
}

// ------------------------------------------------------------------ 3. platforms and stations
type XZ = [number, number];
function distToSegment(x: number, z: number, a: XZ, b: XZ) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return { d: Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t), px: a[0] + dx * t, pz: a[1] + dz * t };
}
// the point s metres along a piece from its `from` end
function pointAt(p: TrackPiece, s: number): XZ {
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

// even-odd test over the outline's segments, so it works for rings in any order, holes included
function inside(x: number, z: number, segs: [XZ, XZ][]) {
  let c = false;
  for (const [[xi, zi], [xj, zj]] of segs) {
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

// Pieces sampled every 2 m, in a coarse grid for lookups.
interface Sample { piece: TrackPiece; s: number; x: number; z: number; tx: number; tz: number }
const sampleGrid = new Map<string, Sample[]>();
const CELL = 25;
for (const p of pieces) {
  let s = 0;
  for (let i = 1; i < p.points.length; i++) {
    const [ax, az] = p.points[i - 1], [bx, bz] = p.points[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (!len) continue;
    for (let t = 0; t < len; t += 2) {
      const smp = { piece: p, s: s + t, x: ax + ((bx - ax) * t) / len, z: az + ((bz - az) * t) / len, tx: (bx - ax) / len, tz: (bz - az) / len };
      const key = `${Math.floor(smp.x / CELL)},${Math.floor(smp.z / CELL)}`;
      const list = sampleGrid.get(key);
      if (list) list.push(smp); else sampleGrid.set(key, [smp]);
    }
    s += len;
  }
}

const stationEls = osm.elements.filter((e) => e.tags?.railway === 'station' && e.tags.station === 'subway' && e.tags.name);
const stationPos = (e: OsmElement) => {
  if (e.lat !== undefined) return lonLatToWorld(e.lon!, e.lat);
  const g = e.geometry!;
  return lonLatToWorld(g.reduce((a, p) => a + p.lon, 0) / g.length, g.reduce((a, p) => a + p.lat, 0) / g.length);
};
const stations = new Map<string, Station>();
for (const e of stationEls) {
  const name = e.tags!.name.replace(/ tunnelbanestation$/, '');
  if (stations.has(name)) continue;
  const p = stationPos(e);
  stations.set(name, { name, osm: e.id, x: round(p.x), z: round(p.z), platforms: [] });
}

const MIN_RUN = 30;
const toXZ = (g: { lat: number; lon: number }): XZ => { const w = lonLatToWorld(g.lon, g.lat); return [w.x, w.z]; };
const lineSegs = (pts: XZ[]) => pts.slice(1).map((p, i) => [pts[i], p] as [XZ, XZ]);

function addPlatform(id: number, segs: [XZ, XZ][], closed: boolean) {
  // a platform drawn as an area: tracks along its edges; drawn as a line (usually its middle):
  // tracks up to half a wide island platform away
  const reach = closed ? 3.5 : 6.5;
  const dist = (x: number, z: number) => {
    let best = { d: Infinity, px: 0, pz: 0 };
    for (const [a, b] of segs) {
      const r = distToSegment(x, z, a, b);
      if (r.d < best.d) best = r;
    }
    return closed && inside(x, z, segs) ? { ...best, d: 0 } : best;
  };
  const pts = segs.flat();
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  // samples near the platform, by piece
  const near = new Map<TrackPiece, { s: number; side: number }[]>();
  for (let i = Math.floor((x0 - reach) / CELL); i <= Math.floor((x1 + reach) / CELL); i++) {
    for (let j = Math.floor((z0 - reach) / CELL); j <= Math.floor((z1 + reach) / CELL); j++) {
      for (const smp of sampleGrid.get(`${i},${j}`) ?? []) {
        const r = dist(smp.x, smp.z);
        if (r.d > reach) continue;
        // which side of the track the platform is on: the cross product of the track's
        // direction and the way to the platform (its middle if the track is inside it)
        const cx = r.d > 0.5 ? r.px : (x0 + x1) / 2, cz = r.d > 0.5 ? r.pz : (z0 + z1) / 2;
        const side = Math.sign(smp.tx * (cz - smp.z) - smp.tz * (cx - smp.x));
        const list = near.get(smp.piece);
        if (list) list.push({ s: smp.s, side }); else near.set(smp.piece, [{ s: smp.s, side }]);
      }
    }
  }
  const tracks: PlatformTrack[] = [];
  for (const [piece, list] of near) {
    list.sort((a, b) => a.s - b.s);
    // runs of samples 2 m apart
    let run = [list[0]];
    const flush = () => {
      const len = run[run.length - 1].s - run[0].s;
      if (len >= MIN_RUN) {
        // +z is south, so in plan (x east, z south) a positive cross product means the
        // platform is to the right of the direction of travel
        const sideSum = run.reduce((a, r) => a + r.side, 0);
        tracks.push({ piece: piece.id, s0: round(run[0].s), s1: round(run[run.length - 1].s), side: sideSum >= 0 ? 'right' : 'left' });
      }
    };
    for (let k = 1; k < list.length; k++) {
      if (list[k].s - list[k - 1].s > 4.5) { flush(); run = []; }
      run.push(list[k]);
    }
    flush();
  }
  if (!tracks.length) return;
  // the nearest station within 400 m
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  let station: Station | null = null, bestD = 400;
  for (const st of stations.values()) {
    const d = Math.hypot(st.x - cx, st.z - cz);
    if (d < bestD) { bestD = d; station = st; }
  }
  if (station) station.platforms.push({ osm: id, tracks } satisfies Platform);
}

for (const e of osm.elements) {
  const t = e.tags ?? {};
  if (t.railway !== 'platform' && !(t.public_transport === 'platform' && t.subway === 'yes')) continue;
  if (e.type === 'way' && e.geometry && e.nodes) {
    const pts = e.geometry.map(toXZ);
    addPlatform(e.id, lineSegs(pts), e.nodes[0] === e.nodes[e.nodes.length - 1] && pts.length > 3);
  } else if (e.type === 'relation' && e.members) {
    // a multipolygon: its outer and inner rings
    const segs = e.members.filter((m) => m.geometry && (m.role === 'outer' || m.role === 'inner')).flatMap((m) => lineSegs(m.geometry!.map(toXZ)));
    if (segs.length) addPlatform(e.id, segs, true);
  }
}

for (const c of corrections.platforms ?? []) {
  const st = stations.get(c.station);
  if (!st) throw new Error(`correction: no station called ${c.station}`);
  const reach = c.reach ?? 12;
  if (c.replace) st.platforms = [];
  const have = new Set(st.platforms.flatMap((p) => p.tracks.map((t) => t.piece)));
  const tracks: PlatformTrack[] = [];
  for (const p of pieces) {
    if (p.service !== 'main' || have.has(p.id)) continue;
    let best = { d: Infinity, s: 0 }, s = 0;
    for (let i = 1; i < p.points.length; i++) {
      const r = distToSegment(st.x, st.z, p.points[i - 1], p.points[i]);
      const len = Math.hypot(p.points[i][0] - p.points[i - 1][0], p.points[i][1] - p.points[i - 1][1]);
      if (r.d < best.d) best = { d: r.d, s: s + Math.hypot(r.px - p.points[i - 1][0], r.pz - p.points[i - 1][1]) };
      s += len;
    }
    if (best.d > reach) continue;
    // the platform is on the side of the track facing the station's node
    const s0 = Math.max(0, best.s - 72.5), s1 = Math.min(p.length, best.s + 72.5);
    const smp = pointAt(p, best.s), ahead = pointAt(p, Math.min(p.length, best.s + 1)), back = pointAt(p, Math.max(0, best.s - 1));
    const tx = ahead[0] - back[0], tz = ahead[1] - back[1];
    const side = tx * (st.z - smp[1]) - tz * (st.x - smp[0]) >= 0 ? 'right' : 'left';
    tracks.push({ piece: p.id, s0: round(s0), s1: round(s1), side });
  }
  if (!tracks.length) throw new Error(`correction: no running line without a platform within ${reach} m of ${c.station} (${c.why})`);
  st.platforms.push({ osm: 0, tracks });
}

// ------------------------------------------------------------------ 4. routes
// Trains run on the left. On double track, a train on the correct track has the other track on
// its right, so for each running-line piece, find which side the nearest parallel running line
// of the same colour is on when the piece is run from `from` to `to`: +1 right, -1 left, 0
// single track or unclear. In rock tunnels the two tracks are often in separate bores up to
// ~25 m apart.
const handed = new Map<number, number>();
const NEIGHBOUR = 30;
for (const p of pieces) {
  if (p.service !== 'main') continue;
  let right = 0, left = 0, n = 0;
  for (let s = 1; s < p.length; s += 4) {
    const [x, z] = pointAt(p, s), [ax, az] = pointAt(p, Math.min(p.length, s + 1)), [bx, bz] = pointAt(p, Math.max(0, s - 1));
    const tl = Math.hypot(ax - bx, az - bz) || 1, tx = (ax - bx) / tl, tz = (az - bz) / tl;
    n++;
    let found = 0, bestD = NEIGHBOUR;
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      for (const smp of sampleGrid.get(`${i},${j}`) ?? []) {
        const q = smp.piece;
        if (q === p || q.service !== 'main' || Math.abs(smp.tx * tx + smp.tz * tz) < 0.9) continue;
        if (p.lines.length && q.lines.length && !q.lines.some((l) => p.lines.includes(l))) continue;
        const d = Math.hypot(smp.x - x, smp.z - z);
        if (d < 2.5 || d > bestD) continue;
        bestD = d;
        found = Math.sign(tx * (smp.z - z) - tz * (smp.x - x));
      }
    }
    if (found > 0) right++; else if (found < 0) left++;
  }
  if (n && right > 0.6 * n) handed.set(p.id, 1);
  else if (n && left > 0.6 * n) handed.set(p.id, -1);
}

const WEIGHT: Record<Service, number> = { main: 1, crossover: 4, siding: 10, yard: 30, spur: 30 };
const pieceById = (id: number) => pieces[id];
const weight = (p: TrackPiece, line: string, dir: 1 | -1) =>
  WEIGHT[p.service]
  * (p.lines.length && !p.lines.includes(line) ? 5 : 1)
  // running on the right-hand track of a double track
  * ((handed.get(p.id) ?? 0) * dir < 0 ? 3 : 1);
// the pieces a train on `p`, arriving at node n, may run on to
function nextPieces(p: TrackPiece, n: number): TrackPiece[] {
  const node = nodes.get(n)!;
  const at = piecesAt.get(n)!.filter((q) => q !== p || p.from === p.to);
  if (node.kind === 'switch' || node.kind === 'crossing') {
    return node.through!.filter(([a, b]) => a === p.id || b === p.id).map(([a, b]) => pieceById(a === p.id ? b : a));
  }
  return at;
}

interface Pos { piece: number; dir: 1 | -1; s: number }
type Step = { piece: number; dir: 1 | -1 };
// One way of arriving at a station: where the train stands, the cheapest cost of getting there
// from the start of the route, and how.
interface Arrival { pos: Pos; cost: number; path: Step[]; prev: Arrival | null }

// From every arrival at one station, the cheapest way to each platform track of the next station
// (in each direction a train can stand there). A multi-source Dijkstra over (piece, direction)
// states, each meaning "at the far end of that piece".
function nextArrivals(sources: Arrival[], targets: PlatformTrack[], line: string): Arrival[] {
  const best = new Map<string, Arrival>();
  const tryArrive = (piece: TrackPiece, dir: 1 | -1, enterS: number, cost: number, path: () => Step[], from: Arrival) => {
    for (const t of targets) {
      if (t.piece !== piece.id) continue;
      const mid = (t.s0 + t.s1) / 2;
      const ahead = dir === 1 ? mid - enterS : enterS - mid;
      if (ahead < 0) continue;
      const c = cost + ahead * weight(piece, line, dir);
      const key = `${t.piece}:${t.s0}:${dir}`;
      if (c < (best.get(key)?.cost ?? Infinity)) best.set(key, { pos: { piece: piece.id, dir, s: mid }, cost: c, path: path(), prev: from });
    }
  };
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const root = new Map<string, Arrival>();
  const queue: { key: string; cost: number; piece: TrackPiece; dir: 1 | -1 }[] = [];
  const push = (piece: TrackPiece, dir: 1 | -1, cost: number, from: string | null, src: Arrival) => {
    const key = `${piece.id}:${dir}`;
    if ((dist.get(key) ?? Infinity) <= cost) return;
    dist.set(key, cost);
    if (from) prev.set(key, from); else prev.delete(key);
    root.set(key, src);
    queue.push({ key, cost, piece, dir });
  };
  const pathTo = (key: string) => {
    const out: Step[] = [];
    for (let k: string | undefined = key; k; k = prev.get(k)) {
      const [id, d] = k.split(':').map(Number);
      out.unshift({ piece: id, dir: d as 1 | -1 });
    }
    return out;
  };
  for (const src of sources) {
    const p0 = pieceById(src.pos.piece), dir = src.pos.dir;
    tryArrive(p0, dir, src.pos.s, src.cost, () => [{ piece: p0.id, dir }], src);
    const rest = dir === 1 ? p0.length - src.pos.s : src.pos.s;
    push(p0, dir, src.cost + rest * weight(p0, line, dir), null, src);
  }
  while (queue.length) {
    queue.sort((a, b) => b.cost - a.cost);
    const cur = queue.pop()!;
    if (cur.cost > (dist.get(cur.key) ?? Infinity)) continue;
    const n = cur.dir === 1 ? cur.piece.to : cur.piece.from;
    for (const q of nextPieces(cur.piece, n)) {
      const dir: 1 | -1 = q.from === n ? 1 : -1;
      tryArrive(q, dir, dir === 1 ? 0 : q.length, cur.cost, () => [...pathTo(cur.key), { piece: q.id, dir }], root.get(cur.key)!);
      push(q, dir, cur.cost + q.length * weight(q, line, dir), cur.key, root.get(cur.key)!);
    }
  }
  return [...best.values()];
}

const problems: string[] = [];
const platformTracks = (name: string) => {
  const st = stations.get(name);
  if (!st) { problems.push(`no station called ${name}`); return []; }
  const ts = st.platforms.flatMap((p) => p.tracks);
  if (!ts.length) problems.push(`${name}: no platform beside a track`);
  return ts;
};

// The cheapest run from the first station to the last, stopping at every station in turn and
// never reversing. Every way of standing at each station is kept, so a cheap arrival that
// leads nowhere can't block the route.
// `start` and `finish`, where given, are where the train must stand at the first and last station.
type Stand = { piece: number; dir: 1 | -1 };
function trace(name: string, service: string, line: string, names: string[], start?: Stand, finish?: Stand): Route | null {
  let arrivals: Arrival[] = platformTracks(names[0]).flatMap((t) => ([1, -1] as const).map((dir) => (
    { pos: { piece: t.piece, dir, s: (t.s0 + t.s1) / 2 }, cost: 0, path: [], prev: null })));
  if (start) arrivals = arrivals.filter((a) => a.pos.piece === start.piece && a.pos.dir === start.dir);
  for (const next of names.slice(1)) {
    arrivals = nextArrivals(arrivals, platformTracks(next), line);
    if (!arrivals.length) { problems.push(`${name}: could not get from ${names[names.indexOf(next) - 1]} to ${next}`); return null; }
  }
  if (finish) {
    arrivals = arrivals.filter((a) => a.pos.piece === finish.piece && a.pos.dir === finish.dir);
    if (!arrivals.length) return null;
  }
  const end = arrivals.reduce((a, b) => (b.cost < a.cost ? b : a));
  const chain: Arrival[] = [];
  for (let a: Arrival | null = end; a; a = a.prev) chain.unshift(a);
  const path: Route['path'] = [];
  for (const a of chain) {
    for (const step of a.path) {
      const last = path[path.length - 1];
      if (!last || last.piece !== step.piece || last.dir !== step.dir) path.push(step);
    }
  }
  const stops: RouteStop[] = chain.map((a, i) => ({ station: names[i], piece: a.pos.piece, s: round(a.pos.s) }));
  // running length: from the first stop to the last
  let length = 0;
  path.forEach((st, i) => {
    const p = pieceById(st.piece);
    const enter = i === 0 ? stops[0].s : st.dir === 1 ? 0 : p.length;
    const leave = i === path.length - 1 ? stops[stops.length - 1].s : st.dir === 1 ? p.length : 0;
    length += Math.abs(leave - enter);
  });
  return { name, service, line, stops, path, length: round(length), cost: end.cost } as Route & { cost: number };
}

// Each service is traced both ways. At each end the trains turn where they stand: a train arrives
// on the platform track the train the other way leaves from, and reverses there. Either the
// arriving train crosses over to the track the other leaves from, or the leaving train leaves
// from the track the other arrived on and crosses over after: at each end, whichever costs less
// (the crossovers by a terminus may suit only one of them).
const routes: Route[] = [];
// the services' running lines as first traced, before the ends were turned
const ways: NonNullable<TrackGraph['ways']> = [];
type Traced = Route & { cost: number };
const flip = (st: Stand): Stand => ({ piece: st.piece, dir: -st.dir as 1 | -1 });
const standAt = (r: Route, k: 0 | -1): Stand => {
  const stop = r.stops.at(k)!, step = k === 0 ? r.path[0] : r.path.at(-1)!;
  return { piece: stop.piece, dir: step.dir };
};
for (const [name, def] of Object.entries(routeDefs.routes)) {
  const dirs = [[`${name} ${def.stations[0]}–${def.stations.at(-1)}`, def.stations],
    [`${name} ${def.stations.at(-1)}–${def.stations[0]}`, [...def.stations].reverse()]] as const;
  const [a, b] = dirs.map(([label, names]) => trace(label, name, def.line, names) as Traced | null);
  for (const r of [a, b]) if (r) ways.push({ service: name, line: def.line, path: r.path });
  if (!a || !b) { for (const r of [a, b]) if (r) routes.push(r); continue; }
  // at the far end of a (where b starts), and at the far end of b (where a starts): true when the
  // arriving train crosses over, false when the leaving one does
  let best: [Traced, Traced] | null = null;
  for (const arriveFar of [true, false]) for (const arriveNear of [true, false]) {
    const aStart = arriveNear ? standAt(a, 0) : flip(standAt(b, -1)), aEnd = arriveFar ? flip(standAt(b, 0)) : standAt(a, -1);
    const bStart = arriveFar ? standAt(b, 0) : flip(standAt(a, -1)), bEnd = arriveNear ? flip(standAt(a, 0)) : standAt(b, -1);
    const ra = trace(dirs[0][0], name, def.line, dirs[0][1], aStart, aEnd) as Traced | null;
    const rb = trace(dirs[1][0], name, def.line, dirs[1][1], bStart, bEnd) as Traced | null;
    if (ra && rb && (!best || ra.cost + rb.cost < best[0].cost + best[1].cost)) best = [ra, rb];
  }
  if (!best) problems.push(`${name}: its trains can't turn where they stand at the ends`);
  for (const r of best ?? [a, b]) routes.push(r);
}
for (const r of routes) delete (r as Partial<Traced>).cost;

// ------------------------------------------------------------------ report and write
const count = (k: NodeKind) => [...nodes.values()].filter((n) => n.kind === k).length;
const km = (f: (p: TrackPiece) => boolean) => (pieces.filter(f).reduce((a, p) => a + p.length, 0) / 1000).toFixed(1);
console.log(`${pieces.length} pieces, ${km(() => true)} km of track (${km((p) => p.service === 'main')} km running line, ${km((p) => p.structure === 'tunnel')} km in tunnel)`);
const tagged = [...nodes.values()].filter((n) => n.kind === 'switch' && osmNodeTags.get(n.id)?.railway === 'switch').length;
console.log(`${count('switch')} switches (${tagged} tagged railway=switch in OSM), ${count('crossing')} crossings, ${count('end')} ends, ${count('portal')} portals`);
const lonely = [...nodes.values()].filter((n) => (n.kind === 'switch' || n.kind === 'crossing') && !n.through!.length);
if (lonely.length) console.log(`${lonely.length} switches where no two tracks line up: ${lonely.slice(0, 8).map((n) => n.id).join(', ')}`);
for (const r of routes) {
  const crossovers = r.path.filter((s) => pieceById(s.piece).service !== 'main').length;
  const sides = r.stops.map((st) => {
    const t = stations.get(st.station)!.platforms.flatMap((p) => p.tracks).find((t) => t.piece === st.piece && t.s0 <= st.s && st.s <= t.s1)!;
    const dir = r.path.find((p) => p.piece === st.piece)!.dir;
    // the platform side seen from the train
    return (t.side === 'right') === (dir === 1) ? 'R' : 'L';
  });
  console.log(`${r.name}: ${(r.length / 1000).toFixed(2)} km, ${r.stops.length} stops, ${r.path.length} pieces (${crossovers} not running line), platform side ${sides.join('')}`);
}
if (process.env.DEBUG) {
  // stations of the traced services with fewer than two platform tracks
  for (const name of new Set(Object.values(routeDefs.routes).flatMap((r) => r.stations))) {
    const ts = stations.get(name)?.platforms.flatMap((p) => p.tracks) ?? [];
    if (new Set(ts.map((t) => t.piece)).size < 2) console.log(`  ${name}: platform tracks ${JSON.stringify(ts)}`);
  }
  // stretches run on the wrong (right-hand) track
  for (const r of routes) {
    let run: number[] = [];
    const flush = () => {
      const len = run.reduce((a, id) => a + pieceById(id).length, 0);
      if (len > 50) {
        const [x, z] = pieceById(run[0]).points[0];
        const near = [...stations.values()].reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a));
        console.log(`  ${r.name}: ${Math.round(len)} m on the wrong track from near ${near.name}, pieces ${run.join(' ')}`);
      }
      run = [];
    };
    for (const st of r.path) { if ((handed.get(st.piece) ?? 0) * st.dir < 0) run.push(st.piece); else flush(); }
    flush();
  }
}

const graph: TrackGraph = {
  attribution: osm.attribution,
  osm: osm.timestamp ?? null,
  nodes: [...nodes.values()],
  pieces,
  stations: [...stations.values()].filter((s) => s.platforms.length),
  routes,
  ways,
};
if (routeDefs.timetable) {
  const { station, services } = routeDefs.timetable;
  graph.timetable = { station, services };
  for (const r of routes) {
    if (!services[r.service]) problems.push(`${r.name}: no timetable`);
    else if (!r.stops.some((st) => st.station === station)) problems.push(`${r.name}: doesn't stop at ${station}, where the timetable is set`);
  }
}
writeFileSync(OUT, JSON.stringify(graph) + '\n');
console.log(`wrote ${OUT} (${(JSON.stringify(graph).length / 1024).toFixed(0)} kB)`);
if (problems.length) {
  console.error('problems:\n  ' + [...new Set(problems)].join('\n  '));
  process.exit(1);
}
