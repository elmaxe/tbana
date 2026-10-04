// Places a station model on the world grid (src/geo.ts) by fitting its tracks onto the
// OpenStreetMap tracks around it, and writes the placement to public/data/stations.json.
//
//   node tools/fit-station.ts t-centralen
//   DUMP=fit.json node tools/fit-station.ts t-centralen   (also writes the matched points, for plotting)
//
// The model's track ribbons are reduced to centre lines and sampled every 2 m. Each line's samples
// are matched only against OSM tracks of the same kind (the red line against the red line, and so
// on). The fit is a rotation and a shift in plan; heights are kept, since the models are already
// drawn in metres above sea level.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { classifyColor } from '../src/model-colors.ts';
import { extractCenterlines, splitComponents } from '../src/polyline.ts';
import type { Tri } from '../src/polyline.ts';
import { lonLatToWorld, ORIGIN } from '../src/geo.ts';

type Kind = 'blue' | 'red' | 'green' | 'pink' | 'tram' | 'main';
interface OsmWay { id: number; tags: Record<string, string>; geometry: { lat: number; lon: number }[] }
interface Seg { ax: number; az: number; bx: number; bz: number; way: number }

const name = process.argv[2] || 't-centralen';
const MODEL = `public/assets/${name}.glb`;
const OSM = `data/osm/${name}.json`;
const OUT = 'public/data/stations.json';

// ------------------------------------------------------------------ model track samples
function loadModel(path: string): Promise<THREE.Object3D> {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((ok, fail) => new GLTFLoader().parse(ab, '', (g) => ok(g.scene), fail));
}

const root = await loadModel(MODEL);
root.updateMatrixWorld(true);
const samples: { kind: Kind; x: number; y: number; z: number }[] = [];
const floors: Tri[] = [];
root.traverse((obj) => {
  const mesh = obj as THREE.Mesh;
  if (!mesh.isMesh) return;
  const kind = classifyColor((mesh.material as THREE.MeshStandardMaterial).color);
  if (kind !== 'floor' && !kind.startsWith('track:')) return;
  let g = mesh.geometry.clone();
  if (g.index) g = g.toNonIndexed();
  g.applyMatrix4(mesh.matrixWorld);
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  const top: Tri[] = [];
  for (let i = 0; i < p.count; i += 3) {
    if ((n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3 < 0.35) continue;
    top.push([0, 1, 2].map((k) => new THREE.Vector3(p.getX(i + k), p.getY(i + k), p.getZ(i + k))) as Tri);
  }
  if (kind === 'floor') { floors.push(...top); return; }
  for (const comp of splitComponents(top)) {
    for (const pl of extractCenterlines(comp)) {
      for (const v of pl.resample(0, pl.length, 2)) samples.push({ kind: kind.slice(6) as Kind, x: v.x, y: v.y, z: v.z });
    }
  }
});

// ------------------------------------------------------------------ OSM tracks
function osmKind(t: Record<string, string>): Kind | 'metro' | null {
  if (t.railway === 'subway') {
    const n = t.name || '';
    return n.startsWith('Blå') ? 'blue' : n.startsWith('Röda') ? 'red' : n.startsWith('Gröna') ? 'green' : 'metro';
  }
  if (t.railway === 'tram' || t.railway === 'light_rail') return 'tram';
  if (t.railway === 'rail') return t.name === 'Citybanan' || Number(t.layer) <= -2 ? 'pink' : 'main';
  return null;
}

const osm: { timestamp?: string; elements: OsmWay[] } = JSON.parse(readFileSync(OSM, 'utf8'));
const segs = new Map<Kind | 'metro', Seg[]>();
for (const w of osm.elements) {
  const k = osmKind(w.tags);
  if (!k || !w.geometry) continue;
  const pts = w.geometry.map((g) => lonLatToWorld(g.lon, g.lat));
  const list = segs.get(k) ?? [];
  for (let i = 1; i < pts.length; i++) list.push({ ax: pts[i - 1].x, az: pts[i - 1].z, bx: pts[i].x, bz: pts[i].z, way: w.id });
  segs.set(k, list);
}

// Each model line is matched against OSM tracks of its own line; unnamed subway tracks
// (crossovers, sidings) count for every metro line.
const candidates = (k: Kind): Seg[] => {
  const own = segs.get(k) ?? [];
  return k === 'blue' || k === 'red' || k === 'green' ? own.concat(segs.get('metro') ?? []) : own;
};

// a coarse grid over the segments, for nearest-segment queries
class SegIndex {
  cell = 8;
  map = new Map<string, Seg[]>();
  constructor(list: Seg[]) {
    for (const s of list) {
      const x0 = Math.floor(Math.min(s.ax, s.bx) / this.cell), x1 = Math.floor(Math.max(s.ax, s.bx) / this.cell);
      const z0 = Math.floor(Math.min(s.az, s.bz) / this.cell), z1 = Math.floor(Math.max(s.az, s.bz) / this.cell);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
        const key = `${i},${j}`;
        const c = this.map.get(key);
        if (c) c.push(s); else this.map.set(key, [s]);
      }
    }
  }
  // nearest point on any segment within `reach` cells, or null
  nearest(x: number, z: number, reach = 3) {
    const ci = Math.floor(x / this.cell), cj = Math.floor(z / this.cell);
    let best: { d: number; px: number; pz: number } | null = null;
    for (let i = ci - reach; i <= ci + reach; i++) for (let j = cj - reach; j <= cj + reach; j++) {
      for (const s of this.map.get(`${i},${j}`) ?? []) {
        const dx = s.bx - s.ax, dz = s.bz - s.az;
        const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz || 1)));
        const px = s.ax + dx * t, pz = s.az + dz * t;
        const d = Math.hypot(x - px, z - pz);
        if (!best || d < best.d) best = { d, px, pz };
      }
    }
    return best;
  }
}

const kinds = [...new Set(samples.map((s) => s.kind))].filter((k) => candidates(k).length);
const index = new Map(kinds.map((k) => [k, new SegIndex(candidates(k))]));
const used = samples.filter((s) => index.has(s.kind));

// ------------------------------------------------------------------ fit
interface Pose { rot: number; tx: number; tz: number }
const apply = (p: Pose, x: number, z: number) => {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return { x: c * x - s * z + p.tx, z: s * x + c * z + p.tz };
};
const CAP = 24;
const centre = lonLatToWorld(18.0597, 59.3313); // T-Centralen, roughly

// For the coarse search, a 2 m grid per line holding the (chamfer) distance to its nearest
// OSM track, so a pose is scored with one lookup per sample.
const FIELD = { cell: 2, half: 900 };
const FN = Math.round((2 * FIELD.half) / FIELD.cell);
function distanceField(list: Seg[]) {
  const f = new Float32Array(FN * FN).fill(1e9);
  const gx = (x: number) => (x - centre.x + FIELD.half) / FIELD.cell, gz = (z: number) => (z - centre.z + FIELD.half) / FIELD.cell;
  for (const s of list) {
    const steps = Math.ceil(Math.hypot(s.bx - s.ax, s.bz - s.az) / (FIELD.cell / 2)) + 1;
    for (let k = 0; k <= steps; k++) {
      const i = Math.round(gx(s.ax + ((s.bx - s.ax) * k) / steps)), j = Math.round(gz(s.az + ((s.bz - s.az) * k) / steps));
      if (i >= 0 && j >= 0 && i < FN && j < FN) f[j * FN + i] = 0;
    }
  }
  const D = FIELD.cell, DD = FIELD.cell * Math.SQRT2;
  const relax = (i: number, j: number, ni: number, nj: number, w: number) => {
    if (ni < 0 || nj < 0 || ni >= FN || nj >= FN) return;
    const v = f[nj * FN + ni] + w;
    if (v < f[j * FN + i]) f[j * FN + i] = v;
  };
  for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) {
    relax(i, j, i - 1, j, D); relax(i, j, i, j - 1, D); relax(i, j, i - 1, j - 1, DD); relax(i, j, i + 1, j - 1, DD);
  }
  for (let j = FN - 1; j >= 0; j--) for (let i = FN - 1; i >= 0; i--) {
    relax(i, j, i + 1, j, D); relax(i, j, i, j + 1, D); relax(i, j, i + 1, j + 1, DD); relax(i, j, i - 1, j + 1, DD);
  }
  return (x: number, z: number) => {
    const i = Math.round((x - centre.x + FIELD.half) / FIELD.cell), j = Math.round((z - centre.z + FIELD.half) / FIELD.cell);
    return i >= 0 && j >= 0 && i < FN && j < FN ? f[j * FN + i] : CAP;
  };
}
const fields = new Map(kinds.map((k) => [k, distanceField(candidates(k))]));
function score(p: Pose, pts: typeof used) {
  let sum = 0;
  for (const s of pts) {
    const w = apply(p, s.x, s.z);
    sum += Math.min(fields.get(s.kind)!(w.x, w.z), CAP) ** 2;
  }
  return sum / pts.length;
}

// 1. coarse search: rotation in 1° steps, shift in 6 m steps, on every 4th sample
const sparse = used.filter((_, i) => i % 4 === 0);
let best: Pose = { rot: 0, tx: centre.x, tz: centre.z }, bestScore = Infinity;
for (let deg = -25; deg <= 25; deg += 1) {
  for (let dx = -240; dx <= 240; dx += 6) for (let dz = -240; dz <= 240; dz += 6) {
    const p = { rot: deg * Math.PI / 180, tx: centre.x + dx, tz: centre.z + dz };
    const sc = score(p, sparse);
    if (sc < bestScore) { bestScore = sc; best = p; }
  }
}
console.log(`coarse: ${(best.rot * 180 / Math.PI).toFixed(1)}°, rms ${Math.sqrt(bestScore).toFixed(2)} m`);

// 2. refine: iterated closest points, least squares rotation + shift, ignoring outliers
let cutoff = 12;
for (let iter = 0; iter < 60; iter++) {
  const pairs: { x: number; z: number; px: number; pz: number }[] = [];
  for (const s of used) {
    const w = apply(best, s.x, s.z);
    const n = index.get(s.kind)!.nearest(w.x, w.z);
    if (n && n.d < cutoff) pairs.push({ x: s.x, z: s.z, px: n.px, pz: n.pz });
  }
  // Procrustes (rotation + translation) from model points to their matched OSM points
  let mx = 0, mz = 0, ox = 0, oz = 0;
  for (const q of pairs) { mx += q.x; mz += q.z; ox += q.px; oz += q.pz; }
  mx /= pairs.length; mz /= pairs.length; ox /= pairs.length; oz /= pairs.length;
  let sxx = 0, sxz = 0;
  for (const q of pairs) {
    const ax = q.x - mx, az = q.z - mz, bx = q.px - ox, bz = q.pz - oz;
    sxx += ax * bx + az * bz;
    sxz += ax * bz - az * bx;
  }
  const rot = Math.atan2(sxz, sxx);
  const c = Math.cos(rot), s = Math.sin(rot);
  best = { rot, tx: ox - (c * mx - s * mz), tz: oz - (s * mx + c * mz) };
  if (iter === 20) cutoff = 6;
  if (iter === 40) cutoff = 4;
}

// ------------------------------------------------------------------ report
// Distances are also given for the samples beside one of the model's platforms: a floor within
// 4.8 m at about the height of the track, as the game finds them. Away from the platforms the
// model only sketches where the tunnels head, and OSM's tunnel alignments are hand-drawn, so the
// two can part by tens of metres there.
const floorCells = new Map<string, Tri[]>();
for (const t of floors) {
  const xs = t.map((v) => Math.floor(v.x / 8)), zs = t.map((v) => Math.floor(v.z / 8));
  for (let i = Math.min(...xs); i <= Math.max(...xs); i++) for (let j = Math.min(...zs); j <= Math.max(...zs); j++) {
    const key = `${i},${j}`;
    const c = floorCells.get(key);
    if (c) c.push(t); else floorCells.set(key, [t]);
  }
}
function floorAt(x: number, z: number, y: number) {
  for (const [a, b, c] of floorCells.get(`${Math.floor(x / 8)},${Math.floor(z / 8)}`) ?? []) {
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
    const l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
    if (l1 < 0 || l2 < 0 || l1 + l2 > 1) continue;
    if (Math.abs(l1 * a.y + l2 * b.y + (1 - l1 - l2) * c.y - y) < 0.9) return true;
  }
  return false;
}
const besidePlatform = (s: { x: number; y: number; z: number }) => {
  for (let a = 0; a < 16; a++) {
    for (let r = 0.6; r <= 4.8; r += 0.6) {
      if (floorAt(s.x + r * Math.cos((a * Math.PI) / 8), s.z + r * Math.sin((a * Math.PI) / 8), s.y)) return true;
    }
  }
  return false;
};
const placed = used.map((s) => {
  const w = apply(best, s.x, s.z);
  const n = index.get(s.kind)!.nearest(w.x, w.z, 6);
  return { kind: s.kind, x: s.x, z: s.z, w, d: n?.d ?? 99, px: n?.px ?? 0, pz: n?.pz ?? 0, atPlatform: besidePlatform(s) };
});
const stats = (ds: number[]) => {
  if (!ds.length) return null;
  const d = [...ds].sort((a, b) => a - b);
  const q = (f: number) => +d[Math.min(d.length - 1, Math.floor(f * d.length))].toFixed(2);
  return { n: d.length, median: q(0.5), p90: q(0.9), max: q(1) };
};
const table: Record<string, unknown> = {};
// [median, 90th percentile] in metres, for each line
const atPlatforms: Record<string, [number, number]> = {}, everywhere: Record<string, [number, number]> = {};
for (const k of [...kinds, 'all']) {
  const mine = placed.filter((p) => k === 'all' || p.kind === k);
  const all = stats(mine.map((p) => p.d)), plat = stats(mine.filter((p) => p.atPlatform).map((p) => p.d));
  if (all) everywhere[k] = [all.median, all.p90];
  if (plat) atPlatforms[k] = [plat.median, plat.p90];
  table[k] = { n: all?.n, median: all?.median, p90: all?.p90, 'platforms n': plat?.n, 'platforms median': plat?.median, 'platforms p90': plat?.p90 };
}

// A check on the model's scale: the least-squares scale between the matched pairs, which should
// be 1 if the model is drawn in metres. It is reported, not applied.
let num = 0, den = 0;
{
  const good = placed.filter((p) => p.d < 4);
  const mx = good.reduce((a, p) => a + p.w.x, 0) / good.length, mz = good.reduce((a, p) => a + p.w.z, 0) / good.length;
  const ox = good.reduce((a, p) => a + p.px, 0) / good.length, oz = good.reduce((a, p) => a + p.pz, 0) / good.length;
  for (const p of good) {
    num += (p.w.x - mx) * (p.px - ox) + (p.w.z - mz) * (p.pz - oz);
    den += (p.w.x - mx) ** 2 + (p.w.z - mz) ** 2;
  }
}
const scale = num / den;

// three.js turns +x towards -z for a positive rotation about +y, the opposite of `rot` here
const rotationY = -best.rot * 180 / Math.PI;
console.log(`rotation about +y ${rotationY.toFixed(3)}°, model origin at world x ${best.tx.toFixed(2)}, z ${best.tz.toFixed(2)}`
  + ` (SWEREF 99 18 00 E ${(ORIGIN.e + best.tx).toFixed(2)}, N ${(ORIGIN.n - best.tz).toFixed(2)}), scale check ${scale.toFixed(4)}`);
console.log('distance from the model tracks to the OSM tracks, metres:');
console.table(table);

if (process.env.DUMP) {
  writeFileSync(process.env.DUMP, JSON.stringify({
    model: placed.map((p, i) => [p.kind, +p.w.x.toFixed(2), +p.w.z.toFixed(2), +used[i].y.toFixed(2), p.atPlatform ? 1 : 0]),
    osm: [...segs].map(([k, l]) => [k, l.map((q) => [q.ax, q.az, q.bx, q.bz, q.way])]),
  }));
}

// ------------------------------------------------------------------ write
const stations = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
stations[name] = {
  model: `assets/${name}.glb`,
  // world = the model turned by `rotationY` degrees about the vertical axis (three.js
  // convention), then moved by `position`; heights are kept as drawn
  rotationY: +rotationY.toFixed(4),
  position: [+best.tx.toFixed(3), 0, +best.tz.toFixed(3)],
  // distance from the model's tracks to the OSM tracks, [median, 90th percentile] in metres
  fit: { osm: osm.timestamp ?? null, scaleCheck: +scale.toFixed(4), atPlatforms, everywhere },
};
// short number arrays on one line
writeFileSync(OUT, JSON.stringify(stations, null, 2).replace(/\[\s+([-\d.]+),\s+([-\d.]+)(?:,\s+([-\d.]+))?\s+\]/g,
  (_m, a, b, c) => `[${[a, b, c].filter((v) => v !== undefined).join(', ')}]`) + '\n');
console.log(`wrote ${OUT}`);
