import * as THREE from 'three';
import * as T from '../textures';
import type { Builder, V2, V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';
import { post } from './ropsten.ts';
import { block, Frame, pipeRailing, sign, v3, type Ground } from './gubbangen.ts';

// What the green line looks out on from Gubbängen south to Farsta strand (1958), beyond what the
// city draws there itself (its blocks with facades, the streets and the trees: see the areas in
// src/detail/areas.ts):
//
// - the steel viaduct over Gubbängsfältet south of Gubbängen, 171 m in nine spans of 19 m: two
//   plate girders painted grey on a pair of round steel columns at each pier, an open steel deck
//   between them, cross girders under it, and a concrete walkway along each edge on brackets, with a
//   railing of two rails on posts; plain concrete abutments at its ends, Majrovägen passing under
//   the northern span, signed "3,7 m" on both faces.
//
// The viaduct's plan, spans and heights from Lantmäteriet's laser scan (Laserdata Nedladdning, skog,
// April 2021, CC BY 4.0) and Google's 3D mesh, its looks from photographs on Mapillary (2022 and
// 2024); the decks follow the tracks (public/data/track-geometry.json). The network draws the tracks
// on it and leaves its girders, piers and railings to this (src/detail/viaducts.ts).

// (the underside of a deck, lit a little as the ground under it throws the daylight back up, as
// Stocksundet's is: src/detail/stocksundet.ts)
addMaterial('fl-under', () => { const m = T.concrete(17, 228); return standard(m, 0.9, 0, { emissive: new THREE.Color(0x5c5b57), emissiveMap: m }); });

// plans in world x, z
const WORLD = new Frame([0, 0], [1, 0]);

// ------------------------------------------------------------------ Gubbängsfältet's viaduct
// The two tracks every 4.75 m from north to south: z, the western track's x and the eastern's, and
// the rails' top between them.
const GF_TRACKS: [number, number, number, number][] = [
  [7768.00, 1332.19, 1337.39, 34.241], [7772.75, 1332.37, 1337.37, 34.237], [7777.50, 1332.54, 1337.34, 34.232],
  [7782.25, 1332.68, 1337.30, 34.230], [7787.00, 1332.81, 1337.25, 34.230], [7791.75, 1332.92, 1337.20, 34.230],
  [7796.50, 1333.01, 1337.14, 34.230], [7801.25, 1333.10, 1337.08, 34.229], [7806.00, 1333.17, 1337.01, 34.227],
  [7810.75, 1333.24, 1336.95, 34.225], [7815.50, 1333.29, 1336.89, 34.225], [7820.25, 1333.34, 1336.84, 34.227],
  [7825.00, 1333.37, 1336.79, 34.234], [7829.75, 1333.40, 1336.74, 34.242], [7834.50, 1333.42, 1336.71, 34.254],
  [7839.25, 1333.44, 1336.67, 34.266], [7844.00, 1333.45, 1336.63, 34.275], [7848.75, 1333.46, 1336.60, 34.285],
  [7853.50, 1333.46, 1336.57, 34.297], [7858.25, 1333.45, 1336.54, 34.308], [7863.00, 1333.43, 1336.52, 34.318],
  [7867.75, 1333.41, 1336.50, 34.328], [7872.50, 1333.37, 1336.47, 34.352], [7877.25, 1333.33, 1336.44, 34.381],
  [7882.00, 1333.29, 1336.41, 34.416], [7886.75, 1333.23, 1336.39, 34.454], [7891.50, 1333.17, 1336.36, 34.491],
  [7896.25, 1333.11, 1336.33, 34.527], [7901.00, 1333.05, 1336.30, 34.564], [7905.75, 1332.98, 1336.27, 34.602],
  [7910.50, 1332.91, 1336.24, 34.639], [7915.25, 1332.84, 1336.20, 34.675], [7920.00, 1332.77, 1336.17, 34.711],
  [7924.75, 1332.70, 1336.14, 34.749], [7929.50, 1332.63, 1336.10, 34.788], [7934.25, 1332.55, 1336.08, 34.826],
  [7939.00, 1332.48, 1336.05, 34.864], [7943.75, 1332.42, 1336.02, 34.900], [7948.50, 1332.35, 1336.00, 34.935],
  [7953.25, 1332.29, 1335.98, 34.973], [7958.00, 1332.23, 1335.96, 35.012], [7962.75, 1332.16, 1335.95, 35.085],
  [7967.50, 1332.10, 1335.93, 35.162],
];
// at z: the western track's x, the eastern's, and the rails' top
function gfTracks(z: number): [number, number, number] {
  const k = Math.max(0, Math.min(GF_TRACKS.length - 2, Math.floor((z - GF_TRACKS[0][0]) / 4.75)));
  const [z0, w0, e0, r0] = GF_TRACKS[k], [z1, w1, e1, r1] = GF_TRACKS[k + 1], f = (z - z0) / (z1 - z0);
  return [w0 + (w1 - w0) * f, e0 + (e1 - e0) * f, r0 + (r1 - r0) * f];
}
const gfRail = (z: number) => gfTracks(z)[2];
// d metres out from the western track (side −1) or the eastern (1), away from the other
const gfOut = (z: number, side: -1 | 1, d: number) => { const [w, e] = gfTracks(z); return side < 0 ? w - d : e + d; };

// The abutments' faces and their backs, nine spans of 19 m between the faces (the scan's deck ends,
// Google's piers), and where the network's tracks are a bridge (half-way to their next samples).
// Majrovägen passes under the northern span.
export const GF_FACES: V2 = [7785.6, 7956.6];
const GF_BACKS: V2 = [7772, 7966], GF_DECK: V2 = [7774, 7963.4], GF_SPAN = 19, GF_MAJROVAGEN = 7793.5;
export const GF_ANCHOR: V2 = [1335, (GF_FACES[0] + GF_FACES[1]) / 2];
// across, out from each track: the main girder, the bottom flange, the walkway's inner stringer and
// its slab to the edge, the railing; heights from the rails' top: the walkway's, the fascia's
// bottom, the deck plate's, the cross girders' bottom and the main girders'
const GF_GIRDER: V2 = [0.65, 1.05], GF_FLANGE: V2 = [0.55, 1.15], GF_STRINGER: V2 = [1.75, 2.0], GF_WALK: V2 = [2.0, 2.95], GF_RAIL_U = 2.85;
const GF_TOP = 0.3, GF_FASCIA = -0.1, GF_PLATE: V2 = [-0.7, -0.62], GF_CROSS = -1.0, GF_BOTTOM = -1.2;
// brackets and cross girders every 2.375 m, eight to a span
const GF_BAY = GF_SPAN / 8;
const GF_CONCRETE = 0xb6b3ab, GF_ABUTMENT = 0xb0aca3, GF_PAINT = 0xa4a6a2, GF_DARK = 0x4b4e50, GF_COLUMN = 0xb9bbb8, GF_RAILING = 0xaeb3b3;

export function buildGubbangsfaltet(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (_x: number, z: number) => gfRail(z);
  const at = (y: number) => (x: number, z: number) => rail(x, z) + y;
  // a strip from z0 to z1 between d0 and d1 out from a track
  const strip = (z0: number, z1: number, side: -1 | 1, d0: number, d1: number): V2[] =>
    [[gfOut(z0, side, d0), z0], [gfOut(z1, side, d0), z1], [gfOut(z1, side, d1), z1], [gfOut(z0, side, d1), z0]];
  // the deck's length in steps, breaking at the abutments' faces
  const zs: number[] = [GF_DECK[0]];
  for (const [z] of GF_TRACKS) if (z > GF_DECK[0] + 0.5 && z < GF_DECK[1] - 0.5) zs.push(z);
  zs.push(GF_DECK[1], ...GF_FACES);
  zs.sort((a, b) => a - b);

  for (let i = 0; i + 1 < zs.length; i++) {
    const [z0, z1] = [zs[i], zs[i + 1]], spanned = z0 >= GF_FACES[0] - 0.01 && z1 <= GF_FACES[1] + 0.01;
    for (const side of [-1, 1] as const) {
      // the walkway, on its stringer
      B.tint(GF_CONCRETE);
      block(B, WORLD, strip(z0, z1, side, ...GF_WALK), at(GF_FASCIA), at(GF_TOP), 'concrete', 3);
      block(B, WORLD, strip(z0, z1, side, ...GF_STRINGER), at(GF_PLATE[0]), at(GF_TOP), 'concrete', 3);
      if (!spanned) continue;
      // the main girder and its bottom flange
      B.tint(GF_PAINT);
      block(B, WORLD, strip(z0, z1, side, ...GF_GIRDER), at(GF_BOTTOM), at(GF_PLATE[1]), 'concrete', 3);
      B.tint(GF_DARK);
      block(B, WORLD, strip(z0, z1, side, ...GF_FLANGE), at(GF_BOTTOM - 0.06), at(GF_BOTTOM), 'metal', 1);
    }
    // the deck plate between the stringers, under the network's floor
    B.tint(GF_DARK);
    block(B, WORLD, [[gfOut(z0, -1, GF_STRINGER[0]), z0], [gfOut(z1, -1, GF_STRINGER[0]), z1], [gfOut(z1, 1, GF_STRINGER[0]), z1], [gfOut(z0, 1, GF_STRINGER[0]), z0]],
      at(GF_PLATE[0]), at(GF_PLATE[1]), 'fl-under', 3);
  }

  // the cross girders between the main girders, and the brackets under the walkways
  B.tint(GF_DARK);
  for (let z = GF_FACES[0] + GF_BAY / 2; z < GF_FACES[1]; z += GF_BAY) {
    const [w, e] = gfTracks(z);
    block(B, WORLD, [[w + GF_GIRDER[0], z - 0.1], [w + GF_GIRDER[0], z + 0.1], [e - GF_GIRDER[0], z + 0.1], [e - GF_GIRDER[0], z - 0.1]],
      at(GF_CROSS), at(GF_PLATE[0]), 'metal', 1);
    for (const side of [-1, 1] as const) {
      const strip1 = (d0: number, d1: number) => strip(z - 0.08, z + 0.08, side, d0, d1);
      block(B, WORLD, strip1(GF_GIRDER[1], GF_STRINGER[0]), at(GF_CROSS + 0.1), at(GF_PLATE[0]), 'metal', 1);
      // (tapering out to the fascia)
      const deep = (x: number, z: number) => {
        const d = side * (x - gfOut(z, side, 0)), f = (d - GF_STRINGER[1]) / (GF_WALK[1] - 0.05 - GF_STRINGER[1]);
        return rail(x, z) + GF_FASCIA - 0.45 + 0.3 * Math.max(0, Math.min(1, f));
      };
      block(B, WORLD, strip1(GF_STRINGER[1], GF_WALK[1] - 0.05), deep, at(GF_FASCIA), 'metal', 1);
    }
  }

  // the piers: a round column under each main girder, on a footing, under a bearing plate
  for (let z = GF_FACES[0] + GF_SPAN; z < GF_FACES[1] - 1; z += GF_SPAN) {
    for (const side of [-1, 1] as const) {
      const c: V2 = [gfOut(z, side, (GF_GIRDER[0] + GF_GIRDER[1]) / 2), z], g = ground(c[0], c[1]) ?? rail(c[0], z) - 4.5;
      const under = rail(c[0], z) + GF_BOTTOM - 0.06;
      B.tint(GF_COLUMN);
      B.lathe(c[0], c[1], [[0.26, g - 0.3], [0.26, under - 0.08]], 'concrete', 14, 2);
      B.tint(GF_DARK);
      post(B, c, [0, 1], 0.7, 0.7, under - 0.08, under, 'metal', 1);
      post(B, c, [0, 1], 0.75, 0.75, g - 0.3, g + 0.08, 'metal', 1);
    }
  }

  // the abutments, under the network's floor, across the deck and a little beyond it
  B.tint(GF_ABUTMENT);
  for (const [z0, z1] of [[GF_BACKS[0], GF_FACES[0]], [GF_FACES[1], GF_BACKS[1]]]) {
    const plan: V2[] = [[gfOut(z0, -1, 3.2), z0], [gfOut(z1, -1, 3.2), z1], [gfOut(z1, 1, 3.2), z1], [gfOut(z0, 1, 3.2), z0]];
    const foot = Math.min(...plan.map(([x, z]) => ground(x, z) ?? rail(x, z) - 4.5)) - 0.5;
    block(B, WORLD, plan, () => foot, at(GF_PLATE[1]), 'concrete', 3);
  }

  // the railings along the walkways' edges, the whole length of the deck
  B.tint(GF_RAILING);
  for (const side of [-1, 1] as const) {
    const feet = zs.filter((z, i) => i === 0 || z - zs[i - 1] > 0.3).map((z) => v3([gfOut(z, side, GF_RAIL_U), z], gfRail(z) + GF_TOP));
    pipeRailing(B, feet, 1.1, GF_BAY);
  }

  // the height clear over Majrovägen, on both faces, hung under the fascia
  for (const side of [-1, 1] as const) {
    const z = GF_MAJROVAGEN;
    sign(B, v3([gfOut(z, side, GF_WALK[1]), z], gfRail(z) + GF_FASCIA - 0.36), [side, 0, 0], 0.64, 'gt-sign');
  }
}

// ------------------------------------------------------------------ Hökarängen's bridges
// Over Örbyleden at the north end of Hökarängen's platform: the metro's two decks, one for each
// track, side by side, concrete slabs on an edge beam with a sloping soffit along their outer
// edges, on square columns between the road's carriageways, from the abutment in the bank north of
// the road to the ticket hall under their south end (the station's own: src/open-styles.ts); and 6
// m west of them a bridge for cycles and walkers, curving a little, its slab on round columns,
// glazed railings along its edges. The decks' edges and heights and the cycle bridge's from the
// laser scan, its line from OpenStreetMap, the columns and the looks from photographs on Mapillary
// (2019–2025).
//
// The two tracks every 4 m: z, the western track's x and its rails' top, the eastern's.
const HK_TRACKS: [number, number, number, number, number][] = [
  [8140, 1331.31, 39.159, 1336.36, 39.230], [8144, 1331.45, 39.261, 1336.67, 39.336], [8148, 1331.63, 39.360, 1337.04, 39.433],
  [8152, 1331.85, 39.456, 1337.44, 39.525], [8156, 1332.07, 39.552, 1337.87, 39.617], [8160, 1332.38, 39.644, 1338.37, 39.709],
  [8164, 1332.68, 39.737, 1338.86, 39.801], [8168, 1333.04, 39.825, 1339.45, 39.884], [8172, 1333.45, 39.909, 1340.04, 39.967],
  [8176, 1333.85, 39.994, 1340.70, 40.048], [8180, 1334.35, 40.074, 1341.39, 40.127], [8184, 1334.85, 40.155, 1342.13, 40.201],
  [8188, 1335.41, 40.227, 1342.92, 40.267], [8192, 1336.00, 40.292, 1343.72, 40.334], [8196, 1336.61, 40.356, 1344.62, 40.401],
  [8200, 1337.29, 40.417, 1345.51, 40.467], [8204, 1337.98, 40.478, 1346.50, 40.503], [8208, 1338.73, 40.526, 1347.49, 40.537],
  [8212, 1339.51, 40.567, 1348.54, 40.571],
];
// at z, for the western track's deck (side −1) or the eastern's (1): the track's x and the rails' top
function hkTrack(z: number, side: -1 | 1): [number, number] {
  const k = Math.max(0, Math.min(HK_TRACKS.length - 2, Math.floor((z - HK_TRACKS[0][0]) / 4)));
  const a = HK_TRACKS[k], b = HK_TRACKS[k + 1], f = (z - a[0]) / (b[0] - a[0]), i = side < 0 ? 1 : 3;
  return [a[i] + (b[i] - a[i]) * f, a[i + 1] + (b[i + 1] - a[i + 1]) * f];
}
// d metres out from a track, away from the other one
const hkOut = (z: number, side: -1 | 1, d: number) => hkTrack(z, side)[0] + side * d;
// where the network's tracks are a bridge, the abutment's face, the piers (between the carriageways,
// as the photographs have them), and the ticket hall's front under the decks' south end
const HK_DECK: V2 = [8141, 8205], HK_FACE = 8149.5, HK_PIERS = [8161, 8175, 8186.5, 8194.5], HK_HALL = 8197.5;
export const HK_ANCHOR: V2 = [1336, 8173];
// across, out from each track: the slab's inner edge, the soffit's foot, the edge beam; heights from
// the rails' top: the slab's underside, the edge beam's top and bottom
const HK_INNER = -2.55, HK_SOFFIT = 1.45, HK_BEAM: V2 = [2.35, 2.8], HK_UNDER = -1.0, HK_KERB = 0.25, HK_FASCIA = -1.4;
const HK_CONCRETE = 0x9e9b95, HK_SLAB = 0x8d8a84, HK_COLUMN = 0x8f8c86, HK_RAILING = 0xaeb3b3;

// the cycle bridge's line and its top every 3 m or so, from its northern end to its southern
const HK_CYCLE: V3[] = [
  [1323.39, 8141.00, 38.60], [1323.43, 8141.67, 38.63], [1323.80, 8146.10, 38.86], [1323.99, 8148.18, 38.96],
  [1324.24, 8150.80, 39.07], [1324.54, 8153.84, 39.15], [1324.87, 8157.18, 39.31], [1325.21, 8160.68, 39.42],
  [1325.54, 8164.22, 39.51], [1325.85, 8167.67, 39.59], [1326.13, 8170.90, 39.67], [1326.35, 8173.79, 39.74],
  [1326.50, 8176.20, 39.77], [1326.61, 8180.61, 39.80], [1326.47, 8183.66, 39.78], [1326.23, 8186.14, 39.76],
  [1326.00, 8188.80, 39.73], [1325.82, 8191.76, 39.67], [1325.63, 8194.65, 39.59], [1325.39, 8197.49, 39.48],
  [1325.10, 8200.30, 39.37], [1324.75, 8203.05, 39.28], [1324.36, 8205.74, 39.21], [1323.91, 8208.46, 39.13],
  [1323.40, 8211.30, 39.04], [1322.74, 8214.55, 38.92], [1321.98, 8218.07, 38.78], [1321.24, 8221.34, 38.69],
  [1320.70, 8223.80, 38.61], [1320.20, 8226.40, 38.50],
];
// its half-width, its slab's depth at the edges, the upstand along them, the columns (at points of
// its line) and the glass
const HK_CYCLE_HALF = 2.1, HK_CYCLE_DEPTH = 0.75, HK_CYCLE_UPSTAND = 0.2, HK_CYCLE_COLUMNS = [6, 11, 17, 23];
const HK_CYCLE_GLASS = 1.15;

export function buildHokarangenBridges(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const zs: number[] = [HK_DECK[0], HK_FACE, HK_HALL];
  for (const [z] of HK_TRACKS) if (z > HK_DECK[0] + 0.5 && z < HK_HALL - 0.5) zs.push(z);
  zs.sort((a, b) => a - b);
  for (const side of [-1, 1] as const) {
    const rail = (_x: number, z: number) => hkTrack(z, side)[1];
    const at = (y: number) => (x: number, z: number) => rail(x, z) + y;
    const strip = (z0: number, z1: number, d0: number, d1: number): V2[] =>
      [[hkOut(z0, side, d0), z0], [hkOut(z1, side, d0), z1], [hkOut(z1, side, d1), z1], [hkOut(z0, side, d1), z0]];
    for (let i = 0; i + 1 < zs.length; i++) {
      const [z0, z1] = [zs[i], zs[i + 1]];
      // the slab under the network's floor, the soffit sloping down to the edge beam, the beam
      B.tint(HK_SLAB);
      block(B, WORLD, strip(z0, z1, HK_INNER, HK_SOFFIT), at(HK_UNDER), at(GF_PLATE[1]), 'fl-under', 3);
      const soffit = (x: number, z: number) => {
        const d = side * (x - hkTrack(z, side)[0]), f = Math.max(0, Math.min(1, (d - HK_SOFFIT) / (HK_BEAM[0] - HK_SOFFIT)));
        return rail(x, z) + HK_UNDER + (HK_FASCIA + 0.1 - HK_UNDER) * f;
      };
      block(B, WORLD, strip(z0, z1, HK_SOFFIT, HK_BEAM[0]), soffit, at(GF_PLATE[1]), 'fl-under', 3);
      B.tint(HK_CONCRETE);
      block(B, WORLD, strip(z0, z1, ...HK_BEAM), at(HK_FASCIA), at(HK_KERB), 'concrete', 3);
    }
    // the columns, square, one under each deck at each pier
    B.tint(HK_COLUMN);
    for (const z of HK_PIERS) {
      const c: V2 = [hkOut(z, side, 0.4), z], g = ground(c[0], c[1]) ?? rail(0, z) - 5.5;
      post(B, c, [0, 1], 0.6, 0.6, g - 0.3, rail(0, z) + HK_UNDER + 0.02, 'concrete', 2);
    }
    // the railing along the outer edge, the whole length of the network's bridge
    B.tint(HK_RAILING);
    const feet: V3[] = [];
    for (let z = HK_DECK[0]; z < HK_DECK[1] + 0.01; z += 4) feet.push(v3([hkOut(z, side, HK_BEAM[1] - 0.15), z], hkTrack(z, side)[1] + HK_KERB));
    pipeRailing(B, feet, 1.1, 2);
  }
  // the abutment north of the road, under both decks
  B.tint(HK_CONCRETE);
  const plan: V2[] = [[hkOut(HK_DECK[0], -1, 3), HK_DECK[0]], [hkOut(HK_FACE, -1, 3), HK_FACE], [hkOut(HK_FACE, 1, 3), HK_FACE], [hkOut(HK_DECK[0], 1, 3), HK_DECK[0]]];
  const foot = Math.min(...plan.map(([x, z]) => ground(x, z) ?? 34)) - 0.5;
  block(B, WORLD, plan, () => foot, (_x, z) => Math.min(hkTrack(z, -1)[1], hkTrack(z, 1)[1]) + GF_PLATE[1], 'concrete', 3);

  // the cycle bridge: its slab between upstands, the asphalt on it, its columns and glazed railings
  const n = HK_CYCLE.length;
  const across = (i: number): V2 => {
    const a = HK_CYCLE[Math.max(0, i - 1)], b = HK_CYCLE[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // (to the right of the way south: west)
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  };
  const edge = (i: number, u: number): V2 => { const [x, z] = HK_CYCLE[i], r = across(i); return [x + r[0] * u, z + r[1] * u]; };
  for (let i = 0; i + 1 < n; i++) {
    const top = (k: number) => HK_CYCLE[k][2];
    const quad = (u0: number, u1: number): V2[] => [edge(i, u0), edge(i + 1, u0), edge(i + 1, u1), edge(i, u1)];
    // (a block's top and bottom are planes by plan point, so each slice is built from its own ends)
    const along = (y: (k: number) => number) => (x: number, z: number) => {
      const a = HK_CYCLE[i], b = HK_CYCLE[i + 1], l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
      const f = Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / l2));
      return y(i) + (y(i + 1) - y(i)) * f;
    };
    B.tint(HK_SLAB);
    block(B, WORLD, quad(-HK_CYCLE_HALF + 0.25, HK_CYCLE_HALF - 0.25), along((k) => top(k) - HK_CYCLE_DEPTH + 0.15), along((k) => top(k) - 0.05), 'fl-under', 3);
    B.tint(HK_CONCRETE);
    for (const [u0, u1] of [[-HK_CYCLE_HALF, -HK_CYCLE_HALF + 0.25], [HK_CYCLE_HALF - 0.25, HK_CYCLE_HALF]]) {
      block(B, WORLD, quad(u0, u1), along((k) => top(k) - HK_CYCLE_DEPTH), along((k) => top(k) + HK_CYCLE_UPSTAND), 'concrete', 3);
    }
    B.tint(0x5f6164);
    block(B, WORLD, quad(-HK_CYCLE_HALF + 0.25, HK_CYCLE_HALF - 0.25), () => 0, along(top), 'rp-asphalt', 6, { faces: 'top' });
  }
  B.tint(HK_COLUMN);
  for (const i of HK_CYCLE_COLUMNS) {
    const [x, z, y] = HK_CYCLE[i], g = ground(x, z) ?? y - 5.5;
    B.lathe(x, z, [[0.4, g - 0.3], [0.4, y - HK_CYCLE_DEPTH + 0.17]], 'concrete', 16, 2);
  }
  // the railings: glass panels between steel posts every 1.5 m or so, a steel rail along the top
  for (const u of [-HK_CYCLE_HALF + 0.12, HK_CYCLE_HALF - 0.12]) {
    const feet = HK_CYCLE.map(([, , y], i): V3 => v3(edge(i, u), y + HK_CYCLE_UPSTAND));
    for (let i = 0; i + 1 < n; i++) {
      const [a, b] = [feet[i], feet[i + 1]], l = Math.hypot(b[0] - a[0], b[2] - a[2]), nn: V3 = [-(b[2] - a[2]) / l, 0, (b[0] - a[0]) / l];
      B.tint(0xcfe0dc);
      B.poly([a, b, [b[0], b[1] + HK_CYCLE_GLASS, b[2]], [a[0], a[1] + HK_CYCLE_GLASS, a[2]]], nn, 'rp-glass', 1);
    }
    B.tint(HK_RAILING);
    pipeRailing(B, feet.map(([x, y, z]): V3 => [x, y + HK_CYCLE_GLASS - 1.2, z]), 1.2, 1.5);
  }
}

// ------------------------------------------------------------------ Farsta's bridge over Farstavägen
// North of Farsta, over Farstavägen's two carriageways where they cross under the line at 45°: a
// concrete deck for both tracks on deep edge beams, its soffit sloping up from them to the slab, on
// pairs of round columns lined up with the road, between tall abutments of plain concrete; a
// galvanised railing of two rails on posts along each edge, and the height clear under it, "4,3 m",
// over each carriageway on both faces. Its plan, heights and the road under it from the laser scan,
// the piers from Google's mesh, the looks from photographs on Mapillary (2015–2021).
addMaterial('fl-sign43', () => standard(T.heightLimitSign('4,3 m'), 0.5, 0, { alphaTest: 0.5 }));
// The two tracks every 4 m: z, the western track's x and its rails' top, the eastern's.
const FN_TRACKS: [number, number, number, number, number][] = [
  [9284, 1828.58, 43.864, 1832.21, 43.807], [9288, 1828.96, 43.836, 1832.61, 43.777], [9292, 1829.36, 43.810, 1833.01, 43.750],
  [9296, 1829.76, 43.787, 1833.41, 43.723], [9300, 1830.16, 43.763, 1833.80, 43.694], [9304, 1830.56, 43.737, 1834.20, 43.664],
  [9308, 1830.97, 43.711, 1834.59, 43.639], [9312, 1831.39, 43.684, 1834.98, 43.614], [9316, 1831.80, 43.658, 1835.37, 43.587],
  [9320, 1832.22, 43.632, 1835.76, 43.557], [9324, 1832.64, 43.605, 1836.15, 43.528], [9328, 1833.06, 43.577, 1836.54, 43.503],
  [9332, 1833.48, 43.547, 1836.92, 43.478], [9336, 1833.90, 43.517, 1837.31, 43.450], [9340, 1834.32, 43.490, 1837.70, 43.421],
  [9344, 1834.73, 43.464, 1838.09, 43.393], [9348, 1835.15, 43.438, 1838.49, 43.368], [9352, 1835.56, 43.412, 1838.89, 43.343],
  [9356, 1835.96, 43.385, 1839.29, 43.314], [9360, 1836.37, 43.359, 1839.69, 43.284], [9364, 1836.77, 43.332, 1840.10, 43.256],
  [9368, 1837.16, 43.303, 1840.52, 43.227], [9372, 1837.56, 43.274, 1840.93, 43.198],
];
function fnTrack(z: number, side: -1 | 1): [number, number] {
  const k = Math.max(0, Math.min(FN_TRACKS.length - 2, Math.floor((z - FN_TRACKS[0][0]) / 4)));
  const a = FN_TRACKS[k], b = FN_TRACKS[k + 1], f = (z - a[0]) / (b[0] - a[0]), i = side < 0 ? 1 : 3;
  return [a[i] + (b[i] - a[i]) * f, a[i + 1] + (b[i + 1] - a[i + 1]) * f];
}
const fnOut = (z: number, side: -1 | 1, d: number) => fnTrack(z, side)[0] + side * d;
const fnRail = (z: number) => (fnTrack(z, -1)[1] + fnTrack(z, 1)[1]) / 2;
// where the network's tracks are a bridge, the abutments' faces, the piers (where the eastern track
// crosses them; they run with the road, 1 m further south for every metre west), and where the
// carriageways cross the faces
const FN_DECK: V2 = [9290.5, 9367], FN_FACES: V2 = [9308.4, 9352.2], FN_PIERS = [9314.9, 9324.3, 9334.3, 9346.2], FN_SKEW = 1.01;
const FN_ROADS = [9328, 9343.6];
export const FN_ANCHOR: V2 = [1835, 9329];
// out from each track: the soffit's foot, the edge beam; heights from the rails' top
const FN_SOFFIT = 1.2, FN_BEAM: V2 = [2.3, 2.8], FN_UNDER = -1.1, FN_FASCIA = -1.6, FN_KERB = 0.2;
const FN_CONCRETE = 0xb5b2aa, FN_SLAB = 0x8d8a84;

export function buildFarstavagenBridge(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  const rail = (_x: number, z: number) => fnRail(z);
  const at = (y: number) => (x: number, z: number) => rail(x, z) + y;
  const zs: number[] = [FN_DECK[0], ...FN_FACES, FN_DECK[1]];
  for (const [z] of FN_TRACKS) if (z > FN_DECK[0] + 0.5 && z < FN_DECK[1] - 0.5) zs.push(z);
  zs.sort((a, b) => a - b);
  for (let i = 0; i + 1 < zs.length; i++) {
    const [z0, z1] = [zs[i], zs[i + 1]], spanned = z0 >= FN_FACES[0] - 0.01 && z1 <= FN_FACES[1] + 0.01;
    // the slab between the soffits' feet
    B.tint(FN_SLAB);
    block(B, WORLD, [[fnOut(z0, -1, FN_SOFFIT), z0], [fnOut(z1, -1, FN_SOFFIT), z1], [fnOut(z1, 1, FN_SOFFIT), z1], [fnOut(z0, 1, FN_SOFFIT), z0]],
      at(FN_UNDER), at(GF_PLATE[1]), 'fl-under', 3);
    for (const side of [-1, 1] as const) {
      const strip = (d0: number, d1: number): V2[] => [[fnOut(z0, side, d0), z0], [fnOut(z1, side, d0), z1], [fnOut(z1, side, d1), z1], [fnOut(z0, side, d1), z0]];
      const soffit = (x: number, z: number) => {
        const d = side * (x - fnTrack(z, side)[0]), f = Math.max(0, Math.min(1, (d - FN_SOFFIT) / (FN_BEAM[0] - FN_SOFFIT)));
        return rail(x, z) + FN_UNDER + (FN_FASCIA + 0.15 - FN_UNDER) * f;
      };
      B.tint(FN_SLAB);
      block(B, WORLD, strip(FN_SOFFIT, FN_BEAM[0]), spanned ? soffit : at(FN_UNDER), at(GF_PLATE[1]), 'fl-under', 3);
      B.tint(FN_CONCRETE);
      block(B, WORLD, strip(...FN_BEAM), at(spanned ? FN_FASCIA : FN_UNDER), at(FN_KERB), 'concrete', 3);
    }
  }
  // the piers: a round column under each track, the pair lined up with the road
  B.tint(FN_CONCRETE);
  for (const z of FN_PIERS) {
    for (const side of [-1, 1] as const) {
      const [x0] = fnTrack(z, 1), zc = z + FN_SKEW * (x0 - fnTrack(z, side)[0]), [x] = fnTrack(zc, side);
      const g = ground(x, zc) ?? fnRail(zc) - 6;
      B.lathe(x, zc, [[0.4, g - 0.3], [0.4, fnRail(zc) + FN_UNDER + 0.02]], 'concrete', 16, 2);
    }
  }
  // the abutments, across the deck and a little beyond its edges
  for (const [z0, z1] of [[FN_DECK[0], FN_FACES[0]], [FN_FACES[1], FN_DECK[1]]]) {
    const plan: V2[] = [[fnOut(z0, -1, 3.1), z0], [fnOut(z1, -1, 3.1), z1], [fnOut(z1, 1, 3.1), z1], [fnOut(z0, 1, 3.1), z0]];
    const foot = Math.min(...plan.map(([x, z]) => ground(x, z) ?? fnRail(z) - 6)) - 0.5;
    block(B, WORLD, plan, () => foot, at(FN_UNDER), 'concrete', 3);
  }
  // the railings, and the signs over the carriageways on both faces
  for (const side of [-1, 1] as const) {
    B.tint(0xaeb3b3);
    const feet: V3[] = [];
    for (let z = FN_DECK[0]; z < FN_DECK[1] + 0.01; z += 4) feet.push(v3([fnOut(z, side, FN_BEAM[1] - 0.15), z], fnRail(z) + FN_KERB));
    pipeRailing(B, feet, 1.1, 1.8);
    for (const z of FN_ROADS) {
      // (where the carriageway meets this face, 1 m further south for each metre west)
      const zf = z + FN_SKEW * (fnTrack(z, 1)[0] - fnOut(z, side, FN_BEAM[1]));
      sign(B, v3([fnOut(zf, side, FN_BEAM[1]), zf], fnRail(zf) + (FN_FASCIA + FN_KERB) / 2), [side, 0, 0], 0.64, 'fl-sign43');
    }
  }
}

// ------------------------------------------------------------------ Farsta's viaduct
// North of Farsta's platform the two tracks come in on a deck each, drawing apart from 11 m to 15 m
// with a park and its paths between and under them and the street Kroppaplan crossing under both:
// concrete decks, a broad slab with a deep edge beam along each edge over a narrower spine with
// chamfered corners, on single round columns that flare out under the spine, in spans of 21 m;
// a railing of two rails on posts along each edge. The decks' edges and heights from the laser scan,
// the piers and the section from Google's mesh. The platform's own deck, south of them, is the
// station's.
//
// Each track every 4 m: z, its x and its rails' top, the western track's and the eastern's.
const FV_TRACKS: [number, number, number, number, number][] = [
  [9646, 1897.96, 41.098, 1910.05, 41.083], [9650, 1899.63, 41.081, 1911.87, 41.061], [9654, 1901.34, 41.063, 1913.72, 41.043],
  [9658, 1903.06, 41.046, 1915.58, 41.029], [9662, 1904.80, 41.031, 1917.47, 41.014], [9666, 1906.55, 41.017, 1919.39, 40.996],
  [9670, 1908.33, 41.002, 1921.33, 40.978], [9674, 1910.12, 40.983, 1923.31, 40.964], [9678, 1911.92, 40.966, 1925.29, 40.950],
  [9682, 1913.73, 40.953, 1927.32, 40.932], [9686, 1915.55, 40.939, 1929.35, 40.913], [9690, 1917.41, 40.920, 1931.43, 40.902],
  [9694, 1919.26, 40.902, 1933.50, 40.893], [9698, 1921.13, 40.892, 1935.61, 40.880], [9702, 1923.01, 40.883, 1937.72, 40.866],
  [9706, 1924.91, 40.870, 1939.85, 40.852], [9710, 1926.81, 40.856, 1942.00, 40.838], [9714, 1928.73, 40.845, 1944.15, 40.828],
  [9718, 1930.67, 40.836, 1946.31, 40.823], [9722, 1932.61, 40.828, 1948.48, 40.819], [9726, 1934.56, 40.824, 1950.66, 40.814],
  [9730, 1936.53, 40.818, 1952.85, 40.808], [9734, 1938.52, 40.809, 1955.06, 40.799], [9738, 1940.51, 40.800, 1957.27, 40.790],
  [9742, 1942.53, 40.800, 1959.49, 40.790], [9746, 1944.55, 40.800, 1961.72, 40.790], [9750, 1946.61, 40.796, 1963.96, 40.790],
];
// at z, for the western track (side −1) or the eastern (1): its x, its rails' top, and its
// direction (towards the south)
function fvTrack(z: number, side: -1 | 1): [number, number, V2] {
  const k = Math.max(0, Math.min(FV_TRACKS.length - 2, Math.floor((z - FV_TRACKS[0][0]) / 4)));
  const a = FV_TRACKS[k], b = FV_TRACKS[k + 1], f = (z - a[0]) / (b[0] - a[0]), i = side < 0 ? 1 : 3;
  const dx = b[i] - a[i], l = Math.hypot(dx, 4);
  return [a[i] + dx * f, a[i + 1] + (b[i + 1] - a[i + 1]) * f, [dx / l, 4 / l]];
}
// d metres out from a track, square to it, away from the other one
const fvOut = (z: number, side: -1 | 1, d: number): V2 => {
  const [x, , t] = fvTrack(z, side);
  return [x + side * t[1] * d, z - side * t[0] * d];
};
// how far out from its track (x, z) is
const fvAcross = (x: number, z: number, side: -1 | 1) => { const [x0, , t] = fvTrack(z, side); return side * (x - x0) * t[1]; };
// where each deck starts at the north (where the network's track becomes a bridge) and ends at the
// south (at the network's pier under the platform's end), the abutments' backs and faces, and the
// piers, a western and an eastern column abreast
const FV_DECKS: Record<-1 | 1, V2> = { [-1]: [9659.4, 9746.23], [1]: [9652.0, 9742.03] };
const FV_BACK = 9649, FV_FACE = 9659.75, FV_PIERS = [9678.3, 9696.85, 9715.4, 9733.95];
export const FV_ANCHOR: V2 = [1930, 9698];
// across, out from the track: the spine, its chamfer, the edge beam; heights from the rails' top:
// the spine's bottom, the slab's underside at the spine and at the edge beam, the edge beam's bottom
// and its top
const FV_SPINE = 1.1, FV_CHAMFER = 0.3, FV_BEAM: V2 = [2.45, 2.75];
const FV_BOTTOM = -2.3, FV_SLAB: V2 = [-0.95, -1.1], FV_FASCIA = -1.25, FV_KERB = 0.25;
const FV_CONCRETE = 0xb3b0a8, FV_UNDER = 0x9a978f;

export function buildFarstaViaduct(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  for (const side of [-1, 1] as const) {
    const rail = (_x: number, z: number) => fvTrack(z, side)[1];
    const at = (y: number) => (x: number, z: number) => rail(x, z) + y;
    // between d0 and d1 out from the track, from z0 to z1 (d may be negative: towards the other track)
    const strip = (z0: number, z1: number, d0: number, d1: number): V2[] => [fvOut(z0, side, d0), fvOut(z1, side, d0), fvOut(z1, side, d1), fvOut(z0, side, d1)];
    // a height going from y0 at d0 out from the track to y1 at d1, either way out
    const slope = (d0: number, y0: number, d1: number, y1: number) => (x: number, z: number) => {
      const d = Math.abs(fvAcross(x, z, side)), f = Math.max(0, Math.min(1, (d - d0) / (d1 - d0)));
      return rail(x, z) + y0 + (y1 - y0) * f;
    };
    const [start, end] = FV_DECKS[side];
    const zs: number[] = [start, end, ...FV_PIERS, FV_FACE];
    for (const [z] of FV_TRACKS) if (z > start + 0.5 && z < end - 0.5) zs.push(z);
    zs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < zs.length; i++) {
      const [z0, z1] = [zs[i], zs[i + 1]];
      if (z1 <= start + 0.01 || z0 >= end - 0.01) continue;
      const spanned = z0 >= FV_FACE - 0.01;
      // the spine, its chamfered corners, the slab out to the edge beams, the beams
      B.tint(FV_UNDER);
      block(B, WORLD, strip(z0, z1, -(FV_SPINE - FV_CHAMFER), FV_SPINE - FV_CHAMFER), at(spanned ? FV_BOTTOM : FV_SLAB[0]), at(GF_PLATE[1]), 'fl-under', 3);
      for (const e of [-1, 1]) {
        const [a, b] = [e * (FV_SPINE - FV_CHAMFER), e * FV_SPINE];
        block(B, WORLD, strip(z0, z1, Math.min(a, b), Math.max(a, b)), spanned ? slope(FV_SPINE - FV_CHAMFER, FV_BOTTOM, FV_SPINE, FV_BOTTOM + FV_CHAMFER) : at(FV_SLAB[0]), at(GF_PLATE[1]), 'fl-under', 3);
        const [c, d] = [e * FV_SPINE, e * FV_BEAM[0]];
        block(B, WORLD, strip(z0, z1, Math.min(c, d), Math.max(c, d)), slope(FV_SPINE, FV_SLAB[0], FV_BEAM[0], FV_SLAB[1]), at(GF_PLATE[1]), 'fl-under', 3);
        B.tint(FV_CONCRETE);
        const [f, g] = [e * FV_BEAM[0], e * FV_BEAM[1]];
        block(B, WORLD, strip(z0, z1, Math.min(f, g), Math.max(f, g)), at(FV_FASCIA), at(FV_KERB), 'concrete', 3);
        B.tint(FV_UNDER);
      }
    }
    // the columns, flaring out under the spine
    B.tint(FV_CONCRETE);
    for (const z of FV_PIERS) {
      const [x, y] = fvTrack(z, side), g = ground(x, z) ?? y - 6, top = y + FV_BOTTOM + 0.02;
      B.lathe(x, z, [[0.42, g - 0.3], [0.42, top - 1.3], [0.6, top - 0.45], [0.8, top]], 'concrete', 18, 2);
    }
    // the abutment, across the deck and a little beyond it
    const plan = strip(FV_BACK, FV_FACE, -3.0, 3.0);
    const foot = Math.min(...plan.map(([x, z]) => ground(x, z) ?? rail(x, z) - 4)) - 0.5;
    block(B, WORLD, plan, () => foot, at(FV_SLAB[1]), 'concrete', 3);
    // the railings along both edges
    B.tint(0xaeb3b3);
    const steps = [start, ...FV_TRACKS.map(([z]) => z).filter((z) => z > start + 0.5 && z < end - 0.5), end];
    for (const e of [-1, 1] as const) {
      const feet = steps.map((z) => v3(fvOut(z, side, e * (FV_BEAM[1] - 0.15)), rail(0, z) + FV_KERB));
      pipeRailing(B, feet, 1.1, 2);
    }
  }
}
