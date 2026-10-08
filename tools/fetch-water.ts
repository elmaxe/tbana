// Takes the city's lakes, canals and bays from OpenStreetMap, within reach of the line
// (tools/lib/city-area.ts).
//
//   node tools/fetch-water.ts [extract.osm.pbf]   -> data/osm/water.json
//
// Reads the same regional extract as tools/fetch-city.ts (downloaded to the system's temporary
// directory unless a file is given). tools/build-city.ts finds the water mostly in the elevation
// model, which has it flattened; these outlines fill it in where the model has it hidden, under
// bridges and decks, such as Riddarholmskanalen under Centralbron.
//
// Every closed way and multipolygon relation tagged natural=water or waterway=riverbank that reaches
// into the city's tiles is kept. Where a relation's rings don't close within the extract (Mälaren's,
// which reaches far beyond it), its ways in the city are kept as lines, its shores, and so is the
// coastline (natural=coastline), which is how OpenStreetMap draws the sea.
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
const OUT = 'data/osm/water.json';
const KEEP = ['natural', 'water', 'waterway', 'name'];

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
const isWater = (t: Record<string, string>) => t.natural === 'water' || t.waterway === 'riverbank';

// 1. the multipolygon relations that are water, and their member ways
interface Rel { id: number; tags: Record<string, string>; outer: number[]; inner: number[] }
const rels: Rel[] = [];
const memberWays = new Set<number>();
readPbf(path, {
  relation: (r) => {
    if (r.tags.type !== 'multipolygon' || !isWater(r.tags)) return;
    const rel: Rel = { id: r.id, tags: r.tags, outer: [], inner: [] };
    for (const m of r.members) {
      if (m.type !== 'way') continue;
      (m.role === 'inner' ? rel.inner : rel.outer).push(m.ref);
      memberWays.add(m.ref);
    }
    rels.push(rel);
  },
});

// 2. the ways: closed ones that are water, and the relations' members
const ways = new Map<number, { refs: number[]; tags: Record<string, string> }>();
const needed = new Set<number>();
readPbf(path, {
  way: (w) => {
    const closed = w.refs.length >= 4 && w.refs[0] === w.refs[w.refs.length - 1];
    if (!(closed && isWater(w.tags)) && !memberWays.has(w.id) && w.tags.natural !== 'coastline') return;
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

// joins a relation's member ways into closed rings, end to end; null if any won't close
function joinRings(ids: number[]): Ring[] | null {
  const open = ids.map((id) => ways.get(id)?.refs);
  if (open.some((r) => !r)) return null;
  const rest = (open as number[][]).filter((r) => r.length >= 2).map((r) => [...r]);
  const rings: Ring[] = [];
  while (rest.length) {
    let cur = rest.shift()!;
    for (let guard = 0; cur[0] !== cur[cur.length - 1] && guard < 10000; guard++) {
      const k = rest.findIndex((w) => w[0] === cur[cur.length - 1] || w[w.length - 1] === cur[cur.length - 1]);
      if (k < 0) break;
      const w = rest.splice(k, 1)[0];
      cur = cur.concat((w[0] === cur[cur.length - 1] ? w : [...w].reverse()).slice(1));
    }
    if (cur.length < 4 || cur[0] !== cur[cur.length - 1]) return null;
    const r = ringOf(cur);
    if (!r) return null;
    rings.push(r);
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
const shores: { osm: string; line: Ring }[] = [];
let incomplete = 0;
// a way as shore lines: in runs of the points the extract has, that reach into the city
function shore(osm: string, refs: number[] | undefined) {
  let line: Ring = [];
  for (const r of [...(refs ?? []), -1]) {
    const p = nodes.get(r);
    if (p) { line.push(p); continue; }
    if (line.length >= 2 && line.some(([x, z]) => inArea(x, z))) shores.push({ osm, line });
    line = [];
  }
}
for (const [id, w] of ways) if (w.tags.natural === 'coastline') shore(`w${id}`, w.refs);
for (const [id, w] of ways) {
  if (!(w.refs[0] === w.refs[w.refs.length - 1] && isWater(w.tags))) continue;
  const r = ringOf(w.refs);
  if (r && r.length >= 3 && touches([r])) out.push({ osm: `w${id}`, tags: keep(w.tags), rings: [r] });
}
for (const rel of rels) {
  const outers = joinRings(rel.outer), inners = joinRings(rel.inner);
  if (!outers || !inners) {
    incomplete++;
    for (const id of [...rel.outer, ...rel.inner]) shore(`r${rel.id}/w${id}`, ways.get(id)?.refs);
    continue;
  }
  for (const o of outers) {
    if (o.length < 3 || !touches([o])) continue;
    const holes = inners.filter((h) => inside(h[0], o));
    out.push({ osm: `r${rel.id}`, tags: keep(rel.tags), rings: [o, ...holes] });
  }
}
out.sort((a, b) => a.osm.localeCompare(b.osm, 'en', { numeric: true }));
shores.sort((a, b) => a.osm.localeCompare(b.osm, 'en', { numeric: true }));

mkdirSync('data/osm', { recursive: true });
const flat = (r: Ring) => r.flat();
writeFileSync(OUT, `{
  "attribution": "© OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright",
  "source": ${JSON.stringify(EXTRACT)},
  "extract": ${JSON.stringify(extractDate)},
  "note": "Lakes, canals and bays (natural=water, waterway=riverbank) reaching into the city's tiles (tools/lib/city-area.ts). rings: the outline, then any islands, each as world x, z pairs (src/geo.ts) in one flat list, not closed. shores: the coastline, and the ways of the relations whose rings don't close within the extract, in the city, as lines in the same way.",
  "water": [
${out.map((b) => '    ' + JSON.stringify({ osm: b.osm, tags: b.tags, rings: b.rings.map(flat) })).join(',\n')}
  ],
  "shores": [
${shores.map((s) => '    ' + JSON.stringify({ osm: s.osm, line: flat(s.line) })).join(',\n')}
  ]
}
`);
console.log(`${OUT}: ${out.length} areas of water, and ${shores.length} shores (the coastline, and of ${incomplete} relations not closed within the extract)`);
