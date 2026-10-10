// Finds the trees in Lantmäteriet's laser scan, in the areas drawn in detail (src/detail/areas.ts):
// where each stands, how tall it is and how wide its crown, for src/detail/streets.ts to draw.
// OpenStreetMap maps few of them (tools/fetch-streets.ts keeps those it has).
//
//   npm run find-trees                               -> data/trees.json
//   npm run find-trees -- --points <laser-points.json>   from points npm run laser-points saved
//   npm run find-trees -- … --google <download>      and in Google's mesh (tools/google-mesh.ts)
//
// (In a cloud session, with NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt.)
//
// The scan (Laserdata Nedladdning, skog, read as in tools/laser-points.ts) calls the points on the
// ground ground, and those on buildings, trees, poles and wires alike unclassified. So, on a 1 m
// grid:
// - the ground under each cell, from the ground points round it;
// - the canopy: the highest unclassified point over the ground in each cell, leaving out cells in
//   or within 1.5 m of a building (data/osm/buildings.json), over water, and on bridges;
// - a tree for each top of it at least 4.5 m up that is the highest within 2.5 m, its crown as far
//   out as the canopy stays above half its height, and the lower tops in a crown left out;
// - kept only if its crown is as a tree's: at least 1.8 m in radius (and a sixth of its height,
//   for a tree over 20 m) and 10 m² of canopy, mostly filled, and
//   ragged rather than flat (the points in its cells spread over a metre or more up and down, as
//   the bare branches of the March flight do; a roof's lie flat). Poles, masts, wires and cranes
//   are too thin, and site huts and kiosks too flat;
// - and not on a deck or roof OpenStreetMap doesn't have (a bridge's, where the scan doesn't call
//   it a bridge), nor within 3 m of one: lamps, masts and wires stand on those.
// The scan was flown in March 2021, so it misses the trees planted since (the new quay along
// Munkbroleden's), and sees a young tree's bare crown too thin to tell from a lamp. With --google,
// the trees are also looked for in Google's mesh, whose photos were taken in leaf: the tops of
// its green, found as in the scan, from 3.5 m up and 1 m across. Its heights drift, so they are
// taken over the scan's ground, less the drift of its paved ground round about. A tree the scan
// has too is kept from the mesh. The mesh stays out of the repo; only the positions and sizes
// go in it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GRID_TM, worldToGrid } from '../src/geo.ts';
import { DETAIL_AREAS } from '../src/detail/areas.ts';
import { nodesOver, openCopc, readNode } from './lib/copc.ts';
import { authHeaders, findFiles, tmToWorld } from './lib/lantmateriet.ts';
import { fromDownload } from './lib/google-tiles.ts';
import { meshRays } from './lib/mesh-rays.ts';

const OUT = 'data/trees.json';
const MARGIN = 30;
const NOISE = new Set([7, 18]), GROUND = 2, WATER = 9, BRIDGE = 17;
// Mälaren and Saltsjön stand at 0.10–0.89 m (RH 2000); the quays are 2 m up or more
const WATER_TOP = 1.3;

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const cached = option('--points'), google = option('--google');

// ------------------------------------------------------------------ the points
async function scan(x0: number, z0: number, x1: number, z1: number): Promise<number[]> {
  if (cached) {
    const all: number[] = JSON.parse(readFileSync(cached, 'utf8'));
    const out: number[] = [];
    for (let k = 0; k < all.length; k += 4) {
      if (all[k] >= x0 && all[k] <= x1 && all[k + 1] >= z0 && all[k + 1] <= z1) out.push(all[k], all[k + 1], all[k + 2], all[k + 3]);
    }
    return out;
  }
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
    console.log(`  ${f.id}, flown ${f.datetime.slice(0, 10)}`);
    flights.add(f.datetime.slice(0, 10));
    const file = await openCopc(f.url, headers);
    for (const key of nodesOver(file, tm)) {
      const p = await readNode(file, key);
      for (let i = 0; i < p.count; i++) {
        if (NOISE.has(p.cls[i])) continue;
        const [x, z] = map(p.x[i], p.y[i]);
        if (x < x0 || x > x1 || z < z0 || z > z1) continue;
        pts.push(x, z, p.z[i], p.cls[i]);
      }
    }
  }
  return pts;
}
const flights = new Set<string>();

// ------------------------------------------------------------------ the buildings
const osm: { buildings: { rings: number[][] }[] } = JSON.parse(readFileSync('data/osm/buildings.json', 'utf8'));
const outlines = osm.buildings.map((b) => {
  const r = b.rings[0], ring: [number, number][] = [];
  for (let k = 0; k + 1 < r.length; k += 2) ring.push([r[k], r[k + 1]]);
  return ring;
});

// ------------------------------------------------------------------ the trees
type Tree = [number, number, number, number]; // x, z, height above the ground, crown radius
const trees: Tree[] = [];
for (const a of DETAIL_AREAS) {
  const x0 = Math.floor(a.x - a.r - MARGIN), z0 = Math.floor(a.z - a.r - MARGIN);
  const W = Math.ceil(2 * (a.r + MARGIN)), H = W;
  console.log(`${a.name}: ${W} × ${H} m`);
  const pts = await scan(x0, z0, x0 + W, z0 + H);
  const cell = (x: number, z: number) => {
    const i = Math.floor(x - x0), j = Math.floor(z - z0);
    return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i;
  };

  // the ground: the lowest ground (or water) point in each cell, then filled in from round about
  const ground = new Float32Array(W * H).fill(NaN);
  const water = new Uint8Array(W * H);
  for (let k = 0; k < pts.length; k += 4) {
    const c = cell(pts[k], pts[k + 1]), cls = pts[k + 3];
    if (c < 0 || (cls !== GROUND && cls !== WATER)) continue;
    if (cls === WATER) water[c] = 1;
    if (!(ground[c] <= pts[k + 2])) ground[c] = pts[k + 2];
  }
  for (let pass = 0, empty = 1; empty && pass < 60; pass++) {
    empty = 0;
    const next = ground.slice();
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const c = j * W + i;
      if (!Number.isNaN(ground[c])) continue;
      let s = 0, n = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
        const g = ground[jj * W + ii];
        if (!Number.isNaN(g)) { s += g; n++; }
      }
      if (n) next[c] = s / n; else empty++;
    }
    ground.set(next);
  }

  // the cells in or near a building
  const built = new Uint8Array(W * H);
  for (const ring of outlines) {
    let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity;
    for (const [x, z] of ring) { bx0 = Math.min(bx0, x); bz0 = Math.min(bz0, z); bx1 = Math.max(bx1, x); bz1 = Math.max(bz1, z); }
    if (bx1 < x0 - 2 || bz1 < z0 - 2 || bx0 > x0 + W + 2 || bz0 > z0 + H + 2) continue;
    for (let j = Math.max(0, Math.floor(bz0 - z0 - 2)); j < Math.min(H, Math.ceil(bz1 - z0 + 2)); j++) {
      for (let i = Math.max(0, Math.floor(bx0 - x0 - 2)); i < Math.min(W, Math.ceil(bx1 - x0 + 2)); i++) {
        if (nearRing(x0 + i + 0.5, z0 + j + 0.5, ring, 1.5)) built[j * W + i] = 1;
      }
    }
  }

  // the canopy: the highest point over the ground in each free cell, and the lowest (for how ragged)
  const top = new Float32Array(W * H), low = new Float32Array(W * H).fill(Infinity), count = new Uint16Array(W * H);
  const bridge = new Uint8Array(W * H);
  for (let k = 0; k < pts.length; k += 4) {
    const c = cell(pts[k], pts[k + 1]);
    if (c >= 0 && pts[k + 3] === BRIDGE) bridge[c] = 1;
  }
  for (let k = 0; k < pts.length; k += 4) {
    const c = cell(pts[k], pts[k + 1]);
    if (c < 0 || pts[k + 3] !== 1 || built[c] || bridge[c] || water[c] || ground[c] < WATER_TOP) continue;
    const h = pts[k + 2] - ground[c];
    if (h < 1.5 || h > 32) continue;
    if (h > top[c]) top[c] = h;
    if (h < low[c]) low[c] = h;
    count[c]++;
  }

  // decks and roofs OpenStreetMap doesn't have, and what stands on them (lamps, masts, wires): wide
  // stretches of cells whose points lie flat, well above the ground, and the scan's bridges, and 3 m
  // round them
  const deck = new Uint8Array(W * H);
  {
    const flatHigh = new Uint8Array(W * H);
    for (let c = 0; c < W * H; c++) flatHigh[c] = count[c] >= 2 && low[c] >= 2.5 && top[c] - low[c] < 0.4 ? 1 : 0;
    const seen = new Uint8Array(W * H);
    for (let c0 = 0; c0 < W * H; c0++) {
      if (!flatHigh[c0] || seen[c0]) continue;
      const part = [c0];
      seen[c0] = 1;
      for (let q = 0; q < part.length; q++) {
        const c = part[q], i = c % W, j = (c - i) / W;
        // (diagonal and two-cell steps too: a deck's cells are not all hit)
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
          const ii = i + di, jj = j + dj, k = jj * W + ii;
          if (ii < 0 || jj < 0 || ii >= W || jj >= H || seen[k] || !flatHigh[k]) continue;
          seen[k] = 1;
          part.push(k);
        }
      }
      if (part.length < 40) continue;
      part.forEach((c) => { flatHigh[c] = 2; });
    }
    // and the scan's own bridges
    for (let c = 0; c < W * H; c++) {
      if (flatHigh[c] !== 2 && !bridge[c]) continue;
      const i = c % W, j = (c - i) / W;
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < W && jj < H) deck[jj * W + ii] = 1;
      }
    }
  }

  // the trees the scan shows: their crowns ragged, as the bare branches are
  const fromScan = crowns(top, W, H, (k) => top[k] - low[k], 1.0).filter((tr) => !deck[cell(x0 + tr.i, z0 + tr.j)]);
  let found = fromScan;
  // and those Google's mesh shows, in leaf and newer than the scan: green, and well over the
  // ground (its heights drift, so the ground is taken from the scan and the drift from the paved
  // ground round about)
  if (google) {
    const { pieces, files } = await fromDownload(google, [x0, z0, x0 + W, z0 + H]).catch((e) => {
      console.log(`  no mesh here (${(e as Error).message.slice(0, 80)})`);
      return { pieces: [], files: [] };
    });
    // (where the download has only the coarse tiles over the area, its green can't be trusted)
    const scraps = files.filter((f) => !existsSync(f)).length > files.length / 2;
    const { ray } = meshRays(pieces, [x0 - 3, z0 - 3, x0 + W + 3, z0 + H + 3]);
    const seenY = new Float32Array(W * H).fill(NaN), green = new Uint8Array(W * H);
    // the drift, in 20 m blocks: the mesh's paved ground against the scan's
    const B = 20, BW = Math.ceil(W / B), BH = Math.ceil(H / B), drifts: number[][] = Array.from({ length: BW * BH }, () => []);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const c = j * W + i;
      if (built[c] || water[c] || deck[c] || ground[c] < WATER_TOP) continue;
      const hit = ray([x0 + i + 0.5, 200, z0 + j + 0.5], [0, -1, 0], 260);
      if (!hit) continue;
      const [r, g, bl] = hit.rgb;
      seenY[c] = hit.y;
      green[c] = g >= Math.max(r, bl) && g - Math.min(r, bl) >= 6 ? 1 : 0;
      if (!green[c] && hit.flat > 0.95 && Math.abs(hit.y - ground[c]) < 6) drifts[Math.floor(j / B) * BW + Math.floor(i / B)].push(hit.y - ground[c]);
    }
    const all = drifts.flat(), off = all.length ? median(all) : 0;
    // each block's, from it and the blocks round it
    const blockOff = drifts.map((_, b) => {
      const bi = b % BW, bj = (b - bi) / BW, near: number[] = [];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = bi + di, jj = bj + dj;
        if (ii >= 0 && jj >= 0 && ii < BW && jj < BH) near.push(...drifts[jj * BW + ii]);
      }
      return near.length >= 20 ? median(near) : off;
    });
    const gtop = new Float32Array(W * H);
    for (let c = 0; c < W * H; c++) {
      if (!green[c] || Number.isNaN(seenY[c])) continue;
      const i = c % W, j = (c - i) / W;
      gtop[c] = Math.max(0, seenY[c] - blockOff[Math.floor(j / B) * BW + Math.floor(i / B)] - ground[c]);
    }
    // (young trees too: the mesh's green tells them from lamps)
    const fromMesh = scraps ? [] : crowns(gtop, W, H, null, 0, { minH: 3.5, minR: 1.0, minFull: 3 });
    console.log(`  ${pieces.length} pieces of Google's mesh (its heights ${off.toFixed(1)} m off the scan's): ${fromMesh.length} trees`);
    found = [...fromMesh, ...fromScan.filter((s) => !fromMesh.some((m) => Math.hypot(m.i - s.i, m.j - s.j) < Math.max(2.5, m.radius * 0.8)))];
  }
  for (const tr of found) trees.push([round(x0 + tr.i, 1), round(z0 + tr.j, 1), round(tr.h, 1), round(tr.radius, 1)]);
  console.log(`  ${fromScan.length} trees in the scan, ${found.length} in all`);
}

// a tree on two areas' edge is found twice
trees.sort((p, q) => q[2] - p[2]);
const unique = trees.filter((t, k) => !trees.slice(0, k).some((u) => Math.hypot(u[0] - t[0], u[1] - t[1]) < Math.max(2, u[3] * 0.6)));
unique.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
writeFileSync(OUT, `{
  "attribution": "Laserdata Nedladdning, skog © Lantmäteriet, CC BY 4.0 (processed: trees found in it)",
  "flown": ${JSON.stringify([...flights].sort())},
  "note": "Trees found in the laser scan by tools/find-trees.ts, in the areas drawn in detail (src/detail/areas.ts): world x, z, height above the ground and crown radius, in metres.",
  "trees": [
${unique.map((t) => `    ${JSON.stringify(t)}`).join(',\n')}
  ]
}
`);
console.log(`${OUT}: ${unique.length} trees`);

// The trees in a canopy (heights over the ground on a 1 m grid, W × H): each top at least `minH` up
// that is the highest within 2.5 m, its crown as far out as the canopy stays above half its height,
// the lower tops in a crown left out; kept if the crown is at least `minR` in radius with `minFull`
// m² of canopy, mostly filled, and (given `spreadOf`, how far a cell's points reach up and down)
// ragged on average by at least `ragged`. Positions in cells from the grid's corner, the crown's
// middle.
interface Crown { i: number; j: number; h: number; radius: number }
function crowns(top: Float32Array, W: number, H: number, spreadOf: ((k: number) => number) | null, ragged: number,
  { minH = 4.5, minR = 1.8, minFull = 10 } = {}): Crown[] {
  const tops: number[] = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const c = j * W + i, h = top[c];
    if (h < minH) continue;
    let best = true;
    for (let dj = -2; dj <= 2 && best; dj++) for (let di = -2; di <= 2; di++) {
      const ii = i + di, jj = j + dj;
      if ((di || dj) && ii >= 0 && jj >= 0 && ii < W && jj < H && di * di + dj * dj <= 6.25 && top[jj * W + ii] > h) { best = false; break; }
    }
    if (best) tops.push(c);
  }
  tops.sort((p, q) => top[q] - top[p]);
  const taken = new Uint8Array(W * H), out: Crown[] = [];
  for (const c of tops) {
    if (taken[c]) continue;
    const i0 = c % W, j0 = (c - i0) / W, h = top[c];
    // the crown's reach: out along 16 directions while the canopy stays above half the height
    let reach = 0;
    for (let d = 0; d < 16; d++) {
      const a = (d / 16) * Math.PI * 2;
      let r = 0;
      for (let s = 1; s <= 10; s++) {
        const ii = Math.round(i0 + Math.cos(a) * s), jj = Math.round(j0 + Math.sin(a) * s);
        if (ii < 0 || jj < 0 || ii >= W || jj >= H || top[jj * W + ii] < h / 2) break;
        r = s;
      }
      reach += r;
    }
    const radius = Math.min(9, reach / 16 + 0.5);
    // how full and how ragged the crown is, and its middle
    let cells = 0, full = 0, spread = 0, sx = 0, sz = 0, sw = 0;
    const R = Math.ceil(radius);
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      if (di * di + dj * dj > radius * radius) continue;
      const ii = i0 + di, jj = j0 + dj;
      if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      const k = jj * W + ii;
      cells++;
      if (top[k] >= h / 3) {
        full++;
        if (spreadOf) spread += spreadOf(k);
        const w = top[k] - h / 3;
        sx += (ii + 0.5) * w; sz += (jj + 0.5) * w; sw += w;
      }
    }
    // the crown's lower tops are this tree's
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const ii = i0 + di, jj = j0 + dj;
      if (ii >= 0 && jj >= 0 && ii < W && jj < H && di * di + dj * dj <= (radius * 0.8) ** 2) taken[jj * W + ii] = 1;
    }
    if (radius < minR || full < minFull || full < cells * 0.45) continue;
    // (a tall tree has a wide crown: a tall thin thing is a mast, a crane or a bridge's lamp)
    if (h > 20 && radius < h / 6) continue;
    if (spreadOf && spread / full < ragged) continue;
    out.push({ i: sx / sw, j: sz / sw, h, radius });
  }
  return out;
}

function median(a: number[]) { return [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)]; }
function round(v: number, d: number) { const f = 10 ** d; return Math.round(v * f) / f; }
// whether (x, z) is inside the ring or within d of its edge
function nearRing(x: number, z: number, ring: [number, number][], d: number) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    const dx = xj - xi, dz = zj - zi, l2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((x - xi) * dx + (z - zi) * dz) / l2));
    if (Math.hypot(x - xi - dx * u, z - zi - dz * u) < d) return true;
  }
  return c;
}
