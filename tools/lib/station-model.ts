// Reads a station model's tracks and floors, for the tools.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { classifyColor } from '../../src/model-colors.ts';
import { extractCenterlines, splitComponents } from '../../src/polyline.ts';
import type { Tri } from '../../src/polyline.ts';

export type TrackKind = 'blue' | 'red' | 'green' | 'pink' | 'tram' | 'main';
export interface TrackSample { kind: TrackKind; x: number; y: number; z: number }

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
        for (const v of pl.resample(0, pl.length, 2)) samples.push({ kind: kind.slice(6) as TrackKind, x: v.x, y: v.y, z: v.z });
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
