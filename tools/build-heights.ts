// Gives the drawn lines' track its heights (the red, green and blue lines), and checks them against the
// design limits.
//
//   node tools/build-heights.ts
//
// Reads public/data/track-graph.json, data/station-heights.json (Wikidata), the T-Centralen
// model, data/ground/<line>-line.json (Lantmäteriet's elevation model) when they are there,
// data/osm/buildings.json (for the depots), and the fixes to these in data/height-corrections.json; writes
// public/data/track-heights.json: the height of the top of the rail (RH 2000) at every point of
// every piece of the lines' track: what their services run on, and the crossovers, sidings and
// depots joined to that (tools/lib/graph.ts lineTrack).
//
// Every piece is cut into points about 10 m apart, joined at the graph's nodes, and the heights
// are the smoothest line through these, by least squares:
// - stations: the platform tracks sit 1.0 m below the station's height from Wikidata, which is
//   taken to be the platform's level (unless data/height-corrections.json fixes it, or gives the
//   station's depth under the ground instead: Wikidata has none of the green line's), and are held
//   level along the platform
// - the stations drawn from a model (T-Centralen, which Wikidata lacks, Odenplan and Fridhemsplan):
//   the heights of the model's tracks along their platforms instead, which are drawn at platform
//   level, also 1.0 m above the rail
// - surface track: 0.2 m above the ground, except on the last 30 m to a bridge, and a depot's
//   track through its halls and other buildings; bridges: no anchor, the line is carried across,
//   but held a clearance above the ground where the corrections say a street passes under
// - tunnels: below the ground with at least 6 m of cover, except near their mouths and along
//   platforms (the ground over a covered station such as Gamla stan is its roof), and where the
//   corrections say the line is in a trough rather than a bored tunnel
// - the gradient: no steeper than 37‰
// - the services' vertical curves: no tighter than their line's limit
// Then the result is checked against the 1975 limits: 40‰ at most, 10‰ along platforms, vertical
// curves of at least 2,000 m radius on the red line, 1,500 m on the green and 4,000 m on the blue.
// The build fails on anything clearly outside them, and lists it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { runningWays } from '../src/track-graph.ts';
import type { TrackGraph, TrackPiece } from '../src/track-graph.ts';
import { groundSamples, lineTrack, mouthDistances, pointAt, routeProfile } from './lib/graph.ts';
import { LeastSquares } from './lib/least-squares.ts';
import type { Row } from './lib/least-squares.ts';
import { loadStationModel, modelPlatforms, placeSample } from './lib/station-model.ts';

const OUT = 'public/data/track-heights.json';
const CORRECTIONS = 'data/height-corrections.json';
const BUILDINGS = 'data/osm/buildings.json';
const STEP = 10;
const PLATFORM_ABOVE_RAIL = 1.0;
const LIMITS = { gradient: 0.040, platformGradient: 0.010, cover: 6, yardCover: 3 };
// the tightest vertical curve of each line (the 1975 description: the green line was built to
// 1,500 m, the red to 2,000 m, the blue to 4,000 m)
const VERTICAL_RADIUS: Record<string, number> = { green: 1500, red: 2000, blue: 4000 };
// how far each kind of anchor may be off, in metres (or 1/m for curvature, and m/m for gradients)
const SIGMA = { station: 0.7, model: 0.3, ground: 1.0, cover: 0.1, curvature: 1 / 4000, platformGradient: 0.002, platformLevel: 0.1, grade: 0.001, bend: 1e-5, level: 50, pinned: 0.01, siding: 0.05 };
// a siding is laid at the height of a running line this close beside it in a tunnel
const SIDING_REACH = 9;
let sidingAnchors = 0;
// the gradient the line is held to where it would be steeper
const GRADE_HOLD = 0.037;

const graph: TrackGraph = JSON.parse(readFileSync('public/data/track-graph.json', 'utf8'));
const stationHeights: Record<string, { height: number }> = JSON.parse(readFileSync('data/station-heights.json', 'utf8')).stations;
interface Corrections {
  // a station's platform level, or how deep it is under the ground over its platform tracks
  stations?: { station: string; height?: number; depth?: number; why: string }[];
  uncovered?: Segment[];
  offGround?: Segment[];
  // bridges with a road or a valley under them: the rail at least `clearance` above the ground
  raised?: (Segment & { clearance: number })[];
}
interface Segment { along: [number, number][]; reach: number; why: string }
const corrections: Corrections = existsSync(CORRECTIONS) ? JSON.parse(readFileSync(CORRECTIONS, 'utf8')) : {};
const ground = groundSamples(graph);
for (const c of corrections.stations ?? []) {
  const st = graph.stations.find((s) => s.name === c.station);
  if (!st) throw new Error(`${CORRECTIONS}: no station ${c.station}`);
  if (c.height !== undefined) { stationHeights[c.station] = { height: c.height }; continue; }
  if (c.depth === undefined) throw new Error(`${CORRECTIONS}: ${c.station} has neither a height nor a depth`);
  // the ground within 30 m of the middle of its platform tracks
  const mids = st.platforms.flatMap((p) => p.tracks.map((t) => pointAt(graph.pieces[t.piece], (t.s0 + t.s1) / 2)));
  const over = ground.filter(([x, z]) => mids.some(([mx, mz]) => Math.hypot(x - mx, z - mz) < 30));
  if (!over.length) { console.warn(`${c.station}: no ground over its platforms, so its depth is not used`); continue; }
  stationHeights[c.station] = { height: over.reduce((a, g) => a + g[2], 0) / over.length - c.depth };
}
// within reach of the line of any of the fixes
const within = (fixes: Segment[] | undefined) => (x: number, z: number) => (fixes ?? []).some(({ along, reach }) =>
  along.slice(1).some(([bx, bz], k) => {
    const [ax, az] = along[k], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - ax - t * dx, z - az - t * dz) <= reach;
  }));
// tunnel that needs no cover, and surface track that isn't on the ground
const uncovered = within(corrections.uncovered), offGround = within(corrections.offGround);
const clearanceAt = (x: number, z: number) => {
  const fix = (corrections.raised ?? []).find((f) => within([f])(x, z));
  return fix ? fix.clearance : null;
};
// OpenStreetMap's buildings (tools/fetch-city.ts), for the depots' track: under a large building
// the elevation model may follow the roof
const buildingRings: number[][] = existsSync(BUILDINGS)
  ? JSON.parse(readFileSync(BUILDINGS, 'utf8')).buildings.filter((b: { tags: Record<string, string> }) => !b.tags['building:part']).map((b: { rings: number[][] }) => b.rings[0])
  : [];
const buildingGrid = new Map<string, number[][]>();
for (const r of buildingRings) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let k = 0; k < r.length; k += 2) { x0 = Math.min(x0, r[k]); x1 = Math.max(x1, r[k]); z0 = Math.min(z0, r[k + 1]); z1 = Math.max(z1, r[k + 1]); }
  for (let i = Math.floor(x0 / 50); i <= Math.floor(x1 / 50); i++) for (let j = Math.floor(z0 / 50); j <= Math.floor(z1 / 50); j++) {
    (buildingGrid.get(`${i},${j}`) ?? buildingGrid.set(`${i},${j}`, []).get(`${i},${j}`)!).push(r);
  }
}
// inside a building, or within `margin` of its walls (where the model rises to the roof)
const inBuilding = (x: number, z: number, margin = 8) => (buildingGrid.get(`${Math.floor(x / 50)},${Math.floor(z / 50)}`) ?? []).some((r) => {
  let c = false;
  for (let i = 0, j = r.length / 2 - 1; i < r.length / 2; j = i++) {
    const xi = r[2 * i], zi = r[2 * i + 1], xj = r[2 * j], zj = r[2 * j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    const dx = xi - xj, dz = zi - zj, t = Math.max(0, Math.min(1, ((x - xj) * dx + (z - zj) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - xj - dx * t, z - zj - dz * t) < margin) return true;
  }
  return c;
});
if (!ground.length) console.warn(`data/ground/<line>-line.json missing: no ground anchors, and tunnel cover is not checked`);

// ------------------------------------------------------------------ the fit
// The fit is made twice: first the services' track alone, then all of the lines' track with
// the services' track pinned where the first fit put it, so that the crossovers, sidings and
// depots are fitted to the line and don't move it.
const run = new Set(runningWays(graph).flatMap((r) => r.path.map((st) => st.piece)));
// the line a piece belongs to: as OpenStreetMap names it, or the line of the services on it
const serviceLine = new Map(runningWays(graph).flatMap((r) => r.path.map((st) => [st.piece, r.line] as const)));
const lineOf = (p: TrackPiece) => p.lines[0] ?? serviceLine.get(p.id) ?? '';
const STACKED = 6.5, CROSS_REACH = 7, JOINED = 250;
interface Var { x: number; z: number; key: string }
const placements = JSON.parse(readFileSync('public/data/stations.json', 'utf8'));
// the stations drawn from a model, with their tracks placed
const models = await Promise.all(Object.entries(placements as Record<string, { name: string; rotationY: number; position: [number, number, number] }>)
  .map(async ([file, place]) => ({ station: place.name, samples: (await loadStationModel(file)).samples.map((s) => placeSample(s, place)) })));
// the model's track under a point of a platform track there (tools/lib/station-model.ts)
const unders = models.map(({ station, samples }) => modelPlatforms(graph, station, samples));
const modelUnder = (piece: number, s: number, x: number, z: number) => {
  for (const under of unders) {
    const m = under(piece, s, x, z);
    if (m) return m;
  }
  return null;
};

function fit(used: Set<number>, pinned: Map<string, number> | null) {
  // ------------------------------------------------------------------ the unknowns
  const pieces = graph.pieces.filter((p) => used.has(p.id));
  const vars: Var[] = [];
  const nodeVar = new Map<number, number>();
  const node = new Map(graph.nodes.map((n) => [n.id, n]));
  const varOfNode = (id: number) => {
    if (!nodeVar.has(id)) { nodeVar.set(id, vars.length); vars.push({ x: node.get(id)!.x, z: node.get(id)!.z, key: `n${id}` }); }
    return nodeVar.get(id)!;
  };
  // for each piece: its points' distances along it, and their unknowns
  const disc = new Map<number, { s: number[]; v: number[] }>();
  for (const p of pieces) {
    const n = Math.max(1, Math.ceil(p.length / STEP));
    const s: number[] = [], v: number[] = [];
    for (let k = 0; k <= n; k++) {
      s.push((p.length * k) / n);
      if (k === 0) v.push(varOfNode(p.from));
      else if (k === n) v.push(varOfNode(p.to));
      else { const [x, z] = pointAt(p, s[k]); v.push(vars.length); vars.push({ x, z, key: `${p.id}:${k}` }); }
    }
    disc.set(p.id, { s, v });
  }

  // ------------------------------------------------------------------ the equations
  // Each row asks sum(c·y) = b, with weight 1/sigma.
  const rows: Row[] = [];
  const addAnchor = (v: number, b: number, sigma: number) => rows.push({ i: [v], c: [1], b, w: 1 / sigma });

  // smoothness: the curvature at every point, between its neighbours along the track
  function addCurvature(a: number, b: number, c: number, h1: number, h2: number) {
    const k = 2 / (h1 + h2);
    rows.push({ i: [a, b, c], c: [k / h1, -k / h1 - k / h2, k / h2], b: 0, w: 1 / SIGMA.curvature });
  }
  for (const p of pieces) {
    const { s, v } = disc.get(p.id)!;
    for (let k = 1; k < v.length - 1; k++) addCurvature(v[k - 1], v[k], v[k + 1], s[k] - s[k - 1], s[k + 1] - s[k]);
  }
  // ... and across the nodes, between pieces a train runs through
  const inScope = (id: number) => used.has(id);
  const nextTo = (p: TrackPiece, n: number) => {
    const { s, v } = disc.get(p.id)!;
    return p.from === n ? { v: v[1], h: s[1] } : { v: v[v.length - 2], h: p.length - s[s.length - 2] };
  };
  for (const n of graph.nodes) {
    if (!nodeVar.has(n.id)) continue;
    const at = pieces.filter((p) => p.from === n.id || p.to === n.id);
    const pairs: [number, number][] = n.through ?? (at.length === 2 ? [[at[0].id, at[1].id]] : []);
    for (const [a, b] of pairs) {
      if (!inScope(a) || !inScope(b)) continue;
      const pa = nextTo(graph.pieces[a], n.id), pb = nextTo(graph.pieces[b], n.id);
      addCurvature(pa.v, nodeVar.get(n.id)!, pb.v, pa.h, pb.h);
    }
  }
  // a very weak pull towards sea level keeps the system solvable where nothing else anchors it
  for (let v = 0; v < vars.length; v++) addAnchor(v, 0, SIGMA.level);
  // the services' track, where it is already fitted
  vars.forEach((vv, vi) => { const h = pinned?.get(vv.key); if (h !== undefined) addAnchor(vi, h, SIGMA.pinned); });
  // A siding in a tunnel beside a running line, or between the two (a turnback track), at the
  // running line's height: they are laid on one floor. (On its own, it would be fitted only to
  // its ends, and could stand a metre above the track beside it.)
  if (pinned) {
    const dirOf = (p: TrackPiece, k: number) => {
      const { v } = disc.get(p.id)!, a = vars[v[Math.max(0, k - 1)]], b = vars[v[Math.min(v.length - 1, k + 1)]];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      return [(b.x - a.x) / l, (b.z - a.z) / l];
    };
    const beside: { x: number; z: number; h: number; d: number[] }[] = [];
    for (const p of pieces) {
      if (!run.has(p.id) || p.structure !== 'tunnel') continue;
      disc.get(p.id)!.v.forEach((vi, k) => { const h = pinned.get(vars[vi].key); if (h !== undefined) beside.push({ x: vars[vi].x, z: vars[vi].z, h, d: dirOf(p, k) }); });
    }
    for (const p of pieces) {
      if (run.has(p.id) || p.structure !== 'tunnel' || (p.service !== 'siding' && p.service !== 'spur')) continue;
      disc.get(p.id)!.v.forEach((vi, k) => {
        if (pinned.has(vars[vi].key)) return;
        const d = dirOf(p, k);
        let best: { h: number; dist: number } | null = null;
        for (const b of beside) {
          const dist = Math.hypot(b.x - vars[vi].x, b.z - vars[vi].z);
          if (dist < SIDING_REACH && Math.abs(b.d[0] * d[0] + b.d[1] * d[1]) > 0.95 && (!best || dist < best.dist)) best = { h: b.h, dist };
        }
        if (best) { addAnchor(vi, best.h, SIGMA.siding); sidingAnchors++; }
      });
    }
  }

  // stations: their platform tracks
  const stationRows: { name: string; v: number; b: number }[] = [];
  for (const st of graph.stations) {
    const h = stationHeights[st.name]?.height;
    if (h === undefined) continue;
    for (const pl of st.platforms) {
      for (const t of pl.tracks) {
        const d = disc.get(t.piece);
        if (!d) continue;
        d.s.forEach((s, k) => {
          // where a model draws the platform, its track's height is taken instead (below)
          if (s < t.s0 || s > t.s1 || modelUnder(t.piece, s, vars[d.v[k]].x, vars[d.v[k]].z)) return;
          addAnchor(d.v[k], h - PLATFORM_ABOVE_RAIL, SIGMA.station);
          stationRows.push({ name: st.name, v: d.v[k], b: h - PLATFORM_ABOVE_RAIL });
        });
      }
    }
  }

  // ... and are level along their length: the smoothing must not tilt them to meet the line on
  // either side
  const onPlatform = new Set(stationRows.map((r) => r.v));
  // A station with no known height still has its platform tracks level with each other, as well
  // as along their length: each track's points are held to the same height as the station's first
  // platform point.
  for (const st of graph.stations) {
    if (stationHeights[st.name] || st.name === 'T-Centralen') continue;
    let first: number | null = null;
    for (const pl of st.platforms) {
      for (const t of pl.tracks) {
        const d = disc.get(t.piece);
        if (!d) continue;
        d.s.forEach((s, k) => {
          if (s < t.s0 || s > t.s1) return;
          onPlatform.add(d.v[k]);
          if (first === null) first = d.v[k];
          else if (first !== d.v[k]) rows.push({ i: [first, d.v[k]], c: [1, -1], b: 0, w: 1 / SIGMA.platformLevel });
        });
      }
    }
  }
  for (const p of pieces) {
    const { s, v } = disc.get(p.id)!;
    for (let k = 1; k < v.length; k++) {
      if (!onPlatform.has(v[k]) || !onPlatform.has(v[k - 1])) continue;
      const h = s[k] - s[k - 1];
      rows.push({ i: [v[k - 1], v[k]], c: [-1 / h, 1 / h], b: 0, w: 1 / SIGMA.platformGradient });
    }
  }

  // The stations drawn from a model: the model's tracks along their platforms (tools/lib/
  // station-model.ts). Beyond the platforms the models only sketch where the tunnels go:
  // T-Centralen's tunnel ends drop at up to 70‰, so they are left out.
  let modelAnchors = 0;
  for (const p of pieces) {
    const { s: ss, v } = disc.get(p.id)!;
    v.forEach((vi, k) => {
      const m = modelUnder(p.id, ss[k], vars[vi].x, vars[vi].z);
      if (m) { addAnchor(vi, m.y - PLATFORM_ABOVE_RAIL, SIGMA.model); modelAnchors++; }
    });
  }

  // the ground under every point, if known (nearest sample within 6 m)
  const groundGrid = new Map<string, [number, number, number][]>();
  for (const g of ground) {
    const key = `${Math.floor(g[0] / 10)},${Math.floor(g[1] / 10)}`;
    const list = groundGrid.get(key);
    if (list) list.push(g); else groundGrid.set(key, [g]);
  }
  const groundAt = (x: number, z: number) => {
    let best: number | null = null, bestD = 6;
    for (let i = Math.floor(x / 10) - 1; i <= Math.floor(x / 10) + 1; i++) for (let j = Math.floor(z / 10) - 1; j <= Math.floor(z / 10) + 1; j++) {
      for (const g of groundGrid.get(`${i},${j}`) ?? []) {
        const d = Math.hypot(g[0] - x, g[1] - z);
        if (d < bestD) { bestD = d; best = g[2]; }
      }
    }
    return best;
  };

  // how far each point of a tunnel is from its nearest tunnel mouth, through tunnel pieces
  const mouthDistance = new Map<number, number>();
  {
    const atNode = mouthDistances(graph, pieces);
    for (const p of pieces) {
      if (p.structure !== 'tunnel') continue;
      const { s, v } = disc.get(p.id)!;
      v.forEach((vi, k) => mouthDistance.set(vi, Math.min(
        (atNode.get(p.from) ?? Infinity) + s[k], (atNode.get(p.to) ?? Infinity) + p.length - s[k], mouthDistance.get(vi) ?? Infinity)));
    }
  }

  const structureOf = new Map<number, TrackPiece['structure']>();
  for (const p of pieces) for (const vi of disc.get(p.id)!.v) if (!structureOf.has(vi) || p.structure !== 'surface') structureOf.set(vi, p.structure);
  // A depot's track through its halls, and the rest of the track no service runs on where it is
  // inside a building: the elevation model there is guessed from the ground around, or follows
  // the roof, so the track is carried level from the yard outside.
  const covered = new Set(pieces.filter((p) => p.covered).flatMap((p) => disc.get(p.id)!.v.slice(1, -1)));
  const onRun = new Set(pieces.filter((p) => run.has(p.id)).flatMap((p) => disc.get(p.id)!.v));
  for (const p of pieces) {
    for (const vi of disc.get(p.id)!.v) if (!onRun.has(vi) && inBuilding(vars[vi].x, vars[vi].z)) covered.add(vi);
  }
  let groundAnchors = 0;
  const groundOf = vars.map((v) => groundAt(v.x, v.z));
  // the ground a tunnel's cover is measured from: the mean within 25 m, since a tunnel may pass
  // with less cover under something short, such as a channel or a road in a cutting
  const coverGround = vars.map((v) => {
    let sum = 0, n = 0;
    for (let i = Math.floor(v.x / 10) - 3; i <= Math.floor(v.x / 10) + 3; i++) for (let j = Math.floor(v.z / 10) - 3; j <= Math.floor(v.z / 10) + 3; j++) {
      for (const g of groundGrid.get(`${i},${j}`) ?? []) if (Math.hypot(g[0] - v.x, g[1] - v.z) <= 25) { sum += g[2]; n++; }
    }
    return n ? sum / n : null;
  });
  // Surface track next to a bridge is on the embankment up to it, which OSM counts as surface for a
  // few metres more than the ground is level: no ground anchor there.
  const bridgeEnds = graph.nodes.filter((n) => nodeVar.has(n.id)
    && pieces.some((p) => p.structure === 'bridge' && (p.from === n.id || p.to === n.id))
    && pieces.some((p) => p.structure !== 'bridge' && (p.from === n.id || p.to === n.id)));
  const onGround = (vi: number) => structureOf.get(vi) === 'surface' && groundOf[vi] !== null && !covered.has(vi)
    && !bridgeEnds.some((n) => Math.hypot(n.x - vars[vi].x, n.z - vars[vi].z) < 30) && !offGround(vars[vi].x, vars[vi].z);
  vars.forEach((_, vi) => {
    if (onGround(vi)) { addAnchor(vi, groundOf[vi]! + 0.2, SIGMA.ground); groundAnchors++; }
  });

  // ------------------------------------------------------------------ solve
  const lsq = new LeastSquares(vars.length, rows);
  const solve = (extra: Row[]) => lsq.solve(extra);

  // Two limits the smoothest line doesn't keep by itself, enforced by holding the line where it
  // breaks them, solving again, and letting go wherever a hold is no longer pushing, until nothing
  // changes:
  // - tunnels must stay under the ground, away from their mouths (a depot's tunnels and the
  //   other track no service runs on with less cover: they may be concrete boxes built in a
  //   trench, and are short)
  // - the gradient: between level stations the smoothest line is an S whose middle is half as
  //   steep again as the average, where a real line runs at an even grade between short vertical
  //   curves; so it is held to just under the limit
  const coverAt = (vi: number) => {
    const g = coverGround[vi];
    if (g === null || structureOf.get(vi) !== 'tunnel' || (mouthDistance.get(vi) ?? Infinity) < 120 || onPlatform.has(vi)
      || uncovered(vars[vi].x, vars[vi].z)) return null;
    return g - (onRun.has(vi) ? LIMITS.cover : LIMITS.yardCover);
  };
  // - bridges the corrections raise: at least their clearance above the ground under them, but
  //   for a station on them
  const floorAt = (vi: number) => {
    const g = groundOf[vi], c = structureOf.get(vi) === 'bridge' && !onPlatform.has(vi) ? clearanceAt(vars[vi].x, vars[vi].z) : null;
    return g === null || c === null ? null : g + c;
  };
  const steps = pieces.flatMap((p) => {
    const { s, v } = disc.get(p.id)!;
    return v.slice(1).map((b, k) => ({ a: v[k], b, h: s[k + 1] - s[k] }));
  });
  // - and the vertical curves of the services' track, which the ground may bend tighter than
  //   its line was built to: held at the line's limit
  const bends = pieces.filter((p) => run.has(p.id)).flatMap((p) => {
    const { s, v } = disc.get(p.id)!;
    const radius = VERTICAL_RADIUS[lineOf(p)] ?? 2000;
    return v.slice(1, -1).map((b, k) => ({ a: v[k], b, c: v[k + 2], h1: s[k + 1] - s[k], h2: s[k + 2] - s[k + 1], radius }));
  }).concat(graph.nodes.flatMap((n) => {
    // ... and across the nodes, between the services' pieces a train runs through
    if (!nodeVar.has(n.id)) return [];
    const at = pieces.filter((p) => run.has(p.id) && (p.from === n.id || p.to === n.id));
    const pairs: [number, number][] = n.through ?? (at.length === 2 ? [[at[0].id, at[1].id]] : []);
    return pairs.filter(([a, b]) => run.has(a) && run.has(b) && used.has(a) && used.has(b)).map(([a, b]) => {
      const pa = nextTo(graph.pieces[a], n.id), pb = nextTo(graph.pieces[b], n.id);
      return { a: pa.v, b: nodeVar.get(n.id)!, c: pb.v, h1: pa.h, h2: pb.h, radius: VERTICAL_RADIUS[lineOf(graph.pieces[a])] ?? 2000 };
    });
  }));
  const bendRow = ({ a, b, c, h1, h2 }: (typeof bends)[number]) => {
    const k = 2 / (h1 + h2);
    return { i: [a, b, c], c: [k / h1, -k / h1 - k / h2, k / h2] };
  };
  const bendOf = (bend: (typeof bends)[number]) => {
    const { i, c } = bendRow(bend);
    return i.reduce((sum, vi, j) => sum + c[j] * y[vi], 0);
  };
  // Tracks that cross one over the other without joining have their rails at least STACKED apart,
  // so that one structure passes over the other. OpenStreetMap says which is above (its layer, or
  // level); where two points of pieces at different layers are within CROSS_REACH in plan, more
  // than JOINED apart along the track (so not where a track rises out of a junction), and their
  // rails less than STACKED apart, the one above is held STACKED above the other. A service's own
  // track stays where it is, and the other one moves.
  const pieceOfVar = new Map<number, { p: TrackPiece; s: number }>();
  for (const p of pieces) {
    const { s, v } = disc.get(p.id)!;
    v.slice(1, -1).forEach((vi, k) => pieceOfVar.set(vi, { p, s: s[k + 1] }));
  }
  const piecesAtNode = new Map<number, TrackPiece[]>();
  for (const p of pieces) for (const n of new Set([p.from, p.to])) (piecesAtNode.get(n) ?? piecesAtNode.set(n, []).get(n)!).push(p);
  // how far apart two points are along the track, up to `limit`
  function alongTrack(a: { p: TrackPiece; s: number }, b: { p: TrackPiece; s: number }, limit: number) {
    if (a.p === b.p) return Math.abs(a.s - b.s);
    const dist = new Map<number, number>([[a.p.from, a.s], [a.p.to, Math.min(a.p.length - a.s, a.p.from === a.p.to ? a.s : Infinity)]]);
    const queue = [...dist.keys()];
    while (queue.length) {
      const n = queue.shift()!, d = dist.get(n)!;
      for (const q of piecesAtNode.get(n) ?? []) {
        const m = q.from === n ? q.to : q.from, dm = d + q.length;
        if (dm < limit && dm < (dist.get(m) ?? Infinity)) { dist.set(m, dm); queue.push(m); }
      }
    }
    return Math.min((dist.get(b.p.from) ?? Infinity) + b.s, (dist.get(b.p.to) ?? Infinity) + b.p.length - b.s);
  }
  const crossings: { a: number; b: number; order: number; fixed: number | null }[] = [];
  {
    const grid = new Map<string, number[]>();
    for (const vi of pieceOfVar.keys()) {
      const key = `${Math.floor(vars[vi].x / 10)},${Math.floor(vars[vi].z / 10)}`;
      (grid.get(key) ?? grid.set(key, []).get(key)!).push(vi);
    }
    for (const a of pieceOfVar.keys()) {
      const { x, z } = vars[a], pa = pieceOfVar.get(a)!;
      for (let i = Math.floor(x / 10) - 1; i <= Math.floor(x / 10) + 1; i++) for (let j = Math.floor(z / 10) - 1; j <= Math.floor(z / 10) + 1; j++) {
        for (const b of grid.get(`${i},${j}`) ?? []) {
          const pb = pieceOfVar.get(b)!;
          if (b <= a || pa.p.layer === undefined || pb.p.layer === undefined || pa.p.layer === pb.p.layer) continue;
          // the services' own tracks at two levels are kept apart in plan instead (build-track-geometry)
          if (run.has(pa.p.id) && run.has(pb.p.id)) continue;
          if (Math.hypot(vars[b].x - x, vars[b].z - z) > CROSS_REACH || alongTrack(pa, pb, JOINED) < JOINED) continue;
          const fixed = run.has(pa.p.id) ? a : run.has(pb.p.id) ? b : null;
          // against a service's track, the other passes on the side it is already on (0: decided
          // from the first solution): OpenStreetMap's layers there are often only roughly right
          crossings.push({ a, b, order: fixed === null ? Math.sign(pa.p.layer - pb.p.layer) : 0, fixed });
        }
      }
    }
  }
  if (process.env.DEBUG) {
    const seen = new Set<string>();
    for (const c of crossings) {
      const pa = pieceOfVar.get(c.a)!.p, pb = pieceOfVar.get(c.b)!.p, key = `${pa.id}/${pb.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  crossing: pieces ${pa.id} (${pa.service}, layer ${pa.layer}) and ${pb.id} (${pb.service}, layer ${pb.layer}) at x ${Math.round(vars[c.a].x)}, z ${Math.round(vars[c.a].z)}`);
    }
  }
  const coverHeld = new Set<number>(), floorHeld = new Set<number>(), gradeHeld = new Map<number, number>(), stackHeld = new Set<number>(), bendHeld = new Map<number, number>();
  const holds = () => [
    ...[...stackHeld].map((k): Row => {
      const { a, b, order, fixed } = crossings[k];
      // a service's track stays where it is: only the other one moves
      if (fixed === a) return { i: [b], c: [1], b: y[a] - order * STACKED, w: 1 / SIGMA.cover };
      if (fixed === b) return { i: [a], c: [1], b: y[b] + order * STACKED, w: 1 / SIGMA.cover };
      return { i: [a, b], c: [order, -order], b: STACKED, w: 1 / SIGMA.cover };
    }),
    ...[...coverHeld].map((vi): Row => ({ i: [vi], c: [1], b: coverAt(vi)!, w: 1 / SIGMA.cover })),
    ...[...floorHeld].map((vi): Row => ({ i: [vi], c: [1], b: floorAt(vi)!, w: 1 / SIGMA.cover })),
    ...[...gradeHeld].map(([k, sign]): Row => {
      const { a, b, h } = steps[k];
      return { i: [a, b], c: [-1 / h, 1 / h], b: sign * GRADE_HOLD, w: 1 / SIGMA.grade };
    }),
    ...[...bendHeld].map(([k, sign]): Row => ({ ...bendRow(bends[k]), b: sign / bends[k].radius, w: 1 / SIGMA.bend })),
  ];
  let y = solve([]);
  for (let round = 0; round < 50; round++) {
    let changed = 0;
    if (ground.length) vars.forEach((_, vi) => {
      const top = coverAt(vi);
      if (top === null) return;
      if (!coverHeld.has(vi) && y[vi] > top) { coverHeld.add(vi); changed++; }
      else if (coverHeld.has(vi) && y[vi] < top) { coverHeld.delete(vi); changed++; }
    });
    if (ground.length) vars.forEach((_, vi) => {
      const floor = floorAt(vi);
      if (floor === null) return;
      if (!floorHeld.has(vi) && y[vi] < floor) { floorHeld.add(vi); changed++; }
      else if (floorHeld.has(vi) && y[vi] > floor) { floorHeld.delete(vi); changed++; }
    });
    steps.forEach(({ a, b, h }, k) => {
      const g = (y[b] - y[a]) / h;
      if (!gradeHeld.has(k) && Math.abs(g) > GRADE_HOLD) { gradeHeld.set(k, Math.sign(g)); changed++; }
      else if (gradeHeld.has(k) && Math.abs(g) < GRADE_HOLD) { gradeHeld.delete(k); changed++; }
    });
    bends.forEach((bend, k) => {
      const g = bendOf(bend);
      if (!bendHeld.has(k) && Math.abs(g) > 1 / bend.radius) { bendHeld.set(k, Math.sign(g)); changed++; }
      else if (bendHeld.has(k) && g * bendHeld.get(k)! < 1 / bend.radius) { bendHeld.delete(k); changed++; }
    });
    crossings.forEach((c, k) => {
      if (!c.order) c.order = Math.sign(y[c.a] - y[c.b]) || 1;
      const dy = (y[c.a] - y[c.b]) * c.order;
      if (!stackHeld.has(k) && dy < STACKED - 0.01) { stackHeld.add(k); changed++; }
      else if (stackHeld.has(k) && dy > STACKED + 0.01) { stackHeld.delete(k); changed++; }
    });
    if (!changed) break;
    y = solve(holds());
  }

  return {
    pieces, vars, disc, y, stationRows, onPlatform, modelAnchors, groundAnchors, coverHeld, floorHeld, gradeHeld, stackHeld, bendHeld,
    groundOf, coverGround, coverAt, onGround,
  };
}
const first = fit(run, null);
const {
  pieces, vars, disc, y, stationRows, onPlatform, modelAnchors, groundAnchors, coverHeld, floorHeld, gradeHeld, stackHeld, bendHeld,
  groundOf, coverGround, coverAt, onGround,
} = fit(lineTrack(graph), new Map(first.vars.map((v, i) => [v.key, first.y[i]])));

// ------------------------------------------------------------------ write
const heights: Record<string, number[]> = {};
for (const p of pieces) {
  const { s, v } = disc.get(p.id)!;
  let cum = 0;
  heights[p.id] = p.points.map((pt, i) => {
    if (i) cum += Math.hypot(pt[0] - p.points[i - 1][0], pt[1] - p.points[i - 1][1]);
    let k = 1;
    while (k < s.length - 1 && s[k] < cum) k++;
    const t = Math.max(0, Math.min(1, (cum - s[k - 1]) / (s[k] - s[k - 1] || 1)));
    return Math.round((y[v[k - 1]] + (y[v[k]] - y[v[k - 1]]) * t) * 100) / 100;
  });
}
writeFileSync(OUT, JSON.stringify({
  attribution: graph.attribution + (ground.length ? '; Markhöjdmodell © Lantmäteriet, CC BY 4.0' : ''),
  osm: graph.osm,
  note: 'Height of the top of the rail (RH 2000) at each point of each piece of the drawn lines\' track in public/data/track-graph.json: the pieces their services run on, and the crossovers, sidings and depots joined to them.',
  pieces: heights,
}) + '\n');
console.log(`${vars.length} points, ${stationRows.length} on platforms, ${modelAnchors} on the station models, ${sidingAnchors} sidings beside a running line, ${groundAnchors} on surface ground, ${coverHeld.size} held under ground, ${floorHeld.size} held over it on bridges, ${gradeHeld.size} steps held to ${GRADE_HOLD * 1000}‰, ${stackHeld.size} held ${STACKED} m from a track crossing over or under, ${bendHeld.size} held to the line's vertical curve`);
console.log(`wrote ${OUT}`);

// ------------------------------------------------------------------ check
const problems: string[] = [];
const where = (v: Var) => `x ${Math.round(v.x)}, z ${Math.round(v.z)}`;
const near = (x: number, z: number) => graph.stations.reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a)).name;
for (const st of new Set(stationRows.map((r) => r.name))) {
  const mine = stationRows.filter((r) => r.name === st);
  const off = Math.max(...mine.map((r) => Math.abs(y[r.v] - r.b)));
  if (off > 2) problems.push(`${st}: platform ${off.toFixed(1)} m off its height`);
}
for (const route of graph.routes) {
  const prof = routeProfile(graph, route, heights);
  // gradient over 20 m, curvature over 60 m
  let worstGrade = { g: 0, at: '' }, worstRadius = { r: Infinity, at: '' };
  for (let i = 0, j = 0; i < prof.length; i++) {
    while (j < prof.length - 1 && prof[j].s - prof[i].s < 20) j++;
    if (prof[j].s - prof[i].s < 10) continue;
    const g = Math.abs((prof[j].y - prof[i].y) / (prof[j].s - prof[i].s));
    if (g > worstGrade.g) worstGrade = { g, at: near(prof[i].x, prof[i].z) };
  }
  for (let i = 0; i < prof.length; i++) {
    const a = prof.findLast((q) => q.s <= prof[i].s - 30), c = prof.find((q) => q.s >= prof[i].s + 30);
    if (!a || !c) continue;
    const g1 = (prof[i].y - a.y) / (prof[i].s - a.s), g2 = (c.y - prof[i].y) / (c.s - prof[i].s);
    const r = Math.abs((c.s - a.s) / 2 / (g2 - g1 || 1e-12));
    if (r < worstRadius.r) worstRadius = { r, at: near(prof[i].x, prof[i].z) };
  }
  const line = `${route.name}: steepest ${(worstGrade.g * 1000).toFixed(1)}‰ near ${worstGrade.at}, tightest vertical curve ${Math.round(worstRadius.r)} m near ${worstRadius.at}`;
  console.log(line);
  if (worstGrade.g > LIMITS.gradient * 1.1) problems.push(`${route.name}: ${(worstGrade.g * 1000).toFixed(1)}‰ near ${worstGrade.at} (limit 40‰)`);
  const limit = VERTICAL_RADIUS[route.line] ?? 2000;
  if (worstRadius.r < limit * 0.75) problems.push(`${route.name}: vertical curve of ${Math.round(worstRadius.r)} m near ${worstRadius.at} (limit ${limit.toLocaleString('en')} m)`);
}
// platforms: the gradient between neighbouring platform points
for (const p of pieces) {
  const { s, v } = disc.get(p.id)!;
  for (let k = 1; k < v.length; k++) {
    if (!onPlatform.has(v[k]) || !onPlatform.has(v[k - 1])) continue;
    const g = Math.abs((y[v[k]] - y[v[k - 1]]) / (s[k] - s[k - 1]));
    if (g > LIMITS.platformGradient * 1.5) problems.push(`platform near ${near(vars[v[k]].x, vars[v[k]].z)}: ${(g * 1000).toFixed(1)}‰ (limit 10‰)`);
  }
}
if (ground.length) {
  vars.forEach((vv, vi) => {
    const g = groundOf[vi];
    if (g === null) return;
    const top = coverAt(vi);
    if (top !== null && y[vi] > top + 1) problems.push(`tunnel near ${near(vv.x, vv.z)}: only ${(coverGround[vi]! - y[vi]).toFixed(1)} m under the ground at ${where(vv)}`);
    if (onGround(vi) && Math.abs(y[vi] - g - 0.2) > 4) problems.push(`surface track near ${near(vv.x, vv.z)}: ${(y[vi] - g).toFixed(1)} m from the ground at ${where(vv)}`);
  });
}
if (problems.length) {
  const counts = new Map<string, number>();
  for (const p of problems) counts.set(p, (counts.get(p) ?? 0) + 1);
  console.error(`outside the limits:\n  ${[...counts].map(([p, n]) => (n > 1 ? `${p} (×${n})` : p)).join('\n  ')}`);
  process.exit(1);
}
console.log('all within the limits');
