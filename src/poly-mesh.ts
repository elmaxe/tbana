import * as THREE from 'three';
import { subtractAll } from './clip.ts';
import type { Volume } from './clip.ts';

// Triangle meshes built polygon by polygon, cut by volumes as they go, and a few solids to build
// them from (src/stations.ts, src/open-stations.ts).

type XYZ = [number, number, number];

// Triangles with uvs, for one material; each polygon is cut by the given volumes as it is added.
// The materials are double-sided, so polygons may face either way.
export class Mesh {
  pos: number[] = [];
  uv: number[] = [];
  get empty() { return this.pos.length === 0; }
  // a convex polygon of [x, y, z, u, v] vertices, minus the volumes
  poly(verts: number[][], cut: Volume[] = []) {
    for (const piece of subtractAll(verts, cut)) {
      for (let k = 1; k + 1 < piece.length; k++) {
        for (const v of [piece[0], piece[k], piece[k + 1]]) { this.pos.push(v[0], v[1], v[2]); this.uv.push(v[3], v[4]); }
      }
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

// A box `sx` across, `sy` high and `sz` along the direction (fx, fz), centred at c.
export function box(m: Mesh, c: XYZ, fx: number, fz: number, sx: number, sy: number, sz: number, cut: Volume[] = []) {
  const rx = -fz, rz = fx;
  const P = (i: number, j: number, k: number) => [c[0] + rx * i * sx / 2 + fx * k * sz / 2, c[1] + j * sy / 2, c[2] + rz * i * sx / 2 + fz * k * sz / 2];
  const faces = [
    [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1]],
    [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]], [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]],
    [[-1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, 1]], [[1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, -1]],
  ];
  for (const f of faces) m.poly(f.map(([i, j, k], n) => [...P(i, j, k), n === 1 || n === 2 ? 1 : 0, n >= 2 ? 1 : 0]), cut);
}

// A solid whose faces join the rectangle round `a` to the rectangle round `b`: each `w` across
// (along (−fz, fx)) and `d` deep (along (fx, fz)).
export function taper(m: Mesh, a: XYZ, b: XYZ, wa: [number, number], wb: [number, number], fx: number, fz: number, cut: Volume[] = []) {
  const rx = -fz, rz = fx;
  const P = (c: XYZ, [w, d]: [number, number], i: number, k: number) => [c[0] + rx * i * w / 2 + fx * k * d / 2, c[1], c[2] + rz * i * w / 2 + fz * k * d / 2];
  const ring: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let n = 0; n < 4; n++) {
    const [i0, k0] = ring[n], [i1, k1] = ring[(n + 1) % 4];
    m.poly([[...P(a, wa, i0, k0), 0, 0], [...P(a, wa, i1, k1), 1, 0], [...P(b, wb, i1, k1), 1, 1], [...P(b, wb, i0, k0), 0, 1]], cut);
  }
  m.poly(ring.map(([i, k]) => [...P(a, wa, i, k), (i + 1) / 2, (k + 1) / 2]), cut);
  m.poly(ring.map(([i, k]) => [...P(b, wb, i, k), (i + 1) / 2, (k + 1) / 2]), cut);
}

// A beam `w` wide hanging `d` deep under the line from a to b.
export function bar(m: Mesh, a: XYZ, b: XYZ, w: number, d: number, cut: Volume[] = []) {
  const l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1, rx = -(b[2] - a[2]) / l * w / 2, rz = (b[0] - a[0]) / l * w / 2;
  const P = (c: XYZ, i: number, j: number) => [c[0] + rx * i, c[1] - d * j, c[2] + rz * i];
  const faces: [XYZ, number, number][][] = [
    [[a, -1, 0], [a, 1, 0], [b, 1, 0], [b, -1, 0]], [[a, -1, 1], [b, -1, 1], [b, 1, 1], [a, 1, 1]],
    [[a, -1, 0], [b, -1, 0], [b, -1, 1], [a, -1, 1]], [[a, 1, 0], [a, 1, 1], [b, 1, 1], [b, 1, 0]],
    [[a, -1, 0], [a, -1, 1], [a, 1, 1], [a, 1, 0]], [[b, -1, 0], [b, 1, 0], [b, 1, 1], [b, -1, 1]],
  ];
  for (const f of faces) m.poly(f.map(([c, i, j], n) => [...P(c, i, j), n === 1 || n === 2 ? 1 : 0, n >= 2 ? 1 : 0]), cut);
}

// A slab under the quadrilateral `top` (corners in order round it), `thick` deep; its uvs `scale`
// to the metre.
export function slab(m: Mesh, top: XYZ[], thick: number, scale = 1, cut: Volume[] = []) {
  const lo = top.map((c): XYZ => [c[0], c[1] - thick, c[2]]);
  const uv = (c: XYZ) => [c[0] * scale, c[2] * scale];
  m.poly(top.map((c) => [...c, ...uv(c)]), cut);
  m.poly(lo.map((c) => [...c, ...uv(c)]), cut);
  for (let i = 0; i < top.length; i++) {
    const j = (i + 1) % top.length, l = Math.hypot(top[j][0] - top[i][0], top[j][2] - top[i][2]) * scale;
    m.poly([[...lo[i], 0, 0], [...lo[j], l, 0], [...top[j], l, thick * scale], [...top[i], 0, thick * scale]], cut);
  }
}
