import * as THREE from 'three';
import * as T from '../textures';

// The detailed buildings' materials, shared by all of them; each is tinted by vertex colours. Made
// when first drawn: these, and those the landmarks add with addMaterial.
const made = new Map<string, THREE.Material>();
const recipes = new Map<string, () => THREE.Material>();

export const standard = (map: THREE.Texture | null, roughness: number, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness, metalness, ...extra });

for (const [key, make] of [
  ['plaster', () => standard(T.plaster(), 0.9)],
  ['brick', () => standard(T.brickBond(), 0.95)],
  ['concrete', () => standard(T.concrete(17, 228), 0.9)],
  ['stone', () => standard(T.concrete(9, 170), 0.85)],
  ['roof', () => standard(T.roofSeams(), 0.6, 0.25)],
  ['copper', () => standard(T.verdigris(), 0.7, 0.15)],
  ['window', () => standard(T.detailWindow(), 0.5)],
  ['door', () => standard(T.detailDoor(), 0.6)],
  ['shop', () => standard(T.detailShop(), 0.4)],
  ['curtain', () => standard(T.curtainWall(), 0.4, 0.05)],
  ['metal', () => standard(null, 0.45, 0.6)],
] as [string, () => THREE.Material][]) recipes.set(key, make);

export function addMaterial(key: string, make: () => THREE.Material) {
  if (!recipes.has(key)) recipes.set(key, make);
}

export function detailMaterial(key: string) {
  let m = made.get(key);
  if (!m) {
    const make = recipes.get(key);
    if (!make) throw new Error(`no detail material ${key}`);
    made.set(key, m = make());
  }
  return m;
}
