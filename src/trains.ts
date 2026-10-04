import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LINES, TRAIN_SPECS } from './lines';
import * as T from './textures';
import { createTrain, SERVICE_UNITS } from './rolling-stock/index';

const ACC = 1.0;      // m/s², braking and acceleration
const DWELL = 22;     // seconds at the platform

const RAIL_TOP = 0.99; // the rail head sits this far below the track path (platform level)
const INTERIOR_NEAR = 30, INTERIOR_FAR = 36; // metres from a car's end: interior on / off

// One train per platform track: waits in the tunnel, arrives, dwells, departs, repeats.
// Metro lines run the procedural C20/C30 models; other lines get simple textured boxes.
export class Trains {
  constructor(scene, tracks, sound, { renderer = null, quality = 1 } = {}) {
    this.sound = sound;
    this.services = [];
    const matCache = new Map();
    const endTex = T.trainEnd();
    const endMat = new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x9ea4ab, roughness: 0.5, metalness: 0.4 });
    const underMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 1 });
    // reflections for the stainless steel and glass of the models
    let envMap = null;
    if (renderer) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }

    for (const tr of tracks) {
      const L = LINES[tr.line];
      if (!tr.platform || !L.dest) continue;
      const spec = TRAIN_SPECS[L.kind];
      const platLen = tr.platform.s1 - tr.platform.s0;
      let cars, trainLen, model = null;
      if (L.train) {
        // as many units as fit the platform (normally a full 140 m train)
        for (let units = SERVICE_UNITS[L.train]; units >= 1; units--) {
          model = createTrain(L.train, { units, quality, envMap, envMapIntensity: 0.45, interior: false });
          if (model.length <= platLen - 2 || units === 1) break;
        }
        cars = model.cars.map((c) => Object.assign(c, { yaw: c.reversed ? Math.PI : 0 }));
        trainLen = model.length;
      } else {
        const n = Math.max(2, Math.min(spec.maxCars, Math.floor((platLen - 4) / (spec.carLen + spec.gap))));
        if (!matCache.has(tr.line)) {
          const side = T.trainSide(L.color, { doors: spec.doors, carLen: spec.carLen });
          matCache.set(tr.line, new THREE.MeshStandardMaterial({
            map: side.map, emissiveMap: side.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.3,
          }));
        }
        const sideMat = matCache.get(tr.line);
        const geo = new THREE.BoxGeometry(spec.carLen, spec.height, spec.halfWidth * 2).translate(0, spec.height / 2 - 0.06, 0);
        const mats = [endMat, endMat, roofMat, underMat, sideMat, sideMat];
        cars = [];
        for (let i = 0; i < n; i++) {
          cars.push({ object: new THREE.Mesh(geo, mats), length: spec.carLen, offset: i * (spec.carLen + spec.gap) + spec.carLen / 2, yaw: 0 });
        }
        trainLen = n * spec.carLen + (n - 1) * spec.gap;
      }
      for (const c of cars) {
        c.object.visible = false;
        scene.add(c.object);
      }
      const mid = (tr.platform.s0 + tr.platform.s1) / 2;
      const svc = {
        tr, spec, L, cars, model, trainLen,
        stopHead: mid + (tr.dir * trainLen) / 2,
        startHead: tr.dir > 0 ? 0 : tr.path.length,
        endHead: tr.dir > 0 ? tr.path.length + trainLen : -trainLen,
        state: 'wait', timer: 4 + Math.random() * 50, head: 0, speed: 0, dest: null,
      };
      // compass direction of travel at the platform decides the destination set
      const t = tr.path.tangentAt(mid).multiplyScalar(tr.dir);
      svc.destSet = (L.axis === 'x' ? t.x : t.z) > 0 ? L.dest.pos : L.dest.neg;
      this.setDest(svc, pick(svc.destSet));
      // start a few trains already at the platform so the station feels alive
      if (Math.random() < 0.35) { svc.state = 'dwell'; svc.head = svc.stopHead; svc.timer = 5 + Math.random() * 12; }
      this.services.push(svc);
    }
    this._p = new THREE.Vector3();
    this._q = new THREE.Vector3();
  }

  setDest(svc, dest) {
    svc.dest = dest;
    svc.model?.setDestination(dest[1]);
  }

  // Seconds until the train is at the platform (0 when it is there).
  eta(svc) {
    const approachDist = Math.abs(svc.stopHead - svc.startHead);
    const approachTime = approachDist / svc.spec.vmax + svc.spec.vmax / (2 * ACC);
    switch (svc.state) {
      case 'wait': return svc.timer + approachTime;
      case 'arrive': {
        const rem = Math.abs(svc.stopHead - svc.head);
        return rem / Math.max(4, svc.speed) + 2;
      }
      case 'dwell': return 0;
      default: return Infinity;
    }
  }

  update(dt, playerPos) {
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
          if (svc.timer <= 0) {
            svc.state = 'depart'; svc.speed = 0;
            this.sound?.chime(this.distanceTo(svc, playerPos), 'close');
          }
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
      this.place(svc, playerPos);
      if (svc.state === 'arrive' || svc.state === 'depart') {
        const d = this.distanceTo(svc, playerPos);
        rumble += (svc.speed / spec.vmax) * Math.max(0, 1 - d / 120) ** 2;
      }
      this.updateBoard(svc);
    }
    this.sound?.setRumble(Math.min(1, rumble));
  }

  // Interiors are drawn only for cars close to the player.
  place(svc, playerPos) {
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
      if (c.setInterior && playerPos) {
        const d = m.position.distanceTo(playerPos) - c.length / 2;
        c.setInterior(d < (c.interior ? INTERIOR_FAR : INTERIOR_NEAR));
      }
    }
  }

  distanceTo(svc, pos) {
    if (!pos) return Infinity;
    let best = Infinity;
    for (const { object: m } of svc.cars) {
      if (!m.visible) continue;
      best = Math.min(best, m.position.distanceTo(pos));
    }
    if (best === Infinity) best = svc.tr.path.pointAt(svc.stopHead, this._p).distanceTo(pos);
    return best;
  }

  boardText(svc) {
    const eta = this.eta(svc);
    const when = svc.state === 'dwell' || eta < 30 ? 'Nu' : `${Math.max(1, Math.round(eta / 60))} min`;
    return { line: svc.dest[0], dest: svc.dest[1], when };
  }

  updateBoard(svc) {
    const b = svc.tr.board;
    if (!b) return;
    const { line, dest, when } = this.boardText(svc);
    const text = `${line}|${dest}|${when}`;
    if (text === b.text) return;
    b.text = text;
    const x = b.canvas.getContext('2d');
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
  departuresFor(platformRec) {
    return this.services
      .filter((s) => s.tr.platform.rec === platformRec)
      .map((s) => ({ ...this.boardText(s), color: s.L.color }));
  }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
