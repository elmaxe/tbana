// Places to put the camera: on a platform, over a point, in the cab of a train on the track, at
// an exit. A view is where the eye is, and the heading and pitch it looks at (as the player's).
import type { Exit } from '../station-layout';
import type { Sample, TrackIndex } from './data';
import type { World } from './world';

export interface View { eye: [number, number, number]; yaw: number; pitch: number }

const EYE = 1.65;

// Looking from `eye` at a point.
export function looking(eye: [number, number, number], [x, y, z]: [number, number, number]): View {
  const dx = x - eye[0], dy = y - eye[1], dz = z - eye[2];
  return { eye, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

// The ground at (x, z) as far as anything knows it: the city's, where its tile is built, or the
// drawn track's nearby.
export function groundAt(world: World, track: TrackIndex, x: number, z: number) {
  const city = world.city?.heightAt(x, z);
  if (city !== null && city !== undefined) return city;
  const sm = track.nearest(x, z, 400);
  return (sm && track.geometry.pieces[sm.piece].ground[sm.i]) ?? sm?.y ?? 20;
}

// From the air, looking down on (x, y, z) from the south (or along `yaw`), 150 m off.
export function aerial(world: World, track: TrackIndex, x: number, z: number, y?: number, yaw = 0): View {
  const ground = groundAt(world, track, x, z);
  const at: [number, number, number] = [x, y ?? ground, z];
  const back = 150, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  return looking([x - fx * back, Math.max(ground, at[1]) + 110, z - fz * back], at);
}

// At eye height over the track, looking along it (from the piece's `from` end to its `to` end,
// or back with dir −1), as from a train's cab.
export function onTrack(track: TrackIndex, sm: Sample, dir: 1 | -1 = 1): View {
  return { eye: [sm.x, sm.y + 0.9 + EYE, sm.z], yaw: track.heading(sm) + (dir < 0 ? Math.PI : 0), pitch: -0.03 };
}

// Standing on a station's platform, looking along it.
export function onPlatform(world: World, name: string): View | null {
  const spot = world.stations?.spot(name);
  if (spot) return { eye: [spot.pos.x, spot.pos.y + EYE, spot.pos.z], yaw: spot.yaw, pitch: 0 };
  // a station drawn from a model: its red line platform (T-Centralen's), or its green line one
  const t = world.station?.teleports.find((p) => p.station === name && p.line === 'red')
    ?? world.station?.teleports.find((p) => p.station === name && p.line === 'green');
  return t ? { eye: [t.pos.x, t.pos.y + EYE, t.pos.z], yaw: t.yaw, pitch: 0 } : null;
}

// Out in the street, looking back at an exit's way down.
export function atExit(e: Exit): View {
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
  return looking([e.x + fx * 14, e.y + 6, e.z + fz * 14], [e.x, e.y, e.z]);
}
