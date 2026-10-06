import * as THREE from 'three';
import { SurfaceIndex } from './surface-index';
import type { SurfaceHit } from './surface-index';
import { insideVolume, intersect, prism, subtractAll } from './clip.ts';
import type { Volume } from './clip.ts';
import { LANE, LIFT, floorHeights, inclineCorners, liftCorners, solidOf, spaceOf } from './station-layout.ts';
import type { CanopyPart, FloorPart, GatesPart, InclinePart, LiftPart, Part, SignPart, StationLayout, StationLayouts, StreetPart, XYZ } from './station-layout.ts';
import type { Lift } from './station';
import type { PlatformFloorData } from './network';
import * as T from './textures';

// The metro's stations on the network, built from public/data/station-layouts.json (see
// src/station-layout.ts and tools/build-stations.ts): their passages, halls, stairs, escalators
// and lifts between the platforms the network draws and the street. Everything that can be
// walked on is indexed at once; the rest is built as the camera comes near a station and dropped
// when it leaves.
//
// Walls aren't in the layout: they stand wherever a floor ends without another floor beyond it
// that can be stepped onto, as in the station model (src/station.ts). Each part's open space cuts
// what it runs into: the network's tunnel walls and platforms, and the station's other floors,
// walls and ceilings, so that a passage opens through a wall and stairs through a ceiling.

const LOAD = 700, UNLOAD = 950;
const PROBE = 0.15;   // how far beyond a floor's edge to look for the next floor
const STEP = 0.65;    // a floor within this height there can be stepped onto
const PIECE = 0.5;    // walls are found in pieces this long
const PARAPET = 1.1;  // walls around stairs coming up into the street stand this high

export interface StationFloorData {
  kind: 'station';
  rec: { label: string };
  station: string;
  top: number | null; // the ceiling's height over it, absolute; null in the open
  outdoor: boolean;
  street: boolean;    // the street around the exits, which buildings stand on
}

type MaterialName = 'floor' | 'wall' | 'ceiling' | 'stairs' | 'escalator' | 'skirt' | 'steel' | 'rubber' | 'glass' | 'lamp' | 'street' | 'canopy';

function materials() {
  const floor = T.floorTiles(), wall = T.wallTiles(), concrete = T.concrete(13, 176);
  return {
    floor: new THREE.MeshStandardMaterial({ map: floor, color: 0xb4b0a8, roughness: 0.6, side: THREE.DoubleSide }),
    wall: new THREE.MeshStandardMaterial({ map: wall, roughness: 0.55, side: THREE.DoubleSide }),
    // lit from below by the hemisphere's dark ground colour, so a little light of its own
    ceiling: new THREE.MeshStandardMaterial({ map: concrete, color: 0xf2efe8, emissive: 0x3a3936, roughness: 0.95, side: THREE.DoubleSide }),
    stairs: new THREE.MeshStandardMaterial({ map: concrete, color: 0xb8b4ad, roughness: 0.85, side: THREE.DoubleSide }),
    escalator: new THREE.MeshStandardMaterial({ color: 0x7c828b, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide }),
    skirt: new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.3, metalness: 0.8, side: THREE.DoubleSide }),
    steel: new THREE.MeshStandardMaterial({ color: 0xa9b0b6, roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.7, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd8e0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff5e0, side: THREE.DoubleSide }),
    street: new THREE.MeshStandardMaterial({ map: concrete, color: 0x6b6d70, roughness: 1, side: THREE.DoubleSide }),
    canopy: new THREE.MeshStandardMaterial({ color: 0xc4c8cc, emissive: 0x303236, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide }),
  } satisfies Record<MaterialName, THREE.Material>;
}

// Triangles with uvs, for one material; each polygon is cut by the given volumes as it is added.
// The materials are double-sided, so polygons may face either way.
class Mesh {
  pos: number[] = [];
  uv: number[] = [];
  get empty() { return this.pos.length === 0; }
  // a convex polygon of [x, y, z, u, v] vertices, minus the volumes
  poly(verts: number[][], cut: Volume[] = []) {
    for (const piece of subtractAll(verts, cut)) {
      for (let k = 1; k + 1 < piece.length; k++) {
        for (const v of [piece[0], piece[k], piece[k + 1]]) { this.pos.push(v[0], v[1], v[2]); this.uv.push(v[3], v[4]); }
      }
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

type Meshes = Record<MaterialName, Mesh>;

// A box `sx` across, `sy` high and `sz` along the direction (fx, fz), centred at c.
function box(m: Mesh, c: XYZ, fx: number, fz: number, sx: number, sy: number, sz: number, cut: Volume[] = []) {
  const rx = -fz, rz = fx;
  const P = (i: number, j: number, k: number) => [c[0] + rx * i * sx / 2 + fx * k * sz / 2, c[1] + j * sy / 2, c[2] + rz * i * sx / 2 + fz * k * sz / 2];
  const faces = [
    [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1]],
    [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]], [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]],
    [[-1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, 1]], [[1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, -1]],
  ];
  for (const f of faces) m.poly(f.map(([i, j, k], n) => [...P(i, j, k), n === 1 || n === 2 ? 1 : 0, n >= 2 ? 1 : 0]), cut);
}

// the open spaces of a station's parts, with the parts they belong to
interface Space { part: Part; vol: Volume }

export class Stations {
  group = new THREE.Group();
  walk = new SurfaceIndex<StationFloorData>(4);
  lifts: Lift[] = [];
  readonly layouts: StationLayout[];
  private built = new Map<string, THREE.Group>();
  private mats = materials();
  private signs = new Map<string, THREE.Texture>();
  private _hits: SurfaceHit<StationFloorData>[] = [];
  private _plat: SurfaceHit<PlatformFloorData>[] = [];

  // The volumes the network cuts out of what it draws: the stations' open spaces (`holes`), and,
  // from the platforms' floors, the solid undersides of the stairs (`solids`).
  static volumes(data: StationLayouts) {
    const holes: Volume[] = [], solids: Volume[] = [];
    for (const st of data.stations) {
      for (const p of st.parts) {
        if (p.kind === 'void') continue;
        const v = spaceOf(p);
        if (v) holes.push(v);
        if (p.kind === 'incline') solids.push(solidOf(p));
      }
    }
    return { holes, solids };
  }

  // The volumes cut out of the city's ground: every part's space where it comes up through it,
  // from a little under a floor, so the ground doesn't show through the floors at street level.
  static groundCuts(data: StationLayouts) {
    const cuts: Volume[] = [];
    for (const st of data.stations) {
      for (const p of st.parts) {
        if (p.kind === 'floor') {
          const h = p.corners.map((c) => c[1]);
          cuts.push(prism(p.corners.map((c): [number, number] => [c[0], c[2]]), h.map((y) => y - 0.3), h.map((y) => y + (p.ceiling ?? 3))));
        } else if (p.kind === 'incline' || p.kind === 'lift') cuts.push(spaceOf(p)!);
      }
    }
    return cuts;
  }

  // With `drawStreets` false, the street around the exits can be walked on but isn't drawn: the
  // city's ground is there.
  constructor(data: StationLayouts, private platforms: SurfaceIndex<PlatformFloorData> | null, private drawStreets = true) {
    this.group.name = 'stations';
    this.layouts = data.stations;
    for (const st of this.layouts) this.index(st);
  }

  // ---------------------------------------------------------------- walking
  private index(st: StationLayout) {
    const cutters: Volume[] = [];
    for (const p of st.parts) {
      if (p.kind === 'incline') cutters.push(spaceOf(p)!, solidOf(p));
      else if (p.kind === 'lift') cutters.push(spaceOf(p)!);
    }
    const data = (label: string, top: number | null, outdoor = false, street = false): StationFloorData => ({ kind: 'station', rec: { label }, station: st.name, top, outdoor, street });
    const add = (tri: number[][], d: StationFloorData, cut: Volume[]) => {
      for (const piece of subtractAll(tri, cut)) {
        for (let k = 1; k + 1 < piece.length; k++) {
          this.walk.add(new THREE.Vector3(...piece[0]), new THREE.Vector3(...piece[k]), new THREE.Vector3(...piece[k + 1]), d);
        }
      }
    };
    for (const p of st.parts) {
      if (p.kind === 'floor') {
        const c = p.corners, top = p.ceiling === null ? null : Math.max(...c.map((v) => v[1])) + p.ceiling;
        const d = data(p.label, top, p.ceiling === null);
        add([c[0], c[1], c[2]], d, cutters);
        add([c[0], c[2], c[3]], d, cutters);
      } else if (p.kind === 'incline') {
        const v = this.inclineFloor(p);
        const d = data(p.label, p.open !== undefined ? null : Math.max(p.a[1], p.b[1]) + p.ceiling);
        add([v[0], v[1], v[2]], d, []);
        add([v[0], v[2], v[3]], d, []);
      } else if (p.kind === 'street') {
        const d = data(`${st.name} · street`, null, true, true);
        this.streetCells(p, (q) => { add([q[0], q[1], q[2]], d, cutters); add([q[0], q[2], q[3]], d, cutters); });
      } else if (p.kind === 'lift') {
        const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
        const door = LIFT.depth / 2 + 0.9;
        this.lifts.push({
          center: new THREE.Vector3(p.x, p.levels[0], p.z), radius: LIFT.width / 2,
          minY: Math.min(...p.levels), maxY: Math.max(...p.levels),
          levels: p.levels.map((y) => ({ y, pos: new THREE.Vector3(p.x + fx * door, y, p.z + fz * door), yaw: p.yaw })),
        });
      }
    }
  }

  private inclineFloor(p: InclinePart): number[][] {
    const c = inclineCorners(p), h = floorHeights(p);
    return c.map(([x, z], i) => [x, h[i], z]);
  }

  private streetCells(p: StreetPart, fn: (q: number[][]) => void) {
    for (let i = 0; i + 1 < p.nz; i++) for (let j = 0; j + 1 < p.nx; j++) {
      const q = [[i, j], [i, j + 1], [i + 1, j + 1], [i + 1, j]].map(([a, b]) => [p.x0 + b * p.step, p.h[a * p.nx + b], p.z0 + a * p.step]);
      if (q.some((v) => v[1] === null)) continue;
      fn(q as number[][]);
    }
  }

  // Whether someone at (x, y, z) is out in the open (1) or inside a station (0); null away from
  // the stations.
  outdoorsAt(x: number, y: number, z: number) {
    let best: number | null = null;
    for (const h of this.walk.query(x, z, this._hits)) {
      if (Math.abs(h.y - y) > 1.5) continue;
      if (h.data.outdoor) return 1;
      best = 0;
    }
    return best;
  }

  // A place to stand on a station's platform, facing along it.
  spot(name: string) {
    const st = this.layouts.find((s) => s.name === name);
    if (!st || !this.platforms) return null;
    for (let r = 0; r < 30; r += 0.5) {
      for (let a = 0; a < 16; a++) {
        const x = st.x + Math.cos((a / 16) * Math.PI * 2) * r, z = st.z + Math.sin((a / 16) * Math.PI * 2) * r;
        const h = this.platforms.query(x, z, this._plat).find((q) => Math.abs(q.y - st.platformY) < 1);
        if (h) return { pos: new THREE.Vector3(x, h.y, z), yaw: st.yaw };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- building
  update(pos: THREE.Vector3) {
    for (const st of this.layouts) {
      const d = Math.hypot(st.x - pos.x, st.z - pos.z);
      const g = this.built.get(st.name);
      if (g && d > UNLOAD) {
        this.group.remove(g);
        g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
        this.built.delete(st.name);
      } else if (!g && d < LOAD) {
        const ng = this.build(st);
        this.built.set(st.name, ng);
        this.group.add(ng);
        return; // one a frame
      }
    }
  }

  private build(st: StationLayout) {
    const m = Object.fromEntries(Object.keys(this.mats).map((k) => [k, new Mesh()])) as Meshes;
    const group = new THREE.Group();
    group.name = st.name;
    const spaces: Space[] = [];
    const voids: Volume[] = [];
    for (const p of st.parts) {
      const v = spaceOf(p);
      if (!v) continue;
      if (p.kind === 'void') voids.push(v); else spaces.push({ part: p, vol: v });
    }
    // what cuts a part's walls and ceiling: every other part's space, and the network's halls
    const others = (p: Part) => [...spaces.filter((s) => s.part !== p).map((s) => s.vol), ...voids];
    for (const p of st.parts) {
      switch (p.kind) {
        case 'floor': this.buildFloor(p, m, others(p), spaces); break;
        case 'incline': this.buildIncline(p, m, others(p), [...voids, ...spaces.filter((s) => s.part !== p && s.part.kind === 'floor').map((s) => s.vol)]); break;
        case 'lift': this.buildLift(p, m); break;
        case 'gates': this.buildGates(p, m); break;
        case 'street': if (this.drawStreets) this.streetCells(p, (q) => m.street.poly(q.map((v) => [...v, v[0] / 4, v[2] / 4]), spaces.filter((s) => s.part.kind !== 'floor').map((s) => s.vol))); break;
        case 'canopy': this.buildCanopy(p, m, spaces.map((s) => s.vol)); break;
        case 'sign': group.add(this.buildSign(p, m)); break;
        default: break;
      }
    }
    for (const p of st.parts) if (p.kind === 'floor' || p.kind === 'incline') this.buildWalls(p, m, others(p));
    for (const p of st.parts) if (p.kind === 'incline') this.buildRailings(p, m);
    for (const [name, mesh] of Object.entries(m) as [MaterialName, Mesh][]) {
      if (!mesh.empty) group.add(new THREE.Mesh(mesh.build(), this.mats[name]));
    }
    return group;
  }

  private buildFloor(p: FloorPart, m: Meshes, cut: Volume[], spaces: Space[]) {
    const c = p.corners;
    // the floor is cut where stairs or a lift pass down through it
    const through = spaces.filter((s) => s.part !== p && s.part.kind !== 'floor').map((s) => s.vol);
    m.floor.poly(c.map((v) => [...v, v[0] / 2, v[2] / 2]), through);
    if (p.ceiling === null) return;
    const top = c.map((v): number[] => [v[0], v[1] + p.ceiling!, v[2], v[0] / 3, v[2] / 3]);
    m.ceiling.poly(top, cut);
    // lights down the middle, along the longer side
    const [a, b, cc, d] = c;
    const l1 = Math.hypot(b[0] - a[0], b[2] - a[2]), l2 = Math.hypot(d[0] - a[0], d[2] - a[2]);
    const [p0, p1, q0, q1] = l2 >= l1 ? [a, d, b, cc] : [a, b, d, cc];
    const s0: XYZ = [(p0[0] + q0[0]) / 2, (p0[1] + q0[1]) / 2, (p0[2] + q0[2]) / 2];
    const s1: XYZ = [(p1[0] + q1[0]) / 2, (p1[1] + q1[1]) / 2, (p1[2] + q1[2]) / 2];
    this.lampRow(m, s0, s1, p.ceiling - 0.04, cut);
  }

  private lampRow(m: Meshes, a: XYZ, b: XYZ, above: number, cut: Volume[]) {
    const l = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (l < 1) return;
    const fx = (b[0] - a[0]) / l, fz = (b[2] - a[2]) / l;
    const n = Math.max(1, Math.floor(l / 4));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const c: XYZ = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + above, a[2] + (b[2] - a[2]) * t];
      if (cut.some((v) => insideVolume(v, c[0], c[1], c[2]))) continue;
      box(m.lamp, c, fx, fz, 0.18, 0.05, 1.4);
    }
  }

  // Steps lane by lane, the balustrades between the escalators, the ceiling, and the sides of the
  // flight down to its foot where it stands in a room.
  private buildIncline(p: InclinePart, m: Meshes, cut: Volume[], rooms: Volume[]) {
    const dx = p.b[0] - p.a[0], dz = p.b[2] - p.a[2], run = Math.hypot(dx, dz) || 1;
    const fx = dx / run, fz = dz / run, rx = -fz, rz = fx;
    const rise = p.b[1] - p.a[1];
    const n = Math.max(1, Math.round(rise / 0.16));
    const at = (u: number, t: number, dy = 0): number[] => [p.a[0] + fx * run * t + rx * u, p.a[1] + rise * t + dy, p.a[2] + fz * run * t + rz * u];
    let u = -p.width / 2;
    const bounds = [u];
    for (const lane of p.lanes) {
      const w = LANE[lane as 'E' | 'S'];
      const mesh = lane === 'E' ? m.escalator : m.stairs;
      // each step: its riser, then its tread, so that the walking plane runs through the middle of
      // both; and a last riser up to the top
      const h = rise / n;
      for (let i = 0; i <= n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const r0 = at(u, t0, -h / 2), r1 = at(u + w, t0, -h / 2), r2 = at(u + w, t0, i === n ? 0 : h / 2), r3 = at(u, t0, i === n ? 0 : h / 2);
        mesh.poly([[...r0, 0, 0], [...r1, w, 0], [...r2, w, 0.16], [...r3, 0, 0.16]]);
        if (i === n) break;
        const tA = at(u, t0, h / 2), tB = at(u + w, t0, h / 2), tC = at(u + w, t1, -h / 2), tD = at(u, t1, -h / 2);
        mesh.poly([[...tA, 0, 0], [...tB, w, 0], [...tC, w, 0.3], [...tD, 0, 0.3]]);
      }
      u += w;
      bounds.push(u);
    }
    // balustrades: along each escalator, a skirt 1 m high topped by a handrail
    const lanes = [...p.lanes];
    bounds.forEach((ub, i) => {
      const esc = lanes[i - 1] === 'E' || lanes[i] === 'E';
      if (!esc) return;
      for (const k of [-0.06, 0.06]) {
        const off = i === 0 ? 0.06 : i === bounds.length - 1 ? -0.06 : k;
        const a0 = at(ub + off, 0), a1 = at(ub + off, 1), b0 = at(ub + off, 0, 1.0), b1 = at(ub + off, 1, 1.0);
        m.skirt.poly([[...a0, 0, 0], [...a1, 1, 0], [...b1, 1, 1], [...b0, 0, 1]]);
        if (i === 0 || i === bounds.length - 1) break;
      }
      const c = at(ub, 0.5, 1.02);
      const len = Math.hypot(run, rise);
      const rail = new THREE.Vector3(fx * run, rise, fz * run).normalize();
      // the handrail as a thin box along the slope
      const half = [rail.x * len / 2, rail.y * len / 2, rail.z * len / 2];
      const w = 0.05;
      const q = (s: number, du: number, dv: number) => [c[0] + half[0] * s + rx * du, c[1] + half[1] * s + dv, c[2] + half[2] * s + rz * du];
      m.rubber.poly([[...q(-1, -w, 0.04), 0, 0], [...q(-1, w, 0.04), 1, 0], [...q(1, w, 0.04), 1, 1], [...q(1, -w, 0.04), 0, 1]]);
      m.rubber.poly([[...q(-1, -w, -0.04), 0, 0], [...q(1, -w, -0.04), 1, 0], [...q(1, -w, 0.04), 1, 1], [...q(-1, -w, 0.04), 0, 1]]);
      m.rubber.poly([[...q(-1, w, 0.04), 0, 0], [...q(-1, w, -0.04), 1, 0], [...q(1, w, -0.04), 1, 1], [...q(1, w, 0.04), 0, 1]]);
    });
    // the flight's sides below its steps, down to its foot: only where it stands in a room
    const foot = p.a[1] - 0.05;
    for (const side of [-1, 1]) {
      const uu = side * p.width / 2;
      const a0 = at(uu, 0), a1 = at(uu, 1);
      const quad = [[a0[0], foot, a0[2], 0, 0], [a1[0], foot, a1[2], 1, 0], [...a1, 1, 1], [...a0, 0, 1]];
      for (const r of rooms) {
        const piece = intersect(quad, r);
        if (piece.length) m.skirt.poly(piece);
      }
    }
    // the ceiling, and lights up the middle
    const ceil = (uu: number, t: number) => at(uu, t, p.ceiling);
    // out into the street, or through a floor at the top: no ceiling over the opening
    let tEnd = p.open === undefined ? 1 : Math.max(0, Math.min(1, (p.open - p.a[1] - p.ceiling) / (rise || 1)));
    if (this.throughFloor(p)) tEnd = Math.min(tEnd, Math.max(0, 1 - p.ceiling / (rise || 1)));
    if (tEnd > 0) {
      const w2 = p.width / 2;
      const c0 = ceil(-w2, 0), c1 = ceil(w2, 0), c2 = ceil(w2, tEnd), c3 = ceil(-w2, tEnd);
      m.ceiling.poly([[...c0, 0, 0], [...c1, p.width / 3, 0], [...c2, p.width / 3, run * tEnd / 3], [...c3, 0, run * tEnd / 3]], cut);
      this.lampRow(m, at(0, 0) as XYZ, at(0, tEnd) as XYZ, p.ceiling - 0.04, cut);
    }
  }

  // Walls along every edge of a floor or flight that leads nowhere, and a lintel down to a lower
  // ceiling where it leads into a lower room.
  private buildWalls(p: FloorPart | InclinePart, m: Meshes, cut: Volume[]) {
    const corners: XYZ[] = p.kind === 'floor' ? p.corners : this.inclineFloor(p).map((v) => [v[0], v[1], v[2]] as XYZ);
    const ceiling = p.kind === 'floor' ? p.ceiling : p.ceiling;
    const cx = corners.reduce((s, c) => s + c[0], 0) / corners.length, cz = corners.reduce((s, c) => s + c[2], 0) / corners.length;
    const n = corners.length;
    for (let e = 0; e < n; e++) {
      const a = corners[e], b = corners[(e + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (len < 0.05) continue;
      let ox = (b[2] - a[2]) / len, oz = -(b[0] - a[0]) / len;
      const mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2;
      if (ox * (mx - cx) + oz * (mz - cz) < 0) { ox = -ox; oz = -oz; }
      const pieces = Math.max(1, Math.round(len / PIECE));
      // runs of pieces with the same kind of wall: [from, to, kind, lintel bottom]
      let run: { t0: number; t1: number; bottom: 'floor' | number } | null = null;
      const flush = () => {
        if (!run) return;
        this.wallQuad(p, m, a, b, run.t0, run.t1, run.bottom, ceiling, cut, len);
        run = null;
      };
      for (let i = 0; i < pieces; i++) {
        const t = (i + 0.5) / pieces;
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
        const myTop = ceiling === null ? null : y + ceiling;
        const next = this.nextFloor(x + ox * PROBE, z + oz * PROBE, y);
        let bottom: 'floor' | number | null;
        if (!next) bottom = 'floor';
        else if (next.top !== null && myTop !== null && next.top < myTop - 0.05) bottom = next.top;
        else bottom = null;
        const same = run && bottom !== null && (run.bottom === bottom || (typeof run.bottom === 'number' && typeof bottom === 'number' && Math.abs(run.bottom - bottom) < 0.05));
        if (same) run!.t1 = (i + 1) / pieces;
        else {
          flush();
          if (bottom !== null) run = { t0: i / pieces, t1: (i + 1) / pieces, bottom };
        }
      }
      flush();
    }
  }

  // The floor beyond an edge that can be stepped onto, and its ceiling's height (Infinity for the
  // network's platforms, whose halls the network draws).
  private nextFloor(x: number, z: number, y: number): { top: number | null } | null {
    let best: { y: number; top: number | null } | null = null;
    for (const h of this.walk.query(x, z, this._hits)) {
      if (Math.abs(h.y - y) <= STEP && (!best || Math.abs(h.y - y) < Math.abs(best.y - y))) best = { y: h.y, top: h.data.top };
    }
    if (best) return best;
    if (this.platforms) {
      for (const h of this.platforms.query(x, z, this._plat)) if (Math.abs(h.y - y) <= STEP) return { top: Infinity };
    }
    return null;
  }

  private wallQuad(p: FloorPart | InclinePart, m: Meshes, a: XYZ, b: XYZ, t0: number, t1: number, bottom: 'floor' | number, ceiling: number | null, cut: Volume[], len: number) {
    const P = (t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const p0 = P(t0), p1 = P(t1);
    // the top: the ceiling; in the open, a parapet; around stairs coming up into the street, the
    // ceiling below the street and a parapet above it
    const open = p.kind === 'incline' ? p.open : undefined;
    // and down through a floor, no higher than the floor
    const cap = p.kind === 'incline' && this.throughFloor(p) ? p.b[1] : Infinity;
    const top = (q: number[]) => {
      if (ceiling === null) return q[1] + PARAPET;
      if (open !== undefined) return Math.min(q[1] + ceiling, Math.max(open + PARAPET, q[1] + PARAPET));
      return Math.min(cap, q[1] + ceiling);
    };
    const lo = (q: number[]) => (bottom === 'floor' ? q[1] - 0.6 : bottom);
    const [u0, u1] = [t0 * len / 2, t1 * len / 2];
    const quad = [
      [p0[0], lo(p0), p0[2], u0, lo(p0) / 2], [p1[0], lo(p1), p1[2], u1, lo(p1) / 2],
      [p1[0], top(p1), p1[2], u1, top(p1) / 2], [p0[0], top(p0), p0[2], u0, top(p0) / 2],
    ];
    if (quad[2][1] <= quad[1][1] + 0.01 && quad[3][1] <= quad[0][1] + 0.01) return;
    m.wall.poly(quad, cut);
  }

  // Whether stairs go down through a floor at their top (a platform, a hall), rather than leading
  // off its edge: whether there is floor beside them there.
  private through = new Map<InclinePart, boolean>();
  private throughFloor(p: InclinePart) {
    let v = this.through.get(p);
    if (v !== undefined) return v;
    const dx = p.b[0] - p.a[0], dz = p.b[2] - p.a[2], run = Math.hypot(dx, dz) || 1;
    const rx = -dz / run, rz = dx / run, top = p.b[1];
    v = false;
    for (const t of [0.75, 0.9]) for (const side of [-1, 1]) {
      const u = side * (p.width / 2 + 0.3);
      const x = p.a[0] + dx * t + rx * u, z = p.a[2] + dz * t + rz * u;
      if (this.walk.query(x, z, this._hits).some((h) => Math.abs(h.y - top) < 0.15)
        || this.platforms?.query(x, z, this._plat).some((h) => Math.abs(h.y - top) < 0.15)) v = true;
    }
    this.through.set(p, v);
    return v;
  }

  // Where stairs go down through a floor (a platform, a hall), a railing round the opening: along
  // its sides and across its far end, wherever there is floor beside it at the top.
  private buildRailings(p: InclinePart, m: Meshes) {
    const dx = p.b[0] - p.a[0], dz = p.b[2] - p.a[2], run = Math.hypot(dx, dz) || 1;
    const fx = dx / run, fz = dz / run, rx = -fz, rz = fx;
    const rise = p.b[1] - p.a[1], top = p.b[1];
    // the opening: from where the flight's ceiling passes up through the floor at the top
    const t0 = Math.max(0, 1 - p.ceiling / (rise || 1));
    const floorAt = (x: number, z: number) => this.walk.query(x, z, this._hits).some((h) => Math.abs(h.y - top) < 0.15)
      || !!this.platforms?.query(x, z, this._plat).some((h) => Math.abs(h.y - top) < 0.15);
    const panel = (ax: number, az: number, bx: number, bz: number) => {
      m.glass.poly([[ax, top, az, 0, 0], [bx, top, bz, 1, 0], [bx, top + 1, bz, 1, 1], [ax, top + 1, az, 0, 1]]);
      const cx = (ax + bx) / 2, cz = (az + bz) / 2, l = Math.hypot(bx - ax, bz - az) || 1;
      box(m.steel, [cx, top + 1.02, cz], (bx - ax) / l, (bz - az) / l, 0.06, 0.05, l);
    };
    const n = Math.max(1, Math.round((run * (1 - t0)) / PIECE));
    for (const side of [-1, 1]) {
      const u = side * (p.width / 2 + 0.05);
      for (let i = 0; i < n; i++) {
        const ta = t0 + ((1 - t0) * i) / n, tb = t0 + ((1 - t0) * (i + 1)) / n, tm = (ta + tb) / 2;
        const px = p.a[0] + fx * run * tm + rx * (u + side * 0.2), pz = p.a[2] + fz * run * tm + rz * (u + side * 0.2);
        if (!floorAt(px, pz)) continue;
        panel(p.a[0] + fx * run * ta + rx * u, p.a[2] + fz * run * ta + rz * u, p.a[0] + fx * run * tb + rx * u, p.a[2] + fz * run * tb + rz * u);
      }
    }
    if (t0 > 0) {
      const k = Math.max(1, Math.round(p.width / PIECE));
      const ex = p.a[0] + fx * (run * t0 - 0.05), ez = p.a[2] + fz * (run * t0 - 0.05);
      for (let i = 0; i < k; i++) {
        const ua = -p.width / 2 + (p.width * i) / k, ub = -p.width / 2 + (p.width * (i + 1)) / k, um = (ua + ub) / 2;
        if (!floorAt(ex - fx * 0.2 + rx * um, ez - fz * 0.2 + rz * um)) continue;
        panel(ex + rx * ua, ez + rz * ua, ex + rx * ub, ez + rz * ub);
      }
    }
  }

  private buildLift(p: LiftPart, m: Meshes) {
    const c = liftCorners(p);
    const y0 = Math.min(...p.levels) - LIFT.below, y1 = Math.max(...p.levels) + LIFT.above;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = c[i], [bx, bz] = c[(i + 1) % 4];
      m.glass.poly([[ax, y0, az, 0, 0], [bx, y0, bz, 1, 0], [bx, y1, bz, 1, 1], [ax, y1, az, 0, 1]]);
      // a steel post at each corner
      box(m.steel, [ax, (y0 + y1) / 2, az], 1, 0, 0.1, y1 - y0, 0.1);
    }
    m.steel.poly([[c[0][0], y1, c[0][1], 0, 0], [c[1][0], y1, c[1][1], 1, 0], [c[2][0], y1, c[2][1], 1, 1], [c[3][0], y1, c[3][1], 0, 1]]);
    // the car, standing at the lowest stop, and a frame round the door at each
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    box(m.steel, [p.x, Math.min(...p.levels) + 1.2, p.z], fx, fz, LIFT.width - 0.3, 2.4, LIFT.depth - 0.3);
    for (const y of p.levels) {
      const d: XYZ = [p.x + fx * (LIFT.depth / 2 + 0.02), y + 1.1, p.z + fz * (LIFT.depth / 2 + 0.02)];
      box(m.steel, d, fx, fz, 1.2, 2.2, 0.06);
    }
  }

  private buildGates(p: GatesPart, m: Meshes) {
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = -fz, rz = fx;
    const n = Math.max(2, Math.floor(p.width / 0.9));
    for (let i = 0; i <= n; i++) {
      const u = -p.width / 2 + 0.3 + ((p.width - 0.6) * i) / n;
      box(m.steel, [p.x + rx * u, p.y + 0.5, p.z + rz * u], fx, fz, 0.22, 1.0, 1.6);
      if (i < n) {
        const v = u + (p.width - 0.6) / n / 2;
        box(m.glass, [p.x + rx * v, p.y + 0.85, p.z + rz * v], fx, fz, 0.5, 0.7, 0.02);
      }
    }
  }

  private buildCanopy(p: CanopyPart, m: Meshes, cut: Volume[]) {
    const pts = p.points;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
      const rx = -(b[2] - a[2]) / l * p.width / 2, rz = (b[0] - a[0]) / l * p.width / 2;
      for (const dy of [0, 0.25]) {
        m.canopy.poly([[a[0] - rx, a[1] + dy, a[2] - rz, 0, 0], [a[0] + rx, a[1] + dy, a[2] + rz, 1, 0], [b[0] + rx, b[1] + dy, b[2] + rz, 1, 1], [b[0] - rx, b[1] + dy, b[2] - rz, 0, 1]], cut);
      }
      this.lampRow(m, [a[0], a[1], a[2]], [b[0], b[1], b[2]], -0.04, cut);
      if (i % 2 === 0) box(m.canopy, [a[0], a[1] - 1.6, a[2]], (b[0] - a[0]) / l, (b[2] - a[2]) / l, 0.25, 3.2, 0.25, cut);
    }
  }

  // A pole with the blue T, and the station's name under it.
  private buildSign(p: SignPart, m: Meshes) {
    const g = new THREE.Group();
    box(m.steel, [p.x, p.y + 1.6, p.z], 1, 0, 0.12, 3.2, 0.12);
    // both ways, back to back
    for (const turn of [0, Math.PI]) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: this.signTexture('T') }));
      t.position.set(p.x, p.y + 3.6, p.z);
      t.rotation.y = p.yaw + turn;
      g.add(t);
      const name = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshBasicMaterial({ map: this.signTexture(p.text) }));
      name.position.set(p.x, p.y + 2.85, p.z);
      name.rotation.y = p.yaw + turn;
      g.add(name);
    }
    return g;
  }

  private signTexture(text: string) {
    let t = this.signs.get(text);
    if (t) return t;
    if (text === 'T') {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const x = c.getContext('2d')!;
      x.fillStyle = '#0c4da2'; x.fillRect(0, 0, 256, 256);
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(128, 128, 104, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#0c4da2';
      x.beginPath(); x.arc(128, 128, 92, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff';
      x.font = 'bold 150px "Helvetica Neue", Arial, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('T', 128, 136);
      t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
    } else t = T.nameSign(text);
    this.signs.set(text, t);
    return t;
  }
}
