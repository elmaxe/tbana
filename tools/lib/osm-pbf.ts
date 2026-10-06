// A small reader for OpenStreetMap's PBF format (https://wiki.openstreetmap.org/wiki/PBF_Format),
// enough for the tools to read a regional extract: nodes (plain and dense), ways and relations
// with their tags. Blocks are inflated one at a time, and each pass over the file calls back only
// for the kinds of element asked for, so a county's extract can be read in a few passes without
// holding it in memory.
import { openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export interface PbfNode { id: number; lat: number; lon: number; tags: Record<string, string> | null }
export interface PbfWay { id: number; refs: number[]; tags: Record<string, string> }
export interface PbfMember { type: 'node' | 'way' | 'relation'; ref: number; role: string }
export interface PbfRelation { id: number; members: PbfMember[]; tags: Record<string, string> }

export interface PbfHandlers {
  node?: (n: PbfNode) => void;
  way?: (w: PbfWay) => void;
  relation?: (r: PbfRelation) => void;
}

// ------------------------------------------------------------------ protobuf
// (tools/lib/mapillary.ts reads Mapillary's vector tiles with it too)
export class Reader {
  buf: Uint8Array;
  pos: number;
  end: number;
  constructor(buf: Uint8Array, start = 0, end = buf.length) { this.buf = buf; this.pos = start; this.end = end; }
  get done() { return this.pos >= this.end; }
  varint(): number {
    // up to 64 bits, as a double: exact below 2^53, which covers every OSM id and coordinate
    let result = 0, mul = 1, b: number;
    do {
      b = this.buf[this.pos++];
      result += (b & 0x7f) * mul;
      mul *= 128;
    } while (b & 0x80);
    return result;
  }
  svarint() {
    const v = this.varint();
    // zigzag: even → v / 2, odd → −(v + 1) / 2
    return v % 2 === 0 ? v / 2 : -(v + 1) / 2;
  }
  bytes(): Uint8Array {
    const len = this.varint();
    const out = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }
  skip(wire: number) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) { const len = this.varint(); this.pos += len; }
    else if (wire === 5) this.pos += 4;
    else throw new Error(`protobuf: wire type ${wire}`);
  }
  // fields of a message: calls fn(field, wire) for each, which must read or skip it
  fields(fn: (field: number, wire: number) => boolean | void) {
    while (!this.done) {
      const key = this.varint();
      const field = Math.floor(key / 8), wire = key & 7;
      if (!fn(field, wire)) this.skip(wire);
    }
  }
  packed(signed: boolean): number[] {
    const r = new Reader(this.buf, 0);
    const len = this.varint();
    r.pos = this.pos;
    r.end = this.pos + len;
    this.pos += len;
    const out: number[] = [];
    while (!r.done) out.push(signed ? r.svarint() : r.varint());
    return out;
  }
}

const text = new TextDecoder();

// ------------------------------------------------------------------ blocks
interface Block { strings: string[]; granularity: number; latOffset: number; lonOffset: number; groups: Uint8Array[] }

function readBlock(data: Uint8Array): Block {
  const r = new Reader(data);
  const block: Block = { strings: [], granularity: 100, latOffset: 0, lonOffset: 0, groups: [] };
  r.fields((f, w) => {
    if (f === 1 && w === 2) {
      const st = new Reader(r.bytes());
      st.fields((sf, sw) => {
        if (sf === 1 && sw === 2) { block.strings.push(text.decode(st.bytes())); return true; }
        return false;
      });
      return true;
    }
    if (f === 2 && w === 2) { block.groups.push(r.bytes()); return true; }
    if (f === 17) { block.granularity = r.varint(); return true; }
    if (f === 19) { block.latOffset = r.varint(); return true; }
    if (f === 20) { block.lonOffset = r.varint(); return true; }
    return false;
  });
  return block;
}

function tagsOf(block: Block, keys: number[], vals: number[]) {
  const tags: Record<string, string> = {};
  for (let i = 0; i < keys.length; i++) tags[block.strings[keys[i]]] = block.strings[vals[i]];
  return tags;
}

function readGroup(block: Block, data: Uint8Array, h: PbfHandlers) {
  const r = new Reader(data);
  const lat = (v: number) => 1e-9 * (block.latOffset + block.granularity * v);
  const lon = (v: number) => 1e-9 * (block.lonOffset + block.granularity * v);
  r.fields((f, w) => {
    if (w !== 2) return false;
    if (f === 1 && h.node) {
      const m = new Reader(r.bytes());
      let id = 0, la = 0, lo = 0, keys: number[] = [], vals: number[] = [];
      m.fields((mf) => {
        if (mf === 1) { id = m.svarint(); return true; }
        if (mf === 2) { keys = m.packed(false); return true; }
        if (mf === 3) { vals = m.packed(false); return true; }
        if (mf === 8) { la = m.svarint(); return true; }
        if (mf === 9) { lo = m.svarint(); return true; }
        return false;
      });
      h.node({ id, lat: lat(la), lon: lon(lo), tags: keys.length ? tagsOf(block, keys, vals) : null });
      return true;
    }
    if (f === 2 && h.node) {
      const m = new Reader(r.bytes());
      let ids: number[] = [], las: number[] = [], los: number[] = [], kv: number[] = [];
      m.fields((mf) => {
        if (mf === 1) { ids = m.packed(true); return true; }
        if (mf === 8) { las = m.packed(true); return true; }
        if (mf === 9) { los = m.packed(true); return true; }
        if (mf === 10) { kv = m.packed(false); return true; }
        return false;
      });
      let id = 0, la = 0, lo = 0, k = 0;
      for (let i = 0; i < ids.length; i++) {
        id += ids[i]; la += las[i]; lo += los[i];
        let tags: Record<string, string> | null = null;
        if (kv.length) {
          while (kv[k] !== 0) {
            (tags ??= {})[block.strings[kv[k]]] = block.strings[kv[k + 1]];
            k += 2;
          }
          k++;
        }
        h.node({ id, lat: lat(la), lon: lon(lo), tags });
      }
      return true;
    }
    if (f === 3 && h.way) {
      const m = new Reader(r.bytes());
      let id = 0, keys: number[] = [], vals: number[] = [], refs: number[] = [];
      m.fields((mf) => {
        if (mf === 1) { id = m.varint(); return true; }
        if (mf === 2) { keys = m.packed(false); return true; }
        if (mf === 3) { vals = m.packed(false); return true; }
        if (mf === 8) { refs = m.packed(true); return true; }
        return false;
      });
      for (let i = 1; i < refs.length; i++) refs[i] += refs[i - 1];
      h.way({ id, refs, tags: tagsOf(block, keys, vals) });
      return true;
    }
    if (f === 4 && h.relation) {
      const m = new Reader(r.bytes());
      let id = 0, keys: number[] = [], vals: number[] = [], roles: number[] = [], mems: number[] = [], types: number[] = [];
      m.fields((mf) => {
        if (mf === 1) { id = m.varint(); return true; }
        if (mf === 2) { keys = m.packed(false); return true; }
        if (mf === 3) { vals = m.packed(false); return true; }
        if (mf === 8) { roles = m.packed(false); return true; }
        if (mf === 9) { mems = m.packed(true); return true; }
        if (mf === 10) { types = m.packed(false); return true; }
        return false;
      });
      let ref = 0;
      const members = mems.map((d, i): PbfMember => {
        ref += d;
        return { type: (['node', 'way', 'relation'] as const)[types[i]], ref, role: block.strings[roles[i]] };
      });
      h.relation({ id, members, tags: tagsOf(block, keys, vals) });
      return true;
    }
    return false;
  });
}

// Reads the file at `path`, calling the handlers for each element in file order (nodes, then
// ways, then relations, as extracts are sorted).
export function readPbf(path: string, h: PbfHandlers) {
  const fd = openSync(path, 'r');
  const size = fstatSync(fd).size;
  const lenBuf = Buffer.alloc(4);
  let pos = 0;
  try {
    while (pos < size) {
      readSync(fd, lenBuf, 0, 4, pos);
      const headerLen = lenBuf.readUInt32BE(0);
      pos += 4;
      const header = Buffer.alloc(headerLen);
      readSync(fd, header, 0, headerLen, pos);
      pos += headerLen;
      let type = '', dataSize = 0;
      const hr = new Reader(header);
      hr.fields((f, w) => {
        if (f === 1 && w === 2) { type = text.decode(hr.bytes()); return true; }
        if (f === 3) { dataSize = hr.varint(); return true; }
        return false;
      });
      const blob = Buffer.alloc(dataSize);
      readSync(fd, blob, 0, dataSize, pos);
      pos += dataSize;
      if (type !== 'OSMData') continue;
      let data: Uint8Array | null = null;
      const br = new Reader(blob);
      br.fields((f, w) => {
        if (f === 1 && w === 2) { data = br.bytes(); return true; }
        if (f === 3 && w === 2) { data = inflateSync(br.bytes()); return true; }
        if (f >= 4 && w === 2) throw new Error(`${path}: blob compression ${f} is not supported`);
        return false;
      });
      if (!data) continue;
      const block = readBlock(data);
      for (const g of block.groups) readGroup(block, g, h);
    }
  } finally {
    closeSync(fd);
  }
}
