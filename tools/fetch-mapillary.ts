// Measures the colour of the city's buildings' walls from Mapillary's street-level photos
// (CC BY-SA 4.0): for each of OpenStreetMap's buildings and building parts
// (data/osm/buildings.json), the colour of its walls as the photos taken near it show them.
//
//   MAPILLARY_TOKEN=MLY|… node tools/fetch-mapillary.ts             -> data/mapillary/walls.json
//   MAPILLARY_TOKEN=MLY|… node tools/fetch-mapillary.ts -- --again    measure every block again
//   MAPILLARY_TOKEN=MLY|… node tools/fetch-mapillary.ts -- 0,0 -1,0   measure these blocks again
//   MAPILLARY_TOKEN=MLY|… node tools/fetch-mapillary.ts -- --facades 0,0   and cut their walls' images
//
// The city is measured a block of BLOCK m at a time (as tools/fetch-laser.ts does), and each
// block's colours are kept in node_modules/.cache/mapillary/, so a run that stops can be started
// again. For a block:
//
// - Where the photos are: Mapillary's coverage tiles over it (kept in the cache too).
// - Which photos might see which wall: a wall of a building's outline, at least WALL m long, from
//   a photo taken in front of it, within NEAR m of its middle and no more than SLANT° off square to
//   it, with a camera facing it (a spherical photo faces every way), and nothing of another
//   building's outline in between. A building looks at up to CANDIDATES of these, the nearest and
//   most square on first, the newest before the older, at most three from a sequence.
// - Their cameras: position, rotation and lens from Mapillary's reconstruction
//   (tools/lib/mapillary.ts). A camera stands CAMERA m over the ground under it (the photos'
//   altitudes are GPS's, not the ground's).
// - On each wall, a grid of points from above the shop fronts (a storey on a low building) to just
//   under the eaves (the laser scan's, data/laser/buildings.json, or OSM's height or levels). A
//   point is seen from a camera if no other building (up to its roof's top: a lower one doesn't
//   hide what's over it), no roof on posts such as a shelter, and no rise of the ground stands
//   between. A building's photos are those that see at least SHOWN of its wall's points, the most
//   first, and those another building of the block has taken already (so fewer are fetched).
// - Mapillary's segmentation of each photo (its "detections", tools/lib/mapillary.ts): only the
//   pixels it calls building are read. This leaves out the trees, cars, people, signs and sky in
//   front of a wall, and the photos taken in tunnels. A photo it hasn't segmented isn't used.
// - Then the photos themselves, as thumbnails, and the pixels round each point. Of those on a
//   building, those nearly black (windows, shadow) or white (glare), and any of leaves or sky the
//   segmentation missed, are left out; of the rest, the commonest colour is the wall's in that
//   photo, if at least ON_BUILDING of its points are on a building and KEPT of the pixels are left.
//   A building takes up to PHOTOS of these, going down its list of photos until it has them.
// - A building's colour is the median of the photos that agree with the median of them all, if at
//   least two do.
//
// With --facades it also cuts each wall's own image out of the photos (renderFacade), and writes
// each city tile's in an atlas in public/data/facades/ (CC BY-SA 4.0, as the photos are), which
// the game lays on the walls.
//
// Where OSM gives building:colour, that is the check: the run reports how far the measured colours
// are from it. tools/build-city.ts takes the measured colour for a building OSM gives none.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import jpeg from 'jpeg-js';
import { CITY_TILE, deltaDecode, facadeName } from '../src/city-tile.ts';
import type { FacadeAtlas, FacadeIndex } from '../src/city-tile.ts';
import { lonLatToWorld, unproject, ORIGIN } from '../src/geo.ts';
import { MAPILLARY_ATTRIBUTION, buildingMask, buildingsIn, cameras, coverageUrl, limiter, project, readCoverage, rotationMatrix, tilesOver, token } from './lib/mapillary.ts';
import type { Camera, Spot } from './lib/mapillary.ts';

const OUT = 'data/mapillary/walls.json';
const FACADE_OUT = 'public/data/facades';
const ATLAS = 4096, PAD = 2, FACADE_QUALITY = 82;
const CACHE = 'node_modules/.cache/mapillary';
const BLOCK = 1000;
const NEAR = 45;      // a photo at most this far from a wall's middle
const CLOSE = 4;      // ... and at least this far in front of it
const SLANT = 55;     // degrees off square to the wall at most
const FACING = 40;    // a perspective photo's camera at most this many degrees off the wall's middle
const WALL = 4;       // walls shorter than this aren't looked at
const CANDIDATES = 16; // photos looked at for a building
const PHOTOS = 5;     // photos a building takes at most
const SHOWN = 0.5;    // the share of a wall's points a photo must show
const CAMERA = 2;     // the camera this high over the ground
const CELL = 20;      // the walls' index
const AGREE = 15;     // ΔE: a photo's colour this near the building's median agrees with it
const ON_BUILDING = 0.5; // the share of a wall's points in a photo that must fall on a building
const KEPT = 0.35;
const TEXEL = 0.1;    // a facade's pixel, in metres
const FACADE_MAX = 384; // ... and its pixels a side at most
const FACADE_CANDIDATES = 6; // photos looked at for each wall's facade
const FACADE_SLANT = 45; // degrees off square to a wall at most, for its facade
const FACADE_PHOTOS = 3; // photos a facade is taken from at most
const FACADE_SEEN = 0.5; // the share of a wall its photos must see for it to have a facade    // the share of a wall's pixels that must be left after the sky, leaves and so on
const JOBS = 16;      // requests at once

type XZ = [number, number];
const args = process.argv.slice(2);
const again = args.includes('--again');
const only = new Set(args.filter((a) => /^-?\d+,-?\d+$/.test(a)));
// cut the walls' own images out of the photos too (public/data/facades/)
const FACADES = args.includes('--facades');
token();
const get = limiter(JOBS);

// ------------------------------------------------------------------ the ground
const groundMeta: { tile: number; step: number; n: number; tiles: [number, number, number][] } =
  JSON.parse(readFileSync('data/ground/city.json', 'utf8'));
const GN = groundMeta.n, GSTEP = groundMeta.step;
const rawGround = new Int16Array(gunzipSync(readFileSync('data/ground/city.bin.gz')).buffer.slice(0));
const ground = new Map<string, Float32Array>();
groundMeta.tiles.forEach(([i, j, base], t) => ground.set(`${i},${j}`, deltaDecode(rawGround.subarray(t * GN * GN, (t + 1) * GN * GN), GN, base)));
function groundAt(x: number, z: number): number | null {
  const i = Math.floor(x / CITY_TILE), j = Math.floor(z / CITY_TILE);
  const h = ground.get(`${i},${j}`);
  if (!h) return null;
  const u = (x - i * CITY_TILE) / GSTEP, v = (z - j * CITY_TILE) / GSTEP;
  const c = Math.min(GN - 2, Math.floor(u)), r = Math.min(GN - 2, Math.floor(v)), fu = u - c, fv = v - r;
  const k = r * GN + c;
  return (1 - fv) * ((1 - fu) * h[k] + fu * h[k + 1]) + fv * ((1 - fu) * h[k + GN] + fu * h[k + GN + 1]);
}

// ------------------------------------------------------------------ the buildings
const osm: { buildings: { osm: string; tags: Record<string, string>; rings: number[][] }[] } =
  JSON.parse(readFileSync('data/osm/buildings.json', 'utf8'));
const laser: { buildings: Record<string, [number, number, string, number]> } | null =
  existsSync('data/laser/buildings.json') ? JSON.parse(readFileSync('data/laser/buildings.json', 'utf8')) : null;
const num = (v: string | undefined) => {
  const n = v === undefined ? NaN : parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const ringArea = (r: XZ[]) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) { const [ax, az] = r[i], [bx, bz] = r[(i + 1) % r.length]; a += ax * bz - bx * az; }
  return a / 2;
};

// A wall: from a to b along the outline, its outward normal, and its bottom (the lowest ground
// along it) and top (the eaves), and the building's highest point (its roof's top), which it hides
// what's behind up to. (A roof on posts, such as a shelter, is taken as walls up to its roof.)
interface Wall { b: number; ax: number; az: number; bx: number; bz: number; nx: number; nz: number; len: number; g: number; top: number; cover: number }
interface B { osm: string; c: XZ; walls: Wall[]; given: [number, number, number] | null; tile: XZ }
const buildings: B[] = [];
const allWalls: Wall[] = [];
for (const b of osm.buildings) {
  const t = b.tags;
  const roofOnly = t.building === 'roof';
  // (the outline as tools/build-city.ts takes it, so that its walls are the game's)
  const ring: XZ[] = [];
  const flat = b.rings[0];
  for (let k = 0; k + 1 < flat.length; k += 2) {
    const p: XZ = [flat[k], flat[k + 1]];
    if (!ring.length || Math.hypot(p[0] - ring[ring.length - 1][0], p[1] - ring[ring.length - 1][1]) > 0.05) ring.push(p);
  }
  if (ring.length > 1 && Math.hypot(ring[0][0] - ring[ring.length - 1][0], ring[0][1] - ring[ring.length - 1][1]) < 0.05) ring.pop();
  if (ring.length < 3) continue;
  // the city tile the building is in: the one its outline's centroid is in, as build-city has it
  let ca = 0, ccx = 0, ccz = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], f = ax * bz - bx * az;
    ca += f; ccx += (ax + bx) * f; ccz += (az + bz) * f;
  }
  const cen: XZ = Math.abs(ca) < 1e-9 ? ring[0] : [ccx / (3 * ca), ccz / (3 * ca)];
  const tile: XZ = [Math.floor(cen[0] / CITY_TILE), Math.floor(cen[1] / CITY_TILE)];
  // anticlockwise seen from above in x, z (a positive shoelace area): outward is (dz, −dx)
  if (ringArea(ring) < 0) ring.reverse();
  const xs = ring.map((p) => p[0]), zs = ring.map((p) => p[1]);
  const c: XZ = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
  const gs = ring.map(([x, z]) => groundAt(x, z)).filter((g): g is number => g !== null);
  if (!gs.length) continue;
  const g0 = Math.min(...gs);
  const min = num(t.min_height) ?? ((num(t['building:min_level']) ?? 0) * 3.1);
  const scan = laser?.buildings[b.osm];
  const eaves = scan?.[0] ?? g0 + (num(t.height) ?? ((num(t['building:levels']) ?? (t['building:part'] ? 0 : 3)) * 3.1 || 9));
  const cover = roofOnly ? g0 + (num(t.height) ?? 3) : Math.max(eaves, scan?.[1] ?? 0);
  const id = buildings.length;
  const walls: Wall[] = [];
  for (let e = 0; e < ring.length; e++) {
    const [ax, az] = ring[e], [bx, bz] = ring[(e + 1) % ring.length];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.5) continue;
    const g = Math.min(groundAt(ax, az) ?? g0, groundAt(bx, bz) ?? g0) + min;
    const w: Wall = { b: id, ax, az, bx, bz, nx: (bz - az) / len, nz: -(bx - ax) / len, len, g, top: eaves, cover };
    allWalls.push(w);
    if (!roofOnly && len >= WALL && eaves - g > 2.5) walls.push(w);
  }
  buildings.push({ osm: b.osm, c, walls, given: colourOf(t['building:colour']), tile });
}

// every wall by cell, for what stands between a camera and a wall
const wallIndex = new Map<string, Wall[]>();
for (const w of allWalls) {
  for (let i = Math.floor(Math.min(w.ax, w.bx) / CELL); i <= Math.floor(Math.max(w.ax, w.bx) / CELL); i++) {
    for (let j = Math.floor(Math.min(w.az, w.bz) / CELL); j <= Math.floor(Math.max(w.az, w.bz) / CELL); j++) {
      const k = `${i},${j}`;
      (wallIndex.get(k) ?? wallIndex.set(k, []).get(k)!).push(w);
    }
  }
}
// Whether the line from the camera at (cx, cy, cz) to (px, py, pz) on `wall` passes any other wall
// below its building's top.
function clear(cx: number, cy: number, cz: number, px: number, py: number, pz: number, wall: Wall) {
  const dx = px - cx, dz = pz - cz, l = Math.hypot(dx, dz);
  const seen = new Set<Wall>();
  for (let s = 0; s <= l + CELL; s += CELL / 2) {
    const t = Math.min(1, s / l);
    const key = `${Math.floor((cx + dx * t) / CELL)},${Math.floor((cz + dz * t) / CELL)}`;
    for (const w of wallIndex.get(key) ?? []) {
      if (w === wall || seen.has(w)) continue;
      seen.add(w);
      const ex = w.bx - w.ax, ez = w.bz - w.az;
      const den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-9) continue;
      const u = ((w.ax - cx) * ez - (w.az - cz) * ex) / den;   // along the line of sight
      const v = ((w.ax - cx) * dz - (w.az - cz) * dx) / den;   // along the other wall
      // (a wall meeting this one at its corner doesn't hide it)
      if (u > 0 && u < 1 - 0.3 / l && v >= 0 && v <= 1 && cy + (py - cy) * u < w.cover) return false;
    }
    if (t === 1) break;
  }
  return true;
}

// Whether the line from (ax, ay, az) to (bx, by, bz) stays over the ground (a retaining wall, a
// rise in the street or a bank hides what's beyond it).
function overGround(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  const l = Math.hypot(bx - ax, bz - az);
  for (let s = 2; s < l - 1.5; s += 2) {
    const t = s / l, g = groundAt(ax + (bx - ax) * t, az + (bz - az) * t);
    if (g !== null && g > ay + (by - ay) * t - 0.3) return false;
  }
  return true;
}

const blocks = new Map<string, number[]>();
buildings.forEach((b, id) => {
  if (!b.walls.length) return;
  const key = `${Math.floor(b.c[0] / BLOCK)},${Math.floor(b.c[1] / BLOCK)}`;
  (blocks.get(key) ?? blocks.set(key, []).get(key)!).push(id);
});
console.log(`${buildings.length} buildings in ${blocks.size} blocks of ${BLOCK} m`);

// ------------------------------------------------------------------ coverage
const coverage = new Map<string, Promise<Spot[]>>();
function coverageTile(t: [number, number, number]) {
  const key = t.join('_');
  let p = coverage.get(key);
  if (!p) {
    p = (async () => {
      const file = `${CACHE}/coverage/${key}.pbf`;
      let buf: Uint8Array;
      if (existsSync(file)) buf = readFileSync(file);
      else {
        const res = await get(coverageUrl(t));
        if (res.status === 404 || res.status === 204) buf = new Uint8Array(0);
        else if (!res.ok) throw new Error(`coverage tile ${key}: ${res.status} ${(await res.text()).slice(0, 200)}`);
        else buf = new Uint8Array(await res.arrayBuffer());
        writeFileSync(file, buf);
      }
      return readCoverage(buf, t);
    })();
    coverage.set(key, p);
  }
  return p;
}

// ------------------------------------------------------------------ colours
type RGB = [number, number, number];
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const medianRGB = (c: RGB[]): RGB => [median(c.map((p) => p[0])), median(c.map((p) => p[1])), median(c.map((p) => p[2]))];
// a pixel of the wall, rather than of the sky, leaves or grass, a window or shadow, or glare
function wallPixel(r: number, g: number, b: number) {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 28 || lum > 245) return false;
  if (g > r + 6 && g > b + 6) return false;                    // leaves, grass
  if (b > r + 25 && b > g + 5) return false;                   // sky
  if (b > r + 12 && b >= g && lum > 150) return false;         // pale sky
  return true;
}
// The commonest colour of a wall's pixels: from their median, the mean of those near it, a few
// times over (windows, signs, doors and what's in front pull a plain median off the wall's own).
function wallColour(px: RGB[]): RGB {
  let c = medianRGB(px);
  for (let it = 0; it < 4; it++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (const p of px) {
      if (Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) + Math.abs(p[2] - c[2]) > 60) continue;
      r += p[0]; g += p[1]; b += p[2]; n++;
    }
    if (!n) break;
    c = [r / n, g / n, b / n];
  }
  return c;
}
const hex = ([r, g, b]: RGB) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
function colourOf(v: string | undefined): RGB | null {
  if (!v) return null;
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// CIE L*a*b* of an sRGB colour, and the distance (ΔE 1976) between two
function lab([r, g, b]: RGB): RGB {
  const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const deltaE = (p: RGB, q: RGB) => { const a = lab(p), b = lab(q); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };

// ------------------------------------------------------------------ a block
// a building's colour, and the photos it was measured from
type Measure = [string, number];
interface Done { key: string; measured: number; of: number; photos: number; seen: number; facades: number }
const cacheOf = (key: string) => `${CACHE}/${key.replace(',', '_')}.json`;
const toLonLat = (x: number, z: number) => unproject(ORIGIN.e + x, ORIGIN.n - z);

// The points of a grid on a wall, from a storey over the ground (over the cars and people) to just
// under the eaves, that a camera sees, where they fall in its photo (w × h pixels), and how many
// points the grid has.
function wallPoints(v: View, w: Wall, iw: number, ih: number) {
  const inside: [number, number][] = [];
  let tried = 0;
  const lo = w.top - w.g > 7 ? w.g + Math.max(4, 0.3 * (w.top - w.g)) : w.g + 1.2, hi = w.top - 1;
  if (hi <= lo) return { inside, tried };
  for (let a = 0; a < 7; a++) {
    const f = 0.12 + (0.76 * a) / 6;
    const x = w.ax + (w.bx - w.ax) * f + w.nx * 0.05, z = w.az + (w.bz - w.az) * f + w.nz * 0.05;
    tried += 6;
    // (the camera in front of the wall from where it was reconstructed, and nothing in between)
    if ((v.x - x) * w.nx + (v.z - z) * w.nz < 1) continue;
    for (let k = 0; k < 6; k++) {
      const y = lo + ((hi - lo) * (k + 0.5)) / 6;
      if (!clear(v.x, v.y, v.z, x, y, z, w) || !overGround(v.x, v.y, v.z, x, y, z)) continue;
      const p = project(v.cam, v.R, x - v.x, v.z - z, y - v.y, iw, ih);
      if (p) inside.push(p);
    }
  }
  return { inside, tried };
}

// A photo: its thumbnail's pixels, and which of them show a building.
interface Photo { width: number; height: number; data: Uint8Array; mask: Uint8Array }
type View = { cam: Camera; R: number[]; x: number; y: number; z: number };
async function loadPhoto(v: View): Promise<Photo | null> {
  // what of it is building, as Mapillary has segmented it (a photo it hasn't isn't fetched)
  const polys = await buildingsIn(get, v.cam.id);
  if (!polys?.length) return null;
  const res = await get(FACADES ? v.cam.large : v.cam.thumb);
  if (!res.ok) { await res.body?.cancel(); return null; }
  let img: { width: number; height: number; data: Uint8Array };
  try { img = jpeg.decode(new Uint8Array(await res.arrayBuffer()), { useTArray: true, formatAsRGBA: false, maxMemoryUsageInMB: 256 }); } catch { return null; }
  // (a thumbnail turned from the photo can't be measured in)
  if ((img.width > img.height) !== (v.cam.width > v.cam.height)) return null;
  return { ...img, mask: buildingMask(polys, img.width, img.height) };
}

// A wall's colour in a photo: the commonest of the wall's pixels round the points of its grid, of
// those on a building; or null if too few of its points are on a building in the photo (trees, a
// bus, a tunnel's walls are in front), or too few of the pixels are left.
function colourIn(img: Photo, v: View, w: Wall): RGB | null {
  const pr = Math.max(1, Math.round(img.width / 256));
  const { inside } = wallPoints(v, w, img.width, img.height);
  const px: RGB[] = [];
  let onBuilding = 0;
  for (const p of inside) {
    if (img.mask[Math.floor(p[1]) * img.width + Math.floor(p[0])]) onBuilding++;
    for (let oy = -pr; oy <= pr; oy++) for (let ox = -pr; ox <= pr; ox++) {
      const qx = Math.round(p[0]) + ox, qy = Math.round(p[1]) + oy;
      if (qx < 0 || qy < 0 || qx >= img.width || qy >= img.height || !img.mask[qy * img.width + qx]) continue;
      const o = (qy * img.width + qx) * 3;
      const r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
      if (wallPixel(r, g, b)) px.push([r, g, b]);
    }
  }
  if (onBuilding < ON_BUILDING * inside.length || px.length < Math.max(20, KEPT * inside.length * (2 * pr + 1) ** 2)) return null;
  return wallColour(px);
}

// ------------------------------------------------------------------ facades
// A wall's facade: its own image cut out of the photos, straightened, TEXEL m a pixel (at most
// FACADE_MAX pixels a side), from the eaves (row 0) down to the ground. Each pixel is taken from
// the best photo that sees that point of the wall on a building (the photos in order, each
// matched in brightness and colour to the first where they overlap); what none of them sees is
// filled with the commonest colour of the rest. A wall whose photos see less than FACADE_SEEN of
// it gets none.
interface Facade { w: number; h: number; data: Uint8Array; y0: number; y1: number }
function renderFacade(w: Wall, views: { v: View; img: Photo }[]): Facade | null {
  const y0 = w.g, y1 = w.top;
  const fw = Math.max(4, Math.min(FACADE_MAX, Math.round(w.len / TEXEL)));
  const fh = Math.max(4, Math.min(FACADE_MAX, Math.round((y1 - y0) / TEXEL)));
  const out = new Float32Array(fw * fh * 3);
  const filled = new Uint8Array(fw * fh);
  let first = true;
  for (const { v, img } of views) {
    // which points of the wall the camera sees, on a coarse grid
    const G = 8, gw = Math.ceil(fw / G) + 1, gh = Math.ceil(fh / G) + 1;
    const vis = new Uint8Array(gw * gh);
    for (let a = 0; a < gw; a++) {
      const f = Math.min(1, (a * G + 0.5) / fw);
      const x = w.ax + (w.bx - w.ax) * f + w.nx * 0.05, z = w.az + (w.bz - w.az) * f + w.nz * 0.05;
      if ((v.x - x) * w.nx + (v.z - z) * w.nz < 1) continue;
      for (let b = 0; b < gh; b++) {
        const y = y1 - (y1 - y0) * Math.min(1, (b * G + 0.5) / fh);
        vis[b * gw + a] = clear(v.x, v.y, v.z, x, y, z, w) && overGround(v.x, v.y, v.z, x, y, z) ? 1 : 0;
      }
    }
    const got = new Float32Array(fw * fh * 3), has = new Uint8Array(fw * fh);
    for (let r = 0; r < fh; r++) {
      const y = y1 - ((y1 - y0) * (r + 0.5)) / fh;
      for (let c = 0; c < fw; c++) {
        if (!vis[Math.floor(r / G) * gw + Math.floor(c / G)] || !vis[Math.min(gh - 1, Math.ceil(r / G)) * gw + Math.min(gw - 1, Math.ceil(c / G))]) continue;
        const f = (c + 0.5) / fw;
        const x = w.ax + (w.bx - w.ax) * f, z = w.az + (w.bz - w.az) * f;
        const p = project(v.cam, v.R, x - v.x, v.z - z, y - v.y, img.width, img.height);
        if (!p) continue;
        const px = Math.min(img.width - 2, Math.max(0, p[0] - 0.5)), py = Math.min(img.height - 2, Math.max(0, p[1] - 0.5));
        const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
        if (!img.mask[iy * img.width + ix] || !img.mask[(iy + 1) * img.width + ix + 1]) continue;
        for (let ch = 0; ch < 3; ch++) {
          const at = (q: number, s: number) => img.data[(q * img.width + s) * 3 + ch];
          got[(r * fw + c) * 3 + ch] = (1 - fy) * ((1 - fx) * at(iy, ix) + fx * at(iy, ix + 1)) + fy * ((1 - fx) * at(iy + 1, ix) + fx * at(iy + 1, ix + 1));
        }
        has[r * fw + c] = 1;
      }
    }
    // matched to what's there already, where they overlap
    const gain = [1, 1, 1];
    if (!first) {
      for (let ch = 0; ch < 3; ch++) {
        const ratios: number[] = [];
        for (let q = 0; q < fw * fh; q++) if (has[q] && filled[q] && got[q * 3 + ch] > 8) ratios.push(out[q * 3 + ch] / got[q * 3 + ch]);
        if (ratios.length > 50) gain[ch] = Math.min(2, Math.max(0.5, median(ratios)));
      }
    }
    for (let q = 0; q < fw * fh; q++) {
      if (!has[q] || filled[q]) continue;
      for (let ch = 0; ch < 3; ch++) out[q * 3 + ch] = Math.min(255, got[q * 3 + ch] * gain[ch]);
      filled[q] = 1;
    }
    if (filled.some((x) => x)) first = false;
  }
  let n = 0;
  const px: RGB[] = [];
  for (let q = 0; q < fw * fh; q++) if (filled[q]) { n++; if (q % 7 === 0) px.push([out[q * 3], out[q * 3 + 1], out[q * 3 + 2]]); }
  if (n < FACADE_SEEN * fw * fh) return null;
  const fill = wallColour(px.length ? px : [[128, 128, 128]]);
  const data = new Uint8Array(fw * fh * 3);
  for (let q = 0; q < fw * fh; q++) for (let ch = 0; ch < 3; ch++) data[q * 3 + ch] = Math.round(filled[q] ? out[q * 3 + ch] : fill[ch]);
  return { w: fw, h: fh, data, y0, y1 };
}

// A facade as kept in the cache: its tile, its wall's ends (decimetres, world x, z, as the city's
// tiles have them), its heights, and its image as a JPEG.
interface FacadeEntry { tile: XZ; edge: [number, number, number, number]; y0: number; y1: number; jpeg: string }
const facadeCacheOf = (key: string) => `${CACHE}/facades/${key.replace(',', '_')}.json`;
const dm = (v: number) => Math.round(v * 10);

async function measure(key: string): Promise<Done> {
  const ids = blocks.get(key)!;
  const [bi, bj] = key.split(',').map(Number);
  const x0 = bi * BLOCK - NEAR - 100, z0 = bj * BLOCK - NEAR - 100, x1 = x0 + BLOCK + 2 * (NEAR + 100), z1 = z0 + BLOCK + 2 * (NEAR + 100);
  const sw = toLonLat(x0, z1), ne = toLonLat(x1, z0);
  // the photos near the block, by cell
  const spots: (Spot & { x: number; z: number })[] = [];
  for (const t of tilesOver(sw.lon, sw.lat, ne.lon, ne.lat)) {
    for (const s of await coverageTile(t)) {
      const { x, z } = lonLatToWorld(s.lon, s.lat);
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) spots.push({ ...s, x, z });
    }
  }
  const spotIndex = new Map<string, number[]>();
  spots.forEach((s, k) => {
    const c = `${Math.floor(s.x / CELL)},${Math.floor(s.z / CELL)}`;
    (spotIndex.get(c) ?? spotIndex.set(c, []).get(c)!).push(k);
  });

  // the photos that might see each building's walls, and their cameras
  const now = Date.now();
  const cands = new Map<number, { k: number; w: Wall; score: number }[]>();
  for (const id of ids) {
    const list: { k: number; w: Wall; score: number }[] = [];
    for (const w of buildings[id].walls) {
      const mx = (w.ax + w.bx) / 2, mz = (w.az + w.bz) / 2;
      const r = Math.ceil(NEAR / CELL);
      for (let i = Math.floor(mx / CELL) - r; i <= Math.floor(mx / CELL) + r; i++) {
        for (let j = Math.floor(mz / CELL) - r; j <= Math.floor(mz / CELL) + r; j++) {
          for (const k of spotIndex.get(`${i},${j}`) ?? []) {
            const s = spots[k];
            const dx = s.x - mx, dz = s.z - mz, d = Math.hypot(dx, dz);
            const front = dx * w.nx + dz * w.nz;
            if (d > NEAR || front < CLOSE || front / d < Math.cos((SLANT * Math.PI) / 180)) continue;
            if (!s.pano) {
              // the bearing from the camera to the wall's middle (x east, z south)
              const bearing = (Math.atan2(-dx, dz) * 180) / Math.PI;
              const off = Math.abs(((bearing - s.compass + 540) % 360) - 180);
              if (off > FACING) continue;
            }
            if (!clear(s.x, (groundAt(s.x, s.z) ?? w.g) + CAMERA, s.z, mx, (w.g + w.top) / 2, mz, w)) continue;
            const years = (now - s.captured) / 3.15e10;
            list.push({ k, w, score: d / (front / d) + 1.5 * years + (s.pano ? 5 : 0) });
          }
        }
      }
    }
    list.sort((a, b) => a.score - b.score);
    // the best few of each sequence; for facades, the best few for each wall
    const perSeq = new Map<string, number>(), perWall = new Map<Wall, number>();
    const kept = list.filter((c) => {
      const seq = `${spots[c.k].sequence} ${FACADES ? c.w.ax : ''}`, n = perSeq.get(seq) ?? 0;
      perSeq.set(seq, n + 1);
      return n < 3;
    }).filter((c) => {
      const n = perWall.get(c.w) ?? 0;
      perWall.set(c.w, n + 1);
      return FACADES ? n < FACADE_CANDIDATES : true;
    }).slice(0, FACADES ? Infinity : CANDIDATES);
    if (kept.length >= (FACADES ? 1 : 2)) cands.set(id, kept);
  }
  const want = [...new Set([...cands.values()].flat().map((c) => c.k))];
  const cams = new Map<number, View>();
  const byId = new Map(want.map((k) => [spots[k].id, k]));
  await Promise.all(Array.from({ length: Math.ceil(want.length / 50) }, async (_, n) => {
    for (const cam of await cameras(get, want.slice(n * 50, n * 50 + 50).map((k) => spots[k].id))) {
      const { x, z } = lonLatToWorld(cam.lon, cam.lat);
      cams.set(byId.get(cam.id)!, { cam, R: rotationMatrix(cam.rotation), x, z, y: (groundAt(x, z) ?? 0) + CAMERA });
    }
  }));

  // The photos each building might take: those its wall is most in (and nothing in front of it),
  // the nearest and newest first, and those another building has taken.
  const queue = new Map<number, { k: number; w: Wall; score: number }[]>();
  const everyPhoto = new Map<number, { k: number; w: Wall; score: number }[]>();
  for (const [id, list] of cands) {
    const scored: { k: number; w: Wall; score: number }[] = [];
    for (const c of list) {
      const v = cams.get(c.k);
      if (!v) continue;
      const { inside, tried } = wallPoints(v, c.w, v.cam.width, v.cam.height);
      if (tried < 12 || inside.length < SHOWN * tried) continue;
      scored.push({ ...c, score: c.score - 10 * (inside.length / tried) });
    }
    if (scored.length >= 2) queue.set(id, scored);
    if (scored.length) everyPhoto.set(id, [...scored]);
  }

  // Each building's colour in each of its photos. A photo may not be segmented, or may not show
  // the wall after all: each building takes more from its list until it has PHOTOS or none are left.
  const seen = new Map<number, RGB[]>();
  const tried = new Map<number, Promise<Photo | null>>();
  let photos = 0;
  const photo = (k: number) => {
    let p = tried.get(k);
    if (!p) { p = loadPhoto(cams.get(k)!).then((ph) => { if (ph) photos++; return ph; }); tried.set(k, p); }
    return p;
  };
  for (let round = 0; queue.size; round++) {
    const taken = new Set<number>();
    const pairs = new Map<number, [number, Wall][]>();
    for (const [id, list] of queue) {
      const need = PHOTOS - (seen.get(id)?.length ?? 0);
      // (those already fetched, or taken by another building this round, first)
      list.sort((a, b) => (a.score - (tried.has(a.k) || taken.has(a.k) ? 15 : 0)) - (b.score - (tried.has(b.k) || taken.has(b.k) ? 15 : 0)));
      for (const c of list.splice(0, need)) {
        taken.add(c.k);
        (pairs.get(c.k) ?? pairs.set(c.k, []).get(c.k)!).push([id, c.w]);
      }
    }
    await Promise.all([...pairs].map(async ([k, list]) => {
      const ph = await photo(k);
      if (!ph) return;
      for (const [id, w] of list) {
        const c = colourIn(ph, cams.get(k)!, w);
        if (c) (seen.get(id) ?? seen.set(id, []).get(id)!).push(c);
      }
    }));
    for (const [id, list] of queue) if (!list.length || (seen.get(id)?.length ?? 0) >= PHOTOS) queue.delete(id);
  }

  const out: Record<string, Measure> = {};
  for (const [id, cs] of seen) {
    // the photos that agree with their median (one of a passing van, or the wrong wall, doesn't)
    const m = medianRGB(cs);
    const agree = cs.filter((c) => deltaE(c, m) < AGREE);
    if (agree.length < 2) continue;
    out[buildings[id].osm] = [hex(medianRGB(agree)), agree.length];
  }
  writeFileSync(cacheOf(key), JSON.stringify(out));

  // the walls' facades, each from the best few of the photos that see it
  let facades = 0;
  if (FACADES) {
    const entries: FacadeEntry[] = [];
    const byWall = new Map<Wall, { k: number; score: number }[]>();
    for (const list of everyPhoto.values()) for (const c of list) (byWall.get(c.w) ?? byWall.set(c.w, []).get(c.w)!).push(c);
    const done = new Set<string>();
    await Promise.all([...byWall].map(async ([w, list]) => {
      // (from where the camera was reconstructed: the most square on and nearest first, none at a
      // slant, which would smear the wall and take in what's beyond its corner)
      const mx = (w.ax + w.bx) / 2, mz = (w.az + w.bz) / 2;
      const square = list.map((c) => {
        const v = cams.get(c.k)!, d = Math.hypot(v.x - mx, v.z - mz), front = ((v.x - mx) * w.nx + (v.z - mz) * w.nz) / d;
        return { ...c, front, score: d / Math.max(0.1, front) };
      }).filter((c) => c.front > Math.cos((FACADE_SLANT * Math.PI) / 180));
      square.sort((a, b) => a.score - b.score);
      const views: { v: View; img: Photo }[] = [];
      for (const c of square.slice(0, FACADE_PHOTOS * 2)) {
        const img = await photo(c.k);
        if (img) views.push({ v: cams.get(c.k)!, img });
        if (views.length >= FACADE_PHOTOS) break;
      }
      if (!views.length) return;
      // (a wall shared by two buildings, or a building and its part, once)
      const key = [dm(w.ax), dm(w.az), dm(w.bx), dm(w.bz)].join(',');
      if (done.has(key)) return;
      done.add(key);
      const f = renderFacade(w, views);
      if (!f) return;
      const rgba = new Uint8Array(f.w * f.h * 4);
      for (let q = 0; q < f.w * f.h; q++) { rgba[q * 4] = f.data[q * 3]; rgba[q * 4 + 1] = f.data[q * 3 + 1]; rgba[q * 4 + 2] = f.data[q * 3 + 2]; rgba[q * 4 + 3] = 255; }
      entries.push({
        tile: buildings[w.b].tile, edge: [dm(w.ax), dm(w.az), dm(w.bx), dm(w.bz)], y0: Math.round(f.y0 * 100) / 100, y1: Math.round(f.y1 * 100) / 100,
        jpeg: Buffer.from(jpeg.encode({ data: rgba, width: f.w, height: f.h }, 90).data).toString('base64'),
      });
    }));
    facades = entries.length;
    writeFileSync(facadeCacheOf(key), JSON.stringify(entries));
  }
  return { key, measured: Object.keys(out).length, of: ids.length, photos, seen: spots.length, facades };
}

// ------------------------------------------------------------------ the blocks
mkdirSync(`${CACHE}/coverage`, { recursive: true });
mkdirSync(`${CACHE}/facades`, { recursive: true });
const todo = [...blocks.keys()].sort().filter((key) => only.size ? only.has(key) : again || !existsSync(FACADES ? facadeCacheOf(key) : cacheOf(key)));
console.log(`${todo.length} of ${blocks.size} blocks to measure`);
const t0 = Date.now();
let done = 0, photos = 0;
const failed: string[] = [];
// (three blocks at once: one's photos are fetched while another's walls are looked at; one
// cutting facades, whose photos, larger, are all kept until its walls are done)
await Promise.all((FACADES ? [0] : [0, 1, 2]).map(async () => {
  for (let key = todo.shift(); key; key = todo.shift()) {
    try {
      const d = await measure(key);
      done++; photos += d.photos;
      console.log(`block ${d.key}: ${d.measured} of ${d.of} buildings measured${FACADES ? `, ${d.facades} facades` : ''} from ${d.photos} photos (of ${d.seen} near it; ${done} done, ${todo.length} to go, ${photos} photos, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    } catch (err) {
      failed.push(key);
      console.warn(`block ${key} failed: ${(err as Error).message}`);
    }
  }
}));
if (failed.length) console.warn(`${failed.length} blocks failed (${failed.join(' ')}): run it again to measure them`);

// ------------------------------------------------------------------ the colours
const results = new Map<string, Measure>();
for (const key of blocks.keys()) {
  if (!existsSync(cacheOf(key))) continue;
  for (const [id, m] of Object.entries(JSON.parse(readFileSync(cacheOf(key), 'utf8')) as Record<string, Measure>)) results.set(id, m);
}
// the check: against building:colour where OSM gives it
const given = new Map(buildings.filter((b) => b.given).map((b) => [b.osm, b.given!]));
const errs: number[] = [];
for (const [id, [c]] of results) { const g = given.get(id); if (g) errs.push(deltaE(colourOf(c)!, g)); }
mkdirSync('data/mapillary', { recursive: true });
const keys = [...results.keys()].sort();
writeFileSync(OUT, `{
  "attribution": "${MAPILLARY_ATTRIBUTION} (processed: wall colours measured from them)",
  "source": "https://www.mapillary.com",
  "note": "OpenStreetMap's buildings (data/osm/buildings.json) with the colour of their walls as Mapillary's street-level photos show them (tools/fetch-mapillary.ts): sRGB, and the photos it was measured from.",
  "buildings": {
${keys.map((id) => `    ${JSON.stringify(id)}: ${JSON.stringify(results.get(id))}`).join(',\n')}
  }
}
`);
console.log(`${OUT}: ${results.size} of ${buildings.length} buildings`);
if (errs.length) {
  errs.sort((a, b) => a - b);
  console.log(`  against OSM's building:colour (${errs.length} buildings): ΔE median ${median(errs).toFixed(1)}, within 10: ${Math.round((100 * errs.filter((e) => e < 10).length) / errs.length)}%, within 20: ${Math.round((100 * errs.filter((e) => e < 20).length) / errs.length)}%`);
}

// ------------------------------------------------------------------ the facades
// Each city tile's facades in one image, an atlas (public/data/facades/<i>_<j>.jpg), and where
// each wall's is in it (<i>_<j>.json; format in src/city-tile.ts).
if (FACADES) {
  const byTile = new Map<string, FacadeEntry[]>();
  const seenEdges = new Set<string>();
  for (const key of blocks.keys()) {
    if (!existsSync(facadeCacheOf(key))) continue;
    for (const e of JSON.parse(readFileSync(facadeCacheOf(key), 'utf8')) as FacadeEntry[]) {
      // (a wall two blocks' buildings share, once)
      if (seenEdges.has(e.edge.join(','))) continue;
      seenEdges.add(e.edge.join(','));
      const k = `${e.tile[0]},${e.tile[1]}`;
      (byTile.get(k) ?? byTile.set(k, []).get(k)!).push(e);
    }
  }
  mkdirSync(FACADE_OUT, { recursive: true });
  const written = new Set<string>(['index.json']);
  let walls = 0, bytes = 0;
  for (const [k, list] of byTile) {
    const [i, j] = k.split(',').map(Number);
    const imgs = list.map((e) => jpeg.decode(Buffer.from(e.jpeg, 'base64'), { useTArray: true, formatAsRGBA: true }));
    // shelves, the tallest first, halved until they fit
    let scale = 1, placed: { x: number; y: number; w: number; h: number }[] = [], height = 0;
    const order = imgs.map((_, n) => n).sort((a, b) => imgs[b].height - imgs[a].height);
    for (;;) {
      placed = []; height = 0;
      let x = 0, y = 0, shelf = 0;
      for (const n of order) {
        const w = Math.max(2, Math.round(imgs[n].width * scale)), h = Math.max(2, Math.round(imgs[n].height * scale));
        if (x + w + 2 * PAD > ATLAS) { x = 0; y += shelf; shelf = 0; }
        placed[n] = { x: x + PAD, y: y + PAD, w, h };
        x += w + 2 * PAD; shelf = Math.max(shelf, h + 2 * PAD);
      }
      height = y + shelf;
      if (height <= ATLAS) break;
      scale /= 2;
    }
    height = Math.ceil(height / 4) * 4;
    const atlas = new Uint8Array(ATLAS * height * 4).fill(255);
    imgs.forEach((img, n) => {
      const p = placed[n];
      // (each pixel of the atlas from the nearest of the facade's, and its edges carried PAD
      // further out, so that the texture's smaller levels don't take in the neighbours)
      for (let r = -PAD; r < p.h + PAD; r++) {
        const sr = Math.min(img.height - 1, Math.max(0, Math.floor(((r + 0.5) / p.h) * img.height)));
        for (let c = -PAD; c < p.w + PAD; c++) {
          const sc = Math.min(img.width - 1, Math.max(0, Math.floor(((c + 0.5) / p.w) * img.width)));
          const o = ((p.y + r) * ATLAS + p.x + c) * 4, s = (sr * img.width + sc) * 4;
          atlas[o] = img.data[s]; atlas[o + 1] = img.data[s + 1]; atlas[o + 2] = img.data[s + 2]; atlas[o + 3] = 255;
        }
      }
    });
    const jpg = jpeg.encode({ data: atlas, width: ATLAS, height }, FACADE_QUALITY).data;
    const x0 = i * CITY_TILE * 10, z0 = j * CITY_TILE * 10;
    const index: FacadeAtlas = {
      size: [ATLAS, height],
      walls: list.map((e, n) => [e.edge[0] - x0, e.edge[1] - z0, e.edge[2] - x0, e.edge[3] - z0, placed[n].x, placed[n].y, placed[n].w, placed[n].h, e.y0, e.y1]),
    };
    writeFileSync(`${FACADE_OUT}/${facadeName(i, j)}`, jpg);
    writeFileSync(`${FACADE_OUT}/${facadeName(i, j).replace('.jpg', '.json')}`, JSON.stringify(index));
    written.add(facadeName(i, j)); written.add(facadeName(i, j).replace('.jpg', '.json'));
    walls += list.length; bytes += jpg.length;
  }
  for (const f of readdirSync(FACADE_OUT)) if (!written.has(f)) rmSync(`${FACADE_OUT}/${f}`);
  const index: FacadeIndex = {
    attribution: [`${MAPILLARY_ATTRIBUTION} (processed: walls cut out of them; these images are CC BY-SA 4.0 too)`],
    note: 'The walls of the city\'s buildings as Mapillary\'s street-level photos show them (tools/fetch-mapillary.ts --facades), an atlas of them for each city tile, and where each wall\'s is in it.',
    tiles: [...byTile.keys()].map((k) => k.split(',').map(Number) as [number, number]).sort((a, b) => a[1] - b[1] || a[0] - b[0]),
  };
  writeFileSync(`${FACADE_OUT}/index.json`, JSON.stringify(index, null, 1) + '\n');
  console.log(`${FACADE_OUT}: ${walls} walls in ${byTile.size} tiles, ${(bytes / 1e6).toFixed(1)} MB`);
}
