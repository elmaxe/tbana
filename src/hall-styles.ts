// Platform halls the network draws (src/network.ts) in their own style rather than as a plain
// vault in rock: for now Hötorget, as it has looked since 1952, with Gun Gordillo's neon (1998),
// and Östermalmstorg, with Siri Derkert's lines in its concrete walls (1965).
// Heights are above the top of the rail (the platform is 1.0 m above it).

export interface HallStyle {
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

// Hötorget: an island platform under Sveavägen, opened as Kungsgatan in 1952 (architect Gunnar
// Lené) and kept as it was: the walls and columns in square tiles of seven shades of pale
// blue-green, clinker on the floor, a flat roof with the lamps in a soffit along each track, and
// small navy name plates along the track walls. Since the renovation of 2024–25 its old name,
// Kungsgatan, is up on the walls again, between reproductions of two 1950s posters. Gun Gordillo
// hung 103 lines of neon in five tones of white from its ceiling in 1998, at different heights.
export const HALL_STYLES: Record<string, HallStyle> = {
  'Hötorget': {
    soffit: 3.9,
    ceiling: 4.6,
    step: 0.5,
    columns: { fromEdge: 2.2, size: 0.72, spacing: 8 },
    tilesFrom: 0.7,
    plateAt: 2.25,
    posters: { name: 'KUNGSGATAN', at: 2.3, apart: 1.27 },
    neon: { count: 103, tones: [0xffffff, 0xf3f7ff, 0xfff4e2, 0xe6f2ff, 0xfffbe8], reach: 2.6, below: [0.12, 0.75] },
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
