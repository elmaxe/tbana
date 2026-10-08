import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { runningWays } from './track-graph';
import type { TrackGraph } from './track-graph';
import { STRUCTURE_KINDS } from './track-geometry';
import type { GeometryPiece, GeometryPlatform, StructureKind, TrackGeometry } from './track-geometry';
import * as S from './sections';
import * as T from './textures';
import { SurfaceIndex } from './surface-index';
import { cutIndexed, insideVolume, loft, subtractAll } from './clip.ts';
import type { Volume } from './clip.ts';
import { CAVE_STYLES, HALL_STYLES, VAULT_STYLES } from './hall-styles';
import type { CaveStyle, FlatHall, HallStyle, VaultHall, VaultStyle } from './hall-styles';

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

type MaterialName = 'rock' | 'concrete' | 'floor' | 'bed' | 'rail' | 'conductor' | 'cover' | 'lamp' | 'platform' | 'yellow' | 'ground' | 'steel' | 'buffer'
  | 'hallWall' | 'hallWallMirror' | 'hallCeiling' | 'hallColumn' | 'hallFloor'
  | 'kpWall' | 'kpWallMirror' | 'kpFrieze' | 'kpVault' | 'kpFloor' | 'kpEdge' | 'kpBlock' | 'kpBlockTop' | 'kpBench'
  | 'vaultArt' | 'vaultArtMirror' | 'vaultWall' | 'vaultCeiling' | 'vaultFloor' | 'vaultEdge' | 'fitting'
  // a painted cave's rock, one for each station (src/hall-styles.ts)
  | `cave:${string}`;

// The styled halls' surfaces (src/hall-styles.ts): Hötorget's, Karlaplan's and Östermalmstorg's.
const HOTORGET = HALL_STYLES['Hötorget'] as FlatHall;
const KARLAPLAN = HALL_STYLES['Karlaplan'] as VaultHall;
const OSTERMALMSTORG = VAULT_STYLES['Östermalmstorg'];

function materials() {
  const rock = T.tunnelRock(), concrete = T.concrete(9, 168), bed = T.trackBed(), platform = T.floorTiles();
  const plaster = T.plaster();
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
    hallWall: new THREE.MeshStandardMaterial({ map: T.hotorgetWall(HOTORGET.soffit - S.FLOOR, HOTORGET.tilesFrom - S.FLOOR, HOTORGET.plateAt - S.FLOOR), roughness: 0.8, side: THREE.DoubleSide }),
    hallWallMirror: new THREE.MeshStandardMaterial({ map: T.hotorgetWall(HOTORGET.soffit - S.FLOOR, HOTORGET.tilesFrom - S.FLOOR, HOTORGET.plateAt - S.FLOOR, true), roughness: 0.8, side: THREE.DoubleSide }),
    // (lit from below, by the lamps and the neon, which light nothing: so it glows a little)
    hallCeiling: new THREE.MeshStandardMaterial({ map: plaster, color: 0xe6e8e6, emissive: 0x8e918f, emissiveMap: plaster, roughness: 0.9, side: THREE.DoubleSide }),
    hallColumn: new THREE.MeshStandardMaterial({ map: T.hotorgetColumn(), roughness: 0.8 }),
    hallFloor: new THREE.MeshStandardMaterial({ map: T.clinker(), roughness: 0.8 }),
    ...karlaplanMaterials(plaster),
    vaultArt: new THREE.MeshStandardMaterial({ map: T.derkertWall(S.FLOOR, OSTERMALMSTORG.spring), roughness: 0.95, side: THREE.DoubleSide }),
    vaultArtMirror: new THREE.MeshStandardMaterial({ map: T.derkertWall(S.FLOOR, OSTERMALMSTORG.spring, true), roughness: 0.95, side: THREE.DoubleSide }),
    vaultWall: new THREE.MeshStandardMaterial({ map: T.pittedWall(), roughness: 0.95, side: THREE.DoubleSide }),
    // (lit from below, by the lamps, which light nothing: so it glows a little, as the ceiling)
    vaultCeiling: new THREE.MeshStandardMaterial({ map: T.vaultPlaster(), color: 0xe8e8e5, emissive: 0x7d7e7b, emissiveMap: T.vaultPlaster(), roughness: 0.85, side: THREE.DoubleSide }),
    vaultFloor: new THREE.MeshStandardMaterial({ map: T.terrazzo(), roughness: 0.35 }),
    vaultEdge: new THREE.MeshStandardMaterial({ map: T.edgeBand(), roughness: 0.6 }),
    fitting: new THREE.MeshStandardMaterial({ color: 0xc4c6c7, roughness: 0.5, metalness: 0.3 }),
  } satisfies Partial<Record<MaterialName, THREE.Material>> as Record<MaterialName, THREE.Material>;
}

function karlaplanMaterials(plaster: THREE.Texture) {
  const K = KARLAPLAN, h = K.spring - S.FLOOR, from = K.panelsFrom - S.FLOOR, name = K.nameAt - S.FLOOR;
  const band: [number, number] | null = K.frieze ? [K.frieze.from - S.FLOOR, K.frieze.to - S.FLOOR] : null;
  // (enamel, lit by the row of lamps, which light nothing: so it glows a little, as the vault does)
  const wall = (frieze: boolean, mirror: boolean) => {
    const map = T.karlaplanWall(h, from, name, frieze ? band : null, mirror);
    return new THREE.MeshStandardMaterial({ map, emissive: 0x6c6c6a, emissiveMap: map, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide });
  };
  return {
    kpWall: wall(K.frieze?.wall === -1, false),
    kpWallMirror: wall(K.frieze?.wall === 1, true),
    kpFrieze: new THREE.MeshStandardMaterial({ map: T.karlaplanFrieze(K.frieze ? K.frieze.to - K.frieze.from : 1, K.frieze?.wall === 1), roughness: 0.4,
      polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }),
    // (lit from below by its row of lamps, which light nothing: so it glows a little)
    kpVault: new THREE.MeshStandardMaterial({ map: plaster, color: 0xe2ddd0, emissive: 0x8a867c, emissiveMap: plaster, roughness: 0.9, side: THREE.DoubleSide }),
    kpFloor: new THREE.MeshStandardMaterial({ map: T.karlaplanFloor(), roughness: 0.55 }),
    kpEdge: new THREE.MeshStandardMaterial({ map: T.karlaplanEdge(), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -1 }),
    kpBlock: new THREE.MeshStandardMaterial({ map: T.karlaplanBlock(), roughness: 0.45 }),
    kpBlockTop: new THREE.MeshStandardMaterial({ color: 0x3b3631, roughness: 0.9 }),
    kpBench: new THREE.MeshStandardMaterial({ color: 0xd9a63c, roughness: 0.55 }),
  };
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
  private posterMats: THREE.MeshStandardMaterial[] | null = null;
  private kpSigns: Map<string, THREE.MeshStandardMaterial> | undefined;
  private kpNiches: THREE.MeshStandardMaterial[] | undefined;
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
    for (const r of runningWays(graph)) for (const st of r.path) (dirs.get(st.piece) ?? dirs.set(st.piece, new Set()).get(st.piece)!).add(st.dir);
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
    }
    alignChanges(this.samples);
    for (const [k, piece] of Object.values(geometry.pieces).entries()) {
      this.addRuns(this.samples[k]);
      this.addFloors(this.samples[k]);
      piece.x.forEach((x, i) => {
        const key = `${Math.floor(x / POINT_CELL)},${Math.floor(piece.z[i] / POINT_CELL)}`;
        (this.points.get(key) ?? this.points.set(key, []).get(key)!).push({ x, y: piece.y[i], z: piece.z[i], kind: STRUCTURE_KINDS[piece.kind[i]] });
      });
    }
    this.junctionCuts();
    // the styled halls' neon, once for each, along one of its tracks
    const lit = new Set<string>();
    for (const samples of this.samples) {
      const first = samples.find((sm) => hallStyle(sm)?.kind === 'flat');
      if (!first || lit.has(first.plat!.station)) continue;
      lit.add(first.plat!.station);
      this.group.add(neon(samples.filter((sm) => sm.plat === first.plat), hallStyle(first) as FlatHall, this.holes));
    }
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
    sweep(b.rock, run, (sm) => (sm.kind === 'rock' && !hallStyle(sm) && !vaultStyle(sm) && !caveStyle(sm) ? shellOutline(sm) : null), { uScale: 0.25, vScale: 0.25 });
    // a painted cave: its rock, painted as that station's is (u up the wall and on over the roof,
    // v along the station, the same for both of its tracks)
    for (const station of new Set(run.filter((sm) => caveStyle(sm)).map((sm) => sm.plat!.station))) {
      const key: MaterialName = `cave:${station}`;
      this.mats[key] ??= this.caveMaterial(station);
      sweep(b[key] ??= new MeshBuilder(), run, (sm) => (caveStyle(sm) && sm.plat!.station === station ? shellOutline(sm) : null),
        { u: (u, v, _, sm) => caveAcross(sm, u, v) / T.CAVE_ACROSS, v: (u, v, sm) => caveAlong(sm, u, v) / T.CAVE_REPEAT });
    }
    sweep(b.concrete, run, (sm) => (sm.kind === 'box' && !hallStyle(sm) && !vaultStyle(sm) ? shellOutline(sm) : null), { uScale: 0.25, vScale: 0.25 });
    // a styled vault: the wall across the track (its art drawn to be read from the platform), the
    // wall behind the platform, and the vault
    for (const [mb, side] of [[b.vaultArt, -1], [b.vaultArtMirror, 1]] as const) {
      sweep(mb, run, (sm) => {
        const vs = vaultStyle(sm);
        if (!vs || sm.plat!.side !== side) return null;
        const [a, c] = structureSpan(sm), u = side > 0 ? a : c;
        return { key: 'art', pts: side > 0 ? [[u, S.FLOOR], [u, vs.spring]] : [[u, vs.spring], [u, S.FLOOR]] };
      }, { u: (_, v) => (v - S.FLOOR) / (OSTERMALMSTORG.spring - S.FLOOR), vScale: 1 / T.DERKERT_REPEAT });
    }
    sweep(b.vaultWall, run, (sm) => {
      const vs = vaultStyle(sm);
      if (!vs) return null;
      const [a, c] = structureSpan(sm), u = sm.plat!.side > 0 ? c : a;
      return { key: 'back', pts: sm.plat!.side > 0 ? [[u, vs.spring], [u, S.FLOOR]] : [[u, S.FLOOR], [u, vs.spring]] };
    }, { u: (_, v) => v / 2.4, vScale: 1 / 2.4 });
    sweep(b.vaultCeiling, run, (sm) => {
      const vs = vaultStyle(sm);
      if (!vs) return null;
      const [a, c] = structureSpan(sm), rise = (c - a) * vs.risePerWidth, n = 16;
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) { const u = a + ((c - a) * i) / n; pts.push([u, S.archHeight(a, c, vs.spring, rise, u)]); }
      return { key: 'vault', pts };
    }, { uScale: 0.25, vScale: 1 / 6 });
    // a styled hall: its wall, and the roof over it (the wall is the outline's first two points
    // where the other track is to the right, its last two where it is to the left)
    const styled = (kind: HallStyle['kind']) => (sm: Sample) => hallStyle(sm)?.kind === kind;
    const halls = [
      { is: styled('flat'), walls: [b.hallWall, b.hallWallMirror], roof: b.hallCeiling, top: HOTORGET.soffit, repeat: T.HOTORGET_REPEAT },
      { is: styled('vault'), walls: [b.kpWall, b.kpWallMirror], roof: b.kpVault, top: KARLAPLAN.spring, repeat: T.KARLAPLAN_REPEAT },
    ];
    for (const { is, walls, roof, top, repeat } of halls) {
      for (const [mb, sign] of [[walls[0], -1], [walls[1], 1]] as const) {
        sweep(mb, run, (sm) => {
          if (!is(sm) || Math.sign(sm.pair) !== sign) return null;
          const o = shellOutline(sm)!;
          return { key: o.key, pts: sign > 0 ? o.pts.slice(0, 2) : o.pts.slice(-2) };
        }, { u: (_, v) => (v - S.FLOOR) / (top - S.FLOOR), vScale: 1 / repeat });
      }
      sweep(roof, run, (sm) => {
        if (!is(sm)) return null;
        const o = shellOutline(sm)!;
        return { key: o.key, pts: sm.pair > 0 ? o.pts.slice(1) : o.pts.slice(0, -1) };
      }, { uScale: 0.25, vScale: 0.25 });
    }
    this.frieze(samples, run, b);
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
    this.columns(samples, run, b);
    this.posters(samples, run, group);
    this.blocks(samples, run, b, group);
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
    for (const [mb, kind] of [[b.platform, null], [b.hallFloor, 'flat'], [b.kpFloor, 'vault']] as const) sweep(mb, run, (sm) => {
      const p = sm.plat;
      if (!p || (hallStyle(sm)?.kind ?? null) !== kind || vaultStyle(sm)) return null;
      const e = p.side * S.PLATFORM_EDGE, o = platformOuter(sm);
      return { key: `p${p.side}`, pts: p.side > 0 ? [[e, S.FLOOR], [e, H], [o, H], [o, S.FLOOR]] : [[o, S.FLOOR], [o, H], [e, H], [e, S.FLOOR]] };
    }, { uScale: 0.5, vScale: 0.5 });
    // the pale stone along the edge of a vaulted hall's platform
    sweep(b.kpEdge, run, (sm) => {
      const p = sm.plat;
      if (!p || hallStyle(sm)?.kind !== 'vault') return null;
      const u0 = p.side * S.PLATFORM_EDGE, u1 = p.side * (S.PLATFORM_EDGE + 0.3);
      return { key: `e${p.side}`, pts: p.side > 0 ? [[u0, H + 0.002], [u1, H + 0.002]] : [[u1, H + 0.002], [u0, H + 0.002]] };
    }, { uScale: 0.5, vScale: 0.5 });
    // a styled vault's platform: terrazzo, with a band of tiles along the edge
    sweep(b.vaultFloor, run, (sm) => {
      const p = sm.plat;
      if (!p || !vaultStyle(sm)) return null;
      const i = p.side * (S.PLATFORM_EDGE + T.EDGE_BAND), o = platformOuter(sm);
      return { key: `t${p.side}`, pts: p.side > 0 ? [[i, H], [o, H], [o, S.FLOOR]] : [[o, S.FLOOR], [o, H], [i, H]] };
    }, { uScale: 0.5, vScale: 0.5 });
    sweep(b.concrete, run, (sm) => {
      const p = sm.plat;
      if (!p || !vaultStyle(sm)) return null;
      const e = p.side * S.PLATFORM_EDGE;
      return { key: `f${p.side}`, pts: p.side > 0 ? [[e, S.FLOOR], [e, H]] : [[e, H], [e, S.FLOOR]] };
    }, { uScale: 0.25, vScale: 0.25 });
    sweep(b.vaultEdge, run, (sm) => {
      const p = sm.plat;
      if (!p || !vaultStyle(sm)) return null;
      const e = p.side * S.PLATFORM_EDGE, i = p.side * (S.PLATFORM_EDGE + T.EDGE_BAND);
      return { key: `e${p.side}`, pts: p.side > 0 ? [[e, H], [i, H]] : [[i, H], [e, H]] };
    }, { u: (u) => (Math.abs(u) - S.PLATFORM_EDGE) / T.EDGE_BAND, vScale: 1 / T.EDGE_REPEAT });
    sweep(b.yellow, run, (sm) => {
      const p = sm.plat;
      if (!p || vaultStyle(sm)) return null;
      const u0 = p.side * (S.PLATFORM_EDGE + 0.3), u1 = p.side * (S.PLATFORM_EDGE + 0.42);
      return { key: `y${p.side}`, pts: p.side > 0 ? [[u0, H + 0.004], [u1, H + 0.004]] : [[u1, H + 0.004], [u0, H + 0.004]] };
    });
    // station name signs on the wall across the track, and lights over the platform edge
    let lastSign = -Infinity;
    for (const sm of run) {
      const p = sm.plat;
      if (!p) continue;
      const vs = vaultStyle(sm);
      if (vs && sm.along - lastSign >= vs.signEvery) {
        // a styled vault's: white, on the wall behind the platform
        lastSign = sm.along;
        const back = structureSpan(sm)[p.side > 0 ? 1 : 0];
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.4), this.signMaterial(p.station, true));
        sign.position.copy(at(sm, back - p.side * 0.05, vs.signAt));
        sign.lookAt(at(sm, back - p.side * 1.05, vs.signAt));
        group.add(sign);
      } else if (!vs && sm.along - lastSign >= 30) {
        lastSign = sm.along;
        const span = structureSpan(sm);
        const wall = p.side > 0 ? span[0] : span[1];
        // (a styled hall has its own name plates)
        if ((sm.kind === 'rock' || sm.kind === 'box') && !hallStyle(sm)) {
          // (on a painted cave's rock, where it is)
          const w = caveStyle(sm) ? wall - Math.sign(wall) * caveInward(sm, wall, 2.4) : wall;
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.68), this.signMaterial(p.station));
          sign.position.copy(at(sm, w + p.side * 0.06, 2.4));
          sign.lookAt(at(sm, w + p.side * 1.06, 2.4));
          group.add(sign);
        }
      }
      // (in a vaulted hall, a nearly unbroken row along its crown)
      if (hallStyle(sm)?.kind === 'vault') {
        if (sm.pair > 0) box(b.lamp, at(sm, sm.pair / 2, (hallStyle(sm) as VaultHall).crown + sm.pairDy / 2 - 0.06), sm, 0.26, 0.08, STEP - 0.35);
      } else if (Math.round(sm.along / STEP) % 2 === 0) {
        // (in a styled hall, troffers in the soffit)
        const st = hallStyle(sm);
        if (st?.kind === 'flat') box(b.lamp, at(sm, p.side * (S.PLATFORM_EDGE + 0.8), st.soffit - 0.02), sm, 0.3, 0.04, 2.2);
        else if (!vs && !caveStyle(sm)) box(b.lamp, at(sm, p.side * (S.PLATFORM_EDGE + 1.2), H + 2.6), sm, 0.12, 0.06, 2.2);
      }
      if (caveStyle(sm)) {
        // in a painted cave, a row of fittings hung on rods well under the rock, over the
        // platform's edge
        const [a, c] = structureSpan(sm), u = p.side * (S.PLATFORM_EDGE + 0.7);
        const roof = S.archHeight(a, c, S.HALL.spring, (c - a) * S.HALL.risePerWidth, u), v = Math.min(roof - CAVE_ROUGH - 0.4, H + 3.2);
        box(b.fitting, at(sm, u, v + 0.04), sm, 0.3, 0.08, 2.2);
        box(b.lamp, at(sm, u, v - 0.005), sm, 0.24, 0.02, 2.1);
        box(b.fitting, at(sm, u, (v + roof) / 2), sm, 0.03, roof - v, 0.03);
      }
      if (vs) {
        // in a styled vault, a row of fittings hung under it over the platform's edge, nearly end
        // to end
        const [a, c] = structureSpan(sm), u = p.side * (S.PLATFORM_EDGE + 0.6);
        const v = S.archHeight(a, c, vs.spring, (c - a) * vs.risePerWidth, u) - 0.3;
        box(b.fitting, at(sm, u, v + 0.04), sm, 0.34, 0.08, 2.2);
        box(b.lamp, at(sm, u, v - 0.005), sm, 0.28, 0.02, 2.1);
        box(b.fitting, at(sm, u, v + 0.2), sm, 0.04, 0.24, 0.04);
      }
    }
  }

  // A styled hall's posters on this track's wall, either side of a plate with the station's old
  // name: halfway between two of the tiles' name plates, the nearest to the platform's middle.
  private posters(all: Sample[], run: Sample[], group: THREE.Group) {
    const first = run.find((sm) => hallStyle(sm)?.kind === 'flat');
    const st = first && (hallStyle(first) as FlatHall), ps = st?.posters;
    if (!first || !ps) return;
    const p = first.plat!, on = all.filter((sm) => sm.plat === p);
    const t = Math.round((on[0].along + on[on.length - 1].along) / 2 / T.HOTORGET_REPEAT) * T.HOTORGET_REPEAT;
    const i = run.findIndex((sm, j) => j + 1 < run.length && sm.along <= t && run[j + 1].along > t);
    if (i < 0 || run[i].plat !== p) return;
    const sa = run[i], sb = run[i + 1], f = (t - sa.along) / (sb.along - sa.along || 1);
    const sm = { ...sa, x: sa.x + (sb.x - sa.x) * f, y: sa.y + (sb.y - sa.y) * f, z: sa.z + (sb.z - sa.z) * f };
    const span = structureSpan(sm), wall = p.side > 0 ? span[0] : span[1];
    // along the track, to the left of someone facing the wall
    const left = new THREE.Vector3(sm.rz, 0, -sm.rx).multiplyScalar(Math.sign(wall));
    this.posterMats ??= [T.posterKatten(), T.namePlate(ps.name), T.posterToy()].map((map) => new THREE.MeshStandardMaterial({ map, roughness: 0.5 }));
    const sizes: [number, number][] = [[1.3, 1.75], [0.63, 0.09], [1.3, 1.75]];
    [-1, 0, 1].forEach((k, j) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(...sizes[j]), this.posterMats![j]);
      const h = j === 1 ? st.plateAt : ps.at;
      m.position.copy(at(sm, wall + p.side * 0.02, h)).addScaledVector(left, -k * ps.apart);
      m.lookAt(at(sm, wall + p.side, h).addScaledVector(left, -k * ps.apart));
      group.add(m);
    });
  }

  // A styled hall's row of columns along this track's side of the platform, evenly spaced and
  // centred on it (`all` is the piece's samples, `run` the stretch being built).
  private columns(all: Sample[], run: Sample[], b: Record<MaterialName, MeshBuilder>) {
    const first = run.find((sm) => hallStyle(sm)?.kind === 'flat');
    if (!first) return;
    const st = hallStyle(first) as FlatHall, p = first.plat!, { fromEdge, size, spacing } = st.columns;
    const on = all.filter((sm) => sm.plat === p);
    const a0 = on[0].along, a1 = on[on.length - 1].along;
    const n = Math.floor((a1 - a0 - 2 * spacing / 2) / spacing);
    const start = a0 + (a1 - a0 - n * spacing) / 2;
    for (let k = 0; k <= n; k++) {
      const t = start + k * spacing;
      // in this run (half open, as the next run starts on this one's last sample)
      const i = run.findIndex((sm, j) => j + 1 < run.length && sm.along <= t && run[j + 1].along > t);
      if (i < 0 || run[i].plat !== p) continue;
      const sa = run[i], sb = run[i + 1], f = (t - sa.along) / (sb.along - sa.along || 1);
      const sm = { ...sa, x: sa.x + (sb.x - sa.x) * f, y: sa.y + (sb.y - sa.y) * f, z: sa.z + (sb.z - sa.z) * f };
      const u = p.side * (S.PLATFORM_EDGE + fromEdge);
      // none where the stairs or escalators come down into the hall
      const h = size / 2, open = (i: number, k: number, v: number) => {
        const q = at(sm, u + i * h, v);
        return this.holes.some((o) => insideVolume(o, q.x + sm.rz * k * h, q.y, q.z - sm.rx * k * h));
      };
      if ([-1, 1].some((i) => [-1, 1].some((k) => open(i, k, S.PLATFORM_HEIGHT + 1) || open(i, k, st.soffit - 0.05)))) continue;
      pillar(b.hallColumn, at(sm, u, 0), sm, size, S.PLATFORM_HEIGHT, st.soffit);
    }
  }

  // A vaulted hall's frieze (Karlaplan's photomontage) along one of its track walls, centred on
  // the platform, just proud of the wall.
  private frieze(all: Sample[], run: Sample[], b: Record<MaterialName, MeshBuilder>) {
    const first = run.find((sm) => hallStyle(sm)?.kind === 'vault');
    const st = first && (hallStyle(first) as VaultHall), f = st?.frieze;
    if (!first || !f || Math.sign(first.pair) !== f.wall) return;
    const on = all.filter((sm) => sm.plat === first.plat);
    const mid = (on[0].along + on[on.length - 1].along) / 2, t0 = mid - f.length / 2, t1 = mid + f.length / 2;
    sweep(b.kpFrieze, run, (sm) => {
      if (sm.along < t0 || sm.along > t1 || hallStyle(sm) !== st || Math.sign(sm.pair) !== f.wall) return null;
      const o = shellOutline(sm)!, u = o.pts[f.wall > 0 ? 0 : o.pts.length - 1][0] + f.wall * 0.015;
      const dy = (v: number) => v + (sm.pairDy / 2) * Math.min(1, (v - S.FLOOR) / 2);
      return { key: 'frieze', pts: [[u, dy(f.from)], [u, dy(f.to)]] };
    }, { uScale: 1 / (f.to - f.from), vScale: 1 / T.FRIEZE_REPEAT });
  }

  // A vaulted hall's blocks down the middle of its platform (Karlaplan's), drawn by the track with
  // the other to its right: tiled, the station's name along their tops with the ways out, and in
  // their sides, by turns, a niche with a bench. None where the stairs or escalators come down.
  private blocks(all: Sample[], run: Sample[], b: Record<MaterialName, MeshBuilder>, group: THREE.Group) {
    const first = run.find((sm) => hallStyle(sm)?.kind === 'vault' && sm.pair > 0);
    if (!first) return;
    const st = hallStyle(first) as VaultHall, p = first.plat!, { width, height, length, gap, spread } = st.blocks;
    const on = all.filter((sm) => sm.plat === p);
    // as many as fit either side of a gap in the middle of the platform
    const a0 = on[0].along, a1 = on[on.length - 1].along, mid = (a0 + a1) / 2;
    const m = Math.max(1, Math.floor(((a1 - a0) * spread / 2 + gap / 2) / (length + gap)));
    const H = S.PLATFORM_HEIGHT, R = T.KARLAPLAN_BAY;
    for (let k = 0; k < 2 * m; k++) {
      const c = mid + (k < m ? -1 : 1) * (gap / 2 + length / 2 + (k < m ? m - 1 - k : k - m) * (length + gap));
      const i = run.findIndex((sm, j) => j + 1 < run.length && sm.along <= c && run[j + 1].along > c);
      if (i < 0 || run[i].plat !== p) continue;
      const sa = run[i], sb = run[i + 1], f = (c - sa.along) / (sb.along - sa.along || 1);
      const sm = { ...sa, x: sa.x + (sb.x - sa.x) * f, y: sa.y + (sb.y - sa.y) * f, z: sa.z + (sb.z - sa.z) * f };
      const u = sm.pair / 2, y0 = H + sm.pairDy / 4, y1 = y0 + height;
      // along the track, and across it to the right
      const tx = sm.rz, tz = -sm.rx;
      const P = (i: number, k: number, y: number) => new THREE.Vector3(sm.x + sm.rx * (u + (i * width) / 2) + tx * (k * length) / 2, sm.y + y, sm.z + sm.rz * (u + (i * width) / 2) + tz * (k * length) / 2);
      const open = [-1, 1].some((i) => [-1, 0, 1].some((k) => {
        const q = P(i, k, H + 1.5);
        return this.holes.some((o) => insideVolume(o, q.x, q.y, q.z));
      }));
      if (open) continue;
      // the four sides, their tiles in metres, and the top
      const corners: [number, number, number][] = [[1, -1, length], [1, 1, width], [-1, 1, length], [-1, -1, width], [1, -1, 0]];
      for (let s = 0; s < 4; s++) {
        const [i0, k0, w] = corners[s], [i1, k1] = corners[s + 1];
        b.kpBlock.quad(P(i0, k0, y0), P(i1, k1, y0), P(i1, k1, y1), P(i0, k0, y1), [0, 0], [w / R, 0], [w / R, height / R], [0, height / R]);
      }
      b.kpBlockTop.quad(P(-1, -1, y1), P(-1, 1, y1), P(1, 1, y1), P(1, -1, y1));
      // on each long side: the name along the top, and a niche or a poster frame's worth of tiles
      for (const side of [-1, 1] as const) {
        const out = new THREE.Vector3(sm.rx * side, 0, sm.rz * side);
        // to the right of someone facing this side
        const right = new THREE.Vector3(out.z, 0, -out.x);
        const face = (along: number, y: number) => P(side, 0, y).addScaledVector(out, 0.012).addScaledVector(new THREE.Vector3(tx, 0, tz), along);
        const ends = st.exits.map((e) => ({ name: e.name, d: right.x * (e.x - sm.x) + right.z * (e.z - sm.z) }));
        const toRight = ends.reduce((m, e) => (e.d > m.d ? e : m)), toLeft = ends.reduce((m, e) => (e.d < m.d ? e : m));
        const signW = Math.min(length - 0.6, 7.2), signH = 0.36;
        const key = `${toLeft.name}|${toRight.name}`;
        this.kpSigns ??= new Map();
        let sign = this.kpSigns.get(key);
        if (!sign) { sign = new THREE.MeshStandardMaterial({ map: T.karlaplanSign(toLeft.name, toRight.name, signW, signH), transparent: true, roughness: 0.4 }); this.kpSigns.set(key, sign); }
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), sign);
        plate.position.copy(face(0, y1 - 0.35));
        plate.lookAt(plate.position.clone().add(out));
        group.add(plate);
        // a niche by turns, with its bench
        if ((k + (side > 0 ? 0 : 1)) % 2 === 0) {
          const nw = 3.0, nh = 2.2, variant = k * 2 + (side > 0 ? 0 : 1);
          this.kpNiches ??= [0, 1].map((v) => new THREE.MeshStandardMaterial({ map: T.horlinNiche(nw, nh, v), roughness: 0.45 }));
          const niche = new THREE.Mesh(new THREE.PlaneGeometry(nw, nh), this.kpNiches[variant % 2]);
          niche.position.copy(face(0, y0 + nh / 2));
          niche.lookAt(niche.position.clone().add(out));
          group.add(niche);
          // the bench: a slatted seat on two brackets, against the niche's back
          const seat = face(0, y0 + 0.45).addScaledVector(out, 0.22);
          const bench = { ...sm, x: seat.x, y: seat.y, z: seat.z };
          box(b.kpBench, at(bench, 0, 0), bench as Sample, 0.4, 0.05, nw - 0.3);
          box(b.kpBench, at(bench, side * -0.17, 0.22), bench as Sample, 0.06, 0.4, nw - 0.3);
          for (const e of [-1, 1]) box(b.steel, at(bench, 0, -0.23).addScaledVector(new THREE.Vector3(tx, 0, tz), e * (nw / 2 - 0.4)), bench as Sample, 0.36, 0.45, 0.05);
        }
      }
    }
  }

  private caveMaterial(station: string) {
    const map = T.caveRock(CAVE_STYLES[station].paint);
    // (lit by its lamps, which light nothing: so it glows a little, as the vaults do)
    return new THREE.MeshStandardMaterial({ map, emissive: 0x5a5a5a, emissiveMap: map, roughness: 0.95, side: THREE.DoubleSide });
  }

  private signMaterial(station: string, white = false) {
    const key = `${station}${white ? ' white' : ''}`;
    let m = this.signs.get(key);
    if (!m) { m = new THREE.MeshBasicMaterial({ map: white ? T.whiteNameSign(station.toUpperCase()) : T.nameSign(station) }); this.signs.set(key, m); }
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
    const ring = (sm: Sample, inner: [number, number][], outer: [number, number][], mb = b.concrete) => {
      const first = mb.pos.length / 3;
      for (const outline of [inner, outer]) for (const [u, v] of outline) { at(sm, u, v, _w); mb.vertex(_w.x, _w.y, _w.z, u * 0.25, v * 0.25); }
      mb.grid(2, inner.length, first);
    };
    // (into a station, only a little over the crown: the station's other levels may be over it)
    const portal = (t: Sample, station = false) => {
      const shell = shellOutline(t);
      if (!shell) return;
      const inner = shell.pts;
      const [sa, sb] = structureSpan(t), mid = (sa + sb) / 2;
      const crown = Math.max(...inner.map((p) => p[1]));
      const top = station ? crown + 1 : Math.max(crown + 2, t.ground === null ? 0 : t.ground - t.y + 0.5);
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
    if (i0 > 0 && samples[i0 - 1].skip && tunnel(samples[i0])) portal(samples[i0], true);
    if (i0 === 0 && samples[0].mouth) portal(samples[0]);
    if (i1 === samples.length - 1 && samples[i1].mouth) portal(samples[i1]);
    if (i1 + 1 < samples.length && samples[i1 + 1].skip && tunnel(samples[i1])) portal(samples[i1], true);
    for (let i = i0 + 1; i <= i1; i++) {
      const p = samples[i - 1], q = samples[i];
      if (q.along - p.along > 0.05) continue;
      if (tunnel(p) && tunnel(q)) {
        const a = closedOutline(p), c = closedOutline(q);
        if (a.length !== c.length || a.some(([u, v], j) => Math.hypot(u - c[j][0], v - c[j][1]) > 0.05)) {
          const [ra, rc] = rays(a, c, middle(p), middle(q));
          // in rock, of rock
          ring(p, ra, rc, p.kind === 'rock' && q.kind === 'rock' ? b.rock : b.concrete);
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
// or runs between it and the other track of its tunnel (a turnback siding), the service's tunnel
// is widened to take it in (`widened`: how far, beyond the other track's centre), and the other
// track has no tunnel of its own there (`bare`).
const WIDEN = 4.5;
const bare = (sm: Sample) => sm.yard && (sm.kind === 'rock' || sm.kind === 'box')
  && ((sm.left < 0 && -sm.left < WIDEN) || (sm.right < 0 && -sm.right < WIDEN));
const widened = (sm: Sample, side: number) => {
  const v = side < 0 ? sm.left : sm.right;
  const between = !!sm.pair && Math.sign(sm.pair) === side && v < Math.abs(sm.pair);
  return !sm.yard && (sm.kind === 'rock' || sm.kind === 'box') && v > 0 && (v < WIDEN || between) ? v : 0;
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
  const style = hallStyle(sm);
  if (style) return styledOutline(sm, a, b, style);
  const width = b - a;
  const full: [number, number][] = [[a, S.FLOOR]];
  if (sm.kind === 'box') {
    const h = S.BOX.height, k = S.BOX.haunch;
    full.push([a, h - k], [a + k, h], [b - k, h], [b, h - k]);
  } else {
    let spring: number, rise: number;
    if (sm.plat) {
      const vs = vaultStyle(sm);
      spring = vs?.spring ?? S.HALL.spring; rise = width * (vs?.risePerWidth ?? S.HALL.risePerWidth);
    }
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
  if (caveStyle(sm)) return { key: `cave${Math.sign(sm.pair)}`, pts: roughen(sm, pts) };
  return { key: `${sm.kind}${Math.sign(sm.pair)}`, pts };
}

// A styled hall's outline (src/hall-styles.ts), the island platform's two tracks sharing it: the
// walls up to the soffit, over each track to the inner face of its row of columns, then up to the ceiling between
// them; this track's half, to just over the middle. Its corners are kept, unlike the vaults'.
function hallStyle(sm: Sample): HallStyle | null {
  const p = sm.plat;
  return p && p.island && sm.pair && (sm.kind === 'rock' || sm.kind === 'box') ? HALL_STYLES[p.station] ?? null : null;
}
// A painted cave (src/hall-styles.ts): a station hall in rock, its rock left rough and painted.
function caveStyle(sm: Sample): CaveStyle | null {
  const p = sm.plat;
  return p && sm.kind === 'rock' ? CAVE_STYLES[p.station] ?? null : null;
}
// A cave's rock is the vault's outline pushed in and out by up to CAVE_ROUGH, in lumps a few
// metres across that depend only on where they are, so that the halves of a hall two tracks share
// meet; the foot of each wall stays where it is.
const CAVE_ROUGH = 0.45;
function caveInward(sm: Sample, u: number, v: number) {
  const p = at(sm, u, v);
  const n = lumps(p.x / 4.5, p.y / 3, p.z / 4.5) * 0.7 + lumps(p.x / 1.6 + 17, p.y / 1.4, p.z / 1.6) * 0.3;
  return n * CAVE_ROUGH * Math.min(1, Math.max(0, (v - S.FLOOR) / 1.4));
}
function roughen(sm: Sample, pts: [number, number][]): [number, number][] {
  return pts.map(([u, v], j) => {
    const [pu, pv] = pts[Math.max(0, j - 1)], [qu, qv] = pts[Math.min(pts.length - 1, j + 1)];
    const tu = qu - pu, tv = qv - pv, l = Math.hypot(tu, tv) || 1;
    // the outline runs up the left wall, over and down the right: outwards is to its left
    const d = -caveInward(sm, u, v);
    return [u - (tv / l) * d, v + (tu / l) * d];
  });
}
// How far a point of a cave's rock is round from its floor: up the wall from the tunnel floor, then
// across from the nearer wall (so the same for both halves of a shared hall where they meet).
function caveAcross(sm: Sample, u: number, v: number) {
  const [a, c] = structureSpan(sm);
  return Math.max(0, v - S.FLOOR) + Math.min(Math.abs(u - a), Math.abs(u - c));
}
// And how far along the station: along its track, the same way for both tracks.
function caveAlong(sm: Sample, u: number, v: number) {
  const p = at(sm, u, v);
  let tx = sm.rz, tz = -sm.rx;
  if (tx < 0 || (tx === 0 && tz < 0)) { tx = -tx; tz = -tz; }
  return p.x * tx + p.z * tz;
}
// Smooth value noise in [-1, 1].
function lumps(x: number, y: number, z: number) {
  const hash = (i: number, j: number, k: number) => {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295 * 2 - 1;
  };
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const f = (t: number) => t * t * (3 - 2 * t), fx = f(x - x0), fy = f(y - y0), fz = f(z - z0);
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dy: number, dz: number) => L(hash(x0, y0 + dy, z0 + dz), hash(x0 + 1, y0 + dy, z0 + dz), fx);
  return L(L(c(0, 0), c(1, 0), fy), L(c(0, 1), c(1, 1), fy), fz);
}
// A styled vault (src/hall-styles.ts): a hall in rock of its own, for a track with a platform
// beside it.
function vaultStyle(sm: Sample): VaultStyle | null {
  const p = sm.plat;
  return p && !p.island && !sm.pair && sm.kind === 'rock' ? VAULT_STYLES[p.station] ?? null : null;
}
function styledOutline(sm: Sample, a: number, b: number, st: HallStyle): { key: string; pts: [number, number][] } {
  if (st.kind === 'vault') return vaultOutline(sm, a, b, st);
  const s = sm.plat!.side, d = S.PLATFORM_EDGE + st.columns.fromEdge + st.columns.size / 2;
  const c1 = s * d, c2 = sm.pair - s * d;
  const lo = Math.min(c1, c2), hi = Math.max(c1, c2);
  const full: [number, number][] = [[a, S.FLOOR], [a, st.soffit], [lo, st.soffit], [lo + st.step, st.ceiling],
    [hi - st.step, st.ceiling], [hi, st.soffit], [b, st.soffit], [b, S.FLOOR]];
  const [o0, o1] = ownSpan(sm, [a, b]);
  const pts: [number, number][] = sm.pair > 0
    ? [...full.filter(([u]) => u < o1), [o1, st.ceiling]]
    : [[o0, st.ceiling], ...full.filter(([u]) => u > o0)];
  const dy = sm.pairDy / 2;
  return { key: `styled${Math.sign(sm.pair)}`, pts: pts.map(([u, v]) => [u, v + (v > S.FLOOR + 0.01 ? dy * Math.min(1, (v - S.FLOOR) / 2) : 0)]) };
}

// A vaulted hall's outline (Karlaplan's): straight walls up to the spring, and one segmental vault
// over both tracks, its crown over the middle of the platform; this track's half, to just over
// the middle, with the corner at the spring kept.
function vaultOutline(sm: Sample, a: number, b: number, st: VaultHall): { key: string; pts: [number, number][] } {
  const [o0, o1] = ownSpan(sm, [a, b]), n = 14;
  const arc = (u: number): [number, number] => [u, S.archHeight(a, b, st.spring, st.crown - st.spring, u)];
  const pts: [number, number][] = [];
  if (sm.pair > 0) {
    pts.push([a, S.FLOOR], [a, st.spring]);
    for (let i = 1; i <= n; i++) pts.push(arc(a + ((o1 - a) * i) / n));
  } else {
    for (let i = 0; i < n; i++) pts.push(arc(o0 + ((b - o0) * i) / n));
    pts.push([b, st.spring], [b, S.FLOOR]);
  }
  const dy = sm.pairDy / 2;
  return { key: `vault${Math.sign(sm.pair)}`, pts: pts.map(([u, v]) => [u, v + (v > S.FLOOR + 0.01 ? dy * Math.min(1, (v - S.FLOOR) / 2) : 0)]) };
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

// Where a track shares its tunnel, the middle its half is closed down: [u, side] (side +1 where the
// other track is to the right), or null.
function middle(sm: Sample): [number, number] | null {
  if (!sm.pair || inHall(sm)) return null;
  const o = shellOutline(sm)!.pts;
  return sm.pair > 0 ? [o[o.length - 1][0], 1] : [o[0][0], -1];
}

// Two outlines, each closed along its floor, met by the same rays from a point over the track, all
// the way round: the edges of the wall between two tunnels of different shapes. There is a ray
// through every corner of either, and the last ray is the first again. Where one is the half of a
// shared tunnel (`ma`, `mb`: its middle), the other is cut off at that middle: beyond it is the
// other track's half, or its own tunnel, which this one opens into.
function rays(a: [number, number][], b: [number, number][], ma: [number, number] | null = null, mb: [number, number] | null = null, n = 48): [[number, number][], [number, number][]] {
  const O: [number, number] = [0, 1.8];
  const angle = ([u, v]: [number, number]) => Math.atan2(v - O[1], u - O[0]);
  const hit = (poly: [number, number][], du: number, dv: number): [number, number] => {
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const [pu, pv] = poly[i], q = poly[(i + 1) % poly.length], eu = q[0] - pu, ev = q[1] - pv;
      const den = du * ev - dv * eu;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((pu - O[0]) * ev - (pv - O[1]) * eu) / den, s = ((pu - O[0]) * dv - (pv - O[1]) * du) / den;
      if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) best = t;
    }
    return best < Infinity ? [O[0] + du * best, O[1] + dv * best] : [O[0], O[1]];
  };
  const ts = [...a, ...b].map(angle);
  for (let j = 0; j < n; j++) ts.push(-Math.PI + (2 * Math.PI * j) / n);
  ts.sort((x, y) => x - y);
  const ra: [number, number][] = [], rb: [number, number][] = [];
  for (const [j, t] of ts.entries()) {
    if (j && t - ts[j - 1] < 1e-6) continue;
    const du = Math.cos(t), dv = Math.sin(t);
    let ha = hit(a, du, dv), hb = hit(b, du, dv);
    if (ma && Math.abs(ha[0] - ma[0]) < 1e-6 && (hb[0] - ma[0]) * ma[1] > 0) hb = ha;
    if (mb && Math.abs(hb[0] - mb[0]) < 1e-6 && (ha[0] - mb[0]) * mb[1] > 0) ha = hb;
    ra.push(ha); rb.push(hb);
  }
  ra.push(ra[0]); rb.push(rb[0]);
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
  { uScale = 1, vScale = 1, u = null as ((u: number, v: number, along: number, sm: Sample) => number) | null,
    v = null as ((u: number, v: number, sm: Sample) => number) | null } = {}) {
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
          b.vertex(_w.x, _w.y, _w.z, u ? u(pu, pv, sm.along, sm) : len * uScale, v ? v(pu, pv, sm) : sm.along * vScale);
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

// A square column standing at `c` from y0 to y1 above it, `size` across, its tiles in metres
// (T.HOTORGET_REPEAT m to a repeat of the texture).
function pillar(b: MeshBuilder, c: THREE.Vector3, sm: Sample, size: number, y0: number, y1: number) {
  const tx = sm.rz, tz = -sm.rx, h = size / 2, R = T.HOTORGET_REPEAT;
  const P = (i: number, k: number, y: number) => new THREE.Vector3(c.x + (sm.rx * i + tx * k) * h, c.y + y, c.z + (sm.rz * i + tz * k) * h);
  const corners: [number, number][] = [[1, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (let f = 0; f < 4; f++) {
    const [i0, k0] = corners[f], [i1, k1] = corners[f + 1];
    b.quad(P(i0, k0, y0), P(i1, k1, y0), P(i1, k1, y1), P(i0, k0, y1), [0, y0 / R], [size / R, y0 / R], [size / R, y1 / R], [0, y1 / R]);
  }
}

// A styled hall's neon (Gun Gordillo's at Hötorget): tubes wandering along under the ceiling
// between the columns, now and then across, each at its own height, hung on thin rods; in a few
// tones of white. `plat` is one track's samples along the platform; none hang where the station's
// stairs and escalators (`holes`) come down into the hall.
function neon(plat: Sample[], st: FlatHall, holes: Volume[]) {
  const r = T.rng(1998), group = new THREE.Group();
  group.name = 'neon';
  const L = plat[plat.length - 1].along - plat[0].along;
  const mid = plat[0].pair / 2;
  // the roof's height across the hall, from its middle
  const inner = Math.abs(plat[0].pair) / 2 - S.PLATFORM_EDGE - st.columns.fromEdge - st.columns.size / 2 - st.step;
  const roof = (w: number) => {
    const d = Math.abs(w) - inner;
    return d <= 0 ? st.ceiling : d >= st.step ? st.soffit : st.ceiling - ((st.ceiling - st.soffit) * d) / st.step;
  };
  const point = (t: number, w: number, v: number) => {
    const a = plat[0].along + t;
    let i = 0;
    while (i < plat.length - 2 && plat[i + 1].along < a) i++;
    const sa = plat[i], sb = plat[i + 1], f = Math.max(0, Math.min(1, (a - sa.along) / (sb.along - sa.along || 1)));
    const pa = at(sa, mid + w, v), pb = at(sb, mid + w, v);
    return pa.lerp(pb, f);
  };
  const box = new THREE.Box3().setFromPoints(plat.map((sm) => new THREE.Vector3(sm.x, sm.y, sm.z))).expandByScalar(20);
  const near = holes.filter((h) => h.max[0] > box.min.x && h.min[0] < box.max.x && h.max[2] > box.min.z && h.min[2] < box.max.z);
  const open = (q: THREE.Vector3) => near.some((h) => insideVolume(h, q.x, q.y, q.z));
  const tubes: THREE.BufferGeometry[][] = st.neon.tones.map(() => []);
  const rods: number[] = [];
  let hung: number[] = [];
  const tube = (pts: THREE.Vector3[], tone: number) => {
    const these = hung;
    hung = [];
    if (pts.length < 2) return;
    rods.push(...these);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    tubes[tone].push(new THREE.TubeGeometry(curve, pts.length * 8, 0.012, 5, false));
  };
  const { reach, below } = st.neon;
  for (let n = 0; n < st.neon.count; n++) {
    let t = 1 + r() * (L - 2), w = (r() * 2 - 1) * reach * 0.9;
    let depth = below[0] + r() * (below[1] - below[0]);
    const dir = r() < 0.5 ? -1 : 1, across = r() < 0.2;
    let heading = across ? (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.6) : (r() - 0.5) * 0.3;
    const len = 3 + r() * 9, tone = Math.floor(r() * tubes.length);
    let pts: THREE.Vector3[] = [];
    for (let run = 0; run <= len && t > 0.5 && t < L - 0.5; ) {
      const v = roof(w) - depth, q = point(t, w, v);
      // (where it would hang in an opening, it stops, and goes on beyond)
      if (open(q) || open(point(t, w, roof(w) + 0.1))) { tube(pts, tone); pts = []; }
      else {
        pts.push(q);
        if (pts.length === 1 || r() < 0.3) hung.push(...q.toArray(), ...point(t, w, roof(w)).toArray());
      }
      const step = 0.5 + r() * 0.9;
      run += step;
      t += dir * step;
      w += heading * step + (r() - 0.5) * 0.35;
      // now and then a bend
      if (r() < 0.12) w += (r() - 0.5) * 1.4;
      if (Math.abs(w) > reach) { w = Math.sign(w) * reach; heading = -heading; }
      depth = Math.max(below[0], Math.min(below[1], depth + (r() - 0.5) * 0.12));
    }
    tube(pts, tone);
  }
  st.neon.tones.forEach((tone, k) => {
    if (!tubes[k].length) return;
    const g = mergeGeometries(tubes[k]);
    tubes[k].forEach((t) => t.dispose());
    group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: tone, toneMapped: false })));
  });
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(rods, 3));
  group.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x6d7276 })));
  return group;
}

// ------------------------------------------------------------------ the two halves of a tunnel
// Where the two tracks of a line share a tunnel, each draws its half, and each changes its outline
// (from rock to box, or from sharing the tunnel to a tunnel of its own) at its own points, which
// can be several metres from where the other track changes. In between, the two halves have
// different outlines, and the tunnel is open where they should meet. So each such change is moved
// to halfway between it and the other track's same change, and the two meet there.
const ALIGN_REACH = 15; // the other track's change is looked for this far from beside this one's
function alignChanges(all: Sample[][]) {
  const state = (sm: Sample) => `${sm.kind}${sm.pair ? '+' : ''}${widened(sm, -1) || widened(sm, 1) ? 'w' : ''}`;
  interface Change { list: Sample[]; i: number; x: number; z: number; a: string; b: string }
  const changes: Change[] = [];
  for (const list of all) {
    for (let i = 1; i < list.length; i++) {
      const p = list[i - 1], q = list[i];
      if (q.along - p.along > 0.05 || p.skip || q.skip || p.yard || (!p.pair && !q.pair) || state(p) === state(q)) continue;
      changes.push({ list, i, x: q.x, z: q.z, a: state(p), b: state(q) });
    }
  }
  const moves: { c: Change; other: Sample[]; by: number }[] = [];
  for (const c of changes) {
    // beside it, where the other track is
    const p = c.list[c.i - 1], q = c.list[c.i], paired = p.pair ? p : q;
    const ox = c.x + paired.rx * paired.pair, oz = c.z + paired.rz * paired.pair;
    let best: Change | null = null, bestD = ALIGN_REACH;
    for (const o of changes) {
      if (o.list === c.list || !((o.a === c.a && o.b === c.b) || (o.a === c.b && o.b === c.a))) continue;
      const d = Math.hypot(o.x - ox, o.z - oz);
      if (d < bestD) { bestD = d; best = o; }
    }
    // along this track (its direction is to the left of its right)
    if (best) moves.push({ c, other: best.list, by: ((best.x - c.x) * q.rz - (best.z - c.z) * q.rx) / 2 });
  }
  // from the last in each list, so that the samples put in don't move the changes still to do
  moves.sort((m, n) => n.c.i - m.c.i);
  for (const { c, other, by } of moves) {
    if (Math.abs(by) < 0.1) continue;
    // (copies: the samples themselves take the other side's state)
    const list = c.list, before = { ...list[c.i - 1] }, after = { ...list[c.i] };
    const to = after.along + by;
    // the samples the change passes over take the state from its other side, as far as `to` or
    // another change, whichever comes first
    const take = (sm: Sample, from: Sample) => {
      sm.kind = from.kind;
      if (from.pair) {
        // the other track's offset from it, as it is there
        const o = nearestSample(other, sm.x, sm.z);
        sm.pair = (o.x - sm.x) * sm.rx + (o.z - sm.z) * sm.rz;
        sm.pairDy = o.y - sm.y;
      } else { sm.pair = 0; sm.pairDy = 0; }
      if (!sm.plat) sm.third = sm.pair ? (sm.pair > 0 ? -1 : 1) : from.third;
    };
    let k: number;
    if (by > 0) {
      k = c.i;
      while (k + 1 < list.length && list[k + 1].along < to && list[k + 1].along - list[k].along > 0.05) take(list[k++], before);
      if (k + 1 >= list.length || list[k + 1].along - list[k].along <= 0.05) { take(list[k], before); continue; }
      take(list[k], before);
      // the change, between k and k + 1
      const a = list[k], b = list[k + 1], t = (to - a.along) / (b.along - a.along);
      const left = { ...lerpSample(a, b, t) }, right = { ...lerpSample(a, b, t) };
      take(left, before); take(right, after);
      list.splice(k + 1, 0, left, right);
    } else {
      k = c.i - 1;
      while (k - 1 >= 0 && list[k - 1].along > to && list[k].along - list[k - 1].along > 0.05) take(list[k--], after);
      if (k - 1 < 0 || list[k].along - list[k - 1].along <= 0.05) { take(list[k], after); continue; }
      take(list[k], after);
      const a = list[k - 1], b = list[k], t = (to - a.along) / (b.along - a.along);
      const left = { ...lerpSample(a, b, t) }, right = { ...lerpSample(a, b, t) };
      take(left, before); take(right, after);
      list.splice(k, 0, left, right);
    }
  }
}

// the sample a fraction t of the way from a to b, with a's attributes
function lerpSample(a: Sample, b: Sample, t: number): Sample {
  const l = (u: number, v: number) => u + (v - u) * t;
  let rx = l(a.rx, b.rx), rz = l(a.rz, b.rz);
  const n = Math.hypot(rx, rz) || 1;
  rx /= n; rz /= n;
  const ground = a.ground !== null && b.ground !== null ? l(a.ground, b.ground) : a.ground;
  return { ...a, x: l(a.x, b.x), y: l(a.y, b.y), z: l(a.z, b.z), rx, rz, along: l(a.along, b.along), s: l(a.s, b.s), ground, mouth: false, deadEnd: false };
}

function nearestSample(list: Sample[], x: number, z: number) {
  let best = list[0], bestD = Infinity;
  for (const sm of list) {
    const d = (sm.x - x) ** 2 + (sm.z - z) ** 2;
    if (d < bestD) { bestD = d; best = sm; }
  }
  return best;
}

// ------------------------------------------------------------------ samples along a piece
// The piece's points (about 10 m apart) made into a smooth line (Catmull–Rom) with a sample about
// every STEP metres. Where the structure, the sharing of it, a platform or an exclusion starts
// or stops, there are two samples at the same place, one with each, so that the surfaces on
// either side meet.
// A platform the track graph splits in two along one track (where it takes the track to leave
// the platform for a short stretch, as at Karlaplan) is one platform, as along the other track.
const PLATFORM_JOIN = 45;
function joinPlatforms(list: GeometryPlatform[]): GeometryPlatform[] {
  const out: GeometryPlatform[] = [];
  for (const p of [...list].sort((a, b) => a.s0 - b.s0)) {
    const last = out[out.length - 1];
    if (last && last.station === p.station && last.side === p.side && last.island === p.island && p.s0 - last.s1 < PLATFORM_JOIN) {
      out[out.length - 1] = { ...last, s1: Math.max(last.s1, p.s1) };
    } else out.push(p);
  }
  return out;
}

// Along such a stretch the track graph finds no other track across the platform, so neither
// track shares the hall with the other there: in rock or concrete, where they share it on either
// side of a stretch along an island platform, they share it along it too, from one side's
// spacing to the other's.
function sharedHalls(g: GeometryPiece, platforms: GeometryPlatform[]): Pick<GeometryPiece, 'pair' | 'pairDy'> {
  const pair = [...g.pair], pairDy = [...g.pairDy];
  const inside = (k: number) => {
    const kind = STRUCTURE_KINDS[g.kind[k]];
    return (kind === 'rock' || kind === 'box') && platforms.some((p) => p.island && g.s[k] >= p.s0 && g.s[k] <= p.s1);
  };
  for (let k = 1; k < pair.length - 1; k++) {
    if (pair[k] || !pair[k - 1] || !inside(k)) continue;
    let e = k;
    while (e < pair.length && !pair[e] && inside(e)) e++;
    if (e < pair.length && pair[e] && Math.sign(pair[e]) === Math.sign(pair[k - 1])) {
      for (let j = k; j < e; j++) {
        const f = (g.s[j] - g.s[k - 1]) / (g.s[e] - g.s[k - 1]);
        pair[j] = pair[k - 1] + (pair[e] - pair[k - 1]) * f;
        pairDy[j] = pairDy[k - 1] + (pairDy[e] - pairDy[k - 1]) * f;
      }
    }
    k = e;
  }
  return { pair, pairDy };
}

function densify(g: GeometryPiece, dir: number, exclude: Exclusion[], yard: boolean): Sample[] {
  const platforms = joinPlatforms(g.platforms);
  g = { ...g, ...sharedHalls(g, platforms) };
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
    const plat = platforms.find((p) => se >= p.s0 && se <= p.s1) ?? null;
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
      const k0 = { yard, kind: STRUCTURE_KINDS[g.kind[i]], left: g.left[i], right: g.right[i], pair: g.pair[i] } as Sample;
      const k1 = { yard, kind: STRUCTURE_KINDS[g.kind[i + 1]], left: g.left[i + 1], right: g.right[i + 1], pair: g.pair[i + 1] } as Sample;
      if (bare(k0) !== bare(k1) || !widened(k0, -1) !== !widened(k1, -1) || !widened(k0, 1) !== !widened(k1, 1)) breaks.add(i + 0.5);
    }
    // where track no service runs on starts or stops sharing with a track beside it
    if (yard && g.left && g.right) {
      const k0 = { yard, kind: STRUCTURE_KINDS[g.kind[i]], left: g.left[i], right: g.right[i] } as Sample;
      const k1 = { yard, kind: STRUCTURE_KINDS[g.kind[i + 1]], left: g.left[i + 1], right: g.right[i + 1] } as Sample;
      if (!shares(k0, -1) !== !shares(k1, -1) || !shares(k0, 1) !== !shares(k1, 1)) breaks.add(i + 0.5);
    }
  }
  for (const p of platforms) for (const s of [p.s0, p.s1]) if (s > g.s[0] && s < g.s[n - 1]) breaks.add(qAt(s));
  for (const x of exclude) for (const s of [x.s0, x.s1]) if (s > g.s[0] && s < g.s[n - 1]) breaks.add(qAt(s));
  const qs: { q: number; twice: boolean }[] = [];
  for (let i = 0; i + 1 < n; i++) {
    const len = Math.hypot(g.x[i + 1] - g.x[i], g.z[i + 1] - g.z[i]);
    const m = Math.max(1, Math.round(len / STEP));
    for (let j = 0; j < m; j++) qs.push({ q: i + j / m, twice: false });
  }
  qs.push({ q: n - 1, twice: false });
  // a change takes the place of a sample already there (halfway between two points, it often
  // falls on one): with both, the samples there would go after, before, after the change, and
  // every surface would leave a gap up to the one before
  for (const q of breaks) {
    const k = qs.findIndex((e) => !e.twice && Math.abs(e.q - q) < 1e-6);
    if (k >= 0) qs.splice(k, 1);
    qs.push({ q, twice: true });
  }
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
