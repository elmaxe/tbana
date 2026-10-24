import { prism } from '../clip.ts';
import type { Volume } from '../clip.ts';
import { DETAIL_ON } from './areas.ts';

// The metro's viaducts drawn in detail near the camera, with the station on them: Ropsten's
// (src/detail/ropsten-station.ts), Brommaplan's two decks over the square and its ticket hall,
// whose round piers and railings the station's style draws (src/open-styles.ts), Åkeshov's three
// over its ticket hall and the underpass, which stand on the hall's walls, and Bredäng's over
// Bredängs Allé and the square, whose piers and railings its style draws too, and Kista's over the
// bus terminal and Kistagången, whose piers, columns and parapets its style draws, and the bridge
// over Stocksundet (src/detail/stocksundet.ts), and Tallkrogen's two over Victor Balcks väg
// (src/detail/gubbangen.ts), and the viaduct over Gubbängsfältet south of Gubbängen, Hökarängen's
// over Örbyleden, Farsta's over Farstavägen and its two decks into the station
// (src/detail/farsta-line.ts), and those north of Tallkrogen to Gullmarsplan
// (src/detail/farsta-line-north.ts) and on the Hagsätra line (src/detail/hagsatra-line.ts). Within
// `r` metres of `at` the network (src/network.ts) leaves out its own piers, the railings along its
// decks and the lamps over its platforms, and keeps the player off its platforms where the `solids`
// stand on them; where `girder`, it leaves out its decks' girders too, which the landmark draws in
// their real shape.
// Like src/detail/areas.ts it imports next to nothing, for the network.

// Ropsten's frame, as `node tools/build-stations.ts --frame Ropsten` prints it: s metres along the
// platforms from their middle towards the north-east, u to the right of that (south-east); the
// rails' top and the platforms', RH 2000.
export const ROPSTEN = { x: 2441.377, z: -2861.216, tx: 0.593874, tz: -0.804558, rail: 11.48, platform: 12.48 };
export const ropstenWorld = (s: number, u: number): [number, number] =>
  [ROPSTEN.x + ROPSTEN.tx * s - ROPSTEN.tz * u, ROPSTEN.z + ROPSTEN.tz * s + ROPSTEN.tx * u];

// Roland Kempe's snake wall, between the two platforms at the concourse's south-west end
export const SNAKE_WALL = { s0: -62, s1: -57.5, u0: -6.1, u1: 4.7 };

const box = (s0: number, s1: number, u0: number, u1: number, y0: number, y1: number): Volume =>
  prism([ropstenWorld(s0, u0), ropstenWorld(s1, u0), ropstenWorld(s1, u1), ropstenWorld(s0, u1)], [y0, y0, y0, y0], [y1, y1, y1, y1]);

export const DETAILED_VIADUCTS: { name: string; at: [number, number]; r: number; solids: Volume[]; girder?: boolean }[] = [
  { name: 'Ropsten', at: ropstenWorld(12, 0), r: 105, solids: [box(SNAKE_WALL.s0, SNAKE_WALL.s1, SNAKE_WALL.u0, SNAKE_WALL.u1, ROPSTEN.platform - 0.5, ROPSTEN.platform + 3)] },
  // (from 151 m to 79 m west of Brommaplan's platform's middle)
  { name: 'Brommaplan', at: [-6850.0, -769.5], r: 36, solids: [] },
  // (from 76 m to 124 m east of Åkeshov's platforms' middle)
  { name: 'Åkeshov', at: [-7602.6, -1167.8], r: 24, solids: [] },
  // (from 25 m west of Bredäng's platform's west tip to 155 m east of it)
  { name: 'Bredäng', at: [-7175.3, 4095.8], r: 90, solids: [] },
  // (from 103 m south-east of Kista's platform's middle to 133 m north-west of it)
  { name: 'Kista', at: [-6623.21, -7958.56], r: 118, solids: [] },
  // (from the southern abutment to the northern one, 116 m either side of the middle)
  { name: 'Stocksundet', at: [-1259.47, -5935.8], r: 122, solids: [], girder: true },
  // (the network's bridges there, 22 m either side of the middle of their spans)
  { name: 'Tallkrogen', at: [1490.5, 6736.7], r: 23, solids: [], girder: true },
  // (the whole viaduct over Gubbängsfältet, from 7774 to 7963.4 south of the origin, where the
  // network's tracks are a bridge)
  { name: 'Gubbängsfältet', at: [1335, 7868.7], r: 95.5, solids: [], girder: true },
  // (Hökarängen's two over Örbyleden, from 8141 to 8210, over the station's ticket hall at their south end)
  { name: 'Hökarängen', at: [1339, 8175.5], r: 36.5, solids: [], girder: true },
  // (the bridge over Farstavägen north of Farsta, from 9290.5 to 9367)
  { name: 'Farstavägen', at: [1835, 9328.8], r: 38.8, solids: [], girder: true },
  // (Farsta's two decks north of the platform, from where the tracks become a bridge to the network's
  // pier under the platform's north end, 9742 and 9746.2 south of the origin)
  { name: 'Farsta', at: [1937.25, 9690], r: 55.5, solids: [], girder: true },
  // (north of Tallkrogen: the bridge over the path in the woods, the one over Nynäsvägen,
  // Sockenvägen's to Skogskyrkogården's platform, and the steel ones south of Blåsut and east of
  // Gullmarsplan, each over the whole stretch where the network's tracks are a bridge)
  { name: 'Tallkrogen path', at: [1688.3, 6536.8], r: 15, solids: [], girder: true },
  { name: 'Nynäsvägen', at: [1917.2, 6326.4], r: 86, solids: [], girder: true },
  { name: 'Sockenvägen', at: [2075, 5797], r: 61.5, solids: [], girder: true },
  { name: 'Sofielundsvägen', at: [1827, 4740.5], r: 23, solids: [], girder: true },
  { name: 'Hammarbybacken', at: [1549.4, 3849.3], r: 17, solids: [], girder: true },
  // (Sockenplan's viaduct, from the bank's end to the station's hall, 125.5 m south of it:
  // src/detail/hagsatra-line.ts)
  { name: 'Sockenplan', at: [690.3, 5314.1], r: 63.3, solids: [], girder: true },
  // (Svedmyra's, from the bank's end to the platform's north end, 73 m south of it)
  { name: 'Svedmyra', at: [528.1, 5930.7], r: 39.3, solids: [], girder: true },
  // (Skönviksvägen's, between Svedmyra and Stureby, abutment to abutment)
  { name: 'Skönviksvägen', at: [-18.3, 6299.3], r: 22.3, solids: [], girder: true },
  // (Bandhagsvägen's, west of Stureby, abutment to abutment)
  { name: 'Bandhagsvägen', at: [-305.6, 6370.5], r: 25.6, solids: [], girder: true },
  // (the two arches over Örbyleden north of Bandhagen, abutment to abutment)
  { name: 'Örbyleden', at: [-489.1, 6636.9], r: 44, solids: [], girder: true },
  // (Magelungsvägen's, between Högdalen and Rågsved, end to end)
  { name: 'Magelungsvägen', at: [-1232.6, 7977.0], r: 27, solids: [], girder: true },
  // (the slab over the Nynäs railway west of it, and the bank under the network's floor beyond its
  // ends: OpenStreetMap's bridge is twice as long)
  { name: 'Nynäs railway', at: [-1330.9, 8029.8], r: 16.5, solids: [], girder: true },
  // (the path's bridge south of Högdalen, Bjursätragatan's east of Rågsved, Rågsvedsvägen's arch
  // west of it and the viaduct over Olshammarsgatan south-east of Hagsätra, each with the bank
  // beyond its ends where OpenStreetMap's bridge runs on: 65 m of it north of the viaduct)
  { name: 'Högdalen path', at: [-729.2, 7246.1], r: 13.2, solids: [], girder: true },
  // (the depot tracks' slab over the main line and the cycleway south of Högdalen, and the bank beyond
  // its ends, where OpenStreetMap's bridges run on along each track: 26 m either side of the middle)
  { name: 'Högdalen depot', at: [-1010.8, 7775.5], r: 27, solids: [], girder: true },
  { name: 'Bjursätragatan', at: [-1624.2, 8242.2], r: 31.5, solids: [], girder: true },
  { name: 'Rågsvedsvägen', at: [-2161.3, 8410.1], r: 45.8, solids: [], girder: true },
  { name: 'Olshammarsgatan', at: [-2565.5, 7838.6], r: 71.5, solids: [], girder: true },
  // (the Skarpnäck line's, from the flyover east of Skärmarbrink to the viaduct at Bagarmossen
  // (src/detail/skarpnack-line.ts), each abutment to abutment, with the bank beyond the ends where
  // OpenStreetMap's bridge runs on: east of Sparrmansvägen's, Ulricehamnsvägen's and Malmövägen's;
  // Kärrtorpsvägen's up to the station's ticket hall under their northern ends)
  { name: 'Skärmarbrink flyover', at: [1861.1, 4111.6], r: 28.5, solids: [], girder: true },
  { name: 'Sparrmansvägen', at: [2152.5, 4122.5], r: 23.8, solids: [], girder: true },
  { name: 'Ulricehamnsvägen', at: [2726.3, 4086.1], r: 42.5, solids: [], girder: true },
  { name: 'Malmövägen', at: [3168.3, 4291.4], r: 71.8, solids: [], girder: true },
  { name: 'Halmstadsvägen', at: [3220.1, 4607.5], r: 24, solids: [], girder: true },
  { name: 'Ystadsvägen', at: [3187.2, 4814.1], r: 70.5, solids: [], girder: true },
  { name: 'Kärrtorpsvägen', at: [3192.9, 5334.3], r: 51.2, solids: [], girder: true },
  { name: 'Bagarmossen', at: [3444.4, 5702.5], r: 48.0, solids: [], girder: true },
];

// whether the network leaves the viaduct at (x, z) to a landmark
export const viaductInDetail = (x: number, z: number) => DETAIL_ON && DETAILED_VIADUCTS.some((v) => Math.hypot(x - v.at[0], z - v.at[1]) < v.r);
// whether it leaves the girder under the deck at (x, z) to a landmark too
export const girderInDetail = (x: number, z: number) => DETAIL_ON && DETAILED_VIADUCTS.some((v) => v.girder && Math.hypot(x - v.at[0], z - v.at[1]) < v.r);
// what stands on their platforms
export const viaductSolids = (): Volume[] => (DETAIL_ON ? DETAILED_VIADUCTS.flatMap((v) => v.solids) : []);
