// キャラクターモデルと手続き的アニメーション
import * as THREE from 'three';
import { clamp, damp } from './util.js';

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cap: new THREE.CapsuleGeometry(1, 1, 3, 8),
  sph: new THREE.SphereGeometry(1, 12, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  skirt: new THREE.CylinderGeometry(0.8, 1, 1, 12, 1, true),
  torus: new THREE.TorusGeometry(1, 0.18, 6, 16),
  cone: new THREE.ConeGeometry(1, 1, 8),
};
const ease = (t) => t * t * (3 - 2 * t);
const seg = (a, a0, a1) => ease(clamp((a - a0) / (a1 - a0), 0, 1));

class MatSet {
  constructor() { this.map = new Map(); }
  get(color, opts = {}) {
    const k = color + JSON.stringify(opts);
    if (!this.map.has(k)) this.map.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts }));
    return this.map.get(k);
  }
  flash(v, color = '#ff5533') {
    for (const m of this.map.values()) { m.emissive.set(color); m.emissiveIntensity = v; }
  }
  setOpacity(o) { for (const m of this.map.values()) { m.transparent = o < 1; m.opacity = o; } }
}

function mesh(geo, mat, sx, sy, sz, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; return m;
}

const POSE_KEYS = ['bodyX', 'bodyY', 'bodyZ', 'spin', 'chestX', 'chestY', 'chestZ', 'headX', 'headY',
  'lShX', 'lShY', 'lShZ', 'lElX', 'rShX', 'rShY', 'rShZ', 'rElX', 'lHipX', 'lHipZ', 'lKnX', 'rHipX', 'rHipZ', 'rKnX', 'sockX', 'sockZ'];
function addR(parent, m, rx, ry, rz) { m.rotation.set(rx, ry, rz); parent.add(m); return m; }
const zeroPose = () => Object.fromEntries(POSE_KEYS.map((k) => [k, 0]));

// ---------------- 人型 ----------------
export class Humanoid {
  constructor(o = {}) {
    const opt = Object.assign({ skin: '#d6a27a', robe: '#cdbb92', sleeve: null, belt: '#3b2c1f', hair: '#16110d', pants: null, legs: null,
      headband: null, scarf: null, scale: 1, build: 1, weapon: null, beard: false, topknot: true, hat: null, skirt: true }, o);
    this.opt = opt;
    const mats = (this.mats = new MatSet());
    const skin = mats.get(opt.skin), robe = mats.get(opt.robe), sleeve = mats.get(opt.sleeve || opt.robe), belt = mats.get(opt.belt), hair = mats.get(opt.hair);
    const legMat = mats.get(opt.legs || opt.pants || opt.skin), b = opt.build;
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.body.position.y = 0.95; this.root.add(this.body);
    this.hips = new THREE.Group(); this.hips.position.y = 0.05; this.body.add(this.hips);
    this.chest = new THREE.Group(); this.chest.position.y = 0.05; this.hips.add(this.chest);
    this.chest.add(mesh(GEO.box, robe, 0.46 * b, 0.62, 0.28 * b, 0, 0.33, 0));
    this.chest.add(mesh(GEO.box, robe, 0.5 * b, 0.2, 0.3 * b, 0, 0.55, -0.01)); // 肩
    this.chest.add(mesh(GEO.box, belt, 0.49 * b, 0.11, 0.31 * b, 0, 0.06, 0));
    // 着物の合わせ
    this.chest.add(mesh(GEO.box, mats.get('#2b2018'), 0.04, 0.5, 0.01, 0.05, 0.36, 0.142 * b));
    if (opt.skirt) this.hips.add(mesh(GEO.skirt, robe, 0.27 * b, 0.55, 0.22 * b, 0, -0.25, 0));
    else this.hips.add(mesh(GEO.box, legMat, 0.4 * b, 0.22, 0.26 * b, 0, -0.06, 0));
    this.chest.add(mesh(GEO.cyl, skin, 0.07, 0.12, 0.07, 0, 0.7, 0));
    this.head = new THREE.Group(); this.head.position.y = 0.76; this.chest.add(this.head);
    this.head.add(mesh(GEO.box, skin, 0.24, 0.28, 0.26, 0, 0.13, 0));
    this.head.add(mesh(GEO.box, hair, 0.26, 0.1, 0.28, 0, 0.27, -0.01));
    this.head.add(mesh(GEO.box, hair, 0.26, 0.24, 0.06, 0, 0.16, -0.13));
    const eye = mats.get('#1a1410');
    for (const s of [-1, 1]) this.head.add(mesh(GEO.box, eye, 0.04, 0.025, 0.02, s * 0.06, 0.15, 0.13));
    this.head.add(mesh(GEO.box, hair, 0.16, 0.025, 0.02, 0, 0.19, 0.13)); // 眉
    if (opt.topknot && !opt.scarf && !opt.hat) {
      // カタカシラ(結髪)とジーファー(簪)
      this.head.add(mesh(GEO.sph, hair, 0.075, 0.075, 0.075, 0, 0.36, -0.02));
      addR(this.head, mesh(GEO.cyl, mats.get('#c9b27a', { metalness: 0.6, roughness: 0.4 }), 0.012, 0.22, 0.012, 0, 0.37, -0.02), 0, 0, Math.PI / 2);
    }
    if (opt.headband) { const t = mesh(GEO.torus, mats.get(opt.headband), 0.14, 0.14, 0.12, 0, 0.22, 0); t.rotation.x = Math.PI / 2; this.head.add(t);
      addR(this.head, mesh(GEO.box, mats.get(opt.headband), 0.03, 0.2, 0.05, 0.05, 0.12, -0.15), 0, 0, 0.4); }
    if (opt.scarf) { this.head.add(mesh(GEO.box, mats.get(opt.scarf), 0.28, 0.14, 0.3, 0, 0.28, 0)); addR(this.head, mesh(GEO.box, mats.get(opt.scarf), 0.06, 0.25, 0.04, -0.06, 0.15, -0.16), 0, 0, 0.3); }
    if (opt.hat) { const h = mesh(GEO.cone, mats.get(opt.hat), 0.3, 0.16, 0.3, 0, 0.36, 0); this.head.add(h); }
    if (opt.beard) this.head.add(mesh(GEO.box, hair, 0.24, 0.12, 0.08, 0, 0.02, 0.11));
    // 腕
    const mkArm = (s) => {
      const sh = new THREE.Group(); sh.position.set(s * 0.29 * b, 0.56, 0); this.chest.add(sh);
      sh.add(mesh(GEO.cap, sleeve, 0.075 * b, 0.12, 0.075 * b, 0, -0.14, 0));
      const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
      el.add(mesh(GEO.cap, skin, 0.058 * b, 0.11, 0.058 * b, 0, -0.13, 0));
      const hand = new THREE.Group(); hand.position.y = -0.29; el.add(hand);
      hand.add(mesh(GEO.box, skin, 0.09, 0.1, 0.09, 0, 0, 0));
      return { sh, el, hand };
    };
    this.lArm = mkArm(1); this.rArm = mkArm(-1);
    // 脚
    const mkLeg = (s) => {
      const hip = new THREE.Group(); hip.position.set(s * 0.11 * b, 0, 0); this.hips.add(hip);
      hip.add(mesh(GEO.cap, opt.pants ? legMat : robe, 0.085 * b, 0.26, 0.085 * b, 0, -0.22, 0));
      const kn = new THREE.Group(); kn.position.y = -0.45; hip.add(kn);
      kn.add(mesh(GEO.cap, legMat, 0.07 * b, 0.26, 0.07 * b, 0, -0.21, 0));
      kn.add(mesh(GEO.box, mats.get('#5b4630'), 0.11, 0.06, 0.25, 0, -0.46, 0.05));
      return { hip, kn };
    };
    this.lLeg = mkLeg(1); this.rLeg = mkLeg(-1);
    // 武器ソケット(右手)
    this.sock = new THREE.Group(); this.rArm.hand.add(this.sock);
    this.weapon = null; this.setWeapon(opt.weapon);
    this.root.scale.setScalar(opt.scale);
    this.pose = zeroPose(); this.target = zeroPose();
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  setWeapon(kind) {
    if (this.weapon) { this.sock.remove(this.weapon); this.weapon = null; }
    this.weaponKind = kind;
    if (!kind) return;
    const g = new THREE.Group(), m = this.mats;
    if (kind === 'bo') {
      g.add(mesh(GEO.cyl, m.get('#7b5532'), 0.035, 1.9, 0.035, 0, -0.55, 0));
    } else if (kind === 'sword' || kind === 'bigsword') {
      const k = kind === 'bigsword' ? 1.45 : 1;
      g.add(mesh(GEO.cyl, m.get('#2a1d14'), 0.03, 0.22, 0.03, 0, 0, 0));
      g.add(mesh(GEO.box, m.get('#8a7a4a', { metalness: 0.7, roughness: 0.3 }), 0.16, 0.03, 0.08, 0, -0.12, 0));
      g.add(mesh(GEO.box, m.get('#d8dde2', { metalness: 0.9, roughness: 0.25 }), 0.05 * k, 0.9 * k, 0.012 * k, 0, -0.12 - 0.45 * k, 0));
    } else if (kind === 'club') {
      g.add(mesh(GEO.cyl, m.get('#5a3d22'), 0.05, 1.0, 0.05, 0, -0.4, 0));
      g.add(mesh(GEO.cyl, m.get('#4a3019'), 0.09, 0.4, 0.09, 0, -0.8, 0));
    } else if (kind === 'oar') {
      g.add(mesh(GEO.cyl, m.get('#8a6a44'), 0.035, 1.8, 0.035, 0, -0.6, 0));
      g.add(mesh(GEO.box, m.get('#8a6a44'), 0.18, 0.5, 0.03, 0, -1.4, 0));
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.weapon = g; this.sock.add(g);
  }

  // s: { t, speed(0..1), phase, air, guard, action, a(0..1), weapon }
  animate(dt, s) {
    const T = this.target; for (const k of POSE_KEYS) T[k] = 0;
    const t = s.t, m = clamp(s.speed || 0, 0, 1), ph = s.phase || 0, wb = this.weaponKind;
    // 基本:待機/移動
    T.chestX = 0.03 * Math.sin(t * 2); T.lShZ = 0.1; T.rShZ = -0.1; T.lElX = -0.15; T.rElX = -0.15;
    if (s.guard && m < 0.5) {
      T.lShX = -1.0; T.lElX = -1.5; T.lShZ = -0.15; T.rShX = -0.8; T.rElX = -1.7; T.rShZ = 0.15; T.chestY = 0.15;
      T.lHipX = -0.3; T.rHipX = 0.25; T.lKnX = 0.35; T.rKnX = 0.3; T.bodyY = -0.06;
      if (wb === 'bo') { T.rShX = -0.7; T.rElX = -0.9; T.lShX = -0.9; T.lElX = -0.9; T.sockX = -1.2; }
      else if (wb) { T.rShX = -0.6; T.rElX = -0.9; T.sockX = -0.9; }
    } else if (wb === 'bo') T.sockX = -2.4; else if (wb) T.sockX = -0.6;
    if (m > 0.01) {
      const sn = Math.sin(ph), cs = Math.cos(ph);
      T.rHipX = sn * 0.85 * m; T.lHipX = -sn * 0.85 * m;
      T.rKnX = Math.max(0, cs) * 1.2 * m + 0.1; T.lKnX = Math.max(0, -cs) * 1.2 * m + 0.1;
      if (!s.guard || m >= 0.5) { T.rShX = -sn * 0.8 * m; T.lShX = sn * 0.8 * m; T.rElX = -0.5 * m - 0.1; T.lElX = -0.5 * m - 0.1; }
      T.chestX += 0.18 * m; T.bodyY = -Math.abs(Math.sin(ph)) * 0.07 * m; T.chestY += sn * 0.12 * m;
    }
    if (s.air) { T.lHipX = -0.7; T.rHipX = -0.2; T.lKnX = 1.1; T.rKnX = 0.6; T.lShX = -0.5; T.rShX = -0.5; T.lShZ = 0.5; T.rShZ = -0.5; }
    // アクション
    let lam = 16;
    const a = s.a || 0;
    switch (s.action) {
      case 'punchR': case 'punchL': {
        const R = s.action === 'punchR'; const w = seg(a, 0, 0.25), k = seg(a, 0.22, 0.45), back = seg(a, 0.7, 1);
        const twist = (-0.35 * w + 0.8 * k) * (1 - back);
        T.chestY = R ? twist : -twist; T.chestX = 0.1;
        const pX = -0.6 * w * (1 - k) - 1.55 * k * (1 - back) + (-1.0) * back, pE = -1.8 * w * (1 - k) - 1.5 * back;
        const gX = -1.0, gE = -1.5;
        if (R) { T.rShX = pX; T.rElX = pE; T.rShZ = 0.1; T.lShX = gX; T.lElX = gE; } else { T.lShX = pX; T.lElX = pE; T.lShZ = -0.1; T.rShX = gX; T.rElX = gE; }
        T.lHipX = -0.45; T.rHipX = 0.35; T.lKnX = 0.4; T.rKnX = 0.25; T.bodyY = -0.08; lam = 30;
        break;
      }
      case 'kick': {
        const w = seg(a, 0, 0.3), k = seg(a, 0.3, 0.5), back = seg(a, 0.72, 1);
        T.rHipX = (-1.2 * w - 0.5 * k) * (1 - back); T.rKnX = (1.7 * w - 1.6 * k) * (1 - back) + 0.1;
        T.lKnX = 0.25; T.chestX = -0.25 * (1 - back); T.lShX = -1.0; T.lElX = -1.5; T.rShX = -0.6; T.rElX = -1.4; T.rShZ = -0.5;
        lam = 28; break;
      }
      case 'boSwingR': case 'boSwingL': {
        const R = s.action === 'boSwingR'; const w = seg(a, 0, 0.3), k = seg(a, 0.3, 0.55), back = seg(a, 0.75, 1);
        const tw = (-1.3 * w + 2.6 * k) * (1 - back) - (back > 0 ? 0 : 0);
        T.chestY = R ? tw : -tw; T.chestX = 0.15;
        T.rShX = -1.25; T.lShX = -1.25; T.rElX = -0.35; T.lElX = -0.35; T.rShZ = 0.35; T.lShZ = -0.35; T.sockX = 0.05; T.sockZ = R ? 0.3 : -0.3;
        T.lHipX = -0.5; T.rHipX = 0.35; T.lKnX = 0.45; T.rKnX = 0.3; T.bodyY = -0.1; lam = 26; break;
      }
      case 'boThrust': case 'thrust': {
        const w = seg(a, 0, 0.35), k = seg(a, 0.35, 0.5), back = seg(a, 0.75, 1);
        T.chestY = (-0.6 * w + 0.8 * k) * (1 - back); T.chestX = (0.35 * k) * (1 - back);
        T.rShX = -0.5 * w * (1 - k) - 1.55 * k * (1 - back) - 0.6 * back; T.rElX = -1.4 * w * (1 - k);
        T.lShX = -1.0 - 0.4 * k; T.lElX = -0.8 * (1 - k); T.sockX = 0.0;
        T.lHipX = -0.7 * k - 0.2; T.rHipX = 0.5 * k + 0.2; T.lKnX = 0.6; T.rKnX = 0.2; T.bodyY = -0.12 * k; lam = 30; break;
      }
      case 'slash': {
        const w = seg(a, 0, 0.5), k = seg(a, 0.5, 0.62), back = seg(a, 0.75, 1);
        T.rShX = -2.7 * w * (1 - k) - 0.5 * k * (1 - back) - 0.4 * back; T.rElX = -0.8 * w * (1 - k); T.rShZ = -0.2 * w;
        T.chestY = -0.35 * w * (1 - k) + 0.45 * k * (1 - back); T.chestX = -0.15 * w * (1 - k) + 0.4 * k * (1 - back);
        T.lShX = -0.6; T.lElX = -1.0; T.sockX = -0.4 + 0.2 * k;
        T.lHipX = -0.4; T.rHipX = 0.3; T.lKnX = 0.4 + 0.2 * k; T.rKnX = 0.25; T.bodyY = -0.1 * k; lam = 22; break;
      }
      case 'slam': {
        const w = seg(a, 0, 0.5), k = seg(a, 0.5, 0.62), back = seg(a, 0.8, 1);
        const up = -2.9 * w * (1 - k) - 0.7 * k * (1 - back);
        T.rShX = up; T.lShX = up; T.rElX = -0.5 * w * (1 - k); T.lElX = -0.5 * w * (1 - k); T.rShZ = 0.3; T.lShZ = -0.3;
        T.chestX = -0.25 * w * (1 - k) + 0.6 * k * (1 - back); T.bodyY = 0.08 * w * (1 - k) - 0.3 * k * (1 - back);
        T.lKnX = 0.6 * k; T.rKnX = 0.6 * k; T.lHipX = -0.5 * k; T.rHipX = -0.5 * k; T.sockX = -0.3; lam = 22; break;
      }
      case 'throw': {
        const w = seg(a, 0, 0.55), k = seg(a, 0.55, 0.7), back = seg(a, 0.8, 1);
        T.rShX = -2.6 * w * (1 - k) - 1.0 * k * (1 - back); T.rElX = -1.3 * w * (1 - k); T.chestY = -0.5 * w * (1 - k) + 0.45 * k * (1 - back);
        T.lShX = -1.0 * w; T.lShZ = 0.4; T.lHipX = -0.4; T.rHipX = 0.3; T.lKnX = 0.3; lam = 24; break;
      }
      case 'spin': {
        T.spin = a * Math.PI * 4; T.lShZ = 1.45; T.rShZ = -1.45; T.lElX = -0.1; T.rElX = -0.1; T.lKnX = 0.5; T.rKnX = 0.5; T.lHipX = -0.3; T.rHipX = -0.3; T.bodyY = -0.1 + Math.sin(a * Math.PI) * 0.35;
        if (wb === 'bo') { T.rShX = -1.5; T.rShZ = 0; T.sockX = 0; T.sockZ = 1.5; }
        lam = 40; break;
      }
      case 'dodge': {
        T.bodyX = a * Math.PI * 2; T.bodyY = -Math.sin(a * Math.PI) * 0.45; T.lHipX = -1.7; T.rHipX = -1.7; T.lKnX = 2.1; T.rKnX = 2.1;
        T.lShX = -1.2; T.rShX = -1.2; T.lElX = -1.2; T.rElX = -1.2; T.chestX = 0.6; T.headX = 0.5; lam = 60; break;
      }
      case 'block': {
        T.lShX = -1.35; T.rShX = -1.35; T.lElX = -1.7; T.rElX = -1.7; T.lShZ = -0.45; T.rShZ = 0.45; T.chestX = 0.1;
        T.lHipX = -0.4; T.rHipX = 0.3; T.lKnX = 0.5; T.rKnX = 0.4; T.bodyY = -0.1;
        if (wb === 'bo') { T.lShZ = -0.2; T.rShZ = 0.2; T.lElX = -1.2; T.rElX = -1.2; T.sockX = 0; T.sockZ = 1.57; }
        lam = 30; break;
      }
      case 'hit': {
        T.chestX = -0.4; T.headX = -0.35; T.lShZ = 0.6; T.rShZ = -0.6; T.lShX = -0.4; T.rShX = -0.4; T.bodyY = -0.06; T.lKnX = 0.3; T.rKnX = 0.3; lam = 40; break;
      }
      case 'stagger': {
        T.chestX = 0.5 + Math.sin(t * 9) * 0.06; T.headX = 0.4; T.lShX = 0.2; T.rShX = 0.2; T.lKnX = 1.0; T.rKnX = 0.5; T.lHipX = -0.6; T.bodyY = -0.3; lam = 14; break;
      }
      case 'dead': {
        T.bodyX = -Math.PI / 2 * seg(a, 0, 0.5); T.bodyY = -0.72 * seg(a, 0.15, 0.55); T.lShZ = 1.2; T.rShZ = -1.2; T.headX = -0.2; T.lKnX = 0.3; lam = 10; break;
      }
      case 'roar': {
        T.chestX = -0.35; T.headX = -0.4; T.lShX = -0.6; T.rShX = -0.6; T.lShZ = 1.2; T.rShZ = -1.2; T.lElX = -1.2; T.rElX = -1.2; T.lHipX = -0.3; T.rHipX = 0.3; T.lKnX = 0.4; T.rKnX = 0.4; T.bodyY = -0.08; lam = 10; break;
      }
      case 'wave': {
        T.rShX = -0.4; T.rShZ = -2.5; T.rElX = -0.5 + Math.sin(t * 8) * 0.4; lam = 10; break;
      }
      case 'bow': {
        T.chestX = 0.7 * seg(a, 0, 0.4) * (1 - seg(a, 0.7, 1)); T.headX = 0.2; lam = 8; break;
      }
      case 'kneel': {
        T.chestX = 0.3; T.headX = 0.3; T.lHipX = -1.5; T.lKnX = 1.6; T.rHipX = 0.2; T.rKnX = 2.2; T.bodyY = -0.45; lam = 6; break;
      }
    }
    const P = this.pose;
    for (const k of POSE_KEYS) {
      if (k === 'bodyX' && (s.action === 'dodge')) { P[k] = T[k]; continue; }
      if (k === 'spin') { P[k] = s.action === 'spin' ? T[k] : 0; continue; }
      P[k] = damp(P[k], T[k], lam, dt);
    }
    this.body.position.y = 0.95 + P.bodyY; this.body.rotation.set(P.bodyX, P.spin, P.bodyZ);
    this.chest.rotation.set(P.chestX, P.chestY, P.chestZ);
    this.head.rotation.set(P.headX, P.headY, 0);
    this.lArm.sh.rotation.set(P.lShX, P.lShY, P.lShZ); this.lArm.el.rotation.x = P.lElX;
    this.rArm.sh.rotation.set(P.rShX, P.rShY, P.rShZ); this.rArm.el.rotation.x = P.rElX;
    this.lLeg.hip.rotation.set(P.lHipX, 0, P.lHipZ); this.lLeg.kn.rotation.x = P.lKnX;
    this.rLeg.hip.rotation.set(P.rHipX, 0, P.rHipZ); this.rLeg.kn.rotation.x = P.rKnX;
    this.sock.rotation.set(P.sockX, 0, P.sockZ);
  }
}

// ---------------- イノシシ ----------------
export class Boar {
  constructor(scale = 1) {
    const mats = (this.mats = new MatSet());
    const fur = mats.get('#4a3526'), dark = mats.get('#2d2018'), tusk = mats.get('#efe6d0'), snout = mats.get('#7a5848');
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.body.position.y = 0.6; this.root.add(this.body);
    this.body.add(mesh(GEO.sph, fur, 0.42, 0.4, 0.75));
    this.body.add(mesh(GEO.box, dark, 0.12, 0.18, 0.9, 0, 0.36, 0));
    this.head = new THREE.Group(); this.head.position.set(0, 0.05, 0.68); this.body.add(this.head);
    this.head.add(mesh(GEO.box, fur, 0.32, 0.32, 0.42, 0, 0, 0.12));
    addR(this.head, mesh(GEO.cyl, snout, 0.1, 0.12, 0.1, 0, -0.06, 0.38), Math.PI / 2, 0, 0);
    for (const s of [-1, 1]) {
      const t = mesh(GEO.cone, tusk, 0.03, 0.16, 0.03, s * 0.1, -0.08, 0.36); t.rotation.x = -0.6; this.head.add(t);
      this.head.add(mesh(GEO.box, dark, 0.07, 0.12, 0.04, s * 0.12, 0.2, -0.02));
      this.head.add(mesh(GEO.box, mats.get('#111'), 0.03, 0.03, 0.02, s * 0.09, 0.06, 0.33));
    }
    this.legs = [];
    for (const [x, z] of [[-0.22, 0.42], [0.22, 0.42], [-0.22, -0.42], [0.22, -0.42]]) {
      const g = new THREE.Group(); g.position.set(x, -0.15, z); this.body.add(g);
      g.add(mesh(GEO.cyl, dark, 0.065, 0.45, 0.065, 0, -0.22, 0)); this.legs.push(g);
    }
    this.root.scale.setScalar(scale);
    this.rz = 0;
  }
  animate(dt, s) {
    const m = clamp(s.speed || 0, 0, 1.5), ph = s.phase || 0;
    this.legs.forEach((g, i) => { g.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.7 * m; });
    let hx = 0, by = 0.6 - Math.abs(Math.sin(ph)) * 0.05 * m, rz = 0;
    if (s.action === 'windup') { hx = 0.35; this.legs[1].rotation.x = Math.sin(s.t * 18) * 0.6; by = 0.55; }
    if (s.action === 'hit') { hx = -0.4; }
    if (s.action === 'dead') { rz = Math.PI / 2 * clamp(s.a * 2, 0, 1); by = 0.35; }
    this.head.rotation.x = damp(this.head.rotation.x, hx, 12, dt);
    this.body.position.y = damp(this.body.position.y, by, 12, dt);
    this.rz = damp(this.rz, rz, 8, dt); this.body.rotation.z = this.rz;
  }
}

// ---------------- ハブ ----------------
export class Habu {
  constructor() {
    const mats = (this.mats = new MatSet());
    const a = mats.get('#9a9147'), b = mats.get('#4b4524'), belly = mats.get('#d8cf96');
    this.root = new THREE.Group(); this.segs = [];
    const N = 16;
    for (let i = 0; i < N; i++) {
      const r = 0.09 * (1 - i / N * 0.7) + 0.02;
      const m = mesh(GEO.sph, i % 3 === 1 ? b : a, r, r * 0.8, r * 1.4); this.root.add(m); this.segs.push(m);
    }
    this.headM = new THREE.Group(); this.root.add(this.headM);
    this.headM.add(mesh(GEO.box, a, 0.17, 0.08, 0.22, 0, 0, 0.04));
    this.headM.add(mesh(GEO.box, belly, 0.13, 0.03, 0.18, 0, -0.04, 0.04));
    for (const s of [-1, 1]) this.headM.add(mesh(GEO.box, mats.get('#e8c020'), 0.03, 0.03, 0.03, s * 0.07, 0.03, 0.1));
    this.raise = 0;
  }
  animate(dt, s) {
    const ph = s.phase || 0, m = clamp(s.speed || 0, 0, 1);
    const target = s.action === 'windup' ? 1 : s.action === 'lunge' ? 0.6 : 0.25;
    this.raise = damp(this.raise, s.action === 'dead' ? 0 : target, 10, dt);
    for (let i = 0; i < this.segs.length; i++) {
      const sg = this.segs[i], k = i / this.segs.length;
      const amp = (0.12 + 0.18 * m) * (0.3 + k);
      const z = -i * 0.16 + (this.raise > 0.5 && i < 6 ? (6 - i) * 0.04 * this.raise : 0);
      const y = 0.07 + (i < 6 ? (6 - i) * 0.07 * this.raise : 0);
      const x = s.action === 'dead' ? Math.sin(i * 0.4) * 0.2 : Math.sin(ph * 2 - i * 0.55) * amp;
      sg.position.set(x, y, z);
    }
    const h = this.segs[0].position; this.headM.position.set(h.x, h.y + 0.02, h.z + 0.14);
    this.headM.rotation.x = s.action === 'windup' ? -0.3 : 0;
  }
}
