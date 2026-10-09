import * as THREE from 'three';
import * as T from '../textures';

// The detailed buildings' materials, shared by all of them; each is tinted by vertex colours.
let mats: Map<string, THREE.Material> | null = null;

export function detailMaterials() {
  if (mats) return mats;
  const std = (map: THREE.Texture | null, roughness: number, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness, metalness, ...extra });
  mats = new Map<string, THREE.Material>([
    ['plaster', std(T.plaster(), 0.9)],
    ['brick', std(T.brickBond(), 0.95)],
    ['concrete', std(T.concrete(17, 228), 0.9)],
    ['stone', std(T.concrete(9, 170), 0.85)],
    ['roof', std(T.roofSeams(), 0.6, 0.25)],
    ['copper', std(T.verdigris(), 0.7, 0.15)],
    ['window', std(T.detailWindow(), 0.25, 0.1)],
    ['door', std(T.detailDoor(), 0.6)],
    ['shop', std(T.detailShop(), 0.3, 0.05)],
    ['curtain', std(T.curtainWall(), 0.2, 0.35)],
    ['metal', std(null, 0.45, 0.6)],
  ]);
  return mats;
}
