// Opens the inspector in the browser: the whole network on a map, the game's world to fly through
// where you click on it, and what each place was built from beside it (inspect.html).
//
//   npm run inspect                 start the dev server with the inspector and open it
//   npm run inspect -- Slussen      ... at a station
//   npm run inspect -- --no-open    don't open a browser
//   npm run inspect -- --port 5180
//
// It runs Vite's dev server with the project's config, so the game is there too at /, and adds
// the inspector's own endpoints under /__inspect/, which only the dev server has:
//
//   data/<file>                  a file from data/ (the tools' inputs: descriptions, corrections, …)
//   drawing/<file>               Albert Guillaumes' drawing of a station, fetched from his site
//                                once and kept in node_modules/.cache/inspect/ (never in the repo:
//                                the drawings are his, and are used as a reference only)
//   frame?station=…              tools/build-stations.ts --frame: the station's frame, as text
//   plot?at=x,z&r=…              tools/plot-graph.ts: the track graph round a point, as SVG
//   profile?route=…&from=…&to=…  tools/plot-profile.ts: a route's side view (km), as SVG
//   build?tool=build-stations    runs a build tool, and answers with its output
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'vite';
import type { Plugin } from 'vite';

const ROOT = process.cwd();
const DRAWINGS = 'http://estacions.albertguillaumes.cat/img/estocolm/';
const CACHE = resolve(ROOT, 'node_modules/.cache/inspect');
// the build tools the inspector can run, after a description or correction is edited
const BUILDS = ['build-stations', 'build-track-geometry', 'build-heights', 'build-track-graph'];

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const at = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port');

// Runs a tool with node, and resolves with what it printed (rejects with that, when it fails).
function run(tool: string, toolArgs: string[]) {
  return new Promise<string>((ok, fail) => {
    execFile(process.execPath, [join('tools', `${tool}.ts`), ...toolArgs], { cwd: ROOT, maxBuffer: 64 << 20, timeout: 600_000 },
      (err, stdout, stderr) => (err ? fail(new Error(`${stdout}${stderr}` || err.message)) : ok(`${stdout}${stderr}`)));
  });
}

// Runs a plotting tool into a temporary file, and resolves with the file.
async function plot(tool: string, toolArgs: (out: string) => string[]) {
  const out = join(tmpdir(), `tbana-inspect-${process.pid}-${Math.random().toString(36).slice(2)}.svg`);
  try {
    await run(tool, toolArgs(out));
    return readFileSync(out, 'utf8');
  } finally {
    rmSync(out, { force: true });
  }
}

async function drawing(name: string) {
  if (!/^[a-z0-9_-]+\.png$/.test(name)) throw new Error(`not a drawing: ${name}`);
  const file = join(CACHE, name);
  if (!existsSync(file)) {
    const res = await fetch(DRAWINGS + name);
    if (!res.ok) throw new Error(`${DRAWINGS}${name}: HTTP ${res.status}`);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(file);
}

function send(res: ServerResponse, status: number, type: string, body: string | Buffer) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const [, what, ...rest] = url.pathname.split('/');
  const q = (k: string) => url.searchParams.get(k) ?? '';
  const num = (k: string) => { const v = Number(q(k)); if (!Number.isFinite(v)) throw new Error(`${k}: not a number`); return String(v); };
  switch (what) {
    case 'data': {
      // only what's in data/
      const file = normalize(join(ROOT, 'data', ...rest.map(decodeURIComponent)));
      if (!file.startsWith(join(ROOT, 'data') + '/') || !existsSync(file)) return send(res, 404, 'text/plain', 'not found');
      return send(res, 200, file.endsWith('.json') ? 'application/json' : 'application/octet-stream', readFileSync(file));
    }
    case 'drawing':
      return send(res, 200, 'image/png', await drawing(rest.join('/')));
    case 'frame':
      return send(res, 200, 'text/plain; charset=utf-8', await run('build-stations', ['--frame', q('station')]));
    case 'plot': {
      const [x, z] = q('at').split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('at: x,z');
      return send(res, 200, 'image/svg+xml', await plot('plot-graph', (out) => [`${x},${z}`, num('r'), out]));
    }
    case 'profile':
      return send(res, 200, 'image/svg+xml', await plot('plot-profile', (out) => [q('route'), out, num('from'), num('to')]));
    case 'build': {
      if (req.method !== 'POST') return send(res, 405, 'text/plain', 'POST it');
      const tool = q('tool');
      if (!BUILDS.includes(tool)) return send(res, 400, 'text/plain', `not one of ${BUILDS.join(', ')}`);
      try {
        return send(res, 200, 'text/plain; charset=utf-8', await run(tool, []));
      } catch (err) {
        // a check that failed: its output says where
        return send(res, 422, 'text/plain; charset=utf-8', (err as Error).message);
      }
    }
  }
  send(res, 404, 'text/plain', 'not found');
}

function inspectApi(): Plugin {
  return {
    name: 'tbana-inspect',
    configureServer(server) {
      server.middlewares.use('/__inspect', (req, res) => {
        handle(req, res).catch((err: Error) => send(res, 500, 'text/plain; charset=utf-8', err.message));
      });
    },
  };
}

const page = `/inspect.html${at ? `?at=${encodeURIComponent(at)}` : ''}`;
const server = await createServer({
  plugins: [inspectApi()],
  server: { port: Number(option('--port')) || 5180, open: flag('--no-open') ? false : page },
});
await server.listen();
server.printUrls();
console.log(`\n  inspector: ${server.resolvedUrls?.local[0]?.replace(/\/$/, '')}${page}\n`);
