// モインクラフト 本体
import * as THREE from 'three';
import { BLOCKS, AIR, WATER, GRASS, DIRT, STONE, COBBLE, PLANKS, LOG, GLASS, BRICK, MOIN, LEAVES, SAND, PLACEABLE,
  makeAtlasTexture, blockIcon, ATLAS_COLS, ATLAS_ROWS } from './blocks.js';
import { World, buildChunkGeometry, SX, SZ, SY, CH, LIGHT_BOOST } from './world.js';
import { moveBody, collides, inWater } from './physics.js';
import { NPC, NPC_DEFS } from './npc.js';
import { MoinVoice } from './moin.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'moincraft-save-v1', SET_KEY = 'moincraft-settings-v1';
const isTouch = matchMedia('(pointer: coarse)').matches || (!matchMedia('(pointer: fine)').matches && 'ontouchstart' in window);
const DAY_LEN = 600; // 秒で1日
const REACH = 6;

// ---- 設定 ----
const settings = Object.assign({ voice: 'auto', vol: 1, creative: false, sens: 1, dist: isTouch ? 60 : 90 }, load(SET_KEY) || {});
function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

// ---- 描画の準備 ----
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 400);
scene.add(camera);
scene.fog = new THREE.Fog(0x9fd4f5, 30, settings.dist);
const hemi = new THREE.HemisphereLight(0xffffff, 0x667755, 1.1); scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffffff, 1.2); sunLight.position.set(0.5, 1, 0.3); scene.add(sunLight);

const atlas = makeAtlasTexture();
const solidMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5 });
const waterMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide });

// 空:太陽・月・雲
const sun = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0xfff1a8, fog: false }));
const moon = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false }));
scene.add(sun, moon);
const clouds = new THREE.Group(); scene.add(clouds);
{
  const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 40; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(6 + Math.random() * 14, 1.2, 4 + Math.random() * 10), cm);
    c.position.set(Math.random() * 260 - 50, 58 + Math.random() * 4, Math.random() * 260 - 50); clouds.add(c);
  }
}
const stars = (() => {
  const g = new THREE.BufferGeometry(), p = [];
  for (let i = 0; i < 600; i++) { const v = new THREE.Vector3().randomDirection(); if (v.y < 0.05) v.y = Math.abs(v.y) + 0.05; v.multiplyScalar(300); p.push(v.x, v.y, v.z); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const s = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 }));
  scene.add(s); return s;
})();

// ---- 状態 ----
let world, chunks = new Map(), npcs = [], state = 'loading';
const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), w: 0.3, h: 1.75, yaw: 0, pitch: 0, onGround: false, fly: false, stepT: 0 };
let inv = {}, hotbar = [], sel = 0, flags = {}, moinCount = 0, dayTime = 0.3;
const voice = new MoinVoice(); voice.mode = settings.voice; voice.setVolume(settings.vol);

function newGameState() {
  inv = { [PLANKS]: 12, [GLASS]: 4, [MOIN]: 2 };
  hotbar = [GRASS, DIRT, STONE, COBBLE, PLANKS, LOG, GLASS, BRICK, MOIN];
  sel = 0; flags = {}; moinCount = 0; dayTime = 0.3;
}

function buildAllChunks() {
  for (const m of chunks.values()) { for (const o of m) { scene.remove(o); o.geometry.dispose(); } }
  chunks.clear();
  for (let cz = 0; cz < SZ / CH; cz++) for (let cx = 0; cx < SX / CH; cx++) rebuildChunk(cx, cz);
}
function rebuildChunk(cx, cz) {
  const key = cx + ',' + cz, old = chunks.get(key);
  if (old) for (const o of old) { scene.remove(o); o.geometry.dispose(); }
  const g = buildChunkGeometry(world, cx, cz), list = [];
  if (g.solid) { const m = new THREE.Mesh(g.solid, solidMat); scene.add(m); list.push(m); }
  if (g.water) { const m = new THREE.Mesh(g.water, waterMat); m.renderOrder = 2; scene.add(m); list.push(m); }
  chunks.set(key, list);
}

function spawnNPCs() {
  for (const n of npcs) scene.remove(n.group);
  npcs = [];
  const c = world.villageCenter;
  NPC_DEFS.forEach((def, i) => {
    const h = world.houses[i % world.houses.length];
    const home = { x: h.door.x, y: world.topY(Math.floor(h.door.x), Math.floor(h.door.z)) + 1, z: h.door.z, cx: c.x + 0.5, cz: c.z + 0.5 };
    if (def.key === 'chief') { home.x = c.x + 3.5; home.z = c.z + 4.5; home.y = c.y + 1; }
    const n = new NPC(def, world, home); npcs.push(n); scene.add(n.group);
  });
}

function startWorld(fresh) {
  const save = fresh ? null : load(SAVE_KEY);
  const seed = save?.seed ?? (Math.random() * 1e9 | 0);
  world = new World(seed);
  if (save) {
    world.applyEdits(save.edits || []);
    inv = save.inv || {}; hotbar = save.hotbar || []; sel = save.sel || 0; flags = save.flags || {}; moinCount = save.moinCount || 0; dayTime = save.dayTime ?? 0.3;
    while (hotbar.length < 9) hotbar.push(GRASS);
  } else newGameState();
  buildAllChunks();
  spawnNPCs();
  const c = world.villageCenter;
  if (save?.player) { player.pos.set(...save.player.pos); player.yaw = save.player.yaw; player.pitch = save.player.pitch; player.fly = !!save.player.fly; }
  else { player.pos.set(c.x + 0.5, c.y + 1, c.z + 7.5); player.yaw = 0; player.pitch = -0.1; player.fly = false; }
  // 埋まっていたら上へ
  while (collides(world, player.pos, player.w, player.h) && player.pos.y < SY) player.pos.y += 1;
  player.vel.set(0, 0, 0);
  refreshHotbar(); updateMoinCount();
}

function saveGame() {
  if (!world) return;
  store(SAVE_KEY, { ...world.serialize(), inv, hotbar, sel, flags, moinCount, dayTime,
    player: { pos: player.pos.toArray(), yaw: player.yaw, pitch: player.pitch, fly: player.fly } });
}
setInterval(() => { if (state === 'play') saveGame(); }, 8000);
addEventListener('pagehide', () => { if (world) saveGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && world) saveGame(); });

// ---- 手に持ったブロック ----
const heldMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5, depthTest: false, fog: false });
const held = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), heldMat); held.renderOrder = 10;
held.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(24 * 3).fill(1), 3));
camera.add(held);
const heldBase = new THREE.Vector3(0.36, -0.32, -0.62);
held.position.copy(heldBase); held.rotation.set(0.15, -0.6, 0);
let swing = 0, heldId = -1;
function setHeld(id) {
  if (id === heldId) return; heldId = id;
  const b = BLOCKS[id]; if (!b) { held.visible = false; return; } held.visible = true;
  const uv = held.geometry.getAttribute('uv'), col = held.geometry.getAttribute('color');
  // BoxGeometry の面: +x,-x,+y,-y,+z,-z
  const faceTile = [b.tiles[1], b.tiles[1], b.tiles[0], b.tiles[2], b.tiles[1], b.tiles[1]];
  const shadeF = [0.8, 0.8, 1, 0.5, 0.9, 0.7];
  for (let f = 0; f < 6; f++) {
    const t = faceTile[f], u0 = (t % ATLAS_COLS) / ATLAS_COLS, v0 = 1 - ((t / ATLAS_COLS | 0) + 1) / ATLAS_ROWS;
    const corners = [[0, 1], [1, 1], [0, 0], [1, 0]];
    for (let k = 0; k < 4; k++) { uv.setXY(f * 4 + k, u0 + corners[k][0] / ATLAS_COLS, v0 + corners[k][1] / ATLAS_ROWS); const l = b.light ? 1.6 : shadeF[f]; col.setXYZ(f * 4 + k, l, l, l); }
  }
  uv.needsUpdate = true; col.needsUpdate = true;
}

// ---- 選択枠・ひび ----
const hl = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005)), new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.6 }));
hl.visible = false; scene.add(hl);
const crackTex = (() => {
  const c = document.createElement('canvas'); c.width = 16 * 5; c.height = 16; const x = c.getContext('2d');
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const lines = []; for (let i = 0; i < 16; i++) { const a = r() * Math.PI * 2; let px = 8, py = 8; const seg = []; for (let j = 0; j < 4; j++) { px += Math.cos(a + (r() - 0.5)) * 2; py += Math.sin(a + (r() - 0.5)) * 2; seg.push([px, py]); } lines.push(seg); }
  for (let st = 0; st < 5; st++) { x.fillStyle = 'rgba(20,10,0,.85)'; const n = 3 + st * 3; for (let i = 0; i < n; i++) for (const [px, py] of lines[i].slice(0, 2 + (st >> 1))) x.fillRect(st * 16 + Math.max(0, Math.min(15, px | 0)), Math.max(0, Math.min(15, py | 0)), 1, 1); }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.repeat.set(1 / 5, 1); return t;
})();
const crack = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
crack.visible = false; scene.add(crack);

// ---- 破片 ----
const parts = [];
const partGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
function burst(x, y, z, id, n = 14) {
  const col = new THREE.Color(BLOCKS[id].color);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.75 + Math.random() * 0.5) }));
    m.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6);
    scene.add(m); parts.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.6 + Math.random() * 0.5 });
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; p.v.y -= 14 * dt; p.m.position.addScaledVector(p.v, dt);
    if (BLOCKS[world.get(Math.floor(p.m.position.x), Math.floor(p.m.position.y), Math.floor(p.m.position.z))].solid) { p.v.multiplyScalar(0.3); p.m.position.y = Math.ceil(p.m.position.y - 0.06) + 0.06; }
    p.m.scale.setScalar(Math.max(0.01, Math.min(1, p.life * 2)));
    if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); }
  }
}

// ---- モイン! 演出 ----
let shake = 0;
function moinFx() {
  voice.shout();
  moinCount++; updateMoinCount();
  const el = document.createElement('div'); el.className = 'moin';
  el.textContent = Math.random() < 0.12 ? 'モイ〜〜ン!!' : Math.random() < 0.1 ? 'モモモイン!' : 'モイン!';
  el.style.setProperty('--r', ((Math.random() - 0.5) * 24).toFixed(1) + 'deg');
  el.style.setProperty('--dx', ((Math.random() - 0.5) * 160).toFixed(0) + 'px');
  $('moins').appendChild(el); setTimeout(() => el.remove(), 950);
  const f = $('flash'); f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, 90);
  shake = 0.25;
  // 近くの村人もつられて「モイン!」
  for (const n of npcs) if (n.pos.distanceTo(player.pos) < 9) setTimeout(() => n.sayMoin(1.4), 150 + Math.random() * 500);
  if (moinCount === 1) toast('はじめての「モイン!」');
  if (moinCount % 100 === 0) { toast(`モイン ${moinCount}回 たっせい!`); voice.fanfare(); }
}
function updateMoinCount() { $('moinCount').textContent = `モイン ${moinCount}回`; }

// ---- UI ----
function toast(text) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; $('toasts').appendChild(t); setTimeout(() => t.remove(), 2700); }
let nameTimer = 0;
function refreshHotbar() {
  const hb = $('hotbar'); hb.innerHTML = '';
  hotbar.forEach((id, i) => {
    const s = document.createElement('div'); const n = settings.creative ? '∞' : (inv[id] || 0);
    s.className = 'slot' + (i === sel ? ' sel' : '') + (!settings.creative && !inv[id] ? ' empty' : '');
    s.innerHTML = `<span class="k">${i + 1}</span><img src="${blockIcon(id)}" alt=""><span class="n">${n}</span>`;
    s.addEventListener('pointerdown', e => { e.stopPropagation(); selectSlot(i); });
    hb.appendChild(s);
  });
  setHeld(hotbar[sel]);
  $('modeChip').classList.toggle('hide', !settings.creative && !player.fly);
  $('modeChip').textContent = [settings.creative ? 'クリエイティブ' : '', player.fly ? '飛行中' : ''].filter(Boolean).join(' / ');
}
function selectSlot(i) {
  sel = (i + 9) % 9; refreshHotbar();
  const bn = $('blockName'); bn.textContent = BLOCKS[hotbar[sel]].name; bn.style.opacity = 1; clearTimeout(nameTimer); nameTimer = setTimeout(() => bn.style.opacity = 0, 1400);
}
function give(id, n) {
  inv[id] = (inv[id] || 0) + n;
  if (!hotbar.includes(id)) { let k = hotbar.findIndex(h => !inv[h]); if (k < 0) k = sel; hotbar[k] = id; }
  refreshHotbar();
  toast(`+${n} ${BLOCKS[id].name}`);
}

function openInv() {
  const g = $('invGrid'); g.innerHTML = '';
  for (const id of PLACEABLE) {
    const n = settings.creative ? '∞' : (inv[id] || 0);
    const s = document.createElement('div'); s.className = 'slot' + (!settings.creative && !inv[id] ? ' empty' : '');
    s.title = BLOCKS[id].name;
    s.innerHTML = `<img src="${blockIcon(id)}" alt=""><span class="n">${n}</span>`;
    s.addEventListener('click', () => { const j = hotbar.indexOf(id); if (j >= 0) { hotbar[j] = hotbar[sel]; } hotbar[sel] = id; refreshHotbar(); voice.blip(); closePanels(); selectSlot(sel); });
    g.appendChild(s);
  }
  showPanel('invPanel');
}
function showPanel(id) { exitLock(); $(id).classList.remove('hide'); state = state === 'title' ? 'title' : 'menu'; }
function closePanels() {
  $('invPanel').classList.add('hide'); $('setPanel').classList.add('hide');
  if (state === 'menu') { state = 'play'; requestLock(); }
}
$('bInv').addEventListener('click', openInv);
$('invClose').addEventListener('click', closePanels);
$('bSet').addEventListener('click', openSettings);
$('setClose').addEventListener('click', closePanels);
$('bSettings0').addEventListener('click', openSettings);
for (const p of ['invPanel', 'setPanel']) $(p).addEventListener('pointerdown', e => { if (e.target.id === p) closePanels(); });

function openSettings() {
  $('sVoice').value = settings.voice; $('sVol').value = settings.vol; $('sCreative').checked = settings.creative;
  $('sSens').value = settings.sens; $('sDist').value = String(settings.dist);
  $('sTitle').classList.toggle('hide', state === 'title'); $('setClose').textContent = state === 'title' ? 'とじる' : 'ゲームにもどる';
  updateRecNote();
  showPanel('setPanel');
}
function updateRecNote() { $('sRecNote').textContent = voice.recBuffer ? '録音ずみ!こわすたびにあなたの声で叫びます(「おまかせ」か「録音した自分の声」を選んでね)。' : '録音すると、こわすたびにあなたの声で叫びます(声はこの端末の中だけに保存されます)。'; }
$('sVoice').addEventListener('change', e => { settings.voice = voice.mode = e.target.value; store(SET_KEY, settings); voice.unlock(); voice.shout(); });
$('sVol').addEventListener('input', e => { settings.vol = +e.target.value; voice.setVolume(settings.vol); store(SET_KEY, settings); });
$('sVol').addEventListener('change', () => { voice.unlock(); voice.shout(); });
$('sCreative').addEventListener('change', e => { settings.creative = e.target.checked; store(SET_KEY, settings); refreshHotbar(); });
$('sSens').addEventListener('input', e => { settings.sens = +e.target.value; store(SET_KEY, settings); });
$('sDist').addEventListener('change', e => { settings.dist = +e.target.value; store(SET_KEY, settings); });
$('sTest').addEventListener('click', () => { voice.unlock(); voice.lastShout = 0; voice.shout(); });
$('sRecDel').addEventListener('click', () => { voice.clearRecording(); updateRecNote(); });
$('sRec').addEventListener('click', async () => {
  const b = $('sRec');
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { $('sRecNote').textContent = 'このブラウザでは録音できません。'; return; }
  b.disabled = true; b.textContent = '🔴 「モイン!」と言ってね…';
  try { await voice.record(1.6); updateRecNote(); if (settings.voice === 'speech' || settings.voice === 'synth') { settings.voice = voice.mode = 'rec'; $('sVoice').value = 'rec'; store(SET_KEY, settings); } voice.lastShout = 0; voice.shout(); }
  catch (e) { $('sRecNote').textContent = 'マイクが使えませんでした(ブラウザでマイクを許可してください)。'; }
  b.disabled = false; b.textContent = '🎙️ 録音する(1.6秒)';
});
$('sTitle').addEventListener('click', () => { saveGame(); closePanels(); toTitle(); });

// ---- 会話 ----
let dlg = null;
function talkTo(npc) {
  if (dlg) return;
  exitLock();
  const g = { touch: isTouch, flags, give, fanfare: () => voice.fanfare(), score: k => { flags['score_' + k] = (flags['score_' + k] || 0) + 1; } };
  npc.talking = true; npc.sayMoin(1.2); if (npc.def.key === 'chief') flags.metChief = true;
  dlg = { npc, steps: npc.def.talk(g), i: 0 };
  state = 'talk'; mining = false; $('hint').classList.add('hide'); $('tTalk').classList.add('hide');
  $('dialog').classList.remove('hide'); $('dialog').querySelector('.who').textContent = npc.name;
  showStep();
}
function showStep() {
  const step = dlg.steps[dlg.i];
  if (step === undefined) return endTalk();
  const s = typeof step === 'string' ? { text: step } : step;
  if (s.run && !s._done) { s._done = true; s.run(); }
  $('dialog').querySelector('.text').textContent = s.text;
  const ch = $('dialog').querySelector('.choices'); ch.innerHTML = '';
  $('dialog').querySelector('.next').classList.toggle('hide', !!s.choices);
  if (s.choices) s.choices.forEach((c, k) => {
    const b = document.createElement('button'); b.textContent = c.label;
    b.addEventListener('click', e => { e.stopPropagation(); chooseOpt(k); });
    ch.appendChild(b);
  });
  voice.blip();
}
function chooseOpt(k) {
  const s = dlg.steps[dlg.i]; if (!s?.choices?.[k]) return;
  dlg.steps = s.choices[k].next(); dlg.i = 0; showStep();
}
function advance() { const s = dlg.steps[dlg.i]; if (s?.choices) return; dlg.i++; showStep(); }
function endTalk() {
  if (dlg) dlg.npc.talking = false; dlg = null;
  $('dialog').classList.add('hide');
  state = 'play'; requestLock();
}
$('dialog').addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target.tagName !== 'BUTTON') advance(); });

// ---- 入力 ----
const keys = {};
let mining = false, mineTarget = null, mineProg = 0, mineTick = 0, aimNPC = null, aimHit = null;
function requestLock() { if (!isTouch && state === 'play' && document.pointerLockElement !== canvas) { try { const r = canvas.requestPointerLock?.(); r?.catch?.(() => {}); } catch (e) {} } }
function exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && state === 'play' && !isTouch) { state = 'paused'; $('pause').classList.remove('hide'); mining = false; }
});
$('pSet').addEventListener('click', e => { e.stopPropagation(); $('pause').classList.add('hide'); state = 'play'; openSettings(); });
$('pause').addEventListener('click', () => { $('pause').classList.add('hide'); state = 'play'; requestLock(); });
canvas.addEventListener('mousedown', e => {
  if (isTouch) return;
  voice.unlock();
  if (state !== 'play') return;
  if (document.pointerLockElement !== canvas) { requestLock(); return; }
  if (e.button === 0) { if (aimNPC) talkTo(aimNPC); else mining = true; }
  if (e.button === 2) placeBlock();
});
addEventListener('mouseup', e => { if (e.button === 0) mining = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || state !== 'play') return;
  if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return; // マウス固定直後の飛びを無視
  const s = 0.0023 * settings.sens;
  player.yaw -= e.movementX * s; player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - e.movementY * s));
});
addEventListener('wheel', e => { if (state === 'play') selectSlot(sel + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });
addEventListener('keydown', e => {
  if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) { keys[e.code] = true; return; }
  keys[e.code] = true;
  if (state === 'talk') {
    if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); advance(); }
    if (/^Digit[1-4]$/.test(e.code)) chooseOpt(+e.code.slice(5) - 1);
    if (e.code === 'Escape') endTalk();
    return;
  }
  if (state === 'menu' && (e.code === 'Escape' || e.code === 'KeyI')) { closePanels(); return; }
  if (state !== 'play') return;
  if (/^Digit[1-9]$/.test(e.code)) selectSlot(+e.code.slice(5) - 1);
  if (e.code === 'KeyE' && aimNPC) talkTo(aimNPC);
  if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); openInv(); }
  if (e.code === 'KeyH') respawn();
  if (e.code === 'KeyF') { player.fly = !player.fly; player.vel.y = 0; refreshHotbar(); toast(player.fly ? '飛行モード ON' : '飛行モード OFF'); }
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mining = false; });

// タッチ操作
const touch = { joyId: null, joyX: 0, joyY: 0, mx: 0, my: 0, lookId: null, lx: 0, ly: 0, jump: false, lookMoved: 0 };
function setupTouch() {
  $('touch').classList.remove('hide');
  const joy = $('joy'), knob = joy.querySelector('i');
  const tz = $('touch');
  tz.addEventListener('touchstart', e => {
    voice.unlock();
    for (const t of e.changedTouches) {
      if (t.target.closest('.tb')) continue;
      if (t.clientX < innerWidth * 0.42 && touch.joyId === null) {
        touch.joyId = t.identifier; touch.joyX = t.clientX; touch.joyY = t.clientY; touch.mx = touch.my = 0;
        joy.style.display = 'block'; joy.style.left = (t.clientX - 60) + 'px'; joy.style.top = (t.clientY - 60) + 'px'; knob.style.transform = '';
      } else if (touch.lookId === null) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; touch.lookMoved = 0; touch.lookStart = performance.now(); }
    }
    e.preventDefault();
  }, { passive: false });
  tz.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.joyId) {
        let dx = t.clientX - touch.joyX, dy = t.clientY - touch.joyY; const l = Math.hypot(dx, dy), m = 50;
        if (l > m) { dx *= m / l; dy *= m / l; }
        touch.mx = dx / m; touch.my = dy / m; knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (t.identifier === touch.lookId && state === 'play') {
        const dx = t.clientX - touch.lx, dy = t.clientY - touch.ly; touch.lx = t.clientX; touch.ly = t.clientY; touch.lookMoved += Math.abs(dx) + Math.abs(dy);
        const s = 0.0062 * settings.sens;
        player.yaw -= dx * s; player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - dy * s));
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.joyId) { touch.joyId = null; touch.mx = touch.my = 0; joy.style.display = 'none'; }
      if (t.identifier === touch.lookId) {
        touch.lookId = null;
        // 軽くタップしたら、村人なら話す
        if (touch.lookMoved < 10 && performance.now() - touch.lookStart < 300 && aimNPC && state === 'play') talkTo(aimNPC);
      }
    }
  };
  tz.addEventListener('touchend', end); tz.addEventListener('touchcancel', end);
  const hold = (id, on, off) => {
    const b = $(id);
    b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); voice.unlock(); b.classList.add('on'); on(); }, { passive: false });
    const up = e => { e.preventDefault(); b.classList.remove('on'); off && off(); };
    b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
  };
  hold('tMine', () => { if (state === 'play') mining = true; }, () => { mining = false; });
  hold('tPlace', () => { if (state === 'play') placeBlock(); });
  hold('tJump', () => { touch.jump = true; }, () => { touch.jump = false; });
  hold('tFly', () => { player.fly = !player.fly; player.vel.y = 0; refreshHotbar(); toast(player.fly ? '飛行モード ON(⤒で上昇)' : '飛行モード OFF'); });
  hold('tTalk', () => { if (aimNPC && state === 'play') talkTo(aimNPC); });
}

// ---- 採掘と設置 ----
const _dir = new THREE.Vector3(), _eye = new THREE.Vector3();
function aim() {
  camera.getWorldDirection(_dir); _eye.copy(camera.position);
  aimHit = world.raycast(_eye, _dir, REACH);
  aimNPC = null; let best = aimHit ? aimHit.dist : REACH;
  for (const n of npcs) { const t = n.hitByRay(_eye, _dir, 4.5); if (t !== null && t < best) { best = t; aimNPC = n; } }
  if (aimNPC) aimHit = null;
  hl.visible = !!aimHit;
  if (aimHit) hl.position.set(aimHit.x + 0.5, aimHit.y + 0.5, aimHit.z + 0.5);
  $('tTalk').classList.toggle('hide', !aimNPC);
  const hint = $('hint');
  if (aimNPC && !isTouch) { hint.textContent = `${aimNPC.name} — クリック / E で はなす`; hint.classList.remove('hide'); }
  else if (aimNPC) { hint.textContent = `${aimNPC.name}`; hint.classList.remove('hide'); }
  else hint.classList.add('hide');
}

function updateMining(dt) {
  const ring = $('mineRing');
  if (!mining || !aimHit || !BLOCKS[aimHit.id].breakable) {
    mineProg = 0; mineTarget = null; crack.visible = false; ring.style.opacity = 0; return;
  }
  const key = aimHit.x + ',' + aimHit.y + ',' + aimHit.z;
  if (key !== mineTarget) { mineTarget = key; mineProg = 0; }
  const hard = BLOCKS[aimHit.id].hard * (settings.creative ? 0.25 : 1);
  mineProg += dt / Math.max(0.05, hard);
  swing = Math.max(swing, 0.6);
  mineTick -= dt;
  if (mineTick <= 0) { mineTick = 0.22; voice.tick(aimHit.id); burst(aimHit.x, aimHit.y, aimHit.z, aimHit.id, 2); }
  crack.visible = true; crack.position.set(aimHit.x + 0.5, aimHit.y + 0.5, aimHit.z + 0.5);
  crackTex.offset.x = Math.min(4, Math.floor(mineProg * 5)) / 5;
  ring.style.opacity = 1; $('mineArc').setAttribute('stroke-dashoffset', String(119.4 * (1 - Math.min(1, mineProg))));
  if (mineProg >= 1) {
    const { x, y, z, id } = aimHit;
    // 隣が水なら水が流れこむ
    const wet = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => world.get(x + a, y + b, z + c) === WATER);
    world.set(x, y, z, wet ? WATER : AIR);
    if (!settings.creative || !inv[id]) {
      inv[id] = (inv[id] || 0) + 1;
      if (!hotbar.includes(id) && PLACEABLE.includes(id)) { const k = hotbar.findIndex(h => !inv[h]); if (k >= 0) hotbar[k] = id; }
    }
    refreshHotbar();
    burst(x, y, z, id, 16); voice.breakSfx(); moinFx();
    mineProg = 0; mineTarget = null; crack.visible = false;
    if (settings.creative) mineTick = 0;
  }
}

function placeBlock() {
  if (!aimHit) return;
  const id = hotbar[sel];
  if (!settings.creative && !inv[id]) { toast(`${BLOCKS[id].name} を持っていません`); return; }
  const x = aimHit.x + aimHit.nx, y = aimHit.y + aimHit.ny, z = aimHit.z + aimHit.nz;
  const cur = world.get(x, y, z);
  if (!(cur === AIR || cur === WATER) || !world.inside(x, y, z)) return;
  // 自分やNPCに重ならないように
  const overlap = (p, w, h) => x + 1 > p.x - w && x < p.x + w && z + 1 > p.z - w && z < p.z + w && y + 1 > p.y && y < p.y + h;
  if (overlap(player.pos, player.w, player.h) || npcs.some(n => overlap(n.pos, n.w, n.h))) return;
  world.set(x, y, z, id);
  if (!settings.creative) inv[id]--;
  refreshHotbar(); voice.place(); swing = 1;
}

// ---- 自宅(村)へもどる ----
function respawn() {
  const c = world.villageCenter, x = Math.floor(c.x) + 0.5, z = Math.floor(c.z) + 7.5;
  player.pos.set(x, world.topY(Math.floor(x), Math.floor(z)) + 1.2, z);
  player.vel.set(0, 0, 0); player.yaw = 0; player.pitch = -0.1;
  mining = false; voice.blip(); toast('🏠 村にもどってきた');
}
$('bHome').addEventListener('click', e => { e.stopPropagation(); if (state === 'play') respawn(); });

// ---- プレイヤー移動 ----
function updatePlayer(dt) {
  let fx = 0, fz = 0;
  if (keys.KeyW || keys.ArrowUp) fz += 1; if (keys.KeyS || keys.ArrowDown) fz -= 1;
  if (keys.KeyA || keys.ArrowLeft) fx -= 1; if (keys.KeyD || keys.ArrowRight) fx += 1;
  if (isTouch) { fx += touch.mx; fz -= touch.my; }
  const l = Math.hypot(fx, fz); if (l > 1) { fx /= l; fz /= l; }
  const sprint = keys.ShiftLeft && !player.fly || (isTouch && l > 0.95);
  const wet = inWater(world, player.pos, 0.6);
  const speed = player.fly ? 10 : wet ? 2.6 : sprint ? 6.2 : 4.3;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  // 前 = (-sin, -cos)
  const wx = (-sy * fz + cy * fx) * speed, wz = (-cy * fz - sy * fx) * speed;
  const acc = player.onGround || player.fly ? 14 : 4;
  player.vel.x += (wx - player.vel.x) * Math.min(1, acc * dt);
  player.vel.z += (wz - player.vel.z) * Math.min(1, acc * dt);
  const jump = keys.Space || touch.jump;
  if (player.fly) {
    const up = (jump ? 1 : 0) - (keys.ShiftLeft || keys.ShiftRight ? 1 : 0);
    player.vel.y += (up * 8 - player.vel.y) * Math.min(1, 10 * dt);
  } else if (wet) {
    player.vel.y -= 9 * dt; if (jump) player.vel.y += 22 * dt;
    player.vel.y = Math.max(-3, Math.min(3.2, player.vel.y));
  } else {
    player.vel.y -= 26 * dt;
    if (jump && player.onGround) player.vel.y = 8.4;
    player.vel.y = Math.max(-40, player.vel.y);
  }
  const hadGround = player.onGround;
  moveBody(world, player, dt);
  // タッチでは段差を自動でのぼる
  if (isTouch && player.hitWall && player.onGround && !player.fly && l > 0.2) {
    const ax = Math.floor(player.pos.x + Math.sign(wx) * 0.5), az = Math.floor(player.pos.z + Math.sign(wz) * 0.5), ay = Math.floor(player.pos.y);
    if (!BLOCKS[world.get(ax, ay + 1, az)].solid && !BLOCKS[world.get(ax, ay + 2, az)].solid) player.vel.y = 8.4;
  }
  if (player.fly && player.onGround && !jump) { /* 着地しても飛行は続く */ }
  if (player.onGround && l > 0.1 && !player.fly) { player.stepT -= dt * (sprint ? 1.4 : 1); if (player.stepT <= 0) { player.stepT = 0.38; voice.step(); } }
  if (!hadGround && player.onGround) voice.step();
  if (player.pos.y < -20) respawn();
  // カメラ
  const bob = player.onGround && l > 0.1 && !player.fly ? Math.sin(performance.now() / 110) * 0.04 : 0;
  camera.position.set(player.pos.x, player.pos.y + 1.6 + bob, player.pos.z);
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake * 0.3; camera.position.y += (Math.random() - 0.5) * shake * 0.3; }
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  // 手のブロック
  swing = Math.max(0, swing - dt * 3);
  const sw = Math.sin(swing * Math.PI);
  held.position.set(heldBase.x - sw * 0.12, heldBase.y + bob * 0.5 - sw * 0.1, heldBase.z - sw * 0.15);
  held.rotation.set(0.15 - sw * 0.6, -0.6, 0);
  // 水中は青く
  const headWet = world.get(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z)) === WATER;
  scene.userData.underwater = headWet;
}

// ---- 昼と夜 ----
const DAY = new THREE.Color(0x8fcdf3), NIGHT = new THREE.Color(0x0d1736), DUSK = new THREE.Color(0xf4a46a), WATERFOG = new THREE.Color(0x1f4f8a);
const _c = new THREE.Color();
function updateSky(dt) {
  dayTime = (dayTime + dt / DAY_LEN) % 1;
  const a = dayTime * Math.PI * 2; // 0=真夜中, 0.5=正午
  const sunH = -Math.cos(a);
  const light = 0.32 + 0.68 * Math.max(0, Math.min(1, sunH * 1.6 + 0.35));
  _c.copy(NIGHT).lerp(DAY, Math.max(0, Math.min(1, sunH * 1.6 + 0.35)));
  const dusk = Math.max(0, 1 - Math.abs(sunH) * 4) * 0.55; _c.lerp(DUSK, dusk);
  if (scene.userData.underwater) { scene.fog.color.copy(WATERFOG); scene.fog.near = 1; scene.fog.far = 14; scene.background = WATERFOG; }
  else { scene.background = _c.clone(); scene.fog.color.copy(_c); scene.fog.near = settings.dist * 0.35; scene.fog.far = settings.dist; }
  solidMat.color.setScalar(light); waterMat.color.setScalar(light); heldMat.color.setScalar(light);
  hemi.intensity = 0.35 + light * 0.9; sunLight.intensity = light * 1.1;
  stars.material.opacity = Math.max(0, 1 - light * 1.6);
  const p = camera.position;
  const sd = new THREE.Vector3(0.3, sunH, Math.sin(a)).normalize();
  sun.position.set(p.x + sd.x * 200, p.y + sd.y * 200, p.z + sd.z * 200); sun.lookAt(p);
  moon.position.set(p.x - sd.x * 200, p.y - sd.y * 200, p.z - sd.z * 200); moon.lookAt(p);
  stars.position.copy(p);
  clouds.position.x = (clouds.position.x + dt * 0.8) % 120;
}

// ---- メインループ ----
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (world && state !== 'loading') {
    if (state === 'play' || state === 'talk') {
      if (state === 'play') updatePlayer(dt); else { player.vel.x = player.vel.z = 0; }
      for (const n of npcs) n.update(dt, player);
      if (state === 'play') { aim(); updateMining(dt); } else { hl.visible = false; crack.visible = false; }
      updateParts(dt);
      updateSky(dt);
      // 変更のあったチャンクを作り直す(1フレームに数個まで)
      let k = 0; for (const key of world.dirty) { const [cx, cz] = key.split(',').map(Number); rebuildChunk(cx, cz); world.dirty.delete(key); if (++k >= 4) break; }
    } else if (state === 'title') {
      // タイトル画面ではゆっくり村を見回す
      const c = world.villageCenter, t = now / 9000;
      camera.position.set(c.x + Math.cos(t) * 30, c.y + 16, c.z + Math.sin(t) * 30);
      camera.lookAt(c.x, c.y + 2, c.z);
      for (const n of npcs) n.update(dt, { pos: new THREE.Vector3(1e4, 0, 1e4) });
      updateSky(dt * 0.2);
    }
    held.visible = state === 'play' || state === 'paused' || state === 'menu' ? !!BLOCKS[hotbar[sel]] : false;
  }
  renderer.render(scene, camera);
}

function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ---- 画面遷移 ----
function toTitle() {
  state = 'title';
  $('hud').classList.add('hide'); $('touch').classList.add('hide'); $('pause').classList.add('hide'); $('dialog').classList.add('hide');
  $('title').classList.remove('hide');
  const has = !!load(SAVE_KEY);
  $('bPlay').textContent = has ? 'つづきから' : 'はじめる';
  $('bNew').classList.toggle('hide', !has);
}
function play(fresh) {
  voice.unlock();
  if (fresh) { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} startWorld(true); }
  else if (!world) startWorld(false);
  if (!flags.metChief) setTimeout(() => toast('村長のゲンさんに話しかけてみよう!'), 1200);
  $('title').classList.add('hide'); $('hud').classList.remove('hide');
  if (isTouch) setupTouchOnce();
  state = 'play'; requestLock();
  saveGame();
}
let touchReady = false;
function setupTouchOnce() { $('touch').classList.remove('hide'); if (!touchReady) { touchReady = true; setupTouch(); } }
$('bPlay').addEventListener('click', () => play(false));
$('bNew').addEventListener('click', () => { if (confirm('今の島は消えて、あたらしい島が作られます。よろしいですか?')) play(true); });

// デバッグ用(ブラウザのコンソールから moincraft.player などで参照できる)
window.moincraft = { player, get world() { return world; }, get npcs() { return npcs; }, get state() { return state; } };

// ---- 起動 ----
requestAnimationFrame(frame);
setTimeout(() => {
  try {
    const save = load(SAVE_KEY);
    startWorld(false);
    $('loading').classList.add('hide');
    toTitle();
  } catch (e) {
    $('loading').innerHTML = '<p>うまく起動できませんでした</p><pre>' + (e.stack || e) + '</pre>';
  }
}, 30);
if (isTouch) { $('dialog').querySelector('.next').textContent = 'タップで つぎへ ▶'; }
