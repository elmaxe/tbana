import * as THREE from 'three';
import * as T from './textures';
import { Builder } from './detail/builder';
import type { V3 } from './detail/builder';
import { LINES, TRAIN_SPECS } from './lines';
import { HOME_STATION } from './station-models';
import { TUBE, stripLamps } from './lamps';
import type { Lamp } from './lamps';
import type { Tri } from './polyline';
import type { SurfaceIndex } from './surface-index';
import type { Lift, SurfaceData, SurfaceRecord, TcCave, TcHall, Track, WalkHit } from './station';

// T-Centralen's furnishings, over Albert Guillaumes' model of the station (src/station.ts), which
// draws its floors, stairs and shafts but little in them. From photographs (Wikimedia Commons,
// 2008–2025), SL's pages on the art, and Wikipedia:
//
//  - the blue line's cave (1975): over each half of the platform a frame of galvanised beams of
//    steel mesh hung from the rock, fluorescent lamps under them; on the rock across the tracks
//    yellow posts, some with the station's name on a small black sign
//  - the lifts: stainless doors in yellow frames, a black sign over them, and in the cave a
//    half-circle of white tiles in front of each
//  - the escalators (every stair of the model's that climbs a storey or more): steps, stainless
//    balustrades, black handrails, combs of chequer plate at either end
//  - the Blue passage (Blå gången) from the blue line to the red and green: two moving walkways
//    down its middle, under a vault of blue and white rock like the cave's, with Carl Fredrik
//    Reuterswärd's enamel frieze "Take the A-train" (1984) along its walls
//  - ceilings over the concourses and the shafts of the escalators, which the model leaves open
//  - on the red and green lines' upper platform (1957), three of its pillars of art: Vera
//    Nilsson's stone mosaic towards the Central Station, Berndt Helleberg's black relief "Linje"
//    in the middle, Siri Derkert's "Kvinnopelaren" (1958) towards Sergels torg; and between them
//    Egon Möller-Nielsen's benches of cast stone

export interface TcScene {
  records: SurfaceRecord[];
  walk: SurfaceIndex<SurfaceData>;
  hits: WalkHit[];
  tracks: Track[];
  hallOf: (tr: Track) => TcHall | null;
  cave: TcCave | null;
  lifts: Lift[];
  elevators: SurfaceRecord[];
  // the cave's materials, shared: the vault over the passage, the plain blue rock
  vault: THREE.Material;
  rock: THREE.Material;
}

// Records of the model, by name: the floors under the blue line's painted rock (the Blue passage,
// the hall over the escalators to Sergels torg, "Krysset" under Vasagatan) and the escalators to
// them; the passage's long straight stretch, from its side at the cave to its round end.
export const TC_BLUE_ROCK = new Set(['rect22925', 'rect32327', 'rect33613', 'path36567', 'rect20998', 'rect12018-5-0', 'rect12018-5-0-1', 'rect29732', 'rect29724']);
const PASSAGE = { a: [31.78, -93.57], b: [103.85, -26.8], width: 7.5 };
// The model has the Central Station's hall and the commuter trains' station in it too: what is
// furnished here is the metro's, the records whose middles are round its three levels.
const SUBWAY = { x0: -125, x1: 260, z0: -170, z1: 95 };
function inSubway(rec: SurfaceRecord) {
  const c = rec.box.getCenter(new THREE.Vector3());
  return c.x > SUBWAY.x0 && c.x < SUBWAY.x1 && c.z > SUBWAY.z0 && c.z < SUBWAY.z1;
}
// the shafts' ceilings, over their steps (as the stairs' walls in src/station.ts)
export const TC_SHAFT = 4.2;
const CEILING = 4.2;
// how far escalators have gone down from a hall where their shaft's ceiling begins
const PORTAL = 3;

const std = (map: THREE.Texture | null, roughness: number, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness, metalness, side: THREE.DoubleSide, ...extra });
// a ceiling: the strip lamps shine down, so it glows a little of itself
const glowing = (map: THREE.Texture, roughness: number, glow: number) => std(map, roughness, 0, { emissive: glow, emissiveMap: map });

function materials(scene: TcScene) {
  const basic = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide });
  return new Map<string, THREE.Material>([
    // (lit a little from within: the lamps light only what is under them)
    ['steel', std(null, 0.45, 0.4, { emissive: 0x1c1d1f })],
    ['mesh', std(T.tcMeshPanel(), 0.55, 0.3, { emissive: 0x2a2c2e })],
    ['stainless', std(null, 0.3, 0.45, { emissive: 0x3a3c3f })],
    ['paint', std(null, 0.6)],
    ['rubber', std(null, 0.7)],
    ['steps', std(T.escalatorSteps(), 0.45, 0.55)],
    ['chequer', std(T.tcChequer(), 0.4, 0.6)],
    ['tiles', std(T.floorTiles(), 0.35, 0, { polygonOffset: true, polygonOffsetFactor: -2 })],
    ['glass', std(null, 0.1, 0.3, { transparent: true, opacity: 0.55 })],
    ['ceiling', glowing(T.plaster(), 0.9, 0x8e918f)],
    ['ticket', glowing(T.tcTicketCeiling(), 0.8, 0x8e918f)],
    ['lamp', new THREE.MeshBasicMaterial({ color: 0xfff7e6, side: THREE.DoubleSide })],
    ['name', basic(T.tcPlate('T-Centralen', true))],
    ['lift', basic(T.beamSign('Hiss', false, 0))],
    ['frieze', std(T.tcFrieze(), 0.35, 0, { polygonOffset: true, polygonOffsetFactor: -2 })],
    ['nilsson', std(T.tcNilsson(), 0.7)],
    ['helleberg', std(T.tcHelleberg(), 0.5)],
    ['derkert', std(T.tcDerkert(), 0.85)],
    ['vault', scene.vault],
    ['rock', scene.rock],
  ]);
}

export function dressTCentralen(scene: TcScene) {
  const B = new Builder(), lamps: Lamp[] = [];
  const home = scene.records.filter((r) => r.station === HOME_STATION && inSubway(r));
  const blue = scene.tracks.filter((tr) => tr.platform && scene.hallOf(tr) === 'blue');
  for (const tr of blue) {
    lampFrames(B, tr, scene);
    namePosts(B, tr);
  }
  if (blue.length === 2) crossLamps(B, blue[0], blue[1], scene, lamps);
  liftFronts(B, scene);
  for (const rec of home) {
    if (rec.kind === 'stairs') escalators(B, rec.top);
    if (rec.kind === 'tube') escalators(B, rec.bottom.map((t) => t.map((v) => v.clone().setY(v.y + 1)) as Tri));
  }
  passage(B, scene, lamps);
  ceilings(B, home, scene);
  upperPlatform(B, scene);
  const mats = materials(scene), group = new THREE.Group();
  for (const [mat, geom] of B.geometries()) {
    if (mat === 'vault' || mat === 'rock') geom.deleteAttribute('color');
    const m = new THREE.Mesh(geom, mats.get(mat));
    m.name = `T-Centralen ${mat}`;
    group.add(m);
  }
  return { group, lamps };
}

const v3 = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];

// ------------------------------------------------------------------ the blue line's cave
// Over each half of the platform two beams of steel mesh along it, 1.3 m and 4 m in from its
// edge and a little over 4 m up, a box across between them every 9.6 m, lamps along both sides of
// each beam, all hung on rods from the rock: wherever the platform is under both beams.
function lampFrames(B: Builder, tr: Track, { walk, hits }: TcScene) {
  const spec = TRAIN_SPECS[LINES[tr.line].kind];
  const { s0, s1, side, rec } = tr.platform!;
  const y = rec.box.max.y, edge = spec.halfWidth + 0.12, rows = [1.3, 4.0], STEP = 4.8;
  const p = new THREE.Vector3(), r = new THREE.Vector3(), t = new THREE.Vector3();
  const onFloor = (q: V3) => { walk.query(q[0], q[2], hits); return hits.some((h) => h.data.rec === rec && Math.abs(h.y - y) < 0.3); };
  let k = 0;
  for (let s = s0 + 1; s + STEP <= s1 - 1; s += STEP, k++) {
    const sm = s + STEP / 2;
    tr.path.pointAt(sm, p); tr.path.rightAt(sm, r); tr.path.tangentAt(sm, t);
    const at = (d: number): V3 => [p.x + r.x * side * (edge + d), y, p.z + r.z * side * (edge + d)];
    if (!rows.every((d) => onFloor(at(d)))) continue;
    const along: V3 = [t.x, 0, t.z], across: V3 = [r.x * side, 0, r.z * side];
    for (const d of rows) {
      const o = at(d);
      B.tint(0xaeb3b8); B.wallBox(o, along, across, -STEP / 2, STEP / 2, y + 4.05, y + 4.45, -0.2, 0.2, 'mesh', 1);
      for (const e of [-0.34, 0.34]) {
        B.tint(0x9ea4aa); B.wallBox(o, along, across, -1.3, 1.3, y + 3.92, y + 4.05, e - 0.13, e + 0.13, 'steel');
        B.wallBox(o, along, across, -1.25, 1.25, y + 3.9, y + 3.92, e - 0.08, e + 0.08, 'lamp', 2, ['top']);
      }
      B.tint(0x5f6469);
      for (const a of [-1.2, 1.2]) B.wallBox(o, along, across, a - 0.025, a + 0.025, y + 4.45, y + 8.6, -0.025, 0.025, 'steel');
    }
    if (k % 2 === 0) {
      const c = at((rows[0] + rows[1]) / 2), half = (rows[1] - rows[0]) / 2 - 0.2;
      B.tint(0xaeb3b8); B.wallBox(c, across, along, -half, half, y + 3.85, y + 4.45, -STEP / 2, -STEP / 2 + 0.45, 'mesh', 1);
    }
  }
}

// Over the halls across the cave between its two halves (at its ends, and between the escalators
// in its middle), a beam of the same across the hall every 4.8 m, wherever the floor is under it
// and nothing over it.
function crossLamps(B: Builder, a: Track, b: Track, { walk, hits, cave }: TcScene, lamps: Lamp[]) {
  const rec = a.platform!.rec, y = rec.box.max.y, pts = b.path.resample(0, b.path.length, 1);
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  const free = (q: V3) => {
    walk.query(q[0], q[2], hits);
    return hits.some((h) => h.data.rec === rec && Math.abs(h.y - y) < 0.3) && !hits.some((h) => h.y > y + 0.5 && h.y < y + 8);
  };
  for (let s = 0; s < a.path.length; s += 4.8) {
    a.path.pointAt(s, p); a.path.tangentAt(s, t);
    let q = pts[0], best = Infinity;
    for (const o of pts) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < best) { best = d; q = o; } }
    const M: V3 = [(p.x + q.x) / 2, y, (p.z + q.z) / 2];
    if (!cave?.contains(M[0], M[2])) continue;
    const across: V3 = [(q.x - p.x) / best, 0, (q.z - p.z) / best], along: V3 = [t.x, 0, t.z];
    const at = (d: number): V3 => [M[0] + across[0] * d, y, M[2] + across[2] * d];
    if (![-2.6, 0, 2.6].every((d) => free(at(d)))) continue;
    B.tint(0xaeb3b8); B.wallBox(M, across, along, -2.6, 2.6, y + 4.55, y + 4.95, -0.2, 0.2, 'mesh', 1);
    for (const e of [-0.34, 0.34]) {
      B.tint(0x9ea4aa); B.wallBox(M, across, along, -2.4, 2.4, y + 4.42, y + 4.55, e - 0.13, e + 0.13, 'steel');
      B.wallBox(M, across, along, -2.35, 2.35, y + 4.4, y + 4.42, e - 0.08, e + 0.08, 'lamp', 2, ['top']);
    }
    B.tint(0x5f6469);
    for (const d of [-2, 2]) B.wallBox(M, across, along, d - 0.025, d + 0.025, y + 4.95, y + 10, -0.025, 0.025, 'steel');
    stripLamps([new THREE.Vector3(...at(-2.4)).setY(y + 4.35), new THREE.Vector3(...at(2.4)).setY(y + 4.35)],
      { power: 1.8, reach: 14, color: TUBE, down: 1, floor: y - 0.5, top: y + 9 }, lamps);
  }
}

// Yellow posts on the rock across the track, every 6.4 m along the platform, and on every other
// one a small black sign with the station's name.
function namePosts(B: Builder, tr: Track) {
  const spec = TRAIN_SPECS[LINES[tr.line].kind];
  const { s0, s1, side, rec } = tr.platform!;
  const y = rec.box.max.y, far = spec.halfWidth + 1.15 - 0.12;
  const p = new THREE.Vector3(), r = new THREE.Vector3(), t = new THREE.Vector3();
  let k = 0;
  for (let s = s0 + 3; s < s1 - 2; s += 6.4, k++) {
    tr.path.pointAt(s, p); tr.path.rightAt(s, r); tr.path.tangentAt(s, t);
    const o: V3 = [p.x - r.x * side * far, y, p.z - r.z * side * far];
    const along: V3 = [t.x, 0, t.z], out: V3 = [r.x * side, 0, r.z * side];
    B.tint(0xf0bf16);
    B.wallBox(o, along, out, -0.035, 0.035, y - 0.7, y + 1.5, -0.035, 0.035, 'paint');
    for (const h of [0.1, 1.2]) B.wallBox(o, along, out, -0.03, 0.03, y + h, y + h + 0.06, -1.0, 0, 'paint');
    B.wallBox(o, along, out, -0.25, 0.25, y + 0.55, y + 0.6, -0.03, 0.03, 'paint');
    if (k % 2) continue;
    // the sign, facing the platform, on top of the post
    const R: V3 = [out[2], 0, -out[0]], w = 0.7, c: V3 = [o[0] + out[0] * 0.04, y + 1.64, o[2] + out[2] * 0.04];
    const P = (a: number, b: number): V3 => [c[0] + R[0] * a, c[1] + b, c[2] + R[2] * a];
    B.poly([P(-w / 2, -0.06), P(w / 2, -0.06), P(w / 2, 0.06), P(-w / 2, 0.06)], out, 'name', 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
}

// ------------------------------------------------------------------ the lifts
// At each stop of each of the station's lifts, on the side of its shaft facing the stop: a pair of
// stainless doors with windows, framed in yellow, a black sign over them; in the cave a
// half-circle of white tiles on the floor in front.
function liftFronts(B: Builder, { lifts, elevators, cave }: TcScene) {
  for (const rec of elevators) {
    if (rec.station !== HOME_STATION || !inSubway(rec)) continue;
    const c = rec.box.getCenter(new THREE.Vector3());
    const lift = lifts.find((l) => l.center.distanceTo(c) < 0.01);
    if (!lift) continue;
    for (const level of lift.levels) {
      const dir = new THREE.Vector3(level.pos.x - c.x, 0, level.pos.z - c.z).normalize();
      // the face of the shaft that best faces the stop
      let N = dir, D = Math.max(rec.size.x, rec.size.z) / 2, best = -Infinity;
      for (const t of rec.side) {
        const n = new THREE.Vector3().subVectors(t[1], t[0]).cross(new THREE.Vector3().subVectors(t[2], t[0])).setY(0);
        if (n.lengthSq() < 1e-6) continue;
        n.normalize();
        const m = t[0].clone().add(t[1]).add(t[2]).multiplyScalar(1 / 3).sub(c).setY(0);
        if (m.dot(n) < 0) n.negate();
        if (n.dot(dir) > best) { best = n.dot(dir); N = n; D = m.dot(n); }
      }
      const y = level.y, R = new THREE.Vector3(N.z, 0, -N.x);
      const P = (a: number, b: number, d = 0.03): V3 => [c.x + N.x * (D + d) + R.x * a, y + b, c.z + N.z * (D + d) + R.z * a];
      const face = (a0: number, a1: number, b0: number, b1: number, mat: string, d = 0.03) =>
        B.poly([P(a0, b0, d), P(a1, b0, d), P(a1, b1, d), P(a0, b1, d)], [N.x, 0, N.z], mat, 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      B.tint(0xc9cdd1);
      face(-0.6, -0.005, 0, 2.1, 'stainless'); face(0.005, 0.6, 0, 2.1, 'stainless');
      B.tint(0x9fb4c0);
      face(-0.45, -0.15, 0.9, 1.9, 'glass', 0.04); face(0.15, 0.45, 0.9, 1.9, 'glass', 0.04);
      B.tint(0xf0bf16);
      face(-0.72, -0.6, 0, 2.28, 'paint', 0.05); face(0.6, 0.72, 0, 2.28, 'paint', 0.05); face(-0.72, 0.72, 2.1, 2.28, 'paint', 0.05);
      B.tint(0xffffff);
      face(-0.45, 0.45, 2.4, 2.65, 'lift', 0.04);
      if (!cave?.contains(level.pos.x, level.pos.z)) continue;
      // the tiles: a fan of triangles, 1.7 m round from the doors' foot
      const o = P(0, 0.012, 0.03), pts: V3[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI;
        pts.push([o[0] + R.x * Math.cos(a) * 1.7 + N.x * Math.sin(a) * 1.7, o[1], o[2] + R.z * Math.cos(a) * 1.7 + N.z * Math.sin(a) * 1.7]);
      }
      for (let i = 0; i < 12; i++) B.poly([o, pts[i], pts[i + 1]], [0, 1, 0], 'tiles', 2);
    }
  }
}

// ------------------------------------------------------------------ escalators
// A stair's or an escalator's slope (the walkable surface's triangles) as escalators side by side,
// as many as fit 1.7 m each: steps a metre wide up the slope, a stainless balustrade either side
// running on a metre flat at each end under a black handrail, combs at the ends. Only those that
// climb a storey or more: the model's short ramps stay stairs.
function escalators(B: Builder, tris: Tri[]) {
  if (!tris.length) return;
  const n = new THREE.Vector3();
  for (const t of tris) {
    const m = new THREE.Vector3().subVectors(t[1], t[0]).cross(new THREE.Vector3().subVectors(t[2], t[0]));
    n.add(m.y < 0 ? m.negate() : m);
  }
  n.normalize();
  if (n.y > 0.97) return;
  // uphill, and across
  const g = new THREE.Vector3(-n.x, 0, -n.z).normalize(), w = new THREE.Vector3(-g.z, 0, g.x);
  let s0 = Infinity, s1 = -Infinity, q0 = Infinity, q1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const t of tris) {
    for (const v of t) {
      const s = v.x * g.x + v.z * g.z, q = v.x * w.x + v.z * w.z;
      s0 = Math.min(s0, s); s1 = Math.max(s1, s); q0 = Math.min(q0, q); q1 = Math.max(q1, q);
      y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
  }
  if (y1 - y0 < 2.5) return;
  const Y = (s: number) => y0 + ((THREE.MathUtils.clamp(s, s0, s1) - s0) / (s1 - s0)) * (y1 - y0);
  const P = (s: number, q: number, dy = 0): V3 => [g.x * s + w.x * q, Y(s) + dy, g.z * s + w.z * q];
  const units = Math.max(1, Math.round((q1 - q0) / 1.7)), uw = (q1 - q0) / units;
  const up: V3 = [-g.x * (y1 - y0), s1 - s0, -g.z * (y1 - y0)];
  const along = [s0 - 1.0, s0, s1, s1 + 1.0];
  for (let i = 0; i < units; i++) {
    const qc = q0 + (i + 0.5) * uw;
    // the steps, 0.4 m each (src/textures.ts escalatorSteps: six to its 2.4 m)
    B.tint(0xffffff);
    B.poly([P(s0, qc - 0.5, 0.04), P(s1, qc - 0.5, 0.04), P(s1, qc + 0.5, 0.04), P(s0, qc + 0.5, 0.04)], up, 'steps', 1,
      [[0, 0], [0, Math.hypot(s1 - s0, y1 - y0) / 2.4], [1, Math.hypot(s1 - s0, y1 - y0) / 2.4], [1, 0]]);
    for (const [a, b] of [[s0 - 1.1, s0], [s1, s1 + 1.1]]) B.poly([P(a, qc - 0.55, 0.035), P(b, qc - 0.55, 0.035), P(b, qc + 0.55, 0.035), P(a, qc + 0.55, 0.035)], [0, 1, 0], 'chequer', 0.5);
    // the balustrades, and the handrails on them
    for (const e of [-0.6, 0.6]) {
      for (let k = 0; k + 1 < along.length; k++) {
        const a = along[k], b = along[k + 1];
        for (const d of [-0.05, 0.05]) {
          B.tint(0xc9cdd1);
          B.poly([P(a, qc + e + d, 0.04), P(b, qc + e + d, 0.04), P(b, qc + e + d, 0.95), P(a, qc + e + d, 0.95)], [w.x * d, 0, w.z * d], 'stainless', 1);
        }
        B.tint(0x18191b);
        B.poly([P(a, qc + e - 0.06, 0.95), P(b, qc + e - 0.06, 0.95), P(b, qc + e + 0.06, 0.95), P(a, qc + e + 0.06, 0.95)], [0, 1, 0], 'rubber');
        B.poly([P(a, qc + e - 0.06, 1.03), P(b, qc + e - 0.06, 1.03), P(b, qc + e + 0.06, 1.03), P(a, qc + e + 0.06, 1.03)], [0, 1, 0], 'rubber');
        for (const d of [-0.06, 0.06]) B.poly([P(a, qc + e + d, 0.95), P(b, qc + e + d, 0.95), P(b, qc + e + d, 1.03), P(a, qc + e + d, 1.03)], [w.x * d, 0, w.z * d], 'rubber');
      }
      for (const a of [along[0], along[3]]) {
        B.tint(0x18191b);
        B.poly([P(a, qc + e - 0.06, 0.04), P(a, qc + e + 0.06, 0.04), P(a, qc + e + 0.06, 1.03), P(a, qc + e - 0.06, 1.03)], [g.x, 0, g.z], 'rubber');
      }
    }
  }
}

// ------------------------------------------------------------------ ceilings
// Over the concourses and passages, CEILING m up (the height of their walls, src/station.ts), and
// over the stairs and escalators TC_SHAFT m over their slope; not where something comes through
// (its own slab is the ceiling there), nor in the cave or under the Blue passage's vault, nor out
// in the open over the street level, nor over the stairs that climb out of a platform's hall.
function ceilings(B: Builder, home: SurfaceRecord[], { walk, hits, cave }: TcScene) {
  const onPlatform = (v: THREE.Vector3) => {
    walk.query(v.x, v.z, hits);
    return hits.some((h) => h.data.rec.platformLines && Math.abs(h.y - v.y) < 0.6);
  };
  for (const rec of home) {
    if ((rec.kind !== 'floor' && rec.kind !== 'stairs') || rec.platformLines || rec.box.max.y > 3.5) continue;
    const rock = TC_BLUE_ROCK.has(rec.name);
    // a hall's ceiling carried on over the mouth of escalators going down from it to a platform, to
    // where their shaft's ceiling comes in, under a wall PORTAL m down
    let over: number | null = null, mouth = 0;
    if (rec.kind === 'stairs') {
      // (the ends of its slope: its lowest and highest corners)
      const vs = rec.top.flat(), lo = vs.reduce((a, b) => (b.y < a.y ? b : a)), hi = vs.reduce((a, b) => (b.y > a.y ? b : a));
      if (onPlatform(hi) || (onPlatform(lo) && rock)) continue;
      if (onPlatform(lo)) { over = hi.y + CEILING; mouth = hi.y - PORTAL; }
    }
    const rise = rec.kind === 'stairs' ? TC_SHAFT : CEILING;
    for (const t of split(rec.top, 1.5)) {
      const m = t[0].clone().add(t[1]).add(t[2]).multiplyScalar(1 / 3);
      if (cave?.contains(m.x, m.z) && (rec.kind === 'floor' || m.y < cave.y + 4)) continue;
      if (inPassage(m.x, m.z, 0.3)) continue;
      walk.query(m.x, m.z, hits);
      const top = Math.max(over ?? 0, m.y + rise);
      if (hits.some((h) => h.data.rec !== rec && h.y > m.y + 0.5 && h.y < top + 0.5)) continue;
      let tri: THREE.Vector3[] = t;
      if (over !== null) {
        const hall = over - CEILING > -1 ? 'ticket' : 'ceiling';
        B.tint(hall === 'ticket' ? 0xffffff : 0xe8e7e2);
        B.poly(t.map((v) => [v.x, over!, v.z] as V3), [0, -1, 0], hall, hall === 'ticket' ? 2.4 : 2);
        const [below, edge] = clipBelow(t, mouth);
        if (edge) {
          // (facing up the escalators, to the hall)
          const [a, b] = edge, y = mouth + rise, up = t.find((v) => v.y > mouth)!;
          let n: V3 = [b.z - a.z, 0, a.x - b.x];
          if (n[0] * (up.x - a.x) + n[2] * (up.z - a.z) < 0) n = [-n[0], 0, -n[2]];
          B.tint(0xe8e7e2);
          B.poly([[a.x, over, a.z], [b.x, over, b.z], [b.x, y, b.z], [a.x, y, a.z]], n, 'ceiling', 2);
        }
        if (below.length < 3) continue;
        tri = below;
      }
      const pts = tri.map((v) => [v.x, v.y + rise, v.z] as V3);
      if (rock) B.poly(pts, [0, -1, 0], 'rock', 1, tri.map((v) => [(v.x + v.z) / 16, v.y / 14] as [number, number]));
      // (the ticket halls at the street level's foot: round panels of mesh)
      else if (rec.kind === 'floor' && rec.box.max.y > -1) { B.tint(0xffffff); B.poly(pts, [0, -1, 0], 'ticket', 2.4); }
      else { B.tint(0xe8e7e2); B.poly(pts, [0, -1, 0], 'ceiling', 2); }
    }
  }
}

// The part of a triangle below the height y, and the line it is cut along (if it is).
function clipBelow(t: Tri, y: number): [THREE.Vector3[], [THREE.Vector3, THREE.Vector3] | null] {
  const out: THREE.Vector3[] = [], cut: THREE.Vector3[] = [];
  for (let i = 0; i < 3; i++) {
    const a = t[i], b = t[(i + 1) % 3];
    if (a.y <= y) out.push(a);
    if ((a.y <= y) !== (b.y <= y)) {
      const c = a.clone().lerp(b, (y - a.y) / (b.y - a.y));
      out.push(c); cut.push(c);
    }
  }
  return [out, cut.length === 2 ? [cut[0], cut[1]] : null];
}

// Triangles split until no side is longer than `max` m.
function split(tris: Tri[], max: number): Tri[] {
  const out: Tri[] = [];
  const go = (t: Tri) => {
    const l = [t[0].distanceTo(t[1]), t[1].distanceTo(t[2]), t[2].distanceTo(t[0])], k = l.indexOf(Math.max(...l));
    if (l[k] <= max) { out.push(t); return; }
    const a = t[k], b = t[(k + 1) % 3], c = t[(k + 2) % 3], m = a.clone().add(b).multiplyScalar(0.5);
    go([a, m, c]); go([m, b, c]);
  };
  tris.forEach(go);
  return out;
}

// ------------------------------------------------------------------ the Blue passage
// Its long straight stretch, from the side of the cave to its round end: `u` along it from PASSAGE.a,
// `q` across it from that side (0) to the other (PASSAGE.width).
const PAX = (() => {
  const [ax, az] = PASSAGE.a, [bx, bz] = PASSAGE.b, len = Math.hypot(bx - ax, bz - az);
  const u: V3 = [(bx - ax) / len, 0, (bz - az) / len], q: V3 = [-u[2], 0, u[0]];
  return { ax, az, len, u, q };
})();
const passageUQ = (x: number, z: number) => [(x - PAX.ax) * PAX.u[0] + (z - PAX.az) * PAX.u[2], (x - PAX.ax) * PAX.q[0] + (z - PAX.az) * PAX.q[2]];
const passageAt = (u: number, q: number, y: number): V3 => [PAX.ax + PAX.u[0] * u + PAX.q[0] * q, y, PAX.az + PAX.u[2] * u + PAX.q[2] * q];
let passageFrom = 0;
function inPassage(x: number, z: number, margin = 0) {
  const [u, q] = passageUQ(x, z);
  return u >= passageFrom && u <= PAX.len - 4 && q >= -margin && q <= PASSAGE.width + margin;
}

// The vault over the passage, from the tops of its walls (CEILING) to 2 m higher over its middle,
// rough; down its middle the two walkways (one each way) with a lane between them; the frieze
// along both walls a metre up; a frame of steel across it every 12 m with its lamps.
function passage(B: Builder, { walk, hits, cave }: TcScene, lamps: Lamp[]) {
  const W = PASSAGE.width;
  walk.query(...([PAX.ax, PAX.az] as [number, number]), hits);
  const floor = hits.find((h) => h.data.rec.name === 'rect22925');
  if (!floor) return;
  const y = floor.y;
  // where it comes out of the cave
  passageFrom = 0;
  while (passageFrom < PAX.len && cave?.contains(...(([x, , z]) => [x, z] as [number, number])(passageAt(passageFrom, W / 2, y)))) passageFrom += 1;
  const u0 = passageFrom, u1 = PAX.len - 4;
  if (u1 - u0 < 10) return;
  // the vault
  const NQ = 10;
  const V = (u: number, i: number): [V3, [number, number]] => {
    const q = (i / NQ) * W, d = Math.min(q, W - q), edge = i === 0 || i === NQ;
    const p = passageAt(u, q, 0);
    const h = CEILING + 2 * Math.sin((Math.PI * q) / W) + (edge ? 0 : rockNoiseLite(p[0], p[2]) * 0.35);
    return [[p[0], y + h, p[2]], [u / 16, 1 - d / 5.5]];
  };
  for (let u = u0; u < u1; u += 1) {
    const ub = Math.min(u + 1, u1);
    for (let i = 0; i < NQ; i++) {
      const [a, ua] = V(u, i), [b, ubv] = V(ub, i), [c, uc] = V(ub, i + 1), [d, ud] = V(u, i + 1);
      B.poly([a, b, c, d], [0, -1, 0], 'vault', 1, [ua, ubv, uc, ud]);
    }
  }
  // the frieze, on both walls
  for (const [q, nq] of [[0.02, 1], [W - 0.02, -1]]) {
    const a = passageAt(u0, q, y), b = passageAt(u1, q, y);
    B.tint(0xffffff);
    B.poly([[a[0], y + 1.05, a[2]], [b[0], y + 1.05, b[2]], [b[0], y + 1.55, b[2]], [a[0], y + 1.55, a[2]]], [PAX.q[0] * nq, 0, PAX.q[2] * nq], 'frieze', 1,
      [[u0 / 6.4, 0], [u1 / 6.4, 0], [u1 / 6.4, 1], [u0 / 6.4, 1]]);
  }
  // the walkways
  const w0 = u0 + 4, w1 = u1 - 4, up: V3 = [0, 1, 0];
  for (const qc of [W / 2 - 1.6, W / 2 + 1.6]) {
    B.tint(0x3a3c40);
    B.poly([passageAt(w0, qc - 0.5, y + 0.08), passageAt(w1, qc - 0.5, y + 0.08), passageAt(w1, qc + 0.5, y + 0.08), passageAt(w0, qc + 0.5, y + 0.08)], up, 'steps', 1,
      [[0, 0], [0, (w1 - w0) / 2.4], [1, (w1 - w0) / 2.4], [1, 0]]);
    B.tint(0xffffff);
    for (const [a, b] of [[w0 - 1.1, w0], [w1, w1 + 1.1]]) B.poly([passageAt(a, qc - 0.55, y + 0.03), passageAt(b, qc - 0.55, y + 0.03), passageAt(b, qc + 0.55, y + 0.03), passageAt(a, qc + 0.55, y + 0.03)], up, 'chequer', 0.5);
    for (const e of [-0.6, 0.6]) {
      const qa = qc + e;
      B.tint(0xc9cdd1);
      B.wallBox(passageAt(w0 - 1, qa, y), PAX.u, PAX.q, 0, w1 - w0 + 2, y, y + 0.95, -0.05, 0.05, 'stainless');
      B.tint(0x18191b);
      B.wallBox(passageAt(w0 - 1, qa, y), PAX.u, PAX.q, -0.03, w1 - w0 + 2.03, y + 0.95, y + 1.03, -0.06, 0.06, 'rubber');
    }
  }
  // the frames, with lamps under their beams
  for (let u = u0 + 6; u < u1 - 2; u += 12) {
    const o = passageAt(u, 0, y);
    B.tint(0x2c2e31);
    for (const q of [0.35, W - 0.35]) B.wallBox(o, PAX.q, PAX.u, q - 0.08, q + 0.08, y, y + 3.75, -0.08, 0.08, 'steel');
    B.wallBox(o, PAX.q, PAX.u, 0.25, W - 0.25, y + 3.55, y + 3.8, -0.1, 0.1, 'steel');
    B.wallBox(o, PAX.q, PAX.u, 0.8, W - 0.8, y + 3.53, y + 3.55, -0.06, 0.06, 'lamp', 2, ['top']);
    stripLamps([new THREE.Vector3(...passageAt(u, 0.8, y + 3.5)), new THREE.Vector3(...passageAt(u, W - 0.8, y + 3.5))],
      { power: 2.2, reach: 14, color: TUBE, down: 1, floor: y - 0.5, top: y + 6.5 }, lamps);
  }
}

// A cheap smooth bump in the plane, -1…1, for the passage's vault.
function rockNoiseLite(x: number, z: number) {
  return Math.sin(x * 0.9 + Math.sin(z * 0.7) * 1.3) * 0.6 + Math.sin(z * 1.7 + x * 0.4) * 0.4;
}

// ------------------------------------------------------------------ the upper red/green platform
// Three pillars of art down the middle of the upper platform, floor to ceiling (src/station.ts
// TC_CEILING), and a bench of Möller-Nielsen's either side of the middle one.
function upperPlatform(B: Builder, { tracks, hallOf, walk, hits, elevators }: TcScene) {
  const upper = tracks.filter((tr) => tr.platform && hallOf(tr) === 'upper');
  const tr = upper[0], partner = upper.find((o) => o !== tr && o.platform!.rec === tr?.platform!.rec);
  if (!tr || !partner) return;
  const { s0, s1, rec } = tr.platform!, y = rec.box.max.y;
  const p = new THREE.Vector3(), q = new THREE.Vector3(), t = new THREE.Vector3();
  const pts = partner.path.resample(0, partner.path.length, 1);
  const middle = (f: number): [V3, V3] => {
    const s = s0 + (s1 - s0) * f;
    tr.path.pointAt(s, p); tr.path.tangentAt(s, t);
    let best = Infinity;
    for (const o of pts) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < best) { best = d; q.copy(o); } }
    // (the platform runs one way along the track; the station's names say which end is which)
    return [[(p.x + q.x) / 2, y, (p.z + q.z) / 2], [t.x, 0, t.z]];
  };
  // towards the Central Station is south-west (x small, z large), Sergels torg north-east
  const sw = (() => { const a = middle(0)[0], b = middle(1)[0]; return a[0] - a[2] < b[0] - b[2] ? 0 : 1; })();
  const f = (x: number) => (sw === 0 ? x : 1 - x);
  // (each where the platform is clear round it: not over a stairwell, nor in a lift's way)
  const clear = ([c, along]: [V3, V3], r: number) => [-r, -r / 2, 0, r / 2, r].every((a) => [-1.2, 1.2].every((d) => {
    const x = c[0] + along[0] * a - along[2] * d, z = c[2] + along[2] * a + along[0] * d;
    walk.query(x, z, hits);
    return hits.some((h) => h.data.rec === rec && Math.abs(h.y - y) < 0.3)
      && !elevators.some((e) => x > e.box.min.x - 1 && x < e.box.max.x + 1 && z > e.box.min.z - 1 && z < e.box.max.z + 1 && e.box.max.y > y);
  }));
  const spot = (f0: number, r: number) => {
    for (let k = 0; k < 40; k++) {
      const fk = f0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.01;
      if (clear(middle(fk), r)) return fk;
    }
    return f0;
  };
  for (const [at, mat, size] of [[f(0.22), 'nilsson', 1.1], [f(0.5), 'helleberg', 0.9], [f(0.8), 'derkert', 1.0]] as [number, string, number][]) {
    const [c, along] = middle(spot(at, mat === 'helleberg' ? 6 : 1)), across: V3 = [-along[2], 0, along[0]];
    // its four sides, the texture once round them (src/textures.ts TC_PILLAR)
    B.tint(0xffffff);
    const h = T.TC_PILLAR.height, P = (a: number, d: number, up: number): V3 => [c[0] + along[0] * a + across[0] * d, y + up, c[2] + along[2] * a + across[2] * d];
    const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let k = 0; k < 4; k++) {
      const [a0, d0] = corners[k], [a1, d1] = corners[(k + 1) % 4], hs = size / 2;
      const n: V3 = [along[0] * (a0 + a1) + across[0] * (d0 + d1), 0, along[2] * (a0 + a1) + across[2] * (d0 + d1)];
      B.poly([P(a0 * hs, d0 * hs, 0), P(a1 * hs, d1 * hs, 0), P(a1 * hs, d1 * hs, h), P(a0 * hs, d0 * hs, h)], n, mat, 1,
        [[k / 4, 0], [(k + 1) / 4, 0], [(k + 1) / 4, 1], [k / 4, 1]]);
    }
    // Möller-Nielsen's benches, either side of the middle pillar
    if (mat !== 'helleberg') continue;
    for (const d of [-4.5, 4.5]) {
      const b: V3 = [c[0] + along[0] * d, y, c[2] + along[2] * d];
      bench(B, b, along);
    }
  }
}

// A bench of cast stone, its seat a long rounded slab on two rounded feet.
function bench(B: Builder, c: V3, along: V3) {
  const across: V3 = [-along[2], 0, along[0]], L = 2.6, D = 0.62;
  B.tint(0xcfc7b8);
  const N = 14;
  const ring = (h: number, inset: number) => {
    const out: V3[] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      // a stadium: straight along, round at the ends
      const x = (L / 2 - D / 2) * Math.sign(ca) * Math.min(1, Math.abs(ca) * 3) + (D / 2 - inset) * ca, z = (D / 2 - inset) * sa;
      out.push([c[0] + along[0] * x + across[0] * z, c[1] + h, c[2] + along[2] * x + across[2] * z]);
    }
    return out;
  };
  const rings = [ring(0.3, 0.06), ring(0.36, 0), ring(0.44, 0), ring(0.47, 0.06)];
  for (let k = 0; k + 1 < rings.length; k++) {
    for (let i = 0; i < N; i++) {
      const a = rings[k][i], b = rings[k][(i + 1) % N], cc = rings[k + 1][(i + 1) % N], d = rings[k + 1][i];
      const n: V3 = [(a[0] + b[0]) / 2 - c[0], 0, (a[2] + b[2]) / 2 - c[2]];
      B.poly([a, b, cc, d], n, 'paint');
    }
  }
  B.poly(rings[3], [0, 1, 0], 'paint');
  B.poly(rings[0], [0, -1, 0], 'paint');
  for (const x of [-0.8, 0.8]) {
    const o: V3 = [c[0] + along[0] * x, c[1], c[2] + along[2] * x];
    B.wallBox(o, along, across, -0.18, 0.18, c[1], c[1] + 0.31, -0.2, 0.2, 'paint');
  }
}
