// Works out the track the game draws: where it runs in plan, and what kind of structure carries
// it.
//
//   node tools/build-track-geometry.ts
//
// Reads public/data/track-graph.json, public/data/track-heights.json, data/ground/red-line.json,
// data/height-corrections.json and the T-Centralen model; writes public/data/track-geometry.json
// (format in src/track-geometry.ts).
//
// The plan. OpenStreetMap's track is traced from aerial photos in the open, but sketched in the
// tunnels: there the two tracks of a line wander 4 to 35 m apart, where the line was built with
// both in one tunnel at 3.15 m centres. Every piece of the red line's track (tools/lib/graph.ts
// lineTrack: what its services run on, and the crossovers, sidings and depots joined to that) is cut into points about
// 10 m apart, joined at the nodes, and the plan is the smoothest line, by least squares, through:
// - OpenStreetMap's track: closely in the open and along platforms, loosely in tunnels (but
//   closely for track no service runs on, which OSM maps from depot and track plans)
// - T-Centralen's platform tracks: the station model's tracks, which the game draws
// - the two tracks of a line in a tunnel, at the same level: 3.15 m apart, beside each other;
//   at different levels, at least 7.5 m apart, so that their tunnels don't cut into each other;
//   and at an island platform in a tunnel, the platform's width apart. Not near the tunnel's
//   mouths, nor near the other platforms, where the tracks part to pass a platform or a station
//   hall, so that they part and meet again in long, gentle curves.
//
// The structure, at every point:
// - tunnel: in a concrete box where the rock would be thin (less than 12 m from the rail to the
//   ground, near the mouths, and in the troughs that data/height-corrections.json says need no
//   cover), in rock elsewhere
// - in the open: in a cutting more than 1.5 m below the ground, on an embankment more than 1 m
//   above it, otherwise on the ground
// - bridge: a bridge
// Where the two tracks of a line run side by side at one level, they share the structure.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { runningWays } from '../src/track-graph.ts';
import type { TrackGraph, TrackPiece } from '../src/track-graph.ts';
import { STRUCTURE_KINDS } from '../src/track-geometry.ts';
import type { GeometryPiece, StructureKind, TrackGeometry } from '../src/track-geometry.ts';
import { ISLAND_WIDTH, PLATFORM_EDGE, SIDE_PLATFORM_WIDTH, TRACK_CENTRES } from '../src/sections.ts';
import { chainage, interp, lineTrack, mouthDistances, pointAt } from './lib/graph.ts';
import { LeastSquares } from './lib/least-squares.ts';
import type { Row } from './lib/least-squares.ts';
import { loadStationModel, placeSample } from './lib/station-model.ts';

const OUT = 'public/data/track-geometry.json';
const GROUND = 'data/ground/red-line.json';
const STEP = 10;
// how far each kind of anchor may be off, in metres (1/m for curvature)
const SIGMA = { open: 0.3, platformOpen: 0.3, tunnel: 4, platformTunnel: 1.5, model: 0.1, pair: 0.05, apart: 0.3, curvature: 1 / 1000, hold: 1e-5, pinned: 0.002, yard: 0.3 };
// the tightest curve the line is let have, between points 10 m apart: the red line's limit is
// 250 m, and measured over 20 m this keeps above it. Track no service runs on (crossovers,
// sidings, depots) keeps OpenStreetMap's tighter curves, held only against kinks.
const CURVE_HOLD = 310, YARD_CURVE_HOLD = 50;
const CURVE_LIMIT = 250;
// the two tracks are pulled together where they are within this of each other in plan, and in
// height (fully within the second figure)
const PAIR_REACH = 40, PAIR_DY = [2.0, 1.5];
// Tracks at different levels, which can't share a tunnel, are kept at least this far apart, so
// that their tunnels don't cut into each other, unless one is well below the other (full force
// from the second height to the third).
const APART = { centres: 7.5, reach: 20, dy: [2.0, 2.5, 6.0, 6.5] };
// ... and this far from a tunnel mouth and from a platform they don't share (fully at the second)
const PAIR_FROM_MOUTH = [30, 90], PAIR_FROM_PLATFORM = [100, 200];
// rail to ground in a tunnel, under which it is a concrete box; and the length of the box at a mouth
const BOX_DEPTH = 12, BOX_AT_MOUTH = 20;
// below and above the ground, for a cutting and an embankment
const CUTTING = 1.5, EMBANKMENT = 1.0;
// two tracks share a structure where they are this close (or across a shared island platform),
// and their rails this close in height
const SHARE_REACH = 7.5, SHARE_DY = 2.0;
// structure runs shorter than this are merged into the run before
const MIN_RUN = 30;

const graph: TrackGraph = JSON.parse(readFileSync('public/data/track-graph.json', 'utf8'));
const heights: Record<string, number[]> = JSON.parse(readFileSync('public/data/track-heights.json', 'utf8')).pieces;
const corrections = existsSync('data/height-corrections.json') ? JSON.parse(readFileSync('data/height-corrections.json', 'utf8')) : {};
const ground: [number, number, number][] = existsSync(GROUND) ? JSON.parse(readFileSync(GROUND, 'utf8')).samples : [];
if (!ground.length) console.warn(`${GROUND} missing: every tunnel is taken to be in rock, and all open track on the ground`);

// ------------------------------------------------------------------ the plan
// The plan is fitted twice: first the services' track alone, then all of the red line's track with
// the services' track pinned where the first fit put it, so that the crossovers, sidings and
// depots are fitted to the line and don't move it.
interface Var { x0: number; z0: number; y: number; tunnel: boolean; key: string }
interface Disc { s: number[]; v: number[]; cum: number[] }
interface PlatformRange { station: string; osm: number; s0: number; s1: number; side: 1 | -1 }
interface Seg { piece: TrackPiece; k: number }
const CELL = 20;
interface Partner { piece: TrackPiece; k: number; t: number; d: number; dy: number; x: number; z: number; y: number; s: number }
interface Across { vi: number; b0: number; b1: number; t: number; nx: number; nz: number }
const placements = JSON.parse(readFileSync('public/data/stations.json', 'utf8'));
const model = (await loadStationModel('t-centralen')).samples.map((s) => placeSample(s, placements['t-centralen']));

function plan(used: Set<number>, pinned: Map<string, [number, number]> | null, log: (...a: unknown[]) => void) {
  // ------------------------------------------------------------------ the pieces and their points
  const pieces = graph.pieces.filter((p) => used.has(p.id));
  for (const p of pieces) if (!heights[p.id]) throw new Error(`no heights for piece ${p.id}: run build-heights first`);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  // the services on each piece ('T13', 'T14'), and the direction they run it in
  const services = new Map<number, Set<string>>(), dirs = new Map<number, Set<number>>();
  for (const r of runningWays(graph)) {
    for (const st of r.path) {
      if (!services.has(st.piece)) { services.set(st.piece, new Set()); dirs.set(st.piece, new Set()); }
      services.get(st.piece)!.add(r.service);
      dirs.get(st.piece)!.add(st.dir);
    }
  }
  const serviceKey = (p: number) => [...(services.get(p) ?? [])].sort().join('+');
  // the direction a piece is run in, if it is only run one way (0 too for track no service runs on,
  // which is never paired)
  const oneWay = (p: number) => (dirs.get(p)?.size === 1 ? [...dirs.get(p)!][0] : 0);

  const vars: Var[] = [];
  const nodeVar = new Map<number, number>();
  const disc = new Map<number, Disc>();
  for (const p of pieces) {
    const cum = chainage(p);
    const n = Math.max(1, Math.ceil(p.length / STEP));
    const s: number[] = [], v: number[] = [];
    for (let k = 0; k <= n; k++) {
      const sk = (p.length * k) / n;
      s.push(sk);
      const node = k === 0 ? p.from : k === n ? p.to : null;
      if (node !== null && nodeVar.has(node)) {
        const vi = nodeVar.get(node)!;
        if (p.structure === 'tunnel') vars[vi].tunnel = true;
        v.push(vi);
        continue;
      }
      const [x, z] = pointAt(p, sk);
      if (node !== null) nodeVar.set(node, vars.length);
      v.push(vars.length);
      vars.push({ x0: x, z0: z, y: interp(cum, heights[p.id], sk), tunnel: p.structure === 'tunnel', key: node !== null ? `n${node}` : `${p.id}:${k}` });
    }
    disc.set(p.id, { s, v, cum });
  }
  const X = (v: number) => 2 * v, Z = (v: number) => 2 * v + 1;

  // the unit tangent of a piece at s, from `from` to `to`, in OpenStreetMap's plan
  const tangent = (p: TrackPiece, s: number) => {
    const [ax, az] = pointAt(p, Math.max(0, s - 5)), [bx, bz] = pointAt(p, Math.min(p.length, s + 5));
    const l = Math.hypot(bx - ax, bz - az) || 1;
    return [(bx - ax) / l, (bz - az) / l];
  };

  // how far each tunnel point is from a tunnel mouth
  const mouthAt = mouthDistances(graph, pieces);
  const mouthDistance = (p: TrackPiece, s: number) => p.structure !== 'tunnel' ? 0
    : Math.min((mouthAt.get(p.from) ?? Infinity) + s, (mouthAt.get(p.to) ?? Infinity) + p.length - s);

  // the platforms on each piece
  const platformsOn = new Map<number, PlatformRange[]>();
  for (const st of graph.stations) {
    for (const pl of st.platforms) {
      for (const t of pl.tracks) {
        if (!used.has(t.piece)) continue;
        const list = platformsOn.get(t.piece) ?? [];
        list.push({ station: st.name, osm: pl.osm, s0: t.s0, s1: t.s1, side: t.side === 'right' ? 1 : -1 });
        platformsOn.set(t.piece, list);
      }
    }
  }
  const platformAt = (piece: number, s: number) => (platformsOn.get(piece) ?? []).find((r) => s >= r.s0 && s <= r.s1) ?? null;
  // how far s is from the nearest platform on the piece, or on the pieces next to it
  const platformDistance = (p: TrackPiece, s: number) => {
    let best = Infinity;
    const consider = (piece: number, at: (r: PlatformRange) => number) => {
      for (const r of platformsOn.get(piece) ?? []) best = Math.min(best, at(r));
    };
    consider(p.id, (r) => (s < r.s0 ? r.s0 - s : s > r.s1 ? s - r.s1 : 0));
    // one piece on from each end is enough: platforms are well over 100 m long
    for (const q of pieces) {
      if (q.id === p.id) continue;
      if (q.from === p.from || q.to === p.from) consider(q.id, (r) => s + (q.from === p.from ? r.s0 : q.length - r.s1));
      if (q.from === p.to || q.to === p.to) consider(q.id, (r) => p.length - s + (q.from === p.to ? r.s0 : q.length - r.s1));
    }
    return best;
  };

  // ------------------------------------------------------------------ the other track of a line
  // A segment between two neighbouring points of a piece, in a grid for nearest-point queries.
  function segmentGrid(pos: (v: number) => [number, number]) {
    const grid = new Map<string, Seg[]>();
    for (const p of pieces) {
      const { v } = disc.get(p.id)!;
      for (let k = 0; k + 1 < v.length; k++) {
        const [ax, az] = pos(v[k]), [bx, bz] = pos(v[k + 1]);
        for (let i = Math.floor(Math.min(ax, bx) / CELL); i <= Math.floor(Math.max(ax, bx) / CELL); i++) {
          for (let j = Math.floor(Math.min(az, bz) / CELL); j <= Math.floor(Math.max(az, bz) / CELL); j++) {
            const key = `${i},${j}`;
            const list = grid.get(key);
            if (list) list.push({ piece: p, k }); else grid.set(key, [{ piece: p, k }]);
          }
        }
      }
    }
    return grid;
  }

  // The nearest point on the other track of the line: a track the same services run in the
  // opposite direction, within `reach` in plan and between `minDy` and `dy` in height.
  function partner(grid: Map<string, Seg[]>, pos: (v: number) => [number, number], self: TrackPiece, x: number, z: number, y: number,
    run: [number, number], reach: number, dy: number, minDy = 0): Partner | null {
    const key = serviceKey(self.id);
    let best: Partner | null = null;
    const seen = new Set<Seg>();
    for (let i = Math.floor((x - reach) / CELL); i <= Math.floor((x + reach) / CELL); i++) {
      for (let j = Math.floor((z - reach) / CELL); j <= Math.floor((z + reach) / CELL); j++) {
        for (const sg of grid.get(`${i},${j}`) ?? []) {
          if (seen.has(sg)) continue;
          seen.add(sg);
          const q = sg.piece;
          const dirQ = oneWay(q.id);
          if (q.id === self.id || !dirQ || serviceKey(q.id) !== key) continue;
          const { v, s } = disc.get(q.id)!;
          const [ax, az] = pos(v[sg.k]), [bx, bz] = pos(v[sg.k + 1]);
          const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
          // opposite running directions
          if ((run[0] * dx + run[1] * dz) * dirQ / Math.sqrt(l2) > -0.7) continue;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
          const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(px - x, pz - z);
          const py = vars[v[sg.k]].y + (vars[v[sg.k + 1]].y - vars[v[sg.k]].y) * t;
          if (d > reach || Math.abs(py - y) > dy || Math.abs(py - y) < minDy || (best && d >= best.d)) continue;
          best = { piece: q, k: sg.k, t, d, dy: py - y, x: px, z: pz, y: py, s: s[sg.k] + (s[sg.k + 1] - s[sg.k]) * t };
        }
      }
    }
    return best;
  }
  // ... and only if that track's nearest is this one again
  function mutualPartner(grid: Map<string, Seg[]>, pos: (v: number) => [number, number], self: TrackPiece, s: number, x: number, z: number, y: number,
    reach: number, dy: number, minDy = 0) {
    const dir = oneWay(self.id);
    if (!dir) return null;
    const [tx, tz] = tangent(self, s);
    const b = partner(grid, pos, self, x, z, y, [tx * dir, tz * dir], reach, dy, minDy);
    if (!b) return null;
    const [ux, uz] = tangent(b.piece, b.s), dirB = oneWay(b.piece.id);
    const back = partner(grid, pos, b.piece, b.x, b.z, b.y, [ux * dirB, uz * dirB], reach, dy, minDy);
    if (!back || Math.hypot(back.x - x, back.z - z) > 3) return null;
    return b;
  }

  const ramp = (v: number, [a, b]: number[]) => Math.max(0, Math.min(1, (v - a) / (b - a)));

  // ------------------------------------------------------------------ the equations
  const rows: Row[] = [];
  const anchor = (v: number, x: number, z: number, sigma: number) => {
    rows.push({ i: [X(v)], c: [1], b: x, w: 1 / sigma }, { i: [Z(v)], c: [1], b: z, w: 1 / sigma });
  };
  // smoothness: the curvature at every point, between its neighbours along the track
  function addCurvature(a: number, b: number, c: number, h1: number, h2: number) {
    const k = 2 / (h1 + h2);
    for (const f of [X, Z]) rows.push({ i: [f(a), f(b), f(c)], c: [k / h1, -k / h1 - k / h2, k / h2], b: 0, w: 1 / SIGMA.curvature });
  }
  for (const p of pieces) {
    const { s, v } = disc.get(p.id)!;
    for (let k = 1; k < v.length - 1; k++) addCurvature(v[k - 1], v[k], v[k + 1], s[k] - s[k - 1], s[k + 1] - s[k]);
  }
  const nextTo = (p: TrackPiece, n: number) => {
    const { s, v } = disc.get(p.id)!;
    return p.from === n ? { v: v[1], h: s[1] } : { v: v[v.length - 2], h: p.length - s[s.length - 2] };
  };
  for (const n of graph.nodes) {
    if (!nodeVar.has(n.id)) continue;
    const at = pieces.filter((p) => p.from === n.id || p.to === n.id);
    const pairs: [number, number][] = n.through ?? (at.length === 2 ? [[at[0].id, at[1].id]] : []);
    for (const [a, b] of pairs) {
      if (!used.has(a) || !used.has(b)) continue;
      const pa = nextTo(graph.pieces[a], n.id), pb = nextTo(graph.pieces[b], n.id);
      addCurvature(pa.v, nodeVar.get(n.id)!, pb.v, pa.h, pb.h);
    }
  }

  // T-Centralen: the model's tracks along its platforms, as in build-heights
  const tcPlatforms = graph.stations.find((s) => s.name === 'T-Centralen')!.platforms.flatMap((p) => p.tracks);
  const onModel = new Map<number, [number, number]>();
  for (const p of pieces) {
    const lines: string[] = p.lines.filter((l) => l === 'red' || l === 'green' || l === 'blue');
    const ranges = tcPlatforms.filter((t) => t.piece === p.id);
    if (!lines.length || !ranges.length) continue;
    const { s, v } = disc.get(p.id)!;
    v.forEach((vi, k) => {
      if (!ranges.some((t) => s[k] >= t.s0 && s[k] <= t.s1)) return;
      let best: [number, number] | null = null, bestD = 3;
      for (const m of model) {
        if (!lines.includes(m.kind)) continue;
        const d = Math.hypot(m.x - vars[vi].x0, m.z - vars[vi].z0);
        if (d < bestD) { bestD = d; best = [m.x, m.z]; }
      }
      if (best) onModel.set(vi, best);
    });
  }

  // OpenStreetMap
  const anchored = new Set<number>();
  for (const p of pieces) {
    const { s, v } = disc.get(p.id)!;
    v.forEach((vi, k) => {
      if (anchored.has(vi)) return;
      anchored.add(vi);
      const m = onModel.get(vi);
      if (m) { anchor(vi, m[0], m[1], SIGMA.model); return; }
      const pl = platformAt(p.id, s[k]) !== null;
      const tunnel = vars[vi].tunnel;
      // track no service runs on is mapped from depot and track plans, not sketched: closely
      // even in tunnels
      if (!services.has(p.id)) { anchor(vi, vars[vi].x0, vars[vi].z0, SIGMA.yard); return; }
      anchor(vi, vars[vi].x0, vars[vi].z0, tunnel ? (pl ? SIGMA.platformTunnel : SIGMA.tunnel) : (pl ? SIGMA.platformOpen : SIGMA.open));
    });
  }

  // the services' track, where it is already fitted
  for (const [vi, v] of vars.entries()) {
    const at = pinned?.get(v.key);
    if (at) anchor(vi, at[0], at[1], SIGMA.pinned);
  }

  // the two tracks of a line, beside each other
  const osmPos = (v: number): [number, number] => [vars[v].x0, vars[v].z0];
  const osmGrid = segmentGrid(osmPos);
  let pairRows = 0, islandRows = 0;
  for (const p of pieces) {
    if (p.structure !== 'tunnel') continue;
    const { s, v } = disc.get(p.id)!;
    v.forEach((vi, k) => {
      if (onModel.has(vi)) return;
      const a = vars[vi];
      const b = mutualPartner(osmGrid, osmPos, p, s[k], a.x0, a.z0, a.y, PAIR_REACH, PAIR_DY[0]);
      if (!b || b.piece.structure !== 'tunnel') return;
      const here = platformAt(p.id, s[k]), there = platformAt(b.piece.id, b.s);
      let target: number, f: number;
      if (here && there && here.osm === there.osm) {
        // an island platform between them
        target = ISLAND_WIDTH + 2 * PLATFORM_EDGE;
        f = 1;
        islandRows++;
      } else {
        target = TRACK_CENTRES;
        f = ramp(-Math.abs(b.dy), [-PAIR_DY[0], -PAIR_DY[1]])
          * ramp(Math.min(mouthDistance(p, s[k]), mouthDistance(b.piece, b.s)), PAIR_FROM_MOUTH)
          * ramp(Math.min(platformDistance(p, s[k]), platformDistance(b.piece, b.s)), PAIR_FROM_PLATFORM);
        if (f < 0.05) return;
        pairRows++;
      }
      rows.push(spacingRow(across(p, s[k], vi, b), target, f));
    });
  }
  // How far the other track is across this one, as a row of unknowns: this point, and the two
  // ends of the other track's segment, measured across this track towards the other one.
  function across(p: TrackPiece, s: number, vi: number, b: Partner): Across {
    const a = vars[vi], [tx, tz] = tangent(p, s);
    const side = Math.sign(-tz * (b.x - a.x0) + tx * (b.z - a.z0)) || 1;
    const bv = disc.get(b.piece.id)!.v;
    return { vi, b0: bv[b.k], b1: bv[b.k + 1], t: b.t, nx: -tz * side, nz: tx * side };
  }
  function spacingRow({ vi, b0, b1, t, nx, nz }: Across, target: number, f: number, sigma = SIGMA.pair): Row {
    return { i: [X(vi), Z(vi), X(b0), Z(b0), X(b1), Z(b1)], c: [-nx, -nz, (1 - t) * nx, (1 - t) * nz, t * nx, t * nz], b: target, w: f / sigma };
  }
  const spacing = (y: Float64Array, { vi, b0, b1, t, nx, nz }: Across) =>
    nx * ((1 - t) * y[X(b0)] + t * y[X(b1)] - y[X(vi)]) + nz * ((1 - t) * y[Z(b0)] + t * y[Z(b1)] - y[Z(vi)]);

  // tracks at different levels, close in plan, that could be held apart
  const apart: { a: Across; f: number }[] = [];
  for (const p of pieces) {
    if (p.structure !== 'tunnel') continue;
    const { s, v } = disc.get(p.id)!;
    v.forEach((vi, k) => {
      if (onModel.has(vi)) return;
      const a = vars[vi];
      const b = mutualPartner(osmGrid, osmPos, p, s[k], a.x0, a.z0, a.y, APART.reach, APART.dy[3], APART.dy[0]);
      if (!b || b.piece.structure !== 'tunnel') return;
      const dy = Math.abs(b.dy), f = ramp(dy, [APART.dy[0], APART.dy[1]]) * (1 - ramp(dy, [APART.dy[2], APART.dy[3]]));
      if (f > 0.05) apart.push({ a: across(p, s[k], vi, b), f });
    });
  }

  // ------------------------------------------------------------------ solve
  // The smoothing is weak, so that the line keeps OpenStreetMap's curves; where it would still curve
  // tighter than the limit, the curvature is held at it, the line solved again, and a hold let go
  // where it no longer pushes, until nothing changes (as build-heights does for gradients).
  const lsq = new LeastSquares(2 * vars.length, rows);
  const bends = pieces.flatMap((p) => {
    const { s, v } = disc.get(p.id)!;
    const hold = services.has(p.id) ? CURVE_HOLD : YARD_CURVE_HOLD;
    return v.slice(1, -1).map((b, k) => ({ a: v[k], b, c: v[k + 2], h1: s[k + 1] - s[k], h2: s[k + 2] - s[k + 1], hold }));
  });
  const curvature = (y: Float64Array, { a, b, c, h1, h2 }: (typeof bends)[number]) => {
    const k = 2 / (h1 + h2);
    return [X, Z].map((f) => k * ((y[f(a)] - y[f(b)]) / h1 + (y[f(c)] - y[f(b)]) / h2));
  };
  // Likewise tracks at different levels are held apart where they come too close.
  const held = new Map<number, [number, number]>(); // bend → the direction it is held in
  const heldApart = new Set<number>();
  let sol = lsq.solve();
  for (let round = 0; round < 40; round++) {
    let changed = 0;
    apart.forEach(({ a }, i) => {
      if (!heldApart.has(i) && spacing(sol, a) < APART.centres - 0.01) { heldApart.add(i); changed++; }
    });
    bends.forEach((bend, i) => {
      const [kx, kz] = curvature(sol, bend), k = Math.hypot(kx, kz);
      const n = held.get(i);
      if (!n && k > 1 / bend.hold) { held.set(i, [kx / k, kz / k]); changed++; }
      else if (n && n[0] * kx + n[1] * kz < 1 / bend.hold - 1e-6) { held.delete(i); changed++; }
    });
    if (!changed) break;
    sol = lsq.solve([...held].flatMap(([i, [nx, nz]]) => {
      const { a, b, c, h1, h2, hold } = bends[i], k = 2 / (h1 + h2);
      const cs = [k / h1, -k / h1 - k / h2, k / h2];
      return [{ i: [X(a), X(b), X(c), Z(a), Z(b), Z(c)], c: [...cs.map((q) => q * nx), ...cs.map((q) => q * nz)], b: 1 / hold, w: 1 / SIGMA.hold }];
    }).concat([...heldApart].map((i) => spacingRow(apart[i].a, APART.centres, apart[i].f, SIGMA.apart))));
  }
  log(`${held.size} points held to a ${CURVE_HOLD} m radius (${YARD_CURVE_HOLD} m off the running lines), ${heldApart.size} held ${APART.centres} m from a track at another level`);
  const pos = (v: number): [number, number] => [sol[X(v)], sol[Z(v)]];
  const moved = vars.map((a, v) => Math.hypot(sol[X(v)] - a.x0, sol[Z(v)] - a.z0));
  log(`${vars.length} points, ${onModel.size} on the T-Centralen model, ${pairRows} pulling the two tracks together, ${islandRows} at island platforms`);
  const pct = (list: number[], q: number) => { const s = [...list].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
  for (const [name, test] of [['open', (a: Var) => !a.tunnel], ['tunnel', (a: Var) => a.tunnel]] as const) {
    const d = moved.filter((_, v) => test(vars[v]));
    log(`moved from OpenStreetMap, ${name}: median ${pct(d, 0.5).toFixed(1)} m, 90% within ${pct(d, 0.9).toFixed(1)} m, at most ${pct(d, 1).toFixed(1)} m`);
  }

  return { pieces, disc, vars, pos, platformAt, platformsOn, mouthDistance, tangent, segmentGrid, mutualPartner, pct };
}
const run = new Set(runningWays(graph).flatMap((r) => r.path.map((st) => st.piece)));
const first = plan(run, null, () => {});
const {
  pieces, disc, vars, pos, platformAt, platformsOn, mouthDistance, tangent, segmentGrid, mutualPartner, pct,
} = plan(lineTrack(graph), new Map(first.vars.map((v, i) => [v.key, first.pos(i)])), console.log);

// ------------------------------------------------------------------ ground and structure
const groundGrid = new Map<string, [number, number, number][]>();
for (const g of ground) {
  const key = `${Math.floor(g[0] / 10)},${Math.floor(g[1] / 10)}`;
  const list = groundGrid.get(key);
  if (list) list.push(g); else groundGrid.set(key, [g]);
}
// the nearest sample within `reach`, or the mean of those within it
function groundAt(x: number, z: number, reach: number, mean = false) {
  let best: number | null = null, bestD = reach, sum = 0, n = 0;
  const r = Math.ceil(reach / 10);
  for (let i = Math.floor(x / 10) - r; i <= Math.floor(x / 10) + r; i++) for (let j = Math.floor(z / 10) - r; j <= Math.floor(z / 10) + r; j++) {
    for (const g of groundGrid.get(`${i},${j}`) ?? []) {
      const d = Math.hypot(g[0] - x, g[1] - z);
      if (d <= reach) { sum += g[2]; n++; }
      if (d < bestD) { bestD = d; best = g[2]; }
    }
  }
  return mean ? (n ? sum / n : null) : best;
}
const within = (fixes: { along: [number, number][]; reach: number }[] | undefined) => (x: number, z: number) => (fixes ?? []).some(({ along, reach }) =>
  along.slice(1).some(([bx, bz], k) => {
    const [ax, az] = along[k], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - ax - t * dx, z - az - t * dz) <= reach;
  }));
const uncovered = within(corrections.uncovered);

const kindOf = (p: TrackPiece, s: number, x: number, z: number, y: number): StructureKind => {
  if (p.structure === 'bridge') return 'bridge';
  if (p.structure === 'tunnel') {
    if (uncovered(x, z) || mouthDistance(p, s) < BOX_AT_MOUTH) return 'box';
    const g = groundAt(x, z, 25, true);
    return g !== null && g - y < BOX_DEPTH ? 'box' : 'rock';
  }
  const g = groundAt(x, z, 12);
  if (g === null) return 'grade';
  return y < g - CUTTING ? 'cutting' : y > g + EMBANKMENT ? 'embankment' : 'grade';
};

const alignedGrid = segmentGrid(pos);
const out: Record<string, GeometryPiece> = {};
for (const p of pieces) {
  const { s, v, cum } = disc.get(p.id)!;
  const piece: GeometryPiece = { s: [], x: [], z: [], y: [], ground: [], kind: [], pair: [], pairDy: [], platforms: [] };
  v.forEach((vi, k) => {
    const [x, z] = pos(vi), y = interp(cum, heights[p.id], s[k]);
    piece.s.push(s[k]); piece.x.push(x); piece.z.push(z); piece.y.push(y);
    piece.ground.push(groundAt(x, z, 12));
    piece.kind.push(STRUCTURE_KINDS.indexOf(kindOf(p, s[k], x, z, y)));
  });
  // short runs merge into the one before (or after, at the start)
  const kinds = piece.kind;
  for (let k = 1; k < kinds.length; k++) {
    if (kinds[k] === kinds[k - 1]) continue;
    let e = k;
    while (e + 1 < kinds.length && kinds[e + 1] === kinds[k]) e++;
    if (s[e] - s[k] < MIN_RUN && e + 1 < kinds.length) for (let j = k; j <= e; j++) kinds[j] = kinds[k - 1];
  }
  out[p.id] = piece;
}

// the other track, where they share a structure
const shareStats = { shared: 0, total: 0 };
for (const p of pieces) {
  const g = out[p.id], { v } = disc.get(p.id)!;
  v.forEach((_, k) => {
    const x = g.x[k], z = g.z[k], y = g.y[k];
    const here = platformAt(p.id, g.s[k]);
    let b = mutualPartner(alignedGrid, pos, p, g.s[k], x, z, y, SHARE_REACH, SHARE_DY);
    // across an island platform they share
    if (!b && here) {
      const c = mutualPartner(alignedGrid, pos, p, g.s[k], x, z, y, ISLAND_WIDTH * 2 + 2 * PLATFORM_EDGE, SHARE_DY);
      if (c && platformAt(c.piece.id, c.s)?.osm === here.osm) b = c;
    }
    if (b && (b.piece.structure === 'tunnel') !== (p.structure === 'tunnel')) b = null;
    shareStats.total += STEP;
    if (!b) { g.pair.push(0); g.pairDy.push(0); return; }
    shareStats.shared += STEP;
    const [tx, tz] = tangent(p, g.s[k]);
    // the tangent is OpenStreetMap's, but the plan turns by less than a degree or two
    g.pair.push(-tz * (b.x - x) + tx * (b.z - z));
    g.pairDy.push(b.dy);
  });
}
// tracks that share a structure share its kind: the shallower one's
const rank: StructureKind[] = ['grade', 'embankment', 'cutting', 'rock', 'box', 'bridge'];
for (let round = 0; round < 2; round++) {
  for (const p of pieces) {
    const g = out[p.id];
    g.kind.forEach((kind, k) => {
      if (!g.pair[k]) return;
      const [tx, tz] = tangent(p, g.s[k]);
      const bx = g.x[k] - tz * g.pair[k], bz = g.z[k] + tx * g.pair[k];
      const other = nearestPoint(bx, bz, p.id);
      if (!other) return;
      const ok = out[other.piece].kind[other.k];
      const pick = rank.indexOf(STRUCTURE_KINDS[ok]) > rank.indexOf(STRUCTURE_KINDS[kind]) ? ok : kind;
      g.kind[k] = pick;
      out[other.piece].kind[other.k] = pick;
    });
  }
}
function nearestPoint(x: number, z: number, not: number) {
  let best: { piece: number; k: number } | null = null, bestD = 2.5;
  for (const sg of alignedGrid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
    if (sg.piece.id === not) continue;
    const g = out[sg.piece.id];
    for (const k of [sg.k, sg.k + 1]) {
      const d = Math.hypot(g.x[k] - x, g.z[k] - z);
      if (d < bestD + STEP / 2) { if (!best || d < bestD) { bestD = d; best = { piece: sg.piece.id, k }; } }
    }
  }
  return best;
}

// The nearest other track on each side of every point, square to it, at about the same level and
// in the same kind of place (in a tunnel or out of one): where track no service runs on lies
// beside other track, they share a hall, a formation or a deck, and at turnouts there is no
// conductor rail.
const NEIGHBOUR_REACH = 12, NEIGHBOUR_DY = 1.5;
const isTunnel = (kind: number) => STRUCTURE_KINDS[kind] === 'rock' || STRUCTURE_KINDS[kind] === 'box';
let besideCount = 0;
for (const p of pieces) {
  const g = out[p.id];
  const left: number[] = [], right: number[] = [];
  g.s.forEach((_, k) => {
    const a = Math.max(0, k - 1), b = Math.min(g.s.length - 1, k + 1);
    const l = Math.hypot(g.x[b] - g.x[a], g.z[b] - g.z[a]) || 1;
    const tx = (g.x[b] - g.x[a]) / l, tz = (g.z[b] - g.z[a]) / l;
    let bestL = 0, bestR = 0;
    const r = Math.ceil(NEIGHBOUR_REACH / CELL);
    const seen = new Set<Seg>();
    for (let i = Math.floor(g.x[k] / CELL) - r; i <= Math.floor(g.x[k] / CELL) + r; i++) for (let j = Math.floor(g.z[k] / CELL) - r; j <= Math.floor(g.z[k] / CELL) + r; j++) {
      for (const sg of alignedGrid.get(`${i},${j}`) ?? []) {
        if (sg.piece.id === p.id || seen.has(sg)) continue;
        seen.add(sg);
        const o = out[sg.piece.id], m = sg.k;
        // where the line square to this track crosses the other track's segment
        const ax = o.x[m] - g.x[k], az = o.z[m] - g.z[k], bx = o.x[m + 1] - g.x[k], bz = o.z[m + 1] - g.z[k];
        const da = ax * tx + az * tz, db = bx * tx + bz * tz;
        if (da * db > 0 || da === db) continue;
        const t = da / (da - db);
        const lat = -tz * (ax + (bx - ax) * t) + tx * (az + (bz - az) * t);
        const dy = o.y[m] + (o.y[m + 1] - o.y[m]) * t - g.y[k];
        const kind = t < 0.5 ? o.kind[m] : o.kind[m + 1];
        if (Math.abs(lat) < 0.5 || Math.abs(lat) > NEIGHBOUR_REACH || Math.abs(dy) > NEIGHBOUR_DY || isTunnel(kind) !== isTunnel(g.kind[k])) continue;
        // a service's track is given as a negative distance
        const d = run.has(sg.piece.id) ? -Math.abs(lat) : Math.abs(lat);
        if (lat > 0 && (!bestR || Math.abs(lat) < Math.abs(bestR))) bestR = d;
        if (lat < 0 && (!bestL || Math.abs(lat) < Math.abs(bestL))) bestL = d;
      }
    }
    left.push(bestL); right.push(bestR);
    if (bestL || bestR) besideCount++;
  });
  if (left.some((v) => v) || right.some((v) => v)) { g.left = left; g.right = right; }
}
console.log(`${besideCount} points beside another track within ${NEIGHBOUR_REACH} m`);

// Platforms. An island platform reaches to the other track beside it at the same platform;
// another platform is as wide as SIDE_PLATFORM_WIDTH, or as fits before the next track.
// T-Centralen's are in the station model.
const MIN_PLATFORM = 2;
const dropped: string[] = [];
for (const p of pieces) {
  for (const r of platformsOn.get(p.id) ?? []) {
    if (r.station === 'T-Centralen') continue;
    const st = graph.stations.find((s) => s.name === r.station)!;
    const pl = st.platforms.find((q) => q.osm === r.osm)!;
    const g = out[p.id];
    // Square to the platform's track at each of its points, the nearest track on the platform's
    // side and whether that track is at this platform; then the median of these. Measured at each
    // point since platforms may be on a curve, and leaving out the ends, where the tracks part or
    // close in.
    const margin = Math.min(20, (r.s1 - r.s0) / 4);
    const found: { lateral: number; island: boolean }[] = [];
    for (let k = 0; k < g.s.length; k++) {
      if (g.s[k] < r.s0 + margin || g.s[k] > r.s1 - margin) continue;
      const a = Math.max(0, k - 1), b = Math.min(g.s.length - 1, k + 1);
      const l = Math.hypot(g.x[b] - g.x[a], g.z[b] - g.z[a]) || 1;
      const tx = (g.x[b] - g.x[a]) / l, tz = (g.z[b] - g.z[a]) / l;
      let best = { lateral: Infinity, island: false };
      for (const q of pieces) {
        if (q.id === p.id) continue;
        const o = out[q.id], atPlatform = pl.tracks.filter((t) => t.piece === q.id);
        for (let j = 0; j < o.s.length; j++) {
          if (Math.abs(o.y[j] - g.y[k]) > 3) continue;
          const dx = o.x[j] - g.x[k], dz = o.z[j] - g.z[k];
          if (Math.abs(tx * dx + tz * dz) > STEP / 2) continue;
          const lateral = (-tz * dx + tx * dz) * r.side;
          if (lateral < 1 || lateral > 30) continue;
          // (OSM may match only part of the other track to the platform)
          const island = atPlatform.length > 0;
          // where two tracks are as near, the one at this platform
          if (lateral < best.lateral - 0.3 || (island && lateral < best.lateral + 0.3)) best = { lateral: Math.min(lateral, best.lateral), island };
        }
      }
      found.push(best);
    }
    found.sort((a, b) => a.lateral - b.lateral);
    const { lateral: across, island } = found.length ? found[Math.floor(found.length / 2)] : { lateral: Infinity, island: false };
    const width = island ? across - 2 * PLATFORM_EDGE : Math.min(SIDE_PLATFORM_WIDTH, across - 2 * PLATFORM_EDGE - 0.5);
    if (width < MIN_PLATFORM) { dropped.push(`${r.station} (piece ${p.id})`); continue; }
    g.platforms.push({ station: r.station, s0: r.s0, s1: r.s1, side: r.side, width: Math.round(width * 100) / 100, island });
  }
}
if (dropped.length) console.warn(`platforms with no room beside their track, not drawn: ${dropped.join(', ')}`);

// ------------------------------------------------------------------ write
const r2 = (n: number) => Math.round(n * 100) / 100;
for (const g of Object.values(out)) {
  for (const k of ['s', 'x', 'z', 'y', 'pair', 'pairDy'] as const) g[k] = g[k].map(r2);
  if (g.left) { g.left = g.left.map(r2); g.right = g.right!.map(r2); }
  g.ground = g.ground.map((n) => (n === null ? null : r2(n)));
}
const result: TrackGeometry = {
  attribution: JSON.parse(readFileSync('public/data/track-heights.json', 'utf8')).attribution,
  osm: graph.osm,
  note: 'The track the game draws, per piece of the red line\'s track in public/data/track-graph.json (the pieces its services run on, and the crossovers, sidings and depots joined to them). Format in src/track-geometry.ts.',
  pieces: out,
};
writeFileSync(OUT, JSON.stringify(result) + '\n');
console.log(`wrote ${OUT}`);

// ------------------------------------------------------------------ report
const lengths: Record<string, number> = {};
for (const p of pieces) {
  const g = out[p.id];
  for (let k = 1; k < g.s.length; k++) {
    const kind = STRUCTURE_KINDS[g.kind[k - 1]];
    lengths[kind] = (lengths[kind] ?? 0) + (g.s[k] - g.s[k - 1]);
  }
}
console.log(`structures: ${Object.entries(lengths).map(([k, l]) => `${k} ${(l / 1000).toFixed(1)} km`).join(', ')}; ${Math.round(100 * shareStats.shared / shareStats.total)}% of the track shares its structure with the other track`);
const centres = pieces.flatMap((p) => out[p.id].pair.filter((d, k) => d && out[p.id].kind[k] === STRUCTURE_KINDS.indexOf('rock') && !platformAt(p.id, out[p.id].s[k])).map(Math.abs));
console.log(`track centres in shared rock tunnels: median ${pct(centres, 0.5).toFixed(2)} m, 5–95% ${pct(centres, 0.05).toFixed(2)}–${pct(centres, 0.95).toFixed(2)} m`);

// the tightest curves, away from switches
const problems: string[] = [];
const switches = graph.nodes.filter((n) => n.kind === 'switch' || n.kind === 'crossing');
const near = (x: number, z: number) => graph.stations.reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a)).name;
for (const route of graph.routes) {
  const pts: { x: number; z: number; platform: boolean }[] = [];
  for (const step of route.path) {
    const g = out[step.piece];
    const idx = g.s.map((_, k) => k);
    if (step.dir < 0) idx.reverse();
    for (const k of idx) {
      const q = { x: g.x[k], z: g.z[k], platform: !!platformAt(step.piece, g.s[k]) };
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(last.x - q.x, last.z - q.z) > 0.5) pts.push(q);
    }
  }
  let worst = { r: Infinity, at: '' }, worstPlatform = { r: Infinity, at: '' };
  for (let i = 2; i + 2 < pts.length; i++) {
    const a = pts[i - 2], b = pts[i], c = pts[i + 2];
    if (switches.some((n) => Math.hypot(n.x - b.x, n.z - b.z) < 40)) continue;
    const ab = Math.hypot(b.x - a.x, b.z - a.z), bc = Math.hypot(c.x - b.x, c.z - b.z), ac = Math.hypot(c.x - a.x, c.z - a.z);
    const cross = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
    const r = cross > 1e-9 ? (ab * bc * ac) / (2 * cross) : Infinity;
    if (r < worst.r) worst = { r, at: near(b.x, b.z) };
    if (b.platform && r < worstPlatform.r) worstPlatform = { r, at: near(b.x, b.z) };
  }
  console.log(`${route.name}: tightest curve ${Math.round(worst.r)} m near ${worst.at}, at a platform ${Math.round(worstPlatform.r)} m at ${worstPlatform.at}`);
  if (worst.r < CURVE_LIMIT * 0.95) problems.push(`${route.name}: a curve of ${Math.round(worst.r)} m near ${worst.at} (limit ${CURVE_LIMIT} m)`);
}
// tunnels that cut into each other: tracks at different levels, too close to share a tunnel or
// to pass one over the other
const clashes = new Map<string, number>();
const tunnelPoints = pieces.filter((p) => p.structure === 'tunnel').flatMap((p) => out[p.id].s.map((_, k) => ({ p, k })));
for (const a of tunnelPoints) {
  const ga = out[a.p.id];
  for (const b of tunnelPoints) {
    if (b.p.id <= a.p.id) continue;
    const gb = out[b.p.id], d = Math.hypot(ga.x[a.k] - gb.x[b.k], ga.z[a.k] - gb.z[b.k]), dy = Math.abs(ga.y[a.k] - gb.y[b.k]);
    if (d < 5 && dy > SHARE_DY && dy < 5.5) {
      const key = `near ${near(ga.x[a.k], ga.z[a.k])} (pieces ${a.p.id} and ${b.p.id})`;
      clashes.set(key, Math.min(clashes.get(key) ?? Infinity, d));
    }
  }
}
for (const [where, d] of clashes) console.warn(`tunnels cut into each other ${where}: ${d.toFixed(1)} m apart at different levels`);
if (problems.length) {
  console.error(`outside the limits:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
