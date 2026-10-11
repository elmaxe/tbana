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
  // panel between a pair of columns; `double`, two back to back along it; `wood`, their slats
  // wooden; `roof`, down the middle of one of `roofs` (its index) rather than of `roof`'s, over
  // another platform beside it; or several such rows
  benches?: Benches | Benches[];
  // glass shelters on the platform, from s[0] to s[1] and u[0] to u[1] across the line down its
  // middle, glazed along both sides and open at the ends, with a bench inside; out in the open,
  // a flat roof of their own
  shelters?: { s: [number, number]; u: [number, number]; roof?: boolean }[];
}

export interface Benches { at: number[]; across?: boolean; double?: boolean; wood?: boolean; roof?: number }

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
  // `cross[1]` deep (and the columns on up through it to the rafters over them); `ties`, steel
  // bars across between each pair at these heights, and one slanting from the lowest at one
  // column to the highest at the other
  columns: {
    every: number; at: number; size: number; plinth: { size: number; height: number }; pair?: number;
    between?: [number, number]; braces?: number; casings?: { at: number[]; size: [number, number] }; offset?: number;
    edges?: number; cross?: [number, number]; ties?: number[];
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
// `left`: the walls on the left (facing −u, looking along the platform) in this finish instead.
export interface Room {
  name: string;
  s: [number, number]; u?: [number, number]; h: [number, number];
  walls?: Finish | null; floor?: Finish | null; ceiling?: Finish; stairs?: Finish; left?: Finish;
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
  | 'ribbedMetal'   // pale ribbed sheet metal, a ceiling's
  | 'whiteBranches' // pale stone tiles on end, black branches spreading over them
  | 'darkBranches'  // dark grey slabs on end, staggered, here and there a black branch
  | 'basketTiles'   // white tiles in pairs, each pair turned from its neighbours
  | 'granite'       // rough granite blocks in courses, in pale mortar
  | 'whitePerforated' // white acoustic panels, finely perforated
  | 'roughcast'     // grey roughcast render
  | 'hallTiles'     // white tiles, windows in grey frames, white render, tall windows in black frames
  | 'glassFront'    // glass doors in brushed steel, the name's band, glass in steel frames above
  | 'greenTerrazzo' // dark green terrazzo with two thin dark red lines along it
  | 'squareTiles'   // white tiles, 15 cm, in grey joints
  | 'whiteRender'   // white render
  | 'bwTiles'       // tiles black, white and grey at random, 15 cm, some of them doubled upright
  | 'tealWindows'   // small teal tiles to a sill, windows in dark frames above, a concrete beam over them
  | 'greenGlazed'   // glazed above a kick panel in dark green steel frames, a handrail across at 1 m
  | 'greenFront'    // dark green steel panels to 2.95 m, windows in dark green frames above
  | 'greenDoors'    // glass doors in brushed steel under a green band, windows in dark green frames above
  | 'creamTiles'    // cream tiles, 15 cm, in pale grey joints
  | 'creamClerestory' // cream tiles to 2.95 m, windows in dark green frames above, white render over them
  | 'silverPerforated' // silver-grey sheet-metal panels, finely perforated, 1.2 by 3 m
  | 'libraryFront'  // shop fronts under a canopy, white panels, a band of windows between dark blue piers, white panels
  | 'libraryBack'   // as libraryFront, white panels in place of the shop fronts
  | 'libraryEntrance' // as libraryFront, glass doors in brushed steel under SL's dark blue band in place of the shop fronts
  | 'blackTiles'    // glossy black tiles, 15 cm, in pale grey joints
  | 'glassBlocks'   // glass blocks, 20 cm, pale green, in grey mortar
  | 'blueMosaic'    // a mosaic of small rectangles in greys, blues and white
  | 'warmMosaic'    // a mosaic of small rectangles in creams, browns, rust, teal and dark blue
  | 'brownWindows'; // small brown tiles to a sill, windows in dark frames above, a concrete beam over them

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

export type Art = Guardian | Stacks | Panels | Masts | Mural | Chairs | Roundel | GlassStacks | GlassPosts | Figure | FoolsShip | Cone | Growth | Ruler | Stone | Columns | Tulip | Bird | Rooflights;

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
// (`sign`, so high; SL's dark blue over a yellow stripe, `blue`). `arm`: the arm reaches this far
// each way (0.6 m by default); `lower`, a second, shorter arm with two small lamps, so high (or
// reaching only to the left, with one, `lowerOne`).
export interface Masts { kind: 'masts'; at: [number, number][]; height: number; color?: number; top?: boolean; sign?: number; blue?: boolean; arm?: number; lower?: number; lowerOne?: boolean }

// A picture on a wall, facing `turn` as a guardian does, its middle at s, u, from `bottom` to
// `top` and `width` across; drawn in code (src/textures.ts): the dragon of Tallkrogen's, or a
// mosaic of a forest's floor.
export interface Mural { kind: 'mural'; picture: 'tallkrogsdraken' | 'forestFloor'; s: number; u: number; turn: number; bottom: number; top: number; width: number }

// Two big armchairs and a low table between them, each built up of thick timbers, at s, u, the
// chairs facing each other across the table along `turn` (as a guardian's).
export interface Chairs { kind: 'chairs'; s: number; u: number; turn: number }

// The metro's round sign on a post on a roof at s, u, its middle `h` high and `size` across, its
// faces across the platform (or, `along`, along it); the post from `foot` up.
export interface Roundel { kind: 'roundel'; s: number; u: number; h: number; size: number; foot: number; along?: boolean }

// Stacks of green glass sheets, each tapering on all sides to a narrow ridge, `count` of them side
// by side along the platform with their middle at s, u, standing on the ground `foot` high, the
// tallest `height` high.
export interface GlassStacks { kind: 'glassStacks'; s: number; u: number; foot: number; height: number; count: number }

// Slabs of the same glass standing at the points, from `h[0]` to `h[1]` high, `size` along and
// across the platform.
export interface GlassPosts { kind: 'glassPosts'; at: [number, number][]; h: [number, number]; size: [number, number] }

// A human figure of polished aluminium, its surface crazed all over, at s, u (in the station's
// frame), `h` high, facing `turn` as a guardian does, `size` times a grown person's: `cling`,
// hanging on its back under a beam (its underside `h` high and along `turn`), gripping it with its
// hands over its head and its feet behind; `crouch`, squatting on its toes on a ledge `h` high,
// its knees wide and its hands down on the ledge between its feet, as if about to jump.
export interface Figure { kind: 'figure'; pose: 'cling' | 'crouch'; s: number; u: number; h: number; turn: number; size: number }

// A boat of concrete, its deck of setts, from its square stern to its bow `turn` as a guardian
// faces (at s, u, across from the line down the platform's middle); on a post of granite in it a
// granite slab along it, and on the slab five small figures of bronze in a row, four of them
// heads and shoulders, one sprawled.
export interface FoolsShip { kind: 'foolsShip'; s: number; u: number; turn: number }

// A tall cone of dark bronze, fluted all round and rounding to a point, on short feet at s, u
// (across from the line down the platform's middle), `height` high and `base` across at its foot.
export interface Cone { kind: 'cone'; s: number; u: number; height: number; base: number }

// A lamp of dark bronze grown like a tree: strands twisting round each other up out of roots
// spread over the ground, parting into branches that each hold a lamp, one of them high to the
// right and one lower to the left (looking `turn` as a guardian faces), a third in the trunk's
// twist; at s, u (in the station's frame), `height` high, inside a low guard of steel tubes.
export interface Growth { kind: 'growth'; s: number; u: number; height: number; turn: number }

// A folding ruler of copper, `width` across its broad faces and `thick` thick, its lengths from
// point to point ([s, u, h] in the station's frame, its middle) folded into each other at the
// points: each length's broad faces upright, or (by its index in `flat`) lying, facing up and
// down; brass at its two ends.
export interface Ruler { kind: 'ruler'; points: [number, number, number][]; width: number; thick: number; flat?: number[] }

// A block of pale limestone, rough-hewn, standing at s, u (in the station's frame), `size` along,
// across and high, turned `turn` (radians, as a guardian's) and leaning `lean` to its right.
export interface Stone { kind: 'stone'; s: number; u: number; size: [number, number, number]; turn: number; lean: number }

// Round columns at the points ([s, u]), `size` across, from `from` up to `to`, in `color`.
export interface Columns { kind: 'columns'; at: [number, number][]; from: number; to: number; size: number; color: number }

// A tulip of bronze, `height` high, at s, u (in the station's frame), in a ring of setts: from a
// broad leaf on its foot, patinated green, rising behind it and twisting, its stem climbs, leaning
// `turn` (radians, as a guardian's) and nodding forward at its top, to a flower lacquered red.
export interface Tulip { kind: 'tulip'; s: number; u: number; height: number; turn: number }

// A bird of dark bronze on a square post, `height` high, at s, u (in the station's frame): from a
// knot on the post's top seven lobes reach out, each a narrow neck swelling to a flattened, rounded
// club, two long ones out to the sides, two up, two hanging and one back; facing `turn` (radians,
// as a guardian's).
export interface Bird { kind: 'bird'; s: number; u: number; height: number; turn: number }

// Round rooflights in a flat roof at the points ([s, u], in the station's frame), `size` across: in
// the ceiling, `ceiling` high, a disc of daylight in a white rim; on the roof, `top` high, a pale
// dome on a low curb.
export interface Rooflights { kind: 'rooflights'; at: [number, number][]; size: number; ceiling: number; top: number }

// A fence through the points ([s, u]), from `h[0]` to `h[1]` high: chain-link on posts; or
// boards, standing side by side (`color`), or slanting between concrete posts (`louvres`); or
// panes of glass in steel frames (`glass`), on most of them a leaf drawn in white (`leaves`).
export interface Fence { points: [number, number][]; h: [number, number]; kind?: 'chainLink' | 'boards' | 'louvres' | 'glass'; color?: number; leaves?: boolean }

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

  // Enskede gård (9 September 1951, where the Örbybanan tram had run since 1930; due to close
  // around 2032): an island platform on the bank between Palmfeltsvägen and the park along
  // Odelbergsvägen, its tracks parting towards its north end. The laser scan puts a butterfly
  // roof over the whole platform, from 66.5 m south of its middle to 71.8 m north, widening with
  // it from 7.3 m to 9.3 m, its top 3.6 m to 3.9 m over the platform along the valley and about
  // 0.3 m higher at the edges. Photographs (2018) show it boarded white underneath, the boards
  // along the platform, on white rafters, with a pale fascia; down the middle, frames of black
  // steel every 6.5 m or so, each two columns 1 m apart across the platform, on concrete plinths,
  // under a black beam each, tied by a bar near the foot and one near the top and a brace
  // slanting between them (photographs from 2006 show the same frames red); long round lights
  // along both edges, SL's blue name signs with the way out to the north, a clock, departure
  // boards and double benches of slats. The paving: a pale band along each edge, a dark ribbed
  // strip for the blind, then dark grey pavers in a running bond.
  //
  // At the north end the platform runs on into a glass stair house between the tracks
  // (OpenStreetMap's outline; laser scan: its flat roof 3.45 m over the platform, from 71.8 m to
  // 94.5 m north, and a lift's tower at its far end 1.4 m higher), framed in black, with a dark
  // stone floor and a dark ceiling: on its west side a walkway at the platform's level out to the
  // lift, behind a glass balustrade; on its east side stairs down, between walls of pale stone
  // tiles with black branches spreading over them, to the ticket hall in the bank, 3.75 m down
  // (OpenStreetMap's indoor mapping: the stairs from 77.5 m to 90.2 m north, the lift at 93.5 m,
  // the gates at 94.2 m, the hall's door at 97.3 m). The hall: dark terrazzo, walls of dark grey
  // slabs on end with a few black branches on them too, round lamps in a pale ceiling, the gates
  // and a booth. Its door opens into the footway's underpass under the tracks, lined in white
  // tiles and paved in grey slabs, under a concrete ceiling; its ends in the bank's concrete
  // faces, SL's blue band with the station's name over each, between retaining walls of rough
  // granite. It comes out to the west into the park, a path on to Odelbergsvägen, and to the
  // east onto a small square, from which a ramp and steps climb to Palmfeltsvägen.
  //
  // Maria Miesenberger's Ögonblick i rörelse (2012): figures of polished aluminium, crazed all
  // over, one clinging under one of the roof's beams over the platform's northern half (where
  // along it is inferred), one crouching on the ledge over the foot of the stairs, as if about to
  // jump down them.
  //
  // Chain-link fences beyond both tracks, along the top of the bank and over the underpass's ends.
  'Enskede gård': {
    roof: {
      kind: 'butterfly',
      from: -66.5, to: 71.8, width: 9,
      shape: [[-66.5, -1.15, 7.3], [-60, -1.1, 7.5], [-40, -0.9, 7.9], [-20, -0.5, 8.4], [0, -0.05, 8.9], [20, 0.15, 8.9],
        [40, 0.25, 9.3], [60, 0.1, 9.2], [71.8, 0, 9.2]],
      middle: 3.5, edge: 3.8, thick: 0.22, fascia: 0.3,
      rafters: 1.3, rafterSize: [0.08, 0.22],
      beam: 0.3,
      columns: { every: 6.5, at: 26, size: 0.14, plinth: { size: 0.4, height: 0.2 }, pair: 1.0, ties: [1.0, 2.35] },
      lamps: { offset: 3.2, length: 1.6, every: 1.6, tube: true },
      colors: { underside: 0xf2f2ee, fascia: 0xe2e3e0, top: 0x5f6365, steel: 0x1f2123 },
      signs: { at: [-42.25, -9.75, 22.75, 55.25], back: '', ahead: 'Utgång', bottom: 2.45, blue: true },
      clocks: [[24, -1.6]],
      boards: [
        { s: 61.75, u: -1.6, toward: 'Hässelby strand', trains: ['19 Hässelby strand  4 min', '19 Hässelby strand  14 min'] },
        { s: 61.75, u: 1.6, toward: 'Hagsätra', trains: ['19 Hagsätra  6 min', '19 Hagsätra  16 min'] },
      ],
    },
    paving: {
      edge: 0.5, tactile: [0.5, 0.85], slabs: 0.85, paverSize: [0.4, 0.3], mix: 0.12,
      colors: { edge: 0xc8c7c2, tactile: 0x5e6063, slab: 0x5e6063, pavers: 0x56595d, paler: 0x66696d, face: 0x8e8b85 },
      pattern: 'bond',
    },
    rooms: [
      { name: "platform's north end", s: [66, 71.8], h: [-0.5, 1], walls: null, floor: 'darkStone' },
      // (the glass stair house's: walls beside the stairs up to the walkway's level, the glass over
      // them)
      { name: 'stair house', s: [71.8, 90.2], h: [-4.5, 1], walls: 'whiteBranches', floor: 'darkStone', ceiling: 'perforated', stairs: 'whiteBranches', sill: 0 },
      { name: 'ticket hall', s: [90.2, 97.2], h: [-4.5, -3], walls: 'darkBranches', floor: 'darkStone', ceiling: 'boardConcrete' },
      { name: 'west of the underpass', s: [95, 107], u: [-30, 3.4], h: [-5, -2], walls: null, floor: 'asphalt' },
      { name: 'east of the underpass', s: [92, 106], u: [17.0, 30], h: [-5, -2], walls: null, floor: 'asphalt' },
      { name: 'underpass', s: [95, 107], h: [-5, -3], walls: 'basketTiles', floor: 'pavers', ceiling: 'boardConcrete' },
    ],
    blocks: [
      // between the tracks, kept 2 m off them, open to the platform
      { name: 'stair house', plan: [[71.8, 2.83], [94.6, 6.59], [94.6, 11.35], [71.8, 7.59]], h: [-1.0, 3.15], walls: 'darkGlazed',
        sides: [undefined, undefined, undefined, null], eaves: [0.4, 0.3, 0.4, 0], floor: 'darkStone', ceiling: 'perforated', roof: 0.3, onPlatform: true },
      // the underpass's ends: a notch in the bank, the face over the way through and granite walls
      // either side, falling with the bank (the underpass runs across the stair house's line)
      { name: 'west end of the underpass', plan: [[97.33, 3.02], [98.63, -4.87], [104.55, -3.89], [103.25, 4.0]], h: [-4.3, -1.15], from: -3.8, low: -3.2,
        walls: 'granite', sides: [undefined, null, undefined, 'boardConcrete'], floor: 'asphalt',
        nameSign: { side: 3, at: 0.5, length: 4.4, bottom: -1.7, inside: true }, onPlatform: true, ground: true },
      { name: 'east end of the underpass', plan: [[95.11, 16.44], [94.13, 22.36], [102.03, 23.66], [103.0, 17.74]], h: [-4.3, -1.15], from: -3.8, low: -3.0,
        walls: 'granite', sides: [undefined, null, undefined, 'boardConcrete'], floor: 'asphalt',
        nameSign: { side: 3, at: 0.625, length: 4.4, bottom: -1.7, inside: true }, onPlatform: true, ground: true },
      // (the bank between the tracks, over the hall and the underpass, where neither the street nor
      // the ground runs on; nor the street just beyond the underpass's walls, which isn't to be
      // stepped onto through them)
      { name: 'bank over the hall', plan: [[90.0, 6.01], [97.0, 7.17], [97.0, 12.97], [90.0, 11.81]], h: [-3.8, -1.0], from: -3.8, walls: 'boardConcrete',
        sides: [undefined, null, undefined, null], roof: 0.05, roofColor: 0x5b6e44, ground: true },
      { name: 'bank over the underpass', plan: [[98.32, 3.19], [96.1, 16.6], [100.05, 17.26], [102.26, 3.84]], h: [-3.8, -1.0], from: -3.8, walls: 'boardConcrete',
        sides: [null, null, null, null], roof: 0.05, roofColor: 0x5b6e44, onPlatform: true, ground: true },
      { name: 'street under the bank', plan: [[96.34, 2.86], [94.13, 16.28], [102.02, 17.58], [104.24, 4.16]], h: [-4.3, -1.8], from: -4.3, walls: 'boardConcrete',
        sides: [null, null, null, null] },
    ],
    buildings: ['w114113999'],
    art: [
      { kind: 'figure', pose: 'cling', s: 27.5, u: 1.29, h: 3.23, turn: 0, size: 1 },
      { kind: 'figure', pose: 'crouch', s: 90.45, u: 9.49, h: 0, turn: Math.PI, size: 1 },
      // on the bank beyond the stair house's far end
      { kind: 'roundel', s: 95.3, u: 11.2, h: 4.3, size: 0.8, foot: -1.1 },
    ],
    benches: { at: [-32.5, 0, 32.5], double: true },
    // 2.7 m beyond each track, and along the top of the underpass's faces
    fences: [
      { points: [[-90, -7.0], [-80, -7.2], [-60, -7.45], [-40, -7.7], [-20, -7.9], [0, -8.1], [20, -7.9], [40, -6.8], [60, -4.8], [70, -3.4], [80, -1.7],
        [90, 0.4], [95, 1.65], [97.31, 3.12], [103.23, 4.1], [106, 4.7], [110, 5.9], [120, 9.1]], h: [-1.1, 1.4] },
      { points: [[-90, 6.75], [-80, 6.9], [-60, 7.2], [-40, 7.5], [-20, 7.8], [0, 8.1], [20, 8.7], [40, 9.8], [60, 11.5], [70, 12.7], [80, 14.2],
        [90, 15.9], [95.13, 16.34], [103.02, 17.65], [106, 19.5], [110, 20.5], [120, 23.4]], h: [-1.1, 1.4] },
    ],
  },

  // Sockenplan (9 September 1951, where the Örbybanan tram had stopped at Enskedefältet since
  // 1930): an island platform on the bank west of Sockenvägen, curving towards its south end,
  // under the same roof as Enskede gård's over its northern half. The laser scan puts it from
  // 7.5 m to 73 m north of the platform's middle, 8.75 m wide, its top 4.2 m over the platform
  // along the valley and 0.25 m higher at the edges. Photographs (2018) show it boarded white on
  // white rafters, with frames of dark grey steel down the middle, each two columns across the
  // platform on concrete plinths under a beam each, tied by bars and a slanting brace; round
  // lights along its edges, departure boards and clocks hung from it (Hässelby strand's on the
  // western half, over the track its trains run on, on the left; Hagsätra's on the eastern),
  // double benches of slats beside the frames.
  // Beyond it, galvanised lamp posts with three dome lamps down the middle (the laser scan: about
  // every 15 m, 5.1 m high; some with SL's blue name sign) and a glass shelter. The paving: a pale
  // band along each edge, a grey ribbed strip, then grey pavers in a running bond.
  //
  // Sture Collin's Dårarnas båt (1990) stands on the platform just south of the roof: a boat of
  // concrete, its deck of setts, and on a granite post in it a granite slab with five small
  // bronze figures in a row.
  //
  // At its north end the platform runs into a glass stair house between the tracks (the laser
  // scan: from 73.5 m to 91 m north, about 5 m wide, its roof falling from 5.3 m over the
  // platform to 3.9 m), framed in black, with a ceiling of white perforated panels and a dark
  // floor: on its west side a walkway on the platform's level, behind a glass balustrade, out to
  // a lift in a glass shaft; on its east side stairs down between dark grey tiles, 5 m to the
  // ticket hall at the street (OpenStreetMap's indoor mapping: the stairs from 76 m to 89 m
  // north, the lift at 88 m, the gates at 93 m). The hall stands under the tracks' two bridges
  // over the square, rising between them (the laser scan: its roof 1.2 m to 1.8 m over the
  // platform, to 101 m north): dark stone floor, white tiles below a row of windows in grey
  // frames, the bridges' edges boxed in white over them and tall windows in black frames at the
  // top, white perforated ceilings, the gates (the booth beside them isn't drawn). The network's
  // decks lie lower than the real ones (its platform is about 0.9 m under the laser scan's) and
  // closer together, so the tiles and windows are drawn lower, and the lift and the stairs
  // squeezed into the gap. Its doors open north under a glass canopy onto a paved square: a
  // front of glass in brushed steel under SL's blue band with the station's name, between walls
  // of grey roughcast under the bridges.
  //
  // Chain-link fences beyond both tracks.
  'Sockenplan': {
    roof: {
      kind: 'butterfly',
      from: 7.5, to: 73.4, width: 8.75, offset: -0.3,
      middle: 3.4, edge: 3.65, thick: 0.22, fascia: 0.3,
      rafters: 1.3, rafterSize: [0.08, 0.22],
      beam: 0.3,
      columns: { every: 6.5, at: 11, size: 0.14, plinth: { size: 0.4, height: 0.2 }, pair: 1.2, ties: [1.0, 2.35] },
      lamps: { offset: 3.4, length: 1.6, every: 1.6, tube: true },
      colors: { underside: 0xf2f2ee, fascia: 0xe6e6e2, top: 0x5a5e60, steel: 0x2a2d30 },
      signs: { at: [], back: '', ahead: 'Utgång', blue: true },
      clocks: [[34.5, -3.2], [31, 3.2]],
      boards: [
        { s: 34.5, u: -1.6, toward: 'Hässelby strand', trains: ['19 Hässelby strand  3 min', '19 Hässelby strand  13 min'] },
        { s: 31, u: 1.6, toward: 'Hagsätra', trains: ['19 Hagsätra  5 min', '19 Hagsätra  15 min'] },
      ],
    },
    paving: {
      edge: 0.6, tactile: [0.6, 0.95], slabs: 0.95, paverSize: [0.3, 0.2], mix: 0.3,
      colors: { edge: 0xcdcac2, tactile: 0x8a8c8c, slab: 0x6b6e72, pavers: 0x6b6e72, paler: 0x7e8185, face: 0x8e8b85 },
      pattern: 'bond',
    },
    rooms: [
      { name: "platform's north end", s: [66, 73.5], h: [-0.5, 1], walls: null, floor: null },
      // (the glass stair house's: walls beside the stairs up to the walkway's level, the glass over
      // them)
      { name: 'stair house', s: [73.5, 89.6], h: [-5.2, 1], walls: 'darkTiles', floor: 'darkStone', ceiling: 'whitePerforated', stairs: 'darkTiles', sill: 0 },
      // (the hall's walls are its shell's)
      { name: 'ticket hall', s: [88.5, 101.4], h: [-5.6, -4.5], walls: 'hallTiles', floor: 'darkStone', ceiling: 'whitePerforated', sill: -5.0 },
      { name: 'square', s: [101.4, 106], h: [-5.6, -4.5], walls: null, floor: 'greyTiles' },
    ],
    blocks: [
      // between the tracks, kept 2 m off them, open to the platform and to the hall;
      // roughcast below the platform's level, where it stands under the bridges
      { name: 'stair house', plan: [[73.5, -1.5], [91, -1.3], [91, 3.5], [73.5, 3.5]], h: [-5.3, 5.3], from: -5.05, low: 3.9,
        walls: 'roughcast', band: { walls: 'darkGlazed', from: 0 }, sides: [undefined, null, undefined, null],
        floor: 'darkStone', ceiling: 'whitePerforated', roof: 0.3, onPlatform: true, ground: true },
      // its glazed gables, over the platform's roof and over the hall's
      { name: "stair house's south gable", plan: [[73.4, -1.5], [73.6, -1.5], [73.6, 3.5], [73.4, 3.5]], h: [3.3, 5.3], from: 3.3, walls: 'darkGlazed', roof: 0.3 },
      { name: "stair house's north gable", plan: [[90.9, -1.3], [91.1, -1.3], [91.1, 3.5], [90.9, 3.5]], h: [1.4, 3.9], from: 1.4, walls: 'whitePanels', roof: 0.3 },
      // (and where it is wider than the hall, beside the western bridge)
      { name: "stair house's north end", plan: [[90.9, -1.3], [91.1, -1.3], [91.1, -0.95], [90.9, -0.95]], h: [-2.62, 1.4], from: -2.62, walls: 'whitePanels', roof: 0 },
      // the hall, rising between the bridges, its doors to the north
      { name: 'ticket hall', plan: [[91, -0.95], [101.3, -0.3], [101.3, 3.1], [91, 3.5]], h: [-5.3, 1.8], from: -5.05, low: 1.2,
        walls: 'hallTiles', sides: [undefined, 'glassFront', undefined, null], ceiling: 'whitePerforated', roof: 0.25, roofColor: 0x8a8f92,
        nameSign: { side: 1, at: 0.5, length: 2.8, bottom: -2.65 }, ground: true },
      // its rooms either side, under the bridges, their windows in a row with the hall's
      { name: "hall's west side", plan: [[91, -3.0], [101.3, -3.0], [101.3, -0.3], [91, -0.95]], h: [-5.3, -2.62], from: -5.05,
        walls: 'roughcast', band: { walls: 'hallTiles', from: -3.49 }, sides: [undefined, undefined, null, undefined], roof: 0.02, ground: true },
      { name: "hall's east side", plan: [[91, 3.5], [101.3, 3.1], [101.3, 4.8], [91, 4.8]], h: [-5.3, -2.62], from: -5.05,
        walls: 'roughcast', band: { walls: 'hallTiles', from: -3.49 }, sides: [null, undefined, undefined, undefined], roof: 0.02, ground: true },
      // the bridges' edges over the hall and the lower part of the house, boxed in white (the
      // network's decks, 2.85 m either side of each track, reach 0.2 m to 0.5 m in over them)
      { name: "western bridge's edge, in the house", plan: [[82.2, -1.45], [91, -1.35], [91, -0.565], [82.2, -0.94]], h: [-2.77, -2.77], from: -2.77,
        walls: 'whitePanels', sides: [null, null, null, null], roof: 1.5, roofColor: 0xe9e9e5 },
      { name: "western bridge's edge, in the hall", plan: [[91, -1.0], [101.25, -0.35], [101.25, -0.09], [91, -0.565]], h: [-2.77, -2.77], from: -2.77,
        walls: 'whitePanels', sides: [null, null, null, null], roof: 1.5, roofColor: 0xe9e9e5 },
      { name: "eastern bridge's edge, in the house", plan: [[83.5, 3.17], [91, 3.04], [91, 3.55], [83.5, 3.55]], h: [-2.77, -2.77], from: -2.77,
        walls: 'whitePanels', sides: [null, null, null, null], roof: 1.5, roofColor: 0xe9e9e5 },
      { name: "eastern bridge's edge, in the hall", plan: [[91, 3.04], [101.25, 2.84], [101.25, 3.15], [91, 3.55]], h: [-2.77, -2.77], from: -2.77,
        walls: 'whitePanels', sides: [null, null, null, null], roof: 1.5, roofColor: 0xe9e9e5 },
      // the glass canopy over the doors, between the bridges
      { name: 'canopy', plan: [[101.3, 0.05], [103.5, 0.05], [103.5, 2.7], [101.3, 2.7]], h: [-1.9, -1.85], from: -1.9,
        walls: 'glassFront', sides: [null, null, null, null], roof: 0.05, roofColor: 0xc4cfd0 },
      // the square paved in front of the doors, on the hall's level (the city's ground, from a 4 m
      // grid, lies up to 0.2 m higher here, sloping away: a granite kerb up to it)
      { name: 'square', plan: [[101.3, -2.5], [106, -2.5], [106, 5.5], [101.3, 5.5]], h: [-5.03, -4.85], from: -5.03, low: -4.97,
        walls: 'granite', sides: [undefined, undefined, undefined, null], floor: 'greyTiles' },
      // (the ground cut away under it)
      { name: "square's ground", plan: [[101.3, -2.5], [106, -2.5], [106, 5.5], [101.3, 5.5]], h: [-4.5, -4.5], from: -5.03,
        walls: 'granite', sides: [null, null, null, null], ground: true },
    ],
    buildings: ['w114114819'],
    art: [
      { kind: 'foolsShip', s: 3, u: -0.45, turn: 0 },
      { kind: 'masts', height: 5.1, color: 0x9a9fa3, arm: 1.0, at: [[6.5, 0.0], [-18.8, 0.2], [-35, 0.9], [-66, 3.8]] },
      { kind: 'masts', height: 5.1, color: 0x9a9fa3, arm: 1.0, sign: 2.6, blue: true, at: [[-5, -0.1], [-50.5, 2.0]] },
    ],
    benches: { at: [15.9, 28.9, 41.9, 54.9, -27, -45], double: true, wood: true },
    shelters: [{ s: [-14.4, -8.7], u: [-0.8, 1.5], roof: true }],
    // 3.2 m beyond each track
    fences: [
      { points: [[-90, 0.5], [-80, -1.6], [-70, -3.4], [-60, -4.9], [-50, -6.2], [-40, -7.2], [-30, -8.1], [-20, -8.7], [-10, -9.0], [0, -9.2],
        [10, -9.1], [20, -8.9], [30, -8.7], [40, -8.4], [50, -8.1], [60, -7.7], [70, -7.4], [80, -7.1]], h: [-1.1, 1.0] },
      { points: [[-90, 15.2], [-80, 13.7], [-70, 12.5], [-60, 11.5], [-50, 10.7], [-40, 10.1], [-30, 9.6], [-20, 9.4], [-10, 9.2], [0, 9.2],
        [10, 9.2], [20, 9.2], [30, 9.3], [40, 9.3], [50, 9.4], [60, 9.4], [70, 9.4], [80, 9.3]], h: [-1.1, 1.0] },
    ],
  },

  // Svedmyra (9 September 1951, where the Örbybanan tram had stopped since 1930): an island
  // platform on a bank at its south end and, from its middle north, on a concrete viaduct over the
  // street, under a butterfly roof. The laser scan puts the roof from 52 m south of the platform's
  // middle to 40 m north, about 8.3 m wide, its top 3.3 m over the platform at the valley and
  // 3.6 m at the edges. Photographs (2009 to 2024) show its underside boarded pale on rafters,
  // a dark fascia, dark steel columns down the middle on concrete plinths, about 10.5 m apart,
  // with knee braces up to a beam along the valley; strip lights either side of the beam,
  // departure boards hung from it (Hässelby strand's over the western half, over the track its
  // trains run on, on the left; Hagsätra's over the eastern), double benches of slats by the
  // columns. Beyond the roof, galvanised lamp posts down the middle (some with SL's blue name
  // sign) and a glass shelter at the south end. The network's track runs about 2 m east of the
  // laser scan's here, so the roof follows the middle between its tracks rather than the
  // platform's line, and the station's parts keep to the tracks rather than to the scan.
  //
  // Along the viaduct the tracks have screens of glass in steel frames, on the western side with
  // a leaf drawn on most panes; chain-link fences beyond them along the bank. On the platform
  // north of the roof stands Torgny Larsson's bronze (1991), a tall fluted cone rounding to its
  // point on short feet.
  //
  // Two long flights of stairs go down from the platform, one from its south half and one from
  // under the roof's north end, and a lift from its middle (its head up through the roof), to
  // the ticket hall under the viaduct at the street (OpenStreetMap's indoor mapping: the flights
  // from 14 m south and from 38 m north, the lift at 14 m north, the gates at 7 m). The hall:
  // a floor of green terrazzo with dark red lines, walls of small white tiles, a white perforated
  // ceiling, and along its west wall a mosaic of a forest's floor (moss, needles, stones, cones
  // and twigs). Outside it is rendered white. From the gates a passage runs east under the
  // eastern track into the low entrance building at the foot of the viaduct (the laser scan: its
  // roof 2.3 m to 3 m under the platform, from 4 m south to 12 m north), its doors in a glass
  // front under SL's blue band, a kiosk beside them, and over both a canopy curving down at its
  // edge on thin dark posts, onto a paved square; the bank's foot is held by a granite kerb.
  'Svedmyra': {
    roof: {
      kind: 'butterfly',
      from: -52, to: 40, width: 8.3,
      // (the middle between the network's tracks, which curve apart from the platform's line
      // towards the south)
      shape: [[-70, 2.11, 8.3], [-60, 1.64, 8.3], [-50, 1.21, 8.3], [-40, 0.87, 8.3], [-30, 0.62, 8.3], [-20, 0.42, 8.3],
        [-10, 0.25, 8.3], [0, 0.07, 8.3], [10, -0.1, 8.3], [20, -0.21, 8.3], [30, -0.2, 8.3], [40, -0.06, 8.3]],
      middle: 3.1, edge: 3.35, thick: 0.2, fascia: 0.3,
      rafters: 1.0,
      beam: 0.3,
      columns: { every: 10.5, at: -4.5, size: 0.3, plinth: { size: 0.45, height: 0.25 }, braces: 1.2 },
      lamps: { offset: 2.5, length: 1.5, every: 3 },
      colors: { underside: 0xe6e2d8, fascia: 0x2b2d30, top: 0x4a4e52, steel: 0x26282b },
      signs: { at: [], back: '', ahead: 'Utgång', blue: true },
      boards: [
        { s: 33, u: -1.6, toward: 'Hässelby strand', trains: ['19 Hässelby strand  4 min', '19 Hässelby strand  14 min'] },
        { s: 22, u: 1.6, toward: 'Hagsätra', trains: ['19 Hagsätra  6 min', '19 Hagsätra  16 min'] },
      ],
    },
    paving: {
      edge: 0.6, tactile: [0.6, 0.95], slabs: 0.95, paverSize: [0.6, 0.4], mix: 0.25,
      colors: { edge: 0xcdcac2, tactile: 0x8a8c8c, slab: 0x707377, pavers: 0x707377, paler: 0x83868a, face: 0x8e8b85 },
      pattern: 'bond',
    },
    rooms: [
      { name: "lift's landing", s: [9.5, 13], h: [-0.5, 1], walls: null, floor: null },
      { name: 'south stairs', s: [-14, -2.1], h: [-6.5, 0.5], walls: 'squareTiles', floor: 'greenTerrazzo', ceiling: 'whitePerforated', stairs: 'squareTiles' },
      { name: 'north stairs', s: [29, 39], h: [-6.5, 0.5], walls: 'squareTiles', floor: 'greenTerrazzo', ceiling: 'whitePerforated', stairs: 'squareTiles' },
      // (the hall's walls and ceiling are its shell's)
      { name: 'ticket hall', s: [-2.2, 28.4], u: [-5, 1.9], h: [-6.5, -5.5], walls: 'squareTiles', floor: 'greenTerrazzo', ceiling: 'whitePerforated', sill: -6.16 },
      { name: 'passage', s: [3, 12], u: [1.9, 11.25], h: [-6.5, -5.5], walls: 'squareTiles', floor: 'greenTerrazzo', ceiling: 'whitePerforated', sill: -6.16 },
      { name: 'square', s: [3, 12], u: [11.25, 20], h: [-7, -5.5], walls: null, floor: 'pavers' },
    ],
    blocks: [
      // the hall under the viaduct, between the tracks, white outside
      { name: 'ticket hall', plan: [[-2.1, -4.75], [28.3, -4.75], [28.3, 1.85], [-2.1, 1.85]], h: [-6.15, -3.0], from: -6.15,
        walls: 'squareTiles', ceiling: 'whitePerforated', roof: 0.3, ground: true, onPlatform: true },
      { name: "hall's west side", plan: [[-2.12, -4.87], [28.42, -4.87], [28.42, -4.77], [-2.12, -4.77]], h: [-6.15, -2.7], from: -6.15, walls: 'whiteRender' },
      { name: "hall's north side", plan: [[28.32, -4.87], [28.42, -4.87], [28.42, 1.97], [28.32, 1.97]], h: [-6.15, -2.7], from: -6.15, walls: 'whiteRender' },
      { name: "hall's east side", plan: [[12.02, 1.87], [28.42, 1.87], [28.42, 1.97], [12.02, 1.97]], h: [-6.15, -2.7], from: -6.15, walls: 'whiteRender' },
      // where the bank ends and the viaduct begins
      { name: 'abutment', plan: [[-2.25, -10.5], [-2.12, -10.5], [-2.12, 1.97], [-2.25, 1.97]], h: [-6.15, -2.7], from: -6.15, walls: 'boardConcrete' },
      // the north flight's well, out under the viaduct beyond the hall
      { name: 'north stairwell', plan: [[28.32, -4.43], [38.7, -5.11], [38.7, -2.87], [28.32, -2.19]], h: [-6.15, -2.65], from: -6.15,
        walls: 'whiteRender', sides: [undefined, undefined, undefined, null] },
      // the entrance building: the kiosk, and the doors east onto the square
      { name: 'kiosk', plan: [[-3, 1.9], [3, 1.9], [3, 11], [-3, 11]], h: [-6.15, -2.95], from: -6.15,
        walls: 'whiteRender', sides: [undefined, 'shopWindows', 'shopWindows', undefined], floor: 'greyTiles', ceiling: 'whitePerforated', roof: 0.3,
        ground: true, onPlatform: true },
      { name: 'entrance', plan: [[3, 1.9], [12, 1.9], [12, 11], [3, 11]], h: [-6.15, -2.95], from: -6.15,
        walls: 'whiteRender', sides: [null, undefined, 'glassFront', null], floor: 'greenTerrazzo', ceiling: 'whitePerforated', roof: 0.3,
        nameSign: { side: 2, at: 0.5, length: 2.6, bottom: -3.72 }, ground: true, onPlatform: true },
      // the canopy over its front, curving down at its edge (a quarter of an ellipse, in four)
      { name: 'canopy 1', plan: [[12, 11.0], [12, 12.07], [-3, 12.07], [-3, 11.0]], h: [-2.65, -2.65], from: -2.65, low: -2.73,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'whitePanels', roof: 0.12, roofColor: 0x3a3d40 },
      { name: 'canopy 2', plan: [[12, 12.07], [12, 12.98], [-3, 12.98], [-3, 12.07]], h: [-2.73, -2.73], from: -2.73, low: -2.94,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'whitePanels', roof: 0.12, roofColor: 0x3a3d40 },
      { name: 'canopy 3', plan: [[12, 12.98], [12, 13.59], [-3, 13.59], [-3, 12.98]], h: [-2.94, -2.94], from: -2.94, low: -3.27,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'whitePanels', roof: 0.12, roofColor: 0x3a3d40 },
      { name: 'canopy 4', plan: [[12, 13.59], [12, 13.8], [-3, 13.8], [-3, 13.59]], h: [-3.27, -3.27], from: -3.27, low: -3.65,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'whitePanels', roof: 0.12, roofColor: 0x3a3d40 },
      { name: "canopy's edge", plan: [[-3, 13.78], [12, 13.78], [12, 13.86], [-3, 13.86]], h: [-3.95, -3.6], from: -3.95, walls: 'greyPanels', roof: 0.02, roofColor: 0x3a3d40 },
      ...[-2.6, 1.5, 4.6, 9.4, 11.6].map((s): Block => (
        { name: 'canopy post', plan: [[s - 0.05, 13.6], [s + 0.05, 13.6], [s + 0.05, 13.7], [s - 0.05, 13.7]], h: [-6.15, -3.55], from: -6.15, walls: 'greyPanels' })),
      // the square paved in front of it, on the hall's level (the city's ground, from a 4 m grid,
      // has the bank and the building in it: cut away, and a granite kerb up to the bank's foot)
      { name: 'square', plan: [[-3, 11], [-3, 19.5], [16, 19.5], [16, 11]], h: [-6.2, -2.4], from: -6.2, low: -6.0,
        walls: 'granite', sides: [undefined, null, null, null], floor: 'pavers' },
      { name: "square's ground", plan: [[-3, 11], [-3, 19.5], [16, 19.5], [16, 11]], h: [-2.7, -2.7], from: -6.2,
        walls: 'granite', sides: [null, null, null, null], ground: true, onPlatform: true },
      // and north of the building under the viaduct, and west of the hall
      { name: 'under the viaduct, east', plan: [[12, 1.97], [20, 1.97], [20, 11], [12, 11]], h: [-2.7, -2.7], from: -6.2,
        walls: 'granite', sides: [null, null, null, null], floor: 'pavers', ground: true },
      { name: 'under the viaduct, west', plan: [[-2.1, -10.5], [28.4, -10.5], [28.4, -4.87], [-2.1, -4.87]], h: [-2.7, -2.7], from: -6.15,
        walls: 'asphalt', sides: [null, null, null, null], floor: 'asphalt', ground: true },
      // glass round the stairs' openings in the platform, open at their tops
      { name: "south stairs' glass", plan: [[-5.2, -2.57], [-14.1, -2.57], [-14.1, -0.33], [-5.2, -0.33]], h: [0, 2.2],
        walls: 'darkGlazed', sides: [undefined, null, undefined, undefined] },
      { name: "north stairs' glass", plan: [[38.6, -5.07], [29.6, -4.52], [29.6, -2.28], [38.6, -2.83]], h: [0, 2.2],
        walls: 'darkGlazed', sides: [undefined, undefined, undefined, null] },
    ],
    art: [
      { kind: 'mural', picture: 'forestFloor', s: 7.5, u: -4.75, turn: Math.PI / 2, bottom: -6.07, top: -3.05, width: 13 },
      { kind: 'cone', s: 45, u: -1.6, height: 2.9, base: 0.6 },
      { kind: 'masts', height: 5.1, color: 0x9a9fa3, arm: 1.0, at: [[-58, -2.85], [-66, -3.6], [47, -3.5], [55, -4.6], [63, -6.0]] },
      { kind: 'masts', height: 5.1, color: 0x9a9fa3, arm: 1.0, sign: 2.6, blue: true, at: [[-62, -3.2], [51, -4.0]] },
    ],
    benches: { at: [-46.5, -36, -25.5, 6, 16.5], double: true, wood: true },
    shelters: [{ s: [-64, -59], u: [-1, 1.2], roof: true }],
    // glass screens along the viaduct, 2.8 m beyond each track, on its decks' edges; chain-link
    // along the bank, 3.4 m beyond
    fences: [
      { points: [[-90, -12.9], [-80, -12.2], [-70, -11.6], [-60, -11.0], [-50, -10.5], [-40, -10.0], [-30, -9.6], [-20, -9.4], [-10, -9.3]], h: [-1.6, 0.3] },
      { points: [[-10, -8.7], [0, -8.9], [10, -9.4], [20, -10.1], [30, -10.9], [40, -11.8], [50, -12.8], [60, -14.0], [65, -14.7]], h: [-1.6, 0.9], kind: 'glass', leaves: true },
      { points: [[-90, 0.3], [-80, 1.9], [-70, 3.5], [-60, 5.0], [-50, 6.4], [-40, 7.5], [-30, 8.4]], h: [-1.6, 0.3] },
      { points: [[-30, 7.8], [-20, 8.4], [-10, 8.8], [0, 8.9], [10, 8.8], [20, 8.4], [30, 7.6], [40, 6.5], [50, 5.0], [60, 3.1], [70, 0.9]], h: [-1.6, 0.9], kind: 'glass' },
    ],
  },

  // Stureby (1 October 1953, where the tram had stopped since 1930): an island platform on a low
  // bank, under a butterfly roof like Svedmyra's, entered only from its west end (Swedish
  // Wikipedia). Lantmäteriet's laser scan puts the roof from 74 m west of the platform's middle to
  // 29 m east, about 7.8 m wide, its top 3.4 m over the platform at the valley and 3.7 m at the
  // edges. Photographs (2008 to 2018) show it boarded white on white rafters, with a thin dark
  // fascia, dark steel columns down the middle (at its east end a broad one on a concrete block),
  // strip lights either side of the beam, SL's blue name signs and older black ones, departure
  // boards and a clock hung under it; slabs of grey concrete in bond, a pale edge and a ribbed
  // strip; chain-link fences beyond both tracks along the streets. Out on the open platform
  // stands Carin Ellberg's Främmande växtlighet (2012), a lamp of bronze grown like a tree (the
  // laser scan: its lamps 2.9 m up, 67 m east), and galvanised lamp posts, one with the blue sign.
  //
  // At its west end the platform narrows to a glass stair house (the laser scan: 12.5 m long, 5 m
  // wide, its roof 3 m up; the lift's tower at its west end 4.2 m, the T on its corner), a flight
  // down along its south side, a walkway with a wooden bench along its north side to the lift.
  // West of it the line runs on a concrete deck 14 m wide over the ticket hall and a footway
  // through under the tracks (OpenStreetMap's indoor mapping: the flight from 75 m to 87 m west,
  // the lift at 86 m, the gates at 98 m, the footway at 114 m; the streets 4.45 m under the
  // platform). The hall lies between the tracks: speckled grey terrazzo, walls of tiles black,
  // white and grey at random, a white ceiling, raised between the tracks, the ticket booth by the
  // gates; outside, windows in dark frames over teal tiles towards the footway and the street,
  // bicycles parked under the deck's edges, its fascia board-marked concrete with SL's blue band
  // over the footway's mouths, galvanised railings and chain-link on top. Beyond the deck the bank
  // is held by walls of granite.
  'Stureby': {
    roof: {
      kind: 'butterfly',
      from: -74.2, to: 29, width: 7.8,
      middle: 3.2, edge: 3.45, thick: 0.2, fascia: 0.3,
      rafters: 1.0,
      beam: 0.3,
      columns: { every: 10.5, at: 27.5, size: 0.3, plinth: { size: 0.45, height: 0.25 }, casings: { at: [27.5], size: [0.75, 0.45] } },
      lamps: { offset: 2.5, length: 1.5, every: 3 },
      colors: { underside: 0xe6e2d8, fascia: 0x2b2d30, top: 0x4a4e52, steel: 0x26282b },
      signs: { at: [-51, -19.5, 12], back: 'Utgång', ahead: '', blue: true },
      clocks: [[-41, 0]],
      // (trains run on the left: Hässelby strand's from the northern track)
      boards: [
        { s: -64, u: -1.6, toward: 'Hässelby strand', trains: ['19 Hässelby strand  3 min', '19 Hässelby strand  13 min'] },
        { s: -57, u: 1.6, toward: 'Hagsätra', trains: ['19 Hagsätra  7 min', '19 Hagsätra  17 min'] },
      ],
    },
    paving: {
      edge: 0.6, tactile: [0.6, 0.95], slabs: 0.95, paverSize: [0.6, 0.4], mix: 0.25,
      colors: { edge: 0xcdcac2, tactile: 0x8a8c8c, slab: 0x707377, pavers: 0x707377, paler: 0x83868a, face: 0x8e8b85 },
      pattern: 'bond',
    },
    buildings: ['w149060153', 'w149060144'],
    rooms: [
      { name: 'stair house', s: [-87.5, -72], u: [-4.2, 1.2], h: [-0.5, 1], walls: null, floor: 'darkStone' },
      // (open up to the stair house's roof, a low wall between the flight and the walkway)
      { name: 'stairs', s: [-84, -74], u: [-1.6, 1.0], h: [-5, -3.5], walls: 'boardConcrete', floor: 'terrazzo', ceiling: 'whiteRender', stairs: 'boardConcrete', sill: 1.0 },
      // (the hall's walls and ceiling are its shell's)
      { name: 'ticket hall', s: [-112.2, -83.4], u: [-4.4, 2.1], h: [-5, -3.5], walls: 'bwTiles', floor: 'terrazzo', ceiling: 'whiteRender', sill: -4.46 },
      { name: 'footway', s: [-120, -108], u: [-16, 12], h: [-5, -3.5], walls: null, floor: 'pavers' },
    ],
    blocks: [
      // the stair house on the platform's west end, glazed, open to the platform under the roof
      { name: 'stair house', plan: [[-87, -4.0], [-74.5, -4.0], [-74.5, 1.0], [-87, 1.0]], h: [-1.6, 2.75],
        walls: 'darkGlazed', sides: [undefined, null, undefined, 'boardConcrete'], floor: 'darkStone', ceiling: 'whitePanels', roof: 0.25, roofColor: 0x3a3d40 },
      // the ticket hall under the deck: raised between the tracks, lower under the southern one
      { name: 'ticket hall', plan: [[-112, -4.3], [-83.5, -4.3], [-83.5, -0.2], [-112, -0.2]], h: [-4.45, -1.3], from: -4.45,
        walls: 'bwTiles', sides: [undefined, 'boardConcrete', null, 'tealWindows'], floor: 'terrazzo', ceiling: 'whiteRender', roof: 0.5,
        ground: true, onPlatform: true },
      { name: "ticket hall's south side", plan: [[-112, -0.2], [-100, -0.2], [-100, 2.0], [-112, 2.0]], h: [-4.45, -2.15], from: -4.45,
        walls: 'tealWindows', sides: [null, null, undefined, undefined], floor: 'terrazzo', ceiling: 'whiteRender', roof: 0.5, ground: true, onPlatform: true },
      { name: "ticket hall's south side, east", plan: [[-100, -0.2], [-83.5, -0.2], [-83.5, 2.0], [-100, 2.0]], h: [-4.45, -2.15], from: -4.45,
        walls: 'bwTiles', sides: [null, 'boardConcrete', undefined, null], floor: 'terrazzo', ceiling: 'whiteRender', roof: 0.5, ground: true, onPlatform: true },
      { name: "ticket hall's step", plan: [[-112, -0.25], [-83.5, -0.25], [-83.5, -0.2], [-112, -0.2]], h: [-2.15, -1.3], from: -2.15, walls: 'whiteRender' },
      { name: 'ticket booth', plan: [[-99, -0.55], [-95.8, -0.55], [-95.8, 1.95], [-99, 1.95]], h: [-4.45, -2.25], from: -4.45, walls: 'glazed', roof: 0.05 },
      // over the flight's foot, the stair house's floor
      { name: "flight's bulkhead", plan: [[-84, -1.3], [-83.4, -1.3], [-83.4, 0.7], [-84, 0.7]], h: [-1.3, -0.02], from: -1.3,
        walls: 'boardConcrete', sides: [null, undefined, null, null] },
      // west of the footway, rooms tiled outside; the footway's own soffit; the deck's undersides
      // either side of the hall, where bicycles are parked
      { name: 'rooms', plan: [[-126, -9.05], [-116, -9.45], [-116, 5.45], [-126, 5.8]], h: [-4.45, -2.15], from: -4.45,
        walls: 'bwTiles', sides: [undefined, undefined, undefined, null], roof: 0.5, ground: true, onPlatform: true },
      { name: 'footway', plan: [[-116, -9.45], [-112, -9.55], [-112, 5.35], [-116, 5.45]], h: [-4.45, -2.15], from: -4.45,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'pavers', ceiling: 'boardConcrete', roof: 0.5, ground: true, onPlatform: true },
      { name: 'under the deck, north', plan: [[-112, -9.55], [-87, -9.6], [-87, -4.3], [-112, -4.3]], h: [-4.45, -2.15], from: -4.45,
        walls: 'boardConcrete', sides: [null, undefined, null, null], floor: 'pavers', ceiling: 'boardConcrete', roof: 0.5, ground: true, onPlatform: true },
      { name: 'under the deck, south', plan: [[-112, 2.0], [-87, 2.0], [-87, 5.6], [-112, 5.35]], h: [-4.45, -2.15], from: -4.45,
        walls: 'boardConcrete', sides: [null, undefined, null, null], floor: 'pavers', ceiling: 'boardConcrete', roof: 0.5, ground: true, onPlatform: true },
      // the deck's fascia, its blue band over the footway's mouths
      // (the northern one bent out over the curving track, round the network's girder, which it cuts)
      { name: "deck's north fascia", plan: [[-126, -9.05], [-106, -9.5], [-106, -9.75], [-126, -9.3]], h: [-2.2, -0.5], from: -2.2,
        walls: 'boardConcrete', sides: [null, null, undefined, undefined], roof: 0.02, roofColor: 0x8f8d86, onPlatform: true,
        nameSign: { side: 2, at: 0.4, length: 5, bottom: -1.6 } },
      { name: "deck's north fascia, east", plan: [[-106, -9.5], [-87, -9.6], [-87, -9.85], [-106, -9.75]], h: [-2.2, -0.5], from: -2.2,
        walls: 'boardConcrete', sides: [null, undefined, undefined, null], roof: 0.02, roofColor: 0x8f8d86, onPlatform: true },
      { name: "deck's south fascia", plan: [[-126, 5.8], [-87, 5.6], [-87, 5.85], [-126, 6.05]], h: [-2.2, -0.5], from: -2.2,
        walls: 'boardConcrete', sides: [null, undefined, undefined, undefined], roof: 0.02, roofColor: 0x8f8d86,
        nameSign: { side: 2, at: 0.69, length: 5, bottom: -1.6 } },
      // the bank's walls of granite, east of the deck and west of the rooms
      { name: "bank's north wall", plan: [[-87, -9.6], [-76, -9.45], [-76, -9.7], [-87, -9.85]], h: [-4.45, -0.5], from: -4.45,
        walls: 'granite', sides: [null, undefined, undefined, null], roof: 0.02, roofColor: 0x8f8d86 },
      { name: "bank's south wall", plan: [[-87, 5.6], [-76, 5.8], [-76, 6.05], [-87, 5.85]], h: [-4.45, -0.5], from: -4.45,
        walls: 'granite', sides: [null, undefined, undefined, null], roof: 0.02, roofColor: 0x8f8d86 },
      { name: "bank's north wall, west", plan: [[-146, -7.85], [-126, -9.05], [-126, -9.3], [-146, -8.1]], h: [-4.45, -0.5], from: -4.45,
        walls: 'granite', sides: [null, null, undefined, undefined], roof: 0.02, roofColor: 0x8f8d86 },
      { name: "bank's south wall, west", plan: [[-146, 7.15], [-126, 5.8], [-126, 6.05], [-146, 7.4]], h: [-4.45, -0.5], from: -4.45,
        walls: 'granite', sides: [null, null, undefined, undefined], roof: 0.02, roofColor: 0x8f8d86 },
    ],
    art: [
      { kind: 'growth', s: 67.5, u: -3.0, height: 3.3, turn: 0 },
      { kind: 'masts', height: 5.0, color: 0x9a9fa3, arm: 1.2, sign: 2.6, blue: true, at: [[62, -2.6]] },
      { kind: 'masts', height: 4.3, color: 0x9a9fa3, arm: 1.0, at: [[40.6, -2.5]] },
      { kind: 'roundel', s: -85.8, u: -1.3, h: 4.55, size: 0.55, foot: 4.15 },
    ],
    benches: { at: [-61.5, -51, -30, -9, 12], double: true, wood: true },
    // railings on the deck's edges (chain-link between galvanised posts), and chain-link beyond the
    // tracks along the bank, 3.4 m out
    fences: [
      { points: [[-146, -7.95], [-126, -9.15], [-106, -9.62], [-87, -9.72], [-76, -9.5]], h: [-0.5, 0.65] },
      { points: [[-146, 7.25], [-126, 5.9], [-112, 5.45], [-87, 5.7], [-76, 5.9]], h: [-0.5, 0.65] },
      { points: [[-76, -9.9], [-70, -9.7], [-60, -9.3], [-40, -8.6], [-20, -8.1], [0, -8.0], [20, -8.4], [40, -9.2], [60, -10.4], [80, -11.9]], h: [-1.5, 0.5] },
      { points: [[-76, 6.4], [-70, 6.6], [-60, 6.9], [-40, 7.5], [-20, 7.9], [0, 8.0], [20, 7.8], [40, 7.0], [60, 5.5], [80, 3.4]], h: [-1.5, 0.5] },
    ],
  },

  // Bandhagen (22 November 1954, Magnus Ahlgren): an island platform on a bank, its south end on a
  // bridge over Trollesundsvägen, where a hall glazed in dark green frames stands between the
  // tracks' decks; the way out is down to the ticket hall under them at the street, its doors south
  // onto Bandhagsplan (Swedish Wikipedia). Lantmäteriet's laser scan puts the platform from 76 m
  // south of its middle to 73 m north, about 10 m wide, and its butterfly roof from 77 m south to
  // 14.5 m south, 9.5 m wide and half a metre west of the platform's middle, its top 3.8 m over the
  // platform at the valley and 4.2 m at the edges at its south end, falling to 3.4 m and 3.8 m at
  // its north end. Photographs (2009 to 2018) show its underside of pale ribbed sheet on dark green
  // steel beams, a thin pale fascia, columns down the middle with knee braces, at its north end a
  // dark green casing; SL's blue name signs, a clock, departure boards; grey concrete pavers in
  // bond, a pale edge and a ribbed strip; galvanised lamp posts out in the open, three dome lamps
  // on each (the laser scan: 5 m high, 10 m south and 15, 34 and 52 m north), the blue sign on one;
  // wooden benches; chain-link along the bank.
  //
  // Out on the open platform stands Freddy Fraek's folding ruler and stone of Öland limestone
  // (1983; the ruler was of wood, and so worn that four years later it was clad in copper): a leg
  // 2.5 m high 13.5 m north of the middle, a length sloping down south from its top to a fold
  // that rises and turns over the stone, 2.2 m high, and comes down beside it to a length lying
  // on edge on the platform, 0.9 m high, to 5.6 m south (the laser scan and Google's mesh, seen
  // from above, place each, the fold over the stone turned to lie flat). Its scale's ticks run
  // along its edges, its numbers black, its tens red; its ends are brass. A second, L-shaped,
  // stands at the ticket hall's front: a leg 3.6 m high and an arm from its top into the front.
  //
  // The glazed hall (the laser scan: its roof 3.5 m over the platform, from 72 m south to 97 m,
  // then a walkway on along its east side to the lift's tower, 4.7 m high, at 104 m): glass
  // between dark green frames over a green kick panel, a steel handrail, a ceiling of white
  // panels, speckled terrazzo, wooden benches; an escalator down its west side, stairs beside it,
  // in a well under the glass roof, and the walkway past it with a sign to the lift. The ticket
  // hall under it, 6.4 m under the platform, from 85 m south to 114 m, between the decks (the
  // laser scan, and OpenStreetMap's outline): cream tiles, a ceiling of white panels 5.4 m up,
  // windows high in its west wall, terrazzo; the gates, the ticket booth by them. Outside, green
  // steel panels and windows in dark green frames above them, and in its south front glass doors
  // in brushed steel under SL's blue band with the station's name. Trollesundsvägen runs under
  // the bridge north of it, 4 m clear. Over the square in front, the tracks' decks stand on slender
  // round columns (photographs; two under each deck, on a crosshead, is a guess).
  'Bandhagen': {
    roof: {
      kind: 'butterfly',
      from: -72.4, to: -14.5, width: 9.4, offset: -0.45,
      middle: 3.35, edge: 3.75, thick: 0.25, fascia: 0.25,
      rafters: 2.6, rafterSize: [0.12, 0.25], deck: 'ribbed', rafterColor: 0x26332c,
      beam: 0.35,
      columns: { every: 11, at: -19.5, size: 0.25, plinth: { size: 0.45, height: 0.2 }, braces: 1.4, casings: { at: [-19.5], size: [0.9, 1.4] } },
      lamps: { offset: 2.4, length: 1.5, every: 3 },
      colors: { underside: 0xcfd1ce, fascia: 0xd8d8d2, top: 0x4a4e52, steel: 0x26332c },
      signs: { at: [-25, -47, -58], back: 'Utgång', ahead: '', blue: true },
      clocks: [[-36, 0]],
      // (trains run on the left: Hässelby strand's from the western track)
      boards: [
        { s: -66, u: -1.6, toward: 'Hässelby strand', trains: ['19 Hässelby strand  2 min', '19 Hässelby strand  12 min'] },
        { s: -61, u: 1.6, toward: 'Hagsätra', trains: ['19 Hagsätra  5 min', '19 Hagsätra  15 min'] },
      ],
    },
    paving: {
      edge: 0.6, tactile: [0.6, 0.95], slabs: 0.95, paverSize: [0.6, 0.3], mix: 0.25,
      colors: { edge: 0xd6d4ce, tactile: 0x8a8c8c, slab: 0x8c8e90, pavers: 0x8c8e90, paler: 0x9c9ea0, face: 0x8e8b85 },
      pattern: 'bond',
    },
    buildings: ['w160969281', 'w160969278'],
    rooms: [
      // (the glazed hall's walls and roof are its shell's)
      { name: 'glazed hall', s: [-103, -71], u: [-3.1, 2.6], h: [-0.5, 1], walls: null, floor: 'terrazzo' },
      // (open up to the glazed hall, glass beside it to a handrail over the hall's floor)
      { name: 'escalator', s: [-93, -80], u: [-3.1, 0.2], h: [-6.6, -6.2], walls: 'greenGlazed', stairs: 'greenGlazed', floor: 'terrazzo', sill: 1.0 },
      // (the hall's walls and ceiling are its shell's)
      { name: 'ticket hall', s: [-114.6, -84.5], u: [-3.5, 2.6], h: [-6.6, -6.2], walls: 'creamTiles', floor: 'terrazzo', ceiling: 'whitePanels', sill: -6.42 },
      { name: 'Bandhagsplan', s: [-125, -114.6], u: [-8, 8], h: [-7, -6], walls: null, floor: 'pavers' },
    ],
    blocks: [
      // the glazed hall between the tracks' decks: over the street, on its own deck, and over the
      // ticket hall, open to the platform; the walkway on to the lift
      { name: 'glazed hall', plan: [[-72.3, -3.0], [-84.7, -3.0], [-84.7, 2.55], [-72.3, 2.55]], h: [-2.4, 3.0],
        walls: 'greenGlazed', sides: [undefined, null, undefined, null], ceiling: 'whitePanels', roof: 0.4, roofColor: 0x3a3d40 },
      { name: 'glazed hall, south', plan: [[-84.7, -3.0], [-97, -3.0], [-97, 2.55], [-84.7, 2.55]], h: [-1.0, 3.0],
        walls: 'greenGlazed', sides: [undefined, undefined, undefined, null], ceiling: 'whitePanels', roof: 0.4, roofColor: 0x3a3d40 },
      { name: 'walkway', plan: [[-97, 0.1], [-102.8, 0.1], [-102.8, 2.55], [-97, 2.55]], h: [-1.0, 3.0],
        walls: 'greenGlazed', sides: [undefined, null, undefined, null], ceiling: 'whitePanels', roof: 0.4, roofColor: 0x3a3d40 },
      // the hall's floor over the escalator's foot, and its edge over the well
      { name: "well's edge", plan: [[-87.3, -3.0], [-87.4, -3.0], [-87.4, 0.1], [-87.3, 0.1]], h: [-1.0, 0], from: -1.0, walls: 'whitePanels' },
      { name: "hall's floor over the escalator", plan: [[-87.3, -3.0], [-97, -3.0], [-97, 0.1], [-87.3, 0.1]], h: [0, 0],
        walls: 'terrazzo', sides: [null, null, null, null], floor: 'terrazzo' },
      // the ticket hall, cream-tiled inside, and its walls outside: green steel and windows, the
      // doors in its south front
      { name: 'ticket hall', plan: [[-84.7, -3.4], [-113.7, -3.4], [-113.7, 2.4], [-84.7, 2.4]], h: [-6.4, -1.0], from: -6.4,
        walls: 'creamTiles', sides: ['creamClerestory', 'greenFront', undefined, undefined], floor: 'terrazzo', ceiling: 'whitePanels', roof: 0.7,
        ground: true, onPlatform: true },
      { name: "hall's west side", plan: [[-84.58, -3.52], [-113.82, -3.52], [-113.82, -3.42], [-84.58, -3.42]], h: [-6.4, -0.3], from: -6.4, walls: 'greenFront', onPlatform: true },
      { name: "hall's east side", plan: [[-84.58, 2.42], [-113.82, 2.42], [-113.82, 2.52], [-84.58, 2.52]], h: [-6.4, -0.3], from: -6.4, walls: 'greenFront', onPlatform: true },
      { name: "hall's north side", plan: [[-84.58, -3.42], [-84.68, -3.42], [-84.68, 2.42], [-84.58, 2.42]], h: [-6.4, -0.3], from: -6.4, walls: 'greenFront', onPlatform: true },
      { name: "hall's front, west", plan: [[-113.72, -3.42], [-113.82, -3.42], [-113.82, -3.0], [-113.72, -3.0]], h: [-6.4, -0.3], from: -6.4, walls: 'greenFront' },
      { name: "hall's doors", plan: [[-113.72, -3.0], [-113.82, -3.0], [-113.82, 0.3], [-113.72, 0.3]], h: [-6.4, -0.3], from: -6.4, walls: 'greenDoors',
        nameSign: { side: 1, at: 0.5, length: 3.2, bottom: -3.92 } },
      { name: "hall's front, east", plan: [[-113.72, 0.3], [-113.82, 0.3], [-113.82, 2.42], [-113.72, 2.42]], h: [-6.4, -0.3], from: -6.4, walls: 'greenFront' },
      { name: 'ticket booth', plan: [[-108.3, 0.5], [-110.8, 0.5], [-110.8, 2.35], [-108.3, 2.35]], h: [-6.4, -4.2], from: -6.4, walls: 'glazed', roof: 0.05 },
      // the street under the bridge: the deck's underside, and the bank's face north of it
      { name: 'deck over the street', plan: [[-74.7, -3.5], [-84.6, -3.5], [-84.6, 2.75], [-74.7, 2.75]], h: [-6.4, -2.4], from: -6.4,
        walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete' },
      { name: 'abutment', plan: [[-74.4, -3.5], [-74.7, -3.5], [-74.7, 2.75], [-74.4, 2.75]], h: [-6.4, -2.4], from: -6.4, walls: 'boardConcrete' },
      // the tracks' decks over the square stand on slender round columns, not on piers
      { name: 'no pier, east', plan: [[-113.6, 3.0], [-115.6, 3.0], [-115.6, 7.6], [-113.6, 7.6]], h: [-9.4, -2.63], from: -9.4,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      { name: 'no pier, west', plan: [[-113.6, -9.2], [-115.4, -9.2], [-115.4, -4.6], [-113.6, -4.6]], h: [-9.4, -2.63], from: -9.4,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      { name: 'crosshead, east', plan: [[-113.85, 2.6], [-115.55, 2.6], [-115.55, 7.9], [-113.85, 7.9]], h: [-3.0, -2.6], from: -3.0, walls: 'boardConcrete', floor: 'boardConcrete' },
      { name: 'crosshead, west', plan: [[-113.65, -9.5], [-115.35, -9.5], [-115.35, -4.2], [-113.65, -4.2]], h: [-3.0, -2.6], from: -3.0, walls: 'boardConcrete', floor: 'boardConcrete' },
    ],
    art: [
      { kind: 'columns', at: [[-114.7, 3.75], [-114.7, 6.75], [-114.5, -8.35], [-114.5, -5.35]], from: -6.6, to: -3.0, size: 0.4, color: 0xbab7b0 },
      { kind: 'ruler', width: 0.88, thick: 0.28, flat: [2, 3],
        points: [[-5.6, -0.1, 0.44], [3.0, -0.1, 0.44], [3.0, -0.1, 2.31], [5.7, 0.2, 2.66], [6.6, 0.85, 1.31], [13.5, 0.85, 2.0], [13.5, 0.85, 0]] },
      { kind: 'stone', s: 4.2, u: 0.85, size: [1.6, 1.0, 2.5], turn: 0.1, lean: 0.1 },
      { kind: 'ruler', width: 0.88, thick: 0.28, points: [[-117.4, 1.8, -6.4], [-117.4, 1.8, -3.24], [-113.75, 1.8, -3.24]] },
      { kind: 'masts', height: 5.0, color: 0x9a9fa3, arm: 1.4, at: [[-10.5, 0], [33.8, -0.2], [52.5, 0.3]] },
      { kind: 'masts', height: 5.0, color: 0x9a9fa3, arm: 1.4, sign: 2.6, blue: true, at: [[15.5, -0.25]] },
    ],
    benches: { at: [-58, -47, -36, -25, 24, 42, 60], double: true, wood: true },
    // chain-link along the bank, 3.4 m beyond each track
    fences: [
      { points: [[-72, -9.67], [-50, -9.46], [-30, -9.26], [-10, -9.07], [10, -8.88], [30, -8.7], [50, -8.51], [70, -8.3], [85, -8.12]], h: [-1.1, 0.6] },
      { points: [[-72, 9.1], [-50, 9.03], [-30, 8.98], [-10, 8.96], [10, 8.96], [30, 8.98], [50, 8.97], [70, 8.85], [85, 8.68]], h: [-1.1, 0.6] },
    ],
  },

  // Högdalen (22 November 1954, the present station 3 November 1957): two island platforms in a
  // shallow cutting beside Högdalens centrum, the track between them to the depot; at their south
  // ends stair houses up to the ticket hall in the building over the tracks at the street, its
  // doors south onto Högdalsgången, and since 2009 the library on the floor over the hall (Swedish
  // Wikipedia). Lantmäteriet's laser scan puts the western platform's butterfly roof from 73 m
  // south of the platforms' middle to 10 m north, the eastern's to 42 m south, both about 7.5 m
  // wide, their tops 3 m over the platforms at the valley and 3.4 m at the edges. Photographs
  // (2008 to 2026) show their undersides of pale grey sheet, ribbed across, on dark steel rafters
  // and a dark beam along the valley, a dark fascia, black columns down the middle, at the north
  // end of the western roof a black casing round one; tube lamps along the edges; SL's blue name
  // signs, clocks, departure boards; a pale edge, a ribbed strip and grey slabs in bond; wooden
  // benches. Out in the open, galvanised lamp posts with three dome lamps (the laser scan: 4.9 m
  // high), the blue sign on two; a concrete retaining wall along the western track with
  // chain-link on it; chain-link along the eastern bank.
  //
  // The stair houses (OpenStreetMap's indoor mapping: in the western one stairs and a lift, in the
  // eastern one an escalator, stairs and a lift): their roofs climb from the platforms' roofs at
  // 73 m south to 10.3 m over the platforms at the building's north face (the laser scan, which
  // has them 6 m wide); clad in silver-grey panels, finely perforated, white panels inside.
  //
  // The building (the laser scan: its roof 13.9 m over the platforms, from 94 m south to 112 m
  // and 50 m across, a part 0.85 m higher over the stair heads, two housings on it, a canopy 9.4
  // m up along its south front and both ends; the street 5.6 m over the platforms; OpenStreetMap
  // has its outline 1.6 m further south): shop windows under the canopy, and in its south front
  // glass doors in brushed steel under SL's blue band with the station's name; over the canopy,
  // white panels round a band of windows between dark blue piers, the library's. The hall: a floor
  // of dark stone, shop fronts along its sides, a white ceiling (the oval opening in it to the
  // library, the black tiled columns and the library itself are not drawn).
  //
  // Birgitta Muhr's Uppväxter (2002): three bronze tulips 2.5 m high, their stems patinated
  // green, the flowers lacquered red, each in a ring of setts, out on the eastern platform north
  // of its roof. The laser scan places one 1 m south of the middle and a photograph another 8.5 m
  // north of it; the third, by a photograph beyond the lamp post with the blue sign, is a guess.
  'Högdalen': {
    // the eastern platform's roof (the line it follows is that platform's)
    roof: {
      kind: 'butterfly',
      from: -73.0, to: -42.2, width: 7.5,
      shape: [[-73, -0.55, 7.5], [-42.2, -0.35, 7.5]],
      middle: 2.75, edge: 3.2, thick: 0.2, fascia: 0.3,
      rafters: 3.3, rafterSize: [0.15, 0.3], deck: 'ribbedAcross', rafterColor: 0x3d4044,
      beam: 0.5,
      columns: { every: 10.8, at: -46, size: 0.3, plinth: { size: 0.45, height: 0.15 } },
      lamps: { offset: 2.6, length: 1.5, every: 3.6, tube: true },
      colors: { underside: 0xc9cbc8, fascia: 0x3d4044, top: 0x7d868e, steel: 0x3d4044 },
      signs: { at: [-61], back: 'Utgång', ahead: '', blue: true },
      clocks: [[-52, 0]],
      // (trains run on the left: Hagsätra's from the eastern track)
      boards: [{ s: -66, u: 1.6, toward: 'Hagsätra', trains: ['19 Hagsätra  4 min', '19 Hagsätra  14 min'] }],
    },
    // the western platform's, beside it, following that platform where it bends away
    roofs: [{
      kind: 'butterfly',
      from: -73.0, to: 10.0, width: 7.0,
      shape: [[-73, -10.51, 6.95], [-40, -10.12, 6.85], [-10, -9.82, 6.75], [10, -9.48, 6.45]],
      middle: 2.75, edge: 3.2, thick: 0.2, fascia: 0.3,
      rafters: 3.3, rafterSize: [0.15, 0.3], deck: 'ribbedAcross', rafterColor: 0x3d4044,
      beam: 0.5,
      columns: { every: 10.8, at: 3.5, size: 0.3, plinth: { size: 0.45, height: 0.15 }, between: [-68, 10], casings: { at: [3.5], size: [0.9, 0.9] } },
      lamps: { offset: 2.6, length: 1.5, every: 3.6, tube: true },
      colors: { underside: 0xc9cbc8, fascia: 0x3d4044, top: 0x7d868e, steel: 0x3d4044 },
      signs: { at: [-23.5, -56], back: 'Utgång', ahead: '', blue: true },
      clocks: [[-34.3, 0]],
      boards: [
        { s: -45, u: -1.6, toward: 'Hässelby strand', trains: ['19 Hässelby strand  2 min', '19 Hässelby strand  12 min'] },
        { s: -12.7, u: -1.6, toward: 'Hässelby strand', trains: ['19 Hässelby strand  2 min', '19 Hässelby strand  12 min'] },
      ],
    }],
    paving: {
      edge: 0.6, tactile: [0.6, 0.95], slabs: 0.95, paverSize: [0.6, 0.3], mix: 0.25,
      colors: { edge: 0xd6d4ce, tactile: 0x8a8c8c, slab: 0x7d8083, pavers: 0x7d8083, paler: 0x8a8d90, face: 0x8e8b85 },
      pattern: 'bond',
    },
    buildings: ['w25879137', 'w196670105', 'w200257110', 'w196670106', 'w196670107'],
    rooms: [
      // (the stair houses' walls and roofs are their shells', low walls beside the flights)
      { name: 'stair houses', s: [-96, -72], h: [-0.5, 0.5], walls: null, floor: 'greyTiles', stairs: 'whitePanels', sill: 1.1 },
      // (the hall's walls and ceiling are its shell's, the stair heads' the stair houses')
      { name: 'ticket hall', s: [-113.6, -88], u: [-10, 10], h: [5, 6.5], walls: null, floor: 'darkStone' },
      { name: 'Högdalsgången', s: [-125, -113.6], h: [5, 6.5], walls: null, floor: 'pavers' },
    ],
    blocks: [
      // the stair houses, their roofs climbing from the platforms' roofs to the building, open to
      // the platforms; the perforated cladding outside along each side, beside the tracks
      { name: 'western stair house', plan: [[-93.8, -8.8], [-73.0, -8.8], [-73.0, -2.55], [-93.8, -2.55]], h: [-1.5, 10.15], low: 3.05,
        walls: 'whitePanels', sides: [undefined, 'glazed', undefined, undefined], floor: 'greyTiles', ceiling: 'whitePanels', roof: 0.15, roofColor: 0x8d949a },
      { name: "western stair house's west side", plan: [[-93.8, -8.92], [-73.0, -8.92], [-73.0, -8.82], [-93.8, -8.82]], h: [0, 10.3], low: 3.2, walls: 'silverPerforated' },
      { name: "western stair house's east side", plan: [[-93.8, -2.53], [-73.0, -2.53], [-73.0, -2.43], [-93.8, -2.43]], h: [0, 10.3], low: 3.2, walls: 'silverPerforated' },
      { name: 'eastern stair house', plan: [[-93.8, 1.9], [-73.0, 1.9], [-73.0, 8.3], [-93.8, 8.3]], h: [-1.5, 10.15], low: 3.05,
        walls: 'whitePanels', sides: [undefined, 'glazed', undefined, undefined], floor: 'greyTiles', ceiling: 'whitePanels', roof: 0.15, roofColor: 0x8d949a },
      { name: "eastern stair house's west side", plan: [[-93.8, 1.78], [-73.0, 1.78], [-73.0, 1.88], [-93.8, 1.88]], h: [0, 10.3], low: 3.2, walls: 'silverPerforated' },
      { name: "eastern stair house's east side", plan: [[-93.8, 8.32], [-73.0, 8.32], [-73.0, 8.42], [-93.8, 8.42]], h: [0, 10.3], low: 3.2, walls: 'silverPerforated' },
      // the landings at the stair heads, beside the flights and the lifts
      { name: "western stair head", plan: [[-93.8, -8.8], [-92.3, -8.8], [-92.3, -2.55], [-93.8, -2.55]], h: [5.6, 5.6], from: 5.6,
        walls: 'darkStone', sides: [null, null, null, null], floor: 'darkStone' },
      { name: "eastern stair head", plan: [[-93.8, 1.9], [-92.3, 1.9], [-92.3, 8.3], [-93.8, 8.3]], h: [5.6, 5.6], from: 5.6,
        walls: 'darkStone', sides: [null, null, null, null], floor: 'darkStone' },
      // the building: its shell, white panels round the library's band of windows, shop windows
      // under the canopy at its ends, its ground floor dark at the back over the tracks, where the
      // perforated cladding rises on up its front over the stair heads; its south front, the doors
      // in the middle under the name; the concrete it stands on beside the tracks, and its floor
      // over them (which, with the hall, cuts the tunnels' headwalls under it)
      { name: 'library', plan: [[-112.3, -29.3], [-93.8, -29.3], [-93.8, 20.6], [-112.3, 20.6]], h: [5.6, 13.85], from: 5.6,
        walls: 'greyPanels', sides: ['libraryFront', undefined, 'libraryFront', null], band: { walls: 'libraryBack', from: 9.2 }, roof: 0.05, roofColor: 0xb9bcbd },
      { name: 'north front over the stair heads', plan: [[-93.75, -9], [-93.65, -9], [-93.65, 8.5], [-93.75, 8.5]], h: [5.6, 13.85], from: 5.6, walls: 'silverPerforated' },
      { name: 'south front, west', plan: [[-112.4, -29.3], [-112.3, -29.3], [-112.3, -6], [-112.4, -6]], h: [4.9, 13.85], from: 5.6, walls: 'libraryFront' },
      { name: 'doors', plan: [[-112.4, -6], [-112.3, -6], [-112.3, 3], [-112.4, 3]], h: [4.9, 13.85], from: 5.6, walls: 'libraryEntrance',
        nameSign: { side: 3, at: 0.4, length: 4.4, bottom: 8.25 } },
      { name: 'south front, east', plan: [[-112.4, 3], [-112.3, 3], [-112.3, 20.6], [-112.4, 20.6]], h: [4.9, 13.85], from: 5.6, walls: 'libraryFront' },
      { name: 'west footing', plan: [[-112.3, -29.3], [-93.8, -29.3], [-93.8, -14], [-112.3, -14]], h: [-1.5, 5.6], from: 5.6, walls: 'boardConcrete', onPlatform: true },
      { name: 'east footing', plan: [[-112.3, 13.5], [-93.8, 13.5], [-93.8, 20.6], [-112.3, 20.6]], h: [-1.5, 5.6], from: 5.6, walls: 'boardConcrete', onPlatform: true },
      { name: 'deck under the building', plan: [[-112.3, -14], [-93.8, -14], [-93.8, 13.5], [-112.3, 13.5]], h: [5.3, 5.6], from: 5.3,
        walls: 'boardConcrete', sides: [null, undefined, null, null], floor: 'boardConcrete', onPlatform: true },
      // the ticket hall, shop fronts along its sides
      { name: 'ticket hall', plan: [[-112.3, -9], [-93.8, -9], [-93.8, 9], [-112.3, 9]], h: [5.6, 9.0], from: 5.6,
        walls: 'shopWindows', sides: [undefined, null, undefined, null], floor: 'darkStone', ceiling: 'whitePanels', onPlatform: true },
      // on the roof: the raised part over the stair heads, and two housings
      { name: 'raised roof', plan: [[-98.3, -11], [-96.3, -11], [-96.3, 7.5], [-98.3, 7.5]], h: [13.9, 14.55], from: 13.9,
        walls: 'silverPerforated', roof: 0.15, roofColor: 0x8d949a },
      { name: 'housing, west', plan: [[-100.3, -22], [-96.5, -22], [-96.5, -18.6], [-100.3, -18.6]], h: [13.9, 16.2], from: 13.9, walls: 'greyPanels', roof: 0.15 },
      { name: 'housing, east', plan: [[-100.5, -0.6], [-97.5, -0.6], [-97.5, 2.2], [-100.5, 2.2]], h: [13.9, 15.95], from: 13.9, walls: 'greyPanels', roof: 0.15 },
      // the canopy along the south front and the ends
      { name: 'canopy', plan: [[-114.6, -30.8], [-112.3, -30.8], [-112.3, 22.2], [-114.6, 22.2]], h: [9.15, 9.15], from: 9.15,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'whitePanels', roof: 0.25, roofColor: 0xb9bcbd },
      { name: 'canopy, west end', plan: [[-112.3, -30.8], [-93.8, -30.8], [-93.8, -29.3], [-112.3, -29.3]], h: [9.15, 9.15], from: 9.15,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'whitePanels', roof: 0.25, roofColor: 0xb9bcbd },
      { name: 'canopy, east end', plan: [[-112.3, 20.6], [-93.8, 20.6], [-93.8, 22.2], [-112.3, 22.2]], h: [9.15, 9.15], from: 9.15,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'whitePanels', roof: 0.25, roofColor: 0xb9bcbd },
      // the retaining wall beyond the western track (the laser scan: its top 0.75 m over the
      // platforms at the building, 1.45 m at 62 m south, the bank behind it falling to the tracks
      // by 18 m south)
      { name: 'retaining wall, south', plan: [[-62, -13.85], [-95, -13.85], [-95, -13.55], [-62, -13.55]], h: [-1.5, 1.45], low: 0.75, from: -1.5,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x8f8d86 },
      { name: 'retaining wall, north', plan: [[-62, -13.55], [-18, -13.55], [-18, -13.85], [-62, -13.85]], h: [-1.5, 1.45], low: -0.2, from: -1.5,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x8f8d86 },
    ],
    art: [
      { kind: 'tulip', s: -1.0, u: 4.8, height: 2.5, turn: 2.2 },
      { kind: 'tulip', s: 8.5, u: 6.4, height: 2.5, turn: -1.4 },
      { kind: 'tulip', s: 22, u: 3.2, height: 2.5, turn: 0.6 },
      { kind: 'masts', height: 4.9, color: 0x9a9fa3, arm: 0.55, at: [[-36, 4.4], [-23, 4.6], [-8.3, 3.7], [3, 4.6], [29.5, 4.4], [43.6, 5.2], [55, 5.6], [68, 6.0]] },
      { kind: 'masts', height: 4.9, color: 0x9a9fa3, arm: 0.55, sign: 2.6, blue: true, at: [[16.2, 4.4]] },
      { kind: 'masts', height: 4.9, color: 0x9a9fa3, arm: 0.55, at: [[17.6, -5.1], [43.7, -3.7], [57, -3.4], [68.9, -1.7]] },
      { kind: 'masts', height: 4.9, color: 0x9a9fa3, arm: 0.55, sign: 2.6, blue: true, at: [[29.5, -5.1]] },
    ],
    // between the columns, down the middle of each roof
    benches: [
      { at: [-62.2, -51.4], double: true, wood: true },
      { at: [-55.9, -34.3, -12.7], double: true, wood: true, roof: 0 },
    ],
    // chain-link on the retaining wall (its foot inside the wall) and on along the western bank;
    // and along the eastern bank, falling with it
    fences: [
      { points: [[-95, -13.7], [-62, -13.7], [-40, -13.7]], h: [0.6, 2.4] },
      { points: [[-40, -13.7], [-18, -13.7]], h: [-0.3, 1.5] },
      { points: [[-18, -13.7], [0, -13.8], [30, -13.6], [50, -12.8], [75, -11.5]], h: [-1.4, 0.4] },
      { points: [[-95, 15.8], [-50, 15.8]], h: [-0.6, 1.4] },
      { points: [[-50, 15.8], [-30, 15.8]], h: [-1.3, 0.7] },
      { points: [[-30, 15.8], [0, 15.6], [30, 15.6], [50, 15.8], [75, 16.0]], h: [-1.65, 0.35] },
    ],
  },

  // Rågsved (14 November 1959, the line's end until 1960): an island platform on a bank, its
  // south-western 42 m on the bridge over the passage under the tracks. Lantmäteriet's laser scan
  // puts its roof from 19 m south-west of the platform's middle to 49 m north-east: a W of two
  // butterflies side by side, each 6 m wide, 3 m over the platform at its valley and 3.2 m at its
  // edges. Photographs (2008 to 2025) show the undersides boarded white on white rafters, a dark
  // fascia, pairs of black columns along each valley, each pair under a beam; between the valleys,
  // over the escalator and the stairs, a stair house glazed in dark frames on a concrete base, its
  // door at its north-eastern end; at the roof's south-western end a lift in a glazed tower, the
  // metro's round sign on a post on its top; pale edge stones, a dark ribbed strip and grey slabs
  // in a bond. Out in the open, galvanised lamp posts with two dome lamps on an arm and a third
  // lower down on one side (the laser scan: 4.5 m high), SL's blue sign on some; beyond the
  // western track a retaining wall down to Rågsvedsvägen's pavement, chain-link on it and on along
  // the bank, and a rock face beyond the eastern.
  //
  // Under the platform (OpenStreetMap's indoor mapping, photographs): the flights come down to the
  // ticket hall at the street, the escalator's side tiled white, the stairs' black; the hall's
  // floor dark terrazzo, glass blocks along its west side and black tiles along its east, the gates
  // 27 m south-west of the platform's middle; in its front onto the passage, glass doors in brushed
  // steel under SL's blue band, between mosaics of small rectangles, blue and grey to the west and
  // in warm colours on the concrete pier to the east. West of the hall, shops facing Rågsvedsvägen
  // under the bridge; across the passage a parapet over the cycle path's trough (the cycle path's
  // tunnel under the bridge and the road isn't drawn); east of the bridge the kiosk, shuttered.
  //
  // Björn Selder's Fågel Grön (1983): a bird of dark bronze on a post near the platform's
  // north-eastern end, 5.4 m high (the laser scan), its lobes about 2 m across.
  'Rågsved': {
    // the eastern butterfly (its middle along the eastern valley)
    roof: {
      kind: 'butterfly',
      from: -18.6, to: 48.9, width: 6,
      shape: [[-18.6, 3.45, 6], [0, 3.2, 6], [24, 3.25, 6], [48.9, 3.0, 6]],
      middle: 3.0, edge: 3.22, thick: 0.15, fascia: 0.22,
      rafters: 1.2, rafterSize: [0.06, 0.18], deck: 'boards', rafterColor: 0xefeee9,
      beam: 0.4,
      columns: { every: 8.0, at: 47.15, size: 0.12, plinth: { size: 0.22, height: 0.1 }, pair: 0.45 },
      lamps: { offset: 1.9, length: 1.2, every: 4.0 },
      colors: { underside: 0xe6e4de, fascia: 0x2b2e31, top: 0x4f5357, steel: 0x1d1f21 },
      signs: { at: [], back: 'Utgång', ahead: '', blue: true },
      clocks: [[35.15, 0]],
      // (trains run on the left: Hagsätra's from the eastern track)
      boards: [{ s: 12, u: 1.6, toward: 'Hagsätra', trains: ['19 Hagsätra  3 min', '19 Hagsätra  13 min'] }],
    },
    // the western, beside it
    roofs: [{
      kind: 'butterfly',
      from: -18.6, to: 48.9, width: 6,
      shape: [[-18.6, -2.55, 6], [0, -2.8, 6], [24, -2.75, 6], [48.9, -3.0, 6]],
      middle: 3.0, edge: 3.22, thick: 0.15, fascia: 0.22,
      rafters: 1.2, rafterSize: [0.06, 0.18], deck: 'boards', rafterColor: 0xefeee9,
      beam: 0.4,
      columns: { every: 8.0, at: 47.15, size: 0.12, plinth: { size: 0.22, height: 0.1 }, pair: 0.45 },
      lamps: { offset: 1.9, length: 1.2, every: 4.0 },
      colors: { underside: 0xe6e4de, fascia: 0x2b2e31, top: 0x4f5357, steel: 0x1d1f21 },
      signs: { at: [], back: 'Utgång', ahead: '', blue: true },
      boards: [{ s: 30, u: -1.6, toward: 'Hässelby strand', trains: ['19 Hässelby strand  4 min', '19 Hässelby strand  14 min'] }],
    }],
    paving: {
      edge: 0.7, tactile: [0.7, 1.1], slabs: 1.1, slabSize: [0.4, 0.4], paverSize: [0.4, 0.4], mix: 0.2,
      colors: { edge: 0xd0cec8, tactile: 0x63666a, slab: 0x707479, pavers: 0x707479, paler: 0x7b7f84, face: 0x8e8b85 },
      pattern: 'bond',
    },
    buildings: ['w146396291', 'w146396290', 'w222139641'],
    rooms: [
      // (the stair house's walls and roof are its shell's)
      { name: 'stair house', s: [-14.5, 16.6], u: [-3, 6], h: [-0.5, 0.5], walls: null, floor: 'darkStone' },
      { name: 'platform', s: [-60, 95], h: [-0.5, 0.5], walls: null, floor: null },
      // (open up to the stair house, its glass over them)
      { name: 'flights', s: [-6, 9], u: [-3, 6], h: [-7.3, -6.5], walls: 'squareTiles', left: 'squareTiles', stairs: 'blackTiles', floor: 'darkStone', sill: 0 },
      // (the hall's walls and ceiling are its shell's)
      { name: 'ticket hall', s: [-38, -4], u: [-9, 6], h: [-7.3, -6.5], walls: null, floor: 'darkStone' },
    ],
    blocks: [
      // the stair house between the roof's valleys, inside the pairs of columns, open down to the
      // flights
      { name: 'stair house', plan: [[-14, -1.97], [16.5, -0.15], [16.5, 4.95], [-14, 3.13]], h: [0, 2.85],
        walls: 'boardConcrete', sides: [undefined, 'darkGlazed', undefined, undefined], band: { walls: 'darkGlazed', from: 0.8 },
        floor: 'darkStone', ceiling: 'slats', roof: 0.15, roofColor: 0x2b2e31, onPlatform: true },
      // the lift's tower (its door side the lift's own)
      { name: 'lift tower', plan: [[-18.45, -5.1], [-20.95, -5.1], [-20.95, -2.8], [-18.45, -2.8]], h: [0, 4.1],
        walls: 'darkGlazed', sides: [undefined, undefined, undefined, null], roof: 0.15, roofColor: 0x26282a },
      // the ticket hall under the platform, dug into the bank; over the escalator's foot, the
      // bulkhead up to the platform
      { name: 'ticket hall', plan: [[-4.5, -5.4], [-37.3, -5.4], [-37.3, 3.8], [-4.5, 3.8]], h: [-7.5, -3.1], from: -6.95,
        walls: 'blackTiles', sides: ['glassBlocks', null, undefined, undefined], floor: 'darkStone', ceiling: 'whitePanels', ground: true },
      { name: 'bulkhead', plan: [[-4.45, -1.2], [-4.55, -1.2], [-4.55, 2.8], [-4.45, 2.8]], h: [-3.1, 0], from: -3.1, walls: 'whitePanels' },
      // its front onto the passage: the doors under the name, the mosaics either side
      { name: 'doors', plan: [[-37.25, -5.4], [-37.35, -5.4], [-37.35, 0.05], [-37.25, 0.05]], h: [-7.5, -2.6], from: -6.95, walls: 'glassFront',
        nameSign: { side: 1, at: 0.5, length: 4.6, bottom: -4.6 } },
      { name: 'mosaic, west', plan: [[-37.25, -13.5], [-37.35, -13.5], [-37.35, -5.4], [-37.25, -5.4]], h: [-7.5, -2.6], from: -6.95,
        walls: 'boardConcrete', band: { walls: 'blueMosaic', from: -6.65 } },
      { name: 'pier', plan: [[-37.25, 0.05], [-37.35, 0.05], [-37.35, 3.8], [-37.25, 3.8]], h: [-7.5, -2.6], from: -6.95, walls: 'boardConcrete' },
      { name: 'mosaic, east', plan: [[-37.35, 0.6], [-37.38, 0.6], [-37.38, 2.0], [-37.35, 2.0]], h: [-6.45, -3.0], from: -6.45, walls: 'warmMosaic' },
      // the shops west of it, their fronts to Rågsvedsvägen
      { name: 'shops', plan: [[-18.0, -13.5], [-37.25, -13.5], [-37.25, -5.4], [-18.0, -5.4]], h: [-7.5, -2.6], from: -6.95,
        walls: 'shopWindows', sides: [undefined, null, null, 'boardConcrete'], ground: true },
      // east of it, the hall's side and the bank's face under the bridge
      { name: "hall's east side", plan: [[-37.3, 3.82], [-34.0, 3.82], [-34.0, 3.9], [-37.3, 3.9]], h: [-7.5, -2.6], from: -6.95, walls: 'boardConcrete' },
      { name: 'abutment', plan: [[-34.0, 3.9], [-33.7, 3.9], [-33.7, 7.4], [-34.0, 7.4]], h: [-7.5, -2.6], from: -6.8, walls: 'boardConcrete' },
      // the parapet over the cycle path's trough, and the kiosk
      { name: 'parapet', plan: [[-40.2, -16.0], [-43.5, 9.5], [-43.75, 9.5], [-40.45, -16.0]], h: [-9.5, -5.85], from: -9.0,
        walls: 'boardConcrete', roof: 0.04, roofColor: 0x9a978f },
      { name: 'kiosk', plan: [[-36.8, 6.8], [-31.0, 7.6], [-31.7, 14.5], [-37.7, 13.8]], h: [-7.3, -4.05], from: -6.8,
        walls: 'shutter', roof: 0.2, eaves: 0.3, roofColor: 0xd9d7d1 },
      // the name on the bridge's faces over the passage
      { name: 'name, east', plan: [[-43.6, 7.0], [-36.6, 7.0], [-36.6, 7.05], [-43.6, 7.05]], h: [-2.6, -2.6], from: -2.6,
        walls: 'boardConcrete', sides: [null, null, null, null], nameSign: { side: 2, at: 0.5, length: 4.0, bottom: -2.55 } },
      { name: 'name, west', plan: [[-43.6, -13.1], [-36.6, -13.1], [-36.6, -13.05], [-43.6, -13.05]], h: [-2.6, -2.6], from: -2.6,
        walls: 'boardConcrete', sides: [null, null, null, null], nameSign: { side: 0, at: 0.5, length: 4.0, bottom: -2.55 } },
      // the retaining wall holding the bank over Rågsvedsvägen's pavement, north-east of the shops
      // (the laser scan: its face 10.5 m west of the platform's middle at the shops, 9.3 m at 16 m
      // north-east, where the pavement climbs; its top 1.3–1.65 m under the platform's)
      { name: 'retaining wall, south', plan: [[-18, -10.55], [0, -10.2], [0, -8.5], [-18, -9.85]], h: [-7.6, -1.3], low: -1.4, from: -7.6,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x8f8d86, ground: true },
      { name: 'retaining wall, north', plan: [[0, -10.2], [16, -9.3], [16, -7.5], [0, -8.5]], h: [-7.6, -1.4], low: -1.65, from: -7.6,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x8f8d86, ground: true },
      // the pavement at its foot, in place of the city's ground, which rises against the wall
      // where the elevation model's grid, 5 m apart, reaches from the pavement up to the tracks
      { name: 'pavement under the wall', plan: [[-18, -14.3], [8, -13.5], [8, -9.5], [-18, -10.3]], h: [-7.0, -1.3], from: -7.0,
        walls: 'asphalt', sides: [null, null, null, null], floor: 'asphalt', ground: true },
    ],
    art: [
      { kind: 'roundel', s: -19.7, u: -3.95, h: 5.45, size: 0.8, foot: 4.25, along: true },
      { kind: 'bird', s: 84, u: 3.4, height: 5.4, turn: 0.4 },
      { kind: 'masts', height: 4.5, color: 0x9a9fa3, top: false, arm: 1.4, lower: 3.7, lowerOne: true,
        at: [[-49.6, -4.57], [-40, -3.03], [-22.5, -0.75], [66.5, 1.88], [88, 0.97]] },
      { kind: 'masts', height: 4.5, color: 0x9a9fa3, top: false, arm: 1.4, lower: 3.7, lowerOne: true, sign: 2.6, blue: true,
        at: [[-31.5, -1.85], [57.9, 2.15], [77, 1.46]] },
    ],
    // between the pairs of columns, down the middle of each butterfly
    benches: [
      { at: [27.15, 43.15], double: true, wood: true },
      { at: [35.15], double: true, wood: true, roof: 0 },
    ],
    // chain-link along the top of the retaining wall and the bank beyond the western track
    fences: [
      { points: [[-15.7, -10.35], [0, -10.05], [16, -9.15], [24, -8.0], [40, -7.2], [60, -6.3], [80, -5.4], [95, -4.7]], h: [-1.5, 0.3] },
    ],
  },

  // Hagsätra (1 December 1960, the end of T19): a wide island platform out in the open, the tracks
  // on bridges over the passage at its south-eastern end. Lantmäteriet's laser scan puts its roof
  // from 65 m south-east of the platform's middle to 78.5 m north-west: a W of two butterflies side
  // by side, each over a row of columns 4.9 m apart, the whole 9.8 m wide at its south-eastern half
  // and narrowing with the platform to 5.4 m at its north-western end, its underside 3.35 m over
  // the platform at the valleys. Photographs (2018) show the undersides boarded white on white
  // rafters, a dark fascia, slender dark columns under dark beams along the valleys, long tube
  // lamps either side of them, SL's blue name signs with the way out, grey square slabs, a pale
  // edge and a ribbed strip; chain-link fences beyond the tracks.
  //
  // From the roof's south-eastern half a ramp goes down a well in the middle of the platform, its
  // walls concrete cast against boards, to a crossing at platform level, and on under it, between
  // two flights of stairs, into a stair hall: its walls the same concrete to a parapet, glazed above
  // it, under a roof of its own falling with the stairs (the laser scan: 3 m over the platform at
  // the crossing, 0.1 m at its south-eastern end). Between the west flight and the ramp the lift in
  // a glass shaft (2011, where a moving walkway was), rising through the roof. At the bottom a glass
  // wall with doors into the ticket hall under the tracks, between the bridges' decks: terrazzo,
  // white tiles, a white ceiling with round rooflights (Google's mesh: eight in the hall, nine over
  // the passage, domes on the roof), the gates and a glazed booth; its glass front onto the passage
  // under the tracks, which opens east to a court and west to Hagsätra torg. Under the eastern deck
  // a shop, its windows onto the hall, the passage and the court; under the western deck rooms,
  // brown tiles under a band of windows outside. Over the passage's mouths the decks' faces, the
  // name on a blue band, the metro's round sign at the eastern corner, a tall chain-link fence on
  // top (the laser scan: the faces 11.6 m west and 7.5 m east of the middle).
  //
  // Britta Simonsson-Örtenholm's mosaics on a theme of music (1960) and Per Carm's three paintings
  // by the ramp aren't drawn: no photograph of them was found.
  'Hagsätra': {
    // the western butterfly (its middle along the western valley)
    roof: {
      kind: 'butterfly',
      from: -65, to: 78.5, width: 4.9,
      shape: [[-65, -2.41, 4.93], [-40, -2.5, 4.9], [-20, -2.47, 4.85], [0, -2.43, 4.85], [20, -1.97, 4.55], [40, -1.12, 4.0], [60, -0.2, 3.4], [78.5, 0.85, 2.7]],
      middle: 3.35, edge: 3.45, thick: 0.3, fascia: 0.35,
      rafters: 3.0, rafterSize: [0.15, 0.25], deck: 'boards', rafterColor: 0xefeee9,
      beam: 0.35,
      columns: { every: 7.5, at: -28, size: 0.2, plinth: { size: 0.3, height: 0.1 }, offset: -0.2 },
      lamps: { offset: 0.7, length: 1.5, every: 1.6, tube: true },
      colors: { underside: 0xe8e8e4, fascia: 0x2d3033, top: 0x4a4d50, steel: 0x2f3236 },
      signs: { at: [-16.75, 13.25, 43.25], back: 'Utgång', ahead: '', blue: true },
      // (the end of the line: trains from both tracks go back to Hässelby strand)
      boards: [{ s: -50, u: -1.5, toward: 'Hässelby strand', trains: ['19 Hässelby strand  2 min', '19 Hässelby strand  12 min'] }],
    },
    // the eastern, beside it
    roofs: [{
      kind: 'butterfly',
      from: -65, to: 78.5, width: 4.9,
      shape: [[-65, 2.51, 4.93], [-40, 2.4, 4.9], [-20, 2.39, 4.85], [0, 2.43, 4.85], [20, 2.59, 4.55], [40, 2.88, 4.0], [60, 3.2, 3.4], [78.5, 3.55, 2.7]],
      middle: 3.35, edge: 3.45, thick: 0.3, fascia: 0.35,
      rafters: 3.0, rafterSize: [0.15, 0.25], deck: 'boards', rafterColor: 0xefeee9,
      beam: 0.35,
      columns: { every: 7.5, at: -28, size: 0.2, plinth: { size: 0.3, height: 0.1 }, offset: 0.2 },
      lamps: { offset: 0.7, length: 1.5, every: 1.6, tube: true },
      colors: { underside: 0xe8e8e4, fascia: 0x2d3033, top: 0x4a4d50, steel: 0x2f3236 },
      signs: { at: [-1.75, 28.25, 58.25], back: 'Utgång', ahead: '', blue: true },
      boards: [{ s: -50, u: 1.5, toward: 'Hässelby strand', trains: ['19 Hässelby strand  7 min', '19 Hässelby strand  17 min'] }],
    }],
    paving: {
      edge: 0.35, tactile: [0.35, 0.8], slabs: 0.8, slabSize: [0.45, 0.45], paverSize: [0.45, 0.45], mix: 0.25,
      colors: { edge: 0xb9b7b0, tactile: 0x7a7c7e, slab: 0x5f6266, pavers: 0x5f6266, paler: 0x6c6f73, face: 0x8e8b85 },
      pattern: 'bond',
    },
    buildings: ['w146396281', 'w146396284'],
    rooms: [
      // (the well's walls are its parapets')
      { name: 'ramp', s: [-63.5, -27], u: [-5, 4], h: [-3, 0.1], walls: null, floor: 'greyTiles' },
      { name: 'crossing', s: [-66.5, -63.5], u: [-8, 6], h: [-0.3, 0.3], walls: null, floor: 'greyTiles', slab: 0.35 },
      // (a glass railing over the corridor to the lift, the eastern flight's parapet on its other side)
      { name: 'ramp under the crossing', s: [-78.6, -63.5], u: [-1.5, 0.8], h: [-4.1, -2.5], walls: 'boardConcrete', left: 'glazed', floor: 'greyTiles' },
      // (the walls and parapets are the stair hall's shell's)
      { name: 'stair hall', s: [-80.5, -63.5], u: [-8, 6], h: [-4.1, 0.1], walls: 'boardConcrete', stairs: 'boardConcrete', floor: 'terrazzo', sill: -3.99 },
      // (the hall's walls and ceiling are its shell's)
      { name: 'ticket hall', s: [-98.9, -80.5], u: [-8, 4], h: [-4.1, -3.5], walls: null, floor: 'terrazzo', ceiling: 'whiteRender' },
      { name: 'passage', s: [-112, -98.9], u: [-30, 30], h: [-4.3, -3.5], walls: null, floor: 'pavers' },
    ],
    blocks: [
      // the well's parapets (its floor falls from the platform to 2.8 m under it at the crossing)
      { name: "well's west parapet", plan: [[-27.5, -2.48], [-63.45, -3.49], [-63.45, -3.29], [-27.5, -2.28]], h: [-2.9, 1.1],
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x9a978f },
      { name: "well's east parapet", plan: [[-27.5, 2.02], [-63.6, 1.01], [-63.6, 1.21], [-27.5, 2.22]], h: [-2.9, 1.1],
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x9a978f },
      // the crossing: its parapet over the ramp, the end of the well's west half, and the walls under it
      { name: "crossing's parapet", plan: [[-63.6, -1.34], [-63.8, -1.35], [-63.8, 1.0], [-63.6, 1.01]], h: [-0.35, 1.1], from: -0.35,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x9a978f },
      { name: "well's west end", plan: [[-63.45, -3.29], [-63.8, -3.3], [-63.8, -1.35], [-63.45, -1.34]], h: [-2.9, 1.1],
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x9a978f },
      { name: 'under the crossing, west', plan: [[-63.8, -3.9], [-66.3, -3.97], [-66.3, -1.42], [-63.8, -1.35]], h: [-3.1, -0.35], from: -3.1,
        walls: 'boardConcrete' },
      { name: 'under the crossing, east', plan: [[-63.6, 1.01], [-66.3, 0.93], [-66.3, 1.13], [-63.6, 1.21]], h: [-3.1, -0.35], from: -3.1,
        walls: 'boardConcrete' },
      // (the platform's paving isn't there under the crossing's floor)
      { name: 'crossing', plan: [[-63.6, -5.94], [-65.0, -5.98], [-65.0, 3.22], [-63.6, 3.26]], h: [-0.35, 0.05], from: -0.35,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      // the stair hall: concrete walls to a parapet over the platform, falling at its end to the
      // ticket hall's roof; glazed above, under its roof
      { name: "stair hall's walls", plan: [[-65.0, -5.98], [-74.8, -6.26], [-74.8, 2.94], [-65.0, 3.22]], h: [-4.0, 1.0], from: -4.0,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], onPlatform: true, ground: true },
      { name: "stair hall's walls, south", plan: [[-74.8, -6.26], [-80.7, -6.42], [-80.7, 2.78], [-74.8, 2.94]], h: [-4.0, 1.17], low: 0.1, from: -4.0,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], onPlatform: true, ground: true },
      { name: "stair hall's windows", plan: [[-65.0, -5.98], [-74.8, -6.26], [-74.8, 2.94], [-65.0, 3.22]], h: [1.0, 2.95], low: 1.17, from: 1.0,
        walls: 'glazed', sides: [undefined, null, undefined, null] },
      { name: "stair hall's roof", plan: [[-65.0, -6.08], [-80.7, -6.52], [-80.7, 2.88], [-65.0, 3.32]], h: [0, 2.95], low: 0.1,
        walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete', roof: 0.3, roofColor: 0x3a3d40 },
      // the flights' parapets beside the corridor to the lift and beside the ramp, a metre over the steps
      { name: 'west parapet, top', plan: [[-66.3, -3.92], [-67.5, -3.95], [-67.5, -3.75], [-66.3, -3.72]], h: [-4.0, 1.0], low: 0.36, from: -4.0,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x9a978f },
      { name: 'west parapet, landing', plan: [[-67.5, -3.95], [-68.9, -3.99], [-68.9, -3.79], [-67.5, -3.75]], h: [-4.0, 0.36], from: -4.0,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x9a978f },
      { name: 'west parapet', plan: [[-68.9, -3.99], [-75.4, -4.17], [-75.4, -3.97], [-68.9, -3.79]], h: [-4.0, 0.36], low: -3.0, from: -4.0,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x9a978f },
      { name: 'east parapet, top', plan: [[-66.3, 0.98], [-67.5, 0.95], [-67.5, 1.1], [-66.3, 1.13]], h: [-4.0, 1.0], low: 0.36, from: -4.0,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x9a978f },
      { name: 'east parapet, landing', plan: [[-67.5, 0.95], [-68.9, 0.91], [-68.9, 1.06], [-67.5, 1.1]], h: [-4.0, 0.36], from: -4.0,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x9a978f },
      { name: 'east parapet', plan: [[-68.9, 0.91], [-75.4, 0.73], [-75.4, 0.88], [-68.9, 1.06]], h: [-4.0, 0.36], low: -3.0, from: -4.0,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x9a978f },
      // the ramp's side over the corridor, under its glass railing
      { name: "ramp's side", plan: [[-66.3, -1.47], [-78.5, -1.81], [-78.5, -1.76], [-66.3, -1.42]], h: [-4.0, -3.1], low: -3.95, from: -4.0,
        walls: 'boardConcrete' },
      // the glass wall with doors into the ticket hall, concrete above the hall's ceiling
      { name: 'glass wall', plan: [[-80.6, -6.42], [-80.8, -6.43], [-80.8, 2.77], [-80.6, 2.78]], h: [-4.0, 0.1], from: -4.0,
        walls: 'glazed', band: { walls: 'boardConcrete', from: -1.15 } },
      // (nor the platform's end beyond it, over the ticket hall's roof)
      { name: "platform's end", plan: [[-80.7, -5.85], [-83.5, -5.9], [-83.5, 3.6], [-80.7, 3.6]], h: [-0.8, 0.5], from: -0.8,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      // the ticket hall between the bridges' decks, under its flat roof, dug into the bank
      { name: 'ticket hall', plan: [[-80.8, -5.82], [-91.5, -6.13], [-91.5, 1.62], [-80.8, 2.16]], h: [-4.4, -1.15], from: -4.0,
        walls: 'squareTiles', sides: [undefined, null, undefined, null], floor: 'terrazzo', ceiling: 'whiteRender', roof: 0.35, roofColor: 0x77787a,
        onPlatform: true, ground: true },
      { name: "ticket hall's front", plan: [[-91.5, -6.13], [-98.4, -6.27], [-98.4, 1.28], [-91.5, 1.62]], h: [-4.4, -1.15], from: -4.0,
        walls: 'squareTiles', sides: [undefined, 'glassFront', null, null], floor: 'terrazzo', ceiling: 'whiteRender', roof: 0.35, roofColor: 0x77787a,
        onPlatform: true, ground: true },
      { name: 'ticket booth', plan: [[-90.9, -6.12], [-94.5, -6.2], [-94.5, -4.4], [-90.9, -4.4]], h: [-4.0, -1.6], from: -4.0, walls: 'glazed', roof: 0.05 },
      // the shop under the eastern deck, its windows onto the hall, the passage and the court
      { name: 'shop', plan: [[-91.5, 1.62], [-99.0, 1.25], [-99.0, 7.1], [-91.5, 7.47]], h: [-4.4, -1.6], from: -4.0,
        walls: 'shopWindows', sides: [undefined, undefined, undefined, 'boardConcrete'], roof: 0.2, onPlatform: true, ground: true },
      // rooms under the western deck, their outside tiled brown under a band of windows
      { name: 'rooms', plan: [[-80.8, -11.67], [-98.4, -12.12], [-98.4, -6.27], [-80.8, -5.82]], h: [-4.4, -1.6], from: -4.4,
        walls: 'brownWindows', sides: [undefined, undefined, null, 'boardConcrete'], roof: 0.2, onPlatform: true, ground: true },
      // the passage under the tracks: between the decks under the ticket hall's roof, and under the decks
      { name: 'passage', plan: [[-98.4, -6.27], [-106.3, -6.49], [-106.3, 0.82], [-98.4, 1.28]], h: [-4.4, -1.15], from: -4.05,
        walls: 'boardConcrete', sides: [null, undefined, null, null], floor: 'pavers', ceiling: 'whiteRender', roof: 0.35, roofColor: 0x77787a,
        onPlatform: true, ground: true },
      { name: 'passage, west', plan: [[-98.4, -12.12], [-106.3, -12.34], [-106.3, -6.49], [-98.4, -6.27]], h: [-4.4, -1.6], from: -4.2,
        walls: 'boardConcrete', sides: [null, undefined, null, null], floor: 'pavers', ceiling: 'boardConcrete', roof: 0.2, onPlatform: true, ground: true },
      { name: 'passage, east', plan: [[-99.0, 1.25], [-106.3, 0.82], [-106.3, 6.67], [-99.0, 7.1]], h: [-4.4, -1.6], from: -4.1,
        walls: 'boardConcrete', sides: [null, undefined, null, null], floor: 'pavers', ceiling: 'boardConcrete', roof: 0.2, onPlatform: true, ground: true },
      { name: "passage's step, west", plan: [[-98.4, -6.29], [-106.3, -6.51], [-106.3, -6.49], [-98.4, -6.27]], h: [-1.6, -1.15], from: -1.6, walls: 'boardConcrete' },
      { name: "passage's step, east", plan: [[-98.4, 1.28], [-106.3, 0.82], [-106.3, 0.84], [-98.4, 1.3]], h: [-1.6, -1.15], from: -1.6, walls: 'boardConcrete' },
      // the decks' faces over the passage's mouths
      { name: "western deck's face", plan: [[-80.7, -11.67], [-106.3, -12.34], [-106.3, -12.14], [-80.7, -11.47]], h: [-1.6, -0.9], from: -1.6,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x8f8d86, onPlatform: true, nameSign: { side: 0, at: 0.846, length: 4.4, bottom: -1.5 } },
      { name: "eastern deck's face", plan: [[-90, 7.35], [-106.3, 6.47], [-106.3, 6.67], [-90, 7.55]], h: [-1.6, -0.9], from: -1.6,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x8f8d86, onPlatform: true, nameSign: { side: 2, at: 0.224, length: 4.4, bottom: -1.5 } },
      // the bank's retaining wall along the court's north side, east of the deck (Mapillary's
      // panoramas, the laser scan)
      { name: "bank over the court", plan: [[-86, 7.6], [-90.6, 7.4], [-90.6, 22], [-86, 22]], h: [-4.4, -0.8], from: -4.4,
        walls: 'boardConcrete', sides: [null, undefined, undefined, null], roof: 0.05, roofColor: 0x6b7a4a, ground: true },
    ],
    art: [
      { kind: 'rooflights', size: 1.3, ceiling: -1.15, top: -0.8,
        at: [[-83.5, -4.0], [-83.5, -0.1], [-87.5, -4.0], [-87.5, -0.1], [-91.5, -4.0], [-91.5, -0.1], [-95.5, -4.0], [-95.5, -0.1],
          [-99.25, -4.1], [-99.25, -2.2], [-99.25, -0.25], [-101.25, -4.1], [-101.25, -2.2], [-101.25, -0.25], [-103.25, -4.1], [-103.25, -2.2], [-103.25, -0.25]] },
      { kind: 'roundel', s: -97.0, u: 7.25, h: -0.3, size: 1.0, foot: -0.95 },
    ],
    // between the columns, down the middle of each butterfly
    benches: [
      { at: [-9.25, 28.25] },
      { at: [5.75, 43.25], roof: 0 },
    ],
    // chain-link beyond both tracks, and tall on the decks' faces
    fences: [
      { points: [[-78, -11.34], [-60, -10.8], [-40, -10.3], [-20, -9.9], [0, -9.6], [20, -9.1], [40, -8.5], [60, -7.8], [80, -7.2], [90, -7.0]], h: [-1.5, 0.5] },
      { points: [[-88, 7.9], [-78, 7.9], [-60, 8.5], [-40, 9.1], [-20, 9.4], [0, 9.6], [20, 9.4], [40, 9.0], [60, 8.3], [80, 7.4], [90, 6.9]], h: [-1.5, 0.5] },
      { points: [[-80.7, -11.57], [-90, -11.85], [-100, -12.05], [-106.3, -12.24]], h: [-0.9, 1.3] },
      { points: [[-90, 7.45], [-100, 6.95], [-106.3, 6.57]], h: [-0.9, 1.3] },
    ],
  },
};
