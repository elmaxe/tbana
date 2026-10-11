// Offline play: the service worker (src/sw.ts) keeps the build's files in the browser, so the game
// starts from them and plays without a connection. A new version is downloaded in the background
// while the saved one runs, and the line this puts on the start/pause screen offers to switch to it.
//
// Only built sites have the worker (the dev server serves the files as they're edited), and not
// the pull requests' previews under pr/<n>/ (.github/scripts/assemble-site.sh): they're for seeing
// the latest push, so they always load fresh.

import type { FromWorker, SaveProgress, ToWorker } from './offline-protocol';

// how often a page left open looks for a new version
const CHECK_EVERY = 60 * 60 * 1000;

// Registers the worker and shows how it stands in `container`; `onReady` is called when a new
// version is ready to switch to.
export async function mountOffline(container: HTMLElement | null, onReady?: () => void) {
  if (!container || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const scope = new URL('./', location.href).href;
  if (/\/pr\/\d+\/$/.test(new URL(scope).pathname)) return;
  const workers = navigator.serviceWorker;

  let progress: SaveProgress | null = null;
  workers.addEventListener('message', (e: MessageEvent<FromWorker>) => {
    if (e.data?.type !== 'progress' || e.data.scope !== scope) return;
    progress = e.data;
    render();
  });
  workers.startMessages();

  let reg: ServiceWorkerRegistration;
  try {
    reg = await workers.register('sw.js');
  } catch (err) {
    // a private window, or the browser has them switched off
    console.warn('no offline play:', err);
    return;
  }

  const text = document.createElement('span');
  const button = document.createElement('button');
  button.textContent = 'Update';
  let updating = false;
  button.addEventListener('click', () => {
    const next = reg.waiting;
    if (!next) return;
    updating = true;
    button.hidden = true;
    text.textContent = 'Updating…';
    // reload once it has taken over, to start on its files
    next.addEventListener('statechange', () => { if (next.state === 'activated') location.reload(); });
    next.postMessage({ type: 'skip-waiting' } satisfies ToWorker);
  });
  container.append(text, button);

  let told = false;
  function render() {
    if (updating) return;
    const update = !!reg.active;
    const pct = progress?.total ? Math.floor((100 * progress.done) / progress.total) : 0;
    button.hidden = true;
    if (reg.waiting && update) {
      text.textContent = 'A new version is ready.';
      button.hidden = false;
      if (!told) { told = true; onReady?.(); }
    } else if (reg.installing) {
      text.textContent = update ? `Downloading a new version… ${pct}%` : `Saving the game for offline play… ${pct}%`;
    } else if (reg.active) {
      text.textContent = navigator.onLine ? 'Saved for offline play' : 'Offline: playing the saved copy';
    }
    container!.hidden = !reg.active && !reg.installing;
  }

  const watch = (w: ServiceWorker | null) => w?.addEventListener('statechange', () => {
    if (w.state === 'installed' || w.state === 'redundant') progress = null;
    render();
  });
  watch(reg.installing);
  watch(reg.waiting);
  reg.addEventListener('updatefound', () => { progress = null; watch(reg.installing); render(); });
  addEventListener('online', render);
  addEventListener('offline', render);
  render();

  // The browser looks for a new version whenever a page is opened; a page left open looks again now
  // and then, and when it's back online.
  const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
  setInterval(check, CHECK_EVERY);
  addEventListener('online', check);
}
