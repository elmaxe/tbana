// Squares and streets on decks over the tracks (data/ground-corrections.json), which the elevation
// model leaves out: the ground's height on one at a point, for the tools that build the city's
// ground and the stations' streets.
import { existsSync, readFileSync } from 'node:fs';

interface Deck { name: string; outline: number[]; heights: number[]; why: string }

const decks: { ring: [number, number][]; plane: [number, number, number] }[] = existsSync('data/ground-corrections.json')
  ? (JSON.parse(readFileSync('data/ground-corrections.json', 'utf8')).decks as Deck[]).map((d) => {
    const ring = Array.from({ length: d.outline.length / 2 }, (_, i): [number, number] => [d.outline[2 * i], d.outline[2 * i + 1]]);
    if (d.heights.length !== ring.length) throw new Error(`data/ground-corrections.json: ${d.name} has ${ring.length} points and ${d.heights.length} heights`);
    return { ring, plane: planeThrough(ring, d.heights) };
  })
  : [];

// the plane h = a + b·x + c·z through the points' heights (the best fit, by least squares; about
// the points' middle, so that the sums stay small)
function planeThrough(ring: [number, number][], heights: number[]): [number, number, number] {
  const n = ring.length, mx = ring.reduce((t, p) => t + p[0], 0) / n, mz = ring.reduce((t, p) => t + p[1], 0) / n;
  const mh = heights.reduce((t, h) => t + h, 0) / n;
  let xx = 0, xz = 0, zz = 0, xh = 0, zh = 0;
  ring.forEach(([x, z], i) => {
    const dx = x - mx, dz = z - mz, dh = heights[i] - mh;
    xx += dx * dx; xz += dx * dz; zz += dz * dz; xh += dx * dh; zh += dz * dh;
  });
  const det = xx * zz - xz * xz;
  const b = det ? (xh * zz - zh * xz) / det : 0, c = det ? (zh * xx - xh * xz) / det : 0;
  return [mh - b * mx - c * mz, b, c];
}

function inside(x: number, z: number, ring: [number, number][]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

// the height of the deck at x, z, or null where there is none
export function deckAt(x: number, z: number): number | null {
  for (const d of decks) if (inside(x, z, d.ring)) return d.plane[0] + d.plane[1] * x + d.plane[2] * z;
  return null;
}
