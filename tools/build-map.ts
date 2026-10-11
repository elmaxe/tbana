// Draws the whole city's land and water for the game's map (src/minimap.ts), which draws the city
// round the player from its tiles and this beyond them, to see the network on when zoomed out.
//
//   node tools/build-map.ts          (npm run build-city runs it after the tiles)
//
// Reads public/data/city/ (tools/build-city.ts); writes public/data/map.png, a greyscale picture
// STEP metres a pixel, north up, from the north-west corner of the city's tiles: 0 where there is
// no tile, 1 for land and 2 for water (the game colours them); and public/data/map.json, where it
// lies in world coordinates.
import { readFileSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync, gunzipSync } from 'node:zlib';
import { CITY_TILE, decodeTile, tileName } from '../src/city-tile.ts';
import type { CityIndex } from '../src/city-tile.ts';

const DIR = 'public/data/city';
const STEP = 10;
const index = JSON.parse(readFileSync(`${DIR}/index.json`, 'utf8')) as CityIndex;
const is = index.tiles.map(([i]) => i), js = index.tiles.map(([, j]) => j);
const i0 = Math.min(...is), j0 = Math.min(...js);
const per = CITY_TILE / STEP;
const width = (Math.max(...is) - i0 + 1) * per, height = (Math.max(...js) - j0 + 1) * per;
const px = new Uint8Array(width * height);

let water = 0;
for (const [i, j] of index.tiles) {
  const buf = gunzipSync(readFileSync(`${DIR}/${tileName(i, j)}`));
  const tile = decodeTile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const ox = (i - i0) * per, oy = (j - j0) * per;
  const g = tile.ground, w = tile.water;
  const m = g ? g.n - 1 : 0;
  for (let r = 0; r < per; r++) {
    for (let c = 0; c < per; c++) {
      // water where most of the ground's cells in the pixel have it
      let wet = 0, all = 0;
      if (g && w) {
        const k = STEP / g.step;
        for (let a = Math.floor(r * k); a < Math.min(m, Math.ceil((r + 1) * k)); a++) {
          for (let b = Math.floor(c * k); b < Math.min(m, Math.ceil((c + 1) * k)); b++) { all++; if (w.cells[a * m + b]) wet++; }
        }
      }
      const v = all && wet * 2 >= all ? 2 : 1;
      if (v === 2) water++;
      px[(oy + r) * width + ox + c] = v;
    }
  }
}

writeFileSync('public/data/map.png', png(width, height, px));
writeFileSync('public/data/map.json', JSON.stringify({
  note: `The city's land and water for the map, from public/data/city/ (tools/build-map.ts): ${STEP} m a pixel, north up; 0 none, 1 land, 2 water.`,
  image: 'map.png', x0: i0 * CITY_TILE, z0: j0 * CITY_TILE, step: STEP, width, height,
}, null, 1) + '\n');
console.log(`public/data/map.png: ${width} × ${height}, ${(water * STEP * STEP / 1e6).toFixed(1)} km² of water`);

// An 8-bit greyscale PNG.
function png(w: number, h: number, data: Uint8Array) {
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) raw.set(data.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 0, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
