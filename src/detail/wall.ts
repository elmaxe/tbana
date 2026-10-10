import type { Builder, V3 } from './builder.ts';

// A flat wall with openings cut into it: windows and doors set back in reveals, with sills and
// surrounds where the style has them.

export type OpeningKind = 'win' | 'tall' | 'ground' | 'door' | 'shop';
// along the wall a0 → a1, up b0 → b1
export interface Opening { a0: number; a1: number; b0: number; b1: number; kind: OpeningKind }

export interface WallStyle {
  wall: string;          // material of the wall
  wallTile?: number | [number, number]; // its texture's repeat, metres (along, up)
  reveal?: string;       // of the reveals (the wall's by default)
  trim?: string | null;  // sills and surrounds (none: null)
  depth?: number;        // how far the glass is set back
  surround?: number;     // width of the surround (0: none)
  sill?: boolean;
  flush?: boolean;       // panes only, without reveals or trim
}

const PANE: Record<OpeningKind, string> = { win: 'window', tall: 'window', ground: 'window', door: 'door', shop: 'shop' };

export function wallWithOpenings(B: Builder, o: V3, h: V3, n: V3, W: number, y0: number, y1: number, ops: Opening[], s: WallStyle) {
  const P = (a: number, y: number, d = 0): V3 => [o[0] + h[0] * a + n[0] * d, y, o[2] + h[2] * a + n[2] * d];
  const up: V3 = [0, 1, 0], down: V3 = [0, -1, 0], back: V3 = [-h[0], 0, -h[2]];
  const tile = s.wallTile ?? 4;
  ops = ops.filter((p) => p.a0 >= 0 && p.a1 <= W && p.b0 >= y0 && p.b1 <= y1 && p.a1 > p.a0 && p.b1 > p.b0);
  // the wall itself, as runs of cells between the openings' edges
  const xs = [...new Set([0, W, ...ops.flatMap((p) => [p.a0, p.a1])])].sort((a, b) => a - b);
  const ys = [...new Set([y0, y1, ...ops.flatMap((p) => [p.b0, p.b1])])].sort((a, b) => a - b);
  // which cells are holes: each opening covers a block of them
  const nx = xs.length - 1, holes = new Uint8Array(nx * (ys.length - 1));
  for (const p of ops) {
    const i0 = xs.indexOf(p.a0), i1 = xs.indexOf(p.a1), j0 = ys.indexOf(p.b0), j1 = ys.indexOf(p.b1);
    for (let j = j0; j < j1; j++) holes.fill(1, j * nx + i0, j * nx + i1);
  }
  for (let j = 0; j + 1 < ys.length; j++) {
    const b0 = ys[j], b1 = ys[j + 1];
    let run: number | null = null;
    for (let i = 0; i < nx; i++) {
      const hole = holes[j * nx + i] === 1, last = i + 1 === nx;
      if (!hole && run === null) run = xs[i];
      if ((hole || last) && run !== null) {
        const end = hole ? xs[i] : xs[i + 1];
        if (end > run) B.poly([P(run, b0), P(end, b0), P(end, b1), P(run, b1)], n, s.wall, tile);
        run = null;
      }
    }
  }
  const reveal = s.reveal ?? s.wall, trim = s.trim ?? null, f = s.surround ?? 0;
  for (const { a0, a1, b0, b1, kind } of ops) {
    // flush: only the pane, set in a hair (for walls seen from afar, such as courtyards')
    if (s.flush) {
      pane(B, [P(a0, b1, -0.05), P(a1, b1, -0.05), P(a1, b0, -0.05), P(a0, b0, -0.05)], n, kind, o[0] + o[2] + a0 * 7.3 + b0 * 3.1);
      B.poly([P(a0, b0), P(a1, b0), P(a1, b0, -0.05), P(a0, b0, -0.05)], up, reveal, 2);
      B.poly([P(a0, b1), P(a1, b1), P(a1, b1, -0.05), P(a0, b1, -0.05)], down, reveal, 2);
      continue;
    }
    const d = kind === 'door' || kind === 'shop' ? Math.max(0.3, s.depth ?? 0.25) : s.depth ?? 0.25;
    const rv = (kind === 'tall' || kind === 'door') && trim ? trim : reveal;
    B.poly([P(a0, b0), P(a0, b1), P(a0, b1, -d), P(a0, b0, -d)], h, rv, 2);
    B.poly([P(a1, b0), P(a1, b1), P(a1, b1, -d), P(a1, b0, -d)], back, rv, 2);
    B.poly([P(a0, b1), P(a1, b1), P(a1, b1, -d), P(a0, b1, -d)], down, rv, 2);
    B.poly([P(a0, b0), P(a1, b0), P(a1, b0, -d), P(a0, b0, -d)], up, rv, 2);
    pane(B, [P(a0, b1, -d), P(a1, b1, -d), P(a1, b0, -d), P(a0, b0, -d)], n, kind, o[0] + o[2] + a0 * 7.3 + b0 * 3.1);
    if (!trim) continue;
    if (s.sill !== false && kind !== 'door' && kind !== 'shop') B.wallBox(o, h, n, a0 - 0.12, a1 + 0.12, b0 - 0.1, b0, -0.02, 0.14, trim, 2, ['back', 'left', 'right']);
    if (f > 0 && kind !== 'shop') {
      // the surround: a frame standing a little proud of the wall, its face only
      const w = kind === 'win' ? f * 0.7 : f, top = b1 + w, fd = 0.04;
      B.poly([P(a0 - w, b0, fd), P(a0, b0, fd), P(a0, top, fd), P(a0 - w, top, fd)], n, trim, 2);
      B.poly([P(a1, b0, fd), P(a1 + w, b0, fd), P(a1 + w, top, fd), P(a1, top, fd)], n, trim, 2);
      B.poly([P(a0, b1, fd), P(a1, b1, fd), P(a1, top, fd), P(a0, top, fd)], n, trim, 2);
      if (kind === 'tall' || kind === 'door') B.wallBox(o, h, n, a0 - w - 0.12, a1 + w + 0.12, top, top + 0.18, -0.02, 0.2, trim, 2, ['back']);
    }
  }
}

// A pane, left to right as seen from outside, v = 1 at its top (canvas textures are flipped), in
// its own colours rather than the wall's. A window's is one of the four in its texture, by `seed`.
function pane(B: Builder, pts: V3[], n: V3, kind: OpeningKind, seed: number) {
  const was = B.colour;
  B.tint([1, 1, 1]);
  let u0 = 0, u1 = 1;
  if (PANE[kind] === 'window') {
    const k = Math.floor((Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1) * 4);
    u0 = k / 4; u1 = (k + 1) / 4;
  }
  B.poly(pts, n, PANE[kind], 1, [[u0, 1], [u1, 1], [u1, 0], [u0, 0]]);
  B.tint(was);
}
