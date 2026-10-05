// The metro's track network, as written by tools/build-track-graph.ts to
// public/data/track-graph.json. Positions are world x, z in metres (src/geo.ts); heights come in a
// later step.

// Where a piece of track starts or ends:
// - switch: three tracks meet (a turnout)
// - crossing: four or more tracks meet (a diamond crossing, or two switches mapped as one node)
// - end: a buffer stop, or where the mapped track stops
// - portal: the structure changes: a tunnel mouth, or the end of a bridge
// - join: anything else that splits a piece, such as a change of track type
export type NodeKind = 'switch' | 'crossing' | 'end' | 'portal' | 'join';

export interface TrackNode {
  id: number; // the OpenStreetMap node id
  x: number;
  z: number;
  kind: NodeKind;
  // For switches and crossings: pairs of pieces a train may pass between here, as piece ids.
  // Two pieces connect when their tracks leave the node in nearly opposite directions.
  through?: [number, number][];
}

// tunnel: underground or covered; bridge: a bridge or viaduct; surface: everything else
export type Structure = 'tunnel' | 'bridge' | 'surface';
// main: a running line; the others follow OpenStreetMap's service=* tag
export type Service = 'main' | 'crossover' | 'siding' | 'yard' | 'spur';

export interface TrackPiece {
  id: number;
  from: number; // node id
  to: number;   // node id
  points: [number, number][]; // x, z from `from` to `to`
  length: number;
  structure: Structure;
  service: Service;
  lines: string[]; // 'red', 'green', 'blue' as named in OpenStreetMap; empty when unnamed
  ways: number[];  // the OpenStreetMap ways it comes from
  covered?: true;  // a depot's track under cover (OpenStreetMap's covered=yes): through a hall
  layer?: number;  // OpenStreetMap's layer (or level), where tagged: which is above where tracks cross
}

// A stretch of track beside a platform. s0 < s1 are distances along the piece from its `from`
// end; side is the platform's side looking from `from` towards `to`.
export interface PlatformTrack { piece: number; s0: number; s1: number; side: 'left' | 'right' }

export interface Platform { osm: number; tracks: PlatformTrack[] }

export interface Station { name: string; osm: number; x: number; z: number; platforms: Platform[] }

// A stop on a traced route: the station and where the train stands, at the middle of the
// platform track.
export interface RouteStop { station: string; piece: number; s: number }

// A route traced through the graph: the pieces in running order, each with the direction it is
// run in (+1 from `from` to `to`, -1 the other way).
export interface Route {
  name: string;
  service: string; // as named in data/routes.json, such as 'T13'; each service has a route each way
  line: string;
  stops: RouteStop[];
  path: { piece: number; dir: 1 | -1 }[];
  length: number;
}

// Each service runs a train every `headway` seconds each way, timed so that one is at `station`
// `offset` seconds into each headway.
export interface Timetable { station: string; services: Record<string, { headway: number; offset: number }> }

export interface TrackGraph {
  attribution: string;
  osm: string | null; // timestamp of the OpenStreetMap data
  nodes: TrackNode[];
  pieces: TrackPiece[];
  stations: Station[];
  routes: Route[];
  timetable?: Timetable;
}
