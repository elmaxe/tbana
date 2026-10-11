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
export function nameSign(text: string, bg = '#0c4da2') {
  const [c, x] = canvas(1024, 192);
  x.fillStyle = bg; x.fillRect(0, 0, 1024, 192);
  x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 6; x.strokeRect(10, 10, 1004, 172);
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

// A navy enamel name plate 0.63 × 0.09 m, centred on the origin, `scale` px to the metre:
// the name in white capitals, spaced out.
function drawNamePlate(x: CanvasRenderingContext2D, text: string, scale: number) {
  const w = 0.63 * scale, h = 0.09 * scale;
  x.fillStyle = '#1d2c5e';
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
  | { kind: 'cracks'; colors: string[]; from: number; to: number; count: number };

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

// The plinth round the pillars: small cream tiles, 0.15 m square (the texture covers 1.2 m).
export function stadionPlinth() {
  const [c, x] = canvas(384);
  x.fillStyle = '#a9a294'; x.fillRect(0, 0, 384, 384);
  const r = rng(177);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    const v = 222 + Math.floor(r() * 12);
    x.fillStyle = `rgb(${v},${v - 6},${v - 22})`;
    x.fillRect(i * 48 + 1.5, j * 48 + 1.5, 45, 45);
  }
  speckle(x, 384, 384, 1500, 0.08, 178);
  return toTexture(c);
}

// The ceiling: black expanded steel mesh between dark beams across the hall every 1.5 m (the
// texture covers 1.5 × 1.5 m, the beam along its top edge: v along the track).
export function stadionCeiling() {
  const [c, x] = canvas(256);
  x.fillStyle = '#1e2023'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#4a4d52'; x.lineWidth = 2;
  const p = 12;
  for (let k = -256; k < 512; k += p) {
    x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 256, 256); x.stroke();
    x.beginPath(); x.moveTo(k, 256); x.lineTo(k + 256, 0); x.stroke();
  }
  x.fillStyle = '#383a3e'; x.fillRect(0, 0, 256, 14);
  x.fillStyle = '#5a5d62'; x.fillRect(0, 14, 256, 2);
  return toTexture(c);
}

// Panels of green expanded steel mesh, on posts 1.2 m apart (the texture covers 1.2 × 1.2 m, a
// post along its left edge), the dark rock showing through between the strands.
export function stadionMesh() {
  const [c, x] = canvas(256);
  x.fillStyle = '#1d3a36'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#5fb3a3'; x.lineWidth = 2.6;
  const p = 256 / 24;
  for (let k = -24; k <= 48; k++) {
    x.beginPath(); x.moveTo(k * p, 0); x.lineTo(k * p + 128, 256); x.stroke();
    x.beginPath(); x.moveTo(k * p, 256); x.lineTo(k * p + 128, 0); x.stroke();
  }
  x.fillStyle = '#4fa595'; x.fillRect(0, 0, 9, 256);
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(9, 0, 3, 256);
  return toTexture(c);
}

// How far round from the foot of a cave's paint (caveRock) the pillars' paint starts at the
// platform.
export const STADION_FOOT = 1.6;
const RAINBOW = ['#d8321e', '#ee7a1c', '#f2cf2a', '#4aa83a', '#1f9a8a', '#2f6fd0', '#2a3a9a'];

// The wall over one of the passage's openings, as seen from the passage: the pillars' sky-blue
// rock, and round the opening a rainbow, its seven bands `band` m wide. `w` m along and `h` m up
// from the platform; the opening `inset` in from each end with its crown `crown` high. With
// `redInside`, the red band is the inner one.
export function stadionPortal(w: number, h: number, inset: number, crown: number, band: number, redInside: boolean, paint: CavePaint) {
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
  const colours = redInside ? [...RAINBOW].reverse() : RAINBOW;
  const r = rng(179), ph = [r() * 6, r() * 6];
  for (let k = colours.length; k >= 1; k--) {
    x.fillStyle = colours[colours.length - k];
    x.beginPath();
    const n = 90;
    for (let i = 0; i <= n; i++) {
      // (wavering a little, as brushed over the lumps)
      const t = Math.PI * (i / n), wob = 1 + 0.025 * Math.sin(t * 7 + ph[0] + k * 0.3) + 0.015 * Math.sin(t * 17 + ph[1]);
      const s = mid - Math.cos(t) * (hw + k * band) * wob, y = Math.sin(t) * (crown + k * band) * wob;
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
// sweep along the track, as Hötorget's: u up the wall, v along the track.
type Posters = { width: number; height: number; bottom: number; every: number; run: number; gap: number };
export const beamedWallRepeat = (p: Posters) => 3 * (p.run * p.every + p.gap);
export function beamedHallWall(height: number, color: number, tile: number, from: number, posters: Posters) {
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
  // the black band, its top edge a little paler
  x.fillStyle = '#1e1e1f'; x.fillRect(0, Y(from), W, from * PX);
  x.fillStyle = '#3a3a3b'; x.fillRect(0, Y(from), W, 2);
  speckle(x, W, from * PX, 900, 0.12, 1934, true);
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

// ------------------------------------------------------------------ styled open stations
// (src/open-styles.ts)

const css = (n: number, k = 0) => {
  const ch = (s: number) => Math.max(0, Math.min(255, ((n >> s) & 255) + k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// A styled open station's platform paving, u across from the edge (0) to PAVING_ACROSS m in (1),
// v along it, PAVING_REPEAT m a repeat: the edge stones, the ribbed strip for the blind, pale
// slabs, then pavers.
export const PAVING_ACROSS = 8, PAVING_REPEAT = 2.4;
export function openPaving(p: Paving) {
  const PX = 100, W = PAVING_ACROSS * PX, H = PAVING_REPEAT * PX, [c, x] = canvas(W, H);
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
    for (let k = 0.04; k < t1 - t0 - 0.02; k += 0.06) for (let j = 0.03; j < PAVING_REPEAT; j += 0.06) {
      x.fillStyle = css(C.tactile, -24); x.beginPath(); x.arc((t0 + k) * PX + 0.6, j * PX + 0.6, 0.013 * PX, 0, Math.PI * 2); x.fill();
      x.fillStyle = css(C.tactile, 22); x.beginPath(); x.arc((t0 + k) * PX, j * PX, 0.011 * PX, 0, Math.PI * 2); x.fill();
    }
  } else {
    for (let k = 0.04; k < t1 - t0 - 0.02; k += 0.06) {
      x.fillStyle = css(C.tactile, 26); x.fillRect((t0 + k) * PX, 0, 0.025 * PX, H);
      x.fillStyle = css(C.tactile, -22); x.fillRect((t0 + k + 0.025) * PX, 0, 0.008 * PX, H);
    }
  }
  for (let j = 0; j <= H; j += 0.6 * PX) { x.fillStyle = joint; x.fillRect(t0 * PX, j - 1, (t1 - t0) * PX, 2); }
  // the edge stones, 60 cm long
  for (let j = 0; j * 0.6 * PX < H; j++) {
    x.fillStyle = css(C.edge, Math.floor(r() * 10) - 5);
    x.fillRect(0, j * 0.6 * PX + 1.5, p.edge * PX - 1.5, 0.6 * PX - 3);
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
export function chainLink() {
  const [c, x] = canvas(128);
  x.clearRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(176,182,186,1)'; x.lineWidth = 2.2;
  for (let k = -128; k <= 256; k += 12.8) {
    x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 128, 128); x.stroke();
    x.beginPath(); x.moveTo(k, 128); x.lineTo(k + 128, 0); x.stroke();
  }
  return toTexture(c);
}

// A railing of upright bars, black, 12 cm apart, between a top rail and a bottom one, over 1.2 m
// along it (u in metres / 1.2, v up it from 0 to 1); the gaps clear.
export function barRailing() {
  const W = 192, H = 128, [c, x] = canvas(W, H);
  x.clearRect(0, 0, W, H);
  x.fillStyle = '#1d1f21';
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
  pineBoards: [1.2, 1.2], redTiles: [1.2, 1.2], bronzeGlass: [1.5, 3.6],
};
export const FINISH_GLASS: Finish[] = ['clerestory', 'windows', 'glazed', 'darkGlazed', 'highWindows', 'greenWindows', 'checkWindows', 'tiledWindows', 'liftWindows', 'redWindows', 'blueGlazed', 'blueClerestory', 'steelFront', 'hallTiles', 'glassFront', 'tealWindows', 'greenGlazed', 'greenFront', 'greenDoors', 'creamClerestory', 'libraryEntrance', 'brownWindows', 'steelGlazed', 'darkWindows', 'blackFront', 'redFront'];
export const FINISH_CLAMP: Finish[] = ['clerestory', 'windows', 'highWindows', 'greenWindows', 'checkWindows', 'tiledWindows', 'shopWindows', 'storeys', 'liftWindows', 'redWindows', 'shutter', 'blueGlazed', 'blueClerestory', 'steelFront', 'hallTiles', 'glassFront', 'tealWindows', 'greenGlazed', 'greenFront', 'greenDoors', 'creamClerestory', 'libraryFront', 'libraryBack', 'libraryEntrance', 'brownWindows', 'steelGlazed', 'tealTiles', 'darkWindows', 'blackFront', 'cladClerestory', 'frostedPanels', 'redBand', 'redFront', 'gridPanels'];
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
    case 'greenGlazed': {
      // a glazed hall's walls: glass from a kick panel at 0.3 m to its head at 2.9 m, in dark
      // green steel frames 1.2 m apart, and a steel handrail across them at 1 m
      const g = '#2c4637';
      band(0, 0.3, g); pane(0.3, 2.9, g, 0.09); band(2.9, 3, g);
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
    case 'slats':
      x.fillStyle = '#5d5f60'; x.fillRect(0, 0, W, H);
      for (let i = 0; i * 0.1 * PX < W; i++) {
        x.fillStyle = `rgb(${236 + Math.floor(r() * 8)},${236 + Math.floor(r() * 8)},${232 + Math.floor(r() * 8)})`;
        x.fillRect(i * 0.1 * PX + 1.5, 0, 0.1 * PX - 3, H);
      }
      break;
  }
  if (!['triangles', 'glazed', 'darkGlazed', 'clerestory', 'windows', 'highWindows', 'greenWindows', 'checkWindows', 'tiledWindows', 'shopWindows', 'storeys', 'liftWindows', 'redWindows', 'perforated', 'whitePerforated', 'hallTiles', 'glassFront', 'tealWindows', 'greenGlazed', 'greenFront', 'greenDoors', 'creamClerestory', 'silverPerforated', 'libraryFront', 'libraryBack', 'libraryEntrance', 'glassBlocks', 'blueMosaic', 'warmMosaic', 'brownWindows', 'steelGlazed', 'birchX', 'tealTiles', 'darkWindows', 'blackFront', 'splitBlocks', 'cladClerestory', 'frostedPanels', 'redBand', 'redFront', 'gridPanels', 'navyTiles', 'pineBoards', 'redTiles', 'bronzeGlass'].includes(name)) speckle(x, W, H, 2500, 0.08, 63);
  const t = toTexture(c);
  if (FINISH_CLAMP.includes(name)) t.wrapT = THREE.ClampToEdgeWrapping;
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
