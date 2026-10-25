import * as THREE from 'three';
import * as T from '../textures';
import type { Square, Street, StreetKind, Surface, Tree } from '../city-tile.ts';
import { STREET_CROSSING, STREET_ONEWAY, STREET_SIDEWALK, STREET_ZEBRA } from '../city-tile.ts';
import { Builder, type V2, type V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';

// The streets, paths and squares, and the trees, in the areas drawn in detail (src/detail/areas.ts),
// as OpenStreetMap, the laser scan and Google's mesh have them (tools/build-city.ts puts them in
// the tiles):
// - each street a ribbon of its surface (asphalt, setts, cobbles, slabs, gravel), as wide as
//   OpenStreetMap says, or as its lanes, or as is usual for its kind; laid on the ground exactly,
//   cut along the ground's cells and their diagonals so that each piece lies on one of its
//   triangles as drawn. The pavements beside roads are raised a kerb's height, with the kerbs;
// - the main roads' dashed centre lines, the lanes of one-way roads and the zebra crossings;
// - the squares, filled;
// - the trees: each a picture of a tree on a plane that turns about the upright to face the
//   camera, as tall and its crown as wide as found.
// Being flat on the ground, the squares, paths, roads and markings are kept apart each over the
// one before: by a centimetre or so near the camera, and by polygon offset further off, where a
// centimetre is lost in the depth buffer.

export interface StreetGround {
  step: number;                                    // the ground's grid, metres
  height: (x: number, z: number) => number;        // the ground as drawn
  bare: (x: number, z: number) => boolean;         // there to draw on: not cut away, nor the track's
  water: (x: number, z: number) => number | null;  // the level of water over the ground's cell there
  outline?: V2[];                                  // a deck's edges (convex), where it ends: what is laid on it is cut there
}
export interface TileStreets { streets?: Street[]; squares?: Square[]; trees?: Tree[]; ground: StreetGround }

// ------------------------------------------------------------------ looks
type Look = 'asphalt' | 'sett' | 'cobble' | 'paving' | 'concrete' | 'gravel' | 'wood';
// each surface's texture, how many metres it covers, and its colour: asphalt worn grey, Gamla
// stan's granite setts and cobbles grey with a little warmth, concrete slabs pale
const LOOKS: Record<Look, { tex: () => THREE.Texture; repeat: number; colour: number }> = {
  asphalt: { tex: T.asphalt, repeat: 4, colour: 0x6b6c6d },
  sett: { tex: T.setts, repeat: 2, colour: 0xa8a39b },
  cobble: { tex: T.cobbles, repeat: 1.5, colour: 0xa39c92 },
  paving: { tex: T.pavingSlabs, repeat: 1.4, colour: 0xb9b6b0 },
  concrete: { tex: () => T.concrete(23, 205), repeat: 4, colour: 0xb4b2ac },
  gravel: { tex: T.gravel, repeat: 2, colour: 0xb5ab96 },
  wood: { tex: T.boardWalk, repeat: 2, colour: 0x8c7a62 },
};
// one over the other: squares, then paths, then roads, then the paint on them
const SQUARE = 0, PATH = 1, ROAD = 2, PAINT = 3;
const LIFT = [0.01, 0.02, 0.03, 0.045];
const textures = new Map<Look, THREE.Texture>();
const offset = (layer: number) => ({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 - 3 * layer });
function material(look: Look, layer: number) {
  const key = `st-${look}-${layer}`;
  addMaterial(key, () => {
    let tex = textures.get(look);
    if (!tex) textures.set(look, tex = LOOKS[look].tex());
    return standard(tex, look === 'asphalt' ? 0.92 : 0.85, 0, offset(layer));
  });
  return key;
}
addMaterial('st-paint', () => standard(null, 0.7, 0, offset(PAINT)));
addMaterial('st-tree', () => {
  const m = standard(T.treePictures(), 0.95, 0, { alphaTest: 0.4 });
  // Each tree's plane is laid out across x at its foot, and its four corners keep the foot in their
  // normals: here the plane is turned about the upright through the foot to face the camera, and
  // lit as if it faced up and a little towards it. (The city's meshes are in world coordinates,
  // unmoved, so the camera's position is the plane's.)
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <beginnormal_vertex>', `vec3 treeFoot = normal;
        vec2 treeTo = cameraPosition.xz - treeFoot.xz;
        treeTo = length(treeTo) > 0.001 ? normalize(treeTo) : vec2(0.0, 1.0);
        vec3 objectNormal = normalize(vec3(treeTo.x * 0.5, 1.0, treeTo.y * 0.5));`)
      .replace('#include <begin_vertex>', `vec3 transformed = treeFoot + vec3(treeTo.y, 0.0, -treeTo.x) * (position.x - treeFoot.x)
        + vec3(0.0, position.y - treeFoot.y, 0.0);`);
  };
  m.customProgramCacheKey = () => 'st-tree';
  return m;
});
const PAINT_COLOUR = 0xe6e6e0, KERB = 0xa3a09a;

const ROADS = new Set<StreetKind>(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service',
  'living_street', 'track', 'other']);
// the roads whose middles are marked, when they're two-way and wide enough
const MARKED = new Set<StreetKind>(['motorway', 'trunk', 'primary', 'secondary', 'tertiary']);
const WIDTH: Record<StreetKind, number> = {
  motorway: 11, trunk: 10, primary: 9, secondary: 8, tertiary: 7, unclassified: 6, residential: 6, service: 4, living_street: 5,
  pedestrian: 5, footway: 2.5, cycleway: 2.5, path: 2, steps: 2.5, track: 3, other: 4,
};
const KERB_HEIGHT = 0.12;

function lookOf(surface: Surface, kind: StreetKind): Look {
  switch (surface) {
    case 'asphalt': return 'asphalt';
    case 'sett': return 'sett';
    case 'cobblestone': return 'cobble';
    case 'paving_stones': return 'paving';
    case 'concrete': return 'concrete';
    case 'gravel': return 'gravel';
    case 'wood': return 'wood';
  }
  return kind === 'pedestrian' || kind === 'footway' || kind === 'steps' ? 'paving' : kind === 'path' || kind === 'track' ? 'gravel' : 'asphalt';
}
function widthOf(s: Street) {
  if (s.width >= 1 && s.width <= 40) return s.width;
  if (s.lanes && ROADS.has(s.kind)) return Math.max(3, s.lanes * 3.25);
  return s.flags & STREET_SIDEWALK ? 2.2 : WIDTH[s.kind];
}

// ------------------------------------------------------------------ the whole
export function buildStreets(B: Builder, { streets = [], squares = [], trees = [], ground: G }: TileStreets, x0: number, z0: number, size: number) {
  B.place([0, 0, 0], 0);
  const inTile = (x: number, z: number) => x >= x0 && x < x0 + size && z >= z0 && z < z0 + size;
  const lay = (look: Look, layer: number, raised = 0) => {
    const mat = material(look, layer), rep = LOOKS[look].repeat, lift = raised + LIFT[layer];
    return (pts: V3[], n: V3) => {
      B.tint(LOOKS[look].colour);
      B.poly(pts.map(([x, y, z]) => [x, y + lift, z]), n, mat, rep, pts.map(([x, , z]) => [x / rep, z / rep]));
    };
  };
  const paint = (pts: V3[], n: V3) => {
    B.tint(PAINT_COLOUR);
    B.poly(pts.map(([x, y, z]) => [x, y + LIFT[PAINT], z]), n, 'st-paint', 4, pts.map(([x, , z]) => [x, z]));
  };

  for (const sq of squares) {
    const [outline, ...holes] = sq.rings;
    if (!outline || outline.length < 3) continue;
    const all = [outline, ...holes].flat();
    const emit = lay(lookOf(sq.surface, sq.kind), SQUARE);
    for (const t of THREE.ShapeUtils.triangulateShape(outline.map(v2), holes.map((h) => h.map(v2)))) {
      drape([all[t[0]], all[t[1]], all[t[2]]], G, emit, [x0, z0, x0 + size, z0 + size]);
    }
  }

  for (const s of streets) {
    const line = s.line.filter((p, k) => !k || Math.hypot(p[0] - s.line[k - 1][0], p[1] - s.line[k - 1][1]) > 0.05);
    if (line.length < 2) continue;
    const w = widthOf(s), { seg, N, sharp } = sides(line, w / 2);
    const drawn = (k: number) => inTile((line[k][0] + line[k + 1][0]) / 2, (line[k][1] + line[k + 1][1]) / 2);
    const last = line.length - 2;
    // a zebra crossing: bars half a metre wide and apart, 3 m long, along the road it crosses
    if (s.flags & STREET_CROSSING) {
      if (!(s.flags & STREET_ZEBRA)) continue;
      for (let k = 0; k <= last; k++) {
        if (!drawn(k)) continue;
        const [a, b] = [line[k], line[k + 1]], len = Math.hypot(b[0] - a[0], b[1] - a[1]), d: V2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
        const n = Math.floor((len + 0.5) / 1), start = (len - (n - 0.5)) / 2;
        for (let i = 0; i < n; i++) drape(rect(a, d, start + i, start + i + 0.5, -1.5, 1.5), G, paint);
      }
      continue;
    }
    const sidewalk = (s.flags & STREET_SIDEWALK) !== 0, lift = sidewalk ? KERB_HEIGHT : 0;
    const emit = lay(lookOf(s.surface, s.kind), ROADS.has(s.kind) ? ROAD : PATH, lift);
    for (let k = 0; k <= last; k++) {
      if (!drawn(k)) continue;
      const [l0, r0, l1, r1] = seg[k];
      drape([l0, l1, r1], G, emit);
      drape([l0, r1, r0], G, emit);
      if (sidewalk) {
        kerb(B, G, l0, l1, N[k], lift + LIFT[PATH]);
        kerb(B, G, r1, r0, [-N[k][0], -N[k][1]], lift + LIFT[PATH]);
      }
      // round where it turns sharply, filling the corner
      if (sharp[k + 1] && k < last && !sidewalk) drape(disc(line[k + 1], w / 2), G, emit);
    }
    // round ends where the street ends in this tile (the segments either side of the tile's are
    // in the tile's data too, so its first drawn here means it starts here): they fill the corners
    // where streets meet
    if (!sidewalk) {
      if (drawn(0)) drape(disc(line[0], w / 2), G, emit);
      if (drawn(last)) drape(disc(line[last + 1], w / 2), G, emit);
    }
    // the paint: a two-way main road's dashed middle (3 m lines, 9 m apart), and the lanes of one
    // going one way, or of a wide one each way
    if (!ROADS.has(s.kind)) continue;
    const oneway = (s.flags & STREET_ONEWAY) !== 0, lanes = s.lanes || (oneway ? 1 : 2);
    const lines: number[] = [];
    if (oneway) for (let i = 1; i < lanes; i++) lines.push((i / lanes - 0.5) * w);
    else if (MARKED.has(s.kind) && w >= 6) {
      lines.push(0);
      if (lanes >= 4) lines.push(-w / 4, w / 4);
    }
    if (!lines.length) continue;
    let along = 0;
    for (let k = 0; k <= last; k++) {
      const [a, b] = [line[k], line[k + 1]], len = Math.hypot(b[0] - a[0], b[1] - a[1]), d: V2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      if (drawn(k)) {
        for (let t = Math.ceil(along / 12) * 12 - along - 12; t < len; t += 12) {
          const t0 = Math.max(0, t), t1 = Math.min(len, t + 3);
          if (t1 - t0 < 0.3) continue;
          for (const off of lines) drape(rect(a, d, t0, t1, off - 0.075, off + 0.075), G, paint);
        }
      }
      along += len;
    }
  }

  trees.forEach((t, k) => {
    if (!inTile(t.x, t.z) || !G.bare(t.x, t.z)) return;
    const y = G.height(t.x, t.z), w = G.water(t.x, t.z);
    if (w !== null && y < w + 0.3) return;
    tree(B, t, y, Math.round(t.x * 7 + t.z * 13) + k);
  });
}

// ------------------------------------------------------------------ on the ground
const v2 = ([x, z]: V2) => new THREE.Vector2(x, z);

// the points of a polygon with a·x + b·z ≥ c
function clipHalf(poly: V2[], a: number, b: number, c: number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] - c, dq = a * q[0] + b * q[1] - c;
    if (dp >= 0) out.push(p);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

// A convex polygon laid on the ground: cut into the pieces over each of the ground's triangles
// (each cell split from its north-west corner, as src/city.ts draws it), each piece at the ground's
// height and facing as its triangle does. Within `bounds` only, if given; none where the ground
// isn't bare, nor under water.
function drape(poly: V2[], G: StreetGround, emit: (pts: V3[], n: V3) => void, bounds?: [number, number, number, number]) {
  const s = G.step;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  if (bounds) {
    x0 = Math.max(x0, bounds[0]); z0 = Math.max(z0, bounds[1]); x1 = Math.min(x1, bounds[2]); z1 = Math.min(z1, bounds[3]);
    if (x0 >= x1 || z0 >= z1) return;
  }
  for (let ci = Math.floor(x0 / s); ci * s < x1; ci++) {
    for (let ri = Math.floor(z0 / s); ri * s < z1; ri++) {
      const cx = ci * s, cz = ri * s;
      let p = clipHalf(poly, 1, 0, Math.max(cx, x0));
      p = clipHalf(p, -1, 0, -Math.min(cx + s, x1));
      p = clipHalf(p, 0, 1, Math.max(cz, z0));
      p = clipHalf(p, 0, -1, -Math.min(cz + s, z1));
      if (p.length < 3) continue;
      const hNW = G.height(cx, cz), hSE = G.height(cx + s, cz + s);
      for (const upper of [true, false]) {
        // north-east of the cell's diagonal (x − cx ≥ z − cz), or south-west of it
        let q = upper ? clipHalf(p, 1, -1, cx - cz) : clipHalf(p, -1, 1, cz - cx);
        if (G.outline) q = edges(G.outline).reduce((r, [a, b, c]) => clipHalf(r, a, b, c), q);
        if (q.length < 3 || Math.abs(area(q)) < 1e-4) continue;
        let mx = 0, mz = 0;
        for (const [x, z] of q) { mx += x / q.length; mz += z / q.length; }
        if (!G.bare(mx, mz)) continue;
        const pts: V3[] = q.map(([x, z]) => [x, G.height(x, z), z]);
        const w = G.water(mx, mz);
        if (w !== null && pts.every((v) => v[1] < w + 0.05)) continue;
        // the triangle's normal: from its corners NW, SE and NE or SW
        const c: V3 = upper ? [cx + s, G.height(cx + s, cz), cz] : [cx, G.height(cx, cz + s), cz + s];
        const a: V3 = [cx, hNW, cz], b: V3 = [cx + s, hSE, cz + s];
        let n = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
        if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
        emit(pts, n);
      }
    }
  }
}

// A kerb's face along a raised edge from a to b, facing `out`: from the ground up `h`, in pieces
// between where the edge crosses the ground's cells and their diagonals.
function kerb(B: Builder, G: StreetGround, a: V2, b: V2, out: V2, h: number) {
  const s = G.step, dx = b[0] - a[0], dz = b[1] - a[1];
  // (on a deck, only as far as its edges)
  let t0 = 0, t1 = 1;
  for (const [ea, eb, ec] of G.outline ? edges(G.outline) : []) {
    const f0 = ea * a[0] + eb * a[1] - ec, df = ea * dx + eb * dz;
    if (Math.abs(df) < 1e-9) { if (f0 < 0) return; continue; }
    const t = -f0 / df;
    if (df > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
  }
  if (t1 - t0 < 1e-4) return;
  const ts = [t0, t1];
  const cuts = (from: number, d: number) => {
    if (Math.abs(d) < 1e-9) return;
    for (let m = Math.ceil(Math.min(from, from + d) / s); m * s < Math.max(from, from + d); m++) ts.push((m * s - from) / d);
  };
  cuts(a[0], dx); cuts(a[1], dz); cuts(a[0] - a[1], dx - dz);
  ts.sort((p, q) => p - q);
  B.tint(KERB);
  if (t0 > 0 || t1 < 1) ts.splice(0, ts.length, ...ts.filter((t) => t >= t0 && t <= t1));
  for (let k = 0; k + 1 < ts.length; k++) {
    if (ts[k + 1] - ts[k] < 1e-4) continue;
    const p: V2 = [a[0] + dx * ts[k], a[1] + dz * ts[k]], q: V2 = [a[0] + dx * ts[k + 1], a[1] + dz * ts[k + 1]];
    if (!G.bare((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)) continue;
    const yp = G.height(p[0], p[1]), yq = G.height(q[0], q[1]);
    B.poly([[p[0], yp - 0.02, p[1]], [q[0], yq - 0.02, q[1]], [q[0], yq + h, q[1]], [p[0], yp + h, p[1]]], [out[0], 0, out[1]], 'stone', 1);
  }
}

// A line's two sides `half` out from it: each segment's corners (left and right at its start, then
// at its end), mitred where the line bends, squared off where it turns sharply (more than 100°:
// a mitre there would reach far out); each segment's normal; and where it turns sharply.
function sides(line: V2[], half: number) {
  const N: V2[] = [];
  for (let k = 0; k + 1 < line.length; k++) {
    const dx = line[k + 1][0] - line[k][0], dz = line[k + 1][1] - line[k][1], l = Math.hypot(dx, dz) || 1;
    N.push([-dz / l, dx / l]);
  }
  const sharp = line.map((_, k) => k > 0 && k < N.length && 1 + N[k - 1][0] * N[k][0] + N[k - 1][1] * N[k][1] < 0.83);
  const mitre = (k: number, own: V2): V2 => {
    if (sharp[k] || !N[k - 1] || !N[k]) return own;
    const n1 = N[k - 1], n2 = N[k], d = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    return [(n1[0] + n2[0]) / d, (n1[1] + n2[1]) / d];
  };
  const seg = N.map((n, k): [V2, V2, V2, V2] => {
    const a = line[k], b = line[k + 1], ma = mitre(k, n), mb = mitre(k + 1, n);
    return [[a[0] + ma[0] * half, a[1] + ma[1] * half], [a[0] - ma[0] * half, a[1] - ma[1] * half],
      [b[0] + mb[0] * half, b[1] + mb[1] * half], [b[0] - mb[0] * half, b[1] - mb[1] * half]];
  });
  return { seg, N, sharp };
}

// a rectangle along a line from a in direction d: from t0 to t1 along it, u0 to u1 across it
function rect(a: V2, d: V2, t0: number, t1: number, u0: number, u1: number): V2[] {
  const P = (t: number, u: number): V2 => [a[0] + d[0] * t - d[1] * u, a[1] + d[1] * t + d[0] * u];
  return [P(t0, u0), P(t1, u0), P(t1, u1), P(t0, u1)];
}
function disc([x, z]: V2, r: number): V2[] {
  return Array.from({ length: 10 }, (_, k): V2 => [x + r * Math.cos((k / 10) * Math.PI * 2), z + r * Math.sin((k / 10) * Math.PI * 2)]);
}
// a convex outline's edges as the half-planes a·x + b·z ≥ c inside it
function edges(ring: V2[]): [number, number, number][] {
  const w = Math.sign(area(ring));
  return ring.map((p, i) => {
    const q = ring[(i + 1) % ring.length], a = -(q[1] - p[1]) * w, b = (q[0] - p[0]) * w;
    return [a, b, a * p[0] + b * p[1]];
  });
}
function area(p: V2[]) {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
  return a / 2;
}
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ------------------------------------------------------------------ trees
// A tree on the ground at height y: one of the pictures of src/textures.ts (a round broadleaf; for a
// taller tree a taller one or a birch; for a tall narrow one also a pine or a spruce), scaled to its
// height and the width of its crown, a little darker or lighter, and mirrored at random. Its foot is
// sunk 0.3 m, for a slope.
function tree(B: Builder, t: Tree, y: number, seed: number) {
  const r = T.rng(seed);
  const h = Math.min(30, Math.max(3, t.height)), R = Math.min(9, Math.max(1, t.radius)), tall = h / (2 * R), pick = r(), two = r() < 0.5 ? 0 : 1;
  const p = T.TREE_PICTURES[tall >= 1.6 && h >= 10 && pick < 0.6 ? (pick < 0.35 ? 6 : 7)
    : tall >= 1.25 ? (pick < 0.35 ? 4 : 2) + two : two];
  const w = (2 * R) / p.width, top = h / p.top, y0 = y - 0.3;
  const shade = 0.86 + r() * 0.18;
  B.tint([shade * (0.95 + r() * 0.1), shade, shade * (0.92 + r() * 0.12)]);
  const [u0, u1] = r() < 0.5 ? [p.u, p.u + 0.25] : [p.u + 0.25, p.u];
  const foot: V3 = [t.x, y0, t.z];
  B.mesh([[t.x - w / 2, y0, t.z], [t.x + w / 2, y0, t.z], [t.x + w / 2, y0 + top, t.z], [t.x - w / 2, y0 + top, t.z]], [foot, foot, foot, foot],
    [[u0, p.v], [u1, p.v], [u1, p.v + 0.5], [u0, p.v + 0.5]], [0, 1, 2, 0, 2, 3], 'st-tree');
}
