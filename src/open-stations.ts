import * as THREE from 'three';
import type { Volume } from './clip.ts';
import { prism } from './clip.ts';
import { Mesh, bar, box, slab, taper } from './poly-mesh.ts';
import { CANOPY_HEIGHT } from './station-layout.ts';
import type { CanopyPart, FloorPart, InclinePart, StationLayout, XYZ } from './station-layout.ts';
import { OPEN_STYLES } from './open-styles';
import type { Bird, Birches, Block, BronzeFrames, Capitals, CastColumn, Discs, LightBoxes, ButterflyRoof, Chairs, Checks, Columns, Cone, DeckCeiling, Fence, Figure, Finish, FoolsShip, GlassPosts, GlassStacks, Growth, Guardian, Masts, Mural, Mushrooms, NeonBoxes, OpenStyle, Panels, Room, Rooflights, Roundel, Ruler, SlabBenches, Stacks, Stone, TramTrack, Catenary, EdgePaving, Revolver, Traveller, Tulip, Wreath, Penguin, CrossVault, Sawtooth, Gallery, Globes, PrismRods, Coil, Staves, Ceiling } from './open-styles';
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
// its ends (or `offset` to the right of it, or as a roof's `shape` puts its middle): s as the
// frame's, u to the right of the line, heights above the platform's top.
class Line {
  private pts: { s: number; x: number; y: number; z: number }[];
  constructor(frame: Frame, canopy: CanopyPart, private offset = 0, private shape?: [number, number, number][]) {
    this.pts = canopy.points.map(([x, y, z]) => ({ s: frame.s(x, z), x, y: y - CANOPY_HEIGHT, z })).sort((a, b) => a.s - b.s);
  }
  // the shape's middle (k 1) or width (k 2) at s, straight between its points and level past them
  private shaped(s: number, k: 1 | 2) {
    const p = this.shape!;
    if (s <= p[0][0]) return p[0][k];
    for (let i = 1; i < p.length; i++) if (s <= p[i][0]) return p[i - 1][k] + (p[i][k] - p[i - 1][k]) * (s - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
    return p[p.length - 1][k];
  }
  // the roof's middle at s, by its shape, from the platform's line
  middle(s: number) { return this.shape ? this.shaped(s, 1) : 0; }
  // how wide the roof is at s, by its shape
  width(s: number, otherwise: number) { return this.shape ? this.shaped(s, 2) : otherwise; }
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
    const c = this.mid(s), [fx, fz] = this.dir(s), v = u + this.offset + (this.shape ? this.shaped(s, 1) : 0);
    return [c[0] - fz * v, c[1] + h, c[2] + fx * v];
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

// The height of a block's floor at its corner i, and of its top (both lower at the last two
// corners by as much as its floor falls).
const blockFrom = (b: Block, i: number) => i >= 2 && b.fall !== undefined ? b.fall : b.from ?? 0;
const blockTop = (b: Block, i: number) =>
  (i >= 2 && b.lowBack !== undefined ? b.lowBack : (i === 1 || i === 2) && b.low !== undefined ? b.low : b.h[1]) - (b.from ?? 0) + blockFrom(b, i);

// The style's building shells as volumes: the street around an exit runs on under a
// street-level hall, but isn't there to be stepped onto from inside it; nor is the platform under
// a hall that stands on it (`onPlatform`, only those), nor the city's ground in a notch dug into it
// (`ground`, only those).
export function blockVolumes(style: OpenStyle, frame: Frame, only?: 'onPlatform' | 'ground'): Volume[] {
  return (style.blocks ?? []).filter((b) => !only || b[only]).map((b) => {
    const c = b.plan.map(([s, u]): [number, number] => { const p = frame.at(s, u, 0); return [p[0], p[2]]; });
    const over = only === 'ground' && typeof b.ground === 'number' ? b.ground : 0;
    return prism(c, c.map((_, i) => frame.st.platformY + blockFrom(b, i) - 1), c.map((_, i) => frame.st.platformY + blockTop(b, i) + over));
  });
}

type On = (m: THREE.Material) => Mesh;

// The point `a` of the way from (s0, u0) to (s1, u1).
const plan2 = (s0: number, u0: number, s1: number, u1: number, a: number): [number, number] => [s0 + (s1 - s0) * a, u0 + (u1 - u0) * a];

// A dome `r` across its rim and `h` high, open underneath, its top at c.
function dome(m: Mesh, c: XYZ, r: number, h: number) {
  const n = 12, rings = 4;
  const P = (i: number, j: number) => {
    const t = (i / n) * Math.PI * 2, a = (j / rings) * Math.PI / 2;
    return [c[0] + Math.cos(t) * Math.sin(a) * r, c[1] - (1 - Math.cos(a)) * h, c[2] + Math.sin(t) * Math.sin(a) * r, i / n, j / rings];
  };
  for (let i = 0; i < n; i++) for (let j = 0; j < rings; j++) {
    if (j === 0) m.poly([P(i, 0), P(i, 1), P(i + 1, 1)]);
    else m.poly([P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j)]);
  }
}

// A limb from a to b, eight-sided, `wa` across at a and `wb` at b (open at its ends, which the
// joints' balls close).
function limb(m: Mesh, a: XYZ, b: XYZ, wa: number, wb: number) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]) || 1, t = d.map((v) => v / l);
  // two directions across it
  const w = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let p = [t[1] * w[2] - t[2] * w[1], t[2] * w[0] - t[0] * w[2], t[0] * w[1] - t[1] * w[0]];
  const pl = Math.hypot(p[0], p[1], p[2]);
  p = p.map((v) => v / pl);
  const q = [t[1] * p[2] - t[2] * p[1], t[2] * p[0] - t[0] * p[2], t[0] * p[1] - t[1] * p[0]];
  const n = 8, ring = (c: XYZ, wd: number, v: number) => Array.from({ length: n + 1 }, (_, i) => {
    const k = (i / n) * Math.PI * 2, x = Math.cos(k) * wd / 2, y = Math.sin(k) * wd / 2;
    return [c[0] + p[0] * x + q[0] * y, c[1] + p[1] * x + q[1] * y, c[2] + p[2] * x + q[2] * y, i / n, v];
  });
  const A = ring(a, wa, 0), B = ring(b, wb, l / 0.4);
  for (let i = 0; i < n; i++) m.poly([A[i], A[i + 1], B[i + 1], B[i]]);
}

// A ball `r` round at c.
function ball(m: Mesh, c: XYZ, r: number) {
  const n = 8, rings = 6;
  const P = (i: number, j: number) => {
    const t = (i / n) * Math.PI * 2, a = (j / rings) * Math.PI;
    return [c[0] + Math.cos(t) * Math.sin(a) * r, c[1] + Math.cos(a) * r, c[2] + Math.sin(t) * Math.sin(a) * r, i / n, j / rings];
  };
  for (let i = 0; i < n; i++) for (let j = 0; j < rings; j++) m.poly([P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j)]);
}

// An ellipsoid round c, its half-axes the vectors a, b and n.
function blob(m: Mesh, c: XYZ, a: XYZ, b: XYZ, n: XYZ) {
  const seg = 12, rings = 8;
  const P = (i: number, j: number) => {
    const t = (i / seg) * Math.PI * 2, p = (j / rings) * Math.PI, k = [Math.cos(p), Math.sin(p) * Math.cos(t), Math.sin(p) * Math.sin(t)];
    return [0, 1, 2].map((q) => c[q] + a[q] * k[0] + b[q] * k[1] + n[q] * k[2]).concat([i / seg, j / rings]);
  };
  for (let i = 0; i < seg; i++) for (let j = 0; j < rings; j++) m.poly([P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j)]);
}

// A length of folding ruler from a to b: its broad faces `w` wide, upright with `side` (level,
// square to it) through them, or lying (`flat`), facing up and down; `t` thick. Its uvs run along
// it in metres from `from` (over the ruler's texture, T.RULER_REPEAT long) and across its broad
// faces from 0 to 1, its scale's edge on top (or ahead, where it stands upright); its narrow faces
// take a plain strip of the texture.
function rulerLength(m: Mesh, a: XYZ, b: XYZ, side: XYZ, w: number, t: number, flat: boolean, from: number) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]) || 1, f = d.map((v) => v / l);
  // the way through its broad faces (level), and the way across them (up, or ahead)
  let up = [side[1] * f[2] - side[2] * f[1], side[2] * f[0] - side[0] * f[2], side[0] * f[1] - side[1] * f[0]];
  const ul = Math.hypot(up[0], up[1], up[2]) || 1;
  up = up.map((v) => v / ul);
  const [hs, hu] = flat ? [w / 2, t / 2] : [t / 2, w / 2];
  const P = (k: number, i: number, j: number): XYZ => [0, 1, 2].map((c) => a[c] + d[c] * k + side[c] * hs * i + up[c] * hu * j) as XYZ;
  const U = (k: number) => (from + k * l) / T.RULER_REPEAT;
  // the broad faces, then the narrow ones, then the ends
  const broad: [number, number][][] = flat ? [[[-1, 1], [1, 1]], [[-1, -1], [1, -1]]] : [[[1, -1], [1, 1]], [[-1, -1], [-1, 1]]];
  const narrow: [number, number][][] = flat ? [[[1, -1], [1, 1]], [[-1, -1], [-1, 1]]] : [[[-1, 1], [1, 1]], [[-1, -1], [1, -1]]];
  for (const [p, q] of broad) {
    const v = (e: [number, number]) => (flat ? (e[0] + 1) / 2 : (e[1] + 1) / 2);
    m.poly([[...P(0, ...p), U(0), v(p)], [...P(1, ...p), U(1), v(p)], [...P(1, ...q), U(1), v(q)], [...P(0, ...q), U(0), v(q)]]);
  }
  for (const [p, q] of narrow) m.poly([[...P(0, ...p), U(0), 0.08], [...P(1, ...p), U(1), 0.08], [...P(1, ...q), U(1), 0.16], [...P(0, ...q), U(0), 0.16]]);
  for (const k of [0, 1]) m.poly([[...P(k, -1, -1), 0, 0.08], [...P(k, 1, -1), 0.05, 0.08], [...P(k, 1, 1), 0.05, 0.16], [...P(k, -1, 1), 0, 0.16]]);
}

// The figures' joints in their poses (x to the right, for its right side; y up; z the way it
// faces), in metres for a grown person: crouching, from the ledge under its toes; clinging, from
// the underside of the beam over it, its head the way it faces.
const FIGURES: Record<Figure['pose'], Record<string, XYZ>> = {
  crouch: {
    pelvis: [0, 0.5, -0.16], chest: [0, 0.72, 0.06], neck: [0, 0.84, 0.2], head: [0, 0.91, 0.3],
    shoulder: [0.18, 0.78, 0.12], elbow: [0.22, 0.45, 0.2], hand: [0.12, 0.04, 0.26],
    hip: [0.1, 0.47, -0.16], knee: [0.27, 0.53, 0.18], ankle: [0.17, 0.1, -0.02], toe: [0.19, 0.02, 0.12],
  },
  cling: {
    pelvis: [0, -0.52, -0.22], chest: [0, -0.47, 0.12], neck: [0, -0.41, 0.29], head: [0, -0.35, 0.4],
    shoulder: [0.18, -0.42, 0.22], elbow: [0.28, -0.18, 0.32], hand: [0.12, 0.03, 0.42],
    hip: [0.1, -0.5, -0.22], knee: [0.2, -0.12, -0.3], ankle: [0.1, -0.03, -0.7], toe: [0.13, 0.05, -0.8],
  },
};

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
      const map = T.finish(f), glow = T.finishGlow(f);
      return new THREE.MeshStandardMaterial({
        map, roughness: f === 'triangles' || f === 'darkStone' || f === 'blackTiles' ? 0.4 : f === 'greenEnamel' || f === 'tornellEnamel' ? 0.35 : 0.8,
        alphaTest: T.FINISH_GLASS.includes(f) ? 0.5 : 0,
        // (a ceiling lit by the lamps under it: the dark steel panels more; a wall lit from behind)
        emissive: glow ? 0xffffff : ceiling ? (f === 'perforated' ? 0x6a6a6a : 0x3a3936) : 0x000000, emissiveMap: glow ?? (ceiling ? map : null),
        side: THREE.DoubleSide,
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

  // The canopy the roof follows, of a platform's (each of its pieces has one): the one under the
  // roof's middle, or the longest.
  canopyFor(st: StationLayout, style: OpenStyle, canopies: CanopyPart[]): CanopyPart | undefined {
    if (!style.roof) return undefined;
    const frame = new Frame(st), mid = (style.roof.from + style.roof.to) / 2;
    const span = (c: CanopyPart) => { const s = c.points.map(([x, , z]) => frame.s(x, z)); return [Math.min(...s), Math.max(...s)]; };
    return canopies.find((c) => { const [a, b] = span(c); return a <= mid && b >= mid; })
      ?? canopies.reduce<CanopyPart | undefined>((a, c) => (!a || span(c)[1] - span(c)[0] > span(a)[1] - span(a)[0] ? c : a), undefined);
  }

  // The roof over a platform, and its columns, lamps and signs, the art and benches under it;
  // `cut` by the station's spaces.
  roofOver(st: StationLayout, style: OpenStyle, canopy: CanopyPart, on: On, cut: Volume[], group: THREE.Group) {
    const roof = style.roof;
    if (!roof) return;
    const frame = new Frame(st), line = new Line(frame, canopy, roof.offset, roof.shape);
    this.butterfly(st.name, roof, style, line, on, cut, group);
    const lines = (style.roofs ?? []).map((R) => new Line(frame, canopy, R.offset, R.shape));
    (style.roofs ?? []).forEach((R, k) => this.butterfly(st.name, R, style, lines[k], on, cut, group));
    for (const a of style.art ?? []) {
      if (a.kind === 'guardian') this.guardian(a, line, on);
      else if (a.kind === 'stacks') this.stacks(a, line, on);
      else if (a.kind === 'panels') this.panels(a, roof, line, on);
      else if (a.kind === 'chairs') this.chairs(a, line, on);
      else if (a.kind === 'foolsShip') this.foolsShip(a, line, on);
      else if (a.kind === 'cone') this.cone(a, line, on);
      else if (a.kind === 'checks') this.checks(a, line, on);
    }
    for (const sh of style.shelters ?? []) this.shelter(sh, sh.under === undefined ? line : lines[sh.under], on, cut);
    this.benches(style, line, lines, on);
  }

  private benches(style: OpenStyle, line: Line, lines: Line[], on: On) {
    for (const B of [style.benches ?? []].flat()) {
      const row = B.roof === undefined ? line : lines[B.roof];
      for (const s of B.at) {
        if (B.across) this.benchAcross(s, row, on);
        else if (B.double) this.benchDouble(s, row, on, B.wood);
        else this.bench(s, row, on);
      }
    }
  }

  // Where the roof's columns stand along the platform.
  private columns(R: ButterflyRoof) {
    const C = R.columns, out: number[] = [], [lo, hi] = C.between ?? [R.from, R.to];
    for (let s = C.at - Math.floor((C.at - R.from) / C.every) * C.every; s < R.to - 0.5; s += C.every) {
      if (s >= R.from + 0.5 && s >= lo && s <= hi && !C.gaps?.some(([a, b]) => s > a && s < b)) out.push(s);
    }
    return out;
  }

  // The shells of its buildings, its fences, and what stands in the station's own frame: lamp
  // posts, pictures on its walls.
  // (the walls cut by all the station's spaces, their roofs and ceilings not by its open floors';
  // a block standing in the platform's hall the network draws not by the hall's inside, `voids`)
  build(st: StationLayout, style: OpenStyle, on: On, cut: Volume[], group: THREE.Group, roofCut = cut, voids: Volume[] = []) {
    const frame = new Frame(st);
    const outside = (c: Volume[]) => c.filter((v) => !voids.includes(v));
    for (const b of style.blocks ?? []) this.block(b, frame, on, b.inRoom ? [] : b.inHall ? outside(cut) : cut, style.signName ?? st.name, b.inRoom ? [] : b.inHall ? outside(roofCut) : roofCut);
    for (const f of style.fences ?? []) this.fence(f, frame, on, outside(cut));
    for (const a of style.art ?? []) {
      if (a.kind === 'masts') this.masts(a, frame, on, st.name, group);
      else if (a.kind === 'mural') this.mural(a, frame, on);
      else if (a.kind === 'roundel') this.roundel(a, frame, on, group);
      else if (a.kind === 'glassStacks') this.glassStacks(a, frame, on);
      else if (a.kind === 'glassPosts') this.glassPosts(a, frame, on);
      else if (a.kind === 'figure') this.figure(a, frame, on);
      else if (a.kind === 'growth') this.growth(a, frame, on);
      else if (a.kind === 'ruler') this.ruler(a, frame, on);
      else if (a.kind === 'stone') this.stone(a, frame, on);
      else if (a.kind === 'columns') this.roundColumns(a, frame, on);
      else if (a.kind === 'deckCeiling') this.deckCeiling(a, frame, on, outside(cut));
      else if (a.kind === 'ceiling') this.ceiling(a, frame, on, outside(cut));
      else if (a.kind === 'tulip') this.tulip(a, frame, on);
      else if (a.kind === 'bird') this.bird(a, frame, on);
      else if (a.kind === 'rooflights') this.rooflights(a, frame, on);
      else if (a.kind === 'birches') this.birches(a, frame, on);
      else if (a.kind === 'lightBoxes') this.lightBoxes(a, frame, on);
      else if (a.kind === 'slabBenches') this.slabBenches(a, frame, on);
      else if (a.kind === 'bronzeFrames') this.bronzeFrames(a, frame, on);
      else if (a.kind === 'traveller') this.traveller(a, frame, on);
      else if (a.kind === 'revolver') this.revolver(a, frame, on);
      else if (a.kind === 'mushrooms') this.mushrooms(a, frame, on);
      else if (a.kind === 'capitals') this.capitals(a, frame, on);
      else if (a.kind === 'castColumn') this.castColumn(a, frame, on);
      else if (a.kind === 'neonBoxes') this.neonBoxes(a, frame, on);
      else if (a.kind === 'tramTrack') this.tramTrack(a, frame, on);
      else if (a.kind === 'catenary') this.catenary(a, frame, on);
      else if (a.kind === 'edgePaving') this.edgePaving(a, style, st.name, frame, on);
      else if (a.kind === 'wreath') this.wreath(a, frame, on);
      else if (a.kind === 'penguin') this.penguin(a, frame, on);
      else if (a.kind === 'crossVault') this.crossVault(a, frame, on);
      else if (a.kind === 'sawtooth') this.sawtooth(a, frame, on);
      else if (a.kind === 'gallery') this.gallery(a, frame, on);
      else if (a.kind === 'globes') this.globes(a, frame, on);
      else if (a.kind === 'discs') this.discs(a, frame, on);
      else if (a.kind === 'prismRods') this.prismRods(a, frame, group);
      else if (a.kind === 'coil') this.coil(a, frame, on);
      else if (a.kind === 'staves') this.staves(a, frame, on);
    }
    // (under a hall rather than a roof, the benches down the middle of the platform)
    if (!style.roof && style.benches) {
      const middle = style.middle ?? [[-500, 0], [500, 0]];
      const canopy: CanopyPart = { kind: 'canopy', points: middle.map(([s, u]) => frame.at(s, u, CANOPY_HEIGHT)), width: 0 };
      this.benches(style, new Line(frame, canopy), [], on);
    }
  }

  // A tram's track: concrete sleepers every 0.65 m along it, two rails on them, and a buffer stop
  // at its end, a steel frame with a beam across in yellow.
  private tramTrack(a: TramTrack, frame: Frame, on: On) {
    const sleeper = on(this.color(0x8d8a84, 0.9, 0)), rail = on(this.color(0x7d7873, 0.35, 0.8));
    const P = a.points, L = [0];
    for (let k = 1; k < P.length; k++) L.push(L[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    // the point `d` along the track, `off` to its right and `dh` over its sleepers' top; and the
    // world's direction along it there
    const seg = (d: number) => { let k = 1; while (k < P.length - 1 && L[k] < d) k++; return k; };
    const at = (d: number, off: number, dh: number): XYZ => {
      const k = seg(d), [sa, ua, ha] = P[k - 1], [sb, ub, hb] = P[k], l = L[k] - L[k - 1], t = (d - L[k - 1]) / l;
      const fs = (sb - sa) / l, fu = (ub - ua) / l;
      return frame.at(sa + (sb - sa) * t - fu * off, ua + (ub - ua) * t + fs * off, ha + (hb - ha) * t + dh);
    };
    const dir = (d: number) => {
      const a0 = at(d - 0.5, 0, 0), a1 = at(d + 0.5, 0, 0), l = Math.hypot(a1[0] - a0[0], a1[2] - a0[2]);
      return [(a1[0] - a0[0]) / l, (a1[2] - a0[2]) / l];
    };
    const end = L[L.length - 1];
    for (let d = 0.35; d < end - 0.2; d += 0.65) { const [fx, fz] = dir(d); box(sleeper, at(d, 0, -0.06), fx, fz, 2.3, 0.12, 0.24); }
    const marks = [0];
    for (let k = 1; k < P.length; k++) {
      const n = Math.max(1, Math.ceil((L[k] - L[k - 1]) / 4));
      for (let i = 1; i <= n; i++) marks.push(L[k - 1] + ((L[k] - L[k - 1]) * i) / n);
    }
    for (const g of [-0.7175, 0.7175]) for (let i = 0; i + 1 < marks.length; i++) bar(rail, at(marks[i], g, 0.17), at(marks[i + 1], g, 0.17), 0.07, 0.17);
    if (a.buffer) {
      const d = end - 0.3, [fx, fz] = dir(d - 0.5), red = on(this.color(0x7d2a22, 0.6, 0.3)), paint = on(this.color(0xe2c23a, 0.5, 0.1));
      for (const g of [-0.65, 0.65]) {
        box(red, at(d, g, 0.5), fx, fz, 0.18, 1.0, 0.2);
        bar(red, at(d - 1.6, g, 0.3), at(d, g, 0.95), 0.12, 0.12);
      }
      box(paint, at(d + 0.05, 0, 0.75), fx, fz, 1.9, 0.32, 0.2);
    }
  }

  // The trams' overhead line: steel masts, an arm from each out over the wires, a contact wire
  // along each track and a messenger wire over it.
  private catenary(a: Catenary, frame: Frame, on: On) {
    const steel = on(this.color(0x8f9497, 0.5, 0.6)), wire = on(this.color(0x2f3133, 0.5, 0.6));
    // a wire's u and h at s, between its first and last points
    const along = (w: [number, number, number][], s: number) => {
      for (let k = 1; k < w.length; k++) {
        const [sa, ua, ha] = w[k - 1], [sb, ub, hb] = w[k];
        if ((s - sa) * (s - sb) > 0) continue;
        const t = sb === sa ? 0 : (s - sa) / (sb - sa);
        return { u: ua + (ub - ua) * t, h: ha + (hb - ha) * t };
      }
      return null;
    };
    for (const [s, u, foot] of a.masts) {
      box(steel, frame.at(s, u, (foot + a.height) / 2), frame.fx, frame.fz, 0.22, a.height - foot, 0.22);
      const at = a.wires.map((w) => along(w, s)).filter((p): p is { u: number; h: number } => p !== null);
      if (!at.length) continue;
      const top = Math.max(...at.map((p) => p.h)) + 1.1, reach = (side: number) => Math.max(0, ...at.map((p) => (p.u - u) * side)) + 0.3;
      bar(steel, frame.at(s, u - reach(-1), top + 0.06), frame.at(s, u + reach(1), top + 0.06), 0.07, 0.07);
      for (const p of at) {
        bar(steel, frame.at(s, u + Math.sign(p.u - u) * 0.12, p.h + 0.45), frame.at(s, p.u, p.h + 0.04), 0.04, 0.04);
        box(wire, frame.at(s, p.u, (p.h + top) / 2), frame.fx, frame.fz, 0.012, top - p.h, 0.012);
      }
    }
    for (const w of a.wires) {
      for (let k = 1; k < w.length; k++) {
        const [sa, ua, ha] = w[k - 1], [sb, ub, hb] = w[k];
        bar(wire, frame.at(sa, ua, ha + 0.012), frame.at(sb, ub, hb + 0.012), 0.014, 0.014);
        bar(wire, frame.at(sa, ua, ha + 1.112), frame.at(sb, ub, hb + 1.112), 0.016, 0.016);
      }
    }
  }

  // The platform's paving along an edge the network doesn't draw, mapped across from the edge as
  // the network maps its own.
  private edgePaving(a: EdgePaving, style: OpenStyle, name: string, frame: Frame, on: On) {
    const paving = style.paving;
    if (!paving) return;
    const m = on(this.mat(`edgePaving:${name}`, () => new THREE.MeshStandardMaterial({ map: T.openPaving(paving), roughness: 0.85, side: THREE.DoubleSide })));
    const side = a.left ? -1 : 1;
    let along = 0;
    for (let i = 0; i + 1 < a.points.length; i++) {
      const [sa, ua, ha = 0] = a.points[i], [sb, ub, hb = 0] = a.points[i + 1], l = Math.hypot(sb - sa, ub - ua);
      const ns = (-(ub - ua) / l) * side, nu = ((sb - sa) / l) * side;
      const P = (t: number, w: number) => [...frame.at(sa + (sb - sa) * t + ns * w, ua + (ub - ua) * t + nu * w, ha + (hb - ha) * t + 0.008),
        (w + (a.inset ?? 0)) / T.PAVING_ACROSS, (along + l * t) / T.pavingRepeat(paving)];
      m.poly([P(0, 0), P(1, 0), P(1, a.width), P(0, a.width)]);
      along += l;
    }
  }

  // Gullmarsplan's columns under the deck: a square casing of glossy tiles, black and then red, and
  // over it a round concrete shaft, flaring in a curve into a broad head under the ceiling.
  private mushrooms(a: Mushrooms, frame: Frame, on: On) {
    const concrete = on(this.mat('plinth', () => new THREE.MeshStandardMaterial({ map: T.concrete(21, 170), color: 0xb5b1a9, roughness: 0.9, side: THREE.DoubleSide })));
    const e = a.size / 2, sq: [number, number][] = [[-e, -e], [e, -e], [e, e], [-e, e]], n = 16;
    for (const [s, u] of a.at) {
      // the casing's sides, its tiles in metres over the finish's repeat, and its top round the shaft
      const casing = (f: Finish, h0: number, h1: number) => {
        const m = on(this.finish(f)), [w, hh] = T.FINISH_SIZE[f];
        for (let k = 0; k < 4; k++) {
          const [p0, q0] = sq[k], [p1, q1] = sq[(k + 1) % 4];
          m.poly([[...frame.at(s + p0, u + q0, h0), 0, h0 / hh], [...frame.at(s + p1, u + q1, h0), a.size / w, h0 / hh],
            [...frame.at(s + p1, u + q1, h1), a.size / w, h1 / hh], [...frame.at(s + p0, u + q0, h1), 0, h1 / hh]]);
        }
        return m;
      };
      casing('blackTiles', 0, a.red[0]);
      casing('redTiles', a.red[0], a.red[1]).poly(sq.map(([p, q]) => [...frame.at(s + p, u + q, a.red[1]), p, q]));
      // the shaft, and its head: the radius growing with the square of the height over the flare
      const r0 = a.shaft / 2, r1 = a.head / 2, rings = [a.red[1], a.flare, ...[0.25, 0.5, 0.75, 1].map((t) => a.flare + (a.ceiling - a.flare) * t)];
      const radius = (h: number) => h <= a.flare ? r0 : r0 + (r1 - r0) * ((h - a.flare) / (a.ceiling - a.flare)) ** 2;
      const P = (i: number, h: number) => { const t = (i / n) * Math.PI * 2, r = radius(h); return [...frame.at(s + Math.cos(t) * r, u + Math.sin(t) * r, h), (i / n) * Math.PI * a.shaft, h]; };
      for (let j = 0; j + 1 < rings.length; j++) for (let i = 0; i < n; i++) concrete.poly([P(i, rings[j]), P(i + 1, rings[j]), P(i + 1, rings[j + 1]), P(i, rings[j + 1])]);
    }
  }

  // Rådmansgatan's ticket-hall columns: square, tiled, and a white capital spreading from them in
  // straight sides to a broad square head under the ceiling.
  private capitals(a: Capitals, frame: Frame, on: On) {
    const tiles = on(this.finish(a.tiles)), [w, hh] = T.FINISH_SIZE[a.tiles];
    const plaster = on(this.color(0xeceae4, 0.85, 0));
    const sq: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [s, u] of a.at) {
      const P = (k: number, e: number, h: number) => frame.at(s + sq[k % 4][0] * e, u + sq[k % 4][1] * e, h);
      for (let k = 0; k < 4; k++) {
        const e = a.size / 2, h0 = a.from, h1 = a.flare;
        tiles.poly([[...P(k, e, h0), 0, 0], [...P(k + 1, e, h0), a.size / w, 0], [...P(k + 1, e, h1), a.size / w, (h1 - h0) / hh], [...P(k, e, h1), 0, (h1 - h0) / hh]]);
        plaster.poly([[...P(k, e, h1), 0, 0], [...P(k + 1, e, h1), 0, 0], [...P(k + 1, a.head / 2, a.ceiling), 0, 0], [...P(k, a.head / 2, a.ceiling), 0, 0]]);
      }
    }
  }

  // Eva Ziggy Berglund's column: turned round its axis from a profile of radii up it, the cast
  // iron of its foot to its ring of things, and the acrystal above, each its relief once round.
  private castColumn(a: CastColumn, frame: Frame, on: On) {
    const k = (a.ceiling - a.from) / 2.9, top = a.head / 2;
    // (heights over the floor, and radii, for a column under a ceiling 2.9 m up)
    const profile: [number, number][] = [[0, 0.42], [0.25, 0.47], [0.55, 0.5], [0.85, 0.46], [1.0, 0.4], [1.06, 0.44], [1.14, 0.43], [1.2, 0.36],
      [1.55, 0.36], [1.6, 0.42], [1.78, 0.42], [1.84, 0.36], [2.15, 0.37], [2.35, 0.46], [2.55, 0.62], [2.75, top * 0.8], [2.9, top]];
    const iron = on(this.mat('castColumn:iron', () => new THREE.MeshStandardMaterial({ map: T.ziggyColumn(true), roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide })));
    const pale = on(this.mat('castColumn:pale', () => new THREE.MeshStandardMaterial({ map: T.ziggyColumn(false), roughness: 0.55, side: THREE.DoubleSide })));
    const n = 24;
    const P = (i: number, j: number) => {
      const [h, r] = profile[j], t = (i / n) * Math.PI * 2;
      return [...frame.at(a.s + Math.cos(t) * r, a.u + Math.sin(t) * r, a.from + h * k), i / n, (h * k) / 2];
    };
    for (let j = 0; j + 1 < profile.length; j++) {
      const m = profile[j][0] < 1.2 ? iron : pale;
      for (let i = 0; i < n; i++) m.poly([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]);
    }
  }

  // Leif Tjerned's boxes of neon (1995): dark boxes hung on rods under the ceiling, the coloured glass
  // in their undersides lit; and strokes of neon, red or yellow, hung on wires at heights in turn.
  private neonBoxes(a: NeonBoxes, frame: Frame, on: On) {
    const dark = on(this.color(0x1a1b1d, 0.5, 0.3)), [L, W, D] = a.size, top = a.ceiling - 0.25;
    a.at.forEach(([s, u], i) => {
      box(dark, frame.at(s, u, top - D / 2), frame.fx, frame.fz, W, D, L);
      for (const k of [-L / 2 + 0.3, L / 2 - 0.3]) box(dark, frame.at(s + k, u, (top + a.ceiling) / 2), frame.fx, frame.fz, 0.03, a.ceiling - top, 0.03);
      const glass = on(this.mat(`neonGlass:${i % 4}`, () => {
        const map = T.neonGlass(i % 4);
        return new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.9, roughness: 0.3, side: THREE.DoubleSide });
      }));
      const y = top - D - 0.005, e = 0.06;
      glass.poly([[...frame.at(s - L / 2 + e, u - W / 2 + e, y), 0, 0], [...frame.at(s + L / 2 - e, u - W / 2 + e, y), 1, 0],
        [...frame.at(s + L / 2 - e, u + W / 2 - e, y), 1, 1], [...frame.at(s - L / 2 + e, u + W / 2 - e, y), 0, 1]]);
    });
    const tube = [0xff3020, 0xffd020].map((c) => on(this.mat(`neon:${c}`, () => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }))));
    (a.tubes ?? []).forEach(([s, u, turn, c], i) => {
      const h = a.ceiling - 0.35 - 0.2 * (i % 3), ds = Math.cos(turn) * 0.8, du = Math.sin(turn) * 0.8;
      limb(tube[c], frame.at(s - ds, u - du, h), frame.at(s + ds, u + du, h), 0.04, 0.04);
      for (const k of [-0.6, 0.6]) box(dark, frame.at(s + ds * k, u + du * k, (h + a.ceiling) / 2), frame.fx, frame.fz, 0.01, a.ceiling - h, 0.01);
    });
  }

  // Carl Magnus's sculptures (1990): square bronze bars gone green, on a concrete plinth; a
  // slanting bar's section square across the plinth and level, as cast.
  private bronzeFrames(a: BronzeFrames, frame: Frame, on: On) {
    const green = on(this.mat('greenBronze', () => new THREE.MeshStandardMaterial({ map: T.verdigris(), color: 0x7f948c, metalness: 0.35, roughness: 0.6, side: THREE.DoubleSide })));
    const concrete = on(this.mat('plinth', () => new THREE.MeshStandardMaterial({ map: T.concrete(21, 170), color: 0xb5b1a9, roughness: 0.9, side: THREE.DoubleSide })));
    const cd = Math.cos(a.turn), sd = Math.sin(a.turn), [L, Wd, P] = a.plinth, t = a.bar;
    // along the plinth and across it, and up, in the station's frame
    const at = (x: number, d: number, y: number): XYZ => frame.at(a.s + cd * x - sd * d, a.u + sd * x + cd * d, y);
    const o = at(0, 0, 0), f = at(1, 0, 0), fx = f[0] - o[0], fz = f[2] - o[2];
    box(concrete, at(0, 0, P / 2), fx, fz, Wd, P, L);
    for (const [x0, y0, x1, y1, d] of a.bars) {
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
      if (Math.abs(dy) < 0.3 * l) {
        // (lying: a beam under the line through its top face)
        const k = (t / 2) / (l || 1);
        bar(green, at(x0 - dx * k, d, P + Math.max(y0, y1) + t / 2), at(x1 + dx * k, d, P + Math.max(y0, y1) + t / 2), t, t + Math.abs(dy));
        continue;
      }
      const [lo, hi] = y0 < y1 ? [[x0, y0], [x1, y1]] : [[x1, y1], [x0, y0]];
      const along = t * l / Math.abs(dy);
      taper(green, at(lo[0], d, P + lo[1]), at(hi[0], d, P + hi[1]), [t, along], [t, along], fx, fz);
    }
  }

  // Carina Wallert's Resande med djur (1991), from photographs and the laser scan: a plinth 2.6 m
  // long, 1.1 m wide and 0.5 m high; on its back end a block 0.4 m high and on that an upright one,
  // the traveller seated behind it, its folds of bronze flat and angular, an arm laid over the
  // upright block, its head 2.2 m over the platform; the dog in front, 1.4 m from its haunches to
  // its paws; the wedge along the far side, 0.4 m high at its back edge.
  // Reuterswärd's Non-Violence: the grip leaning back, chequered and worn to brass at its edges;
  // the frame and the cylinder over it, the hammer cocked behind, the trigger in its guard; the
  // barrel forward to the knot, coils wound round it, and the muzzle up out of it
  private revolver(a: Revolver, frame: Frame, on: On) {
    const L = a.size, cd = Math.cos(a.turn), sd = Math.sin(a.turn);
    // forward along the barrel (from the grip's back, 0, to the muzzle, 1), across, and up, in
    // lengths of the revolver
    const at = (x: number, y: number, z: number): XYZ => frame.at(a.s + (cd * (x - 0.5) - sd * y) * L, a.u + (sd * (x - 0.5) + cd * y) * L, a.h + z * L);
    const o = at(0, 0, 0), e = at(1, 0, 0), fx = (e[0] - o[0]) / L, fz = (e[2] - o[2]) / L;
    const bronze = on(this.color(0x3a2f27, 0.45, 0.6)), brass = on(this.color(0x7a5c38, 0.35, 0.75));
    // (its plinth a drum of brushed steel)
    if (a.drum) {
      const steel = on(this.color(0xb6b9bb, 0.3, 0.75)), r = a.drum / 2, n = 32;
      const p = (k: number, y: number) => frame.at(a.s + r * Math.cos((k / n) * Math.PI * 2), a.u + r * Math.sin((k / n) * Math.PI * 2), y);
      for (let k = 0; k < n; k++) steel.poly([[...p(k, 0), 0, 0], [...p(k + 1, 0), 1, 0], [...p(k + 1, a.h), 1, 1], [...p(k, a.h), 0, 1]]);
      steel.poly(Array.from({ length: n }, (_, k) => [...p(k, a.h), 0, 0]));
    }
    const tube = (pts: [number, number, number][], w: number) => {
      for (let k = 0; k + 1 < pts.length; k++) limb(bronze, at(...pts[k]), at(...pts[k + 1]), w * L, w * L);
      for (const p of pts) ball(bronze, at(...p), (w / 2) * L);
    };
    // the grip, leaning back from its foot on the plinth up to the frame
    taper(brass, at(0.1, 0, 0), at(0.24, 0, 0.36), [0.075 * L, 0.2 * L], [0.07 * L, 0.13 * L], fx, fz);
    taper(bronze, at(0.1, 0, 0.005), at(0.24, 0, 0.36), [0.08 * L, 0.17 * L], [0.075 * L, 0.11 * L], fx, fz);
    // the frame, and the cylinder in it; the hammer behind, the trigger and its guard under it
    box(bronze, at(0.42, 0, 0.405), fx, fz, 0.07 * L, 0.13 * L, 0.36 * L);
    limb(bronze, at(0.36, 0, 0.43), at(0.55, 0, 0.43), 0.14 * L, 0.14 * L);
    limb(bronze, at(0.26, 0, 0.42), at(0.21, 0, 0.5), 0.03 * L, 0.025 * L);
    tube([[0.36, 0, 0.34], [0.36, 0, 0.27], [0.42, 0, 0.24], [0.49, 0, 0.27], [0.5, 0, 0.34]], 0.02);
    limb(bronze, at(0.43, 0, 0.34), at(0.41, 0, 0.28), 0.02 * L, 0.015 * L);
    // the barrel, with its rib along the top
    limb(bronze, at(0.55, 0, 0.44), at(0.74, 0, 0.44), 0.07 * L, 0.07 * L);
    box(bronze, at(0.645, 0, 0.485), fx, fz, 0.02 * L, 0.03 * L, 0.19 * L);
    // the knot: coils wound round the barrel's line, and the muzzle up out of it
    const coil: [number, number, number][] = [];
    for (let k = 0; k <= 30; k++) {
      const q = (k / 30) * Math.PI * 5, x = 0.74 + 0.12 * (k / 30);
      coil.push([x, 0.07 * Math.sin(q), 0.44 + 0.08 * Math.cos(q)]);
    }
    tube(coil, 0.07);
    tube([[0.86, 0, 0.52], [0.9, 0, 0.58], [0.95, 0, 0.63], [0.99, 0, 0.67]], 0.075);
  }

  private traveller(a: Traveller, frame: Frame, on: On) {
    const bronze = on(this.mat('bronze', () => new THREE.MeshStandardMaterial({ map: T.bronze(), metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide })));
    const concrete = on(this.mat('plinth', () => new THREE.MeshStandardMaterial({ map: T.concrete(21, 170), color: 0xb5b1a9, roughness: 0.9, side: THREE.DoubleSide })));
    const cd = Math.cos(a.turn), sd = Math.sin(a.turn);
    // x along the plinth toward the dog's head, d across it (to the left of x), y up
    const at = (x: number, d: number, y: number): XYZ => frame.at(a.s + cd * x - sd * d, a.u + sd * x + cd * d, y);
    const o = at(0, 0, 0), f = at(1, 0, 0), fx = f[0] - o[0], fz = f[2] - o[2];
    const P = 0.5, B = P + 0.4;
    box(concrete, at(0, 0, P / 2), fx, fz, 1.1, P, 2.6);
    box(concrete, at(-0.92, 0, (P + B) / 2), fx, fz, 0.8, B - P, 0.75);
    box(concrete, at(-0.82, 0.2, B + 0.275), fx, fz, 0.45, 0.55, 0.35);
    // the wedge: its sloping face toward the dog, its back edge along the plinth's far side
    const w = (x: number, d: number, y: number) => [...at(x, d, y), 0, 0];
    const [x0, x1, dl, dh, top] = [-0.5, 1.25, -0.15, -0.55, P + 0.4];
    concrete.poly([w(x0, dl, P), w(x1, dl, P), w(x1, dh, top), w(x0, dh, top)]);
    concrete.poly([w(x0, dh, P), w(x0, dh, top), w(x1, dh, top), w(x1, dh, P)]);
    concrete.poly([w(x0, dl, P), w(x0, dh, top), w(x0, dh, P)]);
    concrete.poly([w(x1, dl, P), w(x1, dh, P), w(x1, dh, top)]);
    // the traveller: its seat and legs wrapped in its coat, its body leaning a little forward and
    // twisted, a turned collar, its head; its near arm over the upright block
    taper(bronze, at(-1.12, -0.18, B), at(-1.1, -0.17, B + 0.6), [0.5, 0.42], [0.46, 0.4], fx, fz);
    taper(bronze, at(-1.1, -0.17, B + 0.6), at(-1.02, -0.13, B + 1.05), [0.44, 0.32], [0.38, 0.26], fx, fz);
    taper(bronze, at(-1.02, -0.13, B + 1.05), at(-0.99, -0.12, B + 1.18), [0.34, 0.25], [0.24, 0.2], fx, fz);
    taper(bronze, at(-0.97, -0.12, B + 1.13), at(-0.93, -0.11, B + 1.32), [0.17, 0.2], [0.13, 0.16], fx, fz);
    taper(bronze, at(-1.0, 0.05, B + 0.98), at(-0.82, 0.2, B + 0.56), [0.12, 0.13], [0.1, 0.12], fx, fz);
    // the dog: its body, its haunches with a hind leg folded along them, its neck and raised head
    // turned a little toward the near side, its forelegs stretched out to the plinth's end
    bar(bronze, at(-0.5, 0.2, P + 0.24), at(0.32, 0.2, P + 0.27), 0.27, 0.24);
    bar(bronze, at(-0.52, 0.34, P + 0.1), at(-0.05, 0.4, P + 0.1), 0.1, 0.1);
    taper(bronze, at(0.3, 0.21, P), at(0.48, 0.25, P + 0.4), [0.22, 0.26], [0.12, 0.13], fx, fz);
    bar(bronze, at(0.43, 0.26, P + 0.46), at(0.68, 0.33, P + 0.38), 0.12, 0.13);
    for (const d of [0.13, 0.29]) bar(bronze, at(0.36, d, P + 0.07), at(1.12, d + 0.08, P + 0.06), 0.065, 0.065);
  }

  // Richard Nonas's benches (1994): each two slabs of granite on end and a thick seat between
  // them, split stones as Stone draws them, the seat a little off the floor.
  private slabBenches(a: SlabBenches, frame: Frame, on: On) {
    const T0 = 0.38, D = 0.6, seat = 0.36, top = 0.5;
    for (const [s, u] of a.at) {
      const turn = a.along ? Math.PI / 2 : 0;
      // across the bench (along the seat) from its middle, to s, u
      const at = (k: number): [number, number] => (a.along ? [s + k, u] : [s, u + k]);
      for (const k of [-1, 1]) {
        const [ss, uu] = at(k * (a.span / 2 + T0 / 2));
        this.stone({ kind: 'stone', s: ss, u: uu, size: [D, T0, a.height], turn, lean: 0, granite: true }, frame, on);
      }
      this.stone({ kind: 'stone', s, u, size: [D - 0.08, a.span + 0.12, seat], turn, lean: 0, granite: true, y: top - seat + 0.05 }, frame, on);
    }
  }

  // Freddy Fraek's folding rulers (1983, clad in copper in 1987): each length a long box from point
  // to point, run on past each fold far enough to fill its outer corner, the scale along its broad
  // faces; brass at the ends.
  private ruler(a: Ruler, frame: Frame, on: On) {
    const copper = on(this.mat('ruler', () => new THREE.MeshStandardMaterial({ map: T.ruler(), roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide })));
    const brass = on(this.color(0x9a7a44, 0.4, 0.6));
    const P = a.points.map(([s, u, h]) => frame.at(s, u, h)), n = P.length - 1;
    const D = P.slice(1).map((b, i): XYZ => { const d = [0, 1, 2].map((k) => b[k] - P[i][k]), l = Math.hypot(d[0], d[1], d[2]); return [d[0] / l, d[1] / l, d[2] / l]; });
    const flat = (i: number) => a.flat?.includes(i) ?? false;
    // each length's way across, level: square to its own heading, or to a neighbour's where it
    // stands upright
    const side = (i: number): XYZ => {
      for (const k of [i, i - 1, i + 1, i - 2, i + 2]) {
        const l = k >= 0 && k < n ? Math.hypot(D[k][0], D[k][2]) : 0;
        if (l > 0.1) return [-D[k][2] / l, 0, D[k][0] / l];
      }
      return [-frame.fz, 0, frame.fx];
    };
    // how deep a length is in the plane it folds in: its broad face's width, or lying, its thickness
    const deep = (i: number) => (flat(i) ? a.thick : a.width);
    const over = (i: number, j: number) => {
      if (j < 0 || j >= n) return 0;
      const c = D[i][0] * D[j][0] + D[i][1] * D[j][1] + D[i][2] * D[j][2];
      return Math.min(a.width, (deep(j) / 2) * Math.tan(Math.acos(Math.max(-1, Math.min(1, c))) / 2));
    };
    let run = 0;
    for (let i = 0; i < n; i++) {
      const d = D[i], e0 = over(i, i - 1), e1 = over(i, i + 1), l = Math.hypot(...([0, 1, 2].map((k) => P[i + 1][k] - P[i][k]) as XYZ));
      const A = [0, 1, 2].map((k) => P[i][k] - d[k] * e0) as XYZ, B = [0, 1, 2].map((k) => P[i + 1][k] + d[k] * e1) as XYZ;
      rulerLength(copper, A, B, side(i), a.width, a.thick, flat(i), run - e0);
      run += l;
    }
    const cap = 0.3;
    for (const [p, d, i] of [[P[0], D[0], 0], [P[n], D[n - 1].map((v) => -v), n - 1]] as [XYZ, XYZ, number][]) {
      rulerLength(brass, p, [p[0] + d[0] * cap, p[1] + d[1] * cap, p[2] + d[2] * cap], side(i), a.width + 0.012, a.thick + 0.012, flat(i), 0);
    }
  }

  // A rough-hewn stone: a box whose faces are broken by a smooth random field, its edges and corners
  // worn round, turned, leaning to its right from its foot, and sunk a little into the ground.
  private stone(a: Stone, frame: Frame, on: On) {
    const m = a.granite
      ? on(this.mat(`granite:${a.color ?? ''}`, () => new THREE.MeshStandardMaterial({ map: T.granite(), color: a.color ?? 0xffffff, roughness: 0.85, side: THREE.DoubleSide })))
      : on(this.mat('limestone', () => new THREE.MeshStandardMaterial({ map: T.limestone(), roughness: 0.9, side: THREE.DoubleSide })));
    const [L, Wd, H] = a.size, r = T.rng(Math.round(a.s * 1000 + a.u * 100));
    const bumps = Array.from({ length: 16 }, () => [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, (r() - 0.45) * 0.08]);
    // the planes it was split along: its corners and edges knocked off flat (none from underneath)
    const cuts = Array.from({ length: 10 }, () => {
      const n = [r() * 2 - 1, r() * 1.3 - 0.3, r() * 2 - 1], l = Math.hypot(n[0], n[1], n[2]) || 1;
      const [nx, ny, nz] = n.map((v) => v / l);
      // (granite: only its edges knocked off)
      return [nx, ny, nz, (Math.abs(nx) * Wd + Math.abs(ny) * H + Math.abs(nz) * L) / 2 * (a.granite ? 0.86 + 0.1 * r() : 0.66 + 0.2 * r())];
    });
    const dx = frame.fx * Math.cos(a.turn) - frame.fz * Math.sin(a.turn), dz = frame.fz * Math.cos(a.turn) + frame.fx * Math.sin(a.turn);
    const o = frame.at(a.s, a.u, a.y ?? 0), cl = Math.cos(a.lean), sl = Math.sin(a.lean);
    // a point on the unit cube's surface to the world: rounded, bumped out from its middle, cut
    // back to the split planes, leant
    // (granite split into slabs: its faces flatter, its edges sharper)
    const round = a.granite ? 0.012 : 0.05, rough = a.granite ? 0.25 : 1;
    const P = (q: XYZ): XYZ => {
      const k = 1 - round * (Math.abs(q[0] * q[1]) + Math.abs(q[1] * q[2]) + Math.abs(q[2] * q[0]));
      let b = 0;
      for (const [x, y, z, h] of bumps) b += rough * h * Math.exp(-((q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2) / 0.35);
      const f = k * (1 + b);
      // across (to its right), up, along, from its middle
      let x = q[0] * f * Wd / 2, y = q[1] * f * H / 2, z = q[2] * f * L / 2;
      for (const [nx, ny, nz, d] of cuts) {
        const e = x * nx + y * ny + z * nz - d;
        if (e > 0) { x -= nx * e; y -= ny * e; z -= nz * e; }
      }
      y += H / 2 - 0.05;
      const xl = x * cl + y * sl, yl = -x * sl + y * cl;
      return [o[0] - dz * xl + dx * z, o[1] + yl, o[2] + dx * xl + dz * z];
    };
    const N = 10;
    // each face of the cube: its normal's axis and sign, and the two axes across it
    for (const [ax, sg] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]] as const) {
      const a1 = (ax + 1) % 3, a2 = (ax + 2) % 3, size = [Wd, H, L];
      const Q = (i: number, j: number): XYZ => { const q: XYZ = [0, 0, 0]; q[ax] = sg; q[a1] = -1 + (2 * i) / N; q[a2] = -1 + (2 * j) / N; return q; };
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const V = (ii: number, jj: number) => [...P(Q(ii, jj)), ((-1 + (2 * ii) / N) * size[a1]) / 2, ((-1 + (2 * jj) / N) * size[a2]) / 2];
        m.poly([V(i, j), V(i + 1, j), V(i + 1, j + 1), V(i, j + 1)]);
      }
    }
  }

  // Round rooflights: under each, a disc of daylight in a white rim, just under the ceiling; over it,
  // a pale dome on a low curb on the roof.
  private rooflights(a: Rooflights, frame: Frame, on: On) {
    const light = on(this.mat('daylight', () => new THREE.MeshBasicMaterial({ color: 0xeef3f5, side: THREE.DoubleSide })));
    const rim = on(this.color(0xf2f1ec, 0.6, 0)), curb = on(this.color(0x8f8d86, 0.9, 0)), shell = on(this.color(0xdde3e2, 0.3, 0.1));
    const r = a.size / 2, n = 24;
    for (const [s, u] of a.at) {
      const c = frame.at(s, u, 0), ring = (rr: number, h: number, k: number) => {
        const t = (k / n) * Math.PI * 2;
        return [c[0] + Math.cos(t) * rr, frame.st.platformY + h, c[2] + Math.sin(t) * rr, Math.cos(t) * rr, Math.sin(t) * rr];
      };
      light.poly(Array.from({ length: n }, (_, k) => ring(r, a.ceiling - 0.015, n - k)));
      for (let k = 0; k < n; k++) {
        rim.poly([ring(r, a.ceiling - 0.012, k), ring(r + 0.07, a.ceiling - 0.012, k), ring(r + 0.07, a.ceiling - 0.012, k + 1), ring(r, a.ceiling - 0.012, k + 1)]);
        curb.poly([ring(r + 0.08, a.top, k), ring(r + 0.08, a.top + 0.15, k), ring(r + 0.08, a.top + 0.15, k + 1), ring(r + 0.08, a.top, k + 1)]);
      }
      dome(shell, [c[0], frame.st.platformY + a.top + 0.15 + r * 0.4, c[2]], r + 0.08, r * 0.4);
    }
  }

  // Lenka Jonesson's Björkar (1991): a cube of rusted steel bars standing on four short feet on a
  // concrete plinth, birch trunks leaning through it from a bottom edge up past the opposite top
  // edge, their sawn ends standing out of it.
  private birches(a: Birches, frame: Frame, on: On) {
    const rust = on(this.color(0x6a3a26, 0.8, 0.3));
    const concrete = on(this.mat('plinth', () => new THREE.MeshStandardMaterial({ map: T.concrete(21, 170), color: 0xb5b1a9, roughness: 0.9, side: THREE.DoubleSide })));
    const bark = on(this.mat('birch', () => new THREE.MeshStandardMaterial({ map: T.birchBark(), roughness: 0.8, side: THREE.DoubleSide })));
    const cd = Math.cos(a.turn), sd = Math.sin(a.turn);
    // forward and across the cube, and up, in the station's frame
    const at = (x: number, y: number, h: number): XYZ => frame.at(a.s + cd * x - sd * y, a.u + sd * x + cd * y, h);
    const o = at(0, 0, 0), f = at(1, 0, 0), fx = f[0] - o[0], fz = f[2] - o[2];
    const S = a.size, e = S / 2, P = 0.42, z0 = P + 0.1, z1 = z0 + S, b = 0.07;
    box(concrete, at(0, 0, P / 2), fx, fz, S + 0.3, P, S + 0.3);
    for (const x of [-e, e]) for (const y of [-e, e]) {
      box(rust, at(x, y, (z0 + z1) / 2), fx, fz, b, z1 - z0 + b, b);
      box(rust, at(x, y, (P + z0) / 2), fx, fz, 0.12, z0 - P, 0.12);
    }
    for (const z of [z0, z1]) for (const k of [-e, e]) {
      bar(rust, at(-e, k, z), at(e, k, z), b, b);
      bar(rust, at(k, -e, z), at(k, e, z), b, b);
    }
    const ys = a.trunks === 3 ? [-0.32, 0, 0.32] : [0];
    ys.forEach((y, i) => limb(bark, at(-e + 0.12, y, z0 + 0.06), at(e + 0.22, y + 0.04 * (i - 1), z1 + 0.28), 0.24, 0.2));
  }

  // Björn Olsén's Ljuslådor med hemliga tecken (1994): boxes with rounded corners, a frame of
  // steel round panes of coloured glass on both faces, a sign on each, lit from inside; each on a
  // steel post, on a small concrete plinth where it stands on paving.
  private lightBoxes(a: LightBoxes, frame: Frame, on: On) {
    const steel = on(this.color(a.frameColor ?? 0xbfc3c5, 0.5, 0.35)), post = on(this.color(0x7f8b93, 0.5, 0.4));
    const concrete = on(this.mat('plinth', () => new THREE.MeshStandardMaterial({ map: T.concrete(21, 170), color: 0xb5b1a9, roughness: 0.9, side: THREE.DoubleSide })));
    const cd = Math.cos(a.turn), sd = Math.sin(a.turn), g = a.ground ?? 0, d = a.depth;
    // the outline round the frame, and round the glass inside it: [across, up] from the box's foot
    const round = (w: number, h: number, r: number) => {
      const out: [number, number][] = [];
      for (const [cx, cy, a0] of [[w / 2 - r, h - r, 0], [-w / 2 + r, h - r, 0.5], [-w / 2 + r, r, 1], [w / 2 - r, r, 1.5]] as const)
        for (let k = 0; k <= 4; k++) { const t = (a0 + k / 8) * Math.PI; out.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
      return out;
    };
    const R = Math.min(a.w, a.h) * 0.16, fw = 0.07;
    const outer = round(a.w, a.h, R), inner = round(a.w - 2 * fw, a.h - 2 * fw, R - fw * 0.6).map(([y, z]): [number, number] => [y, z + fw]);
    a.at.forEach(([s, u], i) => {
      // forward (the way its faces look), across, and up from its foot
      const at = (x: number, y: number, h: number): XYZ => frame.at(s + cd * x - sd * y, u + sd * x + cd * y, g + h);
      const o = at(0, 0, 0), f = at(1, 0, 0), fx = f[0] - o[0], fz = f[2] - o[2];
      const z0 = a.bottom, n = outer.length;
      const P = (c: [number, number], x: number) => at(x, c[0], z0 + c[1]);
      for (let k = 0; k < n; k++) {
        const c0 = outer[k], c1 = outer[(k + 1) % n], i0 = inner[k], i1 = inner[(k + 1) % n];
        steel.poly([[...P(c0, d / 2), 0, 0], [...P(c1, d / 2), 1, 0], [...P(c1, -d / 2), 1, 1], [...P(c0, -d / 2), 0, 1]]);
        for (const x of [d / 2, -d / 2]) {
          steel.poly([[...P(c0, x), 0, 0], [...P(c1, x), 1, 0], [...P(i1, x), 1, 1], [...P(i0, x), 0, 1]]);
          const xi = x - Math.sign(x) * 0.03;
          steel.poly([[...P(i0, x), 0, 0], [...P(i1, x), 1, 0], [...P(i1, xi), 1, 1], [...P(i0, xi), 0, 1]]);
        }
      }
      const color = a.colors[i % a.colors.length], sign = (a.sign ?? 0) + i;
      const glass = on(this.mat(`lightBox:${color}:${sign}`, () => {
        const map = T.lightBoxGlass(color, sign);
        return new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.45, roughness: 0.25, side: THREE.DoubleSide });
      }));
      const iw = a.w - 2 * fw, ih = a.h - 2 * fw;
      for (const x of [d / 2 - 0.03, -(d / 2 - 0.03)])
        glass.poly(inner.map((c) => [...P(c, x), (c[0] + iw / 2) / iw * (x > 0 ? 1 : -1) + (x > 0 ? 0 : 1), (c[1] - fw) / ih]));
      limb(post, at(0, 0, a.plinth ? a.plinth[1] : -0.3), at(0, 0, z0 + 0.1), 0.12, 0.12);
      if (a.plinth) box(concrete, at(0, 0, a.plinth[1] / 2), fx, fz, a.plinth[0], a.plinth[1], a.plinth[0]);
    });
  }

  private roundColumns(a: Columns, frame: Frame, on: On) {
    const m = on(this.color(a.color, 0.85, 0)), C = a.crown;
    a.at.forEach(([s, u], k) => {
      if (a.square) {
        // (its sides, the finish in metres over its repeat)
        const f = on(this.finish(a.square)), [fw, fh] = T.FINISH_SIZE[a.square], e = a.size / 2;
        const sq: [number, number][] = [[-e, -e], [e, -e], [e, e], [-e, e]];
        for (let i = 0; i < 4; i++) {
          const [p0, q0] = sq[i], [p1, q1] = sq[(i + 1) % 4];
          f.poly([[...frame.at(s + p0, u + q0, a.from), i * a.size / fw, a.from / fh], [...frame.at(s + p1, u + q1, a.from), (i + 1) * a.size / fw, a.from / fh],
            [...frame.at(s + p1, u + q1, a.to), (i + 1) * a.size / fw, a.to / fh], [...frame.at(s + p0, u + q0, a.to), i * a.size / fw, a.to / fh]]);
        }
        return;
      }
      limb(m, frame.at(s, u, a.from), frame.at(s, u, C ? a.to - C.h : a.to), a.size, a.size);
      if (!C) return;
      // the funnel, from the column's top out to its rim, and a dark disc over it
      const color = C.colors[k % C.colors.length];
      const lit = on(this.mat(`crown:${color}`, () => {
        const map = T.litCrown(color);
        return new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.8, roughness: 0.4, side: THREE.DoubleSide });
      }));
      const n = 16, P = (i: number, r: number, h: number) => { const t = (i / n) * Math.PI * 2; return frame.at(s + Math.cos(t) * r, u + Math.sin(t) * r, h); };
      for (let i = 0; i < n; i++) {
        lit.poly([[...P(i, a.size / 2, a.to - C.h), i / n, 1], [...P(i + 1, a.size / 2, a.to - C.h), (i + 1) / n, 1],
          [...P(i + 1, C.size / 2, a.to), (i + 1) / n, 0], [...P(i, C.size / 2, a.to), i / n, 0]]);
      }
      m.poly(Array.from({ length: n }, (_, i) => [...P(i, C.size / 2, a.to + 0.01), 0, 0]));
    });
  }

  // A ceiling under a deck: the beams across the hall (each an I, its flanges and web), the panels
  // between them in barrels along it on their ribs, and the strip lights under them
  private deckCeiling(a: DeckCeiling, frame: Frame, on: On, cut: Volume[]) {
    // (left out over the openings in the deck)
    cut = [...cut, ...(a.holes ?? []).map(([s0, s1, u0, u1]) => {
      const c = ([[s0, u0], [s1, u0], [s1, u1], [s0, u1]] as const).map(([s, u]): [number, number] => { const p = frame.at(s, u, 0); return [p[0], p[2]]; });
      return prism(c, c.map(() => frame.st.platformY + a.lampAt - 0.5), c.map(() => frame.st.platformY + a.spring + a.rise + 1));
    })];
    const red = on(this.color(a.color, 0.6, 0.3)), steel = on(this.color(0x5c6064, 0.6, 0.4)), panels = on(this.finish('silverPerforated', true));
    const lamp = on(this.mat('lamp', () => new THREE.MeshBasicMaterial({ color: 0xfff5e0, side: THREE.DoubleSide })));
    const { fx, fz } = frame, [bw, bd] = a.beam, [u0, u1] = a.u, um = (u0 + u1) / 2, span = u1 - u0, t = 0.03;
    const beams: number[] = [];
    for (let s = a.at - Math.floor((a.at - a.s[0]) / a.every) * a.every; s <= a.s[1] + 1e-6; s += a.every) beams.push(s);
    for (const s of beams) {
      box(red, frame.at(s, um, a.soffit + t / 2), fx, fz, span, t, bw, cut);
      box(red, frame.at(s, um, a.soffit + bd - t / 2), fx, fz, span, t, bw, cut);
      box(red, frame.at(s, um, a.soffit + bd / 2), fx, fz, span, bd - 2 * t, 0.02, cut);
    }
    // the barrels, bay by bay between the beams, and strip by strip across, each rising as a
    // parabola from its ribs to its crown
    const n = 6, strips = Math.ceil(span / a.panel - 0.01), w = span / strips;
    const h = (k: number) => a.spring + a.rise * 4 * (k / n) * (1 - k / n);
    const arc = [0];
    for (let k = 1; k <= n; k++) arc.push(arc[k - 1] + Math.hypot(w / n, h(k) - h(k - 1)));
    const edges = [a.s[0], ...beams.filter((s) => s > a.s[0] && s < a.s[1]), a.s[1]];
    for (let b = 0; b + 1 < edges.length; b++) {
      const s0 = edges[b] + (b ? bw / 2 : 0), s1 = edges[b + 1] - (b + 2 < edges.length ? bw / 2 : 0);
      for (let j = 0; j < strips; j++) {
        const ua = u0 + j * w;
        for (let k = 0; k < n; k++) {
          const p = ua + (w * k) / n, q = ua + (w * (k + 1)) / n;
          panels.poly([[...frame.at(s0, p, h(k)), arc[k] / 1.2, s0 / 3], [...frame.at(s1, p, h(k)), arc[k] / 1.2, s1 / 3],
            [...frame.at(s1, q, h(k + 1)), arc[k + 1] / 1.2, s1 / 3], [...frame.at(s0, q, h(k + 1)), arc[k + 1] / 1.2, s0 / 3]], cut);
        }
      }
    }
    for (let j = 0; j <= strips; j++) box(steel, frame.at((a.s[0] + a.s[1]) / 2, u0 + j * w, a.spring - 0.05), fx, fz, 0.06, 0.1, a.s[1] - a.s[0], cut);
    // the strip lights: fittings 1.5 m long, nearly end to end, along each row
    for (const row of a.lamps) {
      for (let i = 0; i + 1 < row.length; i++) {
        const [sa, ua] = row[i], [sb, ub] = row[i + 1], l = Math.hypot(sb - sa, ub - ua), m = Math.max(1, Math.round(l / 1.6));
        const o = frame.at(sa, ua, 0), e = frame.at(sb, ub, 0), dx = (e[0] - o[0]) / l, dz = (e[2] - o[2]) / l;
        for (let k = 0; k < m; k++) {
          const c = (k + 0.5) / m;
          box(lamp, frame.at(sa + (sb - sa) * c, ua + (ub - ua) * c, a.lampAt), dx, dz, 0.12, 0.05, Math.min(1.5, l / m - 0.05), cut);
        }
      }
    }
  }

  // Birgitta Muhr's tulips (Uppväxter, 2002): a ring of setts, a leaf rising from the foot behind
  // the stem and twisting, the stem curving up to the flower, a cup of six petals.
  private tulip(a: Tulip, frame: Frame, on: On) {
    const H = a.height, cd = Math.cos(a.turn), sd = Math.sin(a.turn);
    // forward (the way it leans), across, and up, in the station's frame: [s, u, h]
    const at = (fwd: number, side: number, h: number): XYZ => frame.at(a.s + cd * fwd - sd * side, a.u + sd * fwd + cd * side, h);
    const setts = on(this.mat('smallSetts', () => new THREE.MeshStandardMaterial({ map: T.smallSetts(), roughness: 0.9, side: THREE.DoubleSide })));
    const ring = 20, R = 0.9;
    setts.poly(Array.from({ length: ring }, (_, i) => {
      const k = (i / ring) * Math.PI * 2, p = at(Math.cos(k) * R, Math.sin(k) * R, 0.012);
      return [...p, Math.cos(k) * R * 2, Math.sin(k) * R * 2];
    }));
    const bronze = on(this.color(0x47705f, 0.55, 0.45)), red = on(this.color(0xc4231f, 0.3, 0.1));
    // the stem: leaning forward, and nodding further near the top
    const top = H - 0.42, stem = (h: number) => 0.06 * h + 0.32 * (h / top) ** 3;
    const n = 8;
    for (let k = 0; k < n; k++) {
      const h0 = (top * k) / n, h1 = (top * (k + 1)) / n;
      limb(bronze, at(stem(h0), 0, h0), at(stem(h1), 0, h1), 0.09 - 0.03 * (k / n), 0.09 - 0.03 * ((k + 1) / n));
    }
    // the leaf: a blade from the foot, behind the stem, up to 0.62 of its height, broadest low
    // down, sweeping back and turning its face as it climbs
    const L = 0.62 * H, m = 10;
    const leaf = (t: number, e: number): XYZ => {
      const w = 0.28 * Math.sin(Math.PI * t) ** 0.8 * (1 - 0.45 * t), q = 1.3 * t;
      const back = -0.04 - 0.3 * t * t, side = 0.06 * t;
      return at(back + Math.sin(q) * w * e, side + Math.cos(q) * w * e, 0.03 + L * t);
    };
    for (let k = 0; k < m; k++) {
      const t0 = k / m, t1 = (k + 1) / m;
      bronze.poly([[...leaf(t0, -1), 0, t0], [...leaf(t1, -1), 0, t1], [...leaf(t1, 1), 1, t1], [...leaf(t0, 1), 1, t0]]);
    }
    // the flower: six petals in a cup, narrow at its foot, its rim pointed at each petal's tip,
    // tilted with the stem's top
    const base = at(stem(top), 0, top), tip = at(stem(top + 0.1), 0, top + 0.1);
    const ax = [tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]], al = Math.hypot(ax[0], ax[1], ax[2]);
    const up = ax.map((v) => v / al);
    const e1 = Math.abs(up[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let p = [up[1] * e1[2] - up[2] * e1[1], up[2] * e1[0] - up[0] * e1[2], up[0] * e1[1] - up[1] * e1[0]];
    const pl = Math.hypot(p[0], p[1], p[2]);
    p = p.map((v) => v / pl);
    const q2 = [up[1] * p[2] - up[2] * p[1], up[2] * p[0] - up[0] * p[2], up[0] * p[1] - up[1] * p[0]];
    const seg = 24, rows = 7, cup = 0.46;
    const P = (i: number, j: number) => {
      const k = (i / seg) * Math.PI * 2, t = j / rows;
      // (the petals' lobes round the cup, and their tips at the rim)
      const lobe = 0.5 + 0.5 * Math.cos(k * 3) ** 2, r = (0.05 + 0.15 * Math.sin(Math.PI * Math.min(1, t * 0.85 + 0.12))) * (0.92 + 0.08 * lobe);
      const h = cup * t * (j === rows ? 0.86 + 0.14 * Math.cos(k * 3) ** 8 : 1);
      return [base[0] + up[0] * h + (p[0] * Math.cos(k) + q2[0] * Math.sin(k)) * r, base[1] + up[1] * h + (p[1] * Math.cos(k) + q2[1] * Math.sin(k)) * r,
        base[2] + up[2] * h + (p[2] * Math.cos(k) + q2[2] * Math.sin(k)) * r, i / seg, t];
    };
    for (let i = 0; i < seg; i++) for (let j = 0; j < rows; j++) red.poly([P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j)]);
    red.poly(Array.from({ length: seg }, (_, i) => P(seg - i, 0)));
  }

  // Björn Selder's Fågel Grön (1983): its lobes as [right, up, forward] from the knot, how long
  // each is and how wide its club, read from photographs
  private bird(a: Bird, frame: Frame, on: On) {
    const bronze = on(this.color(0x2f2d29, 0.45, 0.5)), cd = Math.cos(a.turn), sd = Math.sin(a.turn);
    // forward (the way it faces), across to its right, and up, in the station's frame
    const at = (fwd: number, side: number, h: number): XYZ => frame.at(a.s + cd * fwd - sd * side, a.u + sd * fwd + cd * side, h);
    const o = at(0, 0, 0), vec = (side: number, up: number, fwd: number): XYZ => { const p = at(fwd, side, up); return [p[0] - o[0], p[1] - o[1], p[2] - o[2]]; };
    const unit = (v: number[]): XYZ => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const cross = (p: XYZ, q: XYZ): XYZ => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    const knot = a.height - 0.75, c = at(0, 0, knot), ahead = vec(0, 0, 1);
    box(bronze, at(0, 0, (knot - 0.1) / 2), ahead[0], ahead[2], 0.15, knot - 0.1, 0.15);
    ball(bronze, c, 0.2);
    const LOBES: [number, number, number, number, number][] = [
      [-1, 0.12, 0.05, 1.1, 0.24], [1, 0.45, -0.15, 1.05, 0.23], [-0.25, 1, 0.1, 0.68, 0.21], [0.25, 0.85, 0.45, 0.6, 0.21],
      [-0.75, -0.65, 0.2, 0.82, 0.22], [0.45, -0.85, 0.25, 0.68, 0.2], [0.1, 0.2, -1, 0.66, 0.2],
    ];
    for (const [x, y, z, L, w] of LOBES) {
      const d = unit(vec(x, y, z)), P = (t: number): XYZ => [c[0] + d[0] * L * t, c[1] + d[1] * L * t, c[2] + d[2] * L * t];
      // (its broad faces to the front, or up where it reaches forward or back)
      const f = Math.abs(z) > 0.8 ? vec(0, 1, 0) : ahead, k = f[0] * d[0] + f[1] * d[1] + f[2] * d[2];
      const n = unit([f[0] - k * d[0], f[1] - k * d[1], f[2] - k * d[2]]), b = cross(d, n);
      limb(bronze, P(0), P(0.38), 0.14, 0.1);
      limb(bronze, P(0.38), P(0.52), 0.1, w * 0.85);
      const half = 0.33 * L;
      blob(bronze, P(0.69), [d[0] * half, d[1] * half, d[2] * half], [b[0] * w, b[1] * w, b[2] * w], [n[0] * w * 0.55, n[1] * w * 0.55, n[2] * w * 0.55]);
    }
  }

  // polished aluminium, crazed
  private get aluminium() {
    return this.mat('aluminium', () => new THREE.MeshStandardMaterial({ map: T.crackle(), metalness: 0.7, roughness: 0.25, side: THREE.DoubleSide }));
  }

  // A figure of limbs between its joints, a ball at each joint, its head a ball.
  private figure(a: Figure, frame: Frame, on: On) {
    const m = on(this.aluminium), J = FIGURES[a.pose];
    // its own axes: x to its right, y up, z the way it faces
    const dx = frame.fx * Math.cos(a.turn) - frame.fz * Math.sin(a.turn), dz = frame.fz * Math.cos(a.turn) + frame.fx * Math.sin(a.turn);
    const o = frame.at(a.s, a.u, a.h);
    const P = (name: string, side = 0): XYZ => {
      const [x, y, z] = J[name];
      return [o[0] + (-dz * x * side + dx * z) * a.size, o[1] + y * a.size, o[2] + (dx * x * side + dz * z) * a.size];
    };
    const k = a.size;
    limb(m, P('pelvis'), P('chest'), 0.24 * k, 0.27 * k);
    limb(m, P('chest'), P('neck'), 0.1 * k, 0.09 * k);
    ball(m, P('pelvis'), 0.12 * k); ball(m, P('chest'), 0.14 * k); ball(m, P('head'), 0.115 * k);
    limb(m, P('shoulder', -1), P('shoulder', 1), 0.11 * k, 0.11 * k);
    limb(m, P('hip', -1), P('hip', 1), 0.15 * k, 0.15 * k);
    for (const side of [-1, 1]) {
      limb(m, P('shoulder', side), P('elbow', side), 0.09 * k, 0.07 * k);
      limb(m, P('elbow', side), P('hand', side), 0.07 * k, 0.05 * k);
      limb(m, P('hip', side), P('knee', side), 0.15 * k, 0.1 * k);
      limb(m, P('knee', side), P('ankle', side), 0.1 * k, 0.065 * k);
      limb(m, P('ankle', side), P('toe', side), 0.07 * k, 0.05 * k);
      ball(m, P('shoulder', side), 0.055 * k); ball(m, P('elbow', side), 0.037 * k); ball(m, P('hand', side), 0.045 * k);
      ball(m, P('hip', side), 0.075 * k); ball(m, P('knee', side), 0.052 * k); ball(m, P('ankle', side), 0.034 * k);
    }
  }

  // Carin Ellberg's Främmande växtlighet (2012): six strands of bronze twisting round each other
  // two and a half times up the trunk, out of six roots curling over the ground (gone green), and
  // parting at two thirds of its height into two branches of three strands, each curling over a
  // lamp: a ring of green bronze round a white glass; a third lamp held in the twist. Round it a
  // guard of grey steel tubes, 1.4 by 1.0 m and 0.9 m high.
  private growth(a: Growth, frame: Frame, on: On) {
    const bronze = on(this.color(0x34352e, 0.45, 0.6)), green = on(this.color(0x4c6f60, 0.55, 0.4));
    const steel = on(this.color(0x8d9296, 0.4, 0.6));
    const glow = on(this.mat('bulb', () => new THREE.MeshBasicMaterial({ color: 0xfff4dc, side: THREE.DoubleSide })));
    // its own axes: x to its right, y up, z the way it faces
    const dx = frame.fx * Math.cos(a.turn) - frame.fz * Math.sin(a.turn), dz = frame.fz * Math.cos(a.turn) + frame.fx * Math.sin(a.turn);
    const o = frame.at(a.s, a.u, 0), H = a.height;
    const P = (x: number, y: number, z: number): XYZ => [o[0] - dz * x + dx * z, o[1] + y, o[2] + dx * x + dz * z];
    const strand = (m: Mesh, pts: XYZ[], w0: number, w1: number) => {
      for (let i = 1; i < pts.length; i++) limb(m, pts[i - 1], pts[i], w0 + (w1 - w0) * (i - 1) / (pts.length - 1), w0 + (w1 - w0) * i / (pts.length - 1));
    };
    // the trunk's line, swaying a little, to the fork
    const fork = 0.64 * H, mid = (t: number): XYZ => [0.1 * Math.sin(2.6 * t + 0.4), t * fork, 0.08 * Math.sin(3.3 * t)];
    for (let k = 0; k < 6; k++) {
      const pts: XYZ[] = [];
      for (let i = 0; i <= 18; i++) {
        const t = i / 18, q = (k / 6) * Math.PI * 2 + t * Math.PI * 5, r = 0.15 - 0.07 * t + 0.03 * Math.sin(k * 1.7 + t * 9), c = mid(t);
        pts.push(P(c[0] + Math.cos(q) * r, c[1], c[2] + Math.sin(q) * r));
      }
      strand(bronze, pts, 0.09, 0.06);
      // its root, curling out over the ground
      const q = (k / 6) * Math.PI * 2 + 0.3, l = 0.45 + 0.25 * ((k * 7) % 3) / 2;
      strand(green, [0, 0.25, 0.5, 0.75, 1].map((t) => P(Math.cos(q + t * 0.9) * (0.14 + l * t), 0.12 * (1 - t) ** 2 + 0.03, Math.sin(q + t * 0.9) * (0.14 + l * t))), 0.1, 0.035);
    }
    // the branches: out from the fork, up over the lamp and down to it
    const lamp = (c: XYZ, tilt: number) => {
      const ring: XYZ[] = [], n = 14, r = 0.17;
      for (let i = 0; i <= n; i++) { const q = (i / n) * Math.PI * 2; ring.push([Math.cos(q) * r, Math.sin(q) * r * Math.sin(tilt), Math.sin(q) * r * Math.cos(tilt)]); }
      for (let i = 0; i < n; i++) {
        const A = ring[i], B = ring[i + 1];
        green.poly([[...P(c[0] + A[0], c[1] + A[1] - 0.07, c[2] + A[2]), 0, 0], [...P(c[0] + B[0], c[1] + B[1] - 0.07, c[2] + B[2]), 1, 0],
          [...P(c[0] + B[0], c[1] + B[1] + 0.07, c[2] + B[2]), 1, 1], [...P(c[0] + A[0], c[1] + A[1] + 0.07, c[2] + A[2]), 0, 1]]);
      }
      glow.poly(ring.slice(0, n).map((p) => [...P(c[0] + p[0] * 0.85, c[1] + p[1] - 0.06, c[2] + p[2] * 0.85), 0, 0]));
      bronze.poly(ring.slice(0, n).map((p) => [...P(c[0] + p[0] * 0.95, c[1] + p[1] + 0.08, c[2] + p[2] * 0.95), 0, 0]));
    };
    const top = mid(1);
    for (const [side, reach, h] of [[1, 0.55, H - 0.25], [-1, 0.75, 0.86 * H - 0.2]] as const) {
      const c: XYZ = [side * reach, h, 0.05];
      lamp(c, 0.25);
      for (let k = 0; k < 3; k++) {
        const pts: XYZ[] = [];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12, q = k * 2.1 + t * 7, w = 0.05 * (1 - t) + 0.02;
          // up and out past the lamp, then curling down over it
          const x = top[0] + (c[0] - top[0]) * Math.sin(t * Math.PI / 2) * 1.1, y = top[1] + (c[1] + 0.3 - top[1]) * Math.sin(t * Math.PI * 0.6) / Math.sin(Math.PI * 0.6);
          pts.push(P(x + Math.cos(q) * w, y + Math.sin(q) * w, top[2] + Math.sin(q) * w));
        }
        pts.push(P(c[0] + side * 0.12, c[1] + 0.12, c[2]));
        strand(bronze, pts, 0.06, 0.035);
      }
    }
    lamp([0.12, 0.42 * H, 0.1], 0.6);
    // the guard
    const [gx, gz, gh] = [0.5, 0.7, 0.9];
    for (const x of [-gx, gx]) for (const z of [-gz, gz]) bar(steel, P(x, 0, z), P(x, gh, z), 0.05, 0.05);
    for (const x of [-gx, gx]) { bar(steel, P(x, gh, -gz), P(x, gh, gz), 0.05, 0.05); bar(steel, P(x, 0.45, -gz), P(x, 0.45, gz), 0.04, 0.04); }
    for (const z of [-gz, gz]) bar(steel, P(-gx, gh, z), P(gx, gh, z), 0.05, 0.05);
  }

  // stacked green glass, as an edge-on texture
  private get glass() {
    return this.mat('stackedGlass', () => new THREE.MeshStandardMaterial({ map: T.stackedGlass(), roughness: 0.25, metalness: 0.15, side: THREE.DoubleSide }));
  }

  // Stacks of glass sheets side by side, each in layers about 12 cm thick, tapering, their edges
  // stepping in and out a little.
  private glassStacks(a: GlassStacks, frame: Frame, on: On) {
    const glass = on(this.glass), heights = [1, 0.9, 0.78, 0.94], gap = 1.15;
    const r = (k: number) => { const v = Math.sin(k * 12.9898 + a.s * 78.233) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < a.count; i++) {
      const s = a.s + (i - (a.count - 1) / 2) * gap, H = a.height * heights[i % heights.length], n = Math.round(H / 0.12), t = H / n;
      const size = (y: number, k: number): [number, number] => [1.1 + (0.25 - 1.1) * y / H + 0.05 * r(k), 1.6 + (0.4 - 1.6) * y / H + 0.08 * r(k + 300)];
      for (let j = 0; j < n; j++) {
        const k = i * 100 + j, ds = 0.04 * (r(k + 600) - 0.5);
        taper(glass, frame.at(s + ds, a.u, a.foot + j * t), frame.at(s + ds, a.u, a.foot + (j + 1) * t - 0.004), size(j * t, k), size((j + 1) * t, k), frame.fx, frame.fz);
      }
    }
  }

  private glassPosts(a: GlassPosts, frame: Frame, on: On) {
    const glass = on(this.glass), [h0, h1] = a.h;
    for (const [s, u] of a.at) box(glass, frame.at(s, u, (h0 + h1) / 2), frame.fx, frame.fz, a.size[1], h1 - h0, a.size[0]);
  }

  private butterfly(name: string, R: ButterflyRoof, style: OpenStyle, line: Line, on: On, cut: Volume[], group: THREE.Group) {
    const across = R.deck === 'ribbedAcross';
    const under = on(this.mat(`under:${R.deck ?? 'boards'}:${R.colors.underside}`, () => {
      const map = R.deck === 'ribbed' || across ? T.ribbedSheet(R.colors.underside) : T.roofBoards(R.colors.underside);
      return new THREE.MeshStandardMaterial({ map, emissive: 0x3a3a38, emissiveMap: map, roughness: 0.8, side: THREE.DoubleSide });
    }));
    const top = on(this.color(R.colors.top, 0.6, 0.3)), fascia = on(this.color(R.colors.fascia, 0.6, 0.2));
    const steel = on(this.color(R.colors.steel, 0.5, 0.4)), casing = on(this.color(0x3a3d41, 0.7, 0.2));
    const gutter = R.gutterColor !== undefined ? on(this.color(R.gutterColor, 0.5, 0.3)) : steel;
    const purlin = R.purlins?.color !== undefined ? on(this.color(R.purlins.color, 0.5, 0.4)) : steel;
    const lamp = on(this.mat('lamp', () => new THREE.MeshBasicMaterial({ color: 0xfff5e0, side: THREE.DoubleSide })));
    const concrete = on(this.mat('plinth', () => new THREE.MeshStandardMaterial({ map: T.concrete(21, 170), color: 0xb5b1a9, roughness: 0.9, side: THREE.DoubleSide })));
    // half the roof's width at s, and the underside's height across it there
    const half = (s: number) => line.width(s, R.width) / 2;
    // (how far the whole roof is raised at s, climbing over a ramp)
    const lift = (s: number) => {
      const c = R.climb;
      if (!c) return 0;
      if (s <= c[0][0]) return c[0][1];
      for (let i = 1; i < c.length; i++) if (s <= c[i][0]) return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * (s - c[i - 1][0]) / (c[i][0] - c[i - 1][0]);
      return c[c.length - 1][1];
    };
    const hb = (u: number, s = 0) => lift(s) + (R.lean
      ? R.middle + (R.edge - R.middle) * Math.min(1, Math.max(0, (1 - R.lean * u / half(s)) / 2))
      : R.middle + (R.edge - R.middle) * Math.min(1, Math.abs(u) / half(s)));
    // (a vaulted bay's arch: a segment of a circle through its ends and the crown over its middle)
    const B = R.barrels;
    const arch = (s: number) => {
      if (!B || s < R.from || s > R.to) return 0;
      const L = B.length, x = (s - R.from) - Math.floor((s - R.from) / L - 1e-9) * L, r = (L * L / 4 + B.rise * B.rise) / (2 * B.rise);
      return Math.max(0, Math.sqrt(Math.max(0, r * r - (x - L / 2) ** 2)) - (r - B.rise));
    };
    const h = (u: number, s = 0) => hb(u, s) + arch(s);
    const n = B ? Math.round((R.to - R.from) / B.length) * 12 : Math.max(1, Math.ceil((R.to - R.from) / 2.5));
    const S = (i: number) => R.from + ((R.to - R.from) * i) / n;
    const lip = R.thick - R.fascia, crest = R.thick + 0.05;
    // (the openings through it, which cut its underside and covering away)
    const openings = (R.openings?.at ?? []).map(([s0, s1, u0, u1]) => [s0, s1, u0 - line.middle(s0), u1 - line.middle(s0)]);
    const hole = (down: number) => openings.map(([s0, s1, u0, u1]) => {
      const c = ([[s0, u0], [s1, u0], [s1, u1], [s0, u1]] as const).map(([s, u]): [number, number] => { const p = line.at(s, u, 0); return [p[0], p[2]]; });
      const y = line.at((s0 + s1) / 2, 0, 0)[1];
      return prism(c, c.map(() => y + R.middle - down), c.map(() => y + R.middle + R.thick + 0.3));
    });
    // (and down past the rafters and the lamps under them)
    const holed = cut.concat(hole(0.3)), deep = cut.concat(hole(2));
    // the rows of columns across the roof at s, and the beams along them
    const C = R.columns, mid = C.offset ?? 0, bw = R.beamWidth ?? 0.2;
    const knot = (s: number, k: 1 | 2) => {
      const p = C.rows!;
      if (s <= p[0][0]) return p[0][k];
      for (let i = 1; i < p.length; i++) if (s <= p[i][0]) return p[i - 1][k] + (p[i][k] - p[i - 1][k]) * (s - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
      return p[p.length - 1][k];
    };
    const rows = (s: number) => C.rows ? [knot(s, 1), knot(s, 2)].map((u) => u - line.middle(s))
      : C.edges !== undefined ? [-(half(s) - C.edges), half(s) - C.edges] : (C.pair ? [-C.pair / 2, C.pair / 2] : [0]).map((u) => u + mid);
    // (a raised bay's covering stands on the roof's own)
    const lanterns = (R.lanterns?.at ?? []).map((a) => [a - R.lanterns!.length / 2, a + R.lanterns!.length / 2]);
    for (let i = 0; i < n; i++) {
      const s0 = S(i), s1 = S(i + 1);
      const covered = lanterns.some(([a, b]) => (s0 + s1) / 2 > a && (s0 + s1) / 2 < b);
      for (const side of [-1, 1]) {
        const e0 = side * half(s0), e1 = side * half(s1);
        // the boarding under it (u across, the boards along it; or the ribs across it), and the
        // covering over it
        const q = (s: number, u: number, dh: number) => [...line.at(s, u, h(u, s) + dh), ...(across ? [s, u / 2.4] : [u, s / 2.4])];
        under.poly([q(s0, 0, 0), q(s0, e0, 0), q(s1, e1, 0), q(s1, 0, 0)], holed);
        if (!covered) top.poly([q(s0, 0, R.thick), q(s0, e0, R.thick), q(s1, e1, R.thick), q(s1, 0, R.thick)], holed);
        // the fascia along its edge, down past the underside and back in under it
        const p = (s: number, u: number, dh: number) => [...line.at(s, u, (R.lean ? h(side * half(s), s) : R.edge + lift(s)) + dh), 0, 0];
        const i0 = e0 - side * 0.05, i1 = e1 - side * 0.05;
        fascia.poly([p(s0, e0, lip), p(s1, e1, lip), p(s1, e1, crest), p(s0, e0, crest)], cut);
        fascia.poly([p(s0, e0, lip), p(s1, e1, lip), p(s1, i1, lip), p(s0, i0, lip)], cut);
        fascia.poly([p(s0, i0, lip), p(s1, i1, lip), p(s1, i1, 0), p(s0, i0, 0)], cut);
        // (a vaulted bay's arch, open over the fascia: the covering's edge)
        if (B) top.poly([q(s0, e0, 0), q(s1, e1, 0), q(s1, e1, R.thick), q(s0, e0, R.thick)], cut);
      }
      // the beam along the valley, or one over each row of columns; the purlins; the gutter
      const r0 = rows(s0), r1 = rows(s1);
      r0.forEach((u, k) => bar(steel, line.at(s0, u, hb(u, s0)), line.at(s1, r1[k], hb(r1[k], s1)), bw, R.beam, cut));
      for (const u of R.purlins?.at ?? []) bar(purlin, line.at(s0, u, h(u, s0)), line.at(s1, u, h(u, s1)), R.purlins!.size[0], R.purlins!.size[1], cut);
      if (R.gutter) bar(gutter, line.at(s0, 0, R.middle + lift(s0)), line.at(s1, 0, R.middle + lift(s1)), R.gutter[0], R.gutter[1], cut);
    }
    // lit panels in the beams' inner faces, between the columns (in both faces of a beam down the
    // middle)
    if (R.panels) {
      const P = R.panels, glow = on(this.mat(`panel:${P.color}`, () => new THREE.MeshBasicMaterial({ color: P.color, side: THREE.DoubleSide })));
      for (let s = C.at + P.every / 2 - Math.floor((C.at - R.from) / P.every) * P.every; s < R.to; s += P.every) {
        if (s - P.length / 2 < R.from + 0.2 || s + P.length / 2 > R.to - 0.2) continue;
        const [fx, fz] = line.dir(s);
        for (const u of rows(s)) for (const k of u === mid ? [-1, 1] : [-Math.sign(u - mid)]) {
          box(glow, line.at(s, u + k * (bw / 2 + 0.005), lift(s) + (P.h[0] + P.h[1]) / 2), fx, fz, 0.01, P.h[1] - P.h[0], P.length, cut);
        }
      }
    }
    // and across its ends
    for (const s of [R.from, R.to]) for (const side of [-1, 1]) {
      const e = side * half(s), p = (u: number, dh: number) => [...line.at(s, u, h(u, s) + dh), 0, 0];
      fascia.poly([p(0, lip), p(e, lip), p(e, crest), p(0, crest)], cut);
    }
    // the raised bays: their covering, pitched from the ridge down to the roof's either way, and
    // the faces along the roof's edges under it
    for (const [a, b] of lanterns) {
      const m = (a + b) / 2, ridge = R.lanterns!.ridge - R.middle;
      for (const side of [-1, 1]) {
        const e = (s: number) => side * half(s);
        const t = (s: number, u: number, dh = 0) => [...line.at(s, u, h(u, s) + R.thick + dh), 0, 0];
        const r = (u: number) => [...line.at(m, u, R.middle + ridge), 0, 0];
        for (const [s, k] of [[a, 0], [b, 1]] as const) {
          top.poly(k ? [r(0), r(e(m)), t(s, e(s)), t(s, 0)] : [t(s, 0), t(s, e(s)), r(e(m)), r(0)], cut);
          fascia.poly([t(s, e(s)), [...line.at(m, e(m), R.edge + R.thick), 0, 0], r(e(m))], cut);
        }
      }
    }
    // the rafters across the underside, boarded or steel
    const [rw, rd] = R.rafterSize ?? [0.05, 0.1], rafter = R.rafterColor !== undefined ? on(this.color(R.rafterColor, 0.5, 0.4)) : under;
    const r0 = R.rafterAt !== undefined ? R.rafterAt - Math.floor((R.rafterAt - R.from) / R.rafters) * R.rafters : R.from + R.rafters / 2;
    for (let s = r0; s < R.to; s += R.rafters) {
      for (const side of [-1, 1]) bar(rafter, line.at(s, 0, h(0, s)), line.at(s, side * (half(s) - 0.05), h(half(s) - 0.05, s)), rw, rd, deep);
    }
    // a beam round each opening, from the covering's top down to the beams' underside (just over
    // the beams' along the rows of columns, under its long sides), and the beams across it
    for (const [s0, s1, u0, u1] of openings) {
      const w = 0.3, d = crest + R.beam - 0.01, y = (s: number, u: number) => h(u, s) + crest;
      for (const u of [u0 - w / 2, u1 + w / 2]) bar(fascia, line.at(s0 - w, u, y(u, s0)), line.at(s1 + w, u, y(u, s1)), w, d, cut);
      for (const s of [s0 - w / 2, s1 + w / 2]) bar(fascia, line.at(s, u0, y(u0, s)), line.at(s, u1, y(u1, s)), w, d, cut);
      const top = R.openings!.top;
      for (const s of R.openings!.beams) if (s > s0 && s < s1) bar(rafter, line.at(s, u0, h(u0, s) + top), line.at(s, u1, h(u1, s) + top), rw, top + rd, cut);
    }
    // strip lights, hung under the rafters (lying along the platform, or across it); or in a long
    // round housing, hung lower
    const L = R.lamps, lampRows = (s: number) => L.edges !== undefined ? [-(half(s) - L.edges), half(s) - L.edges] : L.at ?? [-L.offset, L.offset];
    const housing = L.tube || L.drop !== undefined ? on(this.color(0xdcdedd, 0.4, 0.5)) : under, drop = L.drop ?? (L.tube ? rd + 0.25 : 0.13);
    const first = L.start !== undefined ? L.start - Math.floor((L.start - R.from) / L.every) * L.every : R.from + L.every / 2;
    for (let s = first; s < R.to; s += L.every) for (const u of lampRows(s)) {
      if (L.span && (s < L.span[0] || s > L.span[1])) continue;
      const [fx, fz] = line.dir(s);
      if (L.across) {
        // (kept in from the roof's edge where it narrows; from the lower end of the fitting, the
        // underside sloping over it)
        const a = Math.max(0.3, Math.abs(u) - L.length / 2), b = Math.min(half(s) - 0.4, Math.abs(u) + L.length / 2);
        if (b - a < 0.6) continue;
        const c = Math.sign(u) * (a + b) / 2, y = h(a, s) - drop;
        box(housing, line.at(s, c, y), fx, fz, b - a + 0.05, 0.05, 0.16, deep);
        box(lamp, line.at(s, c, y - 0.03), fx, fz, b - a, 0.02, 0.1, deep);
        continue;
      }
      if (L.tube) box(housing, line.at(s, u, h(u, s) - drop), fx, fz, 0.26, 0.2, L.every, cut);
      else box(housing, line.at(s, u, h(u, s) - drop), fx, fz, 0.16, 0.05, L.length + 0.05, cut);
      box(lamp, line.at(s, u, h(u, s) - drop - (L.tube ? 0.1 : 0.03)), fx, fz, L.tube ? 0.16 : 0.1, 0.02, L.length, cut);
    }
    if (L.tube) for (let s = R.from + 1; s < R.to; s += R.rafters * 2) for (const u of lampRows(s)) box(steel, line.at(s, u, h(u, s) - (drop - 0.1) / 2), ...line.dir(s), 0.03, drop - 0.1, 0.03, cut);
    // (and under the beams across the openings, lying across them)
    if (L.across) for (const [s0, s1, u0, u1] of openings) for (const s of R.openings!.beams) if (s > s0 && s < s1) for (const u of lampRows(s)) {
      if (u - L.length / 2 < u0 + 0.3 || u + L.length / 2 > u1 - 0.3) continue;
      const [fx, fz] = line.dir(s), y = h(u, s) - drop;
      box(housing, line.at(s, u, y), fx, fz, L.length + 0.05, 0.05, 0.16, cut);
      box(lamp, line.at(s, u, y - 0.03), fx, fz, L.length, 0.02, 0.1, cut);
    }
    // the columns, on plinths, under the beams; a casing round those with a sculpture beside them,
    // and those the roof cases; a beam across over each pair, the columns on up through it to the
    // rafters
    const foot = (s: number) => (R.lean ? h(mid, s) : R.middle + lift(s)) - R.beam;
    for (const s of this.columns(R)) {
      const [fx, fz] = line.dir(s), art = style.art?.find((a): a is Guardian => a.kind === 'guardian' && Math.abs(a.s - s) < 0.5);
      const cased = art ? art.casing : C.casings?.at.some((c) => Math.abs(c - s) < 0.5) ? C.casings.size : null;
      for (const w of rows(s)) for (const t of C.twin ? [s - C.twin / 2, s + C.twin / 2] : [s]) for (const u of C.across ? [w - C.across / 2, w + C.across / 2] : [w]) {
        const top = C.cross ? h(w, t) - rd : h(w, t) - R.beam;
        if (C.plinth.height > 0) box(concrete, line.at(t, u, C.plinth.height / 2), fx, fz, C.plinth.size, C.plinth.height, C.plinth.size, cut);
        if (cased) box(casing, line.at(t, u, top / 2), fx, fz, cased[0], top, cased[1], cut);
        else if (C.concrete) {
          // (its sides, the boards' marks in metres over the finish's repeat)
          const m = on(this.finish('uprightBoards')), [fw, fh] = T.FINISH_SIZE.uprightBoards, e = C.size / 2, h0 = C.plinth.height;
          const sq: [number, number][] = [[-e, -e], [e, -e], [e, e], [-e, e]];
          for (let k = 0; k < 4; k++) {
            const [p0, q0] = sq[k], [p1, q1] = sq[(k + 1) % 4], v = (y: number) => y / fh;
            m.poly([[...line.at(t + p0, u + q0, h0), k * C.size / fw, v(h0)], [...line.at(t + p1, u + q1, h0), (k + 1) * C.size / fw, v(h0)],
              [...line.at(t + p1, u + q1, top), (k + 1) * C.size / fw, v(top)], [...line.at(t + p0, u + q0, top), k * C.size / fw, v(top)]], cut);
          }
        } else box(steel, line.at(t, u, (C.plinth.height + top) / 2), fx, fz, C.size, top - C.plinth.height, C.size, cut);
        // knee braces up to the beam, either way along it
        if (C.braces) for (const k of [-1, 1]) bar(steel, line.at(s, u, top - C.braces), line.at(s + k * C.braces, u, top), 0.08, 0.1, cut);
      }
      if (C.cross) bar(steel, line.at(s, -half(s) + 0.1, C.cross[0] + C.cross[1] + lift(s)), line.at(s, half(s) - 0.1, C.cross[0] + C.cross[1] + lift(s)), 0.25, C.cross[1], cut);
      // bars across between a pair, and one slanting from the lowest to the highest
      const ties = C.ties ?? [], [ua, ub] = rows(s);
      if (ties.length && ub !== undefined) {
        for (const t of ties) bar(steel, line.at(s, ua, t + 0.03), line.at(s, ub, t + 0.03), 0.06, 0.06, cut);
        bar(steel, line.at(s, ua, Math.max(...ties)), line.at(s, ub, Math.min(...ties) + 0.06), 0.05, 0.06, cut);
      }
      if (C.portal && ub !== undefined) this.portal(C.portal, s, ua + C.size / 2, ub - C.size / 2, R.middle, line, steel, on, cut);
    }
    // name signs hung under the beam, the way out at each end of the platform to either side
    const W = 2.4, H = 0.6;
    for (const s of R.signs.at) {
      const [fx, fz] = line.dir(s), rx = -fz, rz = fx;
      if (R.signs.beam) {
        // on the beams' outer faces: the name, and the ways out beside it (their arrows as seen
        // from that side, along which +s is to the right on the right-hand beam)
        const panel = (t: number, u: number, side: number, text: string, white: boolean, dir: number) => {
          const [gx, gz] = line.dir(t), c = line.at(t, u + side * (bw / 2 + 0.012), lift(t) + (R.signs.bottom ?? 2.5) + 0.21);
          const m = this.mat(`beamSign:${text}:${white}:${dir}`, () => new THREE.MeshBasicMaterial({ map: T.beamSign(text, white, dir) }));
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.42), m);
          mesh.position.set(...c);
          mesh.rotation.y = Math.atan2(-gz * side, gx * side);
          group.add(mesh);
        };
        for (const u of rows(s)) {
          const side = Math.sign(u - mid) || 1;
          panel(s, u, side, name, false, 0);
          if (R.signs.ahead) panel(s + 1.9, u, side, R.signs.ahead, true, side);
          if (R.signs.back) panel(s - 1.9, u, side, R.signs.back, true, -side);
        }
        continue;
      }
      if (R.signs.across !== undefined) {
        // across the platform, hung from the underside on two rods, a face each way along it
        const u = R.signs.across, top = (R.signs.bottom ?? h(u, s) - rd - 0.35 - H) + H, c = line.at(s, u, top - H / 2);
        box(fascia, c, fx, fz, W + 0.02, H + 0.02, 0.05, cut);
        for (const k of [-W / 2 + 0.2, W / 2 - 0.2]) {
          const t = h(u + k, s) - rd;
          if (t - top > 0.01) box(steel, line.at(s, u + k, (t + top) / 2), fx, fz, 0.03, t - top, 0.03);
        }
        for (const side of [1, -1]) {
          const m = this.mat(`sign:${name}:plain:${!!R.signs.blue}`, () => new THREE.MeshBasicMaterial({ map: T.hangingSign(name, '', '', R.signs.blue, true) }));
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m);
          mesh.position.set(c[0] + fx * side * 0.03, c[1], c[2] + fz * side * 0.03);
          mesh.rotation.y = Math.atan2(fx * side, fz * side);
          group.add(mesh);
        }
        continue;
      }
      const top = R.signs.bottom !== undefined ? R.signs.bottom + H : foot(s) - 0.12, from = R.signs.bottom !== undefined ? h(mid, s) - rd : foot(s);
      const c = line.at(s, mid, top - H / 2), hang = line.at(s, mid, from)[1] - (c[1] + H / 2);
      box(fascia, c, fx, fz, 0.05, H + 0.02, W + 0.02, cut);
      if (hang > 0.01) for (const k of [-W / 2 + 0.2, W / 2 - 0.2]) box(steel, line.at(s + k, mid, from - hang / 2), fx, fz, 0.03, hang, 0.03);
      for (const side of [1, -1]) {
        // (seen from the right of the line, its back end is to the left)
        const [left, right] = side > 0 ? [R.signs.back, R.signs.ahead] : [R.signs.ahead, R.signs.back];
        const m = this.mat(`sign:${name}:${left}:${right}:${!!R.signs.blue}`, () => new THREE.MeshBasicMaterial({ map: T.hangingSign(name, left, right, R.signs.blue) }));
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m);
        mesh.position.set(c[0] + rx * side * 0.03, c[1], c[2] + rz * side * 0.03);
        mesh.rotation.y = Math.atan2(rx * side, rz * side);
        group.add(mesh);
      }
    }
    // clocks and departure boards hung from the roof on rods, a face each way along the platform
    const dark = on(this.color(0x1c1d1e, 0.5, 0.3));
    const hung = (s: number, u: number, w: number, hh: number, depth: number, face: THREE.Material, round: boolean) => {
      const [fx, fz] = line.dir(s), top = h(u, s), rod = round ? 0.1 : 0.15, c = line.at(s, u, top - rod - hh / 2);
      if (round) {
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, depth, 32).rotateX(Math.PI / 2), this.color(0xd8dad8, 0.4, 0.5));
        rim.position.set(...c);
        rim.rotation.y = Math.atan2(fx, fz);
        group.add(rim);
      } else box(dark, c, fx, fz, w, hh, depth, cut);
      for (const k of round ? [0] : [-w / 2 + 0.15, w / 2 - 0.15]) box(steel, line.at(s, u + k, top - rod / 2), fx, fz, 0.03, rod, 0.03);
      for (const side of [1, -1]) {
        const mesh = new THREE.Mesh(round ? new THREE.CircleGeometry(w / 2 - 0.03, 32) : new THREE.PlaneGeometry(w - 0.04, hh - 0.04), face);
        mesh.position.set(c[0] + fx * side * (depth / 2 + 0.005), c[1], c[2] + fz * side * (depth / 2 + 0.005));
        mesh.rotation.y = Math.atan2(fx * side, fz * side);
        group.add(mesh);
      }
    };
    for (const [s, u] of R.clocks ?? []) hung(s, u, 0.62, 0.62, 0.1, this.mat('clock', () => new THREE.MeshBasicMaterial({ map: T.clockFace() })), true);
    for (const b of R.boards ?? []) {
      const m = this.mat(`board:${b.toward}:${b.trains.join('/')}`, () => new THREE.MeshBasicMaterial({ map: T.trainsBoard(b.toward, b.trains) }));
      hung(b.s, b.u, 1.7, 0.5, 0.12, m, false);
    }
  }

  // The pale tiles of check patches in the paving, laid just over it.
  private checks(a: Checks, line: Line, on: On) {
    const m = on(this.mat(`checks:${a.color}`, () => new THREE.MeshStandardMaterial({
      color: a.color, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide,
    })));
    const [ts, tu] = a.size ?? [a.tile, a.tile], g = 0.006;
    for (const [s, u] of a.at) {
      const s0 = s - (a.rows * ts) / 2, u0 = u - (a.cols * tu) / 2;
      for (let i = 0; i < a.rows; i++) for (let j = 0; j < a.cols; j++) {
        if (!a.solid && (i + j) % 2) continue;
        const P = (k: number, l: number) => [...line.at(s0 + (i + k) * ts, u0 + (j + l) * tu, (a.h ?? 0) + 0.004), 0, 0];
        m.poly([P(g, g), P(1 - g, g), P(1 - g, 1 - g), P(g, 1 - g)]);
      }
    }
  }

  // A steel plate across between a pair of columns, from u0 to u1 (their inner faces) at s, from
  // `top` down to an arch cut out of it (or to a flat foot, a round hole through it); flat bars
  // across below it, and a downpipe between them from the valley (`valley` high) to the platform.
  private portal(P: NonNullable<ButterflyRoof['columns']['portal']>, s: number, u0: number, u1: number, valley: number, line: Line, steel: Mesh, on: On, cut: Volume[]) {
    const H = P.hole, n = H ? 24 : 12, half = (u1 - u0) / 2, mid = (u0 + u1) / 2, rise = P.crown - P.spring;
    // the arch: a segment of a circle through both springings and the crown
    const r = rise > 0 ? (half * half + rise * rise) / (2 * rise) : 0;
    const arch = (u: number) => rise > 0 ? P.crown - r + Math.sqrt(Math.max(0, r * r - (u - mid) * (u - mid))) : P.spring;
    // (the hole's half height at u)
    const chord = (u: number) => H ? Math.sqrt(Math.max(0, H.r * H.r - (u - mid) * (u - mid))) : 0;
    // both faces, 16 mm apart, in strips across: below the hole and above it
    for (const side of [-1, 1]) {
      const at = (u: number, h: number) => [...line.at(s + side * 0.008, u, h), 0, 0];
      for (let k = 0; k < n; k++) {
        const a = u0 + (2 * half * k) / n, b = u0 + (2 * half * (k + 1)) / n;
        if (H) {
          steel.poly([at(a, P.spring), at(b, P.spring), at(b, H.at - chord(b)), at(a, H.at - chord(a))], cut);
          steel.poly([at(a, H.at + chord(a)), at(b, H.at + chord(b)), at(b, P.top), at(a, P.top)], cut);
        } else steel.poly([at(a, arch(a)), at(b, arch(b)), at(b, P.top), at(a, P.top)], cut);
      }
    }
    for (const b of P.bars ?? []) bar(steel, line.at(s, u0, b), line.at(s, u1, b), 0.1, 0.05, cut);
    if (P.pipe) {
      const black = on(this.color(0x1b1c1d, 0.5, 0.4));
      box(black, line.at(s, mid, valley / 2), ...line.dir(s), 0.11, valley, 0.11, cut);
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

  // Two benches back to back along the platform, of black slats on a steel frame.
  private benchDouble(s: number, line: Line, on: On, wood = false) {
    const [fx, fz] = line.dir(s);
    const slat = on(this.color(wood ? 0x8a5a34 : 0x1e1f20, 0.6)), steel = on(this.color(0xa9adb0, 0.35, 0.7));
    for (const side of [-1, 1]) {
      for (const u of [0.17, 0.3, 0.43]) box(slat, line.at(s, side * u, 0.45), fx, fz, 0.11, 0.035, 1.8);
      for (const y of [0.62, 0.78]) box(slat, line.at(s, side * 0.09, y), fx, fz, 0.03, 0.12, 1.8);
    }
    for (const k of [-0.7, 0.7]) {
      box(steel, line.at(s + k, 0, 0.42), fx, fz, 0.98, 0.04, 0.05);
      box(steel, line.at(s + k, 0, 0.61), fx, fz, 0.05, 0.38, 0.05);
      for (const side of [-1, 1]) box(steel, line.at(s + k, side * 0.36, 0.21), fx, fz, 0.04, 0.42, 0.05);
    }
  }

  // Two big armchairs of thick timbers facing each other across a low table of the same: each
  // chair a block to sit on, a block for each arm and a tall back.
  private chairs(a: Chairs, line: Line, on: On) {
    const [fx, fz] = line.dir(a.s), rx = -fz, rz = fx;
    const dx = fx * Math.cos(a.turn) + rx * Math.sin(a.turn), dz = fz * Math.cos(a.turn) + rz * Math.sin(a.turn);
    const ex = -dz, ez = dx;
    const wood = on(this.mat('laminatedWood', () => new THREE.MeshStandardMaterial({ map: T.laminatedWood(), roughness: 0.85, side: THREE.DoubleSide })));
    const steel = on(this.color(0x3a3d40, 0.5, 0.5));
    const base = line.at(a.s, a.u, 0);
    // fwd along `turn` from the middle, across to its right
    const P = (fwd: number, across: number, y: number): XYZ => [base[0] + dx * fwd + ex * across, base[1] + y, base[2] + dz * fwd + ez * across];
    // the table: a thick top on a block
    box(wood, P(0, 0, 0.17), dx, dz, 0.5, 0.26, 0.6);
    box(wood, P(0, 0, 0.38), dx, dz, 0.75, 0.2, 1.05);
    for (const side of [-1, 1]) {
      // facing the table: its back away from it, on a low steel foot
      const c = side * 1.25, back = side * 0.42;
      box(steel, P(c, 0, 0.03), dx, dz, 0.7, 0.06, 0.7);
      box(wood, P(c, 0, 0.29), dx, dz, 0.86, 0.46, 0.86);
      for (const k of [-1, 1]) box(wood, P(c - side * 0.06, k * 0.35, 0.64), dx, dz, 0.18, 0.26, 0.74);
      box(wood, P(c + back, 0, 0.85), dx, dz, 0.86, 1.2, 0.22);
      box(wood, P(c + back * 0.97, 0, 1.5), dx, dz, 0.7, 0.1, 0.2);
    }
  }

  // Sture Collin's Dårarnas båt (1990): the boat, its deck of setts rising to the bow, the post
  // and slab of granite, and the five figures on the slab.
  private foolsShip(a: FoolsShip, line: Line, on: On) {
    const [fx, fz] = line.dir(a.s), rx = -fz, rz = fx;
    const dx = fx * Math.cos(a.turn) + rx * Math.sin(a.turn), dz = fz * Math.cos(a.turn) + rz * Math.sin(a.turn);
    const ex = -dz, ez = dx;
    const base = line.at(a.s, a.u, 0);
    // fwd from the middle towards the bow, across to its right
    const P = (fwd: number, across: number, y: number): XYZ => [base[0] + dx * fwd + ex * across, base[1] + y, base[2] + dz * fwd + ez * across];
    const concrete = on(this.color(0xa9a69f, 0.9)), granite = on(this.finish('roughcast'));
    const setts = on(this.mat('smallSetts', () => new THREE.MeshStandardMaterial({ map: T.smallSetts(), roughness: 0.9, side: THREE.DoubleSide })));
    const bronze = on(this.color(0x3d4843, 0.45, 0.55));
    // the hull round its outline, its sides higher towards the bow (a sheer), the deck inset
    const hull: [number, number][] = [[-2.4, 1.1], [-0.8, 1.0], [0.9, 0.55], [2.6, -0.4], [1.2, -1.05], [-0.5, -1.2], [-2.4, -1.1]];
    const rim = (f: number) => 0.55 + 0.25 * Math.max(0, (f + 0.5) / 3.1) ** 2;
    slab(concrete, hull.map(([f, c]) => P(f, c, rim(f))), 0.6);
    const cx = hull.reduce((t, p) => t + p[0], 0) / hull.length, cy = hull.reduce((t, p) => t + p[1], 0) / hull.length;
    setts.poly(hull.map(([f, c]) => {
      const g = cx + (f - cx) * 0.9, k = cy + (c - cy) * 0.86;
      return [...P(g, k, rim(g) - 0.04), g, k];
    }));
    // the post, and the slab on it
    box(granite, P(-1.1, 0.05, 0.85), dx, dz, 0.5, 0.6, 0.5);
    box(granite, P(-1.1, 0.05, 1.33), dx, dz, 0.75, 0.36, 1.9);
    // the figures in a row along the slab: heads on shoulders, and one lying on its side
    const top = 1.51;
    for (const [f, h, r, lean] of [[-0.45, 0.4, 0.11, 0.05], [-0.1, 0.36, 0.1, -0.04], [0.25, 0.42, 0.1, 0.03], [0.6, 0.34, 0.11, 0.08]] as const) {
      const at = -1.1 + f - 0.3;
      limb(bronze, P(at, 0.05, top), P(at + lean * 0.5, 0.05, top + h - r * 1.6), 0.24, 0.17);
      ball(bronze, P(at + lean, 0.08, top + h - r), r);
    }
    limb(bronze, P(-1.1 + 0.62, 0.0, top + 0.1), P(-1.1 + 0.92, 0.12, top + 0.12), 0.2, 0.16);
    ball(bronze, P(-1.1 + 0.98, 0.15, top + 0.17), 0.1);
  }

  // Torgny Larsson's cone of bronze (1991): fluted all round, its sides rounding in to the point,
  // on three short feet.
  private cone(a: Cone, line: Line, on: On) {
    const bronze = on(this.color(0x3b4a40, 0.4, 0.6)), [fx, fz] = line.dir(a.s), c = line.at(a.s, a.u, 0);
    const n = 64, rings = 14, foot = 0.14, R = a.base / 2, H = a.height - foot;
    const P = (i: number, j: number) => {
      const t = j / rings, k = (i / n) * Math.PI * 2, r = R * (1 - t ** 1.5) * (1 - 0.07 * (0.5 + 0.5 * Math.cos(k * 16)));
      return [c[0] + Math.cos(k) * r, c[1] + foot + t * H, c[2] + Math.sin(k) * r, i / n, t * 4];
    };
    for (let i = 0; i < n; i++) for (let j = 0; j < rings; j++) {
      if (j === rings - 1) bronze.poly([P(i, j), P(i, j + 1), P(i + 1, j)]);
      else bronze.poly([P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j)]);
    }
    bronze.poly(Array.from({ length: n }, (_, i) => P(n - i, 0)));
    for (let k = 0; k < 3; k++) {
      const q = (k / 3) * Math.PI * 2 + 0.4, x = Math.cos(q) * R * 0.6, z = Math.sin(q) * R * 0.6;
      box(bronze, [c[0] + x, c[1] + foot / 2, c[2] + z], fx, fz, 0.08, foot, 0.08);
    }
  }

  // A glass shelter: glazed along both sides on black posts, open at the ends, a bench inside,
  // and a flat roof of its own out in the open.
  private shelter(sh: { s: [number, number]; u: [number, number]; roof?: boolean }, line: Line, on: On, cut: Volume[]) {
    const frame = on(this.color(0x1e1f20, 0.5, 0.4)), slat = on(this.color(0x1e1f20, 0.6));
    const [s0, s1] = sh.s, [u0, u1] = sh.u, H = 2.3;
    const n = Math.max(1, Math.round((s1 - s0) / 1.25));
    for (const u of [u0, u1]) {
      for (let k = 0; k <= n; k++) {
        const s = s0 + ((s1 - s0) * k) / n, [fx, fz] = line.dir(s);
        box(frame, line.at(s, u, H / 2), fx, fz, 0.06, H, 0.06, cut);
      }
      for (const y of [0.1, H - 0.05]) bar(frame, line.at(s0, u, y), line.at(s1, u, y), 0.05, 0.05, cut);
      const q = (s: number, y: number) => [...line.at(s, u, y), 0, 0];
      on(this.pane).poly([q(s0, 0.1), q(s1, 0.1), q(s1, H - 0.05), q(s0, H - 0.05)], cut);
    }
    // the bench along the far side from the line down the platform's middle
    const ub = Math.abs(u1) > Math.abs(u0) ? u1 - Math.sign(u1 - u0) * 0.3 : u0 + Math.sign(u1 - u0) * 0.3;
    for (let s = s0 + 0.6; s < s1 - 0.5; s += 1.9) {
      const sm = Math.min(s + 0.8, s1 - 0.4), [fx, fz] = line.dir(sm);
      for (const du of [-0.12, 0, 0.12]) box(slat, line.at(sm, ub + du, 0.45), fx, fz, 0.1, 0.035, 1.6, cut);
      for (const k of [-0.65, 0.65]) box(frame, line.at(sm + k, ub, 0.22), fx, fz, 0.36, 0.44, 0.05, cut);
    }
    if (sh.roof) slab(on(this.roofing), [[s0 - 0.2, u0 - 0.2], [s1 + 0.2, u0 - 0.2], [s1 + 0.2, u1 + 0.2], [s0 - 0.2, u1 + 0.2]].map(([s, u]) => line.at(s, u, H + 0.12)), 0.12, 0.5, cut);
  }

  // Lamp posts: a red-brown post, a white dome lamp on top and one at each end of an arm across
  // the platform; or a galvanised one with only the two on its arm, and a name sign.
  private masts(a: Masts, frame: Frame, on: On, name: string, group: THREE.Group) {
    const post = on(this.color(a.color ?? 0x6b2c24, 0.5, a.color ? 0.6 : 0.3)), shade = on(this.color(a.shade ?? 0xe9ebea, 0.35, 0.2));
    const bulb = on(this.mat('bulb', () => new THREE.MeshBasicMaterial({ color: 0xfff4dc, side: THREE.DoubleSide })));
    const H = a.height, A = a.arm ?? 0.6, lamps = a.top === false ? [[-A, H - 0.42, 0.23], [A, H - 0.42, 0.23]] : [[0, H - 0.08, 0.23], [-A, H - 0.42, 0.23], [A, H - 0.42, 0.23]];
    if (a.lower !== undefined) lamps.push([-0.35, a.lower - 0.04, 0.14], ...(a.lowerOne ? [] : [[0.35, a.lower - 0.04, 0.14]]));
    for (const [s, u] of a.at) {
      const c = frame.at(s, u, 0), fx = frame.fx, fz = frame.fz;
      box(post, [c[0], c[1] + (H - 0.3) / 2, c[2]], fx, fz, 0.12, H - 0.3, 0.12);
      bar(post, frame.at(s, u - A, H - 0.38), frame.at(s, u + A, H - 0.38), 0.06, 0.06);
      if (a.lower !== undefined) bar(post, frame.at(s, u - 0.35, a.lower), frame.at(s, u + (a.lowerOne ? 0 : 0.35), a.lower), 0.05, 0.05);
      // the sign along the platform, on a bracket, its face to each track
      if (a.sign !== undefined) {
        const W = 1.5, Hs = 0.375, sc = frame.at(s + 0.15 + W / 2, u, a.sign);
        box(on(this.color(0x161718, 0.5, 0.2)), sc, fx, fz, 0.04, Hs + 0.02, W + 0.02);
        bar(post, frame.at(s, u, a.sign + 0.12), frame.at(s + 0.18, u, a.sign + 0.12), 0.04, 0.04);
        const m = this.mat(`sign:${name}:::${!!a.blue}`, () => new THREE.MeshBasicMaterial({ map: T.hangingSign(name, '', '', a.blue) }));
        for (const side of [1, -1]) {
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, Hs), m);
          mesh.position.set(sc[0] - fz * side * 0.025, sc[1], sc[2] + fx * side * 0.025);
          mesh.rotation.y = Math.atan2(-fz * side, fx * side);
          group.add(mesh);
        }
      }
      for (const [du, y, r] of lamps) {
        const p = frame.at(s, u + du, y);
        dome(shade, p, r, r * 0.87);
        const ring: number[][] = [];
        for (let k = 0; k < 12; k++) { const t = (k / 12) * Math.PI * 2; ring.push([p[0] + Math.cos(t) * r * 0.6, p[1] - r * 0.74, p[2] + Math.sin(t) * r * 0.6, 0, 0]); }
        bulb.poly(ring);
      }
    }
  }

  // The round T on its post, a face to each side.
  private roundel(a: Roundel, frame: Frame, on: On, group: THREE.Group) {
    const steel = on(this.color(0x9aa0a4, 0.45, 0.6)), r = a.size / 2;
    if (a.striped) {
      // (a pole in bands of blue and white, about 0.3 m each, a white cap at the foot of the sign)
      const blue = on(this.color(0x1d3f8a, 0.5, 0.1)), white = on(this.color(0xeef0ee, 0.5, 0.1)), top = a.h - r, n = Math.round((top - a.foot) / 0.3);
      for (let k = 0; k < n; k++) {
        const h0 = a.foot + ((top - a.foot) * k) / n, h1 = a.foot + ((top - a.foot) * (k + 1)) / n;
        box(k % 2 ? blue : white, frame.at(a.s, a.u, (h0 + h1) / 2), frame.fx, frame.fz, 0.14, h1 - h0, 0.14);
      }
    } else box(steel, frame.at(a.s, a.u, (a.foot + a.h - r) / 2), frame.fx, frame.fz, 0.08, a.h - r - a.foot, 0.08);
    const c = frame.at(a.s, a.u, a.h), rx = a.along ? frame.fx : -frame.fz, rz = a.along ? frame.fz : frame.fx;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 32).rotateZ(Math.PI / 2), this.color(0xdfe1df, 0.4, 0.4));
    rim.position.set(...c);
    rim.rotation.y = Math.atan2(rx, rz) - Math.PI / 2;
    group.add(rim);
    const m = this.mat('tRoundel', () => new THREE.MeshBasicMaterial({ map: T.tRoundel() }));
    for (const side of [1, -1]) {
      const face = new THREE.Mesh(new THREE.CircleGeometry(r - 0.01, 32), m);
      face.position.set(c[0] + rx * side * 0.045, c[1], c[2] + rz * side * 0.045);
      face.rotation.y = Math.atan2(rx * side, rz * side);
      group.add(face);
    }
  }

  // The wooden wreath: a ring of leaves round a circle `size` across in the plane of e1 and e2 (along
  // and across the platform, hung flat; or along the wall and up, standing on it), lumpy with its
  // carved leaves; a ribbon wound round it; flowers on its outer side and underside (or its face);
  // and, hung, four wires up to a plate on the ceiling.
  private wreath(a: Wreath, frame: Frame, on: On) {
    const flat = a.turn === undefined, rr = a.thick / 2, R = a.size / 2 - rr, o = frame.at(a.s, a.u, a.h);
    const sd: XYZ = [frame.fx, 0, frame.fz], ud: XYZ = [-frame.fz, 0, frame.fx], up: XYZ = [0, 1, 0];
    const comb = (p: XYZ, q: XYZ, i: number, j: number): XYZ => [p[0] * i + q[0] * j, p[1] * i + q[1] * j, p[2] * i + q[2] * j];
    // (standing: facing (ds, du), its e1 along the wall to the viewer's right, e2 up)
    const face: XYZ = flat ? up : comb(sd, ud, Math.cos(a.turn!), Math.sin(a.turn!));
    const e1: XYZ = flat ? sd : comb(sd, ud, Math.sin(a.turn!), -Math.cos(a.turn!)), e2: XYZ = flat ? ud : up;
    const add = (...v: XYZ[]): XYZ => v.reduce((t, w) => [t[0] + w[0], t[1] + w[1], t[2] + w[2]], [0, 0, 0] as XYZ);
    const mul = (v: XYZ, k: number): XYZ => [v[0] * k, v[1] * k, v[2] * k];
    // the point at angle t round the ring and f round its thickness (0 outwards, π/2 to `face`),
    // `out` m out from its surface
    const radial = (t: number): XYZ => add(mul(e1, Math.cos(t)), mul(e2, Math.sin(t)));
    const tangent = (t: number): XYZ => add(mul(e1, -Math.sin(t)), mul(e2, Math.cos(t)));
    const normal = (t: number, f: number): XYZ => add(mul(radial(t), Math.cos(f)), mul(face, Math.sin(f)));
    const lump = (t: number, f: number) => 1 + 0.12 * Math.abs(Math.sin(t * R * 9 + Math.sin(f * 3) * 1.4)) * Math.abs(Math.sin(f * 2.5 + t * 3));
    const P = (t: number, f: number, out = 0): XYZ => add(o, mul(radial(t), R), mul(normal(t, f), rr * lump(t, f) + out));
    const leaves = on(this.mat('wreath:leaves', () => {
      const map = T.wreathLeaves();
      return new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.22, roughness: 0.6, side: THREE.DoubleSide });
    }));
    const N = Math.max(36, Math.round(a.size * 26)), M = 12, around = (2 * Math.PI * R) / 0.5;
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const t0 = (i / N) * Math.PI * 2, t1 = ((i + 1) / N) * Math.PI * 2, f0 = (j / M) * Math.PI * 2, f1 = ((j + 1) / M) * Math.PI * 2;
      leaves.poly([[...P(t0, f0), (i / N) * around, j / M], [...P(t1, f0), ((i + 1) / N) * around, j / M], [...P(t1, f1), ((i + 1) / N) * around, (j + 1) / M], [...P(t0, f1), (i / N) * around, (j + 1) / M]]);
    }
    // the ribbon: red, wound round it seven times, narrow; or broad bands of orange-red
    const ribbon = on(this.color(flat ? 0xd0241c : 0xe0502a, 0.4, 0.05));
    const turns = flat ? 7 : 6, width = flat ? 0.14 : a.thick * 0.55, steps = flat ? 420 : 0;
    if (flat) {
      for (let k = 0; k < steps; k++) {
        const t0 = (k / steps) * Math.PI * 2, t1 = ((k + 1) / steps) * Math.PI * 2, f0 = t0 * turns, f1 = t1 * turns;
        const a0 = P(t0, f0, 0.03), a1 = P(t1, f1, 0.03), w0 = mul(tangent(t0), width / 2), w1 = mul(tangent(t1), width / 2);
        ribbon.poly([[...add(a0, mul(w0, -1)), 0, 0], [...add(a0, w0), 1, 0], [...add(a1, w1), 1, 1], [...add(a1, mul(w1, -1)), 0, 1]]);
      }
    } else {
      for (let k = 0; k < turns; k++) {
        const t = (k / turns) * Math.PI * 2, n = 16;
        for (let j = 0; j < n; j++) {
          const f0 = (j / n) * Math.PI * 2, f1 = ((j + 1) / n) * Math.PI * 2;
          const q = (f: number, side: number) => add(P(t + side * width / (2 * R) + f * 0.04, f, 0.02));
          ribbon.poly([[...q(f0, -1), 0, 0], [...q(f0, 1), 1, 0], [...q(f1, 1), 1, 1], [...q(f1, -1), 0, 1]]);
        }
      }
    }
    // the flowers, each cut out round its outline, facing out from where it sits
    const flowers = on(this.mat('wreath:flowers', () => {
      const map = T.wreathFlowers();
      return new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.25, roughness: 0.5, alphaTest: 0.5, side: THREE.DoubleSide });
    }));
    const r = T.rng(Math.round(a.s * 10 + a.u));
    const count = flat ? 22 : 8;
    for (let k = 0; k < count; k++) {
      const t = ((k + r() * 0.5) / count) * Math.PI * 2;
      // (hung: on its outer side and underside, as it is seen from under it; standing: on its face)
      const f = flat ? -1.3 + r() * 1.6 : Math.PI / 2 + (r() - 0.5) * 0.9;
      const kind = flat ? (k % 7 === 0 ? 0 : 1 + (k % 3)) : k % 2 === 0 ? 0 : 2;
      const size = (kind === 0 ? (flat ? 0.4 : 0.16) : flat ? 0.2 : 0.12) / 2;
      const c = P(t, f, 0.05), n = normal(t, f), tt = tangent(t), b: XYZ = [n[1] * tt[2] - n[2] * tt[1], n[2] * tt[0] - n[0] * tt[2], n[0] * tt[1] - n[1] * tt[0]];
      const Q = (i: number, j: number, uu: number, vv: number) => [...add(c, mul(tt, i * size), mul(b, j * size)), (kind + uu) / 4, vv];
      flowers.poly([Q(-1, -1, 0, 0), Q(1, -1, 1, 0), Q(1, 1, 1, 1), Q(-1, 1, 0, 1)]);
    }
    if (flat && a.ceiling !== undefined) {
      // four wires up to a round plate on the ceiling
      const steel = on(this.color(0x8d9296, 0.4, 0.6)), top = frame.at(a.s, a.u, a.ceiling - 0.03);
      for (let k = 0; k < 4; k++) {
        const t = Math.PI / 4 + (k * Math.PI) / 2;
        limb(steel, P(t, Math.PI / 2, 0.01), add(top, mul(radial(t), 0.22)), 0.012, 0.012);
      }
      const n = 20, plate = on(this.color(0x6f7478, 0.5, 0.5));
      for (let k = 0; k < n; k++) {
        const t0 = (k / n) * Math.PI * 2, t1 = ((k + 1) / n) * Math.PI * 2;
        plate.poly([[...top, 0, 0], [...add(top, mul(radial(t0), 0.3)), 1, 0], [...add(top, mul(radial(t1), 0.3)), 1, 1]]);
      }
    }
  }

  // A picture on a wall, facing `turn` from looking along the platform.
  private mural(a: Mural, frame: Frame, on: On) {
    const lace = Math.abs(Math.round(a.s)) % 3;
    const m = on(this.mat(`mural:${a.picture}${a.picture === 'sirat' ? lace : ''}${a.variant ?? ''}`, () => {
      const map = a.picture === 'forestFloor' ? T.forestFloor() : a.picture === 'angel' ? T.angel()
        : a.picture === 'strindberg' ? T.strindbergWall() : a.picture === 'blueTower' ? T.blueTower()
          : a.picture === 'sirat' ? T.siratLace(lace) : a.picture === 'sundell' ? T.sundellGate()
            : a.picture === 'karlsson' ? T.karlssonPainting() : a.picture === 'stenborg' ? T.stenborgLeaves()
              : a.picture === 'forstaden' ? T.forstadenPanel() : a.picture === 'summerNight' ? T.summerNightRelief()
                : a.picture === 'andreeBalloon' ? T.andreeBalloon() : a.picture === 'andreeEagle' ? T.andreeEagle()
                  : a.picture === 'landergren' ? T.landergrenFace(a.variant ?? 0) : a.picture === 'penguinWall' ? T.penguinWall()
                    : a.picture === 'handMosaic' ? T.handMosaic(a.variant ?? 0) : T.tallkrogsdraken();
      // (an angel, the lace and the iron, and the sgraffito on its wall, cut out round their outlines)
      const cut = a.picture === 'angel' || a.picture === 'sirat' || a.picture === 'sundell' || a.picture === 'andreeBalloon' || a.picture === 'andreeEagle';
      const steel = a.picture === 'sirat' || a.picture === 'sundell';
      return new THREE.MeshStandardMaterial({
        map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: steel ? 0.1 : 0.25, roughness: 0.4, metalness: steel ? 0.4 : 0,
        alphaTest: cut ? 0.5 : 0, side: THREE.DoubleSide,
      });
    }));
    // (its left edge on the viewer's left, looking at it)
    const ds = Math.cos(a.turn), du = Math.sin(a.turn), rs = du, ru = -ds, w = a.width / 2;
    const P = (k: number, h: number, x: number, y: number) => [...frame.at(a.s + ds * 0.03 + rs * k, a.u + du * 0.03 + ru * k, h), x, y];
    m.poly([P(-w, a.bottom, 0, 0), P(w, a.bottom, 1, 0), P(w, a.top, 1, 1), P(-w, a.top, 0, 1)]);
  }

  // The penguin on its plinth: the plinth a box of small white tiles; the penguin a body turned on
  // a lathe, a little deeper than wide, its head turned up with its beak, its flippers hanging at
  // its sides, its feet on the plinth, and the cube held to its chest; all in a dark bronze.
  private penguin(a: Penguin, frame: Frame, on: On) {
    const ds = Math.cos(a.turn), du = Math.sin(a.turn), rs = du, ru = -ds, k = a.size;
    // a point `f` forward, `r` to its right and `h` up from the middle of its feet
    const at = (f: number, r: number, h: number): XYZ => frame.at(a.s + ds * f + rs * r, a.u + du * f + ru * r, a.height + h);
    const tiles = on(this.finish('squareTiles')), p = a.plinth / 2, H = a.height;
    // (the tiles' uvs in metres over 0.8: 10 cm tiles)
    const side = (f0: number, r0: number, f1: number, r1: number) => {
      const l = Math.hypot(f1 - f0, r1 - r0);
      tiles.poly([[...at(f0, r0, -H), 0, 0], [...at(f1, r1, -H), l / 0.8, 0], [...at(f1, r1, 0), l / 0.8, H / 0.8], [...at(f0, r0, 0), 0, H / 0.8]]);
    };
    side(p, -p, p, p); side(p, p, -p, p); side(-p, p, -p, -p); side(-p, -p, p, -p);
    tiles.poly([[...at(-p, -p, 0), 0, 0], [...at(p, -p, 0), a.plinth / 0.8, 0], [...at(p, p, 0), a.plinth / 0.8, a.plinth / 0.8], [...at(-p, p, 0), 0, a.plinth / 0.8]]);
    const bronze = on(this.color(0x6a5238, 0.45, 0.3));
    // a solid turned about an upright axis at (f, r), its radius at each height from `profile`
    // (h, radius), `deep` times as deep (forward) as wide, leaning `lean` forward per metre up
    const lathe = (f: number, r: number, profile: [number, number][], deep: number, lean = 0) => {
      const N = 18;
      for (let j = 0; j + 1 < profile.length; j++) {
        const [h0, r0] = profile[j], [h1, r1] = profile[j + 1];
        for (let i = 0; i < N; i++) {
          const t0 = (i / N) * Math.PI * 2, t1 = ((i + 1) / N) * Math.PI * 2;
          const P = (t: number, h: number, rr: number) => [...at(f + lean * h + Math.cos(t) * rr * deep * k, r + Math.sin(t) * rr * k, h * k), 0, 0];
          bronze.poly([P(t0, h0, r0), P(t1, h0, r0), P(t1, h1, r1), P(t0, h1, r1)]);
        }
      }
    };
    lathe(0, 0, [[0.06, 0.02], [0.1, 0.13], [0.2, 0.2], [0.4, 0.235], [0.62, 0.22], [0.82, 0.16], [0.95, 0.105], [1.02, 0.1], [1.1, 0.11], [1.18, 0.1], [1.25, 0.06], [1.29, 0.0]], 1.1, -0.04);
    // the beak, pointing forward and up
    const tip = at(0.22 * k, 0, 1.3 * k), base = [at(0.05 * k, -0.035 * k, 1.18 * k), at(0.05 * k, 0.035 * k, 1.18 * k), at(0.02 * k, 0, 1.24 * k)];
    for (let i = 0; i < 3; i++) bronze.poly([[...base[i], 0, 0], [...base[(i + 1) % 3], 1, 0], [...tip, 0.5, 1]]);
    // the flippers, hanging a little out from its sides
    for (const r of [-1, 1]) {
      const q = (f: number, d: number, h: number) => [...at(f * k, r * d * k, h * k), 0, 0];
      bronze.poly([q(0.02, 0.22, 0.82), q(-0.08, 0.23, 0.8), q(-0.06, 0.29, 0.32), q(0.0, 0.27, 0.36)]);
      bronze.poly([q(0.02, 0.24, 0.82), q(-0.08, 0.25, 0.8), q(-0.06, 0.31, 0.32), q(0.0, 0.29, 0.36)]);
    }
    // its feet, and the cube held to its chest (facing (wx, wz) in the scene)
    const wx = frame.fx * ds - frame.fz * du, wz = frame.fz * ds + frame.fx * du, c = 0.25 * k;
    for (const r of [-1, 1]) box(bronze, at(0.07 * k, r * 0.08 * k, 0.03 * k), wx, wz, 0.09 * k, 0.06 * k, 0.16 * k);
    box(bronze, at(0.32 * k, -0.04 * k, 0.78 * k), wx, wz, c, c, c);
  }

  // Aspudden's middle hall: its barrel vault, and the arched screens at its ends.
  private crossVault(a: CrossVault, frame: Frame, on: On) {
    // (the vault lit by the tubes on it, brighter than a flat ceiling)
    const white = on(this.mat('crossVault', () => {
      const map = T.finish('whiteRender');
      return new THREE.MeshStandardMaterial({ map, roughness: 0.85, emissive: 0x6a6964, emissiveMap: map, side: THREE.DoubleSide });
    }));
    const steel = on(this.color(0xa4a9ac, 0.35, 0.6)), pane = on(this.pane);
    const band = on(this.color(0x1f3b8a, 0.5, 0.1)), dark = on(this.color(a.spandrel, 0.6, 0.1));
    const [s0, s1] = a.s, [u0, u1] = a.u, half = (s1 - s0) / 2, mid = (s0 + s1) / 2, rise = a.crown - a.spring;
    const R = (half * half + rise * rise) / (2 * rise);
    const arc = (s: number) => a.crown - R + Math.sqrt(Math.max(0, R * R - (s - mid) ** 2));
    const N = 24, S = (i: number) => s0 + ((s1 - s0) * i) / N;
    for (let i = 0; i < N; i++) {
      const sa = S(i), sb = S(i + 1);
      white.poly([[...frame.at(sa, u0, arc(sa)), u0 / 2.4, sa / 2.4], [...frame.at(sb, u0, arc(sb)), u0 / 2.4, sb / 2.4], [...frame.at(sb, u1, arc(sb)), u1 / 2.4, sb / 2.4], [...frame.at(sa, u1, arc(sa)), u1 / 2.4, sa / 2.4]]);
    }
    // the screens, a little inside the hall's ends
    const along = [frame.fx, frame.fz];
    for (const u of [u0 + Math.sign(u1 - u0) * 0.02, u1 - Math.sign(u1 - u0) * 0.02]) {
      const P = (s: number, h: number): XYZ => frame.at(s, u, h);
      // the glass: under the transom, and in the lunette over it
      pane.poly([[...P(s0, 0.1), 0, 0], [...P(s1, 0.1), 1, 0], [...P(s1, a.doors), 1, 1], [...P(s0, a.doors), 0, 1]]);
      for (let i = 0; i < N; i++) {
        const sa = S(i), sb = S(i + 1);
        pane.poly([[...P(sa, a.doors + 0.12), 0, 0], [...P(sb, a.doors + 0.12), 1, 0], [...P(sb, arc(sb)), 1, 1], [...P(sa, arc(sa)), 0, 1]]);
        // the spandrels over the arch, and the frame along it
        dark.poly([[...P(sa, arc(sa)), 0, 0], [...P(sb, arc(sb)), 1, 0], [...P(sb, a.top), 1, 1], [...P(sa, a.top), 0, 1]]);
        bar(steel, P(sa, arc(sa)), P(sb, arc(sb)), 0.1, 0.1);
      }
      // the kick strip, the band across the doors, the transom, and the mullions
      box(steel, P(mid, 0.05), along[0], along[1], 0.08, 0.1, s1 - s0);
      box(band, P(mid, 1.12), along[0], along[1], 0.05, 0.14, s1 - s0);
      box(steel, P(mid, a.doors + 0.06), along[0], along[1], 0.1, 0.12, s1 - s0);
      const n = Math.max(1, Math.round((s1 - s0) / a.frames));
      for (let m = 0; m <= n; m++) {
        const sm = s0 + ((s1 - s0) * m) / n, h = arc(Math.min(s1 - 0.05, Math.max(s0 + 0.05, sm)));
        box(steel, P(sm, h / 2), along[0], along[1], 0.08, h, 0.07);
      }
    }
  }

  // Where Wessel's clinker meets the bricks under it, on the walls beside Axelsberg's ramp: the
  // dark triangles along the line, and the round lamps over it.
  private sawtooth(a: Sawtooth, frame: Frame, on: On) {
    const [s0, u0, h0] = a.from, [s1, u1, h1] = a.to, l = Math.hypot(s1 - s0, u1 - u0);
    // (out from the face: to the right of the line, or to its left)
    const ns = -((u1 - u0) / l) * a.out, nu = ((s1 - s0) / l) * a.out;
    const P = (t: number, h: number, o = 0.012): XYZ => frame.at(s0 + (s1 - s0) * t + ns * o, u0 + (u1 - u0) * t + nu * o, h);
    const line = (t: number) => h0 + (h1 - h0) * t;
    const dark = on(this.color(0x1c1b1d, 0.45, 0.1)), n = Math.max(1, Math.round(l / a.every));
    for (let k = 0; k < n; k++) {
      const ta = k / n, tb = (k + 1) / n, [lo, hi] = line(ta) < line(tb) ? [ta, tb] : [tb, ta];
      dark.poly([[...P(lo, line(lo)), 0, 0], [...P(hi, line(lo)), 1, 0], [...P(hi, line(hi)), 1, 1]]);
    }
    if (!a.lamps) return;
    // (white glass domes on a white base, lit)
    const glass = on(this.mat('bulkhead', () => new THREE.MeshStandardMaterial({ color: 0xf6f4ee, emissive: 0xfff3dc, emissiveIntensity: 0.85, roughness: 0.35, side: THREE.DoubleSide })));
    const rim = on(this.color(0xd9d9d6, 0.5, 0.2)), m = Math.max(1, Math.round(l / a.lamps.every)), N = 14, r = 0.15;
    for (let k = 0; k < m; k++) {
      const t = (k + 0.5) / m, hc = line(t) + a.lamps.h;
      const ring = (o: number, rr: number) => Array.from({ length: N }, (_, i) => {
        const q = (i / N) * Math.PI * 2;
        return [...P(t + (Math.cos(q) * rr) / l, hc + Math.sin(q) * rr, o), 0.5 + Math.cos(q) / 2, 0.5 + Math.sin(q) / 2];
      });
      const base = ring(0.012, r), lip = ring(0.04, r), dome = ring(0.09, r * 0.82);
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        rim.poly([base[i], base[j], lip[j], lip[i]]);
        glass.poly([lip[i], lip[j], dome[j], dome[i]]);
      }
      glass.poly(dome);
    }
  }

  // Lamp posts with white globes, on posts standing on the walkway or the deck beside it.
  private globes(a: Globes, frame: Frame, on: On) {
    const post = on(this.color(a.color ?? 0x1e1f21, 0.5, 0.4));
    const globe = on(this.mat('globe', () => new THREE.MeshStandardMaterial({ color: 0xf2f0e8, emissive: 0xfff3dc, emissiveIntensity: 0.55, roughness: 0.35 })));
    for (const [s, u, foot] of a.at) {
      const top = foot + a.height, n = a.cluster ?? 0;
      box(post, frame.at(s, u, (foot + top - 0.2) / 2), 1, 0, 0.11, top - 0.2 - foot, 0.11);
      ball(globe, frame.at(s, u, top), 0.22);
      for (let k = 0; k < n; k++) {
        const t = (k / n) * Math.PI * 2, ds = Math.cos(t) * 0.5, du = Math.sin(t) * 0.5;
        bar(post, frame.at(s, u, top - 0.62), frame.at(s + ds, u + du, top - 0.62), 0.04, 0.04);
        box(post, frame.at(s + ds, u + du, top - 0.58), 1, 0, 0.04, 0.12, 0.04);
        ball(globe, frame.at(s + ds, u + du, top - 0.3), 0.2);
      }
    }
  }

  // Rosengren's discs of opal plastic, hung on rods, and the round slabs in the paving under them.
  private discs(a: Discs, frame: Frame, on: On) {
    const rod = on(this.color(0x8d9195, 0.4, 0.6)), slab = on(this.color(0xbdbab3, 0.85, 0));
    const n = 40, [ls, lu] = a.size, top = a.bottom + a.thick;
    a.at.forEach(([s, u], k) => {
      const glow = on(this.mat(`disc:${a.colors[k % a.colors.length]}`, () => new THREE.MeshBasicMaterial({ color: a.colors[k % a.colors.length], side: THREE.DoubleSide })));
      const p = (i: number, y: number, rs = ls / 2, ru = lu / 2) => frame.at(s + rs * Math.cos((i / n) * Math.PI * 2), u + ru * Math.sin((i / n) * Math.PI * 2), y);
      for (let i = 0; i < n; i++) glow.poly([[...p(i, a.bottom), 0, 0], [...p(i + 1, a.bottom), 1, 0], [...p(i + 1, top), 1, 1], [...p(i, top), 0, 1]]);
      for (const y of [a.bottom, top]) glow.poly(Array.from({ length: n }, (_, i) => [...p(i, y), 0, 0]));
      for (const d of [-ls / 3, ls / 3]) box(rod, frame.at(s + d, u, (top + a.ceiling) / 2), 1, 0, 0.02, a.ceiling - top, 0.02);
      slab.poly(Array.from({ length: n }, (_, i) => [...p(i, a.floor + 0.012, lu / 2, lu / 2), 0, 0]));
    });
  }

  // Tamura's rods: thin cylinders of coloured plexiglas, lit by the skylight over them, the
  // rainbow running along each from end to end.
  private prismRods(a: PrismRods, frame: Frame, group: THREE.Group) {
    const glow = this.mat('prismRod', () => new THREE.MeshBasicMaterial({ map: T.rainbowRod(), transparent: true, opacity: 0.9 }));
    for (const [p, q] of a.rods) {
      const A = new THREE.Vector3(...frame.at(...p)), B = new THREE.Vector3(...frame.at(...q)), d = B.clone().sub(A);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(a.thick / 2, a.thick / 2, d.length(), 8), glow);
      mesh.position.copy(A.clone().add(B).multiplyScalar(0.5));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      group.add(mesh);
    }
  }

  // Min vän: rings of aluminium band strung on a level arc, two dark straps along them, at the
  // ring's outer and inner sides, and four wires up to the ceiling.
  private coil(a: Coil, frame: Frame, on: On) {
    const metal = on(this.color(0xc9cccf, 0.35, 0.6)), strap = on(this.color(0x2c2d2f, 0.6, 0.3)), wire = on(this.color(0x9a9da0, 0.4, 0.6));
    const ds = Math.cos(a.yaw), du = Math.sin(a.yaw), n = 28;
    // the arc's middle line at angle f (the coil's middle at f = 0), its tangent there, and the
    // point at angle g round the ring there, `along` m along the tangent
    const P = (f: number, g: number, along = 0, rr = a.r): XYZ => {
      const rs = -du * Math.cos(f) + ds * Math.sin(f), ru = ds * Math.cos(f) + du * Math.sin(f);
      const ts = ds * Math.cos(f) + du * Math.sin(f), tu = du * Math.cos(f) - ds * Math.sin(f);
      const cs = a.s + a.bend * (-du - rs), cu = a.u + a.bend * (ds - ru);
      return frame.at(cs + rs * rr * Math.cos(g) + ts * along, cu + ru * rr * Math.cos(g) + tu * along, a.h + rr * Math.sin(g));
    };
    for (let k = 0; k < a.loops; k++) {
      const f = -a.turn / 2 + (a.turn * (k + 0.5)) / a.loops;
      for (let i = 0; i < n; i++) {
        const g0 = (i / n) * Math.PI * 2, g1 = ((i + 1) / n) * Math.PI * 2;
        metal.poly([[...P(f, g0, -a.band / 2), 0, 0], [...P(f, g1, -a.band / 2), 1, 0], [...P(f, g1, a.band / 2), 1, 1], [...P(f, g0, a.band / 2), 0, 1]]);
      }
    }
    for (const g of [0, Math.PI]) {
      for (let k = 0; k < a.loops * 2; k++) {
        const f0 = -a.turn / 2 + (a.turn * k) / (a.loops * 2), f1 = -a.turn / 2 + (a.turn * (k + 1)) / (a.loops * 2);
        strap.poly([[...P(f0, g, 0, a.r - 0.004), 0, 0], [...P(f1, g, 0, a.r - 0.004), 1, 0], [...P(f1, g + 0.07, 0, a.r - 0.004), 1, 1], [...P(f0, g + 0.07, 0, a.r - 0.004), 0, 1]]);
      }
    }
    for (const f of [-a.turn * 0.35, -a.turn * 0.1, a.turn * 0.1, a.turn * 0.35]) {
      const top = P(f, Math.PI / 2);
      box(wire, [top[0], (top[1] + frame.st.platformY + a.ceiling) / 2, top[2]], 1, 0, 0.01, frame.st.platformY + a.ceiling - top[1], 0.01);
    }
  }

  // Falk's staves: each a T of two angles back to back, the flanges' outer faces bare and their
  // inner faces painted, leaning along the platform from a low plinth under each row.
  private staves(a: Staves, frame: Frame, on: On) {
    const bare = on(this.color(0xb4b6b3, 0.35, 0.6)), paint = on(this.color(a.color, 0.5, 0.2));
    const concrete = on(this.mat('plinth', () => new THREE.MeshStandardMaterial({ map: T.concrete(21, 170), color: 0xb5b1a9, roughness: 0.9, side: THREE.DoubleSide })));
    const foot = a.foot ?? 0, f = a.flange, t = 0.008, ls = Math.sin(a.lean), lc = Math.cos(a.lean);
    for (const [s0, u0, lengths] of a.rows) {
      const n = lengths.length, len = (n - 1) * a.every;
      box(concrete, frame.at(s0 + len / 2, u0, foot + 0.05), frame.fx, frame.fz, f * 2 + 0.3, 0.1, len + f * 2 + 0.5);
      lengths.forEach((L, k) => {
        const s = s0 + k * a.every;
        // a point x across the stave (along s, square to its lean), y across the platform and z
        // up along it, from its foot on the plinth
        const P = (x: number, y: number, z: number) => frame.at(s + x * lc + z * ls, u0 + y, foot + 0.05 - x * ls + z * lc);
        const face = (m: Mesh, a0: [number, number], a1: [number, number]) => m.poly([[...P(...a0, 0), 0, 0], [...P(...a1, 0), 1, 0], [...P(...a1, L), 1, 1], [...P(...a0, L), 0, 1]]);
        // the T's bar along s (the angles' outer legs, side by side) and its stem across the
        // platform (their other legs, back to back): the outsides bare, the insides painted
        for (const k of [-1, 1]) {
          face(bare, [0, 0], [k * f, 0]);
          face(paint, [k * t, t], [k * f, t]);
          face(bare, [k * f, 0], [k * f, t]);
          face(paint, [k * t, t], [k * t, f]);
          face(bare, [0, f], [k * t, f]);
          bare.poly([[...P(0, 0, L), 0, 0], [...P(k * f, 0, L), 1, 0], [...P(k * f, t, L), 1, 1], [...P(0, t, L), 0, 1]]);
          bare.poly([[...P(0, t, L), 0, 0], [...P(k * t, t, L), 1, 0], [...P(k * t, f, L), 1, 1], [...P(0, f, L), 0, 1]]);
        }
      });
    }
  }

  // The gallery along the bank beyond Axelsberg's southern track: its deck, pillars and lights,
  // the bank of stones under it with the apses dug into it, and the name's letters in its bays.
  private gallery(a: Gallery, frame: Frame, on: On) {
    const F = a.front, k = a.side, sA = F[0][0], sB = F[F.length - 1][0];
    // the front's u at s, straight between its points
    const frontAt = (s: number) => {
      if (s <= F[0][0]) return F[0][1];
      for (let i = 0; i + 1 < F.length; i++) {
        const [sa, ua] = F[i], [sb, ub] = F[i + 1];
        if (s <= sb) return ua + ((ub - ua) * (s - sa)) / (sb - sa || 1);
      }
      return F[F.length - 1][1];
    };
    // a point `z` behind the front at s, `h` high; the bank's height `z` behind the front
    const G = (s: number, z: number, h: number): XYZ => frame.at(s, frontAt(s) + k * z, h);
    const bankAt = (z: number) => {
      const B = a.bank;
      if (z <= B[0][0]) return B[0][1];
      for (let i = 0; i + 1 < B.length; i++) if (z <= B[i + 1][0]) return B[i][1] + ((B[i + 1][1] - B[i][1]) * (z - B[i][0])) / (B[i + 1][0] - B[i][0]);
      return B[B.length - 1][1];
    };
    const out = a.bank[0][0], D = a.depth, foot = a.bank[0][1];
    const concrete = on(this.finish('boardConcrete')), stones = on(this.finish('cobbles'));
    // (the soffit lit by the tubes under it)
    const soffit = on(this.mat('gallerySoffit', () => {
      const map = T.finish('boardConcrete');
      return new THREE.MeshStandardMaterial({ map, roughness: 0.9, emissive: 0x77756f, emissiveMap: map, side: THREE.DoubleSide });
    }));
    const deck = on(this.color(0x5d5e60, 0.85, 0.05)), white = on(this.color(0xe4e7e8, 0.6, 0.05));
    const tube = on(this.mat('galleryTube', () => new THREE.MeshStandardMaterial({ color: 0xf4f6f8, emissive: 0xf2f4ff, emissiveIntensity: 0.9, roughness: 0.3, side: THREE.DoubleSide })));
    const q = (s: number, z: number, h: number, w = 2.4, by: 'sz' | 'sh' | 'zh' = 'sz') =>
      [...G(s, z, h), (by === 'zh' ? z : s) / w, (by === 'sz' ? z : h) / w];
    // the holes in the bank: the apses, and the letters that sit down in it
    const holes: Volume[] = [];
    const hole = (pts: [number, number][]) => holes.push(prism(pts.map(([s, z]) => { const p = G(s, z, 0); return [p[0], p[2]]; }), pts.map(() => frame.st.platformY + foot - 3), pts.map(() => frame.st.platformY + a.top)));
    const N = 16;
    for (const A of a.apses ?? []) {
      const arc = Array.from({ length: N + 1 }, (_, i): [number, number] => {
        const t = (i / N) * Math.PI;
        return [A.s + Math.cos(t) * A.r, Math.sin(t) * A.r];
      });
      hole(arc);
      // its wall, up to the bank, and its floor
      const fl = bankAt(0);
      for (let i = 0; i < N; i++) {
        const [sa, za] = arc[i], [sb, zb] = arc[i + 1], la = (A.r * Math.PI * i) / N, lb = (A.r * Math.PI * (i + 1)) / N;
        concrete.poly([[...G(sa, za, fl), la / 2.4, 0], [...G(sb, zb, fl), lb / 2.4, 0], [...G(sb, zb, bankAt(zb)), lb / 2.4, (bankAt(zb) - fl) / 2.4], [...G(sa, za, bankAt(za)), la / 2.4, (bankAt(za) - fl) / 2.4]]);
      }
      stones.poly(arc.map(([s, z]) => q(s, z, fl + 0.01)));
    }
    const letters = a.letters ?? [];
    for (const L of letters) this.letter(L, a, frame, on, G, bankAt, hole);
    // in strips along it, broken at its points and its pillars
    const pillars: number[] = [];
    for (let s = a.pillars.at - Math.floor((a.pillars.at - sA) / a.pillars.every) * a.pillars.every; s < sB - 0.5; s += a.pillars.every) if (s > sA + 0.5) pillars.push(s);
    const cuts = [...new Set([...F.map(([s]) => s), ...pillars])].sort((x, y) => x - y);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const sa = cuts[i], sb = cuts[i + 1];
      // the bank, in bands across between the profile's points
      for (let j = 0; j + 1 < a.bank.length; j++) {
        const [za, ha] = a.bank[j], [zb, hb] = a.bank[j + 1];
        stones.poly([q(sa, za, ha), q(sb, za, ha), q(sb, zb, hb), q(sa, zb, hb)], holes);
      }
      // the back wall, the soffit, the deck's top (on out over the car park behind), and the face
      // up to the parapet, its top and its back
      const back = bankAt(D);
      concrete.poly([q(sa, D, back - 0.3, 2.4, 'sh'), q(sb, D, back - 0.3, 2.4, 'sh'), q(sb, D, a.soffit, 2.4, 'sh'), q(sa, D, a.soffit, 2.4, 'sh')]);
      soffit.poly([q(sa, 0, a.soffit), q(sb, 0, a.soffit), q(sb, D, a.soffit), q(sa, D, a.soffit)]);
      deck.poly([q(sa, 0.25, a.top), q(sb, 0.25, a.top), q(sb, D + 2, a.top), q(sa, D + 2, a.top)]);
      concrete.poly([q(sa, 0, a.soffit, 2.4, 'sh'), q(sb, 0, a.soffit, 2.4, 'sh'), q(sb, 0, a.parapet, 2.4, 'sh'), q(sa, 0, a.parapet, 2.4, 'sh')]);
      concrete.poly([q(sa, 0, a.parapet), q(sb, 0, a.parapet), q(sb, 0.25, a.parapet), q(sa, 0.25, a.parapet)]);
      concrete.poly([q(sa, 0.25, a.top, 2.4, 'sh'), q(sb, 0.25, a.top, 2.4, 'sh'), q(sb, 0.25, a.parapet, 2.4, 'sh'), q(sa, 0.25, a.parapet, 2.4, 'sh')]);
      // (the joint between the deck's edge and the parapet over it)
      const dark = on(this.color(0x6e6c68, 0.9, 0));
      dark.poly([[...G(sa, -0.005, a.top + 0.32), 0, 0], [...G(sb, -0.005, a.top + 0.32), 1, 0], [...G(sb, -0.005, a.top + 0.35), 1, 1], [...G(sa, -0.005, a.top + 0.35), 0, 1]]);
    }
    // the ends, closed from the bank's foot to the parapet
    for (const s of [sA, sB]) {
      concrete.poly([q(s, 0, foot - 0.3, 2.4, 'zh'), q(s, D, foot - 0.3, 2.4, 'zh'), q(s, D, a.parapet, 2.4, 'zh'), q(s, 0, a.parapet, 2.4, 'zh')]);
      concrete.poly([q(s, out, foot - 0.3, 2.4, 'zh'), q(s, 0, foot - 0.3, 2.4, 'zh'), q(s, 0, bankAt(0), 2.4, 'zh'), q(s, out, bankAt(out), 2.4, 'zh')]);
    }
    // the pillars, and a tube light under the front in each bay
    const P = a.pillars, along = (s: number) => { const p = G(s - 0.5, 0, 0), r = G(s + 0.5, 0, 0); return [r[0] - p[0], r[2] - p[2]]; };
    for (const s of pillars) {
      const [fx, fz] = along(s), bot = bankAt(P.inset) - 0.4;
      box(white, G(s, P.inset + P.size / 2, (bot + a.soffit) / 2), fx, fz, P.size, a.soffit - bot, P.size);
    }
    const bays = [sA, ...pillars, sB];
    for (let i = 0; i + 1 < bays.length; i++) {
      const mid = (bays[i] + bays[i + 1]) / 2, len = (bays[i + 1] - bays[i]) * 0.55, [fx, fz] = along(mid);
      box(tube, G(mid, 0.3, a.soffit - 0.04), fx, fz, 0.1, 0.06, len);
    }
  }

  // One of the name's letters in the gallery: drawn in a frame of its own, x to the right as seen
  // from the platform, y up, z away; `lean` back and `turn` about the upright through its foot.
  private letter(L: NonNullable<Gallery['letters']>[number], a: Gallery, frame: Frame, on: On,
    G: (s: number, z: number, h: number) => XYZ, bankAt: (z: number) => number, hole: (pts: [number, number][]) => void) {
    const k = a.side, s0 = L.s;
    // the letter's foot: on the bank, a little down into it
    const base = bankAt(L.z) - 0.08;
    let lean = 0, turn = 0, lift = 0;
    const tf = (x: number, y: number, z: number): XYZ => {
      const y1 = y * Math.cos(lean) - z * Math.sin(lean), z1 = y * Math.sin(lean) + z * Math.cos(lean);
      const x2 = x * Math.cos(turn) - z1 * Math.sin(turn), z2 = x * Math.sin(turn) + z1 * Math.cos(turn);
      return G(s0 - k * x2, L.z + z2, base + lift + y1);
    };
    const V = (x: number, y: number, z: number, u = 0, v = 0) => [...tf(x, y, z), u, v];
    // a convex outline (x, y), from z0 to z1 deep, its sides in `edge` if given
    const piece = (m: Mesh, pts: [number, number][], z0: number, z1: number, edge = m) => {
      m.poly(pts.map(([x, y]) => V(x, y, z0, x, y)));
      m.poly(pts.map(([x, y]) => V(x, y, z1, x, y)));
      for (let i = 0; i < pts.length; i++) {
        const [xa, ya] = pts[i], [xb, yb] = pts[(i + 1) % pts.length];
        edge.poly([V(xa, ya, z0, 0, 0), V(xb, yb, z0, 1, 0), V(xb, yb, z1, 1, 1), V(xa, ya, z1, 0, 1)]);
      }
    };
    const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    // a half-disc's outline, round (cx, cy), from angle t0 to t1
    const arc = (cx: number, cy: number, r: number, t0: number, t1: number, n = 10): [number, number][] =>
      Array.from({ length: n + 1 }, (_, i) => { const t = t0 + ((t1 - t0) * i) / n; return [cx + Math.cos(t) * r, cy + Math.sin(t) * r]; });
    // (the hole in the bank under a footprint, x and z in the letter's frame)
    const dig = (pts: [number, number][]) => hole(pts.map(([x, z]): [number, number] => [s0 - k * (x * Math.cos(turn) - z * Math.sin(turn)), L.z + x * Math.sin(turn) + z * Math.cos(turn)]));
    // (lying back on the bank, as steeply as it slopes there)
    const onBank = Math.PI / 2 - Math.atan2(bankAt(L.z + 1) - bankAt(L.z), 1);
    if (L.letter === 'A') {
      // a niche of polished steel behind glass, a slab of granite across it, dry leaves on its floor
      const W = 2.2, H = 1.75, D = 1.0, steel = on(this.color(0xc4c8ca, 0.12, 0.95)), frameSteel = on(this.color(0x9da2a5, 0.3, 0.8));
      lift = 0.08;
      dig([[-W / 2, 0], [W / 2, 0], [W / 2, D], [-W / 2, D]]);
      steel.poly([V(-W / 2, -0.3, D), V(W / 2, -0.3, D), V(W / 2, H, D), V(-W / 2, H, D)]);
      for (const x of [-W / 2, W / 2]) steel.poly([V(x, -0.3, 0), V(x, -0.3, D), V(x, H, D), V(x, H, 0)]);
      steel.poly([V(-W / 2, H, 0), V(W / 2, H, 0), V(W / 2, H, D), V(-W / 2, H, D)]);
      for (const x of [-W / 2, W / 2 - 0.12]) piece(frameSteel, rect(x, -0.3, x + 0.12, H + 0.06), -0.06, 0.06);
      piece(frameSteel, rect(-W / 2, H - 0.06, W / 2, H + 0.06), -0.06, 0.06);
      on(this.pane).poly([V(-W / 2 + 0.12, 0, 0.01), V(W / 2 - 0.12, 0, 0.01), V(W / 2 - 0.12, H - 0.06, 0.01), V(-W / 2 + 0.12, H - 0.06, 0.01)]);
      piece(on(this.color(0x8e8b87, 0.7, 0)), rect(-W / 2 + 0.08, 0.72, W / 2 - 0.08, 0.92), 0.3, 0.75);
      on(this.color(0xb08a55, 0.95, 0)).poly([V(-W / 2, 0.02, 0.02), V(W / 2, 0.02, 0.02), V(W / 2, 0.02, D), V(-W / 2, 0.02, D)]);
    } else if (L.letter === 'X') {
      // two lengths of track crossed, lying back on the bank
      lean = onBank; lift = 0.08;
      const rail = on(this.color(0x5a4a40, 0.5, 0.6)), sleeper = on(this.color(0x3a3029, 0.9, 0));
      for (const p of [-0.72, 0.72]) {
        const dx = Math.sin(p), dy = Math.cos(p), ax = Math.cos(p), ay = -Math.sin(p), cy = 1.0;
        const quad = (t0: number, t1: number, w0: number, w1: number): [number, number][] =>
          [[dx * t0 + ax * w0, cy + dy * t0 + ay * w0], [dx * t1 + ax * w0, cy + dy * t1 + ay * w0], [dx * t1 + ax * w1, cy + dy * t1 + ay * w1], [dx * t0 + ax * w1, cy + dy * t0 + ay * w1]];
        for (let t = -1.3; t <= 1.31; t += 0.36) piece(sleeper, quad(t - 0.06, t + 0.06, -0.38, 0.38), -0.07, 0);
        for (const g of [-0.24, 0.24]) piece(rail, quad(-1.45, 1.45, g - 0.035, g + 0.035), -0.17, -0.07);
      }
    } else if (L.letter === 'E') {
      // pale stone, leaning back and turned a little
      lean = 0.5; turn = 0.25;
      const stone = on(this.color(0xd3cdc0, 0.85, 0));
      piece(stone, rect(-0.6, 0, -0.2, 1.6), 0, 0.42);
      piece(stone, rect(-0.2, 1.26, 0.6, 1.6), 0, 0.42);
      piece(stone, rect(-0.2, 0.64, 0.45, 0.96), 0, 0.42);
      piece(stone, rect(-0.2, 0, 0.6, 0.34), 0, 0.42);
    } else if (L.letter === 'L') {
      // green marble, hung on a chain from the deck
      lift = 0.4;
      const green = on(this.color(0xa2b96e, 0.3, 0.05)), x0 = -0.62;
      piece(green, rect(x0, 0, x0 + 0.5, 1.75), 0, 0.32);
      piece(green, rect(x0 + 0.5, 0, x0 + 1.35, 0.42), 0, 0.32);
      piece(green, rect(x0 - 0.12, 1.6, x0 + 0.64, 1.75), 0, 0.32);
      piece(green, [[x0 + 1.2, 0.42], [x0 + 1.4, 0.42], [x0 + 1.4, 0.62]], 0, 0.32);
      const chain = on(this.color(0x55575a, 0.5, 0.7)), top = a.soffit - base - lift;
      limb(chain, tf(x0 + 0.25, 1.75, 0.16), tf(x0 + 0.25, top, 0.16), 0.03, 0.03);
    } else if (L.letter === 'S') {
      // a round bowl of sand dug into the bank, lying back with it, an S rising out of it
      lean = onBank; lift = 0.08;
      const sand = on(this.color(0xc9ac80, 0.95, 0)), R = 1.15, M = 20;
      const deep = (r: number) => 0.38 * (1 - (r / R) ** 2);
      dig(Array.from({ length: M }, (_, i): [number, number] => { const t = (i / M) * Math.PI * 2; return [Math.cos(t) * (R + 0.3), (0.9 + Math.sin(t) * (R + 0.3)) * Math.sin(lean)]; }));
      for (let i = 0; i < M; i++) {
        const t0 = (i / M) * Math.PI * 2, t1 = ((i + 1) / M) * Math.PI * 2;
        for (let j = 0; j < 4; j++) {
          const r0 = (R * j) / 4, r1 = (R * (j + 1)) / 4;
          const p = (t: number, r: number) => V(Math.cos(t) * r, 0.9 + Math.sin(t) * r, deep(r));
          sand.poly([p(t0, r0), p(t1, r0), p(t1, r1), p(t0, r1)]);
        }
        // its lip
        const p = (t: number, r: number, z: number) => V(Math.cos(t) * r, 0.9 + Math.sin(t) * r, z);
        sand.poly([p(t0, R, 0), p(t1, R, 0), p(t1, R + 0.14, -0.05), p(t0, R + 0.14, -0.05)]);
        sand.poly([p(t0, R + 0.14, -0.05), p(t1, R + 0.14, -0.05), p(t1, R + 0.3, 0.05), p(t0, R + 0.3, 0.05)]);
      }
      // the S: a band along two half-turns, standing out of the bowl
      const path: [number, number][] = [...arc(0, 1.2, 0.3, 0.3, 1.5 * Math.PI, 12), ...arc(0, 0.6, 0.3, 0.5 * Math.PI, -0.85 * Math.PI, 12).slice(1)];
      const w = 0.09, hgt = 0.2;
      for (let i = 0; i + 1 < path.length; i++) {
        const [xa, ya] = path[i], [xb, yb] = path[i + 1], l = Math.hypot(xb - xa, yb - ya) || 1, nx = -(yb - ya) / l * w, ny = (xb - xa) / l * w;
        const za = (x: number, y: number) => deep(Math.hypot(x, y - 0.9));
        const corner = (x: number, y: number, d: number) => V(x, y, za(x, y) - d);
        sand.poly([corner(xa - nx, ya - ny, hgt), corner(xb - nx, yb - ny, hgt), corner(xb + nx, yb + ny, hgt), corner(xa + nx, ya + ny, hgt)]);
        for (const sgn of [-1, 1]) sand.poly([corner(xa + sgn * nx, ya + sgn * ny, 0), corner(xb + sgn * nx, yb + sgn * ny, 0), corner(xb + sgn * nx, yb + sgn * ny, hgt), corner(xa + sgn * nx, ya + sgn * ny, hgt)]);
      }
    } else if (L.letter === 'B') {
      // pale rough stone, its edges banded in blue, lying back on the bank
      lean = 0.75;
      const stone = on(this.color(0xd8d6cf, 0.9, 0)), blue = on(this.color(0x2b4c9e, 0.5, 0.2)), x0 = -0.72;
      piece(stone, rect(x0, 0, x0 + 0.62, 1.66), 0, 0.3, blue);
      piece(stone, arc(x0 + 0.6, 0.46, 0.46, -Math.PI / 2, Math.PI / 2), 0, 0.3, blue);
      piece(stone, arc(x0 + 0.6, 1.26, 0.4, -Math.PI / 2, Math.PI / 2), 0, 0.3, blue);
    } else if (L.letter === 'e') {
      // the second E: boxes of black polished stone
      const black = on(this.color(0x0f1012, 0.15, 0.25));
      piece(black, rect(-0.55, 0, -0.22, 1.5), 0, 0.45);
      piece(black, rect(-0.22, 1.17, 0.55, 1.5), 0, 0.45);
      piece(black, rect(-0.22, 0.6, 0.42, 0.9), 0, 0.45);
      piece(black, rect(-0.22, 0, 0.55, 0.33), 0, 0.45);
    } else if (L.letter === 'R') {
      // a stem of dark stone, a bowl of bent steel tube, and a leg of a bent steel strip
      lean = 0.12;
      const stone = on(this.color(0x34322f, 0.6, 0.05)), rust = on(this.color(0x4a3327, 0.55, 0.45)), strip = on(this.color(0xc3c6c8, 0.3, 0.8));
      piece(stone, rect(-0.6, 0, -0.22, 1.55), 0, 0.3);
      const bowl = arc(-0.22, 1.18, 0.34, Math.PI / 2, -Math.PI / 2, 12);
      for (let i = 0; i + 1 < bowl.length; i++) limb(rust, tf(bowl[i][0], bowl[i][1], 0.15), tf(bowl[i + 1][0], bowl[i + 1][1], 0.15), 0.17, 0.17);
      // (the strip's broad side to the platform, bent down to the ground and up again at its end)
      const leg: [number, number][] = [[-0.22, 0.84], [0.0, 0.64], [0.2, 0.44], [0.4, 0.25], [0.6, 0.12], [0.8, 0.07], [0.95, 0.1], [1.05, 0.2]];
      for (let i = 0; i + 1 < leg.length; i++) {
        const [xa, ya] = leg[i], [xb, yb] = leg[i + 1], l = Math.hypot(xb - xa, yb - ya), nx = -(yb - ya) / l * 0.07, ny = (xb - xa) / l * 0.07;
        piece(strip, [[xa - nx, ya - ny], [xb - nx, yb - ny], [xb + nx, yb + ny], [xa + nx, ya + ny]], 0.08, 0.12);
      }
    } else if (L.letter === 'G') {
      // hollow, in a pale gold: a thick ring open at its right, and the bar
      const gold = on(this.color(0xc6ad7b, 0.35, 0.55)), cy = 0.86, Ro = 0.86, Ri = 0.6, d = 0.62, M = 22;
      const t0 = 0.6, t1 = 2 * Math.PI - 0.45;
      for (let i = 0; i < M; i++) {
        const ta = t0 + ((t1 - t0) * i) / M, tb = t0 + ((t1 - t0) * (i + 1)) / M;
        const p = (t: number, r: number, z: number) => V(Math.cos(t) * r, cy + Math.sin(t) * r, z);
        gold.poly([p(ta, Ri, 0), p(tb, Ri, 0), p(tb, Ro, 0), p(ta, Ro, 0)]);
        gold.poly([p(ta, Ri, d), p(tb, Ri, d), p(tb, Ro, d), p(ta, Ro, d)]);
        gold.poly([p(ta, Ro, 0), p(tb, Ro, 0), p(tb, Ro, d), p(ta, Ro, d)]);
        gold.poly([p(ta, Ri, 0), p(tb, Ri, 0), p(tb, Ri, d), p(ta, Ri, d)]);
      }
      for (const t of [t0, t1]) gold.poly([V(Math.cos(t) * Ri, cy + Math.sin(t) * Ri, 0), V(Math.cos(t) * Ro, cy + Math.sin(t) * Ro, 0), V(Math.cos(t) * Ro, cy + Math.sin(t) * Ro, d), V(Math.cos(t) * Ri, cy + Math.sin(t) * Ri, d)]);
      piece(gold, rect(0.3, 0.72, 0.86, 0.94), 0, d);
      piece(gold, rect(0.64, 0.4, 0.86, 0.94), 0, d);
    }
  }

  private block(b: Block, frame: Frame, on: On, cut: Volume[], name: string, roofCut: Volume[]) {
    const corners = b.plan, from = b.from ?? 0;
    const base = on(this.finish('boardConcrete'));
    for (let i = 0; i < 4; i++) {
      const [s0, u0] = corners[i], [s1, u1] = corners[(i + 1) % 4], l = Math.hypot(s1 - s0, u1 - u0);
      const P = (t: number, h: number) => frame.at(s0 + (s1 - s0) * t, u0 + (u1 - u0) * t, h);
      const f = b.sides?.[i] === undefined ? b.walls : b.sides[i];
      // the side's own finish up to the band, if there is one, and the band's above it, up to the
      // top at each end
      const ta = blockTop(b, i), tb = blockTop(b, (i + 1) % 4), fa = blockFrom(b, i), fb = blockFrom(b, (i + 1) % 4);
      const wall = (f: Finish, h0a: number, h0b: number, ha: number, hb: number) => {
        const [w, hh] = T.FINISH_SIZE[f];
        const q = [[...P(0, h0a), 0, (h0a - fa) / hh], [...P(1, h0b), l / w, (h0b - fb) / hh], [...P(1, hb), l / w, (hb - fb) / hh], [...P(0, ha), 0, (ha - fa) / hh]];
        on(this.finish(f)).poly(q, cut);
        if (T.FINISH_GLASS.includes(f) && !T.FINISH_OPEN.includes(f)) on(this.pane).poly(q, cut);
      };
      const band = b.band && b.band.from < Math.min(ta, tb) ? Math.max(from, b.band.from) : null;
      if (b.band?.low !== undefined) {
        // (a band whose foot rises or falls with the top: from `from` to `low` where the top does)
        const at = (k: number) => Math.max(blockFrom(b, k), k === 1 || k === 2 ? b.band!.low! : b.band!.from);
        const ba = Math.min(at(i), ta), bb = Math.min(at((i + 1) % 4), tb);
        if (f && (ba > fa || bb > fb)) wall(f, fa, fb, ba, bb);
        if (ba < ta || bb < tb) wall(b.band.walls, ba, bb, ta, tb);
      } else if (f && b.arch?.side === i) {
        // (a wall with an arched hole in it, in strips across, each from the arch up where it is
        // over the arch, from the floor otherwise; the band over it as elsewhere)
        const A = b.arch, half = (A.span[1] - A.span[0]) / 2, rise = A.crown - A.spring, R = (half * half + rise * rise) / (2 * rise);
        const archAt = (d: number) => {
          const x = Math.abs(d - (A.span[0] + A.span[1]) / 2);
          return x >= half ? -Infinity : A.crown - R + Math.sqrt(R * R - x * x);
        };
        const top = band ?? ta, n = Math.max(8, Math.ceil(l / 0.5)), [w, hh] = T.FINISH_SIZE[f];
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n, h0 = Math.max(fa, archAt(t0 * l)), h1 = Math.max(fa, archAt(t1 * l));
          if (h0 >= top && h1 >= top) continue;
          on(this.finish(f)).poly([[...P(t0, Math.min(h0, top)), t0 * l / w, (h0 - fa) / hh], [...P(t1, Math.min(h1, top)), t1 * l / w, (h1 - fa) / hh],
            [...P(t1, top), t1 * l / w, (top - fa) / hh], [...P(t0, top), t0 * l / w, (top - fa) / hh]], cut);
        }
        if (b.band && band !== null) wall(b.band.walls, band, band, ta, tb);
      } else {
        if (f && band === null && Math.max(ta - fa, tb - fb) > 0) wall(f, fa, fb, ta, tb);
        if (f && band !== null && band > from) wall(f, from, from, band, band);
        if (b.band && band !== null) wall(b.band.walls, band, band, ta, tb);
      }
      if (b.h[0] < Math.max(fa, fb)) base.poly([[...P(0, b.h[0]), 0, b.h[0] / 2.4], [...P(1, b.h[0]), l / 2.4, b.h[0] / 2.4], [...P(1, fb), l / 2.4, fb / 2.4], [...P(0, fa), 0, fa / 2.4]], cut);
      // lit signs on the side, halfway up the band (or the wall), standing out from it
      const mid = band !== null ? (band + b.h[1]) / 2 : (from + b.h[1]) / 2;
      const cs = corners.reduce((t, c) => t + c[0], 0) / 4, cu = corners.reduce((t, c) => t + c[1], 0) / 4;
      let ns = (u1 - u0) / l, nu = -(s1 - s0) / l;
      if (ns * ((s0 + s1) / 2 - cs) + nu * ((u0 + u1) / 2 - cu) < 0) { ns = -ns; nu = -nu; }
      // the name over the doors, on a blue band
      if (b.nameSign?.side === i) {
        const g = b.nameSign, m = on(this.mat(`nameBand:${name}:${g.length}:${!!g.black}`, () => {
          const map = T.nameBand(name, g.length, g.black);
          return new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.3, roughness: 0.4, side: THREE.DoubleSide });
        }));
        const d = (g.length / 2) / l, t0 = g.at - d, t1 = g.at + d, k = g.inside ? -1 : 1;
        const Q = (t: number, hh: number, out = 0.06) => [...frame.at(s0 + (s1 - s0) * t + ns * k * out, u0 + (u1 - u0) * t + nu * k * out, hh)];
        // (read from outside, or inside: its left end the one on the viewer's left)
        const left = ((s1 - s0) * nu - (u1 - u0) * ns) * k > 0 ? [t0, t1] : [t1, t0];
        m.poly([[...Q(left[0], g.bottom), 0, 0], [...Q(left[1], g.bottom), 1, 0], [...Q(left[1], g.bottom + 0.5), 1, 1], [...Q(left[0], g.bottom + 0.5), 0, 1]]);
        // its back, plain, which shows through a glass wall
        on(this.color(g.black ? 0x151618 : 0x1d2a5e, 0.6, 0.2)).poly([[...Q(t0, g.bottom, 0.04), 0, 0], [...Q(t1, g.bottom, 0.04), 0, 0], [...Q(t1, g.bottom + 0.5, 0.04), 0, 0], [...Q(t0, g.bottom + 0.5, 0.04), 0, 0]]);
      }
      for (const g of b.lights ?? []) {
        if (g.side !== i) continue;
        const sc = s0 + (s1 - s0) * g.at + ns * 0.05, uc = u0 + (u1 - u0) * g.at + nu * 0.05;
        const a = frame.at(sc, uc, mid), e = frame.at(sc + (s1 - s0) / l, uc + (u1 - u0) / l, mid);
        box(on(this.lightbox), a, e[0] - a[0], e[2] - a[2], 0.1, 0.42, g.length);
      }
    }
    if (b.roof) {
      // (out past the walls by the eaves: each corner moved out along both its sides' normals)
      const E = (i: number) => (Array.isArray(b.eaves) ? b.eaves[i] : b.eaves) ?? 0;
      const cs = corners.reduce((t, c) => t + c[0], 0) / 4, cu = corners.reduce((t, c) => t + c[1], 0) / 4;
      const normal = (i: number) => {
        const [s0, u0] = corners[i], [s1, u1] = corners[(i + 1) % 4], l = Math.hypot(s1 - s0, u1 - u0);
        let ns = (u1 - u0) / l, nu = -(s1 - s0) / l;
        if (ns * ((s0 + s1) / 2 - cs) + nu * ((u0 + u1) / 2 - cu) < 0) { ns = -ns; nu = -nu; }
        return [ns * E(i), nu * E(i)];
      };
      const out = corners.map(([s, u], i) => { const a = normal((i + 3) % 4), c = normal(i); return [s + a[0] + c[0], u + a[1] + c[1]]; });
      slab(on(b.roofColor === undefined ? this.roofing : this.color(b.roofColor, 0.7, 0.2)), out.map(([s, u], i) => frame.at(s, u, blockTop(b, i) + b.roof!)), b.roof, 0.5, roofCut);
      // the brackets under the eaves: a beam out under the roof, and a strut up to it from the wall
      const K = b.brackets, steel = K && on(this.color(K.color, 0.5, 0.3));
      for (let i = 0; K && steel && i < 4; i++) {
        const e = E(i);
        if (e < 0.3) continue;
        const [s0, u0] = corners[i], [s1, u1] = corners[(i + 1) % 4], l = Math.hypot(s1 - s0, u1 - u0);
        const [ns, nu] = normal(i).map((v) => v / e), n = Math.max(1, Math.round(l / K.every));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n, s = s0 + (s1 - s0) * t, u = u0 + (u1 - u0) * t;
          const top = blockTop(b, i) + (blockTop(b, (i + 1) % 4) - blockTop(b, i)) * t;
          bar(steel, frame.at(s, u, top), frame.at(s + ns * (e - 0.1), u + nu * (e - 0.1), top), 0.08, 0.18);
          bar(steel, frame.at(s + ns * 0.04, u + nu * 0.04, top - 1.0), frame.at(s + ns * e * 0.6, u + nu * e * 0.6, top - 0.15), 0.06, 0.06);
        }
      }
    }
    if (b.gables) this.gables(b, frame, on, roofCut);
    if (b.dome) this.groinVault(b, frame, on, cut);
    if (b.ceiling) {
      const [cw] = T.FINISH_SIZE[b.ceiling];
      const top = corners.map(([s, u], i) => [...frame.at(s, u, blockTop(b, i) - 0.01), u / cw, s / cw]);
      on(this.finish(b.ceiling, true)).poly(top, roofCut);
      // (a glass ceiling, a glazed roof seen from under it: the panes in its frames)
      if (T.FINISH_GLASS.includes(b.ceiling)) on(this.pane).poly(top, roofCut);
    }
    if (b.floor) {
      const [fw] = T.FINISH_SIZE[b.floor];
      on(this.finish(b.floor)).poly(corners.map(([s, u], i) => [...frame.at(s, u, blockFrom(b, i) - 0.02), u / fw, s / fw]), cut);
    }
  }

  // A shallow groin vault over a block (Blackeberg's hall): the two barrels crossing over it, their
  // underside the higher of the two at each point (so that the groins run down to the corners),
  // and a dome's rise over them, nothing at the edges and all of it at the middle; a beam along
  // its edges, and under it on each side the lunette, glazed in frames.
  private groinVault(b: Block, frame: Frame, on: On, cut: Volume[]) {
    const D = b.dome!, c = b.plan, N = 16, top = blockTop(b, 0);
    const len = (i: number) => Math.hypot(c[(i + 1) % 4][0] - c[i][0], c[(i + 1) % 4][1] - c[i][1]);
    // an arch from `spring` at its ends to `arch` at its middle, `h` m from either end to the middle
    const arch = (a: number, h: number) => {
      const r = D.arch - D.spring, R = (h * h + r * r) / (2 * r), x = Math.min(h, Math.abs(a) * h);
      return D.arch - R + Math.sqrt(R * R - x * x);
    };
    const hx = (len(0) + len(2)) / 4, hy = (len(1) + len(3)) / 4;
    const under = (t: number, v: number) => {
      const x = 2 * t - 1, y = 2 * v - 1;
      return Math.max(arch(x, hx), arch(y, hy)) + (D.crown - D.arch) * (1 - x * x) * (1 - y * y);
    };
    const plan = (t: number, v: number): [number, number] => {
      const s0 = c[0][0] + (c[1][0] - c[0][0]) * t, u0 = c[0][1] + (c[1][1] - c[0][1]) * t;
      const s1 = c[3][0] + (c[2][0] - c[3][0]) * t, u1 = c[3][1] + (c[2][1] - c[3][1]) * t;
      return [s0 + (s1 - s0) * v, u0 + (u1 - u0) * v];
    };
    const P = (t: number, v: number, h: number) => { const [s, u] = plan(t, v); return [...frame.at(s, u, h), u / 2.4, s / 2.4]; };
    const inner = on(this.finish('boardConcrete', true)), cover = on(b.roofColor === undefined ? this.roofing : this.color(b.roofColor, 0.7, 0.2));
    // the shell: its underside and its covering, in triangles split along the groins
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const t0 = i / N, t1 = (i + 1) / N, v0 = j / N, v1 = (j + 1) / N;
      const q = (t: number, v: number, d: number) => P(t, v, under(t, v) + d);
      const tris = i === j || i + j === N - 1 && false ? [[[t0, v0], [t1, v0], [t1, v1]], [[t0, v0], [t1, v1], [t0, v1]]]
        : i + j === N - 1 ? [[[t0, v0], [t1, v0], [t0, v1]], [[t1, v0], [t1, v1], [t0, v1]]]
          : [[[t0, v0], [t1, v0], [t1, v1]], [[t0, v0], [t1, v1], [t0, v1]]];
      for (const tri of tris) {
        inner.poly(tri.map(([t, v]) => q(t, v, 0)), cut);
        cover.poly(tri.map(([t, v]) => q(t, v, D.thick)), cut);
      }
    }
    // each side: the beam along its edge, the shell's edge over it, and the lunette under it
    const glassFrame = on(this.color(D.frame, 0.5, 0.2)), pane = on(this.pane);
    const cs = c.reduce((t, p) => t + p[0], 0) / 4, cu = c.reduce((t, p) => t + p[1], 0) / 4;
    for (let k = 0; k < 4; k++) {
      const [s0, u0] = c[k], [s1, u1] = c[(k + 1) % 4], l = len(k), h = k % 2 ? hy : hx;
      let ns = (u1 - u0) / l, nu = -(s1 - s0) / l;
      if (ns * ((s0 + s1) / 2 - cs) + nu * ((u0 + u1) / 2 - cu) > 0) { ns = -ns; nu = -nu; }
      const S = (a: number, hgt: number, inset = 0) => [...frame.at(s0 + (s1 - s0) * a + ns * inset, u0 + (u1 - u0) * a + nu * inset, hgt), a * l / 2.4, hgt / 2.4];
      const n = 24, edge = (a: number) => arch(2 * a - 1, h), low = (a: number) => Math.max(top, edge(a) - D.beam);
      for (let m = 0; m < n; m++) {
        const a0 = m / n, a1 = (m + 1) / n;
        // the beam's face and the shell's edge over it, its underside, and its inner face
        inner.poly([S(a0, low(a0)), S(a1, low(a1)), S(a1, edge(a1) + D.thick), S(a0, edge(a0) + D.thick)], cut);
        inner.poly([S(a0, low(a0)), S(a1, low(a1)), S(a1, low(a1), 0.35), S(a0, low(a0), 0.35)], cut);
        inner.poly([S(a0, low(a0), 0.35), S(a1, low(a1), 0.35), S(a1, edge(a1), 0.35), S(a0, edge(a0), 0.35)], cut);
        if (low(a0) > top + 0.05 || low(a1) > top + 0.05) pane.poly([S(a0, top), S(a1, top), S(a1, low(a1)), S(a0, low(a0))], cut);
      }
      // the frames: a sill, a transom, and mullions
      const glazed = Array.from({ length: n + 1 }, (_, m) => m / n).filter((a) => low(a) > top + 0.05);
      if (glazed.length < 2) continue;
      const ga = glazed[0], gb = glazed[glazed.length - 1];
      bar(glassFrame, frame.at(...plan2(s0, u0, s1, u1, ga), top + 0.05), frame.at(...plan2(s0, u0, s1, u1, gb), top + 0.05), 0.1, 0.1, cut);
      const tr = top + (D.arch - D.beam - top) * 0.4, ta = glazed.filter((a) => low(a) > tr + 0.05);
      if (ta.length > 1) bar(glassFrame, frame.at(...plan2(s0, u0, s1, u1, ta[0]), tr), frame.at(...plan2(s0, u0, s1, u1, ta[ta.length - 1]), tr), 0.07, 0.07, cut);
      const count = Math.max(1, Math.round(((gb - ga) * l) / D.frames));
      for (let m = 1; m < count; m++) {
        const a = ga + ((gb - ga) * m) / count;
        bar(glassFrame, frame.at(...plan2(s0, u0, s1, u1, a), top), frame.at(...plan2(s0, u0, s1, u1, a), low(a)), 0.07, 0.1, cut);
      }
    }
  }

  // Gables side by side on a block's roof along its first side, their ridges across it: the
  // slopes reaching 0.2 m past the ends, a strip of glass down the middle of each, the ends'
  // triangles under a trim along their edges. They sit on the roof as it slopes.
  private gables(b: Block, frame: Frame, on: On, cut: Volume[]) {
    const G = b.gables!, c = b.plan, base = 0, top = G.rise;
    const slope = on(b.roofColor === undefined ? this.roofing : this.color(b.roofColor, 0.7, 0.2));
    const end = on(this.color(G.color, 0.75, 0.05)), trim = on(this.color(G.trim, 0.6, 0.05)), glass = on(this.color(0x8d9ba6, 0.15, 0.5));
    const pane = on(this.pane), rib = G.glass && on(this.color(G.glass.color, 0.5, 0.3));
    // t along the first side, v along the second, h over the roof there
    const roofAt = (t: number, v: number) => (b.roof ?? 0) + (1 - v) * ((1 - t) * blockTop(b, 0) + t * blockTop(b, 1)) + v * ((1 - t) * blockTop(b, 3) + t * blockTop(b, 2));
    const P = (t: number, v: number, h: number): XYZ => {
      const s0 = c[0][0] + (c[1][0] - c[0][0]) * t, u0 = c[0][1] + (c[1][1] - c[0][1]) * t;
      const s1 = c[3][0] + (c[2][0] - c[3][0]) * t, u1 = c[3][1] + (c[2][1] - c[3][1]) * t;
      return frame.at(s0 + (s1 - s0) * v, u0 + (u1 - u0) * v, roofAt(t, v) + h);
    };
    const e = 0.2 / Math.hypot(c[2][0] - c[1][0], c[2][1] - c[1][1]), q = (p: XYZ) => [...p, 0, 0];
    for (let k = 0; k < G.count; k++) {
      const t0 = k / G.count, tm = (k + 0.5) / G.count, t1 = (k + 1) / G.count;
      if (G.round) {
        // a vault: its covering in strips round a half-ellipse, glass along its crown, its ends
        // fans under a trim round their edges
        const n = 12, arc = (j: number): [number, number] => [t0 + (t1 - t0) * (1 - Math.cos((j / n) * Math.PI)) / 2, base + G.rise * Math.sin((j / n) * Math.PI)];
        for (let j = 0; j < n; j++) {
          const [ta, ha] = arc(j), [tb, hb] = arc(j + 1);
          if (G.glass && rib) {
            // glazed all over, on arched ribs across it and bars along it
            pane.poly([q(P(ta, 0, ha)), q(P(tb, 0, hb)), q(P(tb, 1, hb)), q(P(ta, 1, ha))], cut);
            const L = Math.hypot(c[2][0] - c[1][0], c[2][1] - c[1][1]), m = Math.max(1, Math.round(L / G.glass.ribs));
            for (let r = 0; r <= m; r++) bar(rib, P(ta, r / m, ha), P(tb, r / m, hb), 0.08, 0.14);
            if (j % 3 === 0 && j > 0) bar(rib, P(ta, 0, ha), P(ta, 1, ha), 0.05, 0.08);
          } else {
            slope.poly([q(P(ta, -e, ha)), q(P(tb, -e, hb)), q(P(tb, 1 + e, hb)), q(P(ta, 1 + e, ha))], cut);
            if (j >= n / 2 - 2 && j < n / 2 + 2) glass.poly([q(P(ta, 0.04, ha + 0.03)), q(P(tb, 0.04, hb + 0.03)), q(P(tb, 0.96, hb + 0.03)), q(P(ta, 0.96, ha + 0.03))], cut);
          }
          for (const v of [0, 1]) {
            end.poly([q(P(tm, v, base)), q(P(ta, v, ha)), q(P(tb, v, hb))], cut);
            const w = v ? 1 + e : -e;
            if (!G.glass) bar(trim, P(ta, w, ha + 0.06), P(tb, w, hb + 0.06), 0.1, 0.2);
          }
        }
        continue;
      }
      for (const [a, z] of [[t0, tm], [t1, tm]]) {
        slope.poly([q(P(a, -e, base)), q(P(z, -e, top)), q(P(z, 1 + e, top)), q(P(a, 1 + e, base))], cut);
        // (the glass a little over the slope, from a third of the way up to two thirds)
        const g = (f: number) => [a + (z - a) * f, base + G.rise * f + 0.03] as const;
        const [ga, ha] = g(0.3), [gb, hb] = g(0.62);
        glass.poly([q(P(ga, 0.08, ha)), q(P(gb, 0.08, hb)), q(P(gb, 0.92, hb)), q(P(ga, 0.92, ha))], cut);
      }
      for (const v of [0, 1]) {
        end.poly([q(P(t0, v, base)), q(P(t1, v, base)), q(P(tm, v, top))], cut);
        const w = v ? 1 + e : -e;
        bar(trim, P(t0, w, base + 0.06), P(tm, w, top + 0.06), 0.1, 0.2);
        bar(trim, P(tm, w, top + 0.06), P(t1, w, base + 0.06), 0.1, 0.2);
      }
    }
  }

  // a lit sign's face: warm yellow, glowing
  private get lightbox() {
    return this.mat('lightbox', () => new THREE.MeshStandardMaterial({ color: 0xf6d21a, emissive: 0xf2c400, emissiveIntensity: 0.9, roughness: 0.4, side: THREE.DoubleSide }));
  }

  // Chain-link on posts every 2.5 m or so, with a rail along the top; or boards, standing side by
  // side on rails, or slanting between concrete posts.
  private fence(f: Fence, frame: Frame, on: On, cut: Volume[]) {
    if (f.kind === 'wall') return this.wallFence(f, frame, on, cut);
    if (f.kind === 'boards' || f.kind === 'louvres') return this.boardFence(f, frame, on);
    if (f.kind === 'glass') return this.glassFence(f, frame, on);
    if (f.kind === 'rails') return this.railFence(f, frame, on);
    if (f.kind === 'bars') return this.barFence(f, frame, on);
    // (galvanised, or coated in `color`)
    const css = f.color === undefined ? undefined : `#${f.color.toString(16).padStart(6, '0')}`;
    const link = on(this.mat(`chainLink:${css ?? ''}`, () => new THREE.MeshStandardMaterial({ map: T.chainLink(css), alphaTest: 0.35, roughness: 0.5, metalness: css ? 0.2 : 0.5, side: THREE.DoubleSide })));
    const post = on(this.color(f.color ?? 0x9aa0a4, 0.45, css ? 0.3 : 0.6));
    const [h0, h1] = f.h;
    let along = 0;
    for (let i = 0; i + 1 < f.points.length; i++) {
      const [sa, ua, da = 0] = f.points[i], [sb, ub, db = 0] = f.points[i + 1], l = Math.hypot(sb - sa, ub - ua), n = Math.max(1, Math.round(l / 2.5));
      const fs = (sb - sa) / l, fu = (ub - ua) / l;
      const d = frame.at(sb, ub, 0), c = frame.at(sa, ua, 0), fx = (d[0] - c[0]) / l, fz = (d[2] - c[2]) / l;
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const t = k / n;
        box(post, frame.at(sa + (sb - sa) * t, ua + (ub - ua) * t, (h0 + h1) / 2 + da + (db - da) * t), fx, fz, 0.05, h1 - h0, 0.05);
      }
      // (the mesh's texture square to the ground it stands on)
      const P = (t: number, h: number, a: number) => [...frame.at(sa + fs * l * t, ua + fu * l * t, h + da + (db - da) * t), a / 0.5, (h - h0) / 0.5];
      link.poly([P(0, h0, along), P(1, h0, along + l), P(1, h1, along + l), P(0, h1, along)]);
      bar(post, frame.at(sa, ua, h1 + 0.02 + da), frame.at(sb, ub, h1 + 0.02 + db), 0.04, 0.04);
      along += l;
    }
  }

  // A wall along the points, both faces in its finish, which runs on unbroken from one length to
  // the next (measured up from h[0]), and its top.
  private wallFence(f: Fence, frame: Frame, on: On, cut: Volume[]) {
    const fin = f.finish ?? 'boardConcrete', m = on(this.finish(fin)), [fw, fh] = T.FINISH_SIZE[fin], [h0, h1] = f.h, e = (f.thick ?? 0.3) / 2;
    const top = on(this.color(0x5a5856, 0.8));
    let along = 0;
    for (let i = 0; i + 1 < f.points.length; i++) {
      const [sa, ua, da = 0] = f.points[i], [sb, ub, db = 0] = f.points[i + 1], l = Math.hypot(sb - sa, ub - ua);
      // (each face out along the normal, the lengths overlapping a little where they bend)
      const ns = -(ub - ua) / l, nu = (sb - sa) / l, x = 0.02 / l;
      for (const k of [-e, e]) {
        const P = (t: number, h: number) => [...frame.at(sa + (sb - sa) * t + ns * k, ua + (ub - ua) * t + nu * k, h + da + (db - da) * t), (along + l * t) / fw, (h - h0) / fh];
        m.poly([P(-x, h0), P(1 + x, h0), P(1 + x, h1), P(-x, h1)], cut);
      }
      const Q = (t: number, k: number) => [...frame.at(sa + (sb - sa) * t + ns * k, ua + (ub - ua) * t + nu * k, h1 + da + (db - da) * t), 0, 0];
      top.poly([Q(0, -e), Q(1, -e), Q(1, e), Q(0, e)], cut);
      along += l;
    }
  }

  // A flat ceiling, the strips hung under it along the platforms, and the strip lights.
  private ceiling(a: Ceiling, frame: Frame, on: On, cut: Volume[]) {
    const [s0, s1] = a.s, [u0, u1] = a.u, [fw, fh] = T.FINISH_SIZE[a.finish], m = on(this.finish(a.finish, true));
    // (in squares of 10 m, so that the stairs' openings cut only those they climb through)
    for (let s = s0; s < s1 - 1e-6; s += 10) for (let u = u0; u < u1 - 1e-6; u += 10) {
      const sb = Math.min(s1, s + 10), ub = Math.min(u1, u + 10);
      m.poly([[s, u], [sb, u], [sb, ub], [s, ub]].map(([p, q]) => [...frame.at(p, q, a.h), p / fw, q / fh]), cut);
    }
    for (const st of a.strips ?? []) {
      const f = on(this.finish(st.finish, true)), side = on(this.finish(st.finish)), [gw, gh] = T.FINISH_SIZE[st.finish];
      let along = 0;
      for (let i = 0; i + 1 < st.points.length; i++) {
        const [sa, ua] = st.points[i], [sb, ub] = st.points[i + 1], l = Math.hypot(sb - sa, ub - ua), ns = -(ub - ua) / l, nu = (sb - sa) / l, w = st.width / 2;
        const P = (t: number, k: number, h: number, v: number) => [...frame.at(sa + (sb - sa) * t + ns * k, ua + (ub - ua) * t + nu * k, h), (along + l * t) / gw, v];
        f.poly([P(0, -w, st.h, -w / gh), P(1, -w, st.h, -w / gh), P(1, w, st.h, w / gh), P(0, w, st.h, w / gh)], cut);
        for (const k of [-w, w]) side.poly([P(0, k, st.h, 0), P(1, k, st.h, 0), P(1, k, a.h, (a.h - st.h) / gh), P(0, k, a.h, (a.h - st.h) / gh)], cut);
        along += l;
      }
    }
    const lamp = on(this.mat('lamp', () => new THREE.MeshBasicMaterial({ color: 0xfff5e0, side: THREE.DoubleSide })));
    const fitting = on(this.color(0xd8d8d4, 0.5, 0.2)), at = a.lampAt ?? a.h - 0.1;
    for (const row of a.lamps ?? []) {
      for (let i = 0; i + 1 < row.length; i++) {
        const [sa, ua] = row[i], [sb, ub] = row[i + 1], l = Math.hypot(sb - sa, ub - ua), n = Math.max(1, Math.round(l / 1.6));
        const o = frame.at(sa, ua, 0), e = frame.at(sb, ub, 0), dx = (e[0] - o[0]) / l, dz = (e[2] - o[2]) / l;
        for (let k = 0; k < n; k++) {
          const c = (k + 0.5) / n, p = (h: number) => frame.at(sa + (sb - sa) * c, ua + (ub - ua) * c, h);
          box(fitting, p(at + 0.04), dx, dz, 0.2, 0.08, Math.min(1.55, l / n - 0.02), cut);
          box(lamp, p(at - 0.005), dx, dz, 0.12, 0.012, Math.min(1.5, l / n - 0.06), cut);
        }
      }
    }
  }

  // Three round rails on posts about 2 m apart, the top one at h[1].
  private railFence(f: Fence, frame: Frame, on: On) {
    const m = on(this.color(f.color ?? 0xa08a52, 0.4, 0.6)), [h0, h1] = f.h, rails = [h1, h0 + (h1 - h0) * 0.62, h0 + (h1 - h0) * 0.25];
    for (let i = 0; i + 1 < f.points.length; i++) {
      const [sa, ua, da = 0] = f.points[i], [sb, ub, db = 0] = f.points[i + 1], l = Math.hypot(sb - sa, ub - ua), n = Math.max(1, Math.round(l / 2));
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const t = k / n, s = sa + (sb - sa) * t, u = ua + (ub - ua) * t, d = da + (db - da) * t;
        limb(m, frame.at(s, u, h0 + d), frame.at(s, u, h1 + 0.03 + d), 0.05, 0.05);
      }
      for (const r of rails) limb(m, frame.at(sa, ua, r + da), frame.at(sb, ub, r + db), 0.04, 0.04);
    }
  }

  // Upright bars between rails (drawn in the texture), on posts about 2 m apart.
  private barFence(f: Fence, frame: Frame, on: On) {
    const color = f.color ?? 0x1d1f21, css = `#${color.toString(16).padStart(6, '0')}`;
    const bars = on(this.mat(`fence:bars:${css}`, () => new THREE.MeshStandardMaterial({ map: T.barRailing(css), alphaTest: 0.5, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide })));
    const post = on(this.color(color, 0.5, 0.4)), [h0, h1] = f.h;
    let along = 0;
    for (let i = 0; i + 1 < f.points.length; i++) {
      const [sa, ua, da = 0] = f.points[i], [sb, ub, db = 0] = f.points[i + 1], l = Math.hypot(sb - sa, ub - ua), n = Math.max(1, Math.round(l / 2));
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const t = k / n, s = sa + (sb - sa) * t, u = ua + (ub - ua) * t, d = da + (db - da) * t;
        box(post, frame.at(s, u, (h0 + h1) / 2 + d + 0.02), 1, 0, 0.06, h1 - h0 + 0.04, 0.06);
      }
      const P = (t: number, h: number, a: number) => [...frame.at(sa + (sb - sa) * t, ua + (ub - ua) * t, h + da + (db - da) * t), a / 1.2, (h - h0) / (h1 - h0)];
      bars.poly([P(0, h0, along), P(1, h0, along + l), P(1, h1, along + l), P(0, h1, along)]);
      along += l;
    }
  }

  // Panes of glass 1.25 m wide in steel frames (drawn in the texture, the glass behind them).
  private glassFence(f: Fence, frame: Frame, on: On) {
    const frames = on(this.mat(`fence:glass:${!!f.leaves}`, () => new THREE.MeshStandardMaterial({ map: T.leafGlass(!!f.leaves), alphaTest: 0.5, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide })));
    const pane = on(this.pane), [h0, h1] = f.h;
    let along = 0;
    for (let i = 0; i + 1 < f.points.length; i++) {
      const [sa, ua] = f.points[i], [sb, ub] = f.points[i + 1], l = Math.hypot(sb - sa, ub - ua);
      const P = (t: number, h: number, a: number) => [...frame.at(sa + (sb - sa) * t, ua + (ub - ua) * t, h), a / 10, (h - h0) / (h1 - h0)];
      const q = [P(0, h0, along), P(1, h0, along + l), P(1, h1, along + l), P(0, h1, along)];
      frames.poly(q);
      pane.poly(q);
      along += l;
    }
  }

  private boardFence(f: Fence, frame: Frame, on: On) {
    const louvres = f.kind === 'louvres', color = f.color ?? (louvres ? 0x8a7a64 : 0x7c2b25);
    const boards = on(this.mat(`fence:${f.kind}:${color}`, () => {
      const map = T.fenceBoards(color, louvres);
      return new THREE.MeshStandardMaterial({ map, alphaTest: louvres ? 0.4 : 0, roughness: 0.85, side: THREE.DoubleSide });
    }));
    const post = louvres ? on(this.mat('fencePost', () => new THREE.MeshStandardMaterial({ map: T.concrete(23, 150), color: 0xb9b6ae, roughness: 0.9, side: THREE.DoubleSide }))) : boards;
    const [h0, h1] = f.h;
    let along = 0;
    for (let i = 0; i + 1 < f.points.length; i++) {
      const [sa, ua] = f.points[i], [sb, ub] = f.points[i + 1], l = Math.hypot(sb - sa, ub - ua), n = Math.max(1, Math.round(l / 2.4));
      const d = frame.at(sb, ub, 0), c = frame.at(sa, ua, 0), fx = (d[0] - c[0]) / l, fz = (d[2] - c[2]) / l;
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const t = k / n, p = frame.at(sa + (sb - sa) * t, ua + (ub - ua) * t, (h0 + h1 + 0.1) / 2);
        if (louvres) box(post, p, fx, fz, 0.16, h1 - h0 + 0.1, 0.16);
        else box(post, frame.at(sa + (sb - sa) * t, ua + (ub - ua) * t, (h0 + h1) / 2), fx, fz, 0.08, h1 - h0, 0.08);
      }
      const P = (t: number, h: number, a: number) => [...frame.at(sa + (sb - sa) * t, ua + (ub - ua) * t, h), a / 1.2, (h - h0) / (h1 - h0)];
      boards.poly([P(0, h0, along), P(1, h0, along + l), P(1, h1, along + l), P(0, h1, along)]);
      along += l;
    }
  }
}
