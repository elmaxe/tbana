// The city around the line, as tools/build-city.ts writes it to public/data/city/: square tiles
// CITY_TILE metres across in world coordinates (src/geo.ts), one file each, named <i>_<j>.bin.gz
// for the square from (i·CITY_TILE, j·CITY_TILE) to the next, and an index of them in
// public/data/city/index.json. src/city.ts builds them.
//
// A tile is gzip-compressed binary, little-endian: a header, then sections, each a four-letter
// tag, its length in bytes and its contents (padded to 4 bytes). A reader skips the sections it
// doesn't know, so later layers can be added as new sections without breaking the game, and new
// fields as new sections or a new version.
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
//   'LOOK'   how the buildings look, one for each in BLDG: u32 roof colour (0xRRGGBB, 0: none
//            given), u8 wall style (WALL_STYLES), u8 0, u16 0.
//   'ROOF'   roofs of their shapes (tools/lib/roofs.ts): u32 count, then for each: u32 building,
//            u16 points, u16 triangles, u16 rings, u16 0; the points as i16 x, z in decimetres from
//            the tile's corner and u16 y in centimetres above the building's top (the eaves); the
//            triangles as u16 × 3, wound to face up; then the walls' tops under the roof, each ring
//            of the outline as u16 points and its points as the roof's. A building with no roof here
//            has a flat one.
//   'WATR'   the water over the ground: u16 count, u16 0, then count f32 levels (RH 2000), then
//            (n − 1)² u8, a cell of GRND's each, row by row as its flags: 0 for dry, else 1 + the
//            index of the level the water stands at over it. A cell on the shore has the water too,
//            so the shore is drawn where the ground rises out of it.
//   'STRT'   streets and paths, in the areas drawn in detail (src/detail/areas.ts): u32 count, then
//            for each: u8 kind (STREET_KINDS), u8 surface (SURFACES), u8 flags (STREET_ONEWAY, …),
//            u8 lanes (0: not given), u16 width in centimetres (0: not given), u16 points, then the
//            points as i16 x, z in decimetres from the tile's corner. A street over the tile's edge
//            is in each tile it crosses, with its segments in that tile and one either side of them
//            (for the corners); a tile draws those whose middles are in it.
//   'PAVE'   squares and other paved areas there: u32 count, then for each: u8 kind, u8 surface,
//            u16 rings, then the rings as BLDG's (the outline, then holes in it). One over the
//            tile's edge is in each tile it reaches into, whole; a tile draws its part.
//   'TREE'   trees there: u32 count, then for each: i16 x, z in decimetres from the tile's corner,
//            u16 height over the ground in centimetres, u8 crown radius in decimetres, u8 0.
//
// It imports nothing, so the tools can use it on Node too.

export const CITY_TILE = 500;
export const CITY_VERSION = 1;

// Cell flags in the ground: where the ground has been shaped for a service's track (lowered under
// open track, raised over shallow tunnels), which isn't walked on (a depot's isn't flagged); and
// where it is paved though few buildings stand round it, such as a quay (data/ground-corrections.json).
export const CELL_TRACK = 1;
export const CELL_PAVED = 2;

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

// how the walls are drawn: plastered (the default), brick, glass, wooden boards, or plain (sheds,
// warehouses)
export const WALL_STYLES = ['plaster', 'brick', 'glass', 'wood', 'plain'] as const;
export type WallStyle = typeof WALL_STYLES[number];

export interface Building {
  kind: BuildingKind;
  roof: RoofShape;
  bottom: number; // the bottom of the walls, RH 2000 (below the ground where it slopes)
  top: number;    // the top of the walls: the roof, for a flat one
  roofHeight: number; // the roof's height above `top`, for other shapes (0 for flat)
  colour: number | null;
  rings: [number, number][][]; // world x, z: the outline anticlockwise, then courtyards
  doors?: Door[];  // a shed's doors
  roofColour?: number | null;
  wall?: WallStyle;
  roofMesh?: RoofMesh; // a roof of its shape; without one, the roof is flat
}

// A roof over a building, from its top (the eaves) up: points in world x, z and y above the top,
// triangles of them wound to face up, and the tops of the walls under it, ring by ring of the
// outline: level at the eaves and rising into the gables.
export interface RoofMesh {
  points: [number, number, number][];
  triangles: number[];
  tops: [number, number, number][][];
}

// A door in a shed's outline, from its corner `edge` to the next: `from` to `to` metres along that
// wall, from the bottom of the wall up to `top`.
export interface Door { edge: number; from: number; to: number; top: number }

// A hole through the ground: between four corners in plan (in order around it) and two heights,
// such as at a tunnel mouth, where the portal stands.
export interface GroundHole { corners: [number, number][]; bottom: number; top: number }

// The lakes and the sea over the ground: the levels they stand at, and for each cell of the
// ground's which of them (0: none, k: levels[k − 1]).
export interface Water { levels: number[]; cells: Uint8Array }

// The streets, paths and squares, and the trees, in the areas drawn in detail (src/detail/streets.ts
// draws them), from OpenStreetMap (tools/fetch-streets.ts) and the laser scan (tools/find-trees.ts).
// kind: OpenStreetMap's highway=* (the links as their roads, the rest 'other'); surface: its
// surface=*, a few alike taken together (unknown where not given)
export const STREET_KINDS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service',
  'living_street', 'pedestrian', 'footway', 'cycleway', 'path', 'steps', 'track', 'other'] as const;
export type StreetKind = typeof STREET_KINDS[number];
export const SURFACES = ['unknown', 'asphalt', 'sett', 'cobblestone', 'paving_stones', 'concrete', 'gravel', 'wood', 'other'] as const;
export type Surface = typeof SURFACES[number];
// a street's flags: one way only; a pavement beside a road (footway=sidewalk); a path across a road
// (footway=crossing), and with stripes on it (a zebra crossing)
export const STREET_ONEWAY = 1, STREET_SIDEWALK = 2, STREET_CROSSING = 4, STREET_ZEBRA = 8;

export interface Street {
  kind: StreetKind;
  surface: Surface;
  flags: number;
  lanes: number;  // 0: not given
  width: number;  // metres, 0: not given
  line: [number, number][]; // world x, z
}
export interface Square { kind: StreetKind; surface: Surface; rings: [number, number][][] }
export interface Tree { x: number; z: number; height: number; radius: number } // height over the ground

export interface CityTile {
  i: number; j: number; ground: Ground | null; buildings: Building[]; holes: GroundHole[]; water?: Water | null;
  streets?: Street[]; squares?: Square[]; trees?: Tree[];
}

export interface CityIndex {
  attribution: string[];
  note: string;
  tile: number;
  tiles: [number, number][];
}

export const tileName = (i: number, j: number) => `${i}_${j}.bin.gz`;

// ------------------------------------------------------------------ aerial photos
// The aerial photo over each tile, as tools/fetch-ortho.ts writes it to public/data/ortho/: a JPEG
// named <i>_<j>.jpg, square, north up, covering the tile and PHOTO_MARGIN beyond each side of it
// (so a roof that reaches over the tile's edge is still in it), and an index of them in
// public/data/ortho/index.json. The game lays it on the ground and the roofs.
export const PHOTO_MARGIN = CITY_TILE / 16;

export interface PhotoIndex {
  attribution: string[];
  note: string;
  margin: number;
  tiles: [number, number, number][]; // i, j, and the photo's size in pixels
}

export const photoName = (i: number, j: number) => `${i}_${j}.jpg`;

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
    } else if (tag === 'LOOK') {
      tile.buildings.forEach((b, k) => {
        if (8 * k + 8 > len) return;
        const c = v.getUint32(s + 8 * k, true);
        b.roofColour = c ? c : null;
        b.wall = WALL_STYLES[v.getUint8(s + 8 * k + 4)] ?? 'plaster';
      });
    } else if (tag === 'ROOF') {
      const count = v.getUint32(s, true);
      let q = s + 4;
      const point = (): [number, number, number] => {
        const pt: [number, number, number] = [x0 + v.getInt16(q, true) / 10, z0 + v.getInt16(q + 2, true) / 10, v.getUint16(q + 4, true) / 100];
        q += 6;
        return pt;
      };
      for (let r = 0; r < count; r++) {
        const b = tile.buildings[v.getUint32(q, true)];
        const np = v.getUint16(q + 4, true), nt = v.getUint16(q + 6, true), nr = v.getUint16(q + 8, true);
        q += 12;
        const mesh: RoofMesh = { points: [], triangles: [], tops: [] };
        for (let k = 0; k < np; k++) mesh.points.push(point());
        for (let k = 0; k < 3 * nt; k++, q += 2) mesh.triangles.push(v.getUint16(q, true));
        for (let k = 0; k < nr; k++) {
          const n = v.getUint16(q, true);
          q += 2;
          const ring: [number, number, number][] = [];
          for (let m = 0; m < n; m++) ring.push(point());
          mesh.tops.push(ring);
        }
        if (b) b.roofMesh = mesh;
      }
    } else if (tag === 'HOLE') {
      const count = v.getUint32(s, true);
      for (let h = 0, q = s + 4; h < count; h++, q += 40) {
        const corners: [number, number][] = [];
        for (let c = 0; c < 4; c++) corners.push([x0 + v.getFloat32(q + 8 * c, true), z0 + v.getFloat32(q + 8 * c + 4, true)]);
        tile.holes.push({ corners, bottom: v.getFloat32(q + 32, true), top: v.getFloat32(q + 36, true) });
      }
    } else if (tag === 'WATR') {
      const count = v.getUint16(s, true), levels: number[] = [];
      for (let k = 0; k < count; k++) levels.push(v.getFloat32(s + 4 + 4 * k, true));
      const f = s + 4 + 4 * count;
      tile.water = { levels, cells: new Uint8Array(buf.slice(f, s + len)) };
    } else if (tag === 'STRT') {
      const count = v.getUint32(s, true);
      let q = s + 4;
      tile.streets = [];
      for (let k = 0; k < count; k++) {
        const np = v.getUint16(q + 6, true);
        const street: Street = {
          kind: STREET_KINDS[v.getUint8(q)] ?? 'other', surface: SURFACES[v.getUint8(q + 1)] ?? 'unknown',
          flags: v.getUint8(q + 2), lanes: v.getUint8(q + 3), width: v.getUint16(q + 4, true) / 100, line: [],
        };
        q += 8;
        for (let m = 0; m < np; m++, q += 4) street.line.push([x0 + v.getInt16(q, true) / 10, z0 + v.getInt16(q + 2, true) / 10]);
        tile.streets.push(street);
      }
    } else if (tag === 'PAVE') {
      const count = v.getUint32(s, true);
      let q = s + 4;
      tile.squares = [];
      for (let k = 0; k < count; k++) {
        const nr = v.getUint16(q + 2, true);
        const square: Square = { kind: STREET_KINDS[v.getUint8(q)] ?? 'other', surface: SURFACES[v.getUint8(q + 1)] ?? 'unknown', rings: [] };
        q += 4;
        for (let r = 0; r < nr; r++) {
          const np = v.getUint16(q, true), ring: [number, number][] = [];
          q += 2;
          for (let m = 0; m < np; m++, q += 4) ring.push([x0 + v.getInt16(q, true) / 10, z0 + v.getInt16(q + 2, true) / 10]);
          square.rings.push(ring);
        }
        tile.squares.push(square);
      }
    } else if (tag === 'TREE') {
      const count = v.getUint32(s, true);
      tile.trees = [];
      for (let k = 0, q = s + 4; k < count; k++, q += 8) {
        tile.trees.push({ x: x0 + v.getInt16(q, true) / 10, z: z0 + v.getInt16(q + 2, true) / 10, height: v.getUint16(q + 4, true) / 100, radius: v.getUint8(q + 6) / 10 });
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
  if (tile.buildings.some((b) => b.roofColour || (b.wall && b.wall !== 'plaster'))) {
    const data = new Uint8Array(8 * tile.buildings.length);
    const v = new DataView(data.buffer);
    tile.buildings.forEach((b, k) => {
      v.setUint32(8 * k, b.roofColour ?? 0, true);
      v.setUint8(8 * k + 4, Math.max(0, WALL_STYLES.indexOf(b.wall ?? 'plaster')));
    });
    sections.push({ tag: 'LOOK', data });
  }
  const roofs = tile.buildings.flatMap((b, k) => (b.roofMesh ? [{ k, m: b.roofMesh }] : []));
  if (roofs.length) {
    let size = 4;
    for (const { m } of roofs) size += 12 + 6 * m.points.length + 6 * (m.triangles.length / 3) + m.tops.reduce((t, r) => t + 2 + 6 * r.length, 0);
    const data = new Uint8Array(size);
    const v = new DataView(data.buffer);
    const dm = (u: number) => Math.max(-32767, Math.min(32767, Math.round(u * 10)));
    let q = 0;
    const point = ([x, z, y]: [number, number, number]) => {
      v.setInt16(q, dm(x - x0), true);
      v.setInt16(q + 2, dm(z - z0), true);
      v.setUint16(q + 4, Math.max(0, Math.min(65535, Math.round(y * 100))), true);
      q += 6;
    };
    v.setUint32(q, roofs.length, true); q += 4;
    for (const { k, m } of roofs) {
      v.setUint32(q, k, true);
      v.setUint16(q + 4, m.points.length, true);
      v.setUint16(q + 6, m.triangles.length / 3, true);
      v.setUint16(q + 8, m.tops.length, true);
      q += 12;
      m.points.forEach(point);
      for (const t of m.triangles) { v.setUint16(q, t, true); q += 2; }
      for (const r of m.tops) {
        v.setUint16(q, r.length, true); q += 2;
        r.forEach(point);
      }
    }
    sections.push({ tag: 'ROOF', data });
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
  if (tile.water?.levels.length) {
    const { levels, cells } = tile.water;
    const data = new Uint8Array(4 + 4 * levels.length + cells.length);
    const v = new DataView(data.buffer);
    v.setUint16(0, levels.length, true);
    levels.forEach((l, k) => v.setFloat32(4 + 4 * k, l, true));
    data.set(cells, 4 + 4 * levels.length);
    sections.push({ tag: 'WATR', data });
  }
  const dm = (u: number) => Math.max(-32767, Math.min(32767, Math.round(u * 10)));
  if (tile.streets?.length) {
    const data = new Uint8Array(4 + tile.streets.reduce((t, st) => t + 8 + 4 * st.line.length, 0));
    const v = new DataView(data.buffer);
    v.setUint32(0, tile.streets.length, true);
    let q = 4;
    for (const st of tile.streets) {
      v.setUint8(q, Math.max(0, STREET_KINDS.indexOf(st.kind)));
      v.setUint8(q + 1, Math.max(0, SURFACES.indexOf(st.surface)));
      v.setUint8(q + 2, st.flags);
      v.setUint8(q + 3, Math.min(255, st.lanes));
      v.setUint16(q + 4, Math.min(65535, Math.round(st.width * 100)), true);
      v.setUint16(q + 6, st.line.length, true);
      q += 8;
      for (const [x, z] of st.line) { v.setInt16(q, dm(x - x0), true); v.setInt16(q + 2, dm(z - z0), true); q += 4; }
    }
    sections.push({ tag: 'STRT', data });
  }
  if (tile.squares?.length) {
    const data = new Uint8Array(4 + tile.squares.reduce((t, sq) => t + 4 + sq.rings.reduce((u, r) => u + 2 + 4 * r.length, 0), 0));
    const v = new DataView(data.buffer);
    v.setUint32(0, tile.squares.length, true);
    let q = 4;
    for (const sq of tile.squares) {
      v.setUint8(q, Math.max(0, STREET_KINDS.indexOf(sq.kind)));
      v.setUint8(q + 1, Math.max(0, SURFACES.indexOf(sq.surface)));
      v.setUint16(q + 2, sq.rings.length, true);
      q += 4;
      for (const r of sq.rings) {
        v.setUint16(q, r.length, true); q += 2;
        for (const [x, z] of r) { v.setInt16(q, dm(x - x0), true); v.setInt16(q + 2, dm(z - z0), true); q += 4; }
      }
    }
    sections.push({ tag: 'PAVE', data });
  }
  if (tile.trees?.length) {
    const data = new Uint8Array(4 + 8 * tile.trees.length);
    const v = new DataView(data.buffer);
    v.setUint32(0, tile.trees.length, true);
    tile.trees.forEach((t, k) => {
      const q = 4 + 8 * k;
      v.setInt16(q, dm(t.x - x0), true);
      v.setInt16(q + 2, dm(t.z - z0), true);
      v.setUint16(q + 4, Math.max(0, Math.min(65535, Math.round(t.height * 100))), true);
      v.setUint8(q + 6, Math.max(0, Math.min(255, Math.round(t.radius * 10))));
    });
    sections.push({ tag: 'TREE', data });
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
