// エフェクト(火花・砂煙・炎・衝撃波)
import * as THREE from 'three';

function radialTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
}

export class FX {
  constructor(scene) {
    this.scene = scene; this.tex = radialTex(); this.pool = []; this.live = [];
    for (let i = 0; i < 260; i++) {
      const m = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(m); s.visible = false; scene.add(s); this.pool.push({ s, v: new THREE.Vector3(), life: 0, max: 1, size: 1, grow: 0, g: 0, drag: 0 });
    }
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.85, 1, 48); ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffe0a0', transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      m.visible = false; scene.add(m); this.rings.push({ m, life: 0, max: 1, r0: 1, r1: 5 });
    }
    this.fireTimer = 0;
  }
  spawn(pos, o = {}) {
    const n = o.count || 8;
    for (let i = 0; i < n; i++) {
      const p = this.pool.pop(); if (!p) return;
      p.s.position.copy(pos); if (o.spread) p.s.position.add(new THREE.Vector3((Math.random() - 0.5) * o.spread, (Math.random() - 0.5) * o.spread * 0.5, (Math.random() - 0.5) * o.spread));
      const sp = (o.speed || 4) * (0.4 + Math.random() * 0.8);
      const th = Math.random() * Math.PI * 2, ph = (o.up ?? 0.5) + (Math.random() - 0.5) * (o.cone ?? 1.4);
      p.v.set(Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph)).multiplyScalar(sp);
      if (o.dir) p.v.addScaledVector(o.dir, o.dirK || 3);
      p.life = p.max = (o.life || 0.4) * (0.6 + Math.random() * 0.6); p.size = (o.size || 0.3) * (0.7 + Math.random() * 0.6); p.grow = o.grow || 0; p.g = o.gravity ?? 9; p.drag = o.drag ?? 2;
      p.s.material.color.set(o.color || '#ffd27a'); p.s.material.blending = o.normal ? THREE.NormalBlending : THREE.AdditiveBlending; p.s.material.opacity = 1;
      p.s.visible = true; p.s.scale.setScalar(p.size); this.live.push(p);
    }
  }
  hit(pos, heavy) { this.spawn(pos, { count: heavy ? 18 : 10, speed: heavy ? 8 : 6, life: 0.3, size: 0.35, color: '#ffe3a0', gravity: 6 }); this.spawn(pos, { count: 2, speed: 0.1, life: 0.12, size: heavy ? 2.2 : 1.4, color: '#fff6dd', gravity: 0 }); }
  blood(pos) { this.spawn(pos, { count: 6, speed: 3, life: 0.4, size: 0.18, color: '#c02a1a', normal: true, gravity: 12 }); }
  block(pos) { this.spawn(pos, { count: 12, speed: 7, life: 0.25, size: 0.22, color: '#bfe4ff', gravity: 4 }); }
  parry(pos) { this.spawn(pos, { count: 26, speed: 10, life: 0.4, size: 0.3, color: '#9fd8ff', gravity: 2 }); this.ring(pos, 0.3, 3.5, 0.35, '#bfe8ff'); }
  dust(pos, n = 4) { this.spawn(pos, { count: n, speed: 1.2, life: 0.6, size: 0.6, grow: 1.5, color: '#b8a888', normal: true, gravity: -0.5, up: 0.3 }); }
  ki(pos) { this.spawn(pos, { count: 3, speed: 1.5, life: 0.6, size: 0.35, color: '#7fd0ff', gravity: -3, spread: 1.0 }); }
  heal(pos) { this.spawn(pos, { count: 16, speed: 2, life: 0.9, size: 0.3, color: '#9cff9c', gravity: -3, spread: 1.0 }); }
  ring(pos, r0, r1, life, color) {
    const r = this.rings.find((x) => x.life <= 0) || this.rings[0];
    r.m.position.copy(pos); r.m.position.y += 0.15; r.r0 = r0; r.r1 = r1; r.life = r.max = life; r.m.material.color.set(color || '#ffe0a0'); r.m.visible = true;
  }
  update(dt, fires, camPos) {
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = 0.05;
      for (const f of fires) {
        if (f.distanceToSquared(camPos) > 90 * 90) continue;
        this.spawn(f, { count: 1, speed: 0.6, life: 0.7, size: 0.9, grow: -0.9, color: Math.random() < 0.5 ? '#ff8a2a' : '#ffc04a', gravity: -4, up: 1.4, cone: 0.4, spread: 0.6, drag: 1 });
      }
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]; p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; this.live.splice(i, 1); this.pool.push(p); continue; }
      p.v.y -= p.g * dt; p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt)); p.s.position.addScaledVector(p.v, dt);
      const k = p.life / p.max; p.s.material.opacity = Math.min(1, k * 1.5);
      p.s.scale.setScalar(Math.max(0.01, p.size * (1 + p.grow * (1 - k))));
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue; r.life -= dt; const k = 1 - r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * k; r.m.scale.set(rad, 1, rad); r.m.material.opacity = 1 - k;
      if (r.life <= 0) r.m.visible = false;
    }
  }
}
