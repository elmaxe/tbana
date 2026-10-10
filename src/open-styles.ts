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
  // panel between a pair of columns; `double`, two back to back along it
  benches?: { at: number[]; across?: boolean; double?: boolean };
  // glass shelters on the platform, from s[0] to s[1] and u[0] to u[1] across the line down its
  // middle, glazed along both sides and open at the ends, with a bench inside; out in the open,
  // a flat roof of their own
  shelters?: { s: [number, number]; u: [number, number]; roof?: boolean }[];
}

// A roof whose two halves slope down to a valley along its middle, held up by a row of columns
// down the middle of the platform under a beam along the valley.
export interface ButterflyRoof {
  kind: 'butterfly';
  from: number; to: number;    // along the platform
  width: number;
  offset?: number;             // its middle this far to the right of the platform's

  // the underside's height at the middle and at the edges, the roof's thickness, and how deep
  // its fascia is at the edges
  middle: number; edge: number;
  thick: number; fascia: number;
  rafters: number;             // between the rafters across the underside
  beam: number;                // the beam's depth under the valley
  rafterSize?: [number, number]; // across and deep (0.05 by 0.1 by default)
  // the underside boarded along the platform, or of ribbed sheet metal, the ribs along it; and
  // the rafters steel (this colour) rather than boarded
  deck?: 'boards' | 'ribbed';
  rafterColor?: number;
  // columns `every` m, one of them at `at`, only `between` these `s` if given; or pairs of them
  // across the platform, `pair` apart, each under a beam of its own; `braces`, knee braces from
  // each column up to the beam this far along it either way; `casings`, a dark box round the
  // columns at these `s`, `size` across and along; `offset`, the columns (and the beams over
  // them, and the signs) this far to the right of the roof's middle
  columns: {
    every: number; at: number; size: number; plinth: { size: number; height: number }; pair?: number;
    between?: [number, number]; braces?: number; casings?: { at: number[]; size: [number, number] }; offset?: number;
  };
  // rows of strip lights along the underside, `offset` either side of the beam (or at these `u`
  // across the roof's middle): fittings `length` long, `every` apart; `tube`, in a long round
  // housing hung under the rafters
  lamps: { offset: number; length: number; every: number; at?: number[]; tube?: boolean };
  colors: { underside: number; fascia: number; top: number; steel: number };
  // name signs hung under the beam at these `s`, with the way out at each end of the platform
  // (none if empty); or, between a pair of beams, from the rafters, `bottom` over the platform
  signs: { at: number[]; back: string; ahead: string; bottom?: number };
  // round clocks with a face each way along the platform, and departure boards, hung from the
  // roof at s, u
  clocks?: [number, number][];
  boards?: { s: number; u: number; toward: string; trains: [string, string] }[];
}

// The platform's top, across from its edge: a pale band of edge stones, a strip of ribbed or
// studded tiles for the blind (`tactile`, from and to), pale slabs out to `slabs` (30 cm square,
// or `slabSize` across and along), then pavers (24 by 12 cm, or `paverSize` along and across;
// `mix` of them in the colour `paler`, at random).
export interface Paving {
  edge: number;
  tactile: [number, number];
  studs?: boolean;
  slabs: number;
  slabSize?: [number, number];
  paverSize?: [number, number];
  mix?: number;
  colors: { edge: number; tactile: number; slab: number; pavers: number; face: number; paler?: number };
  // herringbone pavers, rectangular ones in a running bond, or small setts laid in fans
  pattern: 'herringbone' | 'bond' | 'fans';
}

// The finishes in a box: from `s[0]` to `s[1]` along, across `u` (all of it by default), and
// from `h[0]` to `h[1]` high; `stairs` for the walls beside stairs and escalators, and no walls
// at all (`walls: null`) where its floors are the platform's ends, out under the roof. `roof`
// puts a roof this thick on its ceilings; `slab` a slab this thick under its floors, where they
// stand on a bridge.
//
// `sill`: in a glass building (a block's), the walls beside its floors and stairs rise only to
// this height, the building's glass above them, and its stairs have no ceiling of their own.
export interface Room {
  name: string;
  s: [number, number]; u?: [number, number]; h: [number, number];
  walls?: Finish | null; floor?: Finish; ceiling?: Finish; stairs?: Finish;
  roof?: number; slab?: number; sill?: number;
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
  | 'whitePanels'   // white sheet-metal panels
  | 'greyTiles'     // grey square tiles, 30 cm
  | 'redLineTiles'  // small square tiles, white, with a thin dark red line
  | 'darkGlazed'    // glazed from floor to ceiling in tall narrow panes, framed in black
  | 'slate'         // dark blue-grey slate in long slabs
  | 'darkTiles'     // large dark grey tiles
  | 'greyPanels'    // dark grey sheet-metal panels, standing
  | 'highWindows'   // pale grey wall to 2.5 m, windows in grey steel frames above
  | 'paleGreenTiles' // small square tiles, a pale green
  | 'paleTiles'     // pale cream floor tiles, 30 cm
  | 'asphalt';      // dark grey asphalt

// A building's shell round the quadrilateral `plan` ([s, u], in order round it): its walls from
// `from` (the platform's level by default) up to `h[1]` (concrete below, down to `h[0]`), a roof
// this thick, and a floor at `from` wherever the station's own floors leave it open. The
// station's parts open through it. `low`: its top falls from `h[1]` at its first and last corners
// to this at the other two. `sides` gives a side (from corner i to the next) a finish of its own,
// or none (null); `ceiling`, the underside of its roof a finish; `band`, the walls a finish of
// their own all round from a height up; `lights`, lit yellow signs on a side, `at` the way along
// it (0 to 1) and `length` long. `onPlatform`: it stands on the platform, which isn't there to
// be walked on inside it (only the station's own floors are). `nameSign`: the station's name in
// white on a blue band over a side's doors, `at` the way along it, `length` long, from `bottom`
// up (on the side's inner face, `inside`). `eaves`: its roof reaches out this far past its walls,
// along each side (or all round). `ground`: it is dug into the city's ground, which isn't there
// inside it.
export interface Block {
  name: string; plan: [number, number][]; h: [number, number]; from?: number; low?: number; eaves?: number | number[]; ground?: boolean;
  walls: Finish; sides?: (Finish | null | undefined)[]; band?: { walls: Finish; from: number };
  floor?: Finish; ceiling?: Finish; roof?: number; lights?: { side: number; at: number; length: number }[];
  onPlatform?: boolean; nameSign?: { side: number; at: number; length: number; bottom: number; inside?: boolean };
}

export type Art = Guardian | Stacks | Panels | Masts | Mural | Chairs;

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

// Lamp posts at the points ([s, u], in the station's frame): a tall red-brown post with a white
// dome lamp on top and one on an arm to each side, `height` high; or a galvanised one (`color`),
// with only the two on the arm (`top: false`), and the station's name on a black sign on it
// (`sign`, so high). `arm`: the arm reaches this far each way (0.6 m by default); `lower`, a
// second, shorter arm with two small lamps, so high.
export interface Masts { kind: 'masts'; at: [number, number][]; height: number; color?: number; top?: boolean; sign?: number; arm?: number; lower?: number }

// A picture on a wall, facing `turn` as a guardian does, its middle at s, u, from `bottom` to
// `top` and `width` across; drawn in code (src/textures.ts).
export interface Mural { kind: 'mural'; picture: 'tallkrogsdraken'; s: number; u: number; turn: number; bottom: number; top: number; width: number }

// Two big armchairs and a low table between them, each built up of thick timbers, at s, u, the
// chairs facing each other across the table along `turn` (as a guardian's).
export interface Chairs { kind: 'chairs'; s: number; u: number; turn: number }

// A fence through the points ([s, u]), from `h[0]` to `h[1]` high: chain-link on posts; or
// boards, standing side by side (`color`), or slanting between concrete posts (`louvres`).
export interface Fence { points: [number, number][]; h: [number, number]; kind?: 'chainLink' | 'boards' | 'louvres'; color?: number }

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

  // Tallkrogen (1 October 1950, Peter Celsing): an island platform on the bank between Tallkrogen's
  // villas, its south end on the tracks' bridges over Victor Balcks väg. The laser scan puts its
  // butterfly roof from 81 m south of the platform's middle to 27 m south, about 7.2 m wide and
  // half a metre west of the platform's middle, its top 3.0 m over the platform along the valley
  // and 3.2 m at the edges (OpenStreetMap's outline of it agrees). Photographs show it boarded
  // white underneath on white rafters, a white fascia under a dark edge, black steel columns
  // with knee braces under a black beam along the valley, strip lights, a clock at its north end
  // and the departure boards over the hall's door; double benches of black slats on steel frames;
  // grey concrete slabs, a ribbed strip for the blind and pale edge stones; and out in the open,
  // red-brown lamp posts down the middle, each with three white dome lamps (the laser scan finds
  // them 4.4 m high, every 15 m or so).
  //
  // The south half of the roof covers a narrow hall on the platform, the platform running on
  // past it on both sides (photographs; OpenStreetMap's indoor mapping puts its door 54 m south
  // of the middle, the ticket gates at 67 m and a lift at 78 m): white panels under a band of
  // windows, the roof's boarding for a ceiling, grey square tiles, a glazed front with the
  // door. Beyond it a glass stair house between the tracks (OpenStreetMap's outline; laser scan:
  // its roof falls from 2.35 m over the platform at 82 m south to 0.3 m at 102 m): stairs down
  // between walls of white tiles with a thin dark red line, the glass above them; a landing;
  // then Kristina Anshelm's Tallkrogsdraken (1998, plastic laminate: a dragon over the suburb's
  // ring of streets and red roofs) on the wall over the second flight, which goes down through
  // it to the door onto Victor Balcks väg under the tracks' bridges, 6.85 m below the platform.
  // The lift goes down to a passage under the western track out to Tallkrogsvägen ("Hiss till
  // höger runt hörnet", says the sign at the street); how that passage is finished isn't known,
  // so it is tiled as the stairs are.
  //
  // Chain-link fences beyond both tracks.
  'Tallkrogen': {
    roof: {
      kind: 'butterfly',
      from: -81.3, to: -26.6, width: 7.2, offset: -0.55,
      middle: 2.8, edge: 2.98, thick: 0.22, fascia: 0.28,
      rafters: 1.2, rafterSize: [0.07, 0.16],
      beam: 0.3,
      // (in the hall its walls carry the roof)
      columns: { every: 9, at: -31.5, size: 0.16, plinth: { size: 0.24, height: 0.06 }, between: [-53, -27], braces: 0.9 },
      lamps: { offset: 1.9, length: 1.5, every: 3 },
      colors: { underside: 0xf1f1ed, fascia: 0xe6e6e2, top: 0x34383b, steel: 0x262829 },
      signs: { at: [-48, -35], back: 'Victor Balcks väg', ahead: '' },
      clocks: [[-27.6, 1.5]],
      boards: [
        { s: -53.3, u: 1.4, toward: 'Farsta strand', trains: ['18 Farsta strand  4 min', '18 Farsta strand  14 min'] },
        { s: -53.3, u: -1.4, toward: 'T-Centralen', trains: ['18 Alvik  7 min', '18 Alvik  17 min'] },
      ],
    },
    paving: {
      edge: 0.3, tactile: [0.55, 0.95], slabs: 5, slabSize: [0.5, 0.35],
      colors: { edge: 0xc8c6c0, tactile: 0x74726d, slab: 0x86837d, pavers: 0x86837d, face: 0x9c9993 },
      pattern: 'bond',
    },
    rooms: [
      // (the hall's floors are open to the roof over them; the walls round them are its block's)
      { name: 'hall', s: [-81.5, -53.4], h: [-0.5, 2], walls: null, floor: 'greyTiles', ceiling: 'slats' },
      { name: 'stair house', s: [-92.5, -81.5], h: [-4, 0.5], walls: 'redLineTiles', floor: 'greyTiles', ceiling: 'slats', stairs: 'redLineTiles', sill: -1.55 },
      { name: 'stairs to the street', s: [-103, -92.5], h: [-7.5, -3.5], walls: 'redLineTiles', floor: 'greyTiles', ceiling: 'slats', stairs: 'redLineTiles' },
      { name: 'passage to the lift', s: [-83, -77], u: [-20, -0.6], h: [-7.5, -6], walls: 'redLineTiles', floor: 'greyTiles', ceiling: 'slats' },
    ],
    // (the stair house keeps clear of the trains on the tracks closing in on it)
    blocks: [
      { name: 'hall', plan: [[-53.8, -3.2], [-81.5, -3.2], [-81.5, 1.5], [-53.8, 1.5]], h: [0, 2.95], walls: 'whitePanels', sides: [undefined, undefined, undefined, 'glazed'],
        band: { walls: 'glazed', from: 2.15 }, floor: 'greyTiles', onPlatform: true },
      // (its floor the ledge at the glass's foot, beside the stairs)
      { name: 'stair house', plan: [[-81.5, -2.6], [-92.6, -2.6], [-92.6, 1.4], [-81.5, 1.4]], h: [-3.6, 2.35], low: 1.25, from: -1.55, walls: 'glazed', sides: [undefined, null, undefined, null],
        floor: 'boardConcrete', ceiling: 'slats', roof: 0.2 },
      // (over the second flight, under the tracks' level: the wall with Tallkrogsdraken, and the
      // door at the street)
      { name: 'stair house, lower', plan: [[-92.6, -2.6], [-102.2, -2.0], [-102.2, 1.6], [-92.6, 1.4]], h: [-6.85, 1.25], low: 0.3, from: -6.85, walls: 'boardConcrete',
        sides: [undefined, undefined, undefined, 'whitePanels'], roof: 0.2 },
      // (where the passage to the lift comes out of the bank)
      { name: 'passage to the lift', plan: [[-79.4, -8.5], [-82.0, -8.5], [-82.0, -18.2], [-79.4, -18.2]], h: [-6.85, -4.0], from: -6.85, walls: 'boardConcrete', roof: 0.25 },
    ],
    buildings: ['w1147168692', 'w1147168693'],
    art: [
      { kind: 'masts', height: 4.4, at: [[-16, -0.2], [0.5, -0.5], [15, -0.3], [30.5, 0.3], [47, 0.6], [60, 1.5], [75, 1.6], [81, 1.4]] },
      { kind: 'mural', picture: 'tallkrogsdraken', s: -92.6, u: -0.6, turn: 0, bottom: -0.95, top: 1.1, width: 3.0 },
    ],
    // 2.6 m beyond each track
    fences: [
      { points: [[-75, -7.6], [-60, -8.0], [-50, -8.1], [-30, -7.9], [-10, -7.5], [10, -6.8], [30, -6.0], [50, -5.1], [70, -4.1], [88, -3.3]], h: [-2, 0] },
      { points: [[-80, 6.6], [-60, 6.9], [-40, 7.1], [-20, 7.2], [30, 7.2], [60, 7.4], [88, 7.5]], h: [-2, 0] },
    ],
    benches: { at: [-45, -36, -23], double: true },
  },

  // Skogskyrkogården (1 October 1950, as Kyrkogården; renamed in 1958): an island platform on a
  // low bank between the woods of the cemetery to the east and Enskede's workshops to the west,
  // its north end on the tracks' two bridges over Sockenvägen. The laser scan puts its butterfly
  // roof from 10.5 m south of the platform's middle to 72 m north, about 8.6 m wide and half a
  // metre west of the line down the platform's middle, its top 3.25 m over the platform along the
  // valley and 3.6 m at the edges. Photographs show it boarded dark brown underneath on dark
  // brown rafters, a dark fascia, black steel columns under a black beam along the valley, the
  // southernmost cased in a big dark grey box with the clock beside it; rows of round strip
  // lights either side of the beam, black name signs and departure boards hung under it, and a
  // glass shelter; dark grey pavers with paler ones among them, a pale ribbed strip for the blind
  // and pale edge stones. Out in the open to the south, galvanised lamp posts down the middle
  // (laser scan: about 4.8 m high, every 12.5 m), each with two white dome lamps on an arm across
  // and some with a black name sign, and a glass shelter with a flat roof (laser scan: 34 m to
  // 29 m south, 2.5 m high).
  //
  // Hans Bartos' sculpture (1975, wood): two big armchairs of thick pine timbers facing each other
  // across a low table, beside the cased column at the roof's south end (photographs from 2018).
  //
  // At its north end the platform runs on into a glass building between the two bridges
  // (OpenStreetMap's outline; laser scan: its roof 2.65 m over the platform, from 72 m to 91 m
  // north), framed in black, with a white slatted ceiling and pendant lamps: on its west side a
  // walkway at the platform's level out to a lift; on its east side stairs down, between walls of
  // dark grey tiles with the glass over them and a glass balustrade, to the ticket hall at the
  // street (OpenStreetMap's indoor mapping: the stairs from 77 m to 86 m north, the lift at 90 m,
  // the gates at 93 m, the door at 97 m; laser scan: the street 5.3 m below the platform). The
  // lift is walked through, out into the hall. The hall has a floor of grey tiles, a white
  // slatted ceiling and the gates, and a front of glass doors in steel frames under a blue band
  // with the station's name; over it, between the bridges, a box of dark grey panels (laser scan:
  // up to 0.7 m over the platform), and the bridges' decks over the doors on either side.
  //
  // Chain-link fences beyond both tracks, and the cemetery's stone wall beyond the eastern one.
  'Skogskyrkogården': {
    roof: {
      kind: 'butterfly',
      from: -10.5, to: 72, width: 8.6, offset: -0.6,
      middle: 3.03, edge: 3.38, thick: 0.22, fascia: 0.3,
      rafters: 1.5, rafterSize: [0.08, 0.18],
      beam: 0.35,
      columns: { every: 9, at: -8.5, size: 0.2, plinth: { size: 0.3, height: 0.06 }, casings: { at: [-8.5], size: [0.9, 1.2] } },
      lamps: { offset: 1.0, length: 1.5, every: 1.6 },
      colors: { underside: 0x4c3628, fascia: 0x2b2623, top: 0x3b3d3f, steel: 0x1f2021 },
      signs: { at: [-1, 27, 55], back: '', ahead: 'Sockenvägen' },
      clocks: [[-8.5, 0.85]],
      boards: [
        { s: 44, u: 1.4, toward: 'Farsta strand', trains: ['18 Farsta strand  3 min', '18 Farsta strand  13 min'] },
        { s: 44, u: -1.4, toward: 'Hässelby strand', trains: ['18 Hässelby strand  6 min', '18 Hässelby strand  16 min'] },
      ],
    },
    paving: {
      edge: 0.3, tactile: [0.5, 0.9], slabs: 0.9, paverSize: [0.3, 0.2], mix: 0.15,
      colors: { edge: 0xc9c7c1, tactile: 0xb4b2ac, slab: 0xb4b2ac, pavers: 0x5c5e61, paler: 0x6c6e71, face: 0x8e8b85 },
      pattern: 'bond',
    },
    rooms: [
      { name: "platform's north end", s: [68, 72.4], h: [-0.5, 1], walls: null, floor: 'pavers' },
      // (the glass building's: walls beside the stairs up to the walkway's level, the glass over
      // them)
      { name: 'stair house', s: [72.4, 89.25], h: [-5.6, 1], walls: 'darkTiles', floor: 'slate', ceiling: 'slats', stairs: 'darkTiles', sill: 0 },
      { name: 'ticket hall', s: [89.25, 102], h: [-6, -4.5], walls: 'whitePanels', floor: 'greyTiles', ceiling: 'slats' },
    ],
    // (between the bridges, the stair house narrowing with the gap between the tracks; it and the
    // box over the hall cut into the bridges' decks, which are drawn wider than they are)
    blocks: [
      { name: 'stair house', plan: [[72.4, -5.0], [91.4, -5.25], [91.4, 0.15], [72.4, 1.15]], h: [0, 2.4], walls: 'darkGlazed', sides: [undefined, 'greyPanels', undefined, null],
        floor: 'slate', ceiling: 'slats', roof: 0.25, onPlatform: true },
      { name: 'stair house, under the walkway', plan: [[75.5, -5.05], [89.25, -5.22], [89.25, 0.27], [75.5, 0.99]], h: [-5.3, 0], from: -5.3, walls: 'greyPanels', sides: [undefined, null],
        onPlatform: true },
      { name: 'ticket hall', plan: [[89.2, -5.1], [98.5, -5.1], [98.5, 0.45], [89.2, 0.45]], h: [-5.3, -2.45], from: -5.3, walls: 'greyPanels', sides: [undefined, 'glazed'], roof: 0.1,
        nameSign: { side: 1, at: 0.5, length: 4.6, bottom: -2.95 }, onPlatform: true },
      { name: 'box over the hall', plan: [[91.4, -5.1], [96.6, -5.1], [96.6, 0.25], [91.4, 0.25]], h: [-2.35, 0.5], from: -2.35, walls: 'greyPanels', roof: 0.2, onPlatform: true },
    ],
    buildings: ['w104431682'],
    art: [
      { kind: 'masts', height: 5.1, color: 0xa3a8ab, top: false, at: [[-72, 0.6], [-62.8, 0.6], [-37.3, 0.4]] },
      { kind: 'masts', height: 5.1, color: 0xa3a8ab, top: false, sign: 2.6, at: [[-49.8, 0.5], [-24.8, 0.4]] },
      { kind: 'chairs', s: -6.6, u: 1.4, turn: Math.PI / 2 },
    ],
    // (where along the roof the shelter under it stands isn't known)
    shelters: [
      { s: [-34, -29], u: [-0.9, 1.5], roof: true },
      { s: [30, 34.5], u: [0.5, 2.4] },
    ],
    // 2.6 m beyond each track
    fences: [
      { points: [[-76, -6.5], [-50, -7.1], [-30, -7.5], [-10, -7.9], [10, -8.3], [30, -8.6], [50, -8.9], [70, -9.2], [76, -9.3]], h: [-1.4, 0.6] },
      { points: [[-76, 7.7], [-50, 7.7], [-30, 7.9], [-10, 8.0], [10, 8.0], [30, 7.8], [50, 7.2], [70, 6.2], [76, 5.8]], h: [-1.4, 0.6] },
    ],
  },
  // Sandsborg (1 October 1950; renewed in 2004): an island platform on the bank between Enskede's
  // houses and Dalen, with its way out at its south end, where the tracks cross Stora Gungans
  // väg's underpass. The laser scan puts a flat roof from 31.5 m south of the platform's middle
  // to 72.5 m, about 8 m wide, its middle 0.8 m west of the platform's, its top 3.1 m over the
  // platform. Photographs (2019) show it red steel: columns in pairs west of the middle on
  // concrete plinths, a beam along each row, deep cross beams reaching out to a red fascia, and
  // ribbed pale grey sheet between them, the ribs along the platform; a long round light hung down
  // its east half, black name signs and departure boards, and a glass shelter on the west side
  // framed in black. The paving: wide pale slabs along the edges, a ribbed strip for the blind,
  // then grey slabs. Out in the open to the north, red lamp posts down the middle (laser scan:
  // about 14 m apart, 4.7 m high), each with three white dome lamps at the top and two small ones
  // lower down, two of them with black name signs.
  //
  // At the south end the platform runs into the station's hall, between the tracks, on the bank
  // over the underpass (OpenStreetMap's outline, laser scan: from 72.8 m to 104 m south, its roof
  // 4.25 m over the platform and reaching out over the tracks at the platform end): glazed in grey
  // steel frames, with a pale block wall under windows on the west side and dark grey panels at
  // the lift's end, a flat roof, and a plant room on it. Through doors from the platform, the
  // ticket gates; beyond them, stairs down along the west side behind a glass balustrade, and a
  // walkway along the east side to a lift, both to the underpass (OpenStreetMap's indoor mapping:
  // 29 steps; laser scan: the street 4.5 m under the platform). Inside: pale tiled floors, white
  // panels, a white slatted ceiling. The underpass runs straight under the bank, lined in pale
  // green tiles, between concrete abutments with the station's name on a blue band over each end;
  // red board fences along the tops of the abutments.
  //
  // Beyond the eastern track a fence of weathered boards slanting between concrete posts, beyond
  // the western a chain-link fence.
  'Sandsborg': {
    roof: {
      kind: 'butterfly',
      from: -72.5, to: -31.5, width: 8, offset: -0.3,
      middle: 2.87, edge: 2.87, thick: 0.25, fascia: 0.42,
      rafters: 2.6, rafterSize: [0.14, 0.32], rafterColor: 0x6f2a25, deck: 'ribbed',
      beam: 0.4,
      columns: { every: 8, at: -36, size: 0.22, plinth: { size: 0.5, height: 0.15 }, pair: 1.4, offset: -1.1 },
      lamps: { offset: 0, at: [1.6], length: 1.2, every: 1.6, tube: true },
      colors: { underside: 0xc3c6c6, fascia: 0x6f2a25, top: 0x4a4e52, steel: 0x6f2a25 },
      signs: { at: [-40, -56, -68], back: 'Stora Gungans väg', ahead: '', bottom: 2.05 },
      boards: [
        { s: -33, u: -1.8, toward: 'Hässelby strand', trains: ['18 Hässelby strand  3 min', '18 Hässelby strand  13 min'] },
        { s: -33, u: 1.2, toward: 'Farsta strand', trains: ['18 Farsta strand  7 min', '18 Farsta strand  17 min'] },
      ],
    },
    paving: {
      edge: 1.4, tactile: [1.4, 1.9], slabs: 1.9, paverSize: [0.6, 0.4], mix: 0.12,
      colors: { edge: 0xbdbcb6, tactile: 0xa8a7a2, slab: 0xb4b2ac, pavers: 0x8e9092, paler: 0x9c9ea0, face: 0x8e8b85 },
      pattern: 'bond',
    },
    rooms: [
      { name: 'hall', s: [-104.5, -72.4], h: [-0.5, 1], walls: 'whitePanels', floor: 'paleTiles', ceiling: 'slats', stairs: 'paleGreenTiles', sill: 0 },
      { name: 'stairs', s: [-92.5, -84], h: [-5, -3], walls: 'paleGreenTiles', floor: 'paleTiles', stairs: 'paleGreenTiles', sill: 0 },
      { name: 'foot of the stairs', s: [-97.5, -92.5], h: [-5, -3], walls: 'paleGreenTiles', floor: 'paleTiles', ceiling: 'whitePanels' },
      { name: 'west of the underpass', s: [-106, -92], u: [-30, -8.8], h: [-5, -3], walls: null, floor: 'asphalt' },
      { name: 'east of the underpass', s: [-106, -92], u: [7.2, 30], h: [-5, -3], walls: null, floor: 'asphalt' },
      { name: 'underpass', s: [-106, -92], h: [-5, -3], walls: 'paleGreenTiles', floor: 'asphalt', ceiling: 'boardConcrete' },
    ],
    // (between the tracks, kept 1.5 m off them; the roof reaches out over them)
    blocks: [
      { name: 'gate hall', plan: [[-72.8, -3.85], [-85.0, -3.75], [-85.0, 2.15], [-72.8, 2.2]], h: [-1.3, 3.95], walls: 'glazed',
        eaves: [1.5, 0, 1.0, 0.3], floor: 'paleTiles', ceiling: 'slats', roof: 0.3, onPlatform: true },
      { name: 'stair hall', plan: [[-85.0, -3.75], [-104.0, -3.3], [-104.0, 1.8], [-85.0, 2.15]], h: [-1.3, 3.95], walls: 'glazed',
        sides: ['highWindows', 'greyPanels', undefined, null], eaves: [0.6, 0.4, 0.5, 0], floor: 'paleTiles', ceiling: 'whitePanels', roof: 0.3, onPlatform: true },
      { name: 'plant room', plan: [[-82.2, -3.3], [-84.0, -3.3], [-84.0, -1.6], [-82.2, -1.6]], h: [4.25, 5.5], from: 4.25, walls: 'greyPanels', roof: 0.1 },
      // the underpass's ends: a notch in the bank, the abutment's face over the way through and
      // walls either side, falling with the bank
      { name: 'west end of the underpass', plan: [[-93.4, -8.8], [-93.4, -15], [-105.4, -15], [-105.4, -8.8]], h: [-4.5, -1.4], from: -4.5, low: -4.1,
        walls: 'boardConcrete', sides: [undefined, null], floor: 'asphalt', nameSign: { side: 3, at: 0.5, length: 4.4, bottom: -1.95, inside: true }, onPlatform: true, ground: true },
      { name: 'east end of the underpass', plan: [[-93.4, 7.2], [-93.4, 13], [-105.4, 13], [-105.4, 7.2]], h: [-4.5, -1.4], from: -4.5, low: -4.1,
        walls: 'boardConcrete', sides: [undefined, null], floor: 'asphalt', nameSign: { side: 3, at: 0.5, length: 4.4, bottom: -1.95, inside: true }, onPlatform: true, ground: true },
      // (under the bank, where neither the street the laser scan sees under the bridge nor the
      // ground runs on)
      { name: 'bank over the underpass', plan: [[-93.4, -8.8], [-105.4, -8.8], [-105.4, 7.2], [-93.4, 7.2]], h: [-4.5, -2.0], from: -4.5, walls: 'boardConcrete', sides: [null, null, null, null],
        onPlatform: true, ground: true },
    ],
    buildings: ['w104431681'],
    art: [
      { kind: 'masts', height: 4.7, color: 0xa8262b, arm: 0.9, lower: 3.7, at: [[-24.2, -0.45], [-10, -0.15], [19.8, -0.3], [31.6, -0.45], [60.1, -0.25], [71.8, -0.7]] },
      { kind: 'masts', height: 4.7, color: 0xa8262b, arm: 0.9, lower: 3.7, sign: 2.6, at: [[6, -0.45], [45.8, -0.45]] },
    ],
    shelters: [{ s: [-51, -46], u: [-2.3, -0.7] }],
    fences: [
      { points: [[-92, -8.8], [-75, -9.4], [-60, -9.6], [-40, -9.6], [-20, -9.3], [0, -8.8], [20, -8.3], [40, -7.9], [60, -7.5], [75, -7.2]], h: [-1.4, 0] },
      { points: [[-92, 7.6], [-80, 7.9], [-60, 8.3], [-40, 8.6], [-20, 8.8], [0, 8.9], [20, 8.8], [40, 8.3], [60, 7.6], [75, 7.1]], h: [-1.4, 0.4], kind: 'louvres' },
      { points: [[-91.5, -8.9], [-107, -8.9]], h: [-1.4, 0.4], kind: 'boards' },
      { points: [[-91.5, 7.3], [-107, 7.3]], h: [-1.4, 0.4], kind: 'boards' },
    ],
  },
};
