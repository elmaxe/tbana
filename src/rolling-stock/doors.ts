import * as THREE from 'three';
import { Painter, merge } from './kit';
import type { Profile } from './kit';

// Sliding plug doors. Each doorway is a hole in the body (painted dark when the car is seen without
// its interior) with two leaves per side that move out from the body and slide apart along it.
//
// A leaf is a thin panel that follows the body's cross-section between y0 and y1. Both leaves of a
// door share one texture: the outside face on the left half, the inside face on the right, painted
// in metres with a = 0 at the centre seam and a = w at the leaf's outer edge.

export interface DoorStyle {
  width: number;   // the doorway, both leaves together
  y0: number;      // bottom and top of the leaves above the rail
  y1: number;
  plug?: number;   // how far the leaves move out before they slide
  outside(p: Painter, w: number): void;
}

// The inside face comes with the interior; without one the leaves are plain inside.
export type DoorInside = (p: Painter, w: number) => void;

const SKIN = 0.012;   // closed leaves stand this far out from the body
const THICK = 0.04;
const SEAM = 0.004;   // gap between the closed leaves
const OPEN_AT = 0.3;  // fraction of the opening spent moving out; the rest slides

// z of the body side at height y (right side), interpolated along the profile.
export function sideZ(prof: Profile, y: number) {
  const side = prof.pts.filter((p) => p.t >= -0.02);
  if (y <= side[0].y) return side[0].z;
  for (let i = 1; i < side.length; i++) {
    const a = side[i - 1], b = side[i];
    if (b.y >= y) return a.z + ((y - a.y) / (b.y - a.y || 1)) * (b.z - a.z);
  }
  return side[side.length - 1].z;
}

// One leaf on the right side, from x = 0 (the seam) to x = e·w, as a closed slab.
function leafGeometry(prof: Profile, st: DoorStyle, w: number, e: 1 | -1) {
  const n = Math.max(2, Math.ceil((st.y1 - st.y0) / 0.08));
  const ys = Array.from({ length: n + 1 }, (_, i) => st.y0 + ((st.y1 - st.y0) * i) / n);
  const zo = ys.map((y) => sideZ(prof, y) + SKIN);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const v = (y: number) => (y - st.y0) / (st.y1 - st.y0);
  const xs = [e * (SEAM / 2), e * w];
  // faces: outside (u 0–0.5) and inside (u 0.5–1)
  for (const [dz, u0, flip] of [[0, 0, e > 0], [-THICK, 0.5, e < 0]] as const) {
    const base = pos.length / 3;
    ys.forEach((y, i) => {
      for (const x of xs) {
        pos.push(x, y, zo[i] + dz);
        uv.push(u0 + (0.5 * Math.abs(x)) / w, v(y));
      }
    });
    for (let i = 0; i < n; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      if (flip) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // the edges (seam, outer edge, top, bottom) take the seal colour painted at the inside seam
  const edges: THREE.BufferGeometry[] = [];
  const edge = (quad: number[][]) => {
    const e2 = new THREE.BufferGeometry();
    e2.setAttribute('position', new THREE.Float32BufferAttribute(quad.flat(), 3));
    e2.setAttribute('uv', new THREE.Float32BufferAttribute([0.502, 0.5, 0.502, 0.5, 0.502, 0.5, 0.502, 0.5], 2));
    e2.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]);
    edges.push(e2);
  };
  for (const x of xs) {
    const strip: number[][] = [];
    ys.forEach((y, i) => { if (i < n) strip.push([x, y, zo[i]], [x, ys[i + 1], zo[i + 1]], [x, ys[i + 1], zo[i + 1] - THICK], [x, y, zo[i] - THICK]); });
    for (let i = 0; i < strip.length; i += 4) edge(strip.slice(i, i + 4));
  }
  for (const [y, z] of [[ys[0], zo[0]], [ys[n], zo[n]]]) edge([[xs[0], y, z], [xs[1], y, z], [xs[1], y, z - THICK], [xs[0], y, z - THICK]]);
  const out = merge([g, ...edges]);
  out.computeVertexNormals();
  return out;
}

function leafMaterial(st: DoorStyle, inside: DoorInside | undefined, quality: number) {
  const w = st.width / 2, h = st.y1 - st.y0, ppm = 220 * quality;
  const W = Math.ceil(2 * w * ppm), H = Math.ceil(h * ppm);
  const band = (u0: number) => ({ sa: W / (2 * w), oa: u0 * W, sb: -H / h, ob: (H * st.y1) / h });
  const p = new Painter(W, H, [band(0)], { alpha: true });
  st.outside(p, w);
  p.bands = [band(0.5)];
  if (inside) inside(p, w);
  else p.rect(0, w, st.y0, st.y1, { c: '#3a3f45', r: 0.5 });
  p.rect(0, 0.02, st.y0, st.y1, { c: '#15171a', r: 0.6 });
  const m = p.material({}, 'blend');
  // fully clear texels are cut out, so they don't hide what is behind them in the depth buffer
  m.alphaTest = 0.01;
  m.name = 'door';
  return m;
}

export interface DoorKit {
  // leaf geometry per side (z sign) and sliding direction, all of a car's doors merged
  leaves: { side: 1 | -1; e: 1 | -1; geometry: THREE.BufferGeometry }[];
  material: THREE.Material;
  width: number;
  plug: number;
}

// The leaves for a car with doors centred at `doors` (x along the car).
export function doorKit(prof: Profile, st: DoorStyle, doors: number[], inside: DoorInside | undefined, quality: number,
  cache: Map<string, THREE.Material>): DoorKit {
  const w = st.width / 2;
  const key = `door|${inside ? 'i' : ''}`;
  let material = cache.get(key);
  if (!material) cache.set(key, (material = leafMaterial(st, inside, quality)));
  const leaves: DoorKit['leaves'] = [];
  for (const side of [1, -1] as const) {
    for (const e of [1, -1] as const) {
      const base = leafGeometry(prof, st, w, e);
      if (side < 0) mirrorZ(base);
      const geometry = merge(doors.map((d) => base.clone().translate(d, 0, 0)));
      leaves.push({ side, e, geometry });
    }
  }
  return { leaves, material, width: st.width, plug: st.plug ?? 0.05 };
}

function mirrorZ(g: THREE.BufferGeometry) {
  g.scale(1, 1, -1);
  const idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const b = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, b);
  }
  g.computeVertexNormals();
}

// Door leaves for one car. open(amount, side) opens the doors on one side (±1, car z) or both (0).
export function carDoors(kit: DoorKit) {
  const group = new THREE.Group();
  group.name = 'doors';
  const meshes = kit.leaves.map((l) => {
    const m = new THREE.Mesh(l.geometry, kit.material);
    m.name = 'door';
    m.userData.side = l.side;
    m.userData.e = l.e;
    group.add(m);
    return m;
  });
  const slide = kit.width / 2 - 0.05;
  const state = { 1: 0, [-1]: 0 } as Record<1 | -1, number>;
  return {
    group,
    state,
    set(amount: number, side: 1 | -1 | 0) {
      for (const s of [1, -1] as const) state[s] = side === 0 || side === s ? amount : 0;
      for (const m of meshes) {
        const k = state[m.userData.side as 1 | -1];
        const out = Math.min(1, k / OPEN_AT), along = Math.max(0, (k - OPEN_AT) / (1 - OPEN_AT));
        const ease = (t: number) => t * t * (3 - 2 * t);
        m.position.set(m.userData.e * slide * ease(along), 0, m.userData.side * kit.plug * ease(out));
      }
    },
  };
}

// Reveals round each doorway that join the interior lining to the body, and a threshold plate.
export function doorFrames(prof: Profile, lining: Profile, st: DoorStyle, doors: number[], floorY: number) {
  const geos: THREE.BufferGeometry[] = [];
  const lz = (y: number) => sideZ(lining, y);
  const n = 10;
  const top = Math.min(st.y1, lining.ytop - 0.1);
  for (const s of [1, -1]) {
    for (const d of doors) {
      // jambs at both edges of the doorway
      for (const x of [d - st.width / 2, d + st.width / 2]) {
        const pos: number[] = [];
        for (let i = 0; i <= n; i++) {
          const y = floorY + ((top - floorY) * i) / n;
          pos.push(x, y, s * lz(y), x, y, s * (sideZ(prof, y) + SKIN));
        }
        const idx: number[] = [];
        for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        geos.push(g);
      }
      // header above the doorway and the threshold at the floor
      for (const y of [top, floorY + 0.004]) {
        const za = s * lz(y), zb = s * (sideZ(prof, y) + SKIN);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([
          d - st.width / 2, y, za, d + st.width / 2, y, za, d + st.width / 2, y, zb, d - st.width / 2, y, zb,
        ], 3));
        g.setIndex([0, 1, 2, 0, 2, 3]);
        geos.push(g);
      }
    }
  }
  return merge(geos);
}
