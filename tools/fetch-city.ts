// Takes the city's buildings from OpenStreetMap, within reach of the line (tools/lib/city-area.ts).
//
//   node tools/fetch-city.ts [extract.osm.pbf]   -> data/osm/buildings.json
//
// Reads a regional extract in OSM's PBF format: Stockholm county from openstreetmap.fr, downloaded
// to the system's temporary directory unless a file is given. (An extract rather than Overpass:
// the area holds tens of thousands of buildings, more than Overpass likes to return at once.)
// Node's fetch goes through a proxy only with NODE_USE_ENV_PROXY=1.
//
// Every building and building:part in the city's tiles is kept: closed ways, and multipolygon
// relations with their rings joined up, courtyards included. Only the tags the city uses or may
// use later (heights, levels, roof shape and colours) are kept, and the points are in world x, z
// (src/geo.ts) to a decimetre. Buildings underground are left out.
//
// The data is © OpenStreetMap contributors, under the ODbL.
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { lonLatToWorld } from '../src/geo.ts';
import { CITY_TILE } from '../src/city-tile.ts';
import { readPbf } from './lib/osm-pbf.ts';
import { cityArea } from './lib/city-area.ts';

const EXTRACT = 'https://download.openstreetmap.fr/extracts/europe/sweden/stockholm.osm.pbf';
const OUT = 'data/osm/buildings.json';
const KEEP = ['building', 'building:part', 'height', 'min_height', 'building:levels', 'building:min_level',
  'roof:shape', 'roof:height', 'roof:levels', 'roof:angle', 'roof:direction', 'roof:orientation', 'roof:colour',
  'roof:material', 'building:colour', 'building:material', 'name'];

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

const area = cityArea();
const inArea = (x: number, z: number) => area.has(Math.floor(x / CITY_TILE), Math.floor(z / CITY_TILE));
const isBuilding = (t: Record<string, string>) =>
  ((!!t.building && t.building !== 'no') || (!!t['building:part'] && t['building:part'] !== 'no')) && t.location !== 'underground';

// 1. the multipolygon relations that are buildings, and their member ways
interface Rel { id: number; tags: Record<string, string>; outer: number[]; inner: number[] }
const rels: Rel[] = [];
const memberWays = new Set<number>();
readPbf(path, {
  relation: (r) => {
    if (r.tags.type !== 'multipolygon' || !isBuilding(r.tags)) return;
    const rel: Rel = { id: r.id, tags: r.tags, outer: [], inner: [] };
    for (const m of r.members) {
      if (m.type !== 'way') continue;
      (m.role === 'inner' ? rel.inner : rel.outer).push(m.ref);
      memberWays.add(m.ref);
    }
    rels.push(rel);
  },
});

// 2. the ways: closed ones that are buildings, and the relations' members
const ways = new Map<number, { refs: number[]; tags: Record<string, string> }>();
const needed = new Set<number>();
readPbf(path, {
  way: (w) => {
    const closed = w.refs.length >= 4 && w.refs[0] === w.refs[w.refs.length - 1];
    if (!(closed && isBuilding(w.tags)) && !memberWays.has(w.id)) return;
    ways.set(w.id, { refs: w.refs, tags: w.tags });
    for (const r of w.refs) needed.add(r);
  },
});

// 3. the points of those ways
const nodes = new Map<number, [number, number]>();
readPbf(path, {
  node: (n) => {
    if (!needed.has(n.id)) return;
    const { x, z } = lonLatToWorld(n.lon, n.lat);
    nodes.set(n.id, [Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
  },
});
console.log(`${ways.size} ways, ${rels.length} relations, ${nodes.size} points`);

type Ring = [number, number][];
const ringOf = (refs: number[]): Ring | null => {
  const pts = refs.map((r) => nodes.get(r));
  if (pts.some((p) => !p)) return null;
  return (pts as [number, number][]).slice(0, -1);
};

// joins a relation's member ways into closed rings, end to end
function joinRings(ids: number[]): Ring[] {
  const open = ids.map((id) => ways.get(id)?.refs).filter((r): r is number[] => !!r && r.length >= 2).map((r) => [...r]);
  const rings: Ring[] = [];
  while (open.length) {
    let cur = open.shift()!;
    for (let guard = 0; cur[0] !== cur[cur.length - 1] && guard < 1000; guard++) {
      const k = open.findIndex((w) => w[0] === cur[cur.length - 1] || w[w.length - 1] === cur[cur.length - 1]);
      if (k < 0) break;
      const w = open.splice(k, 1)[0];
      cur = cur.concat((w[0] === cur[cur.length - 1] ? w : [...w].reverse()).slice(1));
    }
    if (cur.length >= 4 && cur[0] === cur[cur.length - 1]) {
      const r = ringOf(cur);
      if (r) rings.push(r);
    }
  }
  return rings;
}

function inside(p: [number, number], ring: Ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

const keep = (tags: Record<string, string>) => Object.fromEntries(KEEP.filter((k) => tags[k] !== undefined).map((k) => [k, tags[k]]));
const touches = (rings: Ring[]) => rings[0].some(([x, z]) => inArea(x, z));
const out: { osm: string; tags: Record<string, string>; rings: Ring[] }[] = [];
for (const [id, w] of ways) {
  if (!(w.refs[0] === w.refs[w.refs.length - 1] && isBuilding(w.tags))) continue;
  const r = ringOf(w.refs);
  if (r && r.length >= 3 && touches([r])) out.push({ osm: `w${id}`, tags: keep(w.tags), rings: [r] });
}
for (const rel of rels) {
  const outers = joinRings(rel.outer), inners = joinRings(rel.inner);
  for (const o of outers) {
    if (o.length < 3 || !touches([o])) continue;
    const holes = inners.filter((h) => inside(h[0], o));
    out.push({ osm: `r${rel.id}`, tags: keep(rel.tags), rings: [o, ...holes] });
  }
}
out.sort((a, b) => a.osm.localeCompare(b.osm, 'en', { numeric: true }));

mkdirSync('data/osm', { recursive: true });
const flat = (r: Ring) => r.flat();
writeFileSync(OUT, `{
  "attribution": "© OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright",
  "source": ${JSON.stringify(EXTRACT)},
  "extract": ${JSON.stringify(extractDate)},
  "note": "Buildings and building parts within the city's tiles (tools/lib/city-area.ts). rings: the outline, then any courtyards, each as world x, z pairs (src/geo.ts) in one flat list, not closed.",
  "buildings": [
${out.map((b) => '    ' + JSON.stringify({ osm: b.osm, tags: b.tags, rings: b.rings.map(flat) })).join(',\n')}
  ]
}
`);
console.log(`${OUT}: ${out.length} buildings in ${area.tiles.length} tiles`);
