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
  // the art on the platform: sculptures, and panels hung between the roof's columns
  art?: Art[];
  // fences along the tracks, beyond them
  fences?: Fence[];
  // benches down the middle of the platform at these `s`: along it, or across it, against the
  // panel between a pair of columns
  benches?: { at: number[]; across?: boolean };
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
  rafterSize?: [number, number]; // across and deep (0.05 by 0.1 by default)
  // columns `every` m, one of them at `at`; or pairs of them across the platform, `pair` apart,
  // each under a beam of its own
  columns: { every: number; at: number; size: number; plinth: { size: number; height: number }; pair?: number };
  // rows of strip lights along the underside, `offset` either side of the beam: fittings
  // `length` long, `every` apart
  lamps: { offset: number; length: number; every: number };
  colors: { underside: number; fascia: number; top: number; steel: number };
  // name signs hung under the beam at these `s`, with the way out at each end of the platform
  signs: { at: number[]; back: string; ahead: string };
}

// The platform's top, across from its edge: a pale band of edge stones, a strip of ribbed or
// studded tiles for the blind (`tactile`, from and to), pale slabs out to `slabs` (30 cm square,
// or `slabSize` across and along), then pavers.
export interface Paving {
  edge: number;
  tactile: [number, number];
  studs?: boolean;
  slabs: number;
  slabSize?: [number, number];
  colors: { edge: number; tactile: number; slab: number; pavers: number; face: number };
  // herringbone pavers, rectangular ones in a running bond, or small setts laid in fans
  pattern: 'herringbone' | 'bond' | 'fans';
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
  | 'slats'         // a white slatted ceiling
  | 'whiteTiles'    // small square tiles, white, with a band of black and yellow lozenges
  | 'terrazzo'      // pale grey terrazzo in large squares
  | 'whitePanels';  // white sheet-metal panels

// A building's shell round the quadrilateral `plan` ([s, u], in order round it): its walls from
// `from` (the platform's level by default) up to `h[1]` (concrete below, down to `h[0]`), a roof
// this thick, and a floor at `from` wherever the station's own floors leave it open. The
// station's parts open through it. `sides` gives a side (from corner i to the next) a finish of
// its own, or none (null); `ceiling`, the underside of its roof a finish; `band`, the walls a
// finish of their own all round from a height up; `lights`, lit yellow signs on a side, `at` the
// way along it (0 to 1) and `length` long.
export interface Block {
  name: string; plan: [number, number][]; h: [number, number]; from?: number;
  walls: Finish; sides?: (Finish | null | undefined)[]; band?: { walls: Finish; from: number };
  floor?: Finish; ceiling?: Finish; roof?: number; lights?: { side: number; at: number; length: number }[];
}

export type Art = Guardian | Stacks | Panels;

// A tall, thin bronze figure on a dark stone plinth, at s, u, facing `turn` (radians from
// looking along the platform, to the right), beside a dark casing round the column at the same
// `s`, `size` across and along.
export interface Guardian { kind: 'guardian'; s: number; u: number; turn: number; height: number; casing: [number, number] }

// Two tall bronze columns of slabs stacked slightly askew, so that each has a sawtooth edge on
// its outer side, side by side on a low stone base at s, u, `turn` as a guardian's.
export interface Stacks { kind: 'stacks'; s: number; u: number; turn: number; height: number }

// Lacquered panels in two colours, left and right, hung between each pair of the roof's
// columns from `bottom` to `top`, the colours in turn along the platform from its back end.
export interface Panels { kind: 'panels'; colors: [number, number][]; bottom: number; top: number }

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
      { name: 'south hall', plan: [[-74.5, -3.27], [-85, -3.13], [-85, 1.47], [-74.5, 1.68]], h: [-1.6, 3.9], walls: 'clerestory', floor: 'darkStone', roof: 0.35 },
      { name: 'south hall, over the stairs', plan: [[-85, -3.13], [-101.3, -2.88], [-101.3, 0.82], [-85, 1.47]], h: [-1.6, 3.9], walls: 'clerestory', roof: 0.35 },
      { name: 'stair house', plan: [[76.5, -1.74], [85, -1.77], [85, 3.73], [76.5, 3.76]], h: [-1.6, 8.4], walls: 'glazed', floor: 'darkStone', roof: 0.35 },
      { name: "lift's tower", plan: [[80.5, 2.45], [83.5, 2.44], [83.5, 3.64], [80.5, 3.65]], h: [-1.6, 9.6], walls: 'glazed', roof: 0.3 },
    ],
    buildings: ['w145308486', 'w1147168631'],
    art: [
      { kind: 'guardian', s: 27.5, u: 0.86, turn: Math.PI, height: 2.3, casing: [0.6, 1.0] },
      { kind: 'guardian', s: -27.5, u: -0.86, turn: 0, height: 2.2, casing: [0.6, 1.0] },
    ],
    // 2.6 m beyond each track, which lies 5.2 m west of the platform's middle at its south end
    // and 3.4 m at its north end, and 3.6 m to 5.7 m east
    fences: [
      { points: [[-76, -7.6], [0, -7.7], [31.5, -7.37], [71.3, -6.46], [78, -6.22]], h: [-1.6, 0.5] },
      { points: [[-76, 6.44], [-51, 7.45], [-12, 7.68], [27.5, 7.8], [66.6, 8.04], [78, 8.02]], h: [-1.6, 0.5] },
    ],
    benches: { at: [-55, -33, -11, 11, 33, 55] },
  },

  // Hökarängen (1950, Peter Celsing): an island platform out in the open on a long curve, between
  // Lingvägen's tower blocks to the east and the centre to the west, the end of the first line
  // until 1958. The laser scan puts its butterfly roof from 80 m south of the platform's middle to
  // 77 m north, about 8.8 m wide, its top 3.76 m over the platform along the valley and 4.08 m at
  // the edges. Photographs show it boarded white underneath on deep white rafters, its edges
  // pale grey, on pairs of black steel columns across the platform, each pair under two black
  // beams along it; strip lights between the rafters, and black name signs with the ways out,
  // Russinvägen to the south and Örbyleden to the north.
  //
  // Hanns Karlewski's art (1995): lacquered panels in two colours (yellow and navy, blue and
  // orange, red and turquoise, ...) hung between the columns of each pair, with benches of dark
  // planks on concrete blocks against some of them; two tall bronze columns of slabs stacked
  // askew, each with a sawtooth outer edge, side by side in the southern half; and the floor down
  // the middle of the platform, between the columns, in small dark setts laid in fans, the pale
  // slabs either side of it, a studded strip for the blind and pale edge stones.
  //
  // At its south end, on the tracks' bridge over a footpath (OpenStreetMap's outline, from 79 m to
  // 92 m south of the middle), a glass hall with the ticket gates and a flat roof, 3.4 m high by
  // the laser scan; stairs down from it, lined in white tiles with a band of black and yellow
  // lozenges, to the white-tiled passage under the tracks, 4.1 m below the platform, with a way
  // out to each side. At its north end the platform runs on, narrowing between the tracks, into a
  // glass stair house under a lower flat roof (laser scan: 78 m to 96 m north), with an escalator
  // and stairs down to the ticket hall under the tracks' bridge over Örbyleden (OpenStreetMap's
  // indoor mapping), its floor 5.3 m below the platform: terrazzo, white tiles, the gates and a
  // glazed front towards the road.
  //
  // Chain-link fences beyond both tracks, as along the rest of the line.
  'Hökarängen': {
    roof: {
      kind: 'butterfly',
      from: -80, to: 77, width: 8.8,
      middle: 3.56, edge: 3.88, thick: 0.2, fascia: 0.32,
      rafters: 1.8, rafterSize: [0.09, 0.2],
      beam: 0.32,
      columns: { every: 10, at: 5, size: 0.2, plinth: { size: 0.3, height: 0.08 }, pair: 1.4 },
      lamps: { offset: 2.4, length: 1.2, every: 3 },
      colors: { underside: 0xf2f2ee, fascia: 0xc9cac6, top: 0x55595d, steel: 0x2f3235 },
      signs: { at: [-50, 0, 50], back: 'Russinvägen', ahead: 'Örbyleden' },
    },
    paving: {
      edge: 0.3, tactile: [0.55, 1.0], studs: true, slabs: 2.85, slabSize: [0.5, 0.35],
      colors: { edge: 0xc6c4bd, tactile: 0x95938e, slab: 0xaaa8a2, pavers: 0x6c6a67, face: 0xa9a6a0 },
      pattern: 'fans',
    },
    rooms: [
      // (the halls at platform level are their buildings' shells, the floors in them open)
      { name: "platform's south end", s: [-79.2, -74], h: [-0.5, 2], walls: null, floor: 'pavers' },
      { name: "platform's north end", s: [74, 79.6], h: [-0.5, 2], walls: null, floor: 'pavers' },
      { name: 'south hall', s: [-93, -79.2], h: [-0.5, 2], walls: null, floor: 'terrazzo', stairs: 'whiteTiles' },
      { name: 'passage under the tracks', s: [-101, -89], h: [-5, -3], walls: 'whiteTiles', floor: 'pavers', ceiling: 'whitePanels', stairs: 'whiteTiles' },
      { name: 'stair house', s: [79.6, 97], h: [-0.5, 2], walls: null, floor: 'terrazzo' },
      { name: 'ticket hall', s: [96, 116], h: [-6.5, -4], walls: 'whiteTiles', floor: 'terrazzo', ceiling: 'whitePanels', stairs: 'whiteTiles' },
    ],
    // (between the tracks, which close in on the platform towards its south end and part beyond
    // its north end)
    blocks: [
      { name: 'south hall', plan: [[-79, 4.28], [-92.5, 7.05], [-92.5, 11.45], [-79, 10.98]], h: [-1.6, 3.1], walls: 'glazed', floor: 'terrazzo', ceiling: 'slats', roof: 0.3 },
      { name: 'stair house', plan: [[79.5, 3.61], [97, 7.33], [97, 12.73], [79.5, 10.01]], h: [-1.6, 3.1], walls: 'glazed', floor: 'terrazzo', ceiling: 'slats', roof: 0.3 },
      // (where the passage runs under the tracks' bridge the ground beside it is as low as its
      // floor: its walls, concrete outside)
      { name: 'passage under the tracks', plan: [[-99.1, 0.5], [-93, 0.5], [-93, 11.3], [-99.1, 11.3]], h: [-4.1, -1.9], from: -4.1, walls: 'boardConcrete', roof: 0.3 },
      // (under the tracks, below their trains)
      { name: 'ticket hall', plan: [[95, 6.3], [110.4, 9.25], [109.05, 16.3], [93.6, 13.4]], h: [-5.4, -2.1], from: -5.4, walls: 'darkStone', sides: [undefined, 'glazed'], band: { walls: 'whitePanels', from: -3.2 }, roof: 0.25,
        lights: [{ side: 0, at: 0.62, length: 2.6 }, { side: 1, at: 0.2, length: 1.2 }] },
    ],
    buildings: ['w114720155', 'w114720154'],
    art: [
      {
        kind: 'panels', bottom: 0.95, top: 3.0,
        colors: [
          [0xf1b70f, 0x1e2a6c], [0x1f86c6, 0xf07a12], [0xf0a01c, 0x5b409c], [0xe63b20, 0x1fb2a4],
          [0x24a7cb, 0x3a9f4b], [0xf07a12, 0x2b63c4], [0x1fb2a4, 0x1e2a6c], [0xe8c21a, 0xd23b2b],
        ],
      },
      { kind: 'stacks', s: -30, u: 0.15, turn: 0.35, height: 2.6 },
    ],
    // 2.6 m beyond each track
    fences: [
      { points: [[-80, -0.01], [-60, -3.41], [-40, -6.11], [-20, -7.8], [0, -8.4], [20, -8], [40, -6.59], [60, -4.09], [80, -0.69], [86, 0.48]], h: [-1, 1] },
      { points: [[-80, 15.39], [-60, 12.59], [-40, 10.29], [-20, 8.9], [0, 8.4], [20, 8.8], [40, 10.01], [60, 11.81], [80, 14.31], [86, 15.28]], h: [-1, 1] },
    ],
    benches: { at: [-65, -45, -15, 15, 45, 65], across: true },
  },
};
