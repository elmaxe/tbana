// Samples the ground of the whole city from Lantmäteriet's elevation model: a grid STEP metres
// apart over each of the city's tiles (tools/lib/city-area.ts), in world coordinates.
//
//   LM_USER=… LM_PASSWORD=… node tools/fetch-terrain.ts   -> data/ground/city.json, city.bin.gz
//
// The login and the way the files are found are in tools/lib/lantmateriet.ts. The 10 km files
// carry overviews; the one at 2 m is read, and each point of the grid is interpolated between its
// four nearest values. The grid's points are on the game's grid (SWEREF 99 18 00), which is turned
// about 2.6° from the model's (SWEREF 99 TM): within a tile the one is mapped onto the other
// through the tile's corners, to within a millimetre.
//
// city.bin.gz holds the heights: for each tile in city.json's order, n × n heights in centimetres,
// row by row from the north-west corner southwards, each row from west to east, each as the
// difference (i16) from the one before it in its row, or for a row's first from the first of the
// row above, and for the tile's first from the tile's base (which then compress well).
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fromUrl } from 'geotiff';
import { GRID_TM, worldToGrid } from '../src/geo.ts';
import { CITY_TILE, deltaEncode } from '../src/city-tile.ts';
import { cityArea } from './lib/city-area.ts';
import { ATTRIBUTION, authHeaders, findFiles, throttleFetch } from './lib/lantmateriet.ts';

const STEP = 5;
const N = CITY_TILE / STEP + 1;
// the overview to read: 0 is the full 1 m grid, 1 is 2 m
const LEVEL = 1;

throttleFetch();
const headers = authHeaders();
const area = cityArea();
console.log(`${area.tiles.length} tiles of ${CITY_TILE} m, ${N} × ${N} points each`);

// every point's place on the model's grid, tile by tile
const E = new Float64Array(area.tiles.length * N * N), Nn = new Float64Array(area.tiles.length * N * N);
const H = new Float32Array(area.tiles.length * N * N).fill(NaN);
area.tiles.forEach(([i, j], t) => {
  const x0 = i * CITY_TILE, z0 = j * CITY_TILE;
  const c = [[0, 0], [CITY_TILE, 0], [0, CITY_TILE], [CITY_TILE, CITY_TILE]].map(([dx, dz]) => worldToGrid(x0 + dx, z0 + dz, GRID_TM));
  for (let r = 0; r < N; r++) {
    for (let k = 0; k < N; k++) {
      const u = k / (N - 1), v = r / (N - 1), at = (t * N + r) * N + k;
      E[at] = (1 - v) * ((1 - u) * c[0].e + u * c[1].e) + v * ((1 - u) * c[2].e + u * c[3].e);
      Nn[at] = (1 - v) * ((1 - u) * c[0].n + u * c[1].n) + v * ((1 - u) * c[2].n + u * c[3].n);
    }
  }
});
{
  // the corner mapping against the exact one, in the middle of a tile
  const [i, j] = area.tiles[0], m = (N - 1) / 2;
  const exact = worldToGrid(i * CITY_TILE + CITY_TILE / 2, j * CITY_TILE + CITY_TILE / 2, GRID_TM);
  const at = m * N + m;
  console.log(`corner mapping off by ${(Math.hypot(E[at] - exact.e, Nn[at] - exact.n) * 1000).toFixed(2)} mm in a tile's middle`);
}

let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
for (let k = 0; k < E.length; k++) {
  lo = [Math.min(lo[0], E[k]), Math.min(lo[1], Nn[k])];
  hi = [Math.max(hi[0], E[k]), Math.max(hi[1], Nn[k])];
}
const files = await findFiles([lo[0], lo[1], hi[0], hi[1]], (c) => c === 'dtm-cog');
console.log(`${files.length} files`);

for (const { url, bbox: [e0, n0, e1, n1] } of files) {
  // the points in this file, by block of the overview
  const tiff = await fromUrl(url, { headers });
  const image = await tiff.getImage(LEVEL);
  const w = image.getWidth(), h = image.getHeight();
  const rx = (e1 - e0) / w, ry = (n1 - n0) / h;
  const tw = image.getTileWidth(), th = image.getTileHeight();
  const blocks = new Map<number, number[]>();
  for (let k = 0; k < E.length; k++) {
    if (E[k] < e0 || E[k] >= e1 || Nn[k] < n0 || Nn[k] >= n1) continue;
    // pixel centres are at half a pixel
    const col = (E[k] - e0) / rx - 0.5, row = (n1 - Nn[k]) / ry - 0.5;
    const key = Math.floor(Math.max(0, row) / th) * 10000 + Math.floor(Math.max(0, col) / tw);
    (blocks.get(key) ?? blocks.set(key, []).get(key)!).push(k);
  }
  let count = 0;
  for (const [key, list] of blocks) {
    const br = Math.floor(key / 10000), bc = key % 10000;
    // the block, with a pixel's margin for the interpolation
    const c0 = Math.max(0, bc * tw - 1), r0 = Math.max(0, br * th - 1);
    const c1 = Math.min(w, (bc + 1) * tw + 1), r1 = Math.min(h, (br + 1) * th + 1);
    const raster = (await image.readRasters({ window: [c0, r0, c1, r1], samples: [0] }))[0] as Float32Array;
    const ww = c1 - c0;
    const val = (c: number, r: number) => {
      const v = raster[(Math.min(r1 - 1, Math.max(r0, r)) - r0) * ww + (Math.min(c1 - 1, Math.max(c0, c)) - c0)];
      return Number.isFinite(v) && v > -100 && v < 1000 ? v : NaN;
    };
    for (const k of list) {
      const col = (E[k] - e0) / rx - 0.5, row = (n1 - Nn[k]) / ry - 0.5;
      const ci = Math.floor(col), ri = Math.floor(row), fu = col - ci, fv = row - ri;
      const a = val(ci, ri), b = val(ci + 1, ri), c = val(ci, ri + 1), d = val(ci + 1, ri + 1);
      const v = (1 - fv) * ((1 - fu) * a + fu * b) + fv * ((1 - fu) * c + fu * d);
      // at the model's edge (the sea), the nearest value there is
      H[k] = Number.isNaN(v) ? [a, b, c, d].find((x) => !Number.isNaN(x)) ?? NaN : v;
      count++;
    }
  }
  console.log(`${url.split('/').pop()}: ${count} points in ${blocks.size} blocks`);
}

let missing = 0;
const out = new Int16Array(H.length);
const bases: number[] = [];
area.tiles.forEach((_, t) => {
  const h = H.subarray(t * N * N, (t + 1) * N * N);
  let base = Infinity;
  for (const v of h) if (!Number.isNaN(v)) base = Math.min(base, v);
  base = base === Infinity ? 0 : Math.floor(base);
  bases.push(base);
  // none so far; would be the tile's lowest
  for (let k = 0; k < h.length; k++) if (Number.isNaN(h[k])) { h[k] = base; missing++; }
  out.set(deltaEncode(h, N, base), t * N * N);
});
mkdirSync('data/ground', { recursive: true });
writeFileSync('data/ground/city.bin.gz', gzipSync(Buffer.from(out.buffer), { level: 9 }));
writeFileSync('data/ground/city.json', `{
  "attribution": "${ATTRIBUTION}",
  "note": "The ground (RH 2000) of the city's tiles (tools/lib/city-area.ts), every step metres on the game's grid: city.bin.gz holds n × n heights per tile, in this order, row by row from the north-west corner southwards, each row west to east, in centimetres, each as the difference (i16, little-endian) from the one before it in its row, or for a row's first from the first of the row above, and for the tile's first from its base below.",
  "tile": ${CITY_TILE},
  "step": ${STEP},
  "n": ${N},
  "tiles": [
${area.tiles.map(([i, j], t) => `    [${i}, ${j}, ${bases[t]}]`).join(',\n')}
  ]
}
`);
console.log(`data/ground/city.bin.gz: ${area.tiles.length} tiles`);
