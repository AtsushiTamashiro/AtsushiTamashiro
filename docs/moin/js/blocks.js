// ブロック定義と、テクスチャ(16x16 ドット絵)をキャンバスで自前生成するアトラス
import * as THREE from 'three';

export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, LOG = 5, LEAVES = 6, PLANKS = 7,
  COBBLE = 8, GLASS = 9, WATER = 10, BRICK = 11, SNOW = 12, RED = 13, BLUE = 14, YELLOW = 15,
  MOIN = 16, BEDROCK = 17, ROOF = 18, LAMP = 19, GREEN = 20, PINK = 21;

// tiles: [上, 側面, 下] のタイル番号
export const BLOCKS = [];
function def(id, name, tiles, opt = {}) {
  BLOCKS[id] = { id, name, tiles: Array.isArray(tiles) ? tiles : [tiles, tiles, tiles],
    hard: opt.hard ?? 0.5, solid: opt.solid ?? true, opaque: opt.opaque ?? true,
    liquid: !!opt.liquid, breakable: opt.breakable ?? true, color: opt.color ?? '#888', light: !!opt.light };
}
def(AIR, '空気', 0, { solid: false, opaque: false, breakable: false });
def(GRASS, '草ブロック', [0, 1, 2], { hard: 0.45, color: '#6fb34a' });
def(DIRT, '土', 2, { hard: 0.4, color: '#8a5a35' });
def(STONE, '石', 3, { hard: 1.0, color: '#8d8f94' });
def(SAND, '砂', 4, { hard: 0.35, color: '#e6d39a' });
def(LOG, '丸太', [6, 5, 6], { hard: 0.8, color: '#7a5531' });
def(LEAVES, '葉っぱ', 7, { hard: 0.2, opaque: false, color: '#3f9a3a' });
def(PLANKS, '木の板', 8, { hard: 0.6, color: '#c39257' });
def(COBBLE, '丸石', 9, { hard: 1.0, color: '#7b7d82' });
def(GLASS, 'ガラス', 10, { hard: 0.3, opaque: false, color: '#cfefff' });
def(WATER, '水', 11, { solid: false, opaque: false, liquid: true, breakable: false, color: '#3a7bd5' });
def(BRICK, 'レンガ', 12, { hard: 1.0, color: '#b0533c' });
def(SNOW, '雪', 13, { hard: 0.3, color: '#f4f8ff' });
def(RED, 'あかブロック', 14, { hard: 0.4, color: '#e0473f' });
def(BLUE, 'あおブロック', 15, { hard: 0.4, color: '#3f6fe0' });
def(YELLOW, 'きいろブロック', 16, { hard: 0.4, color: '#f2c935' });
def(MOIN, 'モインブロック', 17, { hard: 0.5, color: '#ffb52e', light: true });
def(BEDROCK, '岩盤', 18, { breakable: false, color: '#333' });
def(ROOF, 'かわら', 19, { hard: 0.7, color: '#c4472e' });
def(LAMP, 'ランプ', 20, { hard: 0.3, color: '#ffe9a0', light: true });
def(GREEN, 'みどりブロック', 21, { hard: 0.4, color: '#3fbf5f' });
def(PINK, 'ももいろブロック', 22, { hard: 0.4, color: '#f28ab8' });

// インベントリで並べる順
export const PLACEABLE = [GRASS, DIRT, STONE, COBBLE, SAND, LOG, PLANKS, LEAVES, GLASS, BRICK, ROOF, SNOW,
  RED, YELLOW, GREEN, BLUE, PINK, LAMP, MOIN];

export const isSolid = id => BLOCKS[id]?.solid ?? false;
export const isOpaque = id => BLOCKS[id]?.opaque ?? false;

// ---- テクスチャ生成 ----
const T = 16, COLS = 8;
export const ATLAS_COLS = COLS;
export const ATLAS_ROWS = 4;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade([r, g, b], f) { return `rgb(${Math.max(0, Math.min(255, r * f)) | 0},${Math.max(0, Math.min(255, g * f)) | 0},${Math.max(0, Math.min(255, b * f)) | 0})`; }

function noiseTile(ctx, ox, oy, base, amt, seed, alpha = 1) {
  const r = rng(seed), c = hex(base);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    ctx.globalAlpha = alpha; ctx.fillStyle = shade(c, 1 - amt / 2 + r() * amt); ctx.fillRect(ox + x, oy + y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

const painters = {
  0(ctx, x, y) { noiseTile(ctx, x, y, '#67b043', 0.35, 11); }, // 草・上
  1(ctx, x, y) { // 草・横
    noiseTile(ctx, x, y, '#8a5a35', 0.35, 12);
    const r = rng(13);
    for (let i = 0; i < T; i++) { const h = 3 + (r() * 3 | 0); for (let j = 0; j < h; j++) { ctx.fillStyle = shade(hex('#67b043'), 0.8 + r() * 0.4); ctx.fillRect(x + i, y + j, 1, 1); } }
  },
  2(ctx, x, y) { noiseTile(ctx, x, y, '#8a5a35', 0.4, 14); },
  3(ctx, x, y) { noiseTile(ctx, x, y, '#8d8f94', 0.3, 15); const r = rng(16); ctx.fillStyle = 'rgba(60,60,66,.5)'; for (let i = 0; i < 6; i++) ctx.fillRect(x + (r() * 14 | 0), y + (r() * 15 | 0), 2 + (r() * 2 | 0), 1); },
  4(ctx, x, y) { noiseTile(ctx, x, y, '#e6d39a', 0.18, 17); },
  5(ctx, x, y) { // 丸太・横
    noiseTile(ctx, x, y, '#6e4a2a', 0.2, 18);
    ctx.fillStyle = 'rgba(40,25,10,.55)'; for (let i = 1; i < T; i += 4) ctx.fillRect(x + i, y, 1, T);
  },
  6(ctx, x, y) { // 丸太・断面
    noiseTile(ctx, x, y, '#6e4a2a', 0.2, 19);
    for (let r = 6; r > 0; r -= 2) { ctx.fillStyle = r % 4 === 0 ? '#c79a62' : '#b2844f'; ctx.fillRect(x + 8 - r, y + 8 - r, r * 2, r * 2); }
  },
  7(ctx, x, y) { // 葉っぱ(すき間あり)
    const r = rng(20);
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      if (r() < 0.18) continue;
      ctx.fillStyle = shade(hex('#3f9a3a'), 0.65 + r() * 0.6); ctx.fillRect(x + i, y + j, 1, 1);
    }
  },
  8(ctx, x, y) { // 木の板
    noiseTile(ctx, x, y, '#c39257', 0.15, 21);
    ctx.fillStyle = 'rgba(90,55,25,.6)'; for (let j = 3; j < T; j += 4) ctx.fillRect(x, y + j, T, 1);
    ctx.fillRect(x + 5, y, 1, 4); ctx.fillRect(x + 11, y + 4, 1, 4); ctx.fillRect(x + 3, y + 8, 1, 4); ctx.fillRect(x + 12, y + 12, 1, 4);
  },
  9(ctx, x, y) { // 丸石
    noiseTile(ctx, x, y, '#7b7d82', 0.2, 22);
    const r = rng(23); ctx.fillStyle = 'rgba(40,40,45,.6)';
    for (let i = 0; i < 9; i++) { const px = r() * 13 | 0, py = r() * 13 | 0; ctx.fillRect(x + px, y + py, 4, 1); ctx.fillRect(x + px, y + py, 1, 3); }
  },
  10(ctx, x, y) { // ガラス
    ctx.fillStyle = 'rgba(200,235,255,.25)'; ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
    ctx.fillStyle = '#e8f8ff'; ctx.fillRect(x, y, T, 1); ctx.fillRect(x, y + T - 1, T, 1); ctx.fillRect(x, y, 1, T); ctx.fillRect(x + T - 1, y, 1, T);
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(x + 3, y + 3, 1, 3); ctx.fillRect(x + 4, y + 3, 2, 1);
  },
  11(ctx, x, y) { noiseTile(ctx, x, y, '#3a7bd5', 0.15, 24, 0.85); },
  12(ctx, x, y) { // レンガ
    ctx.fillStyle = '#d8cfc4'; ctx.fillRect(x, y, T, T);
    const r = rng(25);
    for (let row = 0; row < 4; row++) for (let b = -1; b < 2; b++) {
      const off = row % 2 ? 4 : 0; ctx.fillStyle = shade(hex('#b0533c'), 0.85 + r() * 0.3);
      ctx.fillRect(x + Math.max(0, b * 8 + off), y + row * 4, Math.min(7, 7 + Math.min(0, b * 8 + off)), 3);
    }
  },
  13(ctx, x, y) { noiseTile(ctx, x, y, '#f4f8ff', 0.08, 26); },
  14(ctx, x, y) { wool(ctx, x, y, '#e0473f', 27); },
  15(ctx, x, y) { wool(ctx, x, y, '#3f6fe0', 28); },
  16(ctx, x, y) { wool(ctx, x, y, '#f2c935', 29); },
  17(ctx, x, y) { // モインブロック(にっこり顔)
    noiseTile(ctx, x, y, '#ffb52e', 0.12, 30);
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(x, y, T, 1); ctx.fillRect(x, y, 1, T);
    ctx.fillStyle = '#a0521a'; ctx.fillRect(x, y + T - 1, T, 1); ctx.fillRect(x + T - 1, y, 1, T);
    ctx.fillStyle = '#3b1c06';
    ctx.fillRect(x + 4, y + 4, 2, 3); ctx.fillRect(x + 10, y + 4, 2, 3);
    ctx.fillRect(x + 4, y + 10, 1, 1); ctx.fillRect(x + 5, y + 11, 6, 1); ctx.fillRect(x + 11, y + 10, 1, 1);
    ctx.fillRect(x + 6, y + 12, 4, 1);
    ctx.fillStyle = '#ff7b6b'; ctx.fillRect(x + 2, y + 8, 2, 1); ctx.fillRect(x + 12, y + 8, 2, 1);
  },
  18(ctx, x, y) { noiseTile(ctx, x, y, '#3a3a3e', 0.5, 31); },
  19(ctx, x, y) { // かわら(赤瓦)
    ctx.fillStyle = '#e9e1d6'; ctx.fillRect(x, y, T, T);
    for (let row = 0; row < 4; row++) { ctx.fillStyle = row % 2 ? '#b83c25' : '#cf5233'; ctx.fillRect(x, y + row * 4, T, 3);
      ctx.fillStyle = 'rgba(255,220,200,.35)'; ctx.fillRect(x, y + row * 4, T, 1); }
  },
  20(ctx, x, y) { // ランプ
    noiseTile(ctx, x, y, '#ffe9a0', 0.12, 32);
    ctx.fillStyle = '#8a6a2a'; ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y + T - 2, T, 2); ctx.fillRect(x, y, 2, T); ctx.fillRect(x + T - 2, y, 2, T);
    ctx.fillStyle = '#fffbe6'; ctx.fillRect(x + 6, y + 5, 4, 6);
  },
  21(ctx, x, y) { wool(ctx, x, y, '#3fbf5f', 33); },
  22(ctx, x, y) { wool(ctx, x, y, '#f28ab8', 34); },
};
function wool(ctx, x, y, c, seed) {
  noiseTile(ctx, x, y, c, 0.14, seed);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; for (let j = 1; j < T; j += 3) ctx.fillRect(x, y + j, T, 1);
}

let _atlasCanvas = null;
export function atlasCanvas() {
  if (_atlasCanvas) return _atlasCanvas;
  const c = document.createElement('canvas'); c.width = T * COLS; c.height = T * ATLAS_ROWS;
  const ctx = c.getContext('2d');
  for (const k in painters) { const i = +k; painters[k](ctx, (i % COLS) * T, (i / COLS | 0) * T); }
  return (_atlasCanvas = c);
}

export function makeAtlasTexture() {
  const tex = new THREE.CanvasTexture(atlasCanvas());
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ホットバー用のアイコン(側面のタイルを切り出す)
const iconCache = {};
export function blockIcon(id) {
  if (iconCache[id]) return iconCache[id];
  const b = BLOCKS[id], a = atlasCanvas(), c = document.createElement('canvas'); c.width = c.height = 48;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const top = b.tiles[0], side = b.tiles[1];
  const tx = t => [(t % COLS) * T, (t / COLS | 0) * T];
  // 簡易アイソメ: 上面と2側面
  ctx.save(); ctx.setTransform(1, 0.5, -1, 0.5, 24, 2); { const [sx, sy] = tx(top); ctx.drawImage(a, sx, sy, T, T, 0, 0, 22, 22); } ctx.restore();
  ctx.save(); ctx.setTransform(1, 0.5, 0, 1, 2, 13); { const [sx, sy] = tx(side); ctx.drawImage(a, sx, sy, T, T, 0, 0, 22, 22); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, 0, 22, 22); } ctx.restore();
  ctx.save(); ctx.setTransform(1, -0.5, 0, 1, 24, 24); { const [sx, sy] = tx(side); ctx.drawImage(a, sx, sy, T, T, 0, 0, 22, 22); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, 22, 22); } ctx.restore();
  return (iconCache[id] = c.toDataURL());
}
