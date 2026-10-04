// Downloads railway tracks and platforms from OpenStreetMap (Overpass API) into data/osm/.
//
//   node tools/fetch-osm.ts t-centralen
//
// The data is © OpenStreetMap contributors, under the ODbL.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// [south, west, north, east]
const AREAS: Record<string, [number, number, number, number]> = {
  // the extent of the T-Centralen model, with a margin
  't-centralen': [59.3245, 18.0455, 59.3385, 18.0740],
};

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

function query([s, w, n, e]: [number, number, number, number]) {
  const bbox = `${s},${w},${n},${e}`;
  return `[out:json][timeout:120];
(
  way["railway"~"^(subway|rail|light_rail|tram|construction|disused|platform)$"](${bbox});
  way["public_transport"="platform"](${bbox});
);
out tags geom;`;
}

async function fetchWithRetry(body: string, tries = 20): Promise<string> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'User-Agent': 'tbana (https://github.com/elmaxe/tbana)', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: body }),
      });
      const text = await res.text();
      if (res.ok && text.startsWith('{')) return text;
      console.warn(`try ${i}: HTTP ${res.status}`);
    } catch (err) {
      console.warn(`try ${i}: ${(err as Error).message}`);
    }
    if (i >= tries) throw new Error('Overpass did not answer');
    await new Promise((r) => setTimeout(r, 5000 * Math.min(i, 6)));
  }
}

const name = process.argv[2];
const area = AREAS[name];
if (!area) {
  console.error(`usage: node tools/fetch-osm.ts <${Object.keys(AREAS).join('|')}>`);
  process.exit(1);
}
const json = JSON.parse(await fetchWithRetry(query(area)));
const out = `data/osm/${name}.json`;
mkdirSync(dirname(out), { recursive: true });
// one element per line keeps diffs readable when the data is refreshed
const lines = json.elements.map((el: unknown) => '  ' + JSON.stringify(el));
writeFileSync(out, `{
  "attribution": "© OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright",
  "timestamp": ${JSON.stringify(json.osm3s?.timestamp_osm_base ?? null)},
  "bbox": ${JSON.stringify(area)},
  "elements": [
${lines.join(',\n')}
  ]
}
`);
console.log(`${out}: ${json.elements.length} ways`);
