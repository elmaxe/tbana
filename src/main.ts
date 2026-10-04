import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildStation } from './station';
import type { Station } from './station';
import { Player } from './player';
import { Trains } from './trains';
import { setOutsideLight } from './rolling-stock/index';
import type { CarFloorData, Ride } from './trains';
import { MiniMap } from './minimap';
import { Input } from './input';
import { Sound } from './sound';
import { LINES } from './lines';
import { mountBuildSwitcher } from './build-switcher';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;

// ------------------------------------------------------------------ renderer & scene
const canvas = $<HTMLCanvasElement>('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const maxRatio = Math.min(devicePixelRatio, coarse ? 1.5 : 2);
let pixelRatio = maxRatio;
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const FOG = 0x0a0c11;
const background = new THREE.Color(FOG);
const fog = new THREE.FogExp2(FOG, 0.0105);
scene.background = background;
scene.fog = fog;

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 1200);
scene.add(new THREE.HemisphereLight(0xf2f5ff, 0x4a4540, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(0.35, 1, 0.25);
scene.add(sun);
const headLight = new THREE.PointLight(0xfff1dc, 9, 26, 1.5);
scene.add(headLight);
// Inside the train cars: none of these lights cast shadows, so the sun and the head light would
// shine through the roofs. The cars' own lights light them, with a little of the station's.
setOutsideLight({ direct: 0, ambient: 0.15 });

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
interface Game {
  station: Station;
  player: Player<CarFloorData>;
  trains: Trains;
  minimap: MiniMap;
}

const sound = new Sound();
let game: Game | null = null;
let running = false;
let showMap = false;

const input = new Input(canvas, {
  onLook: (dx, dy) => { if (game && running) game.player.look(dx, dy); },
  onKey: (code) => handleKey(code),
  onModeChange: (touch) => document.body.classList.toggle('touch', touch),
});
const touchMode = () => input.touchMode;
document.body.classList.toggle('touch', touchMode());
mountBuildSwitcher($('buildSwitch'));

// ------------------------------------------------------------------ loading
// Where each station model sits on the world grid (src/geo.ts), as fitted by tools/fit-station.ts.
interface StationPlacement { model: string; rotationY: number; position: [number, number, number] }

function loadingFailed(err: unknown) {
  $('loading').textContent = 'Could not load the station model: ' + (err instanceof Error ? err.message : String(err));
}

function onStationLoaded(root: THREE.Object3D) {
  const station = buildStation(root);
  scene.add(station.group);
  const trains = new Trains(scene, station.tracks, sound, { renderer, quality: coarse ? 0.5 : 0.8 });
  // the cars of the trains are floors too, so the player can board them through open doors
  const player = new Player<CarFloorData>(camera, station.walk, (x, z, out) => trains.floorsAt(x, z, out));
  const minimap = new MiniMap(renderer, station.mapGroup, station.bounds, $<HTMLCanvasElement>('minimap'), $<HTMLCanvasElement>('bigmap'));
  game = { station, player, trains, minimap };
  sizeBigMap();
  buildTeleportList(station);

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
  (window as Window & { __game?: unknown }).__game = { ...game, scene, camera, renderer, THREE, simulate };
}

fetch('data/stations.json')
  .then((res) => {
    if (!res.ok) throw new Error(`data/stations.json: HTTP ${res.status}`);
    return res.json() as Promise<Record<string, StationPlacement>>;
  })
  .then((stations) => {
    const place = stations['t-centralen'];
    new GLTFLoader().load(
      place.model,
      (gltf) => {
        gltf.scene.rotation.y = THREE.MathUtils.degToRad(place.rotationY);
        gltf.scene.position.fromArray(place.position);
        onStationLoaded(gltf.scene);
      },
      (e) => {
        if (e.total) $('progress').style.width = `${(100 * e.loaded) / e.total}%`;
      },
      loadingFailed,
    );
  })
  .catch(loadingFailed);

// ------------------------------------------------------------------ start / pause
function start() {
  if (!game) return;
  sound.start();
  $('overlay').hidden = true;
  running = true;
  if (touchMode()) {
    // Android: go fullscreen in landscape. (iPhone Safari has no fullscreen API; the page still fills the screen.)
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      el.requestFullscreen({ navigationUI: 'hide' })
        .then(() => orientation?.lock?.('landscape'))
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
  for (const b of document.querySelectorAll<HTMLElement>('[data-key]')) {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); handleKey(b.dataset.key!); });
  }
  for (const b of document.querySelectorAll<HTMLElement>('[data-hold]')) {
    const key = b.dataset.hold as keyof Input['hold'];
    const set = (v: boolean) => (e: Event) => { e.preventDefault(); input.hold[key] = v; b.classList.toggle('down', v); };
    b.addEventListener('pointerdown', set(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, set(false));
  }
  $('menuBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); if (running) pause(); });
  $('minimap').addEventListener('pointerdown', (e) => { if (touchMode()) { e.preventDefault(); toggleMap(); } });
  $('bigmapWrap').addEventListener('pointerdown', (e) => { if (touchMode()) { e.preventDefault(); toggleMap(); } });
}

// ------------------------------------------------------------------ keys
function handleKey(code: string) {
  if (!game) return;
  const { station, player, trains } = game;
  if (code === 'KeyM') { toggleMap(); return; }
  if (!running) return;
  switch (code) {
    case 'KeyF':
      endJourney();
      player.fly = !player.fly;
      if (!player.fly) {
        // land on whatever is below, a train's floor included
        const hits = [...station.walk.query(player.pos.x, player.pos.z), ...trains.floorsAt(player.pos.x, player.pos.z)];
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
    case 'KeyR': fadeTo(() => { endJourney(); player.teleport(station.spawn.pos, station.spawn.yaw); }); break;
    default: {
      const m = /^Digit(\d)$/.exec(code);
      if (m) {
        const t = station.teleports[Number(m[1]) - 1];
        if (t) fadeTo(() => {
          endJourney();
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
  if (!game) return;
  showMap = !showMap;
  $('bigmapWrap').hidden = !showMap;
  if (showMap) game.minimap.drawBig(game.player);
}

function sizeBigMap() {
  const c = $<HTMLCanvasElement>('bigmap');
  c.width = Math.round(innerWidth * 0.9 * Math.min(devicePixelRatio, 2));
  c.height = Math.round(innerHeight * 0.85 * Math.min(devicePixelRatio, 2));
  if (showMap && game) game.minimap.drawBig(game.player);
}

function buildTeleportList(station: Station) {
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
  if (!game) return null;
  const { player } = game;
  let best = null, bestD = Infinity;
  for (const l of game.station.lifts) {
    const d = Math.hypot(player.pos.x - l.center.x, player.pos.z - l.center.z) - l.radius;
    if (d < 3.2 && player.pos.y > l.minY - 0.6 && player.pos.y < l.maxY + 0.6 && d < bestD) { best = l; bestD = d; }
  }
  return best;
}

function useLift(dir: number) {
  const lift = nearbyLift();
  if (!lift || !game) return;
  const { player } = game;
  let i = 0;
  lift.levels.forEach((l, k) => { if (Math.abs(l.y - player.pos.y) < Math.abs(lift.levels[i].y - player.pos.y)) i = k; });
  const j = i + dir;
  if (j < 0 || j >= lift.levels.length) { toast(dir > 0 ? 'Top floor' : 'Bottom floor'); return; }
  const to = lift.levels[j];
  sound.chime(0, 'open');
  fadeTo(() => player.teleport(to.pos, to.yaw), 700);
}

let fading = false;
function fadeTo(fn: () => void, hold = 250) {
  if (fading) return;
  fading = true;
  const f = $('fade');
  f.classList.add('on');
  setTimeout(() => {
    fn();
    setTimeout(() => { f.classList.remove('on'); fading = false; }, 60);
  }, hold);
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(text: string, ms = 1800) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}

// ------------------------------------------------------------------ riding
// A ride ends where the modelled tunnel does. The screen goes dark for the trip to the next station
// and back, and the player comes back into T-Centralen standing in the same spot of a train on
// the other track (see Trains.transfer).
interface Journey {
  ride: Ride;
  stage: 'leaving' | 'away';
  relYaw: number; // the player's heading relative to their car
}
let journey: Journey | null = null;
let journeyTimer: ReturnType<typeof setTimeout> | undefined;
let lastRide: { svc: Ride['svc']; state: string } | null = null;

function startJourney(ride: Ride) {
  if (!game) return;
  const { player, trains } = game;
  const next = ride.svc.next;
  journey = { ride, stage: 'leaving', relYaw: 0 };
  $('fadeText').textContent = next ? `${next} …` : '…';
  $('fade').classList.add('on', 'slow');
  journeyTimer = setTimeout(() => {
    if (!journey) return;
    journey.relYaw = player.yaw - ride.car.object.rotation.y;
    journey.ride = trains.transfer(ride);
    journey.stage = 'away';
    $('fadeText').textContent = next ? `${next} … and back to T-Centralen` : 'Back to T-Centralen';
  }, 1600);
}

// The train coming back has reached the modelled tunnel: put the player in it and fade in.
function arrive(j: Journey) {
  if (!game) return;
  const { player, trains } = game;
  const car = j.ride.car.object;
  j.ride.yaw = car.rotation.y;
  trains.carry(j.ride, player.pos);
  player.yaw = j.relYaw + car.rotation.y;
  player.vel.set(0, 0, 0);
  player.applyCamera(0);
  journey = null;
  journeyTimer = setTimeout(() => {
    $('fade').classList.remove('on');
    setTimeout(() => $('fade').classList.remove('slow'), 800);
    toast('Arriving at T-Centralen', 2500);
  }, 300);
}

function endJourney() {
  if (!journey) return;
  journey = null;
  clearTimeout(journeyTimer);
  $('fade').classList.remove('on', 'slow');
}

// Toasts as the train the player is in closes its doors and leaves.
function rideNotices(ride: Ride | null) {
  if (!ride) { lastRide = null; return; }
  const { svc } = ride;
  if (lastRide?.svc === svc && lastRide.state !== svc.state) {
    if (svc.state === 'closing') toast('Doors closing — stand clear', 2200);
    else if (svc.state === 'depart' && svc.next) toast(`Nästa: ${svc.next}`, 3000);
    else if (svc.state === 'dwell') toast('T-Centralen — doors opening', 2200);
  }
  lastRide = { svc, state: svc.state };
}

// ------------------------------------------------------------------ HUD
let hudNext = 0;
function updateHud() {
  if (!game) return;
  const { player, trains } = game;
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
  const surface = player.surface;
  $('where').textContent = player.fly
    ? `Free flight · ${player.pos.y.toFixed(0)} m`
    : `${surface?.rec.label ?? '—'} · level ${player.pos.y.toFixed(0)} m`;
  const platform = surface && surface.kind !== 'train' && surface.rec.platformLine ? surface.rec : null;
  const deps = platform ? trains.departuresFor(platform) : [];
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
function updateAtmosphere(player: Player<CarFloorData>, dt: number) {
  const target = player.fly ? 0.5 : THREE.MathUtils.smoothstep(player.pos.y, 3.5, 5.8);
  outdoor += (target - outdoor) * Math.min(1, dt * 3);
  background.copy(DARK).lerp(SKY, player.fly ? 0 : outdoor);
  fog.color.copy(background);
  fog.density = THREE.MathUtils.lerp(0.0105, 0.0035, outdoor);
}

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
// Drop the render resolution on slow devices (never raises it again, to avoid oscillating).
let perfFrames = 0, perfTime = 0;
function adaptResolution(rawDt: number) {
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

// One step of the game: trains, riding, the player.
function simulate(dt: number) {
  if (game) {
    const { player, trains } = game;
    // the car the player stands in carries them along when it moves
    const ride = journey ? journey.ride : player.fly ? null : trains.rideAt(player.pos);
    trains.update(dt, player.pos, ride);
    if (journey) {
      if (journey.stage === 'away' && journey.ride.car.object.visible) arrive(journey);
    } else if (ride) {
      player.yaw += trains.carry(ride, player.pos);
      trains.clearDoorway(ride, player.pos);
      if (trains.leaving(ride)) startJourney(ride);
    }
    rideNotices(journey ? null : ride);
    if (running && !journey) player.update(dt, input.state());
    else player.applyCamera(dt);
    headLight.position.set(player.pos.x, player.eyeY + 0.6, player.pos.z);
    updateAtmosphere(player, dt);
  }
}

function frame() {
  const raw = clock.getDelta();
  const dt = Math.min(0.05, raw);
  if (!params.has('cam')) adaptResolution(raw);
  simulate(dt);
  if (game) {
    const { player, minimap } = game;
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
