import * as THREE from 'three';
import { merge } from './kit';
import {
  liningProfile, seating, pole, rail, moquette, interiorMat, Parts, freeStretches,
  endWallMaterial, screenTexture, portalLoop,
} from './interior';
import type { Painter } from './kit';
import type { CabinLights } from './cabin-light';
import type { InteriorContext, InteriorMaterials, InteriorSpec, Seating, Vec3 } from './interior';
import { DOOR, windowFrames } from './c30';
import type { CarDef } from './train';

// C30 interior, from SL's seat plan in the C30 press presentation (2013) and photos of cars in
// service (2019–2024). See docs/rolling-stock.md for the research notes.
//
// White walls, a light grey speckled floor and a white ceiling with a band of round downlights and
// a light line along each side. Grab poles are stainless with a yellow sleeve. Between two doors
// each side has two facing bays of 2 + 2, a bench of eight along the wall, or a flex area for prams
// and wheelchairs (yellow lean rails, signs) with a bench of five or one facing bay beyond it; each
// car has one flex area, and the plan says which side each goes on. The car ends have two seats
// along each wall, also at the cab bulkhead. Glass screens stand beside the doorways where seats
// meet them. Seat backs are woven in the "Plattan" triangle pattern, navy and blue-grey, or in
// yellow on priority seats. Over each door area hangs a round lamp inside a stainless ring handle,
// and above each door are the network map and a screen. The cars are joined by wide octagonal
// gangways with pale grey bellows and light lines round the portals.

const F = 1.0;      // floor above the rail (the real floor is at 1.155 m; the model's platforms are lower)
const IW = 1.385;   // inner half-width at the floor
const prof = liningProfile([
  [0, F], [IW, F, 0.03], [IW, 1.95, 0.8], [1.335, 2.96, 0.08], [1.03, 3.2, 0.04], [1.0, 3.36, 0.04], [0, 3.38],
]);
// The light line along each cove shines in across the ceiling and down, and the row of round
// downlights each side of the centre shines straight down. Neutral white LEDs.
const LIGHTS: CabinLights = {
  strips: [
    { y: 3.25, z: 0.99, facing: [-0.35, -1], power: 0.38 },
    { y: 3.36, z: 0.76, facing: [-1, 0], power: 0.3 },
  ],
  color: 0xfffaf4,
  fill: 0.2,
};

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
  ceiling: { c: '#eef0ee', r: 0.6 },
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
  panel: { c: '#1d2a48', r: 0.4 },
  bezel: { c: '#0e1013', r: 0.4 },
  red: { c: '#e3242b', r: 0.5, e: '#3a0808' },
  tft: { c: '#20356e', e: '#3c5aa8' },
  tftPink: { c: '#e0478f', e: '#b03070' },
  white: { c: '#ffffff', e: '#bbbbbb' },
  adFrame: { c: '#d9dcdc', r: 0.4, m: 0.4 },
  dot: { c: '#ffffff', e: '#f4f8ff' },
};

// The network map over the doors, roughly: each line as points (along, up) in 0–1.
const MAP: [string, [number, number][]][] = [
  ['#e3242b', [[0, 0.2], [0.35, 0.45], [0.55, 0.5], [0.75, 0.8], [1, 0.95]]],
  ['#e3242b', [[0.55, 0.5], [0.8, 0.3], [1, 0.25]]],
  ['#2a9a47', [[0, 0.85], [0.3, 0.6], [0.55, 0.5], [0.7, 0.35], [1, 0.05]]],
  ['#1270c8', [[0.05, 0.95], [0.4, 0.65], [0.55, 0.52], [0.85, 0.6]]],
  ['#f08a24', [[0.2, 0.05], [0.45, 0.25], [0.7, 0.2]]],
];

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
    const r = b - a < 0.8 ? 0.18 : 0.12;
    p.rect(a + 0.035, b - 0.035, 1.935, 2.895, C.seal, r + 0.01);
    p.rect(a + 0.05, b - 0.05, 1.95, 2.88, C.hole, r);
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
    // the doorway: the leaves are separate (doorLeaf below)
    p.rect(da, db, F, 3.04, C.hole, 0.15);
    // above the door: the network map, coloured lines on navy, and an information screen in a
    // black bezel
    p.rect(da, db, 3.0, 3.18, C.panel);
    const mx = (k: number) => da + 0.06 + k * (DOOR - 0.68);
    for (const [col, pts] of MAP) {
      p.fill((ctx) => {
        pts.forEach(([u, v], i) => {
          const x = mx(u), y = p.ty(3.02 + v * 0.14);
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(mx(pts[i][0]), p.ty(3.02 + pts[i][1] * 0.14) + 0.008);
        ctx.closePath();
      }, { c: col, r: 0.5, e: '#101010' });
    }
    p.rect(db - 0.58, db - 0.04, 3.015, 3.17, C.bezel, 0.02);
    p.rect(db - 0.55, db - 0.07, 3.03, 3.155, C.tft);
    p.rect(db - 0.55, db - 0.07, 3.13, 3.155, C.tftPink);
    // stainless threshold with black ribs
    p.rectT(da, db, floorEdge - 0.16, floorEdge, C.steel);
    for (let k = 0; k < 3; k++) p.rectT(da, db, floorEdge - 0.14 + k * 0.04, floorEdge - 0.125 + k * 0.04, C.seal);
  }
}

// Inside of a door leaf: dark, with a stainless kick plate, the window and an open button.
function doorLeaf(p: Painter, w: number) {
  p.rect(0, w, 0.99, 3.04, C.door);
  p.rect(0, w - 0.02, 0.99, F + 0.28, C.steel);
  p.rect(0, 0.012, 0.99, 3.04, C.seal);
  const c = w / 2;
  p.rect(c - 0.225, c + 0.225, 1.5, 2.88, C.seal, 0.1);
  p.rect(c - 0.21, c + 0.21, 1.52, 2.86, C.hole, 0.09);
  p.ellipse(0.12, F + 1.1, 0.04, 0.04, C.white);
  p.ellipse(0.12, F + 1.1, 0.03, 0.03, C.green);
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
    wall: interiorMat('#eaecea', { roughness: 0.5, side: THREE.DoubleSide }),
    bellows: interiorMat('#9a9ea2', { roughness: 0.85, side: THREE.DoubleSide }),
    plate: interiorMat('#1e1f21', { roughness: 0.85 }),
    shell: interiorMat('#d4d2ce', { roughness: 0.45 }),
    rim: interiorMat('#a8abae', { roughness: 0.35, metalness: 0.5 }),
    back: interiorMat('#ffffff', { map: tex((c, n) => plattan(c, n, '#2b3241', '#5b6576'), 0.42), roughness: 0.95 }),
    pan: interiorMat('#ffffff', { map: tex((c, n) => plain(c, n, '#3a4250'), 0.05, 32), roughness: 0.95 }),
    backY: interiorMat('#ffffff', { map: tex((c, n) => plattan(c, n, '#e3a628', '#f3c94a'), 0.42), roughness: 0.95 }),
    panY: interiorMat('#ffffff', { map: tex((c, n) => plain(c, n, '#eab23a'), 0.05, 32), roughness: 0.95 }),
    steel: interiorMat('#c3c7ca', { roughness: 0.22, metalness: 0.9 }),
    yellow: interiorMat('#f5c800', { roughness: 0.45 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xdfeef0, roughness: 0.05, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff8ec, emissiveIntensity: 1.3 }),
    strap: interiorMat('#b07a45', { roughness: 0.6 }),
    sign: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTexture(512, 64, drawSign), roughness: 0.2 }),
    housing: interiorMat('#1d2024', { roughness: 0.5 }),
    pictogram: new THREE.MeshStandardMaterial({ map: screenTexture(256, 116, drawPictograms), roughness: 0.5 }),
    bulkhead: bulkheadMaterial(),
  };
}

// The pram and wheelchair signs on the wall of a flex area: white on SL blue.
function drawPictograms(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  const s = h * 0.86, m = (h - s) / 2;
  for (let k = 0; k < 2; k++) {
    const x0 = w / 2 + (k ? 0.04 * w : -0.04 * w - s);
    ctx.fillStyle = '#1659b8';
    ctx.beginPath(); ctx.roundRect(x0, m, s, s, s * 0.1); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle = '#ffffff'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
    if (k === 0) {
      // wheelchair: a big wheel, the seated figure, the head
      ctx.beginPath(); ctx.arc(x0 + s * 0.45, m + s * 0.66, s * 0.22, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0 + s * 0.42, m + s * 0.3); ctx.lineTo(x0 + s * 0.45, m + s * 0.55); ctx.lineTo(x0 + s * 0.68, m + s * 0.55); ctx.lineTo(x0 + s * 0.76, m + s * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.arc(x0 + s * 0.42, m + s * 0.18, s * 0.07, 0, Math.PI * 2); ctx.fill();
    } else {
      // pram: the hood, the body, two wheels and the handle
      ctx.beginPath(); ctx.moveTo(x0 + s * 0.22, m + s * 0.5); ctx.lineTo(x0 + s * 0.72, m + s * 0.5);
      ctx.arc(x0 + s * 0.47, m + s * 0.5, s * 0.25, 0, Math.PI, false); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x0 + s * 0.22, m + s * 0.5); ctx.arc(x0 + s * 0.47, m + s * 0.5, s * 0.25, Math.PI, Math.PI * 1.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x0 + s * 0.72, m + s * 0.5); ctx.lineTo(x0 + s * 0.85, m + s * 0.25); ctx.stroke();
      for (const x of [0.32, 0.64]) { ctx.beginPath(); ctx.arc(x0 + s * x, m + s * 0.84, s * 0.07, 0, Math.PI * 2); ctx.fill(); }
    }
  }
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
    w: 1.5, y0: F, y1: 3.4,
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
// seats along the walls are narrower: 445 mm apart on SL's seat plan
const PITCH = 0.445;
let seats: Seating | undefined, wallSeats: Seating | undefined;
const S = () => (seats ??= seating({ F, IW, seat: SEAT }));
const SW = () => (wallSeats ??= seating({ F, IW, seat: { ...SEAT, width: PITCH - 0.015 } }));
const seatAt = (parts: Parts, x: number, z: number, dir: number, priority: boolean) => S().across(parts, x, z, dir, priority);
const wallSeat = (parts: Parts, x: number, s: number, priority: boolean) => SW().along(parts, x, s, priority);
const CLR = 0.1;    // pillar between a doorway and the seats

// What stands along one side of a stretch between two doors, after SL's seat plan of the C30
// (press presentation, 2013): two facing bays of 2 + 2, a bench of eight, or a flex area for prams
// and wheelchairs by one door with a bench of five or one facing bay beyond it.
type SideKind = 'bays' | 'bench' | 'flexBench' | 'flexBay';
interface Zone { pz: SideKind; nz: SideKind; flex: 1 | -1 }  // flex: the end (+x or −x) of the flex area
// Each car's stretches from its +x end (an A car's cab) to its −x end. B2 (flip) is B turned
// round, as on the plan, and the train turns the last A car round itself.
const ZONES: Record<'A' | 'B', Zone[]> = {
  A: [{ pz: 'bench', nz: 'flexBay', flex: 1 }, { pz: 'bays', nz: 'bench', flex: 1 }],
  B: [{ pz: 'bays', nz: 'flexBench', flex: 1 }, { pz: 'bench', nz: 'bays', flex: 1 }],
};

function zonesOf(def: CarDef) {
  const doors = [...def.doors].sort((a, b) => a - b);
  const out: { a: number; b: number; zone: Zone }[] = [];
  let plan = ZONES[def.cab ? 'A' : 'B'];
  if (def.flip) plan = [...plan].reverse().map((z) => ({ pz: z.nz, nz: z.pz, flex: (-z.flex) as 1 | -1 }));
  for (let i = doors.length - 1; i > 0; i--) {
    out.push({ a: doors[i - 1] + DOOR / 2 + CLR, b: doors[i] - DOOR / 2 - CLR, zone: plan[Math.min(out.length, plan.length - 1)] });
  }
  return out;
}

// Bench of n seats along the wall on side s from x = a towards dir; `yellow` are the priority
// seats, counted from a.
function bench(parts: Parts, a: number, dir: number, n: number, s: number, yellow: number[]) {
  const xs = Array.from({ length: n }, (_, k) => a + dir * (PITCH / 2 + k * PITCH));
  xs.forEach((x, k) => wallSeat(parts, x, s, yellow.includes(k)));
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

// A pole in front of a bench: down from the ceiling and bent at the foot into the seat front.
function benchPole(parts: Parts, x: number, s: number) {
  const z = s * (IW - SEAT.depth - 0.1), zs = s * (IW - SEAT.depth + 0.02);
  parts.add('steel', rail([[x, 3.3, z], [x, F + 2.2, z]], 0.0175));
  parts.add('yellow', rail([[x, F + 2.2, z], [x, F + 0.6, z], [x, F + 0.4, zs]], 0.0195, 0.12));
}

// Glass screen beside a doorway, from the wall out to `depth`, with a stainless rail along its
// top and a pole at its aisle edge. `tall` screens shelter a row of transverse seats.
function screen(parts: Parts, x: number, s: number, depth: number, tall: boolean) {
  const y0 = F + 0.25, y1 = tall ? F + 1.9 : F + 1.3, zc = s * (IW - depth / 2), ze = s * (IW - depth);
  parts.add('glass', new THREE.BoxGeometry(0.012, y1 - y0, depth).translate(x, (y0 + y1) / 2, zc));
  parts.add('steel', rail([[x, y1, s * (IW - 0.03)], [x, y1, ze]], 0.014));
  parts.add('steel', rail([[x, y0, s * (IW - 0.03)], [x, y0, ze]], 0.012));
  addPole(parts, x, ze);
}

// Transverse rows of two, as [x of the back, facing], with grab handles on the backs.
function rows(parts: Parts, list: [number, number][], s: number) {
  const zWin = s * (IW - 0.05 - SEAT.width / 2), zAisle = s * (IW - 0.05 - SEAT.width * 1.5 - 0.015);
  const zEdge = s * (IW - 0.05 - SEAT.width * 2 - 0.05);
  for (const [x, d] of list) {
    seatAt(parts, x, zWin, d, false);
    seatAt(parts, x, zAisle, d, false);
    // stainless grab rail across the top of the back, and the leg at the aisle end
    parts.add('steel', rail([[x - d * 0.05, F + SEAT.back - 0.01, s * (IW - 0.04)], [x - d * 0.05, F + SEAT.back - 0.01, zEdge]], 0.013));
    parts.add('steel', rail([[x - d * 0.05, F + SEAT.back - 0.01, zEdge], [x - d * 0.05, F + 0.25, zEdge], [x + d * 0.25, F + 0.02, zEdge]], 0.016, 0.12));
  }
  return zEdge;
}

// Yellow lean rails on the wall of a flex area, from x = f0 to f1, and the pram and wheelchair
// signs above them.
function flexArea(parts: Parts, f0: number, f1: number, s: number) {
  for (const y of [F + 0.8, F + 0.95]) {
    parts.add('yellow', rail([[f0, y, s * (IW - 0.04)], [f0, y, s * (IW - 0.11)], [f1, y, s * (IW - 0.11)], [f1, y, s * (IW - 0.04)]], 0.016, 0.06));
  }
  const xc = (f0 + f1) / 2;
  parts.add('pictogram', new THREE.PlaneGeometry(0.44, 0.2).rotateY(s > 0 ? Math.PI : 0).translate(xc, F + 0.62, s * (IW - 0.005)));
}

// One side of a stretch [a, b] between two doors.
function zoneSide(parts: Parts, kind: SideKind, a: number, b: number, s: number, flex: 1 | -1) {
  const L = b - a;
  if (kind === 'bays') {
    const bay = (L - 0.26) / 2;
    const zEdge = rows(parts, [[a + 0.08, 1], [a + 0.08 + bay, -1], [a + 0.18 + bay, 1], [b - 0.08, -1]], s);
    screen(parts, a + 0.02, s, IW - Math.abs(zEdge), true);
    screen(parts, b - 0.02, s, IW - Math.abs(zEdge), true);
    addPole(parts, a + 0.13 + bay, zEdge);
  } else if (kind === 'flexBay') {
    // one facing bay at the end away from the flex area
    const far = flex > 0 ? a : b, d = flex;
    const zEdge = rows(parts, [[far + d * 0.08, d], [far + d * 1.86, -d]], s);
    screen(parts, far + d * 0.02, s, IW - Math.abs(zEdge), true);
    addPole(parts, far + d * 1.9, zEdge);
    flexArea(parts, far + d * 2.2, (flex > 0 ? b : a) - d * 0.2, s);
  } else if (kind === 'bench') {
    const n = Math.min(8, Math.floor((L - 0.1) / PITCH)), x0 = (a + b) / 2 - (n * PITCH) / 2;
    bench(parts, x0, 1, n, s, [0, n - 1]);
    for (const x of [a + 0.02, b - 0.02]) screen(parts, x, s, SEAT.depth + 0.1, false);
    benchPole(parts, (a + b) / 2, s);
  } else {
    // flex area by the door at the flex end, a bench of five from the other door
    const far = flex > 0 ? a : b, d = flex;
    const [lo, hi] = bench(parts, far + d * 0.05, d, 5, s, [0]);
    const end = d > 0 ? hi : lo;
    screen(parts, far + d * 0.02, s, SEAT.depth + 0.1, false);
    benchPole(parts, far + d * (0.05 + 2 * PITCH), s);
    const zb = s * (IW - SEAT.depth - 0.08);
    for (const y of [F + 0.7, F + 0.95]) parts.add('steel', rail([[end + d * 0.02, y, s * (IW - 0.04)], [end + d * 0.02, y, zb]], 0.014));
    addPole(parts, end + d * 0.02, zb);
    flexArea(parts, end + d * 0.3, (flex > 0 ? b : a) - d * 0.2, s);
  }
}

function furnish(def: CarDef, ctx: InteriorContext) {
  const parts = new Parts();
  const { xa, xb } = ctx;
  const doors = [...def.doors].sort((a, b) => a - b);
  const railY = F + 1.9, railZ = 0.98;
  const signs: number[] = [];
  for (const { a, b, zone } of zonesOf(def)) {
    zoneSide(parts, zone.pz, a, b, 1, zone.flex);
    zoneSide(parts, zone.nz, a, b, -1, zone.flex);
    signs.push((a + b) / 2);
  }
  // the ends: two seats along each wall, a screen at the door end
  for (const [a, b] of freeStretches(xa, xb, doors, DOOR, CLR)) {
    const atDoorA = doors.some((d) => Math.abs(d + DOOR / 2 + CLR - a) < 0.01);
    const atDoorB = doors.some((d) => Math.abs(d - DOOR / 2 - CLR - b) < 0.01);
    if (atDoorA && atDoorB) continue;
    const doorEnd = atDoorA ? a : b, dir = atDoorA ? 1 : -1;
    const cabEnd = def.cab && atDoorA && b >= xb - 0.01;
    for (const s of [-1, 1]) {
      screen(parts, doorEnd + dir * 0.01, s, SEAT.depth + 0.1, false);
      if (cabEnd) {
        // from the cab bulkhead, the priority seat against it
        bench(parts, xb - 0.04, -1, 2, s, [0]);
      } else {
        const [lo, hi] = bench(parts, doorEnd + dir * 0.05, dir, 2, s, [0]);
        const end = dir > 0 ? hi : lo;
        const zb = s * (IW - SEAT.depth - 0.08);
        for (const y of [F + 0.7, F + 0.95]) parts.add('steel', rail([[end + dir * 0.02, y, s * (IW - 0.04)], [end + dir * 0.02, y, zb]], 0.014));
      }
    }
    if (cabEnd) signs.push(xb - 0.1);
  }

  // at every door: handles at both sides, a ring lamp with a ring handle, a centre pole
  for (const d of doors) {
    for (const e of [-1, 1]) {
      const x = d + e * (DOOR / 2 + 0.06);
      for (const s of [-1, 1]) {
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
  lights: LIGHTS,
  endWall: 0.08,
  cabDepth: 2.09,
  // octagonal gangway portal, about 1.75 m wide and 2.05 m high
  portal: { w: 1.75, y0: F, y1: F + 2.05, r: 0.38, chamfer: true, foot: 0.12 },
  pleat: 0.07,
  materials,
  paint,
  furnish,
  doorLeaf,
};
