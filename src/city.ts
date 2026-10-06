import * as THREE from 'three';
import { CELL_TRACK, CITY_TILE, WALL_STYLES, decodeTile, photoName, tileName } from './city-tile.ts';
import type { Building, CityIndex, CityTile, PhotoIndex, WallStyle } from './city-tile.ts';
import { cutIndexed, insideVolume, prism } from './clip.ts';
import type { Volume } from './clip.ts';
import type { SurfaceHit } from './surface-index';
import * as T from './textures';

// The city around the line, from public/data/city/ (see src/city-tile.ts and tools/build-city.ts):
// the ground, and the buildings as blocks with flat roofs. Tiles are fetched and built as the
// camera comes near, nearest first, and dropped when it leaves. Far tiles get a coarser ground.
//
// Where a tile has an aerial photo (public/data/ortho/, see tools/fetch-ortho.ts), it is laid on
// the ground, with a fine grain over it for up close, and on the roofs from above. Without one, the
// ground is grass or paving by how built up it is, and the roofs are plain.
//
// The ground can be walked on, except beside open track and inside buildings, and the stations'
// stairs and halls are cut out of it where they come up through it. The depots' halls (sheds) are
// open inside: their ground is walked on, and their walls can be walked through only at the doors.

const LOAD = 1100;      // fetch and build tiles whose nearest point is this close
const UNLOAD = 400;     // and drop them this much further away
const FINE = 0.55;      // the full grid within this share of LOAD; every other point beyond
const UNDERGROUND = 3;   // the buildings are hidden with the camera this far under the ground
const SKIRT = 4;        // the ground's edges hang down at most this far, over the seams between tiles
const SKIRT_MARGIN = 0.3;
const FETCHES = 3;      // tiles fetched at once
const FOOT_CELL = 10;   // buildings by cell, for walking
const WALL_REACH = 0.45; // a shed's wall keeps the player this far off

export interface CityFloorData { kind: 'city'; rec: { label: string } }

interface Tile {
  i: number; j: number;
  x0: number; z0: number;
  state: 'idle' | 'fetching' | 'ready' | 'failed';
  data: CityTile | null;
  cuts: Volume[];                  // the holes and the stations' spaces reaching into it
  feet: Map<number, number[]> | null; // buildings standing on the ground, by cell
  walls: Map<number, number[][]> | null; // the sheds' walls (but not their doors), by cell: [ax, az, bx, bz]
  group: THREE.Group | null;
  lod: number;                     // the grid's stride when built
  photo: { texture: THREE.Texture; ground: THREE.Material; roofs: THREE.Material } | null;
}

// Facade colours of the city's buildings by their walls' style where none is given, and of its
// roofs (tin, tar, tiles, copper).
const WALLS: Record<WallStyle, number[]> = {
  plaster: [0xe9dcc0, 0xe4c98f, 0xd9a86a, 0xc98d64, 0xb76b4f, 0xd8cfc4, 0xf1ece2, 0xcbc3b6, 0xe8c9b8, 0xa86450, 0xbfb2a0, 0xdcd3a6],
  brick: [0xa65a42, 0x9b4a3a, 0xb8714f, 0x8a4535, 0xc28a64, 0x9e6a50],
  glass: [0x9fb4c4, 0x8aa0b0, 0xb5c3cc, 0x7f95a3],
  wood: [0x8e2b20, 0x9a3324, 0xd9b65d, 0xe8e4da, 0x9aa38a, 0xc9b79c],
  plain: [0xb8b8b4, 0xa3a7aa, 0xcfcac0, 0x8c9094],
};
const ROOFS = [0x3b3c3e, 0x46484b, 0x2f3134, 0x5b3a2e, 0x7a4636, 0x4f7a68, 0x55585c];
const CEILING = new THREE.Color(0xc4c2bc);
const GRASS = new THREE.Color(0x5c6b40), PAVED = new THREE.Color(0x8a8781), BALLAST = new THREE.Color(0x6e6559);
// the ground texture's average (linear), which its grain over a photo is taken relative to
const GRAIN_MEAN = 0.67, GRAIN = 0.55;
// a photo has the sunlight in it already: it's darkened (linear) before the scene's lights fall on it
const PHOTO_GROUND = 0.6, PHOTO_ROOFS = 0.7;

function hash(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// The ground's underside, seen from the stations and tunnels under it, is as dark as the rock round
// them: it hides the buildings standing on the ground over a station's open-topped halls.
const UNDERSIDE = 0.06;

function materials() {
  const ground = new THREE.MeshStandardMaterial({ map: T.ground(), vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  ground.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
      `#include <dithering_fragment>\n  if (!gl_FrontFacing) gl_FragColor.rgb *= ${UNDERSIDE.toFixed(2)};`);
  };
  return {
    ground,
    walls: {
      plaster: new THREE.MeshStandardMaterial({ map: T.facade(), vertexColors: true, roughness: 0.9 }),
      brick: new THREE.MeshStandardMaterial({ map: T.facadeBrick(), vertexColors: true, roughness: 0.95 }),
      glass: new THREE.MeshStandardMaterial({ map: T.facadeGlass(), vertexColors: true, roughness: 0.35, metalness: 0.2 }),
      wood: new THREE.MeshStandardMaterial({ map: T.facadeWood(), vertexColors: true, roughness: 0.9 }),
      plain: new THREE.MeshStandardMaterial({ map: T.facadePlain(), vertexColors: true, roughness: 0.8 }),
    } satisfies Record<WallStyle, THREE.Material>,
    roofs: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
  };
}

// A tile's photo on its ground, with the ground texture's grain over it (by world x, z, 8 m to a
// repeat), and on its roofs.
function photoMaterials(texture: THREE.Texture, grain: THREE.Texture) {
  const ground = new THREE.MeshStandardMaterial({ map: texture, color: new THREE.Color(PHOTO_GROUND, PHOTO_GROUND, PHOTO_GROUND), roughness: 1, side: THREE.DoubleSide });
  ground.onBeforeCompile = (shader) => {
    shader.uniforms.grainMap = { value: grain };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGrain;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrain = position.xz / 8.0;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGrain;\nuniform sampler2D grainMap;')
      .replace('#include <map_fragment>', `#include <map_fragment>
diffuseColor.rgb *= mix(1.0, texture2D(grainMap, vGrain).r / ${GRAIN_MEAN.toFixed(2)}, ${GRAIN.toFixed(2)});`)
      // its underside as dark as the plain ground's (see materials)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
  if (!gl_FrontFacing) gl_FragColor.rgb *= ${UNDERSIDE.toFixed(2)};`);
  };
  ground.customProgramCacheKey = () => 'city-photo-ground';
  const roofs = new THREE.MeshStandardMaterial({ map: texture, color: new THREE.Color(PHOTO_ROOFS, PHOTO_ROOFS, PHOTO_ROOFS), roughness: 0.85 });
  return { texture, ground, roofs };
}

export class City {
  group = new THREE.Group();
  private tiles = new Map<string, Tile>();
  private mats = materials();
  private floor: CityFloorData = { kind: 'city', rec: { label: 'Street' } };
  private fetching = 0;
  // the tiles with a photo, and the photos' margin round the tile; null until their index is in
  private photos: Map<string, number> | null = null;
  private photoMargin = 0;
  private buildingsShown = true;

  // `cuts`: the volumes cut out of the ground and kept from being walked on: the stations' stairs,
  // lifts and rooms where they come up through it
  // `reach`: how far the city is built round the camera (less on small devices)
  // `photoBase`: where the aerial photos are, or null for none
  constructor(index: CityIndex, private cuts: Volume[] = [], private reach = LOAD, private base = 'data/city/', private photoBase: string | null = 'data/ortho/') {
    this.group.name = 'city';
    for (const [i, j] of index.tiles) {
      this.tiles.set(`${i},${j}`, { i, j, x0: i * CITY_TILE, z0: j * CITY_TILE, state: 'idle', data: null, cuts: [], feet: null, walls: null, group: null, lod: 0, photo: null });
    }
    if (!photoBase) { this.photos = new Map(); return; }
    fetch(photoBase + 'index.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((photos: PhotoIndex | null) => {
        this.photoMargin = photos?.margin ?? 0;
        this.photos = new Map((photos?.tiles ?? []).map(([i, j, size]) => [`${i},${j}`, size]));
      })
      // none there (a dev server answers with its page)
      .catch(() => { this.photos = new Map(); });
  }

  // ---------------------------------------------------------------- loading
  // Fetches the tiles near `pos`, builds one (nearest first) and drops those far away.
  update(pos: THREE.Vector3) {
    // which tiles have photos is known before any is fetched
    if (!this.photos) return;
    let build: { t: Tile; d: number; lod: number } | null = null;
    const want: { t: Tile; d: number }[] = [];
    for (const t of this.tiles.values()) {
      // from the nearest point of the tile
      const dx = Math.max(t.x0 - pos.x, 0, pos.x - t.x0 - CITY_TILE), dz = Math.max(t.z0 - pos.z, 0, pos.z - t.z0 - CITY_TILE);
      const d = Math.hypot(dx, dz);
      if (d > this.reach + UNLOAD) {
        if (t.group) this.drop(t);
        if (t.state === 'ready') { t.state = 'idle'; t.data = null; t.feet = null; t.walls = null; t.cuts = []; this.dropPhoto(t); }
        continue;
      }
      if (d > this.reach) continue;
      if (t.state === 'idle') want.push({ t, d });
      if (t.state !== 'ready') continue;
      // full grid near, half far, with some slack either way
      const fine = this.reach * FINE;
      const lod = d < fine ? 1 : d > fine + 100 ? 2 : t.lod || 2;
      if ((!t.group || t.lod !== lod) && (!build || d < build.d)) build = { t, d, lod };
    }
    want.sort((a, b) => a.d - b.d);
    for (const { t } of want) {
      if (this.fetching >= FETCHES) break;
      this.fetch(t);
    }
    if (build) {
      if (build.t.group) this.drop(build.t);
      build.t.lod = build.lod;
      build.t.group = this.build(build.t);
      this.group.add(build.t.group);
    }
    // Well under the ground, the buildings are hidden: the ground hides them anyway, except for
    // their walls' feet, which reach a little below it, and would show through the stations'
    // open-topped halls.
    const ground = this.heightAt(pos.x, pos.z);
    this.buildingsShown = ground === null || pos.y > ground - UNDERGROUND;
    for (const t of this.tiles.values()) {
      for (const m of t.group?.children ?? []) if (m.userData.building) m.visible = this.buildingsShown;
    }
  }

  get loaded() { return [...this.tiles.values()].filter((t) => t.group).length; }

  private drop(t: Tile) {
    if (!t.group) return;
    this.group.remove(t.group);
    t.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    t.group = null;
  }

  private dropPhoto(t: Tile) {
    if (!t.photo) return;
    const { texture, ground, roofs } = t.photo;
    texture.dispose();
    (texture.image as ImageBitmap).close?.();
    ground.dispose();
    roofs.dispose();
    t.photo = null;
  }

  // A tile's photo, or null where it has none or it can't be had.
  private async fetchPhoto(t: Tile) {
    if (!this.photoBase || !this.photos?.has(`${t.i},${t.j}`)) return null;
    try {
      const res = await fetch(this.photoBase + photoName(t.i, t.j));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bitmap = await createImageBitmap(await res.blob());
      const texture = new THREE.Texture(bitmap);
      // an ImageBitmap is never flipped: its first row (the north) is at v = 0
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      return photoMaterials(texture, this.mats.ground.map!);
    } catch (err) {
      console.warn(`city photo ${t.i},${t.j}:`, err);
      return null;
    }
  }

  private async fetch(t: Tile) {
    t.state = 'fetching';
    this.fetching++;
    const photo = this.fetchPhoto(t);
    try {
      const res = await fetch(this.base + tileName(t.i, t.j));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let buf = await res.arrayBuffer();
      // gzip, unless the server has already unpacked it
      const head = new Uint8Array(buf, 0, 2);
      if (head[0] === 0x1f && head[1] === 0x8b) {
        buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      }
      t.data = decodeTile(buf);
      this.prepare(t);
      t.photo = await photo;
      t.state = 'ready';
    } catch (err) {
      console.warn(`city tile ${t.i},${t.j}:`, err);
      t.state = 'failed';
      t.photo = await photo;
      this.dropPhoto(t);
    } finally {
      this.fetching--;
    }
  }

  // What walking needs: the cuts reaching into the tile, and the buildings standing on the ground
  // by cell.
  private prepare(t: Tile) {
    const d = t.data!, m = 2;
    const x1 = t.x0 + CITY_TILE, z1 = t.z0 + CITY_TILE;
    t.cuts = [
      ...d.holes.map((h) => prism(h.corners, h.corners.map(() => h.bottom), h.corners.map(() => h.top))),
      ...this.cuts.filter((v) => v.max[0] > t.x0 - m && v.min[0] < x1 + m && v.max[2] > t.z0 - m && v.min[2] < z1 + m),
    ];
    t.feet = new Map();
    t.walls = new Map();
    d.buildings.forEach((b, k) => {
      if (b.kind === 'roof') return;
      if (b.kind === 'shed') {
        for (const [ax, az, bx, bz] of shedWalls(b)) {
          for (let i = Math.floor(Math.min(ax, bx) / FOOT_CELL); i <= Math.floor(Math.max(ax, bx) / FOOT_CELL); i++) {
            for (let j = Math.floor(Math.min(az, bz) / FOOT_CELL); j <= Math.floor(Math.max(az, bz) / FOOT_CELL); j++) {
              const key = cellKey(i, j);
              (t.walls!.get(key) ?? t.walls!.set(key, []).get(key)!).push([ax, az, bx, bz]);
            }
          }
        }
        return;
      }
      const g = this.heightIn(t, ...centre(b.rings[0]));
      if (g !== null && b.bottom > g + 2.2) return; // lifted clear: walked under
      const [x0, z0, x1, z1] = bounds(b.rings[0]);
      for (let i = Math.floor(x0 / FOOT_CELL); i <= Math.floor(x1 / FOOT_CELL); i++) {
        for (let j = Math.floor(z0 / FOOT_CELL); j <= Math.floor(z1 / FOOT_CELL); j++) {
          const key = cellKey(i, j);
          (t.feet!.get(key) ?? t.feet!.set(key, []).get(key)!).push(k);
        }
      }
    });
  }

  // ---------------------------------------------------------------- the ground
  private tileAt(x: number, z: number) {
    const t = this.tiles.get(`${Math.floor(x / CITY_TILE)},${Math.floor(z / CITY_TILE)}`);
    return t?.state === 'ready' ? t : null;
  }

  // The ground's height at (x, z) as drawn at full resolution, or null where no tile is loaded.
  heightAt(x: number, z: number) {
    const t = this.tileAt(x, z);
    return t ? this.heightIn(t, x, z) : null;
  }

  private heightIn(t: Tile, x: number, z: number) {
    const g = t.data?.ground;
    if (!g) return null;
    const u = Math.min(g.n - 1.000001, Math.max(0, (x - t.x0) / g.step)), v = Math.min(g.n - 1.000001, Math.max(0, (z - t.z0) / g.step));
    const c = Math.floor(u), r = Math.floor(v), fu = u - c, fv = v - r;
    const k = r * g.n + c, h = g.heights;
    // the cell's two triangles as the mesh has them, split from its north-west corner
    return fu >= fv
      ? h[k] + (h[k + 1] - h[k]) * fu + (h[k + g.n + 1] - h[k + 1]) * fv
      : h[k] + (h[k + g.n] - h[k]) * fv + (h[k + g.n + 1] - h[k + g.n]) * fu;
  }

  // Whether (x, z) is inside a building standing on the ground.
  insideBuilding(x: number, z: number) {
    const t = this.tileAt(x, z) ?? this.tileAt(x + 30, z) ?? this.tileAt(x - 30, z);
    if (!t) return false;
    // buildings belong to the tile their middle is in, so look in the neighbours too
    for (const n of [t, ...this.neighbours(t)]) {
      const list = n.feet?.get(cellKey(Math.floor(x / FOOT_CELL), Math.floor(z / FOOT_CELL)));
      if (!list) continue;
      for (const k of list) {
        const b = n.data!.buildings[k];
        if (inRing(x, z, b.rings[0]) && !b.rings.slice(1).some((r) => inRing(x, z, r))) return true;
      }
    }
    return false;
  }

  // Whether (x, z) is in a shed's wall, which can't be walked through but at its doors.
  private atShedWall(x: number, z: number) {
    const t = this.tileAt(x, z);
    if (!t) return false;
    const key = cellKey(Math.floor(x / FOOT_CELL), Math.floor(z / FOOT_CELL));
    for (const n of [t, ...this.neighbours(t)]) {
      for (const [ax, az, bx, bz] of n.walls?.get(key) ?? []) {
        const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
        const u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
        if (Math.hypot(x - ax - dx * u, z - az - dz * u) < WALL_REACH) return true;
      }
    }
    return false;
  }

  private neighbours(t: Tile) {
    const out: Tile[] = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const n = (a || b) ? this.tiles.get(`${t.i + a},${t.j + b}`) : null;
      if (n?.state === 'ready') out.push(n);
    }
    return out;
  }

  // The ground to walk on at (x, z): none beside open track, inside buildings, or in a hole.
  floorsAt(x: number, z: number, out: SurfaceHit<CityFloorData>[] = []) {
    out.length = 0;
    const t = this.tileAt(x, z);
    const g = t?.data?.ground;
    if (!t || !g) return out;
    const c = Math.min(g.n - 2, Math.floor((x - t.x0) / g.step)), r = Math.min(g.n - 2, Math.floor((z - t.z0) / g.step));
    if (g.flags[r * (g.n - 1) + c] & CELL_TRACK) return out;
    const y = this.heightIn(t, x, z)!;
    if (t.cuts.some((v) => insideVolume(v, x, y + 0.05, z))) return out;
    if (this.insideBuilding(x, z) || this.atShedWall(x, z)) return out;
    out.push({ y, data: this.floor });
    return out;
  }

  // Whether someone at (x, y, z) is out on the city's ground (1); null where it doesn't say.
  outdoorsAt(x: number, y: number, z: number) {
    const h = this.heightAt(x, z);
    return h !== null && y > h - 0.5 && y < h + 6 ? 1 : null;
  }

  // ---------------------------------------------------------------- building
  private build(t: Tile) {
    const group = new THREE.Group();
    group.name = `city ${t.i},${t.j}`;
    const d = t.data!;
    if (d.ground) group.add(new THREE.Mesh(this.groundGeometry(t), t.photo?.ground ?? this.mats.ground));
    const { walls, roofs, plain } = buildingGeometry(d.buildings, t, t.photo ? this.photoUv(t) : null);
    const meshes: [THREE.BufferGeometry | null, THREE.Material][] = [
      ...WALL_STYLES.map((st) => [walls[st], this.mats.walls[st]] as [THREE.BufferGeometry | null, THREE.Material]),
      [roofs, t.photo?.roofs ?? this.mats.roofs], [plain, this.mats.roofs],
    ];
    for (const [geom, mat] of meshes) {
      if (!geom) continue;
      const m = new THREE.Mesh(geom, mat);
      m.userData.building = true;
      m.visible = this.buildingsShown;
      group.add(m);
    }
    return group;
  }

  // Where (x, z) is in the tile's photo, or, without one, in the ground texture's repeat.
  private photoUv(t: Tile): (x: number, z: number) => [number, number] {
    if (!t.photo) return (x, z) => [x / 8, z / 8];
    const m = this.photoMargin, span = CITY_TILE + 2 * m;
    return (x, z) => [(x - t.x0 + m) / span, (z - t.z0 + m) / span];
  }

  private groundGeometry(t: Tile) {
    const g = t.data!.ground!, s = t.lod, n = g.n;
    const cols = Math.floor((n - 1) / s) + 1;
    // how much of the ground round each point is built on: paved in town, grass beyond
    const cover = coverage(t.data!.buildings, t, g.step, n);
    const pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [];
    const c = new THREE.Color(), toUv = this.photoUv(t);
    for (let r = 0; r < n; r += s) {
      for (let k = 0; k < n; k += s) {
        const x = t.x0 + k * g.step, z = t.z0 + r * g.step, y = g.heights[r * n + k];
        pos.push(x, y, z);
        uv.push(...toUv(x, z));
        // beside open track: the cells round the point
        let track = false;
        for (const [a, b] of [[r - 1, k - 1], [r - 1, k], [r, k - 1], [r, k]]) {
          if (a >= 0 && b >= 0 && a < n - 1 && b < n - 1 && g.flags[a * (n - 1) + b] & CELL_TRACK) track = true;
        }
        c.copy(GRASS).lerp(PAVED, THREE.MathUtils.smoothstep(cover[r * n + k], 0.03, 0.18));
        if (track) c.lerp(BALLAST, 0.45);
        const v = 0.92 + 0.16 * hash((x * 73856093) ^ (z * 19349663));
        col.push(c.r * v, c.g * v, c.b * v);
      }
    }
    const rows = pos.length / 3 / cols;
    for (let i = 0; i + 1 < rows; i++) {
      for (let j = 0; j + 1 < cols; j++) {
        const a = i * cols + j, b = a + 1, cc = a + cols + 1, dd = a + cols;
        idx.push(a, dd, cc, a, cc, b);
      }
    }
    // skirts down from the edges, over any crack against a neighbour built at another stride: as
    // deep as the ground changes from one point to the next along the edge, which is as far as a
    // crack can open (and no deeper, so they don't hang down into a shallow tunnel)
    const edge = (list: number[], outward: boolean) => {
      const first = pos.length / 3;
      for (const [k, v] of list.entries()) {
        const y = pos[3 * v + 1];
        let drop = 0;
        for (const w of [list[k - 1], list[k + 1]]) if (w !== undefined) drop = Math.max(drop, Math.abs(pos[3 * w + 1] - y));
        const depth = Math.min(SKIRT, drop + SKIRT_MARGIN);
        pos.push(pos[3 * v], y - depth, pos[3 * v + 2]);
        uv.push(uv[2 * v], uv[2 * v + 1] + (t.photo ? 0 : depth / 8));
        col.push(col[3 * v], col[3 * v + 1], col[3 * v + 2]);
      }
      for (let k = 0; k + 1 < list.length; k++) {
        const a = list[k], b = list[k + 1], a2 = first + k, b2 = first + k + 1;
        if (outward) idx.push(a, a2, b2, a, b2, b); else idx.push(a, b2, a2, a, b, b2);
      }
    };
    const range = (n0: number, step: number, count: number) => Array.from({ length: count }, (_, k) => n0 + k * step);
    edge(range(0, 1, cols), true);                          // north
    edge(range((rows - 1) * cols, 1, cols), false);          // south
    edge(range(0, cols, rows), false);                       // west
    edge(range(cols - 1, cols, rows), true);                 // east
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    if (!t.cuts.length) {
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geom.computeBoundingSphere();
      return geom;
    }
    // the holes cut out, after the normals are found
    const nrm = geom.attributes.normal.array, attrs: number[] = [];
    for (let v = 0; v < pos.length / 3; v++) {
      attrs.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2], uv[2 * v], uv[2 * v + 1], nrm[3 * v], nrm[3 * v + 1], nrm[3 * v + 2], col[3 * v], col[3 * v + 1], col[3 * v + 2]);
    }
    const cut = cutIndexed(attrs, 11, idx, t.cuts);
    const count = cut.attrs.length / 11;
    const P = new Float32Array(count * 3), U = new Float32Array(count * 2), Nn = new Float32Array(count * 3), C = new Float32Array(count * 3);
    for (let v = 0; v < count; v++) {
      const a = cut.attrs, o = 11 * v;
      P[3 * v] = a[o]; P[3 * v + 1] = a[o + 1]; P[3 * v + 2] = a[o + 2];
      U[2 * v] = a[o + 3]; U[2 * v + 1] = a[o + 4];
      Nn[3 * v] = a[o + 5]; Nn[3 * v + 1] = a[o + 6]; Nn[3 * v + 2] = a[o + 7];
      C[3 * v] = a[o + 8]; C[3 * v + 1] = a[o + 9]; C[3 * v + 2] = a[o + 10];
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(P, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    out.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
    out.setAttribute('color', new THREE.BufferAttribute(C, 3));
    out.setIndex(cut.idx);
    out.computeBoundingSphere();
    return out;
  }
}

// ------------------------------------------------------------------ buildings
const BAY = 3, STOREY = 3.1;

// The walls, by style; the roofs seen from above, with `toUv` placing them in the tile's photo;
// and, plain, the undersides of roofs and of buildings standing clear of the ground, and the roofs
// where there is no photo or they reach out of it. A roof of its shape stands on walls that rise
// into its gables; any other is flat (a pitched one halfway up).
function buildingGeometry(buildings: Building[], t: Tile, toUv: ((x: number, z: number) => [number, number]) | null) {
  const buf = () => ({ pos: [] as number[], uv: [] as number[], col: [] as number[], idx: [] as number[] });
  const w = Object.fromEntries(WALL_STYLES.map((st) => [st, buf()])) as Record<WallStyle, ReturnType<typeof buf>>;
  const r = buf(), pl = buf();
  const c = new THREE.Color(), roofC = new THREE.Color();
  buildings.forEach((b, k) => {
    const seed = hash(t.i * 92821 + t.j * 68917 + k * 7919);
    const style = b.wall ?? 'plaster', palette = WALLS[style];
    if (b.colour !== null) c.setHex(b.colour).lerp(new THREE.Color(0xd8d2c8), 0.35);
    else c.setHex(palette[Math.floor(seed * palette.length)]);
    c.multiplyScalar(0.94 + 0.1 * hash(k * 31 + 7));
    roofC.setHex(b.roofColour ?? ROOFS[Math.floor(hash(k * 131 + t.i) * ROOFS.length)]);
    const mesh = b.roofMesh;
    // the eaves (or a flat roof halfway up a pitched one)
    const top = mesh ? b.top : b.top + b.roofHeight / 2;
    const bottom = b.kind === 'roof' ? top - 0.4 : b.bottom;
    // the walls, facing out from the outline and into the courtyards (a shed's also facing in,
    // and with its doors left open up to their tops); under a roof of its shape, up to it
    const shed = b.kind === 'shed';
    const roofLike = b.kind === 'roof';
    const wb = roofLike ? w.plaster : w[style];
    const shade = roofLike ? roofC : c;
    const rings: [number, number, number][][] = mesh?.tops.length ? mesh.tops : b.rings.map((ring) => ring.map(([x, z]) => [x, z, 0]));
    for (const [ri, ring] of rings.entries()) {
      let along = 0;
      for (let e = 0; e < ring.length; e++) {
        const [ax, az, ya] = ring[e], [bx, bz, yb] = ring[(e + 1) % ring.length];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.01) continue;
        // the stretches of wall: [from, to, bottom] along the edge
        const parts: [number, number, number][] = [];
        const doors = shed && ri === 0 ? (b.doors ?? []).filter((d) => d.edge === e) : [];
        let at = 0;
        for (const d of doors) {
          if (d.from > at) parts.push([at, d.from, bottom]);
          if (d.top < top) parts.push([d.from, d.to, d.top]);
          at = d.to;
        }
        if (at < len) parts.push([at, len, bottom]);
        for (const [f0, f1, y0] of parts) {
          const x0 = ax + ((bx - ax) * f0) / len, z0 = az + ((bz - az) * f0) / len, x1 = ax + ((bx - ax) * f1) / len, z1 = az + ((bz - az) * f1) / len;
          const t0 = top + ya + ((yb - ya) * f0) / len, t1 = top + ya + ((yb - ya) * f1) / len;
          // u in bays along the wall, v in storeys down from the eaves (up into a gable)
          const u0 = Math.round(along / BAY * 4) / 4 + f0 / BAY, u1 = Math.round(along / BAY * 4) / 4 + f1 / BAY;
          for (const inner of shed ? [false, true] : [false]) {
            const v0 = wb.pos.length / 3;
            const kk = inner ? 0.75 : 1;
            for (const [x, y, z, u] of [[x0, y0, z0, u0], [x1, y0, z1, u1], [x1, t1, z1, u1], [x0, t0, z0, u0]]) {
              wb.pos.push(x, y, z);
              wb.uv.push(roofLike ? 0.02 : u, roofLike ? 0.02 : -(top - y) / STOREY);
              wb.col.push(shade.r * kk, shade.g * kk, shade.b * kk);
            }
            // outward is to the left of a → b for a positive shoelace outline: (dz, −dx); the
            // quad is wound to face it (or, inside a shed, the other way)
            if (inner) wb.idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
            else wb.idx.push(v0, v0 + 2, v0 + 1, v0, v0 + 3, v0 + 2);
          }
        }
        along += len;
      }
    }
    const inPhoto = (pts: { x: number; y: number }[]) => !!toUv && pts.every((p) => {
      const [a, b2] = toUv(p.x, p.y);
      return a >= 0 && a <= 1 && b2 >= 0 && b2 <= 1;
    });
    // a roof of its shape: each triangle on its own, so its faces are shaded flat
    if (mesh) {
      const photo = inPhoto(mesh.points.map(([x, z]) => ({ x, y: z })));
      const m = photo ? r : pl;
      for (let q = 0; q < mesh.triangles.length; q++) {
        const [x, z, y] = mesh.points[mesh.triangles[q]];
        m.idx.push(m.pos.length / 3);
        m.pos.push(x, top + y, z);
        m.col.push(roofC.r, roofC.g, roofC.b);
        if (photo) m.uv.push(...toUv!(x, z));
      }
    }
    // the flat roof, and an underside where the building stands clear of the ground
    const contour = b.rings[0].map(([x, z]) => new THREE.Vector2(x, z));
    const holes = b.rings.slice(1).map((ring) => ring.map(([x, z]) => new THREE.Vector2(x, z)));
    let faces: number[][];
    try { faces = THREE.ShapeUtils.triangulateShape(contour, holes); } catch { return; }
    const pts = [...contour, ...holes.flat()];
    const under = b.kind === 'part' || b.kind === 'roof';
    // a shed's roof seen from inside it
    const flat: (readonly [number, boolean])[] = under ? [[top, true], [bottom, false]] : shed ? [[top, true], [top - 0.05, false]] : [[top, true]];
    const photo = inPhoto(pts);
    for (const [y, up] of flat) {
      if (up && mesh) continue;
      const toPhoto = up && photo;
      const m = toPhoto ? r : pl;
      const v0 = m.pos.length / 3;
      // (a shed's ceiling a light grey)
      const rc = shed && !up ? CEILING : roofC;
      for (const p of pts) {
        m.pos.push(p.x, y, p.y);
        m.col.push(rc.r, rc.g, rc.b);
        if (toPhoto) m.uv.push(...toUv!(p.x, p.y));
      }
      for (const f of faces) {
        // wound to face up (or down): the normal's y is dz₁·dx₂ − dx₁·dz₂
        const [a, b2, c2] = f.map((q) => pts[q]);
        const ny = (b2.y - a.y) * (c2.x - a.x) - (b2.x - a.x) * (c2.y - a.y);
        if ((ny > 0) === up) m.idx.push(v0 + f[0], v0 + f[1], v0 + f[2]);
        else m.idx.push(v0 + f[0], v0 + f[2], v0 + f[1]);
      }
    }
  });
  const make = (m: ReturnType<typeof buf>, uv: boolean) => {
    if (!m.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(m.col, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(m.uv, 2));
    g.setIndex(m.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };
  const walls = Object.fromEntries(WALL_STYLES.map((st) => [st, make(w[st], true)])) as Record<WallStyle, THREE.BufferGeometry | null>;
  return { walls, roofs: make(r, true), plain: make(pl, false) };
}

// A shed's walls as segments [ax, az, bx, bz], leaving out its doors.
function shedWalls(b: Building) {
  const out: number[][] = [];
  const ring = b.rings[0];
  for (let e = 0; e < ring.length; e++) {
    const [ax, az] = ring[e], [bx, bz] = ring[(e + 1) % ring.length];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.01) continue;
    const at = (f: number) => [ax + ((bx - ax) * f) / len, az + ((bz - az) * f) / len];
    let from = 0;
    for (const d of (b.doors ?? []).filter((q) => q.edge === e).sort((p, q) => p.from - q.from)) {
      if (d.from > from) out.push([...at(from), ...at(d.from)]);
      from = d.to;
    }
    if (from < len) out.push([...at(from), ...at(len)]);
  }
  for (const ring2 of b.rings.slice(1)) {
    for (let e = 0; e < ring2.length; e++) out.push([...ring2[e], ...ring2[(e + 1) % ring2.length]]);
  }
  return out;
}

// For each point of the tile's grid, the share of the ground within about 35 m that is built on.
function coverage(buildings: Building[], t: Tile, step: number, n: number) {
  const built = new Float32Array(n * n);
  for (const b of buildings) {
    if (b.kind === 'roof') continue;
    const [x0, z0, x1, z1] = bounds(b.rings[0]);
    const c0 = Math.max(0, Math.ceil((x0 - t.x0) / step)), c1 = Math.min(n - 1, Math.floor((x1 - t.x0) / step));
    const r0 = Math.max(0, Math.ceil((z0 - t.z0) / step)), r1 = Math.min(n - 1, Math.floor((z1 - t.z0) / step));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (inRing(t.x0 + c * step, t.z0 + r * step, b.rings[0])) built[r * n + c] = 1;
    }
  }
  // a box average over 15 × 15 points, by summed areas
  const sum = new Float32Array((n + 1) * (n + 1));
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    sum[(r + 1) * (n + 1) + c + 1] = built[r * n + c] + sum[r * (n + 1) + c + 1] + sum[(r + 1) * (n + 1) + c] - sum[r * (n + 1) + c];
  }
  const R = 7, out = new Float32Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const a = Math.max(0, r - R), b = Math.min(n, r + R + 1), e = Math.max(0, c - R), f = Math.min(n, c + R + 1);
    out[r * n + c] = (sum[b * (n + 1) + f] - sum[a * (n + 1) + f] - sum[b * (n + 1) + e] + sum[a * (n + 1) + e]) / ((b - a) * (f - e));
  }
  return out;
}

// ------------------------------------------------------------------ plan helpers
const cellKey = (i: number, j: number) => (i + 50000) * 100000 + (j + 50000);

function bounds(ring: [number, number][]) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of ring) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  return [x0, z0, x1, z1];
}

function centre(ring: [number, number][]): [number, number] {
  const [x0, z0, x1, z1] = bounds(ring);
  return [(x0 + x1) / 2, (z0 + z1) / 2];
}

function inRing(x: number, z: number, ring: [number, number][]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
