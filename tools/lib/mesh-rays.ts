// Rays cast at pieces of Google's mesh (tools/lib/google-tiles.ts): the triangles over a box in a
// grid of cells, and the nearest of them along a ray, with the colour of the photo there.
import type { Piece } from './google-tiles.ts';

export type RGB = [number, number, number];
export interface Hit { t: number; y: number; rgb: RGB; flat: number }

// `box` world x0, z0, x1, z1: the rays are looked for in the cells over it, `cell` metres across
export function meshRays(pieces: Piece[], [X0, Z0, X1, Z1]: [number, number, number, number], CELL = 3) {
  const GX = X0, GZ = Z0, GW = Math.ceil((X1 - X0) / CELL), GH = Math.ceil((Z1 - Z0) / CELL);
  function cellsOf(pc: Piece, t: number, f: (c: number) => void) {
    const xs = [0, 1, 2].map((k) => pc.pos[3 * pc.idx[t + k]]), zs = [0, 1, 2].map((k) => pc.pos[3 * pc.idx[t + k] + 2]);
    const c0 = Math.max(0, Math.floor((Math.min(...xs) - GX) / CELL)), c1 = Math.min(GW - 1, Math.floor((Math.max(...xs) - GX) / CELL));
    const r0 = Math.max(0, Math.floor((Math.min(...zs) - GZ) / CELL)), r1 = Math.min(GH - 1, Math.floor((Math.max(...zs) - GZ) / CELL));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) f(r * GW + c);
  }
  const start = new Uint32Array(GW * GH + 1);
  for (const pc of pieces) for (let t = 0; t < pc.idx.length; t += 3) cellsOf(pc, t, (c) => start[c + 1]++);
  for (let c = 0; c < GW * GH; c++) start[c + 1] += start[c];
  const refPiece = new Uint16Array(start[GW * GH]), refTri = new Uint32Array(start[GW * GH]), fill = start.slice();
  pieces.forEach((pc, p) => {
    for (let t = 0; t < pc.idx.length; t += 3) cellsOf(pc, t, (c) => { refPiece[fill[c]] = p; refTri[fill[c]] = t; fill[c]++; });
  });

  // The nearest of the mesh along o + t·d, 0 < t < far: how far, its height, its colour and how
  // level it is (|normal's y|).
  function ray(o: number[], d: number[], far: number): Hit | null {
    const cells = new Set<number>();
    for (let s = 0; s <= far; s += 0.5) {
      const c = Math.floor((o[0] + d[0] * s - GX) / CELL), r = Math.floor((o[2] + d[2] * s - GZ) / CELL);
      if (c >= 0 && r >= 0 && c < GW && r < GH) cells.add(r * GW + c);
      if (!d[0] && !d[2]) break;
    }
    let best: Hit | null = null, near = far;
    for (const c of cells) for (let k = start[c]; k < start[c + 1]; k++) {
      const pc = pieces[refPiece[k]], t = refTri[k], p = pc.pos;
      const ia = pc.idx[t], ib = pc.idx[t + 1], ic = pc.idx[t + 2], a = 3 * ia, b = 3 * ib, cc = 3 * ic;
      // Möller and Trumbore
      const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], e2 = [p[cc] - p[a], p[cc + 1] - p[a + 1], p[cc + 2] - p[a + 2]];
      const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
      const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
      if (Math.abs(det) < 1e-9) continue;
      const s = [o[0] - p[a], o[1] - p[a + 1], o[2] - p[a + 2]];
      const u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
      if (u < 0 || u > 1) continue;
      const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
      const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
      if (v < 0 || u + v > 1) continue;
      const tt = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
      if (tt <= 0 || tt >= near) continue;
      near = tt;
      const w = 1 - u - v;
      const U = w * pc.uv[2 * ia] + u * pc.uv[2 * ib] + v * pc.uv[2 * ic], V = w * pc.uv[2 * ia + 1] + u * pc.uv[2 * ib + 1] + v * pc.uv[2 * ic + 1];
      const { width: tw, height: th, data } = pc.img;
      const i = 4 * (Math.min(th - 1, Math.max(0, Math.floor(V * th))) * tw + Math.min(tw - 1, Math.max(0, Math.floor(U * tw))));
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      best = { t: tt, y: o[1] + d[1] * tt, rgb: [data[i], data[i + 1], data[i + 2]], flat: Math.abs(n[1]) / (Math.hypot(n[0], n[1], n[2]) || 1) };
    }
    return best;
  }
  return { ray };
}
