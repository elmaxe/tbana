import * as THREE from 'three';
import { SurfaceIndex } from './surface-index.js';
import { extractCenterlines, sweep } from './polyline.js';
import { LINES, TRAIN_SPECS } from './lines.js';
import * as T from './textures.js';

// The source model is an extruded 2D drawing: floor slabs, stair ramps, escalator tubes,
// lift shafts, ticket gates and tracks, each identified only by its colour. This module turns
// it into a walkable station: classifies every piece, builds walls/railings/platform edges,
// track beds and tunnels, and indexes every walkable surface.

const PALETTE = [
  ['track:blue', [0.0018, 0.2874, 0.6445]],
  ['track:red', [0.7913, 0.013, 0.0194]],
  ['track:green', [0.013, 0.4452, 0.1022]],
  ['track:pink', [0.8879, 0.1329, 0.3813]],
  ['track:tram', [0.2195, 0.2346, 0.2159]],
  ['track:main', [0.3771, 0.4195, 0.8]],
  ['floor', [0.7084, 0.7084, 0.7682]],
  ['floor', [0.84, 0.84, 0.84]],
  ['floor', [0.9, 0.86, 0.83]],
  ['stairs', [0.9, 0.77, 0.68]],
  ['lightblue', [0.67, 0.78, 1.0]],
  ['gates', [1.0, 0.6, 0.0]],
];

function classifyColor(c) {
  let best = 'deco', bestD = 0.02;
  for (const [kind, rgb] of PALETTE) {
    const d = (c.r - rgb[0]) ** 2 + (c.g - rgb[1]) ** 2 + (c.b - rgb[2]) ** 2;
    if (d < bestD) { bestD = d; best = kind; }
  }
  return best;
}

class Builder {
  constructor() { this.pos = []; this.uv = []; this.col = []; }
  tri(a, b, c, uva, uvb, uvc, color) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.uv.push(uva[0], uva[1], uvb[0], uvb[1], uvc[0], uvc[1]);
    if (color) for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
  }
  quad(a, b, c, d, ua, ub, uc, ud, color) {
    this.tri(a, b, c, ua, ub, uc, color);
    this.tri(a, c, d, ua, uc, ud, color);
  }
  get empty() { return this.pos.length === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildStation(root) {
  const group = new THREE.Group();
  const mapGroup = new THREE.Group(); // simplified flat-shaded copy for the minimap
  const walk = new SurfaceIndex(4);
  const trackIdx = new SurfaceIndex(4);
  const records = [];

  // ---------------------------------------------------------------- 1. read & classify
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    g.applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    const color = o.material?.color ? o.material.color.clone() : new THREE.Color(0.6, 0.6, 0.6);
    let kind = classifyColor(color);
    g.computeBoundingBox();
    const box = g.boundingBox.clone();
    const size = box.getSize(new THREE.Vector3());
    if (kind === 'lightblue') kind = Math.max(size.x, size.z) < 5.5 && size.y > 5 ? 'elevator' : 'tube';
    const rec = { name: o.name, kind, color, box, size, top: [], side: [], bottom: [], all: [] };
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i += 3) {
      const tri = [0, 1, 2].map((k) => V(p.getX(i + k), p.getY(i + k), p.getZ(i + k)));
      const ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
      rec.all.push(tri);
      (ny > 0.35 ? rec.top : ny < -0.35 ? rec.bottom : rec.side).push(tri);
    }
    // Guard against inverted normals: the "top" faces must be the higher ones.
    const meanY = (ts) => ts.reduce((s, t) => s + t[0].y + t[1].y + t[2].y, 0) / (3 * ts.length || 1);
    if (rec.top.length && rec.bottom.length && meanY(rec.top) < meanY(rec.bottom)) {
      [rec.top, rec.bottom] = [rec.bottom, rec.top];
    }
    records.push(rec);
  });

  // ---------------------------------------------------------------- 2. surfaces
  const B = {
    floorTop: new Builder(), slabSide: new Builder(), slabBottom: new Builder(),
    stairTop: new Builder(), tubeGlass: new Builder(), tubeFloor: new Builder(),
    elevator: new Builder(), gates: new Builder(), deco: new Builder(),
  };
  const mapB = { floors: new Builder() };
  const lineMap = {};
  const planar = (p) => [p.x / 2, p.z / 2];
  const sideUV = (p) => [(p.x + p.z) / 2, p.y / 2];
  const darker = (c, k) => c.clone().multiplyScalar(k);

  const rampUV = (tris, stepsPerMetre) => {
    // Treads run perpendicular to the steepest-descent direction.
    const n = new THREE.Vector3();
    for (const t of tris) {
      n.add(new THREE.Vector3().subVectors(t[1], t[0]).cross(new THREE.Vector3().subVectors(t[2], t[0])));
    }
    const d = new THREE.Vector2(n.x, n.z);
    if (d.lengthSq() < 1e-9) d.set(1, 0);
    d.normalize();
    return (p) => [(p.x * -d.y + p.z * d.x) / 2, (p.x * d.x + p.z * d.y) * stepsPerMetre];
  };

  const trackComponents = [];
  const elevators = [];

  for (const rec of records) {
    const c = rec.color;
    switch (rec.kind) {
      case 'floor':
      case 'stairs': {
        const top = rec.kind === 'floor' ? B.floorTop : B.stairTop;
        const uv = rec.kind === 'floor' ? planar : rampUV(rec.top, 1 / 2.4);
        for (const t of rec.top) {
          top.tri(t[0], t[1], t[2], uv(t[0]), uv(t[1]), uv(t[2]), c);
          walk.add(t[0], t[1], t[2], { kind: rec.kind, rec });
          mapB.floors.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0], darker(c, rec.kind === 'floor' ? 0.62 : 0.8));
        }
        for (const t of rec.side) B.slabSide.tri(t[0], t[1], t[2], sideUV(t[0]), sideUV(t[1]), sideUV(t[2]), darker(c, 0.8));
        for (const t of rec.bottom) B.slabBottom.tri(t[0], t[1], t[2], planar(t[0]), planar(t[1]), planar(t[2]), darker(c, 0.55));
        break;
      }
      case 'tube': {
        // Escalator drawn as a solid volume: walk on its floor (bottom face + 1 m) inside a glass tube.
        for (const t of rec.all) B.tubeGlass.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0]);
        const uv = rampUV(rec.bottom, 1 / 2.4);
        for (const t of rec.bottom) {
          const s = t.map((v) => v.clone().setY(v.y + 1));
          B.tubeFloor.tri(s[0], s[1], s[2], uv(s[0]), uv(s[1]), uv(s[2]));
          walk.add(s[0], s[1], s[2], { kind: 'escalator', rec });
        }
        for (const t of rec.top) mapB.floors.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0], c);
        break;
      }
      case 'elevator': {
        for (const t of rec.all) B.elevator.tri(t[0], t[1], t[2], sideUV(t[0]), sideUV(t[1]), sideUV(t[2]));
        for (const t of rec.top) mapB.floors.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0], c);
        elevators.push(rec);
        break;
      }
      case 'gates':
        for (const t of rec.all) B.gates.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0]);
        for (const t of rec.top) mapB.floors.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0], c);
        break;
      case 'deco':
        for (const t of rec.all) B.deco.tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0], c);
        break;
      default: {
        if (!rec.kind.startsWith('track:')) break;
        const line = rec.kind.slice(6);
        rec.line = line;
        (lineMap[line] ||= new Builder());
        for (const t of rec.top) {
          trackIdx.add(t[0], t[1], t[2], { line });
          lineMap[line].tri(t[0], t[1], t[2], [0, 0], [0, 0], [0, 0]);
        }
        for (const comp of splitComponents(rec.top)) trackComponents.push({ line, tris: comp });
      }
    }
  }

  const tex = {
    floor: T.floorTiles(), stairs: T.stairTreads(), escalator: T.escalatorSteps(),
    wall: T.wallTiles(), cave: T.caveVines(), concrete: T.concrete(), rock: T.tunnelRock(), bed: T.trackBed(),
  };
  const mats = {
    floorTop: new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.floor, roughness: 0.55, metalness: 0.0 }),
    slabSide: new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.concrete, roughness: 0.9, side: THREE.DoubleSide }),
    slabBottom: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    stairTop: new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.stairs, roughness: 0.7 }),
    tubeGlass: new THREE.MeshStandardMaterial({
      color: 0xaecbff, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1,
      side: THREE.DoubleSide, depthWrite: false,
    }),
    tubeFloor: new THREE.MeshStandardMaterial({ map: tex.escalator, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }),
    elevator: new THREE.MeshStandardMaterial({
      color: 0x9fc0ff, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.2,
      emissive: 0x1d3b6e, emissiveIntensity: 0.6, side: THREE.DoubleSide,
    }),
    gates: new THREE.MeshStandardMaterial({ color: 0xffa21a, roughness: 0.5, metalness: 0.3 }),
    deco: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
    wall: new THREE.MeshStandardMaterial({ map: tex.wall, roughness: 0.45, side: THREE.DoubleSide }),
    cave: new THREE.MeshStandardMaterial({ map: tex.cave, roughness: 0.85, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xcfe6ff, transparent: true, opacity: 0.18, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false,
    }),
    handrail: new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 0.3, metalness: 0.8, side: THREE.DoubleSide }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
    bed: new THREE.MeshStandardMaterial({ map: tex.bed, roughness: 1 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x8d9399, roughness: 0.3, metalness: 0.9 }),
    tunnel: new THREE.MeshStandardMaterial({ map: tex.rock, roughness: 1, side: THREE.DoubleSide }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff7e6 }),
    tunnelLamp: new THREE.MeshBasicMaterial({ color: 0xffd48a }),
  };

  const addMesh = (builder, mat, opts = {}) => {
    if (builder.empty) return null;
    const m = new THREE.Mesh(builder.build(), mat);
    if (opts.renderOrder) m.renderOrder = opts.renderOrder;
    group.add(m);
    return m;
  };
  for (const k of ['floorTop', 'slabSide', 'slabBottom', 'stairTop', 'tubeFloor', 'gates', 'deco']) addMesh(B[k], mats[k]);
  addMesh(B.elevator, mats.elevator, { renderOrder: 2 });
  addMesh(B.tubeGlass, mats.tubeGlass, { renderOrder: 3 });

  // Minimap copy: flat colours, original track ribbons in line colours.
  const mapFloor = new THREE.Mesh(mapB.floors.build(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mapGroup.add(mapFloor);
  for (const [line, b] of Object.entries(lineMap)) {
    const m = new THREE.Mesh(b.build(), new THREE.MeshBasicMaterial({ color: LINES[line].color, side: THREE.DoubleSide }));
    m.position.y = 3; // keep tracks visible on top of floors in the top-down view
    m.renderOrder = 1;
    mapGroup.add(m);
  }

  // ---------------------------------------------------------------- 3. tracks
  const tracks = [];
  const hits = [];
  for (const comp of trackComponents) {
    for (const pl of extractCenterlines(comp.tris)) {
      tracks.push(analyseTrack(pl, comp.line, walk, hits));
    }
  }
  assignDirections(tracks);

  const bedB = new Builder(), railGeoms = [], tunnelGeoms = [], caveGeoms = [], trackWallGeoms = [], lampB = new Builder(), tunnelLampB = new Builder();
  const signs = [];
  for (const tr of tracks) {
    const spec = TRAIN_SPECS[LINES[tr.line].kind];
    const pts = tr.path.resample(0, tr.path.length, 2);
    const bedHalf = spec.halfWidth + 0.9;
    railGeoms.push(sweep(pts.map((p) => p.clone().setY(p.y - 1.15)), [[-bedHalf, 0], [bedHalf, 0]], { uScale: 0.25, vScale: 0.25 }));
    for (const g of [-0.72, 0.72]) {
      railGeoms.push(sweep(pts.map((p) => p.clone().setY(p.y - 1.15)), [[g - 0.04, 0], [g - 0.04, 0.16], [g + 0.04, 0.16], [g + 0.04, 0]]));
      railGeoms[railGeoms.length - 1].userData.rail = true;
    }
    const underground = LINES[tr.line].kind === 'metro' || LINES[tr.line].kind === 'commuter';
    if (tr.platform && !underground) addPlatformFurniture(tr, spec, lampB, signs);
    if (tr.platform && underground) {
      const W = spec.halfWidth + 1.15;
      const prof = [[-W, -1.25], [-W, 2.4]];
      for (let i = 1; i < 12; i++) {
        const a = Math.PI - (i / 12) * Math.PI;
        prof.push([Math.cos(a) * W, 2.4 + Math.sin(a) * W * 0.8]);
      }
      prof.push([W, 2.4], [W, -1.25]);
      const { s0, s1 } = tr.platform;
      const ranges = [[0, s0 - 6], [s1 + 6, tr.path.length]];
      for (const [a, b] of ranges) {
        if (b - a < 4) continue;
        const seg = tr.path.resample(a, b, 2);
        tunnelGeoms.push(sweep(seg, prof, { uScale: 0.15, vScale: 0.15 }));
        // small lamps along the tunnel wall
        for (let s = a + 6; s < b; s += 22) {
          const p = tr.path.pointAt(s), r = tr.path.rightAt(s);
          const q = p.clone().addScaledVector(r, -(W - 0.05)).setY(p.y + 2.2);
          boxInto(tunnelLampB, q, 0.12, 0.25, 0.12);
        }
      }
      // Rock / tiled wall behind the track, curving over towards the platform.
      const far = -tr.platform.side * W, k = tr.platform.side;
      const farClear = !neighbourBeyond(tr, -tr.platform.side, W, walk, trackIdx, hits);
      const wallProf = [[far, -1.25], [far, 3.0], [far + k * 0.7, 4.2], [far + k * 1.9, 5.1], [far + k * 3.6, 5.6]];
      const run = tr.path.resample(Math.max(0, s0 - 6), Math.min(tr.path.length, s1 + 6), 2);
      const blue = tr.line === 'blue';
      if (farClear) (blue ? caveGeoms : trackWallGeoms).push(sweep(run, wallProf, { uScale: blue ? 0.2 : 0.5, vScale: blue ? 0.2 : 0.5, swapUV: true }));
      addPlatformFurniture(tr, spec, lampB, signs);
    }
  }
  if (!bedB.empty) addMesh(bedB, mats.bed);
  for (const g of railGeoms) {
    const m = new THREE.Mesh(g, g.userData.rail ? mats.rail : mats.bed);
    group.add(m);
  }
  for (const g of tunnelGeoms) group.add(new THREE.Mesh(g, mats.tunnel));
  for (const g of caveGeoms) group.add(new THREE.Mesh(g, mats.cave));
  for (const g of trackWallGeoms) group.add(new THREE.Mesh(g, mats.wall));
  addMesh(lampB, mats.lamp);
  addMesh(tunnelLampB, mats.tunnelLamp);
  for (const s of signs) group.add(s);

  // ---------------------------------------------------------------- 4. walls, railings, platform edges
  const W = buildEdges(records, walk, trackIdx);
  addMesh(W.wall, mats.wall);
  addMesh(W.cave, mats.cave);
  addMesh(W.handrail, mats.handrail);
  addMesh(W.yellow, mats.yellow);
  addMesh(W.glass, mats.glass, { renderOrder: 4 });

  // ---------------------------------------------------------------- 5. lifts
  const lifts = buildLifts(elevators, walk, hits);

  // ---------------------------------------------------------------- 6. labels, spawn, teleports
  const LABEL = { blue: 'Blue line', red: 'Red line', green: 'Green line', pink: 'Pendeltåg', main: 'Stockholm C', tram: 'Tram 7' };
  for (const rec of records) {
    if (rec.platformLines) {
      const ls = [...rec.platformLines].sort((a, b) => Object.keys(LABEL).indexOf(a) - Object.keys(LABEL).indexOf(b));
      const nums = ls.flatMap((l) => LINES[l].numbers);
      const names = ls.map((l) => LABEL[l]);
      rec.label = (names.length > 1 ? names.map((n) => n.replace(' line', '')).join('/') + ' line' : names[0]) + ' platform'
        + (nums.length ? ` · ${nums.join(' ')}` : '');
    } else if (rec.kind === 'stairs') rec.label = 'Stairs';
    else if (rec.kind === 'tube') rec.label = 'Escalator';
    else rec.label = 'Concourse';
  }

  const teleports = [];
  const seen = new Set();
  for (const tr of tracks) {
    if (!tr.platform || seen.has(tr.platform.rec)) continue;
    seen.add(tr.platform.rec);
    const spot = platformSpot(tr, walk, hits, lifts);
    if (spot) teleports.push({ label: tr.platform.rec.label, line: tr.line, ...spot });
  }
  const order = ['blue', 'red', 'green', 'pink', 'main', 'tram'];
  teleports.sort((a, b) => order.indexOf(a.line) - order.indexOf(b.line) || b.pos.y - a.pos.y);
  const dupes = new Map();
  for (const t of teleports) dupes.set(t.label, [...(dupes.get(t.label) || []), t]);
  for (const list of dupes.values()) {
    if (list.length !== 2) continue;
    const [a, b] = list;
    const dy = a.pos.y - b.pos.y, dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z;
    let names;
    if (Math.abs(dy) > 1) names = dy > 0 ? ['upper', 'lower'] : ['lower', 'upper'];
    else if (Math.abs(dx) > Math.abs(dz)) names = dx < 0 ? ['west', 'east'] : ['east', 'west'];
    else names = dz < 0 ? ['north', 'south'] : ['south', 'north'];
    a.label += ` (${names[0]})`; b.label += ` (${names[1]})`;
  }
  const spawn = teleports.find((t) => t.line === 'blue') || teleports[0];

  const bounds = new THREE.Box3();
  for (const r of records) bounds.union(r.box);

  return { group, mapGroup, walk, trackIdx, tracks, lifts, teleports, spawn, bounds, records };
}

// ------------------------------------------------------------------ helpers

function boxInto(b, c, hx, hy, hz) {
  const p = (x, y, z) => V(c.x + x, c.y + y, c.z + z);
  const f = [
    [p(-hx, -hy, hz), p(hx, -hy, hz), p(hx, hy, hz), p(-hx, hy, hz)],
    [p(hx, -hy, -hz), p(-hx, -hy, -hz), p(-hx, hy, -hz), p(hx, hy, -hz)],
    [p(-hx, -hy, -hz), p(-hx, -hy, hz), p(-hx, hy, hz), p(-hx, hy, -hz)],
    [p(hx, -hy, hz), p(hx, -hy, -hz), p(hx, hy, -hz), p(hx, hy, hz)],
    [p(-hx, hy, hz), p(hx, hy, hz), p(hx, hy, -hz), p(-hx, hy, -hz)],
    [p(-hx, -hy, -hz), p(hx, -hy, -hz), p(hx, -hy, hz), p(-hx, -hy, hz)],
  ];
  for (const q of f) b.quad(q[0], q[1], q[2], q[3], [0, 0], [1, 0], [1, 1], [0, 1]);
}

const vkey = (v) => `${Math.round(v.x * 100)},${Math.round(v.y * 100)},${Math.round(v.z * 100)}`;

function splitComponents(tris) {
  const id = new Map();
  const parent = [];
  const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const vid = (v) => {
    const k = vkey(v);
    if (!id.has(k)) { id.set(k, parent.length); parent.push(parent.length); }
    return id.get(k);
  };
  const tv = tris.map((t) => t.map(vid));
  for (const [a, b, c] of tv) { parent[find(b)] = find(a); parent[find(c)] = find(a); }
  const comps = new Map();
  tris.forEach((t, i) => {
    const r = find(tv[i][0]);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r).push(t);
  });
  return [...comps.values()];
}

// Finds the platform alongside a track and shifts the track so a train's side meets the platform edge.
function analyseTrack(path, line, walk, hits) {
  const spec = TRAIN_SPECS[LINES[line].kind];
  const step = 2;
  const samples = [];
  const p = new THREE.Vector3(), r = new THREE.Vector3();
  for (let s = 0; s <= path.length; s += step) {
    path.pointAt(s, p); path.rightAt(s, r);
    let found = null;
    for (const side of [1, -1]) {
      for (let d = 0.3; d <= 4.8 && !found; d += 0.3) {
        walk.query(p.x + r.x * side * d, p.z + r.z * side * d, hits);
        const h = hits.find((q) => q.data.kind === 'floor' && Math.abs(q.y - p.y) < 0.9);
        if (h) found = { s, side, d, rec: h.data.rec };
      }
      if (found) break;
    }
    samples.push(found);
  }
  // Dominant side, then the longest run of samples with a platform on that side (small gaps allowed).
  const count = { 1: 0, '-1': 0 };
  for (const f of samples) if (f) count[f.side]++;
  const side = count[1] >= count[-1] ? 1 : -1;
  let best = null, cur = null, gap = 0;
  samples.forEach((f, i) => {
    if (f && f.side === side) {
      if (!cur) cur = { i0: i, i1: i, items: [] };
      cur.i1 = i; cur.items.push(f); gap = 0;
    } else if (cur && ++gap > 3) {
      if (!best || cur.items.length > best.items.length) best = cur;
      cur = null; gap = 0;
    }
  });
  if (cur && (!best || cur.items.length > best.items.length)) best = cur;

  const track = { line, path, platform: null, dir: 1 };
  if (best && (best.i1 - best.i0) * step >= 40) {
    const ds = best.items.map((f) => f.d).sort((a, b) => a - b);
    const edge = ds[ds.length >> 1] - 0.15;
    const recCount = new Map();
    for (const f of best.items) recCount.set(f.rec, (recCount.get(f.rec) || 0) + 1);
    const rec = [...recCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
    rec.platformLine ||= line;
    (rec.platformLines ||= new Set()).add(line);
    track.path = path.offset(side * (edge - 0.12 - spec.halfWidth));
    track.platform = { s0: best.i0 * step, s1: best.i1 * step, side, rec };
  }
  return track;
}

// Running directions. Two tracks of the same line at one island platform run opposite ways
// (Stockholm keeps left, so the platform is on each train's right). Where different lines share
// a platform (red/green), both run the same way for cross-platform interchange.
function assignDirections(tracks) {
  const groups = new Map();
  for (const tr of tracks) {
    if (!tr.platform) continue;
    const k = tr.platform.rec;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(tr);
  }
  const southboundLevels = [];
  for (const [rec, list] of groups) {
    const lines = new Set(list.map((t) => t.line));
    if (lines.size === 1) {
      for (const tr of list) tr.dir = tr.platform.side;
    } else {
      southboundLevels.push({ rec, list, y: rec.box.max.y });
    }
  }
  // Mixed-line platforms: the higher one southbound (+z), the next one northbound, and so on.
  southboundLevels.sort((a, b) => b.y - a.y);
  southboundLevels.forEach(({ list }, i) => {
    const south = i % 2 === 0;
    for (const tr of list) {
      const t = tr.path.tangentAt((tr.platform.s0 + tr.platform.s1) / 2);
      tr.dir = (t.z > 0) === south ? 1 : -1;
    }
  });
}

// Is there another track or a floor just beyond the far side of this track (so no wall belongs there)?
function neighbourBeyond(tr, dirSign, W, walk, trackIdx, hits) {
  const p = new THREE.Vector3(), r = new THREE.Vector3();
  const { s0, s1 } = tr.platform;
  let found = 0, total = 0;
  for (let s = s0; s <= s1; s += 6) {
    tr.path.pointAt(s, p); tr.path.rightAt(s, r);
    total++;
    for (let d = W - 1.2; d <= W + 4; d += 0.4) {
      const x = p.x + r.x * dirSign * d, z = p.z + r.z * dirSign * d;
      trackIdx.query(x, z, hits);
      let hit = hits.some((q) => Math.abs(q.y - p.y) < 1.5);
      if (!hit) { walk.query(x, z, hits); hit = hits.some((q) => Math.abs(q.y - p.y) < 1.5); }
      if (hit) { found++; break; }
    }
  }
  return found > total * 0.25;
}

function addPlatformFurniture(tr, spec, lampB, signs) {
  const L = LINES[tr.line];
  const { s0, s1, side } = tr.platform;
  const edgeOff = side * (spec.halfWidth + 0.12);
  const p = new THREE.Vector3(), r = new THREE.Vector3(), t = new THREE.Vector3();

  // Fluorescent light strip above the platform edge.
  for (let s = s0 + 3; s < s1 - 3; s += 3.2) {
    tr.path.pointAt(s, p); tr.path.rightAt(s, r);
    const c = p.clone().addScaledVector(r, edgeOff + side * 2.4).setY(p.y + 3.45);
    tr.path.tangentAt(s, t);
    const ang = Math.atan2(t.x, t.z);
    // oriented box approximated by a rotated thin quad pair
    const a = c.clone().addScaledVector(t, -1.4), b = c.clone().addScaledVector(t, 1.4);
    const w = r.clone().multiplyScalar(0.09);
    lampB.quad(a.clone().sub(w), b.clone().sub(w), b.clone().add(w), a.clone().add(w), [0, 0], [1, 0], [1, 1], [0, 1]);
    void ang;
  }

  // Station name signs facing the track.
  const signTex = T.nameSign(L.sign, L.signBg);
  const signMat = new THREE.MeshBasicMaterial({ map: signTex });
  const signGeo = new THREE.PlaneGeometry(3.6, 0.68);
  const backGeo = signGeo.clone().rotateY(Math.PI);
  const len = s1 - s0;
  const nSigns = Math.max(2, Math.floor(len / 38));
  for (let i = 0; i < nSigns; i++) {
    const s = s0 + ((i + 0.5) / nSigns) * len;
    tr.path.pointAt(s, p); tr.path.rightAt(s, r);
    const m = new THREE.Group();
    m.add(new THREE.Mesh(signGeo, signMat), new THREE.Mesh(backGeo, signMat));
    m.position.copy(p).addScaledVector(r, edgeOff + side * 0.9).setY(p.y + 2.75);
    m.lookAt(m.position.clone().addScaledVector(r, -side));
    signs.push(m);
  }

  if (!L.dest) return;
  // Departure board (texture updated by the train system).
  const can = document.createElement('canvas');
  can.width = 512; can.height = 128;
  const btex = new THREE.CanvasTexture(can);
  btex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: btex }));
  const back = face.clone(); back.rotation.y = Math.PI;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.72, 0.1), new THREE.MeshStandardMaterial({ color: 0x23272d }));
  face.position.z = 0.06; back.position.z = -0.06;
  board.add(frame, face, back);
  const sm = (s0 + s1) / 2 + (tr.dir > 0 ? 1 : -1) * len * 0.18;
  tr.path.pointAt(sm, p); tr.path.rightAt(sm, r); tr.path.tangentAt(sm, t);
  board.position.copy(p).addScaledVector(r, edgeOff + side * 3.2).setY(p.y + 3.0);
  board.lookAt(board.position.clone().addScaledVector(t, 1));
  signs.push(board);
  tr.board = { canvas: can, texture: btex, text: '' };
}

// Builds walls, glass railings and yellow safety lines along the outline of every walkable slab.
function buildEdges(records, walk, trackIdx) {
  const out = { wall: new Builder(), cave: new Builder(), glass: new Builder(), handrail: new Builder(), yellow: new Builder() };
  const hits = [];
  const OPEN = 0, PLATFORM = 1, RAILING = 2, WALL = 3;

  const classify = (x, y, z, nx, nz) => {
    for (const d of [0.2, 0.55, 0.9]) {
      walk.query(x + nx * d, z + nz * d, hits);
      if (hits.some((q) => Math.abs(q.y - y) < 0.7)) return OPEN;
    }
    for (const d of [0.3, 0.8, 1.4, 2.2, 3.2]) {
      trackIdx.query(x + nx * d, z + nz * d, hits);
      if (hits.some((q) => y - q.y > -0.4 && y - q.y < 1.8)) return PLATFORM;
    }
    walk.query(x + nx * 1.2, z + nz * 1.2, hits);
    if (hits.some((q) => q.y < y - 0.7 && q.y > y - 30)) return RAILING;
    return WALL;
  };
  const headroom = (x, y, z) => {
    walk.query(x, z, hits);
    let h = 4.2;
    for (const q of hits) if (q.y > y + 1.6) h = Math.min(h, q.y - 1.0 - y - 0.03);
    return Math.max(1.2, h);
  };

  for (const rec of records) {
    if (rec.kind !== 'floor' && rec.kind !== 'stairs') continue;
    const edges = new Map();
    for (const t of rec.top) {
      for (let e = 0; e < 3; e++) {
        const a = t[e], b = t[(e + 1) % 3], c = t[(e + 2) % 3];
        const ka = vkey(a), kb = vkey(b);
        const k = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        const en = edges.get(k);
        if (en) en.n++; else edges.set(k, { a, b, c, n: 1 });
      }
    }
    const wallB = rec.platformLine === 'blue' ? out.cave : out.wall;
    // Open-air platforms (Stockholm C, tram stop) get railings instead of walls.
    const outdoor = rec.platformLines && (rec.platformLines.has('main') || rec.platformLines.has('tram'));
    // Stairwell walls stop at balustrade height above the top landing.
    const capY = rec.kind === 'stairs' ? rec.box.max.y + 1.1 : Infinity;
    const uvScale = rec.platformLine === 'blue' ? 1 / 5 : 1 / 2;
    for (const { a, b, c, n } of edges.values()) {
      if (n !== 1) continue;
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      let nx = dz / len, nz = -dx / len;
      if ((c.x - (a.x + b.x) / 2) * nx + (c.z - (a.z + b.z) / 2) * nz > 0) { nx = -nx; nz = -nz; }
      const segs = Math.max(1, Math.ceil(len / 1.0));
      const at = (t) => new THREE.Vector3().lerpVectors(a, b, t);
      const runs = [];
      for (let i = 0; i < segs; i++) {
        const t0 = i / segs, t1 = (i + 1) / segs, m = at((t0 + t1) / 2);
        let type = classify(m.x, m.y, m.z, nx, nz);
        if (type === WALL && outdoor) type = RAILING;
        const h = type === WALL ? headroom(m.x - nx * 0.3, m.y, m.z - nz * 0.3) : 0;
        const last = runs[runs.length - 1];
        if (last && last.type === type && Math.abs(last.h - h) < 0.3) { last.t1 = t1; last.h = Math.min(last.h, h); }
        else runs.push({ type, t0, t1, h });
      }
      for (const run of runs) {
        const p0 = at(run.t0), p1 = at(run.t1);
        const u0 = run.t0 * len, u1 = run.t1 * len;
        if (run.type === WALL) {
          const top = (p) => p.y + Math.max(1.05, Math.min(run.h, capY - p.y));
          const t0 = top(p0), t1 = top(p1);
          wallB.quad(p0, p1, p1.clone().setY(t1), p0.clone().setY(t0),
            [u0 * uvScale, p0.y * uvScale], [u1 * uvScale, p1.y * uvScale],
            [u1 * uvScale, t1 * uvScale], [u0 * uvScale, t0 * uvScale]);
        } else if (run.type === RAILING) {
          const up = (p, h) => p.clone().setY(p.y + h);
          out.glass.quad(p0, p1, up(p1, 1.05), up(p0, 1.05), [0, 0], [1, 0], [1, 1], [0, 1]);
          // handrail: small horizontal + vertical strip
          const o = new THREE.Vector3(nx * 0.04, 0, nz * 0.04);
          out.handrail.quad(up(p0, 1.05).sub(o), up(p1, 1.05).sub(o), up(p1, 1.05).add(o), up(p0, 1.05).add(o), [0, 0], [1, 0], [1, 1], [0, 1]);
          out.handrail.quad(up(p0, 0.98), up(p1, 0.98), up(p1, 1.1), up(p0, 1.1), [0, 0], [1, 0], [1, 1], [0, 1]);
        } else if (run.type === PLATFORM) {
          const i0 = new THREE.Vector3(-nx * 0.55, 0.012, -nz * 0.55), i1 = new THREE.Vector3(-nx * 0.72, 0.012, -nz * 0.72);
          out.yellow.quad(p0.clone().add(i0), p1.clone().add(i0), p1.clone().add(i1), p0.clone().add(i1), [0, 0], [1, 0], [1, 1], [0, 1]);
        }
      }
    }
  }
  return out;
}

// Groups the floors around each lift shaft into stops.
function buildLifts(elevators, walk, hits) {
  const lifts = [];
  for (const rec of elevators) {
    const c = rec.box.getCenter(new THREE.Vector3());
    const rad = Math.max(rec.size.x, rec.size.z) / 2;
    const found = [];
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      for (const d of [0.9, 1.6, 2.6]) {
        const x = c.x + Math.cos(a) * (rad + d), z = c.z + Math.sin(a) * (rad + d);
        walk.query(x, z, hits);
        for (const q of hits) {
          if (q.data.kind !== 'floor' || q.y < rec.box.min.y - 0.3 || q.y > rec.box.max.y + 0.3) continue;
          found.push({ y: q.y, pos: new THREE.Vector3(x, q.y, z), d });
        }
      }
    }
    found.sort((a, b) => a.y - b.y);
    const levels = [];
    for (const f of found) {
      const last = levels[levels.length - 1];
      if (last && Math.abs(last.y - f.y) < 0.8) { if (f.d < last.d) Object.assign(last, f); }
      else levels.push({ ...f });
    }
    if (levels.length >= 2) {
      lifts.push({
        center: c, radius: rad, minY: rec.box.min.y, maxY: rec.box.max.y,
        levels: levels.map((l) => ({ y: l.y, pos: l.pos, yaw: Math.atan2(-(l.pos.x - c.x), -(l.pos.z - c.z)) })),
      });
    }
  }
  return lifts;
}

function platformSpot(tr, walk, hits, lifts) {
  const spec = TRAIN_SPECS[LINES[tr.line].kind];
  const { s0, s1, side } = tr.platform;
  const p = new THREE.Vector3(), r = new THREE.Vector3(), t = new THREE.Vector3();
  for (const f of [0.5, 0.4, 0.6, 0.3, 0.7]) {
    const s = s0 + (s1 - s0) * f;
    tr.path.pointAt(s, p); tr.path.rightAt(s, r); tr.path.tangentAt(s, t);
    for (const d of [3, 2, 4, 1.5]) {
      const x = p.x + r.x * side * (spec.halfWidth + d), z = p.z + r.z * side * (spec.halfWidth + d);
      if (lifts.some((l) => Math.hypot(x - l.center.x, z - l.center.z) < l.radius + 1.5 && p.y > l.minY - 1 && p.y < l.maxY + 1)) continue;
      walk.query(x, z, hits);
      const h = hits.find((q) => Math.abs(q.y - p.y) < 0.9);
      if (h) {
        return { pos: new THREE.Vector3(x, h.y, z), yaw: Math.atan2(-t.x, -t.z) };
      }
    }
  }
  return null;
}
