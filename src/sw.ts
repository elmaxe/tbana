// The service worker: keeps every file of the build in the browser, so the game starts without
// downloading them again and plays without a connection.
//
// The build (tools/lib/service-worker.ts) puts the list of its files, each with a hash of its
// content, in front of this script as BUILD and publishes it as sw.js. A build with any file
// changed has a different sw.js, which is how the browser learns of a new version: it installs it
// beside the one running, downloading only the files that changed, and the page offers to switch
// (src/offline.ts). Until then the old version goes on serving its own files.
//
// Requests for anything not in the list (builds.json and build.json, which the Pages workflow
// writes after the build, the pull requests' builds under pr/<n>/, and other sites, such as
// Google's 3D tiles through Cesium ion) go to the network as if there were no worker.

import type { FromWorker, ToWorker } from './offline-protocol';

declare const BUILD: { files: Record<string, string> };

const sw = self as unknown as ServiceWorkerGlobalScope;
const scope = sw.registration.scope;
const base = new URL(scope).pathname;
// The site's builds share the origin's caches, so each keeps its files in one of its own. Each
// file is kept under its URL with the hash of its content, so two versions of it can be there at
// once while a new version installs.
const CACHE = `tbana ${scope}`;
const files = new Map(Object.entries(BUILD.files));
const key = (path: string, hash: string) => `${scope}${path}?rev=${hash}`;
// downloads at once while installing
const PARALLEL = 6;

sw.addEventListener('install', (e) => e.waitUntil(save()));

// Downloads the files the cache doesn't have yet. Those saved stay saved if the install fails
// (the connection drops, or the browser stops it), so the next try goes on from there.
async function save() {
  const cache = await caches.open(CACHE);
  const have = new Set((await cache.keys()).map((r) => r.url));
  const todo = [...files].filter(([path, hash]) => !have.has(key(path, hash)));
  const total = todo.length;
  let done = 0, told = 0;
  const tell = async (force = false) => {
    if (!force && performance.now() - told < 250) return;
    told = performance.now();
    const msg: FromWorker = { type: 'progress', scope, done, total };
    for (const c of await sw.clients.matchAll({ type: 'window', includeUncontrolled: true })) c.postMessage(msg);
  };
  await tell(true);
  const queue = todo.values();
  let failed = false;
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    for (const [path, hash] of queue) {
      if (failed) return;
      try {
        await cache.put(key(path, hash), await download(path, hash));
      } catch (err) {
        failed = true;
        throw err;
      }
      done++;
      void tell();
    }
  }));
  await tell(true);
}

// A file as this build has it. It is revalidated, so that the browser's HTTP cache doesn't hand
// back an older one; if what comes is still not this build's (a cache on the way kept the old file
// for a while after a deploy), it is asked for once more under a URL no cache has seen.
async function download(path: string, hash: string) {
  for (const [url, cache] of [[scope + path, 'no-cache'], [key(path, hash), 'no-store']] as const) {
    const res = await fetch(url, { cache });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    const body = await res.arrayBuffer();
    if ((await digest(body)) !== hash) continue;
    // the body as read, so without its transfer encoding
    const type = res.headers.get('Content-Type');
    return new Response(body, { headers: type ? { 'Content-Type': type } : {} });
  }
  throw new Error(`${path}: the server has a different version of it`);
}

// The first 16 hex digits of the SHA-256 of `body`, as the build hashes the files.
async function digest(body: ArrayBuffer) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', body));
  return Array.from(bytes.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

// The old version's files go, and the pages open now are served by this one.
sw.addEventListener('activate', (e) => e.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  const keep = new Set([...files].map(([path, hash]) => key(path, hash)));
  for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
  await sw.clients.claim();
})()));

sw.addEventListener('message', (e) => {
  if ((e.data as ToWorker | null)?.type === 'skip-waiting') void sw.skipWaiting();
});

// The build's files come from the cache, whatever the query (the game's pages read theirs, such as
// ?at=Slussen); a folder is its index.html.
sw.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(base)) return;
  let path = url.pathname.slice(base.length);
  if (path === '' || path.endsWith('/')) path += 'index.html';
  const hash = files.get(path);
  if (!hash) return;
  e.respondWith(caches.open(CACHE)
    .then((cache) => cache.match(key(path, hash), { ignoreVary: true }))
    // not saved yet (the install is still going, or was cut short)
    .then((res) => res ?? fetch(req)));
});
