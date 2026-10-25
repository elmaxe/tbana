import type { Builder, V2, V3 } from './builder.ts';
import type { Ground } from './gubbangen.ts';
import { CONCRETE } from './farsta-line-north.ts';

// Söderledstunneln's mouths at Skanstull, where Söderleden comes off Johanneshovsbron
// (src/detail/johanneshovsbron.ts): the southbound carriageway and Ringvägen's ramps come out from
// under the hotel on Ringvägen along its southern front, and the northbound carriageway runs on in
// the open between the hotel and the offices east of it and goes under the hotel's north-eastern
// wing. The city draws the hotel (OpenStreetMap's outline) down to the street, and the streets up to
// its walls: here each mouth is a dark opening in the wall, framed in concrete. Where and how wide
// as Google's 3D mesh shows them, seen straight on.
//
// Each along a wall of the hotel from a to b (world x, z), the opening from and to along it.
const MOUTHS: { name: string; wall: [V2, V2]; at: V2 }[] = [
  { name: 'southbound', wall: [[920.3, 2778.2], [909.7, 2780.7]], at: [0.8, 10.1] },
  { name: "Ringvägen's ramps", wall: [[909.7, 2780.7], [864.6, 2790.2]], at: [3.5, 19.5] },
  { name: 'the ramp from the west', wall: [[909.7, 2780.7], [864.6, 2790.2]], at: [26.4, 34.6] },
  { name: 'northbound', wall: [[921, 2713.3], [906.4, 2716.2]], at: [0.9, 14.3] },
];
export const MOUTHS_ANCHOR: V2 = [900, 2750];
// (the dark clear of the facade's socle and window surrounds, src/detail/facades.ts)
const HEADROOM = 4.7, JAMB = 0.6, LINTEL = 1.1, DARK = 0.2, OUT = 0.5;

export function buildTunnelMouths(B: Builder, ground: Ground) {
  B.place([0, 0, 0], 0);
  for (const m of MOUTHS) {
    const [a, b] = m.wall, l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const h: V3 = [(b[0] - a[0]) / l, 0, (b[1] - a[1]) / l];
    // facing out of the hotel, to the south
    const n: V3 = h[0] < 0 ? [h[2], 0, -h[0]] : [-h[2], 0, h[0]];
    const o: V3 = [a[0], 0, a[1]];
    // the road's level: the ground just out of the opening, the lowest across it
    const [s0, s1] = m.at;
    const y = Math.min(...[s0, (s0 + s1) / 2, s1].map((s) => ground(a[0] + h[0] * s + n[0] * 1.5, a[1] + h[2] * s + n[2] * 1.5) ?? Infinity));
    if (!Number.isFinite(y)) continue;
    const top = y + HEADROOM;
    // the dark of the tunnel, just out from the wall
    B.tint(0x161718);
    B.wallBox(o, h, n, s0, s1, y - 0.5, top, 0, DARK, 'concrete', 2, ['back', 'top', 'bottom', 'left', 'right']);
    // the frame: a jamb each side and the lintel over them
    B.tint(CONCRETE);
    B.wallBox(o, h, n, s0 - JAMB, s0, y - 0.3, top, 0, OUT, 'concrete', 2, ['back', 'bottom']);
    B.wallBox(o, h, n, s1, s1 + JAMB, y - 0.3, top, 0, OUT, 'concrete', 2, ['back', 'bottom']);
    B.wallBox(o, h, n, s0 - JAMB, s1 + JAMB, top, top + LINTEL, 0, OUT, 'concrete', 2, ['back']);
  }
}
