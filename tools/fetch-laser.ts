// Measures the city's buildings from Lantmäteriet's airborne laser scan (Laserdata Nedladdning,
// skog, CC BY 4.0): for each of OpenStreetMap's buildings and building parts
// (data/osm/buildings.json), how high its eaves and its roof's top are, and its roof's shape.
//
//   node tools/fetch-laser.ts            -> data/laser/buildings.json
//   node tools/fetch-laser.ts -- --again  measure the blocks already measured again too
//   node tools/fetch-laser.ts -- 0,0 -1,0 measure these blocks again (BLOCK m squares from world x, z)
//
// The scan is a point cloud of the ground and everything on it (roofs, trees, bridges), about 1.4
// points a square metre, flown in spring before the leaves (2019 on), in squares of 10 km on
// SWEREF 99 TM with heights in RH 2000. Each square is a COPC file (tools/lib/copc.ts), found
// through Lantmäteriet's STAC catalogue for height data like the elevation model, and only the
// parts of it under the buildings are read. Where a square was flown more than once the newest
// is taken. Lantmäteriet asks for the login as for the elevation model
// (tools/lib/lantmateriet.ts), with Laserdata Nedladdning, skog ordered on Geotorget.
//
// The city is measured a block of BLOCK m at a time. Of a block's buildings (those whose middle
// is in it), every point of the scan inside an outline, and more than EDGE from its walls (which
// the laser hits at a slant, and eaves overhang), is taken as the roof's, except those the scan
// calls noise. tools/lib/laser-roofs.ts fits the roofs of tools/lib/roofs.ts to them. The blocks are
// measured by a worker thread per processor (up to JOBS), and each block's measures are kept in
// node_modules/.cache/laser/, so a run that stops can be started again.
//
// A building the scan has mostly ground under (built since it was flown) is left out.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { GRID_TM, worldToGrid } from '../src/geo.ts';
import { cityArea } from './lib/city-area.ts';
import { openCopc, nodesOver, readNode } from './lib/copc.ts';
import type { CopcFile, Points } from './lib/copc.ts';
import { fitRoof } from './lib/laser-roofs.ts';
import { authHeaders, findFiles, throttleFetch, tmToWorld } from './lib/lantmateriet.ts';
import type { StacFile } from './lib/lantmateriet.ts';

const LASER_ATTRIBUTION = 'Laserdata Nedladdning, skog © Lantmäteriet, CC BY 4.0 (processed: buildings measured from it)';
const COLLECTION = 'dsm-skoglig-copc';
const OUT = 'data/laser/buildings.json';
const CACHE = 'node_modules/.cache/laser';
const BLOCK = 1000;
const EDGE = 0.5;
const CELL = 20;      // the buildings' index within a block
const JOBS = 4;
// the scan's classes: 2 ground, 7 low noise, 18 high noise
const GROUND = 2, NOISE = new Set([7, 18]);

type XZ = [number, number];
const args = process.argv.slice(2);
const again = args.includes('--again');
const only = new Set(args.filter((a) => /^-?\d+,-?\d+$/.test(a)));
throttleFetch();
// (the workers get the main thread's)
const headers: Record<string, string> = isMainThread ? authHeaders() : workerData.headers;

// ------------------------------------------------------------------ the buildings
const osm: { buildings: { osm: string; tags: Record<string, string>; rings: number[][] }[] } =
  JSON.parse(readFileSync('data/osm/buildings.json', 'utf8'));
const ringArea = (r: XZ[]) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) { const [ax, az] = r[i], [bx, bz] = r[(i + 1) % r.length]; a += ax * bz - bx * az; }
  return a / 2;
};
interface B { osm: string; rings: XZ[][]; area: number; box: [number, number, number, number]; c: XZ }
const buildings: B[] = [];
for (const b of osm.buildings) {
  if (b.tags.building === 'roof') continue;
  const rings = b.rings.map((flat) => {
    const r: XZ[] = [];
    for (let k = 0; k + 1 < flat.length; k += 2) {
      const p: XZ = [flat[k], flat[k + 1]];
      if (!r.length || Math.hypot(p[0] - r[r.length - 1][0], p[1] - r[r.length - 1][1]) > 0.05) r.push(p);
    }
    if (r.length > 1 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 0.05) r.pop();
    return r;
  }).filter((r) => r.length >= 3);
  if (!rings.length) continue;
  // the outline with a positive shoelace area, courtyards negative (as tools/lib/roofs.ts wants)
  if (ringArea(rings[0]) < 0) rings[0].reverse();
  for (const r of rings.slice(1)) if (ringArea(r) > 0) r.reverse();
  const area = ringArea(rings[0]) + rings.slice(1).reduce((s, r) => s + ringArea(r), 0);
  if (area < 4) continue;
  const xs = rings[0].map((p) => p[0]), zs = rings[0].map((p) => p[1]);
  const box: B['box'] = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
  buildings.push({ osm: b.osm, rings, area, box, c: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2] });
}
const area = cityArea();
const blocks = new Map<string, B[]>();
for (const b of buildings) {
  const key = `${Math.floor(b.c[0] / BLOCK)},${Math.floor(b.c[1] / BLOCK)}`;
  (blocks.get(key) ?? blocks.set(key, []).get(key)!).push(b);
}
if (isMainThread) console.log(`${buildings.length} buildings in ${blocks.size} blocks of ${BLOCK} m (the city: ${area.tiles.length} tiles)`);

function inside(x: number, z: number, ring: XZ[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function nearEdge(x: number, z: number, rings: XZ[][], d: number) {
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const [ax, az] = r[i], [bx, bz] = r[(i + 1) % r.length];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      if (Math.hypot(ax + dx * t - x, az + dz * t - z) < d) return true;
    }
  }
  return false;
}

const opened = new Map<string, Promise<CopcFile>>();
function open(f: StacFile) {
  let p = opened.get(f.url);
  if (!p) {
    p = openCopc(f.url, headers).catch((err) => {
      throw new Error(`${(err as Error).message} (the account needs LM_USER and LM_PASSWORD, and Laserdata Nedladdning, skog ordered on Geotorget)`);
    });
    opened.set(f.url, p);
  }
  return p;
}
// the upper levels' nodes are read for many blocks: the last few are kept
const nodeCache = new Map<string, Promise<Points>>();
function points(file: CopcFile, key: string) {
  if (Number(key.split('-')[0]) > 4) return readNode(file, key);
  const id = `${file.url} ${key}`;
  let p = nodeCache.get(id);
  if (p) { nodeCache.delete(id); nodeCache.set(id, p); return p; }
  p = readNode(file, key);
  nodeCache.set(id, p);
  while (nodeCache.size > 48) nodeCache.delete(nodeCache.keys().next().value!);
  return p;
}

// ------------------------------------------------------------------ a block
type Measure = [number, number, string, number];   // eaves, top, shape, points
interface Done { key: string; measured: number; of: number; read: number; unbuilt: number; few: number }
const cacheOf = (key: string) => `${CACHE}/${key.replace(',', '_')}.json`;

// Measures a block's buildings from the scan's files, and keeps the measures in the cache.
async function measure(key: string, files: StacFile[]): Promise<Done> {
  const list = blocks.get(key)!;
  let read = 0, unbuilt = 0, few = 0;
  const [bi, bj] = key.split(',').map(Number);
  // the block's buildings, reaching out of it as they do
  let x0 = bi * BLOCK, z0 = bj * BLOCK, x1 = x0 + BLOCK, z1 = z0 + BLOCK;
  for (const b of list) { x0 = Math.min(x0, b.box[0]); z0 = Math.min(z0, b.box[1]); x1 = Math.max(x1, b.box[2]); z1 = Math.max(z1, b.box[3]); }
  const size = Math.max(x1 - x0, z1 - z0);
  const { map, err } = tmToWorld(x0, z0, size);
  if (err > 0.02) console.warn(`  block ${key}: the scan's grid mapped onto the game's to within ${(err * 100).toFixed(1)} cm`);
  let tlo = [Infinity, Infinity], thi = [-Infinity, -Infinity];
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    const g = worldToGrid(x, z, GRID_TM);
    tlo = [Math.min(tlo[0], g.e), Math.min(tlo[1], g.n)]; thi = [Math.max(thi[0], g.e), Math.max(thi[1], g.n)];
  }
  const box: [number, number, number, number] = [tlo[0] - 1, tlo[1] - 1, thi[0] + 1, thi[1] + 1];

  // the buildings by cell
  const index = new Map<string, number[]>();
  list.forEach((b, id) => {
    for (let i = Math.floor(b.box[0] / CELL); i <= Math.floor(b.box[2] / CELL); i++) {
      for (let j = Math.floor(b.box[1] / CELL); j <= Math.floor(b.box[3] / CELL); j++) {
        const k = `${i},${j}`;
        (index.get(k) ?? index.set(k, []).get(k)!).push(id);
      }
    }
  });
  const pts = list.map(() => ({ x: [] as number[], z: [] as number[], y: [] as number[], ground: 0 }));
  for (const f of files) {
    if (f.bbox[0] > box[2] || f.bbox[2] < box[0] || f.bbox[1] > box[3] || f.bbox[3] < box[1]) continue;
    const file = await open(f);
    const keys = nodesOver(file, box);
    const nodes = await Promise.all(keys.map((k) => points(file, k)));
    for (const p of nodes) {
      read += p.count;
      for (let k = 0; k < p.count; k++) {
        if (NOISE.has(p.cls[k])) continue;
        const e = p.x[k], n = p.y[k];
        if (e < box[0] || e > box[2] || n < box[1] || n > box[3]) continue;
        const [x, z] = map(e, n);
        for (const id of index.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
          const b = list[id];
          if (x < b.box[0] || x > b.box[2] || z < b.box[1] || z > b.box[3]) continue;
          if (!inside(x, z, b.rings[0]) || b.rings.slice(1).some((h) => inside(x, z, h)) || nearEdge(x, z, b.rings, EDGE)) continue;
          const q = pts[id];
          q.x.push(x); q.z.push(z); q.y.push(p.z[k]);
          if (p.cls[k] === GROUND) q.ground++;
        }
      }
    }
  }
  const out: Record<string, Measure> = {};
  list.forEach((b, id) => {
    const q = pts[id];
    if (q.x.length < 4) { few++; return; }
    if (q.ground > q.x.length / 2) { unbuilt++; return; }
    const roof = fitRoof(b.rings, b.area, Float64Array.from(q.x), Float64Array.from(q.z), Float32Array.from(q.y));
    if (!roof) { few++; return; }
    const shape = roof.shape === 'skillion' ? `skillion:${Math.round(roof.direction!)}` : roof.across ? `${roof.shape}:across` : roof.shape;
    out[b.osm] = [Math.round(roof.eaves * 10) / 10, Math.round(roof.top * 10) / 10, shape, q.x.length];
  });
  writeFileSync(cacheOf(key), JSON.stringify(out));
  return { key, measured: Object.keys(out).length, of: list.length, read, unbuilt, few };
}

if (!isMainThread) {
  // a worker: measures the blocks it is sent
  const files = workerData.files as StacFile[];
  parentPort!.on('message', async (key: string) => parentPort!.postMessage(await measure(key, files)));
} else {
  // ------------------------------------------------------------------ the scan's files
  let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const b of buildings) {
    for (const [x, z] of [[b.box[0], b.box[1]], [b.box[2], b.box[3]], [b.box[0], b.box[3]], [b.box[2], b.box[1]]]) {
      const g = worldToGrid(x, z, GRID_TM);
      lo = [Math.min(lo[0], g.e), Math.min(lo[1], g.n)]; hi = [Math.max(hi[0], g.e), Math.max(hi[1], g.n)];
    }
  }
  const all = await findFiles([lo[0], lo[1], hi[0], hi[1]], (c) => c === COLLECTION);
  const newest = new Map<string, StacFile>();
  for (const f of all) {
    const key = f.bbox.join(',');
    const had = newest.get(key);
    if (!had || f.datetime > had.datetime) newest.set(key, f);
  }
  const files = [...newest.values()];
  const flown = [...new Set(files.map((f) => f.datetime.slice(0, 10)))].sort();
  console.log(`${files.length} squares of the scan, flown ${flown.join(', ')}`);
  

  // ------------------------------------------------------------------ the blocks
  mkdirSync(CACHE, { recursive: true });
  // (the blocks asked for are measured again)
  const todo = [...blocks.keys()].sort().filter((key) => only.size ? only.has(key) : again || !existsSync(cacheOf(key)));
  console.log(`${todo.length} of ${blocks.size} blocks to measure`);
  let done = 0, read = 0, unbuilt = 0, few = 0;
  const t0 = Date.now();
  const jobs = Math.min(JOBS, availableParallelism(), todo.length);
  await Promise.all(Array.from({ length: jobs }, () => new Promise<void>((finish, fail) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { files, headers }, argv: process.argv.slice(2) });
    const next = () => {
      const key = todo.shift();
      if (key) worker.postMessage(key); else worker.terminate().then(() => finish());
    };
    worker.on('message', (d: Done) => {
      done++; read += d.read; unbuilt += d.unbuilt; few += d.few;
      console.log(`block ${d.key}: ${d.measured} of ${d.of} buildings measured (${done} done, ${todo.length} to go, ${(read / 1e6).toFixed(0)} M points read, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      next();
    });
    worker.on('error', fail);
    next();
  })));

  // ------------------------------------------------------------------ the measures
  const results = new Map<string, Measure>();
  for (const key of blocks.keys()) {
    if (!existsSync(cacheOf(key))) continue;
    for (const [id, m] of Object.entries(JSON.parse(readFileSync(cacheOf(key), 'utf8')) as Record<string, Measure>)) results.set(id, m);
  }
  const shapes = new Map<string, number>();
  for (const m of results.values()) { const s = m[2].split(':')[0]; shapes.set(s, (shapes.get(s) ?? 0) + 1); }
  mkdirSync('data/laser', { recursive: true });
  const ids = [...results.keys()].sort();
  writeFileSync(OUT, `{
  "attribution": "${LASER_ATTRIBUTION}",
  "source": "https://api.lantmateriet.se/stac-hojd/v1/collections/${COLLECTION}",
  "flown": ${JSON.stringify(flown)},
  "note": "OpenStreetMap's buildings (data/osm/buildings.json) measured from the laser scan (tools/fetch-laser.ts): for each, the eaves' and the roof's top height in metres (RH 2000), the roof's shape (with a skillion's compass direction, or a gabled roof's ridge across), and the points it was measured from.",
  "buildings": {
${ids.map((id) => `    ${JSON.stringify(id)}: ${JSON.stringify(results.get(id))}`).join(',\n')}
  }
}
`);
  console.log(`${OUT}: ${results.size} of ${buildings.length} buildings (${[...shapes].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${n} ${s}`).join(', ')}); of the ${done} blocks measured now, ${unbuilt} not built when flown and ${few} with too few points`);
}
