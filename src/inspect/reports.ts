// Problems found while inspecting, kept in the browser (IndexedDB, so the screenshots fit) until
// they are exported: as Markdown for an issue, as JSON (with the screenshots, to import again
// elsewhere), or saved into the checkout by the dev server (inspect-reports/).

export const KINDS = ['geometry', 'height', 'track', 'station', 'city', 'trains', 'data', 'other'] as const;
export type Kind = (typeof KINDS)[number];

export interface Report {
  id: string;
  created: string; // ISO time
  text: string;
  kind: Kind;
  done: boolean;
  // the point reported: what was double-clicked, or what the camera looked at
  at: { x: number; y: number; z: number };
  lat: number;
  lon: number;
  // what's there
  what: string | null; // the object path picked, e.g. "stations › Slussen"
  station: { name: string; d: number } | null;
  track: { piece: number; kind: string; rail: number } | null;
  // the view, to come back to: the inspector's address query, and the game's ?cam=
  inspect: string;
  game: string;
  commit: string | null;
  image: Blob | null; // the 3D view, JPEG
}

// ------------------------------------------------------------------ the store
const DB = 'tbana-inspect', STORE = 'reports';

export class ReportStore {
  list: Report[] = [];
  onChange: () => void = () => {};
  private db: IDBDatabase | null = null;

  async open() {
    try {
      this.db = await new Promise<IDBDatabase>((ok, fail) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => ok(req.result);
        req.onerror = () => fail(req.error);
      });
      const all = await this.request<Report[]>((s) => s.getAll());
      this.list = all.sort((a, b) => a.created.localeCompare(b.created));
    } catch (err) {
      // kept for this visit only
      console.warn('reports are not kept: no IndexedDB', err);
    }
    this.onChange();
    return this;
  }

  private request<T>(fn: (s: IDBObjectStore) => IDBRequest, mode: IDBTransactionMode = 'readonly') {
    return new Promise<T>((ok, fail) => {
      if (!this.db) return ok(undefined as T);
      const req = fn(this.db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => ok(req.result as T);
      req.onerror = () => fail(req.error);
    });
  }

  async put(r: Report) {
    const i = this.list.findIndex((q) => q.id === r.id);
    if (i >= 0) this.list[i] = r; else this.list.push(r);
    await this.request((s) => s.put(r), 'readwrite');
    this.onChange();
  }

  async remove(id: string) {
    this.list = this.list.filter((r) => r.id !== id);
    await this.request((s) => s.delete(id), 'readwrite');
    this.onChange();
  }

  async clear() {
    this.list = [];
    await this.request((s) => s.clear(), 'readwrite');
    this.onChange();
  }

  // Adds the reports in an exported JSON file, keeping any already here.
  async import(text: string) {
    const data = JSON.parse(text) as { reports: (Omit<Report, 'image'> & { image: string | null })[] };
    let n = 0;
    for (const r of data.reports) {
      if (this.list.some((q) => q.id === r.id)) continue;
      const image = r.image ? await (await fetch(r.image)).blob() : null;
      await this.put({ ...r, image });
      n++;
    }
    return n;
  }
}

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ------------------------------------------------------------------ exports
const blobUrl = (b: Blob) => new Promise<string>((ok) => {
  const fr = new FileReader();
  fr.onload = () => ok(fr.result as string);
  fr.readAsDataURL(b);
});

// Everything, the screenshots as data URLs.
export async function toJson(list: Report[]) {
  const reports = await Promise.all(list.map(async (r) => ({ ...r, image: r.image ? await blobUrl(r.image) : null })));
  return JSON.stringify({ exported: new Date().toISOString(), reports }, null, 1);
}

const title = (r: Report) => r.text.split('\n')[0].slice(0, 90) || '(no text)';

// One report in Markdown. `image` is where its screenshot is, if anywhere; `origin` makes the
// links whole (the inspector's dev server).
export function reportMarkdown(r: Report, n: number, origin: string, image: string | null = null) {
  const where = [
    `x ${r.at.x.toFixed(1)}, y ${r.at.y.toFixed(1)}, z ${r.at.z.toFixed(1)}`,
    `${r.lat.toFixed(6)}, ${r.lon.toFixed(6)}`,
    r.station ? `${r.station.d.toFixed(0)} m from ${r.station.name}` : null,
    r.track ? `track piece ${r.track.piece} (${r.track.kind}, rail ${r.track.rail.toFixed(2)} m)` : null,
  ].filter(Boolean).join(' · ');
  const lines = [
    `### ${n}. [${r.kind}] ${r.station ? `${r.station.name}: ` : ''}${title(r)}${r.done ? ' (done)' : ''}`,
    '',
    ...(r.text.includes('\n') ? [r.text, ''] : []),
    `- **Where:** ${where}`,
    ...(r.what ? [`- **On:** \`${r.what}\``] : []),
    `- **View:** [inspector](${origin}/inspect.html?${r.inspect}) · [game](${origin}/?${r.game}) · \`npm run inspect\`, then \`/inspect.html?${r.inspect}\``,
    `- **Seen:** ${r.created.slice(0, 16).replace('T', ' ')}${r.commit ? ` on ${r.commit}` : ''}`,
  ];
  if (image) lines.push('', `![${title(r).replace(/[[\]]/g, '')}](${image})`);
  return lines.join('\n');
}

export function toMarkdown(list: Report[], origin: string, images: (r: Report) => string | null = () => null) {
  const open = list.filter((r) => !r.done).length;
  return [
    `## Inspector reports`,
    '',
    `${list.length} report${list.length === 1 ? '' : 's'}, ${open} open. World x, y, z are metres on SWEREF 99 18 00 round T-Centralen (src/geo.ts), heights RH 2000.`,
    '',
    ...list.map((r, i) => reportMarkdown(r, i + 1, origin, images(r)) + '\n'),
  ].join('\n');
}

export function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
