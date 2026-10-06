// A building's height and roof from the laser's points on it: which of the roofs tools/lib/roofs.ts
// builds over its outline fits them best, and how high its eaves and ridge are.
//
// Each roof shape over an outline is one surface, scaled: a hipped or gabled roof h m high is the
// one 1 m high, h times over. So for each shape (and way round, or direction) the unit roof's
// height f at each point is found, and the points' heights are fitted as eaves + h · f by least
// squares, twice more without the worst sixth of the points (trees over the roof, chimneys, a
// crane, birds). A flat roof is the same with h = 0. The shape whose fit is closest wins if it is
// clearly closer than flat's, and its roof is high enough to tell: else the roof is flat.
import { buildRoof } from './roofs.ts';
import type { RoofShape } from '../../src/city-tile.ts';

type XZ = [number, number];

export interface LaserRoof {
  eaves: number;           // the walls' top, metres in RH 2000
  top: number;             // the roof's top (the eaves for a flat roof)
  shape: RoofShape;
  across?: boolean;        // a gabled roof's ridge across the wings
  direction?: number;      // a skillion roof's slope faces this way (compass degrees)
  rms: number;             // how far the points kept are from the roof, metres
}

const KEEP = 5 / 6;
// a roof that isn't flat must be at least this high, and fit this much better than flat
const MIN_PITCH = 1.2, BETTER = 0.65, FLAT_ENOUGH = 0.35;
// outlines smaller than this (m²), or with fewer points, are only measured, as flat
const MIN_AREA = 30, MIN_POINTS = 12;

// The unit roof's height at each point (NaN where it has none).
function unitHeights(rings: XZ[][], shape: RoofShape, opts: { across?: boolean; direction?: number }, px: Float64Array, pz: Float64Array) {
  const roof = buildRoof(rings, shape, 1, opts);
  if (!roof) return null;
  const f = new Float64Array(px.length).fill(NaN);
  const P = roof.points, T = roof.triangles;
  for (let t = 0; t < T.length; t += 3) {
    const [ax, az, ah] = P[T[t]], [bx, bz, bh] = P[T[t + 1]], [cx, cz, ch] = P[T[t + 2]];
    const x0 = Math.min(ax, bx, cx), x1 = Math.max(ax, bx, cx), z0 = Math.min(az, bz, cz), z1 = Math.max(az, bz, cz);
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-9) continue;
    for (let k = 0; k < px.length; k++) {
      const x = px[k], z = pz[k];
      if (x < x0 || x > x1 || z < z0 || z > z1 || !Number.isNaN(f[k])) continue;
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det;
      const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det;
      const w = 1 - u - v;
      if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
      f[k] = u * ah + v * bh + w * ch;
    }
  }
  return f;
}

// eaves + h · f fitted to the heights y, trimmed: the eaves, h, and the kept points' rms
function fit(f: Float64Array | null, y: Float32Array | Float64Array) {
  const idx: number[] = [];
  for (let k = 0; k < y.length; k++) if (!f || !Number.isNaN(f[k])) idx.push(k);
  if (idx.length < Math.max(4, y.length * 0.7)) return null;
  let keep = idx, e = 0, h = 0;
  for (let pass = 0; pass < 3; pass++) {
    let n = 0, sf = 0, sy = 0, sff = 0, sfy = 0;
    for (const k of keep) {
      const fk = f ? f[k] : 0;
      n++; sf += fk; sy += y[k]; sff += fk * fk; sfy += fk * y[k];
    }
    const den = n * sff - sf * sf;
    if (f && Math.abs(den) > 1e-9) { h = (n * sfy - sf * sy) / den; e = (sy - h * sf) / n; } else { h = 0; e = sy / n; }
    if (pass === 2) break;
    const res = idx.map((k) => ({ k, r: Math.abs(y[k] - e - h * (f ? f[k] : 0)) })).sort((a, b) => a.r - b.r);
    keep = res.slice(0, Math.max(4, Math.round(res.length * KEEP))).map((q) => q.k);
  }
  let ss = 0;
  for (const k of keep) { const r = y[k] - e - h * (f ? f[k] : 0); ss += r * r; }
  return { e, h, rms: Math.sqrt(ss / keep.length) };
}

// The compass bearing (degrees) a slope faces, from a direction in world x (east), z (south).
const bearingOf = (dx: number, dz: number) => ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;

// The roof that fits the points (world x, z and heights in RH 2000) inside the outline best.
export function fitRoof(rings: XZ[][], area: number, px: Float64Array, pz: Float64Array, py: Float32Array): LaserRoof | null {
  if (px.length < 4) return null;
  const flat = fit(null, py)!;
  const best: LaserRoof = { eaves: flat.e, top: flat.e, shape: 'flat', rms: flat.rms };
  if (area < MIN_AREA || px.length < MIN_POINTS || flat.rms < FLAT_ENOUGH) return best;

  // the skillion's four ways: square to the longest edge, and along it
  let lx = 1, lz = 0, ll = 0;
  const outer = rings[0];
  for (let k = 0; k < outer.length; k++) {
    const [ax, az] = outer[k], [bx, bz] = outer[(k + 1) % outer.length], l = Math.hypot(bx - ax, bz - az);
    if (l > ll) { ll = l; lx = (bx - ax) / l; lz = (bz - az) / l; }
  }
  const b0 = bearingOf(-lz, lx);
  const tries: { shape: RoofShape; across?: boolean; direction?: number }[] = [
    { shape: 'gabled' }, { shape: 'gabled', across: true }, { shape: 'hipped' }, { shape: 'pyramidal' },
    ...[0, 90, 180, 270].map((d) => ({ shape: 'skillion' as RoofShape, direction: (b0 + d) % 360 })),
  ];
  let pick: (LaserRoof & { h: number }) | null = null;
  for (const t of tries) {
    const f = unitHeights(rings, t.shape, t, px, pz);
    const r = fit(f, py);
    if (!r || r.h < MIN_PITCH) continue;
    if (!pick || r.rms < pick.rms) pick = { eaves: r.e, top: r.e + r.h, h: r.h, rms: r.rms, ...t };
  }
  if (!pick || pick.rms > BETTER * flat.rms) return best;
  const { h: _, ...roof } = pick;
  return roof;
}
