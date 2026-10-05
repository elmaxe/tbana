// Samples the ground height from Lantmäteriet's 1 m elevation model (Markhöjdmodell, RH 2000).
//
//   LM_USER=… LM_PASSWORD=… node tools/fetch-ground.ts            under the tracks -> data/ground/red-line.json
//   LM_USER=… LM_PASSWORD=… node tools/fetch-ground.ts entrances  around the stations' entrances
//                                                                 -> data/ground/entrances.json
//
// The login and the way the files are found are in tools/lib/lantmateriet.ts. Here the model's
// 2.5 × 2.5 km files are read at full resolution, only the blocks under the points. Every piece
// of track on a traced service is sampled every 10 m, tunnels too: above a tunnel the ground says
// how deep it must be. Around each subway entrance near a station on a traced service, a square
// of ground is sampled on a grid: the street the station's exits come up to. (The ground of the
// whole city is tools/fetch-terrain.ts.)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fromUrl } from 'geotiff';
import type { GeoTIFFImage } from 'geotiff';
import { GRID_TM, lonLatToWorld, worldToGrid } from '../src/geo.ts';
import { authHeaders, findFiles, throttleFetch } from './lib/lantmateriet.ts';
import type { TrackGraph, TrackPiece } from '../src/track-graph.ts';

const MODE = process.argv[2] ?? 'tracks';
if (MODE !== 'tracks' && MODE !== 'entrances') {
  console.error('usage: node tools/fetch-ground.ts [tracks|entrances]');
  process.exit(1);
}
const OUT = MODE === 'tracks' ? 'data/ground/red-line.json' : 'data/ground/entrances.json';
const STEP = 10;
// around the entrances: a square PATCH × PATCH cells of PATCH_STEP m, centred on the entrance, for
// the entrances within NEAR of a station
const PATCH = 18, PATCH_STEP = 4, NEAR = 450;
// around each station: STATION_PATCH × STATION_PATCH cells
const STATION_PATCH = 50;

throttleFetch();

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
const point = (x: number, z: number) => {
  const g = worldToGrid(x, z, GRID_TM);
  const p: Point = { x, z, e: g.e, n: g.n };
  points.push(p);
  return p;
};
if (MODE === 'tracks') {
  for (const p of pieces) {
    const n = Math.max(1, Math.ceil(p.length / STEP));
    for (let k = 0; k <= n; k++) point(...pointAt(p, (p.length * k) / n));
  }
}

// the entrances near the traced services' stations, each with its square of points
interface Entrance { osm: number; name: string | null; station: string; x: number; z: number; pts: Point[] }
const entrances: Entrance[] = [];
const stationPatches: { station: string; x: number; z: number; pts: Point[] }[] = [];
if (MODE === 'entrances') {
  const osm = JSON.parse(readFileSync('data/osm/network.json', 'utf8')) as {
    elements: { type: string; id: number; lat: number; lon: number; tags?: Record<string, string> }[];
  };
  const served = new Set(graph.routes.flatMap((r) => r.stops.map((s) => s.station)));
  const stations = graph.stations.filter((s) => served.has(s.name));
  for (const el of osm.elements) {
    if (el.type !== 'node' || el.tags?.railway !== 'subway_entrance') continue;
    const { x, z } = lonLatToWorld(el.lon, el.lat);
    let near: { name: string; d: number } | null = null;
    for (const st of stations) {
      const d = Math.hypot(st.x - x, st.z - z);
      if (d < NEAR && (!near || d < near.d)) near = { name: st.name, d };
    }
    if (!near) continue;
    const pts: Point[] = [];
    for (let i = 0; i <= PATCH; i++) {
      for (let j = 0; j <= PATCH; j++) pts.push(point(x + (j - PATCH / 2) * PATCH_STEP, z + (i - PATCH / 2) * PATCH_STEP));
    }
    entrances.push({ osm: el.id, name: el.tags.name ?? null, station: near.name, x, z, pts });
  }
  console.log(`${entrances.length} entrances near ${stations.length} stations`);
  for (const st of stations) {
    const pts: Point[] = [];
    for (let i = 0; i <= STATION_PATCH; i++) {
      for (let j = 0; j <= STATION_PATCH; j++) pts.push(point(st.x + (j - STATION_PATCH / 2) * PATCH_STEP, st.z + (i - STATION_PATCH / 2) * PATCH_STEP));
    }
    stationPatches.push({ station: st.name, x: st.x, z: st.z, pts });
  }
}

const headers = authHeaders();

// the elevation model's files under the points
interface Tile { url: string; bbox: number[]; pts: Point[] }
const tiles: Tile[] = [];
{
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const p of points) {
    lo[0] = Math.min(lo[0], p.e); lo[1] = Math.min(lo[1], p.n);
    hi[0] = Math.max(hi[0], p.e); hi[1] = Math.max(hi[1], p.n);
  }
  for (const f of await findFiles([lo[0], lo[1], hi[0], hi[1]], (c) => c.startsWith('mhm-'))) tiles.push({ ...f, pts: [] });
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
mkdirSync('data/ground', { recursive: true });
if (MODE === 'entrances') {
  const r = (n: number) => Math.round(n * 10) / 10;
  const heights = (pts: Point[]) => pts.map((p) => (p.h === undefined ? null : Math.round(p.h * 100) / 100));
  const rows = entrances.map((e) => '    ' + JSON.stringify({ osm: e.osm, name: e.name, station: e.station, x: r(e.x), z: r(e.z), h: heights(e.pts) }));
  const stationRows = stationPatches.map((e) => '    ' + JSON.stringify({ station: e.station, x: r(e.x), z: r(e.z), h: heights(e.pts) }));
  writeFileSync(OUT, `{
  "attribution": "Markhöjdmodell © Lantmäteriet, CC BY 4.0",
  "note": "Ground height (RH 2000) around the subway entrances within ${NEAR} m of a station on a traced service, and around those stations: h is a square of size × size points (stationSize around a station) ${PATCH_STEP} m apart, centred on the entrance or the station's node, row by row from north to south, each row from west to east (world x, z as in src/geo.ts).",
  "step": ${PATCH_STEP},
  "size": ${PATCH + 1},
  "stationSize": ${STATION_PATCH + 1},
  "entrances": [
${rows.join(',\n')}
  ],
  "stations": [
${stationRows.join(',\n')}
  ]
}
`);
  console.log(`${OUT}: ${entrances.length} entrances`);
  process.exit(0);
}
const samples = points.filter((p) => p.h !== undefined)
  .map((p) => [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, Math.round(p.h! * 100) / 100]);
writeFileSync(OUT, `{
  "attribution": "Markhöjdmodell © Lantmäteriet, CC BY 4.0",
  "note": "Ground height (RH 2000) under the tracks of the traced services, every ${STEP} m: [world x, world z, height].",
  "samples": [
${samples.map((s) => '    ' + JSON.stringify(s)).join(',\n')}
  ]
}
`);
console.log(`${OUT}: ${samples.length} samples`);
