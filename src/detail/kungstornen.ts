import * as THREE from 'three';
import * as T from '../textures';
import { offset, type Builder, type V2, type V3 } from './builder.ts';
import { addMaterial, standard } from './materials.ts';
import { wallWithOpenings, type Opening, type WallStyle } from './wall.ts';

// Kungstornen, the twin towers either side of Kungsgatan at Malmskillnadsbron (Europe's first
// skyscrapers). Norra Kungstornet (Sven Wallander, 1924; 16 storeys, 60 m) is plastered pale and
// crowned by a salmon storey of three tall arches a side under a low copper roof. Södra
// Kungstornet (Ivar Callmander, 1925; 17 storeys, 61 m), built for L M Ericsson, has a storey of
// eight arched windows a side with gilt shells over them, a frieze of round windows over a copper band, four
// copper figures on its corners (Fortuna, Mercurius, Neptunus, Victoria, by Aron Sandberg) and a
// set-back top storey, once the restaurant Pagod, under a flared copper roof. Both are near square,
// three bays a side between broad corner piers and thin pilasters, on a granite base up to the
// bridge's deck.
//
// Measured from Google's 3D mesh of the city (the towers' sides straight on, their outlines and the
// heights of their storeys, cornices and roofs; its heights here sit 2.8 m below the laser scan's,
// so they are taken relative to Kungsgatan) and from Lantmäteriet's laser scan (Laserdata
// Nedladdning, skog, CC BY 4.0; Kungsgatan 10.6 m and the bridge's deck 22.7 m in RH 2000). The
// looks are drawn from photographs on Wikimedia Commons. In each tower's frame x runs along
// Kungsgatan to the east-north-east, z across it to the south, y up from Kungsgatan; metres.

interface Tower {
  at: V2; ground: number; turn: number; // its middle (world x, z), Kungsgatan's level (RH 2000), degrees
  hx: number; hz: number;               // half its size along and across
  street: 'N' | 'S';                    // its face on Kungsgatan
  rows: number[];                       // the windows' middles, up
  win: V2;                              // a window's width and height
  cols: number;                         // the window columns either side of the middle one
  stone: number;                        // the granite base's top
  shaftTop: number;                     // the main cornice's foot
}

const KUNGSGATAN = 10.6, TURN = 7.6;
const NORRA: Tower = {
  at: [370.04, -507.3], ground: KUNGSGATAN, turn: TURN, hx: 8.65, hz: 7.8, street: 'S',
  rows: Array.from({ length: 13 }, (_, k) => 7.1 + 3.4 * k), win: [1.5, 1.75], cols: 4.1, stone: 12.2, shaftTop: 48.7,
};
const SODRA: Tower = {
  at: [377.13, -465.64], ground: KUNGSGATAN, turn: TURN, hx: 8.5, hz: 8.1, street: 'N',
  rows: Array.from({ length: 15 }, (_, k) => 5.95 + 3.0 * k), win: [1.3, 1.8], cols: 4.4, stone: 10.4, shaftTop: 49.6,
};

const NORRA_WALL = 0xdcd2bf, NORRA_CROWN = 0xc99c86, SODRA_WALL = 0xd3c6aa;
const GRANITE = 0xe2ded6, GOLD = 0xd2ab55, DARK = 0x77746d, WHITE = 0xffffff;
const STYLE: WallStyle = { wall: 'plaster', trim: 'plaster', depth: 0.3, surround: 0 };

addMaterial('balustrade', () => standard(T.balustrade(), 0.85, 0, { alphaTest: 0.5, side: THREE.DoubleSide }));

type Face = { o: V2; h: V2; n: V2; W: number };
// the four faces of a rectangle of half sizes hx, hz: where each starts, along it, out of it
const faces = (hx: number, hz: number): Record<'N' | 'E' | 'S' | 'W', Face> => ({
  N: { o: [-hx, -hz], h: [1, 0], n: [0, -1], W: 2 * hx },
  E: { o: [hx, -hz], h: [0, 1], n: [1, 0], W: 2 * hz },
  S: { o: [hx, hz], h: [-1, 0], n: [0, 1], W: 2 * hx },
  W: { o: [-hx, hz], h: [0, -1], n: [-1, 0], W: 2 * hz },
});
const v3 = ([x, z]: V2, y = 0): V3 => [x, y, z];
const rect = (hx: number, hz: number): V2[] => [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];

// a wall of a face between y0 and y1, its openings given by their middles along it from its middle
function face(B: Builder, f: Face, y0: number, y1: number, ops: [number, number, number, number, Opening['kind']][], s = STYLE) {
  wallWithOpenings(B, v3(f.o), v3(f.h), v3(f.n), f.W, y0, y1,
    ops.map(([c, b0, b1, w, kind]) => ({ a0: f.W / 2 + c - w / 2, a1: f.W / 2 + c + w / 2, b0, b1, kind })), s);
}

// a strip of balustrade round a rectangle, inset from its edge
function balustrade(B: Builder, hx: number, hz: number, y: number, h = 0.9) {
  const was = B.colour;
  for (const f of Object.values(faces(hx, hz))) {
    const a = v3(f.o), b: V3 = [f.o[0] + f.h[0] * f.W, 0, f.o[1] + f.h[1] * f.W];
    B.poly([[a[0], y, a[2]], [b[0], y, b[2]], [b[0], y + h, b[2]], [a[0], y + h, a[2]]], v3(f.n), 'balustrade', 1,
      [[0, 0], [f.W, 0], [f.W, 1], [0, 1]]);
  }
  B.tint(was);
  B.sweep(rect(hx, hz), [[0.12, y + h - 0.02], [0.12, y + h + 0.1], [-0.12, y + h + 0.1], [-0.12, y + h - 0.02]], 'plaster');
}

// the shaft: the walls with their windows, the granite base, the corner piers and pilasters
function shaft(B: Builder, t: Tower, wall: number) {
  const F = faces(t.hx, t.hz), [ww, wh] = t.win;
  for (const [k, f] of Object.entries(F) as ['N' | 'E' | 'S' | 'W', Face][]) {
    const cols = [-t.cols, 0, t.cols];
    const low: [number, number, number, number, Opening['kind']][] = [], high: typeof low = [];
    for (const y of t.rows) for (const c of cols) (y + wh / 2 < t.stone ? low : high).push([c, y - wh / 2, y + wh / 2, ww, 'win']);
    if (k === t.street) {
      // the door in the middle of the street front, shop windows either side
      low.push([0, 0, 3.6, 2.2, 'door'], [-t.cols, 0.5, 3.6, 2.4, 'ground'], [t.cols, 0.5, 3.6, 2.4, 'ground']);
    }
    B.tint(GRANITE);
    face(B, f, -1.5, t.stone, low, { ...STYLE, wall: 'stone', trim: 'stone' });
    B.tint(wall);
    face(B, f, t.stone, t.shaftTop, high);
    // the corner piers and the pilasters between the bays, standing proud of the wall
    const o = v3(f.o), h = v3(f.h), n = v3(f.n);
    B.wallBox(o, h, n, -0.35, 1.7, t.stone, t.shaftTop, 0, 0.35, 'plaster', 2, ['back', 'bottom', 'top']);
    B.wallBox(o, h, n, f.W - 1.7, f.W + 0.35, t.stone, t.shaftTop, 0, 0.35, 'plaster', 2, ['back', 'bottom', 'top']);
    for (const c of [-t.cols / 2, t.cols / 2]) B.wallBox(o, h, n, f.W / 2 + c - 0.3, f.W / 2 + c + 0.3, t.stone, t.shaftTop, 0, 0.22, 'plaster', 2, ['back', 'bottom', 'top']);
  }
  // the granite's top, and the main cornice
  B.tint(GRANITE);
  B.sweep(rect(t.hx, t.hz), [[0, t.stone], [0.3, t.stone], [0.3, t.stone + 0.35], [0, t.stone + 0.35]], 'stone');
  B.tint(wall);
  const y = t.shaftTop;
  B.sweep(rect(t.hx, t.hz), [[0.35, y], [0.45, y + 0.1], [0.45, y + 0.25], [0.75, y + 0.5], [0.8, y + 0.65], [0.8, y + 0.72]], 'plaster');
  B.tint(WHITE);
  B.sweep(rect(t.hx, t.hz), [[0.8, y + 0.72], [0.83, y + 0.76], [0.3, y + 0.8], [0, y + 0.8]], 'copper');
}

// a semicircle in the plane of a face, from its middle c along it at height y, r round
function halfDisc(B: Builder, f: Face, c: number, y: number, r: number, out: number, mat: string, seg = 8, uv = false) {
  const o = v3(f.o), h = v3(f.h), n = v3(f.n), a = f.W / 2 + c;
  const P = (dx: number, dy: number): V3 => [o[0] + h[0] * (a + dx) + n[0] * out, y + dy, o[2] + h[2] * (a + dx) + n[2] * out];
  const pts: V3[] = [P(0, 0)], uvs: V2[] = [[0.5, 0]];
  for (let k = 0; k <= seg; k++) {
    const t = Math.PI * (1 - k / seg);
    pts.push(P(r * Math.cos(t), r * Math.sin(t)));
    uvs.push([0.5 + 0.5 * Math.cos(t), Math.sin(t)]);
  }
  for (let k = 1; k <= seg; k++) B.poly([pts[0], pts[k], pts[k + 1]], n, mat, 2, uv ? [uvs[0], uvs[k], uvs[k + 1]] : undefined);
}

// a flagpole with a ball on top
function flagpole(B: Builder, x: number, z: number, y: number, h: number) {
  B.tint(0xe8e6e0);
  B.lathe(x, z, [[0.14, y], [0.14, y + 0.5], [0.06, y + 0.6], [0.05, y + h], [0, y + h]], 'metal', 6);
  B.tint(GOLD);
  B.lathe(x, z, [[0, y + h], [0.12, y + h + 0.05], [0.14, y + h + 0.15], [0.1, y + h + 0.27], [0, y + h + 0.3]], 'metal', 6);
}

export function buildNorraKungstornet(B: Builder) {
  const t = NORRA;
  B.place([t.at[0], t.ground, t.at[1]], (t.turn * Math.PI) / 180);
  shaft(B, t, NORRA_WALL);
  // ---- the crown: three tall arches a side between paired pilasters, a copper band at their
  // springing, a frieze, the top cornice and a low copper roof
  const y0 = t.shaftTop + 0.8, spring = 54.1, frieze = spring + 0.25, top = 56.9, roof = 58.0, peak = 60.9;
  const F = faces(t.hx, t.hz);
  for (const f of Object.values(F)) {
    B.tint(NORRA_CROWN);
    const ops: [number, number, number, number, Opening['kind']][] = [-t.cols, 0, t.cols].map((c) => [c, y0 + 0.5, spring, 2.3, 'tall']);
    face(B, f, y0, spring, ops, { ...STYLE, depth: 0.45, sill: false });
    face(B, f, spring, top, []);
    const o = v3(f.o), h = v3(f.h), n = v3(f.n);
    for (const c of [-t.cols, 0, t.cols]) {
      // the arch's head, glazed
      halfDisc(B, f, c, spring, 1.15, 0.02, 'window', 8, true);
      B.tint(NORRA_CROWN);
      for (const s of [-1, 1]) B.wallBox(o, h, n, f.W / 2 + c + s * 1.45 - 0.25, f.W / 2 + c + s * 1.45 + 0.25, y0, spring, 0, 0.2, 'plaster', 2, ['back', 'bottom', 'top']);
      // the arch's moulding
      B.tint(NORRA_WALL);
      const a = f.W / 2 + c;
      for (let k = 0; k < 6; k++) {
        const t0 = (Math.PI * k) / 6, t1 = (Math.PI * (k + 1)) / 6, r0 = 1.15, r1 = 1.4;
        const P = (r: number, th: number): V3 => [o[0] + h[0] * (a + r * Math.cos(th)) + n[0] * 0.06, spring + r * Math.sin(th), o[2] + h[2] * (a + r * Math.cos(th)) + n[2] * 0.06];
        B.poly([P(r0, t0), P(r1, t0), P(r1, t1), P(r0, t1)], n, 'plaster', 2);
      }
    }
    B.tint(NORRA_CROWN);
    B.wallBox(o, h, n, -0.25, 1.2, y0, top, 0, 0.25, 'plaster', 2, ['back', 'bottom', 'top']);
    B.wallBox(o, h, n, f.W - 1.2, f.W + 0.25, y0, top, 0, 0.25, 'plaster', 2, ['back', 'bottom', 'top']);
  }
  // the copper band at the arches' springing, and the top cornice
  B.tint(WHITE);
  B.sweep(rect(t.hx, t.hz), [[0, spring], [0.3, spring], [0.3, frieze], [0, frieze]], 'copper');
  B.tint(NORRA_CROWN);
  B.sweep(rect(t.hx, t.hz), [[0.25, top], [0.3, top + 0.15], [0.55, top + 0.6], [0.6, roof - 0.1]], 'plaster');
  B.tint(WHITE);
  B.sweep(rect(t.hx, t.hz), [[0.6, roof - 0.1], [0.62, roof], [0, roof]], 'copper');
  // the roof: a steep copper skirt, then a shallow slope up to a flat top
  B.sweep(rect(t.hx, t.hz), [[0, roof], [-1.05, roof + 1.9], [-5.0, peak]], 'copper', 2);
  B.cap(offset(rect(t.hx, t.hz), -5.0), peak, 'copper', 2);
  for (const [x, z] of [[-1, -1], [1, 1]] as V2[]) flagpole(B, x * (t.hx - 1.8), z * (t.hz - 1.8), roof + 1.4, 5.5);
  B.place([0, 0, 0], 0);
}

export function buildSodraKungstornet(B: Builder) {
  const t = SODRA;
  B.place([t.at[0], t.ground, t.at[1]], (t.turn * Math.PI) / 180);
  shaft(B, t, SODRA_WALL);
  // ---- the crown, set in 0.4 m: a storey of eight arched windows a side, gilt shells over them,
  // a copper band and a frieze of round windows, the top cornice with its balustrade
  const base = t.shaftTop + 0.8, ix = t.hx - 0.4, iz = t.hz - 0.4;
  const win0 = base + 0.4, win1 = 52.9, band = 53.5, frieze = 53.9, top = 55.9, cornice = 56.7;
  const F = faces(ix, iz);
  for (const f of Object.values(F)) {
    const n8 = 8, step = (f.W - 2.6) / n8, cs = Array.from({ length: n8 }, (_, k) => -f.W / 2 + 1.3 + step * (k + 0.5));
    B.tint(SODRA_WALL);
    face(B, f, base, band, cs.map((c) => [c, win0, win1, 1.0, 'tall']), { ...STYLE, depth: 0.35, sill: false });
    const o = v3(f.o), h = v3(f.h), n = v3(f.n);
    // the pilasters between the windows
    for (let k = 0; k <= n8; k++) {
      const a = 1.3 + step * k;
      B.wallBox(o, h, n, a - 0.2, a + 0.2, base, band, 0, 0.15, 'plaster', 2, ['back', 'bottom', 'top']);
    }
    // the shells, and the green band and frieze with its round windows
    B.tint(GOLD);
    for (const c of cs) halfDisc(B, f, c, win1, 0.5, 0.02, 'plaster', 6);
    B.tint(SODRA_WALL);
    face(B, f, band, top, []);
    for (const c of cs) {
      const a = f.W / 2 + c, yc = (frieze + top) / 2, r = 0.38, ring: V3[] = [];
      for (let k = 0; k < 8; k++) {
        const th = (Math.PI * 2 * k) / 8;
        ring.push([o[0] + h[0] * (a + r * Math.cos(th)) + n[0] * 0.02, yc + r * Math.sin(th), o[2] + h[2] * (a + r * Math.cos(th)) + n[2] * 0.02]);
      }
      B.tint(WHITE);
      B.poly(ring, n, 'window', 1, ring.map((_, k) => [0.125 + 0.1 * Math.cos((Math.PI * 2 * k) / 8), 0.5 + 0.4 * Math.sin((Math.PI * 2 * k) / 8)] as V2));
    }
  }
  // the balustrade on the main cornice, and the band's edges
  B.tint(SODRA_WALL);
  B.cap(rect(t.hx, t.hz), base, 'plaster');
  balustrade(B, t.hx + 0.2, t.hz + 0.2, base, 0.85);
  B.tint(WHITE);
  B.sweep(rect(ix, iz), [[0, band], [0.12, band], [0.12, frieze], [0, frieze]], 'copper');
  B.tint(SODRA_WALL);
  B.sweep(rect(ix, iz), [[0, top], [0.1, top + 0.1], [0.45, top + 0.5], [0.5, cornice - 0.08]], 'plaster');
  B.tint(WHITE);
  B.sweep(rect(ix, iz), [[0.5, cornice - 0.08], [0.52, cornice], [0, cornice]], 'copper');
  B.tint(SODRA_WALL);
  B.cap(rect(ix, iz), cornice, 'plaster');
  balustrade(B, ix + 0.3, iz + 0.3, cornice, 0.8);
  // the four figures on the corners of the main cornice, in copper on plinths
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as V2[]) {
    const x = sx * (t.hx + 0.05), z = sz * (t.hz + 0.05);
    B.tint(SODRA_WALL);
    B.box([x - 0.45, base, z - 0.45], [x + 0.45, base + 0.7, z + 0.45], 'plaster', 2, ['-y']);
    B.tint(0xd6e6de);
    B.lathe(x, z, [[0.32, base + 0.7], [0.3, base + 1.1], [0.24, base + 1.6], [0.26, base + 2.1], [0.18, base + 2.3], [0.12, base + 2.4],
      [0.15, base + 2.6], [0.1, base + 2.8], [0, base + 2.85]], 'copper', 8);
    // an arm raised with a staff or a torch
    B.box([x - 0.05, base + 2.0, z - 0.05], [x + 0.05, base + 3.3, z + 0.05], 'copper', 2);
    flagpole(B, sx * (ix + 0.1), sz * (iz + 0.1), cornice + 0.9, 4.5);
  }
  // ---- the set-back top storey (the restaurant Pagod) and its flared copper roof
  const tx = 6.5, tz = 6.1, eave = 59.6, peak = 61.6;
  for (const f of Object.values(faces(tx, tz))) {
    B.tint(DARK);
    const k = 4, cs = Array.from({ length: k }, (_, i) => -f.W / 2 + (f.W * (i + 0.5)) / k);
    face(B, f, cornice, eave, cs.map((c) => [c, cornice + 0.8, eave - 0.4, 1.6, 'win']), { ...STYLE, depth: 0.15, sill: false });
  }
  B.tint(WHITE);
  B.sweep(rect(tx, tz), [[0, eave - 0.3], [1.0, eave - 0.45], [0.9, eave - 0.3], [0.45, eave + 0.1], [-5.6, peak]], 'copper', 2);
  B.cap(offset(rect(tx, tz), -5.6), peak, 'copper', 2);
  B.place([0, 0, 0], 0);
}

// the towers' outlines in the world, which the city's plain blocks of them are found by
const outline = (t: Tower): V2[] => {
  const a = (t.turn * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return rect(t.hx, t.hz).map(([x, z]) => [t.at[0] + x * c + z * s, t.at[1] - x * s + z * c]);
};
export const KUNGSTORNEN = [
  { name: 'Norra Kungstornet', outline: outline(NORRA), anchor: NORRA.at, build: buildNorraKungstornet },
  { name: 'Södra Kungstornet', outline: outline(SODRA), anchor: SODRA.at, build: buildSodraKungstornet },
];
