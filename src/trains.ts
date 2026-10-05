import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LINES, TRAIN_SPECS } from './lines';
import type { Destination } from './lines';
import * as T from './textures';
import { createTrain, SERVICE_UNITS } from './rolling-stock/index';
import type { BuildOptions, Train, TrainType } from './rolling-stock/index';
import type { CarFloor } from './rolling-stock/train';
import { Polyline } from './polyline';
import type { Platform, SurfaceRecord, Track } from './station';
import type { Sound } from './sound';
import type { SurfaceHit } from './surface-index';
import type { StationJoin } from './station-join';
import { runningWays } from './track-graph';
import type { TrackGraph } from './track-graph';
import type { TrackGeometry } from './track-geometry';
import { ACC, DWELL, RAIL_TOP, advance, nextStation } from './service';
import type { CarFloorData, Service, ServiceCar, ServiceEvent } from './service';
import { Timetable } from './timetable';
import type { NetRoute } from './timetable';

export type { CarFloorData, Service, ServiceCar } from './service';

const INTERIOR_NEAR = 30, INTERIOR_FAR = 36; // metres from a car's end: interior on / off
const R = 0.25;        // the player's radius when walking in a car
const LEAVE_AT = 28;   // a ridden shuttle's car this close to the end of its track ends the ride
// a trip on the network gets a train model when it comes this close to the player, and gives it
// back beyond the second distance
const MODEL_NEAR = 700, MODEL_FAR = 900;

// The player inside a car: their position and heading relative to it.
export interface Ride {
  svc: Service;
  car: ServiceCar;
  local: THREE.Vector3;
  yaw: number;
}

// The track network and the station model's join to it, for the trains that run on it.
export interface TrainsNetwork { graph: TrackGraph; geometry: TrackGeometry; join: StationJoin }

// A platform track of the station model and the trains that call at it: its shuttle, or the
// network's routes, each with the index of its stop there.
interface Calls { tr: Track & { platform: Platform }; shuttle: Service | null; stops: { route: NetRoute; k: number }[] }

export interface Departure { line: string; dest: string; when: string; color: string; eta: number }

// The trains. Lines the station model only has a stretch of get a shuttle per platform track: one
// train that comes out of the tunnel, stops and goes back in. Lines on the track network
// (src/network.ts) run on its timetable (src/timetable.ts) instead, through the station and on
// along the whole line. Metro lines run the procedural C20/C30 models, whose doors open at the
// platform and whose cars can be walked through and ridden; other lines get simple textured boxes.
export class Trains {
  shuttles: Service[] = [];
  timetable: Timetable | null = null;
  // trains standing out of service in the depots and on the sidings
  parked: Service[] = [];
  clock = 0;
  private all: Service[] = [];
  private calls: Calls[] = [];
  private pool = new Map<TrainType, Train[]>();
  private modelOpts: BuildOptions;
  private boardsAt = 0;
  private _p = new THREE.Vector3();
  private _q = new THREE.Vector3();

  constructor(private scene: THREE.Object3D, tracks: Track[], public sound: Sound | null,
    { renderer = null, quality = 1, network = null }: { renderer?: THREE.WebGLRenderer | null; quality?: number; network?: TrainsNetwork | null } = {}) {
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
    this.modelOpts = { quality, envMap, envMapIntensity: 0.45, interior: false };
    const served = network?.join.served;

    for (const tr of tracks) {
      const L = LINES[tr.line];
      if (!hasPlatform(tr) || !L.dest || (L.kind !== 'metro' && L.kind !== 'commuter') || served?.has(tr)) continue;
      const spec = TRAIN_SPECS[L.kind];
      const platLen = tr.platform.s1 - tr.platform.s0;
      let cars: ServiceCar[], trainLen: number, model: Train | null = null;
      if (L.train) {
        // as many units as fit the platform (normally a full 140 m train)
        let m!: Train;
        for (let units = SERVICE_UNITS[L.train]; units >= 1; units--) {
          m = createTrain(L.train, { ...this.modelOpts, units });
          if (m.length <= platLen - 2 || units === 1) break;
        }
        model = m;
        cars = carsOf(m);
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
      // the train runs along the track in its direction of travel
      const path = tr.dir > 0 ? tr.path : new Polyline([...tr.path.pts].reverse());
      const mid = tr.dir > 0 ? (tr.platform.s0 + tr.platform.s1) / 2 : tr.path.length - (tr.platform.s0 + tr.platform.s1) / 2;
      // compass direction of travel at the platform decides the destination set
      const t = path.tangentAt(mid);
      const pos = (L.axis === 'x' ? t.x : t.z) > 0;
      const destSet = pos ? L.dest.pos : L.dest.neg;
      const svc: Service = {
        id: -1 - this.shuttles.length, L, vmax: spec.vmax, cars, model, trainLen, path, shown: [0, path.length],
        stops: [{ station: L.sign, head: mid + trainLen / 2, side: (tr.platform.side * tr.dir > 0 ? 1 : -1), until: -Infinity }],
        stop: 0, end: path.length + trainLen,
        state: 'wait', timer: 4 + Math.random() * 50, head: 0, speed: 0, limit: Infinity, doors: 0,
        dest: destSet[0], shuttle: { tr, destSet, next: L.next ? (pos ? L.next.pos : L.next.neg) : '' },
      };
      this.floors(svc);
      this.setDest(svc, pick(destSet));
      // start a few trains already at the platform so the station feels alive
      if (Math.random() < 0.35) { svc.state = 'dwell'; svc.head = svc.stops[0].head; svc.timer = DWELL - 5 - Math.random() * 12; svc.doors = 1; }
      this.shuttles.push(svc);
      this.calls.push({ tr, shuttle: svc, stops: [] });
    }

    if (network) {
      const type = LINES.red.train!;
      const first = this.newModel(type);
      this.pool.set(type, [first]);
      this.timetable = new Timetable(network.graph, network.geometry, first.length, network.join.stretches, (svc) => this.release(svc));
      for (const [tr, list] of network.join.served) {
        if (!hasPlatform(tr)) continue;
        const stops = list.flatMap(({ route }) => {
          const r = this.timetable!.routes.find((x) => x.name === route);
          const k = r ? r.stops.findIndex((st) => st.station === network.join.station) : -1;
          return r && k >= 0 ? [{ route: r, k }] : [];
        });
        this.calls.push({ tr, shuttle: null, stops });
      }
      this.park(network, first.length);
    }
    this.all = [...this.shuttles, ...(this.timetable?.trips ?? []), ...this.parked];
  }

  // Trains out of service, standing on about two in three of the depots' stabling tracks (a yard
  // track beside another for most of its length) and of the sidings that end at a buffer stop,
  // where they are long enough. They get a model when the player comes near, like the trips.
  private park({ graph, geometry }: TrainsNetwork, trainLen: number) {
    const run = new Set([...runningWays(graph), ...graph.routes].flatMap((r) => r.path.map((st) => st.piece)));
    const ends = new Set(graph.nodes.filter((n) => n.kind === 'end').map((n) => n.id));
    for (const [id, g] of Object.entries(geometry.pieces)) {
      const piece = graph.pieces[Number(id)];
      if (run.has(piece.id) || (piece.service !== 'yard' && piece.service !== 'siding')) continue;
      const length = g.s[g.s.length - 1] - g.s[0];
      if (length < trainLen + 10 || (piece.id * 2654435761) % 3 === 0) continue;
      const beside = g.left ? g.s.filter((_, k) => (g.left![k] > 0 && g.left![k] < 8) || (g.right![k] > 0 && g.right![k] < 8)).length / g.s.length : 0;
      if (beside < 0.6 && !ends.has(piece.from) && !ends.has(piece.to)) continue;
      const path = new Polyline(g.x.map((x, k) => new THREE.Vector3(x, g.y[k] + RAIL_TOP, g.z[k])));
      // at the buffer stop end of a siding, or in the middle of a stabling track
      const head = ends.has(piece.to) ? path.length - 6 : ends.has(piece.from) ? trainLen + 6 : (path.length + trainLen) / 2;
      this.parked.push({
        id: -1000 - this.parked.length, L: LINES.red, vmax: 0, cars: [], model: null, trainLen, path, shown: [0, path.length],
        stops: [{ station: '', head, side: 1, until: Infinity }], stop: 0, end: head,
        state: 'dwell', timer: 0, head, speed: 0, limit: 0, doors: 0, dest: ['', 'Ej i trafik'],
      });
    }
  }

  private newModel(type: TrainType) {
    return createTrain(type, { ...this.modelOpts, units: SERVICE_UNITS[type] });
  }

  // The floors of a train's cars, which the player can walk on.
  private floors(svc: Service) {
    for (const c of svc.cars) {
      if (!c.car?.floor) continue;
      c.floorData = {
        kind: 'train', svc, car: c,
        rec: {
          get label() {
            const base = `${svc.model?.type} to ${svc.dest[1]} · line ${svc.dest[0]}`;
            const at = nextStation(svc);
            if (!svc.trip || !at) return base;
            return `${base} · ${svc.state === 'run' ? 'next' : 'at'} ${at}`;
          },
        },
      };
    }
  }

  // A trip near the player gets a train model, from those given back if there is one.
  private attach(svc: Service) {
    const type = svc.L.train;
    if (svc.model || !type) return;
    const model = this.pool.get(type)?.pop() ?? this.newModel(type);
    svc.model = model;
    svc.cars = carsOf(model);
    for (const c of svc.cars) {
      c.object.visible = false;
      this.scene.add(c.object);
    }
    this.floors(svc);
    model.setDestination(svc.dest[1]);
  }

  private release(svc: Service) {
    const m = svc.model;
    if (!m || svc.shuttle) return;
    for (const c of svc.cars) {
      c.object.visible = false;
      c.car?.setInterior(false);
      c.car?.setDoors(0, 0);
    }
    (this.pool.get(m.type as TrainType) ?? this.pool.set(m.type as TrainType, []).get(m.type as TrainType)!).push(m);
    svc.model = null;
    svc.cars = [];
  }

  setDest(svc: Service, dest: Destination) {
    svc.dest = dest;
    svc.model?.setDestination(dest[1]);
  }

  // `ride` is the car the player is in, if any: that train shows its whole interior.
  update(dt: number, playerPos: THREE.Vector3 | null, ride: Ride | null = null) {
    this.clock += dt;
    for (const svc of this.shuttles) {
      if (svc.state === 'wait') {
        svc.timer -= dt;
        if (svc.timer <= 0) { svc.state = 'run'; svc.head = 0; svc.stop = 0; svc.speed = svc.vmax; }
      }
      this.event(svc, advance(svc, dt, this.clock), playerPos);
    }
    if (this.timetable) {
      for (const [svc, ev] of this.timetable.update(dt)) this.event(svc, ev, playerPos);
      // models for the trips near the player
      for (const svc of this.timetable.trips) {
        const onLine = svc.head > svc.shown[0] && svc.head - svc.trainLen < svc.shown[1];
        const d = playerPos && onLine ? this.trainDistance(svc, playerPos) : Infinity;
        if (!svc.model && d < MODEL_NEAR) this.attach(svc);
        else if (svc.model && d > MODEL_FAR && ride?.svc !== svc) this.release(svc);
      }
    }
    for (const svc of this.parked) {
      const d = playerPos ? this.trainDistance(svc, playerPos) : Infinity;
      if (!svc.model && d < MODEL_NEAR) this.attach(svc);
      else if (svc.model && d > MODEL_FAR) this.release(svc);
    }
    this.all = [...this.shuttles, ...(this.timetable?.trips ?? []), ...this.parked];
    let rumble = 0;
    for (const svc of this.all) {
      this.place(svc, playerPos, ride?.svc === svc);
      if (svc.state === 'run' && svc.speed > 0) {
        const d = this.distanceTo(svc, playerPos);
        rumble += (svc.speed / svc.vmax) * Math.max(0, 1 - d / 120) ** 2;
      }
    }
    this.sound?.setRumble(Math.min(1, rumble));
    if (this.clock >= this.boardsAt) {
      this.boardsAt = this.clock + 0.5;
      for (const c of this.calls) this.updateBoard(c);
    }
  }

  private event(svc: Service, ev: ServiceEvent, playerPos: THREE.Vector3 | null) {
    if (ev === 'arrived') this.sound?.chime(this.distanceTo(svc, playerPos), 'open');
    else if (ev === 'closing') this.sound?.chime(this.distanceTo(svc, playerPos), 'close');
    else if (ev === 'turned') {
      // the train is the same, standing where it stood, but now runs the other way: its last car
      // leads (each car keeps its place and heading, so someone inside stays put)
      svc.cars.reverse();
      for (const c of svc.cars) {
        c.offset = svc.trainLen - c.offset;
        c.yaw = c.yaw ? 0 : Math.PI;
      }
      this.setDest(svc, svc.dest);
    } else if (ev === 'done' && svc.shuttle) {
      svc.state = 'wait'; svc.timer = 35 + Math.random() * 60; svc.head = 0; svc.stop = 0;
      this.setDest(svc, pick(svc.shuttle.destSet));
    }
  }

  // Interiors are drawn only for cars close to the player, or for the whole train they ride.
  place(svc: Service, playerPos: THREE.Vector3 | null, ridden = false) {
    const { path, cars } = svc;
    const visible = svc.state !== 'wait';
    for (const c of cars) {
      const m = c.object;
      // a shuttle's cars run on out of the tunnel the model draws; a trip's cars are drawn on
      // the line, not where it runs on beyond the ends
      const sc = svc.head - c.offset, pad = svc.shuttle ? c.length / 2 : 0;
      if (!visible || sc < svc.shown[0] - pad || sc > svc.shown[1] + pad) { m.visible = false; continue; }
      const a = path.pointAt(sc - c.length / 2, this._p);
      const b = path.pointAt(sc + c.length / 2, this._q);
      m.visible = true;
      m.position.addVectors(a, b).multiplyScalar(0.5);
      m.position.y -= RAIL_TOP;
      // car +x points along the direction of travel
      m.rotation.set(0, Math.atan2(-(b.z - a.z), b.x - a.x) + c.yaw, 0);
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
    const st = svc.stops[Math.min(svc.stop, svc.stops.length - 1)];
    return st.side * (c.yaw ? -1 : 1) > 0 ? 1 : -1;
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
    for (const svc of this.all) {
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
    for (const svc of this.all) {
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

  // True once a ridden train leaves the part of the line that is drawn: a shuttle carrying the
  // player's car to the end of its track, or a trip leaving the last station of its route.
  leaving(ride: Ride) {
    const { svc, car } = ride;
    if (svc.state !== 'run' || svc.stop < svc.stops.length) return false;
    if (svc.trip) return true;
    return svc.head - car.offset > svc.path.length - LEAVE_AT;
  }

  // The rest of a ride, off the map. From a shuttle, the player comes back into the station in the
  // same place in a train running the other way on the same line (or on this track again if there
  // is none). From a trip, they stay in the train as it turns, and it comes back as the trip
  // that leaves the end of the line the other way, standing at the platform.
  transfer(ride: Ride): Ride {
    const from = ride.svc;
    const index = from.cars.indexOf(ride.car);
    if (from.trip) {
      const to = this.timetable?.turn(from);
      if (!to) return ride;
      this.attach(to);
      this.place(to, null, true);
      const car = to.cars[index] ?? to.cars[0];
      return { svc: to, car, local: ride.local.clone(), yaw: car.object.rotation.y };
    }
    const to = this.shuttles.find((s) => s !== from && s.L === from.L && s.shuttle!.destSet !== from.shuttle!.destSet
      && s.model?.type === from.model?.type && s.cars.length === from.cars.length) ?? from;
    to.state = 'run';
    to.stop = 0;
    to.speed = to.vmax;
    to.doors = 0;
    this.setDest(to, pick(to.shuttle!.destSet));
    // start with the player's car just inside the tunnel, if the approach is long enough
    const car = to.cars[index];
    const inside = car.offset + car.length / 2 + 2;
    to.head = to.stops[0].head - inside > 30 ? inside : 0;
    this.place(to, null, true);
    return { svc: to, car, local: ride.local.clone(), yaw: car.object.rotation.y };
  }

  // Whether a train is still running: a trip is gone once it has run out beyond its last station.
  inService(svc: Service) {
    return this.all.includes(svc);
  }

  distanceTo(svc: Service, pos: THREE.Vector3 | null) {
    if (!pos) return Infinity;
    let best = Infinity;
    for (const { object: m } of svc.cars) {
      if (!m.visible) continue;
      best = Math.min(best, m.position.distanceTo(pos));
    }
    if (best === Infinity && svc.shuttle) best = svc.path.pointAt(svc.stops[0].head, this._p).distanceTo(pos);
    return best;
  }

  // How far the train is from pos, roughly: from the middle of the train, less half its length.
  private trainDistance(svc: Service, pos: THREE.Vector3) {
    return svc.path.pointAt(svc.head - svc.trainLen / 2, this._p).distanceTo(pos) - svc.trainLen / 2;
  }

  // ------------------------------------------------------------------ departures
  // Seconds until a shuttle stands at its platform (0 when it is there).
  private shuttleEta(svc: Service) {
    const stop = svc.stops[0].head;
    switch (svc.state) {
      case 'wait': return svc.timer + stop / svc.vmax + svc.vmax / (2 * ACC);
      case 'run': return svc.stop === 0 ? (stop - svc.head) / Math.max(4, svc.speed) + 2 : Infinity;
      default: return svc.stop === 0 ? 0 : Infinity;
    }
  }

  // The next train of each service calling at a platform track, soonest first.
  private next(c: Calls): Departure[] {
    const out: Departure[] = [];
    if (c.shuttle) out.push(departure(c.shuttle.L.color, c.shuttle.dest, this.shuttleEta(c.shuttle)));
    for (const { route, k } of c.stops) {
      const n = this.timetable?.nextAt(route, k);
      if (n) out.push(departure(LINES[route.line].color, route.dest, n.eta));
    }
    return out.sort((a, b) => a.eta - b.eta);
  }

  private updateBoard(c: Calls) {
    const b = c.tr.board;
    if (!b) return;
    const d = this.next(c)[0];
    if (!d) return;
    const text = `${d.line}|${d.dest}|${d.when}`;
    if (text === b.text) return;
    b.text = text;
    const x = b.canvas.getContext('2d')!;
    x.fillStyle = '#05070a'; x.fillRect(0, 0, 512, 128);
    x.fillStyle = d.color;
    x.beginPath(); x.roundRect(14, 24, 76, 80, 12); x.fill();
    x.fillStyle = '#fff'; x.font = '700 48px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(d.line, 52, 66);
    x.fillStyle = '#ffb33a'; x.textAlign = 'left'; x.font = '600 44px Arial, sans-serif';
    x.fillText(d.dest.length > 14 ? d.dest.slice(0, 13) + '…' : d.dest, 108, 66);
    x.textAlign = 'right';
    x.fillText(d.when, 496, 66);
    b.texture.needsUpdate = true;
  }

  // Next departures from the station model's platform the player is standing on.
  departuresFor(platformRec: SurfaceRecord) {
    return this.calls.filter((c) => c.tr.platform.rec === platformRec).flatMap((c) => this.next(c)).sort((a, b) => a.eta - b.eta);
  }

  // Next departures from a station of the network, both ways, by its name.
  departuresAt(station: string) {
    const out: Departure[] = [];
    for (const route of this.timetable?.routes ?? []) {
      const k = route.stops.findIndex((st) => st.station === station);
      if (k < 0 || k === route.stops.length - 1) continue;
      const n = this.timetable!.nextAt(route, k);
      if (n) out.push(departure(LINES[route.line].color, route.dest, n.eta));
    }
    return out.sort((a, b) => a.eta - b.eta);
  }
}

function departure(color: string, [line, dest]: Destination, eta: number): Departure {
  const when = eta < 30 ? 'Nu' : `${Math.max(1, Math.round(eta / 60))} min`;
  return { line, dest, when, color, eta };
}

function carsOf(m: Train): ServiceCar[] {
  return m.cars.map((c) => ({ object: c.object, length: c.length, offset: c.offset, yaw: c.reversed ? Math.PI : 0, car: c, floorData: null }));
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
