// The game's world coordinates: metres on SWEREF 99 18 00 (EPSG:3011), the Stockholm zone of
// Sweden's national grid, around a fixed origin near T-Centralen. Heights are metres in RH 2000.
//
//   x = easting  − ORIGIN.e   (+x east)
//   z = ORIGIN.n − northing   (+z south)
//   y = height in RH 2000
//
// The zone's central meridian runs through Stockholm (18° E) with scale factor 1, so grid north is
// within 0.1° of true north and a metre on the grid is a metre on the ground. It is the grid the
// Nya tunnelbanan drawings use. Lantmäteriet's national data uses SWEREF 99 TM (15° E, scale
// 0.9996): GRID_TM converts to and from that.

export interface Grid { lon0: number; k0: number; fe: number; fn: number }

export const GRID_1800: Grid = { lon0: 18, k0: 1, fe: 150000, fn: 0 };
export const GRID_TM: Grid = { lon0: 15, k0: 0.9996, fe: 500000, fn: 0 };

// world (0, 0) in SWEREF 99 18 00
export const ORIGIN = { e: 153366, n: 6579602 };

// GRS 80
const A = 6378137, F = 1 / 298.257222101;
const E2 = F * (2 - F), N = F / (2 - F);
const AR = (A / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64);
const RAD = Math.PI / 180;

// Gauss–Krüger forward projection, after Lantmäteriet's formulas (better than 1 mm here).
export function project(lat: number, lon: number, g: Grid = GRID_1800) {
  const b1 = N / 2 - (2 / 3) * N ** 2 + (5 / 16) * N ** 3 + (41 / 180) * N ** 4;
  const b2 = (13 / 48) * N ** 2 - (3 / 5) * N ** 3 + (557 / 1440) * N ** 4;
  const b3 = (61 / 240) * N ** 3 - (103 / 140) * N ** 4;
  const b4 = (49561 / 161280) * N ** 4;
  const cA = E2, cB = (5 * E2 ** 2 - E2 ** 3) / 6, cC = (104 * E2 ** 3 - 45 * E2 ** 4) / 120, cD = (1237 * E2 ** 4) / 1260;
  const phi = lat * RAD, dl = (lon - g.lon0) * RAD;
  const s = Math.sin(phi), c = Math.cos(phi);
  const phiC = phi - s * c * (cA + cB * s ** 2 + cC * s ** 4 + cD * s ** 6);
  const xi = Math.atan2(Math.tan(phiC), Math.cos(dl));
  const eta = Math.atanh(Math.cos(phiC) * Math.sin(dl));
  const n = g.k0 * AR * (xi
    + b1 * Math.sin(2 * xi) * Math.cosh(2 * eta) + b2 * Math.sin(4 * xi) * Math.cosh(4 * eta)
    + b3 * Math.sin(6 * xi) * Math.cosh(6 * eta) + b4 * Math.sin(8 * xi) * Math.cosh(8 * eta)) + g.fn;
  const e = g.k0 * AR * (eta
    + b1 * Math.cos(2 * xi) * Math.sinh(2 * eta) + b2 * Math.cos(4 * xi) * Math.sinh(4 * eta)
    + b3 * Math.cos(6 * xi) * Math.sinh(6 * eta) + b4 * Math.cos(8 * xi) * Math.sinh(8 * eta)) + g.fe;
  return { e, n };
}

// Latitude/longitude (WGS 84 / SWEREF 99, which agree to a few decimetres) to world x, z.
export function lonLatToWorld(lon: number, lat: number) {
  const { e, n } = project(lat, lon);
  return { x: e - ORIGIN.e, z: ORIGIN.n - n };
}
