// Google's photorealistic 3D model of the city over a piece of the world, for measuring and
// looking at a building before modelling it (src/detail/): its shape, its heights and the colours
// and pattern of its walls and roof, as photographed from the air.
//
//   npm run google-mesh -- <x0,z0,x1,z1> [out]          world box, metres
//   npm run google-mesh -- … --frame <x,z,turn,length,depth>
//
// It writes, by default into .google/ (git ignores it):
//   <out>.glb      the mesh in world coordinates (x east, y up in RH 2000, z south), textured, for
//                  any glTF viewer or three.js
//   <out>-top.jpg  the view from straight above, north up, 0.1 m to a pixel
//   <out>-top-height.jpg   the height of that view, blue (low) through green to red (high)
// and with --frame (the building's middle in world x, z, its turn in degrees as src/detail's
// Builder.place, and its length and depth), the building's four sides seen straight on, at 0.05 m
// to a pixel, with only what stands inside that frame: <out>-north.jpg (its −z side), -south,
// -east (+x), -west. Then it prints a profile across the building in 1 m slices, as
// tools/laser-points.ts does, from the mesh's top surface.
//
// Neither the mesh nor any picture of it may go in the repo: Google's terms allow looking and
// measuring, not publishing. Keep them in .google/ or the scratchpad. The repo keeps only numbers
// read from them, with the shapes built by hand and the textures drawn in code.
//
// It reads Axel's download of Google Earth's mesh where there is one: the sthlm repo beside this
// one (../sthlm/downloaded_files/web/<area>-<level>-<epoch>/, central Stockholm at level 20), or
// --dir. Its heights match the laser scan to 0.1–0.3 m. A cloud session copies the download's
// tileset.json and the node files the box needs (--files lists them) from Axel's computer and
// points --dir at them. Failing that, or with --ion, it reads the same mesh from Google's
// Photorealistic 3D Tiles through Cesium ion with CESIUM_ION_TOKEN, as the cloud sessions have,
// but those heights are off by up to 2.5 m: fine for shapes and looks, not for heights. --above
// (metres) overrides the height of RH 2000's zero above the source's; see tools/lib/google-tiles.ts.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import jpeg from 'jpeg-js';
import { fromDownload, fromIon, type Piece } from './lib/google-tiles.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const valued = new Set(['--frame', '--above', '--dir']);
const plain = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
const box = plain[0]?.split(',').map(Number);
if (!box || box.length !== 4 || box.some(Number.isNaN)) {
  console.error('usage: npm run google-mesh -- <x0,z0,x1,z1> [out] [--frame x,z,turn,length,depth] [--dir download] [--files] [--ion] [--above m]');
  process.exit(1);
}
const out = plain[1] ?? '.google/google-mesh';
mkdirSync(dirname(out), { recursive: true });
const [x0, z0, x1, z1] = [Math.min(box[0], box[2]), Math.min(box[1], box[3]), Math.max(box[0], box[2]), Math.max(box[1], box[3])];
const above = option('--above') === undefined ? undefined : Number(option('--above'));
const RAD = Math.PI / 180;

// ------------------------------------------------------------------ the mesh, in world coordinates
// the most detailed download there is, unless told otherwise
function download() {
  if (args.includes('--ion')) return undefined;
  if (option('--dir')) return option('--dir');
  const web = '../sthlm/downloaded_files/web';
  if (!existsSync(web)) return undefined;
  return readdirSync(web).map((d) => join(web, d)).filter((d) => existsSync(join(d, 'tileset.json')))
    .map((d) => ({ d, level: JSON.parse(readFileSync(join(d, 'tileset.json'), 'utf8')).maxLevel as number }))
    .sort((a, b) => b.level - a.level)[0]?.d;
}
const dir = download(), token = process.env.CESIUM_ION_TOKEN;
if (!dir && !token) {
  console.error('no Google mesh: neither a download in ../sthlm (or --dir) nor CESIUM_ION_TOKEN');
  process.exit(1);
}
console.log(dir ? `from ${dir}` : 'from Cesium ion');
if (dir && args.includes('--files')) {
  // the node files the box needs, for copying to where the tool runs
  for (const f of (await fromDownload(dir, [x0, z0, x1, z1], above, true)).files) console.log(f);
  process.exit(0);
}
const pieces: Piece[] = dir ? (await fromDownload(dir, [x0, z0, x1, z1], above)).pieces : await fromIon(token!, [x0, z0, x1, z1], above);
// keep the triangles whose middle is in the box
for (const pc of pieces) {
  const keep: number[] = [];
  for (let t = 0; t < pc.idx.length; t += 3) {
    let x = 0, z = 0;
    for (let k = 0; k < 3; k++) { x += pc.pos[3 * pc.idx[t + k]]; z += pc.pos[3 * pc.idx[t + k] + 2]; }
    x /= 3; z /= 3;
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) keep.push(pc.idx[t], pc.idx[t + 1], pc.idx[t + 2]);
  }
  pc.idx = Uint32Array.from(keep);
}
const used = pieces.filter((p) => p.idx.length);
console.log(`${used.reduce((s, p) => s + p.idx.length / 3, 0)} triangles`);
writeGlb(`${out}.glb`, used);
console.log(`${out}.glb`);

// ------------------------------------------------------------------ pictures of it
// An orthographic view: across (right) and up in the picture, and towards the viewer, as world
// vectors; the nearest surface wins.
type V = [number, number, number];
function view(file: string, origin: V, right: V, up: V, toward: V, width: number, height: number, res: number,
  keep?: (x: number, z: number) => boolean) {
  const W = Math.ceil(width / res), H = Math.ceil(height / res);
  const rgba = new Uint8Array(W * H * 4), depth = new Float32Array(W * H).fill(-Infinity), at = new Float32Array(W * H).fill(NaN);
  const dot = (p: Float32Array, i: number, v: V) => (p[i] - origin[0]) * v[0] + (p[i + 1] - origin[1]) * v[1] + (p[i + 2] - origin[2]) * v[2];
  for (const pc of used) {
    const { width: tw, height: th, data } = pc.img;
    for (let t = 0; t < pc.idx.length; t += 3) {
      const ia = pc.idx[t], ib = pc.idx[t + 1], ic = pc.idx[t + 2];
      if (keep && !keep((pc.pos[3 * ia] + pc.pos[3 * ib] + pc.pos[3 * ic]) / 3, (pc.pos[3 * ia + 2] + pc.pos[3 * ib + 2] + pc.pos[3 * ic + 2]) / 3)) continue;
      const sx = [ia, ib, ic].map((i) => dot(pc.pos, 3 * i, right) / res);
      const sy = [ia, ib, ic].map((i) => H - dot(pc.pos, 3 * i, up) / res);
      const sd = [ia, ib, ic].map((i) => dot(pc.pos, 3 * i, toward));
      const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]);
      if (Math.abs(area) < 1e-9) continue;
      const bx0 = Math.max(0, Math.floor(Math.min(...sx))), bx1 = Math.min(W - 1, Math.ceil(Math.max(...sx)));
      const by0 = Math.max(0, Math.floor(Math.min(...sy))), by1 = Math.min(H - 1, Math.ceil(Math.max(...sy)));
      for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
        const cx = px + 0.5, cy = py + 0.5;
        const w0 = ((sx[1] - cx) * (sy[2] - cy) - (sx[2] - cx) * (sy[1] - cy)) / area;
        const w1 = ((sx[2] - cx) * (sy[0] - cy) - (sx[0] - cx) * (sy[2] - cy)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const d = w0 * sd[0] + w1 * sd[1] + w2 * sd[2], c = py * W + px;
        if (d <= depth[c]) continue;
        depth[c] = d;
        at[c] = w0 * pc.pos[3 * ia + 1] + w1 * pc.pos[3 * ib + 1] + w2 * pc.pos[3 * ic + 1];
        const u = w0 * pc.uv[2 * ia] + w1 * pc.uv[2 * ib] + w2 * pc.uv[2 * ic];
        const v = w0 * pc.uv[2 * ia + 1] + w1 * pc.uv[2 * ib + 1] + w2 * pc.uv[2 * ic + 1];
        const tx = Math.min(tw - 1, Math.max(0, Math.floor(u * tw))), ty = Math.min(th - 1, Math.max(0, Math.floor(v * th)));
        rgba.set(data.subarray((ty * tw + tx) * 4, (ty * tw + tx) * 4 + 4), c * 4);
      }
    }
  }
  writeFileSync(file, jpeg.encode({ data: rgba, width: W, height: H }, 90).data);
  console.log(`${file} (${W} × ${H})`);
  return { W, H, height: at };
}

const top = view(`${out}-top.jpg`, [x0, 0, z1], [1, 0, 0], [0, 0, -1], [0, 1, 0], x1 - x0, z1 - z0, 0.1);
let lo = Infinity, hi = -Infinity;
for (const y of top.height) if (!Number.isNaN(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
const map = new Uint8Array(top.W * top.H * 4);
for (let c = 0; c < top.W * top.H; c++) {
  const t = Number.isNaN(top.height[c]) ? -1 : (top.height[c] - lo) / Math.max(1, hi - lo);
  const [r, g, b] = t < 0 ? [0, 0, 0] : [clamp(3 * t - 1.5), clamp(1.5 - Math.abs(3 * t - 1.5)), clamp(1.5 - 3 * t)];
  map.set([r * 255, g * 255, b * 255, 255], c * 4);
}
writeFileSync(`${out}-top-height.jpg`, jpeg.encode({ data: map, width: top.W, height: top.H }, 90).data);
console.log(`${out}-top-height.jpg (heights ${lo.toFixed(1)}–${hi.toFixed(1)} m)`);

// ------------------------------------------------------------------ a building's sides and profile
const frame = option('--frame')?.split(',').map(Number);
if (frame) {
  const [cx, cz, turn, length, depthM] = frame;
  const a = turn * RAD, c = Math.cos(a), s = Math.sin(a);
  // the building's x (along) and z (across) in the world, as Builder.place turns them
  const ax: V = [c, 0, -s], az: V = [s, 0, c];
  const yLo = lo - 2, tall = hi - yLo + 2, m = 4;
  const corner = (u: number, v: number): V => [cx + u * ax[0] + v * az[0], yLo, cz + u * ax[2] + v * az[2]];
  const L = length / 2 + m, D = depthM / 2 + m;
  // only what stands inside the frame, so a neighbour in front does not hide the building
  const keep = (x: number, z: number) => {
    const u = (x - cx) * ax[0] + (z - cz) * ax[2], v = (x - cx) * az[0] + (z - cz) * az[2];
    return Math.abs(u) <= L && Math.abs(v) <= D;
  };
  // each side from outside, left to right as seen
  view(`${out}-north.jpg`, corner(L, -D), [-ax[0], 0, -ax[2]], [0, 1, 0], [-az[0], 0, -az[2]], 2 * L, tall, 0.05, keep);
  view(`${out}-south.jpg`, corner(-L, D), ax, [0, 1, 0], az, 2 * L, tall, 0.05, keep);
  view(`${out}-east.jpg`, corner(L, D), [-az[0], 0, -az[2]], [0, 1, 0], ax, 2 * D, tall, 0.05, keep);
  view(`${out}-west.jpg`, corner(-L, -D), az, [0, 1, 0], [-ax[0], 0, -ax[2]], 2 * D, tall, 0.05, keep);

  const plan = view(`${out}-plan.jpg`, corner(-L, D), ax, [-az[0], 0, -az[2]], [0, 1, 0], 2 * L, 2 * D, 0.25);
  const ys: number[] = [];
  for (const y of plan.height) if (!Number.isNaN(y)) ys.push(y);
  const ground = pct(ys, 2);
  console.log(`\nacross (z), from −z: cells, median and 90% height (m), along (x) from–to; ground about ${ground.toFixed(1)}`);
  for (let v = -D; v < D; v += 1) {
    const y: number[] = [], u: number[] = [];
    for (let row = 0; row < plan.H; row++) {
      const vv = -D + (row + 0.5) * 0.25;
      if (vv < v || vv >= v + 1) continue;
      for (let col = 0; col < plan.W; col++) {
        const h = plan.height[row * plan.W + col];
        if (h > ground + 3) { y.push(h); u.push(-L + (col + 0.5) * 0.25); }
      }
    }
    if (y.length < 5) continue;
    console.log(`  z ${v.toFixed(1).padStart(6)}  ${String(y.length).padStart(4)}  ${pct(y, 50).toFixed(1).padStart(6)} ${pct(y, 90).toFixed(1).padStart(6)}   x ${pct(u, 1).toFixed(1).padStart(6)} … ${pct(u, 99).toFixed(1)}`);
  }
}

function clamp(v: number) { return Math.max(0, Math.min(1, v)); }
function pct(a: number[], p: number) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
}

// One glTF binary: a mesh, material and texture per piece, all in one buffer.
function writeGlb(file: string, list: Piece[]) {
  const chunks: Uint8Array[] = [], bufferViews: object[] = [], accessors: object[] = [];
  let offset = 0;
  const add = (data: Uint8Array, target?: number) => {
    chunks.push(data);
    const pad = (4 - (data.byteLength % 4)) % 4;
    if (pad) chunks.push(new Uint8Array(pad));
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: data.byteLength, ...(target ? { target } : {}) });
    offset += data.byteLength + pad;
    return bufferViews.length - 1;
  };
  const meshes: object[] = [], materials: object[] = [], images: object[] = [], textures: object[] = [];
  list.forEach((p, i) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < p.pos.length; k++) { min[k % 3] = Math.min(min[k % 3], p.pos[k]); max[k % 3] = Math.max(max[k % 3], p.pos[k]); }
    accessors.push({ bufferView: add(new Uint8Array(p.pos.buffer), 34962), componentType: 5126, count: p.pos.length / 3, type: 'VEC3', min, max });
    accessors.push({ bufferView: add(new Uint8Array(p.uv.buffer, p.uv.byteOffset, p.uv.byteLength), 34962), componentType: 5126, count: p.uv.length / 2, type: 'VEC2' });
    accessors.push({ bufferView: add(new Uint8Array(p.idx.buffer), 34963), componentType: 5125, count: p.idx.length, type: 'SCALAR' });
    images.push({ mimeType: 'image/jpeg', bufferView: add(p.jpg) });
    textures.push({ source: i, sampler: 0 });
    materials.push({ pbrMetallicRoughness: { baseColorTexture: { index: i }, metallicFactor: 0 }, extensions: { KHR_materials_unlit: {} } });
    meshes.push({ primitives: [{ attributes: { POSITION: 3 * i, TEXCOORD_0: 3 * i + 1 }, indices: 3 * i + 2, material: i }] });
  });
  const gltf = {
    asset: { version: '2.0', copyright: 'Google', generator: 'tbana tools/google-mesh.ts' },
    extensionsUsed: ['KHR_materials_unlit'], scene: 0, scenes: [{ nodes: list.map((_, i) => i) }],
    nodes: list.map((_, i) => ({ mesh: i })), meshes, materials, images, textures,
    samplers: [{ wrapS: 33071, wrapT: 33071 }], accessors, bufferViews, buffers: [{ byteLength: offset }],
  };
  let json = new TextEncoder().encode(JSON.stringify(gltf));
  if (json.length % 4) json = Uint8Array.from([...json, ...new Array(4 - (json.length % 4)).fill(0x20)]);
  const head = new DataView(new ArrayBuffer(20));
  head.setUint32(0, 0x46546c67, true); head.setUint32(4, 2, true); head.setUint32(8, 28 + json.length + offset, true);
  head.setUint32(12, json.length, true); head.setUint32(16, 0x4e4f534a, true);
  const binHead = new DataView(new ArrayBuffer(8));
  binHead.setUint32(0, offset, true); binHead.setUint32(4, 0x004e4942, true);
  writeFileSync(file, Buffer.concat([new Uint8Array(head.buffer), json, new Uint8Array(binHead.buffer), ...chunks]));
}
