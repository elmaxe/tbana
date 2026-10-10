// Reading Google's photorealistic 3D model of the city (see tools/google-mesh.ts) over a world box,
// as textured triangles in world coordinates (x east, y up in RH 2000, z south), from either of
// two places:
//
// - Axel's download of Google Earth's mesh, made with the sthlm repo (retroplasma's
//   earth-reverse-engineering, `node download_stockholm.js --web`): a folder with tileset.json and
//   nodes/<octant path>.bin in its own format (sthlm's viewer/tile-format.js). Its points are in a
//   local frame of Google Earth's round planet (radius 6 371 010 m); heights on that planet are
//   about 3.25 m above RH 2000 round Hötorget, measured against the laser scan.
// - Google's Photorealistic 3D Tiles through Cesium ion (asset 2275207), which works from Sweden
//   where Google's own API refuses. It needs CESIUM_ION_TOKEN. Heights are above the WGS 84
//   ellipsoid. It is the same mesh as the download at the same detail, but its heights are off by
//   up to 2.5 m, and by different amounts from place to place (by 25.0–27.5 m above RH 2000 round
//   Hötorget, against the laser scan), so take heights from the download or the laser scan.
//
// Either way the finest tiles are some 40–60 m across with texels of about 0.1 m.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { GRID_1800, ORIGIN, project, unproject, worldToGrid } from '../../src/geo.ts';

export interface Piece {
  pos: Float32Array; uv: Float32Array; idx: Uint32Array;
  jpg: Uint8Array; img: { width: number; height: number; data: Uint8Array };
}
export type Box = [number, number, number, number];

const RAD = Math.PI / 180;
const toWorld = (lat: number, lon: number, y: number): [number, number, number] => {
  const { e, n } = project(lat, lon);
  return [e - ORIGIN.e, y, ORIGIN.n - n];
};
const latLon = (x: number, z: number) => { const g = worldToGrid(x, z, GRID_1800); return unproject(g.e, g.n); };

// ------------------------------------------------------------------ Axel's download
export const PLANET = 6371010;
// With list, only which node files the box needs (to copy them from Axel's computer to a cloud
// session, say: tileset.json and these).
export async function fromDownload(dir: string, box: Box, above = 3.25, list = false): Promise<{ files: string[]; pieces: Piece[] }> {
  const set = JSON.parse(readFileSync(join(dir, 'tileset.json'), 'utf8'));
  const O: number[] = set.frame.origin, R: number[][] = set.frame.rotation;
  // the planet's xyz to the frame's and back: frame = (p − O) Rᵀ, p = O + frame R
  const toFrame = (p: number[]) => [0, 1, 2].map((i) => R[i].reduce((s, r, k) => s + r * (p[k] - O[k]), 0));
  const onPlanet = (x: number, z: number, h: number) => {
    const { lat, lon } = latLon(x, z), r = PLANET + h;
    return toFrame([r * Math.cos(lat * RAD) * Math.cos(lon * RAD), r * Math.cos(lat * RAD) * Math.sin(lon * RAD), r * Math.sin(lat * RAD)]);
  };
  const { mid, reach } = sphere(box, (x, z, h) => onPlanet(x, z, h));
  const nodes: Record<string, number[]> = set.nodes; // path: [childMask, cx, cy, cz, radius, metres per texel]
  const near = (path: string) => {
    const [, cx, cy, cz, r] = nodes[path];
    return Math.hypot(cx - mid[0], cy - mid[1], cz - mid[2]) < r + reach;
  };
  // every node near the box, whether downloaded or not
  const paths: string[] = [];
  const visit = (path: string) => {
    if (!nodes[path] || !near(path)) return;
    paths.push(path);
    for (let k = 0; k < 8; k++) visit(path + k);
  };
  for (const root of set.roots as string[]) visit(root);
  const files = paths.map((path) => join(dir, 'nodes', `${path}.bin`));
  if (list) return { files, pieces: [] };
  const missing = files.filter((f) => !existsSync(f));
  if (missing.length) console.warn(`${missing.length} of ${files.length} tiles are not in ${dir}; see --files`);
  const pieces: Piece[] = [];
  for (const path of paths) {
    const file = join(dir, 'nodes', `${path}.bin`);
    if (existsSync(file)) pieces.push(...readNode(readFileSync(file), path, (p) => {
      const e = [0, 1, 2].map((k) => O[k] + p[0] * R[0][k] + p[1] * R[1][k] + p[2] * R[2][k]);
      const r = Math.hypot(e[0], e[1], e[2]);
      return toWorld(Math.asin(e[2] / r) / RAD, Math.atan2(e[1], e[0]) / RAD, r - PLANET - above);
    }));
  }
  return { files, pieces };

  // A node's meshes, without the parts its finer children (where downloaded) draw again.
  function readNode(buf: Buffer, path: string, map: (p: number[]) => [number, number, number]): Piece[] {
    const b = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const dv = new DataView(b);
    const u32 = (o: number) => dv.getUint32(o, true);
    const out: Piece[] = [];
    let o = 36;
    for (let m = 0, count = u32(8); m < count; m++) {
      const vc = u32(o), flags = u32(o + 4), fmt = u32(o + 8), w = u32(o + 12), h = u32(o + 16), tb = u32(o + 20);
      const oc = Array.from({ length: 8 }, (_, k) => u32(o + 24 + 4 * k));
      const ic = oc.reduce((s, c) => s + c, 0);
      o += 56;
      const p = new Float32Array(b, o, vc * 3); o += vc * 12;
      const uv = flags & 1 ? new Float32Array(b.slice(o, o + vc * 8)) : new Float32Array(vc * 2); if (flags & 1) o += vc * 8;
      const all = flags & 2 ? new Uint32Array(b, o, ic) : new Uint16Array(b, o, ic); o += align4(all.byteLength);
      const tex = new Uint8Array(b, o, tb); o += align4(tb);
      const keep: number[] = [];
      for (let k = 0, s = 0; k < 8; s += oc[k], k++) {
        if (nodes[path + k] && existsSync(join(dir, 'nodes', `${path + k}.bin`))) continue;
        for (let i = s; i < s + oc[k]; i++) keep.push(all[i]);
      }
      if (!keep.length || !fmt) continue;
      const pos = new Float32Array(vc * 3);
      for (let i = 0; i < vc; i++) pos.set(map([p[3 * i], p[3 * i + 1], p[3 * i + 2]]), 3 * i);
      let jpg: Uint8Array, img;
      if (fmt === 1) {
        jpg = tex.slice();
        img = jpeg.decode(jpg, { useTArray: true, formatAsRGBA: true });
      } else {
        img = { width: w, height: h, data: dxt1(tex, w, h) };
        jpg = new Uint8Array(jpeg.encode(img, 92).data);
      }
      out.push({ pos, uv, idx: Uint32Array.from(keep), jpg, img });
    }
    return out;
  }
}

function align4(n: number) { return (n + 3) & ~3; }

function dxt1(bytes: Uint8Array, width: number, height: number) {
  const out = new Uint8Array(width * height * 4), colors = new Uint8Array(16);
  const rgb = (c: number) => [((c >> 11) & 31) * 255 / 31, ((c >> 5) & 63) * 255 / 63, (c & 31) * 255 / 31];
  const bw = Math.ceil(width / 4), bh = Math.ceil(height / 4);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const o = (by * bw + bx) * 8;
    const c0 = bytes[o] | (bytes[o + 1] << 8), c1 = bytes[o + 2] | (bytes[o + 3] << 8);
    const a = rgb(c0), b = rgb(c1);
    for (let k = 0; k < 3; k++) {
      colors[k] = a[k]; colors[4 + k] = b[k];
      colors[8 + k] = c0 > c1 ? (2 * a[k] + b[k]) / 3 : (a[k] + b[k]) / 2;
      colors[12 + k] = c0 > c1 ? (a[k] + 2 * b[k]) / 3 : 0;
    }
    colors[3] = colors[7] = colors[11] = colors[15] = 255;
    const bits = (bytes[o + 4] | (bytes[o + 5] << 8) | (bytes[o + 6] << 16) | (bytes[o + 7] << 24)) >>> 0;
    for (let py = 0; py < 4; py++) for (let px = 0; px < 4; px++) {
      const x = bx * 4 + px, y = by * 4 + py;
      if (x < width && y < height) out.set(colors.subarray(((bits >>> (2 * (py * 4 + px))) & 3) * 4, ((bits >>> (2 * (py * 4 + px))) & 3) * 4 + 4), (y * width + x) * 4);
    }
  }
  return out;
}

// The box, from below the ground to above the tallest roofs, as a sphere round its middle.
function sphere(box: Box, at: (x: number, z: number, h: number) => number[]) {
  const [x0, z0, x1, z1] = box;
  const c = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].flatMap(([x, z]) => [at(x, z, 0), at(x, z, 200)]);
  const mid = [0, 1, 2].map((i) => c.reduce((s, p) => s + p[i], 0) / c.length);
  return { mid, reach: Math.max(...c.map((p) => Math.hypot(p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]))) };
}

// ------------------------------------------------------------------ Cesium ion
const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F);
export async function fromIon(token: string, box: Box, above = 25.9): Promise<Piece[]> {
  const ecef = (x: number, z: number, h: number) => {
    const { lat, lon } = latLon(x, z), p = lat * RAD, l = lon * RAD, n = A / Math.sqrt(1 - E2 * Math.sin(p) ** 2);
    return [(n + h) * Math.cos(p) * Math.cos(l), (n + h) * Math.cos(p) * Math.sin(l), (n * (1 - E2) + h) * Math.sin(p)];
  };
  // Bowring's formula; well under a millimetre at these heights
  const fromEcef = (X: number, Y: number, Z: number) => {
    const b = A * (1 - F), ep2 = (A * A - b * b) / (b * b), p = Math.hypot(X, Y), th = Math.atan2(Z * A, p * b);
    const lat = Math.atan2(Z + ep2 * b * Math.sin(th) ** 3, p - E2 * A * Math.cos(th) ** 3);
    const n = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
    return toWorld(lat / RAD, Math.atan2(Y, X) / RAD, p / Math.cos(lat) - n - above);
  };
  const { mid, reach } = sphere(box, ecef);

  interface Tile { boundingVolume: { box: number[] }; content?: { uri: string }; children?: Tile[] }
  const endpoint = await (await fetch(`https://api.cesium.com/v1/assets/2275207/endpoint?access_token=${token}`)).json();
  const rootUrl = new URL(endpoint.options.url);
  const key = rootUrl.searchParams.get('key')!;
  const near = (b: number[]) => {
    let d2 = 0;
    for (let i = 0; i < 3; i++) {
      const half = Math.abs(b[3 + i]) + Math.abs(b[6 + i]) + Math.abs(b[9 + i]);
      d2 += Math.max(0, Math.abs(mid[i] - b[i]) - half) ** 2;
    }
    return d2 < reach * reach;
  };
  const resolve = (uri: string, base: URL) => {
    const u = new URL(uri, base);
    u.searchParams.set('key', key);
    const session = base.searchParams.get('session');
    if (session && !u.searchParams.has('session')) u.searchParams.set('session', session);
    return u;
  };
  const leaves: URL[] = [];
  const walk = async (t: Tile, base: URL): Promise<void> => {
    if (!near(t.boundingVolume.box)) return;
    if (t.content) {
      const u = resolve(t.content.uri, base);
      if (u.pathname.endsWith('.json')) return walk((await (await fetch(u)).json()).root, u);
      if (!t.children?.length) leaves.push(u);
    }
    await Promise.all((t.children ?? []).map((c) => walk(c, base)));
  };
  await walk((await (await fetch(rootUrl)).json()).root, rootUrl);

  const pieces: Piece[] = [];
  const read = async (u: URL) => {
    const b = new Uint8Array(await (await fetch(u)).arrayBuffer());
    const jsonLen = new DataView(b.buffer).getUint32(12, true);
    const gl = JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + jsonLen)));
    const bin = b.subarray(28 + jsonLen);
    const view = (i: number) => { const v = gl.bufferViews[i]; return bin.slice(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength); };
    const accessor = (i: number) => {
      const a = gl.accessors[i], v = view(a.bufferView).buffer;
      const n = a.count * ({ SCALAR: 1, VEC2: 2, VEC3: 3 } as Record<string, number>)[a.type], at = a.byteOffset ?? 0;
      return a.componentType === 5126 ? new Float32Array(v, at, n) : a.componentType === 5125 ? new Uint32Array(v, at, n)
        : a.componentType === 5123 ? new Uint16Array(v, at, n) : new Uint8Array(v, at, n);
    };
    for (const node of gl.nodes) {
      if (node.mesh === undefined) continue;
      const m: number[] = node.matrix ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      for (const prim of gl.meshes[node.mesh].primitives) {
        const p = accessor(prim.attributes.POSITION) as Float32Array;
        const pos = new Float32Array(p.length);
        for (let i = 0; i < p.length; i += 3) {
          // the node's matrix, then glTF's y up to 3D Tiles' z up
          const gx = m[0] * p[i] + m[4] * p[i + 1] + m[8] * p[i + 2] + m[12];
          const gy = m[1] * p[i] + m[5] * p[i + 1] + m[9] * p[i + 2] + m[13];
          const gz = m[2] * p[i] + m[6] * p[i + 1] + m[10] * p[i + 2] + m[14];
          pos.set(fromEcef(gx, -gz, gy), i);
        }
        // (now and then a piece comes untextured: it is left out)
        const base = gl.materials[prim.material]?.pbrMetallicRoughness?.baseColorTexture;
        if (!base) continue;
        const tex = gl.textures[base.index];
        const jpg = view(gl.images[tex.source].bufferView);
        pieces.push({
          pos, uv: Float32Array.from(accessor(prim.attributes.TEXCOORD_0)), idx: Uint32Array.from(accessor(prim.indices)),
          jpg, img: jpeg.decode(jpg, { useTArray: true, formatAsRGBA: true }),
        });
      }
    }
  };
  for (let i = 0; i < leaves.length; i += 8) await Promise.all(leaves.slice(i, i + 8).map(read));
  return pieces;
}
