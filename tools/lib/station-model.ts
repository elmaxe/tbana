// Reads a station model's tracks and floors, for the tools.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { classifyColor } from '../../src/model-colors.ts';
import { extractCenterlines, splitComponents } from '../../src/polyline.ts';
import type { Tri } from '../../src/polyline.ts';
import type { PlatformTrack, TrackGraph, TrackPiece } from '../../src/track-graph.ts';
import { pointAt } from './graph.ts';

export type TrackKind = 'blue' | 'red' | 'green' | 'pink' | 'tram' | 'main';
// `track` numbers the model's track centre lines
export interface TrackSample { kind: TrackKind; x: number; y: number; z: number; track?: number }

function loadModel(path: string): Promise<THREE.Object3D> {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((ok, fail) => new GLTFLoader().parse(ab, '', (g) => ok(g.scene), fail));
}

// The model's track ribbons reduced to centre lines and sampled every 2 m, and the top faces of
// its floors, in the model's own coordinates. A track ribbon is drawn at platform level.
export async function loadStationModel(name: string) {
  const root = await loadModel(`public/assets/${name}.glb`);
  root.updateMatrixWorld(true);
  const samples: TrackSample[] = [];
  const floors: Tri[] = [];
  let tracks = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const kind = classifyColor((mesh.material as THREE.MeshStandardMaterial).color);
    if (kind !== 'floor' && !kind.startsWith('track:')) return;
    let g = mesh.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    g.applyMatrix4(mesh.matrixWorld);
    g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal;
    const top: Tri[] = [];
    for (let i = 0; i < p.count; i += 3) {
      if ((n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3 < 0.35) continue;
      top.push([0, 1, 2].map((k) => new THREE.Vector3(p.getX(i + k), p.getY(i + k), p.getZ(i + k))) as Tri);
    }
    if (kind === 'floor') { floors.push(...top); return; }
    for (const comp of splitComponents(top)) {
      for (const pl of extractCenterlines(comp)) {
        const track = tracks++;
        for (const v of pl.resample(0, pl.length, 2)) samples.push({ kind: kind.slice(6) as TrackKind, x: v.x, y: v.y, z: v.z, track });
      }
    }
  });
  return { samples, floors };
}

// Model coordinates to world coordinates with a placement from public/data/stations.json
// (three.js's rotation about +y, then the shift, which lifts the heights too).
export function placeSample<T extends { x: number; y?: number; z: number }>(s: T, place: { rotationY: number; position: [number, number, number] }): T {
  const a = (place.rotationY * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  const out = { ...s, x: c * s.x + sn * s.z + place.position[0], z: -sn * s.x + c * s.z + place.position[2] };
  if (s.y !== undefined) out.y = s.y + place.position[1];
  return out;
}

// The model's track under each point of the graph's platform tracks at a station drawn from a
// model, of the same line: the nearest within 3 m. Where OpenStreetMap is further from the model
// than that along most of a platform track (Albert Guillaumes draws Fridhemsplan's blue line some
// degrees off the map's angle, 13–34 m from it), the platform track is paired with one of the
// model's tracks of its line instead, in order across the line (the leftmost with the leftmost),
// and each point gets that track's nearest point.
export function modelPlatforms(graph: TrackGraph, station: string, samples: TrackSample[]) {
  const st = graph.stations.find((s) => s.name === station);
  const lineOf = (p: TrackPiece): string[] => p.lines.filter((l) => l === 'red' || l === 'green' || l === 'blue');
  const nearest = (x: number, z: number, list: TrackSample[], reach: number) => {
    let best: TrackSample | null = null, bestD = reach;
    for (const m of list) {
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  };
  // the foot of the perpendicular from (x, z) on a track's centre line (its samples in order)
  const foot = (x: number, z: number, list: TrackSample[]): TrackSample => {
    let best = list[0], bestD = Infinity;
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i], dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      const q = { ...a, x: a.x + dx * t, y: a.y + (b.y - a.y) * t, z: a.z + dz * t };
      const d = Math.hypot(q.x - x, q.z - z);
      if (d < bestD) { bestD = d; best = q; }
    }
    return best;
  };
  const tracks = st?.platforms.flatMap((p) => p.tracks) ?? [];
  // the model's track each platform track is paired with, where the nearest is too far
  const paired = new Map<PlatformTrack, TrackSample[]>();
  const failed = tracks.filter((t) => {
    const lines = lineOf(graph.pieces[t.piece]), own = samples.filter((m) => lines.includes(m.kind));
    let hit = 0, n = 0;
    for (let s = t.s0; s <= t.s1; s += 5, n++) if (nearest(...pointAt(graph.pieces[t.piece], s), own, 3)) hit++;
    return lines.length > 0 && hit < n / 2;
  });
  for (const line of new Set(failed.flatMap((t) => lineOf(graph.pieces[t.piece])))) {
    const mine = failed.filter((t) => lineOf(graph.pieces[t.piece]).includes(line));
    // across the first platform track, at its middle
    const t0 = mine[0], p0 = graph.pieces[t0.piece];
    const [mx, mz] = pointAt(p0, (t0.s0 + t0.s1) / 2), [ax, az] = pointAt(p0, t0.s0), [bx, bz] = pointAt(p0, t0.s1);
    const len = Math.hypot(bx - ax, bz - az) || 1, dx = (bx - ax) / len, dz = (bz - az) / len;
    const across = (x: number, z: number) => dx * (z - mz) - dz * (x - mx);
    const along = (x: number, z: number) => dx * (x - mx) + dz * (z - mz);
    const byTrack = new Map<number, TrackSample[]>();
    for (const m of samples) {
      if (m.kind !== line || m.track === undefined || Math.abs(along(m.x, m.z)) > 80 || Math.abs(across(m.x, m.z)) > 60) continue;
      (byTrack.get(m.track) ?? byTrack.set(m.track, []).get(m.track)!).push(m);
    }
    const model = [...byTrack.values()].filter((list) => list.length >= 20)
      .map((list) => ({ list, off: list.reduce((a, m) => a + across(m.x, m.z), 0) / list.length })).sort((a, b) => a.off - b.off);
    const graphOff = mine.map((t) => {
      const [x, z] = pointAt(graph.pieces[t.piece], (t.s0 + t.s1) / 2);
      return { t, off: across(x, z) };
    }).sort((a, b) => a.off - b.off);
    if (model.length !== graphOff.length) continue;
    // the whole of the paired track: OpenStreetMap's platform may lie some way along it
    graphOff.forEach(({ t }, i) => paired.set(t, samples.filter((m) => m.track === model[i].list[0].track)));
  }
  // the model's track under a point s along a piece, or null where it isn't along a platform; and
  // the platform tracks paired with the model's tracks
  const under = (pieceId: number, s: number, x: number, z: number): TrackSample | null => {
    const p = graph.pieces[pieceId], lines = lineOf(p);
    const t = tracks.find((r) => r.piece === pieceId && s >= r.s0 && s <= r.s1);
    if (!t || !lines.length) return null;
    const list = paired.get(t);
    return list ? foot(x, z, list) : nearest(x, z, samples.filter((m) => lines.includes(m.kind)), 3);
  };
  return Object.assign(under, { paired: [...paired.keys()] });
}
