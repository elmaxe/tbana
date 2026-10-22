import * as THREE from 'three';
import { merge } from './kit';
import {
  liningProfile, seating, pole, rail, moquette, interiorMat, Parts, freeStretches, endWallMaterial,
  screenTexture, drawPictogram,
} from './interior';
import type { Painter } from './kit';
import type { CabinLights } from './cabin-light';
import type { InteriorContext, InteriorMaterials, InteriorSpec, Seating } from './interior';
import { C20_LED, C20U_TFT, displayMaterial } from './displays';
import { DOOR, windowPanes } from './c20';
import type { CarDef } from './train';

export type C20InteriorStyle = 'upgraded' | 'original';

// C20 interiors, from Wikimedia Commons photos (2008–2026), SL's seat plan for the upgrade and
// press material. See docs/rolling-stock.md for the research notes.
//
// Two styles:
//  - 'upgraded' (C20U): Alstom refurbished all 270 units in Västerås, 2020–2024, so this is how
//    every C20 looks today. 102 seats. In each bay, and at the inner end of the cab cars, one side
//    keeps two groups of four facing seats with a TFT screen over the pier between them, and the
//    other gets a row of six seats along the wall under a yellow rail, the priority seat by the
//    door. The sides alternate, and a cab car's inner-end row is on the same side as the flex area
//    across the gangway. At the cab a pair of seats a side backs onto the bulkhead, with a
//    priority seat along each wall. Each end of the middle car has a flex area with lean rails on
//    one side and, on the other, a pair backed onto the end wall facing a priority seat. Yellow
//    crescents on the backs of facing seats, and seats in the same "Plattan" triangle fabric as
//    the C30.
//  - 'original' (1997–2024): 126 seats officially (photos show 120), all in groups of four facing
//    seats, in Lasse Åberg's navy moquette with sketches of Stockholm in coloured lines; tall
//    yellow hoops on the backs.
// Both: light grey-white walls with an advert frame over each window, a silver-grey ceiling whose
// lowered centre spine carries two rows of opal light panels, bright yellow handholds, grey door
// pillars with poles in recesses, glass screens with straight poles at the doors, an H-shaped
// yellow grip over each door area, a yellow cab bulkhead, and open gangways with a turntable floor
// between the three sections.

const F = 1.0;     // floor above the rail
const IW = 1.3;    // inner half-width at seat height
// The lining's cross-section from the SketchUp model: lower walls leaning out to the window sills,
// the windows leaning in with the body, a sloping cove and a flat ceiling.
const prof = liningProfile([
  [0, F], [1.26, F, 0.02], [1.29, 1.26, 0.05], [1.33, 1.66, 0.05], [1.4, 1.85, 0.03], [1.3, 2.87, 0.05],
  [1.17, 3.23, 0.06], [1.0, 3.26, 0.04], [0.62, 3.33, 0.04], [0, 3.35],
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
    // an angled advert frame in the cove over each window
    windowPanes(def, x0, x1).forEach(([a, b], i) => {
      const [bg, fg] = ADS[(((i + Math.round(x0 * 3)) % ADS.length) + ADS.length) % ADS.length];
      const c = (a + b) / 2, w = Math.min(1.0, b - a) / 2;
      p.rect(c - w, c + w, 2.95, 3.22, C.adFrame);
      p.rect(c - w + 0.015, c + w - 0.015, 2.965, 3.205, { c: fg, r: 0.5 });
      p.rect(c - w + 0.015, c - w + 0.35, 2.965, 3.205, { c: bg, r: 0.5 });
    });
    for (const [a, b] of windowPanes(def, x0, x1)) {
      p.rect(a - 0.07, b + 0.07, 1.81, 2.93, C.reveal, 0.12);
      p.rect(a - 0.02, b + 0.02, 1.856, 2.881, C.rubber, 0.07);
      p.rect(a, b, 1.876, 2.861, C.hole, 0.06);
    }
    for (const d of def.doors) {
      const da = d - DOOR / 2, db = d + DOOR / 2;
      // grey pillars with stainless kick plates, the pictogram strip and emergency boxes
      for (const [pa, pb] of [[da - 0.16, da], [db, db + 0.16]]) {
        p.rect(pa, pb, F, 3.07, C.pillar);
        p.rect(pa, pb, F, F + 0.3, C.steel);
        p.rect(pa, pb, F, F + 0.03, C.rubber);
      }
      p.rect(db + 0.03, db + 0.13, 2.1, 2.62, C.pict);
      p.rect(da - 0.13, da - 0.05, 2.35, 2.5, C.green);
      p.rect(da - 0.13, da - 0.05, 2.6, 2.72, C.red);
      // the doorway: the leaves are separate (doorLeaf below)
      p.rect(da, db, F, 3.07, C.hole);
      // ribbed aluminium threshold
      p.rectT(da, db, floorEdge - 0.15, floorEdge, C.steel);
      for (let k = 0; k < 6; k++) p.rectT(da, db, floorEdge - 0.14 + k * 0.022, floorEdge - 0.132 + k * 0.022, C.ribbed);
    }
  };
}

// Inside of a door leaf: grey-white with a black seal at the centre, a ribbed stainless kick plate,
// a tall window, a column of pictograms by the outer edge and a plate above the window.
function doorLeaf(p: Painter, w: number) {
  p.rect(0, w, 0.95, 3.23, C.door);
  p.rect(0, w, 0.95, F + 0.3, C.steel);
  for (let y = F + 0.05; y < F + 0.28; y += 0.04) p.rect(0.02, w - 0.02, y, y + 0.015, C.ribbed);
  p.rect(0, 0.015, 0.95, 3.23, C.rubber);
  p.rect(0.13, 0.63, 1.856, 2.881, C.rubber, 0.06);
  p.rect(0.15, 0.61, 1.876, 2.861, C.hole, 0.05);
  for (let k = 0; k < 4; k++) p.rect(w - 0.12, w - 0.05, 2.2 + k * 0.09, 2.27 + k * 0.09, C.pict);
  p.rect(0.23, 0.53, 2.92, 2.98, C.sticker);
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
      plate: interiorMat('#b2b1ab', { roughness: 0.7 }),
      ring: interiorMat('#c9ccce', { roughness: 0.3, metalness: 0.8 }),
      insert: interiorMat('#3a3d41', { roughness: 0.7 }),
      frame: interiorMat('#7a7e83', { roughness: 0.4, metalness: 0.6 }),
      pillar: interiorMat('#a9abad', { roughness: 0.45 }),
      steel: interiorMat('#c3c7ca', { roughness: 0.22, metalness: 0.9 }),
      yellow: interiorMat('#f2d21e', { roughness: 0.4 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xdfeef0, roughness: 0.05, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e2, emissiveIntensity: 1.3 }),
      sign: displayMaterial('sign', C20_LED),
      housing: interiorMat('#1d2024', { roughness: 0.5 }),
      bezel: interiorMat('#d3d5d6', { roughness: 0.4 }),
      pictogram: new THREE.MeshStandardMaterial({ map: screenTexture(64, 132, drawPictograms), roughness: 0.5 }),
      bulkhead: bulkheadMaterial(),
    };
    if (style === 'original') {
      const ab = fab(aberg, 0.36, 256);
      Object.assign(mats, { shell: ab, back: ab, pan: ab });
    } else {
      // Plattan: two blues on the backs, plain navy cushions, plain charcoal rears; tone-on-tone
      // yellow on priority seats
      Object.assign(mats, {
        shell: fab((c, n) => plain(c, n, '#2f343c'), 0.05, 32),
        back: fab((c, n) => plattan(c, n, '#343d5a', '#6c7592'), 0.42),
        pan: fab((c, n) => plain(c, n, '#30374f'), 0.05, 32),
        backY: fab((c, n) => plattan(c, n, '#dfae1c', '#f2c322'), 0.42),
        panY: fab((c, n) => plain(c, n, '#ebba26'), 0.05, 32),
        screen: displayMaterial('screen', C20U_TFT),
      });
    }
    return mats;
  };
}

// The pram and wheelchair signs on the wall of a flex area: white on dark grey, one above the other.
function drawPictograms(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#e4e4e0'; ctx.fillRect(0, 0, w, h);
  drawPictogram(ctx, 2, 2, w - 4, 'wheelchair', '#2b2f36');
  drawPictogram(ctx, 2, h - w + 2, w - 4, 'pram', '#2b2f36');
}

// The cab bulkhead is bright yellow: the cab door between grey posts, its dark window, a stainless
// kick plate, posters either side, a grille at the top right and the car number at the top left.
function bulkheadMaterial() {
  return endWallMaterial({
    w: 1.5, y0: F, y1: 3.4,
    draw(ctx) {
      ctx.fillStyle = '#ecc81c'; ctx.fillRect(-1.5, F, 3, 2.4);
      ctx.fillStyle = '#a9abad';
      for (const x of [-0.42, 0.32]) ctx.fillRect(x, F, 0.1, 2.08);
      ctx.fillRect(-0.42, F + 2.0, 0.84, 0.08);
      ctx.fillStyle = '#b4b8bb'; ctx.fillRect(-0.32, F, 0.64, 0.25);
      ctx.fillStyle = '#0f1216';
      ctx.beginPath(); ctx.roundRect(-0.19, F + 0.98, 0.38, 0.8, 0.07); ctx.fill();
      ctx.fillStyle = '#9a9ea2'; ctx.fillRect(0.22, F + 0.95, 0.05, 0.14);
      // posters either side of the door
      for (const [x, bg, fg] of [[-0.99, '#f4efe6', '#c43a62'], [0.51, '#eef2f7', '#2b5d9b']] as const) {
        ctx.fillStyle = bg; ctx.fillRect(x, F + 1.15, 0.48, 0.69);
        ctx.fillStyle = fg; ctx.fillRect(x + 0.04, F + 1.5, 0.4, 0.28);
      }
      ctx.fillStyle = '#c9b02a';
      for (let y = F + 2.12; y < F + 2.3; y += 0.03) for (let x = 0.62; x < 1.0; x += 0.03) ctx.fillRect(x, y, 0.015, 0.015);
      ctx.save(); ctx.translate(-1.15, F + 2.2); ctx.scale(0.01, -0.01);
      ctx.fillStyle = '#16181b'; ctx.font = '700 7px Arial, sans-serif'; ctx.textBaseline = 'middle';
      ctx.fillText('2201 A', 0, 0);
      ctx.restore();
    },
  });
}

// ------------------------------------------------------------------ furnishing

const SEAT = { width: 0.45, height: 0.45, depth: 0.44, back: 1.15, recline: 0.12, shellT: 0.04, cushion: 0.06, cushionBack: 0.95 };
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
    // the ceiling where poles meet it, the height of the rails and grips, and the line of the poles
    // at the screens' aisle edges, which the rails along the walls join
    const poleTop = 3.31, gy = F + 2.0;
    const zPole = (s: number) => s * (IW - 0.58);

    // one seat across the car, back at x, facing dir, on a frame fixed to the wall
    const single = (x: number, z: number, dir: number, priority = false) => {
      S().across(parts, x, z, dir, priority);
      parts.add('frame', new THREE.BoxGeometry(0.06, 0.06, W).translate(x + dir * 0.25, F + 0.36, z));
    };
    // a row of two seats across one side, back at x, facing dir
    const pair = (x: number, s: number, dir: number, priority = false) => {
      S().across(parts, x, zWin(s), dir, priority);
      S().across(parts, x, zAisle(s), dir, false);
      parts.add('frame', new THREE.BoxGeometry(0.06, 0.06, 2 * W).translate(x + dir * 0.25, F + 0.36, s * (IW - 0.04 - W)));
      parts.add('frame', new THREE.BoxGeometry(0.05, 0.36, 0.05).translate(x + dir * 0.25, F + 0.18, zEdge(s) + s * 0.1));
    };
    // a short yellow handle on the sill under the window, between facing seats
    const sillGrab = (x: number, s: number) => {
      parts.add('yellow', rail([[x - 0.14, 1.8, s * 1.38], [x - 0.14, 1.8, s * 1.32], [x + 0.14, 1.8, s * 1.32], [x + 0.14, 1.8, s * 1.38]], 0.015, 0.03));
    };
    // a group of four facing seats between x = a and b on side s
    const group = (a: number, b: number, s: number) => {
      pair(a + 0.06, s, 1);
      pair(b - 0.06, s, -1);
      sillGrab((a + b) / 2, s);
    };
    // where two rows meet back to back: the original's tall closed hoop over the aisle seats, the
    // upgrade's yellow crescent rising from the aisle corner of the backs and bowing over the aisle
    const backGrab = (x: number, s: number) => {
      const top = F + SEAT.back;
      if (upgraded) {
        const z = zEdge(s) + s * 0.05;
        parts.add('yellow', new THREE.BoxGeometry(0.12, 0.05, 0.06).translate(x, top, z));
        parts.add('yellow', rail([[x, top, z], [x, top + 0.12, z - s * 0.11], [x, top + 0.32, z - s * 0.11], [x, top + 0.45, z]], 0.017, 0.12));
      } else {
        const z = zAisle(s) - s * 0.12;
        parts.add('yellow', rail([[x - 0.125, top - 0.03, z], [x - 0.125, top + 0.4, z], [x + 0.125, top + 0.4, z], [x + 0.125, top - 0.03, z]], 0.018, 0.11));
      }
    };
    // a yellow rail overhead along side s from x = a to b, hung from the ceiling about every metre
    const wallRail = (a: number, b: number, s: number) => {
      const z = zPole(s), n = Math.max(1, Math.round((b - a) / 1.0));
      parts.add('yellow', rail([[a, gy, z], [b, gy, z]], 0.017));
      for (let k = 0; k < n; k++) parts.add('steel', pole(a + ((b - a) * (k + 0.5)) / n, z, gy, poleTop, 0.01));
    };
    // a row of n seats along the wall on side s in the stretch [a, b], starting at its door end
    // `from`, the priority seat first, on a grey pedestal. The rail overhead runs from the screen
    // pole at one end of the stretch to the other, and two poles drop from it, bending at the
    // bottom into the seat frame, between the second and third seats and the fourth and fifth
    // from the door.
    const longRow = (a: number, b: number, from: number, n: number, s: number) => {
      const dir = from === a ? 1 : -1, x0 = from + dir * 0.06;
      const p = W + 0.02;
      for (let k = 0; k < n; k++) S().along(parts, x0 + dir * p * (k + 0.5), s, k === 0);
      const x1 = x0 + dir * p * n;
      parts.add('frame', new THREE.BoxGeometry(p * n, 0.07, 0.2).translate((x0 + x1) / 2, F + 0.36, s * (IW - 0.17)));
      parts.add('pillar', new THREE.BoxGeometry(p - 0.06, 0.32, 0.3).translate(x0 + dir * p / 2, F + 0.16, s * (IW - 0.2)));
      wallRail(a + 0.03, b - 0.03, s);
      const zp = zPole(s), zs = s * (IW - SEAT.depth + 0.04);
      for (const k of [2, 4]) {
        const x = x0 + dir * p * k;
        parts.add('yellow', rail([[x, gy, zp], [x, F + 0.62, zp], [x, F + 0.42, zs]], 0.017, 0.1));
      }
    };
    // flex area: a double lean rail on the wall, the rail overhead, and the pram and wheelchair
    // signs between the window and the end wall at `wall`
    const flexArea = (a: number, b: number, s: number, wall: number) => {
      for (const y of [F + 0.7, F + 0.9]) {
        parts.add('yellow', rail([[a + 0.1, y, s * (IW - 0.03)], [a + 0.1, y, s * (IW - 0.1)], [b - 0.1, y, s * (IW - 0.1)], [b - 0.1, y, s * (IW - 0.03)]], 0.017, 0.05));
      }
      wallRail(a + 0.03, b - 0.03, s);
      const x = wall + (wall > a ? -0.19 : 0.19);
      parts.add('pictogram', new THREE.PlaneGeometry(0.15, 0.31).rotateY(s > 0 ? Math.PI : 0).translate(x, F + 1.6, s * 1.3));
    };
    // a TFT screen in a light grey housing in the cove over the pier between two facing groups
    const tft = (x: number, s: number) => {
      const slope = Math.atan2(1.3 - 1.17, 3.23 - 2.87);
      const place = (g: THREE.BufferGeometry) => g.rotateX(slope).rotateY(s > 0 ? Math.PI : 0).translate(x, 3.03, s * 1.2);
      parts.add('bezel', place(new THREE.BoxGeometry(0.56, 0.38, 0.06).translate(0, 0, -0.03)));
      parts.add('screen', place(new THREE.PlaneGeometry(0.47, 0.29).translate(0, 0, 0.002)));
    };

    const stretches = freeStretches(xa, xb, doors, DOOR, CLR);
    const flexes: [number, number, number][] = [];
    let bay = 0;
    for (const [a, b] of stretches) {
      const atDoorA = doors.some((d) => Math.abs(d + DOOR / 2 + CLR - a) < 0.01);
      const atDoorB = doors.some((d) => Math.abs(d - DOOR / 2 - CLR - b) < 0.01);
      const len = b - a;
      const cabEnd = def.cab && b >= xb - 0.01;
      if (cabEnd) {
        // one pair of seats a side with their backs to the cab bulkhead, and in the upgrade a
        // single priority seat along each wall beside the door screen (photos); yellow grabs on the
        // posts of the cab door
        for (const s of [-1, 1]) {
          pair(xb - 0.03, s, -1);
          if (upgraded) S().along(parts, a + 0.06 + W / 2, s, true);
          parts.add('yellow', rail([[xb, F + 1.15, s * 0.37], [xb - 0.05, F + 1.15, s * 0.37], [xb - 0.05, F + 1.85, s * 0.37], [xb, F + 1.85, s * 0.37]], 0.015, 0.03));
        }
        continue;
      }
      // in the upgrade one side of each bay, and of a cab car's inner end, has a row of six along
      // the wall (photos), the priority seat by the door farther from the middle of the car. The
      // side alternates along the car; in a cab car the inner-end row is on the same side as the
      // flex area across the gangway.
      const isBay = atDoorA && atDoorB;
      const rowAt = upgraded && (isBay || (def.cab && len > 2.6)) ? (!atDoorA || (atDoorB && Math.abs(b) > Math.abs(a)) ? b : a) : null;
      const longSide = ((bay + (def.flip ? 1 : 0) + (def.cab ? 1 : 0)) % 2) ? -1 : 1;
      for (const s of [-1, 1]) {
        if (rowAt !== null && s === longSide) {
          longRow(a, b, rowAt, 6, s);
          continue;
        }
        const wall = a <= xa + 0.01 ? a : b;
        if (len > 2.6) {
          // two facing groups, back to back in the middle
          const mid = (a + b) / 2;
          group(a, mid - 0.05, s);
          group(mid + 0.05, b, s);
          backGrab(mid, s);
          if (rowAt !== null) tft(mid, s);
        } else if (upgraded && ((a <= xa + 0.01 && s > 0) || (b >= xb - 0.01 && s < 0))) {
          // flex area at the articulation, diagonally opposite at the two ends of the car
          flexArea(a, b, s, wall);
          flexes.push([a, b, s]);
        } else if (upgraded) {
          // opposite it, a pair backed onto the end wall facing one priority seat at the window
          const dir = wall === a ? 1 : -1;
          pair(wall + dir * 0.06, s, dir);
          single(wall === a ? b - 0.06 : a + 0.06, zWin(s), -dir, true);
          sillGrab((a + b) / 2, s);
        } else {
          group(a, b, s);
        }
      }
      if (rowAt !== null) bay++;
    }

    // doors: glass screens with straight poles at their aisle edges (beside a flex area only the
    // pole, on a foot of its own), poles in the pillar recesses between a grey drum and a cup, an
    // H-shaped grip over the door area, a light over each doorway and a camera dome
    for (const d of doors) {
      for (const e of [-1, 1]) {
        const x = d + e * (DOOR / 2 + 0.08), xs = x + e * 0.05;
        for (const s of [-1, 1]) {
          if (flexes.some(([a, b, fs]) => fs === s && xs > a - 0.15 && xs < b + 0.15)) {
            parts.add('pillar', new THREE.BoxGeometry(0.1, 0.05, 0.1).translate(xs, F + 0.025, zPole(s)));
          } else {
            parts.add('glass', new THREE.BoxGeometry(0.012, 1.55, 0.56).translate(xs, F + 1.12, s * (IW - 0.3)));
            parts.add('pillar', new THREE.BoxGeometry(0.04, 0.32, 0.56).translate(xs, F + 0.16, s * (IW - 0.3)));
          }
          parts.add('yellow', pole(xs, zPole(s), F, poleTop, 0.017));
          const xp = x - e * 0.06, zp = s * (IW - 0.07);
          parts.add('pillar', new THREE.CylinderGeometry(0.05, 0.05, 0.66, 16).translate(xp, F + 0.63, zp));
          parts.add('steel', new THREE.CylinderGeometry(0.052, 0.052, 0.3, 16).translate(xp, F + 0.15, zp));
          parts.add('yellow', pole(xp, zp, F + 0.96, F + 1.85, 0.017));
          parts.add('pillar', new THREE.CylinderGeometry(0.035, 0.03, 0.06, 12).translate(xp, F + 1.85, zp));
        }
      }
      for (const e of [-1, 1]) {
        const x = d + e * 0.88;
        parts.add('yellow', rail([[x, ceilingY - 0.05, -0.33], [x, gy, -0.33], [x, gy, 0.33], [x, ceilingY - 0.05, 0.33]], 0.017, 0.06));
      }
      parts.add('yellow', rail([[d - 0.88, gy, 0], [d + 0.88, gy, 0]], 0.017));
      for (const s of [-1, 1]) parts.add('lamp', new THREE.BoxGeometry(1.3, 0.015, 0.08).translate(d, 3.065, s * 1.21));
      parts.add('housing', new THREE.SphereGeometry(0.06, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(d + 0.45, ceilingY - 0.05, 0.46));
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

    // amber LED signs hanging in front of the gangway portals and over the cab door
    const signAt = (x: number, face: number) => {
      parts.add('housing', new THREE.BoxGeometry(0.08, 0.15, 1.04).translate(x, ceilingY - 0.14, 0));
      parts.add('sign', new THREE.PlaneGeometry(0.98, 0.11).rotateY(face * Math.PI / 2).translate(x + face * 0.041, ceilingY - 0.14, 0));
    };
    signAt(xa + 0.15, 1);
    signAt(xb - 0.15, -1);
    // yellow grabs on the portal sides
    for (const x of def.cab ? [xa + 0.06] : [xa + 0.06, xb - 0.06]) {
      for (const s of [-1, 1]) {
        const z = s * (PORTAL.w / 2 + 0.1);
        parts.add('yellow', rail([[x, F + 1.0, z], [x, F + 1.0, z - s * 0.09], [x, F + 1.9, z - s * 0.09], [x, F + 1.9, z]], 0.017, 0.08));
      }
    }
    return parts.meshes(ctx.mats, merge);
  };
}

// Turntable floor between the sections: a stainless ring with dark inserts round a plate in the
// floor's grey.
function gangway(xc: number, mats: InteriorMaterials) {
  const plate = new THREE.CylinderGeometry(0.6, 0.6, 0.01, 48).translate(xc, F + 0.006, 0);
  const ring = new THREE.RingGeometry(0.6, 0.7, 64, 1).rotateX(-Math.PI / 2).translate(xc, F + 0.012, 0);
  const segs: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    segs.push(new THREE.BoxGeometry(0.05, 0.004, 0.11).rotateY(-a).translate(xc + Math.cos(a) * 0.65, F + 0.014, Math.sin(a) * 0.65));
  }
  return [new THREE.Mesh(plate, mats.plate), new THREE.Mesh(ring, mats.ring), new THREE.Mesh(merge(segs), mats.insert)];
}

function make(style: C20InteriorStyle): InteriorSpec {
  return {
    key: style,
    lining: prof,
    floorY: F,
    lights: LIGHTS,
    endWall: 0.08,
    cabDepth: 2.08,
    portal: PORTAL,
    pleat: 0.05,
    noPlate: true,
    gangway,
    materials: makeMaterials(style),
    paint: makePaint(style),
    furnish: makeFurnish(style),
    doorLeaf,
    displays: style === 'upgraded' ? [C20_LED, C20U_TFT] : [C20_LED],
  };
}

export const interior = { upgraded: make('upgraded'), original: make('original') };
