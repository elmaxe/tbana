// Draws a traced service's side view as an SVG: the top of the rail along the route, the ground
// above it, tunnels and bridges, and the stations with their heights from Wikidata.
//
//   node tools/plot-profile.ts "T13 Norsborg" [out.svg] [from km] [to km]
//
// The first argument picks the first route whose name starts with it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { TrackGraph } from '../src/track-graph.ts';
import { routeProfile } from './lib/graph.ts';

const [which = 'T13', out = 'profile.svg', fromKm, toKm] = process.argv.slice(2);
const graph: TrackGraph = JSON.parse(readFileSync('public/data/track-graph.json', 'utf8'));
const heights: Record<string, number[]> = JSON.parse(readFileSync('public/data/track-heights.json', 'utf8')).pieces;
const stationHeights: Record<string, { height: number }> = JSON.parse(readFileSync('data/station-heights.json', 'utf8')).stations;
const ground: [number, number, number][] = existsSync('data/ground/red-line.json')
  ? JSON.parse(readFileSync('data/ground/red-line.json', 'utf8')).samples : [];

const route = graph.routes.find((r) => r.name.startsWith(which));
if (!route) throw new Error(`no route starting with "${which}": ${graph.routes.map((r) => r.name).join(', ')}`);
let prof = routeProfile(graph, route, heights);
const s0 = fromKm ? Number(fromKm) * 1000 : 0, s1 = toKm ? Number(toKm) * 1000 : prof[prof.length - 1].s;
prof = prof.filter((p) => p.s >= s0 && p.s <= s1);

const groundGrid = new Map<string, [number, number, number][]>();
for (const g of ground) {
  const key = `${Math.floor(g[0] / 10)},${Math.floor(g[1] / 10)}`;
  const list = groundGrid.get(key);
  if (list) list.push(g); else groundGrid.set(key, [g]);
}
const groundAt = (x: number, z: number) => {
  let best: number | null = null, bestD = 6;
  for (let i = Math.floor(x / 10) - 1; i <= Math.floor(x / 10) + 1; i++) for (let j = Math.floor(z / 10) - 1; j <= Math.floor(z / 10) + 1; j++) {
    for (const g of groundGrid.get(`${i},${j}`) ?? []) {
      const d = Math.hypot(g[0] - x, g[1] - z);
      if (d < bestD) { bestD = d; best = g[2]; }
    }
  }
  return best;
};

// where each stop is along the profile
const stops = route.stops.map((st) => {
  const at = prof.reduce((a, p) => (p.piece === st.piece && (!a || Math.abs(p.s - a.s) > 0) ? p : a), null as (typeof prof)[number] | null);
  const near = prof.filter((p) => p.piece === st.piece);
  const best = near.length ? near.reduce((a, b) => (Math.abs(b.y) >= 0 && Math.hypot(b.x - pointX(st), b.z - pointZ(st)) < Math.hypot(a.x - pointX(st), a.z - pointZ(st)) ? b : a)) : at;
  return { name: st.station, p: best, h: stationHeights[st.station]?.height };
});
function pointX(st: { piece: number; s: number }) { return pieceAt(st)[0]; }
function pointZ(st: { piece: number; s: number }) { return pieceAt(st)[1]; }
function pieceAt(st: { piece: number; s: number }): [number, number] {
  const p = graph.pieces[st.piece];
  let s = st.s;
  for (let i = 1; i < p.points.length; i++) {
    const [ax, az] = p.points[i - 1], [bx, bz] = p.points[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (s <= len) return [ax + ((bx - ax) * s) / (len || 1), az + ((bz - az) * s) / (len || 1)];
    s -= len;
  }
  return p.points[p.points.length - 1];
}

const gs = prof.map((p) => groundAt(p.x, p.z));
const ys = [...prof.map((p) => p.y), ...gs.filter((g): g is number => g !== null)];
const yMin = Math.floor(Math.min(...ys) / 10) * 10 - 10, yMax = Math.ceil(Math.max(...ys) / 10) * 10 + 10;
const W = 1800, H = 520, L = 60, R = 20, T = 40, B = 60;
const X = (s: number) => L + ((s - prof[0].s) / (prof[prof.length - 1].s - prof[0].s || 1)) * (W - L - R);
const Y = (y: number) => T + ((yMax - y) / (yMax - yMin)) * (H - T - B);
const parts: string[] = [];

// tunnels and bridges as bands
let band: { kind: string; a: number } | null = null;
const flushBand = (end: number) => {
  if (band && band.kind !== 'surface') {
    parts.push(`<rect x="${X(band.a)}" y="${T}" width="${Math.max(0.5, X(end) - X(band.a))}" height="${H - T - B}" fill="${band.kind === 'tunnel' ? '#eee6dc' : '#dce8f3'}"/>`);
  }
};
for (const p of prof) {
  if (!band || band.kind !== p.structure) { flushBand(p.s); band = { kind: p.structure, a: p.s }; }
}
flushBand(prof[prof.length - 1].s);

// grid
for (let y = yMin; y <= yMax; y += 10) {
  parts.push(`<line x1="${L}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}" stroke="${y === 0 ? '#7aa' : '#ddd'}"/><text x="${L - 6}" y="${Y(y) + 4}" font-size="11" text-anchor="end">${y}</text>`);
}
for (let km = Math.ceil(prof[0].s / 1000); km * 1000 <= prof[prof.length - 1].s; km++) {
  parts.push(`<text x="${X(km * 1000)}" y="${H - B + 16}" font-size="11" text-anchor="middle">${km} km</text>`);
}
// ground
let d = '';
prof.forEach((p, i) => { const g = gs[i]; if (g === null) { d += ' '; return; } d += `${d.endsWith(' ') || !d ? 'M' : 'L'}${X(p.s).toFixed(1)} ${Y(g).toFixed(1)}`; });
if (d.trim()) parts.push(`<path d="${d.replace(/ +/g, ' ').trim()}" fill="none" stroke="#6a8f3a" stroke-width="1.5"/>`);
// rail
parts.push(`<path d="M${prof.map((p) => `${X(p.s).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('L')}" fill="none" stroke="#d71d24" stroke-width="2"/>`);
// stations
for (const st of stops) {
  if (!st.p) continue;
  parts.push(`<line x1="${X(st.p.s)}" x2="${X(st.p.s)}" y1="${T}" y2="${Y(st.p.y)}" stroke="#999" stroke-dasharray="2 3"/>`);
  if (st.h !== undefined) parts.push(`<circle cx="${X(st.p.s)}" cy="${Y(st.h - 1)}" r="4" fill="none" stroke="#000"/>`);
  parts.push(`<text transform="translate(${X(st.p.s) + 4},${T - 4}) rotate(-30)" font-size="11">${st.name}</text>`);
}
const title = `${route.name}: top of rail (red), ground (green), Wikidata station height − 1 m (circles); tunnels brown, bridges blue. Heights in m RH 2000.`;
writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 30}" viewBox="0 0 ${W} ${H + 30}" style="background:#fff;font-family:sans-serif">${parts.join('')}<text x="${L}" y="${H + 20}" font-size="12">${title}</text></svg>\n`);
console.log(`wrote ${out}`);
