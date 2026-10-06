import * as THREE from 'three';
import { buildStation, modelGroundCuts } from './station';
import type { Station } from './station';
import { HOME_STATION, loadStationModels } from './station-models';
import type { StationPlacement } from './station-models';
import { Player } from './player';
import { Trains } from './trains';
import { setOutsideLight } from './rolling-stock/index';
import type { CarFloorData, Ride } from './trains';
import { nextStation } from './service';
import { MiniMap } from './minimap';
import { Input } from './input';
import { Sound } from './sound';
import { LINES } from './lines';
import { mountBuildSwitcher } from './build-switcher';
import { Network } from './network';
import type { PlatformFloorData } from './network';
import { StationJoin } from './station-join';
import { Stations } from './stations';
import type { StationFloorData } from './stations';
import { City } from './city';
import type { CityFloorData } from './city';
import type { CityIndex } from './city-tile';
import type { StationLayouts } from './station-layout';
import type { TrackGraph } from './track-graph';
import type { TrackGeometry } from './track-geometry';
import type { SurfaceHit } from './surface-index';

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

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 1600);
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

// How far the city is built round the camera: less on phones and tablets.
const CITY_REACH = coarse ? 800 : 1100;

// ------------------------------------------------------------------ state
// what the player can stand on besides the station model: train cars, the network's platforms, the
// network's stations, and the city's ground
type Floor = CarFloorData | PlatformFloorData | StationFloorData | CityFloorData;

interface Game {
  station: Station;
  network: Network | null;
  stations: Stations | null;
  city: City | null;
  player: Player<Floor>;
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

function loadingFailed(err: unknown) {
  $('loading').textContent = 'Could not load the station model: ' + (err instanceof Error ? err.message : String(err));
}

function onStationLoaded(root: THREE.Object3D, net: NetworkData | null) {
  // the station's tracks that run on through the network are joined to it
  const join = net ? new StationJoin(net.graph, net.geometry) : null;
  const station = buildStation(root, { join: join ? (tracks) => join.join(tracks) : undefined });
  scene.add(station.group);
  // the stations' passages and shafts open through the network's tunnel walls
  const cuts = net?.layouts ? Stations.volumes(net.layouts) : undefined;
  // the city around the line, its ground cut where the stations come up through it
  const city = net?.city ? new City(net.city, [...(net.layouts ? Stations.groundCuts(net.layouts) : []), ...modelGroundCuts(station)], CITY_REACH, undefined, params.has('nophoto') ? null : undefined, params.has('nofacades') ? null : undefined) : null;
  if (city) scene.add(city.group);
  const network = net && join ? new Network(net.graph, net.geometry, join.exclusions, { ...cuts, city: !!city }) : null;
  if (network) scene.add(network.group);
  const stations = network && net?.layouts ? new Stations(net.layouts, network.floors, !city) : null;
  if (stations) scene.add(stations.group);
  // the metro's trains run on the network's timetable, through the station and on
  const trains = new Trains(scene, station.tracks, sound, {
    renderer, quality: coarse ? 0.5 : 0.8, network: net && join ? { ...net, join } : null,
  });
  // the cars of the trains are floors too, so the player can board them through open doors, and
  // so are the network's platforms, to get off on
  const player = new Player<Floor>(camera, station.walk, (x, z, out) => floorsAt(trains, network, stations, city, x, z, out));
  const minimap = new MiniMap(renderer, station.mapGroup, station.bounds, $<HTMLCanvasElement>('minimap'), $<HTMLCanvasElement>('bigmap'));
  game = { station, network, stations, city, player, trains, minimap };
  sizeBigMap();
  buildTeleportList(station);
  buildStationList(stations, station, net?.graph ?? null);

  const cam = params.get('cam');
  if (cam) {
    const [x, y, z, yaw = 0, pitch = 0] = cam.split(',').map(Number);
    player.teleport(new THREE.Vector3(x, y, z), yaw);
    player.pitch = pitch;
    player.fly = params.has('fly');
  } else {
    player.teleport(station.spawn.pos, station.spawn.yaw);
    const at = params.get('at') && spotAt(params.get('at')!, stations, station);
    if (at) player.teleport(at.pos, at.yaw);
    const depot = net?.graph.depots?.find((d) => d.name === params.get('at'));
    if (depot) flyTo(player, depot.view);
  }
  $('loading').hidden = true;
  $('start').hidden = false;
  (window as Window & { __game?: unknown }).__game = { ...game, scene, camera, renderer, THREE, simulate };
}

const _platforms: SurfaceHit<PlatformFloorData>[] = [];
const _stationFloors: SurfaceHit<StationFloorData>[] = [];
const _cityFloors: SurfaceHit<CityFloorData>[] = [];
function floorsAt(trains: Trains, network: Network | null, stations: Stations | null, city: City | null, x: number, z: number, out: SurfaceHit<Floor>[]) {
  trains.floorsAt(x, z, out as SurfaceHit<CarFloorData>[]);
  if (network) for (const h of network.floors.query(x, z, _platforms)) out.push(h);
  if (stations) {
    for (const h of stations.walk.query(x, z, _stationFloors)) {
      // the street round the exits, but not through the buildings standing on it
      if (h.data.street && city?.insideBuilding(x, z)) continue;
      out.push(h);
    }
  }
  if (city) for (const h of city.floorsAt(x, z, _cityFloors)) out.push(h);
  return out;
}

// The track network outside the station (src/network.ts), its stations (src/stations.ts) and the
// city around it (src/city.ts). The game runs without them if they fail to load.
interface NetworkData { graph: TrackGraph; geometry: TrackGeometry; layouts: StationLayouts | null; city: CityIndex | null }
const getJson = <T>(url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
});
const networkData: Promise<NetworkData | null> = Promise.all([
  getJson<TrackGraph>('data/track-graph.json'), getJson<TrackGeometry>('data/track-geometry.json'),
  getJson<StationLayouts>('data/station-layouts.json').catch((err) => { console.warn('no station layouts:', err); return null; }),
  params.has('nocity') ? null : getJson<CityIndex>('data/city/index.json').catch((err) => { console.warn('no city:', err); return null; }),
]).then(([graph, geometry, layouts, city]) => ({ graph, geometry, layouts, city }), (err) => { console.warn('no track network:', err); return null; });

// the station models (src/station-models.ts), T-Centralen's first
getJson<Record<string, StationPlacement>>('data/stations.json')
  .then((places) => loadStationModels(places, (f) => { $('progress').style.width = `${100 * f}%`; }))
  .then((root) => networkData.then((net) => onStationLoaded(root, net)))
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
        const hits = [...station.walk.query(player.pos.x, player.pos.z), ...floorsAt(trains, game.network, game.stations, game.city, player.pos.x, player.pos.z, [])];
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

// The network's stations, to jump to from the menu.
// A view from the air: world x, y, z, heading and pitch, in free flight.
function flyTo(player: Player<Floor>, [x, y, z, yaw, pitch]: number[]) {
  player.teleport(new THREE.Vector3(x, y, z), yaw);
  player.pitch = pitch;
  player.fly = true;
  document.body.classList.add('flying');
}

// A station's platform to stand on: one the network's stations describe, or one of a model's.
function spotAt(name: string, stations: Stations | null, station: Station) {
  const spot = stations?.spot(name);
  if (spot) return spot;
  const t = station.teleports.find((p) => p.station === name && p.station !== HOME_STATION && LINES[p.line].kind === 'metro');
  return t ? { pos: t.pos, yaw: t.yaw } : null;
}

function buildStationList(stations: Stations | null, station: Station, graph: TrackGraph | null) {
  if (!stations || !graph) return;
  // the stations the network describes, and those drawn from a model other than the home one
  const names = new Set([...stations.layouts.map((s) => s.name), ...station.areas.map((a) => a.name).filter((n) => n !== HOME_STATION)]);
  const depots = graph.depots ?? [];
  const select = $<HTMLSelectElement>('lineStations');
  // a group of stations for each line, in the order of LINES; a station of two lines is in both
  const lines = Object.keys(LINES).filter((l) => graph.routes.some((r) => r.line === l)) as (keyof typeof LINES)[];
  for (const line of lines) {
    const group = document.createElement('optgroup');
    group.label = LINES[line].name;
    const served = new Set(graph.routes.filter((r) => r.line === line).flatMap((r) => r.stops.map((s) => s.station)));
    for (const name of [...names].filter((n) => served.has(n)).sort((a, b) => a.localeCompare(b, 'sv'))) {
      const o = document.createElement('option');
      o.value = o.textContent = name;
      group.appendChild(o);
    }
    select.appendChild(group);
  }
  if (depots.length) {
    const group = document.createElement('optgroup');
    group.label = 'Depots';
    for (const d of depots) {
      const o = document.createElement('option');
      o.value = `depot:${d.name}`;
      o.textContent = d.name;
      group.appendChild(o);
    }
    select.appendChild(group);
  }
  $('lineJump').hidden = false;
  select.addEventListener('change', () => {
    const name = select.value;
    select.value = '';
    const depot = depots.find((d) => `depot:${d.name}` === name);
    if (depot && game) {
      const { player } = game;
      start();
      fadeTo(() => {
        endJourney();
        flyTo(player, depot.view);
        toast(`${depot.name} · free flight`);
      });
      return;
    }
    const spot = name ? spotAt(name, stations, station) : null;
    if (!spot || !game) return;
    start();
    const { player } = game;
    fadeTo(() => {
      endJourney();
      player.fly = false;
      document.body.classList.remove('flying');
      player.teleport(spot.pos, spot.yaw);
      toast(`${name} · platform`);
    });
  });
}

// ------------------------------------------------------------------ lifts
function nearbyLift() {
  if (!game) return null;
  const { player } = game;
  let best = null, bestD = Infinity;
  for (const l of [...game.station.lifts, ...(game.stations?.lifts ?? [])]) {
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
// On the metro the trains run on through the network, and a ride goes on from station to
// station. Beyond the last station, the train turns out of sight: the screen goes dark, and the
// player comes back in the same spot of the train that leaves from there the other way. On the
// pendeltåg a ride ends where the model's tunnel does: the screen goes dark for the rest of the
// trip and back, and the player comes back into the station they left standing in the same spot of a train
// on the other track (see Trains.transfer).
interface Journey {
  ride: Ride;
  stage: 'leaving' | 'away';
  relYaw: number; // the player's heading relative to their car
  arrival: string;
}
let journey: Journey | null = null;
let journeyTimer: ReturnType<typeof setTimeout> | undefined;
let lastRide: { svc: Ride['svc']; state: string } | null = null;

function startJourney(ride: Ride) {
  if (!game) return;
  const { player, trains } = game;
  const { svc } = ride;
  // a trip turning at the end of the line, or a shuttle going on to its next station and back
  const end = svc.trip ? svc.stops[svc.stops.length - 1].station : '';
  const next = nextStation(svc);
  // (a shuttle comes back into the station it left)
  const home = svc.stops[0].station;
  journey = { ride, stage: 'leaving', relYaw: 0, arrival: `Arriving at ${home}` };
  $('fadeText').textContent = end ? `${end} — the train turns back` : next ? `${next} …` : '…';
  $('fade').classList.add('on', 'slow');
  journeyTimer = setTimeout(() => {
    if (!journey) return;
    journey.relYaw = player.yaw - ride.car.object.rotation.y;
    journey.ride = trains.transfer(ride);
    journey.stage = 'away';
    if (end) journey.arrival = `${end} — to ${journey.ride.svc.dest[1]}`;
    else $('fadeText').textContent = next ? `${next} … and back to ${home}` : `Back to ${home}`;
  }, 1600);
}

// The train coming back is in sight: put the player in it and fade in.
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
    toast(j.arrival, 2500);
  }, 300);
}

function endJourney() {
  if (!journey) return;
  journey = null;
  clearTimeout(journeyTimer);
  $('fade').classList.remove('on', 'slow');
}

// Toasts as the train the player is in closes its doors, leaves and arrives.
function rideNotices(ride: Ride | null) {
  if (!ride) { lastRide = null; return; }
  const { svc } = ride;
  if (lastRide?.svc === svc && lastRide.state !== svc.state) {
    const at = nextStation(svc);
    if (svc.state === 'closing') toast('Doors closing — stand clear', 2200);
    else if (svc.state === 'run' && at) toast(`Nästa: ${at}`, 3000);
    else if (svc.state === 'dwell') {
      const last = svc.trip && svc.stop === svc.stops.length - 1;
      toast(last ? `Slutstation ${at} — doors opening` : `${at} — doors opening`, 2200);
    }
  }
  lastRide = { svc, state: svc.state };
}

// ------------------------------------------------------------------ HUD
let hudNext = 0;
// "near Östermalmstorg · ", in free flight along the network
function nearby(pos: THREE.Vector3) {
  const st = game?.network?.nearestStation(pos.x, pos.z);
  return st && st.d < 1500 ? `near ${st.name} · ` : '';
}
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
    ? `Free flight · ${nearby(player.pos)}${player.pos.y.toFixed(0)} m`
    : surface?.kind === 'city' ? `${nearby(player.pos)}street · ${player.pos.y.toFixed(0)} m`
    : `${surface?.rec.label ?? '—'} · level ${player.pos.y.toFixed(0)} m`;
  // on a platform: the station model's, or a station's on the network, or in that station
  const deps = !surface || surface.kind === 'train' || surface.kind === 'city' ? []
    : surface.kind === 'platform' || surface.kind === 'station' ? trains.departuresAt(surface.station).slice(0, 4)
    : surface.rec.platformLine ? trains.departuresFor(surface.rec) : [];
  const box = $('departures');
  box.hidden = deps.length === 0;
  box.innerHTML = deps
    .map((d) => `<div class="dep"><span class="ln" style="background:${d.color}">${d.line}</span><span class="ds">${d.dest}</span><span class="wh">${d.when}</span></div>`)
    .join('');
}

// ------------------------------------------------------------------ atmosphere
// Stockholm C and the tram stop are above ground: fade to an evening sky up there, and where the
// network's track runs in the open.
const SKY = new THREE.Color(0x8193ad), DARK = new THREE.Color(FOG);
let outdoor = 0;
const inBox = (b: THREE.Box3, pos: THREE.Vector3, margin: number) =>
  pos.x > b.min.x - margin && pos.x < b.max.x + margin && pos.z > b.min.z - margin && pos.z < b.max.z + margin;
// in the home station's box (the minimap's)
function inStation(pos: THREE.Vector3, margin = 0) {
  const b = game?.station.bounds;
  return !!b && inBox(b, pos, margin);
}
// the station model whose box the player is in
const modelAt = (pos: THREE.Vector3) => game?.station.areas.find((a) => inBox(a.bounds, pos, 0)) ?? null;
function updateAtmosphere(player: Player<Floor>, dt: number) {
  const { x, y, z } = player.pos;
  const station = THREE.MathUtils.smoothstep(y, 3.5, 5.8);
  // the network's stations first: the station model's box reaches over some of them
  // in T-Centralen's model, out above its street level; in the others, out only up at the city's ground
  const model = modelAt(player.pos);
  const inModel = model ? (model.name === HOME_STATION ? station : game?.city?.outdoorsAt(x, y, z) ?? 0) : null;
  const target = player.fly ? (game?.city ? 1 : 0.5) : game?.stations?.outdoorsAt(x, y, z)
    ?? inModel ?? game?.network?.outdoorsAt(x, y, z) ?? game?.city?.outdoorsAt(x, y, z) ?? station;
  outdoor += (target - outdoor) * Math.min(1, dt * 3);
  // flying over the city, the sky; without it, the dark the network hangs in
  background.copy(DARK).lerp(SKY, player.fly && !game?.city ? 0 : outdoor);
  fog.color.copy(background);
  // out in the open the city can be seen nearly as far as it is built
  fog.density = THREE.MathUtils.lerp(0.0105, game?.city ? 2.3 / CITY_REACH : 0.0035, outdoor);
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
      else if (journey.stage === 'away' && !trains.inService(journey.ride.svc)) {
        // a train that had nowhere to turn: back to the start
        endJourney();
        player.teleport(game.station.spawn.pos, game.station.spawn.yaw);
      }
    } else if (ride) {
      player.yaw += trains.carry(ride, player.pos);
      trains.clearDoorway(ride, player.pos);
      if (trains.leaving(ride)) startJourney(ride);
    }
    rideNotices(journey ? null : ride);
    if (running && !journey) player.update(dt, input.state());
    else player.applyCamera(dt);
    headLight.position.set(player.pos.x, player.eyeY + 0.6, player.pos.z);
    game.network?.update(camera.position);
    game.stations?.update(camera.position);
    game.city?.update(camera.position);
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
      // the minimap is of the station: away from it, it is hidden
      const near = inStation(player.pos, 60);
      $('minimap').hidden = !near;
      if (near) minimap.draw(player);
      updateHud();
    }
    if (showMap) minimap.drawBig(player);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
