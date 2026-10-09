// The track as the game draws it, as written by tools/build-track-geometry.ts to
// public/data/track-geometry.json: every piece of the drawn lines' track in
// public/data/track-graph.json (what their services run on, and the crossovers, sidings and depots
// joined to that; tools/lib/graph.ts lineTrack), with its plan smoothed and the two tracks of a
// line spaced as built, its heights from public/data/track-heights.json, and the kind of
// structure it runs in.

// rock: a tunnel blasted in rock; box: a concrete tunnel built in a trench (cut and cover), and
// the troughs that carry the line under water; cutting: open track below the ground, between
// retaining walls; grade: on the ground; embankment: above the ground on a bank; bridge: a bridge
// or viaduct
export type StructureKind = 'rock' | 'box' | 'cutting' | 'grade' | 'embankment' | 'bridge';
export const STRUCTURE_KINDS: StructureKind[] = ['rock', 'box', 'cutting', 'grade', 'embankment', 'bridge'];

// A platform beside a stretch of a piece: s0 < s1 along the piece (as in the track graph), on the
// given side looking from the piece's `from` end (+1 right, −1 left), `width` metres wide.
// An island platform has a track on each side, and both tracks list it.
export interface GeometryPlatform { station: string; s0: number; s1: number; side: 1 | -1; width: number; island: boolean }

export interface GeometryPiece {
  // one entry per point, about 10 m apart:
  s: number[];       // distance along the piece in the track graph (its OpenStreetMap geometry)
  x: number[];       // world x, z of the track's centre line
  z: number[];
  y: number[];       // top of the rail, RH 2000
  ground: (number | null)[]; // the ground above or below, where known
  kind: number[];    // index into STRUCTURE_KINDS
  // The other track of the line where the two share a structure (one tunnel, bridge or bank):
  // its distance to the right of this one (negative: to the left), looking from `from` to `to`,
  // and how much higher its rail is. 0 and 0 where there is none.
  pair: number[];
  pairDy: number[];
  platforms: GeometryPlatform[];
  // The nearest other track on each side, square to this one, at about the same level and either
  // both in a tunnel or both out of one: how far it is (negative for a track a service runs on,
  // 0 where there is none within 12 m). Where any is near; track no service runs on shares its
  // hall, formation or deck with the tracks beside it, and turnouts have no conductor rail.
  left?: number[];
  right?: number[];
  // Another line's track beside this one in the same concrete box, on the side away from the
  // other track of this one's line: its distance to the right (negative: to the left), 0 where
  // there is none. Where any is (the red and green lines' four tracks from Gamla stan towards
  // T-Centralen); each track's part of the box reaches halfway to it. And how much higher its
  // rails are, where they part for T-Centralen's two levels: the roof is between their levels.
  beside?: number[];
  besideDy?: number[];
}

export interface TrackGeometry {
  attribution: string;
  osm: string | null;
  note: string;
  pieces: Record<string, GeometryPiece>;
}
