// Reading the points of a cloud optimized point cloud (COPC: LAZ with an octree index) over the
// network, only the octree's nodes over a box, with ranged requests.
//
// A COPC file's points are spread over an octree: the root node holds a thin sample of the whole
// file, each level below twice as dense over a cube half the size, so the points over a box are
// those of every node, at every level, whose cube reaches it. The hierarchy (which nodes there are,
// and where their points are in the file) is read once a file, its pages as they are needed.
import { Copc, Hierarchy } from 'copc';
import type { Getter } from 'copc';

export interface CopcFile {
  url: string;
  copc: Copc;
  get: Getter;
  nodes: Map<string, Hierarchy.Node>;
  pages: Map<string, Hierarchy.Page>;
}

// The file's header and its whole hierarchy (all its pages).
export async function openCopc(url: string, headers: Record<string, string> = {}): Promise<CopcFile> {
  const get: Getter = async (begin, end) => {
    const res = await fetch(url, { headers: { ...headers, Range: `bytes=${begin}-${end - 1}` } });
    if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    // a server that ignores the range sends the whole file
    return res.status === 206 ? buf : buf.subarray(begin, end);
  };
  const copc = await Copc.create(get);
  const nodes = new Map<string, Hierarchy.Node>(), pages = new Map<string, Hierarchy.Page>();
  const todo = [copc.info.rootHierarchyPage];
  while (todo.length) {
    const sub = await Copc.loadHierarchyPage(get, todo.pop()!);
    for (const [k, n] of Object.entries(sub.nodes)) if (n && n.pointCount) nodes.set(k, n);
    for (const [k, p] of Object.entries(sub.pages)) if (p) { pages.set(k, p); todo.push(p); }
  }
  return { url, copc, get, nodes, pages };
}

// A node's square in plan, from its key ("depth-x-y-z") and the file's cube.
export function nodeBox(file: CopcFile, key: string): [number, number, number, number] {
  const [d, x, y] = key.split('-').map(Number);
  const [x0, y0, , x1] = file.copc.info.cube;
  const size = (x1 - x0) / 2 ** d;
  return [x0 + x * size, y0 + y * size, x0 + (x + 1) * size, y0 + (y + 1) * size];
}

// The nodes whose squares reach the box ([min x, min y, max x, max y] in the file's coordinates).
export function nodesOver(file: CopcFile, box: [number, number, number, number]) {
  const keys: string[] = [];
  for (const key of file.nodes.keys()) {
    const [a, b, c, d] = nodeBox(file, key);
    if (a <= box[2] && c >= box[0] && b <= box[3] && d >= box[1]) keys.push(key);
  }
  return keys;
}

export interface Points { count: number; x: Float64Array; y: Float64Array; z: Float32Array; cls: Uint8Array }

// A node's points: x, y and z in the file's coordinates, and each one's class.
export async function readNode(file: CopcFile, key: string): Promise<Points> {
  const node = file.nodes.get(key);
  if (!node) throw new Error(`${file.url}: no node ${key}`);
  const view = await Copc.loadPointDataView(file.get, file.copc, node, { include: ['X', 'Y', 'Z', 'Classification'] });
  const n = view.pointCount;
  const gx = view.getter('X'), gy = view.getter('Y'), gz = view.getter('Z'), gc = view.getter('Classification');
  const out: Points = { count: n, x: new Float64Array(n), y: new Float64Array(n), z: new Float32Array(n), cls: new Uint8Array(n) };
  for (let k = 0; k < n; k++) { out.x[k] = gx(k); out.y[k] = gy(k); out.z[k] = gz(k); out.cls[k] = gc(k); }
  return out;
}
