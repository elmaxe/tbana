// Lays Lantmäteriet's aerial photos (Ortofoto, CC BY 4.0) over the city: for each of the city's
// tiles (public/data/city/index.json) a JPEG of the newest photo of it, north up on the game's grid,
// covering the tile and PHOTO_MARGIN round it (format in src/city-tile.ts).
//
//   LM_USER=… LM_PASSWORD=… node tools/fetch-ortho.ts              -> public/data/ortho/
//   LM_USER=… LM_PASSWORD=… node tools/fetch-ortho.ts -- --again   fetch the tiles already there too
//   LM_USER=… LM_PASSWORD=… node tools/fetch-ortho.ts -- 0,0 1,-1  only these tiles
//
// The login and the way the files are found are in tools/lib/lantmateriet.ts; the photos are a
// product of their own on Geotorget (Ortofoto Nedladdning), which the account must have ordered.
// The photos are Cloud Optimized GeoTIFFs on SWEREF 99 TM with overviews, in squares of 2.5 km
// (16 cm a pixel) or, in older years, 5 km; each pixel is taken from the newest year's photo over
// it, and of the photos only the blocks under the tile are read, from the coarsest overview still
// sharp enough. The game's grid (SWEREF 99 18 00) is turned about 2.6° from
// the photos', so each pixel is found through the tile's corners (as in tools/fetch-terrain.ts)
// and averaged from 2 × 2 samples between the photo's four nearest pixels.
//
// Tiles near a station, where the player comes up into the street, get twice the resolution of
// the rest: about 0.5 m a pixel against 1 m. A tile already written is kept, so a run that stops
// can be started again; the index is written from the files there at the end.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fromUrl } from 'geotiff';
import type { GeoTIFF, GeoTIFFImage } from 'geotiff';
import jpeg from 'jpeg-js';
import { GRID_TM, worldToGrid } from '../src/geo.ts';
import { CITY_TILE, PHOTO_MARGIN, photoName } from '../src/city-tile.ts';
import type { CityIndex, PhotoIndex } from '../src/city-tile.ts';
import type { TrackGraph } from '../src/track-graph.ts';
import { ORTHO_ATTRIBUTION, STAC_IMAGES, authHeaders, findFiles, throttleFetch } from './lib/lantmateriet.ts';
import type { StacFile } from './lib/lantmateriet.ts';

const OUT = 'public/data/ortho';
const SPAN = CITY_TILE + 2 * PHOTO_MARGIN;
// the photo's size in pixels: near the stations, and elsewhere (multiples of 16, for the JPEG)
const FINE = 1024, COARSE = 512;
// a tile is near a station when its square comes this close to one
const NEAR = 100;
const SS = 2;           // samples a pixel, each way
const QUALITY = 72;
const OPEN = 6;         // photo files kept open at once (each caches its blocks)

const args = process.argv.slice(2);
const again = args.includes('--again');
const only = args.filter((a) => /^-?\d+,-?\d+$/.test(a));

throttleFetch();
const headers = authHeaders();

const city: CityIndex = JSON.parse(readFileSync('public/data/city/index.json', 'utf8'));
const graph: TrackGraph = JSON.parse(readFileSync('public/data/track-graph.json', 'utf8'));
const served = new Set(graph.routes.flatMap((r) => r.stops.map((s) => s.station)));
const stations = graph.stations.filter((s) => served.has(s.name));

const fine = (i: number, j: number) => {
  const x0 = i * CITY_TILE, z0 = j * CITY_TILE;
  return stations.some((s) => Math.hypot(Math.max(x0 - s.x, 0, s.x - x0 - CITY_TILE), Math.max(z0 - s.z, 0, s.z - z0 - CITY_TILE)) < NEAR);
};

// The extended square's corners on SWEREF 99 TM: north-west, north-east, south-west, south-east.
function corners(i: number, j: number) {
  const x0 = i * CITY_TILE - PHOTO_MARGIN, z0 = j * CITY_TILE - PHOTO_MARGIN;
  return [[0, 0], [SPAN, 0], [0, SPAN], [SPAN, SPAN]].map(([dx, dz]) => worldToGrid(x0 + dx, z0 + dz, GRID_TM));
}

// ------------------------------------------------------------------ the photos' files
const todo = (only.length ? only.map((a) => a.split(',').map(Number) as [number, number]) : city.tiles)
  .filter(([i, j]) => city.tiles.some(([a, b]) => a === i && b === j))
  .filter(([i, j]) => again || only.length || !existsSync(`${OUT}/${photoName(i, j)}`));
console.log(`${todo.length} of ${city.tiles.length} tiles to fetch`);

let files: StacFile[] = [];
if (todo.length) {
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const [i, j] of todo) {
    for (const { e, n } of corners(i, j)) {
      lo[0] = Math.min(lo[0], e); lo[1] = Math.min(lo[1], n);
      hi[0] = Math.max(hi[0], e); hi[1] = Math.max(hi[1], n);
    }
  }
  // the yearly colour photos (not the historical ones, nor the infrared): of each square, the newest
  const all = await findFiles([lo[0], lo[1], hi[0], hi[1]], (c) => /^orto-/.test(c) && !c.includes('historisk'), STAC_IMAGES);
  const colour = all.filter((f) => {
    const kind = String(f.properties.spektraltyp ?? '');
    return kind ? kind.startsWith('rgb') : /_f\w\d\d$/.test(f.id);
  });
  const newest = new Map<string, StacFile>();
  for (const f of colour) {
    const key = f.bbox.join(',');
    const had = newest.get(key);
    if (!had || f.datetime > had.datetime) newest.set(key, f);
  }
  // newest first: each pixel is taken from the newest photo over it (the older years' squares
  // are 5 km, and overlap the newer)
  files = [...newest.values()].sort((a, b) => b.datetime.localeCompare(a.datetime));
  const years = new Map<string, number>();
  for (const f of files) years.set(f.collection, (years.get(f.collection) ?? 0) + 1);
  console.log(`${files.length} photo squares: ${[...years].map(([c, n]) => `${n} from ${c}`).join(', ')}`);
}

// the open files, the last few used
const open = new Map<string, Promise<{ tiff: GeoTIFF; images: { image: GeoTIFFImage; res: number }[] }>>();
function openFile(f: StacFile) {
  let p = open.get(f.url);
  if (p) { open.delete(f.url); open.set(f.url, p); return p; }
  p = (async () => {
    let tiff: GeoTIFF;
    try {
      tiff = await fromUrl(f.url, { headers });
    } catch (err) {
      const msg = String((err as Error).message ?? err);
      throw new Error(`${f.url}: ${msg} (the account needs LM_USER and LM_PASSWORD, and Ortofoto Nedladdning ordered on Geotorget)`);
    }
    const images: { image: GeoTIFFImage; res: number }[] = [];
    for (let k = 0, n = await tiff.getImageCount(); k < n; k++) {
      const image = await tiff.getImage(k);
      // skip the masks some files carry beside their overviews
      if (image.getSamplesPerPixel() < 3) continue;
      if (image.getBitsPerSample(0) !== 8) throw new Error(`${f.url}: ${image.getBitsPerSample(0)} bits a sample, not 8`);
      images.push({ image, res: (f.bbox[2] - f.bbox[0]) / image.getWidth() });
    }
    return { tiff, images: images.sort((a, b) => a.res - b.res) };
  })();
  open.set(f.url, p);
  while (open.size > OPEN) open.delete(open.keys().next().value!);
  return p;
}

// ------------------------------------------------------------------ the tiles
mkdirSync(OUT, { recursive: true });
let n = 0, bytes = 0;
for (const [i, j] of todo) {
  const size = fine(i, j) ? FINE : COARSE;
  const px = SPAN / size, step = px / SS;
  const [nw, ne, sw, se] = corners(i, j);
  // each sample's place on the photos' grid, row by row from the north-west
  const S = size * SS;
  const E = new Float64Array(S * S), N = new Float64Array(S * S);
  for (let r = 0; r < S; r++) {
    const v = (r + 0.5) / S;
    for (let c = 0; c < S; c++) {
      const u = (c + 0.5) / S, k = r * S + c;
      E[k] = (1 - v) * ((1 - u) * nw.e + u * ne.e) + v * ((1 - u) * sw.e + u * se.e);
      N[k] = (1 - v) * ((1 - u) * nw.n + u * ne.n) + v * ((1 - u) * sw.n + u * se.n);
    }
  }
  const sum = new Float32Array(size * size * 3), count = new Uint8Array(size * size), done = new Uint8Array(S * S);
  const e0 = Math.min(nw.e, sw.e), e1 = Math.max(ne.e, se.e), n0 = Math.min(sw.n, se.n), n1 = Math.max(nw.n, ne.n);
  for (const f of files) {
    const [fe0, fn0, fe1, fn1] = f.bbox;
    if (fe1 <= e0 || fe0 >= e1 || fn1 <= n0 || fn0 >= n1) continue;
    // the samples in this file still to take
    const inside: number[] = [];
    for (let k = 0; k < E.length; k++) if (!done[k] && E[k] >= fe0 && E[k] < fe1 && N[k] > fn0 && N[k] <= fn1) inside.push(k);
    if (!inside.length) continue;
    const { images } = await openFile(f);
    // the coarsest overview no coarser than the samples are apart (with some slack)
    const { image, res } = images.filter((m) => m.res <= step * 1.35).pop() ?? images[0];
    const w = image.getWidth(), h = image.getHeight();
    // the window of pixels round them
    let c0 = Infinity, r0 = Infinity, c1 = -Infinity, r1 = -Infinity;
    for (const k of inside) {
      const col = (E[k] - fe0) / res - 0.5, row = (fn1 - N[k]) / res - 0.5;
      c0 = Math.min(c0, Math.floor(col)); c1 = Math.max(c1, Math.floor(col) + 2);
      r0 = Math.min(r0, Math.floor(row)); r1 = Math.max(r1, Math.floor(row) + 2);
    }
    c0 = Math.max(0, c0); r0 = Math.max(0, r0); c1 = Math.min(w, c1); r1 = Math.min(h, r1);
    const bands = await image.readRasters({ window: [c0, r0, c1, r1], samples: [0, 1, 2] }) as unknown as Uint8Array[];
    const ww = c1 - c0;
    const at = (c: number, r: number) => (Math.min(r1 - 1, Math.max(r0, r)) - r0) * ww + (Math.min(c1 - 1, Math.max(c0, c)) - c0);
    for (const k of inside) {
      const col = (E[k] - fe0) / res - 0.5, row = (fn1 - N[k]) / res - 0.5;
      const ci = Math.floor(col), ri = Math.floor(row), fu = col - ci, fv = row - ri;
      const a = at(ci, ri), b = at(ci + 1, ri), c = at(ci, ri + 1), d = at(ci + 1, ri + 1);
      const p = Math.floor(Math.floor(k / S) / SS) * size + Math.floor((k % S) / SS);
      for (let ch = 0; ch < 3; ch++) {
        const B = bands[ch];
        sum[3 * p + ch] += (1 - fv) * ((1 - fu) * B[a] + fu * B[b]) + fv * ((1 - fu) * B[c] + fu * B[d]);
      }
      count[p]++;
      done[k] = 1;
    }
  }
  // pixels no photo covers: the tile's average
  const mean = [0, 0, 0];
  let filled = 0;
  for (let p = 0; p < size * size; p++) if (count[p]) { for (let ch = 0; ch < 3; ch++) mean[ch] += sum[3 * p + ch] / count[p]; filled++; }
  if (!filled) { console.warn(`  ${i},${j}: no photo covers it`); continue; }
  const rgba = new Uint8Array(size * size * 4);
  for (let p = 0; p < size * size; p++) {
    for (let ch = 0; ch < 3; ch++) rgba[4 * p + ch] = Math.round(count[p] ? sum[3 * p + ch] / count[p] : mean[ch] / filled);
    rgba[4 * p + 3] = 255;
  }
  const data = jpeg.encode({ data: rgba, width: size, height: size }, QUALITY).data;
  writeFileSync(`${OUT}/${photoName(i, j)}`, data);
  bytes += data.length;
  n++;
  const missing = size * size - filled;
  console.log(`${i},${j}: ${size} px, ${(data.length / 1e3).toFixed(0)} kB${missing ? `, ${(100 * missing / size / size).toFixed(1)}% not covered` : ''} (${n} of ${todo.length})`);
}
if (n) console.log(`${n} tiles fetched, ${(bytes / 1e6).toFixed(1)} MB`);

// ------------------------------------------------------------------ the index
// of the photos there, for the tiles still in the city
const inCity = new Set(city.tiles.map(([i, j]) => photoName(i, j)));
const tiles: [number, number, number][] = [];
let total = 0;
for (const name of readdirSync(OUT)) {
  if (name === 'index.json') continue;
  if (!inCity.has(name)) { rmSync(`${OUT}/${name}`); continue; }
  const buf = readFileSync(`${OUT}/${name}`);
  total += buf.length;
  const [i, j] = name.replace('.jpg', '').split('_').map(Number);
  tiles.push([i, j, jpegSize(buf)]);
}
tiles.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
const index: PhotoIndex = {
  attribution: [ORTHO_ATTRIBUTION],
  note: `Aerial photos of the city's ${CITY_TILE} m tiles (src/city-tile.ts), each covering the tile and ${PHOTO_MARGIN} m round it, north up on the game's grid, from Lantmäteriet's orthophotos (Ortofoto Nedladdning, the newest year of each square) at about ${(SPAN / FINE).toFixed(2)} m a pixel near the stations and ${(SPAN / COARSE).toFixed(2)} m elsewhere.`,
  margin: PHOTO_MARGIN,
  tiles,
};
writeFileSync(`${OUT}/index.json`, JSON.stringify(index) + '\n');
console.log(`${OUT}: ${tiles.length} of ${city.tiles.length} tiles have a photo, ${(total / 1e6).toFixed(1)} MB`);

// A JPEG's width, from its frame header.
function jpegSize(buf: Buffer) {
  for (let p = 2; p + 9 < buf.length;) {
    if (buf[p] !== 0xff) { p++; continue; }
    const marker = buf[p + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return buf.readUInt16BE(p + 7);
    p += 2 + buf.readUInt16BE(p + 2);
  }
  throw new Error('not a JPEG');
}
