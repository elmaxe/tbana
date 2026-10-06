// Reading Lantmäteriet's elevation model (Markhöjdmodell, RH 2000, CC BY 4.0) and orthophotos
// (Ortofoto, CC BY 4.0) in the tools.
//
// Both are free but their download needs a Geotorget account, with each product ordered (also free), sent as HTTP Basic auth from
// LM_USER and LM_PASSWORD. Without them the requests go out unauthenticated, which works only if
// the environment adds the login itself. Behind a proxy that adds it, Node's fetch needs
// NODE_USE_ENV_PROXY=1 to go through the proxy at all.
//
// The files are Cloud Optimized GeoTIFFs on SWEREF 99 TM, found through Lantmäteriet's STAC
// catalogues for height data and for images; only the blocks needed are read.
import { unproject, GRID_TM } from '../../src/geo.ts';

export const STAC = 'https://api.lantmateriet.se/stac-hojd/v1/search';
export const STAC_IMAGES = 'https://api.lantmateriet.se/stac-bild/v1/search';
export const ATTRIBUTION = 'Markhöjdmodell © Lantmäteriet, CC BY 4.0';
export const ORTHO_ATTRIBUTION = 'Ortofoto © Lantmäteriet, CC BY 4.0';

// The download server turns away some requests (403) when too many arrive at once, so fetches go
// out a few at a time and are retried after a pause.
let throttled = false;
export function throttleFetch() {
  if (throttled) return;
  throttled = true;
  const fetch0 = globalThis.fetch;
  let active = 0;
  const queue: (() => void)[] = [];
  globalThis.fetch = async (input, init) => {
    if (active >= 3) await new Promise<void>((go) => queue.push(go));
    active++;
    try {
      for (let attempt = 0; ; attempt++) {
        const res = await fetch0(input, init);
        if (res.ok || attempt === 5 || ![403, 429, 503].includes(res.status)) return res;
        await res.body?.cancel();
        await new Promise((go) => setTimeout(go, 500 * 2 ** attempt));
      }
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

export function authHeaders(): Record<string, string> {
  const user = process.env.LM_USER, password = process.env.LM_PASSWORD;
  if (!user || !password) {
    console.warn('LM_USER / LM_PASSWORD not set: trying without a login');
    return {};
  }
  return { Authorization: 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64') };
}

export interface StacFile {
  url: string;
  bbox: number[];      // [min e, min n, max e, max n] on SWEREF 99 TM
  collection: string;
  id: string;
  datetime: string;
  properties: Record<string, unknown>;
}

// The files covering a box on SWEREF 99 TM ([min e, min n, max e, max n]) from the given
// collections: of the elevation model, the 2.5 km squares ('mhm-') or the 10 km ones with overviews
// ('dtm-cog'); from STAC_IMAGES, the orthophotos of each year ('orto-…').
export async function findFiles(box: [number, number, number, number], collection: (id: string) => boolean, stac = STAC) {
  const corners = [unproject(box[0], box[1], GRID_TM), unproject(box[2], box[3], GRID_TM)];
  const files: StacFile[] = [];
  let body: object | undefined = {
    bbox: [corners[0].lon - 0.01, corners[0].lat - 0.01, corners[1].lon + 0.01, corners[1].lat + 0.01],
    limit: 200,
  };
  while (body) {
    const res = await fetch(stac, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${stac}: ${res.status} ${res.statusText}`);
    const page = await res.json() as {
      features: {
        id: string; collection: string; properties: Record<string, unknown> & { datetime: string };
        assets: { data: { href: string; 'proj:bbox': number[] } };
      }[];
      links: { rel: string; body?: object }[];
    };
    for (const f of page.features) {
      if (!collection(f.collection)) continue;
      files.push({
        url: f.assets.data.href, bbox: f.assets.data['proj:bbox'], collection: f.collection, id: f.id,
        datetime: f.properties.datetime, properties: f.properties,
      });
    }
    body = page.links.find((l) => l.rel === 'next')?.body;
  }
  return files;
}
