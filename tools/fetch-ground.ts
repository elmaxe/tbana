// Samples the ground height along the traced services' tracks from Lantmäteriet's 1 m elevation
// model (Markhöjdmodell, RH 2000) into data/ground/red-line.json.
//
//   LM_USER=… LM_PASSWORD=… node tools/fetch-ground.ts
//
// The model is free (CC BY 4.0) but its download needs a Geotorget account, sent as HTTP Basic
// auth from LM_USER and LM_PASSWORD. Without them the requests go out unauthenticated, which
// works only if the environment adds the login itself. Behind a proxy that adds it, Node's fetch
// needs NODE_USE_ENV_PROXY=1 to go through the proxy at all.
//
// The model comes as Cloud Optimized GeoTIFFs, 2.5 × 2.5 km each on SWEREF 99 TM. The files are
// found through Lantmäteriet's STAC catalogue for height data, and only the blocks under the
// tracks are read, not whole files. Every piece of track on a traced service is sampled every
// 10 m, tunnels too: above a tunnel the ground says how deep it must be.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fromUrl } from 'geotiff';
import type { GeoTIFFImage } from 'geotiff';
import { GRID_TM, unproject, worldToGrid } from '../src/geo.ts';
import type { TrackGraph, TrackPiece } from '../src/track-graph.ts';

const OUT = 'data/ground/red-line.json';
const STEP = 10;
const STAC = 'https://api.lantmateriet.se/stac-hojd/v1/search';

// The download server turns away some requests (403) when too many arrive at once, so geotiff's
// fetches go out a few at a time and are retried after a pause.
{
  const fetch0 = globalThis.fetch;
  let active = 0;
  const queue: (() => void)[] = [];
  globalThis.fetch = async (input, init) => {
    if (active >= 3) await new Promise<void>((go) => queue.push(go));
    active++;
    try {
      for (let attempt = 0; ; attempt++) {
        const res = await fetch0(input, init);
        if (res.ok || attempt === 5 || ![403, 429, 503].includes(res.status)) return res;
        await res.body?.cancel();
        await new Promise((go) => setTimeout(go, 500 * 2 ** attempt));
      }
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

const graph: TrackGraph = JSON.parse(readFileSync('public/data/track-graph.json', 'utf8'));
const used = new Set(graph.routes.flatMap((r) => r.path.map((s) => s.piece)));
const pieces = graph.pieces.filter((p) => used.has(p.id));

function pointAt(p: TrackPiece, s: number): [number, number] {
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

// points to sample
interface Point { x: number; z: number; e: number; n: number; h?: number }
const points: Point[] = [];
for (const p of pieces) {
  const n = Math.max(1, Math.ceil(p.length / STEP));
  for (let k = 0; k <= n; k++) {
    const [x, z] = pointAt(p, (p.length * k) / n);
    const g = worldToGrid(x, z, GRID_TM);
    points.push({ x, z, e: g.e, n: g.n });
  }
}

const user = process.env.LM_USER, password = process.env.LM_PASSWORD;
const headers: Record<string, string> = user && password
  ? { Authorization: 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64') }
  : {};
if (!user || !password) console.warn('LM_USER / LM_PASSWORD not set: trying without a login');

// the elevation model's files under the tracks, from the STAC catalogue
interface Tile { url: string; bbox: number[]; pts: Point[] }
const tiles: Tile[] = [];
{
  const corners = [
    [Math.min(...points.map((p) => p.e)), Math.min(...points.map((p) => p.n))],
    [Math.max(...points.map((p) => p.e)), Math.max(...points.map((p) => p.n))],
  ].map(([e, n]) => unproject(e, n, GRID_TM));
  let body: object | undefined = {
    bbox: [corners[0].lon - 0.01, corners[0].lat - 0.01, corners[1].lon + 0.01, corners[1].lat + 0.01],
    limit: 200,
  };
  while (body) {
    const res = await fetch(STAC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${STAC}: ${res.status} ${res.statusText}`);
    const page = await res.json() as {
      features: { collection: string; assets: { data: { href: string; 'proj:bbox': number[] } } }[];
      links: { rel: string; body?: object }[];
    };
    for (const f of page.features) {
      if (!f.collection.startsWith('mhm-')) continue;
      tiles.push({ url: f.assets.data.href, bbox: f.assets.data['proj:bbox'], pts: [] });
    }
    body = page.links.find((l) => l.rel === 'next')?.body;
  }
}
for (const p of points) {
  // proj:bbox is [min e, min n, max e, max n]
  const tile = tiles.find(({ bbox: [e0, n0, e1, n1] }) => p.e >= e0 && p.e < e1 && p.n >= n0 && p.n < n1);
  tile?.pts.push(p);
}

for (const { url, pts } of tiles) {
  if (!pts.length) continue;
  let image: GeoTIFFImage;
  try {
    image = await (await fromUrl(url, { headers })).getImage();
  } catch (err) {
    const msg = String((err as Error).message ?? err);
    throw new Error(`${url}: ${msg}${/401|403/.test(msg) ? ' (check LM_USER and LM_PASSWORD)' : ''}`);
  }
  const [x0, , , y1] = image.getBoundingBox();
  const [rx, ry] = image.getResolution();
  const w = image.getWidth(), h = image.getHeight();
  // read the blocks under the points, one 256 × 256 window at a time
  const windows = new Map<string, Point[]>();
  for (const p of pts) {
    const col = Math.min(w - 1, Math.max(0, Math.floor((p.e - x0) / rx)));
    const row = Math.min(h - 1, Math.max(0, Math.floor((p.n - y1) / ry)));
    const wk = `${col >> 8}_${row >> 8}`;
    const list = windows.get(wk);
    if (list) list.push(p); else windows.set(wk, [p]);
  }
  for (const [wk, wpts] of windows) {
    const [bc, br] = wk.split('_').map(Number);
    const c0 = bc << 8, r0 = br << 8, c1 = Math.min(w, c0 + 256), r1 = Math.min(h, r0 + 256);
    const raster = (await image.readRasters({ window: [c0, r0, c1, r1], samples: [0] }))[0] as Float32Array;
    for (const p of wpts) {
      const col = Math.min(w - 1, Math.max(0, Math.floor((p.e - x0) / rx)));
      const row = Math.min(h - 1, Math.max(0, Math.floor((p.n - y1) / ry)));
      const v = raster[(row - r0) * (c1 - c0) + (col - c0)];
      if (Number.isFinite(v) && v > -100 && v < 1000) p.h = v;
    }
  }
  console.log(`${url.split('/').pop()}: ${pts.length} points in ${windows.size} blocks`);
}

const missing = points.filter((p) => p.h === undefined).length;
if (missing) console.warn(`${missing} points without a height`);
const samples = points.filter((p) => p.h !== undefined)
  .map((p) => [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, Math.round(p.h! * 100) / 100]);
mkdirSync('data/ground', { recursive: true });
writeFileSync(OUT, `{
  "attribution": "Markhöjdmodell © Lantmäteriet, CC BY 4.0",
  "note": "Ground height (RH 2000) under the tracks of the traced services, every ${STEP} m: [world x, world z, height].",
  "samples": [
${samples.map((s) => '    ' + JSON.stringify(s)).join(',\n')}
  ]
}
`);
console.log(`${OUT}: ${samples.length} samples`);
