// The laser scan over a piece of the world, for measuring a building before modelling it
// (src/detail/): how high its parts are, where they step, what stands on its roof.
//
//   npm run laser-points -- <x0,z0,x1,z1> [out]          world box, metres
//   npm run laser-points -- … --frame <x,z,turn,length,depth>
//
// It writes <out>.json, the points as [x, z, y, class, …] (world x, z; y RH 2000), and <out>.jpg,
// a height map half a metre to a pixel (the highest point in each), coloured blue (low) through
// green to red (high), north up. `out` is laser-points by default.
//
// With --frame, it prints a building's profile in its own frame: the frame's middle (world x, z)
// and turn (degrees, as src/detail's Builder.place: x along the building is world (cos, −sin)),
// and how long and deep it is. In 1 m slices across it, from −z: how many points, their median
// and 90th-percentile heights, and from where to where along it they reach — enough to find its
// parts, steps and setbacks. Points within 0.5 m of a wall are thin, so outer edges read about
// 0.3 m short.
//
// The scan is Lantmäteriet's (Laserdata Nedladdning, skog, CC BY 4.0), read as in
// tools/fetch-laser.ts and with the same login (tools/lib/lantmateriet.ts). In a cloud session
// the proxy logs in, but Node has to be told to use it:
//   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npm run laser-points -- …
import { writeFileSync } from 'node:fs';
import jpeg from 'jpeg-js';
import { GRID_TM, worldToGrid } from '../src/geo.ts';
import { nodesOver, openCopc, readNode } from './lib/copc.ts';
import { authHeaders, findFiles, tmToWorld } from './lib/lantmateriet.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const plain = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--frame');
const box = plain[0]?.split(',').map(Number);
if (!box || box.length !== 4 || box.some(Number.isNaN)) {
  console.error('usage: npm run laser-points -- <x0,z0,x1,z1> [out] [--frame x,z,turn,length,depth]');
  process.exit(1);
}
const out = plain[1] ?? 'laser-points';
const [x0, z0, x1, z1] = [Math.min(box[0], box[2]), Math.min(box[1], box[3]), Math.max(box[0], box[2]), Math.max(box[1], box[3])];
const NOISE = new Set([7, 18]);

// ------------------------------------------------------------------ the points
const corners = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => worldToGrid(x, z, GRID_TM));
const tm: [number, number, number, number] = [
  Math.min(...corners.map((g) => g.e)), Math.min(...corners.map((g) => g.n)),
  Math.max(...corners.map((g) => g.e)), Math.max(...corners.map((g) => g.n)),
];
const files = (await findFiles(tm, (c) => c === 'dsm-skoglig-copc'))
  .filter((f) => !(f.bbox[0] > tm[2] || f.bbox[2] < tm[0] || f.bbox[1] > tm[3] || f.bbox[3] < tm[1]));
// the newest flight of each square
const newest = new Map<string, (typeof files)[number]>();
for (const f of files) {
  const k = f.bbox.join(','), had = newest.get(k);
  if (!had || f.datetime > had.datetime) newest.set(k, f);
}
const { map } = tmToWorld(x0, z0, Math.max(x1 - x0, z1 - z0));
const headers = authHeaders();
const pts: number[] = [];
for (const f of newest.values()) {
  console.log(`${f.id}, flown ${f.datetime.slice(0, 10)}`);
  const file = await openCopc(f.url, headers);
  for (const key of nodesOver(file, tm)) {
    const p = await readNode(file, key);
    for (let i = 0; i < p.count; i++) {
      if (NOISE.has(p.cls[i])) continue;
      const [x, z] = map(p.x[i], p.y[i]);
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      pts.push(Math.round(x * 100) / 100, Math.round(z * 100) / 100, Math.round(p.z[i] * 100) / 100, p.cls[i]);
    }
  }
}
const n = pts.length / 4;
console.log(`${n} points`);
writeFileSync(`${out}.json`, JSON.stringify(pts));

// ------------------------------------------------------------------ the height map
const CELL = 0.5, W = Math.ceil((x1 - x0) / CELL), H = Math.ceil((z1 - z0) / CELL);
const top = new Float32Array(W * H).fill(-Infinity);
let lo = Infinity, hi = -Infinity;
for (let k = 0; k < n; k++) {
  const i = Math.min(W - 1, Math.floor((pts[4 * k] - x0) / CELL)), j = Math.min(H - 1, Math.floor((pts[4 * k + 1] - z0) / CELL));
  const y = pts[4 * k + 2];
  if (y > top[j * W + i]) top[j * W + i] = y;
  lo = Math.min(lo, y); hi = Math.max(hi, y);
}
const rgba = Buffer.alloc(W * H * 4);
for (let c = 0; c < W * H; c++) {
  const t = top[c] === -Infinity ? -1 : (top[c] - lo) / Math.max(1, hi - lo);
  const [r, g, b] = t < 0 ? [0, 0, 0] : [clamp(3 * t - 1.5), clamp(1.5 - Math.abs(3 * t - 1.5)), clamp(1.5 - 3 * t)];
  rgba.set([r * 255, g * 255, b * 255, 255], c * 4);
}
writeFileSync(`${out}.jpg`, jpeg.encode({ data: rgba, width: W, height: H }, 92).data);
console.log(`${out}.json, ${out}.jpg (${W} × ${H}, heights ${lo.toFixed(1)}–${hi.toFixed(1)} m)`);

// ------------------------------------------------------------------ a building's profile
const frame = option('--frame')?.split(',').map(Number);
if (frame) {
  const [cx, cz, turn, length, depth] = frame;
  const a = (turn * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const along: number[] = [], across: number[] = [], ys: number[] = [];
  for (let k = 0; k < n; k++) {
    const dx = pts[4 * k] - cx, dz = pts[4 * k + 1] - cz;
    // the inverse of Builder.place's turn
    const u = dx * c - dz * s, v = dx * s + dz * c;
    if (Math.abs(u) > length / 2 + 4 || Math.abs(v) > depth / 2 + 4) continue;
    along.push(u); across.push(v); ys.push(pts[4 * k + 2]);
  }
  const ground = pct(ys, 2);
  console.log(`\nacross (z), from −z: points, median and 90% height (m), along (x) from–to; ground about ${ground.toFixed(1)}`);
  for (let v = -depth / 2 - 4; v < depth / 2 + 4; v += 1) {
    const k = across.map((w, i) => (w >= v && w < v + 1 && ys[i] > ground + 3 ? i : -1)).filter((i) => i >= 0);
    if (k.length < 5) continue;
    const y = k.map((i) => ys[i]), u = k.map((i) => along[i]);
    console.log(`  z ${v.toFixed(1).padStart(6)}  ${String(k.length).padStart(4)}  ${pct(y, 50).toFixed(1).padStart(6)} ${pct(y, 90).toFixed(1).padStart(6)}   x ${pct(u, 1).toFixed(1).padStart(6)} … ${pct(u, 99).toFixed(1)}`);
  }
}

function clamp(v: number) { return Math.max(0, Math.min(1, v)); }
function pct(a: number[], p: number) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
}
