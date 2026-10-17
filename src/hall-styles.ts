import type { Paving } from './open-styles';
import type { CavePaint } from './textures';

// Platform halls the network draws (src/network.ts) in their own style rather than as a plain
// vault in rock or box of concrete: Hötorget, as it has looked since 1952, with Gun Gordillo's
// neon (1998); Farsta strand, under the centre built over it; Karlaplan, as it has looked since
// 1967, with Tor Hörlin's niches and Larseric Vänerlöf's photomontage; Östermalmstorg, with
// Siri Derkert's lines in its concrete walls (1965); Skanstull, the trams' station of 1933,
// on its beams; Medborgarplatsen, the other of 1933, with its enamelled columns and the
// vault of its lengthening in 1950; Rådmansgatan, Hötorget's neighbour of 1952, in yellow
// tiles; S:t Eriksplan, of the same year, on two rows of columns in exposed-aggregate
// concrete; and Blackeberg's covered south-eastern end, of the same year, under its ticket hall,
// with Ruben Heleander's walls (1987).
// Heights are above the top of the rail (the platform is 1.0 m above it).

export type HallStyle = FlatHall | VaultHall;

export interface FlatHall {
  kind: 'flat';
  // a flat roof: low over the track (the soffit), stepping up between the two rows of columns to
  // the ceiling (the same height for a roof that is flat all over); with one row down the
  // middle, `fromEdge` + half of `size` in from the platform's edges; with `stepOutside`, outside
  // the two rows instead, sloping up to the ceiling at their outer faces, so that they stand
  // under it
  soffit: number;
  ceiling: number;
  step: number;          // across the slope from the soffit up to the ceiling
  stepOutside?: boolean;
  // columns along the platform, `fromEdge` from the edge to their middle: square; or round
  // (`round`), in one row down the middle of the platform (`middle`)
  columns: { fromEdge: number; size: number; spacing: number; round?: boolean; middle?: boolean };
  finish: TiledHall | ConcreteHall | BeamedHall;
  // once along each track wall, near the middle of the platform: a plate with the station's old
  // name between two posters, `apart` from it, with their middles `at` high
  posters?: { name: string; at: number; apart: number };
  // neon tubes hung under the ceiling between the columns
  neon?: { count: number; tones: number[]; reach: number; below: [number, number] };
}

// Hötorget's: the walls and columns in square tiles, the track walls tiled from `tilesFrom` up to
// the soffit, plaster below, and name plates on them `plateAt` high, one in the middle of every
// repeat of their tiles (src/textures.ts); plaster overhead with the lamps in the soffit, clinker
// underfoot.
export interface TiledHall { kind: 'tiles'; tilesFrom: number; plateAt: number }

// Farsta strand's: the track walls bare concrete, dark between pale pilasters under a beam, with
// steel rails along them; overhead, dark panels of perforated steel, and lamps hung under them
// over the platform's edges; the columns in small grey tiles; the platform paved as `paving` says
// (src/open-styles.ts), and the station's name on signs hung across its middle every `signs.every`
// m, their middle `signs.at` high.
export interface ConcreteHall { kind: 'concrete'; paving: Paving; signs: { every: number; at: number } }

// Skanstull's, the trams' of 1933: the track walls in small square tiles of `walls.color`,
// `walls.tile` across, from `walls.from` up to the ceiling, over a black band down to the track
// bed, with posters in thin frames along them (`posters.run` of them, `posters.every` apart, then
// `posters.gap` of bare tiles, and so on; `width` × `height`, from `bottom` up);
// overhead, a plain ceiling of `ceiling` colour on beams across the hall, over every column and
// `beams.between` more between two, `beams.depth` deep and `beams.width` wide, and a beam along
// over the row of columns, `beams.along` wide and as deep again; the columns painted `column`,
// with a steel ring at their feet; lamps in a row over each edge of the platform, under the beams;
// the platform paved as `paving` says, and the station's name on signs hung across it, as in
// concrete. `clocks`: two round clocks hung from the beam either side of the middle column;
// `boards`: departure boards hung across the platform `boards.from` columns either side of the
// middle one, over each half of the platform the board for the trains along the track beside it
// (`east`: the track on the east side, or on the south side of a hall running east–west).
// Medborgarplatsen's differs: no beams across (`beams.between` null), the beam along painted
// `beams.color`; `rings` on the columns, enamelled bands of `rings.colors` from the top down,
// each `rings.width` high and `rings.pitch` apart, the first `rings.top` high; the station's name
// on long signs hung along each edge of the platform, over the way to its exits (`signs.ways`),
// rather than across it; and its `vault`: from the point `from` on (in the scene's metres, the
// way `toward` lies from it) the hall vaulted rather than flat, the walls rising to the soffit
// and the vault to `crown` over the middle of the platform, painted `color`, with a row of lamps
// on a rail along it either side of the middle, `lamps` from it; where it meets the flat part,
// a black wall over the flat ceiling with a pale triangle in its middle, point down.
// Rådmansgatan's, of 1952, has no beams (`beams` left out) but Hötorget's roof, stepping up from
// the soffit to the ceiling, a row of tube lamps in the soffit beside each step, and round lamps
// on the ceiling either side of the row of columns at each column, `lamps.off` from its middle;
// the columns square and tiled as the walls (`columnTile` across), the tiles up to a plain band
// `walls.top` deep under the soffit, a dark plate with the station's name in the middle of each
// gap between the groups of posters (`walls.plate`, its middle `at` high), and the long signs
// along the edges in SL's blue (`signs.blue`).
// S:t Eriksplan's, of 1952 too, has two rows of columns in exposed-aggregate concrete of `column`
// colour (`aggregate`), under a beam along each row (`rowBeams`, `width` across and `depth`
// deep), the roof sloping down outside them (the hall's `stepOutside`); fittings recessed down the
// middle of the ceiling between the rows (`troffers`: `size` across and along, two to each gap
// between the columns); the clocks and the departure boards hung over the platform's sides,
// `clocks` and `boards.off` from its middle; and the station's name on its signs and plates as
// SL writes it (`signs.name`).
// Blackeberg's, of 1952 too: the track walls in green tiles with the rock standing out of them and
// trees drawn on them (`walls.trees`; posters left out, `run` 0), the rock left bare at the hall's
// end round the tunnels going on; a flat ceiling of dark board-marked concrete (`boarded`); and
// the vault board-marked too (`vault.boarded`), with a lunette window in its end over the flat
// part (`vault.window`): concrete from the flat ceiling up to `from`, glass in steel frames about
// `frames` m apart above it, up to the vault, looking into the ticket hall over the flat part.
export interface BeamedHall {
  kind: 'beams';
  walls: {
    color: number; tile: number; from: number; top?: number; plate?: { name: string; at: number }; trees?: boolean;
    posters: { width: number; height: number; bottom: number; every: number; run: number; gap: number };
  };
  beams?: { depth: number; width: number; between: number | null; along: number; color?: number };
  ceiling: number;
  column: number;
  columnTile?: number;
  aggregate?: boolean;
  rowBeams?: { width: number; depth: number };
  rings?: { colors: number[]; top: number; width: number; pitch: number };
  lamps?: { off: number };
  troffers?: { size: [number, number] };
  paving: Paving;
  signs: { every: number; at: number; ways?: string; blue?: boolean; name?: string };
  clocks?: boolean | number;
  boards?: { from: number; off?: number; east: Board; west: Board };
  vault?: { from: [number, number]; toward: [number, number]; crown: number; color: number; lamps: number; boarded?: boolean; window?: { from: number; frames: number } };
  boarded?: boolean;
}
export interface Board { toward: string; trains: [string, string] }

export interface VaultHall {
  kind: 'vault';
  // one smooth vault over both tracks: the track walls straight up to `spring`, the vault's
  // crown `crown` high over the middle of the platform, a row of lamps along it
  spring: number;
  crown: number;
  // the track walls: enamel panels from `panelsFrom` (black below, down to the track bed), with
  // the station's name on one in every repeat, `nameAt` high (src/textures.ts)
  panelsFrom: number;
  nameAt: number;
  // a frieze along one track wall (+1: the wall of the track with the other track to its right),
  // centred on the platform: `length` long, from `from` to `to` high
  frieze?: { wall: 1 | -1; length: number; from: number; to: number };
  // tiled blocks down the middle of the platform, `width` across and `height` above it, about
  // `length` long with `gap` between them, over the middle `spread` of the platform's length;
  // on their sides, by turns, a seat in a niche and the station's name with the way to each of
  // its `exits` (their ticket halls, in the scene's metres)
  blocks: { width: number; height: number; length: number; gap: number; spread: number };
  exits: { name: string; x: number; z: number }[];
}

// Hötorget: an island platform under Sveavägen, opened as Kungsgatan in 1952 (architect Gunnar
// Lené) and kept as it was: the walls and columns in square tiles of seven shades of pale
// blue-green, clinker on the floor, a flat roof with the lamps in a soffit along each track, and
// small navy name plates along the track walls. Since the renovation of 2024–25 its old name,
// Kungsgatan, is up on the walls again, between reproductions of two 1950s posters. Gun Gordillo
// hung 103 lines of neon in five tones of white from its ceiling in 1998, at different heights.
//
// Farsta strand: the end of the line, opened in 1971 with its island platform out in a deep
// cutting under Glavagatan's hill; built over since, with Centrumhuset and Stieg Trenters torg on
// top, so that it is a long, low box. A flat ceiling of dark grey perforated steel panels in a
// grid, on steel beams across; one row of round columns down the platform's middle (about
// 7 m apart, measured on photographs), clad in small grey tiles; lamps in a row over each edge of
// the platform, hung just under the ceiling. The track walls are the cutting's: dark concrete
// between paler pilasters under a beam, with three steel rails along them. The platform is grey
// concrete pavers, with a pale band along its edge and a strip of studded tiles inside it, and the
// station's name on dark grey signs hung across it. (Wikimedia Commons' photographs of 2018.)
//
// Karlaplan: an island platform in a cavern 23 m down under Fältöversten, opened in 1967. A
// smooth, pale vault over both tracks, lit by one long row of lamps; the track walls clad in white
// enamelled steel panels (2006) over a black plinth, with the station's name in small black
// capitals; dark granite on the floor with a pale stone edge. Down the middle of the platform,
// blocks in long, cream glazed tiles with dark joints between their bays, the name in navy
// capitals along their tops with the ways out (Karlaplan to the south-west, Valhallavägen to the
// north-east); in their sides Tor Hörlin's niches (1967), lined in green stoneware with a band of
// coloured tiles over a yellow wooden bench. Along one track wall, Larseric Vänerlöf's
// photomontage (1983, renewed 2009) of old Östermalm in black and white, 96 m long.
//
// Skanstull: opened on 1 October 1933 as Ringvägen, with Medborgarplatsen the oldest of the
// underground stations, for the trams through Södertunneln (architects Holger Blom and Gunnar
// Lené, after Berlin's U-Bahn); lengthened for the metro and reopened under its present name in
// 1950, and done up in 2009. An island platform about five metres under Götgatan in the tunnel's
// concrete box: a low, flat ceiling, painted cream, on deep beams across from wall to wall, over
// a beam along the middle of the platform carried by one row of round columns, glossy white with
// a steel ring at their feet; long lamps under the beams over each edge of the platform. Much of
// the track walls' tiling is still the 1930s': small square tiles, cream with a little yellow,
// over a black band, and posters in frames along them. The platform is grey tiles, with a band of
// white ones along its edge and a ribbed strip inside it. Heights are read off photographs (2013)
// against the trains (C20, 3.68 m tall): the ceiling about 4.4 m over the rails, the beams'
// undersides about 4.0, the posters almost from the black band up to them.
//
// Medborgarplatsen: opened with Skanstull on 1 October 1933 as Södra Bantorget, renamed in 1944,
// and lengthened northwards for the metro in 1949–50, into the rock under the rising ground
// (Swedish Wikipedia). An island platform 145 m long, about eight metres under Götgatan's eastern
// side. Its southern part is the trams' concrete box: a flat cream ceiling with no beams across,
// a navy beam along the middle of the platform on one row of round columns, enamelled royal blue
// (after they were tagged so often) with Gunnar Söderström's eight bands of colour round them,
// red, orange, yellow, two greens, teal, light blue and maroon; long lamps over each edge of the
// platform. Its northern part, the lengthening, is vaulted: the walls rise as high, and a shallow
// vault in cream panels spans both tracks, two rows of lamps along it on rails; where it meets
// the flat part, a black wall over the flat ceiling with a pale grey triangle in its middle. All
// along, the track walls are glossy yellow tiles, partly the 1930s', over a black band, with
// posters in groups; the platform is grey terrazzo, a dark strip with brass studs and white tiles
// along the edge; long black signs hang along both edges with the name and the ways out.
// Photographs (2009–2025): heights read against people and the walls' posters, so approximate:
// the ceiling about 4.2 m over the rails, the vault's crown about 6. Where the vault begins, 6 m
// beyond the foot of the stairs from the northern ticket hall, is inferred from photographs
// looking along it, which show no stairs in it.
//
// Rådmansgatan: opened on 26 October 1952 with Hötorget, by the same architect (Gunnar Lené), an
// island platform about eight metres under Sveavägen between Rådmansgatan and Rehnsgatan, curving
// gently (Swedish Wikipedia; Albert Guillaumes' drawing). Hötorget's roof, low over the tracks and
// stepping up over the middle of the platform, but one row of square columns down its middle, and
// everything in glossy yellow tiles, 15 cm: the columns and the track walls, over a black band
// along the track bed, with posters in groups and small dark plates with the station's name
// between them. Tube lamps along the soffit over the platform's edges, round lamps on the ceiling
// either side of the columns; grey tiles underfoot in a bond, white tiles along the edge and a
// dark strip with brass studs inside them; benches back to back between the columns, a clock, and
// SL's blue signs along both edges with the ways out. Wikimedia Commons' photographs (2013–2018):
// the column spacing, the step and the lamps are read from them, the heights taken from
// Hötorget's.
//
// S:t Eriksplan: opened on 26 October 1952 with Rådmansgatan, an island platform about eight
// metres under Sankt Eriksgatan, its northern end curving east with the tracks (Swedish
// Wikipedia; Albert Guillaumes' drawing). No artist's work on the platform: two rows of square
// columns in grey exposed-aggregate concrete, flecked black and white, each row under a beam
// along it; between the rows a flat white ceiling with fittings recessed down its middle, and
// outside them the ceiling sloping down to the soffit over the tracks, with tube lamps along it
// over the platform's edges. The track walls in small cream tiles over a black band, posters in
// groups and small dark plates with the name between them, a plain band under the soffit; pale
// grey tiles underfoot, white tiles along the edge and a dark strip with brass studs; benches back
// to back between the rows, round clocks and departure boards hung over the platform's sides,
// and long black signs along both edges with the ways out, to S:t Eriksplan and Torsgatan.
// Wikimedia Commons' photographs (2012–2016): the columns' spacing (6 m) and the rows' (3.1 m)
// are read from them against people and the camera's lens, so they're approximate, as are the
// heights (the ceiling about 3.5 m over the platform between the rows).
//
// Blackeberg: opened on 26 October 1952, at the end of the 600 m tunnel under Blackeberg, the
// island platform's south-eastern 50 m covered and the rest out in a cutting (English and Swedish
// Wikipedia). The covered part runs under Vinjegatan's deck and Peter Celsing's ticket hall, under
// a flat slab of dark board-marked concrete on square columns in small yellow tiles, then on under
// Blackebergs torg in a low board-marked vault, its end over the flat part a lunette window into
// the ticket hall; at its far end the two tunnels' mouths in the bare rock. The track walls are
// Ruben Heleander's (1987): small green tiles with pale trees drawn on them, the rock standing out
// of them in dark outcrops. The floor grey concrete tiles, a pale edge and a dark ribbed strip;
// SL's blue signs with the way out, orange posts with departure screens. Wikimedia Commons'
// photographs (2018): the heights read against the platform's people and benches, so
// approximate (the slab about 3.35 m over the platform, the vault's crown about 6.6 and the
// window's sill 4.5); where the vault begins is under the hall's front, over the square's foot.
export const HALL_STYLES: Record<string, HallStyle> = {
  'Hötorget': {
    kind: 'flat',
    soffit: 3.9,
    ceiling: 4.6,
    step: 0.5,
    columns: { fromEdge: 2.2, size: 0.72, spacing: 8 },
    finish: { kind: 'tiles', tilesFrom: 0.7, plateAt: 2.25 },
    posters: { name: 'KUNGSGATAN', at: 2.3, apart: 1.27 },
    neon: { count: 103, tones: [0xffffff, 0xf3f7ff, 0xfff4e2, 0xe6f2ff, 0xfffbe8], reach: 2.6, below: [0.12, 0.75] },
  },
  'Farsta strand': {
    kind: 'flat',
    soffit: 4.25,
    ceiling: 4.25,
    step: 0,
    columns: { fromEdge: 4.5, size: 0.72, spacing: 7.2, round: true, middle: true },
    finish: {
      kind: 'concrete',
      paving: {
        edge: 0.3, tactile: [0.3, 0.9], studs: true, slabs: 0.9, paverSize: [0.25, 0.5], mix: 0.12,
        colors: { edge: 0xd2d0ca, tactile: 0xa9a9a5, slab: 0x8f908d, pavers: 0x8c8d8a, paler: 0x9c9d9a, face: 0x6f6e6a },
        pattern: 'bond',
      },
      signs: { every: 36, at: 3.55 },
    },
  },
  'Karlaplan': {
    kind: 'vault',
    spring: 4.5,
    crown: 7.2,
    panelsFrom: 1.1,
    nameAt: 3.85,
    frieze: { wall: 1, length: 96, from: 2.2, to: 3.4 },
    blocks: { width: 3.2, height: 3.3, length: 11, gap: 6, spread: 0.62 },
    exits: [{ name: 'KARLAPLAN', x: 1790, z: -765 }, { name: 'VALHALLAVÄGEN', x: 1950, z: -1010 }],
  },
  'Skanstull': {
    kind: 'flat',
    soffit: 4.4,
    ceiling: 4.4,
    step: 0,
    columns: { fromEdge: 3, size: 0.5, spacing: 7.5, round: true, middle: true },
    finish: {
      kind: 'beams',
      walls: { color: 0xe8dfb8, tile: 0.15, from: 1.7, posters: { width: 1.3, height: 2.05, bottom: 1.8, every: 1.9, run: 5, gap: 1.9 } },
      beams: { depth: 0.4, width: 0.3, between: 2, along: 0.6 },
      ceiling: 0xe9e5d8,
      column: 0xf3f3ef,
      paving: {
        edge: 0.75, tactile: [0.75, 1.05], slabs: 1.05, paverSize: [0.3, 0.3], mix: 0.1,
        colors: { edge: 0xe6e4de, tactile: 0x9c927a, slab: 0x86817a, pavers: 0x86817a, paler: 0x928d86, face: 0x3a3a3a },
        pattern: 'grid',
      },
      signs: { every: 30, at: 3.45 },
      clocks: true,
      // (trains keep left: the southbound on the east track)
      boards: {
        from: 2,
        east: { toward: 'Farsta strand · Hagsätra · Skarpnäck', trains: ['17 Skarpnäck  2 min', '19 Hagsätra  7 min'] },
        west: { toward: 'T-Centralen · Hässelby', trains: ['19 Hässelby strand  4 min', '18 Alvik  6 min'] },
      },
    },
  },
  'Medborgarplatsen': {
    kind: 'flat',
    soffit: 4.2,
    ceiling: 4.2,
    step: 0,
    columns: { fromEdge: 3, size: 0.5, spacing: 5.2, round: true, middle: true },
    finish: {
      kind: 'beams',
      walls: { color: 0xcfae48, tile: 0.15, from: 1.45, posters: { width: 1.2, height: 1.8, bottom: 1.65, every: 1.35, run: 4, gap: 2.6 } },
      beams: { depth: 0.18, width: 0, between: null, along: 0.6, color: 0x1f2b55 },
      ceiling: 0xe8e5da,
      column: 0x2c49b2,
      rings: { colors: [0xd8382a, 0xe8722a, 0xe8d02c, 0x8cc25e, 0x2a9a6e, 0x3fa9b2, 0x4a8ee0, 0x7a2a3c], top: 3.35, width: 0.095, pitch: 0.19 },
      paving: {
        edge: 1.3, edgeTile: [0.43, 0.6], tactile: [1.3, 1.62], studs: true, studColor: 0xc9a443, slabs: 1.62, paverSize: [1.2, 1.2], mix: 0.15,
        colors: { edge: 0xe4e1d8, tactile: 0x4a4b4c, slab: 0x9e9b94, pavers: 0xa3a099, paler: 0xaba8a1, face: 0x3a3a3a },
        pattern: 'grid',
      },
      signs: { every: 40, at: 3.7, ways: 'Folkungagatan · Björns trädgård · Hiss' },
      // (trains keep left: the southbound on the east track)
      boards: {
        from: 3,
        east: { toward: 'Farsta strand · Hagsätra · Skarpnäck', trains: ['18 Farsta strand  3 min', '19 Hagsätra  5 min'] },
        west: { toward: 'T-Centralen · Hässelby', trains: ['17 Åkeshov  2 min', '19 Hässelby strand  6 min'] },
      },
      vault: { from: [795.4, 1791.9], toward: [777.4, 1714.9], crown: 6.0, color: 0xe6e2d6, lamps: 2.2 },
    },
  },
  'Rådmansgatan': {
    kind: 'flat',
    soffit: 3.9,
    ceiling: 4.6,
    step: 0.5,
    columns: { fromEdge: 1.7, size: 0.6, spacing: 8, middle: true },
    finish: {
      kind: 'beams',
      walls: {
        color: 0xd9bd5c, tile: 0.15, from: 1.15, top: 0.3, plate: { name: 'RÅDMANSGATAN', at: 3.15 },
        posters: { width: 1.2, height: 1.75, bottom: 1.6, every: 1.35, run: 4, gap: 2.6 },
      },
      ceiling: 0xd6d0c2,
      column: 0xd9bd5c,
      columnTile: 0.15,
      lamps: { off: 0.9 },
      paving: {
        edge: 0.9, edgeTile: [0.3, 0.3], tactile: [0.9, 1.2], studs: true, studColor: 0xc9a443, slabs: 1.2, paverSize: [0.3, 0.3], mix: 0.08,
        colors: { edge: 0xdedbd3, tactile: 0x55575a, slab: 0xb3b0a9, pavers: 0xb3b0a9, paler: 0xbcb9b2, face: 0x3a3a3a },
        pattern: 'bond',
      },
      signs: { every: 40, at: 3.25, ways: 'Tegnérgatan · Handelshögskolan · Stadsbiblioteket', blue: true },
      clocks: true,
      // (trains keep left: the southbound on the east track)
      boards: {
        from: 3,
        east: { toward: 'Farsta strand · Hagsätra · Skarpnäck', trains: ['18 Farsta strand  3 min', '17 Skarpnäck  5 min'] },
        west: { toward: 'Odenplan · Alvik · Hässelby', trains: ['19 Hässelby strand  2 min', '17 Åkeshov  6 min'] },
      },
    },
  },
  'Sankt Eriksplan': {
    kind: 'flat',
    soffit: 3.9,
    ceiling: 4.5,
    step: 1.4,
    stepOutside: true,
    columns: { fromEdge: 2.95, size: 0.5, spacing: 6 },
    finish: {
      kind: 'beams',
      walls: {
        color: 0xe2dbc6, tile: 0.1, from: 1.5, top: 0.3, plate: { name: 'S:t Eriksplan', at: 2.9 },
        posters: { width: 1.2, height: 1.75, bottom: 1.65, every: 1.35, run: 4, gap: 2.6 },
      },
      ceiling: 0xe4e1d9,
      column: 0x8a867e,
      aggregate: true,
      rowBeams: { width: 0.55, depth: 0.25 },
      troffers: { size: [0.6, 1.3] },
      paving: {
        edge: 0.6, edgeTile: [0.3, 0.3], tactile: [0.6, 0.9], studs: true, studColor: 0xc9a443, slabs: 0.9, paverSize: [0.3, 0.3], mix: 0.1,
        colors: { edge: 0xdfdacd, tactile: 0x4f5052, slab: 0xbab9b4, pavers: 0xbab9b4, paler: 0xc6c5c0, face: 0x3a3a3a },
        pattern: 'bond',
      },
      signs: { every: 40, at: 3.35, ways: 'S:t Eriksplan · Torsgatan · Hiss', name: 'S:t Eriksplan' },
      clocks: 2.7,
      // (trains keep left: the southbound, to Fridhemsplan, on the east track)
      boards: {
        from: 4,
        off: 3.0,
        east: { toward: 'Fridhemsplan · Hässelby', trains: ['17 Åkeshov  2 min', '19 Hässelby strand  3 min'] },
        west: { toward: 'T-Centralen · Gullmarsplan', trains: ['17 Skarpnäck  1 min', '18 Farsta strand  4 min'] },
      },
    },
  },
  'Blackeberg': {
    kind: 'flat',
    soffit: 4.35,
    ceiling: 4.35,
    step: 0,
    columns: { fromEdge: 4.17, size: 0.62, spacing: 7.8, middle: true },
    finish: {
      kind: 'beams',
      walls: { color: 0x5e8c63, tile: 0.15, from: 1.0, trees: true, posters: { width: 0, height: 0, bottom: 0, every: 1, run: 0, gap: 8 } },
      ceiling: 0x6e6a64,
      boarded: true,
      column: 0xd8c64a,
      columnTile: 0.15,
      paving: {
        edge: 0.35, tactile: [0.35, 0.7], slabs: 0.7, paverSize: [0.4, 0.4], mix: 0.15,
        colors: { edge: 0xbdbab2, tactile: 0x3a3b3c, slab: 0x6c6c6b, pavers: 0x6a6a69, paler: 0x8a8a87, face: 0x5a5853 },
        pattern: 'grid',
      },
      signs: { every: 40, at: 3.35, ways: 'Utgång', blue: true },
      // (trains keep left: into town on the north-eastern track; the boards beside the walls round
      // the stairs down the platform's middle)
      boards: {
        from: 1, off: 3.1,
        east: { toward: 'Farsta · Hagsätra · Skarpnäck', trains: ['19 Hagsätra  8 min', '18 Farsta strand  12 min'] },
        west: { toward: 'Hässelby', trains: ['18 Hässelby strand  7 min', '19 Hässelby strand  11 min'] },
      },
      vault: { from: [-9981.5, -1829.0], toward: [-9974.9, -1822.2], crown: 7.6, color: 0x8a8680, lamps: 2.2, boarded: true, window: { from: 5.5, frames: 1.4 } },
    },
  },
};

// A platform hall in rock with a platform of its own beside one track, styled: the walls straight
// up to `spring`, then a shallow vault (`risePerWidth` of the hall's width) in smooth white
// plaster with a row of lamps along it over the platform; white name signs on the wall behind the
// platform, `signAt` high, every `signEvery` m. Östermalmstorg's finish, unless it has a `finish`
// of its own.
export interface VaultStyle {
  spring: number;
  risePerWidth: number;
  signAt: number;
  signEvery: number;
  finish?: VaultFinish;
}

// A vaulted hall's own finish (heights above the rails, as the hall's):
// - `trackWall`: white enamelled panels, 1.2 m wide in rows `row` high, from `panelsFrom` up to
//   the vault over a black plinth, a grey strip along them `strip` high; and a row of framed
//   pictures, `art[0]` to `art[1]` high and `art[2]` wide, about `art[3]` m apart;
// - `backWall`: panels of dark concrete, `panel` wide, cast with fine diagonal grooves, on a pale
//   plinth up to `plinth`; over them a band in `band.color` from `band.from` to `band.to`, which
//   the name signs (the name in white on the band's colour) and the ways out (white plates, an
//   arrow to the exit they lead to: `exits`, in the scene's metres) are on, and a pale strip up to
//   the vault;
// - `vault`: the vault's colour;
// - `paving`: the platform, paved as an open station's;
// - `cases`: glass-fronted cases set into the wall behind the platform, in pairs `gap` apart, each
//   `w` wide and `h` high from `bottom`, about every `every` m, with a bench either side.
export interface VaultFinish {
  trackWall: { panelsFrom: number; row: number; strip: number; art: [number, number, number, number] };
  backWall: { panel: number; plinth: number; band: { from: number; to: number; color: string } };
  exits: { name: string; x: number; z: number }[];
  vault: number;
  paving: Paving;
  cases?: { w: number; h: number; bottom: number; gap: number; every: number };
}

// Östermalmstorg (1965), 38 m down: a hall in rock for each
// track, the platforms side by side beyond the wall between them. Their walls are in-situ
// concrete, light and pitted, and the track walls carry Siri Derkert's Ristningar i betong
// (1961–65): lines sandblasted into the concrete, of women of the peace and women's movements,
// faces, singers, Rachel Carson's Tyst vår, staves of song and "peace" in several languages. Over
// them a smooth white vault, the floor dark terrazzo with a band of pale tiles along the edge.
//
// Gärdet (1967), 31 m under Furusundsgatan: the same plan, a hall in rock for each track, the
// tracks on the outside and the platforms within, either side of a core of rock about 10 m wide,
// joined through it at both ends and by a passage in the middle (Albert Guillaumes's drawing;
// OpenStreetMap's platforms). Photographs (2010–2024, Wikimedia Commons): over each hall a
// cream vault, springing over the trains' roofs, a row of lamps along it; the track walls in white
// enamelled panels (2006, to make tagging easy to wash off), with a row of framed pictures along
// them; the wall behind the platform in panels of brown-grey concrete cast with fine diagonal
// grooves, on a pale plinth, under a slate-blue band carrying the name in white and the ways out on
// white plates; the platform clinker in shades of red-brown and grey in a running bond, with a
// band of white stones along the edge and a grey strip with brass studs inside it. Set into the
// wall behind the platform, Karl Axel Pehrson's lit cases of fantastical beetles (1967), in pairs
// between benches.
// Heights against the trains (C20, 3.68 m) and people, so approximate.
export const VAULT_STYLES: Record<string, VaultStyle> = {
  'Östermalmstorg': { spring: 4.3, risePerWidth: 0.16, signAt: 3.75, signEvery: 40 },
  'Gärdet': {
    spring: 4.5, risePerWidth: 0.25, signAt: 4.08, signEvery: 36,
    finish: {
      trackWall: { panelsFrom: 1.45, row: 0.6, strip: 2.25, art: [1.6, 3.1, 1.3, 2.6] },
      backWall: { panel: 1.25, plinth: 1.3, band: { from: 3.85, to: 4.3, color: '#4c6275' } },
      exits: [{ name: 'Brantingsgatan · Askrikegatan', x: 2221.2, z: -1496.9 }, { name: 'Furusundsgatan · Tegeluddsvägen · Värtahamnen', x: 2302.2, z: -1712.3 }],
      vault: 0xece6d8,
      paving: {
        edge: 0.62, edgeTile: [0.31, 0.62], tactile: [0.64, 0.94], studs: true, studColor: 0xb59a52, slabs: 0, paverSize: [0.25, 0.125], mix: 0.42,
        colors: { edge: 0xd9d6cc, tactile: 0x5a5a58, slab: 0xd9d6cc, pavers: 0x8e5c42, paler: 0x77706a, face: 0x3e3c3a },
        pattern: 'bond',
      },
      cases: { w: 0.62, h: 1.75, bottom: 1.5, gap: 0.5, every: 18 },
    },
  },
};

// The blue line's stations (1975–85), and before them Stadion on the red line (1973), where the
// rock was left as it was blasted, sprayed with concrete and painted: a cave, each painted as an
// artist chose. The halls keep their outlines,
// roughened (src/network.ts); `paint` says how the rock is painted (src/textures.ts).
export interface CaveStyle {
  paint: CavePaint;
  // an island platform with the rock left standing down its middle (Stadion's)
  island?: CaveIsland;
  // along each track wall, panels of coloured glass lit from behind, one to each of the network's
  // samples along the platform, from `from` to `to` high (above the rails), on a dark backing
  // standing out from the rock over a steel ledge; their colours fading along the wall through
  // `east`'s or `west`'s (CSS colours, from its northern end to its southern)
  glass?: { from: number; to: number; east: string[]; west: string[] };
  // the platform paved as an open station's (src/open-styles.ts), rather than in the network's tiles
  paving?: Paving;
  // the station's name on dark grey signs hung across the platform under its fittings, about
  // `every` m apart, rather than SL's blue ones on the walls
  signs?: { every: number };
}

// Heights here are above the top of the rail, as for the styled halls above.
export interface CaveIsland {
  // two long pillars of rock down the middle of the platform, `width` across, a passage `gap`
  // long between them, and `ends` m of open platform beyond them; their rock painted as `paint`
  // says, and towards their outer ends, over `fenced` of their length, as `fencedPaint` says,
  // behind fences of steel mesh with benches; a tiled plinth round their foot, `plinth` high
  pillars: { width: number; gap: number; ends: number; fenced: number; plinth: number; paint: CavePaint; fencedPaint: CavePaint };
  // the passage's openings to the platform each side: arches `inset` in from the pillars' ends
  // with their crowns `crown` high, in walls `thickness` thick, a rainbow painted round them
  portal: { inset: number; crown: number; thickness: number };
  // a flat ceiling of steel mesh `ceiling` high over the tracks and the platform, but not over
  // the passage, with fluorescent tubes across it
  ceiling: number;
  // the track walls: panels of steel mesh up to `panels`, and a white band over them with the
  // station's name
  panels: number;
}
// Round from the track's floor (src/textures.ts): the platform is at 1.6, the walls rise to
// about 4.2, and the crown is at about 9 over a hall of one track, 16 over an island platform.
export const CAVE_STYLES: Record<string, CaveStyle> = {
  // Stadion (1973, Enno Hallek and Åke Pallarp), on the red line by the Olympic stadium of 1912:
  // one of the first caves, painted sky blue so that it should not feel like the underworld. The
  // rock is left standing in two long pillars down its wide island platform (Albert Guillaumes'
  // drawing), sky blue with cracks traced in gold and dark blue, on a plinth of cream tiles that
  // makes a bench round them; their outer ends dark green behind fences of green steel mesh.
  // Between them a passage up into the cave, and over its openings to each side a rainbow. On the
  // pillars' ends, the poster of the 1912 games (north) and a panel of flowers (south); along
  // their sides, coloured arrows to the ways out and the badges of sports clubs. A flat ceiling of black steel mesh hangs over the tracks and
  // the platform, and the track walls, dark green rock, have green mesh panels along their foot.
  'Stadion': {
    paint: { seed: 73, bands: [{ from: 0, color: '#1f4643' }, { from: 2.4, color: '#2b5a55', edge: 'soft' }, { from: 13.5, color: '#7fb2dc', edge: 'soft' }],
      motifs: [{ kind: 'dabs', colors: ['#23504c', '#376c66'], from: 2, to: 12, size: 0.6, count: 160 },
        { kind: 'dabs', colors: ['#6aa0d0', '#a2cbec'], from: 13.5, to: 18, size: 0.6, count: 80 },
        { kind: 'cracks', colors: ['#d8a838', '#2f5aa8'], from: 13.6, to: 18, count: 30 }] },
    island: {
      pillars: { width: 12, gap: 13, ends: 9, fenced: 0.35, plinth: 0.45,
        paint: { seed: 731, bands: [{ from: 0, color: '#7eb3de' }],
          motifs: [{ kind: 'dabs', colors: ['#5f97cc', '#a6cdee', '#8fbfe6'], from: 0, to: 18, size: 0.7, count: 260 },
            { kind: 'cracks', colors: ['#d8a838', '#d8a838', '#2f5aa8'], from: 0, to: 18, count: 70 }] },
        fencedPaint: { seed: 732, bands: [{ from: 0, color: '#2a5a56' }],
          motifs: [{ kind: 'dabs', colors: ['#1f4643', '#3b726b'], from: 0, to: 18, size: 0.7, count: 220 }] } },
      portal: { inset: 1.4, crown: 4.8, thickness: 0.45 },
      ceiling: 4.4,
      panels: 2.2,
    },
  },
  // Bagarmossen (15 August 1994, when the line went on to Skarpnäck and the station of 1958 out in
  // the open on Lagavägen was closed): an island platform 145 m long in a cave 19 m down (Swedish
  // Wikipedia). Photographs (2014 to 2022): the rock sprayed a light grey, darker in patches; the
  // track walls dark below and, all along them over a steel ledge, Gert Marcus's glass (1994):
  // 114 panels of screen-printed glass lit from behind, about 2.4 m wide and 1.3 m high, in
  // colours that fade into each other along the walls: greens to the north, the eastern wall
  // turning teal and then blue, the western violet, purple and pink and then blue towards the
  // south (the order is read from photographs, so it is approximate). Over each edge of the
  // platform a long fitting of lamps hung from the rock, the station's name on dark grey signs
  // under them; the floor polished grey stone in long slabs, a pale edge and a strip of brass
  // studs for the blind.
  'Bagarmossen': {
    paint: { seed: 1994, bands: [{ from: 0, color: '#232425' }, { from: 4.15, color: '#76777a', edge: 'ragged' }, { from: 6.5, color: '#9c9d9a', edge: 'soft' }],
      motifs: [{ kind: 'dabs', colors: ['#1a1b1c', '#323334'], from: 0, to: 4, size: 0.5, count: 120 },
        { kind: 'dabs', colors: ['#7f8082', '#929390', '#adada9'], from: 4.2, to: 18, size: 0.9, count: 200 },
        { kind: 'cracks', colors: ['#6f7071'], from: 6, to: 18, count: 12 }] },
    glass: {
      from: 2.3, to: 3.6,
      east: ['#3aa84e', '#2fa86a', '#22a39a', '#1f8fd0', '#2464e0', '#2c52e6'],
      west: ['#2aa26a', '#20a0a0', '#5b4fd0', '#8a3cc4', '#c03aa0', '#d9487c', '#6a52d6', '#2f6ae2'],
    },
    paving: {
      edge: 0.3, tactile: [0.36, 0.66], studs: true, slabs: 0.66, paverSize: [1.0, 0.6], mix: 0.25, veins: true,
      colors: { edge: 0xcdcac2, tactile: 0xcbbf98, slab: 0xa6a8a7, pavers: 0xa2a4a3, paler: 0xadafad, face: 0x3e3f40 },
      pattern: 'bond',
    },
    signs: { every: 36 },
  },
  // Skarpnäck (15 August 1994), the end of the green line: an island platform 145 m long in a
  // cave 25 m down (Swedish Wikipedia). Photographs (2008 to 2022): the whole cave painted a deep
  // brick red, mottled darker in its hollows, the track walls darker still towards their foot, an
  // orange ledge along them about as high as the trains' roofs. Over each edge of the platform a
  // long fitting of lamps hung from the rock, the station's name on black signs under them; the
  // floor red clinker in a running bond along the platform, a pale cream edge and a strip of
  // studs for the blind.
  'Skarpnäck': {
    paint: { seed: 1995, bands: [{ from: 0, color: '#3a1a12' }, { from: 2.2, color: '#7a2a16', edge: 'ragged' }, { from: 4.3, color: '#a33b1d', edge: 'soft' }],
      motifs: [{ kind: 'dabs', colors: ['#2a140e', '#4a2016'], from: 0, to: 2.2, size: 0.5, count: 100 },
        { kind: 'ribbon', color: '#d0601f', at: 4.0, width: 0.14 },
        { kind: 'dabs', colors: ['#b8471f', '#8a2e18', '#c0502a', '#6e2414'], from: 2.4, to: 18, size: 0.9, count: 220 },
        { kind: 'cracks', colors: ['#5a1c10'], from: 5, to: 18, count: 12 }] },
    paving: {
      edge: 0.3, tactile: [0.3, 0.6], studs: true, slabs: 0.6, paverSize: [0.25, 0.125], mix: 0.3,
      colors: { edge: 0xd8cdb6, tactile: 0xcfc4ac, slab: 0x9a4632, pavers: 0x9a4632, paler: 0xa85440, face: 0x4a3530 },
      pattern: 'bond',
    },
    signs: { every: 36 },
  },
  // Kungsträdgården (1977, Ulrik Samuelson): the garden and the palace Makalös that stood
  // above; the vault sprayed green, the walls' foot the bare grey-violet rock, and stripes of
  // red, white and green zigzagging along it
  'Kungsträdgården': { paint: { seed: 77, bands: [{ from: 0, color: '#6e655f' }, { from: 3.6, color: '#5f7d36', edge: 'ragged' }, { from: 7, color: '#6b8a3a', edge: 'soft' }],
    motifs: [{ kind: 'dabs', colors: ['#4a4440', '#857a72'], from: 0, to: 3.6, size: 0.4, count: 120, hard: true },
      { kind: 'zigzag', colors: ['#c0392b', '#f0ece4', '#3d7a3a'], at: 4.1, width: 0.16, pitch: 0.7 },
      { kind: 'zigzag', colors: ['#f0ece4', '#c0392b', '#3d7a3a'], at: 6.2, width: 0.16, pitch: 0.9 },
      { kind: 'dabs', colors: ['#4f6c2c', '#7a9a48'], from: 3.6, to: 18, size: 0.6, count: 160 }] } },
  // Rådhuset (1975, Sigvard Olsson, Fynden): the whole cave rust red, thin white and blue-grey
  // veins running down its walls
  'Rådhuset': { paint: { seed: 751, bands: [{ from: 0, color: '#7e3b1a' }, { from: 1.8, color: '#b2552c', edge: 'soft' }, { from: 9, color: '#9a4824', edge: 'soft' }],
    motifs: [{ kind: 'dabs', colors: ['#c4683a', '#8a4220'], from: 1.8, to: 18, size: 0.6, count: 200 },
      { kind: 'drips', colors: ['#d8d0c8', '#7e8a94'], from: 1.2, to: 6, count: 70, width: 0.025 }] } },
  // Stadshagen (1975, Lasse Lindqvist): sport; the vault near white, mid grey lower down, with
  // thin red lines like the lanes of a running track flowing along the walls
  'Stadshagen': { paint: { seed: 752, bands: [{ from: 0, color: '#8a8a80' }, { from: 3.4, color: '#c8c8c0', edge: 'soft' }],
    motifs: [{ kind: 'dabs', colors: ['#a8a8a0', '#dcdcd4'], from: 2, to: 18, size: 0.6, count: 180 },
      { kind: 'drips', colors: ['#8b2a25', '#8b2a25', '#f0f0ea'], from: 1.8, to: 7, count: 40, width: 0.035 }] } },
  // Västra skogen (1975, Sivert Lindblom): dark grey-brown rock, with shapes clad in little
  // diamond tiles of lime, orange, yellow, blue and white along the walls
  'Västra skogen': { paint: { seed: 753, bands: [{ from: 0, color: '#4a4a3a' }, { from: 2.4, color: '#6e6a5c', edge: 'soft' }],
    motifs: [{ kind: 'dabs', colors: ['#5a574a', '#827e70'], from: 2, to: 18, size: 0.6, count: 200 },
      { kind: 'panels', color: '#3a6ab8', frame: '#2a2a2a', from: 2.4, to: 4.4, width: 1.6, every: 7, pattern: 'harlequin' },
      { kind: 'stripes', colors: ['#e08a2a', '#3a6ab8', '#8ab83a', '#e8c840', '#f2f0ea'], from: 1.9, to: 2.1, width: 0.25, gap: 0.1 }] } },
  // Solna centrum (1975, Karl-Olov Björk and Anders Åberg): a red evening sky over the dark green
  // of a spruce forest, all round the cave, with small scenes of the countryside in the green
  'Solna centrum': { paint: { seed: 1975, bands: [{ from: 0, color: '#2f6b4a' }, { from: 4.6, color: '#c8301f' }, { from: 9, color: '#9c2a25', edge: 'soft' }],
    motifs: [{ kind: 'forest', color: '#2f6b4a', from: 4.4, to: 6.0 },
      { kind: 'dabs', colors: ['#285c3e', '#3d8a64'], from: 1.6, to: 4.4, size: 0.5, count: 100 },
      { kind: 'people', colors: ['#c8b890', '#8a6a4a', '#d8d0c0'], from: 2.6, to: 4.4, count: 12 },
      { kind: 'doodles', color: '#d8d0b0', from: 2.6, to: 4.2, count: 10 }] } },
  // Näckrosen (1975, Lizzie Olsson Arle): pale grey rock; over the platform a pond of water
  // lilies on the roof, and boulders and small white ornaments set into the walls
  'Näckrosen': { paint: { seed: 754, bands: [{ from: 0, color: '#8a8a86' }, { from: 2.2, color: '#b8b8b2', edge: 'soft' }],
    motifs: [{ kind: 'dabs', colors: ['#8a8a86', '#c8c8c2'], from: 2, to: 18, size: 0.6, count: 180 },
      { kind: 'dabs', colors: ['#7a6658', '#6a5648', '#8a7464'], from: 2.6, to: 4.6, size: 0.14, count: 260, hard: true },
      { kind: 'lilies', from: 6.5, to: 17, count: 16 }] } },
  // Hallonbergen (1975, Elis Eriksson and Gösta Wallmark): off-white rock covered in drawings
  // after children's: ships, people, dogs, houses, the sun, in black lines with a little colour
  'Hallonbergen': { paint: { seed: 755, bands: [{ from: 0, color: '#a8a296' }, { from: 2, color: '#d8d4ca', edge: 'soft' }],
    motifs: [{ kind: 'dabs', colors: ['#bdb7aa', '#e4e0d6'], from: 2, to: 18, size: 0.6, count: 160 },
      { kind: 'dabs', colors: ['#e88aa8', '#d8302a', '#e8c840', '#3a6ab8'], from: 2.4, to: 8, size: 0.12, count: 70, hard: true },
      { kind: 'doodles', color: '#1a1a1a', from: 2.4, to: 8, count: 60 },
      { kind: 'people', colors: ['#1a1a1a'], from: 2.4, to: 5, count: 14, outline: true }] } },
  // Husby (1977, Birgit Broms): pale yellow-olive rock, and along the track walls a band of
  // panels, grey-white, yellow and grey-brown, over the bare grey rock of the walls' foot
  'Husby': { paint: { seed: 771, bands: [{ from: 0, color: '#8a8a86' }, { from: 2.6, color: '#c8c07a', edge: 'ragged' }, { from: 8, color: '#b0a868', edge: 'soft' }],
    motifs: [{ kind: 'dabs', colors: ['#9a9258', '#d4cc8a'], from: 2.6, to: 18, size: 0.6, count: 180 },
      { kind: 'stripes', colors: ['#c8ccd0', '#d8c84a', '#6a5a4a', '#c8ccd0'], from: 2.6, to: 4.1, width: 2.4, gap: 0.12 }] } },
  // Akalla (1975–77, Birgit Ståhl-Nyberg): the cave yellow ochre all over, with great tiled
  // murals of people at work and at play set into the walls
  'Akalla': { paint: { seed: 772, bands: [{ from: 0, color: '#977849' }, { from: 1.8, color: '#d7bb75', edge: 'soft' }, { from: 8, color: '#b8964a', edge: 'soft' }],
    motifs: [{ kind: 'dabs', colors: ['#c4a45e', '#e2c888'], from: 1.8, to: 18, size: 0.6, count: 200 },
      { kind: 'panels', color: '#d8d6d0', frame: '#3a3a3a', from: 2.4, to: 4.9, width: 8, every: 20, pattern: 'mural' }] } },
  // Huvudsta (1985, Per Holmberg, Hängande trädgårdar): pale rock with great masses of dark
  // green foliage hanging from the roof, a band of little coloured blocks over the raw dark rock
  // of the track wall's foot
  'Huvudsta': { paint: { seed: 85, bands: [{ from: 0, color: '#2f2d2b' }, { from: 2.9, color: '#d9d7d0', edge: 'ragged' }],
    motifs: [{ kind: 'stripes', colors: ['#4a46a8', '#e8c020', '#c83a3a', '#2f6fc0'], from: 2.85, to: 3.05, width: 0.3, gap: 0 },
      { kind: 'canopy', color: '#2b7d48', shade: '#1f5a34', from: 4.4, to: 6.5 }] } },
  // Solna strand (1985, Takashi Naraha, Himmelen av kub): dark grey rock, with squares of blue
  // sky and clouds set into it at angles, like cubes sunk into the rock
  'Solna strand': { paint: { seed: 851, bands: [{ from: 0, color: '#3c3c3f' }, { from: 2.4, color: '#48484b', edge: 'soft' }],
    motifs: [{ kind: 'ribbon', color: '#2a2a2c', at: 3.1, width: 0.12 },
      { kind: 'dabs', colors: ['#5c5c5f', '#333336'], from: 2.4, to: 18, size: 0.6, count: 160 },
      { kind: 'windows', color: '#3f8fd0', from: 3.4, to: 17, count: 20, size: 0.85 }] } },
  // Sundbybergs centrum (1985, Lars Kleen, Michael Söderlundh, Peter Tillberg): raw grey rock to
  // a jagged edge, then the vault painted terracotta, darker over the roof, with dark ribs drawn
  // across it
  'Sundbybergs centrum': { paint: { seed: 852, bands: [{ from: 0, color: '#5f5e5a' }, { from: 3.6, color: '#a06a55', edge: 'ragged' }, { from: 7, color: '#7a4c3e', edge: 'soft' }],
    motifs: [{ kind: 'stripes', colors: ['#4e2e24'], from: 3.7, to: 18, width: 0.06, gap: 3.4 }] } },
  // Duvbo (1985, Gösta Sillén): the rock as it is, grey-brown and mottled, with pale panels like
  // ruled pages set into it, fragments of bones and shells on them
  'Duvbo': { paint: { seed: 853, bands: [{ from: 0, color: '#3a3732' }, { from: 3.1, color: '#6f6a5e', edge: 'ragged' }],
    motifs: [{ kind: 'dabs', colors: ['#9a9284', '#4a463e', '#857e70'], from: 3.1, to: 18, size: 0.5, count: 260 },
      { kind: 'panels', color: '#b8b2a4', frame: '#8e877a', from: 2.6, to: 4.4, width: 1.6, every: 6, pattern: 'ruled' }] } },
  // Rissne (1985, Madeleine Dranger and Rolf H Reimers): pale rock over the dark rock of the
  // walls' foot; along the track walls a band of thin coloured lines, and over it the history
  // of the world from 3000 BC to 1985, written by hand, with little maps
  'Rissne': { paint: { seed: 854, bands: [{ from: 0, color: '#2c2c2e' }, { from: 2.8, color: '#dedcd6', edge: 'ragged' }],
    motifs: [{ kind: 'dabs', colors: ['#c8c6c0'], from: 3.5, to: 18, size: 0.7, count: 120 },
      { kind: 'stripes', along: true, colors: ['#f4f4f2', '#2a9a8a', '#3c9c50', '#6a3a8a', '#b83a3a'], from: 2.85, to: 3.35, width: 0.045, gap: 0.012 },
      { kind: 'writing', colors: ['#1d4f9a', '#b83a3a', '#2a7a3a', '#6a3a8a', '#222222'], from: 3.45, to: 4.9 },
      { kind: 'dabs', colors: ['#e8c020', '#2f6fc0', '#3c9c50', '#c83a3a'], from: 3.5, to: 4.9, size: 0.18, count: 40 }] } },
  // Rinkeby (1985, Nisse Zetterberg, Sven Sahlberg, Lennart Gram): the whole cave burnt orange,
  // with gold mosaics of runes and finds from the Viking age set into it
  'Rinkeby': { paint: { seed: 855, bands: [{ from: 0, color: '#8a3c22' }, { from: 2.2, color: '#b0532f', edge: 'soft' }],
    motifs: [{ kind: 'dabs', colors: ['#c8643c', '#7a3520'], from: 2.2, to: 18, size: 0.6, count: 200 },
      { kind: 'panels', color: '#c8a848', frame: '#5a4a24', from: 3.0, to: 4.5, width: 1.3, every: 8, pattern: 'mosaic' }] } },
  // Tensta (1975, Helga Henschen, En ros till invandrarna): chalk-white rock in deep folds, sky
  // blue in its hollows overhead, and green fields on the walls with animals and plants drawn
  // in white
  'Tensta': { paint: { seed: 75, bands: [{ from: 0, color: '#5a5a58' }, { from: 2.2, color: '#e6e4de', edge: 'ragged' }],
    motifs: [{ kind: 'dabs', colors: ['#c4c2ba', '#d4d2ca'], from: 2.2, to: 18, size: 0.8, count: 160 },
      { kind: 'dabs', colors: ['#5e90c4', '#3a6ea8'], from: 6.5, to: 18, size: 0.6, count: 30, hard: true },
      { kind: 'panels', color: '#4a8a3a', frame: '#2c6a2c', from: 2.3, to: 4.7, width: 3, every: 8 },
      { kind: 'doodles', color: '#f4f4ee', from: 2.6, to: 4.4, count: 30 }] } },
  // Hjulsta (1975): warm grey rock all over, and Eva Nyberg's frieze along the track wall: a
  // march with red banners past a factory and a town, under a night sky
  'Hjulsta': { paint: { seed: 751, bands: [{ from: 0, color: '#6e6d68' }, { from: 2, color: '#8c8b86', edge: 'soft' }],
    motifs: [{ kind: 'dabs', colors: ['#a8a7a2', '#5e5d5a'], from: 2, to: 18, size: 0.6, count: 220 },
      { kind: 'frieze', from: 3.1, to: 5.1 }] } },
};
