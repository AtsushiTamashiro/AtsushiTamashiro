// プレイヤー・敵・投石・アイテム
import * as THREE from 'three';
import { Humanoid, Boar, Habu } from './characters.js';
import { clamp, damp, dampAngle, wrapAngle, lerp } from './util.js';

const UNARMED = [
  { anim: 'punchR', dur: 0.36, hit: [0.25, 0.48], range: 1.9, arc: 1.1, dmg: 9, knock: 3, lunge: 3.5 },
  { anim: 'punchL', dur: 0.36, hit: [0.25, 0.48], range: 1.9, arc: 1.1, dmg: 10, knock: 3, lunge: 3.5 },
  { anim: 'kick', dur: 0.56, hit: [0.3, 0.52], range: 2.4, arc: 1.2, dmg: 18, knock: 9, lunge: 4.5, heavy: true },
];
const BO = [
  { anim: 'boSwingR', dur: 0.46, hit: [0.3, 0.56], range: 3.2, arc: 2.0, dmg: 15, knock: 5, lunge: 2.5 },
  { anim: 'boSwingL', dur: 0.46, hit: [0.3, 0.56], range: 3.2, arc: 2.0, dmg: 16, knock: 5, lunge: 2.5 },
  { anim: 'boThrust', dur: 0.6, hit: [0.35, 0.56], range: 3.8, arc: 0.7, dmg: 30, knock: 12, lunge: 6, heavy: true },
];
const _v = new THREE.Vector3();

function flatDist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

// ================= プレイヤー =================
export class Player {
  constructor(game) {
    this.g = game;
    this.model = new Humanoid({ robe: '#cdbb8e', sleeve: '#c4b083', belt: '#2b4566', headband: '#2b4566', skin: '#cf9a70' });
    game.scene.add(this.model.root);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = Math.PI; this.maxHp = 100; this.hp = 100; this.st = 100; this.ki = 0; this.radius = 0.45;
    this.state = 'move'; this.t = 0; this.a = 0; this.combo = 0; this.comboGap = 9; this.queued = false;
    this.hitSet = new Set(); this.iframe = 0; this.onGround = true; this.weapon = null; this.stDelay = 0; this.blockT = 0;
    this.phase = 0; this.time = 0; this.lock = null; this.special = 0; this.dustT = 0; this.flash = 0;
    this.stats = { kills: 0, damage: 0, parries: 0 };
  }
  setWeapon(w) { this.weapon = w; this.model.setWeapon(w); }
  spawnAt(x, z, yaw) { this.pos.set(x, this.g.world.heightAt(x, z), z); this.vel.set(0, 0, 0); this.yaw = yaw; this.state = 'move'; this.hp = this.maxHp; this.st = 100; this.model.root.position.copy(this.pos); }
  get forward() { return _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  get alive() { return this.state !== 'dead'; }

  startAttack() {
    const set = this.weapon === 'bo' ? BO : UNARMED;
    if (this.comboGap > 0.55 || this.combo >= set.length) this.combo = 0;
    this.atk = set[this.combo]; this.combo++;
    this.state = 'attack'; this.t = 0; this.queued = false; this.hitSet.clear();
    // 自動照準
    const tgt = this.lock && this.lock.alive ? this.lock : this.g.nearestEnemy(this.pos, 6, this.inputDir.lengthSq() > 0.01 ? Math.atan2(this.inputDir.x, this.inputDir.z) : this.yaw, 1.6);
    if (tgt) this.yaw = Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z);
    else if (this.inputDir.lengthSq() > 0.01) this.yaw = Math.atan2(this.inputDir.x, this.inputDir.z);
    this.g.audio.play(this.atk.heavy ? 'swingBig' : 'swing');
  }
  update(dt, inp) {
    const g = this.g, w = g.world; this.time += dt; this.t += dt; this.comboGap += dt; this.iframe -= dt; this.flash -= dt;
    this.inputDir = new THREE.Vector3(inp.mx, 0, inp.mz);
    const moveLen = Math.min(1, this.inputDir.length());
    if (this.state === 'dead') { this.a = Math.min(1, this.a + dt * 0.8); this.model.animate(dt, { t: this.time, action: 'dead', a: this.a }); this.syncModel(); return; }
    if (inp.lock) { this.lock = this.lock ? null : g.nearestEnemy(this.pos, 22, g.camYawForward(), 1.2); }
    if (this.lock && (!this.lock.alive || flatDist(this.lock.pos, this.pos) > 28)) this.lock = null;
    const busy = this.state === 'attack' || this.state === 'dodge' || this.state === 'hit' || this.state === 'special' || this.state === 'talk';

    // ---- 入力による状態遷移 ----
    if (this.state === 'talk') { /* 会話中は停止 */ }
    else if (inp.special && this.ki >= 100 && this.state !== 'special' && this.state !== 'hit') {
      this.state = 'special'; this.t = 0; this.ki = 0; this.special = 0; g.audio.play('special'); g.fx.ring(this.pos, 0.5, 5, 0.5, '#9fd8ff'); g.shake(0.4); g.slowmo(0.25);
      g.toast('唐手奥義・旋風!');
    } else if (inp.dodge && this.st >= 12 && (this.state === 'move' || this.state === 'block' || (this.state === 'attack' && this.t / this.atk.dur > this.atk.hit[1]))) {
      this.state = 'dodge'; this.t = 0; this.st -= 22; this.stDelay = 0.6;
      const d = moveLen > 0.1 ? this.inputDir.clone().normalize() : this.forward.clone().multiplyScalar(-1);
      this.dodgeDir = d; if (moveLen > 0.1) this.yaw = Math.atan2(d.x, d.z);
      g.audio.play('dodge'); g.fx.dust(this.pos, 6);
    } else if (inp.attack && this.state !== 'dodge' && this.state !== 'hit' && this.state !== 'special') {
      if (this.state === 'attack') this.queued = true; else this.startAttack();
    } else if (inp.jump && this.onGround && (this.state === 'move' || this.state === 'block')) {
      this.vel.y = 9.5; this.onGround = false; this.state = 'move'; g.audio.play('jump');
    }
    if (this.state === 'move' && inp.block && this.onGround) { this.state = 'block'; this.blockT = 0; }
    if (this.state === 'block') { this.blockT += dt; if (!inp.block) this.state = 'move'; }

    // ---- 状態ごとの移動 ----
    let action = null, a = 0, speedAnim = 0;
    const hv = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    if (this.state === 'move' || this.state === 'block') {
      const sp = this.state === 'block' ? 2.2 : 7.6;
      const des = this.inputDir.clone().multiplyScalar(sp * (moveLen > 1 ? 1 / moveLen : 1));
      const k = this.onGround ? 12 : 3;
      hv.x = damp(hv.x, des.x, k, dt); hv.z = damp(hv.z, des.z, k, dt);
      if (this.state === 'block') { action = 'block'; const tg = this.lock || g.nearestEnemy(this.pos, 8, this.yaw, 3.2); if (tg) this.yaw = dampAngle(this.yaw, Math.atan2(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z), 10, dt); }
      else if (moveLen > 0.1) {
        let ty = Math.atan2(this.inputDir.x, this.inputDir.z);
        this.yaw = dampAngle(this.yaw, ty, 14, dt);
      }
      speedAnim = hv.length() / 7.6;
    } else if (this.state === 'attack') {
      const A = this.atk; a = this.t / A.dur; action = A.anim;
      const f = this.forward; const lk = a < A.hit[1] ? A.lunge * (1 - a / A.hit[1]) : 0;
      // 近すぎる敵の手前で止まる
      const tg = g.nearestEnemy(this.pos, 1.3, this.yaw, 0.8);
      const lunge = tg ? 0 : lk;
      hv.x = f.x * lunge; hv.z = f.z * lunge;
      if (a >= A.hit[0] && a <= A.hit[1]) this.doHits(A);
      if (a >= 1) {
        this.comboGap = 0;
        const set = this.weapon === 'bo' ? BO : UNARMED;
        if (this.queued && this.combo < set.length) this.startAttack(); else { this.state = 'move'; if (this.combo >= set.length) this.combo = 0; }
      }
    } else if (this.state === 'dodge') {
      a = this.t / 0.42; action = 'dodge';
      const sp = 12.5 * Math.pow(Math.max(0, 1 - a), 0.6);
      hv.x = this.dodgeDir.x * sp; hv.z = this.dodgeDir.z * sp;
      if (a >= 1) { this.state = 'move'; }
    } else if (this.state === 'hit') {
      action = this.hitStun > 0.6 ? 'stagger' : 'hit'; hv.multiplyScalar(Math.max(0, 1 - 6 * dt));
      if (this.t >= this.hitStun) this.state = 'move';
    } else if (this.state === 'special') {
      a = this.t / 1.2; action = 'spin'; hv.multiplyScalar(0.9);
      this.special -= dt;
      if (this.special <= 0) {
        this.special = 0.14;
        for (const e of g.enemies) if (e.alive && flatDist(e.pos, this.pos) < 4.6 + e.radius) { e.takeHit(12, this.pos, 6, true); this.stats.damage += 12; g.fx.hit(e.chestPos(), true); }
        g.fx.ki(this.chestPos());
      }
      if (a >= 1) this.state = 'move';
    } else if (this.state === 'talk') { hv.set(0, 0, 0); }

    this.vel.x = hv.x; this.vel.z = hv.z;
    // 重力
    this.vel.y -= 28 * dt;
    this.pos.addScaledVector(this.vel, dt);
    w.resolve(this.pos, this.radius); w.clampCorridor(this.pos);
    g.applyArena(this.pos);
    const gh = w.heightAt(this.pos.x, this.pos.z);
    if (this.pos.y <= gh) {
      if (!this.onGround && this.vel.y < -6) g.fx.dust(this.pos, 5);
      this.pos.y = gh; this.vel.y = 0; this.onGround = true;
    } else if (this.onGround && this.vel.y <= 0 && this.pos.y - gh < 0.6) { this.pos.y = gh; this.vel.y = 0; }
    else this.onGround = false;

    // スタミナ
    this.stDelay -= dt;
    if (this.stDelay <= 0 && this.state !== 'block') this.st = Math.min(100, this.st + 30 * dt);
    if (this.state === 'block') this.st = Math.min(100, this.st + 6 * dt);

    // 歩行サイクル
    this.phase += dt * hv.length() * 1.55;
    this.dustT -= dt; if (this.onGround && speedAnim > 0.7 && this.dustT <= 0) { this.dustT = 0.28; g.fx.dust(this.pos, 1); }
    this.model.animate(dt, { t: this.time, speed: speedAnim, phase: this.phase, air: !this.onGround && this.state === 'move', guard: g.inCombat, action, a });
    this.model.mats.flash(this.flash > 0 ? 0.8 * this.flash / 0.15 : (this.iframe > 0 && this.state === 'move' ? 0.0 : 0), '#ff3020');
    this.syncModel();
  }
  syncModel() { this.model.root.position.copy(this.pos); this.model.root.rotation.y = this.yaw; }
  chestPos() { return new THREE.Vector3(this.pos.x, this.pos.y + 1.3, this.pos.z); }
  doHits(A) {
    const g = this.g;
    for (const e of g.enemies) {
      if (!e.alive || this.hitSet.has(e)) continue;
      const dx = e.pos.x - this.pos.x, dz = e.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > A.range + e.radius || Math.abs(e.pos.y - this.pos.y) > 2.2) continue;
      const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - this.yaw));
      if (ang > A.arc && d > e.radius + 0.4) continue;
      this.hitSet.add(e);
      let dmg = A.dmg * (0.9 + Math.random() * 0.2);
      if (e.state === 'stagger') dmg *= 1.6;
      dmg = Math.round(dmg);
      e.takeHit(dmg, this.pos, A.knock, A.heavy);
      this.stats.damage += dmg;
      this.ki = Math.min(100, this.ki + (A.heavy ? 9 : 6)); if (this.ki >= 100 && !this.kiFull) { this.kiFull = true; g.audio.play('ki'); g.toast('気が満ちた! [R] で奥義'); }
      g.fx.hit(e.chestPos(), A.heavy); g.audio.play(A.heavy ? 'hitHeavy' : 'hit');
      g.hitstop(A.heavy ? 0.09 : 0.05); g.shake(A.heavy ? 0.25 : 0.12);
      g.damageNumber(e.chestPos(), dmg, e.state === 'stagger' || A.heavy);
    }
    if (this.ki < 100) this.kiFull = false;
  }
  // 戻り値: 'miss' | 'hit' | 'block' | 'parry'
  takeHit(dmg, from, knock = 4, opts = {}) {
    const g = this.g;
    if (this.state === 'dead' || this.iframe > 0 || this.state === 'special' || g.cinematic) return 'miss';
    if (this.state === 'dodge' && this.t < 0.34) { if (!this.perfectDodgeT || this.time - this.perfectDodgeT > 1) { this.perfectDodgeT = this.time; this.ki = Math.min(100, this.ki + 8); } return 'miss'; }
    const dx = from.x - this.pos.x, dz = from.z - this.pos.z, dirTo = Math.atan2(dx, dz);
    const front = Math.abs(wrapAngle(dirTo - this.yaw)) < 1.5;
    const away = new THREE.Vector3(-dx, 0, -dz).normalize();
    if (this.state === 'block' && front && !opts.unblockable) {
      if (this.blockT < 0.22) {
        this.ki = Math.min(100, this.ki + 25); this.stats.parries++;
        g.fx.parry(this.chestPos()); g.audio.play('parry'); g.slowmo(0.35); g.toast('見切り!'); g.shake(0.15);
        return 'parry';
      }
      this.st -= dmg * 2.2; this.stDelay = 0.7;
      if (this.st <= 0) {
        this.st = 0; this.state = 'hit'; this.t = 0; this.hitStun = 0.9; this.vel.copy(away.multiplyScalar(6));
        this.damage(Math.round(dmg * 0.5)); g.toast('防御が崩れた!'); g.audio.play('hurt');
        return 'hit';
      }
      this.damage(Math.max(1, Math.round(dmg * 0.1)), true); this.vel.copy(away.multiplyScalar(knock * 0.5));
      g.fx.block(this.chestPos()); g.audio.play('block');
      return 'block';
    }
    this.damage(dmg);
    if (this.state === 'dead') return 'hit';
    this.state = 'hit'; this.t = 0; this.hitStun = knock > 8 ? 0.65 : 0.38; this.iframe = 0.45; this.combo = 0;
    this.vel.x = away.x * knock; this.vel.z = away.z * knock; if (knock > 8) this.vel.y = 4;
    g.audio.play('hurt'); g.fx.blood(this.chestPos()); g.shake(0.3); this.flash = 0.15;
    return 'hit';
  }
  damage(n, quiet) {
    this.hp -= n; this.g.ui.hurtFlash(); this.g.stats.taken += n;
    if (this.hp <= 0) { this.hp = 0; this.state = 'dead'; this.a = 0; this.g.onPlayerDeath(); }
  }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); this.g.fx.heal(this.chestPos()); }
}

// ================= 敵 =================
export const ENEMY_TYPES = {
  pirate: { name: '海賊', hp: 50, speed: 4.3, dmg: 12, range: 2.1, aggro: 17, cd: [1.0, 2.2], kind: 'human', attacks: ['slash'],
    model: { robe: '#2b3446', sleeve: '#2b3446', pants: '#1c2029', skirt: false, scarf: '#a3242a', weapon: 'sword', skin: '#c08a60', belt: '#5a1a1a' } },
  bandit: { name: '山賊', hp: 62, speed: 4.0, dmg: 14, range: 2.2, aggro: 16, cd: [1.1, 2.4], kind: 'human', attacks: ['slash'],
    model: { robe: '#6b5236', sleeve: '#5a452c', pants: '#3e2f20', skirt: false, scarf: '#3e3a24', weapon: 'club', beard: true, skin: '#b58058' } },
  thrower: { name: '投石の海賊', hp: 34, speed: 3.9, dmg: 9, range: 12, aggro: 20, cd: [1.8, 3.0], kind: 'human', ranged: true, attacks: ['throw'],
    model: { robe: '#3b4a3a', sleeve: '#3b4a3a', pants: '#232a22', skirt: false, scarf: '#c48a2a', weapon: null, skin: '#c08a60' } },
  brute: { name: '大男', hp: 150, speed: 3.3, dmg: 22, range: 2.8, aggro: 16, cd: [1.6, 2.8], kind: 'human', armor: true, attacks: ['slam', 'slash'], scale: 1.3, build: 1.3,
    model: { robe: '#5a2a24', sleeve: '#4a221d', pants: '#2a1a16', skirt: false, scarf: null, weapon: 'club', beard: true, skin: '#a87452', hair: '#221a14' } },
  boar: { name: 'イノシシ', hp: 42, speed: 3.2, dmg: 15, range: 9, aggro: 14, cd: [1.6, 2.6], kind: 'boar', radius: 0.7 },
  habu: { name: 'ハブ', hp: 18, speed: 2.6, dmg: 10, range: 3.4, aggro: 9, cd: [1.0, 1.8], kind: 'habu', radius: 0.4 },
  boss: { name: '海賊頭 黒鮫', hp: 700, speed: 5.0, dmg: 18, range: 2.8, aggro: 30, cd: [0.6, 1.3], kind: 'human', boss: true, armor: true, attacks: ['combo', 'thrust', 'slam'], scale: 1.4, build: 1.25,
    model: { robe: '#17171e', sleeve: '#5a1218', pants: '#101014', skirt: false, scarf: '#c9971f', weapon: 'bigsword', beard: true, skin: '#b07a52', belt: '#c9971f' } },
};

const warnTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#ff3b2b'; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 32, 35);
  return new THREE.CanvasTexture(c);
})();

export class Enemy {
  constructor(game, type, x, z, opts = {}) {
    this.g = game; this.type = type; const T = (this.T = ENEMY_TYPES[type]);
    this.name = T.name; this.maxHp = T.hp; this.hp = T.hp; this.radius = T.radius || 0.45 * (T.scale || 1);
    if (T.kind === 'human') this.model = new Humanoid({ ...T.model, scale: T.scale || 1, build: T.build || 1 });
    else if (T.kind === 'boar') this.model = new Boar(1);
    else this.model = new Habu();
    game.scene.add(this.model.root);
    this.home = new THREE.Vector3(x, 0, z); this.pos = new THREE.Vector3(x, game.world.heightAt(x, z), z); this.vel = new THREE.Vector3();
    this.yaw = opts.yaw ?? Math.random() * 6; this.state = 'idle'; this.t = 0; this.time = Math.random() * 10; this.phase = 0;
    this.cd = 1 + Math.random(); this.strafe = Math.random() < 0.5 ? 1 : -1; this.flash = 0; this.dormant = !!opts.dormant;
    this.warn = new THREE.Sprite(new THREE.SpriteMaterial({ map: warnTex, depthTest: false, transparent: true })); this.warn.scale.set(0.5, 0.5, 1); this.warn.visible = false; this.warn.renderOrder = 10;
    game.scene.add(this.warn);
    this.headH = T.kind === 'human' ? 2.2 * (T.scale || 1) : T.kind === 'boar' ? 1.4 : 0.8;
    this.wander = 0; this.deadT = 0; this.phase2 = false; this.comboN = 0;
    this.syncModel();
  }
  get alive() { return this.state !== 'dead'; }
  chestPos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.headH * 0.6, this.pos.z); }
  reset() {
    this.hp = this.maxHp; this.pos.set(this.home.x, this.g.world.heightAt(this.home.x, this.home.z), this.home.z); this.vel.set(0, 0, 0);
    this.state = 'idle'; this.t = 0; this.cd = 1.5; this.releaseToken(); this.phase2 = false; this.comboN = 0;
    this.model.root.visible = true; this.model.mats.setOpacity(1);
  }
  releaseToken() { if (this.hasToken) { this.hasToken = false; this.g.tokens--; } }
  aggro() {
    if (this.state !== 'idle' || this.dormant) return;
    this.state = 'chase'; this.t = 0; this.cd = 0.6 + Math.random() * 0.8;
    if (this.type === 'boar') this.g.audio.play('grunt'); if (this.type === 'habu') this.g.audio.play('hiss');
    for (const e of this.g.enemies) if (e !== this && e.state === 'idle' && !e.dormant && flatDist(e.pos, this.pos) < 14) e.aggro();
  }
  takeHit(dmg, from, knock, heavy) {
    if (!this.alive) return;
    this.hp -= dmg; this.flash = 0.12;
    if (this.state === 'idle') this.aggro();
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    if (this.hp <= 0) {
      this.hp = 0; this.state = 'dead'; this.t = 0; this.releaseToken(); this.warn.visible = false;
      this.vel.set((dx / d) * knock * 1.3, 3, (dz / d) * knock * 1.3); this.g.onEnemyDeath(this); this.g.audio.play('die');
      return;
    }
    const armored = this.T.armor && !heavy && (this.state === 'attack' || this.T.boss);
    const kmul = this.T.boss ? 0.25 : this.T.armor ? 0.5 : 1;
    this.vel.x = (dx / d) * knock * kmul; this.vel.z = (dz / d) * knock * kmul;
    if (this.state === 'stagger') return;
    if (armored) return;
    if (this.state === 'charge' && this.type === 'boar' && !heavy) return;
    this.releaseToken(); this.state = 'hit'; this.t = 0; this.hitDur = heavy ? 0.55 : 0.32;
    if (this.T.boss) this.hitDur = 0.3;
    this.cd = Math.max(this.cd, 0.3);
  }
  stagger(dur = 1.4) { this.releaseToken(); this.state = 'stagger'; this.t = 0; this.stagDur = dur; this.warn.visible = false; }
  pickAttack() {
    const T = this.T, P = this.g.player;
    if (T.boss) {
      const d = flatDist(P.pos, this.pos), r = Math.random();
      if (d > 6) return r < 0.7 ? 'thrust' : 'slam';
      if (this.phase2 && r < 0.3) return 'slam';
      return r < 0.6 ? 'combo' : r < 0.8 ? 'slam' : 'thrust';
    }
    return T.attacks[Math.floor(Math.random() * T.attacks.length)];
  }
  // 攻撃の時間配分
  atkSpec(name) {
    const sp = this.phase2 ? 0.8 : 1;
    switch (name) {
      case 'slash': return { anim: 'slash', dur: (this.type === 'brute' ? 1.25 : 1.05) * sp, hit: [0.5, 0.63], range: this.T.range, arc: 1.0, dmg: this.T.dmg, knock: this.type === 'brute' ? 9 : 5 };
      case 'combo': return { anim: 'slash', dur: 0.82 * sp, hit: [0.5, 0.64], range: 3.0, arc: 1.1, dmg: this.T.dmg, knock: 5 };
      case 'slam': return { anim: 'slam', dur: (this.T.boss ? 1.5 : 1.4) * sp, hit: [0.56, 0.62], range: this.T.boss ? 5 : 3.2, arc: 3.2, dmg: this.T.dmg + 8, knock: 12, aoe: true, unblockable: !!this.T.boss };
      case 'thrust': return { anim: 'thrust', dur: 1.15 * sp, hit: [0.36, 0.55], range: 2.6, arc: 0.9, dmg: this.T.dmg + 4, knock: 10, dash: 16 };
      case 'throw': return { anim: 'throw', dur: 1.15, release: 0.6, hit: [2, 2] };
    }
  }
  update(dt) {
    const g = this.g, P = g.player, w = g.world; this.time += dt; this.t += dt; this.flash -= dt;
    const dP = flatDist(P.pos, this.pos), toP = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    // 遠くの敵は休眠
    if (dP > 80 && this.state !== 'dead') { this.model.root.visible = false; this.warn.visible = false; return; }
    this.model.root.visible = true;
    let action = null, a = 0, speed = 0; const T = this.T;
    const hv = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    const decay = () => hv.multiplyScalar(Math.max(0, 1 - 8 * dt));
    const moveTo = (dir, sp) => { hv.x = damp(hv.x, Math.sin(dir) * sp, 8, dt); hv.z = damp(hv.z, Math.cos(dir) * sp, 8, dt); };
    const pAlive = P.alive && !g.cinematic;
    switch (this.state) {
      case 'idle': {
        if (pAlive && dP < T.aggro && !this.dormant) this.aggro();
        this.wander -= dt;
        if (this.wander < 0) { this.wander = 2 + Math.random() * 3; this.wdir = Math.random() < 0.5 ? null : Math.random() * 6; if (this.home.distanceTo(_v.set(this.pos.x, 0, this.pos.z)) > 5) this.wdir = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z); }
        if (this.wdir != null && !this.dormant) { moveTo(this.wdir, 1.2); this.yaw = dampAngle(this.yaw, this.wdir, 4, dt); } else decay();
        break;
      }
      case 'chase': {
        if (!pAlive) { this.state = 'idle'; break; }
        this.cd -= dt;
        this.yaw = dampAngle(this.yaw, toP, 8, dt);
        const sp = T.speed * (this.phase2 ? 1.25 : 1);
        if (T.ranged) {
          // 間合いを保つ
          if (dP > 11) moveTo(toP, sp); else if (dP < 7) moveTo(toP + Math.PI, sp * 0.8); else moveTo(toP + this.strafe * Math.PI / 2, sp * 0.5);
          if (this.cd <= 0 && dP < 15) { this.beginAttack('throw'); }
        } else if (this.type === 'boar') {
          if (dP > 10) moveTo(toP, sp * 1.4); else decay();
          if (this.cd <= 0 && dP < 12) { this.state = 'windup'; this.t = 0; g.audio.play('grunt'); }
        } else if (this.type === 'habu') {
          if (dP > 3) moveTo(toP, sp); else decay();
          if (this.cd <= 0 && dP < 3.6) { this.state = 'windup'; this.t = 0; g.audio.play('hiss'); }
        } else {
          const want = T.range * 0.85;
          const canAtk = T.boss || g.tokens < 2 || this.hasToken;
          if (dP > want + (canAtk ? 0 : 2.5)) moveTo(toP, dP > 10 ? sp * 1.15 : sp);
          else if (!canAtk || this.cd > 0) moveTo(toP + this.strafe * (Math.PI / 2 + 0.2), sp * 0.45);
          else decay();
          if (Math.random() < dt * 0.3) this.strafe *= -1;
          if (this.cd <= 0 && canAtk && dP < T.range + (T.boss ? 5 : 0.5)) {
            if (!T.boss) { this.hasToken = true; g.tokens++; }
            this.beginAttack(this.pickAttack());
          }
        }
        speed = hv.length() / 4.5;
        break;
      }
      case 'attack': {
        const A = this.atk; a = this.t / A.dur; action = A.anim;
        if (a < A.hit[0] - 0.08 && !A.dash) this.yaw = dampAngle(this.yaw, toP, T.boss ? 7 : 5, dt);
        else if (A.dash && a < A.hit[0]) this.yaw = dampAngle(this.yaw, toP, 6, dt);
        this.warn.visible = a < A.hit[0] && !A.release;
        if (A.release) this.warn.visible = a < A.release;
        if (A.dash && a >= A.hit[0] && a < A.hit[1]) { hv.x = Math.sin(this.yaw) * A.dash; hv.z = Math.cos(this.yaw) * A.dash; }
        else if (a >= A.hit[0] - 0.05 && a < A.hit[1] && !A.aoe) { hv.x = Math.sin(this.yaw) * 2.5; hv.z = Math.cos(this.yaw) * 2.5; }
        else decay();
        if (A.aoe && a < A.hit[0]) { if (!this.aoeShown) { this.aoeShown = true; g.showDanger(this.aoeCenter(A), A.range, A.dur * A.hit[0]); } }
        if (A.release && a >= A.release && !this.thrown) { this.thrown = true; g.throwStone(this, P); g.audio.play('swing'); }
        if (A.hit && a >= A.hit[0] && a <= A.hit[1] && !this.didHit) this.tryHit(A);
        if (A.aoe && a >= A.hit[0] && !this.slammed) { this.slammed = true; const c = this.aoeCenter(A); g.fx.ring(c, 0.5, A.range, 0.4, '#ffb070'); g.fx.dust(c, 14); g.audio.play('slam'); g.shake(0.35); }
        if (a >= 1) {
          if (this.atkName === 'combo' && this.comboN < (this.phase2 ? 3 : 2)) { this.comboN++; this.beginAttack('combo', true); break; }
          this.releaseToken(); this.state = 'chase'; this.cd = T.cd[0] + Math.random() * (T.cd[1] - T.cd[0]); if (T.boss && this.phase2) this.cd *= 0.7;
          this.comboN = 0;
        }
        break;
      }
      case 'windup': { // イノシシ・ハブの予備動作
        action = 'windup'; this.yaw = dampAngle(this.yaw, toP, 6, dt); decay(); this.warn.visible = true;
        const wd = this.type === 'boar' ? 0.85 : 0.55;
        if (this.t >= wd) { this.state = this.type === 'boar' ? 'charge' : 'lunge'; this.t = 0; this.didHit = false; this.warn.visible = false; this.cdir = this.yaw; }
        break;
      }
      case 'charge': {
        speed = 1.5; hv.x = Math.sin(this.cdir) * 14; hv.z = Math.cos(this.cdir) * 14;
        if (!this.didHit && dP < 1.4 && pAlive) { this.didHit = true; const r = P.takeHit(T.dmg, this.pos, 11); if (r === 'parry') this.stagger(1.6); }
        if (this.t > 1.0) { this.state = 'recover'; this.t = 0; }
        break;
      }
      case 'lunge': {
        action = 'lunge'; hv.x = Math.sin(this.cdir) * 11; hv.z = Math.cos(this.cdir) * 11;
        if (!this.didHit && dP < 1.0 && pAlive) { this.didHit = true; const r = P.takeHit(T.dmg, this.pos, 3); if (r === 'parry') this.stagger(1.5); }
        if (this.t > 0.28) { this.state = 'recover'; this.t = 0; }
        break;
      }
      case 'recover': decay(); if (this.t > (this.type === 'boar' ? 1.1 : 0.8)) { this.state = 'chase'; this.cd = T.cd[0] + Math.random() * (T.cd[1] - T.cd[0]); } break;
      case 'hit': action = this.T.kind === 'human' ? 'hit' : 'hit'; decay(); this.warn.visible = false; if (this.t > this.hitDur) { this.state = 'chase'; } break;
      case 'stagger': action = this.T.kind === 'human' ? 'stagger' : 'hit'; decay(); if (this.t > this.stagDur) { this.state = 'chase'; this.cd = 0.4; } break;
      case 'dead': {
        action = 'dead'; a = Math.min(1, this.t / 1.2); decay(); this.deadT += dt;
        if (this.deadT > 2.5) { const o = Math.max(0, 1 - (this.deadT - 2.5)); this.model.mats.setOpacity(o); if (o <= 0) this.model.root.visible = false; }
        break;
      }
      case 'roar': action = 'roar'; decay(); if (this.t > 1.6) { this.state = 'chase'; this.cd = 0.5; } break;
    }
    if (this.state !== 'attack' && this.state !== 'windup') this.warn.visible = false;
    if (this.T.boss && !this.phase2 && this.hp < this.maxHp * 0.5 && this.alive && this.state !== 'attack') {
      this.phase2 = true; this.state = 'roar'; this.t = 0; g.onBossPhase2(this);
    }
    this.vel.x = hv.x; this.vel.z = hv.z; this.vel.y -= 25 * dt;
    if (this.state !== 'dead' || this.deadT < 1) {
      this.pos.addScaledVector(this.vel, dt);
      if (this.state !== 'dead') {
        // 敵同士の押し合い
        for (const o of g.enemies) {
          if (o === this || !o.alive) continue; const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d = Math.hypot(dx, dz), m = this.radius + o.radius;
          if (d < m && d > 1e-4) { this.pos.x += (dx / d) * (m - d) * 0.5; this.pos.z += (dz / d) * (m - d) * 0.5; }
        }
        if (P.alive) { const dx = this.pos.x - P.pos.x, dz = this.pos.z - P.pos.z, d = Math.hypot(dx, dz), m = this.radius + P.radius; if (d < m && d > 1e-4) { this.pos.x += (dx / d) * (m - d); this.pos.z += (dz / d) * (m - d); } }
        const bumped = w.resolve(this.pos, this.radius); if (bumped && this.state === 'charge') { this.state = 'stagger'; this.t = 0; this.stagDur = 1.2; g.shake(0.2); }
        w.clampCorridor(this.pos); if (T.boss || g.arena) g.applyArena(this.pos);
      }
    }
    const gh = w.heightAt(this.pos.x, this.pos.z); if (this.pos.y <= gh) { this.pos.y = gh; this.vel.y = 0; }
    this.phase += dt * hv.length() * (this.type === 'boar' ? 2.2 : this.type === 'habu' ? 1.3 : 1.55);
    this.model.animate(dt, { t: this.time, speed: this.type === 'habu' ? hv.length() / 3 : speed || hv.length() / 4.5, phase: this.phase, guard: this.state === 'chase', action, a });
    this.model.mats.flash(this.flash > 0 ? 1.2 * this.flash / 0.12 : this.state === 'stagger' ? 0.35 + 0.25 * Math.sin(this.time * 20) : 0, this.state === 'stagger' && this.flash <= 0 ? '#3aa0ff' : '#ffffff');
    this.syncModel();
  }
  aoeCenter(A) { return new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * (this.T.boss ? 1.5 : 1.2), this.pos.y, this.pos.z + Math.cos(this.yaw) * (this.T.boss ? 1.5 : 1.2)); }
  beginAttack(name, chained) {
    this.state = 'attack'; this.t = 0; this.atkName = name; this.atk = this.atkSpec(name); this.didHit = false; this.thrown = false; this.slammed = false; this.aoeShown = false;
    if (!chained) this.comboN = 0;
    if (!this.atk.release) this.g.audio.play('warn');
  }
  tryHit(A) {
    const P = this.g.player;
    if (A.aoe) {
      const c = this.aoeCenter(A); if (flatDist(c, P.pos) > A.range + P.radius || Math.abs(P.pos.y - this.pos.y) > 1.5) return;
      this.didHit = true; P.takeHit(A.dmg, c, A.knock, { unblockable: A.unblockable }); return;
    }
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > A.range + P.radius + 0.3 || Math.abs(P.pos.y - this.pos.y) > 1.6) return;
    if (Math.abs(wrapAngle(Math.atan2(dx, dz) - this.yaw)) > A.arc) return;
    this.didHit = true;
    const r = P.takeHit(A.dmg, this.pos, A.knock);
    if (r === 'parry') this.stagger(this.T.boss ? 1.1 : 1.6);
    if (r === 'hit' || r === 'block') this.g.audio.play(r === 'hit' ? 'hitHeavy' : 'block');
  }
  syncModel() {
    this.model.root.position.copy(this.pos); this.model.root.rotation.y = this.yaw;
    this.warn.position.set(this.pos.x, this.pos.y + this.headH + 0.5, this.pos.z);
  }
  dispose() { this.g.scene.remove(this.model.root); this.g.scene.remove(this.warn); }
}

// ================= 投石 =================
const stoneGeo = new THREE.DodecahedronGeometry(0.16, 0), stoneMat = new THREE.MeshStandardMaterial({ color: '#7d776c', roughness: 1 });
export class Stone {
  constructor(game, from, target) {
    this.g = game; this.mesh = new THREE.Mesh(stoneGeo, stoneMat); this.mesh.castShadow = true; game.scene.add(this.mesh);
    this.pos = from.clone(); const tp = target.clone(); tp.y += 1.0;
    const flight = clamp(flatDist(from, tp) / 16, 0.35, 1.0);
    this.vel = new THREE.Vector3((tp.x - from.x) / flight, (tp.y - from.y) / flight + 0.5 * 20 * flight, (tp.z - from.z) / flight);
    this.life = 3; this.dead = false;
  }
  update(dt) {
    this.vel.y -= 20 * dt; this.pos.addScaledVector(this.vel, dt); this.mesh.position.copy(this.pos); this.mesh.rotation.x += dt * 10; this.life -= dt;
    const P = this.g.player;
    if (P.alive && this.pos.distanceTo(P.chestPos()) < 0.85) {
      const r = P.takeHit(9, this.pos, 3);
      if (r !== 'miss') { this.dead = true; if (r === 'block' || r === 'parry') this.g.fx.block(this.pos); }
    }
    if (this.pos.y < this.g.world.heightAt(this.pos.x, this.pos.z) || this.life < 0) { this.dead = true; this.g.fx.dust(this.pos, 2); }
    if (this.dead) this.g.scene.remove(this.mesh);
  }
}

// ================= アイテム(サーターアンダギー) =================
const andaGeo = new THREE.SphereGeometry(0.22, 10, 8), andaMat = new THREE.MeshStandardMaterial({ color: '#c9862e', roughness: 0.7, emissive: '#5a3008', emissiveIntensity: 0.4 });
export class Pickup {
  constructor(game, x, y, z, kind = 'andagi') {
    this.g = game; this.kind = kind; this.mesh = new THREE.Group();
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(andaGeo, andaMat); m.position.set(Math.cos(i * 2.1) * 0.18, i === 2 ? 0.2 : 0, Math.sin(i * 2.1) * 0.18); m.scale.set(1, 0.85, 1); m.castShadow = true; this.mesh.add(m); }
    this.pos = new THREE.Vector3(x, y, z); this.mesh.position.copy(this.pos); game.scene.add(this.mesh); this.t = Math.random() * 6; this.dead = false;
  }
  update(dt) {
    this.t += dt; this.mesh.position.y = this.pos.y + 0.6 + Math.sin(this.t * 3) * 0.12; this.mesh.rotation.y += dt * 2;
    const P = this.g.player;
    if (P.alive && flatDist(P.pos, this.pos) < 1.3 && P.hp < P.maxHp) {
      P.heal(30); this.g.audio.play('pickup'); this.g.toast('サーターアンダギーを食べた — 体力回復'); this.dead = true; this.g.scene.remove(this.mesh);
    }
  }
}

// ================= 村人(会話) =================
export class NPC {
  constructor(game, x, z, yaw, name, model, lines, opts = {}) {
    this.g = game; this.name = name; this.lines = lines; this.opts = opts;
    this.model = new Humanoid(model); game.scene.add(this.model.root);
    this.pos = new THREE.Vector3(x, game.world.heightAt(x, z), z); this.yaw = yaw; this.time = Math.random() * 5; this.baseYaw = yaw;
    this.model.root.position.copy(this.pos); this.model.root.rotation.y = yaw; this.talked = false;
    game.world.addCircle(x, z, 0.4);
  }
  update(dt) {
    this.time += dt; const P = this.g.player; const d = flatDist(P.pos, this.pos);
    const ty = d < 6 ? Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z) : this.baseYaw;
    this.yaw = dampAngle(this.yaw, ty, 4, dt); this.model.root.rotation.y = this.yaw;
    this.model.animate(dt, { t: this.time, action: this.opts.anim || (d < 5 && !this.talked ? 'wave' : null), a: 0.5 });
  }
}
