import * as THREE from 'three';

// A small mesh builder for the detailed buildings (src/detail/): triangles by material, flat
// shaded unless built smooth, with uvs in metres over a repeat of `tile` metres and a colour per
// vertex (the materials' textures are near white, so the colour tints them).

export type V3 = [number, number, number];
export type V2 = [number, number];

// a growing array of floats (or of indices), cheaper to fill than a number[]
class Grow<A extends Float32Array | Uint32Array> {
  length = 0;
  a: A;
  constructor(a: A) { this.a = a; }
  private room(k: number) {
    if (this.length + k <= this.a.length) return;
    const b = new (this.a.constructor as new (n: number) => A)(Math.max(this.a.length * 2, this.length + k));
    b.set(this.a);
    this.a = b;
  }
  push2(x: number, y: number) { this.room(2); this.a[this.length++] = x; this.a[this.length++] = y; }
  push3(x: number, y: number, z: number) { this.room(3); this.a[this.length++] = x; this.a[this.length++] = y; this.a[this.length++] = z; }
  array() { return this.a.slice(0, this.length) as A; }
}
interface Part { pos: Grow<Float32Array>; nrm: Grow<Float32Array>; uv: Grow<Float32Array>; col: Grow<Float32Array>; idx: Grow<Uint32Array> }

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const unit = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const UP: V3 = [0, 1, 0];

export class Builder {
  parts = new Map<string, Part>();
  colour: [number, number, number] = [1, 1, 1];
  // model to world: a turn about y and a shift
  private cos = 1; private sin = 0; private at: V3 = [0, 0, 0];

  place(at: V3, turn: number) { this.at = at; this.cos = Math.cos(turn); this.sin = Math.sin(turn); }
  tint(hex: number | [number, number, number]) {
    if (Array.isArray(hex)) { this.colour = hex; return; }
    const c = new THREE.Color(hex);
    this.colour = [c.r, c.g, c.b];
  }

  private part(mat: string) {
    let p = this.parts.get(mat);
    if (!p) this.parts.set(mat, p = { pos: new Grow(new Float32Array(3072)), nrm: new Grow(new Float32Array(3072)), uv: new Grow(new Float32Array(2048)), col: new Grow(new Float32Array(3072)), idx: new Grow(new Uint32Array(3072)) });
    return p;
  }
  private push(p: Part, v: V3, n: V3, uv: V2) {
    // three.js's rotation.y: x' = x cos + z sin, z' = −x sin + z cos
    const c = this.cos, s = this.sin, at = this.at, col = this.colour;
    p.pos.push3(at[0] + v[0] * c + v[2] * s, at[1] + v[1], at[2] - v[0] * s + v[2] * c);
    p.nrm.push3(n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c);
    p.uv.push2(uv[0], uv[1]);
    p.col.push3(col[0], col[1], col[2]);
  }

  // A convex polygon facing `normal` (the winding is fixed to suit), with uvs given or planar.
  poly(pts: V3[], normal: V3, mat: string, tile: number | V2 = 4, uvs?: V2[]) {
    const n = unit(normal), p = this.part(mat);
    uvs ??= planarUv(pts, n, tile);
    const b = p.pos.length / 3, m = pts.length;
    for (let k = 0; k < m; k++) this.push(p, pts[k], n, uvs[k]);
    // wound to face n: as given, or the other way round
    const flip = dot(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])), n) < 0;
    for (let k = 1; k + 1 < m; k++) {
      if (flip) p.idx.push3(b, b + k + 1, b + k);
      else p.idx.push3(b, b + k, b + k + 1);
    }
  }

  // Triangles over shared points, all facing `normal`.
  tris(pts: V3[], tris: number[][], normal: V3, mat: string, tile = 4) {
    const n = unit(normal), p = this.part(mat), b = p.pos.length / 3;
    const uvs = planarUv(pts, n, tile);
    pts.forEach((v, k) => this.push(p, v, n, uvs[k]));
    for (const t of tris) {
      const ok = dot(cross(sub(pts[t[1]], pts[t[0]]), sub(pts[t[2]], pts[t[0]])), n) >= 0;
      p.idx.push3(b + t[0], b + (ok ? t[1] : t[2]), b + (ok ? t[2] : t[1]));
    }
  }

  // Triangles (wound to face out) with a normal and a uv at each corner: smooth shaded.
  mesh(pts: V3[], nrm: V3[], uvs: V2[], tris: number[], mat: string) {
    const p = this.part(mat), b = p.pos.length / 3;
    pts.forEach((v, k) => this.push(p, v, nrm[k], uvs[k]));
    for (let k = 0; k + 2 < tris.length; k += 3) p.idx.push3(b + tris[k], b + tris[k + 1], b + tris[k + 2]);
  }

  // An axis-aligned box, leaving out the faces in `skip` ('+x', '-y', ...).
  box(lo: V3, hi: V3, mat: string, tile = 2, skip: string[] = []) {
    const [x0, y0, z0] = lo, [x1, y1, z1] = hi;
    const F: [string, V3[], V3][] = [
      ['+x', [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]],
      ['-x', [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0]],
      ['+y', [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]],
      ['-y', [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]],
      ['+z', [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]],
      ['-z', [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]],
    ];
    for (const [k, pts, n] of F) if (!skip.includes(k)) this.poly(pts, n, mat, tile);
  }

  // A box set on a wall: from `o` along `h` (a0 → a1), out along `n` (d0 → d1), y0 → y1.
  wallBox(o: V3, h: V3, n: V3, a0: number, a1: number, y0: number, y1: number, d0: number, d1: number, mat: string, tile = 2, skip: string[] = []) {
    const P = (a: number, y: number, d: number): V3 => [o[0] + h[0] * a + n[0] * d, y, o[2] + h[2] * a + n[2] * d];
    const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]];
    const F: [string, V3[], V3][] = [
      ['front', [P(a0, y0, d1), P(a1, y0, d1), P(a1, y1, d1), P(a0, y1, d1)], n],
      ['back', [P(a0, y0, d0), P(a1, y0, d0), P(a1, y1, d0), P(a0, y1, d0)], neg(n)],
      ['top', [P(a0, y1, d0), P(a1, y1, d0), P(a1, y1, d1), P(a0, y1, d1)], UP],
      ['bottom', [P(a0, y0, d0), P(a1, y0, d0), P(a1, y0, d1), P(a0, y0, d1)], [0, -1, 0]],
      ['left', [P(a0, y0, d0), P(a0, y1, d0), P(a0, y1, d1), P(a0, y0, d1)], neg(h)],
      ['right', [P(a1, y0, d0), P(a1, y1, d0), P(a1, y1, d1), P(a1, y0, d1)], h],
    ];
    for (const [k, pts, nn] of F) if (!skip.includes(k)) this.poly(pts, nn, mat, tile);
  }

  // A lathe about (cx, cz): `prof` is [radius, y] from the bottom up; smooth round, `seg` sides.
  lathe(cx: number, cz: number, prof: V2[], mat: string, seg = 16, tile = 2) {
    const p = this.part(mat);
    for (let k = 0; k + 1 < prof.length; k++) {
      const [r0, y0] = prof[k], [r1, y1] = prof[k + 1];
      if (Math.abs(y1 - y0) < 1e-9 && Math.abs(r1 - r0) < 1e-9) continue;
      const l = Math.hypot(y1 - y0, r0 - r1), dr = (y1 - y0) / l, dy = (r0 - r1) / l;
      const b = p.pos.length / 3;
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), u = (a * Math.max(r0, r1, 0.3)) / tile;
        this.push(p, [cx + r0 * c, y0, cz + r0 * s], [dr * c, dy, dr * s], [u, -y0 / tile]);
        this.push(p, [cx + r1 * c, y1, cz + r1 * s], [dr * c, dy, dr * s], [u, -y1 / tile]);
      }
      for (let j = 0; j < seg; j++) {
        const i0 = b + 2 * j;
        // counter-clockwise seen from outside
        p.idx.push3(i0, i0 + 1, i0 + 3); p.idx.push3(i0, i0 + 3, i0 + 2);
      }
    }
  }

  // A closed outline swept with a profile [out, y] going up; flat-shaded strips, `skip` edges left out.
  sweep(poly: V2[], prof: V2[], mat: string, tile = 2, skip: number[] = []) {
    const rings = prof.map(([d]) => offset(poly, d)), N = outward(poly), n = poly.length;
    for (let k = 0; k + 1 < prof.length; k++) {
      const [d0, y0] = prof[k], [d1, y1] = prof[k + 1];
      for (let i = 0; i < n; i++) {
        if (skip.includes(i)) continue;
        const a0 = rings[k][i], b0 = rings[k][(i + 1) % n], a1 = rings[k + 1][i], b1 = rings[k + 1][(i + 1) % n];
        const nn: V3 = [N[i][0] * (y1 - y0), d0 - d1, N[i][1] * (y1 - y0)];
        if (Math.hypot(...nn) < 1e-9) continue;
        this.poly([[a0[0], y0, a0[1]], [b0[0], y0, b0[1]], [b1[0], y1, b1[1]], [a1[0], y1, a1[1]]], nn, mat, tile);
      }
    }
  }

  // Walls of an outline from y0 to y1, and its top (flat), triangulated.
  prism(poly: V2[], y0: number, y1: number, mat: string, { walls = true, cap = true, capMat = mat, tile = 4 } = {}) {
    const N = outward(poly), n = poly.length;
    if (walls) {
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n];
        this.poly([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [N[i][0], 0, N[i][1]], mat, tile);
      }
    }
    if (cap) this.cap(poly, y1, capMat, tile);
  }
  cap(poly: V2[], y: number, mat: string, tile = 4, down = false) {
    const tris = THREE.ShapeUtils.triangulateShape(poly.map(([x, z]) => new THREE.Vector2(x, z)), []);
    this.tris(poly.map(([x, z]) => [x, y, z]), tris, [0, down ? -1 : 1, 0], mat, tile);
  }

  // A hipped roof over a rectangle, its ridge along x.
  hipped([u0, u1, v0, v1]: number[], y0: number, y1: number, mat: string, over = 0) {
    u0 -= over; u1 += over; v0 -= over; v1 += over;
    const hw = (v1 - v0) / 2, vc = (v0 + v1) / 2;
    const r0: V3 = [u0 + hw, y1, vc], r1: V3 = [u1 - hw, y1, vc];
    const A: V3 = [u0, y0, v0], B: V3 = [u1, y0, v0], C: V3 = [u1, y0, v1], D: V3 = [u0, y0, v1];
    const face = (pts: V3[], down: V3) => {
      let n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
      if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
      // seams run down the slope
      const side: V3 = unit(cross(UP, down));
      this.poly(pts, n, mat, 4, pts.map((p) => [dot(p, side) / 4, dot(p, down) / 4]));
    };
    face([A, B, r1, r0], [0, 0, -1]); face([C, D, r0, r1], [0, 0, 1]); face([B, C, r1], [1, 0, 0]); face([D, A, r0], [-1, 0, 0]);
  }

  triangles() { let n = 0; for (const p of this.parts.values()) n += p.idx.length / 3; return n; }

  geometries() {
    const out = new Map<string, THREE.BufferGeometry>();
    for (const [mat, p] of this.parts) {
      if (!p.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p.pos.array(), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(p.nrm.array(), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(p.uv.array(), 2));
      g.setAttribute('color', new THREE.BufferAttribute(p.col.array(), 3));
      const idx = p.idx.array();
      g.setIndex(new THREE.BufferAttribute(p.pos.length / 3 > 65535 ? idx : Uint16Array.from(idx), 1));
      g.computeBoundingSphere();
      out.set(mat, g);
    }
    return out;
  }
}

// uvs in metres: on a wall along it and up, on a floor or roof by x and z
function planarUv(pts: V3[], n: V3, tile: number | V2): V2[] {
  const [tu, tv] = typeof tile === 'number' ? [tile, tile] : tile;
  let ax: V3, ay: V3;
  if (Math.abs(n[1]) > 0.95) { ax = [1, 0, 0]; ay = [0, 0, 1]; }
  else { ax = unit(cross(UP, n)); ay = Math.abs(n[1]) < 0.05 ? UP : unit(cross(n, ax)); }
  return pts.map((p) => [dot(p, ax) / tu, dot(p, ay) / tv]);
}

// the outward normal (x, z) of each edge i → i + 1 of an outline
export function outward(poly: V2[]): V2[] {
  let area = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
  return poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const e: V2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    return area > 0 ? [e[1], -e[0]] : [-e[1], e[0]];
  });
}

// an outline moved out by d (mitred)
export function offset(poly: V2[], d: number): V2[] {
  const N = outward(poly);
  return poly.map((p, i) => {
    const n1 = N[(i - 1 + poly.length) % poly.length], n2 = N[i];
    const k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    const m: V2 = k < 0.15 ? [n2[0], n2[1]] : [(n1[0] + n2[0]) / k, (n1[1] + n2[1]) / k];
    return [p[0] + m[0] * d, p[1] + m[1] * d];
  });
}
