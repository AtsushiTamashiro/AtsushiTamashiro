// 世界の生成・保存・メッシュ化・レイキャスト
import * as THREE from 'three';
import { BLOCKS, AIR, GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANKS, COBBLE, GLASS, WATER, BRICK, SNOW,
  MOIN, BEDROCK, ROOF, LAMP, RED, YELLOW, BLUE, GREEN, PINK, ATLAS_COLS, ATLAS_ROWS, isOpaque } from './blocks.js';

export const SX = 160, SZ = 160, SY = 64, CH = 16;
export const WATER_LEVEL = 17;

// ---- ノイズ ----
function hash2(x, z, seed) {
  let h = (x * 374761393 + z * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = smooth(x - xi), zf = smooth(z - zi);
  const a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed), c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
  return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * zf;
}
function fbm(x, z, seed, oct = 4) {
  let s = 0, amp = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += valueNoise(x * f, z * f, seed + i * 101) * amp; n += amp; amp *= 0.5; f *= 2; }
  return s / n;
}

export class World {
  constructor(seed) {
    this.seed = seed;
    this.data = new Uint8Array(SX * SY * SZ);
    this.edits = new Map();
    this.dirty = new Set();
    this.houses = [];
    this.villageCenter = { x: SX / 2, z: SZ / 2, y: 0 };
    this.generate();
  }
  idx(x, y, z) { return (y * SZ + z) * SX + x; }
  inside(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < SX && y < SY && z < SZ; }
  get(x, y, z) {
    if (y < 0) return BEDROCK;
    if (!this.inside(x, y, z)) return AIR;
    return this.data[this.idx(x, y, z)];
  }
  rawSet(x, y, z, id) { if (this.inside(x, y, z)) this.data[this.idx(x, y, z)] = id; }
  set(x, y, z, id) {
    if (!this.inside(x, y, z)) return false;
    const i = this.idx(x, y, z);
    this.data[i] = id; this.edits.set(i, id);
    const cx = x / CH | 0, cz = z / CH | 0;
    this.dirty.add(cx + ',' + cz);
    const lx = x % CH, lz = z % CH;
    if (lx === 0 && cx > 0) this.dirty.add((cx - 1) + ',' + cz);
    if (lx === CH - 1 && cx < SX / CH - 1) this.dirty.add((cx + 1) + ',' + cz);
    if (lz === 0 && cz > 0) this.dirty.add(cx + ',' + (cz - 1));
    if (lz === CH - 1 && cz < SZ / CH - 1) this.dirty.add(cx + ',' + (cz + 1));
    return true;
  }
  topY(x, z) { for (let y = SY - 1; y >= 0; y--) { const b = this.get(x, y, z); if (BLOCKS[b].solid) return y; } return 0; }

  terrainHeight(x, z) {
    const s = this.seed;
    let h = fbm(x / 48, z / 48, s, 4);
    const m = fbm(x / 90 + 50, z / 90 - 30, s + 7, 3);
    let H = 12 + h * 18 + Math.max(0, m - 0.55) * 60;
    // 島の外周はゆるやかに海へ
    const dx = (x - SX / 2) / (SX / 2), dz = (z - SZ / 2) / (SZ / 2);
    const edge = Math.max(0, Math.sqrt(dx * dx + dz * dz) - 0.72);
    H -= edge * 40;
    return H;
  }

  // 村を作るのに良い、ほどよい高さの平らな場所を中央付近から探す
  findVillageSpot() {
    const c = this.villageCenter, ok = h => h >= WATER_LEVEL + 3 && h <= 30;
    for (let r = 0; r <= 44; r += 4) for (let k = 0; k < (r ? 12 : 1); k++) {
      const a = k / 12 * Math.PI * 2, x = Math.round(SX / 2 + Math.cos(a) * r), z = Math.round(SZ / 2 + Math.sin(a) * r);
      if (!ok(this.terrainHeight(x, z))) continue;
      let land = 0; for (let j = 0; j < 12; j++) { const b = j / 12 * Math.PI * 2; if (this.terrainHeight(x + Math.cos(b) * 20, z + Math.sin(b) * 20) > WATER_LEVEL + 1) land++; }
      if (land >= 10) { c.x = x; c.z = z; return; }
    }
  }

  generate() {
    const s = this.seed, c = this.villageCenter;
    this.findVillageSpot();
    const vh = Math.min(32, Math.max(WATER_LEVEL + 3, Math.round(this.terrainHeight(c.x, c.z))));
    c.y = vh;
    const heights = new Float32Array(SX * SZ);
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      let H = this.terrainHeight(x, z);
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < 26) { const t = d < 19 ? 0 : smooth((d - 19) / 7); H = vh + (H - vh) * t; }
      heights[z * SX + x] = Math.max(2, Math.min(SY - 6, Math.round(H)));
    }
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      const h = heights[z * SX + x];
      for (let y = 0; y <= Math.max(h, WATER_LEVEL); y++) {
        let id;
        if (y === 0) id = BEDROCK;
        else if (y > h) id = WATER;
        else if (y < h - 3) id = STONE;
        else if (h <= WATER_LEVEL + 1) id = SAND;
        else if (y === h) id = h > 38 ? SNOW : GRASS;
        else id = h > 38 ? STONE : DIRT;
        this.data[this.idx(x, y, z)] = id;
      }
    }
    this.buildVillage(vh);
    // 木
    for (let i = 0; i < 260; i++) {
      const x = 3 + (hash2(i, 1, s) * (SX - 6)) | 0, z = 3 + (hash2(i, 2, s) * (SZ - 6)) | 0;
      if (Math.hypot(x - c.x, z - c.z) < 24) continue;
      const y = heights[z * SX + x];
      if (this.get(x, y, z) !== GRASS) continue;
      this.tree(x, y + 1, z, 4 + (hash2(i, 3, s) * 3 | 0));
    }
  }

  tree(x, y, z, h) {
    for (let j = 0; j < h; j++) this.rawSet(x, y + j, z, LOG);
    const top = y + h;
    for (let dy = -2; dy <= 1; dy++) {
      const r = dy >= 0 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && (dy === 1 || hash2(x + dx, z + dz + dy, this.seed) < 0.5)) continue;
        if (this.get(x + dx, top + dy, z + dz) === AIR) this.rawSet(x + dx, top + dy, z + dz, LEAVES);
      }
    }
  }

  buildVillage(vh) {
    const c = this.villageCenter, cx = c.x | 0, cz = c.z | 0;
    // 十字の石畳
    for (let i = -17; i <= 17; i++) for (let w = -1; w <= 1; w++) {
      this.rawSet(cx + i, vh, cz + w, COBBLE); this.rawSet(cx + w, vh, cz + i, COBBLE);
    }
    // 中央の井戸とモイン像
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      this.rawSet(cx + dx, vh, cz + dz, edge ? COBBLE : WATER);
      if (edge) this.rawSet(cx + dx, vh + 1, cz + dz, COBBLE);
    }
    this.rawSet(cx, vh - 1, cz, WATER);
    for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { this.rawSet(cx + dx, vh + 2, cz + dz, LOG); this.rawSet(cx + dx, vh + 3, cz + dz, LAMP); }
    // 家
    const spots = [[-10, -10, 'S'], [10, -10, 'S'], [-10, 10, 'N'], [10, 10, 'N'], [-11, 0, 'E'], [11, 0, 'W']];
    const wallSet = [PLANKS, BRICK, PLANKS, COBBLE, PLANKS, BRICK];
    spots.forEach(([dx, dz, door], k) => this.house(cx + dx, vh, cz + dz, door, wallSet[k], k));
    // 花壇(カラーブロック)
    const flowers = [RED, YELLOW, PINK, BLUE, GREEN];
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2, x = Math.round(cx + Math.cos(a) * 5), z = Math.round(cz + Math.sin(a) * 5);
      if (this.get(x, vh, z) === GRASS) this.rawSet(x, vh, z, flowers[i % flowers.length]);
    }
    // モイン像(見晴らし台)
    const mx = cx + 13, mz = cz - 13;
    for (let y = 1; y <= 4; y++) this.rawSet(mx, vh + y, mz, y === 4 ? MOIN : YELLOW);
  }

  house(x0, y0, z0, door, wall, k) {
    const W = 3; // 半径 → 7x7
    for (let dx = -W; dx <= W; dx++) for (let dz = -W; dz <= W; dz++) {
      this.rawSet(x0 + dx, y0, z0 + dz, PLANKS);
      for (let y = 1; y <= 7; y++) this.rawSet(x0 + dx, y0 + y, z0 + dz, AIR);
      const edge = Math.abs(dx) === W || Math.abs(dz) === W, corner = Math.abs(dx) === W && Math.abs(dz) === W;
      if (edge) for (let y = 1; y <= 3; y++) {
        let id = corner ? LOG : wall;
        const along = Math.abs(dx) === W ? dz : dx;
        if (!corner && y === 2 && Math.abs(along) === 2) id = GLASS;
        this.rawSet(x0 + dx, y0 + y, z0 + dz, id);
      }
    }
    // 屋根(段々)
    for (let L = 0; L <= W + 1; L++) {
      const r = W + 1 - L;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++)
        if (Math.abs(dx) === r || Math.abs(dz) === r || r === 0) this.rawSet(x0 + dx, y0 + 4 + L, z0 + dz, ROOF);
    }
    // ドア
    const d = { N: [0, -W], S: [0, W], E: [W, 0], W: [-W, 0] }[door];
    this.rawSet(x0 + d[0], y0 + 1, z0 + d[1], AIR); this.rawSet(x0 + d[0], y0 + 2, z0 + d[1], AIR);
    // 中のランプ
    this.rawSet(x0, y0 + 4, z0, LAMP);
    this.houses.push({ x: x0 + 0.5, y: y0 + 1, z: z0 + 0.5, door: { x: x0 + d[0] * 1.6 + 0.5, z: z0 + d[1] * 1.6 + 0.5 } });
  }

  // ---- 保存 ----
  serialize() {
    const arr = []; for (const [i, id] of this.edits) arr.push(i, id);
    return { seed: this.seed, edits: arr };
  }
  applyEdits(arr) {
    for (let k = 0; k < arr.length; k += 2) { const i = arr[k], id = arr[k + 1]; this.data[i] = id; this.edits.set(i, id); }
  }

  // ---- レイキャスト(DDA) ----
  raycast(origin, dir, maxDist) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const tdx = sx ? Math.abs(1 / dir.x) : Infinity, tdy = sy ? Math.abs(1 / dir.y) : Infinity, tdz = sz ? Math.abs(1 / dir.z) : Infinity;
    let tmx = sx ? ((sx > 0 ? x + 1 - origin.x : origin.x - x) * tdx) : Infinity;
    let tmy = sy ? ((sy > 0 ? y + 1 - origin.y : origin.y - y) * tdy) : Infinity;
    let tmz = sz ? ((sz > 0 ? z + 1 - origin.z : origin.z - z) * tdz) : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= maxDist) {
      const b = this.get(x, y, z);
      if (b !== AIR && !BLOCKS[b].liquid) return { x, y, z, id: b, nx, ny, nz, dist: t };
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }
}

// ---- メッシュ化 ----
// 各面: 法線, 4頂点(反時計回り), 明るさ
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.8, t: 1 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.8, t: 1 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0, t: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5, t: 2 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.9, t: 1 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.7, t: 1 },
];
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const AO = [1, 0.78, 0.62, 0.48];
export const LIGHT_BOOST = 2.6;

export function buildChunkGeometry(world, cx, cz) {
  const out = { solid: newBuf(), water: newBuf() };
  const x0 = cx * CH, z0 = cz * CH;
  const eps = 0.02 / ATLAS_COLS;
  for (let y = 0; y < SY; y++) for (let z = z0; z < z0 + CH; z++) for (let x = x0; x < x0 + CH; x++) {
    const id = world.data[world.idx(x, y, z)];
    if (id === AIR) continue;
    const b = BLOCKS[id];
    const buf = b.liquid ? out.water : out.solid;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], nb = world.get(x + F.n[0], y + F.n[1], z + F.n[2]);
      if (b.liquid) { if (nb === WATER || (isOpaque(nb))) continue; }
      else if (isOpaque(nb) || (nb === id && !b.opaque)) continue;
      const tile = b.tiles[F.t], tu = (tile % ATLAS_COLS) / ATLAS_COLS, tv = 1 - ((tile / ATLAS_COLS | 0) + 1) / ATLAS_ROWS;
      const du = 1 / ATLAS_COLS - eps * 2, dv = 1 / ATLAS_ROWS - eps * 2;
      const base = buf.pos.length / 3;
      const aos = [];
      for (let v = 0; v < 4; v++) {
        const c = F.c[v];
        let px = x + c[0], py = y + c[1], pz = z + c[2];
        if (b.liquid && f !== 3 && c[1] === 1 && world.get(x, y + 1, z) !== WATER) py -= 0.12;
        buf.pos.push(px, py, pz);
        buf.uv.push(tu + eps + UVS[v][0] * du, tv + eps + UVS[v][1] * dv);
        let a = 0;
        if (!b.liquid) {
          // 角の3ブロックで環境光遮蔽
          const ax = [0, 0, 0], ay = [0, 0, 0];
          for (let k = 0, j = 0; k < 3; k++) { if (F.n[k] !== 0) continue; const d = c[k] === 1 ? 1 : -1; if (j === 0) ax[k] = d; else ay[k] = d; j++; }
          const bx = x + F.n[0], by = y + F.n[1], bz = z + F.n[2];
          const s1 = isOpaque(world.get(bx + ax[0], by + ax[1], bz + ax[2])) ? 1 : 0;
          const s2 = isOpaque(world.get(bx + ay[0], by + ay[1], bz + ay[2])) ? 1 : 0;
          const cc = isOpaque(world.get(bx + ax[0] + ay[0], by + ax[1] + ay[1], bz + ax[2] + ay[2])) ? 1 : 0;
          a = s1 && s2 ? 3 : s1 + s2 + cc;
        }
        aos.push(a);
        const l = b.light ? LIGHT_BOOST : F.s * AO[a];
        buf.col.push(l, l, l);
      }
      if (aos[0] + aos[2] > aos[1] + aos[3]) buf.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      else buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return { solid: toGeo(out.solid), water: toGeo(out.water) };
}
function newBuf() { return { pos: [], uv: [], col: [], idx: [] }; }
function toGeo(b) {
  if (!b.idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.setIndex(b.idx);
  g.computeBoundingSphere();
  return g;
}
