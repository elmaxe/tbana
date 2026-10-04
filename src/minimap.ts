import * as THREE from 'three';

export interface MapPlayer { pos: THREE.Vector3; yaw: number }
export interface MapMarker { x: number; z: number; color: string }

// Renders the plan once (top-down, north up) and draws it as a minimap / full map with the player.
export class MiniMap {
  mini: HTMLCanvasElement;
  big: HTMLCanvasElement;
  x0: number; x1: number; z0: number; z1: number;
  W: number; H: number;
  image: HTMLCanvasElement;

  constructor(renderer: THREE.WebGLRenderer, mapGroup: THREE.Object3D, bounds: THREE.Box3, mini: HTMLCanvasElement, big: HTMLCanvasElement) {
    this.mini = mini;
    this.big = big;
    const pad = 10;
    this.x0 = bounds.min.x - pad; this.x1 = bounds.max.x + pad;
    this.z0 = bounds.min.z - pad; this.z1 = bounds.max.z + pad;
    const W = 2048, H = Math.round((W * (this.z1 - this.z0)) / (this.x1 - this.x0));
    this.W = W; this.H = H;

    const scene = new THREE.Scene();
    scene.add(mapGroup);
    const cam = new THREE.OrthographicCamera(this.x0, this.x1, -this.z0, -this.z1, 1, 2000);
    cam.position.set(0, 900, 0);
    cam.up.set(0, 0, -1);
    cam.lookAt(0, 0, 0);
    // With up = -z the view's vertical axis is -z, so the frustum's top/bottom are -z0 / -z1.
    const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    const px = new Uint8Array(W * H * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    renderer.setRenderTarget(null);
    renderer.setClearColor(prevClear, prevAlpha);
    rt.dispose();

    this.image = document.createElement('canvas');
    this.image.width = W; this.image.height = H;
    const ctx = this.image.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    }
    ctx.putImageData(img, 0, 0);
  }

  toPx(x: number, z: number): [number, number] {
    return [((x - this.x0) / (this.x1 - this.x0)) * this.W, ((z - this.z0) / (this.z1 - this.z0)) * this.H];
  }

  drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, yaw: number, size: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-yaw);
    ctx.fillStyle = '#ff3b30';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -size); ctx.lineTo(size * 0.7, size * 0.75); ctx.lineTo(0, size * 0.35); ctx.lineTo(-size * 0.7, size * 0.75);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  draw(player: MapPlayer, extra: MapMarker[] = []) {
    const c = this.mini, ctx = c.getContext('2d')!;
    const S = c.width;
    const [px, py] = this.toPx(player.pos.x, player.pos.z);
    const zoom = 1.5; // canvas px per map px
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(14,17,23,0.85)'; ctx.fillRect(0, 0, S, S);
    const span = S / zoom;
    ctx.drawImage(this.image, px - span / 2, py - span / 2, span, span, 0, 0, S, S);
    for (const e of extra) {
      const [ex, ey] = this.toPx(e.x, e.z);
      ctx.fillStyle = e.color;
      ctx.fillRect((ex - px) * zoom + S / 2 - 3, (ey - py) * zoom + S / 2 - 3, 6, 6);
    }
    ctx.restore();
    this.drawPlayer(ctx, S / 2, S / 2, player.yaw, 9);
    ctx.fillStyle = '#fff'; ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N', S / 2, 16);
  }

  drawBig(player: MapPlayer) {
    const c = this.big, ctx = c.getContext('2d')!;
    const w = c.width, h = c.height;
    const s = Math.min(w / this.W, h / this.H) * 0.96;
    const ox = (w - this.W * s) / 2, oy = (h - this.H * s) / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.image, ox, oy, this.W * s, this.H * s);
    const [px, py] = this.toPx(player.pos.x, player.pos.z);
    this.drawPlayer(ctx, ox + px * s, oy + py * s, player.yaw, 14);
    ctx.fillStyle = '#fff'; ctx.font = '600 22px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N ↑', 40, 40);
  }
}
