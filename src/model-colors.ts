import type * as THREE from 'three';
import type { LineId } from './lines';

// The station models identify each piece only by its colour.
export type RecordKind = 'deco' | 'floor' | 'stairs' | 'lightblue' | 'elevator' | 'tube' | 'gates' | `track:${LineId}`;

const PALETTE: [RecordKind, [number, number, number]][] = [
  ['track:blue', [0.0018, 0.2874, 0.6445]],
  ['track:red', [0.7913, 0.013, 0.0194]],
  ['track:green', [0.013, 0.4452, 0.1022]],
  ['track:pink', [0.8879, 0.1329, 0.3813]],
  ['track:tram', [0.2195, 0.2346, 0.2159]],
  ['track:main', [0.3771, 0.4195, 0.8]],
  ['floor', [0.7084, 0.7084, 0.7682]],
  ['floor', [0.84, 0.84, 0.84]],
  ['floor', [0.9, 0.86, 0.83]],
  ['stairs', [0.9, 0.77, 0.68]],
  ['lightblue', [0.67, 0.78, 1.0]],
  ['gates', [1.0, 0.6, 0.0]],
];

export function classifyColor(c: THREE.Color) {
  let best: RecordKind = 'deco', bestD = 0.02;
  for (const [kind, rgb] of PALETTE) {
    const d = (c.r - rgb[0]) ** 2 + (c.g - rgb[1]) ** 2 + (c.b - rgb[2]) ** 2;
    if (d < bestD) { bestD = d; best = kind; }
  }
  return best;
}
