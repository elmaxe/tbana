// Fetches one of Albert Guillaumes' 3D station models (glTF with the data inline, listed in his
// site's js/dades.js) and writes it as binary glTF to public/assets/<name>.glb, which the game
// loads (public/data/stations.json says where each sits).
//
//   node tools/fetch-model.ts odenplan
//   node tools/fetch-model.ts fridhemsplan --file odenplan.gltf   (from a file instead)
//
// The models are © Albert Guillaumes (http://stations.albertguillaumes.cat/); his Stockholm
// stations with a model are T-Centralen, Odenplan and Fridhemsplan.
import { readFileSync, writeFileSync } from 'node:fs';

const SITE = 'http://estacions.albertguillaumes.cat/';
const name = process.argv[2];
if (!name || !/^[a-z0-9-]+$/.test(name)) {
  console.error('usage: node tools/fetch-model.ts <name> [--file <model.gltf>]');
  process.exit(1);
}
const fileArg = process.argv.indexOf('--file');
let text: string;
if (fileArg >= 0) text = readFileSync(process.argv[fileArg + 1], 'utf8');
else {
  const res = await fetch(`${SITE}3d/${name}.gltf`);
  if (!res.ok) throw new Error(`${SITE}3d/${name}.gltf: HTTP ${res.status}`);
  text = await res.text();
}

// The one buffer, inline as a data: URI, becomes the binary chunk.
const gltf = JSON.parse(text);
if (gltf.buffers?.length !== 1) throw new Error(`expected one buffer, found ${gltf.buffers?.length}`);
const uri: string = gltf.buffers[0].uri ?? '';
const m = /^data:[^;]*;base64,(.*)$/.exec(uri);
if (!m) throw new Error('expected the buffer inline, as base64');
const bin = Buffer.from(m[1], 'base64');
gltf.buffers[0] = { byteLength: bin.length };

// GLB: a 12-byte header, then the JSON chunk (padded with spaces) and the binary chunk (padded
// with zeros), each to 4 bytes.
const pad = (b: Buffer, fill: number) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, fill)]);
const json = pad(Buffer.from(JSON.stringify(gltf)), 0x20), data = pad(bin, 0);
const chunk = (type: number, body: Buffer) => {
  const head = Buffer.alloc(8);
  head.writeUInt32LE(body.length, 0);
  head.writeUInt32LE(type, 4);
  return Buffer.concat([head, body]);
};
const body = Buffer.concat([chunk(0x4e4f534a, json), chunk(0x004e4942, data)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // glTF
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + body.length, 8);
const out = `public/assets/${name}.glb`;
writeFileSync(out, Buffer.concat([header, body]));
console.log(`${out}: ${gltf.meshes?.length ?? 0} meshes, ${(12 + body.length) >> 10} kB`);
