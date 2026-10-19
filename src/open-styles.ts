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
  // the name on its blocks' signs, where it is written otherwise than in the map (S:t Eriksplan)
  signName?: string;
  // the art on the platform: sculptures, and panels hung between the roof's columns
  art?: Art[];
  // fences along the tracks, beyond them
  fences?: Fence[];
  // benches down the middle of the platform at these `s`: along it, or across it, against the
  // panel between a pair of columns; `double`, two back to back along it; `wood`, their slats
  // wooden; `roof`, down the middle of one of `roofs` (its index) rather than of `roof`'s, over
  // another platform beside it; or several such rows
  benches?: Benches | Benches[];
  // under a hall rather than a roof, the line down the middle of the platform the benches follow,
  // through these [s, u] (along s at u 0 without)
  middle?: [number, number][];
  // glass shelters on the platform, from s[0] to s[1] and u[0] to u[1] across the line down its
  // middle, glazed along both sides and open at the ends, with a bench inside; out in the open,
  // a flat roof of their own; `under`, down the middle of one of `roofs` (its index), as a row of
  // benches can be
  shelters?: { s: [number, number]; u: [number, number]; roof?: boolean; under?: number }[];
  // a station under a deck whose hall it draws itself (Liljeholmen's): within `s` and `u` of its
  // frame (`at`: its layout's x, z and yaw), the network (src/network.ts) draws no tunnel round
  // the tracks, nor lamps over the platforms or name signs on the walls, paves the platforms as
  // `paving`, and takes each half of an island no track pairs with across it to halfway to the
  // next track (a hall lights its platforms as a tunnel's are lit); and where the buildings on
  // the deck stand over the tracks, the city (tools/build-city.ts) stands them on the deck, `deck`
  // metres over the platforms, not on a tunnel's roof under the hall's ceiling
  hall?: { at: [number, number, number]; s: [number, number]; u: [number, number]; deck?: number };
}

// whether the network leaves the tunnel at (x, z) to a station that draws its own hall
let HALLS: NonNullable<OpenStyle['hall']>[] | null = null;
export function hallDrawn(x: number, z: number) {
  HALLS ??= Object.values(OPEN_STYLES).flatMap((st) => (st.hall ? [st.hall] : []));
  for (const h of HALLS) {
    const [hx, hz, yaw] = h.at, fx = -Math.sin(yaw), fz = -Math.cos(yaw), dx = x - hx, dz = z - hz;
    const s = dx * fx + dz * fz, u = -dx * fz + dz * fx;
    if (s >= h.s[0] && s <= h.s[1] && u >= h.u[0] && u <= h.u[1]) return true;
  }
  return false;
}

export interface Benches { at: number[]; across?: boolean; double?: boolean; wood?: boolean; roof?: number }

// A roof whose two halves slope down to a valley along its middle, held up by a row of columns
// down the middle of the platform under a beam along the valley.
export interface ButterflyRoof {
  kind: 'butterfly';
  from: number; to: number;    // along the platform
  width: number;
  offset?: number;             // its middle this far to the right of the platform's
  // or a lean-to, sloping one way across from `edge` on its left to `middle` on its right (or,
  // -1, from `edge` on its right)
  lean?: 1 | -1;
  // or, where its tracks curve apart and the platform widens, its middle (this far to the right of
  // the platform's) and its width at points along it ([s, u, width]), straight between them
  shape?: [number, number, number][];
  // the whole roof raised this much (dh) at points along it ([s, dh]), straight between them and
  // level past them: climbing over a ramp up from the platform (Telefonplan's)
  climb?: [number, number][];

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
  // (in `color`, the steel's by default)
  purlins?: { at: number[]; size: [number, number]; color?: number };
  // a steel channel along the valley, wide and deep (in `gutterColor`, the steel's by default)
  gutter?: [number, number];
  gutterColor?: number;
  // raised bays across the roof, each `length` long with its middle at one of `at`: a covering
  // pitched both ways along the platform from a ridge across it, `ridge` over the platform
  lanterns?: { at: number[]; length: number; ridge: number };
  // or vaulted bays along it, each `length` long from `from`: the underside and the covering arch
  // `rise` up from each bay's ends to its middle (a barrel across the platform), the beams along
  // it staying at the bays' ends' height, so that each bay's arch shows over the fascia
  barrels?: { length: number; rise: number };
  // columns `every` m, one of them at `at`, only `between` these `s` if given; or pairs of them
  // across the platform, `pair` apart, each under a beam of its own; `braces`, knee braces from
  // each column up to the beam this far along it either way; `casings`, a dark box round the
  // columns at these `s`, `size` across and along; `offset`, the columns (and the beams over
  // them, and the signs) this far to the right of the roof's middle; `edges`, pairs of them each
  // this far in from the roof's edges, however wide it is there; `cross`, a steel beam across the
  // roof over each pair, from edge to edge, its underside `cross[0]` over the platform and
  // `cross[1]` deep (and the columns on up through it to the rafters over them); `ties`, steel
  // bars across between each pair at these heights, and one slanting from the lowest at one
  // column to the highest at the other; `portal`, a steel plate across between each pair from
  // `top` down to an arch cut out of it, springing from the columns `spring` high, its crown
  // `crown` high, with flat bars across lower down at `bars`, and (`pipe`) a black downpipe from
  // the valley to the platform between them; or (`hole`) the plate's foot flat at `spring`, and
  // a round hole through it, its middle `hole.at` high, `hole.r` across; `gaps`, none between
  // these pairs of `s` (where a building on the platform carries the roof)
  columns: {
    every: number; at: number; size: number; plinth: { size: number; height: number }; pair?: number;
    between?: [number, number]; gaps?: [number, number][]; braces?: number; casings?: { at: number[]; size: [number, number] }; offset?: number;
    edges?: number; cross?: [number, number]; ties?: number[];
    portal?: { spring: number; crown: number; top: number; bars?: number[]; pipe?: boolean; hole?: { at: number; r: number } };
  };
  // rows of strip lights along the underside, `offset` either side of the beam (or at these `u`
  // across the roof's middle): fittings `length` long, `every` apart; `tube`, in a long round
  // housing hung under the rafters; `across`, the fittings lying across the platform
  lamps: { offset: number; length: number; every: number; at?: number[]; tube?: boolean; across?: boolean };
  colors: { underside: number; fascia: number; top: number; steel: number };
  // name signs hung under the beam at these `s`, with the way out at each end of the platform
  // (none if empty); or, between a pair of beams, from the rafters, `bottom` over the platform;
  // black, or (`blue`) SL's dark blue over a yellow stripe; `across`, hung across the platform
  // from the underside with their middle at this `u`, facing along it (with no way out)
  signs: { at: number[]; back: string; ahead: string; bottom?: number; blue?: boolean; across?: number };
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
  // the edge's stones (or tiles) across it and along, if not one 60 cm stone across all of it
  edgeTile?: [number, number];
  tactile: [number, number];
  studs?: boolean;
  // studs of another colour (brass), rather than the strip's own, lighter
  studColor?: number;
  slabs: number;
  slabSize?: [number, number];
  paverSize?: [number, number];
  mix?: number;
  colors: { edge: number; tactile: number; slab: number; pavers: number; face: number; paler?: number };
  // pale veins wandering across it, as in polished stone
  veins?: boolean;
  // herringbone pavers, rectangular ones in a running bond, square tiles in a grid, small setts
  // laid in fans, or asphalt, laid without joints (in the pavers' colour)
  pattern: 'herringbone' | 'bond' | 'grid' | 'fans' | 'asphalt';
  // thin lines of brass let into it, crossing it in long triangles that repeat `every` m along
  // the platform (Liljeholmen's terrazzo)
  lines?: { color: number; every: number };
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
// `parapet`: its stairs and escalators climb open under a ceiling over them all (a block's), the
// walls beside them only this high over their steps, with no ceiling of their own; with a `sill`
// as well, the walls beside its stairs rise to the sill, or this high over their steps where that
// is higher (stairs climbing out of a trench into a glass house over it). `lamps`: its
// open floors, under a block's roof, lit by a row of lamps hung this high over them.
// `left`: the walls on the left (facing −u, looking along the platform) in this finish instead;
// `back`, those at the back (facing −s).
export interface Room {
  name: string;
  s: [number, number]; u?: [number, number]; h: [number, number];
  walls?: Finish | null; floor?: Finish | null; ceiling?: Finish; stairs?: Finish; left?: Finish; back?: Finish;
  roof?: number; slab?: number; sill?: number; parapet?: number; lamps?: number;
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
  | 'brownWindows'  // small brown tiles to a sill, windows in dark frames above, a concrete beam over them
  | 'terracottaPanels' // flat panels, terracotta red, 0.6 by 1.2 m
  | 'orangeTiles'   // orange-red tiles, 20 cm
  | 'redGranite'    // polished red-brown granite in large slabs
  | 'brick'         // red-brown brick in a running bond
  | 'steelGlazed'   // small white tiles to a sill, two rows of windows in brushed steel frames above
  | 'darkTerrazzo'  // dark grey terrazzo, speckled white
  | 'birchX'        // dark grey stone, a pale X of birch bark from corner to corner of each 5.4 by 2.6 m
  | 'tealTiles'     // pale teal tiles, 15 cm, to 2.35 m, a band of black glass above
  | 'darkWindows'   // a dark panel to 0.95 m, windows 0.6 m wide in black frames above, a transom at 2.3 m
  | 'blackFront'    // glass doors in brushed steel, the black band the name goes on, a steel ledge, glass above
  | 'orangePanels'  // flat steel panels painted orange
  | 'splitBlocks'   // grey concrete blocks with a split face, 40 by 20 cm
  | 'cladding'      // silver-grey sheet metal, ribbed upright
  | 'cladClerestory' // as cladding to 4.5 m, four rows of glass in grey frames above, to 7.6 m
  | 'frostedPanels' // white frosted glass panels in bronze frames on a concrete plinth
  | 'redRock'       // the rock sprayed with concrete and painted a deep red, mottled
  | 'redBand'       // a band of windows in red steel frames, the sky in their glass
  | 'redFront'      // glass doors in brushed steel, the name's band, glass in red steel frames above
  | 'gridPanels'    // a dark plinth, and over it pale grey-white panels in a grid, 1.25 m wide
  | 'navyTiles'     // glossy navy-blue tiles on end, 15 by 30 cm, in pale joints
  | 'pineBoards'    // narrow boards of varnished pine, a soffit's or ceiling's
  | 'redTiles'      // glossy red tiles, 30 cm, in pale grey joints
  | 'bronzeGlass'   // a curtain wall of bronze-grey tinted glass in dark frames, 1.5 by 1.8 m
  | 'greenTiles'    // small square tiles, a sea green
  | 'crossMosaic'   // warm yellow tiles, and on them round clusters of small cross-shaped tiles (Mari Pårup's)
  | 'crossTerrazzo' // dark grey terrazzo, small pale crosses set in it here and there
  | 'bronzeGlazed'  // clear glass in thick dark bronze frames, a rail across at 1.1 m
  | 'pixelTiles'    // pale blue tiles, 15 cm, figures and bands picked out in coloured tiles (Lars Arrhenius's)
  | 'ballast'       // a track's ballast: crushed grey stone
  | 'strawTiles'    // glazed tiles, 15 cm, straw yellow, in pale joints
  | 'reedTiles'     // as strawTiles, reeds of white tiles rising across them (Henjasaj Koda's)
  | 'iceTerrazzo'   // pale beige terrazzo, fields of blue-grey and small dark blue triangles (Henjasaj Koda's)
  | 'rockMosaic'    // a cement mosaic of black and cream striations, as in polished rock (Henjasaj Koda's)
  | 'clinkerWindows' // clinker tiles in mixed greens to 1 m, glass-fronted cases, windows in steel frames above
  | 'greyClerestory' // grey sheet-metal panels to 1.75 m, a band of windows in dark frames above
  | 'portalTiles'   // glazed tiles, 15 cm, a muted teal green, in pale joints
  | 'liftPanes'     // grey glass panes in pale frames, a tall row and a short one, between dark blue-grey steel piers
  | 'roxnerTiles'   // glazed tiles, 15 cm, in some twenty pale colours at random (Rigmor Roxner's)
  | 'roxnerClerestory' // as roxnerTiles to 3 m, a concrete beam, windows in dark frames above
  | 'greyGlazed'    // a dark grey steel panel to 0.95 m, glass in dark grey steel frames above
  | 'sageRender'    // smooth render, a pale grey green
  | 'bottleTiles'   // glazed tiles, 15 cm, a dark bottle green, in pale joints
  | 'purpleTiles'   // tiles on end, 10 by 30 cm, purples, lilac, dark blue and white, to 2.5 m; board-marked concrete above
  | 'rivetedSteel'  // brushed stainless steel panels, 1.2 m wide, rows of rivets along their edges
  | 'glossTiles'    // glossy white tiles, 25 cm, in pale grey joints
  | 'stripeTiles'   // as glossTiles, upright stripes across them of a red slip beside a column of ochre tiles
  | 'twoGreens'     // flat panels 0.95 m wide, a lighter green and a bottle green in turn, on a black plinth
  | 'latticeConcrete' // grey concrete under a diagonal lattice of weathered grey battens
  | 'scrollPanels'  // glazed tiles, 15 cm: bands of black and white scrolls between panels patterned in olive, ochre, red, purple and teal (Åsa Lindström's)
  | 'opPanels'      // glazed tiles, 15 cm: panels patterned in black, white and grey between orange-red strips, to 2.25 m; orange-red tiles above (Åsa Lindström's)
  | 'circleFront'   // glass doors in brushed steel under SL's dark blue band, a white disc on it, a yellow line under it; glass in steel frames above
  | 'stripPanels'   // pale grey panels 0.9 m wide between black strips, to 2.6 m; windows in grey steel frames above
  | 'maroonGlazed'  // clear glass in dark red-brown steel frames 1.2 m apart, a transom 2.2 m up
  | 'slateGlazed'   // clear glass in slate-blue steel frames 1.4 m apart, a transom every 1.15 m
  | 'goranssonTiles' // glazed tiles, 15 cm, whites and pale greys, relief tiles with leaf prints scattered over them (Mia Göransson's)
  | 'greenBooth'    // square green enamelled panels, a window in a cream frame in the top row, a cream band over them
  | 'barkGrey'      // grey concrete cast with a bark of deep upright fissures (Casimir Djuric's trees)
  | 'barkRed'       // as barkGrey, stained a red-brown
  | 'checkTiles'    // glossy tiles on end, 15 by 30 cm, white and a pale blue-grey in a check
  | 'mosaicPosters' // a mosaic of small tiles in dark greens, posters in pairs in white frames from 2.3 m up, to 4.05 m
  | 'vallingbyCentrum' // shop fronts under a canopy's white edge, corrugated sheet metal, a ribbon of windows in white frames, to 8 m
  | 'wiredGlazed'   // as greenGlazed, the glass wired: translucent, a pale grey with a fine mesh of wire in it
  | 'dripTiles'     // small square tiles, a warm yellow (yellowTiles), under dark green ones dripping down from 2.1 m
  | 'ochreDoor'     // as yellowTiles, an orange steel door in them 0.5 m from the left
  | 'greenEnamel'   // panels of green glass enamel, 1.2 by 1.1 m, glossy, in thin dark joints
  | 'tornellEnamel' // as greenEnamel, perforated in a burst about the middle of each 4.8 m and lit from behind (Pia Törnell's)
  | 'brownTiles'    // dark brown tiles, 20 cm, in lighter joints
  | 'partosTiles'   // white tiles, 15 cm, clouds of small coloured tiles drifting over them (Christian Partos's)
  | 'cafeWall'      // black and white tiles, 15 cm, each row shifted along from the one under it, in grey joints
  | 'iridescentTiles' // shimmering tiles, 30 cm, in greens, ochres and mauves, a copper spiral on some
  | 'striated'      // dark concrete panels 1.25 m wide, cast with fine diagonal grooves, on a pale plinth
  | 'triangleTiles' // white tiles, 15 cm, a long triangle of small blue tiles rising low across them
  | 'redClinker'    // clinker in a running bond, red-browns and a dark brown-grey
  | 'rods'          // upright rods of yellow-brown glazed ceramic over a dark plinth, a white band over them (Björquist's and Abramson's)
  | 'wineTiles'     // narrow glazed tiles on end in wine reds and browns, rows a third of a metre high, an ochre tile every 1.1 m in each
  | 'uprightTiles'  // white glazed tiles on end, 10 by 20 cm, in pale grey joints
  | 'bandGlazed'    // clear glass in brushed steel frames 1.3 m apart, a kick panel, a transom with SL's dark blue band over a yellow line
  | 'shards'        // grey concrete set with skewed plates of colour, greys, white, blues, beige and brick red (John Stenborg's)
  | 'narrowTiles'   // white glazed tiles on end, 7 by 24 cm, in a running bond up the wall, in grey joints (Hornstull's)
  | 'brassTerrazzo' // green terrazzo, thin lines of brass crossing it in long triangles (Liljeholmen's)
  | 'kransenTiles'  // cream glazed tiles on end, 5 by 24 cm, in a stack bond, in grey joints (Midsommarkransen's)
  | 'kransenHall'   // as kransenTiles to 2.5 m, a band of brown glazed tiles to 2.9 m, white render above
  | 'ochreClinker'  // glossy mustard clinker, 20 cm, in pale grey joints (Telefonplan's)
  | 'morseClinker'  // as ochreClinker, the name in Morse code up it to 2.2 m in columns of teal-green tiles (Bo Samuelsson's)
  | 'blastedRock'   // the rough grey face of a cutting blasted through the rock, cracked and stained rust brown
  | 'kioskFront'    // a newsagent's front: shop windows with posters between yellow posts, black panels over them
  | 'tfpWestFront'  // Telefonplan's station building to the west: the newsagent's, the station's doors, a florist's, brick
  | 'tfpSouthFront' // and to the south, brick: a florist's board, the station's doors, an orange door, three windows
  | 'tricolourWindows' // tiles, 15 cm, oxblood, white and grey in diagonal rows, to a sill; clear glass in oxblood frames above
  | 'tricolourTiles' // the same tiles all the way up
  | 'quarryTiles'   // unglazed floor tiles, 20 cm, red-brown and dark grey at random, in dark joints
  | 'darkBoards'    // narrow boards of dark-stained timber, a ceiling's
  | 'hgaFront'      // Hägerstensåsen's pavilion to Sedelvägen: brown ribbed panels, the glass doors, brick with a newsagent's, clerestory windows over them
  | 'creamRender'   // smooth render, a pale warm cream (Västertorp's ramp)
  | 'slateFlags'    // irregular flags of dark grey-green slate in pale joints, a floor's
  | 'darkPavers';   // dark grey concrete pavers in a running bond (Västertorp's ramp)

// A building's shell round the quadrilateral `plan` ([s, u], in order round it): its walls from
// `from` (the platform's level by default) up to `h[1]` (concrete below, down to `h[0]`), a roof
// this thick, and a floor at `from` wherever the station's own floors leave it open. The
// station's parts open through it. `low`: its top falls from `h[1]` at its first and last corners
// to this at the other two; `lowBack`, from h[1] at its first two corners to this at the other two.
// `fall`: its floor falls from `from` at its first two corners to this at the other two, and its
// top with it. `sides` gives a side (from corner i to the next) a finish of its own,
// or none (null); `ceiling`, the underside of its roof a finish (a glass one, with no `roof`
// over it, is a glazed roof: its frames with panes in them, the sky through them); `band`, the walls a finish of
// their own all round from a height up (rising or falling with the top to `low` at the corners
// its `low` is at, as a band of windows under a sloping roof does); `lights`, lit yellow signs on a side, `at` the way along
// it (0 to 1) and `length` long. `onPlatform`: it stands on the platform, which isn't there to
// be walked on inside it (only the station's own floors are); `inHall`, in the platform's hall
// the network draws, which otherwise hides what the station draws in it. `nameSign`: the station's name in
// white on a blue band over a side's doors, `at` the way along it, `length` long, from `bottom`
// up (on the side's inner face, `inside`; black, as SL's older signs are, `black`). `eaves`: its roof reaches out this far past its walls,
// along each side (or all round). `ground`: it is dug into the city's ground, which isn't there
// inside it (nor, a number, this far over its top: a street laid on the ground, which the
// elevation model's 5 m grid humps over here and there, and slopes over up to a deck above
// it). `roofColor`: its roof this colour (dark grey by default); `brackets`, steel brackets
// of this colour under the eaves, from the walls' top out to the roof's edge, about `every` m
// apart along each side the eaves reach out from. `gables`: on its roof, `count` gables side by
// side along its first side, each pitched `rise` up to a ridge running across the block (parallel
// to its second side), their slopes in `roofColor`, their ends in `color` with a trim of `trim`
// along their edges, and a strip of glass down each slope; or (`round`) vaults, rising `rise` in a
// half-ellipse, glass along their crowns (or, `glass`, glazed all over on arched ribs of this
// colour about `ribs` m apart, and glazing bars along them). `arch`: a hole in side `side`'s
// wall under a segmental arch, from `span[0]` to `span[1]` m along the side from its first
// corner, springing `spring` high at its ends and rising to `crown` (where a vault the network
// draws runs on under the block, Blackeberg's). `dome`, in place of a flat roof: a shallow groin
// vault over the block (Blackeberg's hall), its underside along each side an arch from `spring`
// high at the corners to `arch` at the middle, and rising between them to `crown` over the
// middle; `thick` thick, board-marked underneath and covered in `roofColor`, with a beam `beam`
// deep along its edges; under each side's beam, from the block's top (`h[1]`) up, a lunette
// glazed in frames of `frame` colour about `frames` m apart, with a transom.
export interface Block {
  name: string; plan: [number, number][]; h: [number, number]; from?: number; fall?: number; low?: number; lowBack?: number; eaves?: number | number[]; ground?: boolean | number;
  walls: Finish; sides?: (Finish | null | undefined)[]; band?: { walls: Finish; from: number; low?: number };
  floor?: Finish; ceiling?: Finish; roof?: number; lights?: { side: number; at: number; length: number }[];
  onPlatform?: boolean; inHall?: boolean; nameSign?: { side: number; at: number; length: number; bottom: number; inside?: boolean; black?: boolean };
  roofColor?: number; brackets?: { every: number; color: number };
  gables?: { count: number; rise: number; color: number; trim: number; round?: boolean; glass?: { ribs: number; color: number } };
  arch?: { side: number; span: [number, number]; spring: number; crown: number };
  dome?: { spring: number; arch: number; crown: number; thick: number; beam: number; frames: number; frame: number };
}

export type Art = Guardian | Stacks | Panels | Masts | Mural | Chairs | Roundel | GlassStacks | GlassPosts | Figure | FoolsShip | Cone | Growth | Ruler | Stone | Columns | Tulip | Bird | Rooflights | Checks | Birches | LightBoxes | SlabBenches | BronzeFrames | Mushrooms | NeonBoxes | Capitals | Traveller | CastColumn
  | TramTrack | Catenary | EdgePaving | Revolver | DeckCeiling | Wreath;

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
// reaching only to the left, with one, `lowerOne`); `shade`, the lamps' shades this colour (white
// by default).
export interface Masts { kind: 'masts'; at: [number, number][]; height: number; color?: number; top?: boolean; sign?: number; blue?: boolean; arm?: number; lower?: number; lowerOne?: boolean; shade?: number }

// A picture on a wall, facing `turn` as a guardian does, its middle at s, u, from `bottom` to
// `top` and `width` across; drawn in code (src/textures.ts): the dragon of Tallkrogen's, a
// mosaic of a forest's floor, one of Gullmarsplan's angels, cut out round its outline, or Sture V
// Nilsson's Strindberg wall at Rådmansgatan: his manuscript, his signature and squares of etched
// copper (`strindberg`), Blå tornet, the house he died in (`blueTower`), and one of Helén Partos's
// panels of steel lace at Vällingby (`sirat`, cut out round its outline, a panel of its own at each
// `s`), and Britt-Louise Sundell's gates of wrought iron at Mariatorget (`sundell`, cut out round
// the iron), and the paintings on the ends of Zinkensdamm's platforms, Göran T Karlsson's
// (`karlsson`) and John Stenborg's (`stenborg`).
// And at Midsommarkransen, the panel at the end of its middle hall, FÖRSTADEN · MIDSOMMARKRANSEN
// over a panorama of the suburb (`forstaden`), and the painted wooden relief of a summer night on a
// platform's wall (`summerNight`).
// And on the walls of Västertorp's ramp, Jörgen Fogelquist's sgraffito of Andrée's flight towards
// the pole: the balloon, its drag ropes and the crack in the ice (`andreeBalloon`), and the eagle
// on its field of night (`andreeEagle`), both cut out round the drawing.
export interface Mural { kind: 'mural'; picture: 'tallkrogsdraken' | 'forestFloor' | 'angel' | 'strindberg' | 'blueTower' | 'sirat' | 'sundell' | 'karlsson' | 'stenborg' | 'forstaden' | 'summerNight' | 'andreeBalloon' | 'andreeEagle'; s: number; u: number; turn: number; bottom: number; top: number; width: number }

// The midsummer wreath of carved and painted alder at Midsommarkransen (1978, inaugurated 1979; Hans
// Flemström Nilsson, Anna Flemström Nilsson and Stina Zetterman, students at Konstfack, with the
// suburb's people): a fat ring of leaves `size` m across, `thick` m round its thickness, a red
// ribbon wound round it, and on it ox-eye daisies, buttercups, harebells and violets; hung flat on
// four wires from a round plate on the ceiling (`ceiling` high), its middle `h` high at s, u; or
// (`turn`) standing on a wall, facing `turn` as a guardian does, its ribbon in broad bands of
// orange-red (the two smaller ones on the panel in the middle hall).
export interface Wreath { kind: 'wreath'; s: number; u: number; h: number; size: number; thick: number; ceiling?: number; turn?: number }

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
// across and high, turned `turn` (radians, as a guardian's) and leaning `lean` to its right; or a
// slab of split grey granite (`granite`, or another stone split as it is, of this `color`: black
// diabase); its foot `y` over the platform (on it by default).
export interface Stone { kind: 'stone'; s: number; u: number; size: [number, number, number]; turn: number; lean: number; granite?: boolean; color?: number; y?: number }

// Richard Nonas's benches (Skarpnäck, 1994): each a U of split dark granite at s, u (in the
// station's frame), two slabs on end `height` high, `span` apart inside, and a thick slab between
// them for the seat; the seat across the platform (or, `along`, along it).
export interface SlabBenches { kind: 'slabBenches'; at: [number, number][]; span: number; height: number; along?: boolean }

// Carl Magnus's sculptures (Skärmarbrink, 1990): frames of square bronze bars `bar` thick,
// patinated green, on a concrete plinth (`plinth`: long, wide and high) at s, u (in the station's
// frame), turned `turn` (radians, as a guardian's). Each of `bars` from [x0, y0] to [x1, y1] in a
// plane `d` across the plinth from its middle (x along it, y up from its top), [x0, y0, x1, y1, d].
export interface BronzeFrames { kind: 'bronzeFrames'; s: number; u: number; turn: number; plinth: [number, number, number]; bar: number; bars: [number, number, number, number, number][] }

// Carina Wallert's Resande med djur (Kristineberg, 1991): on a long concrete plinth at s, u (in the
// station's frame), turned `turn` (radians, as a guardian's) from lying along it, a traveller of
// dark bronze, angular as if folded out of sheet, seated at its back end on a block behind an
// upright one, an arm over it; a lean dog lying stretched out along the plinth in front of them,
// its head raised; and a wedge of concrete along the plinth's far side, sloping up away from the
// dog.
export interface Traveller { kind: 'traveller'; s: number; u: number; turn: number }

// Carl Fredrik Reuterswärd's Non-Violence (Åkeshov, 1998): a revolver of dark bronze, `size` long,
// standing on its grip at s, u (in the station's frame) on a plinth `h` high, its barrel tied in a
// knot and its muzzle turned up out of the knot, the barrel pointing `turn` (radians, as a
// guardian faces).
export interface Revolver { kind: 'revolver'; s: number; u: number; h: number; turn: number; size: number }

// A tram's track through the points ([s, u, h], in the station's frame, `h` the sleepers' top over
// the platform), on ballast drawn by a block's floor: its sleepers and two rails, and (`buffer`) a
// buffer stop at its last point.
export interface TramTrack { kind: 'tramTrack'; points: [number, number, number][]; buffer?: boolean }

// The overhead line over trams' tracks: steel masts at `masts` ([s, u, foot], in the station's
// frame), `height` high, each with an arm out over the wires either side of it; along each of
// `wires` (points [s, u, h], `h` the contact wire's height) a contact wire, and a messenger wire
// 1.1 m over it hung from the arms.
export interface Catenary { kind: 'catenary'; masts: [number, number, number][]; height: number; wires: [number, number, number][][] }

// The platform's paving laid along an edge the network doesn't draw as one (Alvik's, beside the
// Nockebybanan's tracks between its two islands): the edge along the line through the points
// ([s, u], or [s, u, h] over the platform's top), and its stones, strip for the blind and slabs
// `width` in from it, to the line's right (or `left`).
export interface EdgePaving { kind: 'edgePaving'; points: ([number, number] | [number, number, number])[]; width: number; left?: boolean }

// Round columns at the points ([s, u]), `size` across, from `from` up to `to`, in `color`; and
// (`crown`) on each a funnel `h` deep, spreading to `size` across at its top, its sides lit from
// within in upright stripes of one of `colors` in turn and white (Liljeholmen's).
export interface Columns {
  kind: 'columns'; at: [number, number][]; from: number; to: number; size: number; color: number;
  crown?: { h: number; size: number; colors: number[] };
}

// A ceiling under a deck (Liljeholmen's): steel beams across the hall, painted `color`, `beam`
// across and deep, every `every` m (one at `at`) from s[0] to s[1], each from u[0] to u[1], their
// undersides `soffit` high; between them panels of grey perforated sheet metal in shallow barrels
// along the hall, each `panel` across, springing from steel ribs along it `spring` high and rising
// `rise` to its crown; and strip lights in a row along each of `lamps` (points [s, u]), hung
// `lampAt` high. Cut where the station's stairs climb through it, and left out over the openings
// in the deck, `holes` ([s0, s1, u0, u1]).
export interface DeckCeiling {
  kind: 'deckCeiling'; s: [number, number]; u: [number, number]; every: number; at: number; beam: [number, number]; soffit: number;
  panel: number; spring: number; rise: number; color: number; lamps: [number, number][][]; lampAt: number;
  holes?: [number, number, number, number][];
}

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

// Patches of the platform's paving laid in a check of its own tiles and pale ones, `rows` tiles
// along and `cols` across, `tile` m square (or `size` along and across), their middles at the
// points ([s, u], across from the roof's middle), the pale ones `color`; or (`solid`) all of them
// in `color`, as Kristineberg's bands of red pavers; laid `h` over the line down the platform's
// middle, where one half of an island stands a little higher than the other.
export interface Checks { kind: 'checks'; at: [number, number][]; rows: number; cols: number; tile: number; size?: [number, number]; solid?: boolean; color: number; h?: number }

// Lenka Jonesson's Björkar (Björkhagen, 1991): a cube of rusted steel bars `size` across on a
// concrete plinth, turned `turn` from the platform's line, with birch trunks (one, or three side by
// side) leaning through it from a bottom corner up to the opposite top edge.
export interface Birches { kind: 'birches'; s: number; u: number; turn: number; size: number; trunks: 1 | 3 }

// Björn Olsén's Ljuslådor med hemliga tecken (Kärrtorp, 1994): boxes of light at the points ([s, u],
// in the station's frame), each `w` wide, `h` high and `depth` deep with rounded corners, a steel
// frame (pale grey, or `frameColor`) round coloured glass on both faces (`colors`, in turn), a sign
// on each (numbered from `sign`), facing `turn` as a guardian does; its foot `bottom` over the
// ground (`ground` high), on a steel post, on a concrete plinth (`plinth`: size across, height).
export interface LightBoxes {
  kind: 'lightBoxes'; at: [number, number][]; w: number; h: number; depth: number; bottom: number; turn: number;
  colors: number[]; sign?: number; ground?: number; plinth?: [number, number]; frameColor?: number;
}

// Gullmarsplan's columns under the deck, at the points ([s, u], in the station's frame): a square
// casing `size` across of glossy tiles, black up to `red[0]` and red from there to `red[1]`; over
// it a round concrete shaft `shaft` across, flaring from `flare` up into a head `head` across under
// the ceiling, `ceiling` high.
export interface Mushrooms { kind: 'mushrooms'; at: [number, number][]; size: number; red: [number, number]; shaft: number; flare: number; head: number; ceiling: number }

// Rådmansgatan's ticket-hall columns (1952), at the points ([s, u], in the station's frame): square,
// `size` across, in `tiles` from the floor (`from` high) up to `flare`, where a capital of white
// plaster spreads in straight sides to a square `head` across under the ceiling, `ceiling` high.
export interface Capitals { kind: 'capitals'; at: [number, number][]; size: number; tiles: Finish; from: number; flare: number; head: number; ceiling: number }

// Eva Ziggy Berglund's column at Hornstull, I minnet gjutet (2012), at s, u, standing on the floor
// `from` high and spreading under the ceiling `ceiling` high: a bulging foot of cast iron, a ring of
// cast things round its top; over it a trunk of pale acrystal with a ring of mouths round it, and
// a capital curving out to the ceiling, `head` across (photographs, 2013).
export interface CastColumn { kind: 'castColumn'; s: number; u: number; from: number; ceiling: number; head: number }

// Leif Tjerned's boxes of neon (Gullmarsplan, 1995): dark boxes hung under the ceiling, `ceiling`
// high, at the points ([s, u], in the station's frame), each `size` along, across and deep, with
// coloured glass in its underside lit from within; and strokes of neon, red or yellow, hung under
// the ceiling at `tubes` ([s, u, turn, colour]: each 1.6 m long, `turn` radians from along the
// platform, 0 red and 1 yellow).
export interface NeonBoxes { kind: 'neonBoxes'; at: [number, number][]; size: [number, number, number]; ceiling: number; tubes?: [number, number, number, number][] }

// A fence through the points ([s, u], or [s, u, dh] where the ground it stands on is dh higher
// than at the first point), from `h[0]` to `h[1]` high: chain-link on posts (coated in `color`,
// if given); or boards, standing
// side by side (`color`), or slanting between concrete posts (`louvres`); or panes of glass in
// steel frames (`glass`), on most of them a leaf drawn in white (`leaves`); or a railing of round
// rails on posts (`rails`, in `color`), three of them, the top one at `h[1]`; or black steel
// railings of upright bars between a top rail and a bottom one (`bars`, in `color` if given).
export interface Fence { points: ([number, number] | [number, number, number])[]; h: [number, number]; kind?: 'chainLink' | 'boards' | 'louvres' | 'glass' | 'rails' | 'bars'; color?: number; leaves?: boolean }

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
      { name: "deck's south fascia", plan: [[-126, 5.87], [-87, 5.6], [-87, 5.85], [-126, 6.05]], h: [-2.2, -0.5], from: -2.2,
        walls: 'boardConcrete', sides: [null, undefined, undefined, undefined], roof: 0.02, roofColor: 0x8f8d86,
        nameSign: { side: 2, at: 0.69, length: 5, bottom: -1.6 } },
      // the bank's walls of granite, east of the deck and west of the rooms
      { name: "bank's north wall", plan: [[-87, -9.6], [-76, -9.45], [-76, -9.7], [-87, -9.85]], h: [-4.45, -0.5], from: -4.45,
        walls: 'granite', sides: [null, undefined, undefined, null], roof: 0.02, roofColor: 0x8f8d86 },
      { name: "bank's south wall", plan: [[-87, 5.6], [-76, 5.87], [-76, 6.05], [-87, 5.85]], h: [-4.45, -0.5], from: -4.45,
        walls: 'granite', sides: [null, undefined, undefined, null], roof: 0.02, roofColor: 0x8f8d86 },
      { name: "bank's north wall, west", plan: [[-146, -7.85], [-126, -9.05], [-126, -9.3], [-146, -8.1]], h: [-4.45, -0.5], from: -4.45,
        walls: 'granite', sides: [null, null, undefined, undefined], roof: 0.02, roofColor: 0x8f8d86 },
      { name: "bank's south wall, west", plan: [[-146, 7.15], [-126, 5.87], [-126, 6.05], [-146, 7.4]], h: [-4.45, -0.5], from: -4.45,
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

  // Hammarbyhöjden (17 April 1958, rebuilt 2003): an island platform out in the open between
  // Finn Malmgrens plan and Ulricehamnsvägen, with a ticket hall at each end. Lantmäteriet's laser
  // scan puts its butterfly roof from 73.5 m west of the platform's middle to 69 m east, 10 m wide,
  // its valley 3.4 m over the platform and its edges 3.8 m. Photographs (2009 to 2025) show the
  // underside of pale ribbed sheet metal on dark purlins along it, dark rafters across only over the
  // columns, a cream box gutter along the valley, a dark fascia; pairs of grey steel columns down the
  // middle on concrete plinths, a steel plate across the top of each pair with an arch cut out of
  // it, two flat bars across lower down and a black downpipe between them; white lamps, SL's blue
  // name signs, clocks, wooden benches. The paving is red tiles 40 cm square in rows, a pale grey
  // edge and a dark ribbed strip, and patches of white tiles checked into the red between the pairs
  // of columns on both sides; chain-link fences beyond both tracks.
  //
  // At the west end, a stair house beyond the platform's end between the tracks (the laser scan:
  // its roof 3 m over the platform from 73.4 m to 89.5 m west): red-orange tiles to a parapet, tall
  // glazing in black frames above it, a red granite floor; the stairs go down its north half (a
  // railing round the opening) to the ticket hall under the tracks, and a corridor along its south
  // half leads to the lift (OpenStreetMap: 83 m west), whose machine room stands up through the roof
  // (to 5.8 m). The hall, 4.35 m under the platform, has walls of terracotta-red panels, a dark
  // ceiling, a red granite floor, the gates (OpenStreetMap: 98 m west) with the booth on the north
  // side and a kiosk on the south; its glass front, under SL's dark blue band with the name, faces
  // west onto the underpass under the tracks (5.6 m wide), whose walls are the same terracotta red
  // under a dark ceiling, with the name on a blue band over each mouth. From its north mouth a few
  // steps between brick wing walls go up to Finn Malmgrens plan; from its south mouth the path goes
  // on to the steps up to Tidaholmsplan.
  //
  // At the east end, a walkway 3 m wide between the tracks, fenced with chain-link on both sides,
  // goes down 2 m from the platform's end to a glass house standing between the tracks' two bridges
  // (the laser scan: its roof falling from 2.5 m over the platform at its west end to 0.6 m over
  // the stairs); from it the stairs go down in two flights between the bridges, beside a brick tower
  // round the lift (to 5.6 m), to the hall under the bridges at the street, 8.5 m under the platform:
  // glazed, with a brick end, its door onto Ulricehamnsvägen on the north side (OpenStreetMap's
  // indoor mapping). Where its gates stand isn't known: they are drawn in the hall.
  //
  // Not drawn: the small brick goat (30 by 40 cm) by the booth, the lamps on curved posts along the
  // walkway, the information pillars on the platform and the strip lights in the underpass.
  'Hammarbyhöjden': {
    roof: {
      kind: 'butterfly',
      from: -73.5, to: 69, width: 10.0,
      shape: [[-73.5, 0.1, 10.0], [0, 0.25, 10.0], [40, 0.25, 10.0], [69, 0.3, 10.0]],
      middle: 3.3, edge: 3.7, thick: 0.12, fascia: 0.3,
      rafters: 9.5, rafterAt: -68.75, rafterSize: [0.2, 0.4], deck: 'ribbedAcross', rafterColor: 0x44484c,
      purlins: { at: [-4.0, -2.7, -1.4, 1.4, 2.7, 4.0], size: [0.12, 0.22] },
      gutter: [0.55, 0.45], gutterColor: 0xe4dbc2,
      beam: 0.35,
      columns: { every: 9.5, at: -68.75, size: 0.3, plinth: { size: 0.45, height: 0.45 }, pair: 1.0,
        portal: { spring: 1.95, crown: 2.3, top: 2.95, bars: [0.76, 0.92], pipe: true } },
      lamps: { offset: 2.6, length: 1.4, every: 4.75 },
      colors: { underside: 0xc5c8c7, fascia: 0x313437, top: 0x55595c, steel: 0x7d8287 },
      signs: { at: [-45, -7, 31], back: 'Finn Malmgrens plan', ahead: 'Ulricehamnsvägen', blue: true },
      clocks: [[-11.75, 0.5], [45.25, 0.5]],
      // (trains towards T-Centralen stop on the southern track)
      boards: [
        { s: -16.5, u: -1.7, toward: 'Skarpnäck', trains: ['17 Skarpnäck  5 min', '17 Skarpnäck  15 min'] },
        { s: -16.5, u: 1.7, toward: 'Åkeshov', trains: ['17 Åkeshov  3 min', '17 Åkeshov  13 min'] },
      ],
    },
    paving: {
      edge: 0.7, tactile: [0.7, 1.0], slabs: 1.0, paverSize: [0.4, 0.4], mix: 0,
      colors: { edge: 0xc4c2bc, tactile: 0x5f6163, slab: 0x7d3b2e, pavers: 0x7d3b2e, face: 0x8e8b85 },
      pattern: 'grid',
    },
    buildings: ['w162241061', 'w187699797'],
    rooms: [
      { name: 'west stairs', s: [-86, -75.5], u: [-2.6, 0], h: [-4.4, 0.1], walls: 'orangeTiles', stairs: 'orangeTiles', floor: 'redGranite' },
      // (the walls and glass are the stair house's)
      { name: 'west stair house', s: [-89.5, -73.3], u: [-3, 3], h: [-0.5, 0.5], walls: null, floor: 'redGranite' },
      { name: 'west ticket hall', s: [-104.7, -84.9], u: [-3, 3], h: [-4.5, -3.5], walls: null, floor: 'redGranite' },
      { name: 'underpass', s: [-110.5, -104.6], u: [-14, 30], h: [-4.5, -3], walls: null, floor: 'pavers' },
      { name: 'walkway', s: [73.7, 134.4], u: [-1.5, 2.1], h: [-2.2, 0.1], walls: null, floor: 'pavers', slab: 0.5 },
      { name: 'east stairs', s: [136, 152], u: [1.3, 3.7], h: [-8.6, -2.1], walls: 'orangeTiles', stairs: 'orangeTiles', floor: 'redGranite' },
      { name: 'glass house', s: [134.4, 146], u: [-2, 4], h: [-2.2, -1.8], walls: null, floor: 'redGranite' },
      { name: 'east ticket hall', s: [141, 153.5], u: [-9, 5], h: [-8.7, -8.0], walls: null, floor: 'redGranite' },
    ],
    blocks: [
      // the west stair house: red-orange tiles to a parapet, glazed above in black frames, under a
      // flat roof; open to the platform
      { name: "stair house's parapets", plan: [[-73.4, -2.9], [-89.5, -2.9], [-89.5, 2.9], [-73.4, 2.9]], h: [-0.3, 1.0], from: -0.3,
        walls: 'orangeTiles', sides: [undefined, undefined, undefined, null], onPlatform: true },
      { name: "stair house's windows", plan: [[-73.4, -2.9], [-89.5, -2.9], [-89.5, 2.9], [-73.4, 2.9]], h: [1.0, 2.65], from: 1.0,
        walls: 'darkGlazed', sides: [undefined, undefined, undefined, null] },
      { name: "stair house's roof", plan: [[-73.4, -3.0], [-89.6, -3.0], [-89.6, 3.0], [-73.4, 3.0]], h: [0, 2.65],
        walls: 'darkGlazed', sides: [null, null, null, null], ceiling: 'perforated', roof: 0.3, roofColor: 0x3c3f42 },
      // the ticket hall under the tracks, its roof between them; its glass front onto the underpass
      { name: 'ticket hall', plan: [[-85.6, -2.85], [-104.7, -2.85], [-104.7, 2.85], [-85.6, 2.85]], h: [-4.35, -1.55], from: -4.35,
        walls: 'terracottaPanels', sides: [undefined, 'glassFront', undefined, undefined], floor: 'redGranite', ceiling: 'perforated',
        roof: 1.35, roofColor: 0x7e4a40, onPlatform: true, ground: true, nameSign: { side: 1, at: 0.5, length: 4.6, bottom: -2.3 } },
      { name: 'ticket booth', plan: [[-95.0, -2.85], [-99.0, -2.85], [-99.0, -1.55], [-95.0, -1.55]], h: [-4.35, -2.05], from: -4.35,
        walls: 'glazed', roof: 0.05 },
      { name: 'kiosk', plan: [[-100.5, 2.0], [-104.4, 2.0], [-104.4, 2.85], [-100.5, 2.85]], h: [-4.35, -1.95], from: -4.35,
        walls: 'glazed', roof: 0.05 },
      // the underpass under the tracks, open at both ends
      { name: 'underpass', plan: [[-104.7, -10.0], [-110.3, -10.0], [-110.3, 12.5], [-104.7, 12.5]], h: [-4.35, -1.75], from: -4.35,
        walls: 'terracottaPanels', sides: [null, undefined, null, null], floor: 'pavers', ceiling: 'perforated', roof: 0.2, roofColor: 0x77787a,
        onPlatform: true, ground: true },
      { name: "underpass's east wall, north", plan: [[-104.7, -10.0], [-104.9, -10.0], [-104.9, -2.85], [-104.7, -2.85]], h: [-4.35, -1.75], from: -4.35,
        walls: 'terracottaPanels' },
      { name: "underpass's east wall, south", plan: [[-104.7, 2.85], [-104.9, 2.85], [-104.9, 12.5], [-104.7, 12.5]], h: [-4.35, -1.75], from: -4.35,
        walls: 'terracottaPanels' },
      // the deck's faces over its mouths, the name on a blue band on each
      { name: "deck's north face", plan: [[-111.0, -10.2], [-104.0, -10.2], [-104.0, -10.0], [-111.0, -10.0]], h: [-1.75, -0.75], from: -1.75,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x8f8d86, onPlatform: true, nameSign: { side: 0, at: 0.5, length: 4.4, bottom: -1.62 } },
      { name: "deck's south face", plan: [[-111.0, 12.5], [-104.0, 12.5], [-104.0, 12.7], [-111.0, 12.7]], h: [-1.75, -0.75], from: -1.75,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x8f8d86, onPlatform: true, nameSign: { side: 2, at: 0.5, length: 4.4, bottom: -1.62 } },
      // the steps up from its north mouth between brick wing walls
      { name: 'north steps', plan: [[-104.7, -13.8], [-110.3, -13.8], [-110.3, -10.0], [-104.7, -10.0]], h: [-4.35, -2.6], from: -4.35,
        walls: 'brick', sides: [null, undefined, null, undefined], floor: 'pavers', roof: 0.05, roofColor: 0x6e3b2e, ground: true },
      // the east glass house between the bridges, its roof falling towards the stairs
      { name: 'glass house', plan: [[134.5, -1.8], [146.0, -1.8], [146.0, 3.8], [134.5, 3.8]], h: [-2.6, 2.4], low: 0.45, from: -2.0,
        walls: 'glazed', sides: [undefined, null, undefined, undefined], roof: 0.15, roofColor: 0x5b6066, eaves: 0.2 },
      // between the bridges, under it and over the street hall
      { name: 'between the bridges', plan: [[136.0, -2.0], [141.5, -2.0], [141.5, 4.2], [136.0, 4.2]], h: [-8.5, -2.1], from: -8.5,
        walls: 'boardConcrete', sides: [undefined, null, undefined, undefined], ground: true },
      { name: 'over the street hall', plan: [[141.5, -2.0], [146.0, -2.0], [146.0, 4.2], [141.5, 4.2]], h: [-5.6, -2.1], from: -5.6,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null] },
      // the brick tower round the lift, and the stairs' shaft beyond it
      { name: 'lift tower', plan: [[144.0, -1.9], [147.6, -1.9], [147.6, 1.4], [144.0, 1.4]], h: [-5.6, 1.0], from: -5.6,
        walls: 'brick', sides: [undefined, undefined, undefined, null] },
      { name: "lift tower's top", plan: [[144.0, -1.9], [147.6, -1.9], [147.6, 1.4], [144.0, 1.4]], h: [1.0, 5.4], from: 1.0,
        walls: 'brick', roof: 0.2, roofColor: 0x3a3c3e },
      { name: 'stair shaft', plan: [[146.0, -2.0], [152.6, -2.0], [152.6, 4.2], [146.0, 4.2]], h: [-5.6, -1.55], low: -2.25, from: -5.6,
        walls: 'boardConcrete', sides: [undefined, 'brick', undefined, null], roof: 0.15, roofColor: 0x4a4d50 },
      // the hall at the street under the bridges: glazed, its ends brick, its door on the north side
      { name: 'street hall', plan: [[141.5, -8.4], [153.0, -8.4], [153.0, 4.6], [141.5, 4.6]], h: [-8.8, -5.75], from: -8.5,
        walls: 'glazed', sides: ['glassFront', 'brick', undefined, 'brick'], floor: 'redGranite', ceiling: 'perforated', roof: 0.15, roofColor: 0x4a4d50,
        ground: true, nameSign: { side: 0, at: 0.7, length: 4.4, bottom: -6.1 } },
    ],
    art: [
      // the white tiles checked into the red between the pairs of columns
      { kind: 'checks', rows: 5, cols: 7, tile: 0.4, color: 0xc9c4b8,
        at: [[-64.0, -2.0], [-54.5, -2.0], [-45.0, -2.0], [-35.5, -2.0], [-26.0, -2.0], [-16.5, -2.0], [-7.0, -2.0], [2.5, -2.0], [12.0, -2.0], [21.5, -2.0], [31.0, -2.0], [40.5, -2.0], [50.0, -2.0], [59.5, -2.0]] },
      { kind: 'checks', rows: 5, cols: 5, tile: 0.4, color: 0xc9c4b8,
        at: [[-64.0, 1.65], [-54.5, 1.65], [-45.0, 1.65], [-35.5, 1.65], [-26.0, 1.65], [-16.5, 1.65], [-7.0, 1.65], [2.5, 1.65], [12.0, 1.65], [21.5, 1.65], [31.0, 1.65], [40.5, 1.65], [50.0, 1.65], [59.5, 1.65]] },
    ],
    benches: { at: [-54.5, -26.0, 2.5, 21.5, 50.0], double: true, wood: true },
    // chain-link beyond both tracks, falling with the ground east of the platform; along both sides
    // of the walkway
    fences: [
      { points: [[-111, -9.0, 0.25], [-72, -9.3, 0], [0, -9.5, 0], [60, -9.3, -0.2], [100, -9.0, -0.5], [130, -8.9, -0.9]], h: [-1.1, 0.9] },
      { points: [[-111, 8.8, 0.25], [-72, 9.1, 0], [0, 9.5, 0], [60, 9.8, -0.2], [100, 10.4, -0.5], [130, 10.5, -0.9]], h: [-1.1, 0.9] },
      { points: [[74, -1.25, 0], [98, -1.25, -1.0], [132, -1.25, -2.0], [134.5, -1.25, -2.0]], h: [0, 1.9] },
      { points: [[74, 1.85, 0], [98, 1.85, -1.0], [132, 1.85, -2.0], [134.5, 1.85, -2.0]], h: [0, 1.9] },
    ],
  },

  // Björkhagen (19 November 1958): an island platform out in the open on a bank along Malmövägen,
  // under a long butterfly roof, with a glass hall on the platform in its middle and the ticket hall
  // under the platform north of it. Lantmäteriet's laser scan puts the roof from 71 m south of the
  // platform's middle to 67.5 m north, 8.7 m wide at its south end, 11.75 m over the middle and
  // 9.9 m at its north end, its covering 3.5 m over the platform at the valley and 4.1 m at the
  // edges. Photographs (2008 to 2026) show its underside of pale sheet metal ribbed across the
  // platform on grey purlins, and teal steel: pairs of columns down the middle, a beam along over
  // each, a rafter across over each pair; lamps in long tubes, black name signs hung across the
  // platform, clocks and departure boards, wooden benches back to back; the paving dark grey slabs
  // in a running bond. Lenka Jonesson's art (1991): birch trunks leaning through cubes of rusted
  // steel on concrete plinths, three in one and one in another (where on the platform isn't known),
  // and a wall of dark stone with a great X of birch bark over the escalator.
  //
  // From 17 m south of the middle to 22.6 m north stands the glass hall (OpenStreetMap's indoor
  // mapping): small white tiles to a steel sill, windows in brushed steel frames above, a dark
  // terrazzo floor, and glass doors under SL's blue band at its south end; the roof's columns stop
  // either side of it. From 5.4 m north an escalator (west) and stairs (east) go down a long well to
  // the ticket hall, 4.9 m down, the X wall over the well's north end; the lift (28.7 m north) runs
  // down to it from the platform beyond the glass hall. The ticket hall (white tiles, a ceiling of
  // white panels, the gates at 30.5 m) opens through a glass front in brushed steel onto the underpass
  // under the tracks, 6 m wide, of concrete cast against boards, with retaining walls along the bank
  // beside its mouths (east of the tracks from 4 m to 51 m north), level paths at their feet,
  // brass-coloured railings along their tops and the metro's roundel on a post over its east mouth.
  // West of it the path leads to Falsterbovägen, east of it to Malmövägen.
  //
  // Not drawn: the glass hall's benches, the information pillars and the panels between the
  // columns; and the sign over the underpass's mouths is black, not blue.
  'Björkhagen': {
    roof: {
      kind: 'butterfly',
      from: -71.3, to: 67.5, width: 11.75,
      shape: [[-71.3, 0.9, 8.7], [-58, 0.4, 9.75], [-40, 0.05, 10.6], [-16, 0.1, 11.25], [-4, -0.1, 11.75], [20, -0.6, 11.75],
        [44, -0.4, 11.75], [56, -0.15, 10.8], [67.5, -0.1, 9.9]],
      middle: 3.42, edge: 4.05, thick: 0.1, fascia: 0.25,
      rafters: 7.75, rafterAt: -67.5, rafterSize: [0.2, 0.45], deck: 'ribbedAcross', rafterColor: 0x46788f,
      purlins: { at: [-4.5, -3.0, -1.5, 1.5, 3.0, 4.5], size: [0.1, 0.16], color: 0x8d9296 },
      beam: 0.45,
      columns: { every: 7.75, at: -67.5, size: 0.25, plinth: { size: 0.4, height: 0.15 }, pair: 1.1, gaps: [[-17.5, 25]] },
      lamps: { offset: 3.7, length: 1.5, every: 1.6, tube: true },
      colors: { underside: 0xc6c9c9, fascia: 0x3b5560, top: 0x5f6467, steel: 0x4a7f98 },
      signs: { at: [-44.0, -19.5, 23.8, 52.6], back: '', ahead: '', across: 1.6 },
      clocks: [[-40.4, 0], [37.1, 0]],
      // (trains towards T-Centralen stop on the western track)
      boards: [
        { s: -25.0, u: 1.7, toward: 'Skarpnäck', trains: ['17 Skarpnäck  2 min', '17 Skarpnäck  12 min'] },
        { s: -25.0, u: -1.7, toward: 'Åkeshov', trains: ['17 Åkeshov  7 min', '17 Åkeshov  17 min'] },
      ],
    },
    paving: {
      edge: 0.35, tactile: [0.35, 0.95], slabs: 0.95, paverSize: [0.6, 0.3], mix: 0.15,
      colors: { edge: 0xa9a8a3, tactile: 0x6b6e72, slab: 0x5e6268, pavers: 0x5e6268, paler: 0x6a6e74, face: 0x8a8781 },
      pattern: 'bond',
    },
    rooms: [
      { name: 'glass hall', s: [-17, 22.6], u: [-4.5, 3.4], h: [-0.1, 0.1], walls: null, floor: 'darkTerrazzo' },
      // (the well's walls are its shell's; beside the flights only up to its top, the glass hall's
      // floor, with railings round them)
      { name: 'well', s: [5.0, 22.4], u: [-3.3, 2.2], h: [-5.0, -0.5], walls: null, stairs: 'squareTiles', floor: 'terrazzo', sill: 0 },
      { name: 'ticket hall', s: [22.0, 38.5], u: [-6, 4], h: [-5.0, -4.5], walls: null, floor: 'terrazzo' },
      { name: 'underpass', s: [38.5, 44.5], u: [-25, 20], h: [-5.5, -4.0], walls: null, floor: 'pavers' },
      { name: 'platform', s: [-80, 80], u: [-10, 10], h: [-0.2, 0.2], walls: null, floor: null },
    ],
    blocks: [
      // the glass hall on the platform, its walls 1 m in from the platform's edges, under a flat
      // ceiling of its own beneath the roof's rafters; its doors at the south end
      { name: 'glass hall', plan: [[-17.0, -2.95], [5.4, -3.77], [5.4, 3.29], [-17.0, 3.32]], h: [0, 2.9],
        walls: 'steelGlazed', sides: [undefined, null, undefined, 'glassFront'], floor: 'darkTerrazzo', ceiling: 'whitePanels',
        roof: 0.04, roofColor: 0x8d9296, onPlatform: true },
      { name: 'glass hall over the well', plan: [[5.4, -3.77], [22.6, -4.40], [22.6, 3.27], [5.4, 3.29]], h: [0, 2.9],
        walls: 'steelGlazed', sides: [undefined, undefined, undefined, null], ceiling: 'whitePanels',
        roof: 0.04, roofColor: 0x8d9296, onPlatform: true },
      // its floor either side of the well
      { name: 'beside the well, west', plan: [[5.4, -3.77], [22.6, -4.40], [22.6, -3.25], [5.4, -3.25]], h: [0, 0],
        walls: 'darkTerrazzo', sides: [null, null, null, null], floor: 'darkTerrazzo' },
      { name: 'beside the well, east', plan: [[5.4, 2.15], [22.6, 2.15], [22.6, 3.27], [5.4, 3.29]], h: [0, 0],
        walls: 'darkTerrazzo', sides: [null, null, null, null], floor: 'darkTerrazzo' },
      // the well, open to the glass hall, into the ticket hall at its north end under the X wall
      { name: 'well', plan: [[5.4, -3.25], [22.0, -3.25], [22.0, 2.15], [5.4, 2.15]], h: [-4.9, 0], from: -4.9,
        walls: 'squareTiles', sides: [undefined, null, undefined, undefined], floor: 'terrazzo', onPlatform: true, ground: true },
      // between the escalator and the stairs, a sloping balustrade over a tiled wall down to the
      // well's floor
      { name: 'between the flights', plan: [[5.4, -1.55], [5.4, -0.1], [14.4, -0.1], [14.4, -1.55]], h: [-5.0, 1.19], from: 0.29, fall: -4.9,
        walls: 'squareTiles', roof: 0.05, roofColor: 0x9aa1a8 },
      { name: 'X wall', plan: [[22.0, -3.25], [22.0, 2.15], [22.5, 2.15], [22.5, -3.25]], h: [-1.7, 0.9], from: -1.7,
        walls: 'darkStone', sides: ['birchX', undefined, undefined, undefined], roof: 0.03, roofColor: 0x3a3c3e },
      // the ticket hall under the platform, its glass front onto the underpass
      { name: 'ticket hall', plan: [[22.0, -3.25], [38.5, -5.5], [38.5, 3.4], [22.0, 2.15]], h: [-4.9, -1.7], from: -4.9,
        walls: 'squareTiles', sides: [undefined, 'steelFront', undefined, null], floor: 'terrazzo', ceiling: 'whitePanels',
        roof: 0.3, roofColor: 0x77787a, onPlatform: true, ground: true },
      // (nor the city's ground, up to the platform's deck)
      { name: 'under the platform', plan: [[22.0, -3.25], [38.5, -5.5], [38.5, 3.4], [22.0, 2.15]], h: [-4.9, -0.05], from: -4.9,
        walls: 'squareTiles', sides: [null, null, null, null], ground: true },
      // the underpass under the tracks, open at both ends
      { name: 'underpass', plan: [[38.5, -9.8], [38.5, 8.3], [44.5, 8.3], [44.5, -9.8]], h: [-4.9, -1.9], from: -4.9,
        walls: 'boardConcrete', sides: [null, null, undefined, null], floor: 'pavers', ceiling: 'boardConcrete', roof: 0.3, roofColor: 0x77787a,
        onPlatform: true, ground: true },
      { name: "underpass's south wall, west", plan: [[38.3, -9.8], [38.5, -9.8], [38.5, -5.5], [38.3, -5.5]], h: [-4.9, -1.9], from: -4.9,
        walls: 'boardConcrete' },
      { name: "underpass's south wall, east", plan: [[38.3, 3.4], [38.5, 3.4], [38.5, 8.3], [38.3, 8.3]], h: [-4.9, -1.9], from: -4.9,
        walls: 'boardConcrete' },
      // the bank's faces over its mouths, the name over each
      { name: 'west face', plan: [[38.0, -10.05], [45.0, -10.05], [45.0, -9.55], [38.0, -9.55]], h: [-1.9, -0.85], from: -1.9,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x8f8d86, onPlatform: true, nameSign: { side: 0, at: 0.5, length: 4.4, bottom: -1.75 } },
      { name: 'east face', plan: [[38.0, 8.05], [45.0, 8.05], [45.0, 8.55], [38.0, 8.55]], h: [-1.9, -0.85], from: -1.9,
        walls: 'boardConcrete', roof: 0.03, roofColor: 0x8f8d86, onPlatform: true, nameSign: { side: 2, at: 0.5, length: 4.4, bottom: -1.75 } },
      // the bank beside the tracks either side of the underpass, held up by retaining walls where
      // the ground falls away from it (the laser scan: the ground at their feet 4.3 to 5 m under the
      // platform, west of the tracks from 24 m to 43 m north, east of them from 2 m to 50 m north)
      { name: 'west bank, south', plan: [[30.0, -8.5], [38.5, -8.85], [38.5, -9.8], [30.0, -9.8]], h: [-4.9, -0.85], from: -4.9,
        walls: 'boardConcrete', sides: [null, null, undefined, undefined], roof: 0.05, roofColor: 0x6e6a60, onPlatform: true, ground: true },
      { name: 'west bank, north', plan: [[44.5, -9.1], [47.0, -9.2], [47.0, -9.8], [44.5, -9.8]], h: [-4.9, -0.85], from: -4.9,
        walls: 'boardConcrete', sides: [null, undefined, undefined, null], roof: 0.05, roofColor: 0x6e6a60, onPlatform: true, ground: true },
      { name: 'east bank, south', plan: [[4.0, 7.5], [38.5, 6.6], [38.5, 8.3], [4.0, 8.3]], h: [-5.6, -0.85], from: -5.0,
        walls: 'boardConcrete', sides: [null, null, undefined, undefined], roof: 0.05, roofColor: 0x6e6a60, onPlatform: true, ground: true },
      { name: 'east bank, north', plan: [[44.5, 6.3], [51.0, 5.9], [51.0, 8.3], [44.5, 8.3]], h: [-5.6, -0.85], from: -5.2,
        walls: 'boardConcrete', sides: [null, undefined, undefined, null], roof: 0.05, roofColor: 0x6e6a60, onPlatform: true, ground: true },
      // the level ground at their feet and in front of the mouths (the city's ground, its points 5 m
      // apart, would slope up to their tops), a path of asphalt along them, falling to the north as
      // the scan's ground does; a low wall along its outer side where it meets the city's ground (as
      // where, east of the tracks, the scan has the ground step down 0.7 m 15 m out), and the
      // walls' ends sloping down to it. (Their tops reach up over the edge of the bank's formation,
      // which the network draws out past the walls' faces.)
      { name: 'west foot', plan: [[30.0, -9.8], [30.0, -12.5], [44.5, -12.5], [44.5, -9.8]], h: [-5.6, 1.0], from: -4.9, low: -4.1,
        walls: 'boardConcrete', sides: [null, undefined, null, null], floor: 'asphalt', onPlatform: true, ground: true },
      { name: 'east foot, north of the hall', plan: [[4.0, 8.3], [4.0, 16.5], [28.0, 16.5], [28.0, 8.3]], h: [-5.6, 1.0], from: -3.3, fall: -4.7, low: -3.0,
        walls: 'boardConcrete', sides: [null, undefined, null, null], floor: 'asphalt', onPlatform: true, ground: true },
      { name: 'east foot', plan: [[28.0, 8.3], [28.0, 14.8], [51.0, 14.8], [51.0, 8.3]], h: [-5.6, 1.5], from: -4.7, fall: -5.2, low: -4.3,
        walls: 'boardConcrete', sides: [null, undefined, null, null], floor: 'asphalt', onPlatform: true, ground: true },
      { name: 'east foot, step in its wall', plan: [[27.85, 14.8], [27.85, 16.5], [28.0, 16.5], [28.0, 14.8]], h: [-5.6, -4.4], from: -4.7,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x8f8d86 },
      { name: 'west wall, south end', plan: [[29.7, -9.8], [29.7, -12.5], [30.0, -12.5], [30.0, -9.8]], h: [-5.6, -0.85], from: -4.9, low: -4.1,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x8f8d86 },
      { name: 'west foot, by the mouth', plan: [[38.5, -12.5], [38.5, -16.0], [44.3, -16.0], [44.3, -12.5]], h: [-5.6, -4.1], from: -4.9, low: -3.8,
        walls: 'boardConcrete', sides: [undefined, undefined, null, null], floor: 'asphalt', onPlatform: true, ground: true },
      { name: 'west wall, north end', plan: [[44.3, -9.8], [44.3, -16.0], [44.6, -16.0], [44.6, -9.8]], h: [-5.6, -0.85], from: -4.9, low: -3.6,
        walls: 'boardConcrete', sides: [undefined, undefined, undefined, null], roof: 0.02, roofColor: 0x8f8d86 },
      { name: 'east wall, north end', plan: [[3.7, 8.3], [3.7, 16.5], [4.0, 16.5], [4.0, 8.3]], h: [-4.0, -0.85], from: -3.3, low: -3.0,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x8f8d86 },
      { name: 'east wall, south end', plan: [[51.0, 8.3], [51.0, 14.8], [51.3, 14.8], [51.3, 8.3]], h: [-5.6, -0.85], from: -5.2, low: -4.8,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x8f8d86 },
      // (and the formation's edge in front of the short wall north of the west mouth)
      { name: 'formation, west', plan: [[44.6, -9.8], [44.6, -11.8], [47.0, -11.8], [47.0, -9.8]], h: [-2.5, -1.0], from: -2.5,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
    ],
    art: [
      { kind: 'birches', s: -40.0, u: -2.6, turn: 0.1, size: 1.6, trunks: 3 },
      { kind: 'birches', s: 50.0, u: 1.0, turn: -0.1, size: 1.6, trunks: 1 },
      { kind: 'roundel', s: 39.5, u: 8.3, h: 1.7, size: 1.0, foot: -0.82 },
    ],
    benches: { at: [-63.6, -48.1, -32.6, 44.9, 60.4], double: true, wood: true },
    shelters: [{ s: [-56.0, -52.0], u: [0.9, 2.3] }, { s: [52.0, 56.0], u: [-2.3, -0.9] }],
    // chain-link beyond both tracks; brass-coloured railings along the retaining walls' tops; glass
    // railings along the well past the flights' feet
    fences: [
      { points: [[-75, -9.6], [-60, -9.3], [-40, -8.8], [-20, -8.7], [0, -9.2], [20, -9.6], [30, -9.7]], h: [-1.1, 0.9] },
      { points: [[47, -9.7], [60, -10.6], [75, -11.2]], h: [-1.1, 0.9] },
      { points: [[-75, 6.4], [-60, 7.3], [-40, 8.4], [-20, 8.6], [0, 8.6], [4, 8.2]], h: [-1.1, 0.9] },
      { points: [[51, 8.2], [60, 6.8], [75, 5.5]], h: [-1.1, 0.9] },
      { points: [[30.0, -9.7], [47.0, -9.7]], h: [-0.8, 0.3], kind: 'rails' },
      { points: [[4.0, 8.2], [51.0, 8.2]], h: [-0.8, 0.3], kind: 'rails' },
      { points: [[14.0, -3.2], [22.0, -3.2]], h: [0, 1.0], kind: 'glass' },
      { points: [[15.0, 2.1], [22.0, 2.1]], h: [0, 1.0], kind: 'glass' },
    ],
  },

  // Kärrtorp (19 November 1958): an island platform out in the open between Björkhagen and
  // Bagarmossen, beside Kärrtorps centrum, under a butterfly roof of the same design as
  // Björkhagen's; at its south end a glazed stair house between the tracks, down to the ticket hall
  // at the street on Kärrtorpsplan, under and between the tracks' two bridges. Lantmäteriet's laser
  // scan puts the roof from 72.5 m south of the platform's middle to 36.5 m north, 9.8 m wide at
  // its south end, 10 m over the middle and 6.6 m at its north end, its covering 3.5 m over the
  // platform at the valley and 4.1 m at the edges. Photographs (2007 to 2021) show its underside of
  // pale sheet ribbed across the platform on grey purlins, on teal steel: pairs of columns on
  // concrete plinths, a beam along over each, a rafter across over each pair; a pale fascia, lamps
  // in long tubes, black name signs hung across the platform, clocks, departure boards and wooden
  // benches back to back; the paving grey squares, a pale edge and a dark strip for the blind.
  // Beyond the roof, galvanised lamp posts with three domes (the laser scan: 4.3 m high). The
  // columns' spacing isn't known: Björkhagen's is used.
  //
  // Björn Olsén's Ljuslådor med hemliga tecken (1994): boxes of light in rounded steel frames, a
  // coloured glass on each face with a sign drawn on it. Three tall ones stand side by side on the
  // platform near the roof's north end, by the eastern edge, turned to each other like a screen;
  // a row of five on tall posts beyond the western track by the fence, two of them narrow; one on a
  // concrete plinth on the rocks east of the eastern track; one between the tracks beyond the
  // platform's north end. Where along the platform the row and the single ones stand isn't known.
  //
  // The stair house (the laser scan: from 73 m to 90 m south, its dark roof falling from 2.95 m
  // over the platform at its north end to 1.6 m at its south end; along its east side the
  // corridor to the lift under a flat roof 3 m up, to the lift's tower at 94 m, 5.2 m high, its top
  // clad in orange and red panels, the metro's roundel on it): glazed in dark frames above a dark
  // panel, a ribbed ceiling, open to the platform at its north end. Two escalators (west) and stairs
  // (east) go down from it to the ticket hall, 6.3 m down: pale tiles, a slatted ceiling, the
  // western wall teal tiles under a band of black glass, the eastern concrete; the gates 93.6 m
  // south, the lift's glass shaft at their east end. Its front, 103 m south, under the bridges'
  // ends: glass doors in brushed steel under a black band with the name, and over it, between the
  // bridges, a band of white panels to the deck. Under the western bridge Pressbyrån, under the
  // eastern a takeaway. The bridges stand on pale round columns in pairs over the square, not on
  // piers (photographs, 2021); where along them isn't known.
  //
  // Not drawn: the retaining wall along the western track from the middle to 35 m north (the laser
  // scan: the centrum's car park 3.6 m below), the rocks east of the eastern track and the fence
  // on them, and the kiosks east of the eastern bridge.
  'Kärrtorp': {
    roof: {
      kind: 'butterfly',
      from: -72.5, to: 36.5, width: 9.8,
      shape: [[-72.5, 1.1, 9.8], [-60, 0.75, 9.9], [-45, 0.3, 10.0], [-30, -0.2, 9.9], [-18, -0.5, 9.5], [-8, -0.45, 8.9],
        [3, -0.15, 8.4], [12, 0.1, 8.0], [20, 0.55, 7.5], [28, 1.1, 7.1], [36.5, 1.5, 6.6]],
      middle: 3.5, edge: 4.1, thick: 0.1, fascia: 0.3,
      rafters: 7.75, rafterAt: -68.5, rafterSize: [0.2, 0.45], deck: 'ribbedAcross', rafterColor: 0x3f8790,
      purlins: { at: [-3.0, -1.5, 1.5, 3.0], size: [0.1, 0.16], color: 0x8d9296 },
      beam: 0.45,
      columns: { every: 7.75, at: -68.5, size: 0.25, plinth: { size: 0.45, height: 0.3 }, pair: 1.4 },
      lamps: { offset: 2.9, length: 1.5, every: 1.6, tube: true },
      colors: { underside: 0xc6c9c9, fascia: 0xb4b8b8, top: 0x5f6467, steel: 0x3f8790 },
      signs: { at: [-56.9, -33.6, -10.4, 12.9], back: '', ahead: '', across: 1.6 },
      clocks: [[-41.4, 0], [20.6, 0]],
      // (trains towards T-Centralen stop on the western track)
      boards: [
        { s: -25.9, u: -1.7, toward: 'T-Centralen', trains: ['17 Åkeshov  4 min', '17 Åkeshov  14 min'] },
        { s: -25.9, u: 1.7, toward: 'Skarpnäck', trains: ['17 Skarpnäck  2 min', '17 Skarpnäck  12 min'] },
      ],
    },
    paving: {
      edge: 0.4, tactile: [0.4, 0.95], slabs: 0.95, paverSize: [0.5, 0.5], mix: 0.15,
      colors: { edge: 0xb9b7b1, tactile: 0x5f6266, slab: 0x85878a, pavers: 0x85878a, paler: 0x929497, face: 0x8e8b85 },
      pattern: 'grid',
    },
    buildings: ['w161808790'],
    rooms: [
      { name: 'ticket hall', s: [-104, -89.8], u: [-1, 7.6], h: [-6.5, -6.1], walls: null, floor: 'paleTiles' },
      // (the walls and glass are the stair house's)
      { name: 'stair house', s: [-93.4, -70.3], u: [-3.5, 6.6], h: [-6.35, 0.3], walls: null, stairs: 'boardConcrete', floor: 'greyTiles', sill: 0 },
      { name: 'Kärrtorpsplan', s: [-116, -103], u: [-10, 14], h: [-7, -6], walls: null, floor: 'pavers' },
    ],
    blocks: [
      // the stair house between the tracks: the well, its walls concrete cast against boards; over
      // it the glazed house, open to the platform, its roof falling to the south
      // (reaching a little under the corridor, to clear the network's platform there)
      { name: 'well', plan: [[-73.0, -2.5], [-90.0, -0.6], [-90.0, 4.35], [-73.0, 4.35]], h: [-6.3, 0], from: -6.3,
        walls: 'boardConcrete', sides: [undefined, undefined, null, null], onPlatform: true, ground: true },
      { name: 'stair house', plan: [[-73.0, -2.5], [-90.0, -0.6], [-90.0, 4.2], [-73.0, 4.2]], h: [0, 2.95], low: 1.6,
        walls: 'darkWindows', sides: [undefined, undefined, null, null], ceiling: 'ribbedMetal', roof: 0.25, roofColor: 0x3a3c3e },
      // the platform's western half up to the house (the network's ends 2.5 m short of it), its edge
      // concrete, and the floor beside the escalators' heads
      { name: "platform's end", plan: [[-70.4, -3.41], [-73.0, -3.25], [-73.0, 1.42], [-70.4, 1.22]], h: [-1.6, 0],
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'greyTiles' },
      { name: 'beside the escalators', plan: [[-73.0, -2.5], [-79.0, -1.83], [-79.0, -0.55], [-73.0, -0.55]], h: [0, 0],
        walls: 'greyTiles', sides: [null, null, null, null], floor: 'greyTiles' },
      // the corridor along its east side to the lift, glazed on both sides, under a flat roof
      { name: 'corridor', plan: [[-73.0, 4.2], [-90.0, 4.2], [-90.0, 6.4], [-73.0, 6.05]], h: [-6.3, 3.0],
        walls: 'darkWindows', sides: [undefined, null, undefined, null], floor: 'greyTiles', ceiling: 'ribbedMetal', roof: 0.2, roofColor: 0x3a3c3e },
      { name: 'corridor on the deck', plan: [[-90.0, 4.2], [-93.3, 4.2], [-93.3, 6.4], [-90.0, 6.4]], h: [-1.0, 3.0],
        walls: 'darkWindows', sides: [undefined, null, undefined, null], floor: 'greyTiles', ceiling: 'ribbedMetal', roof: 0.2, roofColor: 0x3a3c3e },
      // the top of the lift's tower over its glass shaft, orange and red panels
      { name: "lift tower's top", plan: [[-93.25, 3.95], [-95.75, 3.95], [-95.75, 6.25], [-93.25, 6.25]], h: [3.0, 5.2], from: 3.0,
        walls: 'redPanels', sides: [undefined, 'orangePanels', undefined, 'orangePanels'], roof: 0.08, roofColor: 0x3a3c3e },
      // the ticket hall under the bridges' ends, its front onto Kärrtorpsplan
      { name: 'ticket hall', plan: [[-90.05, -0.6], [-103.0, -0.6], [-103.0, 7.45], [-90.05, 7.45]], h: [-6.3, -2.9], from: -6.3,
        walls: 'boardConcrete', sides: ['tealTiles', 'blackFront', undefined, undefined], floor: 'paleTiles', ceiling: 'slats',
        roof: 0.05, roofColor: 0x77787a, onPlatform: true, ground: true, nameSign: { side: 1, at: 0.45, length: 3.0, bottom: -3.95, black: true } },
      // the deck between the bridges over it, white panels in its face (its east edge along the
      // eastern bridge's)
      { name: 'deck between the bridges', plan: [[-90.05, 0.9], [-103.0, 0.9], [-103.0, 7.49], [-90.05, 6.16]], h: [-2.9, -1.0], from: -2.9,
        walls: 'boardConcrete', sides: [null, 'whitePanels', null, null], roof: 0.05, roofColor: 0x8f8d86 },
      // the shops under the bridges either side of it
      { name: 'Pressbyrån', plan: [[-98.0, -4.4], [-103.0, -4.4], [-103.0, -0.6], [-98.0, -0.6]], h: [-6.3, -2.85], from: -6.3,
        walls: 'boardConcrete', sides: [undefined, 'shopWindows', null, undefined], roof: 0.05, roofColor: 0x77787a, ground: true },
      { name: 'takeaway', plan: [[-98.0, 7.45], [-103.0, 7.45], [-103.0, 11.5], [-98.0, 11.5]], h: [-6.3, -2.85], from: -6.3,
        walls: 'boardConcrete', sides: [null, 'shopWindows', undefined, undefined], roof: 0.05, roofColor: 0x77787a, ground: true },
      // the bridges over the square stand on pairs of round columns under a crosshead, not on piers
      { name: 'no piers, west', plan: [[-95.0, -5.5], [-125.0, -2.1], [-125.0, 3.9], [-95.0, 0.2]], h: [-9.4, -2.88], from: -9.4, low: -3.24,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      { name: 'no piers, east', plan: [[-91.0, 6.7], [-125.0, 10.3], [-125.0, 16.0], [-91.0, 12.0]], h: [-9.4, -2.72], from: -9.4, low: -3.07,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      { name: 'crosshead, west', plan: [[-114.18, -3.03], [-115.76, -2.80], [-115.06, 2.15], [-113.48, 1.92]], h: [-3.45, -3.01], from: -3.45,
        walls: 'boardConcrete', floor: 'boardConcrete' },
      { name: 'crosshead, east', plan: [[-112.25, 8.92], [-113.83, 9.11], [-113.25, 14.08], [-111.67, 13.89]], h: [-3.28, -2.84], from: -3.28,
        walls: 'boardConcrete', floor: 'boardConcrete' },
    ],
    art: [
      // the three on the platform, turned to each other like a screen facing west
      { kind: 'lightBoxes', at: [[29.29, 3.2]], w: 0.85, h: 1.8, depth: 0.25, bottom: 0.45, turn: -Math.PI / 2 - 0.25, colors: [0xd6a628], sign: 0, plinth: [0.4, 0.06] },
      { kind: 'lightBoxes', at: [[28.4, 3.3]], w: 0.85, h: 1.8, depth: 0.25, bottom: 0.45, turn: -Math.PI / 2, colors: [0xa8402e], sign: 1, plinth: [0.4, 0.06] },
      { kind: 'lightBoxes', at: [[27.51, 3.2]], w: 0.85, h: 1.8, depth: 0.25, bottom: 0.45, turn: -Math.PI / 2 + 0.25, colors: [0x4fb3c0], sign: 2, plinth: [0.4, 0.06] },
      // the row beyond the western track, facing the platform
      { kind: 'lightBoxes', at: [[-34.0, -8.8], [-30.6, -8.8], [-29.3, -8.8]], w: 1.0, h: 0.9, depth: 0.25, bottom: 3.0, ground: -1.95, turn: Math.PI / 2,
        colors: [0x3fa596, 0x45a88a, 0x2f9aa0], sign: 3, frameColor: 0x8a9096 },
      { kind: 'lightBoxes', at: [[-32.75, -8.8], [-31.85, -8.8]], w: 0.5, h: 0.9, depth: 0.25, bottom: 3.0, ground: -1.95, turn: Math.PI / 2,
        colors: [0x8a5a2a, 0xc47a2a], sign: 6, frameColor: 0x8a9096 },
      // on its plinth east of the eastern track, and between the tracks north of the platform
      { kind: 'lightBoxes', at: [[-20.0, 10.6]], w: 0.7, h: 1.2, depth: 0.22, bottom: 1.6, ground: -1.3, turn: -Math.PI / 2, colors: [0xd9b43a], sign: 8, plinth: [0.55, 0.6] },
      { kind: 'lightBoxes', at: [[95.0, 10.0]], w: 0.75, h: 0.65, depth: 0.2, bottom: 1.2, ground: -1.6, turn: Math.PI, colors: [0x9cc9a8], sign: 9, frameColor: 0x8a9096 },
      { kind: 'masts', height: 4.3, color: 0x9a9fa3, at: [[47.3, 2.9], [67.0, 5.2]] },
      { kind: 'roundel', s: -94.5, u: 5.1, h: 6.0, size: 0.8, foot: 5.28, along: true },
      // the bridges' columns over the square, a pair under each
      { kind: 'columns', at: [[-114.44, 0.85], [-114.80, -1.73]], from: -6.4, to: -3.45, size: 0.7, color: 0xbab7b0 },
      { kind: 'columns', at: [[-112.60, 12.79], [-112.90, 10.21]], from: -6.4, to: -3.28, size: 0.7, color: 0xbab7b0 },
    ],
    benches: { at: [-64.6, -49.1, -18.1, -2.6], double: true, wood: true },
    // chain-link beyond the western track, on the formation and then a little down the bank; a
    // railing along the deck's edge over the hall's front
    fences: [
      { points: [[-85, -7.3, 0], [-68, -8.4, 0], [-48, -9.3, -0.4], [-28, -9.5, -0.4], [-8, -9.1, -0.4], [12, -8.0, -0.4], [32, -6.2, 0], [52, -3.8, 0],
        [72, -0.6, 0], [92, 3.4, 0]], h: [-1.6, 0.4] },
      { points: [[-103.1, 0.95], [-103.1, 7.45]], h: [-0.95, 0.15], kind: 'rails', color: 0x6a6e72 },
    ],
  },

  // Bagarmossen (15 August 1994): the platform is in the rock, a cave the network draws in its own
  // style (src/hall-styles.ts); here, the way up to the street. OpenStreetMap's indoor mapping and
  // Albert Guillaumes' drawing: from a lobby at the platform's north end three escalators climb
  // 32 m to the ticket hall in the pavilion on Bagarmossen's square, an inclined lift beside them
  // on their east side. Photographs (2014 to 2022): the escalators' west wall in large white tiles
  // hung with posters, the lift's glass shaft along their east side behind curved steel frames,
  // a ceiling of bare concrete; in the hall a floor of dark grey tiles, a wall of split-face
  // concrete blocks, the gates in front of the doors.
  //
  // The pavilion, from the laser scan (its axis turned 9° from the platform's): the street 18.6 m
  // over the platform; a low back part over the escalators' top, 4 m high; then the hall's tall
  // part, from 103.5 m to 110.3 m along the axis, its glazed top falling from 7.5 m at the front to
  // 4.5 m at the back; the low front under a roof pitched both ways from a ridge along the axis
  // (3.4 m at the eaves, 4 m at the ridge), its middle running out to a point between two faces of
  // glass doors, and lower wings pointed on both sides. Photographs: the front's roof of pale
  // standing-seam metal reaching out over the walls; the doors under SL's blue band with the name;
  // the front's east wing glazed in grey steel, its west wing white frosted panels in bronze frames;
  // the tall part glazed above silver-grey cladding.
  'Bagarmossen': {
    buildings: ['w93325519'],
    rooms: [
      // the lift's car at the lobby, glazed (the lift itself isn't walked: its shaft is a block)
      { name: "lift's car", s: [74.7, 77.5], u: [-4.5, -0.5], h: [-0.5, 0.5], walls: 'glazed', floor: 'greyTiles', ceiling: 'ribbedMetal' },
      { name: 'lobby', s: [71, 74.7], u: [-10, 1], h: [-0.5, 0.5], walls: 'squareTiles', floor: 'terrazzo', ceiling: 'roughcast' },
      // (the east wall glazed onto the lift's shaft)
      { name: 'escalators', s: [76, 104], u: [-18, 0], h: [-0.5, 0.5], walls: 'squareTiles', stairs: 'glazed', left: 'squareTiles', ceiling: 'roughcast' },
      // out of the doors onto the square, and the hall (its walls and roofs the pavilion's)
      { name: 'square', s: [117.5, 135], u: [-25, 0], h: [17, 20], walls: null, floor: 'pavers' },
      { name: 'ticket hall', s: [100, 125], u: [-25, 0], h: [17, 20], walls: null, floor: 'darkTiles' },
    ],
    blocks: [
      // the lift's shaft, glazed towards the escalators (whose wall is the glass), up from behind
      // its car to the hall
      { name: "lift's shaft", plan: [[105.72, -11.08], [106.24, -9.15], [77.1, -1.23], [76.57, -3.16]], h: [18.6, 21.2], from: 18.6, fall: 0,
        walls: 'glazed', sides: [undefined, 'boardConcrete', null, null], floor: 'boardConcrete', roof: 0.1, roofColor: 0x8a9095, onPlatform: true },
      // the back part over the escalators' top
      { name: 'back', plan: [[94.2, -6.24], [92.57, -16.41], [101.95, -17.91], [103.58, -7.74]], h: [18.0, 22.7], from: 18.6,
        walls: 'cladding', sides: [undefined, undefined, null, undefined], roof: 0.12, roofColor: 0x6e7478 },
      // the hall's tall part, its top falling to the back, open under the front's roof
      { name: 'tall part', plan: [[108.67, -18.99], [101.95, -17.91], [103.62, -7.45], [110.34, -8.52]], h: [18.0, 26.0], from: 18.6, low: 23.1,
        walls: 'cladClerestory', sides: [undefined, undefined, undefined, null], band: { walls: 'cladClerestory', from: 22.0 },
        floor: 'darkTiles', ceiling: 'ribbedMetal', roof: 0.12, roofColor: 0x6e7478, ground: true },
      // the front, its roof pitched from the ridge down to the eaves either side, its middle out to
      // the point between the two faces of doors
      { name: 'front, west wing', plan: [[108.98, -17.01], [108.62, -19.28], [114.25, -20.18], [114.61, -17.91]], h: [18.0, 22.15], from: 18.6, low: 21.9,
        walls: 'frostedPanels', sides: [null, undefined, undefined, null], eaves: [0, 0.7, 0.7, 0],
        floor: 'darkTiles', ceiling: 'ribbedMetal', roof: 0.12, roofColor: 0x9a9ea0, ground: true },
      { name: 'front, west doors', plan: [[109.45, -14.05], [108.98, -17.01], [114.61, -17.91], [118.05, -15.42]], h: [18.0, 22.5], from: 18.6, low: 22.15,
        walls: 'steelFront', sides: [null, null, undefined, null], eaves: [0, 0, 0.7, 0], nameSign: { side: 2, at: 0.5, length: 3.2, bottom: 21.4 },
        floor: 'darkTiles', ceiling: 'ribbedMetal', roof: 0.12, roofColor: 0x9a9ea0, ground: true },
      { name: 'front, east doors', plan: [[118.05, -15.42], [115.57, -11.89], [109.94, -10.99], [109.45, -14.05]], h: [18.0, 22.5], from: 18.6, low: 22.15,
        walls: 'steelFront', sides: [undefined, null, null, null], eaves: [0.7, 0, 0, 0], nameSign: { side: 0, at: 0.5, length: 3.2, bottom: 21.4 },
        floor: 'darkTiles', ceiling: 'ribbedMetal', roof: 0.12, roofColor: 0x9a9ea0, ground: true },
      { name: 'front, east wing', plan: [[115.57, -11.89], [115.94, -9.62], [110.31, -8.72], [109.94, -10.99]], h: [18.0, 22.15], from: 18.6, low: 21.9,
        walls: 'glazed', sides: [undefined, undefined, null, null], eaves: [0.7, 0.7, 0, 0],
        floor: 'darkTiles', ceiling: 'ribbedMetal', roof: 0.12, roofColor: 0x9a9ea0, ground: true },
      // the lower wings pointed out either side, west in frosted panels, east glazed
      { name: 'west point', plan: [[105.8, -18.53], [108.29, -22.27], [111.88, -19.8], [108.64, -19.13]], h: [18.0, 21.9], from: 18.6,
        walls: 'frostedPanels', sides: [undefined, undefined, null, null], eaves: [0.4, 0.4, 0, 0], roof: 0.12, roofColor: 0x9a9ea0 },
      { name: 'east point', plan: [[107.57, -8.08], [111.39, -5.75], [113.76, -9.27], [110.32, -8.62]], h: [18.0, 21.9], from: 18.6,
        walls: 'glazed', sides: [undefined, undefined, null, null], eaves: [0.4, 0.4, 0, 0], roof: 0.12, roofColor: 0x9a9ea0 },
      // inside, along the hall's west side, the wall of split-face blocks
      { name: 'block wall', plan: [[102.07, -17.78], [102.1, -17.63], [114.19, -19.57], [114.17, -19.71]], h: [18.6, 21.9], from: 18.6,
        walls: 'splitBlocks' },
    ],
  },
  // Skärmarbrink (1 October 1950, as Hammarby; renamed in 1958), where the Farsta and Skarpnäck
  // branches part: two island platforms in the open, their outer tracks the Skarpnäck line's and
  // their inner ones the Farsta line's, those out of town on the north-eastern platform. Peter
  // Celsing's ticket hall stands on a bridge over the tracks at their south-eastern end, on the
  // footbridge between Pelargatan and Palandergatan. From the laser scan, Google's 3D mesh, OpenStreetMap
  // (its indoor mapping of the stairs, lifts and paths) and photographs (1950s to 2025):
  //
  // The hall, one storey, its floor 4.7 m over the platforms, as the footbridge's: walls of pale
  // grey-white panels in a grid on a dark plinth, glazed in dark frames at its back and its
  // north-eastern end, a black fascia at 7.95 m and over it three gables side by side, their ridges
  // across the tracks 9.4 m up, their ends boarded black under a white trim, the slopes dark metal
  // with strips of glass. In its front onto the footbridge the kiosk, the glass doors in brushed
  // steel under the black band with the name, and white panels; a flat canopy over the footbridge
  // in front of it, its soffit pine boards, as the hall's ceiling. Glass stair houses in black
  // frames climb from each platform to its back, navy-blue tiles under their flights; a lift from
  // each platform, the south-western one's a tower of dark glass outside the hall's end with the
  // metro's sign on a post on its top. The footbridge on concrete piers, its railings black bars.
  //
  // The platforms' roofs (the laser scan: their tops 3.15 to 3.8 m over the platforms, from 4.5 m
  // north-west of the platforms' middle to 53.5 m south-east): over the north-eastern one a
  // butterfly; over the south-western one, which widens to the south-east as its tracks part, a
  // lean-to along each edge, high over its track, and between their low sides an open strip, roofed
  // over the last 15 m by a ridge. Corrugated metal on dark steel, black columns on concrete
  // plinths. Out in the open, galvanised lamp posts with two dish lamps on an arm and a third lower
  // down (the laser scan: 4.5 m high), the name on a black sign on some; pale concrete slabs.
  //
  // Carl Magnus's sculptures (1990): frames of square bronze bars gone green, right triangles whose
  // long sides run on past their tops; a pair on a long low plinth on the south-western platform,
  // one on the north-eastern.
  'Skärmarbrink': {
    // the north-eastern platform's roof (the line it follows is that platform's)
    roof: {
      kind: 'butterfly',
      from: -4.35, to: 53.65, width: 7.6,
      shape: [[-4.35, -0.12, 7.27], [7.15, 0.03, 7.58], [17.15, 0.12, 7.76], [27.15, 0.17, 7.87], [38.65, 0.17, 7.86], [47.15, 0.13, 7.79], [53.65, 0.1, 7.72]],
      middle: 3.0, edge: 3.55, thick: 0.2, fascia: 0.3,
      rafters: 3.0, rafterSize: [0.12, 0.25], deck: 'ribbedAcross', rafterColor: 0x2b2d2f,
      beam: 0.35,
      columns: { every: 9, at: -0.85, size: 0.25, plinth: { size: 0.5, height: 0.35 } },
      lamps: { offset: 1.6, length: 1.5, every: 3.0 },
      colors: { underside: 0x9a9fa2, fascia: 0x2b2d2f, top: 0x9ca2a5, steel: 0x2b2d2f },
      signs: { at: [12.65, 39.65], back: '', ahead: 'Utgång' },
      // (out of town: the Skarpnäck line's trains on the outer track, the Farsta line's the inner)
      boards: [
        { s: 30.65, u: -1.8, toward: 'Skarpnäck', trains: ['17 Skarpnäck  4 min', '17 Skarpnäck  14 min'] },
        { s: 30.65, u: 1.8, toward: 'Farsta strand', trains: ['18 Farsta strand  2 min', '18 Farsta strand  12 min'] },
      ],
    },
    // the south-western platform's: a lean-to along its inner edge and one along its outer, and
    // between their low sides a ridge over the last 15 m
    roofs: [
      {
        kind: 'butterfly', lean: 1,
        from: -4.35, to: 53.65, width: 5.0,
        shape: [[-4.35, 12.66, 5.0], [7.15, 12.83, 5.0], [17.15, 12.86, 5.0], [27.15, 12.83, 5.0], [38.65, 12.73, 5.0], [47.15, 12.65, 5.0], [53.65, 12.6, 5.0]],
        middle: 3.0, edge: 3.58, thick: 0.2, fascia: 0.3,
        rafters: 3.0, rafterSize: [0.12, 0.25], deck: 'ribbedAcross', rafterColor: 0x2b2d2f,
        beam: 0.35,
        columns: { every: 9, at: -0.85, size: 0.25, plinth: { size: 0.5, height: 0.35 }, offset: 1.2 },
        lamps: { offset: 0, length: 1.5, every: 3.0, at: [-0.4] },
        colors: { underside: 0x9a9fa2, fascia: 0x2b2d2f, top: 0x9ca2a5, steel: 0x2b2d2f },
        signs: { at: [21.65], back: '', ahead: 'Utgång' },
        boards: [{ s: 39.65, u: -0.6, toward: 'Alvik', trains: ['18 Alvik  3 min', '18 Alvik  13 min'] }],
      },
      {
        kind: 'butterfly', lean: -1,
        from: -4.35, to: 53.65, width: 5.2,
        shape: [[-4.35, 21.46, 5.2], [7.15, 22.57, 5.2], [17.15, 23.38, 5.2], [27.15, 24.09, 5.2], [38.65, 24.8, 5.2], [47.15, 25.27, 5.2], [53.65, 25.62, 5.2]],
        middle: 2.95, edge: 3.6, thick: 0.2, fascia: 0.3,
        rafters: 3.0, rafterSize: [0.12, 0.25], deck: 'ribbedAcross', rafterColor: 0x2b2d2f,
        beam: 0.35,
        columns: { every: 9, at: -0.85, size: 0.25, plinth: { size: 0.5, height: 0.35 }, offset: -1.2 },
        lamps: { offset: 0, length: 1.5, every: 3.0, at: [0.4] },
        colors: { underside: 0x9a9fa2, fascia: 0x2b2d2f, top: 0x9ca2a5, steel: 0x2b2d2f },
        signs: { at: [12.65, 39.65], back: '', ahead: 'Utgång' },
        boards: [{ s: 30.65, u: 0.6, toward: 'Åkeshov', trains: ['17 Åkeshov  6 min', '17 Åkeshov  16 min'] }],
      },
      {
        kind: 'butterfly',
        from: 38.65, to: 53.65, width: 7.5,
        shape: [[38.65, 18.72, 6.96], [47.15, 18.91, 7.52], [53.65, 19.06, 7.91]],
        middle: 3.4, edge: 2.97, thick: 0.2, fascia: 0.3,
        rafters: 3.0, rafterSize: [0.12, 0.25], deck: 'ribbedAcross', rafterColor: 0x2b2d2f,
        beam: 0.3,
        // (carried on the lean-tos' beams)
        columns: { every: 9, at: -0.85, size: 0.25, plinth: { size: 0.5, height: 0.35 }, between: [97.15, 98.15] },
        lamps: { offset: 1.8, length: 1.5, every: 3.0 },
        colors: { underside: 0x9a9fa2, fascia: 0x2b2d2f, top: 0x9ca2a5, steel: 0x2b2d2f },
        signs: { at: [], back: '', ahead: '' },
      },
    ],
    paving: {
      edge: 0.3, tactile: [0.3, 0.85], slabs: 0.85, paverSize: [0.5, 0.5], mix: 0.3,
      colors: { edge: 0xd4d2cc, tactile: 0x7a7c7d, slab: 0xa9a8a3, pavers: 0xa9a8a3, paler: 0xb6b5b0, face: 0x8e8b85 },
      pattern: 'grid',
    },
    buildings: ['w179623657'],
    rooms: [
      // (the hall's walls and ceiling are its shell's)
      { name: 'ticket hall', s: [64.65, 74.35], u: [-11.7, 11.8], h: [4.2, 5.5], walls: null, floor: 'terrazzo', lamps: 3.0 },
      { name: 'footbridge', s: [74.4, 80.1], u: [-65.2, 44.8], h: [3.5, 6], walls: null, floor: 'asphalt', slab: 0.4 },
      // (the stair houses' walls and roofs are their shells', concrete beside the flights; the
      // platforms run on under the hall to the lifts)
      { name: 'stairs and lifts', s: [47.15, 72.15], u: [-12.2, 15.8], h: [-0.5, 1], walls: null, floor: null, stairs: 'boardConcrete', sill: 0.3 },
    ],
    blocks: [
      // the hall: the deck under it, its shell, the three gables on its roof, its front (the kiosk,
      // the doors under the name, panels), the canopy over the footbridge in front of it
      { name: 'deck under the hall', plan: [[64.9, -11], [74.15, -11], [74.15, 10.8], [64.9, 10.8]], h: [4.0, 4.0], from: 4.0,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'boardConcrete' },
      { name: 'ticket hall', plan: [[64.9, -11], [74.15, -11], [74.15, 10.8], [64.9, 10.8]], h: [4.0, 7.95], from: 4.7,
        walls: 'gridPanels', sides: ['darkGlazed', null, undefined, 'darkGlazed'], eaves: [0.3, 0, 0.3, 0.3],
        floor: 'terrazzo', ceiling: 'pineBoards', roof: 0.35, roofColor: 0x1c1d1f },
      { name: 'gables', plan: [[65.65, -11], [74.15, -11], [74.15, 10.8], [65.65, 10.8]], h: [8.3, 8.3], from: 8.3,
        walls: 'gridPanels', sides: [null, null, null, null], roofColor: 0x34383c, gables: { count: 3, rise: 1.1, color: 0x1c1d1f, trim: 0xe6e6e2 } },
      { name: 'kiosk', plan: [[74.05, -11], [74.15, -11], [74.15, -4.2], [74.05, -4.2]], h: [4.7, 7.95], from: 4.7, walls: 'shopWindows' },
      { name: 'doors', plan: [[74.05, -4.2], [74.15, -4.2], [74.15, 5.87], [74.05, 5.8]], h: [4.7, 7.95], from: 4.7, walls: 'blackFront',
        nameSign: { side: 1, at: 0.5, length: 4.4, bottom: 7.05, black: true } },
      { name: 'front, south-west', plan: [[74.05, 5.87], [74.15, 5.87], [74.15, 10.8], [74.05, 10.8]], h: [4.7, 7.95], from: 4.7, walls: 'gridPanels' },
      { name: 'canopy', plan: [[74.15, -11], [75.75, -11], [75.75, 10.8], [74.15, 10.8]], h: [7.95, 7.95], from: 7.95,
        walls: 'pineBoards', sides: [null, null, null, null], ceiling: 'pineBoards', roof: 0.35, roofColor: 0x1c1d1f },
      // the stair houses, their roofs climbing with the flights from the platforms to the hall, and
      // the navy tiles outside them under the flights
      { name: 'north-eastern stair house', plan: [[64.9, -10.8], [54.15, -10.8], [54.15, -6.8], [64.9, -6.8]], h: [-0.3, 7.95], low: 3.7,
        walls: 'darkGlazed', sides: [undefined, undefined, undefined, null], ceiling: 'ribbedMetal', roof: 0.12, roofColor: 0x2e3236 },
      { name: 'north-eastern tiles, outer', plan: [[64.75, -10.95], [56.45, -10.95], [56.45, -10.85], [64.75, -10.85]], h: [-0.3, 4.4], low: 0.02,
        walls: 'navyTiles', roof: 0.2, roofColor: 0x9a978f },
      { name: 'north-eastern tiles, inner', plan: [[64.75, -6.8], [56.45, -6.8], [56.45, -6.7], [64.75, -6.7]], h: [-0.3, 4.4], low: 0.02,
        walls: 'navyTiles', roof: 0.2, roofColor: 0x9a978f },
      { name: 'south-western stair house', plan: [[64.9, 6.4], [54.15, 6.4], [54.15, 10.4], [64.9, 10.4]], h: [-0.3, 7.95], low: 3.7,
        walls: 'darkGlazed', sides: [undefined, undefined, undefined, null], ceiling: 'ribbedMetal', roof: 0.12, roofColor: 0x2e3236 },
      { name: 'south-western tiles, inner', plan: [[64.75, 6.25], [56.45, 6.25], [56.45, 6.35], [64.75, 6.35]], h: [-0.3, 4.4], low: 0.02,
        walls: 'navyTiles', roof: 0.2, roofColor: 0x9a978f },
      { name: 'south-western tiles, outer', plan: [[64.75, 10.4], [56.45, 10.4], [56.45, 10.5], [64.75, 10.5]], h: [-0.3, 4.4], low: 0.02,
        walls: 'navyTiles', roof: 0.2, roofColor: 0x9a978f },
      // the south-western lift's tower outside the hall's end (its door side the lift's own)
      { name: "lift's tower", plan: [[66.5, 11.25], [69, 11.25], [69, 13.95], [66.5, 13.95]], h: [-0.3, 7.95],
        walls: 'darkGlazed', sides: [null, undefined, undefined, undefined], roof: 0.2, roofColor: 0x1c1d1f },
      // the platforms run on under the hall to the lifts
      { name: 'north-eastern platform under the hall', plan: [[65.65, -10.4], [71.15, -10.4], [71.15, -3.8], [65.65, -3.8]], h: [-1.0, 0],
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'pavers' },
      { name: 'south-western platform under the hall', plan: [[65.65, 3.2], [71.15, 3.2], [71.15, 14.8], [65.65, 14.8]], h: [-1.0, 0],
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'pavers' },
      // the bank the footbridge comes onto north-east of Palandergatan
      { name: 'bank', plan: [[74.4, -47.2], [79, -47.2], [79, -58.2], [74.4, -58.2]], h: [0.3, 3.96], from: 3.96, fall: 4.3,
        walls: 'boardConcrete' },
    ],
    art: [
      { kind: 'bronzeFrames', s: -37.25, u: -9.9, turn: 0, plinth: [1.6, 0.6, 0.5], bar: 0.16,
        bars: [[0.62, 0, 0.62, 1.95, 0.14], [-0.7, 0.08, 0.62, 0.08, 0.14], [-0.7, 0, 0.78, 2.3, 0.14], [-0.3, 0.08, 0.25, 0.93, 0.14],
          [-0.62, 0, -0.62, 1.6, -0.14], [-0.62, 0.08, 0.7, 0.08, -0.14], [0.7, 0, -0.74, 1.95, -0.14]] },
      { kind: 'bronzeFrames', s: -13.65, u: 7.35, turn: 0, plinth: [5.0, 1.5, 0.2], bar: 0.17,
        bars: [[-0.65, 0, -0.65, 2.05, 0.2], [-2.04, 0.08, -0.65, 0.08, 0.2], [-2.04, 0, -0.48, 2.42, 0.2], [-1.61, 0.08, -1.04, 0.98, 0.2],
          [-1.95, 0, -1.95, 1.68, -0.2], [-1.95, 0.08, -0.57, 0.08, -0.2], [-0.57, 0, -2.08, 2.05, -0.2],
          [0.65, 0, 0.65, 2.05, 0.2], [2.04, 0.08, 0.65, 0.08, 0.2], [2.04, 0, 0.48, 2.42, 0.2], [1.61, 0.08, 1.04, 0.98, 0.2],
          [1.95, 0, 1.95, 1.68, -0.2], [1.95, 0.08, 0.57, 0.08, -0.2], [0.57, 0, 2.08, 2.05, -0.2]] },
      { kind: 'masts', height: 4.5, color: 0x9a9fa3, top: false, arm: 0.5, lower: 3.6, lowerOne: true,
        at: [[-60.65, -6.8], [-30.45, -9.1], [-68.85, 4.8], [-38.35, 6.2], [-7.75, 7.55]] },
      { kind: 'masts', height: 4.5, color: 0x9a9fa3, top: false, arm: 0.5, lower: 3.6, lowerOne: true, sign: 2.6,
        at: [[-46.15, -8.1], [-16.45, -8.95], [-53.75, 5.6], [-23.25, 6.8]] },
      { kind: 'roundel', s: 67.75, u: 12.6, h: 10.4, size: 0.9, foot: 8.1 },
      // the piers under the hall, and under the footbridge
      { kind: 'columns', at: [[66.15, -6.8], [73.15, -6.8], [66.15, 6.4], [73.15, 6.4]], from: 0, to: 4.0, size: 0.45, color: 0x9c9a94 },
      { kind: 'columns', at: [[75.15, -7], [78.15, -7], [75.15, 7.8], [78.15, 7.8], [75.15, 15.8], [78.15, 15.8]], from: -1.3, to: 4.3, size: 0.4, color: 0x9c9a94 },
      { kind: 'columns', at: [[75.15, -15.2], [78.15, -15.2]], from: -2.3, to: 4.25, size: 0.4, color: 0x9c9a94 },
      { kind: 'columns', at: [[75.15, -21.2], [78.15, -21.2]], from: -1.6, to: 4.17, size: 0.4, color: 0x9c9a94 },
      { kind: 'columns', at: [[75.2, -33.2], [78.2, -33.2]], from: -0.6, to: 4.06, size: 0.4, color: 0x9c9a94 },
      { kind: 'columns', at: [[75.2, -42.2], [78.2, -42.2]], from: 0.0, to: 4.0, size: 0.4, color: 0x9c9a94 },
      { kind: 'columns', at: [[75.15, 28.3], [78.15, 28.3]], from: 1.0, to: 4.54, size: 0.4, color: 0x9c9a94 },
    ],
    benches: [
      { at: [3.65, 21.65, 39.65], double: true, wood: true },
      { at: [12.65, 30.65], double: true, wood: true, roof: 0 },
      { at: [3.65, 21.65], double: true, wood: true, roof: 1 },
    ],
    // the footbridge's railings, rising with it; chain-link along Palandergatan beyond the
    // north-eastern platform's outer track, and along the bank beyond the south-western one's
    fences: [
      { kind: 'bars', points: [[74.45, -47.2], [74.45, -24.2, 0.17], [74.45, -11, 0.34]], h: [4.36, 5.46] },
      { kind: 'bars', points: [[74.45, 10.8], [74.45, 21.8, 0.11], [74.45, 33.3, 0.31]], h: [4.7, 5.8] },
      { kind: 'bars', points: [[78.85, -47.2], [78.85, -24.2, 0.17], [78.85, -0.2, 0.34], [78.85, 10.8, 0.34], [78.85, 21.8, 0.45], [78.85, 33.3, 0.65]], h: [4.36, 5.46] },
      { points: [[-77.85, -17.8], [-42.85, -19.3], [-2.85, -19.75], [37.15, -19.75], [73.15, -19.7]], h: [-1.3, 0.7] },
      { points: [[-77.85, 13.3], [-62.85, 14.1], [-42.85, 15.6], [-22.85, 17.5], [-2.85, 19.55], [17.15, 21.65], [37.15, 23.65], [57.15, 25.4], [73.15, 26.8]], h: [-1.2, 0.8] },
    ],
  },

  // Skarpnäck (15 August 1994), the end of the green line (src/hall-styles.ts has its cave). From
  // OpenStreetMap's indoor mapping, the laser scan and photographs (2008 to 2022): at the platform's
  // north end, under a white vault, stairs between concrete parapets, the lift's tower and an
  // escalator climb 4.4 m to a landing over the platform; from it a passage leads west into the
  // rock, its north wall white render with a row of granite slabs leaning on it, its vault the
  // cave's red, to the foot of three long escalators in a tunnel of board-marked concrete under red
  // rock, an inclined lift beside them. They climb 20.5 m to the ticket hall: red clinker on the
  // floor, brick walls, a ribbed metal ceiling, the gates just in front of the escalators' top.
  // The station's building on Skarpnäcks allé is red brick, of two parts (the laser scan): the
  // hall's front part, its roof rising gently to the back, with a deep canopy over the glass front
  // between two brick piers, red along its fascia, SL's blue band with the name over the doors;
  // and behind it, over the escalators' top, a taller part whose roof falls away to the back, a
  // band of windows in red frames along its front over the front part's roof. Its sub-frame is
  // turned 25° from the platform's.
  //
  // Richard Nonas's seventeen benches of dark granite (1994) stand down the middle of the platform,
  // each a U of two slabs on end and a seat between them, across the platform.
  'Skarpnäck': {
    buildings: ['w161775758'],
    rooms: [
      { name: 'flights', s: [72, 81.5], u: [-4, 4.2], h: [-0.5, 0.5], walls: 'boardConcrete', floor: 'brick', ceiling: 'whiteRender', parapet: 1.1 },
      { name: 'landing', s: [77, 96], u: [-4.5, 4.5], h: [4, 5], walls: 'boardConcrete', floor: 'brick', ceiling: 'whiteRender', lamps: 3.2 },
      { name: 'escalators', s: [50, 92], u: [-46, -26.5], h: [4, 5], walls: 'boardConcrete', stairs: 'boardConcrete', ceiling: 'redRock' },
      // (white render along its north side, the slabs leaning on it; the cave's red rock to the south)
      { name: 'passage', s: [84, 96], u: [-30, -4.5], h: [4, 5], walls: 'whiteRender', back: 'redRock', floor: 'brick', ceiling: 'redRock' },
      { name: 'ticket hall', s: [40, 75], u: [-60, -28], h: [24, 26], walls: null, floor: 'brick', lamps: 3.0 },
    ],
    blocks: [
      // the white vault over the flights beyond the platform's north end, between the tracks
      // running on into their tunnels, open to the platform through the cave's end wall
      { name: 'north vault', plan: [[72.6, -4.6], [96.0, -4.6], [96.0, 4.6], [72.6, 4.6]], h: [0, 8.0], from: 0,
        walls: 'whiteRender', sides: [undefined, undefined, undefined, null], floor: 'brick', ceiling: 'whiteRender', roof: 0.6, roofColor: 0x6e2416,
        onPlatform: true },
      // the hall's front part, its roof rising to the back, the deep canopy over its front
      { name: 'ticket hall', plan: [[55.88, -36.77], [48.18, -40.38], [53.48, -51.7], [61.18, -48.09]], h: [24.3, 29.85], from: 24.9, low: 28.55,
        walls: 'brick', sides: [undefined, 'redFront', undefined, null], eaves: [0.4, 3.0, 0.4, 0],
        nameSign: { side: 1, at: 0.5, length: 3.6, bottom: 27.3 },
        floor: 'brick', ceiling: 'ribbedMetal', roof: 0.45, roofColor: 0x9e3426, ground: true },
      // behind it, over the escalators' top, the tall part, its roof falling to the back
      { name: 'escalator hall', plan: [[60.54, -46.73], [71.86, -41.43], [67.2, -31.47], [55.88, -36.77]], h: [24.3, 32.0], from: 24.9, low: 27.8,
        walls: 'brick', sides: [undefined, undefined, undefined, null], eaves: [0.3, 0.3, 0.3, 0],
        floor: 'brick', ceiling: 'ribbedMetal', roof: 0.4, roofColor: 0x9e3426, ground: true },
      // (where its west wall steps in from the front part's)
      { name: 'west step', plan: [[61.18, -48.09], [61.09, -48.13], [60.45, -46.78], [60.54, -46.73]], h: [24.3, 29.85], from: 24.9,
        walls: 'brick', roof: 0.45, roofColor: 0x9e3426 },
      // its windows in red frames over the front part's roof
      { name: 'clerestory', plan: [[60.45, -46.78], [60.54, -46.73], [55.88, -36.77], [55.78, -36.81]], h: [29.85, 32.0], from: 29.85,
        walls: 'redBand', roof: 0.05, roofColor: 0x9e3426 },
      // the brick piers either side of the front, out to the canopy's edge
      { name: 'west pier', plan: [[53.48, -51.7], [50.76, -52.97], [49.7, -50.71], [52.42, -49.43]], h: [24.3, 28.6], from: 24.9,
        walls: 'brick', roof: 0.1, roofColor: 0x7a6a62, ground: true },
      { name: 'east pier', plan: [[49.24, -42.64], [46.52, -43.91], [45.46, -41.65], [48.18, -40.38]], h: [24.3, 28.6], from: 24.9,
        walls: 'brick', roof: 0.1, roofColor: 0x7a6a62, ground: true },
      // the glass ticket booth by the gates
      { name: 'ticket booth', plan: [[57.47, -49.61], [54.93, -50.8], [54.04, -48.89], [56.58, -47.71]], h: [24.9, 27.2], from: 24.9,
        walls: 'glazed', roof: 0.05, roofColor: 0xa9aeb1 },
      // the inclined lift's shaft beside the escalators, from the ticket hall down to the passage
      { name: "inclined lift's shaft", plan: [[58.07, -43.81], [59.0, -45.8], [91.15, -30.74], [90.22, -28.75]], h: [24.9, 27.5], from: 24.9, fall: 4.4,
        walls: 'boardConcrete', sides: ['glazed', undefined, undefined, undefined], floor: 'boardConcrete', roof: 0.1, roofColor: 0x8a9095 },
    ],
    art: [
      // the round T on its post in front of the west pier
      { kind: 'roundel', s: 50.95, u: -54.54, h: 28.9, size: 0.9, foot: 24.9, along: true },
      { kind: 'slabBenches', span: 1.5, height: 1.9,
        at: [[-62.0, 0], [-54.38, 0], [-46.75, 0], [-39.12, 0], [-31.5, 0], [-23.88, 0], [-16.25, 0], [-8.62, 0], [-1.0, 0], [6.62, 0], [14.25, 0], [21.88, 0], [29.5, 0], [37.12, 0], [44.75, 0], [52.38, 0], [60.0, 0]] },
      // the granite slabs leaning on the passage's north wall
      { kind: 'stone', s: 92.7, u: -8.0, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -9.05, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -10.1, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -11.15, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -12.2, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -13.25, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -14.3, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -15.35, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -16.4, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -17.45, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -18.5, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -19.55, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -20.6, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
      { kind: 'stone', s: 92.7, u: -21.65, size: [0.9, 0.22, 1.8], turn: -1.27, lean: 0.3, granite: true, y: 4.4 },
    ],
  },

  // Gullmarsplan (3 September 1946, as Johanneshov, for the trams; the metro's from 1 October
  // 1950; renamed in 1958), where the line divides: two island platforms, the western one's tracks
  // those into town and the eastern one's those out of it. Over their southern half the deck that
  // carries Johanneshovsvägen across the tracks, and beyond it the bus terminal of 1990, standing
  // on the deck over the platforms' south ends. From OpenStreetMap's indoor mapping, the laser
  // scan, Google's 3D mesh and photographs (2008 to 2025):
  //
  // Under the deck (the laser scan: its top 4.4 to 5.1 m over the platforms, falling to the north,
  // its northern edge askew to the tracks, from 20 m to 25 m south of the platforms' middle) the
  // ceiling is concrete cast against boards, 3.9 m over the platforms, held up down the middle of
  // each platform by mushroom columns: a square casing of glossy tiles, black and then red, and over
  // it a round concrete shaft flaring into a broad head. Beyond the outer tracks the walls are tiled
  // the same, black up to above the platforms and red over it, and on them Leif Tjerned's angels
  // (Änglarna, 1997), women in red dresses with golden wings, lying back along the wall, cut out of
  // aluminium and painted; his boxes of neon (1995), coloured glass in dark boxes lit from inside,
  // hang under the ceiling with strokes of red and yellow neon. (His Kryparna, and the steel
  // sculpture Zenit out on the open part of the platform out of town, aren't modelled: where they
  // are isn't known.)
  //
  // North of the deck each platform has a roof of its own: the eastern one an older butterfly over
  // its southern end, its underside pale boards on dark rafters, the rest of the platform open
  // under galvanised lamp posts (the laser scan: 5.5 m high); the western platform, widened in 2020
  // where a track was taken out, a new roof nearly its whole length, white boards on white rafters
  // on a dark steel beam and dark columns along its inner side. Under both, glass screens along
  // the columns. The terminal (the laser scan and Google's mesh: from 61 m to 83 m south): its
  // ground floor at the deck's level, the shops and the ticket hall behind glass doors in brushed
  // steel under a red canopy along its front; over it two storeys of bronze-tinted glass, a taller
  // glazed bay in their middle, and behind them a silver vault.
  'Gullmarsplan': {
    // the eastern platform's roof (the line it follows is that platform's)
    roof: {
      kind: 'butterfly',
      from: -23.5, to: 13.5, width: 10.4,
      shape: [[-23.5, -0.4, 10.8], [0, -0.5, 10.4], [13.5, -0.4, 10.4]],
      middle: 2.75, edge: 3.05, thick: 0.27, fascia: 0.35,
      rafters: 1.5, rafterSize: [0.08, 0.25], rafterColor: 0x4a3a2c,
      beam: 0.4,
      columns: { every: 7.5, at: -19.5, size: 0.22, plinth: { size: 0.4, height: 0.25 }, offset: 2.8 },
      lamps: { offset: 1.6, length: 1.5, every: 3.6 },
      colors: { underside: 0xd8ccb4, fascia: 0x2f3134, top: 0x5a5e62, steel: 0x2f3134 },
      signs: { at: [-15, 5], back: 'Utgång', ahead: '', blue: true },
      // (out of town: the trains of all three branches)
      boards: [
        { s: -8, u: -2.2, toward: 'Hagsätra', trains: ['19 Hagsätra  2 min', '19 Hagsätra  12 min'] },
        { s: 2, u: 0.8, toward: 'Farsta strand', trains: ['18 Farsta strand  4 min', '17 Skarpnäck  7 min'] },
      ],
    },
    roofs: [
      // the western platform's
      {
        kind: 'butterfly',
        from: -22, to: 63, width: 11.4,
        shape: [[-22, -19.5, 13.0], [0, -18.4, 11.4], [15, -17.65, 9.9], [30, -17.4, 8.4], [42, -17.25, 7.1], [54, -16.8, 4.8], [63, -17.3, 4.4]],
        middle: 2.85, edge: 2.85, thick: 0.25, fascia: 0.45,
        rafters: 1.5, rafterSize: [0.1, 0.25], rafterColor: 0xe2e3e0,
        beam: 0.45,
        columns: { every: 10, at: 0, size: 0.3, plinth: { size: 0.36, height: 0.1 }, offset: 1.6 },
        lamps: { offset: 2.4, length: 1.5, every: 3.0 },
        colors: { underside: 0xeeeeea, fascia: 0x2e3236, top: 0x6a6e72, steel: 0x2e3236 },
        signs: { at: [-8, 22, 48], back: 'Utgång', ahead: '', blue: true },
        clocks: [[12, -0.4]],
        // (into town)
        boards: [
          { s: 2, u: -0.6, toward: 'Hässelby strand', trains: ['19 Hässelby strand  3 min', '18 Alvik  6 min'] },
          { s: 32, u: -0.6, toward: 'Åkeshov', trains: ['17 Åkeshov  2 min', '19 Hässelby strand  9 min'] },
        ],
      },
      // under the deck, only the lamps hung from its ceiling and the signs to the way out (the roofs
      // themselves over the ceiling, out of sight)
      {
        kind: 'butterfly',
        from: -61, to: -24.7, width: 10.5,
        shape: [[-61, 0.2, 10.5], [-24.7, 0.2, 10.5]],
        middle: 3.95, edge: 3.95, thick: 0.03, fascia: 0.02,
        rafters: 40, rafterSize: [0.01, 0.01], beam: 0.01,
        columns: { every: 9, at: 0, size: 0.2, plinth: { size: 0.3, height: 0.1 }, between: [500, 501] },
        lamps: { offset: 3.5, length: 1.5, every: 4.5 },
        colors: { underside: 0x8f8b84, fascia: 0x8f8b84, top: 0x8f8b84, steel: 0x8f8b84 },
        signs: { at: [-40], back: 'Utgång', ahead: '', blue: true },
      },
      {
        kind: 'butterfly',
        from: -61, to: -24, width: 15,
        shape: [[-60, -21.9, 19.4], [-50, -21.25, 18.3], [-40, -20.6, 16.9], [-30, -19.9, 15.5], [-24, -19.5, 14.8]],
        middle: 3.95, edge: 3.95, thick: 0.03, fascia: 0.02,
        rafters: 40, rafterSize: [0.01, 0.01], beam: 0.01,
        columns: { every: 9, at: 0, size: 0.2, plinth: { size: 0.3, height: 0.1 }, between: [500, 501] },
        lamps: { offset: 4.2, length: 1.5, every: 4.5 },
        colors: { underside: 0x8f8b84, fascia: 0x8f8b84, top: 0x8f8b84, steel: 0x8f8b84 },
        signs: { at: [-40], back: 'Utgång', ahead: '', blue: true },
      },
    ],
    paving: {
      edge: 0.3, tactile: [0.3, 0.9], slabs: 0.9, paverSize: [0.5, 0.5], mix: 0.25,
      colors: { edge: 0xdcdad4, tactile: 0x7d7f80, slab: 0x9e9d98, pavers: 0x9e9d98, paler: 0xabaaa5, face: 0x8a8781 },
      pattern: 'grid',
    },
    buildings: ['w39362071'],
    rooms: [
      // (the stairs climb open from the platforms under the terminal's deck, between concrete
      // parapets; the platforms are the network's)
      { name: 'stairs and lifts', s: [-76, -50], u: [-26, 22], h: [-0.5, 1], walls: null, floor: null, stairs: 'boardConcrete', parapet: 1.1 },
      // (the hall's walls and ceiling are its shell's)
      { name: 'ticket hall', s: [-84, -61.3], u: [-40, 25], h: [4, 6.5], walls: null, floor: 'terrazzo', lamps: 2.9 },
      { name: 'square', s: [-61.3, -50], h: [4, 6.5], walls: null, floor: 'pavers' },
    ],
    blocks: [
      // the deck, out to where the ground comes up to it either side: its top 3 cm over the laser
      // scan's plane, asphalt, its edges' faces concrete; under it the ceiling over the platforms
      { name: 'Johanneshovsvägen, west', plan: [[-20, -47], [-61, -47], [-61, 4], [-24.6, 4]], h: [3.9, 4.13], low: 4.539, from: 4.10, fall: 4.403,
        walls: 'boardConcrete', sides: ['boardConcrete', null, null, 'boardConcrete'], roof: 0.25, roofColor: 0x55585a },
      { name: 'Johanneshovsvägen, east', plan: [[-24.6, 4], [-61, 4], [-61, 41], [-21, 41]], h: [3.9, 4.479], low: 4.842, from: 4.45, fall: 4.67,
        walls: 'boardConcrete', sides: [null, null, 'boardConcrete', 'boardConcrete'], roof: 0.25, roofColor: 0x55585a },
      { name: 'ceiling under the deck, west', plan: [[-20, -47], [-61, -47], [-61, 4], [-24.6, 4]], h: [3.88, 3.9], from: 3.88,
        walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete' },
      { name: 'ceiling under the deck, east', plan: [[-24.6, 4], [-61, 4], [-61, 41], [-21, 41]], h: [3.88, 3.9], from: 3.88,
        walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete' },
      { name: 'ceiling under the terminal', plan: [[-61, -39], [-83, -39], [-83, 24.5], [-61, 24.5]], h: [3.98, 4.0], from: 3.98,
        walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete' },
      // the walls beyond the outer tracks, black tiles up to a little over the platforms and red
      // over them, the deck's concrete edge beam along their top (the western one in two lengths,
      // following its track's curve)
      { name: 'western wall, black', plan: [[-23, -21.6], [-48, -24.6], [-48, -24.85], [-23, -21.85]], h: [-1.5, 0.8], from: -1.5,
        walls: 'blackTiles', sides: [undefined, null, null, undefined] },
      { name: 'western wall, red', plan: [[-23, -21.6], [-48, -24.6], [-48, -24.85], [-23, -21.85]], h: [0.8, 3.9], from: 0.8,
        walls: 'redTiles', sides: [undefined, null, null, undefined], band: { walls: 'boardConcrete', from: 3.0 } },
      { name: 'western wall, black, south', plan: [[-48, -24.6], [-75, -27.2], [-75, -27.45], [-48, -24.85]], h: [-1.5, 0.8], from: -1.5,
        walls: 'blackTiles', sides: [undefined, null, null, null] },
      { name: 'western wall, red, south', plan: [[-48, -24.6], [-75, -27.2], [-75, -27.45], [-48, -24.85]], h: [0.8, 4.0], from: 0.8,
        walls: 'redTiles', sides: [undefined, null, null, null], band: { walls: 'boardConcrete', from: 3.0 } },
      { name: 'eastern wall, black', plan: [[-22.5, 19.3], [-75, 19.3], [-75, 19.55], [-22.5, 19.55]], h: [-1.5, 0.8], from: -1.5,
        walls: 'blackTiles', sides: [undefined, null, null, undefined] },
      { name: 'eastern wall, red', plan: [[-22.5, 19.3], [-75, 19.3], [-75, 19.55], [-22.5, 19.55]], h: [0.8, 3.9], from: 0.8,
        walls: 'redTiles', sides: [undefined, null, null, undefined], band: { walls: 'boardConcrete', from: 3.0 } },
      // the terminal: the ticket hall and the shops on the deck, bronze glass along its sides; its
      // front in lengths (shops, the doors under the name, more shops, doors by the eastern gates,
      // the café)
      { name: 'ticket hall', plan: [[-61.3, -39], [-83, -39], [-83, 24.5], [-61.3, 24.5]], h: [4.0, 8.0], from: 5.0,
        walls: 'bronzeGlass', sides: [undefined, 'cladding', undefined, null], floor: 'terrazzo', ceiling: 'whitePanels', roof: 0.3, roofColor: 0x2c2d2f },
      { name: 'shops, west', plan: [[-61.4, -39], [-61.3, -39], [-61.3, -22], [-61.4, -22]], h: [4.8, 8.0], from: 4.8, walls: 'shopWindows' },
      { name: 'doors, west', plan: [[-61.4, -22], [-61.3, -22], [-61.3, -16], [-61.4, -16]], h: [4.8, 8.0], from: 4.8, walls: 'glassFront' },
      { name: 'shops, middle', plan: [[-61.4, -16], [-61.3, -16], [-61.3, -6], [-61.4, -6]], h: [4.9, 8.0], from: 4.9, walls: 'shopWindows' },
      { name: 'doors', plan: [[-61.4, -6], [-61.3, -6], [-61.3, 7], [-61.4, 7]], h: [5.0, 8.0], from: 5.0, walls: 'glassFront',
        nameSign: { side: 1, at: 0.5, length: 4.8, bottom: 7.3 } },
      { name: 'doors, east', plan: [[-61.4, 7], [-61.3, 7], [-61.3, 14.5], [-61.4, 14.5]], h: [5.0, 8.0], from: 5.0, walls: 'glassFront' },
      { name: 'café', plan: [[-61.4, 14.5], [-61.3, 14.5], [-61.3, 24.5], [-61.4, 24.5]], h: [5.0, 8.0], from: 5.0, walls: 'shopWindows' },
      // the red canopy along the front, over the buses' platform
      { name: 'canopy', plan: [[-56.8, -36], [-61.3, -36], [-61.3, 24.5], [-56.8, 24.5]], h: [8.0, 8.0], from: 8.0,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'ribbedMetal', roof: 0.45, roofColor: 0xa8322c },
      // the two storeys of bronze glass over it, either side of the glazed bay in their middle, and
      // the silver vault behind them
      { name: 'upper storeys, west', plan: [[-61.3, -28], [-74, -28], [-74, -9], [-61.3, -9]], h: [8.3, 16.4], from: 8.3,
        walls: 'bronzeGlass', roof: 0.3, roofColor: 0x3a3c3e },
      { name: 'glazed bay', plan: [[-61.2, -9], [-74, -9], [-74, 6], [-61.2, 6]], h: [8.3, 18.7], from: 8.3,
        walls: 'glazed', floor: 'terrazzo', ceiling: 'whitePanels', roof: 0.3, roofColor: 0x3a3c3e },
      { name: 'upper storeys, east', plan: [[-61.3, 6], [-74, 6], [-74, 24.5], [-61.3, 24.5]], h: [8.3, 16.4], from: 8.3,
        walls: 'bronzeGlass', roof: 0.3, roofColor: 0x3a3c3e },
      { name: 'vault', plan: [[-74, -24], [-83, -24], [-83, 24], [-74, 24]], h: [8.3, 13.5], from: 8.3,
        walls: 'cladding', roof: 0.1, roofColor: 0x9da3a7, gables: { count: 1, rise: 4.5, color: 0xa9aeb2, trim: 0xc9cdd0, round: true } },
    ],
    art: [
      { kind: 'mushrooms', size: 0.75, red: [1.2, 2.6], shaft: 0.5, flare: 2.9, head: 2.4, ceiling: 3.89,
        at: [[-27, 9.65], [-35, 9.7], [-43, 9.75], [-51, 9.75], [-27, -10.2], [-35, -10.6], [-43, -11.0], [-51, -11.5]] },
      { kind: 'neonBoxes', size: [2.4, 1.6, 0.35], ceiling: 3.89,
        at: [[-31, 9.7], [-47, 9.75], [-31, -10.4], [-47, -11.2], [-39, 0.8], [-55, 1.0]],
        tubes: [[-25.5, 4.2, 0.3, 0], [-28.5, 6.0, -0.5, 1], [-36, -2.2, 0.9, 0], [-41, 2.4, 0.2, 1], [-44, 14.2, -0.3, 0], [-52, -5.0, 0.6, 1],
          [-56, 12.2, 1.2, 0], [-33, -16.0, 0.4, 1], [-49, -17.0, -0.8, 0], [-38, 15.8, 0.7, 1], [-58, -8.0, -0.2, 0], [-24.5, -6.0, 1.0, 1]] },
      { kind: 'mural', picture: 'angel', s: -32, u: -22.68, turn: 1.69, bottom: 1.05, top: 2.55, width: 2.4 },
      { kind: 'mural', picture: 'angel', s: -44, u: -24.12, turn: 1.69, bottom: 1.15, top: 2.65, width: 2.4 },
      { kind: 'mural', picture: 'angel', s: -56, u: -25.37, turn: 1.667, bottom: 1.05, top: 2.55, width: 2.4 },
      { kind: 'mural', picture: 'angel', s: -28, u: 19.3, turn: -1.5708, bottom: 1.15, top: 2.65, width: 2.4 },
      { kind: 'mural', picture: 'angel', s: -40, u: 19.3, turn: -1.5708, bottom: 1.05, top: 2.55, width: 2.4 },
      { kind: 'mural', picture: 'angel', s: -52, u: 19.3, turn: -1.5708, bottom: 1.15, top: 2.65, width: 2.4 },
      // the lamp posts on the open part of the eastern platform
      { kind: 'masts', height: 5.5, color: 0x9a9fa3, top: false, arm: 0.9, at: [[22, 8.7], [49.3, 9.3], [75, 10.7]] },
      { kind: 'masts', height: 5.5, color: 0x9a9fa3, top: false, arm: 0.9, sign: 2.6, blue: true, at: [[35, 9.0], [62, 9.5]] },
      // the canopy's columns
      { kind: 'columns', at: [[-57.3, -34], [-57.3, -26], [-57.3, -18], [-57.3, -10], [-57.3, -2], [-57.3, 6], [-57.3, 14], [-57.3, 22]], from: 4.8, to: 8.0, size: 0.3, color: 0x2e3236 },
    ],
    benches: [
      { at: [-10, 4], double: true },
      { at: [-4, 16, 36], double: true, roof: 0 },
    ],
    fences: [
      // the railing along the deck's northern edge, rising with it to the east
      { kind: 'bars', points: [[-20.2, -47], [-24.4, 4, 0.35], [-21.2, 41, 0.53]], h: [4.35, 5.45] },
      // glass screens along the columns, under the eastern platform's roof and the western's
      { kind: 'glass', points: [[-20, 12.3], [11, 12.4]], h: [0, 2.4] },
      { kind: 'glass', points: [[28, -6.85], [36, -6.35], [44, -5.85]], h: [0, 2.4] },
      // chain-link beyond the outer tracks, north of the deck
      { points: [[-21, -21.3], [0, -19.1], [20, -17.1], [40, -14.7], [60, -11.7]], h: [-1.2, 0.8] },
      { points: [[-22, 19.3], [0, 18.9], [20, 18.4], [40, 17.9], [60, 17.5], [76, 17.4]], h: [-1.2, 0.8] },
    ],
  },

  // Skanstull (1 October 1933, as Ringvägen, for the trams; lengthened for the metro in 1950;
  // its south end rebuilt 2003–04). Its platform hall is in src/hall-styles.ts. From
  // OpenStreetMap's indoor mapping, the laser scan and photographs (2013): at the platform's south
  // end an escalator and stairs, and a lift beside them, climb to a low ticket hall just under
  // Götgatan, in the dark finish of the rebuilding: dark grey tiles, dark stone floors, a dark
  // perforated ceiling. From its unpaid side a lift rises to the street's median, a passage leads
  // east into a court sunk into the pavement east of Götgatan, open stairs up from its south end
  // and stairs in a glass stair house from its north end, a lift beside them, the station's name
  // in black over the stair house's foot; and a passage leads south-west under Ringen's corner to
  // a glass stair house on Ringvägen's north side and to open stairs on its far side. At the north
  // end stairs go down under the southbound track to a passage in the old cream tiles, and three
  // escalators climb into the hall under the end of Allhelgonagatan: cream tiles, grey tiled
  // floors, the gates just inside its glass front onto Götgatan, the name over it on a black band,
  // Allhelgonagatan's railing along its top.
  'Skanstull': {
    buildings: ['w352354225', 'w151083844', 'w940440762', 'w940440763'],
    rooms: [
      { name: 'lift on the platform', s: [-88, -83], u: [-4, 0], h: [-0.5, 0.5], walls: null, floor: null },
      { name: 'south flights', s: [-97, -84], u: [-4, 4], h: [-0.5, 2.5], walls: 'darkTiles', stairs: 'darkTiles', floor: 'darkStone', ceiling: 'perforated' },
      { name: 'south hall', s: [-113, -89], u: [-4, 4.5], h: [3, 4], walls: 'darkTiles', floor: 'darkStone', ceiling: 'perforated' },
      { name: 'east passage', s: [-113, -108], u: [4, 18.5], h: [2, 4], walls: 'darkTiles', stairs: 'darkTiles', floor: 'darkStone', ceiling: 'perforated' },
      { name: 'east court', s: [-118.5, -103], u: [18, 23.5], h: [2, 5], walls: null, floor: 'pavers', stairs: 'darkStone' },
      { name: 'west stair house', s: [-130.5, -123.5], u: [-30.5, -18.8], h: [2.5, 6], walls: null, floor: 'greyTiles', stairs: 'darkTiles', parapet: 1.1 },
      { name: 'south-west passage', s: [-170, -110], u: [-32, -3], h: [1.5, 4], walls: 'darkTiles', stairs: 'darkTiles', floor: 'darkStone', ceiling: 'perforated' },
      { name: 'north flights', s: [86, 99], u: [-4, 3], h: [-5, 0.5], walls: 'creamTiles', stairs: 'creamTiles', floor: 'greyTiles', ceiling: 'whiteRender' },
      { name: 'north passage', s: [97, 103], u: [-28, 2], h: [-5, -4], walls: 'creamTiles', floor: 'greyTiles', ceiling: 'whiteRender' },
      { name: 'north escalators', s: [96, 104], u: [-46, -27], h: [-5, 5], walls: 'creamTiles', stairs: 'creamTiles', ceiling: 'whiteRender' },
      { name: 'north hall', s: [94, 106], u: [-48, -18.2], h: [5, 6.5], walls: null, floor: 'greyTiles', lamps: 2.6 },
      { name: 'north forecourt', s: [94, 106], u: [-18.2, -14], h: [5, 6.5], walls: null, floor: 'pavers' },
    ],
    blocks: [
      // the hall under the end of Allhelgonagatan, its glass front onto Götgatan's pavement
      { name: 'north hall', plan: [[94.7, -18.2], [104.7, -18.2], [104.7, -47.4], [94.7, -47.4]], h: [5.7, 8.6], from: 5.7,
        walls: 'creamTiles', sides: ['blackFront'], band: { walls: 'darkStone', from: 8.5 },
        nameSign: { side: 0, at: 0.5, length: 4.4, bottom: 8.05, black: true },
        ceiling: 'whiteRender', roof: 0.25, roofColor: 0x4a4c4e, ground: true },
      // the cheeks of the stairs up to Allhelgonagatan either side of its front
      { name: 'north stairs south cheek', plan: [[94.3, -14.5], [94.7, -14.5], [94.7, -18.2], [94.3, -18.2]], h: [5.2, 6.5], from: 5.2, walls: 'darkStone' },
      { name: 'north stairs north cheek', plan: [[104.7, -14.5], [105.1, -14.5], [105.1, -18.2], [104.7, -18.2]], h: [5.2, 6.5], from: 5.2, walls: 'darkStone' },
      // the court sunk into the pavement east of Götgatan, open at its north end to the stairs and
      // the lift, the name over the stair house's foot
      { name: 'east court', plan: [[-108.4, 18.4], [-108.4, 22.8], [-118.0, 22.8], [-118.0, 18.4]], h: [2.6, 4.6], from: 2.6,
        walls: 'darkStone', sides: [null], nameSign: { side: 0, at: 0.5, length: 3.4, bottom: 4.0, black: true, inside: true }, ground: true },
      // the glass stair house over the court's north end, open to the north
      { name: 'east stair house', plan: [[-103.6, 18.4], [-103.6, 22.8], [-108.4, 22.8], [-108.4, 18.4]], h: [4.6, 7.4], from: 4.6,
        walls: 'glazed', sides: [null], floor: 'greyTiles', roof: 0.25, roofColor: 0x2e3033 },
      // the glass stair house on Ringvägen's north side, its doors at its west end
      { name: 'west stair house', plan: [[-124.0, -19.0], [-124.0, -30.0], [-129.9, -30.0], [-129.9, -19.0]], h: [5.2, 7.95], from: 5.2,
        walls: 'glazed', floor: 'greyTiles', roof: 0.25, roofColor: 0x2e3033,
        nameSign: { side: 1, at: 0.5, length: 3.0, bottom: 7.3, black: true } },
    ],
    fences: [
      // Allhelgonagatan's railing along its end over the hall's front
      { kind: 'rails', points: [[94.7, -18.3], [104.7, -18.3]], h: [8.9, 10.0], color: 0x2a2c2e },
      // the court's railings
      { kind: 'rails', points: [[-108.4, 18.3], [-118.0, 18.3]], h: [4.6, 5.6], color: 0x2a2c2e },
      { kind: 'rails', points: [[-108.4, 22.9], [-118.0, 22.9]], h: [4.6, 5.6], color: 0x2a2c2e },
      // round the open stairs on Ringvägen
      { kind: 'rails', points: [[-162.9, -19.8], [-162.9, -24.6], [-167.1, -24.6], [-167.1, -19.8]], h: [4.65, 5.65], color: 0x2a2c2e },
    ],
  },
  // Medborgarplatsen (its hall: src/hall-styles.ts). The southern ticket hall under the crossing
  // with Folkungagatan in yellow tiles over grey terrazzo, as photographs show it; the passage west
  // curving past Mari Pårup's mosaics (1997) on yellow tiles, crosses set in its floor; the stairs
  // up into the corner buildings in green tiles. The north flights and their landing in cream
  // tiles, and the glass pavilion in Björns trädgård (1995), framed in black on a stone plinth, its
  // floor green terrazzo with dark red lines, its gates just inside its doors on the north. Where
  // its walls stand is OpenStreetMap's outline (w141258102), 9.7 by 5.4 m.
  'Medborgarplatsen': {
    buildings: ['w141258102'],
    rooms: [
      { name: 'lift on the platform', s: [-1.5, 4], u: [1, 4], h: [-0.5, 0.5], walls: null, floor: null },
      { name: 'south flights', s: [-80, -72], u: [-3.5, 1.5], h: [-0.5, 0.5], walls: 'yellowTiles', stairs: 'yellowTiles', ceiling: 'whiteRender' },
      { name: 'west stairs', s: [-106, -97], u: [-33, -28], h: [3.5, 4.5], walls: 'greenTiles', stairs: 'greenTiles', ceiling: 'whiteRender' },
      { name: 'east stairs', s: [-106, -99], u: [8, 13.5], h: [3.5, 4.5], walls: 'greenTiles', stairs: 'greenTiles', ceiling: 'whiteRender' },
      { name: 'west passage', s: [-100, -92], u: [-33, -4.5], h: [3.5, 4.5], walls: 'crossMosaic', floor: 'crossTerrazzo', ceiling: 'whiteRender' },
      { name: 'south hall', s: [-101, -79], u: [-6, 13.5], h: [3.5, 4.5], walls: 'yellowTiles', floor: 'terrazzo', ceiling: 'whiteRender' },
      { name: 'north flights', s: [-6, 17], u: [-2, 1], h: [-0.5, 0.5], walls: 'creamTiles', stairs: 'creamTiles', ceiling: 'whiteRender' },
      { name: 'pavilion flights', s: [10, 18], u: [1.8, 5.2], h: [3.5, 4.5], walls: 'creamTiles', stairs: 'creamTiles', sill: 9.0 },
      { name: 'north landing', s: [0, 18], u: [-2.5, 8], h: [3.5, 4.5], walls: 'creamTiles', stairs: 'creamTiles', floor: 'terrazzo', ceiling: 'whiteRender' },
      { name: 'pavilion', s: [9.5, 19.6], u: [1.5, 7.6], h: [7.5, 8.5], walls: null, floor: 'greenTerrazzo' },
    ],
    blocks: [
      // the glass pavilion, its doors on the north under the name
      { name: 'pavilion', plan: [[9.7, 1.8], [19.45, 1.8], [19.45, 7.4], [9.7, 7.4]], h: [6.9, 11.0], from: 7.97,
        walls: 'darkGlazed', sides: [undefined, 'blackFront'], floor: 'greenTerrazzo', ceiling: 'whiteRender', roof: 0.3, roofColor: 0x2a2c2e,
        nameSign: { side: 1, at: 0.5, length: 3.8, bottom: 10.3, black: true }, ground: true },
    ],
    art: [
      // the white columns either side of the foot of the northern escalator
      { kind: 'columns', at: [[-6.2, -2.0], [-6.2, 1.0]], from: 0, to: 3.2, size: 0.45, color: 0xecebe6 },
    ],
  },
  // Rådmansgatan (its hall: src/hall-styles.ts). Both ticket halls in yellow tiles over small white
  // floor tiles, square tiled columns with white capitals flaring under the ceiling, the gates either
  // side of one, a glazed booth with dark panels beside the southern gates; the passages in yellow
  // tiles over grey, the western one's south wall black, with Sture V Nilsson's Strindberg wall
  // (1983) and his Blå tornet on it; as photographs show them. On the street (Google's mesh, set
  // 1.2 m west to OpenStreetMap's outlines, which it sits that far east of here): the glass
  // pavilion on the eastern pavement, 3.6 m high on a grey stone plinth, framed in black; the two
  // lifts' towers of steel, 3.75 m high, their tops dark with the name; at the park's corner the
  // small house over the north-western stairs, its glazed roof sloping down over them to the south
  // and its doors at the north end, where OpenStreetMap has its entrance; and at Sveavägen 98 SL's
  // glass doors under the blue band in the ground floor, as photographs show them.
  'Rådmansgatan': {
    buildings: ['w122041464', 'w129795640'],
    // (between the middle row's columns, which follow the platform's gentle curve)
    benches: { at: [-51.45, -27.47, -3.49, 20.52, 44.57], double: true, wood: true },
    middle: [[-68.2, 0.28], [-44, 0.1], [-20, 0.02], [4, 0], [28, 0], [44.3, -0.07], [68.2, -0.46]],
    rooms: [
      { name: 'lift on the platform', s: [-75.6, -72.5], u: [-2.6, -0.2], h: [-0.5, 0.5], walls: null, floor: null },
      { name: 'south flights', s: [-83, -74], u: [-0.5, 4.5], h: [-0.5, 0.5], walls: 'yellowTiles', stairs: 'yellowTiles', ceiling: 'whiteRender' },
      { name: 'pavilion stairs', s: [-122, -116.3], u: [10.5, 14], h: [3.8, 4.8], walls: 'yellowTiles', stairs: 'yellowTiles', sill: 7.9 },
      { name: 'east passage', s: [-117, -96], u: [3.2, 15], h: [3.8, 4.8], walls: 'yellowTiles', floor: 'greyTiles', ceiling: 'whiteRender' },
      { name: 'west stairs', s: [-114, -110], u: [-20.5, -13], h: [3.8, 4.8], walls: 'yellowTiles', stairs: 'yellowTiles', ceiling: 'whiteRender' },
      { name: 'west passage', s: [-114, -97.5], u: [-25, -3.2], h: [3.8, 4.8], walls: 'yellowTiles', back: 'blackTiles', stairs: 'yellowTiles', floor: 'greyTiles', ceiling: 'whiteRender' },
      { name: 'south lift passage', s: [-97.5, -80], u: [-11.5, -3.2], h: [3.8, 4.8], walls: 'yellowTiles', floor: 'greyTiles', ceiling: 'whiteRender' },
      { name: 'south lift door', s: [-78.5, -74.5], u: [-11.6, -9.2], h: [6.7, 7.7], walls: null, floor: 'pavers' },
      { name: 'south hall', s: [-101.5, -76], u: [-3.2, 5.5], h: [3.8, 4.8], walls: 'yellowTiles', floor: 'squareTiles', ceiling: 'whiteRender' },
      { name: 'north flights', s: [74, 86], u: [-5, -0.5], h: [-0.5, 0.5], walls: 'yellowTiles', stairs: 'yellowTiles', ceiling: 'whiteRender' },
      { name: 'north-west house', s: [118.6, 123], u: [-24.5, -20], h: [8.6, 9.6], walls: null, floor: 'greyTiles' },
      { name: 'north-west stairs', s: [111.5, 118.6], u: [-24.5, -20], h: [5.1, 6.1], walls: 'yellowTiles', stairs: 'yellowTiles', sill: 9.95 },
      { name: 'north lift door', s: [113.5, 116.5], u: [-18.5, -16.1], h: [8.3, 9.3], walls: null, floor: 'pavers' },
      { name: 'north-east passage', s: [103, 132], u: [1, 26], h: [5.1, 6.1], walls: 'yellowTiles', stairs: 'yellowTiles', floor: 'greyTiles', ceiling: 'whiteRender' },
      { name: 'north-west passage', s: [104, 112], u: [-23, -5.5], h: [5.1, 6.1], walls: 'yellowTiles', floor: 'greyTiles', ceiling: 'whiteRender' },
      { name: 'north hall', s: [84.5, 107], u: [-6.6, 1.4], h: [5.1, 6.1], walls: 'yellowTiles', floor: 'squareTiles', ceiling: 'whiteRender' },
    ],
    blocks: [
      // the yellow walls either side of the flights from the platform's ends, on into the rock, and
      // their ceiling rising over them (taking out the tunnel the tracks run on into, there, and the
      // platform's end where it runs on past the foot of the flights)
      { name: "south flights' walls", plan: [[-82.6, -2.75], [-75.5, -2.75], [-75.5, 3.95], [-82.6, 3.95]], h: [0, 6.9], low: 3.6,
        walls: 'yellowTiles', sides: [undefined, null, undefined, null], floor: 'greyTiles', ceiling: 'whiteRender', onPlatform: true },
      { name: "north flights' walls", plan: [[85.2, -4.65], [75.5, -4.65], [75.5, 1.15], [85.2, 1.15]], h: [0, 8.2], low: 3.6,
        walls: 'yellowTiles', sides: [undefined, null, undefined, null], floor: 'greyTiles', ceiling: 'whiteRender', onPlatform: true },
      // the end walls beside them, out to the platform's edges, and over the tracks' tunnels from
      // the hall's soffit up
      { name: 'south end wall, west', plan: [[-75.8, -4.15], [-75.52, -4.15], [-75.52, -2.75], [-75.8, -2.75]], h: [0, 3.6], walls: 'yellowTiles' },
      { name: 'south end wall, east', plan: [[-75.8, 3.95], [-75.52, 3.95], [-75.52, 4.85], [-75.8, 4.85]], h: [0, 3.6], walls: 'yellowTiles' },
      { name: 'over the south-western tunnel', plan: [[-75.8, -8.0], [-75.52, -8.0], [-75.52, -4.15], [-75.8, -4.15]], h: [2.9, 3.6], walls: 'yellowTiles' },
      { name: 'over the south-eastern tunnel', plan: [[-75.8, 4.85], [-75.52, 4.85], [-75.52, 8.6], [-75.8, 8.6]], h: [2.9, 3.6], walls: 'yellowTiles' },
      { name: 'north end wall, west', plan: [[75.52, -5.24], [75.8, -5.24], [75.8, -4.65], [75.52, -4.65]], h: [0, 3.6], walls: 'yellowTiles' },
      { name: 'north end wall, east', plan: [[75.52, 1.15], [75.8, 1.15], [75.8, 3.76], [75.52, 3.76]], h: [0, 3.6], walls: 'yellowTiles' },
      { name: 'over the north-western tunnel', plan: [[75.52, -9.0], [75.8, -9.0], [75.8, -5.24], [75.52, -5.24]], h: [2.9, 3.6], walls: 'yellowTiles' },
      { name: 'over the north-eastern tunnel', plan: [[75.52, 3.76], [75.8, 3.76], [75.8, 7.6], [75.52, 7.6]], h: [2.9, 3.6], walls: 'yellowTiles' },
      // the glass pavilion on the eastern pavement, its doors at the south end; its stone plinth
      { name: 'pavilion', plan: [[-123.6, 10.7], [-114.05, 10.7], [-114.05, 13.3], [-123.3, 13.65]], h: [6.5, 10.48], from: 6.88,
        walls: 'darkGlazed', sides: [undefined, undefined, undefined, 'blackFront'], floor: 'greyTiles', ceiling: 'whiteRender', roof: 0.3, roofColor: 0x2a2c2e, ground: true },
      { name: "pavilion's plinth, west", plan: [[-123.85, 10.4], [-113.8, 10.4], [-113.8, 10.7], [-123.85, 10.7]], h: [6.6, 7.4], from: 6.88,
        walls: 'terrazzo', roof: 0.05, roofColor: 0x9a9c9b },
      { name: "pavilion's plinth, north", plan: [[-114.05, 10.7], [-113.8, 10.7], [-113.8, 13.55], [-114.05, 13.3]], h: [6.6, 7.4], from: 6.88,
        walls: 'terrazzo', roof: 0.05, roofColor: 0x9a9c9b },
      { name: "pavilion's plinth, east", plan: [[-123.3, 13.65], [-114.05, 13.3], [-114.05, 13.55], [-123.3, 13.9]], h: [6.6, 7.4], from: 6.88,
        walls: 'terrazzo', roof: 0.05, roofColor: 0x9a9c9b },
      // the lifts' towers (their door sides the lifts' own)
      { name: 'south lift tower', plan: [[-80.6, -11.6], [-77.9, -11.6], [-77.9, -9.2], [-80.6, -9.2]], h: [6.9, 10.96], from: 7.21,
        walls: 'cladding', sides: [undefined, null, undefined, undefined], band: { walls: 'greyPanels', from: 10.2 }, roof: 0.15, roofColor: 0x2a2c2e,
        nameSign: { side: 1, at: 0.5, length: 2.0, bottom: 10.34, black: true } },
      { name: 'north lift tower', plan: [[110.4, -18.5], [113.1, -18.5], [113.1, -16.1], [110.4, -16.1]], h: [8.5, 12.57], from: 8.82,
        walls: 'cladding', sides: [undefined, null, undefined, undefined], band: { walls: 'greyPanels', from: 11.81 }, roof: 0.15, roofColor: 0x2a2c2e,
        nameSign: { side: 1, at: 0.5, length: 2.0, bottom: 11.95, black: true } },
      // the house over the north-western stairs: its glazed roof sloping down over them, its doors
      // at the north end
      { name: 'north-west house', plan: [[120.6, -20.1], [118.2, -20.1], [118.2, -24.4], [120.6, -24.4]], h: [8.8, 12.15], from: 9.15,
        walls: 'darkGlazed', sides: [undefined, null, undefined, 'blackFront'], floor: 'greyTiles', ceiling: 'whiteRender', roof: 0.2, roofColor: 0x3a3f44,
        nameSign: { side: 3, at: 0.5, length: 3.0, bottom: 11.47, black: true }, ground: true },
      { name: 'north-west stairs', plan: [[118.2, -20.1], [113.9, -20.1], [113.9, -24.4], [118.2, -24.4]], h: [8.8, 12.15], low: 10.2, from: 9.15,
        walls: 'glazed', sides: [undefined, undefined, undefined, null], roof: 0.08, roofColor: 0x9fb0b8, ground: true },
      // SL's doors in the ground floor of Sveavägen 98
      { name: 'north-east doors', plan: [[126.6, 13.5], [126.6, 14.2], [131.6, 14.2], [131.6, 13.5]], h: [8.6, 12.17], from: 8.87,
        walls: 'steelFront', sides: [null, null, null, undefined], roof: 0.1, roofColor: 0x8d8f91,
        nameSign: { side: 3, at: 0.5, length: 3.4, bottom: 11.67 } },
      // the inclined lift's shaft beside the northern escalators (the lift itself isn't walked)
      { name: "inclined lift's shaft", plan: [[85.2, -0.6], [85.2, 0.9], [75.5, 0.9], [75.5, -0.6]], h: [5.6, 8.0], from: 5.6, fall: 0,
        walls: 'glazed', floor: 'greyTiles', roof: 0.1, roofColor: 0x8a9095 },
      // the glazed ticket booth beside the southern gates
      { name: 'ticket booth', plan: [[-92.6, 3.2], [-89.4, 3.2], [-89.4, 4.9], [-92.6, 4.9]], h: [4.3, 6.6], from: 4.3,
        walls: 'liftWindows', roof: 0.05, roofColor: 0xb9b6ae },
    ],
    art: [
      // the halls' columns, one between the two banks of gates, one on the unpaid side
      { kind: 'capitals', at: [[-91.0, 0.0], [-96.3, 1.0]], size: 0.6, tiles: 'yellowTiles', from: 4.3, flare: 6.45, head: 1.4, ceiling: 6.9 },
      { kind: 'capitals', at: [[96.5, -2.6], [101.5, -2.6]], size: 0.6, tiles: 'yellowTiles', from: 5.6, flare: 7.75, head: 1.4, ceiling: 8.2 },
      // the Strindberg wall and Blå tornet on the western passage's black tiles
      { kind: 'mural', picture: 'strindberg', s: -103.14, u: -6.93, turn: -0.3885, bottom: 4.75, top: 6.6, width: 3.6 },
      { kind: 'mural', picture: 'blueTower', s: -106.69, u: -16.83, turn: -0.2858, bottom: 4.4, top: 6.6, width: 1.7 },
    ],
  },
  'Sankt Eriksplan': {
    buildings: ['w135177284', 'w135177285', 'w1174021669', 'w135244688', 'w836696981'],
    signName: 'S:t Eriksplan',
    // (wooden benches back to back, between the two rows of columns, halfway between columns)
    benches: { at: [-56.8, -32.8, -8.8, 15.2, 39.2, 63.2], double: true, wood: true },
    middle: [[-77, -1.5], [-60, -0.65], [-40, -0.15], [-20, 0], [0, 0], [20, 0.15], [40, 0.5], [60, 1.65], [76, 3.2]],
    rooms: [
      { name: 'lift on the platform', s: [-77.2, -73], u: [-5.2, -2.3], h: [-0.5, 0.5], walls: null, floor: null },
      { name: 'south flights', s: [-84, -76], u: [-2.6, 1.4], h: [-0.5, 0.5], walls: 'creamTiles', stairs: 'creamTiles', ceiling: 'whiteRender' },
      { name: 'north flights', s: [75, 84], u: [1, 6.8], h: [-0.5, 0.5], walls: 'creamTiles', stairs: 'creamTiles', ceiling: 'whiteRender' },
      { name: 'pavilion floor', s: [-123, -111], u: [17, 31], h: [6, 7.2], walls: null, floor: 'greyTiles' },
      { name: 'pavilion flights', s: [-118, -111.5], u: [19, 27], h: [3.3, 4.3], walls: 'creamTiles', stairs: 'creamTiles', sill: 7.6 },
      { name: 'west lift door', s: [-107.5, -104.3], u: [-24.5, -20.8], h: [6.1, 7.2], walls: null, floor: 'pavers' },
      { name: 'west stairs', s: [-111.5, -106.6], u: [-24, -17.5], h: [3.3, 4.3], walls: 'squareTiles', stairs: 'squareTiles', sill: 7.6 },
      { name: 'south halls and passages', s: [-150, -77], u: [-26, 40], h: [2.3, 4.3], walls: 'squareTiles', floor: 'paleTiles', ceiling: 'whiteRender', stairs: 'squareTiles' },
      { name: 'north lift door', s: [110.5, 114], u: [-1, 2], h: [9.7, 10.8], walls: null, floor: 'pavers' },
      { name: 'north stairs', s: [106.6, 117], u: [-5.5, -0.7], h: [5.1, 6.1], walls: 'squareTiles', stairs: 'squareTiles', sill: 11.2 },
      { name: 'north hall', s: [83, 108.5], u: [-6, 8], h: [4.1, 6.1], walls: 'squareTiles', floor: 'paleTiles', ceiling: 'whiteRender', stairs: 'squareTiles' },
    ],
    blocks: [
      // the cream walls either side of the flights from the platform's ends, on into the rock, and
      // their ceiling rising over them
      { name: "south flights' walls", plan: [[-83.5, -2.5], [-76.92, -2.5], [-76.92, 1.3], [-83.5, 1.3]], h: [0, 6.3], low: 4.5,
        walls: 'creamTiles', sides: [undefined, null, undefined, null], floor: 'paleTiles', ceiling: 'whiteRender', onPlatform: true },
      { name: "north flights' walls", plan: [[83.6, 1.1], [75.88, 1.1], [75.88, 6.7], [83.6, 6.7]], h: [0, 7.2], low: 4.5,
        walls: 'creamTiles', sides: [undefined, null, undefined, null], floor: 'paleTiles', ceiling: 'whiteRender', onPlatform: true },
      // the end walls beside them, out to the platform's edges, and over the tracks' tunnels from
      // the hall's soffit up
      { name: 'south end wall, west', plan: [[-77.2, -5.95], [-76.92, -5.95], [-76.92, -4.8], [-77.2, -4.8]], h: [0, 4.5], walls: 'creamTiles' },
      { name: 'south end wall, east', plan: [[-77.2, 1.3], [-76.92, 1.3], [-76.92, 3.15], [-77.2, 3.15]], h: [0, 4.5], walls: 'creamTiles' },
      { name: 'over the south lift', plan: [[-77.2, -4.8], [-76.92, -4.8], [-76.92, -2.5], [-77.2, -2.5]], h: [2.5, 4.5], walls: 'creamTiles' },
      { name: 'over the south-western tunnel', plan: [[-77.2, -9.95], [-76.92, -9.95], [-76.92, -5.95], [-77.2, -5.95]], h: [2.9, 4.5], walls: 'creamTiles' },
      { name: 'over the south-eastern tunnel', plan: [[-77.2, 3.15], [-76.92, 3.15], [-76.92, 7.15], [-77.2, 7.15]], h: [2.9, 4.5], walls: 'creamTiles' },
      { name: 'north end wall, west', plan: [[75.6, -1.4], [75.88, -1.4], [75.88, 1.1], [75.6, 1.1]], h: [0, 4.5], walls: 'creamTiles' },
      { name: 'north end wall, east', plan: [[75.6, 6.7], [75.88, 6.7], [75.88, 7.8], [75.6, 7.8]], h: [0, 4.5], walls: 'creamTiles' },
      { name: 'over the north-western tunnel', plan: [[75.6, -5.4], [75.88, -5.4], [75.88, -1.4], [75.6, -1.4]], h: [2.9, 4.5], walls: 'creamTiles' },
      { name: 'over the north-eastern tunnel', plan: [[75.6, 7.8], [75.88, 7.8], [75.88, 11.8], [75.6, 11.8]], h: [2.9, 4.5], walls: 'creamTiles' },
      // the inclined lift's shaft beside the northern escalators (the lift itself isn't walked)
      { name: "inclined lift's shaft", plan: [[83.6, 5.0], [83.6, 6.7], [75.88, 6.7], [75.88, 5.0]], h: [4.6, 7.0], from: 4.6, fall: 0,
        walls: 'glazed', floor: 'greyTiles', roof: 0.1, roofColor: 0x8a9095 },
      // the glass pavilion on the square, its front and doors at the south-eastern end, under the
      // name; its sides dark glass
      { name: 'pavilion', plan: [[-113.5, 17.34], [-121.62, 24.01], [-117.1, 29.53], [-108.98, 22.85]], h: [6.2, 10.6], from: 6.6,
        walls: 'darkGlazed', sides: [undefined, 'glassFront', undefined, undefined], band: { walls: 'greyPanels', from: 10.0 },
        floor: 'greyTiles', ceiling: 'whiteRender', roof: 0.15, roofColor: 0xb4b8ba,
        nameSign: { side: 1, at: 0.5, length: 6.4, bottom: 8.95 }, ground: true },
      // the glazed house over the western stairs, its curved roof falling from its doors at the
      // south-western end; and the lift's tower beside it (its door side the lift's own)
      { name: 'west house', plan: [[-112.15, -21.31], [-108.98, -24.2], [-103.98, -18.69], [-107.15, -15.8]], h: [6.2, 9.36], from: 6.66, lowBack: 8.26,
        walls: 'darkGlazed', sides: ['glassFront', undefined, undefined, undefined], floor: 'greyTiles', ceiling: 'whiteRender',
        roof: 0.1, roofColor: 0x6d7478, gables: { count: 1, rise: 0.5, color: 0x3a3f44, trim: 0x2a2c2e, round: true },
        nameSign: { side: 0, at: 0.5, length: 3.6, bottom: 8.81 }, ground: true },
      { name: 'west lift tower', plan: [[-104.2, -22.5], [-105.99, -20.9], [-104.26, -18.96], [-102.47, -20.56]], h: [6.3, 11.16], from: 6.67,
        walls: 'darkGlazed', sides: [null, undefined, undefined, undefined], band: { walls: 'greyPanels', from: 10.5 }, roof: 0.15, roofColor: 0x2a2c2e },
      // the house over the northern stairs, at the corner of Torsgatan: bronze-framed glass under a
      // vault falling from its open northern end, where the name is; and the lift's glazed tower
      { name: 'north house', plan: [[116.2, -4.66], [115.4, 0.03], [105.35, -1.72], [106.16, -6.41]], h: [9.8, 13.1], from: 10.2, lowBack: 11.2,
        walls: 'bronzeGlazed', sides: [null, undefined, undefined, undefined], floor: 'greyTiles', ceiling: 'pineBoards', roof: 0.08, roofColor: 0x5a4633,
        gables: { count: 1, rise: 1.0, color: 0x4a3a2a, trim: 0x3e3024, round: true },
        nameSign: { side: 0, at: 0.5, length: 4.0, bottom: 12.55 }, ground: true },
      { name: 'north lift tower', plan: [[110.8, -0.7], [110.8, 1.7], [108.2, 1.7], [108.2, -0.7]], h: [9.8, 14.64], from: 10.24,
        walls: 'darkGlazed', sides: [null, undefined, undefined, undefined], band: { walls: 'greyPanels', from: 14.0 }, roof: 0.15, roofColor: 0x2a2c2e },
      // the ticket booth beside the southern gates
      { name: 'ticket booth', plan: [[-93.0, -5.6], [-89.8, -5.6], [-89.8, -3.8], [-93.0, -3.8]], h: [3.8, 6.1], from: 3.8,
        walls: 'liftWindows', roof: 0.05, roofColor: 0xb9b6ae },
    ],
    art: [
      // the halls' tiled columns, beside the gates
      { kind: 'capitals', at: [[-91.7, 2.0]], size: 0.6, tiles: 'squareTiles', from: 3.8, flare: 5.7, head: 1.2, ceiling: 6.3 },
      { kind: 'capitals', at: [[95.7, 6.0]], size: 0.6, tiles: 'squareTiles', from: 4.6, flare: 6.5, head: 1.2, ceiling: 7.2 },
      // the metro's signs on the pavilion and the lifts' towers
      { kind: 'roundel', s: -117.4, u: 29.0, h: 11.45, size: 0.9, foot: 10.75, along: true },
      { kind: 'roundel', s: -104.3, u: -20.7, h: 12.0, size: 0.9, foot: 11.31 },
      { kind: 'roundel', s: 110.4, u: 1.4, h: 15.5, size: 0.9, foot: 14.79, along: true },
    ],
  },

  // Thorildsplan (26 October 1952): an island platform in the open between the carriageways of
  // Drottningholmsvägen, the motorway ramp to Fredhällsmotet on its south side. Its eastern half
  // is under a roof of fourteen vaulted bays (OpenStreetMap's `round_row` roof, from 4.5 m to
  // 88.5 m east of the platform's middle, about 10.3 m wide): the laser scan puts its top 5 m over
  // the platform at each bay's crown and 4.1 m at the bays' ends, 6 m apart, and level across the
  // platform. Photographs (2009 to 2025) show the bays as barrels of corrugated sheet across the
  // platform, their arches open over a blue beam along each edge, on blue steel: two rows of
  // columns close either side of the middle, a blue beam across at each bay's end, a dark beam
  // along the middle; the underside, ochre until about 2019, is now bare grey metal. Beyond the
  // roof, galvanised masts down the middle with two round lamps each and SL's black name signs;
  // grey slabs, a white edge and a dark strip of studs; a glass shelter at the roof's west end.
  //
  // The way out is at the east end. A ramp goes down the middle of the platform's eastern half
  // (Albert Guillaumes' drawing: its opening from about 30 m to 64 m), between parapets tiled
  // with Lars Arrhenius's pixel figures (2008: pale blue tiles, a heart, invaders, clouds,
  // toadstools, snow-capped peaks), under the platform's end and a walkway, to the ticket hall
  // between the tracks; from the platform's end a flight goes down on either side of it, and
  // between them the walkway runs out to a lift (OpenStreetMap: the flights from 76 m to 86 m,
  // the lift at 88 m). The hall (photographs, 2017 to 2025): slate floor, white tiles, a white
  // ceiling; the gates at 100 m. From it a passage runs north under the tracks and the road to
  // stairs up into a glass pavilion on the street (and a lift beside them), and south under the
  // tracks and the ramp to a portal in a sunken court, stairs climbing the slope from it.
  'Thorildsplan': {
    roof: {
      kind: 'butterfly',
      from: 4.5, to: 88.5, width: 10.3,
      middle: 3.95, edge: 3.95, thick: 0.15, fascia: 0.45,
      barrels: { length: 6, rise: 0.85 },
      rafters: 6, rafterAt: 10.5, rafterSize: [0.22, 0.4], rafterColor: 0x1f5aa8,
      deck: 'ribbed',
      beam: 0.3,
      gutter: [0.4, 0.5], gutterColor: 0x3a3e42,
      // (in pairs either side of the ramp, none where the flights go down beside it)
      columns: { every: 6, at: 10.5, size: 0.22, plinth: { size: 0.36, height: 0.08 }, pair: 2.8, offset: -0.4, gaps: [[78, 89]] },
      lamps: { offset: 3.3, length: 1.5, every: 3, at: [-3.4, 3.4] },
      colors: { underside: 0x9ba0a4, fascia: 0x1f5aa8, top: 0x4b5054, steel: 0x1f5aa8 },
      signs: { at: [13.5, 22.5], back: '', ahead: 'Utgång' },
      // (trains keep left: those for the city on the northern track)
      boards: [
        { s: 19.5, u: -3.6, toward: 'Skarpnäck', trains: ['17 Skarpnäck  2 min', '19 Hagsätra  6 min'] },
        { s: 19.5, u: 3.6, toward: 'Hässelby strand', trains: ['19 Hässelby strand  4 min', '17 Åkeshov  8 min'] },
      ],
    },
    paving: {
      edge: 0.3, tactile: [0.4, 0.75], slabs: 6, slabSize: [0.4, 0.4],
      colors: { edge: 0xdcdad3, tactile: 0x505355, slab: 0x8a8d8f, pavers: 0x8a8d8f, face: 0x9a9792 },
      studs: true, pattern: 'grid',
    },
    rooms: [
      // the ramp: open between its parapets, then under the platform's end and the walkway
      { name: 'ramp', s: [29, 64.5], h: [-3, 0.5], walls: 'pixelTiles', floor: 'asphalt', sill: 1.0 },
      { name: 'ramp under the walkway', s: [64.5, 87], u: [-5, -2.6], h: [-4.7, -4.5], walls: 'pixelTiles', floor: 'asphalt', ceiling: 'whiteRender' },
      { name: 'flights', s: [75, 87], h: [-4.7, -4.5], walls: 'pixelTiles', stairs: 'pixelTiles', floor: 'asphalt', sill: 1.0 },
      { name: 'walkway', s: [77, 87], h: [-0.5, 0.5], walls: 'pixelTiles', floor: 'asphalt' },
      { name: 'ticket hall', s: [85, 106.5], u: [-9, 0], h: [-4.7, -4.5], walls: 'squareTiles', floor: 'slate', ceiling: 'whitePanels' },
      { name: 'south stairs', s: [104, 113], u: [41, 54], h: [-4.7, -4.5], walls: 'boardConcrete', stairs: 'boardConcrete', floor: 'pavers' },
      { name: 'north stairs', s: [104, 116], u: [-43, -34.2], h: [-4.7, -2.1], walls: 'squareTiles', stairs: 'squareTiles', floor: 'slate', ceiling: 'whiteRender' },
      { name: 'passages', s: [104, 112], h: [-4.7, -4.5], walls: 'squareTiles', floor: 'slate', ceiling: 'whiteRender' },
    ],
    blocks: [
      // the face over the ramp where it goes in under the platform's end, up to the parapets' height
      { name: "ramp's mouth", plan: [[64.02, -4.25], [64.2, -4.26], [64.2, -1.82], [64.02, -1.81]], h: [-0.4, 1.0], from: -0.4,
        walls: 'pixelTiles', roof: 0.05, roofColor: 0x9a9c9b },
      // the parapets either side of the ramp's opening, tiled on the platform's side too, under a
      // steel coping (photographs), from the ramp's head, where the ramp's own walls don't yet rise
      { name: 'north parapet', plan: [[29.94, -2.47], [63.94, -4.21], [63.93, -4.41], [29.93, -2.67]], h: [0, 0.98], from: 0,
        walls: 'pixelTiles', roof: 0.04, roofColor: 0xb4b8bb, onPlatform: true },
      { name: 'south parapet', plan: [[30.07, -0.13], [64.06, -1.88], [64.07, -1.68], [30.08, 0.07]], h: [0, 0.98], from: 0,
        walls: 'pixelTiles', roof: 0.04, roofColor: 0xb4b8bb, onPlatform: true },
      // the glass pavilion on the street over the northern stairs, its doors at the east end
      { name: 'pavilion', plan: [[106.6, -37.7], [106.6, -42.6], [113.0, -42.8], [113.2, -38.0]], h: [-0.3, 3.0], from: 0.11,
        walls: 'darkGlazed', sides: [undefined, undefined, 'blackFront', undefined], floor: 'slate', ceiling: 'whiteRender',
        roof: 0.2, roofColor: 0x2e3134, ground: true },
      // nothing drawn: the city's ground under the tracks (a metre under the rails, under the
      // network's own) taken away over the hall and the passages, whose ceilings come up to it
      { name: 'ground over the hall', plan: [[80, -13], [80, 3.5], [111.5, 3.5], [111.5, -13]], h: [-3, -1.98], from: -3,
        walls: 'boardConcrete', sides: [null, null, null, null], ground: true },
      // the paved deck over the hall between the tracks, east of the walkway, its rooflights in two
      // rows (Google's mesh), and a low building with a metal roof beyond them
      { name: 'deck over the hall', plan: [[86.8, 0.1], [108.5, -2.3], [108.5, -9.1], [86.8, -8.1]], h: [-1.7, -1.64], low: -1.86, from: -1.7,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.02, roofColor: 0x8c8a85 },
      { name: 'building between the tracks', plan: [[109.3, -7.9], [115.8, -7.9], [115.8, -4.1], [109.3, -4.1]], h: [-1.9, 0.85], from: -1.9,
        walls: 'boardConcrete', roof: 0.15, roofColor: 0x76839a },
      // the walls of the cutting, from the laser scan: on the north the road's (Drottningholmsvägen
      // westbound, falling from 3.3 m over the platform at the west to 0.3 m at the east), on the
      // south the motorway ramp's, its deck climbing from the ground east of the station to 9.9 m
      // over the platform at the west, where it bends away south
      { name: "north road's wall, -120 to -110", plan: [[-120, -4.0], [-110, -3.9], [-110, -22], [-120, -22]], h: [-2.4, 3.28], low: 3.11, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, undefined], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "north road's wall, -110 to -100", plan: [[-110, -3.9], [-100, -4.3], [-100, -22], [-110, -22]], h: [-2.4, 3.11], low: 2.96, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "north road's wall, -100 to -80", plan: [[-100, -4.3], [-80, -4.7], [-80, -21], [-100, -22]], h: [-2.4, 2.96], low: 2.67, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "north road's wall, -80 to -60", plan: [[-80, -4.7], [-60, -6.0], [-60, -21], [-80, -21]], h: [-2.4, 2.67], low: 2.31, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "north road's wall, -60 to -40", plan: [[-60, -6.0], [-40, -6.5], [-40, -20], [-60, -21]], h: [-2.4, 2.31], low: 2.00, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "north road's wall, -40 to -20", plan: [[-40, -6.5], [-20, -7.6], [-20, -23], [-40, -20]], h: [-2.4, 2.00], low: 1.67, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "north road's wall, -20 to 0", plan: [[-20, -7.6], [0, -8.55], [0, -23], [-20, -23]], h: [-2.4, 1.67], low: 1.34, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "north road's wall, 0 to 20", plan: [[0, -8.55], [20, -9.4], [20, -23], [0, -23]], h: [-2.4, 1.34], low: 0.90, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "north road's wall, 20 to 40", plan: [[20, -9.4], [40, -10.6], [40, -22], [20, -23]], h: [-2.4, 0.90], low: 0.58, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "north road's wall, 40 to 60", plan: [[40, -10.6], [60, -11.5], [60, -23], [40, -22]], h: [-2.4, 0.58], low: 0.52, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "north road's wall, 60 to 80", plan: [[60, -11.5], [80, -11.9], [80, -27], [60, -23]], h: [-2.4, 0.52], low: 0.42, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "north road's wall, 80 to 100", plan: [[80, -11.9], [100, -13.3], [100, -27], [80, -27]], h: [-2.4, 0.42], low: 0.26, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "north road's wall, 100 to 120", plan: [[100, -13.3], [120, -13.8], [120, -24], [100, -27]], h: [-2.4, 0.26], low: -0.21, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, undefined, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, -140 to -130", plan: [[-140, 23.5], [-130, 19.5], [-130, 26.5], [-140, 30.5]], h: [-2.4, 9.83], low: 9.53, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, undefined], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, -130 to -120", plan: [[-130, 19.5], [-120, 15.5], [-120, 23.0], [-130, 26.5]], h: [-2.4, 9.53], low: 9.23, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, -120 to -110", plan: [[-120, 15.5], [-110, 15.1], [-110, 22.5], [-120, 23.0]], h: [-2.4, 9.23], low: 8.84, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, -110 to -100", plan: [[-110, 15.1], [-100, 13.2], [-100, 21.5], [-110, 22.5]], h: [-2.4, 8.84], low: 8.51, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, -100 to -90", plan: [[-100, 13.2], [-90, 10.7], [-90, 19.0], [-100, 21.5]], h: [-2.4, 8.51], low: 8.06, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, -90 to -80", plan: [[-90, 10.7], [-80, 9.1], [-80, 17.7], [-90, 19.0]], h: [-2.4, 8.06], low: 7.69, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, -80 to -60", plan: [[-80, 9.1], [-60, 7.8], [-60, 16.25], [-80, 17.7]], h: [-2.4, 7.69], low: 6.86, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, -60 to -40", plan: [[-60, 7.8], [-40, 7.35], [-40, 15.9], [-60, 16.25]], h: [-2.4, 6.86], low: 6.08, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, -40 to -20", plan: [[-40, 7.35], [-20, 7.9], [-20, 16.1], [-40, 15.9]], h: [-2.4, 6.08], low: 5.36, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, -20 to 0", plan: [[-20, 7.9], [0, 8.1], [0, 16.3], [-20, 16.1]], h: [-2.4, 5.36], low: 4.70, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, 0 to 20", plan: [[0, 8.1], [20, 8.8], [20, 16.5], [0, 16.3]], h: [-2.4, 4.70], low: 3.92, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, 20 to 40", plan: [[20, 8.8], [40, 8.3], [40, 16.25], [20, 16.5]], h: [-2.4, 3.92], low: 3.14, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, 40 to 60", plan: [[40, 8.3], [60, 7.3], [60, 15.0], [40, 16.25]], h: [-2.4, 3.14], low: 2.40, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, 60 to 80", plan: [[60, 7.3], [80, 5.65], [80, 15.0], [60, 15.0]], h: [-2.4, 2.40], low: 1.60, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, 80 to 90", plan: [[80, 5.65], [90, 3.6], [90, 13.0], [80, 15.0]], h: [-2.4, 1.60], low: 1.26, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, 90 to 100", plan: [[90, 3.6], [100, 2.8], [100, 12.0], [90, 13.0]], h: [-2.4, 1.26], low: 0.96, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      { name: "motorway ramp, 100 to 110", plan: [[100, 2.8], [110, 2.0], [110, 11.0], [100, 12.0]], h: [-2.4, 0.96], low: 0.58, from: -2.4,
        walls: 'boardConcrete', sides: [undefined, undefined, undefined, null], roof: 0.02, roofColor: 0x55585a, ground: true },
    ],
    // the railings along the walls' tops
    fences: [
      { kind: 'bars', h: [3.30, 4.40], points: [[-120, -4.15, 0.0], [-110, -4.05, -0.17], [-100, -4.45, -0.32], [-80, -4.85, -0.61], [-60, -6.15, -0.97], [-40, -6.65, -1.28], [-20, -7.75, -1.61], [0, -8.7, -1.94], [20, -9.55, -2.38], [40, -10.75, -2.7], [60, -11.65, -2.76], [80, -12.05, -2.86], [100, -13.45, -3.02], [120, -13.95, -3.49]] },
      { kind: 'bars', h: [9.85, 10.95], points: [[-140, 23.65, 0.0], [-130, 19.65, -0.3], [-120, 15.65, -0.6], [-110, 15.25, -0.99], [-100, 13.35, -1.32], [-90, 10.85, -1.77], [-80, 9.25, -2.14], [-60, 7.95, -2.97], [-40, 7.5, -3.75], [-20, 8.05, -4.47], [0, 8.25, -5.13], [20, 8.95, -5.91], [40, 8.45, -6.69], [60, 7.45, -7.43], [80, 5.8, -8.23], [90, 3.75, -8.57], [100, 2.95, -8.87], [110, 2.15, -9.25]] },
    ],
    art: [
      { kind: 'rooflights', size: 1.7, ceiling: -2.1, top: -1.68,
        at: [[89.9, -6.5], [94.6, -6.8], [99.2, -7.1], [90.3, -2.75], [94.9, -3.1], [99.4, -3.5]] },
      { kind: 'masts', height: 5.0, color: 0x8e9397, top: false, arm: 0.42, sign: 2.9, at: [[-6, -0.05], [-48, 0.85]] },
      { kind: 'masts', height: 5.0, color: 0x8e9397, top: false, arm: 0.42, at: [[-20, 0.25], [-34, 0.55], [-62, 1.2]] },
    ],
    benches: { at: [-13, -27, -41, -55, 17.5] },
    shelters: [{ s: [6.5, 11.5], u: [-1.1, 1.1] }],
    // OpenStreetMap's pavilion and street lift, which the blocks and the layout draw
    buildings: ['w244321280', 'w1160410819'],
  },

  // Kristineberg (26 October 1952, with the line from Hötorget to Vällingby): an island platform on
  // a bank beside Drottningholmsvägen, entered only from its west end, where Nordenflychtsvägen
  // runs under the tracks and the road (Swedish and English Wikipedia). Lantmäteriet's laser scan
  // puts its roof from 71.5 m west of the platform's middle to 1.5 m east, 7.8 m wide, its top 3.3 m
  // over the platform at the valley and 3.7 m at the edges. Photographs (2010 to 2019) show it of
  // galvanised ribbed sheet, the ribs across, on dark grey steel: columns in pairs under a beam each
  // along the platform, a rafter across from edge to edge over each pair, purlins along; tube lamps;
  // black name signs hung between the pairs, departure boards, a clock, a glass shelter. Grey slabs
  // in bond, a pale edge and a dark ribbed strip, and under the roof two bands of red pavers along
  // the platform outside the columns. Out in the open, galvanised lamp posts down the middle, two
  // lamps on a T and a third lower down (the laser scan: 5 m high, 10, 25, 41 and 60 m east), the
  // black sign on one; chain-link fences beyond both tracks, the southern on the road's barrier.
  //
  // Carina Wallert's Resande med djur (1991) stands 16.5 m east of the middle: on a long plinth of
  // concrete a traveller of dark bronze, seated behind an upright block, and a lean dog stretched
  // out in front of it, in a patch of red pavers (photographs; the laser scan places the plinth).
  //
  // At the platform's west end a stair house stands between the tracks (the laser scan): a flight
  // down to the street, 15 m long and 3 m wide under a roof sloping from 2.95 m over the platform at
  // its top to 0.8 m at its foot, white tiles to above a person's head, glass in dark frames above
  // them, dark stone steps and a white ceiling (photographs); beside it on the north a glazed
  // walkway along the track to a lift's tower, 4.2 m high, 22 m west of the platform. West of it
  // the tracks run on concrete decks over the ticket hall, which lies under the northern one and
  // between them, and over the street (OpenStreetMap's outline and indoor mapping: the flight's foot
  // 90 m west, the lift at 93 m, the gates, the doors onto Nordenflychtsvägen at 91.5 m, 13.2 m
  // north). The hall (photographs, 2017 and 2019): walls of board-marked concrete, a white strip
  // ceiling, grey terrazzo, a round grey column, the gates with the ticket booth in blue panels east
  // of them; its front of glass doors under SL's blue band with the station's name, Pressbyrån's
  // windows east of them and a glazed corner west of them, under a flat canopy, the T on the deck's
  // corner over the street. Nordenflychtsvägen goes on under Drottningholmsvägen's deck, 4.5 m and
  // more clear, on rows of round concrete columns.
  'Kristineberg': {
    roof: {
      kind: 'butterfly',
      from: -71.5, to: 1.5, width: 7.8,
      middle: 3.1, edge: 3.5, thick: 0.18, fascia: 0.25,
      rafters: 12, rafterAt: -65.5, rafterSize: [0.18, 0.35], rafterColor: 0x3b3f43,
      deck: 'ribbedAcross',
      purlins: { at: [-2.9, -1.6, 1.6, 2.9], size: [0.1, 0.22] },
      beam: 0.35,
      columns: { every: 12, at: -65.5, size: 0.22, plinth: { size: 0.36, height: 0.12 }, pair: 1.8 },
      lamps: { offset: 2.4, length: 1.5, every: 3, tube: true },
      colors: { underside: 0x9a9d9f, fascia: 0x34383b, top: 0x55595c, steel: 0x3b3f43 },
      signs: { at: [-53.5, -29.5, -5.5], back: '', ahead: '', bottom: 2.25 },
      clocks: [[-44, -1.6]],
      // (trains keep left: those for the city on the northern track)
      boards: [
        { s: -46, u: -2.2, toward: 'T-Centralen', trains: ['18 Farsta strand  1 min', '19 Hagsätra  6 min'] },
        { s: -40, u: 2.2, toward: 'Hässelby strand', trains: ['18 Hässelby strand  4 min', '19 Hässelby strand  9 min'] },
      ],
    },
    paving: {
      edge: 0.55, tactile: [0.55, 0.9], slabs: 0.9, paverSize: [0.6, 0.4], mix: 0.3,
      colors: { edge: 0xd2cfc7, tactile: 0x5e6163, slab: 0xa3a19c, pavers: 0xa3a19c, paler: 0xb1afaa, face: 0x8e8b85 },
      pattern: 'bond',
    },
    rooms: [
      { name: 'stair house', s: [-95, -72], u: [-4.8, 1.0], h: [-0.5, 0.5], walls: null, floor: 'darkStone' },
      // (the stair house's glass over the tiles, its ceiling the flight's)
      { name: 'stairs', s: [-88, -74], u: [-2.0, 1.0], h: [-5.6, 0.3], walls: 'squareTiles', floor: 'darkStone', stairs: 'squareTiles', sill: 2.0 },
      // (the hall's walls and ceiling are its shell's)
      { name: 'ticket hall', s: [-96, -81], u: [-13.5, 1.0], h: [-5.6, -4.8], walls: 'boardConcrete', floor: 'terrazzo', ceiling: 'slats', sill: -5.29 },
    ],
    blocks: [
      // the stair house: the flight's hall, its roof sloping down from the platform, glazed above
      // the flight's tiled walls
      { name: 'stair house', plan: [[-72.2, 1.0], [-87.5, 1.0], [-87.5, -2.0], [-72.2, -2.0]], h: [-5.3, 2.8], low: 0.63, from: -5.3,
        walls: 'darkGlazed', sides: [undefined, 'squareTiles', undefined, null], floor: 'darkStone', ceiling: 'slats', roof: 0.15, roofColor: 0x3a3d40, ground: true },
      // the walkway beside it to the lift, over the hall's roof at its west end
      { name: 'walkway', plan: [[-87.5, -2.0], [-72.2, -2.0], [-72.2, -4.6], [-87.5, -4.6]], h: [-2.0, 2.75], from: 0,
        walls: 'darkWindows', sides: [null, null, undefined, null], floor: 'darkStone', ceiling: 'slats', roof: 0.15, roofColor: 0x3a3d40, eaves: [0, 0, 0.5, 0] },
      { name: 'walkway, west', plan: [[-94.5, -2.0], [-87.5, -2.0], [-87.5, -4.6], [-94.5, -4.6]], h: [-2.4, 2.75], from: 0,
        walls: 'darkWindows', sides: [undefined, null, undefined, undefined], floor: 'darkStone', ceiling: 'slats', roof: 0.15, roofColor: 0x3a3d40, eaves: [0, 0, 0.5, 0] },
      // the ticket hall: between the tracks under a roof of its own, under the northern deck, and
      // its front out from under the deck, its roof reaching out over the doors
      { name: 'ticket hall between the tracks', plan: [[-95.8, 1.0], [-87.5, 1.0], [-87.5, -3.75], [-95.8, -3.75]], h: [-5.3, -2.65], from: -5.3,
        walls: 'boardConcrete', sides: [undefined, null, null, undefined], floor: 'terrazzo', ceiling: 'slats', roof: 0.25, roofColor: 0x6f6e69, ground: true },
      { name: 'ticket hall under the deck', plan: [[-95.4, -3.75], [-87.5, -3.75], [-87.5, -9.25], [-95.4, -9.25]], h: [-5.3, -2.75], from: -5.3,
        walls: 'boardConcrete', sides: [null, null, null, undefined], floor: 'terrazzo', ceiling: 'slats', roof: 0.1, ground: true },
      { name: 'ticket hall under the deck, east', plan: [[-87.5, -3.75], [-81.7, -3.75], [-81.7, -9.25], [-87.5, -9.25]], h: [-5.3, -2.75], from: -5.3,
        walls: 'boardConcrete', sides: [undefined, undefined, null, null], floor: 'terrazzo', ceiling: 'slats', roof: 0.1, ground: true },
      { name: "ticket hall's front, west", plan: [[-95.4, -9.25], [-93.2, -9.25], [-93.2, -13.4], [-95.4, -13.4]], h: [-5.3, -2.15], from: -5.3,
        walls: 'glazed', sides: [null, null, undefined, 'boardConcrete'], band: { walls: 'boardConcrete', from: -2.65 }, floor: 'terrazzo', ceiling: 'slats',
        roof: 0.25, roofColor: 0x6f6e69, eaves: [0, 0, 1.0, 0], ground: true },
      { name: "ticket hall's doors", plan: [[-93.2, -9.25], [-89.8, -9.25], [-89.8, -13.4], [-93.2, -13.4]], h: [-5.3, -2.15], from: -5.3,
        walls: 'glassFront', sides: [null, null, undefined, null], band: { walls: 'boardConcrete', from: -2.65 }, floor: 'terrazzo', ceiling: 'slats',
        roof: 0.25, roofColor: 0x6f6e69, eaves: [0, 0, 1.0, 0], ground: true, nameSign: { side: 2, at: 0.5, length: 3.4, bottom: -2.95 } },
      { name: "ticket hall's front, east", plan: [[-89.8, -9.25], [-81.7, -9.25], [-81.7, -13.4], [-89.8, -13.4]], h: [-5.3, -2.15], from: -5.3,
        walls: 'shopWindows', sides: [null, 'boardConcrete', undefined, null], band: { walls: 'boardConcrete', from: -2.65 }, floor: 'terrazzo', ceiling: 'slats',
        roof: 0.25, roofColor: 0x6f6e69, eaves: [0, 0, 1.0, 0], ground: true },
      { name: 'ticket booth', plan: [[-88.4, -6.6], [-85.9, -6.6], [-85.9, -8.6], [-88.4, -8.6]], h: [-5.3, -3.05], from: -5.3,
        walls: 'blueGlazed', roof: 0.05, roofColor: 0xb9b6ae },
      // under the southern deck, the bank's end; and the bank's end west of the street, under both
      { name: "bank's end under the southern deck", plan: [[-95.8, 6.05], [-95.8, 1.0], [-82, 1.0], [-82, 6.05]], h: [-7, -1.9], from: -7,
        walls: 'boardConcrete', sides: [undefined, null, null, null], roof: 0.02, roofColor: 0x6b6a62, ground: true },
      { name: "bank's end west of the street", plan: [[-122, 6.15], [-122, -10], [-117, -10], [-117, 6.15]], h: [-7, -1.9], from: -7,
        walls: 'boardConcrete', sides: [null, undefined, undefined, null], roof: 0.02, roofColor: 0x6b6a62, ground: true },
      // Nordenflychtsvägen under the decks, falling from Hjalmar Söderbergs väg south (under them,
      // the ground cut away up to the decks, which the elevation model slopes up to)
      { name: 'Nordenflychtsvägen', plan: [[-95.8, -30], [-117, -30], [-117, -10], [-95.8, -10]], h: [-7.2, -5.12], lowBack: -5.44, from: -7.2,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.02, roofColor: 0x55585a, ground: 0.2 },
      { name: 'Nordenflychtsvägen, under the decks', plan: [[-95.8, -10], [-117, -10], [-117, 6.1], [-95.8, 6.1]], h: [-7.2, -5.44], lowBack: -5.7, from: -7.2,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.02, roofColor: 0x55585a, ground: 4 },
      { name: 'Nordenflychtsvägen, under the road', plan: [[-95, 6.1], [-117, 6.1], [-117, 20], [-95, 20]], h: [-7.2, -5.7], lowBack: -5.92, from: -7.2,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.02, roofColor: 0x55585a, ground: 4 },
      { name: 'Nordenflychtsvägen, under the road, south', plan: [[-95, 20], [-117, 20], [-117, 30.5], [-95, 30.5]], h: [-7.2, -5.92], lowBack: -6.38, from: -7.2,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.02, roofColor: 0x55585a, ground: 4 },
      { name: 'Nordenflychtsvägen, south', plan: [[-95.4, 30.5], [-117, 30.5], [-117, 36], [-95.4, 36]], h: [-7.2, -6.38], lowBack: -6.62, from: -7.2,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.02, roofColor: 0x55585a, ground: true },
      // the underpass's wing walls at its south mouth, holding the banks back (inferred: the laser
      // scan has the banks rising from the road's edges there)
      { name: "underpass's wing wall, west", plan: [[-117.4, 30.5], [-117, 30.5], [-117, 35], [-117.4, 35]], h: [-7, -0.19], lowBack: -6.0, from: -7,
        walls: 'boardConcrete', sides: [null, undefined, undefined, undefined], roof: 0.05, roofColor: 0x9a9892, ground: true },
      { name: "underpass's wing wall, east", plan: [[-95.4, 30.5], [-95, 30.5], [-95, 35], [-95.4, 35]], h: [-7, -0.7], lowBack: -6.2, from: -7,
        walls: 'boardConcrete', sides: [null, undefined, undefined, undefined], roof: 0.05, roofColor: 0x9a9892, ground: true },
      // the paving in front of the doors, and Hjalmar Söderbergs väg past it along the bank's foot
      { name: 'in front of the doors', plan: [[-95.8, -13.4], [-81.7, -13.4], [-81.7, -17.5], [-95.8, -17.5]], h: [-7, -5.27], from: -7,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.02, roofColor: 0x8d8a84, ground: 0.15 },
      { name: 'Hjalmar Söderbergs väg, -95.8 to -81.7', plan: [[-95.8, -17.5], [-95.8, -25.6], [-81.7, -24.8], [-81.7, -17.5]], h: [-7, -5.17], lowBack: -4.97, from: -7,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.02, roofColor: 0x55585a, ground: 0.15 },
      { name: 'Hjalmar Söderbergs väg, -81.7 to -60', plan: [[-81.7, -14.2], [-81.7, -24.8], [-60, -23.5], [-60, -14.2]], h: [-7, -4.97], lowBack: -4.57, from: -7,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.02, roofColor: 0x55585a, ground: 0.15 },
      { name: 'Hjalmar Söderbergs väg, -60 to -30', plan: [[-60, -14.2], [-60, -23.5], [-30, -20.5], [-30, -14.2]], h: [-7, -4.57], lowBack: -4.02, from: -7,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.02, roofColor: 0x55585a, ground: 0.15 },
      { name: 'Hjalmar Söderbergs väg, -30 to -8', plan: [[-30, -14.2], [-30, -20.5], [-8, -18.8], [-8, -14.2]], h: [-7, -4.02], lowBack: -3.47, from: -7,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.02, roofColor: 0x55585a, ground: 0.15 },
      // the bank's foot along it, held by a wall of granite
      { name: "bank's wall", plan: [[-81.7, -14.2], [-60, -14.2], [-60, -13.8], [-81.7, -13.8]], h: [-7, -3.75], lowBack: -3.35, from: -7,
        walls: 'granite', roof: 0.05, roofColor: 0x8c8a85 },
      { name: "bank's wall, east", plan: [[-60, -14.2], [-20, -14.2], [-20, -13.8], [-60, -13.8]], h: [-7, -3.35], lowBack: -2.65, from: -7,
        walls: 'granite', roof: 0.05, roofColor: 0x8c8a85 },
      { name: "Drottningholmsvägen, -140 to -117", plan: [[-140, 6.15], [-140, 30.5], [-117, 30.5], [-117, 6.15]], h: [-7, 0.18], lowBack: -0.19, from: -7,
        walls: 'boardConcrete', sides: [null, 'boardConcrete', 'boardConcrete', 'boardConcrete'], roof: 0.02, roofColor: 0x55585a, ground: 0.3 },
      { name: "Drottningholmsvägen over the underpass", plan: [[-117, 6.15], [-117, 30.5], [-95, 30.5], [-95, 6.15]], h: [-1.6, -0.19], lowBack: -0.7, from: -1.6,
        walls: 'boardConcrete', sides: [null, 'boardConcrete', null, 'boardConcrete'], roof: 0.02, roofColor: 0x55585a, floor: 'boardConcrete' },
      { name: "Drottningholmsvägen, -95 to -80", plan: [[-95, 6.15], [-95, 30.5], [-80, 30.5], [-80, 6.15]], h: [-7, -0.7], lowBack: -1.02, from: -7,
        walls: 'boardConcrete', sides: ['boardConcrete', 'boardConcrete', null, 'boardConcrete'], roof: 0.02, roofColor: 0x55585a, ground: 0.3 },
      { name: "Drottningholmsvägen, -80 to -60", plan: [[-80, 6.15], [-80, 30.5], [-60, 30.5], [-60, 6.4]], h: [-3.7, -1.02], lowBack: -1.22, from: -3.7,
        walls: 'boardConcrete', sides: [null, 'boardConcrete', null, 'boardConcrete'], roof: 0.02, roofColor: 0x55585a, ground: 0.3 },
      { name: "Drottningholmsvägen, -60 to -40", plan: [[-60, 6.4], [-60, 30.5], [-40, 30.5], [-40, 7.15]], h: [-4, -1.22], lowBack: -1.52, from: -4,
        walls: 'boardConcrete', sides: [null, 'boardConcrete', null, 'boardConcrete'], roof: 0.02, roofColor: 0x55585a, ground: 0.3 },
      { name: "Drottningholmsvägen, -40 to -20", plan: [[-40, 7.15], [-40, 30.5], [-20, 30.5], [-20, 7.15]], h: [-4.25, -1.52], lowBack: -1.77, from: -4.25,
        walls: 'boardConcrete', sides: [null, 'boardConcrete', null, 'boardConcrete'], roof: 0.02, roofColor: 0x55585a, ground: 0.3 },
      { name: "Drottningholmsvägen, -20 to 0", plan: [[-20, 7.15], [-20, 30.5], [0, 30.5], [0, 8.5]], h: [-4.5, -1.77], lowBack: -2.02, from: -4.5,
        walls: 'boardConcrete', sides: [null, 'boardConcrete', null, 'boardConcrete'], roof: 0.02, roofColor: 0x55585a, ground: 0.3 },
      { name: "Drottningholmsvägen, 0 to 20", plan: [[0, 8.5], [0, 30.5], [20, 30.5], [20, 8.5]], h: [-4.8, -2.02], lowBack: -2.32, from: -4.8,
        walls: 'boardConcrete', sides: [null, 'boardConcrete', null, 'boardConcrete'], roof: 0.02, roofColor: 0x55585a, ground: 0.3 },
      { name: "Drottningholmsvägen, 20 to 40", plan: [[20, 8.5], [20, 30.5], [40, 30.5], [40, 8.5]], h: [-5.1, -2.32], lowBack: -2.62, from: -5.1,
        walls: 'boardConcrete', sides: [null, 'boardConcrete', null, 'boardConcrete'], roof: 0.02, roofColor: 0x55585a, ground: 0.3 },
      { name: "Drottningholmsvägen, 40 to 60", plan: [[40, 8.5], [40, 30.5], [60, 30.5], [60, 8.95]], h: [-5.35, -2.62], lowBack: -2.87, from: -5.35,
        walls: 'boardConcrete', sides: [null, 'boardConcrete', null, 'boardConcrete'], roof: 0.02, roofColor: 0x55585a, ground: 0.3 },
      { name: "Drottningholmsvägen, 60 to 80", plan: [[60, 8.95], [60, 30.5], [80, 30.5], [80, 9.54]], h: [-5.65, -2.87], lowBack: -3.17, from: -5.65,
        walls: 'boardConcrete', sides: [null, 'boardConcrete', null, 'boardConcrete'], roof: 0.02, roofColor: 0x55585a, ground: 0.3 },
      { name: "Drottningholmsvägen, 80 to 95", plan: [[80, 9.54], [80, 30.5], [95, 30.5], [95, 9.9]], h: [-5.88, -3.17], lowBack: -3.4, from: -5.88,
        walls: 'boardConcrete', sides: [null, 'boardConcrete', null, 'boardConcrete'], roof: 0.02, roofColor: 0x55585a, ground: 0.3 },
      // the road's barrier along the tracks, the fence on it
      { name: "road's barrier, -95 to -66", plan: [[-95, 5.85], [-66, 5.85], [-66, 6.15], [-95, 6.15]], h: [-6, -1.1], from: -6,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x9a9892 },
      { name: "road's barrier, -66 to -54", plan: [[-66, 5.85], [-54, 6.35], [-54, 6.65], [-66, 6.15]], h: [-6, -1.1], from: -6,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x9a9892 },
      { name: "road's barrier, -54 to -42", plan: [[-54, 6.35], [-42, 6.85], [-42, 7.15], [-54, 6.65]], h: [-6, -1.1], from: -6,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x9a9892 },
      { name: "road's barrier, -42 to -6", plan: [[-42, 6.85], [-6, 6.85], [-6, 7.15], [-42, 7.15]], h: [-6, -1.1], from: -6,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x9a9892 },
      { name: "road's barrier, -6 to 6", plan: [[-6, 6.85], [6, 7.35], [6, 7.65], [-6, 7.15]], h: [-6, -1.1], from: -6,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x9a9892 },
      { name: "road's barrier, 6 to 30", plan: [[6, 7.35], [30, 7.35], [30, 7.65], [6, 7.65]], h: [-6, -1.1], from: -6,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x9a9892 },
      { name: "road's barrier, 30 to 48", plan: [[30, 7.35], [48, 8.25], [48, 8.55], [30, 7.65]], h: [-6, -1.1], from: -6,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x9a9892 },
      { name: "road's barrier, 48 to 66", plan: [[48, 8.25], [66, 8.85], [66, 9.15], [48, 8.55]], h: [-6, -1.1], from: -6,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x9a9892 },
      { name: "road's barrier, 66 to 84", plan: [[66, 8.85], [84, 9.35], [84, 9.65], [66, 9.15]], h: [-6, -1.1], from: -6,
        walls: 'boardConcrete', roof: 0.02, roofColor: 0x9a9892 },
    ],
    // chain-link beyond the tracks: on the road's barrier on the south, on the bank's edge on the
    // north; and the railing along the northern deck's edge over the street
    fences: [
      { points: [[-95, 6.0], [-66, 6.0], [-54, 6.5], [-42, 7.0], [-6, 7.0], [6, 7.5], [30, 7.5], [48, 8.4], [66, 9.0], [84, 9.5]], h: [-1.1, 1.3] },
      { points: [[-82, -8.82], [-55, -8.44], [-26, -7.69], [4, -6.91], [34, -6.15], [64, -5.37], [84, -4.9]], h: [-1.9, 0.5] },
      { points: [[-121, -9.45], [-95.4, -9.45]], h: [-1.1, 0.1] },
    ],
    art: [
      // the bands of red pavers under the roof, and the patch round the sculpture
      // (the northern half of the island stands up to 4 cm higher than the southern)
      { kind: 'checks', solid: true, color: 0x86504a, at: [[-35, -1.35]], rows: 122, cols: 1, tile: 0.6, size: [0.6, 0.32], h: 0.045 },
      { kind: 'checks', solid: true, color: 0x86504a, at: [[-35, 1.35]], rows: 122, cols: 1, tile: 0.6, size: [0.6, 0.32] },
      { kind: 'checks', solid: true, color: 0x86504a, at: [[16.5, 0.15]], rows: 7, cols: 6, tile: 0.6, size: [0.6, 0.43] },
      { kind: 'traveller', s: 16.5, u: 0.35, turn: Math.PI },
      { kind: 'masts', height: 5.0, color: 0x9da2a6, top: false, arm: 1.0, lower: 4.15, lowerOne: true, sign: 2.7, at: [[25, 0], [59.8, 0.4]] },
      { kind: 'masts', height: 5.0, color: 0x9da2a6, top: false, arm: 1.0, lower: 4.15, lowerOne: true, at: [[10, 0.2], [41, 0.3]] },
      // the columns under the decks over Nordenflychtsvägen, and the metro's sign on the deck's corner
      // the hall's one round steel column, west of the gates on the street's side
      { kind: 'columns', at: [[-92.5, -9.4]], from: -5.3, to: -2.75, size: 0.32, color: 0x8d9093 },
      { kind: 'columns', at: [[-101.5, -6.4], [-101.5, 2.5]], from: -7, to: -2.55, size: 0.8, color: 0xaaa79f },
      { kind: 'columns', at: [[-101.5, 8.5], [-101.5, 13.5], [-101.5, 18.5], [-101.5, 23.5], [-101.5, 28.5]], from: -7, to: -1.6, size: 0.8, color: 0xaaa79f },
      { kind: 'roundel', s: -96.3, u: -9.8, h: -0.3, size: 1.0, foot: -1.0 },
    ],
    shelters: [{ s: [-39, -34], u: [-1.1, 1.1] }],
    // OpenStreetMap's outline of the station's building, which the blocks draw
    buildings: ['w56259275'],
  },
  // Alvik (26 October 1952): two island platforms on a bank between Tranebergsvägen's hillside and
  // Drottningholmsvägen, the metro along their outer edges and the Nockebybanan's trams (line 12)
  // on the two tracks between them, which end at buffers where the islands join at the east end.
  // The laser scan puts the platforms 0.55 m lower than the track's height leaves the network's,
  // the trams' ballast 0.55 m under its top along the platforms, falling west to 2.1 m under it on
  // their bridge over Alviksvägen, the tram corridor 6.3 m wide at the west end narrowing to 6.5 m
  // at the buffers, and the overhead line's masts down its middle (a gantry across it 100 m west).
  //
  // Each island has a roof of its own (photographs): ribbed sheet steel across on steel I-beams,
  // a dark grey fascia, one row of steel columns with knee braces, tube lamps along the underside,
  // black signs; under them benches, glass shelters and departure boards, and between the tram
  // tracks a chain-link fence (FÖRBJUDET BETRÄDA SPÅREN). The laser scan: the roofs' undersides
  // 3.0 m over the platform, the northern 7.4 to 8.5 m wide, the southern 6.3 to 7.6 m, their
  // east ends narrowing over the junction.
  //
  // At the west end (photographs, the laser scan and Google's mesh) a stair house on each island
  // steps down beside the tracks under glazed roofs falling in waves, its stairs and escalator
  // down to the ticket hall under the bank at Alviks torg; beside each, a glazed walkway along the
  // trams' tracks to a lift. The hall's front faces west under the trams' bridge: glass doors under
  // a black band with the T and the name, board-marked concrete and brick. Henjasaj Koda's
  // Vågornas möte (1999) fills it: straw-yellow tiles, reeds of white tiles rising across those
  // beside the stairs (Vassens viskningar), a pale terrazzo floor with fields of blue-grey and
  // small dark blue triangles (Isens fjäll), a cement mosaic of black and cream striations along
  // the escalators and behind the doors (Orm och irisar, 110 m²), and Gryningskälla, a 28-tonne
  // block of black diabase from Boalt, split open. (Dropp från fjärran, a railing of Corten
  // steel, isn't placed: where it stands isn't clear.)
  //
  // At the east end (the laser scan, OpenStreetMap and Google's mesh) a stair house climbs from the
  // junction under a roof rising to the east, an escalator and stairs up to a footbridge over the
  // northern track: teal tiles and windows in dark frames under arches of glulam, terrazzo with dark
  // blue zigzags. From its north end a passage goes into the hillside, and escalators and a lift
  // climb to the white-rendered pavilion on Tranebergsvägen. A lift from the junction's south side
  // reaches the footbridge too. The way down to Tvärbanan's platforms and the 1952 hall aren't
  // drawn.
  'Alvik': {
    // the northern island's roof
    roof: {
      kind: 'butterfly',
      from: -72.5, to: 64.5, width: 8,
      shape: [[-72.5, -8.4, 7.4], [-40, -7.7, 8.0], [-10, -6.7, 8.5], [20, -5.2, 8.0], [46, -3.9, 7.0], [56, -3.15, 5.6], [64.5, -2.3, 4.8]],
      middle: 2.95, edge: 3.25, thick: 0.22, fascia: 0.3,
      rafters: 4.5, rafterAt: -67, rafterSize: [0.14, 0.3], rafterColor: 0x3b3f43,
      deck: 'ribbedAcross',
      beam: 0.35,
      columns: { every: 9, at: -67, size: 0.2, plinth: { size: 0.3, height: 0.05 }, braces: 1.0 },
      lamps: { offset: 1.2, length: 1.5, every: 3, tube: true },
      colors: { underside: 0x5d6164, fascia: 0x3e4245, top: 0x9ea3a6, steel: 0x3b3f43 },
      signs: { at: [-53.5, -17.5, 18.5], back: 'Alviks torg', ahead: 'Tranebergsvägen' },
      clocks: [[-8.5, -1.6]],
      // (trains keep left: those for the city on the northern track)
      boards: [
        { s: -35.5, u: -2.4, toward: 'T-Centralen', trains: ['17 Skarpnäck  2 min', '19 Hagsätra  6 min'] },
        { s: -35.5, u: 2.4, toward: 'Nockeby', trains: ['12 Nockeby  3 min', '12 Nockeby  13 min'] },
      ],
    },
    // the southern island's
    roofs: [{
      kind: 'butterfly',
      from: -72.5, to: 66, width: 7,
      shape: [[-72.5, 6.3, 7.0], [-30, 6.37, 7.5], [0, 6.69, 7.6], [30, 7.34, 7.0], [50, 7.95, 6.6], [55, 8.95, 4.1], [66, 9.05, 3.6]],
      middle: 2.95, edge: 3.25, thick: 0.22, fascia: 0.3,
      rafters: 4.5, rafterAt: -67, rafterSize: [0.14, 0.3], rafterColor: 0x3b3f43,
      deck: 'ribbedAcross',
      beam: 0.35,
      columns: { every: 9, at: -67, size: 0.2, plinth: { size: 0.3, height: 0.05 }, braces: 1.0 },
      lamps: { offset: 1.2, length: 1.5, every: 3, tube: true },
      colors: { underside: 0x5d6164, fascia: 0x3e4245, top: 0x9ea3a6, steel: 0x3b3f43 },
      signs: { at: [-44.5, -26.5, 36.5], back: 'Alviks torg', ahead: 'Tranebergsvägen' },
      clocks: [[-8.5, 1.6]],
      boards: [
        { s: -35.5, u: 2.4, toward: 'Hässelby strand', trains: ['17 Åkeshov  4 min', '19 Hässelby strand  8 min'] },
        { s: -35.5, u: -2.4, toward: 'Nockeby', trains: ['12 Nockeby  3 min', '12 Nockeby  13 min'] },
      ],
    }],
    paving: {
      edge: 0.35, tactile: [0.35, 0.7], slabs: 0.7, slabSize: [0.45, 0.45], paverSize: [0.45, 0.45], mix: 0.25,
      colors: { edge: 0xc6c4be, tactile: 0x54575a, slab: 0x8c8c89, pavers: 0x8c8c89, paler: 0x9a9a97, face: 0x8e8b85 },
      pattern: 'grid',
    },
    rooms: [
      // the east end: the stair house's escalator and stairs, open under its roof; the pavilion up on
      // Tranebergsvägen; the footbridge; the passage into the hillside and its escalators
      { name: 'east stairs', s: [54.8, 61], u: [-1.5, 6], h: [-0.5, 4.6], walls: 'tealTiles', stairs: 'tealTiles', floor: 'terrazzo', parapet: 1.1 },
      { name: 'upper hall', s: [60, 95], u: [-40, -18], h: [7.5, 8.6], walls: null, floor: 'terrazzo', ceiling: 'whitePanels' },
      { name: 'footbridge', s: [61, 75], u: [-14.4, 8], h: [3.6, 4.6], walls: null, floor: 'terrazzo' },
      { name: 'passage', s: [60, 80], u: [-30, -14.4], h: [3.6, 4.6], walls: 'squareTiles', stairs: 'squareTiles', floor: 'terrazzo', ceiling: 'whitePanels' },
      // the west end: the ticket hall under the bank, the walkways to the lifts, the flights down
      { name: 'west hall', s: [-112, -89.3], h: [-7.2, -6.2], walls: 'strawTiles', floor: 'iceTerrazzo', ceiling: 'whitePanels' },
      { name: 'west walkways', s: [-98, -72.5], u: [-13, 8], h: [-0.5, 0.5], walls: null, floor: 'greyTiles' },
      { name: 'west flights', s: [-93, -72], h: [-7.2, 0.5], walls: 'reedTiles', stairs: 'reedTiles', floor: 'greyTiles', parapet: 1.1 },
      { name: 'platform', s: [-80, 80], h: [-0.6, 0.6], walls: null, floor: null },
    ],
    blocks: [
      // the trams' tracks between the islands, on ballast 0.55 m under the platform's top, its edges
      // the islands' (and the platform cut away over them, a little higher than its top, which
      // rises a little to the east with the track)
      { name: 'tram tracks, west', plan: [[-72.7, 0.8], [-10, 3.2], [-10, -4.12], [-72.7, -5.48]], h: [-0.55, 0], from: -0.55,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], floor: 'ballast' },
      { name: 'tram tracks, east', plan: [[-10, 3.2], [47.4, 4.5], [47.4, -2.0], [-10, -4.12]], h: [-0.55, 0], from: -0.55,
        walls: 'boardConcrete', sides: [undefined, undefined, undefined, null], floor: 'ballast' },
      { name: "tram tracks' cut, west", plan: [[-72.7, 0.8], [-10, 3.2], [-10, -4.12], [-72.7, -5.48]], h: [-0.55, 0.4], from: -0.55,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      { name: "tram tracks' cut, east", plan: [[-10, 3.2], [47.4, 4.5], [47.4, -2.0], [-10, -4.12]], h: [-0.55, 0.4], from: -0.55,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      // west of the platforms, falling to the trams' bridge between the stair houses' walkways
      { name: 'tram tracks, -72.7 to -80', plan: [[-72.7, -6.3], [-72.7, 0.8], [-80, 0.85], [-80, -6.3]], h: [-7, -0.54], from: -0.55, fall: -1.0,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'ballast' },
      { name: 'tram tracks, -80 to -86', plan: [[-80, -6.3], [-80, 0.85], [-86, 0.85], [-86, -6.3]], h: [-7, -0.99], from: -1.0, fall: -1.4,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'ballast' },
      { name: 'tram tracks, -86 to -92', plan: [[-86, -6.3], [-86, 0.85], [-92, 0.85], [-92, -6.3]], h: [-7, -1.39], from: -1.4, fall: -1.48,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'ballast' },
      { name: 'tram tracks, -92 to -97', plan: [[-92, -6.3], [-92, 0.85], [-97, 0.85], [-97, -6.3]], h: [-7, -1.47], from: -1.48, fall: -1.55,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'ballast' },
      { name: 'tram tracks, -97 to -108.5', plan: [[-97, -9.3], [-97, 1.6], [-108.5, 1.6], [-108.5, -9.3]], h: [-7, -1.54], from: -1.55, fall: -1.9,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'ballast' },
      // the trams' bridge over Alviksvägen, its parapets either side, and its underside
      { name: "trams' bridge", plan: [[-108.5, -8.5], [-108.5, 1.6], [-136, 0.8], [-136, -9.3]], h: [-2.9, -0.95], from: -1.9, fall: -2.1,
        walls: 'boardConcrete', sides: [null, undefined, null, undefined], floor: 'ballast' },
      { name: "trams' bridge's underside", plan: [[-108.5, -8.5], [-108.5, 1.6], [-136, 0.8], [-136, -9.3]], h: [-2.9, -2.89], from: -2.9,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'boardConcrete' },
      // the stair houses' roofs, glazed, falling in waves down to the hall with the escalators and
      // stairs under them, on the northern island and the southern
      ...([[-13.0, -8.5, 'north'], [3.0, 7.8, 'south']] as const).flatMap(([un, us, side]) => ([
        [-72.7, -76.5, 5.15, 4.6, 0], [-76.5, -79.5, 4.6, 3.85, 0], [-79.5, -82.5, 3.85, 2.25, 0],
        [-82.5, -85.5, 2.25, 0.6, 0], [-85.5, -88.5, 0.6, -0.45, -1.5], [-88.5, -92, -0.45, -1.6, -2.2],
      ] as const).map(([hi, lo, top, low, from]): Block => ({
        name: `${side}ern stair house, ${hi} to ${lo}`, plan: [[hi, un], [hi, us], [lo, us], [lo, un]], h: [-7, top], lowBack: low, from,
        walls: 'glazed', sides: [null, undefined, null, undefined], ...(from === 0 ? { floor: 'greyTiles' as const } : {}),
        ceiling: 'ribbedMetal', roof: 0.25, roofColor: 0x8e9aa3,
      }))),
      // the glazed walkways along the trams' tracks to the lifts
      { name: 'northern walkway', plan: [[-72.7, -8.45], [-72.7, -6.3], [-97, -6.3], [-97, -8.45]], h: [-2.0, 2.55], from: 0,
        walls: 'glazed', sides: [null, undefined, undefined, undefined], floor: 'greyTiles', ceiling: 'whitePanels', roof: 0.2, roofColor: 0x6f7579 },
      { name: "northern walkway, to the lift", plan: [[-92, -11.2], [-92, -8.45], [-97, -8.45], [-97, -11.2]], h: [-2.0, 2.55], from: 0,
        walls: 'glazed', sides: [undefined, null, undefined, undefined], floor: 'greyTiles', ceiling: 'whitePanels', roof: 0.2, roofColor: 0x6f7579 },
      { name: 'southern walkway', plan: [[-72.7, 0.8], [-72.7, 2.95], [-97, 2.95], [-97, 0.8]], h: [-2.0, 2.55], from: 0,
        walls: 'glazed', sides: [null, undefined, undefined, undefined], floor: 'greyTiles', ceiling: 'whitePanels', roof: 0.2, roofColor: 0x6f7579 },
      { name: "southern walkway, to the lift", plan: [[-92, 2.95], [-92, 5.2], [-97, 5.2], [-97, 2.95]], h: [-2.0, 2.55], from: 0,
        walls: 'glazed', sides: [undefined, undefined, undefined, null], floor: 'greyTiles', ceiling: 'whitePanels', roof: 0.2, roofColor: 0x6f7579 },
      // the hall's front under the trams' bridge: its doors under the black band, board-marked
      // concrete and brick; and the bank's ends either side of it
      { name: "hall's front", plan: [[-104.5, -8.5], [-104.5, 1.6], [-108.5, 1.6], [-108.5, -8.5]], h: [-6.7, -1.95], from: -6.7,
        walls: 'boardConcrete', sides: [null, 'brick', 'blackFront', 'boardConcrete'], band: { walls: 'boardConcrete', from: -3.9 },
        nameSign: { side: 2, at: 0.5, length: 3.4, bottom: -4.35, black: true }, ground: true },
      { name: "bank's end, north", plan: [[-99.5, -13.5], [-99.5, -8.5], [-108.5, -8.5], [-108.5, -13.5]], h: [-6.7, -1.25], from: -6.7,
        walls: 'boardConcrete', roof: 0.05, roofColor: 0x9a9892, ground: true },
      { name: "bank's end, south", plan: [[-99.5, 1.6], [-99.5, 8.0], [-108.5, 8.0], [-108.5, 1.6]], h: [-6.7, -1.25], from: -6.7,
        walls: 'boardConcrete', roof: 0.05, roofColor: 0x9a9892, ground: true },
      // the terrace in front of the doors (its ground data/ground-corrections.json's deck), held up by
      // a wall over Alviksvägen
      { name: "terrace's wall", plan: [[-111.8, -40], [-111.8, 6.5], [-112.1, 6.5], [-112.1, -40]], h: [-11.6, -6.55], from: -11.6,
        walls: 'boardConcrete', roof: 0.05, roofColor: 0x9a9892 },
      // Orm och irisar: the mosaic along the northern escalator's foot, and behind the doors
      { name: 'mosaic by the escalator', plan: [[-92, -13.0], [-92, -12.9], [-100, -12.9], [-100, -13.0]], h: [-6.7, -3.15], from: -6.7, walls: 'rockMosaic' },
      { name: 'mosaic behind the doors', plan: [[-101.2, -7.95], [-101.2, -7.85], [-106.3, -7.85], [-106.3, -7.95]], h: [-6.7, -3.15], from: -6.7, walls: 'rockMosaic' },
      // the east end: a low building at the buffers, the stair house rising east over the
      // escalator and stairs, the footbridge over the northern track and its southern end over the
      // lift, the head house against the hillside, and the pavilion up on Tranebergsvägen
      { name: 'building at the buffers', plan: [[52.3, -1.6], [52.3, 5.9], [47.4, 5.9], [47.4, -1.6]], h: [0, 3.6], walls: 'darkGlazed',
        ceiling: 'whitePanels', roof: 0.25, roofColor: 0x3a3d40, onPlatform: true },
      { name: 'east stair house, 52.3 to 59.5', plan: [[59.5, -0.9], [59.5, 5.2], [52.3, 5.2], [52.3, -0.9]], h: [0, 6.0], lowBack: 4.1,
        walls: 'glazed', sides: [null, undefined, undefined, undefined], ceiling: 'pineBoards', roof: 0.25, roofColor: 0xa9adb0, onPlatform: true },
      { name: 'east stair house, 59.5 to 64', plan: [[64, -0.9], [64, 5.2], [59.5, 5.2], [59.5, -0.9]], h: [0, 8.1], lowBack: 6.0,
        walls: 'glazed', sides: [null, undefined, null, undefined], ceiling: 'pineBoards', roof: 0.25, roofColor: 0xa9adb0, onPlatform: true },
      { name: 'east stair house, 64 to 71', plan: [[71, -0.9], [71, 5.2], [64, 5.2], [64, -0.9]], h: [0, 9.3], lowBack: 8.1,
        walls: 'glazed', sides: [undefined, undefined, null, undefined], ceiling: 'pineBoards', roof: 0.25, roofColor: 0xa9adb0, onPlatform: true },
      { name: 'footbridge', plan: [[65.5, -0.9], [70.4, -0.9], [70.4, -13.7], [65.7, -15.0]], h: [3.4, 7.2], from: 4.1,
        walls: 'tealWindows', sides: [null, undefined, null, undefined], floor: 'terrazzo', ceiling: 'pineBoards', roof: 0.3, roofColor: 0xa9adb0 },
      { name: "footbridge's south end", plan: [[72.5, 5.2], [72.5, 7.3], [65.4, 7.3], [65.4, 5.2]], h: [3.5, 7.2], from: 4.1,
        walls: 'tealWindows', sides: [undefined, undefined, undefined, null], floor: 'terrazzo', ceiling: 'pineBoards', roof: 0.3, roofColor: 0xa9adb0 },
      { name: 'head house', plan: [[64, -11], [71, -11], [71, -15.5], [64, -15.5]], h: [4.1, 10.3], from: 4.1,
        walls: 'whiteRender', sides: [null, undefined, undefined, undefined], floor: 'terrazzo', ceiling: 'whitePanels', roof: 0.3, roofColor: 0x6d7174, ground: true },
      { name: 'upper hall', plan: [[66.1, -25.1], [69.4, -36.9], [82.9, -33.1], [86, -19.6]], h: [8.0, 11.5], from: 8.0,
        walls: 'whiteRender', sides: [undefined, undefined, null, undefined], floor: 'terrazzo', ceiling: 'whitePanels', roof: 0.3, roofColor: 0x4a4d50, ground: true },
      { name: 'upper hall, its doors', plan: [[82.9, -33.1], [89.2, -31.4], [87.7, -25.9], [86, -19.6]], h: [8.0, 11.5], from: 8.0,
        walls: 'whiteRender', sides: [undefined, 'blackFront', undefined, null], floor: 'terrazzo', ceiling: 'whitePanels', roof: 0.3, roofColor: 0x4a4d50, ground: true },
    ],
    // chain-link down the middle between the trams' tracks
    fences: [
      { points: [[-72.7, -2.33], [-10, -0.46], [46.5, 1.25]], h: [-0.55, 0.65] },
      { points: [[-111.95, -40], [-111.95, 6.5]], h: [-6.55, -5.45], kind: 'bars' },
    ],
    art: [
      // the Nockebybanan's tracks, from their bridge to the buffers; the overhead line over them
      { kind: 'tramTrack', buffer: true, points: [[-136, -5.1, -2.0], [-110, -5.05, -1.8], [-104, -5.0, -1.6], [-94, -4.85, -1.4], [-86, -4.6, -1.3], [-80, -4.3, -0.9], [-73.5, -4.05, -0.45], [-10, -2.67, -0.45], [46.5, -0.6, -0.45]] },
      { kind: 'tramTrack', buffer: true, points: [[-136, -1.6, -2.0], [-110, -1.5, -1.8], [-104, -1.45, -1.6], [-94, -1.3, -1.4], [-86, -1.1, -1.3], [-80, -0.9, -0.9], [-73.5, -0.65, -0.45], [-60, -0.25, -0.45], [-10, 1.75, -0.45], [46.5, 3.05, -0.45]] },
      {
        kind: 'catenary', height: 6.4,
        masts: [[-125, -3.35, -2.05], [-100, -3.2, -1.62], [-60, -2.0, -0.55], [-25, -0.85, -0.55], [10, 0.02, -0.55], [40, 1.0, -0.55]],
        wires: [
          [[-136, -5.1, 3.47], [-110, -5.05, 3.67], [-104, -5.0, 3.85], [-94, -4.85, 4.07], [-86, -4.6, 4.15], [-80, -4.3, 4.57], [-73.5, -4.05, 5.0], [-10, -2.67, 5.0], [46, -0.62, 5.0]],
          [[-136, -1.6, 3.47], [-110, -1.5, 3.67], [-104, -1.45, 3.85], [-94, -1.3, 4.07], [-86, -1.1, 4.15], [-80, -0.9, 4.57], [-73.5, -0.65, 5.0], [-60, -0.25, 5.0], [-10, 1.75, 5.0], [46, 3.03, 5.0]],
        ],
      },
      // the islands' paving along the trams' tracks
      // (the platform's top rising a little to the east with the track)
      { kind: 'edgePaving', points: [[-72.7, -5.48], [0, -3.9, 0.01], [47.4, -2.0, 0.05]], width: 1.5, left: true },
      { kind: 'edgePaving', points: [[-72.7, 0.8], [-10, 3.2], [47.4, 4.5, 0.05]], width: 1.5 },
      // Gryningskälla in the hall, against its southern wall beside the southern escalator's foot;
      // a round column under the trams' bridge
      // (the block, and the slab split off its face leaning against it)
      { kind: 'stone', s: -94.6, u: 7.05, size: [2.6, 1.1, 2.8], turn: 0.12, lean: 0, granite: true, color: 0xb4b2ae, y: -6.7 },
      { kind: 'stone', s: -94.2, u: 6.2, size: [1.7, 0.45, 2.3], turn: 0.05, lean: 0.12, granite: true, color: 0xa6a4a0, y: -6.7 },
      { kind: 'columns', at: [[-109.2, -8.9]], from: -6.7, to: -2.9, size: 0.6, color: 0x9a9892 },
    ],
    benches: [{ at: [-62.5, -44.5, -35.5, 0.5, 18.5] }, { at: [-53.5, -17.5, 9.5, 27.5], roof: 0 }],
    shelters: [{ s: [-29.5, -24.5], u: [-1.1, 1.1] }, { s: [-2.5, 2.5], u: [-1.1, 1.1], under: 0 }],
    // OpenStreetMap's outlines of the station's buildings, which the blocks draw
    buildings: ['w281163269', 'w501084446', 'w1518244456', 'w1518244457', 'w1556715102', 'w1495496029', 'w1495496030', 'w1495496913', 'w1495496914'],
  },
  // Stora mossen (26 October 1952; Marianna Zaborska's coloured clinker on the walls and orange
  // line of enamelled sheet, 2002): an island platform on the bank beside Drottningholmsvägen, its
  // way out at its east end, where a passage runs under the bank between Drottningholmsvägen and
  // Stora Mossens backe. The laser scan puts a roof from 32.5 m east of the platform's middle to
  // 79.5 m, about 7.4 m wide and following the platform's curve, its top 3.1 m over the platform
  // down the middle and 3.3 m at the edges, and lamp posts 5 m high down the open western part,
  // about 18.5 m apart. Photographs (2017) show the roof's underside of dark stained boards on
  // dark rafters, a row of dark navy columns under a beam down the middle with an orange-red
  // stripe along it, tube lamps across the platform, a thin dark grey fascia, navy signs, round
  // clocks and departure boards (Skarpnäck and Hagsätra over the northern track, Hässelby strand
  // over the southern); out in the open, galvanised lamp posts with two flat lamps on a T-shaped
  // arm, some carrying navy name signs, and a glass shelter (laser scan: 10 to 14.6 m east). The
  // paving: pale, nearly white edge slabs 0.8 m wide, a dark grey ribbed strip, then grey concrete
  // pavers. Chain-link fences beyond both tracks, along the top of the bank.
  //
  // At the east end the platform runs into the station's hall between the tracks (laser scan: from
  // 79.5 m to 97 m, a flat roof 2.8 m over the platform, 4.8 m wide, narrowing as the southern
  // track bends in): first the ticket hall, with the gates (OpenStreetMap's indoor mapping: 84.2 m
  // east) and a glazed booth on its north side, a terrazzo floor, a slatted ceiling, and along its
  // south wall green clinker tiles under glass cases and a band of windows; grey panels under the
  // windows outside. Then the stair hall, glazed from floor to roof, its stairs going down to the
  // east along its south side (OpenStreetMap: from 86.3 m to 93 m east) beside teal tiles, and a
  // walkway along its north side to the lift (OpenStreetMap: 98.8 m east; laser scan: a tower 3.8 m
  // high, from 97 m to 100 m, a metre over the hall, and the round T on its post at its east end,
  // 6.7 m up). A photograph (2017) shows the tower's grey glass in pale frames, a tall pane under a
  // short one, two to a bay between dark blue-grey steel piers. Both reach the passage under the
  // tracks, 4.2 m under the platform, whose ends are faced with teal tiles under the bank's concrete
  // edge, the station's name on a blue band over each; the passage is open to the street at both
  // ends, so it is out in the daylight.
  'Stora mossen': {
    roof: {
      kind: 'butterfly',
      from: 32.5, to: 79.5, width: 7.4,
      shape: [[32.5, -0.45, 7.2], [46, -0.75, 7.6], [58, -1.2, 7.2], [66, -1.4, 7.4], [79.5, -1.8, 7.3]],
      middle: 2.92, edge: 3.12, thick: 0.2, fascia: 0.25,
      rafters: 1.2, rafterSize: [0.08, 0.22],
      beam: 0.3, gutter: [0.3, 0.1], gutterColor: 0xc24a2e,
      columns: { every: 8, at: 76, size: 0.22, plinth: { size: 0.35, height: 0.08 } },
      lamps: { offset: 1.9, length: 1.2, every: 3.0, across: true },
      colors: { underside: 0x40302a, fascia: 0x3a3d40, top: 0x45484b, steel: 0x262b38 },
      signs: { at: [42, 58, 72], back: '', ahead: 'Utgång', blue: true },
      clocks: [[62, 0.85]],
      boards: [
        { s: 50, u: -1.5, toward: 'Skarpnäck', trains: ['17 Skarpnäck  3 min', '19 Hagsätra  8 min'] },
        { s: 50, u: 1.5, toward: 'Hässelby strand', trains: ['19 Hässelby strand  4 min', '17 Åkeshov  9 min'] },
      ],
    },
    paving: {
      edge: 0.8, tactile: [0.8, 1.15], slabs: 1.15, paverSize: [0.4, 0.2], mix: 0.1,
      colors: { edge: 0xd9d8d3, tactile: 0x5a5d60, slab: 0xa9aaa8, pavers: 0x8f9192, paler: 0x9c9e9f, face: 0x8e8b85 },
      pattern: 'bond',
    },
    rooms: [
      { name: 'ticket hall', s: [79.4, 86.0], h: [-0.5, 1], walls: 'clinkerWindows', floor: 'terrazzo', ceiling: 'slats', sill: 2.4 },
      { name: 'stair hall', s: [86.0, 97.5], h: [-0.5, 1], walls: 'whitePanels', floor: 'terrazzo', ceiling: 'slats', stairs: 'portalTiles', sill: 0 },
      { name: 'stairs', s: [86.0, 94.5], u: [-2.3, -0.1], h: [-5, -0.5], walls: 'portalTiles', floor: 'terrazzo', stairs: 'portalTiles', sill: 0 },
      { name: 'north of the passage', s: [90, 101], u: [-30, -9.2], h: [-5, -3], walls: null, floor: 'asphalt' },
      { name: 'south of the passage', s: [90, 101], u: [4.4, 30], h: [-5, -3], walls: null, floor: 'asphalt' },
      { name: 'passage', s: [90, 101], h: [-5, -3], walls: 'portalTiles', floor: 'asphalt', ceiling: 'boardConcrete' },
    ],
    // (between the tracks, kept clear of them; the passage's ends a notch in the bank either side)
    blocks: [
      { name: 'ticket hall', plan: [[79.4, -4.35], [86.0, -4.45], [86.0, 0.35], [79.4, 0.5]], h: [-1.25, 2.55], walls: 'greyClerestory',
        sides: [undefined, null, undefined, 'glazed'], eaves: [0.15, 0, 0.15, 0.2], floor: 'terrazzo', ceiling: 'slats', roof: 0.25, onPlatform: true },
      { name: 'stair hall', plan: [[86.0, -4.45], [97.0, -4.45], [97.0, -0.2], [86.0, 0.35]], h: [-1.25, 2.55], walls: 'glazed',
        sides: [undefined, undefined, undefined, null], eaves: [0.15, 0.1, 0.15, 0], floor: 'terrazzo', ceiling: 'slats', roof: 0.25, onPlatform: true },
      { name: "lift's tower", plan: [[97.0, -4.35], [100.0, -4.35], [100.0, -1.3], [97.0, -1.3]], h: [-1.25, 3.55], walls: 'liftPanes',
        sides: [undefined, undefined, undefined, null], roof: 0.25, roofColor: 0x3e4552 },
      { name: 'north end of the passage', plan: [[101, -9.2], [101, -14.5], [90, -14.5], [90, -9.2]], h: [-4.2, -1.3], from: -4.2, low: -4.1,
        walls: 'portalTiles', band: { walls: 'boardConcrete', from: -1.95 }, sides: [null, null, null], floor: 'asphalt',
        nameSign: { side: 3, at: 0.5, length: 4.4, bottom: -1.95, inside: true }, onPlatform: true, ground: true },
      { name: 'south end of the passage', plan: [[101, 4.4], [101, 8.5], [90, 8.5], [90, 4.4]], h: [-4.2, -1.3], from: -4.2, low: -3.8,
        walls: 'portalTiles', band: { walls: 'boardConcrete', from: -1.95 }, sides: [null, null, null], floor: 'asphalt',
        nameSign: { side: 3, at: 0.5, length: 4.4, bottom: -1.95, inside: true }, onPlatform: true, ground: true },
      // (their wing walls, tiled on the inside, falling with the bank)
      { name: "north end's east wing wall", plan: [[101.35, -9.2], [101.35, -14.5], [101, -14.5], [101, -9.2]], h: [-4.2, -1.3], from: -4.2, low: -4.1,
        walls: 'boardConcrete', band: { walls: 'boardConcrete', from: -1.95 }, sides: [undefined, undefined, 'portalTiles', null], roof: 0.05, roofColor: 0x9a9892, ground: true },
      { name: "north end's west wing wall", plan: [[90, -9.2], [90, -14.5], [89.65, -14.5], [89.65, -9.2]], h: [-4.2, -1.3], from: -4.2, low: -4.1,
        walls: 'boardConcrete', band: { walls: 'boardConcrete', from: -1.95 }, sides: ['portalTiles', undefined, undefined, null], roof: 0.05, roofColor: 0x9a9892, ground: true },
      { name: "south end's east wing wall", plan: [[101.35, 4.4], [101.35, 8.5], [101, 8.5], [101, 4.4]], h: [-4.2, -1.3], from: -4.2, low: -3.8,
        walls: 'boardConcrete', band: { walls: 'boardConcrete', from: -1.95 }, sides: [undefined, undefined, 'portalTiles', null], roof: 0.05, roofColor: 0x9a9892, ground: true },
      { name: "south end's west wing wall", plan: [[90, 4.4], [90, 8.5], [89.65, 8.5], [89.65, 4.4]], h: [-4.2, -1.3], from: -4.2, low: -3.8,
        walls: 'boardConcrete', band: { walls: 'boardConcrete', from: -1.95 }, sides: ['portalTiles', undefined, undefined, null], roof: 0.05, roofColor: 0x9a9892, ground: true },
      // (under the bank, where neither the street nor the ground runs on)
      { name: 'bank over the passage', plan: [[93.9, -9.2], [97.3, -9.2], [97.3, 4.4], [93.9, 4.4]], h: [-4.2, -1.95], from: -4.2, walls: 'boardConcrete', sides: [null, null, null, null],
        onPlatform: true, ground: true },
      { name: 'street under the bank', plan: [[90, -9.2], [101, -9.2], [101, 4.4], [90, 4.4]], h: [-4.4, -2.0], from: -4.4, walls: 'boardConcrete', sides: [null, null, null, null] },
    ],
    art: [
      { kind: 'masts', height: 5.0, color: 0x9a9fa3, top: false, arm: 0.7, at: [[-51.2, 0.2], [-15.7, 0.3], [21.4, 0.3]] },
      { kind: 'masts', height: 5.0, color: 0x9a9fa3, top: false, arm: 0.7, sign: 2.6, blue: true, at: [[-69.1, 0], [-32.1, 0.4], [2.9, 0.1]] },
      // on the lift's tower
      { kind: 'roundel', s: 99.3, u: -2.8, h: 6.25, size: 0.9, foot: 3.8 },
    ],
    shelters: [{ s: [10, 14.6], u: [-1.1, 1.1] }],
    fences: [
      { points: [[-90, -6.0], [-60, -6.7], [-20, -7.6], [20, -8.1], [60, -8.6], [90, -9.2], [110, -9.7]], h: [-1.25, 0.55] },
      { points: [[-90, 6.0], [-60, 6.6], [-40, 7.1], [0, 7.8], [40, 7.3], [60, 6.5], [90, 4.6], [110, 3.2]], h: [-1.25, 0.55] },
    ],
  },

  // Abrahamsberg (26 October 1952; Peter Celsing's station, pulled down and rebuilt in 1998–99 to
  // be reached by lift, reopened on 25 November 1999): an island platform in a cutting, the rock
  // on its south side, its tracks crossing Abrahamsbergsvägen on a bridge just west of it. The
  // laser scan puts its butterfly roof from 74.5 m west of the platform's middle to 37 m east,
  // about 7.5 m wide and narrowing to 6.2 m at its east end where the northern track closes in,
  // its valley half a metre north of the platform's middle, its top 2.95 m over the platform
  // along the valley and 3.3 m at the edges; east of it the platform is open. Photographs (2015
  // to 2019) show the underside of pale grey sheet metal ribbed across the platform, on dark grey
  // steel rafters, a thin dark fascia, and pairs of dark grey H-section columns across the
  // platform's middle, about 1.3 m apart, a downpipe from the valley between them; strip lights
  // along its edges, SL's navy name signs with the way out to the west, departure boards, wooden
  // benches; on the open part, pale grey lamp posts with two dome lamps on a T-shaped arm (the
  // laser scan: 42 m and 57 m east, 4 m high). The paving: pale edge slabs, a dark ribbed strip,
  // then grey pavers in courses across the platform.
  //
  // West of the platform's end, between the tracks, stands a glazed hall (the laser scan: from
  // 73.8 m to 88 m west): along its north side a walkway, its roof 2.4 m over the platform, leads
  // to the lift (OpenStreetMap's indoor mapping: 92.5 m west), whose glass tower stands 3.75 m
  // high with the round T on a post beside it; along its south side the stairs go straight down
  // westwards (OpenStreetMap: from 75.8 m to 86.6 m west) in two flights, its roof falling over
  // them from 2.3 m to 1.5 m. Its walls are glass in dark grey frames over a dark grey panel, its
  // ceiling white slats, its floor red. At the stairs' foot a passage runs west, and then south
  // under the southern track, to the ticket hall in the street south of the tracks (the laser
  // scan: 4.55 m under the platform). The ticket hall is glazed in dark frames under a roof
  // falling to the west, its rafters out under the eaves, with the name on a navy band over its
  // doors onto the square by Abrahamsbergsvägen; inside, a red granite floor, a ceiling of ribbed
  // sheet metal and, in the passages, on the stairs and in the hall, Rigmor Roxner's clinker
  // (1999): tiles in some twenty colours set with "controlled randomness". Beside it to the east
  // stands a taller block, rendered a pale grey green over dark green tiles, with the kiosk at its
  // front and a dark grey box on its roof.
  //
  // Not drawn: Roxner's 12 m relief of slanting glazed stoneware tiles in the ticket hall (no
  // photograph of it was found), the ticket booth by the passage's mouth, the panels between the
  // columns and the red line along the top of the block's green tiles.
  'Abrahamsberg': {
    roof: {
      kind: 'butterfly',
      from: -74.5, to: 37, width: 7.5,
      shape: [[-74.5, -0.5, 7.4], [-40, -0.35, 7.6], [0, -0.2, 7.4], [20, 0.1, 6.8], [37, 0.35, 6.2]],
      middle: 2.8, edge: 3.12, thick: 0.15, fascia: 0.22,
      rafters: 2.5, rafterAt: -71, rafterSize: [0.12, 0.24], deck: 'ribbedAcross', rafterColor: 0x34383b,
      beam: 0.3,
      columns: { every: 7.5, at: -71, size: 0.22, plinth: { size: 0.32, height: 0.1 }, pair: 1.3 },
      lamps: { offset: 2.5, length: 1.5, every: 3.75 },
      colors: { underside: 0xa9adad, fascia: 0x3a3e41, top: 0x6c7072, steel: 0x3b4044 },
      signs: { at: [-52, -22, 8, 30], back: 'Utgång', ahead: '', blue: true },
      // (trains towards T-Centralen stop on the northern track)
      boards: [
        { s: -7.25, u: -1.6, toward: 'T-Centralen', trains: ['19 Hagsätra  3 min', '17 Skarpnäck  7 min'] },
        { s: -7.25, u: 1.6, toward: 'Hässelby', trains: ['19 Hässelby strand  2 min', '17 Åkeshov  6 min'] },
      ],
    },
    paving: {
      edge: 0.85, tactile: [0.85, 1.2], slabs: 1.2, paverSize: [0.25, 0.4], mix: 0.15,
      colors: { edge: 0xcfcdc7, tactile: 0x4b4e50, slab: 0x8d8a85, pavers: 0x8d8a85, paler: 0x9d9a95, face: 0x8e8b85 },
      pattern: 'bond',
    },
    buildings: ['w138885055'],
    rooms: [
      { name: 'hall over the tracks', s: [-96, -73.7], u: [-4, 2.2], h: [-0.5, 0.5], walls: null, floor: 'redGranite' },
      // (tiled up to the hall's floor, its glass above)
      { name: 'stairs', s: [-88, -75.7], u: [-2.2, 1.7], h: [-4.7, -0.1], walls: 'roxnerTiles', stairs: 'roxnerTiles', floor: 'darkStone', sill: 0 },
      { name: 'passage', s: [-96, -87.6], u: [-3, 9.4], h: [-5, -3.5], walls: 'roxnerTiles', floor: 'redGranite', ceiling: 'perforated' },
      { name: 'ticket hall', s: [-96, -89], u: [9.4, 24], h: [-5, -3.5], walls: null, floor: 'redGranite' },
    ],
    blocks: [
      // the hall over the tracks: the stairs' half, its roof falling westwards over them, and the
      // walkway's, kept clear of the trains; a strip of wall where the roofs meet
      { name: 'stair hall', plan: [[-73.8, -2.2], [-87.7, -2.2], [-87.7, 1.75], [-73.8, 2.05]], h: [-1.55, 2.15], low: 1.35,
        walls: 'greyGlazed', sides: [null, undefined, undefined, null], eaves: [0, 0.15, 0, 0], ceiling: 'slats', roof: 0.15, roofColor: 0x3b3e41 },
      { name: 'walkway', plan: [[-73.8, -3.78], [-87.7, -3.5], [-87.7, -2.2], [-73.8, -2.2]], h: [-1.55, 2.25],
        walls: 'greyGlazed', sides: [undefined, null, null, null], floor: 'redGranite', ceiling: 'slats', roof: 0.15, roofColor: 0x3b3e41 },
      { name: "lift's lobby", plan: [[-87.7, -3.5], [-91.8, -2.6], [-91.8, 0.4], [-87.7, 0.4]], h: [-1.55, 2.25],
        walls: 'greyGlazed', sides: [undefined, null, undefined, null], floor: 'redGranite', ceiling: 'slats', roof: 0.15, roofColor: 0x3b3e41 },
      { name: 'where the roofs meet', plan: [[-73.8, -2.25], [-73.8, -2.15], [-87.7, -2.15], [-87.7, -2.25]], h: [2.15, 2.25], from: 2.15, fall: 1.35, lowBack: 3.05,
        walls: 'slats' },
      { name: "lift's tower", plan: [[-91.8, -2.6], [-95.2, -2.6], [-95.2, 0.4], [-91.8, 0.4]], h: [-1.55, 3.5],
        walls: 'glazed', sides: [undefined, undefined, undefined, null], roof: 0.25, roofColor: 0x3b3e41 },
      // over the passage's mouth at the stairs' foot
      { name: 'lintel', plan: [[-87.6, -2.0], [-87.7, -2.0], [-87.7, 1.55], [-87.6, 1.55]], h: [-2.15, 0], from: -2.15, walls: 'roxnerTiles' },
      // the ticket hall in the street: glazed, the passage coming in through its back wall under
      // the tracks' bank, high windows over it
      { name: 'ticket hall', plan: [[-89.05, 9.4], [-96.0, 9.4], [-96.0, 23.4], [-89.05, 23.4]], h: [-4.85, 0.1], from: -4.55, low: -0.6,
        walls: 'darkGlazed', sides: ['roxnerClerestory', undefined, undefined, 'roxnerTiles'], eaves: [0, 0.6, 0.5, 0], brackets: { every: 0.6, color: 0x5a3e30 },
        floor: 'redGranite', ceiling: 'ribbedMetal', roof: 0.2, roofColor: 0x3b3d3f, ground: true,
        nameSign: { side: 2, at: 0.55, length: 4.2, bottom: -1.95 } },
      { name: 'block beside it', plan: [[-81.5, 7.2], [-89.0, 7.2], [-89.0, 23.6], [-81.5, 23.6]], h: [-4.85, 1.95], from: -4.55, low: 1.15,
        walls: 'bottleTiles', band: { walls: 'sageRender', from: -1.4 }, roof: 0.2, roofColor: 0x45484a, ground: true },
      { name: 'kiosk', plan: [[-85.2, 23.6], [-89.0, 23.6], [-89.0, 23.75], [-85.2, 23.75]], h: [-4.55, -1.7], from: -4.55, walls: 'shopWindows', roof: 0.05 },
      { name: 'box on its roof', plan: [[-86.2, 8.4], [-89.0, 8.4], [-89.0, 13.0], [-86.2, 13.0]], h: [1.0, 3.0], from: 1.0, walls: 'greyPanels', roof: 0.2, roofColor: 0x3a3c3e },
    ],
    art: [
      { kind: 'masts', height: 4.2, color: 0xa4a8ab, top: false, arm: 0.45, at: [[42, -0.2], [57.5, 0.5]] },
      { kind: 'roundel', s: -95.7, u: -0.9, h: 4.85, size: 0.9, foot: -1.55 },
    ],
    benches: { at: [-52.25, -29.75, 15.25], wood: true },
    fences: [
      { points: [[-96, -7.6], [-60, -8.2], [-20, -8.4], [33, -6.9], [79, -5.7]], h: [-1.5, 0.3] },
    ],
  },
  // Brommaplan (26 October 1952; the viaduct over the square built for Ängbybanan's trams in 1944,
  // SL's ticket hall under it in the 1980s): an island platform on a shelf of the slope, the
  // ground falling away to the north and rising to the south, its tracks leaving it to the west
  // on two concrete decks over Tunnlandet. The laser scan puts its roof from 61.5 m west of the
  // platform's middle to 32 m east, as wide as the platform, its underside 3.05 m over the middle
  // and 3.3 m at the edges; east of it the platform is open. Photographs (2018 to 2026) show the
  // underside of white sheet steel ribbed across the platform on white beams, two blue girders
  // along it on pairs of square blue posts down its middle, tied across and braced, a navy
  // fascia; black name signs hung from the girders, departure boards, a clock, wooden benches; on
  // the open part grey masts with two lamps on short arms. The paving: pale edge slabs, a dark
  // ribbed strip, grey slabs in a grid. Chain-link fences beyond both tracks.
  //
  // At the west end stands a low enclosure (photographs from Kapplandsvägen, 2019; the laser
  // scan): grey ribbed cladding under a band of windows whose sill climbs eastwards with the stairs
  // inside, a blue fascia, its roof stepping up over the stairs' top, a ribbed drum over the lift
  // at its west end. Inside (photographs, 2016) an escalator and a stair beside it go down
  // westwards under the platform between board-marked concrete under a ceiling of pale timber
  // slats; a walkway along their south side leads to the round glass lift, which stands at their
  // foot. From there a corridor tiled in purples, lilac, dark blue and white goes on west to the
  // ticket hall (OpenStreetMap's indoor mapping: escalator, stair and lift; the laser scan: the
  // hall's floor 6.15 m under the platform). The hall stands on the square under both decks:
  // between them a glass vault on dark blue arched ribs, the decks' soffits white either side;
  // walls of brushed steel panels with rows of rivets, a dark slate floor, the gates and a booth in
  // ultramarine panels, and Peter Svedberg's Vingprofiler och turbin (1996): riveted metal wing
  // profiles standing in the hall. Its glass front, under a black band with the name, faces west
  // along the gap between the decks, a T on a globe hung before it; board-marked concrete either
  // side, and shops beside it under the decks' outer edges (Pressbyrån to the south). The decks
  // stand on round piers of board-marked concrete, each banded yellow, red and dark blue at its
  // top, with tubular railings along their edges.
  //
  // Not drawn: Svedberg's engine hung under the vault, the clocks on the railings, the market
  // and Berndt Helleberg's Fågel Rock (1969) on the square. The network's tracks are about 1.5 m
  // closer together over the square than the real decks, so the vault between them is narrower;
  // the round lift is a square one.
  'Brommaplan': {
    roof: {
      kind: 'butterfly',
      from: -61.5, to: 32, width: 7.6,
      shape: [[-61.5, -0.22, 7.82], [-50, -0.31, 7.95], [-40, -0.31, 7.91], [-30, -0.26, 7.8], [-20, -0.2, 7.68], [-10, -0.12, 7.52],
        [0, -0.03, 7.33], [10, 0.09, 7.1], [20, 0.24, 6.81], [32, 0.45, 6.38]],
      middle: 3.05, edge: 3.3, thick: 0.3, fascia: 0.25,
      rafters: 1.8, rafterAt: -60.6, rafterSize: [0.14, 0.3], deck: 'ribbedAcross', rafterColor: 0xe6e8e6,
      beam: 0.4,
      columns: { every: 10.5, at: -57, size: 0.15, plinth: { size: 0.2, height: 0.05 }, pair: 1.2, ties: [0.95, 2.4], between: [-58, 28] },
      lamps: { offset: 2.0, length: 1.2, every: 3.6, across: true },
      colors: { underside: 0xe0e3e1, fascia: 0x1f2f55, top: 0x5f6366, steel: 0x2a58a8 },
      signs: { at: [-51.75, -20.25, 11.25], back: 'Utgång', ahead: '', bottom: 2.3 },
      clocks: [[-9.75, 0]],
      // (trains towards T-Centralen stop on the northern track)
      boards: [
        { s: -30.75, u: -1.6, toward: 'T-Centralen', trains: ['17 Skarpnäck  2 min', '19 Hagsätra  6 min'] },
        { s: -30.75, u: 1.6, toward: 'Hässelby', trains: ['19 Hässelby strand  4 min', '17 Åkeshov  8 min'] },
      ],
    },
    paving: {
      edge: 0.8, tactile: [0.8, 1.1], slabs: 1.1, paverSize: [0.6, 0.6], mix: 0.12,
      colors: { edge: 0xd2d0cb, tactile: 0x4f5254, slab: 0x8a8884, pavers: 0x85827f, paler: 0x918e8a, face: 0x8e8b85 },
      pattern: 'grid',
    },
    buildings: ['w250814994'],
    rooms: [
      { name: 'enclosure', s: [-87, -60], h: [-0.5, 0.5], walls: null, floor: null, lamps: 2.6 },
      { name: 'escalator', s: [-81, -60], h: [-7, -0.5], walls: 'boardConcrete', stairs: 'boardConcrete', ceiling: 'pineBoards' },
      { name: 'corridor', s: [-92.2, -77], h: [-7, -5], walls: 'purpleTiles', floor: 'slate', ceiling: 'whiteRender' },
      { name: 'ticket hall', s: [-108.6, -92.2], h: [-7, -5], walls: null, floor: 'slate', ceiling: 'whiteRender', lamps: 3.3 },
      { name: 'square', s: [-120, -108.6], h: [-8, -5], walls: null, floor: 'pavers' },
    ],
    blocks: [
      // the enclosure over the way down, its west end where the platform ends, its roof stepping
      // up over the stairs' top; the band of windows climbing with them
      { name: 'enclosure', plan: [[-85.3, -10.17], [-71, -8.14], [-71, -1.23], [-86.6, -4.31]], h: [0, 2.75],
        walls: 'cladding', sides: [undefined, null, undefined, 'glazed'], band: { walls: 'glazed', from: 0.9, low: 2.0 }, eaves: 0.1,
        ceiling: 'pineBoards', roof: 0.2, roofColor: 0x2a4f9a },
      { name: "enclosure's high end", plan: [[-71, -8.14], [-62, -7.06], [-62, 0.08], [-71, -1.23]], h: [0, 2.75], low: 4.05,
        walls: 'cladding', sides: [undefined, 'glazed', undefined, null], band: { walls: 'glazed', from: 2.0, low: 3.3 }, eaves: 0.1,
        ceiling: 'pineBoards', roof: 0.2, roofColor: 0x2a4f9a },
      // the gap between the decks, which the network draws as one deck where its tracks are close
      ...([
        [[-140, -22.92], [-124, -18.41], [-124, -14.7], [-140, -20.11]],
        [[-124, -18.41], [-108.5, -14.65], [-108.5, -9.95], [-124, -14.7]],
        [[-108.5, -14.65], [-100, -12.87], [-100, -7.57], [-108.5, -9.95]],
        [[-100, -12.87], [-91.5, -11.28], [-91.5, -5.41], [-100, -7.57]],
      ] as [number, number][][]).map((plan): Block => ({ name: 'between the decks', plan, h: [-2.6, 0.6], from: -2.6, walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true })),
      // the decks' inner edges along the gap (white over the hall), and the shared deck's end
      ...([
        [[[-140, -22.92], [-124, -18.41], [-124, -18.21], [-140, -22.72]], [[-140, -20.31], [-124, -14.9], [-124, -14.7], [-140, -20.11]], 'boardConcrete'],
        [[[-124, -18.41], [-108.5, -14.65], [-108.5, -14.45], [-124, -18.21]], [[-124, -14.9], [-108.5, -10.15], [-108.5, -9.95], [-124, -14.7]], 'boardConcrete'],
        [[[-108.5, -14.65], [-100, -12.87], [-100, -12.67], [-108.5, -14.45]], [[-108.5, -10.15], [-100, -7.77], [-100, -7.57], [-108.5, -9.95]], 'whiteRender'],
        [[[-100, -12.87], [-91.5, -11.28], [-91.5, -11.08], [-100, -12.67]], [[-100, -7.77], [-91.5, -5.61], [-91.5, -5.41], [-100, -7.57]], 'whiteRender'],
      ] as [[number, number][], [number, number][], Finish][]).flatMap(([n, s, walls]): Block[] => [
        { name: "north deck's edge", plan: n, h: [-2.6, -1.2], from: -2.6, walls, sides: [null, null, undefined, null], roof: 0.05, roofColor: 0x9a9892 },
        { name: "south deck's edge", plan: s, h: [-2.6, -1.2], from: -2.6, walls, sides: [undefined, null, null, null], roof: 0.05, roofColor: 0x9a9892 },
      ]),
      { name: "shared deck's end", plan: [[-140.2, -22.98], [-140, -22.92], [-140, -20.11], [-140.2, -20.18]], h: [-2.6, -1.2], from: -2.6, walls: 'boardConcrete' },
      // the ticket hall: the vault between the decks, and the halls under them either side
      { name: 'vault', plan: [[-108.5, -14.45], [-108.5, -10.15], [-91.5, -5.61], [-91.5, -11.08]], h: [-6.15, -1.2], from: -6.15,
        walls: 'rivetedSteel', sides: [null, null, null, null], floor: 'slate', onPlatform: true, ground: true,
        gables: { count: 1, rise: 1.25, color: 0x9aa0a4, trim: 0x24418a, round: true, glass: { ribs: 1.6, color: 0x24418a } } },
      { name: 'hall under the north deck', plan: [[-108.5, -16.8], [-91.5, -13.43], [-91.5, -11.08], [-108.5, -14.45]], h: [-6.15, -2.6], from: -6.15,
        walls: 'rivetedSteel', sides: [undefined, undefined, null, null], floor: 'slate', ceiling: 'whiteRender', onPlatform: true, ground: true },
      { name: 'hall under the south deck', plan: [[-108.5, -10.15], [-91.5, -5.61], [-91.5, -3.26], [-108.5, -7.8]], h: [-6.15, -2.6], from: -6.15,
        walls: 'rivetedSteel', sides: [null, undefined, undefined, null], floor: 'slate', ceiling: 'whiteRender', onPlatform: true, ground: true },
      // (the corridor comes in through it)
      { name: "vault's east wall", plan: [[-91.7, -11.08], [-91.5, -11.08], [-91.5, -5.61], [-91.7, -5.61]], h: [-6.15, -1.2], from: -6.15, walls: 'rivetedSteel' },
      // the front: glass doors under the name between the decks, board-marked concrete either side
      { name: 'front', plan: [[-108.5, -14.45], [-108.5, -10.15], [-108.7, -10.15], [-108.7, -14.45]], h: [-6.15, -2.6], from: -6.15,
        walls: 'blackFront', nameSign: { side: 2, at: 0.5, length: 3.6, bottom: -3.8, black: true } },
      { name: 'over the doors', plan: [[-108.5, -14.45], [-108.5, -10.15], [-108.7, -10.15], [-108.7, -14.45]], h: [-2.6, -1.2], from: -2.6, walls: 'cladding' },
      { name: 'front under the north deck', plan: [[-108.5, -16.8], [-108.5, -14.45], [-108.7, -14.45], [-108.7, -16.8]], h: [-6.15, -2.6], from: -6.15, walls: 'boardConcrete' },
      { name: 'front under the south deck', plan: [[-108.5, -10.15], [-108.5, -7.8], [-108.7, -7.8], [-108.7, -10.15]], h: [-6.15, -2.6], from: -6.15, walls: 'boardConcrete' },
      // shops beside it under the decks' outer edges, roofed where they reach out past them
      { name: 'shops to the north', plan: [[-106.3, -16.4], [-84, -12.28], [-83.4, -23], [-104.4, -24.4]], h: [-6.3, -3.35], from: -6.3,
        walls: 'shopWindows', sides: [null, 'whiteRender', undefined, undefined], roof: 0.15, roofColor: 0x5d6164, ground: true },
      { name: 'shops to the south', plan: [[-108.6, -7.73], [-95.5, -4.16], [-95.5, 1.5], [-112, 1.5]], h: [-6.3, -3.55], from: -6.3,
        walls: 'shopWindows', sides: [undefined, 'boardConcrete', 'boardConcrete', undefined], roof: 0.15, roofColor: 0x5d6164, ground: true },
      { name: 'booth', plan: [[-101.5, -7.02], [-98.5, -7.02], [-98.5, -5.82], [-101.5, -5.82]], h: [-6.15, -3.9], from: -6.15,
        walls: 'blueGlazed', roof: 0.1, roofColor: 0x22357e },
    ],
    art: [
      { kind: 'masts', height: 4.6, color: 0x9a9fa3, top: false, arm: 0.6, at: [[42, -0.66], [77.7, -3.09]] },
      { kind: 'masts', height: 4.6, color: 0x9a9fa3, top: false, arm: 0.6, sign: 2.7, at: [[60, -1.69]] },
      // the drum over the lift
      { kind: 'columns', at: [[-84.4, -5.33]], from: 2.95, to: 3.75, size: 3.0, color: 0x8c9196 },
      // the piers under the decks, banded dark blue, red and yellow at their tops
      { kind: 'columns', at: [[-110, -16.65], [-110, -8.75], [-122, -19.55], [-122, -12.42], [-134, -22.8], [-134, -16.36], [-146, -26.4], [-146, -20.63]], from: -7.8, to: -2.6, size: 2.0, color: 0xa9a59c },
      { kind: 'columns', at: [[-110, -16.65], [-110, -8.75], [-122, -19.55], [-122, -12.42], [-134, -22.8], [-134, -16.36], [-146, -26.4], [-146, -20.63]], from: -3.05, to: -2.85, size: 2.04, color: 0x26306e },
      { kind: 'columns', at: [[-110, -16.65], [-110, -8.75], [-122, -19.55], [-122, -12.42], [-134, -22.8], [-134, -16.36], [-146, -26.4], [-146, -20.63]], from: -2.85, to: -2.67, size: 2.04, color: 0xb3262a },
      { kind: 'columns', at: [[-110, -16.65], [-110, -8.75], [-122, -19.55], [-122, -12.42], [-134, -22.8], [-134, -16.36], [-146, -26.4], [-146, -20.63]], from: -2.67, to: -2.6, size: 2.04, color: 0xd9a31e },
      // Svedberg's wing profiles
      { kind: 'columns', at: [[-103.5, -14.47], [-103.5, -7.67]], from: -6.15, to: -2.75, size: 0.75, color: 0xc0c4c7 },
      // the T hung before the doors
      { kind: 'columns', at: [[-109.0, -12.43]], from: -2.7, to: -1.25, size: 0.04, color: 0x9aa0a4 },
      { kind: 'roundel', s: -109.0, u: -12.43, h: -3.0, size: 0.6, foot: -3.3, along: true },
    ],
    benches: { at: [-51.75, -41.25, 0.75, 22.5], wood: true },
    fences: [
      { points: [[-84, -14.88], [-70, -12.91], [-56, -11.32], [-42, -10.11], [-28, -9.22], [-14, -8.63], [0, -8.25], [14, -8.05], [28, -8.04], [42, -8.21],
        [56, -8.62], [70, -9.25], [84, -10.04], [100, -11.15]], h: [-1.3, 0.5] },
      { points: [[-84, 1.16], [-70, 3.85], [-56, 5.69], [-42, 6.94], [-28, 7.68], [-14, 8.09], [0, 8.23], [14, 8.07], [28, 7.65], [42, 6.89],
        [56, 5.78], [70, 4.36], [84, 2.73], [100, 0.78]], h: [-1.3, 0.5] },
      // the decks' railings, on their outer edges and along the gap between them
      { kind: 'rails', color: 0x9aa0a4, h: [-1.3, -0.5], points: [[-151, -30.75], [-144.5, -28.67], [-138, -26.72], [-131.5, -24.86], [-125, -23.06], [-118.5, -21.41],
        [-112, -19.86], [-105.5, -18.39], [-99, -17.07], [-92.5, -15.85], [-86, -14.73]] },
      { kind: 'rails', color: 0x9aa0a4, h: [-1.3, -0.5], points: [[-151, -19.76], [-144.5, -17.32], [-138, -15], [-131.5, -12.77], [-125, -10.62], [-118.5, -8.56],
        [-112, -6.59], [-105.5, -4.71], [-99, -2.9], [-92.5, -1.26], [-86, 0.27]] },
      { kind: 'rails', color: 0x9aa0a4, h: [-1.15, -0.45], points: [[-140, -22.82], [-134, -21.05], [-128, -19.39], [-122, -17.8], [-116, -16.28], [-110, -14.9],
        [-104, -13.58], [-98, -12.36], [-92, -11.27], [-91.5, -11.18]] },
      { kind: 'rails', color: 0x9aa0a4, h: [-1.15, -0.45], points: [[-140, -20.21], [-134, -18.11], [-128, -16.09], [-122, -14.17], [-116, -12.29], [-110, -10.5],
        [-104, -8.79], [-98, -7.14], [-92, -5.63], [-91.5, -5.51]] },
    ],
  },
  // Åkeshov (26 October 1952; the line built for Ängbybanan's trams in 1944): two island platforms
  // on a low bank between Bergslagsvägen and Åkeshov's park, the track where the T17 turns between
  // them, its tracks leaving them to the east on concrete decks over the ticket hall and a footway.
  // The laser scan puts a butterfly roof over each island from 10.5 m west of the platforms'
  // middle to their east ends, as wide as the island, its underside 2.95 m over the platform at
  // the valley and 3.35 m at the edges; west of them the platforms are open. Photographs (2006 to
  // 2026) show the underside of pale grey sheet metal ribbed across the platform, on pairs of
  // square dark green posts down the island's middle, about 9 m apart, each pair under a green
  // beam across the roof, pale grey purlins along it with strip lights under them; black name
  // signs hung from the roof, clocks, departure boards, wooden benches; on the open part, green
  // masts with two green bowl lamps on a short arm, some with the name; a dark hut on the southern
  // island. The paving: pale edge slabs, a dark ribbed strip, grey slabs in courses. A dark mesh
  // fence beyond the northern track, tall grey panels beyond the southern (2026).
  //
  // At each island's east end a long low glazed housing stands between the tracks (the laser
  // scan: its roof 2.8 m over the platform on its outer side, falling to 2.2 m), its sliding doors
  // facing the platform; inside, a stair goes down eastwards in an open well, with a landing
  // halfway, and a walkway beside it leads to a lift in a glass tower with a dark machine room on
  // top, a T on a globe over the northern one (OpenStreetMap's indoor mapping; photographs, 2018
  // to 2024). They come down into the ticket hall under the decks (the laser scan: 5.3 m under
  // the platform), its walls glossy white tiles striped with red and ochre by the shop and the
  // stairs, its floor pale terrazzo, its ceiling white under the decks, lit from above between
  // them through flat roofs with small rooflights (the laser scan: 0.5 m under the platform).
  // On the white wall between the stairs' feet stands Carl Fredrik Reuterswärd's Non-Violence
  // (1998), the revolver with its barrel tied in a knot, on a plinth of the same tiles. The gates
  // cross the hall, the booth in blue panels beside them, the Myway shop beyond. The glass front
  // faces east onto the footway and cycleway under the line, the name on a blue band over its
  // doors. To the south the underpass comes out under the southern deck, the name on a black sign
  // on the deck's fascia, between the shop's outside in two greens and the abutment's lattice of
  // grey battens; to the north a stair climbs west in a concrete trough to Bergslagsvägen's
  // service road, and a tunnel runs on under Bergslagsvägen to a small gabled building, its gables
  // rendered cream, its long sides glazed, the name on a black panel over the passage through it.
  //
  // Not drawn: the green mesh gates beside the housings, the departure boards and the clock over
  // the sculpture, the bins and grit boxes, the shop's air conditioning and the red strip along
  // the abutment's edge. The network's northern track is closer to the others than the real one
  // east of the platforms' middle, so the northern roof and housing narrow eastwards; the decks
  // are one per track, so the hall's rooflights stand in the network's gaps between them; the
  // rooflights are round rather than small pyramids.
  'Åkeshov': {
    // the southern island's roof (the line it follows is that platform's)
    roof: {
      kind: 'butterfly',
      from: -10.5, to: 72, width: 7.1,
      shape: [[-10.5, -0.24, 7.18], [0, -0.285, 7.09], [20, -0.305, 7.05], [40, -0.285, 7.09], [60, -0.295, 7.06], [72, -0.285, 6.95]],
      middle: 2.95, edge: 3.35, thick: 0.1, fascia: 0.12,
      rafters: 9, rafterAt: -6, rafterSize: [0.18, 0.32], deck: 'ribbedAcross', rafterColor: 0x2b6648,
      beam: 0.15,
      purlins: { at: [-2.4, -1.4, -0.6, 0.6, 1.4, 2.4], size: [0.1, 0.16], color: 0xc9ccca },
      columns: { every: 9, at: -6, size: 0.18, plinth: { size: 0.24, height: 0.04 }, pair: 0.95 },
      lamps: { offset: 1.4, length: 1.5, every: 3.0, at: [-1.4, 1.4], tube: true },
      colors: { underside: 0xc9ccca, fascia: 0xc4c7c5, top: 0xd8d8d4, steel: 0x2b6648 },
      signs: { at: [-1.5, 25.5, 52.5], back: '', ahead: 'Utgång', bottom: 2.35 },
      clocks: [[16.5, 0]],
      // (trains keep left: out of town on the southern track, the T17 turning on the middle one)
      boards: [
        { s: 43.5, u: 1.7, toward: 'Hässelby strand', trains: ['19 Hässelby strand  4 min', '19 Hässelby strand  14 min'] },
        { s: 43.5, u: -1.7, toward: 'Skarpnäck', trains: ['17 Skarpnäck  6 min', '17 Skarpnäck  16 min'] },
      ],
    },
    roofs: [
      // the northern island's
      {
        kind: 'butterfly',
        from: -10.5, to: 72, width: 7.9,
        shape: [[-10.5, -9.155, 7.85], [0, -9.185, 7.91], [10, -9.16, 7.86], [20, -9.08, 7.7], [30, -8.955, 7.43], [40, -8.76, 7.06],
          [50, -8.536, 6.62], [60, -8.29, 6.13], [66, -8.14, 5.82], [72, -7.915, 5.51]],
        middle: 2.95, edge: 3.35, thick: 0.1, fascia: 0.12,
        rafters: 9, rafterAt: -6, rafterSize: [0.18, 0.32], deck: 'ribbedAcross', rafterColor: 0x2b6648,
        beam: 0.15,
        purlins: { at: [-2.4, -1.4, -0.6, 0.6, 1.4, 2.4], size: [0.1, 0.16], color: 0xc9ccca },
        columns: { every: 9, at: -6, size: 0.18, plinth: { size: 0.24, height: 0.04 }, pair: 0.95 },
        lamps: { offset: 1.4, length: 1.5, every: 3.0, at: [-1.4, 1.4], tube: true },
        colors: { underside: 0xc9ccca, fascia: 0xc4c7c5, top: 0xd8d8d4, steel: 0x2b6648 },
        signs: { at: [-1.5, 25.5, 52.5], back: '', ahead: 'Utgång', bottom: 2.35 },
        clocks: [[16.5, 0]],
        // (into town on the northern track)
        boards: [
          { s: 43.5, u: -1.7, toward: 'T-Centralen', trains: ['19 Hagsätra  3 min', '17 Skarpnäck  6 min'] },
          { s: 43.5, u: 1.7, toward: 'Skarpnäck', trains: ['17 Skarpnäck  6 min', '17 Skarpnäck  16 min'] },
        ],
      },
    ],
    paving: {
      edge: 0.8, tactile: [0.8, 1.15], slabs: 1.15, paverSize: [0.4, 0.3], mix: 0.15,
      colors: { edge: 0xdddcd7, tactile: 0x55585b, slab: 0xa6a49f, pavers: 0xa29f99, paler: 0xb2afa9, face: 0x8a8781 },
      pattern: 'bond',
    },
    buildings: ['w170795990'],
    rooms: [
      // (the stairs in open wells under the housings, their walls up to the walkways' floor)
      { name: 'stair wells', s: [74, 89.6], u: [-7, 9], h: [-5.6, -0.4], walls: 'stripeTiles', stairs: 'stripeTiles', floor: 'terrazzo', sill: 0 },
      { name: 'on the platforms', s: [72, 74.9], u: [-7, 9], h: [-0.4, 3], walls: null, floor: null },
      { name: 'housings', s: [74.9, 91], u: [-7, 9], h: [-0.4, 3], walls: 'glazed', floor: 'terrazzo' },
      { name: 'ticket hall', s: [89.6, 103.65], u: [-4.5, 7.8], h: [-5.6, -4], walls: null, floor: 'terrazzo', lamps: 2.3 },
      { name: 'underpass', s: [103.65, 112], u: [-6.9, 14.3], h: [-5.6, -4], walls: null, floor: 'asphalt', lamps: 2.4 },
      { name: 'forecourt', s: [103.65, 112], u: [14.3, 32], h: [-5.6, -4], walls: null, floor: 'asphalt' },
      { name: 'trough', s: [94, 103.65], u: [-12, -8], h: [-5.6, -1], walls: 'boardConcrete', stairs: 'boardConcrete', floor: 'asphalt' },
      { name: 'tunnel', s: [103.65, 140], u: [-80, -6.9], h: [-5.6, -4], walls: 'boardConcrete', floor: 'asphalt', ceiling: 'boardConcrete' },
      { name: 'entrance building', s: [120, 142], u: [-76, -58], h: [-5.6, 0], walls: 'whiteRender', stairs: 'whiteRender', floor: 'pavers', ceiling: 'whiteRender' },
    ],
    blocks: [
      // the housings over the stairs, between the tracks, their roofs falling towards the middle
      // track, the doors at their west ends
      { name: 'northern housing', plan: [[72.3, -6.25], [90.8, -4.41], [90.8, 0.05], [72.3, -2.0]], h: [-1.8, 2.8], lowBack: 2.2,
        walls: 'glazed', sides: [undefined, undefined, undefined, 'blackFront'], eaves: 0.1, ceiling: 'ribbedMetal', roof: 0.12, roofColor: 0x5d6164, onPlatform: true },
      { name: 'southern housing', plan: [[72.3, 7.7], [90.8, 7.7], [90.8, 3.3], [72.3, 3.4]], h: [-1.8, 2.8], lowBack: 2.2,
        walls: 'glazed', sides: [undefined, undefined, undefined, 'blackFront'], eaves: 0.1, ceiling: 'ribbedMetal', roof: 0.12, roofColor: 0x5d6164, onPlatform: true },
      // the lifts' machine rooms, on their glass towers
      { name: "northern lift's machine room", plan: [[90.75, -4.3], [93.25, -4.3], [93.25, -2.0], [90.75, -2.0]], h: [3.7, 4.35], from: 3.7,
        walls: 'greyPanels', roof: 0.08, roofColor: 0x3a3d40 },
      { name: "southern lift's machine room", plan: [[90.75, 3.3], [93.25, 3.3], [93.25, 5.6], [90.75, 5.6]], h: [3.2, 3.85], from: 3.2,
        walls: 'greyPanels', roof: 0.08, roofColor: 0x3a3d40 },
      // the bank under the decks west of the hall, ballast between them
      { name: 'bank under the decks', plan: [[74, -10.5], [89.5, -9.0], [89.5, 13.15], [74, 12.65]], h: [-5.5, -1.95], from: -5.5,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.15, roofColor: 0x5f5b56, ground: true },
      // (the city's ground cut away along the joint of the bank and the hall, where a sliver of it
      // was left)
      { name: 'under the hall\'s west wall', plan: [[89.3, -9.0], [89.7, -9.0], [89.7, 13.15], [89.3, 13.15]], h: [-5.5, -1.95], from: -5.5,
        walls: 'boardConcrete', sides: [null, null, null, null], ground: true },
      // the ticket hall: its shell, its ceilings under the decks, and the flat roofs between them
      { name: 'ticket hall', plan: [[89.5, -4.3], [103.6, -4.3], [103.6, 7.6], [89.5, 7.6]], h: [-5.5, -2.8], from: -5.31,
        walls: 'stripeTiles', sides: [undefined, 'glassFront', undefined, 'glossTiles'], floor: 'terrazzo', ground: true,
        nameSign: { side: 1, at: 0.5, length: 3.6, bottom: -3.31 } },
      ...([
        [[89.5, -4.3], [90.8, -4.3], [90.8, 7.6], [89.5, 7.6]],
        [[90.8, -4.3], [103.6, -4.3], [103.6, -1.47], [90.8, -3.11]],
        [[90.8, -1.06], [103.6, 0.04], [103.6, 5.74], [90.8, 4.64]],
      ] as [number, number][][]).map((plan): Block => ({ name: "hall's ceiling under the decks", plan, h: [-2.97, -2.95], from: -2.97,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'whitePanels' })),
      ...([
        [[90.8, -3.06], [103.6, -1.42], [103.6, -0.01], [90.8, -1.11]],
        [[90.8, 4.69], [103.6, 5.86], [103.6, 7.6], [90.8, 7.6]],
      ] as [number, number][][]).map((plan): Block => ({ name: 'flat roof between the decks', plan, h: [-2.95, -0.55], from: -2.95,
        walls: 'whiteRender', sides: [undefined, 'glazed', undefined, undefined], ceiling: 'whiteRender', roof: 0.15, roofColor: 0x7a7d80 })),
      // under the northern deck beside the hall, and the shop and staff rooms under the southern,
      // their outside in two greens
      { name: 'under the northern deck', plan: [[89.5, -9.0], [103.6, -7.17], [103.6, -4.3], [89.5, -4.3]], h: [-5.5, -2.8], from: -5.5,
        walls: 'boardConcrete', sides: [undefined, undefined, null, null], ground: true },
      { name: 'shop and staff rooms', plan: [[86, 7.6], [103.6, 7.6], [103.6, 13.33], [86, 12.48]], h: [-5.5, -2.75], from: -5.31,
        walls: 'twoGreens', sides: [null, undefined, undefined, null], roof: 0.1, roofColor: 0x6a6e70, ground: true },
      // in the hall: the line of the gates, the booth beside them, the shop's front, the plinth
      { name: 'gate line', plan: [[97.85, -4.3], [98.15, -4.3], [98.15, -2.15], [97.85, -2.15]], h: [-5.31, -4.21], from: -5.31,
        walls: 'glazed', floor: 'terrazzo' },
      { name: 'booth', plan: [[96.4, 5.65], [99.6, 5.65], [99.6, 7.55], [96.4, 7.55]], h: [-5.31, -3.05], from: -5.31,
        walls: 'blueGlazed', roof: 0.08, roofColor: 0x22357e, floor: 'terrazzo' },
      { name: "shop's front", plan: [[99.8, 7.55], [103.4, 7.55], [103.4, 7.6], [99.8, 7.6]], h: [-5.31, -2.8], from: -5.31,
        walls: 'shopWindows', sides: [undefined, null, null, null] },
      { name: 'plinth', plan: [[89.6, 1.8], [90.2, 1.8], [90.2, 2.4], [89.6, 2.4]], h: [-5.31, -4.31], from: -5.31,
        walls: 'glossTiles', roof: 0.02, roofColor: 0xecece8 },
      ...([[0.3, 0.85], [2.75, 3.3]] as [number, number][]).map(([u0, u1]): Block => ({ name: 'line map', plan: [[89.52, u0], [89.56, u0], [89.56, u1], [89.52, u1]],
        h: [-5.0, -3.56], from: -5.0, walls: 'darkStone', roof: 0.01, roofColor: 0x2a2c2e })),
      // over the underpass: between the decks, ballast over a concrete soffit
      ...([
        [[103.6, -1.47], [107.6, -0.9], [107.6, 0.48], [103.6, 0.04]],
        [[103.6, 5.74], [107.6, 6.18], [107.6, 8.39], [103.6, 8.13]],
      ] as [number, number][][]).map((plan): Block => ({ name: 'between the decks', plan, h: [-2.83, -1.95], from: -2.83,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'boardConcrete', roof: 0.15, roofColor: 0x5f5b56 })),
      // the decks' undersides over the underpass, which its open floor's space cuts out of the
      // network's decks (a ceiling, which only closed spaces cut)
      { name: 'soffit over the underpass', plan: [[103.6, -7.13], [107.6, -6.55], [107.6, 13.95], [103.6, 13.95]], h: [-2.9, -2.87], from: -2.9,
        walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete' },
      // the name on the southern deck's fascia over the underpass's mouth
      { name: "deck's fascia", plan: [[103.4, 13.95], [107.8, 13.95], [107.8, 14.05], [103.4, 14.05]], h: [-2.85, -1.75], from: -2.85,
        walls: 'boardConcrete', nameSign: { side: 2, at: 0.5, length: 3.4, bottom: -2.7, black: true } },
      // the bank east of the underpass, and its wing wall beside the mouth under the battens
      { name: 'bank under the decks, east', plan: [[107.6, -6.6], [126, -3.5], [126, 15.7], [107.6, 14.09]], h: [-5.5, -1.95], from: -5.5,
        walls: 'boardConcrete', sides: [undefined, null, undefined, undefined], roof: 0.15, roofColor: 0x5f5b56, ground: true },
      { name: 'wing wall', plan: [[107.6, 14.09], [108.3, 14.09], [108.3, 19.0], [107.6, 19.0]], h: [-5.5, -1.95], lowBack: -4.3, from: -5.5,
        walls: 'boardConcrete', sides: [null, undefined, undefined, 'latticeConcrete'], roof: 0.1, roofColor: 0x8a8781, ground: true },
      // the pavement along the northern deck, over the bank's foot (and the trough's stair)
      ...([
        [[76, -10.32], [100, -7.66], [100, -11.26], [76, -13.92]],
        [[100, -7.66], [126, -3.5], [126, -7.1], [100, -11.26]],
      ] as [number, number][][]).map((plan): Block => ({ name: 'pavement beside the decks', plan, h: [-5.5, -2.0], from: -2.0,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'pavers', ground: true })),
      // the entrance building beyond Bergslagsvägen: its gables rendered, its long sides glazed,
      // the passage through its western gable
      { name: 'entrance building', plan: [[130.0, -72.8], [127.6, -62.4], [136.4, -60.3], [138.8, -70.8]], h: [-2.3, 1.49], from: -1.95,
        walls: 'glazed', sides: ['whiteRender', undefined, 'whiteRender', undefined], roof: 0.15, roofColor: 0x4a4e52,
        gables: { count: 1, rise: 1.2, color: 0xe6e0cf, trim: 0x3a3d40 }, floor: 'pavers', ground: true,
        nameSign: { side: 0, at: 0.5, length: 3.2, bottom: 0.95, black: true } },
      // the decks' parapets of exposed aggregate along their outer edges
      ...([
        [[76, -10.3], [90, -8.9], [100, -7.65], [110, -6.2], [126, -3.5]],
        [[76, 12.7], [90, 13.15], [100, 13.6], [110, 14.25], [126, 15.7]],
      ] as [number, number][][]).flatMap((edge, k) => edge.slice(1).map(([sb, ub], i): Block => {
        const [sa, ua] = edge[i], w = k === 0 ? 0.25 : -0.25;
        return { name: "deck's parapet", plan: k === 0 ? [[sa, ua], [sb, ub], [sb, ub + w], [sa, ua + w]] : [[sa, ua + w], [sb, ub + w], [sb, ub], [sa, ua]],
          h: [-1.76, -1.21], from: -1.76, walls: 'roughcast', roof: 0.02, roofColor: 0x8f8b84 };
      })),
      // the dark hut on the southern island
      { name: 'hut', plan: [[-23, 4.6], [-19, 4.6], [-19, 6.6], [-23, 6.6]], h: [0, 2.7], walls: 'greyPanels', roof: 0.1, roofColor: 0x2f3234, onPlatform: true },
    ],
    art: [
      { kind: 'masts', height: 4.3, color: 0x2b6648, shade: 0x2f7552, top: false, arm: 0.45, at: [[-42, -4.78], [-24, -4.95], [-24, 5.1]] },
      { kind: 'masts', height: 4.3, color: 0x2b6648, shade: 0x2f7552, top: false, arm: 0.45, sign: 2.7, at: [[-59, -4.48], [-59, 5.37], [-42, 5.2]] },
      // the T on the northern lift's tower
      { kind: 'roundel', s: 92, u: -3.15, h: 4.95, size: 0.75, foot: 4.43 },
      // the rooflights in the flat roofs between the decks
      { kind: 'rooflights', at: [[94.5, -1.73], [97, -1.48], [99.5, -1.2], [102, -0.9]], size: 0.9, ceiling: -0.56, top: -0.4 },
      { kind: 'rooflights', at: [[94.5, 6.27], [97, 6.33], [99.5, 6.48], [102, 6.59]], size: 1.2, ceiling: -0.56, top: -0.4 },
      // Non-Violence, on its plinth against the wall between the stairs' feet
      { kind: 'revolver', s: 89.95, u: 2.1, h: -4.29, turn: Math.PI / 2, size: 0.45 },
    ],
    benches: [{ at: [-45.85, -35.7, -27.7, -14.6, 30], wood: true }, { at: [-14.65, 30], wood: true, roof: 0 }],
    fences: [
      { points: [[-75, -11.6], [-40, -13.0], [0, -13.6], [40, -12.8], [60, -11.7], [74, -10.6]], h: [-1.3, 0.6] },
      { kind: 'boards', color: 0x8f9497, points: [[-75, 14.3], [-40, 13.2], [0, 12.8], [40, 12.7], [74, 13.0]], h: [-1.3, 1.0] },
      // on the parapets along the decks' outer edges
      { points: [[76, -10.18], [90, -8.78], [100, -7.53], [110, -6.08], [126, -3.38]], h: [-1.21, 0.8] },
      { points: [[76, 12.58], [90, 13.03], [100, 13.48], [110, 14.13], [126, 15.58]], h: [-1.21, 0.8] },
    ],
  },
  // Ängbyplan (26 October 1952; Ängbybanan's tram stop Färjestadsvägen from 1944, renamed in
  // 1962): an island platform on a bank curving through Ängby, its west end at the tracks'
  // bridges over Färjestadsvägen. The laser scan puts a butterfly roof over the west half, from
  // 84 m west of the platform's middle to 38 m west, about 10.5 m wide, its top 3.7–4.0 m over the
  // platform. Photographs (2006 to 2024) show it boarded dark brown underneath on dark brown
  // rafters, a black fascia, and oxide-red steel: a beam along the valley on pairs of columns,
  // a low bar across between each pair and one slanting; a clock near its east end, black name
  // signs and departure boards. Out in the open, galvanised masts about a metre north of the
  // platform's middle (laser scan: 5.6 m high), each with two globe lamps on a T, some with the
  // name on a black sign; a glass shelter in black frames (laser scan: 7–14 m west of the
  // middle, 2.8–3.1 m high); wooden benches on galvanised frames. The platform is asphalt, with
  // pale edge stones and a dark ribbed strip. Chain-link fences beyond both tracks, and beyond the
  // southern one, from the hall to the roof's east end, a brown lattice.
  //
  // At the platform's west end, between the tracks, a glazed hall at the platform's level
  // (OpenStreetMap's indoor mapping: the gates 88 m west of the middle, the lift 96 m): pale grey
  // panels between black strips to 2.6 m and windows in grey frames above, a ceiling of pine
  // boards, a polished red-brown floor, a glass lift in its south-west corner. Glass doors under
  // SL's dark blue band, a white disc on it over each, lead into a stair house of glass in dark
  // red-brown frames, its pine ceiling falling with the stair (laser scan: the roof 3.1 m over the
  // platform 98 m west, 0.9 m at 114 m): two flights down west into a trough between the bridges'
  // abutments, its walls Åsa Lindström's tiles (1994), orange-red, and lower down panels of
  // black, white and grey between orange-red strips, out under the bridges' deck onto
  // Färjestadsvägen's pavement, 5.8 m below the platform. The lift goes down to a passage at the
  // street's level under the southern track, its walls her bands of black and white scrolls
  // between panels patterned in colours, a frieze of scrolls along the top, a white ceiling; it
  // comes out through the retaining wall onto a forecourt beside the street, the wall glossy black
  // tiles round the opening with the name in white letters beside it, granite further west
  // (photographs, 2024; laser scan: the forecourt 5.8–5.0 m below the platform).
  //
  // Not drawn: "T Hiss" over the passage's mouth, the departure boards in the hall, the green
  // grit boxes. The network's tracks are about 3 m closer together than the real ones, so the
  // hall and the stair house are narrower, and the lift's door faces the platform at the top as
  // at the bottom (the real one opens south onto the passage).
  'Ängbyplan': {
    roof: {
      kind: 'butterfly',
      from: -84, to: -38, width: 10.5,
      shape: [[-84, 0, 9.1], [-75, 0, 9.8], [-65, 0, 10.4], [-55, 0, 10.77], [-45, 0, 10.9], [-38, 0, 10.9]],
      middle: 3.3, edge: 3.55, thick: 0.3, fascia: 0.3,
      rafters: 1.2, rafterSize: [0.1, 0.25], deck: 'boards',
      beam: 0.35,
      columns: { every: 11.5, at: -79, size: 0.16, plinth: { size: 0.24, height: 0.05 }, pair: 1.6, ties: [1.2, 2.5], between: [-82, -40] },
      lamps: { offset: 1.9, length: 1.5, every: 3 },
      colors: { underside: 0x3e2c22, fascia: 0x262626, top: 0x34363a, steel: 0x7a2a22 },
      signs: { at: [-73.25, -50.25], back: 'Färjestadsvägen', ahead: '', bottom: 2.4 },
      clocks: [[-41.5, 0]],
      // (trains keep left: into town on the northern track)
      boards: [
        { s: -61.75, u: -1.7, toward: 'T-Centralen', trains: ['19 Hagsätra  3 min', '19 Hagsätra  13 min'] },
        { s: -61.75, u: 1.7, toward: 'Hässelby strand', trains: ['19 Hässelby strand  5 min', '19 Hässelby strand  15 min'] },
      ],
    },
    paving: {
      edge: 0.5, tactile: [0.6, 0.9], slabs: 0.9,
      colors: { edge: 0xd0cec8, tactile: 0x3a3c3e, slab: 0x4a4c4f, pavers: 0x4a4c4f, face: 0x8e8b85 },
      pattern: 'asphalt',
    },
    rooms: [
      // (the hall's floors are open to its ceiling; the walls round them are its block's)
      { name: 'hall', s: [-100.4, -84], h: [-0.5, 1], walls: null, floor: 'redGranite', ceiling: 'pineBoards', lamps: 3.2 },
      { name: 'platform', s: [-84, -70], h: [-0.5, 1], walls: null, floor: null },
      // (the trough's walls rise to the glass's foot, or a metre over the steps)
      { name: 'upper flight', s: [-106, -100.4], h: [-3.5, 0.5], walls: 'orangeTiles', stairs: 'orangeTiles', floor: 'greyTiles', sill: -1.3, parapet: 1.0 },
      { name: 'lower flight', s: [-112.7, -106], h: [-6.5, -2.5], walls: 'opPanels', stairs: 'opPanels', floor: 'greyTiles', sill: -1.3, parapet: 1.0, lamps: 2.6 },
      { name: 'passage from the lift', s: [-98.5, -94.7], u: [-3.5, 4.6], h: [-6, -4], walls: 'scrollPanels', floor: 'greyTiles', ceiling: 'whiteRender' },
      { name: 'forecourt', s: [-118, -90], u: [4.6, 16], h: [-6.5, -4], walls: null, floor: 'asphalt' },
      { name: 'pavement', s: [-120, -112.7], u: [-9, -2], h: [-6.5, -4.5], walls: null, floor: 'asphalt' },
    ],
    blocks: [
      // the hall between the tracks, glazed towards the platform, the doors to the stair house
      // in its west wall
      { name: 'hall', plan: [[-84, -5.81], [-100.4, -7.15], [-100.4, -0.77], [-84, 1.94]], h: [-1.3, 3.5], walls: 'stripPanels',
        sides: [undefined, 'circleFront', undefined, 'glazed'], floor: 'redGranite', ceiling: 'pineBoards', roof: 0.35, roofColor: 0x3a3d40,
        eaves: 0.3, onPlatform: true },
      // the gate line either side of the gates
      { name: 'gate line', plan: [[-87.85, -6.13], [-88.15, -6.16], [-88.15, -4.2], [-87.85, -4.2]], h: [0, 1.1], walls: 'glazed', floor: 'redGranite' },
      { name: 'gate line', plan: [[-87.85, 0.2], [-88.15, 0.2], [-88.15, 1.26], [-87.85, 1.29]], h: [0, 1.1], walls: 'glazed', floor: 'redGranite' },
      // the stair house: glass on the trough's walls, its floor and roof falling with the stair
      { name: 'stair house', plan: [[-100.4, -7.05], [-100.4, -3.75], [-104.72, -3.815], [-104.72, -7.115]], h: [1.0, 2.77], from: 1.0, fall: -1.3, lowBack: 4.48,
        walls: 'maroonGlazed', sides: [null, undefined, null, undefined], ceiling: 'pineBoards', roof: 0.15, roofColor: 0x3a3d40 },
      { name: 'stair house, lower', plan: [[-104.72, -7.115], [-104.72, -3.815], [-112.0, -3.926], [-112.0, -7.226]], h: [-1.3, 2.18], from: -1.3, lowBack: 1.18,
        walls: 'maroonGlazed', sides: [null, undefined, undefined, undefined], ceiling: 'pineBoards', roof: 0.15, roofColor: 0x3a3d40 },
      // (the network's slopes down from the two tracks' banks into the gap between them, cut back
      // out of the trough under the stair house, out to the tracks' beds)
      { name: "over the stair's foot", plan: [[-112.85, -7.5], [-104.72, -6.95], [-104.72, -2.3], [-112.85, -3.55]], h: [-2.9, -0.65], from: -2.9,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      // the bank either side of the trough, cut off square at the bridges' abutments, the
      // southern one the retaining wall along the forecourt: granite, and glossy black tiles
      // round the passage's mouth with the name beside it
      // (the northern one's face just behind the trough's wall: the street round the exit is cut
      // away inside it, and a strip of street left between them would read as floor beyond the
      // wall, which then isn't drawn)
      { name: "northern abutment", plan: [[-112.9, -16.0], [-104, -15.0], [-104, -7.06], [-112.9, -7.16]], h: [-5.9, -1.45], from: -5.9,
        walls: 'boardConcrete', roof: 0.15, roofColor: 0x5f5b56, ground: true },
      { name: "southern abutment", plan: [[-114.5, -3.96], [-100.5, -3.76], [-100.5, 4.3], [-114.5, 4.3]], h: [-5.9, -1.45], from: -5.9,
        walls: 'boardConcrete', sides: [undefined, null, 'granite', undefined], roof: 0.15, roofColor: 0x5f5b56, ground: true },
      { name: 'retaining wall', plan: [[-100.5, -3.91], [-95.3, -3.83], [-95.3, 4.3], [-100.5, 4.3]], h: [-5.9, -1.45], from: -5.9,
        walls: 'boardConcrete', sides: [null, undefined, 'blackTiles', null], roof: 0.15, roofColor: 0x5f5b56, ground: true },
      // (the network's slope down from the southern track's bank, cut back over the forecourt
      // below the retaining wall)
      { name: 'over the forecourt', plan: [[-114.5, 4.3], [-95.3, 4.3], [-95.3, 13], [-114.5, 13]], h: [-6.5, -1.75], from: -6.5,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      // the wall closing the forecourt to the east, beside the passage's mouth, the name on it
      { name: 'wing wall', plan: [[-95.3, 4.3], [-94.7, 4.3], [-94.7, 9.5], [-95.3, 9.5]], h: [-5.9, -1.45], lowBack: -2.9, from: -5.9,
        walls: 'boardConcrete', sides: [null, undefined, undefined, 'blackTiles'], roof: 0.1, roofColor: 0x8a8781, ground: true,
        nameSign: { side: 3, at: 0.62, length: 3.0, bottom: -3.65, black: true } },
      // the bank behind it, falling to the footway, out to where the elevation model's 5 m grid
      // has it again (the forecourt's deck reaches under it, so that the grid doesn't ramp the
      // ground up into the forecourt)
      { name: 'bank behind the wing wall', plan: [[-94.7, 4.3], [-89.65, 4.3], [-88.15, 9.5], [-94.7, 9.5]], h: [-5.9, -1.4], lowBack: -2.9, from: -5.9,
        walls: 'boardConcrete', sides: [null, null, undefined, null], roof: 0.1, roofColor: 0x8a8781, ground: true },
    ],
    art: [
      { kind: 'masts', height: 5.6, color: 0x9ea3a6, top: false, at: [[-36.7, -0.3], [-1.6, -0.7], [32.9, -4.2]] },
      { kind: 'masts', height: 5.6, color: 0x9ea3a6, top: false, sign: 3.0, at: [[-19.0, 0.2], [15.2, -1.8]] },
    ],
    shelters: [{ s: [-13.5, -8.5], u: [-2.6, -0.6], roof: true }],
    benches: { at: [-61, -41, 4, 21], wood: true },
    // 2.6 m beyond each track
    fences: [
      { points: [[-112.6, -12.3], [-100, -11.32], [-84, -10.15], [-70, -9.44], [-50, -8.73], [-30, -8.17], [-10, -7.91], [10, -8.44], [30, -10.29],
        [50, -13.24], [70, -17.24]], h: [-1.5, 0.5] },
      { points: [[-112.6, 4.1], [-96, 4.1]], h: [-1.45, 0.5] },
      { kind: 'louvres', color: 0x7a5a48, points: [[-96, 4.1], [-88, 5.72], [-84, 6.29], [-70, 8.02], [-50, 9.47], [-40, 9.82]], h: [-1.5, 0.5] },
      { points: [[-40, 9.82], [-30, 9.92], [-10, 9.37], [10, 7.93], [30, 5.43], [50, 1.76], [70, -3.14]], h: [-1.5, 0.5] },
    ],
  },

  // Islandstorget (26 October 1952; Ängbybanan's tram terminus from 1944): an island platform at
  // grade in Södra Ängby, its west end in a shallow cutting where the tracks go into tunnels on to
  // Blackeberg. The laser scan puts a butterfly roof over its west and middle parts, from 57 m west
  // of the platform's middle to 46 m east, about 8.5 m wide, its top 2.6–2.8 m over the platform
  // at the valley and 3.1–3.4 m at the eaves; the east end open. Photographs (2006, 2018) show
  // corrugated sheet with its ribs across, pale grey underneath on pale grey purlins, beams across
  // cantilevered from pairs of square posts down the middle on concrete plinths, slate blue (2018),
  // and panes of glass in thin dark frames along the middle; black name signs on two bars, the
  // departure board "Tåg mot Hässelby" over the southern edge, a round clock; wooden benches.
  // Seen from above (Google's mesh) the covering is pale grey west of about 10 m west of the
  // middle and pale blue east of it. The paving: grey square slabs, a white edge 0.8 m wide and a
  // dark ribbed strip. Out in the open, two galvanised masts (laser scan: 48 and 65 m east of the
  // middle, 4.1 m high), each with two lamps under dark caps on a short arm. A railing closes the
  // platform 76 m east; chain-link beyond the northern track along the car park, a low black
  // fence on the slope beyond the southern one.
  //
  // At its west end, over the tunnels' mouths, a single-storey hall at the street's level, 3.4 m
  // over the platform, its glazed front on Blackebergsvägen: glass doors in steel frames, SL's
  // dark blue band with "T Islandstorget", a band of windows above showing the white trusses
  // inside, a deep flat canopy white under its dark edge, black standing-seam sheet on the core's
  // sides above the wings; a kiosk built on to the north (shuttered in 2025) and a white-painted
  // block wing to the south (laser scan: the core's roof 7.0–7.7 m over the platform, the wings'
  // 6.2 m); the round T on a tall pole at its front corner and a row of glass screens on its roof
  // (10 m). Inside, a dark grey terrazzo floor, the gates (OpenStreetMap's indoor mapping: 87.5 m
  // west of the middle), a glazed ticket booth with dark blue panels. Beyond the gates a housing
  // whose roof falls from 6.4 m to 3.3 m over the stairs down to the platform (OpenStreetMap: 11 m
  // long, for prams too, so in three short flights), with glass doors in steel frames at its foot;
  // beside it an enclosed gallery at the hall's level (laser scan: 6.3 m), grey panels and
  // brown-tinted windows, along the platform's south side to a glass lift tower in slate-blue
  // frames (7.3 m), its door facing west at both levels.
  //
  // Not drawn: the bus terminal's shelters beside the hall, the advertising cases, the hall's
  // departure board. The gallery ends at the room before the lift, where the real one runs on
  // beside the tower to its east end. The network's tracks are about 2 m closer together than the
  // real ones at the west end, so the stair housing (about 4 m wide) and the gallery are narrower
  // and the gallery reaches out over the southern track's edge.
  'Islandstorget': {
    roof: {
      kind: 'butterfly',
      from: -57, to: -10, width: 7.0,
      shape: [[-57, 0.6, 7.0], [-40, 0.26, 7.4], [-20, 0.05, 7.95], [-10, 0.025, 8.08]],
      middle: 2.7, edge: 3.3, thick: 0.1, fascia: 0.12,
      rafters: 7.4, rafterAt: -53.5, rafterSize: [0.16, 0.3], deck: 'ribbedAcross', rafterColor: 0x475f74,
      beam: 0.2,
      purlins: { at: [-3.0, -2.0, -1.0, 1.0, 2.0, 3.0], size: [0.1, 0.12], color: 0xc4c8c9 },
      columns: { every: 7.4, at: -53.5, size: 0.18, plinth: { size: 0.34, height: 0.22 }, pair: 0.9, between: [-57, -10] },
      lamps: { offset: 0.9, length: 1.5, every: 3.0, at: [-0.9, 0.9], tube: true },
      colors: { underside: 0xd3d6d6, fascia: 0xb9bdbf, top: 0xc6cccb, steel: 0x475f74 },
      signs: { at: [-27.6], back: 'Blackebergsvägen', ahead: '', bottom: 2.3 },
      // (trains keep left: out of town on the southern track)
      boards: [
        { s: -50.5, u: 1.8, toward: 'Hässelby', trains: ['19 Hässelby strand  4 min', '19 Hässelby strand  14 min'] },
        { s: -50.5, u: -1.8, toward: 'T-Centralen', trains: ['19 Hagsätra  2 min', '19 Hagsätra  12 min'] },
      ],
    },
    roofs: [
      // its east part, the covering pale blue
      {
        kind: 'butterfly',
        from: -10, to: 46, width: 8.08,
        shape: [[-10, 0.025, 8.08], [0, 0.0, 8.2], [20, 0.1, 8.1], [40, 0.25, 7.8], [46, 0.33, 7.65]],
        middle: 2.7, edge: 3.3, thick: 0.1, fascia: 0.12,
        rafters: 7.4, rafterAt: -53.5, rafterSize: [0.16, 0.3], deck: 'ribbedAcross', rafterColor: 0x475f74,
        beam: 0.2,
        purlins: { at: [-3.0, -2.0, -1.0, 1.0, 2.0, 3.0], size: [0.1, 0.12], color: 0xc4c8c9 },
        columns: { every: 7.4, at: -53.5, size: 0.18, plinth: { size: 0.34, height: 0.22 }, pair: 0.9, between: [-10, 46] },
        lamps: { offset: 0.9, length: 1.5, every: 3.0, at: [-0.9, 0.9], tube: true },
        colors: { underside: 0xd3d6d6, fascia: 0xb9bdbf, top: 0x9eb6ca, steel: 0x475f74 },
        signs: { at: [9.4, 31.6], back: 'Blackebergsvägen', ahead: '', bottom: 2.3 },
        clocks: [[16.8, 0.1]],
      },
    ],
    paving: {
      edge: 0.8, tactile: [0.8, 1.15], slabs: 1.15, paverSize: [0.5, 0.5],
      colors: { edge: 0xd9d8d3, tactile: 0x3e4043, slab: 0x8a8a8c, pavers: 0x838385, face: 0x8e8b85 },
      pattern: 'grid',
    },
    buildings: ['r6544643'],
    rooms: [
      // (the hall's floors are open to its ceiling; the walls round them are its block's)
      { name: 'hall', s: [-97, -80], u: [-4.5, 5.5], h: [3, 4.5], walls: null, floor: 'darkTerrazzo', ceiling: 'whitePanels', lamps: 3.2 },
      { name: 'stairs', s: [-80, -67.2], u: [-1.5, 1.85], h: [-0.5, 4.5], walls: 'whitePanels', stairs: 'whitePanels', floor: 'darkTerrazzo', ceiling: 'ribbedMetal' },
      // (the gallery's walls are its block's)
      { name: 'gallery', s: [-80.5, -57], u: [-2, 5], h: [3, 4.5], walls: null, floor: 'greyTiles', ceiling: 'whitePanels', slab: 0.25 },
      { name: 'platform', s: [-69, -55], h: [-0.5, 1], walls: null, floor: null },
    ],
    blocks: [
      // the hall's core, its roof falling from the front to the back, and the canopy over the front,
      // white under its dark edge (a block of its own: eaves as deep as that on one side only would
      // tilt the roof's slab less than the ceiling under it, and hang it below the ceiling)
      { name: 'hall', plan: [[-94.9, 5.0], [-80.0, 5.0], [-80.0, -4.0], [-94.9, -4.0]], h: [3.3, 7.4], from: 3.5, low: 6.75,
        walls: 'greyPanels', sides: [undefined, 'glazed', undefined, 'glassFront'], floor: 'darkTerrazzo', ceiling: 'whitePanels',
        roof: 0.3, roofColor: 0x2e3134, eaves: 0.15, ground: true,
        nameSign: { side: 3, at: 0.5, length: 6.0, bottom: 5.85 } },
      { name: 'canopy', plan: [[-96.2, -4.15], [-95.05, -4.15], [-95.05, 5.15], [-96.2, 5.15]], h: [7.4, 7.4], from: 7.4,
        walls: 'greyPanels', sides: [null, null, null, null], ceiling: 'whitePanels', roof: 0.3, roofColor: 0x2e3134 },
      // the kiosk on its north side, and the white wing on its south side
      { name: 'kiosk', plan: [[-94.6, -4.0], [-81.0, -4.0], [-81.0, -7.0], [-94.6, -7.0]], h: [3.3, 6.0], from: 3.5,
        walls: 'whiteRender', sides: [null, undefined, undefined, 'shutter'], roof: 0.2, roofColor: 0x5f6266, ground: true },
      { name: 'south wing', plan: [[-95.0, 5.0], [-80.5, 5.0], [-80.5, 8.0], [-95.0, 8.0]], h: [3.3, 6.05], from: 3.5,
        walls: 'whiteRender', sides: [null, undefined, undefined, undefined], roof: 0.2, roofColor: 0x5f6266, ground: true },
      // the glass screens along the roof's back edge
      { name: 'screens', plan: [[-80.55, -3.5], [-80.25, -3.5], [-80.25, 4.5], [-80.55, 4.5]], h: [7.05, 10.0], from: 7.05,
        walls: 'glazed', roof: 0.05, roofColor: 0x8a8f93 },
      // the ticket booth inside the hall, and the glass beside the gates
      { name: 'booth', plan: [[-92.8, 3.0], [-87.8, 3.0], [-87.8, 4.85], [-92.8, 4.85]], h: [3.5, 6.0], from: 3.5,
        walls: 'greyGlazed', sides: [undefined, undefined, null, undefined], roof: 0.05, roofColor: 0x8a8f93 },
      { name: 'gate line', plan: [[-87.65, -3.85], [-87.35, -3.85], [-87.35, -1.4], [-87.65, -1.4]], h: [3.5, 4.6], from: 3.5, walls: 'glazed' },
      // the housing over the stairs, its roof falling with them to the doors at their foot
      { name: 'stair housing', plan: [[-80.0, -1.0], [-80.0, 1.85], [-67.4, 1.85], [-67.4, -1.0]], h: [-0.3, 6.1], lowBack: 3.2,
        walls: 'cladding', sides: [null, undefined, 'glassFront', undefined], ceiling: 'ribbedMetal', roof: 0.15, roofColor: 0x3a3d40, onPlatform: true },
      // the gallery beside it at the hall's level, out to the lift tower, and the room between
      // them before the lift's door (the real gallery runs on beside the tower to its east end)
      { name: 'gallery', plan: [[-80.0, 1.9], [-61.05, 1.9], [-61.05, 4.6], [-80.0, 4.6]], h: [3.2, 6.15], from: 3.5,
        walls: 'greyClerestory', sides: [undefined, undefined, undefined, null], floor: 'greyTiles', ceiling: 'whitePanels', roof: 0.15, roofColor: 0x3a3d40 },
      { name: 'before the lift', plan: [[-64.0, -1.9], [-61.05, -1.9], [-61.05, 1.9], [-64.0, 1.9]], h: [3.2, 6.25], from: 3.5,
        walls: 'greyClerestory', sides: [undefined, undefined, null, undefined], floor: 'greyTiles', ceiling: 'whitePanels', roof: 0.15, roofColor: 0x3a3d40 },
      // (their undersides over the platform pale, not the floors' dark slabs)
      { name: 'under the gallery', plan: [[-80.0, 1.9], [-61.05, 1.9], [-61.05, 4.6], [-80.0, 4.6]], h: [3.21, 3.21], from: 3.21,
        walls: 'greyPanels', sides: [null, null, null, null], ceiling: 'whitePanels' },
      { name: 'under the room before the lift', plan: [[-64.0, -1.9], [-61.05, -1.9], [-61.05, 1.9], [-64.0, 1.9]], h: [3.21, 3.21], from: 3.21,
        walls: 'greyPanels', sides: [null, null, null, null], ceiling: 'whitePanels' },
      { name: 'lift tower', plan: [[-61.0, -1.9], [-57.2, -1.9], [-57.2, 1.0], [-61.0, 1.0]], h: [0, 7.15], from: 0.3,
        walls: 'slateGlazed', roof: 0.1, roofColor: 0x475f74, onPlatform: true },
    ],
    art: [
      { kind: 'roundel', s: -93.6, u: 4.6, h: 9.0, size: 1.1, foot: 7.7, along: true },
      { kind: 'masts', height: 4.1, color: 0x9ea3a6, top: false, arm: 0.45, shade: 0x2f3133, at: [[48, -0.6], [65, 0.6]] },
    ],
    benches: [{ at: [-27.6, -20.2, 9.4, 24.2], wood: true }, { at: [56], double: true, wood: true }],
    fences: [
      // glass along the roof's middle between some of its frames
      { kind: 'glass', points: [[-51.6, 0.49], [-48.0, 0.42]], h: [0.1, 2.1] },
      { kind: 'glass', points: [[-44.2, 0.34], [-40.6, 0.27]], h: [0.1, 2.1] },
      { kind: 'glass', points: [[-36.8, 0.23], [-33.2, 0.19]], h: [0.1, 2.1] },
      { kind: 'glass', points: [[-7.2, 0.02], [-3.6, 0.01]], h: [0.1, 2.1] },
      { kind: 'glass', points: [[0.2, 0.0], [3.8, 0.02]], h: [0.1, 2.1] },
      // 2.6 m beyond each track
      { points: [[-66, -6.2], [-52, -6.95], [-40, -7.3], [-20, -7.8], [0, -8.0], [20, -7.8], [40, -7.5], [60, -6.7], [78, -5.8]], h: [-1.6, 0.6] },
      { kind: 'rails', color: 0x1c1d1e, points: [[-62, 8.0], [-40, 7.8], [0, 8.0], [40, 8.0], [78, 8.3]], h: [-0.9, 0.2] },
      // the railing across the platform's east end
      { kind: 'bars', points: [[76, -1.7], [76, 4.0]], h: [0, 1.8] },
    ],
  },

  // Blackeberg (26 October 1952): an island platform 145 m long, its south-eastern part covered,
  // under Vinjegatan's deck, the ticket hall and Blackebergs torg, its north-western part open in
  // a rock cutting. The covered part, the hall's vault over it and the window from the hall into it
  // are the network's (HALL_STYLES); this is the rest. Lantmäteriet's laser scan puts a butterfly
  // roof over the open part's first 61 m, from 1.7 m past the deck's face, 8.4 m wide where it
  // starts and 7 m where it ends, its top 3.6–3.8 m over the platform at the eaves and 3.3–3.5 m
  // at the valley; and two masts beyond it, 5 m high. Photographs (2018) show the roof's underside
  // of pale ribbed sheet, the ribs across, on white-painted steel beams cantilevered from pairs of
  // posts down the middle, a dark grey fascia, blue name signs (SL's, over a yellow stripe); grey
  // square tiles, a few darker, a white edge and a dark ribbed strip; wooden benches; galvanised
  // masts with two lamps on a short arm.
  //
  // The ticket hall (Peter Celsing, 1952; blue-marked by Stadsmuseet) is at Vinjegatan's level,
  // 4.1 m over the platform, a square about 22 m a side spanning the tracks, under a shallow
  // groin vault of board-marked concrete springing from the square's level (7.7 m) at its corners
  // (laser scan: the vault's top 13.0 m over the platform, the arches' bands 11.6–11.7 m at the
  // sides' middles); a lunette glazed in white steel frames under the arch on each side, over a
  // white fascia. Under the fascia board-marked concrete walls, the shops (a kiosk, NetQ) along the
  // back, the doors through to Vinjegatan, the lift up to the square in the north-eastern wall; a
  // double stair along the front wall up to a landing at the doors to Blackebergs torg, over the
  // window into the platform's vault; the gates (OpenStreetMap's indoor mapping), the black box of
  // the lift down to the platform beside them, the stairs down to the platform beyond them; a pale
  // grey stone floor. On Vinjegatan, the hall's back is a single storey of shop fronts (a café, the
  // station's two doors under the dark blue band, the kiosk) under a board-marked parapet, the
  // terrace on top at the square's level; the round T on the parapet by the eastern door, and on a
  // tall pole on the square by the front doors. On the square, by the lunette to the north-east, a
  // glazed lift house under a flat white roof.
  //
  // Not drawn: the fountains on the square (Erik Glemme and Sture Andersson's, 1955), the shops'
  // own signs and goods, the hall's pendant lamps, the dark polished panels in the floor round the
  // gates. The stair down to the platform is laid out from OpenStreetMap's (its top in the hall,
  // its foot under the deck), with a landing under the shops.
  'Blackeberg': {
    roof: {
      kind: 'butterfly',
      from: -8, to: 53, width: 8.4,
      shape: [[-8, -1.25, 8.4], [10, -0.3, 8.2], [30, 1.2, 7.6], [53, 3.6, 7.0]],
      middle: 3.15, edge: 3.45, thick: 0.2, fascia: 0.3,
      rafters: 6.0, rafterAt: -5, rafterSize: [0.12, 0.3], deck: 'ribbedAcross', rafterColor: 0xdcdcd8,
      beam: 0.4,
      columns: { every: 6.0, at: -5, size: 0.18, plinth: { size: 0.3, height: 0.12 }, pair: 0.8, between: [-8, 53] },
      lamps: { offset: 1.3, length: 1.5, every: 3.0 },
      colors: { underside: 0xcdcfce, fascia: 0x4a4d50, top: 0x55585b, steel: 0x4a4d50 },
      signs: { at: [7, 37], back: 'Utgång', ahead: '', bottom: 2.4, blue: true },
      clocks: [[19, 0.3]],
      // (trains keep left: into town on the north-eastern track)
      boards: [
        { s: 1, u: 0.95, toward: 'Farsta · Hagsätra · Skarpnäck', trains: ['19 Hagsätra  4 min', '18 Farsta strand  9 min'] },
        { s: 1, u: -2.65, toward: 'Hässelby', trains: ['18 Hässelby strand  6 min', '19 Hässelby strand  11 min'] },
      ],
    },
    paving: {
      edge: 0.35, tactile: [0.35, 0.7], slabs: 0.7, paverSize: [0.4, 0.4], mix: 0.15,
      colors: { edge: 0xd6d4ce, tactile: 0x3e4043, slab: 0xa9a7a3, pavers: 0xa9a7a3, paler: 0x7c7a77, face: 0x8a8781 },
      pattern: 'grid',
    },
    buildings: ['w48875847'],
    rooms: [
      // the double stair along the hall's front wall, solid, with concrete parapets
      { name: 'double stair', s: [-51.6, -47.9], u: [-11.5, 10.6], h: [3.9, 8.6], walls: 'boardConcrete', stairs: 'terrazzo', floor: 'terrazzo', parapet: 1.0 },
      // (the hall's floors are open to its vault; the walls round them are its block's)
      { name: 'hall', s: [-50.5, -28.1], u: [-11.5, 10.6], h: [3.9, 8.6], walls: null, floor: 'terrazzo' },
      { name: 'passages to Vinjegatan', s: [-28.9, -21], u: [-16, 17], h: [3.5, 7], walls: 'boardConcrete', floor: 'terrazzo', ceiling: 'whitePanels' },
      { name: 'stairs to the platform', s: [-34, -18], u: [-4.5, 1.0], h: [-0.5, 3.9], walls: 'yellowTiles', stairs: 'terrazzo', floor: 'terrazzo', ceiling: 'boardConcrete' },
      { name: 'square', s: [-60, -30], u: [10.6, 20], h: [7, 9], walls: null, floor: 'pavers' },
      { name: 'platform', s: [-61, -12], h: [-0.5, 1], walls: null, floor: null },
    ],
    blocks: [
      // the hall: its walls to the fascia, the vault over them, the network's vault running on
      // under the square through the arch in the front wall
      { name: 'hall', plan: [[-50.5, -11.5], [-50.5, 10.6], [-28.0, 9.7], [-28.3, -11.2]], h: [4.07, 7.7], from: 4.07,
        walls: 'boardConcrete', sides: [undefined, undefined, 'shopWindows', undefined], band: { walls: 'whiteRender', from: 7.4 },
        floor: 'terrazzo', roofColor: 0x4c4844, ground: true,
        arch: { side: 0, span: [1.335, 18.375], spring: 3.35, crown: 6.6 },
        dome: { spring: 7.7, arch: 11.15, crown: 12.5, thick: 0.5, beam: 0.5, frames: 1.2, frame: 0xe8e8e4 } },
      // the stairwell on the platform, round the flights up to the hall, open towards the
      // platform's open end (under the network's flat ceiling, no roof of its own)
      { name: 'stairwell', plan: [[-33.4, -3.85], [-18.9, -3.85], [-18.9, 0.45], [-33.4, 0.45]], h: [0, 3.35], from: 0,
        walls: 'yellowTiles', sides: [undefined, null, undefined, undefined], onPlatform: true, inHall: true },
      // the deck's edge, where it reaches out past the end of the network's ceiling over the
      // platform and the north-eastern track (whose tunnel ends 3 m short of it, the ceiling 2 m
      // further back over that half): its underside, at the ceiling's height, its face over the
      // cutting, and its top, at the street's level, where the network's cutting begins under it
      { name: 'deck edge', plan: [[-13.6, -17], [-10.06, -17], [-10.53, -1.6], [-13.6, -1.6]], h: [3.35, 3.82], from: 3.35,
        walls: 'boardConcrete', sides: [null, undefined, null, null], floor: 'boardConcrete', roof: 0.04, roofColor: 0x8c8a86 },
      { name: 'deck edge', plan: [[-15.6, -1.6], [-10.53, -1.6], [-10.97, 14], [-15.6, 14]], h: [3.35, 3.82], from: 3.35,
        walls: 'boardConcrete', sides: [null, undefined, null, null], floor: 'boardConcrete', roof: 0.04, roofColor: 0x8c8a86 },
      // the landing's parapet
      { name: 'landing parapet', plan: [[-48.28, -4.0], [-48.08, -4.0], [-48.08, 2.5], [-48.28, 2.5]], h: [7.3, 8.7], from: 7.3, walls: 'boardConcrete', roof: 0.05, roofColor: 0x8a8680 },
      // the box of the lift down to the platform, by the gates
      { name: 'lift box', plan: [[-40.35, -1.15], [-37.75, -1.15], [-37.75, 1.35], [-40.35, 1.35]], h: [4.07, 7.3], from: 4.07,
        walls: 'liftWindows', sides: [undefined, undefined, undefined, null], roof: 0.1, roofColor: 0x1e1f20 },
      // the shops between the hall and Vinjegatan, the terrace on them at the square's level
      { name: 'shops', plan: [[-28.3, -15.35], [-22.62, -15.35], [-23.29, 16.83], [-28.0, 16.83]], h: [3.9, 7.7], from: 4.0,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], roof: 0.3, roofColor: 0x8c8984, ground: true },
      // their front on Vinjegatan, under the parapet: a café, the western doors, the kiosk, the
      // eastern doors, a white wall
      { name: 'café', plan: [[-22.62, -15.35], [-22.22, -15.35], [-22.313, -10.9], [-22.713, -10.9]], h: [3.9, 8.7], from: 4.0,
        walls: 'shopWindows', sides: [null, undefined, null, null], band: { walls: 'boardConcrete', from: 7.1 }, roof: 0.1, roofColor: 0x8c8984 },
      { name: 'western doors', plan: [[-22.713, -10.9], [-22.313, -10.9], [-22.356, -8.1], [-22.756, -8.1]], h: [3.9, 8.7], from: 4.0,
        walls: 'glassFront', sides: [null, undefined, null, null], band: { walls: 'boardConcrete', from: 7.1 }, roof: 0.1, roofColor: 0x8c8984,
        nameSign: { side: 1, at: 0.5, length: 2.4, bottom: 6.4 } },
      { name: 'kiosk', plan: [[-22.756, -8.1], [-22.356, -8.1], [-22.652, 5.4], [-23.052, 5.4]], h: [3.9, 8.7], from: 4.0,
        walls: 'shopWindows', sides: [null, undefined, null, null], band: { walls: 'boardConcrete', from: 7.1 }, roof: 0.1, roofColor: 0x8c8984 },
      { name: 'eastern doors', plan: [[-23.052, 5.4], [-22.652, 5.4], [-22.708, 8.2], [-23.108, 8.2]], h: [3.9, 8.7], from: 4.0,
        walls: 'glassFront', sides: [null, undefined, null, null], band: { walls: 'boardConcrete', from: 7.1 }, roof: 0.1, roofColor: 0x8c8984,
        nameSign: { side: 1, at: 0.5, length: 2.4, bottom: 6.4 } },
      { name: 'white wall', plan: [[-23.108, 8.2], [-22.708, 8.2], [-22.888, 16.83], [-23.288, 16.83]], h: [3.9, 8.7], from: 4.0,
        walls: 'whiteRender', sides: [null, undefined, null, null], band: { walls: 'boardConcrete', from: 7.1 }, roof: 0.1, roofColor: 0x8c8984 },
      // the lift house on the square, against the hall's north-eastern lunette
      { name: 'lift house', plan: [[-37.9, 10.3], [-35.3, 10.3], [-35.3, 12.5], [-37.9, 12.5]], h: [7.8, 10.5], from: 7.8,
        walls: 'glazed', sides: [null, undefined, undefined, undefined], roof: 0.25, roofColor: 0xd4d4d0, eaves: 0.45 },
    ],
    art: [
      { kind: 'roundel', s: -22.3, u: 8.9, h: 7.95, size: 0.9, foot: 7.45, along: true },
      { kind: 'roundel', s: -53.0, u: 3.6, h: 12.1, size: 0.8, foot: 7.7, along: true },
      { kind: 'masts', height: 4.9, color: 0x9ea3a6, top: false, arm: 0.45, shade: 0x8a8e90, at: [[56.8, 4.1], [73.5, 6.1]] },
    ],
    benches: [{ at: [-1, 13, 25, 43], wood: true }],
  },

  // Råcksta (26 October 1952): an island platform in the open on a bank between the P-house to
  // the west and Vattenfall's old offices to the east, on a long curve, the viaduct over
  // Bergslagsvägen at its south end and the bridge over Jämtlandsgatan at its north. Lantmäteriet's
  // laser scan puts a flat-looking roof over the northern 44 m of the platform, from 24 m to 68 m
  // north of the middle, 8.1 m wide and covering the whole platform, its top 3.3 m over the
  // platform along a shallow valley down its middle and 3.6–3.8 m at its edges; seven masts along
  // the open part (lamps 4.2 m up) and the kiosk 30 m south of the middle (3.2 m). Photographs
  // (2006, 2018) show the roof dark: a deep near-black fascia, dark ribbed steel underneath with
  // the ribs across, carried on pairs of slate-blue steel posts along the platform's eastern edge
  // with cross-bracing between them, the roof cantilevered west over the rest; strip lights, black
  // name signs hung from it, the departure boards across under it (into town on the eastern
  // track), a round clock at its south end, a glass shelter with posters at its ends; galvanised
  // masts with two white bell lamps on a short arm, some with the black name sign; a kiosk of
  // green enamelled panels with a window under a curved white roof; grey square slabs, a white
  // edge and a dark ribbed strip; chain-link fences beyond both tracks.
  //
  // At the north end, between the tracks on the bridge, the stairs go down (OpenStreetMap's
  // indoor mapping: from 69 m to 86 m north of the middle) to the passage under the eastern track
  // and the ticket hall on Råcksta torg at Jämtlandsgatan's level, 6.45 m below the platform
  // (laser scan: the street 17.1–17.2 m, the hall's roof 20.6 m). The stairs' walls, the passage
  // and the hall are tiled with Mia Göransson's glazed tiles, pale with relief tiles pressed with
  // leaves scattered over them; a housing with a roof sloping down with the stairs, from 2.85 m
  // over the platform to 0.4 m at their foot (laser scan), glazed under its frame, with
  // perforated steel over the tiles outside it; along its west side a walkway at the platform's
  // level behind a perforated screen 2.5 m high to the lift down to the passage (OpenStreetMap:
  // the lift 90 m north). The hall: a glazed ticket booth, the gates (OpenStreetMap: 90 m north,
  // 3.3 m east), white panelled ceiling, grey terrazzo; its front on the square a strip of glass
  // doors under the dark band with the station's name and a concrete slab projecting over it,
  // the kiosk ("Råcksta kiosk") beside the doors (OpenStreetMap's outline and entrance; photographs).
  //
  // Not drawn: the bicycle racks and the trees on the square, the bins and the sand box on the
  // platform, the hall's own departure board, the P-house's deck beside the tracks. The network's
  // tracks run about a metre east of the real ones along the platform, and keep 10.6 m apart north
  // of it where the real ones close to 9.7 m, so the stairs' housing is a little narrower between
  // them than the real one.
  'Råcksta': {
    roof: {
      kind: 'butterfly',
      from: 23, to: 67.5, width: 8.1, offset: -0.2,
      middle: 2.78, edge: 3.15, thick: 0.65, fascia: 0.65,
      rafters: 1.5, rafterAt: 24.5, rafterSize: [0.1, 0.22], deck: 'ribbedAcross', rafterColor: 0x30343a,
      beam: 0.3,
      columns: { every: 6.3, at: 26.15, size: 0.2, plinth: { size: 0.42, height: 0.15 }, pair: 1.0, offset: 2.7, cross: [2.45, 0.3], ties: [1.9, 2.3] },
      lamps: { offset: 1.5, length: 1.5, every: 3.0, at: [-1.9, 0.9] },
      colors: { underside: 0x3d4149, fascia: 0x202327, top: 0x767d90, steel: 0x3d4a5e },
      signs: { at: [33, 58], back: '', ahead: 'Jämtlandsgatan', bottom: 2.3 },
      clocks: [[24.6, 1.6]],
      // (trains keep left: into town on the eastern track)
      boards: [
        { s: 43, u: 2.0, toward: 'T-Centralen', trains: ['19 Hagsätra  1 min', '18 Farsta strand  7 min'] },
        { s: 43, u: -2.4, toward: 'Hässelby', trains: ['18 Hässelby strand  6 min', '19 Hässelby strand  11 min'] },
      ],
    },
    paving: {
      edge: 0.6, tactile: [0.6, 0.95], slabs: 0.95, paverSize: [0.35, 0.35],
      colors: { edge: 0xd8d6d0, tactile: 0x3a3c3f, slab: 0xa9a8a4, pavers: 0xa3a29e, face: 0x8e8b85 },
      pattern: 'grid',
    },
    shelters: [{ s: [38, 46], u: [0.3, 1.9] }],
    benches: { at: [-47, -14, 2, 19] },
    buildings: ['w425935045'],
    rooms: [
      { name: 'platform', s: [55, 72], h: [-0.5, 1], walls: null, floor: null },
      // the stairs down between the tracks, open under the housing's roof
      { name: 'stairs', s: [68, 87.5], u: [-5.6, -0.8], h: [-6.6, 3], walls: 'goranssonTiles', stairs: 'goranssonTiles', floor: 'darkTerrazzo', parapet: 1.0 },
      { name: 'walkway', s: [68, 92], u: [-7.5, -2], h: [-0.5, 1], walls: null, floor: 'pavers' },
      // (its ceiling as high as the hall's, 3.13 m, so the two meet at the gates with no slit between)
      { name: 'passage', s: [85.5, 92], u: [-6.5, 3.6], h: [-7, -3.2], walls: 'goranssonTiles', floor: 'darkTerrazzo', ceiling: 'whitePanels' },
      // (the hall's floors are open to its ceiling; the walls round them are its blocks')
      { name: 'hall', s: [78, 95], u: [2.5, 13], h: [-7, -3], walls: null, floor: 'terrazzo', ceiling: 'whitePanels', lamps: 2.9 },
      { name: 'square', s: [90, 100], u: [8, 16], h: [-7, -5], walls: null, floor: 'pavers' },
    ],
    blocks: [
      // the deck between the tracks' bridges north of the platform, which the walkway and the
      // stairs' housing stand on, its face to each track
      { name: 'deck, west', plan: [[72, -7.2], [72, -5.45], [92, -5.45], [92, -8.8]], h: [-1.5, -0.05], from: -0.05,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'boardConcrete' },
      { name: 'deck, east', plan: [[72, -1.05], [72, 0.25], [87, -0.85], [87, -1.05]], h: [-1.5, -0.05], from: -0.05,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'boardConcrete' },
      { name: 'deck, north', plan: [[87, -5.45], [87, -1.05], [92, -1.3], [92, -5.45]], h: [-1.5, -0.05], from: -0.05,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'boardConcrete' },
      // the housing over the stairs: its two walls, Göransson's tiles outside as in with perforated
      // steel above them, their foot falling with the roof, and the glazed roof over them falling
      // with the flights, glass in steel frames (as three blocks, since a block's band is drawn
      // across an open side too: the housing is open towards the platform)
      { name: "stair housing's west wall", plan: [[68.5, -5.4], [87.0, -5.4], [87.0, -5.2], [68.5, -5.2]], h: [-6.6, 2.85], from: -6.45, low: 0.4,
        walls: 'goranssonTiles', band: { walls: 'silverPerforated', from: 1.0, low: -3.2 } },
      { name: "stair housing's east wall", plan: [[68.5, -1.3], [87.0, -1.3], [87.0, -1.1], [68.5, -1.1]], h: [-6.6, 2.85], from: -6.45, low: 0.4,
        walls: 'goranssonTiles', band: { walls: 'silverPerforated', from: 1.0, low: -3.2 } },
      { name: "stair housing's roof", plan: [[68.5, -5.4], [87.0, -5.4], [87.0, -1.1], [68.5, -1.1]], h: [2.85, 2.85], from: 2.85, low: 0.4,
        walls: 'goranssonTiles', sides: [null, null, null, null], ceiling: 'glazed' },
      // the screen along the walkway's west side, and across its north end to the lift
      { name: 'walkway screen', plan: [[72.0, -6.9], [91.2, -6.9], [91.2, -6.7], [72.0, -6.7]], h: [0, 2.5], from: 0,
        walls: 'silverPerforated', roof: 0.02, roofColor: 0x8a8f93 },
      { name: 'walkway screen, north', plan: [[91.2, -6.9], [91.4, -6.9], [91.4, -4.6], [91.2, -4.6]], h: [0, 2.5], from: 0,
        walls: 'silverPerforated', roof: 0.02, roofColor: 0x8a8f93 },
      // the ticket hall at the street's level: the doors on the square under the slab, the kiosk
      // beside them under the same slab, concrete towards Jämtlandsgatan, the tiles inside
      { name: 'hall, by the doors', plan: [[88.6, 3.7], [93.4, 2.9], [94.5, 8.9], [89.5, 10.17]], h: [-7.0, -3.3], from: -6.45,
        walls: 'goranssonTiles', sides: [undefined, 'boardConcrete', 'blackFront', null], floor: 'terrazzo', ceiling: 'whitePanels',
        roof: 0.25, roofColor: 0xc6ccce, eaves: [0, 0, 1.5, 0], ground: true,
        nameSign: { side: 2, at: 0.5, length: 3.6, bottom: -4.1, black: true } },
      { name: 'hall, by the kiosk', plan: [[78.7, 4.6], [88.6, 3.7], [89.5, 10.17], [81.5, 12.2]], h: [-7.0, -3.3], from: -6.45,
        walls: 'goranssonTiles', sides: [undefined, null, 'shopWindows', 'boardConcrete'], floor: 'terrazzo', ceiling: 'whitePanels',
        roof: 0.25, roofColor: 0xc6ccce, eaves: [0, 0, 1.5, 0], ground: true },
      // the ticket booth in the hall's north-west corner, by the gates
      { name: 'booth', plan: [[90.4, 3.6], [93.2, 3.1], [93.4, 5.4], [90.6, 5.9]], h: [-6.45, -3.6], from: -6.45,
        walls: 'greyGlazed', roof: 0.05, roofColor: 0x8a8f93 },
      // the kiosk on the platform
      { name: 'kiosk', plan: [[-30.55, -1.55], [-28.45, -1.55], [-28.45, 0.55], [-30.55, 0.55]], h: [0, 2.95], from: 0.25,
        walls: 'greenBooth', roof: 0.15, roofColor: 0xdcdcd8, eaves: 0.25, onPlatform: true },
    ],
    art: [
      // the masts along the open part (laser scan), on the line down the platform's middle, the
      // black name sign on every other
      { kind: 'masts', height: 4.6, color: 0x9ea3a6, top: false, arm: 0.5, shade: 0xf2f2ee, at: [[-61.5, -2.3], [-25.5, -0.4], [9, -0.1]] },
      { kind: 'masts', height: 4.6, color: 0x9ea3a6, top: false, arm: 0.5, shade: 0xf2f2ee, sign: 3.0, at: [[-70.5, -2.95], [-41.5, -1.0], [-7.5, -0.08], [24.5, -0.38]] },
    ],
    // 2.6 m beyond each track
    fences: [
      { points: [[-70, 4.3], [-44, 6.5], [-25, 7.25], [-5, 7.55], [15, 7.45], [34, 6.9], [54, 6.0], [70, 4.6]], h: [-1.6, 0.5] },
      { points: [[-70, -8.1], [-62, -7.65], [-43, -7.15], [-24, -7.15], [-4, -7.45], [15, -8.0], [34, -8.8], [54, -9.95], [70, -11.2]], h: [-1.6, 0.5] },
    ],
  },

  // Vällingby (26 October 1952): two island platforms 143 m long side by side in a cutting through
  // the middle of Vällingby centrum, the turnback track between them, where no train stops, and
  // the outer tracks beyond them (trains keep left: into town on the north-eastern track, tracks
  // 3 and 4 on the north-eastern island, 1 and 2 on the south-western). Lantmäteriet's laser scan
  // has both islands' surface at 24.85–25.0 m and the three tracks' ballast at 23.6–23.75 m. Their
  // south-eastern 100 m are covered: from 72 m to 21 m south-east of the middle by Kirunaplan, the
  // bus terminal, on a deck 4.4–5.2 m over the platforms (a plane through the laser scan's points,
  // data/ground-corrections.json), and from there to 26.5 m north-west of the middle by the car
  // park's deck, 4.6–5.3 m over them, out to 35 m beyond the south-western track; the rest is in
  // the open under two butterfly roofs from 29.5 m to 73 m north-west of the middle, one over each
  // island, their undersides 3.1 m over the platform at the valley and 3.6 m at the edges.
  //
  // Under Kirunaplan the islands' columns are Casimir Djuric's concrete trees (1983), square, cast
  // with a bark of deep fissures, some grey and some stained red-brown; under the car park's deck
  // they are round, pink to 2.75 m and white above. The walls beyond the outer tracks are a
  // mosaic of small dark green tiles with posters in pairs in white frames; under the car park's
  // deck the south-western side is open to the street beyond the track, behind a pale railing, and
  // Helén Partos's Sirat (2010) hangs along it, lace cut out of rusty steel plate. The open roofs
  // (photographs, 2006 to 2026): dark ribbed steel underneath, the ribs across, on dark steel
  // columns down each island's middle, a grey fascia, strip lights, black name signs; grey square
  // slabs, a white edge and a dark strip for the blind.
  //
  // At the south-eastern end (OpenStreetMap's indoor mapping) escalators and stairs and a lift
  // climb from each island's end, out between the tracks, to the ticket hall under Vällingby
  // centrum (1954), 4.67 m over the platforms, the gates at the flights' tops either side of the
  // corridor in from Kirunaplan's doors; the hall reaches through the building to Vällingby torg
  // at its south-eastern end, and passages lead off it to the streets either side. The centrum's
  // buildings round it: shop fronts under a canopy's white edge, pale corrugated sheet metal, a
  // ribbon of windows in white frames, 8 m high (laser scan). At the north-western end stairs go
  // down from each island, in houses glazed in grey frames with a lift beside each, to the hall
  // under the tracks at Bräckegatan's level, 4.6 m below the platforms, tiled in a check of white
  // and pale blue-grey, the gates at its middle and its doors under the bridge over the street.
  //
  // Not drawn: the cars and buses on the decks, Kirunaplan's shelters, the bicycle racks, the
  // centrum's signs and its upper storeys beyond the station, the glass partitions round the gates
  // in the south-eastern hall, the hall's shops and kiosks.
  'Vällingby': {
    roof: {
      kind: 'butterfly',
      from: 29.5, to: 73, width: 8.6,
      shape: [[29.5, -0.1, 8.6], [50, 0.2, 8.6], [73, 0.8, 8.6]],
      middle: 3.12, edge: 3.62, thick: 0.25, fascia: 0.35,
      rafters: 1.2, rafterSize: [0.06, 0.15], deck: 'ribbedAcross', rafterColor: 0x34383c,
      beam: 0.45,
      columns: { every: 9.6, at: 35, size: 0.3, plinth: { size: 0.4, height: 0.1 } },
      lamps: { offset: 2.4, length: 1.5, every: 3.0 },
      colors: { underside: 0x4a4f54, fascia: 0x6e7477, top: 0x5d7a68, steel: 0x2e3236 },
      signs: { at: [40, 59], back: 'Vällingbyplan', ahead: 'Bräckegatan' },
      clocks: [[49.4, 0]],
      // (into town on the north-eastern track)
      boards: [{ s: 68.5, u: 2.0, toward: 'Hagsätra', trains: ['19 Hagsätra  4 min', '19 Hagsätra  14 min'] }],
    },
    roofs: [
      // the south-western island's, as the north-eastern's
      {
        kind: 'butterfly',
        from: 29.5, to: 73, width: 8.2,
        shape: [[29.5, -9.48, 8.2], [50, -9.17, 8.2], [73, -8.6, 8.2]],
        middle: 3.12, edge: 3.62, thick: 0.25, fascia: 0.35,
        rafters: 1.2, rafterSize: [0.06, 0.15], deck: 'ribbedAcross', rafterColor: 0x34383c,
        beam: 0.45,
        columns: { every: 9.6, at: 35, size: 0.3, plinth: { size: 0.4, height: 0.1 } },
        lamps: { offset: 2.4, length: 1.5, every: 3.0 },
        colors: { underside: 0x4a4f54, fascia: 0x6e7477, top: 0x5d7a68, steel: 0x2e3236 },
        signs: { at: [40, 59], back: 'Vällingbyplan', ahead: 'Bräckegatan' },
        clocks: [[49.4, 0]],
        boards: [{ s: 68.5, u: -2.0, toward: 'Hässelby strand', trains: ['19 Hässelby strand  3 min', '19 Hässelby strand  13 min'] }],
      },
      // under the decks, over each island, only the lamps, signs, boards and clocks hung from the
      // ceiling (the roof itself just over the ceiling blocks, hidden)
      {
        kind: 'butterfly',
        from: -71.4, to: 28.5, width: 7.4,
        shape: [[-71.4, 0, 7.4], [28.5, -0.1, 7.4]],
        middle: 3.53, edge: 3.53, thick: 0.03, fascia: 0.02,
        rafters: 40, rafterSize: [0.01, 0.01], beam: 0.01,
        columns: { every: 9.6, at: 500, size: 0.3, plinth: { size: 0.4, height: 0.1 }, between: [500, 501] },
        lamps: { offset: 2.2, length: 1.5, every: 4.2 },
        colors: { underside: 0x8f8b84, fascia: 0x8f8b84, top: 0x8f8b84, steel: 0x8f8b84 },
        signs: { at: [-47, -15, 17], back: 'Vällingbyplan', ahead: 'Bräckegatan' },
        clocks: [[-23, 0]],
        boards: [{ s: -39, u: 2.0, toward: 'Hagsätra', trains: ['19 Hagsätra  4 min', '19 Hagsätra  14 min'] }],
      },
      {
        kind: 'butterfly',
        from: -71.4, to: 28.5, width: 6,
        shape: [[-71.4, -9.35, 6], [-40, -9.75, 6], [0, -10.2, 6], [28.5, -10.25, 6]],
        middle: 3.53, edge: 3.53, thick: 0.03, fascia: 0.02,
        rafters: 40, rafterSize: [0.01, 0.01], beam: 0.01,
        columns: { every: 9.6, at: 500, size: 0.3, plinth: { size: 0.4, height: 0.1 }, between: [500, 501] },
        lamps: { offset: 1.8, length: 1.5, every: 4.2 },
        colors: { underside: 0x8f8b84, fascia: 0x8f8b84, top: 0x8f8b84, steel: 0x8f8b84 },
        signs: { at: [-47, -7, 17], back: 'Vällingbyplan', ahead: 'Bräckegatan' },
        clocks: [[-23, 0]],
        boards: [{ s: -39, u: -1.6, toward: 'Hässelby strand', trains: ['19 Hässelby strand  3 min', '19 Hässelby strand  13 min'] }],
      },
    ],
    paving: {
      edge: 0.3, tactile: [0.3, 0.9], slabs: 0.9, paverSize: [0.3, 0.3], mix: 0.2,
      colors: { edge: 0xdedbd2, tactile: 0x5d5f60, slab: 0x8e8a83, pavers: 0x8e8a83, paler: 0x9b978f, face: 0x8a8781 },
      pattern: 'grid',
    },
    benches: [
      { at: [39.8, 49.4, 59] },
      { at: [39.8, 49.4, 59], roof: 0 },
      { at: [-63, -47, -31, -7, 9], double: true, wood: true, roof: 1 },
      { at: [-63, -47, -31, -7, 9], double: true, wood: true, roof: 2 },
    ],
    buildings: ['w35963800', 'w425935044'],
    rooms: [
      // the passages off the south-eastern hall to the streets either side, through the centrum
      { name: 'passage, south-west', s: [-95, -88], u: [-30, -16], h: [4, 5.5], walls: 'navyTiles', floor: 'paleTiles', ceiling: 'whitePanels' },
      { name: 'passage, north-east', s: [-95, -88], u: [13, 31], h: [4, 5.5], walls: 'navyTiles', floor: 'paleTiles', ceiling: 'whitePanels' },
      // the escalators, stairs and lifts up from the islands' south-eastern ends, out between the
      // tracks, open to the hall over them
      { name: 'south-eastern flights', s: [-82, -70], u: [-9, 9], h: [-0.5, 0.5], walls: null, floor: 'greyTiles', stairs: 'checkTiles', parapet: 1.1 },
      // (the hall's floors are open to its ceiling, the walls round them its blocks')
      { name: 'south-eastern hall', s: [-112, -70], h: [4, 5.5], walls: null, floor: 'paleTiles', lamps: 3.4 },
      // the platforms' north-western ends, out to the stair houses and the lifts
      { name: 'north-western ends', s: [70, 90], h: [-0.5, 0.5], walls: null, floor: 'orangeTiles' },
      // the stairs down in the glazed houses, and the passages on under the tracks
      { name: 'north-western stairs', s: [70, 88.2], h: [-5, 0.5], walls: 'checkTiles', floor: 'orangeTiles', stairs: 'checkTiles', ceiling: 'whitePanels', sill: 1.0, parapet: 1.0 },
      { name: 'north-western hall', s: [88.2, 98.4], h: [-5, -4], walls: null, floor: 'orangeTiles' },
      // out of its doors, under the bridge on Bräckegatan
      { name: 'Bräckegatan', s: [98.4, 106], h: [-5, -4], walls: null, floor: 'asphalt' },
    ],
    blocks: [
      // Kirunaplan's deck over the tracks (the city's ground is the deck's plane, but falls into the
      // tracks' cutting between its walls): asphalt, its top 3 cm over the plane
      { name: 'Kirunaplan', plan: [[-21, -50], [-71.8, -50], [-71.8, 32], [-21, 32]], h: [5.0, 5.123], low: 4.968, from: 5.0, fall: 4.024,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.25, roofColor: 0x4f5153 },
      // and the deck under the centrum's south-eastern front and Vällingby torg beyond it
      { name: 'Vällingby torg', plan: [[-111.6, -21], [-122, -21], [-122, 21], [-111.6, 21]], h: [4.37, 4.62], from: 4.37,
        walls: 'boardConcrete', sides: [null, null, null, null], roof: 0.03, roofColor: 0x8d8a84 },
      // the ceilings under the decks, over the platforms and the tracks
      { name: "Kirunaplan's ceiling", plan: [[-21, -13], [-71.8, -13], [-71.8, 13], [-21, 13]], h: [3.49, 3.5], from: 3.49,
        walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete' },
      { name: "the car park's ceiling", plan: [[26.5, -35.4], [-21, -35.4], [-21, 14.6], [26.5, 14.6]], h: [3.49, 3.5], from: 3.49,
        walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'whiteRender' },
      { name: "the centrum's ceiling", plan: [[-71.8, -13], [-122, -13], [-122, 13], [-71.8, 13]], h: [3.49, 3.5], from: 3.49,
        walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete' },
      // the car park's deck north-west of Kirunaplan, falling from its south-western edge to its
      // north-eastern (laser scan)
      { name: "car park's deck", plan: [[26.5, -35.4], [-21, -35.4], [-21, 14.6], [26.5, 14.6]], h: [3.5, 5.0], lowBack: 4.4, from: 3.5,
        walls: 'boardConcrete', sides: ['boardConcrete', null, 'boardConcrete', 'boardConcrete'], roof: 0.3, roofColor: 0x6f7173 },
      // the walls beyond the outer tracks under the decks: the mosaic towards the tracks
      { name: 'wall, north-east', plan: [[-71.8, 12.7], [26.5, 12.7], [26.5, 12.9], [-71.8, 12.9]], h: [-1.2, 3.5], from: -1.2,
        walls: 'boardConcrete', sides: ['mosaicPosters', null, 'boardConcrete', null] },
      { name: 'wall, south-west', plan: [[-21, -12.25], [-71.8, -11.55], [-71.8, -11.75], [-21, -12.45]], h: [-1.2, 3.5], from: -1.2,
        walls: 'boardConcrete', sides: ['mosaicPosters', null, null, null] },
      // (the network's cutting walls stand up through the decks and the hall's floor along their
      // edges: cut away over the decks)
      { name: 'cut, north-east', plan: [[-28, 12.5], [-28, 13.4], [-71.8, 13.4], [-71.8, 12.5]], h: [5.59, 7], from: 5.59, fall: 5.456,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      { name: 'cut, south-west', plan: [[-28, -13.2], [-28, -11.4], [-71.8, -11.4], [-71.8, -13.2]], h: [5.895, 7], from: 5.895, fall: 5.761,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      { name: 'cut, centrum north-east', plan: [[-71.8, 10.8], [-71.8, 13.4], [-115, 13.4], [-115, 10.8]], h: [5.7, 6.5], from: 5.7,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      { name: 'cut, centrum south-west', plan: [[-71.8, -11.8], [-71.8, -9.8], [-100, -9.8], [-100, -11.8]], h: [5.7, 6.5], from: 5.7,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      // Vällingby centrum over the tracks: its two wings either side of the hall, and its front on
      // Vällingby torg (OpenStreetMap's outline; the laser scan's roofs, 8 m over Kirunaplan)
      { name: "centrum's south-western wing", plan: [[-71.8, -29.1], [-71.8, -17.5], [-111.6, -17.5], [-111.6, -28.3]], h: [4.67, 12.7], from: 4.67,
        walls: 'vallingbyCentrum', roof: 0.3, roofColor: 0xb9bcbd },
      { name: "centrum's north-eastern wing", plan: [[-71.8, 14], [-71.8, 29.8], [-110.6, 30.5], [-111.6, 14]], h: [4.67, 12.7], from: 4.67,
        walls: 'vallingbyCentrum', roof: 0.3, roofColor: 0xb9bcbd },
      { name: "centrum's front", plan: [[-105.5, -17.5], [-105.5, 14], [-111.6, 14], [-111.6, -17.5]], h: [4.67, 12.7], from: 4.67,
        walls: 'vallingbyCentrum', sides: ['vallingbyCentrum', null, 'vallingbyCentrum', null], roof: 0.3, roofColor: 0xb9bcbd,
        nameSign: { side: 2, at: 0.32, length: 4, bottom: 7.95 } },
      // the ticket hall between them, its front on Kirunaplan
      { name: 'ticket hall', plan: [[-71.8, -17.5], [-71.8, 14], [-105.5, 14], [-105.5, -17.5]], h: [4.67, 9.3], from: 4.67,
        walls: 'navyTiles', sides: ['vallingbyCentrum', null, null, null], floor: 'paleTiles', ceiling: 'ribbedMetal', roof: 0.2, roofColor: 0x8d949a },
      // its doors on Kirunaplan, under the canopy along the centrum's front there
      { name: 'doors', plan: [[-71.7, -3.5], [-71.7, 3.5], [-71.9, 3.5], [-71.9, -3.5]], h: [4.67, 8.3], from: 4.67,
        walls: 'glassFront', sides: ['glassFront', null, 'glassFront', null], nameSign: { side: 0, at: 0.5, length: 4, bottom: 7.02 } },
      { name: 'canopy', plan: [[-68.5, -29], [-71.8, -29], [-71.8, 30], [-68.5, 30]], h: [8.3, 8.3], from: 8.3,
        walls: 'whiteRender', sides: [null, null, null, null], ceiling: 'whiteRender', roof: 0.25, roofColor: 0xe8e8e3 },
      // the stair houses at the north-western end, glazed in grey frames, their roofs falling a
      // little towards the platforms
      { name: 'stair house, south-west', plan: [[73.5, -7.0], [73.5, -2.45], [89.5, -2.45], [89.5, -7.0]], h: [0, 3.15], low: 2.65, from: 0,
        walls: 'greyGlazed', floor: 'orangeTiles', roof: 0.12, roofColor: 0x5d6064 },
      { name: 'stair house, north-east', plan: [[73.5, 7.05], [73.5, 2.0], [89.5, 2.0], [89.5, 7.05]], h: [0, 3.15], low: 2.85, from: 0,
        walls: 'greyGlazed', floor: 'orangeTiles', roof: 0.12, roofColor: 0x5d6064 },
      // the hall under the tracks: its doors under the bridge on Bräckegatan, the name over them
      // on the bridge's face (and cut out of the network's bridge deck over it)
      { name: 'hall under the tracks', plan: [[88.3, -7.2], [98.4, -7.2], [98.4, 7.2], [88.3, 7.2]], h: [-4.6, -2.3], from: -4.6,
        walls: 'checkTiles', sides: [undefined, 'glassFront', undefined, null], floor: 'orangeTiles', ceiling: 'whitePanels', ground: true, onPlatform: true,
        nameSign: { side: 1, at: 0.5, length: 3.6, bottom: -2.25, black: true } },
      // the abutments round it under the tracks' decks
      { name: 'abutment', plan: [[77, -11.1], [88.3, -11.1], [88.3, 11.1], [77, 11.1]], h: [-4.8, -2.7], from: -4.8, walls: 'boardConcrete' },
      { name: 'abutment, south-west', plan: [[88.3, -11.1], [98.4, -11.1], [98.4, -7.3], [88.3, -7.3]], h: [-4.8, -2.7], from: -4.8, walls: 'boardConcrete' },
      { name: 'abutment, north-east', plan: [[88.3, 7.3], [98.4, 7.3], [98.4, 11.1], [88.3, 11.1]], h: [-4.8, -2.7], from: -4.8, walls: 'boardConcrete' },
      // the street under the car park's deck beyond the south-western track, at the platforms' level
      // (laser scan, past the deck's edge: 24.6–24.8 m)
      { name: 'street under the car park', plan: [[26.5, -35.4], [-21, -35.4], [-21, -13.2], [26.5, -13.2]], h: [-0.15, 1.0], from: -0.15,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'asphalt', ground: true },
      // (the tunnels' portals beyond the centrum's south-eastern front, stood up through Vällingby torg)
      { name: 'cut, Vällingby torg', plan: [[-104, -14], [-104, 14], [-126, 14], [-126, -14]], h: [5.67, 12], from: 5.67,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      // the car park's lower storey beside the south-western track, north-west of the deck
      { name: 'car park', plan: [[29, -31.1], [88.1, -31.1], [88.1, -14.5], [29, -14.5]], h: [-1.2, 2.9], from: -0.5,
        walls: 'boardConcrete', roof: 0.3, roofColor: 0x77797a },
    ],
    art: [
      // Casimir Djuric's trees under Kirunaplan, down each island's middle
      { kind: 'capitals', tiles: 'barkGrey', size: 0.65, from: 0, flare: 3.5, head: 0.65, ceiling: 3.5,
        at: [[-67, 4.7], [-51, 4.7], [-43, 4.7], [-27, 4.7], [-67, -4.6], [-59, -4.8], [-43, -5.05], [-35, -5.15]] },
      { kind: 'capitals', tiles: 'barkRed', size: 0.65, from: 0, flare: 3.5, head: 0.65, ceiling: 3.5,
        at: [[-59, 4.7], [-35, 4.7], [-51, -4.95], [-27, -5.2]] },
      // the round columns under the car park's deck, pink, white over 2.75 m
      { kind: 'columns', from: 0, to: 2.75, size: 0.8, color: 0xd99a8c,
        at: [[-19, 4.7], [-11, 4.7], [-3, 4.7], [5, 4.7], [13, 4.7], [21, 4.7], [-19, -5.3], [-11, -5.4], [-3, -5.45], [5, -5.55], [13, -5.6], [21, -5.6]] },
      { kind: 'columns', from: 2.75, to: 3.5, size: 0.8, color: 0xefede8,
        at: [[-19, 4.7], [-11, 4.7], [-3, 4.7], [5, 4.7], [13, 4.7], [21, 4.7], [-19, -5.3], [-11, -5.4], [-3, -5.45], [5, -5.55], [13, -5.6], [21, -5.6]] },
      // the car park deck's columns beyond the south-western track, and under it by the street
      { kind: 'columns', from: -0.6, to: 3.5, size: 0.45, color: 0x8f8d88,
        at: [[-18.45, -12.8], [-17.55, -12.8], [-6.45, -12.8], [-5.55, -12.8], [5.55, -12.8], [6.45, -12.8], [17.55, -12.8], [18.45, -12.8]] },
      { kind: 'columns', from: -0.2, to: 3.5, size: 0.45, color: 0x8f8d88,
        at: [[-18, -23.5], [-6, -23.5], [6, -23.5], [18, -23.5], [-18, -34], [-6, -34], [6, -34], [18, -34]] },
      // Helén Partos's Sirat, hung along the railing beyond the south-western track
      { kind: 'mural', picture: 'sirat', s: -11, u: -12.75, turn: Math.PI / 2, bottom: -0.3, top: 2.4, width: 2.6 },
      { kind: 'mural', picture: 'sirat', s: 0, u: -12.75, turn: Math.PI / 2, bottom: -0.3, top: 2.4, width: 2.6 },
      { kind: 'mural', picture: 'sirat', s: 13, u: -12.75, turn: Math.PI / 2, bottom: -0.3, top: 2.4, width: 2.6 },
      { kind: 'mural', picture: 'sirat', s: 23, u: -12.75, turn: Math.PI / 2, bottom: -0.3, top: 2.4, width: 2.6 },
      // the columns under the canopy along the centrum's front on Kirunaplan
      { kind: 'columns', from: 4.6, to: 8.3, size: 0.22, color: 0xe8e8e3,
        at: [[-69, -27], [-69, -19.5], [-69, -12], [-69, -4.5], [-69, 4.5], [-69, 12], [-69, 19.5], [-69, 27]] },
    ],
    fences: [
      // the railing between the south-western track and the street under the car park's deck
      { points: [[-21, -12.85], [26.5, -12.85]], h: [-0.2, 1.3], kind: 'bars', color: 0xd9dbd8 },
      // round the car park's deck
      { points: [[-21, -35.4], [26.5, -35.4]], h: [5.3, 6.35], kind: 'bars', color: 0x9ea3a6 },
      { points: [[26.5, -35.4], [26.5, 14.6, -0.6]], h: [5.3, 6.35], kind: 'bars', color: 0x9ea3a6 },
      { points: [[26.5, 14.6], [-21, 14.6]], h: [4.7, 5.75], kind: 'bars', color: 0x9ea3a6 },
      // chain-link beyond the outer tracks in the open
      { points: [[26.5, 12.6], [50, 12.4], [78, 11.6]], h: [-1.3, 0.5] },
      { points: [[29, -12.9], [50, -12.6], [73, -11.9]], h: [-1.3, 0.5] },
      // the car park's roof along the tracks
      { points: [[29, -14.5], [88.1, -14.5]], h: [3.2, 4.2], kind: 'rails', color: 0x9ea3a6 },
    ],
  },

  // Johannelund (1 November 1956), in Vinsta: built as an "industristation" for the works around
  // it, open only at the rush hours and shut at weekends until October 1997, and the only station
  // on the network with two side platforms rather than an island between the tracks; it has no
  // art. The platforms are on a bank, 5 m over the forecourt to the north and the slope to the
  // south. Lantmäteriet's laser scan puts a butterfly roof over the middle 30 m of each, the
  // northern one 9.3 m wide (its valley 3.0 m over the platform, its eaves 3.45 m over the track
  // and 3.2 m at the back) and the southern one 7.5 m wide (its valley 2.9 m, its eaves 3.2 m and
  // 3.4 m); the platforms reach out under them to the roofs' back edges. Photographs (2006 to 2023):
  // dark ribbed sheet underneath, the ribs across, on dark green steel rafters, a green fascia,
  // the covering pale grey corrugated sheet; columns in pairs across each platform along the
  // valley, dark green, a plate between each pair with a round hole through it; black name signs,
  // a clock, a departure board; dark asphalt, a pale edge and a dark strip for the blind; along
  // the northern roof's back a wall of glass in dark green frames, wired glass beside the stairs,
  // along the southern roof's back dark green bars; galvanised masts with a white lamp on a crook
  // out on the open ends, dark green chain-link along the platforms' backs.
  //
  // At the back of each platform, from the roof's middle (OpenStreetMap's indoor mapping), stairs
  // go down eastwards in an open well behind a parapet of ochre tiles with a green railing, to a
  // passage under the tracks at the forecourt's level (laser scan: 5.2 m under the platforms); a
  // room with an orange door closes each well's end, and beyond the roofs' east ends a lift tower
  // glazed in green frames stands on each platform, its doors facing west on the platform and east
  // below. The ticket hall is at the passage's north end, under the northern platform's edge:
  // ochre tiles, dark green ones dripping down from the top, white panels overhead, the gates, the
  // doors out to the forecourt facing north under SL's dark blue band, cream tiles outside.
  //
  // Not drawn: the steps from the forecourt up to the path along the bank, the ticket booth, the
  // posters and the hall's louvred windows, the work on Förbifart Stockholm's tunnels beside the
  // station. The network has the tracks 1.4 m further apart than they are, so the southern roof,
  // its stairs and its lift are 1.4 m south of where they stand, with the platform.
  'Johannelund': {
    // the northern platform's roof (the line it follows is that platform's)
    roof: {
      kind: 'butterfly',
      from: -5.5, to: 24.5, width: 9.3, offset: -2.27,
      middle: 2.8, edge: 3.15, thick: 0.2, fascia: 0.25,
      rafters: 2.4, rafterAt: 10, rafterSize: [0.08, 0.22], deck: 'ribbedAcross', rafterColor: 0x24392e,
      beam: 0.3,
      columns: { every: 7.2, at: 10, size: 0.16, plinth: { size: 0.2, height: 0.03 }, pair: 1.0, offset: -0.3, between: [-5, 22],
        portal: { spring: 1.0, crown: 1.0, top: 2.2, hole: { at: 1.6, r: 0.33 } } },
      lamps: { offset: 2.4, length: 1.2, every: 2.4, at: [-2.6, 2.2] },
      colors: { underside: 0x484d4c, fascia: 0x2f5446, top: 0xa9aeb2, steel: 0x24392e },
      signs: { at: [-0.8, 13.6], back: '', ahead: 'Siktgatan' },
      clocks: [[3.6, 2.4]],
      // (trains keep left: into town on the northern track)
      boards: [{ s: 7.6, u: 2.6, toward: 'T-Centralen', trains: ['19 Hagsätra  2 min', '18 Farsta strand  6 min'] }],
    },
    // the southern platform's, following the northern platform's line 11.5 to 11.8 m to its right
    roofs: [{
      kind: 'butterfly',
      from: -5.5, to: 24.5, width: 7.5,
      shape: [[-5.5, 13.18, 7.5], [10, 12.95, 7.5], [24.5, 12.85, 7.5]],
      middle: 2.7, edge: 3.1, thick: 0.2, fascia: 0.25,
      rafters: 2.4, rafterAt: 10, rafterSize: [0.08, 0.22], deck: 'ribbedAcross', rafterColor: 0x24392e,
      beam: 0.3,
      columns: { every: 7.2, at: 10, size: 0.16, plinth: { size: 0.2, height: 0.03 }, pair: 1.0, offset: -1.25, between: [-5, 22],
        portal: { spring: 1.0, crown: 1.0, top: 2.2, hole: { at: 1.6, r: 0.33 } } },
      lamps: { offset: 2.0, length: 1.2, every: 2.4, at: [-2.0, 1.6] },
      colors: { underside: 0x484d4c, fascia: 0x2f5446, top: 0xa9aeb2, steel: 0x24392e },
      signs: { at: [-0.8, 13.6], back: '', ahead: 'Siktgatan' },
      clocks: [[3.6, -2.2]],
      boards: [{ s: 7.6, u: -2.2, toward: 'Hässelby', trains: ['18 Hässelby strand  9 min', '19 Hässelby strand  11 min'] }],
    }],
    paving: {
      edge: 0.55, tactile: [0.55, 0.9], slabs: 0.9,
      colors: { edge: 0xd2d0c9, tactile: 0x46484a, slab: 0x5d5c5a, pavers: 0x5d5c5a, face: 0xa9a59d },
      pattern: 'asphalt',
    },
    buildings: ['w436256428', 'w436256430'],
    rooms: [
      { name: 'platform', s: [-6, 25], h: [-0.5, 0.5], walls: null, floor: null },
      // (the wells' walls rise to the platform, their flights open overhead)
      { name: 'northern stairs', s: [10, 25.3], u: [-12.4, -9], h: [-5.6, 0.5], walls: 'yellowTiles', stairs: 'yellowTiles', floor: 'terrazzo', ceiling: 'whitePanels', sill: 0 },
      { name: 'southern stairs', s: [10, 25.3], u: [7.5, 11.2], h: [-5.6, 0.5], walls: 'yellowTiles', stairs: 'yellowTiles', floor: 'terrazzo', ceiling: 'whitePanels', sill: 0 },
      { name: 'hall', s: [24, 36], u: [-13, -7], h: [-5.6, -4], walls: 'dripTiles', floor: 'terrazzo', ceiling: 'whitePanels' },
      { name: 'passage', s: [22, 36], u: [-7, 12], h: [-5.6, -4], walls: 'yellowTiles', floor: 'terrazzo', ceiling: 'whitePanels' },
    ],
    blocks: [
      // the platforms' floors out to the roofs' backs, and beside the wells
      { name: 'northern floor', plan: [[-5.5, -12.55], [10.5, -12.55], [10.5, -8.05], [-5.5, -8.06]], h: [-0.6, 0], from: 0,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'asphalt' },
      { name: 'northern floor beside the well', plan: [[10.5, -9.05], [22.7, -9.05], [22.7, -7.99], [10.5, -8.05]], h: [-0.6, 0], from: 0,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'asphalt' },
      { name: 'northern floor behind the well', plan: [[10.5, -12.55], [22.7, -12.55], [22.7, -12.2], [10.5, -12.2]], h: [-0.6, 0], from: 0,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'asphalt' },
      { name: 'northern floor by the lift', plan: [[24.5, -8.9], [35, -8.9], [35, -7.92], [24.5, -7.97]], h: [-0.6, 0], from: 0,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'asphalt' },
      { name: 'southern floor', plan: [[-5.5, 8.15], [10.5, 7.95], [10.5, 10.85], [-5.5, 10.85]], h: [-0.6, 0], from: 0,
        walls: 'boardConcrete', sides: [null, null, null, null], floor: 'asphalt' },
      // the northern roof's back: glass in green frames over concrete down to the path along the
      // bank, wired glass beside the stairs
      { name: 'northern glass wall', plan: [[-5.5, -12.7], [10.5, -12.7], [10.5, -12.55], [-5.5, -12.55]], h: [-3.2, 3.1], from: 0,
        walls: 'greenGlazed', roof: 0.05, roofColor: 0x24392e },
      { name: 'northern wired glass', plan: [[10.5, -12.7], [22.7, -12.7], [22.7, -12.55], [10.5, -12.55]], h: [-3.2, 3.1], from: 0,
        walls: 'wiredGlazed', roof: 0.05, roofColor: 0x24392e },
      // the southern well's outer wall below the platform, to the slope
      { name: 'southern wall', plan: [[-5.5, 10.85], [31.5, 10.85], [31.5, 11.05], [-5.5, 11.05]], h: [-5.6, 0], from: 0,
        walls: 'boardConcrete' },
      // the parapets along the wells, ochre tiles under a green cap
      { name: 'northern parapet', plan: [[10.5, -9.2], [22.7, -9.2], [22.7, -9.05], [10.5, -9.05]], h: [0, 1.0], from: 0,
        walls: 'yellowTiles', roof: 0.04, roofColor: 0x24392e },
      { name: 'southern parapet', plan: [[10.5, 7.85], [22.7, 7.85], [22.7, 8.0], [10.5, 8.0]], h: [0, 1.0], from: 0,
        walls: 'yellowTiles', roof: 0.04, roofColor: 0x24392e },
      // the rooms closing the wells' east ends, their doors facing the stairs
      { name: 'northern room', plan: [[22.7, -12.7], [24.5, -12.7], [24.5, -9.05], [22.7, -9.05]], h: [-5.6, 2.85], from: 0,
        walls: 'yellowTiles', sides: [undefined, undefined, undefined, 'ochreDoor'], roof: 0.05, roofColor: 0x24392e },
      { name: 'southern room', plan: [[22.7, 7.85], [24.5, 7.85], [24.5, 11.05], [22.7, 11.05]], h: [-5.6, 2.75], from: 0,
        walls: 'yellowTiles', sides: [undefined, undefined, undefined, 'ochreDoor'], roof: 0.05, roofColor: 0x24392e },
      // the lift towers beyond the roofs' east ends
      { name: 'northern lift tower', plan: [[25.0, -8.65], [27.6, -8.65], [27.6, -6.15], [25.0, -6.15]], h: [0, 3.9], from: 0.05,
        walls: 'greenGlazed', roof: 0.12, roofColor: 0x24392e, onPlatform: true },
      { name: 'southern lift tower', plan: [[25.0, 5.35], [27.6, 5.35], [27.6, 7.85], [25.0, 7.85]], h: [0, 3.9], from: 0.05,
        walls: 'greenGlazed', roof: 0.12, roofColor: 0x24392e, onPlatform: true },
      // the ticket hall under the northern platform's edge: cream tiles outside, its doors in the
      // east end of its front
      { name: 'hall', plan: [[24.5, -12.2], [32.2, -12.2], [32.2, -8.9], [24.5, -8.9]], h: [-5.6, -1.7], from: -5.2,
        walls: 'creamTiles', sides: [undefined, null, null, undefined], ceiling: 'whitePanels', roof: 0.3, roofColor: 0x8e8b85, ground: true },
      { name: 'hall, by the doors', plan: [[32.2, -12.2], [35.0, -12.2], [35.0, -8.9], [32.2, -8.9]], h: [-5.6, -1.7], from: -5.2,
        walls: 'creamTiles', sides: ['circleFront', undefined, null, null], ceiling: 'whitePanels', roof: 0.3, roofColor: 0x8e8b85, ground: true,
        nameSign: { side: 0, at: 0.5, length: 2.6, bottom: -2.84 } },
    ],
    art: [
      // galvanised masts out on the open ends, the black name sign on some
      { kind: 'masts', height: 4.8, color: 0xa3a8ab, top: false, arm: 0.5, shade: 0xf2f2ee, at: [[-62, -5.7], [-26, -7.25], [60, -7.0], [-62, 9.85], [-26, 8.1], [60, 8.1]] },
      { kind: 'masts', height: 4.8, color: 0xa3a8ab, top: false, arm: 0.5, shade: 0xf2f2ee, sign: 2.6, at: [[-44, -6.65], [42, -7.2], [-44, 8.85], [42, 7.55]] },
    ],
    benches: [{ at: [-0.8, 6.4], wood: true }, { at: [-0.8, 6.4], wood: true, roof: 0 }],
    fences: [
      // dark green chain-link along the platforms' backs, and across the northern roof's west end (a
      // lighter green than it is: the mesh blurs to a solid band from afar, which in the real green
      // reads as a black wall)
      { points: [[-70, -5.87], [-60, -6.5], [-50, -7.05], [-40, -7.51], [-30, -7.85], [-20, -8.05], [-10, -8.15], [-5.5, -8.16]], h: [0, 2.2], color: 0x46644f },
      { points: [[-5.5, -8.16], [-5.5, -12.55]], h: [0, 3.0], color: 0x46644f },
      { points: [[24.5, -8.9], [35, -8.9], [37, -8.0], [40, -7.94], [50, -7.83], [60, -7.68], [69, -7.5]], h: [0, 2.2], color: 0x46644f },
      { points: [[-75, 11.2], [-69, 10.99], [-60, 10.41], [-50, 9.82], [-40, 9.32], [-30, 8.92], [-20, 8.6], [-10, 8.36], [-5.5, 8.27], [-5.5, 10.85]], h: [0, 2.2], color: 0x46644f },
      { points: [[24.5, 8.0], [30, 8.05], [40, 8.18], [50, 8.42], [60, 8.77], [68, 9.1]], h: [0, 2.2], color: 0x46644f },
      // the dark green bars along the southern roof's back, and the railings on the parapets
      { kind: 'bars', color: 0x24392e, points: [[-5.5, 10.75], [22.7, 10.75]], h: [0, 3.0] },
      { kind: 'bars', color: 0x24392e, points: [[10.5, -9.125], [22.7, -9.125]], h: [1.04, 1.3] },
      { kind: 'bars', color: 0x24392e, points: [[10.5, 7.925], [22.7, 7.925]], h: [1.04, 1.3] },
    ],
  },

  // Hässelby gård (1 November 1956), in the middle of Hässelby gård's centrum: an island platform
  // on a concrete viaduct over Hässelby torg at its west end and a road bridge over Astrakangatan
  // further east, the tracks curving south-westwards along it towards Hässelby strand. Lantmäteriet's
  // laser scan puts a butterfly roof over 68 m of it, from 15 m in from the platform's west end,
  // 12 m wide, its valley 3.9 m over the platform's top (the scan's, 0.35 m over the network's) and
  // its eaves 4.3 m on the northern side and 4.5 m on the southern, and two openings through the
  // platform's west end down to the ticket hall under the tracks, at the square's level (7.9 m
  // under the platform): a short one at the very end, where the lift tower stands, and a long one
  // further in for the escalator and the stairs. Photographs (2006 to 2018): the underside grey
  // corrugated sheet, the ribs across, on grey-blue steel beams across and purlins along, a dark
  // fascia, pairs of tapered grey-blue columns down the middle, strip lights along it; black name
  // signs hung from the roof, a departure board; the paving dark grey slabs since 2011, a ribbed
  // yellowish strip for the blind and a pale band along the edges; a glazed waiting room in dark
  // grey frames north of the columns, wooden benches; galvanised masts with two hat-shaped lamps on
  // a crossbar out on the open ends, black name signs on some, and galvanised railings with mesh
  // panels along the viaduct's edges.
  //
  // The openings are walled in board-marked concrete under black bar railings. The lift's tower,
  // glass in black steel frames on a concrete base, stands against the short opening's southern
  // side, its doors facing east into a small glass porch on the platform. Under the tracks, the
  // ticket hall faces the square westwards between the viaduct's piers: dark brown tiles, a glazed
  // front of steel-framed doors under SL's dark blue band with the name, and a flat concrete
  // canopy with a white edge in front of it. Inside (done again in 2012 by SL's architect Stefan
  // Hagdahl): a polished dark floor, a dark perforated ceiling, walls of green glass enamel, the
  // ticket booth, the gates and the lift's glass shaft beside them; past the gates, where the
  // escalator and the stairs come down, Pia Törnell's I ett nu (2012) covers the walls, the same
  // enamel perforated and lit from behind, the holes drawn into a point or flung out of it.
  //
  // Not drawn: the skylights from the openings into the hall, the ticket booth, the posters and
  // the machines, the white box of sand on the platform. The lift's shaft stands just past the
  // gates rather than in their line. The network has the platform 1.2 m south of where it is at
  // its west end, so the openings and the lift are drawn 1.2 m south of where they are, with it.
  'Hässelby gård': {
    roof: {
      kind: 'butterfly',
      from: -56.5, to: 11.5, width: 11.4, offset: -0.3,
      middle: 3.2, edge: 3.7, thick: 0.25, fascia: 0.3,
      rafters: 3.1, rafterAt: -53.4, rafterSize: [0.12, 0.3], deck: 'ribbedAcross', rafterColor: 0x6f7d88,
      purlins: { at: [-4, -2, 2, 4], size: [0.1, 0.2] },
      beam: 0.35,
      // (none over the long opening, which the beams span)
      columns: { every: 6.2, at: -53.4, size: 0.2, plinth: { size: 0.24, height: 0.03 }, pair: 1.4, gaps: [[-55, -38.5]] },
      lamps: { offset: 1.6, length: 1.2, every: 3.1, at: [-3, 3] },
      colors: { underside: 0x9aa2a6, fascia: 0x4a555c, top: 0xb6babb, steel: 0x6f7d88 },
      signs: { at: [-33, -8], back: 'Hässelby torg', ahead: '' },
      // (trains keep left: into town on the northern track)
      boards: [
        { s: -14, u: -2.4, toward: 'T-Centralen', trains: ['19 Hagsätra  3 min', '18 Farsta strand  7 min'] },
        { s: -14, u: 2.4, toward: 'Hässelby strand', trains: ['19 Hässelby strand  4 min', '18 Hässelby strand  10 min'] },
      ],
    },
    paving: {
      edge: 0.9, edgeTile: [0.9, 0.6], tactile: [0.9, 1.25], slabs: 1.25, pattern: 'bond', paverSize: [0.6, 0.4], mix: 0.2,
      colors: { edge: 0xbdbbb5, tactile: 0xb9b08c, slab: 0x56585b, pavers: 0x56585b, face: 0x8e8b85, paler: 0x5e6063 },
    },
    rooms: [
      { name: 'platform', s: [-70, 70], h: [-0.5, 0.5], walls: null, floor: null },
      // (the opening's walls rise to the platform, the flights open overhead)
      { name: 'stairs', s: [-53.5, -39], u: [-1, 3.5], h: [-8.5, 1], walls: 'greenEnamel', stairs: 'greenEnamel', floor: 'darkTerrazzo', sill: 0 },
      { name: 'paid area', s: [-61.6, -53], h: [-8.5, -4], walls: 'tornellEnamel', floor: 'darkTerrazzo', ceiling: 'perforated' },
      { name: 'hall', s: [-70.5, -61.6], h: [-8.5, -4], walls: 'greenEnamel', floor: 'darkTerrazzo', ceiling: 'perforated' },
    ],
    blocks: [
      // the short opening at the platform's west end, its walls down to the hall's roof, open
      // westwards under the platform's tip over the hall's canopy
      { name: 'lift opening', plan: [[-68.3, -1.35], [-58.75, -1.35], [-58.75, 4.65], [-68.3, 4.65]], h: [-3.6, 0.05], from: -2.6,
        walls: 'boardConcrete', sides: [undefined, undefined, undefined, null], onPlatform: true },
      // the gap between the two tracks' decks west of the platform's tip, over the hall's canopy
      // (the network lays one deck across under both tracks), the decks' inner faces either side
      { name: 'gap between the decks', plan: [[-95, -1.9], [-70.15, -2.4], [-70.15, 5.7], [-95, 5.9]], h: [-2.6, -1.55], from: -2.6,
        walls: 'boardConcrete', sides: [undefined, null, undefined, null], onPlatform: true },
      // the long one, round the escalator and the stairs (walled by their own parts)
      { name: 'stair opening', plan: [[-53.8, -0.55], [-39.6, -0.55], [-39.6, 3.05], [-53.8, 3.05]], h: [-7.92, 0.05], from: -7,
        walls: 'boardConcrete', sides: [null, null, null, null], onPlatform: true },
      // the lift's tower: concrete up from the hall's roof, glass in black frames over the platform,
      // open eastwards to the porch (in the hall the lift's own glass shaft)
      { name: 'lift tower', plan: [[-61.45, 2.1], [-58.75, 2.1], [-58.75, 4.6], [-61.45, 4.6]], h: [-3.6, 3.75], from: -3.6,
        walls: 'boardConcrete', sides: [undefined, null, undefined, undefined], band: { walls: 'darkGlazed', from: 0.05 }, roof: 0.15, roofColor: 0x2a2c2e, onPlatform: true },
      { name: 'lift porch', plan: [[-58.75, 1.85], [-56.2, 1.85], [-56.2, 4.95], [-58.75, 4.95]], h: [0, 2.7], from: 0.05,
        walls: 'darkGlazed', sides: [undefined, null, undefined, null], roof: 0.08, roofColor: 0x2a2c2e, onPlatform: true },
      // the waiting room, north of the columns
      { name: 'waiting room', plan: [[-26, -3.4], [-17, -3.4], [-17, -0.85], [-26, -0.85]], h: [0, 2.6], from: 0.02,
        walls: 'greyGlazed', roof: 0.1, roofColor: 0x3c4044, onPlatform: true },
      // the ticket hall under the tracks, between the city's blocks either side, facing the square
      // under its canopy: brown tiles beside the glazed front
      { name: 'hall, north', plan: [[-70, -9.1], [-53.7, -9.1], [-53.7, -4.6], [-70, -4.6]], h: [-8.5, -4.1], from: -7.92,
        walls: 'brownTiles', sides: [undefined, undefined, null, undefined], roof: 0.5, eaves: [0, 0, 0, 1.8], roofColor: 0xd9d9d4, ground: true },
      { name: 'hall', plan: [[-70, -4.6], [-53.7, -4.6], [-53.7, 6.6], [-70, 6.6]], h: [-8.5, -4.1], from: -7.92,
        walls: 'brownTiles', sides: [null, undefined, null, 'steelFront'], roof: 0.5, eaves: [0, 0, 0, 1.8], roofColor: 0xd9d9d4, ground: true,
        nameSign: { side: 3, at: 0.5, length: 4.4, bottom: -5.15 } },
      { name: 'hall, south', plan: [[-70, 6.6], [-53.7, 6.6], [-52.3, 12.15], [-70, 12.15]], h: [-8.5, -4.1], from: -7.92,
        walls: 'brownTiles', sides: [null, undefined, undefined, undefined], roof: 0.5, eaves: [0, 0, 0, 1.8], roofColor: 0xd9d9d4, ground: true },
      // the escalator's shaft east of the hall, under the viaduct
      { name: 'stair shaft', plan: [[-53.7, -1.0], [-39.6, -1.0], [-39.6, 3.5], [-53.7, 3.5]], h: [-8.5, -1.0], from: -7.92,
        walls: 'boardConcrete', ground: true },
    ],
    art: [
      // galvanised masts beside the short opening, and out on the open eastern end with the name
      { kind: 'masts', height: 4.9, color: 0xa3a8ab, top: false, arm: 0.45, shade: 0xf2f2ee, at: [[-63.5, -2.55], [-63.5, 5.8]] },
      { kind: 'masts', height: 5.0, color: 0xa3a8ab, top: false, arm: 0.45, shade: 0xf2f2ee, sign: 3.0, at: [[21, -0.15], [37.3, 0.05], [53.8, 0.55], [69.3, 1.5]] },
    ],
    benches: { at: [-31.7, -6.9, 5.5, 29, 45, 61], wood: true },
    fences: [
      // the railings along the viaduct's edges, mesh between galvanised posts
      { points: [[-72.6, -7.46], [-63.1, -7.68], [-53.5, -7.92], [-43.9, -8.18], [-34.3, -8.47], [-24.8, -8.76], [-15.2, -9.01], [-5.6, -9.18], [3.9, -9.2], [13.5, -9.04], [23.1, -8.71], [32.6, -8.22], [42.2, -7.58], [51.7, -6.82], [61.2, -5.88], [70.7, -4.8]], h: [-1.05, 0.3], color: 0x9aa0a4 },
      { points: [[-72.4, 10.79], [-62.8, 10.75], [-53.2, 10.65], [-43.6, 10.5], [-34.1, 10.27], [-24.5, 10], [-14.9, 9.7], [-5.3, 9.38], [4.3, 9.05], [13.8, 8.72], [23.4, 8.41], [33, 8.13], [42.6, 7.9], [52.2, 7.78], [61.7, 7.8], [71.3, 8.05]], h: [-1.05, 0.3], color: 0x9aa0a4 },
      // black bars round the short opening, beside the lift's tower, and along the long one
      { kind: 'bars', color: 0x1e1f21, points: [[-61.45, 4.65], [-68.3, 4.65], [-68.3, -1.35], [-58.75, -1.35], [-58.75, 2.1]], h: [0, 1.1] },
      { kind: 'bars', color: 0x1e1f21, points: [[-39.6, -0.55], [-53.8, -0.55], [-53.8, 3.05], [-39.6, 3.05]], h: [0, 1.1] },
    ],
  },

  // Hässelby strand (18 November 1958), the green line's western end: a wide island platform in
  // the open on an embankment between Maltesholmsvägen and Persikogatan, the tracks curving away
  // northwards past the end of its roof under a concrete footbridge. Lantmäteriet's laser scan puts
  // a butterfly roof over 80 m of it, from its south end, 11.2 m wide, its valley 2.9 m over the
  // platform and its eaves 3.35 m; beyond it at the south end a low box over the platform's whole
  // width, 2.6 m high, the top of a lift's shaft rising out of it to 3.8 m; south of that a roof
  // sloping from 1.3 m over the platform down to the 2015 building on Fyrspannsgatan, its flats
  // 12.4 m over the platform, whose ground floor holds the ticket hall at the street's level,
  // 5.07 m under the platform. Photographs (2009 to 2023): the roof's steel painted a deep red,
  // pairs of columns under a beam along each row, red beams across the pairs, light grey purlins
  // along it, the underside ribbed sheet metal, a thin red-brown fascia; strip lights in pairs;
  // black name signs hung from the beams, departure boards both ways for T-Centralen, a round
  // clock; the paving grey slabs in a bond, a dark ribbed strip for the blind, a pale edge. Down
  // the middle of the platform, between the pairs of columns, a long box walls in the ramp that
  // takes the place of stairs: white tiles to 1.15 m, windows in red frames above to the beams,
  // a glazed end facing north. Inside it, Christian Partos's Teleporteringar (2000): clouds of
  // small coloured tiles drifting over the white tiles of the ramp's walls, blurred along as if
  // in motion. The ramp runs straight down at 1 in 12 past the end of the roof and under the
  // box, coming out in a hall under the sloping roof, white tiles under a band of windows, a dark
  // stone floor; beside it on its west the lift's door between black and white tiles shifted
  // row by row and shimmering tiles above them, on its east stairs down from the box along the
  // wall, a strip of coloured tiles along their balustrade. South of the hall, through the
  // building's ground floor, the ticket hall (June 2015): dark polished stone, a dark slatted
  // ceiling, white tiles, a glazed ticket booth, glass gates, and a front of glass doors in
  // brushed steel under SL's dark blue band with the name, under the building's canopy. North of
  // the roof, the platform's open end: red masts with two hat-shaped lamps on a crossbar, black
  // name signs, wooden benches, the footbridge's board-marked concrete pier on it; a small dark
  // staff hut under the roof's last bay.
  //
  // The real platform is a metre west of the network's at its south end; the roof, the ramp and
  // the box are laid along the network's. Not drawn: the ticket booth, the machines and posters,
  // the yellow buffer stops (the network's tracks end where they end), the round artworks on the
  // ramp's mouth.
  'Hässelby strand': {
    roof: {
      kind: 'butterfly',
      from: -75.5, to: 4, width: 11.2,
      // (its middle the platform's, which the network's line through it swings away from)
      shape: [[-75.5, 0.56, 11.2], [-40, 0.43, 11.2], [-20, 0.32, 11.2], [4, -0.1, 11.2]],
      middle: 2.9, edge: 3.35, thick: 0.25, fascia: 0.3,
      rafters: 8, rafterAt: -71.5, rafterSize: [0.2, 0.4], deck: 'ribbedAcross', rafterColor: 0x6e2622,
      purlins: { at: [-4.6, -3.4, -2.2, -1.0, 1.0, 2.2, 3.4, 4.6], size: [0.08, 0.2], color: 0xaeb3b5 },
      beam: 0.35,
      // (a pair either side of the ramp's box)
      columns: { every: 8, at: -71.5, size: 0.2, plinth: { size: 0.4, height: 0.15 }, pair: 3.3, braces: 0.8 },
      lamps: { offset: 0.5, length: 1.2, every: 4, at: [-4.3, -0.5, 0.5, 4.3] },
      colors: { underside: 0xa9aeb1, fascia: 0x5a2420, top: 0xb9bcbc, steel: 0x6e2622 },
      signs: { at: [-60, -25, -5], back: 'Fyrspannsgatan', ahead: '' },
      clocks: [[2, 4.2]],
      boards: [
        { s: -12, u: -2.4, toward: 'T-Centralen', trains: ['19 Hagsätra  4 min', '17 Skarpnäck  9 min'] },
        { s: -12, u: 2.4, toward: 'T-Centralen', trains: ['18 Farsta strand  6 min', '19 Hagsätra  14 min'] },
      ],
    },
    paving: {
      edge: 0.6, tactile: [0.6, 1.0], slabs: 1.0, pattern: 'bond', paverSize: [0.6, 0.3], mix: 0.15,
      colors: { edge: 0xc4c2bc, tactile: 0x4a4b4d, slab: 0x8b8a86, pavers: 0x8b8a86, face: 0x9a978f, paler: 0x989690 },
    },
    rooms: [
      // (the balustrades of the stairs from the box down to the hall a metre high, the flights open
      // under the box's floor and the hall's roof)
      { name: 'stairs', s: [-96, -83], u: [4.4, 8.4], h: [-5.6, 0.5], walls: 'squareTiles', stairs: 'squareTiles', floor: 'darkStone', parapet: 1.0 },
      { name: 'box', s: [-86, -75.4], h: [-0.5, 0.5], walls: null, floor: 'darkStone' },
      // (the ramp's walls the mosaic up to the platform, the box's above it)
      { name: 'ramp', s: [-86, -30], u: [0, 4.6], h: [-5.6, 0.5], walls: 'partosTiles', floor: 'darkStone', ceiling: 'ribbedMetal', sill: 0, lamps: 2.3 },
      { name: 'stair hall', s: [-94.8, -86], h: [-5.6, 0.5], walls: 'squareTiles', floor: 'darkStone', lamps: 4.3 },
      { name: 'street', s: [-114, -110.7], h: [-5.6, -4], walls: null, floor: 'pavers' },
      { name: 'ticket hall', s: [-110.7, -94.4], h: [-5.6, -3], walls: 'squareTiles', floor: 'darkStone', ceiling: 'perforated' },
      { name: 'platform', s: [-80, 80], h: [-0.5, 0.5], walls: null, floor: null },
    ],
    blocks: [
      // the ramp's box down the middle of the platform, between the pairs of columns: white tiles,
      // windows in red frames above them, glazed across its northern end, open southwards into
      // the low box at the end of the roof
      { name: 'ramp', plan: [[-32.9, -0.42], [-32.9, 2.48], [-75.5, 4.03], [-75.5, 1.13]], h: [-0.6, 2.45], from: 0.02,
        walls: 'squareTiles', sides: ['glazed', undefined, null, undefined], band: { walls: 'maroonGlazed', from: 1.15 },
        roof: 0.1, roofColor: 0x9ea3a5, ceiling: 'ribbedMetal', onPlatform: true },
      // the low box over the platform's south end, the ramp running on under its floor, the lift
      // and the stairs going down from it; its south wall the hall's, below
      { name: 'box', plan: [[-75.5, -1.6], [-75.5, 8.3], [-86, 8.3], [-86, -1.6]], h: [-0.5, 2.5], from: 0,
        walls: 'greyGlazed', sides: [null, undefined, null, undefined], roof: 0.15, roofColor: 0xa9adad, floor: 'darkStone', ceiling: 'whitePanels', onPlatform: true },
      { name: 'box, south', plan: [[-86.2, -1.6], [-86, -1.6], [-86, 8.3], [-86.2, 8.3]], h: [1.1, 2.5], from: 1.1, walls: 'greyPanels' },
      // the hall's north wall, the lift's door in the black and white tiles, shimmering tiles
      // over them; the ramp's mouth and the stairs in Partos's mosaic beside it
      { name: 'hall, north, lift', plan: [[-86.2, -1.6], [-86, -1.6], [-86, 1.45], [-86.2, 1.45]], h: [-5.6, 1.1], from: -5.07,
        walls: 'cafeWall', band: { walls: 'iridescentTiles', from: -2.75 } },
      { name: 'hall, north', plan: [[-86.2, 1.45], [-86, 1.45], [-86, 8.3], [-86.2, 8.3]], h: [-5.6, 1.1], from: -5.07, walls: 'partosTiles' },
      // the hall under the sloping roof, a band of windows under it; the ticket hall's opening
      // in its south wall
      { name: 'stair hall', plan: [[-86, -1.6], [-94.8, -1.6], [-94.8, 8.3], [-86, 8.3]], h: [-5.6, 1.1], from: -5.07, low: -0.15,
        walls: 'squareTiles', sides: [undefined, undefined, undefined, null], band: { walls: 'darkGlazed', from: 0.4, low: -0.85 },
        roof: 0.25, roofColor: 0x8f9294, ceiling: 'ribbedMetal', ground: true },
      // the ticket hall through the building's ground floor, its glass front on Fyrspannsgatan
      // under the building's canopy
      { name: 'ticket hall', plan: [[-94.8, -1.6], [-110.6, -1.6], [-110.6, 8.2], [-94.8, 8.2]], h: [-5.6, -1.05], from: -5.07,
        walls: 'squareTiles', sides: [undefined, 'glassFront', undefined, null], nameSign: { side: 1, at: 0.47, length: 4.4, bottom: -2.72 }, ground: true },
      { name: 'canopy', plan: [[-112.5, -2.0], [-110.97, -2.0], [-110.2, 9.0], [-111.7, 9.0]], h: [-1.05, -0.85], from: -1.05,
        walls: 'whitePanels', roof: 0.08, roofColor: 0x5d6165, floor: 'whitePanels' },
      // the staff hut under the roof's last bay
      { name: 'hut', plan: [[-1.0, -1.3], [3.2, -1.3], [3.2, 2.4], [-1.0, 2.4]], h: [-0.3, 2.4], from: 0.02,
        walls: 'greyPanels', roof: 0.1, roofColor: 0x2f3133, onPlatform: true },
      // the footbridge over the platform north of the roof, board-marked concrete, rising
      // eastwards and down a long ramp beyond the tracks; its pier on the platform
      { name: 'footbridge, west', plan: [[17.05, -17], [20.45, -17], [20.45, -4], [17.05, -4]], h: [3.8, 4.7], from: 3.8, fall: 4.35,
        walls: 'boardConcrete', roof: 0.05, roofColor: 0x8c8a85, floor: 'boardConcrete' },
      { name: 'footbridge', plan: [[17.05, -4], [20.45, -4], [20.45, 28], [17.05, 28]], h: [4.35, 5.25], from: 4.35, fall: 5.35,
        walls: 'boardConcrete', roof: 0.05, roofColor: 0x8c8a85, floor: 'boardConcrete' },
      { name: 'footbridge, east', plan: [[17.05, 28], [20.45, 28], [20.45, 38], [17.05, 38]], h: [5.35, 6.25], from: 5.35, fall: 5.0,
        walls: 'boardConcrete', roof: 0.05, roofColor: 0x8c8a85, floor: 'boardConcrete' },
      { name: 'footbridge, ramp', plan: [[17.05, 38], [20.45, 38], [20.45, 64], [17.05, 64]], h: [5.0, 5.9], from: 5.0, fall: 2.0,
        walls: 'boardConcrete', roof: 0.05, roofColor: 0x8c8a85, floor: 'boardConcrete' },
      { name: 'footbridge pier', plan: [[17.6, -0.6], [19.9, -0.6], [19.9, 0.1], [17.6, 0.1]], h: [-0.5, 4.47], from: 0.02,
        walls: 'boardConcrete', onPlatform: true },
    ],
    art: [
      // red masts with two hat-shaped lamps on a crossbar out on the open northern end, the
      // station's name on some
      { kind: 'masts', height: 4.8, color: 0x6e2622, top: false, arm: 0.6, shade: 0x6e2622, sign: 3.0, at: [[11, -0.3], [42, -0.85]] },
      { kind: 'masts', height: 4.8, color: 0x6e2622, top: false, arm: 0.6, shade: 0x6e2622, at: [[27, -0.55], [57, -1.1]] },
    ],
    benches: { at: [7, 24, 35, 50], wood: true },
    fences: [
      // the railings along the footbridge's edges
      { kind: 'bars', color: 0x7d8285, points: [[17.15, -17, 4.8], [17.15, -4, 5.35], [17.15, 28, 6.35], [17.15, 38, 6.0], [17.15, 64, 3.0]], h: [0, 1.1] },
      { kind: 'bars', color: 0x7d8285, points: [[20.35, -17, 4.8], [20.35, -4, 5.35], [20.35, 28, 6.35], [20.35, 38, 6.0], [20.35, 64, 3.0]], h: [0, 1.1] },
      // the mesh fence along the western track, by the car park
      { points: [[-85, -9.3], [-60, -9.2], [-40, -9.1], [-20, -9.0], [0, -9.0]], h: [-0.4, 1.8], color: 0x9aa0a4 },
    ],
  },
  // Gärdet's halls are vaults (src/hall-styles.ts); its passages through the rock between them,
  // its escalators and halls in the rock. Finishes from Commons photos of the station: grey
  // striated concrete panels in the passages, white tiles with blue mosaic triangles at their ends,
  // red clinker underfoot; brick and pine boards in the halls up the escalators.
  'Gärdet': {
    rooms: [
      { name: 'openings onto the western platform', s: [-80, 80], u: [-9, -4.2], h: [-1, 0.5], walls: null, floor: null },
      { name: 'openings onto the eastern platform', s: [-80, 80], u: [4.2, 9], h: [-1, 0.5], walls: null, floor: null },
      { name: 'south-west end', s: [-76, -60], u: [-4.2, 4.2], h: [-1, 0.5], walls: 'striated', back: 'triangleTiles', stairs: 'squareTiles', floor: 'redClinker', ceiling: 'whiteRender' },
      { name: 'middle passage', s: [-3, 3], u: [-4.2, 4.2], h: [-1, 0.5], walls: 'striated', floor: 'redClinker', ceiling: 'whiteRender' },
      { name: 'north-east end', s: [60, 77], u: [-4.2, 4.2], h: [-1, 0.5], walls: 'triangleTiles', back: 'striated', stairs: 'squareTiles', floor: 'redClinker', ceiling: 'whiteRender' },
      { name: 'south-west escalators', s: [-100, -74], u: [-8, 8], h: [-1, 14], walls: 'squareTiles', stairs: 'squareTiles', ceiling: 'whitePanels' },
      { name: 'south-west hall', s: [-125, -97], u: [-8, 16], h: [12, 15], walls: 'brick', floor: 'slate', ceiling: 'boardConcrete' },
      { name: 'north-east escalators', s: [74, 106], u: [-12, 4], h: [-1, 18], walls: 'squareTiles', stairs: 'squareTiles', ceiling: 'whitePanels' },
      { name: 'north-east passage', s: [118, 250], u: [-2, 60], h: [8, 19], walls: 'brick', floor: 'slate', ceiling: 'whitePanels' },
      { name: 'north-east hall', s: [104, 130], u: [-12, 4], h: [16, 19], walls: 'pineBoards', floor: 'slate', ceiling: 'whiteRender' },
    ],
  },
  // Tekniska högskolan's hall is an island cave (src/hall-styles.ts); the lobbies at the platform's
  // ends, dark as the hall, polished dark floor carrying on from the platform's; the escalators
  // and the halls up them: from photographs (2016–2025), white walls, a ceiling of pale metal, and
  // pale grey stone in large squares underfoot.
  'Tekniska högskolan': {
    rooms: [
      { name: 'north-western lobby', s: [-89, -77], u: [-6, 7], h: [-1, 0.5], walls: 'darkStone', floor: 'darkTerrazzo', ceiling: 'perforated' },
      { name: 'south-eastern lobby', s: [77, 84], u: [-6, 7], h: [-1, 0.5], walls: 'darkStone', floor: 'darkTerrazzo', ceiling: 'perforated' },
      { name: 'north-western escalators', s: [-116, -88], u: [-6, 7], h: [-1, 15], walls: 'whitePanels', stairs: 'darkStone', ceiling: 'ribbedMetal' },
      { name: 'south-eastern escalators', s: [83, 108], u: [-6, 7], h: [-1, 14], walls: 'whitePanels', stairs: 'darkStone', ceiling: 'ribbedMetal' },
      { name: 'north-western hall', s: [-170, -112], u: [-25, 62], h: [13, 16], walls: 'whitePanels', floor: 'terrazzo', ceiling: 'ribbedMetal' },
      { name: 'south-eastern hall', s: [104, 200], u: [-45, 60], h: [12, 15], walls: 'whitePanels', floor: 'terrazzo', ceiling: 'ribbedMetal' },
    ],
  },
  // Universitetet's hall is an island cave (src/hall-styles.ts). The lobby from the platform's
  // south end to the escalators between walls of teal tiles, dark granite underfoot; the
  // escalators, four and an inclined lift, climb about 21 m to the south-south-east under a smooth
  // white vault (photographs, 2015–2019; their places OpenStreetMap's indoor ways). The ticket
  // hall in the sunken building of brick by the square at Frescati: its inside not in the
  // photographs, so its finishes are a guess, the brick inside too and pale terrazzo.
  'Universitetet': {
    rooms: [
      { name: 'lobby', s: [-87, -77.8], u: [-9, 5], h: [-1, 0.5], walls: 'portalTiles', floor: 'darkTiles', ceiling: 'whiteRender' },
      { name: 'escalators', s: [-132, -85], u: [-10, 10], h: [-1, 22], walls: 'whiteRender', stairs: 'whiteRender', ceiling: 'whiteRender' },
      { name: 'ticket hall', s: [-152, -128], u: [-12, 35], h: [20, 23], walls: null, floor: 'terrazzo', ceiling: 'whitePanels' },
    ],
    buildings: ['w134204536', 'w1530871698'],
    blocks: [
      // David Helldén's entrance building (1975), sunk into the slope so as to keep the view from
      // the campus to the Academy of Sciences and Brunnsviken: a bastion under a roof of grass,
      // clad in brick since; its glass front with the doors and a shop faces the round square to
      // the north under a canopy (OpenStreetMap's outline and roof; photographs, 2019)
      { name: 'ticket hall', plan: [[-120.7, -21.9], [-134.8, 32.2], [-157.5, 30.1], [-137, -20]], h: [18.3, 25.8], from: 21.31,
        walls: 'brick', sides: [undefined, 'glassFront', undefined, undefined], band: { walls: 'brick', from: 24.3 }, eaves: [0, 3.6, 0, 0],
        nameSign: { side: 1, at: 0.45, length: 5, bottom: 23.75 }, floor: 'terrazzo', ceiling: 'whitePanels', roof: 0.4, roofColor: 0x5f7d45, ground: true },
      // the way into the lobby, through the rock where the platform's hall ends a metre short of
      // the platform: cut away (its teal walls are the hall's, in src/network.ts), from just over
      // the platform's floor, which is 0.1 m higher here than at its middle
      { name: 'way into the lobby', plan: [[-75.8, -8], [-78.4, -8], [-78.4, 4], [-75.8, 4]], h: [1.12, 3.6], from: 1.12, walls: 'portalTiles', sides: [null, null, null, null],
        onPlatform: true },
    ],
  },
  // Bergshamra: the cave is the network's (src/hall-styles.ts, src/network.ts); here the ways up
  // and the two entrances. The escalators climb through the northern core in rock sprayed grey,
  // to a ticket hall with walls of board-marked concrete, a ceiling of dark expanded metal between
  // beams and a floor of dark grey tiles (photographs, 2016); the southern passage runs between
  // walls of rock under a white ceiling (photograph, 2015).
  'Bergshamra': {
    rooms: [
      // the cave's ends, where the platform's last metres lie behind the end walls: no floor or walls
      // of their own (the platform and the walls drawn in network.ts are there)
      { name: 'way in', s: [-88.6, -80], u: [-3, 4.5], h: [-1, 4], floor: null, walls: null, ceiling: 'whiteRender' },
      { name: 'lift landings', s: [83, 88.6], u: [-5, 2], h: [-1, 1], floor: null, walls: null },
      { name: 'escalators', s: [44, 72], u: [-4, 3], h: [-1, 15], walls: 'roughcast', stairs: 'roughcast', ceiling: 'whiteRender' },
      { name: 'north hall', s: [70, 92], u: [-30, 5], h: [13, 16], walls: 'boardConcrete', floor: 'darkTiles', ceiling: 'perforated' },
      { name: 'north escalator', s: [80, 92], u: [-42, -26], h: [13, 24], walls: 'boardConcrete', stairs: 'boardConcrete', ceiling: 'perforated' },
      { name: 'south passage', s: [-140, -88], u: [-6, 8], h: [-1, 4], walls: 'roughcast', floor: 'darkTiles', ceiling: 'whiteRender' },
      { name: 'south escalators', s: [-158.6, -138], u: [-11, 8], h: [-1, 14], walls: 'roughcast', stairs: 'roughcast', ceiling: 'whiteRender' },
      { name: 'south hall', s: [-175, -150], u: [-15, 5], h: [9, 14], walls: 'roughcast', floor: 'darkTiles', ceiling: 'perforated' },
    ],
    buildings: ['w134204538', 'w33038481', 'w984591540'],
    blocks: [
      // the pavilion on Bergshamra torg over the escalator and the stairs down: black steel posts,
      // walls of black expanded metal, a black fascia with the station's name on SL's blue band
      // over the way in, open to the west (photograph, 2016; OpenStreetMap's outline)
      { name: 'north pavilion', plan: [[83.15, -41.19], [89.26, -41.16], [89.26, -31.91], [83.15, -31.91]], h: [20.6, 24.4], from: 20.95,
        walls: 'perforated', sides: [null, 'perforated', 'perforated', 'perforated'], band: { walls: 'blackTiles', from: 23.9 },
        nameSign: { side: 0, at: 0.5, length: 4.4, bottom: 23.85 }, roof: 0.3, eaves: 0.2 },
      // the southern ticket hall on Kraus torg (1987): one storey, grey roughcast, its glass front
      // with the doors under a black band with the name and a canopy towards the square, a box of
      // windows on its white ribbed roof; to the north, under Bergshamravägen's edge, the lift's
      // head and the escalators' (photographs, 2009–2016; OpenStreetMap's outline; Google's mesh)
      { name: 'south hall', plan: [[-152.96, -14.03], [-159.96, 4.23], [-173.32, -0.9], [-166.32, -19.14]], h: [9.6, 14.1], from: 9.94,
        walls: 'roughcast', sides: [undefined, undefined, 'blackFront', undefined], band: { walls: 'blackTiles', from: 13.7 }, eaves: [0.3, 0.3, 2.8, 0.3],
        nameSign: { side: 2, at: 0.55, length: 4.6, bottom: 12.29, black: true }, floor: 'darkTiles', ceiling: 'perforated', roof: 0.4, roofColor: 0xd8d8d4 },
      { name: 'roof windows', plan: [[-156.5, -11], [-161, 0.8], [-168.5, -2.1], [-164, -13.9]], h: [14.1, 15.7], from: 14.1, walls: 'darkWindows', roof: 0.3, roofColor: 0x2a2b2c },
      { name: 'lift head', plan: [[-139.5, -6.2], [-139.5, -0.8], [-147.2, -0.8], [-147.2, -6.2]], h: [9.6, 13.4], from: 9.94, walls: 'roughcast', roof: 0.3, roofColor: 0xd8d8d4 },
      { name: 'escalator head', plan: [[-147.2, -9.6], [-147.2, 5.2], [-153.6, 5.2], [-153.6, -9.6]], h: [9.6, 13.6], from: 9.94, walls: 'roughcast', roof: 0.3, roofColor: 0xd8d8d4 },
    ],
  },
  // Danderyds sjukhus: the hall is the network's (src/hall-styles.ts); here the ways up, 4.5 m to
  // the ticket halls, and the bus terminal over the southern one. The ticket hall in the
  // photographs (2020s): white tiles, a grey terrazzo floor in large squares, a white ceiling;
  // the escalators, the passages and the southern hall are taken to be finished the same, and
  // Hertha Hillfon's and Pierre Olofsson's art in the passages, of which no photographs were
  // found, is left out. The terminal (Lantmäteriet's laser scan; photographs from the bus street,
  // 2019): long flat canopies along both sides of the street, boarded underneath, dark at the
  // edges, on a row of grey posts each; under the eastern one the waiting hall, glazed in dark
  // frames, into which stairs climb from the passage under the street; under the western one a
  // glass stair house in blue frames over the stairs from the same passage, and a lift beside it.
  // The northern hall's doors open onto a sunken walkway beside it, 4.8 m down (the laser scan;
  // photographs, 2016–2019): open to the south, where the ground is as low, and climbing north by
  // stairs to the street; the hall's front onto it glazed in blue frames, concrete cast against
  // boards over and beside it, a black railing along the street at its top; along its east side a
  // cycle path ramps up between a grey steel railing and a tall wall of the same concrete. The
  // passage north-west under the hospital's grounds comes up by an escalator under the flat
  // canopy at the main entrance (the laser scan: its top 3.3 m over the ground; a photograph,
  // 2020: a pale grey edge), on posts (where, inferred).
  'Danderyds sjukhus': {
    rooms: [
      { name: 'south stairs', s: [-92, -83], u: [-4, 0.5], h: [-1, 6], walls: 'squareTiles', stairs: 'squareTiles', ceiling: 'whiteRender' },
      // the platform's ends, under the hall the network draws: no floor or walls of their own
      { name: 'platform ends', s: [84, 90], u: [-6, 6], h: [-1, 1.5], floor: null, walls: null },
      { name: 'platform ends', s: [-90, -84], u: [-6, 6], h: [-1, 1.5], floor: null, walls: null },
      { name: 'north lift lobby', s: [90, 95], u: [-6, -1.6], h: [-1, 3], walls: 'squareTiles', floor: 'terrazzo', ceiling: 'whiteRender' },
      { name: 'south lift lobby', s: [-95, -90], u: [-6, 5], h: [-1, 3], walls: 'squareTiles', floor: 'terrazzo', ceiling: 'whiteRender' },
      { name: 'north escalators', s: [86, 97], u: [-1.6, 4], h: [-1, 9], walls: 'squareTiles', stairs: 'squareTiles', ceiling: 'whiteRender' },
      // the sunken walkway, its stairs and the ramp beside it, open to the sky
      { name: 'sunken walkway', s: [80, 141], u: [5.2, 16.6], h: [3, 11], walls: null, floor: 'asphalt', stairs: 'granite' },
      { name: 'north hall', s: [95, 120], u: [-12, 12], h: [3, 8], walls: 'squareTiles', floor: 'terrazzo', ceiling: 'whiteRender' },
      { name: 'hospital passage', s: [100, 145], u: [-73.5, -12], h: [3, 8], walls: 'squareTiles', floor: 'terrazzo', ceiling: 'whiteRender' },
      { name: 'hospital escalators', s: [128, 142], u: [-90, -73.5], h: [3, 12], walls: 'squareTiles', stairs: 'squareTiles', ceiling: 'whiteRender' },
      { name: 'south hall', s: [-108, -90], u: [-8, 8], h: [3, 8], walls: 'squareTiles', floor: 'terrazzo', ceiling: 'whiteRender' },
      // the stairs up into the stair house and the waiting hall: walls only to a balustrade's
      // height over their floors, the glass over them
      { name: 'bus stop stairs', s: [-133, -122], u: [3, 12], h: [3, 10], walls: 'squareTiles', stairs: 'squareTiles', sill: 9.5 },
      { name: 'terminal stairs', s: [-124, -116], u: [40, 50], h: [3, 10], walls: 'squareTiles', stairs: 'squareTiles', sill: 9.7 },
      { name: 'passages under the street', s: [-125, -104], u: [4, 40], h: [3, 8], walls: 'squareTiles', floor: 'terrazzo', ceiling: 'whiteRender' },
      { name: 'waiting hall', s: [-137, -99], u: [38, 57], h: [7.5, 10], walls: null, floor: 'terrazzo' },
    ],
    buildings: ['w63545446', 'w117542132'],
    blocks: [
      // the sunken walkway: the city's ground and the street cut away over it (the elevation
      // model's 5 m grid humps over it), its floors the station's own
      { name: 'sunken walkway', plan: [[84, 5.4], [84, 12.4], [140, 12.4], [140, 5.4]], h: [4.48, 10.4], from: 4.48,
        walls: 'boardConcrete', sides: [null, null, null, null], ground: true },
      // its west wall, up to the street over the hall (15.7 m over the sea), glazed in front of the hall
      { name: 'sunken walkway, west wall', plan: [[84, 5.1], [84, 5.4], [104, 5.4], [104, 5.1]], h: [4.48, 9.3], from: 4.48,
        walls: 'boardConcrete', roof: 0.05, roofColor: 0x8f8d86, ground: true },
      { name: "northern hall's front", plan: [[104, 5.1], [104, 5.4], [119, 5.4], [119, 5.1]], h: [4.48, 9.3], from: 4.48,
        walls: 'blueGlazed', band: { walls: 'boardConcrete', from: 8.0 }, roof: 0.05, roofColor: 0x8f8d86, ground: true },
      { name: 'sunken walkway, west wall by the stairs', plan: [[119, 5.1], [119, 5.4], [140, 5.4], [140, 5.1]], h: [4.48, 9.3], from: 4.48,
        walls: 'boardConcrete', roof: 0.05, roofColor: 0x8f8d86, ground: true },
      // the ramp along its east side, 12.2 m over the sea at its south end, 14.8 m at the stairs'
      // foot and 16 m at the top (its floor the station's own), and the wall along it
      { name: 'ramp', plan: [[84, 12.4], [84, 16.4], [119, 16.4], [119, 12.4]], h: [4.48, 7.75], from: 5.75, fall: 8.4,
        walls: 'boardConcrete', sides: [null, null, null, null], ground: true },
      { name: 'ramp, beside the stairs', plan: [[119, 12.4], [119, 16.4], [138, 16.4], [138, 12.4]], h: [4.48, 10.4], from: 8.4, fall: 9.6,
        walls: 'boardConcrete', sides: [null, null, null, null], ground: true },
      { name: "ramp's wall", plan: [[84, 16.5], [84, 16.9], [138, 16.9], [138, 16.5]], h: [5.75, 9.3], lowBack: 5.85, from: 5.75, fall: 9.6,
        walls: 'boardConcrete', roof: 0.05, roofColor: 0x8f8d86, ground: true },
      // the canopy at the hospital's main entrance, its top 19.7 m over the sea
      { name: 'hospital canopy', plan: [[133, -109], [141, -109], [141, -72.5], [133, -72.5]], h: [12.78, 12.78], from: 12.78,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'whiteRender', roof: 0.5, roofColor: 0xb4b7b8 },
      { name: 'hospital canopy, by the doors', plan: [[126, -92], [133, -92], [133, -74], [126, -74]], h: [12.78, 12.78], from: 12.78,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'whiteRender', roof: 0.5, roofColor: 0xb4b7b8 },
      // the waiting hall (OpenStreetMap's outline, in two)
      { name: 'waiting hall', plan: [[-111.46, 38.05], [-133.5, 38.0], [-135.5, 52.5], [-114.33, 54.25]], h: [8.3, 12.2], from: 8.68,
        walls: 'darkGlazed', floor: 'terrazzo', ceiling: 'whitePanels', roof: 0.05, ground: true },
      { name: 'waiting hall, north wing', plan: [[-112.9, 46.1], [-100.07, 47.29], [-100.38, 55.44], [-114.33, 54.25]], h: [8.3, 12.2], from: 8.68,
        walls: 'darkGlazed', sides: [undefined, undefined, undefined, null], floor: 'terrazzo', ceiling: 'whitePanels', roof: 0.05, ground: true },
      { name: 'stair house', plan: [[-131.21, 4.96], [-119.41, 5], [-119.42, 10.51], [-131.22, 10.47]], h: [8.2, 12.1], from: 8.46,
        walls: 'blueGlazed', floor: 'terrazzo', ceiling: 'pineBoards', roof: 0.3, roofColor: 0x3c3f42, ground: true },
      // the canopies, their tops 18.95 m (west) and 19.1 m (east) over the sea
      { name: 'western canopy', plan: [[-237, 7.8], [-30, 7.8], [-30, 12.8], [-237, 12.8]], h: [12.18, 12.18], from: 12.18,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'pineBoards', roof: 0.35, roofColor: 0x3c3f42 },
      { name: 'eastern canopy, west half', plan: [[-202, 33.5], [-14, 33.5], [-14, 38.5], [-202, 38.5]], h: [12.33, 12.33], from: 12.33,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'pineBoards', roof: 0.35, roofColor: 0x3c3f42 },
      { name: 'eastern canopy, east half', plan: [[-202, 48.5], [-14, 48.5], [-14, 55], [-202, 55]], h: [12.33, 12.33], from: 12.33,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'pineBoards', roof: 0.35, roofColor: 0x3c3f42 },
      // (closed between its halves over the waiting hall)
      { name: 'eastern canopy, over the waiting hall', plan: [[-137, 38.5], [-100, 38.5], [-100, 48.5], [-137, 48.5]], h: [12.33, 12.33], from: 12.33,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'pineBoards', roof: 0.35, roofColor: 0x3c3f42 },
    ],
    art: [
      // the canopies' posts, about 6 m apart (photographs), clear of the buildings under them
      { kind: 'columns', at: Array.from({ length: 34 }, (_, k): [number, number] => [-34 - 6 * k, 8.4]).filter(([s]) => s > -118.8 || s < -131.8),
        from: 7.8, to: 12.18, size: 0.25, color: 0x8a8d8f },
      { kind: 'columns', at: Array.from({ length: 31 }, (_, k): [number, number] => [-18 - 6 * k, 36]),
        from: 7.8, to: 12.33, size: 0.25, color: 0x8a8d8f },
      { kind: 'columns', at: Array.from({ length: 31 }, (_, k): [number, number] => [-18 - 6 * k, 51.8]).filter(([s]) => s > -99.5 || s < -136),
        from: 7.8, to: 12.33, size: 0.25, color: 0x8a8d8f },
      // the hospital canopy's, along its open sides
      { kind: 'columns', at: [[140.4, -108.4], [140.4, -99.4], [140.4, -90.4], [140.4, -73.1], [133.6, -73.1]],
        from: 9.9, to: 12.78, size: 0.3, color: 0xb4b7b8 },
    ],
    fences: [
      // the ramp's railing and the one on its wall, and the street's along the walkway's top
      { points: [[84, 12.5], [119, 12.5, 2.65], [138, 12.5, 3.85]], h: [5.75, 6.85], kind: 'bars', color: 0x7a7f83 },
      { points: [[84, 16.7], [138, 16.7, 0.4]], h: [9.35, 10.45], kind: 'bars', color: 0x7a7f83 },
      { points: [[84, 5.25], [140, 5.25]], h: [9.35, 10.45], kind: 'bars' },
    ],
  },
  // Mörby centrum (its cave: src/hall-styles.ts). The escalators climb 23.6 m from the passage, in
  // a notch in the southern core's end, south-west over the western track to the ticket hall on the
  // shopping centre's ground floor, at Mörbyplan's level (Lantmäteriet's laser scan: 30.2 m over the
  // sea, the platform at 6.6). OpenStreetMap's indoor ways (2026) give their direction, the gates and
  // the hall's door, but draw them 31 m long, too short for the climb at 30 degrees: their top is
  // kept a little short of the gates and their foot moved north into the passage to fit. The hall
  // (photographs, 2016): gates of brushed steel, white tiles, a low ceiling of dark grey perforated
  // metal, a dark floor; its front onto the centre's passage glazed, the doors under a black band
  // with the name. The passage through the centre to Mörbyplan: shop fronts either side, a floor of
  // cream terrazzo, a white slatted ceiling (yellow beams across it in the photographs, not drawn);
  // the doors onto Mörbyplan glazed in brushed steel under the centre's band (a photograph, 2009),
  // where OpenStreetMap has the entrance, at the corner of the centre's outline.
  'Mörby centrum': {
    rooms: [
      { name: 'escalators', s: [-46, -8], u: [-24, 6], h: [-1, 23], walls: 'whiteRender', stairs: 'whiteRender', ceiling: 'whiteRender' },
      { name: 'ticket hall', s: [-53, -41], u: [-31, -17], h: [23, 25], walls: null, floor: 'darkTiles', ceiling: 'perforated' },
      { name: 'passage', s: [-63, -30], u: [-69, -18], h: [23, 25], walls: null, floor: 'gridTerrazzo', ceiling: 'slats' },
    ],
    blocks: [
      { name: 'ticket hall', plan: [[-54.18, -22.26], [-49.85, -30.16], [-41.96, -25.83], [-46.29, -17.93]], h: [23.6, 27.2], from: 23.6,
        walls: 'squareTiles', sides: ['blackFront', undefined, null, undefined], nameSign: { side: 0, at: 0.5, length: 4.4, bottom: 25.95, black: true } },
      { name: 'passage, east wall', plan: [[-49.85, -30.16], [-31.26, -64.06], [-31.04, -63.94], [-49.64, -30.04]], h: [23.6, 27.2], from: 23.6, walls: 'shopWindows' },
      { name: 'passage, west wall', plan: [[-59.84, -26.51], [-37.4, -67.42], [-37.62, -67.54], [-60.06, -26.63]], h: [23.6, 27.2], from: 23.6, walls: 'shopWindows' },
      { name: 'passage, south end', plan: [[-59.84, -26.51], [-53.7, -23.14], [-53.82, -22.92], [-59.96, -26.29]], h: [23.6, 27.2], from: 23.6, walls: 'shopWindows' },
      // (the centre's floor over the passage, where the street the elevation model lays over the
      // centre's lower part doesn't run on through it)
      { name: 'centre over the passage', plan: [[-59.84, -26.51], [-53.7, -23.14], [-31.26, -64.06], [-37.4, -67.42]], h: [23.6, 27.2], from: 23.6, walls: 'shopWindows', sides: [null, null, null, null] },
      { name: 'doors onto Mörbyplan', plan: [[-37.4, -67.42], [-31.26, -64.06], [-31.4, -63.8], [-37.54, -67.16]], h: [23.6, 27.6], from: 23.6,
        walls: 'glassFront', sides: [undefined, null, null, null], nameSign: { side: 0, at: 0.5, length: 4.4, bottom: 25.95 } },
    ],
  },
  // Mariatorget (its halls: src/hall-styles.ts). The ends of the rock between the halls, and the
  // passage through it, from Albert Guillaumes's drawing; the escalators, halls, stairs and doors
  // from OpenStreetMap's indoor ways (2026). Photographs (2005–2024, Wikimedia Commons): round the
  // core's ends, grey stone slabs underfoot, also over the platforms' ends, a flat white ceiling,
  // and the core's end in the same ceramic rods as its sides; the passage through the middle
  // floored in polished dark terrazzo between walls of dark grey-green stone. At the foot of the
  // escalators white tiles and a round white column, by the western one Asmund Arle's bronze
  // Människa och pelare (a figure by a pillar), and Britt-Louise Sundell's iron gates folded back
  // against the walls; the escalators' shafts in white tiles; the ticket halls in white tiles
  // laid in pairs turned from each other, dark clinker underfoot, white ceilings with tubes; the
  // vestibules in the same tiles under ceilings of varnished boards, red-brown clinker underfoot.
  // The doors: glass in brushed steel under SL's blue band with the name, in the corner buildings
  // (Torkel Knutssonsgatan 33; Swedenborgsgatan 4, on its cut-off corner), a T on a bracket over them;
  // from the eastern hall a lift up to a glass house on Wollmar Yxkullsgatan's pavement beside them.
  'Mariatorget': {
    rooms: [
      { name: 'passage, opening west', s: [-1, 5], u: [-6, -4.4], h: [-1, 0.5], walls: null, floor: null },
      { name: 'passage, opening east', s: [-1, 5], u: [4.4, 6], h: [-1, 0.5], walls: null, floor: null },
      { name: 'passage', s: [-1, 5], u: [-4.4, 4.4], h: [-1, 0.5], walls: 'darkStone', floor: 'darkTerrazzo', ceiling: 'whiteRender' },
      { name: 'western end, over the western platform', s: [-79, -69], u: [-9.5, -4.4], h: [-1, 0.5], walls: null, floor: 'darkStone' },
      { name: 'western end, over the eastern platform', s: [-79, -69], u: [4.4, 9.5], h: [-1, 0.5], walls: null, floor: 'darkStone' },
      { name: 'western end', s: [-78, -69], u: [-4.4, 4.4], h: [-1, 0.5], walls: 'rods', back: 'glossTiles', floor: 'darkStone', ceiling: 'whitePanels' },
      { name: 'eastern end, over the western platform', s: [69, 79], u: [-9.5, -4.4], h: [-1, 0.5], walls: null, floor: 'darkStone' },
      { name: 'eastern end, over the eastern platform', s: [69, 79], u: [4.4, 9.5], h: [-1, 0.5], walls: null, floor: 'darkStone' },
      { name: 'eastern end', s: [69, 77.4], u: [-4.4, 4.4], h: [-1, 0.5], walls: 'glossTiles', back: 'rods', floor: 'darkStone', ceiling: 'whitePanels' },
      { name: 'western lobby', s: [-95, -77.6], u: [-8, 10], h: [-1, 0.5], walls: 'glossTiles', floor: 'darkStone', ceiling: 'whitePanels' },
      { name: 'western escalators', s: [-118, -86], u: [-2, 18], h: [-1, 19], walls: 'glossTiles', stairs: 'glossTiles', ceiling: 'whitePanels' },
      { name: 'western hall', s: [-140, -115], u: [6, 30], h: [17, 20], walls: 'basketTiles', floor: 'darkTiles', ceiling: 'whitePanels' },
      { name: 'western vestibule', s: [-162, -140], u: [18, 42], h: [17, 20], walls: 'basketTiles', floor: 'redClinker', ceiling: 'pineBoards' },
      { name: 'eastern lobby', s: [77.4, 100], u: [-12, 8], h: [-1, 0.5], walls: 'glossTiles', floor: 'darkStone', ceiling: 'whitePanels' },
      { name: 'eastern escalators', s: [96, 121], u: [-17, 0], h: [-1, 16], walls: 'glossTiles', stairs: 'glossTiles', ceiling: 'whitePanels' },
      { name: "the lift house's floor, and outside its door", s: [140.8, 145], u: [-31, -28.5], h: [19, 21], walls: null, floor: 'asphalt' },
      { name: 'eastern stairs', s: [128, 152], u: [-46, -24], h: [15, 21], walls: 'basketTiles', stairs: 'basketTiles', floor: 'redClinker', ceiling: 'pineBoards' },
      { name: 'eastern hall', s: [117, 137], u: [-26, -10], h: [14, 17], walls: 'basketTiles', floor: 'darkTiles', ceiling: 'whitePanels' },
    ],
    blocks: [
      // the halls' ends over the platforms' ends, in the white tiles of the lobbies beyond them (the
      // rock over the tracks, where they run on into their tunnels)
      { name: 'western hall, western end', plan: [[-77.9, -9.95], [-77.6, -9.95], [-77.6, -4.3], [-77.9, -4.3]], h: [-0.1, 6], from: 0, walls: 'glossTiles', onPlatform: true, inHall: true },
      { name: 'eastern hall, western end', plan: [[-77.9, 4.3], [-77.6, 4.3], [-77.6, 9.95], [-77.9, 9.95]], h: [-0.1, 6], from: 0, walls: 'glossTiles', onPlatform: true, inHall: true },
      { name: 'western hall, eastern end', plan: [[77.4, -9.95], [77.7, -9.95], [77.7, -4.3], [77.4, -4.3]], h: [-0.1, 6], from: 0, walls: 'glossTiles', onPlatform: true, inHall: true },
      { name: 'eastern hall, eastern end', plan: [[77.4, 4.3], [77.7, 4.3], [77.7, 9.95], [77.4, 9.95]], h: [-0.1, 6], from: 0, walls: 'glossTiles', onPlatform: true, inHall: true },
      // the lobbies' walls beyond them, where the halls the network draws run on behind them over
      // the tracks to their tunnels
      { name: "western lobby's wall, by the western hall", plan: [[-82.3, -4.59], [-77.9, -4.59], [-77.9, -4.29], [-82.3, -4.29]], h: [-0.1, 3.4], from: 0, walls: 'glossTiles', inHall: true },
      { name: "western lobby's wall, by the eastern hall", plan: [[-80.5, 4.29], [-77.9, 4.29], [-77.9, 4.59], [-80.5, 4.59]], h: [-0.1, 3.4], from: 0, walls: 'glossTiles', inHall: true },
      { name: "eastern lobby's wall, by the western hall", plan: [[77.7, -4.59], [87.5, -4.59], [87.5, -4.29], [77.7, -4.29]], h: [-0.1, 3.4], from: 0, walls: 'glossTiles', inHall: true },
      { name: "eastern lobby's wall, by the eastern hall", plan: [[77.7, 4.29], [79.4, 4.29], [79.4, 4.59], [77.7, 4.59]], h: [-0.1, 3.4], from: 0, walls: 'glossTiles', inHall: true },
      // the lift's house on Wollmar Yxkullsgatan's pavement (OpenStreetMap's outline; its roof
      // 3.85 m up and its canopy 2.5 m up, reaching 1.9 m out over the door, from the laser scan):
      // glass in anthracite frames, a grey panel over the canopy (photographs, 2015–2021)
      { name: 'lift house', plan: [[140.3, -26.8], [142.5, -28.2], [141.3, -30.1], [139.1, -28.6]], h: [20.1, 23.85], from: 20.22,
        walls: 'darkGlazed', roof: 0.25, roofColor: 0x2e3134 },
      { name: "lift house's panel over the door", plan: [[142.5, -28.2], [141.3, -30.1], [141.35, -30.13], [142.55, -28.23]], h: [22.72, 23.85], from: 22.72, walls: 'roughcast' },
      { name: "lift house's canopy", plan: [[142.55, -28.12], [141.25, -30.18], [142.85, -31.19], [144.15, -29.13]], h: [22.7, 22.7], from: 22.7,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'perforated', roof: 0.12, roofColor: 0x2e3134 },
      // the doors, in the buildings' walls where the vestibules meet them (OpenStreetMap's entrances)
      { name: 'western doors', plan: [[-157.34, 37.05], [-160.86, 31.95], [-161.16, 32.15], [-157.64, 37.25]], h: [18.1, 21.4], from: 18.4,
        walls: 'glassFront', sides: [null, null, undefined, null], nameSign: { side: 2, at: 0.5, length: 4.4, bottom: 20.75 } },
      { name: 'eastern doors', plan: [[149.38, -39.63], [150.03, -42.76], [150.42, -42.68], [149.77, -39.55]], h: [19.7, 22.98], from: 19.98,
        walls: 'glassFront', sides: [null, null, undefined, null], nameSign: { side: 2, at: 0.5, length: 3, bottom: 22.33 } },
    ],
    art: [
      // the round columns: one before the western escalators, two in the eastern lobby
      { kind: 'columns', at: [[-79.6, 0.4], [80.5, -0.5], [88.5, -0.5]], from: 0, to: 3.3, size: 0.95, color: 0xefefeb },
      // Arle's figure, beside the western column, facing the escalators
      { kind: 'guardian', s: -80.6, u: -0.4, turn: Math.PI, height: 0.95, casing: [0, 0] },
      // Sundell's gates, folded back against the lobbies' walls
      { kind: 'mural', picture: 'sundell', s: -81.2, u: -4.28, turn: Math.PI / 2, bottom: 0.02, top: 2.22, width: 4.4 },
      { kind: 'mural', picture: 'sundell', s: 83.4, u: 4.28, turn: -Math.PI / 2, bottom: 0.02, top: 2.22, width: 4.4 },
      // the T on its bracket over each door
      { kind: 'roundel', s: -159.9, u: 35.04, h: 22.6, size: 0.8, foot: 21.95 },
      { kind: 'roundel', s: 150.69, u: -41.0, h: 24.2, size: 0.8, foot: 23.55 },
    ],
  },
  // Zinkensdamm (1964): its halls are a vault style (src/hall-styles.ts); here the join through the
  // core, the escalators' foot behind glass screens, the escalators, ticket hall and passage in
  // white tiles on end, the stairs up into the pavilion at Ringvägen 8 panelled in wood
  // (photographs through its doors, 2011), and the lift
  'Zinkensdamm': {
    buildings: ['w141745824'],
    rooms: [
      { name: 'join, opening north', s: [-5.6, 3.1], u: [-6, -4.4], h: [-1, 0.5], walls: null, floor: null },
      { name: 'join, opening south', s: [-5.6, 3.1], u: [4.4, 6], h: [-1, 0.5], walls: null, floor: null },
      { name: 'join', s: [-5.6, 2.95], u: [-4.4, 4.4], h: [-1, 0.5], walls: 'wineTiles', floor: 'redClinker', ceiling: 'whiteRender' },
      { name: "escalators' foot", s: [2.95, 9.5], u: [-4.6, 4.6], h: [-1, 0.5], walls: null, floor: 'redClinker', ceiling: 'whiteRender' },
      { name: 'escalators', s: [8, 34], u: [-5, 5], h: [-1, 15.5], walls: 'uprightTiles', stairs: 'uprightTiles', ceiling: 'whitePanels' },
      { name: 'ticket hall', s: [33, 51], u: [-5, 5], h: [13, 16], walls: 'uprightTiles', floor: 'redClinker', ceiling: 'whitePanels' },
      { name: 'passage', s: [49, 84.5], u: [-8, 13], h: [13, 16], walls: 'uprightTiles', floor: 'redClinker', ceiling: 'whitePanels' },
      { name: 'stairs into the pavilion', s: [77, 86], u: [11, 19.9], h: [13, 19.5], walls: 'pineBoards', stairs: 'pineBoards', floor: 'greyTiles', ceiling: 'pineBoards' },
      { name: "pavilion's vestibule", s: [77, 86], u: [19.9, 26], h: [17, 19.5], walls: null, floor: 'greyTiles' },
    ],
    blocks: [
      // the glass screens between the platforms and the escalators' foot, and the black band over
      // them, where the foot's opening cuts the network's wall
      { name: 'screen, north', plan: [[2.95, -4.62], [9.0, -4.62], [9.0, -4.48], [2.95, -4.48]], h: [-0.1, 2.9], from: 0, walls: 'bandGlazed', onPlatform: true, inHall: true },
      { name: 'screen, south', plan: [[2.95, 4.48], [9.0, 4.48], [9.0, 4.62], [2.95, 4.62]], h: [-0.1, 2.9], from: 0, walls: 'bandGlazed', onPlatform: true, inHall: true },
      { name: 'band over the north screen', plan: [[2.95, -4.62], [9.0, -4.62], [9.0, -4.48], [2.95, -4.48]], h: [2.9, 3.35], from: 2.9, walls: 'blackTiles', inHall: true },
      { name: 'band over the south screen', plan: [[2.95, 4.48], [9.0, 4.48], [9.0, 4.62], [2.95, 4.62]], h: [2.9, 3.35], from: 2.9, walls: 'blackTiles', inHall: true },
      // the pavilion at Ringvägen 8 (OpenStreetMap's outline; its roof 2.9 m over the pavement,
      // from the laser scan): John Stenborg's walls round the stairs, and a vestibule of glass in
      // brushed steel at its south end, with doors on three sides (photographs, 2011)
      { name: 'pavilion', plan: [[78.3, 12.3], [84.1, 12.3], [84.1, 20.4], [78.3, 20.4]], h: [17.6, 21.1], from: 18.2,
        walls: 'shards', sides: [undefined, undefined, null, undefined], roof: 0.3, roofColor: 0x7d7c78 },
      { name: "pavilion's vestibule", plan: [[78.3, 20.4], [84.1, 20.4], [84.1, 24.6], [78.3, 24.6]], h: [17.6, 21.1], from: 18.22,
        walls: 'glassFront', sides: [null, undefined, undefined, undefined], floor: 'greyTiles', roof: 0.3, roofColor: 0x3a3c3e },
      // the lift's house on Ringvägen's pavement (its roof 3.85 m up, a canopy 2.5 m up over its
      // door, from the laser scan): glass in black frames (photographs, 2020)
      { name: 'lift house', plan: [[80.4, -9.9], [82.8, -9.9], [82.8, -7.2], [80.4, -7.2]], h: [19.0, 23.0], from: 19.14,
        walls: 'darkGlazed', roof: 0.25, roofColor: 0x2e3134 },
      { name: "lift house's canopy", plan: [[79.9, -7.2], [82.8, -7.2], [82.8, -6.3], [79.9, -6.3]], h: [21.65, 21.65], from: 21.65,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'perforated', roof: 0.12, roofColor: 0x2e3134 },
    ],
    art: [
      // the paintings on the halls' ends (which the network draws, in the vault's plaster, round
      // the tunnels going on): Göran T Karlsson's on the platform for the trains south, John
      // Stenborg's on the other (photographed at one end each; the same at the other)
      { kind: 'mural', picture: 'karlsson', s: -68.6, u: 7.1, turn: 0, bottom: 0.05, top: 3.05, width: 3.7 },
      { kind: 'mural', picture: 'karlsson', s: 68.7, u: 7.1, turn: Math.PI, bottom: 0.05, top: 3.05, width: 3.7 },
      { kind: 'mural', picture: 'stenborg', s: 68.9, u: -7.15, turn: Math.PI, bottom: 0.2, top: 2.8, width: 3.9 },
      { kind: 'mural', picture: 'stenborg', s: -69.0, u: -7.15, turn: 0, bottom: 0.2, top: 2.8, width: 3.9 },
      // the T on its post on the vestibule's roof
      { kind: 'roundel', s: 83.6, u: 24.1, h: 21.85, size: 0.8, foot: 21.1 },
    ],
  },
  // Hornstull (1964): its halls are a vault style (src/hall-styles.ts); here the passage through
  // the core and the lobbies round its ends in white tiles on end, as behind the platforms, under
  // white ceilings, the floor dark terrazzo as the platforms'; the escalators' shafts in the same
  // tiles; beyond the gates, the passage lined with shops, rebuilt with the buildings over it in
  // 2012, its floor pale stone and its ceiling white, round columns down its middle and among them
  // Eva Ziggy Berglund's (photographs, 2013); the ticket hall before the gates, the passages to
  // the doors and the hall in the building on Hornsbruksgatan in white tiles (no photographs found:
  // a guess). The doors are in the buildings' walls (OpenStreetMap's entrances), glass in steel
  // under a blue band with the name, the T on a bracket over them (photographs, 2013).
  'Hornstull': {
    rooms: [
      { name: 'crossing, opening north', s: [-15, -9], u: [-7, -5.6], h: [-1, 0.5], walls: null, floor: null },
      { name: 'crossing, opening south', s: [-15, -9], u: [5.6, 7], h: [-1, 0.5], walls: null, floor: null },
      { name: 'crossing', s: [-15, -9], u: [-5.6, 5.6], h: [-1, 0.5], walls: 'narrowTiles', floor: 'darkTerrazzo', ceiling: 'whitePanels' },
      { name: 'western lobby, opening north', s: [-67.5, -56], u: [-7, -5.6], h: [-1, 0.5], walls: null, floor: null },
      { name: 'western lobby, opening south', s: [-67.5, -56], u: [5.6, 7], h: [-1, 0.5], walls: null, floor: null },
      { name: 'western lobby', s: [-67.5, -56], u: [-5.6, 5.6], h: [-1, 0.5], walls: 'narrowTiles', floor: 'darkTerrazzo', ceiling: 'whitePanels' },
      { name: 'eastern lobby, opening north', s: [46, 67.5], u: [-7, -5.6], h: [-1, 0.5], walls: null, floor: null },
      { name: 'eastern lobby, opening south', s: [46, 67.5], u: [5.6, 7], h: [-1, 0.5], walls: null, floor: null },
      { name: 'eastern lobby', s: [46, 67.5], u: [-5.6, 5.6], h: [-1, 0.5], walls: 'narrowTiles', floor: 'darkTerrazzo', ceiling: 'whitePanels' },
      { name: 'western escalators', s: [-81, -67], u: [-6.5, 2], h: [-1, 8.5], walls: 'narrowTiles', stairs: 'narrowTiles', ceiling: 'whitePanels' },
      { name: 'eastern escalators', s: [67, 99], u: [-2, 13], h: [-1, 19.5], walls: 'narrowTiles', stairs: 'narrowTiles', ceiling: 'whitePanels' },
      { name: 'passage to Långholmsgatan', s: [-153, -140], u: [-49, -9.5], h: [6.5, 12], walls: 'glossTiles', stairs: 'glossTiles', floor: 'terrazzo', ceiling: 'whitePanels' },
      { name: 'passage to Hornsgatan', s: [-158, -145], u: [-9.5, 25], h: [6.5, 12], walls: 'glossTiles', stairs: 'glossTiles', floor: 'terrazzo', ceiling: 'whitePanels' },
      { name: 'passage to Bergsunds strand', s: [-200, -158], u: [-7, 10], h: [6.5, 11], walls: 'glossTiles', stairs: 'glossTiles', floor: 'terrazzo', ceiling: 'whitePanels' },
      { name: 'ticket hall', s: [-97, -80], u: [-8, 3.5], h: [6.5, 8.5], walls: 'glossTiles', floor: 'terrazzo', ceiling: 'whitePanels' },
      { name: 'shops', s: [-147, -96], u: [-10, 3], h: [6.5, 8.5], walls: 'shopWindows', floor: 'terrazzo', ceiling: 'whitePanels' },
      { name: 'eastern hall', s: [96, 116], u: [3, 20], h: [17, 19.5], walls: 'glossTiles', floor: 'terrazzo', ceiling: 'whitePanels' },
    ],
    blocks: [
      { name: 'doors to Långholmsgatan', plan: [[-146.34, -47.4], [-146.82, -43.03], [-147.12, -43.06], [-146.64, -47.43]], h: [11.0, 14.6], from: 11.14,
        walls: 'glassFront', sides: [null, null, undefined, null], nameSign: { side: 2, at: 0.5, length: 3.6, bottom: 13.95 } },
      { name: 'doors to Hornsgatan', plan: [[-157.29, 19.9], [-157.88, 24.26], [-158.18, 24.22], [-157.58, 19.86]], h: [10.5, 14.1], from: 10.65,
        walls: 'glassFront', sides: [null, null, undefined, null], nameSign: { side: 2, at: 0.5, length: 3.6, bottom: 13.45 } },
      { name: 'doors to Hornsbruksgatan', plan: [[107.38, 17.35], [111.73, 18.02], [111.69, 18.31], [107.34, 17.65]], h: [18.0, 21.6], from: 18.15,
        walls: 'glassFront', sides: [null, null, undefined, null], nameSign: { side: 2, at: 0.5, length: 3.6, bottom: 20.95 } },
    ],
    art: [
      // the round columns in the eastern lobby (Albert Guillaumes's drawing), and down the middle
      // of the passage of shops (photographs, 2013)
      { kind: 'columns', at: [[51, -3.8], [58, -3.8], [51, 3.8], [58, 3.8]], from: 0, to: 2.6, size: 0.9, color: 0xeeeeea },
      { kind: 'columns', at: [[-108, -2.88], [-118, -3.41], [-128, -3.94]], from: 7.51, to: 10.51, size: 0.7, color: 0xf0efea },
      // Eva Ziggy Berglund's column, by the florist's
      { kind: 'castColumn', s: -138, u: -4.46, from: 7.51, ceiling: 10.51, head: 2.2 },
      // the T on its bracket over each door
      { kind: 'roundel', s: -147.43, u: -45.31, h: 15.4, size: 0.8, foot: 14.8, along: true },
      { kind: 'roundel', s: -158.42, u: 21.97, h: 14.95, size: 0.8, foot: 14.35, along: true },
      { kind: 'roundel', s: 109.43, u: 18.52, h: 22.45, size: 0.8, foot: 21.85 },
    ],
  },

  // Liljeholmen (1 October 1964, open between the hill and the square; covered in the 2000s by the
  // deck that carries Liljeholmstorget and the buildings on it, and given its bus terminal, SL's
  // first underground, behind a platform beyond the eastern track). The platforms are in a hall
  // under the deck, which the station draws itself (`hall`): from west to east an island between
  // the line's two tracks, an island between its third track, where trains turning back stand, and
  // the eastern track, and a platform beyond the eastern track, the glass wall of the bus terminal
  // behind it (OpenStreetMap's platforms and indoor ways, 2026; Albert Guillaumes's drawing, 2024).
  // From photographs (2008 to 2025):
  //
  // The platforms are green terrazzo, thin lines of brass crossing it in long triangles, a band of
  // white terrazzo along the edges and a strip of brass studs. Over them the deck's steel beams,
  // painted a dark red, cross the hall about every 7.5 m, and between them panels of grey
  // perforated sheet metal curve in shallow barrels along it on steel ribs; strip lights hang in
  // long rows along the platforms' edges. The walls beyond the tracks are white tiles. Down the
  // eastern platform a row of dark red columns, a funnel lit in stripes of red or blue and white on
  // each under the beams (SL: light plays with prisms, glass mosaic, LEDs and lit columns), and
  // behind them the glass wall with the doors to the bus terminal: white tiles, a ceiling of pine
  // boards, wooden benches, and glazed booths along the bays the buses dock at, lettered A to L.
  // On the middle island, round grey columns in its northern half.
  //
  // At the south end stairs and an escalator from each platform climb under the deck into the
  // hall of 1964 on the square (the laser scan: its floor 5.0 m over the platforms, its roof 12.7
  // m): board-marked concrete, Carl-Axel Lunding's reliefs, the gates in a line across it and a
  // passage behind them, doors onto the square under a canopy with a timber underside on dark
  // steel posts, and a stair house down to Liljeholmsgränd to the west, where a glazed walkway
  // runs south along the street to the inclined lift up Nybohovsberget. At the north end stairs
  // and escalators from each platform climb into the hall in the ground floor of the buildings on
  // the deck (5.2 m over the platforms), joined by a bridge over the tracks, its doors onto the
  // square and the street.
  'Liljeholmen': {
    hall: { at: [-2033.27, 2309.62, -0.9321], s: [-124.6, 107], u: [-24, 24], deck: 4.6 },
    paving: {
      edge: 0.9, tactile: [0.95, 1.25], studs: true, studColor: 0xb08d3c, slabs: 0,
      colors: { edge: 0xe4e2da, tactile: 0x88a28a, slab: 0x88a28a, pavers: 0x88a28a, face: 0x4a4c4e },
      pattern: 'asphalt', lines: { color: 0xb08d3c, every: 9.6 },
    },
    buildings: ['w89361910', 'w1557820130', 'w1557820131', 'w1557820132', 'w1557820133', 'w100736312', 'w1335914891', 'w1335914892'],
    rooms: [
      // (the landings at the platforms' south ends and beyond the eastern platform by its stairs,
      // open under the deck)
      { name: 'landings', s: [-84, -72.5], u: [-20, 17], h: [-0.5, 1], walls: null, floor: 'brassTerrazzo', stairs: 'squareTiles', parapet: 1.1 },
      { name: "eastern platform's landing", s: [4, 8], u: [12, 19.5], h: [-0.5, 1], walls: null, floor: 'brassTerrazzo', stairs: 'squareTiles', parapet: 1.1 },
      // the flights from the platforms, climbing open under the deck between walls of white tiles
      { name: 'flights', s: [-96, 36], u: [-20, 20], h: [-0.5, 4.6], walls: null, floor: 'brassTerrazzo', stairs: 'squareTiles', parapet: 1.1 },
      // (the halls' walls and ceilings are their shells')
      { name: 'south hall', s: [-108, -88], u: [-23, 24], h: [4.5, 5.5], walls: null, floor: 'brassTerrazzo', lamps: 4.2 },
      { name: 'stairs to Liljeholmsgränd', s: [-107, -100.5], u: [-31, -22.5], h: [-1, 5.5], walls: null, floor: 'terrazzo', stairs: 'squareTiles', parapet: 1.0, lamps: 2.8 },
      { name: 'walkway', s: [-210, -104], u: [-32, -21], h: [3, 5.5], walls: null, floor: 'terrazzo', lamps: 2.7 },
      { name: 'north hall', s: [-12, 34], u: [-13, 28], h: [4.5, 6], walls: null, floor: 'brassTerrazzo', lamps: 3.2 },
    ],
    blocks: [
      // the walls along the hall: beyond the western track, white tiles; at the back of the eastern
      // platform, the glass wall to the bus terminal, the doors in it glass in brushed steel under the
      // name; beyond the eastern track north and south of the platforms, white tiles
      { name: 'west wall', plan: [[-124.6, -20.1], [-104, -20.61], [-104, -20.91], [-124.6, -20.4]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'west wall', plan: [[-104, -20.61], [-84.8, -20.77], [-84.8, -21.07], [-104, -20.91]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'west wall', plan: [[-84.8, -20.77], [-66, -20.6], [-66, -20.9], [-84.8, -21.07]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'west wall', plan: [[-66, -20.6], [-37, -19.35], [-37, -19.65], [-66, -20.9]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'west wall', plan: [[-37, -19.35], [-8, -18.1], [-8, -18.4], [-37, -19.65]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'west wall', plan: [[-8, -18.1], [11, -16.6], [11, -16.9], [-8, -18.4]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'west wall', plan: [[11, -16.6], [30, -14.8], [30, -15.1], [11, -16.9]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'west wall', plan: [[30, -14.8], [49, -12.8], [49, -13.1], [30, -15.1]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'west wall', plan: [[49, -12.8], [69, -10.7], [69, -11.0], [49, -13.1]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'west wall', plan: [[69, -10.7], [88, -8.8], [88, -9.1], [69, -11.0]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'west wall', plan: [[88, -8.8], [107, -7.3], [107, -7.6], [88, -9.1]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'glass wall', plan: [[-73, 16.33], [-67, 16.48], [-67, 16.6], [-73, 16.45]], h: [0, 4.0], from: 0, walls: 'glazed', inHall: true },
      { name: 'glass wall', plan: [[-67, 16.48], [-38, 17.01], [-38, 17.13], [-67, 16.6]], h: [0, 4.0], from: 0, walls: 'glazed', inHall: true },
      { name: 'glass wall', plan: [[-38, 17.01], [-9, 17.53], [-9, 17.65], [-38, 17.13]], h: [0, 4.0], from: 0, walls: 'glazed', inHall: true },
      { name: 'glass wall', plan: [[-9, 17.53], [1.4, 17.53], [1.4, 17.65], [-9, 17.65]], h: [0, 4.0], from: 0, walls: 'glazed', inHall: true },
      { name: 'doors to the buses, south', plan: [[1.4, 17.53], [5.4, 17.53], [5.4, 17.65], [1.4, 17.65]], h: [0, 4.0], from: 0, walls: 'glassFront', inHall: true },
      { name: 'glass wall', plan: [[5.4, 17.53], [5.4, 19.0], [5.4, 19.12], [5.4, 17.65]], h: [0, 4.0], from: 0, walls: 'glazed', inHall: true },
      { name: 'glass wall', plan: [[5.4, 19.0], [16.3, 19.0], [16.3, 19.12], [5.4, 19.12]], h: [0, 4.0], from: 0, walls: 'glazed', inHall: true },
      { name: 'doors to the buses, north', plan: [[16.3, 19.0], [20.3, 19.0], [20.3, 19.12], [16.3, 19.12]], h: [0, 4.0], from: 0, walls: 'glassFront', inHall: true },
      { name: 'glass wall', plan: [[20.3, 19.0], [24, 19.0], [24, 19.12], [20.3, 19.12]], h: [0, 4.0], from: 0, walls: 'glazed', inHall: true },
      { name: 'glass wall', plan: [[24, 19.0], [24, 17.35], [24, 17.47], [24, 19.12]], h: [0, 4.0], from: 0, walls: 'glazed', inHall: true },
      { name: 'glass wall', plan: [[24, 17.35], [49, 16.77], [49, 16.89], [24, 17.47]], h: [0, 4.0], from: 0, walls: 'glazed', inHall: true },
      { name: 'glass wall', plan: [[49, 16.77], [68.3, 15.94], [68.3, 16.06], [49, 16.89]], h: [0, 4.0], from: 0, walls: 'glazed', inHall: true },
      { name: 'glass wall', plan: [[68.3, 15.94], [74, 15.64], [74, 15.76], [68.3, 16.06]], h: [0, 4.0], from: 0, walls: 'glazed', inHall: true },
      { name: 'east wall, north', plan: [[74, 15.64], [74, 10.47], [74, 10.77], [74, 15.94]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'east wall, north', plan: [[74, 10.47], [87.5, 9.71], [87.5, 10.01], [74, 10.77]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'east wall, north', plan: [[87.5, 9.71], [97.1, 9.1], [97.1, 9.4], [87.5, 10.01]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'east wall, north', plan: [[97.1, 9.1], [107, 8.45], [107, 8.75], [97.1, 9.4]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'east wall, south', plan: [[-124.6, 17.0], [-73, 17.0], [-73, 17.3], [-124.6, 17.3]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      { name: 'east wall, south', plan: [[-73, 17.0], [-73, 16.33], [-73, 16.63], [-73, 17.3]], h: [-1.7, 4.3], from: -1.7, walls: 'squareTiles', inHall: true },
      // the bus terminal behind the glass wall: its waiting hall, and the road the buses dock along
      { name: 'bus terminal', plan: [[-52, 16.87], [5.4, 17.65], [5.4, 26], [-52, 26]], h: [0, 3.2], from: 0, walls: 'squareTiles',
        sides: [null, 'squareTiles', 'glazed', 'squareTiles'], floor: 'lineMosaic', ceiling: 'pineBoards', roof: 0.2, inHall: true },
      { name: 'bus terminal, north', plan: [[5.4, 19.12], [24, 19.12], [24, 26], [5.4, 26]], h: [0, 3.2], from: 0, walls: 'squareTiles',
        sides: [null, 'squareTiles', 'glazed', null], floor: 'lineMosaic', ceiling: 'pineBoards', roof: 0.2, inHall: true },
      { name: 'bus road', plan: [[-52, 26], [28, 26], [28, 34], [-52, 34]], h: [-0.15, 4.4], from: -0.15, walls: 'boardConcrete',
        sides: [null, 'boardConcrete', 'boardConcrete', 'boardConcrete'], floor: 'asphalt', ceiling: 'boardConcrete', roof: 0.3, inHall: true },
      // the hall of 1964 on the square: its shell from the deck up, and below it the wall along
      // Liljeholmsgränd; its front onto the square under the canopy, shops either side of the doors
      { name: 'south hall', plan: [[-72.3, -22], [-124.3, -22], [-124.3, 17.4], [-72.3, 17.4]], h: [4.0, 12.7], from: 5.0,
        walls: 'boardConcrete', sides: ['boardConcrete', 'boardConcrete', null, 'whiteRender'], floor: 'brassTerrazzo', ceiling: 'boardConcrete', roof: 0.4, roofColor: 0x3e4144 },
      { name: 'south hall, along Liljeholmsgränd', plan: [[-72.3, -22], [-124.3, -22], [-124.3, -22.3], [-72.3, -22.3]], h: [-0.7, 5.0], from: -0.7, walls: 'boardConcrete' },
      { name: 'shops, north', plan: [[-76, 17.3], [-96, 17.3], [-96, 17.4], [-76, 17.4]], h: [4.9, 8.2], from: 4.9, walls: 'shopWindows' },
      { name: 'doors to the square', plan: [[-96, 17.3], [-113, 17.3], [-113, 17.4], [-96, 17.4]], h: [4.8, 8.2], from: 4.8, walls: 'glassFront' },
      { name: 'shops, south', plan: [[-113, 17.3], [-124.3, 17.3], [-124.3, 17.4], [-113, 17.4]], h: [4.8, 8.2], from: 4.8, walls: 'shopWindows' },
      { name: 'front over the canopy', plan: [[-72.3, 17.3], [-124.3, 17.3], [-124.3, 17.4], [-72.3, 17.4]], h: [8.2, 12.7], from: 8.2, walls: 'whiteRender' },
      { name: 'canopy', plan: [[-76, 17.4], [-120, 17.4], [-120, 24.5], [-76, 24.5]], h: [8.2, 8.2], from: 8.2,
        walls: 'whiteRender', sides: [null, null, null, null], ceiling: 'pineBoards', roof: 0.55, roofColor: 0x3a3c3e },
      // the glass stair house down to Liljeholmsgränd, and the walkway south from it along the street
      { name: 'stair house', plan: [[-100.5, -22.3], [-106.6, -22.3], [-106.6, -31.5], [-100.5, -31.5]], h: [-0.7, 8.6], from: -0.7,
        walls: 'glazed', sides: [null, 'glazed', 'glazed', 'glazed'], floor: 'terrazzo', ceiling: 'whitePanels', roof: 0.3, roofColor: 0x45494d },
      { name: 'walkway', plan: [[-106.6, -22.3], [-106.6, -30.5], [-204, -30.5], [-204, -24.6]], h: [4.7, 8.0], from: 5.0, fall: 3.75,
        walls: 'glazed', sides: [null, 'glazed', 'glazed', 'glazed'], floor: 'terrazzo', ceiling: 'whitePanels', roof: 0.3, roofColor: 0x45494d },
      // the northern hall, at the deck's level (5.2 m over the platforms, the laser scan) in the
      // ground floor of the buildings on it, round the opening in the deck over the middle island's
      // stairs, the deck's red edge round the opening; over it the courtyard between the buildings
      // (the laser scan: 15.4 m, 10.7 m over the platforms), the buildings standing on it
      // (data/building-corrections.json). (Its plans overlap a little, so that no sliver of the
      // city's ground is left between their cuts.)
      { name: 'north hall, south', plan: [[-10, -13.2], [-6.1, -13.2], [-6.1, 20.6], [-10, 20.6]], h: [5.2, 9.4], from: 5.2, ground: true,
        walls: 'whitePanels', sides: [undefined, null, undefined, 'glassFront'], floor: 'brassTerrazzo', ceiling: 'whitePerforated', roof: 1.3, roofColor: 0x5d6b4f },
      { name: 'north hall, south', plan: [[-6.2, -13.2], [-0.9, -13.2], [-0.9, 20.7], [-6.2, 20.7]], h: [5.2, 9.4], from: 5.2, ground: true,
        walls: 'whitePanels', sides: [undefined, null, null, null], floor: 'brassTerrazzo', ceiling: 'whitePerforated', roof: 1.3, roofColor: 0x5d6b4f },
      { name: 'north hall, south', plan: [[-6.2, 20.5], [-0.9, 20.5], [-0.9, 25.3], [-6.2, 25.3]], h: [5.2, 9.4], from: 5.2, ground: true,
        walls: 'whitePanels', sides: [null, null, 'glassFront', undefined], floor: 'brassTerrazzo', ceiling: 'whitePerforated', roof: 1.3, roofColor: 0x5d6b4f },
      { name: 'north hall, west', plan: [[-1, -13.2], [16.1, -13.2], [16.1, -5.7], [-1, -5.7]], h: [5.2, 9.4], from: 5.2, ground: true,
        walls: 'whitePanels', sides: [undefined, null, null, null], floor: 'brassTerrazzo', ceiling: 'whitePerforated', roof: 1.3, roofColor: 0x5d6b4f },
      { name: 'north hall, east', plan: [[-1, 11.9], [16.1, 11.9], [16.1, 25.4], [-1, 25.4]], h: [5.2, 9.4], from: 5.2, ground: true,
        walls: 'whitePanels', sides: [null, null, 'glassFront', null], floor: 'brassTerrazzo', ceiling: 'whitePerforated', roof: 1.3, roofColor: 0x5d6b4f },
      { name: 'north hall, over the tracks', plan: [[15.9, -13.2], [30.7, -12.4], [30.7, 25.8], [15.9, 25.8]], h: [5.2, 9.4], from: 5.2, ground: true,
        walls: 'whitePanels', sides: [undefined, undefined, undefined, null], floor: 'brassTerrazzo', ceiling: 'whitePerforated', roof: 1.3, roofColor: 0x5d6b4f },
      { name: 'north hall, over the opening', plan: [[-1, -5.8], [16, -5.8], [16, 12], [-1, 12]], h: [9.4, 9.4], from: 9.4,
        walls: 'whitePanels', sides: [null, null, null, null], ceiling: 'whitePerforated', roof: 1.3, roofColor: 0x5d6b4f },
      // the point block's ground floor round the hall, under the courtyard, down to Liljeholmsgränd
      // on the west
      { name: "point block's ground floor", plan: [[-12.9, -26.9], [2.5, -26.5], [3.6, -13.2], [-13.3, -13.2]], h: [2.2, 10.2], from: 5.2,
        walls: 'whiteRender', sides: [undefined, undefined, null, undefined], roof: 0.5, roofColor: 0x5d6b4f },
      { name: "point block's ground floor", plan: [[-13.3, -13.2], [-10.05, -13.2], [-10.05, -4.0], [-11.5, -4.0]], h: [5.2, 10.2], from: 5.2,
        walls: 'whiteRender', sides: [null, null, undefined, undefined], roof: 0.5, roofColor: 0x5d6b4f },
      { name: 'the opening in the deck', plan: [[-1, -5.8], [16, -5.8], [16, 12], [-1, 12]], h: [3.98, 5.2], from: 3.98, ground: 0.6,
        walls: 'redPanels', inHall: true },
    ],
    // the glass balustrade round the opening, open where the middle island's stairs come up
    fences: [
      { points: [[-1, -5.8], [16, -5.8], [16, 3.2]], h: [5.2, 6.3], kind: 'glass' },
      { points: [[16, 7.4], [16, 12], [-1, 12], [-1, -5.8]], h: [5.2, 6.3], kind: 'glass' },
    ],
    art: [
      { kind: 'deckCeiling', holes: [[-1, 16, -5.8, 12]], s: [-124.6, 107], u: [-21, 19.2], every: 7.5, at: 3.75, beam: [0.32, 0.62], soffit: 3.98,
        panel: 2.4, spring: 4.25, rise: 0.32, color: 0x6b2326, lampAt: 3.35,
        lamps: [[[-72, -16.05], [-66, -16.0], [-37, -14.75], [-8, -13.5], [11, -12.0], [30, -10.2], [49, -8.2], [68, -6.21], [73, -5.66]], [[-72, -8.48], [-66, -8.3], [-37, -7.7], [-8, -7.1], [11, -7.0], [30, -7.1], [49, -7.3], [68, -7.6], [73, -7.59]], [[-72, -0.24], [-66, -0.1], [-37, 0.64], [-8, 1.39], [11, 2.08], [30, 2.91], [49, 4.08], [68, 5.68], [73, 6.14]], [[-72, 6.58], [-66, 6.73], [-37, 7.25], [-8, 7.76], [11, 7.75], [30, 7.5], [49, 7.0], [68, 6.18], [73, 5.92]], [[-72, 10.98], [-66, 11.13], [-37, 11.65], [-8, 12.16], [11, 12.15], [30, 11.9], [49, 11.4], [68, 10.58], [73, 10.32]]] },
      // the eastern platform's columns, lit at their heads, and the middle island's
      { kind: 'columns', size: 0.6, from: 0, to: 3.98, color: 0x5e2427, crown: { h: 0.9, size: 1.7, colors: [0xd8262a, 0x2856d4] },
        at: [[-63.75, 14.54], [-56.25, 14.67], [-48.75, 14.81], [-41.25, 14.95], [-33.75, 15.08], [-26.25, 15.22], [-18.75, 15.35], [-11.25, 15.49], [-3.75, 15.53], [3.75, 15.53], [18.75, 15.42], [26.25, 15.32], [33.75, 15.17], [41.25, 14.97], [48.75, 14.78], [56.25, 14.46], [63.75, 14.14]] },
      { kind: 'columns', size: 0.45, from: 0, to: 3.98, color: 0xa2a6a8, at: [[26.25, 5.15], [33.75, 5.27], [41.25, 5.4], [48.75, 5.54]] },
      // the canopy's posts, and the walkway's
      { kind: 'columns', size: 0.25, from: 4.6, to: 8.2, color: 0x2e3236,
        at: [[-78, 24], [-84, 24], [-90, 24], [-96, 24], [-102, 24], [-108, 24], [-114, 24], [-119.6, 24]] },
      { kind: 'columns', size: 0.35, from: -1.5, to: 4.6, color: 0x8d9093,
        at: [[-116, -27.4], [-128, -27.6], [-140, -27.8], [-152, -28.0], [-164, -28.2], [-176, -28.4], [-188, -28.6]] },
      { kind: 'roundel', s: -98, u: 24.3, h: 9.4, size: 0.9, foot: 8.75 },
    ],
  },

  // Midsommarkransen (5 April 1964), in rock about 21 m under the hill between Svandammsvägen and
  // Övre Bergsvägen: two platform halls, one for each track, the platforms within either side of a
  // core of rock, joined through it by a hall a little north-east of the middle (the halls are
  // src/hall-styles.ts's VAULT_STYLES; OpenStreetMap's platforms and indoor ways, 2026; Albert
  // Guillaumes's drawing, 2024). From photographs (2005–2025, Wikimedia Commons; KransenKidz, 2025):
  //
  // The middle hall's walls are the halls' cream tiles on end to about 2.5 m, under a band of brown
  // glazed tiles, its ceiling white, its floor polished dark grey stone; it opens to the platforms
  // either side through screens of glass in steel frames. Over its middle hangs the midsummer
  // wreath (1978, inaugurated 1979): carved and painted alder, over 3 m across, made by Hans and
  // Anna Flemström Nilsson and Stina Zetterman, students at Konstfack, with the suburb's people in a
  // workshop by Skvallertorget, hung flat on four wires from a plate on the ceiling. On the hall's
  // south-western wall a panel framed in posts and rails of dark green wound with red, FÖRSTADEN ·
  // MIDSOMMARKRANSEN in gold along its top, over a panorama of the old garden suburb in black on
  // white, and either side of it a smaller wreath of theirs on dark boards. On the wall behind the
  // north-western platform a painted wooden relief of a summer night, birches and boards of deep
  // blue, yellow and orange, red figures among them, on a dark rock (sv.wikipedia gives the
  // station's reliefs to Lisbet Lindholm, "Blommor till Midsommarkransen", 1990, and to Dag Wallin;
  // which this is isn't said).
  //
  // From the hall's north-eastern side three escalators climb inside the core to a passage 12 m up,
  // a corridor beside them to the lift and to the south-eastern platform; past the gates the
  // passage splits. North-west, a walkway 61 m long, lined in the same tiles, rises gently under
  // Tegelbruksvägen to the entrance at the foot of the hill: a box of board-marked concrete set into
  // the slope, glass doors under SL's blue band, a flat roof reaching out over them on a soffit of
  // varnished boards, and the T on its roof. South-east, a passage crosses over the south-eastern
  // hall to stairs up into the building on Svandammsvägen, whose doors open between its shops.
  'Midsommarkransen': {
    rooms: [
      { name: 'middle hall, opening north-west', s: [23.5, 36.5], u: [-9.3, -8.4], h: [-1, 0.5], walls: null, floor: null },
      { name: 'middle hall, opening south-east', s: [23.5, 36.5], u: [8.4, 9.3], h: [-1, 0.5], walls: null, floor: null },
      { name: 'middle hall', s: [23.5, 36.5], u: [-8.4, 8.4], h: [-1, 0.5], walls: 'kransenHall', floor: 'darkTiles', ceiling: 'whiteRender' },
      { name: 'lift corridor, opening', s: [57.5, 60.5], u: [8.4, 9.3], h: [-1, 0.5], walls: null, floor: null },
      { name: 'lift corridor', s: [35, 61.5], u: [4.9, 8.4], h: [-1, 0.5], walls: 'kransenTiles', floor: 'darkTiles', ceiling: 'whiteRender' },
      { name: 'escalators', s: [33, 58.5], u: [-1, 4.5], h: [-1, 13.5], walls: 'kransenTiles', stairs: 'kransenTiles', ceiling: 'whiteRender' },
      { name: 'stairs to Svandammsvägen', s: [55, 75], u: [45, 64], h: [11, 17], walls: 'kransenTiles', stairs: 'kransenTiles', floor: 'darkTiles', ceiling: 'whiteRender' },
      { name: 'passage', s: [55, 80], u: [-6, 45], h: [11, 14], walls: 'kransenTiles', floor: 'darkTiles', ceiling: 'whiteRender' },
      { name: 'walkway to Tegelbruksvägen', s: [64, 80], u: [-67, -6], h: [11, 17], walls: 'kransenTiles', floor: 'darkTiles', ceiling: 'whiteRender' },
    ],
    buildings: ['w572407066'],
    blocks: [
      // the entrance at the foot of the hill, its doors, and its roof reaching out over them
      { name: 'entrance at the foot of the hill', plan: [[67.3, -65.1], [75.2, -65.1], [75.1, -60.85], [67.2, -60.95]], h: [15.0, 18.95], from: 15.65,
        walls: 'boardConcrete', ceiling: 'whiteRender', roof: 0.4, roofColor: 0x55634a, ground: true },
      // the walls of rough granite holding the slope back either side of it
      { name: 'retaining wall west of the entrance', plan: [[60.5, -65.0], [67.2, -65.0], [67.2, -64.2], [60.5, -64.2]], h: [14.6, 18.6], from: 14.83, walls: 'granite' },
      { name: 'retaining wall east of the entrance', plan: [[75.2, -64.9], [90.0, -64.9], [90.0, -64.1], [75.2, -64.1]], h: [14.6, 16.6], from: 14.83, walls: 'granite' },
      { name: 'doors to Tegelbruksvägen', plan: [[69.9, -65.1], [73.7, -65.1], [73.7, -65.4], [69.9, -65.4]], h: [15.5, 18.65], from: 15.65,
        walls: 'glassFront', sides: [null, null, undefined, null], nameSign: { side: 2, at: 0.5, length: 3.6, bottom: 18.0 } },
      { name: "entrance's roof", plan: [[66.8, -66.4], [75.7, -66.4], [75.7, -65.1], [66.8, -65.1]], h: [18.95, 18.95], from: 18.95,
        walls: 'whiteRender', sides: [null, null, null, null], ceiling: 'pineBoards', roof: 0.4, roofColor: 0xd5d8d9 },
      // the doors in the building on Svandammsvägen
      { name: 'doors to Svandammsvägen', plan: [[58.72, 59.69], [61.38, 62.12], [61.18, 62.35], [58.52, 59.92]], h: [15.9, 19.5], from: 16.14,
        walls: 'glassFront', sides: [null, null, undefined, null], nameSign: { side: 2, at: 0.5, length: 3.6, bottom: 18.95 } },
      // and the piers of polished granite either side of them
      { name: 'pier west of the doors', plan: [[58.09, 59.12], [58.72, 59.69], [58.52, 59.92], [57.89, 59.35]], h: [15.9, 19.5], from: 16.14, walls: 'redGranite' },
      { name: 'pier east of the doors', plan: [[61.38, 62.12], [62.01, 62.69], [61.81, 62.92], [61.18, 62.35]], h: [15.9, 19.5], from: 16.14, walls: 'redGranite' },
    ],
    // the screens between the middle hall and the platforms
    fences: [
      { points: [[24, -8.53], [36, -8.53]], h: [0, 3.35], kind: 'glass' },
      { points: [[24, 8.53], [36, 8.53]], h: [0, 3.35], kind: 'glass' },
    ],
    art: [
      { kind: 'wreath', s: 30, u: 0, h: 2.6, size: 3.3, thick: 0.42, ceiling: 3.35 },
      { kind: 'mural', picture: 'forstaden', s: 24.0, u: 0, turn: 0, bottom: 0, top: 2.55, width: 6.6 },
      { kind: 'wreath', s: 24.16, u: 1.93, h: 1.67, size: 0.95, thick: 0.2, turn: 0 },
      { kind: 'wreath', s: 24.16, u: -1.93, h: 1.67, size: 0.95, thick: 0.2, turn: 0 },
      { kind: 'mural', picture: 'summerNight', s: -18, u: -8.53, turn: -Math.PI / 2, bottom: 0.45, top: 2.9, width: 2.7 },
      { kind: 'roundel', s: 71.8, u: -64.2, h: 20.35, size: 1.0, foot: 19.35 },
    ],
  },

  // Telefonplan (5 April 1964): an island platform in a cutting blasted through the rock, 5.5 m
  // under the streets and the square Telefonplan by LM Ericsson's old head office, narrowing from 10.5 m
  // at its west end, where the tracks part round the siding between them into tunnels of their own
  // under the station's building, to 4 m at its east end before the tunnel's portal. Photographs
  // (1964, 2005, 2016 and 2021) show the cutting's walls of grey rock stained rust brown, a wall of
  // grey boards along the top of the north wall's western half and chain-link along their tops.
  // Over the platform's western 95 m a low roof of two near-flat halves, 2.95 m over the platform at
  // its valley and 3.35 m at its edges (Lantmäteriet's laser scan): dark ribbed sheet metal under
  // dark purlins and rafters, a dark felt covering, on columns and beams of steel painted yellow
  // ochre. Bo Samuelsson renewed it in 1997 (his plaque on the platform): chosen parts clad in
  // glossy yellow clinker, the columns painted anew, the name in Morse code in fields of green
  // clinker, and figures, life-size, of people who lent their likeness.
  //
  // From 23 m west of the platform's middle a ramp climbs along the northern half of the island to
  // a deck 4.6 m up at its west end (OpenStreetMap; Albert Guillaumes' drawing), between low walls of
  // the yellow clinker, the southern one with the Morse code on its face and the name on a black
  // sign; the roof climbs over it with it (the laser scan: from 3.6 m over the platform 30 m west of
  // its middle to 9 m at the building), its columns in pairs on the walls. At the platform's west
  // end an escalator (south) and stairs (north) climb to the deck beside the lift, over a lobby with
  // glass doors onto the platform; on the roof over the ramp's top stands a glazed box. From the
  // deck a ramp goes up into the building over the tracks' tunnels, under a flat roof with a dark
  // fascia: its face to the tracks board-marked concrete with slits of windows; to the street north
  // of it a newsagent's front, shop windows full of posters between yellow posts under black-painted
  // panels, which turns the corner to the west, where the station's doors under SL's blue sign and a
  // florist's windows follow it; and to the square south of it, red-brown brick, the florist's black
  // board, the main doors set back under a dark ribbed fascia with SL's sign along its foot, the round
  // sign on a bracket beside them, an orange door and three windows (photographs, 2016–2020; Google's
  // 3D mesh). Its hall is at the street (a pale terrazzo floor, a white slatted ceiling, brick walls).
  //
  // East of the roof the platform is open, lit by yellow-ochre posts, each with a lantern either
  // side on an arm and the name on a black sign, and a yellow gate closes its east end.
  //
  // Not drawn: the figures, the planters, the shops inside the building, the main doors' depth (drawn
  // on the wall), the skylights on its roof, the buses' loop south of it, and the track's fall to the
  // east portal (1.9 m: the network's track is level through the station).
  'Telefonplan': {
    // the roof over the platform east of the ramp, on pairs of columns down its middle
    roof: {
      kind: 'butterfly',
      from: -25, to: 6.6, width: 9.4,
      shape: [[-88, 1.11, 11.0], [-80, 0.98, 10.86], [-70, 0.85, 10.66], [-60, 0.69, 10.26], [-50, 0.56, 10.06], [-40, 0.48, 9.76],
        [-30, 0.38, 9.66], [-20, 0.24, 9.36], [-10, 0.12, 9.16], [0, -0.02, 8.76], [6.6, -0.14, 8.66]],
      middle: 2.95, edge: 3.35, thick: 0.25, fascia: 0.3,
      rafters: 6, rafterAt: -22, rafterSize: [0.15, 0.15], rafterColor: 0x2d2f31, deck: 'ribbed',
      purlins: { at: [-4, -2.5, -1, 1, 2.5, 4], size: [0.12, 0.2], color: 0x2d2f31 },
      beam: 0.2,
      columns: { every: 6, at: -22, size: 0.2, plinth: { size: 0.2, height: 0.01 }, pair: 1.0, cross: [2.55, 0.25] },
      lamps: { offset: 2.6, length: 1.2, every: 6 },
      colors: { underside: 0x404244, fascia: 0x2e3032, top: 0x3a3836, steel: 0xc79a2e },
      signs: { at: [-18, -6], back: 'Mikrofonvägen', ahead: '' },
      clocks: [[1, 0.8]],
      // (trains keep left: those towards T-Centralen stop on the northern track)
      boards: [
        { s: -10, u: -2.2, toward: 'T-Centralen', trains: ['14 Mörby centrum  3 min', '14 Mörby centrum  13 min'] },
        { s: -10, u: 2.2, toward: 'Fruängen', trains: ['14 Fruängen  5 min', '14 Fruängen  15 min'] },
      ],
    },
    // and over the ramp, climbing with it to the building, its columns in pairs on the ramp's walls
    roofs: [{
      kind: 'butterfly',
      from: -88, to: -25, width: 10.0,
      shape: [[-88, 1.11, 11.0], [-80, 0.98, 10.86], [-70, 0.85, 10.66], [-60, 0.69, 10.26], [-50, 0.56, 10.06], [-40, 0.48, 9.76],
        [-30, 0.38, 9.66], [-20, 0.24, 9.36], [-10, 0.12, 9.16], [0, -0.02, 8.76], [6.6, -0.14, 8.66]],
      climb: [[-88, 5.73], [-31, 0]],
      middle: 2.95, edge: 3.35, thick: 0.25, fascia: 0.3,
      rafters: 6, rafterAt: -34, rafterSize: [0.15, 0.15], rafterColor: 0x2d2f31, deck: 'ribbed',
      purlins: { at: [-4, -2.5, -1, 1, 2.5, 4], size: [0.12, 0.2], color: 0x2d2f31 },
      beam: 0.2,
      columns: { every: 6, at: -34, size: 0.2, plinth: { size: 0.2, height: 0.01 }, pair: 3.1, offset: -0.85, between: [-80, -30], cross: [2.55, 0.25] },
      lamps: { offset: 2.6, length: 1.2, every: 6 },
      colors: { underside: 0x404244, fascia: 0x2e3032, top: 0x3a3836, steel: 0xc79a2e },
      signs: { at: [], back: '', ahead: '' },
    }],
    paving: {
      edge: 0.65, tactile: [0.9, 1.2], slabs: 1.2, paverSize: [0.3, 0.15], mix: 0.12,
      colors: { edge: 0xcfcdc6, tactile: 0xc3c0b8, slab: 0x8e8b86, pavers: 0x8e8b86, face: 0x8a8781, paler: 0x7c7975 },
      pattern: 'bond',
    },
    rooms: [
      // (the ramp's walls, and the lobby's under the deck, are the blocks')
      { name: 'ramp', s: [-83, -22], u: [-3.3, 0.7], h: [-0.5, 4.7], walls: null, floor: 'darkTiles' },
      { name: "platform's west end", s: [-84, -68], h: [-0.5, 0.5], walls: null, floor: null, stairs: 'ochreClinker', parapet: 1.0 },
      { name: 'deck', s: [-88, -76], h: [4, 5], walls: null, floor: 'darkTiles', slab: 0.4 },
      { name: 'hall', s: [-113, -88], u: [-12, 11], h: [4, 7], walls: 'brick', floor: 'terrazzo', ceiling: 'slats' },
    ],
    blocks: [
      // the ramp's walls, rising with it 1.1 m (south) and 1 m (north) over its floor; on the south
      // wall's face the name in Morse code, and the name on a black sign
      { name: "ramp's south wall, at its foot", plan: [[-30.5, 0.868], [-22.81, 0.915], [-22.81, 0.665], [-30.5, 0.618]], h: [0, 1.74], low: 1.1,
        walls: 'ochreClinker', sides: [undefined, undefined, undefined, null], roof: 0.04, roofColor: 0xb4b7b9, onPlatform: true },
      { name: "ramp's south wall, east", plan: [[-45.53, 0.587], [-30.5, 0.868], [-30.5, 0.618], [-45.53, 0.337]], h: [0, 2.99], low: 1.74,
        walls: 'ochreClinker', sides: [undefined, null, undefined, null], roof: 0.04, roofColor: 0xb4b7b9, onPlatform: true },
      { name: "ramp's south wall, the Morse code", plan: [[-60, 0.27], [-45.53, 0.587], [-45.53, 0.337], [-60, 0.02]], h: [0, 4.2], low: 2.99,
        walls: 'ochreClinker', sides: ['morseClinker', null, undefined, null], roof: 0.04, roofColor: 0xb4b7b9, onPlatform: true,
        nameSign: { side: 0, at: 0.06, length: 1.6, bottom: 2.35, black: true } },
      { name: "ramp's south wall, west", plan: [[-78, -0.091], [-60, 0.27], [-60, 0.02], [-78, -0.341]], h: [0, 5.7], low: 4.2,
        walls: 'ochreClinker', sides: [undefined, null, undefined, null], roof: 0.04, roofColor: 0xb4b7b9, onPlatform: true },
      { name: "ramp's south wall, at its top", plan: [[-81, -0.137], [-78, -0.091], [-78, -0.341], [-81, -0.387]], h: [0, 5.7],
        walls: 'ochreClinker', sides: [undefined, null, undefined, null], roof: 0.04, roofColor: 0xb4b7b9, onPlatform: true },
      { name: "ramp's north wall, at its foot", plan: [[-30.5, -2.482], [-22.81, -2.435], [-22.81, -2.185], [-30.5, -2.232]], h: [0, 1.64], low: 1.0,
        walls: 'ochreClinker', sides: [undefined, undefined, undefined, null], roof: 0.04, roofColor: 0xb4b7b9, onPlatform: true },
      { name: "ramp's north wall, east", plan: [[-50, -2.875], [-30.5, -2.482], [-30.5, -2.232], [-50, -2.625]], h: [0, 3.27], low: 1.64,
        walls: 'ochreClinker', sides: [undefined, null, undefined, null], roof: 0.04, roofColor: 0xb4b7b9, onPlatform: true },
      { name: "ramp's north wall", plan: [[-70, -3.273], [-50, -2.875], [-50, -2.625], [-70, -3.023]], h: [0, 4.93], low: 3.27,
        walls: 'ochreClinker', sides: [undefined, null, undefined, null], roof: 0.04, roofColor: 0xb4b7b9, onPlatform: true },
      { name: "ramp's north wall, west", plan: [[-78, -3.441], [-70, -3.273], [-70, -3.023], [-78, -3.191]], h: [0, 5.6], low: 4.93,
        walls: 'ochreClinker', sides: [undefined, null, undefined, null], roof: 0.04, roofColor: 0xb4b7b9, onPlatform: true },
      { name: "ramp's north wall, at its top", plan: [[-81, -3.487], [-78, -3.441], [-78, -3.191], [-81, -3.237]], h: [0, 5.6],
        walls: 'ochreClinker', sides: [undefined, null, undefined, null], roof: 0.04, roofColor: 0xb4b7b9, onPlatform: true },
      // the lobby under the deck, its glass doors onto the platform's southern half
      { name: 'lobby, south', plan: [[-81, 0.1], [-88, 0.1], [-88, 4.2], [-81, 4.2]], h: [0, 4.2],
        walls: 'ochreClinker', sides: [null, null, undefined, 'glazed'], onPlatform: true },
      { name: 'lobby, north', plan: [[-81, -6.1], [-88, -6.1], [-88, 0.1], [-81, 0.1]], h: [0, 4.2],
        walls: 'ochreClinker', sides: [undefined, null, null, undefined], onPlatform: true },
      // the station's building over the tracks' tunnels, its hall at the street: to the street north
      // of it a newsagent's front, to the west the newsagent's, the station's doors under SL's sign
      // and a florist's, to the south brick round the main doors, to the tracks board-marked concrete
      { name: 'station building', plan: [[-87.61, -10.7], [-112.0, -11.14], [-112.37, 10.09], [-87.97, 10.52]], h: [3.6, 10.1], from: 5.6,
        walls: 'brick', sides: ['kioskFront', 'tfpWestFront', 'tfpSouthFront', 'boardConcrete'], ceiling: 'slats', roof: 0.3, roofColor: 0x3a3c3e,
        ground: true, nameSign: { side: 1, at: 0.4, length: 2.6, bottom: 8.2 } },
      // the dark ribbed fascia over the main doors, SL's blue sign along its foot
      { name: 'fascia over the main doors', plan: [[-100.97, 10.29], [-107.17, 10.18], [-107.17, 10.43], [-100.97, 10.54]], h: [8.6, 10.1], from: 8.6,
        walls: 'greyPanels', floor: 'whitePanels', roof: 0.05, roofColor: 0x3a3c3e, nameSign: { side: 2, at: 0.5, length: 5.8, bottom: 8.62 } },
      // and the bracket of the round sign beside them
      { name: "round sign's bracket", plan: [[-100.6, 10.35], [-100.7, 10.35], [-100.7, 10.95], [-100.6, 10.95]], h: [8.92, 9.0], from: 8.92,
        walls: 'greyPanels', roof: 0.01, roofColor: 0x2f5fa8 },
      // the glazed box on the roof over the ramp's top
      { name: 'glazed box', plan: [[-72, -1.3], [-67, -1.3], [-67, 0.7], [-72, 0.7]], h: [6.8, 9.35], from: 6.8,
        walls: 'glazed', roof: 0.15, roofColor: 0x3a3c3e },
      // the street and the square beside the cutting's west end, where the city's ground still
      // dips towards the open tracks' cutting: paved, level with the deck round the building and
      // sloping away under the city's ground, their rock face over the cutting walls' tops
      { name: 'street beside the cutting', plan: [[-88, -11.15], [-93, -11.25], [-93, -27], [-88, -27]], h: [3.6, 5.6], lowBack: 4.8, from: 3.6,
        walls: 'blastedRock', sides: [null, null, null, undefined], roof: 0.05, roofColor: 0x75726d, ground: true },
      { name: 'square beside the cutting', plan: [[-88, 10.4], [-93, 10.3], [-93, 27], [-88, 27]], h: [3.6, 5.62], lowBack: 4.8, from: 3.6,
        walls: 'blastedRock', sides: [null, null, null, undefined], roof: 0.05, roofColor: 0x75726d, ground: true },
      // the cutting's north wall
      { name: 'north wall, -88 to -80', plan: [[-80, -10.5], [-88, -10.3], [-88, -30], [-80, -30]], h: [-2, 5.45], lowBack: 3.45, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, undefined, null, null] },
      { name: 'north wall, -80 to -72', plan: [[-72, -10.75], [-80, -10.5], [-80, -30], [-72, -30]], h: [-2, 5.45], lowBack: 3.45, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, -72 to -65', plan: [[-65, -11], [-72, -10.75], [-72, -30], [-65, -30]], h: [-2, 5.45], lowBack: 3.45, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, -65 to -58', plan: [[-58, -10.5], [-65, -11], [-65, -30], [-58, -30]], h: [-2, 5.45], lowBack: 3.45, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, -58 to -50', plan: [[-50, -10.75], [-58, -10.5], [-58, -30], [-50, -30]], h: [-2, 5.45], lowBack: 3.45, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, -50 to -42', plan: [[-42, -11.2], [-50, -10.75], [-50, -30], [-42, -30]], h: [-2, 5.45], lowBack: 3.45, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, -42 to -35', plan: [[-35, -11], [-42, -11.2], [-42, -30], [-35, -30]], h: [-2, 5.45], lowBack: 3.45, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, -35 to -28', plan: [[-28, -10.75], [-35, -11], [-35, -30], [-28, -30]], h: [-2, 5.47], low: 5.45, lowBack: 3.45, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, -28 to -20', plan: [[-20, -11], [-28, -10.75], [-28, -30], [-20, -30]], h: [-2, 5.55], low: 5.47, lowBack: 3.47, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, -20 to -12', plan: [[-12, -9.75], [-20, -11], [-20, -30], [-12, -30]], h: [-2, 5.63], low: 5.55, lowBack: 3.55, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, -12 to -4', plan: [[-4, -9.25], [-12, -9.75], [-12, -30], [-4, -30]], h: [-2, 5.65], low: 5.63, lowBack: 3.63, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, -4 to 4', plan: [[4, -9.25], [-4, -9.25], [-4, -30], [4, -30]], h: [-2, 5.65], lowBack: 3.65, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 4 to 12', plan: [[12, -10.25], [4, -9.25], [4, -30], [12, -30]], h: [-2, 5.65], lowBack: 3.65, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 12 to 20', plan: [[20, -12], [12, -10.25], [12, -30], [20, -30]], h: [-2, 5.72], low: 5.65, lowBack: 3.65, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 20 to 28', plan: [[28, -14], [20, -12], [20, -30], [28, -30]], h: [-2, 5.85], low: 5.72, lowBack: 3.72, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 28 to 35', plan: [[35, -12.5], [28, -14], [28, -30], [35, -30]], h: [-2, 5.85], lowBack: 3.85, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 35 to 42', plan: [[42, -11.25], [35, -12.5], [35, -30], [42, -30]], h: [-2, 5.29], low: 5.85, lowBack: 3.29, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 42 to 50', plan: [[50, -11], [42, -11.25], [42, -30], [50, -30]], h: [-2, 4.91], low: 5.29, lowBack: 2.91, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 50 to 60', plan: [[60, -11.25], [50, -11], [50, -30], [60, -30]], h: [-2, 4.34], low: 4.91, lowBack: 2.34, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 60 to 70', plan: [[70, -11], [60, -11.25], [60, -30], [70, -30]], h: [-2, 4.31], low: 4.34, lowBack: 2.31, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 70 to 80', plan: [[80, -12.25], [70, -11], [70, -30], [80, -30]], h: [-2, 4.28], low: 4.31, lowBack: 2.28, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 80 to 90', plan: [[90, -12.25], [80, -12.25], [80, -30], [90, -30]], h: [-2, 4.25], low: 4.28, lowBack: 2.25, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 90 to 100', plan: [[100, -13], [90, -12.25], [90, -30], [100, -30]], h: [-2, 4.75], low: 4.25, lowBack: 2.25, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 100 to 110', plan: [[110, -12.5], [100, -13], [100, -30], [110, -30]], h: [-2, 4.75], lowBack: 2.75, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'north wall, 110 to 124', plan: [[124, -11.75], [110, -12.5], [110, -30], [124, -30]], h: [-2, 4.75], lowBack: 2.75, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      // its south wall, west of the slope down to the tracks and east of it
      { name: 'south wall, -88 to -82', plan: [[-82, 10.25], [-88, 10.25], [-88, 30], [-82, 30]], h: [-2, 5.7], lowBack: 3.7, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, undefined, null, null] },
      { name: 'south wall, -82 to -77', plan: [[-77, 10.75], [-82, 10.25], [-82, 30], [-77, 30]], h: [-2, 5.7], lowBack: 3.7, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, -77 to -72', plan: [[-72, 10.25], [-77, 10.75], [-77, 30], [-72, 30]], h: [-2, 5.7], lowBack: 3.7, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, -72 to -67', plan: [[-67, 9.75], [-72, 10.25], [-72, 30], [-67, 30]], h: [-2, 5.7], lowBack: 3.7, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, -67 to -62', plan: [[-62, 9.75], [-67, 9.75], [-67, 30], [-62, 30]], h: [-2, 5.7], lowBack: 3.7, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, -62 to -57', plan: [[-57, 10.25], [-62, 9.75], [-62, 30], [-57, 30]], h: [-2, 5.7], lowBack: 3.7, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, -57 to -52', plan: [[-52, 10.75], [-57, 10.25], [-57, 30], [-52, 30]], h: [-2, 5.7], lowBack: 3.7, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, -52 to -47', plan: [[-47, 10.25], [-52, 10.75], [-52, 30], [-47, 30]], h: [-2, 5.7], lowBack: 3.7, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, -47 to -42', plan: [[-42, 11.25], [-47, 10.25], [-47, 30], [-42, 30]], h: [-2, 5.7], lowBack: 3.7, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, -42 to -37', plan: [[-37, 11.25], [-42, 11.25], [-42, 30], [-37, 30]], h: [-2, 5.7], lowBack: 3.7, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, -37 to -32', plan: [[-32, 10.75], [-37, 11.25], [-37, 30], [-32, 30]], h: [-2, 5.7], lowBack: 3.7, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x75726d, ground: true, sides: [undefined, null, null, undefined] },
      { name: 'south wall, 5 to 17', plan: [[17, 9.75], [5, 10.25], [5, 30], [17, 30]], h: [-2, 3.53], low: 3.55, lowBack: 1.53, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, undefined, null, null] },
      { name: 'south wall, 17 to 22', plan: [[22, 8.75], [17, 9.75], [17, 30], [22, 30]], h: [-2, 3.51], low: 3.53, lowBack: 1.51, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 22 to 27', plan: [[27, 8.75], [22, 8.75], [22, 30], [27, 30]], h: [-2, 3.49], low: 3.51, lowBack: 1.49, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 27 to 32', plan: [[32, 7.75], [27, 8.75], [27, 30], [32, 30]], h: [-2, 3.48], low: 3.49, lowBack: 1.48, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 32 to 37', plan: [[37, 7.75], [32, 7.75], [32, 30], [37, 30]], h: [-2, 3.46], low: 3.48, lowBack: 1.46, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 37 to 42', plan: [[42, 8.25], [37, 7.75], [37, 30], [42, 30]], h: [-2, 3.47], low: 3.46, lowBack: 1.46, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 42 to 47', plan: [[47, 7.75], [42, 8.25], [42, 30], [47, 30]], h: [-2, 3.51], low: 3.47, lowBack: 1.47, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 47 to 52', plan: [[52, 6.75], [47, 7.75], [47, 30], [52, 30]], h: [-2, 3.55], low: 3.51, lowBack: 1.51, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 52 to 57', plan: [[57, 6.25], [52, 6.75], [52, 30], [57, 30]], h: [-2, 3.59], low: 3.55, lowBack: 1.55, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 57 to 62', plan: [[62, 5.75], [57, 6.25], [57, 30], [62, 30]], h: [-2, 3.63], low: 3.59, lowBack: 1.59, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 62 to 67', plan: [[67, 4.75], [62, 5.75], [62, 30], [67, 30]], h: [-2, 3.91], low: 3.63, lowBack: 1.63, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 67 to 72', plan: [[72, 5.25], [67, 4.75], [67, 30], [72, 30]], h: [-2, 4.35], low: 3.91, lowBack: 1.91, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 72 to 77', plan: [[77, 4.25], [72, 5.25], [72, 30], [77, 30]], h: [-2, 4.54], low: 4.35, lowBack: 2.35, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 77 to 82', plan: [[82, 3.75], [77, 4.25], [77, 30], [82, 22]], h: [-2, 5.08], low: 4.54, lowBack: 2.54, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 82 to 87', plan: [[87, 3.25], [82, 3.75], [82, 22], [87, 22]], h: [-2, 6.14], low: 5.08, lowBack: 3.08, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 87 to 92', plan: [[92, 2.25], [87, 3.25], [87, 22], [92, 22]], h: [-2, 6.36], low: 6.14, lowBack: 4.14, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 92 to 97', plan: [[97, 2.25], [92, 2.25], [92, 22], [97, 22]], h: [-2, 6.38], low: 6.36, lowBack: 4.36, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 97 to 102', plan: [[102, 1.75], [97, 2.25], [97, 22], [102, 22]], h: [-2, 6.39], low: 6.38, lowBack: 4.38, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 102 to 107', plan: [[107, 1.75], [102, 1.75], [102, 22], [107, 22]], h: [-2, 6.4], low: 6.39, lowBack: 4.39, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 107 to 112', plan: [[112, 1.25], [107, 1.75], [107, 22], [112, 22]], h: [-2, 6.42], low: 6.4, lowBack: 4.4, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 112 to 117', plan: [[117, 0.75], [112, 1.25], [112, 22], [117, 22]], h: [-2, 6.43], low: 6.42, lowBack: 4.42, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
      { name: 'south wall, 117 to 124', plan: [[124, 0.75], [117, 0.75], [117, 22], [124, 22]], h: [-2, 6.45], low: 6.43, lowBack: 4.43, from: -2,
        walls: 'blastedRock', roof: 0.05, roofColor: 0x55623c, ground: true, sides: [undefined, null, null, null] },
    ],
    buildings: ['w23115973'],
    fences: [
      // railings along the deck's sides
      { points: [[-80.5, -5.85], [-87.5, -5.85]], h: [4.6, 5.7], kind: 'rails', color: 0xb4b7b9 },
      { points: [[-80.5, 3.95], [-87.5, 3.95]], h: [4.6, 5.7], kind: 'rails', color: 0xb4b7b9 },
      // grey boards over the north wall's western half, and chain-link along the cutting's tops
      { points: [[-88, -10.15], [-80, -10.35], [-72, -10.6], [-65, -10.85], [-58, -10.35], [-50, -10.6], [-42, -11.05], [-35, -10.85]], h: [2.0, 6.2], kind: 'boards', color: 0x8d8f8c },
      { points: [[-88, -10.9, 0], [-80, -11.1, 0], [-72, -11.35, 0], [-65, -11.6, 0], [-58, -11.1, 0], [-50, -11.35, 0], [-42, -11.8, 0], [-35, -11.6, 0], [-28, -11.35, 0.02], [-20, -11.6, 0.1], [-12, -10.35, 0.18], [-4, -9.85, 0.2], [4, -9.85, 0.2], [12, -10.85, 0.2], [20, -12.6, 0.27], [28, -14.6, 0.4], [35, -13.1, 0.4], [42, -11.85, -0.16], [50, -11.6, -0.54], [60, -11.85, -1.11], [70, -11.6, -1.14], [80, -12.85, -1.17], [90, -12.85, -1.2], [100, -13.6, -0.7], [110, -13.1, -0.7], [124, -12.35, -0.7]],
        h: [5.5, 7.3] },
      { points: [[-88, 10.85, 0], [-82, 10.85, 0], [-77, 11.35, 0], [-72, 10.85, 0], [-67, 10.35, 0], [-62, 10.35, 0], [-57, 10.85, 0], [-52, 11.35, 0], [-47, 10.85, 0], [-42, 11.85, 0], [-37, 11.85, 0], [-32, 11.35, 0]],
        h: [5.75, 7.55] },
      { points: [[5, 10.85, 0], [17, 10.35, -0.02], [22, 9.35, -0.04], [27, 9.35, -0.06], [32, 8.35, -0.07], [37, 8.35, -0.09], [42, 8.85, -0.08], [47, 8.35, -0.04], [52, 7.35, 0], [57, 6.85, 0.04], [62, 6.35, 0.08], [67, 5.35, 0.36], [72, 5.85, 0.8], [77, 4.85, 0.99], [82, 4.35, 1.52], [87, 3.85, 2.59], [92, 2.85, 2.81], [97, 2.85, 2.83], [102, 2.35, 2.84], [107, 2.35, 2.85], [112, 1.85, 2.87], [117, 1.35, 2.88], [124, 1.35, 2.9]],
        h: [3.6, 5.4] },
      // the yellow gate across the platform's east end
      { points: [[86.5, -5.85], [86.5, -2.5]], h: [0, 1.6], kind: 'bars', color: 0xd4ad3c },
    ],
    art: [
      // the lamp posts out on the open platform
      { kind: 'masts', at: [[24.9, -0.6], [43.9, -1.07], [60.6, -3.0], [74.6, -3.6]], height: 4.8, color: 0xc9a43a, top: false, arm: 0.9, sign: 2.7, shade: 0x9a9c9e },
      // the round sign on its bracket beside the main doors
      { kind: 'roundel', s: -100.65, u: 11.35, h: 8.96, size: 0.8, foot: 8.55, along: true },
    ],
  },

  // Hägerstensåsen (5 April 1964; a tram stop from 1946): an island platform in the open between
  // two tracks, the north one curving along it, its west end on the bridge over Personnevägen, its
  // east end in a rock cutting against the station's building over the mouth of the tunnel to
  // Telefonplan (Swedish Wikipedia; OpenStreetMap). Over all of it a flat roof, its underside 3.5 m
  // over the platform (Lantmäteriet's laser scan, which puts its top 4.8 m over the track bed from
  // one end to the other), widening to 11.6 m where the tracks part: white boards along the
  // platform between white beams cantilevered either way from a steel beam along it, painted
  // oxblood, on pairs of oxblood posts with a tie and a brace between them, a dark fascia and
  // covering, strip lights along both edges; a black name sign and white signs to the exits; grey
  // slabs in a bond, a pale edge and a ribbed strip; galvanised mesh railings beyond both tracks
  // (photographs, 2005 and 2016).
  //
  // At the west end a waiting room with glass doors onto the platform (its finishes are the east
  // one's: a dado of glazed tiles in oxblood, white and grey, glass in oxblood frames, a floor of
  // red-brown and grey tiles; a guess at this end) leads into a stair house between the tracks, an
  // escalator and stairs down west beside the lift to the ticket hall under the bridge, at the
  // street 5 m below (OpenStreetMap's indoor mapping: the escalator from 59.6 m to 67.7 m west of
  // the middle, the gates at 76 m, the doors at 80 m; the laser scan; Albert Guillaumes' drawing):
  // white-painted walls, a sloping ceiling of dark-stained boards, clerestory windows in oxblood
  // frames, the floor of red-brown and grey tiles (a photograph, 2016). Its outside, white render
  // and a glass front with SL's blue band to the street, is a guess.
  //
  // At the east end the lift stands on the platform in a glazed tower framed in oxblood, and the
  // waiting room behind it (a photograph, 2016) leads to the stairs and an escalator up east,
  // between walls of the same tiles, into the pavilion over the tracks at Sedelvägen, 5.8 m up
  // (OpenStreetMap: the stairs from 102.4 m east, the gates at 119.5 m, the doors at 129 m): a flat
  // roof with a deep dark fascia over a row of clerestory windows in teak-brown frames; its front
  // dark brown ribbed sheet to the glass doors under SL's blue band, red-brown brick beyond them
  // with a newsagent's window and its boards; the round sign on a pole before it (a photograph,
  // 2016; Google's 3D mesh). No art is known at the station.
  //
  // Not drawn: the glass balustrades round the grated wells either side of the pavilion's doors,
  // the booth by the gates, the downpipes by the posts, the mesh gate at the platform's east end,
  // and the shelter's exact place (a guess).
  'Hägerstensåsen': {
    roof: {
      kind: 'butterfly',
      from: -50.5, to: 98.4, width: 10.1,
      shape: [[-50.5, -2.59, 7.2], [-40, -2.2, 7.7], [-20, -1.78, 9.3], [-10, -1.3, 9.25], [0, -1.04, 10.1], [10, -0.46, 10.1], [20, -0.14, 10.8],
        [30, -0.03, 11.4], [40, -0.13, 11.6], [50, -0.08, 11.2], [60, -0.42, 11.25], [70, -0.76, 10.5], [80, -0.9, 9.8], [89, -1.42, 8.9]],
      climb: [[-50, 0.22], [-20, 0]],
      middle: 3.45, edge: 3.55, thick: 0.33, fascia: 0.22,
      rafters: 1.9, rafterSize: [0.1, 0.24], deck: 'boards',
      beam: 0.45,
      columns: { every: 7.6, at: 0, size: 0.18, plinth: { size: 0.25, height: 0.02 }, pair: 1.3, offset: 1.6, ties: [0.6, 2.4], between: [-50, 92] },
      lamps: { offset: 3.3, length: 1.5, every: 1.9, at: [-3.3, 3.3] },
      colors: { underside: 0xe9e7e0, fascia: 0x3a3c3f, top: 0x77746f, steel: 0x5c2b25 },
      signs: { at: [-38, -5, 30, 70], back: 'Personnevägen', ahead: 'Hägerstensåsen' },
      // (trains keep left: those towards T-Centralen stop on the northern track)
      boards: [
        { s: 72, u: -2.6, toward: 'T-Centralen', trains: ['14 Mörby centrum  4 min', '14 Mörby centrum  14 min'] },
        { s: 72, u: 3.2, toward: 'Fruängen', trains: ['14 Fruängen  6 min', '14 Fruängen  16 min'] },
      ],
    },
    paving: {
      edge: 0.9, tactile: [0.9, 1.25], slabs: 1.25, paverSize: [0.6, 0.4], mix: 0.08,
      colors: { edge: 0xd9d7d0, tactile: 0xc2c0ba, slab: 0x9a9893, pavers: 0x9a9893, paler: 0x8a8c90, face: 0x8e8b85 },
      pattern: 'bond',
    },
    buildings: ['w1060586560', 'w651818427'],
    rooms: [
      // (the waiting rooms' walls and ceilings are their blocks')
      { name: 'west waiting room', s: [-59.6, -50], u: [-1.2, 4.5], h: [-0.3, 0.3], walls: null, floor: 'quarryTiles', lamps: 3.2 },
      { name: 'stairs down to the ticket hall', s: [-71.5, -59.6], u: [-1.1, 4.5], h: [-5.5, 0.5], walls: 'whiteRender', stairs: 'whiteRender', floor: 'quarryTiles', ceiling: 'darkBoards', parapet: 1.0, lamps: 3.2 },
      { name: 'ticket hall', s: [-85.5, -68], u: [-8, 9], h: [-5.5, -4.5], walls: null, floor: 'quarryTiles', ceiling: 'darkBoards', lamps: 2.8 },
      { name: 'Personnevägen', s: [-95, -83], u: [-8, 9], h: [-5.5, -4.5], walls: null, floor: 'pavers' },
      { name: 'stairs up to the pavilion', s: [102.3, 112.6], u: [-0.7, 2.6], h: [-0.3, 0.3], walls: 'tricolourTiles', stairs: 'tricolourTiles', floor: 'quarryTiles', ceiling: 'whitePanels', parapet: 1.0 },
      { name: 'east waiting room', s: [98.3, 103.6], u: [-1.4, 5.1], h: [-0.3, 0.3], walls: null, floor: 'quarryTiles', lamps: 3.2 },
      { name: "platform's east end", s: [88, 98.4], u: [-6, 6], h: [-0.3, 0.3], walls: null, floor: 'pavers' },
      { name: 'pavilion', s: [98.3, 129.3], u: [-7, 10.5], h: [5.5, 6.1], walls: null, floor: 'quarryTiles', ceiling: 'whitePanels', lamps: 2.9 },
      { name: 'Sedelvägen', s: [129, 140], u: [-12, 12], h: [5.5, 6.2], walls: null, floor: 'asphalt' },
    ],
    blocks: [
      // the west waiting room on the platform, its glass doors east onto it
      { name: 'west waiting room', plan: [[-59.6, -1.0], [-51.3, -1.0], [-51.3, 4.2], [-59.6, 4.2]], h: [-1.0, 3.6],
        walls: 'tricolourWindows', sides: [undefined, 'maroonGlazed', undefined, null], floor: 'quarryTiles', ceiling: 'whitePanels', roof: 0.25, roofColor: 0x47494c, onPlatform: true },
      // the stair house between the tracks, white inside, down to the hall; over the platform a
      // row of windows in oxblood frames under its sloping roof
      { name: 'stair house', plan: [[-71.5, -0.45], [-71.5, 4.45], [-59.6, 4.45], [-59.6, -1.0]], h: [-5, 2.6], from: -5,
        walls: 'whiteRender', sides: [undefined, undefined, null, undefined], onPlatform: true },
      { name: "stair house's top", plan: [[-71.5, -0.45], [-71.5, 4.45], [-59.6, 4.45], [-59.6, -1.0]], h: [2.6, 6.3], from: 2.6, lowBack: 4.0,
        walls: 'whiteRender', sides: ['maroonGlazed', 'maroonGlazed', undefined, undefined], ceiling: 'darkBoards', roof: 0.25, roofColor: 0x47494c, onPlatform: true },
      // the ticket hall under the bridge: under each track's deck, and between them, where its
      // ceiling rises under a roof of its own to its glass front to the street
      { name: 'ticket hall, north', plan: [[-62.7, -1.0], [-62.9, -7.9], [-81.1, -7.5], [-82.75, -1.0]], h: [-5.5, -2.0], from: -5,
        walls: 'whiteRender', sides: [undefined, undefined, undefined, null], floor: 'quarryTiles', ceiling: 'whitePanels', roof: 0.3, roofColor: 0x77756f, ground: true, onPlatform: true },
      { name: 'ticket hall, south', plan: [[-62.5, 4.1], [-62.5, 8.2], [-85.1, 8.7], [-84.0, 4.1]], h: [-6.5, -2.0], from: -5,
        walls: 'whiteRender', sides: [undefined, undefined, undefined, null], floor: 'quarryTiles', ceiling: 'whitePanels', roof: 0.3, roofColor: 0x77756f, ground: true, onPlatform: true },
      { name: 'ticket hall', plan: [[-71.5, 4.1], [-84.0, 4.1], [-82.75, -1.0], [-71.5, -1.0]], h: [-5, 1.8], from: -5, low: 0.5,
        walls: 'whiteRender', sides: [null, 'glassFront', null, null], floor: 'quarryTiles', ceiling: 'darkBoards', roof: 0.25, roofColor: 0x47494c,
        ground: true, onPlatform: true, nameSign: { side: 1, at: 0.58, length: 3.0, bottom: -2.62 } },
      { name: "ticket hall's north wall", plan: [[-71.5, -1.1], [-82.75, -1.1], [-82.75, -1.0], [-71.5, -1.0]], h: [-1.6, 1.8], from: -1.6, low: 0.5, walls: 'whiteRender', onPlatform: true },
      { name: "ticket hall's south wall", plan: [[-71.5, 4.1], [-84.0, 4.1], [-84.0, 4.2], [-71.5, 4.2]], h: [-1.6, 1.8], from: -1.6, low: 0.5, walls: 'whiteRender', onPlatform: true },
      // at the east end: the lift's glazed tower on the platform, open to the waiting room behind it
      { name: "lift's tower", plan: [[96.0, 2.1], [99.0, 2.1], [99.0, 4.8], [96.0, 4.8]], h: [0, 9.6],
        walls: 'maroonGlazed', sides: [undefined, null, undefined, undefined], roof: 0.12, roofColor: 0x4b2a25, onPlatform: true },
      { name: 'east waiting room', plan: [[98.4, -1.3], [103.6, -1.3], [103.6, 5.0], [98.4, 5.0]], h: [-1.0, 3.6],
        walls: 'tricolourWindows', sides: [undefined, 'tricolourTiles', undefined, undefined], floor: 'quarryTiles', ceiling: 'whitePanels', roof: 0.25, roofColor: 0x47494c, onPlatform: true },
      // the corridor from the lift's top stop to the pavilion, beside the stairs, on a wall of its own
      { name: 'corridor from the lift', plan: [[99.0, 2.65], [114.6, 2.65], [114.6, 5.0], [99.0, 5.0]], h: [3.6, 8.45], from: 5.8,
        walls: 'cladding', sides: [undefined, null, undefined, undefined], floor: 'quarryTiles', ceiling: 'whitePanels', roof: 0.25, roofColor: 0x3c3e41 },
      { name: "corridor's foot", plan: [[103.7, 2.65], [114.6, 2.65], [114.6, 5.0], [103.7, 5.0]], h: [-1.0, 3.6], walls: 'boardConcrete', onPlatform: true },
      // the stairs' walls, sloping with them, and their roof
      { name: "stairs' north wall", plan: [[111.1, -0.7], [102.4, -0.7], [102.4, -0.8], [111.1, -0.8]], h: [0, 8.45], low: 3.45,
        walls: 'cladding', sides: ['tricolourTiles', undefined, undefined, null] },
      { name: "stairs' north wall, top", plan: [[114.6, -0.7], [111.1, -0.7], [111.1, -0.8], [114.6, -0.8]], h: [0, 8.45],
        walls: 'cladding', sides: ['tricolourTiles', null, undefined, null] },
      { name: "stairs' south wall", plan: [[111.1, 2.62], [102.4, 2.62], [102.4, 2.52], [111.1, 2.52]], h: [0, 8.45], low: 3.45,
        walls: 'tricolourTiles', sides: [null, undefined, undefined, null] },
      { name: "stairs' south wall, top", plan: [[114.6, 2.62], [111.1, 2.62], [111.1, 2.52], [114.6, 2.52]], h: [0, 8.45],
        walls: 'tricolourTiles', sides: [null, null, undefined, null] },
      { name: "stairs' roof", plan: [[111.1, -0.8], [111.1, 2.65], [102.4, 2.65], [102.4, -0.8]], h: [3.44, 8.45], from: 3.44, lowBack: 3.45,
        walls: 'cladding', sides: [null, null, null, null], ceiling: 'whitePanels', roof: 0.25, roofColor: 0x3c3e41 },
      { name: "stairs' roof, top", plan: [[111.1, -0.8], [114.6, -0.8], [114.6, 2.65], [111.1, 2.65]], h: [8.44, 8.45], from: 8.44,
        walls: 'cladding', sides: [null, null, null, null], ceiling: 'whitePanels', roof: 0.25, roofColor: 0x3c3e41 },
      // the pavilion over the tracks, its doors east onto Sedelvägen
      // under its west front the tunnel's mouth, a wall of concrete over the cutting
      { name: 'over the tunnel, north', plan: [[114.4, -6.5], [114.6, -6.5], [114.6, -5.4], [114.4, -5.4]], h: [-2.0, 5.0], from: -2.0, walls: 'boardConcrete' },
      { name: 'over the northern track', plan: [[114.4, -5.4], [114.6, -5.4], [114.6, -0.8], [114.4, -0.8]], h: [3.3, 5.0], from: 3.3, walls: 'boardConcrete' },
      { name: 'over the tunnel, between the tracks', plan: [[114.4, -0.8], [114.6, -0.8], [114.6, 5.5], [114.4, 5.5]], h: [-2.0, 5.0], from: -2.0, walls: 'boardConcrete' },
      { name: 'over the southern track', plan: [[114.4, 5.5], [114.6, 5.5], [114.6, 9.8], [114.4, 9.8]], h: [3.3, 5.0], from: 3.3, walls: 'boardConcrete' },
      // and its sides down to the cutting (the southern one only as far as the trains keep clear of it)
      { name: 'over the tunnel, north side', plan: [[114.6, -6.6], [129.1, -6.6], [129.1, -6.5], [114.6, -6.5]], h: [-2.0, 5.0], from: -2.0, walls: 'boardConcrete' },
      { name: 'over the tunnel, south side', plan: [[114.6, 9.8], [121.5, 9.8], [121.5, 9.9], [114.6, 9.9]], h: [-2.0, 5.0], from: -2.0, walls: 'boardConcrete' },
      { name: 'pavilion', plan: [[114.6, 9.8], [129.1, 9.8], [129.1, -6.5], [114.6, -6.5]], h: [5.0, 9.15], from: 5.8,
        walls: 'brick', sides: [undefined, 'hgaFront', undefined, 'cladding'], band: { walls: 'greyPanels', from: 8.8 },
        floor: 'quarryTiles', ceiling: 'whitePanels', roof: 0.25, roofColor: 0x3a3c3e, eaves: 0.3, ground: true,
        nameSign: { side: 1, at: 0.54, length: 3.4, bottom: 7.95 } },
    ],
    art: [
      // the round sign on its pole before the pavilion
      { kind: 'roundel', s: 132, u: 7, h: 8.55, size: 0.6, foot: 5.75 },
    ],
    benches: { at: [-25, 5, 35, 62], double: true },
    shelters: [{ s: [44, 48], u: [-3.5, -2.1] }],
    // mesh railings beyond both tracks, on the bridge and along the bank; red by the east end
    fences: [
      { points: [[-140, 0.6], [-130, -1.5], [-120, -1.8], [-110, -2.5], [-100, -3.0], [-90, -3.8], [-80, -5.0], [-70, -4.7], [-60, -5.5], [-50, -6.0], [-40, -6.8],
        [-30, -7.4], [-20, -7.2], [0, -8.5], [20, -9.5], [40, -9.9], [60, -9.4], [80, -8.4], [92, -7.7]], h: [-1.1, 0.15] },
      { points: [[-140, 8.6], [-100, 8.6], [-70, 8.4], [-30, 8.2], [0, 8.0], [60, 8.0], [80, 8.4]], h: [-1.1, 0.15] },
      { points: [[80, 8.4], [92, 8.9], [100, 9.3]], h: [-1.1, 0.15], color: 0x8a3a30 },
    ],
  },
  // Västertorp (5 April 1964; a tram stop from 1952): an island platform in the open on the bank,
  // 42.8 m above the sea, between the bridges over Västertorpsvägen at its south-west end and
  // Störtloppsvägen at its north-east end (Swedish Wikipedia; OpenStreetMap). Over most of it a
  // butterfly roof, its underside 3.8 m over the platform at the valley and 3.9 m at the edges,
  // 10 m wide at its south-west end widening to 12.4 m (Lantmäteriet's laser scan): closely spaced
  // cream glulam rafters cantilevered either way from two dark navy steel beams along it, on two
  // rows of navy columns on concrete plinths, narrow cream boards between them, a thin pale grey
  // fascia; strip lights along the beams, a round clock, a black name sign with the exits'
  // streets; grey slabs in a running bond in two greys, a ribbed strip and a pale edge; chain-link
  // fences beyond both tracks (photographs, 2005 and 2016).
  //
  // At the south-west end a stair house clad in pale grey panels stands between the tracks, its
  // glass doors under the canopy's end (a photograph, 2016), stairs and a lift in it down to the
  // ticket hall under the northern track, at the street 4.8 m below; the hall's doors are
  // south-west onto the path to Västertorpsvägen (OpenStreetMap's indoor mapping: the stairs from
  // 76 m to 87 m south-west of the middle, the lift at 85.7 m; the laser scan, the stair house's
  // roof 4.9 m over the platform). At the north-east end a ramp goes down between the tracks for
  // 56 m to the ticket hall under the bridge, its doors north-east onto Störtloppsvägen, and a path
  // beside it to a lift (OpenStreetMap; Albert Guillaumes' drawing): its walls cream render, its
  // floor dark grey pavers, and over it board-formed concrete beams with glazing between them
  // (a photograph, 2016), the laser scan's sawtooth of five roofs stepping down with the ramp,
  // each rising 1.1 to 1.7 m towards the north-east over a clerestory at its end. On its walls
  // Jörgen Fogelquist's sgraffito Med Örnen mot polen (1981, inaugurated 1982), of S. A. Andrée's
  // balloon flight towards the pole in 1897: the balloon, its drag ropes and the cracking ice on the
  // northern wall, the eagle on the southern (Swedish Wikipedia; photographs, 2007 and 2016). The
  // ticket hall: white tiles, a floor of dark grey-green slate flags, a glass wall (a photograph,
  // 2016). Guesses: which wall the eagle is on and where along the ramp the two pictures are, the
  // south-west hall's finishes (copied from the north-east one's), both halls' fronts, the glazing
  // of the ramp's head and of the lift's tower, the shelter's place.
  'Västertorp': {
    roof: {
      kind: 'butterfly',
      from: -76.4, to: 66, width: 11.6,
      shape: [[-76.4, -2.7, 8.4], [-68, -1.8, 10.1], [-60, -1.55, 10.3], [-52, -1.2, 10.5], [-44, -0.92, 10.7], [-36, -0.6, 11.0], [-28, -0.3, 11.2],
        [-16, 0, 11.5], [0, 0, 11.7], [16, 0.1, 12.1], [32, 0.2, 12.4], [44, 0.35, 12.4], [52, 0.35, 12.8], [60, 0.05, 12.9], [66, -0.2, 12.3]],
      climb: [[-68, -0.18], [0, 0], [60, 0.1]],
      middle: 3.8, edge: 3.9, thick: 0.3, fascia: 0.18,
      rafters: 1.5, rafterSize: [0.14, 0.34], deck: 'boards',
      beam: 0.4,
      columns: { every: 7.2, at: 0, size: 0.2, plinth: { size: 0.45, height: 0.22 }, pair: 5.0, between: [-70, 62] },
      lamps: { offset: 1.9, length: 1.5, every: 3.0, at: [-1.9, 1.9], tube: true },
      colors: { underside: 0xeadfae, fascia: 0xc9cbcc, top: 0xc8c8c4, steel: 0x1f2f5a },
      signs: { at: [-55, -20, 15, 50], back: 'Västertorpsvägen', ahead: 'Störtloppsvägen' },
      clocks: [[-12, 0]],
      // (trains keep left: those towards T-Centralen stop on the northern track)
      boards: [
        { s: 56, u: -2.6, toward: 'T-Centralen', trains: ['14 Mörby centrum  3 min', '14 Mörby centrum  13 min'] },
        { s: 56, u: 3.2, toward: 'Fruängen', trains: ['14 Fruängen  5 min', '14 Fruängen  15 min'] },
      ],
    },
    paving: {
      edge: 0.7, tactile: [0.7, 1.05], slabs: 1.05, paverSize: [0.6, 0.4], mix: 0.18,
      colors: { edge: 0xdcdad3, tactile: 0xc6c4be, slab: 0x9d9b96, pavers: 0x9d9b96, paler: 0x7f8184, face: 0x8e8b85 },
      pattern: 'bond',
    },
    buildings: ['w301418543', 'w301510671'],
    rooms: [
      // (the halls' and the stair house's walls and ceilings are their blocks')
      { name: 'south-west landing', s: [-77, -70.9], u: [-1, 9], h: [-0.3, 0.3], walls: null, floor: 'pavers' },
      { name: 'stair house', s: [-91, -76], u: [0.5, 10], h: [-0.3, 0.3], walls: null, floor: 'slateFlags', lamps: 3.0 },
      { name: 'stairs down to the ticket hall', s: [-90.5, -76], u: [0.5, 10], h: [-5.2, 0.5], walls: 'squareTiles', stairs: 'squareTiles', floor: 'slateFlags', parapet: 1.0, lamps: 3.0 },
      { name: 'south-west ticket hall', s: [-101, -86], u: [-9, 12], h: [-5.2, -4.5], walls: null, floor: 'slateFlags', lamps: 2.6 },
      { name: 'Västertorpsvägen', s: [-106, -99.4], u: [-9, 4], h: [-5.2, -4.4], walls: null, floor: 'pavers' },
      { name: 'path to the lift', s: [70, 122], u: [8.0, 17], h: [-0.3, 0.3], walls: null, floor: 'pavers' },
      { name: 'ramp', s: [65.9, 124.6], u: [2, 16], h: [-4.8, 0.3], walls: null, floor: 'darkPavers', lamps: 2.6 },
      { name: 'north-east ticket hall', s: [121, 142], u: [5, 28], h: [-5.7, -4.4], walls: null, floor: 'slateFlags', lamps: 2.7 },
      { name: 'Störtloppsvägen', s: [139, 150], u: [10, 30], h: [-6, -5], walls: null, floor: 'asphalt' },
    ],
    blocks: [
      // the landing past the platform's end between the bridges' decks, before the stair house
      { name: 'landing', plan: [[-71.0, 0.42], [-71.0, 7.25], [-76.5, 7.81], [-76.5, 1.43]], h: [0, 0.5], from: 0,
        walls: 'pavers', sides: [null, null, null, null], floor: 'pavers', onPlatform: true },
      // the stair house between the decks: clad in pale grey panels over the platform's level, its
      // glass doors facing the platform, white tiles down to the hall, the deck's edge girders cut
      // away inside it
      { name: 'stair house', plan: [[-76.5, 1.43], [-76.5, 7.81], [-90.5, 9.51], [-90.5, 4.26]], h: [0, 4.6], from: 0,
        walls: 'gridPanels', sides: ['glazed', undefined, undefined, undefined], ceiling: 'whitePanels', roof: 0.3, roofColor: 0x9a9c9c,
        ground: true, onPlatform: true },
      { name: 'stair well', plan: [[-76.5, 1.43], [-76.5, 7.81], [-90.5, 9.51], [-90.5, 4.26]], h: [-4.85, 0], from: -4.85,
        walls: 'squareTiles', ground: true, onPlatform: true },
      // the ticket hall under the northern track's deck and beside it, its doors south-west, and its
      // part between the decks beyond the stair house; their roofs under the track bed
      { name: 'ticket hall', plan: [[-78.5, -8.0], [-78.5, 1.79], [-99.5, 6.28], [-99.5, -3.5]], h: [-4.85, -2.0], from: -4.85,
        walls: 'squareTiles', sides: [undefined, null, 'glassFront', 'boardConcrete'], floor: 'slateFlags', ceiling: 'whitePanels', roof: 0.3, roofColor: 0x77756f,
        ground: 0.4, onPlatform: true, nameSign: { side: 2, at: 0.8, length: 3.0, bottom: -2.5 } },
      { name: 'ticket hall, between the tracks', plan: [[-90.5, 4.26], [-90.5, 9.51], [-99.5, 10.9], [-99.5, 6.28]], h: [-4.85, -2.0], from: -4.85,
        walls: 'squareTiles', sides: [null, undefined, 'glazed', null], floor: 'slateFlags', ceiling: 'whitePanels', roof: 0.3, roofColor: 0x77756f,
        ground: 0.4, onPlatform: true },
      // the ramp: its head under a roof on the platform's end, glazed over a cream parapet, then
      // five bays stepping down with it, each roof rising towards the north-east, a board-formed
      // beam across under each step with a clerestory over it, and its last stretch under the deck
      { name: 'ramp head', plan: [[66.0, 2.8], [66.0, 5.9], [74.5, 6.94], [74.5, 3.84]], h: [0.0, 3.15], from: 0.0, fall: -0.53, lowBack: 4.48,
        walls: 'creamRender', sides: [null, undefined, null, undefined], band: { walls: 'glazed', from: 1.0 }, ceiling: 'boardConcrete', roof: 0.25, roofColor: 0x6f6e6a, ground: true, onPlatform: true },
      { name: 'ramp, bay 1', plan: [[74.5, 3.84], [74.5, 6.94], [83.7, 8.19], [83.7, 5.09]], h: [-0.53, 2.35], from: -0.53, fall: -1.27, lowBack: 4.2,
        walls: 'creamRender', sides: [null, undefined, null, undefined], ceiling: 'boardConcrete', roof: 0.25, roofColor: 0x6f6e6a, ground: true },
      { name: 'ramp, bay 2', plan: [[83.7, 5.09], [83.7, 8.19], [91.3, 9.23], [91.3, 6.13]], h: [-1.27, 1.75], from: -1.27, fall: -1.89, lowBack: 3.47,
        walls: 'creamRender', sides: [null, undefined, null, undefined], ceiling: 'boardConcrete', roof: 0.25, roofColor: 0x6f6e6a, ground: true },
      { name: 'ramp, bay 3', plan: [[91.3, 6.13], [91.3, 9.23], [99.8, 10.61], [99.8, 7.51]], h: [-1.89, 1.15], from: -1.89, fall: -2.59, lowBack: 3.05,
        walls: 'creamRender', sides: [null, undefined, null, undefined], ceiling: 'boardConcrete', roof: 0.25, roofColor: 0x6f6e6a, ground: true },
      { name: 'ramp, bay 4', plan: [[99.8, 7.51], [99.8, 10.61], [107.8, 12.08], [107.8, 8.98]], h: [-2.59, 0.55], from: -2.59, fall: -3.26, lowBack: 2.82,
        walls: 'creamRender', sides: [null, undefined, null, undefined], ceiling: 'boardConcrete', roof: 0.25, roofColor: 0x6f6e6a, ground: true },
      { name: 'ramp, bay 5', plan: [[107.8, 8.98], [107.8, 12.08], [116.2, 13.63], [116.2, 10.53]], h: [-3.26, 0.45], from: -3.26, fall: -3.96, lowBack: 2.85,
        walls: 'creamRender', sides: [null, undefined, null, undefined], ceiling: 'boardConcrete', roof: 0.25, roofColor: 0x6f6e6a, ground: true },
      { name: 'ramp, under the deck', plan: [[116.2, 10.53], [116.2, 13.63], [124.4, 15.13], [124.4, 12.03]], h: [-3.96, -0.85], from: -3.96, fall: -4.64, lowBack: -0.17,
        walls: 'creamRender', sides: [null, undefined, null, undefined], ceiling: 'boardConcrete', roof: 0.25, roofColor: 0x6f6e6a, ground: true },
      { name: 'beam at 74.5', plan: [[74.15, 3.79], [74.15, 6.89], [74.85, 6.99], [74.85, 3.89]], h: [1.8, 1.8], from: 1.8, walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete', roof: 0.55, roofColor: 0x8d8b86 },
      { name: 'clerestory at 74.5', plan: [[74.47, 3.84], [74.47, 6.94], [74.53, 6.94], [74.53, 3.84]], h: [2.6, 3.95], from: 2.6, walls: 'glazed', sides: [undefined, null, undefined, null] },
      { name: 'beam at 83.7', plan: [[83.35, 5.05], [83.35, 8.15], [84.05, 8.24], [84.05, 5.14]], h: [1.2, 1.2], from: 1.2, walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete', roof: 0.55, roofColor: 0x8d8b86 },
      { name: 'clerestory at 83.7', plan: [[83.67, 5.09], [83.67, 8.19], [83.73, 8.19], [83.73, 5.09]], h: [2.0, 3.45], from: 2.0, walls: 'glazed', sides: [undefined, null, undefined, null] },
      { name: 'beam at 91.3', plan: [[90.95, 6.08], [90.95, 9.18], [91.65, 9.28], [91.65, 6.18]], h: [0.6, 0.6], from: 0.6, walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete', roof: 0.55, roofColor: 0x8d8b86 },
      { name: 'clerestory at 91.3', plan: [[91.27, 6.13], [91.27, 9.23], [91.33, 9.23], [91.33, 6.13]], h: [1.4, 2.85], from: 1.4, walls: 'glazed', sides: [undefined, null, undefined, null] },
      { name: 'beam at 99.8', plan: [[99.45, 7.45], [99.45, 10.55], [100.15, 10.68], [100.15, 7.58]], h: [0.0, 0.0], from: 0.0, walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete', roof: 0.55, roofColor: 0x8d8b86 },
      { name: 'clerestory at 99.8', plan: [[99.77, 7.51], [99.77, 10.61], [99.83, 10.61], [99.83, 7.51]], h: [0.8, 2.35], from: 0.8, walls: 'glazed', sides: [undefined, null, undefined, null] },
      { name: 'beam at 107.8', plan: [[107.45, 8.92], [107.45, 12.02], [108.15, 12.15], [108.15, 9.05]], h: [-0.1, -0.1], from: -0.1, walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete', roof: 0.55, roofColor: 0x8d8b86 },
      { name: 'clerestory at 107.8', plan: [[107.77, 8.98], [107.77, 12.08], [107.83, 12.08], [107.83, 8.98]], h: [0.7, 2.15], from: 0.7, walls: 'glazed', sides: [undefined, null, undefined, null] },
      { name: 'beam at 116.2', plan: [[115.85, 10.46], [115.85, 13.56], [116.55, 13.69], [116.55, 10.59]], h: [-1.4, -1.4], from: -1.4, walls: 'boardConcrete', sides: [null, null, null, null], ceiling: 'boardConcrete', roof: 0.55, roofColor: 0x8d8b86 },
      { name: 'clerestory at 116.2', plan: [[116.17, 10.53], [116.17, 13.63], [116.23, 13.63], [116.23, 10.53]], h: [-0.6, 2.15], from: -0.6, walls: 'glazed', sides: [undefined, null, undefined, null] },
      // the lift's glazed tower at the path's end
      { name: "lift's tower", plan: [[121.5, 14.6], [124.45, 14.6], [124.45, 17.45], [121.5, 17.45]], h: [0, 3.6],
        walls: 'glazed', roof: 0.2, roofColor: 0xc9cac6, onPlatform: true },
      // the ticket hall under the bridge, its floor falling with the street towards its doors onto
      // Störtloppsvägen, its roof under the track bed, which rises the other way; a glass wall south
      { name: 'north-east ticket hall', plan: [[122.5, 23.9], [125.5, 7.4], [141.3, 11.8], [136.2, 26.9]], h: [-4.65, -1.6], from: -4.65, fall: -5.45, lowBack: -0.6,
        walls: 'squareTiles', sides: [undefined, undefined, 'glassFront', 'glazed'], floor: 'slateFlags', ceiling: 'whitePanels', roof: 0.15, roofColor: 0x77756f,
        ground: true, onPlatform: true, nameSign: { side: 2, at: 0.45, length: 3.2, bottom: -3.08 } },
      // the deck between the bridges over it, at the platform's level
      { name: 'deck between the bridges', plan: [[124.4, 10.96], [147.0, 17.3], [147.0, 21.6], [124.4, 17.08]], h: [-1.45, -0.05], from: -1.45,
        walls: 'boardConcrete', roof: 0.05, roofColor: 0x8f8d86 },
    ],
    art: [
      // Fogelquist's balloon and the crack in the ice on the ramp's northern wall, and the eagle on
      // its southern one
      { kind: 'mural', picture: 'andreeBalloon', s: 83.0, u: 5.0, turn: 1.7065, bottom: -1.75, top: 1.95, width: 13 },
      { kind: 'mural', picture: 'andreeEagle', s: 104.0, u: 11.39, turn: -1.3891, bottom: -2.05, top: 0.55, width: 3.6 },
    ],
    benches: { at: [-46, -24, -1, 20, 42], double: true },
    shelters: [{ s: [-10, -6], u: [-1.0, 1.0] }],
    // chain-link fences beyond both tracks along the bank, and a railing along the path to the lift
    fences: [
      { points: [[-71, -4.9], [-61, -6.4], [-52, -7.6], [-42, -8.6], [-33, -9.4], [-23, -9.9], [-14, -10.3], [-4, -10.4], [6, -10.4], [15, -10.2], [25, -9.9],
        [34, -9.4], [44, -8.7], [53, -7.8], [63, -6.7], [72, -5.4], [82, -3.9], [91, -2.3], [100, -0.5], [110, 1.5], [119, 3.7]], h: [-1.1, 0.2] },
      { points: [[-72, 12.5], [-62, 11.7], [-53, 11.1], [-43, 10.7], [-34, 10.4], [-24, 10.3], [-15, 10.2], [-5, 10.3], [5, 10.6], [14, 10.9], [24, 11.3],
        [33, 11.8], [43, 12.4], [52, 13.2], [62, 14.0], [71, 15.0], [81, 16.1], [90, 17.4], [99, 18.8], [109, 20.3], [118, 21.8]], h: [-1.1, 0.2] },
      { points: [[70.5, 9.8], [96, 12.9], [121.4, 16.7]], h: [-0.1, 1.0], kind: 'rails' },
    ],
  },
};
