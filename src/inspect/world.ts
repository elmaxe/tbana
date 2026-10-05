// The game's world, built as src/main.ts builds it (the station models, the network's track and
// stations, the city, the trains), for the inspector to fly through. There is no player: the
// camera goes anywhere, and the tiles are built round it.
import * as THREE from 'three';
import { buildStation, modelGroundCuts } from '../station';
import { HOME_STATION, loadStationModels } from '../station-models';
import type { StationPlacement } from '../station-models';
import type { Station } from '../station';
import { Trains } from '../trains';
import { setOutsideLight } from '../rolling-stock/index';
import { Network } from '../network';
import { StationJoin } from '../station-join';
import { Stations } from '../stations';
import { City } from '../city';
import { getJson } from './data';
import type { InspectData } from './data';

export interface WorldOptions { city: boolean; trains: boolean; fog: boolean; bright: boolean; wire: boolean }

// A view to draw: a camera into a rectangle of the canvas (CSS pixels from its top left). With
// `cut`, everything over that height is cut away; `outside` views have no fog, and the sky (or
// the dark of the earth, when cut).
export interface Viewport { camera: THREE.PerspectiveCamera; x: number; y: number; w: number; h: number; cut?: number | null; outside?: boolean }

// the background of a view cut through underground: the earth round the section
const SECTION = new THREE.Color(0x1e2530);
const DARK = new THREE.Color(0x0a0c11), SKY = new THREE.Color(0x8193ad), CLEAR_SKY = new THREE.Color(0x9fb3cc);
const CITY_REACH = 1100;

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, 1, 0.1, 4000);
  station: Station | null = null;
  network: Network | null = null;
  stations: Stations | null = null;
  city: City | null = null;
  trains: Trains | null = null;
  options: WorldOptions = { city: true, trains: true, fog: false, bright: true, wire: false };

  private trainGroup = new THREE.Group();
  private ambient = new THREE.AmbientLight(0xffffff, 0);
  private headLight = new THREE.PointLight(0xfff1dc, 9, 26, 1.5);
  private background = new THREE.Color();
  private fog = new THREE.FogExp2(DARK, 0.0105);
  private cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  private outdoor = 1;
  private wireAt = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    const { scene } = this;
    scene.background = this.background;
    scene.add(new THREE.HemisphereLight(0xf2f5ff, 0x4a4540, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(0.35, 1, 0.25);
    scene.add(sun, this.ambient, this.headLight, this.trainGroup);
    setOutsideLight({ direct: 0, ambient: 0.15 });
    this.camera.rotation.order = 'YXZ';
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
  }

  async load(data: InspectData) {
    const root = await loadStationModels(await getJson<Record<string, StationPlacement>>('data/stations.json'));

    const { graph, geometry, layouts } = data;
    const join = new StationJoin(graph, geometry);
    const station = buildStation(root, { join: (tracks) => join.join(tracks) });
    this.scene.add(station.group);
    const cuts = layouts ? Stations.volumes(layouts) : undefined;
    const city = data.city ? new City(data.city, [...(layouts ? Stations.groundCuts(layouts) : []), ...modelGroundCuts(station)], CITY_REACH) : null;
    if (city) this.scene.add(city.group);
    const network = new Network(graph, geometry, join.exclusions, { ...cuts, city: !!city });
    this.scene.add(network.group);
    const stations = layouts ? new Stations(layouts, network.floors, !city) : null;
    if (stations) this.scene.add(stations.group);
    this.trains = new Trains(this.trainGroup, station.tracks, null, { renderer: this.renderer, quality: 0.8, network: { graph, geometry, join } });
    Object.assign(this, { station, network, stations, city });
  }

  setOptions(o: Partial<WorldOptions>) {
    Object.assign(this.options, o);
    if (this.city) this.city.group.visible = this.options.city;
    this.trainGroup.visible = this.options.trains;
    this.ambient.intensity = this.options.bright ? 1.6 : 0;
    if (o.wire !== undefined) this.applyWire();
  }

  private applyWire() {
    const wire = this.options.wire;
    this.scene.traverse((obj) => {
      const m = (obj as THREE.Mesh).material;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
        if ('wireframe' in mat && mat.wireframe !== wire) { mat.wireframe = wire; mat.needsUpdate = true; }
      }
    });
  }

  // Whether (x, y, z) is out in the open, as the game works it out for someone walking there.
  outdoorsAt({ x, y, z }: THREE.Vector3) {
    const model = this.station?.areas.find(({ bounds: b }) => x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z);
    const ground = this.city?.heightAt(x, z);
    return this.stations?.outdoorsAt(x, y, z)
      ?? (model ? (model.name === HOME_STATION ? THREE.MathUtils.smoothstep(y, 3.5, 5.8) : this.city?.outdoorsAt(x, y, z) ?? 0) : null)
      ?? this.network?.outdoorsAt(x, y, z)
      ?? (ground !== null && ground !== undefined ? (y > ground - 0.5 ? 1 : 0) : 1);
  }

  update(dt: number) {
    const pos = this.camera.position;
    if (this.trains && this.options.trains) this.trains.update(dt, pos, null);
    this.network?.update(pos);
    this.stations?.update(pos);
    if (this.options.city) this.city?.update(pos);
    this.headLight.position.copy(pos);
    // the sky out in the open, the dark underground; with the game's fog, as the game has it
    const target = this.outdoorsAt(pos);
    this.outdoor += (target - this.outdoor) * Math.min(1, dt * 3);
    if (this.options.fog) {
      this.background.copy(DARK).lerp(SKY, this.outdoor);
      this.fog.color.copy(this.background);
      this.fog.density = THREE.MathUtils.lerp(0.0105, this.city ? 2.3 / CITY_REACH : 0.0035, this.outdoor);
      this.scene.fog = this.fog;
    } else {
      this.background.copy(DARK).lerp(CLEAR_SKY, this.outdoor);
      this.scene.fog = null;
    }
    // tiles built since are drawn as wire too
    if (this.options.wire && performance.now() > this.wireAt) {
      this.wireAt = performance.now() + 1000;
      this.applyWire();
    }
  }

  // Draws each view into its rectangle, over a background of the panes' dividers.
  render(views: Viewport[]) {
    const r = this.renderer, H = this.canvas.clientHeight;
    const { fog, background } = this.scene;
    r.setScissorTest(false);
    r.setClearColor(0x2a3340);
    r.clear();
    r.setScissorTest(true);
    for (const v of views) {
      if (v.w < 2 || v.h < 2) continue;
      r.setViewport(v.x, H - v.y - v.h, v.w, v.h);
      r.setScissor(v.x, H - v.y - v.h, v.w, v.h);
      v.camera.aspect = v.w / v.h;
      v.camera.updateProjectionMatrix();
      r.clippingPlanes = v.cut === null || v.cut === undefined ? [] : [this.cutPlane.set(this.cutPlane.normal, v.cut)];
      this.scene.fog = v.outside ? null : fog;
      this.scene.background = !v.outside ? background : v.cut === null || v.cut === undefined ? CLEAR_SKY : SECTION;
      r.render(this.scene, v.camera);
    }
    r.clippingPlanes = [];
    r.setScissorTest(false);
    Object.assign(this.scene, { fog, background });
  }

  // What's under a point of a view (-1..1 across and up) seen with `camera`: where, and what it
  // belongs to. With `cut`, what's cut away over that height isn't there.
  pick(camera: THREE.Camera, nx: number, ny: number, cut: number | null = null) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
    ray.far = 6000;
    const hit = ray.intersectObjects(this.scene.children, true)
      .find((h) => h.object.visible && isShown(h.object) && (cut === null || h.point.y <= cut));
    if (!hit) return null;
    const names: string[] = [];
    for (let o: THREE.Object3D | null = hit.object; o && o !== this.scene; o = o.parent) if (o.name) names.unshift(o.name);
    return { point: hit.point, distance: hit.distance, names };
  }
}

function isShown(o: THREE.Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}
