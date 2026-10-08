import type { CavePaint } from './textures';

// Platform halls the network draws (src/network.ts) in their own style rather than as a plain
// vault in rock: Hötorget, as it has looked since 1952, with Gun Gordillo's neon (1998);
// Karlaplan, as it has looked since 1967, with Tor Hörlin's niches and Larseric Vänerlöf's
// photomontage; and Östermalmstorg, with Siri Derkert's lines in its concrete walls (1965).
// Heights are above the top of the rail (the platform is 1.0 m above it).

export type HallStyle = FlatHall | VaultHall;

export interface FlatHall {
  kind: 'flat';
  // a flat roof: low over the track (the soffit, with the lamps in it), stepping up between the
  // two rows of columns to the ceiling
  soffit: number;
  ceiling: number;
  step: number;          // across the slope from the soffit up to the ceiling
  // square tiled columns along the platform, `fromEdge` from the edge to their middle
  columns: { fromEdge: number; size: number; spacing: number };
  // the track walls: tiled from `tilesFrom` up to the soffit, plaster below; name plates on
  // them `plateAt` high, one in the middle of every repeat of their tiles (src/textures.ts)
  tilesFrom: number;
  plateAt: number;
  // once along each track wall, near the middle of the platform: a plate with the station's old
  // name between two posters, `apart` from it, with their middles `at` high
  posters?: { name: string; at: number; apart: number };
  // neon tubes hung under the ceiling between the columns
  neon: { count: number; tones: number[]; reach: number; below: [number, number] };
}

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
// Karlaplan: an island platform in a cavern 23 m down under Fältöversten, opened in 1967. A
// smooth, pale vault over both tracks, lit by one long row of lamps; the track walls clad in white
// enamelled steel panels (2006) over a black plinth, with the station's name in small black
// capitals; dark granite on the floor with a pale stone edge. Down the middle of the platform,
// blocks in long, cream glazed tiles with dark joints between their bays, the name in navy
// capitals along their tops with the ways out (Karlaplan to the south-west, Valhallavägen to the
// north-east); in their sides Tor Hörlin's niches (1967), lined in green stoneware with a band of
// coloured tiles over a yellow wooden bench. Along one track wall, Larseric Vänerlöf's
// photomontage (1983, renewed 2009) of old Östermalm in black and white, 96 m long.
export const HALL_STYLES: Record<string, HallStyle> = {
  'Hötorget': {
    kind: 'flat',
    soffit: 3.9,
    ceiling: 4.6,
    step: 0.5,
    columns: { fromEdge: 2.2, size: 0.72, spacing: 8 },
    tilesFrom: 0.7,
    plateAt: 2.25,
    posters: { name: 'KUNGSGATAN', at: 2.3, apart: 1.27 },
    neon: { count: 103, tones: [0xffffff, 0xf3f7ff, 0xfff4e2, 0xe6f2ff, 0xfffbe8], reach: 2.6, below: [0.12, 0.75] },
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
};

// A platform hall in rock with a platform of its own beside one track, styled: the walls straight
// up to `spring`, then a shallow vault (`risePerWidth` of the hall's width) in smooth white
// plaster with a row of lamps along it over the platform; white name signs on the wall behind the
// platform, `signAt` high, every `signEvery` m.
export interface VaultStyle {
  spring: number;
  risePerWidth: number;
  signAt: number;
  signEvery: number;
}

// Östermalmstorg (1965), 38 m down: a hall in rock for each
// track, the platforms side by side beyond the wall between them. Their walls are in-situ
// concrete, light and pitted, and the track walls carry Siri Derkert's Ristningar i betong
// (1961–65): lines sandblasted into the concrete, of women of the peace and women's movements,
// faces, singers, Rachel Carson's Tyst vår, staves of song and "peace" in several languages. Over
// them a smooth white vault, the floor dark terrazzo with a band of pale tiles along the edge.
export const VAULT_STYLES: Record<string, VaultStyle> = {
  'Östermalmstorg': { spring: 4.3, risePerWidth: 0.16, signAt: 3.75, signEvery: 40 },
};

// The blue line's stations (1975–85), where the rock was left as it was blasted, sprayed with
// concrete and painted: a cave, each painted as an artist chose. The halls keep their outlines,
// roughened (src/network.ts); `paint` says how the rock is painted (src/textures.ts).
export interface CaveStyle {
  paint: CavePaint;
}
// Round from the track's floor (src/textures.ts): the platform is at 1.6, the walls rise to
// about 4.2, and the crown is at about 9 over a hall of one track, 16 over an island platform.
export const CAVE_STYLES: Record<string, CaveStyle> = {
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
