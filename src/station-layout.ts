// The stations on the network, as tools/build-stations.ts writes them to
// public/data/station-layouts.json from their descriptions in data/station-descriptions.json:
// each one a set of parts in world coordinates (src/geo.ts), which src/stations.ts builds.
// It imports only src/clip.ts, with its extension, so the tools can use it on Node too.
import { prism } from './clip.ts';
import type { Volume } from './clip.ts';

export type XYZ = [number, number, number];

// A level floor or a gentle ramp: a quadrilateral, corners in order around it, with the room's
// clear height above it (none out in the open).
export interface FloorPart {
  kind: 'floor';
  corners: XYZ[];
  ceiling: number | null;
  room: 'platform' | 'hall' | 'passage';
  label: string;
}

// Stairs or escalators from the middle of the bottom step `a` to the middle of the top one `b`,
// `width` wide, with `lanes` across from the left looking up: E an escalator, S stairs. `ceiling`
// is the clear height above the steps. An exit's stairs end in the street at `open`: from where
// the ceiling would rise above the street there is none, and the walls stop at a parapet.
export interface InclinePart {
  kind: 'incline';
  a: XYZ;
  b: XYZ;
  width: number;
  lanes: string;
  ceiling: number;
  open?: number;
  label: string;
}

// A lift shaft standing at x, z, its door facing `yaw` (radians, as the player's: 0 looks north),
// stopping at each of `levels`, and reaching `above` its top stop (LIFT.above by default).
export interface LiftPart { kind: 'lift'; x: number; z: number; yaw: number; levels: number[]; above?: number }

// A row of ticket gates across a passage, centred at x, y, z, facing along `yaw`.
export interface GatesPart { kind: 'gates'; x: number; y: number; z: number; yaw: number; width: number }

// The ground around a station's exits: a grid of heights, `step` m apart, row by row from x0, z0
// (north-west) to the east and south; null where there is none.
export interface StreetPart { kind: 'street'; x0: number; z0: number; step: number; nx: number; nz: number; h: (number | null)[] }

// The inside of a station hall the network draws (a platform's), which the station's parts open
// into: up to where the hall's vault or roof begins.
export interface VoidPart { kind: 'void'; corners: [number, number][]; y0: number; y1: number }

// A roof over an open platform: along the points, `width` wide, its underside at their heights,
// CANOPY_HEIGHT over the platform's top.
export interface CanopyPart { kind: 'canopy'; points: XYZ[]; width: number }
export const CANOPY_HEIGHT = 3.2;

// A sign at an exit: the station's name over the way down, facing `yaw`.
export interface SignPart { kind: 'sign'; x: number; y: number; z: number; yaw: number; text: string }

export type Part = FloorPart | InclinePart | LiftPart | GatesPart | StreetPart | VoidPart | CanopyPart | SignPart;

export interface Exit { name: string; x: number; y: number; z: number; yaw: number }

export interface StationLayout {
  name: string;
  x: number; z: number; // the middle of its platforms
  yaw: number;          // looking along them (as the player's yaw: 0 looks north)
  platformY: number;
  parts: Part[];
  exits: Exit[];
}

export interface StationLayouts { attribution: string; note: string; stations: StationLayout[] }

// Slopes: stairs rise 0.16 m in 0.30 m, escalators at 30°.
export const STAIR_SLOPE = 0.16 / 0.3;
export const ESCALATOR_SLOPE = Math.tan(Math.PI / 6);
export const LANE = { E: 1.6, S: 2.0, s: 1.5 }; // escalators, stairs, narrower stairs
export const LIFT = { width: 2.2, depth: 2.4, above: 3.0, below: 0.6 };

// The plan of an incline: its corners, left and right at the bottom, then right and left at the top.
export function inclineCorners(p: InclinePart): [number, number][] {
  const dx = p.b[0] - p.a[0], dz = p.b[2] - p.a[2], l = Math.hypot(dx, dz) || 1;
  // to the right looking up the incline (+x east, +z south: right of north is east)
  const rx = (-dz / l) * (p.width / 2), rz = (dx / l) * (p.width / 2);
  return [[p.a[0] - rx, p.a[2] - rz], [p.a[0] + rx, p.a[2] + rz], [p.b[0] + rx, p.b[2] + rz], [p.b[0] - rx, p.b[2] - rz]];
}

// The heights of a floor's or an incline's walking surface at its corners (as inclineCorners).
export function floorHeights(p: FloorPart | InclinePart) {
  return p.kind === 'floor' ? p.corners.map((c) => c[1]) : [p.a[1], p.a[1], p.b[1], p.b[1]];
}

export function liftCorners(p: LiftPart): [number, number][] {
  // the door faces yaw: the direction (−sin yaw, −cos yaw)
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = -fz, rz = fx;
  const w = LIFT.width / 2, d = LIFT.depth / 2;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [p.x + rx * w * i + fx * d * j, p.z + rz * w * i + fz * d * j]);
}

// The open space of a part: from just above its floor to its ceiling; for the parts that have one.
// It cuts the walls, floors and ceilings it runs into: the network's tunnels and the station's
// other parts.
export function spaceOf(p: Part): Volume | null {
  const lift = 0.02;
  if (p.kind === 'floor' || p.kind === 'incline') {
    const corners = p.kind === 'floor' ? p.corners.map((c): [number, number] => [c[0], c[2]]) : inclineCorners(p);
    const h = floorHeights(p);
    const c = p.ceiling ?? 3;
    return prism(corners, h.map((y) => y + lift), h.map((y) => y + c));
  }
  if (p.kind === 'lift') {
    const y0 = Math.min(...p.levels), y1 = Math.max(...p.levels);
    return prism(liftCorners(p), [0, 1, 2, 3].map(() => y0 - LIFT.below), [0, 1, 2, 3].map(() => y1 + (p.above ?? LIFT.above)));
  }
  if (p.kind === 'void') return prism(p.corners, p.corners.map(() => p.y0), p.corners.map(() => p.y1));
  return null;
}

// Under an incline, from its floor down to its foot: solid, so nobody walks underneath it from
// the floor it stands on.
export function solidOf(p: InclinePart): Volume {
  const h = floorHeights(p);
  const foot = Math.min(p.a[1], p.b[1]) - 0.05;
  return prism(inclineCorners(p), h.map(() => foot), h.map((y) => y - 0.02));
}
