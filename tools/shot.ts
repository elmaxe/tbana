// Screenshots of the game from given viewpoints, to see a change as a player would (and, with
// --before, as it was without the detailed buildings of src/detail/).
//
//   npm run shot -- <file.png> <x,y,z,yaw,pitch> [<file.png> <x,y,z,yaw,pitch> …]
//   npm run shot -- … --before          also <file>-before.png, with ?nodetail
//   npm run shot -- … --size 1280x800   (the default)
//   npm run shot -- … --wait 25         seconds for the city round the camera to load (the default)
//   npm run shot -- … --url http://localhost:5173/   use a dev server already running
//
// The viewpoint is the game's ?cam: world x, y, z (y up, RH 2000), yaw and pitch in radians; the
// camera looks along (−sin yaw, 0, −cos yaw), tilted up by pitch. It flies (?fly), so it can be
// anywhere. Without --url it starts Vite's dev server itself, on a free port.
//
// It needs a Chromium: the one at CHROMIUM, else Playwright's own where one is installed
// (PLAYWRIGHT_BROWSERS_PATH, as in a cloud session), else Google Chrome. Without a GPU it renders on SwiftShader, slowly: the shot is taken by drawing
// one frame by hand rather than by Playwright's screenshot, which times out on it.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name: string) => args.includes(name);
const valued = new Set(['--size', '--wait', '--url']);
const plain = args.filter((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
const shots: { file: string; cam: string }[] = [];
for (let i = 0; i + 1 < plain.length; i += 2) shots.push({ file: plain[i], cam: plain[i + 1] });
if (!shots.length || plain.length % 2 || shots.some((s) => s.cam.split(',').length !== 5)) {
  console.error('usage: npm run shot -- <file.png> <x,y,z,yaw,pitch> [more pairs] [--before] [--size WxH] [--wait s] [--url u]');
  process.exit(1);
}
const [width, height] = (option('--size') ?? '1280x800').split('x').map(Number);
const wait = Number(option('--wait') ?? 25) * 1000;

// ------------------------------------------------------------------ the browser
const pwPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
const executablePath = process.env.CHROMIUM ?? (pwPath && existsSync(join(pwPath, 'chromium')) ? join(pwPath, 'chromium') : undefined);
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : { channel: 'chrome' }),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

// ------------------------------------------------------------------ the game
let url = option('--url');
const server = url ? null : await createServer({ server: { port: 5190, strictPort: false, open: false }, logLevel: 'warn' });
if (server) {
  await server.listen();
  url = server.resolvedUrls!.local[0];
}
const base = url!.replace(/\/$/, '');

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
  await page.close();
}

try {
  await Promise.all(shots.flatMap(({ file, cam }) => [
    shoot(file, cam, ''),
    ...(flag('--before') ? [shoot(file.replace(/(\.png)?$/, '-before.png'), cam, '&nodetail')] : []),
  ]));
} finally {
  await browser.close();
  await server?.close();
}
