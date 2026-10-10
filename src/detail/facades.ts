import type { Building, WallStyle as Style } from '../city-tile.ts';
import { Builder, outward, type V2, type V3 } from './builder.ts';
import { wallWithOpenings, type Opening, type WallStyle } from './wall.ts';

// The city's ordinary buildings with real facades, for near the camera: storeys of windows set
// into the walls, shop fronts on the ground floor, a socle, a string course and a cornice, in the
// style of the building's walls. Party walls against a neighbour are left plain. Only the walls up
// to the eaves are drawn here; the roof and any gable over the eaves stay the city's own.

const BAY = 3.0, STOREY = 2.95, CORNICE = 0.6;

export interface FacadeContext {
  ground: (x: number, z: number) => number | null;
  // whether (x, z) is inside another building than `self`
  insideOther: (x: number, z: number, self: number) => boolean;
}

// the walls' material and trim by the building's style
function look(style: Style, colour: [number, number, number]) {
  const light: [number, number, number] = colour.map((c) => c + (1 - c) * 0.55) as [number, number, number];
  switch (style) {
    case 'brick': return { wall: { wall: 'brick', wallTile: 2, trim: 'stone', depth: 0.22, surround: 0, sill: true } as WallStyle, trimTint: [0.92, 0.9, 0.86] as [number, number, number], cornice: 'stone', socle: true, string: false };
    case 'glass': return { wall: { wall: 'curtain', wallTile: [5, 13.6], trim: null, depth: 0.15 } as WallStyle, trimTint: [0.8, 0.82, 0.84] as [number, number, number], cornice: 'metal', socle: false, string: false };
    case 'plain': return { wall: { wall: 'concrete', wallTile: 4, trim: null, depth: 0.18 } as WallStyle, trimTint: light, cornice: 'concrete', socle: false, string: false };
    default: return { wall: { wall: 'plaster', wallTile: 4, trim: 'plaster', depth: 0.24, surround: 0.12, sill: true } as WallStyle, trimTint: light, cornice: 'plaster', socle: true, string: true };
  }
}

export function buildFacades(B: Builder, b: Building, self: number, colour: [number, number, number], ctx: FacadeContext) {
  if (b.kind === 'roof' || b.kind === 'shed') return;
  const top = b.roofMesh ? b.top : b.top + b.roofHeight / 2;
  const L = look(b.wall ?? 'plaster', colour);
  b.rings.forEach((ring, ri) => {
    const pts = ring as V2[];
    const N = outward(pts).map(([x, z]): V2 => (ri === 0 ? [x, z] : [-x, -z]));
    for (let e = 0; e < pts.length; e++) {
      const a = pts[e], c = pts[(e + 1) % pts.length];
      const W = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (W < 0.05) continue;
      const h: V3 = [(c[0] - a[0]) / W, 0, (c[1] - a[1]) / W], n: V3 = [N[e][0], 0, N[e][1]];
      const mid: V2 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      const party = ctx.insideOther(mid[0] + n[0] * 0.8, mid[1] + n[2] * 0.8, self);
      const g = Math.max(ctx.ground(a[0], a[1]) ?? b.bottom, ctx.ground(c[0], c[1]) ?? b.bottom, b.bottom);
      const o: V3 = [a[0], 0, a[1]];
      B.tint(colour);
      if (party || W < 2 || top - g < 2.6) {
        wallWithOpenings(B, o, h, n, W, b.bottom, top, [], L.wall);
        continue;
      }
      const ops = layout(W, g, top, b.bottom > g + 1 ? b.bottom : null, ri === 0, b.wall ?? 'plaster');
      // courtyards are seen only from afar: their windows flush
      wallWithOpenings(B, o, h, n, W, b.bottom, top, ops, ri === 0 ? L.wall : { ...L.wall, flush: true });
      if (ri > 0) continue;
      // socle, string course and cornice
      if (L.socle && b.bottom <= g + 1) { B.tint([0.9, 0.9, 0.9]); B.wallBox(o, h, n, 0, W, b.bottom, g + 0.6, 0, 0.06, 'stone', 2, ['back']); }
      B.tint(L.trimTint);
      const groundFloor = ops.find((p) => p.kind === 'shop');
      if (L.string && groundFloor && top - g > 8) B.wallBox(o, h, n, 0, W, g + 4.0, g + 4.25, 0, 0.1, L.cornice, 2, ['back']);
      if (top - g > 5) {
        const deep = L.cornice === 'plaster' ? 0.38 : 0.15;
        B.wallBox(o, h, n, 0, W, top - CORNICE, top - CORNICE + 0.2, 0, deep * 0.5, L.cornice, 2, ['back']);
        B.wallBox(o, h, n, 0, W, top - 0.25, top, 0, deep, L.cornice, 2, ['back']);
      }
    }
  });
}

// the openings of one wall W wide from the ground g up to the eaves; `lifted`: its bottom when it
// stands clear of the ground (no ground floor then)
function layout(W: number, g: number, top: number, lifted: number | null, street: boolean, style: Style): Opening[] {
  const ops: Opening[] = [];
  const nb = Math.max(1, Math.round(W / BAY)), bw = W / nb;
  if (bw < 1.6) return ops;
  const shopFloor = lifted === null && top - g >= 8;
  const ground = lifted ?? g;
  const G = shopFloor ? 4.0 : 0.0;
  const zone = top - CORNICE - (ground + G);
  const ns = Math.floor(zone / STOREY);
  const sh = ns > 0 ? zone / ns : 0;
  const ribbon = style === 'plain' || style === 'glass';
  const ww = ribbon ? bw * 0.72 : Math.min(1.4, Math.max(0.8, bw * 0.42)), wh = Math.min(ribbon ? 1.5 : 1.7, sh * 0.56);
  for (let i = 0; i < nb; i++) {
    const ac = (i + 0.5) * bw;
    if (shopFloor) {
      const door = i % 4 === 1 && nb > 2;
      if (street && style !== 'glass' && door) ops.push({ a0: ac - 0.9, a1: ac + 0.9, b0: g + 0.15, b1: g + 2.7, kind: 'door' });
      else if (street && style !== 'glass') ops.push({ a0: ac - bw * 0.39, a1: ac + bw * 0.39, b0: g + 0.25, b1: g + 3.1, kind: 'shop' });
      else if (!street) ops.push({ a0: ac - ww / 2, a1: ac + ww / 2, b0: g + 1.0, b1: g + 1.0 + wh, kind: 'win' });
    }
    if (style === 'glass') continue;
    for (let s = 0; s < ns; s++) {
      const fl = ground + G + s * sh;
      if (fl + sh * 0.3 < g + 0.4) continue;
      ops.push({ a0: ac - ww / 2, a1: ac + ww / 2, b0: fl + sh * 0.3, b1: fl + sh * 0.3 + wh, kind: 'win' });
    }
  }
  return ops;
}
