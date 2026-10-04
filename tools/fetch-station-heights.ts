// Downloads the metro stations' heights above sea level (Wikidata P2044) into
// data/station-heights.json, matched to the stations by the wikidata=* tag in OpenStreetMap.
//
//   node tools/fetch-station-heights.ts
//
// The heights come from Swedish Wikipedia's station articles, which cite them to the book
// "Stockholm under" (Alfredsson, Berndt, Harlén, 2007). They give the station's level, which is
// taken to be the platform; the height system isn't stated. Wikidata is CC0.
import { readFileSync, writeFileSync } from 'node:fs';

const osm = JSON.parse(readFileSync('data/osm/network.json', 'utf8'));
const byQid = new Map<string, string>();
for (const e of osm.elements) {
  const t = e.tags ?? {};
  if (t.railway === 'station' && t.station === 'subway' && t.wikidata && t.name) byQid.set(t.wikidata, t.name);
}

const query = `SELECT ?s ?elev WHERE {
  VALUES ?s { ${[...byQid.keys()].map((q) => `wd:${q}`).join(' ')} }
  ?s p:P2044/psv:P2044 ?v . ?v wikibase:quantityAmount ?elev .
}`;
let json: { results: { bindings: { s: { value: string }; elev: { value: string } }[] } } | null = null;
for (let i = 1; i <= 8 && !json; i++) {
  try {
    const res = await fetch('https://query.wikidata.org/sparql?' + new URLSearchParams({ query }), {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'tbana (https://github.com/elmaxe/tbana)' },
    });
    if (res.ok) json = await res.json();
    else console.warn(`try ${i}: HTTP ${res.status}`);
  } catch (err) {
    console.warn(`try ${i}: ${(err as Error).message}`);
  }
  if (!json) await new Promise((r) => setTimeout(r, 5000 * i));
}
if (!json) throw new Error('Wikidata did not answer');

const heights: Record<string, { wikidata: string; height: number }> = {};
for (const b of json.results.bindings) {
  const qid = b.s.value.split('/').pop()!;
  heights[byQid.get(qid)!] = { wikidata: qid, height: Number(b.elev.value) };
}
const sorted = Object.fromEntries(Object.entries(heights).sort(([a], [b]) => a.localeCompare(b, 'sv')));
writeFileSync('data/station-heights.json', JSON.stringify({
  note: 'Height above sea level of each metro station, in metres, from Wikidata (P2044, CC0), which takes it from Swedish Wikipedia and the book "Stockholm under" (2007). Taken to be the platform level; the height system is not stated.',
  stations: sorted,
}, null, 2) + '\n');
console.log(`data/station-heights.json: ${Object.keys(sorted).length} of ${byQid.size} stations have a height`);
