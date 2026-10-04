import * as THREE from 'three';
import {
  shellGeometry, capGeometry, bellowsGeometry, sidePainter, frontPainter, bogieGeometry, couplerGeometry,
  destinationSign, LIGHTS, DARK, merge,
} from './kit.js';

// Turns a train type description (see c20.js / c30.js) into car templates and assembles trains.


const cache = new Map();

function typeKit(spec, quality) {
  const key = `${spec.id}|${quality}`;
  if (cache.has(key)) return cache.get(key);
  const bogie = bogieGeometry(spec.bogie);
  const kit = {
    spec, quality, templates: new Map(),
    bogie, coupler: couplerGeometry(spec.coupler?.len, spec.coupler?.y),
    endMat: new THREE.MeshStandardMaterial({ color: spec.endColor ?? 0x6c7278, roughness: 0.6, metalness: 0.3 }),
  };
  cache.set(key, kit);
  return kit;
}

// A car template: everything except the per-train parts (destination signs, lights).
function carTemplate(kit, kind, bellowsRear) {
  const key = `${kind}|${bellowsRear}`;
  if (kit.templates.has(key)) return kit.templates.get(key);
  const { spec, quality } = kit;
  const def = spec.cars[kind];
  const { prof } = spec;
  const L = def.length, x0 = -L / 2, x1 = L / 2;
  const group = new THREE.Group();
  group.name = `${spec.id}-${kind}`;

  // ends
  const flat = { k: 0.04, R: 0.03, ni: 1, nb: 2 };
  const rear = capGeometry(prof, x0, -1, flat);
  let front;
  let noseMat;
  if (def.cab) {
    const fp = frontPainter(prof, 220 * quality);
    spec.paintFront(fp, def);
    noseMat = fp.material();
    front = capGeometry(prof, x1, 1, { ...spec.nose, uv: fp.uv });
  } else {
    front = capGeometry(prof, x1, 1, flat);
  }
  const sp = sidePainter(prof, x0, x1, 125 * quality);
  spec.paintSide(sp, def, x0, x1);
  const bodyMat = sp.material();
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

  const tpl = { group: mergeByMaterial(group), def, length: L };
  kit.templates.set(key, tpl);
  return tpl;
}

// One mesh per material keeps a car to a handful of draw calls.
function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(o.geometry.clone().applyMatrix4(o.matrixWorld));
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
function addCab(spec, car, x1) {
  const f = spec.nose.face;
  const onNose = (z, y, out) => {
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
  const heads = [], tails = [];
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
    setLights(mode) {
      for (const m of heads) m.material = mode === 'lead' ? LIGHTS.headOn : LIGHTS.headOff;
      for (const m of tails) m.material = mode === 'tail' ? LIGHTS.tailOn : LIGHTS.tailOff;
    },
  };
}

// Builds a train of `units` multiple units. Cars are laid out from the front (+x) backwards; the
// group is centred on x = 0. Each car records its length and the distance from the train's front
// to its centre (`offset`), so callers can also place cars one by one along a curved track.
export function buildTrain(spec, { units = 1, destination = '', quality = 1, envMap = null, envMapIntensity = 1 } = {}) {
  const kit = typeKit(spec, quality);
  const group = new THREE.Group();
  group.name = spec.id;
  const cars = [], cabs = [];
  let at = 0;
  for (let u = 0; u < units; u++) {
    spec.formation.forEach(([kind, reversed], i) => {
      const last = i === spec.formation.length - 1;
      const tpl = carTemplate(kit, kind, !last);
      const obj = tpl.group.clone();
      obj.name = `${spec.id}-${u + 1}-${kind}${reversed ? '-rev' : ''}`;
      if (tpl.def.cab) cabs.push(addCab(spec, obj, tpl.length / 2));
      const car = { object: obj, length: tpl.length, offset: at + tpl.length / 2, reversed, kind };
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
  if (envMap) {
    group.traverse((o) => {
      if (!o.material) return;
      for (const m of [].concat(o.material)) { m.envMap = envMap; m.envMapIntensity = envMapIntensity; m.needsUpdate = true; }
    });
  }
  const train = {
    type: spec.id, group, cars, length,
    setDestination(text) { for (const c of cabs) c.sign.set(text); },
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
