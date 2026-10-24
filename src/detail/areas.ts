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
  // and on south to Farsta strand: the steel viaduct over Gubbängsfältet, Hökarängen, the woods
  // and the industrial estate the line runs past to Farsta, Farsta's bridges and centre, and the
  // cut between the tunnels before Farsta strand
  { name: 'Gubbängsfältet', x: 1332, z: 7960, r: 200 },
  { name: 'Hökarängen', x: 1365, z: 8280, r: 200 },
  { name: 'Hökarängen–Farsta 1', x: 1530, z: 8510, r: 200 },
  { name: 'Hökarängen–Farsta 2', x: 1700, z: 8730, r: 200 },
  { name: 'Hökarängen–Farsta 3', x: 1795, z: 9010, r: 200 },
  { name: 'Farsta north', x: 1830, z: 9300, r: 200 },
  { name: 'Farsta bridges', x: 1890, z: 9590, r: 200 },
  { name: 'Farsta', x: 2030, z: 9870, r: 200 },
  { name: 'Farsta strand', x: 2320, z: 10600, r: 150 },
  // and north from Tallkrogen to Gullmarsplan (src/detail/farsta-line-north.ts): the bridge over
  // the path in the woods, the long one over Nynäsvägen, the cemetery's edge, the bridge over
  // Sockenvägen into Skogskyrkogården, Sandsborg and Blåsut between the blocks, the bridge over
  // Sofielundsvägen, Skärmarbrink where the Skarpnäck line joins, and the bridge over
  // Hammarbybacken into Gullmarsplan
  { name: 'Tallkrogen', x: 1600, z: 6620, r: 200 },
  { name: 'Tallkrogen–Skogskyrkogården 1', x: 1800, z: 6430, r: 200 },
  { name: 'Tallkrogen–Skogskyrkogården 2', x: 1960, z: 6270, r: 200 },
  { name: 'Skogskyrkogården north', x: 2050, z: 6020, r: 200 },
  { name: 'Skogskyrkogården', x: 2070, z: 5800, r: 200 },
  { name: 'Skogskyrkogården–Sandsborg', x: 2020, z: 5520, r: 200 },
  { name: 'Sandsborg', x: 1910, z: 5170, r: 200 },
  { name: 'Sandsborg–Blåsut', x: 1840, z: 4860, r: 200 },
  { name: 'Blåsut', x: 1835, z: 4560, r: 200 },
  { name: 'Blåsut–Skärmarbrink', x: 1855, z: 4280, r: 200 },
  { name: 'Skärmarbrink', x: 1760, z: 4010, r: 200 },
  { name: 'Skärmarbrink–Gullmarsplan', x: 1530, z: 3840, r: 200 },
  { name: 'Gullmarsplan', x: 1300, z: 3660, r: 200 },
  // and north from Gullmarsplan over Skanstullsbron (src/detail/skanstull.ts) to the tunnel under
  // Södermalm: the slopes down from Gullmarsplan, Hammarby kanal with Skansbron and its quays, and the
  // low ground under the bridge's arches at Södermalm's foot
  { name: 'Skanstullsbron south', x: 1180, z: 3300, r: 200 },
  { name: 'Skanstullsbron', x: 1110, z: 3080, r: 200 },
  { name: 'Skanstullsbron north', x: 1040, z: 2860, r: 200 },
  // and the Hagsätra line from Gullmarsplan to Hagsätra (src/detail/hagsatra-line.ts): past Globen's
  // arenas and Enskede gård on its bank, over Sockenplan's square and Svedmyra's street, between the
  // villas of Stureby, over Örbyleden to Bandhagen, past Högdalen's centre, over Magelungsvägen and
  // the Nynäs railway to Rågsved, and over Rågsvedsvägen round into Hagsätra
  { name: 'Gullmarsplan–Globen', x: 1170, z: 3960, r: 200 },
  { name: 'Globen', x: 1000, z: 4190, r: 200 },
  // (and the arenas east of the station, in view from it: src/detail/globen.ts)
  { name: 'Globen arenas', x: 1330, z: 4230, r: 200 },
  { name: 'Globen–Enskede gård', x: 740, z: 4330, r: 200 },
  { name: 'Enskede gård', x: 630, z: 4630, r: 200 },
  { name: 'Enskede gård–Sockenplan 1', x: 740, z: 4920, r: 200 },
  { name: 'Enskede gård–Sockenplan 2', x: 765, z: 5150, r: 200 },
  { name: 'Sockenplan', x: 665, z: 5370, r: 200 },
  { name: 'Sockenplan–Svedmyra', x: 580, z: 5640, r: 200 },
  { name: 'Svedmyra', x: 520, z: 5920, r: 200 },
  { name: 'Svedmyra–Stureby 1', x: 330, z: 6120, r: 200 },
  { name: 'Svedmyra–Stureby 2', x: 90, z: 6255, r: 200 },
  { name: 'Stureby', x: -180, z: 6345, r: 200 },
  { name: 'Stureby–Bandhagen', x: -420, z: 6510, r: 200 },
  { name: 'Bandhagen', x: -530, z: 6780, r: 200 },
  { name: 'Bandhagen–Högdalen 1', x: -610, z: 7050, r: 200 },
  { name: 'Bandhagen–Högdalen 2', x: -780, z: 7310, r: 200 },
  { name: 'Högdalen', x: -910, z: 7570, r: 200 },
  { name: 'Högdalen–Rågsved 1', x: -1080, z: 7860, r: 200 },
  { name: 'Högdalen–Rågsved 2', x: -1330, z: 8030, r: 200 },
  { name: 'Högdalen–Rågsved 3', x: -1560, z: 8190, r: 200 },
  { name: 'Rågsved', x: -1770, z: 8360, r: 200 },
  { name: 'Rågsved–Hagsätra 1', x: -2050, z: 8430, r: 200 },
  { name: 'Rågsved–Hagsätra 2', x: -2320, z: 8300, r: 200 },
  { name: 'Rågsved–Hagsätra 3', x: -2500, z: 8050, r: 200 },
  { name: 'Hagsätra', x: -2620, z: 7730, r: 200 },
  // and the Skarpnäck line from Skärmarbrink to Bagarmossen's tunnel (src/detail/skarpnack-line.ts):
  // over the Farsta line's tracks and Sparrmansvägen to Hammarbyhöjden, over Ulricehamnsvägen, the
  // long viaduct over Malmövägen to Björkhagen, over Halmstadsvägen, the viaduct over the park and
  // Ystadsvägen to Kärrtorp, over Kärrtorpsplan, and the viaduct over Sockenvägen into the rock
  { name: 'Skärmarbrink–Hammarbyhöjden 1', x: 2030, z: 4140, r: 200 },
  { name: 'Skärmarbrink–Hammarbyhöjden 2', x: 2300, z: 4100, r: 200 },
  { name: 'Hammarbyhöjden', x: 2575, z: 4085, r: 200 },
  { name: 'Hammarbyhöjden–Björkhagen 1', x: 2860, z: 4095, r: 200 },
  { name: 'Hammarbyhöjden–Björkhagen 2', x: 3110, z: 4200, r: 200 },
  { name: 'Björkhagen', x: 3215, z: 4455, r: 200 },
  { name: 'Björkhagen–Kärrtorp 1', x: 3200, z: 4760, r: 200 },
  { name: 'Björkhagen–Kärrtorp 2', x: 3150, z: 5005, r: 200 },
  { name: 'Kärrtorp', x: 3165, z: 5250, r: 200 },
  { name: 'Kärrtorp–Bagarmossen 1', x: 3315, z: 5520, r: 200 },
  { name: 'Kärrtorp–Bagarmossen 2', x: 3480, z: 5745, r: 200 },
  { name: 'Kärrtorp–Bagarmossen 3', x: 3650, z: 5875, r: 150 },
];

// whether (x, z) is in an area, or within `margin` metres of one
export const inDetailArea = (x: number, z: number, margin = 0) => DETAIL_AREAS.some((a) => Math.hypot(x - a.x, z - a.z) < a.r + margin);
