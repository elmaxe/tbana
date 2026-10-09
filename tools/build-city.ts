// Builds the city around the line: the ground and the buildings, in square tiles.
//
//   node tools/build-city.ts
//
// Reads data/ground/city.json and city.bin.gz (tools/fetch-terrain.ts), data/osm/buildings.json
// (tools/fetch-city.ts), public/data/track-geometry.json and public/data/station-layouts.json;
// writes public/data/city/ (see src/city-tile.ts).
//
// The ground is the elevation model, shaped where the track runs:
// - Under open track it is lowered below the formation (the bank, the cutting's floor, the bridge
//   deck's underside), and rises from a metre beyond the structure at the bank's slope until it
//   meets the ground: the track runs in a shallow cutting wherever the ground is higher than it.
//   The track's own bank, walls and deck stand on it. Those cells aren't walked on.
// - Over a tunnel it is kept at least COVER above the crown, sloping away at 1:1.5, so the ground
//   never shows inside a shallow tunnel. Where the elevation model has the tunnel nearer the
//   surface than that (near the mouths, and the troughs under water), the tunnel makes a mound.
//   Where it has the ground below half the tunnel's height, the "tunnel" is a short covered way,
//   or runs under a bridge the model leaves out: there the ground is lowered as for open track,
//   and the tunnel stands in the open.
// - At each tunnel mouth, the tunnel's own space (wall to wall, floor to crown) is cut out of the
//   ground for a few metres either side, where the lowered ground of the open track meets the
//   raised ground over the tunnel; the portal stands in it. So it is where a tunnel comes out from
//   under the ground to stand in the open.
// A point between two pieces of track takes the lower of what the open track asks and the higher
// of what the tunnels ask, with the open track winning, except over a tunnel's own half: there
// the ground stays over its roof, so that open track beside a tunnel doesn't open it.
//
// The water is where the elevation model has it flattened: the lakes and the sea, each at its level.
// Where it hides water under bridges and decks, OpenStreetMap's outlines (data/osm/water.json, from
// tools/fetch-water.ts) fill it in, and the ground there is brought down to the water's level.
// None stands over a tunnel whose inside reaches up through its level, where it would be in it.
//
// The buildings are OpenStreetMap's, as blocks with their roofs:
// - The walls stand from below the lowest ground under the outline to the building's height above
//   it: OSM's height, or where the laser scan measured it (data/laser/buildings.json, from
//   tools/fetch-laser.ts) its eaves and roof, or its levels, or (for the rest) an estimate: the
//   median levels of the tagged buildings of the same sort within 150 m, or a default for its
//   sort and size.
// - A building with building:part inside is drawn as its parts.
// - Its roof is of its shape (roof:shape, roof:height or roof:levels, roof:orientation,
//   roof:direction, or where OSM gives no shape the one the laser scan found; tools/lib/roofs.ts)
//   where one can be built over its outline, else flat; its
//   colour is roof:colour, or by roof:material. Its walls' style is by building:material, or for
//   houses wood and for sheds and warehouses plain.
// - Where a building stands over open track, the part over the track's space is lifted to clear
//   the trains (or left out if there is nothing above), and roofs on posts over the platforms are
//   left out: the stations draw their own. So it is where one would reach down into a tunnel: the
//   part over it stands on its roof.
// - Where a station's exit, passage or hall reaches the surface inside a building, it is cut out
//   of the building, and an exit's way out continues through the building to the outside.
// - A building the depot's covered track runs through for at least SHED_TRACK is a hall (a shed):
//   it stands on the ground, open inside, with a door wherever a track passes through its walls.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon } from 'polygon-clipping';
import { CELL_TRACK, CITY_TILE, CITY_VERSION, deltaDecode, encodeTile, tileName } from '../src/city-tile.ts';
import type { Building, CityIndex, Door, RoofShape, WallStyle } from '../src/city-tile.ts';
import { ROOF_SHAPES } from '../src/city-tile.ts';
import { STRUCTURE_KINDS } from '../src/track-geometry.ts';
import type { StructureKind, TrackGeometry } from '../src/track-geometry.ts';
import { LIFT, floorHeights, inclineCorners, liftCorners } from '../src/station-layout.ts';
import type { StationLayouts } from '../src/station-layout.ts';
import { runningWays } from '../src/track-graph.ts';
import type { TrackGraph } from '../src/track-graph.ts';
import * as S from '../src/sections.ts';
import { buildRoof } from './lib/roofs.ts';

const OUT = 'public/data/city';
// over tunnels: the ground at least this far above the crown
const COVER = 0.5;
// ... and at least this far over its roof, even beside open track
const ROOF_COVER = 0.15;
// below open track: the ground this far under the formation
const UNDER = 0.4;
// the trains' space above the rails, which buildings over the track keep clear of
const CLEARANCE = 5;
// the hole at a mouth: this far into the tunnel and out along the open track
const MOUTH = { into: 6, out: 8 };
const LEVEL = 3.1;   // storey height, for buildings given in levels
const PARAPET = 0.6; // above the top storey
const SINK = 0.5;    // walls go this far below the lowest ground under them
// a depot's hall: covered track through it for at least this long; its doors this wide (square
// to the track) and this high above the rails
const SHED_TRACK = 20, DOOR = { width: 4.6, height: 5.2 };
// water: ground level to within `flat` metres over at least `area` m²; where OpenStreetMap only has
// shores: the water reaches on from what the model has, from `clear` cells off any shore, at most
// `reach` metres
const WATER = { flat: 0.011, area: 2500, clear: 2, reach: 150 };

type XZ = [number, number];
const geometry: TrackGeometry = JSON.parse(readFileSync('public/data/track-geometry.json', 'utf8'));
const graph: TrackGraph = JSON.parse(readFileSync('public/data/track-graph.json', 'utf8'));
const layouts: StationLayouts = JSON.parse(readFileSync('public/data/station-layouts.json', 'utf8'));
const groundMeta: { attribution: string; tile: number; step: number; n: number; tiles: [number, number, number][] } =
  JSON.parse(readFileSync('data/ground/city.json', 'utf8'));
const osm: { attribution: string; extract: string; buildings: { osm: string; tags: Record<string, string>; rings: number[][] }[] } =
  JSON.parse(readFileSync('data/osm/buildings.json', 'utf8'));
// the buildings as the laser scan measured them, where it has (tools/fetch-laser.ts): eaves, roof's
// top (RH 2000), roof shape ("skillion:<bearing>", "gabled:across"), points
const laser: { attribution: string; buildings: Record<string, [number, number, string, number]> } | null =
  existsSync('data/laser/buildings.json') ? JSON.parse(readFileSync('data/laser/buildings.json', 'utf8')) : null;
// OpenStreetMap's lakes, canals and bays (tools/fetch-water.ts), where they're to be had
const water: { attribution: string; water: { osm: string; rings: number[][] }[]; shores: { osm: string; line: number[] }[] } | null =
  existsSync('data/osm/water.json') ? JSON.parse(readFileSync('data/osm/water.json', 'utf8')) : null;
if (groundMeta.tile !== CITY_TILE) throw new Error(`data/ground/city.json has ${groundMeta.tile} m tiles, the game ${CITY_TILE} m`);
const N = groundMeta.n, STEP = groundMeta.step;

// ------------------------------------------------------------------ the ground as fetched
const raw = new Int16Array(gunzipSync(readFileSync('data/ground/city.bin.gz')).buffer.slice(0));
const ground = new Map<string, Float32Array>();
groundMeta.tiles.forEach(([i, j, base], t) => ground.set(`${i},${j}`, deltaDecode(raw.subarray(t * N * N, (t + 1) * N * N), N, base)));

// the fetched ground at any point of the city (bilinear), or null outside it
function groundAt(x: number, z: number): number | null {
  const i = Math.floor(x / CITY_TILE), j = Math.floor(z / CITY_TILE);
  const h = ground.get(`${i},${j}`);
  if (!h) return null;
  const u = (x - i * CITY_TILE) / STEP, v = (z - j * CITY_TILE) / STEP;
  const c = Math.min(N - 2, Math.floor(u)), r = Math.min(N - 2, Math.floor(v)), fu = u - c, fv = v - r;
  const k = r * N + c;
  return (1 - fv) * ((1 - fu) * h[k] + fu * h[k + 1]) + fv * ((1 - fu) * h[k + N] + fu * h[k + N + 1]);
}

// ------------------------------------------------------------------ water
// The elevation model has its lakes and the sea flattened, each to the one level it stands at
// (Saltsjön at +0.10, Mälaren at +0.89, Brunnsviken at +0.05): water is where the fetched ground
// is level to the centimetre over a large enough area, at that level. Each water cell and the cells
// on its shore round it carry the level (city-tile.ts 'WATR').
const M = N - 1;
let ti0 = Infinity, tj0 = Infinity, ti1 = -Infinity, tj1 = -Infinity;
for (const [i, j] of groundMeta.tiles) { ti0 = Math.min(ti0, i); tj0 = Math.min(tj0, j); ti1 = Math.max(ti1, i); tj1 = Math.max(tj1, j); }
const WW = (ti1 - ti0 + 1) * M, WH = (tj1 - tj0 + 1) * M;
const hasGround = (k: number) => { const x = k % WW, y = (k - x) / WW; return ground.has(`${ti0 + Math.floor(x / M)},${tj0 + Math.floor(y / M)}`); };
// each cell's level, where its four corners are within FLAT of each other
const cellLevel = new Float32Array(WW * WH).fill(NaN);
for (const [i, j] of groundMeta.tiles) {
  const h = ground.get(`${i},${j}`)!;
  for (let r = 0; r < M; r++) for (let c = 0; c < M; c++) {
    const k = r * N + c, a = h[k], b = h[k + 1], d = h[k + N], e = h[k + N + 1];
    if (Math.max(a, b, d, e) - Math.min(a, b, d, e) <= WATER.flat) cellLevel[((j - tj0) * M + r) * WW + (i - ti0) * M + c] = (a + b + d + e) / 4;
  }
}
// the level areas, kept where they are large enough; each cell's body of water, 1-based
const body = new Int32Array(WW * WH);
const bodyLevels: number[] = [];
{
  const seen = new Uint8Array(WW * WH), stack: number[] = [], cells: number[] = [];
  for (let s = 0; s < WW * WH; s++) {
    if (seen[s] || Number.isNaN(cellLevel[s])) continue;
    seen[s] = 1;
    stack.push(s);
    cells.length = 0;
    let sum = 0;
    while (stack.length) {
      const k = stack.pop()!, x = k % WW, y = (k - x) / WW;
      cells.push(k);
      sum += cellLevel[k];
      for (const q of [x > 0 ? k - 1 : -1, x + 1 < WW ? k + 1 : -1, y > 0 ? k - WW : -1, y + 1 < WH ? k + WW : -1]) {
        if (q < 0 || seen[q] || Number.isNaN(cellLevel[q]) || Math.abs(cellLevel[q] - cellLevel[s]) > WATER.flat) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    if (cells.length * STEP * STEP < WATER.area) continue;
    bodyLevels.push(Math.round((sum / cells.length) * 100) / 100);
    for (const k of cells) body[k] = bodyLevels.length;
  }
}
// Where OpenStreetMap has water the model doesn't (under bridges and decks, which it fills in
// between their ends), the water reaches on from what the model has, at its level, and the ground
// is brought down to it.
let filled = 0, bridged = 0, flattened = 0;
if (water) {
  const mask = new Uint8Array(WW * WH);
  for (const { rings } of water.water) {
    // the cells whose middles are inside, by even–odd over all the rings, row by row
    const pts = rings.map((r) => { const out: XZ[] = []; for (let k = 0; k < r.length; k += 2) out.push([r[k], r[k + 1]]); return out; });
    let z0 = Infinity, z1 = -Infinity;
    for (const r of pts) for (const [, z] of r) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const y0 = Math.max(0, Math.ceil((z0 - tj0 * CITY_TILE) / STEP - 0.5)), y1 = Math.min(WH - 1, Math.floor((z1 - tj0 * CITY_TILE) / STEP - 0.5));
    for (let y = y0; y <= y1; y++) {
      const z = tj0 * CITY_TILE + (y + 0.5) * STEP, xs: number[] = [];
      for (const r of pts) {
        for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
          const [xa, za] = r[a], [xb, zb] = r[b];
          if ((za > z) !== (zb > z)) xs.push(xa + ((z - za) * (xb - xa)) / (zb - za));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - ti0 * CITY_TILE) / STEP - 0.5)), c1 = Math.min(WW - 1, Math.floor((xs[k + 1] - ti0 * CITY_TILE) / STEP - 0.5));
        for (let c = c0; c <= c1; c++) mask[y * WW + c] = 1;
      }
    }
  }
  // out from the water the model has, through the outlines, nearest first
  let front: number[] = [];
  for (let k = 0; k < WW * WH; k++) if (body[k]) front.push(k);
  while (front.length) {
    const next: number[] = [];
    for (const k of front) {
      const x = k % WW, y = (k - x) / WW;
      for (const q of [x > 0 ? k - 1 : -1, x + 1 < WW ? k + 1 : -1, y > 0 ? k - WW : -1, y + 1 < WH ? k + WW : -1]) {
        if (q < 0 || body[q] || !mask[q] || !hasGround(q)) continue;
        body[q] = body[k];
        next.push(q);
        filled++;
      }
    }
    front = next;
  }
  // Where an outline doesn't close within the extract (Mälaren's), and along the coast, the shores
  // and every other outline bound the water instead: within WATER.reach of those shores, it reaches
  // on from the water the model has, well clear of them, as far again, and not over them.
  const shore = new Uint8Array(WW * WH);
  const mark = (x: number, z: number) => {
    const c = Math.floor((x - ti0 * CITY_TILE) / STEP), r = Math.floor((z - tj0 * CITY_TILE) / STEP);
    if (c >= 0 && r >= 0 && c < WW && r < WH) shore[r * WW + c] = 1;
  };
  const line = (pts: number[], closed: boolean) => {
    for (let k = 0; k + 2 < pts.length + (closed ? 2 : 0); k += 2) {
      const ax = pts[k], az = pts[k + 1], bx = pts[(k + 2) % pts.length], bz = pts[(k + 3) % pts.length];
      // every cell the segment passes through, so that it can't be crossed from side to side
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (STEP / 4)) || 1;
      for (let t = 0; t <= n; t++) {
        const x = ax + ((bx - ax) * t) / n, z = az + ((bz - az) * t) / n;
        mark(x, z);
        if (t) mark(ax + ((bx - ax) * (t - 1)) / n, z);
      }
    }
  };
  for (const { line: l } of water.shores) line(l, false);
  // only within reach of those shores
  const within = new Uint8Array(WW * WH);
  {
    let ring: number[] = [];
    for (let k = 0; k < WW * WH; k++) if (shore[k]) { within[k] = 1; ring.push(k); }
    for (let d = 0; d < WATER.reach / STEP && ring.length; d++) {
      const next: number[] = [];
      for (const k of ring) {
        const x = k % WW, y = (k - x) / WW;
        for (const q of [x > 0 ? k - 1 : -1, x + 1 < WW ? k + 1 : -1, y > 0 ? k - WW : -1, y + 1 < WH ? k + WW : -1]) {
          if (q >= 0 && !within[q]) { within[q] = 1; next.push(q); }
        }
      }
      ring = next;
    }
  }
  for (const { rings } of water.water) for (const r of rings) line(r, true);
  const near = new Uint8Array(WW * WH);
  for (let k = 0; k < WW * WH; k++) {
    if (!shore[k]) continue;
    const x = k % WW, y = (k - x) / WW;
    for (let dy = -WATER.clear; dy <= WATER.clear; dy++) for (let dx = -WATER.clear; dx <= WATER.clear; dx++) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < WW && Y < WH) near[Y * WW + X] = 1;
    }
  }
  front = [];
  for (let k = 0; k < WW * WH; k++) if (body[k] && !near[k] && within[k]) front.push(k);
  const added = new Uint8Array(WW * WH);
  for (let step = 0; step < WATER.reach / STEP && front.length; step++) {
    const next: number[] = [];
    for (const k of front) {
      const x = k % WW, y = (k - x) / WW;
      for (const q of [x > 0 ? k - 1 : -1, x + 1 < WW ? k + 1 : -1, y > 0 ? k - WW : -1, y + 1 < WH ? k + WW : -1]) {
        if (q < 0 || body[q] || shore[q] || !within[q] || !hasGround(q)) continue;
        body[q] = body[k];
        added[q] = 1;
        next.push(q);
      }
    }
    front = next;
  }
  // Each stretch of it is kept where it joins the water at two places or more, as under a bridge;
  // where it only reaches in from one, it has found a gap in the shores, into the land.
  const touched = new Uint8Array(WW * WH), stack: number[] = [], part: number[] = [], edge: number[] = [];
  const four = (k: number) => { const x = k % WW, y = (k - x) / WW; return [x > 0 ? k - 1 : -1, x + 1 < WW ? k + 1 : -1, y > 0 ? k - WW : -1, y + 1 < WH ? k + WW : -1]; };
  for (let s0 = 0; s0 < WW * WH; s0++) {
    if (added[s0] !== 1) continue;
    part.length = 0;
    edge.length = 0;
    added[s0] = 2;
    stack.push(s0);
    while (stack.length) {
      const k = stack.pop()!;
      part.push(k);
      for (const q of four(k)) {
        if (q < 0) continue;
        if (added[q] === 1) { added[q] = 2; stack.push(q); }
        else if (body[q] && !added[q] && !touched[q]) { touched[q] = 1; edge.push(q); }
      }
    }
    // the places it joins the water: the water's cells beside it, in groups of neighbours
    let joins = 0;
    for (const e of edge) {
      if (touched[e] !== 1) continue;
      joins++;
      touched[e] = 2;
      stack.push(e);
      while (stack.length) {
        const k = stack.pop()!, x = k % WW;
        for (const q of [...four(k), x > 0 && k >= WW ? k - WW - 1 : -1, x + 1 < WW && k >= WW ? k - WW + 1 : -1, x > 0 && k + WW < WW * WH ? k + WW - 1 : -1, x + 1 < WW && k + WW < WW * WH ? k + WW + 1 : -1]) {
          if (q >= 0 && touched[q] === 1) { touched[q] = 2; stack.push(q); }
        }
      }
    }
    for (const e of edge) touched[e] = 0;
    if (joins >= 2) bridged += part.length;
    else for (const k of part) body[k] = 0;
  }
  // the ground in the water, where it's over its level
  for (const [i, j] of groundMeta.tiles) {
    const h = ground.get(`${i},${j}`)!;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const x = (i - ti0) * M + c, y = (j - tj0) * M + r;
      let b = -1;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
        const X = x + dx, Y = y + dy;
        const w = X >= 0 && Y >= 0 && X < WW && Y < WH ? body[Y * WW + X] : 0;
        if (!w || (b >= 0 && w !== b)) { b = 0; break; }
        b = w;
      }
      if (b > 0 && h[r * N + c] > bodyLevels[b - 1]) {
        if (h[r * N + c] > bodyLevels[b - 1] + WATER.flat) flattened++;
        h[r * N + c] = bodyLevels[b - 1];
      }
    }
  }
}
let waterCells = 0;
for (const b of body) if (b) waterCells++;

// A tile's water: its cells and those on their shores, with the levels it has; but none over a
// tunnel whose inside reaches up through the water's level (the trough that carries the line
// under Riddarholmskanalen), where the water would stand in it.
function waterOf(i: number, j: number) {
  const ids: number[] = [], cells = new Uint8Array(M * M);
  for (let r = 0; r < M; r++) for (let c = 0; c < M; c++) {
    const x = (i - ti0) * M + c, y = (j - tj0) * M + r;
    let b = body[y * WW + x];
    for (let dy = -1; dy <= 1 && !b; dy++) for (let dx = -1; dx <= 1 && !b; dx++) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < WW && Y < WH) b = body[Y * WW + X];
    }
    if (!b || overTunnel(i * CITY_TILE + (c + 0.5) * STEP, j * CITY_TILE + (r + 0.5) * STEP, bodyLevels[b - 1])) continue;
    let at = ids.indexOf(b);
    if (at < 0) at = ids.push(b) - 1;
    cells[r * M + c] = at + 1;
  }
  return ids.length ? { levels: ids.map((b) => bodyLevels[b - 1]), cells } : null;
}

// ------------------------------------------------------------------ the track
const TUNNEL = new Set<StructureKind>(['rock', 'box']);
interface Seg {
  ax: number; az: number; bx: number; bz: number;
  ya: number; yb: number;
  buried: boolean;       // a tunnel the elevation model has more than half under the ground
  kind: StructureKind;
  pair: number;          // the other track's offset to the right (negative: left), 0 if none
  beside: number;        // another line's track's offset in the same box, on the other side, 0 if none
  plat: { side: number; width: number } | null;
  clampA: boolean; clampB: boolean; // whether the ends round off (false at a mouth)
  yard: boolean;         // track no service runs on (a depot's, a siding): its ground is walked on
}
const segs: Seg[] = [];
interface Mouth { x: number; z: number; tx: number; tz: number; y: number; crown: number; left: number; right: number }
const mouths: Mouth[] = [];

const tunnelClass = (k: StructureKind) => TUNNEL.has(k);
// where each piece's ends are, and whether the track there is in a tunnel
const ends = new Map<string, boolean[]>();
const endKey = (x: number, z: number) => `${Math.round(x)},${Math.round(z)}`;
for (const p of Object.values(geometry.pieces)) {
  for (const k of [0, p.x.length - 1]) {
    const key = endKey(p.x[k], p.z[k]);
    (ends.get(key) ?? ends.set(key, []).get(key)!).push(tunnelClass(STRUCTURE_KINDS[p.kind[k]]));
  }
}

// the structure's half-width on one side (+1 right, −1 left) of a track
function halfWidth(kind: StructureKind, pair: number, plat: Seg['plat'], side: number, beside = 0) {
  let w: number;
  switch (kind) {
    case 'grade': case 'embankment': w = S.EMBANKMENT.formation; break;
    case 'cutting': w = S.CUTTING.wall + S.CUTTING.thickness; break;
    case 'bridge': w = S.BRIDGE.deck + 0.25; break;
    case 'box': w = (pair ? S.ROCK.doubleWall : S.ROCK.singleFar) + S.BOX.wall; break;
    default: w = pair ? S.ROCK.doubleWall : S.ROCK.singleFar;
  }
  if (pair && Math.sign(pair) === side) w += Math.abs(pair);
  if (beside && Math.sign(beside) === side) w += Math.abs(beside);
  if (plat && plat.side === side) w = Math.max(w, S.PLATFORM_EDGE + plat.width + (TUNNEL.has(kind) ? S.HALL.behindPlatform : 0.3));
  return w;
}
function crownOf(kind: StructureKind, pair: number, plat: Seg['plat']) {
  if (kind === 'box') return S.BOX.height + S.BOX.roof;
  if (plat) return S.HALL.spring + S.HALL.risePerWidth * (2 * (S.PLATFORM_EDGE + plat.width) + Math.abs(pair));
  return pair ? S.ROCK.doubleCrown : S.ROCK.singleCrown;
}

const running = new Set(runningWays(graph).flatMap((r) => r.path.map((st) => st.piece)));
for (const [id, p] of Object.entries(geometry.pieces)) {
  const yard = !running.has(Number(id));
  const n = p.x.length;
  const platAt = (k: number) => {
    const pl = p.platforms.find((q) => p.s[k] >= q.s0 - 1 && p.s[k] <= q.s1 + 1);
    return pl ? { side: pl.side, width: pl.width } : null;
  };
  const kindAt = (k: number) => STRUCTURE_KINDS[p.kind[k]];
  // whether the piece's end at point k meets track of the same class, or nothing (rounds off)
  const endJoins = (k: number) => {
    const here = ends.get(endKey(p.x[k], p.z[k]))!;
    const mine = tunnelClass(kindAt(k));
    return here.every((c) => c === mine);
  };
  for (let k = 0; k + 1 < n; k++) {
    const ka = kindAt(k), kb = kindAt(k + 1);
    // A tunnel whose ground (by the elevation model) is below half its height is a short covered
    // way or one under a bridge the model leaves out: it stands in the open instead.
    const buried = (i: number) => {
      const g = p.ground[i];
      return g === null || g > p.y[i] + crownOf(kindAt(i), p.pair[i], platAt(i)) / 2;
    };
    // (the point at a mouth has the ground low: the segment into the tunnel from it is buried)
    const besideAt = (i: number) => p.beside?.[i] ?? 0;
    const base = { ya: p.y[k], yb: p.y[k + 1], pair: (p.pair[k] + p.pair[k + 1]) / 2, beside: (besideAt(k) + besideAt(k + 1)) / 2, buried: buried(k) || buried(k + 1), yard };
    const first = k === 0 ? endJoins(0) : true, last = k + 1 === n - 1 ? endJoins(n - 1) : true;
    // where a tunnel comes out from under the ground to stand in the open (or goes back under), the
    // raised ground over it meets the lowered ground beside it as at a mouth, so the same hole is
    // cut there, pointing out to the open
    if (k > 0 && ka === kb && kindAt(k - 1) === ka && tunnelClass(ka)) {
      const before = buried(k - 1) || buried(k);
      if (before !== base.buried) {
        const o = base.buried ? k - 1 : k + 1;
        addMouth(p.x[k], p.z[k], p.x[o] - p.x[k], p.z[o] - p.z[k], p.y[k], ka, p.pair[k], platAt(k), besideAt(k));
      }
    }
    if (ka === kb) {
      segs.push({ ax: p.x[k], az: p.z[k], bx: p.x[k + 1], bz: p.z[k + 1], ...base, kind: ka, plat: platAt(k), clampA: first, clampB: last });
      continue;
    }
    // the structure changes halfway (as the network draws it)
    const mx = (p.x[k] + p.x[k + 1]) / 2, mz = (p.z[k] + p.z[k + 1]) / 2, my = (p.y[k] + p.y[k + 1]) / 2;
    const mouth = tunnelClass(ka) !== tunnelClass(kb);
    segs.push({ ax: p.x[k], az: p.z[k], bx: mx, bz: mz, ya: p.y[k], yb: my, pair: base.pair, beside: base.beside, buried: buried(k), kind: ka, plat: platAt(k), clampA: first, clampB: !mouth, yard });
    segs.push({ ax: mx, az: mz, bx: p.x[k + 1], bz: p.z[k + 1], ya: my, yb: p.y[k + 1], pair: base.pair, beside: base.beside, buried: buried(k + 1), kind: kb, plat: platAt(k + 1), clampA: !mouth, clampB: last, yard });
    // pointing out of the tunnel
    const out = tunnelClass(ka) ? 1 : -1;
    if (mouth) addMouth(mx, mz, out * (p.x[k + 1] - p.x[k]), out * (p.z[k + 1] - p.z[k]), my, tunnelClass(ka) ? ka : kb, base.pair, platAt(k), base.beside);
  }
  // mouths at the piece's ends, where it meets a piece of the other class
  for (const k of [0, n - 1]) {
    if (endJoins(k) || !tunnelClass(kindAt(k))) continue;
    const here = ends.get(endKey(p.x[k], p.z[k]))!;
    if (!here.some((c) => !c)) continue; // a tunnel ending in nothing
    const o = k === 0 ? 1 : n - 2;
    addMouth(p.x[k], p.z[k], p.x[k] - p.x[o], p.z[k] - p.z[o], p.y[k], kindAt(k), p.pair[k], platAt(k), p.beside?.[k] ?? 0);
  }
}

// The tunnel's own space at a mouth, from wall to wall and floor to crown: the hole cut there.
function addMouth(x: number, z: number, dx: number, dz: number, y: number, tunnel: StructureKind, pair: number, plat: Seg['plat'], beside = 0) {
  const l = Math.hypot(dx, dz) || 1;
  mouths.push({ x, z, tx: dx / l, tz: dz / l, y, crown: crownOf(tunnel, pair, plat), left: halfWidth(tunnel, pair, plat, -1, beside), right: halfWidth(tunnel, pair, plat, 1, beside) });
}

// Whether a cell of water (its middle at x, z) lies over a tunnel whose inside reaches up through
// the water's level there.
function overTunnel(x: number, z: number, level: number) {
  for (const id of segsNear(x, z)) {
    const s = segs[id];
    if (!TUNNEL.has(s.kind)) continue;
    const r = relate(s, x, z);
    if (!r) continue;
    const w = halfWidth(s.kind, s.pair, s.plat, r.across >= 0 ? 1 : -1, s.beside);
    // (the cell's corners may reach over it from its middle)
    if (r.d > w + STEP * 0.71) continue;
    if (r.y + S.FLOOR < level && r.y + crownOf(s.kind, s.pair, s.plat) > level) return true;
  }
  return false;
}

// segments by 50 m cell, reaching as far as their effect on the ground can
const SEG_CELL = 50, SEG_REACH = 60;
const segIndex = new Map<string, number[]>();
segs.forEach((s, id) => {
  const x0 = Math.floor((Math.min(s.ax, s.bx) - SEG_REACH) / SEG_CELL), x1 = Math.floor((Math.max(s.ax, s.bx) + SEG_REACH) / SEG_CELL);
  const z0 = Math.floor((Math.min(s.az, s.bz) - SEG_REACH) / SEG_CELL), z1 = Math.floor((Math.max(s.az, s.bz) + SEG_REACH) / SEG_CELL);
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
    const key = `${i},${j}`;
    (segIndex.get(key) ?? segIndex.set(key, []).get(key)!).push(id);
  }
});
const segsNear = (x: number, z: number) => segIndex.get(`${Math.floor(x / SEG_CELL)},${Math.floor(z / SEG_CELL)}`) ?? [];

// Where a point is from a segment: across (+ right), along (0..1), and the distance that counts;
// null if it is beyond an end that doesn't round off.
function relate(s: Seg, x: number, z: number) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz || 1, l = Math.sqrt(l2);
  const t = ((x - s.ax) * dx + (z - s.az) * dz) / l2;
  if ((t < 0 && !s.clampA) || (t > 1 && !s.clampB)) return null;
  const across = ((x - s.ax) * -dz + (z - s.az) * dx) / l;
  const tc = Math.max(0, Math.min(1, t));
  const d = Math.hypot(s.ax + dx * tc - x, s.az + dz * tc - z);
  return { t: tc, across, d, y: s.ya + (s.yb - s.ya) * tc };
}

// The ground at a point, shaped for the track: [height, whether it is beside open track a service
// runs on (and so isn't walked on)]
function shape(x: number, z: number, h0: number): [number, boolean] {
  let lower = -Infinity, upper = Infinity, upperRun = Infinity, beside = false, roof = -Infinity;
  for (const id of segsNear(x, z)) {
    const s = segs[id];
    const r = relate(s, x, z);
    if (!r) continue;
    const side = r.across >= 0 ? 1 : -1;
    const w = halfWidth(s.kind, s.pair, s.plat, side, s.beside);
    const out = Math.max(0, r.d - w);
    if (TUNNEL.has(s.kind) && s.buried) {
      lower = Math.max(lower, r.y + crownOf(s.kind, s.pair, s.plat) + COVER - out / 1.5);
      // over its own half of the tunnel, the ground stays over its roof
      const own = s.pair && Math.sign(s.pair) === side ? Math.abs(s.pair) / 2
        : s.beside && Math.sign(s.beside) === side ? Math.abs(s.beside) / 2 : halfWidth(s.kind, 0, s.plat, side);
      if (r.d <= own) roof = Math.max(roof, r.y + crownOf(s.kind, s.pair, s.plat) + ROOF_COVER);
    } else {
      // flat for a metre beyond the structure, then rising at the bank's slope (or 1:1 behind a
      // cutting's walls)
      const floor = s.kind === 'bridge' ? r.y + S.FLOOR - S.BRIDGE.depth - UNDER : r.y + S.FLOOR - UNDER;
      const u = floor + Math.max(0, out - 1) / (s.kind === 'cutting' ? 1 : S.EMBANKMENT.slope);
      upper = Math.min(upper, u);
      if (!s.yard) upperRun = Math.min(upperRun, u);
      if (out < 1.5 && !s.yard) beside = true;
    }
  }
  let h = Math.max(h0, lower);
  if (upper < h) { h = upper; if (upperRun < upper + 0.01) beside = true; }
  // open track beside a tunnel lowers the ground only as far as the tunnel's roof
  return [Math.max(h, roof), beside];
}

// ------------------------------------------------------------------ station parts at the surface
// Plans of the stations' parts that reach above the ground, grown by a margin, and the ways out of
// the exits that come up into the street.
// `way`: from an exit (the stairs' end in the street, or a lift's door) on through any buildings
// to the outside
interface StationCut { plan: XZ[]; exit: { x: number; z: number; dx: number; dz: number; width: number } | null; way: XZ[] | null }
const stationCuts: StationCut[] = [];
function grow(plan: XZ[], m: number): XZ[] {
  // a convex polygon's edges moved out by m
  let area = 0;
  plan.forEach(([ax, az], i) => { const [bx, bz] = plan[(i + 1) % plan.length]; area += ax * bz - bx * az; });
  const w = area > 0 ? 1 : -1;
  const lines = plan.map(([ax, az], i) => {
    const [bx, bz] = plan[(i + 1) % plan.length];
    let nx = (bz - az) * w, nz = -(bx - ax) * w;
    const l = Math.hypot(nx, nz) || 1;
    nx /= l; nz /= l;
    return { nx, nz, d: nx * ax + nz * az + m };
  });
  return lines.map((a, i) => {
    const b = lines[(i + plan.length - 1) % plan.length];
    const det = b.nx * a.nz - b.nz * a.nx;
    if (Math.abs(det) < 1e-9) return [plan[i][0] + a.nx * m, plan[i][1] + a.nz * m] as XZ;
    return [(b.d * a.nz - b.nz * a.d) / det, (b.nx * a.d - b.d * a.nx) / det] as XZ;
  });
}
for (const st of layouts.stations) {
  for (const p of st.parts) {
    let plan: XZ[], top: number[];
    if (p.kind === 'floor') { plan = p.corners.map((c) => [c[0], c[2]]); top = p.corners.map((c) => c[1] + (p.ceiling ?? 3)); }
    else if (p.kind === 'incline') { plan = inclineCorners(p); top = floorHeights(p).map((y) => y + p.ceiling); }
    else if (p.kind === 'lift') { plan = liftCorners(p); top = plan.map(() => Math.max(...p.levels) + 3); }
    else continue;
    const reaches = plan.some(([x, z], k) => { const g = groundAt(x, z); return g !== null && top[k] > g - 0.3; });
    if (!reaches) continue;
    let exit: StationCut['exit'] = null;
    if (p.kind === 'incline' && p.open !== undefined) {
      // out at the end in the street (the top, or the foot of stairs down from a hall above it)
      const [from, to] = Math.abs(p.b[1] - p.open) < Math.abs(p.a[1] - p.open) ? [p.a, p.b] : [p.b, p.a];
      const dx = to[0] - from[0], dz = to[2] - from[2], l = Math.hypot(dx, dz) || 1;
      exit = { x: to[0], z: to[2], dx: dx / l, dz: dz / l, width: p.width };
    }
    if (p.kind === 'lift') {
      // out of its door at the top, which faces yaw (as the player's: 0 looks north)
      const dx = -Math.sin(p.yaw), dz = -Math.cos(p.yaw);
      exit = { x: p.x + (dx * LIFT.depth) / 2, z: p.z + (dz * LIFT.depth) / 2, dx, dz, width: LIFT.width };
    }
    stationCuts.push({ plan: grow(plan, 0.6), exit, way: null });
  }
}

// ------------------------------------------------------------------ buildings
type Ring = XZ[];
const ringArea = (r: Ring) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) { const [ax, az] = r[i], [bx, bz] = r[(i + 1) % r.length]; a += ax * bz - bx * az; }
  return a / 2;
};
function inside([x, z]: XZ, ring: Ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const centroid = (r: Ring): XZ => {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0; i < r.length; i++) {
    const [ax, az] = r[i], [bx, bz] = r[(i + 1) % r.length], f = ax * bz - bx * az;
    a += f; cx += (ax + bx) * f; cz += (az + bz) * f;
  }
  return Math.abs(a) < 1e-9 ? r[0] : [cx / (3 * a), cz / (3 * a)];
};
const num = (v: string | undefined) => {
  if (v === undefined) return null;
  const m = /^\s*(-?\d+(?:[.,]\d+)?)/.exec(v);
  return m ? Number(m[1].replace(',', '.')) : null;
};

const SMALL = new Set(['garage', 'garages', 'shed', 'carport', 'hut', 'kiosk', 'toilets', 'cabin', 'container', 'bunker', 'greenhouse', 'allotment_house', 'service', 'transformer_tower', 'gazebo']);
const HOUSES = new Set(['house', 'detached', 'semidetached_house', 'semi', 'bungalow', 'farm', 'villa']);
// default storeys for the rest when the neighbours don't say
const DEFAULT_LEVELS: Record<string, number> = {
  apartments: 5, residential: 4, office: 5, commercial: 3, retail: 2, hotel: 5, school: 3, university: 4,
  college: 4, hospital: 5, dormitory: 4, terrace: 2, kindergarten: 1, industrial: 2, warehouse: 2,
  train_station: 1, transportation: 1, sports_hall: 2, sports_centre: 2, parking: 3, public: 3, government: 4,
  civic: 3, church: 5, cathedral: 8, chapel: 2, palace: 4, museum: 4,
};
// the sorts whose storeys tell what their neighbours have
const BLOCKS = new Set(['apartments', 'residential', 'yes', 'office', 'commercial', 'retail', 'hotel', 'dormitory', 'mixed_use']);

// colours as OSM gives them: hex, or a few of CSS's names
const NAMED: Record<string, number> = {
  white: 0xffffff, black: 0x000000, gray: 0x808080, grey: 0x808080, silver: 0xc0c0c0, darkgray: 0xa9a9a9, darkgrey: 0xa9a9a9,
  lightgray: 0xd3d3d3, lightgrey: 0xd3d3d3, dimgray: 0x696969, red: 0xff0000, darkred: 0x8b0000, maroon: 0x800000,
  brown: 0xa52a2a, sienna: 0xa0522d, saddlebrown: 0x8b4513, chocolate: 0xd2691e, peru: 0xcd853f, tan: 0xd2b48c,
  burlywood: 0xdeb887, wheat: 0xf5deb3, beige: 0xf5f5dc, ivory: 0xfffff0, linen: 0xfaf0e6, cream: 0xfffdd0,
  antiquewhite: 0xfaebd7, bisque: 0xffe4c4, yellow: 0xffff00, gold: 0xffd700, khaki: 0xf0e68c, orange: 0xffa500,
  salmon: 0xfa8072, pink: 0xffc0cb, green: 0x008000, darkgreen: 0x006400, olive: 0x808000, blue: 0x0000ff,
  navy: 0x000080, lightblue: 0xadd8e6, teal: 0x008080, purple: 0x800080, coral: 0xff7f50, rosybrown: 0xbc8f8f,
  firebrick: 0xb22222, indianred: 0xcd5c5c, darkslategray: 0x2f4f4f, darkslategrey: 0x2f4f4f, slategray: 0x708090,
  slategrey: 0x708090, lightslategray: 0x778899, darkolivegreen: 0x556b2f, seagreen: 0x2e8b57, cadetblue: 0x5f9ea0,
  steelblue: 0x4682b4, lightsalmon: 0xffa07a, darksalmon: 0xe9967a, lightyellow: 0xffffe0, lightgreen: 0x90ee90,
  darkkhaki: 0xbdb76b, goldenrod: 0xdaa520, darkgoldenrod: 0xb8860b, sandybrown: 0xf4a460, orangered: 0xff4500,
  tomato: 0xff6347, crimson: 0xdc143c, gainsboro: 0xdcdcdc, whitesmoke: 0xf5f5f5, snow: 0xfffafa, oldlace: 0xfdf5e6,
  mintcream: 0xf5fffa, honeydew: 0xf0fff0, lavender: 0xe6e6fa, mistyrose: 0xffe4e1, peachpuff: 0xffdab9,
  navajowhite: 0xffdead, moccasin: 0xffe4b5, palegoldenrod: 0xeee8aa, lemonchiffon: 0xfffacd, seashell: 0xfff5ee,
  floralwhite: 0xfffaf0, cornsilk: 0xfff8dc, blanchedalmond: 0xffebcd, darkblue: 0x00008b,
  lime: 0x00ff00, aqua: 0x00ffff, cyan: 0x00ffff, magenta: 0xff00ff, fuchsia: 0xff00ff,
};

// Roofs without a colour given, by what they're made of.
const ROOF_MATERIALS: Record<string, number> = {
  roof_tiles: 0xa4553d, tile: 0xa4553d, tiles: 0xa4553d, brick: 0xa4553d, copper: 0x6f9c86, metal: 0x3d3f42,
  metal_sheet: 0x3d3f42, tin: 0x3d3f42, zinc: 0x8a8e91, slate: 0x4a4d52, glass: 0x9fb4c0, grass: 0x6b7a45,
  tar_paper: 0x333436, asphalt: 0x333436, concrete: 0x8c8a86, wood: 0x6b5a48, gold: 0xc9a645,
};
function roofColour(t: Record<string, string>) {
  return colour(t['roof:colour']) ?? ROOF_MATERIALS[(t['roof:material'] ?? '').toLowerCase()] ?? null;
}

// The walls' style: from building:material, or for houses wood, and for sheds and warehouses plain.
const WOODEN = new Set(['house', 'detached', 'semidetached_house', 'bungalow', 'cabin', 'hut', 'farm', 'farm_auxiliary', 'barn', 'villa']);
const PLAIN = new Set(['industrial', 'warehouse', 'garage', 'garages', 'shed', 'service', 'hangar', 'transformer_tower', 'carport', 'container', 'storage_tank', 'silo']);
function wallStyle(t: Record<string, string>): WallStyle {
  const m = (t['building:material'] ?? '').toLowerCase();
  if (/brick|bric/.test(m)) return 'brick';
  if (/glass/.test(m)) return 'glass';
  if (/wood/.test(m)) return 'wood';
  if (/metal|steel|aluminium/.test(m)) return 'plain';
  if (m) return 'plaster';
  const type = t.building ?? t['building:part'] ?? '';
  if (WOODEN.has(type)) return 'wood';
  if (PLAIN.has(type)) return 'plain';
  return 'plaster';
}

// roof:direction as a compass bearing in degrees: a number, or N, NNE, … NW
const COMPASS = ['n', 'nne', 'ne', 'ene', 'e', 'ese', 'se', 'sse', 's', 'ssw', 'sw', 'wsw', 'w', 'wnw', 'nw', 'nnw'];
function bearing(v: string | undefined) {
  if (!v) return null;
  const n = num(v);
  if (n !== null) return n;
  const k = COMPASS.indexOf(v.trim().toLowerCase());
  return k >= 0 ? k * 22.5 : null;
}
function colour(v: string | undefined) {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  const hex = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/.exec(s);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1];
    return parseInt(h, 16) || 0x010101;
  }
  return NAMED[s.replace(/[\s_-]/g, '')] ?? null;
}

interface Source { osm: string; tags: Record<string, string>; rings: Ring[]; part: boolean; area: number; c: XZ; hasParts?: boolean }
const sources: Source[] = osm.buildings.map((b) => {
  const rings = b.rings.map((flat) => {
    const r: Ring = [];
    for (let k = 0; k + 1 < flat.length; k += 2) {
      const p: XZ = [flat[k], flat[k + 1]];
      if (!r.length || Math.hypot(p[0] - r[r.length - 1][0], p[1] - r[r.length - 1][1]) > 0.05) r.push(p);
    }
    if (r.length > 1 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 0.05) r.pop();
    return r;
  }).filter((r) => r.length >= 3);
  const part = !b.tags.building || b.tags.building === 'no';
  return { osm: b.osm, tags: b.tags, rings, part, area: rings.length ? Math.abs(ringArea(rings[0])) : 0, c: rings.length ? centroid(rings[0]) : [0, 0] as XZ };
}).filter((s) => s.rings.length && s.area > 2);

// buildings by 50 m cell, for finding neighbours and outlines around parts
const BCELL = 50;
const bIndex = new Map<string, number[]>();
sources.forEach((s, id) => {
  const xs = s.rings[0].map((p) => p[0]), zs = s.rings[0].map((p) => p[1]);
  for (let i = Math.floor(Math.min(...xs) / BCELL); i <= Math.floor(Math.max(...xs) / BCELL); i++) {
    for (let j = Math.floor(Math.min(...zs) / BCELL); j <= Math.floor(Math.max(...zs) / BCELL); j++) {
      const key = `${i},${j}`;
      (bIndex.get(key) ?? bIndex.set(key, []).get(key)!).push(id);
    }
  }
});
const near = (x: number, z: number, r: number) => {
  const out = new Set<number>();
  for (let i = Math.floor((x - r) / BCELL); i <= Math.floor((x + r) / BCELL); i++) {
    for (let j = Math.floor((z - r) / BCELL); j <= Math.floor((z + r) / BCELL); j++) for (const id of bIndex.get(`${i},${j}`) ?? []) out.add(id);
  }
  return [...out];
};
// outlines that have parts are drawn as their parts
let withParts = 0;
for (const s of sources) {
  if (!s.part) continue;
  for (const id of near(s.c[0], s.c[1], 1)) {
    const o = sources[id];
    if (!o.part && !o.hasParts && o.area > s.area * 0.99 && inside(s.c, o.rings[0])) { o.hasParts = true; withParts++; }
  }
}

// the ways out of the exits, through whatever buildings stand in front of them
const standing = (o: Source) => !o.hasParts && o.tags.building !== 'roof' && !num(o.tags.min_height) && !num(o.tags['building:min_level']);
const inBuilding = (q: XZ) => near(q[0], q[1], 1).some((id) => {
  const o = sources[id];
  return standing(o) && inside(q, o.rings[0]) && !o.rings.slice(1).some((h) => inside(q, h));
});
for (const c of stationCuts) {
  const e = c.exit;
  if (!e) continue;
  let len = 0;
  while (len < 120 && (len < 2 || inBuilding([e.x + e.dx * len, e.z + e.dz * len]))) len += 1;
  if (len <= 2) continue;
  const w = e.width / 2 + 0.8, rx = -e.dz, rz = e.dx;
  const a: XZ = [e.x - e.dx, e.z - e.dz], b: XZ = [e.x + e.dx * (len + 1), e.z + e.dz * (len + 1)];
  c.way = [[a[0] - rx * w, a[1] - rz * w], [b[0] - rx * w, b[1] - rz * w], [b[0] + rx * w, b[1] + rz * w], [a[0] + rx * w, a[1] + rz * w]];
}

const levelsOf = (t: Record<string, string>) => num(t['building:levels']);
function estimateLevels(s: Source) {
  const type = s.tags.building ?? s.tags['building:part'] ?? 'yes';
  if (SMALL.has(type) || s.area < 40) return 1;
  if (HOUSES.has(type)) return 1.7;
  if (BLOCKS.has(type) && (type !== 'yes' || s.area > 150)) {
    const levels: number[] = [];
    for (const id of near(s.c[0], s.c[1], 150)) {
      const o = sources[id], l = levelsOf(o.tags);
      if (o === s || l === null || !BLOCKS.has(o.tags.building ?? '')) continue;
      if (Math.hypot(o.c[0] - s.c[0], o.c[1] - s.c[1]) < 150) levels.push(l);
    }
    if (levels.length >= 3) return levels.sort((a, b) => a - b)[Math.floor(levels.length / 2)];
  }
  if (DEFAULT_LEVELS[type] !== undefined) return DEFAULT_LEVELS[type];
  return s.area < 150 ? 2 : 3;
}

let estimated = 0;
function heights(s: Source) {
  const t = s.tags;
  const shapeTag = (t['roof:shape'] ?? 'flat').toLowerCase().replace('_', '-');
  const roof: RoofShape = (ROOF_SHAPES as readonly string[]).includes(shapeTag) ? shapeTag as RoofShape : 'flat';
  // (roof:levels=0, common, says the roof is in the top storey: not how high it is)
  const roofLevels = num(t['roof:levels']) || null;
  let roofHeight = num(t['roof:height']) ?? (roofLevels !== null ? roofLevels * 2.8 : roof === 'flat' ? 0 : 3);
  let total = num(t.height);
  let walls: number, guessed = false;
  if (total !== null) {
    roofHeight = Math.min(roofHeight, total * 0.6);
    walls = total - roofHeight;
  } else {
    let levels = levelsOf(t);
    if (levels === null) { levels = estimateLevels(s); guessed = true; }
    walls = Math.max(2.5, levels * LEVEL + (levels >= 2 ? PARAPET : 0));
    total = walls + roofHeight;
  }
  const min = num(t.min_height) ?? (num(t['building:min_level']) !== null ? num(t['building:min_level'])! * LEVEL : 0);
  return { roof, roofHeight, walls, min, guessed };
}

// The heights and roof as the laser scan measured them, over heights(s)'s, for a building whose
// lowest ground is g0: its eaves, unless OSM gives a height; its roof's shape and height, unless
// OSM gives a shape; else OSM's shape up to the scan's top. Left out where the scan has the roof
// lower than a storey over the ground (built since, or the scan's wrong), or where it can't be
// this building's (below).
let laserMeasured = 0, laserShaped = 0;
const laserDoubted = new Map<string, number>();
function laserHeights(s: Source, g0: number, h: ReturnType<typeof heights>) {
  const opts = { direction: bearing(s.tags['roof:direction']), across: s.tags['roof:orientation'] === 'across' };
  const m = laser?.buildings[s.osm];
  if (!m || num(s.tags.height) !== null || s.tags.building === 'roof') return { ...h, opts };
  const [eaves, top, found] = m;
  if (top - g0 < 2.5) return { ...h, opts };
  const t = s.tags;
  // Where the scan has plainly measured something else: eaves under the ground (a fit gone wrong),
  // a small building far taller than one could be (it stands under or against a taller one, whose
  // roof the scan saw), eaves far from what OSM's levels say, or a roof higher than its walls.
  const walls = eaves - g0, levels = num(t['building:levels']);
  const doubt = walls < 2 ? 'eaves under the ground'
    : s.area < 60 && top - g0 > 25 ? 'small and tall'
    : levels && (walls > Math.max(6.5 * levels, 20) || walls < 2.2 * levels) ? 'not its levels'
    : top - eaves > Math.max(8, walls) ? 'roof over its walls' : null;
  if (doubt) { laserDoubted.set(doubt, (laserDoubted.get(doubt) ?? 0) + 1); return { ...h, opts }; }
  laserMeasured++;
  if (t['roof:shape']) {
    const total = top - g0;
    const given = num(t['roof:height']) ?? (num(t['roof:levels']) ? num(t['roof:levels'])! * 2.8 : null);
    const roofHeight = h.roof === 'flat' ? 0 : Math.min(given ?? (top - eaves >= 1 ? top - eaves : 3), total * 0.6);
    return { ...h, roofHeight, walls: Math.max(2.5, total - roofHeight), guessed: false, opts };
  }
  const [shape, arg] = found.split(':');
  const roof = (ROOF_SHAPES as readonly string[]).includes(shape) ? shape as RoofShape : 'flat';
  if (roof !== 'flat') {
    laserShaped++;
    if (roof === 'skillion') opts.direction = Number(arg);
    if (roof === 'gabled') opts.across = arg === 'across';
  }
  return { ...h, roof, roofHeight: roof === 'flat' ? 0 : top - eaves, walls: Math.max(2.5, eaves - g0), guessed: false, opts };
}

// the track's space, as polygons, near a point, with the height a building over it must clear: over
// open track the trains, over a tunnel its roof (which only counts where the building would reach
// down into it)
function trackSpace(x: number, z: number, r: number) {
  const polys: { poly: Polygon; top: number; tunnel: boolean }[] = [];
  const seen = new Set<number>();
  for (let i = Math.floor((x - r) / SEG_CELL); i <= Math.floor((x + r) / SEG_CELL); i++) {
    for (let j = Math.floor((z - r) / SEG_CELL); j <= Math.floor((z + r) / SEG_CELL); j++) {
      for (const id of segIndex.get(`${i},${j}`) ?? []) {
        if (seen.has(id)) continue;
        seen.add(id);
        const s = segs[id], tunnel = TUNNEL.has(s.kind);
        const dx = s.bx - s.ax, dz = s.bz - s.az, l = Math.hypot(dx, dz) || 1;
        const rx = -dz / l, rz = dx / l, ex = (dx / l) * 0.5, ez = (dz / l) * 0.5;
        const wl = halfWidth(s.kind, s.pair, s.plat, -1, s.beside) + 1, wr = halfWidth(s.kind, s.pair, s.plat, 1, s.beside) + 1;
        const ring: XZ[] = [
          [s.ax - rx * wl - ex, s.az - rz * wl - ez], [s.bx - rx * wl + ex, s.bz - rz * wl + ez],
          [s.bx + rx * wr + ex, s.bz + rz * wr + ez], [s.ax + rx * wr - ex, s.az + rz * wr - ez],
        ];
        const y = Math.max(s.ya, s.yb);
        polys.push({ poly: [[...ring, ring[0]]], top: tunnel ? y + crownOf(s.kind, s.pair, s.plat) : y + CLEARANCE, tunnel });
      }
    }
  }
  return polys;
}

const toPoly = (rings: Ring[]): Polygon => rings.map((r) => [...r, r[0]]);
const fromPoly = (p: Polygon): Ring[] => p.map((r) => r.slice(0, -1) as Ring);
const bbox = (r: Ring) => {
  const xs = r.map((p) => p[0]), zs = r.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
};

// station cuts by 50 m cell
const cutIndex = new Map<string, number[]>();
stationCuts.forEach((c, id) => {
  const [x0, z0, x1, z1] = bbox([...c.plan, ...(c.way ?? [])]);
  for (let i = Math.floor(x0 / BCELL); i <= Math.floor(x1 / BCELL); i++) for (let j = Math.floor(z0 / BCELL); j <= Math.floor(z1 / BCELL); j++) {
    const key = `${i},${j}`;
    (cutIndex.get(key) ?? cutIndex.set(key, []).get(key)!).push(id);
  }
});

// The depot's covered track (OpenStreetMap's covered=yes), as segments by 50 m cell.
const covered: [XZ, XZ][] = [];
for (const [id, g] of Object.entries(geometry.pieces)) {
  if (!graph.pieces[Number(id)].covered) continue;
  for (let k = 0; k + 1 < g.x.length; k++) covered.push([[g.x[k], g.z[k]], [g.x[k + 1], g.z[k + 1]]]);
}
// how much of it lies inside an outline
function coveredInside(ring: Ring) {
  const [x0, z0, x1, z1] = bbox(ring);
  let len = 0;
  for (const [a, b] of covered) {
    if (Math.max(a[0], b[0]) < x0 || Math.min(a[0], b[0]) > x1 || Math.max(a[1], b[1]) < z0 || Math.min(a[1], b[1]) > z1) continue;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(l / 2));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      if (inside([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ring)) len += l / n;
    }
  }
  return len;
}
// A hall's doors: wherever a track in the open crosses its outline, a door DOOR.width wide square
// to the track and DOOR.height above its rails; doors that overlap on a wall are made one.
function doorsOf(ring: Ring): Door[] {
  const out: Door[] = [];
  for (let e = 0; e < ring.length; e++) {
    const [ax, az] = ring[e], [bx, bz] = ring[(e + 1) % ring.length];
    const ex = bx - ax, ez = bz - az, len = Math.hypot(ex, ez);
    if (len < 0.5) continue;
    const found: { from: number; to: number; top: number }[] = [];
    const seen = new Set<number>();
    for (let i = Math.floor(Math.min(ax, bx) / SEG_CELL) - 1; i <= Math.floor(Math.max(ax, bx) / SEG_CELL) + 1; i++) {
      for (let j = Math.floor(Math.min(az, bz) / SEG_CELL) - 1; j <= Math.floor(Math.max(az, bz) / SEG_CELL) + 1; j++) {
        for (const id of segIndex.get(`${i},${j}`) ?? []) {
          if (seen.has(id)) continue;
          seen.add(id);
          const sg = segs[id];
          if (TUNNEL.has(sg.kind)) continue;
          const dx = sg.bx - sg.ax, dz = sg.bz - sg.az;
          const den = ex * dz - ez * dx;
          if (Math.abs(den) < 1e-9) continue;
          // where the track crosses the wall: t along the wall, u along the track's segment
          const t = ((sg.ax - ax) * dz - (sg.az - az) * dx) / den, u = ((sg.ax - ax) * ez - (sg.az - az) * ex) / den;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const sin = Math.abs(den) / (len * Math.hypot(dx, dz));
          const half = Math.min(8, DOOR.width / 2 / Math.max(0.3, sin));
          found.push({ from: Math.max(0, t * len - half), to: Math.min(len, t * len + half), top: sg.ya + (sg.yb - sg.ya) * u + DOOR.height });
        }
      }
    }
    found.sort((p, q) => p.from - q.from);
    for (const d of found) {
      const last = out[out.length - 1];
      if (last && last.edge === e && d.from <= last.to) { last.to = Math.max(last.to, d.to); last.top = Math.max(last.top, d.top); }
      else out.push({ edge: e, ...d });
    }
  }
  return out;
}

const tiles = new Map<string, Building[]>();
let overTrack = 0, sheds = 0, roofsDropped = 0, cutForStations = 0, outside = 0;
let shaped = 0, unshaped = 0;
for (const s of sources) {
  if (s.hasParts) continue;
  const ti = Math.floor(s.c[0] / CITY_TILE), tj = Math.floor(s.c[1] / CITY_TILE);
  const list = ground.has(`${ti},${tj}`) ? (tiles.get(`${ti},${tj}`) ?? tiles.set(`${ti},${tj}`, []).get(`${ti},${tj}`)!) : null;
  if (!list) { outside++; continue; }
  const outline = s.rings[0];
  const gs = outline.map(([x, z]) => groundAt(x, z)).filter((g): g is number => g !== null);
  const cg = groundAt(s.c[0], s.c[1]);
  if (cg !== null) gs.push(cg);
  if (!gs.length) continue;
  const g0 = Math.min(...gs), g1 = Math.max(...gs);
  const { roof, roofHeight, walls, min, guessed, opts: roofOpts } = laserHeights(s, g0, heights(s));
  if (guessed) estimated++;
  const roofOnly = s.tags.building === 'roof';
  const shed = !roofOnly && coveredInside(outline) >= SHED_TRACK;
  let top = g0 + walls;
  // a building sunk into a slope still stands above its highest ground
  if (!min && !roofOnly) top = Math.max(top, g1 + 2.5);
  const bottom = roofOnly ? top - 0.4 : min ? g0 + min : g0 - SINK;
  const base: Omit<Building, 'rings'> = {
    kind: roofOnly ? 'roof' : shed ? 'shed' : s.part ? 'part' : 'building', roof, bottom, top, roofHeight,
    colour: colour(s.tags['building:colour']), roofColour: roofColour(s.tags), wall: wallStyle(s.tags),
  };
  let shape: MultiPolygon = [toPoly(s.rings)];

  const [bx0, bz0, bx1, bz1] = bbox(outline);
  // the stations' parts at the surface, and their ways out
  const cuts = new Set<number>();
  for (let i = Math.floor(bx0 / BCELL); i <= Math.floor(bx1 / BCELL); i++) for (let j = Math.floor(bz0 / BCELL); j <= Math.floor(bz1 / BCELL); j++) {
    for (const id of cutIndex.get(`${i},${j}`) ?? []) cuts.add(id);
  }
  let cut = false;
  for (const id of cuts) {
    const c = stationCuts[id];
    const holes: Polygon[] = [c.plan, ...(c.way ? [c.way] : [])].map((r) => [[...r, r[0]]])
      .filter((h) => polygonClipping.intersection(shape, h).length);
    if (!holes.length) continue;
    shape = polygonClipping.difference(shape, ...holes);
    cut = true;
  }
  if (cut) cutForStations++;

  // the track's space
  const space = trackSpace((bx0 + bx1) / 2, (bz0 + bz1) / 2, Math.hypot(bx1 - bx0, bz1 - bz0) / 2 + 20);
  const hits = space.filter(({ poly, top: clear, tunnel }) => (!tunnel || clear > bottom) && polygonClipping.intersection(shape, poly).length);
  if (shed) {
    // a hall: the tracks run in through its doors
    sheds++;
    const from = list.length;
    emit(list, shape, base);
    for (const b of list.slice(from)) b.doors = doorsOf(b.rings[0]);
    continue;
  }
  if (hits.length) {
    if (roofOnly) { roofsDropped++; continue; }
    overTrack++;
    const union = polygonClipping.union(hits[0].poly, ...hits.slice(1).map((h) => h.poly));
    const over = polygonClipping.intersection(shape, union);
    shape = polygonClipping.difference(shape, union);
    // the part over the track, lifted clear of the trains (or the tunnel's roof)
    const clear = Math.max(...hits.map((h) => h.top));
    if (top - Math.max(bottom, clear) > 2.5) emit(list, over, { ...base, kind: 'part', bottom: Math.max(bottom, clear) }, roofOpts);
  }
  emit(list, shape, base, roofOpts);
}

// Polygons as buildings: the outline with a positive shoelace area in x, z, courtyards negative.
// The pieces of a building, each with its roof of its shape (where one can be built: else flat).
function emit(list: Building[], shape: MultiPolygon, base: Omit<Building, 'rings'>, roofOpts?: { direction: number | null; across: boolean }) {
  for (const p of shape) {
    const rings = fromPoly(p).filter((r) => r.length >= 3 && Math.abs(ringArea(r)) > 1);
    if (!rings.length) continue;
    if (ringArea(rings[0]) < 0) rings[0].reverse();
    for (const r of rings.slice(1)) if (ringArea(r) > 0) r.reverse();
    const b: Building = { ...base, rings };
    if (roofOpts && b.roof !== 'flat' && (b.kind === 'building' || b.kind === 'part')) {
      const roof = buildRoof(rings, b.roof, b.roofHeight, roofOpts);
      if (roof) { b.roofMesh = roof; shaped++; } else unshaped++;
    }
    list.push(b);
  }
}

// ------------------------------------------------------------------ the tiles
mkdirSync(OUT, { recursive: true });
const written = new Set<string>(['index.json']);
let lowered = 0, raised = 0, bytes = 0, buildingCount = 0;
const mouthHoles = mouths.map((m) => ({ ...m }));
for (const [i, j] of groundMeta.tiles) {
  const h0 = ground.get(`${i},${j}`)!;
  const heights = new Float32Array(N * N), beside = new Uint8Array(N * N), flags = new Uint8Array((N - 1) * (N - 1));
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const k = r * N + c;
      const [h, b] = shape(i * CITY_TILE + c * STEP, j * CITY_TILE + r * STEP, h0[k]);
      heights[k] = h;
      beside[k] = b ? 1 : 0;
      if (h < h0[k] - 0.01) lowered++;
      else if (h > h0[k] + 0.01) raised++;
    }
  }
  for (let r = 0; r + 1 < N; r++) for (let c = 0; c + 1 < N; c++) {
    const k = r * N + c;
    if (beside[k] || beside[k + 1] || beside[k + N] || beside[k + N + 1]) flags[r * (N - 1) + c] |= CELL_TRACK;
  }
  const x0 = i * CITY_TILE, z0 = j * CITY_TILE, m = 30;
  const holes = mouthHoles.filter((h) => h.x > x0 - m && h.x < x0 + CITY_TILE + m && h.z > z0 - m && h.z < z0 + CITY_TILE + m).map((h) => {
    const rx = -h.tz, rz = h.tx;
    // from MOUTH.into back in the tunnel to MOUTH.out along the open track (tx, tz points from the
    // tunnel out)
    const a = -MOUTH.into, b = MOUTH.out;
    const corners: [number, number][] = [
      [h.x + h.tx * a - rx * h.left, h.z + h.tz * a - rz * h.left], [h.x + h.tx * b - rx * h.left, h.z + h.tz * b - rz * h.left],
      [h.x + h.tx * b + rx * h.right, h.z + h.tz * b + rz * h.right], [h.x + h.tx * a + rx * h.right, h.z + h.tz * a + rz * h.right],
    ];
    return { corners, bottom: h.y + S.FLOOR - 0.5, top: h.y + h.crown };
  });
  const buildings = tiles.get(`${i},${j}`) ?? [];
  buildingCount += buildings.length;
  const data = gzipSync(encodeTile({ i, j, ground: { step: STEP, n: N, heights, flags }, buildings, holes, water: waterOf(i, j) }), { level: 9 });
  bytes += data.length;
  writeFileSync(`${OUT}/${tileName(i, j)}`, data);
  written.add(tileName(i, j));
}
// tiles no longer in the city
for (const f of readdirSync(OUT)) if (!written.has(f)) rmSync(`${OUT}/${f}`);

const index: CityIndex = {
  attribution: [groundMeta.attribution, osm.attribution, ...(laser ? [laser.attribution] : [])],
  note: `The city around the line, in ${CITY_TILE} m tiles (format ${CITY_VERSION}, src/city-tile.ts): the ground every ${STEP} m from Lantmäteriet's elevation model, shaped where the track runs, its lakes and sea at their levels, and OpenStreetMap's buildings (extract of ${osm.extract}) as flat-roofed blocks.`,
  tile: CITY_TILE,
  tiles: groundMeta.tiles.map(([i, j]) => [i, j]),
};
writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 1) + '\n');

if (process.env.DEBUG) for (const m of mouths) console.log(`  mouth at ${m.x.toFixed(0)}, ${m.z.toFixed(0)}, rail ${m.y.toFixed(1)}, out towards ${m.tx.toFixed(2)}, ${m.tz.toFixed(2)}`);
console.log(`ground: ${groundMeta.tiles.length} tiles; ${lowered} points lowered under open track, ${raised} raised over tunnels; ${mouths.length} mouths`);
console.log(`water: ${bodyLevels.length} lakes and bays, ${(waterCells * STEP * STEP / 1e6).toFixed(1)} km² (${(filled * STEP * STEP / 1e3).toFixed(0)}k m² filled in from OpenStreetMap's outlines and ${(bridged * STEP * STEP / 1e3).toFixed(0)}k m² within its shores, ${flattened} points of ground brought down to it), at ${[...new Set(bodyLevels)].sort((a, b) => a - b).map((l) => l.toFixed(2)).join(', ')} m`);
console.log(`buildings: ${buildingCount} blocks from ${sources.length} (${withParts} drawn as their parts, ${outside} outside the tiles); heights estimated for ${estimated}`);
if (laser) console.log(`  measured by the laser scan: ${laserMeasured} (of ${Object.keys(laser.buildings).length} it has), ${laserShaped} with the roof's shape it found; left out: ${[...laserDoubted].map(([k, n]) => `${n} ${k}`).join(', ')}`);
console.log(`  roofs of their shapes: ${shaped} built, ${unshaped} left flat (lower than 0.3 m, or no faces found)`);
console.log(`  ${overTrack} over open track (cleared), ${roofsDropped} roofs over the track left out, ${cutForStations} cut for stations, ${sheds} depot halls`);
console.log(`${OUT}: ${(bytes / 1e6).toFixed(1)} MB`);
