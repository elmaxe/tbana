import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Building blocks for the procedural trains.
//
// Car axes: +x is the direction of travel (the cab of a leading car is at +x), +y is up with 0 at the
// top of the rail, +z is to the right. A car body is a cross-section profile swept along x. Its ends
// are closed by "caps": a cab nose (a rounded, raked surface) or a flat gangway end. Liveries are
// painted on canvases in metres, so windows and doors are placed with real dimensions.

const V = THREE.Vector2;

export interface Paint { c: string; r?: number; m?: number; e?: string; a?: number }
export type ProfileCtrl = [z: number, y: number, r?: number];
export interface ProfilePoint { z: number; y: number; t: number; nz: number; ny: number }
export interface Profile {
  pts: ProfilePoint[]; w: number; yb: number; ytop: number;
  tMin: number; tMax: number; T: (y: number) => number;
}
export type Rim = (z: number, y: number) => number;
export type UvMap = (z: number, y: number) => [number, number];
export interface LoopPoint { z: number; y: number; nz: number; ny: number }
export interface CapOptions { k?: number; R?: number; face?: Rim; cy?: number; ni?: number; nb?: number; uv?: UvMap }
export interface BellowsOptions { scale?: number; pleat?: number; depth?: number; cy?: number }
export interface Band { sa: number; oa: number; sb: number; ob: number }
export interface PainterOptions { ty?: (y: number) => number; detail?: number; alpha?: boolean }
export interface TextOptions { font?: string; align?: CanvasTextAlign; ring?: number }
export type LayerKind = 'c' | 'orm' | 'e' | 'a';
export interface Layer { kind: LayerKind; s: number; cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D }
export type PainterTextures = Partial<Record<'c' | 'orm' | 'e' | 'ca', THREE.CanvasTexture>>;
export type AlphaMode = false | 'blend' | 'mask';
export interface BogieOptions { wheelbase?: number; wheelR?: number; inside?: boolean; gauge?: number; motors?: boolean }
export interface BogieGeometry { frame: THREE.BufferGeometry; wheels: THREE.BufferGeometry; shoe: THREE.BufferGeometry }
export interface DestinationSign { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>; set: (text: string) => void }

// ------------------------------------------------------------------ cross-section

// Half cross-section, from the bottom centre round the right side (+z) to the roof centre.
// `ctrl` is a list of [z, y, filletRadius]. Returns points with arc length `t` (0 at the bottom
// corner, roughly) and outward normals, plus `T(y)` that maps a height on the side to `t`.
export function profile(ctrl: ProfileCtrl[], step = 0.1): Profile {
  const poly: THREE.Vector2[] = [];
  for (let i = 0; i < ctrl.length; i++) {
    const [z, y, r = 0] = ctrl[i];
    const p = new V(z, y);
    if (i === 0 || i === ctrl.length - 1 || !r) { poly.push(p); continue; }
    const a = new V(ctrl[i - 1][0], ctrl[i - 1][1]), b = new V(ctrl[i + 1][0], ctrl[i + 1][1]);
    const d1 = p.clone().sub(a), l1 = d1.length(); d1.divideScalar(l1);
    const d2 = b.clone().sub(p), l2 = d2.length(); d2.divideScalar(l2);
    const ang = Math.acos(THREE.MathUtils.clamp(d1.dot(d2), -1, 1));
    if (ang < 1e-3) { poly.push(p); continue; }
    const tl = Math.min(r * Math.tan(ang / 2), l1 * 0.5, l2 * 0.5);
    const rr = tl / Math.tan(ang / 2);
    const p1 = p.clone().addScaledVector(d1, -tl);
    const turn = Math.sign(d1.x * d2.y - d1.y * d2.x);
    const n1 = turn > 0 ? new V(-d1.y, d1.x) : new V(d1.y, -d1.x);
    const c = p1.clone().addScaledVector(n1, rr);
    const a0 = Math.atan2(p1.y - c.y, p1.x - c.x);
    const segs = Math.max(2, Math.ceil(ang / 0.07));
    for (let k = 0; k <= segs; k++) {
      const th = a0 + turn * ang * (k / segs);
      poly.push(new V(c.x + rr * Math.cos(th), c.y + rr * Math.sin(th)));
    }
  }
  // split long straight runs so normals and caps stay smooth
  const pts = [poly[0]];
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i];
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / step));
    for (let k = 1; k <= n; k++) pts.push(a.clone().lerp(b, k / n));
  }
  const w = Math.max(...pts.map((p) => p.x));
  let cum = -w;
  const out = pts.map((p, i) => {
    if (i > 0) cum += p.distanceTo(pts[i - 1]);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tz = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tz, ty) || 1;
    return { z: p.x, y: p.y, t: cum, nz: ty / l, ny: -tz / l };
  });
  // the profile starts and ends on the centre line
  out[0].nz = 0; out[0].ny = -1;
  out[out.length - 1].nz = 0; out[out.length - 1].ny = 1;
  const side = out.filter((p) => p.t >= -0.02);
  const T = (y: number) => {
    if (y <= side[0].y) return side[0].t - (side[0].y - y);
    for (let i = 1; i < side.length; i++) {
      if (side[i].y >= y) {
        const a = side[i - 1], b = side[i];
        return a.t + ((y - a.y) / (b.y - a.y || 1)) * (b.t - a.t);
      }
    }
    return side[side.length - 1].t;
  };
  return {
    pts: out, w, yb: out[0].y, ytop: out[out.length - 1].y,
    tMin: -0.15, tMax: out[out.length - 1].t, T,
  };
}

// ------------------------------------------------------------------ body shell

// Side and roof of a car between x0 and x1. sb0/sb1(z, y) give how far each end of the shell is
// pulled in from x0/x1 (where a cab nose curves away). UVs: u along the car, v in two bands
// (right side 0–0.49, left side 0.51–1) of arc length, mirrored so lettering reads on both sides.
export function shellGeometry(prof: Profile, x0: number, x1: number, sb0: Rim, sb1: Rim) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const L = x1 - x0;
  const vb = (t: number) => (THREE.MathUtils.clamp(t, prof.tMin, prof.tMax) - prof.tMin) / (prof.tMax - prof.tMin) * 0.49;
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (const p of prof.pts) {
      const z = p.z * side;
      const xa = x0 + sb0(z, p.y), xb = x1 - sb1(z, p.y);
      for (const x of [xa, xb]) {
        pos.push(x, p.y, z);
        nor.push(0, p.ny, p.nz * side);
        uv.push(side > 0 ? (x - x0) / L : (x1 - x) / L, (side > 0 ? 0 : 0.51) + vb(p.t));
      }
    }
    for (let j = 0; j < prof.pts.length - 1; j++) {
      const a = base + j * 2, b = a + 1, c = a + 2, d = a + 3;
      if (side > 0) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Closed loop of the full cross-section (right half, then the left half back down).
export function loopOf(prof: Profile) {
  const P = prof.pts;
  const loop = P.map((p) => ({ z: p.z, y: p.y, nz: p.nz, ny: p.ny }));
  for (let j = P.length - 2; j >= 1; j--) loop.push({ z: -P[j].z, y: P[j].y, nz: -P[j].nz, ny: P[j].ny });
  return loop;
}

// End cap. The surface is the cross-section shrunk towards (0, cy), pushed back along x by
//   setback = R·(1 − cos θ) in an outer band of relative width k (a rounded edge), plus face(z, y)
// for the shape of the nose. dir = +1 for an end at +x. Returns the geometry and setback(z, y) at
// the rim so the shell can be trimmed to meet it.
export function capGeometry(prof: Profile, xEnd: number, dir: number, { k = 0.05, R = 0.03, face = () => 0, cy, ni = 6, nb = 9, uv }: CapOptions = {}) {
  cy ??= (prof.yb + prof.ytop) / 2;
  const loop = loopOf(prof);
  const rings = [];
  for (let i = 0; i <= ni; i++) rings.push({ r: ((1 - k) * i) / ni, base: 0 });
  for (let m = 1; m <= nb; m++) {
    const th = (Math.PI / 2) * (m / nb);
    rings.push({ r: 1 - k + k * Math.sin(th), base: R * (1 - Math.cos(th)) });
  }
  const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (const ring of rings) {
    for (const p of loop) {
      const z = p.z * ring.r, y = cy + (p.y - cy) * ring.r;
      const x = xEnd - dir * (ring.base + face(z, y));
      pos.push(x, y, z);
      const [u, v] = uv ? uv(z, y) : [0.5, 0.5];
      uvs.push(u, v);
    }
  }
  const M = loop.length;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let m = 0; m < M; m++) {
      const a = i * M + m, b = i * M + ((m + 1) % M), c = (i + 1) * M + m, d = (i + 1) * M + ((m + 1) % M);
      if (dir > 0) idx.push(a, b, c, b, d, c);
      else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // rim normals match the shell so the seam does not show
  const n = g.attributes.normal, last = (rings.length - 1) * M;
  for (let m = 0; m < M; m++) n.setXYZ(last + m, 0, loop[m].ny, loop[m].nz);
  return { geometry: g, rim: (z: number, y: number) => R + face(z, y) };
}

// Pleated rubber bellows between two car bodies.
export function bellowsGeometry(prof: Profile, xa: number, xb: number, { scale = 0.95, pleat = 0.05, depth = 0.035, cy }: BellowsOptions = {}) {
  cy ??= (prof.yb + prof.ytop) / 2;
  const loop = loopOf(prof).filter((_, i) => i % 3 === 0);
  const n = Math.max(2, Math.round((xb - xa) / (pleat / 2)));
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = xa + ((xb - xa) * i) / n;
    const s = i % 2 ? scale - depth : scale;
    for (const p of loop) pos.push(x, cy + (p.y - cy) * s, p.z * s);
  }
  const M = loop.length;
  for (let i = 0; i < n; i++) {
    for (let m = 0; m < M; m++) {
      const a = i * M + m, b = i * M + ((m + 1) % M), c = (i + 1) * M + m, d = (i + 1) * M + ((m + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ painting

const toPx = (v: number) => Math.round(v);

// Paints liveries in metres onto three canvases at once: colour, roughness/metalness (G/B) and
// emission. `bands` are affine maps from (a, b) metres to canvas pixels: px = sa·a + oa,
// py = sb·b + ob. `ty` converts a height to the band's vertical coordinate.
// Options: `alpha` adds a fourth canvas for opacity (a paint's `a`, default 1), used for glass you
// can see through and for holes cut in interior panels.
export class Painter {
  W: number; H: number; bands: Band[]; ty: (y: number) => number;
  layers: Layer[];
  uv?: UvMap;
  _tex?: PainterTextures;

  constructor(W: number, H: number, bands: Band[], { ty = (y: number) => y, detail = 0.5, alpha = false }: PainterOptions = {}) {
    this.W = W; this.H = H; this.bands = bands; this.ty = ty;
    this.layers = [];
    const kinds: [LayerKind, number][] = [['c', 1], ['orm', detail], ['e', detail]];
    if (alpha) kinds.push(['a', 1]);
    for (const [kind, s] of kinds) {
      const cv = document.createElement('canvas');
      cv.width = toPx(W * s); cv.height = toPx(H * s);
      const ctx = cv.getContext('2d')!;
      this.layers.push({ kind, s, cv, ctx });
    }
  }

  styleFor(kind: LayerKind, m: Paint) {
    if (kind === 'c') return m.c;
    if (kind === 'orm') return `rgb(255,${Math.round((m.r ?? 0.5) * 255)},${Math.round((m.m ?? 0) * 255)})`;
    if (kind === 'a') { const g = Math.round((m.a ?? 1) * 255); return `rgb(${g},${g},${g})`; }
    return m.e || '#000';
  }

  // Run a path-building function in metre space for every band and layer, then fill it.
  fill(build: (ctx: CanvasRenderingContext2D) => void, m: Paint, rule: CanvasFillRule = 'nonzero') {
    for (const L of this.layers) {
      for (const B of this.bands) {
        L.ctx.setTransform(B.sa * L.s, 0, 0, B.sb * L.s, B.oa * L.s, B.ob * L.s);
        L.ctx.beginPath();
        build(L.ctx);
        L.ctx.fillStyle = this.styleFor(L.kind, m);
        L.ctx.fill(rule);
      }
      L.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  // Axis-aligned rectangle; ya/yb are heights (converted with ty), optional corner radius r.
  rect(a0: number, a1: number, ya: number, yb: number, m: Paint, r = 0) {
    const b0 = this.ty(ya), b1 = this.ty(yb);
    this.fill((ctx) => {
      if (r) ctx.roundRect(Math.min(a0, a1), Math.min(b0, b1), Math.abs(a1 - a0), Math.abs(b1 - b0), r);
      else ctx.rect(Math.min(a0, a1), Math.min(b0, b1), Math.abs(a1 - a0), Math.abs(b1 - b0));
    }, m);
  }

  // Same, with the vertical range given directly in band units (arc length on the side).
  rectT(a0: number, a1: number, b0: number, b1: number, m: Paint) {
    this.fill((ctx) => ctx.rect(a0, b0, a1 - a0, b1 - b0), m);
  }

  poly(points: [number, number][], m: Paint) {
    this.fill((ctx) => {
      points.forEach(([a, y], i) => (i ? ctx.lineTo(a, this.ty(y)) : ctx.moveTo(a, this.ty(y))));
      ctx.closePath();
    }, m);
  }

  // Outline of a rectangle, `lw` metres wide, drawn inside the given bounds.
  frame(a0: number, a1: number, ya: number, yb: number, lw: number, m: Paint, r = 0) {
    const b0 = this.ty(ya), b1 = this.ty(yb);
    this.fill((ctx) => {
      ctx.roundRect(a0, b0, a1 - a0, b1 - b0, r);
      ctx.roundRect(a0 + lw, b0 + lw, a1 - a0 - 2 * lw, b1 - b0 - 2 * lw, Math.max(0, r - lw));
    }, m, 'evenodd');
  }

  ellipse(a: number, y: number, ra: number, rb: number, m: Paint) {
    const b = this.ty(y);
    this.fill((ctx) => ctx.ellipse(a, b, ra, rb, 0, 0, Math.PI * 2), m);
  }

  // Text is never mirrored: it is drawn upright at the anchor's pixel position in each band.
  text(a: number, y: number, str: string, size: number, m: Paint, { font = '700 {px}px Arial, Helvetica, sans-serif', align = 'center', ring = 0 }: TextOptions = {}) {
    const b = this.ty(y);
    for (const L of this.layers) {
      for (const B of this.bands) {
        const px = (B.sa * a + B.oa) * L.s, py = (B.sb * b + B.ob) * L.s;
        const fs = Math.abs(B.sb) * size * L.s;
        const ctx = L.ctx;
        ctx.save();
        ctx.font = font.replace('{px}', fs.toFixed(1));
        ctx.textAlign = align; ctx.textBaseline = 'middle';
        ctx.fillStyle = this.styleFor(L.kind, m);
        ctx.fillText(str, px, py);
        if (ring) {
          ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = fs * 0.08;
          ctx.beginPath(); ctx.arc(px, py, fs * ring, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // SL roundel: the letters in a ring with the "wave" underline.
  logo(a: number, y: number, size: number, m: Paint) {
    this.text(a, y + size * 0.05, 'SL', size * 0.55, m, { font: '800 italic {px}px Arial, Helvetica, sans-serif', ring: 0.92 });
  }

  textures(aniso = 8) {
    if (this._tex) return this._tex;
    const out: PainterTextures = {};
    for (const L of this.layers) {
      if (L.kind === 'a') continue;
      const t = new THREE.CanvasTexture(L.cv);
      if (L.kind !== 'orm') t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
      out[L.kind] = t;
    }
    const A = this.layers.find((L) => L.kind === 'a');
    if (A) {
      // colour with the alpha canvas in its alpha channel (glTF keeps opacity in the base colour)
      const C = this.layers.find((L) => L.kind === 'c')!;
      const cv = document.createElement('canvas');
      cv.width = C.cv.width; cv.height = C.cv.height;
      const ctx = cv.getContext('2d')!;
      const img = C.ctx.getImageData(0, 0, cv.width, cv.height);
      const a = A.ctx.getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = a[i - 1];
      ctx.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
      out.ca = t;
    }
    this._tex = out;
    return out;
  }

  // alpha: false (opaque), 'blend' (see-through glass) or 'mask' (holes cut out).
  material(extra: THREE.MeshStandardMaterialParameters = {}, alpha: AlphaMode = false) {
    const t = this.textures();
    const opts = alpha === 'blend' ? { map: t.ca, transparent: true }
      : alpha === 'mask' ? { map: t.ca, alphaTest: 0.5 } : { map: t.c };
    return new THREE.MeshStandardMaterial({
      ...opts, roughnessMap: t.orm, metalnessMap: t.orm, roughness: 1, metalness: 1,
      emissiveMap: t.e, emissive: 0xffffff, emissiveIntensity: 1, ...extra,
    });
  }
}

// Painter for a car side. Coordinates: a = x along the car, vertical = height (or arc length via rectT).
// `inside` paints the inner lining (liningGeometry), whose sides are seen from the other face.
export function sidePainter(prof: Profile, x0: number, x1: number, ppm: number, { inside = false, ...opts }: PainterOptions & { inside?: boolean } = {}) {
  const L = x1 - x0, span = prof.tMax - prof.tMin;
  const W = Math.min(4096, Math.ceil(L * ppm)), H = Math.min(2048, Math.ceil((span * ppm) / 0.49));
  const vs = 0.49 / span;
  const band = (vOff: number, mirror: boolean): Band => ({
    sa: (mirror ? -W : W) / L, oa: mirror ? (x1 * W) / L : (-x0 * W) / L,
    sb: -H * vs, ob: H * (1 - vOff + prof.tMin * vs),
  });
  return new Painter(W, H, [band(0, inside), band(0.51, !inside)], { ty: prof.T, ...opts });
}

// Painter for the front of a cab, projected flat onto the (z, y) plane as seen from ahead.
export function frontPainter(prof: Profile, ppm: number) {
  const w = prof.w, h = prof.ytop - prof.yb;
  const W = Math.ceil(2 * w * ppm), H = Math.ceil(h * ppm);
  const p = new Painter(W, H, [{ sa: -W / (2 * w), oa: W / 2, sb: -H / h, ob: (H * prof.ytop) / h }]);
  p.uv = (z: number, y: number) => [0.5 - z / (2 * w), (y - prof.yb) / h];
  return p;
}

// ------------------------------------------------------------------ parts

export function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

export function cyl(r: number, len: number, x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'z', seg = 16) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  else if (axis === 'x') g.rotateZ(Math.PI / 2);
  return g.translate(x, y, z);
}

export function merge(list: THREE.BufferGeometry[]) {
  const clean = list.map((g) => {
    const n = g.clone();
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((n.attributes.position.count) * 2), 2));
    if (!n.attributes.normal) n.computeVertexNormals();
    if (!n.index) n.setIndex([...Array(n.attributes.position.count).keys()]);
    n.clearGroups();
    return n;
  });
  return mergeGeometries(clean, false);
}

// A two-axle bogie centred on x = 0. Returns geometry per material: frame, wheels, shoe.
export function bogieGeometry({ wheelbase = 2.1, wheelR = 0.39, inside = false, gauge = 1.435, motors = true }: BogieOptions = {}): BogieGeometry {
  const frame: THREE.BufferGeometry[] = [], wheels: THREE.BufferGeometry[] = [], shoe: THREE.BufferGeometry[] = [];
  const g2 = gauge / 2 + 0.035;
  const fz = inside ? g2 - 0.2 : g2 + 0.22;
  const ax = [-wheelbase / 2, wheelbase / 2];
  for (const x of ax) {
    for (const s of [-1, 1]) {
      wheels.push(cyl(wheelR, 0.13, x, wheelR, s * g2, 'z', 28));
      wheels.push(cyl(wheelR * 0.55, 0.16, x, wheelR, s * (g2 - 0.02), 'z', 16));
      frame.push(box(0.36, 0.26, 0.22, x, wheelR, s * fz)); // axle box
      frame.push(cyl(0.09, 0.22, x, wheelR + 0.24, s * fz, 'y', 10)); // primary spring
    }
    frame.push(cyl(0.07, gauge + 0.1, x, wheelR, 0, 'z', 10)); // axle
  }
  for (const s of [-1, 1]) {
    // side frame: deeper in the middle where it sits over the secondary springs
    frame.push(box(wheelbase + 0.75, 0.16, 0.2, 0, wheelR + 0.42, s * fz));
    frame.push(box(1.0, 0.3, 0.22, 0, wheelR + 0.3, s * fz));
    frame.push(cyl(0.17, 0.2, 0, wheelR + 0.44, s * fz, 'y', 16)); // air spring, up to the underframe
    frame.push(box(0.5, 0.14, 0.12, 0, wheelR + 0.3, s * (fz + (inside ? -0.17 : 0.17)))); // damper bracket
    // third-rail collector: an insulated beam on the axle boxes and a shoe outside the wheels
    shoe.push(box(0.12, 0.08, 0.5, ax[1], wheelR - 0.05, s * (fz + 0.28)));
    shoe.push(box(0.36, 0.05, 0.16, ax[1], 0.17, s * (g2 + 0.62)));
    shoe.push(box(0.08, 0.26, 0.08, ax[1], 0.28, s * (g2 + 0.55)));
  }
  frame.push(box(0.55, 0.28, 2 * fz, 0, wheelR + 0.3, 0)); // transom
  if (motors) {
    for (const x of ax) {
      frame.push(cyl(0.24, 0.62, x * 0.35, wheelR + 0.02, 0.18, 'z', 14)); // traction motor
      frame.push(box(0.3, 0.32, 0.36, x * 0.62, wheelR, -0.38)); // gearbox
    }
  }
  frame.push(box(0.12, 0.08, 1.7, ax[0] - 0.35, 0.16, 0)); // ATC antenna beam
  return { frame: merge(frame), wheels: merge(wheels), shoe: merge(shoe) };
}

// Scharfenberg-type automatic coupler pointing along +x from x = 0.
export function couplerGeometry(len = 0.75, y = 0.78) {
  return merge([
    cyl(0.07, len, len / 2 - 0.1, y, 0, 'x', 12),
    box(0.26, 0.3, 0.34, len, y, 0),
    box(0.06, 0.14, 0.2, len + 0.15, y - 0.02, 0.06),
    box(0.3, 0.18, 0.5, 0.05, y, 0),
  ]);
}

// Tiling normal map of horizontal corrugations (C20 side panels).
export function corrugationNormalMap() {
  const cv = document.createElement('canvas');
  cv.width = 8; cv.height = 64;
  const ctx = cv.getContext('2d')!;
  for (let y = 0; y < 64; y++) {
    const s = Math.sin((y / 64) * Math.PI * 2);
    const ny = s * 0.75;
    const nz = Math.sqrt(1 - ny * ny);
    ctx.fillStyle = `rgb(128,${Math.round((ny * 0.5 + 0.5) * 255)},${Math.round((nz * 0.5 + 0.5) * 255)})`;
    ctx.fillRect(0, y, 8, 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Destination display: a small emissive panel with its own canvas.
export function destinationSign(width: number, height: number): DestinationSign {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round((512 * height) / width);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, roughness: 0.2, metalness: 0 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.name = 'destination';
  const set = (text: string) => {
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#ffae1a';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = cv.height * 0.72;
    ctx.font = `700 ${fs}px Arial, Helvetica, sans-serif`;
    const tw = ctx.measureText(text).width;
    if (tw > cv.width * 0.92) { fs *= (cv.width * 0.92) / tw; ctx.font = `700 ${fs}px Arial, Helvetica, sans-serif`; }
    ctx.fillText(text, cv.width / 2, cv.height / 2 + 1);
    tex.needsUpdate = true;
  };
  set('');
  return { mesh, set };
}

// Shared materials for running gear and other dark parts under the body.
export const DARK = {
  bogie: new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.7, metalness: 0.4 }),
  wheel: new THREE.MeshStandardMaterial({ color: 0x6f7377, roughness: 0.35, metalness: 0.9 }),
  shoe: new THREE.MeshStandardMaterial({ color: 0x3b2f22, roughness: 0.8, metalness: 0.1 }),
  bellows: new THREE.MeshStandardMaterial({ color: 0x2b2a29, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
};

// Shared light materials so a train can switch head/tail lights by swapping materials.
export const LIGHTS = {
  headOn: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 2.2, roughness: 0.1 }),
  headOff: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.15, metalness: 0.6 }),
  tailOn: new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff1a0a, emissiveIntensity: 2.0, roughness: 0.2 }),
  tailOff: new THREE.MeshStandardMaterial({ color: 0x5a1712, roughness: 0.25, metalness: 0.2 }),
};

// Skirt under a cab nose: a slab whose front edge follows xFront(z) in plan, from y0 to y1,
// reaching back to xBack and out to ±w.
export function noseSkirtGeometry(xFront: (z: number) => number, xBack: number, w: number, y0: number, y1: number, seg = 24) {
  const s = new THREE.Shape();
  // drawn in (x, −z) so that rotating the extrusion up maps the shape onto the ground plane
  s.moveTo(xBack, -w);
  for (let i = 0; i <= seg; i++) {
    const z = w - (2 * w * i) / seg;
    s.lineTo(xFront(z), -z);
  }
  s.lineTo(xBack, w);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  g.computeVertexNormals();
  return g;
}
