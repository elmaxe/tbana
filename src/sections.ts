// Typical cross-sections of the red line's track and structures, in metres, from the standard
// sections in the 1952 and 1975 technical descriptions ("Stockholms tunnelbanesystem", 1952,
// figure 6; "Stockholms tunnelbanor '75", pages 25, 38, 82, 102 and 129–151; see
// docs/red-line-plan.md). Lateral distances are from a track's centre line, heights from the top
// of its rails.

// between the two tracks of a line on straight track (1975, the red line's standard)
export const TRACK_CENTRES = 3.15;
// from a track's centre to the platform edge (the game's trains: half width 1.45 m, 0.12 m gap)
export const PLATFORM_EDGE = 1.57;
export const PLATFORM_HEIGHT = 1.0;
// platform widths where OpenStreetMap doesn't give a usable one: an island between two tracks in
// a rock station (1952: 6–9 m), and a platform on one side
export const ISLAND_WIDTH = 9;
export const SIDE_PLATFORM_WIDTH = 5;

export const GAUGE = 1.435;
export const RAIL = { head: 0.07, height: 0.15 };
// concrete sleepers 2.4 m long at 0.741 m (1975), in a ballast bed whose top is at the sleepers
export const SLEEPER = { length: 2.4, spacing: 0.741 };
export const BALLAST = { top: -0.2, halfWidth: 1.6, toe: 2.2 };
// the formation under the ballast, and the rock or concrete floor of a tunnel
export const FLOOR = -0.6;
// The conductor rail: 60 kg/m, top contact, 1.40 m out on the side away from the other track and
// from the platform, its top 0.1 m above the rails; a wooden cover board over it on brackets.
export const THIRD_RAIL = { offset: 1.4, top: 0.1, width: 0.08, height: 0.12, coverAbove: 0.2, coverWidth: 0.42 };

// Rock tunnels. Double track: 8.0 m wide (1975), so 2.425 m from each track to its wall;
// vertical walls to 3.2 m and a segmental arch to 4.6 m. Single track: 1.9 m to the wall on the
// conductor rail's side and 2.4 m on the other, where the refuge is; walls to 3.45 m and the
// crown at 4.45 m (1952).
export const ROCK = {
  doubleWall: 2.425, doubleSpring: 3.2, doubleCrown: 4.6,
  singleNear: 1.9, singleFar: 2.4, singleSpring: 3.45, singleCrown: 4.45,
};
// A station hall in rock: the platform, then this much room to the wall; the vault rises with
// its width.
export const HALL = { behindPlatform: 0.6, spring: 3.6, risePerWidth: 0.22 };
// Concrete box (cut and cover): the same widths, a flat roof 4.2 m above the rails with haunched
// corners, walls 0.55 m and roof 0.6 m thick.
export const BOX = { height: 4.2, haunch: 0.45, wall: 0.55, roof: 0.6 };
// Open cutting between concrete retaining walls, 0.3 m thick, 2.7 m out, to above the ground.
export const CUTTING = { wall: 2.7, thickness: 0.3, aboveGround: 0.8 };
// Embankment (Hallunda, 1975): formation about 10.8 m wide for two tracks, slopes 1:2.
export const EMBANKMENT = { formation: 3.8, slope: 2 };
// Bridge deck: about 8.4 m wide for two tracks (the 1952 viaduct), girders 0.8–1.0 m deep,
// a railing at the edge.
export const BRIDGE = { deck: 2.6, depth: 1.0, railing: 1.1 };
// Lights: every 10 m on alternate walls in double-track tunnels, every 7 m on one wall in
// single-track ones (1975), at about 2.6 m.
export const TUNNEL_LIGHT = { double: 10, single: 7, height: 2.6 };

// A segmental arch from (a, spring) to (b, spring) rising by `rise` at the middle: the height at u.
export function archHeight(a: number, b: number, spring: number, rise: number, u: number) {
  const half = (b - a) / 2, mid = (a + b) / 2;
  if (rise <= 1e-6) return spring;
  const r = (half * half + rise * rise) / (2 * rise);
  const du = Math.min(half, Math.abs(u - mid));
  return spring + rise - r + Math.sqrt(r * r - du * du);
}
