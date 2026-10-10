// The colours of the buildings' walls and roofs over a piece of the world, measured from Google's
// 3D model of the city, for tools/build-city.ts where OpenStreetMap gives none or a wrong one.
//
//   npm run google-colours -- <x0,z0,x1,z1>          world box, metres
//   npm run google-colours -- … --dir <download>
//
// It reads Axel's download of the mesh as tools/google-mesh.ts does (the sthlm repo beside this
// one, or --dir; a cloud session copies the node files the box needs, which
// `npm run google-mesh -- <box> --files` lists). For each OpenStreetMap building whose middle is in
// the box (data/osm/buildings.json) it casts rays at the mesh: down onto its roof, at points a
// metre or more inside its outline, and in at each side from 3 m out, at heights from its first
// floor to under its eaves. What the rays see on a side is put in order of brightness and the
// middle kept, leaving out the darkest third (windows, shadow) and the brightest twentieth
// (glare). The walls' colour is that of the brightest side seen well enough, since in Google's
// photos the sides in shadow are dark and blue; the roof's is the brighter half of what was seen
// on it. The blue-grey cast of the sky in the photos is taken out of both.
//
// It merges them into data/building-colours.json, a building's OSM id to [walls, roof] in hex
// (null where too little was seen). They are numbers read from the mesh, as Google's terms allow;
// the mesh stays out of the repo.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromDownload } from './lib/google-tiles.ts';
import { meshRays, type RGB } from './lib/mesh-rays.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const box = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--dir')?.split(',').map(Number);
if (!box || box.length !== 4 || box.some(Number.isNaN)) {
  console.error('usage: npm run google-colours -- <x0,z0,x1,z1> [--dir download]');
  process.exit(1);
}
const [X0, Z0, X1, Z1] = [Math.min(box[0], box[2]), Math.min(box[1], box[3]), Math.max(box[0], box[2]), Math.max(box[1], box[3])];
const OUT = 'data/building-colours.json';

function download() {
  if (option('--dir')) return option('--dir');
  const web = '../sthlm/downloaded_files/web';
  if (!existsSync(web)) return undefined;
  return readdirSync(web).map((d) => join(web, d)).filter((d) => existsSync(join(d, 'tileset.json')))
    .map((d) => ({ d, level: JSON.parse(readFileSync(join(d, 'tileset.json'), 'utf8')).maxLevel as number }))
    .sort((a, b) => b.level - a.level)[0]?.d;
}
const dir = download();
if (!dir) {
  console.error('no download of Google\'s mesh in ../sthlm (or --dir)');
  process.exit(1);
}
// the mesh round the box, far enough out to see the outer buildings' sides
const M = 40;
const { pieces } = await fromDownload(dir, [X0 - M, Z0 - M, X1 + M, Z1 + M]);
console.log(`${pieces.length} pieces of mesh from ${dir}`);

const { ray } = meshRays(pieces, [X0 - M, Z0 - M, X1 + M, Z1 + M]);

// ------------------------------------------------------------------ colours
const brightness = (c: number[]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
// the mean of the samples from the share `lo` to `hi` of them in order of brightness
function middle(samples: RGB[], lo: number, hi: number): RGB | null {
  if (samples.length < 4) return null;
  const s = [...samples].sort((a, b) => brightness(a) - brightness(b)).slice(Math.floor(samples.length * lo), Math.ceil(samples.length * hi));
  return [0, 1, 2].map((k) => s.reduce((t, c) => t + c[k], 0) / s.length) as RGB;
}
// the sky's blue-grey cast out of a dull colour: its saturation mostly taken away where its hue is
// blue
function uncast([r, g, b]: RGB): RGB {
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b), l = (hi + lo) / 2;
  if (hi === lo || b !== hi) return [r, g, b];
  const sat = (hi - lo) / (l < 128 ? hi + lo : 510 - hi - lo);
  if (sat > 0.4) return [r, g, b];
  const grey = brightness([r, g, b]), keep = 0.25;
  return [r, g, b].map((v) => grey + (v - grey) * keep) as RGB;
}
const hex = (c: RGB | null) => c && `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

// ------------------------------------------------------------------ the buildings
const osm: { buildings: { osm: string; rings: number[][] }[] } = JSON.parse(readFileSync('data/osm/buildings.json', 'utf8'));
function inRing(x: number, z: number, r: number[]) {
  let c = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    if ((r[i + 1] > z) !== (r[j + 1] > z) && x < ((r[j] - r[i]) * (z - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i]) c = !c;
  }
  return c;
}
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const found: Record<string, [string | null, string | null]> = {};
let measured = 0;
for (const b of osm.buildings) {
  const r = b.rings[0], n = r.length / 2;
  let cx = 0, cz = 0, x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < r.length; i += 2) {
    cx += r[i] / n; cz += r[i + 1] / n;
    x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 1]); z1 = Math.max(z1, r[i + 1]);
  }
  if (cx < X0 || cx > X1 || cz < Z0 || cz > Z1) continue;
  // the roof, from above
  const roof: RGB[] = [], tops: number[] = [];
  const step = Math.max(1, Math.min(3, Math.sqrt((x1 - x0) * (z1 - z0)) / 8));
  for (let x = x0 + step / 2; x < x1; x += step) for (let z = z0 + step / 2; z < z1; z += step) {
    if (![[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, c]) => inRing(x + a, z + c, r))) continue;
    const h = ray([x, 300, z], [0, -1, 0], 400);
    if (h) { roof.push(h.rgb); tops.push(h.y); }
  }
  if (!tops.length) continue;
  // its sides, each from outside it, and the street in front of each
  const sides: { len: number; out: [number, number]; a: [number, number]; dir: [number, number] }[] = [], street: number[] = [];
  for (let i = 0; i < r.length; i += 2) {
    const j = (i + 2) % r.length, len = Math.hypot(r[j] - r[i], r[j + 1] - r[i + 1]);
    if (len < 4) continue;
    const dir: [number, number] = [(r[j] - r[i]) / len, (r[j + 1] - r[i + 1]) / len];
    let out: [number, number] = [dir[1], -dir[0]];
    const mx = (r[i] + r[j]) / 2, mz = (r[i + 1] + r[j + 1]) / 2;
    if (inRing(mx + out[0] * 0.5, mz + out[1] * 0.5, r)) out = [-out[0], -out[1]];
    // (a side in a courtyard's corner, or folded back on itself)
    if (inRing(mx + out[0] * 3, mz + out[1] * 3, r)) continue;
    const g = ray([mx + out[0] * 3, 300, mz + out[1] * 3], [0, -1, 0], 400);
    if (g) street.push(g.y);
    sides.push({ len, out, a: [r[i], r[i + 1]], dir });
  }
  const top = median(tops), low = street.filter((y) => y < top - 2), ground = low.length ? Math.min(...low) : top - 12;
  const high = top - ground;
  const ys = high > 8 ? [0.35, 0.5, 0.65, 0.8].map((f) => ground + 3.5 + f * (0.85 * high - 3.5)) : [ground + 0.55 * high];
  const seen: { rgb: RGB; count: number }[] = [];
  let total = 0;
  for (const s of sides) {
    const samples: RGB[] = [], k = Math.max(3, Math.min(12, Math.round(s.len / 2)));
    for (let i = 0; i < k; i++) {
      const f = (0.1 + (0.8 * (i + 0.5)) / k) * s.len, px = s.a[0] + s.dir[0] * f, pz = s.a[1] + s.dir[1] * f;
      for (const y of ys) {
        // the wall within 2 m of the outline, and upright
        const h = ray([px + s.out[0] * 3, y, pz + s.out[1] * 3], [-s.out[0], 0, -s.out[1]], 6);
        if (h && h.t > 1 && h.t < 5.5 && h.flat < 0.5) samples.push(h.rgb);
      }
    }
    total += samples.length;
    const rgb = middle(samples, 0.35, 0.95);
    if (rgb) seen.push({ rgb, count: samples.length });
  }
  const enough = seen.filter((s) => s.count >= Math.max(6, 0.1 * total));
  const walls = enough.length ? enough.reduce((a, s) => (brightness(s.rgb) > brightness(a.rgb) ? s : a)).rgb : null;
  const roofs = roof.length >= 4 ? middle(roof, 0.5, 0.92) : null;
  if (!walls && !roofs) continue;
  found[b.osm] = [hex(walls && uncast(walls)), hex(roofs && uncast(roofs))];
  if (++measured % 200 === 0) console.log(`${measured} buildings`);
}

// ------------------------------------------------------------------ out
const had: { note?: string; buildings: Record<string, [string | null, string | null]> } =
  existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { buildings: {} };
const all = { ...had.buildings, ...found };
const note = 'The colours of buildings\' walls and roofs, [walls, roof] by OpenStreetMap id, measured from Google\'s 3D model of the city by tools/google-colours.ts. tools/build-city.ts takes them for building:colour and roof:colour over OpenStreetMap\'s; data/building-corrections.json can still override them.';
const lines = Object.keys(all).sort().map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(all[k])}`);
writeFileSync(OUT, `{\n  "note": ${JSON.stringify(note)},\n  "buildings": {\n${lines.join(',\n')}\n  }\n}\n`);
console.log(`${measured} buildings measured, ${Object.keys(all).length} in ${OUT}`);
