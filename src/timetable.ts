import * as THREE from 'three';
import { LINES } from './lines';
import type { Destination, LineId } from './lines';
import { Polyline } from './polyline';
import { routeLine, locateSegment, segmentAt } from './routes';
import type { RouteStretch } from './station-join';
import type { TrackGraph } from './track-graph';
import type { TrackGeometry } from './track-geometry';
import { ACC, DWELL, RAIL_TOP, advance } from './service';
import type { Service, Stop } from './service';

// The trains on the track network: each service of the timetable (public/data/track-graph.json)
// runs its routes end to end, a train every headway each way. A trip stands at its first station
// with its doors open until its departure time, and stops at every station. At the last it turns
// where it stands: the route arrives on the platform track the route the other way leaves from,
// and the train becomes that route's next trip, waiting with its doors open until it leaves. So
// once the game is going, the trips at the ends of the line are the trains that came in, and no
// new ones are set off there. (A route that can't turn so runs on beyond its last station, out of
// sight.) The trips keep their distance on the track they share, and at a junction the one that
// would get there first goes first; a train waiting to leave the end of the line claims the track
// out to where it leaves the incoming trains' way.

const LINE_SPEED = 20;    // m/s, about 70 km/h
const RUN_ON = 220;       // the line is extended this far beyond each end, to run in and out on
const LAYOVER = 75;       // seconds at the first station, from arriving to the closing chime
const SLACK = 4;          // seconds more at each stop in the timetable than a train needs
const MARGIN = 30;        // metres a train stops short of the one ahead
const JUNCTION = 15;      // and short of a junction it gives way at
const CLAIM = 60;         // a train claims its braking distance and this much more ahead
const FF_STEP = 0.5;      // seconds per step when working out where trips are at the start

export interface NetRoute {
  name: string;
  service: string;
  line: LineId;
  dest: Destination;
  path: Polyline;
  shown: [number, number];
  stops: Stop[];
  // the pieces of the track graph under the path: from r0 to r1 along it, from s0 to s1 along the
  // piece
  segs: { piece: number; r0: number; r1: number; s0: number; s1: number }[];
  trainLen: number;
  headway: number;
  base: number;   // when trip 0 sets off; trip k sets off a headway later than trip k − 1
  sched: Schedule;
  reverse: NetRoute | null;
  turns: boolean; // its trains turn into `reverse`'s at the last stop
  fed: boolean;   // its trips are the trains that turned at its first stop (once the game is going)
  // how far a train waiting at the first stop claims the track ahead: out to where it leaves the
  // track the incoming trains come in on
  startClaim: number;
  nextK: number;  // the next trip to set off
}

// A trip's run with nothing in its way: when it arrives at each stop and closes its doors there,
// from when it sets off, and where its front is every FF_STEP seconds.
interface Schedule { arrive: number[]; close: number[]; heads: Float32Array; duration: number }

// A stretch of a piece a trip holds (under it) or claims (ahead of it). A hard claim is given way
// to whoever would get there first: a train leaving the end of the line has the track out.
interface Span { s0: number; s1: number; svc: Service; claim: boolean; hard: boolean; sHead: number; dHead: number }

export class Timetable {
  routes: NetRoute[] = [];
  trips: Service[] = [];
  clock = 0;
  private ids = 0;
  private started = false;

  // `trainLens`: the length of each line's trains; `stretches`: where the station models replace the
  // routes' lines (src/station-join.ts)
  constructor(graph: TrackGraph, geometry: TrackGeometry, trainLens: (line: LineId) => number, stretches: Map<string, RouteStretch[]>,
    private onRemove: (svc: Service) => void = () => {}) {
    const tt = graph.timetable;
    if (!tt) return;
    for (const route of graph.routes) {
      const timing = tt.services[route.service];
      if (!timing || !(route.line in LINES)) continue;
      const line = routeLine(geometry, route.path);
      if (!line || line.length < 2) continue;
      const trainLen = trainLens(route.line as LineId);
      // the line at platform level, through the station models' platforms, and run on at each end
      const pts = line.map((p) => new THREE.Vector3(p.x, p.y + RAIL_TOP, p.z));
      for (const st of stretches.get(route.name) ?? []) st.pts.forEach((p, i) => pts[st.from + i].copy(p));
      const n = pts.length;
      const t0 = pts[0].clone().sub(pts[1]).setY(0).normalize(), t1 = pts[n - 1].clone().sub(pts[n - 2]).setY(0).normalize();
      const path = new Polyline([pts[0].clone().addScaledVector(t0, RUN_ON), ...pts, pts[n - 1].clone().addScaledVector(t1, RUN_ON)]);
      const shown: [number, number] = [path.cum[1], path.cum[n]];
      // the path's point i + 1 is the line's point i
      const rAt = (i: number, t: number) => path.cum[i] + (path.cum[i + 1] - path.cum[i]) * t;
      const segs: NetRoute['segs'] = [];
      for (let i = 1; i < n; i++) {
        const a = line[i - 1], b = line[i];
        const r0 = path.cum[i], r1 = path.cum[i + 1];
        // where two pieces meet, the segment is on the second, from the node
        segs.push({ piece: b.piece, r0, r1, s0: a.piece === b.piece ? a.s : b.s - (r1 - r0) * b.dir, s1: b.s });
      }
      const pieceSide = (piece: number, s: number) => {
        for (const st of graph.stations) for (const p of st.platforms) for (const t of p.tracks) {
          if (t.piece === piece && s >= t.s0 - 1 && s <= t.s1 + 1) return t.side === 'right' ? 1 : -1;
        }
        return 1;
      };
      // where a station model's platform replaces the line, the stop there is at its middle
      const joined = new Map((stretches.get(route.name) ?? []).map((st) => [st.k, st.stop]));
      const stops: Stop[] = [];
      for (const [k, st] of route.stops.entries()) {
        const at = joined.has(k) ? segmentAt(line, joined.get(k)!) : locateSegment(line, st.piece, st.s);
        if (!at) continue;
        const r = rAt(at.i, at.t);
        const dir = line[at.i].dir;
        const head = Math.max(shown[0] + trainLen + 2, Math.min(shown[1] - 3, r + trainLen / 2));
        stops.push({ station: st.station, head, side: (pieceSide(st.piece, st.s) * dir) as 1 | -1, until: -Infinity });
      }
      if (stops.length < 2) continue;
      const ref = stops.findIndex((st) => st.station === tt.station);
      const nr: NetRoute = {
        name: route.name, service: route.service, line: route.line as LineId,
        dest: [route.service.replace(/^\D+/, ''), stops[stops.length - 1].station],
        path, shown, stops, segs, trainLen, headway: timing.headway, base: 0,
        sched: null!, reverse: null, turns: false, fed: false, startClaim: CLAIM, nextK: 0,
      };
      nr.sched = this.schedule(nr);
      nr.base = timing.offset - (ref >= 0 ? nr.sched.arrive[ref] : 0);
      this.routes.push(nr);
    }
    // each service's two routes turn into each other at the ends: where the trains stand at the
    // last stop of one is where they stand at the first stop of the other
    const middle = (r: NetRoute, k: number) => r.path.pointAt(r.stops[k].head - r.trainLen / 2);
    for (const r of this.routes) {
      r.reverse = this.routes.find((o) => o !== r && o.service === r.service
        && o.stops[0].station === r.stops[r.stops.length - 1].station) ?? null;
      r.turns = !!r.reverse && middle(r, r.stops.length - 1).distanceTo(middle(r.reverse, 0)) < 2;
    }
    for (const r of this.routes) {
      const from = this.routes.find((o) => o.reverse === r && o.turns);
      if (!from) continue;
      r.fed = true;
      // out along the path while it runs on the track the incoming trains come in on
      const theirs = new Set(from.segs.map((sg) => sg.piece));
      let end = r.stops[0].head;
      for (const sg of r.segs) if (sg.r1 > end && theirs.has(sg.piece) && sg.r0 <= end + 1) end = sg.r1;
      r.startClaim = Math.max(CLAIM, end - r.stops[0].head + JUNCTION + MARGIN);
    }
    // the trips under way now, where the timetable has them; those that have come to the end of
    // a line where trains turn have turned into a trip that is already there
    for (const r of this.routes) {
      r.nextK = Math.floor((this.clock - r.sched.duration - r.base) / r.headway);
    }
    this.spawn();
    for (const svc of [...this.trips]) {
      if (this.route(svc).turns && svc.stop >= svc.stops.length - 1 && svc.state !== 'run') this.remove(svc);
    }
    // ... and the trains that came in before the game started stand at the first stop as the next
    // trips, until those are due out: as long after each arrival as the ends' layover
    for (const r of this.routes) {
      const from = this.routes.find((o) => o.reverse === r && o.turns);
      if (!from) continue;
      const layover = mod(r.base + r.sched.close[0] - from.base - from.sched.arrive[from.stops.length - 1], r.headway);
      for (; this.spawnTime(r, r.nextK) + r.sched.close[0] - layover < this.clock; r.nextK++) {
        const svc = this.trip(r, r.nextK, this.spawnTime(r, r.nextK));
        svc.head = svc.stops[0].head;
        svc.state = 'dwell';
        svc.doors = 1;
        this.trips.push(svc);
      }
    }
    this.started = true;
  }

  // A trip of `route` running with nothing in its way, from when it sets off.
  private schedule(route: NetRoute): Schedule {
    const svc = this.trip(route, 0, 0);
    const arrive: number[] = [], close: number[] = [], heads: number[] = [];
    let t = 0;
    for (;;) {
      heads.push(svc.head);
      const ev = advance(svc, FF_STEP, t);
      t += FF_STEP;
      if (ev === 'arrived') {
        arrive[svc.stop] = t;
        svc.stops[svc.stop].until = t + (svc.stop === 0 ? LAYOVER : DWELL + SLACK);
        close[svc.stop] = svc.stops[svc.stop].until;
      }
      if (ev === 'done' || t > 6 * 3600) break;
    }
    return { arrive, close, heads: Float32Array.from(heads), duration: t };
  }

  private trip(route: NetRoute, k: number, spawn: number): Service {
    const L = LINES[route.line];
    return {
      id: this.ids++, L, vmax: LINE_SPEED, cars: [], model: null, trainLen: route.trainLen,
      path: route.path, shown: route.shown,
      stops: route.stops.map((st, j) => ({ ...st, until: route.sched ? spawn + route.sched.close[j] : -Infinity })),
      stop: 0, end: route.turns ? route.stops[route.stops.length - 1].head : route.shown[1] + route.trainLen + 5,
      state: 'run', timer: 0, head: route.shown[0], speed: 0, limit: Infinity, doors: 0,
      dest: route.dest, trip: { route: route.name, k, spawn },
    };
  }

  private spawnTime(route: NetRoute, k: number) { return route.base + k * route.headway; }


  // Sets off the trips whose time has come; a trip that set off a while ago is run on, on its
  // own, to where it is now.
  private spawn() {
    for (const r of this.routes) {
      if (r.fed && this.started) continue;
      for (let t = this.spawnTime(r, r.nextK); t <= this.clock; t = this.spawnTime(r, ++r.nextK)) {
        const svc = this.trip(r, r.nextK, t);
        let done = false;
        for (let c = t; c < this.clock && !done; c += FF_STEP) done = advance(svc, Math.min(FF_STEP, this.clock - c), c) === 'done';
        if (!done) this.trips.push(svc);
      }
    }
  }

  route(svc: Service) { return this.routes.find((r) => r.name === svc.trip?.route)!; }

  update(dt: number) {
    this.clock += dt;
    this.spawn();
    this.space();
    const events: [Service, ReturnType<typeof advance>][] = [];
    for (const svc of this.trips) {
      const ev = advance(svc, dt, this.clock);
      if (ev) events.push([svc, ev]);
      if (ev === 'arrived' && svc.stop === svc.stops.length - 1 && this.route(svc).turns) {
        this.turnAround(svc);
        events.push([svc, 'turned']);
      }
    }
    for (const [svc, ev] of events) if (ev === 'done') this.remove(svc);
    return events;
  }

  // A train that has come to the end of its route becomes the next trip the other way, from where
  // it stands: it keeps its doors open until that trip leaves.
  private turnAround(svc: Service) {
    const route = this.route(svc).reverse!;
    const k = route.nextK++;
    const spawn = this.spawnTime(route, k);
    const next = this.trip(route, k, spawn);
    svc.path = next.path;
    svc.shown = next.shown;
    svc.stops = next.stops;
    svc.end = next.end;
    svc.stop = 0;
    svc.head = next.stops[0].head;
    svc.dest = next.dest;
    svc.trip = next.trip;
    svc.timer = 0;
  }

  private remove(svc: Service) {
    this.trips.splice(this.trips.indexOf(svc), 1);
    this.onRemove(svc);
  }

  // ------------------------------------------------------------------ spacing
  // Every trip on the track holds its stretch of each piece, and claims the stretch it needs to
  // stop in ahead of it. A trip may run no faster than lets it stop MARGIN short of the next
  // train ahead on its track, or JUNCTION short of where another trip has claimed the track and
  // would get there first.
  private space() {
    const spans = new Map<number, Span[]>();
    const add = (piece: number, sp: Span) => (spans.get(piece) ?? spans.set(piece, []).get(piece)!).push(sp);
    for (const svc of this.trips) {
      svc.limit = Infinity;
      const route = this.route(svc);
      const tail = svc.head - svc.trainLen;
      if (svc.head < route.shown[0] || tail > route.shown[1]) continue;
      this.pieces(route, tail, svc.head, (piece, s0, s1) => add(piece, { s0, s1, svc, claim: false, hard: false, sHead: 0, dHead: 0 }));
      // a train waiting to leave the end of the line, or leaving, claims the track out of the
      // station
      const hard = leaving(svc, route);
      const ahead = Math.max(braking(svc.speed) + CLAIM, hard ? route.stops[0].head + route.startClaim - svc.head : 0);
      this.pieces(route, svc.head, svc.head + ahead, (piece, s0, s1, rFrom) => add(piece, {
        s0, s1, svc, claim: true, hard, sHead: s0, dHead: rFrom - svc.head,
      }));
    }
    for (const svc of this.trips) {
      if (svc.state !== 'run') continue;
      const route = this.route(svc);
      const look = braking(Math.max(svc.speed, LINE_SPEED)) + MARGIN + CLAIM;
      const me = Math.max(svc.speed, 3), mine = leaving(svc, route);
      let room = Infinity;
      for (const sg of this.segsBetween(route, svc.head, svc.head + look)) {
        if (sg.r0 - svc.head > room) break;
        for (const sp of spans.get(sg.piece) ?? []) {
          if (sp.svc === svc) continue;
          // the span's part on this segment, in this trip's distances
          const lo = Math.max(Math.min(sp.s0, sp.s1), Math.min(sg.s0, sg.s1)), hi = Math.min(Math.max(sp.s0, sp.s1), Math.max(sg.s0, sg.s1));
          if (lo > hi) continue;
          const ra = rOn(sg, lo), rb = rOn(sg, hi);
          const near = Math.min(ra, rb), sNear = ra < rb ? lo : hi;
          if (near < svc.head - 0.5) continue; // behind this trip's front: not in its way
          const gap = near - svc.head;
          if (sp.claim && sp.hard) room = Math.min(room, gap - JUNCTION);
          else if (sp.claim) {
            if (mine) continue;
            // give way if the other would get there first; side by side, the older trip goes first
            const other = sp.dHead + Math.abs(sNear - sp.sHead);
            const tOther = other / Math.max(sp.svc.speed, 3), tMe = gap / me;
            const tie = Math.abs(tOther - tMe) < 0.05 || (gap < 1 && other < 1);
            if (tie ? sp.svc.id > svc.id : tOther > tMe) continue;
            room = Math.min(room, gap - JUNCTION);
          } else room = Math.min(room, gap - MARGIN);
        }
      }
      if (room < Infinity) svc.limit = room > 0.5 ? Math.sqrt(2 * ACC * room) : 0;
    }
  }

  // Calls back with each piece under the stretch [ra, rb] of the route's path, as distances along
  // the piece, and where along the path that piece's part starts.
  private pieces(route: NetRoute, ra: number, rb: number, cb: (piece: number, s0: number, s1: number, rFrom: number) => void) {
    let cur: { piece: number; s0: number; s1: number; r: number } | null = null;
    for (const sg of this.segsBetween(route, ra, rb)) {
      const a = Math.max(ra, sg.r0), b = Math.min(rb, sg.r1);
      if (b < a) continue;
      const sa = sOn(sg, a), sb = sOn(sg, b);
      if (cur && cur.piece === sg.piece) cur.s1 = sb;
      else {
        if (cur) cb(cur.piece, cur.s0, cur.s1, cur.r);
        cur = { piece: sg.piece, s0: sa, s1: sb, r: a };
      }
    }
    if (cur) cb(cur.piece, cur.s0, cur.s1, cur.r);
  }

  private *segsBetween(route: NetRoute, ra: number, rb: number) {
    const { segs } = route;
    let lo = 0, hi = segs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (segs[mid].r1 < ra) lo = mid + 1; else hi = mid;
    }
    for (let i = lo; i < segs.length && segs[i].r0 <= rb; i++) yield segs[i];
  }

  // ------------------------------------------------------------------ times
  // Seconds until the next train of `route` stands at its stop `k`, with that train; null if
  // none is due.
  nextAt(route: NetRoute, k: number): { eta: number; svc: Service | null } | null {
    let best: { eta: number; svc: Service | null } | null = null;
    const { sched } = route;
    for (const svc of this.trips) {
      if (svc.trip!.route !== route.name || svc.stop > k) continue;
      let eta: number;
      if (svc.stop === k && (svc.state === 'dwell' || svc.state === 'closing')) eta = 0;
      else {
        // how far into its run the trip is, by where it is
        let at: number;
        if (svc.state === 'dwell' || svc.state === 'closing') at = sched.arrive[svc.stop] + svc.timer;
        else {
          let i = 0, j = sched.heads.length - 1;
          while (i < j) { const m = (i + j) >> 1; if (sched.heads[m] < svc.head) i = m + 1; else j = m; }
          at = Math.max(i * FF_STEP, svc.stop > 0 ? sched.close[svc.stop - 1] : 0);
        }
        eta = Math.max(sched.arrive[k] - at, svc.trip!.spawn + sched.arrive[k] - this.clock);
      }
      if (!best || eta < best.eta) best = { eta, svc };
    }
    const t = Math.max(0, this.spawnTime(route, route.nextK) + sched.arrive[k] - this.clock);
    if (!best || t < best.eta) best = { eta: t, svc: null };
    return best;
  }

  // The rest of a ride beyond the end of the line: the trip that leaves from where it ended, in
  // the other direction, standing at the platform with its doors open. If its time hasn't come,
  // it sets off early.
  turn(svc: Service): Service | null {
    const route = this.route(svc).reverse;
    if (!route) return null;
    let next = this.trips.filter((t) => t.trip!.route === route.name && t.stop === 0 && t !== svc)
      .sort((a, b) => a.trip!.k - b.trip!.k)[0];
    if (!next) {
      next = this.trip(route, route.nextK, this.spawnTime(route, route.nextK));
      route.nextK++;
      this.trips.push(next);
    }
    if (next.state === 'run') {
      next.head = next.stops[0].head;
      next.state = 'dwell'; next.speed = 0; next.timer = 0;
    }
    if (next.state === 'dwell') {
      next.doors = 1;
      next.timer = Math.max(next.timer, 4);
    }
    return next;
  }
}

const braking = (v: number) => (v * v) / (2 * ACC);
const mod = (a: number, n: number) => ((a % n) + n) % n;
// a trip at the start of a route fed by trains turning there, until it is out of their way
const leaving = (svc: Service, route: NetRoute) => route.fed && svc.stop <= 1 && svc.head < route.stops[0].head + route.startClaim;
const sOn = (sg: NetRoute['segs'][number], r: number) => sg.s0 + ((sg.s1 - sg.s0) * (r - sg.r0)) / (sg.r1 - sg.r0 || 1);
const rOn = (sg: NetRoute['segs'][number], s: number) => sg.r0 + ((sg.r1 - sg.r0) * (s - sg.s0)) / (sg.s1 - sg.s0 || 1);
