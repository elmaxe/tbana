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

// A building's facade, white so vertex colours tint it: one bay of one storey (3 × 3.1 m), a
// window with a sill in plaster. Repeats along the wall and up it.
export function facade() {
  const [c, x] = canvas(128);
  x.fillStyle = '#f4f2ee';
  x.fillRect(0, 0, 128, 128);
  speckle(x, 128, 128, 500, 0.1, 21);
  drawWindow(x, '#8c8a86');
  return toTexture(c, { aniso: 4 });
}

// The facade's other styles, also one bay by one storey, light so vertex colours tint them.
// Brick: courses of bricks with darker joints, and the window.
export function facadeBrick() {
  const [c, x] = canvas(128);
  x.fillStyle = '#e2ddd6';
  x.fillRect(0, 0, 128, 128);
  const r = rng(41);
  // courses 5 px high, bricks 14 px long, every other course offset by half
  for (let y = 0; y < 128; y += 5) {
    for (let k = -1; k < 10; k++) {
      const x0 = k * 14 + ((y / 5) % 2 ? 7 : 0);
      const v = 205 + Math.floor(r() * 50);
      x.fillStyle = `rgb(${v},${v - 4},${v - 8})`;
      x.fillRect(x0 + 1, y + 1, 12, 3);
    }
  }
  drawWindow(x, '#bdb7ae');
  return toTexture(c, { aniso: 4 });
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
  const [c, x] = canvas(128);
  x.fillStyle = '#efebe4';
  x.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 128; k += 8) {
    x.fillStyle = 'rgba(0,0,0,0.16)';
    x.fillRect(k, 0, 1, 128);
    x.fillStyle = 'rgba(255,255,255,0.18)';
    x.fillRect(k + 1, 0, 1, 128);
  }
  speckle(x, 128, 128, 300, 0.08, 43);
  x.fillStyle = '#fbfbf8';
  x.fillRect(42, 36, 44, 54);
  x.fillStyle = '#3a4048';
  x.fillRect(46, 40, 36, 46);
  x.fillStyle = '#fbfbf8';
  x.fillRect(62, 40, 4, 46);
  x.fillRect(46, 60, 36, 3);
  return toTexture(c, { aniso: 4 });
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

// the facades' window: dark glass, a frame round it and a sill under it
function drawWindow(x: CanvasRenderingContext2D, frame: string) {
  x.fillStyle = frame;
  x.fillRect(36, 30, 56, 64);
  x.fillStyle = '#3a4048';
  x.fillRect(40, 34, 48, 56);
  x.fillStyle = '#56606b';
  x.fillRect(40, 34, 48, 22);
  x.fillStyle = frame;
  x.fillRect(62, 34, 4, 56);
  x.fillStyle = '#d8d6d2';
  x.fillRect(32, 94, 64, 5);
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
