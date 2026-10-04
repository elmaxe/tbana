import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LINES, TRAIN_SPECS } from './lines';
import type { Destination, Line, ServiceSpec } from './lines';
import * as T from './textures';
import { createTrain, SERVICE_UNITS } from './rolling-stock/index';
import type { Car, CarFloor, Train } from './rolling-stock/train';
import type { Platform, SurfaceRecord, Track } from './station';
import type { Sound } from './sound';
import type { SurfaceHit } from './surface-index';

const ACC = 1.0;      // m/s², braking and acceleration
const DWELL = 22;     // seconds at the platform, from stopping to the closing chime
const DOORS_OPEN = 2.2, DOORS_SHUT = 2.8;     // seconds for the doors to open / close
const OPEN_DELAY = 0.8, SHUT_DELAY = 1.2;     // after stopping / after the closing chime
const LEAVE_DELAY = 1.0;                      // from closed doors to pulling away

export const RAIL_TOP = 0.99; // the rail head sits this far below the track path (platform level)
const INTERIOR_NEAR = 30, INTERIOR_FAR = 36; // metres from a car's end: interior on / off
const R = 0.25;        // the player's radius when walking in a car
const LEAVE_AT = 28;   // a ridden car this close to the end of its track ends the ride

type State = 'wait' | 'arrive' | 'dwell' | 'closing' | 'depart';

export interface ServiceCar {
  object: THREE.Object3D;
  length: number;
  offset: number;  // from the front of the train to the car's centre
  yaw: number;
  car: Car | null; // the procedural model's car, which has doors and a floor
  floorData: CarFloorData | null;
}

// A track with its single train: waits in the tunnel, arrives, dwells, departs, repeats.
export interface Service {
  tr: Track & { platform: Platform };
  spec: ServiceSpec;
  L: Line;
  cars: ServiceCar[];
  model: Train | null;
  trainLen: number;
  stopHead: number;
  startHead: number;
  endHead: number;
  state: State;
  timer: number;
  head: number;
  speed: number;
  doors: number;   // 0 closed … 1 open
  dest: Destination;
  destSet: Destination[];
  next: string;    // the next station in this direction
}

// What the player stands on inside a car.
export interface CarFloorData {
  kind: 'train';
  rec: { readonly label: string };
  svc: Service;
  car: ServiceCar;
}

// The player inside a car: their position and heading relative to it.
export interface Ride {
  svc: Service;
  car: ServiceCar;
  local: THREE.Vector3;
  yaw: number;
}

// One train per platform track. Metro lines run the procedural C20/C30 models, whose doors open at
// the platform and whose cars can be walked through and ridden; other lines get simple textured boxes.
export class Trains {
  services: Service[] = [];
  private _p = new THREE.Vector3();
  private _q = new THREE.Vector3();

  constructor(scene: THREE.Scene, tracks: Track[], public sound: Sound | null,
    { renderer = null, quality = 1 }: { renderer?: THREE.WebGLRenderer | null; quality?: number } = {}) {
    const matCache = new Map<string, THREE.Material>();
    const endTex = T.trainEnd();
    const endMat = new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x9ea4ab, roughness: 0.5, metalness: 0.4 });
    const underMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 1 });
    // reflections for the stainless steel and glass of the models
    let envMap: THREE.Texture | null = null;
    if (renderer) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }

    for (const tr of tracks) {
      const L = LINES[tr.line];
      if (!hasPlatform(tr) || !L.dest || (L.kind !== 'metro' && L.kind !== 'commuter')) continue;
      const spec = TRAIN_SPECS[L.kind];
      const platLen = tr.platform.s1 - tr.platform.s0;
      let cars: ServiceCar[], trainLen: number, model: Train | null = null;
      if (L.train) {
        // as many units as fit the platform (normally a full 140 m train)
        let m!: Train;
        for (let units = SERVICE_UNITS[L.train]; units >= 1; units--) {
          m = createTrain(L.train, { units, quality, envMap, envMapIntensity: 0.45, interior: false });
          if (m.length <= platLen - 2 || units === 1) break;
        }
        model = m;
        cars = m.cars.map((c) => ({ object: c.object, length: c.length, offset: c.offset, yaw: c.reversed ? Math.PI : 0, car: c, floorData: null }));
        trainLen = m.length;
      } else {
        const n = Math.max(2, Math.min(spec.maxCars, Math.floor((platLen - 4) / (spec.carLen + spec.gap))));
        if (!matCache.has(tr.line)) {
          const side = T.trainSide(L.color, { doors: spec.doors, carLen: spec.carLen });
          matCache.set(tr.line, new THREE.MeshStandardMaterial({
            map: side.map, emissiveMap: side.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.3,
          }));
        }
        const sideMat = matCache.get(tr.line)!;
        const geo = new THREE.BoxGeometry(spec.carLen, spec.height, spec.halfWidth * 2).translate(0, spec.height / 2 - 0.06, 0);
        const mats = [endMat, endMat, roofMat, underMat, sideMat, sideMat];
        cars = [];
        for (let i = 0; i < n; i++) {
          cars.push({ object: new THREE.Mesh(geo, mats), length: spec.carLen, offset: i * (spec.carLen + spec.gap) + spec.carLen / 2, yaw: 0, car: null, floorData: null });
        }
        trainLen = n * spec.carLen + (n - 1) * spec.gap;
      }
      for (const c of cars) {
        c.object.visible = false;
        scene.add(c.object);
      }
      const mid = (tr.platform.s0 + tr.platform.s1) / 2;
      // compass direction of travel at the platform decides the destination set
      const t = tr.path.tangentAt(mid).multiplyScalar(tr.dir);
      const pos = (L.axis === 'x' ? t.x : t.z) > 0;
      const destSet = pos ? L.dest.pos : L.dest.neg;
      const svc: Service = {
        tr, spec, L, cars, model, trainLen,
        stopHead: mid + (tr.dir * trainLen) / 2,
        startHead: tr.dir > 0 ? 0 : tr.path.length,
        endHead: tr.dir > 0 ? tr.path.length + trainLen : -trainLen,
        state: 'wait', timer: 4 + Math.random() * 50, head: 0, speed: 0, doors: 0,
        dest: destSet[0], destSet, next: L.next ? (pos ? L.next.pos : L.next.neg) : '',
      };
      for (const c of cars) {
        if (c.car?.floor) {
          c.floorData = {
            kind: 'train', svc, car: c,
            rec: { get label() { return `${svc.L.train} to ${svc.dest[1]} · line ${svc.dest[0]}`; } },
          };
        }
      }
      this.setDest(svc, pick(svc.destSet));
      // start a few trains already at the platform so the station feels alive
      if (Math.random() < 0.35) { svc.state = 'dwell'; svc.head = svc.stopHead; svc.timer = 5 + Math.random() * 12; svc.doors = 1; }
      this.services.push(svc);
    }
  }

  setDest(svc: Service, dest: Destination) {
    svc.dest = dest;
    svc.model?.setDestination(dest[1]);
  }

  // Seconds until the train is at the platform (0 when it is there).
  eta(svc: Service) {
    const approachDist = Math.abs(svc.stopHead - svc.startHead);
    const approachTime = approachDist / svc.spec.vmax + svc.spec.vmax / (2 * ACC);
    switch (svc.state) {
      case 'wait': return svc.timer + approachTime;
      case 'arrive': {
        const rem = Math.abs(svc.stopHead - svc.head);
        return rem / Math.max(4, svc.speed) + 2;
      }
      case 'dwell': case 'closing': return 0;
      default: return Infinity;
    }
  }

  // `ride` is the car the player is in, if any: that train shows its whole interior.
  update(dt: number, playerPos: THREE.Vector3 | null, ride: Ride | null = null) {
    let rumble = 0;
    for (const svc of this.services) {
      const { tr, spec } = svc;
      switch (svc.state) {
        case 'wait':
          svc.timer -= dt;
          if (svc.timer <= 0) {
            svc.state = 'arrive'; svc.head = svc.startHead; svc.speed = spec.vmax;
          }
          break;
        case 'arrive': {
          const rem = Math.abs(svc.stopHead - svc.head);
          svc.speed = Math.min(spec.vmax, Math.sqrt(2 * ACC * rem) + 0.15);
          const step = Math.min(rem, svc.speed * dt);
          svc.head += tr.dir * step;
          if (rem - step < 0.01) {
            svc.state = 'dwell'; svc.timer = DWELL; svc.speed = 0;
            this.sound?.chime(this.distanceTo(svc, playerPos), 'open');
          }
          break;
        }
        case 'dwell':
          svc.timer -= dt;
          if (DWELL - svc.timer > OPEN_DELAY) svc.doors = Math.min(1, svc.doors + dt / DOORS_OPEN);
          if (svc.timer <= 0) {
            svc.state = 'closing'; svc.timer = 0;
            this.sound?.chime(this.distanceTo(svc, playerPos), 'close');
          }
          break;
        case 'closing':
          svc.timer += dt;
          if (svc.timer > SHUT_DELAY) svc.doors = Math.max(0, svc.doors - dt / DOORS_SHUT);
          if (svc.doors === 0 && svc.timer > SHUT_DELAY + DOORS_SHUT + LEAVE_DELAY) { svc.state = 'depart'; svc.speed = 0; }
          break;
        case 'depart': {
          const done = Math.abs(svc.head - svc.stopHead);
          svc.speed = Math.min(spec.vmax, Math.sqrt(2 * ACC * done) + 0.4);
          svc.head += tr.dir * svc.speed * dt;
          if ((svc.head - svc.endHead) * tr.dir >= 0) {
            svc.state = 'wait'; svc.timer = 35 + Math.random() * 60; this.setDest(svc, pick(svc.destSet));
          }
          break;
        }
      }
      this.place(svc, playerPos, ride?.svc === svc);
      if (svc.state === 'arrive' || svc.state === 'depart') {
        const d = this.distanceTo(svc, playerPos);
        rumble += (svc.speed / spec.vmax) * Math.max(0, 1 - d / 120) ** 2;
      }
      this.updateBoard(svc);
    }
    this.sound?.setRumble(Math.min(1, rumble));
  }

  // Interiors are drawn only for cars close to the player, or for the whole train they ride.
  place(svc: Service, playerPos: THREE.Vector3 | null, ridden = false) {
    const { tr, cars } = svc;
    const visible = svc.state !== 'wait';
    // car +x points along the direction of travel
    const turn = tr.dir > 0 ? 0 : Math.PI;
    for (const c of cars) {
      const m = c.object;
      const sc = svc.head - tr.dir * c.offset;
      if (!visible || sc < -c.length / 2 || sc > tr.path.length + c.length / 2) { m.visible = false; continue; }
      const a = tr.path.pointAt(sc - c.length / 2, this._p);
      const b = tr.path.pointAt(sc + c.length / 2, this._q);
      m.visible = true;
      m.position.addVectors(a, b).multiplyScalar(0.5);
      m.position.y -= RAIL_TOP;
      m.rotation.set(0, Math.atan2(-(b.z - a.z), b.x - a.x) + turn + c.yaw, 0);
      if (c.car) {
        if (playerPos) {
          const d = m.position.distanceTo(playerPos) - c.length / 2;
          c.car.setInterior(ridden || d < (c.car.interior ? INTERIOR_FAR : INTERIOR_NEAR));
        }
        c.car.setDoors(svc.doors, this.platformSide(svc, c));
      }
    }
  }

  // The side of a car (its local z sign) that faces the platform.
  platformSide(svc: Service, c: ServiceCar): 1 | -1 {
    return svc.tr.platform.side * svc.tr.dir * (c.yaw ? -1 : 1) > 0 ? 1 : -1;
  }

  // Car-local coordinates of a world position (x, z) on car object m.
  private toLocal(m: THREE.Object3D, x: number, z: number, out: THREE.Vector3) {
    const dx = x - m.position.x, dz = z - m.position.z;
    const cos = Math.cos(m.rotation.y), sin = Math.sin(m.rotation.y);
    return out.set(dx * cos - dz * sin, 0, dx * sin + dz * cos);
  }

  // Walkable car floors over (x, z): the saloons, the gangways between the cars, and the doorways
  // while the doors are open, so the player can step in from the platform and walk through.
  floorsAt(x: number, z: number, out: SurfaceHit<CarFloorData>[] = []) {
    out.length = 0;
    const l = this._p;
    for (const svc of this.services) {
      if (svc.state === 'wait' || !svc.model) continue;
      for (const c of svc.cars) {
        const f = c.car?.floor, m = c.object;
        if (!f || !c.floorData || !m.visible) continue;
        const dx = x - m.position.x, dz = z - m.position.z, r = c.length / 2 + 3;
        if (dx * dx + dz * dz > r * r) continue;
        this.toLocal(m, x, z, l);
        if (onFloor(f, l.x, l.z, svc.doors, this.platformSide(svc, c))) out.push({ y: m.position.y + f.y, data: c.floorData });
      }
    }
    return out;
  }

  // The car the player is standing in (inside its body, not on the platform next to a doorway).
  rideAt(pos: THREE.Vector3): Ride | null {
    const l = this._q;
    for (const svc of this.services) {
      if (svc.state === 'wait' || !svc.model) continue;
      for (const c of svc.cars) {
        const f = c.car?.floor, m = c.object;
        if (!f || !m.visible || Math.abs(pos.y - (m.position.y + f.y)) > 0.5) continue;
        this.toLocal(m, pos.x, pos.z, l);
        if (Math.abs(l.z) < f.outer - 0.02 && l.x > f.x0 - f.rearGap - 0.05 && l.x < f.x1 + 0.05) {
          return { svc, car: c, local: l.clone().setY(pos.y - m.position.y - f.y), yaw: m.rotation.y };
        }
      }
    }
    return null;
  }

  // Moves the player along with their car after the trains have moved. Returns the change of
  // heading, for turning the view with the car.
  carry(ride: Ride, pos: THREE.Vector3) {
    const m = ride.car.object, f = ride.car.car!.floor!;
    const cos = Math.cos(m.rotation.y), sin = Math.sin(m.rotation.y);
    const { x, y, z } = ride.local;
    pos.set(m.position.x + x * cos + z * sin, m.position.y + f.y + y, m.position.z - x * sin + z * cos);
    let turn = m.rotation.y - ride.yaw;
    turn -= Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
    return turn;
  }

  // While the doors close, someone standing in a doorway steps in or out of the way.
  clearDoorway(ride: Ride, pos: THREE.Vector3) {
    const { svc, car, local } = ride;
    const f = car.car?.floor;
    if (!f || svc.state !== 'closing' || svc.doors > 0.8) return false;
    const s = Math.sign(local.z) || 1, az = Math.abs(local.z);
    if (az <= f.inner - R || !f.doors.some((d) => Math.abs(local.x - d) < f.doorWidth / 2)) return false;
    local.z = s * (az < (f.inner + f.outer) / 2 + 0.1 ? f.inner - R - 0.02 : f.outer + 0.55);
    this.carry(ride, pos);
    return true;
  }

  // True once a ridden train has carried the player's car to the end of its track.
  leaving(ride: Ride) {
    const { svc, car } = ride;
    if (svc.state !== 'depart') return false;
    const sc = svc.head - svc.tr.dir * car.offset;
    return svc.tr.dir > 0 ? sc > svc.tr.path.length - LEAVE_AT : sc < LEAVE_AT;
  }

  // The rest of a ride, off the map: the player comes back into T-Centralen in the same place in
  // a train running the other way on the same line (or on this track again if there is none).
  transfer(ride: Ride): Ride {
    const from = ride.svc;
    const to = this.services.find((s) => s !== from && s.L === from.L && s.destSet !== from.destSet
      && s.model?.type === from.model?.type && s.cars.length === from.cars.length) ?? from;
    to.state = 'arrive';
    to.speed = to.spec.vmax;
    to.doors = 0;
    this.setDest(to, pick(to.destSet));
    // start with the player's car just inside the tunnel, if the approach is long enough
    const car = to.cars[from.cars.indexOf(ride.car)];
    const inside = car.offset + car.length / 2 + 2;
    const head = to.startHead + to.tr.dir * inside;
    to.head = (to.stopHead - head) * to.tr.dir > 30 ? head : to.startHead;
    this.place(to, null, true);
    return { svc: to, car, local: ride.local.clone(), yaw: car.object.rotation.y };
  }

  distanceTo(svc: Service, pos: THREE.Vector3 | null) {
    if (!pos) return Infinity;
    let best = Infinity;
    for (const { object: m } of svc.cars) {
      if (!m.visible) continue;
      best = Math.min(best, m.position.distanceTo(pos));
    }
    if (best === Infinity) best = svc.tr.path.pointAt(svc.stopHead, this._p).distanceTo(pos);
    return best;
  }

  boardText(svc: Service) {
    const eta = this.eta(svc);
    const when = svc.state === 'dwell' || svc.state === 'closing' || eta < 30 ? 'Nu' : `${Math.max(1, Math.round(eta / 60))} min`;
    return { line: svc.dest[0], dest: svc.dest[1], when };
  }

  updateBoard(svc: Service) {
    const b = svc.tr.board;
    if (!b) return;
    const { line, dest, when } = this.boardText(svc);
    const text = `${line}|${dest}|${when}`;
    if (text === b.text) return;
    b.text = text;
    const x = b.canvas.getContext('2d')!;
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 512, 128);
    x.fillStyle = svc.L.color;
    x.beginPath(); x.roundRect(14, 24, 76, 80, 12); x.fill();
    x.fillStyle = '#fff'; x.font = '700 48px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(line, 52, 66);
    x.fillStyle = '#ffb33a'; x.textAlign = 'left'; x.font = '600 44px Arial, sans-serif';
    x.fillText(dest.length > 14 ? dest.slice(0, 13) + '…' : dest, 108, 66);
    x.textAlign = 'right';
    x.fillText(when, 496, 66);
    b.texture.needsUpdate = true;
  }

  // Next departures from the platform the player is standing on.
  departuresFor(platformRec: SurfaceRecord) {
    return this.services
      .filter((s) => s.tr.platform.rec === platformRec)
      .map((s) => ({ ...this.boardText(s), color: s.L.color }));
  }
}

function hasPlatform(tr: Track): tr is Track & { platform: Platform } {
  return !!tr.platform;
}

// Is car-local (x, z) walkable? `open` is how far the doors on side `side` are open.
function onFloor(f: CarFloor, x: number, z: number, open: number, side: 1 | -1) {
  const az = Math.abs(z);
  if (x >= f.xa + R && x <= f.xb - R && az <= f.inner - R) return true;
  // through the gangway portals, and over the bellows to the next car
  if (az <= f.portal / 2 - R) {
    if (x >= f.x0 - f.rearGap - 0.05 && x <= f.xa + R + 0.05) return true;
    if (f.frontPortal && x >= f.xb - R - 0.05 && x <= f.x1 + 0.05) return true;
  }
  if (open > 0.6 && z * side > 0 && az >= f.inner - R - 0.05 && az <= f.outer + 0.5) {
    for (const d of f.doors) if (Math.abs(x - d) <= f.doorWidth / 2 - R * 0.6) return true;
  }
  return false;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
