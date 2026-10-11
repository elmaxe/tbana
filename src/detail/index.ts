import * as THREE from 'three';
import type { Building } from '../city-tile.ts';
import { Builder, type V2 } from './builder.ts';
import { buildFacades } from './facades.ts';
import { buildCentralbron, buildMetroBridge, buildPortals, buildRailway, buildSouthEnd, buildStation, stationOutline } from './gamla-stan.ts';
import { buildKonserthuset, konserthusetOutline } from './konserthuset.ts';
import { HOTORGSCITY_WEST } from './hotorgscity.ts';
import { KUNGSTORNEN } from './kungstornen.ts';
import { PUB } from './pub.ts';
import { detailMaterial } from './materials.ts';
import { buildCycleBridge, buildGuldbron, buildKatarinahissen, buildMalartrappan, buildVattentorget, KATARINAHISSEN_OUTLINE, MALARTRAPPAN_OUTLINE } from './slussen.ts';
import { inDetailArea } from './areas.ts';
import { buildChimney, buildLidingobron, buildLillaLidingobron, buildRopstensplan, buildTramStop, buildVarmeverk, CHIMNEYS, ENERGIHAMNEN_TANKS, LIDINGOBRON_PARTS, LILLA_LIDINGOBRON_PARTS, VVR_OUTLINE } from './ropsten.ts';
import { buildStreets, type TileStreets } from './streets.ts';
import { buildTower, TOWERS } from './towers.ts';

// The city in detail near the camera, in the areas of src/detail/areas.ts:
// landmarks built by hand in place of the city's plain blocks of them, and the other buildings'
// facades with real windows, shop fronts and cornices (src/detail/facades.ts), and the streets,
// squares and trees (src/detail/streets.ts). A tile drawn at full resolution (near the camera) gets
// them; further off it keeps its plain blocks.

// ?nodetail: the plain city everywhere, to compare
export const DETAIL_ON = typeof location === 'undefined' || !new URLSearchParams(location.search).has('nodetail');

interface Landmark { name: string; outline: V2[]; anchor: V2; build: (B: Builder, ground: (x: number, z: number) => number | null) => void }
const LANDMARKS: Landmark[] = [
  { name: 'Konserthuset', outline: konserthusetOutline(), anchor: [230, -395], build: buildKonserthuset },
  ...TOWERS.map((t, i): Landmark => ({ name: `Hötorget tower ${i + 1}`, outline: t.outline, anchor: t.at, build: (B) => buildTower(B, t.tower) })),
  ...KUNGSTORNEN,
  HOTORGSCITY_WEST,
  PUB,
  // Gamla stan station with Centralbron and the railway over it, in two halves, each built with
  // the tile it is in
  { name: 'Gamla stan station', outline: stationOutline(), anchor: [449, 910], build: (B, g) => {
    buildStation(B, g); buildSouthEnd(B, g); buildCentralbron(B, g, 'north'); buildRailway(B, g, 'north');
  } },
  { name: 'Centralbron over Söderström', outline: [], anchor: [480, 1100], build: (B, g) => {
    buildCentralbron(B, g, 'south'); buildRailway(B, g, 'south'); buildPortals(B);
  } },
  // the metro's bridge to Slussen: its railings, girders and walkway (the network draws the rest)
  { name: 'Söderströmsbron', outline: [], anchor: [580, 1100], build: buildMetroBridge },
  // Slussen, in view east of the bridge (src/detail/slussen.ts)
  { name: 'Lilla Söderströmsbron', outline: [], anchor: [600, 1062], build: buildCycleBridge },
  { name: 'Guldbron', outline: [], anchor: [836, 1176], build: buildGuldbron },
  { name: 'Vattentorget', outline: [], anchor: [780, 1160], build: buildVattentorget },
  { name: 'Mälartrappan', outline: MALARTRAPPAN_OUTLINE, anchor: [700, 1210], build: buildMalartrappan },
  { name: 'Katarinahissen', outline: KATARINAHISSEN_OUTLINE, anchor: [800, 1292], build: buildKatarinahissen },
  // Ropsten (src/detail/ropsten.ts): the bridges to Lidingö, each built in parts, a part with the
  // tile it is in
  ...LIDINGOBRON_PARTS.map((p, i): Landmark => ({ name: `Lidingöbron ${i + 1}`, outline: [], anchor: p.anchor, build: (B, g) => buildLidingobron(B, g, p.range) })),
  ...LILLA_LIDINGOBRON_PARTS.map((p, i): Landmark => ({ name: `Lilla Lidingöbron ${i + 1}`, outline: [], anchor: p.anchor, build: (B, g) => buildLillaLidingobron(B, g, p.range) })),
  // the bus square under the platforms, Lidingöbanan's stop beside it, and the oil tanks across
  // the motorway in place of the city's plain blocks of them
  { name: 'Ropstensplan', outline: [], anchor: [2520, -2890], build: buildRopstensplan },
  { name: 'Ropsten tram stop', outline: [], anchor: [2540, -2965], build: buildTramStop },
  ...ENERGIHAMNEN_TANKS.map((t, i): Landmark => ({ name: `Energihamnen tank ${i + 1}`, ...t })),
  // the heat-pump plant on the shore north of the station, with its raked tower and its name
  { name: 'Värmeverk Ropsten', outline: VVR_OUTLINE, anchor: [2485, -3011], build: buildVarmeverk },
  // Värtaverket's two chimneys, the tallest things in sight there (OpenStreetMap has them, but not
  // as buildings)
  ...CHIMNEYS.map((c, i): Landmark => ({ name: `Värtaverket chimney ${i + 1}`, outline: [], anchor: c.c, build: (B, g) => buildChimney(B, g, c) })),
];

export interface TileDetail {
  meshes: THREE.Mesh[];
  replaced: Set<number>;  // buildings left out: a landmark stands there
  detailed: Set<number>;  // buildings whose walls are drawn here (the city keeps their roofs and gables)
}

export function tileDetail(buildings: Building[], x0: number, z0: number, size: number,
  colourOf: (k: number) => [number, number, number], ground: (x: number, z: number) => number | null, streets?: TileStreets): TileDetail {
  const replaced = new Set<number>(), detailed = new Set<number>();
  const B = new Builder();
  const mid = buildings.map((b) => centroid(b.rings[0]));
  // the landmarks: the blocks they stand in for, and those anchored in this tile
  buildings.forEach((b, k) => {
    if (LANDMARKS.some((l) => inPoly(mid[k][0], mid[k][1], l.outline))) replaced.add(k);
  });
  for (const l of LANDMARKS) {
    if (l.anchor[0] >= x0 && l.anchor[0] < x0 + size && l.anchor[1] >= z0 && l.anchor[1] < z0 + size) {
      l.build(B, ground);
      B.place([0, 0, 0], 0);
    }
  }
  // the other buildings in the areas, by a grid of their bounds for finding neighbours
  const cell = 20, grid = new Map<string, number[]>();
  const bounds = buildings.map((b) => box(b.rings[0]));
  bounds.forEach(([a, c, d, e], k) => {
    for (let i = Math.floor(a / cell); i <= Math.floor(d / cell); i++) for (let j = Math.floor(c / cell); j <= Math.floor(e / cell); j++) {
      const key = `${i},${j}`;
      (grid.get(key) ?? grid.set(key, []).get(key)!).push(k);
    }
  });
  const insideOther = (x: number, z: number, self: number) => (grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`) ?? []).some((k) => {
    if (k === self || buildings[k].kind === 'roof') return false;
    const [a, c, d, e] = bounds[k];
    return x >= a && x <= d && z >= c && z <= e && inPoly(x, z, buildings[k].rings[0] as V2[]);
  });
  buildings.forEach((b, k) => {
    if (replaced.has(k) || b.kind === 'roof' || b.kind === 'shed' || !inDetailArea(...mid[k])) return;
    detailed.add(k);
    buildFacades(B, b, k, colourOf(k), { ground, insideOther });
  });
  if (streets) buildStreets(B, streets, x0, z0, size);
  const meshes: THREE.Mesh[] = [];
  for (const [mat, geom] of B.geometries()) {
    const m = new THREE.Mesh(geom, detailMaterial(mat));
    m.name = `detail ${mat}`;
    meshes.push(m);
  }
  return { meshes, replaced, detailed };
}

function centroid(ring: [number, number][]): [number, number] {
  let x = 0, z = 0;
  for (const p of ring) { x += p[0]; z += p[1]; }
  return [x / ring.length, z / ring.length];
}
function box(ring: [number, number][]) {
  let a = Infinity, c = Infinity, d = -Infinity, e = -Infinity;
  for (const [x, z] of ring) { a = Math.min(a, x); c = Math.min(c, z); d = Math.max(d, x); e = Math.max(e, z); }
  return [a, c, d, e];
}
function inPoly(x: number, z: number, ring: V2[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
