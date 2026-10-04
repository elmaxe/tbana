import * as THREE from 'three';
import { merge } from './kit';
import {
  liningProfile, seating, pole, rail, moquette, glowMat, Parts, freeStretches,
  endWallMaterial, screenTexture, portalLoop,
} from './interior';
import type { Painter } from './kit';
import type { InteriorContext, InteriorMaterials, InteriorSpec, Seating, Vec3 } from './interior';
import { DOOR, windowFrames } from './c30';
import type { CarDef } from './train';

// C30 interior, from photos of cars in service (2019–2024) and Bombardier's press pictures.
// See docs/rolling-stock.md for the research notes.
//
// White walls, a light grey speckled floor and a white ceiling with a band of round downlights and
// a light line along each side. Grab poles are stainless with a yellow sleeve. Between the doors
// one side has three transverse rows of two seats (a facing bay plus one more row) and the other a
// bench of four seats along the wall next to a flex area for prams and wheelchairs; the sides swap
// from one zone to the next. The car ends have two seats a side. Seat backs are woven in the
// "Plattan" triangle pattern, navy and blue-grey, or in yellow on priority seats. Over each door
// area hangs a round lamp inside a stainless ring handle. The cars are joined by wide octagonal
// gangways with pale grey bellows and light lines round the portals.

const F = 1.0;      // floor above the rail (the real floor is at 1.155 m; the model's platforms are lower)
const IW = 1.385;   // inner half-width at the floor
const prof = liningProfile([
  [0, F], [IW, F, 0.03], [IW, 1.95, 0.8], [1.335, 2.96, 0.08], [1.03, 3.2, 0.04], [1.0, 3.36, 0.04], [0, 3.38],
]);
const G = 0.16; // how strongly the interior glows (stands in for its lighting)

// t (arc length) where the lining crosses z on the floor / on the ceiling
function tAt(z: number, part: 'floor' | 'ceiling') {
  const list = prof.pts.filter((p) => (part === 'floor' ? p.y < F + 0.01 : p.y > 3.3)).sort((a, b) => a.z - b.z);
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    if (z <= b.z) return a.t + ((z - a.z) / (b.z - a.z || 1)) * (b.t - a.t);
  }
  return list[list.length - 1].t;
}

const C = {
  wall: { c: '#eaecea', r: 0.45 },
  ceiling: { c: '#eef0ee', r: 0.6, g: 1.1 },
  floor: { c: '#c3c4bf', r: 0.75 },
  fleck: { c: '#8f918c', r: 0.75 },
  fleckL: { c: '#e2e3df', r: 0.75 },
  steel: { c: '#b4b8bb', r: 0.3, m: 0.85 },
  reveal: { c: '#f2f3f1', r: 0.35 },
  seal: { c: '#1d2024', r: 0.6 },
  door: { c: '#1f262e', r: 0.35 },
  hole: { c: '#000', a: 0 },
  vent: { c: '#8d9296', r: 0.35, m: 0.7 },
  slot: { c: '#55595d', r: 0.5 },
  light: { c: '#ffffff', e: '#fffaf0' },
  green: { c: '#38d27a', e: '#26e070' },
  panel: { c: '#16191e', r: 0.4 },
  red: { c: '#e3242b', r: 0.5, e: '#3a0808' },
  tft: { c: '#20356e', e: '#3c5aa8' },
  tftPink: { c: '#e0478f', e: '#b03070' },
  white: { c: '#ffffff', e: '#bbbbbb' },
  adFrame: { c: '#d9dcdc', r: 0.4, m: 0.4 },
  dot: { c: '#ffffff', e: '#f4f8ff' },
};

// Colours of the paper adverts in the frames along the coves.
const ADS = [['#c43a62', '#f4d3dc'], ['#2b5d9b', '#eef2f7'], ['#f1b51c', '#2b2b2b'], ['#3c8a5a', '#f1efe6'], ['#5b3f8f', '#f5e9ff']];

function paint(p: Painter, def: CarDef, { xa, xb, x0, x1 }: InteriorContext) {
  const floorEdge = tAt(IW, 'floor');
  p.rectT(xa, xb, prof.tMin, prof.tMax, C.wall);
  // floor: speckled vinyl
  p.rectT(xa, xb, prof.tMin, floorEdge, C.floor);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const m of [C.fleck, C.fleckL]) {
    p.fill((ctx) => {
      const N = Math.round(90 * (xb - xa));
      for (let i = 0; i < N; i++) ctx.rect(xa + rnd() * (xb - xa), prof.tMin + rnd() * (floorEdge - prof.tMin), 0.014, 0.014);
    }, m);
  }
  // brushed stainless plinth along the bottom of the wall (heaters)
  p.rect(xa, xb, F, F + 0.3, C.steel);
  for (let x = xa + 0.1; x < xb - 0.1; x += 0.06) p.rect(x, x + 0.025, F + 0.08, F + 0.2, C.vent);
  // ceiling: the light line along the edge of the cove, louvres above it, downlights, air slots
  p.rect(xa, xb, 3.205, 3.3, C.light);
  const tc = (z: number) => tAt(z, 'ceiling');
  p.rectT(xa, xb, tc(0.995), tc(0), C.ceiling);
  for (let z = 0.94; z > 0.88; z -= 0.02) p.rectT(xa, xb, tc(z), tc(z) + 0.008, C.slot);
  for (const z of [0.1, 0.16]) p.rectT(xa, xb, tc(z), tc(z) + 0.014, C.slot);
  const tl = tc(0.76);
  p.fill((ctx) => {
    for (let x = xa + 0.45; x < xb - 0.3; x += 0.7) { ctx.moveTo(x + 0.065, tl); ctx.ellipse(x, tl, 0.065, 0.065, 0, 0, Math.PI * 2); }
  }, C.dot);

  windowFrames(def, x0, x1).forEach(([a, b], i) => {
    // deep rounded reveal, the opening (matching the glass outside), vent strip below
    p.rect(a - 0.04, b + 0.04, 1.84, 2.99, C.reveal, 0.22);
    p.rect(a + 0.035, b - 0.035, 1.935, 2.895, C.seal, 0.13);
    p.rect(a + 0.05, b - 0.05, 1.95, 2.88, C.hole, 0.12);
    p.rect(a + 0.15, b - 0.15, 1.865, 1.9, C.vent, 0.01);
    // an advert frame on the sloping panel above
    const w = Math.min(1.05, b - a - 0.1), c = (a + b) / 2;
    if (w > 0.4) {
      const [bg, fg] = ADS[(((i + Math.round(x0)) % ADS.length) + ADS.length) % ADS.length];
      p.rect(c - w / 2, c + w / 2, 2.99, 3.18, C.adFrame);
      p.rect(c - w / 2 + 0.02, c + w / 2 - 0.02, 3.0, 3.17, { c: fg, r: 0.5, e: '#202020' });
      p.rect(c - w / 2 + 0.02, c - w / 2 + 0.02 + w * 0.4, 3.0, 3.17, { c: bg, r: 0.5 });
    }
  });
  for (const d of def.doors) {
    const da = d - DOOR / 2, db = d + DOOR / 2;
    // pillars with the green door light on their inner sides and over the doorway
    p.rect(da - 0.07, db + 0.07, F, 3.1, C.reveal, 0.17);
    p.rect(da - 0.03, da - 0.01, F + 0.4, 3.04, C.green);
    p.rect(db + 0.01, db + 0.03, F + 0.4, 3.04, C.green);
    p.rect(da, db, 3.06, 3.09, C.green);
    // dark leaves with stainless kick plates, the windows, open buttons
    p.rect(da, db, F, 3.04, C.door, 0.15);
    p.rect(da + 0.02, db - 0.02, F, F + 0.28, C.steel);
    p.rect(d - 0.012, d + 0.012, F, 3.04, C.seal);
    for (const s of [-1, 1]) {
      const c = d + s * DOOR / 4;
      p.rect(c - 0.225, c + 0.225, 1.5, 2.88, C.seal, 0.1);
      p.rect(c - 0.21, c + 0.21, 1.52, 2.86, C.hole, 0.09);
      p.ellipse(d + s * 0.12, F + 1.1, 0.04, 0.04, C.white);
      p.ellipse(d + s * 0.12, F + 1.1, 0.03, 0.03, C.green);
    }
    // above the door: a black panel with the line's strip map and a small screen
    p.rect(da, db, 3.0, 3.18, C.panel);
    p.rect(da + 0.06, da + 0.06 + DOOR * 0.62, 3.085, 3.095, C.red);
    for (let k = 0; k < 9; k++) p.ellipse(da + 0.08 + k * DOOR * 0.62 / 8, 3.09, 0.012, 0.012, C.white);
    p.rect(db - 0.5, db - 0.06, 3.03, 3.15, C.tft);
    p.rect(db - 0.5, db - 0.36, 3.03, 3.15, C.tftPink);
    // stainless threshold with black ribs
    p.rectT(da, db, floorEdge - 0.16, floorEdge, C.steel);
    for (let k = 0; k < 3; k++) p.rectT(da, db, floorEdge - 0.14 + k * 0.04, floorEdge - 0.125 + k * 0.04, C.seal);
  }
}

// ------------------------------------------------------------------ materials

// "Plattan": big tilted triangles in two tones, after the paving of Sergels torg.
function plattan(ctx: CanvasRenderingContext2D, n: number, dark: string, light: string) {
  ctx.fillStyle = light; ctx.fillRect(0, 0, n, n);
  ctx.fillStyle = dark;
  const w = n / 2;
  for (let row = 0; row < 2; row++) {
    for (let i = -1; i < 3; i++) {
      const x = i * w + (row ? w / 2 : 0), y0 = (row * n) / 2, y1 = y0 + n / 2;
      ctx.beginPath();
      ctx.moveTo(x, y1); ctx.lineTo(x + w / 2, y0); ctx.lineTo(x + w, y1);
      ctx.fill();
    }
  }
  weave(ctx, n);
}

function weave(ctx: CanvasRenderingContext2D, n: number) {
  ctx.globalAlpha = 0.06;
  for (let y = 0; y < n; y += 2) for (let x = (y / 2) % 2; x < n; x += 2) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1, 1); }
  ctx.globalAlpha = 1;
}

function plain(ctx: CanvasRenderingContext2D, n: number, col: string) {
  ctx.fillStyle = col; ctx.fillRect(0, 0, n, n);
  weave(ctx, n);
}

function materials(): InteriorMaterials {
  const tex = (draw: (ctx: CanvasRenderingContext2D, n: number) => void, size: number, n?: number) => moquette(draw, size, n);
  return {
    wall: glowMat('#eaecea', { glow: G, roughness: 0.5, side: THREE.DoubleSide }),
    bellows: glowMat('#9a9ea2', { glow: G, roughness: 0.85, side: THREE.DoubleSide }),
    plate: glowMat('#1e1f21', { glow: 0.1, roughness: 0.85 }),
    shell: glowMat('#d4d2ce', { glow: G, roughness: 0.45 }),
    rim: glowMat('#a8abae', { glow: G * 0.8, roughness: 0.35, metalness: 0.5 }),
    back: glowMat('#ffffff', { glow: G, map: tex((c, n) => plattan(c, n, '#2b3241', '#5b6576'), 0.42), roughness: 0.95 }),
    pan: glowMat('#ffffff', { glow: G, map: tex((c, n) => plain(c, n, '#3a4250'), 0.05, 32), roughness: 0.95 }),
    backY: glowMat('#ffffff', { glow: G, map: tex((c, n) => plattan(c, n, '#e3a628', '#f3c94a'), 0.42), roughness: 0.95 }),
    panY: glowMat('#ffffff', { glow: G, map: tex((c, n) => plain(c, n, '#eab23a'), 0.05, 32), roughness: 0.95 }),
    steel: glowMat('#c3c7ca', { glow: G * 0.6, roughness: 0.22, metalness: 0.9 }),
    yellow: glowMat('#f5c800', { glow: G, roughness: 0.45 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xdfeef0, roughness: 0.05, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff8ec, emissiveIntensity: 1.3 }),
    strap: glowMat('#b07a45', { glow: G, roughness: 0.6 }),
    sign: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTexture(512, 64, drawSign), roughness: 0.2 }),
    housing: glowMat('#1d2024', { glow: 0.1, roughness: 0.5 }),
    bulkhead: bulkheadMaterial(),
  };
}

// amber LED sign hanging from the ceiling
function drawSign(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffae1a'; ctx.font = '700 38px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Nästa T-Centralen', w / 2, h / 2 + 2);
}

// The cab bulkhead: dark slate, a narrow cab door in a stainless frame with the rail network map
// on it, and yellow priority pictograms.
function bulkheadMaterial() {
  const text = (ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, col: string) => {
    ctx.save(); ctx.scale(1, -1);
    ctx.fillStyle = col; ctx.font = `600 ${size}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, x, -y);
    ctx.restore();
  };
  return endWallMaterial({
    w: 1.5, y0: F, y1: 3.4, glow: G,
    draw(ctx) {
      ctx.fillStyle = '#eaecea'; ctx.fillRect(-1.5, F, 3, 2.4);
      ctx.fillStyle = '#3a3f47'; ctx.fillRect(-1.5, F, 3, 2.2);
      ctx.fillStyle = '#b4b8bb'; ctx.fillRect(-0.38, F, 0.76, 2.06);
      ctx.fillStyle = '#2f343b'; ctx.fillRect(-0.34, F, 0.68, 2.02);
      // network map
      ctx.fillStyle = '#f2f3f1'; ctx.fillRect(-0.28, F + 0.95, 0.56, 0.78);
      const lines: [string, [number, number][]][] = [['#e3242b', [[-0.2, 1.1], [0, 0.5], [0.15, 0.2]]], ['#2a9a47', [[-0.22, 0.3], [0, 0.48], [0.2, 0.68]]],
        ['#1270c8', [[-0.24, 0.6], [0, 0.5], [0.06, 0.15]]], ['#e5609a', [[-0.1, 0.72], [0.02, 0.45], [0.22, 0.25]]]];
      ctx.lineWidth = 0.014;
      for (const [col, pts] of lines) {
        ctx.strokeStyle = col; ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, F + 0.95 + y * 0.7) : ctx.moveTo(x, F + 0.95 + y * 0.7)));
        ctx.stroke();
      }
      text(ctx, 'Spårtrafikkarta', 0, F + 1.68, 0.045, '#1d2024');
      text(ctx, 'Dörren får ej blockeras', 0, F + 0.8, 0.032, '#f2f3f1');
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#f5c800'; ctx.fillRect(s * 0.62 - 0.07, F + 1.55, 0.14, 0.14);
        ctx.fillStyle = '#3a3f47'; ctx.fillRect(s * 0.62 - 0.015, F + 1.58, 0.03, 0.07);
      }
    },
  });
}

// ------------------------------------------------------------------ furnishing

const SEAT = { width: 0.47, height: 0.46, depth: 0.44, back: 1.0, recline: 0.15, shellT: 0.028, cushion: 0.035, cushionBack: 0.97 };
const PITCH = SEAT.width + 0.015;
let seats: Seating | undefined;
const S = () => (seats ??= seating({ F, IW, seat: SEAT }));
const seatAt = (parts: Parts, x: number, z: number, dir: number, priority: boolean) => S().across(parts, x, z, dir, priority);
const wallSeat = (parts: Parts, x: number, s: number, priority: boolean) => S().along(parts, x, s, priority);

// Bench of n seats along the wall from x = a towards dir; the priority seat is the first one.
function bench(parts: Parts, a: number, dir: number, n: number, s: number, { priorityFirst = true }: { priorityFirst?: boolean } = {}) {
  const xs = Array.from({ length: n }, (_, k) => a + dir * (PITCH / 2 + k * PITCH));
  xs.forEach((x, k) => wallSeat(parts, x, s, priorityFirst ? k === 0 : k === n - 1));
  // a seat beam under the bench and curved stainless supports at its ends
  const lo = Math.min(...xs) - PITCH / 2, hi = Math.max(...xs) + PITCH / 2;
  parts.add('rim', new THREE.BoxGeometry(hi - lo, 0.08, 0.2).translate((lo + hi) / 2, F + 0.36, s * (IW - 0.17)));
  const zf = s * (IW - SEAT.depth - 0.03);
  for (const x of [lo, hi]) {
    parts.add('steel', rail([[x, F + 0.4, s * (IW - 0.04)], [x, F + 0.4, zf], [x, F + 0.02, zf]], 0.016, 0.1));
  }
  return [lo, hi];
}

// Yellow-sleeved pole with stainless ends, floor to ceiling.
function addPole(parts: Parts, x: number, z: number, y0 = F, y1 = 3.3) {
  parts.add('steel', pole(x, z, y0, y0 + 0.3, 0.0175));
  parts.add('yellow', pole(x, z, y0 + 0.3, y0 + 1.9, 0.0195));
  parts.add('steel', pole(x, z, y0 + 1.9, y1, 0.0175));
}

// Triangular leather hand strap hanging from a rail.
function strap(x: number, y: number, z: number) {
  return [
    new THREE.BoxGeometry(0.035, 0.18, 0.01).translate(x, y - 0.1, z),
    new THREE.TorusGeometry(0.07, 0.012, 5, 3).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(x, y - 0.25, z),
  ];
}

function furnish(def: CarDef, ctx: InteriorContext) {
  const parts = new Parts();
  const { xa, xb } = ctx;
  const doors = [...def.doors].sort((a, b) => a - b);
  const CLR = 0.1;
  const railY = F + 1.9, railZ = 0.98;
  const stretches = freeStretches(xa, xb, doors, DOOR, CLR);
  let zone = 0;
  const signs: number[] = [];
  for (const [a, b] of stretches) {
    const atDoorA = doors.some((d) => Math.abs(d + DOOR / 2 + CLR - a) < 0.01);
    const atDoorB = doors.some((d) => Math.abs(d - DOOR / 2 - CLR - b) < 0.01);
    if (atDoorA && atDoorB) {
      // between two doors: transverse rows on one side, bench and flex area on the other,
      // swapping sides (and ends) from zone to zone
      const flip = (zone + (def.flip ? 1 : 0)) % 2;
      const sT = flip ? -1 : 1, sL = -sT;
      const E = flip ? b : a, dir = flip ? -1 : 1; // the rows start at door end E, facing into the zone
      const zWin = sT * (IW - 0.05 - SEAT.width / 2), zAisle = sT * (IW - 0.05 - SEAT.width * 1.5 - 0.015);
      const zEdge = sT * (IW - 0.05 - SEAT.width * 2 - 0.05);
      const rows = [[E + dir * 0.1, dir], [E + dir * 1.72, -dir], [E + dir * 2.5, -dir]];
      rows.forEach(([x, d], k) => {
        seatAt(parts, x, zWin, d, k === 0);
        seatAt(parts, x, zAisle, d, false);
        // stainless grab rail across the top of the back
        parts.add('steel', rail([[x - d * 0.05, F + SEAT.back - 0.01, sT * (IW - 0.04)], [x - d * 0.05, F + SEAT.back - 0.01, zEdge]], 0.013));
        parts.add('steel', rail([[x - d * 0.05, F + SEAT.back - 0.01, zEdge], [x - d * 0.05, F + 0.25, zEdge], [x + d * 0.25, F + 0.02, zEdge]], 0.016, 0.12));
      });
      // full-height glass screen behind the first row, a pole at the aisle end of the group
      parts.add('glass', new THREE.BoxGeometry(0.012, 1.85, IW - Math.abs(zEdge) + 0.02).translate(E + dir * 0.02, F + 0.98, sT * (IW + Math.abs(zEdge)) / 2));
      addPole(parts, E + dir * 0.05, zEdge);
      addPole(parts, E + dir * 2.55, zEdge);
      // bench of four at the far end (priority seat by the door), flex area at end E
      const far = flip ? a : b;
      const [lo, hi] = bench(parts, far + dir * 0.05, -dir, 4, sL);
      const benchEnd = dir > 0 ? lo : hi;
      const zb = sL * (IW - SEAT.depth - 0.08);
      for (const y of [F + 0.7, F + 0.95]) parts.add('steel', rail([[benchEnd - dir * 0.02, y, sL * (IW - 0.04)], [benchEnd - dir * 0.02, y, zb]], 0.014));
      addPole(parts, benchEnd - dir * 0.02, zb);
      // flex area: yellow U-shaped lean rails on the wall
      const f0 = E + dir * 0.2, f1 = benchEnd - dir * 0.3;
      for (const y of [F + 0.8, F + 0.95]) {
        parts.add('yellow', rail([[f0, y, sL * (IW - 0.04)], [f0, y, sL * (IW - 0.11)], [f1, y, sL * (IW - 0.11)], [f1, y, sL * (IW - 0.04)]], 0.016, 0.06));
      }
      signs.push((a + b) / 2);
      zone++;
    } else {
      // car end: two seats a side, the priority seat by the door
      const doorEnd = atDoorA ? a : b, dir = atDoorA ? 1 : -1;
      const cabEnd = def.cab && !atDoorB && b >= xb - 0.01;
      if (cabEnd) {
        // backs to the cab bulkhead, facing into the car, either side of the cab door
        for (const s of [-1, 1]) {
          seatAt(parts, xb - 0.06, s * (IW - 0.05 - SEAT.width / 2), -1, false);
          seatAt(parts, xb - 0.06, s * (IW - 0.05 - SEAT.width * 1.5 - 0.015), -1, true);
          parts.add('steel', rail([[xb - 0.1, F + 0.25, s * 0.38], [xb - 0.5, F + 0.02, s * 0.38]], 0.016));
          parts.add('yellow', rail([[xb - 0.02, F + 1.15, s * 0.4], [xb - 0.09, F + 1.15, s * 0.4], [xb - 0.09, F + 1.75, s * 0.4], [xb - 0.02, F + 1.75, s * 0.4]], 0.016, 0.05));
        }
        signs.push(xb - 0.1);
      } else {
        for (const s of [-1, 1]) {
          const [lo, hi] = bench(parts, doorEnd + dir * 0.05, dir, 2, s);
          const end = dir > 0 ? hi : lo;
          const zb = s * (IW - SEAT.depth - 0.08);
          for (const y of [F + 0.7, F + 0.95]) parts.add('steel', rail([[end + dir * 0.02, y, s * (IW - 0.04)], [end + dir * 0.02, y, zb]], 0.014));
        }
      }
    }
  }

  // at every door: screens and handles at both sides, a ring lamp with a ring handle, a centre pole
  for (const d of doors) {
    for (const e of [-1, 1]) {
      const x = d + e * (DOOR / 2 + 0.06);
      for (const s of [-1, 1]) {
        parts.add('glass', new THREE.BoxGeometry(0.012, 1.1, 0.5).translate(x + e * 0.03, F + 0.95, s * (IW - 0.3)));
        parts.add('steel', rail([[x + e * 0.03, F + 1.5, s * (IW - 0.04)], [x + e * 0.03, F + 1.5, s * (IW - 0.55)]], 0.015));
        // wall-mounted pole standing off the pillar
        const zp = s * (IW - 0.1);
        parts.add('steel', rail([[x, F + 0.3, s * (IW - 0.01)], [x, F + 0.3, zp], [x, F + 2.05, zp], [x, F + 2.05, s * (IW - 0.05)]], 0.016, 0.07));
        parts.add('yellow', pole(x, zp, F + 0.45, F + 1.9, 0.019));
      }
    }
    parts.add('lamp', new THREE.CylinderGeometry(0.55, 0.55, 0.02, 48).translate(d, 3.365, 0));
    parts.add('steel', new THREE.CylinderGeometry(0.15, 0.15, 0.025, 24).translate(d, 3.355, 0));
    parts.add('steel', new THREE.TorusGeometry(0.65, 0.017, 6, 40).rotateX(Math.PI / 2).translate(d, F + 1.97, 0));
    for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      parts.add('steel', pole(d + Math.cos(a) * 0.65, Math.sin(a) * 0.65, F + 1.97, 3.37, 0.008));
    }
    parts.add('steel', pole(d, 0, F, 3.36, 0.0175));
  }

  // hanging amber signs, crossways on the centre line, one per zone
  for (const x of signs) {
    parts.add('housing', new THREE.BoxGeometry(0.1, 0.16, 1.0).translate(x, 3.2, 0));
    parts.add('steel', pole(x, 0.3, 3.28, 3.37, 0.01), pole(x, -0.3, 3.28, 3.37, 0.01));
    for (const e of [-1, 1]) parts.add('sign', new THREE.PlaneGeometry(0.92, 0.11).rotateY(e * Math.PI / 2).translate(x + e * 0.051, 3.2, 0));
  }

  // overhead rails along both sides with drop handles, hand straps near the doors
  for (const s of [-1, 1]) {
    parts.add('steel', rail([[xa + 0.25, railY, s * railZ], [xb - 0.25, railY, s * railZ]], 0.016));
    for (let x = xa + 0.5; x < xb - 0.3; x += 1.2) parts.add('steel', rail([[x - 0.12, 3.3, s * railZ], [x - 0.08, railY, s * railZ], [x + 0.08, railY, s * railZ], [x + 0.12, 3.3, s * railZ]], 0.011, 0.04));
    for (const d of doors) {
      for (const e of [-1, 1]) {
        const x = d + e * (DOOR / 2 + 0.55);
        if (x > xa + 0.4 && x < xb - 0.4) parts.add('strap', strap(x, railY, s * railZ));
      }
    }
  }

  // light lines round the gangway portals
  const ring = (x: number) => {
    const pts = portalLoop(interior.portal, 64).map((p): Vec3 => [x, p.y, p.z]);
    return rail([...pts, pts[0]], 0.012, 0.01);
  };
  parts.add('lamp', ring(xa + 0.005));
  if (!def.cab) parts.add('lamp', ring(xb - 0.005));
  // yellow-sleeved handles on the portal sides
  for (const x of def.cab ? [xa + 0.06] : [xa + 0.06, xb - 0.06]) {
    for (const s of [-1, 1]) {
      const z = s * (interior.portal.w / 2 + 0.12);
      parts.add('steel', rail([[x, F + 0.6, z], [x, F + 0.6, z - s * 0.08], [x, F + 1.8, z - s * 0.08], [x, F + 1.8, z]], 0.016, 0.07));
      parts.add('yellow', pole(x, z - s * 0.08, F + 0.75, F + 1.65, 0.019));
    }
  }
  return parts.meshes(ctx.mats, merge);
}

export const interior: InteriorSpec = {
  lining: prof,
  floorY: F,
  glow: G,
  endWall: 0.08,
  cabDepth: 2.2,
  // octagonal gangway portal, about 1.75 m wide and 2.05 m high
  portal: { w: 1.75, y0: F, y1: F + 2.05, r: 0.38, chamfer: true, foot: 0.12 },
  pleat: 0.07,
  materials,
  paint,
  furnish,
};
