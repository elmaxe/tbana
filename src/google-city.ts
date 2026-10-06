// Google's Photorealistic 3D Tiles of the city, streamed through Cesium ion, as an alternative to
// the city we build ourselves. It is opt-in: ?google in the URL, or G in the game, and it needs a
// Cesium ion token (VITE_CESIUM_ION_TOKEN at build time). Ion's free plan allows 1,000 sessions a
// month, so nothing is fetched until it is turned on.
//
// Google's tiles are in Earth-centred coordinates (WGS 84, metres). They are placed in the world by
// the east-north-up frame at the world's origin, turned by the grid's convergence there, and lifted
// by the geoid's height over the ellipsoid, since the world's heights are in RH 2000.
//
// The mesh is one closed surface: it has no tunnels and isn't cut where the stations come up, so it
// is hidden whenever our own buildings are (with the camera well under the ground). Walking still
// uses our own ground.

import * as THREE from 'three';
import { TilesRenderer } from '3d-tiles-renderer';
import { CesiumIonAuthPlugin, TileCompressionPlugin, UnloadTilesPlugin } from '3d-tiles-renderer/plugins';
import { ORIGIN, project, unproject } from './geo';

const ASSET = 2275207;     // Google Photorealistic 3D Tiles on Cesium ion
const GEOID = 23.4;        // SWEN17_RH2000 geoid height round T-Centralen (m)
const ERROR_TARGET = 12;   // screen-space error (px) a tile is refined past

// WGS 84
const A = 6378137, E2 = 6.69437999014e-3;

// The matrix taking Earth-centred coordinates to the world's.
function earthToWorld() {
  const { lat, lon } = unproject(ORIGIN.e, ORIGIN.n);
  const phi = THREE.MathUtils.degToRad(lat), lam = THREE.MathUtils.degToRad(lon);
  const sp = Math.sin(phi), cp = Math.cos(phi), sl = Math.sin(lam), cl = Math.cos(lam);
  const n = A / Math.sqrt(1 - E2 * sp * sp);
  const o = new THREE.Vector3((n + GEOID) * cp * cl, (n + GEOID) * cp * sl, (n * (1 - E2) + GEOID) * sp);
  // Earth-centred to east, north, up
  const enu = new THREE.Matrix4().set(
    -sl, cl, 0, 0,
    -sp * cl, -sp * sl, cp, 0,
    cp * cl, cp * sl, sp, 0,
    0, 0, 0, 1,
  ).multiply(new THREE.Matrix4().makeTranslation(-o.x, -o.y, -o.z));
  // grid north is turned from true north by the convergence g: true north is (sin g, cos g) on the grid
  const a = project(lat, lon), b = project(lat + 1e-3, lon);
  const g = Math.atan2(b.e - a.e, b.n - a.n);
  const c = Math.cos(g), s = Math.sin(g);
  // east, north, up to world x (east), y (up), z (south)
  const world = new THREE.Matrix4().set(
    c, s, 0, 0,
    0, 0, 1, 0,
    s, -c, 0, 0,
    0, 0, 0, 1,
  );
  return world.multiply(enu);
}

export class GoogleCity {
  group = new THREE.Group();
  private tiles: TilesRenderer;

  constructor(token: string, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.group.name = 'google-city';
    this.group.matrixAutoUpdate = false;
    this.group.matrix.copy(earthToWorld());
    const tiles = new TilesRenderer();
    tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: token, assetId: String(ASSET), autoRefreshToken: true }));
    tiles.registerPlugin(new TileCompressionPlugin());
    tiles.registerPlugin(new UnloadTilesPlugin());
    tiles.errorTarget = ERROR_TARGET;
    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, renderer);
    // the tiles are photos: shown as they are, past the tone mapping, but in the fog like the rest
    tiles.addEventListener('load-model', (e: { scene: THREE.Object3D }) => e.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.toneMapped = false;
    }));
    tiles.addEventListener('load-error', (e: { error?: unknown }) => console.warn('google tiles:', e.error));
    this.group.add(tiles.group);
    this.tiles = tiles;
  }

  // The credits the tiles' licence asks to be shown with them: Google and Cesium ion, and the
  // sources of the tiles in view.
  get credits(): string {
    const sources = this.tiles.getAttributions().filter((x) => x.type === 'string').map((x) => x.value as string);
    return ['Google', 'Cesium ion', ...new Set(sources.flatMap((v) => v.split(';').map((p) => p.trim())).filter((p) => p && p !== 'Google'))].join(' · ');
  }

  get visible() { return this.group.visible; }
  set visible(v: boolean) { this.group.visible = v; }

  update(camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    if (!this.group.visible) return;
    this.group.updateMatrixWorld();
    this.tiles.setResolutionFromRenderer(camera, renderer);
    this.tiles.update();
  }

  dispose() {
    this.group.removeFromParent();
    this.tiles.dispose();
  }
}
