// The areas the city is drawn in detail near the camera (src/detail/index.ts): circles in world x,
// z. In them the buildings get real facades, and the streets and trees are drawn
// (src/detail/streets.ts), which tools/fetch-streets.ts and tools/find-trees.ts fetch for these
// areas only. It imports nothing, so the tools can use it on Node too.

// ?nodetail: the plain city everywhere, to compare
export const DETAIL_ON = typeof location === 'undefined' || !new URLSearchParams(location.search).has('nodetail');

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
  // the red line's bridge over Stocksundet, between Bergshamra and Danderyds sjukhus
  // (src/detail/stocksundet.ts): the wooded shores either side, the villas on the north shore
  // and the paths under its ends
  { name: 'Stocksundet', x: -1255, z: -5940, r: 220 },
  // the green line from Tallkrogen to Gubbängen (src/detail/gubbangen.ts): the bridges over Victor
  // Balcks väg and the bank south of them, the woods the line runs through between the villas,
  // the rock cutting and Herrhagsvägen's bridge north of Gubbängen, and the station with the
  // centre beside it
  { name: 'Tallkrogen south', x: 1400, z: 6880, r: 200 },
  { name: 'Gubbängen–Tallkrogen', x: 1320, z: 7240, r: 200 },
  { name: 'Gubbängen', x: 1325, z: 7620, r: 200 },
];

// whether (x, z) is in an area, or within `margin` metres of one
export const inDetailArea = (x: number, z: number, margin = 0) => DETAIL_AREAS.some((a) => Math.hypot(x - a.x, z - a.z) < a.r + margin);
