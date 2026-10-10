// Screenshots of the game from given viewpoints, to see a change as a player would (and, with
// --before, as it was without the detailed buildings of src/detail/).
//
//   npm run shot -- <file.png> <x,y,z,yaw,pitch> [<file.png> <x,y,z,yaw,pitch> …]
//   npm run shot -- … --before          also <file>-before.png, with ?nodetail
//   npm run shot -- … --size 1280x800   (the default)
//   npm run shot -- … --wait 25         seconds for the city round the camera to load (the default)
//   npm run shot -- … --url http://localhost:5173/   use a dev server already running
//   npm run shot -- … --google .google/area.glb   also <file>-google.png: Google's mesh of the place
//                                                 (tools/google-mesh.ts) from the same camera
//
// The viewpoint is the game's ?cam: world x, y, z (y up, RH 2000), yaw and pitch in radians; the
// camera looks along (−sin yaw, 0, −cos yaw), tilted up by pitch. It flies (?fly), so it can be
// anywhere. Without --url it starts Vite's dev server itself, on a free port.
//
// The Google pictures are for comparing only: like the mesh, they stay on this machine (.google/
// or the scratchpad) and never go in the repo or a pull request.
//
// It needs a Chromium: the one at CHROMIUM, else Playwright's own where one is installed
// (PLAYWRIGHT_BROWSERS_PATH, as in a cloud session), else Google Chrome. Without a GPU it renders on SwiftShader, slowly: the shot is taken by drawing
// one frame by hand rather than by Playwright's screenshot, which times out on it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name: string) => args.includes(name);
const valued = new Set(['--size', '--wait', '--url', '--google']);
const plain = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
const shots: { file: string; cam: string }[] = [];
for (let i = 0; i + 1 < plain.length; i += 2) shots.push({ file: plain[i], cam: plain[i + 1] });
if (!shots.length || plain.length % 2 || shots.some((s) => s.cam.split(',').length !== 5)) {
  console.error('usage: npm run shot -- <file.png> <x,y,z,yaw,pitch> [more pairs] [--before] [--google glb] [--size WxH] [--wait s] [--url u]');
  process.exit(1);
}
const [width, height] = (option('--size') ?? '1280x800').split('x').map(Number);
const wait = Number(option('--wait') ?? 25) * 1000;
const google = option('--google') && resolve(option('--google')!);

// ------------------------------------------------------------------ the browser
const pwPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
const executablePath = process.env.CHROMIUM ?? (pwPath && existsSync(join(pwPath, 'chromium')) ? join(pwPath, 'chromium') : undefined);
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : { channel: 'chrome' }),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

// ------------------------------------------------------------------ the game
let url = option('--url');
const server = url ? null : await createServer({
  server: { port: 5190, strictPort: false, open: false },
  // known up front, so that finding it later doesn't make Vite reload the pages
  optimizeDeps: { include: ['three/examples/jsm/loaders/GLTFLoader.js'] },
  logLevel: 'warn',
});
if (server) {
  await server.listen();
  url = server.resolvedUrls!.local[0];
}
const base = url!.replace(/\/$/, '');

const views: { file: string; fov: number; pos: number[]; quat: number[] }[] = [];
async function shoot(file: string, cam: string, extra: string) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => console.warn(`  ${file}: ${e.message}`));
  await page.goto(`${base}/?cam=${cam}&fly${extra}`);
  await page.waitForFunction(() => (window as unknown as { __game?: unknown }).__game, null, { timeout: 240_000 });
  await page.waitForTimeout(wait);
  const data = await page.evaluate(() => {
    const g = (window as unknown as { __game: { renderer: { setAnimationLoop(f: null): void; render(s: unknown, c: unknown): void; domElement: HTMLCanvasElement }; scene: unknown; camera: unknown } }).__game;
    for (const id of ['start', 'loading']) { const e = document.getElementById(id); if (e) e.hidden = true; }
    document.querySelectorAll<HTMLElement>('#hud, .hud, #minimap').forEach((e) => { e.style.display = 'none'; });
    g.renderer.setAnimationLoop(null);
    g.renderer.render(g.scene, g.camera);
    return g.renderer.domElement.toDataURL('image/png');
  });
  writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`  ${file}`);
  if (google && !extra) {
    // the camera, for the same view over Google's mesh
    views.push({ file, ...await page.evaluate(() => {
      const c = (window as unknown as { __game: { camera: { fov: number; getWorldPosition(v: unknown): { toArray(): number[] }; getWorldQuaternion(q: unknown): { toArray(): number[] } } ; THREE: { Vector3: new () => unknown; Quaternion: new () => unknown } } }).__game;
      return { fov: c.camera.fov, pos: c.camera.getWorldPosition(new c.THREE.Vector3()).toArray(), quat: c.camera.getWorldQuaternion(new c.THREE.Quaternion()).toArray() };
    }) });
  }
  await page.close();
}

try {
  // three pages at a time: more starve each other on a software renderer
  const jobs = shots.flatMap(({ file, cam }) => [
    () => shoot(file, cam, ''),
    ...(flag('--before') ? [() => shoot(file.replace(/(\.png)?$/, '-before.png'), cam, '&nodetail')] : []),
  ]);
  await Promise.all(Array.from({ length: 3 }, async () => { for (let j = jobs.shift(); j; j = jobs.shift()) await j(); }));
  if (google && views.length) {
    // Google's mesh, loaded once (it is big, and slow to draw without a GPU), from each camera in turn
    const g = await browser.newPage({ viewport: { width, height } });
    g.on('pageerror', (e) => console.warn(`  google: ${e.message}`));
    await g.route('**/google.glb', (r) => r.fulfill({ body: readFileSync(google), contentType: 'model/gltf-binary' }));
    const v0 = views[0];
    await g.goto(`${base}/tools/google-view.html?glb=/google.glb&fov=${v0.fov}&pos=${v0.pos.join(',')}&quat=${v0.quat.join(',')}`, { waitUntil: 'commit' });
    await g.waitForFunction(() => (window as unknown as { __google?: unknown }).__google, null, { timeout: 600_000 });
    for (const v of views) {
      const shot = await g.evaluate((v) => {
        const { renderer, scene, camera } = (window as unknown as { __google: { renderer: { render(s: unknown, c: unknown): void; domElement: HTMLCanvasElement }; scene: unknown;
          camera: { fov: number; position: { fromArray(a: number[]): void }; quaternion: { fromArray(a: number[]): void }; updateProjectionMatrix(): void } } }).__google;
        camera.fov = v.fov;
        camera.position.fromArray(v.pos);
        camera.quaternion.fromArray(v.quat);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/png');
      }, v);
      const out = v.file.replace(/(\.png)?$/, '-google.png');
      writeFileSync(out, Buffer.from(shot.split(',')[1], 'base64'));
      console.log(`  ${out}`);
    }
  }
} finally {
  await browser.close();
  await server?.close();
}
