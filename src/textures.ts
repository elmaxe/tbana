import * as THREE from 'three';

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
