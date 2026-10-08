import * as THREE from 'three';
import { SurfaceIndex } from './surface-index';
import type { SurfaceHit } from './surface-index';
import { extractCenterlines, splitComponents, sweep, vkey } from './polyline';
import { classifyColor } from './model-colors';
import type { RecordKind } from './model-colors';
import type { Polyline, Tri } from './polyline';
import { LINES, TRAIN_SPECS, lineAt } from './lines';
import { HOME_STATION, stationOf } from './station-models';
import type { GaugeSpec, LineId } from './lines';
import * as T from './textures';
import { prism } from './clip';
import type { Volume } from './clip';
import { BULB, TUBE, addLamps, stripLamps } from './lamps';
import type { Lamp } from './lamps';

// The source model is an extruded 2D drawing: floor slabs, stair ramps, escalator tubes,
// lift shafts, ticket gates and tracks, each identified only by its colour. This module turns
// it into a walkable station: classifies every piece, builds walls/railings/platform edges,
// track beds and tunnels, and indexes every walkable surface.

export interface SurfaceRecord {
  name: string;
  station: string; // the model it is in (src/station-models.ts)
  kind: RecordKind;
  color: THREE.Color;
  box: THREE.Box3;
  size: THREE.Vector3;
  top: Tri[];
  side: Tri[];
  bottom: Tri[];
  all: Tri[];
  line?: LineId;
  platformLine?: LineId;
  platformLines?: Set<LineId>;
  label?: string;
}

export interface SurfaceData { kind: 'floor' | 'stairs' | 'escalator'; rec: SurfaceRecord }
export interface TrackData { line: LineId }
export type WalkHit = SurfaceHit<SurfaceData>;

export interface Platform { s0: number; s1: number; side: number; rec: SurfaceRecord }
export interface Board { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; text: string }
// `drawn` is the stretch of the path the station draws track along, with no tunnels of its own:
// the track network (src/network.ts) draws the rest. Without it, the station draws the whole
// path, and tunnels beyond the platform.
export interface Track { line: LineId; station: string; path: Polyline; platform: Platform | null; dir: number; board?: Board; drawn?: [number, number] }

export interface StationOptions {
  // called once the tracks and their platforms are found, before anything is built along them:
  // may replace a track's path, and set the stretch the station draws
  join?: (tracks: Track[]) => void;
}

export interface LiftLevel { y: number; pos: THREE.Vector3; yaw: number }
export interface Lift { center: THREE.Vector3; radius: number; minY: number; maxY: number; levels: LiftLevel[] }
export interface Teleport { label: string; line: LineId; station: string; pos: THREE.Vector3; yaw: number }
// The box round each model's floors, by station.
export interface StationArea { name: string; bounds: THREE.Box3 }

export interface Station {
  group: THREE.Group;
  mapGroup: THREE.Group;
  walk: SurfaceIndex<SurfaceData>;
  trackIdx: SurfaceIndex<TrackData>;
  tracks: Track[];
  lifts: Lift[];
  teleports: Teleport[];
  spawn: Teleport;
  bounds: THREE.Box3; // the home station's (src/station-models.ts), for the minimap
  areas: StationArea[];
  records: SurfaceRecord[];
}

type UV = [number, number];


class Builder {
  pos: number[];
  uv: number[];
  col: number[];
  constructor() { this.pos = []; this.uv = []; this.col = []; }
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, uva: UV, uvb: UV, uvc: UV, color?: THREE.Color) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.uv.push(uva[0], uva[1], uvb[0], uvb[1], uvc[0], uvc[1]);
    if (color) for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
  }
  quad(
    a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3,
    ua: UV, ub: UV, uc: UV, ud: UV, color?: THREE.Color,
  ) {
    this.tri(a, b, c, ua, ub, uc, color);
    this.tri(a, c, d, ua, uc, ud, color);
  }
  get empty() { return this.pos.length === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function buildStation(root: THREE.Object3D, opts: StationOptions = {}): Station {
  const group = new THREE.Group();
  const mapGroup = new THREE.Group(); // simplified flat-shaded copy for the minimap
  const walk = new SurfaceIndex<SurfaceData>(4);
  const trackIdx = new SurfaceIndex<TrackData>(4);
  const records: SurfaceRecord[] = [];

  // ---------------------------------------------------------------- 1. read & classify
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const o = obj as THREE.Mesh;
    const mat = o.material as { color?: THREE.Color } | undefined;
    let g = o.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    g.applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    const color = mat?.color ? mat.color.clone() : new THREE.Color(0.6, 0.6, 0.6);
    let kind = classifyColor(color);
    g.computeBoundingBox();
    const box = g.boundingBox!.clone();
    const size = box.getSize(new THREE.Vector3());
    if (kind === 'lightblue') kind = Math.max(size.x, size.z) < 5.5 && size.y > 5 ? 'elevator' : 'tube';
    const rec: SurfaceRecord = { name: o.name, station: stationOf(o), kind, color, box, size, top: [], side: [], bottom: [], all: [] };
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i += 3) {
      const tri = [0, 1, 2].map((k) => V(p.getX(i + k), p.getY(i + k), p.getZ(i + k))) as Tri;
      const ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
      rec.all.push(tri);
      (ny > 0.35 ? rec.top : ny < -0.35 ? rec.bottom : rec.side).push(tri);
    }
    // Guard against inverted normals: the "top" faces must be the higher ones.
    const meanY = (ts: Tri[]) => ts.reduce((s, t) => s + t[0].y + t[1].y + t[2].y, 0) / (3 * ts.length || 1);
    if (rec.top.length && rec.bottom.length && meanY(rec.top) < meanY(rec.bottom)) {
      [rec.top, rec.bottom] = [rec.bottom, rec.top];
    }
    records.push(rec);
  });

  // ---------------------------------------------------------------- 2. surfaces
  const B = {
    floorTop: new Builder(), slabSide: new Builder(), slabBottom: new Builder(),
    stairTop: new Builder(), tubeGlass: new Builder(), tubeFloor: new Builder(),
    elevator: new Builder(), gates: new Builder(), deco: new Builder(),
  };
  const mapB = { floors: new Builder() };
  const lineMap: Partial<Record<LineId, Builder>> = {};
  const planar = (p: THREE.Vector3): UV => [p.x / 2, p.z / 2];
  const sideUV = (p: THREE.Vector3): UV => [(p.x + p.z) / 2, p.y / 2];
  const darker = (c: THREE.Color, k: number) => c.clone().multiplyScalar(k);

  const rampUV = (tris: Tri[], stepsPerMetre: number) => {
    // Treads run perpendicular to the steepest-descent direction.
    const n = new THREE.Vector3();
    for (const t of tris) {
      n.add(new THREE.Vector3().subVectors(t[1], t[0]).cross(new THREE.Vector3().subVectors(t[2], t[0])));
    }
    const d = new THREE.Vector2(n.x, n.z);
    if (d.lengthSq() < 1e-9) d.set(1, 0);
    d.normalize();
    return (p: THREE.Vector3): UV => [(p.x * -d.y + p.z * d.x) / 2, (p.x * d.x + p.z * d.y) * stepsPerMetre];
  };

  const trackComponents: { line: LineId; station: string; tris: Tri[] }[] = [];
  const elevators: SurfaceRecord[] = [];

  for (const rec of records) {
    const c = rec.color;
    switch (rec.kind) {
      case 'floor':
      case 'stairs': {
        const top = rec.kind === 'floor' ? B.floorTop : B.stairTop;
        const uv = rec.kind === 'floor' ? planar : rampUV(rec.top, 1 / 2.4);
        for (const t of rec.top) {
          // (floors' tops wait for their platforms to be found: T-Centralen's are drawn in their own look)
          if (rec.kind === 'stairs') top.tri(t[0], t[1], t[2], uv(t[0]), uv(t[1]), uv(t[2]), c);
          walk.add(t[0], t[1], t[2], { kind: rec.kind, rec });
          mapB.floors.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0], darker(c, rec.kind === 'floor' ? 0.62 : 0.8));
        }
        for (const t of rec.side) B.slabSide.tri(t[0], t[1], t[2], sideUV(t[0]), sideUV(t[1]), sideUV(t[2]), darker(c, 0.8));
        for (const t of rec.bottom) B.slabBottom.tri(t[0], t[1], t[2], planar(t[0]), planar(t[1]), planar(t[2]), darker(c, 0.55));
        break;
      }
      case 'tube': {
        // Escalator drawn as a solid volume: walk on its floor (bottom face + 1 m) inside a glass tube.
        for (const t of rec.all) B.tubeGlass.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0]);
        const uv = rampUV(rec.bottom, 1 / 2.4);
        for (const t of rec.bottom) {
          const s = t.map((v) => v.clone().setY(v.y + 1));
          B.tubeFloor.tri(s[0], s[1], s[2], uv(s[0]), uv(s[1]), uv(s[2]));
          walk.add(s[0], s[1], s[2], { kind: 'escalator', rec });
        }
        for (const t of rec.top) mapB.floors.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0], c);
        break;
      }
      case 'elevator': {
        for (const t of rec.all) B.elevator.tri(t[0], t[1], t[2], sideUV(t[0]), sideUV(t[1]), sideUV(t[2]));
        for (const t of rec.top) mapB.floors.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0], c);
        elevators.push(rec);
        break;
      }
      case 'gates':
        for (const t of rec.all) B.gates.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0]);
        for (const t of rec.top) mapB.floors.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0], c);
        break;
      case 'deco':
        for (const t of rec.all) B.deco.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0], c);
        break;
      default: {
        if (!rec.kind.startsWith('track:')) break;
        const line = rec.kind.slice(6) as LineId;
        rec.line = line;
        (lineMap[line] ||= new Builder());
        for (const t of rec.top) {
          trackIdx.add(t[0], t[1], t[2], { line });
          lineMap[line].tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0]);
        }
        for (const comp of splitComponents(rec.top)) trackComponents.push({ line, station: rec.station, tris: comp });
      }
    }
  }

  const tex = {
    floor: T.floorTiles(), stairs: T.stairTreads(), escalator: T.escalatorSteps(),
    wall: T.wallTiles(), cave: T.caveVines(), concrete: T.concrete(), rock: T.tunnelRock(), bed: T.trackBed(),
  };
  const tc = tcMaterials();
  const mats = {
    floorTop: new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.floor, roughness: 0.55, metalness: 0.0 }),
    slabSide: new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.concrete, roughness: 0.9, side: THREE.DoubleSide }),
    slabBottom: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    stairTop: new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.stairs, roughness: 0.7 }),
    tubeGlass: new THREE.MeshStandardMaterial({
      color: 0xaecbff, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1,
      side: THREE.DoubleSide, depthWrite: false,
    }),
    tubeFloor: new THREE.MeshStandardMaterial({ map: tex.escalator, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }),
    elevator: new THREE.MeshStandardMaterial({
      color: 0x9fc0ff, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.2,
      emissive: 0x1d3b6e, emissiveIntensity: 0.6, side: THREE.DoubleSide,
    }),
    gates: new THREE.MeshStandardMaterial({ color: 0xffa21a, roughness: 0.5, metalness: 0.3 }),
    deco: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
    wall: new THREE.MeshStandardMaterial({ map: tex.wall, roughness: 0.45, side: THREE.DoubleSide }),
    cave: new THREE.MeshStandardMaterial({ map: tex.cave, roughness: 0.85, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xcfe6ff, transparent: true, opacity: 0.18, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false,
    }),
    handrail: new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 0.3, metalness: 0.8, side: THREE.DoubleSide }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
    bed: new THREE.MeshStandardMaterial({ map: tex.bed, roughness: 1 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x8d9399, roughness: 0.3, metalness: 0.9 }),
    tunnel: new THREE.MeshStandardMaterial({ map: tex.rock, roughness: 1, side: THREE.DoubleSide }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff7e6 }),
    tunnelLamp: new THREE.MeshBasicMaterial({ color: 0xffd48a }),
  };

  const addMesh = (builder: Builder, mat: THREE.Material, opts: { renderOrder?: number } = {}) => {
    if (builder.empty) return null;
    const m = new THREE.Mesh(builder.build(), mat);
    if (opts.renderOrder) m.renderOrder = opts.renderOrder;
    group.add(m);
    return m;
  };
  for (const k of ['slabSide', 'slabBottom', 'stairTop', 'tubeFloor', 'gates', 'deco'] as const) addMesh(B[k], mats[k]);
  addMesh(B.elevator, mats.elevator, { renderOrder: 2 });
  addMesh(B.tubeGlass, mats.tubeGlass, { renderOrder: 3 });

  // Minimap copy: flat colours, original track ribbons in line colours.
  const mapFloor = new THREE.Mesh(mapB.floors.build(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mapGroup.add(mapFloor);
  for (const [line, b] of Object.entries(lineMap) as [LineId, Builder][]) {
    const m = new THREE.Mesh(b.build(), new THREE.MeshBasicMaterial({ color: LINES[line].color, side: THREE.DoubleSide }));
    m.position.y = 3; // keep tracks visible on top of floors in the top-down view
    m.renderOrder = 1;
    mapGroup.add(m);
  }

  // ---------------------------------------------------------------- 3. tracks
  const tracks: Track[] = [];
  const hits: WalkHit[] = [];
  for (const comp of trackComponents) {
    for (const pl of extractCenterlines(comp.tris)) {
      tracks.push(analyseTrack(pl, comp.line, comp.station, walk, hits));
    }
  }
  assignDirections(tracks);
  opts.join?.(tracks);
  const halls = tcHalls(records);
  const hallOf = (tr: Track) => (tr.platform ? halls.get(tr.platform.rec) ?? null : null);

  // the floors' tops, T-Centralen's platforms in their own stone and tiles
  const tcFloor = { upper: new Builder(), lower: new Builder(), blue: new Builder() };
  for (const rec of records) {
    if (rec.kind !== 'floor') continue;
    const hall = halls.get(rec);
    for (const t of rec.top) {
      if (hall) tcFloor[hall].tri(t[0], t[1], t[2], planar(t[0]), planar(t[1]), planar(t[2]));
      else B.floorTop.tri(t[0], t[1], t[2], planar(t[0]), planar(t[1]), planar(t[2]), rec.color);
    }
  }
  addMesh(B.floorTop, mats.floorTop);
  for (const h of HALLS) addMesh(tcFloor[h], tc[h].floor);

  const bedB = new Builder(), railGeoms: THREE.BufferGeometry[] = [], tunnelGeoms: THREE.BufferGeometry[] = [], caveGeoms: THREE.BufferGeometry[] = [], trackWallGeoms: THREE.BufferGeometry[] = [], lampB = new Builder(), tunnelLampB = new Builder();
  const signs: THREE.Group[] = [];
  // the light of the platforms' rows of tubes and the tunnels' lamps underground (src/lamps.ts)
  const lamps: Lamp[] = [];
  for (const tr of tracks) {
    const spec = TRAIN_SPECS[LINES[tr.line].kind];
    const [d0, d1] = tr.drawn ?? [0, tr.path.length];
    const pts = tr.path.resample(d0, d1, 2);
    const bedHalf = spec.halfWidth + 0.9;
    railGeoms.push(sweep(pts.map((p) => p.clone().setY(p.y - 1.15)), [[-bedHalf, 0], [bedHalf, 0]], { uScale: 0.25, vScale: 0.25 }));
    for (const g of [-0.72, 0.72]) {
      railGeoms.push(sweep(pts.map((p) => p.clone().setY(p.y - 1.15)), [[g - 0.04, 0], [g - 0.04, 0.16], [g + 0.04, 0.16], [g + 0.04, 0]]));
      railGeoms[railGeoms.length - 1].userData.rail = true;
    }
    const underground = LINES[tr.line].kind === 'metro' || LINES[tr.line].kind === 'commuter';
    const hall = hallOf(tr);
    if (tr.platform && !underground) addPlatformFurniture(tr, spec, lampB, signs);
    if (tr.platform && underground) {
      const W = spec.halfWidth + 1.15;
      const prof: [number, number][] = [[-W, -1.25], [-W, 2.4]];
      for (let i = 1; i < 12; i++) {
        const a = Math.PI - (i / 12) * Math.PI;
        prof.push([Math.cos(a) * W, 2.4 + Math.sin(a) * W * 0.8]);
      }
      prof.push([W, 2.4], [W, -1.25]);
      const { s0, s1 } = tr.platform;
      const ranges = tr.drawn ? [] : [[0, s0 - 6], [s1 + 6, tr.path.length]];
      for (const [a, b] of ranges) {
        if (b - a < 4) continue;
        const seg = tr.path.resample(a, b, 2);
        tunnelGeoms.push(sweep(seg, prof, { uScale: 0.15, vScale: 0.15 }));
        // small lamps along the tunnel wall
        for (let s = a + 6; s < b; s += 22) {
          const p = tr.path.pointAt(s), r = tr.path.rightAt(s);
          const q = p.clone().addScaledVector(r, -(W - 0.05)).setY(p.y + 2.2);
          boxInto(tunnelLampB, q, 0.12, 0.25, 0.12);
          const t = tr.path.tangentAt(s).multiplyScalar(0.6);
          lamps.push({ power: 2.5, reach: 9, color: BULB, down: 0.4, a: q.clone().sub(t), b: q.clone().add(t), floor: p.y - 1.5, top: p.y + 5.5 });
        }
      }
      // Rock / tiled wall behind the track, curving over towards the platform.
      const far = -tr.platform.side * W, k = tr.platform.side;
      const farClear = !neighbourBeyond(tr, -tr.platform.side, W, walk, trackIdx, hits);
      const wallProf: [number, number][] = [[far, -1.25], [far, 3.0], [far + k * 0.7, 4.2], [far + k * 1.9, 5.1], [far + k * 3.6, 5.6]];
      const run = tr.path.resample(Math.max(0, s0 - 6), Math.min(tr.path.length, s1 + 6), 2);
      const blue = tr.line === 'blue';
      if (hall) {
        // T-Centralen's halls: the wall in its own look, the name on plates along it
        const look = tcTrackWall(hall, tr.line);
        if (farClear) {
          // the blue line's is blasted rock: higher, rounder and rough
          const g = hall === 'blue'
            ? tcRough(sweep(tr.path.resample(Math.max(0, s0 - 6), Math.min(tr.path.length, s1 + 6), 0.7), tcCaveProfile(far, k), { uScale: 1 / T.TC_WALL.height, vScale: 1 / look.repeat, swapUV: true }), tr.path.pointAt(s0).y, -k, tr)
            : sweep(run, wallProf, { uScale: 1 / T.TC_WALL.height, vScale: 1 / look.repeat, swapUV: true });
          group.add(new THREE.Mesh(g, tc[look.key]));
          signs.push(...tcPlates(tr, far + k * 0.03, tc.plate[hall]));
        }
      } else if (farClear) (blue ? caveGeoms : trackWallGeoms).push(sweep(run, wallProf, { uScale: blue ? 0.2 : 0.5, vScale: blue ? 0.2 : 0.5, swapUV: true }));
      const row = addPlatformFurniture(tr, spec, lampB, signs, !!hall);
      const ys = row.map((q) => q.y);
      stripLamps(row, { power: 1.6, reach: 16, color: TUBE, down: 1, floor: Math.min(...ys) - 5, top: Math.max(...ys) + 5 }, lamps);
    }
  }
  if (!bedB.empty) addMesh(bedB, mats.bed);
  for (const g of railGeoms) {
    const m = new THREE.Mesh(g, g.userData.rail ? mats.rail : mats.bed);
    group.add(m);
  }
  for (const g of tunnelGeoms) group.add(new THREE.Mesh(g, mats.tunnel));
  for (const g of caveGeoms) group.add(new THREE.Mesh(g, mats.cave));
  for (const g of trackWallGeoms) group.add(new THREE.Mesh(g, mats.wall));
  addMesh(lampB, mats.lamp);
  addMesh(tunnelLampB, mats.tunnelLamp);
  for (const s of signs) group.add(s);

  // ---------------------------------------------------------------- 4. walls, railings, platform edges
  // T-Centralen's halls get a ceiling over the platform and the tracks, between the tops of the walls
  for (const hall of HALLS) {
    const ceil = new Builder();
    const hallTracks = tracks.filter((tr) => hallOf(tr) === hall);
    for (const tr of hallTracks) {
      const partner = hallTracks.find((o) => o !== tr && o.platform!.rec === tr.platform!.rec);
      if (partner) tcCeiling(tr, partner, hall === 'blue' ? TC_CAVE_TOP : TC_CEILING, walk, elevators, hits, ceil, hall === 'blue' ? 1 / 8 : 1 / 2, hall === 'blue');
    }
    addMesh(ceil, tc[hall].ceiling);
  }

  const W = buildEdges(records, walk, trackIdx, halls);
  addMesh(W.wall, mats.wall);
  for (const h of HALLS) {
    addMesh(W.tc[h], tc[h].end);
  }
  addMesh(W.band, tc.band);
  addMesh(W.tactile, tc.tactile);
  addMesh(W.cave, mats.cave);
  addMesh(W.handrail, mats.handrail);
  addMesh(W.yellow, mats.yellow);
  addMesh(W.glass, mats.glass, { renderOrder: 4 });

  // ---------------------------------------------------------------- 5. lifts
  const lifts = buildLifts(elevators, walk, hits);
  addLamps(group, [...lamps, ...concourseLamps(records, walk, hits)]);

  // ---------------------------------------------------------------- 6. labels, spawn, teleports
  const LABEL: Record<LineId, string> = { blue: 'Blue line', red: 'Red line', green: 'Green line', pink: 'Pendeltåg', main: 'Stockholm C', tram: 'Tram 7' };
  for (const rec of records) {
    if (rec.platformLines) {
      const ls = [...rec.platformLines].sort((a, b) => Object.keys(LABEL).indexOf(a) - Object.keys(LABEL).indexOf(b));
      const nums = ls.flatMap((l) => LINES[l].numbers);
      const names = ls.map((l) => LABEL[l]);
      rec.label = (rec.station === HOME_STATION ? '' : `${rec.station} · `)
        + (names.length > 1 ? names.map((n) => n.replace(' line', '')).join('/') + ' line' : names[0]) + ' platform'
        + (nums.length ? ` · ${nums.join(' ')}` : '');
    } else if (rec.kind === 'stairs') rec.label = 'Stairs';
    else if (rec.kind === 'tube') rec.label = 'Escalator';
    else rec.label = 'Concourse';
  }

  const teleports: Teleport[] = [];
  const seen = new Set<SurfaceRecord>();
  for (const tr of tracks) {
    if (!tr.platform || seen.has(tr.platform.rec)) continue;
    seen.add(tr.platform.rec);
    const spot = platformSpot(tr, walk, hits, lifts);
    if (spot) teleports.push({ label: tr.platform.rec.label!, line: tr.line, station: tr.station, ...spot });
  }
  // the home station's first, then the others' in the order they were loaded
  const order = ['blue', 'red', 'green', 'pink', 'main', 'tram'];
  const stationOrder = [...new Set(records.map((r) => r.station))];
  teleports.sort((a, b) => stationOrder.indexOf(a.station) - stationOrder.indexOf(b.station)
    || order.indexOf(a.line) - order.indexOf(b.line) || b.pos.y - a.pos.y);
  const dupes = new Map<string, Teleport[]>();
  for (const t of teleports) dupes.set(t.label, [...(dupes.get(t.label) || []), t]);
  for (const list of dupes.values()) {
    if (list.length !== 2) continue;
    const [a, b] = list;
    const dy = a.pos.y - b.pos.y, dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z;
    let names: string[];
    if (Math.abs(dy) > 1) names = dy > 0 ? ['upper', 'lower'] : ['lower', 'upper'];
    else if (Math.abs(dx) > Math.abs(dz)) names = dx < 0 ? ['west', 'east'] : ['east', 'west'];
    else names = dz < 0 ? ['north', 'south'] : ['south', 'north'];
    a.label += ` (${names[0]})`; b.label += ` (${names[1]})`;
  }
  const spawn = teleports.find((t) => t.line === 'blue' && t.station === HOME_STATION) || teleports[0];

  const areas: StationArea[] = [];
  for (const r of records) {
    let a = areas.find((q) => q.name === r.station);
    if (!a) areas.push(a = { name: r.station, bounds: new THREE.Box3() });
    a.bounds.union(r.box);
  }
  const bounds = (areas.find((a) => a.name === HOME_STATION) ?? areas[0]).bounds;

  return { group, mapGroup, walk, trackIdx, tracks, lifts, teleports, spawn, bounds, areas, records };
}

// Light over the models' concourses: rows of tubes 3 m over each floor, 8 m apart down its longer
// side, wherever the floor is under them (the drawings have no ceilings to hang them from, so they
// aren't drawn). T-Centralen's levels over its street level are out in the open.
function concourseLamps(records: SurfaceRecord[], walk: SurfaceIndex<SurfaceData>, hits: WalkHit[]) {
  const SPACING = 8, STEP = 2, HEIGHT = 3;
  const lamps: Lamp[] = [];
  for (const rec of records) {
    if (rec.kind !== 'floor' || rec.platformLines || (rec.station === HOME_STATION && rec.box.max.y > 3.5)) continue;
    const { min, max } = rec.box;
    const alongX = rec.size.x >= rec.size.z;
    const [a0, a1, c0, c1] = alongX ? [min.x, max.x, min.z, max.z] : [min.z, max.z, min.x, max.x];
    const rows = Math.max(1, Math.round((c1 - c0) / SPACING));
    for (let r = 0; r < rows; r++) {
      const c = c0 + ((c1 - c0) * (r + 0.5)) / rows;
      let row: THREE.Vector3[] = [];
      const end = () => {
        if (row.length > 1) stripLamps(row, { power: 1.4, reach: 12, color: TUBE, down: 1, floor: row[0].y - HEIGHT - 0.3, top: row[0].y + 0.3 }, lamps);
        row = [];
      };
      for (let a = a0 + STEP / 2; a < a1; a += STEP) {
        const [x, z] = alongX ? [a, c] : [c, a];
        const on = walk.query(x, z, hits).find((h) => h.data.rec === rec);
        if (!on || (row.length && Math.abs(on.y + HEIGHT - row[0].y) > 0.1)) end();
        if (on) row.push(new THREE.Vector3(x, on.y + HEIGHT, z));
      }
      end();
    }
  }
  return lamps;
}

// The spaces of a model's floors, stairs, escalators and lifts, to be cut out of the city's ground
// where they come up through it (src/city.ts): from a little under each floor to a storey over it,
// so the ground opens over a stairwell where it reaches the street. Not the home station's:
// T-Centralen's upper levels lie under the streets and squares the city draws over them.
export function modelGroundCuts(station: Station): Volume[] {
  const cuts: Volume[] = [];
  const HEADROOM = 3;
  const tri = (t: Tri, lift = 0) => {
    // (not a sliver, which has no plane through it)
    if (Math.abs((t[1].x - t[0].x) * (t[2].z - t[0].z) - (t[1].z - t[0].z) * (t[2].x - t[0].x)) < 0.02) return;
    cuts.push(prism(t.map((v) => [v.x, v.z] as [number, number]), t.map((v) => v.y + lift - 0.3), t.map((v) => v.y + lift + HEADROOM)));
  };
  for (const r of station.records) {
    if (r.station === HOME_STATION) continue;
    if (r.kind === 'floor' || r.kind === 'stairs') for (const t of r.top) tri(t);
    else if (r.kind === 'tube') for (const t of r.bottom) tri(t, 1);
    else if (r.kind === 'elevator') {
      const { min, max } = r.box;
      const plan: [number, number][] = [[min.x, min.z], [max.x, min.z], [max.x, max.z], [min.x, max.z]];
      cuts.push(prism(plan, plan.map(() => min.y), plan.map(() => max.y + 1)));
    }
  }
  return cuts;
}

// ------------------------------------------------------------------ helpers

function boxInto(b: Builder, c: THREE.Vector3, hx: number, hy: number, hz: number) {
  const p = (x: number, y: number, z: number) => V(c.x + x, c.y + y, c.z + z);
  const f = [
    [p(-hx, -hy, hz), p(hx, -hy, hz), p(hx, hy, hz), p(-hx, hy, hz)],
    [p(hx, -hy, -hz), p(-hx, -hy, -hz), p(-hx, hy, -hz), p(hx, hy, -hz)],
    [p(-hx, -hy, -hz), p(-hx, -hy, hz), p(-hx, hy, hz), p(-hx, hy, -hz)],
    [p(hx, -hy, hz), p(hx, -hy, -hz), p(hx, hy, -hz), p(hx, hy, hz)],
    [p(-hx, hy, hz), p(hx, hy, hz), p(hx, hy, -hz), p(-hx, hy, -hz)],
    [p(-hx, -hy, -hz), p(hx, -hy, -hz), p(hx, -hy, hz), p(-hx, -hy, hz)],
  ];
  for (const q of f) b.quad(q[0], q[1], q[2], q[3], [0, 0], [1, 0], [1, 1], [0, 1]);
}

interface Sample { s: number; side: number; d: number; rec: SurfaceRecord }
interface SampleRun { i0: number; i1: number; items: Sample[] }

// Finds the platform alongside a track and shifts the track so a train's side meets the platform edge.
function analyseTrack(path: Polyline, line: LineId, station: string, walk: SurfaceIndex<SurfaceData>, hits: WalkHit[]) {
  const spec = TRAIN_SPECS[LINES[line].kind];
  const step = 2;
  const samples: (Sample | null)[] = [];
  const p = new THREE.Vector3(), r = new THREE.Vector3();
  for (let s = 0; s <= path.length; s += step) {
    path.pointAt(s, p); path.rightAt(s, r);
    let found: Sample | null = null;
    for (const side of [1, -1]) {
      for (let d = 0.3; d <= 4.8 && !found; d += 0.3) {
        walk.query(p.x + r.x * side * d, p.z + r.z * side * d, hits);
        const h = hits.find((q) => q.data.kind === 'floor' && Math.abs(q.y - p.y) < 0.9);
        if (h) found = { s, side, d, rec: h.data.rec };
      }
      if (found) break;
    }
    samples.push(found);
  }
  // Dominant side, then the longest run of samples with a platform on that side (small gaps allowed).
  const count: Record<number, number> = { 1: 0, '-1': 0 };
  for (const f of samples) if (f) count[f.side]++;
  const side = count[1] >= count[-1] ? 1 : -1;
  let best = null as SampleRun | null, cur = null as SampleRun | null, gap = 0;
  samples.forEach((f, i) => {
    if (f && f.side === side) {
      if (!cur) cur = { i0: i, i1: i, items: [] };
      cur.i1 = i; cur.items.push(f); gap = 0;
    } else if (cur && ++gap > 3) {
      if (!best || cur.items.length > best.items.length) best = cur;
      cur = null; gap = 0;
    }
  });
  if (cur && (!best || cur.items.length > best.items.length)) best = cur;

  const track: Track = { line, station, path, platform: null, dir: 1 };
  if (best && (best.i1 - best.i0) * step >= 40) {
    const ds = best.items.map((f) => f.d).sort((a, b) => a - b);
    const edge = ds[ds.length >> 1] - 0.15;
    const recCount = new Map<SurfaceRecord, number>();
    for (const f of best.items) recCount.set(f.rec, (recCount.get(f.rec) || 0) + 1);
    const rec = [...recCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
    rec.platformLine ||= line;
    (rec.platformLines ||= new Set()).add(line);
    track.path = path.offset(side * (edge - 0.12 - spec.halfWidth));
    track.platform = { s0: best.i0 * step, s1: best.i1 * step, side, rec };
  }
  return track;
}

// Running directions. The Stockholm metro keeps left, so the two tracks at an island platform run
// opposite ways with the platform on each train's right. On the red/green levels the lines swap
// sides: the upper level has green northbound and red southbound, the lower level green southbound
// and red northbound.
function assignDirections(tracks: Track[]) {
  for (const tr of tracks) if (tr.platform) tr.dir = tr.platform.side;
}

// Is there another track or a floor just beyond the far side of this track (so no wall belongs there)?
function neighbourBeyond(
  tr: Track, dirSign: number, W: number, walk: SurfaceIndex<SurfaceData>, trackIdx: SurfaceIndex<TrackData>, hits: WalkHit[],
) {
  const trackHits: SurfaceHit<TrackData>[] = [];
  const p = new THREE.Vector3(), r = new THREE.Vector3();
  const { s0, s1 } = tr.platform!;
  let found = 0, total = 0;
  for (let s = s0; s <= s1; s += 6) {
    tr.path.pointAt(s, p); tr.path.rightAt(s, r);
    total++;
    for (let d = W - 1.2; d <= W + 4; d += 0.4) {
      const x = p.x + r.x * dirSign * d, z = p.z + r.z * dirSign * d;
      trackIdx.query(x, z, trackHits);
      let hit = trackHits.some((q) => Math.abs(q.y - p.y) < 1.5);
      if (!hit) { walk.query(x, z, hits); hit = hits.some((q) => Math.abs(q.y - p.y) < 1.5); }
      if (hit) { found++; break; }
    }
  }
  return found > total * 0.25;
}

// Lamps and signs along a platform; returns the line of lamps.
function addPlatformFurniture(tr: Track, spec: GaugeSpec, lampB: Builder, signs: THREE.Group[], plates = false) {
  const L = LINES[tr.line];
  const { s0, s1, side } = tr.platform!;
  const edgeOff = side * (spec.halfWidth + 0.12);
  const p = new THREE.Vector3(), r = new THREE.Vector3(), t = new THREE.Vector3();

  // Fluorescent light strip above the platform edge.
  const row: THREE.Vector3[] = [];
  for (let s = s0 + 3; s < s1 - 3; s += 3.2) {
    tr.path.pointAt(s, p); tr.path.rightAt(s, r);
    const c = p.clone().addScaledVector(r, edgeOff + side * 2.4).setY(p.y + 3.45);
    row.push(c);
    tr.path.tangentAt(s, t);
    const ang = Math.atan2(t.x, t.z);
    // oriented box approximated by a rotated thin quad pair
    const a = c.clone().addScaledVector(t, -1.4), b = c.clone().addScaledVector(t, 1.4);
    const w = r.clone().multiplyScalar(0.09);
    lampB.quad(a.clone().sub(w), b.clone().sub(w), b.clone().add(w), a.clone().add(w), [0, 0], [1, 0], [1, 1], [0, 1]);
    void ang;
  }

  // Station name signs facing the track (unless the name is on plates on the wall).
  const signTex = T.nameSign(lineAt(tr.station, tr.line).sign, L.signBg);
  const signMat = new THREE.MeshBasicMaterial({ map: signTex });
  const signGeo = new THREE.PlaneGeometry(3.6, 0.68);
  const backGeo = signGeo.clone().rotateY(Math.PI);
  const len = s1 - s0;
  const nSigns = plates ? 0 : Math.max(2, Math.floor(len / 38));
  for (let i = 0; i < nSigns; i++) {
    const s = s0 + ((i + 0.5) / nSigns) * len;
    tr.path.pointAt(s, p); tr.path.rightAt(s, r);
    const m = new THREE.Group();
    m.add(new THREE.Mesh(signGeo, signMat), new THREE.Mesh(backGeo, signMat));
    m.position.copy(p).addScaledVector(r, edgeOff + side * 0.9).setY(p.y + 2.75);
    m.lookAt(m.position.clone().addScaledVector(r, -side));
    signs.push(m);
  }

  if (!L.dest) return row;
  // Departure board (texture updated by the train system).
  const can = document.createElement('canvas');
  can.width = 512; can.height = 128;
  const btex = new THREE.CanvasTexture(can);
  btex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: btex }));
  const back = face.clone(); back.rotation.y = Math.PI;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.72, 0.1), new THREE.MeshStandardMaterial({ color: 0x23272d }));
  face.position.z = 0.06; back.position.z = -0.06;
  board.add(frame, face, back);
  const sm = (s0 + s1) / 2 + (tr.dir > 0 ? 1 : -1) * len * 0.18;
  tr.path.pointAt(sm, p); tr.path.rightAt(sm, r); tr.path.tangentAt(sm, t);
  board.position.copy(p).addScaledVector(r, edgeOff + side * 3.2).setY(p.y + 3.0);
  board.lookAt(board.position.clone().addScaledVector(t, 1));
  signs.push(board);
  tr.board = { canvas: can, texture: btex, text: '' };
  return row;
}

// Builds walls, glass railings and yellow safety lines along the outline of every walkable slab.
function buildEdges(records: SurfaceRecord[], walk: SurfaceIndex<SurfaceData>, trackIdx: SurfaceIndex<TrackData>, halls: Map<SurfaceRecord, TcHall>) {
  const out = {
    wall: new Builder(), cave: new Builder(), glass: new Builder(), handrail: new Builder(), yellow: new Builder(),
    tc: { upper: new Builder(), lower: new Builder(), blue: new Builder() }, band: new Builder(), tactile: new Builder(),
  };
  const hits: WalkHit[] = [], trackHits: SurfaceHit<TrackData>[] = [];
  const OPEN = 0, PLATFORM = 1, RAILING = 2, WALL = 3;

  const classify = (x: number, y: number, z: number, nx: number, nz: number) => {
    for (const d of [0.2, 0.55, 0.9]) {
      walk.query(x + nx * d, z + nz * d, hits);
      if (hits.some((q) => Math.abs(q.y - y) < 0.7)) return OPEN;
    }
    for (const d of [0.3, 0.8, 1.4, 2.2, 3.2]) {
      trackIdx.query(x + nx * d, z + nz * d, trackHits);
      if (trackHits.some((q) => y - q.y > -0.4 && y - q.y < 1.8)) return PLATFORM;
    }
    walk.query(x + nx * 1.2, z + nz * 1.2, hits);
    if (hits.some((q) => q.y < y - 0.7 && q.y > y - 30)) return RAILING;
    return WALL;
  };
  const headroom = (x: number, y: number, z: number) => {
    walk.query(x, z, hits);
    let h = 4.2;
    for (const q of hits) if (q.y > y + 1.6) h = Math.min(h, q.y - 1.0 - y - 0.03);
    return Math.max(1.2, h);
  };

  for (const rec of records) {
    if (rec.kind !== 'floor' && rec.kind !== 'stairs') continue;
    const edges = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; n: number }>();
    for (const t of rec.top) {
      for (let e = 0; e < 3; e++) {
        const a = t[e], b = t[(e + 1) % 3], c = t[(e + 2) % 3];
        const ka = vkey(a), kb = vkey(b);
        const k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        const en = edges.get(k);
        if (en) en.n++; else edges.set(k, { a, b, c, n: 1 });
      }
    }
    const hall = halls.get(rec);
    const wallB = hall ? out.tc[hall] : rec.platformLine === 'blue' ? out.cave : out.wall;
    // Open-air platforms (Stockholm C, tram stop) get railings instead of walls.
    const outdoor = rec.platformLines && (rec.platformLines.has('main') || rec.platformLines.has('tram'));
    // Stairwell walls stop at balustrade height above the top landing.
    const capY = rec.kind === 'stairs' ? rec.box.max.y + 1.1 : Infinity;
    const uvScale = rec.platformLine === 'blue' ? 1 / 5 : 1 / 2;
    for (const { a, b, c, n } of edges.values()) {
      if (n !== 1) continue;
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      let nx = dz / len, nz = -dx / len;
      if ((c.x - (a.x + b.x) / 2) * nx + (c.z - (a.z + b.z) / 2) * nz > 0) { nx = -nx; nz = -nz; }
      const segs = Math.max(1, Math.ceil(len / 1.0));
      const at = (t: number) => new THREE.Vector3().lerpVectors(a, b, t);
      const runs: { type: number; t0: number; t1: number; h: number }[] = [];
      for (let i = 0; i < segs; i++) {
        const t0 = i / segs, t1 = (i + 1) / segs, m = at((t0 + t1) / 2);
        let type = classify(m.x, m.y, m.z, nx, nz);
        if (type === WALL && outdoor) type = RAILING;
        const h = type === WALL ? headroom(m.x - nx * 0.3, m.y, m.z - nz * 0.3) : 0;
        const last = runs[runs.length - 1];
        if (last && last.type === type && Math.abs(last.h - h) < 0.3) { last.t1 = t1; last.h = Math.min(last.h, h); }
        else runs.push({ type, t0, t1, h });
      }
      for (const run of runs) {
        const p0 = at(run.t0), p1 = at(run.t1);
        const u0 = run.t0 * len, u1 = run.t1 * len;
        if (run.type === WALL) {
          const top = (p: THREE.Vector3) => p.y + Math.max(1.05, Math.min(run.h, capY - p.y));
          const t0 = top(p0), t1 = top(p1);
          if (hall) {
            // T-Centralen's: its walls' texture from the platform up (src/textures.ts)
            const { height, floor } = T.TC_WALL, rep = tcTrackWall(hall).repeat;
            const v = (p: THREE.Vector3, y: number) => (y - p.y + floor) / height;
            wallB.quad(p0, p1, p1.clone().setY(t1), p0.clone().setY(t0),
              [u0 / rep, v(p0, p0.y)], [u1 / rep, v(p1, p1.y)], [u1 / rep, v(p1, t1)], [u0 / rep, v(p0, t0)]);
            continue;
          }
          wallB.quad(p0, p1, p1.clone().setY(t1), p0.clone().setY(t0),
            [u0 * uvScale, p0.y * uvScale], [u1 * uvScale, p1.y * uvScale],
            [u1 * uvScale, t1 * uvScale], [u0 * uvScale, t0 * uvScale]);
        } else if (run.type === RAILING) {
          const up = (p: THREE.Vector3, h: number) => p.clone().setY(p.y + h);
          out.glass.quad(p0, p1, up(p1, 1.05), up(p0, 1.05), [0, 0], [1, 0], [1, 1], [0, 1]);
          // handrail: small horizontal + vertical strip
          const o = new THREE.Vector3(nx * 0.04, 0, nz * 0.04);
          out.handrail.quad(up(p0, 1.05).sub(o), up(p1, 1.05).sub(o), up(p1, 1.05).add(o), up(p0, 1.05).add(o), [0, 0], [1, 0], [1, 1], [0, 1]);
          out.handrail.quad(up(p0, 0.98), up(p1, 0.98), up(p1, 1.1), up(p0, 1.1), [0, 0], [1, 0], [1, 1], [0, 1]);
        } else if (run.type === PLATFORM) {
          const i0 = new THREE.Vector3(-nx * 0.55, 0.012, -nz * 0.55), i1 = new THREE.Vector3(-nx * 0.72, 0.012, -nz * 0.72);
          if (hall) {
            // T-Centralen's: a band of light stone along the edge, then a tactile strip
            const e = new THREE.Vector3(0, 0.01, 0);
            out.band.quad(p0.clone().add(e), p1.clone().add(e), p1.clone().add(i0), p0.clone().add(i0), [u0 / 2, 0], [u1 / 2, 0], [u1 / 2, 1], [u0 / 2, 1]);
            out.tactile.quad(p0.clone().add(i0), p1.clone().add(i0), p1.clone().add(i1), p0.clone().add(i1), [u0 / 0.68, 0], [u1 / 0.68, 0], [u1 / 0.68, 1], [u0 / 0.68, 1]);
            continue;
          }
          out.yellow.quad(p0.clone().add(i0), p1.clone().add(i0), p1.clone().add(i1), p0.clone().add(i1), [0, 0], [1, 0], [1, 1], [0, 1]);
        }
      }
    }
  }
  return out;
}

// Groups the floors around each lift shaft into stops.
function buildLifts(elevators: SurfaceRecord[], walk: SurfaceIndex<SurfaceData>, hits: WalkHit[]) {
  const lifts: Lift[] = [];
  for (const rec of elevators) {
    const c = rec.box.getCenter(new THREE.Vector3());
    const rad = Math.max(rec.size.x, rec.size.z) / 2;
    const found: { y: number; pos: THREE.Vector3; d: number }[] = [];
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      for (const d of [0.9, 1.6, 2.6]) {
        const x = c.x + Math.cos(a) * (rad + d), z = c.z + Math.sin(a) * (rad + d);
        walk.query(x, z, hits);
        for (const q of hits) {
          if (q.data.kind !== 'floor' || q.y < rec.box.min.y - 0.3 || q.y > rec.box.max.y + 0.3) continue;
          found.push({ y: q.y, pos: new THREE.Vector3(x, q.y, z), d });
        }
      }
    }
    found.sort((a, b) => a.y - b.y);
    const levels: { y: number; pos: THREE.Vector3; d: number }[] = [];
    for (const f of found) {
      const last = levels[levels.length - 1];
      if (last && Math.abs(last.y - f.y) < 0.8) { if (f.d < last.d) Object.assign(last, f); }
      else levels.push({ ...f });
    }
    if (levels.length >= 2) {
      lifts.push({
        center: c, radius: rad, minY: rec.box.min.y, maxY: rec.box.max.y,
        levels: levels.map((l) => ({ y: l.y, pos: l.pos, yaw: Math.atan2(-(l.pos.x - c.x), -(l.pos.z - c.z)) })),
      });
    }
  }
  return lifts;
}

function platformSpot(tr: Track, walk: SurfaceIndex<SurfaceData>, hits: WalkHit[], lifts: Lift[]) {
  const spec = TRAIN_SPECS[LINES[tr.line].kind];
  const { s0, s1, side } = tr.platform!;
  const p = new THREE.Vector3(), r = new THREE.Vector3(), t = new THREE.Vector3();
  for (const f of [0.5, 0.4, 0.6, 0.3, 0.7]) {
    const s = s0 + (s1 - s0) * f;
    tr.path.pointAt(s, p); tr.path.rightAt(s, r); tr.path.tangentAt(s, t);
    for (const d of [3, 2, 4, 1.5]) {
      const x = p.x + r.x * side * (spec.halfWidth + d), z = p.z + r.z * side * (spec.halfWidth + d);
      if (lifts.some((l) => Math.hypot(x - l.center.x, z - l.center.z) < l.radius + 1.5 && p.y > l.minY - 1 && p.y < l.maxY + 1)) continue;
      walk.query(x, z, hits);
      const h = hits.find((q) => Math.abs(q.y - p.y) < 0.9);
      if (h) {
        return { pos: new THREE.Vector3(x, h.y, z), yaw: Math.atan2(-t.x, -t.z) };
      }
    }
  }
  return null;
}

// ------------------------------------------------------------------ T-Centralen's platform halls
// Drawn as they look (src/textures.ts) rather than in the plain tiles and painted rock of the
// others: the upper red/green hall (tracks 1–2, 1957) in white tiles under a white vault, with
// "Klaravagnen" along the green line's wall and the glass prisms along the red line's; the lower
// (tracks 3–4) in Oscar Brandtberg's bands of square tiles over cream mosaic; and the blue line's
// cave (1975) as Per Olof Ultvedt painted it, ultramarine below and white above, blue leaves over all.

type TcHall = 'upper' | 'lower' | 'blue';
const HALLS: TcHall[] = ['upper', 'lower', 'blue'];
// the ceiling, above the platform: as high as the tops of the track walls' curves (src/station.ts)
const TC_CEILING = 5.6;
// the blue line's cave: its walls rise to TC_CAVE_TOP over the platform, the vault 1.4 m higher in the middle
const TC_CAVE_TOP = 6.9, TC_CAVE_DOME = 1.4;

// The cave's wall across the track, from the trench up and over towards the platform: steep, then
// rounding into the vault.
function tcCaveProfile(far: number, k: number): [number, number][] {
  const prof: [number, number][] = [[far, -1.25], [far, 0.6]];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI / 2;
    prof.push([far + k * 3.6 * (1 - Math.cos(a)), 0.6 + (TC_CAVE_TOP - 0.6) * Math.sin(a)]);
  }
  return prof;
}

// Smooth noise in space, -1…1, a few octaves of value noise: the bumps and hollows of blasted rock.
function rockNoise(x: number, y: number, z: number) {
  const hash = (i: number, j: number, k: number) => {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const value = (x: number, y: number, z: number) => {
    const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    const f = (t: number) => t * t * (3 - 2 * t);
    const u = f(x - i), v = f(y - j), w = f(z - k);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    const c = (dj: number, dk: number) => l(hash(i, j + dj, k + dk), hash(i + 1, j + dj, k + dk), u);
    return l(l(c(0, 0), c(1, 0), v), l(c(0, 1), c(1, 1), v), w) * 2 - 1;
  };
  return value(x * 0.45, y * 0.45, z * 0.45) * 0.55 + value(x * 1.1 + 17, y * 1.1, z * 1.1) * 0.3 + value(x * 2.6, y * 2.6 + 9, z * 2.6) * 0.15;
}

// Roughens a cave wall swept along a track: pushes every point back into the rock (away from the
// track, `out` its side) and up or down by the noise, little at the platform's height so the trench
// and the name plates stay clear, up to 0.85 m above it. Faceted, as blasted rock is.
function tcRough(g: THREE.BufferGeometry, floorY: number, out: number, tr: Track) {
  const pos = g.attributes.position;
  // the track every 2 m, with its right at each, to find the side away from it near any point
  const along: { p: THREE.Vector3; r: THREE.Vector3 }[] = [];
  for (let s = 0; s <= tr.path.length; s += 2) along.push({ p: tr.path.pointAt(s), r: tr.path.rightAt(s) });
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const h = y - floorY;
    const amp = THREE.MathUtils.smoothstep(h, -0.5, 2.5) * 0.85;
    if (amp <= 0) continue;
    const n = rockNoise(x, y, z), m = rockNoise(z + 31, x, y - 7);
    // the side away from the track, taken from the nearest point of the track
    let r = along[0].r, best = Infinity;
    for (const q of along) {
      const d = (q.p.x - x) ** 2 + (q.p.z - z) ** 2;
      if (d < best) { best = d; r = q.r; }
    }
    pos.setXYZ(i, x + r.x * out * amp * (n + 1) * 0.5, y + amp * m * 0.5, z + r.z * out * amp * (n + 1) * 0.5);
  }
  g.computeVertexNormals();
  return g;
}

// The home station's platforms, by hall: the red/green ones, upper and lower, by height.
function tcHalls(records: SurfaceRecord[]) {
  const halls = new Map<SurfaceRecord, TcHall>();
  const home = records.filter((r) => r.station === HOME_STATION && r.platformLines);
  const rg = home.filter((r) => r.platformLines!.has('red') || r.platformLines!.has('green')).sort((a, b) => b.box.max.y - a.box.max.y);
  rg.forEach((r, i) => halls.set(r, i === 0 ? 'upper' : 'lower'));
  for (const r of home) if (r.platformLines!.has('blue')) halls.set(r, 'blue');
  return halls;
}

// Which texture a hall's track wall takes, and its repeat along the track: in the upper hall, the
// green line's wall has Klaravagnen and the red line's the glass prisms. Without a line, the end walls'.
function tcTrackWall(hall: TcHall, line?: LineId) {
  if (hall === 'upper') {
    if (!line) return { key: 'upperPlain', repeat: 4.8 } as const;
    return { key: line === 'green' ? 'klara' : 'prisms', repeat: 20.48 } as const;
  }
  if (hall === 'lower') return { key: 'brandtberg', repeat: 4.8 } as const;
  return { key: 'cave', repeat: 16 } as const;
}

function tcMaterials() {
  // (lit a little from within, as the light off the floor would: the hall's lamps are not lights)
  const wall = (map: THREE.Texture, roughness = 0.6, glow = 0x4a4a4a) =>
    new THREE.MeshStandardMaterial({ map, roughness, emissive: glow, emissiveMap: map, side: THREE.DoubleSide });
  const plaster = wall(T.plaster(), 0.9, 0x8e918f);
  const klara = wall(T.tcKlaravagnen()), prisms = wall(T.tcGlassPrisms(), 0.45), upperPlain = wall(T.tcUpperPlain());
  const brandtberg = wall(T.tcBrandtberg()), cave = wall(T.tcCaveWall(), 0.85);
  const plate = (dark: boolean) => new THREE.MeshBasicMaterial({ map: T.tcPlate('T-Centralen', dark), side: THREE.DoubleSide });
  return {
    klara, prisms, upperPlain, brandtberg, cave,
    upper: { floor: new THREE.MeshStandardMaterial({ map: T.tcStoneFloor(150, 41), roughness: 0.45 }), ceiling: plaster, end: upperPlain },
    lower: { floor: new THREE.MeshStandardMaterial({ map: T.tcMosaicFloor(), roughness: 0.6 }), ceiling: plaster, end: brandtberg },
    blue: { floor: new THREE.MeshStandardMaterial({ map: T.tcStoneFloor(92, 43), roughness: 0.35 }), ceiling: wall(T.tcCaveVault(), 0.9, 0x6a6a6a), end: cave },
    band: new THREE.MeshStandardMaterial({ map: T.tcEdgeBand(), roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }),
    tactile: new THREE.MeshStandardMaterial({ map: T.tcTactile(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
    plate: { upper: plate(false), lower: plate(true), blue: plate(false) },
  };
}

// The name plates along a track wall, `off` m to the side of the track, every 15 m along the platform.
function tcPlates(tr: Track, off: number, mat: THREE.Material) {
  const { s0, s1 } = tr.platform!;
  const geo = new THREE.PlaneGeometry(0.95, 0.165);
  const p = new THREE.Vector3(), r = new THREE.Vector3();
  const out: THREE.Group[] = [];
  const n = Math.max(2, Math.round((s1 - s0) / 15));
  for (let i = 0; i < n; i++) {
    const s = s0 + ((i + 0.5) / n) * (s1 - s0);
    tr.path.pointAt(s, p); tr.path.rightAt(s, r);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    g.position.copy(p).addScaledVector(r, off).setY(p.y + 1.6);
    g.lookAt(g.position.clone().addScaledVector(r, -Math.sign(off)));
    out.push(g);
  }
  return out;
}

// A flat ceiling `height` over the platform, from the top of a track's wall to halfway to its
// partner across the platform, in cells of about a metre, but not where a stair, an escalator, a
// floor or a lift comes through.
function tcCeiling(
  tr: Track, partner: Track, height: number, walk: SurfaceIndex<SurfaceData>, elevators: SurfaceRecord[],
  hits: WalkHit[], out: Builder, uvScale: number, cave = false,
) {
  const spec = TRAIN_SPECS[LINES[tr.line].kind];
  const W = spec.halfWidth + 1.15, k = tr.platform!.side;
  const { s0, s1 } = tr.platform!;
  const pts = partner.path.resample(0, partner.path.length, 2);
  const p = new THREE.Vector3(), r = new THREE.Vector3();
  const corner = (s: number, d: number, mid: number) => {
    tr.path.pointAt(s, p); tr.path.rightAt(s, r);
    const c = p.clone().addScaledVector(r, k * d).setY(p.y + height);
    if (!cave) return c;
    // the cave's vault: domed towards the middle of the hall, and rough
    const t = THREE.MathUtils.clamp((d - from) / Math.max(0.5, mid - from), 0, 1);
    c.y += TC_CAVE_DOME * Math.sin(t * Math.PI / 2) + rockNoise(c.x, p.y, c.z) * 0.6;
    // but under the floors over it
    walk.query(c.x, c.z, hits);
    for (const h of hits) if (h.y > p.y + 3 && h.y - 0.6 < c.y) c.y = h.y - 0.6;
    return c;
  };
  // halfway across to the partner, at s
  const half = (s: number) => {
    tr.path.pointAt(s, p);
    let best = Infinity;
    for (const q of pts) best = Math.min(best, Math.hypot(q.x - p.x, q.z - p.z));
    return best / 2 + 0.05;
  };
  const blocked = (c: THREE.Vector3) => {
    const y0 = c.y - height;
    walk.query(c.x, c.z, hits);
    if (hits.some((h) => h.y > y0 + 0.5 && h.y < y0 + height + (cave ? TC_CAVE_DOME : 0) + 1.5)) return true;
    return elevators.some((e) => c.x > e.box.min.x - 0.3 && c.x < e.box.max.x + 0.3 && c.z > e.box.min.z - 0.3 && c.z < e.box.max.z + 0.3
      && e.box.max.y > y0 + 0.5 && e.box.min.y < y0 + height + 1.5);
  };
  // the cave: only what comes up through the platform, or a floor too low to pass under, stops its vault
  const blockedLow = (c: THREE.Vector3) => {
    tr.path.pointAt(s0, p);
    const y0 = p.y;
    if (c.y < y0 + 3) return true;
    walk.query(c.x, c.z, hits);
    if (hits.some((h) => h.y > y0 + 0.5 && h.y < y0 + 3)) return true;
    return elevators.some((e) => c.x > e.box.min.x - 0.3 && c.x < e.box.max.x + 0.3 && c.z > e.box.min.z - 0.3 && c.z < e.box.max.z + 0.3
      && e.box.max.y > y0 + 0.5 && e.box.min.y < y0 + 3);
  };
  // the top of the wall's curve, across the track from its middle (the cave's from further back,
  // over the top of its rough wall)
  const from = 3.6 - W - (cave ? 1.0 : 0);
  const uv = (v: THREE.Vector3): [number, number] => [v.x * uvScale, v.z * uvScale];
  for (let s = Math.max(0, s0 - 6); s < Math.min(tr.path.length, s1 + 6); s += 1) {
    const sb = Math.min(s + 1, tr.path.length, s1 + 6);
    const ha = half(s), hb = half(sb);
    const n = Math.max(1, Math.ceil(Math.max(ha, hb) - from));
    for (let i = 0; i < n; i++) {
      const a0 = from + ((ha - from) * i) / n, a1 = from + ((ha - from) * (i + 1)) / n;
      const b0 = from + ((hb - from) * i) / n, b1 = from + ((hb - from) * (i + 1)) / n;
      const c00 = corner(s, a0, ha), c01 = corner(s, a1, ha), c10 = corner(sb, b0, hb), c11 = corner(sb, b1, hb);
      const mid = c00.clone().add(c01).add(c10).add(c11).multiplyScalar(0.25);
      if (cave ? [c00, c01, c10, c11].some((c) => blockedLow(c)) : blocked(mid)) continue;
      out.quad(c00, c10, c11, c01, uv(c00), uv(c10), uv(c11), uv(c01));
    }
  }
}
