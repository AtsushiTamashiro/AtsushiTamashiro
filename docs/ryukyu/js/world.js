// 琉球の世界:地形・道・集落・首里城・植生・当たり判定
import * as THREE from 'three';
import { mulberry32, fbm, valueNoise, clamp, lerp, smoothstep, table } from './util.js';

// 読谷山(北)→ 北谷(海沿い)→ 浦添(森)→ 首里(丘の上)
const PATH_POINTS = [
  [0, 60], [0, 20], [6, -40], [12, -100], [0, -160], [-22, -220], [-40, -280], [-46, -340],
  [-40, -400], [-22, -460], [4, -520], [22, -580], [30, -640], [18, -700], [2, -760], [-8, -820],
  [0, -880], [8, -930], [10, -975], [10, -1020], [10, -1070],
];
export const CASTLE = { x: 10, z: -1070, r: 40, elev: 26 };
export const SEIDEN = { x: 10, z: -1098 };

const ELEV = [[60, 2], [-180, 2], [-260, 1.3], [-420, 1.4], [-500, 4], [-640, 9], [-780, 13], [-850, 16], [-960, 24], [-1020, 26], [-1300, 26]];
const COAST = [[60, -85], [-150, -80], [-300, -66], [-380, -68], [-470, -85], [-560, -260], [-1300, -320]];
// table() は x 昇順を前提にするため、z 降順で書いた表を反転しておく
ELEV.reverse(); COAST.reverse();

export const ZONES = [
  { id: 0, name: '読谷山', kana: 'ユムタン', sub: '百姓・樽金の村', zMax: Infinity },
  { id: 1, name: '北谷', kana: 'チャタン', sub: '海賊が上陸した浜', zMax: -200 },
  { id: 2, name: '浦添', kana: 'ウラシー', sub: '古き城跡の森', zMax: -490 },
  { id: 3, name: '首里', kana: 'スイ', sub: '王都、そして首里城へ', zMax: -815 },
];
export function zoneAtZ(z) { let r = ZONES[0]; for (const zn of ZONES) if (z <= zn.zMax) r = zn; return r; }

const SAND = new THREE.Color('#e8dcb2'), WETSAND = new THREE.Color('#b9a77a');
const GRASS1 = new THREE.Color('#71ad4c'), GRASS2 = new THREE.Color('#3f7c34'), HILL = new THREE.Color('#355f2b');
const DIRT = new THREE.Color('#b9976a'), STONE = new THREE.Color('#a9a393'), PAVE = new THREE.Color('#bdb39c');

// ---------- 結合ジオメトリ(描画負荷を減らすための一括メッシュ) ----------
class Batcher {
  constructor() { this.pos = []; this.nor = []; this.col = []; }
  add(geo, m, color) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    for (let i = 0; i < p.length; i++) { this.pos.push(p[i]); this.nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) this.col.push(c.r, c.g, c.b);
    g.dispose();
  }
  build(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function M(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
  return _m.clone().compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
}
// ローカル座標(lx,ly,lz)を、(x,z,rot)の位置・向きへ変換した行列
function L(base, lx, ly, lz, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  return base.clone().multiply(M(lx, ly, lz, ry, sx, sy, sz, rx, rz));
}

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone4: new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4), // 底面が1x1四方(半径0.5相当)×2
  cone: new THREE.ConeGeometry(1, 1, 8),
  cone3: new THREE.ConeGeometry(1, 1, 4),
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  dodec: new THREE.DodecahedronGeometry(1, 0),
  halfCyl: new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, -Math.PI / 2, Math.PI),
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(1429);
    this.colliders = [];
    this.grid = new Map();
    this.fires = [];
    this.checkpoints = [];
    this.npcs = [];
    this.waterTime = 0;
    this.buildPath();
    this.buildSky();
    this.buildTerrain();
    this.buildWater();
    this.batch = new Batcher();
    this.buildVillages();
    this.buildChatan();
    this.buildUrasoe();
    this.buildShuri();
    this.buildCastle();
    this.buildCheckpoints();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: true });
    this.staticMesh = this.batch.build(mat);
    scene.add(this.staticMesh);
    this.batch = null;
    this.buildVegetation();
  }

  // ---------- 道 ----------
  buildPath() {
    const curve = new THREE.CatmullRomCurve3(PATH_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const N = 700;
    const pts = curve.getSpacedPoints(N);
    this.pathLen = curve.getLength();
    this.N = N;
    this.px = new Float32Array(N + 1); this.pz = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) { this.px[i] = pts[i].x; this.pz[i] = pts[i].z; }
    this.ds = this.pathLen / N;
  }
  // 道上で z 座標が指定値になる距離 s
  sAtZ(z) {
    for (let i = 0; i < this.N; i++) {
      const a = this.pz[i], b = this.pz[i + 1];
      if ((a - z) * (b - z) <= 0) return (i + (a === b ? 0 : (a - z) / (a - b))) * this.ds;
    }
    return z > this.pz[0] ? 0 : this.pathLen;
  }
  // 道上の最も近い点
  nearest(x, z) {
    const { px, pz, N } = this;
    let best = 1e18, bi = 0;
    for (let i = 0; i <= N; i += 8) { const dx = px[i] - x, dz = pz[i] - z; const d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    const a = Math.max(0, bi - 8), b = Math.min(N, bi + 8);
    for (let i = a; i <= b; i++) { const dx = px[i] - x, dz = pz[i] - z; const d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
    // 隣接区間へ射影して精度を上げる
    let bx = px[bi], bz = pz[bi], bs = bi * this.ds;
    for (const j of [bi - 1, bi]) {
      if (j < 0 || j >= N) continue;
      const ax = px[j], az = pz[j], ex = px[j + 1] - ax, ez = pz[j + 1] - az;
      const len2 = ex * ex + ez * ez; if (len2 < 1e-6) continue;
      const t = clamp(((x - ax) * ex + (z - az) * ez) / len2, 0, 1);
      const qx = ax + ex * t, qz = az + ez * t; const d = (qx - x) ** 2 + (qz - z) ** 2;
      if (d < best) { best = d; bx = qx; bz = qz; bs = (j + t) * this.ds; }
    }
    return { d: Math.sqrt(best), x: bx, z: bz, s: bs, i: bi };
  }
  pointAt(s) {
    const f = clamp(s / this.ds, 0, this.N - 0.001); const i = Math.floor(f), t = f - i;
    const x = lerp(this.px[i], this.px[i + 1], t), z = lerp(this.pz[i], this.pz[i + 1], t);
    let tx = this.px[i + 1] - this.px[i], tz = this.pz[i + 1] - this.pz[i]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    return { x, z, tx, tz, nx: -tz, nz: tx }; // n = 進行方向の左手側
  }

  // ---------- 地形 ----------
  rawHeight(x, z) {
    const np = this.nearest(x, z), d = np.d;
    const base = table(ELEV, np.z);
    const n = fbm(x * 0.014 + 3.1, z * 0.014 - 7.7, 4);
    const n2 = valueNoise(x * 0.09, z * 0.09);
    const side = Math.max(0, d - 16);
    const hill = base + (n - 0.45) * 5 + side * (0.16 + n * 0.38) + n2 * 0.6;
    let h = lerp(base + (n2 - 0.5) * 0.3, hill, smoothstep(6, 30, d));
    const dc = Math.hypot(x - CASTLE.x, z - CASTLE.z);
    if (dc < 80) h = lerp(CASTLE.elev, h, smoothstep(46, 80, dc));
    const cx = table(COAST, z);
    const beach = (x - cx) * 0.11 + 0.5 + (n2 - 0.5) * 0.4;
    if (beach < h) h = beach;
    return { h, d, n, n2, cx, dc, z: np.z };
  }
  buildTerrain() {
    const X0 = -280, X1 = 280, Z0 = 110, Z1 = -1270, step = 4;
    const nx = Math.round((X1 - X0) / step), nz = Math.round((Z0 - Z1) / step);
    this.hgrid = { X0, Z0, step, nx, nz, h: new Float32Array((nx + 1) * (nz + 1)) };
    const geo = new THREE.PlaneGeometry(X1 - X0, Z0 - Z1, nx, nz);
    geo.rotateX(-Math.PI / 2);
    geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    const pos = geo.attributes.position; const cols = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    // PlaneGeometry rotateX(-90°) 後の頂点順:行=z(北→南ではなく 奥→手前) → 位置から添字を求める
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const r = this.rawHeight(x, z);
      pos.setY(i, r.h);
      const gi = Math.round((x - X0) / step), gj = Math.round((Z0 - z) / step);
      this.hgrid.h[gj * (nx + 1) + gi] = r.h;
      // 色
      const g = clamp(r.n * 1.6 - 0.3 + (r.n2 - 0.5) * 0.4, 0, 1);
      c.copy(GRASS1).lerp(GRASS2, g);
      if (r.d > 30) c.lerp(HILL, smoothstep(30, 70, r.d) * 0.7);
      const beachness = 1 - smoothstep(14, 24, x - r.cx);
      if (beachness > 0 && r.h < 3) c.lerp(SAND, beachness);
      if (r.h < 0.5) c.copy(WETSAND).lerp(SAND, clamp(r.h * 2, 0, 1));
      const pw = 3 + r.n2 * 1.4;
      const roadCol = r.z < -830 ? STONE : DIRT;
      c.lerp(roadCol, 1 - smoothstep(pw - 0.8, pw + 0.8, r.d));
      if (r.dc < 44) c.copy(PAVE).lerp(STONE, r.n2 * 0.5);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }
  heightAt(x, z) {
    const g = this.hgrid; const fx = (x - g.X0) / g.step, fz = (g.Z0 - z) / g.step;
    const i = clamp(Math.floor(fx), 0, g.nx - 1), j = clamp(Math.floor(fz), 0, g.nz - 1);
    const tx = clamp(fx - i, 0, 1), tz = clamp(fz - j, 0, 1); const W = g.nx + 1;
    const a = g.h[j * W + i], b = g.h[j * W + i + 1], c = g.h[(j + 1) * W + i], d = g.h[(j + 1) * W + i + 1];
    // 三角形分割に合わせた補間
    if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(1400, 2000, 60, 80); geo.rotateX(-Math.PI / 2); geo.translate(-500, 0, -560);
    this.waterBase = Float32Array.from(geo.attributes.position.array);
    const mat = new THREE.MeshStandardMaterial({ color: '#1593ad', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.82 });
    this.water = new THREE.Mesh(geo, mat); this.water.position.y = 0.05; this.water.receiveShadow = true;
    this.scene.add(this.water);
    const deep = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0c5a78' }));
    deep.position.set(-700, -3, -560); this.scene.add(deep);
  }

  buildSky() {
    this.skyUniforms = { top: { value: new THREE.Color('#4a90d9') }, horizon: { value: new THREE.Color('#d9eef7') }, sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) }, sunCol: { value: new THREE.Color('#fff3d0') } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vDir;
        void main(){ float h = clamp(vDir.y, -0.2, 1.0); vec3 c = mix(horizon, top, pow(max(h,0.0), 0.55));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0); c += sunCol * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.25);
          if (h < 0.0) c = mix(horizon, horizon*0.85, -h*5.0); gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
    this.sky.frustumCulled = false; this.sky.renderOrder = -1;
    this.scene.add(this.sky);
    // 雲
    const cloudTex = canvasTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    this.cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 });
    this.clouds = new THREE.Group();
    const r = this.rng;
    for (let i = 0; i < 60; i++) {
      const cx = (r() - 0.5) * 1200 - 100, cz = 100 - r() * 1400, cy = 110 + r() * 60;
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Sprite(this.cloudMat); s.position.set(cx + (r() - 0.5) * 50, cy + r() * 10, cz + (r() - 0.5) * 30);
        const sc = 40 + r() * 50; s.scale.set(sc * 1.6, sc * 0.7, 1); this.clouds.add(s);
      }
    }
    this.scene.add(this.clouds);
  }

  // ---------- 当たり判定 ----------
  _insert(col, r) {
    const cs = 16; const x0 = Math.floor((col.x - r) / cs), x1 = Math.floor((col.x + r) / cs), z0 = Math.floor((col.z - r) / cs), z1 = Math.floor((col.z + r) / cs);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 100003 + j; let a = this.grid.get(k); if (!a) this.grid.set(k, (a = [])); a.push(col); }
    this.colliders.push(col);
  }
  addBox(x, z, hw, hd, rot = 0) { this._insert({ t: 'b', x, z, hw, hd, c: Math.cos(rot), s: Math.sin(rot) }, Math.hypot(hw, hd)); }
  addCircle(x, z, r) { this._insert({ t: 'c', x, z, r }, r); }
  // 円(半径rad)を障害物から押し出す
  resolve(pos, rad) {
    const cs = 16; const k = Math.floor(pos.x / cs) * 100003 + Math.floor(pos.z / cs);
    const arr = this.grid.get(k); if (!arr) return false;
    let hit = false;
    for (const c of arr) {
      if (c.t === 'c') {
        const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + rad;
        if (d < m && d > 1e-5) { pos.x = c.x + (dx / d) * m; pos.z = c.z + (dz / d) * m; hit = true; }
      } else {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
        const qx = clamp(lx, -c.hw, c.hw), qz = clamp(lz, -c.hd, c.hd);
        let ex = lx - qx, ez = lz - qz; const d = Math.hypot(ex, ez);
        let nlx = lx, nlz = lz;
        if (d > 1e-5) { if (d >= rad) continue; nlx = qx + (ex / d) * rad; nlz = qz + (ez / d) * rad; }
        else { // 内部:最短の面へ
          const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
          if (px < pz) nlx = Math.sign(lx || 1) * (c.hw + rad); else nlz = Math.sign(lz || 1) * (c.hd + rad);
        }
        pos.x = c.x + nlx * c.c + nlz * c.s; pos.z = c.z - nlx * c.s + nlz * c.c; hit = true;
      }
    }
    return hit;
  }
  // 道から離れすぎないようにする(通行可能な帯)
  clampCorridor(pos) {
    const dc = Math.hypot(pos.x - CASTLE.x, pos.z - CASTLE.z);
    if (dc < CASTLE.r - 2) return;
    const np = this.nearest(pos.x, pos.z);
    let W = 21;
    if (pos.z < -250 && pos.z > -430) W = 30; // 北谷の浜は広め
    if (np.d > W) { const k = W / np.d; pos.x = np.x + (pos.x - np.x) * k; pos.z = np.z + (pos.z - np.z) * k; }
    // 海に入りすぎない
    const cx = table(COAST, pos.z) - 2; if (pos.x < cx) pos.x = cx;
  }

  // ---------- 建物 ----------
  house(x, z, rot, opts = {}) {
    const b = this.batch, base = M(x, this.heightAt(x, z) - 0.2, z, rot);
    const w = opts.w || 7, d = opts.d || 5.6;
    const wood = new THREE.Color('#8a6644').offsetHSL(0, 0, (this.rng() - 0.5) * 0.08);
    b.add(G.box, L(base, 0, 0.35, 0, 0, w + 1.2, 0.7, d + 1.2), '#7a6a58');
    b.add(G.box, L(base, 0, 1.9, 0, 0, w, 2.6, d), wood);
    // 縁側の柱
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(G.cyl6, L(base, sx * (w / 2 + 0.4), 1.8, sz * (d / 2 + 0.4), 0, 0.12, 2.6, 0.12), '#5d4330');
    // 赤瓦の寄棟屋根 + 白い漆喰の棟
    const roof = new THREE.Color('#c4532f').offsetHSL((this.rng() - 0.5) * 0.02, 0, (this.rng() - 0.5) * 0.06);
    b.add(G.cone4, L(base, 0, 4.2, 0, 0, w + 2.4, 2.4, d + 2.4), roof);
    b.add(G.cone4, L(base, 0, 4.25, 0, 0, w + 1.2, 2.3, d + 1.0), roof.clone().offsetHSL(0, 0, -0.04));
    b.add(G.box, L(base, 0, 5.15, 0, 0, w * 0.35, 0.18, 0.25), '#f1ece2');
    // 屋根のシーサー
    if (opts.shisa !== false) this.shisa(L(base, 0, 5.25, 0, Math.PI, 0.55, 0.55, 0.55));
    this.addBox(x, z, (w + 1.2) / 2, (d + 1.2) / 2, rot);
    // 石垣とヒンプン
    if (opts.wall !== false) {
      const W2 = w / 2 + 4, D2 = d / 2 + 4.5, hgt = 1.6, stone = new THREE.Color('#cfc4a4');
      const seg = (lx, lz, len, r) => {
        const m = L(base, lx, hgt / 2, lz, r, len, hgt, 0.7); b.add(G.box, m, stone.clone().offsetHSL(0, 0, (this.rng() - 0.5) * 0.06));
        const wx = x + lx * Math.cos(rot) + lz * Math.sin(rot), wz = z - lx * Math.sin(rot) + lz * Math.cos(rot);
        this.addBox(wx, wz, len / 2, 0.35, rot + r);
      };
      seg(0, -D2, W2 * 2, 0);
      seg(-W2, 0, D2 * 2, Math.PI / 2); seg(W2, 0, D2 * 2, Math.PI / 2);
      seg(-W2 / 2 - 1.5, D2, W2 - 3, 0); seg(W2 / 2 + 1.5, D2, W2 - 3, 0);
      // ヒンプン(目隠し塀)
      b.add(G.box, L(base, 0, 0.9, D2 - 2.2, 0, 3.2, 1.8, 0.6), '#d6cdb0');
      const wx = x + (D2 - 2.2) * Math.sin(rot), wz = z + (D2 - 2.2) * Math.cos(rot); this.addBox(wx, wz, 1.6, 0.3, rot);
      // フクギの屋敷林
      for (let i = 0; i < 6; i++) {
        const lx = -W2 + 1.5 + (i / 5) * (W2 * 2 - 3);
        this.treeSpots.push(this.localToWorld(x, z, rot, lx, -D2 - 1.6));
      }
    }
  }
  localToWorld(x, z, rot, lx, lz) { return { x: x + lx * Math.cos(rot) + lz * Math.sin(rot), z: z - lx * Math.sin(rot) + lz * Math.cos(rot) }; }
  shisa(m) {
    const b = this.batch, c = '#b8653e';
    b.add(G.box, m.clone().multiply(M(0, 0.25, 0, 0, 0.5, 0.5, 0.7)), c);
    b.add(G.box, m.clone().multiply(M(0, 0.7, 0.3, 0, 0.6, 0.55, 0.5)), c);
    b.add(G.box, m.clone().multiply(M(0, 0.6, 0.6, 0, 0.45, 0.2, 0.15)), '#8a3f22');
    b.add(G.box, m.clone().multiply(M(0, 0.5, -0.4, 0, 0.15, 0.4, 0.15, 0.6)), c);
  }
  // 道沿いの指定区間(sA..sB)に家を並べる
  placeHouses(sA, sB, step, distMin, distMax, chance = 0.85) {
    const r = this.rng;
    for (let s = sA; s < sB; s += step) {
      for (const side of [-1, 1]) {
        if (r() > chance) continue;
        const p = this.pointAt(s + (r() - 0.5) * 4);
        const off = (distMin + r() * (distMax - distMin)) * side;
        const x = p.x + p.nx * off, z = p.z + p.nz * off;
        // 家の正面(+z)を道へ向ける
        const rot = Math.atan2(-p.nx * side, -p.nz * side);
        this.house(x, z, rot);
      }
    }
  }

  buildVillages() {
    this.treeSpots = [];
    // 読谷山の集落
    this.placeHouses(this.sAtZ(35), this.sAtZ(-175), 26, 17, 21, 0.8);
    // 村の広場:井戸(カー)
    const p = this.pointAt(this.sAtZ(-10)); const wx = p.x + p.nx * 9, wz = p.z + p.nz * 9, wy = this.heightAt(wx, wz);
    this.batch.add(G.cyl, M(wx, wy + 0.5, wz, 0, 1.2, 1.0, 1.2), '#bfb497');
    this.batch.add(G.cyl, M(wx, wy + 1.02, wz, 0, 0.95, 0.05, 0.95), '#2a4d5c');
    this.addCircle(wx, wz, 1.3);
    // 物見の大岩
    this.rockAt(this.pointAt(this.sAtZ(-60)), -12, 3);
  }
  rockAt(p, off, s) {
    const x = p.x + p.nx * off, z = p.z + p.nz * off, y = this.heightAt(x, z);
    this.batch.add(G.dodec, M(x, y + s * 0.4, z, this.rng() * 6, s * 1.3, s, s * 1.1), '#8f8b80');
    this.addCircle(x, z, s * 1.1);
  }

  buildChatan() {
    const b = this.batch, r = this.rng;
    // 漁師小屋(棒を拾う場所)
    const p = this.pointAt(this.sAtZ(-262)); this.fishermanSpot = { x: p.x - p.nx * 8, z: p.z - p.nz * 8 };
    this.house(p.x + p.nx * 18, p.z + p.nz * 18, Math.atan2(-p.nx, -p.nz), { wall: false, w: 5, d: 4 });
    // 海賊の野営地
    const camp = [[-58, -330], [-62, -352], [-54, -372], [-66, -312]];
    for (const [x, z] of camp) {
      const y = this.heightAt(x, z);
      b.add(G.cone, M(x, y + 1.4, z, r() * 3, 2.4, 2.8, 2.4), '#5a4a3a');
      b.add(G.cyl6, M(x, y + 1.6, z, 0, 0.08, 3.2, 0.08), '#3a2a1c');
      this.addCircle(x, z, 2.3);
    }
    for (const [x, z] of [[-50, -342], [-48, -440], [-6, -505]]) this.bonfire(x, z);
    for (let i = 0; i < 10; i++) { // 木箱・樽
      const x = -58 + r() * 14, z = -380 + r() * 80, y = this.heightAt(x, z), s = 0.8 + r() * 0.5;
      if (r() < 0.5) { b.add(G.box, M(x, y + s / 2, z, r() * 3, s, s, s), '#7b5a34'); this.addCircle(x, z, s * 0.7); }
      else { b.add(G.cyl, M(x, y + 0.6, z, 0, 0.5, 1.2, 0.5), '#6b4a2a'); this.addCircle(x, z, 0.6); }
    }
    // 海賊船(沖合)
    this.ship(-108, -346, 0.3);
    this.ship(-140, -430, -0.4);
    // 浜の岩
    for (let i = 0; i < 30; i++) {
      const z = -230 - r() * 260, x = table(COAST, z) + r() * 8 - 3, y = this.heightAt(x, z), s = 0.6 + r() * 1.8;
      b.add(G.dodec, M(x, y + s * 0.3, z, r() * 6, s * 1.2, s * 0.8, s), '#8c8579');
    }
  }
  ship(x, z, rot) {
    const b = this.batch, base = M(x, 0, z, rot);
    b.add(G.box, L(base, 0, 0.6, 0, 0, 5, 2.2, 18), '#4a3322');
    b.add(G.cone4, L(base, 0, 0.6, 10.5, 0, 5, 3.2, 2.2, Math.PI / 2), '#4a3322');
    b.add(G.box, L(base, 0, 2.2, -8, 0, 5, 2.2, 3), '#3c291b');
    b.add(G.cyl6, L(base, 0, 7, 0, 0, 0.25, 13, 0.25), '#2d1f14');
    b.add(G.box, L(base, 0, 8, 0.4, 0, 7, 8, 0.15), '#7a2620');
    b.add(G.cyl6, L(base, 0, 5, -6, 0, 0.18, 7, 0.18), '#2d1f14');
    b.add(G.box, L(base, 0, 6, -5.7, 0, 4, 4.5, 0.12), '#6a1f1a');
  }
  bonfire(x, z) {
    const y = this.heightAt(x, z), b = this.batch;
    for (let i = 0; i < 5; i++) b.add(G.cyl6, M(x, y + 0.25, z, (i / 5) * Math.PI * 2, 0.12, 1.4, 0.12, 1.2), '#4a2f1a');
    for (let i = 0; i < 8; i++) b.add(G.dodec, M(x + Math.cos(i) * 1.1, y + 0.15, z + Math.sin(i) * 1.1, i, 0.3, 0.25, 0.3), '#6f6a62');
    this.fires.push(new THREE.Vector3(x, y + 0.4, z));
    this.addCircle(x, z, 1.2);
  }

  buildUrasoe() {
    const b = this.batch, r = this.rng;
    // 古いグスクの石垣(弧状)
    const ruin = (s, off, R, a0, a1, H) => {
      const p = this.pointAt(s), cx = p.x + p.nx * off, cz = p.z + p.nz * off;
      const n = Math.ceil((a1 - a0) / 0.22);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i + 0.5) * ((a1 - a0) / n); if (r() < 0.12) continue;
        const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R, y = this.heightAt(x, z);
        const h = H * (0.6 + r() * 0.5), len = R * ((a1 - a0) / n) * 1.08;
        const rot = -a + Math.PI / 2;
        b.add(G.box, M(x, y + h / 2 - 0.3, z, rot, len, h, 1.6), new THREE.Color('#bcb39a').offsetHSL(0, 0, (r() - 0.5) * 0.08));
        this.addBox(x, z, len / 2, 0.8, rot);
      }
    };
    ruin(this.sAtZ(-600), 30, 16, 0, Math.PI * 1.3, 5);
    ruin(this.sAtZ(-690), -32, 12, Math.PI * 0.3, Math.PI * 1.8, 4);
    for (let i = 0; i < 40; i++) { const p = this.pointAt(lerp(this.sAtZ(-500), this.sAtZ(-820), r())); this.rockAt(p, (r() < 0.5 ? -1 : 1) * (12 + r() * 14), 0.6 + r() * 1.6); }
    // 森の中の小さな集落
    this.placeHouses(this.sAtZ(-535), this.sAtZ(-580), 30, 18, 22, 0.7);
  }

  buildShuri() {
    const b = this.batch, r = this.rng;
    this.placeHouses(this.sAtZ(-835), this.sAtZ(-965), 20, 16, 20, 0.95);
    // 石畳の道沿いの石垣
    const S0 = this.sAtZ(-878), S1 = this.sAtZ(-1024);
    for (let s = S0; s < S1; s += 6) {
      if (r() < 0.08) continue;
      const p = this.pointAt(s);
      for (const side of [-1, 1]) {
        const x = p.x + p.nx * 8.5 * side, z = p.z + p.nz * 8.5 * side, y = this.heightAt(x, z);
        const rot = Math.atan2(p.tx, p.tz);
        b.add(G.box, M(x, y + 0.9, z, rot, 0.9, 2.0, 6.3), new THREE.Color('#c9bea0').offsetHSL(0, 0, (r() - 0.5) * 0.07));
        this.addBox(x, z, 0.45, 3.15, rot);
      }
    }
    // 石灯籠
    for (let s = this.sAtZ(-996); s < this.sAtZ(-1026); s += 10) {
      const p = this.pointAt(s);
      for (const side of [-1, 1]) {
        const x = p.x + p.nx * 6 * side, z = p.z + p.nz * 6 * side, y = this.heightAt(x, z);
        b.add(G.box, M(x, y + 0.7, z, 0, 0.5, 1.4, 0.5), '#9d978a'); b.add(G.cone4, M(x, y + 1.7, z, 0, 1.0, 0.6, 1.0), '#8a8478');
        this.addCircle(x, z, 0.4);
      }
    }
    this.shureimon();
  }
  shureimon() {
    const p = this.pointAt(this.sAtZ(-985)); const x = p.x, z = p.z, y = this.heightAt(x, z), rot = Math.atan2(p.tx, p.tz);
    const base = M(x, y, z, rot), b = this.batch, red = '#b3282c', tile = '#c4532f';
    for (const px of [-5.6, -2.2, 2.2, 5.6]) {
      b.add(G.cyl, L(base, px, 2.6, 0, 0, 0.32, 5.2, 0.32), red);
      b.add(G.box, L(base, px, 0.35, 0, 0, 1.0, 0.7, 1.4), '#d9d1bd');
      b.add(G.box, L(base, px, 0.9, 0.9, 0.4, 0.15, 1.6, 0.15), '#7a1c1f');
      b.add(G.box, L(base, px, 0.9, -0.9, -0.4, 0.15, 1.6, 0.15), '#7a1c1f');
      const w = this.localToWorld(x, z, rot, px, 0); this.addCircle(w.x, w.z, 0.45);
    }
    b.add(G.box, L(base, 0, 5.3, 0, 0, 13.5, 0.5, 1.4), red);
    b.add(G.cone4, L(base, 0, 6.1, 0, 0, 15, 1.4, 5), tile);
    b.add(G.box, L(base, 0, 6.9, 0, 0, 9, 0.9, 1.1), red);
    b.add(G.cone4, L(base, 0, 7.8, 0, 0, 11, 1.6, 4), tile);
    b.add(G.box, L(base, 0, 8.55, 0, 0, 4.0, 0.2, 0.25), '#f1ece2');
    // 扁額「守禮之邦」
    const tex = canvasTex(512, 160, (g, w, h) => {
      g.fillStyle = '#1d1a3a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d4a83a'; g.lineWidth = 10; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#e8c255'; g.font = 'bold 96px "Yu Mincho","Hiragino Mincho ProN","Noto Serif JP",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('守禮之邦', w / 2, h / 2 + 4);
    });
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), new THREE.MeshBasicMaterial({ map: tex }));
    plaque.position.set(0, 6.9, 0.56); const g = new THREE.Group(); g.add(plaque);
    const back = plaque.clone(); back.rotation.y = Math.PI; back.position.z = -0.56; g.add(back);
    g.position.set(x, y, z); g.rotation.y = rot; this.scene.add(g);
  }

  buildCastle() {
    const b = this.batch, r = this.rng, { x: cx, z: cz, r: R, elev } = CASTLE;
    // 曲線を描く城壁(北側に歓会門)
    const n = 44;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * (Math.PI * 2 / n); // a=π/2 が北(+z)
      if (Math.abs(a - Math.PI / 2) < 0.2) continue;
      const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R, y = this.heightAt(x, z);
      const len = (Math.PI * 2 * R / n) * 1.06, rot = -a + Math.PI / 2, h = 8 + Math.sin(i * 1.7) * 0.6;
      b.add(G.box, M(x, y + h / 2 - 1, z, rot, len, h, 3), new THREE.Color('#cdbf9c').offsetHSL(0, 0, (r() - 0.5) * 0.05));
      b.add(G.box, M(x, y + h - 0.8, z, rot, len, 0.5, 3.4), '#bdae8c');
      this.addBox(x, z, len / 2, 1.5, rot);
    }
    // 歓会門(石のアーチ + 赤い櫓)
    const gz = cz + R, gy = this.heightAt(cx, gz), gb = M(cx, gy, gz, 0);
    for (const sx of [-1, 1]) { b.add(G.box, L(gb, sx * 5.2, 4, 0, 0, 3.6, 9, 4), '#cdbf9c'); this.addBox(cx + sx * 5.2, gz, 1.8, 2, 0); }
    b.add(G.box, L(gb, 0, 7.6, 0, 0, 7, 2.6, 4), '#c6b894');
    b.add(G.box, L(gb, 0, 9.8, 0, 0, 7.5, 1.8, 3.4), '#b3282c');
    b.add(G.cone4, L(gb, 0, 11.4, 0, 0, 10, 1.6, 5.4), '#c4532f');
    // 御庭(ウナー)の縞模様
    const una = canvasTex(256, 256, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#e9e1cf' : '#a8423a'; g.fillRect((i * w) / 16, 0, w / 16, h); } });
    const unaMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 26), new THREE.MeshStandardMaterial({ map: una, roughness: 0.9 }));
    unaMesh.rotation.x = -Math.PI / 2; unaMesh.position.set(cx, elev + 0.06, cz - 8); unaMesh.receiveShadow = true; this.scene.add(unaMesh);
    // 正殿
    const sx = SEIDEN.x, sz = SEIDEN.z, sb = M(sx, elev, sz, 0), red = '#b51f26', gold = '#d9a93a', tile = '#c4532f';
    b.add(G.box, L(sb, 0, 0.6, 0, 0, 32, 1.2, 17), '#d6ccb4');
    b.add(G.box, L(sb, 0, 3.6, 0, 0, 29, 5, 14), red);
    for (let i = -6; i <= 6; i++) b.add(G.box, L(sb, i * 2.2, 3.4, 7.05, 0, 0.25, 4.6, 0.1), '#7a1418');
    b.add(G.box, L(sb, 0, 6.3, 0, 0, 30, 0.5, 15), gold);
    b.add(G.cone4, L(sb, 0, 7.4, 0, 0, 34, 2.2, 19), tile);
    b.add(G.box, L(sb, 0, 9.4, -0.5, 0, 23, 3.6, 9.5), red);
    b.add(G.cone4, L(sb, 0, 12.0, -0.5, 0, 28, 3.6, 13.5), tile);
    b.add(G.box, L(sb, 0, 13.85, -0.5, 0, 9, 0.3, 0.4), '#f1ece2');
    // 唐破風
    b.add(G.halfCyl, L(sb, 0, 8.6, 7.2, 0, 3.2, 6, 1.7, 0, Math.PI / 2), tile);
    b.add(G.box, L(sb, 0, 7.8, 8.2, 0, 6.4, 1.2, 0.3), gold);
    // 龍柱
    for (const s of [-1, 1]) {
      b.add(G.cyl, L(sb, s * 4, 2.6, 9.2, 0, 0.5, 4, 0.5), gold);
      b.add(G.ico, L(sb, s * 4, 4.9, 9.2, 0, 0.7, 0.8, 0.9), gold);
      b.add(G.box, L(sb, s * 4, 0.9, 9.2, 0, 1.6, 1.8, 1.6), '#d6ccb4');
    }
    // 階段
    for (let i = 0; i < 3; i++) b.add(G.box, L(sb, 0, 0.2 + i * 0.4, 9.6 - i * 0.6, 0, 8, 0.4, 1.2), '#cfc5ad');
    this.addBox(sx, sz, 16, 8.5, 0);
    for (const s of [-1, 1]) this.addCircle(sx + s * 4, sz + 9.2, 1);
    // 南殿・北殿
    for (const s of [-1, 1]) {
      const hx = cx + s * 22, hz = cz - 8, hb = M(hx, elev, hz, -s * Math.PI / 2);
      b.add(G.box, L(hb, 0, 2.6, 0, 0, 18, 4.6, 8), s < 0 ? '#e6ddc8' : '#b51f26');
      b.add(G.cone4, L(hb, 0, 5.8, 0, 0, 21, 2.4, 10.5), tile);
      this.addBox(hx, hz, 4, 9, 0);
    }
    // 篝火
    for (const s of [-1, 1]) {
      const x = cx + s * 12, z = cz + 10, y = this.heightAt(x, z);
      b.add(G.cyl, M(x, y + 0.8, z, 0, 0.35, 1.6, 0.35), '#3b3b3b'); b.add(G.cyl, M(x, y + 1.7, z, 0, 0.7, 0.3, 0.7), '#2a2a2a');
      this.fires.push(new THREE.Vector3(x, y + 1.9, z)); this.addCircle(x, z, 0.6);
    }
  }

  buildCheckpoints() {
    // 拝所(ウガンジュ)= 休憩・復活地点
    const list = [[this.sAtZ(42), '読谷山の拝所'], [this.sAtZ(-250), '北谷の拝所'], [this.sAtZ(-505), '浦添の拝所'], [this.sAtZ(-835), '首里・金城の拝所'], [this.sAtZ(-968), '守礼門前の拝所']];
    const glowTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    this.glowTex = glowTex;
    list.forEach(([s, name], i) => {
      const p = this.pointAt(s), side = i % 2 ? -1 : 1, x = p.x + p.nx * 6 * side, z = p.z + p.nz * 6 * side, y = this.heightAt(x, z);
      const b = this.batch;
      b.add(G.box, M(x, y + 0.3, z, 0, 2.2, 0.6, 1.4), '#a59f90');
      b.add(G.box, M(x, y + 0.95, z - 0.2, 0, 0.9, 0.7, 0.5), '#bdb7a8');
      b.add(G.cyl, M(x, y + 0.75, z + 0.35, 0, 0.18, 0.3, 0.18), '#5b5b5b');
      // 背後のクバ(ビロウ)
      this.treeSpots.push({ x: x, z: z - 2.5, kind: 'palm' });
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffd9a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      spr.position.set(x, y + 1.4, z + 0.35); spr.scale.set(2.2, 2.2, 1); this.scene.add(spr);
      this.addCircle(x, z, 1.3);
      this.checkpoints.push({ x, z, y, name, s, spr, ix: i, spawn: { x: p.x, z: p.z } });
    });
  }

  // ---------- 植生(インスタンス描画) ----------
  makeInstanced(parts, count) {
    const bt = new Batcher();
    for (const [geo, m, col] of parts) bt.add(geo, m, col);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(bt.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(bt.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(bt.col, 3));
    const mesh = new THREE.InstancedMesh(g, this.vegMat, count);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.scene.add(mesh);
    return mesh;
  }
  pushInst(mesh, x, z, s, ry, tint) {
    if (mesh.count >= mesh.instanceMatrix.count) return;
    const y = this.heightAt(x, z);
    mesh.setMatrixAt(mesh.count, M(x, y - 0.1, z, ry, s, s * (0.85 + this.rng() * 0.3), s));
    if (tint) mesh.setColorAt(mesh.count, tint);
    mesh.count++;
  }
  buildVegetation() {
    const r = this.rng;
    this.vegMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    this.vegMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = { value: 0 }; this.vegShader = sh;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float sway = max(position.y - 1.0, 0.0) * 0.03;
        vec4 wp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        transformed.x += sin(uTime*1.6 + wp.x*0.3 + wp.z*0.2) * sway;
        transformed.z += cos(uTime*1.3 + wp.z*0.3) * sway * 0.6;`);
    };
    // フクギ
    const fukugi = this.makeInstanced([
      [G.cyl6, M(0, 1.5, 0, 0, 0.22, 3, 0.22), '#4b3826'],
      [G.ico0, M(0, 4.2, 0, 0, 1.6, 3.2, 1.5), '#2f6b2a'],
      [G.ico0, M(0.3, 5.6, 0.2, 0.5, 1.1, 1.8, 1.1), '#3a7d31'],
    ], 900);
    // 広葉樹
    const broad = this.makeInstanced([
      [G.cyl6, M(0, 1.6, 0, 0, 0.3, 3.2, 0.3), '#5a432c'],
      [G.ico0, M(0, 4.4, 0, 0, 2.8, 2.0, 2.6), '#3d7a30'],
      [G.ico0, M(1.2, 3.8, 0.6, 0, 1.8, 1.4, 1.8), '#4a8a37'],
      [G.ico0, M(-1.0, 4.0, -0.8, 0, 1.8, 1.5, 1.6), '#356d2b'],
    ], 1600);
    // ガジュマル
    const gaj = this.makeInstanced([
      [G.cyl6, M(0, 1.5, 0, 0, 0.8, 3, 0.8), '#6b5a48'],
      [G.cyl6, M(0.9, 1.6, 0.3, 0, 0.1, 3.2, 0.1), '#6b5a48'], [G.cyl6, M(-0.8, 1.6, -0.5, 0, 0.1, 3.2, 0.1), '#6b5a48'],
      [G.cyl6, M(0.3, 1.6, -1.0, 0, 0.08, 3.2, 0.08), '#6b5a48'],
      [G.ico0, M(0, 4.6, 0, 0, 4.2, 2.4, 4.0), '#2e6427'], [G.ico0, M(1.8, 4.0, 1.0, 0, 2.4, 1.6, 2.4), '#3b7530'],
    ], 160);
    // ビロウ・ヤシ
    const palmParts = [];
    for (let i = 0; i < 5; i++) palmParts.push([G.cyl6, M(Math.sin(i * 0.5) * 0.25 * i * 0.3, 0.9 + i * 1.3, 0, 0, 0.2 - i * 0.015, 1.4, 0.2 - i * 0.015, 0, 0.05 * i), '#7a6248']);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; palmParts.push([G.box, M(Math.sin(a) * 1.4, 7.0, Math.cos(a) * 1.4, a, 0.5, 0.08, 3.2, 0.45), '#3f8a34']); }
    const palm = this.makeInstanced(palmParts, 400);
    // サトウキビ
    const caneParts = [];
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6, rr = 0.28;
      caneParts.push([G.cone3, M(Math.cos(a) * rr, 1.4, Math.sin(a) * rr, a, 0.07, 2.8, 0.07, (r() - 0.5) * 0.2), '#a5a24a']);
      for (let k = 0; k < 2; k++) caneParts.push([G.cone3, M(Math.cos(a) * rr, 2.3 + k * 0.35, Math.sin(a) * rr, a + k * 2, 0.12, 1.6, 0.03, 0.9 + k * 0.3), '#6aa13a']);
    }
    const cane = this.makeInstanced(caneParts, 2600);
    // 草むら
    const grass = this.makeInstanced([[G.cone3, M(0, 0.18, 0, 0, 0.16, 0.45, 0.16), '#4f8a34'], [G.cone3, M(0.15, 0.14, 0.08, 0.7, 0.12, 0.35, 0.12), '#62a03f'], [G.cone3, M(-0.12, 0.14, 0.1, 1.3, 0.1, 0.3, 0.1), '#5a9539']], 3500);
    // 岩
    const rock = this.makeInstanced([[G.dodec, M(0, 0.3, 0, 0, 1.2, 0.8, 1.0), '#8c877d']], 500);

    const tint = new THREE.Color();
    const tinted = (h) => tint.setHSL(0, 0, 0.85 + r() * 0.3);
    const canPlace = (x, z) => this.heightAt(x, z) > 0.8;
    // 屋敷林
    for (const t of this.treeSpots) {
      if (t.kind === 'palm') { this.pushInst(palm, t.x, t.z, 0.6, r() * 6); continue; }
      this.pushInst(fukugi, t.x + (r() - 0.5), t.z + (r() - 0.5), 0.8 + r() * 0.3, r() * 6, tinted());
    }
    // 道沿いの区間ごとの植生
    const L = this.pathLen;
    for (let i = 0; i < 9000; i++) {
      const s = r() * L, p = this.pointAt(s), side = r() < 0.5 ? -1 : 1;
      const off = 24 + Math.pow(r(), 1.5) * 110, x = p.x + p.nx * off * side + (r() - 0.5) * 6, z = p.z + p.nz * off * side + (r() - 0.5) * 6;
      if (!canPlace(x, z)) continue;
      if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < 50) continue;
      const cx = table(COAST, z), nearCoast = x - cx < 26, zn = zoneAtZ(z).id;
      const roll = r();
      if (nearCoast) { if (roll < 0.15) this.pushInst(palm, x, z, 0.7 + r() * 0.5, r() * 6); }
      else if (zn === 0) {
        if (off < 75 && roll < 0.55) this.pushInst(cane, x, z, 0.9 + r() * 0.3, r() * 6);
        else if (roll < 0.62) this.pushInst(fukugi, x, z, 0.9 + r() * 0.4, r() * 6, tinted());
        else if (roll < 0.66) this.pushInst(broad, x, z, 0.8 + r() * 0.5, r() * 6, tinted());
      } else if (zn === 1) {
        if (roll < 0.25) this.pushInst(cane, x, z, 0.9 + r() * 0.3, r() * 6);
        else if (roll < 0.33) this.pushInst(palm, x, z, 0.7 + r() * 0.4, r() * 6);
        else if (roll < 0.4) this.pushInst(broad, x, z, 0.8 + r() * 0.5, r() * 6, tinted());
      } else if (zn === 2) {
        if (roll < 0.5) this.pushInst(broad, x, z, 0.8 + r() * 0.7, r() * 6, tinted());
        else if (roll < 0.56) this.pushInst(gaj, x, z, 0.8 + r() * 0.5, r() * 6);
        else if (roll < 0.6) this.pushInst(rock, x, z, 0.8 + r() * 2, r() * 6);
      } else {
        if (roll < 0.25) this.pushInst(fukugi, x, z, 0.9 + r() * 0.4, r() * 6, tinted());
        else if (roll < 0.45) this.pushInst(broad, x, z, 0.8 + r() * 0.5, r() * 6, tinted());
      }
    }
    // 浦添の森:道のすぐそばにもガジュマル(当たり判定あり)
    for (let s = this.sAtZ(-505); s < this.sAtZ(-815); s += 18) {
      const p = this.pointAt(s), side = r() < 0.5 ? -1 : 1, off = 13 + r() * 6;
      const x = p.x + p.nx * off * side, z = p.z + p.nz * off * side; this.pushInst(gaj, x, z, 0.8 + r() * 0.3, r() * 6); this.addCircle(x, z, 0.9);
    }
    // 北谷の浜:アダン/ヤシ
    for (let i = 0; i < 70; i++) {
      const z = -220 - r() * 270, x = table(COAST, z) + 6 + r() * 14;
      if (Math.hypot(x + 56, z + 345) < 26) continue;
      if (this.heightAt(x, z) < 0.6) continue;
      this.pushInst(palm, x, z, 0.6 + r() * 0.5, r() * 6); if (this.nearest(x, z).d < 32) this.addCircle(x, z, 0.35);
    }
    // 道端の草
    for (let i = 0; i < 3500; i++) {
      const s = r() * L, p = this.pointAt(s), side = r() < 0.5 ? -1 : 1, off = 4 + r() * 26;
      const x = p.x + p.nx * off * side, z = p.z + p.nz * off * side;
      if (!canPlace(x, z) || Math.hypot(x - CASTLE.x, z - CASTLE.z) < 44) continue;
      if (z < -830 && off < 9) continue;
      this.pushInst(grass, x, z, 0.8 + r() * 0.8, r() * 6);
    }
    for (const m of [fukugi, broad, gaj, palm, cane, grass, rock]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); }
    // サトウキビの畑も読谷山の道沿い(当たり判定なし、通り抜け不可エリア外)
  }

  // ---------- 時間経過(空の色・波) ----------
  update(dt, progress, time) {
    this.waterTime += dt;
    if (this.vegShader) this.vegShader.uniforms.uTime.value = time;
    const pos = this.water.geometry.attributes.position, base = this.waterBase;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      pos.array[i * 3 + 1] = Math.sin(x * 0.08 + time * 1.2) * 0.15 + Math.cos(z * 0.06 + time * 0.9) * 0.15;
    }
    pos.needsUpdate = true;
    this.water.geometry.computeVertexNormals();
    this.clouds.position.x = Math.sin(time * 0.01) * 30;
    for (const c of this.checkpoints) { const k = 2 + Math.sin(time * 2 + c.ix) * 0.3; c.spr.scale.set(k, k, 1); }
  }
}

// 日の傾き:進行度に応じた空・光の色
export const SKY_KEYS = [
  { p: 0.0, top: '#4f97de', hor: '#dcecf2', sun: '#fff0d0', si: 2.6, el: 0.75, hemi: 1.0 },
  { p: 0.45, top: '#3b84d6', hor: '#d2e8f3', sun: '#ffffff', si: 3.0, el: 1.0, hemi: 1.1 },
  { p: 0.75, top: '#4a79c4', hor: '#f0d9b4', sun: '#ffd9a0', si: 2.6, el: 0.5, hemi: 0.95 },
  { p: 1.0, top: '#34407a', hor: '#f4a86a', sun: '#ffa865', si: 2.3, el: 0.22, hemi: 0.75 },
];
