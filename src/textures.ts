import * as THREE from 'three';
import type { Finish, Paving } from './open-styles';

// All textures are drawn procedurally so the project ships with no image assets.

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}

function toTexture(c: HTMLCanvasElement, { srgb = true, repeat = true, aniso = 8 }: { srgb?: boolean; repeat?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, alpha: number, seed: number, light = false) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : Math.floor(r() * 80);
    ctx.fillStyle = `rgba(${v},${v},${v},${r() * alpha})`;
    const s = 1 + r() * 2.5;
    ctx.fillRect(r() * w, r() * h, s, s);
  }
}

// Stone floor tiles, neutral grey so vertex colours can tint them. Covers 2 x 2 m.
export function floorTiles() {
  const [c, x] = canvas(512);
  x.fillStyle = '#f2f2f2';
  x.fillRect(0, 0, 512, 512);
  const r = rng(7);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const v = 228 + Math.floor(r() * 22);
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
    }
  }
  speckle(x, 512, 512, 5000, 0.12, 3);
  x.strokeStyle = 'rgba(90,90,90,0.55)';
  x.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, 512); x.stroke();
    x.beginPath(); x.moveTo(0, i * 128); x.lineTo(512, i * 128); x.stroke();
  }
  return toTexture(c);
}

// Stair treads: one texture repeat = 8 steps along v.
export function stairTreads() {
  const [c, x] = canvas(256, 512);
  for (let i = 0; i < 8; i++) {
    const y = i * 64;
    x.fillStyle = '#f0f0f0'; x.fillRect(0, y, 256, 64);
    x.fillStyle = '#d4d4d4'; x.fillRect(0, y + 50, 256, 14);
    x.fillStyle = '#9a9a9a'; x.fillRect(0, y + 60, 256, 4);
  }
  speckle(x, 256, 512, 2000, 0.1, 11);
  return toTexture(c);
}

// Escalator steps: grooved aluminium with yellow edges. One repeat = 6 steps.
export function escalatorSteps() {
  const [c, x] = canvas(256, 384);
  for (let i = 0; i < 6; i++) {
    const y = i * 64;
    x.fillStyle = '#5d6168'; x.fillRect(0, y, 256, 64);
    x.fillStyle = '#7b8089';
    for (let g = 6; g < 250; g += 8) x.fillRect(g, y + 4, 3, 50);
    x.fillStyle = '#f2c230'; x.fillRect(0, y + 56, 256, 8);
    x.fillRect(0, y, 10, 64); x.fillRect(246, y, 10, 64);
  }
  return toTexture(c);
}

// Small white wall tiles, 2 x 2 m per repeat.
export function wallTiles() {
  const [c, x] = canvas(512);
  x.fillStyle = '#b9b6ae';
  x.fillRect(0, 0, 512, 512);
  const r = rng(21);
  const tw = 512 / 10, th = 512 / 20;
  for (let j = 0; j < 20; j++) {
    for (let i = -1; i < 11; i++) {
      const off = (j % 2) * tw * 0.5;
      const v = 236 + Math.floor(r() * 14);
      x.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
      x.fillRect(i * tw + off + 1.5, j * th + 1.5, tw - 3, th - 3);
    }
  }
  // dado band
  x.fillStyle = 'rgba(40,70,120,0.85)';
  x.fillRect(0, 512 - 0.55 * 256, 512, 10);
  return toTexture(c);
}

// T-Centralen's blue line platform: painted bedrock with blue vines on white (after Per Olof Ultvedt's 1975 artwork).
export function caveVines() {
  const S = 1024;
  const [c, x] = canvas(S);
  const r = rng(1975);
  x.fillStyle = '#f4f6f8';
  x.fillRect(0, 0, S, S);
  // rocky shading blotches
  for (let i = 0; i < 260; i++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    const cx = r() * S, cy = r() * S, rad = 20 + r() * 90;
    x.save(); x.translate(cx, cy); x.scale(rad, rad * (0.5 + r()));
    g.addColorStop(0, `rgba(170,180,195,${0.08 + r() * 0.12})`);
    g.addColorStop(1, 'rgba(170,180,195,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  // vines that wrap across the tile edges
  const vine = (sx: number, sy: number) => {
    let px = sx, py = sy, ang = r() * Math.PI * 2;
    x.strokeStyle = '#1554b8';
    x.fillStyle = '#1554b8';
    x.lineCap = 'round';
    for (let k = 0; k < 140; k++) {
      ang += (r() - 0.5) * 0.5;
      const nx = px + Math.cos(ang) * 9, ny = py + Math.sin(ang) * 9;
      x.lineWidth = 7;
      for (const dx of [-S, 0, S]) {
        for (const dy of [-S, 0, S]) {
          x.beginPath(); x.moveTo(px + dx, py + dy); x.lineTo(nx + dx, ny + dy); x.stroke();
          if (k % 6 === 0) {
            const side = k % 12 === 0 ? 1 : -1;
            const la = ang + side * 1.1;
            x.save(); x.translate(nx + dx, ny + dy); x.rotate(la);
            x.beginPath(); x.ellipse(16, 0, 16, 6.5, 0, 0, Math.PI * 2); x.fill();
            x.restore();
          }
        }
      }
      px = ((nx % S) + S) % S; py = ((ny % S) + S) % S;
    }
  };
  for (let i = 0; i < 9; i++) vine(r() * S, r() * S);
  return toTexture(c);
}

export function concrete(seed = 5, base = 150) {
  const [c, x] = canvas(256);
  x.fillStyle = `rgb(${base},${base},${base})`;
  x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 3000, 0.25, seed);
  speckle(x, 256, 256, 1500, 0.08, seed + 1, true);
  return toTexture(c);
}

export function tunnelRock() {
  const [c, x] = canvas(512);
  const r = rng(99);
  x.fillStyle = '#4a4744';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    const v = 40 + Math.floor(r() * 50);
    x.fillStyle = `rgba(${v},${v - 3},${v - 6},0.5)`;
    x.beginPath();
    x.arc(r() * 512, r() * 512, 3 + r() * 22, 0, Math.PI * 2);
    x.fill();
  }
  speckle(x, 512, 512, 4000, 0.3, 4);
  return toTexture(c);
}

// Train side: body, windows, doors and a stripe in the line colour. One texture per car side.
export function trainSide(lineColor: string, { doors = 3, carLen = 16 }: { doors?: number; carLen?: number } = {}) {
  const W = 1024, H = 256;
  const [c, x] = canvas(W, H);
  const [ce, xe] = canvas(W, H);
  xe.fillStyle = '#000'; xe.fillRect(0, 0, W, H);
  x.fillStyle = '#d9dde2'; x.fillRect(0, 0, W, H);
  // roof shade
  x.fillStyle = '#b8bdc4'; x.fillRect(0, 0, W, 22);
  // stripe
  x.fillStyle = lineColor; x.fillRect(0, H - 62, W, 26);
  // windows
  const winTop = 70, winH = 70;
  const doorW = (1.4 / carLen) * W;
  const doorXs: number[] = [];
  for (let i = 0; i < doors; i++) doorXs.push(((i + 0.5) / doors) * W - doorW / 2);
  const glass = (gx: number, gy: number, gw: number, gh: number) => {
    x.fillStyle = '#1d2530'; x.fillRect(gx, gy, gw, gh);
    xe.fillStyle = '#fff1c9'; xe.fillRect(gx + 3, gy + 3, gw - 6, gh - 6);
  };
  let xPos = 14;
  for (let i = 0; i <= doors; i++) {
    const end = i < doors ? doorXs[i] - 14 : W - 14;
    if (end - xPos > 30) glass(xPos, winTop, end - xPos, winH);
    if (i < doors) xPos = doorXs[i] + doorW + 14;
  }
  for (const dx of doorXs) {
    x.fillStyle = '#9aa1aa'; x.fillRect(dx, 34, doorW, H - 70);
    x.fillStyle = '#5c636d'; x.fillRect(dx + doorW / 2 - 1.5, 34, 3, H - 70);
    glass(dx + 8, 50, doorW / 2 - 14, 96);
    glass(dx + doorW / 2 + 6, 50, doorW / 2 - 14, 96);
  }
  return { map: toTexture(c, { repeat: false }), emissiveMap: toTexture(ce, { repeat: false }) };
}

export function trainEnd() {
  const [c, x] = canvas(256);
  x.fillStyle = '#2a2e35'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#11151b'; x.fillRect(30, 40, 196, 90);
  x.fillStyle = '#fff6d8';
  x.beginPath(); x.arc(52, 200, 12, 0, Math.PI * 2); x.arc(204, 200, 12, 0, Math.PI * 2); x.fill();
  return toTexture(c, { repeat: false });
}

// Station name sign, SL style (blue plate, white text).
// (without `border`, on a band of the same colour along a wall: no white edge round it)
export function nameSign(text: string, bg = '#0c4da2', border = true) {
  const [c, x] = canvas(1024, 192);
  x.fillStyle = bg; x.fillRect(0, 0, 1024, 192);
  if (border) { x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 6; x.strokeRect(10, 10, 1004, 172); }
  x.fillStyle = '#fff';
  x.font = '600 104px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 512, 100);
  return toTexture(c, { repeat: false });
}

// Ballast with sleepers; one repeat = 4 sleepers along v.
export function trackBed() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#3b3936'; x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 6000, 0.6, 31);
  speckle(x, 256, 256, 1500, 0.15, 32, true);
  for (let i = 0; i < 4; i++) {
    x.fillStyle = '#5a554f'; x.fillRect(28, i * 64 + 18, 200, 26);
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(28, i * 64 + 42, 200, 4);
  }
  return toTexture(c);
}

// A building's facade, white so vertex colours tint it: four bays by two storeys (each 3 × 3.1 m;
// the material repeats it at a quarter and a half), a window with a sill in plaster in each, its
// glass different from bay to bay. The glass is marked in the alpha channel (see markGlass) so the
// walls' colour does not tint it.
export function facade() {
  const [c, x] = canvas(512, 256);
  x.fillStyle = '#f4f2ee';
  x.fillRect(0, 0, 512, 256);
  speckle(x, 512, 256, 2000, 0.1, 21);
  return bays(c, x, '#8c8a86', 23);
}

// The facade's other styles, also four bays by two storeys, light so vertex colours tint them.
// Brick: courses of bricks with darker joints, and the window.
export function facadeBrick() {
  const [c, x] = canvas(512, 256);
  x.fillStyle = '#e2ddd6';
  x.fillRect(0, 0, 512, 256);
  const r = rng(41);
  // courses 5 px high, bricks 14 px long, every other course offset by half
  for (let y = 0; y < 256; y += 5) {
    for (let k = -1; k < 38; k++) {
      const x0 = k * 14 + ((y / 5) % 2 ? 7 : 0);
      const v = 205 + Math.floor(r() * 50);
      x.fillStyle = `rgb(${v},${v - 4},${v - 8})`;
      x.fillRect(x0 + 1, y + 1, 12, 3);
    }
  }
  return bays(c, x, '#bdb7ae', 43);
}

// Glass: a curtain wall, panes between mullions, with a band at each floor.
export function facadeGlass() {
  const [c, x] = canvas(128);
  const g = x.createLinearGradient(0, 0, 128, 128);
  g.addColorStop(0, '#9fb2bf');
  g.addColorStop(1, '#6f8392');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#d4d8da';
  x.fillRect(0, 0, 128, 14);
  for (const m of [0, 63]) x.fillRect(m, 0, 3, 128);
  return toTexture(c, { aniso: 4 });
}

// Wood: vertical boards, and a smaller window with a white frame.
export function facadeWood() {
  const [c, x] = canvas(512, 256);
  x.fillStyle = '#efebe4';
  x.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 512; k += 8) {
    x.fillStyle = 'rgba(0,0,0,0.16)';
    x.fillRect(k, 0, 1, 256);
    x.fillStyle = 'rgba(255,255,255,0.18)';
    x.fillRect(k + 1, 0, 1, 256);
  }
  speckle(x, 512, 256, 1200, 0.08, 43);
  const r = rng(47), glass: number[][] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const ox = i * 128, oy = j * 128;
    x.fillStyle = '#fbfbf8';
    x.fillRect(ox + 42, oy + 36, 44, 54);
    paintGlass(x, ox + 46, oy + 40, 36, 46, r);
    glass.push([ox + 46, oy + 40, 36, 46]);
    x.fillStyle = '#fbfbf8';
    x.fillRect(ox + 62, oy + 40, 4, 46);
    x.fillRect(ox + 46, oy + 60, 36, 3);
  }
  markGlass(x, glass);
  return quarterHalf(toTexture(c, { aniso: 4 }));
}

// Plain: sheet metal or concrete, ribbed, without windows.
export function facadePlain() {
  const [c, x] = canvas(128);
  x.fillStyle = '#e4e4e2';
  x.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 128; k += 6) {
    x.fillStyle = 'rgba(0,0,0,0.1)';
    x.fillRect(k, 0, 2, 128);
  }
  speckle(x, 128, 128, 400, 0.07, 47);
  return toTexture(c, { aniso: 4 });
}

// the facades' windows, one in each bay of four by two: a frame, its glass, a glazing bar and a sill
function bays(c: HTMLCanvasElement, x: CanvasRenderingContext2D, frame: string, seed: number) {
  const r = rng(seed), glass: number[][] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const ox = i * 128, oy = j * 128;
    x.fillStyle = frame;
    x.fillRect(ox + 36, oy + 30, 56, 64);
    paintGlass(x, ox + 40, oy + 34, 48, 56, r);
    glass.push([ox + 40, oy + 34, 48, 56]);
    x.fillStyle = frame;
    x.fillRect(ox + 62, oy + 34, 4, 56);
    x.fillStyle = '#d8d6d2';
    x.fillRect(ox + 32, oy + 94, 64, 5);
  }
  markGlass(x, glass);
  return quarterHalf(toTexture(c, { aniso: 4 }));
}
// (the walls' uvs are in bays and storeys)
function quarterHalf(t: THREE.Texture) {
  t.repeat.set(0.25, 0.5);
  return t;
}

// Window glass in daylight: the sky reflected in its upper part, the room darker behind its lower,
// and now and then curtains, blinds or a darker room, a light reflection across it.
export function paintGlass(x: CanvasRenderingContext2D, gx: number, gy: number, gw: number, gh: number, r: () => number, tint: string | null = null, office = false) {
  const k = 0.88 + r() * 0.24;
  const shade = (hex: string) => {
    const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.min(255, Math.round(v * k));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };
  const g = x.createLinearGradient(0, gy, 0, gy + gh);
  g.addColorStop(0, shade('#b9c7d2'));
  g.addColorStop(0.4, shade('#8494a2'));
  g.addColorStop(1, shade('#56626d'));
  x.fillStyle = g;
  x.fillRect(gx, gy, gw, gh);
  if (tint) { x.fillStyle = tint; x.fillRect(gx, gy, gw, gh); }
  // (an office's windows have blinds rather than curtains)
  const v = r();
  if (v < 0.25 && !office) {
    // curtains drawn to the sides
    const cw = gw * (0.18 + r() * 0.12);
    x.fillStyle = r() < 0.5 ? 'rgba(236,228,212,0.85)' : 'rgba(222,226,228,0.8)';
    x.fillRect(gx, gy, cw, gh); x.fillRect(gx + gw - cw, gy, cw, gh);
    x.fillStyle = 'rgba(0,0,0,0.08)';
    for (let f = 3; f < cw; f += 5) { x.fillRect(gx + f, gy, 1, gh); x.fillRect(gx + gw - cw + f, gy, 1, gh); }
  } else if (office ? v > 0.82 : v < 0.42) {
    // a blind let down part of the way
    const bh = gh * (0.2 + r() * 0.5);
    x.fillStyle = office ? 'rgba(214,214,208,0.45)' : 'rgba(226,222,212,0.9)';
    x.fillRect(gx, gy, gw, bh);
    x.fillStyle = 'rgba(0,0,0,0.1)';
    for (let f = 2; f < bh; f += 3) x.fillRect(gx, gy + f, gw, 1);
  } else if (v < 0.58) {
    x.fillStyle = 'rgba(20,26,32,0.3)';
    x.fillRect(gx, gy + gh * 0.3, gw, gh * 0.7);
  }
  // a reflection across it
  x.save();
  x.beginPath(); x.rect(gx, gy, gw, gh); x.clip();
  x.fillStyle = `rgba(255,255,255,${0.06 + r() * 0.1})`;
  const s = gx + r() * gw;
  x.beginPath(); x.moveTo(s, gy); x.lineTo(s + gw * 0.35, gy); x.lineTo(s - gw * 0.25, gy + gh); x.lineTo(s - gw * 0.6, gy + gh); x.fill();
  x.restore();
}

// Marks the glass in a texture's alpha (half), for the walls' materials to leave it untinted
// (city.ts: untintedGlass).
function markGlass(x: CanvasRenderingContext2D, rects: number[][]) {
  for (const [gx, gy, gw, gh] of rects) {
    const d = x.getImageData(gx, gy, gw, gh);
    for (let i = 3; i < d.data.length; i += 4) d.data[i] = 128;
    x.putImageData(d, gx, gy);
  }
}

// Ground: rough, light grey, so vertex colours give it grass or paving. Covers 8 × 8 m.
export function ground() {
  const [c, x] = canvas(256);
  x.fillStyle = '#d6d6d6';
  x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 4000, 0.09, 31);
  speckle(x, 256, 256, 2500, 0.06, 32, true);
  return toTexture(c);
}

// Hötorget (1952): square tiles, 10 cm, glazed in seven shades of pale blue-green (Upsala-Ekeby),
// with white joints. One repeat is HOTORGET_REPEAT m across by `height` m up, drawn as seen
// (across, then up from the bottom). With `plate`, the station's name on a navy enamel plate at
// `plate` m from the bottom, in the middle of each repeat, as along its track walls; below
// `tilesFrom` m, plaster, darker with the dust of the track towards the bottom.
export const HOTORGET_REPEAT = 4.6;
const HOTORGET_BLUES = ['#cfe6e3', '#d6eae7', '#c6dfdc', '#dcefec', '#c9e2e1', '#d2e5e6', '#c2dcd9'];
function hotorgetTileCanvas(height: number, { plate = 0, tilesFrom = 0, mirror = false } = {}) {
  const PX = 24, TILE = 0.1;
  const nx = Math.round(HOTORGET_REPEAT / TILE), ny = Math.round(height / TILE);
  const [c, x] = canvas(nx * PX, ny * PX);
  const r = rng(1952);
  x.fillStyle = '#eef0ee';
  x.fillRect(0, 0, c.width, c.height);
  const rows = Math.round((height - tilesFrom) / TILE);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < nx; i++) {
      x.fillStyle = HOTORGET_BLUES[Math.floor(r() * HOTORGET_BLUES.length)];
      x.fillRect(i * PX + 1.2, j * PX + 1.2, PX - 2.4, PX - 2.4);
      // the glaze: lighter at the top of each tile
      x.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`;
      x.fillRect(i * PX + 2, j * PX + 2, PX - 4, (PX - 4) * 0.4);
    }
  }
  if (tilesFrom > 0) {
    const y0 = rows * PX;
    x.fillStyle = '#e6e3dc';
    x.fillRect(0, y0, c.width, c.height - y0);
    speckle(x, c.width, c.height - y0, 1500, 0.08, 3);
    const g = x.createLinearGradient(0, y0, 0, c.height);
    g.addColorStop(0, 'rgba(60,55,48,0)');
    g.addColorStop(1, 'rgba(60,55,48,0.7)');
    x.fillStyle = g;
    x.fillRect(0, y0, c.width, c.height - y0);
  }
  if (plate) {
    x.save();
    x.translate(c.width / 2, c.height - (plate / height) * c.height);
    if (mirror) x.scale(-1, 1);
    drawNamePlate(x, 'HÖTORGET', PX / TILE);
    x.restore();
  }
  return c;
}

// A navy enamel name plate 0.63 × 0.09 m (or of `color`), centred on the origin, `scale` px to
// the metre: the name in white capitals, spaced out.
function drawNamePlate(x: CanvasRenderingContext2D, text: string, scale: number, color = '#1d2c5e') {
  const w = 0.63 * scale, h = 0.09 * scale;
  x.fillStyle = color;
  x.fillRect(-w / 2, -h / 2, w, h);
  x.fillStyle = '#f4f2ea';
  x.font = `600 ${Math.round(h * 0.55)}px "Helvetica Neue", Arial, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(h * 0.08)}px`;
  x.fillText(text, 0, h * 0.04, w * 0.88);
}

// A name plate by itself, for a mesh.
export function namePlate(text: string) {
  const [c, x] = canvas(512, 74);
  x.translate(256, 37);
  drawNamePlate(x, text, 512 / 0.63);
  return toTexture(c, { repeat: false });
}

// Hötorget's track walls, turned for a sweep along the track: u up the wall from its foot (0) to
// the soffit (1), v along the track, HOTORGET_REPEAT m per repeat. One wall of a track sees the
// track's direction the other way round: `mirror` turns the name plates for it.
export function hotorgetWall(height: number, tilesFrom: number, plateAt: number, mirror = false) {
  const src = hotorgetTileCanvas(height, { plate: plateAt, tilesFrom, mirror });
  const [c, x] = canvas(src.height, src.width);
  // (across, up) → (up from the left, across)
  x.setTransform(0, 1, -1, 0, src.height, 0);
  x.drawImage(src, 0, 0);
  return toTexture(c);
}

// Hötorget's tiled columns: u across a face, v up it, a repeat across and up.
export function hotorgetColumn() {
  return toTexture(hotorgetTileCanvas(HOTORGET_REPEAT));
}

// The 1950s posters put back up on Hötorget's track walls, redrawn: 1.3 × 1.75 m.
const POSTER: [number, number] = [520, 700];
const HEAVY = '"Arial Black", "Helvetica Neue", Impact, sans-serif';

// "Visst katten – Apotekarnes vatten": a smiling cream cat with green eyes, its paws over a rail,
// on navy.
export function posterKatten() {
  const [W, H] = POSTER;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#1b2034';
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#efe9d6';
  x.font = `900 66px ${HEAVY}`;
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.fillText('Visst katten', W / 2, 98, W - 40);
  const cream = '#ece0b4', fur = '#fbf7ea', grey = '#9aa1a6';
  // the rail and the paws hanging over it
  x.fillStyle = '#e9e1c4';
  x.fillRect(40, 418, W - 80, 10);
  x.strokeStyle = fur; x.lineWidth = 6; x.fillStyle = cream;
  x.beginPath();
  x.moveTo(180, 330); x.bezierCurveTo(160, 370, 70, 360, 70, 400);
  x.bezierCurveTo(70, 450, 120, 470, 150, 440); x.bezierCurveTo(170, 420, 200, 400, 240, 390);
  x.lineTo(320, 380); x.bezierCurveTo(380, 375, 430, 370, 440, 410);
  x.bezierCurveTo(450, 450, 490, 450, 495, 410); x.bezierCurveTo(500, 360, 440, 330, 380, 335);
  x.closePath(); x.stroke(); x.fill();
  x.fillStyle = grey;
  for (const [px, py] of [[95, 440], [470, 435]]) { x.beginPath(); x.ellipse(px, py, 22, 14, 0, 0, Math.PI * 2); x.fill(); }
  // neck
  x.fillStyle = grey; x.beginPath(); x.ellipse(230, 330, 32, 40, 0, 0, Math.PI * 2); x.fill();
  // head and ears
  x.fillStyle = cream; x.strokeStyle = fur;
  x.beginPath();
  x.moveTo(120, 200); x.lineTo(165, 170); x.lineTo(205, 205);
  x.lineTo(290, 200); x.lineTo(335, 150); x.lineTo(335, 230);
  x.bezierCurveTo(340, 290, 290, 320, 230, 318); x.bezierCurveTo(170, 316, 140, 270, 120, 200);
  x.closePath(); x.stroke(); x.fill();
  x.fillStyle = grey;
  x.beginPath(); x.moveTo(140, 196); x.lineTo(165, 178); x.lineTo(180, 196); x.fill();
  x.beginPath(); x.moveTo(305, 196); x.lineTo(330, 160); x.lineTo(330, 205); x.fill();
  // eyes
  for (const ex of [195, 268]) {
    x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(ex, 245, 26, 16, ex < 230 ? 0.15 : -0.15, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#3f9a52'; x.beginPath(); x.ellipse(ex + 4, 245, 12, 12, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#10140f'; x.beginPath(); x.ellipse(ex + 4, 245, 4, 9, 0, 0, Math.PI * 2); x.fill();
  }
  // nose, smile, whiskers
  x.fillStyle = '#e06b6f';
  x.beginPath(); x.moveTo(222, 272); x.lineTo(244, 272); x.lineTo(233, 286); x.closePath(); x.fill();
  x.strokeStyle = '#2a2018'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(200, 292); x.quadraticCurveTo(233, 318, 268, 290); x.stroke();
  x.strokeStyle = '#f2f2f2'; x.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) {
    x.beginPath(); x.moveTo(250, 292 + k * 6); x.lineTo(430, 255 + k * 16); x.stroke();
    x.beginPath(); x.moveTo(215, 292 + k * 6); x.lineTo(100, 330 + k * 14); x.stroke();
  }
  // "Apotekarnes" vatten, in green
  x.fillStyle = '#3d9a52';
  x.font = 'italic 64px "Brush Script MT", "Segoe Script", cursive, serif';
  x.fillText('\u201eApotekarnes\u201d', W / 2, 565, W - 50);
  x.font = `900 64px ${HEAVY}`;
  x.fillText('vatten', W / 2, 648);
  return toTexture(c, { repeat: false });
}

// "Ta't lugnt – ta en TOY": a stick of chewing gum in a hat, leaning on its packet, on blue.
export function posterToy() {
  const [W, H] = POSTER;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#2f62d6';
  x.fillRect(0, 0, W, H);
  // the dark blob behind the packet
  x.fillStyle = '#21409a';
  x.beginPath();
  x.moveTo(170, 260); x.bezierCurveTo(200, 180, 360, 210, 420, 240); x.bezierCurveTo(500, 280, 470, 420, 410, 470);
  x.bezierCurveTo(330, 520, 200, 470, 175, 400); x.bezierCurveTo(150, 340, 150, 300, 170, 260); x.fill();
  x.fillStyle = '#f4efe2';
  x.font = `900 92px ${HEAVY}`;
  x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  x.fillText('ta\u2019t lugnt', 30, 130, W - 60);
  x.fillText('ta', 30, 400);
  x.fillText('en', 30, 640);
  x.font = `900 140px ${HEAVY}`;
  x.fillStyle = '#16120f'; x.fillText('TOY', 196, 650, 300);
  x.fillStyle = '#d8291c'; x.fillText('TOY', 186, 640, 300);
  // the packet: red sides, a yellow top with a blue label
  x.fillStyle = '#c8381f';
  x.beginPath(); x.moveTo(230, 340); x.lineTo(370, 300); x.lineTo(395, 420); x.lineTo(255, 460); x.closePath(); x.fill();
  x.fillStyle = '#9e2a17';
  x.beginPath(); x.moveTo(370, 300); x.lineTo(420, 330); x.lineTo(440, 440); x.lineTo(395, 420); x.closePath(); x.fill();
  x.fillStyle = '#f2c94a';
  x.beginPath(); x.moveTo(230, 340); x.lineTo(370, 300); x.lineTo(420, 330); x.lineTo(285, 372); x.closePath(); x.fill();
  x.save(); x.translate(320, 335); x.rotate(-0.28);
  x.fillStyle = '#7fb0e8'; x.fillRect(-55, -20, 110, 40);
  x.fillStyle = '#c8381f'; x.font = `900 24px ${HEAVY}`; x.textAlign = 'center'; x.fillText('TOY', 0, -1);
  x.fillStyle = '#1d2c5e'; x.font = '700 10px Arial, sans-serif'; x.fillText('SVENSKT TUGGUMMI', 0, 14);
  x.restore();
  // the stick of gum, lying back against the packet, with a straw hat and a smile
  x.save(); x.translate(270, 260); x.rotate(-0.5);
  x.fillStyle = '#f6f2e6'; x.strokeStyle = '#c9c2ae'; x.lineWidth = 3;
  x.beginPath(); x.roundRect(-38, -60, 76, 150, 18); x.fill(); x.stroke();
  x.strokeStyle = '#3a2b20'; x.lineWidth = 3;
  x.beginPath(); x.arc(-12, -12, 7, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
  x.beginPath(); x.arc(14, -12, 7, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
  x.beginPath(); x.arc(2, 8, 16, 0.2, Math.PI - 0.2); x.stroke();
  x.fillStyle = '#efc94c';
  x.fillRect(-46, -74, 92, 10); x.fillRect(-26, -96, 52, 24);
  x.fillStyle = '#c8381f'; x.fillRect(-26, -78, 52, 5);
  x.restore();
  // its arms round the packet
  x.strokeStyle = '#e07a43'; x.lineWidth = 14; x.lineCap = 'round';
  x.beginPath(); x.moveTo(300, 300); x.quadraticCurveTo(360, 280, 380, 330); x.stroke();
  x.beginPath(); x.moveTo(250, 330); x.quadraticCurveTo(230, 420, 280, 440); x.stroke();
  // two loose pieces
  x.fillStyle = '#f6f2e6'; x.strokeStyle = '#b9c4d6'; x.lineWidth = 3;
  for (const [px, py, a] of [[440, 420, -0.6], [410, 470, -0.3]]) {
    x.save(); x.translate(px, py); x.rotate(a);
    x.beginPath(); x.roundRect(-40, -16, 80, 32, 10); x.fill(); x.stroke();
    x.restore();
  }
  return toTexture(c, { repeat: false });
}

// Clinker floor tiles, 20 cm, in browns and beiges, as on Hötorget's platform. Covers 2 × 2 m.
export function clinker() {
  const [c, x] = canvas(500);
  x.fillStyle = '#7a6b5c';
  x.fillRect(0, 0, 500, 500);
  const r = rng(52);
  const shades = ['#a08b74', '#957f69', '#a99580', '#8c7761', '#9a866f'];
  for (let j = 0; j < 10; j++) {
    for (let i = 0; i < 10; i++) {
      x.fillStyle = shades[Math.floor(r() * shades.length)];
      x.fillRect(i * 50 + 2, j * 50 + 2, 46, 46);
    }
  }
  speckle(x, 500, 500, 4000, 0.12, 53);
  return toTexture(c);
}

// Smooth painted plaster, nearly white.
export function plaster() {
  const [c, x] = canvas(256);
  x.fillStyle = '#f4f4f2';
  x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 1500, 0.05, 61);
  return toTexture(c);
}

// Östermalmstorg (1965): in-situ concrete, light and pitted with small dark air holes, the joints
// of its formwork faintly showing; `w` × `h` m at `px` to the metre, drawn as seen.
function pittedConcrete(w: number, h: number, px: number, seed: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [c, x] = canvas(Math.round(w * px), Math.round(h * px));
  const r = rng(seed);
  x.fillStyle = '#cdc6b6';
  x.fillRect(0, 0, c.width, c.height);
  // clouds, lighter and darker
  for (let i = 0; i < w * h * 1.5; i++) {
    const cx = r() * c.width, cy = r() * c.height, rad = (0.3 + r() * 0.9) * px;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    const tone = r() < 0.5 ? '255,250,240' : '90,80,68';
    g.addColorStop(0, `rgba(${tone},${0.05 + r() * 0.06})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    x.fillStyle = g;
    x.fillRect(cx - rad, cy - rad, 2 * rad, 2 * rad);
  }
  speckle(x, c.width, c.height, w * h * px * 2, 0.12, seed + 1);
  // the formwork's joints, 1.2 m by 0.6 m
  x.strokeStyle = 'rgba(70,62,52,0.13)';
  x.lineWidth = Math.max(1, px * 0.006);
  for (let v = 0.6; v < h; v += 0.6) { x.beginPath(); x.moveTo(0, c.height - v * px); x.lineTo(c.width, c.height - v * px); x.stroke(); }
  for (let u = 1.2; u < w; u += 1.2) { x.beginPath(); x.moveTo(u * px, 0); x.lineTo(u * px, c.height); x.stroke(); }
  // the pits, some in clusters
  for (let i = 0; i < w * h * 260; i++) {
    let cx = r() * c.width, cy = r() * c.height;
    if (r() < 0.3) { cx += (r() - 0.5) * px * 0.1; cy += (r() - 0.5) * px * 0.1; }
    const s = (0.002 + r() * r() * 0.009) * px;
    x.fillStyle = `rgba(${40 + r() * 30},${34 + r() * 26},${28 + r() * 22},${0.45 + r() * 0.5})`;
    x.beginPath(); x.ellipse(cx, cy, s * (0.7 + r() * 0.6), s, r() * 3, 0, Math.PI * 2); x.fill();
  }
  return [c, x];
}

// Siri Derkert's Ristningar i betong (1961–65) at Östermalmstorg, redrawn: dark lines sandblasted
// into the track walls' concrete. One repeat is DERKERT_REPEAT m along the wall, from the tunnel
// floor `floor` m to `top` m above the rails, at DERKERT_PX to the metre.
export const DERKERT_REPEAT = 24;
const DERKERT_PX = 140;
function derkertCanvas(floor: number, top: number) {
  const PX = DERKERT_PX, [c, x] = pittedConcrete(DERKERT_REPEAT, top - floor, PX, 1965);
  const r = rng(1961);
  // dust of the track at the foot of the wall
  const g = x.createLinearGradient(0, c.height - 1.6 * PX, 0, c.height);
  g.addColorStop(0, 'rgba(60,52,44,0)');
  g.addColorStop(1, 'rgba(60,52,44,0.6)');
  x.fillStyle = g;
  x.fillRect(0, c.height - 1.6 * PX, c.width, 1.6 * PX);
  // in metres: along the wall, and up from the rails
  x.setTransform(PX, 0, 0, PX, 0, top * PX);
  const Y = (h: number) => -h;
  const ink = (alpha = 0.85) => `rgba(42,35,29,${alpha})`;
  x.lineCap = x.lineJoin = 'round';
  // a line through the points, a little unsteady, sandblasted: rough at its edges
  const line = (pts: [number, number][], w = 0.03) => {
    const j = () => (r() - 0.5) * 0.012;
    const q = pts.map(([u, h]) => [u + j(), Y(h) + j()] as [number, number]);
    x.strokeStyle = ink(); x.lineWidth = w;
    x.beginPath(); x.moveTo(...q[0]);
    for (let i = 1; i < q.length - 1; i++) x.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
    x.lineTo(...q[q.length - 1]);
    x.stroke();
    x.fillStyle = ink(0.6);
    for (let i = 1; i < q.length; i++) {
      const n = Math.ceil(Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]) / 0.03);
      for (let k = 0; k < n; k++) {
        const f = r(), s = w * (0.3 + r() * 0.5);
        x.fillRect(q[i - 1][0] + (q[i][0] - q[i - 1][0]) * f + (r() - 0.5) * w * 1.6, q[i - 1][1] + (q[i][1] - q[i - 1][1]) * f + (r() - 0.5) * w * 1.6, s, s);
      }
    }
  };
  const loop = (cx: number, cy: number, rx: number, ry: number, n = 14, wob = 0.08) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, k = 1 + (r() - 0.5) * wob;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    line(pts);
  };
  const words = (text: string, u: number, h: number, size: number, tilt = 0) => {
    x.save();
    // (in 100 px type, scaled down: canvases don't draw type a fraction of a pixel high)
    x.translate(u, Y(h)); x.rotate(tilt); x.scale(size / 100, size / 100);
    x.font = '400 100px "Helvetica Neue", Arial, sans-serif';
    x.lineWidth = 2.6 / size; x.strokeStyle = ink();
    // a letter at a time, each a little off its line
    let u0 = 0;
    for (const ch of text) {
      x.save(); x.translate(u0, (r() - 0.5) * 10); x.rotate((r() - 0.5) * 0.12);
      x.strokeText(ch, 0, 0);
      x.restore();
      u0 += x.measureText(ch).width + 6;
    }
    x.restore();
  };
  // a face, front on: `s` m tall
  const face = (u: number, h: number, s: number) => {
    loop(u, h, s * 0.36, s * 0.5, 16, 0.12);
    // hair: strokes falling from the crown
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.15 + 0.7 * r());
      line([[u + Math.cos(a) * s * 0.3, h + Math.sin(a) * s * 0.45], [u + Math.cos(a) * s * 0.55, h + s * (0.2 - r() * 0.6)], [u + Math.cos(a) * s * 0.5, h - s * (0.4 + r() * 0.3)]]);
    }
    for (const e of [-1, 1]) {
      line([[u + e * s * 0.2, h + s * 0.1], [u + e * s * 0.12, h + s * 0.14], [u + e * s * 0.04, h + s * 0.1]]);
      line([[u + e * s * 0.19, h + s * 0.06], [u + e * s * 0.12, h + s * 0.03], [u + e * s * 0.05, h + s * 0.06]]);
      line([[u + e * s * 0.22, h + s * 0.2], [u + e * s * 0.05, h + s * 0.22]]);
    }
    line([[u + s * 0.02, h + s * 0.12], [u - s * 0.03, h - s * 0.12], [u + s * 0.06, h - s * 0.15]]);
    line([[u - s * 0.12, h - s * 0.28], [u, h - s * 0.31], [u + s * 0.12, h - s * 0.27]]);
    line([[u - s * 0.13, h - s * 0.48], [u - s * 0.15, h - s * 0.75]]);
    line([[u + s * 0.13, h - s * 0.48], [u + s * 0.15, h - s * 0.75]]);
  };
  // a woman standing, in profile facing `dir`, a book held before her: from her feet at `foot`
  // to the top of her head, `s` m
  const figure = (u: number, foot: number, s: number, dir = 1) => {
    const hu = u + dir * s * 0.03, hh = foot + s * 0.92;
    // head: the back of it round, the profile with brow, nose and lips
    line([[hu + dir * s * 0.05, hh + s * 0.07], [hu - dir * s * 0.03, hh + s * 0.08], [hu - dir * s * 0.07, hh + s * 0.01], [hu - dir * s * 0.05, hh - s * 0.06]]);
    line([[hu + dir * s * 0.05, hh + s * 0.07], [hu + dir * s * 0.065, hh + s * 0.02], [hu + dir * s * 0.09, hh - s * 0.005], [hu + dir * s * 0.065, hh - s * 0.02],
      [hu + dir * s * 0.075, hh - s * 0.035], [hu + dir * s * 0.06, hh - s * 0.05], [hu + dir * s * 0.04, hh - s * 0.075]]);
    line([[hu + dir * s * 0.035, hh + s * 0.02], [hu + dir * s * 0.05, hh + s * 0.02]], 0.016);
    // neck, shoulders and the long body to the hem
    line([[hu - dir * s * 0.04, hh - s * 0.06], [u - dir * s * 0.045, foot + s * 0.79], [u - dir * s * 0.1, foot + s * 0.74], [u - dir * s * 0.11, foot + s * 0.4], [u - dir * s * 0.1, foot + s * 0.12]]);
    line([[hu + dir * s * 0.03, hh - s * 0.08], [u + dir * s * 0.05, foot + s * 0.78], [u + dir * s * 0.1, foot + s * 0.72], [u + dir * s * 0.1, foot + s * 0.4], [u + dir * s * 0.09, foot + s * 0.12]]);
    line([[u - dir * s * 0.1, foot + s * 0.12], [u + dir * s * 0.09, foot + s * 0.12]]);
    // arm and the book
    line([[u - dir * s * 0.09, foot + s * 0.72], [u - dir * s * 0.07, foot + s * 0.56], [u + dir * s * 0.16, foot + s * 0.56]]);
    line([[u + dir * s * 0.08, foot + s * 0.62], [u + dir * s * 0.2, foot + s * 0.6], [u + dir * s * 0.2, foot + s * 0.5], [u + dir * s * 0.08, foot + s * 0.52], [u + dir * s * 0.08, foot + s * 0.62]]);
    // legs and feet
    for (const k of [-0.04, 0.04]) line([[u + k * s, foot + s * 0.12], [u + k * s + (r() - 0.5) * 0.02, foot + s * 0.01], [u + k * s + dir * s * 0.04, foot]]);
  };
  // staves of song: five lines `len` long, rising at `tilt`, with notes on them
  const staff = (u: number, h: number, len: number, tilt: number) => {
    const cs = Math.cos(tilt), sn = Math.sin(tilt), gap = 0.05;
    const p = (t: number, k: number): [number, number] => [u + t * cs - k * sn, h + t * sn + k * cs];
    for (let k = 0; k < 5; k++) line([p(0, k * gap), p(len * 0.5, k * gap), p(len, k * gap)], 0.014);
    for (let t = 0.15; t < len - 0.05; t += 0.12 + r() * 0.16) {
      const k = Math.floor(r() * 9) * gap / 2, [nu, nh] = p(t, k);
      x.fillStyle = ink();
      x.beginPath(); x.ellipse(nu, Y(nh), 0.03, 0.022, -tilt - 0.4, 0, Math.PI * 2); x.fill();
      line([[nu + 0.027, nh], [nu + 0.027 - sn * 0.17, nh + cs * 0.17]], 0.014);
    }
  };
  // grass and reeds, with birds over them
  const reeds = (u: number, h: number, w: number, tall: number) => {
    for (let i = 0; i < w * 9; i++) {
      const s = u + r() * w, t = tall * (0.5 + r() * 0.5), bend = (r() - 0.5) * 0.3;
      line([[s, h], [s + bend * 0.3, h + t * 0.5], [s + bend, h + t]], 0.018);
      if (r() < 0.5) { const k = h + t * (0.3 + r() * 0.5), e = r() < 0.5 ? -1 : 1; line([[s + bend * 0.2, k], [s + e * 0.12, k + 0.1], [s + e * 0.2, k + 0.08]], 0.016); }
    }
    for (let i = 0; i < 3; i++) {
      const bu = u + r() * w, bh = h + tall + 0.15 + r() * 0.35, s = 0.1 + r() * 0.08;
      line([[bu - s, bh + s * 0.4], [bu - s * 0.4, bh + s * 0.3], [bu, bh]]); line([[bu, bh], [bu + s * 0.4, bh + s * 0.35], [bu + s, bh + s * 0.5]]);
    }
  };
  // two hands reaching to each other
  const hand = (u: number, h: number, dir: number) => {
    line([[u - dir * 0.6, h - 0.05], [u - dir * 0.2, h], [u, h + 0.04]]);
    line([[u - dir * 0.6, h - 0.15], [u - dir * 0.2, h - 0.12], [u, h - 0.08]]);
    for (let k = 0; k < 4; k++) line([[u, h + 0.04 - k * 0.04], [u + dir * (0.14 + 0.03 * Math.sin(k)), h + 0.05 - k * 0.045]], 0.016);
  };

  words('RACHEL CARSON', 0.35, 3.95, 0.16, -0.04);
  words('TYST VÅR', 1.0, 3.6, 0.2, 0.02);
  reeds(0.5, 1.55, 2.2, 1.5);
  face(4.0, 2.75, 0.95);
  for (let i = 0; i < 4; i++) staff(5.3 + i * 0.12, 3.35 - i * 0.42, 1.25, 0.3 - i * 0.15);
  figure(8.0, 1.5, 2.25, 1);
  hand(9.5, 2.6, -1);
  for (let i = 0; i < 6; i++) figure(10.6 + i * 0.68, 1.45 + (r() - 0.5) * 0.08, 2.0 + r() * 0.25, -1);
  staff(10.8, 3.75, 3.2, -0.03);
  hand(5.6, 1.9, 1); hand(6.9, 1.95, -1);
  face(14.2, 1.9, 0.55);
  words('PAX', 15.0, 3.55, 0.3, -0.05);
  words('FRIEDEN', 15.6, 3.05, 0.2, 0.06);
  words('МИР', 17.3, 3.7, 0.26, 0);
  words('PEACE', 14.6, 2.3, 0.22, -0.08);
  words('FRED', 17.2, 2.2, 0.24, 0.05);
  words('PAIX', 16.0, 1.75, 0.2, 0);
  loop(16.6, 2.75, 0.3, 0.3, 18, 0.04);
  line([[16.6, 3.05], [16.6, 2.45]]); line([[16.6, 2.75], [16.39, 2.54]]); line([[16.6, 2.75], [16.81, 2.54]]);
  face(18.6, 2.9, 0.75);
  face(19.4, 2.45, 0.65);
  staff(20.2, 3.45, 2.3, 0.02);
  figure(21.6, 1.5, 2.2, 1);
  reeds(22.4, 1.55, 1.1, 0.9);
  x.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}

// The track walls at Östermalmstorg, turned for a sweep along the track as hotorgetWall's: u up
// the wall from the tunnel floor (0) to the vault (1), v along the track. One wall of a track
// sees the track's direction the other way round: `mirror` turns the drawing for it.
export function derkertWall(floor: number, top: number, mirror = false) {
  const src = derkertCanvas(floor, top);
  const [c, x] = canvas(src.height, src.width);
  x.setTransform(0, 1, -1, 0, src.height, 0);
  if (mirror) { x.translate(src.width, 0); x.scale(-1, 1); }
  x.drawImage(src, 0, 0);
  return toTexture(c);
}

// The wall behind Östermalmstorg's platforms: the same concrete, 2.4 × 2.4 m, u along the wall.
export function pittedWall() {
  return toTexture(pittedConcrete(2.4, 2.4, 160, 1964)[0]);
}

// Östermalmstorg's vault: smooth white plaster, 4 m across (u) and 6 m along (v), with a joint
// across it at each 6 m.
export function vaultPlaster() {
  const [c, x] = canvas(256, 384);
  x.fillStyle = '#f3f3f0';
  x.fillRect(0, 0, c.width, c.height);
  speckle(x, c.width, c.height, 2000, 0.04, 62);
  x.fillStyle = 'rgba(80,80,78,0.22)';
  x.fillRect(0, 0, c.width, 3);
  return toTexture(c);
}

// Dark terrazzo, polished, as on Östermalmstorg's platforms: 2 × 2 m.
export function terrazzo() {
  const [c, x] = canvas(512);
  x.fillStyle = '#424447';
  x.fillRect(0, 0, 512, 512);
  const r = rng(65);
  for (let i = 0; i < 6000; i++) {
    const v = r() < 0.6 ? 120 + r() * 80 : 25 + r() * 30, s = 0.6 + r() * r() * 3;
    x.fillStyle = `rgba(${v},${v},${v - 4},${0.12 + r() * 0.3})`;
    x.beginPath(); x.ellipse(r() * 512, r() * 512, s, s * (0.5 + r() * 0.5), r() * 3, 0, Math.PI * 2); x.fill();
  }
  speckle(x, 512, 512, 4000, 0.1, 66);
  return toTexture(c);
}

// The band along a platform's edge at Östermalmstorg, u across from the edge (0) to 1.3 m in (1),
// v along it, 1.2 m a repeat: the edge stones, three rows of pale 30 cm tiles, then a strip of
// grey ribbed tiles for the blind.
export const EDGE_BAND = 1.3, EDGE_REPEAT = 1.2;
export function edgeBand() {
  const PX = 400, [c, x] = canvas(EDGE_BAND * PX, EDGE_REPEAT * PX);
  const r = rng(30);
  x.fillStyle = '#b4b0a7';
  x.fillRect(0, 0, 0.08 * PX, c.height);
  x.fillStyle = '#a89f8c';
  x.fillRect(0.08 * PX, 0, 0.9 * PX, c.height);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) {
      const v = Math.floor(r() * 10);
      x.fillStyle = `rgb(${226 + v},${214 + v},${188 + v})`;
      x.fillRect((0.08 + i * 0.3) * PX + 1.5, j * 0.3 * PX + 1.5, 0.3 * PX - 3, 0.3 * PX - 3);
    }
  }
  x.fillStyle = '#5c5d5f';
  x.fillRect(0.98 * PX, 0, 0.3 * PX, c.height);
  x.fillStyle = '#76777a';
  for (let k = 0; k < 6; k++) x.fillRect((1.005 + k * 0.045) * PX, 0, 0.02 * PX, c.height);
  x.fillStyle = '#424447';
  x.fillRect(1.28 * PX, 0, 0.02 * PX, c.height);
  speckle(x, c.width, c.height, 3000, 0.08, 31);
  return toTexture(c);
}

// SL's white station name sign with the name in black: 2.6 × 0.4 m.
export function whiteNameSign(text: string) {
  const [c, x] = canvas(1040, 160);
  x.fillStyle = '#f4f4f1'; x.fillRect(0, 0, 1040, 160);
  x.fillStyle = '#1a1a1a';
  x.font = '600 84px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 520, 84, 960);
  return toTexture(c, { repeat: false });
}

// The blue line's caves (src/hall-styles.ts): the rock left as it was blasted, sprayed with
// concrete and painted. One texture covers CAVE_ACROSS m round from the floor (u: up a wall and
// on over the roof, from the nearer wall) and CAVE_REPEAT m along the station (v, repeating),
// at CAVE_PX to the metre.
export const CAVE_ACROSS = 18, CAVE_REPEAT = 24;
const CAVE_PX = 48;
export interface CavePaint {
  seed: number;
  // the colours of the rock in bands round from the floor, each from `from` m; `edge`, the line
  // where it starts: ragged as brushed, or a soft fade
  bands: { from: number; color: string; edge?: 'ragged' | 'soft' }[];
  motifs?: CaveMotif[];
}
// What is painted on the rock, between `from` and `to` m round from the floor.
export type CaveMotif =
  // leaves on winding stems
  | { kind: 'vines'; color: string; from: number; to: number; count: number; leaf?: number }
  // a forest's silhouette standing on the line `from`, up to `to`
  | { kind: 'forest'; color: string; from: number; to: number }
  // stripes across the cave (rings round it) or along it, in turn of these colours
  | { kind: 'stripes'; colors: string[]; from: number; to: number; width: number; gap: number; along?: boolean }
  // dabs of colour scattered over it, soft-edged as sprayed, or `hard`
  | { kind: 'dabs'; colors: string[]; from: number; to: number; size: number; count: number; hard?: boolean }
  // simple figures, people, in outline or filled
  | { kind: 'people'; colors: string[]; from: number; to: number; count: number; outline?: boolean }
  // outlined drawings: houses, suns, flowers, birds, as a child draws them
  | { kind: 'doodles'; color: string; from: number; to: number; count: number }
  // panels set into the rock, `width` m along, framed: a mosaic with a knot of runes in it, a
  // ruled page with fragments of bones and shells, or a plain field
  // ruled page with fragments of bones and shells, a harlequin of little diamond tiles in bright
  // colours, a tiled mural of people in front of a goal under a blue sky, or a plain field
  | { kind: 'panels'; color: string; frame: string; from: number; to: number; width: number; every: number; pattern?: 'mosaic' | 'ruled' | 'harlequin' | 'mural' }
  // a band along the cave zigzagging in turn of these colours
  | { kind: 'zigzag'; colors: string[]; at: number; width: number; pitch: number }
  // thin lines running down the rock, wavering, like veins of a mineral
  | { kind: 'drips'; colors: string[]; from: number; to: number; count: number; width?: number }
  // a pond of water lilies: patches of blue water, round pads with a notch, small flowers
  | { kind: 'lilies'; from: number; to: number; count: number }
  // a ribbon painted along the walls
  | { kind: 'ribbon'; color: string; at: number; width: number; wave?: number }
  // a pattern of soft clouds
  | { kind: 'clouds'; color: string; from: number; to: number; count: number }
  // great masses of foliage hanging from the roof, their lower edges scalloped like leaves
  | { kind: 'canopy'; color: string; shade: string; from: number; to: number }
  // squares of sky set at angles into the rock, with clouds in them
  | { kind: 'windows'; color: string; from: number; to: number; count: number; size: number }
  // a painted frieze along the wall, `from`–`to` round: a night sky over hills, a town and a
  // factory, and a march of black figures with red banners
  | { kind: 'frieze'; from: number; to: number }
  // lines of small handwriting in many colours
  | { kind: 'writing'; colors: string[]; from: number; to: number }
  // cracks in the rock traced in paint: thin lines wandering every way, branching
  | { kind: 'cracks'; colors: string[]; from: number; to: number; count: number }
  // flowing bands, as of water or of folds in stone: wavering strokes up to `width` m wide,
  // thinning to their ends, `length` m long, running about `angle` degrees round from along the
  // cave (90: up the wall)
  | { kind: 'swirls'; colors: string[]; from: number; to: number; count: number; width: number; length: number; angle?: number };

export function caveRock(paint: CavePaint) {
  const PX = CAVE_PX, W = CAVE_ACROSS * PX, H = CAVE_REPEAT * PX;
  const [c, x] = canvas(W, H);
  const r = rng(paint.seed);
  // in metres: x round from the floor, y along
  x.setTransform(PX, 0, 0, PX, 0, 0);
  // the bands; a ragged edge wanders and is brushed, wrapping along
  const bands = [...paint.bands].sort((a, b) => a.from - b.from);
  for (const [i, b] of bands.entries()) {
    const to = i + 1 < bands.length ? bands[i + 1].from : CAVE_ACROSS + 1;
    if (b.edge === 'soft' && i > 0) {
      const g = x.createLinearGradient(b.from - 0.6, 0, b.from + 0.6, 0);
      g.addColorStop(0, `${b.color}00`); g.addColorStop(1, b.color);
      x.fillStyle = g; x.fillRect(b.from - 0.6, 0, 1.2, CAVE_REPEAT);
      x.fillStyle = b.color; x.fillRect(b.from + 0.6, 0, to - b.from - 0.6, CAVE_REPEAT);
    } else if (b.edge === 'ragged' && i > 0) {
      x.fillStyle = b.color;
      x.beginPath(); x.moveTo(to, 0);
      const n = 96, ph = r() * 6;
      for (let k = 0; k <= n; k++) {
        const y = (k / n) * CAVE_REPEAT, t = (k / n) * Math.PI * 2;
        x.lineTo(b.from + 0.25 * Math.sin(t * 3 + ph) + 0.15 * Math.sin(t * 7 + 2 * ph) + (r() - 0.5) * 0.12, y);
      }
      x.lineTo(to, CAVE_REPEAT); x.closePath(); x.fill();
    } else {
      x.fillStyle = b.color; x.fillRect(b.from, 0, to - b.from, CAVE_REPEAT);
    }
  }
  for (const m of paint.motifs ?? []) caveMotif(x, m, r);
  // the rock under the paint: lumps lit from above and shadowed below, and pits
  x.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < CAVE_ACROSS * CAVE_REPEAT * 1.4; i++) {
    const cx = r() * W, cy = r() * H, rad = (0.25 + r() * 0.9) * PX, sx = 0.5 + r();
    for (const [dy, tone, a] of [[-0.25, '255,255,255', 0.1], [0.3, '0,0,0', 0.16]] as const) {
      const g = x.createRadialGradient(cx, cy + dy * rad, 0, cx, cy + dy * rad, rad);
      g.addColorStop(0, `rgba(${tone},${a * (0.5 + r())})`); g.addColorStop(1, `rgba(${tone},0)`);
      x.save(); x.translate(cx, cy); x.scale(sx, 1); x.translate(-cx, -cy);
      x.fillStyle = g;
      for (const oy of [-H, 0, H]) x.fillRect(cx - rad, cy + oy - rad + dy * rad, 2 * rad, 2 * rad);
      x.restore();
    }
  }
  speckle(x, W, H, W * H * 0.05, 0.2, paint.seed + 1);
  // darker towards the floor, with the track's dust
  const g = x.createLinearGradient(0, 0, 1.6 * PX, 0);
  g.addColorStop(0, 'rgba(40,36,32,0.55)'); g.addColorStop(1, 'rgba(40,36,32,0)');
  x.fillStyle = g; x.fillRect(0, 0, 1.6 * PX, H);
  const t = toTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
}

function caveMotif(x: CanvasRenderingContext2D, m: CaveMotif, r: () => number) {
  const L = CAVE_REPEAT;
  // draw `f` at y and again a repeat away, where it would cross the texture's edge
  const wrap = (y: number, reach: number, f: (y: number) => void) => {
    f(y); if (y < reach) f(y + L); if (y > L - reach) f(y - L);
  };
  const across = (from: number, to: number) => from + r() * (to - from);
  switch (m.kind) {
    case 'vines': {
      x.strokeStyle = x.fillStyle = m.color; x.lineCap = 'round';
      const leaf = m.leaf ?? 0.2;
      for (let i = 0; i < m.count; i++) {
        let u = across(m.from, m.to), y = r() * L, ang = r() * Math.PI * 2;
        for (let k = 0; k < 60; k++) {
          ang += (r() - 0.5) * 0.6;
          const nu = Math.min(m.to, Math.max(m.from, u + Math.cos(ang) * 0.18)), ny = y + Math.sin(ang) * 0.18;
          x.lineWidth = leaf * 0.22;
          wrap(y, 1, (yy) => { x.beginPath(); x.moveTo(u, yy); x.lineTo(nu, yy + ny - y); x.stroke(); });
          if (k % 4 === 0) {
            const la = ang + (k % 8 === 0 ? 1 : -1) * 1.1;
            wrap(ny, 1, (yy) => { x.save(); x.translate(nu, yy); x.rotate(la); x.beginPath(); x.ellipse(leaf, 0, leaf, leaf * 0.4, 0, 0, Math.PI * 2); x.fill(); x.restore(); });
          }
          u = nu; y = ((ny % L) + L) % L;
        }
      }
      break;
    }
    case 'forest': {
      // trunks and crowns of spruce and pine against the paint above, standing on `from`
      x.fillStyle = x.strokeStyle = m.color;
      x.fillRect(m.from - 0.3, 0, 0.32, L);
      for (let y = 0; y < L; y += 0.35 + r() * 0.5) {
        const h = (m.to - m.from) * (0.45 + r() * 0.55), w = 0.25 + r() * 0.35;
        wrap(y, 1, (yy) => {
          x.beginPath(); x.moveTo(m.from, yy - w);
          for (let k = 1; k <= 6; k++) {
            const t = k / 6;
            x.lineTo(m.from + h * t, yy - w * (1 - t) * (k % 2 ? 1 : 0.6));
          }
          for (let k = 6; k >= 0; k--) {
            const t = k / 6;
            x.lineTo(m.from + h * t, yy + w * (1 - t) * (k % 2 ? 1 : 0.6));
          }
          x.closePath(); x.fill();
        });
      }
      break;
    }
    case 'stripes': {
      let i = 0;
      if (m.along) {
        for (let u = m.from; u < m.to; u += m.width + m.gap) { x.fillStyle = m.colors[i++ % m.colors.length]; x.fillRect(u, 0, Math.min(m.width, m.to - u), L); }
      } else {
        const n = Math.max(1, Math.round(L / (m.width + m.gap))), step = L / n;
        for (let k = 0; k < n; k++) { x.fillStyle = m.colors[i++ % m.colors.length]; x.fillRect(m.from, k * step, m.to - m.from, m.width); }
      }
      break;
    }
    case 'dabs': {
      for (let i = 0; i < m.count; i++) {
        x.fillStyle = m.colors[Math.floor(r() * m.colors.length)];
        const u = across(m.from, m.to), y = r() * L, s = m.size * (0.5 + r()), e = 0.5 + r() * 0.6, a = r() * 3;
        if (!m.hard) {
          const col = x.fillStyle as string, g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
          g.addColorStop(0, col); g.addColorStop(0.55, `${col}aa`); g.addColorStop(1, `${col}00`);
          x.fillStyle = g;
          wrap(y, s * 1.6, (yy) => { x.save(); x.translate(u, yy); x.rotate(a); x.scale(s * 1.6, s * 1.6 * e); x.beginPath(); x.arc(0, 0, 1, 0, Math.PI * 2); x.fill(); x.restore(); });
          continue;
        }
        wrap(y, s, (yy) => { x.beginPath(); x.ellipse(u, yy, s, s * e, a, 0, Math.PI * 2); x.fill(); });
      }
      break;
    }
    case 'people': {
      // standing on their feet towards the floor: the head furthest round
      for (let i = 0; i < m.count; i++) {
        const col = m.colors[Math.floor(r() * m.colors.length)], h = 0.9 + r() * 0.8;
        const u = across(m.from, Math.max(m.from, m.to - h)), y = r() * L, w = h * 0.22;
        wrap(y, 1, (yy) => {
          x.save(); x.translate(u, yy);
          x.fillStyle = x.strokeStyle = col; x.lineWidth = 0.05; x.lineJoin = 'round';
          x.beginPath();
          // legs, body (a dress or a coat), arms out a little, head
          x.moveTo(0, -w * 0.4); x.lineTo(h * 0.3, -w * 0.3); x.lineTo(h * 0.3, w * 0.3); x.lineTo(0, w * 0.4);
          x.moveTo(h * 0.25, -w); x.lineTo(h * 0.72, -w * 0.45); x.lineTo(h * 0.72, w * 0.45); x.lineTo(h * 0.25, w); x.closePath();
          if (m.outline) x.stroke(); else x.fill();
          x.beginPath(); x.moveTo(h * 0.68, -w * 0.4); x.lineTo(h * 0.42, -w * 1.25); x.moveTo(h * 0.68, w * 0.4); x.lineTo(h * 0.42, w * 1.25); x.stroke();
          x.beginPath(); x.ellipse(h * 0.85, 0, h * 0.12, h * 0.1, 0, 0, Math.PI * 2);
          if (m.outline) x.stroke(); else x.fill();
          x.restore();
        });
      }
      break;
    }
    case 'doodles': {
      x.strokeStyle = m.color; x.lineWidth = 0.05; x.lineCap = x.lineJoin = 'round';
      for (let i = 0; i < m.count; i++) {
        const u = across(m.from, m.to), y = r() * L, s = 0.4 + r() * 0.6, kind = Math.floor(r() * 4);
        wrap(y, 1.2, (yy) => {
          x.save(); x.translate(u, yy); x.beginPath();
          if (kind === 0) { // a house: walls, roof
            x.rect(0, -s / 2, s * 0.7, s); x.moveTo(s * 0.7, -s * 0.6); x.lineTo(s * 1.15, 0); x.lineTo(s * 0.7, s * 0.6);
            x.rect(0, -s * 0.12, s * 0.35, s * 0.24);
          } else if (kind === 1) { // a sun
            x.arc(0, 0, s * 0.3, 0, Math.PI * 2);
            for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; x.moveTo(Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4); x.lineTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6); }
          } else if (kind === 2) { // a flower
            x.moveTo(-s * 0.5, 0); x.lineTo(s * 0.4, 0);
            for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; x.moveTo(s * 0.4 + Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28); x.arc(s * 0.4 + Math.cos(a) * s * 0.18, Math.sin(a) * s * 0.18, s * 0.1, a, a + Math.PI * 2); }
          } else { // a bird
            x.moveTo(-s * 0.2, -s * 0.4); x.quadraticCurveTo(s * 0.15, -s * 0.2, 0, 0); x.quadraticCurveTo(s * 0.15, s * 0.2, -s * 0.2, s * 0.4);
          }
          x.stroke(); x.restore();
        });
      }
      break;
    }
    case 'panels': {
      for (let y = r() * m.every; y < L; y += m.every) {
        const d = m.to - m.from;
        x.fillStyle = m.frame; x.fillRect(m.from - 0.08, y - 0.08, d + 0.16, m.width + 0.16);
        x.fillStyle = m.color; x.fillRect(m.from, y, d, m.width);
        if (m.pattern === 'mosaic') {
          // little tesserae, each a shade off, and a band of runes winding round as a serpent
          for (let u = m.from; u < m.to - 0.01; u += 0.05) {
            for (let v = y; v < y + m.width - 0.01; v += 0.05) {
              x.fillStyle = `rgba(${r() < 0.5 ? '255,240,190' : '90,70,20'},${r() * 0.35})`;
              x.fillRect(u + 0.004, v + 0.004, 0.042, 0.042);
            }
          }
          x.strokeStyle = m.frame; x.lineWidth = 0.09;
          x.beginPath();
          for (let k = 0; k <= 40; k++) {
            const t = (k / 40) * Math.PI * 2;
            x.lineTo(m.from + d / 2 + Math.sin(t) * d * 0.36, y + m.width / 2 + Math.sin(t * 2) * m.width * 0.36);
          }
          x.stroke();
          x.lineWidth = 0.025;
          for (let k = 0; k < 14; k++) {
            const t = (k / 14) * Math.PI * 2, pu = m.from + d / 2 + Math.sin(t) * d * 0.36, pv = y + m.width / 2 + Math.sin(t * 2) * m.width * 0.36;
            x.beginPath(); x.moveTo(pu - 0.06, pv); x.lineTo(pu + 0.06, pv); x.moveTo(pu, pv); x.lineTo(pu + 0.04, pv + 0.04 * (k % 2 ? 1 : -1)); x.stroke();
          }
        } else if (m.pattern === 'harlequin') {
          const cols = ['#8ab83a', '#e08a2a', '#e8c840', '#3a6ab8', '#f2f0ea', '#2e6a3a'];
          for (let u = m.from; u < m.to; u += 0.12) {
            for (let v = y; v < y + m.width; v += 0.12) {
              x.fillStyle = cols[Math.floor(r() * cols.length)];
              x.beginPath(); x.moveTo(u + 0.06, v); x.lineTo(u + 0.12, v + 0.06); x.lineTo(u + 0.06, v + 0.12); x.lineTo(u, v + 0.06); x.closePath(); x.fill();
            }
          }
        } else if (m.pattern === 'mural') {
          // green ground below, blue sky above, the net of a goal, and people in grey and black
          x.fillStyle = '#4a8a3a'; x.fillRect(m.from, y, d * 0.3, m.width);
          x.fillStyle = '#6a9ad0'; x.fillRect(m.from + d * 0.75, y, d * 0.25, m.width);
          x.strokeStyle = 'rgba(40,70,140,0.7)'; x.lineWidth = 0.02;
          const g0 = y + m.width * 0.3, g1 = y + m.width * 0.6;
          for (let u = m.from + d * 0.3; u <= m.from + d * 0.7; u += 0.12) { x.beginPath(); x.moveTo(u, g0); x.lineTo(u, g1); x.stroke(); }
          for (let v = g0; v <= g1; v += 0.12) { x.beginPath(); x.moveTo(m.from + d * 0.3, v); x.lineTo(m.from + d * 0.7, v); x.stroke(); }
          for (let k = 0; k < 7; k++) {
            const pv = y + 0.4 + r() * (m.width - 0.8), h = d * (0.55 + r() * 0.2), w = h * 0.2, base = m.from + d * 0.18;
            x.fillStyle = ['#2a2a2a', '#7a7a78', '#e8e6e0', '#2a4a8a'][k % 4]; x.strokeStyle = '#111'; x.lineWidth = 0.035;
            x.beginPath(); x.moveTo(base, pv - w * 0.5); x.lineTo(base + h * 0.75, pv - w); x.lineTo(base + h * 0.75, pv + w); x.lineTo(base, pv + w * 0.5); x.closePath(); x.fill(); x.stroke();
            x.beginPath(); x.arc(base + h * 0.88, pv, h * 0.12, 0, Math.PI * 2); x.fill(); x.stroke();
          }
          x.strokeStyle = 'rgba(30,30,30,0.25)'; x.lineWidth = 0.01;
          for (let u = m.from; u < m.to; u += 0.15) { x.beginPath(); x.moveTo(u, y); x.lineTo(u, y + m.width); x.stroke(); }
          for (let v = y; v < y + m.width; v += 0.15) { x.beginPath(); x.moveTo(m.from, v); x.lineTo(m.to, v); x.stroke(); }
        } else if (m.pattern === 'ruled') {
          // ruled lines, a little writing, and bones and shells in relief
          x.strokeStyle = 'rgba(80,72,60,0.35)'; x.lineWidth = 0.012;
          for (let v = y + 0.1; v < y + m.width - 0.05; v += 0.12) { x.beginPath(); x.moveTo(m.from + 0.08, v); x.lineTo(m.to - 0.08, v); x.stroke(); }
          for (let k = 0; k < 5; k++) {
            const pu = m.from + 0.2 + r() * (d - 0.4), pv = y + 0.2 + r() * (m.width - 0.4), sz = 0.08 + r() * 0.12;
            x.fillStyle = '#d8d2c4'; x.strokeStyle = 'rgba(60,54,44,0.6)'; x.lineWidth = 0.015;
            x.beginPath();
            if (k % 2) x.ellipse(pu, pv, sz, sz * 0.8, 0, Math.PI, Math.PI * 2); else x.ellipse(pu, pv, sz * 1.6, sz * 0.3, r() * 3, 0, Math.PI * 2);
            x.fill(); x.stroke();
          }
        }
      }
      break;
    }
    case 'ribbon': {
      x.fillStyle = m.color;
      x.beginPath(); x.moveTo(m.at - m.width / 2, 0);
      const wv = m.wave ?? 0;
      for (let y = 0; y <= L; y += 0.25) x.lineTo(m.at - m.width / 2 + wv * Math.sin((y / L) * Math.PI * 8), y);
      for (let y = L; y >= 0; y -= 0.25) x.lineTo(m.at + m.width / 2 + wv * Math.sin((y / L) * Math.PI * 8), y);
      x.closePath(); x.fill();
      break;
    }
    case 'zigzag': {
      const n = Math.round(L / m.pitch), p = L / n;
      for (let k = 0; k < n; k++) {
        x.fillStyle = m.colors[k % m.colors.length];
        const y = k * p, up = k % 2 ? 1 : -1;
        x.beginPath();
        x.moveTo(m.at - (up * m.width) / 2 - m.width / 2, y); x.lineTo(m.at + (up * m.width) / 2 - m.width / 2, y + p);
        x.lineTo(m.at + (up * m.width) / 2 + m.width / 2, y + p); x.lineTo(m.at - (up * m.width) / 2 + m.width / 2, y);
        x.closePath(); x.fill();
      }
      break;
    }
    case 'drips': {
      x.lineWidth = m.width ?? 0.03; x.lineCap = 'round';
      for (let i = 0; i < m.count; i++) {
        x.strokeStyle = m.colors[Math.floor(r() * m.colors.length)];
        const y = r() * L, top = across(m.from + 0.5, m.to), pts: [number, number][] = [];
        for (let u = top; u > m.from; u -= 0.2) pts.push([u, (pts.length ? pts[pts.length - 1][1] : 0) + (r() - 0.5) * 0.12]);
        wrap(y, 1, (yy) => { x.beginPath(); pts.forEach(([u, dv], k) => (k ? x.lineTo(u, yy + dv) : x.moveTo(u, yy + dv))); x.stroke(); });
      }
      break;
    }
    case 'lilies': {
      for (let i = 0; i < m.count; i++) {
        const u = across(m.from, m.to), y = r() * L, w = 1 + r() * 1.5;
        const pads = [0, 1, 2, 3, 4, 5].map(() => [(r() - 0.5) * w, (r() - 0.5) * w * 1.4, 0.15 + r() * 0.12, r() * 6, r() < 0.3 ? (r() < 0.5 ? '#f0e8e0' : '#e8b8c0') : '']);
        wrap(y, w * 1.5, (yy) => {
          const g = x.createRadialGradient(u, yy, 0, u, yy, w);
          g.addColorStop(0, '#6a8ec8'); g.addColorStop(0.7, '#6a8ec8cc'); g.addColorStop(1, '#6a8ec800');
          x.fillStyle = g; x.fillRect(u - w, yy - w, 2 * w, 2 * w);
          for (const [du, dv, rad, a, flower] of pads as [number, number, number, number, string][]) {
            x.fillStyle = rad > 0.21 ? '#2f5a2a' : '#4a7a3a';
            x.beginPath(); x.moveTo(u + du, yy + dv); x.arc(u + du, yy + dv, rad, a, a + Math.PI * 1.8); x.closePath(); x.fill();
            if (flower) { x.fillStyle = flower; x.beginPath(); x.arc(u + du + rad * 0.3, yy + dv, 0.07, 0, Math.PI * 2); x.fill(); }
          }
        });
      }
      break;
    }
    case 'canopy': {
      // from the top of the texture (the crown) down to a scalloped edge wandering between `from`
      // and `to`
      // over the crown, all of it; lower down in clumps a few metres along, overlapping, hanging to
      // different depths
      x.fillStyle = m.color; x.fillRect(m.to + 1.2, 0, CAVE_ACROSS, L);
      for (let y0 = 0; y0 < L; ) {
        const len = 1.5 + r() * 2.5, deep = across(m.from, m.to), top = m.to + 1.4;
        const edge: [number, number][] = [];
        for (let y = y0; y < y0 + len; ) {
          const w = 0.2 + r() * 0.3, f = Math.sin(((y - y0) / len) * Math.PI);
          edge.push([top - (top - deep) * Math.sqrt(f) + (r() - 0.5) * 0.2, w]);
          y += w;
        }
        for (const [col, off] of [[m.shade, 0.12], [m.color, 0]] as const) {
          x.fillStyle = col;
          wrap(y0, len + 1, (yy) => {
            x.beginPath(); x.moveTo(CAVE_ACROSS + 1, yy);
            let y = yy;
            for (const [e, w] of edge) { x.lineTo(e - off + 0.1, y); x.quadraticCurveTo(e - off - 0.2, y + w / 2, e - off + 0.1, y + w); y += w; }
            x.lineTo(CAVE_ACROSS + 1, y); x.closePath(); x.fill();
          });
        }
        y0 += len * (0.55 + r() * 0.3);
      }
      break;
    }
    case 'windows': {
      for (let i = 0; i < m.count; i++) {
        const u = across(m.from, m.to), y = r() * L, s = m.size * (0.7 + r() * 0.6), a = r() * Math.PI, cl = [0, 1, 2].map(() => [(r() - 0.5) * s * 0.5, (r() - 0.5) * s * 0.5, s * (0.12 + r() * 0.1)]);
        wrap(y, s, (yy) => {
          x.save(); x.translate(u, yy); x.rotate(a);
          x.fillStyle = 'rgba(20,20,22,0.6)'; x.fillRect(-s / 2 + 0.05, -s / 2 + 0.05, s, s);
          x.fillStyle = m.color; x.fillRect(-s / 2, -s / 2, s, s);
          x.fillStyle = '#ffffff';
          for (const [cu, cv, cr] of cl) { x.beginPath(); x.arc(cu, cv, cr, 0, Math.PI * 2); x.arc(cu + cr, cv + cr * 0.3, cr * 0.8, 0, Math.PI * 2); x.fill(); }
          x.restore();
        });
      }
      break;
    }
    case 'frieze': {
      const d = m.to - m.from;
      x.fillStyle = '#2a3a8a'; x.fillRect(m.from, 0, d, L);
      // hills, then the town and the factory, then the march, in from the bottom
      x.fillStyle = '#2d5a3a';
      x.beginPath(); x.moveTo(m.from, 0);
      for (let y = 0; y <= L; y += 0.5) x.lineTo(m.from + d * (0.35 + 0.12 * Math.sin(y * 0.7) + 0.05 * Math.sin(y * 2.3)), y);
      x.lineTo(m.from, L); x.closePath(); x.fill();
      for (let y = 0.3; y < L; y += 1.1 + r()) {
        x.fillStyle = r() < 0.5 ? '#e8c84a' : '#d88aa0';
        const h = d * (0.15 + r() * 0.2); x.fillRect(m.from + d * 0.2, y, h, 0.6 + r() * 0.5);
        if (r() < 0.3) { x.fillStyle = '#1a1a1a'; x.fillRect(m.from + d * 0.2, y + 0.2, d * 0.62, 0.12); }
      }
      x.fillStyle = '#f2e6a8';
      x.beginPath(); x.arc(m.from + d * 0.82, L * 0.3, 0.18, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#2a3a8a';
      x.beginPath(); x.arc(m.from + d * 0.84, L * 0.3 + 0.06, 0.16, 0, Math.PI * 2); x.fill();
      for (let y = 0.2; y < L; y += 0.35 + r() * 0.25) {
        const h = d * (0.3 + r() * 0.08);
        x.fillStyle = '#141414';
        x.fillRect(m.from + d * 0.05, y - 0.06, h * 0.75, 0.12);
        x.beginPath(); x.arc(m.from + d * 0.05 + h * 0.85, y, 0.09, 0, Math.PI * 2); x.fill();
        if (r() < 0.25) {
          x.fillRect(m.from + d * 0.05 + h * 0.6, y + 0.1, h * 0.9, 0.025);
          x.fillStyle = '#d8302a'; x.fillRect(m.from + d * 0.05 + h * 1.2, y + 0.12, h * 0.3, 0.45);
        }
      }
      x.strokeStyle = '#111'; x.lineWidth = 0.06; x.strokeRect(m.from, -1, d, L + 2);
      break;
    }
    case 'writing': {
      x.lineWidth = 0.022; x.lineCap = 'round';
      for (let u = m.from; u < m.to; u += 0.11) {
        let y = r() * 0.5;
        while (y < L) {
          const w = 0.3 + r() * 1.4;
          x.strokeStyle = m.colors[Math.floor(r() * m.colors.length)];
          x.beginPath(); x.moveTo(u, y);
          for (let t = 0; t < w; t += 0.05) x.lineTo(u + (r() - 0.5) * 0.04, y + t);
          x.stroke();
          y += w + 0.15 + r() * 0.4;
        }
      }
      break;
    }
    case 'clouds': {
      x.fillStyle = m.color;
      for (let i = 0; i < m.count; i++) {
        const u = across(m.from, m.to), y = r() * L, s = 0.5 + r() * 0.9, du = [0, 1, 2, 3, 4].map(() => (r() - 0.5) * s * 0.6);
        wrap(y, 2.5, (yy) => {
          for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(u + du[k], yy + (k - 2) * s * 0.45, s * 0.45, s * 0.55, 0, 0, Math.PI * 2); x.fill(); }
        });
      }
      break;
    }
    case 'cracks': {
      x.lineCap = x.lineJoin = 'round';
      const crack = (u: number, y: number, ang: number, len: number, w: number, depth: number) => {
        const pts: [number, number][] = [[u, y]];
        for (let d = 0; d < len; d += 0.12) {
          ang += (r() - 0.5) * 0.7;
          u = Math.min(m.to, Math.max(m.from, u + Math.cos(ang) * 0.12)); y += Math.sin(ang) * 0.12;
          pts.push([u, y]);
          if (depth < 2 && r() < 0.025) crack(u, y, ang + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.8), len * (0.25 + r() * 0.35), w * 0.7, depth + 1);
        }
        const y0 = pts[0][1];
        wrap(((y0 % L) + L) % L, len + 1, (yy) => {
          x.lineWidth = w;
          x.beginPath(); pts.forEach(([pu, py], k) => (k ? x.lineTo(pu, py - y0 + yy) : x.moveTo(pu, yy))); x.stroke();
        });
      };
      for (let i = 0; i < m.count; i++) {
        x.strokeStyle = m.colors[Math.floor(r() * m.colors.length)];
        crack(across(m.from, m.to), r() * L, r() * Math.PI * 2, 1.5 + r() * 3.5, 0.035 + r() * 0.025, 0);
      }
      break;
    }
    case 'swirls': {
      x.lineCap = 'round';
      for (let i = 0; i < m.count; i++) {
        x.strokeStyle = m.colors[Math.floor(r() * m.colors.length)];
        let u = across(m.from, m.to), dv = 0, a = ((m.angle ?? 0) * Math.PI) / 180 + (r() - 0.5) * 0.8;
        const y = r() * L, n = Math.max(4, Math.round((m.length * (0.6 + r() * 0.8)) / 0.12));
        const w = m.width * (0.4 + r() * 0.6), turn = (r() - 0.5) * 0.12, ph = r() * 6, pts: [number, number][] = [[u, 0]];
        for (let k = 0; k < n; k++) {
          a += turn + Math.sin(k * 0.3 + ph) * 0.07;
          u = Math.min(m.to, Math.max(m.from, u + Math.sin(a) * 0.12)); dv += Math.cos(a) * 0.12;
          pts.push([u, dv]);
        }
        wrap(y, m.length * 1.5 + 1, (yy) => {
          for (let k = 1; k < pts.length; k++) {
            x.lineWidth = w * Math.sin((Math.PI * k) / pts.length) + 0.01;
            x.beginPath(); x.moveTo(pts[k - 1][0], yy + pts[k - 1][1]); x.lineTo(pts[k][0], yy + pts[k][1]); x.stroke();
          }
        });
      }
      break;
    }
  }
}

// ------------------------------------------------------------------ T-Centralen's platforms
// The track walls of T-Centralen's three platform halls (src/station.ts), drawn upright for a
// sweep along the track: u along it, TC_WALL.repeat m per repeat; v up the wall's profile from its
// foot in the trench (0), TC_WALL.height m to the top of its curve (1), the platform TC_WALL.floor
// m up it. The halls' end walls take the same, from the platform up.
export const TC_WALL = { height: 9, floor: 1.25, ppm: 100 };

// A wall canvas `len` m along, TC_WALL.height m up, and a helper from metres up the wall to pixels down it.
function tcCanvas(len: number): [HTMLCanvasElement, CanvasRenderingContext2D, (m: number) => number] {
  const { height, ppm } = TC_WALL;
  const [c, x] = canvas(Math.round(len * ppm), Math.round(height * ppm));
  return [c, x, (m) => (height - m) * ppm];
}

function tcTexture(c: HTMLCanvasElement) {
  const t = toTexture(c);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// The trench below the platform: grimy concrete, darker towards the ballast.
function tcTrench(x: CanvasRenderingContext2D, w: number, Y: (m: number) => number, top: number, seed: number) {
  x.fillStyle = '#5b5852';
  x.fillRect(0, Y(top), w, Y(0) - Y(top));
  speckle(x, w, Y(0), 3000, 0.25, seed);
  const g = x.createLinearGradient(0, Y(top), 0, Y(0));
  g.addColorStop(0, 'rgba(30,28,25,0.15)');
  g.addColorStop(1, 'rgba(20,18,16,0.75)');
  x.fillStyle = g;
  x.fillRect(0, Y(top), w, Y(0) - Y(top));
}

// Painted plaster from `from` m up the wall to its top: the vault over the tiles.
function tcPlaster(x: CanvasRenderingContext2D, w: number, Y: (m: number) => number, from: number, seed: number) {
  x.fillStyle = '#f2f1ec';
  x.fillRect(0, 0, w, Y(from));
  speckle(x, w, Y(from), 1500, 0.025, seed);
}

// A grid of glazed tiles `tw` × `th` m from `from` to `to` m up the wall, each coloured by `paint`
// (column, row, middle in metres along and up): a colour, which may vary tile by tile.
function tcTiles(
  x: CanvasRenderingContext2D, w: number, Y: (m: number) => number, from: number, to: number,
  tw: number, th: number, joint: string, paint: (i: number, j: number, u: number, m: number) => string,
) {
  const { ppm } = TC_WALL;
  x.fillStyle = joint;
  x.fillRect(0, Y(to), w, Y(from) - Y(to));
  const nx = Math.round(w / (tw * ppm)), ny = Math.floor((to - from) / th);
  const pw = w / nx, ph = th * ppm, gap = Math.max(1, ppm * 0.006);
  for (let j = 0; j < ny; j++) {
    const y = Y(from + (j + 1) * th);
    for (let i = 0; i < nx; i++) {
      x.fillStyle = paint(i, j, (i + 0.5) * tw, from + (j + 0.5) * th);
      x.fillRect(i * pw + gap, y + gap, pw - 2 * gap, ph - 2 * gap);
      // the glaze, catching the light along the top of each tile
      x.fillStyle = 'rgba(255,255,255,0.07)';
      x.fillRect(i * pw + gap, y + gap, pw - 2 * gap, ph * 0.3);
    }
  }
}

const TC_UPPER_REPEAT = 20.48;

// The upper red/green hall (tracks 1–2), its green line wall: white glazed tiles, 15 × 7.5 cm,
// with "Klaravagnen" (Anders Österlin and Signe Persson-Melin, 1957) along them: big signs and
// letters laid in ochre, gold, brown and black tiles, a few metres apart, a frieze 145 m long.
export function tcKlaravagnen() {
  const [c, x, Y] = tcCanvas(TC_UPPER_REPEAT);
  const w = c.width, { ppm, floor } = TC_WALL;
  const tilesFrom = floor + 0.1, tilesTo = floor + 3.3;
  tcPlaster(x, w, Y, tilesTo, 81);
  tcTrench(x, w, Y, tilesFrom, 82);
  // the figures, drawn as a mask first and then laid tile by tile
  const [mc, mx] = canvas(w, c.height);
  const r = rng(1957);
  const at = (u: number) => u * ppm, up = (m: number) => Y(floor + m);
  const ink = ['#c39433', '#d6ad48', '#8a6326', '#2b2723', '#b07a2a'];
  const shapes: ((u: number) => void)[] = [
    // a tall gold bar over a block of black and gold squares
    (u) => { mx.fillRect(at(u), up(2.9), at(0.45), up(1.0) - up(2.9)); mx.fillRect(at(u - 0.35), up(1.0), at(1.1), up(0.3) - up(1.0)); },
    // an arrow pointing up
    (u) => {
      mx.fillRect(at(u - 0.12), up(2.3), at(0.24), up(0.3) - up(2.3));
      mx.beginPath(); mx.moveTo(at(u - 0.6), up(2.2)); mx.lineTo(at(u), up(3.0)); mx.lineTo(at(u + 0.6), up(2.2)); mx.closePath(); mx.fill();
    },
    // an octagon, framed, with bars inside
    (u) => {
      mx.lineWidth = at(0.18);
      mx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k + 0.5) * Math.PI / 4;
        const px = at(u) + Math.cos(a) * at(0.42), py = up(1.85) + Math.sin(a) * at(0.85);
        if (k) mx.lineTo(px, py); else mx.moveTo(px, py);
      }
      mx.closePath(); mx.stroke();
      for (let k = -1; k <= 1; k++) mx.fillRect(at(u - 0.2), up(1.85) + k * at(0.28), at(0.4), at(0.1));
    },
    // letters, thinner, in dark tiles
    (u) => { mx.lineWidth = at(0.16); mx.beginPath(); mx.moveTo(at(u), up(0.6)); mx.lineTo(at(u), up(2.7)); mx.lineTo(at(u + 0.5), up(2.7)); mx.moveTo(at(u), up(1.8)); mx.lineTo(at(u + 0.35), up(1.8)); mx.stroke(); },
    (u) => { mx.lineWidth = at(0.16); mx.beginPath(); mx.moveTo(at(u - 0.4), up(2.7)); mx.lineTo(at(u), up(1.8)); mx.lineTo(at(u + 0.4), up(2.7)); mx.moveTo(at(u), up(1.8)); mx.lineTo(at(u), up(0.6)); mx.stroke(); },
    (u) => { mx.lineWidth = at(0.16); mx.beginPath(); mx.moveTo(at(u - 0.4), up(2.7)); mx.lineTo(at(u + 0.4), up(0.7)); mx.moveTo(at(u + 0.4), up(2.7)); mx.lineTo(at(u - 0.4), up(0.7)); mx.stroke(); },
    // a tall thin pair of bars with a patterned foot
    (u) => { mx.fillRect(at(u), up(2.8), at(0.24), up(0.9) - up(2.8)); mx.fillRect(at(u + 0.4), up(2.4), at(0.24), up(0.9) - up(2.4)); mx.fillRect(at(u - 0.1), up(0.9), at(0.65), up(0.4) - up(0.9)); },
  ];
  const colours: string[] = [];
  let u = 1.2, k = 0;
  while (u < TC_UPPER_REPEAT - 1.2) {
    const tone = k < 3 || k === 6 ? (k === 0 ? 1 : k % 2 ? 0 : 4) : 3;
    colours.push(ink[tone]);
    mx.fillStyle = mx.strokeStyle = `rgb(${colours.length},0,0)`;
    shapes[k % shapes.length](u);
    u += 2.2 + r() * 1.4; k++;
  }
  const mask = mx.getImageData(0, 0, w, c.height).data;
  const figure = (um: number, m: number) => {
    const px = Math.min(w - 1, Math.floor(um * ppm)), py = Math.min(c.height - 1, Math.floor(Y(m)));
    return mask[(py * w + px) * 4];
  };
  tcTiles(x, w, Y, tilesFrom, tilesTo, 0.15, 0.075, '#c9c7c0', (i, j, um, m) => {
    const f = figure(um, m);
    if (f) {
      const base = colours[f - 1];
      // the patterned blocks: black and gold squares mixed in at random
      return r() < 0.12 ? (base === ink[3] ? ink[0] : ink[3]) : base;
    }
    const v = 240 + Math.floor(r() * 10);
    return `rgb(${v},${v},${v - 3})`;
  });
  return tcTexture(c);
}

// The upper hall's red line wall: Erland Melanton's and Bengt Edenfalk's wall of glass prisms
// (1958), small glass blocks in grey joints, in long slanting fields of blue with gold streaks,
// of olive and moss green round a pale green lens, and of pale grey-green.
export function tcGlassPrisms() {
  const [c, x, Y] = tcCanvas(TC_UPPER_REPEAT);
  const w = c.width, { floor } = TC_WALL;
  const from = floor + 0.25, to = floor + 3.0;
  tcPlaster(x, w, Y, to + 0.1, 91);
  tcTrench(x, w, Y, from, 92);
  const r = rng(1958);
  const hex = (h: number, s: number, l: number) => `hsl(${h},${s}%,${l}%)`;
  tcTiles(x, w, Y, from, to, 0.12, 0.06, '#8d8d86', (_i, _j, um, m) => {
    const h = m - floor;
    // the fields slant: where along the wall a block is, taken at the platform's height
    const s = ((um - h * 0.9) % TC_UPPER_REPEAT + TC_UPPER_REPEAT) % TC_UPPER_REPEAT;
    const n = r();
    if (s < 7.5) {
      // blue, with gold streaks running down the slant
      if ((s * 1.7) % 1.3 < 0.12 + 0.06 * Math.sin(h * 3)) return hex(44 + n * 10, 65, 52 + n * 10);
      return hex(218 + n * 14, 45 + n * 20, 30 + n * 22);
    }
    if (s < 15) {
      // olive and moss, a pale green lens across it
      const lx = (s - 11.2) / 3.6, ly = (h - 1.5) / (0.9 * (1 - lx * lx) + 0.01);
      if (Math.abs(lx) < 1 && Math.abs(ly) < 1) return hex(85 + n * 20, 40 + n * 20, 50 + n * 15);
      return hex(60 + n * 25, 25 + n * 20, 28 + n * 18);
    }
    return hex(150 + n * 40, 8 + n * 10, 62 + n * 14);
  });
  // a sheen on the glass: soft vertical bands of light
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`;
    x.fillRect(r() * w, Y(to), 4 + r() * 18, Y(from) - Y(to));
  }
  return tcTexture(c);
}

// The plain white tiles of the upper hall's end walls.
export function tcUpperPlain() {
  const [c, x, Y] = tcCanvas(4.8);
  const { floor } = TC_WALL, r = rng(83);
  tcPlaster(x, c.width, Y, floor + 3.3, 84);
  tcTrench(x, c.width, Y, floor + 0.1, 85);
  tcTiles(x, c.width, Y, floor + 0.1, floor + 3.3, 0.15, 0.075, '#c9c7c0', () => {
    const v = 240 + Math.floor(r() * 10);
    return `rgb(${v},${v},${v - 3})`;
  });
  return tcTexture(c);
}

// The lower red/green hall (tracks 3–4): Oscar Brandtberg's patterns in square tiles, 15 cm, in
// bands of white, cream, beige and greys, some rows mixed.
export function tcBrandtberg() {
  const [c, x, Y] = tcCanvas(4.8);
  const { floor } = TC_WALL, r = rng(1957 + 34);
  const from = floor + 0.05, to = floor + 3.35;
  tcPlaster(x, c.width, Y, to, 86);
  tcTrench(x, c.width, Y, from, 87);
  const tones = ['#ecebe4', '#d9d6cc', '#c4c1b8', '#a7a49d', '#d8ccb0', '#bfb39a'];
  // the rows, bottom up: [main tone, second tone, share of the second]
  const rows: [number, number, number][] = [];
  for (let j = 0; j < 22; j++) {
    const kind = [0, 2, 0, 1, 4, 0, 3, 1, 0, 5, 2][j % 11];
    const mix = j % 4 === 1 ? 0.45 : j % 5 === 3 ? 0.2 : 0;
    rows.push([kind, kind ? 0 : 4, mix]);
  }
  tcTiles(x, c.width, Y, from, to, 0.15, 0.15, '#9b988f', (_i, j) => {
    const [a, b, mix] = rows[j % rows.length];
    return tones[r() < mix ? b : a];
  });
  return tcTexture(c);
}

// Leaves on a stem, as Per Olof Ultvedt painted them over T-Centralen's blue line hall (1975):
// a frond from (x0, y0) bending as it grows `len` px at angle `a`, its leaves in pairs, smaller
// towards the tip.
function frond(x: CanvasRenderingContext2D, x0: number, y0: number, a: number, len: number, leaf: number, bend: number, r: () => number) {
  const n = Math.max(4, Math.round(len / (leaf * 0.55)));
  let px = x0, py = y0, ang = a;
  const pts: [number, number, number][] = [];
  for (let k = 0; k <= n; k++) {
    pts.push([px, py, ang]);
    ang += bend / n;
    px += Math.cos(ang) * (len / n); py += Math.sin(ang) * (len / n);
  }
  x.lineCap = 'round';
  x.lineWidth = Math.max(2, leaf * 0.09);
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) x.lineTo(p[0], p[1]);
  x.stroke();
  const blade = (bx: number, by: number, ba: number, l: number) => {
    const wd = l * 0.28;
    x.save(); x.translate(bx, by); x.rotate(ba);
    x.beginPath(); x.moveTo(0, 0);
    x.quadraticCurveTo(l * 0.45, -wd, l, 0);
    x.quadraticCurveTo(l * 0.45, wd, 0, 0);
    x.fill(); x.restore();
  };
  for (let k = 1; k < pts.length; k++) {
    const [bx, by, ba] = pts[k];
    const l = leaf * (1 - (k / pts.length) * 0.55) * (0.85 + r() * 0.3);
    blade(bx, by, ba - 0.75, l);
    blade(bx, by, ba + 0.75, l);
  }
  const [tx, ty, ta] = pts[pts.length - 1];
  blade(tx, ty, ta, leaf * 0.6);
}

// Rocky shading: soft blotches of `rgb`, wrapping across the canvas's sides.
function rockShade(x: CanvasRenderingContext2D, w: number, h: number, n: number, rgb: string, alpha: number, size: number, r: () => number, y0 = 0) {
  for (let i = 0; i < n; i++) {
    const cx = r() * w, cy = y0 + r() * (h - y0), rad = size * (0.3 + r());
    for (const dx of [-w, 0, w]) {
      const g = x.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, rad);
      g.addColorStop(0, `rgba(${rgb},${alpha * (0.4 + r() * 0.6)})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g;
      x.fillRect(cx + dx - rad, cy - rad, rad * 2, rad * 2);
    }
  }
}

const TC_BLUE = '#2b40ad', TC_BLUE_DARK = '#1e2f8a', TC_BLUE_LEAF = '#3f60c8', TC_ROCK = '#e9e9e4';
const TC_CAVE_REPEAT = 16;

// The blue line hall's painted rock walls: ultramarine from the trench to a ragged line a few
// metres over the platform, with darker leaves in it, and white above, with blue fronds climbing
// from the blue and reaching over into the vault.
export function tcCaveWall() {
  const [c, x, Y] = tcCanvas(TC_CAVE_REPEAT);
  const w = c.width, { ppm, floor } = TC_WALL, r = rng(1975);
  x.fillStyle = TC_ROCK;
  x.fillRect(0, 0, w, c.height);
  rockShade(x, w, c.height, 220, '150,155,165', 0.22, 60, r);
  // the line between blue and white, ragged like the rock: metres up the wall at u
  const waves = [1, 2, 3, 5, 8, 13, 21, 34].map((f) => [f, r() * Math.PI * 2, (0.12 + r() * 0.25) * Math.min(1, 3 / f)]);
  const edge = (u: number) => floor + 3.6 + waves.reduce((s, [f, ph, amp]) => s + amp * Math.sin((u / TC_CAVE_REPEAT) * Math.PI * 2 * f + ph), 0);
  x.fillStyle = TC_BLUE;
  x.beginPath(); x.moveTo(0, c.height);
  for (let px = 0; px <= w; px += 4) x.lineTo(px, Y(edge(px / ppm)) + (r() - 0.5) * 6);
  x.lineTo(w, c.height); x.closePath(); x.fill();
  x.save(); x.clip();
  rockShade(x, w, c.height, 160, '20,30,90', 0.35, 50, r);
  rockShade(x, w, c.height, 80, '90,110,210', 0.18, 40, r);
  // darker leaves in the blue
  x.fillStyle = x.strokeStyle = TC_BLUE_DARK;
  for (let i = 0; i < 26; i++) {
    const u0 = r() * w;
    for (const dx of [-w, 0, w]) frond(x, u0 + dx, Y(floor - 0.6), -Math.PI / 2 + (r() - 0.5) * 0.9, (1.8 + r() * 2) * ppm, 0.38 * ppm, (r() - 0.5) * 1.4, rng(i + 7));
  }
  x.restore();
  // the trench: grime over the blue
  const g = x.createLinearGradient(0, Y(floor), 0, Y(0));
  g.addColorStop(0, 'rgba(15,18,30,0.2)');
  g.addColorStop(1, 'rgba(15,15,20,0.8)');
  x.fillStyle = g;
  x.fillRect(0, Y(floor), w, Y(0) - Y(floor));
  // fronds climbing out of the blue into the white
  x.fillStyle = x.strokeStyle = TC_BLUE_LEAF;
  for (let i = 0; i < 14; i++) {
    const u0 = ((i + r() * 0.6) / 14) * TC_CAVE_REPEAT;
    const len = (2.4 + r() * 2.2) * ppm, leaf = (0.42 + r() * 0.2) * ppm;
    for (const dx of [-w, 0, w]) frond(x, u0 * ppm + dx, Y(edge(u0) - 0.3), -Math.PI / 2 + (r() - 0.5) * 1.2, len, leaf, (r() - 0.5) * 1.6, rng(100 + i));
  }
  return tcTexture(c);
}

// The vault over the blue line hall: white rock with blue fronds across it, 8 m per repeat.
export function tcCaveVault() {
  const S = 1024, [c, x] = canvas(S), r = rng(1976), ppm = S / 8;
  x.fillStyle = TC_ROCK;
  x.fillRect(0, 0, S, S);
  rockShade(x, S, S, 160, '140,145,158', 0.25, 70, r);
  x.fillStyle = x.strokeStyle = TC_BLUE_LEAF;
  for (let i = 0; i < 10; i++) {
    const x0 = r() * S, y0 = r() * S, a = r() * Math.PI * 2, len = (2 + r() * 2) * ppm, leaf = (0.4 + r() * 0.2) * ppm;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) frond(x, x0 + dx, y0 + dy, a, len, leaf, (r() - 0.5) * 1.4, rng(200 + i));
  }
  return toTexture(c);
}

// Platform floors, 2 × 2 m per repeat. Upper red/green and blue line: polished stone slabs,
// 1.0 × 0.5 m, `tone` the stone; lower red/green: small square tiles, 10 cm, cream in grey joints.
export function tcStoneFloor(tone: number, seed: number) {
  const [c, x] = canvas(512);
  const r = rng(seed);
  x.fillStyle = `rgb(${tone - 30},${tone - 30},${tone - 28})`;
  x.fillRect(0, 0, 512, 512);
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 2; i++) {
      const v = tone + Math.floor((r() - 0.5) * 10);
      x.fillStyle = `rgb(${v},${v},${v + 2})`;
      x.fillRect(i * 256 + (j % 2) * 128 + 1, j * 128 + 1, 254, 126);
      if ((j % 2) && i === 1) x.fillRect(1 - 128, j * 128 + 1, 254, 126);
    }
  }
  speckle(x, 512, 512, 14000, 0.3, seed + 1);
  speckle(x, 512, 512, 6000, 0.2, seed + 2, true);
  return toTexture(c);
}

export function tcMosaicFloor() {
  const [c, x] = canvas(1000);
  x.fillStyle = '#8f8c86';
  x.fillRect(0, 0, 1000, 1000);
  const r = rng(34);
  for (let j = 0; j < 20; j++) {
    for (let i = 0; i < 20; i++) {
      const v = 228 + Math.floor(r() * 16);
      x.fillStyle = `rgb(${v},${v - 2},${v - 8})`;
      x.fillRect(i * 50 + 2.5, j * 50 + 2.5, 45, 45);
    }
  }
  speckle(x, 1000, 1000, 6000, 0.08, 35);
  return toTexture(c);
}

// The light stone band along a platform's edge, and the tactile strip inside it: u along, v across.
export function tcEdgeBand() {
  const [c, x] = canvas(256, 64);
  x.fillStyle = '#e9e8e2'; x.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(120,120,115,0.6)'; x.fillRect(i * 64, 0, 2, 64); }
  speckle(x, 256, 64, 800, 0.08, 37);
  return toTexture(c);
}
export function tcTactile() {
  const [c, x] = canvas(64, 32);
  x.fillStyle = '#45474b'; x.fillRect(0, 0, 64, 32);
  x.fillStyle = '#b89a52';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { x.beginPath(); x.arc(8 + i * 16, 8 + j * 16, 3.2, 0, Math.PI * 2); x.fill(); }
  return toTexture(c);
}

// The station's name on an enamel plate on the track walls: dark capitals on white, or white on black.
export function tcPlate(text: string, dark = false) {
  const [c, x] = canvas(512, 88);
  x.fillStyle = dark ? '#1c1c1e' : '#111'; x.fillRect(0, 0, 512, 88);
  x.fillStyle = dark ? '#1c1c1e' : '#f3f2ec'; x.fillRect(5, 5, 502, 78);
  x.fillStyle = dark ? '#f3f2ec' : '#141414';
  x.font = '600 50px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '5px';
  x.fillText(text.toUpperCase(), 256, 47, 470);
  return toTexture(c, { repeat: false });
}

// Karlaplan (1967): the track walls clad in white enamelled steel panels, 1.2 m wide, over a black
// plinth; on one panel in every repeat (KARLAPLAN_REPEAT m) the station's name in small black
// capitals. One repeat is drawn as seen, across and then up from the foot of the wall, `height` m
// up; the panels from `panelsFrom`, the name centred `nameAt` high. With `frieze` ([from, to]),
// a band left for the photomontage, edged in black.
export const KARLAPLAN_REPEAT = 14.4;
function karlaplanWallCanvas(height: number, panelsFrom: number, nameAt: number, frieze: [number, number] | null, mirror: boolean) {
  const PX = 64, W = Math.round(KARLAPLAN_REPEAT * PX), H = Math.round(height * PX);
  const [c, x] = canvas(W, H);
  const y = (h: number) => H - h * PX;
  x.fillStyle = '#b9bbbd';
  x.fillRect(0, 0, W, H);
  // the plinth, dusty towards the track bed, with a steel trim along its top
  x.fillStyle = '#1b1c1e';
  x.fillRect(0, y(panelsFrom), W, H - y(panelsFrom));
  speckle(x, W, H, 2500, 0.15, 67, true);
  x.fillStyle = '#1b1c1e';
  const dust = x.createLinearGradient(0, y(panelsFrom), 0, H);
  dust.addColorStop(0, 'rgba(70,62,52,0)');
  dust.addColorStop(1, 'rgba(70,62,52,0.55)');
  x.fillStyle = dust;
  x.fillRect(0, y(panelsFrom), W, H - y(panelsFrom));
  x.fillStyle = '#9a9c9e';
  x.fillRect(0, y(panelsFrom) - 3, W, 4);
  // the panels: white enamel, a little sheen at the top of each, in rows between grey joints
  const r = rng(1967);
  const rows: [number, number][] = [];
  const band = (a: number, b: number) => {
    const n = Math.max(1, Math.round((b - a) / 0.6));
    for (let k = 0; k < n; k++) rows.push([a + ((b - a) * k) / n, a + ((b - a) * (k + 1)) / n]);
  };
  if (frieze) { band(panelsFrom, frieze[0]); band(frieze[1], height); } else band(panelsFrom, height);
  for (const [a, b] of rows) {
    for (let i = 0; i < KARLAPLAN_REPEAT / 1.2; i++) {
      const v = 238 + Math.floor(r() * 10);
      x.fillStyle = `rgb(${v},${v},${v - 3})`;
      x.fillRect(i * 1.2 * PX + 2, y(b) + 2, 1.2 * PX - 4, (b - a) * PX - 4);
      const g = x.createLinearGradient(0, y(b), 0, y(a));
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(120,120,115,0.08)');
      x.fillStyle = g;
      x.fillRect(i * 1.2 * PX + 2, y(b) + 2, 1.2 * PX - 4, (b - a) * PX - 4);
    }
  }
  // a broader grey joint along the top of the panels under the name
  x.fillStyle = '#8f9194';
  x.fillRect(0, y(nameAt - 0.3) - 3, W, 6);
  if (frieze) {
    x.fillStyle = '#0d0d0d';
    x.fillRect(0, y(frieze[1]) - 4, W, (frieze[1] - frieze[0]) * PX + 8);
  }
  // the name, on the panel in the middle of the repeat
  x.save();
  x.translate(W / 2, y(nameAt));
  if (mirror) x.scale(-1, 1);
  x.fillStyle = '#16171a';
  x.font = `600 ${Math.round(0.16 * PX)}px "Helvetica Neue", Arial, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(0.025 * PX)}px`;
  x.fillText('KARLAPLAN', 0, 0);
  x.restore();
  return c;
}

// Karlaplan's track walls, turned for a sweep along the track as Hötorget's are: u up the wall
// from its foot (0) to the spring of the vault (1), v along the track, KARLAPLAN_REPEAT m per
// repeat; `mirror` for the wall that sees the track's direction the other way round.
export function karlaplanWall(height: number, panelsFrom: number, nameAt: number, frieze: [number, number] | null, mirror = false) {
  const src = karlaplanWallCanvas(height, panelsFrom, nameAt, frieze, mirror);
  const [c, x] = canvas(src.height, src.width);
  x.setTransform(0, 1, -1, 0, src.height, 0);
  x.drawImage(src, 0, 0);
  return toTexture(c);
}

// Gärdet (1967): the track walls clad in white enamelled panels (2006), 1.2 m wide in rows `row`
// high, from `panelsFrom` over a black plinth, with a grey strip along them `strip` high; along
// them a row of pictures in white mounts (`art`: from, to, wide, apart), which are changed from
// time to time: redrawn here as motifs of our own (an eye, a figure by the sea, a net of lines,
// stripes, a red square, an island, a sheet of script). One repeat is GARDET_REPEAT m, drawn as
// seen from the foot of the wall (`floor`) up to `top`. With `tiles`, small square tiles of that
// size and colour in place of the panels, over a strip of brushed steel, and the pictures in thin
// black frames with no mounts (Zinkensdamm's). With `bricks`, Berndt Helleberg's red bricks and
// his black band with its figures, the name among them (Hornstull's, `hellebergWall`), and no pictures.
// With `kransen`, Midsommarkransen's narrow cream tiles on end (`kransenTiles`), a dark blue band
// from `band[0]` to `band[1]` with the name on it in white capitals four times a repeat, a thin
// red stripe at `red` and a dark blue-grey one at `low`, and no pictures (photographs, 2005–2016).
export const GARDET_REPEAT = 20.8;
// With `thelander`, the tiles over a black plinth and under a white ledge at the top, and in place
// of the pictures, P G Thelander's enamelled reliefs (1987), `art[3]` apart (`thelanderRelief`).
export interface GardetTrackWall { panelsFrom: number; row: number; strip: number; art: [number, number, number, number]; tiles?: { size: number; color: string }; bricks?: { name: string }; kransen?: { name: string; band: [number, number]; red: number; low: number }; thelander?: boolean }
function gardetWallCanvas(floor: number, top: number, f: GardetTrackWall) {
  const PX = 96, W = Math.round(GARDET_REPEAT * PX), H = Math.round((top - floor) * PX);
  const [c, x] = canvas(W, H);
  const y = (h: number) => H - (h - floor) * PX;
  const r = rng(2006);
  // the plinth, dusty towards the track bed
  x.fillStyle = '#18191b'; x.fillRect(0, 0, W, H);
  speckle(x, W, H, 2500, 0.12, 2007, true);
  const dust = x.createLinearGradient(0, y(f.panelsFrom), 0, H);
  dust.addColorStop(0, 'rgba(70,62,52,0)'); dust.addColorStop(1, 'rgba(70,62,52,0.5)');
  x.fillStyle = dust; x.fillRect(0, y(f.panelsFrom), W, H - y(f.panelsFrom));
  if (f.bricks) {
    hellebergWall(x, W, H, y, f.panelsFrom, top, f.bricks.name, PX, r);
    x.fillStyle = dust; x.fillRect(0, y(f.panelsFrom), W, H - y(f.panelsFrom));
    return c;
  }
  if (f.kransen) {
    const k = f.kransen;
    kransenTiles(x, 0, 0, W, y(f.panelsFrom), PX, r);
    // (the grime of the trains on the tiles' lowest rows)
    const grime = x.createLinearGradient(0, y(f.panelsFrom + 0.8), 0, y(f.panelsFrom));
    grime.addColorStop(0, 'rgba(60,54,44,0)'); grime.addColorStop(1, 'rgba(60,54,44,0.45)');
    x.fillStyle = grime; x.fillRect(0, y(f.panelsFrom + 0.8), W, 0.8 * PX);
    const stripe = (at: number, hh: number, col: string) => { x.fillStyle = col; x.fillRect(0, y(at + hh), W, hh * PX); };
    stripe(k.low, 0.05, '#2f3546');
    stripe(k.red, 0.05, '#9a2b24');
    stripe(k.band[0], k.band[1] - k.band[0], '#1f2f5c');
    x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, y(k.band[1]), W, 1.5);
    const bh = (k.band[1] - k.band[0]) * PX;
    x.fillStyle = '#f2f2ee'; x.font = `600 ${Math.round(bh * 0.62)}px "Helvetica Neue", Arial, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) x.fillText(k.name.toUpperCase(), (i + 0.5) * (W / 4), y(k.band[0]) - bh / 2 + 1);
    return c;
  }
  if (f.tiles) {
    // the tiles, each a shade off its neighbours, in grey joints, over the steel strip
    const t = f.tiles.size * PX, c0 = parseInt(f.tiles.color.slice(1), 16), cr = c0 >> 16, cg = (c0 >> 8) & 255, cb = c0 & 255;
    x.fillStyle = '#5f6362'; x.fillRect(0, 0, W, y(f.panelsFrom));
    for (let j = 0; y(f.panelsFrom) - j * t > -t; j++) {
      for (let i = 0; i * t < W; i++) {
        const v = Math.floor(r() * 14) - 7;
        x.fillStyle = `rgb(${cr + v},${cg + v},${cb + v})`;
        x.fillRect(i * t + 1, y(f.panelsFrom) - (j + 1) * t + 1, t - 2, t - 2);
        x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(i * t + 1, y(f.panelsFrom) - (j + 1) * t + 1, t - 2, t * 0.3);
      }
    }
    if (f.thelander) {
      // (the white ledge along the top, and the grime of the trains on the lowest rows)
      x.fillStyle = '#e8e8e4'; x.fillRect(0, 0, W, 0.06 * PX);
      x.fillStyle = 'rgba(80,80,76,0.35)'; x.fillRect(0, 0.06 * PX, W, 2);
      const grime = x.createLinearGradient(0, y(f.panelsFrom + 0.6), 0, y(f.panelsFrom));
      grime.addColorStop(0, 'rgba(60,56,50,0)'); grime.addColorStop(1, 'rgba(60,56,50,0.35)');
      x.fillStyle = grime; x.fillRect(0, y(f.panelsFrom + 0.6), W, 0.6 * PX);
      const [from, to, , apart] = f.art, count = Math.round(GARDET_REPEAT / apart);
      for (let i = 0; i < count; i++) thelanderRelief(x, (i + 0.5) * (GARDET_REPEAT / count) * PX, y(to), (to - from) * PX, i, PX);
      return c;
    }
    const sy = y(f.panelsFrom), sh = 0.12 * PX;
    x.fillStyle = '#b4b8ba'; x.fillRect(0, sy, W, sh);
    x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(0, sy, W, 2);
    x.fillStyle = 'rgba(40,40,40,0.4)'; x.fillRect(0, sy + sh - 2, W, 2);
  }
  // the panels, in rows between grey joints, a little sheen at the top of each
  else x.fillStyle = '#a9abad', x.fillRect(0, 0, W, y(f.panelsFrom));
  const n = f.tiles ? 0 : Math.max(1, Math.round((top - f.panelsFrom) / f.row));
  for (let k = 0; k < n; k++) {
    const a = f.panelsFrom + ((top - f.panelsFrom) * k) / n, b = f.panelsFrom + ((top - f.panelsFrom) * (k + 1)) / n;
    for (let i = 0; i < GARDET_REPEAT / 1.2; i++) {
      const v = 236 + Math.floor(r() * 10);
      x.fillStyle = `rgb(${v},${v},${v - 2})`;
      x.fillRect(i * 1.2 * PX + 2, y(b) + 2, 1.2 * PX - 4, (b - a) * PX - 4);
      const g = x.createLinearGradient(0, y(b), 0, y(a));
      g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,120,115,0.08)');
      x.fillStyle = g; x.fillRect(i * 1.2 * PX + 2, y(b) + 2, 1.2 * PX - 4, (b - a) * PX - 4);
    }
  }
  if (!f.tiles) x.fillStyle = '#8e9194', x.fillRect(0, y(f.strip + 0.05), W, 0.1 * PX);
  // the pictures
  const [from, to, wide, apart] = f.art, count = Math.round(GARDET_REPEAT / apart);
  for (let i = 0; i < count; i++) {
    const cx = (i + 0.5) * (GARDET_REPEAT / count) * PX, pw = wide * PX, ph = (to - from) * PX, px = cx - pw / 2, py = y(to);
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(px + 3, py + 4, pw, ph);
    x.fillStyle = f.tiles ? '#1d1e20' : '#9a9c9e'; x.fillRect(px - 1, py - 1, pw + 2, ph + 2);
    x.fillStyle = '#f6f6f3'; x.fillRect(px, py, pw, ph);
    const m = pw * (f.tiles ? 0.03 : 0.07), ix = px + m, iy = py + m, iw = pw - 2 * m, ih = ph - 2 * m - (f.tiles ? 0 : pw * 0.05);
    x.save(); x.beginPath(); x.rect(ix, iy, iw, ih); x.clip();
    picture(x, ix, iy, iw, ih, i % 8, r);
    x.restore();
    // a caption under it
    if (!f.tiles) x.fillStyle = 'rgba(60,60,60,0.5)', x.fillRect(cx - iw * 0.15, iy + ih + pw * 0.02, iw * 0.3, 2);
  }
  return c;
}
// P G Thelander's reliefs on Aspudden's track walls (1987): flat shapes of enamelled sheet in
// glossy yellow, ultramarine, red and green, cut out and fixed a little proud of the tiles, a few
// metres apart along both walls (sv.wikipedia; photographs, 2014–2024). Shapes of our own in his
// manner, not copies: by `kind`, a broad arc of four yellow segments rising into a blue
// rectangle and on into a yellow arc of two (as on the photographed panel); a blue band bending
// into a yellow foot; a red hook beside a green sliver; and two yellow blades either side of a blue
// bar. Centred on cx, its top at `top`, `hh` high (canvas px).
function thelanderRelief(x: CanvasRenderingContext2D, cx: number, top: number, hh: number, kind: number, PX: number) {
  const Y = '#e8c81e', B = '#2f2fa8', R = '#c4241e', G = '#2e6a3a';
  const shade = (col: string, path: () => void) => {
    // (its shadow on the tiles, the enamel, and the gloss along its upper edge)
    x.save(); x.translate(4, 5); x.fillStyle = 'rgba(0,0,0,0.22)'; path(); x.fill(); x.restore();
    x.fillStyle = col; path(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1.5; path(); x.stroke();
    x.save(); path(); x.clip();
    const g = x.createLinearGradient(0, top, 0, top + hh);
    g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
    x.fillStyle = g; x.fillRect(cx - 3 * PX, top - PX, 6 * PX, hh + 2 * PX); x.restore();
  };
  const u = hh / 2;
  const ring = (ox: number, oy: number, r0: number, r1: number, a0: number, a1: number) => () => {
    x.beginPath(); x.arc(ox, oy, r1, a0, a1); x.arc(ox, oy, r0, a1, a0, true); x.closePath();
  };
  const segs = (ox: number, oy: number, r0: number, r1: number, a0: number, a1: number, n: number, col: string) => {
    for (let k = 0; k < n; k++) shade(col, ring(ox, oy, r0, r1, a0 + ((a1 - a0) * k) / n, a0 + ((a1 - a0) * (k + 1)) / n));
  };
  if (kind % 4 === 0) {
    // the lower arc, the blue rectangle at its top, and the upper arc going on from it
    segs(cx - 0.35 * u, top + 0.75 * u, 0.55 * u, 1.2 * u, Math.PI * 0.1, Math.PI * 0.92, 4, Y);
    shade(B, () => { x.beginPath(); x.rect(cx - 0.35 * u, top + 0.35 * u, 1.05 * u, 0.55 * u); });
    segs(cx + 0.7 * u, top - 0.15 * u, 0.5 * u, 1.05 * u, Math.PI * 0.08, Math.PI * 0.5, 2, Y);
  } else if (kind % 4 === 1) {
    // a blue band coming down, bending into a yellow foot
    shade(B, () => { x.beginPath(); x.moveTo(cx - 0.35 * u, top); x.lineTo(cx - 0.05 * u, top); x.lineTo(cx + 0.05 * u, top + 1.05 * u); x.lineTo(cx - 0.25 * u, top + 1.1 * u); x.closePath(); });
    shade(Y, () => {
      x.beginPath(); x.moveTo(cx - 0.25 * u, top + 1.1 * u); x.lineTo(cx + 0.05 * u, top + 1.05 * u);
      x.quadraticCurveTo(cx + 0.15 * u, top + 1.7 * u, cx + 0.45 * u, top + 1.85 * u); x.lineTo(cx + 0.3 * u, top + 2 * u);
      x.quadraticCurveTo(cx - 0.2 * u, top + 1.75 * u, cx - 0.25 * u, top + 1.1 * u); x.closePath();
    });
  } else if (kind % 4 === 2) {
    // a red hook, and a green sliver beside it
    shade(R, () => {
      x.beginPath(); x.moveTo(cx - 0.05 * u, top + 0.2 * u); x.lineTo(cx + 0.2 * u, top + 0.15 * u); x.lineTo(cx + 0.22 * u, top + 1.3 * u);
      x.quadraticCurveTo(cx + 0.1 * u, top + 1.9 * u, cx - 0.45 * u, top + 1.75 * u); x.quadraticCurveTo(cx - 0.6 * u, top + 1.5 * u, cx - 0.35 * u, top + 1.3 * u);
      x.quadraticCurveTo(cx - 0.05 * u, top + 1.45 * u, cx - 0.05 * u, top + 1.1 * u); x.closePath();
    });
    shade(G, () => { x.beginPath(); x.moveTo(cx + 0.32 * u, top + 0.05 * u); x.quadraticCurveTo(cx + 0.5 * u, top + 0.6 * u, cx + 0.36 * u, top + 1.1 * u); x.lineTo(cx + 0.3 * u, top + 1.05 * u); x.quadraticCurveTo(cx + 0.4 * u, top + 0.6 * u, cx + 0.27 * u, top + 0.1 * u); x.closePath(); });
  } else {
    // two yellow blades either side of a blue bar
    shade(B, () => { x.beginPath(); x.rect(cx - 0.08 * u, top + 0.1 * u, 0.16 * u, 1.75 * u); });
    for (const d of [-1, 1]) shade(Y, () => { x.beginPath(); x.moveTo(cx + d * 0.18 * u, top + 0.3 * u); x.quadraticCurveTo(cx + d * 0.55 * u, top + 0.9 * u, cx + d * 0.22 * u, top + 1.7 * u); x.quadraticCurveTo(cx + d * 0.3 * u, top + 0.9 * u, cx + d * 0.18 * u, top + 0.3 * u); x.closePath(); });
  }
}
function picture(x: CanvasRenderingContext2D, ix: number, iy: number, iw: number, ih: number, kind: number, r: () => number) {
  const disc = (cx: number, cy: number, rad: number, stops: [number, string][]) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    for (const [t, col] of stops) g.addColorStop(t, col);
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.fill();
  };
  if (kind === 0) {
    // a net of pale lines over deep blue, two pale lobes in its middle
    x.fillStyle = '#1d3d73'; x.fillRect(ix, iy, iw, ih);
    x.strokeStyle = 'rgba(225,235,250,0.7)'; x.lineWidth = 1;
    for (let k = 0; k < 40; k++) {
      let px = ix + r() * iw, py = iy + r() * ih, a = r() * Math.PI * 2;
      x.beginPath(); x.moveTo(px, py);
      for (let j = 0; j < 12; j++) { a += (r() - 0.5) * 1.2; px += Math.cos(a) * iw * 0.05; py += Math.sin(a) * iw * 0.05; x.lineTo(px, py); }
      x.stroke();
    }
    for (const d of [-1, 1]) disc(ix + iw / 2 + d * iw * 0.15, iy + ih * 0.45, iw * 0.17, [[0, '#f0e2c4'], [0.7, '#d8c08e'], [1, 'rgba(216,192,142,0)']]);
  } else if (kind === 1 || kind === 6) {
    // an eye's iris, filling the picture
    x.fillStyle = '#f4f2ec'; x.fillRect(ix, iy, iw, ih);
    const cx = ix + iw / 2, cy = iy + ih / 2, rad = Math.min(iw, ih) * 0.42;
    const [a, b] = kind === 1 ? ['#c9a24a', '#6e5a24'] : ['#a8c46a', '#3e6a3a'];
    disc(cx, cy, rad, [[0, '#2a1d10'], [0.28, '#3a2a14'], [0.32, a], [0.85, b], [1, '#2d2a1e']]);
    x.strokeStyle = 'rgba(40,30,10,0.35)'; x.lineWidth = 1;
    for (let k = 0; k < 90; k++) {
      const t = (k / 90) * Math.PI * 2;
      x.beginPath(); x.moveTo(cx + Math.cos(t) * rad * 0.32, cy + Math.sin(t) * rad * 0.32); x.lineTo(cx + Math.cos(t) * rad * 0.95, cy + Math.sin(t) * rad * 0.95); x.stroke();
    }
    disc(cx, cy, rad * 0.26, [[0, '#050505'], [0.9, '#0c0c0c'], [1, 'rgba(12,12,12,0)']]);
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.beginPath(); x.arc(cx - rad * 0.18, cy - rad * 0.2, rad * 0.06, 0, Math.PI * 2); x.fill();
  } else if (kind === 2) {
    // a figure by the sea, under a pale sky
    const sky = x.createLinearGradient(0, iy, 0, iy + ih);
    sky.addColorStop(0, '#5f8fc4'); sky.addColorStop(0.65, '#cfdde8'); sky.addColorStop(0.66, '#2f5f8f'); sky.addColorStop(1, '#244b72');
    x.fillStyle = sky; x.fillRect(ix, iy, iw, ih);
    x.fillStyle = '#c9b49a'; x.beginPath(); x.ellipse(ix + iw * 0.55, iy + ih * 0.66, iw * 0.1, ih * 0.09, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#8a8f96'; x.beginPath(); x.moveTo(ix + iw * 0.3, iy + ih); x.quadraticCurveTo(ix + iw * 0.55, iy + ih * 0.7, ix + iw * 0.8, iy + ih); x.fill();
  } else if (kind === 3) {
    // ochre, crossed by black lines that wander and black blocks
    x.fillStyle = '#c99a3c'; x.fillRect(ix, iy, iw, ih);
    x.strokeStyle = '#1a1a1a'; x.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      const yy = iy + ih * (0.1 + k * 0.12);
      x.beginPath(); x.moveTo(ix, yy);
      for (let t = 0; t <= 1; t += 0.1) x.lineTo(ix + iw * t, yy + Math.sin(t * 9 + k) * ih * 0.03);
      x.stroke();
    }
    x.fillStyle = '#141414'; x.fillRect(ix + iw * 0.1, iy + ih * 0.8, iw * 0.35, ih * 0.08); x.fillRect(ix + iw * 0.55, iy + ih * 0.88, iw * 0.3, ih * 0.06);
  } else if (kind === 4) {
    // a red square on white, a pattern of small marks in it
    x.fillStyle = '#efefeb'; x.fillRect(ix, iy, iw, ih);
    x.fillStyle = '#b3241e'; x.fillRect(ix + iw * 0.15, iy + ih * 0.22, iw * 0.7, ih * 0.5);
    x.fillStyle = '#e8c9a0';
    for (let k = 0; k < 60; k++) x.fillRect(ix + iw * (0.2 + r() * 0.6), iy + ih * (0.27 + r() * 0.4), 2, 2);
    x.fillStyle = '#f5f2ea'; x.beginPath(); x.arc(ix + iw / 2, iy + ih * 0.47, iw * 0.05, 0, Math.PI * 2); x.fill();
  } else if (kind === 5) {
    // a small dark island on a calm sea
    const sky = x.createLinearGradient(0, iy, 0, iy + ih);
    sky.addColorStop(0, '#9cb7cf'); sky.addColorStop(0.55, '#e6ecef'); sky.addColorStop(0.56, '#7d9ab2'); sky.addColorStop(1, '#4f6f8a');
    x.fillStyle = sky; x.fillRect(ix, iy, iw, ih);
    x.fillStyle = '#25292c'; x.beginPath(); x.ellipse(ix + iw * 0.5, iy + ih * 0.56, iw * 0.2, ih * 0.05, 0, Math.PI, 0); x.fill();
  } else {
    // a pale sheet of script in a dark frame
    x.fillStyle = '#3c3a36'; x.fillRect(ix, iy, iw, ih);
    x.fillStyle = '#e9e1cf'; x.fillRect(ix + iw * 0.12, iy + ih * 0.1, iw * 0.76, ih * 0.8);
    x.fillStyle = 'rgba(60,50,40,0.6)';
    for (let yy = iy + ih * 0.16; yy < iy + ih * 0.84; yy += 4) x.fillRect(ix + iw * 0.18, yy, iw * (0.5 + r() * 0.14), 1.4);
  }
}

// Gärdet's track walls, turned for a sweep along the track as Karlaplan's are: u up the wall from
// its foot (0) to the vault (1), v along the track, GARDET_REPEAT m per repeat; `mirror` for the
// wall that sees the track's direction the other way round.
export function gardetTrackWall(floor: number, top: number, f: GardetTrackWall, mirror = false) {
  const src = gardetWallCanvas(floor, top, f);
  const [c, x] = canvas(src.height, src.width);
  x.setTransform(0, 1, -1, 0, src.height, 0);
  if (mirror) { x.translate(src.width, 0); x.scale(-1, 1); }
  x.drawImage(src, 0, 0);
  return toTexture(c);
}

// The wall behind Gärdet's platforms: panels of dark brown-grey concrete `panel` wide, cast with
// fine diagonal grooves, on a pale plinth from the platform (`platform` high) to `plinth`; over
// them a band in `band.color`, and a pale strip up to the vault (in `wall`). Two panels a repeat
// along the wall; turned for a sweep (u up from the wall's foot `floor` to `top`, v along). With
// `rods`, Mariatorget's ceramic rods in place of the panels, on a dark plinth; with `wine`,
// Zinkensdamm's narrow wine-red tiles (`wineTiles`); with `upright`, Hornstull's narrow white tiles
// on end (`whiteBricks`), above the band as well as below it; with `kransen`, Midsommarkransen's
// narrow cream tiles on end (`kransenTiles`) down to a dark skirting, and the band in glazed tiles
// 0.4 m wide; with `aspudden`, Aspudden's upright strips of teal and pale green tiles
// (`aspuddenStrips`) down to a dark skirting.
export function gardetBackWall(floor: number, top: number, platform: number, f: { panel: number; plinth: number; band: { from: number; to: number; color: string }; rods?: boolean; wine?: boolean; upright?: boolean; kransen?: boolean; aspudden?: boolean; wall?: string }) {
  const PX = 160, W = Math.round(2 * f.panel * PX), H = Math.round((top - floor) * PX);
  const [src, x] = canvas(W, H);
  const y = (h: number) => H - (h - floor) * PX;
  const r = rng(1967);
  x.fillStyle = '#3c3a37'; x.fillRect(0, 0, W, H);
  x.fillStyle = f.rods ? '#38393a' : f.wine ? '#2c2826' : f.upright || f.kransen || f.aspudden ? '#2a2a29' : '#b4b1a9'; x.fillRect(0, y(f.plinth), W, (f.plinth - platform) * PX);
  speckle(x, W, H, 1500, 0.06, 1968);
  if (f.rods) ceramicRods(x, 0, y(f.band.from), W, y(f.plinth) - y(f.band.from), PX, r);
  else if (f.kransen) kransenTiles(x, 0, y(f.band.from), W, y(f.plinth) - y(f.band.from), PX, r);
  else if (f.aspudden) aspuddenStrips(x, 0, y(f.band.from), W, y(f.plinth) - y(f.band.from), PX, r);
  else if (f.wine) wineTiles(x, 0, y(f.band.from), W, y(f.plinth) - y(f.band.from), PX, r);
  else if (f.upright) whiteBricks(x, 0, y(f.band.from), W, y(f.plinth) - y(f.band.from), PX, r);
  else stripedPanels(x, 0, y(f.band.from), W, y(f.plinth) - y(f.band.from), f.panel * PX, r);
  x.fillStyle = '#2e3236'; x.fillRect(0, y(f.band.to) - 2, W, (f.band.to - f.band.from) * PX + 4);
  x.fillStyle = f.band.color; x.fillRect(0, y(f.band.to), W, (f.band.to - f.band.from) * PX);
  if (f.kransen) {
    // (the band's tiles, each a shade off the next, the glaze catching the light along their tops)
    const n = Math.max(1, Math.round(W / (0.4 * PX))), tw = W / n, th = (f.band.to - f.band.from) * PX;
    for (let i = 0; i < n; i++) {
      const v = Math.floor(r() * 16) - 8;
      x.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 230 : 0},${v > 0 ? 210 : 0},${Math.abs(v) / 90})`; x.fillRect(i * tw + 1, y(f.band.to) + 1, tw - 2, th - 2);
      x.fillStyle = 'rgba(30,18,12,0.6)'; x.fillRect(i * tw, y(f.band.to), 1.5, th);
      x.fillStyle = 'rgba(255,235,215,0.18)'; x.fillRect(i * tw + 2, y(f.band.to) + 2, tw - 4, th * 0.12);
    }
  }
  x.fillStyle = f.wall ?? '#cbc8bf'; x.fillRect(0, 0, W, y(f.band.to) - 2);
  if (f.upright) whiteBricks(x, 0, 0, W, y(f.band.to) - 2, PX, r);
  else speckle(x, W, y(f.band.to), 600, 0.05, 1969);
  const [c, t] = canvas(src.height, src.width);
  t.setTransform(0, 1, -1, 0, src.height, 0);
  t.drawImage(src, 0, 0);
  return toTexture(c);
}
// Karin Björquist's and Kjell Abramson's rods at Mariatorget (1964), glazed at Gustavsberg, across
// the rectangle (`PX` to the metre): upright rods of ceramic about 6 cm across, side by side in dark
// joints, in lengths of about half a metre whose ends line up across the wall; each rounded,
// lighter down its middle, in a yellow ochre running through gold to brown, darker in streaks
// here and there (photographs, 2005–2024)
function ceramicRods(x: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, PX: number, r: () => number) {
  x.fillStyle = '#6b4c22'; x.fillRect(x0, y0, w, h);
  const n = Math.max(1, Math.round(w / (0.06 * PX))), dw = w / n;
  const rows = Math.max(1, Math.round(h / (0.55 * PX))), dh = h / rows;
  const cols = [[232, 186, 78], [226, 176, 66], [238, 196, 96], [218, 164, 62], [224, 172, 74], [196, 140, 56]];
  for (let i = 0; i < n; i++) {
    // (a streak: a few rods browner, all the way up)
    const streak = Math.max(0, Math.sin(i * 0.37 + 1.3) * Math.sin(i * 0.11) - 0.45) * 60;
    for (let j = 0; j < rows; j++) {
      const [cr, cg, cb] = cols[Math.floor(r() * cols.length)], v = Math.floor(r() * 14) - 7 - streak;
      const px = x0 + i * dw, py = y0 + j * dh;
      x.fillStyle = `rgb(${cr + v},${cg + v * 0.9},${cb + v * 0.6})`; x.fillRect(px + 0.8, py + 0.6, dw - 1.6, dh - 1.2);
      // the glaze pooled a little darker towards the foot of each length, and the rod's roundness
      const g = x.createLinearGradient(0, py, 0, py + dh);
      g.addColorStop(0, 'rgba(255,240,190,0.1)'); g.addColorStop(1, 'rgba(90,55,15,0.14)');
      x.fillStyle = g; x.fillRect(px + 0.8, py + 0.6, dw - 1.6, dh - 1.2);
      x.fillStyle = 'rgba(90,55,15,0.2)'; x.fillRect(px + 0.8, py + 0.6, dw * 0.18, dh - 1.2); x.fillRect(px + dw * 0.82 - 0.8, py + 0.6, dw * 0.18, dh - 1.2);
      x.fillStyle = 'rgba(255,246,210,0.28)'; x.fillRect(px + dw * 0.4, py + 2, dw * 0.16, dh - 4);
    }
  }
}

// The glazed tiles on the walls behind Zinkensdamm's platforms (1964), across the rectangle (`PX`
// to the metre, its rows from the foot up): narrow tiles on end, about 3.5 cm wide, in rows a third
// of a metre high, in pale grey joints, in dark wine reds, burgundy and brown, a few blue-greys
// among them; in each row a tile of ochre about 7 cm wide every 1.1 m, a third of that further
// along in each row up (photographs, 2005–2011). The rectangle 2.2 m wide repeats.
function wineTiles(x: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, PX: number, r: () => number) {
  x.fillStyle = '#8a8580'; x.fillRect(x0, y0, w, h);
  const n = Math.max(1, Math.round(w / (0.035 * PX))), dw = w / n, rowH = 0.33 * PX;
  const cols = [[80, 36, 38], [90, 42, 40], [68, 38, 40], [76, 48, 42], [64, 54, 60], [98, 54, 44], [54, 42, 48], [86, 32, 34], [104, 60, 46]];
  for (let j = 0; j * rowH < h - 2; j++) {
    const bottom = y0 + h - j * rowH, yy = Math.max(y0, bottom - rowH), hh = bottom - yy;
    if (hh <= 2) continue;
    // (an ochre tile, two tiles wide, where this row's next 1.1 m begins)
    const shift = ((j % 3) / 3) * 1.1 * PX, gap = 1.1 * PX;
    for (let i = 0; i < n; i++) {
      const px = x0 + i * dw, along = (((px - x0 - shift) % gap) + gap) % gap;
      const ochre = along < dw;
      if (along >= dw && along < 2 * dw) continue;
      const ww = ochre ? 2 * dw : dw;
      let rr: number, gg: number, bb: number;
      if (ochre) [rr, gg, bb] = [200 + Math.floor(r() * 20), 140 + Math.floor(r() * 18), 60 + Math.floor(r() * 16)];
      else { const [a, b, c] = cols[Math.floor(r() * cols.length)], v = Math.floor(r() * 16) - 8; [rr, gg, bb] = [a + v, b + v * 0.7, c + v * 0.6]; }
      x.fillStyle = `rgb(${rr},${gg},${bb})`; x.fillRect(px + 0.6, yy + 1, ww - 1.2, hh - 2);
      // (the glaze catching the light down each tile)
      x.fillStyle = 'rgba(255,235,220,0.09)'; x.fillRect(px + ww * 0.3, yy + 2, ww * 0.25, hh - 4);
    }
  }
}

// White glazed tiles on end, `tw` by `th` m, each a shade off its neighbours, in pale grey joints,
// across the rectangle (Zinkensdamm's escalator hall, seen through its glass screens)
function uprightTiles(x: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, PX: number, r: () => number, tw = 0.1, th = 0.2) {
  x.fillStyle = '#b9bbb8'; x.fillRect(x0, y0, w, h);
  const a = tw * PX, b = th * PX;
  for (let i = 0; i * a < w; i++) for (let j = 0; j * b < h; j++) {
    const v = 238 + Math.floor(r() * 10);
    x.fillStyle = `rgb(${v},${v},${v - 3})`; x.fillRect(x0 + i * a + 1, y0 + j * b + 1, a - 2, b - 2);
    x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(x0 + i * a + 1, y0 + j * b + 1, a - 2, b * 0.2);
  }
}

// White glazed tiles on end, `tw` by `th` m, in a running bond up the wall (each column half a tile
// up from its neighbours), cream to a cooler white and a little uneven, in grey joints, across the
// rectangle (Hornstull's walls behind the platforms, round its lobbies and up its shafts, 1964)
function whiteBricks(x: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, PX: number, r: () => number, tw = 0.07, th = 0.24) {
  x.fillStyle = '#9d9c96'; x.fillRect(x0, y0, w, h);
  const n = 2 * Math.max(1, Math.round(w / (2 * tw * PX))), a = w / n, b = th * PX;
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
  for (let i = 0; i < n; i++) {
    for (let yy = y0 + h + ((i % 2) * b) / 2; yy > y0; yy -= b) {
      const v = 230 + Math.floor(r() * 16), warm = Math.floor(r() * 6);
      x.fillStyle = `rgb(${v + warm - 2},${v},${v - 5 - warm})`; x.fillRect(x0 + i * a + 0.8, yy - b + 0.8, a - 1.6, b - 1.6);
      // (the glaze catching the light down each tile, and a little shadow at its foot)
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(x0 + i * a + a * 0.2, yy - b + 2, a * 0.25, b - 4);
      x.fillStyle = 'rgba(90,90,85,0.08)'; x.fillRect(x0 + i * a + 0.8, yy - b * 0.3, a - 1.6, b * 0.3 - 0.8);
    }
  }
  x.restore();
}

// Glazed tiles on end, `tw` by `th` m, in a stack bond (their joints running straight up and
// across), a cream with a faint olive cast, each a shade off its neighbours, in grey joints, across
// the rectangle from its foot up (Midsommarkransen's walls, 1964: photographs, 2005–2016)
function kransenTiles(x: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, PX: number, r: () => number, tw = 0.05, th = 0.24) {
  x.fillStyle = '#8e8a7a'; x.fillRect(x0, y0, w, h);
  const n = Math.max(1, Math.round(w / (tw * PX))), a = w / n, b = th * PX;
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
  for (let i = 0; i < n; i++) {
    for (let yy = y0 + h; yy > y0; yy -= b) {
      const v = Math.floor(r() * 14) - 7, o = Math.floor(r() * 6);
      x.fillStyle = `rgb(${214 + v},${206 + v + o * 0.3},${170 + v - o})`; x.fillRect(x0 + i * a + 0.6, yy - b + 0.6, a - 1.2, b - 1.2);
      // (the glaze catching the light down each tile)
      x.fillStyle = 'rgba(255,255,248,0.3)'; x.fillRect(x0 + i * a + a * 0.25, yy - b + 1.5, a * 0.22, b - 3);
    }
  }
  x.restore();
}

// Glazed tiles on end in upright strips, as on the walls behind Aspudden's platforms and round its
// middle hall (1964): columns 15 cm wide, in each column tiles 30, 45 or 60 cm high one on another,
// their joints not lining up across, in a dark speckled teal, a lighter blue-green, a pale grey-green
// and a celadon cream, in pale grey joints, across the rectangle from its foot up (photographs,
// 2005–2024)
function aspuddenStrips(x: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, PX: number, r: () => number) {
  x.fillStyle = '#9fa7a2'; x.fillRect(x0, y0, w, h);
  const n = Math.max(1, Math.round(w / (0.15 * PX))), a = w / n;
  const cols: [number, number, number, number][] = [[44, 104, 110, 0.32], [62, 134, 140, 0.22], [90, 152, 152, 0.1], [168, 192, 182, 0.2], [196, 210, 194, 0.16]];
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
  for (let i = 0; i < n; i++) {
    let yy = y0 + h + r() * 0.3 * PX;
    while (yy > y0) {
      const b = [0.3, 0.45, 0.6][Math.floor(r() * 3)] * PX;
      let k = r(), c = cols[0];
      for (const q of cols) { if (k < q[3]) { c = q; break; } k -= q[3]; }
      const v = Math.floor(r() * 12) - 6;
      x.fillStyle = `rgb(${c[0] + v},${c[1] + v},${c[2] + v})`; x.fillRect(x0 + i * a + 0.8, yy - b + 0.8, a - 1.6, b - 1.6);
      // (the darker glazes speckled, and the glaze catching the light down each tile)
      if (c[0] < 100) for (let m = 0; m < 14; m++) { x.fillStyle = r() < 0.5 ? 'rgba(20,50,54,0.5)' : 'rgba(150,200,200,0.35)'; x.fillRect(x0 + i * a + r() * a, yy - r() * b, 1.5, 1.5); }
      x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(x0 + i * a + a * 0.18, yy - b + 2, a * 0.2, b - 4);
      yy -= b;
    }
  }
  x.restore();
}

// Narrow glazed tiles on end, 5 by 25 cm, in a stack bond, in honey, amber, gold and brown, each a
// shade off its neighbours and some streaked darker, in dark joints: the walls round Aspudden's
// escalators (photographs, 2014–2024)
function amberTiles(x: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, PX: number, r: () => number) {
  x.fillStyle = '#4a3218'; x.fillRect(x0, y0, w, h);
  const n = Math.max(1, Math.round(w / (0.05 * PX))), a = w / n, b = 0.25 * PX;
  const cols = [[196, 140, 52], [176, 118, 40], [214, 164, 70], [150, 96, 34], [226, 182, 92], [124, 80, 30]];
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
  for (let i = 0; i < n; i++) {
    for (let yy = y0 + h; yy > y0; yy -= b) {
      const [cr, cg, cb] = cols[Math.floor(r() * cols.length)], v = Math.floor(r() * 16) - 8;
      x.fillStyle = `rgb(${cr + v},${cg + v * 0.8},${cb + v * 0.5})`; x.fillRect(x0 + i * a + 0.6, yy - b + 0.6, a - 1.2, b - 1.2);
      const g = x.createLinearGradient(0, yy - b, 0, yy);
      g.addColorStop(0, 'rgba(255,230,170,0.12)'); g.addColorStop(1, 'rgba(70,40,10,0.18)');
      x.fillStyle = g; x.fillRect(x0 + i * a + 0.6, yy - b + 0.6, a - 1.2, b - 1.2);
      x.fillStyle = 'rgba(255,240,200,0.3)'; x.fillRect(x0 + i * a + a * 0.25, yy - b + 2, a * 0.2, b - 4);
    }
  }
  x.restore();
}

// Large glossy tiles on end, 15 by 30 cm, stacked in columns, in a dark speckled green with runs of
// a pale green and a beige-tan among them, in pale joints: the walls of Aspudden's ticket hall
// (photographs, 2011–2019)
function aspuddenHallTiles(x: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, PX: number, r: () => number) {
  x.fillStyle = '#a6aaa2'; x.fillRect(x0, y0, w, h);
  const a = 0.15 * PX, b = 0.3 * PX;
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
  for (let i = 0; i * a < w; i++) {
    // (a run of light tiles now and then up each column)
    let run = 0, light: number[] = [];
    for (let yy = y0 + h; yy > y0; yy -= b) {
      if (run <= 0 && r() < 0.18) { run = 1 + Math.floor(r() * 3); light = r() < 0.55 ? [170, 186, 160] : [198, 178, 140]; }
      const v = Math.floor(r() * 12) - 6;
      const [cr, cg, cb] = run > 0 ? light : [44, 70, 54];
      x.fillStyle = `rgb(${cr + v},${cg + v},${cb + v})`; x.fillRect(x0 + i * a + 1, yy - b + 1, a - 2, b - 2);
      if (run <= 0) for (let m = 0; m < 10; m++) { x.fillStyle = r() < 0.5 ? 'rgba(14,30,20,0.5)' : 'rgba(140,170,140,0.35)'; x.fillRect(x0 + i * a + r() * a, yy - r() * b, 1.5, 1.5); }
      x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(x0 + i * a + a * 0.15, yy - b + 2, a * 0.25, b - 4);
      run--;
    }
  }
  x.restore();
}

// Telefonplan's yellow clinker, from x0 to x1 and y0 to y1 on the canvas: glossy mustard tiles 20 cm
// square, stack bonded, in pale grey joints, from the bottom up.
function ochreClinker(x: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, PX: number, r: () => number) {
  const t = 0.2 * PX;
  x.fillStyle = '#a3a19a'; x.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let xx = x0; xx < x1 - 0.5; xx += t) for (let yy = y1; yy > y0 + 0.5; yy -= t) {
    const w = Math.min(t, x1 - xx), h = Math.min(t, yy - y0), v = Math.floor(r() * 14) - 7, o = Math.floor(r() * 8);
    x.fillStyle = `rgb(${226 + v},${178 + v + o * 0.4},${86 + v - o})`; x.fillRect(xx + 1, yy - h + 1, w - 2, h - 2);
    // (the glaze catching the light)
    x.fillStyle = 'rgba(255,250,232,0.2)'; x.fillRect(xx + w * 0.15, yy - h + 2, w * 0.2, h - 4);
  }
}

// Telefonplan's station building, from x0 to x1 and y0 to y1 on the canvas: red-brown brick as
// `brick`'s, about 23 by 7.5 cm with 1 cm joints, in a running bond, from the bottom up.
function brickArea(x: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, PX: number, r: () => number) {
  const bl = 0.24 * PX, bh = 1.2 * PX / 14;
  x.save(); x.beginPath(); x.rect(x0, y0, x1 - x0, y1 - y0); x.clip();
  x.fillStyle = '#9a9188'; x.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let j = 0; y1 - j * bh > y0; j++) for (let i = -1; x0 + i * bl < x1; i++) {
    const v = Math.floor(r() * 26) - 13, ox = (j % 2) * bl / 2;
    x.fillStyle = `rgb(${142 + v},${66 + v * 0.7},${48 + v * 0.5})`;
    x.fillRect(x0 + i * bl + ox + 1, y1 - (j + 1) * bh + 1, bl - 2, bh - 1.6);
  }
  x.restore();
}

// A shop's window from x0 to x1, its glass from y0 (top) to y1 on the canvas, lit from within:
// big posters behind it (a newsagent's), or a florist's buckets of flowers under a picture of
// them; the glass catching the light across it.
function shopWindow(x: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, PX: number, r: () => number, kind: 'posters' | 'flowers') {
  const w = x1 - x0, h = y1 - y0;
  const lit = x.createLinearGradient(0, y0, 0, y1);
  lit.addColorStop(0, '#ddd8ca'); lit.addColorStop(1, '#b3ab9a');
  x.fillStyle = lit; x.fillRect(x0, y0, w, h);
  if (kind === 'posters') {
    // (a poster filling most of the window: a ground, a big shape on it, and lines of type)
    const grounds = ['#f2efe6', '#3b86c6', '#e9a7bb', '#f1c42e', '#d9533f', '#f2efe6'], g = grounds[Math.floor(r() * grounds.length)];
    const px = x0 + w * 0.08, py = y0 + h * 0.06, pw = w * 0.84, ph = h * 0.8;
    x.fillStyle = g; x.fillRect(px, py, pw, ph);
    const shapes = ['#c0392b', '#7a4a2a', '#f5f3ee', '#2f5f9a', '#e8b84a'];
    x.fillStyle = shapes[Math.floor(r() * shapes.length)];
    if (r() < 0.5) { x.beginPath(); x.arc(px + pw * (0.3 + r() * 0.4), py + ph * 0.42, Math.min(pw, ph) * (0.22 + r() * 0.1), 0, 2 * Math.PI); x.fill(); }
    else x.fillRect(px + pw * 0.12, py + ph * (0.25 + r() * 0.1), pw * 0.76, ph * 0.28);
    x.fillStyle = g === '#f2efe6' || g === '#f1c42e' ? '#26282b' : '#f7f5f0';
    x.fillRect(px + pw * 0.12, py + ph * 0.78, pw * (0.4 + r() * 0.4), ph * 0.06);
    x.fillRect(px + pw * 0.12, py + ph * 0.88, pw * (0.25 + r() * 0.3), ph * 0.04);
  } else {
    // (a picture of flowers over the top half, buckets of them on steps below)
    x.fillStyle = '#efe9e4'; x.fillRect(x0 + w * 0.1, y0 + h * 0.06, w * 0.8, h * 0.4);
    for (let k = 0; k < 40; k++) {
      x.fillStyle = ['#d8577e', '#f2f0ea', '#e7a1b3', '#5d8a47', '#f0c64a'][Math.floor(r() * 5)];
      x.beginPath(); x.arc(x0 + w * (0.14 + r() * 0.72), y0 + h * (0.1 + r() * 0.32), 0.03 * PX + r() * 0.05 * PX, 0, 2 * Math.PI); x.fill();
    }
    for (let k = 0; k < 3; k++) { x.fillStyle = 'rgba(70,64,58,0.55)'; x.fillRect(x0 + 2, y0 + h * (0.6 + k * 0.14), w - 4, 3); }
    for (let k = 0; k < 120; k++) {
      x.fillStyle = ['#4f7f3c', '#6a9a4a', '#3d6630', '#d8577e', '#f4f2ec', '#e9b13c', '#b84a7a', '#e7a1b3'][Math.floor(r() * 8)];
      x.beginPath(); x.arc(x0 + w * (0.04 + r() * 0.92), y0 + h * (0.5 + r() * 0.48), 0.025 * PX + r() * 0.05 * PX, 0, 2 * Math.PI); x.fill();
    }
  }
  x.fillStyle = 'rgba(255,255,255,0.16)';
  x.beginPath(); x.moveTo(x0 + w * 0.1, y1); x.lineTo(x0 + w * 0.42, y0); x.lineTo(x0 + w * 0.58, y0); x.lineTo(x0 + w * 0.26, y1); x.fill();
}

// A sign board from x0 to x1 and y0 (top) to y1, black, a line of gold lettering along it.
function signBoard(x: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, r: () => number) {
  x.fillStyle = '#121214'; x.fillRect(x0, y0, x1 - x0, y1 - y0);
  const h = y1 - y0, top = y0 + h * 0.3, bottom = y0 + h * 0.7;
  x.fillStyle = '#c8a24a';
  for (let at = x0 + h * 0.4; at < x1 - h * 0.6;) {
    const lw = h * (0.14 + r() * 0.12);
    x.fillRect(at, top, lw, bottom - top);
    at += lw + h * (r() < 0.2 ? 0.35 : 0.07);
  }
}

// Berndt Helleberg's track walls at Hornstull (1964), across a repeat `W` wide: a grey concrete
// plinth up to `from`, and over it, up to `top`, handmade bricks of red glaze from the Netherlands
// laid on end, about 6 by 24 cm, in a running bond up the wall, oranges to deep reds, in pale grey
// joints; along them, about three quarters of the way up, a black band, jagged like a crack in a
// cave's wall, and hanging from it here and there figures of white and pale grey glazed pieces (the
// theme the cave at Altamira); and once a repeat the name in white tiles among the bricks, about
// halfway up (sv.wikipedia; photographs, 2005–2026)
function hellebergWall(x: CanvasRenderingContext2D, W: number, H: number, y: (h: number) => number, from: number, top: number, name: string, PX: number, r: () => number) {
  x.fillStyle = '#8e8c87'; x.fillRect(0, y(from), W, H - y(from));
  speckle(x, W, H, 3000, 0.1, 2008, true);
  const y0 = y(top), y1 = y(from), n = 2 * Math.round(W / (0.12 * PX)), bw = W / n, bh = 0.24 * PX;
  x.fillStyle = '#a49b90'; x.fillRect(0, y0, W, y1 - y0);
  const cols = [[196, 78, 46], [182, 66, 40], [208, 94, 56], [164, 56, 36], [188, 80, 50], [148, 50, 34], [214, 104, 64], [174, 70, 44]];
  for (let i = 0; i < n; i++) {
    for (let yy = y1 + ((i % 2) * bh) / 2; yy > y0; yy -= bh) {
      const t = Math.max(y0, yy - bh), b = Math.min(y1, yy);
      if (b - t < 2) continue;
      const [cr, cg, cb] = cols[Math.floor(r() * cols.length)], v = Math.floor(r() * 20) - 10;
      x.fillStyle = `rgb(${cr + v},${cg + v * 0.6},${cb + v * 0.5})`; x.fillRect(i * bw + 0.6, t + 0.6, bw - 1.2, b - t - 1.2);
      x.fillStyle = 'rgba(255,225,200,0.13)'; x.fillRect(i * bw + bw * 0.25, t + 2, bw * 0.22, b - t - 4);
      x.fillStyle = 'rgba(40,10,5,0.12)'; x.fillRect(i * bw + 0.6, b - (b - t) * 0.25, bw - 1.2, (b - t) * 0.25 - 0.6);
    }
  }
  x.fillStyle = 'rgba(40,36,30,0.3)'; x.fillRect(0, y1 - 1, W, 3);
  // the black band: whole numbers of waves along the repeat, so that it runs on into the next
  const band = (px: number) => {
    const t = (px / W) * Math.PI * 2;
    return from + (top - from) * (0.76 + 0.05 * Math.sin(t * 2 + 0.7) + 0.03 * Math.sin(t * 5 + 2.1) + 0.015 * Math.sin(t * 13 + 0.3));
  };
  const N = 420, pts: [number, number][] = [];
  for (let k = 0; k <= N; k++) pts.push([(k / N) * W, y(band((k / N) * W)) + (k % N === 0 ? 0 : (r() - 0.5) * 0.07 * PX)]);
  x.strokeStyle = '#151413'; x.lineCap = 'round'; x.lineJoin = 'round';
  for (let k = 0; k < N; k++) {
    x.lineWidth = (0.02 + 0.04 * Math.abs(Math.sin(k * 0.21) * Math.sin(k * 0.047))) * PX;
    x.beginPath(); x.moveTo(pts[k][0], pts[k][1]); x.lineTo(pts[k + 1][0], pts[k + 1][1]); x.stroke();
  }
  // (cracks branching off it, short and jagged)
  x.lineWidth = 0.015 * PX;
  for (let k = 0; k < 18; k++) {
    let px = r() * W, py = y(band(px)), dir = r() < 0.5 ? 1 : -1;
    x.beginPath(); x.moveTo(px, py);
    for (let j = 0; j < 5; j++) { px += (r() - 0.5) * 0.25 * PX; py += dir * (0.04 + r() * 0.12) * PX; x.lineTo(px, py); }
    x.stroke();
  }
  // the figures, clear of the name in the middle of the repeat
  const piece = (px: number, py: number, pw: number, ph: number, a: number, col: string) => {
    for (const o of [-W, 0, W]) {
      x.save(); x.translate(px + o, py); x.rotate(a); x.fillStyle = col; x.fillRect(-pw / 2, 0, pw, ph); x.restore();
    }
  };
  const whites = ['#f4f3ee', '#e4e4df', '#cfd5d8', '#b8c2c8', '#ebe6da', '#9aa4aa', '#f0efe8'];
  const K = 7;
  for (let k = 0; k < K; k++) {
    const cx = ((k + 0.25 + r() * 0.5) / K) * W, half = (0.35 + r() * 0.75) * PX;
    if (Math.abs(cx - W / 2) < half + 1.4 * PX) continue;
    for (let sx = cx - half; sx < cx + half; sx += bw * (0.7 + r() * 0.7)) {
      const t = (sx - cx) / half, env = Math.max(0, 1 - t * t), px = ((sx % W) + W) % W;
      const len = (0.12 + r() * 0.95) * env * PX, start = y(band(px)) - 0.08 * PX * r();
      for (let yy = start; yy < start + len;) {
        const ph = (0.04 + r() * 0.09) * PX;
        piece(px + (r() - 0.5) * bw * 0.6, yy, bw * (0.8 + r() * 0.6), ph, (r() - 0.5) * 0.6, r() < 0.1 ? '#1b1b1b' : whites[Math.floor(r() * whites.length)]);
        yy += ph + 1 + r() * 2;
      }
    }
  }
  // the name, in white tiles cut into pieces by the joints
  const ty = y(from + (top - from) * 0.42), size = 0.3 * PX, text = name.toUpperCase().split('').join(' ');
  x.font = `bold ${size}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#efeee9'; x.fillText(text, W / 2, ty);
  const tw = x.measureText(text).width;
  x.strokeStyle = 'rgba(150,144,136,0.9)'; x.lineWidth = 1;
  for (let px = Math.floor((W / 2 - tw / 2) / bw) * bw; px < W / 2 + tw / 2; px += bw) { x.beginPath(); x.moveTo(px, ty - size * 0.6); x.lineTo(px, ty + size * 0.6); x.stroke(); }
  for (let k = 0; k < 60; k++) {
    const px = W / 2 - tw / 2 + r() * tw, py = ty + (r() - 0.5) * size;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + bw, py + (r() - 0.5) * 2); x.stroke();
  }
}

// Berndt Helleberg's cases in the walls behind Hornstull's platforms (1992), on the themes of sky,
// sea, earth and desert (`variant` 0–3), redrawn: a lit case `w` × `h` m in a black steel frame, a
// pale lining, and in it the theme, as its colours and a few shapes of its own (what each case
// holds is not known here)
export function elementsCase(w: number, h: number, variant: number) {
  const PX = 320, W = Math.round(w * PX), H = Math.round(h * PX), [c, x] = canvas(W, H);
  const r = rng(1992 + variant * 17), f = 0.05 * PX;
  x.fillStyle = '#1c1d1f'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#efe9dc'; x.fillRect(f, f, W - 2 * f, H - 2 * f);
  const ix = f + 0.08 * PX, iy = f + 0.12 * PX, iw = W - 2 * ix, ih = H - 2 * iy;
  const g = x.createLinearGradient(0, iy, 0, iy + ih);
  const stops = [['#6f9cc8', '#d8e6ef'], ['#1f5f7a', '#7fb6c2'], ['#4a3424', '#9c7a4e'], ['#f0d9a0', '#c4914c']][variant % 4];
  g.addColorStop(0, variant === 2 ? stops[1] : stops[0]); g.addColorStop(1, variant === 2 ? stops[0] : stops[1]);
  x.save(); x.globalAlpha = 0.6;
  x.fillStyle = g; x.fillRect(ix, iy, iw, ih);
  if (variant % 4 === 0) {
    // clouds
    for (let k = 0; k < 9; k++) {
      const cx = ix + r() * iw, cy = iy + ih * (0.2 + r() * 0.6), s = iw * (0.08 + r() * 0.12);
      x.fillStyle = 'rgba(255,255,255,0.75)';
      for (let j = 0; j < 4; j++) { x.beginPath(); x.ellipse(cx + (j - 1.5) * s * 0.6, cy + (r() - 0.5) * s * 0.3, s * 0.55, s * 0.35, 0, 0, Math.PI * 2); x.fill(); }
    }
  } else if (variant % 4 === 1) {
    // waves, and a few fish
    x.strokeStyle = 'rgba(230,245,250,0.55)'; x.lineWidth = 3;
    for (let k = 0; k < 9; k++) {
      const yy = iy + ih * (0.08 + k * 0.1);
      x.beginPath(); for (let t = 0; t <= 1.001; t += 0.05) x.lineTo(ix + iw * t, yy + Math.sin(t * 12 + k) * ih * 0.012); x.stroke();
    }
    for (let k = 0; k < 5; k++) {
      const cx = ix + iw * (0.2 + r() * 0.6), cy = iy + ih * (0.3 + r() * 0.6), s = iw * (0.06 + r() * 0.05);
      x.fillStyle = ['#d8c27a', '#c8d8dc', '#e08a5a'][k % 3];
      x.beginPath(); x.ellipse(cx, cy, s, s * 0.4, 0, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.moveTo(cx + s * 0.9, cy); x.lineTo(cx + s * 1.5, cy - s * 0.4); x.lineTo(cx + s * 1.5, cy + s * 0.4); x.fill();
    }
  } else if (variant % 4 === 2) {
    // layers of soil and stones, grass along the top
    for (let k = 0; k < 6; k++) {
      x.fillStyle = `rgba(${60 + k * 12},${44 + k * 8},${30 + k * 4},0.35)`;
      x.fillRect(ix, iy + ih * (0.2 + k * 0.13), iw, ih * 0.06);
    }
    for (let k = 0; k < 22; k++) {
      x.fillStyle = ['#8a8580', '#6e6862', '#a49a8a', '#5a4e44'][k % 4];
      x.beginPath(); x.ellipse(ix + r() * iw, iy + ih * (0.25 + r() * 0.7), iw * (0.02 + r() * 0.05), iw * (0.015 + r() * 0.03), r() * 3, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = '#5a8a3a'; x.fillRect(ix, iy, iw, ih * 0.08);
  } else {
    // dunes under a sun
    x.fillStyle = 'rgba(255,250,225,0.9)'; x.beginPath(); x.arc(ix + iw * 0.7, iy + ih * 0.2, iw * 0.12, 0, Math.PI * 2); x.fill();
    for (let k = 0; k < 4; k++) {
      x.fillStyle = `rgba(${200 - k * 14},${150 - k * 14},${80 - k * 10},0.6)`;
      x.beginPath(); x.moveTo(ix, iy + ih); const y0 = iy + ih * (0.45 + k * 0.13);
      for (let t = 0; t <= 1.001; t += 0.05) x.lineTo(ix + iw * t, y0 + Math.sin(t * 5 + k * 1.7) * ih * 0.04);
      x.lineTo(ix + iw, iy + ih); x.fill();
    }
  }
  x.restore();
  // the light from the top of the case, and the glass
  const l = x.createLinearGradient(0, f, 0, H * 0.5);
  l.addColorStop(0, 'rgba(255,250,235,0.35)'); l.addColorStop(1, 'rgba(255,250,235,0)');
  x.fillStyle = l; x.fillRect(f, f, W - 2 * f, H / 2);
  return toTexture(c);
}

// Eva Ziggy Berglund's column at Hornstull, I minnet gjutet (2012), round an older pillar: its
// light upper part in acrystal, cast with hundreds of things from the neighbourhood, hands, mouths,
// noses, textiles, nuts and chains (`dark` false); its dark foot in cast iron, a ring of big lips
// round it and fish swimming below, a strip of gold and blue mosaic down it (`dark` true). One
// turn round the column, 2 m wide; its rows of things up it (sv.wikipedia; photographs, 2013)
export function ziggyColumn(dark: boolean) {
  const W = 640, H = 640, [c, x] = canvas(W, H), r = rng(dark ? 2012 : 2013);
  x.fillStyle = dark ? '#2e2c2a' : '#e2e0da'; x.fillRect(0, 0, W, H);
  const blob = (cx: number, cy: number, rw: number, rh: number, light: string, shade: string) => {
    for (const o of [-W, 0, W]) {
      x.fillStyle = shade; x.beginPath(); x.ellipse(cx + o + rw * 0.15, cy + rh * 0.2, rw, rh, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = light; x.beginPath(); x.ellipse(cx + o, cy, rw, rh, 0, 0, Math.PI * 2); x.fill();
    }
  };
  if (dark) {
    for (let k = 0; k < 160; k++) blob(r() * W, r() * H, 6 + r() * 16, 4 + r() * 10, ['#3e3b38', '#4a4642', '#353230'][k % 3], '#1a1918');
    // fish, in low relief
    for (let k = 0; k < 6; k++) {
      const cx = r() * W, cy = H * (0.45 + r() * 0.45), s = 30 + r() * 20;
      blob(cx, cy, s, s * 0.35, '#56514b', '#1e1c1a');
    }
    // the strip of mosaic down it
    for (let yy = 0; yy < H; yy += 16) { x.fillStyle = ['#c9a23a', '#d8b450', '#3a5a8a', '#b8b8b0'][Math.floor(r() * 4)]; x.fillRect(W * 0.3, yy + 1, 14, 14); }
  } else {
    for (let k = 0; k < 340; k++) blob(r() * W, r() * H, 5 + r() * 14, 3 + r() * 10, ['#f2f0ea', '#e8e6df', '#d9d6ce'][k % 3], 'rgba(120,115,105,0.6)');
    // hands, reaching up
    for (let k = 0; k < 10; k++) {
      const cx = r() * W, cy = r() * H;
      for (let j = 0; j < 4; j++) blob(cx - 18 + j * 12, cy - 22, 4, 16, '#f6f4ee', 'rgba(110,105,95,0.6)');
      blob(cx, cy, 22, 18, '#f6f4ee', 'rgba(110,105,95,0.6)');
    }
  }
  return toTexture(c);
}

// panels of brown-grey concrete `pw` wide across the rectangle, cast with fine diagonal grooves, each a
// little different in tone, in dark joints
function stripedPanels(x: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, pw: number, r: () => number) {
  for (let i = 0; i * pw < w - 1; i++) {
    const px = x0 + i * pw, v = Math.floor(r() * 14) - 7;
    x.fillStyle = '#222120'; x.fillRect(px, y0, pw, h);
    x.fillStyle = `rgb(${128 + v},${118 + v},${106 + v})`; x.fillRect(px + 3, y0, pw - 6, h);
    x.save(); x.beginPath(); x.rect(px + 3, y0, pw - 6, h); x.clip();
    for (let k = -h; k < pw + h; k += 4) {
      x.strokeStyle = 'rgba(52,46,40,0.3)'; x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(px + k, y0 + h); x.lineTo(px + k + h, y0); x.stroke();
      x.strokeStyle = 'rgba(160,150,140,0.18)'; x.lineWidth = 0.8;
      x.beginPath(); x.moveTo(px + k + 2, y0 + h); x.lineTo(px + k + 2 + h, y0); x.stroke();
    }
    // faintly mottled
    for (let k = 0; k < 40; k++) {
      x.fillStyle = `rgba(${r() < 0.5 ? '60,54,48' : '150,142,132'},${0.015 + r() * 0.025})`;
      x.beginPath(); x.ellipse(px + r() * pw, y0 + r() * h, pw * (0.05 + r() * 0.12), h * (0.02 + r() * 0.05), 0, 0, Math.PI * 2); x.fill();
    }
    x.restore();
  }
}

// Karl Axel Pehrson's beetles at Gärdet (1967), redrawn: a lit case `w` × `h` m in a steel frame,
// white inside, eight fantastical beetles pinned in two columns, each different in shape and
// colour (a metallic green, a red with black spots, a blue, a gold, a bronze). `variant` changes
// them.
export function beetleCase(w: number, h: number, variant: number) {
  const PX = 320, W = Math.round(w * PX), H = Math.round(h * PX), [c, x] = canvas(W, H);
  const r = rng(1967 + variant * 31);
  x.fillStyle = '#8d9296'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#d7dadc'; x.fillRect(3, 3, W - 6, H - 6);
  const f = 0.04 * PX, g = x.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, H * 0.7);
  g.addColorStop(0, '#fbfbf8'); g.addColorStop(1, '#e6e8e3');
  x.fillStyle = g; x.fillRect(f, f, W - 2 * f, H - 2 * f);
  // (small, a few cm long, in the middle of the case, in the colours of real beetles: metallic
  // green, bronze, brown, black, a red, a gold)
  const cols = [['#1f5a34', '#5fae6a'], ['#5a3a1e', '#a8774a'], ['#3a2a1e', '#7a5a3e'], ['#161616', '#5a5a5a'], ['#8e2a1a', '#d0603e'], ['#8a6a18', '#d8b450'], ['#1e3e4e', '#5f9aa8'], ['#4a3a14', '#9a8a4a']];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) {
    const cx = W * (0.36 + i * 0.28), cy = H * (0.3 + j * 0.095), s = W * (0.055 + r() * 0.03);
    const [dark, light] = cols[Math.floor(r() * cols.length)];
    // the pin's shadow, a little to one side
    x.fillStyle = 'rgba(60,60,60,0.12)'; x.beginPath(); x.ellipse(cx + s * 0.25, cy + s * 0.3, s * 0.5, s * 0.8, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#1e1a16'; x.lineWidth = Math.max(1, s * 0.08);
    // legs, short and bent, and feelers
    for (const sd of [-1, 1]) {
      for (let l = 0; l < 3; l++) {
        const a0 = cy - s * 0.25 + l * s * 0.35;
        x.beginPath(); x.moveTo(cx + sd * s * 0.35, a0); x.lineTo(cx + sd * s * 0.7, a0 + (l - 1) * s * 0.25); x.lineTo(cx + sd * s * 0.8, a0 + (l - 0.8) * s * 0.45); x.stroke();
      }
      x.beginPath(); x.moveTo(cx + sd * s * 0.1, cy - s * 0.8); x.quadraticCurveTo(cx + sd * s * 0.3, cy - s * 1.15, cx + sd * s * (0.4 + r() * 0.2), cy - s * (1.15 + r() * 0.2)); x.stroke();
    }
    // head, shield and wing cases, with a sheen and a seam down the middle
    x.fillStyle = '#1e1a16'; x.beginPath(); x.ellipse(cx, cy - s * 0.72, s * 0.17, s * 0.13, 0, 0, Math.PI * 2); x.fill();
    const body = x.createLinearGradient(cx - s * 0.5, cy - s * 0.6, cx + s * 0.5, cy + s);
    body.addColorStop(0, light); body.addColorStop(0.5, dark); body.addColorStop(1, dark);
    x.fillStyle = body; x.beginPath(); x.ellipse(cx, cy - s * 0.45, s * 0.3, s * 0.2, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(cx, cy + s * 0.2, s * (0.36 + r() * 0.08), s * (0.5 + r() * 0.12), 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(20,16,12,0.7)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(cx, cy - s * 0.25); x.lineTo(cx, cy + s * 0.7); x.stroke();
    if (r() < 0.3) { x.fillStyle = 'rgba(15,12,10,0.8)'; for (let k = 0; k < 4; k++) { const sd = k % 2 ? 1 : -1; x.beginPath(); x.arc(cx + sd * s * 0.16, cy + s * (0.05 + Math.floor(k / 2) * 0.3), s * 0.06, 0, Math.PI * 2); x.fill(); } }
    x.fillStyle = 'rgba(255,255,255,0.3)'; x.beginPath(); x.ellipse(cx - s * 0.14, cy + s * 0.05, s * 0.05, s * 0.2, 0, 0, Math.PI * 2); x.fill();
  }
  return toTexture(c, { repeat: false });
}

// A white plate with the ways out to one end, in black, a line each, and an arrow at that end
// (`left` or right, as seen); 4 m to 1 across.
export function wayPlate(ways: string, left: boolean) {
  const [c, x] = canvas(1024, 256);
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 1024, 256);
  x.fillStyle = '#16171a';
  x.textBaseline = 'middle';
  const lines = ways.split(' · '), size = lines.length > 2 ? 54 : lines.length > 1 ? 70 : 96;
  x.font = `500 ${size}px "Helvetica Neue", Arial, sans-serif`;
  x.textAlign = left ? 'left' : 'right';
  lines.forEach((w, i) => x.fillText(w, left ? 190 : 834, 128 + (i - (lines.length - 1) / 2) * size * 1.15, 640));
  x.font = '600 150px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'center';
  x.fillText(left ? '←' : '→', left ? 95 : 929, 124);
  return toTexture(c, { repeat: false });
}

// Larseric Vänerlöf's photomontage along Karlaplan's track wall (1983): old Östermalm in black and
// white, scene after scene, each fading into the next. Redrawn, not copied: stone houses of the
// 1890s with their bays and towers, the fountain on Karlaplan in its ring of trees, the lindens of
// Karlavägen, a tram, an old car, people in the street. One repeat is FRIEZE_REPEAT m long and the
// band's height `height` m; turned for a sweep (u up, v along) as the walls are.
export const FRIEZE_REPEAT = 24;
export function karlaplanFrieze(height: number, mirror = false) {
  const PX = 170, W = FRIEZE_REPEAT * PX, H = Math.round(height * PX);
  const [c, x] = canvas(W, H);
  const r = rng(1983);
  const grey = (v: number, a = 1) => `rgba(${v},${v},${v},${a})`;
  // a linden: a trunk, and a crown of many small leafy clumps, lighter where the sky shows through
  const tree = (tx: number, foot: number, th: number, tone: number) => {
    x.fillStyle = grey(tone - 50); x.fillRect(tx - th * 0.025, foot - th * 0.45, th * 0.05, th * 0.45);
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      x.fillStyle = grey(tone - 40 + r() * 70, 0.85);
      x.beginPath(); x.ellipse(tx + Math.cos(a) * d * th * 0.28, foot - th * 0.68 + Math.sin(a) * d * th * 0.28, th * 0.05, th * 0.04, 0, 0, Math.PI * 2); x.fill();
    }
  };
  const scene = (x0: number, w: number, kind: number) => {
    x.save();
    x.beginPath(); x.rect(x0, 0, w, H); x.clip();
    // the sky, pale and blank as in old prints, and the street
    const sky = x.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, grey(200 + r() * 30)); sky.addColorStop(0.62, grey(170 + r() * 30)); sky.addColorStop(0.63, grey(110 + r() * 20)); sky.addColorStop(1, grey(70 + r() * 25));
    x.fillStyle = sky; x.fillRect(x0, 0, w, H);
    const horizon = H * 0.63;
    if (kind === 0) {
      // a row of stone houses: cornices, bays, a tower or two, rows of windows
      let hx = x0 - r() * 40;
      while (hx < x0 + w) {
        const bw = 120 + r() * 220, top = H * (0.08 + r() * 0.25), tone = 90 + r() * 80;
        x.fillStyle = grey(tone); x.fillRect(hx, top, bw, horizon - top);
        x.fillStyle = grey(tone - 30); x.fillRect(hx - 3, top, bw + 6, 6);
        if (r() < 0.35) { x.fillStyle = grey(tone - 15); x.beginPath(); x.moveTo(hx + bw * 0.4, top); x.lineTo(hx + bw * 0.5, top - H * 0.12); x.lineTo(hx + bw * 0.6, top); x.fill(); }
        if (r() < 0.5) { x.fillStyle = grey(tone + 15); x.fillRect(hx + bw * 0.35, top + 10, bw * 0.3, horizon - top - 30); }
        x.fillStyle = grey(35 + r() * 30);
        for (let wy = top + 14; wy < horizon - 26; wy += 26) for (let wx = hx + 10; wx < hx + bw - 16; wx += 24) x.fillRect(wx, wy, 9, 14);
        hx += bw + 2;
      }
    } else if (kind === 1) {
      // the fountain on Karlaplan: the basin, its jets, the ring of trees behind
      for (let k = 0; k < 10; k++) tree(x0 + r() * w, horizon, H * (0.45 + r() * 0.3), 90 + r() * 40);
      const cx = x0 + w / 2;
      x.strokeStyle = grey(240, 0.8); x.lineWidth = 2;
      for (let k = -6; k <= 6; k++) { x.beginPath(); x.moveTo(cx + k * 6, horizon); x.quadraticCurveTo(cx + k * 14, H * 0.05, cx + k * 26, horizon - 4); x.stroke(); }
      x.fillStyle = grey(225, 0.7); x.beginPath(); x.ellipse(cx, horizon - 6, 26, H * 0.32, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = grey(120); x.fillRect(cx - w * 0.35, horizon - 8, w * 0.7, 16);
      x.fillStyle = grey(160); x.fillRect(cx - w * 0.35, horizon - 10, w * 0.7, 4);
    } else if (kind === 2) {
      // an avenue of lindens running away from us
      const vx = x0 + w * (0.3 + r() * 0.4);
      for (let k = 0; k < 12; k++) {
        const f = 1 - k / 12;
        for (const s of [-1, 1]) {
          const tx = vx + s * (20 + f * f * w * 0.6), th = 20 + f * f * H * 0.6;
          tree(tx, horizon + f * H * 0.3, th, 70 + k * 8);
        }
      }
      x.fillStyle = grey(150, 0.6); x.beginPath(); x.moveTo(vx - 6, horizon); x.lineTo(vx + 6, horizon); x.lineTo(vx + w * 0.4, H); x.lineTo(vx - w * 0.4, H); x.fill();
    } else if (kind === 3) {
      // a tram, a car of the twenties and passers-by in front of the houses
      x.fillStyle = grey(140); x.fillRect(x0, H * 0.15, w, horizon - H * 0.15);
      x.fillStyle = grey(70); for (let wx = x0 + 8; wx < x0 + w; wx += 30) for (let wy = H * 0.2; wy < horizon - 20; wy += 28) x.fillRect(wx, wy, 10, 15);
      const tx = x0 + w * 0.1;
      x.fillStyle = grey(185); x.fillRect(tx, horizon - H * 0.38, 260, H * 0.34);
      x.fillStyle = grey(40); for (let k = 0; k < 7; k++) x.fillRect(tx + 12 + k * 35, horizon - H * 0.33, 24, H * 0.12);
      x.fillStyle = grey(25); x.fillRect(tx, horizon - H * 0.06, 260, 6);
      x.strokeStyle = grey(30); x.lineWidth = 1.5; x.beginPath(); x.moveTo(tx + 130, horizon - H * 0.38); x.lineTo(tx + 160, 0); x.stroke();
      const cx = x0 + w * 0.62;
      x.fillStyle = grey(30);
      x.beginPath(); x.moveTo(cx, H * 0.86); x.lineTo(cx + 10, H * 0.66); x.lineTo(cx + 60, H * 0.64); x.lineTo(cx + 80, H * 0.5); x.lineTo(cx + 150, H * 0.5); x.lineTo(cx + 165, H * 0.66); x.lineTo(cx + 210, H * 0.7); x.lineTo(cx + 212, H * 0.86); x.fill();
      x.fillStyle = grey(200, 0.6); x.fillRect(cx + 88, H * 0.54, 54, H * 0.1);
      for (const wx of [cx + 40, cx + 175]) { x.fillStyle = grey(15); x.beginPath(); x.arc(wx, H * 0.87, 20, 0, Math.PI * 2); x.fill(); x.fillStyle = grey(150); x.beginPath(); x.arc(wx, H * 0.87, 7, 0, Math.PI * 2); x.fill(); }
    }
    // people in the street, here and there
    const n = Math.floor(r() * 6);
    for (let k = 0; k < n; k++) {
      const px = x0 + r() * w, ph = H * (0.2 + r() * 0.25), py = H - r() * H * 0.12;
      x.fillStyle = grey(20 + r() * 40);
      x.fillRect(px - ph * 0.08, py - ph * 0.8, ph * 0.16, ph * 0.55);
      x.fillRect(px - ph * 0.06, py - ph * 0.25, ph * 0.05, ph * 0.25); x.fillRect(px + ph * 0.01, py - ph * 0.25, ph * 0.05, ph * 0.25);
      x.beginPath(); x.arc(px, py - ph * 0.88, ph * 0.08, 0, Math.PI * 2); x.fill();
      if (r() < 0.5) x.fillRect(px - ph * 0.12, py - ph * 0.97, ph * 0.24, ph * 0.03);
    }
    // the print: grain, and darker towards its edges
    speckle(x, W, H, Math.round(w * H / 60), 0.18, Math.floor(r() * 1e6));
    const vig = x.createLinearGradient(x0, 0, x0 + w, 0);
    vig.addColorStop(0, 'rgba(0,0,0,0.35)'); vig.addColorStop(0.15, 'rgba(0,0,0,0)'); vig.addColorStop(0.85, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.35)');
    x.fillStyle = vig; x.fillRect(x0, 0, w, H);
    x.restore();
  };
  let sx = 0, kind = 0;
  while (sx < W) {
    const w = Math.min(W - sx, Math.round((2.2 + r() * 3) * PX));
    scene(sx, W - sx - w < 1.2 * PX ? W - sx : w, kind);
    sx += W - sx - w < 1.2 * PX ? W - sx : w;
    kind = (kind + 1 + Math.floor(r() * 3)) % 4;
  }
  // its panels' joints, every 1.2 m
  x.fillStyle = 'rgba(0,0,0,0.6)';
  for (let k = 1; k < FRIEZE_REPEAT / 1.2; k++) x.fillRect(Math.round(k * 1.2 * PX) - 1, 0, 2, H);
  // (turned: u up, v along; mirrored for the wall that sees the track's direction backwards)
  const [t, tx] = canvas(H, W);
  tx.setTransform(0, mirror ? -1 : 1, -1, 0, H, mirror ? W : 0);
  tx.drawImage(c, 0, 0);
  return toTexture(t);
}

// Karlaplan's platform: dark grey granite slabs, 40 cm, flecked with white and black. Covers 2 × 2 m.
export function karlaplanFloor() {
  const [c, x] = canvas(500);
  x.fillStyle = '#26282a';
  x.fillRect(0, 0, 500, 500);
  const r = rng(13);
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
    const v = 52 + Math.floor(r() * 10);
    x.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    x.fillRect(i * 100 + 1.5, j * 100 + 1.5, 97, 97);
  }
  speckle(x, 500, 500, 9000, 0.35, 14, true);
  speckle(x, 500, 500, 6000, 0.5, 15);
  return toTexture(c);
}

// The pale stone along the platform's edge (a strip of it; the texture covers 2 × 2 m).
export function karlaplanEdge() {
  const [c, x] = canvas(256);
  x.fillStyle = '#d9d7d1';
  x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 3000, 0.12, 17);
  x.fillStyle = 'rgba(80,80,80,0.5)';
  for (let k = 0; k < 4; k++) x.fillRect(0, k * 64, 256, 2);
  return toTexture(c);
}

// The blocks down the middle of Karlaplan's platform: long cream glazed tiles, set upright in
// courses that step half a tile, and a dark brown bay joint at the left. One repeat is
// KARLAPLAN_BAY m across and as high; u across and v up, in repeats.
export const KARLAPLAN_BAY = 2.4;
export function karlaplanBlock() {
  const PX = 160, S = KARLAPLAN_BAY * PX, TW = 0.06 * PX, TH = 0.24 * PX;
  const [c, x] = canvas(S);
  x.fillStyle = '#8f8676';
  x.fillRect(0, 0, S, S);
  const r = rng(67);
  const tones = ['#e6dcc4', '#e1d6bd', '#ebe2cc', '#dcd1b6', '#e4d9c0'];
  for (let j = 0; j * TH < S; j++) {
    const off = (j % 2) * TW / 2;
    for (let i = -1; i * TW < S; i++) {
      x.fillStyle = tones[Math.floor(r() * tones.length)];
      x.fillRect(off + i * TW + 1, j * TH + 1, TW - 2, TH - 2);
      x.fillStyle = 'rgba(255,255,255,0.12)';
      x.fillRect(off + i * TW + 2, j * TH + 2, TW * 0.4, TH - 4);
    }
  }
  x.fillStyle = '#4b3d32';
  x.fillRect(0, 0, 0.14 * PX, S);
  x.fillStyle = 'rgba(255,255,255,0.08)';
  x.fillRect(0.02 * PX, 0, 0.03 * PX, S);
  return toTexture(c);
}

// The station's name along the top of a block, in raised navy capitals, with the ways out at
// either end: `left` and `right`, with their arrows, as seen. `w` × `h` m; transparent elsewhere.
export function karlaplanSign(left: string, right: string, w: number, h: number) {
  const PX = 200, [c, x] = canvas(Math.round(w * PX), Math.round(h * PX));
  x.fillStyle = '#1e2a5a';
  x.textBaseline = 'middle';
  const font = (size: number) => `700 ${Math.round(size * PX)}px "DIN Condensed", "Arial Narrow", Arial, sans-serif`;
  (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(0.03 * PX)}px`;
  x.font = font(h * 0.8);
  x.textAlign = 'center';
  x.fillText('KARLAPLAN', c.width / 2, c.height / 2);
  x.font = font(h * 0.45);
  const tri = (cx: number, dir: number) => {
    const s = h * 0.22 * PX;
    x.beginPath(); x.moveTo(cx + dir * s, c.height / 2); x.lineTo(cx - dir * s, c.height / 2 - s); x.lineTo(cx - dir * s, c.height / 2 + s); x.fill();
  };
  tri(0.2 * PX, -1);
  x.textAlign = 'left'; x.fillText(left, 0.5 * PX, c.height / 2);
  tri(c.width - 0.2 * PX, 1);
  x.textAlign = 'right'; x.fillText(right, c.width - 0.5 * PX, c.height / 2);
  return toTexture(c, { repeat: false });
}

// One of Tor Hörlin's seating niches (1967): lined in long tiles of green stoneware, and above
// the bench a band of tiles in blue, ochre, white and grey, laid in long strokes and chevrons.
// `w` × `h` m.
export function horlinNiche(w: number, h: number, variant: number) {
  const PX = 160, W = Math.round(w * PX), H = Math.round(h * PX);
  const [c, x] = canvas(W, H);
  const r = rng(1967 + variant);
  x.fillStyle = '#3c4a22';
  x.fillRect(0, 0, W, H);
  const greens = ['#6b7f35', '#5f7330', '#768a3c', '#566a2b', '#7d8f45', '#62762f'];
  const TW = 0.24 * PX, TH = 0.06 * PX;
  for (let j = 0; j * TH < H; j++) for (let i = -1; i * TW < W; i++) {
    x.fillStyle = greens[Math.floor(r() * greens.length)];
    x.fillRect((j % 2) * TW / 2 + i * TW + 1, j * TH + 1, TW - 2, TH - 2);
  }
  // the glaze catching the light
  speckle(x, W, H, Math.round(W * H / 200), 0.15, 1968 + variant, true);
  const colours = ['#2b3f7a', '#d9a63a', '#f1ece0', '#9aa3a6', '#3a5590', '#c98f2c', '#e7e1cf'];
  const cy = H * 0.42;
  if (variant % 2) {
    // chevrons pointing along the platform
    for (let k = 0; k < 9; k++) {
      const row = cy + (k - 4) * TH * 1.05, depth = Math.abs(k - 4);
      for (let s = 0; s < 3; s++) {
        x.fillStyle = colours[(k + s * 2) % colours.length];
        x.fillRect(W * 0.18 + depth * TW * 0.6 + s * TW * 1.3, row, TW * (0.8 + r() * 0.6), TH - 2);
      }
    }
  } else {
    // long strokes, stacked and overlapping, like a skyline
    for (let k = 0; k < 26; k++) {
      const bw = TW * (0.6 + r() * 3), bh = TH * (1 + Math.floor(r() * 6));
      const bx = W * 0.1 + r() * (W * 0.8 - bw), by = cy - bh / 2 + (r() - 0.5) * TH * 6;
      x.fillStyle = colours[Math.floor(r() * colours.length)];
      x.fillRect(bx, by, bw, bh);
      x.strokeStyle = 'rgba(30,30,30,0.35)'; x.lineWidth = 1;
      for (let ty = by + TH; ty < by + bh; ty += TH) { x.beginPath(); x.moveTo(bx, ty); x.lineTo(bx + bw, ty); x.stroke(); }
    }
  }
  // shadow in the niche's top, light along its foot
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.2, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.1)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  return toTexture(c, { repeat: false });
}

// ------------------------------------------------------------------ Stadion
// Stadion (1973, src/hall-styles.ts): the platform's floor, large slabs of dark grey stone, 1 m
// square (the texture covers 2 × 2 m).
export function stadionFloor() {
  const [c, x] = canvas(512);
  x.fillStyle = '#8c8c8a'; x.fillRect(0, 0, 512, 512);
  const r = rng(173);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const v = 70 + Math.floor(r() * 10);
    x.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    x.fillRect(i * 256 + 1.5, j * 256 + 1.5, 253, 253);
  }
  speckle(x, 512, 512, 7000, 0.25, 174, true);
  speckle(x, 512, 512, 7000, 0.4, 175);
  return toTexture(c);
}

// The pale stone along its edge (the texture covers 2 × 2 m).
export function stadionEdge() {
  const [c, x] = canvas(256);
  x.fillStyle = '#d8d7d2'; x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 5000, 0.3, 176);
  x.fillStyle = 'rgba(90,90,90,0.4)';
  for (let k = 0; k < 2; k++) x.fillRect(0, k * 128, 256, 1.5);
  return toTexture(c);
}

// The plinth round the pillars: small cream tiles, 0.15 m square (the texture covers 1.2 m); or
// pale grey ones (Tekniska högskolan's); or polished dark granite in slabs 0.6 m long
// (Universitetet's).
export function stadionPlinth(kind?: 'grey' | 'granite') {
  const [c, x] = canvas(384);
  if (kind === 'granite') {
    x.fillStyle = '#3a3c3e'; x.fillRect(0, 0, 384, 384);
    speckle(x, 384, 384, 9000, 0.35, 179); speckle(x, 384, 384, 4000, 0.12, 180, true);
    x.fillStyle = '#2a2b2d'; x.fillRect(0, 0, 384, 2); x.fillRect(0, 0, 2, 384); x.fillRect(192, 0, 2, 384);
    return toTexture(c);
  }
  const grey = kind === 'grey';
  x.fillStyle = grey ? '#8f908d' : '#a9a294'; x.fillRect(0, 0, 384, 384);
  const r = rng(177);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    const v = (grey ? 204 : 222) + Math.floor(r() * 12);
    x.fillStyle = grey ? `rgb(${v},${v},${v - 3})` : `rgb(${v},${v - 6},${v - 22})`;
    x.fillRect(i * 48 + 1.5, j * 48 + 1.5, 45, 45);
  }
  speckle(x, 384, 384, 1500, 0.08, 178);
  return toTexture(c);
}

// The ceiling: black expanded steel mesh between dark beams across the hall every 1.5 m (the
// texture covers 1.5 × 1.5 m, the beam along its top edge: v along the track); or in other
// colours: behind the mesh, its strands and the beams.
export function stadionCeiling(back = '#1e2023', strand = '#4a4d52', beam = '#383a3e') {
  const [c, x] = canvas(256);
  x.fillStyle = back; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = strand; x.lineWidth = 2;
  const p = 12;
  for (let k = -256; k < 512; k += p) {
    x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 256, 256); x.stroke();
    x.beginPath(); x.moveTo(k, 256); x.lineTo(k + 256, 0); x.stroke();
  }
  x.fillStyle = beam; x.fillRect(0, 0, 256, 14);
  x.fillStyle = '#5a5d62'; x.fillRect(0, 14, 256, 2);
  return toTexture(c);
}

// Rock painted black, smoothed but still lumpy: 4.8 m along by the height of a track wall (a
// cave's, from the track's floor up to its ceiling). Or in another colour, mottled with a lighter
// one (CSS colours).
export function blackRock(colors?: [string, string]) {
  const W = 480, H = 520, [c, x] = canvas(W, H), r = rng(1978);
  const light = colors ? [1, 3, 5].map((i) => parseInt(colors[1].slice(i, i + 2), 16)) : null;
  x.fillStyle = colors?.[0] ?? '#161618'; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 900; k++) {
    const cx = r() * W, cy = r() * H, rx = 6 + r() * 26, ry = 4 + r() * 14, v = Math.floor(r() * 26);
    x.fillStyle = light ? (r() < 0.5 ? `rgba(${light.join(',')},${0.12 + r() * 0.3})` : `rgba(0,0,0,${0.08 + r() * 0.14})`)
      : r() < 0.5 ? `rgba(${40 + v},${40 + v},${43 + v},0.35)` : `rgba(4,4,5,${0.25 + r() * 0.3})`;
    for (const dx of [-W, 0, W]) { x.beginPath(); x.ellipse(cx + dx, cy, rx, ry, r() * Math.PI, 0, Math.PI * 2); x.fill(); }
  }
  speckle(x, W, H, 3000, 0.12, 1978);
  return toTexture(c);
}

// A stripe painted along a wall in lengths of colour, from its one end to its other, a thin
// dark line between them.
export function colourStripe(colors: string[]) {
  const W = 1024, H = 8, [c, x] = canvas(W, H), n = colors.length;
  colors.forEach((col, k) => {
    x.fillStyle = col; x.fillRect((k * W) / n, 0, W / n + 1, H);
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect((k * W) / n, 0, 1, H);
  });
  x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, 0, W, 1);
  return toTexture(c, { repeat: false });
}

// Panels of green expanded steel mesh, on posts 1.2 m apart (the texture covers 1.2 × 1.2 m, a
// post along its left edge), the dark rock showing through between the strands; or in other
// colours: the rock behind, the strands and the posts.
export function stadionMesh(back = '#1d3a36', strand = '#5fb3a3', post = '#4fa595') {
  const [c, x] = canvas(256);
  x.fillStyle = back; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = strand; x.lineWidth = 2.6;
  const p = 256 / 24;
  for (let k = -24; k <= 48; k++) {
    x.beginPath(); x.moveTo(k * p, 0); x.lineTo(k * p + 128, 256); x.stroke();
    x.beginPath(); x.moveTo(k * p, 256); x.lineTo(k * p + 128, 0); x.stroke();
  }
  x.fillStyle = post; x.fillRect(0, 0, 9, 256);
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(9, 0, 3, 256);
  return toTexture(c);
}

// How far round from the foot of a cave's paint (caveRock) the pillars' paint starts at the
// platform.
export const STADION_FOOT = 1.6;
const RAINBOW = ['#d8321e', '#ee7a1c', '#f2cf2a', '#4aa83a', '#1f9a8a', '#2f6fd0', '#2a3a9a'];

// The wall over one of the passage's openings, as seen from the passage: the pillars' sky-blue
// rock, and round the opening a rainbow, its seven bands `band` m wide. `w` m along and `h` m up
// from the platform; the opening `inset` in from each end with its crown `crown` high, its arch
// springing from upright sides `spring` high (from the floor, if 0). With `redInside`, the red
// band is the inner one. Without `rainbow`, the rock's paint alone; or, given colours, bands of
// them round the opening, the outer first, in place of the rainbow's.
export function stadionPortal(w: number, h: number, inset: number, crown: number, band: number, redInside: boolean, paint: CavePaint, rainbow: boolean | string[] = true, spring = 0) {
  const PX = 48, W = Math.round(w * PX), H = Math.round(h * PX);
  const [c, x] = canvas(W, H);
  // the rock's paint, as on the pillars, upright (its foot, darkened by the track's dust, below
  // the platform)
  const rock = caveRock(paint).image as HTMLCanvasElement;
  x.save(); x.translate(0, H + STADION_FOOT * PX); x.rotate(-Math.PI / 2);
  for (let k = 0; k * CAVE_REPEAT * PX < W; k++) x.drawImage(rock, 0, k * CAVE_REPEAT * PX);
  x.restore();
  // the rainbow: the opening's half ellipse, grown band by band, the outer band first
  const hw = w / 2 - inset, mid = w / 2;
  x.setTransform(PX, 0, 0, -PX, 0, H);
  const colours = Array.isArray(rainbow) ? rainbow : !rainbow ? [] : redInside ? [...RAINBOW].reverse() : RAINBOW;
  const r = rng(179), ph = [r() * 6, r() * 6];
  for (let k = colours.length; k >= 1; k--) {
    x.fillStyle = colours[colours.length - k];
    x.beginPath();
    const n = 90;
    for (let i = 0; i <= n; i++) {
      // (wavering a little, as brushed over the lumps)
      const t = Math.PI * (i / n), wob = 1 + 0.025 * Math.sin(t * 7 + ph[0] + k * 0.3) + 0.015 * Math.sin(t * 17 + ph[1]);
      const s = mid - Math.cos(t) * (hw + k * band) * wob, y = spring + Math.sin(t) * (crown - spring + k * band) * wob;
      if (i) x.lineTo(s, y); else x.moveTo(s, -0.1);
    }
    x.lineTo(mid + hw + k * band, -0.1); x.closePath(); x.fill();
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  // light on its lumps over the paint, so that it is painted on the rock
  rockShade(x, W, H, Math.round(w * h * 1.5), '255,255,255', 0.16, PX * 0.6, r);
  rockShade(x, W, H, Math.round(w * h * 1.5), '0,0,0', 0.18, PX * 0.6, r);
  return toTexture(c, { repeat: false });
}

// Upright stripes painted in turn of these colours over a panel of rock, `n` of them across it, a
// little uneven as brushed over its lumps (Mörby centrum's, by the escalators): the whole panel.
export function rockStripes(colors: string[], n: number) {
  const W = 64 * n, H = 512, [c, x] = canvas(W, H), r = rng(1978 + n);
  for (let k = 0; k < n; k++) {
    x.fillStyle = colors[k % colors.length];
    x.beginPath(); x.moveTo(k * 64 - 1, 0);
    for (let y = 0; y <= H; y += 32) x.lineTo(k * 64 - 1 + (r() - 0.5) * 3, y);
    for (let y = H; y >= 0; y -= 32) x.lineTo((k + 1) * 64 + 1 + (r() - 0.5) * 3, y);
    x.closePath(); x.fill();
  }
  rockShade(x, W, H, n * 40, '255,255,255', 0.14, 26, r);
  rockShade(x, W, H, n * 40, '0,0,0', 0.18, 26, r);
  return toTexture(c, { repeat: false });
}

// The poster of the Olympic games of 1912 (Olle Hjortzberg's), between two pillars of grey stone:
// a naked athlete waving a banner over a procession of the nations' flags, a swirl of blue and
// yellow behind him, on gold, with its title below. 2.6 × 3.0 m.
export function olympicPoster() {
  const W = 520, H = 600, [c, x] = canvas(W, H);
  const r = rng(1912);
  // the stone either side, and the poster between them
  for (const sx of [0, W - 70]) {
    x.fillStyle = '#b9b9b6'; x.fillRect(sx, 0, 70, H);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.2})`; x.fillRect(sx + r() * 70, r() * H, 1 + r() * 10, 1 + r() * 30); }
  }
  const px = 72, pw = W - 144, py = 20, ph = H - 30;
  x.fillStyle = '#c99a3a'; x.fillRect(px, py, pw, ph);
  // the picture
  const ix = px + 10, iy = py + 10, iw = pw - 20, ih = ph * 0.64;
  x.save(); x.beginPath(); x.rect(ix, iy, iw, ih); x.clip();
  x.fillStyle = '#e8e2d2'; x.fillRect(ix, iy, iw, ih);
  // the swirl
  const cx = ix + iw * 0.62, cy = iy + ih * 0.42;
  for (const [rad, col] of [[200, '#1f4fa0'], [170, '#f0c828'], [140, '#2c64b8'], [112, '#f2d548'], [86, '#1f4fa0'], [60, '#e8e2d2']] as const) {
    x.fillStyle = col; x.beginPath(); x.arc(cx, cy, rad, 0, Math.PI * 2); x.fill();
  }
  // the flags, along the left and the foot
  const flag = (fx: number, fy: number, a: number, s: number, kind: number) => {
    x.save(); x.translate(fx, fy); x.rotate(a);
    const fw = 70 * s, fh = 46 * s;
    if (kind === 0) { x.fillStyle = '#2c5fb0'; x.fillRect(0, 0, fw, fh); x.fillStyle = '#f2cf2a'; x.fillRect(fw * 0.3, 0, fh * 0.2, fh); x.fillRect(0, fh * 0.4, fw, fh * 0.2); }
    else if (kind === 1) { for (let k = 0; k < 7; k++) { x.fillStyle = k % 2 ? '#f4f0e6' : '#c8302a'; x.fillRect(0, (k * fh) / 7, fw, fh / 7 + 1); } x.fillStyle = '#28408a'; x.fillRect(0, 0, fw * 0.4, fh * 0.55); }
    else if (kind === 2) { ['#28408a', '#f4f0e6', '#c8302a'].forEach((col, k) => { x.fillStyle = col; x.fillRect((k * fw) / 3, 0, fw / 3 + 1, fh); }); }
    else if (kind === 3) { x.fillStyle = '#f4f0e6'; x.fillRect(0, 0, fw, fh); x.fillStyle = '#c8302a'; x.fillRect(fw * 0.42, 0, fw * 0.16, fh); x.fillRect(0, fh * 0.38, fw, fh * 0.24); }
    else { x.fillStyle = '#c8302a'; x.fillRect(0, 0, fw, fh); x.fillStyle = '#f4f0e6'; x.fillRect(fw * 0.4, fh * 0.2, fw * 0.2, fh * 0.6); x.fillRect(fw * 0.25, fh * 0.4, fw * 0.5, fh * 0.2); }
    x.restore();
  };
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    flag(ix - 10 + (t < 0.5 ? r() * 60 : (t - 0.5) * 2 * iw * 0.9), t < 0.5 ? iy + t * 2 * ih * 0.8 : iy + ih * (0.72 + r() * 0.15), (r() - 0.5) * 1.2, 0.8 + r() * 0.6, Math.floor(r() * 5));
  }
  // the athlete, his arm raised with the banner's staff
  x.fillStyle = '#b48a5a'; x.strokeStyle = '#6a4a2a'; x.lineWidth = 2;
  const fx = ix + iw * 0.55, fy = iy + ih * 0.2;
  x.beginPath(); x.arc(fx, fy, 16, 0, Math.PI * 2); x.fill(); x.stroke();
  x.beginPath();
  x.moveTo(fx - 22, fy + 22); x.lineTo(fx + 24, fy + 22); x.lineTo(fx + 20, fy + 110); x.lineTo(fx + 36, fy + 230); x.lineTo(fx + 22, fy + 232);
  x.lineTo(fx + 2, fy + 130); x.lineTo(fx - 16, fy + 232); x.lineTo(fx - 30, fy + 228); x.lineTo(fx - 18, fy + 110); x.closePath(); x.fill(); x.stroke();
  x.lineWidth = 12; x.strokeStyle = '#b48a5a'; x.lineCap = 'round';
  x.beginPath(); x.moveTo(fx + 20, fy + 28); x.lineTo(fx + 48, fy - 10); x.lineTo(fx + 62, fy - 42); x.stroke();
  x.beginPath(); x.moveTo(fx - 20, fy + 28); x.lineTo(fx - 30, fy + 80); x.lineTo(fx - 24, fy + 120); x.stroke();
  x.strokeStyle = '#3a3a3a'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(fx + 62, fy - 42); x.lineTo(fx + 140, fy + 30); x.stroke();
  // the ribbon round them
  x.strokeStyle = '#d8902a'; x.lineWidth = 7;
  x.beginPath(); x.moveTo(ix, iy + ih * 0.45); x.bezierCurveTo(ix + iw * 0.3, iy + ih * 0.3, ix + iw * 0.5, iy + ih * 0.6, ix + iw, iy + ih * 0.55); x.stroke();
  x.restore();
  // the title
  x.fillStyle = '#f4ead0'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.font = '600 40px Georgia, "Times New Roman", serif';
  x.fillText('OLYMPISKA SPELEN', W / 2, iy + ih + 58, pw - 20);
  x.font = '600 32px Georgia, "Times New Roman", serif';
  x.fillText('STOCKHOLM 1912', W / 2, iy + ih + 102, pw - 40);
  x.font = '600 22px Georgia, "Times New Roman", serif';
  x.fillText('29 JUNI — 22 JULI', W / 2, iy + ih + 136, pw - 60);
  return toTexture(c, { repeat: false });
}

// A panel of painted flowers, red poppies and orange blooms among green leaves, in the shape of a
// long hexagon, its two halves set at a slight angle; with a strip of turquoise sky along its top.
// 3.6 × 2.2 m; clear outside it.
export function stadionFlowers() {
  const W = 720, H = 440, [c, x] = canvas(W, H);
  const r = rng(1973);
  x.beginPath(); x.moveTo(0, H / 2); x.lineTo(W * 0.18, 0); x.lineTo(W * 0.82, 0); x.lineTo(W, H / 2); x.lineTo(W * 0.82, H); x.lineTo(W * 0.18, H); x.closePath();
  x.save(); x.clip();
  x.fillStyle = '#1f6a2c'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#6ac8c0'; x.fillRect(0, 0, W, 34);
  for (let i = 0; i < 260; i++) {
    x.fillStyle = ['#2f8a3a', '#4aa83a', '#17501f', '#7ab84a'][Math.floor(r() * 4)];
    x.save(); x.translate(r() * W, 30 + r() * H); x.rotate(r() * Math.PI);
    x.beginPath(); x.ellipse(0, 0, 10 + r() * 18, 4 + r() * 6, 0, 0, Math.PI * 2); x.fill(); x.restore();
  }
  for (let i = 0; i < 46; i++) {
    const fx = r() * W, fy = 40 + r() * (H - 40), rad = 10 + r() * 24, col = r() < 0.6 ? '#e2321e' : r() < 0.6 ? '#f07a1a' : '#f2c428';
    for (let k = 0; k < 5; k++) {
      x.fillStyle = col; x.beginPath();
      x.ellipse(fx + Math.cos((k * Math.PI * 2) / 5) * rad * 0.45, fy + Math.sin((k * Math.PI * 2) / 5) * rad * 0.45, rad * 0.6, rad * 0.45, (k * Math.PI * 2) / 5, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = '#2a1a10'; x.beginPath(); x.arc(fx, fy, rad * 0.22, 0, Math.PI * 2); x.fill();
  }
  // the fold between its halves
  const g = x.createLinearGradient(W * 0.5 - 30, 0, W * 0.5 + 30, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.3)'); g.addColorStop(0.52, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(W * 0.5 - 30, 0, 60, H);
  x.restore();
  return toTexture(c, { repeat: false });
}

// A round plaque, 0.55 m across, with a sports club's badge: a shield in its colours with its
// initials, on white, rimmed in brass (`club` picks one of several).
export function clubBadge(club: number) {
  const clubs: [string, string[], string][] = [
    ['D.I.F.', ['#2c5fb0', '#f2cf2a', '#c8302a'], '#f2cf2a'], ['AIK', ['#1a1a1a', '#f2cf2a'], '#f2cf2a'],
    ['HIF', ['#1f7a3a', '#f4f4f0'], '#f4f4f0'], ['IFK', ['#2c5fb0', '#f4f4f0'], '#f4f4f0'], ['S.K.', ['#c8302a', '#f4f4f0'], '#f4f4f0'],
  ];
  const [name, cols, ink] = clubs[club % clubs.length];
  const [c, x] = canvas(128);
  x.clearRect(0, 0, 128, 128);
  x.fillStyle = '#b08a3a'; x.beginPath(); x.arc(64, 64, 63, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#f2efe6'; x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fill();
  x.save();
  x.beginPath(); x.moveTo(30, 24); x.lineTo(98, 24); x.lineTo(98, 66); x.quadraticCurveTo(98, 96, 64, 108); x.quadraticCurveTo(30, 96, 30, 66); x.closePath(); x.clip();
  cols.forEach((col, k) => { x.fillStyle = col; x.save(); x.translate(64, 64); x.rotate(-0.7); x.fillRect(-80, -80 + (k * 160) / cols.length, 160, 160 / cols.length + 1); x.restore(); });
  x.restore();
  x.fillStyle = ink; x.strokeStyle = '#1a1a1a'; x.lineWidth = 3;
  x.font = '900 24px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.strokeText(name, 64, 62, 64); x.fillText(name, 64, 62, 64);
  return toTexture(c, { repeat: false });
}

// A coloured arrow pointing the way out, to the right: in bands of red to yellow, or in blocks of
// blue, red and yellow. 2 × 1 m; clear outside it.
export function stadionArrow(blocks: boolean) {
  const W = 256, H = 128, [c, x] = canvas(W, H);
  x.clearRect(0, 0, W, H);
  x.beginPath(); x.moveTo(4, 44); x.lineTo(160, 44); x.lineTo(160, 8); x.lineTo(252, 64); x.lineTo(160, 120); x.lineTo(160, 84); x.lineTo(4, 84); x.closePath();
  x.save(); x.clip();
  if (blocks) {
    ['#2f6fd0', '#d8321e', '#f2c428', '#2f6fd0', '#d8321e'].forEach((col, k) => { x.fillStyle = col; x.fillRect(k * 52, 0, 53, H); });
  } else {
    RAINBOW.slice(0, 3).forEach((col, k) => { x.fillStyle = col; x.fillRect(0, (k * H) / 3, W, H / 3 + 1); });
  }
  x.restore();
  x.strokeStyle = 'rgba(30,30,30,0.6)'; x.lineWidth = 3; x.stroke();
  return toTexture(c, { repeat: false });
}

// ------------------------------------------------------------------ Tekniska högskolan's hall
// Lennart Mörk's art (1973) on the cores of rock down the island platform, from photographs
// (Wikimedia Commons, 2005–2025): the rock modelled in pale grey folds; on the north-western end of
// the north-western core a great round disc ringed like a lens in a dark crater, fields of dots
// curving away from it; on the south-eastern end of the other, and along the cores' sides, the
// machines of the sciences in relief, with a figure and a net of red and blue lines. Each is drawn
// on the pale grey of the rock, which shows round its ragged edge.

// the pale grey rock, mottled, with darker folds, `w` × `h` m at `PX` px a metre
function morkRock(x: CanvasRenderingContext2D, W: number, H: number, PX: number, r: () => number) {
  x.fillStyle = '#c4c0b8'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < (W * H) / (PX * PX) * 6; i++) {
    const cx = r() * W, cy = r() * H, rad = (0.2 + r() * 0.6) * PX, light = r() < 0.5;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, light ? 'rgba(232,229,222,0.5)' : 'rgba(150,145,136,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(cx - rad, cy - rad, 2 * rad, 2 * rad);
  }
  x.lineCap = 'round';
  for (let i = 0; i < (W / PX) * 3; i++) {
    let px = r() * W, py = H, a = -Math.PI / 2 + (r() - 0.5) * 0.6;
    x.strokeStyle = r() < 0.3 ? 'rgba(130,104,80,0.35)' : 'rgba(110,106,100,0.3)';
    x.lineWidth = (0.03 + r() * 0.06) * PX;
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 30; k++) { a += (r() - 0.5) * 0.4; px += Math.cos(a) * 0.1 * PX; py += Math.sin(a) * 0.1 * PX; x.lineTo(px, py); }
    x.stroke();
  }
}
// cut the picture to a ragged outline, so that the rock round it shows through
function raggedEdge(x: CanvasRenderingContext2D, W: number, H: number, PX: number, r: () => number) {
  x.globalCompositeOperation = 'destination-in';
  x.fillStyle = '#000';
  x.beginPath();
  const n = 80, m = 0.25 * PX, ph = r() * 6;
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * Math.PI * 2, rx = W / 2 - m * (0.6 + 0.4 * Math.sin(t * 5 + ph)), ry = H / 2 - m * (0.6 + 0.4 * Math.sin(t * 7 + ph));
    const c = Math.cos(t), s = Math.sin(t), e = 6;
    const px = W / 2 + rx * Math.sign(c) * Math.abs(c) ** (2 / e), py = H / 2 + ry * Math.sign(s) * Math.abs(s) ** (2 / e);
    if (k) x.lineTo(px, py); else x.moveTo(px, py);
  }
  x.closePath(); x.fill();
  x.globalCompositeOperation = 'source-over';
}

// The disc on the north-western core's end: ringed like a lens, 1.7 m across, in a dark crater, and
// round it fields of dots in curving lines. 6.4 × 2.6 m.
export function tekniskaEye() {
  const PX = 100, W = 640, H = 260, [c, x] = canvas(W, H);
  const r = rng(1973);
  morkRock(x, W, H, PX, r);
  const cx = W * 0.4, cy = H * 0.52;
  // the dots, in lines curving out from round the crater
  for (let k = 0; k < 26; k++) {
    const a0 = (k / 26) * Math.PI * 2 + r() * 0.2, bend = 0.5 + r() * 0.5, len = 1.4 + r() * 2.2;
    x.fillStyle = 'rgba(52,50,48,0.8)';
    for (let d = 1.3; d < 1.3 + len; d += 0.07) {
      const a = a0 + bend * (d - 1.3) / len, px = cx + Math.cos(a) * d * PX * 1.25, py = cy + Math.sin(a) * d * PX * 0.62;
      if (px < 0 || px > W || py < 0 || py > H) continue;
      x.beginPath(); x.arc(px, py, (0.012 + r() * 0.01) * PX, 0, Math.PI * 2); x.fill();
    }
  }
  // the crater, dark round the disc
  const cr = x.createRadialGradient(cx, cy, 0.8 * PX, cx, cy, 1.35 * PX);
  cr.addColorStop(0, 'rgba(58,56,53,0.95)'); cr.addColorStop(0.55, 'rgba(90,87,82,0.7)'); cr.addColorStop(1, 'rgba(90,87,82,0)');
  x.fillStyle = cr; x.beginPath(); x.arc(cx, cy, 1.35 * PX, 0, Math.PI * 2); x.fill();
  // the disc, ringed, lit from above
  const R = 0.85 * PX, g = x.createLinearGradient(cx, cy - R, cx, cy + R);
  g.addColorStop(0, '#a19d96'); g.addColorStop(1, '#6f6b65');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
  x.lineWidth = 1.3;
  for (let rad = 0.08; rad < 0.85; rad += 0.065) {
    x.strokeStyle = 'rgba(50,48,45,0.55)'; x.beginPath(); x.arc(cx, cy, rad * PX, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(220,216,208,0.25)'; x.beginPath(); x.arc(cx, cy - 1, rad * PX, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
  }
  x.fillStyle = '#3c3a37';
  for (const [dx, dy] of [[-0.18, -0.1], [0.12, -0.2], [0.2, 0.12], [-0.08, 0.2]]) { x.beginPath(); x.arc(cx + dx * PX, cy + dy * PX, 0.035 * PX, 0, Math.PI * 2); x.fill(); }
  raggedEdge(x, W, H, PX, r);
  return toTexture(c, { repeat: false });
}

// Machines of the sciences in relief on the pale rock: wheels and gears, levers and rods, boxes;
// with `figure`, a standing figure at the left and a net of red and blue lines (a map's
// projection) over the middle. 7 × 2.3 m.
export function tekniskaRelief(figure: boolean, seed: number) {
  const PX = 90, W = 630, H = 207, [c, x] = canvas(W, H);
  const r = rng(seed);
  morkRock(x, W, H, PX, r);
  // each raised shape: its shadow below and to the right, its lit edge above and to the left
  const raised = (path: () => void) => {
    x.save(); x.translate(3, 4); path(); x.fillStyle = 'rgba(70,66,60,0.55)'; x.fill(); x.restore();
    x.save(); x.translate(-1.5, -2); path(); x.fillStyle = 'rgba(245,243,238,0.6)'; x.fill(); x.restore();
    path(); x.fillStyle = '#bdb9b1'; x.fill();
  };
  const gear = (gx: number, gy: number, rad: number, teeth: number) => raised(() => {
    x.beginPath();
    for (let k = 0; k <= teeth * 2; k++) {
      const a = (k / (teeth * 2)) * Math.PI * 2, rr = k % 2 ? rad : rad * 1.14;
      x.lineTo(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr);
    }
    x.closePath();
  });
  const rect = (rx: number, ry: number, rw: number, rh: number, a = 0) => raised(() => {
    x.beginPath(); x.save(); x.translate(rx, ry); x.rotate(a); x.rect(-rw / 2, -rh / 2, rw, rh); x.restore();
  });
  const x0 = figure ? W * 0.18 : 0.3 * PX;
  for (let gx = x0; gx < W - 0.4 * PX;) {
    const kind = r();
    if (kind < 0.4) { const rad = (0.2 + r() * 0.35) * PX; gear(gx + rad, H * (0.45 + r() * 0.3), rad, 10 + Math.floor(r() * 10)); gx += rad * 2 + 0.15 * PX; }
    else if (kind < 0.7) { const len = (0.8 + r() * 1.2) * PX; rect(gx + len / 2, H * (0.4 + r() * 0.35), len, 0.09 * PX, (r() - 0.5) * 0.6); gx += len * 0.8; }
    else { const bw = (0.35 + r() * 0.5) * PX, bh = (0.3 + r() * 0.5) * PX; rect(gx + bw / 2, H * 0.62, bw, bh); gx += bw + 0.1 * PX; }
  }
  if (figure) {
    // the net, over the middle
    x.lineWidth = 1.4;
    const nx = W * 0.62, ny = H * 0.3, rw = 1.5 * PX, rh = 0.5 * PX;
    for (let k = -4; k <= 4; k++) {
      x.strokeStyle = k % 2 ? 'rgba(196,52,40,0.85)' : 'rgba(46,88,170,0.85)';
      x.beginPath(); x.ellipse(nx, ny, Math.abs(k) / 4 * rw + 2, rh, 0, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.moveTo(nx - rw, ny + (k / 4) * rh); x.quadraticCurveTo(nx, ny + (k / 4) * rh * 1.3, nx + rw, ny + (k / 4) * rh); x.stroke();
    }
    // the figure, standing
    const fx = W * 0.09, fy = H * 0.9, s = 0.95 * PX;
    x.fillStyle = '#8a6a50';
    x.beginPath(); x.arc(fx, fy - s * 1.65, s * 0.13, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(fx - s * 0.22, fy - s * 1.45); x.lineTo(fx + s * 0.22, fy - s * 1.45); x.lineTo(fx + s * 0.18, fy - s * 0.8);
    x.lineTo(fx + s * 0.12, fy); x.lineTo(fx - s * 0.12, fy); x.lineTo(fx - s * 0.18, fy - s * 0.8); x.closePath(); x.fill();
  }
  raggedEdge(x, W, H, PX, r);
  return toTexture(c, { repeat: false });
}

// The diagram inlaid in the floor under the dodecahedron: in pale brass, an octagon and a circle in
// it, rings of dark and pale stone at its middle, and from there lines in the colours of the
// spectrum, as light split by a prism. 6 m square, transparent round it.
export function tekniskaInlay() {
  const S = 1024, PX = S / 6, [c, x] = canvas(S, S);
  x.clearRect(0, 0, S, S);
  x.translate(S / 2, S / 2); x.scale(PX, PX);
  const brass = '#cdbd8e';
  x.strokeStyle = brass; x.lineWidth = 0.035;
  const oct = (rad: number) => {
    x.beginPath();
    for (let k = 0; k <= 8; k++) { const a = Math.PI / 8 + (k / 8) * Math.PI * 2; if (k) x.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); else x.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    x.stroke();
  };
  oct(2.6); oct(2.35);
  x.beginPath(); x.arc(0, 0, 1.55, 0, Math.PI * 2); x.stroke();
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k / 8) * Math.PI * 2;
    x.beginPath(); x.moveTo(Math.cos(a) * 2.35, Math.sin(a) * 2.35); x.lineTo(Math.cos(a + Math.PI / 8) * 1.55, Math.sin(a + Math.PI / 8) * 1.55); x.stroke();
  }
  // the spectrum, from the middle out past the octagon
  ['#7a3fb0', '#2f5fd0', '#2f9a5a', '#f0d030', '#f08a20', '#d83020'].forEach((col, k) => {
    const a = 0.45 + k * 0.055;
    x.strokeStyle = col; x.lineWidth = 0.05;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 2.95, Math.sin(a) * 2.95); x.stroke();
  });
  // the ray coming in
  x.strokeStyle = brass; x.lineWidth = 0.035;
  x.beginPath(); x.moveTo(-2.95 * Math.cos(0.5), -2.95 * Math.sin(0.5)); x.lineTo(0, 0); x.stroke();
  for (let k = 7; k >= 1; k--) {
    x.fillStyle = k % 2 ? '#2b2b2d' : '#a5a4a0';
    x.beginPath(); x.arc(0, 0, k * 0.1, 0, Math.PI * 2); x.fill();
  }
  return toTexture(c, { repeat: false });
}

// ------------------------------------------------------------------ Farsta strand's hall
// (src/hall-styles.ts)

// The track walls, from the floor beside the track up to the ceiling, `height` m: dark concrete
// between paler pilasters 0.8 m wide, every FS_WALL_REPEAT m, under a beam along the top; along
// them three steel rails on posts; below, a plinth of paler concrete in cast lengths, `plinth` m
// high. Turned for a sweep along the track, as Hötorget's: u up the wall, v along the track.
export const FS_WALL_REPEAT = 5.4;
export function farstaStrandWall(height: number, plinth: number, rails: number[], beam: [number, number]) {
  const PX = 64, W = Math.round(FS_WALL_REPEAT * PX), H = Math.round(height * PX), [src, x] = canvas(W, H);
  const r = rng(1971), Y = (h: number) => H - h * PX;
  // the recesses between the pilasters, in shadow
  x.fillStyle = '#2b2d2c'; x.fillRect(0, 0, W, H);
  speckle(x, W, H, 2500, 0.1, 71);
  // the pilasters, at the repeat's ends, and the beam over them
  for (const [x0, x1] of [[0, 0.4], [FS_WALL_REPEAT - 0.4, FS_WALL_REPEAT]]) {
    x.fillStyle = '#5b5c59'; x.fillRect(x0 * PX, Y(beam[0]), (x1 - x0) * PX, (beam[0] - plinth) * PX);
  }
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0.4 * PX, Y(beam[0]), 0.06 * PX, (beam[0] - plinth) * PX);
  x.fillRect((FS_WALL_REPEAT - 0.46) * PX, Y(beam[0]), 0.06 * PX, (beam[0] - plinth) * PX);
  x.fillStyle = '#5f605d'; x.fillRect(0, Y(beam[1]), W, (beam[1] - beam[0]) * PX);
  x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(0, Y(beam[0]), W, 0.05 * PX);
  x.fillStyle = '#232524'; x.fillRect(0, 0, W, Y(beam[1]));
  // the plinth, in lengths with joints between
  x.fillStyle = '#676863'; x.fillRect(0, Y(plinth), W, plinth * PX);
  for (let k = 0; k < 4; k++) {
    x.fillStyle = css(0x676863, Math.floor(r() * 12) - 6); x.fillRect(k * W / 4 + 2, Y(plinth) + 2, W / 4 - 4, plinth * PX - 2);
  }
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, Y(plinth), W, 0.04 * PX);
  speckle(x, W, H, 1800, 0.08, 72, true);
  // the rails, on posts at the pilasters and between them
  const top = rails[rails.length - 1] + 0.12;
  for (const px of [0.2, FS_WALL_REPEAT / 2, FS_WALL_REPEAT - 0.2]) {
    x.fillStyle = '#3e3832'; x.fillRect(px * PX - 2, Y(top), 4, (top - rails[0] + 0.1) * PX);
  }
  for (const h of rails) {
    x.fillStyle = '#6b5d4f'; x.fillRect(0, Y(h + 0.07), W, 0.07 * PX);
    x.fillStyle = '#2a2420'; x.fillRect(0, Y(h), W, 0.025 * PX);
  }
  const [c, y] = canvas(H, W);
  // (along, up) → (up from the left, along)
  y.setTransform(0, 1, -1, 0, H, 0);
  y.drawImage(src, 0, 0);
  return toTexture(c);
}

// The ceiling: panels of dark grey perforated steel, 1.2 m along by 2.4 m across, in a grid of
// thin pale joints, on steel beams across every 2.4 m (the texture covers 2.4 × 2.4 m, u across,
// v along, a beam along its top edge).
export function perforatedCeiling() {
  const N = 384, PX = N / 2.4, [c, x] = canvas(N);
  x.fillStyle = '#585c5e'; x.fillRect(0, 0, N, N);
  // the holes, a fine dark grain
  x.fillStyle = '#3c3f41';
  for (let j = 2; j < N; j += 4) for (let i = (j % 8 === 2 ? 0 : 2); i < N; i += 4) x.fillRect(i, j, 1.6, 1.6);
  // each panel a little lighter or darker than the next
  const r = rng(1971);
  for (let j = 0; j < 2; j++) {
    x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + r() * 0.04})`; x.fillRect(0, j * 1.2 * PX, N, 1.2 * PX);
  }
  x.fillStyle = '#6c7072';
  x.fillRect(0, 1.2 * PX - 1, N, 2); x.fillRect(0, 0, 2, N); x.fillRect(N - 2, 0, 2, N);
  // the beam
  x.fillStyle = '#5a5e61'; x.fillRect(0, 0, N, 0.1 * PX);
  x.fillStyle = '#7d8184'; x.fillRect(0, 0.1 * PX, N, 2);
  return toTexture(c);
}

// Danderyds sjukhus's ceiling over the platform: grey-brown expanded metal, its strands catching
// the light in small diamonds, the dark void showing through them, in panels between steel
// profiles (the texture covers 1.8 m across the platform, u, by 2.5 m along it, v).
export function meshCeiling() {
  const PX = 160, W = Math.round(1.8 * PX), H = Math.round(2.5 * PX), [c, x] = canvas(W, H);
  x.fillStyle = '#34322f'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#8e8a83'; x.lineWidth = 2.2;
  const dx = 0.06 * PX, dy = 0.03 * PX;
  for (let j = 0; j * dy < H; j++) {
    x.beginPath();
    for (let i = 0; i * dx <= W; i++) {
      const px = i * dx + (j % 2 ? dx / 2 : 0), py = j * dy;
      x.moveTo(px - dx / 2, py); x.lineTo(px, py + dy / 2); x.lineTo(px + dx / 2, py);
    }
    x.stroke();
  }
  // each panel a shade off the next, the profiles round them
  const r = rng(1978);
  x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + r() * 0.04})`; x.fillRect(0, 0, W, H / 2);
  x.fillStyle = '#8c8f92'; x.fillRect(0, 0, 4, H); x.fillRect(0, 0, W, 3); x.fillRect(0, H / 2 - 1, W, 2);
  x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(4, 0, 2, H);
  return toTexture(c);
}

// The columns' cladding: small tiles, 5 × 10 cm, in greys, stacked in columns with dark joints (the
// texture covers 1 × 1 m, u round the column, v up it).
export function mosaicColumn() {
  const N = 400, PX = N, [c, x] = canvas(N), r = rng(1972);
  x.fillStyle = '#4d5150'; x.fillRect(0, 0, N, N);
  const w = 0.05 * PX, h = 0.1 * PX;
  for (let i = 0; i < N / w; i++) for (let j = 0; j < N / h; j++) {
    x.fillStyle = css(0x7b7f7e, Math.floor(r() * 18) - 9);
    x.fillRect(i * w + 1, j * h + 1, w - 2, h - 2);
  }
  return toTexture(c);
}

// ------------------------------------------------------------------ Skanstull's hall
// (src/hall-styles.ts)

// The track walls, from the floor beside the track up to the ceiling, `height` m: small square
// tiles, `tile` m, in `color` (each a shade lighter or darker, a few crazed), from `from` up; below
// them a black band down to the floor; and along them posters in thin steel frames, `run` of them
// `every` m apart, then `gap` m of bare tiles, three such groups to a repeat (heights from the
// floor). The posters are made up: a pale ground, a block of colour, lines of type. Turned for a
// sweep along the track, as Hötorget's: u up the wall, v along the track. Rådmansgatan's: the
// tiles stop a plain band `top` m deep under the ceiling, and a dark plate with the station's name
// hangs in the middle of each gap, its middle `plate.at` m up, turned for the wall that sees the
// track's direction the other way round with `mirror`. Blackeberg's (`trees`, Ruben Heleander's
// walls of 1987): the tunnel's rock left standing out of them in dark outcrops from the floor,
// up to a little over the platform here and nearly to the ceiling there, rather than the black
// band, and thin pale trees drawn on the tiles between them, trunks with a few branches.
// Danderyds sjukhus's (`enamel`): white enamel panels from the black band up to `enamel.top`, in
// `rows` rows of panels `width` long, with Klara Källström's photographs of 2008 printed across
// them: tree trunks standing in the light, the long shadows of trees falling across the panels in
// pairs of black stripes, and people in greens, standing, walking or on the phone; above them
// the box's concrete, board-marked aslant, up to the ceiling.
type Posters = { width: number; height: number; bottom: number; every: number; run: number; gap: number };
export const beamedWallRepeat = (p: Posters) => 3 * (p.run * p.every + p.gap);
export function beamedHallWall(height: number, color: number, tile: number, from: number, posters: Posters,
  { top = 0, plate, mirror = false, trees = false, enamel }: { top?: number; plate?: { name: string; at: number }; mirror?: boolean; trees?: boolean; enamel?: { top: number; rows: number; width: number } } = {}) {
  const repeat = beamedWallRepeat(posters);
  const PX = 64, W = Math.round(repeat * PX), H = Math.round(height * PX), [src, x] = canvas(W, H);
  const r = rng(1933), Y = (h: number) => H - h * PX;
  // the tiles, in grey joints
  x.fillStyle = css(color, -46); x.fillRect(0, 0, W, Y(from));
  const n = Math.round(repeat / tile), t = W / n;
  for (let i = 0; i < n; i++) for (let j = 0; (j * tile) < height - from; j++) {
    x.fillStyle = css(color, Math.floor(r() * 12) - 6);
    x.fillRect(i * t + 0.7, Y(from + (j + 1) * tile) + 0.7, t - 1.4, tile * PX - 1.4);
  }
  // a sheen across them, and the grime of ninety years low down
  const g = x.createLinearGradient(0, Y(from + 1.2), 0, Y(from));
  g.addColorStop(0, 'rgba(90,80,60,0)'); g.addColorStop(1, 'rgba(90,80,60,0.12)');
  x.fillStyle = g; x.fillRect(0, Y(from + 1.2), W, 1.2 * PX);
  if (trees) {
    // the trees: a trunk leaning a little, thinning upwards, and a few branches off it, each
    // forking once
    x.strokeStyle = 'rgba(232,234,222,0.85)'; x.lineCap = 'round';
    const branch = (x0: number, y0: number, a: number, l: number, w: number, depth: number) => {
      const x1 = x0 + Math.sin(a) * l, y1 = y0 - Math.cos(a) * l;
      x.lineWidth = w; x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * l * 0.2, (y0 + y1) / 2, x1, y1); x.stroke();
      if (depth > 0) for (const s of [-1, 1]) branch(x1, y1, a + s * (0.35 + r() * 0.35), l * (0.45 + r() * 0.25), Math.max(1, w * 0.6), depth - 1);
    };
    for (let along = 1.5 + r() * 2; along < repeat - 1; along += 3 + r() * 4.5) {
      const x0 = along * PX, y0 = Y(from + 0.2 + r() * 0.4), top = Y(height - 0.3 - r() * 0.6), lean = (r() - 0.5) * 0.12;
      let px = x0, py = y0;
      for (let k = 0; k < 8; k++) {
        const ny = y0 + ((top - y0) * (k + 1)) / 8, nx = x0 + (ny - y0) * -lean + (r() - 0.5) * 3;
        x.lineWidth = 3.2 - k * 0.3; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
        if (k >= 3 && r() < 0.55) branch(nx, ny, (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5), (0.4 + r() * 0.5) * PX, 1.6, 1);
        px = nx; py = ny;
      }
    }
    // the rock: the floor's dark band rising here and there in outcrops, rough along their tops,
    // with the tiles fitted round them
    const rock = (seed: number) => {
      const q = rng(seed);
      x.beginPath(); x.moveTo(0, H);
      for (let a = 0; a <= repeat; a += 0.25) {
        const crest = Math.max(0, Math.sin(a * 0.9 + 1.3) * 0.7 + Math.sin(a * 0.37 + 0.4) * 1.1 + Math.sin(a * 2.3) * 0.2);
        x.lineTo(a * PX, Y(from + crest * (0.9 + q() * 0.25) + q() * 0.08));
      }
      x.lineTo(W, H); x.closePath();
    };
    rock(1987); x.fillStyle = '#2f2c28'; x.fill();
    x.save(); rock(1987); x.clip();
    for (let i = 0; i < 1400; i++) {
      const v = 34 + Math.floor(r() * 46);
      x.fillStyle = `rgba(${v},${v - 3},${v - 7},0.55)`;
      x.beginPath(); x.ellipse(r() * W, H - r() * H * 0.6, 2 + r() * 14, 2 + r() * 9, r() * 3, 0, Math.PI * 2); x.fill();
    }
    speckle(x, W, H, 3000, 0.2, 1988, true);
    x.restore();
  } else {
    // the black band, its top edge a little paler
    x.fillStyle = '#1e1e1f'; x.fillRect(0, Y(from), W, from * PX);
    x.fillStyle = '#3a3a3b'; x.fillRect(0, Y(from), W, 2);
    speckle(x, W, from * PX, 900, 0.12, 1934, true);
  }
  if (enamel) kallstromEnamel(x, W, H, PX, from, enamel, rng(2008));
  if (top) {
    // the plain band under the ceiling, a little shadow along its foot
    x.fillStyle = '#e4dfd2'; x.fillRect(0, 0, W, top * PX);
    x.fillStyle = 'rgba(60,50,30,0.25)'; x.fillRect(0, top * PX, W, 2);
  }
  if (plate) for (let g = 0; g < 3; g++) {
    // the name plates, one in each gap
    x.save();
    x.translate((g * (posters.run * posters.every + posters.gap) + posters.run * posters.every + posters.gap / 2) * PX, Y(plate.at));
    if (mirror) x.scale(-1, 1);
    drawNamePlate(x, plate.name, PX, '#2b2320');
    x.restore();
  }
  // the posters
  const grounds = ['#f1efe9', '#e9eef2', '#f4ead8', '#1f2a3a', '#f2f0f0', '#dfe8e1'];
  const blocks = ['#d9472b', '#2f6db3', '#f0b429', '#3a8f5c', '#8e3f8f', '#e66b9a', '#1b1b1b', '#4fb3c9'];
  for (let k = 0; k < 3 * posters.run; k++) {
    const group = Math.floor(k / posters.run), along = group * (posters.run * posters.every + posters.gap) + (k % posters.run) * posters.every;
    const x0 = (along + (posters.every - posters.width) / 2) * PX, y0 = Y(posters.bottom + posters.height);
    const w = posters.width * PX, h = posters.height * PX;
    x.fillStyle = '#9ea2a4'; x.fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
    const ground = grounds[Math.floor(r() * grounds.length)], dark = ground === '#1f2a3a';
    x.fillStyle = ground; x.fillRect(x0, y0, w, h);
    if (r() < 0.4) {
      // a photograph to the edges: a sky over a darker land or sea, and a line of type over it
      const sky = x.createLinearGradient(0, y0, 0, y0 + h);
      const top = blocks[Math.floor(r() * blocks.length)];
      sky.addColorStop(0, top); sky.addColorStop(0.6, '#e8eef2'); sky.addColorStop(1, '#5b6a73');
      x.fillStyle = sky; x.fillRect(x0, y0, w, h);
      x.fillStyle = `rgba(30,40,45,${0.5 + r() * 0.4})`;
      x.beginPath(); x.moveTo(x0, y0 + h * 0.75);
      for (let s = 0; s <= 6; s++) x.lineTo(x0 + (w * s) / 6, y0 + h * (0.62 + r() * 0.12));
      x.lineTo(x0 + w, y0 + h); x.lineTo(x0, y0 + h); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillRect(x0 + w * 0.1, y0 + h * 0.1, w * (0.5 + r() * 0.3), h * 0.05);
      continue;
    }
    // a picture: a block of colour, or a disc on it
    const bh = h * (0.35 + r() * 0.3), by = y0 + h * (0.08 + r() * 0.12);
    x.fillStyle = blocks[Math.floor(r() * blocks.length)];
    if (r() < 0.6) x.fillRect(x0 + w * 0.1, by, w * 0.8, bh);
    else { x.beginPath(); x.arc(x0 + w / 2, by + bh / 2, Math.min(w, bh) * 0.42, 0, Math.PI * 2); x.fill(); }
    if (r() < 0.5) {
      x.fillStyle = blocks[Math.floor(r() * blocks.length)];
      x.beginPath(); x.arc(x0 + w * (0.65 + r() * 0.2), by + bh * (0.1 + r() * 0.3), w * 0.12, 0, Math.PI * 2); x.fill();
    }
    // lines of type under it
    x.fillStyle = dark ? 'rgba(255,255,255,0.85)' : 'rgba(30,30,30,0.8)';
    x.fillRect(x0 + w * 0.1, by + bh + h * 0.06, w * (0.5 + r() * 0.3), h * 0.045);
    for (let l = 0; l < 3; l++) x.fillRect(x0 + w * 0.1, by + bh + h * (0.15 + l * 0.04), w * (0.4 + r() * 0.4), h * 0.012);
  }
  speckle(x, W, H, 2500, 0.06, 1935);
  const [c, y] = canvas(H, W);
  // (along, up) → (up from the left, along)
  y.setTransform(0, 1, -1, 0, H, 0);
  y.drawImage(src, 0, 0);
  return toTexture(c);
}

// Danderyds sjukhus's track walls over the black band (beamedHallWall's `enamel`), drawn on its
// canvas: `PX` to the metre, heights from the floor beside the track.
function kallstromEnamel(x: CanvasRenderingContext2D, W: number, H: number, PX: number, from: number, enamel: { top: number; rows: number; width: number }, r: () => number) {
  const Y = (h: number) => H - h * PX, e0 = from, e1 = enamel.top, ph = (e1 - e0) / enamel.rows;
  // the concrete over the panels: a pale grey, cast against boards 10 cm wide laid aslant, the
  // other way every 1.2 m, a little mottled
  x.fillStyle = '#c9c6be'; x.fillRect(0, 0, W, Y(e1));
  x.save(); x.beginPath(); x.rect(0, 0, W, Y(e1)); x.clip();
  for (let k = 0; k * 1.2 * PX < W; k++) {
    const x0 = k * 1.2 * PX, d = k % 2 ? 1 : -1;
    x.save(); x.beginPath(); x.rect(x0, 0, 1.2 * PX, Y(e1)); x.clip();
    for (let j = -40; j < 60; j++) {
      const v = 190 + Math.floor(r() * 14);
      x.strokeStyle = `rgba(${v - 60},${v - 62},${v - 68},0.22)`; x.lineWidth = 1;
      const o = x0 + j * 0.1 * PX * Math.SQRT2;
      x.beginPath(); x.moveTo(o, Y(e1)); x.lineTo(o + d * Y(e1), 0); x.stroke();
    }
    x.restore();
    x.fillStyle = 'rgba(90,86,80,0.25)'; x.fillRect(x0, 0, 1, Y(e1));
  }
  for (let k = 0; k < 90; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '70,66,60' : '235,232,226'},${0.04 + r() * 0.06})`; x.beginPath(); x.ellipse(r() * W, r() * Y(e1), 10 + r() * 50, 5 + r() * 18, 0, 0, Math.PI * 2); x.fill(); }
  x.restore();
  // a steel trim along the panels' top
  x.fillStyle = '#9a9c9d'; x.fillRect(0, Y(e1) - 2, W, 3);
  // the panels, white enamel in grey joints
  x.save(); x.beginPath(); x.rect(0, Y(e1), W, (e1 - e0) * PX); x.clip();
  x.fillStyle = '#a9aaa8'; x.fillRect(0, Y(e1), W, (e1 - e0) * PX);
  const pw = enamel.width * PX;
  for (let j = 0; j < enamel.rows; j++) for (let i = 0; i * pw < W; i++) {
    const v = 240 + Math.floor(r() * 6);
    x.fillStyle = `rgb(${v},${v},${v - 3})`;
    x.fillRect(i * pw + 1, Y(e0 + (j + 1) * ph) + 1, pw - 2, ph * PX - 2);
  }
  // the shadows of trees: pairs of black stripes rising across the panels, low and long
  for (let along = r() * 3; along < W / PX - 2; along += 2.5 + r() * 4) {
    const slope = 0.32 + r() * 0.22, len = (e1 - e0) / slope, w = 0.06 + r() * 0.03, gap = 0.16 + r() * 0.14;
    x.strokeStyle = '#161616'; x.lineCap = 'butt';
    const pair = r() < 0.75 ? [0, gap] : [0];
    for (const g of pair) {
      x.lineWidth = w * PX;
      x.beginPath(); x.moveTo((along + g) * PX, Y(e0 - 0.1)); x.lineTo((along + g + len * 1.08) * PX, Y(e1 + 0.1)); x.stroke();
    }
  }
  // the trunks, upright from the band to the top, birch-grey and streaked, one or two together
  for (let along = 1 + r() * 4; along < W / PX - 1; along += 5 + r() * 8) {
    for (let n = r() < 0.4 ? 2 : 1, k = 0; k < n; k++) {
      const tx = (along + k * (0.4 + r() * 0.5)) * PX, tw = (0.09 + r() * 0.06) * PX;
      const g = x.createLinearGradient(tx, 0, tx + tw, 0);
      g.addColorStop(0, '#8d8372'); g.addColorStop(0.35, '#c9bea8'); g.addColorStop(0.7, '#b3a790'); g.addColorStop(1, '#6f6656');
      x.fillStyle = g; x.fillRect(tx, Y(e1), tw, (e1 - e0) * PX);
      for (let m = 0; m < 26; m++) {
        x.fillStyle = `rgba(${r() < 0.6 ? '60,52,42' : '230,224,210'},${0.25 + r() * 0.35})`;
        x.fillRect(tx + r() * tw * 0.8, Y(e0 + r() * (e1 - e0)), 1 + r() * tw * 0.4, 1 + r() * 3);
      }
    }
  }
  // people, in greens: some near and tall, some smaller and further off, standing, walking, a
  // hand at the hip or a phone at the ear
  const greens = ['#5f9e3e', '#4c8a3a', '#2f6e3a', '#7fb44a', '#3d7f47', '#93c25a'];
  for (let along = 0.8 + r() * 3; along < W / PX - 1; along += 2.2 + r() * 5) {
    const h = (r() < 0.35 ? 1.25 + r() * 0.35 : 0.55 + r() * 0.5) * PX, foot = Y(e0 + 0.06 + r() * 0.12);
    person(x, along * PX, Math.min(foot, Y(e0) - 2), Math.min(h, (e1 - e0 - 0.15) * PX), greens[Math.floor(r() * greens.length)], r);
  }
  x.restore();
}

// A person's silhouette, `h` tall, standing on (cx, foot): head, body, legs apart or together, an
// arm hanging, at the hip or raised to the ear.
function person(x: CanvasRenderingContext2D, cx: number, foot: number, h: number, color: string, r: () => number) {
  x.fillStyle = color; x.strokeStyle = color; x.lineCap = 'round';
  const head = h * 0.13, shoulder = foot - h * 0.82, hip = foot - h * 0.47, wide = h * 0.13, lean = (r() - 0.5) * h * 0.06;
  x.beginPath(); x.ellipse(cx + lean, foot - h + head / 2, head * 0.42, head / 2, 0, 0, Math.PI * 2); x.fill();
  x.beginPath();
  x.moveTo(cx + lean - wide, shoulder); x.lineTo(cx + lean + wide, shoulder);
  x.lineTo(cx + wide * 0.8, hip); x.lineTo(cx - wide * 0.8, hip); x.closePath(); x.fill();
  // the legs: apart when walking
  const stride = r() < 0.5 ? h * (0.1 + r() * 0.12) : h * 0.03;
  x.lineWidth = h * 0.085;
  x.beginPath(); x.moveTo(cx - wide * 0.4, hip); x.lineTo(cx - stride, foot - h * 0.02); x.stroke();
  x.beginPath(); x.moveTo(cx + wide * 0.4, hip); x.lineTo(cx + stride, foot - h * 0.02); x.stroke();
  // the arms
  x.lineWidth = h * 0.06;
  const pose = r();
  for (const side of [-1, 1]) {
    const sx = cx + lean + side * wide * 0.95, sy = shoulder + h * 0.02;
    x.beginPath(); x.moveTo(sx, sy);
    if (pose < 0.3 && side > 0) { x.lineTo(sx + side * h * 0.1, sy + h * 0.12); x.lineTo(cx + lean + side * head * 0.5, foot - h + head * 0.7); }
    else if (pose < 0.6 && side < 0) { x.lineTo(sx + side * h * 0.12, sy + h * 0.15); x.lineTo(cx + side * wide * 0.8, hip); }
    else x.lineTo(sx + side * h * 0.03, hip + h * 0.04);
    x.stroke();
  }
}

// ------------------------------------------------------------------ Medborgarplatsen's hall
// (src/hall-styles.ts; its track walls are as Skanstull's, beamedHallWall)

// The round columns: enamel of `base` colour, with bands of colour round them, the first's top
// `top` above the rail and each `width` high, `pitch` apart down the column; a seam up it. As
// roundPillar lays it on: u round the column and v up it, in metres; the canvas covers 5 m.
export const RINGED_HEIGHT = 5;
export function ringedColumn(base: number, rings: { colors: number[]; top: number; width: number; pitch: number }) {
  const PX = 100, H = RINGED_HEIGHT * PX, [c, x] = canvas(64, H);
  x.fillStyle = css(base); x.fillRect(0, 0, 64, H);
  rings.colors.forEach((col, i) => {
    x.fillStyle = css(col);
    x.fillRect(0, (RINGED_HEIGHT - rings.top + i * rings.pitch) * PX, 64, rings.width * PX);
  });
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, 2, H);
  x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(2, 0, 2, H);
  const t = toTexture(c);
  t.repeat.set(1, 1 / RINGED_HEIGHT);
  return t;
}

// Rådmansgatan's square columns: glossy square tiles, `tile` m, of `color` (each a shade lighter
// or darker), in grey joints. As pillar lays it on: HOTORGET_REPEAT m to a repeat, across a face
// and up it.
export function tiledColumn(color: number, tile: number) {
  const PX = 64, N = Math.round(HOTORGET_REPEAT * PX), n = Math.round(HOTORGET_REPEAT / tile), t = N / n;
  const [c, x] = canvas(N, N), r = rng(1952);
  x.fillStyle = css(color, -50); x.fillRect(0, 0, N, N);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    x.fillStyle = css(color, Math.floor(r() * 12) - 6);
    x.fillRect(i * t + 0.8, j * t + 0.8, t - 1.6, t - 1.6);
    // the glaze: lighter at the top of each tile
    x.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.05})`;
    x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, (t - 3) * 0.35);
  }
  return toTexture(c);
}

// S:t Eriksplan's columns: concrete with its aggregate exposed, `color` with a mottle, and
// flecked with its stones, black, white and brownish grey, a few millimetres to a centimetre
// across. As pillar lays it on: HOTORGET_REPEAT m to a repeat, across a face and up it.
export function aggregate(color: number) {
  const N = 1024, PX = N / HOTORGET_REPEAT, [c, x] = canvas(N, N), r = rng(1952);
  x.fillStyle = css(color); x.fillRect(0, 0, N, N);
  for (let i = 0; i < 60; i++) {
    x.fillStyle = `rgba(${r() < 0.5 ? '60,56,50' : '200,196,188'},${0.04 + r() * 0.06})`;
    x.beginPath(); x.ellipse(r() * N, r() * N, 20 + r() * 80, 20 + r() * 80, 0, 0, Math.PI * 2); x.fill();
  }
  const stones: [string, number][] = [['28,27,26', 0.35], ['226,222,212', 0.2], ['120,108,96', 0.25], ['70,72,74', 0.2]];
  for (let i = 0; i < 56000; i++) {
    let k = r(), j = 0;
    while (j < stones.length - 1 && k > stones[j][1]) { k -= stones[j][1]; j++; }
    const s = (0.003 + r() * r() * 0.012) * PX;
    x.fillStyle = `rgba(${stones[j][0]},${0.5 + r() * 0.5})`;
    x.beginPath(); x.ellipse(r() * N, r() * N, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); x.fill();
  }
  return toTexture(c);
}

// The vault of the lengthening: cream panels, their joints across the hall every 1.2 m and,
// fainter, along it every 0.6 m. u across the hall, v along it, 2.4 m a repeat both ways.
export function vaultPanels(color: number) {
  const [c, x] = canvas(240, 240), r = rng(1950);
  x.fillStyle = css(color); x.fillRect(0, 0, 240, 240);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    x.fillStyle = css(color, Math.floor(r() * 8) - 4); x.fillRect(i * 60 + 1, j * 120 + 2, 58, 116);
  }
  for (let i = 0; i < 4; i++) { x.fillStyle = css(color, -14); x.fillRect(i * 60, 0, 1, 240); }
  for (let j = 0; j < 2; j++) {
    x.fillStyle = css(color, -38); x.fillRect(0, j * 120, 240, 2);
    x.fillStyle = css(color, 12); x.fillRect(0, j * 120 + 2, 240, 1);
  }
  speckle(x, 240, 240, 600, 0.05, 1951);
  return toTexture(c);
}

// The long signs hung along the platform's edges: the name in white on black, and under it on a
// white band the ways out, in black, an arrow at the end. In SL's blue (`blue`): the name in
// white on navy over a yellow line, the ways out in white at its right end, an arrow after them.
export function waysSign(name: string, ways: string, blue = false) {
  const [c, x] = canvas(1536, 280);
  if (blue) {
    x.fillStyle = '#1f2f72'; x.fillRect(0, 0, 1536, 280);
    x.fillStyle = '#f2c21b'; x.fillRect(0, 236, 1536, 16);
    x.fillStyle = '#f4f4f0';
    x.font = '600 128px "Helvetica Neue", Arial, sans-serif';
    x.textAlign = 'left'; x.textBaseline = 'middle';
    (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '10px';
    x.fillText(name.toUpperCase(), 60, 124, 820);
    (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
    x.font = '500 44px "Helvetica Neue", Arial, sans-serif';
    x.textAlign = 'right';
    ways.split(' · ').forEach((w, i, all) => x.fillText(w, 1390, 124 + (i - (all.length - 1) / 2) * 56));
    x.font = '600 96px "Helvetica Neue", Arial, sans-serif';
    x.fillText('→', 1490, 120);
    return toTexture(c, { repeat: false });
  }
  x.fillStyle = '#16171a'; x.fillRect(0, 0, 1536, 280);
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 196, 1536, 84);
  x.fillStyle = '#f4f4f0';
  x.font = '600 132px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillText(name, 60, 104);
  x.fillStyle = '#16171a';
  x.font = '500 52px "Helvetica Neue", Arial, sans-serif';
  x.fillText(ways, 60, 240);
  x.font = '600 60px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'right';
  x.fillText('→', 1490, 238);
  return toTexture(c, { repeat: false });
}

// ------------------------------------------------------------------ styled open stations
// (src/open-styles.ts)

const css = (n: number, k = 0) => {
  const ch = (s: number) => Math.max(0, Math.min(255, ((n >> s) & 255) + k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// A styled open station's platform paving, u across from the edge (0) to PAVING_ACROSS m in (1),
// v along it, PAVING_REPEAT m a repeat (or its lines' repeat: pavingRepeat): the edge stones, the
// ribbed strip for the blind, pale slabs, then pavers.
export const PAVING_ACROSS = 8, PAVING_REPEAT = 2.4;
export const pavingRepeat = (p: Paving) => p.lines?.every ?? PAVING_REPEAT;
export function openPaving(p: Paving) {
  const PX = 100, W = PAVING_ACROSS * PX, H = pavingRepeat(p) * PX, [c, x] = canvas(W, H);
  const r = rng(1950), C = p.colors;
  const joint = css(C.pavers, -34);
  // pavers: rectangles 24 × 12 cm (or as given), in a running bond along the platform, or in
  // herringbone; some of them paler
  x.fillStyle = joint; x.fillRect(0, 0, W, H);
  const [plm, pwm] = p.paverSize ?? [0.24, 0.12], pw = pwm * PX, pl = plm * PX;
  const tone = () => css(p.mix && r() < p.mix ? C.paler ?? C.pavers : C.pavers, Math.floor(r() * 14) - 7);
  if (p.pattern === 'bond' || p.pattern === 'grid') {
    // (a grid: the same, without the half offset; square tiles in straight rows both ways)
    const off = p.pattern === 'bond' ? pl / 2 : 0;
    for (let i = 0; i * pw < W; i++) for (let j = -1; j * pl < H; j++) {
      x.fillStyle = tone();
      x.fillRect(i * pw + 0.6, j * pl + (i % 2) * off + 0.6, pw - 1.2, pl - 1.2);
    }
  } else if (p.pattern === 'asphalt') {
    // asphalt, laid without joints: its stone showing dark and pale
    x.fillStyle = css(C.pavers); x.fillRect(0, 0, W, H);
    speckle(x, W, H, 40000, 0.35, 1952); speckle(x, W, H, 14000, 0.18, 1953, true);
  } else if (p.pattern === 'fans') {
    // small setts, 8 cm, in rows of fans 0.8 m wide, each row overlapping the one before it
    const R = 0.57 * PX, sz = 0.08 * PX;
    for (let row = -6; row * 0.4 * PX < H + R; row++) {
      const cy = row * 0.4 * PX + R;
      for (let col = -1; col * 0.8 * PX < W + R; col++) {
        const cx = col * 0.8 * PX + (row % 2 ? 0.4 * PX : 0);
        x.fillStyle = css(C.pavers, -16); x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R + 1, -0.75 * Math.PI, -0.25 * Math.PI); x.closePath(); x.fill();
        for (let rr = R - sz / 2; rr > sz; rr -= sz) {
          const n = Math.max(1, Math.round((rr * Math.PI / 2) / sz));
          for (let k = 0; k < n; k++) {
            const a = -0.75 * Math.PI + ((k + 0.5) / n) * Math.PI / 2;
            x.save(); x.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); x.rotate(a);
            x.fillStyle = css(C.pavers, Math.floor(r() * 12) - 6); x.fillRect(-sz / 2 + 0.6, -sz / 2 + 0.6, sz - 1.2, sz - 1.2);
            x.restore();
          }
        }
      }
    }
  } else {
    for (let i = -2; i * pw < W + pl; i++) for (let j = -2; j * pw < H + pl; j += 2) {
      const ox = i * pw, oy = (j + i) * pw;
      x.fillStyle = css(C.pavers, Math.floor(r() * 18) - 9); x.fillRect(ox + 1, oy + 1, pl - 2, pw - 2);
      x.fillStyle = css(C.pavers, Math.floor(r() * 18) - 9); x.fillRect(ox + 1, oy + pw + 1, pw - 2, pl - 2);
    }
  }
  // (polished stone: pale veins wandering across it)
  if (p.veins) {
    for (let k = 0; k < 90; k++) {
      let px = r() * W, py = r() * H, a = r() * Math.PI * 2;
      x.strokeStyle = `rgba(228,230,230,${0.12 + r() * 0.2})`; x.lineWidth = 0.6 + r() * 1.2;
      x.beginPath(); x.moveTo(px, py);
      for (let s = 0; s < 8; s++) { a += (r() - 0.5) * 0.9; px += Math.cos(a) * 9; py += Math.sin(a) * 9; x.lineTo(px, py); }
      x.stroke();
    }
  }
  // (thin lines of brass in the terrazzo: two zigzags across from near the strip for the blind,
  // crossing each other, between lines along it, and a third further in)
  if (p.lines) {
    const L = p.lines.every, a = p.tactile[1] + 0.3, b = a + 3.0, c2 = b + 3.0;
    x.strokeStyle = css(p.lines.color); x.lineWidth = 1.6;
    const path = (pts: [number, number][]) => { x.beginPath(); pts.forEach(([u, v], i) => (i ? x.lineTo(u * PX, v * PX) : x.moveTo(u * PX, v * PX))); x.stroke(); };
    path([[a, 0], [b, L / 2], [a, L]]); path([[b, 0], [a, L / 2], [b, L]]);
    path([[b, 0], [c2, L / 4], [b, L / 2], [c2, (3 * L) / 4], [b, L]]);
    for (const u of [a, b]) path([[u, 0], [u, L]]);
  }
  // pale slabs out to `slabs`, 30 cm square, or in courses along the platform, their joints across
  // it staggered
  const [sa, sl] = p.slabSize ?? [0.3, 0.3];
  const slab = (a: number, b: number) => {
    x.fillStyle = joint; x.fillRect(a * PX, 0, (b - a) * PX, H);
    const n = Math.max(1, Math.round((b - a) / sa)), w = ((b - a) * PX) / n, l = sl * PX;
    for (let i = 0; i < n; i++) for (let j = -1; j < H / l; j++) {
      const off = sa === sl ? 0 : (i % 2) * l / 2;
      x.fillStyle = css(C.slab, Math.floor(r() * 12) - 6);
      x.fillRect(a * PX + i * w + 1.5, j * l + off + 1.5, w - 3, l - 3);
    }
  };
  if (p.slabs > p.tactile[1]) slab(p.tactile[1], p.slabs);
  // the strip for the blind: ribs along the platform, or rows of studs
  const [t0, t1] = p.tactile;
  x.fillStyle = css(C.tactile); x.fillRect(t0 * PX, 0, (t1 - t0) * PX, H);
  if (p.studs) {
    for (let k = 0.04; k < t1 - t0 - 0.02; k += 0.06) for (let j = 0.03; j < H / PX; j += 0.06) {
      x.fillStyle = css(C.tactile, -24); x.beginPath(); x.arc((t0 + k) * PX + 0.6, j * PX + 0.6, 0.013 * PX, 0, Math.PI * 2); x.fill();
      x.fillStyle = p.studColor === undefined ? css(C.tactile, 22) : css(p.studColor); x.beginPath(); x.arc((t0 + k) * PX, j * PX, 0.011 * PX, 0, Math.PI * 2); x.fill();
    }
  } else {
    for (let k = 0.04; k < t1 - t0 - 0.02; k += 0.06) {
      x.fillStyle = css(C.tactile, 26); x.fillRect((t0 + k) * PX, 0, 0.025 * PX, H);
      x.fillStyle = css(C.tactile, -22); x.fillRect((t0 + k + 0.025) * PX, 0, 0.008 * PX, H);
    }
  }
  for (let j = 0; j <= H; j += 0.6 * PX) { x.fillStyle = joint; x.fillRect(t0 * PX, j - 1, (t1 - t0) * PX, 2); }
  // the edge stones, 60 cm long (or tiles, as given)
  const [ea, el] = p.edgeTile ?? [p.edge, 0.6], en = Math.max(1, Math.round(p.edge / ea)), ew = (p.edge * PX) / en;
  if (p.edgeTile) { x.fillStyle = css(C.edge, -28); x.fillRect(0, 0, p.edge * PX, H); }
  for (let i = 0; i < en; i++) for (let j = 0; j * el * PX < H; j++) {
    x.fillStyle = css(C.edge, Math.floor(r() * 10) - 5);
    x.fillRect(i * ew + (i ? 1 : 0), j * el * PX + 1.5, ew - (i ? 2.5 : 1.5), el * PX - 3);
  }
  x.fillStyle = joint; x.fillRect(p.edge * PX - 1.5, 0, 2, H);
  speckle(x, W, H, 6000, 0.1, 1951);
  return toTexture(c);
}

// The face of a platform's edge over the track: dark grey, with a bracket every 1.2 m. u up the
// face from the track bed (0) to the platform's top (1), v along, FACE_REPEAT m a repeat.
export const FACE_REPEAT = 1.2;
export function platformFace(color: number) {
  const [c, x] = canvas(64, 128);
  x.fillStyle = css(color); x.fillRect(0, 0, 64, 128);
  x.fillStyle = css(color, -16); x.fillRect(46, 0, 18, 128);
  x.fillStyle = css(color, 22); x.fillRect(46, 0, 2, 128);
  x.fillStyle = css(color, 30); x.fillRect(34, 56, 26, 16);
  x.fillStyle = css(color, -30); x.fillRect(34, 70, 26, 3);
  speckle(x, 64, 128, 300, 0.12, 52);
  return toTexture(c);
}

// The white boarding under a roof, the boards along the platform: u across 1 m, v along 2.4 m.
export function roofBoards(color: number) {
  const [c, x] = canvas(200, 240);
  x.fillStyle = css(color); x.fillRect(0, 0, 200, 240);
  const r = rng(77);
  for (let i = 0; i < 10; i++) {
    x.fillStyle = css(color, Math.floor(r() * 8) - 6); x.fillRect(i * 20 + 1, 0, 18, 240);
    x.fillStyle = css(color, -38); x.fillRect(i * 20, 0, 1.2, 240);
  }
  speckle(x, 200, 240, 400, 0.05, 78);
  return toTexture(c);
}

// Ribbed sheet metal under a roof, the ribs along the platform, 25 cm apart: u across 1 m, v
// along 2.4 m.
export function ribbedSheet(color: number) {
  const [c, x] = canvas(200, 240);
  x.fillStyle = css(color); x.fillRect(0, 0, 200, 240);
  for (let i = 0; i < 4; i++) {
    const o = i * 50;
    x.fillStyle = css(color, 18); x.fillRect(o + 2, 0, 14, 240);
    x.fillStyle = css(color, -30); x.fillRect(o + 16, 0, 3, 240);
    x.fillStyle = css(color, -12); x.fillRect(o + 30, 0, 4, 240);
  }
  speckle(x, 200, 240, 300, 0.04, 79);
  return toTexture(c);
}

// A fence of boards, 1.2 m a repeat along it and its whole height up: painted boards standing
// side by side between two rails; or weathered boards slanting, a gap between each (`louvres`).
export function fenceBoards(color: number, louvres: boolean) {
  const W = 192, H = 256, [c, x] = canvas(W, H), r = rng(louvres ? 88 : 87);
  if (louvres) {
    x.clearRect(0, 0, W, H);
    for (let i = -4; i < 12; i++) {
      const x0 = i * 24;
      x.fillStyle = css(color, Math.floor(r() * 16) - 8);
      x.beginPath(); x.moveTo(x0, H); x.lineTo(x0 + 16, H); x.lineTo(x0 + 16 + 60, 0); x.lineTo(x0 + 60, 0); x.closePath(); x.fill();
      x.fillStyle = css(color, -34); x.beginPath(); x.moveTo(x0 + 14, H); x.lineTo(x0 + 16, H); x.lineTo(x0 + 76, 0); x.lineTo(x0 + 74, 0); x.closePath(); x.fill();
    }
    x.fillStyle = css(color, -20); x.fillRect(0, 6, W, 8); x.fillRect(0, H - 14, W, 8);
  } else {
    x.fillStyle = css(color, -30); x.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) {
      x.fillStyle = css(color, Math.floor(r() * 10) - 5); x.fillRect(i * 24 + 1, 0, 22, H);
      x.fillStyle = css(color, 14); x.fillRect(i * 24 + 1, 0, 2, H);
    }
  }
  speckle(x, W, H, 900, 0.08, 89);
  return toTexture(c);
}

// A chain-link fence: galvanised wire in diamonds 5 cm across, clear between. 0.5 × 0.5 m.
export function chainLink(color = 'rgba(176,182,186,1)') {
  const [c, x] = canvas(128);
  x.clearRect(0, 0, 128, 128);
  x.strokeStyle = color; x.lineWidth = 2.2;
  for (let k = -128; k <= 256; k += 12.8) {
    x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 128, 128); x.stroke();
    x.beginPath(); x.moveTo(k, 128); x.lineTo(k + 128, 0); x.stroke();
  }
  return toTexture(c);
}

// A railing of upright bars, black, 12 cm apart, between a top rail and a bottom one, over 1.2 m
// along it (u in metres / 1.2, v up it from 0 to 1); the gaps clear.
export function barRailing(color = '#1d1f21') {
  const W = 192, H = 128, [c, x] = canvas(W, H);
  x.clearRect(0, 0, W, H);
  x.fillStyle = color;
  x.fillRect(0, 0, W, 9); x.fillRect(0, H - 12, W, 6);
  for (let i = 0; i < 10; i++) x.fillRect(i * W / 10 + 7, 0, 4, H - 6);
  return toTexture(c);
}

// A black name sign hung under a platform's roof: the name in white, and under it the ways out,
// to the left and to the right. 2.4 × 0.6 m.
export function hangingSign(name: string, left: string, right: string, blue = false, plain = false) {
  const W = 960, H = 240, [c, x] = canvas(W, H);
  x.fillStyle = blue ? '#24307a' : '#161718'; x.fillRect(0, 0, W, H);
  // (SL's blue ones: a yellow stripe along the foot)
  if (blue) { x.fillStyle = '#f2c230'; x.fillRect(0, H - 22, W, 22); }
  x.fillStyle = '#f2f2ee'; x.textBaseline = 'middle';
  x.font = '600 108px "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'center';
  // (`plain`: the name alone, in the middle)
  if (plain) { x.fillText(name, W / 2, blue ? 112 : 124, W - 80); return toTexture(c, { repeat: false }); }
  x.fillText(name, W / 2, 82, W - 80);
  x.fillStyle = blue ? '#e8e8e2' : '#5a5c5e'; x.fillRect(30, 150, W - 60, 3);
  x.fillStyle = '#f2f2ee'; x.font = '500 44px "Helvetica Neue", Arial, sans-serif';
  const y = blue ? 186 : 197;
  const arrow = (cx: number, dir: number) => {
    x.beginPath(); x.moveTo(cx + dir * 18, y - 1); x.lineTo(cx - dir * 4, y - 17); x.lineTo(cx - dir * 4, y + 15); x.fill();
    x.fillRect(Math.min(cx - dir * 22, cx - dir * 4), y - 5, 18, 8);
  };
  // (no way out that way if there's no name)
  if (left) { arrow(48, -1); x.textAlign = 'left'; x.fillText(left, 80, y, W / 2 - 100); }
  if (right) { arrow(W - 48, 1); x.textAlign = 'right'; x.fillText(right, W - 80, y, W / 2 - 100); }
  return toTexture(c, { repeat: false });
}

// Birch bark round a trunk (across) and 0.4 m along it (up): chalk white, dark lenticels across the
// trunk, and here and there a black patch.
export function birchBark() {
  const W = 64, H = 128, [c, x] = canvas(W, H), r = rng(1991);
  x.fillStyle = '#e2dfd6'; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 46; k++) { x.fillStyle = `rgba(42,40,36,${0.45 + r() * 0.45})`; x.fillRect(r() * W, r() * H, 4 + r() * 16, 1 + r() * 2.5); }
  for (let k = 0; k < 3; k++) {
    const cx = r() * W, cy = r() * H;
    x.fillStyle = 'rgba(30,28,26,0.85)'; x.beginPath(); x.ellipse(cx, cy, 6 + r() * 8, 3 + r() * 6, r() * 0.5, 0, Math.PI * 2); x.fill();
  }
  return toTexture(c);
}

// The metro's round sign: a blue T on white in a blue ring.
export function tRoundel() {
  const N = 256, [c, x] = canvas(N);
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, N, N);
  x.strokeStyle = '#1f4f9c'; x.lineWidth = 16; x.beginPath(); x.arc(N / 2, N / 2, N / 2 - 12, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#1f4f9c'; x.fillRect(58, 64, 140, 34); x.fillRect(110, 64, 36, 132);
  return toTexture(c, { repeat: false });
}

// A station clock's face: white, black bars for the hours and strokes for the minutes, black
// hands (at ten past ten).
export function clockFace() {
  const N = 256, [c, x] = canvas(N);
  x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, N, N);
  x.translate(N / 2, N / 2);
  x.fillStyle = '#141516';
  for (let k = 0; k < 60; k++) {
    x.save(); x.rotate((k * Math.PI) / 30);
    if (k % 5 === 0) x.fillRect(-5, -118, 10, 30); else x.fillRect(-1.5, -118, 3, 10);
    x.restore();
  }
  const hand = (turn: number, len: number, w: number) => { x.save(); x.rotate(turn * Math.PI * 2); x.fillRect(-w / 2, -len, w, len + 16); x.restore(); };
  hand((10 + 10 / 60) / 12, 70, 12);
  hand(10 / 60, 104, 8);
  x.beginPath(); x.arc(0, 0, 9, 0, Math.PI * 2); x.fill();
  return toTexture(c, { repeat: false });
}

// The station's name in white capitals on a blue enamel band, the T in a white ring before it and
// a thin yellow line under it. `length` m long, 0.5 m high.
// (`black`: the older black band, the name in white as written, without the yellow stripe)
export function nameBand(name: string, length: number, black = false) {
  const H = 100, W = Math.round(length * 200), [c, x] = canvas(W, H);
  x.fillStyle = black ? '#151618' : '#18408f'; x.fillRect(0, 0, W, H);
  if (!black) { x.fillStyle = '#e8c33a'; x.fillRect(0, H - 9, W, 5); }
  x.font = '600 50px "Helvetica Neue", Arial, sans-serif'; x.textBaseline = 'middle';
  const text = black ? name : name.toUpperCase().split('').join(String.fromCharCode(8202)), tw = Math.min(x.measureText(text).width, W - 140);
  const x0 = (W - tw - 60) / 2;
  x.strokeStyle = '#f4f4f0'; x.lineWidth = 4; x.beginPath(); x.arc(x0 + 20, H / 2 - 3, 20, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#f4f4f0'; x.font = '700 30px "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'center'; x.fillText('T', x0 + 20, H / 2 - 2);
  x.font = '600 50px "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'left'; x.fillText(text, x0 + 60, H / 2 - 2, W - 140);
  return toTexture(c, { repeat: false });
}

// A pane of Björn Olsén's light boxes (Kärrtorp, 1994): coloured glass, its tone mottled, lit from
// behind, and on it a secret sign, a broad stroke curling and hooking in a paler shade with a darker
// rim, a different one for each `sign`. The picture is the whole pane, 1 by 2.
export function lightBoxGlass(color: number, sign: number) {
  const W = 128, H = 256, [c, x] = canvas(W, H), r = rng(1994 + sign * 37);
  const R = (color >> 16) & 255, G = (color >> 8) & 255, B = color & 255;
  x.fillStyle = `rgb(${R},${G},${B})`; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 40; k++) {
    const d = (r() - 0.5) * 50;
    x.fillStyle = `rgba(${d > 0 ? '255,255,240' : '20,24,20'},${0.04 + r() * 0.06})`;
    x.beginPath(); x.ellipse(r() * W, r() * H, 10 + r() * 40, 10 + r() * 60, r() * 3, 0, Math.PI * 2); x.fill();
  }
  // the sign: a stroke through four to six points, its ends hooked
  const n = 4 + Math.floor(r() * 3), pts: [number, number][] = [], bend: number[] = [];
  for (let k = 0; k < n; k++) { pts.push([W * (0.22 + r() * 0.56), H * (0.12 + (0.76 * k) / (n - 1)) + (r() - 0.5) * H * 0.08]); bend.push((r() - 0.5) * 60); }
  const tone = (k: number) => `rgb(${Math.min(255, R + k)},${Math.min(255, G + k)},${Math.min(255, B + k)})`;
  x.lineCap = 'round'; x.lineJoin = 'round';
  const draw = (w: number, style: string) => {
    x.strokeStyle = style; x.lineWidth = w;
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < n; k++) { const [a, b] = pts[k - 1], [cx, cy] = pts[k]; x.quadraticCurveTo(a + bend[k], (b + cy) / 2, cx, cy); }
    x.stroke();
  };
  draw(26, `rgba(${Math.max(0, R - 50)},${Math.max(0, G - 50)},${Math.max(0, B - 50)},0.7)`);
  draw(20, tone(70));
  // a blot or two where the stroke swells
  for (let k = 0; k < 2; k++) {
    const [px, py] = pts[1 + Math.floor(r() * (n - 2))];
    x.fillStyle = tone(60); x.beginPath(); x.ellipse(px, py, 12 + r() * 14, 8 + r() * 10, r() * 3, 0, Math.PI * 2); x.fill();
  }
  speckle(x, W, H, 900, 0.12, 1995 + sign);
  return toTexture(c, { repeat: false });
}

// Pine timbers glued up in thick layers, weathered to a pale grey-brown: the layers 12 cm deep,
// their grain along them, a dark knot here and there. 1.2 m a repeat.
export function laminatedWood() {
  const N = 240, [c, x] = canvas(N);
  const r = rng(1975);
  for (let j = 0; j < 10; j++) {
    const v = Math.floor(r() * 18);
    x.fillStyle = `rgb(${168 + v},${136 + v},${98 + v})`; x.fillRect(0, j * 24, N, 24);
    for (let k = 0; k < 14; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '110,84,58' : '210,188,150'},0.25)`; x.fillRect(0, j * 24 + r() * 24, N, 1); }
    x.fillStyle = 'rgba(70,52,36,0.6)'; x.fillRect(0, j * 24, N, 1.5);
    if (r() < 0.6) { x.fillStyle = 'rgba(80,56,36,0.7)'; x.beginPath(); x.ellipse(r() * N, j * 24 + 12, 4 + r() * 4, 3, 0, 0, Math.PI * 2); x.fill(); }
  }
  speckle(x, N, N, 900, 0.08, 1976);
  return toTexture(c);
}

// A departure board: a pale strip naming the trains' direction, and the next two trains in
// orange lights on black.
export function trainsBoard(toward: string, trains: [string, string]) {
  const W = 680, H = 200, [c, x] = canvas(W, H);
  x.fillStyle = '#0e0f10'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#d6d9d6'; x.fillRect(0, 0, W, 44);
  x.fillStyle = '#1a1b1c'; x.font = '500 28px "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(`Tåg mot ${toward}`, W / 2, 23, W - 40);
  x.fillStyle = '#ff8a1e'; x.font = '700 50px "Courier New", monospace'; x.textAlign = 'left';
  trains.forEach((t, k) => x.fillText(t, 22, 84 + k * 70, W - 44));
  return toTexture(c, { repeat: false });
}

// Kristina Anshelm's Tallkrogsdraken (1998), redrawn: a black-outlined dragon whose round body is
// Tallkrogen's ring of streets, yellow and blue, with four legs either side, a thin tail to the
// left and a snake's head to the right, over the suburb seen from above (green gardens, red and
// orange roofs) with an orange road along the bottom.
export function tallkrogsdraken() {
  const W = 1024, H = 700, [c, x] = canvas(W, H);
  const r = rng(1998);
  x.fillStyle = '#3e9147'; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 260; k++) {
    x.fillStyle = ['#2c7a37', '#57a957', '#78bf68', '#347f3c'][k % 4];
    x.beginPath(); x.arc(r() * W, r() * H, 10 + r() * 30, 0, Math.PI * 2); x.fill();
  }
  // the houses: roofs seen from above, a pale wall along one side
  const cx = 500, cy = 350, rx = 235, ry = 180;
  for (let k = 0; k < 140; k++) {
    const hx = r() * W, hy = r() * H;
    if (((hx - cx) / (rx + 30)) ** 2 + ((hy - cy) / (ry + 30)) ** 2 < 1) continue;
    x.save(); x.translate(hx, hy); x.rotate((r() - 0.5) * 1.6);
    x.fillStyle = '#efe5cc'; x.fillRect(-19, -8, 38, 24);
    x.fillStyle = ['#d24a26', '#e5702f', '#c43b22', '#ee8a3a'][k % 4]; x.fillRect(-19, -16, 38, 18);
    x.fillStyle = 'rgba(80,20,10,0.5)'; x.fillRect(-19, -8, 38, 2);
    x.restore();
  }
  // the road along the bottom
  x.strokeStyle = '#e57d2e'; x.lineWidth = 9; x.beginPath(); x.moveTo(0, H - 60); x.bezierCurveTo(W * 0.3, H - 30, W * 0.6, H - 95, W, H - 70); x.stroke();
  x.lineCap = 'round'; x.strokeStyle = '#121212';
  // the legs, four above and four below, curling at their feet
  x.lineWidth = 15;
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    const lx = cx - 120 + k * 85, ly = cy + side * ry * Math.sqrt(1 - ((lx - cx) / rx) ** 2);
    x.beginPath(); x.moveTo(lx, ly); x.quadraticCurveTo(lx - 20, ly + side * 90, lx + 12, ly + side * 150); x.quadraticCurveTo(lx + 30, ly + side * 168, lx + 46, ly + side * 158); x.stroke();
  }
  // the tail, thin and wavy, off to the left
  x.lineWidth = 7; x.beginPath(); x.moveTo(cx - rx + 4, cy + 10);
  x.bezierCurveTo(cx - rx - 80, cy - 40, cx - rx - 120, cy + 70, cx - rx - 210, cy + 20); x.bezierCurveTo(cx - rx - 260, cy - 5, 70, cy + 40, 40, cy + 10); x.stroke();
  // the neck and the snake's head, to the right
  x.lineWidth = 34; x.beginPath(); x.moveTo(cx + rx - 20, cy - 10); x.bezierCurveTo(cx + rx + 70, cy - 50, cx + rx + 110, cy + 40, cx + rx + 190, cy - 10); x.stroke();
  x.strokeStyle = '#2a5fc0'; x.lineWidth = 18; x.stroke();
  x.fillStyle = '#121212'; x.beginPath(); x.ellipse(cx + rx + 210, cy - 16, 36, 22, -0.3, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#2a5fc0'; x.beginPath(); x.ellipse(cx + rx + 210, cy - 16, 26, 13, -0.3, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#d8281e'; x.lineWidth = 5; x.beginPath(); x.moveTo(cx + rx + 242, cy - 26); x.lineTo(cx + rx + 272, cy - 34); x.moveTo(cx + rx + 262, cy - 31); x.lineTo(cx + rx + 276, cy - 22); x.stroke();
  // the body: the ring of streets, yellow between blue rings round a centre to the right of its
  // middle, crossed by black streets, in a heavy black outline
  x.save(); x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.clip();
  x.fillStyle = '#f0bf2a'; x.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  x.fillStyle = 'rgba(255,240,170,0.35)'; x.beginPath(); x.ellipse(cx - 60, cy - 50, rx * 0.6, ry * 0.5, 0, 0, Math.PI * 2); x.fill();
  const tx = cx + 70;
  x.strokeStyle = '#2a5fc0';
  for (const k of [0.25, 0.5, 0.75, 1.0]) {
    x.lineWidth = 16; x.beginPath(); x.ellipse(tx, cy, rx * 0.62 * k, ry * 0.78 * k, 0, 0.2, Math.PI * 2 - 0.2); x.stroke();
  }
  x.fillStyle = '#2a5fc0'; x.beginPath(); x.arc(tx, cy, 18, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#121212'; x.lineWidth = 14;
  x.beginPath(); x.moveTo(tx, cy - ry); x.lineTo(tx, cy + ry); x.stroke();
  x.beginPath(); x.moveTo(cx - rx, cy); x.lineTo(tx - 30, cy); x.stroke();
  for (const k of [-1, 1]) { x.beginPath(); x.ellipse(cx - 40, cy, 120, 130, 0, k > 0 ? -1.2 : Math.PI - 1.2, k > 0 ? 1.2 : Math.PI + 1.2); x.stroke(); }
  x.restore();
  x.strokeStyle = '#121212'; x.lineWidth = 18; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.stroke();
  speckle(x, W, H, 5000, 0.06, 1999);
  return toTexture(c, { repeat: false });
}

// Black branches over a wall, `n` of them, each from a root at its foot or its top, crooked and
// forking as it goes, thinning to twigs; wrapping round the repeat.
function branches(x: CanvasRenderingContext2D, W: number, H: number, PX: number, r: () => number, n: number, color: string, depth = 5) {
  x.strokeStyle = color; x.lineCap = 'round';
  const grow = (px: number, py: number, angle: number, width: number, len: number, depth: number) => {
    let cx = px, cy = py, a = angle;
    for (let k = 0; k < 4; k++) {
      a += (r() - 0.5) * 0.7;
      const nx = cx + Math.cos(a) * len / 4, ny = cy + Math.sin(a) * len / 4;
      x.lineWidth = Math.max(1, width * (1 - k * 0.08));
      for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) { x.beginPath(); x.moveTo(cx + dx, cy + dy); x.lineTo(nx + dx, ny + dy); x.stroke(); }
      cx = nx; cy = ny;
    }
    if (depth === 0 || width < 1.5) return;
    const forks = r() < 0.35 ? 3 : 2;
    for (let f = 0; f < forks; f++) grow(cx, cy, a + (f - (forks - 1) / 2) * 0.9 + (r() - 0.5) * 0.5, width * 0.62, len * (0.7 + r() * 0.2), depth - 1);
  };
  for (let i = 0; i < n; i++) {
    const up = i % 2 === 0;
    grow(r() * W, up ? H : 0, (up ? -1 : 1) * Math.PI / 2 + (r() - 0.5) * 0.9, 0.07 * PX, (0.45 + r() * 0.25) * PX, depth);
  }
}

// Polished aluminium, its surface crazed all over: pale cells of slightly different greys, dark
// cracks between them (a Voronoi pattern on the repeat).
export function crackle() {
  const N = 256, [c, x] = canvas(N), r = rng(2012);
  const pts = Array.from({ length: 90 }, () => [r() * N, r() * N, 186 + Math.floor(r() * 40)]);
  const img = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let d1 = 1e9, d2 = 1e9, v = 0;
    for (const [px, py, pv] of pts) {
      let dx = Math.abs(i - px), dy = Math.abs(j - py);
      if (dx > N / 2) dx = N - dx;
      if (dy > N / 2) dy = N - dy;
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; v = pv; } else if (d < d2) d2 = d;
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1), k = (j * N + i) * 4;
    const g = edge < 1.4 ? 70 : edge < 2.6 ? v - 50 : v;
    img.data[k] = g; img.data[k + 1] = g + 2; img.data[k + 2] = g + 6; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return toTexture(c);
}

// Small granite setts, about 10 cm, grey and a few pinkish, laid in rows in dark joints: a
// metre square.
// The photographic mosaic of a forest floor along Svedmyra's ticket hall: dry grass, rusty
// needles and dark soil, mossy hollows, grey stones and twigs, all in small square tesserae. 13 by
// 3 m, its picture across the whole width.
export function forestFloor() {
  const W = 2080, H = 480, [c, x] = canvas(W, H);
  const r = rng(1930);
  x.fillStyle = '#7b6446'; x.fillRect(0, 0, W, H);
  // patches of ground, larger to smaller
  const ground = ['#a88c58', '#8d6a3c', '#5b4632', '#9a5a32', '#6e5a3a', '#b59a68', '#5f6b3c', '#4a3b2e', '#7d7350'];
  for (const [n, size] of [[220, 70], [700, 30], [2200, 12]] as const) {
    for (let k = 0; k < n; k++) {
      x.fillStyle = ground[Math.floor(r() * ground.length)];
      x.globalAlpha = 0.35 + r() * 0.5;
      x.beginPath(); x.ellipse(r() * W, r() * H, size * (0.5 + r()), size * (0.3 + r() * 0.6), r() * Math.PI, 0, Math.PI * 2); x.fill();
    }
  }
  x.globalAlpha = 1;
  // blades of dry grass and fallen needles, every way
  for (let k = 0; k < 2600; k++) {
    const x0 = r() * W, y0 = r() * H, a = r() * Math.PI, l = 6 + r() * 22;
    x.strokeStyle = ['#c8ae74', '#b5482a', '#d0b880', '#8c4a26'][Math.floor(r() * 4)]; x.lineWidth = 1 + r();
    x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); x.stroke();
  }
  // stones, grey, lit from above
  for (let k = 0; k < 26; k++) {
    const cx = r() * W, cy = r() * H, rx = 18 + r() * 46, ry = rx * (0.5 + r() * 0.3);
    const g = x.createLinearGradient(cx, cy - ry, cx, cy + ry);
    g.addColorStop(0, '#b9b7ae'); g.addColorStop(1, '#6c6b66');
    x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, rx, ry, r() * 0.6 - 0.3, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(60,52,40,0.35)'; x.beginPath(); x.ellipse(cx + rx * 0.2, cy + ry * 0.85, rx * 0.9, ry * 0.25, 0, 0, Math.PI * 2); x.fill();
  }
  // twigs
  for (let k = 0; k < 60; k++) {
    let x0 = r() * W, y0 = r() * H, a = r() * Math.PI * 2;
    x.strokeStyle = '#3b2c20'; x.lineWidth = 2 + r() * 2;
    x.beginPath(); x.moveTo(x0, y0);
    for (let j = 0; j < 4; j++) { a += r() * 0.8 - 0.4; x0 += Math.cos(a) * 18; y0 += Math.sin(a) * 18; x.lineTo(x0, y0); }
    x.stroke();
  }
  // a tree's foot rising out of it near the left end
  const tg = x.createLinearGradient(150, 0, 230, 0);
  tg.addColorStop(0, '#6f685c'); tg.addColorStop(0.5, '#9a9284'); tg.addColorStop(1, '#5d574d');
  x.fillStyle = tg; x.beginPath(); x.moveTo(150, 0); x.lineTo(230, 0); x.lineTo(250, H * 0.5); x.lineTo(130, H * 0.5); x.fill();
  // the tesserae: each square one colour, about 2.5 cm, in dark joints
  const t = 4, img = x.getImageData(0, 0, W, H), d = img.data;
  for (let j = 0; j < H; j += t) for (let i = 0; i < W; i += t) {
    const o = ((j + 1) * W + i + 1) * 4, v = 0.92 + r() * 0.16;
    for (let b = 0; b < t; b++) for (let a = 0; a < t; a++) {
      const q = ((j + b) * W + i + a) * 4, joint = a === t - 1 || b === t - 1;
      for (let ch = 0; ch < 3; ch++) d[q + ch] = joint ? d[o + ch] * 0.55 : Math.min(255, d[o + ch] * v);
    }
  }
  x.putImageData(img, 0, 0);
  return toTexture(c, { repeat: false });
}

// The lit funnel on one of Liljeholmen's columns, round it (u) and up it (v): upright stripes of
// `color` and white, lit from within, between thin dark ribs, under a dark rim.
export function litCrown(color: number) {
  const W = 256, H = 64, [c, x] = canvas(W, H), n = 16, w = W / n;
  x.fillStyle = '#f2eee4'; x.fillRect(0, 0, W, H);
  x.fillStyle = css(color);
  for (let k = 0; k < n; k += 2) x.fillRect(k * w + 2, 0, w - 4, H);
  x.fillStyle = '#2a2224';
  for (let k = 0; k < n; k++) x.fillRect(k * w - 1, 0, 2, H);
  x.fillRect(0, 0, W, 5); x.fillRect(0, H - 3, W, 3);
  return toTexture(c);
}

// Leif Tjerned's boxes of neon at Gullmarsplan (1995): the coloured glass in a box's underside,
// lit from within: shards of saturated colour, oblongs, triangles and slivers, scattered over
// the dark (`seed`, one box from another).
export function neonGlass(seed: number) {
  const W = 256, H = 128, [c, x] = canvas(W, H), r = rng(1995 + seed * 53);
  x.fillStyle = '#121316'; x.fillRect(0, 0, W, H);
  const colours = ['#2457ff', '#ffd21a', '#ff2e1f', '#1fc25e', '#f4f4ee', '#9a3cff', '#1fc8e6', '#ff7a1a'];
  for (let k = 0; k < 26; k++) {
    const cx = 10 + r() * (W - 20), cy = 8 + r() * (H - 16), a = r() * Math.PI, l = 10 + r() * 42, w = 4 + r() * 16;
    const ca = Math.cos(a), sa = Math.sin(a), kind = r();
    x.fillStyle = colours[Math.floor(r() * colours.length)];
    x.shadowColor = x.fillStyle; x.shadowBlur = 6;
    x.beginPath();
    if (kind < 0.45) {
      // an oblong
      for (const [p, q] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) x.lineTo(cx + ca * p * l / 2 - sa * q * w / 2, cy + sa * p * l / 2 + ca * q * w / 2);
    } else if (kind < 0.8) {
      // a triangle
      for (const [p, q] of [[-1, -1], [1, 0], [-1, 1]]) x.lineTo(cx + ca * p * l / 2 - sa * q * w, cy + sa * p * l / 2 + ca * q * w);
    } else {
      // a sliver, slanting
      for (const [p, q] of [[-1, -0.3], [1, -1], [1, 0.3], [-1, 1]]) x.lineTo(cx + ca * p * l / 2 - sa * q * 3, cy + sa * p * l / 2 + ca * q * 3);
    }
    x.closePath(); x.fill();
  }
  x.shadowBlur = 0;
  return toTexture(c, { repeat: false });
}

// One of Leif Tjerned's angels at Gullmarsplan (Änglarna, 1997), cut out of aluminium and painted:
// a woman lying back along the wall, her head at the upper left, in a red dress laced at the
// bodice, its pleated skirt hemmed in a zigzag of blue, her arm hanging down beside it and her bare
// legs stretched out to the right to red high-heeled shoes; behind her shoulders a great wing of
// gold flaring up and back, and round its root a fan of feathers, red, blue, yellow, green and
// white. Drawn on a clear ground, to be cut out (1.6 by 1, its foot along the bottom).
export function angel() {
  const W = 1024, H = 640, [c, x] = canvas(W, H);
  const P = (u: number, v: number): [number, number] => [u * W, (1 - v) * H];
  const shape = (fill: string, pts: [number, number][], stroke?: string) => {
    x.fillStyle = fill; x.beginPath();
    pts.forEach(([u, v], k) => { const [px, py] = P(u, v); if (k) x.lineTo(px, py); else x.moveTo(px, py); });
    x.closePath(); x.fill();
    if (stroke) { x.strokeStyle = stroke; x.lineWidth = 3; x.stroke(); }
  };
  // a limb from a to b, wa thick at a and wb at b (in parts of the height)
  const limb = (fill: string, a: [number, number], b: [number, number], wa: number, wb: number, stroke: string) => {
    const du = (b[0] - a[0]) * W, dv = (b[1] - a[1]) * H, l = Math.hypot(du, dv), nu = -dv / l / W * H, nv = du / l;
    shape(fill, [[a[0] + nu * wa / 2, a[1] + nv * wa / 2], [b[0] + nu * wb / 2, b[1] + nv * wb / 2], [b[0] - nu * wb / 2, b[1] - nv * wb / 2], [a[0] - nu * wa / 2, a[1] - nv * wa / 2]], stroke);
  };
  // the feathers fanned round the wing's root, then the wing
  const root: [number, number] = [0.24, 0.6], colours = ['#d8261c', '#2348b8', '#f2c21a', '#2f9a46', '#f4f2ea', '#d8261c', '#2348b8', '#f2c21a', '#2f9a46', '#d8261c', '#2348b8'];
  colours.forEach((f, k) => {
    const t = 1.85 + k * 0.16, r = 0.27 + (k % 3) * 0.07, w = 0.07;
    const tip: [number, number] = [root[0] + Math.cos(t) * r * 0.62, root[1] + Math.sin(t) * r];
    const side = (d: number): [number, number] => [root[0] + Math.cos(t + d) * r * 0.3, root[1] + Math.sin(t + d) * r * 0.48];
    shape(f, [side(-w * 3), tip, side(w * 3)], '#1b1b1b');
    if (f === '#f4f2ea') { x.fillStyle = '#1b1b1b'; for (let j = 1; j < 4; j++) { const [px, py] = P(root[0] + (tip[0] - root[0]) * j / 4, root[1] + (tip[1] - root[1]) * j / 4); x.beginPath(); x.arc(px, py, 5, 0, Math.PI * 2); x.fill(); } }
  });
  shape('#d9a521', [[0.22, 0.6], [0.15, 0.76], [0.1, 0.99], [0.27, 0.86], [0.31, 0.99], [0.37, 0.84], [0.5, 0.93], [0.4, 0.72], [0.33, 0.6]], '#6b4a10');
  x.fillStyle = 'rgba(255,240,180,0.45)';
  x.beginPath(); x.moveTo(...P(0.14, 0.94)); x.lineTo(...P(0.25, 0.8)); x.lineTo(...P(0.2, 0.74)); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(...P(0.45, 0.89)); x.lineTo(...P(0.33, 0.76)); x.lineTo(...P(0.36, 0.7)); x.closePath(); x.fill();
  // her legs, stretched out to the right, and the shoes
  const skin = '#e3b391', shade = '#b98466';
  limb(skin, [0.54, 0.31], [0.86, 0.17], 0.1, 0.06, shade);
  limb(skin, [0.53, 0.22], [0.83, 0.07], 0.1, 0.06, shade);
  shape('#c8141e', [[0.85, 0.13], [0.97, 0.15], [0.98, 0.21], [0.87, 0.21]], '#5a0508');
  shape('#c8141e', [[0.82, 0.03], [0.94, 0.04], [0.95, 0.1], [0.84, 0.11]], '#5a0508');
  limb('#5a0508', [0.86, 0.13], [0.85, 0.08], 0.012, 0.012, '#5a0508');
  // her arm hanging down beside her
  limb(skin, [0.25, 0.54], [0.13, 0.2], 0.07, 0.05, shade);
  shape(skin, [[0.1, 0.22], [0.15, 0.22], [0.14, 0.13], [0.11, 0.13]], shade);
  // the dress: the bodice and its lacing, the pleated skirt and its blue zigzag hem
  shape('#c0182a', [[0.19, 0.57], [0.34, 0.63], [0.44, 0.45], [0.3, 0.36]], '#5a0610');
  x.strokeStyle = '#f2e6d8'; x.lineWidth = 3;
  for (let k = 0; k < 5; k++) { const t = 0.2 + k * 0.15; x.beginPath(); x.moveTo(...P(0.25 + t * 0.1, 0.6 - t * 0.2)); x.lineTo(...P(0.31 + t * 0.1, 0.55 - t * 0.17)); x.stroke(); }
  shape('#c0182a', [[0.3, 0.36], [0.44, 0.45], [0.58, 0.36], [0.57, 0.15], [0.36, 0.1], [0.27, 0.2]], '#5a0610');
  x.strokeStyle = 'rgba(70,0,10,0.55)'; x.lineWidth = 4;
  for (let k = 0; k < 9; k++) { const t = k / 9; x.beginPath(); x.moveTo(...P(0.33 + t * 0.12, 0.38 + t * 0.06)); x.lineTo(...P(0.3 + t * 0.26, 0.17 - t * 0.02 + Math.abs(t - 0.4) * 0.05)); x.stroke(); }
  // (along the skirt's lower edge, from its back by her hip round to its front)
  const edge = (t: number): [number, number] => t < 0.35 ? [0.27 + (t / 0.35) * 0.09, 0.2 - (t / 0.35) * 0.1] : [0.36 + ((t - 0.35) / 0.65) * 0.21, 0.1 + ((t - 0.35) / 0.65) * 0.05];
  const top = Array.from({ length: 15 }, (_, k): [number, number] => { const [u, v] = edge(k / 14); return [u, v + 0.035 + (k % 2) * 0.035]; });
  const foot = Array.from({ length: 15 }, (_, k): [number, number] => { const [u, v] = edge(1 - k / 14); return [u, v - 0.015]; });
  shape('#2348b8', [...top, ...foot], '#101a50');
  // her neck and head thrown back, her dark hair
  shape(skin, [[0.18, 0.62], [0.24, 0.62], [0.24, 0.56], [0.18, 0.56]]);
  x.fillStyle = '#2a1a12'; x.beginPath(); x.ellipse(...P(0.13, 0.68), 0.055 * W, 0.13 * H, -0.4, 0, Math.PI * 2); x.fill();
  x.fillStyle = skin; x.beginPath(); x.ellipse(...P(0.155, 0.655), 0.035 * W, 0.095 * H, -0.4, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#7a2a20'; x.fillRect(...P(0.16, 0.61), 0.014 * W, 0.01 * H);
  x.fillStyle = '#2a1a12'; x.fillRect(...P(0.15, 0.68), 0.01 * W, 0.008 * H); x.fillRect(...P(0.17, 0.675), 0.01 * W, 0.008 * H);
  return toTexture(c, { repeat: false });
}

// Lines of handwriting in a box: rows of small joined loops and strokes, now and then a gap
// between words, in `ink`.
function handwriting(x: CanvasRenderingContext2D, r: () => number, x0: number, y0: number, x1: number, y1: number, row: number, ink: string, size = 1) {
  x.strokeStyle = ink; x.lineWidth = 1.6 * size; x.lineCap = 'round';
  for (let y = y0 + row; y < y1; y += row) {
    let px = x0 + r() * 20, end = x1 - r() * row * 3;
    while (px < end) {
      const word = 20 + r() * 70;
      x.beginPath(); x.moveTo(px, y);
      for (let q = px; q < Math.min(px + word, end); q += 4 * size) {
        const up = r() < 0.12 ? row * 0.55 : row * 0.22;
        x.quadraticCurveTo(q + 2 * size, y - up * (0.5 + r()), q + 4 * size, y + (r() - 0.5) * 2);
      }
      x.stroke();
      px += word + 8 + r() * 10;
    }
  }
}

// Britt-Louise Sundell's gates of wrought iron at Mariatorget (1964), folded back against the
// walls of the halls at the platforms' ends by day: flat black bars dividing the grille into
// rectangles of many sizes, each filled with short lengths of tube set side by side as rings,
// large or small, or with upright bars and here and there a ball; cut out round the iron
// (photographs, 2010–2019). 4.8 by 2.4 m.
// Göran T Karlsson's painting at the western end of Zinkensdamm's platform for the trains south
// (1991), 3.7 by 3 m: on a white panel, a square of dark blue-black turning teal in its middle, a
// dome of red rising from its foot and a wedge of red hanging from its top edge (photographs,
// 2005–2011; redrawn as near as they show it)
export function karlssonPainting() {
  const W = 1110, H = 900, [c, x] = canvas(W, H), r = rng(1991);
  x.fillStyle = '#ecebe6'; x.fillRect(0, 0, W, H);
  const ix = 0.14 * W, iy = 0.1 * H, iw = 0.67 * W, ih = 0.84 * H;
  const P = (u: number, v: number): [number, number] => [ix + u * iw, iy + v * ih];
  x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(ix + 4, iy + 5, iw, ih);
  x.fillStyle = '#19212d'; x.fillRect(ix, iy, iw, ih);
  x.save(); x.beginPath(); x.rect(ix, iy, iw, ih); x.clip();
  for (const [u, v, rad, col] of [[0.32, 0.42, 0.3, 'rgba(38,84,108,0.7)'], [0.2, 0.7, 0.25, 'rgba(24,42,78,0.7)'], [0.75, 0.3, 0.3, 'rgba(16,24,34,0.6)']] as const) {
    const [cx, cy] = P(u, v), g = x.createRadialGradient(cx, cy, 0, cx, cy, rad * iw);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(ix, iy, iw, ih);
  }
  // (brushwork)
  for (let k = 0; k < 900; k++) {
    const [px, py] = P(r(), r());
    x.strokeStyle = `rgba(${r() < 0.5 ? '60,100,130' : '8,12,20'},${0.08 + r() * 0.1})`; x.lineWidth = 2 + r() * 4;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 40, py + (r() - 0.5) * 40); x.stroke();
  }
  x.fillStyle = '#d6301f';
  x.beginPath(); x.moveTo(...P(0.3, 1.02)); x.quadraticCurveTo(...P(0.31, 0.5), ...P(0.6, 0.49)); x.lineTo(...P(0.62, 1.02)); x.closePath(); x.fill();
  x.fillStyle = '#c62a1c';
  x.beginPath(); x.moveTo(...P(0.4, -0.02)); x.lineTo(...P(0.61, -0.02)); x.lineTo(...P(0.47, 0.17)); x.closePath(); x.fill();
  for (let k = 0; k < 300; k++) {
    const [px, py] = P(0.33 + r() * 0.27, 0.55 + r() * 0.45);
    x.strokeStyle = `rgba(${r() < 0.5 ? '240,80,50' : '150,20,15'},0.15)`; x.lineWidth = 2 + r() * 3;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 30, py + (r() - 0.5) * 30); x.stroke();
  }
  x.restore();
  return toTexture(c);
}

// John Stenborg's painting at the eastern end of Zinkensdamm's platform for the trains north
// (2003), 3.9 by 2.6 m: on a pale grey ground, leaves in greens and pale blue-grey shards
// scattered every way (photographs, 2011; redrawn as near as they show it)
export function stenborgLeaves() {
  const W = 1170, H = 780, [c, x] = canvas(W, H), r = rng(2003);
  x.fillStyle = '#b9c0c1'; x.fillRect(0, 0, W, H);
  const shard = (cx: number, cy: number, s: number, col: string) => {
    const a = r() * Math.PI;
    x.beginPath();
    for (let i = 0; i < 4; i++) {
      const t = a + (i * Math.PI) / 2 + (r() - 0.5) * 0.6, d = s * (0.5 + r() * 0.6);
      i ? x.lineTo(cx + Math.cos(t) * d, cy + Math.sin(t) * d) : x.moveTo(cx + Math.cos(t) * d, cy + Math.sin(t) * d);
    }
    x.closePath(); x.fillStyle = col; x.fill();
  };
  for (let k = 0; k < 70; k++) shard(r() * W, r() * H, 30 + r() * 70, ['#a6b6c2', '#c8d2d8', '#8e9eac', '#dfe4e4', '#b2c0c8'][Math.floor(r() * 5)]);
  const leaf = (cx: number, cy: number, len: number, a: number, col: string) => {
    x.save(); x.translate(cx, cy); x.rotate(a);
    x.beginPath(); x.moveTo(-len / 2, 0); x.quadraticCurveTo(0, -len * 0.32, len / 2, 0); x.quadraticCurveTo(0, len * 0.32, -len / 2, 0);
    x.fillStyle = col; x.fill();
    x.strokeStyle = 'rgba(210,235,190,0.5)'; x.lineWidth = 2; x.beginPath(); x.moveTo(-len * 0.45, 0); x.lineTo(len * 0.45, 0); x.stroke();
    x.restore();
  };
  for (let k = 0; k < 46; k++) leaf(r() * W, r() * H, 70 + r() * 150, r() * Math.PI, ['#3f8a3a', '#5aa04a', '#2f6e34', '#7ab85a', '#4c9440'][Math.floor(r() * 5)]);
  for (let k = 0; k < 30; k++) shard(r() * W, r() * H, 10 + r() * 22, r() < 0.6 ? '#2a5a2e' : '#e8ece8');
  x.strokeStyle = '#3a3e40'; x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6);
  return toTexture(c);
}

// The panel on the wall at the end of Midsommarkransen's middle hall (photographs, 2016–2025),
// 6.6 by 2.55 m: a frame of posts and rails painted dark green, wound with red stripes as a
// maypole is; along its top a dark board with FÖRSTADEN · MIDSOMMARKRANSEN in gold capitals; in
// its middle a panorama drawn in black on white of the garden suburb as it was, houses packed up
// its hills among trees; either side of it a field of dark blue-grey boards, upright, for the
// wooden wreaths on them (drawn apart, src/open-stations.ts); at either end a grey steel door;
// dark boards under it all.
export function forstadenPanel() {
  const PX = 160, Wm = 6.6, Hm = 2.55, W = Math.round(Wm * PX), H = Math.round(Hm * PX), [c, x] = canvas(W, H), r = rng(1979);
  const X = (m: number) => m * PX, Y = (m: number) => H - m * PX;
  // the boards behind it all
  x.fillStyle = '#2a3036'; x.fillRect(0, 0, W, H);
  for (let i = 0; i * 0.14 * PX < W; i++) {
    const v = Math.floor(r() * 10) - 5;
    x.fillStyle = `rgb(${46 + v},${54 + v},${62 + v})`; x.fillRect(i * 0.14 * PX + 1, 0, 0.14 * PX - 2, H);
  }
  // the panorama: a pale sky, hills, and houses up them, smaller as they climb, among trees
  const px0 = X(1.94), px1 = X(4.66), py0 = Y(2.15), py1 = Y(0.51), pw = px1 - px0, ph = py1 - py0;
  x.save(); x.beginPath(); x.rect(px0, py0, pw, ph); x.clip();
  const sky = x.createLinearGradient(0, py0, 0, py1);
  sky.addColorStop(0, '#e9e7e0'); sky.addColorStop(1, '#d8d5cc');
  x.fillStyle = sky; x.fillRect(px0, py0, pw, ph);
  const hill = (t: number) => py0 + ph * (0.28 + 0.12 * Math.sin(t * 5.2 + 0.6) + 0.06 * Math.sin(t * 13 + 2));
  x.fillStyle = '#cfccc2'; x.beginPath(); x.moveTo(px0, py1);
  for (let t = 0; t <= 1.001; t += 0.02) x.lineTo(px0 + pw * t, hill(t));
  x.lineTo(px1, py1); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(30,30,30,0.5)'; x.lineWidth = 1; x.stroke();
  // (hatching on the hill)
  x.strokeStyle = 'rgba(40,40,40,0.18)';
  for (let k = 0; k < 260; k++) {
    const t = r(), hx = px0 + pw * t, hy = hill(t) + r() * (py1 - hill(t));
    x.beginPath(); x.moveTo(hx, hy); x.lineTo(hx + 6, hy - 3); x.stroke();
  }
  // houses, from the top of the hills down, so the nearer cover the further
  for (let row = 0; row < 9; row++) {
    const depth = row / 8, size = 7 + depth * 22;
    for (let k = 0; k < 14 + row * 2; k++) {
      const t = r(), hx = px0 + pw * t, top = hill(t) + (py1 - hill(t)) * (depth * 0.85 + r() * 0.08);
      const w = size * (0.8 + r() * 0.6), hh = size * (0.5 + r() * 0.3);
      if (r() < 0.25) {
        // a tree: a dark round crown
        x.fillStyle = 'rgba(40,42,38,0.55)'; x.beginPath(); x.arc(hx, top, size * 0.35, 0, Math.PI * 2); x.fill();
        continue;
      }
      x.fillStyle = '#f2f0ea'; x.fillRect(hx - w / 2, top - hh, w, hh);
      x.strokeStyle = 'rgba(25,25,25,0.75)'; x.lineWidth = 0.8; x.strokeRect(hx - w / 2, top - hh, w, hh);
      x.fillStyle = '#4a4a46'; x.beginPath(); x.moveTo(hx - w / 2 - 1, top - hh); x.lineTo(hx, top - hh - size * 0.4); x.lineTo(hx + w / 2 + 1, top - hh); x.closePath(); x.fill();
      x.fillStyle = 'rgba(25,25,25,0.7)';
      for (let j = 0; j < 3; j++) x.fillRect(hx - w / 2 + w * (0.2 + j * 0.25), top - hh * 0.65, Math.max(1, w * 0.08), Math.max(1, hh * 0.2));
    }
  }
  // a road winding up through it
  x.strokeStyle = 'rgba(30,30,30,0.6)'; x.lineWidth = 1.2; x.beginPath();
  x.moveTo(px0 + pw * 0.05, py1 - 4); x.bezierCurveTo(px0 + pw * 0.4, py1 - ph * 0.1, px0 + pw * 0.5, py1 - ph * 0.35, px0 + pw * 0.8, py1 - ph * 0.45); x.stroke();
  x.restore();
  x.strokeStyle = '#1b1d1e'; x.lineWidth = 3; x.strokeRect(px0, py0, pw, ph);
  // the frame: posts and rails, dark green wound with red stripes
  const striped = (x0: number, y0: number, w: number, h: number, upright: boolean) => {
    x.fillStyle = '#245a34'; x.fillRect(x0, y0, w, h);
    x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
    x.fillStyle = '#c7362a';
    const step = 0.22 * PX, len = upright ? h : w;
    for (let k = -2; k * step < len + step; k++) {
      x.beginPath();
      if (upright) { const yy = y0 + k * step; x.moveTo(x0, yy); x.lineTo(x0 + w, yy - w * 0.9); x.lineTo(x0 + w, yy - w * 0.9 + step * 0.3); x.lineTo(x0, yy + step * 0.3); }
      else { const xx = x0 + k * step; x.moveTo(xx, y0 + h); x.lineTo(xx + h * 0.9, y0); x.lineTo(xx + h * 0.9 + step * 0.3, y0); x.lineTo(xx + step * 0.3, y0 + h); }
      x.closePath(); x.fill();
    }
    x.restore();
  };
  // the board along the top, and its name
  x.fillStyle = '#20262c'; x.fillRect(0, Y(2.5), W, 0.3 * PX);
  x.fillStyle = '#d9b45a'; x.font = `600 ${Math.round(0.19 * PX)}px Georgia, "Times New Roman", serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('FÖRSTADEN · MIDSOMMARKRANSEN', W / 2, Y(2.35) + 1);
  striped(0, Y(2.55), W, 0.05 * PX, false);
  striped(0, Y(2.2), W, 0.05 * PX, false);
  // the grey steel doors at either end, and the rails along the foot between them
  for (const xm of [0.08, 5.8]) {
    x.fillStyle = '#4d5154'; x.fillRect(X(xm), Y(2.15), X(0.72), X(2.15));
    x.fillStyle = '#5c6063'; x.fillRect(X(xm) + 4, Y(2.15) + 4, X(0.72) - 8, X(2.15) - 8);
    x.fillStyle = '#9a9ea1'; x.fillRect(X(xm < 1 ? xm + 0.6 : xm + 0.07), Y(1.15), 4, X(0.22));
  }
  x.fillStyle = '#e8c21c'; x.fillRect(X(5.82 + 0.28), Y(1.72), X(0.16), X(0.11));
  for (const yy of [0.17, 0.47]) striped(X(0.8), Y(yy + 0.04), X(5.0), 0.04 * PX, false);
  for (const xm of [0, 0.8, 1.86, 4.66, 5.72, 6.52]) striped(X(xm), Y(2.2), 0.08 * PX, 2.2 * PX, true);
  return toTexture(c, { repeat: false });
}

// The painted wooden relief of a summer night on the wall behind one of Midsommarkransen's
// platforms (photograph, 2005; sv.wikipedia, citing SL, gives the station's reliefs to Lisbet
// Lindholm and to Dag Wallin, and doesn't say which this is): tall upright boards side by side,
// birches white with black marks at either side, between them boards painted deep blue at their
// ragged heads running down into yellow and orange; a red bird spreading its wings, a red figure
// and a green one, a tall orange one, on a dark rock; each board carved round, lit from above and
// the left.
export function summerNightRelief() {
  const W = 540, H = 490, [c, x] = canvas(W, H), r = rng(1964);
  x.fillStyle = '#2a2220'; x.fillRect(0, 0, W, H);
  const widths: number[] = [];
  for (let at = 6; at < W - 30; ) { const w = 26 + r() * 22; widths.push(w); at += w + 2; }
  let xx = 6;
  widths.forEach((w, i) => {
    // birches at either side, the rest painted deep blue at their heads running down into yellow
    // and orange, their heads ragged
    const birch = i === 0 || i >= widths.length - 3;
    const top = birch && i > 0 ? 4 + r() * 12 : 16 + r() * 60;
    x.save(); x.beginPath(); x.moveTo(xx, H); x.lineTo(xx + 1, top + 12);
    x.lineTo(xx + w * 0.3, top + r() * 8); x.lineTo(xx + w * 0.62, top + 3 + r() * 12); x.lineTo(xx + w - 1, top + 14); x.lineTo(xx + w, H);
    x.closePath(); x.clip();
    if (birch) {
      x.fillStyle = '#eeede6'; x.fillRect(xx, 0, w, H);
      x.fillStyle = '#151515';
      for (let k = 0; k < 14; k++) { const yy = top + 20 + r() * (H - top - 60); x.fillRect(xx + r() * w * 0.5, yy, w * (0.3 + r() * 0.4), 3 + r() * 4); }
    } else {
      const f = 0.3 + r() * 0.3, g = x.createLinearGradient(0, top, 0, H);
      g.addColorStop(0, '#1b3584'); g.addColorStop(f * 0.85, '#2c56b8');
      g.addColorStop(Math.min(1, f + 0.12), i % 3 === 1 ? '#e07a22' : '#e8b628'); g.addColorStop(1, i % 3 === 1 ? '#c8601a' : '#d9a524');
      x.fillStyle = g; x.fillRect(xx, 0, w, H);
      // (brushed streaks: blue running down into the yellow, yellow up into the blue)
      const meet = top + (H - top) * f;
      for (let k = 0; k < 9; k++) {
        x.fillStyle = r() < 0.6 ? 'rgba(38,76,172,0.8)' : 'rgba(232,180,40,0.7)';
        x.fillRect(xx + r() * w, meet - 50 + r() * 70, 3 + r() * 5, 30 + r() * 80);
      }
    }
    // (each board carved round, lit from above and the left)
    const sh = x.createLinearGradient(xx, 0, xx + w, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0.3)'); sh.addColorStop(0.35, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)');
    x.fillStyle = sh; x.fillRect(xx, 0, w, H);
    x.restore();
    xx += w + 2;
  });
  // the figures: a red bird with its wings spread, to the left; a red figure and a green one
  // standing close; a tall one, orange, its head small
  x.fillStyle = '#c3221c'; x.beginPath();
  x.moveTo(W * 0.14, H * 0.38); x.quadraticCurveTo(W * 0.22, H * 0.47, W * 0.29, H * 0.43); x.quadraticCurveTo(W * 0.34, H * 0.48, W * 0.42, H * 0.36);
  x.quadraticCurveTo(W * 0.35, H * 0.56, W * 0.28, H * 0.54); x.quadraticCurveTo(W * 0.21, H * 0.54, W * 0.14, H * 0.38); x.fill();
  x.beginPath(); x.ellipse(W * 0.47, H * 0.68, 22, 62, 0.04, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(W * 0.47, H * 0.68 - 72, 15, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#4f7a34'; x.beginPath(); x.ellipse(W * 0.53, H * 0.71, 18, 54, -0.06, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(W * 0.53, H * 0.71 - 62, 12, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#e88a1c'; x.beginPath(); x.ellipse(W * 0.63, H * 0.55, 17, 150, 0.02, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(W * 0.632, H * 0.55 - 160, 11, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,240,180,0.35)'; x.beginPath(); x.ellipse(W * 0.625, H * 0.5, 5, 120, 0.02, 0, Math.PI * 2); x.fill();
  // the rock along the foot
  x.fillStyle = '#3d3330'; x.beginPath(); x.moveTo(0, H);
  for (let t = 0; t <= 1.001; t += 0.05) x.lineTo(W * t, H * (0.8 + 0.1 * t) - Math.sin(t * 7 + 1) * 16 - r() * 10);
  x.lineTo(W, H); x.closePath(); x.fill();
  x.fillStyle = 'rgba(120,96,80,0.35)';
  for (let k = 0; k < 40; k++) x.fillRect(r() * W, H * 0.88 + r() * H * 0.1, 8 + r() * 20, 2);
  return toTexture(c, { repeat: false });
}

// Jörgen Fogelquist's sgraffito of S. A. Andrée's balloon flight towards the pole (Med Örnen mot
// polen, 1981, inaugurated 1982) on the cream wall of Västertorp's ramp, 13 by 3.7 m: high up, the
// balloon Örnen, a tall dark pear scratched over with hatching, its rigging gathered into a
// small knot under it and one line hanging on down, from which the drag ropes sweep away along
// the wall to the left; clusters of short dark strokes under them and a column of them beside
// the line; and further along, a long jagged crack in the ice falling to the right (photograph,
// 2016). Drawn on a clear ground, to be cut out; the ramp's floor rises along it from 0 at the
// right to 1.05 m at the left, and nothing is drawn under that.
export function andreeBalloon() {
  const PX = 200, W = 13 * PX, H = Math.round(3.7 * PX), [c, x] = canvas(W, H), r = rng(1897);
  const M = (xm: number, ym: number): [number, number] => [xm * PX, H - ym * PX];
  const floor = (xm: number) => 1.05 * (1 - xm / 13);
  const ink = '#3a3c41';
  x.lineCap = 'round'; x.lineJoin = 'round';
  // a short curved stroke, like those the drawing is made of, at (xm, ym), `l` m long
  const stroke = (xm: number, ym: number, l: number, turn: number, w = 0.035) => {
    const [px, py] = M(xm, ym), dx = Math.cos(turn) * l * PX / 2, dy = -Math.sin(turn) * l * PX / 2;
    x.strokeStyle = ink; x.lineWidth = w * PX; x.beginPath(); x.moveTo(px - dx, py - dy);
    x.quadraticCurveTo(px + dy * 0.3, py - dx * 0.3, px + dx, py + dy); x.stroke();
  };
  // the balloon: a pear, widest 0.96 m across at 2.95 m, its top at 3.55 m, pointed at 1.65 m
  const bx = 5.6, outline: [number, number][] = [];
  for (let k = 0; k <= 48; k++) {
    const t = (k / 48) * Math.PI * 2, s = Math.sin(t), cth = Math.cos(t);
    const ym = cth > 0 ? 2.95 + cth * 0.6 : 2.95 + cth * 1.3, w = cth > 0 ? 0.48 : 0.48 * Math.pow(1 + cth * 0.999, 0.75);
    outline.push([bx + s * w, ym]);
  }
  x.fillStyle = '#45474c'; x.beginPath();
  outline.forEach(([a, b], k) => { const [px, py] = M(a, b); if (k) x.lineTo(px, py); else x.moveTo(px, py); });
  x.closePath(); x.fill();
  x.save(); x.clip();
  // (scratched over: fine hatching, paler to the left where the light falls, a few pale streaks)
  for (let k = 0; k < 900; k++) {
    const a = bx - 0.5 + r(), b = 1.6 + r() * 2.0, [px, py] = M(a, b), pale = a < bx - 0.1 ? 0.22 : 0.08;
    x.strokeStyle = `rgba(220,214,196,${pale * r()})`; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 6 + r() * 10, py - 10 - r() * 14); x.stroke();
  }
  x.fillStyle = 'rgba(214,208,190,0.35)';
  x.fillRect(...M(bx - 0.18, 3.25), 0.07 * PX, 0.5 * PX); x.fillRect(...M(bx + 0.12, 2.85), 0.05 * PX, 0.7 * PX);
  x.fillStyle = 'rgba(20,20,24,0.35)'; x.fillRect(...M(bx + 0.28, 3.3), 0.2 * PX, 1.4 * PX);
  x.restore();
  // the rigging down to a knot, and the line on down from it
  x.strokeStyle = ink; x.lineWidth = 0.012 * PX;
  for (const d of [-0.32, -0.15, 0, 0.15, 0.32]) { x.beginPath(); x.moveTo(...M(bx + d, 2.0 + Math.abs(d) * 0.8)); x.lineTo(...M(bx - 0.02, 1.48)); x.stroke(); }
  x.fillStyle = ink; x.beginPath(); x.ellipse(...M(bx - 0.03, 1.42), 0.07 * PX, 0.09 * PX, 0, 0, Math.PI * 2); x.fill();
  stroke(bx - 0.12, 1.36, 0.16, 0.6, 0.02); stroke(bx + 0.06, 1.36, 0.16, 2.5, 0.02);
  x.lineWidth = 0.016 * PX; x.beginPath(); x.moveTo(...M(bx - 0.03, 1.36)); x.lineTo(...M(bx - 0.08, 0.95)); x.stroke();
  // the drag ropes, sweeping away to the left, each a little higher at its end
  const ropes: [number, number, number][] = [[0.0, 1.95, 0.016], [0.3, 1.62, 0.02], [0.9, 1.4, 0.014], [0.2, 1.2, 0.018], [1.6, 1.75, 0.012]];
  for (const [ex, ey, w] of ropes) {
    x.lineWidth = w * PX; x.beginPath(); x.moveTo(...M(bx - 0.08, 0.95));
    x.bezierCurveTo(...M(bx - 1.6, 1.05 + (ey - 1.2) * 0.3), ...M((bx + ex) / 2, ey - 0.05), ...M(ex, ey)); x.stroke();
    // (frayed into short strokes along the way)
    for (let k = 0; k < 14; k++) { const t = r(), xm = bx - 0.1 + (ex - bx) * t, ym = 0.95 + (ey - 0.95) * Math.pow(t, 0.7); stroke(xm, ym + (r() - 0.5) * 0.08, 0.12 + r() * 0.12, Math.PI + 0.25 + r() * 0.3, 0.02); }
  }
  // the clusters of short strokes under the ropes, above the floor, and the column beside the line
  for (let k = 0; k < 160; k++) {
    const xm = 0.15 + Math.pow(r(), 1.3) * 4.2, lo = floor(xm) + 0.18, hi = Math.min(1.75, 0.95 + (bx - xm) * 0.08);
    if (hi <= lo) continue;
    stroke(xm, lo + r() * (hi - lo), 0.1 + r() * 0.12, Math.PI + 0.2 + (r() - 0.5) * 0.9, 0.03 + r() * 0.025);
  }
  for (let k = 0; k < 55; k++) stroke(6.0 + r() * 0.5 + (r() - 0.5) * 0.15, 0.55 + r() * 1.05, 0.08 + r() * 0.1, 0.2 + (r() - 0.5) * 1.2, 0.03 + r() * 0.02);
  // the crack in the ice, a thin line in short jagged steps, falling to the right, here and there a
  // finer line along under it
  const crack: [number, number][] = [[8.25, 3.05]];
  for (let cx = 8.25, cy = 3.05; cx < 12.6;) {
    cx += 0.04 + r() * 0.13;
    cy = Math.max(floor(cx) + 0.2, cy + (r() < 0.4 ? r() * 0.2 : -0.05 - r() * 0.25));
    crack.push([cx, cy]);
  }
  x.strokeStyle = '#41444d'; x.lineWidth = 0.035 * PX; x.beginPath();
  crack.forEach(([a, b], k) => { const [px, py] = M(a, b); if (k) x.lineTo(px, py); else x.moveTo(px, py); });
  x.stroke();
  x.lineWidth = 0.012 * PX;
  for (let k = 0; k + 1 < crack.length; k++) {
    if (r() < 0.55) continue;
    x.beginPath(); x.moveTo(...M(crack[k][0], crack[k][1] - 0.045)); x.lineTo(...M(crack[k + 1][0], crack[k + 1][1] - 0.045)); x.stroke();
  }
  return toTexture(c, { repeat: false });
}

// The same artist's eagle, on the ramp's other wall, 3.6 by 2.6 m: a white bird with its wings
// spread and drooping, its head turned to the right, its feathers drawn in fine scratched lines and
// rows of dark chevrons, on a rough field of charcoal black scattered with white dots, its edge
// irregular against the wall (photograph, 2007). Cut out round the field.
export function andreeEagle() {
  const W = 1080, H = 780, [c, x] = canvas(W, H), r = rng(1982);
  const P = (u: number, v: number): [number, number] => [u * W, (1 - v) * H];
  const poly = (fill: string, pts: [number, number][]) => {
    x.fillStyle = fill; x.beginPath();
    pts.forEach(([u, v], k) => { const [px, py] = P(u, v); if (k) x.lineTo(px, py); else x.moveTo(px, py); });
    x.closePath(); x.fill();
  };
  // the field, its edge wandering
  const edge: [number, number][] = [];
  const corners: [number, number][] = [[0.06, 0.92], [0.5, 0.97], [0.93, 0.9], [0.98, 0.5], [0.95, 0.06], [0.5, 0.03], [0.02, 0.08], [0.01, 0.5]];
  corners.forEach((p, k) => {
    const q = corners[(k + 1) % corners.length];
    for (let j = 0; j < 6; j++) { const t = j / 6; edge.push([p[0] + (q[0] - p[0]) * t + (r() - 0.5) * 0.02, p[1] + (q[1] - p[1]) * t + (r() - 0.5) * 0.025]); }
  });
  poly('#2b2c2e', edge);
  x.save(); x.beginPath(); edge.forEach(([u, v], k) => { const [px, py] = P(u, v); if (k) x.lineTo(px, py); else x.moveTo(px, py); }); x.closePath(); x.clip();
  for (let k = 0; k < 6000; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '90,90,92' : '15,15,16'},0.35)`; x.fillRect(r() * W, r() * H, 2, 2); }
  x.fillStyle = '#e4e0d6';
  for (let k = 0; k < 110; k++) { x.beginPath(); x.arc(r() * W, r() * H, 4 + r() * 2.5, 0, Math.PI * 2); x.fill(); }
  x.restore();
  // the bird: its left wing raised and hanging out to the left, its body and fanned tail, its head
  // turned to the right, and its right wing hanging out to the right
  const white = '#e6e2d8';
  poly(white, [[0.22, 0.62], [0.2, 0.8], [0.25, 0.86], [0.2, 0.84], [0.1, 0.7], [0.04, 0.48], [0.03, 0.28], [0.07, 0.22], [0.15, 0.3], [0.22, 0.42], [0.27, 0.5]]);
  poly(white, [[0.25, 0.7], [0.36, 0.82], [0.44, 0.92], [0.5, 0.94], [0.56, 0.88], [0.55, 0.76], [0.52, 0.55], [0.46, 0.38], [0.42, 0.22], [0.4, 0.1], [0.33, 0.07], [0.27, 0.1], [0.28, 0.26], [0.24, 0.45]]);
  poly(white, [[0.25, 0.04], [0.42, 0.04], [0.44, 0.14], [0.38, 0.2], [0.3, 0.2], [0.24, 0.13]]);
  poly(white, [[0.52, 0.72], [0.57, 0.86], [0.66, 0.84], [0.76, 0.76], [0.86, 0.6], [0.94, 0.4], [0.97, 0.2], [0.93, 0.14], [0.84, 0.2], [0.78, 0.3], [0.72, 0.32], [0.62, 0.3], [0.55, 0.4]]);
  // (the beak and the eye, the dark of its crown)
  poly('#2b2c2e', [[0.5, 0.9], [0.55, 0.87], [0.57, 0.84], [0.53, 0.85]]);
  x.fillStyle = '#2b2c2e'; x.beginPath(); x.arc(...P(0.3, 0.64), 9, 0, Math.PI * 2); x.fill();
  x.fillStyle = white; x.beginPath(); x.arc(...P(0.3, 0.64), 4, 0, Math.PI * 2); x.fill();
  // feathers: fine scratched lines over the white, and rows of dark chevrons
  for (let k = 0; k < 1400; k++) {
    const [px, py] = P(0.05 + r() * 0.9, 0.06 + r() * 0.86);
    const d = x.getImageData(Math.floor(px), Math.floor(py), 1, 1).data;
    if (d[0] < 200) continue;
    x.strokeStyle = 'rgba(70,68,64,0.45)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 6, py + 8 + r() * 10); x.stroke();
  }
  const chevron = (u: number, v: number, s: number) => {
    const [px, py] = P(u, v);
    x.fillStyle = '#2f3032'; x.beginPath(); x.moveTo(px - s, py - s * 0.6); x.quadraticCurveTo(px, py + s * 0.4, px + s, py - s * 0.6); x.quadraticCurveTo(px, py + s * 1.1, px - s, py - s * 0.6); x.fill();
  };
  for (const [u0, v0, u1, v1, n] of [[0.08, 0.32, 0.16, 0.72, 9], [0.12, 0.3, 0.2, 0.6, 7], [0.3, 0.2, 0.42, 0.5, 8], [0.32, 0.12, 0.4, 0.14, 4], [0.6, 0.36, 0.7, 0.66, 6],
    [0.74, 0.32, 0.9, 0.52, 7], [0.78, 0.26, 0.93, 0.36, 6], [0.62, 0.7, 0.84, 0.6, 7]] as const) {
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; chevron(u0 + (u1 - u0) * t + (r() - 0.5) * 0.01, v0 + (v1 - v0) * t + (r() - 0.5) * 0.01, 7 + r() * 5); }
  }
  return toTexture(c, { repeat: false });
}

// Fredrik Landergren's glass mosaics at Fruängen (2005): heads in close-up, each a framed square of
// small glass tiles a couple of centimetres across, in the tones of one colour with a scattering of
// another (Swedish Wikipedia; photographs, 2010 and 2016). Seven on the wall by the bus terminal, from
// the south: yellow, green-brown, orange and brown, greys, green, red and blue, blue; and an eighth,
// larger, over the stairs in the hall, in khaki browns and lilac greys with red. These are faces of
// our own in that manner, not copies of his: `variant` 0 to 7 picks the colours and the pose.
export function landergrenFace(variant: number) {
  const N = 64, T = 6, F = 10, S = N * T + 2 * F, [c, x] = canvas(S, S), r = rng(2005 + variant * 17);
  const pal = [
    ['#4a3410', '#8a6418', '#c9971f', '#e9c548', '#f6e8a8', '#7a8a3a'],
    ['#2e2a18', '#5a5430', '#7e7a48', '#a8a070', '#d2ccaa', '#8a5a30'],
    ['#3a1c10', '#7a3a18', '#c0601c', '#e8902c', '#f2c88a', '#5a8a3a'],
    ['#1e1e1e', '#4a4a4a', '#787878', '#a8a8a6', '#e0e0dc', '#5a5a64'],
    ['#16301e', '#2e5a36', '#4e8a56', '#86b88a', '#d6ead2', '#2a4a5a'],
    ['#2a1830', '#8a2028', '#c83a3a', '#5a78b8', '#e8c8c0', '#283a8a'],
    ['#0e1a3a', '#1e3a7a', '#3a64b0', '#7aa8dc', '#d8e8f6', '#283040'],
    ['#2e2418', '#5a4a30', '#7e7058', '#a69a8a', '#d6ccd4', '#b03028'],
  ][variant % 8].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  // the middle of the face, its size and tilt, and the side the light comes from; glasses on the blue one
  const [cx, cy, sc, tilt] = [[0.05, 0.02, 1.0, 0.08], [-0.1, 0.05, 1.05, -0.05], [0.15, 0.0, 1.15, 0.25], [0.0, 0.1, 1.1, 0.0],
    [-0.05, 0.0, 1.0, -0.1], [0.08, 0.05, 0.95, 0.12], [0.0, 0.0, 1.0, 0.0], [0.0, 0.2, 1.25, 0.0]][variant % 8];
  const co = Math.cos(tilt), si = Math.sin(tilt), light = variant % 2 ? -0.6 : 0.6, glasses = variant === 6;
  const ell = (X: number, Y: number, ax: number, ay: number, rx: number, ry: number) => ((X - ax) / rx) ** 2 + ((Y - ay) / ry) ** 2;
  // how light the face is at px, py (each -1 to 1 across the square, y down)
  const value = (px: number, py: number) => {
    const dx = (px - cx) / sc, dy = (py - cy) / sc, X = dx * co + dy * si, Y = -dx * si + dy * co;
    let v = 0.3 + 0.08 * Math.sin(px * 3 + variant);
    const head = ell(X, Y, 0, 0.05, 0.72, 0.98);
    if (head < 1) {
      // the skin, lit from one side and darker towards the edge; the hair over the forehead
      v = 0.62 + 0.22 * light * X - 0.25 * Math.max(0, head - 0.6);
      if (Y < -0.62 + 0.08 * Math.cos(X * 9)) v = 0.12 + 0.06 * Math.sin(X * 23 + Y * 7);
      for (const k of [-1, 1]) {
        // the eye's socket, the eye (its iris dark, the white round it, a glint), the brow
        const ex = 0.27 * k, ey = -0.12, sock = ell(X, Y, ex, ey, 0.2, 0.12), eye = ell(X, Y, ex, ey, 0.12, 0.045);
        if (sock < 1) v -= 0.18 * (1 - sock);
        if (eye < 1) v = eye < 0.35 ? 0.06 : 0.8;
        if (ell(X, Y, ex + 0.03, ey - 0.012, 0.022, 0.02) < 1) v = 0.97;
        if (Math.abs(Y + 0.27 - 0.06 * ((X - ex) / 0.18) ** 2) < 0.03 && Math.abs(X - ex) < 0.19) v = 0.15;
        if (glasses && Math.abs(Math.sqrt(ell(X, Y, ex, ey + 0.01, 0.2, 0.15)) - 1) < 0.12) v = 0.05;
      }
      if (glasses && Math.abs(Y + 0.12) < 0.02 && Math.abs(X) < 0.08) v = 0.05;
      // the nose: its shaded side, its tip, the nostrils
      if (X * -light > 0 && Math.abs(X) < 0.07 && Y > -0.08 && Y < 0.25) v -= 0.18;
      if (ell(X, Y, 0, 0.22, 0.1, 0.06) < 1) v += 0.1;
      for (const k of [-1, 1]) if (ell(X, Y, 0.065 * k, 0.29, 0.035, 0.022) < 1) v = 0.1;
      // the lips and the line between them; the cheeks' light and the shade under the chin
      if (ell(X, Y, 0, 0.5, 0.24, 0.07) < 1) v = Y > 0.5 ? 0.48 : 0.36;
      if (Math.abs(Y - 0.5) < 0.012 && Math.abs(X) < 0.23) v = 0.1;
      for (const k of [-1, 1]) { const ch = ell(X, Y, 0.33 * k, 0.18, 0.18, 0.14); if (ch < 1) v += 0.08 * (1 - ch) * (k * light > 0 ? 1 : 0.3); }
      if (Y > 0.75) v -= 0.12;
    } else if (Y > 0.8 && Math.abs(X) < 0.35 + Math.max(0, Y - 1.0) * 1.5) v = 0.45 + 0.15 * light * X;
    return v;
  };
  // the steel frame, the grout, and the tiles: each the tone nearest its lightness give or take a
  // little, here and there one of the other colour
  x.fillStyle = '#7a7d80'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#4a4a46'; x.fillRect(F, F, N * T, N * T);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const v = value(((i + 0.5) / N) * 2 - 1, ((j + 0.5) / N) * 2 - 1) + (r() - 0.5) * 0.22;
    const [cr, cg, cb] = r() < 0.06 ? pal[5] : pal[Math.max(0, Math.min(4, Math.floor(v * 5)))], d = Math.floor(r() * 20) - 10;
    x.fillStyle = `rgb(${cr + d},${cg + d},${cb + d})`; x.fillRect(F + i * T + 0.6, F + j * T + 0.6, T - 1.2, T - 1.2);
    if (r() < 0.3) { x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(F + i * T + 1, F + j * T + 1, 2, 1); }
  }
  return toTexture(c, { repeat: false });
}

// The wall behind the penguin in Aspudden's middle hall (photographs, 2014 and 2019): glossy tiles
// 10 cm square in pale joints, a deep royal blue over its left part, folded out of the wall in a
// wedge, and a saffron yellow over the rest, the two meeting along a diagonal from the top towards
// the floor; drawn flat, the fold's lower plane a darker blue, and a door tiled over in the yellow.
// 12.4 m wide and 3.0 m high.
export function penguinWall() {
  const PX = 80, W = Math.round(12.4 * PX), H = Math.round(3.0 * PX), [c, x] = canvas(W, H), r = rng(1987);
  const t = 0.1 * PX;
  // (the diagonal: from the top 5.2 m along to the floor 3.2 m along; the fold's crease from the top
  // left corner down to the floor 2.4 m along)
  const edge = (yy: number) => (5.2 + (3.2 - 5.2) * (yy / H)) * PX, crease = (yy: number) => 2.4 * PX * (yy / H);
  x.fillStyle = '#c9c5b6'; x.fillRect(0, 0, W, H);
  for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
    const px = i * t + t / 2, py = j * t + t / 2, v = Math.floor(r() * 12) - 6;
    const blue = px < edge(py), low = px < crease(py);
    x.fillStyle = blue ? (low ? `rgb(${30 + v},${36 + v},${120 + v})` : `rgb(${36 + v},${48 + v},${160 + v})`) : `rgb(${236 + v},${178 + v},${36 + v})`;
    x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(i * t + 2, j * t + 2, t * 0.45, 2);
  }
  // (the fold's edges, and the door's thin steel outline)
  x.strokeStyle = 'rgba(20,20,40,0.5)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(edge(0), 0); x.lineTo(edge(H), H); x.stroke();
  x.beginPath(); x.moveTo(0, 0); x.lineTo(crease(H), H); x.stroke();
  x.strokeStyle = 'rgba(120,110,90,0.8)'; x.lineWidth = 2;
  x.strokeRect(8.6 * PX, H - 2.1 * PX, 0.9 * PX, 2.1 * PX);
  x.fillStyle = '#8a8478'; x.fillRect(9.35 * PX, H - 1.05 * PX, 0.06 * PX, 0.03 * PX);
  return toTexture(c);
}

// The leaves of Midsommarkransen's wooden wreath (1978): carved leaves overlapping like scales,
// painted greens, their veins darker, round the ring (a repeat 0.5 m along it and once round its
// thickness).
export function wreathLeaves() {
  const W = 256, H = 256, [c, x] = canvas(W, H), r = rng(1978);
  x.fillStyle = '#1f4a22'; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 90; k++) {
    const cx = r() * W, cy = r() * H, len = 34 + r() * 18, wid = 16 + r() * 8, a = -0.4 + (r() - 0.5) * 0.6;
    const v = Math.floor(r() * 30);
    for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
      x.save(); x.translate(cx + dx, cy + dy); x.rotate(a);
      x.fillStyle = `rgb(${46 + v},${118 + v * 1.2},${52 + v * 0.6})`; x.beginPath(); x.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,220,0.12)'; x.beginPath(); x.ellipse(-2, -3, len / 2.4, wid / 3.4, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(20,50,20,0.7)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(-len / 2, 0); x.lineTo(len / 2, 0); x.stroke();
      x.lineWidth = 0.8;
      for (let j = -2; j <= 2; j++) { x.beginPath(); x.moveTo(j * len / 7, 0); x.lineTo(j * len / 7 + len / 10, -wid / 3); x.moveTo(j * len / 7, 0); x.lineTo(j * len / 7 + len / 10, wid / 3); x.stroke(); }
      x.strokeStyle = 'rgba(10,30,10,0.6)'; x.lineWidth = 1.2; x.beginPath(); x.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2); x.stroke();
      x.restore();
    }
  }
  return toTexture(c);
}

// The flowers on Midsommarkransen's wreath, carved and painted (KransenKidz, 2025; photographs):
// side by side, each cut out round its outline: an ox-eye daisy, a buttercup, a harebell, a violet.
export function wreathFlowers() {
  const S = 128, [c, x] = canvas(S * 4, S);
  const petals = (cx: number, n: number, len: number, wid: number, col: string, edge: string) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      x.save(); x.translate(cx, S / 2); x.rotate(a);
      x.fillStyle = col; x.beginPath(); x.ellipse(len / 2, 0, len / 2, wid / 2, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = edge; x.lineWidth = 1.5; x.stroke();
      x.restore();
    }
  };
  // a daisy
  petals(S / 2, 16, 58, 13, '#f6f6f2', 'rgba(150,150,140,0.7)');
  x.fillStyle = '#e8b21e'; x.beginPath(); x.arc(S / 2, S / 2, 14, 0, Math.PI * 2); x.fill();
  // a buttercup
  petals(S * 1.5, 5, 46, 34, '#f2c428', 'rgba(150,110,10,0.7)');
  x.fillStyle = '#c99410'; x.beginPath(); x.arc(S * 1.5, S / 2, 9, 0, Math.PI * 2); x.fill();
  // a harebell, seen from its mouth
  petals(S * 2.5, 5, 50, 30, '#2a4fc4', 'rgba(10,20,80,0.8)');
  x.fillStyle = '#16307e'; x.beginPath(); x.arc(S * 2.5, S / 2, 16, 0, Math.PI * 2); x.fill();
  // a violet
  petals(S * 3.5, 5, 48, 34, '#5b3c8e', 'rgba(30,15,50,0.8)');
  x.fillStyle = '#f0d040'; x.beginPath(); x.arc(S * 3.5, S / 2, 8, 0, Math.PI * 2); x.fill();
  return toTexture(c, { repeat: false });
}

export function sundellGate() {
  const W = 960, H = 480, [c, x] = canvas(W, H), r = rng(1964);
  x.clearRect(0, 0, W, H);
  x.strokeStyle = '#1e1e1d'; x.fillStyle = '#1e1e1d';
  const cells: [number, number, number, number][] = [];
  const split = (x0: number, y0: number, w: number, h: number, depth: number) => {
    if (depth > 4 || (w < 120 && h < 120) || (depth > 1 && r() < 0.2)) { cells.push([x0, y0, w, h]); return; }
    if (w > h * (0.7 + r() * 0.7)) { const k = Math.round(w * (0.3 + r() * 0.4)); split(x0, y0, k, h, depth + 1); split(x0 + k, y0, w - k, h, depth + 1); }
    else { const k = Math.round(h * (0.3 + r() * 0.4)); split(x0, y0, w, k, depth + 1); split(x0, y0 + k, w, h - k, depth + 1); }
  };
  split(10, 10, W - 20, H - 20, 0);
  for (const [x0, y0, w, h] of cells) {
    if (r() < 0.8) {
      // rings, as many as fit in rows and columns
      const d = [16, 22, 30, 42, 60][Math.floor(r() * 5)];
      const nx = Math.max(1, Math.floor(w / d)), ny = Math.max(1, Math.floor(h / d)), sx = w / nx, sy = h / ny;
      x.lineWidth = Math.max(2.5, d * 0.13);
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        x.beginPath(); x.arc(x0 + (i + 0.5) * sx, y0 + (j + 0.5) * sy, Math.max(2, Math.min(sx, sy) / 2 - x.lineWidth / 2), 0, Math.PI * 2); x.stroke();
      }
    } else {
      // upright bars, and a ball on one
      x.lineWidth = 5;
      for (let k = 14; k < w - 6; k += 24) { x.beginPath(); x.moveTo(x0 + k, y0); x.lineTo(x0 + k, y0 + h); x.stroke(); }
      x.beginPath(); x.arc(x0 + 14 + 24 * Math.floor(r() * Math.max(1, (w - 20) / 24)), y0 + h * (0.3 + r() * 0.4), 9, 0, Math.PI * 2); x.fill();
    }
  }
  // the flat bars between the rectangles, and the frame
  x.lineWidth = 8;
  for (const [x0, y0, w, h] of cells) x.strokeRect(x0, y0, w, h);
  x.lineWidth = 16; x.strokeRect(8, 8, W - 16, H - 16);
  // a little light caught on the iron's top edges
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = 'rgba(150,150,145,0.18)';
  for (let j = 0; j < H; j += 6) x.fillRect(0, j, W, 1.5);
  x.globalCompositeOperation = 'source-over';
  return toTexture(c);
}

// Helén Partos's Sirat (Vällingby, 2010): lace cut out of steel plate as crocheted doilies are,
// dark brown with rust, each panel a piece of cloth of its own shape: rosettes of holes in rings
// round a middle, petals between the rings, and a net of small holes between the rosettes, a
// solid rim round its edge; cut out round its outline (photographs, 2013 and 2026). `k` picks
// one of the panels. 2.6 by 2.7 m.
export function siratLace(k: number) {
  const W = 640, H = 664, [c, x] = canvas(W, H), r = rng(2010 + k * 17);
  const cx = W * (0.47 + r() * 0.06), cy = H * (0.48 + r() * 0.06), w1 = r() * 6, w2 = r() * 6;
  const R = (t: number) => 0.4 + 0.05 * Math.sin(3 * t + w1) + 0.035 * Math.sin(5 * t + w2) + 0.015 * Math.sin(11 * t + k);
  const outline = () => {
    x.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * Math.PI * 2, rr = R(t), px = cx + Math.cos(t) * rr * W, py = cy + Math.sin(t) * rr * H;
      if (i) x.lineTo(px, py); else x.moveTo(px, py);
    }
    x.closePath();
  };
  const steel = '#3c2b22';
  x.clearRect(0, 0, W, H);
  outline(); x.fillStyle = steel; x.fill();
  // the net, cut all over
  x.globalCompositeOperation = 'destination-out';
  for (let j = 0; j * 20 < H; j++) for (let i = 0; i * 20 < W; i++) {
    x.beginPath(); x.arc(i * 20 + (j % 2) * 10 + 10, j * 20 + 10, 6, 0, Math.PI * 2); x.fill();
  }
  // the rosettes: a solid disc each, and in it rings of round holes and of petals in turn
  const rosettes: [number, number, number][] = [[cx + (r() - 0.5) * W * 0.1, cy + (r() - 0.5) * H * 0.1, W * (0.2 + r() * 0.05)]];
  for (let q = 0; q < 2; q++) {
    const a = r() * Math.PI * 2, d = 0.22 + r() * 0.08;
    rosettes.push([cx + Math.cos(a) * d * W, cy + Math.sin(a) * d * H, W * (0.09 + r() * 0.05)]);
  }
  for (const [ox, oy, rad] of rosettes) {
    x.globalCompositeOperation = 'source-over';
    x.save(); outline(); x.clip();
    x.fillStyle = steel; x.beginPath(); x.arc(ox, oy, rad, 0, Math.PI * 2); x.fill();
    x.restore();
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.arc(ox, oy, rad * 0.09, 0, Math.PI * 2); x.fill();
    const rings = Math.max(2, Math.round(rad / 22));
    for (let m = 1; m <= rings; m++) {
      const rr = (m / (rings + 0.4)) * rad, n = Math.max(6, Math.round((2 * Math.PI * rr) / 26));
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2 + (m % 2) * (Math.PI / n), px = ox + Math.cos(t) * rr, py = oy + Math.sin(t) * rr;
        x.beginPath();
        if (m % 2) x.ellipse(px, py, 9, 4.5, t, 0, Math.PI * 2);
        else x.arc(px, py, 5.5, 0, Math.PI * 2);
        x.fill();
      }
    }
  }
  // the rim, solid round the edge, and the rust on the steel
  x.globalCompositeOperation = 'source-over';
  outline(); x.strokeStyle = steel; x.lineWidth = 12; x.stroke();
  x.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 900; i++) {
    x.fillStyle = r() < 0.5 ? 'rgba(122,62,32,0.35)' : 'rgba(20,14,10,0.3)';
    x.fillRect(r() * W, r() * H, 2 + r() * 6, 2 + r() * 6);
  }
  x.globalCompositeOperation = 'source-over';
  return toTexture(c, { repeat: false });
}

// Sture V Nilsson's Strindberg wall at Rådmansgatan (1983), 3.6 by 1.85 m on its black tiles: on
// the left a page of his manuscript, a sketch faint behind its lines, and under it his signature,
// both on white enamel in a bronze ground; on the right twelve squares of copper, bronze and steel,
// his writing etched faintly into them.
export function strindbergWall() {
  const W = 1440, H = 740, [c, x] = canvas(W, H), r = rng(1983);
  const ground = x.createLinearGradient(0, 0, W, H);
  ground.addColorStop(0, '#a5814f'); ground.addColorStop(1, '#7d6340');
  x.fillStyle = ground; x.fillRect(0, 0, W, H);
  // the manuscript
  x.fillStyle = '#ebe8e0'; x.fillRect(26, 22, 540, 380);
  x.strokeStyle = 'rgba(120,130,140,0.35)'; x.lineWidth = 3;
  x.beginPath(); x.ellipse(170, 250, 90, 120, 0.3, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.moveTo(110, 330); x.quadraticCurveTo(180, 200, 250, 340); x.stroke();
  x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(295, 22, 3, 380);
  handwriting(x, r, 50, 30, 285, 390, 26, '#2d3440');
  handwriting(x, r, 310, 30, 550, 300, 26, '#2d3440');
  // the signature
  x.fillStyle = '#efede7'; x.fillRect(56, 450, 480, 200);
  x.fillStyle = '#16181c'; x.font = 'italic 78px "Brush Script MT", "Segoe Script", cursive';
  // (squeezed into the panel, whichever script the browser has)
  const sw = x.measureText('August Strindberg').width;
  x.save(); x.translate(80, 575); x.rotate(-0.06); x.scale(Math.min(1, 430 / sw), 1); x.fillText('August Strindberg', 0, 0); x.restore();
  x.strokeStyle = '#16181c'; x.lineWidth = 4; x.beginPath(); x.moveTo(90, 610); x.quadraticCurveTo(300, 640, 500, 585); x.stroke();
  // the squares of metal
  const metals = ['#b4703e', '#8d6b3c', '#a9aaa5', '#c08a52', '#6f5a40', '#9c5a32', '#b9b8b2', '#8a7650', '#a06c3e', '#7c7d78', '#b8814a', '#94653a'];
  const cw = 205, ch = 233;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
    const sx = 598 + i * cw, sy = 22 + j * ch, col = metals[j * 4 + i];
    x.save(); x.beginPath(); x.rect(sx + 3, sy + 3, cw - 6, ch - 6); x.clip();
    x.fillStyle = col; x.fillRect(sx + 3, sy + 3, cw - 6, ch - 6);
    const sheen = x.createLinearGradient(sx, sy, sx + cw * 0.6, sy + ch);
    sheen.addColorStop(0, 'rgba(255,255,255,0.18)'); sheen.addColorStop(1, 'rgba(0,0,0,0.18)');
    x.fillStyle = sheen; x.fillRect(sx + 3, sy + 3, cw - 6, ch - 6);
    for (let k = 0; k < 14; k++) {
      x.fillStyle = `rgba(${r() < 0.5 ? '40,30,20' : '230,220,200'},${0.05 + r() * 0.1})`;
      x.beginPath(); x.ellipse(sx + r() * cw, sy + r() * ch, 10 + r() * 40, 6 + r() * 25, r() * Math.PI, 0, Math.PI * 2); x.fill();
    }
    handwriting(x, r, sx + 12, sy + 8, sx + cw - 12, sy + ch - 10, 20, 'rgba(40,28,18,0.35)', 0.8);
    x.restore();
  }
  speckle(x, W, H, 6000, 0.08, 1983);
  return toTexture(c, { repeat: false });
}

// Blå tornet, the house on Drottninggatan where Strindberg lived his last years, on the same
// wall: its corner tower over five storeys of orange-red render, among lines of his writing in a
// dark grey ground, 1.7 by 2.2 m.
export function blueTower() {
  const W = 520, H = 672, [c, x] = canvas(W, H), r = rng(1912);
  x.fillStyle = '#2b2b2e'; x.fillRect(0, 0, W, H);
  handwriting(x, r, 14, 10, W - 14, H - 10, 22, 'rgba(210,205,195,0.45)');
  // the two fronts meeting at the corner, seen from below
  const front = (pts: [number, number][], fill: string) => { x.fillStyle = fill; x.beginPath(); pts.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill(); };
  const cx = 300, top = 190, foot = 640;
  front([[cx, top], [cx, foot], [100, foot - 20], [118, top + 50]], '#d4692e');
  front([[cx, top], [cx, foot], [470, foot - 30], [452, top + 60]], '#b24f22');
  // windows, storey by storey
  for (let k = 0; k < 5; k++) {
    const y = top + 70 + k * 78;
    for (let i = 0; i < 4; i++) {
      const lx = 130 + i * 42, ly = y + (4 - i) * 4;
      x.fillStyle = '#3a261e'; x.fillRect(lx, ly, 22, 40);
      x.fillStyle = 'rgba(255,230,190,0.5)'; x.fillRect(lx, ly - 4, 22, 3);
    }
    for (let i = 0; i < 3; i++) {
      const lx = 320 + i * 44, ly = y + i * 5;
      x.fillStyle = '#331f18'; x.fillRect(lx, ly, 22, 40);
    }
  }
  // the tower on the corner: a round bay, its dome and lantern
  x.fillStyle = '#c55d29'; x.fillRect(cx - 42, top - 70, 84, 120);
  x.fillStyle = '#3a261e'; for (const dx of [-28, 8]) x.fillRect(cx + dx, top - 50, 20, 34);
  x.fillStyle = '#4f6f7a'; x.beginPath(); x.ellipse(cx, top - 70, 46, 52, 0, Math.PI, 0); x.fill();
  x.fillRect(cx - 6, top - 150, 12, 30);
  x.fillStyle = '#2d3f46'; x.beginPath(); x.moveTo(cx - 10, top - 150); x.lineTo(cx, top - 180); x.lineTo(cx + 10, top - 150); x.fill();
  // the cornice and the dark roofs over the fronts
  x.fillStyle = '#e8b48a'; x.fillRect(118, top + 44, cx - 118, 8); x.fillRect(cx, top + 44, 452 - cx, 8);
  front([[118, top + 44], [cx, top + 30], [cx, top + 44]], '#5a3a2c');
  front([[cx, top + 30], [452, top + 50], [452, top + 54], [cx, top + 44]], '#4a2e24');
  speckle(x, W, H, 2500, 0.1, 1912);
  return toTexture(c, { repeat: false });
}

// Glass wind screens on a viaduct's edge, in steel frames 1.25 m apart: some panes printed with a
// big green leaf (maple, lime, horse chestnut, rowan, oak, birch) outlined in white, the rest
// plain. Eight panes across, 2.2 m high; the glass itself faintly tinted.
export function leafGlass(leaves: boolean) {
  const PX = 96, pw = 1.25 * PX, W = Math.round(8 * pw), H = Math.round(2.2 * PX), [c, x] = canvas(W, H);
  const r = rng(leaves ? 1991 : 1992);
  x.clearRect(0, 0, W, H);
  x.fillStyle = 'rgba(190,210,214,0.28)'; x.fillRect(0, 0, W, H);
  const leaf = (kind: number, cx: number, cy: number, s: number) => {
    x.save(); x.translate(cx, cy); x.rotate(r() * 0.5 - 0.25);
    x.fillStyle = ['#3f8f3a', '#4c9b3e', '#3a8536'][kind % 3]; x.strokeStyle = 'rgba(240,244,236,0.95)'; x.lineWidth = 2.5;
    const blade = (len: number, wd: number, a: number) => {
      x.save(); x.rotate(a); x.beginPath(); x.moveTo(0, 0);
      x.bezierCurveTo(wd, -len * 0.3, wd * 0.8, -len * 0.8, 0, -len); x.bezierCurveTo(-wd * 0.8, -len * 0.8, -wd, -len * 0.3, 0, 0);
      x.fill(); x.stroke(); x.restore();
    };
    if (kind === 0) for (const a of [-1.3, -0.65, 0, 0.65, 1.3]) blade(s * (a === 0 ? 1 : 0.8), s * 0.42, a);        // maple
    else if (kind === 1) for (const [dx, dy, k] of [[-0.3, -0.2, 0.55], [0.3, -0.5, 0.6], [0, 0.25, 0.5]]) {          // lime
      x.save(); x.translate(dx * s, dy * s); blade(s * k, s * k * 0.75, r() - 0.5); x.restore();
    }
    else if (kind === 2) for (const a of [-1.6, -1.05, -0.5, 0, 0.5, 1.05, 1.6]) blade(s * (1 - Math.abs(a) * 0.22), s * 0.22, a); // horse chestnut
    else if (kind === 3) {                                                                                                   // rowan
      x.strokeStyle = '#3a6a30'; x.beginPath(); x.moveTo(0, s * 0.6); x.lineTo(0, -s); x.stroke(); x.strokeStyle = 'rgba(240,244,236,0.95)';
      for (let k = 0; k < 6; k++) for (const side of [-1, 1]) {
        x.save(); x.translate(0, s * 0.45 - k * s * 0.27); blade(s * 0.32, s * 0.09, side * 1.2); x.restore();
      }
      blade(s * 0.3, s * 0.09, 0);
    } else if (kind === 4) {                                                                                                 // oak
      x.beginPath(); x.moveTo(0, s * 0.5);
      for (let k = 0; k <= 12; k++) { const t = k / 12, y = s * 0.5 - t * s * 1.4, w = s * 0.32 * Math.sin(Math.PI * t) * (k % 2 ? 0.65 : 1); x.lineTo(w, y); }
      for (let k = 12; k >= 0; k--) { const t = k / 12, y = s * 0.5 - t * s * 1.4, w = s * 0.32 * Math.sin(Math.PI * t) * (k % 2 ? 0.65 : 1); x.lineTo(-w, y); }
      x.fill(); x.stroke();
    } else blade(s * 0.9, s * 0.55, 0);                                                                                     // birch
    x.restore();
  };
  for (let k = 0; k < 8; k++) {
    if (leaves && k % 4 !== 3) leaf((k * 5 + Math.floor(r() * 3)) % 6, k * pw + pw / 2, H * 0.62, 0.62 * PX);
  }
  // the frames: posts between the panes, a rail along the top and the foot
  x.fillStyle = '#8c9296';
  for (let k = 0; k <= 8; k++) x.fillRect(k * pw - 3, 0, 6, H);
  x.fillRect(0, 0, W, 5); x.fillRect(0, H - 8, W, 8);
  return toTexture(c);
}

// Small square setts in rows, grey with a few warmer.
export function smallSetts() {
  const W = 160, [c, x] = canvas(W, W), r = rng(1990);
  x.fillStyle = '#4a4a48'; x.fillRect(0, 0, W, W);
  const t = 16;
  for (let j = 0; j < W / t; j++) {
    let i = -((j * 7) % t);
    while (i < W) {
      const l = t - 3 + Math.floor(r() * 6), v = 120 + Math.floor(r() * 50), warm = r() < 0.25 ? 18 : 0;
      x.fillStyle = `rgb(${v + warm},${v + warm / 3},${v - warm / 3})`;
      for (const dx of [0, W]) x.fillRect(i + dx + 1.5, j * t + 1.5, l - 3, t - 3);
      i += l;
    }
  }
  speckle(x, W, W, 1500, 0.2, 73);
  return toTexture(c);
}

// The finishes of a styled open station's halls, passages and stairs, each `size` m a repeat
// (across, and up a wall or along a floor). Walls are drawn as seen, from the floor up; their
// glass is left clear (the glass itself is drawn apart). `clamp`: drawn to a height, not repeating.
export const FINISH_SIZE: Record<Finish, [number, number]> = {
  clerestory: [1.2, 4], windows: [1.2, 4], glazed: [1.2, 1.8], yellowTiles: [1.2, 1.2], boardConcrete: [2.4, 2.4],
  darkStone: [2.4, 2.4], pavers: [2.4, 2.4], triangles: [2.4, 2.4], slats: [1.2, 1.2],
  whiteTiles: [1.2, 2.4], terrazzo: [2.4, 2.4], whitePanels: [1.2, 2.4], greyTiles: [2.4, 2.4], redLineTiles: [1.2, 2.4],
  darkGlazed: [1.4, 2.6], slate: [2.4, 2.4], darkTiles: [1.2, 2.4], greyPanels: [1.2, 2.4],
  highWindows: [1.2, 4], paleGreenTiles: [1.2, 1.2], paleTiles: [2.4, 2.4], asphalt: [2.4, 2.4],
  stripes: [2.4, 2.4], greenWindows: [1.2, 4], checkWindows: [1.5, 2.8], blueTiles: [1.2, 3], tiledWindows: [1.2, 3],
  gridTerrazzo: [2.1, 2.1], shopWindows: [4.8, 3.6], storeys: [1.8, 10.8], liftWindows: [1.3, 3.9],
  redWindows: [1.2, 4.2], shutter: [1.2, 4.2], redPanels: [1.2, 3], perforated: [2.4, 2.4], lineMosaic: [4.8, 4.8],
  creamPanels: [1.2, 1.2], blueGlazed: [1.2, 2.4], blueClerestory: [1.2, 4.2], steelFront: [1.2, 4.2], ribbedMetal: [1.2, 1.2],
  whiteBranches: [2.4, 2.4], darkBranches: [2.4, 2.4], basketTiles: [1.2, 1.2], granite: [2.4, 2.4],
  whitePerforated: [1.2, 1.2], roughcast: [2.4, 2.4], hallTiles: [1.2, 6.9], glassFront: [1.2, 6.9],
  greenTerrazzo: [4.8, 4.8], squareTiles: [1.2, 1.2], whiteRender: [2.4, 2.4], bwTiles: [2.4, 2.4], tealWindows: [1.2, 3.2],
  greenGlazed: [1.2, 3], greenFront: [1.2, 5.4], greenDoors: [1.2, 5.4], creamTiles: [1.2, 1.2], creamClerestory: [1.2, 5.4],
  silverPerforated: [1.2, 3], libraryFront: [1.8, 8.3], libraryBack: [1.8, 8.3], libraryEntrance: [1.8, 8.3],
  blackTiles: [1.2, 1.2], glassBlocks: [1.2, 1.2], blueMosaic: [2.4, 2.4], warmMosaic: [2.4, 2.4], brownWindows: [1.2, 3.2],
  terracottaPanels: [1.2, 2.4], orangeTiles: [1.2, 1.2], redGranite: [2.4, 2.4], brick: [1.2, 1.2],
  steelGlazed: [1.2, 3], darkTerrazzo: [2.4, 2.4], birchX: [5.4, 2.6],
  tealTiles: [1.2, 3.4], darkWindows: [1.2, 3.2], blackFront: [1.2, 3.9], orangePanels: [1.2, 1.2],
  splitBlocks: [1.2, 1.2], cladding: [1.2, 1.2], cladClerestory: [1.2, 7.6], frostedPanels: [1.2, 3.4],
  redRock: [2.4, 2.4], redBand: [1.2, 2.15], redFront: [1.2, 6.9], gridPanels: [1.25, 3.25], navyTiles: [1.2, 1.2],
  pineBoards: [1.2, 1.2], redTiles: [1.2, 1.2], bronzeGlass: [1.5, 3.6], greenTiles: [1.2, 1.2], crossMosaic: [4.8, 2.6],
  crossTerrazzo: [2.4, 2.4], bronzeGlazed: [1.2, 3.6], pixelTiles: [4.8, 3.6],
  ballast: [2.4, 2.4], strawTiles: [1.2, 1.2], reedTiles: [2.4, 2.4], iceTerrazzo: [7.2, 7.2], rockMosaic: [4.8, 3.6],
  clinkerWindows: [1.2, 2.5], greyClerestory: [1.2, 2.5], portalTiles: [1.2, 1.2], liftPanes: [1.5, 4.8],
  roxnerTiles: [2.4, 2.4], roxnerClerestory: [2.4, 4.8], greyGlazed: [1.2, 3], sageRender: [2.4, 2.4], bottleTiles: [1.2, 1.2],
  purpleTiles: [2.4, 3.6], rivetedSteel: [1.2, 1.2],
  glossTiles: [1.5, 1.5], stripeTiles: [1.5, 1.5], twoGreens: [1.9, 3.0], latticeConcrete: [1.2, 1.2],
  scrollPanels: [7.8, 2.7], opPanels: [1.4, 4.8], circleFront: [1.2, 4.2], stripPanels: [0.9, 4], maroonGlazed: [1.2, 3.6], slateGlazed: [1.4, 4.6],
  goranssonTiles: [1.8, 1.8], greenBooth: [2.1, 2.7],
  barkGrey: [0.75, 2.4], barkRed: [0.75, 2.4], checkTiles: [1.2, 1.2], mosaicPosters: [4.8, 4.8], vallingbyCentrum: [3.6, 8.0],
  wiredGlazed: [1.2, 3], dripTiles: [2.4, 2.7], ochreDoor: [3.6, 3.15],
  greenEnamel: [2.4, 3.3], tornellEnamel: [4.8, 3.3], brownTiles: [1.2, 1.2],
  partosTiles: [7.2, 4.8], cafeWall: [1.2, 1.2], iridescentTiles: [2.4, 2.4],
  striated: [2.5, 3.0], triangleTiles: [4.8, 3.0], redClinker: [2.4, 2.4], rods: [1.2, 4.2],
  wineTiles: [2.2, 0.99], uprightTiles: [1.2, 1.2], bandGlazed: [1.3, 3.2], shards: [3.6, 3.0], narrowTiles: [0.84, 0.96],
  brassTerrazzo: [4.8, 9.6], kransenTiles: [0.6, 0.96], kransenHall: [1.2, 3.4],
  ochreClinker: [1.2, 1.2], morseClinker: [14.47, 6.0], blastedRock: [4.8, 4.8],
  kioskFront: [12.0, 4.5], tfpWestFront: [21.24, 4.5], tfpSouthFront: [24.4, 4.5],
  tricolourWindows: [1.35, 3.6], tricolourTiles: [1.35, 1.35], quarryTiles: [2.4, 2.4], darkBoards: [1.2, 1.2], hgaFront: [16.3, 3.0],
  creamRender: [2.4, 2.4], slateFlags: [2.4, 2.4], darkPavers: [2.4, 2.4],
  gingham: [1.2, 1.2], orangeGingham: [1.2, 1.2], greyBooth: [1.2, 2.6], blueBooth: [1.4, 3.6], fraBuilding: [6.0, 7.15], fraEntrance: [10.12, 7.15],
  aspuddenStrips: [1.2, 1.8], amberTiles: [1.2, 1.0], aspuddenHall: [1.2, 1.2], aspuddenPavilion: [1.15, 4.0],
  ornsbergTimber: [2.4, 3.75], ornsbergWindows: [3.0, 3.75], ornsbergFront: [18.53, 3.75],
};
export const FINISH_GLASS: Finish[] = ['clerestory', 'windows', 'glazed', 'darkGlazed', 'highWindows', 'greenWindows', 'checkWindows', 'tiledWindows', 'liftWindows', 'redWindows', 'blueGlazed', 'blueClerestory', 'steelFront', 'hallTiles', 'glassFront', 'tealWindows', 'greenGlazed', 'greenFront', 'greenDoors', 'creamClerestory', 'libraryEntrance', 'brownWindows', 'steelGlazed', 'darkWindows', 'blackFront', 'redFront', 'bronzeGlazed', 'clinkerWindows', 'greyClerestory', 'roxnerClerestory', 'greyGlazed', 'circleFront', 'stripPanels', 'maroonGlazed', 'slateGlazed', 'bandGlazed', 'tricolourWindows', 'greyBooth', 'blueBooth', 'aspuddenPavilion'];
export const FINISH_CLAMP: Finish[] = ['clerestory', 'windows', 'highWindows', 'greenWindows', 'checkWindows', 'tiledWindows', 'shopWindows', 'storeys', 'liftWindows', 'redWindows', 'shutter', 'blueGlazed', 'blueClerestory', 'steelFront', 'hallTiles', 'glassFront', 'tealWindows', 'greenGlazed', 'greenFront', 'greenDoors', 'creamClerestory', 'libraryFront', 'libraryBack', 'libraryEntrance', 'brownWindows', 'steelGlazed', 'tealTiles', 'darkWindows', 'blackFront', 'cladClerestory', 'frostedPanels', 'redBand', 'redFront', 'gridPanels', 'clinkerWindows', 'greyClerestory', 'liftPanes', 'roxnerClerestory', 'greyGlazed', 'purpleTiles', 'circleFront', 'stripPanels', 'greenBooth', 'mosaicPosters', 'vallingbyCentrum', 'wiredGlazed', 'dripTiles', 'ochreDoor', 'tornellEnamel', 'striated', 'triangleTiles', 'rods', 'bandGlazed', 'kransenHall', 'kioskFront', 'tfpWestFront', 'tfpSouthFront', 'tricolourWindows', 'hgaFront', 'greyBooth', 'blueBooth', 'fraBuilding', 'fraEntrance', 'aspuddenPavilion', 'ornsbergTimber', 'ornsbergWindows', 'ornsbergFront'];
export function finish(name: Finish) {
  const PX = 160, [w, h] = FINISH_SIZE[name], W = Math.round(w * PX), H = Math.round(h * PX), [c, x] = canvas(W, H);
  const r = rng(name.length * 131 + 7);
  // heights up the wall, in metres, to the canvas's rows
  const Y = (m: number) => H - m * PX;
  const band = (from: number, to: number, fill: string) => { x.fillStyle = fill; x.fillRect(0, Y(to), W, (to - from) * PX); };
  const yellow = '#e0b13a', grey = '#cfd1ce', steel = '#7a8086';
  const pane = (from: number, to: number, frame: string, mullion: number) => {
    x.clearRect(0, Y(to), W, (to - from) * PX);
    x.fillStyle = frame;
    x.fillRect(0, Y(to), mullion * PX / 2, (to - from) * PX);
    x.fillRect(W - mullion * PX / 2, Y(to), mullion * PX / 2, (to - from) * PX);
  };
  const panels = (from: number, to: number) => {
    band(from, to, grey);
    x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(3, Y(to), W * 0.3, (to - from) * PX);
    x.fillStyle = 'rgba(60,62,64,0.6)'; x.fillRect(0, Y(to), 2, (to - from) * PX); x.fillRect(W - 2, Y(to), 2, (to - from) * PX);
    x.fillRect(0, Y((from + to) / 2), W, 2);
  };
  switch (name) {
    case 'clerestory':
      band(0, 4, '#8e9295');
      band(0, 0.1, '#55585a');
      panels(0.1, 2.1);
      band(2.1, 2.2, yellow); pane(2.2, 2.9, yellow, 0.1); band(2.9, 3.0, yellow);
      break;
    case 'windows':
      band(0, 4, '#8e9295');
      band(0, 0.1, '#55585a');
      panels(0.1, 0.9);
      band(0.9, 0.98, yellow); pane(0.98, 2.2, yellow, 0.1); band(2.2, 2.27, yellow); pane(2.27, 3.0, yellow, 0.1); band(3.0, 3.08, yellow);
      break;
    case 'glazed':
      pane(0, h, steel, 0.1);
      x.fillStyle = steel; x.fillRect(0, Y(0.04), W, 0.08 * PX);
      x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(0, Y(0.04), W, 2);
      break;
    case 'yellowTiles': {
      x.fillStyle = '#b3aa96'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        x.fillStyle = `rgb(${218 + Math.floor(r() * 14)},${178 + Math.floor(r() * 12)},${88 + Math.floor(r() * 16)})`;
        x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
      }
      break;
    }
    case 'boardConcrete':
      for (let j = 0; j * 0.1 * PX < H; j++) {
        const v = 158 + Math.floor(r() * 8);
        x.fillStyle = `rgb(${v},${v - 2},${v - 6})`; x.fillRect(0, j * 0.1 * PX, W, 0.1 * PX);
        x.fillStyle = 'rgba(80,78,74,0.18)'; x.fillRect(0, j * 0.1 * PX, W, 1);
      }
      for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(80,76,70,${0.03 + r() * 0.05})`; x.fillRect(r() * W, r() * H, 20 + r() * 120, 3 + r() * 10); }
      break;
    case 'darkStone': {
      x.fillStyle = '#2c2d2f'; x.fillRect(0, 0, W, H);
      const t = 0.4 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 70 + Math.floor(r() * 14);
        x.fillStyle = `rgb(${v},${v + 1},${v + 4})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
      }
      break;
    }
    case 'pavers': {
      x.fillStyle = '#56544f'; x.fillRect(0, 0, W, H);
      const a = 0.3 * PX, b = 0.2 * PX;
      for (let i = 0; i * b < W; i++) for (let j = -1; j * a < H; j++) {
        const v = 128 + Math.floor(r() * 20);
        x.fillStyle = `rgb(${v},${v - 2},${v - 6})`; x.fillRect(i * b + 1.5, j * a + (i % 2) * a / 2 + 1.5, b - 3, a - 3);
      }
      break;
    }
    case 'darkPavers': {
      // as the pavers, darker, 20 × 30 cm, in a running bond across the way
      x.fillStyle = '#34332f'; x.fillRect(0, 0, W, H);
      const a = 0.3 * PX, b = 0.2 * PX;
      for (let i = 0; i * b < W; i++) for (let j = -1; j * a < H; j++) {
        const v = 78 + Math.floor(r() * 16);
        x.fillStyle = `rgb(${v},${v - 1},${v - 4})`; x.fillRect(i * b + 1.5, j * a + (i % 2) * a / 2 + 1.5, b - 3, a - 3);
      }
      speckle(x, W, H, 6000, 0.12, 63);
      break;
    }
    case 'triangles': {
      // squares of 1.2 m split corner to corner: pale stone above and below, black at the sides
      const t = 1.2 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const x0 = i * t, y0 = j * t, cx = x0 + t / 2, cy = y0 + t / 2;
        const tri = (pts: number[][], fill: string) => { x.fillStyle = fill; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) x.lineTo(q[0], q[1]); x.closePath(); x.fill(); };
        tri([[x0, y0], [x0 + t, y0], [cx, cy]], '#ddd5c4'); tri([[x0, y0 + t], [x0 + t, y0 + t], [cx, cy]], '#ddd5c4');
        tri([[x0, y0], [x0, y0 + t], [cx, cy]], '#3b3c3e'); tri([[x0 + t, y0], [x0 + t, y0 + t], [cx, cy]], '#3b3c3e');
      }
      speckle(x, W, H, 9000, 0.18, 61); speckle(x, W, H, 4000, 0.12, 62, true);
      break;
    }
    case 'whiteTiles': {
      // 15 cm tiles, and at 1.5 m to 1.65 m a band of black lozenges on yellow
      x.fillStyle = '#a9aba8'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 236 + Math.floor(r() * 10);
        x.fillStyle = `rgb(${v},${v},${v - 2})`; x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
      }
      const y0 = Y(1.65);
      for (let i = 0; i * t < W; i += 2) {
        x.fillStyle = '#d9b238'; x.fillRect(i * t + 1, y0 + 1, t - 2, t - 2);
        x.fillStyle = '#1e1f21'; x.beginPath();
        x.moveTo(i * t + t / 2, y0 + 3); x.lineTo(i * t + t - 3, y0 + t / 2); x.lineTo(i * t + t / 2, y0 + t - 3); x.lineTo(i * t + 3, y0 + t / 2); x.closePath(); x.fill();
      }
      break;
    }
    case 'terrazzo': {
      x.fillStyle = '#8f8f8b'; x.fillRect(0, 0, W, H);
      const t = 0.6 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 168 + Math.floor(r() * 10);
        x.fillStyle = `rgb(${v},${v},${v - 4})`; x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
      }
      speckle(x, W, H, 14000, 0.22, 64); speckle(x, W, H, 6000, 0.18, 65, true);
      break;
    }
    case 'whitePanels':
      x.fillStyle = '#e9eae6'; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(70,72,74,0.45)'; x.fillRect(0, 0, 2, H); x.fillRect(W - 2, 0, 2, H);
      x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(3, 0, 3, H);
      break;
    case 'greyTiles': {
      x.fillStyle = '#4a4b4c'; x.fillRect(0, 0, W, H);
      const t = 0.3 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 104 + Math.floor(r() * 14);
        x.fillStyle = `rgb(${v},${v + 1},${v + 3})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
      }
      break;
    }
    case 'redLineTiles': {
      // 15 cm tiles, and at 1.2 m a thin dark red line (on the walls beside stairs it follows them
      // down, as the walls' heights are measured up from the steps)
      x.fillStyle = '#a9aba8'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 234 + Math.floor(r() * 10);
        x.fillStyle = `rgb(${v},${v},${v - 3})`; x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
      }
      x.fillStyle = '#7a2622'; x.fillRect(0, Y(1.23), W, 0.03 * PX);
      break;
    }
    case 'darkGlazed':
      // two panes 0.7 m wide, the frames all but black; a sill rail at the foot
      pane(0, h, '#26282a', 0.07);
      x.fillStyle = '#26282a'; x.fillRect(W / 2 - 0.035 * PX, 0, 0.07 * PX, H); x.fillRect(0, Y(0.12), W, 0.12 * PX); x.fillRect(0, 0, W, 0.05 * PX);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0, Y(0.12), W, 1.5);
      break;
    case 'slate': {
      // 60 by 30 cm, in a running bond, each slab a slightly different dark blue-grey, riven
      x.fillStyle = '#2b2e31'; x.fillRect(0, 0, W, H);
      const a = 0.6 * PX, b = 0.3 * PX;
      for (let j = 0; j * b < H; j++) for (let i = -1; i * a < W; i++) {
        const v = 74 + Math.floor(r() * 16), ox = i * a + (j % 2) * a / 2;
        x.fillStyle = `rgb(${v - 4},${v + 1},${v + 8})`; x.fillRect(ox + 1.5, j * b + 1.5, a - 3, b - 3);
        for (let k = 0; k < 6; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '30,32,36' : '140,146,152'},0.12)`; x.fillRect(ox + r() * a, j * b + r() * b, 8 + r() * 30, 1.5); }
      }
      break;
    }
    case 'darkTiles': {
      // 30 by 60 cm, laid on end
      x.fillStyle = '#26282a'; x.fillRect(0, 0, W, H);
      const a = 0.3 * PX, b = 0.6 * PX;
      for (let i = 0; i * a < W; i++) for (let j = 0; j * b < H; j++) {
        const v = 66 + Math.floor(r() * 8);
        x.fillStyle = `rgb(${v},${v + 2},${v + 5})`; x.fillRect(i * a + 1, j * b + 1, a - 2, b - 2);
      }
      break;
    }
    case 'greyPanels':
      // standing panels 0.6 m wide, dark grey, with a seam between them
      x.fillStyle = '#5a5f63'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 2; i++) {
        x.fillStyle = 'rgba(30,32,34,0.6)'; x.fillRect(i * W / 2, 0, 2, H);
        x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(i * W / 2 + 2, 0, 2, H);
      }
      break;
    case 'highWindows': {
      // pale grey blocks, 40 by 20 cm, to 2.5 m; above, windows in grey steel frames
      band(0, 4, '#cfd0cd');
      const a = 0.4 * PX, b = 0.2 * PX;
      for (let j = 0; j * b < 2.5 * PX; j++) for (let i = -1; i * a < W; i++) {
        const v = 196 + Math.floor(r() * 10);
        x.fillStyle = `rgb(${v},${v + 1},${v - 1})`; x.fillRect(i * a + (j % 2) * a / 2 + 1, Y(0) - (j + 1) * b + 1, a - 2, b - 2);
      }
      band(2.5, 2.6, steel); pane(2.6, 3.9, steel, 0.1); band(3.9, 4, steel);
      break;
    }
    case 'paleGreenTiles': {
      x.fillStyle = '#93a8a0'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        x.fillStyle = `rgb(${178 + Math.floor(r() * 10)},${206 + Math.floor(r() * 8)},${194 + Math.floor(r() * 8)})`;
        x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
      }
      break;
    }
    case 'paleTiles': {
      x.fillStyle = '#a6a49e'; x.fillRect(0, 0, W, H);
      const t = 0.3 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 222 + Math.floor(r() * 10);
        x.fillStyle = `rgb(${v},${v - 1},${v - 6})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
      }
      break;
    }
    case 'stripes': {
      // bands of tiles 30 by 7.5 cm, white and black, the bands one to four rows deep
      const rows = [2, 1, 3, 1, 2, 2, 1, 1, 3, 1, 2, 1, 3, 2, 1, 1, 2, 1, 1, 1];
      const t = 0.075 * PX, a = 0.3 * PX;
      x.fillStyle = '#8d8e8c'; x.fillRect(0, 0, W, H);
      let j = 0;
      rows.forEach((n, k) => {
        const black = k % 2 === 1;
        for (let q = 0; q < n; q++, j++) for (let i = -1; i * a < W; i++) {
          const v = black ? 26 + Math.floor(r() * 10) : 232 + Math.floor(r() * 12);
          x.fillStyle = `rgb(${v},${v},${v + (black ? 2 : -2)})`;
          x.fillRect(i * a + (j % 2) * a / 2 + 1, Y(0) - (j + 1) * t + 1, a - 2, t - 2);
        }
      });
      break;
    }
    case 'greenWindows': {
      // green sheet-metal panels 0.6 m wide, ribbed, to 2.5 m; above, windows in grey steel frames
      band(0, 4, '#3d7f58');
      for (let i = 0; i * 0.15 * PX < W; i++) { x.fillStyle = i % 4 === 0 ? 'rgba(20,40,28,0.55)' : 'rgba(255,255,255,0.08)'; x.fillRect(i * 0.15 * PX, Y(2.5), 2, 2.5 * PX); }
      band(0, 0.08, '#5b5f61');
      band(2.5, 2.6, steel); pane(2.6, 3.9, steel, 0.1); band(3.9, 4, steel);
      break;
    }
    case 'checkWindows': {
      // 15 cm tiles checked in blue and white (now and then a pale blue or beige one) to 1.05 m; a
      // dark steel sill, then two rows of panes in dark frames, and a steel head
      const t = 0.15 * PX, dark = '#2a2e33';
      x.fillStyle = '#9a9c9a'; x.fillRect(0, Y(1.05), W, 1.05 * PX);
      for (let i = 0; i * t < W; i++) for (let j = 0; (j + 1) * t <= 1.05 * PX + 1; j++) {
        const k = r();
        x.fillStyle = (i + j) % 2 ? (k < 0.12 ? '#d9cdb0' : '#eceeec') : (k < 0.2 ? '#8fb1d6' : '#2f5ea6');
        x.fillRect(i * t + 1, Y(0) - (j + 1) * t + 1, t - 2, t - 2);
      }
      band(1.05, 1.13, dark); pane(1.13, 1.95, dark, 0.08); band(1.95, 2.03, dark); pane(2.03, 2.7, dark, 0.08); band(2.7, 2.8, dark);
      x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(0, Y(1.13), W, 1.5);
      break;
    }
    case 'blueTiles': {
      // 15 cm tiles, white, a scattering of blue, pale blue and beige ones; from 2.4 m to 2.85 m a
      // band checked in dark blue and white
      x.fillStyle = '#a3a6a6'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX, cols = ['#2f5ea6', '#8fb1d6', '#d9cdb0', '#a7bcc6'];
      for (let i = 0; i * t < W; i++) for (let j = 0; (j + 1) * t <= H; j++) {
        const y = (j + 0.5) * 0.15, k = r(), c = cols[Math.floor(r() * cols.length)], v = 232 + Math.floor(r() * 10);
        x.fillStyle = y > 2.4 && y < 2.85 ? ((i + j) % 2 ? `rgb(${v},${v},${v})` : '#2a4f94') : k < 0.12 ? c : `rgb(${v},${v},${v - 2})`;
        x.fillRect(i * t + 1, Y(0) - (j + 1) * t + 1, t - 2, t - 2);
      }
      break;
    }
    case 'tiledWindows': {
      // 15 cm tiles in white, pale blue, beige and grey to 0.9 m; above, tall windows in dark blue
      // frames
      const t = 0.15 * PX, frame = '#1f2940', cols = ['#eceeec', '#eceeec', '#a9c3dc', '#ddd0b4', '#c3c8c8', '#e2b78e'];
      x.fillStyle = '#9a9c9a'; x.fillRect(0, Y(0.9), W, 0.9 * PX);
      for (let i = 0; i * t < W; i++) for (let j = 0; j < 6; j++) {
        x.fillStyle = cols[Math.floor(r() * cols.length)];
        x.fillRect(i * t + 1, Y(0) - (j + 1) * t + 1, t - 2, t - 2);
      }
      band(0.9, 0.98, frame); pane(0.98, 2.92, frame, 0.1); band(2.92, 3, frame);
      break;
    }
    case 'gridTerrazzo': {
      // cream terrazzo squares, 25 cm, set in a grid of dark grey strips 5 cm wide
      x.fillStyle = '#4c4d4e'; x.fillRect(0, 0, W, H);
      const t = 0.3 * PX, g = 0.05 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 214 + Math.floor(r() * 10);
        x.fillStyle = `rgb(${v},${v - 6},${v - 22})`; x.fillRect(i * t + g / 2, j * t + g / 2, t - g, t - g);
      }
      speckle(x, W, H, 14000, 0.22, 68); speckle(x, W, H, 5000, 0.18, 69, true);
      break;
    }
    case 'shopWindows': {
      // two shop fronts 2.4 m wide: a steel plinth, a lit window to 2.5 m, the frame, a sign board
      // on a band over it, and white render above
      band(0, 3.6, '#e4e2dc');
      const shop = x.createLinearGradient(0, Y(2.5), 0, Y(0.1));
      shop.addColorStop(0, '#e2dccb'); shop.addColorStop(1, '#b8b09e');
      x.fillStyle = shop; x.fillRect(0, Y(2.5), W, 2.4 * PX);
      const bay = 2.4 * PX;
      [['#7a2b2e', '#efe6d2'], ['#2b4a7a', '#f2f2ee']].forEach(([board, text], k) => {
        const x0 = k * bay;
        // shelves and goods behind the glass
        for (const y of [0.7, 1.3, 1.9]) {
          x.fillStyle = 'rgba(90,84,74,0.5)'; x.fillRect(x0 + 0.15 * PX, Y(y), bay - 0.3 * PX, 3);
          for (let n = 0; n < 9; n++) {
            x.fillStyle = ['#b2483c', '#3f6f9a', '#d6a640', '#5c8a52', '#efeae0'][Math.floor(r() * 5)];
            x.fillRect(x0 + 0.2 * PX + r() * (bay - 0.5 * PX), Y(y + 0.12 + r() * 0.2), 0.08 * PX + r() * 0.12 * PX, 0.1 * PX + r() * 0.1 * PX);
          }
        }
        x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(x0, Y(2.5), bay * 0.35, 2.4 * PX);
        x.fillStyle = '#8e9498';
        x.fillRect(x0, Y(2.5), 0.06 * PX, 2.4 * PX); x.fillRect(x0 + bay / 2 - 0.02 * PX, Y(2.5), 0.04 * PX, 2.4 * PX);
        x.fillStyle = board; x.fillRect(x0 + 0.3 * PX, Y(3.02), bay - 0.6 * PX, 0.34 * PX);
        x.fillStyle = text; x.fillRect(x0 + 0.6 * PX, Y(2.88), bay - 1.2 * PX, 0.06 * PX);
      });
      band(0, 0.1, '#7e8488'); band(2.5, 2.6, '#8e9498');
      break;
    }
    case 'storeys': {
      // a building of three storeys over its street: shop fronts under a dark band, then white
      // render with a ribbon of windows along each floor, a dark box over the top one, and a coping
      band(0, 10.8, '#d9d5cb');
      // (the shops' glass grey-blue with the light of the shop behind it)
      const shop = x.createLinearGradient(0, Y(3.3), 0, Y(0.2));
      shop.addColorStop(0, '#a9b6bd'); shop.addColorStop(0.55, '#c9c3b3'); shop.addColorStop(1, '#8f9a9f');
      x.fillStyle = shop; x.fillRect(0, Y(3.3), W, 3.1 * PX);
      x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(0.1 * PX, Y(3.2), W * 0.3, 2.9 * PX);
      x.fillStyle = '#8e9498'; x.fillRect(0, Y(3.3), 0.06 * PX, 3.1 * PX); x.fillRect(W - 0.06 * PX, Y(3.3), 0.06 * PX, 3.1 * PX);
      x.fillRect(W / 2 - 0.02 * PX, Y(3.3), 0.04 * PX, 3.1 * PX); x.fillRect(0, Y(2.6), W, 0.05 * PX);
      band(0, 0.2, '#6f7376'); band(3.3, 4.1, '#3d4043');
      const ribbon = (from: number, to: number) => {
        const g = x.createLinearGradient(0, Y(to), 0, Y(from));
        g.addColorStop(0, '#9fb0bc'); g.addColorStop(0.5, '#7d8c97'); g.addColorStop(1, '#8a97a0');
        x.fillStyle = g; x.fillRect(0, Y(to), W, (to - from) * PX);
        x.fillStyle = '#eceae4';
        for (let k = 0; k <= 2; k++) x.fillRect(k * W / 2 - 0.04 * PX, Y(to), 0.08 * PX, (to - from) * PX);
        x.fillRect(0, Y(to), W, 0.06 * PX); x.fillRect(0, Y(from + 0.06), W, 0.06 * PX);
      };
      ribbon(4.9, 6.6); ribbon(7.6, 9.3);
      band(9.3, 9.6, '#3d4043'); band(10.6, 10.8, '#9a9a96');
      break;
    }
    case 'liftWindows': {
      // black steel panels on a concrete plinth, and two windows one over the other in pale frames
      band(0, 3.9, '#1c1e21');
      band(0, 0.4, '#a29e96');
      for (const [from, to] of [[0.6, 1.75], [1.95, 3.05]]) {
        x.fillStyle = '#d9d5ca'; x.fillRect(0.2 * PX, Y(to), W - 0.4 * PX, (to - from) * PX);
        x.clearRect(0.26 * PX, Y(to - 0.06), W - 0.52 * PX, (to - from - 0.12) * PX);
      }
      x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(0, 0, 2, H);
      break;
    }
    case 'redWindows': {
      // Farsta strand's pavilion: a concrete plinth, glass in red steel frames to 2.95 m with a
      // transom, then cream panels between the red posts
      const red = '#a3302a';
      band(0, 4.2, '#e0d9c6');
      band(0, 0.75, '#a29e96'); band(0.71, 0.75, '#8a867e');
      band(0.75, 0.85, red); pane(0.85, 2.1, red, 0.1); band(2.1, 2.17, red); pane(2.17, 2.95, red, 0.1); band(2.95, 3.07, red);
      x.fillStyle = red; x.fillRect(0, Y(4.2), 0.05 * PX, 1.13 * PX); x.fillRect(W - 0.05 * PX, Y(4.2), 0.05 * PX, 1.13 * PX);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, Y(3.65), W, 2);
      break;
    }
    case 'shutter': {
      // a roller shutter down over a shop's front, its box over it, cream panels above
      band(0, 4.2, '#e0d9c6');
      band(0, 0.3, '#a29e96');
      band(0.3, 2.7, '#d9dbd8');
      for (let k = 0.3; k < 2.7; k += 0.08) { x.fillStyle = 'rgba(70,72,74,0.35)'; x.fillRect(0, Y(k + 0.01), W, 1.5); }
      band(2.7, 2.98, '#b9bcbc'); band(2.98, 3.07, '#a3302a');
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, Y(3.65), W, 2);
      break;
    }
    case 'blueGlazed': {
      // Globen's stair houses: a white panel to 0.9 m between blue rails, then glass in blue steel
      // frames (the top row of the picture carried on up the wall, so glazed to the roof)
      const blue = '#2f6fae';
      band(0, 0.06, blue); band(0.06, 0.9, '#e4e6e3'); band(0.9, 0.98, blue); pane(0.98, 2.4, blue, 0.1);
      x.fillStyle = blue; x.fillRect(0, Y(0.9), 0.05 * PX, 0.9 * PX); x.fillRect(W - 0.05 * PX, Y(0.9), 0.05 * PX, 0.9 * PX);
      x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(0, Y(0.98), W, 1.5);
      break;
    }
    case 'blueClerestory': {
      // Globen's halls: white panels to 2.9 m, a dark blue band over a yellow line, and windows
      // in blue frames above it, on up to the roof
      const blue = '#2f6fae';
      band(0, 0.12, '#55595c'); band(0.12, 2.9, '#e6e7e3');
      x.fillStyle = 'rgba(70,72,74,0.4)'; x.fillRect(0, Y(2.9), 2, 2.78 * PX); x.fillRect(0, Y(1.5), W, 2);
      band(2.9, 3.2, '#22306e'); band(3.2, 3.25, '#e8b830'); band(3.25, 3.33, blue); pane(3.33, 4.2, blue, 0.1);
      break;
    }
    case 'steelFront': {
      // their fronts: glass doors in brushed steel frames, a steel transom, a black sign band, the
      // dark blue band and yellow line, windows in blue frames above
      const steelLight = '#a9aeb1', blue = '#2f6fae';
      band(0, 0.1, steelLight); pane(0.1, 2.4, steelLight, 0.14);
      x.fillStyle = steelLight; x.fillRect(W / 2 - 0.04 * PX, Y(2.4), 0.08 * PX, 2.3 * PX); x.fillRect(0, Y(1.15), W, 0.06 * PX);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(W / 2 - 0.04 * PX, Y(2.4), 1.5, 2.3 * PX);
      band(2.4, 2.55, steelLight); band(2.55, 2.88, '#1b1c1e');
      x.fillStyle = '#f2f2ee'; x.fillRect(0.3 * PX, Y(2.79), 0.6 * PX, 0.06 * PX);
      band(2.88, 3.2, '#22306e'); band(3.2, 3.25, '#e8b830'); band(3.25, 3.33, blue); pane(3.33, 4.2, blue, 0.1);
      break;
    }
    case 'ribbedMetal':
      // ribs 15 cm apart, across the picture
      x.fillStyle = '#c9c4b8'; x.fillRect(0, 0, W, H);
      for (let j = 0; j * 0.15 * PX < H; j++) {
        x.fillStyle = 'rgba(80,76,68,0.35)'; x.fillRect(0, j * 0.15 * PX, W, 0.03 * PX);
        x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(0, j * 0.15 * PX + 0.05 * PX, W, 0.02 * PX);
      }
      break;
    case 'creamPanels':
      // as over redWindows' glass
      x.fillStyle = '#e0d9c6'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#a3302a'; x.fillRect(0, 0, 0.05 * PX, H); x.fillRect(W - 0.05 * PX, 0, 0.05 * PX, H);
      break;
    case 'redPanels':
      x.fillStyle = '#8e2d27'; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(3, 0, W * 0.4, H);
      x.fillStyle = 'rgba(40,10,8,0.6)'; x.fillRect(0, 0, 2, H); x.fillRect(0, Y(1.5), W, 2);
      break;
    case 'perforated': {
      // as the platform's ceiling (perforatedCeiling): 1.2 by 2.4 m panels, the holes a fine grain
      x.fillStyle = '#585c5e'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#3c3f41';
      for (let j = 2; j < H; j += 4) for (let i = (j % 8 === 2 ? 0 : 2); i < W; i += 4) x.fillRect(i, j, 1.6, 1.6);
      x.fillStyle = '#6c7072'; x.fillRect(0, 0, W, 2); x.fillRect(0, Y(1.2), W, 2); x.fillRect(0, 0, 2, H);
      break;
    }
    case 'lineMosaic': {
      // Farsta strand's hall (Fredrik Jacobsson, 1993): pale grey slabs, 60 cm, and lines of dark
      // mosaic 5 cm wide across them, along and at two slants, so that they cross in long
      // triangles (each family wraps round the repeat)
      x.fillStyle = '#a7a7a3'; x.fillRect(0, 0, W, H);
      const t = 0.6 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 184 + Math.floor(r() * 10);
        x.fillStyle = `rgb(${v},${v},${v - 4})`; x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
      }
      x.strokeStyle = '#46474a'; x.lineWidth = 0.05 * PX;
      const line = (x0: number, y0: number, x1: number, y1: number) => {
        for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
          x.beginPath(); x.moveTo(x0 * PX + dx, y0 * PX + dy); x.lineTo(x1 * PX + dx, y1 * PX + dy); x.stroke();
        }
      };
      line(0, 0, 4.8, 2.4); line(0, 2.4, 4.8, 4.8);
      line(0, 4.8, 4.8, 0);
      line(2.4, 0, 2.4, 4.8);
      break;
    }
    case 'whiteBranches': {
      // Enskede gård's stairs: pale stone tiles, 30 by 60 cm on end, and black branches spreading
      // over them from the foot and the top of the wall, as of a tree and its roots
      x.fillStyle = '#9fa1a1'; x.fillRect(0, 0, W, H);
      const a = 0.3 * PX, b = 0.6 * PX;
      for (let i = 0; i * a < W; i++) for (let j = 0; j * b < H; j++) {
        const v = 214 + Math.floor(r() * 12);
        x.fillStyle = `rgb(${v},${v + 1},${v + 2})`; x.fillRect(i * a + 1, j * b + 1, a - 2, b - 2);
      }
      speckle(x, W, H, 6000, 0.1, 68);
      branches(x, W, H, PX, rng(2012), 7, 'rgba(38,39,41,0.92)');
      break;
    }
    case 'darkBranches': {
      // its ticket hall: dark grey slabs, 20 cm wide and of different lengths, on end and
      // staggered, and here and there a black branch over them
      x.fillStyle = '#1f2123'; x.fillRect(0, 0, W, H);
      const a = 0.2 * PX;
      for (let i = 0; i * a < W; i++) {
        let y = -r() * 0.6 * PX;
        while (y < H) {
          const l = (0.4 + r() * 0.5) * PX, v = 50 + Math.floor(r() * 14);
          x.fillStyle = `rgb(${v},${v + 2},${v + 5})`; x.fillRect(i * a + 1, y + 1, a - 2, l - 2);
          y += l;
        }
      }
      branches(x, W, H, PX, rng(2013), 1, 'rgba(12,13,14,0.9)', 4);
      break;
    }
    case 'basketTiles': {
      // white tiles 15 by 30 cm, in pairs, each pair turned the other way from its neighbours
      x.fillStyle = '#b4b5b1'; x.fillRect(0, 0, W, H);
      const t = 0.3 * PX, q = t / 2;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) for (let k = 0; k < 2; k++) {
        const v = 232 + Math.floor(r() * 12);
        x.fillStyle = `rgb(${v},${v},${v - 3})`;
        if ((i + j) % 2) x.fillRect(i * t + k * q + 1, j * t + 1, q - 2, t - 2);
        else x.fillRect(i * t + 1, j * t + k * q + 1, t - 2, q - 2);
      }
      break;
    }
    case 'granite': {
      // a retaining wall of rough granite blocks in courses, grey to a pinkish brown, in pale
      // mortar
      x.fillStyle = '#a8a397'; x.fillRect(0, 0, W, H);
      let y = 0;
      for (const ch of [0.42, 0.55, 0.38, 0.6, 0.45]) {
        const hh = ch * PX;
        let p = r() * 0.5 * PX;
        const start = p;
        while (p < start + W) {
          const l = Math.min((0.35 + r() * 0.6) * PX, start + W - p), v = 92 + Math.floor(r() * 40), warm = Math.floor(r() * 14);
          x.fillStyle = `rgb(${v + warm},${v + Math.floor(warm / 2)},${v - 2})`;
          for (const dx of [0, -W]) {
            x.beginPath();
            x.moveTo(p + dx + 2 + r() * 4, y + 2 + r() * 4); x.lineTo(p + dx + l - 2 - r() * 4, y + 2 + r() * 4);
            x.lineTo(p + dx + l - 2 - r() * 4, y + hh - 2 - r() * 4); x.lineTo(p + dx + 2 + r() * 4, y + hh - 2 - r() * 4);
            x.closePath(); x.fill();
          }
          p += l;
        }
        y += hh;
      }
      speckle(x, W, H, 12000, 0.2, 69); speckle(x, W, H, 5000, 0.15, 70, true);
      break;
    }
    case 'asphalt':
      x.fillStyle = '#4b4c4d'; x.fillRect(0, 0, W, H);
      speckle(x, W, H, 16000, 0.22, 66); speckle(x, W, H, 8000, 0.16, 67, true);
      break;
    case 'whitePerforated': {
      // white acoustic panels 60 cm square, a field of small square holes in each, a plain margin
      x.fillStyle = '#c9cac6'; x.fillRect(0, 0, W, H);
      const t = 0.6 * PX, m = 0.04 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 233 + Math.floor(r() * 6);
        x.fillStyle = `rgb(${v},${v},${v - 3})`; x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
        x.fillStyle = 'rgba(120,122,120,0.55)';
        for (let a = m; a < t - m; a += 4) for (let b = m; b < t - m; b += 4) x.fillRect(i * t + a, j * t + b, 1.5, 1.5);
      }
      break;
    }
    case 'roughcast':
      // grey render thrown on rough
      x.fillStyle = '#a19e98'; x.fillRect(0, 0, W, H);
      speckle(x, W, H, 30000, 0.3, 71); speckle(x, W, H, 16000, 0.25, 72, true);
      break;
    case 'hallTiles': {
      // a hall's high walls: white tiles 15 cm to 1.5 m, a row of windows in grey frames, white
      // render behind the bridges' edges (boxed over it), and tall windows in black frames above
      x.fillStyle = '#aeb0ad'; x.fillRect(0, Y(1.5), W, 1.5 * PX);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j < 10; j++) {
        const v = 236 + Math.floor(r() * 10);
        x.fillStyle = `rgb(${v},${v},${v - 2})`; x.fillRect(i * t + 1, Y(1.5) + j * t + 1, t - 2, t - 2);
      }
      band(1.5, 1.56, '#3b3e41');
      const g = x.createLinearGradient(0, Y(2.2), 0, Y(1.56));
      g.addColorStop(0, '#9fb0b8'); g.addColorStop(1, '#6f7f88');
      x.fillStyle = g; x.fillRect(0, Y(2.2), W, 0.64 * PX);
      x.fillStyle = '#8d9296'; x.fillRect(0, Y(2.2), 0.05 * PX, 0.64 * PX); x.fillRect(W - 0.05 * PX, Y(2.2), 0.05 * PX, 0.64 * PX);
      band(2.2, 2.28, '#3b3e41'); band(2.28, 3.78, '#eceae5'); band(3.78, 3.88, '#1c1d1f');
      pane(3.88, 6.9, '#1c1d1f', 0.1);
      x.fillStyle = '#1c1d1f'; x.fillRect(0, Y(5.4), W, 0.06 * PX);
      break;
    }
    case 'glassFront': {
      // a ticket hall's front: glass doors in brushed steel to 2.3 m, a steel transom, the band
      // the station's name goes on, and glass in steel frames above
      const st = '#a9aeb1';
      band(0, 0.1, st); pane(0.1, 2.3, st, 0.14);
      x.fillStyle = st; x.fillRect(W / 2 - 0.04 * PX, Y(2.3), 0.08 * PX, 2.2 * PX); x.fillRect(0, Y(1.1), W, 0.06 * PX);
      band(2.3, 2.4, st); band(2.4, 2.8, '#22306e'); band(2.8, 2.9, st);
      pane(2.9, 6.9, st, 0.08);
      x.fillStyle = st; x.fillRect(0, Y(4.3), W, 0.06 * PX); x.fillRect(0, Y(5.6), W, 0.06 * PX);
      break;
    }
    case 'greenTerrazzo': {
      // green terrazzo, speckled pale and dark, and a pair of dark red lines along it
      x.fillStyle = '#44705a'; x.fillRect(0, 0, W, H);
      speckle(x, W, H, 60000, 0.35, 74); speckle(x, W, H, 30000, 0.3, 75, true);
      for (const k of [0.4, 0.52]) { x.fillStyle = '#7a2e26'; x.fillRect(k * PX, 0, 0.05 * PX, H); }
      break;
    }
    case 'squareTiles': {
      // white tiles 15 cm square, in grey joints
      x.fillStyle = '#9fa19e'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 238 + Math.floor(r() * 10);
        x.fillStyle = `rgb(${v},${v},${v - 2})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
      }
      break;
    }
    case 'bwTiles': {
      // 15 cm tiles, white, black and grey at random, a third of them doubled into one upright
      // tile 30 cm tall, in pale grey joints
      x.fillStyle = '#b4b6b3'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX, n = Math.round(H / t);
      const tone = () => { const k = r(); return k < 0.5 ? 236 + Math.floor(r() * 12) : k < 0.8 ? 22 + Math.floor(r() * 12) : 128 + Math.floor(r() * 30); };
      for (let i = 0; i * t < W; i++) for (let j = 0; j < n; j++) {
        const tall = j + 1 < n && r() < 0.33, v = tone();
        x.fillStyle = `rgb(${v},${v},${v + 1})`;
        x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, (tall ? 2 * t : t) - 3);
        if (tall) j++;
      }
      break;
    }
    case 'tealWindows': {
      // small tiles 10 cm square, teal green, to 0.9 m; a dark steel sill, windows in dark frames
      // to 2.2 m, their head, and over them the concrete beam the deck rests on
      const t = 0.1 * PX, frame = '#26292c';
      x.fillStyle = '#9fb3ae'; x.fillRect(0, Y(0.9), W, 0.9 * PX);
      for (let i = 0; i * t < W; i++) for (let j = 0; j < 9; j++) {
        const v = Math.floor(r() * 14);
        x.fillStyle = `rgb(${52 + v},${116 + v},${108 + v})`;
        x.fillRect(i * t + 1, Y(0) - (j + 1) * t + 1, t - 2, t - 2);
      }
      band(0.9, 0.98, frame); pane(0.98, 2.2, frame, 0.1); band(2.2, 2.3, frame);
      band(2.3, 3.2, '#a6a39b');
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(80,78,72,${0.05 + r() * 0.1})`; x.fillRect(r() * W, Y(2.3) + r() * 0.9 * PX, 2 + r() * 10, 1); }
      break;
    }
    case 'brownWindows': {
      // small tiles 10 cm square in browns, dark and pale at random, to 1.6 m; a dark steel sill,
      // windows in dark frames to 2.25 m, their head, and over them concrete cast against boards
      const t = 0.1 * PX, frame = '#2a2b2c';
      x.fillStyle = '#5b4a3c'; x.fillRect(0, Y(1.6), W, 1.6 * PX);
      for (let i = 0; i * t < W; i++) for (let j = 0; j < 16; j++) {
        const v = r(), k = Math.floor(r() * 18);
        const [cr, cg, cb] = v < 0.3 ? [92, 62, 42] : v < 0.65 ? [124, 86, 58] : v < 0.9 ? [150, 112, 78] : [70, 52, 40];
        x.fillStyle = `rgb(${cr + k},${cg + k},${cb + k})`;
        x.fillRect(i * t + 1, Y(0) - (j + 1) * t + 1, t - 2, t - 2);
      }
      band(1.6, 1.66, frame); pane(1.66, 2.25, frame, 0.08); band(2.25, 2.3, frame);
      band(2.3, 3.2, '#a6a39b');
      for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(70,68,62,${0.06 + r() * 0.08})`; x.fillRect(0, Y(2.3) + r() * 0.9 * PX, W, 1); }
      break;
    }
    case 'greenGlazed':
    case 'wiredGlazed': {
      // a glazed hall's walls: glass from a kick panel at 0.3 m to its head at 2.9 m, in dark
      // green steel frames 1.2 m apart, and a steel handrail across them at 1 m; or (`wiredGlazed`,
      // Johannelund's beside its stairs) wired glass, translucent, a pale grey with a fine square
      // mesh of wire in it
      const g = '#2c4637';
      band(0, 0.3, g); pane(0.3, 2.9, g, 0.09); band(2.9, 3, g);
      if (name === 'wiredGlazed') {
        const m = 0.045 * PX;
        x.fillStyle = '#bfc6c3'; x.fillRect(m, Y(2.9), W - 2 * m, 2.6 * PX);
        x.fillStyle = 'rgba(90,96,94,0.35)';
        for (let k = m; k < W - m; k += 0.025 * PX) x.fillRect(k, Y(2.9), 1, 2.6 * PX);
        for (let k = 0.3 * PX; k < 2.9 * PX; k += 0.025 * PX) x.fillRect(m, H - k, W - 2 * m, 1);
        x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(m, Y(2.9), (W - 2 * m) * 0.3, 2.6 * PX);
      }
      x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(0, Y(0.3), W, 1.5);
      x.fillStyle = '#9ba2a4'; x.fillRect(0, Y(1.04), W, 0.05 * PX);
      break;
    }
    case 'greenFront':
    case 'greenDoors':
    case 'creamClerestory': {
      // a ticket hall's walls: to 2.95 m, dark green steel panels on a grey plinth (or glass doors
      // in brushed steel to 2.4 m under a green band, the doors'; or cream tiles inside); then
      // windows in dark green frames, a transom at 4 m, to 4.95 m, and green steel (white render
      // inside) above
      const g = '#2c4637', st = '#a9aeb1';
      if (name === 'greenFront') {
        band(0, 2.95, g);
        for (let i = 0; i * 0.3 * PX < W; i++) {
          x.fillStyle = 'rgba(10,22,16,0.5)'; x.fillRect(i * 0.3 * PX, Y(2.95), 2, 2.95 * PX);
          x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(i * 0.3 * PX + 2, Y(2.95), 2, 2.95 * PX);
        }
        band(0, 0.15, '#7d7f7c');
      } else if (name === 'greenDoors') {
        band(0, 0.1, st); pane(0.1, 2.4, st, 0.12);
        x.fillStyle = st; x.fillRect(W / 2 - 0.04 * PX, Y(2.4), 0.08 * PX, 2.3 * PX); x.fillRect(0, Y(1.08), W, 0.07 * PX);
        band(2.4, 2.95, g); band(2.4, 2.46, st);
      } else {
        x.fillStyle = '#b9b3a6'; x.fillRect(0, Y(2.95), W, 2.95 * PX);
        const t = 0.15 * PX;
        for (let i = 0; i * t < W; i++) for (let j = 0; (j + 1) * t <= 2.95 * PX; j++) {
          const v = Math.floor(r() * 10);
          x.fillStyle = `rgb(${220 + v},${212 + v},${194 + v})`; x.fillRect(i * t + 1.5, Y(0) - (j + 1) * t + 1.5, t - 3, t - 3);
        }
      }
      band(2.95, 3.05, g); pane(3.05, 4.95, g, 0.1); band(4.95, 5.05, g);
      x.fillStyle = g; x.fillRect(0, Y(4.03), W, 0.06 * PX);
      band(5.05, 5.4, name === 'creamClerestory' ? '#e8e6e0' : g);
      break;
    }
    case 'greenTiles': {
      // sea-green tiles 15 cm square, in grey-green joints
      x.fillStyle = '#5e7c70'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = Math.floor(r() * 12);
        x.fillStyle = `rgb(${86 + v},${162 + v},${136 + v})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
      }
      break;
    }
    case 'crossMosaic': {
      // Mari Pårup's mosaics (Medborgarplatsen's southern ticket hall, 1997): on warm yellow tiles,
      // round clusters of Greek crosses fitted into each other, each cluster in its own tones, a few
      // eight-pointed stars in them, their edges ragged where the crosses stop
      x.fillStyle = '#b3aa96'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        x.fillStyle = `rgb(${218 + Math.floor(r() * 14)},${178 + Math.floor(r() * 12)},${88 + Math.floor(r() * 16)})`;
        x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
      }
      const clusters: { c: number; h: number; rad: number; tones: string[] }[] = [
        { c: 1.0, h: 1.4, rad: 0.62, tones: ['#c99a9a', '#a7a29c', '#d8c8b8', '#8c8a86', '#b88a84'] },
        { c: 2.45, h: 1.35, rad: 0.66, tones: ['#e8e6e2', '#c8c8c6', '#d9d4c2', '#b0b2b0', '#e2d39a'] },
        { c: 3.95, h: 1.4, rad: 0.78, tones: ['#c98a7c', '#d8a898', '#b46a5a', '#e0c0a8', '#a89a7a'] },
      ];
      const w = 0.045 * PX;
      const cross = (cx: number, cy: number, fill: string) => {
        x.fillStyle = fill;
        x.fillRect(cx - w * 1.5 + 0.6, cy - w / 2 + 0.6, 3 * w - 1.2, w - 1.2);
        x.fillRect(cx - w / 2 + 0.6, cy - w * 1.5 + 0.6, w - 1.2, 3 * w - 1.2);
      };
      const star = (cx: number, cy: number, R: number, fill: string) => {
        x.fillStyle = fill; x.beginPath();
        for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, q = k % 2 ? R * 0.45 : R; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
        x.closePath(); x.fill();
      };
      for (const cl of clusters) {
        const cx = cl.c * PX, cy = Y(cl.h), R = cl.rad * PX;
        // (Greek crosses tile the plane on the lattice (2, 1), (−1, 2) of their arms' width)
        for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) {
          const px = cx + (2 * i - j) * w, py = cy + (i + 2 * j) * w;
          const d = Math.hypot(px - cx, py - cy) / R;
          if (d > 1 + (r() - 0.5) * 0.25) continue;
          cross(px, py, cl.tones[Math.floor(r() * cl.tones.length)]);
        }
        for (let k = 0; k < 5; k++) {
          const a = r() * Math.PI * 2, q = r() * R * 0.7;
          star(cx + Math.cos(a) * q, cy + Math.sin(a) * q, 0.07 * PX, k % 2 ? '#c8a040' : '#b8584a');
        }
      }
      break;
    }
    case 'crossTerrazzo': {
      // dark grey terrazzo, speckled, small pale Greek crosses set in it here and there
      x.fillStyle = '#5f6162'; x.fillRect(0, 0, W, H);
      speckle(x, W, H, 40000, 0.3, 76); speckle(x, W, H, 20000, 0.25, 77, true);
      const w = 0.04 * PX;
      for (let k = 0; k < 7; k++) {
        const cx = (0.2 + r() * 2.0) * PX, cy = (0.2 + r() * 2.0) * PX;
        x.fillStyle = k % 3 ? '#d9d2bc' : '#c9b46a';
        x.fillRect(cx - 1.5 * w, cy - w / 2, 3 * w, w); x.fillRect(cx - w / 2, cy - 1.5 * w, w, 3 * w);
      }
      break;
    }
    case 'creamTiles': {
      // cream tiles 15 cm square, in pale grey joints
      x.fillStyle = '#b9b3a6'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = Math.floor(r() * 10);
        x.fillStyle = `rgb(${220 + v},${212 + v},${194 + v})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
      }
      break;
    }
    case 'whiteRender':
      // smooth white render
      x.fillStyle = '#e8e6e0'; x.fillRect(0, 0, W, H);
      speckle(x, W, H, 9000, 0.12, 76); speckle(x, W, H, 6000, 0.15, 77, true);
      break;
    case 'silverPerforated': {
      // Högdalen's stair houses: silver-grey sheet-metal panels 1.2 m wide and 3 m high, finely
      // perforated inside a plain margin, in dark joints
      const m = 0.05 * PX;
      x.fillStyle = '#5f6468'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#b3b8bc'; x.fillRect(1.5, 1.5, W - 3, H - 3);
      x.fillStyle = 'rgba(64,70,76,0.5)';
      for (let j = m; j < H - m; j += 4) for (let i = m + ((j - m) % 8 ? 2 : 0); i < W - m; i += 4) x.fillRect(i, j, 1.4, 1.4);
      x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(2, 2, W - 4, 1.5); x.fillRect(2, 2, 1.5, H - 4);
      break;
    }
    case 'libraryFront':
    case 'libraryBack':
    case 'libraryEntrance': {
      // Högdalen's building over its square, from the street up: to 3.6 m shop fronts of glass in
      // steel frames on a dark plinth, a dark band where the canopy meets the wall (or plain
      // white panels, the back's; or glass doors in brushed steel under SL's dark blue band and
      // yellow line, the entrance's); then white panels, a band of windows from 5.2 m to 7.2 m,
      // each in a white frame beside a dark blue pier, and white panels up to the coping
      const st = '#a9aeb1', white = '#e9eae6', blue = '#24407a';
      band(0, 8.3, white);
      if (name === 'libraryFront') {
        const shop = x.createLinearGradient(0, Y(3.6), 0, Y(0.15));
        shop.addColorStop(0, '#a9b6bd'); shop.addColorStop(0.55, '#cbc5b5'); shop.addColorStop(1, '#8f9a9f');
        x.fillStyle = shop; x.fillRect(0, Y(3.6), W, 3.45 * PX);
        x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(0.1 * PX, Y(3.5), W * 0.3, 3.2 * PX);
        x.fillStyle = st; x.fillRect(0, Y(3.6), 0.06 * PX, 3.45 * PX); x.fillRect(W - 0.06 * PX, Y(3.6), 0.06 * PX, 3.45 * PX);
        x.fillRect(W / 2 - 0.03 * PX, Y(3.6), 0.06 * PX, 3.45 * PX); x.fillRect(0, Y(2.6), W, 0.05 * PX);
        band(0, 0.15, '#55595c'); band(3.6, 3.9, '#3d4043');
      } else if (name === 'libraryEntrance') {
        band(0, 0.1, st); pane(0.1, 2.5, st, 0.14);
        x.fillStyle = st; x.fillRect(W / 2 - 0.04 * PX, Y(2.5), 0.08 * PX, 2.4 * PX); x.fillRect(0, Y(1.1), W, 0.06 * PX);
        band(2.5, 2.6, st); band(2.6, 3.2, '#22306e'); band(3.2, 3.25, '#e8b830'); band(3.25, 3.9, '#3d4043');
      } else {
        x.fillStyle = 'rgba(70,72,74,0.4)';
        for (const k of [0, 0.5]) x.fillRect(k * W, Y(3.9), 2, 3.9 * PX);
        x.fillRect(0, Y(2.0), W, 2);
        band(0, 0.3, '#8e8b85');
      }
      // the white panels' joints
      x.fillStyle = 'rgba(70,72,74,0.35)';
      for (const y of [4.55, 5.2, 7.75]) x.fillRect(0, Y(y), W, 2);
      for (const k of [0, 0.5]) { x.fillRect(k * W, Y(5.2), 2, 1.3 * PX); x.fillRect(k * W, Y(8.3), 2, 1.1 * PX); }
      // the windows (their glass the sky's), each beside its pier
      band(5.2, 7.2, blue);
      const g = x.createLinearGradient(0, Y(7.1), 0, Y(5.3));
      g.addColorStop(0, '#a9bccb'); g.addColorStop(0.5, '#7f909c'); g.addColorStop(1, '#8c9aa4');
      const x0 = 0.45 * PX, ww = W - x0 - 0.02 * PX;
      x.fillStyle = '#f2f2ee'; x.fillRect(x0, Y(7.15), ww, 1.9 * PX);
      x.fillStyle = g; x.fillRect(x0 + 0.06 * PX, Y(7.09), ww - 0.12 * PX, 1.78 * PX);
      x.fillStyle = '#f2f2ee'; x.fillRect(x0 + ww / 2 - 0.03 * PX, Y(7.09), 0.06 * PX, 1.78 * PX);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(x0 + 0.1 * PX, Y(7.05), ww * 0.25, 1.7 * PX);
      band(8.15, 8.3, '#b8bab8');
      break;
    }
    case 'blackTiles': {
      // glossy black tiles 15 cm square, in pale grey joints, a glint on each
      x.fillStyle = '#8d908f'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 18 + Math.floor(r() * 10);
        x.fillStyle = `rgb(${v},${v},${v + 2})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
        x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(i * t + 3, j * t + 3, t * 0.45, 2);
      }
      break;
    }
    case 'glassBlocks': {
      // glass blocks 20 cm square in grey mortar, each pale green, brightest at its middle, with
      // the ribs moulded in its face
      x.fillStyle = '#b4b7b1'; x.fillRect(0, 0, W, H);
      const t = 0.2 * PX, j0 = 0.015 * PX, s = t - 2 * j0;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const X = i * t + j0, Z = j * t + j0, v = Math.floor(r() * 12);
        const g = x.createRadialGradient(X + s / 2, Z + s / 2, s * 0.1, X + s / 2, Z + s / 2, s * 0.72);
        g.addColorStop(0, `rgb(${222 + v},${236 + v},${226 + v})`); g.addColorStop(1, `rgb(${146 + v},${168 + v},${158 + v})`);
        x.fillStyle = g; x.fillRect(X, Z, s, s);
        x.fillStyle = 'rgba(255,255,255,0.2)';
        for (let k = 1; k < 4; k++) x.fillRect(X + (s * k) / 4, Z + 3, 1.2, s - 6);
      }
      break;
    }
    case 'blueMosaic':
    case 'warmMosaic': {
      // Rågsved's entrance: rectangles from 5 to 40 cm, cut on a 5 cm grid, each of small tesserae
      // in one colour, in dark joints
      const colors = name === 'blueMosaic'
        ? ['#5b6670', '#7d8a94', '#a9b6bf', '#3f4c5a', '#c9d2d6', '#e4e7e6', '#8b9ba8', '#4e6a85', '#6f7f8c', '#9aa5a3', '#2f3a46', '#b8c4cc']
        : ['#d9cbb0', '#c4a77d', '#b4612f', '#8a3b22', '#1f2c4a', '#2f6f74', '#6b6a3a', '#e9e2d2', '#4b4d4f', '#a68b5b', '#d78a3d', '#7a7f80'];
      x.fillStyle = '#3c3d3c'; x.fillRect(0, 0, W, H);
      const g = 0.05 * PX;
      const cut = (x0: number, y0: number, w: number, h: number) => {
        const most = (0.1 + r() * 0.3) * PX;
        if ((w <= most && h <= most) || (w <= g && h <= g)) {
          const v = Math.floor(r() * 14) - 7;
          x.fillStyle = colors[Math.floor(r() * colors.length)]; x.fillRect(x0 + 1.5, y0 + 1.5, w - 3, h - 3);
          x.fillStyle = `rgba(${v > 0 ? '255,255,255' : '0,0,0'},${Math.abs(v) / 60})`; x.fillRect(x0 + 1.5, y0 + 1.5, w - 3, h - 3);
          x.fillStyle = 'rgba(30,30,30,0.22)';
          for (let k = 0.025 * PX; k < w - 2; k += 0.025 * PX) x.fillRect(x0 + k, y0 + 1.5, 1, h - 3);
          for (let k = 0.025 * PX; k < h - 2; k += 0.025 * PX) x.fillRect(x0 + 1.5, y0 + k, w - 3, 1);
          return;
        }
        // (split the longer way, on the grid)
        const across = w > h ? true : w < h ? false : r() < 0.5, len = across ? w : h, n = Math.round(len / g);
        const k = Math.max(1, Math.min(n - 1, 1 + Math.floor(r() * (n - 1)))) * g;
        if (across) { cut(x0, y0, k, h); cut(x0 + k, y0, w - k, h); } else { cut(x0, y0, w, k); cut(x0, y0 + k, w, h - k); }
      };
      cut(0, 0, W, H);
      break;
    }
    case 'terracottaPanels':
      // flat panels of terracotta-red enamel, 0.6 by 1.2 m, in fine dark joints
      x.fillStyle = '#5a2a1e'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const v = Math.floor(r() * 10) - 5;
        x.fillStyle = `rgb(${150 + v},${70 + v},${50 + v})`;
        x.fillRect(i * 0.6 * PX + 1, j * 1.2 * PX + 1, 0.6 * PX - 2, 1.2 * PX - 2);
        x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(i * 0.6 * PX + 3, j * 1.2 * PX + 3, 0.18 * PX, 1.2 * PX - 6);
      }
      break;
    case 'orangeTiles':
      // glazed orange-red tiles, 20 cm square, in pale grout
      x.fillStyle = '#b9a99a'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
        const v = Math.floor(r() * 18) - 9;
        x.fillStyle = `rgb(${190 + v},${82 + v},${46 + v})`;
        x.fillRect(i * 0.2 * PX + 1.5, j * 0.2 * PX + 1.5, 0.2 * PX - 3, 0.2 * PX - 3);
      }
      break;
    case 'redGranite': {
      // polished red-brown granite in slabs 0.6 by 1.2 m, the grain black and pink
      x.fillStyle = '#3a2420'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        const v = Math.floor(r() * 12) - 6;
        x.fillStyle = `rgb(${128 + v},${66 + v},${54 + v})`;
        x.fillRect(i * 0.6 * PX + 1, j * 1.2 * PX + 1, 0.6 * PX - 2, 1.2 * PX - 2);
      }
      speckle(x, W, H, 26000, 0.35, 81); speckle(x, W, H, 9000, 0.2, 82, true);
      break;
    }
    case 'brick': {
      // red-brown brick, about 23 by 7.5 cm with 1 cm joints, in a running bond (five to the
      // repeat across, fourteen courses up it)
      x.fillStyle = '#9a9188'; x.fillRect(0, 0, W, H);
      const bl = W / 5, bh = H / 14;
      for (let j = 0; j * bh < H; j++) for (let i = -1; i * bl < W; i++) {
        const v = Math.floor(r() * 26) - 13, ox = (j % 2) * bl / 2;
        x.fillStyle = `rgb(${142 + v},${66 + v * 0.7},${48 + v * 0.5})`;
        x.fillRect(i * bl + ox + 1, j * bh + 1, bl - 2, bh - 1.6);
      }
      break;
    }
    case 'steelGlazed': {
      // a glass hall's walls: small white tiles to a steel sill at 0.85 m, every fourth a shade
      // greyer; then windows in brushed steel frames 1.2 m apart, a transom at 2.25 m, to the head
      // at 2.9 m
      const st = '#a3a9ac', t = 0.1 * PX;
      x.fillStyle = '#a7aaa8'; x.fillRect(0, Y(0.85), W, 0.85 * PX);
      for (let i = 0; i * t < W; i++) for (let j = 0; (j + 1) * t <= 0.85 * PX; j++) {
        const v = 228 + Math.floor(r() * 10) - ((i + j) % 4 === 0 ? 16 : 0);
        x.fillStyle = `rgb(${v},${v},${v - 1})`; x.fillRect(i * t + 1, Y(0) - (j + 1) * t + 1, t - 2, t - 2);
      }
      band(0.85, 0.95, st); pane(0.95, 2.25, st, 0.1); band(2.25, 2.33, st); pane(2.33, 2.9, st, 0.1); band(2.9, 3, st);
      x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(0, Y(0.95), W, 2);
      break;
    }
    case 'darkTerrazzo':
      // dark grey terrazzo, chips of white and black in it
      x.fillStyle = '#4e4f50'; x.fillRect(0, 0, W, H);
      speckle(x, W, H, 30000, 0.35, 91); speckle(x, W, H, 12000, 0.3, 92, true);
      break;
    case 'birchX': {
      // dark grey stone slabs, 0.9 by 0.65 m; over them a broad X of birch bark from corner to
      // corner, chalk white with dark lenticels across it
      x.fillStyle = '#2f3133'; x.fillRect(0, 0, W, H);
      const sw = W / 6, sh = H / 4;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
        const v = 58 + Math.floor(r() * 12);
        x.fillStyle = `rgb(${v},${v + 1},${v + 3})`; x.fillRect(i * sw + 2, j * sh + 2, sw - 4, sh - 4);
      }
      const bw = 0.5 * PX;
      for (const [ax, ay, bx, by] of [[0, H, W, 0], [0, 0, W, H]]) {
        x.strokeStyle = '#ddd8cc'; x.lineWidth = bw; x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
        const l = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / l, ny = (bx - ax) / l;
        for (let k = 0; k < 260; k++) {
          const t = r(), o = (r() - 0.5) * bw * 0.9, cx = ax + (bx - ax) * t + nx * o, cy = ay + (by - ay) * t + ny * o;
          x.save(); x.translate(cx, cy); x.rotate(Math.atan2(ny, nx));
          x.fillStyle = `rgba(36,34,30,${0.5 + r() * 0.4})`; x.fillRect(-(4 + r() * 10), -1, 8 + r() * 20, 2 + r() * 2);
          x.restore();
        }
      }
      break;
    }
    case 'tealTiles': {
      // Kärrtorp's ticket hall: pale teal tiles, 15 cm, to 2.35 m, a steel strip, and over them a
      // band of black glass panels 1.2 m wide to the ceiling
      x.fillStyle = '#5f8783'; x.fillRect(0, Y(2.35), W, 2.35 * PX);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; (j + 1) * t <= 2.35 * PX + 1; j++) {
        const v = Math.floor(r() * 12);
        x.fillStyle = `rgb(${112 + v},${168 + v},${164 + v})`; x.fillRect(i * t + 1.5, Y(0) - (j + 1) * t + 1.5, t - 3, t - 3);
      }
      band(2.35, 2.42, '#8d9396');
      band(2.42, 3.4, '#121416');
      x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(4, Y(3.4), W * 0.35, 0.98 * PX);
      x.fillStyle = '#2c3033'; x.fillRect(0, Y(3.4), 2, 0.98 * PX); x.fillRect(W - 2, Y(3.4), 2, 0.98 * PX);
      break;
    }
    case 'darkWindows': {
      // Kärrtorp's stair house: a dark grey-green panel to 0.95 m, then windows 0.6 m wide in
      // frames all but black, a transom at 2.3 m, glass on up to the roof
      const frame = '#1f2324';
      band(0, 0.95, '#2f3a38');
      x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(0, Y(0.95), W, 0.95 * PX);
      band(0.95, 1.03, frame); pane(1.03, 2.3, frame, 0.07); band(2.3, 2.36, frame); pane(2.36, 3.2, frame, 0.07);
      x.fillStyle = frame; x.fillRect(W / 2 - 0.035 * PX, 0, 0.07 * PX, Y(0.95));
      break;
    }
    case 'blackFront': {
      // Kärrtorp's ticket hall's front: glass doors in brushed steel to 2.35 m, SL's blue bands
      // across them; the black band the station's name goes on, a steel ledge, and a band of
      // glass in steel frames above
      const st = '#a9aeb1';
      band(0, 0.1, st); pane(0.1, 2.35, st, 0.14);
      x.fillStyle = st; x.fillRect(W / 2 - 0.04 * PX, Y(2.35), 0.08 * PX, 2.25 * PX);
      x.fillStyle = '#25408f'; x.fillRect(0.07 * PX, Y(1.45), W - 0.14 * PX, 0.12 * PX);
      band(2.35, 2.8, '#151618'); band(2.8, 3.1, st);
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, Y(2.82), W, 2);
      pane(3.1, 3.8, st, 0.08); band(3.8, 3.9, st);
      break;
    }
    case 'splitBlocks': {
      // Bagarmossen's ticket hall: grey concrete blocks with a split face, 40 by 20 cm, in a
      // running bond
      x.fillStyle = '#6c6b68'; x.fillRect(0, 0, W, H);
      const bw = 0.4 * PX, bh = 0.2 * PX;
      for (let j = 0; j * bh < H; j++) for (let i = -1; i * bw < W; i++) {
        const v = 128 + Math.floor(r() * 18);
        x.fillStyle = `rgb(${v},${v - 1},${v - 4})`; x.fillRect(i * bw + (j % 2) * bw / 2 + 2, j * bh + 2, bw - 4, bh - 4);
      }
      speckle(x, W, H, 9000, 0.25, 41); speckle(x, W, H, 5000, 0.2, 42, true);
      break;
    }
    case 'cladding':
    case 'cladClerestory': {
      // silver-grey sheet metal, ribbed upright every 20 cm; Bagarmossen's pavilion's tall part
      // has it to 4.5 m, and over it four rows of glass in grey frames, drawn as the photographs
      // show it from the street, the sky's blue-grey in it rather than the hall behind
      const top = name === 'cladding' ? h : 4.5;
      band(0, top, '#aeb3b6');
      for (let i = 0; i * 0.2 * PX < W; i++) {
        x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(i * 0.2 * PX, Y(top), 0.03 * PX, top * PX);
        x.fillStyle = 'rgba(40,44,48,0.35)'; x.fillRect(i * 0.2 * PX + 0.03 * PX, Y(top), 0.015 * PX, top * PX);
      }
      if (name === 'cladClerestory') {
        const fr = '#8c9296', rows = [4.62, 5.34, 6.06, 6.78, 7.5];
        band(4.5, 7.6, fr);
        for (let k = 0; k + 1 < rows.length; k++) {
          const a = rows[k] + 0.03, b = rows[k + 1] - 0.03, g = x.createLinearGradient(0, Y(b), 0, Y(a));
          g.addColorStop(0, '#c3ced6'); g.addColorStop(1, '#8e9ead');
          x.fillStyle = g; x.fillRect(0.05 * PX, Y(b), W - 0.1 * PX, (b - a) * PX);
          x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0.05 * PX, Y(b), W * 0.3, (b - a) * PX);
        }
      }
      break;
    }
    case 'redRock': {
      // the rock sprayed with concrete and painted red, as Skarpnäck's cave: a deep brick red,
      // mottled darker and lighter in soft patches, the hollows near black
      x.fillStyle = '#9a3519'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 70; i++) {
        const cx = r() * W, cy = r() * H, rr = (0.15 + r() * 0.5) * PX, dark = r() < 0.4;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, dark ? 'rgba(80,24,12,0.45)' : 'rgba(190,76,38,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        for (const [ox, oy] of [[0, 0], [W, 0], [-W, 0], [0, H], [0, -H]]) { x.save(); x.translate(ox, oy); x.fillStyle = g; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); x.restore(); }
      }
      speckle(x, W, H, 14000, 0.25, 93); speckle(x, W, H, 5000, 0.12, 94, true);
      break;
    }
    case 'redBand': {
      // Skarpnäck's hall: a band of windows high up in red steel frames, 1.2 m apart, a red
      // sill under them and a red fascia over them; drawn as the photographs show it from the
      // street, the sky's blue-grey in the glass rather than the hall behind
      const red = '#a8342a';
      band(0, h, red);
      const a = 0.32, b = 1.62, g = x.createLinearGradient(0, Y(b), 0, Y(a));
      g.addColorStop(0, '#c4ced5'); g.addColorStop(1, '#8b9aa7');
      x.fillStyle = g; x.fillRect(0.05 * PX, Y(b), W - 0.1 * PX, (b - a) * PX);
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0.05 * PX, Y(b), W * 0.3, (b - a) * PX);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, Y(a) - 2, W, 2); x.fillRect(0, Y(1.75), W, 2);
      break;
    }
    case 'redFront': {
      // Skarpnäck's front: glass doors in brushed steel to 2.3 m, a steel transom, SL's dark blue
      // band, and glass in red steel frames above
      const st = '#a9aeb1', red = '#a8342a';
      band(0, 0.1, st); pane(0.1, 2.3, st, 0.14);
      x.fillStyle = st; x.fillRect(W / 2 - 0.04 * PX, Y(2.3), 0.08 * PX, 2.2 * PX); x.fillRect(0, Y(1.1), W, 0.06 * PX);
      band(2.3, 2.4, st); band(2.4, 2.8, '#22306e'); band(2.8, 2.9, red);
      pane(2.9, 6.9, red, 0.1);
      x.fillStyle = red; x.fillRect(0, Y(4.3), W, 0.08 * PX); x.fillRect(0, Y(5.6), W, 0.08 * PX);
      break;
    }
    case 'frostedPanels':
      // Bagarmossen's pavilion: panels of frosted glass, white, in bronze frames on a concrete
      // plinth, three rows of them, a transom at 2.6 m
      band(0, h, '#8d7b5e');
      band(0, 0.3, '#9a9890');
      for (const [a, b] of [[0.36, 1.5], [1.56, 2.55], [2.65, 3.34]]) {
        x.fillStyle = '#dfe2df'; x.fillRect(0.04 * PX, Y(b), W - 0.08 * PX, (b - a) * PX);
        x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0.04 * PX, Y(b), W * 0.35, (b - a) * PX);
        x.fillStyle = 'rgba(90,80,60,0.25)'; x.fillRect(0.04 * PX, Y(a) - 2, W - 0.08 * PX, 2);
      }
      break;
    case 'orangePanels':
      // flat steel panels painted orange, 1.2 m square
      x.fillStyle = '#d0782c'; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(3, 3, W * 0.4, H - 6);
      x.fillStyle = 'rgba(60,24,8,0.5)'; x.fillRect(0, 0, 2, H); x.fillRect(0, 0, W, 2);
      break;
    case 'gridPanels':
      // Skärmarbrink's hall: a dark grey plinth to 0.3 m, and over it flat panels, a pale grey
      // white, 1.25 m wide and in three rows, in grey joints
      band(0, 0.3, '#45484b');
      band(0.3, h, '#8f9496');
      for (const [a, b] of [[0.32, 1.28], [1.31, 2.27], [2.3, 3.23]]) {
        const v = 226 + Math.floor(r() * 8);
        x.fillStyle = `rgb(${v},${v + 1},${v - 1})`; x.fillRect(0.012 * PX, Y(b), W - 0.024 * PX, (b - a) * PX);
        x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(0.012 * PX, Y(b), W * 0.25, (b - a) * PX);
      }
      break;
    case 'navyTiles': {
      // Skärmarbrink's stair houses: glossy navy-blue tiles on end, 15 by 30 cm, in a stack bond
      x.fillStyle = '#9ea3aa'; x.fillRect(0, 0, W, H);
      const a = 0.15 * PX, b = 0.3 * PX;
      for (let i = 0; i * a < W; i++) for (let j = 0; j * b < H; j++) {
        const v = Math.floor(r() * 14);
        x.fillStyle = `rgb(${24 + v},${36 + v},${92 + v * 2})`; x.fillRect(i * a + 1.5, j * b + 1.5, a - 3, b - 3);
        x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(i * a + 3, j * b + 3, a * 0.3, b - 6);
      }
      break;
    }
    case 'pineBoards':
      // boards of varnished pine 10 cm wide, a warm orange-brown, each a little different, with
      // dark joints and streaks of grain along them
      x.fillStyle = '#5a3a1c'; x.fillRect(0, 0, W, H);
      for (let j = 0; j * 0.1 * PX < H; j++) {
        const v = Math.floor(r() * 26);
        x.fillStyle = `rgb(${176 + v},${118 + v * 0.7},${62 + v * 0.4})`; x.fillRect(0, j * 0.1 * PX + 1, W, 0.1 * PX - 2);
        for (let k = 0; k < 10; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '110,64,26' : '214,160,96'},0.25)`; x.fillRect(r() * W, j * 0.1 * PX + 2 + r() * (0.1 * PX - 5), 20 + r() * 80, 1); }
      }
      break;
    case 'redTiles': {
      // Gullmarsplan's walls: glossy red tiles 30 cm square, in pale grey joints, a glint on each
      x.fillStyle = '#a9a5a0'; x.fillRect(0, 0, W, H);
      const t = 0.3 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = Math.floor(r() * 22);
        x.fillStyle = `rgb(${178 + v},${18 + v * 0.4},${26 + v * 0.4})`; x.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
        x.fillStyle = 'rgba(255,255,255,0.13)'; x.fillRect(i * t + 5, j * t + 5, t * 0.5, 3);
        x.fillStyle = 'rgba(60,0,0,0.12)'; x.fillRect(i * t + 2, j * t + t * 0.6, t - 4, t * 0.4 - 2);
      }
      break;
    }
    case 'bronzeGlass': {
      // Gullmarsplan's bus terminal: a curtain wall of tinted glass, bronze-grey, in dark frames
      // 1.5 m apart, a transom every 1.8 m; drawn as seen from outside, the sky's grey in the glass
      x.fillStyle = '#2e2a26'; x.fillRect(0, 0, W, H);
      for (const [a, b] of [[0.04, 1.76], [1.84, 3.56]]) {
        const g = x.createLinearGradient(0, Y(b), 0, Y(a));
        g.addColorStop(0, '#8a8278'); g.addColorStop(1, '#4f4943');
        x.fillStyle = g; x.fillRect(0.04 * PX, Y(b), W - 0.08 * PX, (b - a) * PX);
        x.fillStyle = 'rgba(255,250,240,0.1)'; x.fillRect(0.04 * PX, Y(b), W * 0.28, (b - a) * PX);
      }
      break;
    }
    case 'bronzeGlazed': {
      // S:t Eriksplan's northern stair house: clear glass in thick frames of dark bronze 0.6 m
      // apart, a rail across them at 1.1 m, on a bronze sill
      const br = '#5a4633';
      pane(0, h, br, 0.14);
      x.fillStyle = br; x.fillRect(W / 2 - 0.07 * PX, 0, 0.14 * PX, H); x.fillRect(0, Y(0.15), W, 0.15 * PX); x.fillRect(0, Y(1.15), W, 0.08 * PX);
      x.fillStyle = 'rgba(255,236,210,0.2)'; x.fillRect(0, Y(0.15), W, 1.5);
      break;
    }
    case 'pixelTiles': {
      // Lars Arrhenius's tiles at Thorildsplan (2008): pale blue tiles 15 cm square in white joints,
      // two rows of pale yellow along the floor, and figures and bands picked out in coloured tiles
      // as in an old video game: a heart, a space invader, a cloud, toadstools, a note, a row of
      // snow-capped peaks in navy and teal, and black tiles scattered as if breaking up
      const t = 0.15 * PX, cols = Math.round(W / t), rows = Math.round(H / t);
      x.fillStyle = '#e4edf0'; x.fillRect(0, 0, W, H);
      const grid: (string | null)[][] = Array.from({ length: cols }, () => Array(rows).fill(null));
      const C: Record<string, string> = { k: '#16181c', w: '#f4f6f4', r: '#c8221f', g: '#3e9a62', n: '#27358a', t: '#2f9087', y: '#e2d886' };
      // a figure, its rows written from the top, its bottom left tile at column i, row j
      const put = (i: number, j: number, rowsTop: string[]) => rowsTop.forEach((line, k) => {
        const jj = j + rowsTop.length - 1 - k;
        for (let q = 0; q < line.length; q++) if (line[q] !== '.') grid[(i + q) % cols][jj % rows] = C[line[q]];
      });
      for (let i = 0; i < cols; i++) for (const j of [0, 1]) grid[i][j] = C.y;
      put(2, 3, ['..kkk.kkk..', '.krrrkrrrk.', 'krrwrrrrrrk', 'krwrrrrrrrk', 'krrrrrrrrrk', '.krrrrrrrk.', '..krrrrrk..', '...krrrk...', '....krk....', '.....k.....']);
      put(17, 4, ['..g.....g..', '...g...g...', '..ggggggg..', '.ggkgggkgg.', 'ggggggggggg', 'g.ggggggg.g', 'g.g.....g.g', '...gg.gg...']);
      put(29, 3, ['..kk', '..kk', '..k.', '..k.', '..k.', '.kk.', 'kkk.', 'kkk.', '.k..']);
      put(14, 2, ['.krrk.', 'krwrrk', 'rrrrwr', 'kkkkkk', '.kwwk.', '.kwwk.']);
      // the peaks, each ten tiles across and five high, white at the top, in turn navy and teal
      for (let p = 0; p * 8 < cols; p++) for (let q = 0; q < 5; q++) for (let i = p * 8 + q; i <= p * 8 + 9 - q; i++) {
        grid[i % cols][14 + q] = q >= 3 ? C.w : p % 2 ? C.t : C.n;
      }
      put(3, 20, ['....kkkk......', '...kwwwwk.kk..', '.kkwwwwwwkwwk.', 'kwwwwwwwwwwwwk', 'kwwwwwwwwwwwwk', '.kkkkkkkkkkkk.']);
      put(20, 21, ['..kkk.....', '.kwwwkkk..', 'kwwwwwwwk.', '.kkkkkkk..']);
      // black tiles breaking away from the invader
      for (let k = 0; k < 18; k++) {
        const i = 28 + Math.floor(r() * 4) - Math.floor(r() * 3), j = 5 + Math.floor(r() * 8);
        if (!grid[i % cols][j]) grid[i % cols][j] = C.k;
      }
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const v = Math.floor(r() * 10) - 5;
        let fill = grid[i][j];
        if (!fill) fill = `rgb(${158 + v},${206 + v},${236 + v})`;
        x.fillStyle = fill;
        x.fillRect(i * t + 1.5, H - (j + 1) * t + 1.5, t - 3, t - 3);
      }
      x.fillStyle = 'rgba(255,255,255,0.12)';
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) x.fillRect(i * t + 2, H - (j + 1) * t + 2, t * 0.35, 2);
      break;
    }
    case 'ballast':
      // a track's ballast: crushed grey stone, some of it rust-brown
      x.fillStyle = '#5f5b56'; x.fillRect(0, 0, W, H);
      for (let k = 0; k < 7000; k++) {
        const v = 78 + Math.floor(r() * 84), rust = r() < 0.3 ? 16 : 0, a = 4 + r() * 6;
        x.fillStyle = `rgb(${v + rust},${v + rust / 3},${v - 4 - rust / 2})`;
        x.fillRect(r() * W, r() * H, a, a * (0.55 + r() * 0.5));
      }
      speckle(x, W, H, 6000, 0.25, 93);
      break;
    case 'strawTiles':
    case 'reedTiles': {
      // glazed tiles 15 cm, straw yellow, in pale joints; Henjasaj Koda's Vassens viskningar
      // (Alvik, 1999), `reedTiles`: reeds of white tiles rising across them, leaning, each swelling
      // and narrowing up the wall (by diagonals of tiles, so that the picture repeats)
      x.fillStyle = '#c9c2b2'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX, cols = Math.round(W / t), rows = Math.round(H / t);
      const reeds = name === 'reedTiles' ? [0, 5, 9, 12].map((d) => ({ d, ph: r() * 6.3, w: 0.6 + r() * 0.8 })) : [];
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const reed = reeds.some((q) => {
          const w = Math.max(0, q.w + 1.1 * Math.sin((2 * Math.PI * j) / rows + q.ph));
          return ((i - j - q.d) % cols + cols) % cols < w;
        });
        const v = Math.floor(r() * 10);
        x.fillStyle = reed ? `rgb(${236 + v / 2},${233 + v / 2},${222 + v / 2})` : `rgb(${214 + v},${193 + v},${132 + v})`;
        x.fillRect(i * t + 1.5, H - (j + 1) * t + 1.5, t - 3, t - 3);
      }
      x.fillStyle = 'rgba(255,255,255,0.14)';
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) x.fillRect(i * t + 3, H - (j + 1) * t + 3, t * 0.4, 2);
      break;
    }
    case 'iceTerrazzo': {
      // Henjasaj Koda's Isens fjäll (Alvik, 1999): pale beige terrazzo, broad fields of blue-grey
      // terrazzo across it, and small dark blue triangles scattered over the pale; brass strips
      // along the fields' edges (each shape drawn again a repeat away, so that it tiles)
      x.fillStyle = '#cbc3b1'; x.fillRect(0, 0, W, H);
      speckle(x, W, H, 26000, 0.25, 94); speckle(x, W, H, 9000, 0.25, 95, true);
      const shape = (pts: number[][], fill: string, edge: string | null) => {
        for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
          x.beginPath(); pts.forEach(([a, b], k) => (k ? x.lineTo(a * W + ox, b * H + oy) : x.moveTo(a * W + ox, b * H + oy))); x.closePath();
          x.fillStyle = fill; x.fill();
          if (edge) { x.strokeStyle = edge; x.lineWidth = 2; x.stroke(); }
        }
      };
      const fields = [
        [[0.02, 0.1], [0.55, 0.02], [0.3, 0.48]], [[0.45, 0.55], [0.98, 0.4], [0.82, 0.95], [0.5, 0.85]],
        [[0.05, 0.62], [0.32, 0.72], [0.12, 0.98]],
      ];
      for (const f of fields) shape(f, '#76808c', '#b39a5e');
      for (let k = 0; k < 14; k++) {
        const cx = r(), cy = r(), a = 0.02 + r() * 0.025, t0 = r() * 6.3;
        shape([0, 1, 2].map((q) => [cx + Math.cos(t0 + q * 2.1) * a, cy + Math.sin(t0 + q * 2.1) * a * (W / H)]), '#2d3c58', null);
      }
      speckle(x, W, H, 12000, 0.22, 96); speckle(x, W, H, 6000, 0.3, 97, true);
      break;
    }
    case 'clinkerWindows': {
      // Stora mossen's ticket hall (Marianna Zaborska, 2002): clinker tiles 15 cm square in mixed
      // greens to 1 m, a steel sill, glass-fronted cases with maps in them to 1.75 m, and windows
      // in steel frames on up to the ceiling
      const t = 0.15 * PX, frame = '#8d9396';
      x.fillStyle = '#c9cbc4'; x.fillRect(0, Y(1.0), W, 1.0 * PX);
      for (let i = 0; i * t < W; i++) for (let j = 0; (j + 1) * t <= 1.0 * PX + 1; j++) {
        const v = r(), k = Math.floor(r() * 16);
        const [cr, cg, cb] = v < 0.3 ? [46, 84, 62] : v < 0.6 ? [74, 116, 88] : v < 0.85 ? [104, 138, 112] : [58, 98, 100];
        x.fillStyle = `rgb(${cr + k},${cg + k},${cb + k})`;
        x.fillRect(i * t + 1.5, Y(0) - (j + 1) * t + 1.5, t - 3, t - 3);
      }
      band(1.0, 1.06, frame);
      band(1.06, 1.75, '#3b4448');
      x.fillStyle = '#d9d4c2'; x.fillRect(0.08 * PX, Y(1.68), W - 0.16 * PX, 0.55 * PX);
      for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(${90 + r() * 80},${110 + r() * 60},${120 + r() * 50},0.5)`; x.fillRect(0.1 * PX + r() * (W - 0.3 * PX), Y(1.66) + r() * 0.5 * PX, 2 + r() * 14, 1 + r() * 4); }
      band(1.75, 1.8, frame); pane(1.8, 2.42, frame, 0.07); band(2.42, 2.5, '#2e3134');
      break;
    }
    case 'greyClerestory': {
      // Stora mossen's ticket hall from outside: grey sheet-metal panels to 1.75 m, a band of
      // windows in dark frames to 2.42 m, and the dark head under the fascia
      const frame = '#2b2e31';
      band(0, 1.75, '#8c9194');
      x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(3, Y(1.75), W * 0.3, 1.75 * PX);
      x.fillStyle = '#6f7477'; x.fillRect(W / 2 - 1, Y(1.75), 2, 1.75 * PX); x.fillRect(0, Y(1.75), 2, 1.75 * PX);
      band(1.75, 1.82, frame); pane(1.82, 2.42, frame, 0.08); band(2.42, 2.5, frame);
      break;
    }
    case 'portalTiles': {
      // Stora mossen's passage under the tracks: glazed square tiles, 15 cm, a muted teal green
      x.fillStyle = '#c3c8c2'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = Math.floor(r() * 14);
        x.fillStyle = `rgb(${92 + v},${138 + v},${132 + v})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
      }
      break;
    }
    case 'liftPanes': {
      // Stora mossen's lift tower, from the ballast up: a dark plinth to the platform, then grey
      // glass (tinted, and backed, so not seen through) in pale frames, two panes to a bay, a tall
      // row under a short one, between piers and rails of dark blue-grey steel
      const pier = '#3e4552', frame = '#c4c7c3';
      band(0, 4.8, pier);
      band(0, 1.15, '#4a4e52');
      for (const [from, to] of [[1.25, 3.7], [3.85, 4.7]]) {
        const x0 = 0.1 * PX, x1 = W - 0.1 * PX, top = Y(to), h = (to - from) * PX;
        x.fillStyle = frame; x.fillRect(x0, top, x1 - x0, h);
        for (const [a, b] of [[x0 + 6, W / 2 - 3], [W / 2 + 3, x1 - 6]]) {
          const g = x.createLinearGradient(0, top, 0, top + h);
          g.addColorStop(0, '#9aa2a8'); g.addColorStop(0.45, '#7f878d'); g.addColorStop(1, '#6e767c');
          x.fillStyle = g; x.fillRect(a, top + 6, b - a, h - 12);
          x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(a + (b - a) * 0.15, top + 6, (b - a) * 0.25, h - 12);
        }
      }
      break;
    }
    case 'roxnerTiles':
    case 'roxnerClerestory': {
      // Rigmor Roxner's clinker (Abrahamsberg, 1999): glazed tiles 15 cm square in some twenty
      // colours, greys, grey and sage greens, beiges, cream and white, set with "controlled
      // randomness" (in her words), in pale joints; for the ticket hall's back wall, the tiles to
      // 3 m, the concrete beam the tracks' deck rests on, and windows in dark frames above it
      x.fillStyle = '#b9bab4'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX, cols = ['#e6e5dd', '#dcdad0', '#cfd0c6', '#c2c6bd', '#b3b9b0', '#a4ab9f', '#959d92', '#8a9187', '#c9c1ad', '#bdb39c',
        '#d6ceb9', '#a9b4a8', '#9fb1a6', '#b8c4b8', '#7f8a83', '#cbd2c8', '#e9e6da', '#aeaba0', '#c4bba6', '#98a39c'];
      const top = name === 'roxnerTiles' ? Infinity : 3.0;
      for (let i = 0; i * t < W; i++) for (let j = 0; (j + 1) * 0.15 <= Math.min(top, h) + 1e-6; j++) {
        x.fillStyle = cols[Math.floor(r() * cols.length)];
        x.fillRect(i * t + 1.5, Y(0) - (j + 1) * t + 1.5, t - 3, t - 3);
      }
      if (name === 'roxnerClerestory') {
        const frame = '#26292b';
        band(3.0, 3.35, '#9c9a94'); band(3.35, 3.43, frame); pane(3.43, 4.72, frame, 0.1); band(4.72, 4.8, frame);
      }
      break;
    }
    case 'greyGlazed': {
      // Abrahamsberg's hall over the tracks (1999): a dark grey steel panel to 0.95 m, a rail on
      // it, and glass in dark grey steel frames above, the panes 1.2 m wide
      const frame = '#2f3438';
      band(0, 0.95, '#3a3f43');
      x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, Y(0.95), W, 2);
      band(0.95, 1.03, frame); pane(1.03, h, frame, 0.1);
      break;
    }
    case 'sageRender':
      // smooth render, a pale grey green
      x.fillStyle = '#a3b0a7'; x.fillRect(0, 0, W, H);
      speckle(x, W, H, 9000, 0.12, 100); speckle(x, W, H, 6000, 0.15, 101, true);
      break;
    case 'bottleTiles': {
      // glazed tiles 15 cm square, a dark bottle green, in pale grey joints
      x.fillStyle = '#9ea7a1'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = Math.floor(r() * 12);
        x.fillStyle = `rgb(${40 + v},${88 + v},${72 + v})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
      }
      break;
    }
    case 'purpleTiles': {
      // Brommaplan's way from the gates to the escalator: tiles on end, 10 by 30 cm, in purples,
      // lilac, dark blue and white at random in pale joints, to 2.5 m, and board-marked concrete
      // above them (photographs, 2016)
      x.fillStyle = '#a8a6a2'; x.fillRect(0, 0, W, H);
      for (let j = 0; j * 0.32 < h; j++) {
        const v = j % 3;
        x.fillStyle = `rgb(${158 + v * 4},${155 + v * 3},${150 + v * 3})`; x.fillRect(0, Y(Math.min(h, (j + 1) * 0.32)), W, 0.32 * PX);
      }
      for (let k = 0; k < 50; k++) { x.fillStyle = 'rgba(70,70,68,0.18)'; x.fillRect(0, Y(2.5 + r() * (h - 2.5)), W, 1); }
      const tw = 0.1 * PX, th = 0.3 * PX, cols = ['#7d5a8c', '#8e6c9e', '#a58bb5', '#b9a3c6', '#5e4472', '#26306e', '#1f2a5e', '#e8e6ea', '#d8d3dd', '#6a4f80'];
      for (let i = 0; i * tw < W; i++) for (let j = 0; (j + 1) * 0.3 <= 2.5 + 1e-6; j++) {
        x.fillStyle = cols[Math.floor(r() * cols.length)];
        x.fillRect(i * tw + 1, Y(0) - (j + 1) * th + 1, tw - 2, th - 2);
      }
      band(2.5, 2.54, '#8d8f90');
      break;
    }
    case 'rivetedSteel': {
      // Brommaplan's ticket hall: brushed stainless steel panels 1.2 m wide, a row of rivets
      // along each edge
      const g = x.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#b7bcc0'); g.addColorStop(0.5, '#cfd3d6'); g.addColorStop(1, '#b3b8bc');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      for (let k = 0; k < 400; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '90,95,100'},0.12)`; x.fillRect(0, Math.floor(r() * H), W, 1); }
      x.fillStyle = '#7d8388'; x.fillRect(0, 0, 2, H); x.fillRect(W - 2, 0, 2, H); x.fillRect(0, 0, W, 2);
      for (let k = 0; k < 12; k++) {
        const yy = (k + 0.5) * H / 12;
        for (const xx of [0.04 * PX, W - 0.04 * PX]) { x.fillStyle = '#e4e7e9'; x.beginPath(); x.arc(xx, yy, 2.2, 0, Math.PI * 2); x.fill(); x.fillStyle = 'rgba(60,64,68,0.5)'; x.beginPath(); x.arc(xx + 0.8, yy + 0.8, 1.6, 0, Math.PI * 2); x.fill(); }
      }
      break;
    }
    case 'rockMosaic': {
      // Henjasaj Koda's Orm och irisar (Alvik, 1999): a cement mosaic in black and pale cream,
      // flowing striations as in polished rock, here in broad black fields, there in cream ones
      // (functions of the repeat, so that it tiles)
      const img = x.createImageData(W, H), d = img.data, a = (2 * Math.PI) / w, b = (2 * Math.PI) / h;
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const mx = px / PX, my = (H - py) / PX;
        const warp = 1.4 * Math.sin(b * my + 0.9 * Math.sin(a * mx)) + 0.9 * Math.sin(2 * a * mx + b * my + 1.0) + 0.5 * Math.sin(3 * b * my - a * mx);
        const field = Math.sin(2 * a * mx + 0.8 * warp) * Math.cos(2 * b * my - 0.6 * warp + 0.4);
        const fine = Math.sin(26 * a * mx + 7 * b * my + 5 * warp) + 0.35 * Math.sin(61 * a * mx - 13 * b * my + 3 * warp);
        const black = field > 0.42 || (field > -0.42 && fine > 0.45 - field * 1.2);
        const k = (py * W + px) * 4, v = (px * 7 + py * 13) % 9;
        if (black) { d[k] = 30 + v; d[k + 1] = 30 + v; d[k + 2] = 29 + v; } else { d[k] = 222 + v; d[k + 1] = 214 + v; d[k + 2] = 196 + v; }
        d[k + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      speckle(x, W, H, 14000, 0.2, 98); speckle(x, W, H, 8000, 0.2, 99, true);
      break;
    }
    case 'glossTiles':
    case 'stripeTiles': {
      // Åkeshov's ticket hall: glossy white tiles 25 cm square in pale grey joints; on the walls by
      // the shop and the stairs (`stripeTiles`), upright stripes across them: a slip of red half a
      // tile wide beside a column of ochre tiles, twice in each 1.5 m (photographs, 2021)
      x.fillStyle = '#b4b5b2'; x.fillRect(0, 0, W, H);
      const t = 0.25 * PX, cols: [number, string][] = name === 'stripeTiles'
        ? [[0.25, 'w'], [0.25, 'w'], [0.125, 'r'], [0.25, 'o'], [0.25, 'w'], [0.125, 'r'], [0.25, 'o']]
        : [[0.25, 'w'], [0.25, 'w'], [0.25, 'w'], [0.25, 'w'], [0.25, 'w'], [0.25, 'w']];
      let x0 = 0;
      for (const [cw, k] of cols) {
        for (let j = 0; j * t < H; j++) {
          const v = Math.floor(r() * 8);
          x.fillStyle = k === 'r' ? `rgb(${196 + v},${70 + v},${58 + v})` : k === 'o' ? `rgb(${226 + v},${190 + v},${150 + v})` : `rgb(${238 + v / 2},${239 + v / 2},${236 + v / 2})`;
          x.fillRect(x0 + 1.5, j * t + 1.5, cw * PX - 3, t - 3);
          // the glaze's sheen, high on each tile
          x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(x0 + 4, j * t + 5, cw * PX * 0.55, 3);
        }
        x0 += cw * PX;
      }
      break;
    }
    case 'goranssonTiles': {
      // Mia Göransson's tiles at Råcksta (1990s): glazed tiles 15 cm square in whites and pale
      // greys with a faint blue in some, in pale joints; scattered over them, singly and in short
      // steps, relief tiles standing out a little, the size of one or two tiles, with the prints of
      // leaves and stalks pressed into them (photographs, 2018: the ticket hall, the passage and
      // the stairs' walls)
      x.fillStyle = '#c3c5c3'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX, n = Math.round(W / t);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const k = r(), v = 224 + Math.floor(r() * 18), b = k < 0.3 ? 6 : 0;
        x.fillStyle = `rgb(${v - b},${v - b / 2},${v})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
        // the glaze's sheen, high on each tile
        x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(i * t + 3, j * t + 3, t - 6, t * 0.18);
      }
      // the relief tiles: a lighter face, a shadow along the bottom and right where they stand
      // out, and a leaf or a stalk on each (a stem with pairs of veins, or a single bent stalk)
      const relief = (i: number, j: number, w: number, hh: number) => {
        const x0 = i * t + 1, y0 = j * t + 1, ww = w * t - 2, hw = hh * t - 2;
        x.fillStyle = 'rgba(70,74,78,0.55)'; x.fillRect(x0 + 3, y0 + 3, ww, hw);
        const v = 232 + Math.floor(r() * 10);
        x.fillStyle = `rgb(${v - 3},${v - 1},${v})`; x.fillRect(x0, y0, ww, hw);
        x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(x0, y0, ww, 2); x.fillRect(x0, y0, 2, hw);
        x.strokeStyle = 'rgba(120,124,128,0.7)'; x.lineWidth = 1.3;
        const cx = x0 + ww / 2, cy = y0 + hw / 2, a = r() * Math.PI, L = Math.min(ww, hw) * 0.42;
        const dx = Math.cos(a), dy = Math.sin(a);
        x.beginPath(); x.moveTo(cx - dx * L, cy - dy * L); x.lineTo(cx + dx * L, cy + dy * L); x.stroke();
        if (r() < 0.6) for (let q = -0.6; q <= 0.6; q += 0.3) {
          const px = cx + dx * L * q, py = cy + dy * L * q, vl = L * 0.35;
          x.beginPath(); x.moveTo(px, py); x.lineTo(px + (dx * 0.5 - dy * 0.85) * vl, py + (dy * 0.5 + dx * 0.85) * vl); x.stroke();
          x.beginPath(); x.moveTo(px, py); x.lineTo(px + (dx * 0.5 + dy * 0.85) * vl, py + (dy * 0.5 - dx * 0.85) * vl); x.stroke();
        }
      };
      for (const [i, j, w, hh] of [[1, 2, 2, 1], [5, 1, 1, 1], [8, 3, 2, 2], [3, 6, 1, 2], [10, 7, 1, 1], [0, 9, 2, 1], [6, 9, 1, 1], [9, 10, 2, 1], [2, 11, 1, 1]]) {
        relief(i, j, w, hh);
        // (a second, smaller tile stepped off some of them)
        if ((i + j) % 3 === 0) relief(i + w, j + hh - 1, 1, 1);
      }
      break;
    }
    case 'greenBooth': {
      // the kiosk on Råcksta's platform: square enamelled steel panels, a dull green, in four rows
      // over the concrete base, a row above them with a window in a cream frame, and the cream
      // band of the roof's edge over all (photographs, 2006 and 2018)
      const green = '#5c7a4e';
      band(0, h, '#2e3a2b');
      const pw = W / 4, ph = 0.46 * PX;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        x.fillStyle = green; x.fillRect(i * pw + 2, Y((j + 1) * 0.46) + 2, pw - 4, ph - 4);
        x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(i * pw + 2, Y((j + 1) * 0.46) + 2, pw * 0.3, ph - 4);
        x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(i * pw + 2, Y((j + 1) * 0.46 - 0.4), pw - 4, 2);
      }
      // the window row: a panel each side of the window, the glass pale with the sky in it
      x.fillStyle = green; x.fillRect(2, Y(2.3) + 2, W - 4, 0.46 * PX - 4);
      x.fillStyle = '#d9cfa6'; x.fillRect(W / 2 - 0.55 * PX, Y(2.25), 1.1 * PX, 0.38 * PX);
      const g = x.createLinearGradient(0, Y(2.22), 0, Y(1.9));
      g.addColorStop(0, '#b9c8d4'); g.addColorStop(1, '#7f909c');
      x.fillStyle = g; x.fillRect(W / 2 - 0.52 * PX, Y(2.22), 1.04 * PX, 0.32 * PX);
      band(2.3, h, '#e3e1d8');
      x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(0, Y(2.3), W, 2);
      break;
    }
    case 'barkGrey':
    case 'barkRed': {
      // Casimir Djuric's concrete trees on Vällingby's platforms (1983): square columns cast with
      // a bark of deep upright fissures, the plates between them split across here and there; grey
      // concrete, or stained a red-brown (photographs, 2006 to 2019)
      const red = name === 'barkRed', base = red ? [124, 74, 58] : [142, 140, 134];
      const dark = red ? 'rgba(42,20,14,0.75)' : 'rgba(40,38,36,0.75)';
      x.fillStyle = `rgb(${base.join(',')})`; x.fillRect(0, 0, W, H);
      // the plates: upright strips of different widths, each a little lighter or darker
      for (let px = 0; px < W;) {
        const w = 8 + r() * 14, v = Math.floor(r() * 28) - 14;
        x.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; x.fillRect(px, 0, Math.min(w, W - px), H);
        px += w;
      }
      // the fissures: dark lines wandering from top to bottom (their waves a whole number of times
      // up the picture, so that it repeats), lit along one side
      for (let k = 0; k < 9; k++) {
        const x0 = r() * W, amp = 2 + r() * 4, waves = 1 + Math.floor(r() * 3), ph = r() * Math.PI * 2, wd = 2 + r() * 3;
        const line = (dx: number, style: string, lw: number, o: number) => {
          x.strokeStyle = style; x.lineWidth = lw; x.beginPath();
          for (let y = 0; y <= H; y += 8) {
            const xx = o + x0 + dx + Math.sin(ph + (y / H) * waves * Math.PI * 2) * amp;
            if (y) x.lineTo(xx, y); else x.moveTo(xx, y);
          }
          x.stroke();
        };
        for (const o of [-W, 0, W]) { line(0, dark, wd, o); line(wd * 0.8, 'rgba(255,255,255,0.18)', 1.5, o); }
      }
      // short splits across the plates
      for (let k = 0; k < 40; k++) { x.fillStyle = dark; x.fillRect(r() * W, r() * H, 4 + r() * 10, 1.5); }
      break;
    }
    case 'checkTiles': {
      // Vällingby's stair houses and its ticket hall under the bridge: glossy tiles on end, 15 by
      // 30 cm, white and a pale blue-grey in a check, in pale joints (photographs, 2006 to 2019)
      x.fillStyle = '#c9cbca'; x.fillRect(0, 0, W, H);
      const a = 0.15 * PX, b = 0.3 * PX;
      for (let i = 0; i * a < W; i++) for (let j = 0; j * b < H; j++) {
        const v = Math.floor(r() * 8);
        x.fillStyle = (i + j) % 2 ? `rgb(${150 + v},${158 + v},${165 + v})` : `rgb(${232 + v},${233 + v},${230 + v})`;
        x.fillRect(i * a + 1.5, j * b + 1.5, a - 3, b - 3);
        x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(i * a + 3, j * b + 3, a * 0.25, b - 6);
      }
      break;
    }
    case 'dripTiles':
    case 'ochreDoor': {
      // Johannelund's ticket hall and passage, and the rooms at its roofs' ends (1956): glazed
      // tiles, 15 cm, a warm ochre yellow (as yellowTiles), in pale joints; in the hall
      // (`dripTiles`) dark green ones along the top, from 2.1 m, dripping down the wall a few
      // tiles at a time, a stray one here and there below; on a room's end (`ochreDoor`) a steel
      // door painted orange, 1 m wide and 2.1 m high, 0.5 m in from its left (photographs, 2006
      // to 2018)
      x.fillStyle = '#b3aa96'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX, cols = Math.round(W / t), rows = Math.round(H / t);
      // (how many tiles down from the top each column's green reaches)
      const drip = Array.from({ length: cols }, () => name === 'dripTiles' ? 4 + Math.floor(r() * r() * 6) : 0);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const down = rows - 1 - j, green = down < drip[i] || (name === 'dripTiles' && down < drip[i] + 4 && r() < 0.12);
        const v = Math.floor(r() * 12);
        x.fillStyle = green ? `rgb(${40 + v},${98 + v},${80 + v})` : `rgb(${218 + v},${178 + v},${88 + v})`;
        x.fillRect(i * t + 1.5, H - (j + 1) * t + 1.5, t - 3, t - 3);
      }
      if (name === 'ochreDoor') {
        x.fillStyle = '#8a4a1c'; x.fillRect(0.46 * PX, Y(2.14), 1.08 * PX, 2.14 * PX);
        x.fillStyle = '#c8682a'; x.fillRect(0.5 * PX, Y(2.1), 1.0 * PX, 2.1 * PX);
        x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0.53 * PX, Y(2.07), 0.3 * PX, 2.04 * PX);
        x.fillStyle = 'rgba(60,30,10,0.35)'; x.fillRect(0.5 * PX, Y(2.1), 1.0 * PX, 2);
        x.fillStyle = '#a9aeb1'; x.fillRect(1.36 * PX, Y(1.07), 0.1 * PX, 0.03 * PX);
      }
      break;
    }
    case 'mosaicPosters': {
      // Vällingby's walls beyond the tracks under the decks: a mosaic of small glossy tiles in dark
      // greens, and posters in pairs in white frames along it at the platforms' eye height
      // (photographs, 2013 to 2019); measured up from the track bed, 1.2 m under the platforms
      x.fillStyle = '#1c342d'; x.fillRect(0, 0, W, H);
      const t = 0.05 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = Math.floor(r() * 30);
        x.fillStyle = r() < 0.15 ? `rgb(${62 + v},${112 + v},${98 + v})` : `rgb(${30 + v / 2},${80 + v},${68 + v})`;
        x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
      }
      // each poster 1.2 by 1.75 m: a ground of one colour, a shape on it, lines of white text
      const p0 = 2.3, p1 = 4.05, pw = 1.2 * PX;
      const grounds = ['#e4508c', '#f0c233', '#3b7bd0', '#f1efe9', '#d9452f', '#6b3d8f'];
      for (const [k, px0] of [[0, 1.0 * PX], [1, 2.6 * PX]] as [number, number][]) {
        x.fillStyle = '#ebebe8'; x.fillRect(px0 - 0.05 * PX, Y(p1 + 0.05), pw + 0.1 * PX, (p1 - p0 + 0.1) * PX);
        const g = grounds[(k * 3 + Math.floor(r() * 6)) % 6];
        x.fillStyle = g; x.fillRect(px0, Y(p1), pw, (p1 - p0) * PX);
        x.fillStyle = g === '#f1efe9' ? '#3b4a5a' : 'rgba(255,255,255,0.85)';
        x.beginPath(); x.arc(px0 + pw * (0.35 + r() * 0.3), Y(p1 - 0.6), 0.3 * PX, 0, Math.PI * 2); x.fill();
        for (let l = 0; l < 3; l++) x.fillRect(px0 + 0.12 * PX, Y(p0 + 0.55 - l * 0.14), pw * (0.5 + r() * 0.3), 0.07 * PX);
      }
      break;
    }
    case 'vallingbyCentrum': {
      // Vällingby centrum's buildings round the station (1954): shop fronts under the white edge of
      // a canopy, and over them pale sheet metal corrugated upright, a ribbon of windows in white
      // frames along the upper floor, the sheet metal again up to the coping (photographs, 1955 to
      // 2024)
      const shop = x.createLinearGradient(0, Y(3.2), 0, Y(0.15));
      shop.addColorStop(0, '#a6b2b8'); shop.addColorStop(0.5, '#cdc6b4'); shop.addColorStop(1, '#8c979c');
      x.fillStyle = shop; x.fillRect(0, Y(3.2), W, 3.05 * PX);
      band(0, 0.15, '#5f6366');
      x.fillStyle = '#6d7377';
      for (const m of [0, 1.2, 2.4]) x.fillRect(m * PX, Y(3.2), 0.06 * PX, 3.05 * PX);
      x.fillRect(0, Y(2.45), W, 0.05 * PX);
      x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(0.15 * PX, Y(3.1), 0.35 * PX, 2.8 * PX);
      band(3.2, 3.85, '#e8e8e3'); band(3.2, 3.28, '#3b3f43');
      const corrugated = (from: number, to: number) => {
        band(from, to, '#cfd2d0');
        for (let i = 0; i * 0.08 * PX < W; i++) {
          x.fillStyle = 'rgba(90,96,100,0.22)'; x.fillRect(i * 0.08 * PX, Y(to), 0.03 * PX, (to - from) * PX);
          x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(i * 0.08 * PX + 0.045 * PX, Y(to), 0.015 * PX, (to - from) * PX);
        }
      };
      corrugated(3.85, 5.1);
      band(5.1, 6.55, '#f0f0ec');
      const glass = x.createLinearGradient(0, Y(6.45), 0, Y(5.2));
      glass.addColorStop(0, '#a4b5c1'); glass.addColorStop(1, '#6f7f8a');
      for (const m of [0, 1.2, 2.4]) {
        x.fillStyle = glass; x.fillRect(m * PX + 0.07 * PX, Y(6.45), 1.06 * PX, 1.25 * PX);
        x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(m * PX + 0.12 * PX, Y(6.4), 0.3 * PX, 1.15 * PX);
      }
      corrugated(6.55, 7.85);
      band(7.85, 8.0, '#7d8285');
      break;
    }
    case 'twoGreens': {
      // the outside of Åkeshov's shop and staff rooms under the southern deck: flat panels about
      // 0.95 m wide, a lighter green and a dark bottle green in turn, on a black plinth, a dark
      // edge along their top (photographs, 2018 and 2021)
      band(0, h, '#1f2324');
      const pw = W / 2;
      for (const [k, fill] of [[0, '#2f7c60'], [1, '#225f4b']] as [number, string][]) {
        x.fillStyle = fill; x.fillRect(k * pw + 2, Y(h - 0.06), pw - 4, (h - 0.06 - 0.14) * PX);
        x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(k * pw + 2, Y(h - 0.06), pw * 0.25, (h - 0.2) * PX);
      }
      band(0, 0.14, '#151617');
      break;
    }
    case 'latticeConcrete': {
      // the abutment beside Åkeshov's underpass: grey concrete under a diagonal lattice of
      // weathered grey battens, crossing each other 0.4 m apart (photographs, 2018 and 2021)
      x.fillStyle = '#86837d'; x.fillRect(0, 0, W, H);
      speckle(x, W, H, 6000, 0.12, 102);
      const d = 0.4 * PX, bw = 0.06 * PX;
      for (const dir of [1, -1]) {
        for (let k = -6; k <= 6; k++) {
          const c0 = k * d;
          // (each batten drawn again a repeat away, so that it tiles)
          for (const o of [-W, 0, W]) {
            x.strokeStyle = 'rgba(40,40,38,0.45)'; x.lineWidth = bw + 4;
            x.beginPath(); x.moveTo(c0 + o + 3, dir > 0 ? H + 3 : -3); x.lineTo(c0 + o + 3 + dir * H, dir > 0 ? 3 : H + 3); x.stroke();
            x.strokeStyle = dir > 0 ? '#aba79e' : '#b3afa5'; x.lineWidth = bw;
            x.beginPath(); x.moveTo(c0 + o, dir > 0 ? H : 0); x.lineTo(c0 + o + dir * H, dir > 0 ? 0 : H); x.stroke();
          }
        }
      }
      break;
    }
    case 'scrollPanels': {
      // Åsa Lindström's ceramics in Ängbyplan's lift passage (1994): glazed tiles 15 cm square, in
      // bands three tiles wide of white scrolls curling on black, between panels ten tiles wide,
      // each patterned in its own colours: an olive grid with ochre dots, red and olive stripes,
      // purple with red crosses and teal lozenges, brown with olive and ochre squares; and a frieze
      // of the scrolls along the top (photographs, 2018)
      const t = 0.15 * PX, rows = Math.round(H / t);
      x.fillStyle = '#9c9a94'; x.fillRect(0, 0, W, H);
      const scroll = (cx: number, cy: number, flip: boolean) => {
        x.fillStyle = '#141416'; x.fillRect(cx + 1, cy + 1, t - 2, t - 2);
        x.save(); x.translate(cx + t / 2, cy + t / 2); if (flip) x.scale(-1, 1);
        x.fillStyle = '#f2f1ec';
        x.beginPath(); x.arc(-t * 0.08, -t * 0.05, t * 0.36, 0.2 * Math.PI, 1.9 * Math.PI); x.arc(-t * 0.02, -t * 0.08, t * 0.2, 1.9 * Math.PI, 0.2 * Math.PI, true); x.fill();
        x.beginPath(); x.arc(t * 0.12, t * 0.22, t * 0.11, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#141416'; x.beginPath(); x.arc(t * 0.12, t * 0.22, t * 0.05, 0, Math.PI * 2); x.fill();
        x.restore();
      };
      const tile = (cx: number, cy: number, k: number) => {
        const v = Math.floor(r() * 10) - 5, c = (rgb: [number, number, number]) => `rgb(${rgb[0] + v},${rgb[1] + v},${rgb[2] + v})`;
        const fill = (rgb: [number, number, number], a: number, b: number, w: number, h: number) => { x.fillStyle = c(rgb); x.fillRect(cx + a * t, cy + b * t, w * t, h * t); };
        if (k === 0) {
          fill([86, 84, 40], 0.04, 0.04, 0.92, 0.92); fill([140, 136, 62], 0.04, 0.42, 0.92, 0.16); fill([140, 136, 62], 0.42, 0.04, 0.16, 0.92);
          x.fillStyle = '#d9b443'; for (const [a, b] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) { x.beginPath(); x.arc(cx + a * t, cy + b * t, t * 0.07, 0, Math.PI * 2); x.fill(); }
        } else if (k === 1) {
          fill([128, 30, 44], 0.04, 0.04, 0.92, 0.92); fill([118, 116, 54], 0.04, 0.34, 0.92, 0.3); fill([226, 214, 178], 0.04, 0.32, 0.92, 0.03); fill([226, 214, 178], 0.04, 0.64, 0.92, 0.03);
        } else if (k === 2) {
          fill([84, 54, 104], 0.04, 0.04, 0.92, 0.92); fill([160, 40, 58], 0.42, 0.1, 0.16, 0.8); fill([160, 40, 58], 0.1, 0.42, 0.8, 0.16);
          x.fillStyle = c([58, 140, 136]); x.beginPath(); x.moveTo(cx + 0.5 * t, cy + 0.3 * t); x.lineTo(cx + 0.7 * t, cy + 0.5 * t); x.lineTo(cx + 0.5 * t, cy + 0.7 * t); x.lineTo(cx + 0.3 * t, cy + 0.5 * t); x.fill();
        } else {
          fill([104, 72, 42], 0.04, 0.04, 0.92, 0.92); fill([128, 128, 58], 0.12, 0.12, 0.32, 0.32); fill([128, 128, 58], 0.56, 0.56, 0.32, 0.32);
          fill([210, 172, 70], 0.56, 0.12, 0.32, 0.32); fill([210, 172, 70], 0.12, 0.56, 0.32, 0.32);
        }
      };
      for (let i = 0; i * t < W; i++) {
        const m = i % 13, panel = Math.floor(i / 13);
        for (let j = 0; j < rows; j++) {
          const cx = i * t, cy = j * t;
          if (m < 3 || j < 2) scroll(cx, cy, (i + j) % 2 === 1);
          else tile(cx, cy, panel % 4);
          // the glaze's sheen, high on each tile
          x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(cx + 3, cy + 3, t * 0.5, 2);
        }
      }
      break;
    }
    case 'opPanels': {
      // Åsa Lindström's ceramics beside the stairs at Ängbyplan (1994): glazed tiles 15 cm square,
      // in panels four tiles wide patterned in black, white and grey (discs, lozenges, rings and
      // checks, mirrored about each panel's middle), between strips of orange-red tiles, to
      // 2.25 m; orange-red tiles above (photographs, 2024)
      const t = 0.15 * PX, red = () => { const v = Math.floor(r() * 18) - 9; return `rgb(${204 + v},${70 + v * 0.5},${40 + v * 0.4})`; };
      x.fillStyle = '#b8aea2'; x.fillRect(0, 0, W, H);
      const motif = (cx: number, cy: number, k: number, flip: boolean) => {
        const v = Math.floor(r() * 12);
        x.fillStyle = k % 2 ? `rgb(${226 + v / 2},${226 + v / 2},${222 + v / 2})` : `rgb(${130 + v},${132 + v},${132 + v})`;
        x.fillRect(cx + 1, cy + 1, t - 2, t - 2);
        x.save(); x.translate(cx + t / 2, cy + t / 2); if (flip) x.scale(-1, 1);
        x.fillStyle = '#18181a'; x.strokeStyle = '#18181a'; x.lineWidth = t * 0.08;
        if (k === 0) { x.beginPath(); x.arc(0, 0, t * 0.3, 0, Math.PI * 2); x.fill(); x.fillStyle = '#e8e8e4'; x.beginPath(); x.arc(t * 0.08, -t * 0.06, t * 0.14, 0, Math.PI * 2); x.fill(); }
        else if (k === 1) { x.beginPath(); x.moveTo(0, -t * 0.42); x.lineTo(t * 0.3, 0); x.lineTo(0, t * 0.42); x.lineTo(-t * 0.3, 0); x.fill(); }
        else if (k === 2) { for (const rr of [0.36, 0.22, 0.08]) { x.beginPath(); x.arc(-t * 0.5, -t * 0.5, t * rr * 2, 0, Math.PI / 2); x.stroke(); } }
        else { x.fillRect(-t / 2 + 1, -t / 2 + 1, t / 2 - 1, t / 2 - 1); x.fillRect(0, 0, t / 2 - 1, t / 2 - 1); x.fillStyle = '#e8e8e4'; x.beginPath(); x.arc(0, 0, t * 0.12, 0, Math.PI * 2); x.fill(); }
        x.restore();
      };
      const panelRows = 15;
      for (let p = 0; p < 2; p++) {
        const x0 = p * 0.7 * PX;
        for (let j = 0; j * t < H; j++) {
          const cy = H - (j + 1) * t;
          // the strip of red between the panels, half a tile wide
          x.fillStyle = red(); x.fillRect(x0 + 1, cy + 1, 0.1 * PX - 2, t - 2);
          for (let i = 0; i < 4; i++) {
            const cx = x0 + 0.1 * PX + i * t;
            if (j < panelRows) motif(cx, cy, (j + p * 2 + (i === 1 || i === 2 ? 1 : 0)) % 4, i >= 2);
            else { x.fillStyle = red(); x.fillRect(cx + 1, cy + 1, t - 2, t - 2); }
            x.fillStyle = 'rgba(255,255,255,0.16)'; x.fillRect(cx + 3, cy + 3, t * 0.5, 2);
          }
        }
      }
      break;
    }
    case 'circleFront': {
      // Ängbyplan's doors from the ticket hall to the stair house: glass doors in brushed steel
      // frames, a yellow line, SL's dark blue band with a white disc on it over each door, a
      // steel transom, and glass in steel frames above (photographs, 2024)
      const steelLight = '#a9aeb1';
      band(0, 0.1, steelLight); pane(0.1, 2.3, steelLight, 0.12);
      x.fillStyle = steelLight; x.fillRect(0, Y(1.05), W, 0.05 * PX);
      band(2.3, 2.36, '#e8b830'); band(2.36, 2.84, '#1d2a66');
      x.fillStyle = '#f2f2ee'; x.beginPath(); x.arc(W / 2, Y(2.6), 0.17 * PX, 0, Math.PI * 2); x.fill();
      band(2.84, 2.92, steelLight); pane(2.92, 4.2, steelLight, 0.1);
      break;
    }
    case 'stripPanels': {
      // Ängbyplan's ticket hall: pale grey panels 0.9 m wide, a black strip between each two, to
      // 2.6 m on a dark plinth; a dark steel sill, and windows in grey steel frames above
      // (photographs, 2018 and 2024)
      band(0, h, '#3a3d40');
      band(0.1, 2.6, '#d3d5d2');
      x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(0.06 * PX, Y(2.6), W * 0.3, 2.5 * PX);
      x.fillStyle = '#18191b'; x.fillRect(0, Y(2.6), 0.03 * PX, 2.5 * PX); x.fillRect(W - 0.03 * PX, Y(2.6), 0.03 * PX, 2.5 * PX);
      band(2.6, 2.72, '#3a3d40'); pane(2.72, 3.9, steel, 0.1); band(3.9, 4, steel);
      break;
    }
    case 'maroonGlazed': {
      // Ängbyplan's stair house: clear glass in steel frames painted a dark red-brown, 1.2 m apart,
      // a transom 2.2 m up (photographs, 2024)
      const mr = '#4b2a25';
      pane(0, h, mr, 0.1);
      x.fillStyle = mr; x.fillRect(0, Y(0.08), W, 0.08 * PX); x.fillRect(0, Y(2.24), W, 0.07 * PX);
      x.fillStyle = 'rgba(255,230,220,0.18)'; x.fillRect(0, Y(0.08), W, 1.5);
      break;
    }
    case 'slateGlazed': {
      // Islandstorget's lift tower: clear glass in steel frames painted slate blue, 1.4 m apart, a
      // transom every 1.15 m (photographs, 2018)
      const sl = '#475f74';
      pane(0, h, sl, 0.1);
      x.fillStyle = sl;
      for (const y of [0.05, 1.15, 2.3, 3.45, 4.55]) x.fillRect(0, Y(y + 0.05), W, 0.1 * PX);
      break;
    }
    case 'greenEnamel':
    case 'tornellEnamel': {
      // Hässelby gård's ticket hall and stairs, done again in 2012 (SL's architect Stefan Hagdahl):
      // panels of green glass enamel on steel, 1.2 m wide and 1.1 m high, in thin dark joints, each
      // a shade off its neighbours and glossy, the light catching their upper halves; past the
      // gates (`tornellEnamel`) Pia Törnell's I ett nu (2012) in the same panels, perforated and lit
      // from behind, the holes broken loose from a grid and drawn into (or flung out of) a point in
      // the middle of each wall (photographs, 2018; her page and hesselby.com)
      x.fillStyle = '#20302a'; x.fillRect(0, 0, W, H);
      const pw = 1.2 * PX, ph = 1.1 * PX;
      for (let i = 0; i * pw < W; i++) for (let j = 0; j * ph < H; j++) {
        const v = Math.floor(r() * 14) - 7, x0 = i * pw + 1.5, y0 = H - (j + 1) * ph + 1.5;
        x.fillStyle = `rgb(${104 + v},${142 + v},${122 + v})`; x.fillRect(x0, y0, pw - 3, ph - 3);
        const g = x.createLinearGradient(0, y0, 0, y0 + ph);
        g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(0.5, 'rgba(255,255,255,0.03)'); g.addColorStop(1, 'rgba(0,0,0,0.08)');
        x.fillStyle = g; x.fillRect(x0, y0, pw - 3, ph - 3);
      }
      if (name === 'tornellEnamel') for (const [dx, dy, dr, violet] of tornellHoles(W, H, PX)) {
        x.fillStyle = violet ? '#e4d6f2' : '#f4f2ee';
        x.beginPath(); x.arc(dx, dy, dr, 0, Math.PI * 2); x.fill();
      }
      break;
    }
    case 'brownTiles': {
      // the tiles round Hässelby gård's ticket hall, facing the square: dark brown, 20 cm square,
      // in lighter joints (photographs, 2018)
      x.fillStyle = '#76675b'; x.fillRect(0, 0, W, H);
      const t = 0.2 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = Math.floor(r() * 16) - 8;
        x.fillStyle = `rgb(${76 + v},${52 + v},${40 + v})`; x.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
        x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(i * t + 3, j * t + 3, t * 0.3, t - 6);
      }
      break;
    }
    case 'partosTiles': {
      // Hässelby strand's ramp and ticket hall: white tiles, 15 cm, in grey joints, and over them
      // Christian Partos's Teleporteringar (Teleportings, 2000), clinker mosaic of small tiles,
      // 4 cm, in yellows, greens, teals, a little red and pale blue, in clouds whose shapes smear
      // out sideways into ragged streaks, as if half beamed elsewhere (photographs, 2018)
      x.fillStyle = '#9fa19e'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 236 + Math.floor(r() * 12);
        x.fillStyle = `rgb(${v},${v},${v - 2})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
        x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(i * t + 3, j * t + 3, t * 0.3, t - 6);
      }
      // each cloud: a few blobs (x, y, rx, ry in metres) and the way its streaks run (-1 or 1)
      const clouds: { blobs: [number, number, number, number][]; dir: number; hue: number }[] = [
        { blobs: [[1.8, 1.7, 1.4, 0.75], [2.9, 2.05, 0.8, 0.5], [1.0, 1.35, 0.7, 0.45]], dir: 1, hue: 0 },
        { blobs: [[5.3, 1.0, 1.1, 0.6], [6.2, 1.35, 0.7, 0.4], [4.5, 0.8, 0.5, 0.32]], dir: -1, hue: 1 },
        { blobs: [[4.1, 3.0, 0.75, 0.42], [4.8, 3.25, 0.45, 0.28]], dir: 1, hue: 2 },
      ];
      const cols = [
        ['#f2e14a', '#e9d63c', '#c9dc4c', '#9fcf5a', '#5fbf8a', '#3fb0a6', '#d94a3c', '#a8d4e6'],
        ['#e4ef6a', '#b9e05a', '#7ccf6e', '#46b89a', '#2f9fb0', '#f0d848', '#e05a48', '#c9e8f0'],
        ['#9fe0d0', '#6fcfc0', '#e8e070', '#f0a050', '#d8584a', '#b0dce8', '#80c870', '#f4ec90'],
      ];
      const m = 0.04 * PX;
      for (let i = 0; i * m < W; i++) for (let j = 0; j * m < H; j++) {
        const px = (i + 0.5) / PX * m, py = h - (j + 0.5) / PX * m;
        for (const c of clouds) {
          // how deep in the cloud, its blobs smeared towards their streaks' side
          let f = 0;
          for (const [bx, by, rx, ry] of c.blobs) {
            const dx = (px - bx) / rx, dy = (py - by) / ry;
            const sx = dx * c.dir > 0 ? dx / (1 + 2.5 * Math.abs(Math.sin(py * 23 + bx * 7)) ** 3) : dx;
            f = Math.max(f, Math.exp(-(sx * sx + dy * dy) * 1.4));
          }
          if (f < 0.12 + r() * 0.25) continue;
          const pal = cols[c.hue], k = Math.min(pal.length - 1, Math.floor((1 - f) * 5 + r() * 3.5));
          x.fillStyle = pal[k]; x.fillRect(i * m + 0.75, H - (j + 1) * m + 0.75, m - 1.5, m - 1.5);
          break;
        }
      }
      break;
    }
    case 'cafeWall': {
      // the tiles round Hässelby strand's lift and down the ramp's mouth, part of Christian Partos's
      // Teleporteringar (2000): black and white tiles, 15 cm, in rows, each row shifted along from
      // the one under it by a third of a tile and back again, so that the grey joints between the
      // rows seem to slope (the café wall illusion; photographs, 2018)
      x.fillStyle = '#8f918e'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX, shifts = [0, 1 / 3, 2 / 3, 1 / 3];
      for (let j = 0; j * t < H; j++) {
        const off = shifts[j % shifts.length] * t;
        for (let i = -1; i * t < W; i++) {
          const v = Math.floor(r() * 8), black = (i & 1) === 0;
          x.fillStyle = black ? `rgb(${20 + v},${20 + v},${22 + v})` : `rgb(${236 + v},${236 + v},${232 + v})`;
          x.fillRect(i * t + off + 1, j * t + 1.5, t - 2, t - 3);
          x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(i * t + off + 3, j * t + 3, t * 0.25, t - 6);
        }
      }
      break;
    }
    case 'iridescentTiles': {
      // over Hässelby strand's lift (Christian Partos, 2000): glazed tiles, 30 cm, shimmering like
      // oil on water in olive and sage greens, ochres, mauves and teals, each changing colour across
      // its face, and on some a copper spiral (photographs, 2018)
      x.fillStyle = '#5a5e52'; x.fillRect(0, 0, W, H);
      const t = 0.3 * PX, cols = ['#8a9a4a', '#a7a04c', '#7f9c78', '#b0884e', '#8e7a96', '#5f8f8a', '#9db06a', '#c0a060', '#6c8a5c', '#a07a80'];
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const x0 = i * t + 1.5, y0 = j * t + 1.5, s0 = t - 3;
        const g = x.createLinearGradient(x0, y0, x0 + s0, y0 + s0);
        g.addColorStop(0, cols[Math.floor(r() * cols.length)]); g.addColorStop(0.55, cols[Math.floor(r() * cols.length)]); g.addColorStop(1, cols[Math.floor(r() * cols.length)]);
        x.fillStyle = g; x.fillRect(x0, y0, s0, s0);
        x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(x0 + 3, y0 + 3, s0 * 0.4, s0 * 0.4);
        if (r() < 0.14) {
          x.strokeStyle = '#7a4a2a'; x.lineWidth = 2.5; x.beginPath();
          for (let a = 0; a < Math.PI * 7; a += 0.2) {
            const rr = a / (Math.PI * 7) * s0 * 0.36;
            const px = x0 + s0 / 2 + Math.cos(a) * rr, py = y0 + s0 / 2 + Math.sin(a) * rr;
            if (a === 0) x.moveTo(px, py); else x.lineTo(px, py);
          }
          x.stroke();
        }
      }
      break;
    }
    case 'striated': {
      // the walls of Gärdet's cores where they meet the passages through them: as the wall behind
      // its platforms, panels of brown-grey concrete 1.25 m wide cast with fine diagonal grooves, on a
      // pale plinth 0.3 m high
      x.fillStyle = '#b4b1a9'; x.fillRect(0, Y(0.3), W, 0.3 * PX);
      stripedPanels(x, 0, 0, W, Y(0.3), W / 2, r);
      break;
    }
    case 'triangleTiles': {
      // the end walls of Gärdet's platform halls: white tiles, 15 cm, in grey joints, and low on
      // them a long triangle of small blue tiles rising from the floor to 1.5 m (photographs, 2010)
      x.fillStyle = '#9fa19e'; x.fillRect(0, 0, W, H);
      const t = 0.15 * PX;
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const v = 236 + Math.floor(r() * 10);
        x.fillStyle = `rgb(${v},${v - 2},${v - 8})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
      }
      const m = 0.05 * PX;
      for (let i = 0; i * m < W; i++) for (let j = 0; j * m < 1.5 * PX; j++) {
        if (j * m > (i * m / W) * 1.5 * PX) continue;
        const v = Math.floor(r() * 30) - 15;
        x.fillStyle = `rgb(${28 + v * 0.5},${62 + v},${150 + v})`; x.fillRect(i * m + 0.8, H - (j + 1) * m + 0.8, m - 1.6, m - 1.6);
      }
      break;
    }
    case 'rods': {
      // the ends of Mariatorget's cores, as the walls behind its platforms: Björquist's and
      // Abramson's ceramic rods from 0.25 to 2.5 m over a dark plinth, a white band over them to
      // 2.92 m, and cream render above
      x.fillStyle = '#e3dccb'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#38393a'; x.fillRect(0, Y(0.25), W, 0.25 * PX);
      ceramicRods(x, 0, Y(2.5), W, 2.25 * PX, PX, r);
      x.fillStyle = '#2e3236'; x.fillRect(0, Y(2.92) - 2, W, 0.42 * PX + 4);
      x.fillStyle = '#e8e7e2'; x.fillRect(0, Y(2.92), W, 0.42 * PX);
      break;
    }
    case 'wineTiles':
      // Zinkensdamm's wine-red tiles, where they turn the corners of its core (wineTiles)
      wineTiles(x, 0, 0, W, H, PX, r);
      break;
    case 'narrowTiles':
      // Hornstull's white tiles on end, round its lobbies and up its shafts (whiteBricks)
      whiteBricks(x, 0, 0, W, H, PX, r);
      break;
    case 'kransenTiles':
      // Midsommarkransen's cream tiles on end, in its passages and up its shafts (kransenTiles)
      kransenTiles(x, 0, 0, W, H, PX, r);
      break;
    case 'kransenHall': {
      // the walls of Midsommarkransen's middle hall: its cream tiles on end to 2.5 m over a dark
      // skirting, a band of brown glazed tiles 0.4 m wide to 2.9 m, and white render above
      // (photographs, 2016–2025)
      x.fillStyle = '#ecebe6'; x.fillRect(0, 0, W, H);
      kransenTiles(x, 0, Y(2.5), W, 2.42 * PX, PX, r);
      band(0, 0.08, '#2a2a29');
      band(2.5, 2.9, '#5a3a2b');
      for (let i = 0; i * 0.4 * PX < W; i++) {
        x.fillStyle = 'rgba(30,18,12,0.6)'; x.fillRect(i * 0.4 * PX, Y(2.9), 1.5, 0.4 * PX);
        x.fillStyle = 'rgba(255,235,215,0.18)'; x.fillRect(i * 0.4 * PX + 2, Y(2.9) + 2, 0.4 * PX - 4, 0.05 * PX);
      }
      break;
    }
    case 'ochreClinker':
      // Telefonplan's yellow clinker (Bo Samuelsson's, 1997): glossy mustard tiles, 20 cm, in
      // pale grey joints (photographs, 2016 and 2021)
      ochreClinker(x, 0, W, 0, H, PX, r);
      break;
    case 'morseClinker': {
      // and the wall along the ramp: the yellow clinker, and up it to 2.2 m the station's name in
      // Morse code (the artist's plaque: "Morsesignal i fält av grön klinker"), each dot a column
      // of narrow teal-green tiles a third of a yellow tile wide and each dash three of them, a
      // yellow tile between the signs of a letter and three between letters (as laid on the wall
      // in the photographs; the spacing is read from them, not documented)
      const yellowW = 0.2 * PX, greenW = yellowW / 3, top = Y(2.2);
      const code = ['-', '.', '.-..', '.', '..-.', '---', '-.', '.--.', '.-..', '.-', '-.'];
      let at = 0;
      const yellow = (n: number) => { ochreClinker(x, at, at + n * yellowW, 0, H, PX, r); at += n * yellowW; };
      const green = (n: number) => {
        ochreClinker(x, at, at + n * greenW, 0, top, PX, r);
        for (let k = 0; k < n; k++) for (let yy = H; yy > top; yy -= 0.2 * PX) {
          const v = Math.floor(r() * 12) - 6;
          x.fillStyle = '#9b9c97'; x.fillRect(at + k * greenW, Math.max(top, yy - 0.2 * PX), greenW, Math.min(0.2 * PX, yy - top));
          x.fillStyle = `rgb(${52 + v},${118 + v},${112 + v})`; x.fillRect(at + k * greenW + 1, Math.max(top, yy - 0.2 * PX) + 1, greenW - 2, Math.min(0.2 * PX, yy - top) - 2);
          x.fillStyle = 'rgba(255,255,250,0.22)'; x.fillRect(at + k * greenW + greenW * 0.3, Math.max(top, yy - 0.2 * PX) + 2, greenW * 0.18, Math.min(0.2 * PX, yy - top) - 4);
        }
        at += n * greenW;
      };
      code.forEach((letter, i) => {
        [...letter].forEach((sign, j) => { if (j) yellow(1); green(sign === '.' ? 1 : 3); });
        if (i < code.length - 1) yellow(3);
      });
      // (and on to the repeat, 14.47 m: eight tiles between the end of the name and its start again)
      ochreClinker(x, at, W, 0, H, PX, r);
      break;
    }
    case 'blastedRock': {
      // the walls of a cutting blasted through the rock (Telefonplan's): grey granite in broad flat
      // faces, some lit and some in shadow, rough with smaller chips, the half-pipes of the drill
      // holes running down them, split by dark seams and stained rust brown down from them
      // (photographs, 2005–2016)
      x.fillStyle = '#76726c'; x.fillRect(0, 0, W, H);
      const wrap = (f: () => void, cx: number, cy: number, rr: number) => {
        for (const [ox, oy] of [[0, 0], [W, 0], [-W, 0], [0, H], [0, -H], [W, H], [-W, -H], [W, -H], [-W, H]]) {
          if (cx + ox + rr < 0 || cx + ox - rr > W || cy + oy + rr < 0 || cy + oy - rr > H) continue;
          x.save(); x.translate(ox, oy); f(); x.restore();
        }
      };
      const facets = (count: number, r0: number, r1: number, alpha: number, edge: number) => {
        for (let i = 0; i < count; i++) {
          // a face: an irregular polygon, wider than high, lit from above or in shadow
          const cx = r() * W, cy = r() * H, rr = (r0 + r() * (r1 - r0)) * PX, n = 5 + Math.floor(r() * 3), lit = r();
          const pts: [number, number][] = [];
          for (let k = 0; k < n; k++) { const t = (k / n) * Math.PI * 2 + r() * 0.5; pts.push([cx + Math.cos(t) * rr * (0.7 + r() * 0.4), cy + Math.sin(t) * rr * (0.45 + r() * 0.3)]); }
          const v = lit < 0.3 ? 92 + Math.floor(r() * 16) : lit < 0.75 ? 112 + Math.floor(r() * 16) : 132 + Math.floor(r() * 18);
          wrap(() => {
            x.beginPath(); pts.forEach(([px, py], k) => k ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath();
            x.fillStyle = `rgba(${v + 3},${v},${v - 5},${alpha})`; x.fill();
            x.strokeStyle = `rgba(36,34,31,${edge})`; x.lineWidth = 1.2; x.stroke();
          }, cx, cy, rr * 1.2);
        }
      };
      facets(36, 0.6, 1.5, 0.8, 0.4);
      facets(110, 0.1, 0.35, 0.35, 0.2);
      // the drill holes' half-pipes, upright, about 0.7 m apart, each a dark line and a light one
      for (let i = 0; i < 7; i++) {
        const cx = (i + 0.3 + r() * 0.4) / 7 * W, cy = r() * H, h = (1.2 + r() * 2.2) * PX, lean = (r() - 0.5) * 0.12 * PX;
        wrap(() => {
          for (const [d, c] of [[0, 'rgba(40,38,35,0.55)'], [0.035 * PX, 'rgba(190,186,178,0.35)']] as const) {
            x.strokeStyle = c; x.lineWidth = 0.025 * PX;
            x.beginPath(); x.moveTo(cx + d, cy); x.lineTo(cx + d + lean, cy + h); x.stroke();
          }
        }, cx, cy + h / 2, h);
      }
      // the rust, running down from the seams
      for (let i = 0; i < 26; i++) {
        const cx = r() * W, cy = r() * H, w = (0.08 + r() * 0.3) * PX, h = (0.6 + r() * 1.8) * PX;
        wrap(() => {
          const g = x.createLinearGradient(0, cy, 0, cy + h);
          g.addColorStop(0, 'rgba(146,86,44,0.5)'); g.addColorStop(1, 'rgba(146,86,44,0)');
          x.fillStyle = g; x.fillRect(cx - w / 2, cy, w, h);
        }, cx, cy + h / 2, Math.max(w, h));
      }
      // and the seams
      x.strokeStyle = 'rgba(28,27,25,0.7)';
      for (let i = 0; i < 14; i++) {
        let px = r() * W, py = r() * H;
        const a = (r() < 0.5 ? 1.3 : 0.2) + r() * 0.5, steps = 5 + Math.floor(r() * 6);
        x.lineWidth = 1 + r() * 2;
        x.beginPath(); x.moveTo(px, py);
        for (let k = 0; k < steps; k++) { px += Math.cos(a + (r() - 0.5) * 0.8) * 0.2 * PX; py += Math.sin(a + (r() - 0.5) * 0.8) * 0.2 * PX; x.lineTo(px, py); }
        x.stroke();
      }
      speckle(x, W, H, 16000, 0.14, 81); speckle(x, W, H, 8000, 0.1, 82, true);
      break;
    }
    case 'kioskFront': {
      // Telefonplan's station building to the street north of it, a newsagent's: black-painted
      // panels across the top, and shop windows between yellow posts on a dark plinth, posters
      // behind the glass (photographs, 2019 and 2020; Google's 3D model)
      x.fillStyle = '#18191b'; x.fillRect(0, 0, W, H);
      const bay = 2.4 * PX;
      for (let k = 0; k * bay < W; k++) shopWindow(x, k * bay + 0.1 * PX, (k + 1) * bay - 0.1 * PX, Y(2.95), Y(0.45), PX, r, 'posters');
      x.fillStyle = '#e3bd1f';
      for (let k = 0; k * bay <= W; k++) x.fillRect(k * bay - 0.1 * PX, Y(3.05), 0.2 * PX, 2.7 * PX);
      x.fillRect(0, Y(3.05), W, 0.1 * PX); x.fillRect(0, Y(0.45), W, 0.1 * PX);
      band(0, 0.35, '#2a2b2d');
      x.fillStyle = 'rgba(255,255,255,0.06)';
      for (let k = 0; k * 1.2 * PX < W; k++) x.fillRect(k * 1.2 * PX, Y(4.5), 2, 1.45 * PX);
      break;
    }
    case 'tfpWestFront': {
      // its front to the crossing west of it, from its north end: the newsagent's windows and door
      // between yellow posts, the station's doors (SL's blue sign over them is the block's), the
      // florist's windows under a black sign board, all under black-painted panels; then brick to
      // its south corner (photographs, 2019 and 2020; Google's 3D model)
      const M = (m: number) => m * PX;
      x.fillStyle = '#18191b'; x.fillRect(0, 0, W, H);
      band(0, 0.35, '#2a2b2d');
      for (const [a, b] of [[1.0, 3.2], [3.2, 5.4]]) shopWindow(x, M(a) + 0.1 * PX, M(b) - 0.1 * PX, Y(2.95), Y(0.45), PX, r, 'posters');
      x.fillStyle = '#e3bd1f';
      for (const a of [1.0, 3.2, 5.4, 6.6]) x.fillRect(M(a) - 0.1 * PX, Y(3.05), 0.2 * PX, 3.05 * PX);
      x.fillRect(M(0.9), Y(3.05), M(5.8), 0.1 * PX); x.fillRect(M(0.9), Y(0.45), M(4.6), 0.1 * PX);
      // (the newsagent's door, its yellow board over it)
      const lit = x.createLinearGradient(0, Y(2.3), 0, Y(0));
      lit.addColorStop(0, '#d7d1c2'); lit.addColorStop(1, '#a9a191');
      x.fillStyle = lit; x.fillRect(M(5.5), Y(2.3), M(1.0), 2.3 * PX);
      x.fillStyle = '#e3bd1f'; x.fillRect(M(5.5), Y(2.4), M(1.0), 0.1 * PX); x.fillRect(M(5.98), Y(2.3), 0.04 * PX, 2.3 * PX);
      x.fillRect(M(5.2), Y(3.5), M(1.6), 0.42 * PX);
      x.fillStyle = '#1f3f8a'; x.fillRect(M(5.35), Y(3.33), M(1.3), 0.08 * PX);
      // (the station's doors: two pairs in brushed steel, glass over a transom)
      const st = '#a9aeb1', hall = x.createLinearGradient(0, Y(2.6), 0, Y(0.05));
      hall.addColorStop(0, '#c9c4b6'); hall.addColorStop(0.7, '#a27a64'); hall.addColorStop(1, '#bdb9b0');
      x.fillStyle = hall; x.fillRect(M(7.0), Y(2.6), M(3.0), 2.55 * PX);
      x.fillStyle = st;
      for (const a of [7.0, 7.75, 8.5, 9.25, 10.0]) x.fillRect(M(a) - 0.05 * PX, Y(2.6), 0.1 * PX, 2.6 * PX);
      x.fillRect(M(7.0), Y(2.6), M(3.0), 0.08 * PX); x.fillRect(M(7.0), Y(2.25), M(3.0), 0.08 * PX); x.fillRect(M(7.0), Y(0.1), M(3.0), 0.1 * PX);
      x.fillStyle = 'rgba(255,255,255,0.16)'; x.fillRect(M(7.2), Y(2.2), M(0.4), 2.0 * PX); x.fillRect(M(8.7), Y(2.2), M(0.4), 2.0 * PX);
      // (the florist's windows and board)
      for (const [a, b] of [[10.5, 12.8], [12.9, 15.2], [15.3, 17.5]]) shopWindow(x, M(a), M(b), Y(2.9), Y(0.45), PX, r, 'flowers');
      signBoard(x, M(11.0), M(17.0), Y(3.65), Y(3.15), r);
      brickArea(x, M(17.6), W, 0, H, PX, r);
      x.fillStyle = '#26282a'; x.fillRect(M(17.6), Y(4.5), W - M(17.6), 0.12 * PX);
      break;
    }
    case 'tfpSouthFront': {
      // and its front to the square south of it, brick, from its west end: the florist's board
      // over a poster case; the station's way in, under a fascia (the block's) in the shade, its
      // glass doors in brushed steel and beside them an orange door in the brick; and three
      // windows in dark frames, white curtains behind them (photographs, 2016 and 2019)
      const M = (m: number) => m * PX;
      brickArea(x, 0, W, 0, H, PX, r);
      x.fillStyle = '#26282a'; x.fillRect(0, Y(4.5), W, 0.12 * PX);
      signBoard(x, M(0.4), M(4.6), Y(3.75), Y(3.0), r);
      x.fillStyle = '#1a1b1d'; x.fillRect(M(1.0), Y(2.35), M(1.45), 1.9 * PX);
      x.fillStyle = '#eef0ec'; x.fillRect(M(1.07), Y(2.28), M(1.31), 1.76 * PX);
      x.fillStyle = 'rgba(80,120,90,0.35)'; x.fillRect(M(1.25), Y(1.8), M(0.6), 0.9 * PX);
      // (the way in: the shade of the soffit over it, the doors, and the orange door)
      const st = '#a9aeb1', hall = x.createLinearGradient(0, Y(2.95), 0, Y(0.05));
      hall.addColorStop(0, '#bcb6a8'); hall.addColorStop(0.6, '#8f6f5d'); hall.addColorStop(1, '#a9a59c');
      x.fillStyle = hall; x.fillRect(M(5.4), Y(2.95), M(4.0), 2.9 * PX);
      x.fillStyle = st;
      for (const a of [5.4, 6.4, 7.4, 8.4, 9.4]) x.fillRect(M(a) - 0.05 * PX, Y(2.95), 0.1 * PX, 2.95 * PX);
      x.fillRect(M(5.4), Y(2.95), M(4.0), 0.08 * PX); x.fillRect(M(5.4), Y(2.4), M(4.0), 0.1 * PX); x.fillRect(M(5.4), Y(0.1), M(4.0), 0.1 * PX);
      x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(M(5.6), Y(2.3), M(0.35), 2.1 * PX); x.fillRect(M(7.6), Y(2.3), M(0.35), 2.1 * PX);
      x.fillStyle = '#c8532c'; x.fillRect(M(10.0), Y(2.15), M(0.95), 2.15 * PX);
      x.fillStyle = '#3a3c3e'; x.fillRect(M(9.97), Y(2.18), M(1.01), 0.04 * PX); x.fillRect(M(10.82), Y(1.1), M(0.06), 0.03 * PX);
      x.fillStyle = 'rgba(20,18,16,0.3)'; x.fillRect(M(5.2), Y(3.0), M(6.2), 3.0 * PX);
      x.fillStyle = 'rgba(20,18,16,0.25)'; x.fillRect(M(5.2), Y(3.0), M(6.2), 0.25 * PX);
      // (the windows)
      for (const a of [12.8, 15.9, 19.0]) {
        const g = x.createLinearGradient(0, Y(2.35), 0, Y(1.15));
        g.addColorStop(0, '#e9e6de'); g.addColorStop(1, '#cfcac0');
        x.fillStyle = '#2a2c2e'; x.fillRect(M(a), Y(2.35), M(2.0), 1.2 * PX);
        x.fillStyle = g; x.fillRect(M(a + 0.07), Y(2.28), M(0.88), 1.06 * PX); x.fillRect(M(a + 1.05), Y(2.28), M(0.88), 1.06 * PX);
        x.fillStyle = 'rgba(120,112,100,0.25)';
        for (let k = 0; k < 8; k++) x.fillRect(M(a + 0.1 + k * 0.23), Y(2.28), 2, 1.06 * PX);
        x.fillStyle = '#8f8c86'; x.fillRect(M(a - 0.05), Y(1.15), M(2.1), 0.05 * PX);
      }
      break;
    }
    case 'tricolourWindows':
    case 'tricolourTiles': {
      // Hägerstensåsen's waiting rooms at the platform's ends and the walls of the stairs up from
      // its east end: glazed tiles, 15 cm, oxblood, white and grey in diagonal rows, in pale joints;
      // in the rooms (`tricolourWindows`) only to a grey concrete sill 1.05 m up, then clear glass in
      // steel frames painted oxblood, 1.35 m apart, to 2.95 m (photographs, 2016)
      const t = 0.15 * PX, cols = ['#8a3a30', '#e8e6e0', '#9a9fa3'], top = name === 'tricolourTiles' ? H : 1.05 * PX;
      x.fillStyle = '#c9c8c3'; x.fillRect(0, H - top, W, top);
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < top - 1; j++) {
        const v = Math.floor(r() * 10) - 5, c = cols[(i + j) % 3];
        x.fillStyle = c; x.fillRect(i * t + 1.5, H - (j + 1) * t + 1.5, t - 3, t - 3);
        x.fillStyle = `rgba(${v > 0 ? '255,255,255' : '0,0,0'},${Math.abs(v) * 0.012})`; x.fillRect(i * t + 1.5, H - (j + 1) * t + 1.5, t - 3, t - 3);
        x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(i * t + 3, H - (j + 1) * t + 3, t * 0.3, 2);
      }
      if (name === 'tricolourTiles') break;
      const ox = '#5c2b25';
      band(1.05, 1.15, '#a9a7a2'); x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(0, Y(1.15), W, 1.5);
      pane(1.15, 2.95, ox, 0.1);
      x.fillStyle = ox; x.fillRect(0, Y(1.21), W, 0.06 * PX);
      band(2.95, 3.05, ox); band(3.05, h, '#dcdad4');
      break;
    }
    case 'quarryTiles': {
      // unglazed floor tiles, 20 cm square, red-brown and dark grey at random, in dark joints
      // (Hägerstensåsen's waiting rooms and ticket halls; photographs, 2016)
      x.fillStyle = '#3c3733'; x.fillRect(0, 0, W, H);
      const t = 0.2 * PX, reds = [[140, 88, 66], [150, 96, 72], [126, 78, 60], [160, 104, 80]], greys = [[92, 88, 84], [80, 77, 74], [102, 98, 93]];
      for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
        const set = r() < 0.55 ? reds : greys, [cr, cg, cb] = set[Math.floor(r() * set.length)], v = Math.floor(r() * 10) - 5;
        x.fillStyle = `rgb(${cr + v},${cg + v},${cb + v})`; x.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
      }
      break;
    }
    case 'darkBoards':
      // narrow boards of dark-stained timber, 10 cm wide, each a little different, with dark joints
      // and streaks of grain along them (the ceilings of Hägerstensåsen's hall under the bridge)
      x.fillStyle = '#21160e'; x.fillRect(0, 0, W, H);
      for (let j = 0; j * 0.1 * PX < H; j++) {
        const v = Math.floor(r() * 18);
        x.fillStyle = `rgb(${78 + v},${52 + v * 0.7},${34 + v * 0.5})`; x.fillRect(0, j * 0.1 * PX + 1, W, 0.1 * PX - 2);
        for (let k = 0; k < 10; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '40,26,16' : '120,86,58'},0.3)`; x.fillRect(r() * W, j * 0.1 * PX + 2 + r() * (0.1 * PX - 5), 20 + r() * 80, 1); }
      }
      break;
    case 'hgaFront': {
      // Hägerstensåsen's pavilion to Sedelvägen, from its south end: dark brown ribbed sheet to the
      // doors; the doors, glass in brushed steel frames, a dark panel over them (SL's blue band
      // with the name, the block's, hangs on it); then red-brown brick, the newsagent's window in it
      // and its red board and grey one over that; and over all of it a row of clerestory windows in
      // teak-brown frames (photographs, 2016; Google's 3D model)
      const M = (m: number) => m * PX;
      x.fillStyle = '#4a3226'; x.fillRect(0, Y(2.6), M(7.4), 2.6 * PX);
      for (let k = 0; k * 0.1 < 7.4; k++) {
        x.fillStyle = k % 2 ? 'rgba(255,230,210,0.1)' : 'rgba(0,0,0,0.22)'; x.fillRect(M(k * 0.1), Y(2.6), M(0.05), 2.6 * PX);
      }
      // (the doors, the lit hall behind them)
      const st = '#a9aeb1', hall = x.createLinearGradient(0, Y(2.15), 0, Y(0.05));
      hall.addColorStop(0, '#d6d3ca'); hall.addColorStop(0.65, '#bdb6a8'); hall.addColorStop(1, '#8f5f48');
      x.fillStyle = hall; x.fillRect(M(7.4), Y(2.15), M(2.8), 2.1 * PX);
      x.fillStyle = st;
      for (const a of [7.45, 8.15, 8.8, 9.45, 10.15]) x.fillRect(M(a) - 0.05 * PX, Y(2.15), 0.1 * PX, 2.15 * PX);
      x.fillRect(M(7.4), Y(2.15), M(2.8), 0.08 * PX); x.fillRect(M(7.4), Y(1.05), M(2.8), 0.05 * PX); x.fillRect(M(7.4), Y(0.35), M(2.8), 0.35 * PX);
      x.fillStyle = 'rgba(255,255,255,0.16)'; x.fillRect(M(7.6), Y(2.0), M(0.3), 1.6 * PX); x.fillRect(M(9.0), Y(2.0), M(0.3), 1.6 * PX);
      x.fillStyle = '#2a2c30'; x.fillRect(M(7.3), Y(2.6), M(3.0), 0.45 * PX);
      // (the brick, the newsagent's window and its boards)
      brickArea(x, M(10.3), W, Y(2.6), H, PX, r);
      x.fillStyle = '#5c4a3e'; x.fillRect(M(10.55), Y(1.75), M(2.4), 1.35 * PX);
      shopWindow(x, M(10.6), M(12.9), Y(1.7), Y(0.45), PX, r, 'posters');
      x.fillStyle = '#5c4a3e'; x.fillRect(M(13.6), Y(2.0), M(2.0), 1.6 * PX);
      x.fillStyle = '#c9c5bb'; x.fillRect(M(13.65), Y(1.95), M(1.9), 1.5 * PX);
      x.fillStyle = 'rgba(80,72,64,0.35)'; x.fillRect(M(14.55), Y(1.95), 3, 1.5 * PX); x.fillRect(M(13.65), Y(1.2), M(1.9), 3);
      x.fillStyle = '#7d7f80'; x.fillRect(M(10.9), Y(2.2), M(2.4), 0.42 * PX);
      x.fillStyle = '#c8202a'; x.fillRect(M(10.9), Y(2.6), M(2.4), 0.4 * PX);
      for (const [y0, y1, col] of [[2.5, 2.3, '#f1d230'], [2.12, 1.9, '#f4f4f0']] as const) {
        x.fillStyle = col;
        for (let at = 11.1; at < 13.0;) { const lw = 0.08 + r() * 0.06; x.fillRect(M(at), Y(y0), M(lw), (y0 - y1) * PX); at += lw + (r() < 0.15 ? 0.12 : 0.03); }
      }
      // (the clerestory: glass catching the sky, teak frames 1.63 m apart)
      const sky = x.createLinearGradient(0, Y(3.0), 0, Y(2.6));
      sky.addColorStop(0, '#9aa3a6'); sky.addColorStop(1, '#5d6466');
      x.fillStyle = sky; x.fillRect(0, Y(3.0), W, 0.4 * PX);
      x.fillStyle = '#6e4428';
      x.fillRect(0, Y(2.66), W, 0.06 * PX); x.fillRect(0, Y(3.0), W, 0.05 * PX);
      for (let k = 0; k * 1.63 <= 16.3 + 0.01; k++) x.fillRect(M(k * 1.63) - 0.04 * PX, Y(3.0), 0.08 * PX, 0.4 * PX);
      break;
    }
    case 'creamRender':
      // smooth render, a pale warm cream, here and there a little darker (Västertorp's ramp, the
      // ground of Fogelquist's sgraffito; photograph, 2016)
      x.fillStyle = '#e2dcc3'; x.fillRect(0, 0, W, H);
      for (let k = 0; k < 14; k++) {
        const cx = r() * W, cy = r() * H, rr = (0.3 + r() * 0.5) * PX;
        // (wrapped round the repeat's edges)
        for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
          const g = x.createRadialGradient(cx + dx, cy + dy, 0, cx + dx, cy + dy, rr);
          g.addColorStop(0, 'rgba(150,140,110,0.08)'); g.addColorStop(1, 'rgba(150,140,110,0)');
          x.fillStyle = g; x.fillRect(0, 0, W, H);
        }
      }
      speckle(x, W, H, 9000, 0.1, 78); speckle(x, W, H, 6000, 0.12, 79, true);
      break;
    case 'slateFlags': {
      // flags of dark grey-green slate, irregular four-sided stones about half a metre across, in
      // pale grey joints (Västertorp's ticket hall; photograph, 2016): a jittered grid, the same at
      // every repeat's edge
      x.fillStyle = '#8c8e89'; x.fillRect(0, 0, W, H);
      const n = 5, cell = W / n, jit: [number, number][][] = [];
      for (let i = 0; i < n; i++) { jit.push([]); for (let j = 0; j < n; j++) jit[i].push([(r() - 0.5) * cell * 0.5, (r() - 0.5) * cell * 0.5]); }
      const at = (i: number, j: number): [number, number] => { const [dx, dy] = jit[((i % n) + n) % n][((j % n) + n) % n]; return [i * cell + dx, j * cell + dy]; };
      const greys = [[78, 86, 80], [90, 96, 90], [70, 77, 73], [98, 106, 98], [84, 88, 86]];
      for (let i = -1; i <= n; i++) for (let j = -1; j <= n; j++) {
        const [cr, cg, cb] = greys[Math.floor(r() * greys.length)], v = Math.floor(r() * 10) - 5;
        x.fillStyle = `rgb(${cr + v},${cg + v},${cb + v})`;
        const q = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
        const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4;
        x.beginPath();
        q.forEach(([px, py], k) => { const sx = cx + (px - cx) * 0.95, sy = cy + (py - cy) * 0.95; if (k) x.lineTo(sx, sy); else x.moveTo(sx, sy); });
        x.closePath(); x.fill();
        // (the cleft face's sheen and streaks)
        x.fillStyle = 'rgba(200,210,200,0.06)'; x.fill();
        for (let k = 0; k < 6; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '40,46,42' : '130,138,128'},0.25)`; x.fillRect(cx + (r() - 0.5) * cell * 0.6, cy + (r() - 0.5) * cell * 0.6, 10 + r() * 30, 1.5); }
      }
      break;
    }
    case 'gingham':
    case 'orangeGingham': {
      // Fredrik Landergren's walls at Fruängen (2005): square tiles in a gingham check, rows and
      // columns of a mid tone crossing in a dark one over white. Outside, along the bus terminal,
      // 20 cm, a greyish mauve and a mauve-brown; inside, over the stairs, 10 cm, two oranges
      // (photographs, 2010 and 2016)
      const outside = name === 'gingham', t = (outside ? 0.2 : 0.1) * PX;
      const cols = outside ? [[230, 228, 223], [170, 160, 156], [122, 108, 104]] : [[236, 231, 220], [236, 170, 120], [210, 108, 54]];
      x.fillStyle = outside ? '#9c9893' : '#b3a99c'; x.fillRect(0, 0, W, H);
      for (let i = 0; i * t < W - 1; i++) for (let j = 0; j * t < H - 1; j++) {
        const [cr, cg, cb] = cols[(i % 2) + (j % 2)], v = Math.floor(r() * 8) - 4;
        x.fillStyle = `rgb(${cr + v},${cg + v},${cb + v})`; x.fillRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
        x.fillStyle = 'rgba(255,255,255,0.16)'; x.fillRect(i * t + 3, j * t + 3, t * 0.4, 2);
      }
      break;
    }
    case 'aspuddenStrips':
      // the walls round Aspudden's middle hall, as behind its platforms (aspuddenStrips)
      aspuddenStrips(x, 0, 0, W, H, PX, r);
      band(0, 0.1, '#2a2a29');
      break;
    case 'amberTiles':
      // the walls round Aspudden's escalators (amberTiles)
      amberTiles(x, 0, 0, W, H, PX, r);
      break;
    case 'aspuddenHall':
      // the walls of Aspudden's ticket hall (aspuddenHallTiles)
      aspuddenHallTiles(x, 0, 0, W, H, PX, r);
      break;
    case 'aspuddenPavilion': {
      // the walls of Aspudden's pavilion on Schlytersvägen: a steel kick strip, glass in brushed
      // steel frames 1.15 m apart with a rail across at 1 m, SL's dark blue band over a yellow
      // line from 2.4 m, then glass again in a steel frame to the fascia (photographs, 2011–2019)
      const st = '#a7acaf';
      band(0, 0.15, st); pane(0.15, 2.4, st, 0.1); band(1.0, 1.05, st);
      band(2.4, 2.45, yellow); band(2.45, 2.9, '#1d2f78'); band(2.9, 3.0, st);
      pane(3.0, 3.75, st, 0.1); band(3.75, 4.0, '#b9bdbf');
      break;
    }
    case 'ornsbergTimber':
    case 'ornsbergWindows':
    case 'ornsbergFront': {
      // Örnsberg's station building on the square east of Örnsbergsvägen, from the street up: a
      // plinth of red-brown brick to 0.7 m; dark brown board and batten, or shop windows in dark
      // brown frames with a band of boards and a row of low windows over them; a fascia of boards
      // along the top under a dark flashing. `ornsbergFront`, its front onto the square from its
      // north corner: the restaurant's windows, the doors in a recess between brick piers under a
      // strip of copper (the black band with the name over them is the block's), and the kiosk's
      // boarded corner with a poster in its window (photographs, Wikimedia Commons)
      const M = (m: number) => m * PX, frame = '#3b261b';
      const plinth = (a: number, b: number) => {
        brickArea(x, M(a), M(b), Y(0.7), Y(0), PX, r);
        x.fillStyle = '#33241c'; x.fillRect(M(a), Y(0.74), M(b - a), 0.04 * PX);
      };
      // (boards 10 cm wide, a batten over every third joint, its shadow beside it)
      const battens = (a: number, b: number, h0: number, h1: number) => {
        for (let k = 0; a + k * 0.1 < b; k++) {
          const v = Math.floor(r() * 14) - 7;
          x.fillStyle = `rgb(${84 + v},${54 + v * 0.7},${38 + v * 0.5})`; x.fillRect(M(a + k * 0.1), Y(h1), M(0.1), (h1 - h0) * PX);
          x.fillStyle = 'rgba(30,18,12,0.5)'; x.fillRect(M(a + k * 0.1), Y(h1), 1, (h1 - h0) * PX);
        }
        for (let at = a + 0.15; at < b - 0.05; at += 0.3) {
          x.fillStyle = '#6b4733'; x.fillRect(M(at), Y(h1), M(0.045), (h1 - h0) * PX);
          x.fillStyle = 'rgba(20,12,8,0.55)'; x.fillRect(M(at + 0.045), Y(h1), 3, (h1 - h0) * PX);
        }
      };
      // (boards laid along, each lapping the one under it)
      const boards = (a: number, b: number, h0: number, h1: number) => {
        for (let y0 = h0; y0 < h1 - 0.01; y0 += 0.13) {
          const v = Math.floor(r() * 12) - 6, y1 = Math.min(h1, y0 + 0.13);
          x.fillStyle = `rgb(${88 + v},${57 + v * 0.7},${40 + v * 0.5})`; x.fillRect(M(a), Y(y1), M(b - a), (y1 - y0) * PX);
          x.fillStyle = 'rgba(22,14,10,0.6)'; x.fillRect(M(a), Y(y0) - 3, M(b - a), 3);
        }
      };
      // (glass in dark frames `every` m apart: the shop lit within, or the sky in low windows)
      const windows = (a: number, b: number, h0: number, h1: number, every: number, lit: boolean) => {
        x.fillStyle = frame; x.fillRect(M(a), Y(h1), M(b - a), (h1 - h0) * PX);
        const n = Math.max(1, Math.round((b - a) / every)), w = (b - a) / n;
        for (let k = 0; k < n; k++) {
          const g0 = a + k * w + 0.06, g1 = a + (k + 1) * w - 0.06, t = h1 - 0.07, f = h0 + 0.07;
          const g = x.createLinearGradient(0, Y(t), 0, Y(f));
          if (lit) { g.addColorStop(0, '#cfc3ab'); g.addColorStop(0.5, '#a08e74'); g.addColorStop(1, '#6e6152'); }
          else { g.addColorStop(0, '#b4bec4'); g.addColorStop(1, '#7c878d'); }
          x.fillStyle = g; x.fillRect(M(g0), Y(t), M(g1 - g0), (t - f) * PX);
          if (lit) {
            // (tables and chairs, shelves, people, dim behind the glass)
            for (let q = 0; q < 3; q++) {
              x.fillStyle = `rgba(${r() < 0.5 ? '70,52,40' : '150,120,90'},0.45)`;
              const qw = 0.2 + r() * 0.5, qh = 0.3 + r() * 0.6, qa = g0 + r() * Math.max(0.01, g1 - g0 - qw);
              x.fillRect(M(qa), Y(f + qh), M(qw), qh * PX);
            }
          }
          x.fillStyle = 'rgba(255,255,255,0.13)';
          x.beginPath(); x.moveTo(M(g0 + (g1 - g0) * 0.1), Y(f)); x.lineTo(M(g0 + (g1 - g0) * 0.45), Y(t)); x.lineTo(M(g0 + (g1 - g0) * 0.6), Y(t)); x.lineTo(M(g0 + (g1 - g0) * 0.25), Y(f)); x.fill();
        }
      };
      const top = () => { boards(0, w, 3.3, 3.7); band(3.7, 3.75, '#2a2826'); };
      if (name === 'ornsbergTimber') {
        plinth(0, w); battens(0, w, 0.74, 3.3); top();
      } else if (name === 'ornsbergWindows') {
        plinth(0, w); windows(0, w, 0.74, 2.55, 1.5, true); boards(0, w, 2.55, 2.95); windows(0, w, 2.95, 3.3, 1.5, false); top();
      } else {
        // the restaurant's windows from the north corner
        plinth(0, 7.6); windows(0, 7.6, 0.74, 2.55, 1.25, true); boards(0, 7.6, 2.55, 2.95); windows(0, 7.6, 2.95, 3.3, 1.9, false);
        // the recess with the doors: brick piers, steel doors (cut through by the way in), the
        // band with the name (the block's), a strip of copper over it, boards, and two windows
        brickArea(x, M(7.6), M(8.1), Y(2.95), Y(0), PX, r); brickArea(x, M(11.1), M(11.6), Y(2.95), Y(0), PX, r);
        x.fillStyle = '#9fa4a7'; x.fillRect(M(8.1), Y(2.45), M(3.0), 2.45 * PX);
        windows(8.15, 11.05, 0.05, 2.4, 0.75, true);
        x.fillStyle = '#9fa4a7'; for (let a = 8.1; a <= 11.15; a += 0.75) x.fillRect(M(a) - 0.04 * PX, Y(2.4), 0.08 * PX, 2.35 * PX);
        x.fillStyle = '#161617'; x.fillRect(M(8.1), Y(2.85), M(3.0), 0.4 * PX);
        x.fillStyle = '#6e9883'; x.fillRect(M(7.9), Y(2.95), M(3.4), 0.1 * PX);
        windows(8.1, 11.1, 2.95, 3.3, 1.5, false);
        // the kiosk's boarded corner, a poster in its window
        plinth(11.6, w); battens(11.6, w, 0.74, 3.3);
        x.fillStyle = frame; x.fillRect(M(13.05), Y(2.4), M(1.9), 1.6 * PX);
        shopWindow(x, M(13.15), M(14.85), Y(2.3), Y(0.9), PX, r, 'posters');
        top();
      }
      break;
    }
    case 'greyBooth': {
      // the booth on Fruängen's platform under the roof's end: dark grey panels to 1.05 m, a white
      // rail, glass in white frames to 2.15 m, a white band and a dark grey one over it
      // (photographs, 2016 and 2024)
      const white = '#e4e5e1', dark = '#3c3f42';
      band(0, 1.05, dark); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(W / 2 - 1, Y(1.05), 2, 1.05 * PX);
      band(1.05, 1.15, white); pane(1.15, 2.15, white, 0.12); band(2.15, 2.27, white); band(2.27, 2.6, dark);
      break;
    }
    case 'blueBooth': {
      // the ticket booth in Fruängen's hall: SL's blue in panels to 1.15 m in brushed steel frames,
      // glass in steel frames to 2.45 m, and white panels up to the ceiling (photograph, 2026)
      const st = '#a6abae';
      band(0, 0.08, '#55585a'); band(0.08, 1.15, '#1f3f99');
      x.fillStyle = st; x.fillRect(0, Y(1.15), 0.05 * PX, 1.07 * PX); x.fillRect(W - 0.05 * PX, Y(1.15), 0.05 * PX, 1.07 * PX);
      band(1.15, 1.25, st); pane(1.25, 2.45, st, 0.1); band(2.45, 2.55, st); band(2.55, 3.6, '#e9eae6');
      x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(0, Y(3.6), 2, 1.05 * PX);
      break;
    }
    case 'fraBuilding':
    case 'fraEntrance': {
      // the building of Fruängens centrum round the station's lower hall (1960s), from the street
      // on Fruängsplan up: the ground floor set back under the upper storey, its dark granite piers,
      // shop windows between them, the shade of the soffit over them; the slab's concrete edge;
      // white-painted brick, a band of windows in dark brown frames, a little more brick and white
      // boarding at the top (photographs, 1964, 2016 and 2026). `fraEntrance`, the station's bay:
      // glass doors in brushed steel frames between granite piers at its ends (SL's band over them
      // is the block's)
      const M = (m: number) => m * PX, granite = (a: number, b: number) => {
        x.fillStyle = '#3d3f41'; x.fillRect(M(a), Y(3.65), M(b - a), 3.65 * PX);
        for (let k = 0; k < (b - a) * 900; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '150,152,150' : '20,20,22'},0.35)`; x.fillRect(M(a) + r() * M(b - a), Y(3.65) + r() * 3.65 * PX, 2, 2); }
      };
      // (the recess in the shade)
      x.fillStyle = '#56575a'; x.fillRect(0, Y(3.65), W, 3.65 * PX);
      if (name === 'fraBuilding') {
        shopWindow(x, M(0.75), M(5.75), Y(2.55), Y(0.45), PX, r, 'posters');
        x.fillStyle = '#9da2a5'; x.fillRect(M(0.7), Y(2.6), M(5.1), 0.05 * PX); x.fillRect(M(0.7), Y(0.45), M(5.1), 0.4 * PX);
        x.fillStyle = '#2d2f31'; x.fillRect(M(3.2), Y(2.55), 0.05 * PX, 2.1 * PX);
        signBoard(x, M(1.2), M(5.3), Y(3.15), Y(2.75), r);
        granite(0, 0.6);
      } else {
        const st = '#a9aeb1', hall = x.createLinearGradient(0, Y(3.2), 0, Y(0));
        hall.addColorStop(0, '#d8d4c6'); hall.addColorStop(0.5, '#a39c8a'); hall.addColorStop(1, '#7e7b74');
        x.fillStyle = hall; x.fillRect(M(0.5), Y(3.2), M(9.12), 3.2 * PX);
        x.fillStyle = st;
        for (let a = 0.5; a <= 9.63; a += 1.14) x.fillRect(M(a) - 0.04 * PX, Y(3.2), 0.08 * PX, 3.2 * PX);
        x.fillRect(M(0.5), Y(2.45), M(9.12), 0.08 * PX); x.fillRect(M(0.5), Y(0.2), M(9.12), 0.2 * PX);
        // (the doors' blue stripes and their white discs, and the glass's sheen)
        x.fillStyle = '#25408f'; x.fillRect(M(0.5), Y(1.3), M(9.12), 0.16 * PX);
        x.fillStyle = '#e9c43a'; x.fillRect(M(0.5), Y(1.14), M(9.12), 0.03 * PX);
        x.fillStyle = '#eef0f2';
        for (let a = 0.5 + 0.57; a < 9.62; a += 1.14) { x.beginPath(); x.arc(M(a), Y(1.22), 0.07 * PX, 0, Math.PI * 2); x.fill(); }
        x.fillStyle = 'rgba(255,255,255,0.12)';
        for (let a = 0.6; a < 9.6; a += 1.14) x.fillRect(M(a), Y(2.35), M(0.25), 2.0 * PX);
        granite(0, 0.5); granite(9.62, 10.12);
      }
      // (the soffit's shade, darkest at the back)
      const shade = x.createLinearGradient(0, Y(3.65), 0, Y(2.6));
      shade.addColorStop(0, 'rgba(10,10,12,0.55)'); shade.addColorStop(1, 'rgba(10,10,12,0)');
      x.fillStyle = shade; x.fillRect(0, Y(3.65), W, 1.05 * PX);
      // the slab's edge, board-marked
      x.fillStyle = '#b9b6ae'; x.fillRect(0, Y(3.95), W, 0.3 * PX);
      for (let k = 1; k < 4; k++) { x.fillStyle = 'rgba(80,78,72,0.25)'; x.fillRect(0, Y(3.65 + k * 0.075), W, 1.5); }
      // white-painted brick, about 25 by 7.5 cm, in a running bond
      const bl = 0.25 * PX, bh = 0.075 * PX;
      x.fillStyle = '#c8c4b8'; x.fillRect(0, Y(6.75), W, 2.8 * PX);
      for (let j = 0; Y(3.95) - (j + 1) * bh > Y(6.75) - 0.5; j++) for (let i = -1; i * bl < W; i++) {
        const v = Math.floor(r() * 10) - 5;
        x.fillStyle = `rgb(${232 + v},${228 + v},${216 + v})`; x.fillRect(i * bl + (j % 2) * bl / 2 + 1, Y(3.95) - (j + 1) * bh + 1, bl - 2, bh - 1.6);
      }
      // the band of windows, their frames dark brown, a mullion every 1.5 m
      const frame = '#3b2a22';
      x.fillStyle = frame; x.fillRect(0, Y(6.5), W, 1.45 * PX);
      for (let a = 0; a < W / PX - 0.1; a += 1.5) {
        const g = x.createLinearGradient(0, Y(6.4), 0, Y(5.15));
        g.addColorStop(0, '#9aa4aa'); g.addColorStop(0.6, '#5f686d'); g.addColorStop(1, '#4a4f52');
        x.fillStyle = g; x.fillRect(M(a + 0.09), Y(6.4), M(1.32), 1.25 * PX);
        // (blinds or posters behind some of them)
        if (r() < 0.35) { x.fillStyle = r() < 0.5 ? 'rgba(236,232,222,0.75)' : 'rgba(230,150,90,0.6)'; x.fillRect(M(a + 0.15), Y(6.3), M(1.2), (0.3 + r() * 0.7) * PX); }
      }
      x.fillStyle = '#9b9890'; x.fillRect(0, Y(5.08), W, 0.05 * PX);
      // white boarding at the top, under a dark edge
      x.fillStyle = '#e4e1d6'; x.fillRect(0, Y(7.1), W, 0.35 * PX);
      for (let k = 1; k < 4; k++) { x.fillStyle = 'rgba(90,88,80,0.35)'; x.fillRect(0, Y(6.75 + k * 0.09), W, 1.5); }
      x.fillStyle = '#3a3b3c'; x.fillRect(0, Y(7.15), W, 0.05 * PX);
      break;
    }
    case 'brassTerrazzo': {
      // Liljeholmen's halls: green terrazzo, speckled pale and dark, and thin lines of brass across
      // it at two slants and along it, crossing in long triangles (each wrapping round the repeat)
      x.fillStyle = '#86a28a'; x.fillRect(0, 0, W, H);
      speckle(x, W, H, 70000, 0.3, 78); speckle(x, W, H, 30000, 0.25, 79, true);
      x.strokeStyle = '#b8964a'; x.lineWidth = 0.012 * PX;
      const line = (x0: number, y0: number, x1: number, y1: number) => {
        for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
          x.beginPath(); x.moveTo(x0 * PX + dx, y0 * PX + dy); x.lineTo(x1 * PX + dx, y1 * PX + dy); x.stroke();
        }
      };
      line(0.6, 0, 4.2, 9.6); line(4.2, 0, 0.6, 9.6); line(0.6, 0, 0.6, 9.6); line(2.4, 0, 4.8, 4.8); line(0, 4.8, 2.4, 9.6);
      break;
    }
    case 'uprightTiles':
      uprightTiles(x, 0, 0, W, H, PX, r);
      break;
    case 'bandGlazed': {
      // the screens between Zinkensdamm's platforms and the foot of its escalators: clear glass in
      // brushed steel frames 1.3 m apart, a steel kick panel to 0.35 m, a transom 1.93 m up
      // carrying SL's dark blue band over a yellow line, glass above it to a steel rail at 3.05 m
      // (photographs, 2005)
      const st = '#9ca1a5';
      pane(0, h, st, 0.1);
      band(0, 0.35, st); band(1.93, 2.1, st); band(1.97, 2.06, '#1f3b8a'); band(1.95, 1.97, yellow); band(3.05, h, st);
      x.fillStyle = 'rgba(255,255,255,0.35)';
      for (const y of [0.35, 2.1, 3.05]) x.fillRect(0, Y(y), W, 1.5);
      break;
    }
    case 'shards': {
      // John Stenborg's walls of Zinkensdamm's entrance pavilion: grey concrete, and set in it
      // shards of colour, each a skewed four-sided plate a third to two thirds of a metre across,
      // tilted every way: dark and pale greys, white, sky blue and a deeper blue, beige and a
      // brick red (photographs, 2011)
      x.fillStyle = '#8f8e8a'; x.fillRect(0, 0, W, H);
      const cols = ['#4a4e52', '#4a4e52', '#6f7276', '#5a5e62', '#d8d8d2', '#e4e3de', '#8fb4d0', '#9cc0da', '#4f84b8', '#c9a882', '#d2b494', '#8e4a36', '#a8aaac'];
      const count = Math.round((w * h) / 0.28);
      for (let k = 0; k < count; k++) {
        const cx = r() * W, cy = r() * H, a = r() * Math.PI, hw = (0.1 + r() * 0.16) * PX, hh = (0.16 + r() * 0.2) * PX;
        const k1 = 0.6 + r() * 0.5, k2 = 0.6 + r() * 0.5, col = cols[Math.floor(r() * cols.length)];
        const q = [[-hw, -hh], [hw * k1, -hh], [hw, hh * k2], [-hw * k2, hh]].map(([px, py]) => [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)]);
        for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
          x.beginPath();
          q.forEach(([px, py], i) => (i ? x.lineTo(cx + dx + px, cy + dy + py) : x.moveTo(cx + dx + px, cy + dy + py)));
          x.closePath();
          x.fillStyle = col; x.fill();
          x.strokeStyle = 'rgba(40,40,40,0.25)'; x.lineWidth = 1.5; x.stroke();
        }
      }
      break;
    }
    case 'redClinker': {
      // clinker, 25 by 12.5 cm, in a running bond, in shades of red-brown, rust, a dark
      // brown-grey and grey (Gärdet's platforms and passages)
      x.fillStyle = '#4a3a32'; x.fillRect(0, 0, W, H);
      const bl = 0.25 * PX, bw = 0.125 * PX, cols = [[126, 82, 66], [160, 106, 78], [104, 80, 70], [140, 92, 70], [118, 70, 56], [112, 106, 100], [96, 92, 88]];
      for (let i = 0; i * bw < W; i++) for (let j = -1; j * bl < H; j++) {
        const [cr, cg, cb] = cols[Math.floor(r() * cols.length)], v = Math.floor(r() * 12) - 6;
        x.fillStyle = `rgb(${cr + v},${cg + v},${cb + v})`;
        x.fillRect(i * bw + 1, j * bl + (i % 2) * bl / 2 + 1, bw - 2, bl - 2);
      }
      break;
    }
    case 'slats':
      x.fillStyle = '#5d5f60'; x.fillRect(0, 0, W, H);
      for (let i = 0; i * 0.1 * PX < W; i++) {
        x.fillStyle = `rgb(${236 + Math.floor(r() * 8)},${236 + Math.floor(r() * 8)},${232 + Math.floor(r() * 8)})`;
        x.fillRect(i * 0.1 * PX + 1.5, 0, 0.1 * PX - 3, H);
      }
      break;
  }
  if (!['triangles', 'glazed', 'darkGlazed', 'clerestory', 'windows', 'highWindows', 'greenWindows', 'checkWindows', 'tiledWindows', 'shopWindows', 'storeys', 'liftWindows', 'redWindows', 'perforated', 'whitePerforated', 'hallTiles', 'glassFront', 'tealWindows', 'greenGlazed', 'greenFront', 'greenDoors', 'creamClerestory', 'silverPerforated', 'libraryFront', 'libraryBack', 'libraryEntrance', 'glassBlocks', 'blueMosaic', 'warmMosaic', 'brownWindows', 'steelGlazed', 'birchX', 'tealTiles', 'darkWindows', 'blackFront', 'splitBlocks', 'cladClerestory', 'frostedPanels', 'redBand', 'redFront', 'gridPanels', 'navyTiles', 'pineBoards', 'redTiles', 'bronzeGlass', 'bronzeGlazed', 'pixelTiles', 'clinkerWindows', 'greyClerestory', 'portalTiles', 'liftPanes', 'roxnerTiles', 'roxnerClerestory', 'greyGlazed', 'sageRender', 'bottleTiles', 'purpleTiles', 'rivetedSteel', 'glossTiles', 'stripeTiles', 'twoGreens', 'scrollPanels', 'opPanels', 'circleFront', 'stripPanels', 'maroonGlazed', 'slateGlazed', 'goranssonTiles', 'greenBooth', 'checkTiles', 'mosaicPosters', 'vallingbyCentrum', 'wiredGlazed', 'dripTiles', 'ochreDoor', 'greenEnamel', 'tornellEnamel', 'brownTiles', 'partosTiles', 'cafeWall', 'iridescentTiles', 'striated', 'triangleTiles', 'rods', 'wineTiles', 'uprightTiles', 'bandGlazed', 'narrowTiles', 'kransenTiles', 'kransenHall', 'ochreClinker', 'morseClinker', 'blastedRock', 'tricolourWindows', 'tricolourTiles', 'hgaFront', 'gingham', 'orangeGingham', 'greyBooth', 'blueBooth', 'aspuddenStrips', 'amberTiles', 'aspuddenHall', 'aspuddenPavilion', 'ornsbergTimber', 'ornsbergWindows', 'ornsbergFront'].includes(name)) speckle(x, W, H, 2500, 0.08, 63);
  const t = toTexture(c);
  if (FINISH_CLAMP.includes(name)) t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// The holes in Pia Törnell's enamel (tornellEnamel), [x, y, radius, violet] on its canvas (W by H
// pixels, PX to the metre): a grid 9 cm apart whose holes are pulled towards a point in the middle
// of the panel (or pushed out from it), more of them and closer the nearer it they lie, every
// fourth or so lit violet rather than white.
function tornellHoles(W: number, H: number, PX: number) {
  const r = rng(2012), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.62, out: [number, number, number, boolean][] = [];
  const g = 0.09 * PX;
  for (let gx = g / 2; gx < W; gx += g) for (let gy = g / 2; gy < H; gy += g) {
    const dx = gx - cx, dy = gy - cy, d = Math.hypot(dx, dy), f = d / R;
    // (thinned out towards the edges, where the plain panels take over)
    if (r() > Math.max(0.08, 1.1 - f * 0.9)) continue;
    // drawn in along the radius, and turned a little about the middle
    const pull = 0.55 * Math.exp(-f * 1.6) * (0.6 + r() * 0.8), turn = (r() - 0.5) * 0.25 * (1 - Math.min(1, f));
    const k = 1 - pull, a = Math.atan2(dy, dx) + turn;
    const hx = cx + Math.cos(a) * d * k + (r() - 0.5) * g * 0.6, hy = cy + Math.sin(a) * d * k + (r() - 0.5) * g * 0.6;
    if (hy < 0.06 * PX || hy > H - 0.06 * PX) continue;
    out.push([hx, hy, (0.012 + r() * 0.01) * PX * (1.25 - Math.min(1, f) * 0.5), r() < 0.25]);
  }
  return out;
}

// What a finish gives out of its own light, or nothing: the light behind the holes in Pia Törnell's
// enamel, and its glow through the panels about the middle.
export function finishGlow(name: Finish) {
  if (name !== 'tornellEnamel') return null;
  const PX = 160, [w, h] = FINISH_SIZE[name], W = Math.round(w * PX), H = Math.round(h * PX), [c, x] = canvas(W, H);
  x.fillStyle = '#000000'; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * 0.45);
  g.addColorStop(0, 'rgba(150,120,190,0.35)'); g.addColorStop(1, 'rgba(150,120,190,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (const [dx, dy, dr, violet] of tornellHoles(W, H, PX)) {
    x.fillStyle = violet ? '#c9a6ff' : '#fffaf0';
    x.beginPath(); x.arc(dx, dy, dr, 0, Math.PI * 2); x.fill();
  }
  const t = toTexture(c);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Gert Marcus's glass at Bagarmossen (1994): `n` panels side by side, screen-printed in colours
// that fade from each to the next through `colors` (CSS, from the first panel to the last), lit
// from behind: cloudy, brighter across the middle, with faint streaks, and a thin dark seam at
// each panel's ends. One panel to each 1/n of u, v up it.
export function caveGlass(colors: string[], n: number) {
  const PW = 48, PH = 32, [c, x] = canvas(PW * n, PH), r = rng(1994 + n);
  const rgb = colors.map((s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)));
  const at = (t: number) => {
    const q = Math.max(0, Math.min(1, t)) * (rgb.length - 1), i = Math.min(rgb.length - 2, Math.floor(q)), f = q - i;
    return rgb[i].map((v, j) => Math.round(v + (rgb[i + 1][j] - v) * f));
  };
  for (let px = 0; px < PW * n; px++) {
    const [cr, cg, cb] = at(px / (PW * n - 1));
    const g = x.createLinearGradient(0, 0, 0, PH);
    g.addColorStop(0, `rgb(${cr * 0.7 | 0},${cg * 0.7 | 0},${cb * 0.7 | 0})`);
    g.addColorStop(0.5, `rgb(${Math.min(255, cr * 1.15 + 30) | 0},${Math.min(255, cg * 1.15 + 30) | 0},${Math.min(255, cb * 1.15 + 30) | 0})`);
    g.addColorStop(1, `rgb(${cr * 0.75 | 0},${cg * 0.75 | 0},${cb * 0.75 | 0})`);
    x.fillStyle = g; x.fillRect(px, 0, 1, PH);
  }
  // clouds of lighter and darker colour, and streaks along
  for (let k = 0; k < n * 14; k++) {
    const cx = r() * PW * n, cy = r() * PH, rr = 3 + r() * 9, light = r() < 0.5;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, light ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,20,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
  for (let k = 0; k < n * 4; k++) { x.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.08})`; x.fillRect(r() * PW * n, 2 + r() * (PH - 4), 8 + r() * 30, 1); }
  for (let k = 0; k < n; k++) { x.fillStyle = 'rgba(10,12,16,0.7)'; x.fillRect(k * PW, 0, 1, PH); x.fillRect(k * PW + PW - 1, 0, 1, PH); }
  const tx = toTexture(c, { repeat: false });
  return tx;
}

// Sheets of green glass stacked flat, seen edge on: a streak for each sheet's edge, eight of them
// up the picture (a layer of the stack, about 12 cm), some weathered grey.
export function stackedGlass() {
  const W = 64, H = 64, [c, x] = canvas(W, H), r = rng(1989);
  x.fillStyle = '#2c6f60'; x.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 8) {
    for (let a = 0; a < W;) {
      const grey = r() < 0.25, k = r(), l = 8 + r() * 40;
      x.fillStyle = grey ? `rgba(96,104,100,${0.5 + 0.3 * k})` : k < 0.5 ? `rgba(20,62,52,${0.4 + 0.4 * k})` : `rgba(110,196,170,${0.25 + 0.5 * (k - 0.5)})`;
      x.fillRect(a, y + 1, l, 5);
      a += l;
    }
    x.fillStyle = 'rgba(12,36,30,0.6)'; x.fillRect(0, y, W, 1);
  }
  return toTexture(c);
}

// Bronze, darkened and worn; or dark with a green patina.
export function bronze(patina = false) {
  const [c, x] = canvas(128);
  x.fillStyle = patina ? '#2a3230' : '#4b3b2b'; x.fillRect(0, 0, 128, 128);
  const r = rng(patina ? 1995 : 1994);
  for (let i = 0; i < 300; i++) {
    if (patina) x.fillStyle = r() < 0.55 ? `rgba(70,118,104,${r() * 0.35})` : `rgba(18,20,20,${r() * 0.4})`;
    else x.fillStyle = r() < 0.5 ? `rgba(120,92,58,${r() * 0.3})` : `rgba(30,26,22,${r() * 0.35})`;
    x.fillRect(r() * 128, r() * 128, 2 + r() * 10, 2 + r() * 30);
  }
  return toTexture(c);
}

// A folding ruler's copper, darkened to brown and black, over 3 m of it (uv u in metres / 3, v
// across its broad face): seams across the cladding every metre with rivets down them, the scale's
// ticks along its top edge (every 10 cm, longer every 50), and its numbers along the middle,
// black, and every third red, as a ruler's tens.
export const RULER_REPEAT = 3;
export function ruler() {
  const PX = 128, W = RULER_REPEAT * PX, H = 128, [c, x] = canvas(W, H), r = rng(1983);
  x.fillStyle = '#35332d'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) {
    const k = r();
    x.fillStyle = k < 0.35 ? `rgba(110,88,60,${r() * 0.2})` : k < 0.7 ? `rgba(16,16,14,${r() * 0.35})` : k < 0.85 ? `rgba(78,108,92,${r() * 0.18})` : `rgba(150,128,96,${r() * 0.12})`;
    x.fillRect(r() * W, r() * H, 4 + r() * 40, 2 + r() * 14);
  }
  for (let m = 0; m < RULER_REPEAT; m++) {
    const sx = m * PX + 0.37 * PX;
    x.fillStyle = 'rgba(12,12,10,0.7)'; x.fillRect(sx, 0, 2, H);
    x.fillStyle = 'rgba(160,140,110,0.25)'; x.fillRect(sx + 2, 0, 1, H);
    for (let k = 0; k < 10; k++) { x.fillStyle = 'rgba(190,170,130,0.45)'; x.fillRect(sx - 4, k * H / 10 + 5, 2, 2); x.fillRect(sx + 5, k * H / 10 + 5, 2, 2); }
  }
  x.fillStyle = 'rgba(8,8,8,0.85)';
  for (let k = 0; k < RULER_REPEAT * 10; k++) x.fillRect(k * PX / 10, 0, 2, k % 5 === 0 ? 0.22 * H : 0.12 * H);
  x.font = `${Math.round(0.36 * H)}px Georgia, "Times New Roman", serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  ['7', '8', '20'].forEach((t, m) => {
    x.fillStyle = m === 2 ? '#c8261c' : 'rgba(8,8,8,0.9)';
    x.fillText(t, (m + 0.75) * PX, 0.52 * H);
  });
  return toTexture(c);
}

// Pale Öland limestone, rough-hewn: grey-white, beds of it a little darker across it, speckled,
// stained brown in places. A metre square.
export function limestone() {
  const [c, x] = canvas(128), r = rng(1984);
  x.fillStyle = '#cbc8c0'; x.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128;) { const h = 3 + r() * 14; x.fillStyle = `rgba(${r() < 0.5 ? '110,104,94' : '235,232,226'},${0.06 + r() * 0.12})`; x.fillRect(0, y, 128, h); y += h; }
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(140,112,80,${r() * 0.12})`; x.fillRect(r() * 128, r() * 128, 6 + r() * 30, 4 + r() * 20); }
  speckle(x, 128, 128, 1500, 0.25, 1985);
  return toTexture(c);
}

// Dark granite, split: grey with a warm brown cast, a coarse grain of black, white and pink
// crystals, patches a little darker or paler. A metre square.
export function granite() {
  const N = 256, [c, x] = canvas(N), r = rng(1987);
  x.fillStyle = '#7d7871'; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '70,62,56' : '190,182,170'},${0.04 + r() * 0.08})`; x.fillRect(r() * N, r() * N, 20 + r() * 80, 16 + r() * 60); }
  speckle(x, N, N, 9000, 0.32, 1988); speckle(x, N, N, 5000, 0.22, 1989, true);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(176,124,108,${0.15 + r() * 0.25})`; x.fillRect(r() * N, r() * N, 1 + r() * 1.5, 1 + r() * 1.5); }
  return toTexture(c);
}

// ---------------------------------------------------------------- the detailed buildings
// (src/detail/): near white where vertex colours tint them.

// A window as seen from outside, over its whole pane (uv 0 → 1 across a quarter of it): a frame
// (light unless given), glazing bars and a transom, and glass that reflects the sky. Four windows
// side by side, their glass different (src/detail/wall.ts picks one for each window).
export function detailWindow(frame = '#ece9e1') {
  const [c, x] = canvas(512, 256);
  const r = rng(61);
  for (let k = 0; k < 4; k++) {
    const ox = k * 128;
    paintGlass(x, ox, 0, 128, 256, r);
    x.fillStyle = frame;
    x.fillRect(ox, 0, 128, 9); x.fillRect(ox, 247, 128, 9); x.fillRect(ox, 0, 9, 256); x.fillRect(ox + 119, 0, 9, 256);
    x.fillRect(ox + 61, 0, 6, 256);
    x.fillRect(ox, 70, 128, 7);
    for (const y of [140, 196]) x.fillRect(ox, y, 128, 4);
  }
  return toTexture(c, { repeat: false, aniso: 4 });
}

// A door: dark wood, glazed in its upper part, two panels below.
export function detailDoor() {
  const [c, x] = canvas(128, 256);
  x.fillStyle = '#4a3220';
  x.fillRect(0, 0, 128, 256);
  speckle(x, 128, 256, 400, 0.15, 71);
  x.fillStyle = '#1d242b';
  x.fillRect(14, 18, 44, 86); x.fillRect(70, 18, 44, 86);
  x.strokeStyle = 'rgba(0,0,0,0.45)';
  x.lineWidth = 3;
  for (const px of [14, 70]) x.strokeRect(px + 2, 128, 40, 108);
  x.fillStyle = '#2e1f14';
  x.fillRect(62, 0, 4, 256);
  return toTexture(c, { repeat: false, aniso: 4 });
}

// A shop front: a sign band over a big window of thin frames, the street reflected in its glass
// and the shop lit warm behind it.
export function detailShop() {
  const [c, x] = canvas(256, 128);
  const r = rng(67);
  for (const [gx, gw] of [[5, 121], [130, 121]]) {
    paintGlass(x, gx, 30, gw, 98, r);
    x.fillStyle = 'rgba(255,214,150,0.22)';
    x.fillRect(gx, 70, gw, 58);
    // shelves and goods
    for (let k = 0; k < 6; k++) {
      x.fillStyle = `rgba(${120 + r() * 100},${90 + r() * 90},${70 + r() * 80},0.35)`;
      x.fillRect(gx + r() * (gw - 30), 80 + r() * 30, 12 + r() * 20, 6 + r() * 14);
    }
  }
  x.fillStyle = '#d9d6cf';
  x.fillRect(0, 0, 256, 26);
  x.fillStyle = '#3b3b3b';
  x.fillRect(0, 26, 256, 4); x.fillRect(0, 0, 5, 128); x.fillRect(251, 0, 5, 128); x.fillRect(126, 30, 4, 98);
  return toTexture(c, { repeat: false, aniso: 4 });
}

// Standing-seam metal roofing, the seams 0.5 m apart down the slope; covers 4 × 4 m.
export function roofSeams() {
  const [c, x] = canvas(256);
  x.fillStyle = '#d2d4d8';
  x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 900, 0.06, 81);
  for (let k = 0; k < 256; k += 32) {
    x.fillStyle = 'rgba(0,0,0,0.22)';
    x.fillRect(k, 0, 2, 256);
    x.fillStyle = 'rgba(255,255,255,0.35)';
    x.fillRect(k + 2, 0, 2, 256);
  }
  return toTexture(c);
}

// Copper gone green, mottled; covers 2 × 2 m.
export function verdigris() {
  const [c, x] = canvas(128);
  x.fillStyle = '#74b3a0';
  x.fillRect(0, 0, 128, 128);
  const r = rng(91);
  for (let i = 0; i < 160; i++) {
    const v = r();
    x.fillStyle = v < 0.5 ? `rgba(60,95,88,${0.1 + r() * 0.25})` : `rgba(170,215,200,${0.1 + r() * 0.2})`;
    x.beginPath(); x.arc(r() * 128, r() * 128, 2 + r() * 9, 0, Math.PI * 2); x.fill();
  }
  return toTexture(c);
}

// Bricks without windows; covers 2 × 2 m.
export function brickBond() {
  const [c, x] = canvas(256);
  x.fillStyle = '#c9c3bb';
  x.fillRect(0, 0, 256, 256);
  const r = rng(101);
  // 32 courses of 62 mm, bricks 250 mm long
  for (let y = 0; y < 256; y += 8) {
    for (let k = -1; k < 9; k++) {
      const x0 = k * 32 + ((y / 8) % 2 ? 16 : 0), v = 200 + Math.floor(r() * 55);
      x.fillStyle = `rgb(${v},${v - 6},${v - 12})`;
      x.fillRect(x0 + 1, y + 1, 30, 6);
    }
  }
  return toTexture(c);
}

// A curtain wall of glass and aluminium: four panels by four storeys (each 128 × 256 px), a pane
// of vision glass over a spandrel in each, between mullions and transoms. `style` gives the
// spandrels' colour and share, the glass's tint, the frames' colour and width, and how far the
// glass is narrowed inside a frame of the spandrels' colour.
export interface CurtainStyle { spandrel: string; share: number; tint: string | null; frame: string; mullion: number; inset?: number; band?: string }
export function curtainWall(st: CurtainStyle = { spandrel: '#7f9aa6', share: 0.26, tint: null, frame: '#c9d2d6', mullion: 6 }) {
  const [c, x] = canvas(512, 1024);
  const r = rng(91);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const ox = i * 128, oy = j * 256, sh = Math.round(256 * st.share), gy = oy, gh = 256 - sh;
    // the spandrel at the bottom of the storey, the glass over it
    x.fillStyle = st.spandrel;
    x.fillRect(ox, oy, 128, 256);
    const ins = st.inset ?? 0;
    paintGlass(x, ox + ins, gy + 6, 128 - 2 * ins, gh - 6, r, st.tint, true);
    x.fillStyle = 'rgba(255,255,255,0.05)';
    x.fillRect(ox, oy + gh, 128, sh);
    // mullions at the panel's sides, a transom over the spandrel, a floor band
    x.fillStyle = st.frame;
    const m = st.mullion / 2;
    x.fillRect(ox, oy, m, 256); x.fillRect(ox + 128 - m, oy, m, 256);
    x.fillRect(ox, oy + gh - 3, 128, 6);
    x.fillRect(ox, oy, 128, 4);
    if (st.band) { x.fillStyle = st.band; x.fillRect(ox, oy + 252, 128, 4); }
  }
  return toTexture(c, { aniso: 8 });
}

// Marble cladding: slabs 1.25 × 1.65 m in a grid, near white with faint veins, weathered buff in
// places. Two slabs by two (covers 2.5 × 3.3 m).
export function marble() {
  const [c, x] = canvas(256, 256);
  const r = rng(97);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const v = 226 + Math.floor(r() * 14);
    x.fillStyle = `rgb(${v},${v - 1},${v - 5})`;
    x.fillRect(i * 128, j * 128, 128, 128);
    // weathering
    for (let k = 0; k < 6; k++) {
      x.fillStyle = `rgba(190,160,115,${r() * 0.12})`;
      x.beginPath(); x.ellipse(i * 128 + r() * 128, j * 128 + r() * 128, 8 + r() * 30, 10 + r() * 40, 0, 0, Math.PI * 2); x.fill();
    }
    // veins
    x.strokeStyle = 'rgba(140,140,135,0.18)'; x.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      x.beginPath(); let px = i * 128 + r() * 128, py = j * 128;
      x.moveTo(px, py);
      for (let t = 0; t < 6; t++) { px += (r() - 0.5) * 40; py += 22; x.lineTo(px, py); }
      x.stroke();
    }
  }
  speckle(x, 256, 256, 800, 0.05, 98);
  x.fillStyle = '#9b9994';
  for (const k of [0, 128]) { x.fillRect(k, 0, 2, 256); x.fillRect(0, k, 256, 2); }
  return toTexture(c, { aniso: 8 });
}

// A shop's name in bold letters on nothing (for an alpha test), as on a facade; covers its width.
export function letters(text: string, colour: string) {
  const [c, x] = canvas(1024, 160);
  x.font = '800 128px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = colour;
  x.fillText(text, 512, 84, 1000);
  return toTexture(c, { repeat: false, aniso: 4 });
}

// A stone balustrade 1 m high on nothing (for an alpha test): a plinth, five turned balusters to
// the metre and a rail; covers 1 × 1 m.
export function balustrade() {
  const [c, x] = canvas(128, 128);
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 128, 14); x.fillRect(0, 114, 128, 14);
  for (let k = 0; k < 5; k++) {
    const cx = 12.8 + k * 25.6;
    x.beginPath();
    x.moveTo(cx - 6, 114); x.lineTo(cx + 6, 114);
    x.bezierCurveTo(cx + 3, 100, cx + 10, 70, cx + 4, 46);
    x.bezierCurveTo(cx + 2, 34, cx + 6, 22, cx + 6, 14);
    x.lineTo(cx - 6, 14);
    x.bezierCurveTo(cx - 6, 22, cx - 2, 34, cx - 4, 46);
    x.bezierCurveTo(cx - 10, 70, cx - 3, 100, cx - 6, 114);
    x.fill();
  }
  x.fillStyle = 'rgba(0,0,0,0.18)';
  x.fillRect(0, 12, 128, 2); x.fillRect(0, 114, 128, 2);
  return toTexture(c, { aniso: 4 });
}

// A digit in blue neon tubes, on nothing (for an alpha test), as on the Hötorget towers' gables.
export function neonDigit(d: string) {
  const [c, x] = canvas(128, 192);
  x.font = '700 170px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineJoin = 'round';
  x.strokeStyle = '#2f5cf0'; x.lineWidth = 16; x.strokeText(d, 64, 100);
  x.strokeStyle = '#d6e0ff'; x.lineWidth = 5; x.strokeText(d, 64, 100);
  return toTexture(c, { repeat: false, aniso: 4 });
}

// A railing of upright bars on nothing (for an alpha test), white for vertex colours to tint: a
// handrail at the top, a rail near the foot and a bar every 12.5 cm; covers 1 m along by its
// height.
export function railingBars() {
  const [c, x] = canvas(128, 128);
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 128, 9);
  x.fillRect(0, 110, 128, 6);
  for (let k = 0; k < 128; k += 16) x.fillRect(k + 6, 0, 4, 128);
  return toTexture(c, { aniso: 4 });
}

// A timber walkway's boards, white for vertex colours to tint: eight boards across it, each a
// little lighter or darker, with a dark gap after each; covers 2 m along it.
export function boardWalk() {
  const [c, x] = canvas(128, 256);
  const r = rng(53);
  for (let i = 0; i < 8; i++) {
    const v = 205 + Math.floor(r() * 45);
    x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(0, i * 32, 128, 29);
    x.fillStyle = '#3a3a3a'; x.fillRect(0, i * 32 + 29, 128, 3);
  }
  speckle(x, 128, 256, 1500, 0.15, 54);
  return toTexture(c, { aniso: 4 });
}

// The sign over a station's entrance, SL style: a blue band with the T in a white ring on the
// left, the name in white capitals and a yellow line along its foot. 1024 × 176, about 4.6 × 0.8 m.
export function entranceSign(text: string) {
  const [c, x] = canvas(1024, 176);
  x.fillStyle = '#123f8c'; x.fillRect(0, 0, 1024, 176);
  x.fillStyle = '#f2c230'; x.fillRect(0, 158, 1024, 18);
  x.fillStyle = '#ffffff';
  x.beginPath(); x.arc(110, 80, 52, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#123f8c';
  x.fillRect(80, 52, 60, 14); x.fillRect(102, 52, 16, 64);
  x.fillStyle = '#ffffff';
  x.font = '600 92px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillText(text, 200, 84, 800);
  return toTexture(c, { repeat: false });
}

// ------------------------------------------------------------------ streets and trees
// (src/detail/streets.ts) Light and near neutral, for the vertex colours to tint.

// Granite setts (gatsten) in rows, as in Gamla stan's streets: stones 12.5 cm across the row and
// 14–24 cm along it, each its own shade, in dark joints. Covers 2 × 2 m.
export function setts() {
  const S = 512, px = S / 2;
  const [c, x] = canvas(S);
  x.fillStyle = '#5a5855'; x.fillRect(0, 0, S, S);
  const r = rng(71), row = px / 8;
  for (let y = 0; y < S; y += row) {
    let u = -r() * px * 0.2;
    while (u < S) {
      const len = Math.min(S - u, px * (0.14 + r() * 0.1)), v = 165 + Math.floor(r() * 60), warm = Math.floor(r() * 10);
      x.fillStyle = `rgb(${v + warm},${v},${v - warm})`;
      const j = 2 + r() * 1.5;
      // (wrapping round the repeat's edge)
      for (const o of [0, S]) x.fillRect(u + j - o, y + j, len - 2 * j, row - 2 * j);
      u += len;
    }
  }
  speckle(x, S, S, 9000, 0.22, 72);
  speckle(x, S, S, 3000, 0.12, 73, true);
  return toTexture(c, { aniso: 8 });
}

// Round cobbles (kullersten): stones of 8–14 cm, packed, in dark gaps. Covers 1.5 × 1.5 m.
export function cobbles() {
  const S = 256, px = S / 1.5;
  const [c, x] = canvas(S);
  x.fillStyle = '#4e4b47'; x.fillRect(0, 0, S, S);
  const r = rng(75);
  for (let k = 0; k < 520; k++) {
    const cx = r() * S, cy = r() * S, rad = px * (0.04 + r() * 0.03), v = 150 + Math.floor(r() * 80), warm = Math.floor(r() * 14);
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const g = x.createRadialGradient(cx + ox - rad * 0.3, cy + oy - rad * 0.3, rad * 0.1, cx + ox, cy + oy, rad);
      g.addColorStop(0, `rgb(${v + 30 + warm},${v + 30},${v + 30 - warm})`); g.addColorStop(1, `rgb(${v - 30 + warm},${v - 30},${v - 30 - warm})`);
      x.fillStyle = g;
      x.beginPath(); x.ellipse(cx + ox, cy + oy, rad, rad * (0.8 + r() * 0.2), r() * 3, 0, Math.PI * 2); x.fill();
    }
  }
  return toTexture(c, { aniso: 8 });
}

// Concrete paving slabs (betongplattor), 35 × 35 cm, four by four, each a shade apart. Covers 1.4 ×
// 1.4 m.
export function pavingSlabs() {
  const S = 256, n = 4, w = S / n;
  const [c, x] = canvas(S);
  x.fillStyle = '#707070'; x.fillRect(0, 0, S, S);
  const r = rng(77);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 200 + Math.floor(r() * 30);
    x.fillStyle = `rgb(${v},${v},${v - 3})`;
    x.fillRect(i * w + 1, j * w + 1, w - 2, w - 2);
  }
  speckle(x, S, S, 4000, 0.14, 78);
  speckle(x, S, S, 1500, 0.1, 79, true);
  // stains
  for (let k = 0; k < 14; k++) {
    x.fillStyle = `rgba(60,60,55,${r() * 0.06})`;
    x.beginPath(); x.ellipse(r() * S, r() * S, 5 + r() * 30, 5 + r() * 30, 0, 0, Math.PI * 2); x.fill();
  }
  return toTexture(c, { aniso: 8 });
}

// Asphalt: fine grit, lighter stones in it, darker patches and seams. Covers 4 × 4 m.
export function asphalt() {
  const S = 256;
  const [c, x] = canvas(S);
  x.fillStyle = '#c4c4c4'; x.fillRect(0, 0, S, S);
  const r = rng(81);
  for (let k = 0; k < 10; k++) {
    x.fillStyle = `rgba(40,40,40,${0.03 + r() * 0.06})`;
    x.beginPath(); x.ellipse(r() * S, r() * S, 10 + r() * 50, 8 + r() * 40, r() * 3, 0, Math.PI * 2); x.fill();
  }
  speckle(x, S, S, 9000, 0.3, 82);
  speckle(x, S, S, 5000, 0.25, 83, true);
  return toTexture(c, { aniso: 8 });
}

// Gravel: grit and small stones. Covers 2 × 2 m.
export function gravel() {
  const S = 256;
  const [c, x] = canvas(S);
  x.fillStyle = '#cfc8bb'; x.fillRect(0, 0, S, S);
  speckle(x, S, S, 12000, 0.35, 85);
  speckle(x, S, S, 6000, 0.3, 86, true);
  return toTexture(c, { aniso: 4 });
}

// A tree's leaves, packed: clumps of small leaves in lighter and darker greens on shadow. Near
// white-green for the vertex colours to tint. Covers 2 × 2 m.
export function leaves() {
  const S = 256;
  const [c, x] = canvas(S);
  x.fillStyle = '#7d8a74'; x.fillRect(0, 0, S, S);
  leafClumps(x, S, 2600, 87);
  return toTexture(c, { aniso: 4 });
}

// A spray of leaves on nothing, for an alpha test: thick in the middle, ragged at the edge. A
// crown's outside is made of many of them (src/detail/streets.ts).
export function leafCard() {
  const S = 128;
  const [c, x] = canvas(S);
  const r = rng(89);
  for (let k = 0; k < 150; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * S * 0.4, len = 6 + r() * 6, v = r(), shade = 0.7 + r() * 0.3;
    const g = Math.floor(165 + v * 90);
    x.fillStyle = `rgb(${Math.floor(g * 0.86 * shade)},${Math.floor(g * shade)},${Math.floor(g * 0.74 * shade)})`;
    x.beginPath(); x.ellipse(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d, len, len * 0.5, r() * Math.PI, 0, Math.PI * 2); x.fill();
  }
  return toTexture(c, { repeat: false, aniso: 4 });
}

function leafClumps(x: CanvasRenderingContext2D, S: number, n: number, seed: number) {
  const r = rng(seed);
  for (let k = 0; k < n; k++) {
    const cx = r() * S, cy = r() * S, len = 3 + r() * 5, a = r() * Math.PI, v = r();
    const g = Math.floor(170 + v * 85), shade = 0.75 + r() * 0.25;
    x.fillStyle = `rgb(${Math.floor(g * 0.88 * shade)},${Math.floor(g * shade)},${Math.floor(g * 0.78 * shade)})`;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      x.beginPath(); x.ellipse(cx + ox, cy + oy, len, len * 0.55, a, 0, Math.PI * 2); x.fill();
    }
  }
}

// ------------------------------------------------------------------ Slussen
// Granite ashlar, as the new Slussen's quay walls and pavilions are clad: blocks about 1 × 0.5 m
// in staggered courses, near white for the vertex colour to tint, with darker joints. Covers 2 × 2 m.
export function graniteBlocks() {
  const [c, x] = canvas(256);
  const r = rng(71);
  x.fillStyle = '#8e8a84'; x.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 64 : 0;
    for (let k = -1; k < 3; k++) {
      const v = 205 + Math.floor(r() * 40);
      x.fillStyle = `rgb(${v},${v - 3},${v - 9})`;
      x.fillRect(k * 128 + off + 2, row * 64 + 2, 124, 60);
    }
  }
  speckle(x, 256, 256, 2500, 0.12, 72);
  return toTexture(c, { aniso: 4 });
}

// A railing of slender posts with a top rail and three wires, as along Guldbron's edges and the
// new quays, on nothing (alpha test): one post every 2 m, the texture 2 m long and 1 m high.
export function wireRails() {
  const [c, x] = canvas(256, 128);
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 7, 128);
  x.fillRect(0, 0, 256, 9);
  for (const y of [40, 72, 104]) x.fillRect(0, y, 256, 3);
  return toTexture(c, { aniso: 4 });
}

// A steel lattice, as Katarinahissen's tower and the truss under its walkway: two uprights, a
// bar across top and bottom and a cross of diagonals, on nothing (alpha test). One panel.
export function lattice() {
  const [c, x] = canvas(256);
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 14, 256); x.fillRect(242, 0, 14, 256);
  x.fillRect(0, 0, 256, 10); x.fillRect(0, 246, 256, 10);
  x.lineWidth = 9; x.strokeStyle = '#ffffff';
  x.beginPath(); x.moveTo(7, 5); x.lineTo(249, 251); x.moveTo(249, 5); x.lineTo(7, 251); x.stroke();
  return toTexture(c, { aniso: 4 });
}

// The band of lights under Katarinahissen's walkway, red with a running line of pale letters
// too small to read, which the material lights up by itself. Covers about 8 × 1 m.
export function ledBand() {
  const [c, x] = canvas(1024, 128);
  const r = rng(77);
  x.fillStyle = '#c81e2a'; x.fillRect(0, 0, 1024, 128);
  x.fillStyle = '#ffd9d0';
  let px = 20;
  while (px < 1000) {
    const w = 10 + Math.floor(r() * 18);
    if (r() < 0.82) x.fillRect(px, 40, w, 48);
    px += w + 8;
  }
  x.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < 128; y += 4) x.fillRect(0, y, 1024, 1);
  return toTexture(c, { aniso: 4 });
}

// ------------------------------------------------------------------ Ropsten's station
// (src/detail/ropsten-station.ts) As photographs on Wikimedia Commons show them (2009–2026).

// Trapezoidal steel sheet, near white for vertex colours to tint: a rib every 20 cm, lit on one
// side and shaded on the other, across v (or, `upright`, across u: cladding on a wall). Covers
// 1 × 1 m.
export function corrugated(upright = false) {
  const [c, x] = upright ? canvas(160, 64) : canvas(64, 160);
  const band = (at: number, w: number, fill: string) => {
    x.fillStyle = fill;
    if (upright) x.fillRect(at, 0, w, 64); else x.fillRect(0, at, 64, w);
  };
  for (let k = 0; k < 5; k++) {
    const p = k * 32;
    band(p, 32, '#e4e4e4');
    band(p + 3, 9, '#fbfbfb');
    band(p + 12, 3, '#b9b9b9');
    band(p + 15, 15, '#d2d2d2');
    band(p + 30, 2, '#c8c8c8');
  }
  speckle(x, upright ? 160 : 64, upright ? 64 : 160, 400, 0.08, 91);
  return toTexture(c, { aniso: 8 });
}

// Roland Kempe's snake (1971) on the red wall between the platforms at the concourse's end: a
// winding snake banded black and white, blue in its middle, an arrowhead with an eye at each end
// and eyes along its body, over a black skirting. Covers the wall's 10.8 × 3.04 m.
export function kempeSnake() {
  const W = 2048, H = 576;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#a3383a'; x.fillRect(0, 0, W, H);
  const r = rng(93);
  for (let k = 0; k < 60; k++) {
    x.fillStyle = `rgba(${r() < 0.5 ? '60,10,10' : '220,120,110'},${0.03 + r() * 0.04})`;
    x.beginPath(); x.ellipse(r() * W, r() * H, 40 + r() * 160, 20 + r() * 80, r() * 3, 0, Math.PI * 2); x.fill();
  }
  speckle(x, W, H, 6000, 0.1, 94);
  x.fillStyle = '#1b1b1d'; x.fillRect(0, H - 36, W, 36);
  // the body's middle line, read off a photograph of the wall (1150 × 320 px there)
  const P = (px: number, py: number): [number, number] => [((px - 65) / 1150) * W, ((py - 60) / 320) * H];
  const body = ([[190, 212], [160, 258], [176, 300], [212, 296], [236, 250], [256, 160], [292, 100], [350, 85], [400, 108], [415, 160],
    [400, 222], [382, 272], [392, 315], [440, 322], [500, 302], [535, 256], [540, 200], [512, 150], [496, 110], [522, 80], [580, 74],
    [640, 90], [666, 132], [666, 200], [652, 262], [642, 300], [666, 320], [702, 300], [722, 250], [746, 180], [770, 102], [790, 72],
    [812, 120], [826, 200], [844, 270], [856, 318], [886, 290], [906, 240], [930, 160], [962, 100], [1002, 76], [1046, 86], [1062, 122],
    [1050, 172], [1030, 210], [1052, 234], [1100, 228], [1136, 216]] as [number, number][]).map(([a, b]) => P(a, b));
  // a smooth line through the points (Catmull–Rom), every few pixels
  const line: [number, number][] = [];
  for (let i = 0; i + 1 < body.length; i++) {
    const p0 = body[Math.max(0, i - 1)], p1 = body[i], p2 = body[i + 1], p3 = body[Math.min(body.length - 1, i + 2)];
    for (let t = 0; t < 1; t += 0.1) {
      const t2 = t * t, t3 = t2 * t;
      line.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)) as [number, number]);
    }
  }
  line.push(body[body.length - 1]);
  const along = [0];
  for (let i = 1; i < line.length; i++) along.push(along[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const total = along[along.length - 1];
  const normal = (i: number) => {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  };
  // its width: thin at the necks, full along the body
  const width = (d: number) => {
    const end = Math.min(d, total - d);
    return 26 + 54 * Math.min(1, Math.max(0, (end - 30) / 50));
  };
  // the bands, each a strip square to the line
  const BAND = 46;
  for (let k = 0; k * BAND < total; k++) {
    const d0 = k * BAND, d1 = Math.min(total, (k + 1) * BAND + 1.5);
    const pts = line.map((p, i) => ({ p, i, d: along[i] })).filter((q) => q.d >= d0 && q.d <= d1);
    if (pts.length < 2) continue;
    const mid = (d0 + d1) / 2 / total;
    const blue = mid > 0.45 && mid < 0.78 && k % 4 === 1;
    x.fillStyle = k % 2 === 0 ? '#151516' : blue ? '#2c4c9c' : '#f1ece1';
    x.beginPath();
    pts.forEach(({ p, i, d }, j) => { const n = normal(i), w = width(d) / 2; (j ? x.lineTo : x.moveTo).call(x, p[0] + n[0] * w, p[1] + n[1] * w); });
    for (let j = pts.length - 1; j >= 0; j--) { const { p, i, d } = pts[j], n = normal(i), w = width(d) / 2; x.lineTo(p[0] - n[0] * w, p[1] - n[1] * w); }
    x.closePath(); x.fill();
    // thin blue stripes in the white bands of the middle
    if (k % 2 === 1 && !blue && mid > 0.42 && mid < 0.8) {
      const q = pts[Math.floor(pts.length / 2)], n = normal(q.i), w = width(q.d) / 2;
      const t: [number, number] = [n[1], -n[0]];
      x.strokeStyle = '#2c4c9c'; x.lineWidth = 6;
      x.beginPath(); x.moveTo(q.p[0] + n[0] * w + t[0] * 8, q.p[1] + n[1] * w + t[1] * 8); x.lineTo(q.p[0] - n[0] * w + t[0] * 8, q.p[1] - n[1] * w + t[1] * 8); x.stroke();
    }
  }
  // an eye: almond, lashes over it
  const eye = (cx: number, cy: number, s: number) => {
    x.fillStyle = '#f6f3ea'; x.strokeStyle = '#111'; x.lineWidth = 3;
    x.beginPath(); x.ellipse(cx, cy, 26 * s, 12 * s, 0, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#111'; x.beginPath(); x.arc(cx, cy, 8 * s, 0, Math.PI * 2); x.fill();
    x.lineWidth = 2.5;
    for (let k = -3; k <= 3; k++) {
      const a = -Math.PI / 2 + k * 0.32;
      x.beginPath(); x.moveTo(cx + Math.cos(a) * 24 * s, cy + Math.sin(a) * 11 * s); x.lineTo(cx + Math.cos(a) * 34 * s, cy + Math.sin(a) * 20 * s); x.stroke();
    }
  };
  for (const [px, py] of [[412, 160], [830, 205]]) { const [a, b] = P(px, py); eye(a, b, 1); }
  // the heads: pale arrowheads pointing out along the wall, with an eye; a collar of dots behind
  for (const side of [-1, 1]) {
    const neck = side < 0 ? line[0] : line[line.length - 1];
    const tip: [number, number] = side < 0 ? P(75, 220) : P(1206, 210);
    const base = neck[0] + side * 8;
    x.fillStyle = '#f1ece1'; x.strokeStyle = '#1a1a1a'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(base, neck[1]);
    x.lineTo(base + side * 24, neck[1] - 74); x.lineTo(tip[0], tip[1]); x.lineTo(base + side * 24, neck[1] + 74);
    x.closePath(); x.fill(); x.stroke();
    x.fillStyle = '#1a1a1a';
    // the neck from the body to the head, banded thin
    const n0 = side < 0 ? P(130, 216) : P(1140, 214);
    x.fillStyle = '#f1ece1';
    x.fillRect(Math.min(n0[0], base), neck[1] - 11, Math.abs(base - n0[0]), 22);
    x.fillStyle = '#151516';
    for (let k = 0; k < 4; k++) x.fillRect(Math.min(n0[0], base) + 6 + k * Math.abs(base - n0[0]) / 4, neck[1] - 11, 7, 22);
    for (let k = -2; k <= 2; k++) { x.beginPath(); x.arc(neck[0] - side * 2, neck[1] + k * 9, 3.5, 0, Math.PI * 2); x.fill(); }
    eye(base + side * 44, neck[1] - 2, 0.62);
  }
  return toTexture(c, { repeat: false, aniso: 8 });
}

// The name boards hung over the platforms: the name in white on a navy band, and over it on
// white the ways out with navy arrows. They face the track; on the north-west platform the
// arrows to the north-east point left (`mirrored`). 1024 × 288, about 3.8 × 1.07 m.
export function ropstenBoard(mirrored: boolean) {
  const [c, x] = canvas(1024, 288);
  const NAVY = '#1f3470';
  x.fillStyle = '#f7f7f4'; x.fillRect(0, 0, 1024, 156);
  x.fillStyle = NAVY; x.fillRect(0, 156, 1024, 132);
  x.strokeStyle = '#5c6474'; x.lineWidth = 4; x.strokeRect(2, 2, 1020, 284);
  x.fillStyle = '#ffffff';
  x.font = '600 92px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '18px';
  x.fillText('ROPSTEN', 512, 226);
  (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '1px';
  x.fillStyle = NAVY;
  x.font = '600 34px "Helvetica Neue", Arial, sans-serif';
  const arrow = (cx: number, cy: number, dir: number) => {
    x.beginPath(); x.moveTo(cx + dir * 14, cy); x.lineTo(cx - dir * 12, cy - 15); x.lineTo(cx - dir * 12, cy + 15); x.closePath(); x.fill();
  };
  // south-west: Hjorthagen and the tram museum; north-east: the trams to Lidingö, the buses, the boat
  const sw = ['HJORTHAGEN', 'SPÅRVÄGSMUSEET'], ne = ['ROPSTEN', 'LIDINGÖTÅGEN', 'BUSSAR · PENDELBÅT'];
  const column = (lines: string[], left: boolean) => {
    const ys = lines.length === 2 ? [52, 104] : [36, 80, 124];
    lines.forEach((t, i) => {
      x.textAlign = left ? 'left' : 'right';
      x.fillText(t, left ? 70 : 954, ys[i] + 2);
      arrow(left ? 36 : 988, ys[i], left ? -1 : 1);
    });
  };
  column(mirrored ? ne : sw, true);
  column(mirrored ? sw : ne, false);
  return toTexture(c, { repeat: false, aniso: 8 });
}

// The fascia over the glazed hall's doors at the platforms' north-east end: "↓ Lidingöbanan ↓" in
// white on navy, a yellow line along its foot. 1024 × 96, about 6.1 × 0.57 m.
export function lidingobananFascia() {
  const [c, x] = canvas(1024, 96);
  x.fillStyle = '#1f3c88'; x.fillRect(0, 0, 1024, 96);
  x.fillStyle = '#f2c230'; x.fillRect(0, 88, 1024, 8);
  x.fillStyle = '#ffffff';
  x.font = '600 42px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('Lidingöbanan', 512, 46);
  for (const ax of [330, 694]) {
    x.fillRect(ax - 2, 26, 4, 30);
    x.beginPath(); x.moveTo(ax - 12, 48); x.lineTo(ax + 12, 48); x.lineTo(ax, 62); x.closePath(); x.fill();
  }
  return toTexture(c, { repeat: false, aniso: 4 });
}

// The light box over the north-east landing: "LIDINGÖTÅGEN" in pale capitals on white, in a navy
// frame. 1024 × 160, about 3.2 × 0.5 m.
export function lidingotagenBox() {
  const [c, x] = canvas(1024, 160);
  x.fillStyle = '#1f3470'; x.fillRect(0, 0, 1024, 160);
  x.fillStyle = '#f4f4f0'; x.fillRect(14, 14, 996, 132);
  x.fillStyle = '#b4b8bf';
  x.font = '500 80px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '8px';
  x.fillText('LIDINGÖTÅGEN', 512, 84);
  return toTexture(c, { repeat: false, aniso: 4 });
}

// A departure board: amber dots on black, the next train and the one after. 512 × 128, 1.6 × 0.4 m.
export function departureBoard() {
  const [c, x] = canvas(512, 128);
  x.fillStyle = '#0d0e10'; x.fillRect(0, 0, 512, 128);
  x.fillStyle = '#c92a2a'; x.fillRect(14, 14, 40, 40);
  x.fillStyle = '#ffffff';
  x.font = '700 26px "Helvetica Neue", Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('13', 34, 35);
  x.fillStyle = '#ffb43a';
  x.textAlign = 'left';
  x.font = '600 28px "Helvetica Neue", Arial, sans-serif';
  x.fillText('Norsborg', 66, 26);
  x.font = '500 18px "Helvetica Neue", Arial, sans-serif';
  x.fillText('via T-Centralen', 66, 50);
  x.font = '600 24px "Helvetica Neue", Arial, sans-serif';
  x.fillText('Norsborg', 66, 96);
  x.textAlign = 'right';
  x.font = '600 28px "Helvetica Neue", Arial, sans-serif';
  x.fillText('2 min', 496, 30);
  x.font = '600 24px "Helvetica Neue", Arial, sans-serif';
  x.fillText('12 min', 496, 96);
  x.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < 128; y += 3) x.fillRect(0, y, 512, 1);
  return toTexture(c, { repeat: false, aniso: 4 });
}

// Françoise Schein's track walls at Universitetet (1997): white glazed tiles, 15 cm, in pale
// joints, and across them the articles of the Universal Declaration of Human Rights in Swedish,
// in black capitals, an article's number large in among them, and Linnaeus's journeys drawn in
// blue lines; a red line along the top (photographs, 2005–2021). From the track's floor (a dark
// foot to the rail's level) to `h` m over the rail; the texture covers 9.6 m along, and `article`
// picks the article.
const RIGHTS = [
  [1, 'ALLA MÄNNISKOR ÄR FÖDDA FRIA OCH LIKA I VÄRDE OCH RÄTTIGHETER. DE ÄR UTRUSTADE MED FÖRNUFT OCH SAMVETE OCH BÖR HANDLA GENTEMOT VARANDRA I EN ANDA AV BRODERSKAP.'],
  [3, 'VAR OCH EN HAR RÄTT TILL LIV, FRIHET OCH PERSONLIG SÄKERHET.'],
  [19, 'VAR OCH EN HAR RÄTT TILL ÅSIKTSFRIHET OCH YTTRANDEFRIHET. DENNA RÄTT INNEFATTAR FRIHET ATT UTAN INGREPP HYSA ÅSIKTER SAMT ATT SÖKA, TA EMOT OCH SPRIDA UPPLYSNINGAR OCH TANKAR GENOM VARJE SLAGS UTTRYCKSMEDEL OCH OBEROENDE AV TERRITORIELLA GRÄNSER.'],
  [26, 'VAR OCH EN HAR RÄTT TILL UTBILDNING. UTBILDNINGEN SKALL VARA KOSTNADSFRI, ÅTMINSTONE PÅ DE ELEMENTÄRA OCH GRUNDLÄGGANDE STADIERNA. ELEMENTARUNDERVISNING SKALL VARA OBLIGATORISK. YRKESUTBILDNING OCH TEKNISK UTBILDNING SKALL VARA ALLMÄNT TILLGÄNGLIG.'],
  [27, 'VAR OCH EN HAR RÄTT ATT FRITT DELTAGA I SAMHÄLLETS KULTURELLA LIV, ATT NJUTA AV KONST OCH ATT BLI DELAKTIG AV VETENSKAPENS FRAMSTEG OCH DESS FÖRDELAR.'],
] as const;
export function scheinRights(h: number, article: number) {
  const seed = 1997 + article * 7, PX = 100, W = 960, foot = 0.6, H = Math.round((h + foot) * PX), [c, x] = canvas(W, H);
  const r = rng(seed), Y = (y: number) => H - (y + foot) * PX, t = 0.15 * PX;
  x.fillStyle = '#4a4a48'; x.fillRect(0, Y(0), W, foot * PX);
  x.fillStyle = '#c9c7c0'; x.fillRect(0, 0, W, Y(0));
  for (let i = 0; i * t < W; i++) for (let j = 0; (j + 1) * 0.15 <= h + 1e-6; j++) {
    const v = 236 + Math.floor(r() * 10);
    x.fillStyle = `rgb(${v},${v},${v - 4})`; x.fillRect(i * t + 1, Y((j + 1) * 0.15) + 1, t - 2, t - 2);
  }
  // the red line, and the top row of tiles over it
  x.fillStyle = '#b8231c'; x.fillRect(0, Y(h - 0.12), W, 0.05 * PX);
  // the article, two letters to a tile, a line of text to each row of tiles from 0.6 m up
  const [num, text] = RIGHTS[article % RIGHTS.length];
  x.fillStyle = '#1d1d1f'; x.font = `500 ${0.1 * PX}px "Helvetica Neue", Arial, sans-serif`;
  x.textBaseline = 'middle'; x.textAlign = 'center';
  const per = W / 7.5, rows = Math.floor((h - 0.75) / 0.15);
  let k = Math.floor(r() * text.length);
  for (let j = 0; j < rows; j++) for (let i = 0; i < per; i++) {
    x.fillText(text[k++ % text.length], (i + 0.5) * 7.5, Y(0.6 + (j + 0.5) * 0.15));
  }
  // the number, in a field of plain tiles
  const nx = (0.6 + r() * 8) * PX, ny = Y(1.6 + r() * Math.max(0, h - 2.6));
  x.fillStyle = 'rgb(240,240,236)'; x.fillRect(nx - 0.45 * PX, ny - 0.4 * PX, 0.9 * PX, 0.75 * PX);
  x.fillStyle = '#1d1d1f'; x.font = `600 ${0.5 * PX}px "Helvetica Neue", Arial, sans-serif`;
  x.fillText(String(num), nx, ny);
  // the journeys in blue: routes wandering across, a coast, figures and plants on fields of white
  x.strokeStyle = '#2b4fa0'; x.fillStyle = '#2b4fa0'; x.lineWidth = 1.6; x.lineCap = 'round';
  for (let m = 0; m < 10; m++) {
    const cx = (0.4 + r() * 8.8) * PX, cy = Y(1 + r() * Math.max(0.2, h - 1.8)), s = (0.25 + r() * 0.3) * PX;
    x.fillStyle = 'rgb(240,240,236)'; x.fillRect(cx - s, cy - s * 0.8, s * 2, s * 1.6);
    x.fillStyle = '#2b4fa0';
    const kind = m % 3;
    x.beginPath();
    if (kind === 0) {
      // a figure
      x.arc(cx, cy - s * 0.45, s * 0.14, 0, Math.PI * 2);
      x.moveTo(cx, cy - s * 0.3); x.lineTo(cx, cy + s * 0.2);
      x.moveTo(cx - s * 0.35, cy - s * 0.1); x.lineTo(cx + s * 0.35, cy - s * 0.15);
      x.moveTo(cx, cy + s * 0.2); x.lineTo(cx - s * 0.25, cy + s * 0.65);
      x.moveTo(cx, cy + s * 0.2); x.lineTo(cx + s * 0.25, cy + s * 0.65);
    } else if (kind === 1) {
      // a plant
      x.moveTo(cx, cy + s * 0.7); x.quadraticCurveTo(cx + s * 0.2, cy, cx, cy - s * 0.7);
      for (let l = 0; l < 4; l++) {
        const ly = cy + s * (0.4 - l * 0.3), d = l % 2 ? 1 : -1;
        x.moveTo(cx + s * 0.05, ly); x.quadraticCurveTo(cx + d * s * 0.5, ly - s * 0.25, cx + d * s * 0.2, ly - s * 0.4);
      }
    } else {
      // a stretch of coast
      x.moveTo(cx - s, cy);
      for (let q = 0; q < 12; q++) x.lineTo(cx - s + (q + 1) * s / 6, cy + (r() - 0.5) * s * 0.7);
    }
    x.stroke();
  }
  speckle(x, W, H, 1500, 0.06, seed + 7);
  return toTexture(c);
}

// One of Schein's panels of Linnaeus's journeys on the cores' sides: teal glazed tiles, 15 cm, a
// map's coasts and the dotted line of a journey in white, little drawings and lines of writing,
// in a frame of brushed steel, and beside it a panel of steel perforated with large holes.
// 8.4 × 2.6 m, the map panel 5.6 m of it.
export function linnePanel(seed: number) {
  const PX = 100, W = 840, H = 260, [c, x] = canvas(W, H), r = rng(seed);
  const M = 560, f = 0.06 * PX, t = 0.15 * PX;
  x.fillStyle = '#c3c6c6'; x.fillRect(0, 0, M, H);
  x.fillStyle = '#9fa4a6'; x.fillRect(f * 0.5, f * 0.5, M - f, H - f);
  x.fillStyle = '#9fb4ae'; x.fillRect(f, f, M - 2 * f, H - 2 * f);
  for (let i = 0; f + i * t < M - f; i++) for (let j = 0; f + j * t < H - f; j++) {
    const v = Math.floor(r() * 22);
    x.fillStyle = `rgb(${24 + v},${118 + v},${104 + v})`;
    x.fillRect(f + i * t + 1, f + j * t + 1, Math.min(t - 2, M - f - (f + i * t) - 1), Math.min(t - 2, H - f - (f + j * t) - 1));
  }
  // the map: a long coast down the middle with islands, in white
  x.strokeStyle = 'rgba(240,244,240,0.9)'; x.lineWidth = 2; x.lineJoin = 'round';
  const x0 = (0.6 + r() * 1.6) * PX;
  x.beginPath(); x.moveTo(x0, f + 6);
  for (let y = f + 6; y < H - f - 6; y += 8) x.lineTo(x0 + Math.sin(y / 23 + seed) * 18 + (r() - 0.5) * 10 + (y - f) * 0.5, y);
  x.stroke();
  for (let k = 0; k < 7; k++) {
    const ix = x0 + 30 + r() * 120, iy = f + 20 + r() * (H - 2 * f - 40);
    x.beginPath(); x.ellipse(ix, iy, 3 + r() * 9, 2 + r() * 5, r() * 3, 0, Math.PI * 2); x.stroke();
  }
  // the journey, dotted, and its places
  x.fillStyle = 'rgba(245,245,240,0.95)';
  let px = x0 + 20, py = H - f - 20;
  for (let k = 0; k < 90; k++) {
    px += 2.5 + r() * 2; py += (r() - 0.62) * 6;
    if (px > M - f - 12 || py < f + 10) break;
    x.beginPath(); x.arc(px, Math.min(H - f - 8, py), 1.6, 0, Math.PI * 2); x.fill();
    if (k % 18 === 9) { x.beginPath(); x.arc(px, py, 4, 0, Math.PI * 2); x.fill(); }
  }
  // drawings in black, and lines of writing in white
  x.strokeStyle = 'rgba(20,28,26,0.85)'; x.lineWidth = 1.6;
  for (let k = 0; k < 4; k++) {
    const dx = (2.6 + k * 0.7 + r() * 0.3) * PX, dy = f + 30 + r() * (H - 2 * f - 60), s = 14 + r() * 10;
    x.beginPath();
    if (k % 2) { x.moveTo(dx - s, dy + s); x.lineTo(dx, dy - s); x.lineTo(dx + s, dy + s); x.closePath(); }
    else { x.rect(dx - s, dy - s * 0.6, s * 2, s * 1.2); x.moveTo(dx - s, dy - s * 0.6); x.lineTo(dx + s, dy + s * 0.6); }
    x.stroke();
  }
  x.strokeStyle = 'rgba(236,240,236,0.8)'; x.lineWidth = 1.1;
  for (let k = 0; k < 14; k++) {
    const lx = (3.6 + r() * 1.2) * PX, ly = f + 14 + k * 15;
    if (ly > H - f - 10) break;
    x.beginPath(); x.moveTo(lx, ly);
    for (let q = 0; q < 20; q++) x.lineTo(lx + q * 3.5, ly + (r() - 0.5) * 4);
    x.stroke();
  }
  // the perforated panel, standing on its own a little beyond
  const P0 = M + 0.2 * PX;
  const g = x.createLinearGradient(P0, 0, W, 0);
  g.addColorStop(0, '#a9adb0'); g.addColorStop(0.5, '#c7cbcd'); g.addColorStop(1, '#9ea2a5');
  x.fillStyle = g; x.fillRect(P0, 0, W - P0, H);
  x.fillStyle = '#4a4c4e';
  for (let j = 0; j < 14; j++) for (let i = 0; i < 14; i++) {
    const hx = P0 + 12 + i * 17 + (j % 2) * 8.5, hy = 12 + j * 17.5;
    if (hx > W - 8 || hy > H - 8) continue;
    x.beginPath(); x.arc(hx, hy, 5.5, 0, Math.PI * 2); x.fill();
  }
  // (between the two, nothing: the rock shows through)
  x.clearRect(M, 0, P0 - M, H);
  return toTexture(c, { repeat: false });
}

// Small square tiles, 10 cm, a pale lilac grey, in pale joints, `w` × `h` m (the north core's end
// at Universitetet, behind the emergency exit's block).
export function lilacTiles(w: number, h: number) {
  const PX = 50, W = Math.round(w * PX), H = Math.round(h * PX), [c, x] = canvas(W, H), r = rng(1975);
  x.fillStyle = '#bdb8bd'; x.fillRect(0, 0, W, H);
  const t = 0.1 * PX;
  for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
    const v = Math.floor(r() * 16);
    x.fillStyle = `rgb(${176 + v},${164 + v},${178 + v})`; x.fillRect(i * t + 0.5, j * t + 0.5, t - 1, t - 1);
  }
  x.fillStyle = '#58565a'; x.fillRect(0, H - 0.12 * PX, W, 0.12 * PX);
  return toTexture(c, { repeat: false });
}

// The emergency exit's block at Universitetet's north end: glossy red tiles, 15 cm; on its face
// towards the platform two pairs of green doors with the white running man, a green sign over
// each; up to a ragged edge `top` m up, the rock above it. One face, `w` × `h` m; `doors` 2 for
// the face with the pairs, 1 for a single red door, 0 for none.
export function exitBlock(w: number, h: number, top: number, doors: number, seed: number) {
  const PX = 100, W = Math.round(w * PX), H = Math.round(h * PX), [c, x] = canvas(W, H), r = rng(seed);
  const Y = (y: number) => H - y * PX;
  x.fillStyle = '#a9a4a0'; x.fillRect(0, 0, W, H);
  speckle(x, W, H, 2500, 0.15, seed);
  // the tiles, up to a ragged edge
  const edge: number[] = [];
  for (let i = 0; i <= W; i += 10) edge.push(top - 0.05 - r() * 0.15 - (r() < 0.1 ? r() * 0.25 : 0));
  x.fillStyle = '#8e2a20';
  x.beginPath(); x.moveTo(0, Y(0));
  edge.forEach((e, k) => x.lineTo(k * 10, Y(e)));
  x.lineTo(W, Y(0)); x.closePath(); x.fill();
  x.save(); x.clip();
  const t = 0.15 * PX;
  for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
    const v = Math.floor(r() * 18);
    x.fillStyle = `rgb(${200 + v},${44 + v / 2},${30 + v / 2})`; x.fillRect(i * t + 0.75, Y((j + 1) * 0.15) + 0.75, t - 1.5, t - 1.5);
  }
  x.restore();
  const door = (cx: number, dw: number, color: string, man: boolean) => {
    x.fillStyle = '#3a3a38'; x.fillRect(cx - dw / 2 - 3, Y(2.15), dw + 6, 2.15 * PX);
    x.fillStyle = color; x.fillRect(cx - dw / 2, Y(2.1), dw, 2.1 * PX);
    if (!man) return;
    x.fillStyle = '#20231f'; x.fillRect(cx - 1, Y(2.1), 2, 2.1 * PX);
    // the running man on each leaf
    for (const lx of [cx - dw / 4, cx + dw / 4]) {
      x.fillStyle = '#e8ece6';
      x.beginPath(); x.arc(lx - 4, Y(1.6), 0.09 * PX, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#e8ece6'; x.lineWidth = 0.09 * PX; x.lineCap = 'round';
      x.beginPath();
      x.moveTo(lx - 6, Y(1.42)); x.lineTo(lx + 2, Y(1.0));
      x.moveTo(lx - 4, Y(1.38)); x.lineTo(lx - 22, Y(1.2)); x.moveTo(lx - 4, Y(1.38)); x.lineTo(lx + 14, Y(1.28));
      x.moveTo(lx + 2, Y(1.0)); x.lineTo(lx - 14, Y(0.62)); x.moveTo(lx + 2, Y(1.0)); x.lineTo(lx + 18, Y(0.72));
      x.stroke();
    }
  };
  if (doors === 2) {
    for (const f of [0.3, 0.7]) {
      door(W * f, 1.75 * PX, '#2d7a3c', true);
      x.fillStyle = '#2fae4a'; x.fillRect(W * f - 0.3 * PX, Y(3.15), 0.6 * PX, 0.2 * PX);
      x.fillStyle = '#eef6ee'; x.fillRect(W * f - 0.12 * PX, Y(3.07), 0.24 * PX, 0.04 * PX);
    }
  } else if (doors === 1) door(W * 0.3, 0.9 * PX, '#8f231b', false);
  return toTexture(c, { repeat: false });
}

// The deep blue wall west of the lobby at Universitetet's south end (Schein's, 1997): glossy
// tiles, 15 cm, blues mottled, and on them in white "To write the human rights" over lines of
// smaller writing. 4.8 × 3.6 m.
export function scheinBlue() {
  const PX = 100, W = 480, H = 360, [c, x] = canvas(W, H), r = rng(1948);
  x.fillStyle = '#9aa3b8'; x.fillRect(0, 0, W, H);
  const t = 0.15 * PX;
  for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
    const v = Math.floor(r() * 30);
    x.fillStyle = `rgb(${18 + v / 2},${48 + v},${128 + v * 1.5})`; x.fillRect(i * t + 1, j * t + 1, t - 2, t - 2);
  }
  x.fillStyle = '#26282c'; x.fillRect(0, H - 0.1 * PX, W, 0.1 * PX);
  x.fillStyle = 'rgba(240,244,250,0.92)'; x.font = `500 ${0.1 * PX}px "Helvetica Neue", Arial, sans-serif`;
  x.textBaseline = 'middle'; x.fillText('TO WRITE THE HUMAN RIGHTS', 0.9 * PX, H - 2.3 * PX);
  x.strokeStyle = 'rgba(236,240,248,0.85)'; x.lineWidth = 1.2;
  for (let k = 0; k < 8; k++) {
    const ly = H - 2.12 * PX + k * 0.08 * PX, lx = 0.9 * PX, len = (1.6 + r() * 0.6) * PX;
    x.beginPath(); x.moveTo(lx, ly);
    for (let q = 0; q * 3 < len; q++) x.lineTo(lx + q * 3, ly + (r() - 0.5) * 3);
    x.stroke();
  }
  return toTexture(c);
}


// Bergshamra's "Röster från det förflutna" (Göran Dahl, Carl Johan De Geer and Kristina Anshelm,
// 1978), on the cores' sides: a row of `n` panels of black glass, each 1.35 m wide and 2.2 m high,
// in frames of brushed steel, the dark rock showing through them, painted over several panels at
// a time (photographs, 2009–2016): a yellow bus, a green serpent with runes along it as on a rune
// stone, a green fish scaled in yellow, red drops along the top. `seed`: which and where.
export function bergshamraGlass(n: number, seed: number) {
  const PX = 80, W = Math.round(n * 1.35 * PX), H = Math.round(2.2 * PX), [c, x] = canvas(W, H), r = rng(seed);
  const L = W / PX;
  x.fillStyle = '#17181a'; x.fillRect(0, 0, W, H);
  for (let k = 0; k < n * 70; k++) {
    const v = Math.floor(r() * 22);
    x.fillStyle = r() < 0.5 ? `rgba(${44 + v},${44 + v},${46 + v},0.4)` : `rgba(4,4,5,0.35)`;
    x.beginPath(); x.ellipse(r() * W, r() * H, 4 + r() * 18, 3 + r() * 9, r() * Math.PI, 0, Math.PI * 2); x.fill();
  }
  // (in metres from the bottom left)
  x.save(); x.setTransform(PX, 0, 0, -PX, 0, H);
  const yellow = '#e2cd2b', green = '#207b36', dark = '#17181a';
  x.lineJoin = 'round'; x.lineCap = 'round';
  const bus = (bx: number, bw: number) => {
    // the body, filled, with a sloping front to the right; windows, a door and the wheels' arches
    // left dark
    x.fillStyle = yellow;
    x.beginPath(); x.moveTo(bx, 0.45); x.lineTo(bx + bw, 0.45); x.lineTo(bx + bw, 1.3); x.lineTo(bx + bw - 0.35, 1.85); x.lineTo(bx + 0.1, 1.85); x.lineTo(bx, 1.75); x.closePath(); x.fill();
    x.fillStyle = dark;
    const nw = Math.max(3, Math.round((bw - 1.2) / 0.85));
    for (let k = 0; k < nw; k++) x.fillRect(bx + 0.3 + k * ((bw - 1.3) / nw), 1.22, (bw - 1.3) / nw - 0.14, 0.48);
    x.beginPath(); x.moveTo(bx + bw - 0.85, 1.22); x.lineTo(bx + bw - 0.12, 1.22); x.lineTo(bx + bw - 0.38, 1.7); x.lineTo(bx + bw - 0.85, 1.7); x.closePath(); x.fill();
    x.fillRect(bx + bw - 1.6, 0.6, 0.5, 1.0);
    for (const wx of [bx + 0.95, bx + bw - 0.75]) {
      x.fillStyle = dark; x.beginPath(); x.arc(wx, 0.45, 0.42, 0, Math.PI); x.fill();
      x.strokeStyle = yellow; x.lineWidth = 0.08; x.beginPath(); x.arc(wx, 0.42, 0.3, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.arc(wx, 0.42, 0.08, 0, Math.PI * 2); x.stroke();
    }
  };
  const serpent = (x0: number, x1: number, y: number, amp: number, phase: number) => {
    const pts: [number, number][] = [];
    for (let t = 0; t <= 1.0001; t += 0.01) pts.push([x0 + (x1 - x0) * t, y + amp * Math.sin(phase + t * Math.PI * 2.4) * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.6)))]);
    const path = () => { x.beginPath(); pts.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py))); };
    x.strokeStyle = green; x.lineWidth = 0.24; path(); x.stroke();
    x.strokeStyle = yellow; x.lineWidth = 0.03; path(); x.stroke();
    // the runes along it: staves with their twigs, dark on the green
    x.strokeStyle = '#0d2913'; x.lineWidth = 0.022;
    for (let k = 2; k < pts.length - 6; k += 2) {
      const [ax, ay] = pts[k], [bx, by] = pts[k + 1], d = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / d, ny = (bx - ax) / d;
      x.beginPath(); x.moveTo(ax - nx * 0.08, ay - ny * 0.08); x.lineTo(ax + nx * 0.08, ay + ny * 0.08);
      const tw = r();
      if (tw < 0.6) { x.moveTo(ax + nx * 0.03, ay + ny * 0.03); x.lineTo(ax + nx * 0.08 + (bx - ax) * 0.6, ay + ny * 0.08 + (by - ay) * 0.6); }
      if (tw > 0.4) { x.moveTo(ax - nx * 0.02, ay - ny * 0.02); x.lineTo(ax - nx * 0.07 + (bx - ax) * 0.6, ay - ny * 0.07 + (by - ay) * 0.6); }
      x.stroke();
    }
    // the head at its far end, an eye in it, and the tail tapering at its start
    const [hx, hy] = pts[pts.length - 1], [px, py] = pts[pts.length - 4], a = Math.atan2(hy - py, hx - px);
    x.save(); x.translate(hx, hy); x.rotate(a);
    x.fillStyle = green; x.beginPath(); x.ellipse(0.12, 0, 0.3, 0.17, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = yellow; x.lineWidth = 0.035; x.beginPath(); x.moveTo(0.2, -0.04); x.lineTo(0.42, -0.02); x.stroke();
    x.fillStyle = yellow; x.beginPath(); x.arc(0.14, 0.06, 0.045, 0, Math.PI * 2); x.fill();
    x.restore();
  };
  const fish = (fx: number, fy: number, s: number, dir: number) => {
    x.save(); x.translate(fx, fy); x.scale(dir * s, s);
    x.fillStyle = green;
    x.beginPath(); x.ellipse(0, 0, 0.62, 0.3, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(-0.5, 0); x.lineTo(-0.95, 0.3); x.lineTo(-0.85, 0); x.lineTo(-0.95, -0.3); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(-0.1, 0.26); x.lineTo(0.15, 0.45); x.lineTo(0.25, 0.25); x.closePath(); x.fill();
    x.strokeStyle = yellow; x.lineWidth = 0.035;
    for (let i = 0; i < 5; i++) for (let j = -1; j <= 1; j++) {
      const sx = -0.32 + i * 0.13, sy = j * 0.12 + (i % 2) * 0.06;
      if ((sx / 0.6) ** 2 + (sy / 0.27) ** 2 > 0.8) continue;
      x.beginPath(); x.arc(sx, sy, 0.065, -Math.PI / 2, Math.PI / 2); x.stroke();
    }
    x.beginPath(); x.arc(0.38, 0.06, 0.07, 0, Math.PI * 2); x.stroke();
    x.fillStyle = dark; x.beginPath(); x.arc(0.39, 0.06, 0.03, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(0.62, -0.02); x.lineTo(0.48, -0.08); x.stroke();
    x.restore();
  };
  const k = seed % 3;
  if (k === 0) {
    bus(0.25, Math.min(6.2, L * 0.62));
    serpent(0.1, L - 0.4, 0.95, 0.35, 0.3);
    fish(Math.min(4.3, L * 0.45), 1.05, 1, 1);
  } else if (k === 1) {
    serpent(0.2, L - 0.3, 1.1, 0.55, 2);
    fish(L * 0.3, 0.75, 0.9, -1);
    fish(L * 0.72, 1.45, 0.7, 1);
  } else {
    bus(L * 0.4, Math.min(5.4, L * 0.55));
    fish(L * 0.2, 1.2, 1.2, 1);
    serpent(0.3, L * 0.95, 0.7, 0.25, 4);
  }
  // red drops along the top
  x.fillStyle = '#c4321e';
  for (let px = 0.1; px < L - 0.2; px += 0.25 + r() * 0.6) {
    if (r() < 0.35) continue;
    const w = 0.15 + r() * 0.45;
    x.beginPath(); x.moveTo(px, 2.12); x.lineTo(px + w, 2.12); x.lineTo(px + w, 2.02);
    x.quadraticCurveTo(px + w * 0.6, 1.98 - r() * 0.1, px + w / 2, 1.9 - r() * 0.12);
    x.quadraticCurveTo(px + w * 0.4, 2.0, px, 2.0); x.closePath(); x.fill();
  }
  x.restore();
  // a sheen on each pane, and the frames
  for (let p = 0; p < n; p++) {
    const g = x.createLinearGradient(p * 1.35 * PX, 0, (p + 1) * 1.35 * PX, H);
    g.addColorStop(0, 'rgba(255,255,255,0.07)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.04)');
    x.fillStyle = g; x.fillRect(p * 1.35 * PX, 0, 1.35 * PX, H);
  }
  x.fillStyle = '#a2a7aa';
  for (let p = 0; p <= n; p++) x.fillRect(Math.min(W - 4, Math.max(0, p * 1.35 * PX - 2)), 0, 4, H);
  x.fillRect(0, 0, W, 3); x.fillRect(0, H - 4, W, 4);
  return toTexture(c, { repeat: false });
}

// Slabs of dark natural stone, greys and browns, mottled and veined, set in a band in the cores'
// sides at Bergshamra over a pale plinth, the rock between them; `w` × `h` m, the joints left
// clear for the rock to show.
export function bergshamraStones(w: number, h: number, seed: number) {
  const PX = 80, W = Math.round(w * PX), H = Math.round(h * PX), [c, x] = canvas(W, H), r = rng(seed);
  x.clearRect(0, 0, W, H);
  const cols = ['#4b4743', '#58534d', '#3f3d3a', '#5f5a53', '#4f4b4a', '#665f56'];
  let x0 = 0;
  while (x0 < W - 0.3 * PX) {
    const cw = Math.min(W - x0, (0.7 + r() * 0.9) * PX), rows = r() < 0.55 ? 1 : 2;
    let y0 = 0;
    for (let j = 0; j < rows; j++) {
      const ch = j + 1 === rows ? H - y0 : H * (0.4 + r() * 0.2);
      const g = 0.025 * PX + r() * 0.03 * PX, jig = () => (r() - 0.5) * 0.08 * PX;
      const quad: [number, number][] = [[x0 + g + jig(), y0 + g + jig()], [x0 + cw - g + jig(), y0 + g + jig()], [x0 + cw - g + jig(), y0 + ch - g + jig()], [x0 + g + jig(), y0 + ch - g + jig()]];
      x.save();
      x.beginPath(); quad.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath();
      x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fill();
      x.clip();
      for (let k = 0; k < (cw * ch) / 60; k++) {
        const v = Math.floor(r() * 60);
        x.fillStyle = r() < 0.5 ? `rgba(${110 + v},${104 + v},${96 + v},0.35)` : `rgba(20,18,16,0.3)`;
        x.fillRect(x0 + r() * cw, y0 + r() * ch, 1 + r() * 3, 1 + r() * 3);
      }
      x.strokeStyle = 'rgba(190,184,172,0.35)'; x.lineWidth = 1 + r() * 2;
      for (let k = 0; k < 2; k++) {
        x.beginPath(); let vx = x0 + r() * cw, vy = y0;
        x.moveTo(vx, vy);
        while (vy < y0 + ch) { vx += (r() - 0.5) * 18; vy += 8 + r() * 10; x.lineTo(vx, vy); }
        x.stroke();
      }
      const gl = x.createLinearGradient(x0, y0, x0 + cw, y0 + ch);
      gl.addColorStop(0, 'rgba(255,255,255,0.1)'); gl.addColorStop(1, 'rgba(0,0,0,0.12)');
      x.fillStyle = gl; x.fillRect(x0, y0, cw, ch);
      x.restore();
      y0 += ch;
    }
    x0 += cw;
  }
  return toTexture(c, { repeat: false });
}

// Bergshamra's panels of photographs in black and white behind glass, in black frames: `kind` 0,
// a collage 8 × 2.2 m of scenes of the city (a harbour, a road curving into the distance,
// blocks of flats, people), and then two panes of chevrons in pale greys with little figures
// drawn over them; 1, a man in a long coat standing, 1.4 × 2.4 m; 2, a landscape of trees by
// water, dim, 5.2 × 2 m. Drawn in code, after the photographs of them (2015–2026).
export function bergshamraPhotos(kind: number) {
  const PX = 90, [w, h] = [[8, 2.2], [1.4, 2.4], [5.2, 2]][kind], W = Math.round(w * PX), H = Math.round(h * PX), [c, x] = canvas(W, H), r = rng(1978 + kind);
  const f = 0.06 * PX;
  x.fillStyle = '#111213'; x.fillRect(0, 0, W, H);
  const grey = (v: number) => `rgb(${v},${v},${v})`;
  const scene = (x0: number, x1: number, y0: number, y1: number, k: number) => {
    x.save(); x.beginPath(); x.rect(x0, y0, x1 - x0, y1 - y0); x.clip();
    const g = x.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, grey(200 - k * 10)); g.addColorStop(1, grey(120 + k * 8));
    x.fillStyle = g; x.fillRect(x0, y0, x1 - x0, y1 - y0);
    const hz = y0 + (y1 - y0) * (0.35 + r() * 0.25);
    if (k % 3 === 0) {
      // a harbour: water, a quay, boats and cranes
      x.fillStyle = grey(95); x.fillRect(x0, hz, x1 - x0, y1 - hz);
      for (let q = 0; q < 6; q++) { x.fillStyle = grey(40 + r() * 40); const bx = x0 + r() * (x1 - x0), bw = 20 + r() * 50; x.fillRect(bx, hz + 6 + r() * 30, bw, 8 + r() * 6); x.fillRect(bx + bw * 0.3, hz - 10 - r() * 16, 4, 20); }
      x.strokeStyle = grey(60); x.lineWidth = 3; x.beginPath(); x.moveTo(x0 + 20, hz); x.lineTo(x0 + 30, hz - 60); x.lineTo(x0 + 90, hz - 60); x.stroke();
    } else if (k % 3 === 1) {
      // a road curving into the distance
      x.fillStyle = grey(70); x.fillRect(x0, hz, x1 - x0, y1 - hz);
      x.fillStyle = grey(165);
      x.beginPath(); x.moveTo(x0 + (x1 - x0) * 0.2, y1); x.quadraticCurveTo(x0 + (x1 - x0) * 0.9, hz + 40, x0 + (x1 - x0) * 0.55, hz);
      x.lineTo(x0 + (x1 - x0) * 0.6, hz); x.quadraticCurveTo(x1 + 40, hz + 50, x1, y1); x.closePath(); x.fill();
      x.strokeStyle = grey(240); x.setLineDash([8, 10]); x.lineWidth = 2;
      x.beginPath(); x.moveTo(x0 + (x1 - x0) * 0.6, y1); x.quadraticCurveTo(x1 - 20, hz + 45, x0 + (x1 - x0) * 0.58, hz); x.stroke(); x.setLineDash([]);
    } else {
      // blocks of flats against the sky, people in front
      for (let q = 0; q < 7; q++) {
        const bx = x0 + q * (x1 - x0) / 7 + r() * 10, bw = (x1 - x0) / 8, bh = 40 + r() * 80, v = 60 + r() * 70;
        x.fillStyle = grey(v); x.fillRect(bx, hz - bh, bw, bh + (y1 - hz));
        x.fillStyle = grey(v + 50);
        for (let wy = hz - bh + 6; wy < y1 - 30; wy += 12) for (let wx = bx + 4; wx < bx + bw - 6; wx += 10) x.fillRect(wx, wy, 5, 6);
      }
      for (let q = 0; q < 5; q++) { const px = x0 + r() * (x1 - x0), py = y1 - 10 - r() * 20; x.fillStyle = grey(25); x.fillRect(px - 5, py - 40, 10, 40); x.beginPath(); x.arc(px, py - 47, 6, 0, Math.PI * 2); x.fill(); }
    }
    x.restore();
  };
  if (kind === 0) {
    const pw = (W - 2 * f) / 6;
    for (let p = 0; p < 4; p++) scene(f + p * pw + 2, f + (p + 1) * pw - 2, f, H - f, p);
    // the chevrons
    x.save(); x.beginPath(); x.rect(f + 4 * pw + 2, f, 2 * pw - 4, H - 2 * f); x.clip();
    x.fillStyle = grey(196); x.fillRect(f + 4 * pw, f, 2 * pw, H - 2 * f);
    x.strokeStyle = grey(150); x.lineWidth = 3;
    const d = 0.55 * PX;
    for (let q = -10; q < 20; q++) {
      x.beginPath(); x.moveTo(f + 4 * pw + q * d, f); x.lineTo(f + 4 * pw + q * d + (H - 2 * f), H - f); x.stroke();
      x.beginPath(); x.moveTo(f + 4 * pw + q * d, H - f); x.lineTo(f + 4 * pw + q * d + (H - 2 * f), f); x.stroke();
    }
    x.strokeStyle = grey(45); x.lineWidth = 1.6;
    for (let q = 0; q < 9; q++) {
      const px = f + 4 * pw + 20 + r() * (2 * pw - 40), py = f + 20 + r() * (H - 2 * f - 50), s = 6 + r() * 6;
      x.beginPath(); x.arc(px, py, s * 0.5, 0, Math.PI * 2); x.moveTo(px, py + s * 0.5); x.lineTo(px, py + s * 2); x.moveTo(px - s, py + s); x.lineTo(px + s, py + s * 1.2);
      x.moveTo(px, py + s * 2); x.lineTo(px - s * 0.7, py + s * 3); x.moveTo(px, py + s * 2); x.lineTo(px + s * 0.7, py + s * 3); x.stroke();
    }
    x.restore();
    x.fillStyle = '#111213';
    for (let p = 0; p <= 6; p++) x.fillRect(f + p * pw - 2, 0, 4, H);
  } else if (kind === 1) {
    const g = x.createLinearGradient(0, f, 0, H - f);
    g.addColorStop(0, grey(225)); g.addColorStop(1, grey(170));
    x.fillStyle = g; x.fillRect(f, f, W - 2 * f, H - 2 * f);
    // the man, in a dark coat, his head and hands pale
    const cx = W * 0.52;
    x.fillStyle = grey(38);
    x.beginPath(); x.moveTo(cx - 0.2 * PX, 0.5 * PX); x.lineTo(cx - 0.24 * PX, 1.75 * PX); x.lineTo(cx + 0.22 * PX, 1.75 * PX); x.lineTo(cx + 0.27 * PX, 0.5 * PX); x.closePath();
    x.translate(0, 0); x.fill();
    x.fillRect(cx - 0.12 * PX, 1.75 * PX, 0.08 * PX, 0.5 * PX); x.fillRect(cx + 0.05 * PX, 1.75 * PX, 0.08 * PX, 0.5 * PX);
    x.fillStyle = grey(200); x.beginPath(); x.arc(cx + 0.02 * PX, 0.36 * PX, 0.1 * PX, 0, Math.PI * 2); x.fill();
    x.fillStyle = grey(30); x.fillRect(cx - 0.08 * PX, 0.22 * PX, 0.2 * PX, 0.07 * PX);
    x.fillStyle = grey(190); x.fillRect(cx - 0.3 * PX, 1.2 * PX, 0.08 * PX, 0.1 * PX);
    x.fillStyle = grey(60); x.fillRect(cx - 0.18 * PX, 2.25 * PX, 0.36 * PX, 0.05 * PX);
  } else {
    // the landscape, dim behind the dark glass
    const g = x.createLinearGradient(0, f, 0, H - f);
    g.addColorStop(0, '#3a3e3d'); g.addColorStop(0.45, '#2b302e'); g.addColorStop(0.55, '#1d2221'); g.addColorStop(1, '#141716');
    x.fillStyle = g; x.fillRect(f, f, W - 2 * f, H - 2 * f);
    const hz = H * 0.52;
    for (let q = 0; q < 26; q++) {
      const tx = f + r() * (W - 2 * f), th = (0.3 + r() * 0.6) * PX, tw = (0.15 + r() * 0.3) * PX, v = 20 + r() * 25;
      x.fillStyle = `rgb(${v},${v + 8},${v + 2})`;
      x.beginPath(); x.ellipse(tx, hz - th / 2, tw, th / 2, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = `rgba(${v},${v + 8},${v + 2},0.45)`;
      x.beginPath(); x.ellipse(tx, hz + th / 2, tw, th / 2, 0, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = 'rgba(160,170,168,0.18)';
    for (let q = 0; q < 30; q++) x.fillRect(f + r() * (W - 2 * f), hz + 4 + r() * (H - hz - f - 8), 20 + r() * 60, 1.5);
  }
  // the glass's sheen, and the frame
  const sh = x.createLinearGradient(0, 0, W, H);
  sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,0.05)');
  x.fillStyle = sh; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#0c0c0d'; x.lineWidth = f; x.strokeRect(f / 2, f / 2, W - f, H - f);
  return toTexture(c, { repeat: false });
}

// Rounded stones inlaid in Bergshamra's dark floor in drifts, reds, rust, beige and grey, and
// among them the white outline of a fossil fish: a square 6 m across, clear between them.
export function bergshamraInlay(seed: number) {
  const S = 1024, PX = S / 6, [c, x] = canvas(S, S), r = rng(seed);
  x.clearRect(0, 0, S, S);
  const cols = ['#963527', '#a6532c', '#c4ae86', '#86807a', '#6c2a21', '#b07a52'];
  // a drift along a curve across the square
  const a0 = r() * Math.PI;
  for (let k = 0; k < 110; k++) {
    const t = r(), along = (t - 0.5) * 5.4, off = (r() - 0.5) * (0.9 + Math.sin(t * Math.PI) * 1.1) + Math.sin(t * 5 + seed) * 0.5;
    const px = 3 + Math.cos(a0) * along - Math.sin(a0) * off, py = 3 + Math.sin(a0) * along + Math.cos(a0) * off;
    if (px < 0.15 || px > 5.85 || py < 0.15 || py > 5.85) continue;
    const rx = (0.03 + r() * 0.08) * (r() < 0.08 ? 2 : 1), ry = rx * (0.6 + r() * 0.4);
    x.fillStyle = cols[Math.floor(r() * cols.length)];
    x.beginPath(); x.ellipse(px * PX, py * PX, rx * PX, ry * PX, r() * Math.PI, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.12)';
    x.beginPath(); x.ellipse(px * PX - rx * PX * 0.25, py * PX - ry * PX * 0.3, rx * PX * 0.4, ry * PX * 0.3, 0, 0, Math.PI * 2); x.fill();
  }
  // the fossil: a fish's spine and ribs, its skull and tail, in white
  x.save(); x.translate((3 + Math.sin(a0) * 1.6) * PX, (3 - Math.cos(a0) * 1.6) * PX); x.rotate(a0 + 0.4); x.scale(PX, PX);
  x.strokeStyle = '#e9e6dd'; x.lineWidth = 0.035; x.lineCap = 'round';
  x.beginPath(); x.moveTo(-0.6, 0); x.quadraticCurveTo(0, -0.06, 0.55, 0); x.stroke();
  for (let k = 0; k < 11; k++) {
    const sx = -0.45 + k * 0.09, l = 0.22 * Math.sin(Math.PI * (k + 1) / 12);
    x.beginPath(); x.moveTo(sx, 0); x.lineTo(sx - 0.05, -l); x.moveTo(sx, 0); x.lineTo(sx - 0.05, l); x.stroke();
  }
  x.beginPath(); x.ellipse(0.66, 0, 0.13, 0.1, 0, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.moveTo(-0.6, 0); x.lineTo(-0.82, -0.18); x.moveTo(-0.6, 0); x.lineTo(-0.82, 0.18); x.moveTo(-0.82, -0.18); x.lineTo(-0.82, 0.18); x.stroke();
  x.restore();
  return toTexture(c, { repeat: false });
}

// Small square tiles, 10 cm, glossy violet blues in dark joints (1.2 m square): the block round
// Bergshamra's lifts at the platform's north end.
export function violetTiles() {
  const PX = 80, W = 96, H = 96, [c, x] = canvas(W, H), r = rng(1979);
  x.fillStyle = '#2a2a44'; x.fillRect(0, 0, W, H);
  const t = 0.1 * PX;
  for (let i = 0; i * t < W; i++) for (let j = 0; j * t < H; j++) {
    const v = Math.floor(r() * 30), hue = r();
    x.fillStyle = hue < 0.6 ? `rgb(${70 + v},${64 + v},${150 + v})` : hue < 0.85 ? `rgb(${86 + v},${70 + v},${160 + v})` : `rgb(${50 + v},${58 + v},${138 + v})`;
    x.fillRect(i * t + 0.6, j * t + 0.6, t - 1.2, t - 1.2);
    x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(i * t + 1, j * t + 1, t * 0.4, 1);
  }
  return toTexture(c);
}
