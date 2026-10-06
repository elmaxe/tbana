import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Albert Guillaumes' 3D models of the stations the game draws from them, T-Centralen first, placed
// on the world grid (src/geo.ts) as public/data/stations.json says (fitted by tools/fit-station.ts).
// They are loaded into one group, each model in a group of its own named after its station, so that
// src/station.ts builds them as one: every piece knows which station it is in.

// The station model the game starts in, and whose box is "the station" for the minimap.
export const HOME_STATION = 'T-Centralen';

export interface StationPlacement {
  name: string;      // the station, as the track graph names it
  model: string;     // the glTF file, from the site's root
  // world = the model turned by `rotationY` degrees about the vertical axis (three.js convention),
  // then moved by `position`
  rotationY: number;
  position: [number, number, number];
}

// The models, home first, in one group; `progress` is told the share loaded so far.
export async function loadStationModels(places: Record<string, StationPlacement>, progress?: (f: number) => void) {
  const list = Object.values(places).sort((a, b) => +(b.name === HOME_STATION) - +(a.name === HOME_STATION));
  const loaded = new Array<number>(list.length).fill(0), total = new Array<number>(list.length).fill(0);
  const loader = new GLTFLoader();
  const scenes = await Promise.all(list.map((place, i) => loader.loadAsync(place.model, (e) => {
    loaded[i] = e.loaded; total[i] = e.total;
    const t = total.reduce((a, b) => a + b, 0);
    if (t) progress?.(loaded.reduce((a, b) => a + b, 0) / t);
  })));
  const root = new THREE.Group();
  root.name = 'station models';
  scenes.forEach((gltf, i) => {
    const place = list[i];
    const g = new THREE.Group();
    g.name = place.name;
    g.userData.station = place.name;
    gltf.scene.rotation.y = THREE.MathUtils.degToRad(place.rotationY);
    gltf.scene.position.fromArray(place.position);
    g.add(gltf.scene);
    root.add(g);
  });
  return root;
}

// The station a part of a model is in (the name of the group round its model).
export function stationOf(obj: THREE.Object3D) {
  for (let o: THREE.Object3D | null = obj; o; o = o.parent) if (typeof o.userData.station === 'string') return o.userData.station as string;
  return HOME_STATION;
}
