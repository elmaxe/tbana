// Mapillary's street-level photos (https://www.mapillary.com/developer/api-documentation), for
// tools/fetch-mapillary.ts: where the photos are, what each camera was and how it stood, and where a
// point of the world falls in a photo.
//
// The client token (MLY|…, from https://www.mapillary.com/dashboard/developers) is read from the
// environment variable MAPILLARY_TOKEN.
//
// - Where the photos are comes from Mapillary's coverage tiles (vector tiles, layer "image", which
//   at zoom 14 hold every photo). The API's search by box isn't complete: a box with many photos
//   returns some of them, and a smaller box inside it can return more.
// - How each camera stood comes from the API by photo: its position and rotation after
//   Mapillary's own structure-from-motion (computed_geometry, computed_rotation), and its lens.
// - The rotation is OpenSfM's: an axis-angle vector turning a direction in east, north, up into the
//   camera's x right, y down, z forward. The lens is OpenSfM's too: focal length (as a fraction of
//   the photo's longer side) and two radial distortion terms for a perspective or fisheye camera,
//   none for a spherical (equirectangular) one.
import { Reader } from './osm-pbf.ts';

const GRAPH = 'https://graph.mapillary.com';
const TILES = 'https://tiles.mapillary.com/maps/vtp/mly1_public/2';
export const COVERAGE_ZOOM = 14;
export const MAPILLARY_ATTRIBUTION = 'Street-level photos © Mapillary and its contributors, CC BY-SA 4.0';

export function token() {
  const t = process.env.MAPILLARY_TOKEN;
  if (!t) throw new Error('set MAPILLARY_TOKEN to a Mapillary client token (MLY|…, from https://www.mapillary.com/dashboard/developers)');
  return t;
}

// ------------------------------------------------------------------ fetching
// At most `limit` requests at once, each tried again (after a pause) if it fails on the way or
// with a status that passes.
export function limiter(limit: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async function get(url: string): Promise<Response> {
    if (active >= limit) await new Promise<void>((go) => queue.push(go));
    active++;
    try {
      for (let attempt = 0; ; attempt++) {
        let res: Response;
        try {
          res = await fetch(url);
        } catch (err) {
          if (attempt === 5) throw err;
          await new Promise((go) => setTimeout(go, 500 * 2 ** attempt));
          continue;
        }
        if (res.ok || attempt === 5 || ![429, 500, 502, 503, 504].includes(res.status)) return res;
        await res.body?.cancel();
        await new Promise((go) => setTimeout(go, 1000 * 2 ** attempt));
      }
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

// ------------------------------------------------------------------ coverage
// A photo as the coverage tiles have it.
export interface Spot {
  id: string;
  lon: number;
  lat: number;
  captured: number; // ms since 1970
  compass: number;  // degrees from north, clockwise
  pano: boolean;
  sequence: string;
}

// The slippy-map tiles at `zoom` over a box of longitude and latitude.
export function tilesOver(lon0: number, lat0: number, lon1: number, lat1: number, zoom = COVERAGE_ZOOM) {
  const n = 2 ** zoom;
  const tx = (lon: number) => Math.floor(((lon + 180) / 360) * n);
  const ty = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  };
  const out: [number, number, number][] = [];
  for (let x = tx(lon0); x <= tx(lon1); x++) for (let y = ty(lat1); y <= ty(lat0); y++) out.push([zoom, x, y]);
  return out;
}

export function coverageUrl([z, x, y]: [number, number, number]) {
  return `${TILES}/${z}/${x}/${y}?access_token=${encodeURIComponent(token())}`;
}

// The photos in a coverage tile (Mapbox Vector Tile, layer "image").
export function readCoverage(buf: Uint8Array, [z, x, y]: [number, number, number]): Spot[] {
  const out: Spot[] = [];
  const tile = new Reader(buf);
  tile.fields((f, w) => {
    if (f !== 3 || w !== 2) return false;
    const layer = new Reader(tile.bytes());
    let name = '', extent = 4096;
    const keys: string[] = [], values: (string | number | boolean)[] = [], features: Uint8Array[] = [];
    layer.fields((lf, lw) => {
      if (lf === 1 && lw === 2) { name = text.decode(layer.bytes()); return true; }
      if (lf === 2 && lw === 2) { features.push(layer.bytes()); return true; }
      if (lf === 3 && lw === 2) { keys.push(text.decode(layer.bytes())); return true; }
      if (lf === 4 && lw === 2) { values.push(readValue(layer.bytes())); return true; }
      if (lf === 5 && lw === 0) { extent = layer.varint(); return true; }
      return false;
    });
    if (name !== 'image') return true;
    for (const fb of features) {
      const fr = new Reader(fb);
      let tags: number[] = [], geom: number[] = [];
      fr.fields((ff, fw) => {
        if (ff === 2 && fw === 2) { tags = fr.packed(false); return true; }
        if (ff === 4 && fw === 2) { geom = fr.packed(false); return true; }
        return false;
      });
      // a point: MoveTo(1), then x, y zigzagged
      if (geom.length < 3 || (geom[0] & 7) !== 1) continue;
      const zz = (v: number) => (v % 2 === 0 ? v / 2 : -(v + 1) / 2);
      const gx = zz(geom[1]), gy = zz(geom[2]);
      const p: Record<string, string | number | boolean> = {};
      for (let k = 0; k + 1 < tags.length; k += 2) p[keys[tags[k]]] = values[tags[k + 1]];
      if (p.id === undefined) continue;
      const n = 2 ** z;
      const lon = ((x + gx / extent) / n) * 360 - 180;
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + gy / extent)) / n))) * 180) / Math.PI;
      out.push({
        id: String(p.id), lon, lat, captured: Number(p.captured_at ?? 0), compass: Number(p.compass_angle ?? 0),
        pano: p.is_pano === true || p.is_pano === 1, sequence: String(p.sequence_id ?? ''),
      });
    }
    return true;
  });
  return out;
}

const text = new TextDecoder();
function readValue(b: Uint8Array): string | number | boolean {
  const r = new Reader(b);
  let v: string | number | boolean = '';
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  r.fields((f, w) => {
    if (f === 1 && w === 2) v = text.decode(r.bytes());
    else if (f === 2 && w === 5) { v = view.getFloat32(r.pos, true); r.pos += 4; }
    else if (f === 3 && w === 1) { v = view.getFloat64(r.pos, true); r.pos += 8; }
    else if ((f === 4 || f === 5) && w === 0) v = r.varint();
    else if (f === 6 && w === 0) v = r.svarint();
    else if (f === 7 && w === 0) v = r.varint() !== 0;
    else return false;
    return true;
  });
  return v;
}

// ------------------------------------------------------------------ cameras
export const CAMERA_FIELDS = 'id,computed_geometry,computed_rotation,camera_type,camera_parameters,width,height,thumb_256_url,thumb_1024_url';

export interface Camera {
  id: string;
  lon: number;
  lat: number;
  rotation: [number, number, number];
  type: 'perspective' | 'fisheye' | 'spherical';
  params: number[]; // focal, k1, k2 (none for spherical)
  width: number;
  height: number;
  thumb: string;     // the thumbnail to measure in: 256 px wide, or 1024 for a spherical photo
}

// Each photo's camera, `ids` at most 50 at a time (fewer come back for photos without a
// reconstruction, which are left out).
export async function cameras(get: (url: string) => Promise<Response>, ids: string[]): Promise<Camera[]> {
  const res = await get(`${GRAPH}/images?image_ids=${ids.join(',')}&fields=${CAMERA_FIELDS}&access_token=${encodeURIComponent(token())}`);
  if (!res.ok) throw new Error(`Mapillary: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const body = await res.json() as { data: Record<string, unknown>[] };
  const out: Camera[] = [];
  for (const d of body.data) {
    const geom = d.computed_geometry as { coordinates: [number, number] } | undefined;
    const rot = d.computed_rotation as [number, number, number] | undefined;
    const type = d.camera_type as Camera['type'];
    const params = (d.camera_parameters as number[] | undefined) ?? [];
    if (!geom || !rot || !['perspective', 'fisheye', 'spherical'].includes(type)) continue;
    if (type !== 'spherical' && !(params[0] > 0)) continue;
    const thumb = (type === 'spherical' ? d.thumb_1024_url : d.thumb_256_url) as string | undefined;
    if (!thumb) continue;
    out.push({
      id: String(d.id), lon: geom.coordinates[0], lat: geom.coordinates[1], rotation: rot, type, params,
      width: Number(d.width), height: Number(d.height), thumb,
    });
  }
  return out;
}

// The rotation matrix (rows) of an axis-angle vector.
export function rotationMatrix([rx, ry, rz]: [number, number, number]) {
  const t = Math.hypot(rx, ry, rz);
  if (t < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const x = rx / t, y = ry / t, z = rz / t, c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  return [
    c + x * x * C, x * y * C - z * s, x * z * C + y * s,
    y * x * C + z * s, c + y * y * C, y * z * C - x * s,
    z * x * C - y * s, z * y * C + x * s, c + z * z * C,
  ];
}

// Where a direction (east, north, up) from the camera falls in its photo `w` × `h` pixels (the
// photo or a thumbnail of it), or null if it's behind the camera or outside the photo.
export function project(cam: Camera, R: number[], e: number, n: number, u: number, w: number, h: number): [number, number] | null {
  const X = R[0] * e + R[1] * n + R[2] * u;
  const Y = R[3] * e + R[4] * n + R[5] * u;
  const Z = R[6] * e + R[7] * n + R[8] * u;
  let px: number, py: number;
  if (cam.type === 'spherical') {
    const lon = Math.atan2(X, Z), lat = Math.atan2(-Y, Math.hypot(X, Z));
    px = w * (0.5 + lon / (2 * Math.PI));
    py = h * (0.5 - lat / Math.PI);
  } else {
    if (Z <= 0) return null;
    const [f, k1 = 0, k2 = 0] = cam.params;
    const x = X / Z, y = Y / Z, size = Math.max(w, h);
    let s: number;
    if (cam.type === 'perspective') {
      const r2 = x * x + y * y;
      // (the distortion's polynomial turns back on itself far from the middle)
      if (r2 > 2) return null;
      s = f * (1 + k1 * r2 + k2 * r2 * r2);
    } else {
      const r = Math.hypot(x, y), th = Math.atan(r);
      s = r < 1e-9 ? f : (f * (1 + k1 * th * th + k2 * th ** 4) * th) / r;
    }
    px = w / 2 + s * x * size;
    py = h / 2 + s * y * size;
  }
  if (!(px >= 0 && px < w && py >= 0 && py < h)) return null;
  return [px, py];
}

// ------------------------------------------------------------------ segmentation
// Mapillary segments many photos into what they show (their "detections": building, sky,
// vegetation, road, car, person, …), each as polygons in a vector tile over the photo (x right,
// y down, 0 to its extent). Others have only a few objects detected (signs, lights), which says
// nothing of the rest. The buildings in a photo, as polygons (each a list of rings, x and y from 0
// to 1 across the photo), or null if it isn't segmented.
export const BUILDING = 'construction--structure--building';
const SEGMENTED = new Set([BUILDING, 'nature--sky', 'construction--flat--road', 'construction--flat--sidewalk', 'nature--vegetation']);
export async function buildingsIn(get: (url: string) => Promise<Response>, id: string): Promise<[number, number][][][] | null> {
  const res = await get(`${GRAPH}/${id}/detections?fields=value,geometry&access_token=${encodeURIComponent(token())}`);
  if (!res.ok) { await res.body?.cancel(); return null; }
  const body = await res.json() as { data?: { value: string; geometry: string }[] };
  if (!body.data?.some((d) => SEGMENTED.has(d.value))) return null;
  const out: [number, number][][][] = [];
  for (const d of body.data) {
    if (d.value !== BUILDING) continue;
    for (const { rings, extent } of polygons(Buffer.from(d.geometry, 'base64'))) out.push(rings.map((r) => r.map(([x, y]) => [x / extent, y / extent])));
  }
  return out;
}

// The mask of a photo's pixels (w × h) inside the polygons of buildingsIn.
export function buildingMask(polys: [number, number][][][], w: number, h: number) {
  const mask = new Uint8Array(w * h);
  for (const rings of polys) fill(mask, w, h, rings.map((r) => r.map(([x, y]) => [x * w, y * h])));
  return mask;
}

// The polygons of a vector tile's features, each as its rings in the tile's units.
function polygons(buf: Uint8Array) {
  const out: { rings: [number, number][][]; extent: number }[] = [];
  const tile = new Reader(buf);
  tile.fields((f, w) => {
    if (f !== 3 || w !== 2) return false;
    const layer = new Reader(tile.bytes());
    let extent = 4096;
    const geoms: number[][] = [];
    layer.fields((lf, lw) => {
      if (lf === 2 && lw === 2) {
        const fr = new Reader(layer.bytes());
        fr.fields((ff, fw) => {
          if (ff === 4 && fw === 2) { geoms.push(fr.packed(false)); return true; }
          return false;
        });
        return true;
      }
      if (lf === 5 && lw === 0) { extent = layer.varint(); return true; }
      return false;
    });
    for (const g of geoms) {
      const rings: [number, number][][] = [];
      let x = 0, y = 0, ring: [number, number][] = [];
      for (let k = 0; k < g.length;) {
        const cmd = g[k] & 7, count = g[k] >> 3;
        k++;
        if (cmd === 7) { if (ring.length > 2) rings.push(ring); ring = []; continue; }
        for (let c = 0; c < count && k + 1 < g.length; c++, k += 2) {
          const dx = g[k] % 2 === 0 ? g[k] / 2 : -(g[k] + 1) / 2, dy = g[k + 1] % 2 === 0 ? g[k + 1] / 2 : -(g[k + 1] + 1) / 2;
          x += dx; y += dy;
          if (cmd === 1) { if (ring.length > 2) rings.push(ring); ring = [[x, y]]; } else ring.push([x, y]);
        }
      }
      if (ring.length > 2) rings.push(ring);
      out.push({ rings, extent });
    }
    return true;
  });
  return out;
}

// Sets the pixels whose middles are inside the rings (even-odd, so holes stay out).
function fill(mask: Uint8Array, w: number, h: number, rings: [number, number][][]) {
  const xs: number[] = [];
  for (let py = 0; py < h; py++) {
    const y = py + 0.5;
    xs.length = 0;
    for (const r of rings) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i], [xj, yj] = r[j];
        if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k] - 0.5)), x1 = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5));
      for (let px = x0; px <= x1; px++) mask[py * w + px] = 1;
    }
  }
}
