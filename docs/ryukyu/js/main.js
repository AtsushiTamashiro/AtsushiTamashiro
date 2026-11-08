// 琉球道中記 — ゲーム本体
import * as THREE from 'three';
import { World, CASTLE, SEIDEN, ZONES, zoneAtZ, SKY_KEYS } from './world.js';
import { FX } from './fx.js';
import { AudioSys } from './audio.js';
import { Player, Enemy, Stone, Pickup, NPC } from './entities.js';
import { clamp, damp, dampAngle, lerp, wrapAngle } from './util.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'ryukyu-douchuki-save-v1';
const loadSave = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } };
const writeSave = (d) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch { /* 保存できない環境 */ } };
const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ } };

// 敵の配置 [種類, z, 道からの横ずれ(+東/-西)]
const SPAWNS = [
  ['boar', -78, 9], ['boar', -98, -11], ['habu', -128, 5], ['pirate', -172, 3], ['pirate', -178, -4],
  ['pirate', -232, 5], ['thrower', -300, -14], ['pirate', -328, -9], ['pirate', -338, -13], ['pirate', -352, -6], ['thrower', -362, -16], ['pirate', -372, -10],
  ['pirate', -436, 4], ['pirate', -442, -5], ['thrower', -452, 10], ['habu', -472, -3],
  ['bandit', -540, 5], ['bandit', -546, -5], ['boar', -560, 12],
  ['bandit', -600, 4], ['bandit', -606, -6], ['thrower', -616, 12],
  ['boar', -655, -8], ['habu', -665, 6], ['habu', -672, -4],
  ['brute', -722, 0], ['bandit', -716, 6], ['bandit', -728, -6],
  ['thrower', -786, 11], ['thrower', -792, -11], ['pirate', -780, 3], ['pirate', -796, -3],
  ['pirate', -858, 4], ['pirate', -864, -4], ['pirate', -870, 0],
  ['pirate', -918, 3], ['pirate', -924, -3], ['thrower', -930, 6], ['thrower', -934, -6],
  ['brute', -958, 0], ['pirate', -952, 5], ['pirate', -952, -5],
  ['pirate', -1004, 4], ['pirate', -1008, -4], ['bandit', -1012, 0], ['thrower', -1018, 6],
];

const STORY = {
  intro: [
    ['', '時は十六世紀。海の道で栄える 琉球王国——。'],
    ['', 'ある朝、読谷山(ユムタン)の浜の沖に、黒い帆を張った異国の船が現れた。'],
    ['村の長老', '樽金(タルガニ)よ、あれは海賊船じゃ。奴らは浜伝いに南へ下り、首里の御城(ウグスク)を狙っておる。'],
    ['村の長老', '王府へ急ぎ知らせねばならん。足が速く、手(ティー)の心得もあるお前にしか頼めん。'],
    ['樽金', 'わかりました、ウスメー。北谷、浦添を抜けて、必ず首里城へ知らせを届けます!'],
    ['村の長老', '道中の拝所(ウガンジュ)で手を合わせれば、力が戻るじゃろう。……気をつけて行くんじゃぞ。'],
  ],
  chatan: [['樽金', '北谷の浜……あれが海賊どもの野営地か。浜を抜けるしかない!']],
  fisher: [
    ['北谷の海人', 'おぉ、読谷山の若いの! 浜はもう海賊どもの野営地になっちまった。'],
    ['北谷の海人', '素手じゃ無茶だ。この六尺棒(ルクシャクボー)を持っていけ!'],
    ['', '六尺棒を手に入れた! 攻撃の間合いが広がり、横薙ぎで複数の敵を打てる。'],
  ],
  urasoe: [['樽金', '浦添の森だ。昔のグスクの石垣が残っている……山賊どもまで海賊と手を組んでいるのか。']],
  shuri: [['樽金', '首里の町だ! くそっ、海賊どもが先回りしている。急がねば!']],
  shureimon: [['樽金', '守礼門……「守禮之邦」。礼を守る国を、海賊なんかに荒らさせてたまるか!']],
  boss: [
    ['海賊頭 黒鮫', 'フン……田舎の百姓が、よくぞここまで辿り着いたものだ。'],
    ['海賊頭 黒鮫', '王城の宝はこの黒鮫様がいただく。邪魔立てするなら、斬る!'],
    ['樽金', '琉球は守礼の邦。だが、守るべきものは命を懸けて守る! 来い!'],
  ],
  phase2: [['海賊頭 黒鮫', 'ぐっ……やるじゃねえか百姓! 野郎ども、かかれぇ!']],
  victory: [
    ['海賊頭 黒鮫', 'ば、馬鹿な……百姓ごときに、この黒鮫が……!'],
    ['王府の親方', 'そこの者! 見事であった。海賊の頭を、たった一人で……。名は何と申す。'],
    ['樽金', '読谷山の百姓、樽金と申します。海賊が御城を狙っていると、知らせに参りました。'],
    ['王府の親方', '樽金よ、そなたの勇気、国王様にしかとお伝えいたそう。'],
    ['王府の親方', '読谷山から駆け抜けたそなたの名は、きっと末代まで語り継がれよう。'],
  ],
};

class UI {
  constructor(game) {
    this.g = game; this.barPool = []; this.dmgPool = [];
    this.hp = $('hpFill'); this.hpLag = $('hpLag'); this.st = $('stFill'); this.ki = $('kiFill'); this.kiWrap = $('kiBar');
    this.lagV = 1; this.toastT = 0; this.bannerT = 0;
  }
  bar() {
    let b = this.barPool.find((x) => !x.used);
    if (!b) { const el = document.createElement('div'); el.className = 'ebar'; el.innerHTML = '<span class="ename"></span><div class="etrack"><div class="efill"></div></div>'; $('bars').appendChild(el); b = { el, fill: el.querySelector('.efill'), name: el.querySelector('.ename'), used: false }; this.barPool.push(b); }
    b.used = true; return b;
  }
  hurtFlash() { const h = $('hurt'); h.classList.remove('on'); void h.offsetWidth; h.classList.add('on'); }
  toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); this.toastT = 2.2; }
  banner(zone) { $('bannerName').textContent = zone.name; $('bannerKana').textContent = zone.kana; $('bannerSub').textContent = zone.sub; const b = $('banner'); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
  damageNumber(pos, n, crit) {
    let d = this.dmgPool.find((x) => x.t <= 0);
    if (!d) { const el = document.createElement('div'); el.className = 'dmg'; $('dmgLayer').appendChild(el); d = { el, t: 0, pos: new THREE.Vector3() }; this.dmgPool.push(d); }
    d.el.textContent = n; d.el.classList.toggle('crit', !!crit); d.t = 0.8; d.pos.copy(pos); d.pos.x += (Math.random() - 0.5) * 0.6; d.el.style.display = 'block';
  }
  project(v, cam) { const p = v.clone().project(cam); return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, ok: p.z < 1 && p.z > -1 }; }
  update(dt) {
    const g = this.g, P = g.player, cam = g.camera;
    const hpv = P.hp / P.maxHp; this.hp.style.width = hpv * 100 + '%'; this.lagV = Math.max(hpv, this.lagV - dt * 0.4); this.hpLag.style.width = this.lagV * 100 + '%';
    this.hp.classList.toggle('low', hpv < 0.3);
    this.st.style.width = P.st + '%'; this.ki.style.width = P.ki + '%'; this.kiWrap.classList.toggle('full', P.ki >= 100);
    // 進行度
    $('pmark').style.left = (g.progress * 100).toFixed(2) + '%';
    this.toastT -= dt; if (this.toastT <= 0) $('toast').classList.remove('show');
    // 敵の体力バー
    for (const b of this.barPool) b.used = false;
    for (const e of g.enemies) {
      if (!e.alive || e.T.boss || !e.model.root.visible) continue;
      if (e.state === 'idle' && e.hp >= e.maxHp) continue;
      if (e.pos.distanceTo(P.pos) > 26) continue;
      const s = this.project(new THREE.Vector3(e.pos.x, e.pos.y + e.headH + 0.25, e.pos.z), cam); if (!s.ok) continue;
      const b = this.bar(); b.el.style.transform = `translate(${s.x}px, ${s.y}px)`; b.fill.style.width = (e.hp / e.maxHp) * 100 + '%'; b.name.textContent = e.name;
      b.el.classList.toggle('stag', e.state === 'stagger');
    }
    for (const b of this.barPool) b.el.style.display = b.used ? 'block' : 'none';
    // ダメージ数字
    for (const d of this.dmgPool) {
      if (d.t <= 0) continue; d.t -= dt; d.pos.y += dt * 1.5;
      const s = this.project(d.pos, cam);
      if (d.t <= 0 || !s.ok) { d.el.style.display = 'none'; d.t = 0; continue; }
      d.el.style.transform = `translate(${s.x}px, ${s.y}px) scale(${1 + Math.max(0, d.t - 0.6) * 2})`; d.el.style.opacity = Math.min(1, d.t * 3);
    }
    // ロックオン
    const lk = $('lock');
    if (P.lock && P.lock.alive) { const s = this.project(P.lock.chestPos(), cam); lk.style.display = s.ok ? 'block' : 'none'; lk.style.transform = `translate(${s.x}px, ${s.y}px)`; } else lk.style.display = 'none';
    // ボス
    const B = g.boss;
    if (B && g.bossStarted && B.alive) { $('boss').classList.add('show'); $('bossFill').style.width = (B.hp / B.maxHp) * 100 + '%'; } else $('boss').classList.remove('show');
  }
}

class Game {
  constructor() {
    this.canvas = $('game');
    this.isTouch = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(hover: hover)').matches);
    this.low = this.isTouch || (navigator.hardwareConcurrency || 8) <= 4;
    this.viewDist = this.low ? 55 : 80;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.low, powerPreference: 'high-performance' });
    // 解像度は負荷に応じて自動調整(スマホは控えめから開始)
    this.prMax = Math.min(devicePixelRatio, this.low ? 1.5 : 1.75); this.pr = this.low ? Math.min(this.prMax, 1.0) : this.prMax; this.perfT = 0; this.perfN = 0;
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(innerWidth < innerHeight ? 70 : 58, innerWidth / innerHeight, 0.1, 1200);
    this.scene.fog = new THREE.Fog('#dcecf2', this.low ? 60 : 90, this.low ? 260 : 420);
    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#6b5a3a', 1.0); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d0', 2.6); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
    this.sun.shadow.mapSize.set(this.low ? 1024 : 2048, this.low ? 1024 : 2048); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun); this.scene.add(this.sun.target);

    this.world = new World(this.scene, { low: this.low });
    this.fx = new FX(this.scene);
    this.audio = new AudioSys();
    this.player = new Player(this);
    this.ui = new UI(this);
    this.enemies = []; this.stones = []; this.pickups = []; this.npcs = [];
    this.tokens = 0; this.stats = { taken: 0, time: 0 };
    this.camYaw = 0; this.camPitch = 0.32; this.camDist = 6.4; this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3();
    this.shakeAmt = 0; this.stopT = 0; this.slowT = 0; this.mode = 'title'; this.flags = {}; this.time = 0; this.progress = 0;
    this.lastMouseMove = 0; this.inCombat = false; this.combatK = 0;
    this.dangers = [];
    const dg = new THREE.CircleGeometry(1, 40); dg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: '#ff3020', transparent: true, opacity: 0.3, depthWrite: false })); m.visible = false; this.scene.add(m); this.dangers.push({ m, t: 0, max: 1 }); }

    this.setupLevel();
    this.setupInput();
    this.setupMenus();
    const onResize = () => { this.renderer.setSize(innerWidth, innerHeight); this.camera.aspect = innerWidth / innerHeight; this.camera.fov = innerWidth < innerHeight ? 70 : 58; this.camera.updateProjectionMatrix(); };
    addEventListener('resize', onResize); addEventListener('orientationchange', () => setTimeout(onResize, 300));
    // タイトル画面用のカメラ
    this.titleT = 0;
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.loop());
    $('loading').classList.add('hide');
  }

  setupLevel() {
    const w = this.world;
    for (const [type, z, off] of SPAWNS) {
      const s = w.sAtZ(z), p = w.pointAt(s);
      const e = new Enemy(this, type, p.x + p.nx * off, p.z + p.nz * off, { yaw: Math.atan2(-p.tx, -p.tz) });
      this.enemies.push(e);
    }
    this.boss = new Enemy(this, 'boss', CASTLE.x, CASTLE.z - 10, { dormant: true, yaw: 0 });
    this.enemies.push(this.boss);
    // アンダギー(道沿い)
    for (const z of [-60, -205, -290, -395, -480, -575, -640, -700, -760, -840, -905, -945, -990, -1040]) {
      const p = w.pointAt(w.sAtZ(z)), x = p.x + p.nx * 3, zz = p.z + p.nz * 3; this.pickups.push(new Pickup(this, x, w.heightAt(x, zz), zz));
    }
    // 村人
    const p0 = w.pointAt(w.sAtZ(48));
    this.elder = new NPC(this, p0.x + 1.5, p0.z - 3, Math.PI * 0.9, '村の長老', { robe: '#b8ad94', sleeve: '#a99f86', hair: '#d8d4cc', beard: true, skin: '#c9966c', belt: '#5a4a3a' }, [['村の長老', '首里へは道なりに南へ。北谷の浜、浦添の森を越えた丘の上じゃ。']]);
    this.npcs.push(this.elder);
    const p1 = w.pointAt(w.sAtZ(5));
    this.npcs.push(new NPC(this, p1.x - 6, p1.z, Math.PI / 2, '村の娘', { robe: '#4a6fa5', sleeve: '#4a6fa5', hair: '#1a1410', skin: '#d8a882', belt: '#d9c27a' }, [['村の娘', '樽金にーにー、これ持って行って! 揚げたてのサーターアンダギーだよ。道にも落としておいたからね。']]));
    const p2 = w.pointAt(w.sAtZ(-30));
    this.npcs.push(new NPC(this, p2.x + 7, p2.z, -Math.PI / 2, '村の子ども', { robe: '#e0c68a', hair: '#1a1410', scale: 0.7, skin: '#dcae88' }, [['村の子ども', 'かいぞく、こわい……。にーにー、やっつけてね! イノシシにも気をつけて。棒立ちしてると突進してくるよ!']]));
    const fs = w.fishermanSpot;
    this.fisher = new NPC(this, fs.x, fs.z, 0, '北谷の海人', { robe: '#3d6a8a', sleeve: '#3d6a8a', hair: '#1a1410', skin: '#b07a50', headband: '#e8e2d0', weapon: 'oar' }, [['北谷の海人', '棒は横に薙げば囲まれても戦える。突きは重いが、外すと隙だらけだ。']]);
    this.npcs.push(this.fisher);
    const pu = w.pointAt(w.sAtZ(-512));
    this.npcs.push(new NPC(this, pu.x + 5, pu.z + 1, -Math.PI / 2, '浦添の木こり', { robe: '#6a7a4a', hair: '#1a1410', skin: '#b88660', weapon: 'club' }, [['浦添の木こり', '山賊どもの中に、やたらでかい大男がいる。あいつの振り下ろしは受けきれん、転がって避けろ!']]));
    const ps = w.pointAt(w.sAtZ(-842));
    this.npcs.push(new NPC(this, ps.x - 5, ps.z, Math.PI / 2, '首里の士族', { robe: '#2f3f6a', sleeve: '#2f3f6a', hair: '#1a1410', skin: '#d4a07a', hat: '#c9a227' }, [['首里の士族', '城門は海賊に押さえられた! 敵の構えが光ったら防御だ。うまく合わせれば「見切り」で崩せる。']]));
  }

  // ---------------- 入力 ----------------
  setupInput() {
    this.keys = {}; this.pressed = {}; this.mouse = { l: false, r: false };
    const kmap = (e) => e.code;
    addEventListener('keydown', (e) => {
      const k = kmap(e); if (!this.keys[k]) this.pressed[k] = true; this.keys[k] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(k)) e.preventDefault();
      if (k === 'Escape' && this.mode === 'play') this.pause(true);
      else if (k === 'Escape' && this.mode === 'pause') this.pause(false);
      if (this.mode === 'dialog' && (k === 'Enter' || k === 'KeyE' || k === 'Space' || k === 'KeyJ')) this.advanceDialog();
    });
    addEventListener('keyup', (e) => { this.keys[kmap(e)] = false; });
    addEventListener('blur', () => { this.keys = {}; this.mouse.l = this.mouse.r = false; });
    const cv = this.canvas;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('mousedown', (e) => {
      this.audio.init();
      if (this.mode === 'dialog') { this.advanceDialog(); return; }
      if (this.mode !== 'play') return;
      if (document.pointerLockElement !== cv && !this.isTouch) { this.lockPointer(); }
      if (e.button === 0) { this.mouse.l = true; this.pressed.Mouse0 = true; }
      if (e.button === 2) this.mouse.r = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === cv) { this.camYaw -= e.movementX * 0.0026; this.camPitch = clamp(this.camPitch + e.movementY * 0.0021, -0.25, 1.15); this.lastMouseMove = this.time; }
    });
    cv.addEventListener('wheel', (e) => { this.camDist = clamp(this.camDist + Math.sign(e.deltaY) * 0.5, 3.5, 10); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && this.mode === 'play' && !this.isTouch && this.wantPauseOnUnlock) this.pause(true); this.wantPauseOnUnlock = !!document.pointerLockElement; });
    this.setupTouch();
  }
  setupTouch() {
    this.joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 }; this.camTouch = null; this.tbtn = {};
    if (!this.isTouch) return;
    document.body.classList.add('touch');
    const joyEl = $('joy'), knob = $('joyKnob');
    const start = (e) => {
      this.audio.init();
      if (this.mode === 'dialog') { this.advanceDialog(); e.preventDefault(); return; }
      for (const t of e.changedTouches) {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        if (el && el.dataset && el.dataset.btn) continue;
        if (t.clientX < innerWidth * 0.45 && this.joy.id === null) { this.joy.id = t.identifier; this.joy.ox = t.clientX; this.joy.oy = t.clientY; joyEl.style.left = t.clientX - 60 + 'px'; joyEl.style.top = t.clientY - 60 + 'px'; joyEl.classList.add('on'); }
        else if (this.camTouch === null) { this.camTouch = { id: t.identifier, x: t.clientX, y: t.clientY }; }
      }
    };
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy; const l = Math.hypot(dx, dy), m = 50; if (l > m) { dx *= m / l; dy *= m / l; }
          this.joy.x = dx / m; this.joy.y = dy / m; knob.style.transform = `translate(${dx}px, ${dy}px)`;
        } else if (this.camTouch && t.identifier === this.camTouch.id) {
          this.camYaw -= (t.clientX - this.camTouch.x) * 0.006; this.camPitch = clamp(this.camPitch + (t.clientY - this.camTouch.y) * 0.004, -0.25, 1.15);
          this.camTouch.x = t.clientX; this.camTouch.y = t.clientY; this.lastMouseMove = this.time;
        }
      }
      e.preventDefault();
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) { this.joy.id = null; this.joy.x = this.joy.y = 0; knob.style.transform = ''; joyEl.classList.remove('on'); }
        if (this.camTouch && t.identifier === this.camTouch.id) this.camTouch = null;
      }
    };
    const tl = $('touchLayer');
    tl.addEventListener('touchstart', start, { passive: false }); tl.addEventListener('touchmove', move, { passive: false });
    tl.addEventListener('touchend', end); tl.addEventListener('touchcancel', end);
    for (const b of document.querySelectorAll('[data-btn]')) {
      const k = b.dataset.btn;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.audio.init(); this.tbtn[k] = true; this.pressed['T' + k] = true; b.classList.add('on'); if (this.mode === 'dialog') this.advanceDialog(); }, { passive: false });
      const up = (e) => { e.preventDefault(); this.tbtn[k] = false; b.classList.remove('on'); };
      b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
    }
  }
  lockPointer() { try { const r = this.canvas.requestPointerLock?.(); if (r && r.catch) r.catch(() => {}); } catch { /* 非対応 */ } }
  readInput() {
    const k = this.keys, p = this.pressed, tb = this.tbtn;
    let ix = 0, iy = 0;
    if (k.KeyW || k.ArrowUp) iy += 1; if (k.KeyS || k.ArrowDown) iy -= 1; if (k.KeyA) ix -= 1; if (k.KeyD) ix += 1;
    if (k.ArrowLeft) this.camYaw += 2.2 * this.dt; if (k.ArrowRight) this.camYaw -= 2.2 * this.dt;
    if (this.joy.id !== null) { ix = this.joy.x; iy = -this.joy.y; }
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw), rx = -fz, rz = fx;
    let mx = fx * iy + rx * ix, mz = fz * iy + rz * ix; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    const inp = {
      mx, mz,
      attack: !!(p.Mouse0 || p.KeyJ || p.Tatk),
      block: !!(this.mouse.r || k.KeyL || tb.blk),
      dodge: !!(p.ShiftLeft || p.ShiftRight || p.KeyK || p.Tdodge),
      jump: !!(p.Space || p.Tjump),
      special: !!(p.KeyR || p.Tsp),
      lock: !!(p.KeyQ || p.Tab || p.Tlock),
      interact: !!(p.KeyE || p.Ttalk),
    };
    this.pressed = {};
    return inp;
  }

  // ---------------- メニュー ----------------
  setupMenus() {
    $('dialog').addEventListener('click', () => this.advanceDialog());
    $('dialog').addEventListener('touchstart', (e) => { e.preventDefault(); this.audio.init(); this.advanceDialog(); }, { passive: false });
    if (this.isTouch) $('dNext').textContent = '▼ タップで次へ';
    $('btnRotateOk').onclick = () => { this.rotateOk = true; $('rotate').classList.remove('show'); };
    const checkRotate = () => $('rotate').classList.toggle('show', this.isTouch && !this.rotateOk && innerHeight > innerWidth);
    addEventListener('resize', checkRotate); checkRotate();
    const track = $('ptrack'), L = this.world.pathLen;
    for (const z of ZONES) { const m = document.createElement('div'); m.className = 'pz'; const f = z.id === 0 ? 0 : this.world.sAtZ(z.zMax) / L; m.style.left = f * 100 + '%'; m.innerHTML = `<i></i><span>${z.name}</span>`; track.appendChild(m); }
    const c = document.createElement('div'); c.className = 'pz castle'; c.style.left = '100%'; c.innerHTML = '<i></i><span>首里城</span>'; track.appendChild(c);
    const save = loadSave();
    if (save) $('btnContinue').classList.remove('hidden');
    $('btnStart').onclick = () => { this.audio.init(); this.goFullscreen(); clearSave(); this.startGame(null); };
    $('btnContinue').onclick = () => { this.audio.init(); this.goFullscreen(); this.startGame(loadSave()); };
    $('btnHow').onclick = () => $('howto').classList.add('show');
    $('btnHowClose').onclick = () => $('howto').classList.remove('show');
    $('btnResume').onclick = () => this.pause(false);
    $('btnPauseHow').onclick = () => $('howto').classList.add('show');
    $('btnRetry').onclick = () => this.respawn();
    $('btnTitle').onclick = () => location.reload();
    $('btnEndTitle').onclick = () => location.reload();
    $('btnMute').onclick = () => { this.muted = !this.muted; this.audio.setMuted(this.muted); $('btnMute').textContent = this.muted ? '♪ 音:オフ' : '♪ 音:オン'; };
    $('btnPauseMobile').onclick = () => { if (this.mode === 'play') this.pause(true); };
  }
  startGame(save) {
    $('title').classList.add('hide'); $('hud').classList.add('show'); document.body.classList.add('playing');
    const w = this.world;
    this.cpIndex = 0;
    if (save && save.cp > 0) {
      this.cpIndex = save.cp; const cp = w.checkpoints[save.cp];
      if (save.bo) { this.player.setWeapon('bo'); this.flags.fisher = true; }
      for (const e of this.enemies) if (!e.T.boss && e.home.z > cp.z + 4) { e.state = 'dead'; e.deadT = 99; e.model.root.visible = false; }
      for (const z of ZONES) if (z.zMax >= cp.z) this.flags['zone' + z.id] = true;
      if (cp.z < -985) this.flags.shureimon = true;
      this.flags.intro = true; this.flags.chatan = cp.z < -200; this.flags.urasoe = cp.z < -490; this.flags.shuri = cp.z < -815;
      this.spawnAtCheckpoint();
      this.mode = 'play'; this.ui.banner(zoneAtZ(cp.z));
    } else {
      const p = w.pointAt(w.sAtZ(52));
      this.player.spawnAt(p.x, p.z, Math.PI);
      this.camYaw = 0; this.flags.zone0 = true;
      this.mode = 'play';
      this.ui.banner(ZONES[0]);
      setTimeout(() => this.startDialog(STORY.intro, () => { this.flags.intro = true; this.showHint(); }), 2200);
    }
    this.lastZone = zoneAtZ(this.player.pos.z).id;
  }
  goFullscreen() {
    if (!this.isTouch) return;
    try { const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen; const r = rq && rq.call(el, { navigationUI: 'hide' }); if (r && r.then) r.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch { /* iPhone などは非対応 */ }
  }
  showHint() { const h = $(this.isTouch ? 'thint' : 'hint'); h.classList.add('show'); setTimeout(() => h.classList.remove('show'), 14000); }
  pause(on) {
    if (on) { this.mode = 'pause'; $('pause').classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); }
    else { this.mode = 'play'; $('pause').classList.remove('show'); $('howto').classList.remove('show'); }
  }

  // ---------------- 会話 ----------------
  startDialog(lines, onEnd) {
    if (!lines || !lines.length) { onEnd && onEnd(); return; }
    this.dialog = { lines, i: 0, onEnd, shown: 0, full: false }; this.prevMode = this.mode === 'dialog' ? this.prevMode : this.mode; this.mode = 'dialog';
    $('dialog').classList.add('show'); this.showLine();
    if (document.pointerLockElement) { this.wantPauseOnUnlock = false; document.exitPointerLock(); }
  }
  showLine() { const [name, text] = this.dialog.lines[this.dialog.i]; $('dName').textContent = name; $('dName').style.display = name ? 'inline-block' : 'none'; $('dialog').classList.toggle('narr', !name); this.dialog.shown = 0; this.dialog.full = false; this.dialog.text = text; $('dText').textContent = ''; }
  advanceDialog() {
    const d = this.dialog; if (!d) return;
    if (!d.full) { d.shown = d.text.length; return; }
    d.i++;
    if (d.i >= d.lines.length) { $('dialog').classList.remove('show'); this.dialog = null; this.mode = 'play'; d.onEnd && d.onEnd(); if (!this.isTouch && this.mode === 'play') this.lockPointer(); return; }
    this.showLine();
  }
  updateDialog(dt) {
    const d = this.dialog; if (!d || d.full) return;
    const before = Math.floor(d.shown); d.shown += dt * 38; const n = Math.floor(d.shown);
    if (n !== before && n % 2 === 0) this.audio.play('text');
    if (n >= d.text.length) { d.full = true; $('dText').textContent = d.text; } else $('dText').textContent = d.text.slice(0, n);
  }

  // ---------------- 戦闘補助 ----------------
  nearestEnemy(pos, maxD, yaw, maxAng) {
    let best = null, bs = 1e9;
    for (const e of this.enemies) {
      if (!e.alive || e.dormant || !e.model.root.visible) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z, d = Math.hypot(dx, dz); if (d > maxD) continue;
      const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - yaw)); if (ang > maxAng) continue;
      const sc = d + ang * 2; if (sc < bs) { bs = sc; best = e; }
    }
    return best;
  }
  camYawForward() { return Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw)); }
  toast(m) { this.ui.toast(m); }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  hitstop(t) { this.stopT = Math.max(this.stopT, t); }
  slowmo(t) { this.slowT = Math.max(this.slowT, t); }
  damageNumber(p, n, c) { this.ui.damageNumber(p, n, c); }
  showDanger(c, r, dur) { const d = this.dangers.find((x) => x.t <= 0) || this.dangers[0]; d.m.position.set(c.x, this.world.heightAt(c.x, c.z) + 0.12, c.z); d.r = r; d.t = d.max = dur; d.m.visible = true; }
  throwStone(e, P) { const from = new THREE.Vector3(e.pos.x, e.pos.y + 1.8, e.pos.z); const lead = P.pos.clone().addScaledVector(P.vel, 0.35); this.stones.push(new Stone(this, from, lead)); }
  applyArena(pos) {
    if (!this.arena) return;
    const dx = pos.x - this.arena.x, dz = pos.z - this.arena.z, d = Math.hypot(dx, dz);
    if (d > this.arena.r) { pos.x = this.arena.x + (dx / d) * this.arena.r; pos.z = this.arena.z + (dz / d) * this.arena.r; }
  }
  onEnemyDeath(e) {
    this.player.stats.kills++;
    if (this.player.lock === e) this.player.lock = null;
    if (!e.T.boss && Math.random() < (e.type === 'brute' ? 1 : 0.22)) this.pickups.push(new Pickup(this, e.pos.x, e.pos.y, e.pos.z));
    if (e.T.boss) this.onBossDefeated();
  }
  onBossPhase2(b) {
    this.audio.play('roar'); this.shake(0.5);
    this.startDialog(STORY.phase2, () => {
      for (let i = 0; i < 3; i++) {
        const a = Math.PI * 0.5 + (i - 1) * 0.7, x = CASTLE.x + Math.cos(a) * 26, z = CASTLE.z + Math.sin(a) * 26;
        const e = new Enemy(this, i === 1 ? 'thrower' : 'pirate', x, z); e.aggro(); this.enemies.push(e); this.adds = (this.adds || []).concat(e);
      }
    });
  }
  onBossDefeated() {
    this.audio.boss = false; this.slowmo(1.2); this.shake(0.6); this.audio.play('victory');
    for (const e of this.enemies) if (e.alive) { e.hp = 1; e.takeHit(99, e.pos, 3, true); }
    setTimeout(() => {
      this.arena = null;
      this.official = new NPC(this, SEIDEN.x + 3, SEIDEN.z + 13, Math.PI, '王府の親方', { robe: '#5b2a7a', sleeve: '#5b2a7a', hat: '#c9a227', skin: '#d4a07a', belt: '#d9c27a' }, []);
      this.npcs.push(this.official);
      this.startDialog(STORY.victory, () => this.ending());
    }, 2600);
  }
  ending() {
    clearSave(); this.mode = 'ending';
    const s = Math.floor(this.stats.time), mm = Math.floor(s / 60), ss = s % 60;
    $('stTime').textContent = `${mm}分${String(ss).padStart(2, '0')}秒`;
    $('stKills').textContent = this.player.stats.kills + ' 人(匹)';
    $('stParry').textContent = this.player.stats.parries + ' 回';
    $('stTaken').textContent = Math.round(this.stats.taken);
    $('ending').classList.add('show'); $('hud').classList.remove('show'); document.body.classList.remove('playing');
    if (document.pointerLockElement) document.exitPointerLock();
  }
  onPlayerDeath() {
    this.audio.play('die');
    setTimeout(() => { this.mode = 'dead'; $('gameover').classList.add('show'); if (document.pointerLockElement) { this.wantPauseOnUnlock = false; document.exitPointerLock(); } }, 1800);
  }
  spawnAtCheckpoint() {
    const cp = this.world.checkpoints[this.cpIndex], w = this.world;
    const s = cp.s, p = w.pointAt(s);
    this.player.spawnAt(p.x, p.z, Math.atan2(p.tx, p.tz));
    this.camYaw = Math.atan2(-p.tx, -p.tz);
  }
  respawn() {
    $('gameover').classList.remove('show');
    for (const s of this.stones) this.scene.remove(s.mesh); this.stones = [];
    for (const e of this.enemies) if (e.alive) e.reset();
    this.tokens = 0;
    if (this.adds) { for (const e of this.adds) { e.dispose(); this.enemies.splice(this.enemies.indexOf(e), 1); } this.adds = null; }
    this.boss.reset(); this.boss.dormant = true; this.bossStarted = false; this.arena = null; this.audio.boss = false;
    this.player.state = 'move'; this.player.ki = Math.max(this.player.ki, 30);
    this.spawnAtCheckpoint();
    this.mode = 'play';
    if (!this.isTouch) this.lockPointer();
  }

  // ---------------- 物語の進行 ----------------
  updateStory() {
    const P = this.player, z = P.pos.z, f = this.flags;
    const zn = zoneAtZ(z);
    if (zn.id !== this.lastZone) { this.lastZone = zn.id; if (!f['zone' + zn.id]) { f['zone' + zn.id] = true; this.ui.banner(zn); } }
    if (!f.chatan && z < -205) { f.chatan = true; this.startDialog(STORY.chatan); }
    if (!f.fisher && Math.hypot(P.pos.x - this.fisher.pos.x, P.pos.z - this.fisher.pos.z) < 5) {
      f.fisher = true; this.fisher.talked = true;
      this.startDialog(STORY.fisher, () => { P.setWeapon('bo'); this.audio.play('pickup'); this.toast('六尺棒を装備した'); this.saveNow(); });
    }
    if (!f.urasoe && z < -495) { f.urasoe = true; this.startDialog(STORY.urasoe); }
    if (!f.shuri && z < -820) { f.shuri = true; this.startDialog(STORY.shuri); }
    if (!f.shureimon && z < -988) { f.shureimon = true; this.startDialog(STORY.shureimon); }
    const dc = Math.hypot(P.pos.x - CASTLE.x, P.pos.z - CASTLE.z);
    if (!this.bossStarted && this.boss.alive && dc < CASTLE.r - 9 && P.alive) {
      this.bossStarted = true; this.arena = { x: CASTLE.x, z: CASTLE.z - 4, r: CASTLE.r - 4 };
      const begin = () => { this.boss.dormant = false; this.boss.state = 'chase'; this.boss.cd = 1.0; this.audio.boss = true; this.audio.play('roar'); this.ui.banner({ name: '海賊頭 黒鮫', kana: 'クルザミ', sub: '首里城・御庭の決戦' }); };
      if (!f.bossIntro) { f.bossIntro = true; this.boss.yaw = Math.atan2(P.pos.x - this.boss.pos.x, P.pos.z - this.boss.pos.z); this.startDialog(STORY.boss, begin); } else begin();
    }
    // 拝所
    for (const cp of this.world.checkpoints) {
      const d = Math.hypot(P.pos.x - cp.x, P.pos.z - cp.z), inside = d < 3.4;
      if (inside && !cp.inside && P.alive) {
        if (cp.ix > this.cpIndex) { this.cpIndex = cp.ix; this.saveNow(); }
        P.hp = P.maxHp; P.st = 100; this.audio.play('checkpoint'); this.fx.heal(P.chestPos()); this.toast(`${cp.name}で手を合わせた — 体力が回復し、ここから再開できる`);
      }
      cp.inside = inside;
    }
    // 会話(E)
    let near = null;
    for (const n of this.npcs) { if (n.lines.length && Math.hypot(P.pos.x - n.pos.x, P.pos.z - n.pos.z) < 3) near = n; }
    $('prompt').classList.toggle('show', !!near && this.mode === 'play');
    if (near) $('prompt').textContent = (this.isTouch ? '「話」' : '[E]') + ` ${near.name}と話す`;
    this.nearNpc = near;
  }
  saveNow() { writeSave({ cp: this.cpIndex, bo: this.player.weapon === 'bo' }); }

  // ---------------- メインループ ----------------
  // 負荷に応じて描画解像度を上下させる
  adaptQuality(raw) {
    this.perfT += raw; this.perfN++;
    if (this.perfT < 2) return;
    const avg = this.perfT / this.perfN; this.perfT = 0; this.perfN = 0;
    let pr = this.pr;
    if (avg > 1 / 40 && pr > 0.6) pr = Math.max(0.6, pr - 0.15);
    else if (avg < 1 / 57 && pr < this.prMax) pr = Math.min(this.prMax, pr + 0.1);
    if (pr !== this.pr) { this.pr = pr; this.renderer.setPixelRatio(pr); this.renderer.setSize(innerWidth, innerHeight); }
  }
  loop() {
    const raw = this.clock.getDelta(); if (!document.hidden) this.adaptQuality(Math.min(raw, 0.2));
    let rdt = Math.min(raw, 0.05);
    this.time += rdt; this.dt = rdt;
    let dt = rdt;
    if (this.stopT > 0) { this.stopT -= rdt; dt = rdt * 0.05; } else if (this.slowT > 0) { this.slowT -= rdt; dt = rdt * 0.35; }
    const P = this.player;
    if (this.mode === 'title') { this.titleCam(rdt); this.world.update(rdt, 0.05, this.time); this.fx.update(rdt, this.world.fires, this.camera.position); for (const n of this.npcs) n.update(rdt); this.renderer.render(this.scene, this.camera); return; }
    if (this.mode === 'play' || this.mode === 'dialog' || this.mode === 'dead' || this.mode === 'ending') {
      const playing = this.mode === 'play' || this.mode === 'dead';
      const inp = this.mode === 'play' ? this.readInput() : (this.pressed = {}, { mx: 0, mz: 0 });
      if (this.mode === 'play' && inp.interact && this.nearNpc) { const n = this.nearNpc; n.talked = true; this.startDialog(n.lines); }
      if (playing) this.stats.time += rdt * (this.mode === 'play' ? 1 : 0);
      if (this.mode === 'dialog' || this.mode === 'ending') {
        const st = P.state; if (P.state !== 'dead') { P.state = 'talk'; P.update(dt, { mx: 0, mz: 0 }); P.state = st === 'talk' ? 'move' : st; if (P.state === 'attack' || P.state === 'dodge') P.state = 'move'; }
        this.updateDialog(rdt);
      } else P.update(dt, inp);
      if (playing) {
        let combat = false;
        for (const e of this.enemies) { e.update(dt); if (e.alive && e.state !== 'idle' && !e.dormant && e.pos.distanceTo(P.pos) < 35) combat = true; }
        this.inCombat = combat;
        for (const s of this.stones) s.update(dt); this.stones = this.stones.filter((s) => !s.dead);
        for (const p of this.pickups) p.update(dt); this.pickups = this.pickups.filter((p) => !p.dead);
        if (this.mode === 'play') this.updateStory();
      } else { for (const e of this.enemies) if (e.model.root.visible && e.alive) e.model.animate(rdt, { t: this.time, guard: e.state !== 'idle', speed: 0 }); }
      for (const n of this.npcs) n.update(dt);
      this.combatK = damp(this.combatK, this.inCombat ? 1 : 0, 2, rdt); this.audio.battle = this.inCombat ? 1 : 0;
      for (const d of this.dangers) { if (d.t <= 0) continue; d.t -= dt; const k = 1 - d.t / d.max; d.m.scale.setScalar(d.r * (0.3 + 0.7 * k)); d.m.material.opacity = 0.18 + 0.3 * k; if (d.t <= 0) d.m.visible = false; }
      this.progress = clamp(this.world.nearest(P.pos.x, P.pos.z).s / this.world.pathLen, 0, 1);
      this.updateCamera(rdt);
      this.ui.update(rdt);
    }
    this.updateLighting();
    this.world.update(rdt, this.progress, this.time);
    this.fx.update(dt, this.world.fires, this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }
  titleCam(dt) {
    this.titleT += dt;
    const w = this.world, s = (this.titleT * 6) % w.pathLen, p = w.pointAt(s);
    const t = this.titleT * 0.1;
    const cx = p.x + Math.cos(t) * 28, cz = p.z + Math.sin(t) * 28;
    this.camera.position.set(cx, w.heightAt(cx, cz) + 14, cz);
    this.camera.lookAt(p.x, w.heightAt(p.x, p.z) + 2, p.z);
    this.progress = s / w.pathLen; this.updateLighting(p);
  }
  updateCamera(dt) {
    const P = this.player, w = this.world;
    const target = new THREE.Vector3(P.pos.x, P.pos.y + 1.55, P.pos.z);
    // ロックオン時は敵の方向へ回り込む
    if (P.lock && P.lock.alive) {
      const dx = P.lock.pos.x - P.pos.x, dz = P.lock.pos.z - P.pos.z;
      this.camYaw = dampAngle(this.camYaw, Math.atan2(-dx, -dz), 4, dt);
      this.camPitch = damp(this.camPitch, 0.3, 3, dt);
      target.lerp(new THREE.Vector3(P.lock.pos.x, P.lock.pos.y + 1.4, P.lock.pos.z), 0.25);
    } else if (this.isTouch && this.time - this.lastMouseMove > 1.2 && P.vel.lengthSq() > 4) {
      // タッチ操作では進行方向へ自動で回り込む
      this.camYaw = dampAngle(this.camYaw, Math.atan2(-P.vel.x, -P.vel.z), 0.8, dt);
    }
    const boss = this.bossStarted && this.boss.alive;
    const dist = this.camDist + (boss ? 1.6 : 0) + (this.inCombat ? 0.5 : 0);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const want = new THREE.Vector3(target.x + Math.sin(this.camYaw) * cp * dist, target.y + sp * dist, target.z + Math.cos(this.camYaw) * cp * dist);
    const gh = w.heightAt(want.x, want.z) + 0.6; if (want.y < gh) want.y = gh;
    if (!this.camInit) { this.camPos.copy(want); this.camLook.copy(target); this.camInit = true; }
    this.camPos.lerp(want, 1 - Math.exp(-14 * dt)); this.camLook.lerp(target, 1 - Math.exp(-18 * dt));
    this.camera.position.copy(this.camPos);
    if (this.shakeAmt > 0.001) { this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt; this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt; this.shakeAmt *= Math.exp(-9 * dt); }
    this.camera.lookAt(this.camLook);
  }
  updateLighting(focus) {
    const p = this.progress; let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
    for (let i = 0; i < SKY_KEYS.length - 1; i++) if (p >= SKY_KEYS[i].p && p <= SKY_KEYS[i + 1].p) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
    const k = (p - a.p) / Math.max(1e-4, b.p - a.p);
    const c = (x, y) => new THREE.Color(x).lerp(new THREE.Color(y), k);
    const top = c(a.top, b.top), hor = c(a.hor, b.hor), sunc = c(a.sun, b.sun), el = lerp(a.el, b.el, k);
    const U = this.world.skyUniforms; U.top.value.copy(top); U.horizon.value.copy(hor); U.sunCol.value.copy(sunc);
    const sd = new THREE.Vector3(-0.55, Math.sin(el), 0.25 + 0.4 * (1 - el)).normalize(); U.sunDir.value.copy(sd);
    this.scene.fog.color.copy(hor);
    this.sun.color.copy(sunc); this.sun.intensity = lerp(a.si, b.si, k); this.hemi.intensity = lerp(a.hemi, b.hemi, k);
    this.hemi.color.copy(top).lerp(new THREE.Color('#ffffff'), 0.6);
    const f = focus || this.player.pos;
    this.sun.position.set(f.x + sd.x * 120, (f.y || 0) + sd.y * 120, f.z + sd.z * 120); this.sun.target.position.set(f.x, f.y || 0, f.z);
    this.world.sky.position.copy(this.camera.position);
  }
}

try { window.game = new Game(); }
catch (err) {
  console.error(err);
  $('loading').innerHTML = '<p>ゲームを起動できませんでした。WebGL に対応したブラウザでお試しください。</p><pre>' + String(err && err.message) + '</pre>';
}
