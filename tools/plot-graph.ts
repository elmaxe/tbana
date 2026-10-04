// Draws part of the track graph as an SVG, for checking it by eye.
//
//   node tools/plot-graph.ts <station name or x,z> [radius m] [out.svg]
//
// Running lines are dark, other tracks grey; switches are dots, ends are bars, platform tracks
// are thick. The traced services are drawn beside their tracks, offset to the side they run on
// relative to the track's direction, so a service running on the left shows up to the left of
// its direction of travel. Piece ids are printed along the pieces when zoomed in (radius up to
// 1500 m).
import { readFileSync, writeFileSync } from 'node:fs';
import type { TrackGraph } from '../src/track-graph.ts';

const g: TrackGraph = JSON.parse(readFileSync('public/data/track-graph.json', 'utf8'));
const [where, radiusArg, out = 'graph.svg'] = process.argv.slice(2);
const radius = Number(radiusArg) || 400;
let cx: number, cz: number;
const st = g.stations.find((s) => s.name.toLowerCase() === (where || '').toLowerCase());
if (st) ({ x: cx, z: cz } = st);
else [cx, cz] = (where || '0,0').split(',').map(Number);

const W = 1200, S = W / (2 * radius);
const X = (x: number) => ((x - cx + radius) * S).toFixed(1), Z = (z: number) => ((z - cz + radius) * S).toFixed(1);
const inView = (x: number, z: number) => Math.abs(x - cx) < radius * 1.2 && Math.abs(z - cz) < radius * 1.2;
const parts: string[] = [];
const ROUTE_COLOURS = ['#d71d24', '#e6862a', '#2a7de6', '#7a2ae6'];

const pieceById = new Map(g.pieces.map((p) => [p.id, p]));
function pointAt(pts: [number, number][], s: number): [number, number] {
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (s <= len || i === pts.length - 1) {
      const t = len ? Math.min(1, s / len) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    s -= len;
  }
  return pts[0];
}
// a polyline shifted sideways: + to the right of its direction (x east, z south)
function offset(pts: [number, number][], d: number): [number, number][] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [p[0] - ((b[1] - a[1]) / len) * d, p[1] + ((b[0] - a[0]) / len) * d];
  });
}
const path = (pts: [number, number][]) => 'M' + pts.map(([x, z]) => `${X(x)} ${Z(z)}`).join('L');

for (const p of g.pieces) {
  if (!p.points.some(([x, z]) => inView(x, z))) continue;
  parts.push(`<path d="${path(p.points)}" fill="none" stroke="${p.service === 'main' ? '#333' : '#aaa'}" stroke-width="1.5"/>`);
  const [mx, mz] = pointAt(p.points, p.length / 2);
  if (radius <= 1500 && inView(mx, mz)) parts.push(`<text x="${X(mx)}" y="${Z(mz)}" font-size="10" fill="#06c">${p.id}</text>`);
}
for (const s of g.stations) {
  for (const pl of s.platforms) {
    for (const t of pl.tracks) {
      const p = pieceById.get(t.piece)!;
      const pts: [number, number][] = [];
      for (let d = t.s0; d <= t.s1; d += 2) pts.push(pointAt(p.points, d));
      parts.push(`<path d="${path(offset(pts, t.side === 'right' ? 2.5 : -2.5))}" fill="none" stroke="#c9a400" stroke-width="5" opacity="0.7"/>`);
    }
  }
  if (inView(s.x, s.z)) parts.push(`<text x="${X(s.x)}" y="${Z(s.z)}" font-size="14" font-weight="bold">${s.name}</text>`);
}
g.routes.forEach((r, i) => {
  for (const step of r.path) {
    const p = pieceById.get(step.piece)!;
    if (!p.points.some(([x, z]) => inView(x, z))) continue;
    const pts = step.dir === 1 ? p.points : [...p.points].reverse();
    // drawn on the left of the direction of travel, so a train running on the left-hand track
    // appears between its track and the other one
    parts.push(`<path d="${path(offset(pts, -1.6))}" fill="none" stroke="${ROUTE_COLOURS[i % 4]}" stroke-width="1.5" stroke-dasharray="6 3"/>`);
  }
});
for (const n of g.nodes) {
  if (!inView(n.x, n.z) || radius > 1500) continue;
  if (n.kind === 'switch' || n.kind === 'crossing') parts.push(`<circle cx="${X(n.x)}" cy="${Z(n.z)}" r="3" fill="${n.through?.length ? '#090' : '#f00'}"/>`);
  if (n.kind === 'end') parts.push(`<circle cx="${X(n.x)}" cy="${Z(n.z)}" r="4" fill="none" stroke="#f00"/>`);
}
const legend = g.routes.map((r, i) => `<text x="10" y="${20 + 16 * i}" font-size="13" fill="${ROUTE_COLOURS[i % 4]}">${r.name}</text>`).join('');
writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}" style="background:#fff">${parts.join('')}${legend}</svg>\n`);
console.log(`wrote ${out}`);
