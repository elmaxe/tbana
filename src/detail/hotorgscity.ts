import * as THREE from 'three';
import * as T from '../textures';
import type { Building } from '../city-tile.ts';
import { offset, outward, type Builder, type V2, type V3 } from './builder.ts';
import { buildFacades } from './facades.ts';
import { addMaterial, standard } from './materials.ts';
import { wallWithOpenings, type Opening } from './wall.ts';

// The low block of Hötorgscity between Sergelgatan and Slöjdgatan (David Helldén, 1958–59), one
// building in OpenStreetMap (way 18779937) but three in fact, from Hötorget southwards:
// - Filmstaden Sergel (1995, Per Kallstenius, over Hötorgshallen in the basement): towards Hötorget
//   the glass front Markelius had wanted, seven bays wide in two tiers and 5 m deep under a flat
//   roof, the cinema's name in red on the white box set back over it; along the streets two
//   storeys of shops, a band of red brick with small square vents, the white box over them, and
//   its plant room set back on the roof.
// - the old Sergelteatern's stage house in the middle, lower, under copper roofs;
// - and Helldén's shops and offices to the south.
// The first is built here; the other two are the city's ordinary facades at their own heights.
//
// Heights from Lantmäteriet's laser scan (Laserdata Nedladdning, skog, CC BY 4.0; RH 2000), where
// OSM's 3 levels had stood it 10 m high, and the facades' bands and bays from Google's 3D mesh of
// the city. Frame: x across the block to the east-north-east, z along it to the south-south-east.

const AT: V2 = [214, -266], TURN = (26.5 * Math.PI) / 180, C = Math.cos(TURN), S = Math.sin(TURN);
const local = ([X, Z]: V2): V2 => [(X - AT[0]) * C - (Z - AT[1]) * S, (X - AT[0]) * S + (Z - AT[1]) * C];

// OSM's outline of the block, world x, z
const RING: V2[] = [[170.7, -321], [174.6, -323.1], [183.3, -327.4], [188.4, -329.9], [203.9, -337.6], [207.5, -339.4], [208.2, -339.8],
  [214.7, -323.3], [217.3, -316.8], [218.1, -314.9], [221.8, -305.3], [227.7, -290.4], [223.1, -288.2], [238.8, -259.5], [243.6, -250.8],
  [244.6, -248.8], [246.4, -245.7], [259.9, -204.2], [260.7, -201.7], [255.8, -199.2], [250.1, -196.3], [239.3, -190.5], [233.2, -202.3],
  [192, -284.2], [188.5, -285.3], [187.4, -287.5], [181.9, -298.7]];
// where the buildings meet, along the block (z)
const SPLIT_NORTH = -7, SPLIT_SOUTH = 31;

// Filmstaden Sergel
const SHOP_TOP = 19.4, BRICK_TOP = 25.6, WHITE_TOP = 33.4, PLANT_TOP = 35.0;
const GLASS_TOP = 25.8, TRANSOM = 17.3, SIGN: V2 = [27.3, 29.7];
// the glass front's depth to the white box's face (laser scan: its roof at 25.9 for 5 m)
const FRONT_DEPTH = 5.2;
// the stage house and the south building
const MIDDLE_TOP = 27.0, SOUTH_TOP = 33.6;

const WHITE = 0xe9e8e3, DARK = 0x50565c, BRICK = 0xc0705a, FRAME = 0xd9dcdc, ROOF = 0x8c8c88;

addMaterial('filmglass', () => standard(T.curtainWall({ spandrel: '#7c8a92', share: 0.02, tint: null, frame: '#d9dcdc', mullion: 4 }), 0.25, 0.1));
addMaterial('filmsign', () => {
  const t = T.letters('Filmstaden', '#e2231a');
  return standard(t, 0.5, 0, { alphaTest: 0.4, emissive: new THREE.Color(0xff2a1a), emissiveMap: t, emissiveIntensity: 0.6 });
});

// the part of an outline on the side of a line where f ≤ 0 (Sutherland–Hodgman)
function clip(poly: V2[], f: (p: V2) => number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
function inPoly(x: number, z: number, ring: V2[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

const NORTH = clip(RING, (p) => local(p)[1] - SPLIT_NORTH);
// Filmstaden's white box, and the glass front's roof before it
const BOX_Z = Math.min(...NORTH.map((p) => local(p)[1])) + FRONT_DEPTH;
const BOX = clip(NORTH, (p) => BOX_Z - local(p)[1]), FRONT = clip(NORTH, (p) => local(p)[1] - BOX_Z);
const MIDDLE = clip(clip(RING, (p) => SPLIT_NORTH - local(p)[1]), (p) => local(p)[1] - SPLIT_SOUTH);
const SOUTH = clip(RING, (p) => SPLIT_SOUTH - local(p)[1]);

type Ground = (x: number, z: number) => number | null;

// a wall along a → b, facing n, its openings and bands given along it (a) and up (y)
function wallOf(a: V2, b: V2, n: V2) {
  const W = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { o: [a[0], 0, a[1]] as V3, h: [(b[0] - a[0]) / W, 0, (b[1] - a[1]) / W] as V3, n: [n[0], 0, n[1]] as V3, W };
}

function buildFilmstaden(B: Builder, ground: Ground) {
  const poly = NORTH, N = outward(poly), n = poly.length;
  const g0 = Math.min(...poly.map(([x, z]) => ground(x, z) ?? 10.5)) - 1.5;
  // the front on Hötorget: the edges facing north-north-west, nearly in line, as one
  const front: number[] = [];
  for (let i = 0; i < n; i++) if (local([AT[0] + N[i][0], AT[1] + N[i][1]])[1] < -0.7) front.push(i);
  for (let i = 0; i < n; i++) {
    if (front.includes(i)) continue;
    const a = poly[i], b = poly[(i + 1) % n], w = wallOf(a, b, N[i]);
    if (w.W < 0.05) continue;
    const nz = local([AT[0] + N[i][0], AT[1] + N[i][1]])[1];
    if (nz > 0.7) {
      // towards the stage house: plain, only seen over its roof
      B.tint(WHITE);
      wallWithOpenings(B, w.o, w.h, w.n, w.W, g0, WHITE_TOP, [], { wall: 'plaster' });
      continue;
    }
    // along Sergelgatan and Slöjdgatan: shops and a storey over them, the brick band, the white box
    const g = Math.max(ground(a[0], a[1]) ?? 10.5, ground(b[0], b[1]) ?? 10.5);
    const bays = Math.max(1, Math.round(w.W / 4.5)), bw = w.W / bays, ops: Opening[] = [];
    for (let k = 0; k < bays; k++) {
      const m = (k + 0.5) * bw;
      ops.push({ a0: m - bw / 2 + 0.35, a1: m + bw / 2 - 0.35, b0: g + 0.2, b1: g + 3.4, kind: 'shop' });
      if (g + 7.2 < SHOP_TOP - 0.4) ops.push({ a0: m - bw / 2 + 0.3, a1: m + bw / 2 - 0.3, b0: g + 4.8, b1: g + 7.2, kind: 'win' });
    }
    B.tint(DARK);
    wallWithOpenings(B, w.o, w.h, w.n, w.W, g0, SHOP_TOP, ops, { wall: 'plaster', trim: null, depth: 0.25 });
    B.tint(BRICK);
    B.poly([[a[0], SHOP_TOP, a[1]], [b[0], SHOP_TOP, b[1]], [b[0], BRICK_TOP, b[1]], [a[0], BRICK_TOP, a[1]]], w.n, 'brick', 2);
    // the brick band's small square vents
    B.tint(0x3a3a3a);
    for (let k = 0; k < Math.floor(w.W / 6); k++) {
      const m = 3 + k * 6 + (w.W - Math.floor(w.W / 6) * 6) / 2;
      B.wallBox(w.o, w.h, w.n, m - 0.4, m + 0.4, (SHOP_TOP + BRICK_TOP) / 2 + 0.6, (SHOP_TOP + BRICK_TOP) / 2 + 1.4, -0.02, 0.03, 'metal', 2, ['back']);
    }
    // the white box, from where it stands back from the glass front
    const za = local(a)[1], zb = local(b)[1], t = Math.min(1, Math.max(0, (BOX_Z - za) / (zb - za || 1e-9)));
    const [w0, w1] = za < BOX_Z ? [t * w.W, w.W] : [0, (zb < BOX_Z ? t : 1) * w.W];
    if (w1 - w0 > 0.05) {
      const p0 = [a[0] + (b[0] - a[0]) * (w0 / w.W), a[1] + (b[1] - a[1]) * (w0 / w.W)], p1 = [a[0] + (b[0] - a[0]) * (w1 / w.W), a[1] + (b[1] - a[1]) * (w1 / w.W)];
      B.tint(WHITE);
      B.poly([[p0[0], BRICK_TOP, p0[1]], [p1[0], BRICK_TOP, p1[1]], [p1[0], WHITE_TOP, p1[1]], [p0[0], WHITE_TOP, p0[1]]], w.n, 'plaster', 4);
    }
    // before it, a strip of white up to the glass front's roof
    const [f0, f1] = za < BOX_Z ? [0, w0] : [w1, w.W];
    if (f1 - f0 > 0.05) {
      B.tint(WHITE);
      B.wallBox(w.o, w.h, w.n, f0, f1, BRICK_TOP, GLASS_TOP + 0.45, 0, 0.01, 'plaster', 4, ['back']);
    }
    // the white box's joints, and a ledge over the shops
    B.tint(FRAME);
    B.wallBox(w.o, w.h, w.n, 0, w.W, BRICK_TOP - 0.08, BRICK_TOP + 0.08, 0, 0.06, 'metal', 2, ['back']);
    if (w1 - w0 > 0.05) B.wallBox(w.o, w.h, w.n, w0, w1, 29.6 - 0.08, 29.6 + 0.08, 0, 0.06, 'metal', 2, ['back']);
    B.tint(0x9a9c9e);
    B.wallBox(w.o, w.h, w.n, 0, w.W, SHOP_TOP - 0.35, SHOP_TOP, 0, 0.9, 'concrete', 2, ['back']);
  }
  // ---- the glass front
  const a = poly[front[0]], b = poly[(front[front.length - 1] + 1) % n], f = wallOf(a, b, N[front[0]]);
  const g = Math.min(ground(a[0], a[1]) ?? 12.8, ground(b[0], b[1]) ?? 12.8);
  const bays = Math.round(f.W / 5.7), bw = f.W / bays;
  const P = (s: number, y: number, d = 0): V3 => [f.o[0] + f.h[0] * s + f.n[0] * d, y, f.o[2] + f.h[2] * s + f.n[2] * d];
  B.tint(0xffffff);
  for (let k = 0; k < bays; k++) {
    for (const [y0, y1, v] of [[g - 0.5, TRANSOM, 0], [TRANSOM, GLASS_TOP, 0.25]] as [number, number, number][]) {
      const s0 = k * bw, s1 = (k + 1) * bw, u = (k % 4) / 4;
      B.poly([P(s0, y0, -0.2), P(s1, y0, -0.2), P(s1, y1, -0.2), P(s0, y1, -0.2)], f.n, 'filmglass', 1,
        [[u, v], [u + 0.25, v], [u + 0.25, v + 0.25], [u, v + 0.25]]);
    }
  }
  // its frame: posts between the bays, the transom and the beam over it, standing proud
  B.tint(FRAME);
  for (let k = 0; k <= bays; k++) B.wallBox(f.o, f.h, f.n, k * bw - 0.2, k * bw + 0.2, g - 0.5, GLASS_TOP, -0.2, 0.35, 'metal', 2, ['back']);
  for (const [y0, y1] of [[TRANSOM - 0.2, TRANSOM + 0.2], [GLASS_TOP, GLASS_TOP + 0.45]]) B.wallBox(f.o, f.h, f.n, 0, f.W, y0, y1, -0.2, 0.3, 'metal', 2, ['back']);
  B.wallBox(f.o, f.h, f.n, 0, f.W, g - 0.5, g + 0.1, -0.2, 0.3, 'concrete', 2, ['back']);
  // its flat roof, back to the white box
  B.tint(ROOF);
  B.cap(FRONT, GLASS_TOP + 0.45, 'concrete');
  // the white box's face over it, and the name
  const bn = outward(BOX), bi = bn.findIndex((_, i) => local([AT[0] + bn[i][0], AT[1] + bn[i][1]])[1] < -0.7);
  const ba = BOX[bi], bb = BOX[(bi + 1) % BOX.length], k = wallOf(ba, bb, bn[bi]);
  const Q = (s: number, y: number, d = 0): V3 => [k.o[0] + k.h[0] * s + k.n[0] * d, y, k.o[2] + k.h[2] * s + k.n[2] * d];
  B.tint(WHITE);
  B.poly([Q(0, GLASS_TOP + 0.45), Q(k.W, GLASS_TOP + 0.45), Q(k.W, WHITE_TOP), Q(0, WHITE_TOP)], k.n, 'plaster', 4);
  B.tint(0xffffff);
  // (on its east end: the face runs west to east, right to left as seen from the square)
  B.poly([Q(k.W - 17.0, SIGN[0], 0.06), Q(k.W - 1.0, SIGN[0], 0.06), Q(k.W - 1.0, SIGN[1], 0.06), Q(k.W - 17.0, SIGN[1], 0.06)], k.n, 'filmsign', 1,
    [[1, 0], [0, 0], [0, 1], [1, 1]]);
  B.tint(FRAME);
  B.wallBox(k.o, k.h, k.n, 0, k.W, 29.6 - 0.08, 29.6 + 0.08, 0, 0.06, 'metal', 2, ['back']);
  // ---- the roof, its parapet, and the plant room set back on it with its vents
  B.tint(ROOF);
  B.cap(BOX, WHITE_TOP, 'concrete');
  B.tint(WHITE);
  B.sweep(BOX, [[0, WHITE_TOP], [0, WHITE_TOP + 0.6], [-0.3, WHITE_TOP + 0.6], [-0.3, WHITE_TOP]], 'plaster', 2);
  const plant = offset(BOX, -3.0);
  B.tint(0xd6d6d2);
  B.prism(plant, WHITE_TOP, PLANT_TOP, 'plaster', { cap: false });
  B.tint(ROOF);
  B.cap(plant, PLANT_TOP, 'concrete');
  B.tint(0xb9bcbd);
  for (const [x, z] of [[-6, -58], [2, -56], [-4, -46], [5, -42], [-6, -32], [3, -24], [-2, -14]] as V2[]) {
    const wx = AT[0] + x * C + z * S, wz = AT[1] - x * S + z * C;
    if (!inPoly(wx, wz, plant)) continue;
    B.box([wx - 0.9, PLANT_TOP, wz - 0.9], [wx + 0.9, PLANT_TOP + 1.1, wz + 0.9], 'metal', 2, ['-y']);
  }
}

// the other two as the city's ordinary buildings, at their own heights
function ordinary(B: Builder, ring: V2[], top: number, colour: [number, number, number], others: V2[][], ground: Ground) {
  const b: Building = { kind: 'building', roof: 'flat', bottom: Math.min(...ring.map(([x, z]) => ground(x, z) ?? 10.5)) - 1.5, top, roofHeight: 0, colour: null, rings: [ring], wall: 'plaster' };
  buildFacades(B, b, -1, colour, { ground, insideOther: (x, z) => others.some((o) => inPoly(x, z, o)) });
  B.tint(ROOF);
  B.cap(ring, top, 'concrete');
}

export function buildHotorgscityWest(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  buildFilmstaden(B, ground);
  ordinary(B, MIDDLE, MIDDLE_TOP, [0.88, 0.87, 0.84], [NORTH, SOUTH], ground);
  ordinary(B, SOUTH, SOUTH_TOP, [0.91, 0.91, 0.89], [NORTH, MIDDLE], ground);
  // the stage house's copper roofs: a low one, and a higher one on a white box behind it
  B.place([AT[0], 0, AT[1]], TURN);
  B.tint(0xffffff);
  B.hipped([-7, 15, -5, 11], MIDDLE_TOP, 29.5, 'copper', 0.2);
  B.tint(WHITE);
  B.box([-3, MIDDLE_TOP, 14], [11, 30.4, 25], 'plaster', 4, ['-y', '+y']);
  B.tint(0xffffff);
  B.hipped([-3, 11, 14, 25], 30.4, 31.6, 'copper', 0.2);
  B.place([0, 0, 0], 0);
}

export const HOTORGSCITY_WEST = { name: 'Hötorgscity west', outline: RING, anchor: [214, -330] as V2, build: buildHotorgscityWest };
