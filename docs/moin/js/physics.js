// プレイヤーとNPC共通の、ブロックとの当たり判定(AABB)
import { BLOCKS, WATER } from './blocks.js';
import { SX, SZ, SY } from './world.js';

const E = 1e-4;
function solidAt(world, x, y, z) {
  if (x < 0 || z < 0 || x >= SX || z >= SZ) return true; // 世界の端は見えない壁
  if (y >= SY) return false;
  return BLOCKS[world.get(x, y, z)].solid;
}
export function collides(world, p, w, h) {
  const x0 = Math.floor(p.x - w), x1 = Math.floor(p.x + w - E);
  const y0 = Math.floor(p.y), y1 = Math.floor(p.y + h - E);
  const z0 = Math.floor(p.z - w), z1 = Math.floor(p.z + w - E);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
    if (solidAt(world, x, y, z)) return true;
  return false;
}
export function inWater(world, p, h = 0.5) { return world.get(Math.floor(p.x), Math.floor(p.y + h), Math.floor(p.z)) === WATER; }

// b: { pos, vel, w, h } → onGround / hitWall を更新
export function moveBody(world, b, dt) {
  b.onGround = false; b.hitWall = false;
  const maxV = Math.max(Math.abs(b.vel.x), Math.abs(b.vel.y), Math.abs(b.vel.z));
  const steps = Math.max(1, Math.ceil(maxV * dt / 0.35));
  const sdt = dt / steps, p = b.pos, w = b.w, h = b.h;
  for (let s = 0; s < steps; s++) {
    // Y
    let d = b.vel.y * sdt;
    if (d) {
      p.y += d;
      if (collides(world, p, w, h)) {
        if (d < 0) { p.y = Math.floor(p.y) + 1; b.onGround = true; } else p.y = Math.floor(p.y + h) - h - E;
        b.vel.y = 0;
      }
    }
    // X
    d = b.vel.x * sdt;
    if (d) {
      p.x += d;
      if (collides(world, p, w, h)) { p.x = d > 0 ? Math.floor(p.x + w) - w - E : Math.floor(p.x - w) + 1 + w + E; b.vel.x = 0; b.hitWall = true; }
    }
    // Z
    d = b.vel.z * sdt;
    if (d) {
      p.z += d;
      if (collides(world, p, w, h)) { p.z = d > 0 ? Math.floor(p.z + w) - w - E : Math.floor(p.z - w) + 1 + w + E; b.vel.z = 0; b.hitWall = true; }
    }
  }
  // 地面に立っているかの確認(速度0でも)
  if (!b.onGround && b.vel.y <= 0) { p.y -= 0.02; if (collides(world, p, w, h)) b.onGround = true; p.y += 0.02; }
}
