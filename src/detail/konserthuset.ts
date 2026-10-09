import { Builder, type V2, type V3 } from './builder.ts';
import { wallWithOpenings, type Opening, type WallStyle } from './wall.ts';

// Konserthuset (Ivar Tengbom, 1926) on Hötorget, built in detail: the loggia of ten slender
// columns over its steps, the walls' windows set in with sills and surrounds, the profiled
// cornice, the attic, the hipped standing-seam roof and its six copper ventilators.
//
// Measured from a 3D model of the city (cornice 23.6 m over Hötorget, ridge 30.4 m, columns 16.5 m
// at 3.81 m) and laid on OpenStreetMap's outline (way 18779818). Model space: x along the building
// towards Sveavägen, z across it to the south-south-east, y up from Hötorget's paving.

export const KONSERTHUSET = { at: [230, 13.05, -395] as V3, turn: (26.614 * Math.PI) / 180 };

const WALL_TOP = 22.5, CORNICE_TOP = 23.6, ATTIC_TOP = 26.0, RIDGE = 30.4;
const PODIUM = 1.1, LOGGIA_TOP = 17.6, ENTABLATURE_TOP = 19.9, SOCLE = 1.0, SIDE_ROOF_TOP = 24.9;
const FOOT: V2[] = [[-29.2, -27.5], [23.5, -27.5], [23.5, -20.0], [30.1, -20.0], [30.1, 22.6], [-28.6, 22.6], [-28.6, 16.4],
  [-31.2, 16.4], [-31.2, -20.9], [-29.2, -20.9]];
// below the entablature the loggia is open and the wall stands back
const FOOT_LOW: V2[] = [[-29.2, -27.5], [23.5, -27.5], [23.5, -20.0], [30.1, -20.0], [30.1, 22.6], [-28.6, 22.6], [-28.6, 16.4], [-29.2, 16.4]];
const LOGGIA = [-31.2, -29.2, -20.9, 16.4];
const ROOF_RECT = [-28.3, 29.5, -16.5, 12.0];
const COLS_V = Array.from({ length: 10 }, (_, k) => -19.4 + (k * (14.9 + 19.4)) / 9);
const COL_R = 0.55;
const VENTS: V2[] = [-11.5, 1.5, 14.5].flatMap((u) => [-5.6, 1.2].map((v): V2 => [u, v]));

const BLUE = 0x93b6d8, PALE = 0xdde7ee, COLUMN = 0xa6c4df, ROOF = 0x545c70, WHITE = 0xffffff;
const WALLS: WallStyle = { wall: 'plaster', trim: 'plaster', depth: 0.32, surround: 0.16 };

type Face = 'N' | 'S' | 'NE' | 'E' | 'Wl';
// each face: where it starts, along it, out of it, its width and where a position along it falls
const FACES: Record<Face, { o: V2; h: V2; n: V2; W: number; a: (c: number) => number }> = {
  S: { o: [30.1, 22.6], h: [-1, 0], n: [0, 1], W: 58.7, a: (c) => 30.1 - c },
  N: { o: [-29.2, -27.5], h: [1, 0], n: [0, -1], W: 52.7, a: (c) => c + 29.2 },
  NE: { o: [23.5, -20.0], h: [1, 0], n: [0, -1], W: 6.6, a: (c) => c - 23.5 },
  E: { o: [30.1, -20.0], h: [0, 1], n: [1, 0], W: 42.6, a: (c) => c + 20.0 },
  Wl: { o: [-29.2, 16.4], h: [0, -1], n: [-1, 0], W: 37.3, a: (c) => 16.4 - c },
};

function openings() {
  const O: [Face | 'WA' | 'EA', number, number, number, number, Opening['kind']][] = [];
  const north = [21.3, 17.6, 13.7, 9.8, 5.9, 2.0, -2.0, -6.4, -10.8, -16.1, -20.5, -24.7];
  const south = [-25.4, -20.8, -16.1, -11.0, -6.6, -2.0, 2.4, 6.3, 10.3, 14.2, 18.1, 22.0, 26.2];
  const rows: V2[] = [[5.8, 7.1], [9.45, 10.75], [12.95, 14.25], [16.35, 17.65], [19.65, 20.95]];
  const tall = [9.8, 5.9, 2.0];
  for (const [face, cols] of [['N', north], ['S', south]] as const) {
    for (const c of cols) {
      O.push([face, c, 0.35, 3.1, 1.5, 'ground']);
      rows.forEach(([y0, y1], k) => {
        if (face === 'N' && tall.includes(c) && k <= 1) { if (k === 0) O.push([face, c, 4.6, 10.75, 1.25, 'tall']); return; }
        if (face === 'N' && c === -20.5 && (k === 1 || k === 2)) { if (k === 1) O.push([face, c, 9.45, 14.25, 1.25, 'tall']); return; }
        O.push([face, c, y0, y1, 1.05, 'win']);
      });
    }
  }
  for (const [y0, y1] of rows) O.push(['NE', 26.8, y0, y1, 1.05, 'win']);
  O.push(['NE', 26.8, 0.35, 3.1, 1.5, 'ground']);
  // towards Sveavägen: seven tall windows, balconies' windows over them and a row above
  for (const c of [9.3, 5.4, 1.5, -2.3, -6.3, -10.2, -14.1]) O.push(['E', c, 0.8, 6.9, 1.45, 'tall']);
  for (const c of [9.3, 1.5, -6.3, -14.1]) { O.push(['E', c, 9.3, 11.3, 1.15, 'win']); O.push(['E', c, 17.0, 18.4, 1.05, 'win']); }
  for (const c of [18.7, 13.2]) {
    O.push(['E', c, 0.35, 3.1, 1.4, 'ground']);
    for (const [y0, y1] of rows) O.push(['E', c, y0, y1, 1.05, 'win']);
  }
  // the loggia's back wall: five doors, with windows over them, in every other bay
  for (let k = 0; k < 9; k += 2) {
    const c = (COLS_V[k] + COLS_V[k + 1]) / 2;
    O.push(['Wl', c, PODIUM, PODIUM + 4.6, 2.0, 'door'], ['Wl', c, 8.4, 11.6, 1.5, 'tall'], ['Wl', c, 13.4, 15.4, 1.3, 'win']);
  }
  for (const c of [-10.0, -2.2, 5.5]) O.push(['WA', c, 24.3, 25.4, 1.3, 'win']);
  for (const c of [-6.3, 1.5]) O.push(['EA', c, 24.3, 25.4, 1.3, 'win']);
  return O;
}

const v3 = ([x, z]: V2, y = 0): V3 => [x, y, z];

function column(B: Builder, cx: number, cz: number, y0: number, y1: number) {
  B.tint(PALE);
  B.box([cx - 0.78, y0, cz - 0.78], [cx + 0.78, y0 + 0.35, cz + 0.78], 'stone', 2, ['-y']);
  const sh0 = y0 + 0.62, cap0 = y1 - 1.55;
  const prof: V2[] = [[0.72, y0 + 0.35], [0.72, y0 + 0.45], [0.66, y0 + 0.5], [0.62, y0 + 0.53], [0.66, y0 + 0.58], [COL_R, y0 + 0.62]];
  // the shaft, with a gentle entasis
  for (let k = 1; k <= 6; k++) {
    const t = k / 6;
    prof.push([COL_R * (1 - 0.13 * t ** 1.6) + 0.012 * Math.sin(Math.PI * t), sh0 + (cap0 - sh0) * t]);
  }
  const rt = prof[prof.length - 1][0];
  // the capital: a bell flaring out under its abacus
  prof.push([rt + 0.05, cap0], [rt + 0.05, cap0 + 0.08], [rt, cap0 + 0.1], [rt + 0.06, cap0 + 0.45], [rt + 0.02, cap0 + 0.5],
    [rt + 0.16, cap0 + 0.95], [rt + 0.1, cap0 + 1.0], [rt + 0.32, cap0 + 1.3]);
  B.tint(COLUMN);
  B.lathe(cx, cz, prof, 'plaster', 20);
  B.tint(PALE);
  B.box([cx - 0.86, y1 - 0.25, cz - 0.86], [cx + 0.86, y1, cz + 0.86], 'plaster', 2, ['+y']);
}

export function buildKonserthuset(B: Builder) {
  B.place(KONSERTHUSET.at, KONSERTHUSET.turn);
  const ops = openings();
  // ---- the walls, face by face, with their openings
  const byFace = new Map<string, Opening[]>();
  for (const [f, c, y0, y1, w, kind] of ops) {
    if (f === 'WA' || f === 'EA') continue;
    const a = FACES[f].a(c);
    (byFace.get(f) ?? byFace.set(f, []).get(f)!).push({ a0: a - w / 2, a1: a + w / 2, b0: y0, b1: y1, kind });
  }
  B.tint(BLUE);
  for (const f of ['N', 'S', 'NE', 'E', 'Wl'] as Face[]) {
    const F = FACES[f];
    wallWithOpenings(B, v3(F.o), v3(F.h), v3(F.n), F.W, f === 'Wl' ? PODIUM : -0.8, f === 'Wl' ? LOGGIA_TOP : WALL_TOP, byFace.get(f) ?? [], WALLS);
  }
  // the plain walls: the pavilions' fronts and returns on the west, the north-east step
  const plain: [V2, V2][] = [[[23.5, -27.5], [23.5, -20.0]], [[-28.6, 22.6], [-28.6, 16.4]], [[-29.2, -20.9], [-29.2, -27.5]],
    [[-28.6, 16.4], [-31.2, 16.4]], [[-31.2, -20.9], [-29.2, -20.9]]];
  for (const [a, b] of plain) {
    const W = Math.hypot(b[0] - a[0], b[1] - a[1]), h: V2 = [(b[0] - a[0]) / W, (b[1] - a[1]) / W];
    let n: V2 = [h[1], -h[0]];
    if (n[0] * (a[0] + b[0]) + n[1] * (a[1] + b[1]) < 0) n = [-n[0], -n[1]];
    wallWithOpenings(B, v3(a), v3(h), v3(n), W, -0.8, WALL_TOP, [], WALLS);
  }
  // the loggia: its front over the entablature, its ceiling, its end piers
  const [u0, u1, va, vb] = LOGGIA;
  B.poly([[u0, LOGGIA_TOP, va], [u0, LOGGIA_TOP, vb], [u0, WALL_TOP, vb], [u0, WALL_TOP, va]], [-1, 0, 0], 'plaster');
  B.tint(PALE);
  B.poly([[u0, LOGGIA_TOP, va], [u1, LOGGIA_TOP, va], [u1, LOGGIA_TOP, vb], [u0, LOGGIA_TOP, vb]], [0, -1, 0], 'plaster', 2);
  B.tint(BLUE);
  for (const [p, q] of [[va, va + 0.9], [vb - 0.9, vb]]) B.box([u0, -0.8, p], [u1, LOGGIA_TOP, q], 'plaster', 4, ['+y', '-y', '+x']);
  // its floor and the steps down to Hötorget
  B.tint(WHITE);
  B.poly([[u0, PODIUM, va], [u1, PODIUM, va], [u1, PODIUM, vb], [u0, PODIUM, vb]], [0, 1, 0], 'stone', 2);
  const steps = 7, run = 3.6;
  for (let k = 0; k < steps; k++) {
    const y = (PODIUM * (steps - k)) / steps, ua = u0 - (run * k) / steps, ub = u0 - (run * (k + 1)) / steps;
    B.box([ub, -0.8, va - 1.2], [ua, y, vb + 1.2], 'stone', 2, ['+x', '-y']);
  }
  // the entablature, and the columns under it
  B.tint(PALE);
  B.box([u0 - 0.15, LOGGIA_TOP, va], [u0, LOGGIA_TOP + 0.9, vb], 'plaster', 2, ['+x']);
  B.box([u0 - 0.25, ENTABLATURE_TOP - 0.3, va], [u0, ENTABLATURE_TOP, vb], 'plaster', 2, ['+x']);
  for (const v of COLS_V) column(B, (u0 + u1) / 2, v, PODIUM, LOGGIA_TOP);
  // the granite socle, and a string course over the ground floor
  B.tint(WHITE);
  B.sweep(FOOT_LOW, [[0, -0.8], [0.12, -0.8], [0.12, SOCLE], [0, SOCLE + 0.12]], 'stone');
  B.tint(PALE);
  B.sweep(FOOT, [[0, 4.0], [0.1, 4.0], [0.14, 4.15], [0.1, 4.3], [0, 4.3]], 'plaster', 2, [5, 6, 7, 8, 9]);
  // ---- the main cornice, copper on top
  const W0 = WALL_TOP;
  B.sweep(FOOT, [[0, W0], [0.08, W0], [0.08, W0 + 0.15], [0.22, W0 + 0.3], [0.32, W0 + 0.3], [0.6, W0 + 0.55], [0.75, W0 + 0.6],
    [0.75, W0 + 0.9], [0.85, W0 + 0.95], [0.85, CORNICE_TOP]], 'plaster');
  B.tint(WHITE);
  B.sweep(FOOT, [[0.85, CORNICE_TOP], [0.88, CORNICE_TOP + 0.06], [0.55, CORNICE_TOP + 0.12], [0, CORNICE_TOP + 0.12]], 'copper');
  const base = CORNICE_TOP + 0.12;
  B.tint(ROOF);
  B.cap(FOOT, base, 'roof');
  // ---- the attic, the lower roofs either side of it, and the main roof
  const side: V2[] = [[-25.0, -22.7], [22.5, -22.7], [22.5, 18.5], [-25.0, 18.5]];
  B.tint(BLUE);
  B.prism(side, base, SIDE_ROOF_TOP, 'plaster', { cap: false });
  B.tint(ROOF);
  B.cap(side, SIDE_ROOF_TOP, 'roof');
  B.tint(WHITE);
  B.sweep(side, [[0, SIDE_ROOF_TOP], [0.12, SIDE_ROOF_TOP], [0.12, SIDE_ROOF_TOP + 0.15], [0, SIDE_ROOF_TOP + 0.15]], 'copper');
  const attic: [string, V2, V2, V2][] = [['WA', [-28.3, 12.0], [-28.3, -16.5], [-1, 0]], ['EA', [29.5, -16.5], [29.5, 12.0], [1, 0]],
    ['NA', [29.5, 12.0], [-28.3, 12.0], [0, 1]], ['SA', [-28.3, -16.5], [29.5, -16.5], [0, -1]]];
  B.tint(BLUE);
  for (const [f, c0, c1, n] of attic) {
    const W = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]), h: V2 = [(c1[0] - c0[0]) / W, (c1[1] - c0[1]) / W];
    const o2: Opening[] = ops.filter((o) => o[0] === f).map(([, c, y0, y1, w, kind]) => {
      const a = Math.abs(c - c0[1]);
      return { a0: a - w / 2, a1: a + w / 2, b0: y0, b1: y1, kind };
    });
    wallWithOpenings(B, v3(c0), v3(h), v3(n), W, base, ATTIC_TOP, o2, { ...WALLS, depth: 0.25 });
  }
  B.tint(PALE);
  const atticRect: V2[] = [[-28.3, -16.5], [29.5, -16.5], [29.5, 12.0], [-28.3, 12.0]];
  B.sweep(atticRect, [[0, ATTIC_TOP - 0.35], [0.15, ATTIC_TOP - 0.35], [0.3, ATTIC_TOP - 0.1], [0.3, ATTIC_TOP], [0, ATTIC_TOP]], 'plaster');
  // a balustrade on the east cornice
  for (const vc of [13.2, 5.4, -2.2, -10.0, -17.6]) {
    B.box([29.75, base, vc - 1.0], [30.0, base + 0.13, vc + 1.0], 'plaster', 2, ['-y']);
    for (let k = 0; k < 7; k++) B.lathe(29.875, vc - 0.84 + k * 0.28, [[0.06, base + 0.13], [0.1, base + 0.33], [0.05, base + 0.63], [0.07, base + 0.73]], 'plaster', 6);
    B.box([29.7, base + 0.73, vc - 1.05], [30.05, base + 0.85, vc + 1.05], 'plaster', 2);
  }
  B.tint(ROOF);
  B.hipped(ROOF_RECT, ATTIC_TOP, RIDGE, 'roof', 0.3);
  // ---- the copper ventilators on the roof
  B.tint(WHITE);
  const slope = (RIDGE - ATTIC_TOP) / ((ROOF_RECT[3] - ROOF_RECT[2]) / 2 + 0.3), vc = (ROOF_RECT[2] + ROOF_RECT[3]) / 2;
  for (const [u, v] of VENTS) {
    const yb = RIDGE - Math.abs(v - vc) * slope - 0.4, hw = 1.0, hd = 1.25, top = yb + 1.5;
    B.box([u - hw, yb, v - hd], [u + hw, top, v + hd], 'copper', 2, ['-y']);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const y = yb + 0.45 + k * 0.3, z = v + s * hd;
      B.box([u - hw * 0.8, y, z - 0.03], [u + hw * 0.8, y + 0.12, z + 0.03], 'copper', 2);
    }
    const e = 0.1, apex: V3 = [u, top + 0.7, v];
    const a: V3 = [u - hw - e, top, v - hd - e], b: V3 = [u + hw + e, top, v - hd - e], c: V3 = [u + hw + e, top, v + hd + e], d: V3 = [u - hw - e, top, v + hd + e];
    B.poly([a, b, apex], [0, 0.8, -1], 'copper'); B.poly([c, d, apex], [0, 0.8, 1], 'copper');
    B.poly([b, c, apex], [1, 0.8, 0], 'copper'); B.poly([d, a, apex], [-1, 0.8, 0], 'copper');
    B.poly([a, b, c, d], [0, -1, 0], 'copper');
  }
}

// Konserthuset's outline in the world, which the city's plain block of it is found by.
export function konserthusetOutline(): V2[] {
  const { at, turn } = KONSERTHUSET, c = Math.cos(turn), s = Math.sin(turn);
  return FOOT.map(([x, z]) => [at[0] + x * c + z * s, at[2] - x * s + z * c]);
}
