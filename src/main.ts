import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildStation } from './station';
import { Player } from './player';
import { Trains } from './trains';
import { MiniMap } from './minimap';
import { Input } from './input';
import { Sound } from './sound';
import { LINES } from './lines';
import { mountBuildSwitcher } from './build-switcher';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;

// ------------------------------------------------------------------ renderer & scene
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const maxRatio = Math.min(devicePixelRatio, coarse ? 1.5 : 2);
let pixelRatio = maxRatio;
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const FOG = 0x0a0c11;
scene.background = new THREE.Color(FOG);
scene.fog = new THREE.FogExp2(FOG, 0.0105);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 1200);
scene.add(new THREE.HemisphereLight(0xf2f5ff, 0x4a4540, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(0.35, 1, 0.25);
scene.add(sun);
const headLight = new THREE.PointLight(0xfff1dc, 9, 26, 1.5);
scene.add(headLight);

// Keep at least ~70° horizontal view in portrait.
function fitCamera() {
  const aspect = innerWidth / innerHeight;
  const minH = THREE.MathUtils.degToRad(70);
  const vfov = Math.max(72, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minH / 2) / aspect)));
  camera.fov = Math.min(vfov, 100);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
fitCamera();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  fitCamera();
  sizeBigMap();
});

// ------------------------------------------------------------------ state
const sound = new Sound();
let station, player, trains, minimap;
let running = false;
let showMap = false;

const input = new Input(canvas, {
  onLook: (dx, dy) => player && running && player.look(dx, dy),
  onKey: (code) => handleKey(code),
  onModeChange: (touch) => document.body.classList.toggle('touch', touch),
});
const touchMode = () => input.touchMode;
document.body.classList.toggle('touch', touchMode());
mountBuildSwitcher($('buildSwitch'));

// ------------------------------------------------------------------ loading
const loader = new GLTFLoader();
loader.load(
  'assets/t-centralen.glb',
  (gltf) => {
    station = buildStation(gltf.scene);
    scene.add(station.group);
    player = new Player(camera, station.walk);
    trains = new Trains(scene, station.tracks, sound, { renderer, quality: coarse ? 0.5 : 0.8 });
    minimap = new MiniMap(renderer, station.mapGroup, station.bounds, $('minimap'), $('bigmap'));
    sizeBigMap();
    buildTeleportList();

    const cam = params.get('cam');
    if (cam) {
      const [x, y, z, yaw = 0, pitch = 0] = cam.split(',').map(Number);
      player.teleport(new THREE.Vector3(x, y, z), yaw);
      player.pitch = pitch;
      player.fly = params.has('fly');
    } else {
      player.teleport(station.spawn.pos, station.spawn.yaw);
    }
    $('loading').hidden = true;
    $('start').hidden = false;
    window.__game = { station, player, trains, scene, camera, renderer, THREE };
  },
  (e) => {
    if (e.total) $('progress').style.width = `${(100 * e.loaded) / e.total}%`;
  },
  (err) => {
    $('loading').textContent = 'Could not load the station model: ' + err.message;
  },
);

// ------------------------------------------------------------------ start / pause
function start() {
  if (!player) return;
  sound.start();
  $('overlay').hidden = true;
  running = true;
  if (touchMode()) {
    // Android: go fullscreen in landscape. (iPhone Safari has no fullscreen API; the page still fills the screen.)
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' })
        .then(() => screen.orientation?.lock?.('landscape'))
        .catch(() => {});
    }
  } else {
    canvas.requestPointerLock?.();
  }
}
$('start').addEventListener('click', start);
canvas.addEventListener('click', () => {
  if (running && !touchMode() && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', () => {
  if (!touchMode() && document.pointerLockElement !== canvas && running && !showMap) pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) pause();
});
function pause() {
  running = false;
  input.release();
  $('overlay').hidden = false;
  $('start').textContent = 'Resume';
}

// ------------------------------------------------------------------ touch UI
{
  const stick = $('stick'), knob = $('knob');
  input.touchUI = {
    showStick: (x, y) => {
      stick.style.left = `${x}px`; stick.style.top = `${y}px`;
      stick.classList.add('active');
      $('stickHint').hidden = true;
    },
    moveStick: (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; },
    hideStick: () => { stick.classList.remove('active'); knob.style.transform = ''; },
  };
  for (const b of document.querySelectorAll('[data-key]')) {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); handleKey(b.dataset.key); });
  }
  for (const b of document.querySelectorAll('[data-hold]')) {
    const set = (v) => (e) => { e.preventDefault(); input.hold[b.dataset.hold] = v; b.classList.toggle('down', v); };
    b.addEventListener('pointerdown', set(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, set(false));
  }
  $('menuBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); if (running) pause(); });
  $('minimap').addEventListener('pointerdown', (e) => { if (touchMode()) { e.preventDefault(); toggleMap(); } });
  $('bigmapWrap').addEventListener('pointerdown', (e) => { if (touchMode()) { e.preventDefault(); toggleMap(); } });
}

// ------------------------------------------------------------------ keys
function handleKey(code) {
  if (!player) return;
  if (code === 'KeyM') { toggleMap(); return; }
  if (!running) return;
  switch (code) {
    case 'KeyF':
      player.fly = !player.fly;
      if (!player.fly) {
        // land on whatever is below
        const hits = station.walk.query(player.pos.x, player.pos.z);
        const below = hits.filter((h) => h.y <= player.pos.y + 0.5).sort((a, b) => b.y - a.y)[0];
        if (below) player.teleport(new THREE.Vector3(player.pos.x, below.y, player.pos.z), player.yaw);
        else player.teleport(station.spawn.pos, station.spawn.yaw);
      }
      toast(player.fly ? (touchMode() ? 'Free flight on — hold ⇡ / ⇣ to rise/sink' : 'Free flight on — Space/C to rise/sink') : 'Walking');
      document.body.classList.toggle('flying', player.fly);
      break;
    case 'KeyE': useLift(+1); break;
    case 'KeyQ': useLift(-1); break;
    case 'KeyN':
      sound.setMuted(!sound.muted);
      toast(sound.muted ? 'Sound off' : 'Sound on');
      break;
    case 'KeyR': fadeTo(() => player.teleport(station.spawn.pos, station.spawn.yaw)); break;
    default: {
      const m = /^Digit(\d)$/.exec(code);
      if (m) {
        const t = station.teleports[Number(m[1]) - 1];
        if (t) fadeTo(() => {
          player.fly = false;
          document.body.classList.remove('flying');
          player.teleport(t.pos, t.yaw);
          toast(t.label);
        });
      }
    }
  }
}

function toggleMap() {
  if (!minimap) return;
  showMap = !showMap;
  $('bigmapWrap').hidden = !showMap;
  if (showMap) minimap.drawBig(player);
}

function sizeBigMap() {
  const c = $('bigmap');
  c.width = Math.round(innerWidth * 0.9 * Math.min(devicePixelRatio, 2));
  c.height = Math.round(innerHeight * 0.85 * Math.min(devicePixelRatio, 2));
  if (showMap && minimap) minimap.drawBig(player);
}

function buildTeleportList() {
  const ul = $('teleports');
  ul.innerHTML = '';
  station.teleports.slice(0, 9).forEach((t, i) => {
    const li = document.createElement('li');
    const L = LINES[t.line];
    li.innerHTML = `<kbd>${i + 1}</kbd><span class="dot" style="background:${L.color}"></span>${t.label}`;
    li.addEventListener('click', () => {
      start();
      handleKey(`Digit${i + 1}`);
    });
    ul.appendChild(li);
  });
}

// ------------------------------------------------------------------ lifts
function nearbyLift() {
  let best = null, bestD = Infinity;
  for (const l of station.lifts) {
    const d = Math.hypot(player.pos.x - l.center.x, player.pos.z - l.center.z) - l.radius;
    if (d < 3.2 && player.pos.y > l.minY - 0.6 && player.pos.y < l.maxY + 0.6 && d < bestD) { best = l; bestD = d; }
  }
  return best;
}

function useLift(dir) {
  const lift = nearbyLift();
  if (!lift) return;
  let i = 0;
  lift.levels.forEach((l, k) => { if (Math.abs(l.y - player.pos.y) < Math.abs(lift.levels[i].y - player.pos.y)) i = k; });
  const j = i + dir;
  if (j < 0 || j >= lift.levels.length) { toast(dir > 0 ? 'Top floor' : 'Bottom floor'); return; }
  const to = lift.levels[j];
  sound.chime(0, 'open');
  fadeTo(() => player.teleport(to.pos, to.yaw), 700);
}

let fading = false;
function fadeTo(fn, hold = 250) {
  if (fading) return;
  fading = true;
  const f = $('fade');
  f.classList.add('on');
  setTimeout(() => {
    fn();
    setTimeout(() => { f.classList.remove('on'); fading = false; }, 60);
  }, hold);
}

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
}

// ------------------------------------------------------------------ HUD
let hudNext = 0;
function updateHud() {
  const lift = nearbyLift();
  const atLift = !!lift && !player.fly;
  $('prompt').hidden = !atLift;
  document.body.classList.toggle('at-lift', atLift);
  if (lift) {
    const idx = lift.levels.findIndex((l) => Math.abs(l.y - player.pos.y) < 0.8);
    $('prompt').innerHTML = touchMode()
      ? `Lift · floor ${idx + 1} of ${lift.levels.length}`
      : `Lift ${idx + 1}/${lift.levels.length} — <kbd>E</kbd> up · <kbd>Q</kbd> down`;
  }
  const now = performance.now();
  if (now < hudNext) return;
  hudNext = now + 250;
  const rec = player.surface?.rec;
  $('where').textContent = player.fly
    ? `Free flight · ${player.pos.y.toFixed(0)} m`
    : `${rec?.label ?? '—'} · level ${player.pos.y.toFixed(0)} m`;
  const deps = rec?.platformLine ? trains.departuresFor(rec) : [];
  const box = $('departures');
  box.hidden = deps.length === 0;
  box.innerHTML = deps
    .map((d) => `<div class="dep"><span class="ln" style="background:${d.color}">${d.line}</span><span class="ds">${d.dest}</span><span class="wh">${d.when}</span></div>`)
    .join('');
}

// ------------------------------------------------------------------ atmosphere
// Stockholm C and the tram stop are above ground: fade to an evening sky up there.
const SKY = new THREE.Color(0x8193ad), DARK = new THREE.Color(FOG);
let outdoor = 0;
function updateAtmosphere(dt) {
  const target = player.fly ? 0.5 : THREE.MathUtils.smoothstep(player.pos.y, 3.5, 5.8);
  outdoor += (target - outdoor) * Math.min(1, dt * 3);
  scene.background.copy(DARK).lerp(SKY, player.fly ? 0 : outdoor);
  scene.fog.color.copy(scene.background);
  scene.fog.density = THREE.MathUtils.lerp(0.0105, 0.0035, outdoor);
}

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
// Drop the render resolution on slow devices (never raises it again, to avoid oscillating).
let perfFrames = 0, perfTime = 0;
function adaptResolution(rawDt) {
  if (!running) return;
  perfFrames++; perfTime += rawDt;
  if (perfTime < 2.5) return;
  const fps = perfFrames / perfTime;
  perfFrames = 0; perfTime = 0;
  if (fps < 40 && pixelRatio > 0.75) {
    pixelRatio = Math.max(0.75, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(innerWidth, innerHeight);
  }
}

function frame() {
  const raw = clock.getDelta();
  const dt = Math.min(0.05, raw);
  if (!params.has('cam')) adaptResolution(raw);
  if (player) {
    if (running) player.update(dt, input.state());
    trains.update(dt, player.pos);
    headLight.position.set(player.pos.x, player.eyeY + 0.6, player.pos.z);
    updateAtmosphere(dt);
    if (running) {
      minimap.draw(player);
      updateHud();
    }
    if (showMap) minimap.drawBig(player);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
