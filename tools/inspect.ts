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
//   guillaumes                   the Stockholm stations on Albert Guillaumes' site: each one's
//                                drawing, and its 3D model where he has published one
//   drawing/<file>               his drawing of a station
//   model/<name>.gltf            his 3D model of a station
//
// What comes from his site is fetched once and kept in node_modules/.cache/inspect/, never in the
// repo: the drawings and models are his, and are used as a reference only. Delete the folder to
// fetch them again.
//   frame?station=…              tools/build-stations.ts --frame: the station's frame, as text
//   plot?at=x,z&r=…              tools/plot-graph.ts: the track graph round a point, as SVG
//   profile?route=…&from=…&to=…  tools/plot-profile.ts: a route's side view (km), as SVG
//   build?tool=build-stations    runs a build tool, and answers with its output
//   version                      the commit checked out, with '+' if the checkout has changed
//   reports                      saves the reports posted (src/inspect/reports.ts) into
//                                inspect-reports/: README.md, reports.json and the screenshots
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'vite';
import type { Plugin } from 'vite';

const ROOT = process.cwd();
const SITE = 'http://estacions.albertguillaumes.cat/';
// his names for stations OpenStreetMap names otherwise
const SITE_NAMES: Record<string, string> = { 'S:t Eriksplan': 'Sankt Eriksplan', 'Sundbyberg centrum': 'Sundbybergs centrum' };
const CACHE = resolve(ROOT, 'node_modules/.cache/inspect');
const REPORTS = 'inspect-reports';
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

// A file from Albert Guillaumes' site, fetched the first time it's asked for. His site turns
// away many requests close together (HTTP 429), so nothing is fetched before it's wanted.
async function fromSite(path: string, file: string) {
  const cached = join(CACHE, file);
  if (!existsSync(cached)) {
    const res = await fetch(SITE + path);
    if (res.status === 429) throw Object.assign(new Error(`${SITE}${path}: the site asks to slow down (HTTP 429); try again in a minute`), { status: 503 });
    if (!res.ok) throw Object.assign(new Error(`${SITE}${path}: HTTP ${res.status}`), { status: 502 });
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(cached);
}

// His Stockholm stations, from the index his site's map reads (js/dades.js, one station a line).
async function guillaumes() {
  const index = (await fromSite('js/dades.js', 'dades.js')).toString('utf8');
  const stations = [];
  for (const line of index.split('\n')) {
    if (!line.includes('"carpeta": "estocolm"')) continue;
    const p = JSON.parse(line.trim().replace(/,$/, '')).properties as { 'estació': string; url1: string; '3d'?: string };
    const name = p['estació'];
    stations.push({ name: SITE_NAMES[name] ?? name, drawing: p.url1.replace(/^estocolm\//, ''), model: p['3d'] ?? null });
  }
  return stations;
}

function git(gitArgs: string[]) {
  return new Promise<string>((ok, fail) => execFile('git', gitArgs, { cwd: ROOT }, (err, out) => (err ? fail(err) : ok(out.trim()))));
}

function body(req: IncomingMessage) {
  return new Promise<string>((ok, fail) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

// Writes the reports into inspect-reports/, replacing what was there: the screenshots as
// <id>.jpg, the reports without them in reports.json, and README.md to read them by.
function saveReports(posted: { markdown: string; reports: { id: string; image: string | null }[] }) {
  const dir = join(ROOT, REPORTS);
  mkdirSync(dir, { recursive: true });
  const keep = new Set<string>();
  const reports = posted.reports.map((r) => {
    if (!/^[a-z0-9-]+$/.test(r.id)) throw new Error(`not a report id: ${r.id}`);
    const m = r.image ? /^data:image\/jpeg;base64,(.*)$/.exec(r.image) : null;
    if (!m) return { ...r, image: null };
    const file = `${r.id}.jpg`;
    writeFileSync(join(dir, file), Buffer.from(m[1], 'base64'));
    keep.add(file);
    return { ...r, image: file };
  });
  for (const f of readdirSync(dir)) if (f.endsWith('.jpg') && !keep.has(f)) rmSync(join(dir, f));
  writeFileSync(join(dir, 'reports.json'), JSON.stringify({ saved: new Date().toISOString(), reports }, null, 1) + '\n');
  writeFileSync(join(dir, 'README.md'), posted.markdown);
  return `Wrote ${REPORTS}/: README.md, reports.json and ${keep.size} screenshot${keep.size === 1 ? '' : 's'}.`;
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
    case 'guillaumes':
      return send(res, 200, 'application/json', JSON.stringify(await guillaumes()));
    case 'drawing': {
      const name = rest.join('/');
      if (!/^[a-z0-9_-]+\.png$/.test(name)) return send(res, 400, 'text/plain', `not a drawing: ${name}`);
      return send(res, 200, 'image/png', await fromSite(`img/estocolm/${name}`, name));
    }
    case 'model': {
      const name = rest.join('/');
      if (!/^[a-z0-9_-]+\.gltf$/.test(name)) return send(res, 400, 'text/plain', `not a model: ${name}`);
      return send(res, 200, 'model/gltf+json', await fromSite(`3d/${name}`, name));
    }
    case 'frame':
      return send(res, 200, 'text/plain; charset=utf-8', await run('build-stations', ['--frame', q('station')]));
    case 'plot': {
      const [x, z] = q('at').split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('at: x,z');
      return send(res, 200, 'image/svg+xml', await plot('plot-graph', (out) => [`${x},${z}`, num('r'), out]));
    }
    case 'profile':
      return send(res, 200, 'image/svg+xml', await plot('plot-profile', (out) => [q('route'), out, num('from'), num('to')]));
    case 'version': {
      const head = await git(['rev-parse', '--short', 'HEAD']);
      // what the world is built from: the source and the data, not the reports
      const dirty = await git(['status', '--porcelain', '--', '.', `:(exclude)${REPORTS}`]);
      return send(res, 200, 'text/plain', `${head}${dirty ? '+' : ''}`);
    }
    case 'reports':
      if (req.method !== 'POST') return send(res, 405, 'text/plain', 'POST them');
      return send(res, 200, 'text/plain; charset=utf-8', saveReports(JSON.parse(await body(req))));
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
        handle(req, res).catch((err: Error & { status?: number }) => send(res, err.status ?? 500, 'text/plain; charset=utf-8', err.message));
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
