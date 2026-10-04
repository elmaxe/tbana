import * as THREE from 'three';
import {
  shellGeometry, capGeometry, bellowsGeometry, sidePainter, frontPainter, bogieGeometry, couplerGeometry,
  destinationSign, LIGHTS, DARK, merge,
} from './kit';
import type {
  BellowsOptions, BogieGeometry, BogieOptions, CapOptions, DestinationSign, Painter, Profile, Rim,
} from './kit';
import { liningGeometry, endWallGeometry, portalTube } from './interior';
import type { InteriorContext, InteriorMaterials, InteriorSpec } from './interior';

// Turns a train type description (see c20.js / c30.js) into car templates and assembles trains.

export interface CarDef {
  length: number; cab: boolean; number: string; name?: string;
  doors: number[]; bogies: number[]; flip?: boolean;
}
export interface NoseSpec extends CapOptions { face: Rim }
export interface LightDef { kind: 'head' | 'tail'; z: number; y: number; w: number; h: number; round?: boolean }
export interface TrainSpec {
  id: string;
  title: string;
  prof: Profile;
  nose: NoseSpec;
  cars: Record<string, CarDef>;
  formation: [kind: string, reversed: boolean][];
  gap: number;
  unitGap: number;
  bellows?: BellowsOptions;
  endColor?: number;
  bogie?: BogieOptions;
  coupler?: { len?: number; y?: number; setback?: number };
  sign: { y: number; w: number; h: number };
  lights: LightDef[];
  interior?: InteriorSpec;
  paintSide(p: Painter, def: CarDef, x0: number, x1: number): void;
  paintFront(p: Painter, def: CarDef): void;
  extras(def: CarDef, x0: number, x1: number, kit: TypeKit): THREE.Object3D[];
}
export interface CarTemplate {
  group: THREE.Group; def: CarDef; length: number;
  glazed?: THREE.MeshStandardMaterial; interior?: THREE.Group;
}
export interface TypeKit {
  spec: TrainSpec; quality: number; templates: Map<string, CarTemplate>;
  bogie: BogieGeometry; coupler: THREE.BufferGeometry; endMat: THREE.MeshStandardMaterial;
  imats?: InteriorMaterials;
}
export interface Car {
  object: THREE.Group; length: number; offset: number; reversed: boolean; kind: string; interior: boolean;
  bodyMats?: THREE.MeshStandardMaterial[];
  setInterior(on: boolean): void;
}
export type CabLights = 'lead' | 'tail' | 'off';
export type TrainLights = 'forward' | 'reverse' | 'off';
export interface Train {
  type: string; group: THREE.Group; cars: Car[]; length: number;
  setDestination(text: string): void;
  setInterior(on: boolean): void;
  setLights(mode: TrainLights): void;
}
export interface BuildOptions {
  units?: number; destination?: string; quality?: number;
  envMap?: THREE.Texture | null; envMapIntensity?: number; interior?: boolean;
}
interface Cab { sign: DestinationSign; setLights(mode: CabLights): void }
type StdMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]>;

const isMesh = (o: THREE.Object3D): o is THREE.Mesh<THREE.BufferGeometry, THREE.Material> => (o as THREE.Mesh).isMesh;

const cache = new Map<string, TypeKit>();

function typeKit(spec: TrainSpec, quality: number) {
  const key = `${spec.id}|${spec.interior?.key ?? ''}|${quality}`;
  if (cache.has(key)) return cache.get(key)!;
  const bogie = bogieGeometry(spec.bogie);
  const kit: TypeKit = {
    spec, quality, templates: new Map(),
    bogie, coupler: couplerGeometry(spec.coupler?.len, spec.coupler?.y),
    endMat: new THREE.MeshStandardMaterial({ color: spec.endColor ?? 0x6c7278, roughness: 0.6, metalness: 0.3 }),
  };
  cache.set(key, kit);
  return kit;
}

// A car template: everything except the per-train parts (destination signs, lights).
function carTemplate(kit: TypeKit, kind: string, bellowsRear: boolean) {
  const key = `${kind}|${bellowsRear}`;
  if (kit.templates.has(key)) return kit.templates.get(key)!;
  const { spec, quality } = kit;
  const def = spec.cars[kind];
  const { prof } = spec;
  const L = def.length, x0 = -L / 2, x1 = L / 2;
  const group = new THREE.Group();
  group.name = `${spec.id}-${kind}`;

  // ends: a cab nose, or a gangway end. With an interior the gangway ends are flat walls with the
  // gangway portal cut through them; without one they are closed caps.
  const it = spec.interior;
  const flat = { k: 0.04, R: 0.03, ni: 1, nb: 2 };
  const gangwayEnd = (x: number, dir: number) => (it
    ? { geometry: endWallGeometry(prof, x, dir, [it.portal]), rim: () => 0 }
    : capGeometry(prof, x, dir, flat));
  const rear = gangwayEnd(x0, -1);
  let front;
  let noseMat;
  if (def.cab) {
    const fp = frontPainter(prof, 220 * quality);
    spec.paintFront(fp, def);
    noseMat = fp.material();
    front = capGeometry(prof, x1, 1, { ...spec.nose, uv: fp.uv });
  } else {
    front = gangwayEnd(x1, 1);
  }
  const sp = sidePainter(prof, x0, x1, 125 * quality, { alpha: !!it });
  spec.paintSide(sp, def, x0, x1);
  const bodyMat = sp.material();
  bodyMat.name = 'body';
  const shell = new THREE.Mesh(shellGeometry(prof, x0, x1, rear.rim, front.rim), bodyMat);
  shell.name = 'body';
  group.add(shell);
  group.add(new THREE.Mesh(rear.geometry, kit.endMat));
  group.add(new THREE.Mesh(front.geometry, def.cab ? noseMat : kit.endMat));

  // running gear
  for (const bx of def.bogies) {
    const b = new THREE.Group();
    b.name = 'bogie';
    b.add(new THREE.Mesh(kit.bogie.frame, DARK.bogie), new THREE.Mesh(kit.bogie.wheels, DARK.wheel), new THREE.Mesh(kit.bogie.shoe, DARK.shoe));
    b.position.x = bx;
    group.add(b);
  }
  if (def.cab) {
    const c = new THREE.Mesh(kit.coupler, DARK.bogie);
    c.position.x = x1 - (spec.coupler?.setback ?? 0.6);
    group.add(c);
  }
  if (bellowsRear) {
    const g = bellowsGeometry(prof, x0 - spec.gap - 0.02, x0 + 0.02, spec.bellows);
    group.add(new THREE.Mesh(g, DARK.bellows));
  }
  for (const o of spec.extras(def, x0, x1, kit)) group.add(o);

  const tpl: CarTemplate = { group: mergeByMaterial(group), def, length: L };
  if (it) {
    tpl.glazed = sp.material({}, 'blend');
    tpl.glazed.name = 'body';
    tpl.interior = mergeByMaterial(interiorGroup(kit, def, x0, x1, bellowsRear));
    tpl.interior.name = 'interior';
  }
  kit.templates.set(key, tpl);
  return tpl;
}

// The passenger saloon of one car: lining, end walls, gangway and whatever the type furnishes.
function interiorGroup(kit: TypeKit, def: CarDef, x0: number, x1: number, bellowsRear: boolean) {
  const { spec, quality } = kit;
  const it = spec.interior!;
  kit.imats ??= it.materials();
  const mats = kit.imats;
  const { portal } = it;
  const group = new THREE.Group();
  group.name = `${spec.id}-${def.cab ? 'A' : 'M'}-interior`;
  // the saloon runs from just inside the rear end to the cab bulkhead or the front end
  const xa = x0 + it.endWall, xb = def.cab ? x1 - it.cabDepth : x1 - it.endWall;
  const ctx: InteriorContext = { x0, x1, xa, xb, mats, prof: it.lining };
  const lp = sidePainter(it.lining, xa, xb, 100 * quality, { inside: true, alpha: true, glow: it.glow });
  it.paint(lp, def, ctx);
  const lining = new THREE.Mesh(liningGeometry(it.lining, xa, xb), lp.material({}, 'mask'));
  lining.material.name = 'lining';
  group.add(lining);
  group.add(new THREE.Mesh(endWallGeometry(it.lining, xa, 1, [portal]), mats.wall));
  group.add(new THREE.Mesh(portalTube(portal, x0, xa), mats.wall));
  if (def.cab) {
    group.add(new THREE.Mesh(endWallGeometry(it.lining, xb, -1), mats.bulkhead ?? mats.wall));
    // a plain driver's cab behind the bulkhead: floor, desk and seat (seen in the cutaway)
    const F = it.lining.floorY, cab: THREE.BufferGeometry[] = [];
    cab.push(new THREE.BoxGeometry(x1 - xb - 0.8, 0.02, 2.5).translate((xb + x1 - 0.8) / 2, F + 0.01, 0));
    cab.push(new THREE.BoxGeometry(0.7, 0.85, 2.3).translate(x1 - 1.35, F + 0.43, 0));
    cab.push(new THREE.BoxGeometry(0.55, 0.06, 2.1).rotateZ(-0.35).translate(x1 - 1.55, F + 0.93, 0));
    cab.push(new THREE.BoxGeometry(0.5, 0.5, 0.5).translate(x1 - 2.25, F + 0.25, 0));
    cab.push(new THREE.BoxGeometry(0.1, 0.7, 0.5).translate(x1 - 2.48, F + 0.85, 0));
    group.add(new THREE.Mesh(merge(cab), mats.housing));
  } else {
    group.add(new THREE.Mesh(endWallGeometry(it.lining, xb, -1, [portal]), mats.wall));
    group.add(new THREE.Mesh(portalTube(portal, xb, x1), mats.wall));
  }
  if (bellowsRear) {
    // the walkway through the gangway: pleated inner bellows and a floor plate
    group.add(new THREE.Mesh(portalTube(portal, x0 - spec.gap, x0, { pleat: it.pleat ?? 0.06, depth: 0.03, floor: false }), mats.bellows));
    const w = portal.w - 0.1, gx = x0 - spec.gap / 2, glen = spec.gap + 0.3;
    if (!it.noPlate) group.add(new THREE.Mesh(new THREE.BoxGeometry(glen, 0.02, w).translate(gx, portal.y0 + 0.005, 0), mats.plate));
    for (const o of it.gangway?.(gx, mats) ?? []) group.add(o);
  }
  for (const o of it.furnish(def, ctx)) group.add(o);
  group.traverse((o) => { if (isMesh(o)) o.userData.interior = true; });
  return group;
}

// One mesh per material keeps a car to a handful of draw calls.
function mergeByMaterial(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.traverse((o) => {
    if (!isMesh(o)) return;
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material)!.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
  });
  const out = new THREE.Group();
  out.name = group.name;
  for (const [mat, list] of buckets) {
    const m = new THREE.Mesh(merge(list), mat);
    m.name = mat.name || 'part';
    out.add(m);
  }
  return out;
}

// Cab parts that differ per train: the destination display and switchable lights.
function addCab(spec: TrainSpec, car: THREE.Object3D, x1: number): Cab {
  const f = spec.nose.face;
  const onNose = (z: number, y: number, out: THREE.Object3D) => {
    const e = 0.01;
    const n = new THREE.Vector3(1, (f(z, y + e) - f(z, y - e)) / (2 * e), (f(z + e, y) - f(z - e, y)) / (2 * e)).normalize();
    out.position.set(x1 - f(z, y), y, z).addScaledVector(n, 0.012);
    // face along the normal, keeping the panel's horizontal edge level
    const across = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    const up = n.clone().cross(across);
    out.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, up, n));
    return out;
  };
  const sign = destinationSign(spec.sign.w, spec.sign.h);
  onNose(0, spec.sign.y, sign.mesh);
  car.add(sign.mesh);
  const heads: THREE.Mesh[] = [], tails: THREE.Mesh[] = [];
  for (const l of spec.lights) {
    const g = l.round ? new THREE.CircleGeometry(l.w / 2, 20) : new THREE.PlaneGeometry(l.w, l.h);
    const m = new THREE.Mesh(g, l.kind === 'head' ? LIGHTS.headOff : LIGHTS.tailOff);
    m.name = l.kind;
    onNose(l.z, l.y, m);
    car.add(m);
    (l.kind === 'head' ? heads : tails).push(m);
  }
  return {
    sign,
    setLights(mode: CabLights) {
      for (const m of heads) m.material = mode === 'lead' ? LIGHTS.headOn : LIGHTS.headOff;
      for (const m of tails) m.material = mode === 'tail' ? LIGHTS.tailOn : LIGHTS.tailOff;
    },
  };
}

// Builds a train of `units` multiple units. Cars are laid out from the front (+x) backwards; the
// group is centred on x = 0. Each car records its length and the distance from the train's front
// to its centre (`offset`), so callers can also place cars one by one along a curved track.
// `interior` shows the passenger interiors from the start; cars can switch them with
// car.setInterior(on) (the station turns them on only for cars near the player).
export function buildTrain(spec: TrainSpec, { units = 1, destination = '', quality = 1, envMap = null, envMapIntensity = 1, interior = true }: BuildOptions = {}): Train {
  const kit = typeKit(spec, quality);
  const group = new THREE.Group();
  group.name = spec.id;
  const cars: Car[] = [], cabs: Cab[] = [];
  let at = 0;
  for (let u = 0; u < units; u++) {
    spec.formation.forEach(([kind, reversed], i) => {
      const last = i === spec.formation.length - 1;
      const tpl = carTemplate(kit, kind, !last);
      const obj = tpl.group.clone();
      obj.name = `${spec.id}-${u + 1}-${kind}${reversed ? '-rev' : ''}`;
      if (tpl.def.cab) cabs.push(addCab(spec, obj, tpl.length / 2));
      const car: Car = { object: obj, length: tpl.length, offset: at + tpl.length / 2, reversed, kind, interior: false, setInterior: () => {} };
      if (tpl.interior) {
        const inner = tpl.interior.clone();
        inner.visible = false;
        inner.traverse((o) => { if (isMesh(o)) o.userData.interior = true; });
        obj.add(inner);
        const body = obj.children.find((o) => o.name === 'body') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
        const opaque = body.material;
        car.bodyMats = [opaque, tpl.glazed!];
        // with the interior on, the windows turn to glass you can see through
        car.setInterior = (on) => {
          if (on === car.interior) return;
          car.interior = on;
          inner.visible = on;
          body.material = on ? tpl.glazed! : opaque;
        };
      }
      cars.push(car);
      at += tpl.length + (last ? spec.unitGap : spec.gap);
      group.add(obj);
    });
  }
  const length = at - spec.unitGap;
  for (const c of cars) {
    c.object.position.x = length / 2 - c.offset;
    c.object.rotation.y = c.reversed ? Math.PI : 0;
  }
  cabs.forEach((c, i) => c.setLights(i === 0 ? 'lead' : i === cabs.length - 1 ? 'tail' : 'off'));
  for (const c of cars) c.setInterior(interior);
  if (envMap) {
    const mats = new Set(cars.flatMap((c) => c.bodyMats ?? []));
    group.traverse((o) => { if ((o as StdMesh).material) ([] as THREE.MeshStandardMaterial[]).concat((o as StdMesh).material).forEach((m) => mats.add(m)); });
    for (const m of mats) { m.envMap = envMap; m.envMapIntensity = envMapIntensity; m.needsUpdate = true; }
  }
  const train: Train = {
    type: spec.id, group, cars, length,
    setDestination(text) { for (const c of cabs) c.sign.set(text); },
    setInterior(on) { for (const c of cars) c.setInterior(on); },
    // 'forward': lit for running towards +x; 'reverse': the other way; 'off'
    setLights(mode) {
      cabs.forEach((c, i) => {
        const first = i === 0, lastCab = i === cabs.length - 1;
        if (mode === 'off' || (!first && !lastCab)) c.setLights('off');
        else if (mode === 'forward') c.setLights(first ? 'lead' : 'tail');
        else c.setLights(first ? 'tail' : 'lead');
      });
    },
  };
  train.setDestination(destination);
  return train;
}
