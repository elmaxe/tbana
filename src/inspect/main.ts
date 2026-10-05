// The inspector (inspect.html, opened by `npm run inspect`): the whole network on a map, the
// game's world where you click on it, and what the place was built from. The view is kept in the
// address (?cam=…&place=…), so a reload after rebuilding comes back to it.
import * as THREE from 'three';
import { TrackIndex, loadData, worldLatLon } from './data';
import { Fly, typing } from './fly';
import { Outside } from './outside';
import type { CutMode } from './outside';
import { Overview } from './overview';
import type { MapHit } from './overview';
import { Reference } from './reference';
import { ReportPanel } from './report-panel';
import type { Draft } from './report-panel';
import { ReportStore } from './reports';
import type { Report } from './reports';
import type { Place } from './reference';
import { aerial, onPlatform, onTrack } from './views';
import type { View } from './views';
import { World } from './world';
import type { Viewport } from './world';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);

// ------------------------------------------------------------------ the panes' widths
for (const split of document.querySelectorAll<HTMLElement>('.split')) {
  const side = split.dataset.side!;
  split.addEventListener('pointerdown', (e) => {
    split.setPointerCapture(e.pointerId);
    split.classList.add('drag');
    const move = (ev: PointerEvent) => {
      const w = innerWidth;
      const px = side === 'left' ? ev.clientX : w - ev.clientX;
      document.documentElement.style.setProperty(`--${side}`, `${Math.max(12, Math.min(70, (100 * px) / w))}%`);
    };
    const up = () => {
      split.classList.remove('drag');
      split.removeEventListener('pointermove', move);
      split.removeEventListener('pointerup', up);
      try { localStorage.setItem(`inspect-${side}`, document.documentElement.style.getPropertyValue(`--${side}`)); } catch { /* not kept */ }
    };
    split.addEventListener('pointermove', move);
    split.addEventListener('pointerup', up);
  });
  try {
    const kept = localStorage.getItem(`inspect-${side}`);
    if (kept) document.documentElement.style.setProperty(`--${side}`, kept);
  } catch { /* not kept */ }
}

// ------------------------------------------------------------------ loading
const data = await loadData();
const track = new TrackIndex(data.geometry);
const world = new World($<HTMLCanvasElement>('view'));
const fly = new Fly($<HTMLCanvasElement>('view'), world.camera, () => { hudAt = 0; });
const map = new Overview($<HTMLCanvasElement>('map'), data, track, $('mapHint'));
Overview.legend($('mapLegend'));
const ref = new Reference($('ref'), data, track, world, {
  view: (v) => go(v),
  select: (p, flyThere) => select(p, flyThere),
});

const names = [...data.graph.stations].map((s) => s.name).sort((a, b) => a.localeCompare(b, 'sv'));
$('stationNames').innerHTML = names.map((n) => `<option value="${n}">`).join('');

try {
  await world.load(data);
} catch (err) {
  $('loading').textContent = `Could not build the world: ${err instanceof Error ? err.message : err}`;
  throw err;
}
$('loading').hidden = true;
(window as Window & { __inspect?: unknown }).__inspect = { world, fly, map, ref, data, THREE };

// ------------------------------------------------------------------ going places
const shownFrom = new THREE.Vector3();

function go(v: View) {
  fly.set(v.eye, v.yaw, v.pitch);
  map.reveal(v.eye[0], v.eye[2]);
  // what was double-clicked is out of sight
  $('pick').hidden = true;
  $('view').focus();
}

// Shows a place in the reference pane, and with `flyThere`, takes the camera to it.
function select(p: Place, flyThere: boolean, fromAbove = false) {
  ref.show(p);
  const { x, z } = p.kind === 'station' ? data.graph.stations.find((s) => s.name === p.name)! : p;
  map.setMarks([{ x, z, colour: '#ffffff' }]);
  // following the camera waits until it has left the place
  shownFrom.copy(fly.pos);
  if (!flyThere) return;
  // the drawn track there: only the red line's is drawn
  const drawn = p.kind === 'station' || (p.kind === 'track' && !!data.geometry.pieces[p.piece]);
  const sm = drawn ? track.nearest(x, z, 40) : null;
  const v = fromAbove ? aerial(world, track, x, z, sm?.y)
    : p.kind === 'station' ? onPlatform(world, p.name) ?? aerial(world, track, x, z)
    : sm ? onTrack(track, sm)
    : aerial(world, track, x, z);
  go(v);
  shownFrom.copy(fly.pos);
}

map.onPick = (hit: MapHit, shift: boolean) => {
  if (hit.kind === 'report') {
    const r = store.list.find((q) => q.id === hit.id);
    if (r) goReport(r);
    return;
  }
  const place: Place = hit.kind === 'station' ? { kind: 'station', name: hit.name } : hit;
  select(place, true, shift);
};

$('find').addEventListener('change', () => {
  const input = $<HTMLInputElement>('find');
  const st = data.graph.stations.find((s) => s.name.toLowerCase() === input.value.trim().toLowerCase());
  if (!st) return;
  input.value = '';
  input.blur();
  map.centre(st.x, st.z, 0.4);
  select({ kind: 'station', name: st.name }, true);
});
$('fitMap').addEventListener('click', () => { map.fit(); map.draw(); });

// ------------------------------------------------------------------ options
for (const [id, key] of [['optCity', 'city'], ['optTrains', 'trains'], ['optFog', 'fog'], ['optBright', 'bright'], ['optWire', 'wire']] as const) {
  const box = $<HTMLInputElement>(id);
  box.addEventListener('change', () => world.setOptions({ [key]: box.checked }));
  world.setOptions({ [key]: box.checked });
}
for (const [id, key] of [['showKinds', 'kinds'], ['showYards', 'yards'], ['showFixes', 'fixes'], ['showReports', 'reports']] as const) {
  const box = $<HTMLInputElement>(id);
  box.addEventListener('change', () => map.setOptions({ [key]: box.checked }));
}

// the game's ?cam= for this view
const gameCam = () => `cam=${fly.cam().join(',')}&fly`;
$('openGame').addEventListener('click', () => open(`./?${gameCam()}`, '_blank'));
$('copyCam').addEventListener('click', async () => {
  const url = new URL(`./?${gameCam()}`, location.href).href;
  await navigator.clipboard.writeText(url).catch(() => prompt('The game at this view:', url));
  flash($('copyCam'), 'Copied');
});
function flash(el: HTMLElement, text: string) {
  const was = el.textContent;
  el.textContent = text;
  setTimeout(() => (el.textContent = was), 1200);
}

// Runs a build tool on the dev server; when it passes, reloads to show what it built.
$<HTMLSelectElement>('rebuild').addEventListener('change', async (e) => {
  const select = e.target as HTMLSelectElement, tool = select.value;
  select.value = '';
  if (!tool) return;
  const out = document.createElement('pre');
  out.textContent = `Running npm run ${tool}…`;
  $('ref').prepend(out);
  $('ref').scrollTop = 0;
  const res = await fetch(`__inspect/build?tool=${tool}`, { method: 'POST' }).catch((err: Error) => ({ ok: false, text: async () => err.message }));
  out.textContent = await res.text();
  out.classList.toggle('bad', !res.ok);
  if (res.ok) {
    keepState();
    out.textContent += '\nReloading…';
    setTimeout(() => location.reload(), 800);
  }
});

// ------------------------------------------------------------------ the view in 3D
// T: down (or up) to the track nearest under the camera
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyT' || typing(e)) return;
  const sm = track.nearest(fly.pos.x, fly.pos.z, 300, fly.pos.y);
  if (!sm) return;
  // keep looking the way the camera does, along the track
  const v = onTrack(track, sm);
  const turn = Math.cos(v.yaw - fly.yaw) < 0 ? Math.PI : 0;
  go({ ...v, yaw: v.yaw + turn });
});

// ------------------------------------------------------------------ the two views
// The first-person view, and the outside view following it: side by side (or one over the
// other, in a tall pane), the outside view inset in a corner, or the first-person view alone.
type Rect = { x: number; y: number; w: number; h: number };
const outside = new Outside();
world.scene.add(outside.marker);
const viewMode = $<HTMLSelectElement>('viewMode'), cutMode = $<HTMLSelectElement>('cutMode');
let fpRect: Rect = { x: 0, y: 0, w: 1, h: 1 }, outRect: Rect | null = null;

function layout() {
  const c = $('view'), W = c.clientWidth, H = c.clientHeight, gap = 3;
  outRect = null;
  fpRect = { x: 0, y: 0, w: W, h: H };
  if (viewMode.value === 'split') {
    if (W >= H) {
      const w = Math.floor((W - gap) / 2);
      fpRect = { x: 0, y: 0, w, h: H };
      outRect = { x: w + gap, y: 0, w: W - w - gap, h: H };
    } else {
      const h = Math.floor((H - gap) / 2);
      fpRect = { x: 0, y: 0, w: W, h };
      outRect = { x: 0, y: h + gap, w: W, h: H - h - gap };
    }
  } else if (viewMode.value === 'inset') {
    const w = Math.round(Math.max(180, W * 0.36)), h = Math.round(Math.max(130, H * 0.36));
    outRect = { x: W - w - 8, y: 8, w, h };
  }
  const place = (el: HTMLElement, r: Rect | null) => {
    el.hidden = !r;
    if (r) Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
  };
  place($('fpBox'), fpRect);
  place($('outBox'), outRect);
  // the outside view's hint, where there's room for it
  $('outBar').querySelector('span')!.hidden = !outRect || outRect.w < 420;
}
new ResizeObserver(layout).observe($('view'));
for (const [el, key] of [[viewMode, 'inspect-views'], [cutMode, 'inspect-cut']] as const) {
  try { el.value = localStorage.getItem(key) ?? el.value; } catch { /* not kept */ }
  el.addEventListener('change', () => {
    try { localStorage.setItem(key, el.value); } catch { /* not kept */ }
    layout();
  });
}
layout();

// The views to draw.
function viewports(): Viewport[] {
  const views: Viewport[] = [{ camera: world.camera, ...fpRect }];
  if (outRect) views.push({ camera: outside.camera, ...outRect, cut: outside.cutAt(fly, world.outdoorsAt(fly.pos)), outside: true });
  return views;
}

// which view a point of the page is in
const inRect = (r: Rect | null, cx: number, cy: number) => {
  if (!r) return false;
  const c = $('view').getBoundingClientRect(), x = cx - c.left, y = cy - c.top;
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
};
const inOutside = (cx: number, cy: number) => inRect(outRect, cx, cy);
fly.accepts = (cx, cy) => !inOutside(cx, cy) && inRect(fpRect, cx, cy);

// the outside view: drag to swing round, the wheel to come closer or go further
{
  const c = $('view');
  let drag: { x: number; y: number } | null = null;
  c.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !inOutside(e.clientX, e.clientY)) return;
    c.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY };
  });
  c.addEventListener('pointermove', (e) => {
    if (!drag) return;
    outside.orbit(e.clientX - drag.x, e.clientY - drag.y);
    drag = { x: e.clientX, y: e.clientY };
  });
  c.addEventListener('pointerup', () => { drag = null; });
  c.addEventListener('wheel', (e) => {
    if (!inOutside(e.clientX, e.clientY)) return;
    e.preventDefault();
    outside.zoom(e.deltaY);
  }, { passive: false });
}

// double-click: what's that? (in either view) A report made soon after is about it.
let lastPick: { point: THREE.Vector3; names: string[]; at: number } | null = null;
$('view').addEventListener('dblclick', (e) => {
  const out = inOutside(e.clientX, e.clientY), r = out ? outRect! : fpRect;
  const c = $('view').getBoundingClientRect();
  const nx = ((e.clientX - c.left - r.x) / r.w) * 2 - 1, ny = -((e.clientY - c.top - r.y) / r.h) * 2 + 1;
  const hit = out ? world.pick(outside.camera, nx, ny, outside.cutAt(fly, world.outdoorsAt(fly.pos))) : world.pick(world.camera, nx, ny);
  const box = $('pick');
  if (!hit) { box.hidden = true; return; }
  const { x, y, z } = hit.point;
  const sm = track.nearest(x, z, 30, y);
  const { lat, lon } = worldLatLon(x, z);
  box.textContent = `${hit.names.join(' › ') || '(unnamed)'}\n`
    + `x ${x.toFixed(2)}  y ${y.toFixed(2)}  z ${z.toFixed(2)}  · ${hit.distance.toFixed(1)} m away · ${lat.toFixed(6)}, ${lon.toFixed(6)}\n`
    + (sm ? `track: piece ${sm.piece}, ${sm.kind}, rail ${sm.y.toFixed(2)} m (${(y - sm.y).toFixed(2)} m from here), ${Math.hypot(sm.x - x, sm.z - z).toFixed(1)} m across` : 'no drawn track within 30 m')
    + '\nR: report a problem here';
  box.hidden = false;
  lastPick = { point: hit.point.clone(), names: hit.names, at: performance.now() };
  map.setMarks([{ x, z, colour: '#ffd21f' }]);
});

$('pick').addEventListener('click', () => { $('pick').hidden = true; });

// ------------------------------------------------------------------ the HUD, following
let hudAt = 0, followAt = 0;
function updateHud(now: number) {
  if (now < hudAt) return;
  hudAt = now + 200;
  const { x, y, z } = fly.pos;
  const near = world.network?.nearestStation(x, z);
  const ground = world.city?.heightAt(x, z);
  const sm = track.nearest(x, z, 60, y);
  const heading = ((((-fly.yaw * 180) / Math.PI) % 360) + 360) % 360;
  $('hud').textContent = [
    `x ${x.toFixed(1)}  y ${y.toFixed(1)}  z ${z.toFixed(1)}`,
    `heading ${heading.toFixed(0)}°  pitch ${((fly.pitch * 180) / Math.PI).toFixed(0)}°  speed ${fly.speed.toFixed(0)} m/s`,
    ground !== null && ground !== undefined ? `ground ${ground.toFixed(1)} m  (${(y - ground).toFixed(1)} m ${y > ground ? 'above' : 'below'})` : 'ground —',
    sm ? `track: piece ${sm.piece} · ${sm.kind} · rail ${sm.y.toFixed(1)} m` : 'track —',
    near ? `${near.name}, ${near.d.toFixed(0)} m` : '',
  ].join('\n');
}

// With "follow camera", the reference shows the station the camera is at, once it has flown
// away from what was picked (from `shownFrom`).
function follow(now: number) {
  if (now < followAt || !$<HTMLInputElement>('follow').checked) return;
  followAt = now + 500;
  if (fly.pos.distanceTo(shownFrom) < 150) return;
  const near = world.network?.nearestStation(fly.pos.x, fly.pos.z);
  if (!near || near.d > 250) return;
  const p = ref.place;
  if (p?.kind === 'station' && p.name === near.name) return;
  ref.show({ kind: 'station', name: near.name });
  const st = data.graph.stations.find((s) => s.name === near.name)!;
  map.setMarks([{ x: st.x, z: st.z, colour: '#ffffff' }]);
}

// ------------------------------------------------------------------ the address
function placeParam(p: Place | null) {
  if (!p) return '';
  return p.kind === 'station' ? `station:${p.name}` : p.kind === 'track' ? `track:${p.piece},${p.x.toFixed(1)},${p.z.toFixed(1)}` : `point:${p.x.toFixed(1)},${p.z.toFixed(1)}`;
}
function parsePlace(s: string | null): Place | null {
  const [kind, rest] = (s ?? '').split(/:(.*)/);
  if (kind === 'station' && rest) return { kind, name: rest };
  const n = (rest ?? '').split(',').map(Number);
  if (kind === 'track' && n.length === 3) return { kind, piece: n[0], x: n[1], z: n[2] };
  if (kind === 'point' && n.length === 2) return { kind, x: n[0], z: n[1] };
  return null;
}
let keptAt = 0;
// The view as the address's query: the camera, and the place shown.
function viewQuery() {
  const q = new URLSearchParams();
  q.set('cam', [fly.pos.x, fly.pos.y, fly.pos.z].map((n) => n.toFixed(1)).concat([fly.yaw.toFixed(3), fly.pitch.toFixed(3)]).join(','));
  if (ref.place) q.set('place', placeParam(ref.place));
  return q.toString().replace(/%2C/g, ',').replace(/%3A/g, ':');
}
function keepState() {
  history.replaceState(null, '', `?${viewQuery()}`);
}

// Back to a view kept in a query; false if it has none.
function restore(q: URLSearchParams) {
  const cam = q.get('cam')?.split(',').map(Number);
  if (!cam || cam.length < 3 || !cam.every(Number.isFinite)) return false;
  fly.set([cam[0], cam[1], cam[2]], cam[3] ?? 0, cam[4] ?? 0);
  const place = parsePlace(q.get('place'));
  if (place) select(place, false);
  map.reveal(cam[0], cam[2]);
  return true;
}

// ------------------------------------------------------------------ reporting problems
// The commit the world was built from, and whether the checkout has changed since ('+').
const commit = data.refs ? await fetch('__inspect/version').then((r) => (r.ok ? r.text() : null), () => null) : null;
const store = new ReportStore();

// The view now, for a report: what it's about, where that is, and a picture.
async function capture(): Promise<Draft> {
  const recent = lastPick && performance.now() - lastPick.at < 120_000 ? lastPick : null;
  lastPick = null;
  const looked = recent ? null : world.pick(world.camera, 0, 0);
  const point = recent?.point ?? looked?.point
    ?? fly.pos.clone().add(new THREE.Vector3(0, 0, -5).applyEuler(world.camera.rotation));
  const near = world.network?.nearestStation(point.x, point.z);
  const sm = track.nearest(point.x, point.z, 30, point.y);
  const { lat, lon } = worldLatLon(point.x, point.z);
  return {
    at: { x: point.x, y: point.y, z: point.z }, lat, lon,
    what: (recent?.names ?? looked?.names ?? []).join(' › ') || null,
    station: near ? { name: near.name, d: near.d } : null,
    track: sm ? { piece: sm.piece, kind: sm.kind, rail: sm.y } : null,
    inspect: viewQuery(), game: gameCam(), commit,
    image: await screenshot(),
  };
}

// Both views as they are, at most 1280 wide.
function screenshot() {
  world.render(viewports());
  const c = $<HTMLCanvasElement>('view'), k = Math.min(1, 1280 / c.width);
  const out = Object.assign(document.createElement('canvas'), { width: Math.round(c.width * k), height: Math.round(c.height * k) });
  // straight after drawing, before the browser clears the canvas
  out.getContext('2d')!.drawImage(c, 0, 0, out.width, out.height);
  return new Promise<Blob | null>((ok) => out.toBlob(ok, 'image/jpeg', 0.82));
}

function goReport(r: Report) {
  showTab('reports');
  panel.flash(r.id);
  restore(new URLSearchParams(r.inspect));
  map.setMarks([{ x: r.at.x, z: r.at.z, colour: '#ff6a3d' }]);
}

const panel = new ReportPanel(store, $('reports'), { capture, go: goReport, canSave: !!data.refs });

// Pins where the reports are, in both views (not picked: on a layer of their own).
const PIN_LAYER = 2;
const pins = new THREE.Group();
world.scene.add(pins);
world.camera.layers.enable(PIN_LAYER);
outside.camera.layers.enable(PIN_LAYER);
const pinGeometry = new THREE.ConeGeometry(0.35, 1.1, 4).rotateX(Math.PI).translate(0, 0.55, 0);
const pinMaterials = [0xff6a3d, 0x5bc27a].map((color) => new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.85 }));
store.onChange = () => {
  panel.render();
  map.setReports(store.list.map((r) => ({ id: r.id, x: r.at.x, z: r.at.z, done: r.done, text: r.text })));
  pins.clear();
  for (const r of store.list) {
    const pin = new THREE.Mesh(pinGeometry, pinMaterials[r.done ? 1 : 0]);
    pin.position.set(r.at.x, r.at.y, r.at.z);
    pin.layers.set(PIN_LAYER);
    pin.renderOrder = 998;
    pins.add(pin);
  }
};
$<HTMLInputElement>('showReports').addEventListener('change', (e) => { pins.visible = (e.target as HTMLInputElement).checked; });
await store.open();

$('report').addEventListener('click', () => void panel.start());
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyR' || typing(e) || e.ctrlKey || e.metaKey || e.altKey || panel.open) return;
  e.preventDefault();
  void panel.start();
});

// the Reference and Reports tabs
function showTab(tab: 'ref' | 'reports') {
  $('ref').hidden = tab !== 'ref';
  $('reports').hidden = tab !== 'reports';
  $('tabRef').classList.toggle('on', tab === 'ref');
  $('tabReports').classList.toggle('on', tab === 'reports');
}
$('tabRef').addEventListener('click', () => showTab('ref'));
$('tabReports').addEventListener('click', () => showTab('reports'));

// ------------------------------------------------------------------ start
{
  const at = params.get('at');
  if (restore(params)) {
    map.centre(fly.pos.x, fly.pos.z, 0.15);
  } else {
    const name = names.find((n) => n.toLowerCase() === (at ?? 'T-Centralen').toLowerCase()) ?? 'T-Centralen';
    const st = data.graph.stations.find((s) => s.name === name)!;
    if (at) map.centre(st.x, st.z, 0.3);
    select({ kind: 'station', name }, true, !at);
  }
  map.draw();
}

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now();
  fly.update(dt);
  world.update(dt);
  world.camera.aspect = fpRect.w / fpRect.h;
  if (outRect) {
    outside.cut = cutMode.value as CutMode;
    outside.update(dt, fly, world.camera);
  }
  outside.marker.visible = !!outRect;
  world.render(viewports());
  const { fov, aspect } = world.camera;
  const o = outside.camera.position;
  map.setCamera(fly.pos.x, fly.pos.z, fly.yaw, 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * aspect), outRect ? { x: o.x, z: o.z } : null);
  updateHud(now);
  follow(now);
  if (fly.moved && now > keptAt) {
    fly.moved = false;
    keptAt = now + 1000;
    keepState();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
