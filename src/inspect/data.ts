// What the inspector reads: the game's data in public/data/, and the tools' inputs in data/, which
// only the inspector's dev server serves (tools/inspect.ts).
import { ORIGIN, lonLatToWorld, unproject } from '../geo';
import { STRUCTURE_KINDS } from '../track-geometry';
import type { StructureKind, TrackGeometry } from '../track-geometry';
import type { TrackGraph } from '../track-graph';
import type { StationLayouts } from '../station-layout';
import type { CityIndex } from '../city-tile';
import type { StationPlacement } from '../station-models';

export const getJson = <T>(url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
});

// data/station-descriptions.json, as tools/build-stations.ts reads it
export interface Description { drawing?: string; note?: string; axis?: unknown; routes?: unknown[]; [k: string]: unknown }
type Along = { along: [number, number][]; reach: number; why: string };
export interface Refs {
  descriptions: Record<string, Description>;
  heights: Record<string, { wikidata: string; height: number }>;
  heightNote: string;
  heightFixes: { stations?: { station: string; height: number; why: string }[]; uncovered?: Along[]; offGround?: Along[] };
  trackFixes: {
    crossovers?: { a: [number, number]; b: [number, number]; why: string }[];
    platforms?: { station: string; why: string; reach?: number; replace?: boolean }[];
    links?: { why: string }[];
  };
  // OpenStreetMap's subway entrances
  entrances: { id: number; x: number; z: number; name: string | null }[];
}

// A station on Albert Guillaumes' site: its drawing, and the name of its 3D model where he has
// published one.
export interface GuillaumesStation { name: string; drawing: string; model: string | null }

// A station model (public/data/stations.json), with its file's name and how well it fits.
export interface StationModel extends StationPlacement {
  file: string;
  fit?: { scaleCheck: number; atPlatforms: Record<string, [number, number]> };
}

export interface InspectData {
  graph: TrackGraph;
  // the stations drawn from a model, by name
  models: Map<string, StationModel>;
  geometry: TrackGeometry;
  layouts: StationLayouts | null;
  city: CityIndex | null;
  // null when the page isn't served by tools/inspect.ts
  refs: Refs | null;
  // by name; null when his site couldn't be reached either
  guillaumes: Map<string, GuillaumesStation> | null;
}

interface OsmElement { type: string; id: number; lat?: number; lon?: number; tags?: Record<string, string> }

async function loadRefs(): Promise<Refs> {
  const ref = <T>(file: string) => getJson<T>(`__inspect/data/${file}`);
  const [descriptions, heights, heightFixes, trackFixes, osm] = await Promise.all([
    ref<{ stations: Refs['descriptions'] }>('station-descriptions.json'),
    ref<{ note: string; stations: Refs['heights'] }>('station-heights.json'),
    ref<Refs['heightFixes']>('height-corrections.json'),
    ref<Refs['trackFixes']>('track-corrections.json'),
    ref<{ elements: OsmElement[] }>('osm/network.json'),
  ]);
  const entrances = osm.elements
    .filter((e) => e.type === 'node' && e.tags?.railway === 'subway_entrance' && e.lat !== undefined)
    .map((e) => ({ id: e.id, ...lonLatToWorld(e.lon!, e.lat!), name: e.tags?.name ?? e.tags?.ref ?? null }));
  return { descriptions: descriptions.stations, heights: heights.stations, heightNote: heights.note, heightFixes, trackFixes, entrances };
}

export async function loadData(): Promise<InspectData> {
  const [graph, models, geometry, layouts, city, refs, guillaumes] = await Promise.all([
    getJson<TrackGraph>('data/track-graph.json'),
    getJson<Record<string, StationModel>>('data/stations.json').then((m) => new Map(Object.entries(m).map(([file, s]) => [s.name, { ...s, file }]))),
    getJson<TrackGeometry>('data/track-geometry.json'),
    getJson<StationLayouts>('data/station-layouts.json').catch(() => null),
    getJson<CityIndex>('data/city/index.json').catch(() => null),
    loadRefs().catch((err) => { console.warn('no reference data (run npm run inspect):', err); return null; }),
    getJson<GuillaumesStation[]>('__inspect/guillaumes').then((list) => new Map(list.map((s) => [s.name, s])))
      .catch((err) => { console.warn("no index of Albert Guillaumes' stations:", err); return null; }),
  ]);
  return { graph, models, geometry, layouts, city, refs, guillaumes };
}

// ------------------------------------------------------------------ places
// World x, z to latitude and longitude; and grid points (SWEREF 99 18 00, as the corrections
// give them) to world x, z.
export const worldLatLon = (x: number, z: number) => unproject(ORIGIN.e + x, ORIGIN.n - z);
export const gridToWorld = ([e, n]: [number, number]) => ({ x: e - ORIGIN.e, z: ORIGIN.n - n });
// Metres from a point to a polyline.
export function distToLine(x: number, z: number, pts: readonly (readonly [number, number])[]) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
  }
  return pts.length === 1 ? Math.hypot(pts[0][0] - x, pts[0][1] - z) : best;
}

// ------------------------------------------------------------------ the drawn track
// A point of the track the game draws (track-geometry.json): piece `piece`, its `i`th sample.
export interface Sample { piece: number; i: number; x: number; y: number; z: number; kind: StructureKind }

const CELL = 50;

// Every sample of the drawn track, by CELL square, to find the one nearest a point.
export class TrackIndex {
  private cells = new Map<string, Sample[]>();

  constructor(readonly geometry: TrackGeometry) {
    for (const [key, p] of Object.entries(geometry.pieces)) {
      for (let i = 0; i < p.s.length; i++) {
        const sm: Sample = { piece: Number(key), i, x: p.x[i], y: p.y[i], z: p.z[i], kind: STRUCTURE_KINDS[p.kind[Math.min(i, p.kind.length - 1)]] };
        const k = `${Math.floor(sm.x / CELL)},${Math.floor(sm.z / CELL)}`;
        const list = this.cells.get(k);
        if (list) list.push(sm); else this.cells.set(k, [sm]);
      }
    }
  }

  // The sample nearest (x, z) within `reach` metres; with y, the nearest in 3D, so that of two
  // tracks one over the other, the one nearer the camera.
  nearest(x: number, z: number, reach: number, y?: number) {
    let best: Sample | null = null, bestD = Infinity;
    const r = Math.ceil(reach / CELL);
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
      for (const sm of this.cells.get(`${i},${j}`) ?? []) {
        const flat = Math.hypot(sm.x - x, sm.z - z);
        if (flat > reach) continue;
        const d = y === undefined ? flat : Math.hypot(flat, (sm.y - y) * 0.5);
        if (d < bestD) { bestD = d; best = sm; }
      }
    }
    return best;
  }

  // The heading along the track at a sample (as the player's yaw: 0 looks north, towards −z),
  // looking from the piece's `from` end towards its `to` end.
  heading(sm: Sample) {
    const p = this.geometry.pieces[sm.piece];
    const a = Math.max(0, sm.i - 1), b = Math.min(p.x.length - 1, sm.i + 1);
    return Math.atan2(-(p.x[b] - p.x[a]), -(p.z[b] - p.z[a]));
  }
}
