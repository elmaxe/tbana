// The stations out in the open in their own style, rather than as a plain platform under a flat
// roof: the roof over the platform and what stands under it, the platform's paving, and what
// the station's halls, passages and stairs (src/stations.ts) are finished in, each researched
// from photographs of the station, Lantmäteriet's laser scan and Google's 3D mesh of it.
//
// Positions are in the station's frame, as the routes in data/station-descriptions.json are: `s`
// metres along the platform from its middle, the way the station faces (its layout's yaw), and
// `u` metres to the right of that; heights are above the top of the platform. The roof and what
// stands under it (`u` across from the line down the middle of the platform) follow that line,
// so they bend with the track.

export interface OpenStyle {
  roof: ButterflyRoof;
  paving: Paving;
  // the finishes of the station's halls, passages and stairs: each part takes the first room
  // whose box holds the middle of its floor
  rooms: Room[];
  // the shells of buildings the station's parts run through: a hall, a stair house
  blocks?: Block[];
  // OpenStreetMap's outlines of the buildings it draws itself, which the city leaves out
  // (tools/build-city.ts)
  buildings?: string[];
  // sculptures standing on the platform, each beside a casing round one of the roof's columns
  art?: Sculpture[];
  // fences along the tracks, beyond them
  fences?: Fence[];
  // benches down the middle of the platform, at these `s`
  benches?: number[];
}

// A roof whose two halves slope down to a valley along its middle, held up by a row of columns
// down the middle of the platform under a beam along the valley.
export interface ButterflyRoof {
  kind: 'butterfly';
  from: number; to: number;    // along the platform
  width: number;
  // the underside's height at the middle and at the edges, the roof's thickness, and how deep
  // its fascia is at the edges
  middle: number; edge: number;
  thick: number; fascia: number;
  rafters: number;             // between the rafters across the underside
  beam: number;                // the beam's depth under the valley
  // columns `every` m, one of them at `at`
  columns: { every: number; at: number; size: number; plinth: { size: number; height: number } };
  // rows of strip lights along the underside, `offset` either side of the beam: fittings
  // `length` long, `every` apart
  lamps: { offset: number; length: number; every: number };
  colors: { underside: number; fascia: number; top: number; steel: number };
  // name signs hung under the beam at these `s`, with the way out at each end of the platform
  signs: { at: number[]; back: string; ahead: string };
}

// The platform's top, across from its edge: a pale band of edge stones, a strip of ribbed tiles
// for the blind (`tactile`, from and to), pale slabs out to `slabs`, then pavers.
export interface Paving {
  edge: number;
  tactile: [number, number];
  slabs: number;
  colors: { edge: number; tactile: number; slab: number; pavers: number; face: number };
  // herringbone pavers, or rectangular ones in a running bond
  pattern: 'herringbone' | 'bond';
}

// The finishes in a box: from `s[0]` to `s[1]` along, across `u` (all of it by default), and
// from `h[0]` to `h[1]` high; `stairs` for the walls beside stairs and escalators, and no walls
// at all (`walls: null`) where its floors are the platform's ends, out under the roof. `roof`
// puts a roof this thick on its ceilings; `slab` a slab this thick under its floors, where they
// stand on a bridge.
export interface Room {
  name: string;
  s: [number, number]; u?: [number, number]; h: [number, number];
  walls?: Finish | null; floor?: Finish; ceiling?: Finish; stairs?: Finish;
  roof?: number; slab?: number;
}

export type Finish =
  | 'clerestory'    // pale grey panels, and above them a band of windows in yellow frames
  | 'windows'       // pale grey panels to sill height, windows in yellow frames above
  | 'glazed'        // glazed from floor to ceiling in grey steel frames
  | 'yellowTiles'   // small square tiles, a warm yellow
  | 'boardConcrete' // concrete cast against boards
  | 'darkStone'     // dark grey stone slabs
  | 'pavers'        // grey concrete pavers
  | 'triangles'     // black and white terrazzo in triangles
  | 'slats';        // a white slatted ceiling

// A building's shell round the quadrilateral `plan` ([s, u], in order round it): its walls from
// the platform's level up to `h[1]` (concrete below, down to `h[0]`), a roof this thick, and a
// floor at the platform's level wherever the station's own floors leave it open. The station's
// parts open through it.
export interface Block { name: string; plan: [number, number][]; h: [number, number]; walls: Finish; floor?: Finish; roof?: number }

// A tall, thin bronze figure on a dark stone plinth, at s, u, facing `turn` (radians from
// looking along the platform, to the right), beside a dark casing round the column at the same
// `s`, `size` across and along.
export interface Sculpture { kind: 'guardian'; s: number; u: number; turn: number; height: number; casing: [number, number] }

// A chain-link fence on posts through the points ([s, u]), from `h[0]` to `h[1]` high.
export interface Fence { points: [number, number][]; h: [number, number] }

// Gubbängen (1950): an island platform on a low bank on the hillside, along Lingvägen, under a
// long butterfly roof. Since its renewal the roof's underside is white boarding on white rafters,
// with a dark grey fascia and covering, on dark grey steel columns down the middle on concrete
// plinths, about 11 m apart, under a dark beam along the valley; rows of strip lights either side
// of the beam, and black name signs hung under it with the ways out, Gubbängstorget to the south
// and Herrhagsvägen to the north. The paving: pale edge stones, a ribbed strip for the blind,
// then grey concrete pavers. The laser scan puts the roof from 74.5 m south of the platform's
// middle to 76.5 m north, about 8 m wide, its underside 3.05 m over the platform at the valley
// and 3.45 m at the edges.
//
// At its south end a hall at platform level with the ticket gates, its walls pale grey panels
// under a band of windows in yellow frames and a white slatted ceiling, and on in the same
// building over the stairs down to a passage under the tracks (OpenStreetMap's outline, from
// 85 m to 101 m south of the platform's middle), lined in small yellow tiles, its portals
// concrete cast against boards. At its north end a glass stair house of two storeys, grey-framed, with a lift's tower
// beside it; an escalator and stairs up to the ticket hall on its bridge over the tracks, which
// has a floor of black and white terrazzo in triangles, windows in yellow frames over grey
// panels and a white slatted ceiling, and opens onto Herrhagsvägen to the east.
//
// Ragnhild Alexandersson's Väktare (1994): two tall bronze figures, each on a black granite
// plinth beside a dark casing round one of the roof's columns. Photographs show one in the
// northern half of the platform, by the eastern track; where the other stands isn't known, so
// it is placed as far into the southern half, by the western track.
//
// Chain-link fences on galvanised posts run beyond both tracks, with the wooded slope behind the
// eastern one and the yellow houses of Lingvägen beyond the western.
export const OPEN_STYLES: Record<string, OpenStyle> = {
  'Gubbängen': {
    roof: {
      kind: 'butterfly',
      from: -74.5, to: 76.5, width: 8,
      middle: 3.05, edge: 3.45, thick: 0.25, fascia: 0.4,
      rafters: 2.2,
      beam: 0.4,
      columns: { every: 11, at: 5.5, size: 0.22, plinth: { size: 0.5, height: 0.35 } },
      lamps: { offset: 1.5, length: 1.5, every: 3.6 },
      colors: { underside: 0xf0f0ec, fascia: 0x45494d, top: 0x5a5e62, steel: 0x3e4246 },
      signs: { at: [-44, 0, 44], back: 'Gubbängstorget', ahead: 'Herrhagsvägen' },
    },
    paving: {
      edge: 0.3, tactile: [0.3, 0.9], slabs: 0.9,
      colors: { edge: 0xc4c2bc, tactile: 0x7d7b77, slab: 0xb9b5ad, pavers: 0x948e85, face: 0x3e4145 },
      pattern: 'bond',
    },
    rooms: [
      // (the roof reaches 2 m beyond the platform's south end and 4 m beyond its north end)
      { name: "platform's south end", s: [-74.4, -71], h: [-0.5, 2], walls: null, floor: 'pavers' },
      { name: "platform's north end", s: [71, 76.4], h: [-0.5, 2], walls: null, floor: 'pavers' },
      { name: 'south hall', s: [-86, -70], h: [-0.5, 2], walls: 'clerestory', floor: 'darkStone', ceiling: 'slats' },
      { name: 'passage under the tracks', s: [-112, -84], h: [-6, -0.5], walls: 'yellowTiles', floor: 'pavers', ceiling: 'boardConcrete', stairs: 'boardConcrete' },
      { name: 'stair house', s: [70, 86], h: [-0.5, 2], walls: 'glazed', floor: 'darkStone', ceiling: 'slats', stairs: 'glazed' },
      { name: 'ticket hall', s: [84, 120], h: [3, 7], walls: 'windows', floor: 'triangles', ceiling: 'slats', roof: 0.4, slab: 0.7 },
    ],
    // (between the tracks, which close in on the platform towards its ends: the south hall's
    // walls follow OpenStreetMap's outline of it)
    blocks: [
      { name: 'south hall', plan: [[-74.5, -3.5], [-85, -3.4], [-85, 1.2], [-74.5, 1.45]], h: [-1.6, 3.9], walls: 'clerestory', floor: 'darkStone', roof: 0.35 },
      { name: 'south hall, over the stairs', plan: [[-85, -3.4], [-101.3, -3.2], [-101.3, 0.5], [-85, 1.2]], h: [-1.6, 3.9], walls: 'clerestory', roof: 0.35 },
      { name: 'stair house', plan: [[76.5, -1.5], [85, -1.5], [85, 4], [76.5, 4]], h: [-1.6, 8.4], walls: 'glazed', floor: 'darkStone', roof: 0.35 },
      { name: "lift's tower", plan: [[80.5, 2.7], [83.5, 2.7], [83.5, 3.9], [80.5, 3.9]], h: [-1.6, 9.6], walls: 'glazed', roof: 0.3 },
    ],
    buildings: ['w145308486', 'w1147168631'],
    art: [
      { kind: 'guardian', s: 27.5, u: 0.95, turn: Math.PI, height: 2.3, casing: [0.6, 1.0] },
      { kind: 'guardian', s: -27.5, u: -0.95, turn: 0, height: 2.2, casing: [0.6, 1.0] },
    ],
    // 2.6 m beyond each track, which lies 5.2 m west of the platform's middle at its south end
    // and 3.4 m at its north end, and 3.6 m to 5.7 m east
    fences: [
      { points: [[-76, -7.84], [0, -7.7], [31.5, -7.27], [71.3, -6.24], [78, -5.98]], h: [-1.6, 0.5] },
      { points: [[-76, 6.2], [-51, 7.29], [-12, 7.64], [27.5, 7.89], [66.6, 8.25], [78, 8.26]], h: [-1.6, 0.5] },
    ],
    benches: [-55, -33, -11, 11, 33, 55],
  },
};
