import * as THREE from 'three';
import type { TrackGraph } from './track-graph';
import { STRUCTURE_KINDS } from './track-geometry';
import type { GeometryPiece, GeometryPlatform, StructureKind, TrackGeometry } from './track-geometry';
import * as S from './sections';
import * as T from './textures';
import { SurfaceIndex } from './surface-index';
import { cutIndexed, loft, subtractAll } from './clip.ts';
import type { Volume } from './clip.ts';

// The metro's track outside the station models: track, rails and the conductor rail, and the
// tunnel, bridge or bank around them, swept along public/data/track-geometry.json in cross-sections
// from src/sections.ts. The network is cut into square tiles, and only the tiles near the camera
// are built; the rest are built as the camera comes near and dropped when it leaves.

const STEP = 2.5;        // metres between the cross-sections
const TILE = 200;        // tile size
const LOAD = 600;        // build tiles whose centre is this close (plus half a diagonal)
const UNLOAD = 850;      // and drop them beyond this
const BUILD_PER_UPDATE = 2;
const SHELL_POINTS = 25; // points around a tunnel's outline
const OVERLAP = 0.15;    // the halves of a shared tunnel or deck overlap by this at the middle
const GROUND_STRIP = 14; // open track: a strip of ground this far out from the track (without a city)
const SKIRT = 3;         // with a city: a bank's slope goes on this far below the ground
const POINT_CELL = 20;

type UV = [number, number];

interface Sample {
  x: number; y: number; z: number; // centre of the track at the top of the rails
  rx: number; rz: number;          // unit vector to the right of `from` → `to`
  along: number;                   // distance from the start of the piece, for textures
  s: number;                       // distance along the piece in the track graph
  kind: StructureKind;
  pair: number; pairDy: number;
  // the nearest other track on each side, as in src/track-geometry.ts (negative for a service's)
  left: number; right: number;
  yard: boolean;                   // track no service runs on: crossovers, sidings, depots
  ground: number | null;
  plat: GeometryPlatform | null;
  third: 1 | -1;                   // the conductor rail's side
  skip: boolean;                   // the station draws it all
  noTrack: boolean;                // the station draws the track
  mouth?: boolean;                 // a piece's end where its tunnel meets another piece in the open
  deadEnd?: boolean;               // a piece's end that meets no other piece: a buffer stop
}

// A part of the network the station models draw themselves: a stretch of a piece, in the track
// graph's distances; with `trackOnly`, the station draws the track there but the network still
// draws the tunnel around it.
export interface Exclusion { piece: number; s0: number; s1: number; trackOnly?: boolean }

// What the player stands on, on a platform of the network's stations.
export interface PlatformFloorData { kind: 'platform'; rec: { label: string }; station: string }

interface Run { samples: Sample[]; i0: number; i1: number }
interface Tile { key: string; cx: number; cz: number; runs: Run[]; group: THREE.Group | null }

// Triangles in a growing indexed geometry.
class MeshBuilder {
  pos: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  get empty() { return this.idx.length === 0; }
  vertex(x: number, y: number, z: number, u: number, v: number) {
    this.pos.push(x, y, z);
    this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }
  // a grid of rows × cols vertices, given row by row, made into quads
  grid(rows: number, cols: number, first: number) {
    for (let i = 0; i + 1 < rows; i++) {
      for (let j = 0; j + 1 < cols; j++) {
        const a = first + i * cols + j, b = a + 1, c = a + cols + 1, d = a + cols;
        this.idx.push(a, c, d, a, b, c);
      }
    }
  }
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, ua: UV = [0, 0], ub: UV = [1, 0], uc: UV = [1, 1], ud: UV = [0, 1]) {
    const i = this.vertex(a.x, a.y, a.z, ...ua);
    this.vertex(b.x, b.y, b.z, ...ub);
    this.vertex(c.x, c.y, c.z, ...uc);
    this.vertex(d.x, d.y, d.z, ...ud);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  // with the holes cut out of it, after the normals are found, so it stays smooth around them
  build(holes: Volume[] = []) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    if (holes.length) {
      const n = g.attributes.normal.array, attrs: number[] = [];
      for (let i = 0; i < this.pos.length / 3; i++) {
        attrs.push(this.pos[3 * i], this.pos[3 * i + 1], this.pos[3 * i + 2], this.uv[2 * i], this.uv[2 * i + 1], n[3 * i], n[3 * i + 1], n[3 * i + 2]);
      }
      const cut = cutIndexed(attrs, 8, this.idx, holes);
      const count = cut.attrs.length / 8;
      const pos = new Float32Array(count * 3), uv = new Float32Array(count * 2), normal = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const a = cut.attrs;
        pos.set([a[8 * i], a[8 * i + 1], a[8 * i + 2]], 3 * i);
        uv.set([a[8 * i + 3], a[8 * i + 4]], 2 * i);
        normal.set([a[8 * i + 5], a[8 * i + 6], a[8 * i + 7]], 3 * i);
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
      g.setIndex(cut.idx);
    }
    g.computeBoundingSphere();
    return g;
  }
}

type MaterialName = 'rock' | 'concrete' | 'floor' | 'bed' | 'rail' | 'conductor' | 'cover' | 'lamp' | 'platform' | 'yellow' | 'ground' | 'steel' | 'buffer';

function materials() {
  const rock = T.tunnelRock(), concrete = T.concrete(9, 168), bed = T.trackBed(), platform = T.floorTiles();
  return {
    rock: new THREE.MeshStandardMaterial({ map: rock, roughness: 1, side: THREE.DoubleSide }),
    concrete: new THREE.MeshStandardMaterial({ map: concrete, color: 0xa8a49e, roughness: 0.9, side: THREE.DoubleSide }),
    floor: new THREE.MeshStandardMaterial({ map: concrete, color: 0x6a6660, roughness: 1, side: THREE.DoubleSide }),
    bed: new THREE.MeshStandardMaterial({ map: bed, roughness: 1 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x8d9399, roughness: 0.3, metalness: 0.9 }),
    conductor: new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 0.5, metalness: 0.6 }),
    cover: new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9, side: THREE.DoubleSide }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff3d6 }),
    platform: new THREE.MeshStandardMaterial({ map: platform, color: 0xb9b4ab, roughness: 0.7 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x55603f, roughness: 1, side: THREE.DoubleSide }),
    steel: new THREE.MeshStandardMaterial({ color: 0x5d6670, roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide }),
    buffer: new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.6 }),
  } satisfies Record<MaterialName, THREE.Material>;
}

export class Network {
  group = new THREE.Group();
  // the platforms, which can be walked on
  floors = new SurfaceIndex<PlatformFloorData>(4);
  private tiles = new Map<string, Tile>();
  // every point of the track, by POINT_CELL square, for what kind of structure is where
  private points = new Map<string, { x: number; y: number; z: number; kind: StructureKind }[]>();
  private floorData = new Map<string, PlatformFloorData>();
  private mats = materials();
  private signs = new Map<string, THREE.MeshBasicMaterial>();
  private stations: TrackGraph['stations'];

  // The stations' shafts and passages are cut out of the tunnels, platforms and everything else
  // drawn (`holes`), and out of the platforms' floors, as are the solid undersides of their stairs
  // (`solids`).
  private holes: Volume[];
  private solids: Volume[];
  // Where a track no service runs on leaves a service's tunnel, each one's space is cut out of the
  // other's walls and roof, so that the one opens into the other.
  private shellCuts: Volume[] = [];
  private samples: Sample[][] = [];
  // With the city's ground (src/city.ts) around the track, the network draws no ground of its own:
  // banks run on down into the city's ground, and the city's ground is shaped round cuttings.
  private city: boolean;

  constructor(graph: TrackGraph, geometry: TrackGeometry, exclude: Exclusion[] = [], { holes = [] as Volume[], solids = [] as Volume[], city = false } = {}) {
    this.group.name = 'network';
    this.holes = holes;
    this.solids = solids;
    this.city = city;
    // where the pieces end, and whether in a tunnel: a tunnel piece meeting one in the open has
    // its mouth there
    const tunnelKind = (k: number) => STRUCTURE_KINDS[k] === 'rock' || STRUCTURE_KINDS[k] === 'box';
    const endKey = (x: number, z: number) => `${Math.round(x)},${Math.round(z)}`;
    const ends = new Map<string, boolean[]>();
    for (const piece of Object.values(geometry.pieces)) {
      for (const k of [0, piece.x.length - 1]) {
        const key = endKey(piece.x[k], piece.z[k]);
        (ends.get(key) ?? ends.set(key, []).get(key)!).push(tunnelKind(piece.kind[k]));
      }
    }
    const mouthAt = (piece: GeometryPiece, k: number) => tunnelKind(piece.kind[k]) && ends.get(endKey(piece.x[k], piece.z[k]))!.some((t) => !t);
    const deadEnd = (piece: GeometryPiece, k: number) => ends.get(endKey(piece.x[k], piece.z[k]))!.length === 1;
    this.stations = graph.stations;
    // the direction each piece is run in, where it is only run one way
    const dirs = new Map<number, Set<number>>();
    for (const r of graph.routes) for (const st of r.path) (dirs.get(st.piece) ?? dirs.set(st.piece, new Set()).get(st.piece)!).add(st.dir);
    for (const [id, piece] of Object.entries(geometry.pieces)) {
      const d = dirs.get(Number(id));
      const samples = densify(piece, d?.size === 1 ? [...d][0] : 0, exclude.filter((e) => e.piece === Number(id)), !d);
      if (samples.length) {
        samples[0].mouth = mouthAt(piece, 0);
        samples[samples.length - 1].mouth = mouthAt(piece, piece.x.length - 1);
        samples[0].deadEnd = deadEnd(piece, 0);
        samples[samples.length - 1].deadEnd = deadEnd(piece, piece.x.length - 1);
      }
      this.samples.push(samples);
      this.addRuns(samples);
      this.addFloors(samples);
      piece.x.forEach((x, i) => {
        const key = `${Math.floor(x / POINT_CELL)},${Math.floor(piece.z[i] / POINT_CELL)}`;
        (this.points.get(key) ?? this.points.set(key, []).get(key)!).push({ x, y: piece.y[i], z: piece.z[i], kind: STRUCTURE_KINDS[piece.kind[i]] });
      });
    }
    this.junctionCuts();
  }

  // Where a tunnel of track no service runs on meets a service's tunnel (each has the other within
  // JUNCTION_REACH beside it), each one's inside, a short length at a time, is cut out of the
  // other's walls and roof.
  private junctionCuts() {
    const JUNCTION_REACH = 7;
    const tunnel = (sm: Sample) => (sm.kind === 'rock' || sm.kind === 'box') && !bare(sm);
    // where the other one's tunnel reaches into this one's (taking it to be no wider than a
    // single-track tunnel on that side)
    const meets = (sm: Sample) => {
      const span = structureSpan(sm);
      return ([[-1, sm.left], [1, sm.right]] as const).some(([side, v]) => v !== 0 && Math.abs(v) < JUNCTION_REACH && (sm.yard ? v < 0 : v > 0)
        && !widened(sm, side) && Math.abs(v) < (side < 0 ? -span[0] : span[1]) + S.ROCK.singleFar + 0.3);
    };
    const section = (sm: Sample) => {
      const o = closedOutline(sm);
      // every third corner, and the last: still inside the outline
      const pick = o.filter((_, i) => i % 3 === 0 || i === o.length - 1);
      return pick.map(([u, v]) => { const p = at(sm, u, v); return [p.x, p.y, p.z] as [number, number, number]; });
    };
    for (const samples of this.samples) {
      for (let i = 0; i + 1 < samples.length; i++) {
        const a = samples[i], c = samples[i + 1];
        if (!tunnel(a) || !tunnel(c) || a.skip || c.skip || (!meets(a) && !meets(c)) || c.along - a.along < 0.05) continue;
        const sa = section(a), sc = section(c);
        if (sa.length === sc.length) this.shellCuts.push(loft(sa, sc));
      }
    }
  }

  // The platforms' tops, from the edge to the back, where the station models don't draw them.
  private addFloors(samples: Sample[]) {
    const corner = (sm: Sample, u: number) => at(sm, u, S.PLATFORM_HEIGHT, new THREE.Vector3());
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i], p = a.plat;
      if (!p || b.plat !== p || a.skip || b.skip || b.along - a.along < 0.01) continue;
      let data = this.floorData.get(p.station);
      if (!data) this.floorData.set(p.station, data = { kind: 'platform', rec: { label: `${p.station} · platform` }, station: p.station });
      const ea = corner(a, p.side * S.PLATFORM_EDGE), oa = corner(a, platformOuter(a));
      const eb = corner(b, p.side * S.PLATFORM_EDGE), ob = corner(b, platformOuter(b));
      for (const tri of [[ea, oa, ob], [ea, ob, eb]]) {
        for (const piece of subtractAll(tri.map((v) => [v.x, v.y, v.z]), [...this.holes, ...this.solids])) {
          for (let k = 1; k + 1 < piece.length; k++) {
            this.floors.add(new THREE.Vector3(...piece[0]), new THREE.Vector3(...piece[k]), new THREE.Vector3(...piece[k + 1]), data);
          }
        }
      }
    }
  }

  // Whether someone standing at (x, y, z) on or beside the track is out in the open (1) or in a
  // tunnel (0); null away from the track.
  outdoorsAt(x: number, y: number, z: number) {
    let best: StructureKind | null = null, bestD = 12;
    const ci = Math.floor(x / POINT_CELL), cj = Math.floor(z / POINT_CELL);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      for (const p of this.points.get(`${i},${j}`) ?? []) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bestD && Math.abs(p.y + 1 - y) < 4) { bestD = d; best = p.kind; }
      }
    }
    return best === null ? null : best === 'rock' || best === 'box' ? 0 : 1;
  }

  // Cuts a piece's samples into runs, one per tile it passes through, leaving out the excluded
  // samples. A run ends on the first sample of the next one, so there is no gap between them.
  private addRuns(samples: Sample[]) {
    let start = -1, key = '';
    const flush = (end: number) => {
      if (start >= 0 && end > start) {
        const tile = this.tile(key);
        tile.runs.push({ samples, i0: start, i1: end });
      }
    };
    for (let i = 0; i < samples.length; i++) {
      const sm = samples[i];
      if (sm.skip) { flush(i - 1); start = -1; continue; }
      const k = `${Math.floor(sm.x / TILE)},${Math.floor(sm.z / TILE)}`;
      if (start < 0) { start = i; key = k; continue; }
      if (k !== key) { flush(i); start = i; key = k; }
    }
    flush(samples.length - 1);
  }

  private tile(key: string) {
    let t = this.tiles.get(key);
    if (!t) {
      const [i, j] = key.split(',').map(Number);
      t = { key, cx: (i + 0.5) * TILE, cz: (j + 0.5) * TILE, runs: [], group: null };
      this.tiles.set(key, t);
    }
    return t;
  }

  // Builds the tiles near `pos` (a few per call, nearest first) and drops those far away.
  update(pos: THREE.Vector3) {
    const want: { t: Tile; d: number }[] = [];
    for (const t of this.tiles.values()) {
      const d = Math.hypot(t.cx - pos.x, t.cz - pos.z);
      if (t.group && d > UNLOAD) {
        this.group.remove(t.group);
        t.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
        t.group = null;
      } else if (!t.group && d < LOAD + TILE * 0.71) want.push({ t, d });
    }
    want.sort((a, b) => a.d - b.d);
    for (const { t } of want.slice(0, BUILD_PER_UPDATE)) {
      t.group = this.buildTile(t);
      this.group.add(t.group);
    }
  }

  get loaded() { return [...this.tiles.values()].filter((t) => t.group).length; }

  // The station nearest to (x, z), and how far it is.
  nearestStation(x: number, z: number) {
    let best: { name: string; d: number } | null = null;
    for (const st of this.stations) {
      const d = Math.hypot(st.x - x, st.z - z);
      if (!best || d < best.d) best = { name: st.name, d };
    }
    return best;
  }

  private buildTile(tile: Tile) {
    const b = Object.fromEntries(Object.keys(this.mats).map((k) => [k, new MeshBuilder()])) as Record<MaterialName, MeshBuilder>;
    const group = new THREE.Group();
    group.name = `tile ${tile.key}`;
    for (const run of tile.runs) this.buildRun(run, b, group);
    // the holes reaching into the tile (its runs reach a little beyond it)
    const m = 60, x0 = tile.cx - TILE / 2 - m, x1 = tile.cx + TILE / 2 + m, z0 = tile.cz - TILE / 2 - m, z1 = tile.cz + TILE / 2 + m;
    const near = (h: Volume) => h.max[0] > x0 && h.min[0] < x1 && h.max[2] > z0 && h.min[2] < z1;
    const holes = this.holes.filter(near), shellHoles = [...holes, ...this.shellCuts.filter(near)];
    for (const [name, builder] of Object.entries(b) as [MaterialName, MeshBuilder][]) {
      if (!builder.empty) group.add(new THREE.Mesh(builder.build(name === 'rock' || name === 'concrete' ? shellHoles : holes), this.mats[name]));
    }
    return group;
  }

  private buildRun({ samples, i0, i1 }: Run, b: Record<MaterialName, MeshBuilder>, group: THREE.Group) {
    const run = samples.slice(i0, i1 + 1);
    // the track itself
    // (track no service runs on a little lower, where its ballast meets another track's at a turnout)
    sweep(b.bed, run, (sm) => {
      if (sm.noTrack) return null;
      const d = sm.yard ? -0.015 : 0;
      return { key: 'bed', pts: [[-S.BALLAST.toe, S.FLOOR + d], [-S.BALLAST.halfWidth, S.BALLAST.top + d], [S.BALLAST.halfWidth, S.BALLAST.top + d], [S.BALLAST.toe, S.FLOOR + d]] };
    },
      { u: (u) => (u + S.BALLAST.halfWidth) / (2 * S.BALLAST.halfWidth), vScale: 1 / (4 * S.SLEEPER.spacing) });
    for (const side of [-1, 1]) {
      const g = side * (S.GAUGE / 2 + S.RAIL.head / 2), w = S.RAIL.head / 2;
      sweep(b.rail, run, (sm) => (sm.noTrack ? null : { key: 'rail', pts: [[g - w, -S.RAIL.height], [g - w, 0], [g + w, 0], [g + w, -S.RAIL.height]] }));
    }
    const C = S.THIRD_RAIL;
    sweep(b.conductor, run, (sm) => {
      if (sm.noTrack || conductorGap(sm)) return null;
      const u = sm.third * C.offset, w = C.width / 2;
      return { key: `c${sm.third}`, pts: [[u - w, C.top - C.height], [u - w, C.top], [u + w, C.top], [u + w, C.top - C.height]] };
    });
    sweep(b.cover, run, (sm) => {
      if (sm.noTrack || conductorGap(sm)) return null;
      const u0 = sm.third * (C.offset - 0.12), u1 = sm.third * (C.offset - 0.12 + C.coverWidth), v = C.top + C.coverAbove;
      return { key: `c${sm.third}`, pts: [[u0, v], [u1, v], [u1, v - 0.25]] };
    });

    // the structure around it
    sweep(b.rock, run, (sm) => (sm.kind === 'rock' ? shellOutline(sm) : null), { uScale: 0.25, vScale: 0.25 });
    sweep(b.concrete, run, (sm) => (sm.kind === 'box' ? shellOutline(sm) : null), { uScale: 0.25, vScale: 0.25 });
    // floor beside the ballast; on a bank, only between two tracks (the bank has its own)
    for (const side of [-1, 1]) {
      sweep(b.floor, run, (sm) => {
        const bank = sm.kind === 'grade' || sm.kind === 'embankment';
        if (bank && !continues(sm, side)) return null;
        const [a, c] = ownSpan(sm, structureSpan(sm));
        const edge = side < 0 ? a : c;
        if (edge * side <= S.BALLAST.toe) return null;
        const f = S.FLOOR - (sm.yard ? 0.015 : 0);
        return { key: 'floor', pts: side < 0 ? [[a, f], [-S.BALLAST.toe, f]] : [[S.BALLAST.toe, f], [c, f]] };
      }, { uScale: 0.25, vScale: 0.25 });
    }
    this.openStructure(run, b);
    this.platforms(run, b, group);
    this.lights(run, b);
    this.ends(samples, i0, i1, b);
  }

  // Cuttings, banks, bridges and the ground beside open track.
  private openStructure(run: Sample[], b: Record<MaterialName, MeshBuilder>) {
    const groundV = (sm: Sample) => (sm.ground === null ? S.FLOOR - 0.4 : sm.ground - sm.y);
    for (const side of [-1, 1] as const) {
      // is this the outer side of the track (not towards the other track it shares with)?
      const outer = (sm: Sample) => !continues(sm, side);
      // formation and bank slope, then the ground
      sweep(b.ground, run, (sm) => {
        if ((sm.kind !== 'grade' && sm.kind !== 'embankment') || !outer(sm)) return null;
        const e = side * S.EMBANKMENT.formation, g = groundV(sm);
        if (this.city) {
          // the formation; where the ground is lower, the bank's slope down into it (the city's
          // ground rises from the formation where it is higher)
          if (g >= S.FLOOR - 0.05) return { key: 'form', pts: side < 0 ? [[e, S.FLOOR], [-S.BALLAST.toe, S.FLOOR]] : [[S.BALLAST.toe, S.FLOOR], [e, S.FLOOR]] };
          const foot = e + side * (S.FLOOR - g + SKIRT) * S.EMBANKMENT.slope;
          return { key: 'bank', pts: side < 0
            ? [[foot, g - SKIRT], [e, S.FLOOR], [-S.BALLAST.toe, S.FLOOR]]
            : [[S.BALLAST.toe, S.FLOOR], [e, S.FLOOR], [foot, g - SKIRT]] };
        }
        const toe = e + side * Math.abs(S.FLOOR - g) * S.EMBANKMENT.slope;
        return { key: 'bank', pts: side < 0
          ? [[side * GROUND_STRIP + toe - e, g], [toe, g], [e, S.FLOOR], [-S.BALLAST.toe, S.FLOOR]]
          : [[S.BALLAST.toe, S.FLOOR], [e, S.FLOOR], [toe, g], [side * GROUND_STRIP + toe - e, g]] };
      }, { uScale: 0.3, vScale: 0.3 });
      // retaining walls of a cutting, and the ground behind them
      sweep(b.concrete, run, (sm) => {
        if (sm.kind !== 'cutting' || !outer(sm)) return null;
        const u = side * S.CUTTING.wall, t = side * S.CUTTING.thickness, top = Math.max(1, groundV(sm) + S.CUTTING.aboveGround);
        // with the city, its ground falls away behind the wall: the wall's back goes down to it
        return { key: 'cut', pts: [[u, S.FLOOR], [u, top], [u + t, top], [u + t, this.city ? S.FLOOR - 0.5 : groundV(sm)]] };
      }, { uScale: 0.25, vScale: 0.25 });
      sweep(b.ground, run, (sm) => {
        if (sm.kind !== 'cutting' || !outer(sm) || this.city) return null;
        const u = side * (S.CUTTING.wall + S.CUTTING.thickness), g = groundV(sm);
        return { key: 'cg', pts: side < 0 ? [[side * GROUND_STRIP, g], [u, g]] : [[u, g], [side * GROUND_STRIP, g]] };
      }, { uScale: 0.3, vScale: 0.3 });
      // bridge deck edge girder and its railing
      sweep(b.concrete, run, (sm) => {
        if (sm.kind !== 'bridge' || !outer(sm)) return null;
        const u = side * S.BRIDGE.deck, bottom = S.FLOOR - S.BRIDGE.depth;
        const inner = sm.pair ? sm.pair / 2 : 0;
        return { key: 'deck', pts: [[u, S.FLOOR], [u, S.FLOOR + 0.3], [u + side * 0.25, S.FLOOR + 0.3], [u + side * 0.25, bottom], [inner, bottom]] };
      }, { uScale: 0.25, vScale: 0.25 });
      sweep(b.steel, run, (sm) => {
        if (sm.kind !== 'bridge' || !outer(sm)) return null;
        const u = side * (S.BRIDGE.deck + 0.12), top = S.FLOOR + S.BRIDGE.railing;
        return { key: 'rail', pts: [[u, top - 0.08], [u, top], [u + side * 0.06, top]] };
      });
    }
    // bridge piers, every 20 m or so, down to the ground
    let last = -Infinity;
    for (const sm of run) {
      if (sm.kind !== 'bridge' || sm.ground === null || sm.along - last < 20) continue;
      last = sm.along;
      const bottom = sm.y + S.FLOOR - S.BRIDGE.depth;
      if (sm.ground > bottom - 0.5) continue;
      const [a, c] = sm.pair ? ownSpan(sm, [-S.BRIDGE.deck, S.BRIDGE.deck]) : [-S.BRIDGE.deck, S.BRIDGE.deck];
      const w = (c - a) * 0.8, mid = (a + c) / 2;
      // into the city's ground, which may lie a little lower than the line's
      const foot = sm.ground - (this.city ? 3 : 0);
      box(b.concrete, at(sm, mid, 0).setY((bottom + foot) / 2), sm, w, bottom - foot, 1.4);
    }
  }

  private platforms(run: Sample[], b: Record<MaterialName, MeshBuilder>, group: THREE.Group) {
    const H = S.PLATFORM_HEIGHT;
    sweep(b.platform, run, (sm) => {
      const p = sm.plat;
      if (!p) return null;
      const e = p.side * S.PLATFORM_EDGE, o = platformOuter(sm);
      return { key: `p${p.side}`, pts: p.side > 0 ? [[e, S.FLOOR], [e, H], [o, H], [o, S.FLOOR]] : [[o, S.FLOOR], [o, H], [e, H], [e, S.FLOOR]] };
    }, { uScale: 0.5, vScale: 0.5 });
    sweep(b.yellow, run, (sm) => {
      const p = sm.plat;
      if (!p) return null;
      const u0 = p.side * (S.PLATFORM_EDGE + 0.3), u1 = p.side * (S.PLATFORM_EDGE + 0.42);
      return { key: `y${p.side}`, pts: p.side > 0 ? [[u0, H + 0.004], [u1, H + 0.004]] : [[u1, H + 0.004], [u0, H + 0.004]] };
    });
    // station name signs on the wall across the track, and lights over the platform edge
    let lastSign = -Infinity;
    for (const sm of run) {
      const p = sm.plat;
      if (!p) continue;
      if (sm.along - lastSign >= 30) {
        lastSign = sm.along;
        const span = structureSpan(sm);
        const wall = p.side > 0 ? span[0] : span[1];
        if (sm.kind === 'rock' || sm.kind === 'box') {
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.68), this.signMaterial(p.station));
          sign.position.copy(at(sm, wall + p.side * 0.06, 2.4));
          sign.lookAt(at(sm, wall + p.side * 1.06, 2.4));
          group.add(sign);
        }
      }
      if (Math.round(sm.along / STEP) % 2 === 0) {
        box(b.lamp, at(sm, p.side * (S.PLATFORM_EDGE + 1.2), H + 2.6), sm, 0.12, 0.06, 2.2);
      }
    }
  }

  private signMaterial(station: string) {
    let m = this.signs.get(station);
    if (!m) { m = new THREE.MeshBasicMaterial({ map: T.nameSign(station) }); this.signs.set(station, m); }
    return m;
  }

  // Lamps on the tunnel walls: on the outer wall of each track of a double-track tunnel every
  // 20 m, so every 10 m on alternate walls; every 7 m on one wall of a single-track tunnel.
  private lights(run: Sample[], b: Record<MaterialName, MeshBuilder>) {
    let next = -Infinity;
    for (const sm of run) {
      if ((sm.kind !== 'rock' && sm.kind !== 'box') || sm.plat || sm.along < next || bare(sm)) continue;
      if (inHall(sm)) {
        // a row of lamps under a depot hall's roof, over each track
        next = sm.along + S.DEPOT_HALL.lights;
        box(b.lamp, at(sm, 0, S.DEPOT_HALL.height - 0.05), sm, 0.3, 0.08, 1.4);
        continue;
      }
      const single = !sm.pair;
      next = sm.along + (single ? S.TUNNEL_LIGHT.single : 2 * S.TUNNEL_LIGHT.double);
      const span = structureSpan(sm);
      // the refuge side of a single-track tunnel; the outer wall of a double-track one
      const side = single ? -sm.third : -Math.sign(sm.pair);
      const wall = side > 0 ? span[1] : span[0];
      box(b.lamp, at(sm, wall - side * 0.08, S.TUNNEL_LIGHT.height + (sm.pairDy || 0) / 2), sm, 0.1, 0.14, 1.2);
    }
  }

  // Where a tunnel opens into the open air or into a station the model draws, a concrete portal
  // around the mouth. Where its outline
  // changes at once (one kind of tunnel meets another, the line runs into a station hall, or a
  // single-track tunnel joins the other track's), a wall between the two outlines.
  private ends(samples: Sample[], i0: number, i1: number, b: Record<MaterialName, MeshBuilder>) {
    const tunnel = (sm: Sample) => (sm.kind === 'rock' || sm.kind === 'box') && !bare(sm);
    const ring = (sm: Sample, inner: [number, number][], outer: [number, number][]) => {
      const first = b.concrete.pos.length / 3;
      for (const outline of [inner, outer]) for (const [u, v] of outline) { at(sm, u, v, _w); b.concrete.vertex(_w.x, _w.y, _w.z, u * 0.25, v * 0.25); }
      b.concrete.grid(2, inner.length, first);
    };
    const portal = (t: Sample) => {
      const shell = shellOutline(t);
      if (!shell) return;
      const inner = shell.pts;
      const [sa, sb] = structureSpan(t), mid = (sa + sb) / 2;
      const crown = Math.max(...inner.map((p) => p[1]));
      const top = Math.max(crown + 2, t.ground === null ? 0 : t.ground - t.y + 0.5);
      // a headwall: the opening's outline carried out from its middle to a rectangle 3 m beyond
      // its walls and up to the ground (where two tracks share the tunnel, each draws its half)
      const x0 = sa - 3, x1 = sb + 3, y0 = S.FLOOR, oy = 1.5;
      ring(t, inner, inner.map(([u, v]) => {
        const du = u - mid, dv = v - oy;
        let k = Infinity;
        if (du > 1e-6) k = Math.min(k, (x1 - mid) / du);
        if (du < -1e-6) k = Math.min(k, (x0 - mid) / du);
        if (dv > 1e-6) k = Math.min(k, (top - oy) / dv);
        if (dv < -1e-6) k = Math.min(k, (y0 - oy) / dv);
        return k === Infinity ? [u, v] : [mid + du * k, oy + dv * k];
      }));
    };
    // the end of a track that goes no further: a buffer stop, and in a tunnel a wall beyond it
    const deadEnd = (k: number, inward: 1 | -1) => {
      const end = samples[k];
      if (end.skip) return;
      if (tunnel(end)) {
        const o = closedOutline(end), c = o.reduce((m, [u, v]) => [m[0] + u / o.length, m[1] + v / o.length], [0, 0]);
        for (let j = 0; j < o.length; j++) {
          const p = o[j], q = o[(j + 1) % o.length];
          b.concrete.quad(at(end, c[0], c[1]), at(end, p[0], p[1]), at(end, q[0], q[1]), at(end, c[0], c[1]));
        }
      }
      let j = k;
      while (j + inward >= 0 && j + inward < samples.length && Math.abs(samples[j].along - end.along) < S.BUFFER.from) j += inward;
      const sm = samples[j];
      box(b.buffer, at(sm, 0, S.BUFFER.height), sm, S.BUFFER.width, 0.35, 0.3);
      for (const u of [-0.75, 0.75]) box(b.steel, at(sm, u, (S.BUFFER.height + S.BALLAST.top) / 2), sm, 0.2, S.BUFFER.height - S.BALLAST.top, 0.6);
    };
    if (i0 === 0 && samples[0].deadEnd) deadEnd(0, 1);
    if (i1 === samples.length - 1 && samples[i1].deadEnd) deadEnd(i1, -1);
    // a tunnel running into a station the model draws, or out into the open at the piece's end
    if (i0 > 0 && samples[i0 - 1].skip && tunnel(samples[i0])) portal(samples[i0]);
    if (i0 === 0 && samples[0].mouth) portal(samples[0]);
    if (i1 === samples.length - 1 && samples[i1].mouth) portal(samples[i1]);
    if (i1 + 1 < samples.length && samples[i1 + 1].skip && tunnel(samples[i1])) portal(samples[i1]);
    for (let i = i0 + 1; i <= i1; i++) {
      const p = samples[i - 1], q = samples[i];
      if (q.along - p.along > 0.05) continue;
      if (tunnel(p) && tunnel(q)) {
        const a = closedOutline(p), c = closedOutline(q);
        if (a.length !== c.length || a.some(([u, v], j) => Math.hypot(u - c[j][0], v - c[j][1]) > 0.05)) {
          const [ra, rc] = rays(a, c);
          ring(p, ra, rc);
        }
      } else if (tunnel(p) !== tunnel(q) && !bare(p) && !bare(q)) portal(tunnel(p) ? p : q);
    }
  }
}

// ------------------------------------------------------------------ cross-sections
// The structure's full inner span at a sample, from wall to wall (or edge to edge), lateral from
// the track's centre.
function structureSpan(sm: Sample, widen = true): [number, number] {
  let a: number, b: number;
  if (sm.kind === 'bridge') [a, b] = [-S.BRIDGE.deck, S.BRIDGE.deck];
  else if (sm.kind === 'cutting') [a, b] = [-S.CUTTING.wall, S.CUTTING.wall];
  else if (sm.kind === 'grade' || sm.kind === 'embankment') [a, b] = [-S.EMBANKMENT.formation, S.EMBANKMENT.formation];
  else if (sm.pair) [a, b] = [-S.ROCK.doubleWall, S.ROCK.doubleWall];
  else [a, b] = sm.third < 0 ? [-S.ROCK.singleNear, S.ROCK.singleFar] : [-S.ROCK.singleFar, S.ROCK.singleNear];
  if (sm.pair > 0) b += sm.pair; else if (sm.pair < 0) a += sm.pair;
  // a service's tunnel round a turnout
  if (widen) {
    const wl = widened(sm, -1), wr = widened(sm, 1);
    if (wl) a = Math.min(a, -wl - S.ROCK.singleFar);
    if (wr) b = Math.max(b, wr + S.ROCK.singleFar);
  }
  // track no service runs on: to the middle between it and the track it shares with
  const l = shares(sm, -1), r = shares(sm, 1);
  if (l) a = -l / 2 - OVERLAP;
  if (r) b = r / 2 + OVERLAP;
  // a hall wide enough for a platform beside the track
  const p = sm.plat;
  if (p && (sm.kind === 'rock' || sm.kind === 'box') && !(p.island && sm.pair)) {
    const o = p.side * (S.PLATFORM_EDGE + p.width + S.HALL.behindPlatform);
    if (p.side > 0) b = Math.max(b, o); else a = Math.min(a, o);
  }
  return [a, b];
}

// The part of a span this track draws: where it shares the structure, its own side of the middle
// (and a little over).
function ownSpan(sm: Sample, [a, b]: [number, number]): [number, number] {
  if (!sm.pair) return [a, b];
  const mid = sm.pair / 2;
  return sm.pair > 0 ? [a, mid + OVERLAP] : [mid - OVERLAP, b];
}

// Track no service runs on shares its structure with the track beside it: a depot's tracks in rock
// or concrete share a flat-roofed hall with each other, and in the open the formation or deck of
// any track beside them. How far that track is on the given side (-1 left, +1 right), or 0.
const HALL_REACH = 10, OPEN_REACH = 12;
function shares(sm: Sample, side: number) {
  if (!sm.yard) return 0;
  const v = side < 0 ? sm.left : sm.right;
  if (!v) return 0;
  if (sm.kind === 'rock' || sm.kind === 'box') return v > 0 && v < HALL_REACH ? v : 0;
  return Math.abs(v) < OPEN_REACH ? Math.abs(v) : 0;
}
// whether the structure goes on beyond this track on that side, into the other track's part
const continues = (sm: Sample, side: number) => (sm.yard ? shares(sm, side) > 0 : !!sm.pair && Math.sign(sm.pair) === side);
// a depot hall: in rock or concrete, beside another of the depot's tracks
const inHall = (sm: Sample) => sm.yard && (sm.kind === 'rock' || sm.kind === 'box') && (shares(sm, -1) > 0 || shares(sm, 1) > 0);
// A turnout in a tunnel: where track no service runs on comes within WIDEN of a service's track,
// the service's tunnel is widened to take it in (`widened`: how far, beyond the other track's
// centre), and the other track has no tunnel of its own there (`bare`).
const WIDEN = 4.5;
const bare = (sm: Sample) => sm.yard && (sm.kind === 'rock' || sm.kind === 'box')
  && ((sm.left < 0 && -sm.left < WIDEN) || (sm.right < 0 && -sm.right < WIDEN));
const widened = (sm: Sample, side: number) => {
  const v = side < 0 ? sm.left : sm.right;
  return !sm.yard && (sm.kind === 'rock' || sm.kind === 'box') && v > 0 && v < WIDEN ? v : 0;
};
// No conductor rail where another track comes closer than the standard spacing on its side: at
// turnouts (a service's track gives way only to track no service runs on).
function conductorGap(sm: Sample) {
  const v = sm.third > 0 ? sm.right : sm.left;
  return (sm.yard || v > 0) && v !== 0 && Math.abs(v) < S.TRACK_CENTRES - 0.25;
}

function platformOuter(sm: Sample) {
  const p = sm.plat!;
  if (p.island && sm.pair && Math.sign(sm.pair) === p.side) return sm.pair / 2 + p.side * OVERLAP;
  return p.side * (S.PLATFORM_EDGE + p.width);
}

// The inside of a tunnel: from the floor at one wall, up the wall, over the roof and down to the
// floor at the other, resampled to SHELL_POINTS points; where two tracks share it, only this
// track's half.
function shellOutline(sm: Sample): { key: string; pts: [number, number][] } | null {
  if ((sm.kind !== 'rock' && sm.kind !== 'box') || bare(sm)) return null;
  const [a, b] = structureSpan(sm);
  if (inHall(sm)) {
    // a depot hall: walls where no track is beside, a flat roof with haunched corners
    const H = S.DEPOT_HALL.height, k = S.DEPOT_HALL.haunch, l = shares(sm, -1) > 0, r = shares(sm, 1) > 0;
    const pts: [number, number][] = [...(l ? [[a, H]] : [[a, S.FLOOR], [a, H - k], [a + k, H]]),
      ...(r ? [[b, H]] : [[b - k, H], [b, H - k], [b, S.FLOOR]])] as [number, number][];
    return { key: `hall${sm.kind}${+l}${+r}`, pts };
  }
  if (sm.kind === 'rock' && (widened(sm, -1) || widened(sm, 1))) {
    // a turnout in rock: a flat roof at the crown's height, haunched at the walls (where two
    // tracks share the tunnel, this track's half, meeting the other half's arch at its crown)
    const [a0, b0] = structureSpan(sm, false);
    const H = sm.pair ? S.ROCK.doubleSpring + ((S.ROCK.doubleCrown - S.ROCK.doubleSpring) * (b0 - a0)) / (2 * S.ROCK.doubleWall + S.TRACK_CENTRES) + sm.pairDy / 2
      : S.ROCK.singleCrown;
    const k = S.DEPOT_HALL.haunch, mid = sm.pair / 2;
    const left: [number, number][] = [[a, S.FLOOR], [a, H - k], [a + k, H]], right: [number, number][] = [[b - k, H], [b, H - k], [b, S.FLOOR]];
    const pts = sm.pair > 0 ? [...left, [mid + OVERLAP, H] as [number, number]] : sm.pair < 0 ? [[mid - OVERLAP, H] as [number, number], ...right] : [...left, ...right];
    return { key: `turnout${Math.sign(sm.pair)}`, pts };
  }
  const width = b - a;
  const full: [number, number][] = [[a, S.FLOOR]];
  if (sm.kind === 'box') {
    const h = S.BOX.height, k = S.BOX.haunch;
    full.push([a, h - k], [a + k, h], [b - k, h], [b, h - k]);
  } else {
    let spring: number, rise: number;
    if (sm.plat) { spring = S.HALL.spring; rise = width * S.HALL.risePerWidth; }
    else if (sm.pair) {
      spring = S.ROCK.doubleSpring;
      rise = ((S.ROCK.doubleCrown - S.ROCK.doubleSpring) * width) / (2 * S.ROCK.doubleWall + S.TRACK_CENTRES);
    } else { spring = S.ROCK.singleSpring; rise = S.ROCK.singleCrown - S.ROCK.singleSpring; }
    full.push([a, spring]);
    const n = 16;
    for (let i = 1; i < n; i++) {
      const u = a + (width * i) / n;
      full.push([u, S.archHeight(a, b, spring, rise, u)]);
    }
    full.push([b, spring]);
  }
  full.push([b, S.FLOOR]);
  // the part to draw, as distances along the outline
  const cum = [0];
  for (let i = 1; i < full.length; i++) cum.push(cum[i - 1] + Math.hypot(full[i][0] - full[i - 1][0], full[i][1] - full[i - 1][1]));
  const total = cum[cum.length - 1];
  let t0 = 0, t1 = total;
  if (sm.pair) {
    const [o0, o1] = ownSpan(sm, [a, b]);
    // where the roof passes over the cut
    const cut = sm.pair > 0 ? o1 : o0;
    let tc = total / 2;
    for (let i = 1; i < full.length; i++) {
      const [u0] = full[i - 1], [u1] = full[i];
      if ((u0 - cut) * (u1 - cut) <= 0 && u1 !== u0 && full[i][1] > 1) { tc = cum[i - 1] + ((cut - u0) / (u1 - u0)) * (cum[i] - cum[i - 1]); break; }
    }
    if (sm.pair > 0) t1 = tc; else t0 = tc;
  }
  const pts: [number, number][] = [];
  const dy = sm.pair ? sm.pairDy / 2 : 0;
  for (let j = 0; j < SHELL_POINTS; j++) {
    const t = t0 + ((t1 - t0) * j) / (SHELL_POINTS - 1);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < t) i++;
    const f = (t - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    const u = full[i - 1][0] + (full[i][0] - full[i - 1][0]) * f, v = full[i - 1][1] + (full[i][1] - full[i - 1][1]) * f;
    // the floor stays with this track's rails; the roof is shared, between the two tracks' levels
    pts.push([u, v + (v > S.FLOOR + 0.01 ? dy * Math.min(1, (v - S.FLOOR) / 2) : 0)]);
  }
  return { key: `${sm.kind}${Math.sign(sm.pair)}`, pts };
}

// A tunnel's outline as a closed line around this track: where it shares the tunnel, its half,
// closed down the middle.
function closedOutline(sm: Sample): [number, number][] {
  const o = shellOutline(sm)!.pts;
  if (inHall(sm)) {
    // closed down the middle between it and the tracks beside it
    const out = [...o];
    if (shares(sm, -1) > 0) out.unshift([o[0][0], S.FLOOR]);
    if (shares(sm, 1) > 0) out.push([o[o.length - 1][0], S.FLOOR]);
    return out;
  }
  if (!sm.pair) return o;
  return sm.pair > 0 ? [...o, [o[o.length - 1][0], S.FLOOR]] : [[o[0][0], S.FLOOR], ...o];
}

// Two outlines met by the same rays from a point over the track, from one floor over the roof to
// the other: the edges of the wall between two tunnels of different shapes.
function rays(a: [number, number][], b: [number, number][], n = 33): [[number, number][], [number, number][]] {
  const O: [number, number] = [0, 1.8];
  const angle = ([u, v]: [number, number]) => Math.atan2(v - O[1], u - O[0]);
  // from the lower left (as an angle above π) round over the top to the lower right
  const left = (p: [number, number]) => { const t = angle(p); return t < -Math.PI / 2 ? t + 2 * Math.PI : t; };
  const t0 = Math.min(left(a[0]), left(b[0])), t1 = Math.max(angle(a[a.length - 1]), angle(b[b.length - 1]));
  const hit = (poly: [number, number][], du: number, dv: number): [number, number] | null => {
    let best = Infinity;
    for (let i = 1; i < poly.length; i++) {
      const [pu, pv] = poly[i - 1], eu = poly[i][0] - pu, ev = poly[i][1] - pv;
      const den = du * ev - dv * eu;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((pu - O[0]) * ev - (pv - O[1]) * eu) / den, s = ((pu - O[0]) * dv - (pv - O[1]) * du) / den;
      if (t > 0 && s >= 0 && s <= 1 && t < best) best = t;
    }
    return best < Infinity ? [O[0] + du * best, O[1] + dv * best] : null;
  };
  const ra: [number, number][] = [], rb: [number, number][] = [];
  for (let j = 0; j < n; j++) {
    const t = t0 + ((t1 - t0) * j) / (n - 1), du = Math.cos(t), dv = Math.sin(t);
    const ha = hit(a, du, dv), hb = hit(b, du, dv);
    if (ha && hb) { ra.push(ha); rb.push(hb); }
  }
  return [ra, rb];
}

// ------------------------------------------------------------------ sweeping
const _w = new THREE.Vector3();
function at(sm: Sample, u: number, v: number, out = new THREE.Vector3()) {
  return out.set(sm.x + sm.rx * u, sm.y + v, sm.z + sm.rz * u);
}

// Sweeps a cross-section along the samples. `profile` gives each sample's section (or null for
// none); where its key or its number of points changes, the surface starts again.
function sweep(b: MeshBuilder, run: Sample[], profile: (sm: Sample) => { key: string; pts: [number, number][] } | null,
  { uScale = 1, vScale = 1, u = null as ((u: number, v: number, along: number) => number) | null } = {}) {
  let rows: { sm: Sample; pts: [number, number][] }[] = [];
  let key = '';
  const flush = () => {
    if (rows.length >= 2) {
      const cols = rows[0].pts.length, first = b.pos.length / 3;
      for (const { sm, pts } of rows) {
        let len = 0;
        pts.forEach(([pu, pv], j) => {
          if (j) len += Math.hypot(pu - pts[j - 1][0], pv - pts[j - 1][1]);
          at(sm, pu, pv, _w);
          b.vertex(_w.x, _w.y, _w.z, u ? u(pu, pv, sm.along) : len * uScale, sm.along * vScale);
        });
      }
      b.grid(rows.length, cols, first);
    }
    rows = [];
  };
  for (const sm of run) {
    const p = profile(sm);
    const k = p ? `${p.key}:${p.pts.length}` : '';
    if (k !== key) { flush(); key = k; }
    if (p) rows.push({ sm, pts: p.pts });
  }
  flush();
}

// A box at `c`, `sx` across the track, `sy` high and `sz` along it.
function box(b: MeshBuilder, c: THREE.Vector3, sm: Sample, sx: number, sy: number, sz: number) {
  const tx = sm.rz, tz = -sm.rx; // along the track
  const corner = (i: number, j: number, k: number) => new THREE.Vector3(
    c.x + sm.rx * i * sx / 2 + tx * k * sz / 2, c.y + j * sy / 2, c.z + sm.rz * i * sx / 2 + tz * k * sz / 2);
  const faces: [number, number, number][][] = [
    [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1]],
    [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]], [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]],
    [[-1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, 1]], [[1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, -1]],
  ];
  for (const f of faces) b.quad(...(f.map(([i, j, k]) => corner(i, j, k)) as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]));
}

// ------------------------------------------------------------------ samples along a piece
// The piece's points (about 10 m apart) made into a smooth line (Catmull–Rom) with a sample about
// every STEP metres. Where the structure, the sharing of it, a platform or an exclusion starts
// or stops, there are two samples at the same place, one with each, so that the surfaces on
// either side meet.
function densify(g: GeometryPiece, dir: number, exclude: Exclusion[], yard: boolean): Sample[] {
  const n = g.s.length;
  const P = (i: number, k: 'x' | 'y' | 'z') => {
    if (i < 0) return 2 * g[k][0] - g[k][1];
    if (i >= n) return 2 * g[k][n - 1] - g[k][n - 2];
    return g[k][i];
  };
  const cr = (q: number, k: 'x' | 'y' | 'z') => {
    const i = Math.min(n - 2, Math.floor(q)), t = q - i;
    const p0 = P(i - 1, k), p1 = P(i, k), p2 = P(i + 1, k), p3 = P(i + 2, k);
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  };
  const lerp = (arr: number[], q: number) => {
    const i = Math.min(n - 2, Math.floor(q)), t = q - i;
    return arr[i] + (arr[i + 1] - arr[i]) * t;
  };
  // the parameter q (point index plus fraction) at distance s along the piece
  const qAt = (s: number) => {
    let i = 0;
    while (i < n - 2 && g.s[i + 1] < s) i++;
    return i + Math.max(0, Math.min(1, (s - g.s[i]) / (g.s[i + 1] - g.s[i] || 1)));
  };
  // attributes, just after q (or just before it, with `before`)
  const attrs = (q: number, before: boolean) => {
    const e = before ? q - 1e-6 : q + 1e-6;
    const i = Math.max(0, Math.min(n - 2, Math.floor(e))), t = e - i;
    const near = t < 0.5 ? i : i + 1;
    const s = lerp(g.s, q);
    const pa = g.pair[i], pb = g.pair[i + 1];
    const pair = pa && pb ? pa + (pb - pa) * t : g.pair[near];
    const pairDy = pair ? (g.pairDy[i] && g.pairDy[i + 1] ? lerp(g.pairDy, q) : g.pairDy[near]) : 0;
    const ga = g.ground[i], gb = g.ground[i + 1];
    const ground = ga !== null && gb !== null ? ga + (gb - ga) * t : g.ground[near];
    // the tracks beside it: where both points have one, in between; otherwise the nearer point's
    const beside = (arr: number[] | undefined) => {
      if (!arr) return 0;
      const a = arr[i], b = arr[i + 1];
      return a && b && Math.sign(a) === Math.sign(b) ? a + (b - a) * t : arr[near];
    };
    const left = beside(g.left), right = beside(g.right);
    const se = lerp(g.s, e);
    const plat = g.platforms.find((p) => se >= p.s0 && se <= p.s1) ?? null;
    const third: 1 | -1 = plat ? (-plat.side as 1 | -1) : pair ? (pair > 0 ? -1 : 1) : (dir > 0 ? -1 : 1);
    const skip = exclude.some((x) => !x.trackOnly && se >= x.s0 && se <= x.s1);
    const noTrack = skip || exclude.some((x) => se >= x.s0 && se <= x.s1);
    return { s, kind: STRUCTURE_KINDS[g.kind[near]], pair, pairDy, left, right, yard, ground, plat, third, skip, noTrack };
  };
  // where something changes
  const breaks = new Set<number>();
  for (let i = 0; i + 1 < n; i++) {
    if (g.kind[i] !== g.kind[i + 1] || !g.pair[i] !== !g.pair[i + 1]) breaks.add(i + 0.5);
    // where a turnout's tunnel starts or ends
    if (g.left && g.right) {
      const k0 = { yard, kind: STRUCTURE_KINDS[g.kind[i]], left: g.left[i], right: g.right[i] } as Sample;
      const k1 = { yard, kind: STRUCTURE_KINDS[g.kind[i + 1]], left: g.left[i + 1], right: g.right[i + 1] } as Sample;
      if (bare(k0) !== bare(k1) || !widened(k0, -1) !== !widened(k1, -1) || !widened(k0, 1) !== !widened(k1, 1)) breaks.add(i + 0.5);
    }
    // where track no service runs on starts or stops sharing with a track beside it
    if (yard && g.left && g.right) {
      const k0 = { yard, kind: STRUCTURE_KINDS[g.kind[i]], left: g.left[i], right: g.right[i] } as Sample;
      const k1 = { yard, kind: STRUCTURE_KINDS[g.kind[i + 1]], left: g.left[i + 1], right: g.right[i + 1] } as Sample;
      if (!shares(k0, -1) !== !shares(k1, -1) || !shares(k0, 1) !== !shares(k1, 1)) breaks.add(i + 0.5);
    }
  }
  for (const p of g.platforms) for (const s of [p.s0, p.s1]) if (s > g.s[0] && s < g.s[n - 1]) breaks.add(qAt(s));
  for (const x of exclude) for (const s of [x.s0, x.s1]) if (s > g.s[0] && s < g.s[n - 1]) breaks.add(qAt(s));
  const qs: { q: number; twice: boolean }[] = [];
  for (let i = 0; i + 1 < n; i++) {
    const len = Math.hypot(g.x[i + 1] - g.x[i], g.z[i + 1] - g.z[i]);
    const m = Math.max(1, Math.round(len / STEP));
    for (let j = 0; j < m; j++) qs.push({ q: i + j / m, twice: false });
  }
  qs.push({ q: n - 1, twice: false });
  for (const q of breaks) qs.push({ q, twice: true });
  qs.sort((a, b) => a.q - b.q);
  const out: Sample[] = [];
  let along = 0, last: { x: number; z: number } | null = null;
  for (const { q, twice } of qs) {
    const x = cr(q, 'x'), y = cr(q, 'y'), z = cr(q, 'z');
    if (last) along += Math.hypot(x - last.x, z - last.z);
    last = { x, z };
    // the direction of the line here
    const h = 0.05, qa = Math.max(0, q - h), qb = Math.min(n - 1, q + h);
    let tx = cr(qb, 'x') - cr(qa, 'x'), tz = cr(qb, 'z') - cr(qa, 'z');
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    const base = { x, y, z, rx: -tz, rz: tx, along };
    if (twice) out.push({ ...base, ...attrs(q, true) });
    out.push({ ...base, ...attrs(q, false) });
  }
  // drop repeated places that aren't changes
  return out.filter((sm, i) => i === 0 || sm.along - out[i - 1].along > 0.05 || sm.kind !== out[i - 1].kind
    || !sm.pair !== !out[i - 1].pair || sm.plat !== out[i - 1].plat || sm.skip !== out[i - 1].skip || sm.noTrack !== out[i - 1].noTrack
    || !shares(sm, -1) !== !shares(out[i - 1], -1) || !shares(sm, 1) !== !shares(out[i - 1], 1)
    || bare(sm) !== bare(out[i - 1]) || !widened(sm, -1) !== !widened(out[i - 1], -1) || !widened(sm, 1) !== !widened(out[i - 1], 1));
}
