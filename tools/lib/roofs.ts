// Roofs of OpenStreetMap's shapes (Simple 3D Buildings: roof:shape, roof:height, roof:orientation,
// roof:direction) over a building's outline, as triangles, and the tops of its walls under them:
// level at the eaves, rising into the gables.
//
// Hipped and gabled roofs are found as the lowest of the planes rising from the outline's edges at
// one slope. Over a convex outline that is the straight skeleton's roof exactly. Over an L, T or U
// each edge's plane reaches only as far as the lines where it meets its neighbours' (at a gable,
// the gable's wall), which is the same where no wing's corner runs into another wing, as for
// buildings it nearly always is: the outline is cut into triangles, they are split where any
// plane's reach begins or ends, and in each piece the lowest of the planes reaching it is found.
// Where some piece is reached by none, there is no roof (null), and the building keeps its flat
// one. Only convex polygons are ever clipped, by half-planes, so it can't go wrong in the ways
// general polygon clipping can. Corners nearly in line with their neighbours are left out first,
// so that a side drawn in several pieces is one face of the roof.
//
// A gabled roof's gables are the ends of its wings: edges between two convex corners, shorter
// than both their neighbours (or, with roof:orientation=across, longer); round a courtyard the
// roof is hipped. Pyramidal roofs rise to
// the middle of a convex outline (a concave one gets a hipped roof); skillion roofs slope down
// towards roof:direction, or away from the longest edge. The other shapes are near enough to these:
// gambrel, half-hipped and round roofs are built gabled, mansard and dome roofs hipped, onion
// roofs pyramidal.
import * as THREE from 'three';
import type { RoofShape } from '../../src/city-tile.ts';

type XZ = [number, number];

export interface Roof {
  // world x, z and the height above the walls' top (the eaves), and triangles of them, wound to
  // face up
  points: [number, number, number][];
  triangles: number[];
  // the walls' tops: each ring of the outline with the points where the roof meets it between its
  // corners, each with its height above the eaves
  tops: [number, number, number][][];
}

const MAX_EDGES = 64;
const MAX_TRIANGLES = 600; // more, and the roof is left flat
const STRAIGHT = 0.2; // a corner this near the line between its neighbours is left out
const SLIVER = 0.01;  // pieces of less area (m²) are dropped

// The ring without the corners nearly in line with their neighbours.
function simplify(ring: XZ[]) {
  const r = [...ring];
  for (let changed = true; changed && r.length > 3;) {
    changed = false;
    for (let k = 0; k < r.length && r.length > 3; k++) {
      const a = r[(k + r.length - 1) % r.length], b = r[k], c = r[(k + 1) % r.length];
      const dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz);
      const off = l < 1e-6 ? Math.hypot(b[0] - a[0], b[1] - a[1]) : Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / l;
      // (and in between them, not a spike)
      const t = l < 1e-6 ? 0 : ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (l * l);
      if (off < STRAIGHT && t > 0 && t < 1) { r.splice(k, 1); changed = true; k--; }
    }
  }
  return r;
}

// The roof `height` m high of the given shape over `rings` (the outline with a positive shoelace
// area in x, z, then the courtyards the other way round), or null.
export function buildRoof(rings: XZ[][], shape: RoofShape, height: number, opts: { direction?: number | null; across?: boolean } = {}): Roof | null {
  if (shape === 'flat' || height < 0.3) return null;
  rings = rings.map(simplify);
  if (rings[0].length < 3) return null;
  rings = [rings[0], ...rings.slice(1).filter((r) => r.length >= 3)];
  const edges = edgesOf(rings);
  if (edges.length > MAX_EDGES || edges.length < 3) return null;
  const convex = rings.length === 1 && isConvex(rings[0]);
  try {
    if (shape === 'skillion') return skillion(rings, height, opts.direction ?? null);
    if ((shape === 'pyramidal' || shape === 'onion') && convex) return pyramid(rings[0], height);
    const gabled = ['gabled', 'gambrel', 'half-hipped', 'round'].includes(shape);
    // (round a courtyard, the wings have no ends to tell: hipped)
    if (gabled && rings.length === 1) markGables(edges, !!opts.across);
    return envelope(rings, edges, height);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ the outline's edges
interface Edge {
  a: XZ; b: XZ;
  n: XZ;          // the inward normal
  ring: number; k: number;
  gable: boolean;
  prev?: Edge; next?: Edge;
}

function edgesOf(rings: XZ[][]) {
  const all: Edge[] = [];
  rings.forEach((ring, ri) => {
    const list: Edge[] = [];
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      if (l < 0.05) continue;
      // inward is to the right of a → b for a positive shoelace outline: (−dz, dx)
      list.push({ a, b, n: [-dz / l, dx / l], ring: ri, k, gable: false });
    }
    list.forEach((e, k) => { e.prev = list[(k + list.length - 1) % list.length]; e.next = list[(k + 1) % list.length]; });
    all.push(...list);
  });
  return all;
}

const len = (e: Edge) => Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
const cross = (e: Edge, f: Edge) => (e.b[0] - e.a[0]) * (f.b[1] - f.a[1]) - (e.b[1] - e.a[1]) * (f.b[0] - f.a[0]);
// whether the corner from e to f turns inward, and by about a right angle
const square = (e: Edge, f: Edge) => {
  const c = cross(e, f) / (len(e) * len(f));
  return c > Math.sin(Math.PI / 4);
};

function isConvex(ring: XZ[]) {
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b = ring[(k + 1) % ring.length], c = ring[(k + 2) % ring.length];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cr < -0.05 * Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1])) return false;
  }
  return true;
}

function markGables(edges: Edge[], across: boolean) {
  for (const e of edges) {
    if (e.ring !== 0 || !square(e.prev!, e) || !square(e, e.next!)) continue;
    const l = len(e), lp = len(e.prev!), ln = len(e.next!);
    e.gable = across ? l > Math.max(lp, ln) : l < Math.min(lp, ln);
  }
  // a four-sided outline, nearly square: the shorter (or longer) pair
  const outer = edges.filter((e) => e.ring === 0);
  if (outer.length === 4 && !outer.some((e) => e.gable)) {
    const s0 = len(outer[0]) + len(outer[2]), s1 = len(outer[1]) + len(outer[3]);
    const pick = (s0 < s1) !== across ? [0, 2] : [1, 3];
    for (const k of pick) outer[k].gable = true;
  }
}

// ------------------------------------------------------------------ hipped and gabled
// ax + bz + c ≥ 0
type Half = [number, number, number];

function clipConvex(poly: XZ[], [a, b, c]: Half): XZ[] {
  const out: XZ[] = [];
  const add = (p: XZ) => {
    const l = out[out.length - 1];
    if (!l || Math.abs(l[0] - p[0]) > 1e-6 || Math.abs(l[1] - p[1]) > 1e-6) out.push(p);
  };
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k], q = poly[(k + 1) % poly.length];
    const fp = a * p[0] + b * p[1] + c, fq = a * q[0] + b * q[1] + c;
    if (fp >= 0) add(p);
    if ((fp >= 0) !== (fq >= 0)) {
      const t = fp / (fp - fq);
      add([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  if (out.length > 1 && Math.abs(out[0][0] - out[out.length - 1][0]) < 1e-6 && Math.abs(out[0][1] - out[out.length - 1][1]) < 1e-6) out.pop();
  return out;
}

// the half-plane through point p with normal m, on the side of point s
function side(p: XZ, m: XZ, s: XZ): Half | null {
  const l = Math.hypot(m[0], m[1]);
  if (l < 1e-6) return null;
  const a = m[0] / l, b = m[1] / l, c = -(a * p[0] + b * p[1]);
  return a * s[0] + b * s[1] + c >= 0 ? [a, b, c] : [-a, -b, -c];
}

const dist = (e: Edge, p: XZ) => e.n[0] * (p[0] - e.a[0]) + e.n[1] * (p[1] - e.a[1]);

// Where an edge's plane reaches over a concave outline, as half-planes: inside the edge, and at
// each end on its side of the line where it meets its neighbour's plane (or the neighbour's wall,
// at a gable).
function reach(e: Edge): Half[] {
  const mid: XZ = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2];
  const out: Half[] = [[e.n[0], e.n[1], -(e.n[0] * e.a[0] + e.n[1] * e.a[1])]];
  for (const [p, o] of [[e.a, e.prev!], [e.b, e.next!]] as const) {
    const h = side(p, o.gable ? o.n : [o.n[0] - e.n[0], o.n[1] - e.n[1]], mid);
    if (h) out.push(h);
  }
  return out;
}

// where dist_e(p) ≤ dist_f(p)
function nearer(e: Edge, f: Edge): Half | null {
  const a = f.n[0] - e.n[0], b = f.n[1] - e.n[1];
  const c = -(f.n[0] * f.a[0] + f.n[1] * f.a[1]) + (e.n[0] * e.a[0] + e.n[1] * e.a[1]);
  return Math.hypot(a, b) < 1e-9 ? (c >= 0 ? null : [0, 0, -1]) : [a, b, c];
}

const holds = ([a, b, c]: Half, p: XZ) => a * p[0] + b * p[1] + c >= -1e-9;

function envelope(rings: XZ[][], edges: Edge[], height: number): Roof | null {
  const sloped = edges.filter((e) => !e.gable);
  if (sloped.length < 2) return null;
  // the pieces, each with the planes that reach it
  let pieces: { poly: XZ[]; planes: Edge[] }[];
  if (rings.length === 1 && isConvex(rings[0])) {
    pieces = [{ poly: rings[0], planes: sloped }];
  } else {
    const reaches = sloped.map(reach);
    let polys = triangles(rings);
    for (const r of reaches) {
      for (const h of r) {
        const next: XZ[][] = [];
        for (const p of polys) {
          for (const q of [clipConvex(p, h), clipConvex(p, [-h[0], -h[1], -h[2]])]) if (q.length >= 3 && Math.abs(ringArea(q)) > SLIVER) next.push(q);
        }
        polys = next;
      }
    }
    pieces = polys.map((poly) => {
      const c = centroid(poly);
      return { poly, planes: sloped.filter((_, k) => reaches[k].every((h) => holds(h, c))) };
    });
    if (pieces.some((p) => !p.planes.length)) return null;
  }
  // in each piece, the face of each plane: where it is the lowest
  const faces: { e: Edge; poly: XZ[] }[] = [];
  for (const { poly, planes } of pieces) {
    for (const e of planes) {
      let f = poly;
      for (const o of planes) {
        if (o === e || f.length < 3) continue;
        const h = nearer(e, o);
        if (h) f = clipConvex(f, h);
      }
      if (f.length >= 3 && Math.abs(ringArea(f)) > SLIVER) faces.push({ e, poly: f });
    }
  }
  // the faces must cover the outline
  const area = rings.reduce((t, r) => t + ringArea(r), 0);
  const covered = faces.reduce((t, f) => t + Math.abs(ringArea(f.poly)), 0);
  if (pieces.length > 1) faces.splice(0, faces.length, ...merge(faces));
  if (Math.abs(covered - area) > 0.02 * area + 0.5) return null;
  // the slope that brings the highest point to the roof's height
  let top = 0;
  for (const { e, poly } of faces) for (const q of poly) top = Math.max(top, dist(e, q));
  if (top < 0.2) return null;
  const k = height / top;
  const roof: Roof = { points: [], triangles: [], tops: [] };
  for (const { e, poly } of faces) {
    // a fan over the convex face
    const v0 = roof.points.length;
    for (const q of poly) roof.points.push([q[0], q[1], Math.max(0, dist(e, q) * k)]);
    for (let m = 1; m + 1 < poly.length; m++) {
      if (Math.abs(ringArea([poly[0], poly[m], poly[m + 1]])) > 1e-4) roof.triangles.push(v0, v0 + m, v0 + m + 1);
    }
  }
  if (roof.triangles.length / 3 > MAX_TRIANGLES) return null;
  fixWinding(roof);
  roof.tops = topsOf(rings, roof);
  return roof;
}

// The pieces of each plane's face joined up where they make a convex polygon together.
function merge(faces: { e: Edge; poly: XZ[] }[]) {
  const key = (p: XZ) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`;
  const out: { e: Edge; poly: XZ[] }[] = [];
  const byPlane = new Map<Edge, XZ[][]>();
  for (const f of faces) (byPlane.get(f.e) ?? byPlane.set(f.e, []).get(f.e)!).push(f.poly.map((p) => [p[0], p[1]]));
  for (const [e, polys] of byPlane) {
    for (let joined = true; joined;) {
      joined = false;
      search: for (let i = 0; i < polys.length; i++) {
        const ki = polys[i].map(key);
        for (let j = i + 1; j < polys.length; j++) {
          const kj = polys[j].map(key);
          for (let a = 0; a < ki.length; a++) {
            const p = ki[a], q = ki[(a + 1) % ki.length];
            const b = kj.indexOf(q);
            if (b < 0 || kj[(b + 1) % kj.length] !== p) continue;
            // i from q round to p, then j from p round to q
            const m: XZ[] = [];
            for (let k = 0; k < ki.length; k++) m.push(polys[i][(a + 1 + k) % ki.length]);
            for (let k = 2; k < kj.length; k++) m.push(polys[j][(b + k) % kj.length]);
            const c = straighten(m);
            if (c.length < 3 || !isConvex(c)) continue;
            polys[i] = c;
            polys.splice(j, 1);
            joined = true;
            break search;
          }
        }
      }
    }
    for (const poly of polys) out.push({ e, poly });
  }
  return out;
}

// the polygon without its corners in line with their neighbours
function straighten(poly: XZ[]) {
  const out = [...poly];
  for (let k = 0; k < out.length && out.length > 3;) {
    const a = out[(k + out.length - 1) % out.length], b = out[k], c = out[(k + 1) % out.length];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cr) < 1e-6 * (Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1]) + 1e-9)) out.splice(k, 1);
    else k++;
  }
  return out;
}

// The outline (with its courtyards) in triangles.
function triangles(rings: XZ[][]): XZ[][] {
  const contour = rings[0].map(([x, z]) => new THREE.Vector2(x, z));
  const holes = rings.slice(1).map((r) => r.map(([x, z]) => new THREE.Vector2(x, z)));
  const pts = [...contour, ...holes.flat()];
  return THREE.ShapeUtils.triangulateShape(contour, holes).map((f) => f.map((q) => [pts[q].x, pts[q].y] as XZ));
}

function centroid(poly: XZ[]): XZ {
  let x = 0, z = 0;
  for (const p of poly) { x += p[0]; z += p[1]; }
  return [x / poly.length, z / poly.length];
}

// ------------------------------------------------------------------ pyramidal and skillion
function pyramid(ring: XZ[], height: number): Roof {
  let cx = 0, cz = 0, a = 0;
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k], q = ring[(k + 1) % ring.length], w = p[0] * q[1] - q[0] * p[1];
    a += w; cx += (p[0] + q[0]) * w; cz += (p[1] + q[1]) * w;
  }
  const apex: [number, number, number] = [cx / (3 * a), cz / (3 * a), height];
  const roof: Roof = { points: [apex], triangles: [], tops: [ring.map(([x, z]) => [x, z, 0])] };
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k], q = ring[(k + 1) % ring.length];
    roof.points.push([p[0], p[1], 0], [q[0], q[1], 0]);
    const n = roof.points.length;
    roof.triangles.push(0, n - 2, n - 1);
  }
  fixWinding(roof);
  return roof;
}

function skillion(rings: XZ[][], height: number, direction: number | null): Roof | null {
  let d: XZ;
  if (direction !== null) {
    // compass bearing (clockwise from north) to x east, z south
    const r = (direction * Math.PI) / 180;
    d = [Math.sin(r), -Math.cos(r)];
  } else {
    // down away from the longest edge
    const e = edgesOf([rings[0]]).sort((p, q) => len(q) - len(p))[0];
    d = [e.n[0], e.n[1]];
  }
  const proj = (p: XZ) => p[0] * d[0] + p[1] * d[1];
  const all = rings.flat();
  const lo = Math.min(...all.map(proj)), hi = Math.max(...all.map(proj));
  if (hi - lo < 0.5) return null;
  const y = (p: XZ) => (height * (hi - proj(p))) / (hi - lo);
  const roof: Roof = { points: [], triangles: [], tops: rings.map((r) => r.map((p) => [p[0], p[1], y(p)] as [number, number, number])) };
  triangulate(roof, rings, y);
  return roof;
}

// ------------------------------------------------------------------ helpers
function triangulate(roof: Roof, rings: XZ[][], y: (p: XZ) => number) {
  if (!rings.length || rings[0].length < 3) return;
  const contour = rings[0].map(([x, z]) => new THREE.Vector2(x, z));
  const holes = rings.slice(1).map((r) => r.map(([x, z]) => new THREE.Vector2(x, z)));
  const faces = THREE.ShapeUtils.triangulateShape(contour, holes);
  const pts = [...contour, ...holes.flat()];
  const v0 = roof.points.length;
  for (const p of pts) roof.points.push([p.x, p.y, y([p.x, p.y])]);
  for (const f of faces) roof.triangles.push(v0 + f[0], v0 + f[1], v0 + f[2]);
  fixWinding(roof, v0);
}

// Each triangle wound to face up: its normal's y, dz₁·dx₂ − dx₁·dz₂, positive.
function fixWinding(roof: Roof, from = 0) {
  const P = roof.points, T = roof.triangles;
  for (let t = 0; t < T.length; t += 3) {
    if (T[t] < from && T[t + 1] < from && T[t + 2] < from) continue;
    const a = P[T[t]], b = P[T[t + 1]], c = P[T[t + 2]];
    const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    if (ny < 0) [T[t + 1], T[t + 2]] = [T[t + 2], T[t + 1]];
  }
}

// The walls' tops: the outline's corners at the eaves, and between them, the roof's points on its
// edges at their heights.
function topsOf(rings: XZ[][], roof: Roof) {
  return rings.map((ring) => {
    const out: [number, number, number][] = [];
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k], b = ring[(k + 1) % ring.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
      out.push([a[0], a[1], heightNear(roof, a)]);
      if (l2 < 1e-4) continue;
      const on: [number, number, number, number][] = [];
      for (const [x, z, y] of roof.points) {
        const t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2;
        if (t < 0.002 || t > 0.998) continue;
        const ex = a[0] + dx * t - x, ez = a[1] + dz * t - z;
        if (ex * ex + ez * ez < 0.02 * 0.02) on.push([t, x, z, y]);
      }
      on.sort((p, q) => p[0] - q[0]);
      for (const [, x, z, y] of on) {
        const last = out[out.length - 1];
        if (Math.hypot(last[0] - x, last[1] - z) < 0.05) { last[2] = Math.max(last[2], y); continue; }
        out.push([x, z, y]);
      }
    }
    return out;
  });
}

// the roof's height at one of its points (at a corner, the eaves: the lowest found there)
function heightNear(roof: Roof, p: XZ) {
  let y = Infinity;
  for (const [x, z, h] of roof.points) if (Math.hypot(x - p[0], z - p[1]) < 0.05) y = Math.min(y, h);
  return y === Infinity ? 0 : y;
}

function ringArea(r: XZ[]) {
  let a = 0;
  for (let k = 0; k < r.length; k++) {
    const p = r[k], q = r[(k + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
