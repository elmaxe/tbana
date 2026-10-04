import * as THREE from 'three';
import { LINES, TRAIN_SPECS } from './lines.js';
import * as T from './textures.js';

const ACC = 1.0;      // m/s², braking and acceleration
const DWELL = 22;     // seconds at the platform

// One train per platform track: waits in the tunnel, arrives, dwells, departs, repeats.
export class Trains {
  constructor(scene, tracks, sound) {
    this.sound = sound;
    this.services = [];
    const matCache = new Map();
    const endTex = T.trainEnd();
    const endMat = new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x9ea4ab, roughness: 0.5, metalness: 0.4 });
    const underMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 1 });

    for (const tr of tracks) {
      const L = LINES[tr.line];
      if (!tr.platform || !L.dest) continue;
      const spec = TRAIN_SPECS[L.kind];
      const platLen = tr.platform.s1 - tr.platform.s0;
      const cars = Math.max(2, Math.min(spec.maxCars, Math.floor((platLen - 4) / (spec.carLen + spec.gap))));
      if (!matCache.has(tr.line)) {
        const side = T.trainSide(L.color, { doors: spec.doors, carLen: spec.carLen });
        matCache.set(tr.line, new THREE.MeshStandardMaterial({
          map: side.map, emissiveMap: side.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.3,
        }));
      }
      const sideMat = matCache.get(tr.line);
      const geo = new THREE.BoxGeometry(spec.carLen, spec.height, spec.halfWidth * 2);
      const mats = [endMat, endMat, roofMat, underMat, sideMat, sideMat];
      const group = new THREE.Group();
      const meshes = [];
      for (let i = 0; i < cars; i++) {
        const m = new THREE.Mesh(geo, mats);
        m.visible = false;
        group.add(m);
        meshes.push(m);
      }
      scene.add(group);
      const trainLen = cars * spec.carLen + (cars - 1) * spec.gap;
      const mid = (tr.platform.s0 + tr.platform.s1) / 2;
      const svc = {
        tr, spec, L, meshes, trainLen,
        stopHead: mid + (tr.dir * trainLen) / 2,
        startHead: tr.dir > 0 ? 0 : tr.path.length,
        endHead: tr.dir > 0 ? tr.path.length + trainLen : -trainLen,
        state: 'wait', timer: 4 + Math.random() * 50, head: 0, speed: 0, dest: null,
      };
      // compass direction of travel at the platform decides the destination set
      const t = tr.path.tangentAt(mid).multiplyScalar(tr.dir);
      svc.destSet = (L.axis === 'x' ? t.x : t.z) > 0 ? L.dest.pos : L.dest.neg;
      svc.dest = pick(svc.destSet);
      // start a few trains already at the platform so the station feels alive
      if (Math.random() < 0.35) { svc.state = 'dwell'; svc.head = svc.stopHead; svc.timer = 5 + Math.random() * 12; }
      this.services.push(svc);
    }
    this._p = new THREE.Vector3();
    this._q = new THREE.Vector3();
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
            svc.state = 'wait'; svc.timer = 35 + Math.random() * 60; svc.dest = pick(svc.destSet);
          }
          break;
        }
      }
      this.place(svc);
      if (svc.state === 'arrive' || svc.state === 'depart') {
        const d = this.distanceTo(svc, playerPos);
        rumble += (svc.speed / spec.vmax) * Math.max(0, 1 - d / 120) ** 2;
      }
      this.updateBoard(svc);
    }
    this.sound?.setRumble(Math.min(1, rumble));
  }

  place(svc) {
    const { tr, spec, meshes } = svc;
    const visible = svc.state !== 'wait';
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      const sc = svc.head - tr.dir * (i * (spec.carLen + spec.gap) + spec.carLen / 2);
      if (!visible || sc < -spec.carLen / 2 || sc > tr.path.length + spec.carLen / 2) { m.visible = false; continue; }
      const a = tr.path.pointAt(sc - spec.carLen / 2, this._p);
      const b = tr.path.pointAt(sc + spec.carLen / 2, this._q);
      m.visible = true;
      m.position.addVectors(a, b).multiplyScalar(0.5);
      m.position.y += spec.height / 2 - 1.05;
      m.rotation.set(0, Math.atan2(-(b.z - a.z), b.x - a.x), 0);
    }
  }

  distanceTo(svc, pos) {
    if (!pos) return Infinity;
    let best = Infinity;
    for (const m of svc.meshes) {
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
