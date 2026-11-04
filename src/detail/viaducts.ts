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
// (src/detail/farsta-line-north.ts) and on the Hagsätra line (src/detail/hagsatra-line.ts) and the
// Skarpnäck line (src/detail/skarpnack-line.ts), and Skanstullsbron (src/detail/skanstull.ts), and
// Tranebergsbron and the bridges west of it to Islandstorget (src/detail/vasterort.ts) and on to
// Johannelund (src/detail/hasselby-line.ts), and the blue line's over Igelbäcken and either side of
// Kista (src/detail/akalla-line.ts). Within `r` metres of `at` the network (src/network.ts)
// leaves out its own piers, the railings along its decks and the lamps over its platforms, and keeps
// the player off its platforms where the `solids` stand on them; where `girder`, it leaves out its
// decks' girders too, which the landmark draws in their real shape; and it cuts the `cuts` out of
// what it draws there.
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

// S:t Eriksbron's frame (src/detail/sankt-eriksbron.ts): s along it north-north-eastwards from the
// middle of its deck, u to the right; its trough's middle, and the rails' top along it
const SE = { x: -1380.44, z: -650.8, tx: 0.3826, tz: -0.92391, mid: 0.1, rail: (s: number) => 10.732 + 0.001177 * s };
const seWorld = (s: number, u: number): [number, number] => [SE.x + SE.tx * s - SE.tz * u, SE.z + SE.tz * s + SE.tx * u];
// the room outside its trough's sides from one abutment's face to the other, low down, where the
// network's ballast would stick out through them: the trough holds its tracks 3.2 m apart in 6.8 m
const seBeside = (side: -1 | 1): Volume => {
  const [s0, s1] = [-76.8, 74.1], [u0, u1] = side < 0 ? [SE.mid - 4.6, SE.mid - 3.43] : [SE.mid + 3.43, SE.mid + 4.6];
  const corners: [number, number][] = [[s0, u0], [s1, u0], [s1, u1], [s0, u1]];
  return prism(corners.map(([s, u]) => seWorld(s, u)), corners.map(([s]) => SE.rail(s) - 0.75), corners.map(([s]) => SE.rail(s) - 0.1));
};

export const DETAILED_VIADUCTS: { name: string; at: [number, number]; r: number; solids: Volume[]; girder?: boolean; cuts?: Volume[] }[] = [
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
  // (Skanstullsbron (src/detail/skanstull.ts), from the bank OpenStreetMap's bridge runs on over at
  // Gullmarsplan, short of its platforms, to the northern abutment: 100 m south of its southern end
  // to 184 m north of it, on to 420 m, and on to 555 m)
  { name: 'Skanstullsbron south', at: [1177.5, 3314.3], r: 142, solids: [], girder: true },
  { name: 'Skanstullsbron', at: [1105.5, 3066.5], r: 120, solids: [], girder: true },
  { name: 'Skanstullsbron north', at: [1049.0, 2888.2], r: 68, solids: [], girder: true },
  // (Tranebergsbron (src/detail/vasterort.ts), from where the network's tracks become a bridge at
  // Kristineberg's end to where they leave it at Traneberg's: 10 m east of the southern track's
  // bridge's eastern end to 140 m west of it, on to 330 m, and on to 471 m)
  { name: 'Tranebergsbron east', at: [-3477.4, -223.4], r: 76, solids: [], girder: true },
  { name: 'Tranebergsbron', at: [-3646.5, -246.6], r: 95, solids: [], girder: true },
  { name: 'Tranebergsbron west', at: [-3813.0, -252.9], r: 72, solids: [], girder: true },
  // (the bridges west of it (src/detail/vasterort.ts): Tranebergsslingan's, the flyover west of Alvik,
  // Drottningholmsvägen's and Stora Mossens backe's)
  { name: 'Tranebergsslingan', at: [-3933.0, -227.9], r: 27, solids: [], girder: true },
  { name: 'Alvik flyover', at: [-4730.7, -283.4], r: 34, solids: [], girder: true },
  { name: 'Drottningholmsvägen', at: [-4831.3, -223.2], r: 34, solids: [], girder: true },
  { name: 'Stora Mossens backe', at: [-5202.4, -311.1], r: 17, solids: [], girder: true },
  // (and on west to Islandstorget: Abrahamsbergsvägen's, Brommaplan's viaduct from the station's decks
  // to its western end, Åkeshovsvägen's and the path's underpass east of Ängbyplan, each end to end)
  { name: 'Abrahamsbergsvägen', at: [-6070.4, -572.8], r: 17, solids: [], girder: true },
  { name: 'Brommaplan viaduct', at: [-6936.4, -814.8], r: 64.5, solids: [], girder: true },
  { name: 'Åkeshovsvägen', at: [-7393.9, -1083.9], r: 15.5, solids: [], girder: true },
  { name: 'Ängby underpass', at: [-8025.2, -1183.1], r: 8, solids: [], girder: true },
  // (and from Blackeberg to Johannelund (src/detail/hasselby-line.ts): Björnsonsgatan's, the arches
  // over Kanaans väg and Grimstagatan, Bergslagsvägen's at Råcksta, the depot's flyover, Abiskovägen's,
  // Bergslagsvägen's viaduct and Lövstavägen's, each end to end and 5 m on: the network's deck runs
// on half way to the line's next point)
  { name: 'Björnsonsgatan', at: [-10102.6, -1988.2], r: 23.4, solids: [], girder: true },
  { name: 'Råcksta arches', at: [-10130.6, -2246.8], r: 91.3, solids: [], girder: true },
  { name: 'Bergslagsvägen at Råcksta', at: [-10093.0, -2457.1], r: 33.7, solids: [], girder: true },
  { name: 'Depot flyover', at: [-10403.2, -3290.4], r: 36.6, solids: [], girder: true },
  { name: 'Abiskovägen', at: [-11041.1, -3936.0], r: 18.2, solids: [], girder: true },
  { name: 'Bergslagsvägen viaduct', at: [-11305.0, -4041.7], r: 87.9, solids: [], girder: true },
  { name: 'Lövstavägen viaduct', at: [-11590.1, -4071.6], r: 58.3, solids: [], girder: true },
  // (the blue line's bridges over Igelbäcken and Kista's viaduct either side of the station
  // (src/detail/akalla-line.ts): each holding the network's deck where the landmark's decks are, and
  // none of it beyond them)
  { name: 'Igelbäcken', at: [-5203.0, -6819.4], r: 191, solids: [], girder: true },
  { name: 'Kista viaduct 1', at: [-6116.3, -7590.5], r: 129.4, solids: [], girder: true },
  { name: 'Kista viaduct 2', at: [-6330.1, -7664.7], r: 108.8, solids: [], girder: true },
  { name: 'Kista viaduct 3', at: [-6505.7, -7772.9], r: 113.5, solids: [], girder: true },
  { name: 'Kista viaduct 4', at: [-6762.1, -8139.4], r: 123, solids: [], girder: true },
  // (S:t Eriksbron between Fridhemsplan and S:t Eriksplan, its tracks in the trough under the road
  // from one abutment to the other, 77.6 m south and 74.1 m north of its middle)
  { name: 'S:t Eriksbron', at: seWorld(-1.75, SE.mid), r: 80, solids: [], girder: true, cuts: [seBeside(-1), seBeside(1)] },
];

// Tunnel mouths drawn in detail near the camera: Kymlinge's, one flat roof over both tracks and the
// platform between them (src/detail/akalla-line.ts). Within `r` metres of `at` the network leaves
// out the headwalls round its tunnels' mouths.
export const DETAILED_PORTALS: { name: string; at: [number, number]; r: number }[] = [
  // (both tracks' mouths, 118 m north-west of the western deck's end over Igelbäcken)
  { name: 'Kymlinge', at: [-5363.1, -7082.7], r: 9 },
  // (S:t Eriksbron's abutments, the trough's openings in their faces)
  { name: 'S:t Eriksbron south', at: seWorld(-77.6, SE.mid), r: 8 },
  { name: 'S:t Eriksbron north', at: seWorld(74.1, SE.mid), r: 8 },
  // (the box's mouth at the east end of Drottningholmsvägen's trench, under Lindhagensplan, src/detail/vasterort.ts)
  { name: 'Lindhagensplan', at: [-2216.2, -19.3], r: 6 },
];
export const portalInDetail = (x: number, z: number) => DETAIL_ON && DETAILED_PORTALS.some((p) => Math.hypot(x - p.at[0], z - p.at[1]) < p.r);

// whether the network leaves the viaduct at (x, z) to a landmark
export const viaductInDetail = (x: number, z: number) => DETAIL_ON && DETAILED_VIADUCTS.some((v) => Math.hypot(x - v.at[0], z - v.at[1]) < v.r);
// whether it leaves the girder under the deck at (x, z) to a landmark too
export const girderInDetail = (x: number, z: number) => DETAIL_ON && DETAILED_VIADUCTS.some((v) => v.girder && Math.hypot(x - v.at[0], z - v.at[1]) < v.r);
// what stands on their platforms
export const viaductSolids = (): Volume[] => (DETAIL_ON ? DETAILED_VIADUCTS.flatMap((v) => v.solids) : []);
// and what the network cuts out of what it draws there, where the landmark's structure is tighter
// round the tracks than the network's own (S:t Eriksbron's trough)
export const viaductCuts = (): Volume[] => (DETAIL_ON ? DETAILED_VIADUCTS.flatMap((v) => v.cuts ?? []) : []);
