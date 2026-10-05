// The part of the world the city is built for: the square tiles of src/city-tile.ts that come
// within REACH of any track the game draws (public/data/track-geometry.json). The tools that
// fetch the city's ground and buildings and the one that builds its tiles share it.
import { readFileSync } from 'node:fs';
import type { TrackGeometry } from '../../src/track-geometry.ts';
import { CITY_TILE } from '../../src/city-tile.ts';

// how far from the track the city reaches: as far as can be seen from the line, its stations'
// exits and the bridges (the outdoor fog closes in before this)
export const REACH = 1000;

export interface CityArea {
  // the tiles, as [i, j]: the square from (i·CITY_TILE, j·CITY_TILE) to the next, in world x, z
  tiles: [number, number][];
  has(i: number, j: number): boolean;
  // the bounding box of all the tiles, in world x, z
  min: [number, number];
  max: [number, number];
}

export function cityArea(geometryPath = 'public/data/track-geometry.json'): CityArea {
  const geometry: TrackGeometry = JSON.parse(readFileSync(geometryPath, 'utf8'));
  // the track's points, by tile
  const near = new Set<string>();
  const reach = Math.ceil(REACH / CITY_TILE) + 1;
  const pts: [number, number][] = [];
  for (const p of Object.values(geometry.pieces)) p.x.forEach((x, k) => pts.push([x, p.z[k]]));
  const byTile = new Map<string, [number, number][]>();
  for (const [x, z] of pts) {
    const key = `${Math.floor(x / CITY_TILE)},${Math.floor(z / CITY_TILE)}`;
    (byTile.get(key) ?? byTile.set(key, []).get(key)!).push([x, z]);
  }
  for (const key of byTile.keys()) {
    const [ti, tj] = key.split(',').map(Number);
    for (let i = ti - reach; i <= ti + reach; i++) for (let j = tj - reach; j <= tj + reach; j++) near.add(`${i},${j}`);
  }
  const tiles: [number, number][] = [];
  for (const key of near) {
    const [i, j] = key.split(',').map(Number);
    const x0 = i * CITY_TILE, z0 = j * CITY_TILE, x1 = x0 + CITY_TILE, z1 = z0 + CITY_TILE;
    // the distance from the tile's square to the nearest point of the track
    let hit = false;
    for (let a = i - reach; a <= i + reach && !hit; a++) for (let b = j - reach; b <= j + reach && !hit; b++) {
      for (const [x, z] of byTile.get(`${a},${b}`) ?? []) {
        const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
        if (dx * dx + dz * dz < REACH * REACH) { hit = true; break; }
      }
    }
    if (hit) tiles.push([i, j]);
  }
  tiles.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const set = new Set(tiles.map(([i, j]) => `${i},${j}`));
  const min: [number, number] = [Math.min(...tiles.map((t) => t[0])) * CITY_TILE, Math.min(...tiles.map((t) => t[1])) * CITY_TILE];
  const max: [number, number] = [(Math.max(...tiles.map((t) => t[0])) + 1) * CITY_TILE, (Math.max(...tiles.map((t) => t[1])) + 1) * CITY_TILE];
  return { tiles, has: (i, j) => set.has(`${i},${j}`), min, max };
}
