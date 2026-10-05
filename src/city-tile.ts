// The city around the line, as tools/build-city.ts writes it to public/data/city/: square tiles
// CITY_TILE metres across in world coordinates (src/geo.ts), one file each, named <i>_<j>.bin.gz
// for the square from (i·CITY_TILE, j·CITY_TILE) to the next, and an index of them in
// public/data/city/index.json. src/city.ts builds them.
//
// A tile is gzip-compressed binary, little-endian: a header, then sections, each a four-letter
// tag, its length in bytes and its contents (padded to 4 bytes). A reader skips the sections it
// doesn't know, so later layers (roof shapes, streets, water) can be added as new sections
// without breaking the game, and new fields as new sections or a new version.
//
//   header   'TBCT', u16 version, u16 0, i32 i, i32 j
//   'GRND'   the ground: f32 step, u16 n, u16 0, f32 base; n × n heights, row by row from the
//            north-west corner (z = j·CITY_TILE) southwards, each row from west to east, in
//            centimetres as i16 differences (deltaEncode); then (n − 1)² u8 cell flags
//   'BLDG'   buildings: u32 count, then for each: u8 kind, u8 roof shape, u16 rings,
//            f32 bottom, f32 top, f32 roof height, u32 colour (0xRRGGBB, 0: none given), then each
//            ring: u16 points, then the points as i16 x, z in decimetres from the tile's corner.
//            The first ring is the outline, with a positive shoelace area in x, z (clockwise seen
//            from above, north up), the rest are courtyards, the other way round.
//   'HOLE'   holes through the ground: u32 count, then for each: four corners as f32 x, z in
//            metres from the tile's corner, f32 bottom, f32 top. The ground is cut away inside.
//   'DOOR'   the doors of the depots' halls (buildings of kind shed): u32 count, then for each
//            door: u32 building (its index in BLDG), u16 edge (from the outline's point of that
//            index to the next), u16 0, f32 from, f32 to (metres along the edge), f32 top (RH 2000).
//
// It imports nothing, so the tools can use it on Node too.

export const CITY_TILE = 500;
export const CITY_VERSION = 1;

// Cell flags in the ground: where the ground has been shaped for a service's track (lowered under
// open track, raised over shallow tunnels), which isn't walked on. (A depot's isn't flagged.)
export const CELL_TRACK = 1;

export interface Ground {
  step: number;
  n: number;          // samples along each side: CITY_TILE / step + 1
  heights: Float32Array; // metres, RH 2000
  flags: Uint8Array;  // per cell, (n − 1)², row by row
}

// kind: a building; a part of one (OpenStreetMap's building:part, drawn instead of the outline it
// lies in); a roof on posts (building=roof: no walls); a depot's hall the tracks run into (a shed:
// open inside, with doors where the tracks pass through its walls)
export const BUILDING_KINDS = ['building', 'part', 'roof', 'shed'] as const;
export type BuildingKind = typeof BUILDING_KINDS[number];
// roof shapes: only flat ones are built so far; the others are kept for later
export const ROOF_SHAPES = ['flat', 'gabled', 'hipped', 'pyramidal', 'skillion', 'dome', 'onion', 'round', 'gambrel', 'mansard', 'half-hipped'] as const;
export type RoofShape = typeof ROOF_SHAPES[number];

export interface Building {
  kind: BuildingKind;
  roof: RoofShape;
  bottom: number; // the bottom of the walls, RH 2000 (below the ground where it slopes)
  top: number;    // the top of the walls: the roof, for a flat one
  roofHeight: number; // the roof's height above `top`, for other shapes (0 for flat)
  colour: number | null;
  rings: [number, number][][]; // world x, z: the outline anticlockwise, then courtyards
  doors?: Door[];  // a shed's doors
}

// A door in a shed's outline, from its corner `edge` to the next: `from` to `to` metres along that
// wall, from the bottom of the wall up to `top`.
export interface Door { edge: number; from: number; to: number; top: number }

// A hole through the ground: between four corners in plan (in order around it) and two heights,
// such as at a tunnel mouth, where the portal stands.
export interface GroundHole { corners: [number, number][]; bottom: number; top: number }

export interface CityTile { i: number; j: number; ground: Ground | null; buildings: Building[]; holes: GroundHole[] }

export interface CityIndex {
  attribution: string[];
  note: string;
  tile: number;
  tiles: [number, number][];
}

export const tileName = (i: number, j: number) => `${i}_${j}.bin.gz`;

// ------------------------------------------------------------------ heights
// An n × n grid of heights (metres) as centimetres, each the difference from the one before it in
// its row, or for a row's first from the first of the row above, and for the first from `base`.
// The differences are taken between the rounded heights, so no error builds up along a row.
export function deltaEncode(h: ArrayLike<number>, n: number, base: number) {
  const out = new Int16Array(n * n);
  const cm = (k: number) => Math.round((h[k] - base) * 100);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const k = r * n + c;
      const prev = c ? cm(k - 1) : r ? cm(k - n) : 0;
      const d = cm(k) - prev;
      if (d < -32768 || d > 32767) throw new Error(`a step of ${d / 100} m in the ground`);
      out[k] = d;
    }
  }
  return out;
}

export function deltaDecode(d: ArrayLike<number>, n: number, base: number) {
  const out = new Float32Array(n * n);
  let rowStart = 0;
  for (let r = 0; r < n; r++) {
    rowStart += d[r * n];
    let v = rowStart;
    out[r * n] = base + v / 100;
    for (let c = 1; c < n; c++) {
      v += d[r * n + c];
      out[r * n + c] = base + v / 100;
    }
  }
  return out;
}

// ------------------------------------------------------------------ reading
export function decodeTile(buf: ArrayBuffer): CityTile {
  const v = new DataView(buf);
  const magic = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3));
  if (magic !== 'TBCT') throw new Error('not a city tile');
  const version = v.getUint16(4, true);
  if (version > CITY_VERSION) throw new Error(`city tile version ${version} is newer than this game`);
  const i = v.getInt32(8, true), j = v.getInt32(12, true);
  const x0 = i * CITY_TILE, z0 = j * CITY_TILE;
  const tile: CityTile = { i, j, ground: null, buildings: [], holes: [] };
  let p = 16;
  while (p + 8 <= buf.byteLength) {
    const tag = String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3));
    const len = v.getUint32(p + 4, true);
    const s = p + 8;
    if (tag === 'GRND') {
      const step = v.getFloat32(s, true), n = v.getUint16(s + 4, true), base = v.getFloat32(s + 8, true);
      const deltas = new Int16Array(n * n);
      for (let k = 0; k < n * n; k++) deltas[k] = v.getInt16(s + 12 + 2 * k, true);
      const heights = deltaDecode(deltas, n, base);
      const f = s + 12 + 2 * n * n;
      const flags = new Uint8Array(buf.slice(f, f + (n - 1) * (n - 1)));
      tile.ground = { step, n, heights, flags };
    } else if (tag === 'BLDG') {
      let q = s;
      const count = v.getUint32(q, true); q += 4;
      for (let b = 0; b < count; b++) {
        const kind = BUILDING_KINDS[v.getUint8(q)] ?? 'building', roof = ROOF_SHAPES[v.getUint8(q + 1)] ?? 'flat';
        const nr = v.getUint16(q + 2, true);
        const bottom = v.getFloat32(q + 4, true), top = v.getFloat32(q + 8, true), roofHeight = v.getFloat32(q + 12, true);
        const c = v.getUint32(q + 16, true);
        q += 20;
        const rings: [number, number][][] = [];
        for (let r = 0; r < nr; r++) {
          const np = v.getUint16(q, true); q += 2;
          const ring: [number, number][] = [];
          for (let k = 0; k < np; k++) {
            ring.push([x0 + v.getInt16(q, true) / 10, z0 + v.getInt16(q + 2, true) / 10]);
            q += 4;
          }
          rings.push(ring);
        }
        tile.buildings.push({ kind, roof, bottom, top, roofHeight, colour: c ? c : null, rings });
      }
    } else if (tag === 'DOOR') {
      const count = v.getUint32(s, true);
      for (let d = 0, q = s + 4; d < count; d++, q += 20) {
        const b = tile.buildings[v.getUint32(q, true)];
        if (b) (b.doors ??= []).push({ edge: v.getUint16(q + 4, true), from: v.getFloat32(q + 8, true), to: v.getFloat32(q + 12, true), top: v.getFloat32(q + 16, true) });
      }
    } else if (tag === 'HOLE') {
      const count = v.getUint32(s, true);
      for (let h = 0, q = s + 4; h < count; h++, q += 40) {
        const corners: [number, number][] = [];
        for (let c = 0; c < 4; c++) corners.push([x0 + v.getFloat32(q + 8 * c, true), z0 + v.getFloat32(q + 8 * c + 4, true)]);
        tile.holes.push({ corners, bottom: v.getFloat32(q + 32, true), top: v.getFloat32(q + 36, true) });
      }
    }
    p = s + len + ((4 - (len % 4)) % 4);
  }
  return tile;
}

// ------------------------------------------------------------------ writing
export function encodeTile(tile: CityTile): Uint8Array {
  const sections: { tag: string; data: Uint8Array }[] = [];
  const x0 = tile.i * CITY_TILE, z0 = tile.j * CITY_TILE;
  if (tile.ground) {
    const { step, n, heights, flags } = tile.ground;
    let base = Infinity;
    for (const h of heights) base = Math.min(base, h);
    base = Math.floor(base);
    const deltas = deltaEncode(heights, n, base);
    const data = new Uint8Array(12 + 2 * n * n + (n - 1) * (n - 1));
    const v = new DataView(data.buffer);
    v.setFloat32(0, step, true);
    v.setUint16(4, n, true);
    v.setFloat32(8, base, true);
    for (let k = 0; k < n * n; k++) v.setInt16(12 + 2 * k, deltas[k], true);
    data.set(flags, 12 + 2 * n * n);
    sections.push({ tag: 'GRND', data });
  }
  if (tile.buildings.length) {
    let size = 4;
    for (const b of tile.buildings) size += 20 + b.rings.reduce((s, r) => s + 2 + 4 * r.length, 0);
    const data = new Uint8Array(size);
    const v = new DataView(data.buffer);
    let q = 0;
    v.setUint32(q, tile.buildings.length, true); q += 4;
    const dm = (u: number) => Math.max(-32767, Math.min(32767, Math.round(u * 10)));
    for (const b of tile.buildings) {
      v.setUint8(q, BUILDING_KINDS.indexOf(b.kind));
      v.setUint8(q + 1, Math.max(0, ROOF_SHAPES.indexOf(b.roof)));
      v.setUint16(q + 2, b.rings.length, true);
      v.setFloat32(q + 4, b.bottom, true);
      v.setFloat32(q + 8, b.top, true);
      v.setFloat32(q + 12, b.roofHeight, true);
      v.setUint32(q + 16, b.colour ?? 0, true);
      q += 20;
      for (const r of b.rings) {
        v.setUint16(q, r.length, true); q += 2;
        for (const [x, z] of r) {
          v.setInt16(q, dm(x - x0), true);
          v.setInt16(q + 2, dm(z - z0), true);
          q += 4;
        }
      }
    }
    sections.push({ tag: 'BLDG', data });
  }
  const doors = tile.buildings.flatMap((b, k) => (b.doors ?? []).map((d) => ({ k, d })));
  if (doors.length) {
    const data = new Uint8Array(4 + 20 * doors.length);
    const v = new DataView(data.buffer);
    v.setUint32(0, doors.length, true);
    doors.forEach(({ k, d }, n) => {
      const q = 4 + 20 * n;
      v.setUint32(q, k, true);
      v.setUint16(q + 4, d.edge, true);
      v.setFloat32(q + 8, d.from, true);
      v.setFloat32(q + 12, d.to, true);
      v.setFloat32(q + 16, d.top, true);
    });
    sections.push({ tag: 'DOOR', data });
  }
  if (tile.holes.length) {
    const data = new Uint8Array(4 + 40 * tile.holes.length);
    const v = new DataView(data.buffer);
    v.setUint32(0, tile.holes.length, true);
    tile.holes.forEach((h, k) => {
      const q = 4 + 40 * k;
      h.corners.forEach(([x, z], c) => { v.setFloat32(q + 8 * c, x - x0, true); v.setFloat32(q + 8 * c + 4, z - z0, true); });
      v.setFloat32(q + 32, h.bottom, true);
      v.setFloat32(q + 36, h.top, true);
    });
    sections.push({ tag: 'HOLE', data });
  }
  const pad = (n: number) => (4 - (n % 4)) % 4;
  const total = 16 + sections.reduce((s, x) => s + 8 + x.data.length + pad(x.data.length), 0);
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  'TBCT'.split('').forEach((c, k) => v.setUint8(k, c.charCodeAt(0)));
  v.setUint16(4, CITY_VERSION, true);
  v.setInt32(8, tile.i, true);
  v.setInt32(12, tile.j, true);
  let p = 16;
  for (const { tag, data } of sections) {
    tag.split('').forEach((c, k) => v.setUint8(p + k, c.charCodeAt(0)));
    v.setUint32(p + 4, data.length, true);
    out.set(data, p + 8);
    p += 8 + data.length + pad(data.length);
  }
  return out;
}
