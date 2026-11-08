// モイン村のNPC(敵はいません)
import * as THREE from 'three';
import { moveBody, inWater } from './physics.js';
import { BLOCKS, WATER, PLANKS, BRICK, GLASS, ROOF, LAMP, MOIN, RED, BLUE, YELLOW, GREEN, PINK, AIR } from './blocks.js';

const pick = a => a[Math.random() * a.length | 0];

// ---- 会話データ ----
const SPACE = [
  '太陽系の惑星は8つ。太陽に近い順に「水・金・地・火・木・土・天・海」じゃ。',
  'いちばん大きい惑星は木星。地球がおよそ1300個も入ってしまう大きさなんじゃよ。',
  'いちばん熱い惑星は、太陽に一番近い水星ではなく金星。分厚い雲が熱を閉じこめて、約460℃にもなる。',
  '太陽の光が地球にとどくまで、およそ8分20秒かかる。今見ている太陽は、8分前の姿なんじゃ。',
  '月は地球から約38万km。光なら1.3秒ほどで着いてしまう距離じゃ。',
  '宇宙はおよそ138億年前、ビッグバンで始まったと考えられておる。',
  '地球が生まれたのはおよそ46億年前。太陽も同じころに生まれたんじゃ。',
  '土星のきれいな輪は、氷や岩のつぶがたくさん集まってできておる。',
  '光は1秒間に約30万km進む。地球を7周半できる速さじゃ!',
  '夜空のオリオン座のベテルギウスは赤い大きな星。いつか超新星爆発を起こすと言われておる。',
];
const DINO = [
  'ティラノサウルスは白亜紀の終わり、約6800万〜6600万年前に生きていた大型の肉食恐竜だよ。',
  'トリケラトプスは顔に3本のツノ。名前も「3本のツノの顔」という意味なんだ。',
  'ステゴサウルスはジュラ紀の恐竜。背中の板としっぽのトゲが目印!',
  'プテラノドンは空を飛ぶけれど、じつは恐竜ではなく「翼竜」という別のなかまなんだ。',
  'ブラキオサウルスは首がとても長くて、高い木の葉っぱを食べていたと考えられているよ。',
  '恐竜の時代は約6600万年前、大きないん石の衝突のあとに終わったと考えられているんだ。',
  '今の鳥は、恐竜のなかまから進化した子孫なんだよ。スズメもある意味では恐竜!',
  'アンキロサウルスは体がよろいのような骨の板でおおわれ、しっぽの先にこぶがあったんだ。',
  '恐竜が生きていたのは「三畳紀・ジュラ紀・白亜紀」の3つの時代。まとめて「中生代」と呼ぶよ。',
  'スピノサウルスは背中に大きな帆のようなものがあり、水辺で魚を食べていたと考えられているよ。',
];
const CHIBI = [
  'モイン!モイン!ブロックをこわすと、みんな「モイン!」って言っちゃうんだよ。',
  'ねえねえ、いちばん高い山のてっぺんには雪があるんだって!',
  'わたしね、モインブロックでおうちを作るのが夢なの!',
  'かけざん先生のクイズ、むずかしいけど、できるとモインブロックがもらえるよ!',
  '夜になってもこわいものは出てこないよ。この世界にはやさしい人しかいないの。',
];

export const NPC_DEFS = [
  { key: 'chief', name: 'ゲン村長', skin: '#f1c9a0', shirt: '#7a4fb5', pants: '#3b2f55', hair: '#e8e8e8', hat: 'beard',
    talk: g => [
      'モイン! ようこそ、モイン村へ。わしは村長のゲンじゃ。',
      'この島では、ブロックをこわすと誰でも思わず「モイン!」と叫んでしまう。ふしぎな島なんじゃよ。',
      g.touch ? '左下のスティックで歩き、右側をなぞると見回せる。⛏ を長押しでこわし、🧱 で置くんじゃ。'
        : 'WASDで歩き、マウスで見回す。左クリック長押しでこわし、右クリックで置く。数字キーでブロックを選ぶんじゃ。',
      'こわしたブロックは持ち物に入る。それを使って、好きなものを作ってみなさい。',
      '村の人たちとも話してごらん。きっと良いものをくれるぞ。',
    ] },
  { key: 'carpenter', name: '大工のタケ', skin: '#e8b98c', shirt: '#d9822b', pants: '#4a3a2a', hair: '#3a2a1a', hat: 'helmet',
    talk: g => g.flags.carpenter
      ? ['おう、家づくりは順調かい?', pick(['屋根はかわらブロックで段々にすると、それっぽくなるぞ。', 'ガラスで窓を作ると、家の中が明るく見えるぜ。', 'ランプを置けば夜でもぽかぽか明るいぞ。'])]
      : ['おう!オレは大工のタケ。この村の家はぜんぶオレが建てたんだ。', 'ほら、これで家を建ててみな!',
        { run: () => { g.give(PLANKS, 32); g.give(BRICK, 24); g.give(GLASS, 12); g.give(ROOF, 24); g.give(LAMP, 6); g.flags.carpenter = true; g.fanfare(); },
          text: '木の板・レンガ・ガラス・かわら・ランプ をもらった!' }] },
  { key: 'astro', name: 'ほしぞら博士', skin: '#f3d2b0', shirt: '#1f3f8f', pants: '#18234a', hair: '#9aa0aa', hat: 'star',
    talk: () => ['モイン。わしは星を研究しておる。', pick(SPACE), 'もっと聞きたければ、また話しかけておくれ。'] },
  { key: 'dino', name: 'きょうりゅう博士', skin: '#e9c29b', shirt: '#4c8a3c', pants: '#5b4a2a', hair: '#5a3d22', hat: 'dino',
    talk: () => ['モイン!ぼくは恐竜が大好きな博士さ。', pick(DINO), pick(['恐竜のことなら何でも聞いてね!', 'ほかにもたくさん知ってるよ。また来てね!'])] },
  { key: 'teacher', name: 'かけざん先生', skin: '#f5cfa8', shirt: '#c23b5a', pants: '#3a3550', hair: '#2a1f1a', hat: 'glasses',
    talk: g => quiz(g) },
  { key: 'sennin', name: 'モイン仙人', skin: '#f0d0a8', shirt: '#e8e2c8', pants: '#b8ae8a', hair: '#ffffff', hat: 'sennin',
    talk: g => g.flags.sennin
      ? ['ほっほっ。モインの声は、元気のしるし。', pick(['大きな声で「モイン!」と言うと、ブロックもよろこぶんじゃ。', 'じぶんの声を録音して、こわすたびに叫ばせることもできるぞい。設定を見てみなされ。', 'モインとは「こんにちは」に似た、元気なあいさつのことばじゃ。'])]
      : ['ほっほっ。わしはモイン仙人。この島に「モイン!」の声を広めた者じゃ。', 'おぬしの「モイン!」、なかなか良い声じゃった。これをさずけよう。',
        { run: () => { g.give(MOIN, 8); g.flags.sennin = true; g.fanfare(); }, text: 'モインブロックを 8こ もらった!' }] },
  { key: 'chibi', name: 'ちびモイン', skin: '#f6d6b6', shirt: '#ff9ec7', pants: '#6fb7ff', hair: '#7a4a2a', hat: 'bow', small: true,
    talk: () => [pick(CHIBI)] },
];

function quiz(g) {
  const a = 2 + (Math.random() * 8 | 0), b = 2 + (Math.random() * 8 | 0), ans = a * b;
  const opts = new Set([ans]);
  while (opts.size < 4) { const d = pick([-a, a, -b, b, -1, 1, 10, -10]); const v = ans + d; if (v > 0) opts.add(v); }
  const choices = [...opts].sort(() => Math.random() - 0.5).map(v => ({
    label: String(v),
    next: () => v === ans
      ? [{ run: () => { g.give(pick([RED, BLUE, YELLOW, GREEN, PINK]), 8); g.give(MOIN, 1); g.score('quiz'); g.fanfare(); },
        text: `せいかい! ${a} × ${b} = ${ans}。すばらしい!ごほうびにカラーブロックとモインブロックをあげよう。` }, 'もう一問やるかい? また話しかけてね。']
      : [`おしい! ${a} × ${b} = ${ans} だよ。`, `${a}を${b}回たすと… ${Array(b).fill(a).join('+')} = ${ans}。もう一度ちょうせんしてね!`],
  }));
  return ['モイン!わたしはかけざん先生。クイズを出すよ!', { text: `${a} × ${b} は いくつ?`, choices }];
}

// ---- 見た目 ----
function faceTexture(def) {
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  x.fillStyle = def.skin; x.fillRect(0, 0, 16, 16);
  x.fillStyle = def.hair; x.fillRect(0, 0, 16, 4); x.fillRect(0, 4, 2, 3); x.fillRect(14, 4, 2, 3);
  x.fillStyle = '#fff'; x.fillRect(3, 6, 4, 3); x.fillRect(9, 6, 4, 3);
  x.fillStyle = '#2a2240'; x.fillRect(4, 6, 2, 3); x.fillRect(10, 6, 2, 3);
  x.fillStyle = 'rgba(255,120,120,.55)'; x.fillRect(2, 10, 2, 1); x.fillRect(12, 10, 2, 1);
  x.fillStyle = '#8a3a2a'; x.fillRect(6, 11, 4, 1); x.fillRect(5, 10, 1, 1); x.fillRect(10, 10, 1, 1);
  if (def.hat === 'beard' || def.hat === 'sennin') { x.fillStyle = def.hair; x.fillRect(3, 11, 10, 5); x.fillStyle = '#8a3a2a'; x.fillRect(6, 11, 4, 1); }
  if (def.hat === 'glasses') { x.strokeStyle = '#222'; x.lineWidth = 1; x.strokeRect(2.5, 5.5, 5, 4); x.strokeRect(8.5, 5.5, 5, 4); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const box = (w, h, d, color, y0 = 0) => {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y0, 0);
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
};

function labelSprite(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = Math.min(250, x.measureText(text).width + 24);
  x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.roundRect?.(128 - w / 2, 10, w, 44, 12); x.fill();
  x.fillStyle = '#fff'; x.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1); return s;
}
export function bubbleSprite() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.beginPath(); x.roundRect?.(8, 6, 240, 62, 20); x.fill();
  x.beginPath(); x.moveTo(110, 66); x.lineTo(128, 90); x.lineTo(146, 66); x.fill();
  x.fillStyle = '#e8590c'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('モイン!', 128, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(1.4, 0.52, 1); return s;
}

function buildModel(def) {
  const g = new THREE.Group();
  const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
  legL.add(box(0.24, 0.7, 0.26, def.pants, -0.35)); legR.add(box(0.24, 0.7, 0.26, def.pants, -0.35));
  legL.position.set(-0.13, 0.7, 0); legR.position.set(0.13, 0.7, 0);
  const body = box(0.56, 0.72, 0.32, def.shirt, 1.06);
  armL.add(box(0.18, 0.66, 0.2, def.shirt, -0.28)); armR.add(box(0.18, 0.66, 0.2, def.shirt, -0.28));
  armL.children[0].add(box(0.17, 0.12, 0.19, def.skin, -0.66)); armR.children[0].add(box(0.17, 0.12, 0.19, def.skin, -0.66));
  armL.position.set(-0.38, 1.4, 0); armR.position.set(0.38, 1.4, 0);
  const headG = new THREE.Group(); headG.position.y = 1.42;
  const skin = new THREE.MeshLambertMaterial({ color: def.skin }), hair = new THREE.MeshLambertMaterial({ color: def.hair });
  const face = new THREE.MeshLambertMaterial({ map: faceTexture(def) });
  // BoxGeometry の面順: +x, -x, +y, -y, +z(前), -z
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.56, 0.56).translate(0, 0.28, 0), [skin, skin, hair, skin, face, hair]);
  headG.add(head);
  addHat(headG, def);
  g.add(legL, legR, body, armL, armR, headG);
  if (def.small) g.scale.setScalar(0.72); else g.scale.setScalar(0.92);
  return { group: g, legL, legR, armL, armR, head: headG };
}
function addHat(h, def) {
  const add = m => { h.add(m); return m; };
  switch (def.hat) {
    case 'helmet': add(box(0.62, 0.16, 0.62, '#f2c12e', 0.6)); add(box(0.66, 0.04, 0.4, '#f2c12e', 0.52)).position.z = 0.2; break;
    case 'star': { add(box(0.6, 0.06, 0.6, '#1f2a6a', 0.58)); const c = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.6, 6), new THREE.MeshLambertMaterial({ color: '#1f2a6a' })); c.position.y = 0.9; add(c);
      const s = box(0.14, 0.14, 0.14, '#ffe14d', 1.24); s.material.emissive = new THREE.Color('#aa8800'); add(s); break; }
    case 'dino': add(box(0.62, 0.3, 0.62, '#4c8a3c', 0.5)); for (let i = 0; i < 4; i++) { const sp = box(0.06, 0.16, 0.12, '#f2c12e', 0.72); sp.position.z = 0.22 - i * 0.16; add(sp); } break;
    case 'sennin': { const c = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 8), new THREE.MeshLambertMaterial({ color: '#d9c48a' })); c.position.y = 0.72; add(c); break; }
    case 'bow': { const l = box(0.18, 0.14, 0.08, '#ff4f8b', 0.6); l.position.x = -0.12; const r = box(0.18, 0.14, 0.08, '#ff4f8b', 0.6); r.position.x = 0.12; add(l); add(r); break; }
    case 'beard': add(box(0.6, 0.08, 0.6, '#e8e8e8', 0.58)); break;
    default: break;
  }
}

export class NPC {
  constructor(def, world, home) {
    this.def = def; this.name = def.name; this.world = world;
    this.home = home;
    this.pos = new THREE.Vector3(home.x, home.y + 0.2, home.z);
    this.vel = new THREE.Vector3(); this.w = 0.3; this.h = def.small ? 1.4 : 1.8;
    this.yaw = Math.random() * Math.PI * 2;
    this.target = null; this.wait = 1 + Math.random() * 3; this.walkT = 0; this.stuck = 0;
    const m = buildModel(def); Object.assign(this, { model: m });
    this.group = m.group;
    this.label = labelSprite(def.name); this.label.position.y = def.small ? 2.7 : 2.35; this.group.add(this.label);
    this.bubble = bubbleSprite(); this.bubble.position.y = def.small ? 3.2 : 2.85; this.bubble.visible = false; this.group.add(this.bubble);
    this.bubbleT = 0; this.talking = false; this.greetCD = 3 + Math.random() * 6;
  }

  sayMoin(t = 1.6) { this.bubble.visible = true; this.bubbleT = t; }

  update(dt, player) {
    const toP = new THREE.Vector3().subVectors(player.pos, this.pos); toP.y = 0;
    const dP = toP.length();
    let speed = 0, wantYaw = this.yaw;
    if (this.talking || dP < 2.2) {
      wantYaw = Math.atan2(toP.x, toP.z); this.target = null;
    } else if (this.target) {
      const d = new THREE.Vector3(this.target.x - this.pos.x, 0, this.target.z - this.pos.z);
      if (d.length() < 0.6 || this.walkT > 12) { this.target = null; this.wait = 2 + Math.random() * 4; }
      else { wantYaw = Math.atan2(d.x, d.z); speed = 1.3; this.walkT += dt; }
    } else {
      this.wait -= dt;
      if (this.wait <= 0) this.pickTarget();
    }
    // 向き
    let dy = wantYaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 6);
    // 前方の安全確認(水や崖は避ける)
    if (speed > 0) {
      const fx = Math.floor(this.pos.x + Math.sin(this.yaw) * 0.8), fz = Math.floor(this.pos.z + Math.cos(this.yaw) * 0.8), fy = Math.floor(this.pos.y);
      const W = this.world;
      let drop = 0; while (drop < 4 && !BLOCKS[W.get(fx, fy - 1 - drop, fz)].solid && W.get(fx, fy - 1 - drop, fz) !== WATER) drop++;
      if (W.get(fx, fy - 1 - drop, fz) === WATER || W.get(fx, fy, fz) === WATER || drop >= 3) { this.target = null; this.wait = 1; speed = 0; }
    }
    this.vel.x = Math.sin(this.yaw) * speed; this.vel.z = Math.cos(this.yaw) * speed;
    const wet = inWater(this.world, this.pos);
    this.vel.y -= (wet ? 8 : 24) * dt; if (wet) this.vel.y = Math.max(this.vel.y, -2);
    if (wet) this.vel.y += 14 * dt;
    moveBody(this.world, this, dt);
    if (this.hitWall && this.onGround && speed > 0) {
      const fx = Math.floor(this.pos.x + Math.sin(this.yaw) * 0.6), fz = Math.floor(this.pos.z + Math.cos(this.yaw) * 0.6), fy = Math.floor(this.pos.y);
      if (!BLOCKS[this.world.get(fx, fy + 1, fz)].solid && !BLOCKS[this.world.get(fx, fy + 2, fz)].solid) this.vel.y = 7.2;
      else if ((this.stuck += dt) > 0.8) { this.target = null; this.wait = 0.5; this.stuck = 0; this.yaw += Math.PI * (0.5 + Math.random()); }
    }
    if (this.pos.y < -10) this.pos.set(this.home.x, this.home.y + 1, this.home.z);
    // 見た目
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
    if (speed > 0) this.walkPhase = (this.walkPhase || 0) + dt * 8; else this.walkPhase = (this.walkPhase || 0) * 0.85;
    const s = Math.sin(this.walkPhase) * (speed > 0 ? 0.7 : 0.7 * Math.min(1, Math.abs(Math.sin(this.walkPhase))));
    this.model.legL.rotation.x = s; this.model.legR.rotation.x = -s;
    this.model.armL.rotation.x = -s * 0.8; this.model.armR.rotation.x = s * 0.8;
    if (this.talking) this.model.armR.rotation.x = -1.2 + Math.sin(performance.now() / 150) * 0.3;
    this.model.head.rotation.y = 0;
    this.label.visible = dP < 10;
    // 時々あいさつ
    this.greetCD -= dt;
    if (this.greetCD < 0 && dP < 7 && !this.talking) { this.sayMoin(); this.greetCD = 8 + Math.random() * 10; }
    if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0) this.bubble.visible = false; }
  }

  pickTarget() {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 13;
      const x = this.home.cx + Math.cos(a) * r, z = this.home.cz + Math.sin(a) * r;
      const y = Math.floor(this.pos.y);
      if (this.world.get(Math.floor(x), y, Math.floor(z)) === AIR) { this.target = { x, z }; this.walkT = 0; return; }
    }
    this.wait = 1;
  }

  // レイとの当たり(簡易AABB)
  hitByRay(o, d, maxD) {
    const min = [this.pos.x - 0.4, this.pos.y, this.pos.z - 0.4], max = [this.pos.x + 0.4, this.pos.y + this.h + 0.1, this.pos.z + 0.4];
    const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z]; let t0 = 0, t1 = maxD;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(dd[i]) < 1e-9) { if (oo[i] < min[i] || oo[i] > max[i]) return null; continue; }
      let a = (min[i] - oo[i]) / dd[i], b = (max[i] - oo[i]) / dd[i]; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return null;
    }
    return t0;
  }
}
