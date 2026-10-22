import * as THREE from 'three';
import { screenTexture } from './interior';

// The passenger information displays inside the trains, drawn from what the train is doing: the
// amber LED signs hanging from the ceiling (C20 and C30), the C20U's TFT screens and the screens
// over the C30's doors. From photos of the cars in service (docs/rolling-stock.md):
// - The C30's LED signs read "Nästa T-Centralen" on the way, the station's name ("Karlaplan")
//   standing at it, "Mot Alby" and the time ("14:53").
// - The C20's (kept on the C20U) read "Mot: Akalla", with a colon. The photos show nothing else;
//   the next and current station follow the C30's.
// - The C20U's screen: "Nästa station" and "Next stop" (yellow) over the next station's name on a
//   blue band, the following stations under it on dark navy beside a line in the line's colour
//   with a dot for each, and at its foot the line's number on a badge and the terminus in
//   capitals. At the end of the line the whole screen is blue: the line, the station in capitals,
//   "Slutstation: Avstigning för samtliga resenärer" and "Final Stop: Exit all passengers".
// - The C30's door screen: a pink block at one end with a big white arrow, then the next station
//   on a blue band ("Nästa station / Next station" beside its name) and a list in line colours
//   under it on black. The arrow is taken to point the way the train runs, as the only way a
//   level arrow over a side door can point; the list to be the lines to change to.

// What the displays show; src/trains.ts keeps it up to date.
export interface PassengerInfo {
  line: string;     // the line's number ('' out of service)
  color: string;    // the line's colour
  dest: string;     // where the train is going
  station: string;  // the station it stands at or runs to next ('' when none)
  at: boolean;      // standing at `station`
  final: boolean;   // `station` is the end of the line: everyone gets off
  after: string[];  // the stations beyond `station`, the last being `dest` (as far as known)
  changes: { name: string; color: string }[]; // the other lines at `station`
}

// A display drawn per train. Its meshes are in the interior materials named in `mats`: 0 for one
// that looks the same from anywhere, or the wall (car z sign) of one whose arrow points the way the
// train runs as seen facing it.
export interface Display {
  mats: Record<string, 0 | 1 | -1>;
  w: number; h: number;
  // what it shows at `clock` (seconds): it is drawn again only when this changes
  show(info: PassengerInfo, clock: number): string;
  // `ahead`: where the front of the train is as seen facing the display, −1 left or 1 right
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, info: PassengerInfo, shown: string, ahead: 1 | -1): void;
}

// What the displays show in the model viewer, and before a train has been given anything.
export const SAMPLE: PassengerInfo = {
  line: '17', color: '#1f9a3c', dest: 'Skarpnäck', station: 'Gamla stan', at: false, final: false,
  after: ['Slussen', 'Medborgarplatsen', 'Skanstull', 'Gullmarsplan', 'Skarpnäck'],
  changes: [{ name: 'Röda linjen', color: '#d71d24' }],
};
export const RED_SAMPLE: PassengerInfo = {
  line: '13', color: '#d71d24', dest: 'Norsborg', station: 'T-Centralen', at: false, final: false,
  after: ['Gamla stan', 'Slussen', 'Mariatorget', 'Zinkensdamm', 'Norsborg'],
  changes: [{ name: 'Gröna linjen', color: '#1f9a3c' }, { name: 'Blå linjen', color: '#0a73c4' }, { name: 'Pendeltåg', color: '#e5609a' }],
};

// The display's material for the template: drawn once from `info`.
export function displayMaterial(name: string, d: Display, info = SAMPLE, ahead: 1 | -1 = 1) {
  const m = new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, roughness: 0.2,
    emissiveMap: screenTexture(d.w, d.h, (ctx, w, h) => d.draw(ctx, w, h, info, d.show(info, 0), ahead)),
  });
  m.name = name;
  return m;
}

// ------------------------------------------------------------------ LED signs

const PAGE = 4; // seconds each page of an LED sign shows

const clockText = () => {
  const t = new Date();
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
};

// The pages of an amber LED sign: the station it stands at or runs to next, and where the train is
// going. `colon` is the C20's "Mot: Akalla"; `time` adds the C30's clock.
function ledPages(info: PassengerInfo, colon: boolean, time: boolean) {
  const c = colon ? ':' : '';
  if (!info.line) return [info.dest];
  if (info.final) return [info.station, 'Slutstation'];
  const mot = `Mot${c} ${info.dest}`;
  if (!info.station) return [mot];
  if (info.at) return [info.station, mot];
  return time ? [`Nästa${c} ${info.station}`, mot, clockText()] : [`Nästa${c} ${info.station}`, mot];
}

// Text on an LED matrix: set a dot to a pixel in a small canvas, then each lit dot drawn round in
// amber and the unlit ones faintly, `pitch` pixels apart.
let matrix: CanvasRenderingContext2D | null = null;
function drawLed(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, pitch = 4) {
  const cols = Math.floor(w / pitch), rows = Math.floor(h / pitch);
  if (!matrix) matrix = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const m = matrix;
  m.canvas.width = cols; m.canvas.height = rows;
  m.font = `700 ${Math.round(rows * 0.8)}px Arial, Helvetica, sans-serif`;
  m.textAlign = 'center'; m.textBaseline = 'middle';
  // a long name is squeezed to fit, as the signs set it in a narrower face
  const sx = Math.min(1, (cols - 4) / m.measureText(text).width);
  m.setTransform(sx, 0, 0, 1, cols / 2, rows / 2 + 1);
  m.fillStyle = '#fff';
  m.fillText(text, 0, 0);
  const lit = m.getImageData(0, 0, cols, rows).data;
  ctx.fillStyle = '#060504'; ctx.fillRect(0, 0, w, h);
  const ox = (w - cols * pitch) / 2 + pitch / 2, oy = (h - rows * pitch) / 2 + pitch / 2, r = pitch * 0.46;
  for (const on of [false, true]) {
    ctx.beginPath();
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        if ((lit[(j * cols + i) * 4 + 3] > 100) !== on) continue;
        ctx.moveTo(ox + i * pitch + r, oy + j * pitch);
        ctx.arc(ox + i * pitch, oy + j * pitch, r, 0, Math.PI * 2);
      }
    }
    ctx.fillStyle = on ? '#ffbc2a' : '#241706';
    ctx.fill();
  }
}

function ledSign(mat: string, w: number, h: number, colon: boolean, time: boolean): Display {
  return {
    mats: { [mat]: 0 }, w, h,
    show(info, clock) {
      const pages = ledPages(info, colon, time);
      return pages[Math.floor(clock / PAGE) % pages.length];
    },
    draw(ctx, w, h, _info, shown) { drawLed(ctx, w, h, shown); },
  };
}

// The C30's signs hanging crossways (1.15 × 0.12 m), and the C20's at the gangways and the cab
// door (0.98 × 0.11 m).
export const C30_LED = ledSign('sign', 768, 80, false, true);
export const C20_LED = ledSign('sign', 704, 80, true, false);

// ------------------------------------------------------------------ TFT screens

const FONT = 'Arial, Helvetica, sans-serif';

// Text in a condensed bold face, squeezed further to fit `maxW`; returns its width.
function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, size: number, color: string, { maxW = Infinity, weight = 700, squeeze = 0.86, align = 'left' as CanvasTextAlign, spacing = 0 } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = align;
  if (spacing) ctx.letterSpacing = `${spacing}px`;
  const tw = ctx.measureText(str).width, sx = Math.min(squeeze, maxW / Math.max(1, tw));
  ctx.translate(x, y);
  ctx.scale(sx, 1);
  ctx.fillStyle = color;
  ctx.fillText(str, 0, 0);
  ctx.restore();
  return tw * sx;
}

// A line's number on a rounded badge in its colour, centred at (x, y).
function badge(ctx: CanvasRenderingContext2D, line: string, color: string, x: number, y: number, s: number) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x - s * 0.62, y - s / 2, s * 1.24, s, s * 0.16); ctx.fill();
  text(ctx, line, x, y + 1, s * 0.66, '#ffffff', { align: 'center', squeeze: 0.9 });
}

const C20U = { band: '#2b69cf', ground: '#1b2740', rule: '#5f7395', yellow: '#f3d23a', final: '#1f5bd0', finalText: '#e4f07a' };

// The C20U's screen (0.47 × 0.29 m).
export const C20U_TFT: Display = {
  mats: { screen: 0 }, w: 512, h: 320,
  show(info) {
    return [info.line, info.dest, info.station, info.at, info.final, info.after.slice(0, 4).join('/')].join('|');
  },
  draw(ctx, w, h, info) {
    if (info.final) {
      // the end of the line: everyone off
      ctx.fillStyle = C20U.final; ctx.fillRect(0, 0, w, h);
      badge(ctx, info.line, info.color, 44, 70, 36);
      text(ctx, info.station.toUpperCase(), 76, 70, 46, '#ffffff', { maxW: w - 100, spacing: 2 });
      text(ctx, 'Slutstation: Avstigning för', 76, 140, 30, '#ffffff', { weight: 600 });
      text(ctx, 'samtliga resenärer', 76, 176, 30, '#ffffff', { weight: 600 });
      text(ctx, 'Final Stop: Exit all passengers', 76, 224, 30, C20U.finalText, { weight: 600, maxW: w - 100 });
      return;
    }
    ctx.fillStyle = C20U.ground; ctx.fillRect(0, 0, w, h);
    if (!info.station) {
      if (info.line) {
        badge(ctx, info.line, info.color, 60, h / 2, 40);
        text(ctx, info.dest.toUpperCase(), 100, h / 2, 40, '#ffffff', { maxW: w - 130, spacing: 2 });
      }
      return;
    }
    // the band: the next station, or the one the train stands at; the terminus in capitals
    const lineX = 44, band = 118, last = info.station === info.dest;
    ctx.fillStyle = C20U.band; ctx.fillRect(0, 0, w, band);
    const name = last ? info.station.toUpperCase() : info.station, spacing = last ? 2 : 0;
    const y0 = info.at ? band / 2 + 2 : 78;
    if (info.at) text(ctx, name, 80, y0, 54, '#ffffff', { maxW: w - 100, spacing });
    else {
      const lw = text(ctx, 'Nästa station', 80, 30, 24, '#ffffff', { weight: 600 });
      text(ctx, 'Next stop', 80 + lw + 10, 30, 24, C20U.yellow, { weight: 600 });
      text(ctx, name, 80, y0, 54, '#ffffff', { maxW: w - 100, spacing });
    }
    const dot = (y: number) => { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(lineX, y, 7, 0, Math.PI * 2); ctx.fill(); };
    if (last) {
      // the line comes down from its number to the terminus
      ctx.fillStyle = info.color; ctx.fillRect(lineX - 5, 26, 10, y0 - 26);
      badge(ctx, info.line, info.color, lineX, 26, 30);
      dot(y0);
      return;
    }
    // the line down the left with a dot for each station, dashes for those left out, and the
    // line's number at the foot beside the terminus
    const rest = info.after.slice(0, -1).slice(0, 3), rowH = 44, row0 = band + 26;
    const foot = row0 + rest.length * rowH + 24;
    ctx.fillStyle = info.color;
    ctx.fillRect(lineX - 5, 0, 10, foot - 20);
    for (const dy of [-34, -27]) ctx.fillRect(lineX - 9, foot + dy, 18, 3);
    dot(y0);
    rest.forEach((st, i) => {
      const y = row0 + i * rowH;
      dot(y);
      text(ctx, st, 80, y, 32, '#ffffff', { weight: 600, maxW: w - 100 });
      ctx.fillStyle = C20U.rule; ctx.fillRect(76, y + 21, w - 76, 2);
    });
    badge(ctx, info.line, info.color, lineX, foot, 34);
    text(ctx, info.dest.toUpperCase(), 80, foot + 1, 30, '#ffffff', { maxW: w - 100, spacing: 2 });
  },
};

const C30 = { pink: '#d8437f', band: '#2c6be0', ground: '#0d1015', label: '#9fb4d8' };

// The C30's screen over a door (0.58 × 0.28 m), one material for the meshes on each wall.
export const C30_DOOR_TFT: Display = {
  mats: { doorScreenP: 1, doorScreenN: -1 }, w: 512, h: 240,
  show(info) {
    return [info.line, info.dest, info.station, info.at, info.final, info.changes.map((c) => c.name).join('/')].join('|');
  },
  draw(ctx, w, h, info, _shown, ahead) {
    ctx.fillStyle = C30.ground; ctx.fillRect(0, 0, w, h);
    // the pink block: where the train is going, and an arrow the way it runs
    const bw = 150, slant = 22;
    ctx.fillStyle = C30.pink;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bw + slant, 0); ctx.lineTo(bw, h); ctx.lineTo(0, h); ctx.fill();
    if (info.line && !info.final) {
      text(ctx, 'Mot', 14, 26, 22, '#ffffff', { weight: 600 });
      text(ctx, info.dest, 14, 54, 26, '#ffffff', { maxW: bw - 18 });
      ctx.save();
      ctx.translate(bw / 2 - 4, h - 62);
      ctx.scale(ahead, 1);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-44, -9); ctx.lineTo(10, -9); ctx.lineTo(10, -30); ctx.lineTo(48, 0); ctx.lineTo(10, 30); ctx.lineTo(10, 9); ctx.lineTo(-44, 9);
      ctx.fill();
      ctx.restore();
    }
    const x0 = bw + slant + 14;
    if (!info.station) return;
    // the band: the next station, or the one it stands at
    ctx.fillStyle = C30.band;
    ctx.beginPath(); ctx.moveTo(bw + slant + 6, 0); ctx.lineTo(w, 0); ctx.lineTo(w, 100); ctx.lineTo(bw + slant + 6 - 100 * slant / h, 100); ctx.fill();
    if (info.at || info.final) {
      text(ctx, info.station, x0, 52, 50, '#ffffff', { maxW: w - x0 - 12 });
    } else {
      text(ctx, 'Nästa station', x0, 36, 18, '#ffffff', { weight: 600 });
      text(ctx, 'Next station', x0, 60, 18, C30.label, { weight: 600 });
      text(ctx, info.station, x0 + 112, 50, 46, '#ffffff', { maxW: w - x0 - 124 });
    }
    if (info.final) {
      text(ctx, 'Slutstation', x0, 140, 30, '#ffffff', { weight: 600 });
      text(ctx, 'Final stop', x0, 176, 30, C30.label, { weight: 600 });
      return;
    }
    // the lines to change to
    if (!info.changes.length) return;
    text(ctx, 'Byte till', x0, 128, 22, '#ffffff', { weight: 600 });
    text(ctx, 'Change to', x0, 154, 22, C30.label, { weight: 600 });
    info.changes.slice(0, 4).forEach((c, i) => {
      text(ctx, c.name, x0 + 132, 128 + i * 30, 26, c.color, { maxW: w - x0 - 140 });
    });
  },
};
