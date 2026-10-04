import * as THREE from 'three';
import { merge } from './kit';
import {
  liningProfile, seating, pole, rail, moquette, interiorMat, Parts, freeStretches, endWallMaterial,
  screenTexture,
} from './interior';
import type { Painter } from './kit';
import type { CabinLights } from './cabin-light';
import type { InteriorContext, InteriorMaterials, InteriorSpec, Seating } from './interior';
import { DOOR, windowPanes } from './c20';
import type { CarDef } from './train';

export type C20InteriorStyle = 'upgraded' | 'original';

// C20 interiors, from Wikimedia Commons photos (2008–2026), SL's seat plan for the upgrade and
// press material. See docs/rolling-stock.md for the research notes.
//
// Two styles:
//  - 'upgraded' (C20U): Alstom refurbished all 270 units in Västerås, 2020–2024, so this is how
//    every C20 looks today. 102 seats. In each bay one side keeps two groups of four facing seats
//    and the other gets a row of seats along the wall; the sides alternate. A multipurpose area
//    with lean rails at each end of the middle car, extra yellow rails, TFT screens, and seats in
//    the same "Plattan" triangle fabric as the C30.
//  - 'original' (1997–2024): 126 seats, all in groups of four facing seats, in Lasse Åberg's navy
//    moquette with sketches of Stockholm in coloured lines; tall yellow hoops on the backs.
// Both: light grey-white walls, a silver-grey ceiling whose lowered centre spine carries two rows
// of opal light panels, bright yellow handholds, grey door pillars with poles in recesses, glass
// screens at the doors, a yellow ceiling grip over each door area, a yellow cab bulkhead, and open
// gangways with a turntable floor between the three sections.

const F = 1.0;     // floor above the rail
const IW = 1.38;   // inner half-width at the floor
const prof = liningProfile([
  [0, F], [IW, F, 0.03], [IW, 1.9, 0.5], [1.33, 2.95, 0.15], [1.02, 3.25, 0.05], [0.8, 3.33, 0.04], [0, 3.35],
]);
// The two rows of opal panels under the ceiling spine, neutral white, shining straight down.
const LIGHTS: CabinLights = {
  strips: [{ y: 3.26, z: 0.2, facing: [-1, 0], power: 0.5 }],
  color: 0xfff7ee,
  fill: 0.2,
};
// gangway portal, 1.8 m wide and 2.0 m high with rounded top corners
const PORTAL = { w: 1.8, y0: F, y1: F + 2.0, r: 0.3 };

function tAt(z: number, part: 'floor' | 'ceiling') {
  const list = prof.pts.filter((p) => (part === 'floor' ? p.y < F + 0.01 : p.y > 3.3)).sort((a, b) => a.z - b.z);
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    if (z <= b.z) return a.t + ((z - a.z) / (b.z - a.z || 1)) * (b.t - a.t);
  }
  return list[list.length - 1].t;
}

const C = {
  wall: { c: '#e4e4e0', r: 0.45 },
  heater: { c: '#b9bab6', r: 0.5 },
  ceiling: { c: '#c8cacc', r: 0.55 },
  slot: { c: '#3c3f43', r: 0.6 },
  perf: { c: '#9ea2a6', r: 0.4, m: 0.5 },
  rubber: { c: '#1b1d20', r: 0.7 },
  reveal: { c: '#eeeeea', r: 0.35 },
  hole: { c: '#000', a: 0 },
  door: { c: '#d9d9d6', r: 0.4 },
  pillar: { c: '#a9abad', r: 0.45 },
  steel: { c: '#b4b8bb', r: 0.3, m: 0.85 },
  ribbed: { c: '#9da1a4', r: 0.35, m: 0.8 },
  pict: { c: '#9fd3ec', r: 0.5 },
  green: { c: '#2ea05a', r: 0.5 },
  red: { c: '#d2232a', r: 0.5 },
  adFrame: { c: '#b5b8bb', r: 0.35, m: 0.5 },
  sticker: { c: '#f6f6f2', r: 0.6 },
};
const ADS = [['#2b5d9b', '#eef2f7'], ['#c43a62', '#f4d3dc'], ['#f1b51c', '#2b2b2b'], ['#3c8a5a', '#f1efe6'], ['#7a4a2a', '#f3e6d6'], ['#1c2536', '#e8eaec']];

function makePaint(style: C20InteriorStyle) {
  const floor = style === 'original' ? { c: '#a8a49c', r: 0.75 } : { c: '#b8b7b1', r: 0.75 };
  return function paint(p: Painter, def: CarDef, { xa, xb, x0, x1 }: InteriorContext) {
    const floorEdge = tAt(IW, 'floor');
    p.rectT(xa, xb, prof.tMin, prof.tMax, C.wall);
    p.rectT(xa, xb, prof.tMin, floorEdge, floor);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const m of [{ c: '#7f7c75', r: 0.75 }, { c: '#d8d6d0', r: 0.75 }]) {
      p.fill((ctx) => {
        for (let i = 0, N = Math.round(90 * (xb - xa)); i < N; i++) ctx.rect(xa + rnd() * (xb - xa), prof.tMin + rnd() * (floorEdge - prof.tMin), 0.014, 0.014);
      }, m);
    }
    // darker heater panels low on the walls
    p.rect(xa, xb, F, F + 0.34, C.heater);
    for (let x = xa + 0.1; x < xb - 0.1; x += 0.05) p.rect(x, x + 0.02, F + 0.08, F + 0.26, C.perf);
    // ceiling: slot grilles beside the flat centre, silver-grey ceiling
    const tc = (z: number) => tAt(z, 'ceiling');
    p.rectT(xa, xb, tc(0.8) - 0.24, prof.tMax, C.ceiling);
    for (let k = 0; k < 4; k++) p.rect(xa, xb, 3.262 + k * 0.016, 3.268 + k * 0.016, C.slot);
    // a row of angled advert frames in the cove above the windows
    let i = 0;
    for (let x = xa + 0.2; x + 0.72 < xb - 0.1; x += 0.8, i++) {
      const [bg, fg] = ADS[(((i + Math.round(x0 * 3)) % ADS.length) + ADS.length) % ADS.length];
      p.rect(x, x + 0.72, 3.0, 3.22, C.adFrame);
      p.rect(x + 0.015, x + 0.705, 3.012, 3.208, { c: fg, r: 0.5 });
      p.rect(x + 0.015, x + 0.3, 3.012, 3.208, { c: bg, r: 0.5 });
    }
    for (const [a, b] of windowPanes(def, x0, x1)) {
      p.rect(a - 0.07, b + 0.07, 1.86, 2.95, C.reveal, 0.14);
      p.rect(a - 0.02, b + 0.02, 1.91, 2.9, C.rubber, 0.1);
      p.rect(a, b, 1.93, 2.88, C.hole, 0.08);
    }
    for (const d of def.doors) {
      const da = d - DOOR / 2, db = d + DOOR / 2;
      // grey pillars with stainless kick plates, the pictogram strip and emergency boxes
      for (const [pa, pb] of [[da - 0.16, da], [db, db + 0.16]]) {
        p.rect(pa, pb, F, 3.05, C.pillar);
        p.rect(pa, pb, F, F + 0.3, C.steel);
        p.rect(pa, pb, F, F + 0.03, C.rubber);
      }
      p.rect(db + 0.03, db + 0.13, 2.1, 2.62, C.pict);
      p.rect(da - 0.13, da - 0.05, 2.35, 2.5, C.green);
      p.rect(da - 0.13, da - 0.05, 2.6, 2.72, C.red);
      // the doorway: the leaves are separate (doorLeaf below)
      p.rect(da, db, F, 3.0, C.hole);
      // ribbed aluminium threshold
      p.rectT(da, db, floorEdge - 0.15, floorEdge, C.steel);
      for (let k = 0; k < 6; k++) p.rectT(da, db, floorEdge - 0.14 + k * 0.022, floorEdge - 0.132 + k * 0.022, C.ribbed);
    }
  };
}

// Inside of a door leaf: grey-white with a black seal at the centre and a tall window.
function doorLeaf(p: Painter, w: number) {
  p.rect(0, w, 0.95, 3.0, C.door);
  p.rect(0, 0.015, 0.95, 3.0, C.rubber);
  const c = w / 2;
  p.rect(c - 0.23, c + 0.23, 1.7, 2.88, C.rubber, 0.07);
  p.rect(c - 0.2, c + 0.2, 1.73, 2.85, C.hole, 0.05);
  p.rect(c - 0.15, c + 0.15, 2.9, 2.95, C.sticker);
}

// ------------------------------------------------------------------ fabrics

// Lasse Åberg's 1997 moquette: navy, scattered with quick sketches of Stockholm.
function aberg(ctx: CanvasRenderingContext2D, n: number) {
  ctx.fillStyle = '#233070'; ctx.fillRect(0, 0, n, n);
  const cols = ['#e2483d', '#f08a3c', '#f2d34a', '#5bbf6a', '#6fb6e8', '#e889b7', '#f4f4f4'];
  const k = n / 256;
  ctx.lineWidth = 2.2 * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const draw: Record<string, (x: number, y: number) => void> = {
    // City Hall: tower with a lantern and three crowns
    hall(x, y) { ctx.strokeRect(x - 6, y - 4, 12, 26); ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x, y - 14); ctx.lineTo(x + 4, y - 4); ctx.stroke(); for (const d of [-4, 0, 4]) { ctx.beginPath(); ctx.arc(x + d, y - 17, 1.4, 0, 7); ctx.stroke(); } },
    spire(x, y) { ctx.beginPath(); ctx.moveTo(x - 7, y + 20); ctx.lineTo(x - 7, y); ctx.lineTo(x, y - 18); ctx.lineTo(x + 7, y); ctx.lineTo(x + 7, y + 20); ctx.stroke(); ctx.strokeRect(x - 2, y + 6, 4, 6); },
    boat(x, y) { ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.lineTo(x + 16, y); ctx.lineTo(x + 11, y + 8); ctx.lineTo(x - 12, y + 8); ctx.closePath(); ctx.stroke(); ctx.strokeRect(x - 7, y - 7, 12, 7); ctx.strokeRect(x - 2, y - 14, 4, 7); },
    moon(x, y) { ctx.beginPath(); ctx.arc(x, y, 7, 0.6, 5.7); ctx.arc(x + 4, y, 5.5, 5.4, 0.9, true); ctx.stroke(); },
    star(x, y) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.5 : 7, a = (i / 10) * Math.PI * 2 - Math.PI / 2; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } ctx.closePath(); ctx.stroke(); },
    bus(x, y) { ctx.beginPath(); ctx.roundRect(x - 12, y - 6, 24, 12, 3); ctx.stroke(); for (const d of [-7, -1, 5]) ctx.strokeRect(x + d, y - 3, 4, 3); },
    castle(x, y) { ctx.strokeRect(x - 13, y - 8, 26, 16); for (let i = -10; i <= 8; i += 6) for (const r of [-3, 3]) ctx.strokeRect(x + i, y + r - 1.5, 3, 3); ctx.beginPath(); ctx.moveTo(x - 13, y - 8); ctx.lineTo(x, y - 14); ctx.lineTo(x + 13, y - 8); ctx.stroke(); },
    globe(x, y) { ctx.beginPath(); ctx.arc(x, y, 9, Math.PI, 0); ctx.lineTo(x - 9, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x, y); ctx.stroke(); },
  };
  const kinds = Object.keys(draw);
  let s = 3;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // a jittered grid, so the tile repeats without obvious rows
  for (let gy = 0; gy < 5; gy++) {
    for (let gx = 0; gx < 5; gx++) {
      const x = (gx + 0.2 + rnd() * 0.6) * 51.2, y = (gy + 0.2 + rnd() * 0.6) * 51.2;
      ctx.strokeStyle = cols[Math.floor(rnd() * cols.length)];
      ctx.save(); ctx.translate(x * k, y * k); ctx.scale(k * 0.9, k * 0.9); ctx.rotate((rnd() - 0.5) * 0.5);
      draw[kinds[Math.floor(rnd() * kinds.length)]](0, 0);
      ctx.restore();
    }
  }
  weave(ctx, n);
}

function plattan(ctx: CanvasRenderingContext2D, n: number, dark: string, light: string) {
  ctx.fillStyle = light; ctx.fillRect(0, 0, n, n);
  ctx.fillStyle = dark;
  const w = n / 2;
  for (let row = 0; row < 2; row++) {
    for (let i = -1; i < 3; i++) {
      const x = i * w + (row ? w / 2 : 0), y0 = (row * n) / 2, y1 = y0 + n / 2;
      ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x + w / 2, y0); ctx.lineTo(x + w, y1); ctx.fill();
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

function makeMaterials(style: C20InteriorStyle) {
  return (): InteriorMaterials => {
    const fab = (draw: (ctx: CanvasRenderingContext2D, n: number) => void, size: number, n?: number) => interiorMat('#ffffff', { map: moquette(draw, size, n), roughness: 0.95 });
    const mats = {
      wall: interiorMat('#e4e4e0', { roughness: 0.5, side: THREE.DoubleSide }),
      ceiling: interiorMat('#c8cacc', { roughness: 0.5 }),
      bellows: interiorMat('#8e9194', { roughness: 0.85, side: THREE.DoubleSide }),
      plate: interiorMat('#7d8083', { roughness: 0.6, metalness: 0.4 }),
      ring: interiorMat('#2a2c2f', { roughness: 0.7 }),
      frame: interiorMat('#7a7e83', { roughness: 0.4, metalness: 0.6 }),
      pillar: interiorMat('#a9abad', { roughness: 0.45 }),
      steel: interiorMat('#c3c7ca', { roughness: 0.22, metalness: 0.9 }),
      yellow: interiorMat('#f2d21e', { roughness: 0.4 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xdfeef0, roughness: 0.05, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e2, emissiveIntensity: 1.3 }),
      sign: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTexture(512, 64, drawSign), roughness: 0.2 }),
      housing: interiorMat('#1d2024', { roughness: 0.5 }),
      bulkhead: bulkheadMaterial(),
    };
    if (style === 'original') {
      const ab = fab(aberg, 0.36, 256);
      Object.assign(mats, { shell: ab, back: ab, pan: ab });
    } else {
      Object.assign(mats, {
        shell: fab((c, n) => plain(c, n, '#3b414a'), 0.05, 32),
        back: fab((c, n) => plattan(c, n, '#3a3d44', '#6e7380'), 0.42),
        pan: fab((c, n) => plain(c, n, '#3b414a'), 0.05, 32),
        backY: fab((c, n) => plattan(c, n, '#d9a520', '#e8b830'), 0.42),
        panY: fab((c, n) => plain(c, n, '#e3ad2a'), 0.05, 32),
        screen: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTexture(512, 288, drawTft), roughness: 0.2 }),
      });
    }
    return mats;
  };
}

function drawSign(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffae1a'; ctx.font = '700 38px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Mot: Skarpnäck', w / 2, h / 2 + 2);
}

// C20U widescreen: next station in white on dark blue
function drawTft(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#0d2350'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1f9a3c'; ctx.fillRect(0, 0, w, 50);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
  ctx.font = '700 30px Arial, sans-serif'; ctx.fillText('17  Skarpnäck', 22, 26);
  ctx.font = '600 26px Arial, sans-serif'; ctx.fillText('Nästa', 22, 96);
  ctx.font = '700 48px Arial, sans-serif'; ctx.fillText('T-Centralen', 22, 146);
  ctx.font = '500 22px Arial, sans-serif'; ctx.fillStyle = '#b9c6e4';
  ctx.fillText('Byte till röd och blå linje, pendeltåg', 22, 200);
}

// The cab bulkhead is bright yellow, with the cab door and its narrow dark window.
function bulkheadMaterial() {
  return endWallMaterial({
    w: 1.5, y0: F, y1: 3.4,
    draw(ctx) {
      ctx.fillStyle = '#e8c21f'; ctx.fillRect(-1.5, F, 3, 2.4);
      ctx.fillStyle = '#d4ae16'; ctx.fillRect(-0.34, F, 0.68, 2.02);
      ctx.fillStyle = '#e8c21f'; ctx.fillRect(-0.32, F, 0.64, 2.0);
      ctx.fillStyle = '#0f1216';
      ctx.beginPath(); ctx.roundRect(-0.125, F + 1.25, 0.25, 0.6, 0.06); ctx.fill();
      ctx.fillStyle = '#9a9ea2'; ctx.fillRect(0.22, F + 0.95, 0.05, 0.14);
      // posters either side of the door
      for (const [x, bg, fg] of [[-0.95, '#f4efe6', '#c43a62'], [0.6, '#eef2f7', '#2b5d9b']] as const) {
        ctx.fillStyle = bg; ctx.fillRect(x, F + 1.25, 0.38, 0.55);
        ctx.fillStyle = fg; ctx.fillRect(x + 0.03, F + 1.55, 0.32, 0.2);
      }
    },
  });
}

// ------------------------------------------------------------------ furnishing

const SEAT = { width: 0.45, height: 0.45, depth: 0.44, back: 1.2, recline: 0.12, shellT: 0.04, cushion: 0.06, cushionBack: 0.95 };
let seats: Seating | undefined;
const S = () => (seats ??= seating({ F, IW, seat: SEAT }));

function makeFurnish(style: C20InteriorStyle) {
  const upgraded = style !== 'original';
  return function furnish(def: CarDef, ctx: InteriorContext) {
    const parts = new Parts();
    const { xa, xb } = ctx;
    const doors = [...def.doors].sort((a, b) => a - b);
    const CLR = 0.1;
    const W = SEAT.width;
    const zWin = (s: number) => s * (IW - 0.04 - W / 2), zAisle = (s: number) => s * (IW - 0.06 - 1.5 * W);
    const zEdge = (s: number) => s * (IW - 0.08 - 2 * W);
    const ceilingY = 3.33;

    // a row of two seats across one side, back at x, facing dir
    const pair = (x: number, s: number, dir: number, priority = false) => {
      S().across(parts, x, zWin(s), dir, priority);
      S().across(parts, x, zAisle(s), dir, false);
      // the frame under the pair, fixed to the wall
      parts.add('frame', new THREE.BoxGeometry(0.06, 0.06, 2 * W).translate(x + dir * 0.25, F + 0.36, s * (IW - 0.04 - W)));
      parts.add('frame', new THREE.BoxGeometry(0.05, 0.36, 0.05).translate(x + dir * 0.25, F + 0.18, zEdge(s) + s * 0.1));
    };
    // a group of four facing seats between x = a and b on side s
    const group = (a: number, b: number, s: number, { hoops = [] }: { hoops?: number[] } = {}) => {
      pair(a + 0.06, s, 1);
      pair(b - 0.06, s, -1);
      for (const x of hoops) hoop(x, s);
    };
    // the tall yellow hoop over the aisle seats where two rows meet back to back
    const hoop = (x: number, s: number) => {
      const top = F + SEAT.back - 0.02, z = zAisle(s) - s * 0.12;
      parts.add('yellow', rail([[x - 0.1, top - 0.05, z], [x - 0.1, top + 0.22, z], [x + 0.1, top + 0.22, z], [x + 0.1, top - 0.05, z]], 0.018, 0.09));
    };
    // a row of seats along the wall from a to b on side s, priority seat at the `pEnd` end
    const longRow = (a: number, b: number, s: number, pEnd: number) => {
      const n = Math.max(1, Math.floor((b - a) / (W + 0.02)));
      const pitch = (b - a) / n;
      for (let k = 0; k < n; k++) {
        const x = a + pitch * (k + 0.5);
        S().along(parts, x, s, (pEnd < 0 && k === 0) || (pEnd > 0 && k === n - 1));
      }
      parts.add('frame', new THREE.BoxGeometry(b - a, 0.07, 0.2).translate((a + b) / 2, F + 0.36, s * (IW - 0.17)));
      // poles at both ends of the row, joined by a yellow rail overhead
      const zp = s * (IW - SEAT.depth - 0.12);
      for (const x of [a - 0.04, b + 0.04]) parts.add('yellow', pole(x, zp, F, ceilingY - 0.02, 0.017));
      parts.add('yellow', rail([[a - 0.04, F + 1.9, zp], [b + 0.04, F + 1.9, zp]], 0.017));
    };
    // multipurpose area: double lean rail on the wall and a pictogram
    const flexArea = (a: number, b: number, s: number) => {
      for (const y of [F + 0.7, F + 0.9]) {
        parts.add('yellow', rail([[a + 0.1, y, s * (IW - 0.03)], [a + 0.1, y, s * (IW - 0.1)], [b - 0.1, y, s * (IW - 0.1)], [b - 0.1, y, s * (IW - 0.03)]], 0.017, 0.05));
      }
    };

    const stretches = freeStretches(xa, xb, doors, DOOR, CLR);
    let bay = 0;
    for (const [a, b] of stretches) {
      const atDoorA = doors.some((d) => Math.abs(d + DOOR / 2 + CLR - a) < 0.01);
      const atDoorB = doors.some((d) => Math.abs(d - DOOR / 2 - CLR - b) < 0.01);
      const len = b - a;
      const cabEnd = def.cab && b >= xb - 0.01;
      if (cabEnd) {
        // one row of seats a side with their backs to the cab bulkhead
        for (const s of [-1, 1]) pair(xb - 0.03, s, -1, upgraded);
        continue;
      }
      // the longitudinal side in the upgrade alternates from bay to bay
      const longSide = ((bay + (def.flip ? 1 : 0)) % 2) ? -1 : 1;
      const isBay = atDoorA && atDoorB;
      for (const s of [-1, 1]) {
        if (upgraded && isBay && s === longSide) {
          longRow(a + 0.08, b - 0.6, s, 1);
          continue;
        }
        if (len > 2.6) {
          // two facing groups, back to back in the middle
          const mid = (a + b) / 2;
          group(a, mid - 0.05, s);
          group(mid + 0.05, b, s);
          if (!upgraded) hoop(mid, s);
        } else if (upgraded && !def.cab && ((a <= xa + 0.01 && s > 0) || (b >= xb - 0.01 && s < 0))) {
          // multipurpose area at the articulation, diagonally opposite at the two ends of the car
          flexArea(a, b, s);
        } else {
          group(a, b, s);
        }
      }
      if (isBay) bay++;
    }

    // doors: glass screens with poles at their aisle edges, poles in the pillar recesses, and a
    // yellow grip frame hanging over the door area
    for (const d of doors) {
      for (const e of [-1, 1]) {
        const x = d + e * (DOOR / 2 + 0.08);
        for (const s of [-1, 1]) {
          const zi = s * (IW - 0.58);
          parts.add('glass', new THREE.BoxGeometry(0.012, 1.55, 0.56).translate(x + e * 0.05, F + 1.12, s * (IW - 0.3)));
          parts.add('pillar', new THREE.BoxGeometry(0.04, 0.32, 0.56).translate(x + e * 0.05, F + 0.16, s * (IW - 0.3)));
          // pole at the screen's aisle edge, curving outwards near the ceiling
          parts.add('yellow', rail([[x + e * 0.05, F, zi], [x + e * 0.05, F + 2.05, zi], [x + e * 0.05, F + 2.25, zi + s * 0.2], [x + e * 0.05, ceilingY - 0.02, zi + s * 0.3]], 0.017, 0.15));
          // pole in the pillar recess between two grey cups
          const zp = s * (IW - 0.07);
          parts.add('yellow', pole(x - e * 0.06, zp, F + 0.9, F + 1.9, 0.017));
          for (const y of [F + 0.9, F + 1.9]) parts.add('pillar', new THREE.CylinderGeometry(0.035, 0.03, 0.06, 12).translate(x - e * 0.06, y, zp));
        }
      }
      const gy = F + 1.95;
      parts.add('yellow', rail([[d - 0.3, gy, -0.15], [d + 0.3, gy, -0.15], [d + 0.3, gy, 0.15], [d - 0.3, gy, 0.15], [d - 0.3, gy, -0.15]], 0.017, 0.06));
      parts.add('yellow', pole(d, 0, gy, ceilingY - 0.07, 0.017));
      parts.add('yellow', rail([[d, gy, -0.15], [d, gy, 0.15]], 0.017));
      for (const s of [-1, 1]) parts.add('lamp', new THREE.BoxGeometry(0.5, 0.02, 0.18).translate(d, ceilingY - 0.07, s * 0.24));
      if (upgraded) {
        // TFT widescreens set into the cove beside the doorway, angled down
        for (const s of [-1, 1]) {
          const g = new THREE.PlaneGeometry(0.5, 0.29);
          const slope = Math.atan2(1.33 - 1.02, 3.25 - 2.95);
          // facing down and in, flush with the cove
          g.rotateX(slope).rotateY(s > 0 ? Math.PI : 0);
          parts.add('screen', g.translate(d + e0(d) * (DOOR / 2 + 0.5), 3.1, s * 1.165));
        }
        // ceiling rails from the door grip towards the bays
        for (const e of [-1, 1]) {
          const x2 = d + e * 1.6;
          if (x2 > xa + 0.3 && x2 < xb - 0.3) parts.add('yellow', rail([[d + e * 0.3, gy, 0], [x2, gy, 0]], 0.017));
        }
      }
    }

    // the lowered centre spine with two rows of opal light panels and a perforated strip
    parts.add('ceiling', new THREE.BoxGeometry(xb - xa, 0.06, 0.74).translate((xa + xb) / 2, ceilingY - 0.02, 0));
    parts.add('frame', new THREE.BoxGeometry(xb - xa, 0.01, 0.15).translate((xa + xb) / 2, ceilingY - 0.055, 0));
    for (const [a, b] of stretches) {
      const n = Math.max(1, Math.round((b - a) / 1.6));
      const pitch = (b - a) / n;
      for (let k = 0; k < n; k++) {
        const x = a + pitch * (k + 0.5);
        for (const s of [-1, 1]) parts.add('lamp', new THREE.BoxGeometry(pitch - 0.25, 0.02, 0.22).translate(x, ceilingY - 0.055, s * 0.2));
      }
    }

    // LED destination displays hanging in front of the gangway portals and over the cab door
    const signAt = (x: number, face: number) => {
      parts.add('housing', new THREE.BoxGeometry(0.08, 0.15, 1.04).translate(x, ceilingY - 0.14, 0));
      parts.add('sign', new THREE.PlaneGeometry(0.98, 0.11).rotateY(face * Math.PI / 2).translate(x + face * 0.041, ceilingY - 0.14, 0));
    };
    signAt(xa + 0.15, 1);
    signAt(xb - 0.15, -1);
    if (upgraded) {
      // yellow hoops on the portal sides
      for (const x of def.cab ? [xa + 0.06] : [xa + 0.06, xb - 0.06]) {
        for (const s of [-1, 1]) {
          const z = s * (PORTAL.w / 2 + 0.1);
          parts.add('yellow', rail([[x, F + 0.7, z], [x, F + 0.7, z - s * 0.09], [x, F + 1.8, z - s * 0.09], [x, F + 1.8, z]], 0.017, 0.08));
        }
      }
    }
    return parts.meshes(ctx.mats, merge);
  };
}

const e0 = (d: number) => (d > 0 ? -1 : 1);

// Turntable floor between the sections: a round plate with a dark segmented ring.
function gangway(xc: number, mats: InteriorMaterials) {
  const plate = new THREE.CylinderGeometry(0.6, 0.6, 0.01, 48).translate(xc, F + 0.006, 0);
  const ring = new THREE.RingGeometry(0.47, 0.56, 48, 1).rotateX(-Math.PI / 2).translate(xc, F + 0.012, 0);
  const segs: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    segs.push(new THREE.BoxGeometry(0.1, 0.004, 0.012).rotateY(-a).translate(xc + Math.cos(a) * 0.515, F + 0.014, Math.sin(a) * 0.515));
  }
  return [new THREE.Mesh(plate, mats.plate), new THREE.Mesh(merge([ring, ...segs]), mats.ring)];
}

function make(style: C20InteriorStyle): InteriorSpec {
  return {
    key: style,
    lining: prof,
    floorY: F,
    lights: LIGHTS,
    endWall: 0.08,
    cabDepth: 3.42,
    portal: PORTAL,
    pleat: 0.05,
    noPlate: true,
    gangway,
    materials: makeMaterials(style),
    paint: makePaint(style),
    furnish: makeFurnish(style),
    doorLeaf,
  };
}

export const interior = { upgraded: make('upgraded'), original: make('original') };
