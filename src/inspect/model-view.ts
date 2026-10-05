// A 3D model to turn round and look at, in the reference pane: Albert Guillaumes' model of a
// station. Drag to turn it, the wheel to zoom, right-drag to pan. It draws only when it moves.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class ModelView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.5, 5000);
  private controls: OrbitControls;
  private resize: ResizeObserver;
  private home: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private wire = false;

  constructor(private el: HTMLElement, url: string, private status: (text: string, bad?: boolean) => void) {
    const canvas = document.createElement('canvas');
    el.prepend(canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.background = new THREE.Color(0xf4f1ea);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(0.4, 1, 0.6);
    this.scene.add(sun);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.addEventListener('change', () => this.draw());
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(el);
    status('Loading the model…');
    new GLTFLoader().load(url, (gltf) => {
      this.scene.add(gltf.scene);
      // looking down on it from the south-east, all of it in view
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const centre = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
      this.camera.near = size / 500;
      this.camera.far = size * 10;
      this.home = { pos: centre.clone().add(new THREE.Vector3(0.45, 0.55, 0.7).multiplyScalar(size * 0.6)), target: centre };
      this.reset();
      status('');
    }, undefined, (err) => status(`Couldn't load the model: ${err instanceof Error ? err.message : String(err)}`, true));
  }

  reset() {
    if (!this.home) return;
    this.camera.position.copy(this.home.pos);
    this.controls.target.copy(this.home.target);
    this.controls.update();
    this.draw();
  }

  toggleWire() {
    this.wire = !this.wire;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) if ('wireframe' in mat) mat.wireframe = this.wire;
    });
    this.draw();
  }

  // to the pane's size (or the full window's, when enlarged)
  fit() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.draw();
  }

  private draw() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.resize.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      for (const mat of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) mat.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
