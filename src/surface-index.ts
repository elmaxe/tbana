import type { Vector3 } from 'three';

export interface SurfaceHit<T> { y: number; data: T }

interface SurfaceTri<T> {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  cx: number; cy: number; cz: number;
  det: number; data: T;
}

// Uniform XZ grid over triangles, answering "which surfaces are directly above/below (x, z)?".
// Used for player ground checks, wall generation, platform detection and elevators.
export class SurfaceIndex<T> {
  cell: number;
  cells: Map<number, number[]>;
  tris: SurfaceTri<T>[];

  constructor(cellSize = 4) {
    this.cell = cellSize;
    this.cells = new Map();
    this.tris = [];
  }

  key(ix: number, iz: number) {
    return (ix + 50000) * 100000 + (iz + 50000);
  }

  add(a: Vector3, b: Vector3, c: Vector3, data: T) {
    const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(det) < 1e-8) return; // vertical / degenerate in plan view
    const t: SurfaceTri<T> = {
      ax: a.x, ay: a.y, az: a.z,
      bx: b.x, by: b.y, bz: b.z,
      cx: c.x, cy: c.y, cz: c.z,
      det, data,
    };
    const id = this.tris.push(t) - 1;
    const s = this.cell;
    const x0 = Math.floor(Math.min(a.x, b.x, c.x) / s), x1 = Math.floor(Math.max(a.x, b.x, c.x) / s);
    const z0 = Math.floor(Math.min(a.z, b.z, c.z) / s), z1 = Math.floor(Math.max(a.z, b.z, c.z) / s);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = this.key(ix, iz);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(id);
      }
    }
  }

  // Returns every surface crossing the vertical line through (x, z): [{ y, data }, ...]
  query(x: number, z: number, out: SurfaceHit<T>[] = []) {
    out.length = 0;
    const list = this.cells.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!list) return out;
    for (let i = 0; i < list.length; i++) {
      const t = this.tris[list[i]];
      const l1 = ((t.bz - t.cz) * (x - t.cx) + (t.cx - t.bx) * (z - t.cz)) / t.det;
      if (l1 < -1e-6 || l1 > 1 + 1e-6) continue;
      const l2 = ((t.cz - t.az) * (x - t.cx) + (t.ax - t.cx) * (z - t.cz)) / t.det;
      if (l2 < -1e-6 || l2 > 1 + 1e-6) continue;
      const l3 = 1 - l1 - l2;
      if (l3 < -1e-6) continue;
      out.push({ y: l1 * t.ay + l2 * t.by + l3 * t.cy, data: t.data });
    }
    return out;
  }
}
