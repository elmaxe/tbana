import type * as THREE from 'three';
import type { Destination, Line } from './lines';
import type { Car, Train } from './rolling-stock/train';
import type { Polyline } from './polyline';
import type { Platform, Track } from './station';

// A train in service, and how it runs: along a path, stopping at its stops with the doors open,
// then on to the end of the path. Two kinds run this way: the shuttles of src/trains.ts, one per
// platform track of a station model, which come out of the tunnel, stop and go back into it; and
// the trips of src/timetable.ts, which run a route through the track network from end to end.

export const ACC = 1.0;      // m/s², braking and acceleration
export const DWELL = 22;     // seconds at least at a stop, from stopping to the closing chime
export const DOORS_OPEN = 2.2, DOORS_SHUT = 2.8;     // seconds for the doors to open / close
export const OPEN_DELAY = 0.8, SHUT_DELAY = 1.2;     // after stopping / after the closing chime
export const LEAVE_DELAY = 1.0;                      // from closed doors to pulling away
// from the closing chime to pulling away
export const CLOSING = SHUT_DELAY + DOORS_SHUT + LEAVE_DELAY;

export const RAIL_TOP = 0.99; // the rail head sits this far below the track path (platform level)

// wait: off the track; run: on the way to the next stop, or after the last to the end of the path;
// dwell: at a stop with the doors open; closing: the chime has sounded and the doors close
export type State = 'wait' | 'run' | 'dwell' | 'closing';

// Where the train stands at a stop: the distance of its front along the path, the side of the
// platform seen in the direction of travel (+1 right, −1 left), and the time before which it
// doesn't close its doors.
export interface Stop { station: string; head: number; side: 1 | -1; until: number }

export interface ServiceCar {
  object: THREE.Object3D;
  length: number;
  offset: number;  // from the front of the train to the car's centre
  yaw: number;
  car: Car | null; // the procedural model's car, which has doors and a floor
  floorData: CarFloorData | null;
}

// What the player stands on inside a car.
export interface CarFloorData {
  kind: 'train';
  rec: { readonly label: string };
  svc: Service;
  car: ServiceCar;
}

// A station model's track with its single train (src/trains.ts).
export interface Shuttle {
  tr: Track & { platform: Platform };
  destSet: Destination[];
  next: string; // the next station beyond the tunnel
}

// A timetabled trip along a route of the network (src/timetable.ts).
export interface TripInfo {
  route: string;
  k: number;      // its number in the timetable
  spawn: number;  // the time it set off, on the trains' clock
}

export interface Service {
  id: number;
  L: Line;
  vmax: number;
  cars: ServiceCar[];
  model: Train | null;
  trainLen: number;
  path: Polyline;           // in the direction of travel
  shown: [number, number];  // the part of the path along which the cars are drawn
  stops: Stop[];
  stop: number;             // the next stop, or the one it stands at; stops.length after the last
  end: number;              // where the front is when the run is over
  state: State;
  timer: number;            // seconds since stopping, or since the closing chime; or to wait
  head: number;             // the distance of the front along the path
  speed: number;
  limit: number;            // the speed the line ahead allows (Infinity when clear)
  doors: number;            // 0 closed … 1 open
  dest: Destination;
  shuttle?: Shuttle;
  trip?: TripInfo;
}

export type ServiceEvent = 'arrived' | 'closing' | 'departed' | 'done' | null;

// One step of a train's run, at `clock` on the trains' clock; returns what happened.
export function advance(svc: Service, dt: number, clock: number): ServiceEvent {
  switch (svc.state) {
    case 'wait': return null;
    case 'run': {
      const stopping = svc.stop < svc.stops.length;
      const rem = Math.max(0, (stopping ? svc.stops[svc.stop].head : svc.end) - svc.head);
      const brake = stopping ? Math.sqrt(2 * ACC * rem) + 0.15 : Infinity;
      svc.speed = Math.max(0, Math.min(svc.vmax, brake, svc.limit, svc.speed + ACC * dt));
      const step = Math.min(rem, svc.speed * dt);
      svc.head += step;
      if (!stopping) return rem - step < 0.01 ? 'done' : null;
      if (rem - step < 0.01) {
        svc.state = 'dwell'; svc.timer = 0; svc.speed = 0;
        return 'arrived';
      }
      return null;
    }
    case 'dwell':
      svc.timer += dt;
      if (svc.timer > OPEN_DELAY) svc.doors = Math.min(1, svc.doors + dt / DOORS_OPEN);
      if (svc.timer >= DWELL && clock >= svc.stops[svc.stop].until) {
        svc.state = 'closing'; svc.timer = 0;
        return 'closing';
      }
      return null;
    case 'closing':
      svc.timer += dt;
      if (svc.timer > SHUT_DELAY) svc.doors = Math.max(0, svc.doors - dt / DOORS_SHUT);
      if (svc.doors === 0 && svc.timer > CLOSING) {
        svc.state = 'run'; svc.speed = 0; svc.stop++;
        return 'departed';
      }
      return null;
  }
}

// The station the train is at or on its way to, if any.
export function nextStation(svc: Service) {
  if (svc.stop < svc.stops.length) return svc.stops[svc.stop].station;
  return svc.shuttle?.next ?? '';
}
