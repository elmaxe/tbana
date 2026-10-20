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
import type { BeamedHall, CaveIsland, CaveStyle, ConcreteHall, FlatHall, HallStyle, TiledHall, VaultFinish, VaultHall, VaultStyle } from './hall-styles';
import { OPEN_STYLES, hallDrawn } from './open-styles';
import type { OpenStyle, Paving } from './open-styles';
import { BULB, TUBE, addLamps, removeLamps, stripLamps } from './lamps';
import type { Lamp } from './lamps';
import { viaductInDetail, viaductSolids } from './detail/viaducts.ts';

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
const ISLAND_OVERLAP = 0.05; // and a paved island's halves by this either way
const GROUND_STRIP = 14; // open track: a strip of ground this far out from the track (without a city)
const SKIRT = 3;         // with a city: a bank's slope goes on this far below the ground
const POINT_CELL = 20;
// The light of the lamps (src/lamps.ts): the platforms' rows of tubes and the depot halls' lamps,
// per metre of row, and a tunnel's lamps, each; how far each lights.
const PLATFORM_LIGHT = { power: 1.7, reach: 16 };
const HALL_LIGHT = { power: 1.2, reach: 14 };
const TUNNEL_LAMP = { power: 2.5, reach: 9 };

type UV = [number, number];

interface Sample {
  x: number; y: number; z: number; // centre of the track at the top of the rails
  rx: number; rz: number;          // unit vector to the right of `from` → `to`
  along: number;                   // distance from the start of the piece, for textures
  s: number;                       // distance along the piece in the track graph
  kind: StructureKind;
  pair: number; pairDy: number;
  // another line's track sharing the structure on the other side, as in src/track-geometry.ts
  // (to the right; negative: to the left), or 0, and how much higher its rails are
  beside: number; besideDy: number;
  // the nearest other track on each side, as in src/track-geometry.ts (negative for a service's)
  left: number; right: number;
  yard: boolean;                   // track no service runs on: crossovers, sidings, depots
  ground: number | null;
  plat: GeometryPlatform | null;
  // a platform on the track's other side too (Liljeholmen's eastern track, between an island and
  // the platform along the bus terminal), drawn in a second pass with it as `plat`
  opposite: GeometryPlatform | null;
  third: 1 | -1;                   // the conductor rail's side
  skip: boolean;                   // the station draws it all
  noTrack: boolean;                // the station draws the track
  vault: boolean;                  // in a beamed hall's vaulted part (Medborgarplatsen's lengthening)
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
  | 'hallWall' | 'hallWallMirror' | 'hallCeiling' | 'hallColumn' | 'hallFloor' | 'fsWall' | 'fsCeiling' | 'fsColumn'
  | 'kpWall' | 'kpWallMirror' | 'kpFrieze' | 'kpVault' | 'kpFloor' | 'kpEdge' | 'kpBlock' | 'kpBlockTop' | 'kpBench'
  | 'vaultArt' | 'vaultArtMirror' | 'vaultWall' | 'vaultCeiling' | 'vaultFloor' | 'vaultEdge' | 'fitting'
  | 'stFloor' | 'stEdge' | 'stPlinth' | 'stCeiling' | 'stMesh' | 'stBand' | 'stRail'
  // a painted cave's rock, one for each station (src/hall-styles.ts), and the rock of its pillars
  // and of the walls over its passage, where it has them
  | `cave:${string}` | `pillar:${string}` | `fenced:${string}` | `portal${0 | 1}:${string}`
  // ... the fittings of an island cave not in Stadion's colours, and its dodecahedron and the
  // diagram in its floor (Tekniska högskolan's)
  | `st${'Mesh' | 'Fence' | 'Plinth' | 'Rail' | 'Glass' | 'Brass' | 'Inlay' | 'Ceiling' | 'Stripe0' | 'Stripe1'}:${string}`
  // ... Universitetet's track walls in Schein's tiles, one article on each, and its fittings
  | `stWall${number}:${string}` | `un${'Tiles' | 'Steel' | 'Bench' | 'Block' | 'End' | 'Teal' | 'Blue' | 'Render' | 'Sill'}:${string}`
  // ... Bergshamra's fittings: the lifts' block, steel, glass, the benches' pine and the stones
  // inlaid in its floor
  | `bh${'Lift' | 'Steel' | 'Glass' | 'Pine' | 'Inlay' | 'Photo' | 'Render'}:${string}`
  // ... Masmo's: the railing, the benches' pine, steel and blue posts
  | `ms${'White' | 'Pine' | 'Steel' | 'Blue'}:${string}`
  // a cave's panels of glass along its walls, the eastern's and the western's, and their backing
  | `glass${'E' | 'W'}:${string}` | 'glassBack'
  // a styled open station's paving and the face of its platform's edge (src/open-styles.ts)
  | `pave:${string}` | `face:${string}`
  // a beamed hall's walls (the other way round, for its name plates), ceiling and beams, columns,
  // the beam along its middle, the vault of its lengthening, the wall where that meets the flat
  // part and the triangle on it
  // (and the glass and steel frames of a window there; and the panels of expanded metal under a
  // ceiling, Danderyds sjukhus's)
  | `beam${'Wall' | 'WallMirror' | 'WallE' | 'WallMirrorE' | 'Ceiling' | 'Column' | 'Capital' | 'Along' | 'Vault' | 'End' | 'Mark' | 'EndWall' | 'Pane' | 'Frame' | 'Mesh'}:${string}`
  // a styled vault's own finish (Gärdet's): its track walls (the other way round, for the wall that
  // sees the track's direction the other way), the wall behind its platform, its vault, and the
  // wooden seats of its benches, and their stone bases (Mariatorget's)
  | `vault${'Art' | 'ArtMirror' | 'Back' | 'Roof' | 'RoofDark'}:${string}` | 'benchWood' | 'benchStone';

// The styled halls' surfaces (src/hall-styles.ts): Hötorget's, Farsta strand's, Karlaplan's and
// Östermalmstorg's.
const HOTORGET = HALL_STYLES['Hötorget'] as FlatHall, HT = HOTORGET.finish as TiledHall;
const FARSTA_STRAND = HALL_STYLES['Farsta strand'] as FlatHall;
const KARLAPLAN = HALL_STYLES['Karlaplan'] as VaultHall;
const OSTERMALMSTORG = VAULT_STYLES['Östermalmstorg'];

function materials() {
  const rock = T.tunnelRock(), concrete = T.concrete(9, 168), bed = T.trackBed(), platform = T.floorTiles();
  const plaster = T.plaster(), ceiling = T.stadionCeiling();
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
    hallWall: new THREE.MeshStandardMaterial({ map: T.hotorgetWall(HOTORGET.soffit - S.FLOOR, HT.tilesFrom - S.FLOOR, HT.plateAt - S.FLOOR), roughness: 0.8, side: THREE.DoubleSide }),
    hallWallMirror: new THREE.MeshStandardMaterial({ map: T.hotorgetWall(HOTORGET.soffit - S.FLOOR, HT.tilesFrom - S.FLOOR, HT.plateAt - S.FLOOR, true), roughness: 0.8, side: THREE.DoubleSide }),
    // (lit from below, by the lamps and the neon, which light nothing: so it glows a little)
    hallCeiling: new THREE.MeshStandardMaterial({ map: plaster, color: 0xe6e8e6, emissive: 0x8e918f, emissiveMap: plaster, roughness: 0.9, side: THREE.DoubleSide }),
    hallColumn: new THREE.MeshStandardMaterial({ map: T.hotorgetColumn(), roughness: 0.8 }),
    hallFloor: new THREE.MeshStandardMaterial({ map: T.clinker(), roughness: 0.8 }),
    // Farsta strand's: from the floor beside the track, the plinth to 0.7 m above the rails, the
    // rails at 1.05, 1.5 and 1.95, the beam from 3.25 to 3.65
    fsWall: new THREE.MeshStandardMaterial({ map: T.farstaStrandWall(FARSTA_STRAND.soffit - S.FLOOR, 0.7 - S.FLOOR, [1.05, 1.5, 1.95].map((h) => h - S.FLOOR), [3.25 - S.FLOOR, 3.65 - S.FLOOR]), roughness: 0.9, side: THREE.DoubleSide }),
    // (lit from below by its lamps, which light nothing: so it shows a little)
    fsCeiling: new THREE.MeshStandardMaterial({ map: T.perforatedCeiling(), emissive: 0x6a6a6a, emissiveMap: T.perforatedCeiling(), roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide }),
    fsColumn: new THREE.MeshStandardMaterial({ map: T.mosaicColumn(), roughness: 0.5 }),
    ...karlaplanMaterials(plaster),
    vaultArt: new THREE.MeshStandardMaterial({ map: T.derkertWall(S.FLOOR, OSTERMALMSTORG.spring), roughness: 0.95, side: THREE.DoubleSide }),
    vaultArtMirror: new THREE.MeshStandardMaterial({ map: T.derkertWall(S.FLOOR, OSTERMALMSTORG.spring, true), roughness: 0.95, side: THREE.DoubleSide }),
    vaultWall: new THREE.MeshStandardMaterial({ map: T.pittedWall(), roughness: 0.95, side: THREE.DoubleSide }),
    // (lit from below, by the lamps, which light nothing: so it glows a little, as the ceiling)
    vaultCeiling: new THREE.MeshStandardMaterial({ map: T.vaultPlaster(), color: 0xe8e8e5, emissive: 0x7d7e7b, emissiveMap: T.vaultPlaster(), roughness: 0.85, side: THREE.DoubleSide }),
    vaultFloor: new THREE.MeshStandardMaterial({ map: T.terrazzo(), roughness: 0.35 }),
    vaultEdge: new THREE.MeshStandardMaterial({ map: T.edgeBand(), roughness: 0.6 }),
    fitting: new THREE.MeshStandardMaterial({ color: 0xc4c6c7, roughness: 0.5, metalness: 0.3 }),
    benchWood: new THREE.MeshStandardMaterial({ color: 0xb98a4e, roughness: 0.6 }),
    benchStone: new THREE.MeshStandardMaterial({ color: 0x45474a, roughness: 0.45 }),
    glassBack: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.6 }),
    // Stadion's (src/hall-styles.ts)
    stFloor: new THREE.MeshStandardMaterial({ map: T.stadionFloor(), roughness: 0.3 }),
    stEdge: new THREE.MeshStandardMaterial({ map: T.stadionEdge(), roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -1 }),
    stPlinth: new THREE.MeshStandardMaterial({ map: T.stadionPlinth(), roughness: 0.4, side: THREE.DoubleSide }),
    // (lit by its tubes, which light nothing: so it shows a little)
    stCeiling: new THREE.MeshStandardMaterial({ map: ceiling, emissive: 0x6a6a6a, emissiveMap: ceiling, roughness: 0.7, side: THREE.DoubleSide }),
    stMesh: new THREE.MeshStandardMaterial({ map: T.stadionMesh(), roughness: 0.6, side: THREE.DoubleSide }),
    stBand: new THREE.MeshStandardMaterial({ color: 0xe6e6e2, roughness: 0.5, side: THREE.DoubleSide }),
    stRail: new THREE.MeshStandardMaterial({ color: 0x4fa595, roughness: 0.5, metalness: 0.2 }),
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
  // a styled vault's own: the plates with its ways out, and its lit cases
  private wayPlates = new Map<string, THREE.MeshBasicMaterial>();
  private caseMats: Record<string, THREE.MeshStandardMaterial[]> = {};
  private islands: Island[] = [];
  private islandArt = new Map<string, THREE.Material>();
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
    // (and what a landmark stands on a viaduct's platforms, src/detail/viaducts.ts)
    this.solids = [...solids, ...viaductSolids()];
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
      if (this.samples[k].some((sm) => sm.opposite)) this.addFloors(oppositeOf(this.samples[k]));
      piece.x.forEach((x, i) => {
        const key = `${Math.floor(x / POINT_CELL)},${Math.floor(piece.z[i] / POINT_CELL)}`;
        (this.points.get(key) ?? this.points.set(key, []).get(key)!).push({ x, y: piece.y[i], z: piece.z[i], kind: STRUCTURE_KINDS[piece.kind[i]] });
      });
    }
    this.junctionCuts();
    // the styled halls' neon, once for each, along one of its tracks
    const lit = new Set<string>();
    for (const samples of this.samples) {
      const first = samples.find((sm) => hallStyle(sm)?.kind === 'flat' && (hallStyle(sm) as FlatHall).neon);
      if (!first || lit.has(first.plat!.station)) continue;
      lit.add(first.plat!.station);
      this.group.add(neon(samples.filter((sm) => sm.plat === first.plat), hallStyle(first) as FlatHall, this.holes));
    }
    this.islands = islands(this.samples);
    for (const isl of this.islands) ISLANDS.set(isl.station, isl);
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
        removeLamps(t.group);
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
    const lamps: Lamp[] = [];
    for (const run of tile.runs) this.buildRun(run, b, group, lamps);
    for (const isl of this.islands) {
      if (`${Math.floor(isl.o.x / TILE)},${Math.floor(isl.o.z / TILE)}` === tile.key) this.buildIsland(isl, b, group, lamps);
    }
    addLamps(group, lamps);
    // the holes reaching into the tile (its runs reach a little beyond it)
    const m = 60, x0 = tile.cx - TILE / 2 - m, x1 = tile.cx + TILE / 2 + m, z0 = tile.cz - TILE / 2 - m, z1 = tile.cz + TILE / 2 + m;
    const near = (h: Volume) => h.max[0] > x0 && h.min[0] < x1 && h.max[2] > z0 && h.min[2] < z1;
    const holes = this.holes.filter(near), shellHoles = [...holes, ...this.shellCuts.filter(near)];
    for (const [name, builder] of Object.entries(b) as [MaterialName, MeshBuilder][]) {
      if (!builder.empty) group.add(new THREE.Mesh(builder.build(name === 'rock' || name === 'concrete' ? shellHoles : holes), this.mats[name]));
    }
    return group;
  }

  private buildRun({ samples, i0, i1 }: Run, b: Record<MaterialName, MeshBuilder>, group: THREE.Group, lamps: Lamp[]) {
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
    // (none under a hall a station draws itself: src/open-styles.ts)
    sweep(b.rock, run, (sm) => (sm.kind === 'rock' && !hallStyle(sm) && !vaultStyle(sm) && !caveStyle(sm) && !hallDrawn(sm.x, sm.z) ? shellOutline(sm) : null), { uScale: 0.25, vScale: 0.25 });
    // a painted cave: its rock, painted as that station's is (u up the wall and on over the roof,
    // v along the station, the same for both of its tracks)
    for (const station of new Set(run.filter((sm) => caveStyle(sm)).map((sm) => sm.plat!.station))) {
      const key: MaterialName = `cave:${station}`;
      this.mats[key] ??= this.caveMaterial(station);
      sweep(b[key] ??= new MeshBuilder(), run, (sm) => (caveStyle(sm) && sm.plat!.station === station ? shellOutline(sm) : null),
        { u: (u, v, _, sm) => caveAcross(sm, u, v) / T.CAVE_ACROSS, v: (u, v, sm) => caveAlong(sm, u, v) / T.CAVE_REPEAT });
    }
    sweep(b.concrete, run, (sm) => (sm.kind === 'box' && !hallStyle(sm) && !vaultStyle(sm) && !hallDrawn(sm.x, sm.z) ? shellOutline(sm) : null), { uScale: 0.25, vScale: 0.25 });
    // a styled vault: the wall across the track (its art drawn to be read from the platform), the
    // wall behind the platform, and the vault
    // (in Östermalmstorg's finish, or a station's own: its materials made the first time it is met)
    const vaultStations = new Set(run.filter((sm) => vaultStyle(sm)).map((sm) => sm.plat!.station));
    for (const station of vaultStations) {
      const vs = VAULT_STYLES[station], f = vs.finish;
      const mine = (sm: Sample) => vaultStyle(sm) !== null && sm.plat!.station === station;
      let art: [MeshBuilder, MeshBuilder] = [b.vaultArt, b.vaultArtMirror], back = b.vaultWall, roof = b.vaultCeiling;
      let artRepeat = T.DERKERT_REPEAT, backU = (_: number, v: number) => v / 2.4, backRepeat = 2.4;
      if (f) {
        this.vaultMaterials(station, vs, f);
        art = [b[`vaultArt:${station}`] ??= new MeshBuilder(), b[`vaultArtMirror:${station}`] ??= new MeshBuilder()];
        back = b[`vaultBack:${station}`] ??= new MeshBuilder();
        roof = b[`vaultRoof:${station}`] ??= new MeshBuilder();
        artRepeat = T.GARDET_REPEAT; backU = (_, v) => (v - S.FLOOR) / (vs.spring - S.FLOOR); backRepeat = 2 * f.backWall.panel;
      }
      // (the track wall up to a folded ceiling's foot over the track)
      const trackTop = vs.fold?.track ?? vs.spring;
      for (const [mb, side] of [[art[0], -1], [art[1], 1]] as const) {
        sweep(mb, run, (sm) => {
          if (!mine(sm) || sm.plat!.side !== side) return null;
          const [a, c] = structureSpan(sm), u = side > 0 ? a : c;
          return { key: 'art', pts: side > 0 ? [[u, S.FLOOR], [u, trackTop]] : [[u, trackTop], [u, S.FLOOR]] };
        }, { u: (_, v) => (v - S.FLOOR) / (trackTop - S.FLOOR), vScale: 1 / artRepeat });
      }
      sweep(back, run, (sm) => {
        if (!mine(sm)) return null;
        const [a, c] = structureSpan(sm), u = sm.plat!.side > 0 ? c : a;
        return { key: 'back', pts: sm.plat!.side > 0 ? [[u, vs.spring], [u, S.FLOOR]] : [[u, S.FLOOR], [u, vs.spring]] };
      }, { u: backU, vScale: 1 / backRepeat });
      if (vs.fold) {
        // a folded ceiling: the plane over the platform, and the one over the track (in a colour
        // of its own, if it has one), each from its wall to the ridge
        const fold = vs.fold, dark = f && fold.dark !== undefined ? b[`vaultRoofDark:${station}`] ??= new MeshBuilder() : roof;
        for (const [mb, overTrack] of [[roof, false], [dark, true]] as const) {
          sweep(mb, run, (sm) => {
            if (!mine(sm)) return null;
            const [a, c] = structureSpan(sm), side = sm.plat!.side, ridge = side * fold.ridge;
            const end = (side > 0) === overTrack ? a : c;
            const pts: [number, number][] = [[end, vaultRoof(vs, sm, a, c, end)], [ridge, fold.crown]];
            return { key: overTrack ? 'overTrack' : 'overPlatform', pts: end > ridge ? pts.reverse() : pts };
          }, { uScale: 0.25, vScale: 1 / 6 });
        }
      } else {
        sweep(roof, run, (sm) => {
          if (!mine(sm)) return null;
          const [a, c] = structureSpan(sm), n = 16;
          const pts: [number, number][] = [];
          for (let i = 0; i <= n; i++) { const u = a + ((c - a) * i) / n; pts.push([u, vaultRoof(vs, sm, a, c, u)]); }
          return { key: 'vault', pts };
        }, { uScale: 0.25, vScale: 1 / 6 });
      }
      const taken = f?.cases ? this.vaultCases(run, mine, f, b, group) : [];
      if (f?.benches) this.vaultBenches(run, mine, f, b, taken);
    }
    // a styled hall: its wall, and the roof over it (the wall is the outline's first two points
    // where the other track is to the right, its last two where it is to the left)
    // (a flat one by its finish)
    const styled = (kind: FlatHall['finish']['kind'] | VaultHall['kind']) => (sm: Sample) => {
      const st = hallStyle(sm);
      return (st?.kind === 'flat' ? st.finish.kind : st?.kind) === kind;
    };
    const halls = [
      { is: styled('tiles'), walls: [b.hallWall, b.hallWallMirror], roof: b.hallCeiling, top: HOTORGET.soffit, repeat: T.HOTORGET_REPEAT, overhead: 4 },
      { is: styled('concrete'), walls: [b.fsWall, b.fsWall], roof: b.fsCeiling, top: FARSTA_STRAND.soffit, repeat: T.FS_WALL_REPEAT, overhead: 2.4 },
      { is: styled('vault'), walls: [b.kpWall, b.kpWallMirror], roof: b.kpVault, top: KARLAPLAN.spring, repeat: T.KARLAPLAN_REPEAT, overhead: 4 },
    ];
    // (a beamed hall's, each its own)
    for (const station of new Set(run.filter((sm) => beamedHall(sm)).map((sm) => sm.plat!.station))) {
      const st = HALL_STYLES[station] as FlatHall, f = st.finish as BeamedHall, w = f.walls;
      const roof: MaterialName = `beamCeiling:${station}`;
      // (lit from below by its lamps, which light nothing: so it glows a little; board-marked
      // concrete, dark, a little less, unless painted white)
      if (!this.mats[roof]) {
        const plaster = f.boarded ? T.finish('boardConcrete') : T.plaster();
        const white = f.boarded && f.ceiling > 0xd00000, glow = f.boarded ? (white ? 0x9a9892 : 0x3c3b38) : 0x7a7870;
        this.mats[roof] = new THREE.MeshStandardMaterial({ map: plaster, color: white ? 0xffffff : f.ceiling, emissive: glow, emissiveMap: plaster, roughness: 0.9, side: THREE.DoubleSide });
      }
      const flat = (sm: Sample) => hallStyle(sm) === st && !sm.vault;
      // the walls: the same on both sides, or the eastern one's its own (the wall of the track
      // that doesn't lead, with the other track to its west)
      for (const [east, ws] of w.east ? [[false, w], [true, { ...w, ...w.east }]] as const : [[null, w]] as const) {
        const wall: MaterialName = `beamWall${east ? 'E' : ''}:${station}`;
        // (the other wall of a track sees its name plates the other way round)
        const mirror: MaterialName = ws.plate || ws.band ? `beamWallMirror${east ? 'E' : ''}:${station}` : wall;
        for (const [key, flip] of [[wall, false], [mirror, true]] as const) {
          this.mats[key] ??= new THREE.MeshStandardMaterial({
            map: T.beamedHallWall(st.soffit - S.FLOOR, ws.color, ws.tile, ws.from - S.FLOOR, { ...ws.posters, bottom: ws.posters.bottom - S.FLOOR },
              { top: ws.top, plate: ws.plate && { name: ws.plate.name, at: ws.plate.at - S.FLOOR }, mirror: flip, trees: ws.trees,
                enamel: ws.enamel && { ...ws.enamel, top: ws.enamel.top - S.FLOOR }, tilesTop: ws.tilesTop === undefined ? undefined : ws.tilesTop - S.FLOOR,
                band: ws.band && { ...ws.band, at: ws.band.at - S.FLOOR }, paintings: ws.paintings && { bottom: ws.paintings.bottom - S.FLOOR, top: ws.paintings.top - S.FLOOR },
                name: station }),
            roughness: 0.45, side: THREE.DoubleSide,
          });
        }
        const is = east === null ? flat : (sm: Sample) => flat(sm) && leads(sm) !== east;
        halls.push({ is, walls: [b[wall] ??= new MeshBuilder(), b[mirror] ??= new MeshBuilder()], roof: b[roof] ??= new MeshBuilder(), top: st.soffit, repeat: T.beamedWallRepeat(ws.posters), overhead: 2.4 });
      }
      const wall: MaterialName = `beamWall:${station}`, repeat = T.beamedWallRepeat(w.posters);
      // panels of expanded metal hung under the ceiling from edge to edge of the platform, and a
      // beam along each edge, down to them (drawn with one of the two tracks)
      if (f.mesh) {
        const key: MaterialName = `beamMesh:${station}`, below = f.mesh.below;
        if (!this.mats[key]) {
          const mesh = T.meshCeiling();
          this.mats[key] = new THREE.MeshStandardMaterial({ map: mesh, emissive: 0x58595b, emissiveMap: mesh, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide });
        }
        const edge = (sm: Sample, k: 0 | 1) => (k === 0 ? Math.sign(sm.pair) * S.PLATFORM_EDGE : sm.pair - Math.sign(sm.pair) * S.PLATFORM_EDGE);
        sweep(b[key] ??= new MeshBuilder(), run, (sm) => {
          if (!flat(sm) || !leads(sm)) return null;
          const v = st.ceiling - below + sm.pairDy / 2;
          return { key: 'mesh', pts: [[edge(sm, 0), v], [edge(sm, 1), v]] };
        }, { uScale: 1 / 1.8, vScale: 1 / 2.5 });
        for (const k of [0, 1] as const) {
          sweep(b[roof], run, (sm) => {
            if (!flat(sm) || !leads(sm)) return null;
            const u = edge(sm, k), top = st.ceiling + sm.pairDy / 2, v = top - below - 0.08, d = Math.sign(sm.pair) * (k === 0 ? 1 : -1) * 0.3;
            return { key: `meshBeam${k}`, pts: [[u - d, top], [u - d, v], [u, v], [u, top]] };
          }, { uScale: 1 / 2.4, vScale: 1 / 2.4 });
        }
      }
      // a beam along under the ceiling over each row of columns, in their finish, where there are
      // two rows (each track's over its own)
      if (f.rowBeams) {
        const key: MaterialName = `beamColumn:${station}`, { width, depth } = f.rowBeams;
        this.mats[key] ??= beamColumnMaterial(f);
        sweep(b[key] ??= new MeshBuilder(), run, (sm) => {
          if (!flat(sm)) return null;
          const u = sm.plat!.side * (S.PLATFORM_EDGE + st.columns.fromEdge), v = st.ceiling + sm.pairDy / 2;
          return { key: 'row', pts: [[u - width / 2, v], [u - width / 2, v - depth], [u + width / 2, v - depth], [u + width / 2, v]] };
        }, { uScale: 1 / T.HOTORGET_REPEAT, vScale: 1 / T.HOTORGET_REPEAT });
      }
      // the vaulted part, its walls the same, its vault in panels (lit as the ceiling is)
      if (f.vault) {
        const vault: MaterialName = `beamVault:${station}`;
        if (!this.mats[vault]) {
          const panels = f.vault.boarded ? T.finish('boardConcrete') : T.vaultPanels(f.vault.color);
          this.mats[vault] = f.vault.boarded
            ? new THREE.MeshStandardMaterial({ map: panels, color: f.vault.color, emissive: 0x4a4946, emissiveMap: panels, roughness: 0.9, side: THREE.DoubleSide })
            : new THREE.MeshStandardMaterial({ map: panels, emissive: 0x6e6c66, emissiveMap: panels, roughness: 0.6, side: THREE.DoubleSide });
        }
        halls.push({ is: (sm) => hallStyle(sm) === st && sm.vault, walls: [b[wall], b[wall]], roof: b[vault] ??= new MeshBuilder(), top: st.soffit, repeat, overhead: 2.4 });
      }
      // the beam along over the row of columns, drawn with one of the two tracks (in a colour of
      // its own, or the ceiling's), where the hall has beams
      if (!f.beams) continue;
      const { depth, along } = f.beams;
      let beam = b[roof];
      if (f.beams.color !== undefined) {
        const key: MaterialName = `beamAlong:${station}`;
        this.mats[key] ??= new THREE.MeshStandardMaterial({ color: f.beams.color, roughness: 0.5 });
        beam = b[key] ??= new MeshBuilder();
      }
      sweep(beam, run, (sm) => {
        if (!flat(sm) || !leads(sm)) return null;
        const m = sm.pair / 2, v = st.soffit + sm.pairDy / 2;
        return { key: 'along', pts: [[m - along / 2, v], [m - along / 2, v - 2 * depth], [m + along / 2, v - 2 * depth], [m + along / 2, v]] };
      }, { uScale: 1 / 2.4, vScale: 1 / 2.4 });
    }
    for (const { is, walls, roof, top, repeat, overhead } of halls) {
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
      }, { uScale: 1 / overhead, vScale: 1 / overhead });
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
    // where the track sharing the tunnel on that side is lower (as where the lines part for
    // T-Centralen's two levels), the step down to its floor at the middle
    for (const side of [-1, 1]) {
      sweep(b.concrete, run, (sm) => {
        if ((sm.kind !== 'rock' && sm.kind !== 'box') || inHall(sm) || hallStyle(sm)) return null;
        const dy = Math.sign(sm.pair) === side ? sm.pairDy : Math.sign(sm.beside) === side ? sm.besideDy : 0;
        if (dy > -0.05) return null;
        const [a, c] = ownSpan(sm, structureSpan(sm)), f = S.FLOOR;
        return { key: 'step', pts: side < 0 ? [[a, f + dy], [a, f]] : [[c, f], [c, f + dy]] };
      }, { uScale: 0.25, vScale: 0.25 });
    }
    this.openStructure(run, b);
    this.islandHall(run, b, group);
    this.platforms(run, b, group, lamps);
    if (run.some((sm) => sm.opposite)) this.platforms(oppositeOf(run), b, group, lamps);
    this.columns(samples, run, b, group);
    this.posters(samples, run, group);
    this.blocks(samples, run, b, group);
    this.lights(run, b, lamps);
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
      // bridge deck edge girder and its railing, and the deck's underside: to the middle, or where
      // the deck is shared on the other side, to that end of this track's part
      sweep(b.concrete, run, (sm) => {
        if (sm.kind !== 'bridge' || !outer(sm)) return null;
        const u = side * S.BRIDGE.deck, bottom = S.FLOOR - S.BRIDGE.depth;
        const own = ownSpan(sm, structureSpan(sm)), inner = continues(sm, -side) ? own[side < 0 ? 1 : 0] : 0;
        return { key: 'deck', pts: [[u, S.FLOOR], [u, S.FLOOR + 0.3], [u + side * 0.25, S.FLOOR + 0.3], [u + side * 0.25, bottom], [inner, bottom]] };
      }, { uScale: 0.25, vScale: 0.25 });
      sweep(b.steel, run, (sm) => {
        // (a viaduct drawn in detail has its own, src/detail/viaducts.ts)
        if (sm.kind !== 'bridge' || !outer(sm) || viaductInDetail(sm.x, sm.z)) return null;
        const u = side * (S.BRIDGE.deck + 0.12), top = S.FLOOR + S.BRIDGE.railing;
        return { key: 'rail', pts: [[u, top - 0.08], [u, top], [u + side * 0.06, top]] };
      });
    }
    // the underside of a deck shared on both sides, under this track's part
    sweep(b.concrete, run, (sm) => {
      if (sm.kind !== 'bridge' || !continues(sm, -1) || !continues(sm, 1)) return null;
      const [a, c] = ownSpan(sm, structureSpan(sm)), bottom = S.FLOOR - S.BRIDGE.depth;
      return { key: 'under', pts: [[c, bottom], [a, bottom]] };
    }, { uScale: 0.25, vScale: 0.25 });
    // bridge piers, every 20 m or so, down to the ground (a viaduct drawn in detail has its own)
    let last = -Infinity;
    for (const sm of run) {
      if (sm.kind !== 'bridge' || sm.ground === null || sm.along - last < 20 || viaductInDetail(sm.x, sm.z)) continue;
      last = sm.along;
      const bottom = sm.y + S.FLOOR - S.BRIDGE.depth;
      if (sm.ground > bottom - 0.5) continue;
      const [a, c] = sm.pair || sm.beside ? ownSpan(sm, [-S.BRIDGE.deck, S.BRIDGE.deck]) : [-S.BRIDGE.deck, S.BRIDGE.deck];
      const w = (c - a) * 0.8, mid = (a + c) / 2;
      // into the city's ground, which may lie a little lower than the line's
      const foot = sm.ground - (this.city ? 3 : 0);
      box(b.concrete, at(sm, mid, 0).setY((bottom + foot) / 2), sm, w, bottom - foot, 1.4);
    }
  }

  private platforms(run: Sample[], b: Record<MaterialName, MeshBuilder>, group: THREE.Group, lamps: Lamp[]) {
    const H = S.PLATFORM_HEIGHT;
    for (const [mb, kind] of [[b.platform, null], [b.hallFloor, 'flat'], [b.kpFloor, 'vault']] as const) sweep(mb, run, (sm) => {
      const p = sm.plat;
      if (!p || (hallStyle(sm)?.kind ?? null) !== kind || vaultStyle(sm) || islandStyle(sm) || pavingOf(sm)) return null;
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
      if (!p || !vaultStyle(sm) || pavingOf(sm)) return null;
      const i = p.side * (S.PLATFORM_EDGE + T.EDGE_BAND), o = platformOuter(sm);
      return { key: `t${p.side}`, pts: p.side > 0 ? [[i, H], [o, H], [o, S.FLOOR]] : [[o, S.FLOOR], [o, H], [i, H]] };
    }, { uScale: 0.5, vScale: 0.5 });
    sweep(b.concrete, run, (sm) => {
      const p = sm.plat;
      if (!p || !vaultStyle(sm) || pavingOf(sm)) return null;
      const e = p.side * S.PLATFORM_EDGE;
      return { key: `f${p.side}`, pts: p.side > 0 ? [[e, S.FLOOR], [e, H]] : [[e, H], [e, S.FLOOR]] };
    }, { uScale: 0.25, vScale: 0.25 });
    sweep(b.vaultEdge, run, (sm) => {
      const p = sm.plat;
      if (!p || !vaultStyle(sm) || pavingOf(sm)) return null;
      const e = p.side * S.PLATFORM_EDGE, i = p.side * (S.PLATFORM_EDGE + T.EDGE_BAND);
      return { key: `e${p.side}`, pts: p.side > 0 ? [[e, H], [i, H]] : [[i, H], [e, H]] };
    }, { u: (u) => (Math.abs(u) - S.PLATFORM_EDGE) / T.EDGE_BAND, vScale: 1 / T.EDGE_REPEAT });
    // an island cave's (Stadion's): dark stone, with a band of pale stone along the edge
    sweep(b.stFloor, run, (sm) => {
      const p = sm.plat;
      if (!p || !islandStyle(sm) || pavingOf(sm)) return null;
      const e = p.side * S.PLATFORM_EDGE, o = platformOuter(sm);
      return { key: `p${p.side}`, pts: p.side > 0 ? [[e, S.FLOOR], [e, H], [o, H], [o, S.FLOOR]] : [[o, S.FLOOR], [o, H], [e, H], [e, S.FLOOR]] };
    }, { uScale: 0.5, vScale: 0.5 });
    sweep(b.stEdge, run, (sm) => {
      const p = sm.plat;
      if (!p || !islandStyle(sm) || pavingOf(sm)) return null;
      const u0 = p.side * S.PLATFORM_EDGE, u1 = p.side * (S.PLATFORM_EDGE + ISLAND_EDGE);
      return { key: `e${p.side}`, pts: p.side > 0 ? [[u0, H + 0.002], [u1, H + 0.002]] : [[u1, H + 0.002], [u0, H + 0.002]] };
    }, { uScale: 0.5, vScale: 0.5 });
    // a styled open station's, or a flat hall's in concrete: its paving, mapped across from the
    // edge (on an island, each track's half out to the line down its middle), and the face of its
    // edge
    for (const station of new Set(run.filter((sm) => pavingOf(sm)).map((sm) => sm.plat!.station))) {
      const pave: MaterialName = `pave:${station}`, face: MaterialName = `face:${station}`;
      const paving = pavingOf(run.find((sm) => pavingOf(sm) && sm.plat!.station === station)!)!;
      this.mats[pave] ??= new THREE.MeshStandardMaterial({ map: T.openPaving(paving), roughness: 0.85 });
      this.mats[face] ??= new THREE.MeshStandardMaterial({ map: T.platformFace(paving.colors.face), roughness: 0.6, side: THREE.DoubleSide });
      const mine = (sm: Sample) => pavingOf(sm) && sm.plat!.station === station;
      sweep(b[pave] ??= new MeshBuilder(), run, (sm) => {
        if (!mine(sm)) return null;
        const p = sm.plat!, e = p.side * S.PLATFORM_EDGE, v = across(sm), o = v ? v / 2 : platformOuter(sm);
        // (one out to a middle track: to halfway, and the far half from that track's edge, below)
        if (p.reach) return { key: `h${p.side}`, pts: p.side > 0 ? [[e, H], [(e + o) / 2, H]] : [[(e + o) / 2, H], [e, H]] };
        // (an island's halves overlap at its middle, one a hair over the other: where its tracks
        // splay apart, as at Bredäng, their edges swept along each track don't quite meet)
        const m = v ? o + p.side * ISLAND_OVERLAP : o, top = v && p.side > 0 ? H + 0.002 : H;
        return { key: `p${p.side}`, pts: p.side > 0 ? [[e, top], [m, top], [m, S.FLOOR]] : [[m, S.FLOOR], [m, top], [e, top]] };
      }, { u: (u) => (Math.abs(u) - S.PLATFORM_EDGE) / T.PAVING_ACROSS, vScale: 1 / T.pavingRepeat(paving) });
      sweep(b[pave], run, (sm) => {
        if (!mine(sm) || !sm.plat!.reach) return null;
        const p = sm.plat!, o = platformOuter(sm), m = (p.side * S.PLATFORM_EDGE + o) / 2;
        return { key: `r${p.side}`, pts: p.side > 0 ? [[m, H], [o, H]] : [[o, H], [m, H]] };
      }, { u: (u, _, __, sm) => (Math.abs(platformOuter(sm)) - Math.abs(u)) / T.PAVING_ACROSS, vScale: 1 / T.pavingRepeat(paving) });
      sweep(b[face] ??= new MeshBuilder(), run, (sm) => {
        if (!mine(sm)) return null;
        const e = sm.plat!.side * S.PLATFORM_EDGE;
        return { key: `f${sm.plat!.side}`, pts: sm.plat!.side > 0 ? [[e, S.FLOOR], [e, H]] : [[e, H], [e, S.FLOOR]] };
      }, { u: (_, v) => (v - S.FLOOR) / (H - S.FLOOR), vScale: 1 / T.FACE_REPEAT });
      sweep(b[face], run, (sm) => {
        if (!mine(sm) || !sm.plat!.reach) return null;
        const o = platformOuter(sm);
        return { key: `g${sm.plat!.side}`, pts: sm.plat!.side > 0 ? [[o, H], [o, S.FLOOR]] : [[o, S.FLOOR], [o, H]] };
      }, { u: (_, v) => (v - S.FLOOR) / (H - S.FLOOR), vScale: 1 / T.FACE_REPEAT });
    }
    sweep(b.yellow, run, (sm) => {
      const p = sm.plat;
      if (!p || vaultStyle(sm) || pavingOf(sm)) return null;
      // (in an island cave, along the inner side of its pale band)
      const from = islandStyle(sm) ? ISLAND_EDGE : 0.3;
      const u0 = p.side * (S.PLATFORM_EDGE + from), u1 = p.side * (S.PLATFORM_EDGE + from + 0.12);
      return { key: `y${p.side}`, pts: p.side > 0 ? [[u0, H + 0.004], [u1, H + 0.004]] : [[u1, H + 0.004], [u0, H + 0.004]] };
    });
    // station name signs on the wall across the track, and lights over the platform edge, which
    // light the station where it is underground
    let lastSign = -Infinity;
    const row = new LampRow(lamps, PLATFORM_LIGHT, TUBE, 1);
    for (const sm of run) {
      const p = sm.plat;
      if (!p || (sm.kind !== 'rock' && sm.kind !== 'box')) row.end();
      if (!p) continue;
      const vs = vaultStyle(sm);
      if (vs?.finish && sm.along - lastSign >= vs.signEvery) {
        // a styled vault's own: the name on the band, and the ways out either side of it (none in
        // the openings to the passages through the wall)
        if (this.vaultSign(sm, vs, group)) lastSign = sm.along;
      } else if (vs && sm.along - lastSign >= vs.signEvery) {
        // a styled vault's: white, on the wall behind the platform
        lastSign = sm.along;
        const back = structureSpan(sm)[p.side > 0 ? 1 : 0];
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.4), this.signMaterial(p.station, true));
        sign.position.copy(at(sm, back - p.side * 0.05, vs.signAt));
        sign.lookAt(at(sm, back - p.side * 1.05, vs.signAt));
        group.add(sign);
      } else if (!vs && sm.along - lastSign >= (caveStyle(sm)?.signs?.every ?? 30)) {
        lastSign = sm.along;
        const span = structureSpan(sm);
        const wall = p.side > 0 ? span[0] : span[1];
        if (caveStyle(sm)?.signs) {
          // a cave's own: dark grey, hung across the platform under the fitting over its edge
          const [a, c] = span, u = p.side * (S.PLATFORM_EDGE + 0.7);
          const roof = S.archHeight(a, c, S.HALL.spring, (c - a) * S.HALL.risePerWidth, u), v = Math.min(roof - CAVE_ROUGH - 0.4, H + 3.2);
          const t = new THREE.Vector3(sm.rz, 0, -sm.rx), o = at(sm, u, v - 0.42);
          for (const d of [1, -1]) {
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.5), this.signMaterial(p.station, 'dark'));
            sign.position.copy(o).addScaledVector(t, d * 0.01);
            sign.lookAt(o.clone().addScaledVector(t, d));
            group.add(sign);
          }
          for (const d of [-0.7, 0.7]) box(b.fitting, at(sm, u + d, v - 0.085), sm, 0.012, 0.17, 0.012);
        }
        // (a styled hall has its own name plates)
        else if ((sm.kind === 'rock' || sm.kind === 'box') && !hallStyle(sm) && !islandStyle(sm) && !openStyle(sm)) {
          // (on a painted cave's rock, where it is)
          const w = caveStyle(sm) ? wall - Math.sign(wall) * caveInward(sm, wall, 2.4) : wall;
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.68), this.signMaterial(p.station));
          sign.position.copy(at(sm, w + p.side * 0.06, 2.4));
          sign.lookAt(at(sm, w + p.side * 1.06, 2.4));
          group.add(sign);
        }
      }
      // the light of its row of lamps, wherever the hall has them
      let light = at(sm, p.side * (S.PLATFORM_EDGE + 1.2), H + 2.6);
      const concrete = concreteHall(sm);
      // (in a vaulted hall, a nearly unbroken row along its crown)
      if (hallStyle(sm)?.kind === 'vault') {
        light = at(sm, sm.pair / 2, (hallStyle(sm) as VaultHall).crown + sm.pairDy / 2 - 0.06);
        if (sm.pair > 0) box(b.lamp, at(sm, sm.pair / 2, (hallStyle(sm) as VaultHall).crown + sm.pairDy / 2 - 0.06), sm, 0.26, 0.08, STEP - 0.35);
      } else if (concrete && sm.vault && concrete.finish.kind === 'beams' && concrete.finish.vault) {
        // (in a beamed hall's vaulted part, a row either side of its middle on a rail under the
        // vault)
        const vault = concrete.finish.vault, [a, c] = structureSpan(sm), u = sm.pair / 2 - Math.sign(sm.pair) * vault.lamps;
        const v = S.archHeight(a, c, concrete.soffit, vault.crown - concrete.soffit, u) + sm.pairDy / 2 - 0.45;
        box(b.fitting, at(sm, u, v + 0.06), sm, 0.12, 0.08, STEP + 0.02);
        box(b.lamp, light = at(sm, u, v - 0.006), sm, 0.12, 0.012, STEP - 0.5);
        if (Math.round(sm.along / STEP) % 2 === 0) box(b.fitting, at(sm, u, v + 0.32), sm, 0.03, 0.45, 0.03);
      } else if (concrete && concrete.finish.kind === 'beams' && concrete.finish.mesh) {
        // (under a mesh ceiling, a tube lamp across the platform in its channel at every
        // cross-section, drawn with one of the two tracks)
        const v = concrete.ceiling - concrete.finish.mesh.below + sm.pairDy / 2, w = Math.abs(sm.pair) - 2 * S.PLATFORM_EDGE - 0.4;
        if (leads(sm)) {
          box(b.fitting, at(sm, sm.pair / 2, v - 0.03), sm, w, 0.06, 0.14);
          box(b.lamp, at(sm, sm.pair / 2, v - 0.066), sm, w - 0.1, 0.012, 0.07);
        }
        light = at(sm, p.side * (S.PLATFORM_EDGE + 1.2), v - 0.1);
      } else if (concrete && concrete.finish.kind === 'beams' && !concrete.finish.beams) {
        // (in a tiled hall with no beams, tube lamps in the soffit over the platform's edge, nearly
        // end to end)
        const u = p.side * (S.PLATFORM_EDGE + 0.3), v = concrete.soffit + sm.pairDy / 2;
        box(b.fitting, at(sm, u, v - 0.05), sm, 0.2, 0.1, STEP - 0.25);
        box(b.lamp, light = at(sm, u, v - 0.106), sm, 0.12, 0.012, STEP - 0.4);
      } else if (concrete) {
        // (in a flat hall in concrete, fittings hung just under the ceiling over the platform's
        // edge, nearly end to end)
        // (in a beamed one, under its beams)
        const f = concrete.finish, u = p.side * (S.PLATFORM_EDGE + 0.5);
        const top = concrete.soffit - (f.kind === 'beams' ? f.beams!.depth : 0), v = top - 0.32;
        box(b.fitting, at(sm, u, v + 0.05), sm, 0.24, 0.1, STEP - 0.6);
        box(b.lamp, light = at(sm, u, v - 0.006), sm, 0.16, 0.012, STEP - 0.7);
        box(b.fitting, at(sm, u, (v + 0.1 + top) / 2), sm, 0.03, top - v - 0.1, 0.03);
      } else if (Math.round(sm.along / STEP) % 2 === 0) {
        // (in a styled hall, troffers in the soffit)
        const st = hallStyle(sm);
        if (st?.kind === 'flat') box(b.lamp, light = at(sm, p.side * (S.PLATFORM_EDGE + 0.8), st.soffit - 0.02), sm, 0.3, 0.04, 2.2);
        // (a styled open station's hang under its roof: src/stations.ts)
        else if (!vs && !caveStyle(sm) && !islandStyle(sm) && !openStyle(sm) && !viaductInDetail(sm.x, sm.z)) box(b.lamp, at(sm, p.side * (S.PLATFORM_EDGE + 1.2), H + 2.6), sm, 0.12, 0.06, 2.2);
      }
      const glass = caveStyle(sm)?.glass;
      if (glass && sm.kind === 'rock') {
        // a cave's panels of glass along the wall across the track, each a sample long, its
        // colour from how far it is along the wall from its northern end
        const span = structureSpan(sm), wall = p.side > 0 ? span[0] : span[1], east = sm.rx * wall > 0;
        const n = Math.max(1, Math.round((p.s1 - p.s0) / STEP)), f = (sm.s - p.s0) / (p.s1 - p.s0);
        const k = Math.max(0, Math.min(n - 1, Math.floor((-sm.rx < 0 ? 1 - f : f) * n)));
        const key: MaterialName = `glass${east ? 'E' : 'W'}:${p.station}`;
        this.mats[key] ??= new THREE.MeshBasicMaterial({ map: T.caveGlass(east ? glass.east : glass.west, n), side: THREE.DoubleSide });
        const t = new THREE.Vector3(sm.rz, 0, -sm.rx), l = STEP / 2 - 0.015, u = wall + p.side * 0.5;
        const P = (d: number, v: number) => at(sm, u, v).addScaledVector(t, d);
        (b[key] ??= new MeshBuilder()).quad(P(-l, glass.from), P(l, glass.from), P(l, glass.to), P(-l, glass.to), [k / n, 0], [(k + 1) / n, 0], [(k + 1) / n, 1], [k / n, 1]);
        box(b.glassBack, at(sm, wall + p.side * 0.24, (glass.from + glass.to) / 2), sm, 0.48, glass.to - glass.from + 0.08, STEP - 0.005);
        box(b.fitting, at(sm, wall + p.side * 0.32, glass.from - 0.07), sm, 0.64, 0.06, STEP - 0.005);
      }
      if (caveStyle(sm) && !islandStyle(sm)) {
        // in a painted cave, a row of fittings hung on rods well under the rock, over the
        // platform's edge
        const [a, c] = structureSpan(sm), u = p.side * (S.PLATFORM_EDGE + 0.7);
        const roof = S.archHeight(a, c, S.HALL.spring, (c - a) * S.HALL.risePerWidth, u), v = Math.min(roof - CAVE_ROUGH - 0.4, H + 3.2);
        box(b.fitting, at(sm, u, v + 0.04), sm, 0.3, 0.08, 2.2);
        box(b.lamp, light = at(sm, u, v - 0.005), sm, 0.24, 0.02, 2.1);
        box(b.fitting, at(sm, u, (v + roof) / 2), sm, 0.03, roof - v, 0.03);
      }
      if (vs) {
        // in a styled vault, a row of fittings hung under it over the platform's edge, nearly end
        // to end
        const [a, c] = structureSpan(sm), u = p.side * (S.PLATFORM_EDGE + 0.6);
        const v = vaultRoof(vs, sm, a, c, u) - 0.3;
        box(b.fitting, at(sm, u, v + 0.04), sm, 0.34, 0.08, 2.2);
        box(b.lamp, light = at(sm, u, v - 0.005), sm, 0.28, 0.02, 2.1);
        box(b.fitting, at(sm, u, v + 0.2), sm, 0.04, 0.24, 0.04);
      }
      // (a vaulted hall's one row is the right-hand track's)
      if ((sm.kind === 'rock' || sm.kind === 'box') && !(hallStyle(sm)?.kind === 'vault' && sm.pair < 0)) row.add(sm, light, p);
    }
    row.end();
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
      const h = j === 1 ? (st.finish as TiledHall).plateAt : ps.at;
      m.position.copy(at(sm, wall + p.side * 0.02, h)).addScaledVector(left, -k * ps.apart);
      m.lookAt(at(sm, wall + p.side, h).addScaledVector(left, -k * ps.apart));
      group.add(m);
    });
  }

  // A styled hall's row of columns along this track's side of the platform, or down its middle,
  // evenly spaced and centred on it (`all` is the piece's samples, `run` the stretch being built);
  // in a hall in concrete, the station's name hung between them now and then.
  private columns(all: Sample[], run: Sample[], b: Record<MaterialName, MeshBuilder>, group: THREE.Group) {
    const first = run.find((sm) => hallStyle(sm)?.kind === 'flat');
    if (!first) return;
    const st = hallStyle(first) as FlatHall, p = first.plat!, { fromEdge, size, spacing, round, middle, near } = st.columns;
    // (one row down the middle: along one of the two tracks)
    if (middle && !leads(first)) return;
    // (none in a beamed hall's vaulted part)
    const all_ = all.filter((sm) => sm.plat === p), on = all_.filter((sm) => !sm.vault);
    const a0 = on[0].along, a1 = on[on.length - 1].along;
    const n = Math.floor((a1 - a0 - 2 * spacing / 2) / spacing);
    const start = a0 + (a1 - a0 - n * spacing) / 2;
    // where along this run, and the sample there (in the vaulted part too, with `vault`)
    const sampleAt = (t: number, vault = false) => {
      // (half open, as the next run starts on this one's last sample)
      const i = run.findIndex((sm, j) => j + 1 < run.length && sm.along <= t && run[j + 1].along > t);
      if (i < 0 || run[i].plat !== p || (run[i].vault && !vault)) return null;
      const sa = run[i], sb = run[i + 1], f = (t - sa.along) / (sb.along - sa.along || 1);
      return { ...sa, x: sa.x + (sb.x - sa.x) * f, y: sa.y + (sb.y - sa.y) * f, z: sa.z + (sb.z - sa.z) * f, pair: sa.pair + (sb.pair - sa.pair) * f };
    };
    const across = (sm: Sample) => (middle ? sm.pair / 2 : p.side * (S.PLATFORM_EDGE + fromEdge));
    // where the stairs or escalators come down into the hall, round (u, v) and `h` either way
    const open = (sm: Sample, u: number, h: number, v: number) => [-1, 1].some((i) => [-1, 1].some((k) => {
      const q = at(sm, u + i * h, v);
      return this.holes.some((o) => insideVolume(o, q.x + sm.rz * k * h, q.y, q.z - sm.rx * k * h));
    }));
    const f = st.finish;
    let column = f.kind === 'concrete' ? b.fsColumn : b.hallColumn;
    if (f.kind === 'beams') {
      // (enamelled, ringed with colours, or tiled, where it is)
      const key: MaterialName = `beamColumn:${p.station}`;
      this.mats[key] ??= beamColumnMaterial(f);
      column = b[key] ??= new MeshBuilder();
    }
    // (a row down the middle stands under the ceiling, where the roof steps up, as do rows the
    // roof steps up outside)
    const top = middle || st.stepOutside ? st.ceiling : st.soffit;
    for (let k = 0; k <= n; k++) {
      const sm = sampleAt(start + k * spacing);
      if (!sm || (near && Math.hypot(sm.x - near.at[0], sm.z - near.at[1]) > near.reach)) continue;
      const u = across(sm);
      // none where the stairs or escalators come down into the hall
      if (open(sm, u, size / 2, S.PLATFORM_HEIGHT + 1) || open(sm, u, size / 2, st.soffit - 0.05)) continue;
      // (up to its capital, where it has one)
      const capital = f.kind === 'beams' ? f.capitals : undefined, shaftTop = capital ? capital.from : top;
      if (round) roundPillar(column, at(sm, u, 0), size, S.PLATFORM_HEIGHT, shaftTop + sm.pairDy / 2);
      else pillar(column, at(sm, u, 0), sm, size, S.PLATFORM_HEIGHT, shaftTop + sm.pairDy / 2);
      if (capital) {
        // a white cone spreading from it into the ceiling
        this.mats[`beamCapital:${p.station}`] ??= new THREE.MeshStandardMaterial({ color: 0xf2f1ec, emissive: 0x7c7b77, roughness: 0.8, side: THREE.DoubleSide });
        const h = top - capital.from, cone = new THREE.Mesh(new THREE.CylinderGeometry(capital.head / 2, size * 0.72, h, 40, 1, true), this.mats[`beamCapital:${p.station}`]);
        cone.position.copy(at(sm, u, capital.from + h / 2 + sm.pairDy / 2));
        group.add(cone);
      }
      if (f.kind === 'beams' && f.beams && !f.rings) {
        // a steel ring at its foot, and a collar under the beam
        roundPillar(b.fitting, at(sm, u, 0), size + 0.04, S.PLATFORM_HEIGHT, S.PLATFORM_HEIGHT + 0.14);
        roundPillar(column, at(sm, u, 0), size + 0.08, st.soffit - 2 * f.beams.depth - 0.12, st.soffit - 2 * f.beams.depth);
      }
      if (f.kind === 'beams' && f.lamps) {
        // round lamps on the ceiling either side of it, across the platform
        for (const d of [-1, 1]) {
          const c = at(sm, u + d * f.lamps.off, top + sm.pairDy / 2 - 0.06);
          const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.1, 20), this.mats.lamp);
          dome.position.copy(c);
          group.add(dome);
        }
      }
    }
    if (f.kind === 'beams' && f.troffers && !middle && first.pair > 0) {
      // fittings recessed down the middle of the ceiling between the rows, two to each gap
      // between the columns (drawn with one of the two tracks)
      const [w, l] = f.troffers.size;
      for (let k = 0; k < 2 * n; k++) {
        const sq = sampleAt(start + ((k + 0.5) * spacing) / 2);
        if (!sq || open(sq, sq.pair / 2, l / 2, st.ceiling - 0.05)) continue;
        box(b.fitting, at(sq, sq.pair / 2, st.ceiling + sq.pairDy / 2 - 0.015), sq, w + 0.1, 0.03, l + 0.1);
        box(b.lamp, at(sq, sq.pair / 2, st.ceiling + sq.pairDy / 2 - 0.035), sq, w - 0.15, 0.012, l - 0.15);
      }
    }
    if (f.kind === 'beams' && f.beams && f.beams.between !== null) {
      // the beams across the hall, from wall to wall: over every column and so many between two,
      // the whole length of the platform
      const roof = b[`beamCeiling:${p.station}`] ??= new MeshBuilder(), m = f.beams.between + 1;
      const k0 = Math.ceil((a0 - start) / (spacing / m)), k1 = Math.floor((a1 - start) / (spacing / m));
      for (let k = k0; k <= k1; k++) {
        const sm = sampleAt(start + (k * spacing) / m);
        if (!sm) continue;
        const [a] = structureSpan(sm), width = sm.pair - 2 * a;
        box(roof, at(sm, sm.pair / 2, st.soffit + sm.pairDy / 2 - f.beams.depth / 2), sm, width, f.beams.depth, f.beams.width);
      }
    }
    // (with a row along each side, drawn with one of the two tracks)
    if (f.kind === 'beams' && (f.clocks || f.boards) && (middle || first.pair > 0)) {
      // clocks either side of the middle column, and departure boards across the platform a few
      // columns either way from it, hung on rods from the beams over them, a face each way along
      // the platform
      // (from the roof over them, where it slopes outside the columns)
      const mid = Math.floor(n / 2);
      const hang = (sm: Sample, u: number, w: number, h: number, depth: number, face: THREE.Material, round: boolean) => {
        const d = (st.stepOutside ? flatRoof(sm, st, u) : top) - (f.beams?.depth ?? 0) - (f.mesh?.below ?? 0);
        const t = new THREE.Vector3(sm.rz, 0, -sm.rx), rod = round ? 0.2 : 0.3, c = at(sm, u, d - rod - h / 2);
        if (round) {
          const rim = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, depth, 32).rotateX(Math.PI / 2), this.mats.fitting);
          rim.position.copy(c);
          rim.lookAt(c.clone().add(t));
          group.add(rim);
        } else box(b.glassBack, c, sm, w, h, depth);
        for (const k of round ? [0] : [-w / 2 + 0.15, w / 2 - 0.15]) box(b.fitting, at(sm, u + k, d - rod / 2), sm, 0.03, rod, 0.03);
        for (const side of [1, -1]) {
          const m = new THREE.Mesh(round ? new THREE.CircleGeometry(w / 2 - 0.03, 32) : new THREE.PlaneGeometry(w - 0.04, h - 0.04), face);
          m.position.copy(c).addScaledVector(t, side * (depth / 2 + 0.005));
          m.lookAt(m.position.clone().addScaledVector(t, side));
          group.add(m);
        }
      };
      const material = (key: string, map: () => THREE.Texture) => {
        let m = this.signs.get(key);
        if (!m) this.signs.set(key, (m = new THREE.MeshBasicMaterial({ map: map() })));
        return m;
      };
      const sm = sampleAt(start + mid * spacing);
      const clocks = typeof f.clocks === 'number' ? f.clocks : 1.2;
      if (f.clocks && sm) for (const k of [-clocks, clocks]) hang(sm, sm.pair / 2 + k, 0.5, 0.5, 0.1, material('clock', () => T.clockFace()), true);
      for (const k of f.boards ? [mid - f.boards.from, mid + f.boards.from] : []) {
        const sb = sampleAt(start + k * spacing);
        if (!sb || !f.boards) continue;
        // (east of the middle: the way the other track lies from this one, which leads)
        for (const east of [true, false]) {
          const off = f.boards.off ?? 1.6, bd = east ? f.boards.east : f.boards.west, u = sb.pair / 2 + Math.sign(sb.pair) * (east ? off : -off);
          hang(sb, u, 1.7, 0.5, 0.12, material(`board:${bd.toward}:${bd.trains.join('/')}`, () => T.trainsBoard(bd.toward, bd.trains)), false);
        }
      }
    }
    if ((f.kind !== 'concrete' && f.kind !== 'beams') || (!middle && first.pair < 0)) return;
    if (f.kind === 'beams' && f.signs.ways) {
      // long signs hung along both edges of the platform, every so far out from its middle (in
      // the vaulted part too), on rods from the ceiling or the vault
      const { every, at: h, ways } = f.signs, b0 = all_[0].along, b1 = all_[all_.length - 1].along, c0 = (b0 + b1) / 2;
      const key = `ways:${p.station}:${ways}`;
      let mat = this.signs.get(key);
      if (!mat) this.signs.set(key, (mat = new THREE.MeshBasicMaterial({ map: T.waysSign(f.signs.name ?? p.station, ways, f.signs.blue) })));
      const vault = f.vault;
      for (let k = Math.ceil((b0 + 4 - c0) / every); c0 + k * every <= b1 - 4; k++) {
        const sm = sampleAt(c0 + k * every, true);
        if (!sm) continue;
        const right = new THREE.Vector3(sm.rx, 0, sm.rz), [a, c] = structureSpan(sm);
        for (const u of [p.side * (S.PLATFORM_EDGE + 0.35), sm.pair - p.side * (S.PLATFORM_EDGE + 0.35)]) {
          if (open(sm, u, 2.2, h)) continue;
          const top = sm.vault && vault ? S.archHeight(a, c, st.soffit, vault.crown - st.soffit, u) + sm.pairDy / 2 : st.soffit;
          const o = at(sm, u, h);
          for (const d of [1, -1]) {
            const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.8), mat);
            sign.position.copy(o).addScaledVector(right, d * 0.016);
            sign.lookAt(o.clone().addScaledVector(right, d));
            group.add(sign);
          }
          box(b.fitting, o, sm, 0.028, 0.84, 4.44);
          for (const w of [-1.8, 1.8]) {
            const r = at(sm, u, (h + 0.42 + top) / 2).addScaledVector(new THREE.Vector3(sm.rz, 0, -sm.rx), w);
            box(b.fitting, r, sm, 0.02, top - h - 0.42, 0.02);
          }
        }
      }
      return;
    }
    // the name signs: halfway between two columns, every so many gaps out from the middle one
    const { every, at: h } = f.signs, m = Math.max(1, Math.round(every / spacing)), mid = Math.floor(n / 2);
    for (let k = mid % m; k < n; k += m) {
      const sm = sampleAt(start + (k + 0.5) * spacing);
      if (!sm) continue;
      const u = middle ? sm.pair / 2 : across(sm);
      if (open(sm, u, 1, h)) continue;
      const along = new THREE.Vector3(sm.rz, 0, -sm.rx), c = at(sm, u, h);
      for (const d of [1, -1]) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.34), this.signMaterial(p.station, 'dark'));
        sign.position.copy(c).addScaledVector(along, d * 0.015);
        sign.lookAt(c.clone().addScaledVector(along, d));
        group.add(sign);
      }
      box(b.fitting, at(sm, u, h), sm, 1.84, 0.38, 0.025);
      for (const w of [-0.7, 0.7]) box(b.fitting, at(sm, u + w, (h + 0.19 + st.soffit) / 2), sm, 0.02, st.soffit - h - 0.19, 0.02);
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

  // An island cave's hall (Stadion's), along this track: a flat ceiling of steel mesh over its
  // half of the hall, but not over the passage between the pillars, with tubes across it; and
  // along its wall, panels of steel mesh with a white band over them and the station's name on it.
  private islandHall(run: Sample[], b: Record<MaterialName, MeshBuilder>, group: THREE.Group) {
    const TUBES = 3;
    let lastPlate = -Infinity;
    for (let i = 0; i + 1 < run.length; i++) {
      const sa = run[i], sb = run[i + 1], st = islandStyle(sa), isl = st && this.islandOf(sa);
      if (!st || !isl || islandStyle(sb) !== st || sb.along - sa.along < 0.01) continue;
      const { hw, gap, margin } = islandOpening(st), reach = st.ceilingReach;
      const ta = isl.s(sa), tb = isl.s(sb);
      // beyond the pillars, at the platform's ends
      const beyond = (s: number) => s > isl.outer(1) || s < isl.outer(-1);
      // this track's side of the frame, and its wall (a little into the rock, which is rough)
      const side = Math.sign(isl.w(sa)) || 1, span = structureSpan(sa), wall = sm0Wall(sa, span);
      const uw = wall + Math.sign(wall) * 0.5;
      // (the passage's part reaching a little into the pillars, past their rounded and rough
      // corners, so the part over the middle stays hidden inside them)
      const cuts = [0, 1], pass = gap + margin;
      for (const c of [isl.mid - pass, isl.mid + pass, isl.outer(-1), isl.outer(1)]) { const f = (c - ta) / (tb - ta); if (f > 0 && f < 1) cuts.push(f); }
      cuts.sort((x, y) => x - y);
      for (let k = 0; k + 1 < cuts.length; k++) {
        const A = lerpSample(sa, sb, cuts[k]), B = lerpSample(sa, sb, cuts[k + 1]), tm = ta + (tb - ta) * (cuts[k] + cuts[k + 1]) / 2;
        const passage = Math.abs(tm - isl.mid) < pass;
        // to the pillars' face beside the passage (and beyond them, under a low vault, which comes
        // down over the platform's ends), else on over the middle to overlap the other half; or
        // only so far past the platform's edge
        const open = passage || (st.vault !== undefined && beyond(tm));
        const w = open ? side * hw : -side * OVERLAP;
        const far = (C: Sample) => (reach === undefined ? isl.uAt(C, w) : C.plat!.side * (S.PLATFORM_EDGE + reach));
        const y = islandCeilingAt(st, A) + A.pairDy / 2;
        const pts = [at(A, uw, y), at(B, uw, y), at(B, far(B), y), at(A, far(A), y)];
        this.islandCeiling(isl.station, st, b).quad(pts[0], pts[1], pts[2], pts[3], ...pts.map((q) => [isl.w(q) / 1.5, isl.s(q) / 1.5] as UV) as [UV, UV, UV, UV]);
        if (st.vault) this.islandVault(isl, st, st.vault, A, B, uw, passage || beyond(tm) ? -side * OVERLAP : side * (hw - 0.6), b);
      }
      if (reach !== undefined) {
        // rows of tubes along: over the track, the platform's edge and the platform
        for (let t = Math.ceil(Math.min(ta, tb) / 1.5) * 1.5; t < Math.max(ta, tb); t += 1.5) {
          const C = lerpSample(sa, sb, (t - ta) / (tb - ta)), y = st.ceiling + C.pairDy / 2 - 0.04, e = C.plat!.side * S.PLATFORM_EDGE;
          for (const u of [0, e, e + C.plat!.side * (reach - 0.6)]) box(b.lamp, at(C, u, y), C, 0.12, 0.05, 1.2);
        }
      } else {
        // tubes across it, one over the track and one over the platform, out to the pillars or
        // where there are none, on to the middle (with none at all, out to the opening over the
        // stairs)
        for (let t = Math.ceil(Math.min(ta, tb) / TUBES) * TUBES; t < Math.max(ta, tb); t += TUBES) {
          const C = lerpSample(sa, sb, (t - ta) / (tb - ta)), y = islandCeilingAt(st, C) + C.pairDy / 2 - 0.04;
          const middle = (beyond(t) && !st.vault) || (!st.pillars && Math.abs(t - isl.mid) >= pass);
          const p = C.plat!, e = p.side * S.PLATFORM_EDGE, f = isl.uAt(C, middle ? 0 : side * hw);
          box(b.lamp, at(C, 0, y), C, 2.2, 0.05, 0.12);
          box(b.lamp, at(C, (e + f) / 2, y), C, Math.abs(f - e) - 0.5, 0.05, 0.12);
        }
      }
      // on the wall: a white plate with the name every 25 m (none on black rock with a stripe)
      const u = wall - Math.sign(wall) * 0.45;
      if (st.walls !== 'stripe' && sa.along - lastPlate >= 25 && Math.abs(ta) < isl.half - 5) {
        lastPlate = sa.along;
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), this.signMaterial(sa.plat!.station, 'dark'));
        plate.position.copy(at(sa, u - Math.sign(wall) * 0.03, st.panels + 0.15));
        plate.lookAt(at(sa, u - Math.sign(wall), st.panels + 0.15));
        group.add(plate);
      }
    }
    for (const station of new Set(run.filter((sm) => islandStyle(sm)).map((sm) => sm.plat!.station))) {
      const st = islandStyle(run.find((sm) => islandStyle(sm) && sm.plat!.station === station)!)!;
      let mesh = this.islandFittings(station, st, b).mesh, repeat = 1.2;
      if (st.walls === 'rights') {
        // Schein's tiles: an article on the one wall, another on the other
        const k = run[0].pair > 0 ? 3 : 0, key: MaterialName = `stWall${k}:${station}`;
        this.mats[key] ??= new THREE.MeshStandardMaterial({ map: T.scheinRights(st.panels, k), emissive: 0x262626, roughness: 0.3, side: THREE.DoubleSide });
        mesh = b[key] ??= new MeshBuilder();
        repeat = 9.6;
      } else if (st.walls === 'stripe') {
        // the rock black (or the stripe's `rock`) and smoothed up to `panels`, and the stripe along
        // it, its lengths of colour from the island's -s end to its +s end
        const key: MaterialName = `stWall0:${station}`;
        this.mats[key] ??= new THREE.MeshStandardMaterial({ map: T.blackRock(st.stripe?.rock), roughness: 0.85, side: THREE.DoubleSide });
        mesh = b[key] ??= new MeshBuilder();
        repeat = 4.8;
        const stripe = st.stripe!, isl = this.islands.find((i) => i.station === station);
        const k = run[0].pair > 0 ? 0 : 1, sk: MaterialName = `stStripe${k}:${station}`;
        this.mats[sk] ??= new THREE.MeshStandardMaterial({ map: T.colourStripe(stripe.colors[k]), emissive: 0x2a2a2a, roughness: 0.45, side: THREE.DoubleSide });
        if (isl) {
          sweep(b[sk] ??= new MeshBuilder(), run, (sm) => {
            if (!islandStyle(sm) || sm.plat!.station !== station) return null;
            const u = sm0Wall(sm, structureSpan(sm)), p = u - Math.sign(u) * 0.46;
            return { key: 'stripe', pts: [[p, stripe.from], [p, stripe.to]] };
          }, { u: (_, __, ___, sm) => (isl.s(sm) + isl.half) / (2 * isl.half), v: (_, v) => (v - stripe.from) / (stripe.to - stripe.from) });
        }
      }
      sweep(mesh, run, (sm) => {
        const s = islandStyle(sm);
        if (!s || sm.plat!.station !== station) return null;
        const u = sm0Wall(sm, structureSpan(sm)), p = u - Math.sign(u) * 0.45;
        return { key: 'mesh', pts: [[p, S.FLOOR], [p, s.panels]] };
      }, { u: (_, __, along) => along / repeat, v: (_, v) => (st.walls ? (v - S.FLOOR) / (st.panels - S.FLOOR) : (v - S.FLOOR) / 1.2) });
    }
    sweep(b.stBand, run, (sm) => {
      const st = islandStyle(sm);
      if (!st || st.walls) return null;
      const u = sm0Wall(sm, structureSpan(sm)), p = u - Math.sign(u) * 0.46;
      return { key: 'band', pts: [[p, st.panels], [p, st.panels + 0.3]] };
    });
  }

  // The rock over an island cave's hall where it is low (Universitetet's), between two of a
  // track's samples: across from its wall (`uw`, from the track) up to the pillars' face, or on
  // over the middle, to `wEnd` across the island's frame; lumpy, as the pillars are.
  private islandVault(isl: Island, st: CaveIsland, v: { wall: number; crown: number; middle: number }, A: Sample, B: Sample, uw: number, wEnd: number, b: Record<MaterialName, MeshBuilder>) {
    const key: MaterialName = `pillar:${isl.station}`;
    this.mats[key] ??= islandRock(st.pillars?.paint ?? CAVE_STYLES[isl.station].paint);
    const rock = b[key] ??= new MeshBuilder(), hw = islandOpening(st).hw;
    const n = Math.max(1, Math.ceil(Math.abs(isl.s(B) - isl.s(A)) / 0.8));
    const first = rock.pos.length / 3;
    const cols = Math.max(2, Math.ceil(Math.abs(Math.abs(isl.w(at(A, uw, 0))) - Math.abs(wEnd)) / 0.6) + 1);
    for (let r = 0; r <= n; r++) {
      const C = lerpSample(A, B, r / n), w0 = isl.w(at(C, uw, 0)), aw0 = Math.abs(w0);
      for (let j = 0; j < cols; j++) {
        const w = w0 + ((wEnd - w0) * j) / (cols - 1), aw = Math.abs(w);
        // up from the wall to the crown over the pillars' faces, then down a little to the middle
        // (and up again on its far side, where it overlaps the other half)
        const y = aw >= hw
          ? v.wall + (v.crown - v.wall) * Math.sin((Math.PI / 2) * Math.min(1, (aw0 - aw) / (aw0 - hw)))
          : v.middle + (v.crown - v.middle) * (3 * (aw / hw) ** 2 - 2 * (aw / hw) ** 3);
        const p = at(C, isl.uAt(C, w), y + C.pairDy / 2);
        p.y -= VAULT_ROUGH * bump(p) + VAULT_ROUGH;
        rock.vertex(p.x, p.y, p.z, (aw0 - aw) / T.CAVE_ACROSS, isl.s(p) / T.CAVE_REPEAT);
      }
    }
    rock.grid(n + 1, cols, first);
  }

  private islandOf(sm: Sample) {
    return this.islands.find((isl) => isl.station === sm.plat!.station) ?? null;
  }

  // An island cave's ceiling: Stadion's black steel mesh, or the station's own colours.
  private islandCeiling(station: string, st: CaveIsland, b: Record<MaterialName, MeshBuilder>) {
    const c = st.fittings?.ceiling;
    if (!c) return b.stCeiling;
    const key: MaterialName = `stCeiling:${station}`;
    if (!this.mats[key]) {
      const map = T.stadionCeiling(...c);
      this.mats[key] = new THREE.MeshStandardMaterial({ map, emissive: 0x6a6a6a, emissiveMap: map, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
    }
    return b[key] ??= new MeshBuilder();
  }

  // An island cave's fittings: Stadion's green steel and cream tiles, or its own colours.
  private islandFittings(station: string, st: CaveIsland, b: Record<MaterialName, MeshBuilder>) {
    const f = st.fittings;
    if (!f) return { mesh: b.stMesh, fence: b.stMesh, fenceHeight: 1.5, plinth: b.stPlinth, rail: b.stRail };
    this.mats[`stMesh:${station}`] ??= new THREE.MeshStandardMaterial({ map: T.stadionMesh(...f.mesh), roughness: 0.6, side: THREE.DoubleSide });
    if (f.fence) this.mats[`stFence:${station}`] ??= new THREE.MeshStandardMaterial({ map: T.stadionMesh(...f.fence), roughness: 0.6, side: THREE.DoubleSide });
    this.mats[`stPlinth:${station}`] ??= new THREE.MeshStandardMaterial({ map: T.stadionPlinth(f.plinth), roughness: 0.4, side: THREE.DoubleSide });
    this.mats[`stRail:${station}`] ??= new THREE.MeshStandardMaterial({ color: (f.fence ?? f.mesh)[2], roughness: 0.5, metalness: 0.2 });
    const mesh = b[`stMesh:${station}`] ??= new MeshBuilder();
    return {
      mesh, fence: f.fence ? b[`stFence:${station}`] ??= new MeshBuilder() : mesh, fenceHeight: f.fenceHeight ?? 1.5,
      plinth: b[`stPlinth:${station}`] ??= new MeshBuilder(), rail: b[`stRail:${station}`] ??= new MeshBuilder(),
    };
  }

  // An island cave's middle (Stadion's): the two pillars of rock, the walls over the passage's
  // openings with the rainbow round them, the fences along the pillars' outer ends, and the art.
  private buildIsland(isl: Island, b: Record<MaterialName, MeshBuilder>, group: THREE.Group, lamps: Lamp[]) {
    // (an island cave with no pillars: only its own fittings)
    if (!isl.st.pillars) {
      if (isl.station === 'Masmo') this.masmo(isl, b, group);
      return;
    }
    const st = isl.st, pillars = isl.st.pillars, { width, fenced, plinth } = pillars, hw = width / 2, gap = pillars.gap / 2;
    // (Stadion's and Tekniska högskolan's pillars are alike, either side of the middle)
    const end = isl.outer(1), len = end - gap, fence = end - len * fenced, blue = fence - gap;
    if (Math.min(isl.outer(1) - isl.inner(1), isl.inner(-1) - isl.outer(-1)) < 6) return;
    const station = isl.station;
    const mat = (key: MaterialName, make: () => THREE.Material) => { this.mats[key] ??= make(); return b[key] ??= new MeshBuilder(); };
    const rock = mat(`pillar:${station}`, () => islandRock(pillars.paint)), fencedRock = mat(`fenced:${station}`, () => islandRock(pillars.fencedPaint));
    const fit = this.islandFittings(station, st, b);
    // the art on the pillars' long faces (`ps`, the pillar: -1 or 1; `side`, its face: -1 or 1),
    // which the rock is smoothed for; on a pillar's outer end instead (`side` 0), centred on the
    // middle of the platform (or `s` across it), or on its end by the passage (`inner`)
    type Art = { ps: number; side: number; s: number; y: number; w: number; h: number; map: () => THREE.Texture; dir?: number; key: string; inner?: boolean };
    const arts: Art[] = [];
    if (station === 'Stadion') {
      // the poster is at the north end, the flowers at the south: +s is north at Stadion
      arts.push(
        { ps: 1, side: 0, s: 0, y: plinth + 1.43, w: 2.3, h: 2.65, map: () => T.olympicPoster(), key: 'poster' },
        { ps: -1, side: 0, s: 0, y: plinth + 1.45, w: 3.6, h: 2.2, map: () => T.stadionFlowers(), key: 'flowers' },
        { ps: -1, side: 1, s: -(gap + blue * 0.8), y: 2.1, w: 2.4, h: 1.2, map: () => T.stadionArrow(false), dir: -1, key: 'arrow0' },
        { ps: 1, side: -1, s: gap + blue * 0.8, y: 2.1, w: 2.4, h: 1.2, map: () => T.stadionArrow(true), dir: 1, key: 'arrow1' },
      );
      // the clubs' badges, along the blue of each face, clear of the rest
      let club = 0;
      for (const ps of [-1, 1]) for (const side of [-1, 1]) {
        for (let d = gap + 1.4, k = 0; d < fence - 1; d += 4.2, k++) {
          const s = ps * d;
          if (arts.some((a) => a.ps === ps && a.side === side && Math.abs(a.s - s) < a.w / 2 + 0.9)) continue;
          const c = club++ % 5;
          arts.push({ ps, side, s, y: k % 2 ? 2.85 : 2.55, w: 0.55, h: 0.55, map: () => T.clubBadge(c), key: `badge${c}` });
        }
      }
    } else if (station === 'Tekniska högskolan') {
      // Mörk's: the disc on the north-western core's outer end, the machines with the figure on
      // the south-eastern core's, and machines along each core's sides (the island runs west-north-west
      // to east-south-east, so its west end is the north-western)
      const nw = isl.t.x > 0 ? -1 : 1;
      arts.push(
        { ps: nw, side: 0, s: 0, y: plinth + 1.4, w: 6.4, h: 2.6, map: () => T.tekniskaEye(), key: 'tkEye' },
        { ps: -nw, side: 0, s: 0, y: plinth + 1.3, w: 7, h: 2.3, map: () => T.tekniskaRelief(true, 1974), key: 'tkFigure' },
      );
      for (const ps of [-1, 1]) for (const side of [-1, 1]) {
        const seed = 1980 + (ps + 1) + (side + 1) / 2;
        arts.push({ ps, side, s: ps * (gap + len * 0.55), y: plinth + 1.3, w: 7, h: 2.3, map: () => T.tekniskaRelief(false, seed), key: `tkMachines${seed}` });
      }
    } else if (station === 'Universitetet') {
      // Schein's panels of Linnaeus's journeys along the cores' sides, one to each side of the
      // northern core and two to each of the southern
      for (const ps of [-1, 1]) for (const side of [-1, 1]) {
        const s0 = isl.inner(ps), pl = isl.outer(ps) - s0, n = Math.abs(pl) > 60 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const seed = 1735 + (ps + 1) * 4 + (side + 1) * 2 + k;
          arts.push({ ps, side, s: s0 + (pl * (k + 1)) / (n + 1), y: plinth + 1.45, w: 8.4, h: 2.6, map: () => T.linnePanel(seed), key: `unLinne${seed}` });
        }
      }
    } else if (station === 'Mörby centrum') {
      // the blue and yellow stripes on the southern core's end by the passage, at its western
      // corner, beside the way into the escalators
      const north = isl.t.z < 0 ? 1 : -1, west = isl.n.x > 0 ? -1 : 1;
      arts.push({ ps: -north, side: 0, inner: true, s: west * 5.85, y: plinth + 1.9, w: 1.9, h: 3.6, map: () => T.rockStripes(['#2c55a6', '#e2b42e'], 8), key: 'mcStripes' });
    } else if (station === 'Bergshamra') {
      // "Röster från det förflutna": along the cores' sides, rows of black glass painted with
      // the bus, the serpent and the fish between bands of dark natural stone (one row to each
      // side of the northern core, two between three bands to each of the southern's); on the
      // southern core's end by the passage, two panels of photographs, a man in a long coat
      const north = isl.t.z < 0 ? 1 : -1;
      for (const ps of [-1, 1]) for (const side of [-1, 1]) {
        const s0 = isl.inner(ps), pl = isl.outer(ps) - s0, short = ps === north;
        const items = short ? ['glass'] : ['stones', 'glass', 'stones', 'glass', 'stones'];
        items.forEach((it, k) => {
          const s = s0 + (pl * (k + 1)) / (items.length + 1), seed = 1978 + (ps + 1) * 4 + (side + 1) * 2 + k;
          if (it === 'glass') arts.push({ ps, side, s, y: plinth + 0.3 + 1.1, w: 10.8, h: 2.2, map: () => T.bergshamraGlass(8, seed), key: `bhGlass${seed % 3}` });
          else arts.push({ ps, side, s, y: plinth + 0.15 + 0.8, w: 12, h: 1.6, map: () => T.bergshamraStones(12, 1.6, seed), key: `bhStones${seed % 4}` });
        });
      }
      for (const w of [-3.6, 3.6]) arts.push({ ps: -north, side: 0, inner: true, s: w, y: plinth + 0.3 + 1.2, w: 1.4, h: 2.4, map: () => T.bergshamraPhotos(1), key: 'bhMan' });
    }
    // how much of the rock's roughness is left at (s, w, y): none on the art and a little round it
    const smooth = (s: number, w: number, y: number) => {
      let f = 1;
      for (const a of arts) {
        if (a.side ? Math.sign(w) !== a.side || Math.abs(Math.abs(w) - hw) > 0.05 : Math.abs(s - (a.inner ? isl.inner(a.ps) : isl.outer(a.ps))) > 0.05) continue;
        const d = Math.max(Math.abs((a.side ? s : w) - a.s) - a.w / 2, Math.abs(y - a.y) - a.h / 2);
        f = Math.min(f, Math.max(0, Math.min(1, d / 0.6)));
      }
      return f;
    };
    const ramp = (y: number, from: number) => Math.max(0, Math.min(1, (y - from) / 0.6));
    for (const ps of [-1, 1]) {
      const pl = Math.abs(isl.outer(ps) - isl.inner(ps)), c = (isl.outer(ps) + isl.inner(ps)) / 2;
      // none where the stairs or escalators come down (a little in from its ends: escalators
      // may start in a notch in its end, as at Bergshamra and Mörby centrum)
      if ([-1, 0, 1].some((k) => this.holes.some((o) => { const q = isl.P(c + k * (pl / 2 - 6), 0, 1.5); return insideVolume(o, q.x, q.y, q.z); }))) continue;
      const ring = roundedRect(c, pl / 2, hw, 1.0, 0.35);
      const rows = [plinth, plinth + 0.25, plinth + 0.6];
      for (let y = plinth + 1.1; y < isl.top; y += 0.5) rows.push(y);
      rows.push(isl.top);
      // the rock, painted blue near the passage and on the outer end, and green behind the fences
      // along the sides, in runs of columns
      const zone = (j: number) => ps * ((ring[j].s + ring[j + 1].s) / 2 - isl.inner(ps)) > pl * (1 - fenced) && Math.abs((ring[j].w + ring[j + 1].w) / 2) > hw - 0.5;
      for (let j0 = 0; j0 + 1 < ring.length;) {
        let j1 = j0 + 1;
        while (j1 + 1 < ring.length && zone(j1) === zone(j0)) j1++;
        const mb = zone(j0) ? fencedRock : rock, first = mb.pos.length / 3;
        for (const y of rows) {
          for (let j = j0; j <= j1; j++) {
            const q = ring[j], d = PILLAR_ROUGH * bump(isl.P(q.s, q.w, y)) * ramp(y, plinth) * smooth(q.s, q.w, y);
            const v = isl.P(q.s + q.ns * d, q.w + q.nw * d, y);
            mb.vertex(v.x, v.y, v.z, (y + T.STADION_FOOT) / T.CAVE_ACROSS, q.d / T.CAVE_REPEAT);
          }
        }
        mb.grid(rows.length, j1 - j0 + 1, first);
        j0 = j1;
      }
      // the plinth: its face, and its top back to the rock
      const first = fit.plinth.pos.length / 3, out = 0.35;
      for (const [o, y, v] of [[out, 0, 0], [out, plinth, plinth], [0, plinth, plinth + out]]) {
        for (const q of ring) {
          const p = isl.P(q.s + q.ns * o, q.w + q.nw * o, y);
          fit.plinth.vertex(p.x, p.y, p.z, q.d / 1.2, v / 1.2);
        }
      }
      fit.plinth.grid(3, ring.length, first);
      // the fences along its outer end, with benches against them, and the name over them
      if (fenced <= 0) continue;
      const fe = isl.inner(ps) + ps * pl * (1 - fenced), s0 = Math.min(fe, isl.outer(ps)), s1 = Math.max(fe, isl.outer(ps)), fh = fit.fenceHeight;
      for (const side of [-1, 1]) {
        const w = side * (hw + 0.55);
        fit.fence.quad(isl.P(s0, w, 0), isl.P(s1, w, 0), isl.P(s1, w, fh), isl.P(s0, w, fh), [s0 / 1.2, 0], [s1 / 1.2, 0], [s1 / 1.2, fh / 1.2], [s0 / 1.2, fh / 1.2]);
        box(fit.rail, isl.P((s0 + s1) / 2, w, fh + 0.02), isl.sm, 0.06, 0.06, s1 - s0);
        for (let s = s0 + 2.5; s < s1 - 1.5; s += 5) {
          box(fit.rail, isl.P(s, w + side * 0.24, 0.46), isl.sm, 0.42, 0.05, 1.5);
          for (const e of [-0.6, 0.6]) box(fit.rail, isl.P(s + e, w + side * 0.24, 0.22), isl.sm, 0.3, 0.44, 0.05);
        }
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.42), this.signMaterial(station, 'dark'));
        plate.position.copy(isl.P((s0 + s1) / 2, side * (hw + 0.45), fh + 0.6));
        plate.lookAt(isl.P((s0 + s1) / 2, side * (hw + 1.45), fh + 0.6));
        group.add(plate);
      }
    }
    // the walls over the passage's openings: the rainbow on their inner faces, the rock outside
    const portal = st.portal;
    if (portal) {
      // (in a frame from the passage's middle)
      const P = (s: number, w: number, y: number) => isl.P(isl.mid + s, w, y);
      const { inset, thickness } = portal, crown = portal.crown - S.PLATFORM_HEIGHT, half = gap - inset;
      const spring = portal.spring === undefined ? 0 : portal.spring - S.PLATFORM_HEIGHT;
      const e0 = -(gap + 0.8), e1 = gap + 0.8;
      const cols: number[] = [];
      for (let s = e0; s < -half - 0.01; s += 0.3) cols.push(s);
      const K = 28;
      for (let k = 0; k <= K; k++) cols.push(-half * Math.cos((Math.PI * k) / K));
      for (let s = half + 0.3; s < e1 + 0.01; s += 0.3) cols.push(Math.min(s, e1));
      const bottom = (s: number) => (Math.abs(s) < half ? spring + (crown - spring) * Math.sqrt(Math.max(0, 1 - (s / half) ** 2)) : 0);
      const M = 20, W0 = hw - thickness, vault = crown + (portal.rise ?? 2);
      // (the paint as high as the faces reach along their profile, over the vault too)
      let arc = 0;
      for (let k = 1; k <= 24; k++) {
        const a0 = (Math.PI / 2) * ((k - 1) / 24), a1 = (Math.PI / 2) * (k / 24);
        arc += Math.hypot(W0 * (Math.cos(a1) - Math.cos(a0)), (vault - crown) * (Math.sin(a1) - Math.sin(a0)));
      }
      const H = Math.max(isl.top, crown + arc);
      for (const side of [-1, 1] as const) {
        const key: MaterialName = `portal${side > 0 ? 1 : 0}:${station}`;
        const face = mat(key, () => {
          const map = T.stadionPortal(e1 - e0, H, (e1 - e0) / 2 - half, crown, 0.3, side > 0, portal.paint ?? pillars.paint, portal.frame ?? !portal.paint, spring);
          return new THREE.MeshStandardMaterial({ map, emissive: 0x5a5a5a, emissiveMap: map, roughness: 0.95, side: THREE.DoubleSide });
        });
        // the inner face: up from the floor or the arch to the crown's height, then curving over the
        // passage to meet the other's over its middle, a vault with the rainbow over it; pushed out
        // into the passage by its roughness (none at the seam). V is how far up it from the platform.
        const inner = (s: number) => {
          const yb = bottom(s), poly: [number, number][] = [];
          for (let k = 0; k < 8; k++) poly.push([W0, yb + ((crown - yb) * k) / 8]);
          for (let k = 0; k <= 24; k++) {
            const a = (Math.PI / 2) * (k / 24);
            poly.push([W0 * Math.cos(a), crown + (vault - crown) * Math.sin(a)]);
          }
          const cum = [0];
          for (let k = 1; k < poly.length; k++) cum.push(cum[k - 1] + Math.hypot(poly[k][0] - poly[k - 1][0], poly[k][1] - poly[k - 1][1]));
          const out: { p: THREE.Vector3; V: number }[] = [];
          for (let r = 0, k = 1; r <= M; r++) {
            const L = (cum[cum.length - 1] * r) / M;
            while (k < cum.length - 1 && cum[k] < L) k++;
            const f = (L - cum[k - 1]) / (cum[k] - cum[k - 1] || 1), [w0, y0] = poly[k - 1], [w1, y1] = poly[k];
            const aw = w0 + (w1 - w0) * f, y = y0 + (y1 - y0) * f, tl = Math.hypot(w1 - w0, y1 - y0) || 1;
            // (into the passage: square to the profile, towards its middle and down)
            const nw = -(y1 - y0) / tl, ny = (w1 - w0) / tl;
            const d = PORTAL_ROUGH * bump(P(s, side * aw, y)) * ramp(y, 0) * Math.max(0, Math.min(1, aw / 0.5));
            out.push({ p: P(s, side * (aw + nw * d), y + ny * d), V: yb + L });
          }
          return out;
        };
        // (the outer face, as rough as the pillars' faces it carries on from)
        const outer = (s: number, y: number) => {
          const w = side * hw, d = PILLAR_ROUGH * bump(P(s, w, y)) * ramp(y, 0);
          return P(s, w + side * d, y);
        };
        const faces = cols.map(inner);
        let first = face.pos.length / 3;
        for (let r = 0; r <= M; r++) {
          cols.forEach((s, j) => { const { p, V } = faces[j][r]; face.vertex(p.x, p.y, p.z, (s - e0) / (e1 - e0), V / H); });
        }
        face.grid(M + 1, cols.length, first);
        first = rock.pos.length / 3;
        for (let r = 0; r <= M; r++) {
          for (const s of cols) {
            const y = bottom(s) + ((isl.top - bottom(s)) * r) / M, p = outer(s, y);
            rock.vertex(p.x, p.y, p.z, (y + T.STADION_FOOT) / T.CAVE_ACROSS, s / T.CAVE_REPEAT);
          }
        }
        rock.grid(M + 1, cols.length, first);
        // under the arch, from the one face to the other
        const arch = cols.map((s, j) => [s, j]).filter(([s]) => Math.abs(s) <= half + 1e-6);
        first = rock.pos.length / 3;
        for (const [s, j] of arch) { const p = faces[j][0].p; rock.vertex(p.x, p.y, p.z, (bottom(s) + T.STADION_FOOT + thickness) / T.CAVE_ACROSS, s / T.CAVE_REPEAT); }
        for (const [s] of arch) { const p = outer(s, bottom(s)); rock.vertex(p.x, p.y, p.z, (bottom(s) + T.STADION_FOOT) / T.CAVE_ACROSS, s / T.CAVE_REPEAT); }
        rock.grid(2, arch.length, first);
      }
    }
    // the art, on the smoothed rock, reading from the platform
    for (const a of arts) {
      let m = this.islandArt.get(a.key);
      if (!m) {
        const map = a.map();
        m = new THREE.MeshStandardMaterial({ map, emissive: 0x2a2a2a, emissiveMap: map, roughness: 0.5, alphaTest: 0.3, side: THREE.DoubleSide });
        this.islandArt.set(a.key, m);
      }
      // (u along the face to the right of someone facing it, or for an arrow, the way it points)
      const right = a.dir ?? (a.side || (a.inner ? a.ps : -a.ps)), y0 = a.y - a.h / 2, y1 = a.y + a.h / 2;
      const u0 = a.s - (right * a.w) / 2, u1 = a.s + (right * a.w) / 2;
      const at = (u: number, y: number) => a.side ? isl.P(u, a.side * (hw + 0.03), y)
        : isl.P(a.inner ? isl.inner(a.ps) - a.ps * 0.03 : isl.outer(a.ps) + a.ps * 0.03, u, y);
      const g = new THREE.BufferGeometry();
      const corners = [at(u0, y0), at(u1, y0), at(u1, y1), at(u0, y1)];
      g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap((p) => [p.x, p.y, p.z]), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, m));
    }
    if (st.dodecahedron && st.portal) this.dodecahedron(isl, st.dodecahedron, st.portal.crown - S.PLATFORM_HEIGHT + (st.portal.rise ?? 2), group);
    if (station === 'Universitetet') this.universitetet(isl, b, group);
    if (station === 'Bergshamra') this.bergshamra(isl, b, group, lamps);
  }

  // Masmo's island cave (src/hall-styles.ts), besides its ceiling and track walls: Staffan
  // Hallström's and Lasse Andréasson's "Ta ner solen i tunnelbanan" (1971–72), painted panels
  // standing off the rock along both walls over the white band, with bare rock between them;
  // benches of pine back to back round dark blue posts carrying the name, down the middle; and
  // the white railing across the platform's north-eastern end (photographs, 2002–2018). Where each
  // panel is, beyond the large one with the sun east of the stairs and the playing cards on the
  // northern wall west of the ticket hall, is a guess. Points are in the station's frame (s
  // east-north-east, u south-south-east), as in data/station-descriptions.json.
  private masmo(isl: Island, b: Record<MaterialName, MeshBuilder>, group: THREE.Group) {
    const station = isl.station, n = isl.t.z < 0 ? 1 : -1;
    const P = (s: number, u: number, y: number) => isl.P(n * s, n * u, y);
    const builder = (key: MaterialName, make: () => THREE.Material) => { this.mats[key] ??= make(); return b[key] ??= new MeshBuilder(); };
    // the wall's face over the band at s on the side u (its w in the island's frame), from the
    // track's own sample there
    const wallAt = (s: number, side: number) => {
      let best: Sample | null = null, d = Infinity;
      for (const run of this.samples) for (const sm of run) {
        if (sm.plat?.station !== station || !sm.pair || !islandStyle(sm)) continue;
        const q = at(sm, 0, 0);
        if (Math.sign(n * isl.w(q)) !== side) continue;
        const dd = Math.abs(n * isl.s(q) - s);
        if (dd < d) { d = dd; best = sm; }
      }
      if (!best) return null;
      const u = sm0Wall(best, structureSpan(best));
      return { w: isl.w(at(best, u - Math.sign(u) * 0.62, 0)), box: best.kind === 'box' };
    };
    // the panels: [s, side (u), kind, variant, bottom over the platform]
    const panels: [number, number, 'sun' | 'crescent' | 'yellow' | 'card' | 'drawing', number, number][] = [
      [-64, 1, 'drawing', 1, 1.25], [-54, 1, 'drawing', 0, 1.25], [-41, 1, 'yellow', 0, 0.95], [-14, 1, 'crescent', 0, 0.95],
      [-2, 1, 'yellow', 0, 0.95], [16, 1, 'sun', 0, 0.95], [33, 1, 'yellow', 0, 0.95], [47, 1, 'crescent', 1, 0.95], [62, 1, 'yellow', 0, 0.95],
      [-62, -1, 'drawing', 0, 1.25], [-50, -1, 'card', 3, 0.95], [-46.6, -1, 'card', 2, 0.95], [-43.6, -1, 'card', 1, 0.95], [-40.6, -1, 'card', 0, 0.95],
      [-12, -1, 'drawing', 0, 1.25], [2, -1, 'yellow', 0, 0.95], [14, -1, 'crescent', 0, 0.95], [30, -1, 'yellow', 0, 0.95], [44, -1, 'drawing', 1, 1.25],
      [58, -1, 'crescent', 1, 0.95],
    ];
    const steel = builder(`msSteel:${station}`, () => new THREE.MeshStandardMaterial({ color: 0xa9aeb1, emissive: 0x303234, roughness: 0.35, metalness: 0.5 }));
    for (const [s, side, kind, variant, bottom] of panels) {
      const wall = wallAt(s, side);
      if (!wall) continue;
      const [width, height] = T.MASMO_ART_SIZE[kind], y0 = bottom, y1 = bottom + height;
      // (under the box's lower ceiling, only what fits)
      if (y1 > (wall.box ? islandCeilingAt(isl.st, { kind: 'box' } as Sample) : isl.st.ceiling) - S.PLATFORM_HEIGHT - 0.1) continue;
      const key = `masmo:${kind}${variant}`;
      let m = this.islandArt.get(key);
      if (!m) {
        const map = T.masmoArt(kind, variant);
        m = new THREE.MeshStandardMaterial({ map, emissive: 0x2a2a2a, emissiveMap: map, roughness: 0.5, side: THREE.DoubleSide });
        this.islandArt.set(key, m);
      }
      // (read from the platform: its left end towards +s on the wall towards +w, and so on)
      const sw = Math.sign(wall.w), c = n * s, h = width / 2;
      const corners = [isl.P(c + sw * h, wall.w, y0), isl.P(c - sw * h, wall.w, y0), isl.P(c - sw * h, wall.w, y1), isl.P(c + sw * h, wall.w, y1)];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap((q) => [q.x, q.y, q.z]), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, m));
      // its brackets back to the rock
      for (const e of [-1, 1]) for (const y of [y0 + 0.3, y1 - 0.3]) box(steel, isl.P(c + e * (h - 0.3), wall.w + sw * 0.3, y), isl.sm, 0.6, 0.05, 0.05);
    }
    // benches of pine back to back, either side of a dark blue post with the name over them
    const pine = builder(`msPine:${station}`, () => new THREE.MeshStandardMaterial({ color: 0xc99a5c, emissive: 0x241a0e, roughness: 0.7 }));
    const blue = builder(`msBlue:${station}`, () => new THREE.MeshStandardMaterial({ color: 0x1f3550, emissive: 0x0a1018, roughness: 0.5, metalness: 0.3 }));
    for (const s of [-58, -45, -8, 6, 26, 44, 60]) {
      const wall = wallAt(s, 1), top = (wall?.box ? islandCeilingAt(isl.st, { kind: 'box' } as Sample) : isl.st.ceiling) - S.PLATFORM_HEIGHT;
      box(blue, P(s, 0, top / 2), isl.sm, 0.14, top, 0.14);
      for (const d of [1, -1]) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.34), this.signMaterial(station, 'dark'));
        const o = P(s, 0, Math.min(2.75, top - 0.35)), along = isl.t.clone().multiplyScalar(n * d);
        sign.position.copy(o).addScaledVector(along, 0.08);
        sign.lookAt(o.clone().addScaledVector(along, 1));
        group.add(sign);
        box(blue, P(s, 0, Math.min(2.75, top - 0.35)), isl.sm, 0.1, 0.4, 0.14);
      }
      for (const e of [-1, 1]) {
        const m = s + e * 1.15;
        for (const side of [-1, 1]) box(pine, P(m, side * 0.27, 0.45), isl.sm, 0.4, 0.06, 1.9);
        box(pine, P(m, 0, 0.78), isl.sm, 0.08, 0.5, 1.9);
        for (const f of [-0.8, 0.8]) box(steel, P(m + f, 0, 0.22), isl.sm, 0.9, 0.44, 0.05);
      }
    }
    // the railing across the north-eastern end: white bars under a white rail
    const white = builder(`msWhite:${station}`, () => new THREE.MeshStandardMaterial({ color: 0xeceae4, emissive: 0x2c2c2a, roughness: 0.45 }));
    const end = isl.half - 0.2, edge = S.islandWidth(station) / 2;
    box(white, P(end, 0, 1.1), isl.sm, 2 * edge, 0.06, 0.06);
    box(white, P(end, 0, 0.12), isl.sm, 2 * edge, 0.05, 0.05);
    for (let u = -edge + 0.06; u <= edge; u += 0.13) box(white, P(end, u, 0.61), isl.sm, 0.025, 0.98, 0.025);
  }

  // Universitetet's island cave (src/hall-styles.ts), besides its pillars: the emergency exit's
  // block of red tiles at the north end, the end walls (small lilac grey tiles behind the block,
  // yellow at each edge of the platform; at the south end teal tiles to the east of the lobby and
  // deep blue to the west), stainless steel cylinders hung from the rock, and white benches
  // along the cores. The lobby itself is the station's (src/open-styles.ts).
  private universitetet(isl: Island, b: Record<MaterialName, MeshBuilder>, group: THREE.Group) {
    const station = isl.station, st = isl.st, hw = st.pillars!.width / 2, edge = S.islandWidth(station) / 2;
    // +1 where s runs north; w then runs east (the station's frame's u, roughly)
    const n = isl.t.z < 0 ? 1 : -1;
    const plane = (m: THREE.Material, p: THREE.Vector3[], uv = [0, 0, 1, 0, 1, 1, 0, 1]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p.flatMap((q) => [q.x, q.y, q.z]), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, m));
    };
    const mat = (key: MaterialName, make: () => THREE.Material) => (this.mats[key] ??= make());
    const tiles = (key: MaterialName, make: () => THREE.Texture) => mat(key, () => {
      const map = make();
      return new THREE.MeshStandardMaterial({ map, emissive: 0x303030, emissiveMap: map, roughness: 0.35, side: THREE.DoubleSide });
    });
    // a wall across the island at s, from `from` to `to` across it (left to right as it is seen),
    // y0 to y1 over the platform, its texture repeating every `size`
    const across = (m: THREE.Material, s: number, from: number, to: number, y0: number, y1: number, size: [number, number]) => {
      const u = Math.abs(to - from) / size[0];
      plane(m, [isl.P(s, from, y0), isl.P(s, to, y0), isl.P(s, to, y1), isl.P(s, from, y1)], [0, y0 / size[1], u, y0 / size[1], u, y1 / size[1], 0, y1 / size[1]]);
    };
    const rock = mat(`pillar:${station}`, () => islandRock(st.pillars!.paint));
    // the same in the rock, its paint (as on the pillars) up the wall in u and along it in v
    const rockAcross = (s: number, from: number, to: number, y0: number, y1: number) => {
      const v = Math.abs(to - from) / T.CAVE_REPEAT, a = y0 / T.CAVE_ACROSS, b = y1 / T.CAVE_ACROSS;
      plane(rock, [isl.P(s, from, y0), isl.P(s, to, y0), isl.P(s, to, y1), isl.P(s, from, y1)], [a, 0, a, v, b, v, b, 0]);
    };
    const H = 3.6, top = st.vault!.crown + 1, E = n;
    // (the end walls a little in front of where the hall's two tracks stop sharing it, whose rock
    // round the tunnels going on is rough, and on the slant of the tracks as they part)
    const north = n > 0 ? isl.hall[1] : isl.hall[0], south = n > 0 ? isl.hall[0] : isl.hall[1];
    // the north end wall's rock, from edge to edge of the platform and up into the rock over it,
    // seen from the south; its tiles a little in front of it
    const sn = north - n * 0.8, fn = sn - n * 0.03, yh = (edge - hw) / 2;
    rockAcross(sn, -E * edge, E * edge, 0, top);
    // (and over each track, above its trains, out into the rock: the hall goes on a few metres
    // over the tracks beyond the platform's ends, to where they part)
    const over = (at: number) => { for (const k of [-1, 1]) rockAcross(at, k * edge, k * (edge + 7), 3.4, top); };
    over(sn);
    across(tiles(`unTiles:${station}`, () => T.lilacTiles(2 * hw, H)), fn, -E * hw, E * hw, 0, H, [2 * hw, H]);
    const yellow = tiles(`unEnd:${station}`, () => T.finish('ochreDoor'));
    across(yellow, fn, -E * edge, -E * hw, 0, 3.15, [yh, 3.15]);
    across(yellow, fn, E * hw, E * edge, 0, 3.15, [yh, 3.15]);
    // the south end wall, seen from the north: teal to the east of the lobby's opening (by the
    // station's frame, from 8 m west of the platform's middle to 4 m east of it) and deep blue
    // to the west, the rock over the opening down to the lobby's ceiling; and teal round the
    // opening, back to the lobby (the rock in the way cut away by src/open-styles.ts)
    const ss = south + n * 0.8, fs = ss + n * 0.03, lobby = -n * (isl.half - 0.1);
    rockAcross(ss, E * edge, E * 4, 0, top);
    rockAcross(ss, -E * 8, -E * edge, 0, top);
    rockAcross(ss, E * 4, -E * 8, H, top);
    over(ss);
    const teal = tiles(`unTeal:${station}`, () => T.finish('portalTiles'));
    across(teal, fs, E * edge, E * 4, 0, H, [1.2, 1.2]);
    across(tiles(`unBlue:${station}`, () => T.scheinBlue()), fs, -E * 8, -E * edge, 0, H, [4.8, H]);
    const deep = Math.abs(lobby - ss) / 1.2;
    // (on along the lobby, a little behind its own walls, which stop short where the platform's
    // floor reaches in beside it: from the lobby's floor in station-layouts.json)
    for (const [w0, s1, w1] of [[E * 4.03, -n * 86.3, E * 3.83], [-E * 8.03, -n * 86, -E * 8.23]]) {
      const l = Math.hypot(s1 - ss, w1 - w0) / 1.2;
      plane(teal, [isl.P(ss, w0, 0), isl.P(s1, w1, 0), isl.P(s1, w1, H), isl.P(ss, w0, H)], [0, 0, l, 0, l, H / 1.2, 0, H / 1.2]);
    }
    const render = tiles(`unRender:${station}`, () => T.finish('whiteRender'));
    plane(render, [isl.P(ss, E * 4, H), isl.P(ss, -E * 8, H), isl.P(lobby, -E * 8, H), isl.P(lobby, E * 4, H)], [0, 0, 10, 0, 10, deep, 0, deep]);
    // and the floor from the platform's end, 0.1 m up, down to the lobby's, over what is left of
    // the rock under the way in
    const sill = mat(`unSill:${station}`, () => Object.assign(this.mats.platform.clone(), { side: THREE.DoubleSide }));
    plane(sill, [isl.P(south, E * 4, 0.097), isl.P(south, -E * 8, 0.097), isl.P(-n * 77.85, -E * 8, 0), isl.P(-n * 78.14, E * 4, 0)], [0, 0, 6, 0, 6, 0.5, 0, 0.5]);
    // the block, 6.2 m across and 4.4 m along, 2.5 m from the north end wall, its doors facing
    // south, up into the rock over it
    const c = sn - n * 4.7, bw = 3.1, bd = 2.2 * n, bh = 6.6, tile = 5.4;
    const face = (key: MaterialName, w: number, doors: number, seed: number) => mat(key, () => {
      const map = T.exitBlock(w, bh, tile, doors, seed);
      return new THREE.MeshStandardMaterial({ map, emissive: 0x3a3a3a, emissiveMap: map, roughness: 0.3, side: THREE.DoubleSide });
    });
    const front = face(`unBlock:${station}:0`, 6.2, 2, 1), sides = face(`unBlock:${station}:1`, 4.4, 1, 2), back = face(`unBlock:${station}:2`, 6.2, 0, 3);
    plane(front, [isl.P(c - bd, n * -bw, 0), isl.P(c - bd, n * bw, 0), isl.P(c - bd, n * bw, bh), isl.P(c - bd, n * -bw, bh)]);
    plane(back, [isl.P(c + bd, n * bw, 0), isl.P(c + bd, n * -bw, 0), isl.P(c + bd, n * -bw, bh), isl.P(c + bd, n * bw, bh)]);
    for (const side of [-1, 1]) {
      const w = side * bw * n;
      plane(sides, [isl.P(c - bd * side, w, 0), isl.P(c + bd * side, w, 0), isl.P(c + bd * side, w, bh), isl.P(c - bd * side, w, bh)]);
    }
    // the cylinders, stainless steel, hung from the rock: a row across the south end, a pair in the
    // passage
    const steel = mat(`unSteel:${station}`, () => new THREE.MeshStandardMaterial({ color: 0xc4c8cb, emissive: 0x4a4c4e, roughness: 0.3, metalness: 0.4 }));
    const tube = new THREE.CylinderGeometry(0.32, 0.32, 3.6, 20);
    for (const [s, w] of [[ss + n * 4, -7], [ss + n * 4, 0], [ss + n * 4.5, 7], [isl.mid, -4], [isl.mid + 2, 4]]) {
      const m = new THREE.Mesh(tube, steel);
      m.position.copy(isl.P(s, w, 3.4 + 1.8));
      group.add(m);
    }
    // the benches along the cores, slabs of white stone off their plinths
    const bench = b[`unBench:${station}`] ??= new MeshBuilder();
    mat(`unBench:${station}`, () => new THREE.MeshStandardMaterial({ color: 0xe6e5e0, emissive: 0x2a2a2a, roughness: 0.5 }));
    for (const ps of [-1, 1]) {
      const s0 = isl.inner(ps), pl = isl.outer(ps) - s0;
      for (let k = 1; k * 9 < Math.abs(pl) - 3; k++) {
        const s = s0 + Math.sign(pl) * k * 9;
        for (const side of [-1, 1]) {
          box(bench, isl.P(s, side * (hw + 0.6), 0.44), isl.sm, 0.5, 0.08, 2.2);
          for (const e of [-0.95, 0.95]) box(bench, isl.P(s + e, side * (hw + 0.6), 0.2), isl.sm, 0.45, 0.4, 0.08);
        }
      }
    }
  }

  // Bergshamra's island cave (src/hall-styles.ts), besides its pillars and the art on them: the
  // block of violet tiles round the two lifts at the platform's northern end, the escalators'
  // glazed porches on the northern core's end by the passage, the station's name on black signs
  // hung at the ceiling's edge along the cores, benches of pine and steel bins along them, and
  // stones inlaid in the floor (photographs, 2009–2026). Points are in the station's frame (s
  // north, u east), as in data/station-descriptions.json.
  private bergshamra(isl: Island, b: Record<MaterialName, MeshBuilder>, group: THREE.Group, lamps: Lamp[]) {
    const station = isl.station, st = isl.st, hw = st.pillars!.width / 2, n = isl.t.z < 0 ? 1 : -1;
    const P = (s: number, u: number, y: number) => isl.P(n * s, n * u, y);
    const mat = (key: MaterialName, make: () => THREE.Material) => (this.mats[key] ??= make());
    const builder = (key: MaterialName, make: () => THREE.Material) => { mat(key, make); return b[key] ??= new MeshBuilder(); };
    const steel = builder(`bhSteel:${station}`, () => new THREE.MeshStandardMaterial({ color: 0xa9aeb1, emissive: 0x303234, roughness: 0.35, metalness: 0.5 }));
    // a quad in the station's frame, its uvs in metres over `size`
    const quad = (mb: MeshBuilder, pts: [number, number, number][], size: number) => {
      const v = pts.map(([s, u, y]) => P(s, u, y));
      const d01 = v[0].distanceTo(v[1]) / size, d12 = v[1].distanceTo(v[2]) / size;
      mb.quad(v[0], v[1], v[2], v[3], [0, 0], [d01, 0], [d01, d12], [0, d12]);
    };
    const plane = (m: THREE.Material, pts: THREE.Vector3[], uv = [0, 0, 1, 0, 1, 1, 0, 1]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((q) => [q.x, q.y, q.z]), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, m));
    };
    // the end walls, in the cores' rock, a little in front of where the hall's two tracks stop
    // sharing it (as at Universitetet), up into the rock over the platform and over each track
    // above its trains; the same rock, its paint up the wall in u and along it in v, across at s
    // from u0 to u1
    const rock = mat(`pillar:${station}`, () => islandRock(st.pillars!.paint));
    const rockAcross = (s: number, a: number, c: number, y0: number, y1: number) => {
      const v = Math.abs(c - a) / T.CAVE_REPEAT, ya = y0 / T.CAVE_ACROSS, yb = y1 / T.CAVE_ACROSS;
      plane(rock, [P(s, a, y0), P(s, c, y0), P(s, c, y1), P(s, a, y1)], [ya, 0, ya, v, yb, v, yb, 0]);
    };
    const rockAlong = (u: number, a: number, c: number, y0: number, y1: number) => {
      const v = Math.abs(c - a) / T.CAVE_REPEAT, ya = y0 / T.CAVE_ACROSS, yb = y1 / T.CAVE_ACROSS;
      plane(rock, [P(a, u, y0), P(c, u, y0), P(c, u, y1), P(a, u, y1)], [ya, 0, ya, v, yb, v, yb, 0]);
    };
    const edge = S.islandWidth(station) / 2, top = st.vault!.crown + 1;
    const sn = (n > 0 ? isl.hall[1] : -isl.hall[0]) - 0.8, ss = (n > 0 ? isl.hall[0] : -isl.hall[1]) + 0.8;
    const over = (at: number) => { for (const k of [-1, 1]) rockAcross(at, k * edge, k * (edge + 7), 3.4, top); };
    // at the north end, the lifts' block: violet tiles 6.1 m across, standing 1.25 m out of the
    // wall, round the shafts (u -2.75 and -0.05, 87.1 north, in data/station-descriptions.json),
    // their doors facing south; a canopy of steel over them; beside it to the east the collage of
    // photographs
    const tiles = builder(`bhLift:${station}`, () => { const map = T.violetTiles(); return new THREE.MeshStandardMaterial({ map, emissive: 0x262630, emissiveMap: map, roughness: 0.25, side: THREE.DoubleSide }); });
    const f0 = 85.75, f1 = sn + 0.05, u0 = -4.45, u1 = 1.65, bh = 3.4, dh = 2.2;
    rockAcross(sn, -edge, u0, 0, top);
    rockAcross(sn, u1, edge, 0, top);
    // (over the block, the rock comes forward to its front, so that the shafts stay in the rock)
    rockAcross(f0, u0, u1, bh, top);
    for (const u of [u0, u1]) rockAlong(u, f0, sn, bh, top);
    over(sn);
    for (const [a, c] of [[u0, -3.35], [-2.15, -0.65], [0.55, u1]]) quad(tiles, [[f0, a, 0], [f0, c, 0], [f0, c, dh], [f0, a, dh]], 1.2);
    quad(tiles, [[f0, u0, dh], [f0, u1, dh], [f0, u1, bh], [f0, u0, bh]], 1.2);
    for (const u of [u0, u1]) quad(tiles, [[f0, u, 0], [f1, u, 0], [f1, u, bh], [f0, u, bh]], 1.2);
    quad(tiles, [[f0, u0, bh], [f0, u1, bh], [f1, u1, bh], [f1, u0, bh]], 1.2);
    box(steel, P(f0 - 0.6, (u0 + u1) / 2, 2.62), isl.sm, u1 - u0 + 0.2, 0.08, 1.2);
    const photos = mat(`bhPhoto:${station}`, () => { const map = T.bergshamraPhotos(0); return new THREE.MeshStandardMaterial({ map, emissive: 0x303030, emissiveMap: map, roughness: 0.2, side: THREE.DoubleSide }); });
    plane(photos, [P(sn - 0.04, 2.4, 0.45), P(sn - 0.04, 10.4, 0.45), P(sn - 0.04, 10.4, 2.65), P(sn - 0.04, 2.4, 2.65)]);
    // at the south end, the way into the passage, 6 m wide and 3 m high (u -2.2 to 3.8): the rock
    // round it, and its sides and white ceiling back to where the passage's own begin (where the
    // platform's floor, which stops the station's walls, ends)
    const w0 = -2.2, w1 = 3.8, H = 3, back = -88.5;
    rockAcross(ss, -edge, w0, 0, top);
    rockAcross(ss, w1, edge, 0, top);
    rockAcross(ss, w0, w1, H, top);
    over(ss);
    for (const u of [w0, w1]) rockAlong(u, ss, back, 0, H);
    const render = mat(`bhRender:${station}`, () => { const map = T.finish('whiteRender'); return new THREE.MeshStandardMaterial({ map, emissive: 0x303030, emissiveMap: map, roughness: 0.9, side: THREE.DoubleSide }); });
    const deep = Math.abs(back - ss) / 2.4, wide = (w1 - w0) / 2.4;
    plane(render, [P(ss, w0, H), P(ss, w1, H), P(back, w1, H), P(back, w0, H)], [0, 0, wide, 0, wide, deep, 0, deep]);
    // the escalators' porches: four bays 1.6 m wide standing out 1.8 m from the core's end, glass
    // in steel frames, a door in each, their roofs of glass sloping down to the front
    const glass = builder(`bhGlass:${station}`, () => new THREE.MeshStandardMaterial({ color: 0xd4dee2, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false }));
    const face = 46.5, front = 44.7, pu0 = -3.7, bay = 1.6, low = 2.5, high = 3.1;
    for (let k = 0; k < 4; k++) {
      const a = pu0 + k * bay, c = a + bay, m = (a + c) / 2;
      // the door: an opening 0.9 m wide and 2.1 m high, glass either side and over it
      quad(glass, [[front, a, 0.1], [front, m - 0.45, 0.1], [front, m - 0.45, low], [front, a, low]], 1);
      quad(glass, [[front, m + 0.45, 0.1], [front, c, 0.1], [front, c, low], [front, m + 0.45, low]], 1);
      quad(glass, [[front, m - 0.45, 2.1], [front, m + 0.45, 2.1], [front, m + 0.45, low], [front, m - 0.45, low]], 1);
      quad(glass, [[front, a, low], [front, c, low], [face, c, high], [face, a, high]], 1);
      for (const e of [m - 0.45, m + 0.45]) box(steel, P(front, e, 1.05), isl.sm, 0.05, 2.1, 0.05);
      box(steel, P(front, m, 2.1), isl.sm, 0.95, 0.05, 0.05);
    }
    for (const u of [pu0, pu0 + 4 * bay]) quad(glass, [[front, u, 0.1], [face, u, 0.1], [face, u, high], [front, u, low]], 1);
    for (let k = 0; k <= 4; k++) {
      const u = pu0 + k * bay;
      box(steel, P(front, u, low / 2), isl.sm, 0.07, low, 0.07);
      // (the rib up the roof, from the front post to the core)
      const r0 = P(front, u, low), r1 = P(face, u, high), rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, r0.distanceTo(r1)), this.mats[`bhSteel:${station}`]);
      rib.position.copy(r0).add(r1).multiplyScalar(0.5); rib.lookAt(r1); group.add(rib);
    }
    box(steel, P(front, pu0 + 2 * bay, low), isl.sm, 4 * bay + 0.07, 0.07, 0.07);
    box(steel, P(front, pu0 + 2 * bay, 0.05), isl.sm, 4 * bay + 0.07, 0.1, 0.07);
    // the name on black signs hung at the ceiling's edge along the cores, leaning out over the
    // platform, every 20 m or so; benches of pine, back to back, and steel bins between them
    const pine = builder(`bhPine:${station}`, () => new THREE.MeshStandardMaterial({ color: 0xcfaa70, emissive: 0x241c10, roughness: 0.7 }));
    const ceil = st.ceiling - S.PLATFORM_HEIGHT;
    for (const ps of [-1, 1]) {
      const s0 = isl.inner(ps), s1 = isl.outer(ps), len = Math.abs(s1 - s0), count = Math.max(1, Math.round(len / 20));
      for (let k = 0; k < count; k++) {
        const s = s0 + ((s1 - s0) * (k + 0.5)) / count;
        for (const side of [-1, 1]) {
          const w = side * (hw + 0.45), sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.42), this.signMaterial(station, 'dark'));
          sign.position.copy(isl.P(s, w, ceil - 0.45));
          sign.lookAt(isl.P(s, w + side, ceil - 1.05));
          group.add(sign);
        }
      }
      // (a bench in front of each row of glass: the middles of the rows, as placed in buildIsland)
      const rows = ps === n ? [0.5] : [0.333, 0.667];
      for (const f of rows) {
        const s = s0 + (s1 - s0) * f;
        for (const side of [-1, 1]) {
          const w = side * (hw + 1.2);
          for (const o of [-0.13, 0.13]) box(pine, isl.P(s, w + o, 0.44), isl.sm, 0.22, 0.08, 2.6);
          box(pine, isl.P(s, w, 0.62), isl.sm, 0.1, 0.28, 2.6);
          for (const e of [-1, 1]) box(steel, isl.P(s + e, w, 0.2), isl.sm, 0.46, 0.4, 0.06);
          const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.7, 14), this.mats[`bhSteel:${station}`]);
          bin.position.copy(isl.P(s + 1.9, side * (hw + 0.75), 0.35));
          group.add(bin);
        }
      }
    }
    // the stones inlaid in the floor: drifts across the passage and at the platform's southern end
    for (const [k, s, u] of [[0, 39, -6.5], [1, 37, 6.5], [2, -80, 0]]) {
      const key: MaterialName = `bhInlay:${station}${k}`;
      const m = mat(key, () => new THREE.MeshStandardMaterial({ map: T.bergshamraInlay(1978 + k), transparent: true, alphaTest: 0.1, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }));
      const g = new THREE.BufferGeometry(), corners = [P(s - 3, u - 3, 0.003), P(s + 3, u - 3, 0.003), P(s + 3, u + 3, 0.003), P(s - 3, u + 3, 0.003)];
      g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap((p) => [p.x, p.y, p.z]), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      g.setIndex([0, 2, 1, 0, 3, 2]);
      g.computeVertexNormals();
      if (g.getAttribute('normal').getY(0) < 0) { g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); }
      group.add(new THREE.Mesh(g, m));
    }
    // lamps under the low rock, where the ceiling doesn't reach: two rows of tubes across the
    // passage, and one across each end, hung on rods
    const floor = P(0, 0, 0).y - 0.3;
    for (const [s, a, c, y] of [[35.5, -12.5, 12.5, 4.5], [42.5, -12.5, 12.5, 4.5], [(isl.outer(n) * n + sn) / 2, -12, 12, 4.2], [(isl.outer(-n) * n + ss) / 2, -12, 12, 4.2]]) {
      const A = P(s, a, y), B = P(s, c, y);
      lamps.push({ a: A, b: B, power: HALL_LIGHT.power, color: TUBE, reach: HALL_LIGHT.reach, floor, top: floor + 8, down: 1 });
      box(b.lamp, P(s, (a + c) / 2, y), isl.sm, Math.abs(c - a), 0.05, 0.12);
      box(b.fitting, P(s, (a + c) / 2, y + 0.06), isl.sm, Math.abs(c - a), 0.08, 0.2);
      for (const u of [a + 1, (a + c) / 2, c - 1]) box(b.fitting, P(s, u, y + 0.8), isl.sm, 0.03, 1.5, 0.03);
    }
  }

  // A dodecahedron of glass in a frame of brass, hung from the vault over the middle of an island
  // cave's passage on a rod down through it (Tekniska högskolan's), a face level at its foot; and
  // under it the diagram inlaid in the floor. `vault` is how high the vault is over the platform.
  private dodecahedron(isl: Island, d: { size: number; at: number }, vault: number, group: THREE.Group) {
    const station = isl.station;
    const glass = (this.mats[`stGlass:${station}`] ??= new THREE.MeshStandardMaterial({ color: 0xdfe8ec, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    const brass = (this.mats[`stBrass:${station}`] ??= new THREE.MeshStandardMaterial({ color: 0xa8894f, roughness: 0.35, metalness: 0.7 }));
    const geo = new THREE.DodecahedronGeometry(d.size / 2);
    // (its first three corners are a face's: turned so that face is at its foot)
    const pos = geo.getAttribute('position');
    const [a, b, c] = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, k));
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    if (n.dot(a) < 0) n.negate();
    const q = new THREE.Quaternion().setFromUnitVectors(n, new THREE.Vector3(0, -1, 0));
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(isl.t.x, isl.t.z));
    q.premultiply(turn);
    const mid = isl.P(0, 0, d.at), lamp = new THREE.Group();
    lamp.position.copy(mid); lamp.quaternion.copy(q);
    lamp.add(new THREE.Mesh(geo, glass));
    // the frame along its edges
    const edges = new THREE.EdgesGeometry(geo).getAttribute('position'), bar = new THREE.CylinderGeometry(0.022, 0.022, 1, 6);
    for (let k = 0; k < edges.count; k += 2) {
      const p0 = new THREE.Vector3().fromBufferAttribute(edges, k), p1 = new THREE.Vector3().fromBufferAttribute(edges, k + 1);
      const m = new THREE.Mesh(bar, brass);
      m.position.copy(p0).add(p1).multiplyScalar(0.5);
      m.scale.y = p0.distanceTo(p1);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
      lamp.add(m);
    }
    group.add(lamp);
    // the rod, from its foot up to the vault
    const top = vault + 0.4, foot = d.at - d.size * 0.4;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, top - foot, 8), brass);
    rod.position.copy(isl.P(0, 0, (top + foot) / 2));
    group.add(rod);
    // the diagram in the floor, 6 m square
    const inlay = (this.mats[`stInlay:${station}`] ??= new THREE.MeshStandardMaterial({ map: T.tekniskaInlay(), transparent: true, alphaTest: 0.1, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }));
    const g = new THREE.BufferGeometry(), corners = [isl.P(-3, -3, 0.003), isl.P(3, -3, 0.003), isl.P(3, 3, 0.003), isl.P(-3, 3, 0.003)];
    g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap((p) => [p.x, p.y, p.z]), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    // (facing up, whichever way round the frame is)
    g.setIndex([0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
    if (g.getAttribute('normal').getY(0) < 0) { g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); }
    group.add(new THREE.Mesh(g, inlay));
  }

  // A styled vault's own finish (src/hall-styles.ts VaultFinish): its track walls, the wall behind
  // its platform and its vault
  private vaultMaterials(station: string, vs: VaultStyle, f: VaultFinish) {
    if (this.mats[`vaultRoof:${station}`]) return;
    for (const mirror of [false, true]) {
      this.mats[`vaultArt${mirror ? 'Mirror' : ''}:${station}`] = new THREE.MeshStandardMaterial({ map: T.gardetTrackWall(S.FLOOR, vs.fold?.track ?? vs.spring, f.trackWall, mirror), roughness: 0.4, side: THREE.DoubleSide });
    }
    this.mats[`vaultBack:${station}`] = new THREE.MeshStandardMaterial({ map: T.gardetBackWall(S.FLOOR, vs.spring, S.PLATFORM_HEIGHT, f.backWall), roughness: 0.9, side: THREE.DoubleSide });
    // (lit from below, by the lamps, which light nothing: so it glows a little, as Östermalmstorg's)
    const plaster = T.vaultPlaster();
    this.mats[`vaultRoof:${station}`] = new THREE.MeshStandardMaterial({ map: plaster, color: f.vault, emissive: 0x7f7a70, emissiveMap: plaster, roughness: 0.85, side: THREE.DoubleSide });
    // (a folded ceiling's plane over the track, darker, glowing less)
    if (vs.fold?.dark !== undefined) this.mats[`vaultRoofDark:${station}`] = new THREE.MeshStandardMaterial({ map: plaster, color: vs.fold.dark, emissive: 0x2e2d2a, emissiveMap: plaster, roughness: 0.85, side: THREE.DoubleSide });
  }

  // A styled vault's own name sign, on the band along the wall behind the platform, with a plate
  // either side of it for the ways out to the exits on that side
  private vaultSign(sm: Sample, vs: VaultStyle, group: THREE.Group) {
    const p = sm.plat!, f = vs.finish!, back = structureSpan(sm)[p.side > 0 ? 1 : 0];
    const out = new THREE.Vector3(-p.side * sm.rx, 0, -p.side * sm.rz);
    // to the right of someone facing the wall
    const right = new THREE.Vector3(-p.side * sm.rz, 0, p.side * sm.rx);
    const o = at(sm, back - p.side * 0.03, vs.signAt);
    // (none where the wall is open, over a passage through it, under its plates either side)
    for (const d of [-2.9, 0, 2.9]) {
      const q = at(sm, back - p.side * 0.4, vs.signAt - 0.3).addScaledVector(right, d);
      if (this.holes.some((v) => insideVolume(v, q.x, q.y, q.z))) return false;
    }
    const put = (m: THREE.Material, w: number, h: number, d: number) => {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      plate.position.copy(o).addScaledVector(right, d);
      plate.lookAt(plate.position.clone().add(out));
      group.add(plate);
    };
    const key = `${p.station} band`;
    let name = this.signs.get(key);
    if (!name) { name = new THREE.MeshBasicMaterial({ map: T.nameSign(p.station, f.backWall.band.sign ?? f.backWall.band.color, false) }); this.signs.set(key, name); }
    put(name, 1.7, 0.32, 0);
    const ends = f.exits.map((e) => ({ name: e.name, d: right.x * (e.x - sm.x) + right.z * (e.z - sm.z) }));
    for (const left of [true, false]) {
      const e = ends.reduce((m, q) => ((left ? q.d < m.d : q.d > m.d) ? q : m));
      if (left ? e.d >= 0 : e.d <= 0) continue;
      const k = `${e.name}|${left}`;
      let m = this.wayPlates.get(k);
      if (!m) { m = new THREE.MeshBasicMaterial({ map: T.wayPlate(e.name, left) }); this.wayPlates.set(k, m); }
      put(m, 1.6, 0.4, left ? -2.1 : 2.1);
    }
    return true;
  }

  // A styled vault's lit cases in the wall behind its platform, in pairs, about every `cases.every`
  // m, with a bench either side of each pair, where the wall isn't open to a passage; or, with
  // `cases.run`, that many side by side, standing out from the wall in frames of dark steel under
  // a dark fascia, with no benches (Hornstull's). Returns the stretches of wall the cases take.
  private vaultCases(run: Sample[], mine: (sm: Sample) => boolean, f: VaultFinish, b: Record<MaterialName, MeshBuilder>, group: THREE.Group) {
    const taken: [Sample['plat'], number, number][] = [];
    const c = f.cases!, H = S.PLATFORM_HEIGHT, n = c.run ?? 2, theme = c.theme ?? 'beetles';
    const mats = this.caseMats[theme] ??= [0, 1, 2, 3].map((v) => {
      const map = theme === 'elements' ? T.elementsCase(c.w, c.h, v) : T.beetleCase(c.w, c.h, v);
      return new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: theme === 'elements' ? 0.4 : 0.55, roughness: 0.3 });
    });
    const span = n * c.w + (n - 1) * c.gap, depth = c.run ? 0.4 : 0.02;
    const benchAt = c.gap / 2 + c.w + 0.5 + 0.8, reach = c.run ? span / 2 + 0.6 : benchAt + 0.9;
    const checks = c.run ? [-reach, -reach / 2, 0, reach / 2, reach] : [-reach, -benchAt, 0, benchAt, reach];
    let next = -Infinity, k = 0;
    for (const sm of run) {
      if (!mine(sm) || sm.along < next) continue;
      const p = sm.plat!, back = structureSpan(sm)[p.side > 0 ? 1 : 0];
      const t = new THREE.Vector3(sm.rz, 0, -sm.rx), out = new THREE.Vector3(-p.side * sm.rx, 0, -p.side * sm.rz);
      // (the wall whole along the cases and their benches, and the platform there)
      const clear = checks.every((d) => {
        const q = at(sm, back - p.side * 0.4, H + 1.0).addScaledVector(t, d);
        return !this.holes.some((o) => insideVolume(o, q.x, q.y, q.z));
      }) && run.some((q) => q.plat === p && q.along > sm.along + reach) && run.some((q) => q.plat === p && q.along < sm.along - reach);
      if (!clear) continue;
      next = sm.along + c.every;
      taken.push([p, sm.along - reach, sm.along + reach]);
      for (let i = 0; i < n; i++) {
        const d = -span / 2 + c.w / 2 + i * (c.w + c.gap);
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(c.w, c.h), mats[(k++) % 4]);
        pane.position.copy(at(sm, back - p.side * depth, c.bottom + c.h / 2)).addScaledVector(t, d);
        pane.lookAt(pane.position.clone().add(out));
        group.add(pane);
      }
      if (c.run) {
        // the frames between the cases and at their ends, the fascia over them and the plinth under
        const mid = back - p.side * (depth / 2 - 0.01);
        for (let i = 0; i <= n; i++) box(b.benchStone, at(sm, mid, c.bottom + c.h / 2).addScaledVector(t, -span / 2 - c.gap / 2 + i * (c.w + c.gap)), sm, depth + 0.02, c.h + 0.1, c.gap);
        box(b.benchStone, at(sm, mid, c.bottom + c.h + 0.17), sm, depth + 0.02, 0.34, span + 2 * c.gap);
        box(b.benchStone, at(sm, mid, (H + c.bottom) / 2), sm, depth - 0.1, c.bottom - H, span);
        continue;
      }
      for (const d of [-1, 1]) {
        // a bench: a seat of wooden slats on two steel legs, against the wall
        const seat = at(sm, back - p.side * 0.32, H + 0.44).addScaledVector(t, d * benchAt);
        for (let s = 0; s < 3; s++) box(b.benchWood, seat.clone().addScaledVector(out, (s - 1) * 0.13), sm, 0.11, 0.04, 1.6);
        for (const e of [-0.6, 0.6]) box(b.steel, at(sm, back - p.side * 0.32, H + 0.21).addScaledVector(t, d * benchAt + e), sm, 0.36, 0.42, 0.05);
      }
    }
    return taken;
  }

  // A styled vault's long benches against the wall behind its platform, about every
  // `benches.every` m, where the wall isn't open to a passage: boards of wood on a dark stone base
  // (or a pair of benches with backs), clear of the stretches `taken` by cases
  private vaultBenches(run: Sample[], mine: (sm: Sample) => boolean, f: VaultFinish, b: Record<MaterialName, MeshBuilder>, taken: [Sample['plat'], number, number][]) {
    const c = f.benches!, H = S.PLATFORM_HEIGHT, half = c.length / 2;
    let next = -Infinity;
    for (const sm of run) {
      if (!mine(sm) || sm.along < next) continue;
      const p = sm.plat!, back = structureSpan(sm)[p.side > 0 ? 1 : 0];
      const t = new THREE.Vector3(sm.rz, 0, -sm.rx), out = new THREE.Vector3(-p.side * sm.rx, 0, -p.side * sm.rz);
      // (the wall whole along it, and the platform there)
      const clear = [-half - 0.5, -half / 2, 0, half / 2, half + 0.5].every((d) => {
        const q = at(sm, back - p.side * 0.4, H + 1.0).addScaledVector(t, d);
        return !this.holes.some((o) => insideVolume(o, q.x, q.y, q.z));
      }) && run.some((q) => q.plat === p && q.along > sm.along + half + 2) && run.some((q) => q.plat === p && q.along < sm.along - half - 2)
        && !taken.some(([q, a0, a1]) => q === p && sm.along + half + 0.5 > a0 && sm.along - half - 0.5 < a1);
      if (!clear) continue;
      next = sm.along + c.every;
      if (c.backs) {
        // a pair of benches, a little apart, each of wooden boards on steel legs: two along the
        // seat and two along the back, leaning back a little
        const bw = (c.length - 0.3) / 2;
        for (const d of [-bw / 2 - 0.15, bw / 2 + 0.15]) {
          for (const k of [0, 1]) box(b.benchWood, at(sm, back - p.side * (0.42 + k * 0.17), H + 0.44).addScaledVector(t, d), sm, 0.15, 0.04, bw);
          for (const k of [0, 1]) box(b.benchWood, at(sm, back - p.side * (0.25 - k * 0.03), H + 0.62 + k * 0.2).addScaledVector(t, d), sm, 0.03, 0.15, bw);
          for (const e of [-1, 1]) {
            box(b.steel, at(sm, back - p.side * 0.42, H + 0.21).addScaledVector(t, d + e * (bw / 2 - 0.15)), sm, 0.38, 0.42, 0.05);
            box(b.steel, at(sm, back - p.side * 0.26, H + 0.65).addScaledVector(t, d + e * (bw / 2 - 0.15)), sm, 0.04, 0.5, 0.05);
          }
        }
        continue;
      }
      box(b.benchStone, at(sm, back - p.side * 0.3, H + 0.17), sm, 0.46, 0.34, c.length);
      // two boards along the seat
      for (const k of [-1, 1]) box(b.benchWood, at(sm, back - p.side * 0.3, H + 0.38).addScaledVector(out, k * 0.12), sm, 0.22, 0.08, c.length + 0.1);
    }
  }

  private caveMaterial(station: string) {
    const map = T.caveRock(CAVE_STYLES[station].paint);
    // (lit by its lamps, which light nothing: so it glows a little, as the vaults do)
    return new THREE.MeshStandardMaterial({ map, emissive: 0x5a5a5a, emissiveMap: map, roughness: 0.95, side: THREE.DoubleSide });
  }

  private signMaterial(station: string, white: boolean | 'dark' = false) {
    const key = `${station}${white ? ` ${white}` : ''}`;
    let m = this.signs.get(key);
    if (!m) {
      const map = white === 'dark' ? T.nameSign(station, '#1c1c1e') : white ? T.whiteNameSign(station.toUpperCase()) : T.nameSign(station);
      m = new THREE.MeshBasicMaterial({ map });
      this.signs.set(key, m);
    }
    return m;
  }

  // Lamps on the tunnel walls: on the outer wall of each track of a double-track tunnel every
  // 20 m, so every 10 m on alternate walls; every 7 m on one wall of a single-track tunnel.
  private lights(run: Sample[], b: Record<MaterialName, MeshBuilder>, lamps: Lamp[]) {
    let next = -Infinity;
    const row = new LampRow(lamps, HALL_LIGHT, TUBE, 1);
    for (const sm of run) {
      if (!inHall(sm) || bare(sm)) row.end();
      if ((sm.kind !== 'rock' && sm.kind !== 'box') || sm.plat || sm.along < next || bare(sm)) continue;
      if (inHall(sm)) {
        // a row of lamps under a depot hall's roof, over each track
        next = sm.along + S.DEPOT_HALL.lights;
        box(b.lamp, at(sm, 0, S.DEPOT_HALL.height - 0.05), sm, 0.3, 0.08, 1.4);
        row.add(sm, at(sm, 0, S.DEPOT_HALL.height - 0.05), 'hall');
        continue;
      }
      const single = !sm.pair;
      next = sm.along + (single ? S.TUNNEL_LIGHT.single : 2 * S.TUNNEL_LIGHT.double);
      const span = structureSpan(sm);
      // the refuge side of a single-track tunnel; the outer wall of a double-track one (where
      // another line's track is beside it, the wall there is, if any)
      let side = single ? -sm.third : -Math.sign(sm.pair);
      if (continues(sm, side)) side = -side;
      if (continues(sm, side)) continue;
      const wall = side > 0 ? span[1] : span[0];
      const c = at(sm, wall - side * 0.08, S.TUNNEL_LIGHT.height + (sm.pairDy || 0) / 2);
      box(b.lamp, c, sm, 0.1, 0.14, 1.2);
      const along = new THREE.Vector3(sm.rz, 0, -sm.rx).multiplyScalar(0.6);
      lamps.push({ ...TUNNEL_LAMP, color: BULB, down: 0.4, ...space(sm), a: c.clone().sub(along), b: c.clone().add(along) });
    }
    row.end();
  }

  // Where a tunnel opens into the open air or into a station the model draws, a concrete portal
  // around the mouth. Where its outline
  // changes at once (one kind of tunnel meets another, the line runs into a station hall, or a
  // single-track tunnel joins the other track's), a wall between the two outlines.
  private ends(samples: Sample[], i0: number, i1: number, b: Record<MaterialName, MeshBuilder>) {
    const tunnel = (sm: Sample) => (sm.kind === 'rock' || sm.kind === 'box') && !bare(sm);
    const ring = (sm: Sample, inner: [number, number][], outer: [number, number][], mb = b.concrete,
      uv = (u: number, v: number): [number, number] => [u * 0.25, v * 0.25]) => {
      const first = mb.pos.length / 3;
      for (const outline of [inner, outer]) for (const [u, v] of outline) { at(sm, u, v, _w); mb.vertex(_w.x, _w.y, _w.z, ...uv(u, v)); }
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
          const [ra, rc] = rays(a, c, middles(p), middles(q));
          // in rock, of rock; at a painted cave's end, its rock painted as the cave's is (round from
          // the floor as on its walls, across the end as along them)
          const cave = caveStyle(p) ? p : caveStyle(q) ? q : null;
          const beamed = p.vault !== q.vault ? beamedHall(p) : null, vault = beamed && (beamed.finish as BeamedHall).vault;
          if (beamed && vault?.window) {
            // where Blackeberg's vault meets its flat part: under the vault, concrete over the flat
            // ceiling and above it a lunette window in steel frames into the ticket hall (drawn
            // with one track)
            if (leads(p)) {
              const station = p.plat!.station, win = vault.window, [sa, sc] = structureSpan(p), dy = p.pairDy / 2;
              const edge: MaterialName = `beamEnd:${station}`, frame: MaterialName = `beamFrame:${station}`, pane: MaterialName = `beamPane:${station}`;
              this.mats[edge] ??= new THREE.MeshStandardMaterial({ map: T.finish('boardConcrete'), color: vault.color, roughness: 0.9, side: THREE.DoubleSide });
              this.mats[frame] ??= new THREE.MeshStandardMaterial({ color: 0x3c4146, roughness: 0.45, metalness: 0.5 });
              // (pale and clear, never dark: the hall's light comes through it)
              this.mats[pane] ??= new THREE.MeshStandardMaterial({ color: 0xc9d6dc, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
              const top = (u: number) => S.archHeight(sa, sc, beamed.soffit, vault.crown - beamed.soffit, u) + dy;
              const n = 24, us = Array.from({ length: n + 1 }, (_, k) => sa + ((sc - sa) * k) / n);
              const wall = b[edge] ??= new MeshBuilder(), steel = b[frame] ??= new MeshBuilder();
              for (let k = 0; k < n; k++) {
                const u0 = us[k], u1 = us[k + 1], t0 = top(u0), t1 = top(u1), f = win.from + dy;
                // the concrete up to the window's sill, and along the vault over it (a rim 0.25 m deep)
                const c0 = Math.min(t0, f), c1 = Math.min(t1, f), base = beamed.soffit + dy;
                wall.quad(at(p, u0, base), at(p, u1, base), at(p, u1, c1), at(p, u0, c0));
                if (t0 > f || t1 > f) {
                  const r0 = Math.max(f, t0 - 0.25), r1 = Math.max(f, t1 - 0.25);
                  wall.quad(at(p, u0, r0), at(p, u1, r1), at(p, u1, t1), at(p, u0, t0));
                  (b[pane] ??= new MeshBuilder()).quad(at(p, u0, f), at(p, u1, f), at(p, u1, r1), at(p, u0, r0));
                }
              }
              // the frames: the sill, a transom a third of the way up, and mullions
              const f = win.from + dy, crown = vault.crown + dy, lo = sa + 0.3, hi = sc - 0.3;
              const ends = us.filter((u) => top(u) - 0.25 > f + 0.05);
              const ua = ends[0] ?? (sa + sc) / 2, ub = ends[ends.length - 1] ?? (sa + sc) / 2;
              box(steel, at(p, (ua + ub) / 2, f + 0.04), p, ub - ua, 0.08, 0.08);
              const tr = f + (crown - 0.25 - f) * 0.36, span = us.filter((u) => top(u) - 0.25 > tr + 0.05);
              if (span.length > 1) box(steel, at(p, (span[0] + span[span.length - 1]) / 2, tr), p, span[span.length - 1] - span[0], 0.06, 0.06);
              const m = Math.max(1, Math.round((ub - ua) / win.frames));
              for (let k = 1; k < m; k++) {
                const u = ua + ((ub - ua) * k) / m, h = top(u) - 0.25;
                if (u > lo && u < hi && h > f) box(steel, at(p, u, (f + h) / 2), p, 0.06, h - f, 0.08);
              }
            }
          } else if (beamed && vault) {
            // where a beamed hall's vaulted part meets its flat part: a black wall over the flat
            // ceiling, a pale triangle on it, point down, facing the vault (drawn with one track)
            const station = p.plat!.station, end: MaterialName = `beamEnd:${station}`, mark: MaterialName = `beamMark:${station}`;
            this.mats[end] ??= new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.55, side: THREE.DoubleSide });
            ring(p, ra, rc, b[end] ??= new MeshBuilder());
            if (leads(p)) {
              this.mats[mark] ??= new THREE.MeshStandardMaterial({ color: 0xc4c3bd, roughness: 0.7, side: THREE.DoubleSide });
              const [sa, sc] = structureSpan(p), m = p.pair / 2, dy = p.pairDy / 2;
              // Well clear of the wall: the other track's half of it can lean a little toward the vault.
              const t = new THREE.Vector3(p.rz, 0, -p.rx).multiplyScalar(q.vault ? 0.15 : -0.15);
              const top = (u: number) => S.archHeight(sa, sc, beamed.soffit, vault.crown - beamed.soffit, u) + dy - 0.12;
              const P = (u: number, v: number) => at(p, u, v).add(t);
              (b[mark] ??= new MeshBuilder()).quad(P(m, beamed.soffit + dy + 0.02), P(m + 1.3, top(m + 1.3)), P(m - 1.3, top(m - 1.3)), P(m, beamed.soffit + dy + 0.02));
            }
          } else if (beamedHall(p) ?? beamedHall(q)) {
            // at a beamed hall's end, around the tunnel going on: its wall's tiles, without its
            // posters and band
            // (or, where they have the rock standing out of them, the rock)
            const hall = (beamedHall(p) ?? beamedHall(q))!, w = (hall.finish as BeamedHall).walls;
            const key: MaterialName = `beamEndWall:${(beamedHall(p) ? p : q).plat!.station}`;
            if (w.trees) ring(p, ra, rc, b.rock);
            else {
              this.mats[key] ??= new THREE.MeshStandardMaterial({ map: T.tiledColumn(w.color, w.tile), roughness: 0.45, side: THREE.DoubleSide });
              ring(p, ra, rc, b[key] ??= new MeshBuilder(), (u, v) => [u / T.HOTORGET_REPEAT, v / T.HOTORGET_REPEAT]);
            }
          } else if (vaultStyle(p)?.finish ?? vaultStyle(q)?.finish) {
            // at a finished vault's end (Gärdet's), round the tunnel going on: its plaster
            const hall = vaultStyle(p)?.finish ? p : q, vs = vaultStyle(hall)!, station = hall.plat!.station;
            this.vaultMaterials(station, vs, vs.finish!);
            ring(p, ra, rc, b[`vaultRoof:${station}`] ??= new MeshBuilder());
          } else if (cave) {
            const key: MaterialName = `cave:${cave.plat!.station}`;
            this.mats[key] ??= this.caveMaterial(cave.plat!.station);
            ring(p, ra, rc, b[key] ??= new MeshBuilder(), (u, v) => [caveAcross(cave, u, v) / T.CAVE_ACROSS, (caveAlong(cave, 0, 0) + u) / T.CAVE_REPEAT]);
          } else ring(p, ra, rc, p.kind === 'rock' && q.kind === 'rock' ? b.rock : b.concrete);
        }
      } else if (tunnel(p) !== tunnel(q) && !bare(p) && !bare(q)) portal(tunnel(p) ? p : q);
    }
  }
}

// ------------------------------------------------------------------ lamps
// The space a lamp in the structure at a sample lights: from the floor to the roof.
function space(sm: Sample) {
  const shell = shellOutline(sm);
  return { floor: sm.y + S.FLOOR - 0.3, top: sm.y + (shell ? Math.max(...shell.pts.map((p) => p[1])) : S.DEPOT_HALL.height) + 0.3 };
}

// A row of lamps along the track as strips of light (src/lamps.ts): the points of one row, until
// it ends or another begins.
class LampRow {
  private pts: THREE.Vector3[] = [];
  private floor = Infinity;
  private top = -Infinity;
  private of: unknown = null;
  constructor(private lamps: Lamp[], private light: { power: number; reach: number }, private color: THREE.Color, private down: number) {}
  add(sm: Sample, p: THREE.Vector3, of: unknown) {
    if (of !== this.of) this.end();
    this.of = of;
    this.pts.push(p);
    const { floor, top } = space(sm);
    this.floor = Math.min(this.floor, floor);
    this.top = Math.max(this.top, top);
  }
  end() {
    if (this.pts.length) stripLamps(this.pts, { ...this.light, color: this.color, down: this.down, floor: this.floor, top: this.top }, this.lamps);
    this.pts = [];
    this.floor = Infinity;
    this.top = -Infinity;
    this.of = null;
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
  // another line's track beside it in the same box or on the same deck: as far again beyond it
  const far = sm.kind === 'bridge' ? S.BRIDGE.deck : S.ROCK.doubleWall;
  if (sm.beside > 0) b = Math.max(b, sm.beside + far); else if (sm.beside < 0) a = Math.min(a, sm.beside - far);
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
  // a hall wide enough for a platform beside the track (an island's is shared with the track
  // across it, to its middle)
  const p = sm.plat;
  if (p && (sm.kind === 'rock' || sm.kind === 'box') && !(p.island && across(sm))) {
    const o = p.side * (S.PLATFORM_EDGE + p.width + S.HALL.behindPlatform);
    if (p.side > 0) b = Math.max(b, o); else a = Math.min(a, o);
  }
  return [a, b];
}

// The part of a span this track draws: where it shares the structure, its own side of the middle
// (and a little over), on either side.
function ownSpan(sm: Sample, [a, b]: [number, number]): [number, number] {
  for (const v of [sm.pair, sm.beside]) {
    if (v > 0) b = v / 2 + OVERLAP; else if (v < 0) a = v / 2 - OVERLAP;
  }
  return [a, b];
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
const continues = (sm: Sample, side: number) => (sm.yard ? shares(sm, side) > 0
  : (!!sm.pair && Math.sign(sm.pair) === side) || (!!sm.beside && Math.sign(sm.beside) === side));
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

// The track across an island platform that shares its hall: its own line's other track, or
// another line's beside it (Gamla stan's); its offset, or 0.
function across(sm: Sample) {
  const p = sm.plat;
  if (!p?.island) return 0;
  return Math.sign(sm.pair) === p.side ? sm.pair : Math.sign(sm.beside) === p.side ? sm.beside : 0;
}

function platformOuter(sm: Sample) {
  const p = sm.plat!, v = across(sm);
  if (v) return v / 2 + p.side * OVERLAP;
  // (a finished vault's, out to its wall)
  if (vaultStyle(sm)?.finish) return p.side * (S.PLATFORM_EDGE + p.width + S.HALL.behindPlatform - 0.01);
  // out to the middle track's edge (its distance is positive: no service runs on it)
  const d = p.side > 0 ? sm.right : sm.left;
  if (p.reach && d > 0) return p.side * (d - S.PLATFORM_EDGE);
  // (an island under a hall a station draws, Liljeholmen's, where its tracks close in: to halfway
  // to the next track)
  if (p.island && d && openStyle(sm)?.hall) return p.side * Math.max(S.PLATFORM_EDGE + 0.05, Math.min(S.PLATFORM_EDGE + p.width, Math.abs(d) / 2));
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
    const vs = sm.plat ? vaultStyle(sm) : null;
    const cv = caveStyle(sm)?.vault;
    if (cv) { spring = cv.spring; rise = cv.crown - cv.spring; }
    else if (sm.plat) {
      spring = vs?.spring ?? S.HALL.spring; rise = width * (vs?.risePerWidth ?? S.HALL.risePerWidth);
    }
    else if (sm.pair) {
      spring = S.ROCK.doubleSpring;
      rise = ((S.ROCK.doubleCrown - S.ROCK.doubleSpring) * width) / (2 * S.ROCK.doubleWall + S.TRACK_CENTRES);
    } else { spring = S.ROCK.singleSpring; rise = S.ROCK.singleCrown - S.ROCK.singleSpring; }
    if (vs?.fold) {
      // (a folded ceiling: its two planes, from the wall at a to the ridge and on to the wall at b)
      full.push([a, vaultRoof(vs, sm, a, b, a)], [sm.plat!.side * vs.fold.ridge, vs.fold.crown], [b, vaultRoof(vs, sm, a, b, b)]);
    } else {
      full.push([a, spring]);
      const n = 16;
      for (let i = 1; i < n; i++) {
        const u = a + (width * i) / n;
        full.push([u, S.archHeight(a, b, spring, rise, u)]);
      }
      full.push([b, spring]);
    }
  }
  full.push([b, S.FLOOR]);
  // the part to draw, as distances along the outline
  const cum = [0];
  for (let i = 1; i < full.length; i++) cum.push(cum[i - 1] + Math.hypot(full[i][0] - full[i - 1][0], full[i][1] - full[i - 1][1]));
  const total = cum[cum.length - 1];
  let t0 = 0, t1 = total;
  if (sm.pair || sm.beside) {
    const [o0, o1] = ownSpan(sm, [a, b]);
    // where the roof passes over a cut
    const over = (cut: number) => {
      for (let i = 1; i < full.length; i++) {
        const [u0] = full[i - 1], [u1] = full[i];
        if ((u0 - cut) * (u1 - cut) <= 0 && u1 !== u0 && full[i][1] > 1) return cum[i - 1] + ((cut - u0) / (u1 - u0)) * (cum[i] - cum[i - 1]);
      }
      return total / 2;
    };
    if (sm.pair > 0 || sm.beside > 0) t1 = over(o1);
    if (sm.pair < 0 || sm.beside < 0) t0 = over(o0);
    // (over an island cave's opening in its ceiling, the roof stops at its edge)
    const slot = openingAt(sm);
    if (slot && sm.pair > 0) t1 = Math.min(t1, over(sm.pair / 2 - slot));
    if (slot && sm.pair < 0) t0 = Math.max(t0, over(sm.pair / 2 + slot));
  }
  const pts: [number, number][] = [];
  // the roof is shared, between the two tracks' levels at the middle; with a track on either side,
  // it slopes from one middle to the other
  const dy = (u: number) => {
    const p = sm.pair ? sm.pairDy / 2 : 0, q = sm.beside ? sm.besideDy / 2 : 0;
    if (!sm.pair || !sm.beside) return p + q;
    const f = Math.max(0, Math.min(1, (u - sm.pair / 2) / (sm.beside / 2 - sm.pair / 2)));
    return p + (q - p) * f;
  };
  for (let j = 0; j < SHELL_POINTS; j++) {
    const t = t0 + ((t1 - t0) * j) / (SHELL_POINTS - 1);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < t) i++;
    const f = (t - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    const u = full[i - 1][0] + (full[i][0] - full[i - 1][0]) * f, v = full[i - 1][1] + (full[i][1] - full[i - 1][1]) * f;
    // the floor stays with this track's rails
    pts.push([u, v + (v > S.FLOOR + 0.01 ? dy(u) * Math.min(1, (v - S.FLOOR) / 2) : 0)]);
  }
  if (caveStyle(sm)) return { key: `cave${Math.sign(sm.pair)}`, pts: roughen(sm, pts) };
  return { key: `${sm.kind}${Math.sign(sm.pair)}${sm.beside ? `b${Math.sign(sm.beside)}` : ''}`, pts };
}

// A styled hall's outline (src/hall-styles.ts), the island platform's two tracks sharing it: the
// walls up to the soffit, over each track to the inner face of its row of columns, then up to the ceiling between
// them; this track's half, to just over the middle. Its corners are kept, unlike the vaults'.
function hallStyle(sm: Sample): HallStyle | null {
  const p = sm.plat;
  return p && p.island && sm.pair && across(sm) === sm.pair && (sm.kind === 'rock' || sm.kind === 'box') ? HALL_STYLES[p.station] ?? null : null;
}
// A painted cave (src/hall-styles.ts): a station hall in rock, its rock left rough and painted.
function caveStyle(sm: Sample): CaveStyle | null {
  const p = sm.plat;
  return p && sm.kind === 'rock' ? CAVE_STYLES[p.station] ?? null : null;
}
// An island cave (src/hall-styles.ts): a painted cave with the rock left standing down the middle
// of its island platform, Stadion's; where two tracks share its hall.
function islandStyle(sm: Sample): CaveIsland | null {
  const p = sm.plat;
  if (!p || !p.island || !sm.pair) return null;
  // (or where it carries on into a concrete box: Masmo's)
  const box = CAVE_STYLES[p.station]?.island;
  return caveStyle(sm)?.island ?? (box?.box && sm.kind === 'box' ? box : null);
}
// What of an island cave's ceiling is left open: over the passage between its pillars (their
// half-width, the passage's half-length, and how far the opening reaches past their rough
// corners), or over its stairs.
function islandOpening(st: CaveIsland) {
  if (st.pillars) return { hw: st.pillars.width / 2, gap: st.pillars.gap / 2, margin: 1.2 };
  return { hw: (st.opening?.width ?? 0) / 2, gap: (st.opening?.length ?? 0) / 2, margin: 0 };
}
// An island cave's ceiling's height over the rail: under the roof, where it is in a box.
function islandCeilingAt(st: CaveIsland, sm: Sample) {
  return sm.kind === 'box' ? Math.min(st.ceiling, S.BOX.height - 0.15) : st.ceiling;
}

// A styled open station (src/open-styles.ts): a platform out in the open, under its own roof.
function openStyle(sm: Sample): OpenStyle | null {
  const p = sm.plat;
  return p && ((sm.kind !== 'rock' && sm.kind !== 'box') || hallDrawn(sm.x, sm.z)) ? OPEN_STYLES[p.station] ?? null : null;
}
// A flat hall in concrete (src/hall-styles.ts): Farsta strand's; or a beamed one, Skanstull's, which
// is paved, lit and signed as one.
function concreteHall(sm: Sample): FlatHall | null {
  const st = hallStyle(sm);
  return st?.kind === 'flat' && (st.finish.kind === 'concrete' || st.finish.kind === 'beams') ? st : null;
}
// Of two tracks sharing a hall, the one that draws what stands down the middle between them: the
// one with the other to its east (or, due north–south of each other, to its south). (Not by the
// sign of `pair`: two tracks laid in opposite directions each have the other to their left.)
function leads(sm: Sample) {
  const dx = sm.rx * sm.pair, dz = sm.rz * sm.pair;
  return Math.abs(dx) > 1e-3 ? dx > 0 : dz > 0;
}
// A beamed hall (src/hall-styles.ts): Skanstull's.
function beamedHall(sm: Sample): FlatHall | null {
  const st = hallStyle(sm);
  return st?.kind === 'flat' && st.finish.kind === 'beams' ? st : null;
}
// A platform paved in its own style (src/open-styles.ts): a styled open station's, a flat hall's
// in concrete or on beams, or a cave's.
function pavingOf(sm: Sample): Paving | null {
  return openStyle(sm)?.paving ?? ((concreteHall(sm)?.finish as ConcreteHall | BeamedHall | undefined)?.paving ?? caveStyle(sm)?.paving ?? (islandStyle(sm) ? CAVE_STYLES[sm.plat!.station].paving : undefined) ?? vaultStyle(sm)?.finish?.paving ?? null);
}

// An island cave's frame: s along the platform from its middle, w across it from the line down
// its middle towards the track on its right (looking along `t`), y up from the platform's top.
interface Island {
  station: string;
  st: CaveIsland;
  sm: Sample;          // the middle of the platform on the track on its left: its across is w
  o: THREE.Vector3;
  t: THREE.Vector3;
  n: THREE.Vector3;
  half: number;        // half the platform's length
  hall: [number, number]; // where its two tracks share the hall, along s (their ends a little apart)
  top: number;         // a little over the hall's crown, over the platform
  mid: number;         // the passage's middle, along s
  // the pillar towards -s's (`ps` -1) or +s's (1) outer end, along s, and its end by the passage
  outer(ps: number): number;
  inner(ps: number): number;
  P(s: number, w: number, y: number): THREE.Vector3;
  s(p: { x: number; z: number }): number;
  w(p: { x: number; z: number }): number;
  // how far to the right of a sample's track a point w across the frame is
  uAt(sm: Sample, w: number): number;
}

// the island caves, by station, once the network has found them
const ISLANDS = new Map<string, Island>();
// Over an island cave's opening in its ceiling with no pillars (Masmo's, over its stairs), the
// opening's half-width; elsewhere 0.
function openingAt(sm: Sample) {
  const isl = sm.plat ? ISLANDS.get(sm.plat.station) : undefined, o = isl?.st.opening;
  if (!isl || !o || isl.st.pillars) return 0;
  return Math.abs(isl.s(sm) - isl.mid) < o.length / 2 ? o.width / 2 : 0;
}

function islands(all: Sample[][]): Island[] {
  const out: Island[] = [];
  // (a track may pass more than one: Stadion's and Tekniska högskolan's are on the same pieces)
  for (const samples of all) for (const first of samples.filter((sm) => islandStyle(sm) && sm.pair > 0)) {
    if (out.some((isl) => isl.station === first.plat!.station)) continue;
    const on = samples.filter((sm) => sm.plat === first.plat);
    const a0 = on[0].along, a1 = on[on.length - 1].along, mid = (a0 + a1) / 2;
    const i = on.findIndex((sm, j) => j + 1 < on.length && sm.along <= mid && on[j + 1].along > mid);
    const sm = i < 0 ? on[0] : lerpSample(on[i], on[i + 1], (mid - on[i].along) / (on[i + 1].along - on[i].along || 1));
    const o = at(sm, sm.pair / 2, S.PLATFORM_HEIGHT + sm.pairDy / 4);
    const t = new THREE.Vector3(sm.rz, 0, -sm.rx), n = new THREE.Vector3(sm.rx, 0, sm.rz);
    const span = structureSpan(sm), crown = S.HALL.spring + (span[1] - span[0]) * S.HALL.risePerWidth + sm.pairDy / 2;
    const s = (p: { x: number; z: number }) => (p.x - o.x) * t.x + (p.z - o.z) * t.z;
    const w = (p: { x: number; z: number }) => (p.x - o.x) * n.x + (p.z - o.z) * n.z;
    // (the passage north of the middle, and the ends north and south, by which way s runs)
    // (with no pillars, the opening over the stairs, and the platform open to its ends)
    const st = islandStyle(first)!, north = t.z < 0 ? 1 : -1, half = (a1 - a0) / 2, gap = islandOpening(st).gap;
    const e = st.pillars?.ends ?? 0, [south, nth] = typeof e === 'number' ? [e, e] : e;
    const passage = (st.pillars?.at ?? st.opening?.at ?? 0) * north, ends = north > 0 ? [south, nth] : [nth, south];
    const shared = on.filter((q) => islandStyle(q)).map(s);
    out.push({
      station: first.plat!.station, st, sm, o, t, n, half, hall: [Math.min(...shared), Math.max(...shared)], top: crown - S.PLATFORM_HEIGHT + 1.2,
      mid: passage, outer: (ps) => ps * (half - ends[ps > 0 ? 1 : 0]), inner: (ps) => passage + ps * gap,
      P: (s, w, y) => new THREE.Vector3(o.x + t.x * s + n.x * w, o.y + y, o.z + t.z * s + n.z * w),
      s, w,
      uAt: (q, wq) => (wq - w(q)) / (q.rx * n.x + q.rz * n.z),
    });
  }
  return out;
}

// The wall of a shared hall on this track's side (away from the other track).
function sm0Wall(sm: Sample, span: [number, number]) {
  return sm.pair > 0 ? span[0] : span[1];
}

// A rectangle with rounded corners, in the island's frame, `hl` and `hw` half its length and
// width, its outline about `step` apart, from the middle of its side at -w round by +s: each
// point with its outward normal and its distance round.
function roundedRect(c: number, hl: number, hw: number, rc: number, step: number) {
  const pts: { s: number; w: number; ns: number; nw: number; d: number }[] = [];
  const line = (s0: number, w0: number, s1: number, w1: number, ns: number, nw: number) => {
    const n = Math.max(1, Math.round(Math.hypot(s1 - s0, w1 - w0) / step));
    for (let k = 0; k < n; k++) pts.push({ s: s0 + ((s1 - s0) * k) / n, w: w0 + ((w1 - w0) * k) / n, ns, nw, d: 0 });
  };
  const arc = (cs: number, cw: number, a0: number) => {
    const n = Math.max(2, Math.round((rc * Math.PI) / 2 / step));
    for (let k = 0; k < n; k++) {
      const a = a0 + ((Math.PI / 2) * k) / n;
      pts.push({ s: cs + rc * Math.cos(a), w: cw + rc * Math.sin(a), ns: Math.cos(a), nw: Math.sin(a), d: 0 });
    }
  };
  const s0 = c - hl + rc, s1 = c + hl - rc, w0 = -hw + rc, w1 = hw - rc;
  line(s0, -hw, s1, -hw, 0, -1); arc(s1, w0, -Math.PI / 2);
  line(c + hl, w0, c + hl, w1, 1, 0); arc(s1, w1, 0);
  line(s1, hw, s0, hw, 0, 1); arc(s0, w1, Math.PI / 2);
  line(c - hl, w1, c - hl, w0, -1, 0); arc(s0, w0, Math.PI);
  pts.push({ ...pts[0] });
  for (let k = 1; k < pts.length; k++) pts[k].d = pts[k - 1].d + Math.hypot(pts[k].s - pts[k - 1].s, pts[k].w - pts[k - 1].w);
  return pts;
}

// The pillars' rock, and the walls over the passage: pushed out and in by up to this much in
// lumps (smooth noise in [-1, 1], from where they are).
const PILLAR_ROUGH = 0.4, PORTAL_ROUGH = 0.25, VAULT_ROUGH = 0.4;
function bump(p: THREE.Vector3) {
  return lumps(p.x / 3.2, p.y / 2.4, p.z / 3.2) * 0.5 + lumps(p.x / 1.3 + 17, p.y / 1.1, p.z / 1.3) * 0.35 + lumps(p.x / 0.5 + 31, p.y / 0.45, p.z / 0.5) * 0.15;
}
function islandRock(paint: CaveStyle['paint']) {
  const map = T.caveRock(paint);
  // (lit by lamps which light nothing: so it glows a little, as the caves do, if less, for its
  // lumps to show)
  return new THREE.MeshStandardMaterial({ map, emissive: 0x404040, emissiveMap: map, roughness: 0.95, side: THREE.DoubleSide });
}
// The pale stone along the edge of an island cave's platform.
const ISLAND_EDGE = 0.8;

// A cave's rock is the vault's outline pushed in and out by up to CAVE_ROUGH, in lumps a few
// metres across that depend only on where they are, so that the halves of a hall two tracks share
// meet; the foot of each wall stays where it is.
const CAVE_ROUGH = 0.45;
function caveInward(sm: Sample, u: number, v: number) {
  const p = at(sm, u, v);
  const n = lumps(p.x / 4.5, p.y / 3, p.z / 4.5) * 0.7 + lumps(p.x / 1.6 + 17, p.y / 1.4, p.z / 1.6) * 0.3;
  // (smooth over a ceiling that hides it)
  const vault = caveStyle(sm)?.vault, smooth = vault ? Math.max(0, Math.min(1, (vault.spring - v) / 0.6)) : 1;
  return n * CAVE_ROUGH * Math.min(1, Math.max(0, (v - S.FLOOR) / 1.4)) * smooth;
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
// The height of a styled vault's ceiling at u, across a sample's hall from a to c: its arch, or a
// folded ceiling's planes, from the walls up to the ridge (src/hall-styles.ts VaultStyle.fold)
function vaultRoof(vs: VaultStyle, sm: Sample, a: number, c: number, u: number) {
  const f = vs.fold;
  if (!f) return S.archHeight(a, c, vs.spring, (c - a) * vs.risePerWidth, u);
  const side = sm.plat!.side, ridge = side * f.ridge, wall = side > 0 ? c : a, track = side > 0 ? a : c;
  const towardWall = (u - ridge) * side >= 0, end = towardWall ? wall : track;
  const t = Math.min(1, Math.abs(u - ridge) / Math.max(0.01, Math.abs(end - ridge)));
  return f.crown + ((towardWall ? vs.spring : f.track) - f.crown) * t;
}

function vaultStyle(sm: Sample): VaultStyle | null {
  const p = sm.plat;
  return p && !p.island && !sm.pair && sm.kind === 'rock' ? VAULT_STYLES[p.station] ?? null : null;
}
function styledOutline(sm: Sample, a: number, b: number, st: HallStyle): { key: string; pts: [number, number][] } {
  if (st.kind === 'vault') return vaultOutline(sm, a, b, st.spring, st.crown, 'vault');
  // (a beamed hall's vaulted part: its walls as high as the flat part's)
  const vault = sm.vault && st.finish.kind === 'beams' ? st.finish.vault : undefined;
  if (vault) return vaultOutline(sm, a, b, st.soffit, vault.crown, 'beamVault');
  const [lo, hi] = stepAt(sm, st);
  // (the walls running into the soffit in a quarter-round cove, where it has one)
  const k = st.cove ?? 0, n = k ? 6 : 0;
  const cove = (u: number, side: number) => Array.from({ length: n + 1 }, (_, i): [number, number] => {
    const t = ((side < 0 ? n - i : i) / n) * (Math.PI / 2);
    return [u - side * k * (1 - Math.sin(t)), st.soffit - k * (1 - Math.cos(t))];
  });
  const full: [number, number][] = [[a, S.FLOOR], ...(k ? cove(a, -1) : [[a, st.soffit] as [number, number]]), [lo, st.soffit], [lo + st.step, st.ceiling],
    [hi - st.step, st.ceiling], [hi, st.soffit], ...(k ? cove(b, 1) : [[b, st.soffit] as [number, number]]), [b, S.FLOOR]];
  const [o0, o1] = ownSpan(sm, [a, b]);
  const pts: [number, number][] = sm.pair > 0
    ? [...full.filter(([u]) => u < o1), [o1, st.ceiling]]
    : [[o0, st.ceiling], ...full.filter(([u]) => u > o0)];
  const dy = sm.pairDy / 2;
  return { key: `styled${Math.sign(sm.pair)}`, pts: pts.map(([u, v]) => [u, v + (v > S.FLOOR + 0.01 ? dy * Math.min(1, (v - S.FLOOR) / 2) : 0)]) };
}

// A beamed hall's columns: enamelled, ringed with colours, tiled, or in exposed-aggregate
// concrete, as its finish says.
function beamColumnMaterial(f: BeamedHall) {
  if (f.columnClay) return new THREE.MeshStandardMaterial({ map: T.clayColumn(f.columnClay), roughness: 0.5 });
  if (f.rings) return new THREE.MeshStandardMaterial({ map: T.ringedColumn(f.column, f.rings), roughness: 0.18 });
  if (f.columnTile) return new THREE.MeshStandardMaterial({ map: T.tiledColumn(f.column, f.columnTile), roughness: 0.35 });
  if (f.aggregate) return new THREE.MeshStandardMaterial({ map: T.aggregate(f.column), roughness: 0.85 });
  return new THREE.MeshStandardMaterial({ color: f.column, roughness: 0.18 });
}

// Where a flat hall's roof begins to step up from the soffit, either side (u, from this track):
// at the far faces of the columns, or, stepping outside them, a step short of their near faces.
function stepAt(sm: Sample, st: FlatHall): [number, number] {
  const { fromEdge, size } = st.columns;
  const s = sm.plat!.side, d = S.PLATFORM_EDGE + fromEdge + (st.stepOutside ? -size / 2 - st.step : size / 2);
  const c1 = s * d, c2 = sm.pair - s * d;
  return [Math.min(c1, c2), Math.max(c1, c2)];
}
// The height of a flat hall's roof at u, across from this track (over the rail, before the tracks'
// difference in height).
function flatRoof(sm: Sample, st: FlatHall, u: number) {
  const [lo, hi] = stepAt(sm, st), d = Math.min(u - lo, hi - u);
  return d <= 0 ? st.soffit : d >= st.step ? st.ceiling : st.soffit + ((st.ceiling - st.soffit) * d) / st.step;
}

// A vaulted hall's outline (Karlaplan's, or a beamed hall's vaulted part): straight walls up to the
// spring, and one segmental vault over both tracks, its crown over the middle of the platform;
// this track's half, to just over the middle, with the corner at the spring kept.
function vaultOutline(sm: Sample, a: number, b: number, spring: number, crown: number, key: string): { key: string; pts: [number, number][] } {
  const [o0, o1] = ownSpan(sm, [a, b]), n = 14;
  const arc = (u: number): [number, number] => [u, S.archHeight(a, b, spring, crown - spring, u)];
  const pts: [number, number][] = [];
  if (sm.pair > 0) {
    pts.push([a, S.FLOOR], [a, spring]);
    for (let i = 1; i <= n; i++) pts.push(arc(a + ((o1 - a) * i) / n));
  } else {
    for (let i = 0; i < n; i++) pts.push(arc(o0 + ((b - o0) * i) / n));
    pts.push([b, spring], [b, S.FLOOR]);
  }
  const dy = sm.pairDy / 2;
  return { key: `${key}${Math.sign(sm.pair)}`, pts: pts.map(([u, v]) => [u, v + (v > S.FLOOR + 0.01 ? dy * Math.min(1, (v - S.FLOOR) / 2) : 0)]) };
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
  if (!sm.pair && !sm.beside) return o;
  const out = [...o];
  if (sm.pair > 0 || sm.beside > 0) out.push([o[o.length - 1][0], S.FLOOR]);
  if (sm.pair < 0 || sm.beside < 0) out.unshift([o[0][0], S.FLOOR]);
  return out;
}

// Where a track shares its tunnel, the middles its part is closed down: [u, side] (side +1 where
// the other track is to the right). The half of a shared tunnel has one, and another where
// another line's track is beside it on the other side; in a depot hall, a track has one on each
// side another of the depot's tracks is beside it.
function middles(sm: Sample): [number, number][] {
  const o = shellOutline(sm)!.pts;
  if (inHall(sm)) {
    const out: [number, number][] = [];
    if (shares(sm, -1) > 0) out.push([o[0][0], -1]);
    if (shares(sm, 1) > 0) out.push([o[o.length - 1][0], 1]);
    return out;
  }
  return [sm.pair, sm.beside].filter((v) => v).map((v) => (v > 0 ? [o[o.length - 1][0], 1] : [o[0][0], -1]));
}

// Two outlines, each closed along its floor, met by the same rays from a point over the track, all
// the way round: the edges of the wall between two tunnels of different shapes. There is a ray
// through every corner of either, and the last ray is the first again. Where one is the half of a
// shared tunnel, or a track's part of a depot hall (`ma`, `mb`: its middles), the other is cut off
// at that middle: beyond it is the other track's part, or its own tunnel, which this one opens
// into. (Where two of a depot's tracks part at a switch, the hall starts from the single tunnel
// round the switch, and each track's part of it must leave the other's track open.)
function rays(a: [number, number][], b: [number, number][], ma: [number, number][] = [], mb: [number, number][] = [], n = 48): [[number, number][], [number, number][]] {
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
    for (const [u, side] of ma) if (Math.abs(ha[0] - u) < 1e-6 && (hb[0] - u) * side > 0) hb = ha;
    for (const [u, side] of mb) if (Math.abs(hb[0] - u) < 1e-6 && (ha[0] - u) * side > 0) ha = hb;
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

// A round column standing at `c` from y0 to y1 above it, `size` across, its tiles in metres round
// it and up it (1 m to a repeat of the texture).
function roundPillar(b: MeshBuilder, c: THREE.Vector3, size: number, y0: number, y1: number) {
  const r = size / 2, n = 16, arc = (Math.PI * size) / n;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, e = ((k + 1) / n) * Math.PI * 2;
    const P = (t: number, y: number) => new THREE.Vector3(c.x + Math.cos(t) * r, c.y + y, c.z + Math.sin(t) * r);
    b.quad(P(e, y0), P(a, y0), P(a, y1), P(e, y1), [(k + 1) * arc, y0], [k * arc, y0], [k * arc, y1], [(k + 1) * arc, y1]);
  }
}

// A styled hall's neon (Gun Gordillo's at Hötorget): tubes wandering along under the ceiling
// between the columns, now and then across, each at its own height, hung on thin rods; in a few
// tones of white. `plat` is one track's samples along the platform; none hang where the station's
// stairs and escalators (`holes`) come down into the hall.
function neon(plat: Sample[], st: FlatHall, holes: Volume[]) {
  // (only for a hall with neon)
  const tubing = st.neon!;
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
  const tubes: THREE.BufferGeometry[][] = tubing.tones.map(() => []);
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
  const { reach, below } = tubing;
  for (let n = 0; n < tubing.count; n++) {
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
  tubing.tones.forEach((tone, k) => {
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
// The samples with the platform on the other side as theirs, for the second pass that draws it.
const oppositeOf = (run: Sample[]): Sample[] => run.map((sm) => ({ ...sm, plat: sm.opposite, opposite: null }));

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
    const ba = g.beside?.[i] ?? 0, bb = g.beside?.[i + 1] ?? 0;
    const beside = ba && bb && Math.sign(ba) === Math.sign(bb) ? ba + (bb - ba) * t : g.beside?.[near] ?? 0;
    const besideDy = !beside ? 0 : ba && bb && Math.sign(ba) === Math.sign(bb) ? lerp(g.besideDy!, q) : g.besideDy?.[near] ?? 0;
    const ga = g.ground[i], gb = g.ground[i + 1];
    const ground = ga !== null && gb !== null ? ga + (gb - ga) * t : g.ground[near];
    // the tracks beside it: where both points have one, in between; otherwise the nearer point's
    const nearest = (arr: number[] | undefined) => {
      if (!arr) return 0;
      const a = arr[i], b = arr[i + 1];
      return a && b && Math.sign(a) === Math.sign(b) ? a + (b - a) * t : arr[near];
    };
    const left = nearest(g.left), right = nearest(g.right);
    const se = lerp(g.s, e);
    const plat = platforms.find((p) => se >= p.s0 && se <= p.s1) ?? null;
    const opposite = plat && platforms.find((p) => p.side !== plat.side && se >= p.s0 && se <= p.s1) || null;
    const third: 1 | -1 = plat ? (-plat.side as 1 | -1) : pair ? (pair > 0 ? -1 : 1) : beside ? (beside > 0 ? -1 : 1) : (dir > 0 ? -1 : 1);
    const skip = exclude.some((x) => !x.trackOnly && se >= x.s0 && se <= x.s1);
    const noTrack = skip || exclude.some((x) => se >= x.s0 && se <= x.s1);
    const v = plat ? vaults.get(plat) : undefined;
    const vault = typeof v === 'object' ? (e > v.q) === v.after : !!v;
    return { s, kind: STRUCTURE_KINDS[g.kind[near]], pair, pairDy, beside, besideDy, left, right, yard, ground, plat, opposite, third, skip, noTrack, vault };
  };
  // where something changes
  const breaks = new Set<number>();
  for (let i = 0; i + 1 < n; i++) {
    if (g.kind[i] !== g.kind[i + 1] || !g.pair[i] !== !g.pair[i + 1] || !g.beside?.[i] !== !g.beside?.[i + 1]) breaks.add(i + 0.5);
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
  // where a beamed hall's vaulted part begins: the parameter there, and whether the part is after it
  const vaults = new Map<GeometryPlatform, { q: number; after: boolean } | boolean>();
  for (const p of platforms) {
    const st = HALL_STYLES[p.station], v = st?.kind === 'flat' && st.finish.kind === 'beams' ? st.finish.vault : undefined;
    if (!v) continue;
    const f = (q: number) => (cr(q, 'x') - v.from[0]) * (v.toward[0] - v.from[0]) + (cr(q, 'z') - v.from[1]) * (v.toward[1] - v.from[1]);
    let lo = qAt(Math.max(p.s0, g.s[0])), hi = qAt(Math.min(p.s1, g.s[n - 1]));
    const flo = f(lo), fhi = f(hi);
    if ((flo >= 0) === (fhi >= 0)) { vaults.set(p, flo >= 0); continue; }
    for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if ((f(m) >= 0) === (flo >= 0)) lo = m; else hi = m; }
    const q = (lo + hi) / 2;
    vaults.set(p, { q, after: fhi >= 0 });
    breaks.add(q);
  }
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
    || !sm.pair !== !out[i - 1].pair || !sm.beside !== !out[i - 1].beside || sm.plat !== out[i - 1].plat || sm.opposite !== out[i - 1].opposite || sm.vault !== out[i - 1].vault || sm.skip !== out[i - 1].skip || sm.noTrack !== out[i - 1].noTrack
    || !shares(sm, -1) !== !shares(out[i - 1], -1) || !shares(sm, 1) !== !shares(out[i - 1], 1)
    || bare(sm) !== bare(out[i - 1]) || !widened(sm, -1) !== !widened(out[i - 1], -1) || !widened(sm, 1) !== !widened(out[i - 1], 1));
}
