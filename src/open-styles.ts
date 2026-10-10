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
//
// A station whose platform is underground (a box or rock, which the network draws, styled in
// src/hall-styles.ts) can be styled here too, without a roof or paving: its ticket hall, stairs
// and the building over them in the street.

export interface OpenStyle {
  roof?: ButterflyRoof;
  // more roofs beside it, along the same line: a W of two butterflies side by side
  roofs?: ButterflyRoof[];
  paving?: Paving;
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
  // or, where its tracks curve apart and the platform widens, its middle (this far to the right of
  // the platform's) and its width at points along it ([s, u, width]), straight between them
  shape?: [number, number, number][];

  // the underside's height at the middle and at the edges, the roof's thickness, and how deep
  // its fascia is at the edges
  middle: number; edge: number;
  thick: number; fascia: number;
  rafters: number;             // between the rafters across the underside
  beam: number;                // the beam's depth under the valley
  rafterSize?: [number, number]; // across and deep (0.05 by 0.1 by default)
  rafterAt?: number;           // one of the rafters at this `s` (by default half the gap in from `from`)
  // the underside boarded along the platform, or of ribbed sheet metal, the ribs along it (or
  // across it, `ribbedAcross`); and the rafters steel (this colour) rather than boarded
  deck?: 'boards' | 'ribbed' | 'ribbedAcross';
  rafterColor?: number;
  // steel purlins along the underside at these `u` across the roof's middle, `size` across and deep
  purlins?: { at: number[]; size: [number, number] };
  // a steel channel along the valley, wide and deep
  gutter?: [number, number];
  // raised bays across the roof, each `length` long with its middle at one of `at`: a covering
  // pitched both ways along the platform from a ridge across it, `ridge` over the platform
  lanterns?: { at: number[]; length: number; ridge: number };
  // columns `every` m, one of them at `at`, only `between` these `s` if given; or pairs of them
  // across the platform, `pair` apart, each under a beam of its own; `braces`, knee braces from
  // each column up to the beam this far along it either way; `casings`, a dark box round the
  // columns at these `s`, `size` across and along; `offset`, the columns (and the beams over
  // them, and the signs) this far to the right of the roof's middle; `edges`, pairs of them each
  // this far in from the roof's edges, however wide it is there; `cross`, a steel beam across the
  // roof over each pair, from edge to edge, its underside `cross[0]` over the platform and
  // `cross[1]` deep (and the columns on up through it to the rafters over them)
  columns: {
    every: number; at: number; size: number; plinth: { size: number; height: number }; pair?: number;
    between?: [number, number]; braces?: number; casings?: { at: number[]; size: [number, number] }; offset?: number;
    edges?: number; cross?: [number, number];
  };
  // rows of strip lights along the underside, `offset` either side of the beam (or at these `u`
  // across the roof's middle): fittings `length` long, `every` apart; `tube`, in a long round
  // housing hung under the rafters; `across`, the fittings lying across the platform
  lamps: { offset: number; length: number; every: number; at?: number[]; tube?: boolean; across?: boolean };
  colors: { underside: number; fascia: number; top: number; steel: number };
  // name signs hung under the beam at these `s`, with the way out at each end of the platform
  // (none if empty); or, between a pair of beams, from the rafters, `bottom` over the platform;
  // black, or (`blue`) SL's dark blue over a yellow stripe
  signs: { at: number[]; back: string; ahead: string; bottom?: number; blue?: boolean };
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
// at all (`walls: null`) where its floors are the platform's ends, out under the roof, and no floor
// drawn (`floor: null`) where they are on a platform the network draws, which is paved. `roof`
// puts a roof this thick on its ceilings; `slab` a slab this thick under its floors, where they
// stand on a bridge.
//
// `sill`: in a glass building (a block's), the walls beside its floors and stairs rise only to
// this height, the building's glass above them, and its stairs have no ceiling of their own.
export interface Room {
  name: string;
  s: [number, number]; u?: [number, number]; h: [number, number];
  walls?: Finish | null; floor?: Finish | null; ceiling?: Finish; stairs?: Finish;
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
  | 'asphalt'       // dark grey asphalt
  | 'stripes'       // tiles in bands of white and black, the bands of different depths
  | 'greenWindows'  // green sheet-metal panels to 2.5 m, windows in grey steel frames above
  | 'checkWindows'  // tiles checked in blue and white to a sill, two rows of windows in dark frames above
  | 'blueTiles'     // small square tiles, white with a scattering of blue and beige, and a checked band
  | 'tiledWindows'  // small square tiles in pale colours to a sill, tall windows in dark blue frames above
  | 'gridTerrazzo'  // cream terrazzo squares in a grid of dark grey strips
  | 'shopWindows'   // shop fronts: lit windows, a sign board over each, white render above
  | 'storeys'       // a building of three storeys: shops under a dark band, ribbon windows in white render
  | 'liftWindows'   // black steel panels on a concrete plinth, windows in pale frames
  | 'redWindows'    // windows in red steel frames on a concrete plinth, cream panels above
  | 'shutter'       // a white roller shutter, cream panels above
  | 'redPanels'     // dark red painted panels
  | 'perforated'    // dark grey perforated steel panels, a ceiling's
  | 'lineMosaic'    // pale grey stone, dark lines of mosaic crossing it in long triangles
  | 'creamPanels'   // cream panels between red steel posts
  | 'blueGlazed'    // white panels to a sill, glazed above in blue steel frames
  | 'blueClerestory' // white panels, a dark blue band over a yellow line, windows in blue frames above
  | 'steelFront'    // glass doors in brushed steel, a sign band, the dark blue band, windows above
  | 'ribbedMetal';  // pale ribbed sheet metal, a ceiling's

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
// inside it. `roofColor`: its roof this colour (dark grey by default); `brackets`, steel brackets
// of this colour under the eaves, from the walls' top out to the roof's edge, about `every` m
// apart along each side the eaves reach out from.
export interface Block {
  name: string; plan: [number, number][]; h: [number, number]; from?: number; low?: number; eaves?: number | number[]; ground?: boolean;
  walls: Finish; sides?: (Finish | null | undefined)[]; band?: { walls: Finish; from: number };
  floor?: Finish; ceiling?: Finish; roof?: number; lights?: { side: number; at: number; length: number }[];
  onPlatform?: boolean; nameSign?: { side: number; at: number; length: number; bottom: number; inside?: boolean };
  roofColor?: number; brackets?: { every: number; color: number };
}

export type Art = Guardian | Stacks | Panels | Masts | Mural | Chairs | Roundel | GlassStacks | GlassPosts;

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

// The metro's round sign on a post on a roof at s, u, its middle `h` high and `size` across, its
// faces across the platform; the post from `foot` up.
export interface Roundel { kind: 'roundel'; s: number; u: number; h: number; size: number; foot: number }

// Stacks of green glass sheets, each tapering on all sides to a narrow ridge, `count` of them side
// by side along the platform with their middle at s, u, standing on the ground `foot` high, the
// tallest `height` high.
export interface GlassStacks { kind: 'glassStacks'; s: number; u: number; foot: number; height: number; count: number }

// Slabs of the same glass standing at the points, from `h[0]` to `h[1]` high, `size` along and
// across the platform.
export interface GlassPosts { kind: 'glassPosts'; at: [number, number][]; h: [number, number]; size: [number, number] }

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
  // Blåsut (1 October 1950; renewed, and Ann Edholm's art put up, in 2008): an island platform on
  // the bank through Blåsutparken, with its way out at its south end, where the tracks cross the
  // cycle path's underpass. The laser scan puts a butterfly roof from 13.5 m south of the
  // platform's middle to 64.6 m, 8.7 m wide, its top 3.3 m over the platform at the valley and
  // 3.65 m at the edges. Photographs (2019) show its underside pale grey, with white steel rafters
  // across it, a dark grey beam along the valley on a row of dark grey columns, a long round light
  // down each half, black name signs and departure boards, a clock at the south end, and a glass
  // shelter framed in black on the east side. The paving: a pale band along each edge, a ribbed
  // strip for the blind, then grey slabs. Out in the open to the north, galvanised lamp posts down
  // the middle (laser scan: about 15 m apart, 4.7 m high), each with three white dome lamps, some
  // with black name signs.
  //
  // At the south end the platform runs into the station's hall between the tracks, on the bank over
  // the underpass (OpenStreetMap's outline, laser scan: from 64.6 m to 84.5 m south, its roof
  // 4.35 m over the platform, narrowing to the south where the western track bends in), a flat
  // roof reaching out over its walls. Its northern part, with the ticket gates (OpenStreetMap's
  // indoor mapping: 68.9 m south), green sheet metal under a row of windows; its southern part
  // glazed from floor to roof in grey steel frames, over the stairs down along its east side
  // (OpenStreetMap: from 73.5 m to 81.4 m south) and a walkway along its west side to a glass lift
  // tower at its south end (laser scan: 6 m high), both to the underpass, 4.2 m under the platform.
  // Inside: pale tiled floors, white panels, a white slatted ceiling over the gates; pale tiles
  // beside the stairs. South of the lift, a low concrete box. The underpass runs straight under the
  // bank, between faces lined to the top of the way through in Ann Edholm's bands of white and
  // black tiles, with the station's name on a blue band over each end.
  //
  // Chain-link fences beyond both tracks, along the top of the bank.
  'Blåsut': {
    roof: {
      kind: 'butterfly',
      from: -64.6, to: -13.5, width: 8.7, offset: -0.15,
      middle: 3.08, edge: 3.44, thick: 0.2, fascia: 0.3,
      rafters: 1.8, rafterSize: [0.1, 0.3], rafterColor: 0xd9dbd9,
      beam: 0.35,
      columns: { every: 8, at: -20, size: 0.24, plinth: { size: 0.45, height: 0.12 } },
      lamps: { offset: 2.8, length: 1.2, every: 1.8, tube: true },
      colors: { underside: 0xdcdedc, fascia: 0xd0d2d0, top: 0x4a4e52, steel: 0x50565a },
      signs: { at: [-24, -40, -56], back: '', ahead: '' },
      clocks: [[-62.5, -0.9]],
      boards: [
        { s: -33, u: -1.6, toward: 'Hässelby strand', trains: ['18 Hässelby strand  4 min', '18 Hässelby strand  14 min'] },
        { s: -33, u: 1.6, toward: 'Farsta strand', trains: ['18 Farsta strand  6 min', '18 Farsta strand  16 min'] },
      ],
    },
    paving: {
      edge: 0.9, tactile: [0.9, 1.25], slabs: 1.25, paverSize: [0.6, 0.6], mix: 0.05,
      colors: { edge: 0xc2c1bc, tactile: 0xaeada8, slab: 0xb6b4ae, pavers: 0x9fa0a0, paler: 0xaeb0b0, face: 0x8e8b85 },
      pattern: 'bond',
    },
    rooms: [
      { name: 'gate hall', s: [-71.5, -64.5], h: [-0.5, 1], walls: 'whitePanels', floor: 'paleTiles', ceiling: 'slats', sill: 2.5 },
      { name: 'stair hall', s: [-84.6, -71.5], h: [-0.5, 1], walls: 'whitePanels', floor: 'paleTiles', ceiling: 'whitePanels', stairs: 'paleTiles', sill: 0 },
      { name: 'stairs', s: [-81.5, -73], u: [0.5, 3.5], h: [-5, -3], walls: 'paleTiles', floor: 'paleTiles', stairs: 'paleTiles', sill: 0 },
      { name: 'west of the underpass', s: [-87, -76], u: [-30, -7.0], h: [-5, -3], walls: null, floor: 'asphalt' },
      { name: 'east of the underpass', s: [-87, -76], u: [7.1, 30], h: [-5, -3], walls: null, floor: 'asphalt' },
      { name: 'underpass', s: [-87, -76], h: [-5, -3], walls: 'stripes', floor: 'asphalt', ceiling: 'boardConcrete' },
    ],
    // (between the tracks, kept 1.5 m off them; the roof reaches out over them)
    blocks: [
      { name: 'gate hall', plan: [[-64.6, -3.35], [-71.5, -3.15], [-71.5, 3.55], [-64.6, 3.55]], h: [-1.2, 4.05], walls: 'greenWindows',
        sides: [undefined, null, undefined, 'glazed'], eaves: [0.5, 0, 0.6, 0.2], floor: 'paleTiles', ceiling: 'slats', roof: 0.3, onPlatform: true },
      { name: 'stair hall', plan: [[-71.5, -3.15], [-84.5, -2.35], [-84.5, 3.55], [-71.5, 3.55]], h: [-1.2, 4.05], walls: 'glazed',
        sides: [undefined, undefined, undefined, null], eaves: [0.6, 0.3, 0.6, 0], floor: 'paleTiles', ceiling: 'whitePanels', roof: 0.3, onPlatform: true },
      // the tiled wall along the stairwell's east side, inside the glass
      { name: 'wall beside the stairs', plan: [[-73.5, 3.0], [-84.4, 3.0], [-84.4, 3.25], [-73.5, 3.25]], h: [0, 2.4], walls: 'paleTiles', roof: 0.05 },
      { name: 'box south of the lift', plan: [[-86.9, -1.9], [-88.6, -1.85], [-88.6, 1.9], [-86.9, 1.9]], h: [-1.2, 1.1], from: -1.2, walls: 'boardConcrete', roof: 0.1 },
      // the underpass's ends: a notch in the bank, the face over the way through and walls either
      // side falling with the bank, tiled up to the top of the way through
      { name: 'west end of the underpass', plan: [[-77.5, -6.8], [-77.5, -12.5], [-86.0, -12.5], [-86.0, -6.8]], h: [-4.4, -1.2], from: -4.4, low: -4.3,
        walls: 'stripes', band: { walls: 'boardConcrete', from: -1.95 }, sides: [undefined, null], floor: 'asphalt',
        nameSign: { side: 3, at: 0.52, length: 4.4, bottom: -1.85, inside: true }, onPlatform: true, ground: true },
      { name: 'east end of the underpass', plan: [[-77.5, 6.9], [-77.5, 12.5], [-86.0, 12.5], [-86.0, 6.9]], h: [-4.4, -1.2], from: -4.4, low: -4.1,
        walls: 'stripes', band: { walls: 'boardConcrete', from: -1.95 }, sides: [undefined, null], floor: 'asphalt',
        nameSign: { side: 3, at: 0.52, length: 4.4, bottom: -1.85, inside: true }, onPlatform: true, ground: true },
      // and on along the bank's foot to the south, the slope rising in front of them
      { name: 'west face south of the underpass', plan: [[-86.0, -6.8], [-95.0, -6.8], [-95.0, -7.1], [-86.0, -7.1]], h: [-4.4, -1.2], from: -4.4,
        walls: 'stripes', band: { walls: 'boardConcrete', from: -1.95 }, sides: ['boardConcrete'], roof: 0.05 },
      { name: 'east face south of the underpass', plan: [[-86.0, 6.9], [-95.0, 6.9], [-95.0, 7.2], [-86.0, 7.2]], h: [-4.4, -1.2], from: -4.4,
        walls: 'stripes', band: { walls: 'boardConcrete', from: -1.95 }, sides: ['boardConcrete'], roof: 0.05 },
      // (under the bank, where neither the street nor the ground runs on; nor the street just
      // beyond the underpass's walls, which isn't to be stepped onto through them)
      { name: 'bank over the underpass', plan: [[-78.6, -6.8], [-84.5, -6.8], [-84.5, 6.9], [-78.6, 6.9]], h: [-4.2, -1.95], from: -4.2, walls: 'boardConcrete', sides: [null, null, null, null],
        onPlatform: true, ground: true },
      { name: 'street under the bank', plan: [[-77.0, -6.8], [-87.0, -6.8], [-87.0, 6.9], [-77.0, 6.9]], h: [-4.4, -2.0], from: -4.4, walls: 'boardConcrete', sides: [null, null, null, null] },
    ],
    art: [
      { kind: 'masts', height: 4.75, color: 0x9a9fa3, at: [[8.2, -0.2], [38.5, -0.3], [68, -0.3]] },
      { kind: 'masts', height: 4.75, color: 0x9a9fa3, sign: 2.6, at: [[-6.4, -0.2], [23.8, -0.3], [54.3, -0.4], [84, -0.1]] },
      // on the lift's tower
      { kind: 'roundel', s: -86.4, u: -1.3, h: 6.35, size: 0.8, foot: 5.4 },
    ],
    benches: { at: [-9.5, 31, 61.5], double: true },
    shelters: [{ s: [-48, -44], u: [0.5, 2.2] }],
    fences: [
      { points: [[-88, -6.9], [-77.5, -6.9], [-70, -7.6], [-60, -8.4], [-40, -8.8], [-10, -9.0], [20, -9.0], [60, -8.8], [95, -8.6]], h: [-1.2, 0.6] },
      { points: [[-88, 7.0], [-77.5, 7.0], [-70, 7.6], [-60, 8.3], [-40, 8.6], [0, 8.6], [40, 8.4], [70, 7.8], [95, 7.6]], h: [-1.2, 0.6] },
    ],
  },
  // Farsta (4 November 1960; Gunnar Larson's Förvandlingar i luftrummet in the hall since 1982):
  // an island platform on the viaduct over Munkforsplan and Kroppaplan in Farsta centrum. The laser
  // scan puts a roof from 22.5 m south of the platform's middle to 77.9 m north, a W of two
  // butterflies side by side, each 7.3 m wide: its top 3.25 m over the platform at the valleys and
  // 3.6 m at the edges and along the ridge between them. Photographs (2018) show its underside of
  // galvanised corrugated sheet, the ribs across the platform, on purlins and rafters of dark steel,
  // a row of dark steel columns under each valley, strip lights, departure boards for Hässelby strand
  // on the western half and Farsta strand on the eastern, and clocks; the top pale grey. Out in the
  // open at each end, galvanised lamp posts with two dome lamps and black name signs, and fences
  // across the platform short of its ends. The paving: pale edge stones, a ribbed strip for the
  // blind, then grey concrete slabs in a running bond.
  //
  // Under the roof, between its two rows of columns, two glass halls over the stairs (laser scan and
  // photographs: about 23 m long), walled in tiles checked in blue and white to a sill, two rows of
  // windows in dark frames above, glazed up to the roof at the ends; in the south one's south end
  // and the north one's north end, glass doors, and inside, pale terrazzo and a waiting room with
  // benches along the walls. In each, an escalator on the west side and a wide stair on the east
  // (OpenStreetMap: from 14.8 m and 38.3 m north) go down towards the middle to the ticket hall under
  // the tracks, past walls of white tiles with a scattering of blue and beige ones. Between the halls
  // a lift, in a tower of dark steel and glass that stands up through the roof (laser scan: 3.85 m
  // over the platform). The hall, under the viaduct: a floor of cream terrazzo squares in a grid of
  // dark strips, the same tiles on its walls, a white ceiling, windows looking east under the
  // viaduct, and the ticket gates in its west wall. Beyond them a passage runs west between shops
  // through the white building on Farsta torg (OpenStreetMap's outline; laser scan: its roof 10.8 m
  // over the square), out under a blue sign, with a way out to Kroppaplan on its north side. To the
  // east, a short way out under the viaduct to Larsbodavägen through a glazed front with the
  // station's name over it.
  'Farsta': {
    roof: {
      kind: 'butterfly',
      from: -22.5, to: 77.9, width: 7.3, offset: -4.2,
      middle: 3.05, edge: 3.45, thick: 0.15, fascia: 0.3,
      rafters: 4.2, rafterAt: 22.3, rafterSize: [0.1, 0.3], rafterColor: 0x2a2d31,
      deck: 'ribbedAcross', purlins: { at: [-2.5, -1.2, 1.2, 2.5], size: [0.08, 0.14] },
      beam: 0.3,
      columns: { every: 8.4, at: 22.3, size: 0.2, plinth: { size: 0.3, height: 0.05 } },
      lamps: { offset: 1.9, length: 1.5, every: 4.2 },
      colors: { underside: 0xb8bcbd, fascia: 0x2e3135, top: 0xc9cbc8, steel: 0x2a2d31 },
      signs: { at: [], back: '', ahead: '' },
      clocks: [[17.5, 2.6]],
      boards: [
        { s: -10, u: -1.8, toward: 'Hässelby strand', trains: ['18 Hässelby strand  2 min', '18 Hässelby strand  12 min'] },
        { s: 66, u: -1.8, toward: 'Hässelby strand', trains: ['18 Hässelby strand  2 min', '18 Hässelby strand  12 min'] },
      ],
    },
    roofs: [{
      kind: 'butterfly',
      from: -22.5, to: 77.9, width: 7.3, offset: 3.1,
      middle: 3.05, edge: 3.45, thick: 0.15, fascia: 0.3,
      rafters: 4.2, rafterAt: 22.3, rafterSize: [0.1, 0.3], rafterColor: 0x2a2d31,
      deck: 'ribbedAcross', purlins: { at: [-2.5, -1.2, 1.2, 2.5], size: [0.08, 0.14] },
      beam: 0.3,
      columns: { every: 8.4, at: 22.3, size: 0.2, plinth: { size: 0.3, height: 0.05 } },
      lamps: { offset: 1.9, length: 1.5, every: 4.2 },
      colors: { underside: 0xb8bcbd, fascia: 0x2e3135, top: 0xc9cbc8, steel: 0x2a2d31 },
      signs: { at: [], back: '', ahead: '' },
      clocks: [[35.5, -2.6]],
      boards: [
        { s: -10, u: 1.8, toward: 'Farsta strand', trains: ['18 Farsta strand  6 min', '18 Farsta strand  16 min'] },
        { s: 66, u: 1.8, toward: 'Farsta strand', trains: ['18 Farsta strand  6 min', '18 Farsta strand  16 min'] },
      ],
    }],
    paving: {
      edge: 0.35, tactile: [0.35, 0.9], slabs: 0.9, paverSize: [0.3, 0.6], mix: 0.1,
      colors: { edge: 0xc8c7c2, tactile: 0x9a9b98, slab: 0xa8a9a8, pavers: 0x8f9193, paler: 0x9da0a2, face: 0x8e8b85 },
      pattern: 'bond',
    },
    rooms: [
      { name: 'south glass hall', s: [-10, 15], h: [-0.5, 1], walls: 'checkWindows', floor: 'terrazzo', sill: 0 },
      { name: 'north glass hall', s: [37, 63], h: [-0.5, 1], walls: 'checkWindows', floor: 'terrazzo', sill: 0 },
      { name: "lift's door", s: [26, 30], h: [-0.5, 1], walls: null, floor: 'terrazzo' },
      { name: 'south stairs', s: [5, 14.6], h: [-6, -4], walls: 'blueTiles', floor: 'gridTerrazzo', stairs: 'blueTiles', sill: 1.05 },
      { name: 'north stairs', s: [38.5, 48], h: [-6, -4], walls: 'blueTiles', floor: 'gridTerrazzo', stairs: 'blueTiles', sill: 1.05 },
      { name: 'hall, by the windows', s: [14, 39], u: [3.2, 5], h: [-6, -4], walls: 'tiledWindows', floor: 'gridTerrazzo', ceiling: 'whitePanels' },
      { name: 'Larsbodavägen', s: [14, 39], u: [10, 14], h: [-6, -4], walls: null, floor: 'pavers' },
      { name: 'way out to Larsbodavägen', s: [14, 39], u: [5, 10], h: [-6, -4], walls: 'blueTiles', floor: 'gridTerrazzo', ceiling: 'whitePanels' },
      { name: 'hall', s: [14, 39], u: [-9.55, 3.2], h: [-6, -4], walls: 'blueTiles', floor: 'gridTerrazzo', ceiling: 'whitePanels' },
      { name: 'Farsta torg', s: [5, 45], u: [-40, -33.7], h: [-6, -4], walls: null, floor: 'pavers' },
      { name: 'Kroppaplan', s: [39.2, 45], u: [-40, -9.55], h: [-6, -4], walls: null, floor: 'pavers' },
      { name: 'passage', s: [5, 45], u: [-40, -9.55], h: [-6, -4], walls: 'shopWindows', floor: 'gridTerrazzo', ceiling: 'whitePanels' },
    ],
    // (the glass halls between the rows of columns, which follow the roof's line, and up to its
    // valley beams; glazed above their ends up to the roof)
    blocks: [
      { name: 'south glass hall', plan: [[-8, -4.51], [14.8, -4.39], [14.8, 2.91], [-8, 2.79]], h: [0, 2.75], walls: 'checkWindows',
        sides: [undefined, undefined, undefined, 'glazed'], floor: 'terrazzo', onPlatform: true },
      { name: 'south glass hall, south gable west', plan: [[-8, -0.86], [-8, -4.51], [-7.9, -4.51], [-7.9, -0.86]], h: [2.75, 3.45], from: 2.75, low: 3.05, walls: 'glazed' },
      { name: 'south glass hall, south gable east', plan: [[-8, -0.86], [-8, 2.79], [-7.9, 2.79], [-7.9, -0.86]], h: [2.75, 3.45], from: 2.75, low: 3.05, walls: 'glazed' },
      { name: 'south glass hall, north gable west', plan: [[14.7, -0.74], [14.7, -4.39], [14.8, -4.39], [14.8, -0.74]], h: [2.75, 3.45], from: 2.75, low: 3.05, walls: 'glazed' },
      { name: 'south glass hall, north gable east', plan: [[14.7, -0.74], [14.7, 2.91], [14.8, 2.91], [14.8, -0.74]], h: [2.75, 3.45], from: 2.75, low: 3.05, walls: 'glazed' },
      { name: 'north glass hall', plan: [[38.3, -4.25], [61.1, -4.25], [61.1, 3.05], [38.3, 3.05]], h: [0, 2.75], walls: 'checkWindows',
        sides: [undefined, 'glazed'], floor: 'terrazzo', onPlatform: true },
      { name: 'north glass hall, south gable west', plan: [[38.3, -0.6], [38.3, -4.25], [38.4, -4.25], [38.4, -0.6]], h: [2.75, 3.45], from: 2.75, low: 3.05, walls: 'glazed' },
      { name: 'north glass hall, south gable east', plan: [[38.3, -0.6], [38.3, 3.05], [38.4, 3.05], [38.4, -0.6]], h: [2.75, 3.45], from: 2.75, low: 3.05, walls: 'glazed' },
      { name: 'north glass hall, north gable west', plan: [[61.0, -0.6], [61.0, -4.25], [61.1, -4.25], [61.1, -0.6]], h: [2.75, 3.45], from: 2.75, low: 3.05, walls: 'glazed' },
      { name: 'north glass hall, north gable east', plan: [[61.0, -0.6], [61.0, 3.05], [61.1, 3.05], [61.1, -0.6]], h: [2.75, 3.45], from: 2.75, low: 3.05, walls: 'glazed' },
      // the tiled walls over the stairs' feet, up through the viaduct's deck
      { name: 'wall over the south stairs', plan: [[14.8, -2.6], [15.0, -2.6], [15.0, 2.5], [14.8, 2.5]], h: [-2.2, 0], from: -2.2, walls: 'blueTiles' },
      { name: 'wall over the north stairs', plan: [[38.1, -2.4], [38.3, -2.4], [38.3, 2.7], [38.1, 2.7]], h: [-2.2, 0], from: -2.2, walls: 'blueTiles' },
      { name: "lift's tower", plan: [[24.95, -0.15], [28.0, -0.15], [28.0, 2.55], [24.95, 2.55]], h: [0, 3.85], walls: 'liftWindows', floor: 'terrazzo', roof: 0.12, onPlatform: true },
      // the building on Farsta torg, its shops and offices over the passage; its south wing
      { name: 'Farsta torg building', plan: [[16.6, -11.0], [39.2, -11.0], [39.2, -33.7], [16.6, -33.4]], h: [-5.6, 5.6], from: -5.2, walls: 'storeys', roof: 0.3,
        nameSign: { side: 2, at: 0.45, length: 3.6, bottom: -2.55 } },
      { name: 'Farsta torg building, south wing', plan: [[9.5, -11.0], [16.6, -11.0], [16.6, -15.7], [9.5, -15.6]], h: [-5.6, 2.8], from: -5.2, walls: 'storeys', roof: 0.3 },
      { name: 'Larsbodavägen front', plan: [[18.0, 9.7], [18.0, 10.0], [22.0, 10.0], [22.0, 9.7]], h: [-5.6, -2.2], from: -5.2, walls: 'glazed',
        nameSign: { side: 1, at: 0.5, length: 3.4, bottom: -2.75 } },
      // the hall's outside under the viaduct, and round the stairs where they come down under it
      { name: 'hall, outside', plan: [[14.65, -9.65], [38.45, -9.65], [38.45, 4.45], [14.65, 4.45]], h: [-5.6, -2.2], from: -5.2, walls: 'boardConcrete', sides: [undefined, undefined, null] },
      { name: 'way out to Larsbodavägen, outside', plan: [[18.35, 4.45], [21.65, 4.45], [21.65, 9.7], [18.35, 9.7]], h: [-5.6, -2.2], from: -5.2, walls: 'boardConcrete', sides: [null, undefined, null] },
      { name: 'south stairs, outside', plan: [[9.5, -2.75], [14.65, -2.75], [14.65, 2.65], [9.5, 2.65]], h: [-5.6, -2.2], from: -5.2, walls: 'boardConcrete', sides: [undefined, null] },
      { name: 'north stairs, outside', plan: [[38.45, -2.55], [43.6, -2.55], [43.6, 2.85], [38.45, 2.85]], h: [-5.6, -2.2], from: -5.2, walls: 'boardConcrete', sides: [undefined, undefined, undefined, null] },
      // (under the viaduct, where the street doesn't run on through the hall and under the stairs)
      { name: 'street over the hall', plan: [[13.8, -11.2], [39.3, -11.2], [39.3, 5.2], [13.8, 5.2]], h: [-5.6, -2.0], from: -5.6, walls: 'boardConcrete', sides: [null, null, null, null] },
      { name: 'street over the way out', plan: [[17.6, 5.2], [22.4, 5.2], [22.4, 10.0], [17.6, 10.0]], h: [-5.6, -2.0], from: -5.6, walls: 'boardConcrete', sides: [null, null, null, null] },
      { name: 'street under the south stairs', plan: [[8.8, -3.4], [13.8, -3.4], [13.8, 3.3], [8.8, 3.3]], h: [-5.6, -2.0], from: -5.6, walls: 'boardConcrete', sides: [null, null, null, null] },
      { name: 'street under the north stairs', plan: [[39.3, -3.2], [44.3, -3.2], [44.3, 3.5], [39.3, 3.5]], h: [-5.6, -2.0], from: -5.6, walls: 'boardConcrete', sides: [null, null, null, null] },
    ],
    buildings: ['w185409292'],
    art: [
      { kind: 'masts', height: 4.8, color: 0x9a9fa3, top: false, sign: 2.5, at: [[-31, -3.1], [-31, 2.4], [82.2, -2.8], [82.2, 2.6]] },
      { kind: 'masts', height: 4.8, color: 0x9a9fa3, top: false, at: [[-43.5, 3.0], [91, 2.3]] },
      { kind: 'roundel', s: 34, u: -36, h: -1.7, size: 0.8, foot: -5.15 },
    ],
    shelters: [{ s: [-20.5, -17], u: [2.5, 4.3] }, { s: [70, 73.5], u: [2.5, 4.3] }],
    fences: [
      { points: [[-48.8, -6.0], [-48.8, 6.3]], h: [0, 1.8] },
      { points: [[93.4, -6.4], [93.4, 6.3]], h: [0, 1.8] },
    ],
  },

  // Farsta strand (29 August 1971): the platform is underground, in a box the network draws in its
  // own style (src/hall-styles.ts); here, the ticket hall over it and the pavilion on Stieg
  // Trenters torg it stands in. OpenStreetMap's indoor mapping and photographs (2018) put two
  // flights in the middle of the platform, each stairs beside escalators, climbing towards each
  // other to the hall at the square (4.4 m over the platform): the nearer up into a glazed annex
  // on the pavilion's front, where it comes up through an opening in the floor between concrete
  // parapets, the further into Centrumhuset's ground floor; a lift between them, and the ticket
  // gates in the hall's middle, facing the way out on the square. Inside: a floor of pale grey
  // stone with Fredrik Jacobsson's mosaic (1993), dark lines crossing it in long triangles; a
  // ceiling of dark perforated steel panels, as on the platform; red walls.
  //
  // The pavilion, from the laser scan: its roof across the station from 26.9 m to 14.8 m south of
  // the platform's middle, from 18.8 m west of its line to 14 m east, its top falling from 9.6 m
  // over the platform at the back to 8.3 m at the front, with a raised part 10.1 m high at the back
  // against Centrumhuset's gable (whose outline data/building-corrections.json ends there); the
  // annex's flat roof 7.7 m high, from 15 m to 8 m south. Photographs: the roof pale green on red
  // steel brackets, reaching out over the walls; on the front a white roller shutter (the kiosk),
  // the doors under the station's name on a blue band and a low green canopy, and the annex glazed
  // in red frames on a concrete plinth.
  'Farsta strand': {
    rooms: [
      { name: 'flight up into the annex', s: [-16, -3], u: [-3.2, 0.8], h: [-0.5, 0.5], walls: 'boardConcrete', floor: null, stairs: 'boardConcrete', sill: 4.4 },
      { name: 'flight up into Centrumhuset', s: [-38, -24], u: [-3.6, 0.4], h: [-0.5, 0.5], walls: 'greyTiles', floor: null, stairs: 'greyTiles' },
      { name: "lift's door", s: [-22, -18.5], u: [1, 4], h: [-0.5, 0.5], walls: null, floor: null },
      { name: 'annex', s: [-16.2, -12], u: [-6, 2], h: [4, 5], walls: 'redPanels', floor: 'lineMosaic', ceiling: 'perforated', sill: 4.3 },
      { name: 'ticket hall', s: [-30, -15], u: [-19, 14], h: [4, 5], walls: 'redPanels', floor: 'lineMosaic', ceiling: 'perforated', sill: 4.3 },
    ],
    // (the walls stand back from the roof's edges by its eaves)
    blocks: [
      { name: 'raised back', plan: [[-29.5, 13.1], [-26.9, 13.1], [-26.9, -18.8], [-29.5, -18.8]], h: [3.9, 9.75], from: 4.4, walls: 'redPanels', roof: 0.3,
        ground: true, roofColor: 0x8fb3a2 },
      // the kiosk, the hall and the shops, up to the hall's ceiling
      { name: 'kiosk', plan: [[-26.9, 13.1], [-16.0, 13.1], [-16.0, 9.6], [-26.9, 9.6]], h: [3.9, 7.85], from: 4.4, walls: 'redWindows',
        sides: [undefined, 'shutter', 'redPanels', null], ground: true, floor: 'lineMosaic', ceiling: 'perforated' },
      { name: 'hall', plan: [[-26.9, 9.6], [-16.0, 9.6], [-16.0, -5.9], [-26.9, -5.9]], h: [3.9, 7.85], from: 4.4, walls: 'redWindows',
        sides: [null, undefined, null, null], ground: true, floor: 'lineMosaic', ceiling: 'perforated',
        nameSign: { side: 1, at: 0.161, length: 4.4, bottom: 6.95 } },
      { name: 'shops', plan: [[-26.9, -5.9], [-16.0, -5.9], [-16.0, -18.8], [-26.9, -18.8]], h: [3.9, 7.85], from: 4.4, walls: 'redWindows',
        sides: ['redPanels', undefined, undefined, null], ground: true, floor: 'lineMosaic', ceiling: 'perforated' },
      // the roof over them, falling to the front, pale green on red steel brackets
      { name: 'roof', plan: [[-26.9, 13.1], [-16.0, 13.1], [-16.0, -18.8], [-26.9, -18.8]], h: [7.85, 9.3], from: 7.85, low: 7.9, roof: 0.3, walls: 'creamPanels',
        sides: [undefined, null, undefined, null], eaves: [1.0, 1.2, 0.2, 0], roofColor: 0x8fb3a2, brackets: { every: 1.8, color: 0xa3302a } },
      { name: 'annex', plan: [[-16.0, 1.5], [-8.2, 1.5], [-8.2, -5.6], [-16.0, -5.6]], h: [3.9, 7.5], from: 4.4, roof: 0.2, walls: 'redWindows',
        sides: [undefined, undefined, undefined, null], eaves: [0.3, 0.3, 0.3, 0], ground: true, floor: 'lineMosaic', ceiling: 'perforated',
        roofColor: 0x8fb3a2 },
      // the canopy over the doors, level with the annex's roof
      { name: 'canopy', plan: [[-16.0, 9.6], [-15.95, 9.6], [-15.95, 1.5], [-16.0, 1.5]], h: [7.5, 7.5], from: 7.5, roof: 0.2, walls: 'redPanels',
        sides: [null, null, null, null], eaves: [0, 0.9, 0, 0], roofColor: 0x8fb3a2, brackets: { every: 1.6, color: 0xa3302a } },
      // the parapets round the opening the nearer flight comes up through
      { name: 'parapets', plan: [[-13.6, 0.65], [-8.75, 0.65], [-8.75, -3.05], [-13.6, -3.05]], h: [4.4, 5.5], from: 4.4, walls: 'boardConcrete',
        sides: [undefined, undefined, undefined, null] },
      // (where it climbs under the square, before it comes up into the annex)
      { name: 'ceiling over the escalators', plan: [[-5.9, 1.0], [-8.2, 1.0], [-8.2, -3.4], [-5.9, -3.4]], h: [4.2, 4.2], from: 4.2, roof: 0.15, walls: 'boardConcrete',
        sides: [null, null, null, null], ceiling: 'perforated' },
    ],
  },

  // Globen (9 September 1951, as Slakthuset; Isstadion from 1958, Globen since 1989, when it was
  // rebuilt with the arena): an island platform in a cutting between Palmfeltsvägen and the
  // tram's platform, its tracks curving apart towards its east end, so that it widens from 7.5 m
  // at its west end to 13.7 m at its east. The laser scan puts its butterfly roof over the whole
  // platform, from 73 m west of its middle to 72.5 m east, the valley 3.6 m over the platform
  // and the edges 3.95 m, widening with it; three raised bays across it, each 8.5 m long, their
  // ridges 4.9 m high. Photographs show its underside of ribbed sheet, the ribs across the
  // platform, a pale wood brown, on rafters and beams of teal steel; two rows of teal columns,
  // one in from each edge, about 12.6 m apart, under a beam across the roof over each pair; strip
  // lights lying across, a steel gutter along the valley, departure boards side by side down the
  // middle, and SL's blue name signs with the ways out, Slakthusområdet to the west and Stockholm
  // Live to the east. The paving: pale edge stones, a ribbed strip for the blind, then dark grey
  // concrete slabs, 60 by 30 cm, in a running bond.
  //
  // At the east end, escalators and stairs climb 7.3 m in a glazed house, white panels under
  // glass in blue frames, its roof following them up, to the ticket hall on Globenbron
  // (OpenStreetMap's outline; laser scan: its eaves 10.8 m over the platform and its ridge 13.9 m):
  // a gabled hall, white panels under a dark blue band and a yellow line, windows in blue frames
  // above, a dark stone floor and a ribbed ceiling, the gates in its middle; its east gable
  // glass doors in brushed steel. The bridge's deck, 7 m over the platform, runs on north along
  // its front. At the west end, stairs climb 4.8 m in a glazed tube beside a lift's tower to a
  // small gabled hall on Slakthusbron, over the tracks on a concrete pier: the same walls, the
  // gates at the top of the stairs and the station's name over its doors, and the bridge's deck
  // across in front of it, from Slakthusområdet to the north over Palmfeltsvägen to Slakthusplan.
  //
  // Chain-link fences beyond both tracks. Along the southern, by Palmfeltsvägen, Joanna
  // Troikowicz's Isfantasi (1989), 149 m of it: slabs of green glass standing in the fence, and by
  // the road below the escalators' house, four stacks of green glass sheets, each tapering to a
  // ridge, about 3.5 m high (photographs; where the slabs stand along it is inferred).
  'Globen': {
    roof: {
      kind: 'butterfly',
      from: -73, to: 72.5, width: 12,
      shape: [[-73, 2.22, 7.83], [-60, 1.67, 8.94], [-44, 1.08, 10.12], [-28, 0.65, 11.0], [-12, 0.27, 11.74], [0, 0.03, 12.23],
        [16, -0.25, 12.78], [32, -0.43, 13.17], [48, -0.58, 13.45], [64, -0.75, 13.78], [72.5, -0.86, 13.98]],
      middle: 3.6, edge: 3.95, thick: 0.15, fascia: 0.35,
      rafters: 4.2, rafterAt: 5.8, rafterSize: [0.15, 0.3], rafterColor: 0x2f5f70,
      deck: 'ribbedAcross', gutter: [0.5, 0.35],
      lanterns: { at: [-38.3, -0.5, 37.3], length: 8.5, ridge: 4.9 },
      beam: 0.3,
      columns: { every: 12.6, at: 5.8, size: 0.3, plinth: { size: 0.5, height: 0.15 }, edges: 1.9, cross: [2.8, 0.45] },
      lamps: { offset: 3, length: 3.6, every: 4.2, at: [-3, 3], across: true },
      colors: { underside: 0xb39a77, fascia: 0x2c3f5a, top: 0x9ea4a8, steel: 0x2f5f70 },
      signs: { at: [-50.9, -13.1, 12.1, 49.9], back: 'Slakthusområdet', ahead: 'Stockholm Live', blue: true },
      boards: [
        { s: -25.7, u: -1.1, toward: 'Hässelby strand', trains: ['19 Hässelby strand  3 min', '19 Hässelby strand  13 min'] },
        { s: -25.7, u: 1.1, toward: 'Hagsätra', trains: ['19 Hagsätra  5 min', '19 Hagsätra  15 min'] },
        { s: 24.7, u: -1.1, toward: 'Hässelby strand', trains: ['19 Hässelby strand  3 min', '19 Hässelby strand  13 min'] },
        { s: 24.7, u: 1.1, toward: 'Hagsätra', trains: ['19 Hagsätra  5 min', '19 Hagsätra  15 min'] },
      ],
    },
    paving: {
      edge: 0.45, tactile: [0.45, 0.9], slabs: 1.05, slabSize: [0.3, 0.3], paverSize: [0.6, 0.3],
      colors: { edge: 0xb3b2ab, tactile: 0x8e8f8c, slab: 0xa4a7aa, pavers: 0x6e7072, face: 0x56585a },
      pattern: 'bond',
    },
    rooms: [
      // (out on the bridges' decks, which are the blocks')
      { name: 'Globenbron', s: [111, 140], u: [-45, 12], h: [6, 9], walls: null, floor: null },
      { name: 'east hall', s: [85, 116], h: [7, 8], walls: 'blueClerestory', floor: 'darkStone', sill: 7.2 },
      { name: 'escalators', s: [64, 95], h: [-0.5, 1], walls: 'blueClerestory', floor: null, stairs: 'blueClerestory', sill: 0.1 },
      { name: 'Slakthusbron', s: [-125, -96.6], h: [3, 7], walls: null, floor: null },
      { name: 'west hall', s: [-97.5, -84], h: [4, 6], walls: 'blueClerestory', floor: 'darkStone', sill: 4.7 },
      { name: 'west stairs', s: [-84, -70], h: [-0.5, 1], walls: 'blueClerestory', floor: null, stairs: 'blueClerestory', sill: 0.1 },
      { name: "platform's west end", s: [-75, -60], h: [-0.5, 1], walls: null, floor: null },
    ],
    blocks: [
      // the escalators' house, its roof following them up to the hall
      { name: 'escalators', plan: [[89.9, -16.1], [71.1, -10.85], [73.9, -1.2], [93.9, -7.1]], h: [-1.6, 11], low: 4.6, walls: 'blueGlazed',
        sides: [undefined, undefined, undefined, null], floor: 'pavers', roof: 0.25, roofColor: 0x3a3f45 },
      // the hall on Globenbron, gabled: its halves either side of the ridge
      { name: 'east hall, north half', plan: [[92.09, -11.18], [88.54, -19.35], [108.56, -25.08], [111.0, -16.59]], h: [6.3, 13.9], from: 7.3, low: 10.8,
        walls: 'blueClerestory', sides: [undefined, undefined, 'steelFront', null], ceiling: 'ribbedMetal', floor: 'darkStone',
        roof: 0.3, eaves: [1.0, 1.2, 1.5, 0], roofColor: 0x3a3f45 },
      { name: 'east hall, south half', plan: [[92.09, -11.18], [95.63, -3.0], [113.45, -8.1], [111.0, -16.59]], h: [6.3, 13.9], from: 7.3, low: 10.8,
        walls: 'blueClerestory', sides: [undefined, undefined, 'steelFront', null], ceiling: 'ribbedMetal', floor: 'darkStone',
        roof: 0.3, eaves: [1.0, 1.2, 1.5, 0], roofColor: 0x3a3f45 },
      // Globenbron's deck along the hall's east front, falling a little to the north
      { name: 'Globenbron', plan: [[116, 8], [108.5, -33], [119, -33], [133, 6]], h: [6.4, 7.0], from: 6.4, low: 6.7, walls: 'boardConcrete',
        roof: 0.3, roofColor: 0xb3b0a8 },
      // the west stairs' tube and the lift's tower beside it
      { name: 'west stairs', plan: [[-84.5, -1.3], [-72.5, -1.3], [-72.5, -4.3], [-84.5, -4.3]], h: [-1.6, 8.6], low: 2.9, walls: 'blueGlazed',
        sides: [undefined, undefined, undefined, null], floor: 'pavers', roof: 0.2, roofColor: 0x3a3f45 },
      { name: "lift's tower", plan: [[-80, -4.3], [-72, -4.3], [-72, -6.9], [-80, -6.9]], h: [-1.6, 8.8], walls: 'blueGlazed', roof: 0.2, roofColor: 0x3a3f45 },
      // the hall on Slakthusbron, gabled, over the tracks on a concrete pier, with a lower part
      // along its north side
      { name: 'west hall, north half', plan: [[-96, -5.7], [-96, -10.5], [-84.5, -10.5], [-84.5, -5.7]], h: [3.8, 10.2], from: 4.8, low: 9.5,
        walls: 'blueClerestory', sides: ['steelFront', undefined, undefined, null], ceiling: 'ribbedMetal', floor: 'darkStone',
        roof: 0.3, eaves: [0.6, 0.6, 0.6, 0], roofColor: 0x3a3f45 },
      { name: 'west hall, south half', plan: [[-96, -5.7], [-96, -1.6], [-84.5, -0.9], [-84.5, -5.7]], h: [3.8, 10.2], from: 4.8, low: 9.5,
        walls: 'blueClerestory', sides: ['steelFront', undefined, undefined, null], ceiling: 'ribbedMetal', floor: 'darkStone',
        roof: 0.3, eaves: [0.6, 0.6, 0.6, 0], roofColor: 0x3a3f45, nameSign: { side: 0, at: 0.5, length: 3.0, bottom: 7.4 } },
      { name: 'west hall, lower part', plan: [[-96, -12.8], [-84.5, -12.8], [-84.5, -10.5], [-96, -10.5]], h: [3.8, 7.7], from: 4.8,
        walls: 'blueClerestory', sides: [undefined, undefined, null], roof: 0.25, roofColor: 0x3a3f45 },
      { name: 'west hall, pier', plan: [[-96, -7.6], [-84.5, -7.3], [-84.5, -2.2], [-96, -3.0]], h: [-1.6, 3.8], from: -1.6, walls: 'boardConcrete' },
      // Slakthusbron's deck, from Slakthusområdet over the tracks and Palmfeltsvägen to Slakthusplan
      { name: 'Slakthusbron, north', plan: [[-96, -3], [-96, -40], [-103, -40], [-104.5, -3]], h: [4.0, 4.45], from: 4.0, walls: 'boardConcrete',
        roof: 0.3, roofColor: 0x8d8c88 },
      { name: 'Slakthusbron, south', plan: [[-112, 35], [-97, -3], [-104.5, -3], [-118, 35]], h: [4.0, 4.7], from: 4.0, low: 4.45, walls: 'boardConcrete',
        roof: 0.3, roofColor: 0x8d8c88 },
    ],
    buildings: ['w59413195', 'w114114003', 'w114114007'],
    art: [
      // on the bridge, before the hall's doors
      { kind: 'roundel', s: -99.5, u: 0.0, h: 7.9, size: 0.8, foot: 4.75 },
      // Isfantasi: in the southern fence, and by Palmfeltsvägen
      { kind: 'glassPosts', h: [-1.6, 1.25], size: [0.35, 0.14],
        at: [[-70, 6.0], [-60, 7.4], [-50, 8.6], [-40, 9.4], [-30, 10.1], [-20, 10.6], [-10, 10.95], [0, 11.1], [10, 10.95],
          [20, 10.6], [30, 10.1], [40, 9.4], [50, 8.5], [60, 7.3], [70, 5.9]] },
      { kind: 'glassStacks', s: 80, u: 17, foot: 0.4, height: 3.5, count: 4 },
    ],
    // 3.4 m beyond the southern track and 3 m beyond the northern; and railings along the bridges'
    // decks
    fences: [
      { points: [[-105, 1.2], [-90, 3.2], [-75, 5.3], [-60, 7.2], [-45, 8.8], [-30, 9.9], [-15, 10.7], [0, 10.9], [15, 10.7], [30, 9.9], [45, 8.8], [60, 7.1], [75, 4.8], [90, 1.4], [100, -1.3]], h: [-1.6, 1.0] },
      { points: [[-70, -11.4], [-60, -11.0], [-45, -10.5], [-30, -10.2], [-15, -10.2], [0, -10.5], [15, -11.3], [30, -12.4], [45, -14.0], [60, -16.0], [75, -18.8], [80, -19.8]], h: [-1.6, 1.0] },
      { points: [[119.2, -32.5], [132.7, 5.6], [116.3, 7.6], [113.7, -5]], h: [7.0, 8.2] },
      { points: [[-96.2, -40], [-96.2, -13.1]], h: [4.75, 5.85] },
      { points: [[-103.1, -40], [-104.6, -3], [-117.8, 34.5]], h: [4.75, 5.85] },
      { points: [[-97.9, -0.6], [-112.2, 34.5]], h: [4.75, 5.85] },
    ],
  },
};
