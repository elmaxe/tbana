// Reporting problems: the dialog that writes a report (R, or ⚑ Report), and the Reports tab that
// lists them, takes the camera back to each, and exports them.
import { KINDS, download, newId, toJson, toMarkdown } from './reports';
import type { Kind, Report, ReportStore } from './reports';

// What a report knows of where it was made, filled in when the dialog opens.
export type Draft = Omit<Report, 'id' | 'created' | 'text' | 'kind' | 'done'>;

export interface ReportActions {
  capture(): Promise<Draft>;
  go(r: Report): void;
  // whether the dev server can save the reports into the checkout
  canSave: boolean;
}

const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class ReportPanel {
  private editing: Report | null = null;
  private draft: Draft | null = null;
  private urls: string[] = [];
  private shotUrl = '';
  private filter: 'all' | 'open' = 'all';

  constructor(private store: ReportStore, private el: HTMLElement, private actions: ReportActions) {
    $<HTMLSelectElement>('reportKind').innerHTML = KINDS.map((k) => `<option>${k}</option>`).join('');
    const form = $<HTMLFormElement>('reportDialog');
    form.addEventListener('submit', (e) => { e.preventDefault(); void this.save(); });
    $('reportCancel').addEventListener('click', () => this.close());
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void this.save(); }
      e.stopPropagation();
    });
    el.addEventListener('click', (e) => this.click(e));
    el.addEventListener('change', (e) => this.change(e));
    store.onChange = () => this.render();
  }

  get open() { return !$('reportDialog').hidden; }

  // A new report of what's in view, or an edit of one.
  async start(existing: Report | null = null) {
    if (this.open) return;
    this.editing = existing;
    this.draft = existing ?? await this.actions.capture();
    const d = this.draft;
    $('reportWhere').textContent = [
      d.station ? `${d.station.name} (${d.station.d.toFixed(0)} m)` : null,
      d.track ? `piece ${d.track.piece}, ${d.track.kind}` : null,
      d.what,
      `${d.at.x.toFixed(0)}, ${d.at.y.toFixed(1)}, ${d.at.z.toFixed(0)}`,
    ].filter(Boolean).join(' · ');
    URL.revokeObjectURL(this.shotUrl);
    this.shotUrl = d.image ? URL.createObjectURL(d.image) : '';
    const shot = $<HTMLImageElement>('reportShot');
    shot.src = this.shotUrl;
    shot.hidden = !d.image;
    $<HTMLSelectElement>('reportKind').value = existing?.kind ?? 'geometry';
    $<HTMLTextAreaElement>('reportText').value = existing?.text ?? '';
    $('reportTitle').textContent = existing ? 'Edit the report' : 'Report a problem here';
    $('reportDialog').hidden = false;
    $('reportText').focus();
  }

  private close() {
    $('reportDialog').hidden = true;
    this.draft = this.editing = null;
    $('view').focus();
  }

  private async save() {
    const d = this.draft;
    if (!d) return;
    const text = $<HTMLTextAreaElement>('reportText').value.trim();
    if (!text) { $('reportText').focus(); return; }
    const kind = $<HTMLSelectElement>('reportKind').value as Kind;
    const r: Report = this.editing
      ? { ...this.editing, text, kind }
      : { ...d, id: newId(), created: new Date().toISOString(), text, kind, done: false };
    this.close();
    await this.store.put(r);
    this.flash(r.id);
  }

  // ---------------------------------------------------------------- the list
  render() {
    const list = this.store.list;
    $('reportCount').textContent = list.length ? String(list.filter((r) => !r.done).length) : '';
    for (const u of this.urls) URL.revokeObjectURL(u);
    this.urls = [];
    const shown = [...list].reverse().filter((r) => this.filter === 'all' || !r.done);
    let h = '<div class="buttons">'
      + '<button data-act="new" title="Report what the first-person camera looks at (R)">⚑ New report</button>'
      + '<button data-act="copy" title="Copy them all as Markdown, to paste into an issue">Copy Markdown</button>'
      + '<button data-act="md">Download .md</button>'
      + '<button data-act="json" title="With the screenshots: import it again here or elsewhere">Download .json</button>'
      + (this.actions.canSave ? '<button data-act="save" title="Write inspect-reports/ in the checkout: README.md, reports.json and the screenshots">Save to repo</button>' : '')
      + '<button data-act="import">Import .json</button>'
      + '<button data-act="clear">Clear…</button>'
      + '</div>';
    h += `<p class="note"><label><input type="checkbox" data-act="filter"${this.filter === 'open' ? ' checked' : ''}>open only</label> · `
      + `${list.length} report${list.length === 1 ? '' : 's'}, ${list.filter((r) => !r.done).length} open, kept in this browser until cleared.</p>`;
    h += '<div id="reportOut"></div>';
    if (!shown.length) h += '<p class="note">None yet. Aim at a problem in the world (or double-click it) and press <kbd>R</kbd>.</p>';
    for (const r of shown) {
      const url = r.image ? URL.createObjectURL(r.image) : '';
      if (url) this.urls.push(url);
      const n = list.indexOf(r) + 1;
      h += `<div class="report${r.done ? ' done' : ''}" data-id="${r.id}">`
        + (url ? `<img src="${url}" alt="" data-act="go" title="Go there">` : '')
        + `<div class="body"><b>${n}. <span class="chip">${r.kind}</span>${r.station ? ` ${esc(r.station.name)}` : ''}</b>`
        + ` <small>${esc(r.created.slice(0, 16).replace('T', ' '))}</small>`
        + `<p>${esc(r.text).replace(/\n/g, '<br>')}</p>`
        + `<small>${r.track ? `piece ${r.track.piece} · ${esc(r.track.kind)} · ` : ''}${r.what ? `${esc(r.what)} · ` : ''}${r.at.x.toFixed(0)}, ${r.at.y.toFixed(1)}, ${r.at.z.toFixed(0)}</small>`
        + '<div class="buttons"><button data-act="go">Go there</button><button data-act="edit">Edit</button>'
        + `<label><input type="checkbox" data-act="done"${r.done ? ' checked' : ''}>done</label>`
        + '<button data-act="delete">Delete</button></div></div></div>';
    }
    this.el.innerHTML = h;
  }

  // Scrolls to a report and marks it a moment.
  flash(id: string) {
    const item = this.el.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (!item) return;
    item.scrollIntoView({ block: 'nearest' });
    item.classList.add('flash');
    setTimeout(() => item.classList.remove('flash'), 1200);
  }

  private find(e: Event) {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id;
    return this.store.list.find((r) => r.id === id) ?? null;
  }

  private change(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.dataset.act === 'filter') { this.filter = t.checked ? 'open' : 'all'; this.render(); }
    const r = this.find(e);
    if (r && t.dataset.act === 'done') void this.store.put({ ...r, done: t.checked });
  }

  private async click(e: Event) {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act || act === 'filter' || act === 'done') return;
    const r = this.find(e);
    const list = this.store.list, origin = location.origin;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    switch (act) {
      case 'new': return this.start();
      case 'go': return r && this.actions.go(r);
      case 'edit': return r && this.start(r);
      case 'delete': if (r && confirm(`Delete report ${list.indexOf(r) + 1}?`)) await this.store.remove(r.id); return;
      case 'copy':
        await navigator.clipboard.writeText(toMarkdown(list, origin)).then(() => this.say('Copied as Markdown.'), () => this.say('Could not copy: download it instead.', true));
        return;
      case 'md': return download(`inspect-reports-${stamp}.md`, toMarkdown(list, origin), 'text/markdown');
      case 'json': return download(`inspect-reports-${stamp}.json`, await toJson(list), 'application/json');
      case 'save': {
        this.say('Saving…');
        // README.md beside the screenshots, which are <id>.jpg
        const posted = { markdown: toMarkdown(list, origin, (q) => (q.image ? `${q.id}.jpg` : null)), reports: JSON.parse(await toJson(list)).reports };
        const res = await fetch('__inspect/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(posted) })
          .catch((err: Error) => ({ ok: false, text: async () => err.message }));
        return this.say(await res.text(), !res.ok);
      }
      case 'import': {
        const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          try { this.say(`Imported ${await this.store.import(await file.text())} reports.`); } catch (err) { this.say(`Could not import: ${(err as Error).message}`, true); }
        };
        return input.click();
      }
      case 'clear':
        if (list.length && confirm(`Delete all ${list.length} reports from this browser? Export them first if you want to keep them.`)) await this.store.clear();
        return;
    }
  }

  private say(text: string, bad = false) {
    const out = this.el.querySelector<HTMLElement>('#reportOut');
    if (out) out.innerHTML = `<pre${bad ? ' class="bad"' : ''}>${esc(text)}</pre>`;
  }
}
