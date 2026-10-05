// The reference pane: for the place picked, what it was built from. For a station, its
// description and Albert Guillaumes' drawing it was read from, its frame, heights and the fixes
// made by hand; for a piece of track, what OpenStreetMap says of it and what the tools made of
// it; and plots of the track plan and the profile round it, from the tools that check them.
import { LINES } from '../lines';
import type { LineId } from '../lines';
import { STRUCTURE_KINDS } from '../track-geometry';
import type { Route } from '../track-graph';
import type { StationLayout } from '../station-layout';
import { distToLine, gridToWorld, worldLatLon } from './data';
import type { InspectData, Sample, TrackIndex } from './data';
import { ModelView } from './model-view';
import { KIND_COLOURS } from './overview';
import { aerial, atExit, onPlatform, onTrack } from './views';
import type { View } from './views';
import type { World } from './world';

export type Place =
  | { kind: 'station'; name: string }
  | { kind: 'track'; piece: number; x: number; z: number }
  | { kind: 'point'; x: number; z: number };

export interface RefActions {
  view(v: View): void;
  select(p: Place, fly: boolean): void;
}

const SITE = 'http://estacions.albertguillaumes.cat/';

const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const a = (href: string, text: string) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>`;
const m = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? '—' : `${n.toFixed(d)} m`);
const row = (k: string, v: string) => `<tr><td>${k}</td><td>${v}</td></tr>`;
const why = (text: string) => `<div class="why">${esc(text)}</div>`;

export class Reference {
  place: Place | null = null;
  private views = new Map<string, View>();
  private token = 0;
  private redLayouts: Map<string, StationLayout>;
  private models: ModelView[] = [];

  constructor(private el: HTMLElement, private data: InspectData, private track: TrackIndex, private world: World, private actions: RefActions) {
    this.redLayouts = new Map((data.layouts?.stations ?? []).map((s) => [s.name, s]));
    el.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-model-act]');
      if (act) return this.modelAct(act);
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-view],[data-station],[data-piece],.figure');
      if (!t) return;
      if (t.dataset.view) this.actions.view(this.views.get(t.dataset.view)!);
      else if (t.dataset.station) this.actions.select({ kind: 'station', name: t.dataset.station }, true);
      else if (t.dataset.piece) {
        const [piece, x, z] = t.dataset.piece.split(',').map(Number);
        this.actions.select({ kind: 'track', piece, x, z }, true);
      } else if (t.classList.contains('figure')) zoom(t.querySelector('img')!.src);
    });
  }

  // a button that puts the camera somewhere
  private button(label: string, v: View | null, title = '') {
    if (!v) return '';
    const key = String(this.views.size);
    this.views.set(key, v);
    return `<button data-view="${key}" title="${esc(title)}">${esc(label)}</button>`;
  }

  show(place: Place) {
    this.place = place;
    this.views.clear();
    const token = ++this.token;
    const html = place.kind === 'station' ? this.station(place.name) : place.kind === 'track' ? this.trackPiece(place.piece, place.x, place.z) : this.point(place.x, place.z);
    for (const v of this.models) v.dispose();
    this.models = [];
    this.el.innerHTML = html + this.sources();
    this.el.scrollTop = 0;
    for (const box of this.el.querySelectorAll<HTMLElement>('[data-model]')) {
      const status = box.querySelector<HTMLElement>('.model-status')!;
      this.models.push(new ModelView(box, box.dataset.model!, (text, bad) => { status.textContent = text; status.classList.toggle('err', !!bad); }));
    }
    for (const img of this.el.querySelectorAll('img')) {
      img.addEventListener('error', () => {
        img.closest('.figure')!.outerHTML = `<p class="err">Couldn't load ${esc(decodeURIComponent(img.src))}</p>`;
      });
    }
    // what the tools print, fetched as it's needed
    for (const pre of this.el.querySelectorAll<HTMLElement>('pre[data-src]')) {
      fetch(pre.dataset.src!).then(async (res) => {
        if (token !== this.token) return;
        pre.textContent = await res.text();
        pre.classList.toggle('bad', !res.ok);
      });
    }
  }

  // ---------------------------------------------------------------- a station
  private station(name: string) {
    const { graph, refs } = this.data;
    const st = graph.stations.find((s) => s.name === name);
    if (!st) return `<h2>${esc(name)}</h2><p class="err">Not a station in the track graph.</p>`;
    const layout = this.redLayouts.get(name);
    const routes = graph.routes.filter((r) => r.stops.some((s) => s.station === name));
    const services = [...new Set(routes.map((r) => r.service))];
    const lines = [...new Set(st.platforms.flatMap((p) => p.tracks.flatMap((t) => graph.pieces[t.piece].lines)))];
    const built = !!layout || name === 'T-Centralen';
    const sm = this.track.nearest(st.x, st.z, 80);
    const desc = refs?.descriptions[name];
    let h = `<h2>${lines.map((l) => `<span class="dot" style="background:${LINES[l as LineId]?.color ?? '#888'}"></span>`).join('')}${esc(name)}</h2>`;
    h += `<p class="sub">${[...services, ...lines.map((l) => `${l} line`)].join(' · ')}${layout ? ` · ${layout.exits.length} exits` : ''}</p>`;

    h += '<div class="buttons">';
    h += this.button('Platform', onPlatform(this.world, name), 'Stand on the platform');
    h += this.button('From above', aerial(this.world, this.track, st.x, st.z, layout?.platformY, layout?.yaw ?? 0));
    if (sm) h += this.button('On the track', onTrack(this.track, sm), 'Over the track beside the platform, looking along it');
    h += `<a href="./?at=${encodeURIComponent(name)}" target="_blank"><button>Open in game ↗</button></a>`;
    h += '</div>';
    if (layout?.exits.length) {
      h += '<div class="buttons">' + layout.exits.map((e) => this.button(`↑ ${e.name}`, atExit(e), 'Out in the street, looking at the exit')).join('') + '</div>';
    }
    if (!built) h += '<p class="note">Not built yet: the game draws only the red line. This is the track graph from OpenStreetMap.</p>';
    h += this.guillaumes(name, desc?.drawing);

    // heights
    const wd = refs?.heights[name];
    const fix = refs?.heightFixes.stations?.find((s) => s.station === name);
    const ground = sm ? this.track.geometry.pieces[sm.piece].ground[sm.i] : null;
    let heights = '';
    if (wd) heights += row('Wikidata', `${wd.height} m · ${a(`https://www.wikidata.org/wiki/${wd.wikidata}`, wd.wikidata)}${fix ? ' (not used)' : ''}`);
    if (fix) heights += row('Fixed by hand', `${fix.height} m`);
    if (layout) heights += row('Platform level', m(layout.platformY, 2));
    if (sm) {
      heights += row('Rail at the platform', m(sm.y, 2));
      heights += row('Ground over it', ground === null ? '—' : `${m(ground)} · ${Math.abs(ground - sm.y).toFixed(1)} m ${ground > sm.y ? 'down' : 'under the rail'}`);
      heights += row('Structure', `<span style="color:${KIND_COLOURS[sm.kind]}">■</span> ${sm.kind}`);
    }
    if (heights) h += `<h3>Heights (RH 2000)</h3><table>${heights}</table>`;
    if (refs && !wd && built) h += `<p class="note">No height on Wikidata.</p>`;
    h += this.fixes(st.x, st.z, 250, name);

    // what it was built from
    if (name === 'T-Centralen') {
      h += '<h3>Built from</h3>';
      h += `<p>Albert Guillaumes' 3D drawing of the station (${a('http://stations.albertguillaumes.cat/', 'Stations and transfers')}), `
        + 'converted unchanged to <code>public/assets/t-centralen.glb</code> and fitted onto OpenStreetMap\'s tracks by <code>tools/fit-station.ts</code> '
        + '(see <code>public/data/stations.json</code> for how well it fits).</p>';
    } else if (desc) {
      h += '<h3>Description</h3>';
      if (desc.note) h += `<p>${esc(desc.note)}</p>`;
      if (desc.drawing) h += `<p class="note">Read off Albert Guillaumes' drawing, above.</p>`;
      const { note: _n, drawing: _d, ...rest } = desc;
      h += `<details><summary>The description in data/station-descriptions.json (${(desc.routes ?? []).length} routes)</summary><pre>${esc(JSON.stringify(rest, null, 1))}</pre></details>`;
      h += `<h3>Frame</h3><p class="note">Where the tracks, platforms, street and entrances are in the description's [s, u] frame (<code>npm run build-stations -- --frame ${esc(name)}</code>).</p>`;
      h += `<pre data-src="__inspect/frame?station=${encodeURIComponent(name)}">…</pre>`;
    } else if (built && refs) {
      h += '<p class="err">No description in data/station-descriptions.json.</p>';
    }

    // the plots
    h += this.plots(st.x, st.z, 300, routes.length ? this.stopKm(routes[0], name) : null);

    // the ways out
    if (refs) {
      const near = refs.entrances.map((e) => ({ ...e, d: Math.hypot(e.x - st.x, e.z - st.z) })).filter((e) => e.d < 450).sort((p, q) => p.d - q.d);
      if (near.length) {
        h += `<h3>OpenStreetMap's entrances within 450 m</h3><ul>`;
        for (const e of near) {
          const used = layout?.exits.some((x) => Math.hypot(x.x - e.x, x.z - e.z) < 3);
          h += `<li>${a(`https://www.openstreetmap.org/node/${e.id}`, e.name ?? String(e.id))} · ${e.d.toFixed(0)} m${used ? ' · <b>an exit</b>' : ''}</li>`;
        }
        h += '</ul>';
      }
    }
    h += '<h3>Links</h3>' + this.links(st.x, st.z, `https://www.openstreetmap.org/node/${st.osm}`);
    return h;
  }

  // Albert Guillaumes' 3D model of the station, where he has published one (T-Centralen's is the
  // one the game is built on), and his drawing of it.
  private guillaumes(name: string, described?: string) {
    const g = this.data.guillaumes?.get(name);
    const drawing = this.data.refs ? g?.drawing ?? described : undefined;
    const model = name === 'T-Centralen' ? 'assets/t-centralen.glb' : this.data.refs && g?.model ? `__inspect/model/${g.model}.gltf` : null;
    let h = '';
    if (model) {
      h += `<div class="model" data-model="${esc(model)}"><div class="model-bar"><span class="model-status"></span>`
        + '<button data-model-act="reset">Reset</button><button data-model-act="wire">Wireframe</button><button data-model-act="big" title="Fill the window (Esc to shrink)">Enlarge</button></div></div>';
      h += `<p class="note">His 3D model${name === 'T-Centralen' ? ', which the game is built on (<code>public/assets/t-centralen.glb</code>)' : ''}: drag to turn it, the wheel to zoom, right-drag to pan.</p>`;
    }
    if (drawing) {
      h += `<div class="figure drawing" title="Click to see it full size"><img src="__inspect/drawing/${esc(drawing)}" alt="Drawing of ${esc(name)}"></div>`;
      h += `<p class="note">His drawing${described ? ', which the description is read from' : ''}: ${a(`${SITE}img/estocolm/${drawing}`, drawing)}</p>`;
    }
    if (h) return `<h3>Albert Guillaumes</h3>${h}<p class="note">© Albert Guillaumes, ${a(SITE, 'estacions.albertguillaumes.cat')}: used as a reference only, and kept out of the repository.</p>`;
    if (this.data.refs && !this.data.guillaumes) return `<p class="note">Albert Guillaumes' site couldn't be reached for his drawings: reload to try again.</p>`;
    return '';
  }

  private modelAct(btn: HTMLElement) {
    const box = btn.closest<HTMLElement>('[data-model]')!;
    const view = this.models[[...this.el.querySelectorAll('[data-model]')].indexOf(box)];
    if (!view) return;
    if (btn.dataset.modelAct === 'reset') view.reset();
    if (btn.dataset.modelAct === 'wire') {
      view.toggleWire();
      btn.classList.toggle('on');
    }
    if (btn.dataset.modelAct === 'big') {
      const big = box.classList.toggle('big');
      btn.textContent = big ? 'Shrink' : 'Enlarge';
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        removeEventListener('keydown', onKey);
        if (box.classList.contains('big')) this.modelAct(btn);
      };
      if (big) addEventListener('keydown', onKey);
    }
  }

  // ---------------------------------------------------------------- a piece of track
  private trackPiece(id: number, x: number, z: number) {
    const { graph } = this.data;
    const p = graph.pieces[id];
    const geo = this.track.geometry.pieces[id];
    const smHere = geo ? this.sampleOn(id, x, z) : null;
    const node = (nid: number) => graph.nodes.find((n) => n.id === nid);
    let h = `<h2>Piece ${id}</h2><p class="sub">${p.service}${p.lines.length ? ` · ${p.lines.join('/')}` : ''} · ${p.structure}${p.covered ? ' (covered)' : ''} · ${p.length.toFixed(0)} m</p>`;
    h += '<div class="buttons">';
    if (smHere) {
      h += this.button('On the track →', onTrack(this.track, smHere, 1), 'Looking towards its `to` end');
      h += this.button('← On the track', onTrack(this.track, smHere, -1), 'Looking towards its `from` end');
    }
    h += this.button('From above', aerial(this.world, this.track, x, z, smHere?.y, smHere ? this.track.heading(smHere) : 0));
    h += '</div>';
    if (!geo) h += '<p class="note">Not drawn: the game draws the red line\'s track only (and what\'s joined to it).</p>';

    h += '<h3>OpenStreetMap</h3><table>';
    for (const [label, nid] of [['From', p.from], ['To', p.to]] as const) {
      const n = node(nid);
      h += row(label, `${n?.kind ?? '?'} · ${a(`https://www.openstreetmap.org/node/${nid}`, String(nid))}`);
    }
    h += row('Ways', p.ways.map((w) => a(`https://www.openstreetmap.org/way/${w}`, String(w))).join(', '));
    if (p.layer !== undefined) h += row('Layer', String(p.layer));
    h += '</table>';

    if (geo && smHere) {
      const i = smHere.i, ground = geo.ground[i];
      h += `<h3>As drawn, at ${geo.s[i].toFixed(0)} m along</h3><table>`;
      h += row('Rail', m(geo.y[i], 2));
      h += row('Ground', ground === null ? '—' : `${m(ground)} · ${Math.abs(ground - geo.y[i]).toFixed(1)} m ${ground > geo.y[i] ? 'over the rail' : 'under it'}`);
      h += row('Structure', `<span style="color:${KIND_COLOURS[smHere.kind]}">■</span> ${smHere.kind}`);
      const grade = i > 0 ? ((geo.y[i] - geo.y[i - 1]) / Math.max(0.1, geo.s[i] - geo.s[i - 1])) * 1000 : null;
      if (grade !== null) h += row('Gradient', `${grade.toFixed(1)}‰`);
      if (geo.pair[i]) h += row('The other track', `${geo.pair[i].toFixed(2)} m to the ${geo.pair[i] > 0 ? 'right' : 'left'}${geo.pairDy[i] ? `, ${geo.pairDy[i].toFixed(1)} m higher` : ''}`);
      if (geo.left?.[i] || geo.right?.[i]) h += row('Nearest beside it', `left ${geo.left?.[i] ? Math.abs(geo.left[i]).toFixed(1) + ' m' : '—'}, right ${geo.right?.[i] ? Math.abs(geo.right[i]).toFixed(1) + ' m' : '—'}`);
      h += row('Rail along the piece', `${Math.min(...geo.y).toFixed(1)} to ${Math.max(...geo.y).toFixed(1)} m`);
      h += '</table>';
      if (geo.platforms.length) {
        h += '<p>' + geo.platforms.map((pl) => `<span class="chip" data-station="${esc(pl.station)}" style="cursor:pointer">${esc(pl.station)}</span> platform ${pl.s0.toFixed(0)}–${pl.s1.toFixed(0)} m, ${pl.width} m wide on the ${pl.side > 0 ? 'right' : 'left'}${pl.island ? ' (island)' : ''}`).join('<br>') + '</p>';
      }
    }

    const routes = graph.routes.filter((r) => r.path.some((q) => q.piece === id));
    if (routes.length) {
      h += '<h3>Services</h3><ul>' + routes.map((r) => `<li>${esc(r.name)} · km ${(this.pieceKm(r, id, smHere ? geo!.s[smHere.i] : p.length / 2) / 1000).toFixed(2)}</li>`).join('') + '</ul>';
    }
    h += this.fixes(x, z, 150);
    h += this.plots(x, z, 250, routes.length ? { route: routes[0], km: this.pieceKm(routes[0], id, smHere ? geo!.s[smHere.i] : p.length / 2) / 1000 } : null);
    h += '<h3>Links</h3>' + this.links(x, z);
    return h;
  }

  // The sample of a drawn piece nearest (x, z).
  private sampleOn(id: number, x: number, z: number): Sample {
    const geo = this.track.geometry.pieces[id];
    let i = 0, bestD = Infinity;
    for (let k = 0; k < geo.x.length; k++) {
      const d = Math.hypot(geo.x[k] - x, geo.z[k] - z);
      if (d < bestD) { bestD = d; i = k; }
    }
    return { piece: id, i, x: geo.x[i], y: geo.y[i], z: geo.z[i], kind: STRUCTURE_KINDS[geo.kind[Math.min(i, geo.kind.length - 1)]] };
  }

  // ---------------------------------------------------------------- a point
  private point(x: number, z: number) {
    const near = this.data.graph.stations.map((s) => ({ s, d: Math.hypot(s.x - x, s.z - z) })).sort((p, q) => p.d - q.d)[0];
    const ground = this.world.city?.heightAt(x, z);
    let h = `<h2>${x.toFixed(0)}, ${z.toFixed(0)}</h2>`;
    h += `<p class="sub">${near ? `${(near.d / 1000).toFixed(2)} km from <span class="chip" data-station="${esc(near.s.name)}" style="cursor:pointer">${esc(near.s.name)}</span>` : ''}</p>`;
    h += '<div class="buttons">' + this.button('From above', aerial(this.world, this.track, x, z)) + '</div>';
    h += '<table>' + row('World x, z', `${x.toFixed(1)}, ${z.toFixed(1)}`);
    const { lat, lon } = worldLatLon(x, z);
    h += row('Latitude, longitude', `${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    if (ground !== null && ground !== undefined) h += row('Ground', m(ground));
    h += '</table>';
    h += this.fixes(x, z, 200);
    h += this.plots(x, z, 400, null);
    h += '<h3>Links</h3>' + this.links(x, z);
    return h;
  }

  // ---------------------------------------------------------------- shared parts
  // The fixes made by hand to the inputs near (x, z), or at a station.
  private fixes(x: number, z: number, reach: number, station?: string) {
    const r = this.data.refs;
    if (!r) return '';
    const found: string[] = [];
    for (const [what, list] of [['Height', r.heightFixes.uncovered], ['Height', r.heightFixes.offGround]] as const) {
      for (const f of list ?? []) if (distToLine(x, z, f.along) < f.reach + reach) found.push(`<b>${what}</b> (data/height-corrections.json)${why(f.why)}`);
    }
    for (const c of r.trackFixes.crossovers ?? []) {
      const p = gridToWorld(c.a), q = gridToWorld(c.b);
      if (distToLine(x, z, [[p.x, p.z], [q.x, q.z]]) < reach) found.push(`<b>Crossover</b> (data/track-corrections.json)${why(c.why)}`);
    }
    if (station) {
      for (const f of r.trackFixes.platforms ?? []) if (f.station === station) found.push(`<b>Platform</b> (data/track-corrections.json)${why(f.why)}`);
      for (const f of r.heightFixes.stations ?? []) if (f.station === station) found.push(`<b>Station height</b> (data/height-corrections.json)${why(f.why)}`);
    }
    return found.length ? `<h3>Fixed by hand</h3>${found.join('')}` : '';
  }

  // The track plan round (x, z), and the profile of a route round a point of it (km).
  private plots(x: number, z: number, radius: number, along: { route: Route; km: number } | null) {
    if (!this.data.refs) return '<p class="note">Run <code>npm run inspect</code> for the plots, the drawings and the data the tools read.</p>';
    let h = `<h3>Track plan</h3><div class="figure" title="Click to see it full size"><img loading="lazy" src="__inspect/plot?at=${x.toFixed(1)},${z.toFixed(1)}&r=${radius}" alt="Track plan"></div>`;
    h += `<p class="note">${radius * 2} m across, from <code>npm run plot-graph -- ${x.toFixed(0)},${z.toFixed(0)} ${radius}</code>: running lines dark, other track grey, the drawn track coloured by structure, platform tracks yellow, piece ids in blue.</p>`;
    if (along) {
      const from = Math.max(0, along.km - 1.5), to = along.km + 1.5;
      h += `<h3>Profile</h3><div class="figure" title="Click to see it full size"><img loading="lazy" src="__inspect/profile?route=${encodeURIComponent(along.route.name)}&from=${from.toFixed(2)}&to=${to.toFixed(2)}" alt="Profile"></div>`;
      h += `<p class="note">${esc(along.route.name)}, km ${from.toFixed(1)}–${to.toFixed(1)} (<code>npm run plot-profile</code>): the rail, the ground over it, and the stations' heights.</p>`;
    }
    return h;
  }

  // How far along a route a point of a piece is, in metres.
  private pieceKm(route: Route, piece: number, s: number) {
    let d = 0;
    for (const step of route.path) {
      const len = this.data.graph.pieces[step.piece].length;
      if (step.piece === piece) return d + (step.dir > 0 ? s : len - s);
      d += len;
    }
    return d;
  }

  private stopKm(route: Route, station: string) {
    const stop = route.stops.find((s) => s.station === station)!;
    return { route, km: this.pieceKm(route, stop.piece, stop.s) / 1000 };
  }

  private links(x: number, z: number, osm?: string) {
    const { lat, lon } = worldLatLon(x, z);
    const ll = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    return '<ul>'
      + (osm ? `<li>${a(osm, 'OpenStreetMap: the station')}</li>` : '')
      + `<li>${a(`https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=18/${lat.toFixed(6)}/${lon.toFixed(6)}`, 'OpenStreetMap')} · `
      + `${a(`https://www.openrailwaymap.org/?style=standard&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&zoom=17`, 'OpenRailwayMap')} · `
      + `${a(`https://www.google.com/maps/@${ll},180m/data=!3m1!1e3`, 'aerial photo')}</li>`
      + `<li>${a('https://www.gleisplanweb.eu/show.php?Map=Stockholm&Index=2', "Gleisplanweb's track plan")} (reference only)</li>`
      + '</ul>';
  }

  private sources() {
    const { graph, refs } = this.data;
    return '<h3>Sources</h3><ul class="note">'
      + `<li>Track: ${a('https://www.openstreetmap.org/copyright', 'OpenStreetMap')} contributors (ODbL)${graph.osm ? `, as of ${esc(graph.osm.slice(0, 10))}` : ''}; <code>data/osm/</code>, fixed by <code>data/track-corrections.json</code></li>`
      + `<li>Heights: ${a('https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/markhojdmodell-nedladdning/', 'Lantmäteriet Markhöjdmodell')} (CC BY 4.0); stations from Wikidata P2044${refs ? ` (${esc(refs.heightNote.split('.')[0])})` : ''}</li>`
      + `<li>Aerial photos: ${a('https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/ortofoto-nedladdning/', 'Lantmäteriet Ortofoto')} (CC BY 4.0); <code>public/data/ortho/</code></li>`
      + `<li>Station layouts: read off ${a('http://estacions.albertguillaumes.cat/', "Albert Guillaumes' drawings")} (reference only); T-Centralen is his 3D drawing</li>`
      + `<li>Design limits and sections: the ${a('https://fordonsradio.se/wp-content/uploads/2025/08/Stockholms-Tunnelbanesystem-1952.pdf', '1952')} and ${a('https://fordonsradio.se/wp-content/uploads/2025/08/Stockholms-Tunnelbanor-1975.pdf', '1975')} technical descriptions (reference only)</li>`
      + `<li>Notes: ${a('docs/network-sources.md', 'docs/network-sources.md')}, ${a('docs/red-line-plan.md', 'docs/red-line-plan.md')}</li>`
      + '</ul>';
  }
}

// A figure over everything, fitted to the window: click it for its full size, and beside it (or
// Esc) to close.
function zoom(src: string) {
  const el = document.getElementById('zoom')!;
  el.innerHTML = `<img src="${esc(src)}" alt="">`;
  el.hidden = false;
  const img = el.querySelector('img')!;
  const close = () => { el.hidden = true; el.innerHTML = ''; removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') close(); };
  img.onclick = (e) => { e.stopPropagation(); img.classList.toggle('full'); };
  el.onclick = close;
  addEventListener('keydown', onKey);
}
