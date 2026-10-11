// What the service worker (src/sw.ts) and the pages (src/offline.ts) say to each other. Types
// only: the worker is built on its own, without the game's modules.

// worker → pages: how many of a version's files are saved so far, of those it had to download
export interface SaveProgress { type: 'progress'; scope: string; done: number; total: number }
export type FromWorker = SaveProgress;

// page → the waiting worker: take over now (the page reloads when it has)
export interface SkipWaiting { type: 'skip-waiting' }
export type ToWorker = SkipWaiting;
