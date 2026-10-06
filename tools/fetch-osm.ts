// Downloads railway data from OpenStreetMap (Overpass API) into data/osm/.
//
//   node tools/fetch-osm.ts t-centralen   tracks and platforms of every kind around the station
//   node tools/fetch-osm.ts odenplan      ... and around Odenplan and Fridhemsplan, the other
//   node tools/fetch-osm.ts fridhemsplan  stations drawn from a model
//   node tools/fetch-osm.ts network       the whole metro: tracks with their nodes, switches,
//                                         platforms, stations, entrances and route relations
//
// Around a station, `--pbf <file>` reads a regional extract instead (as tools/fetch-city.ts does,
// e.g. openstreetmap.fr's stockholm.osm.pbf), for when Overpass can't be reached.
//
// The data is © OpenStreetMap contributors, under the ODbL.
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { readPbf } from './lib/osm-pbf.ts';

type BBox = [number, number, number, number]; // south, west, north, east

// the tracks and platforms of every kind round a station: what its model is fitted onto
const RAILWAY = /^(subway|rail|light_rail|tram|construction|disused|platform)$/;
const stationQuery = (b: string) => `[out:json][timeout:120];
(
  way["railway"~"${RAILWAY.source}"](${b});
  way["public_transport"="platform"](${b});
);
out tags geom;`;
const AREAS: Record<string, { bbox: BBox; query: (bbox: string) => string; station?: boolean }> = {
  // the extent of each station model, with a margin; used to fit the model onto the map
  't-centralen': { bbox: [59.3245, 18.0455, 59.3385, 18.0740], query: stationQuery, station: true },
  odenplan: { bbox: [59.3385, 18.0380, 59.3470, 18.0610], query: stationQuery, station: true },
  fridhemsplan: { bbox: [59.3270, 18.0200, 59.3375, 18.0390], query: stationQuery, station: true },
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
// The station's ways from an extract, as Overpass would give them: with their tags and points.
function fromPbf(path: string, [south, west, north, east]: BBox) {
  const keep = (t: Record<string, string>) => RAILWAY.test(t.railway ?? '') || t.public_transport === 'platform';
  const ways: { id: number; refs: number[]; tags: Record<string, string> }[] = [];
  readPbf(path, { way: (w) => { if (keep(w.tags)) ways.push(w); } });
  const needed = new Set(ways.flatMap((w) => w.refs));
  const nodes = new Map<number, { lat: number; lon: number }>();
  readPbf(path, { node: (n) => { if (needed.has(n.id)) nodes.set(n.id, { lat: n.lat, lon: n.lon }); } });
  const inBox = (p: { lat: number; lon: number }) => p.lat >= south && p.lat <= north && p.lon >= west && p.lon <= east;
  const elements = [];
  for (const w of ways) {
    const geometry = w.refs.map((r) => nodes.get(r)).filter((p) => !!p) as { lat: number; lon: number }[];
    if (!geometry.some(inBox)) continue;
    elements.push({ type: 'way', id: w.id, tags: w.tags, geometry: geometry.map((p) => ({ lat: +p.lat.toFixed(7), lon: +p.lon.toFixed(7) })) });
  }
  elements.sort((a, b) => a.id - b.id);
  return { osm3s: { timestamp_osm_base: statSync(path).mtime.toISOString().slice(0, 19) + 'Z' }, elements };
}

const pbf = process.argv.indexOf('--pbf');
if (pbf >= 0 && !area.station) throw new Error('--pbf reads the tracks round a station only');
const json = pbf >= 0 ? fromPbf(process.argv[pbf + 1], area.bbox) : JSON.parse(await fetchWithRetry(area.query(area.bbox.join(','))));
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
