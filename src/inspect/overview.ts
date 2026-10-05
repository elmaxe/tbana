// The map of the whole network: every track in the track graph, coloured by its line, the red
// line's drawn track by the structure it runs in, the stations, and where the inputs are fixed by
// hand. Click to pick a place; the camera shows where it is and where it looks.
import { LINES } from '../lines';
import type { LineId } from '../lines';
import { STRUCTURE_KINDS } from '../track-geometry';
import type { StructureKind } from '../track-geometry';
import { distToLine, gridToWorld } from './data';
import type { InspectData, TrackIndex } from './data';

export const KIND_COLOURS: Record<StructureKind, string> = {
  rock: '#b07a43', box: '#9aa6b4', cutting: '#d9b400', grade: '#3fbf5a', embankment: '#94d34a', bridge: '#3d8bff',
};
const YARD = '#5d6876', UNNAMED = '#7c8794', FIX = '#e8b04b';

// What a click on the map is on.
export type MapHit =
  | { kind: 'station'; name: string; x: number; z: number }
  | { kind: 'track'; piece: number; x: number; z: number }
  | { kind: 'point'; x: number; z: number };

export interface MapOptions { kinds: boolean; yards: boolean; fixes: boolean }

interface Layer { path: Path2D; colour: string; width: number; dash?: number[] }

export class Overview {
  // the view: the world point at the middle, and pixels (CSS) per metre
  cx = 0; cz = 0; scale = 0.05;
  options: MapOptions = { kinds: true, yards: true, fixes: true };
  onPick: (hit: MapHit, shift: boolean) => void = () => {};

  private ctx: CanvasRenderingContext2D;
  private base = document.createElement('canvas');
  private dirty = true;
  private cam = { x: 0, z: 0, yaw: 0, fov: 1 };
  private marks: { x: number; z: number; colour: string }[] = [];
  private hover: MapHit | null = null;
  private lines: Layer[] = [];
  private yards: Layer[] = [];
  private kinds: Layer[] = [];
  private fixes: Layer[] = [];
  private redStations: Set<string>;

  constructor(private canvas: HTMLCanvasElement, private data: InspectData, private track: TrackIndex, private status: HTMLElement) {
    this.ctx = canvas.getContext('2d')!;
    this.buildLayers();
    this.redStations = new Set(data.graph.routes.flatMap((r) => r.stops.map((s) => s.station)));
    this.fit();
    new ResizeObserver(() => { this.dirty = true; this.draw(); }).observe(canvas);
    this.bindPointer();
  }

  // ---------------------------------------------------------------- layers, in world x, z
  private buildLayers() {
    const { graph, geometry, refs } = this.data;
    const byColour = new Map<string, Path2D>();
    const yard = new Path2D();
    for (const p of graph.pieces) {
      const path = p.service === 'main' ? (() => {
        const c = LINES[p.lines[0] as LineId]?.color ?? UNNAMED;
        if (!byColour.has(c)) byColour.set(c, new Path2D());
        return byColour.get(c)!;
      })() : yard;
      p.points.forEach(([x, z], i) => (i ? path.lineTo(x, z) : path.moveTo(x, z)));
    }
    this.lines = [...byColour].map(([colour, path]) => ({ path, colour, width: 2 }));
    this.yards = [{ path: yard, colour: YARD, width: 1.2 }];

    const kinds = new Map<StructureKind, Path2D>(STRUCTURE_KINDS.map((k) => [k, new Path2D()]));
    for (const p of Object.values(geometry.pieces)) {
      for (let i = 1; i < p.x.length; i++) {
        const path = kinds.get(STRUCTURE_KINDS[p.kind[i - 1]])!;
        path.moveTo(p.x[i - 1], p.z[i - 1]);
        path.lineTo(p.x[i], p.z[i]);
      }
    }
    this.kinds = [...kinds].map(([k, path]) => ({ path, colour: KIND_COLOURS[k], width: 3.5 }));

    if (refs) {
      const fix = new Path2D();
      const { heightFixes: h, trackFixes: t } = refs;
      for (const f of [...(h.uncovered ?? []), ...(h.offGround ?? [])]) {
        f.along.forEach(([x, z], i) => (i ? fix.lineTo(x, z) : fix.moveTo(x, z)));
      }
      for (const c of t.crossovers ?? []) {
        const a = gridToWorld(c.a), b = gridToWorld(c.b);
        fix.moveTo(a.x, a.z);
        fix.lineTo(b.x, b.z);
      }
      this.fixes = [{ path: fix, colour: FIX, width: 9, dash: [] }];
    }
  }

  // Stations, and fixes made at a station, by name: where the fixes are.
  fixedStations() {
    const r = this.data.refs;
    return new Set([...(r?.trackFixes.platforms ?? []).map((p) => p.station), ...(r?.heightFixes.stations ?? []).map((s) => s.station)]);
  }

  // ---------------------------------------------------------------- the view
  fit() {
    const xs = this.data.graph.pieces.flatMap((p) => p.points.map((q) => q[0]));
    const zs = this.data.graph.pieces.flatMap((p) => p.points.map((q) => q[1]));
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    this.cx = (x0 + x1) / 2; this.cz = (z0 + z1) / 2;
    const w = this.canvas.clientWidth || 400, h = this.canvas.clientHeight || 400;
    this.scale = Math.min(w / (x1 - x0), h / (z1 - z0)) * 0.92;
    this.dirty = true;
  }

  // Centres the map on a point, zooming in to at least `scale`.
  centre(x: number, z: number, scale?: number) {
    this.cx = x; this.cz = z;
    if (scale) this.scale = Math.max(this.scale, scale);
    this.dirty = true;
  }

  private toScreen(x: number, z: number): [number, number] {
    return [(x - this.cx) * this.scale + this.canvas.clientWidth / 2, (z - this.cz) * this.scale + this.canvas.clientHeight / 2];
  }

  private toWorld(px: number, py: number) {
    return { x: (px - this.canvas.clientWidth / 2) / this.scale + this.cx, z: (py - this.canvas.clientHeight / 2) / this.scale + this.cz };
  }

  // Centres the map on a point if it's out of sight.
  reveal(x: number, z: number) {
    const [px, py] = this.toScreen(x, z), m = 30;
    if (px < m || py < m || px > this.canvas.clientWidth - m || py > this.canvas.clientHeight - m) this.centre(x, z);
  }

  setCamera(x: number, z: number, yaw: number, fov: number) {
    const c = this.cam;
    if (Math.abs(c.x - x) * this.scale < 0.5 && Math.abs(c.z - z) * this.scale < 0.5 && Math.abs(c.yaw - yaw) < 0.01) return;
    this.cam = { x, z, yaw, fov };
    this.draw();
  }

  // Points to show: the selection, a picked point.
  setMarks(marks: { x: number; z: number; colour: string }[]) {
    this.marks = marks;
    this.draw();
  }

  setOptions(o: Partial<MapOptions>) {
    Object.assign(this.options, o);
    this.dirty = true;
    this.draw();
  }

  // ---------------------------------------------------------------- drawing
  private drawBase() {
    const dpr = devicePixelRatio, w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.base.width = this.canvas.width = Math.round(w * dpr);
    this.base.height = this.canvas.height = Math.round(h * dpr);
    const g = this.base.getContext('2d')!;
    g.fillStyle = '#0d1117';
    g.fillRect(0, 0, this.base.width, this.base.height);
    this.drawGrid(g, dpr, w, h);
    // the layers in world units: the transform maps them to the canvas
    g.save();
    g.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, dpr * (w / 2 - this.cx * this.scale), dpr * (h / 2 - this.cz * this.scale));
    g.lineJoin = g.lineCap = 'round';
    const stroke = (layers: Layer[], alpha = 1) => {
      g.globalAlpha = alpha;
      for (const l of layers) {
        g.strokeStyle = l.colour;
        g.lineWidth = l.width / this.scale;
        g.stroke(l.path);
      }
      g.globalAlpha = 1;
    };
    if (this.options.fixes) stroke(this.fixes, 0.45);
    if (this.options.yards) stroke(this.yards);
    stroke(this.lines, this.options.kinds ? 0.55 : 1);
    if (this.options.kinds) stroke(this.kinds);
    g.restore();

    // the stations, with their names when there is room
    g.save();
    g.scale(dpr, dpr);
    const fixed = this.options.fixes ? this.fixedStations() : new Set<string>();
    const names = this.scale > 0.06;
    for (const st of this.data.graph.stations) {
      const [px, py] = this.toScreen(st.x, st.z);
      if (px < -50 || py < -20 || px > w + 50 || py > h + 20) continue;
      const red = this.redStations.has(st.name);
      g.beginPath();
      g.arc(px, py, red ? 3.5 : 2.5, 0, Math.PI * 2);
      g.fillStyle = '#fff';
      g.fill();
      if (fixed.has(st.name)) {
        g.strokeStyle = FIX;
        g.lineWidth = 2;
        g.stroke();
      }
      if (names || red && this.scale > 0.025) {
        g.font = `${red ? 600 : 400} 11px system-ui, sans-serif`;
        g.fillStyle = red ? '#e8edf3' : '#93a0b0';
        g.strokeStyle = '#0d1117';
        g.lineWidth = 3;
        g.strokeText(st.name, px + 6, py + 4);
        g.fillText(st.name, px + 6, py + 4);
      }
    }
    g.restore();
    this.dirty = false;
  }

  // A grid every 1 km (or 100 m, close up), and a scale bar.
  private drawGrid(g: CanvasRenderingContext2D, dpr: number, w: number, h: number) {
    const step = this.scale > 0.4 ? 100 : 1000;
    const a = this.toWorld(0, 0), b = this.toWorld(w, h);
    g.save();
    g.scale(dpr, dpr);
    g.strokeStyle = '#161d27';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = Math.ceil(a.x / step) * step; x < b.x; x += step) { const [px] = this.toScreen(x, 0); g.moveTo(px, 0); g.lineTo(px, h); }
    for (let z = Math.ceil(a.z / step) * step; z < b.z; z += step) { const [, py] = this.toScreen(0, z); g.moveTo(0, py); g.lineTo(w, py); }
    g.stroke();
    const bar = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find((m) => m * this.scale > 60) ?? 5000;
    g.fillStyle = '#93a0b0';
    g.fillRect(10, 10, bar * this.scale, 3);
    g.font = '11px system-ui, sans-serif';
    g.fillText(bar >= 1000 ? `${bar / 1000} km` : `${bar} m`, 10, 26);
    g.fillText('N ↑', w - 30, 20);
    g.restore();
  }

  draw() {
    if (!this.canvas.clientWidth) return;
    if (this.dirty) this.drawBase();
    const g = this.ctx, dpr = devicePixelRatio;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.base, 0, 0);
    g.scale(dpr, dpr);
    for (const m of this.marks) {
      const [px, py] = this.toScreen(m.x, m.z);
      g.strokeStyle = m.colour;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(px, py, 9, 0, Math.PI * 2);
      g.moveTo(px - 14, py); g.lineTo(px - 5, py); g.moveTo(px + 5, py); g.lineTo(px + 14, py);
      g.moveTo(px, py - 14); g.lineTo(px, py - 5); g.moveTo(px, py + 5); g.lineTo(px, py + 14);
      g.stroke();
    }
    if (this.hover?.kind === 'track') this.strokePiece(g, this.hover.piece, '#ffffff');
    // the camera, and the width of its view
    const { x, z, yaw, fov } = this.cam;
    const [px, py] = this.toScreen(x, z);
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), r = 40;
    g.fillStyle = 'rgba(255, 255, 255, 0.12)';
    g.beginPath();
    g.moveTo(px, py);
    for (const s of [-fov / 2, fov / 2]) g.lineTo(px + -Math.sin(yaw + s) * r, py + -Math.cos(yaw + s) * r);
    g.closePath();
    g.fill();
    g.fillStyle = '#ff4fd8';
    g.strokeStyle = '#0d1117';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(px + fx * 11, py + fz * 11);
    g.lineTo(px - fz * 6 - fx * 6, py + fx * 6 - fz * 6);
    g.lineTo(px + fz * 6 - fx * 6, py - fx * 6 - fz * 6);
    g.closePath();
    g.stroke();
    g.fill();
  }

  // A piece of track, highlighted.
  private strokePiece(g: CanvasRenderingContext2D, piece: number, colour: string) {
    const p = this.data.graph.pieces[piece];
    if (!p) return;
    g.strokeStyle = colour;
    g.lineWidth = 5;
    g.globalAlpha = 0.6;
    g.beginPath();
    for (const [i, [x, z]] of p.points.entries()) {
      const [sx, sy] = this.toScreen(x, z);
      if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy);
    }
    g.stroke();
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- what's where
  hitAt(px: number, py: number): MapHit {
    const { x, z } = this.toWorld(px, py);
    let best: MapHit | null = null, bestD = 12;
    for (const st of this.data.graph.stations) {
      const [sx, sy] = this.toScreen(st.x, st.z);
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestD) { bestD = d; best = { kind: 'station', name: st.name, x: st.x, z: st.z }; }
    }
    if (best) return best;
    const reach = 10 / this.scale;
    // the drawn track first, then any track in the graph
    const sm = this.track.nearest(x, z, reach);
    if (sm) return { kind: 'track', piece: sm.piece, x: sm.x, z: sm.z };
    let piece = -1, pieceD = reach;
    for (const p of this.data.graph.pieces) {
      if (!this.options.yards && p.service !== 'main') continue;
      const d = distToLine(x, z, p.points);
      if (d < pieceD) { pieceD = d; piece = p.id; }
    }
    return piece >= 0 ? { kind: 'track', piece, x, z } : { kind: 'point', x, z };
  }

  private describe(hit: MapHit) {
    const at = `${hit.x.toFixed(0)}, ${hit.z.toFixed(0)}`;
    if (hit.kind === 'station') return `${hit.name} · ${at}`;
    if (hit.kind === 'track') {
      const p = this.data.graph.pieces[hit.piece];
      const sm = this.track.nearest(hit.x, hit.z, 1);
      return `piece ${p.id} · ${p.service}${p.lines.length ? ` ${p.lines.join('/')}` : ''} · ${sm ? `${sm.kind}, rail ${sm.y.toFixed(1)} m` : p.structure} · ${at}`;
    }
    return at;
  }

  private bindPointer() {
    const c = this.canvas;
    let drag: { x: number; y: number; cx: number; cz: number; moved: boolean } | null = null;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, cx: this.cx, cz: this.cz, moved: false };
    });
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) > 4) drag.moved = true;
        if (drag.moved) {
          this.cx = drag.cx - dx / this.scale;
          this.cz = drag.cz - dy / this.scale;
          this.dirty = true;
          this.draw();
        }
        return;
      }
      this.hover = this.hitAt(e.clientX - r.left, e.clientY - r.top);
      this.status.textContent = this.describe(this.hover);
      c.style.cursor = this.hover.kind === 'point' ? 'crosshair' : 'pointer';
      this.draw();
    });
    c.addEventListener('pointerup', (e) => {
      const r = c.getBoundingClientRect();
      if (drag && !drag.moved) this.onPick(this.hitAt(e.clientX - r.left, e.clientY - r.top), e.shiftKey);
      drag = null;
    });
    c.addEventListener('pointerleave', () => {
      this.hover = null;
      this.status.textContent = 'click: fly there · shift-click: view from above · drag: pan · wheel: zoom';
      this.draw();
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const before = this.toWorld(px, py);
      this.scale = Math.min(20, Math.max(0.005, this.scale * Math.pow(1.0015, -e.deltaY)));
      const after = this.toWorld(px, py);
      this.cx += before.x - after.x;
      this.cz += before.z - after.z;
      this.dirty = true;
      this.draw();
    }, { passive: false });
  }

  // The legend for the structure colours.
  static legend(el: HTMLElement) {
    el.innerHTML = STRUCTURE_KINDS.map((k) => `<span style="background:${KIND_COLOURS[k]}"></span>${k}`).join('')
      + `<span style="background:${FIX}"></span>fixed by hand`;
  }
}
