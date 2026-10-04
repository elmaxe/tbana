import * as THREE from 'three';

export type Tri = [THREE.Vector3, THREE.Vector3, THREE.Vector3];

// A 3D polyline parameterised by arc length (measured in the XZ plane).
export class Polyline {
  pts: THREE.Vector3[];
  cum: number[];
  length: number;

  constructor(points: THREE.Vector3[]) {
    this.pts = points;
    this.cum = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.length = this.cum[this.cum.length - 1];
  }

  pointAt(s: number, out = new THREE.Vector3()) {
    const { pts, cum } = this;
    if (s <= 0) return out.copy(pts[0]);
    if (s >= this.length) return out.copy(pts[pts.length - 1]);
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid; else hi = mid;
    }
    const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
    return out.lerpVectors(pts[lo], pts[hi], t);
  }

  // Horizontal unit tangent, smoothed over a couple of metres.
  tangentAt(s: number, out = new THREE.Vector3()) {
    const a = this.pointAt(Math.max(0, s - 1.5), _a);
    const b = this.pointAt(Math.min(this.length, s + 1.5), _b);
    out.set(b.x - a.x, 0, b.z - a.z);
    if (out.lengthSq() < 1e-10) out.set(1, 0, 0);
    return out.normalize();
  }

  // Right-hand horizontal normal (tangent × up).
  rightAt(s: number, out = new THREE.Vector3()) {
    this.tangentAt(s, out);
    return out.set(-out.z, 0, out.x);
  }

  // Copy of this polyline shifted sideways by `offset` metres (positive = right).
  offset(offset: number) {
    const pts = this.cum.map((s, i) => {
      const r = this.rightAt(s, new THREE.Vector3());
      return this.pts[i].clone().addScaledVector(r, offset);
    });
    return new Polyline(pts);
  }

  // Sub-range [s0, s1] resampled every `step` metres.
  resample(s0: number, s1: number, step: number) {
    const n = Math.max(1, Math.ceil((s1 - s0) / step));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) pts.push(this.pointAt(s0 + ((s1 - s0) * i) / n));
    return pts;
  }
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export const vkey = (v: THREE.Vector3) => `${Math.round(v.x * 100)},${Math.round(v.y * 100)},${Math.round(v.z * 100)}`;

// Splits triangles into groups that share vertices.
export function splitComponents(tris: Tri[]) {
  const id = new Map<string, number>();
  const parent: number[] = [];
  const find = (a: number) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const vid = (v: THREE.Vector3) => {
    const k = vkey(v);
    if (!id.has(k)) { id.set(k, parent.length); parent.push(parent.length); }
    return id.get(k)!;
  };
  const tv = tris.map((t) => t.map(vid));
  for (const [a, b, c] of tv) { parent[find(b)] = find(a); parent[find(c)] = find(a); }
  const comps = new Map<number, Tri[]>();
  tris.forEach((t, i) => {
    const r = find(tv[i][0]);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r)!.push(t);
  });
  return [...comps.values()];
}

// Recovers the centre line of a thin ribbon (a track drawn as an extruded SVG stroke).
// Slices the ribbon perpendicular to its principal axis and takes the middle of each slice.
// Returns an array of polylines (the ribbon is split where a slice looks implausibly wide).
export function extractCenterlines(tris: Tri[], step = 2) {
  const verts: THREE.Vector3[] = [];
  for (const t of tris) verts.push(t[0], t[1], t[2]);
  let mx = 0, mz = 0;
  for (const v of verts) { mx += v.x; mz += v.z; }
  mx /= verts.length; mz /= verts.length;
  let cxx = 0, cxz = 0, czz = 0;
  for (const v of verts) {
    const dx = v.x - mx, dz = v.z - mz;
    cxx += dx * dx; cxz += dx * dz; czz += dz * dz;
  }
  const ang = 0.5 * Math.atan2(2 * cxz, cxx - czz);
  const e1x = Math.cos(ang), e1z = Math.sin(ang);
  const e2x = -e1z, e2z = e1x;
  const proj = (v: THREE.Vector3) => (v.x - mx) * e1x + (v.z - mz) * e1z;
  const perp = (x: number, z: number) => (x - mx) * e2x + (z - mz) * e2z;

  let umin = Infinity, umax = -Infinity;
  const pre = tris.map((t) => {
    const u = t.map(proj);
    for (const x of u) { umin = Math.min(umin, x); umax = Math.max(umax, x); }
    return { t, u, lo: Math.min(...u), hi: Math.max(...u) };
  });

  const samples: ({ p: THREE.Vector3; w: number } | null)[] = [];
  for (let u = umin + 0.05; u <= umax - 0.05; u += step) {
    let pmin = Infinity, pmax = -Infinity, ys = 0, yn = 0;
    for (const p of pre) {
      if (u < p.lo || u > p.hi) continue;
      for (let e = 0; e < 3; e++) {
        const i = e, j = (e + 1) % 3;
        const ui = p.u[i], uj = p.u[j];
        if ((ui - u) * (uj - u) > 0 || ui === uj) continue;
        const k = (u - ui) / (uj - ui);
        const A = p.t[i], B = p.t[j];
        const x = A.x + (B.x - A.x) * k, z = A.z + (B.z - A.z) * k, y = A.y + (B.y - A.y) * k;
        const q = perp(x, z);
        if (q < pmin) pmin = q;
        if (q > pmax) pmax = q;
        ys += y; yn++;
      }
    }
    if (yn === 0) { samples.push(null); continue; }
    const c = (pmin + pmax) / 2;
    samples.push({
      p: new THREE.Vector3(mx + e1x * u + e2x * c, ys / yn, mz + e1z * u + e2z * c),
      w: pmax - pmin,
    });
  }

  const widths = samples.filter(Boolean).map((s) => s!.w).sort((a, b) => a - b);
  const medianW = widths[widths.length >> 1] || 1;
  const runs: THREE.Vector3[][] = [];
  let cur: THREE.Vector3[] = [];
  for (const s of samples) {
    if (s && s.w < medianW * 2.2 + 0.4) cur.push(s.p);
    else { if (cur.length) runs.push(cur); cur = []; }
  }
  if (cur.length) runs.push(cur);

  return runs
    .map((pts) => smooth(pts, 3))
    .map((pts) => new Polyline(pts))
    .filter((pl) => pl.length > 20);
}

function smooth(pts: THREE.Vector3[], passes: number) {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    p = p.map((v, i) => {
      if (i === 0 || i === p.length - 1) return v.clone();
      return new THREE.Vector3().addVectors(p[i - 1], p[i + 1]).addScaledVector(v, 2).multiplyScalar(0.25);
    });
  }
  return p;
}

// Sweeps a 2D cross-section along a list of 3D points (profile u = sideways, v = up).
// Returns a non-indexed BufferGeometry with uv.x = profile distance, uv.y = path distance.
export function sweep(
  points: THREE.Vector3[], profile: [number, number][],
  { uScale = 1, vScale = 1, closed = false, swapUV = false }: { uScale?: number; vScale?: number; closed?: boolean; swapUV?: boolean } = {},
) {
  const pos: number[] = [], uv: number[] = [];
  const n = points.length;
  const rights = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    const t = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    return new THREE.Vector3(-t.z, 0, t.x);
  });
  const along = [0];
  for (let i = 1; i < n; i++) along.push(along[i - 1] + points[i].distanceTo(points[i - 1]));
  const profLen = [0];
  for (let j = 1; j < profile.length; j++) {
    profLen.push(profLen[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
  }
  const P = (i: number, j: number) => {
    const r = rights[i], p = points[i];
    return [p.x + r.x * profile[j][0], p.y + profile[j][1], p.z + r.z * profile[j][0]];
  };
  const segs = closed ? profile.length : profile.length - 1;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const j2 = (j + 1) % profile.length;
      const a = P(i, j), b = P(i, j2), c = P(i + 1, j2), d = P(i + 1, j);
      const ua = profLen[j] * uScale, ub = (j2 === 0 ? profLen[j] + 1 : profLen[j2]) * uScale;
      const va = along[i] * vScale, vb = along[i + 1] * vScale;
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      if (swapUV) uv.push(va, ua, va, ub, vb, ub, va, ua, vb, ub, vb, ua);
      else uv.push(ua, va, ub, va, ub, vb, ua, va, ub, vb, ua, vb);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
