// Downloads railway data from OpenStreetMap (Overpass API) into data/osm/.
//
//   node tools/fetch-osm.ts t-centralen   tracks and platforms of every kind around the station
//   node tools/fetch-osm.ts network       the whole metro: tracks with their nodes, switches,
//                                         platforms, stations, entrances and route relations
//
// The data is © OpenStreetMap contributors, under the ODbL.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

type BBox = [number, number, number, number]; // south, west, north, east

const AREAS: Record<string, { bbox: BBox; query: (bbox: string) => string }> = {
  // the extent of the T-Centralen model, with a margin; used to fit the model onto the map
  't-centralen': {
    bbox: [59.3245, 18.0455, 59.3385, 18.0740],
    query: (b) => `[out:json][timeout:120];
(
  way["railway"~"^(subway|rail|light_rail|tram|construction|disused|platform)$"](${b});
  way["public_transport"="platform"](${b});
);
out tags geom;`,
  },
  // every metro line, from Norsborg and Hjulsta to Mörby, Ropsten and Skarpnäck
  network: {
    bbox: [59.22, 17.79, 59.43, 18.15],
    query: (b) => `[out:json][timeout:300];
(
  way["railway"="subway"](${b});
  way["railway"="construction"]["construction"="subway"](${b});
)->.tracks;
(
  .tracks;
  node(w.tracks)[~"^(railway|public_transport)$"~"."];
  way["railway"="platform"](${b});
  way["public_transport"="platform"]["subway"="yes"](${b});
  nwr["railway"="station"]["station"="subway"](${b});
  node["railway"="subway_entrance"](${b});
  relation["railway"="platform"](${b});
);
out body geom;
relation["route"="subway"](${b});
out body;`,
  },
};

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

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
const json = JSON.parse(await fetchWithRetry(area.query(area.bbox.join(','))));
const out = `data/osm/${name}.json`;
mkdirSync(dirname(out), { recursive: true });
// one element per line keeps diffs readable when the data is refreshed
const lines = json.elements.map((el: unknown) => '  ' + JSON.stringify(el));
writeFileSync(out, `{
  "attribution": "© OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright",
  "timestamp": ${JSON.stringify(json.osm3s?.timestamp_osm_base ?? null)},
  "bbox": ${JSON.stringify(area.bbox)},
  "elements": [
${lines.join(',\n')}
  ]
}
`);
console.log(`${out}: ${json.elements.length} elements`);
