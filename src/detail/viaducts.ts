import { prism } from '../clip.ts';
import type { Volume } from '../clip.ts';
import { DETAIL_ON } from './areas.ts';

// The metro's viaducts drawn in detail near the camera, with the station on them: Ropsten's
// (src/detail/ropsten-station.ts), and Brommaplan's two decks over the square and its ticket
// hall, whose round piers and railings the station's style draws (src/open-styles.ts). Within
// `r` metres of `at` the network (src/network.ts) leaves out its own piers, the railings along
// its decks and the lamps over its platforms, and keeps the player off its platforms where the
// `solids` stand on them. Like src/detail/areas.ts it imports next to nothing, for the network.

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

export const DETAILED_VIADUCTS: { name: string; at: [number, number]; r: number; solids: Volume[] }[] = [
  { name: 'Ropsten', at: ropstenWorld(12, 0), r: 105, solids: [box(SNAKE_WALL.s0, SNAKE_WALL.s1, SNAKE_WALL.u0, SNAKE_WALL.u1, ROPSTEN.platform - 0.5, ROPSTEN.platform + 3)] },
  // (from 151 m to 79 m west of Brommaplan's platform's middle)
  { name: 'Brommaplan', at: [-6850.0, -769.5], r: 36, solids: [] },
];

// whether the network leaves the viaduct at (x, z) to a landmark
export const viaductInDetail = (x: number, z: number) => DETAIL_ON && DETAILED_VIADUCTS.some((v) => Math.hypot(x - v.at[0], z - v.at[1]) < v.r);
// what stands on their platforms
export const viaductSolids = (): Volume[] => (DETAIL_ON ? DETAILED_VIADUCTS.flatMap((v) => v.solids) : []);
