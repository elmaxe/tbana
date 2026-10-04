import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createTrain } from './rolling-stock/index.js';

// Model viewer for the procedural C20 and C30 trains (trains.html).

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const SPECS = {
  C20: {
    title: 'C20',
    blurb: 'Three-section articulated unit with bare corrugated stainless-steel sides. Runs on all three lines; three units make a 140 m train.',
    rows: [
      ['Builder', 'Adtranz / Bombardier, Kalmar Verkstad'],
      ['Built', '1997–2004, 271 units (2000–2270)'],
      ['Unit', '3 cars, 46.5 m over couplers'],
      ['Width × height', '2.90 m × 3.68 m'],
      ['Bogies', '4 per unit; end cars rest on the middle car'],
      ['Doors per side', '7 double doors (2 + 3 + 2)'],
      ['Capacity', '126 seated, 288 standing'],
      ['Power', '1 MW, 750 V DC third rail'],
      ['Top speed', '90 km/h design, 80 km/h service'],
    ],
    dest: 'Skarpnäck',
  },
  C30: {
    title: 'C30',
    blurb: 'Bombardier MOVIA with open gangways through the whole unit and a smooth painted aluminium body. Two units make a 140 m train.',
    rows: [
      ['Builder', 'Bombardier, now Alstom (Hennigsdorf)'],
      ['In service', 'Red line since August 2020'],
      ['Unit', '4 cars (A1 B1 B2 A2), 70.0 m'],
      ['Car', '16.756 m, two FLEXX Eco bogies'],
      ['Width', '2.915 m'],
      ['Doors per side', '12 (3 per car)'],
      ['Capacity', 'about 140 seated, 634 total'],
      ['Top speed', '90 km/h design, 80 km/h service'],
    ],
    dest: 'Norsborg',
  },
};

// ------------------------------------------------------------------ renderer & scene
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, preserveDrawingBuffer: params.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc9d3dc);
scene.fog = new THREE.Fog(0xc9d3dc, 120, 420);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.9;

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 2;
controls.maxDistance = 320;

scene.add(new THREE.HemisphereLight(0xeef4ff, 0x6b6660, 0.8));
const sun = new THREE.DirectionalLight(0xfff6e8, 2.2);
sun.position.set(30, 60, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ------------------------------------------------------------------ ground: ballast, sleepers, rails
function track(len, z) {
  const g = new THREE.Group();
  const ballast = new THREE.Mesh(
    new THREE.BoxGeometry(len, 0.3, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x77736d, roughness: 1 }),
  );
  ballast.position.set(0, -0.32, z);
  ballast.receiveShadow = true;
  const sleeperGeo = new THREE.BoxGeometry(0.24, 0.16, 2.5);
  const sleepers = new THREE.InstancedMesh(sleeperGeo, new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.9 }), Math.floor(len / 0.65));
  const m = new THREE.Matrix4();
  for (let i = 0; i < sleepers.count; i++) sleepers.setMatrixAt(i, m.makeTranslation(-len / 2 + i * 0.65, -0.24, z));
  sleepers.receiveShadow = true;
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8c9196, roughness: 0.3, metalness: 0.9 });
  g.add(ballast, sleepers);
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.07), railMat);
    r.position.set(0, -0.08, z + s * 0.7525);
    r.receiveShadow = true;
    g.add(r);
  }
  // third rail on the far side, with its cover board
  const tr = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.08), railMat);
  tr.position.set(0, 0.14, z + 1.42);
  const cover = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.3), new THREE.MeshStandardMaterial({ color: 0xd8c690, roughness: 0.8 }));
  cover.position.set(0, 0.27, z + 1.44);
  g.add(tr, cover);
  return g;
}

// Platform top 0.99 m above the rail, edge 1.55 m from the track centre (as in the station).
function platform(len, z, w) {
  const h = 0.99 + 0.48;
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, w), new THREE.MeshStandardMaterial({ color: 0xb9b6b0, roughness: 0.9 }));
  m.position.set(0, 0.99 - h / 2, z);
  m.receiveShadow = true;
  const g = new THREE.Group();
  g.add(m);
  for (const s of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(len, 0.01, 0.1), new THREE.MeshStandardMaterial({ color: 0xf1f2ee, roughness: 0.8 }));
    edge.position.set(0, 0.995, z + s * (w / 2 - 0.3));
    g.add(edge);
  }
  return g;
}

const ground = new THREE.Mesh(new THREE.CircleGeometry(600, 64), new THREE.MeshStandardMaterial({ color: 0x9b9a93, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.48;
ground.receiveShadow = true;
scene.add(ground);

// ------------------------------------------------------------------ state
let state = {
  type: ['C20', 'C30', 'both'].includes(params.get('type')) ? params.get('type') : 'C30',
  full: params.get('len') === 'full',
  view: params.get('view') || 'front',
  spin: false,
};
let world = null;
let trains = [];

function build() {
  if (world) {
    scene.remove(world);
    world.traverse((o) => o.isInstancedMesh && o.dispose());
  }
  world = new THREE.Group();
  trains = [];
  const types = state.type === 'both' ? ['C20', 'C30'] : [state.type];
  let maxLen = 0;
  const made = types.map((t) => createTrain(t, { units: state.full ? undefined : 1, destination: SPECS[t].dest }));
  const front = Math.max(...made.map((t) => t.length)) / 2;
  made.forEach((train, i) => {
    // fronts line up at the platform end
    train.group.position.set(front - train.length / 2, 0, types.length > 1 ? (i ? 3.6 : -3.6) : 0);
    train.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    world.add(train.group);
    trains.push(train);
    maxLen = Math.max(maxLen, train.length);
  });
  const len = maxLen + 60;
  if (types.length > 1) {
    world.add(track(len, -3.6), track(len, 3.6), platform(len, 0, 2 * (3.6 - 1.55)));
  } else {
    world.add(track(len, 0), platform(len, -3.55, 4.0));
  }
  scene.add(world);
  // shadow camera covers the trains
  const s = sun.shadow.camera;
  const half = Math.max(30, maxLen / 2 + 8);
  s.left = -half; s.right = half; s.top = half; s.bottom = -half; s.near = 1; s.far = 200;
  s.updateProjectionMatrix();
  renderSpec(types);
  setView(state.view);
}

function renderSpec(types) {
  $('spec').innerHTML = types.map((t) => {
    const s = SPECS[t];
    return `<h2>${s.title}</h2><p>${s.blurb}</p><table>${s.rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
  }).join('') + '<p style="margin-top:10px">Sources: Wikipedia (SL C20, SL C30) and Wikimedia Commons photos. Notes: <a href="https://github.com/elmaxe/tbana/blob/main/docs/rolling-stock.md" target="_blank" rel="noopener">docs/rolling-stock.md</a>.</p>';
}

function setView(v) {
  state.view = v;
  const t = trains[0];
  const front = trains.length ? Math.max(...trains.map((x) => x.length)) / 2 : 20;
  const z0 = 0;
  const both = state.type === 'both';
  const views = {
    front: both ? [new THREE.Vector3(front + 11, 3.6, 0.6), new THREE.Vector3(front - 8, 1.8, 0)]
      : [new THREE.Vector3(front + 9, 3.4, 8.5), new THREE.Vector3(front - 6, 1.9, 0)],
    side: [new THREE.Vector3(front - 12, 2.2, both ? 30 : 19), new THREE.Vector3(front - 12, 1.9, 0)],
    bogie: [new THREE.Vector3(front - 1.0, 0.9, (both ? 3.6 : 0) + 4.2), new THREE.Vector3(front - 3.6, 0.6, both ? 3.6 : 0)],
    top: [new THREE.Vector3(front + 6, 14, 12), new THREE.Vector3(front - 10, 1.5, 0)],
    nose: [new THREE.Vector3(front + 5.5, 2.3, 2.6), new THREE.Vector3(front - 0.5, 2.0, 0)],
  };
  const [pos, target] = views[v] || views.front;
  camera.position.copy(pos);
  controls.target.copy(target);
  controls.update();
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
}

function syncButtons() {
  document.querySelectorAll('#types button').forEach((b) => b.classList.toggle('on', b.dataset.type === state.type));
  document.querySelectorAll('#lengths button').forEach((b) => b.classList.toggle('on', (b.dataset.len === 'full') === state.full));
  $('spin').classList.toggle('on', state.spin);
}

$('types').addEventListener('click', (e) => {
  const t = e.target.dataset?.type; if (!t) return;
  state.type = t; syncButtons(); build();
});
$('lengths').addEventListener('click', (e) => {
  const l = e.target.dataset?.len; if (!l) return;
  state.full = l === 'full'; syncButtons(); build();
});
$('views').addEventListener('click', (e) => {
  const v = e.target.dataset?.view; if (v) setView(v);
});
$('spin').addEventListener('click', () => { state.spin = !state.spin; controls.autoRotate = state.spin; syncButtons(); });
$('toggle').addEventListener('click', () => {
  const min = $('panel').classList.toggle('min');
  $('toggle').textContent = min ? '+' : '–';
});
$('glb').addEventListener('click', () => {
  const exporter = new GLTFExporter();
  const types = trains.map((t) => t.type).join('-');
  exporter.parse(trains.length > 1 ? world.children.filter((o) => trains.some((t) => t.group === o)) : trains[0].group, (buf) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
    a.download = `sl-${types.toLowerCase()}${state.full ? '-train' : ''}.glb`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, (err) => alert('Export failed: ' + err.message), { binary: true });
});
controls.autoRotateSpeed = 0.8;

syncButtons();
build();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
window.__viewer = { scene, camera, controls, setView, get trains() { return trains; } };
