import * as THREE from 'three';
import type { Volume } from './clip.ts';
import { prism } from './clip.ts';
import { Mesh, bar, box, slab, taper } from './poly-mesh.ts';
import { CANOPY_HEIGHT } from './station-layout.ts';
import type { CanopyPart, FloorPart, InclinePart, StationLayout, XYZ } from './station-layout.ts';
import { OPEN_STYLES } from './open-styles';
import type { Block, ButterflyRoof, Fence, Finish, Guardian, OpenStyle, Panels, Room, Stacks } from './open-styles';
import * as T from './textures';

// The styled open stations' own look (src/open-styles.ts), for src/stations.ts: the roof over
// the platform and what stands under it, the shells of their buildings, their fences, and the
// finishes of their halls, passages and stairs.

// A station's frame: s along its platform from the middle, the way it faces, u to the right,
// heights above the platform's top.
export class Frame {
  readonly fx: number;
  readonly fz: number;
  constructor(readonly st: StationLayout) {
    this.fx = -Math.sin(st.yaw);
    this.fz = -Math.cos(st.yaw);
  }
  s(x: number, z: number) { return (x - this.st.x) * this.fx + (z - this.st.z) * this.fz; }
  u(x: number, z: number) { return -(x - this.st.x) * this.fz + (z - this.st.z) * this.fx; }
  at(s: number, u: number, h: number): XYZ {
    return [this.st.x + this.fx * s - this.fz * u, this.st.platformY + h, this.st.z + this.fz * s + this.fx * u];
  }
}

// The line down the middle of a platform, through its roof's points, carried on straight past
// its ends: s as the frame's, u to the right of the line, heights above the platform's top.
class Line {
  private pts: { s: number; x: number; y: number; z: number }[];
  constructor(frame: Frame, canopy: CanopyPart) {
    this.pts = canopy.points.map(([x, y, z]) => ({ s: frame.s(x, z), x, y: y - CANOPY_HEIGHT, z })).sort((a, b) => a.s - b.s);
  }
  private mid(s: number): XYZ {
    const p = this.pts;
    let i = 0;
    while (i < p.length - 2 && p[i + 1].s < s) i++;
    const a = p[i], b = p[i + 1], t = (s - a.s) / (b.s - a.s || 1);
    return [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t];
  }
  dir(s: number): [number, number] {
    const a = this.mid(s - 0.5), b = this.mid(s + 0.5), l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
    return [(b[0] - a[0]) / l, (b[2] - a[2]) / l];
  }
  at(s: number, u: number, h: number): XYZ {
    const c = this.mid(s), [fx, fz] = this.dir(s);
    return [c[0] - fz * u, c[1] + h, c[2] + fx * u];
  }
}

// The room whose finishes a floor or a flight of stairs takes: the first that holds the middle
// of its floor (its lowest end, for stairs).
export function roomOf(style: OpenStyle, frame: Frame, p: FloorPart | InclinePart): Room | null {
  const pts = p.kind === 'floor' ? p.corners : [p.a, p.b];
  const x = pts.reduce((t, c) => t + c[0], 0) / pts.length, z = pts.reduce((t, c) => t + c[2], 0) / pts.length;
  const s = frame.s(x, z), u = frame.u(x, z), h = Math.min(...pts.map((c) => c[1])) - frame.st.platformY;
  return style.rooms.find((r) => s >= r.s[0] && s <= r.s[1] && h >= r.h[0] && h <= r.h[1] && (!r.u || (u >= r.u[0] && u <= r.u[1]))) ?? null;
}

// The style's building shells as volumes: the street around an exit runs on under a
// street-level hall, but isn't there to be stepped onto from inside it.
export function blockVolumes(style: OpenStyle, frame: Frame): Volume[] {
  return (style.blocks ?? []).map((b) => {
    const y0 = frame.st.platformY + (b.from ?? 0) - 1, y1 = frame.st.platformY + b.h[1];
    const c = b.plan.map(([s, u]): [number, number] => { const p = frame.at(s, u, 0); return [p[0], p[2]]; });
    return prism(c, c.map(() => y0), c.map(() => y1));
  });
}

type On = (m: THREE.Material) => Mesh;

export class OpenLook {
  private mats = new Map<string, THREE.Material>();

  style(st: StationLayout): OpenStyle | null { return OPEN_STYLES[st.name] ?? null; }

  private mat(key: string, make: () => THREE.Material) {
    let m = this.mats.get(key);
    if (!m) this.mats.set(key, m = make());
    return m;
  }
  private color(color: number, roughness = 0.6, metalness = 0) {
    return this.mat(`color:${color}:${roughness}:${metalness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide }));
  }

  // A finish's surface; its glass, if it has any, is left clear (drawn apart, `pane`). On a
  // ceiling, lit from below by the hemisphere's dark ground colour: so a little light of its own.
  finish(f: Finish, ceiling = false) {
    return this.mat(`finish:${f}:${ceiling}`, () => {
      const map = T.finish(f);
      return new THREE.MeshStandardMaterial({
        map, roughness: f === 'triangles' || f === 'darkStone' ? 0.4 : 0.8, alphaTest: T.FINISH_GLASS.includes(f) ? 0.5 : 0,
        emissive: ceiling ? 0x3a3936 : 0x000000, emissiveMap: ceiling ? map : null, side: THREE.DoubleSide,
      });
    });
  }
  // (behind the frames in front of it)
  get pane() {
    return this.mat('pane', () => new THREE.MeshStandardMaterial({
      color: 0xbfd2d8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    }));
  }
  get roofing() { return this.color(0x4a4e52, 0.8, 0.2); }

  // The roof over a platform, and its columns, lamps and signs, the art and benches under it;
  // `cut` by the station's spaces.
  roofOver(st: StationLayout, style: OpenStyle, canopy: CanopyPart, on: On, cut: Volume[], group: THREE.Group) {
    const line = new Line(new Frame(st), canopy);
    this.butterfly(st.name, style, line, on, cut, group);
    for (const a of style.art ?? []) {
      if (a.kind === 'guardian') this.guardian(a, line, on);
      else if (a.kind === 'stacks') this.stacks(a, line, on);
      else this.panels(a, style.roof, line, on);
    }
    const B = style.benches;
    for (const s of B?.at ?? []) {
      if (B!.across) this.benchAcross(s, line, on);
      else this.bench(s, line, on);
    }
  }

  // Where the roof's columns stand along the platform.
  private columns(R: ButterflyRoof) {
    const C = R.columns, out: number[] = [];
    for (let s = C.at - Math.floor((C.at - R.from) / C.every) * C.every; s < R.to - 0.5; s += C.every) if (s >= R.from + 0.5) out.push(s);
    return out;
  }

  // The shells of its buildings and its fences.
  build(st: StationLayout, style: OpenStyle, on: On, cut: Volume[]) {
    const frame = new Frame(st);
    for (const b of style.blocks ?? []) this.block(b, frame, on, cut);
    for (const f of style.fences ?? []) this.fence(f, frame, on);
  }

  private butterfly(name: string, style: OpenStyle, line: Line, on: On, cut: Volume[], group: THREE.Group) {
    const R: ButterflyRoof = style.roof, hw = R.width / 2;
    const under = on(this.mat(`under:${R.colors.underside}`, () => {
      const map = T.roofBoards(R.colors.underside);
      return new THREE.MeshStandardMaterial({ map, emissive: 0x3a3a38, emissiveMap: map, roughness: 0.8, side: THREE.DoubleSide });
    }));
    const top = on(this.color(R.colors.top, 0.6, 0.3)), fascia = on(this.color(R.colors.fascia, 0.6, 0.2));
    const steel = on(this.color(R.colors.steel, 0.5, 0.4)), casing = on(this.color(0x3a3d41, 0.7, 0.2));
    const lamp = on(this.mat('lamp', () => new THREE.MeshBasicMaterial({ color: 0xfff5e0, side: THREE.DoubleSide })));
    const concrete = on(this.mat('plinth', () => new THREE.MeshStandardMaterial({ map: T.concrete(21, 170), color: 0xb5b1a9, roughness: 0.9, side: THREE.DoubleSide })));
    // the underside's height across the roof
    const h = (u: number) => R.middle + (R.edge - R.middle) * Math.min(1, Math.abs(u) / hw);
    const n = Math.max(1, Math.ceil((R.to - R.from) / 2.5));
    const S = (i: number) => R.from + ((R.to - R.from) * i) / n;
    const lip = R.thick - R.fascia, crest = R.thick + 0.05;
    const C = R.columns, beams = C.pair ? [-C.pair / 2, C.pair / 2] : [0];
    for (let i = 0; i < n; i++) {
      const s0 = S(i), s1 = S(i + 1);
      for (const side of [-1, 1]) {
        const e = side * hw, ei = side * (hw - 0.05);
        // the boarding under it (u across, the boards along it), and the covering over it
        const q = (s: number, u: number, dh: number) => [...line.at(s, u, h(u) + dh), u, s / 2.4];
        under.poly([q(s0, 0, 0), q(s0, e, 0), q(s1, e, 0), q(s1, 0, 0)], cut);
        top.poly([q(s0, 0, R.thick), q(s0, e, R.thick), q(s1, e, R.thick), q(s1, 0, R.thick)], cut);
        // the fascia along its edge, down past the underside and back in under it
        const p = (s: number, u: number, dh: number) => [...line.at(s, u, h(e) + dh), 0, 0];
        fascia.poly([p(s0, e, lip), p(s1, e, lip), p(s1, e, crest), p(s0, e, crest)], cut);
        fascia.poly([p(s0, e, lip), p(s1, e, lip), p(s1, ei, lip), p(s0, ei, lip)], cut);
        fascia.poly([p(s0, ei, lip), p(s1, ei, lip), p(s1, ei, 0), p(s0, ei, 0)], cut);
      }
      // the beam along the valley, or one over each row of columns
      for (const u of beams) bar(steel, line.at(s0, u, h(u)), line.at(s1, u, h(u)), 0.2, R.beam, cut);
    }
    // and across its ends
    for (const s of [R.from, R.to]) for (const side of [-1, 1]) {
      const e = side * hw, p = (u: number, dh: number) => [...line.at(s, u, h(u) + dh), 0, 0];
      fascia.poly([p(0, lip), p(e, lip), p(e, crest), p(0, crest)], cut);
    }
    // the rafters across the underside
    const [rw, rd] = R.rafterSize ?? [0.05, 0.1];
    for (let s = R.from + R.rafters / 2; s < R.to; s += R.rafters) {
      for (const side of [-1, 1]) bar(under, line.at(s, 0, h(0)), line.at(s, side * (hw - 0.05), h(hw - 0.05)), rw, rd, cut);
    }
    // strip lights, hung under the rafters
    const L = R.lamps;
    for (let s = R.from + L.every / 2; s < R.to; s += L.every) for (const side of [-1, 1]) {
      const u = side * L.offset, [fx, fz] = line.dir(s);
      box(under, line.at(s, u, h(u) - 0.13), fx, fz, 0.16, 0.05, L.length + 0.05, cut);
      box(lamp, line.at(s, u, h(u) - 0.16), fx, fz, 0.1, 0.02, L.length, cut);
    }
    // the columns, on plinths, under the beams; a casing round those with a sculpture beside them
    const foot = R.middle - R.beam;
    for (const s of this.columns(R)) {
      const [fx, fz] = line.dir(s), art = style.art?.find((a): a is Guardian => a.kind === 'guardian' && Math.abs(a.s - s) < 0.5);
      for (const u of beams) {
        const top = h(u) - R.beam;
        box(concrete, line.at(s, u, C.plinth.height / 2), fx, fz, C.plinth.size, C.plinth.height, C.plinth.size, cut);
        if (art) box(casing, line.at(s, u, top / 2), fx, fz, art.casing[0], top, art.casing[1], cut);
        else box(steel, line.at(s, u, (C.plinth.height + top) / 2), fx, fz, C.size, top - C.plinth.height, C.size, cut);
      }
    }
    // name signs hung under the beam, the way out at each end of the platform to either side
    const W = 2.4, H = 0.6;
    for (const s of R.signs.at) {
      const [fx, fz] = line.dir(s), rx = -fz, rz = fx;
      const c = line.at(s, 0, foot - 0.12 - H / 2), hang = line.at(s, 0, foot)[1] - (c[1] + H / 2);
      box(fascia, c, fx, fz, 0.05, H + 0.02, W + 0.02, cut);
      for (const k of [-W / 2 + 0.2, W / 2 - 0.2]) box(steel, line.at(s + k, 0, foot - hang / 2), fx, fz, 0.03, hang, 0.03);
      for (const side of [1, -1]) {
        // (seen from the right of the line, its back end is to the left)
        const [left, right] = side > 0 ? [R.signs.back, R.signs.ahead] : [R.signs.ahead, R.signs.back];
        const m = this.mat(`sign:${name}:${left}:${right}`, () => new THREE.MeshBasicMaterial({ map: T.hangingSign(name, left, right) }));
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m);
        mesh.position.set(c[0] + rx * side * 0.03, c[1], c[2] + rz * side * 0.03);
        mesh.rotation.y = Math.atan2(rx * side, rz * side);
        group.add(mesh);
      }
    }
  }

  // A tall bronze figure on its plinth: two long legs, a slender body, a head with its mouth
  // forward and two long ears.
  private guardian(a: Guardian, line: Line, on: On) {
    const [fx, fz] = line.dir(a.s), rx = -fz, rz = fx;
    const dx = fx * Math.cos(a.turn) + rx * Math.sin(a.turn), dz = fz * Math.cos(a.turn) + rz * Math.sin(a.turn);
    const ex = -dz, ez = dx;
    const stone = on(this.color(0x1c1d1f, 0.35, 0.1));
    const bronze = on(this.mat('bronze', () => new THREE.MeshStandardMaterial({ map: T.bronze(), metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide })));
    const base = line.at(a.s, a.u, 0);
    box(stone, [base[0], base[1] + 0.2, base[2]], dx, dz, 0.8, 0.4, 0.7);
    const Hh = a.height, y0 = base[1] + 0.4;
    const P = (across: number, fwd: number, y: number): XYZ => [base[0] + ex * across + dx * fwd, y0 + y * Hh, base[2] + ez * across + dz * fwd];
    for (const k of [-1, 1]) taper(bronze, P(k * 0.075, 0, 0), P(k * 0.045, 0.01, 0.55), [0.05, 0.07], [0.07, 0.09], dx, dz);
    taper(bronze, P(0, 0.01, 0.53), P(0, 0.035, 0.8), [0.17, 0.11], [0.08, 0.08], dx, dz);
    taper(bronze, P(0, 0.035, 0.8), P(0, 0.06, 0.89), [0.08, 0.09], [0.075, 0.15], dx, dz);
    box(bronze, P(0, 0.14, 0.84), dx, dz, 0.05, 0.03, 0.04);
    for (const k of [-1, 1]) taper(bronze, P(k * 0.02, 0.03, 0.88), P(k * 0.075, 0, 1), [0.035, 0.03], [0.01, 0.012], dx, dz);
  }

  // Two columns of bronze slabs side by side, each slab a little wider at its top than at its
  // foot on the outer side, so that the column's outer edge is a sawtooth, on a low stone base.
  private stacks(a: Stacks, line: Line, on: On) {
    const [fx, fz] = line.dir(a.s), rx = -fz, rz = fx;
    const dx = fx * Math.cos(a.turn) + rx * Math.sin(a.turn), dz = fz * Math.cos(a.turn) + rz * Math.sin(a.turn);
    const ex = -dz, ez = dx;
    const stone = on(this.color(0x8a8780, 0.85));
    const bronze = on(this.mat('patina', () => new THREE.MeshStandardMaterial({ map: T.bronze(true), metalness: 0.5, roughness: 0.55, side: THREE.DoubleSide })));
    const base = line.at(a.s, a.u, 0);
    box(stone, [base[0], base[1] + 0.03, base[2]], dx, dz, 2.0, 0.06, 1.2);
    const r = (k: number) => { const v = Math.sin(k * 12.9898 + a.s * 78.233) * 43758.5453; return v - Math.floor(v); };
    for (const side of [-1, 1]) {
      const height = a.height * (side < 0 ? 1 : 0.94), n = Math.round(height / 0.115), t = height / n;
      for (let j = 0; j < n; j++) {
        // the inner faces flat and upright, 0.44 m apart; the outer edges stepping out and in
        const w0 = 0.34 + 0.03 * Math.sin(j * 0.7 + side) + 0.02 * r(j + side * 50), w1 = w0 + 0.06 + 0.02 * r(j + side * 90);
        const P = (w: number, y: number): XYZ => {
          const across = side * (0.22 + w / 2);
          return [base[0] + ex * across, base[1] + 0.06 + y, base[2] + ez * across];
        };
        taper(bronze, P(w0, j * t), P(w1, (j + 1) * t - 0.005), [w0, 0.42], [w1, 0.42], dx, dz);
      }
    }
  }

  // A panel in two colours between each pair of columns.
  private panels(a: Panels, R: ButterflyRoof, line: Line, on: On) {
    const pair = R.columns.pair;
    if (!pair) return;
    const w = (pair - R.columns.size) / 2, hh = a.top - a.bottom;
    this.columns(R).forEach((s, i) => {
      const [fx, fz] = line.dir(s), colors = a.colors[i % a.colors.length];
      colors.forEach((color, k) => {
        const m = on(this.mat(`lacquer:${color}`, () => new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 0.15, roughness: 0.55, metalness: 0, side: THREE.DoubleSide,
        })));
        box(m, line.at(s, (k - 0.5) * w, (a.bottom + a.top) / 2), fx, fz, w - 0.005, hh, 0.03);
      });
    });
  }

  private bench(s: number, line: Line, on: On) {
    const [fx, fz] = line.dir(s);
    const wood = on(this.color(0x8a5a32, 0.7)), steel = on(this.color(0x3a3d40, 0.5, 0.5));
    box(wood, line.at(s, 0, 0.44), fx, fz, 0.42, 0.05, 1.8);
    for (const k of [-0.7, 0.7]) box(steel, line.at(s + k, 0, 0.21), fx, fz, 0.36, 0.42, 0.06);
  }

  // A bench of dark planks across the platform on two concrete blocks, its back against the
  // panel between a pair of columns at `s`, facing back along the platform.
  private benchAcross(s: number, line: Line, on: On) {
    const [fx, fz] = line.dir(s);
    const wood = on(this.color(0x2e2b28, 0.7)), steel = on(this.color(0x3a3d40, 0.5, 0.5));
    const concrete = on(this.mat('plinth', () => new THREE.MeshStandardMaterial({ map: T.concrete(21, 170), color: 0xb5b1a9, roughness: 0.9, side: THREE.DoubleSide })));
    box(wood, line.at(s - 0.42, 0, 0.45), fx, fz, 1.9, 0.05, 0.44);
    for (const y of [0.66, 0.84]) box(wood, line.at(s - 0.17, 0, y), fx, fz, 1.9, 0.12, 0.03);
    for (const k of [-0.72, 0.72]) {
      box(concrete, line.at(s - 0.42, k, 0.2), fx, fz, 0.36, 0.4, 0.4);
      box(steel, line.at(s - 0.19, k, 0.62), fx, fz, 0.04, 0.44, 0.03);
    }
  }

  private block(b: Block, frame: Frame, on: On, cut: Volume[]) {
    const corners = b.plan, from = b.from ?? 0;
    const base = on(this.finish('boardConcrete'));
    for (let i = 0; i < 4; i++) {
      const [s0, u0] = corners[i], [s1, u1] = corners[(i + 1) % 4], l = Math.hypot(s1 - s0, u1 - u0);
      const P = (t: number, h: number) => frame.at(s0 + (s1 - s0) * t, u0 + (u1 - u0) * t, h);
      const f = b.sides?.[i] === undefined ? b.walls : b.sides[i];
      // the side's own finish up to the band, if there is one, and the band's above it
      const wall = (f: Finish, h0: number, h1: number) => {
        const [w, hh] = T.FINISH_SIZE[f];
        const q = [[...P(0, h0), 0, (h0 - from) / hh], [...P(1, h0), l / w, (h0 - from) / hh], [...P(1, h1), l / w, (h1 - from) / hh], [...P(0, h1), 0, (h1 - from) / hh]];
        on(this.finish(f)).poly(q, cut);
        if (T.FINISH_GLASS.includes(f)) on(this.pane).poly(q, cut);
      };
      const band = b.band && b.band.from < b.h[1] ? Math.max(from, b.band.from) : b.h[1];
      if (f && band > from) wall(f, from, band);
      if (b.band && band < b.h[1]) wall(b.band.walls, band, b.h[1]);
      if (b.h[0] < from) base.poly([[...P(0, b.h[0]), 0, b.h[0] / 2.4], [...P(1, b.h[0]), l / 2.4, b.h[0] / 2.4], [...P(1, from), l / 2.4, from / 2.4], [...P(0, from), 0, from / 2.4]], cut);
      // lit signs on the side, halfway up the band (or the wall), standing out from it
      const mid = b.band ? (band + b.h[1]) / 2 : (from + b.h[1]) / 2;
      const cs = corners.reduce((t, c) => t + c[0], 0) / 4, cu = corners.reduce((t, c) => t + c[1], 0) / 4;
      let ns = (u1 - u0) / l, nu = -(s1 - s0) / l;
      if (ns * ((s0 + s1) / 2 - cs) + nu * ((u0 + u1) / 2 - cu) < 0) { ns = -ns; nu = -nu; }
      for (const g of b.lights ?? []) {
        if (g.side !== i) continue;
        const sc = s0 + (s1 - s0) * g.at + ns * 0.05, uc = u0 + (u1 - u0) * g.at + nu * 0.05;
        const a = frame.at(sc, uc, mid), e = frame.at(sc + (s1 - s0) / l, uc + (u1 - u0) / l, mid);
        box(on(this.lightbox), a, e[0] - a[0], e[2] - a[2], 0.1, 0.42, g.length);
      }
    }
    if (b.roof) slab(on(this.roofing), corners.map(([s, u]) => frame.at(s, u, b.h[1] + b.roof!)), b.roof, 0.5, cut);
    if (b.ceiling) {
      const [cw] = T.FINISH_SIZE[b.ceiling];
      on(this.finish(b.ceiling, true)).poly(corners.map(([s, u]) => [...frame.at(s, u, b.h[1] - 0.01), u / cw, s / cw]), cut);
    }
    if (b.floor) {
      const [fw] = T.FINISH_SIZE[b.floor];
      on(this.finish(b.floor)).poly(corners.map(([s, u]) => [...frame.at(s, u, from - 0.02), u / fw, s / fw]), cut);
    }
  }

  // a lit sign's face: warm yellow, glowing
  private get lightbox() {
    return this.mat('lightbox', () => new THREE.MeshStandardMaterial({ color: 0xf6d21a, emissive: 0xf2c400, emissiveIntensity: 0.9, roughness: 0.4, side: THREE.DoubleSide }));
  }

  // Chain-link on posts every 2.5 m or so, with a rail along the top.
  private fence(f: Fence, frame: Frame, on: On) {
    const link = on(this.mat('chainLink', () => new THREE.MeshStandardMaterial({ map: T.chainLink(), alphaTest: 0.35, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide })));
    const post = on(this.color(0x9aa0a4, 0.45, 0.6));
    const [h0, h1] = f.h;
    let along = 0;
    for (let i = 0; i + 1 < f.points.length; i++) {
      const [sa, ua] = f.points[i], [sb, ub] = f.points[i + 1], l = Math.hypot(sb - sa, ub - ua), n = Math.max(1, Math.round(l / 2.5));
      const fs = (sb - sa) / l, fu = (ub - ua) / l;
      const d = frame.at(sb, ub, 0), c = frame.at(sa, ua, 0), fx = (d[0] - c[0]) / l, fz = (d[2] - c[2]) / l;
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const t = k / n;
        box(post, frame.at(sa + (sb - sa) * t, ua + (ub - ua) * t, (h0 + h1) / 2), fx, fz, 0.05, h1 - h0, 0.05);
      }
      const P = (t: number, h: number, a: number) => [...frame.at(sa + fs * l * t, ua + fu * l * t, h), a / 0.5, (h - h0) / 0.5];
      link.poly([P(0, h0, along), P(1, h0, along + l), P(1, h1, along + l), P(0, h1, along)]);
      bar(post, frame.at(sa, ua, h1 + 0.02), frame.at(sb, ub, h1 + 0.02), 0.04, 0.04);
      along += l;
    }
  }
}
