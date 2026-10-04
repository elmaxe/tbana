// Gives the traced services' tracks their heights, and checks them against the design limits.
//
//   node tools/build-heights.ts
//
// Reads public/data/track-graph.json, data/station-heights.json (Wikidata), the T-Centralen
// model, and data/ground/red-line.json (Lantmäteriet's elevation model) when it is there; writes
// public/data/track-heights.json: the height of the top of the rail (RH 2000) at every point of
// every piece the services run on.
//
// Every piece is cut into points about 10 m apart, joined at the graph's nodes, and the heights
// are the smoothest line through these, by least squares:
// - stations: the platform tracks sit 1.0 m below the station's height from Wikidata, which is
//   taken to be the platform's level
// - T-Centralen, which Wikidata lacks: the heights of the model's tracks, which are drawn at
//   platform level, also 1.0 m above the rail
// - surface track: 0.2 m above the ground; bridges: no anchor, the line is carried across
// - tunnels: below the ground with at least 6 m of cover, except near their mouths
// Then the result is checked against the 1975 limits for the red line: 40‰ at most, 10‰ along
// platforms, vertical curves of at least 2,000 m radius. The build fails on anything clearly
// outside them, and lists it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { TrackGraph, TrackPiece } from '../src/track-graph.ts';
import { pointAt, routeProfile } from './lib/graph.ts';
import { loadStationModel, placeSample } from './lib/station-model.ts';

const OUT = 'public/data/track-heights.json';
const GROUND = 'data/ground/red-line.json';
const STEP = 10;
const PLATFORM_ABOVE_RAIL = 1.0;
const LIMITS = { gradient: 0.040, platformGradient: 0.010, radius: 2000, cover: 6 };
// how far each kind of anchor may be off, in metres (or 1/m for curvature)
const SIGMA = { station: 0.7, model: 0.3, ground: 1.0, cover: 0.5, curvature: 1 / 4000, level: 50 };

const graph: TrackGraph = JSON.parse(readFileSync('public/data/track-graph.json', 'utf8'));
const stationHeights: Record<string, { height: number }> = JSON.parse(readFileSync('data/station-heights.json', 'utf8')).stations;
const ground: [number, number, number][] = existsSync(GROUND) ? JSON.parse(readFileSync(GROUND, 'utf8')).samples : [];
if (!ground.length) console.warn(`${GROUND} missing: no ground anchors, and tunnel cover is not checked`);

// ------------------------------------------------------------------ the unknowns
const used = new Set(graph.routes.flatMap((r) => r.path.map((s) => s.piece)));
const pieces = graph.pieces.filter((p) => used.has(p.id));
interface Var { x: number; z: number }
const vars: Var[] = [];
const nodeVar = new Map<number, number>();
const node = new Map(graph.nodes.map((n) => [n.id, n]));
const varOfNode = (id: number) => {
  if (!nodeVar.has(id)) { nodeVar.set(id, vars.length); vars.push({ x: node.get(id)!.x, z: node.get(id)!.z }); }
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
    else { const [x, z] = pointAt(p, s[k]); v.push(vars.length); vars.push({ x, z }); }
  }
  disc.set(p.id, { s, v });
}

// ------------------------------------------------------------------ the equations
// Each row asks sum(c·y) = b, with weight 1/sigma.
interface Row { i: number[]; c: number[]; b: number; w: number }
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
        if (s < t.s0 || s > t.s1) return;
        addAnchor(d.v[k], h - PLATFORM_ABOVE_RAIL, SIGMA.station);
        stationRows.push({ name: st.name, v: d.v[k], b: h - PLATFORM_ABOVE_RAIL });
      });
    }
  }
}

// T-Centralen: the model's tracks along its platforms, where a graph point lies within 3 m of one
// of the same line. Beyond the platforms the model only sketches where the tunnels go: its
// tunnel ends drop at up to 70‰, so they are left out.
const placements = JSON.parse(readFileSync('public/data/stations.json', 'utf8'));
const model = (await loadStationModel('t-centralen')).samples.map((s) => placeSample(s, placements['t-centralen']));
const modelGrid = new Map<string, typeof model>();
for (const m of model) {
  const key = `${Math.floor(m.x / 10)},${Math.floor(m.z / 10)}`;
  const list = modelGrid.get(key);
  if (list) list.push(m); else modelGrid.set(key, [m]);
}
let modelAnchors = 0;
const tcPlatforms = graph.stations.find((s) => s.name === 'T-Centralen')!.platforms.flatMap((p) => p.tracks);
for (const p of pieces) {
  const lines: string[] = p.lines.filter((l) => l === 'red' || l === 'green' || l === 'blue');
  const ranges = tcPlatforms.filter((t) => t.piece === p.id);
  if (!lines.length || !ranges.length) continue;
  const { s: ss, v } = disc.get(p.id)!;
  for (let k = 0; k < v.length; k++) {
    if (!ranges.some((t) => ss[k] >= t.s0 && ss[k] <= t.s1)) continue;
    const vi = v[k];
    const { x, z } = vars[vi];
    let best: (typeof model)[number] | null = null, bestD = 3;
    for (let i = Math.floor(x / 10) - 1; i <= Math.floor(x / 10) + 1; i++) for (let j = Math.floor(z / 10) - 1; j <= Math.floor(z / 10) + 1; j++) {
      for (const m of modelGrid.get(`${i},${j}`) ?? []) {
        if (!lines.includes(m.kind)) continue;
        const d = Math.hypot(m.x - x, m.z - z);
        if (d < bestD) { bestD = d; best = m; }
      }
    }
    if (best) { addAnchor(vi, best.y - PLATFORM_ABOVE_RAIL, SIGMA.model); modelAnchors++; }
  }
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
  const tunnelPieces = pieces.filter((p) => p.structure === 'tunnel');
  const dist = new Map<number, number>();
  for (const n of graph.nodes) if (n.kind === 'portal' && nodeVar.has(n.id)) dist.set(n.id, 0);
  for (let changed = true; changed;) {
    changed = false;
    for (const p of tunnelPieces) {
      for (const [a, b] of [[p.from, p.to], [p.to, p.from]]) {
        const d = (dist.get(a) ?? Infinity) + p.length;
        if (d < (dist.get(b) ?? Infinity)) { dist.set(b, d); changed = true; }
      }
    }
  }
  for (const p of tunnelPieces) {
    const { s, v } = disc.get(p.id)!;
    v.forEach((vi, k) => mouthDistance.set(vi, Math.min(
      (dist.get(p.from) ?? Infinity) + s[k], (dist.get(p.to) ?? Infinity) + p.length - s[k], mouthDistance.get(vi) ?? Infinity)));
  }
}

const structureOf = new Map<number, TrackPiece['structure']>();
for (const p of pieces) for (const vi of disc.get(p.id)!.v) if (!structureOf.has(vi) || p.structure !== 'surface') structureOf.set(vi, p.structure);
let groundAnchors = 0;
const groundOf = vars.map((v) => groundAt(v.x, v.z));
vars.forEach((_, vi) => {
  const g = groundOf[vi];
  if (g !== null && structureOf.get(vi) === 'surface') { addAnchor(vi, g + 0.2, SIGMA.ground); groundAnchors++; }
});

// ------------------------------------------------------------------ solve
// The normal equations by conjugate gradients; rows are few per unknown, so this is quick.
function solve(extra: Row[]) {
  const all = rows.concat(extra);
  const n = vars.length;
  const apply = (x: Float64Array) => {
    const out = new Float64Array(n);
    for (const r of all) {
      let a = 0;
      for (let k = 0; k < r.i.length; k++) a += r.c[k] * x[r.i[k]];
      a *= r.w * r.w;
      for (let k = 0; k < r.i.length; k++) out[r.i[k]] += r.c[k] * a;
    }
    return out;
  };
  const rhs = new Float64Array(n);
  for (const r of all) for (let k = 0; k < r.i.length; k++) rhs[r.i[k]] += r.c[k] * r.b * r.w * r.w;
  // Jacobi-preconditioned conjugate gradients
  const diag = new Float64Array(n);
  for (const r of all) for (let k = 0; k < r.i.length; k++) diag[r.i[k]] += (r.c[k] * r.w) ** 2;
  const x = new Float64Array(n);
  let r = rhs.slice();
  let z = r.map((v, i) => v / diag[i]);
  let p = z.slice();
  let rz = r.reduce((a, v, i) => a + v * z[i], 0);
  const rhsNorm = Math.sqrt(rhs.reduce((a, v) => a + v * v, 0)) || 1;
  for (let it = 0; it < 20000; it++) {
    const ap = apply(p);
    const alpha = rz / p.reduce((a, v, i) => a + v * ap[i], 0);
    for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; r[i] -= alpha * ap[i]; }
    if (Math.sqrt(r.reduce((a, v) => a + v * v, 0)) < 1e-9 * rhsNorm) break;
    z = r.map((v, i) => v / diag[i]);
    const rz2 = r.reduce((a, v, i) => a + v * z[i], 0);
    const beta = rz2 / rz;
    rz = rz2;
    for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i];
  }
  return x;
}

// Tunnels must stay under the ground: where the line comes too close to the surface (away
// from the mouths), hold it down there and solve again.
const cover: Row[] = [];
let y = solve(cover);
for (let round = 0; round < 8 && ground.length; round++) {
  let added = 0;
  vars.forEach((_, vi) => {
    const g = groundOf[vi];
    if (g === null || structureOf.get(vi) !== 'tunnel' || (mouthDistance.get(vi) ?? Infinity) < 120) return;
    if (y[vi] > g - LIMITS.cover && !cover.some((r) => r.i[0] === vi)) {
      cover.push({ i: [vi], c: [1], b: g - LIMITS.cover, w: 1 / SIGMA.cover });
      added++;
    }
  });
  if (!added) break;
  y = solve(cover);
}

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
  note: 'Height of the top of the rail (RH 2000) at each point of each piece of public/data/track-graph.json that a traced service runs on.',
  pieces: heights,
}) + '\n');
console.log(`${vars.length} points, ${stationRows.length} on platforms, ${modelAnchors} on the T-Centralen model, ${groundAnchors} on surface ground, ${cover.length} held under ground`);
console.log(`wrote ${OUT}`);

// ------------------------------------------------------------------ check
const problems: string[] = [];
const near = (x: number, z: number) => graph.stations.reduce((a, b) => (Math.hypot(b.x - x, b.z - z) < Math.hypot(a.x - x, a.z - z) ? b : a)).name;
for (const st of new Set(stationRows.map((r) => r.name))) {
  const mine = stationRows.filter((r) => r.name === st);
  const off = Math.max(...mine.map((r) => Math.abs(y[r.v] - r.b)));
  if (off > 2) problems.push(`${st}: platform ${off.toFixed(1)} m off its height`);
}
const platformAt = new Set(stationRows.map((r) => r.v));
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
  if (worstRadius.r < LIMITS.radius * 0.75) problems.push(`${route.name}: vertical curve of ${Math.round(worstRadius.r)} m near ${worstRadius.at} (limit 2,000 m)`);
}
// platforms: the gradient between neighbouring platform points
for (const p of pieces) {
  const { s, v } = disc.get(p.id)!;
  for (let k = 1; k < v.length; k++) {
    if (!platformAt.has(v[k]) || !platformAt.has(v[k - 1])) continue;
    const g = Math.abs((y[v[k]] - y[v[k - 1]]) / (s[k] - s[k - 1]));
    if (g > LIMITS.platformGradient * 1.5) problems.push(`platform near ${near(vars[v[k]].x, vars[v[k]].z)}: ${(g * 1000).toFixed(1)}‰ (limit 10‰)`);
  }
}
if (ground.length) {
  vars.forEach((vv, vi) => {
    const g = groundOf[vi];
    if (g === null) return;
    const st = structureOf.get(vi);
    if (st === 'tunnel' && (mouthDistance.get(vi) ?? Infinity) >= 120 && y[vi] > g - LIMITS.cover + 1) problems.push(`tunnel near ${near(vv.x, vv.z)}: only ${(g - y[vi]).toFixed(1)} m under the ground`);
    if (st === 'surface' && Math.abs(y[vi] - g - 0.2) > 4) problems.push(`surface track near ${near(vv.x, vv.z)}: ${(y[vi] - g).toFixed(1)} m from the ground`);
  });
}
if (problems.length) {
  const counts = new Map<string, number>();
  for (const p of problems) counts.set(p, (counts.get(p) ?? 0) + 1);
  console.error(`outside the limits:\n  ${[...counts].map(([p, n]) => (n > 1 ? `${p} (×${n})` : p)).join('\n  ')}`);
  process.exit(1);
}
console.log('all within the limits');
