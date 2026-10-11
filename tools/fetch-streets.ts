// Takes the streets, squares and trees from OpenStreetMap in the areas drawn in detail
// (src/detail/areas.ts), for src/detail/streets.ts to draw near the camera.
//
//   npm run fetch-streets [-- extract.osm.pbf]       -> data/osm/streets.json
//
// Reads the same regional extract as tools/fetch-city.ts (downloaded to the system's temporary
// directory unless a file is given). Kept, within 40 m of an area:
// - the streets and paths (highway=* ways but those that aren't on the ground: proposed, under
//   construction, platforms, lifts), with the tags that say how they look;
// - squares and other paved areas: closed highway=* ways or relations with area=yes, area:highway=*,
//   and car parks;
// - trees: natural=tree points and natural=tree_row lines (tools/find-trees.ts finds the rest in
//   the laser scan).
// tools/build-city.ts puts them in the city's tiles.
//
// The data is © OpenStreetMap contributors, under the ODbL.
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { lonLatToWorld } from '../src/geo.ts';
import { inDetailArea } from '../src/detail/areas.ts';
import { readPbf } from './lib/osm-pbf.ts';

const EXTRACT = 'https://download.openstreetmap.fr/extracts/europe/sweden/stockholm.osm.pbf';
const OUT = 'data/osm/streets.json';
const MARGIN = 40;
const KEEP_WAY = ['highway', 'area:highway', 'amenity', 'area', 'name', 'width', 'est_width', 'lanes', 'oneway', 'surface',
  'footway', 'cycleway', 'sidewalk', 'segregated', 'crossing', 'crossing:markings', 'service', 'bridge', 'tunnel', 'covered',
  'layer', 'level', 'indoor', 'location', 'natural'];
const KEEP_TREE = ['natural', 'genus', 'species', 'leaf_type', 'leaf_cycle', 'height', 'circumference', 'diameter_crown', 'denotation'];
const NOT_ON_GROUND = new Set(['proposed', 'construction', 'abandoned', 'disused', 'platform', 'elevator', 'bus_stop', 'corridor',
  'raceway', 'services', 'rest_area', 'via_ferrata', 'razed']);

let path = process.argv[2];
if (!path) {
  const dir = join(tmpdir(), 'tbana');
  mkdirSync(dir, { recursive: true });
  path = join(dir, 'stockholm.osm.pbf');
  // a day old at most: the extract is made daily
  if (!existsSync(path) || Date.now() - statSync(path).mtimeMs > 24 * 3600e3) {
    console.log(`downloading ${EXTRACT}`);
    const res = await fetch(EXTRACT, { headers: { 'User-Agent': 'tbana (https://github.com/elmaxe/tbana)' } });
    if (!res.ok || !res.body) throw new Error(`${EXTRACT}: HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(path + '.part'));
    renameSync(path + '.part', path);
  }
}
const extractDate = statSync(path).mtime.toISOString().slice(0, 10);

const isStreet = (t: Record<string, string>) => !!t.highway && !NOT_ON_GROUND.has(t.highway);
const isArea = (t: Record<string, string>) =>
  (!!t.highway && t.area === 'yes' && !NOT_ON_GROUND.has(t.highway)) || !!t['area:highway'] || t.amenity === 'parking';
const keep = (tags: Record<string, string>, keys: string[]) => Object.fromEntries(keys.filter((k) => tags[k] !== undefined).map((k) => [k, tags[k]]));

// 1. the multipolygon relations that are paved areas, and their member ways
interface Rel { id: number; tags: Record<string, string>; outer: number[]; inner: number[] }
const rels: Rel[] = [];
const memberWays = new Set<number>();
readPbf(path, {
  relation: (r) => {
    if (r.tags.type !== 'multipolygon' || !isArea(r.tags) || r.tags.parking === 'underground') return;
    const rel: Rel = { id: r.id, tags: r.tags, outer: [], inner: [] };
    for (const m of r.members) {
      if (m.type !== 'way') continue;
      (m.role === 'inner' ? rel.inner : rel.outer).push(m.ref);
      memberWays.add(m.ref);
    }
    rels.push(rel);
  },
});

// 2. the ways, and the trees standing alone
const ways = new Map<number, { refs: number[]; tags: Record<string, string> }>();
const needed = new Set<number>();
readPbf(path, {
  way: (w) => {
    if (!isStreet(w.tags) && !isArea(w.tags) && w.tags.natural !== 'tree_row' && !memberWays.has(w.id)) return;
    ways.set(w.id, { refs: w.refs, tags: w.tags });
    for (const r of w.refs) needed.add(r);
  },
});
const nodes = new Map<number, [number, number]>();
const trees: { osm: string; tags: Record<string, string>; x: number; z: number }[] = [];
readPbf(path, {
  node: (n) => {
    const tree = n.tags?.natural === 'tree';
    if (!needed.has(n.id) && !tree) return;
    const { x, z } = lonLatToWorld(n.lon, n.lat);
    const p: [number, number] = [Math.round(x * 10) / 10, Math.round(z * 10) / 10];
    if (needed.has(n.id)) nodes.set(n.id, p);
    if (tree && inDetailArea(p[0], p[1], MARGIN)) trees.push({ osm: `n${n.id}`, tags: keep(n.tags!, KEEP_TREE), x: p[0], z: p[1] });
  },
});

type Line = [number, number][];
const lineOf = (refs: number[]): Line | null => {
  const pts = refs.map((r) => nodes.get(r));
  return pts.some((p) => !p) ? null : (pts as Line);
};
const near = (l: Line) => l.some(([x, z]) => inDetailArea(x, z, MARGIN));

// joins a relation's member ways into closed rings, end to end
function joinRings(ids: number[]): Line[] {
  const open = ids.map((id) => ways.get(id)?.refs).filter((r): r is number[] => !!r && r.length >= 2).map((r) => [...r]);
  const rings: Line[] = [];
  while (open.length) {
    let cur = open.shift()!;
    for (let guard = 0; cur[0] !== cur[cur.length - 1] && guard < 1000; guard++) {
      const k = open.findIndex((w) => w[0] === cur[cur.length - 1] || w[w.length - 1] === cur[cur.length - 1]);
      if (k < 0) break;
      const w = open.splice(k, 1)[0];
      cur = cur.concat((w[0] === cur[cur.length - 1] ? w : [...w].reverse()).slice(1));
    }
    if (cur.length >= 4 && cur[0] === cur[cur.length - 1]) {
      const r = lineOf(cur);
      if (r) rings.push(r.slice(0, -1));
    }
  }
  return rings;
}
function inside(p: [number, number], ring: Line) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

const streets: { osm: string; tags: Record<string, string>; line: Line }[] = [];
const areas: { osm: string; tags: Record<string, string>; rings: Line[] }[] = [];
const rows: { osm: string; tags: Record<string, string>; line: Line }[] = [];
for (const [id, w] of ways) {
  const l = lineOf(w.refs);
  if (!l || l.length < 2 || !near(l)) continue;
  const closed = w.refs.length >= 4 && w.refs[0] === w.refs[w.refs.length - 1];
  if (closed && isArea(w.tags)) areas.push({ osm: `w${id}`, tags: keep(w.tags, KEEP_WAY), rings: [l.slice(0, -1)] });
  else if (isStreet(w.tags)) streets.push({ osm: `w${id}`, tags: keep(w.tags, KEEP_WAY), line: l });
  else if (w.tags.natural === 'tree_row') rows.push({ osm: `w${id}`, tags: keep(w.tags, KEEP_TREE), line: l });
}
for (const rel of rels) {
  const outers = joinRings(rel.outer), inners = joinRings(rel.inner);
  for (const o of outers) {
    if (o.length < 3 || !near(o)) continue;
    areas.push({ osm: `r${rel.id}`, tags: keep(rel.tags, KEEP_WAY), rings: [o, ...inners.filter((h) => inside(h[0], o))] });
  }
}
const byId = (a: { osm: string }, b: { osm: string }) => a.osm.localeCompare(b.osm, 'en', { numeric: true });
[streets, areas, rows, trees].forEach((l) => l.sort(byId));

const flat = (l: Line) => JSON.stringify(l.flat());
writeFileSync(OUT, `{
  "attribution": "© OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright",
  "extract": ${JSON.stringify(extractDate)},
  "note": "OpenStreetMap's streets, paved areas and trees within ${MARGIN} m of the areas drawn in detail (src/detail/areas.ts), by tools/fetch-streets.ts. Points are world x, z (src/geo.ts), flattened.",
  "streets": [
${streets.map((s) => `    { "osm": "${s.osm}", "tags": ${JSON.stringify(s.tags)}, "line": ${flat(s.line)} }`).join(',\n')}
  ],
  "areas": [
${areas.map((a) => `    { "osm": "${a.osm}", "tags": ${JSON.stringify(a.tags)}, "rings": [${a.rings.map(flat).join(', ')}] }`).join(',\n')}
  ],
  "treeRows": [
${rows.map((r) => `    { "osm": "${r.osm}", "tags": ${JSON.stringify(r.tags)}, "line": ${flat(r.line)} }`).join(',\n')}
  ],
  "trees": [
${trees.map((t) => `    { "osm": "${t.osm}", "tags": ${JSON.stringify(t.tags)}, "x": ${t.x}, "z": ${t.z} }`).join(',\n')}
  ]
}
`);
console.log(`${OUT}: ${streets.length} streets, ${areas.length} areas, ${rows.length} tree rows, ${trees.length} trees (extract of ${extractDate})`);
