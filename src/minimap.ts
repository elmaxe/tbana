import * as THREE from 'three';
import { LINES } from './lines';
import type { LineId } from './lines';
import { CITY_TILE } from './city-tile';
import type { CityTile } from './city-tile';
import type { City } from './city';
import { inPolygon, overlaps } from './map-layers';
import type { Box, Call, MapLayers, MapPlatform } from './map-layers';
import { nextStation } from './service';
import type { Service } from './service';
import type { Station, SurfaceRecord } from './station';
import type { Trains } from './trains';

// The map of where the player is: in the corner (the minimap), following them, north up, and the
// full map (M), to zoom and move about. It draws, from the bottom up:
// - the city round the player from its tiles (the land, the water and the buildings), and beyond
//   them the land and water of the whole city (public/data/map.png, tools/build-map.ts)
// - the station models' plans, drawn from above (T-Centralen, Odenplan, Fridhemsplan)
// - the other stations' halls, passages, stairs and platforms (src/map-layers.ts), those on other
//   levels than the player's fainter
// - the track, coloured by its line (fainter in a tunnel), and the trains running on it
// - the platform or floor the player stands on, the stations' exits and names, and the player
// Beside the minimap, a caption says where they are: the station and the trains calling at the
// platform, the train they ride, or the nearest station.

export interface MapPlayer { pos: THREE.Vector3; yaw: number; fly: boolean }

// Where the player is, as the map tells it.
export interface MapHere {
  station: string | null;      // the station they are in, or on a platform of
  floor: SurfaceRecord | null; // a station model's floor they stand on
  label: string | null;        // what they stand on, such as "Slussen · passage"
  ride: Service | null;        // the train they ride
}

// Land, water and buildings, as public/data/map.png has them: 0 none, 1 land, 2 water.
export interface MapOverview { note: string; image: string; x0: number; z0: number; step: number; width: number; height: number }

const COLOUR = {
  none: '#14181e', land: '#20262e', water: '#1d3c5a', building: '#363e49', roof: '#2c333c',
  hall: '#7b8594', passage: '#69737f', platform: '#a5aebb', stairs: '#8d97a5', escalator: '#97a1af', lift: '#4b8fd6',
  yard: '#66717f', here: '#ffd21f', exit: '#0c4da2', text: '#eef2f7', halo: 'rgba(10, 12, 17, 0.9)', player: '#ff3b30',
};
const TILE_PX = 1;           // city tiles drawn at a pixel a metre
const LEVEL = 2.6;           // parts within this many metres of the player's level are on it
const MINI = { station: 120, street: 220, ride: 650, fly: 2.2, max: 4000 }; // the minimap's radius, m
const BIG = { initial: 2600, min: 60, max: 40000 }; // the full map's span (its smaller side), m

interface View { cx: number; cz: number; s: number; w: number; h: number; dpr: number } // s: device px a metre
interface Plan { image: HTMLCanvasElement; box: Box }

export class MiniMap {
  // the minimap's radius (m) and the player's zoom of it (+/−)
  private radius: number = MINI.station;
  private miniZoom = 1;
  // the full map: its middle, its scale (CSS px a metre), and whether it follows the player
  private big = { cx: 0, cz: 0, s: 0, follow: true };
  private bigBase = document.createElement('canvas');
  private bigKey = '';
  private plans: Plan[] = [];
  private tiles = new Map<string, { canvas: HTMLCanvasElement; x0: number; z0: number }>();
  private tilesVersion = 0;
  private overview: { canvas: HTMLCanvasElement; box: Box } | null = null;
  private platform: MapPlatform | null = null;
  // the metro's lines the map has, for its legend
  private lines: LineId[];

  constructor(renderer: THREE.WebGLRenderer, station: Station, private layers: MapLayers | null, private city: City | null,
    private trains: Trains, private mini: HTMLCanvasElement, private bigCanvas: HTMLCanvasElement) {
    for (const a of station.areas) this.plans.push(renderPlan(renderer, station.mapGroup, a.bounds));
    const colours = new Set(layers?.tracks.map((t) => t.colour));
    this.lines = (['green', 'red', 'blue'] as LineId[]).filter((l) => colours.has(LINES[l].color));
    if (city) loadOverview().then((o) => { this.overview = o; this.tilesVersion++; }, (err) => console.warn('no map overview:', err));
  }

  // ---------------------------------------------------------------- the minimap
  draw(player: MapPlayer, here: MapHere, dt: number) {
    this.updateTiles(player.pos);
    const c = this.mini, dpr = Math.min(devicePixelRatio, 2);
    const size = Math.round((c.clientWidth || 180) * dpr);
    if (c.width !== size) { c.width = c.height = size; }
    // closer in a station, further out on the street, on a train, and flying high
    const ground = this.city?.heightAt(player.pos.x, player.pos.z) ?? null;
    const target = Math.min(MINI.max, this.miniZoom * (here.ride ? MINI.ride
      : player.fly ? Math.max(MINI.street, MINI.station + MINI.fly * Math.max(0, player.pos.y - (ground ?? 0)))
      : here.station ? MINI.station : MINI.street));
    this.radius = Math.exp(THREE.MathUtils.lerp(Math.log(this.radius), Math.log(target), 1 - Math.exp(-dt * 3)));
    const g = c.getContext('2d')!;
    const S = c.width, v: View = { cx: player.pos.x, cz: player.pos.z, s: S / 2 / this.radius, w: S, h: S, dpr };
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - dpr, 0, Math.PI * 2); g.clip();
    this.platform = this.platformAt(player, here);
    this.paintBase(g, v, player, here, true);
    this.paintLive(g, v, player, here, true);
    g.restore();
    // the rim, north and the scale
    g.lineWidth = 2 * dpr; g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - dpr, 0, Math.PI * 2); g.stroke();
    label(g, 'N', S / 2, 12 * dpr, 11 * dpr, 'center');
    scaleBar(g, v, S / 2, S - 16 * dpr, S * 0.28);
  }

  // The minimap closer (+1) or further out (−1).
  zoomMini(dir: number) { this.miniZoom = THREE.MathUtils.clamp(this.miniZoom * (dir > 0 ? 1 / 1.5 : 1.5), 0.25, 16); }

  // ---------------------------------------------------------------- the full map
  // Opens on the player.
  openBig(player: MapPlayer) {
    const w = this.bigCanvas.clientWidth || innerWidth, h = this.bigCanvas.clientHeight || innerHeight;
    this.big = { cx: player.pos.x, cz: player.pos.z, s: Math.min(w, h) / BIG.initial, follow: true };
  }

  // Zooms by `f` about a point on the canvas (CSS px from its corner; its middle without one).
  zoomBig(f: number, at?: { x: number; y: number }) {
    const c = this.bigCanvas, w = c.clientWidth, h = c.clientHeight;
    const s = THREE.MathUtils.clamp(this.big.s * f, Math.min(w, h) / BIG.max, Math.min(w, h) / BIG.min);
    const px = at ? at.x - w / 2 : 0, py = at ? at.y - h / 2 : 0;
    // keep the point under the pointer where it is
    this.big.cx += px / this.big.s - px / s;
    this.big.cz += py / this.big.s - py / s;
    this.big.s = s;
  }

  // Moves the map by CSS px.
  panBig(dx: number, dy: number) {
    this.big.cx -= dx / this.big.s;
    this.big.cz -= dy / this.big.s;
    this.big.follow = false;
  }

  drawBig(player: MapPlayer, here: MapHere) {
    this.updateTiles(player.pos);
    const c = this.bigCanvas, dpr = Math.min(devicePixelRatio, 2);
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (!w || !h) return;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    if (!this.big.s) this.openBig(player);
    // following the player, the map moves on when they near its edge
    const b = this.big;
    if (b.follow) {
      const mx = (c.clientWidth / 2) * 0.6 / b.s, mz = (c.clientHeight / 2) * 0.6 / b.s;
      if (Math.abs(player.pos.x - b.cx) > mx || Math.abs(player.pos.z - b.cz) > mz) { b.cx = player.pos.x; b.cz = player.pos.z; }
    }
    const v: View = { cx: b.cx, cz: b.cz, s: b.s * dpr, w, h, dpr };
    this.platform = this.platformAt(player, here);
    // what doesn't move, drawn again only when the view or the city's tiles change
    const key = [w, h, b.cx.toFixed(2), b.cz.toFixed(2), b.s.toFixed(6), this.tilesVersion].join();
    if (key !== this.bigKey) {
      this.bigKey = key;
      this.bigBase.width = w; this.bigBase.height = h;
      this.paintBase(this.bigBase.getContext('2d')!, v, player, here, false);
    }
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.bigBase, 0, 0);
    this.paintLive(g, v, player, here, false);
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.legend(g, dpr);
    label(g, 'N ↑', w - 34 * dpr, 30 * dpr, 16 * dpr, 'center');
    scaleBar(g, v, w - 90 * dpr, h - 24 * dpr, 140 * dpr);
  }

  private legend(g: CanvasRenderingContext2D, dpr: number) {
    const lines = this.lines;
    if (!lines.length) return;
    g.font = `600 ${13 * dpr}px system-ui, sans-serif`;
    g.textBaseline = 'middle'; g.textAlign = 'left';
    const w = Math.max(...lines.map((l) => g.measureText(LINES[l].name).width)) + 74 * dpr;
    g.fillStyle = 'rgba(10, 12, 17, 0.75)';
    g.beginPath(); g.roundRect(8 * dpr, 8 * dpr, w, (lines.length * 22 + 6) * dpr, 6 * dpr); g.fill();
    lines.forEach((l, i) => {
      const y = (22 + i * 22) * dpr, x = 18 * dpr;
      g.fillStyle = LINES[l].color;
      g.beginPath(); g.roundRect(x, y - 7 * dpr, 46 * dpr, 14 * dpr, 4 * dpr); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center';
      g.fillText(LINES[l].numbers.join(' '), x + 23 * dpr, y + dpr);
      g.textAlign = 'left';
      halo(g, LINES[l].name, x + 54 * dpr, y + dpr, dpr);
    });
  }

  // ---------------------------------------------------------------- what the player is on
  // The network's platform the player stands on (or the nearest of the station's, close by).
  private platformAt(player: MapPlayer, here: MapHere) {
    if (!here.station || here.ride || !this.layers) return null;
    const { x, y, z } = player.pos;
    let best: MapPlatform | null = null, bestD = 4;
    for (const p of this.layers.platforms) {
      if (p.station !== here.station || Math.abs(p.y - y) > 3) continue;
      if (x < p.box.x0 - bestD || x > p.box.x1 + bestD || z < p.box.z0 - bestD || z > p.box.z1 + bestD) continue;
      for (const s of p.strips) {
        if (inPolygon(x, z, s.outline)) return p;
        for (const [px, pz] of s.outline) {
          const d = Math.hypot(px - x, pz - z);
          if (d < bestD) { bestD = d; best = p; }
        }
      }
    }
    return best;
  }

  // What the caption under the minimap says (HTML), or '' for nothing.
  caption(player: MapPlayer, here: MapHere) {
    const rows: string[] = [];
    if (here.ride) {
      const svc = here.ride, next = nextStation(svc);
      rows.push(`${badge(svc.L.color, svc.dest[0])} <b>${esc(svc.dest[1])}</b>`);
      if (next) rows.push(`<span class="mu">${svc.state === 'run' ? 'Next' : 'At'}:</span> ${esc(next)}`);
      return rows.map((r) => `<div>${r}</div>`).join('');
    }
    if (here.station) {
      // (a model's platform's label ends in its lines' numbers, which the badges show)
      const what = (here.label ?? '').replace(`${here.station} · `, '').replace(/ · [\d ]+$/, '');
      rows.push(`<div><b>${esc(here.station)}</b>${what && what !== here.station ? ` · ${esc(what)}` : ''}</div>`);
      // the trains calling at the platform: at each track, by line
      const tracks: Call[][] = this.platform?.tracks ?? (here.floor?.platformLine ? this.trains.callsAt(here.floor) : []);
      for (const calls of tracks) {
        const byLine = new Map<LineId, Call[]>();
        for (const cl of calls) (byLine.get(cl.line) ?? byLine.set(cl.line, []).get(cl.line)!).push(cl);
        for (const [line, cs] of byLine) {
          const numbers = [...new Set(cs.map((cl) => cl.number))].sort();
          const dests = [...new Set(cs.map((cl) => cl.dest))];
          const row = `<div class="row">${badge(LINES[line]?.color ?? '#888', numbers.join(' '))}<span>${dests.map(esc).join(', ')}</span></div>`;
          if (!rows.includes(row)) rows.push(row);
        }
      }
      return rows.join('');
    }
    // out in the city or flying: the nearest station
    let near: { name: string; d: number; lines: LineId[] } | null = null;
    for (const st of this.layers?.stations ?? []) {
      const d = Math.hypot(st.x - player.pos.x, st.z - player.pos.z);
      if (!near || d < near.d) near = { name: st.name, d, lines: st.lines };
    }
    if (!near || near.d > 3000) return '';
    const dist = near.d < 1000 ? `${Math.round(near.d / 10) * 10} m` : `${(near.d / 1000).toFixed(1)} km`;
    return `<div>${near.lines.map((l) => `<span class="dot" style="background:${LINES[l].color}"></span>`).join('')}<b>${esc(near.name)}</b> · ${dist}</div>`;
  }

  // ---------------------------------------------------------------- the city's tiles
  private updateTiles(pos: THREE.Vector3) {
    if (!this.city) return;
    const seen = new Set<string>();
    // one a frame, the nearest first
    let next: { key: string; x0: number; z0: number; data: CityTile; d: number } | null = null;
    for (const t of this.city.fetched()) {
      seen.add(t.key);
      if (this.tiles.has(t.key)) continue;
      const d = Math.hypot(t.x0 + CITY_TILE / 2 - pos.x, t.z0 + CITY_TILE / 2 - pos.z);
      if (!next || d < next.d) next = { ...t, d };
    }
    if (next) {
      this.tiles.set(next.key, { canvas: rasterTile(next.data, next.x0, next.z0), x0: next.x0, z0: next.z0 });
      this.tilesVersion++;
    }
    for (const k of this.tiles.keys()) if (!seen.has(k)) { this.tiles.delete(k); this.tilesVersion++; }
  }

  // ---------------------------------------------------------------- drawing
  // What stays put: the city, the stations' plans and the track.
  private paintBase(g: CanvasRenderingContext2D, v: View, player: MapPlayer, here: MapHere, levels: boolean) {
    const { s, dpr } = v;
    const view: Box = { x0: v.cx - v.w / 2 / s, x1: v.cx + v.w / 2 / s, z0: v.cz - v.h / 2 / s, z1: v.cz + v.h / 2 / s };
    const px = dpr / s; // a CSS pixel, in metres
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = COLOUR.none;
    g.fillRect(0, 0, v.w, v.h);
    g.setTransform(s, 0, 0, s, v.w / 2 - v.cx * s, v.h / 2 - v.cz * s);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.lineJoin = g.lineCap = 'round';

    // the city
    const o = this.overview;
    if (o && overlaps(o.box, view)) g.drawImage(o.canvas, o.box.x0, o.box.z0, o.box.x1 - o.box.x0, o.box.z1 - o.box.z0);
    for (const t of this.tiles.values()) {
      if (overlaps({ x0: t.x0, z0: t.z0, x1: t.x0 + CITY_TILE, z1: t.z0 + CITY_TILE }, view)) g.drawImage(t.canvas, t.x0, t.z0, CITY_TILE, CITY_TILE);
    }
    // the station models' plans
    for (const p of this.plans) {
      if (overlaps(p.box, view)) g.drawImage(p.image, p.box.x0, p.box.z0, p.box.x1 - p.box.x0, p.box.z1 - p.box.z0);
    }
    const L = this.layers;
    if (!L) return;
    // fainter on other levels than the player's, in the station they are in
    const y = player.pos.y;
    const level = (station: string, y0: number, y1: number) =>
      !levels || here.station !== station || (y > y0 - LEVEL && y < y1 + LEVEL) ? 1 : 0.4;
    // the stations' halls, passages, stairs and lifts, once they're big enough to see
    if (s / dpr > 0.25) {
      for (const st of L.plans) {
        if (!overlaps(st.box, view)) continue;
        for (const p of st.parts) {
          g.globalAlpha = level(st.name, p.y0, p.y1);
          g.fillStyle = COLOUR[p.kind];
          g.fill(p.path);
        }
      }
      for (const p of L.platforms) {
        if (!overlaps(p.box, view)) continue;
        g.globalAlpha = level(p.station, p.y, p.y);
        g.fillStyle = COLOUR.platform;
        for (const st of p.strips) g.fill(st.path);
      }
      g.globalAlpha = 1;
    }
    // the track: the yards thin, the lines in their colours, fainter in a tunnel
    const thin = s / dpr < 0.08;
    for (const t of L.tracks) {
      if (!overlaps(t.box, view)) continue;
      g.globalAlpha = t.tunnel ? 0.6 : 1;
      g.strokeStyle = t.colour;
      // the lines as wide as their track bed, close in
      g.lineWidth = t.main ? (thin ? 2 * px : Math.max(2.2 * px, 2.4)) : Math.max(1.2 * px, 1.2);
      g.stroke(t.path);
    }
    g.globalAlpha = 1;
    // the exits, where there is room
    if (s / dpr > 0.3) {
      const r = 5 * px;
      for (const st of L.plans) {
        if (!overlaps(st.box, view)) continue;
        for (const e of st.exits) {
          g.fillStyle = COLOUR.exit;
          g.fillRect(e.x - r, e.z - r, 2 * r, 2 * r);
          g.fillStyle = '#fff';
          g.fillRect(e.x - r * 0.62, e.z - r * 0.6, r * 1.24, r * 0.3);
          g.fillRect(e.x - r * 0.15, e.z - r * 0.6, r * 0.3, r * 1.3);
        }
      }
    }
  }

  // The stations: a dot when far out, and their names where they fit, the player's station's first.
  private paintStations(g: CanvasRenderingContext2D, v: View, here: MapHere, mini: boolean, player: { x: number; y: number }) {
    const L = this.layers;
    if (!L) return;
    const { s, dpr } = v;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const font = (s / dpr < 0.08 ? 11 : 12.5) * dpr;
    const dots = s / dpr < 0.35;
    const list = L.stations
      .map((st) => ({ st, x: (st.x - v.cx) * s + v.w / 2, y: (st.z - v.cz) * s + v.h / 2, r: (st.lines.length > 1 ? 4.5 : 3.5) * dpr * (st.name === here.station ? 1.3 : 1) }))
      .filter((p) => p.x > -100 * dpr && p.x < v.w + 100 * dpr && p.y > -30 * dpr && p.y < v.h + 30 * dpr)
      // the player's station first, then the interchanges
      .sort((a, b) => Number(b.st.name === here.station) - Number(a.st.name === here.station) || b.st.lines.length - a.st.lines.length);
    // the names keep clear of the player and the dots
    const m = 11 * dpr;
    const placed: Box[] = [{ x0: player.x - m, x1: player.x + m, z0: player.y - m, z1: player.y + m }];
    if (dots) {
      for (const { st, x, y, r } of list) {
        const current = st.name === here.station;
        g.fillStyle = '#fff'; g.strokeStyle = current ? COLOUR.here : '#0d1117'; g.lineWidth = (current ? 2.5 : 1.5) * dpr;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
        placed.push({ x0: x - r, x1: x + r, z0: y - r, z1: y + r });
      }
    }
    g.textAlign = 'left'; g.textBaseline = 'middle';
    for (const { st, x, y, r } of list) {
      const current = st.name === here.station;
      // (close in, the caption names the station the player is in)
      if (current && !dots && mini) continue;
      g.font = `${current ? 700 : 600} ${font}px system-ui, sans-serif`;
      const tw = g.measureText(st.name).width, th = font;
      // beside the dot, or over the station when close in
      const d = r + (current ? 12 : 4) * dpr, e = th + 4 * dpr;
      const spots: [number, number][] = dots ? [[x + d, y], [x - d - tw, y], [x - tw / 2, y - d - th / 2], [x - tw / 2, y + d + th / 2]]
        : [[x - tw / 2, y], [x - tw / 2, y - e], [x - tw / 2, y + e]];
      for (const [lx, ly] of spots) {
        const b = { x0: lx - 2 * dpr, x1: lx + tw + 2 * dpr, z0: ly - th / 2 - 2 * dpr, z1: ly + th / 2 + 2 * dpr };
        if (placed.some((q) => overlaps(q, b))) continue;
        placed.push(b);
        halo(g, st.name, lx, ly, dpr, current ? COLOUR.here : COLOUR.text);
        break;
      }
    }
  }

  // What moves or depends on where the player is: the platform or floor they stand on, the
  // trains, the stations' names over them, and the player.
  private paintLive(g: CanvasRenderingContext2D, v: View, player: MapPlayer, here: MapHere, mini: boolean) {
    const { s, dpr } = v, px = dpr / s;
    const view: Box = { x0: v.cx - v.w / 2 / s, x1: v.cx + v.w / 2 / s, z0: v.cz - v.h / 2 / s, z1: v.cz + v.h / 2 / s };
    g.setTransform(s, 0, 0, s, v.w / 2 - v.cx * s, v.h / 2 - v.cz * s);
    g.lineJoin = g.lineCap = 'round';
    // where the player stands
    g.fillStyle = COLOUR.here;
    g.globalAlpha = 0.85;
    if (this.platform) for (const st of this.platform.strips) g.fill(st.path);
    else if (here.floor && !here.ride) {
      g.beginPath();
      for (const [a, b, c] of here.floor.top) { g.moveTo(a.x, a.z); g.lineTo(b.x, b.z); g.lineTo(c.x, c.z); g.closePath(); }
      g.fill();
    }
    g.globalAlpha = 1;
    // the trains
    const p = new THREE.Vector3();
    for (const svc of [...this.trains.shuttles, ...(this.trains.timetable?.trips ?? [])]) {
      if (svc.state === 'wait') continue;
      const a = Math.max(svc.head - svc.trainLen, svc.shown[0]), b = Math.min(svc.head, svc.shown[1]);
      if (b <= a) continue;
      const pts: [number, number][] = [];
      const n = Math.max(1, Math.ceil((b - a) / 20));
      for (let i = 0; i <= n; i++) { svc.path.pointAt(a + ((b - a) * i) / n, p); pts.push([p.x, p.z]); }
      if (!pts.some(([x, z]) => x > view.x0 - 50 && x < view.x1 + 50 && z > view.z0 - 50 && z < view.z1 + 50)) continue;
      const ridden = svc === here.ride;
      // as wide as a train, close in
      const wide = Math.max(4 * px, 2.9);
      g.beginPath();
      pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z)));
      g.strokeStyle = ridden ? COLOUR.here : '#f4f6f8';
      g.lineWidth = wide + (ridden ? 3 : 1.5) * px;
      g.stroke();
      g.strokeStyle = svc.L.color;
      g.lineWidth = wide;
      g.stroke();
    }
    // the player, the stations' names clear of them
    const x = (player.pos.x - v.cx) * s + v.w / 2, y = (player.pos.z - v.cz) * s + v.h / 2;
    this.paintStations(g, v, here, mini, { x, y });
    g.setTransform(1, 0, 0, 1, 0, 0);
    arrow(g, x, y, player.yaw, (mini ? 9 : 12) * dpr, dpr);
  }
}

// ------------------------------------------------------------------ helpers
function renderPlan(renderer: THREE.WebGLRenderer, group: THREE.Object3D, bounds: THREE.Box3): Plan {
  // the plan drawn from above, north up, a few pixels a metre
  const pad = 10;
  const box = { x0: bounds.min.x - pad, x1: bounds.max.x + pad, z0: bounds.min.z - pad, z1: bounds.max.z + pad };
  const k = Math.min(4, 2048 / Math.max(box.x1 - box.x0, box.z1 - box.z0));
  const W = Math.round((box.x1 - box.x0) * k), H = Math.round((box.z1 - box.z0) * k);
  const scene = new THREE.Scene();
  scene.add(group);
  // With up = −z the view's vertical axis is −z, so the frustum's top/bottom are −z0 / −z1.
  const cam = new THREE.OrthographicCamera(box.x0, box.x1, -box.z0, -box.z1, 1, 2000);
  cam.position.set(0, 900, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  const px = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
  renderer.setRenderTarget(null);
  renderer.setClearColor(prevClear, prevAlpha);
  rt.dispose();
  scene.remove(group);

  const image = document.createElement('canvas');
  image.width = W; image.height = H;
  const ctx = image.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
  ctx.putImageData(img, 0, 0);
  return { image, box };
}

// A city tile from above: the land, the water and the buildings.
function rasterTile(d: CityTile, x0: number, z0: number) {
  const c = document.createElement('canvas');
  c.width = c.height = CITY_TILE * TILE_PX;
  const g = c.getContext('2d')!;
  g.scale(TILE_PX, TILE_PX);
  g.fillStyle = COLOUR.land;
  g.fillRect(0, 0, CITY_TILE, CITY_TILE);
  const gr = d.ground, w = d.water;
  if (gr && w) {
    g.fillStyle = COLOUR.water;
    const m = gr.n - 1, st = gr.step;
    for (let r = 0; r < m; r++) {
      // in runs along each row
      for (let c0 = 0; c0 < m; c0++) {
        if (!w.cells[r * m + c0]) continue;
        let c1 = c0;
        while (c1 + 1 < m && w.cells[r * m + c1 + 1]) c1++;
        g.fillRect(c0 * st - 0.1, r * st - 0.1, (c1 - c0 + 1) * st + 0.2, st + 0.2);
        c0 = c1;
      }
    }
  }
  g.translate(-x0, -z0);
  const fill = (kinds: string[], colour: string) => {
    const path = new Path2D();
    for (const b of d.buildings) {
      if (!kinds.includes(b.kind)) continue;
      for (const ring of b.rings) ring.forEach(([x, z], i) => (i ? path.lineTo(x, z) : path.moveTo(x, z)));
      path.closePath();
    }
    g.fillStyle = colour;
    g.fill(path);
  };
  fill(['roof'], COLOUR.roof);
  fill(['building', 'part', 'shed'], COLOUR.building);
  return c;
}

// The whole city's land and water (tools/build-map.ts), in the map's colours.
async function loadOverview() {
  const res = await fetch('data/map.json');
  if (!res.ok) throw new Error(`data/map.json: HTTP ${res.status}`);
  const o = await res.json() as MapOverview;
  const img = new Image();
  img.src = `data/${o.image}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = o.width; canvas.height = o.height;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, o.width, o.height);
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const land = rgb(COLOUR.land), water = rgb(COLOUR.water);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const v = px[i];
    const c = v === 2 ? water : v === 1 ? land : null;
    if (c) { px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; } else px[i + 3] = 0;
  }
  g.putImageData(data, 0, 0);
  return { canvas, box: { x0: o.x0, z0: o.z0, x1: o.x0 + o.width * o.step, z1: o.z0 + o.height * o.step } };
}

function arrow(g: CanvasRenderingContext2D, x: number, y: number, yaw: number, size: number, dpr: number) {
  g.save();
  g.translate(x, y);
  g.rotate(-yaw);
  g.fillStyle = COLOUR.player;
  g.strokeStyle = '#fff';
  g.lineWidth = 2 * dpr;
  g.beginPath();
  g.moveTo(0, -size); g.lineTo(size * 0.7, size * 0.75); g.lineTo(0, size * 0.35); g.lineTo(-size * 0.7, size * 0.75);
  g.closePath(); g.fill(); g.stroke();
  g.restore();
}

function halo(g: CanvasRenderingContext2D, text: string, x: number, y: number, dpr: number, colour = COLOUR.text) {
  g.lineJoin = 'round';
  g.strokeStyle = COLOUR.halo;
  g.lineWidth = 3.5 * dpr;
  g.strokeText(text, x, y);
  g.fillStyle = colour;
  g.fillText(text, x, y);
}

function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, align: CanvasTextAlign) {
  g.font = `700 ${size}px system-ui, sans-serif`;
  g.textAlign = align; g.textBaseline = 'middle';
  halo(g, text, x, y, size / 11);
}

// A bar a round number of metres long, about `max` device px or less, centred at x.
function scaleBar(g: CanvasRenderingContext2D, v: View, x: number, y: number, max: number) {
  const m = max / v.s;
  const step = [1, 2, 5].flatMap((k) => [1, 10, 100, 1000, 10000].map((p) => k * p)).filter((d) => d <= m).sort((a, b) => b - a)[0];
  if (!step) return;
  const w = step * v.s, d = v.dpr;
  g.strokeStyle = COLOUR.halo; g.lineWidth = 4 * d; g.lineCap = 'butt';
  g.beginPath(); g.moveTo(x - w / 2, y - 4 * d); g.lineTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.lineTo(x + w / 2, y - 4 * d); g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 1.5 * d;
  g.stroke();
  g.font = `600 ${10 * d}px system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'bottom';
  halo(g, step >= 1000 ? `${step / 1000} km` : `${step} m`, x, y - 4 * d, d);
}

function badge(colour: string, text: string) {
  return `<span class="ln" style="background:${colour}">${esc(text)}</span>`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
