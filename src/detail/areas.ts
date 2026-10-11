// The areas the city is drawn in detail near the camera (src/detail/index.ts): circles in world x,
// z. In them the buildings get real facades, and the streets and trees are drawn
// (src/detail/streets.ts), which tools/fetch-streets.ts and tools/find-trees.ts fetch for these
// areas only. It imports nothing, so the tools can use it on Node too.

export interface DetailArea { name: string; x: number; z: number; r: number }

export const DETAIL_AREAS: DetailArea[] = [
  { name: 'Hötorget', x: 270, z: -420, r: 165 },
  // what the trains' bridge over Söderström looks out on: Gamla stan's west and south fronts,
  // Riddarholmen's south end and Söder Mälarstrand
  { name: 'Gamla stan', x: 560, z: 930, r: 140 },
  { name: 'Riddarholmen', x: 330, z: 790, r: 80 },
  { name: 'Söder Mälarstrand', x: 520, z: 1215, r: 160 },
  // east of the bridge: Guldbron, the lock and Katarinahissen (src/detail/slussen.ts), Slussplan
  { name: 'Slussen', x: 765, z: 1235, r: 150 },
  // the red line's end: Ropsten's bus square and tram stop under the platforms, Hjorthagen's hill
  // over them, and the shore at the foot of Lidingöbron (src/detail/ropsten.ts)
  { name: 'Ropsten', x: 2480, z: -2905, r: 200 },
  { name: 'Lidingöbron', x: 2690, z: -2990, r: 110 },
];

// whether (x, z) is in an area, or within `margin` metres of one
export const inDetailArea = (x: number, z: number, margin = 0) => DETAIL_AREAS.some((a) => Math.hypot(x - a.x, z - a.z) < a.r + margin);
