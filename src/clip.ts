// Convex volumes, and cutting them out of triangles: how the stations' shafts and passages open
// through the network's tunnel walls, and through each other's floors and ceilings.
// No imports, so the tools can use it on Node too.

// A plane: inside where nx·x + ny·y + nz·z < d.
export interface Plane { nx: number; ny: number; nz: number; d: number }

// The inside of all its planes, with a box around it for quick rejection.
export interface Volume { planes: Plane[]; min: [number, number, number]; max: [number, number, number] }

// Points closer than this to a volume's face count as outside it: a floor lying on the bottom of
// a room is not cut by it.
const EPS = 0.01;

export function insideVolume(v: Volume, x: number, y: number, z: number) {
  if (x < v.min[0] || y < v.min[1] || z < v.min[2] || x > v.max[0] || y > v.max[1] || z > v.max[2]) return false;
  return v.planes.every((p) => p.nx * x + p.ny * y + p.nz * z < p.d - EPS);
}

// The convex volume between a quadrilateral's four vertical sides (corners in order around it, in
// plan) and two planes through it: `bottom` and `top` give their heights at each corner, so they
// may slope (a stair's floor and ceiling).
export function prism(corners: [number, number][], bottom: number[], top: number[]): Volume {
  const planes: Plane[] = [];
  const n = corners.length;
  // the winding, so the side planes face outwards
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % n];
    area += ax * bz - bx * az;
  }
  const w = area > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % n];
    // outward normal in plan
    let nx = (bz - az) * w, nz = (bx - ax) * -w;
    const l = Math.hypot(nx, nz) || 1;
    nx /= l; nz /= l;
    planes.push({ nx, ny: 0, nz, d: nx * ax + nz * az });
  }
  // a plane through three of the corners at the given heights
  const through = (h: number[], up: boolean) => {
    const [p0, p1, p2] = [0, 1, 2].map((i) => [corners[i][0], h[i], corners[i][1]]);
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if ((ny > 0) !== up) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    return { nx, ny, nz, d: nx * p0[0] + ny * p0[1] + nz * p0[2] };
  };
  planes.push(through(top, true), through(bottom, false));
  const xs = corners.map((c) => c[0]), zs = corners.map((c) => c[1]);
  return {
    planes,
    min: [Math.min(...xs), Math.min(...bottom), Math.min(...zs)],
    max: [Math.max(...xs), Math.max(...top), Math.max(...zs)],
  };
}

// A polygon's vertices: x, y, z and then any other attributes (uv, normal), interpolated along
// the cuts.
type Vert = number[];

// The part of a convex polygon on one side of a plane: below (inside) or not.
function clipPoly(poly: Vert[], p: Plane, keepInside: boolean): Vert[] {
  const out: Vert[] = [];
  const f = (v: Vert) => {
    const s = p.nx * v[0] + p.ny * v[1] + p.nz * v[2] - (p.d - EPS);
    return keepInside ? s : -s;
  };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
      const t = fa / (fa - fb);
      out.push(a.map((x, k) => x + (b[k] - x) * t));
    }
  }
  return out.length >= 3 ? out : [];
}

// The convex pieces of a convex polygon outside a volume: the part outside the first plane, then
// the part inside it but outside the second, and so on.
export function subtract(poly: Vert[], v: Volume): Vert[][] {
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of poly) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  if (lo[0] > v.max[0] || lo[1] > v.max[1] || lo[2] > v.max[2] || hi[0] < v.min[0] || hi[1] < v.min[1] || hi[2] < v.min[2]) return [poly];
  const pieces: Vert[][] = [];
  let rest = poly;
  for (const p of v.planes) {
    const outside = clipPoly(rest, p, false);
    if (outside.length) pieces.push(outside);
    rest = clipPoly(rest, p, true);
    if (!rest.length) break;
  }
  return pieces;
}

// The convex pieces of a convex polygon inside a volume.
export function intersect(poly: Vert[], v: Volume): Vert[] {
  let rest = poly;
  for (const p of v.planes) {
    rest = clipPoly(rest, p, true);
    if (!rest.length) break;
  }
  return rest;
}

// A polygon minus every volume.
export function subtractAll(poly: Vert[], vols: Volume[]): Vert[][] {
  let pieces = [poly];
  for (const v of vols) {
    pieces = pieces.flatMap((p) => subtract(p, v));
    if (!pieces.length) break;
  }
  return pieces;
}

// Indexed triangles (`attrs` per vertex, `size` numbers each, starting with x, y, z) minus the
// volumes. Triangles clear of them keep their vertices; cut ones get new vertices, appended.
export function cutIndexed(attrs: number[], size: number, idx: number[], vols: Volume[]) {
  if (!vols.length) return { attrs, idx };
  const outAttrs = attrs.slice(), outIdx: number[] = [];
  const vert = (i: number) => attrs.slice(i * size, i * size + size);
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [idx[t], idx[t + 1], idx[t + 2]];
    const pts = tri.map(vert);
    const near = vols.filter((v) => {
      for (let k = 0; k < 3; k++) {
        if (Math.max(pts[0][k], pts[1][k], pts[2][k]) < v.min[k] || Math.min(pts[0][k], pts[1][k], pts[2][k]) > v.max[k]) return false;
      }
      return true;
    });
    if (!near.length) { outIdx.push(...tri); continue; }
    for (const piece of subtractAll(pts, near)) {
      const first = outAttrs.length / size;
      for (const p of piece) outAttrs.push(...p);
      for (let k = 1; k + 1 < piece.length; k++) outIdx.push(first, first + k, first + k + 1);
    }
  }
  return { attrs: outAttrs, idx: outIdx };
}
