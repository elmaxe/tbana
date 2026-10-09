import type { Builder, V2, V3 } from './builder.ts';

// The five Hötorget towers (Hötorgsskraporna, 1955–66): slabs of 18 storeys over a glazed ground
// storey, their long sides curtain walls of glass and aluminium with fins at every other panel,
// their ends closed in dark glass, and on top a set-back roof storey under a thin projecting slab.
// Each is fitted to its outline in the city's data, a rectangle but for small steps at the ends.

// their outlines (world x, z) and the ground they stand on, from the city tiles
const OUTLINES: { ring: V2[]; ground: number }[] = [
  { ground: 12.2, ring: [[232.7, -343.7], [267.6, -360.1], [269.2, -356.7], [270, -357.1], [271.9, -357.9], [276.4, -348.4], [272.4, -346.5], [263.8, -342.4], [262.4, -342.7], [262.2, -341.7], [237, -329.9], [233.2, -337.9], [235, -338.8]] },
  { ground: 11.6, ring: [[272.7, -316.2], [281.5, -320.2], [283.4, -316.4], [285.3, -317.3], [290, -307.2], [286.6, -305.6], [250.4, -288.8], [246.5, -297.1], [247.6, -297.6], [244.9, -303.2]] },
  { ground: 10.9, ring: [[296.8, -279.5], [298.2, -280.2], [304.8, -266.3], [300.4, -264.3], [264.3, -247.4], [260, -256.6], [261.4, -257.3], [259.2, -261.9]] },
  { ground: 10.7, ring: [[307.7, -237.5], [308.4, -236.1], [310.3, -237], [315.6, -225.5], [313.1, -224.4], [298.6, -217.8], [276.8, -207.8], [273, -216.1], [274.7, -216.8], [272.6, -221.5]] },
  { ground: 10.4, ring: [[288.1, -174.3], [285.6, -179.6], [320.6, -196.1], [322.2, -192.9], [324.5, -194], [330.3, -181.9], [313.3, -173.9], [290.5, -163.1], [285.8, -173.2]] },
];

const HEIGHT = 72.5, GROUND_STOREY = 4.6, STOREYS = 18, ROOF_STOREY = 3.4;
const STOREY = (HEIGHT - GROUND_STOREY - ROOF_STOREY) / STOREYS;
const PANEL = 1.25; // curtain wall panels, along

const GLASS: V3 = [0.62, 0.74, 0.76], DARK: V3 = [0.24, 0.3, 0.31], ALU: V3 = [0.8, 0.82, 0.83], SLAB: V3 = [0.9, 0.9, 0.88];

export interface Tower { at: V3; turn: number; L: number; D: number; outline: V2[] }

// a rectangle round the outline, along its longest edge
function fit({ ring, ground }: { ring: V2[]; ground: number }): Tower {
  let best = 0, dir: V2 = [1, 0];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > best) { best = l; dir = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; }
  });
  const nrm: V2 = [-dir[1], dir[0]];
  const us = ring.map((p) => p[0] * dir[0] + p[1] * dir[1]), vs = ring.map((p) => p[0] * nrm[0] + p[1] * nrm[1]);
  const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
  const c: V2 = [dir[0] * uc + nrm[0] * vc, dir[1] * uc + nrm[1] * vc];
  // local x along `dir`, z along `nrm`: Builder.place turns x to (cos, −sin) and z to (sin, cos)
  const turn = Math.atan2(-dir[1], dir[0]);
  const L = u1 - u0, D = v1 - v0;
  const outline: V2[] = [[-L / 2, -D / 2], [L / 2, -D / 2], [L / 2, D / 2], [-L / 2, D / 2]].map(([x, z]) =>
    [c[0] + x * dir[0] + z * nrm[0], c[1] + x * dir[1] + z * nrm[1]]);
  return { at: [c[0], ground, c[1]], turn, L, D, outline };
}

export const TOWERS = OUTLINES.map(fit);

export function buildTower(B: Builder, t: Tower) {
  B.place(t.at, t.turn);
  const hl = t.L / 2, hd = t.D / 2, y0 = GROUND_STOREY, y1 = HEIGHT - ROOF_STOREY;
  // ---- the ground storey: glazing set back behind the columns that carry the slab
  const inset = 1.2;
  B.tint([1, 1, 1]);
  const gl = hl - inset, gd = hd - inset;
  const bays = Math.max(1, Math.round((2 * gl) / 3.2));
  for (const s of [-1, 1]) {
    const z = s * gd;
    B.poly([[-gl, -0.6, z], [gl, -0.6, z], [gl, y0, z], [-gl, y0, z]], [0, 0, s], 'shop', 1,
      [[0, 0], [bays, 0], [bays, 1], [0, 1]].map(([u, v]) => (s > 0 ? [u, v] : [bays - u, v]) as V2));
  }
  const ebays = Math.max(1, Math.round((2 * gd) / 3.2));
  for (const s of [-1, 1]) {
    const x = s * gl;
    B.poly([[x, -0.6, -gd], [x, -0.6, gd], [x, y0, gd], [x, y0, -gd]], [s, 0, 0], 'shop', 1,
      [[0, 0], [ebays, 0], [ebays, 1], [0, 1]].map(([u, v]) => (s < 0 ? [u, v] : [ebays - u, v]) as V2));
  }
  // its ceiling, and the columns at the edge of the slab
  B.tint(SLAB);
  B.poly([[-hl, y0, -hd], [hl, y0, -hd], [hl, y0, hd], [-hl, y0, hd]], [0, -1, 0], 'concrete', 4);
  const cols = Math.max(2, Math.round(t.L / 6.5));
  for (let i = 0; i <= cols; i++) for (const s of [-1, 1]) {
    const x = -hl + 0.5 + ((t.L - 1) * i) / cols, z = s * (hd - 0.5);
    B.box([x - 0.3, -0.6, z - 0.3], [x + 0.3, y0, z + 0.3], 'concrete', 2, ['+y', '-y']);
  }
  // ---- the slab: its floor edge, the long curtain walls, the dark ends
  B.tint(ALU);
  B.box([-hl, y0, -hd], [hl, y0 + 0.5, hd], 'metal', 2, ['+y', '-y']);
  const panels = Math.round(t.L / PANEL), endPanels = Math.round(t.D / PANEL);
  B.tint(GLASS);
  for (const s of [-1, 1]) {
    const z = s * hd;
    B.poly([[-hl, y0 + 0.5, z], [hl, y0 + 0.5, z], [hl, y1, z], [-hl, y1, z]], [0, 0, s], 'curtain', 1,
      [[0, 0], [panels, 0], [panels, STOREYS], [0, STOREYS]]);
  }
  B.tint(DARK);
  for (const s of [-1, 1]) {
    const x = s * hl;
    B.poly([[x, y0 + 0.5, -hd], [x, y0 + 0.5, hd], [x, y1, hd], [x, y1, -hd]], [s, 0, 0], 'curtain', 1,
      [[0, 0], [endPanels, 0], [endPanels, STOREYS], [0, STOREYS]]);
  }
  // the fins on the long sides, every other panel, and the corners' frames
  B.tint(ALU);
  for (const s of [-1, 1]) {
    for (let i = 0; i <= panels; i += 2) {
      const x = -hl + (t.L * i) / panels, z = s * hd;
      const [za, zb] = s > 0 ? [z, z + 0.22] : [z - 0.22, z];
      B.box([x - 0.05, y0 + 0.5, za], [x + 0.05, y1, zb], 'metal', 2, ['+y', '-y', s > 0 ? '-z' : '+z']);
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * hl, z = sz * hd;
    B.box([x - 0.18, y0 + 0.5, z - 0.18], [x + 0.18, y1, z + 0.18], 'metal', 2, ['+y', '-y']);
  }
  // ---- the top: a parapet band, the roof storey set back, the projecting roof slab, plant
  B.box([-hl - 0.05, y1, -hd - 0.05], [hl + 0.05, y1 + 0.7, hd + 0.05], 'metal', 2, ['-y']);
  const rl = hl - 1.6, rd = hd - 1.6, top = HEIGHT - 0.45;
  B.tint(DARK);
  B.box([-rl, y1 + 0.7, -rd], [rl, top, rd], 'curtain', 2, ['+y', '-y']);
  B.tint(SLAB);
  B.box([-hl - 0.35, top, -hd - 0.35], [hl + 0.35, HEIGHT, hd + 0.35], 'concrete', 3);
  B.tint([0.6, 0.6, 0.6]);
  B.box([-rl * 0.35, HEIGHT, -rd * 0.5], [rl * 0.35, HEIGHT + 2.2, rd * 0.5], 'metal', 2, ['-y']);
  B.place([0, 0, 0], 0);
}
