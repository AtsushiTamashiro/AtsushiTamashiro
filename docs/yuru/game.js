// ゆるっと!ご当地バトル — ゲーム本体
(function () {
  const { REGIONS, CHARAS, WORLD } = window.YURU_DATA;
  const A = window.YuruAudio;
  const app = document.getElementById('app');
  const INK = '#5B3A4A';

  const TYPES = {
    fire: { n: 'ほのお', i: '🔥', c: '#FFB3A6', d: '#E88676', s: ['grass', 'ice'] },
    water: { n: 'みず', i: '💧', c: '#A9DCFF', d: '#74B6E6', s: ['fire', 'earth'] },
    grass: { n: 'くさ', i: '🍃', c: '#B5EBAA', d: '#82C978', s: ['water', 'earth'] },
    elec: { n: 'でんき', i: '⚡', c: '#FFE58A', d: '#E4C14A', s: ['water', 'wind'] },
    ice: { n: 'こおり', i: '❄️', c: '#C4F0F5', d: '#88CDD6', s: ['grass', 'wind'] },
    earth: { n: 'だいち', i: '🪨', c: '#F0D2A8', d: '#CFA772', s: ['fire', 'elec'] },
    wind: { n: 'かぜ', i: '🌀', c: '#DCD0FF', d: '#AE9CEB', s: ['ice', 'elec'] },
  };
  const EFF = {
    heal: { n: 'かいふく', i: '💖', c: '#FFD1E3', d: '#F0A2C0', note: 'HPを40%かいふく' },
    'atk+': { n: 'つよくなる', i: '✨', c: '#FFF0B8', d: '#E4CF73', note: 'じぶんのこうげき↑' },
    'def+': { n: 'まもる', i: '🛡️', c: '#E2F5D8', d: '#AFD69E', note: 'じぶんのぼうぎょ↑' },
    'atk-': { n: 'よわらせる', i: '💫', c: '#E6E0FF', d: '#B5A9E6', note: 'あいてのこうげき↓' },
    'def-': { n: 'くずす', i: '💥', c: '#FFE0D0', d: '#E8B39C', note: 'あいてのぼうぎょ↓' },
  };
  const tmult = (mt, dt) => TYPES[mt].s.includes(dt) ? 2 : TYPES[dt].s.includes(mt) ? 0.5 : 1;

  // ---------------- save ----------------
  const KEY = 'yuru-battle-v1';
  let S = { partner: null, cards: [], world: [], wins: 0, muted: false, champ: false };
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
  A.muted = !!S.muted;
  const trainerLv = () => Math.min(70, 8 + S.cards.length + S.world.length * 2);
  const byId = id => id >= 100 ? WORLD[id - 100] : CHARAS[id];

  // ---------------- helpers ----------------
  const h = (s) => { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function mix(hex, w, t) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(w.slice(1), 16);
    const r = (x, y) => Math.round(x + (y - x) * t);
    return '#' + [r(a >> 16, b >> 16), r((a >> 8) & 255, (b >> 8) & 255), r(a & 255, b & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  const tyChip = t => `<span class="ty" style="--tc:${TYPES[t].c}">${TYPES[t].i}${TYPES[t].n}</span>`;
  document.addEventListener('pointerdown', () => A.init(), { capture: true });

  // ---------------- character art (art.js) ----------------
  const charaSVG = window.YuruArt.charaSVG;

  // ---------------- screens ----------------
  function show(el) { app.innerHTML = ''; app.appendChild(el); }
  function muteBtn() {
    const b = h(`<button class="icon-btn" aria-label="おと">${A.muted ? '🔇' : '🔊'}</button>`);
    b.onclick = () => { A.init(); A.setMuted(!A.muted); S.muted = A.muted; save(); b.textContent = A.muted ? '🔇' : '🔊'; };
    return b;
  }

  // ---- title ----
  function titleScreen() {
    A.play('home');
    const el = h(`<section class="screen" id="title">
      <div class="cloud" style="top:8%;width:90px;height:30px;animation-duration:38s;animation-delay:-8s"></div>
      <div class="cloud" style="top:22%;width:60px;height:20px;animation-duration:30s;animation-delay:-20s;opacity:.7"></div>
      <div class="cloud" style="top:52%;width:110px;height:34px;animation-duration:46s;animation-delay:-30s;opacity:.6"></div>
      <div class="logo-wrap">
        <span class="logo-small">47都道府県 ゆるキャラ大集合!</span>
        <h1 class="logo"><span class="l1">ゆるっと!</span><br><span class="l2">ご当地</span>バトル</h1>
      </div>
      <div class="title-charas"></div>
      <div class="title-menu">
        <button class="btn" id="go">${S.partner == null ? 'はじめる' : 'つづきから'}</button>
        <button class="btn sub" id="book">カードちょう</button>
      </div>
      <p class="title-note">🔊 タップすると おんがくが ながれます</p>
    </section>`);
    const tc = el.querySelector('.title-charas');
    const picks = [[29, 0, 22, 1], [46, 16, 27, 2], [17, 34, 33, 3], [26, 60, 27, 2], [1, 79, 22, 1]];
    picks.forEach(([id, l, w, z], i) => {
      const d = h(`<div class="tc bounce" style="left:${l}%;width:${w}%;animation-delay:${i * -0.3}s;z-index:${z}">${charaSVG(CHARAS[id])}</div>`);
      tc.appendChild(d);
    });
    el.querySelector('#go').onclick = () => { A.init(); A.sfx('tap'); S.partner == null ? selectScreen() : homeScreen(); };
    el.querySelector('#book').onclick = () => { A.init(); A.sfx('tap'); bookScreen(titleScreen); };
    show(el);
  }

  // ---- region grid (shared) ----
  function regionGrid(container, onPick, opts = {}) {
    let region = opts.region ?? (S.partner != null ? CHARAS[S.partner].region : 0);
    const tabs = h(`<div class="tabs" role="tablist"></div>`);
    const grid = h(`<div class="grid"></div>`);
    function draw() {
      tabs.innerHTML = '';
      REGIONS.forEach((r, i) => {
        const owned = CHARAS.filter(c => c.region === i && S.cards.includes(c.id)).length;
        const all = CHARAS.filter(c => c.region === i).length;
        const t = h(`<button class="tab${i === region ? ' on' : ''}" role="tab">${r}${opts.showOwned ? ` ${owned}/${all}` : ''}</button>`);
        t.onclick = () => { A.sfx('tap'); region = i; draw(); };
        tabs.appendChild(t);
      });
      grid.innerHTML = '';
      CHARAS.filter(c => c.region === region).forEach(c => {
        const owned = S.cards.includes(c.id);
        const t = h(`<button class="tile${opts.selected === c.id ? ' sel' : ''}">
          <span class="tbg" style="background:${c.col === '#FFFFFF' || c.col.startsWith('#FFF') ? TYPES[c.type].c : c.col}"></span>
          ${charaSVG(c, { noShadow: true })}
          <div class="tn">${c.pref}</div><div class="tc-name">${c.name}</div>
          ${opts.showOwned && owned ? '<span class="stamp">🃏</span>' : ''}
        </button>`);
        t.onclick = () => { A.sfx('tap'); onPick(c); };
        grid.appendChild(t);
      });
    }
    draw();
    container.append(tabs, grid);
  }

  function statRows(c, lv) {
    const st = c.stats;
    const rows = [['HP', st.hp], ['こうげき', st.atk], ['ぼうぎょ', st.def], ['すばやさ', st.spd]];
    return `<div class="stats">${rows.map(([k, v]) => `<span>${k}</span><span class="meter"><i style="width:${Math.min(100, v / 1.2)}%"></i></span><span>${v}</span>`).join('')}</div>`;
  }
  function moveInfo(m) {
    if (m.eff) { const e = EFF[m.eff]; return `<div class="mv-info" style="background:${e.c}"><b>${m.name}</b><small>${e.i} ${e.note}</small></div>`; }
    const t = TYPES[m.type]; return `<div class="mv-info" style="background:${t.c}"><b>${m.name}</b><small>${t.i}${t.n}・いりょく ${m.pow}</small></div>`;
  }
  function detailSheet(c, actions) {
    const v = h(`<div class="veil"><div class="sheet" role="dialog" aria-label="${esc(c.name)}">
      <div class="sheet-head">
        <div class="sheet-art" style="background:${mix(c.col, '#FFFFFF', .2)}">${charaSVG(c)}</div>
        <div><div class="pref">${c.pref}${c.world ? '' : 'のゆるキャラ'}</div><h3>${c.name}</h3>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${tyChip(c.type)}<span class="ty" style="--tc:#FFF">めいぶつ:${c.item}</span></div></div>
      </div>
      ${statRows(c)}
      <div class="moves-list">${c.moves.map(moveInfo).join('')}</div>
      <div class="sheet-actions"></div>
    </div></div>`);
    const acts = v.querySelector('.sheet-actions');
    actions.forEach(([label, cls, fn]) => {
      const b = h(`<button class="btn ${cls}">${label}</button>`);
      b.onclick = () => { v.remove(); fn && fn(); };
      acts.appendChild(b);
    });
    v.onclick = e => { if (e.target === v) { A.sfx('back'); v.remove(); } };
    app.querySelector('.screen').appendChild(v);
  }

  // ---- select partner ----
  function selectScreen() {
    A.play('home');
    const el = h(`<section class="screen"><div class="bar"><button class="icon-btn" id="back" aria-label="もどる">←</button><h2>パートナーをえらぼう</h2></div><div class="scroll">
      <p style="margin:0 0 10px;font-size:13px;color:var(--ink-2)">いっしょに たたかう ゆるキャラを えらんでね。あとから かえられるよ。</p>
    </div></section>`);
    el.querySelector('.bar').appendChild(muteBtn());
    el.querySelector('#back').onclick = () => { A.sfx('back'); S.partner == null ? titleScreen() : homeScreen(); };
    regionGrid(el.querySelector('.scroll'), c => detailSheet(c, [
      ['とじる', 'sub', () => A.sfx('back')],
      ['この子にきめた!', '', () => { A.sfx('card'); S.partner = c.id; save(); homeScreen(); }],
    ]), { selected: S.partner });
    show(el);
  }

  // ---- home ----
  function homeScreen() {
    A.play('home');
    const p = CHARAS[S.partner];
    const n = S.cards.length, all = n >= CHARAS.length;
    const el = h(`<section class="screen"><div class="bar"><h2>ゆるっと!ご当地バトル</h2><span class="pill">🃏 ${n}/47</span></div><div class="scroll">
      <div class="partner-card">
        <span class="pc-bg" style="background:${TYPES[p.type].c}"></span>
        <div class="pc-art bounce">${charaSVG(p)}</div>
        <div class="pc-info">
          <div style="font-size:12px;color:var(--ink-2)">パートナー・${p.pref}</div>
          <div class="pc-name">${p.name}</div>
          <div class="pc-meta">${tyChip(p.type)}<span class="pill" style="padding:2px 10px">Lv.${trainerLv()}</span></div>
          <button class="btn small sub" id="chg">パートナーをかえる</button>
        </div>
      </div>
      <div class="progress"><div class="row"><span>ご当地カード</span><span><span class="big">${n}</span> / 47まい</span></div>
        <div class="pbar"><i style="width:${n / 47 * 100}%"></i></div>
        <div style="font-size:11.5px;color:var(--ink-2);margin-top:6px">${all ? 'ぜんぶ あつめた!せかい大会へ いこう!' : 'たたかって かつと、その県の カードが もらえるよ。ぜんぶ あつめると…?'}</div></div>
      <div class="world-banner${all ? '' : ' locked'}"><span class="globe">🌏</span>
        <h4>${all ? 'せかい大会' : '🔒 せかい大会'}</h4>
        <p>${all ? `海外のゆるキャラ ${WORLD.length}人と たいけつ!(${S.world.length}/${WORLD.length} クリア)` : '47まい ぜんぶ あつめると 海外のゆるキャラが やってくる!'}</p>
        ${all ? `<button class="btn gold small" id="world">${S.world.length >= WORLD.length ? 'もういちど あそぶ' : 'ちょうせんする!'}</button>` : ''}</div>
      <div class="home-actions"><button class="btn" id="rand">おまかせバトル</button><button class="btn sub" id="book">カードちょう</button></div>
      <div class="section-title">🗾 たいせん あいてを えらぶ</div>
    </div></section>`);
    el.querySelector('.bar').appendChild(muteBtn());
    el.querySelector('#chg').onclick = () => { A.sfx('tap'); selectScreen(); };
    el.querySelector('#book').onclick = () => { A.sfx('tap'); bookScreen(homeScreen); };
    el.querySelector('#rand').onclick = () => {
      A.sfx('tap');
      const left = CHARAS.filter(c => !S.cards.includes(c.id));
      const pool = left.length ? left : CHARAS;
      startBattle(pool[Math.floor(Math.random() * pool.length)].id);
    };
    const w = el.querySelector('#world');
    if (w) w.onclick = () => { A.sfx('tap'); const next = WORLD.find(x => !S.world.includes(x.id)) || WORLD[0]; worldIntro(next); };
    regionGrid(el.querySelector('.scroll'), c => detailSheet(c, [
      ['とじる', 'sub', () => A.sfx('back')],
      ['バトル!', '', () => startBattle(c.id)],
    ]), { showOwned: true });
    show(el);
  }

  function worldIntro(c) {
    detailSheet(c, [['やめる', 'sub', () => A.sfx('back')], ['たいけつ!', 'gold', () => startBattle(c.id)]]);
  }

  // ---- card book ----
  function cardHTML(c, big) {
    const owned = c.world ? S.world.includes(c.id) : S.cards.includes(c.id);
    if (!owned) return `<div class="card locked${big ? ' big' : ''}" style="--cc:#E3D3DA;--ca:#E3D3DA"><div class="ctop"><span class="cno">${c.world ? 'W' : 'No.'}${String(c.no).padStart(2, '0')}</span></div><div class="cart"><span>?</span></div><div class="cname">???</div><div class="citem" style="color:var(--ink-2)">${c.pref}</div></div>`;
    return `<div class="card${big ? ' big' : ''}${c.world ? ' world' : ''}" style="--cc:${TYPES[c.type].c};--ca:${c.acc}">
      <div class="ctop"><span class="cno">${c.world ? 'W' : 'No.'}${String(c.no).padStart(2, '0')}</span>${big ? `<span class="cpref">${c.pref}</span>` : ''}<span>${TYPES[c.type].i}</span></div>
      <div class="cart">${charaSVG(c, { noShadow: true })}</div>
      <div class="cname">${c.name}</div>
      <div class="citem">${big ? `めいぶつ・${c.item}` : c.pref}</div>
      ${big ? `<p class="ctxt">${c.text}</p>` : ''}
      <div class="shine"></div></div>`;
  }
  function bookScreen(back) {
    A.play('home');
    let tab = 'jp';
    const el = h(`<section class="screen"><div class="bar"><button class="icon-btn" id="back" aria-label="もどる">←</button><h2>カードちょう</h2><span class="pill">🃏 ${S.cards.length}/47</span></div><div class="scroll"><div class="tabs"></div><div class="card-grid"></div></div></section>`);
    el.querySelector('#back').onclick = () => { A.sfx('back'); back(); };
    const tabs = el.querySelector('.tabs'), grid = el.querySelector('.card-grid');
    function draw() {
      tabs.innerHTML = '';
      [['jp', `にっぽん ${S.cards.length}/47`], ['w', `せかい ${S.world.length}/${WORLD.length}`]].forEach(([k, l]) => {
        const b = h(`<button class="tab${tab === k ? ' on' : ''}">${l}</button>`);
        b.onclick = () => { A.sfx('tap'); tab = k; draw(); };
        tabs.appendChild(b);
      });
      grid.innerHTML = '';
      (tab === 'jp' ? CHARAS : WORLD).forEach(c => {
        const d = h(cardHTML(c));
        d.onclick = () => {
          A.sfx('tap');
          const owned = c.world ? S.world.includes(c.id) : S.cards.includes(c.id);
          if (!owned) return;
          const v = h(`<div class="veil center"><div class="reward">${cardHTML(c, true)}<button class="btn sub">とじる</button></div></div>`);
          v.onclick = () => { A.sfx('back'); v.remove(); };
          el.appendChild(v);
        };
        grid.appendChild(d);
      });
    }
    draw();
    show(el);
  }

  // ---------------- battle ----------------
  function makeFighter(c, lv, boost = 1) {
    const st = c.stats;
    const calc = b => Math.floor(b * 2 * lv / 100 * boost) + 5;
    const hp = Math.floor(st.hp * 2 * lv / 100 * boost) + lv + 10;
    return { c, name: c.name, lv, maxhp: hp, hp, atk: calc(st.atk), def: calc(st.def), spd: calc(st.spd), st: { atk: 0, def: 0 }, moves: c.moves.map(m => Object.assign({}, m, { pp: m.maxpp })) };
  }
  const stageMul = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);

  let B = null;
  function startBattle(foeId) {
    const foeC = byId(foeId), isWorld = !!foeC.world;
    const lv = trainerLv();
    B = {
      p: makeFighter(CHARAS[S.partner], lv),
      f: makeFighter(foeC, isWorld ? lv + 2 : Math.max(5, lv - 1), isWorld ? 1.06 : 1),
      busy: true, world: isWorld, foeId,
    };
    A.play(isWorld ? 'boss' : 'battle');
    const sky = isWorld ? ['#C9B8FF', '#FFD6EC', '#FFE7A8', '#FFD27A'] : {
      fire: ['#FFD9C4', '#FFF0DC', '#FFE0A8', '#F7C98A'], water: ['#BEE6FF', '#E4F6FF', '#A9E3F0', '#86CFE3'],
      grass: ['#C8EEFF', '#FFF3E0', '#C9F0C0', '#A8E3A0'], elec: ['#FFF3B0', '#FFFBE4', '#E6F2B8', '#CDE89A'],
      ice: ['#DDF3FF', '#F5FCFF', '#E8F7FA', '#CBEAF2'], earth: ['#FFE6C8', '#FFF6EA', '#EED9B4', '#DEC398'],
      wind: ['#E0D8FF', '#F6F1FF', '#D5F0D2', '#BBE3B5'],
    }[foeC.type];
    const el = h(`<section class="screen" id="battle">
      <div class="arena" style="--sky1:${sky[0]};--sky2:${sky[1]};--grass1:${sky[2]};--grass2:${sky[3]}">
        <div class="hill" style="width:70%;height:30%;left:-15%;top:44%"></div><div class="hill" style="width:60%;height:26%;right:-10%;top:47%"></div>
        <div class="cloud" style="top:6%;width:70px;height:22px;animation-duration:40s;animation-delay:-12s"></div>
        <div class="cloud" style="top:28%;width:50px;height:16px;animation-duration:32s;animation-delay:-25s;opacity:.7"></div>
        <div class="floor fl-foe"></div><div class="floor fl-ply"></div>
        <div class="fighter enter-r" id="foeSpr"><div class="bounce">${charaSVG(B.f.c, { noShadow: true })}</div></div>
        <div class="fighter enter-l" id="plySpr"><div class="bounce" style="animation-delay:-.6s"><div class="flip">${charaSVG(B.p.c, { noShadow: true })}</div></div></div>
        <div class="hud" id="foeHud"></div>
        <div class="hud" id="plyHud"></div>
        <div class="flash"></div>
      </div>
      <div class="panel">
        <div class="msg" id="msg" aria-live="polite"></div>
        <div class="moves" id="moves"></div>
        <div class="panel-foot"><span>${isWorld ? '🌏 せかい大会' : `🗾 ${foeC.pref}の ゆるキャラ`}</span><button id="run">にげる 🏃</button></div>
      </div>
    </section>`);
    show(el);
    B.el = el;
    el.querySelector('#run').onclick = async () => {
      if (B.busy) return; B.busy = true; drawMoves(); A.sfx('back');
      await say('うまく にげきれた!');
      homeScreen();
    };
    el.querySelector('#msg').onclick = () => { if (msgSkip) msgSkip(); };
    drawHud(); drawMoves();
    (async () => {
      await sleep(500);
      await say(isWorld ? `${foeC.pref}から ${B.f.name}が やってきた!` : `${foeC.pref}の ${B.f.name}が しょうぶを いどんできた!`);
      await say(`いけっ! ${B.p.name}!`);
      B.busy = false; drawMoves();
      setMsg(`${B.p.name}は どうする?`);
    })();
  }

  function hudHTML(f, me) {
    const r = f.hp / f.maxhp, cls = r <= .2 ? 'low' : r <= .5 ? 'mid' : '';
    const st = [];
    for (const k of ['atk', 'def']) {
      const v = f.st[k]; if (!v) continue;
      st.push(`<em class="${v < 0 ? 'dn' : ''}">${k === 'atk' ? 'こうげき' : 'ぼうぎょ'}${v > 0 ? '↑' : '↓'}${Math.abs(v) > 1 ? '×' + Math.abs(v) : ''}</em>`);
    }
    return `<div class="hn"><b>${f.name}</b><span class="lv">Lv.${f.lv}</span></div>
      <div class="hp"><span>HP</span><div class="track"><i class="${cls}" style="width:${r * 100}%"></i></div></div>
      ${me ? `<div class="hpnum">${f.hp} / ${f.maxhp}</div>` : ''}
      <div class="stages">${tyChip(f.c.type).replace('class="ty"', 'class="ty" style="font-size:10px;padding:0 7px 0 4px"')}${st.join('')}</div>`;
  }
  function drawHud() {
    const fh = B.el.querySelector('#foeHud'), ph = B.el.querySelector('#plyHud');
    // HPバーをアニメさせるため、幅だけ差し替え
    for (const [box, f, me] of [[fh, B.f, false], [ph, B.p, true]]) {
      const bar = box.querySelector('.track i');
      if (!bar) { box.innerHTML = hudHTML(f, me); continue; }
      const r = f.hp / f.maxhp;
      bar.style.width = r * 100 + '%'; bar.className = r <= .2 ? 'low' : r <= .5 ? 'mid' : '';
      const num = box.querySelector('.hpnum'); if (num) num.textContent = `${f.hp} / ${f.maxhp}`;
      const tmp = h(`<div>${hudHTML(f, me)}</div>`);
      box.querySelector('.stages').replaceWith(tmp.querySelector('.stages'));
    }
  }
  function drawMoves() {
    const box = B.el.querySelector('#moves');
    box.innerHTML = '';
    B.p.moves.forEach((m, i) => {
      let tc, td, sub, tag = '';
      if (m.eff) { const e = EFF[m.eff]; tc = e.c; td = e.d; sub = `${e.i} ${e.n}`; }
      else {
        const t = TYPES[m.type]; tc = t.c; td = t.d; sub = `${t.i}${t.n}・${m.pow}`;
        const mul = tmult(m.type, B.f.c.type);
        if (mul > 1) tag = '<span class="eff">ばつぐん!</span>'; else if (mul < 1) tag = '<span class="eff" style="background:#9C8B93">いまひとつ</span>';
      }
      const b = h(`<button class="mv" style="--tc:${tc};--tcd:${td}"${B.busy || m.pp <= 0 ? ' disabled' : ''}>${tag}<b>${m.name}</b><small><span>${sub}</span><span>${m.pp}/${m.maxpp}</span></small></button>`);
      b.onclick = () => turn(i);
      box.appendChild(b);
    });
  }

  let msgSkip = null;
  function setMsg(t) { const m = B.el.querySelector('#msg'); m.textContent = t; }
  function say(text, hold = 650) {
    return new Promise(res => {
      const m = B.el.querySelector('#msg');
      let i = 0, done = false, timer;
      const finish = () => {
        if (done) return; done = true; clearInterval(timer); m.textContent = text;
        m.insertAdjacentHTML('beforeend', '<span class="caret">▼</span>');
        let wait = setTimeout(end, hold);
        msgSkip = () => { clearTimeout(wait); end(); };
      };
      const end = () => { msgSkip = null; res(); };
      msgSkip = finish;
      m.textContent = '';
      timer = setInterval(() => { i++; m.textContent = text.slice(0, i); if (i >= text.length) finish(); }, 28);
    });
  }

  function spr(f) { return B.el.querySelector(f === B.p ? '#plySpr' : '#foeSpr'); }
  function anim(el, cls, ms) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); return sleep(ms).then(() => el.classList.remove(cls)); }
  function burst(target, emoji, n = 9) {
    const ar = B.el.querySelector('.arena').getBoundingClientRect(), r = target.getBoundingClientRect();
    const x = r.left - ar.left + r.width / 2, y = r.top - ar.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
      const p = h(`<span class="pt" style="left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--r:${(Math.random() - .5) * 120}deg;animation-delay:${i * 25}ms">${emoji}</span>`);
      B.el.querySelector('.arena').appendChild(p); setTimeout(() => p.remove(), 1100);
    }
  }
  function popNum(target, txt, heal) {
    const ar = B.el.querySelector('.arena').getBoundingClientRect(), r = target.getBoundingClientRect();
    const p = h(`<span class="dmg${heal ? ' heal' : ''}" style="left:${r.left - ar.left + r.width / 2}px;top:${r.top - ar.top + r.height * .25}px">${txt}</span>`);
    B.el.querySelector('.arena').appendChild(p); setTimeout(() => p.remove(), 1100);
  }

  function aiPick() {
    const f = B.f, p = B.p;
    const usable = f.moves.map((m, i) => [m, i]).filter(([m]) => m.pp > 0);
    if (!usable.length) return -1;
    const heal = usable.find(([m]) => m.eff === 'heal');
    if (heal && f.hp / f.maxhp < 0.35 && Math.random() < 0.6) return heal[1];
    const status = usable.filter(([m]) => m.eff && m.eff !== 'heal');
    if (status.length && Math.random() < 0.18) {
      const [m, i] = status[Math.floor(Math.random() * status.length)];
      const tgt = m.eff.endsWith('+') ? f : p, k = m.eff.slice(0, 3);
      if (Math.abs(tgt.st[k]) < 2) return i;
    }
    const atks = usable.filter(([m]) => m.pow);
    if (!atks.length) return usable[0][1];
    if (Math.random() < 0.3) return atks[Math.floor(Math.random() * atks.length)][1];
    atks.sort((a, b) => b[0].pow * tmult(b[0].type, p.c.type) * (b[0].type === f.c.type ? 1.25 : 1) - a[0].pow * tmult(a[0].type, p.c.type) * (a[0].type === f.c.type ? 1.25 : 1));
    return atks[0][1];
  }

  async function turn(i) {
    if (!B || B.busy) return;
    const pm = B.p.moves[i]; if (pm.pp <= 0) return;
    B.busy = true; drawMoves();
    const fi = aiPick();
    const order = [[B.p, B.f, pm]];
    const fm = fi >= 0 ? B.f.moves[fi] : { name: 'わるあがき', type: B.f.c.type, pow: 40, acc: 100, pp: 99 };
    const foeFirst = B.f.spd > B.p.spd || (B.f.spd === B.p.spd && Math.random() < .5);
    if (foeFirst) order.unshift([B.f, B.p, fm]); else order.push([B.f, B.p, fm]);
    for (const [a, t, m] of order) {
      if (a.hp <= 0 || t.hp <= 0) continue;
      await doMove(a, t, m);
      if (t.hp <= 0) break;
    }
    if (B.f.hp <= 0) return win();
    if (B.p.hp <= 0) return lose();
    if (B.p.moves.every(m => m.pp <= 0)) B.p.moves.forEach(m => m.pp = m.maxpp);
    B.busy = false; drawMoves();
    setMsg(`${B.p.name}は どうする?`);
  }

  async function doMove(a, t, m) {
    m.pp--;
    const me = a === B.p;
    const as = spr(a), ts = spr(t);
    await say(`${a.name}の ${m.name}!`, 250);
    if (m.eff) {
      if (m.eff === 'heal') {
        A.sfx('heal'); burst(as, '💖', 8); anim(as, 'glow-heal', 800);
        const amt = Math.min(a.maxhp - a.hp, Math.ceil(a.maxhp * .4));
        a.hp += amt; drawHud(); if (amt) popNum(as, '+' + amt, true);
        await say(amt ? `${a.name}の HPが ${amt} かいふくした!` : `${a.name}の HPは まんたんだ!`);
        return;
      }
      const up = m.eff.endsWith('+'), k = m.eff.slice(0, 3), tgt = up ? a : t, tsp = up ? as : ts;
      const label = k === 'atk' ? 'こうげき' : 'ぼうぎょ';
      if (Math.abs(tgt.st[k]) >= 3 && Math.sign(tgt.st[k]) === (up ? 1 : -1)) { A.sfx('miss'); await say(`${tgt.name}の ${label}は もう ${up ? 'あがらない' : 'さがらない'}!`); return; }
      tgt.st[k] += up ? 1 : -1;
      A.sfx(up ? 'up' : 'down'); burst(tsp, EFF[m.eff].i, 7); anim(tsp, up ? 'glow-up' : 'hurt', 600);
      drawHud();
      await say(`${tgt.name}の ${label}が ${up ? 'あがった!' : 'さがった!'}`);
      return;
    }
    A.sfx('whoosh');
    await anim(as, me ? 'lunge-r' : 'lunge-l', 330);
    if (Math.random() * 100 >= m.acc) { A.sfx('miss'); await say(`しかし ${t.name}には あたらなかった!`); return; }
    const mul = tmult(m.type, t.c.type), stab = m.type === a.c.type ? 1.25 : 1, crit = Math.random() < 1 / 16 ? 1.5 : 1;
    const atk = a.atk * stageMul(a.st.atk), def = t.def * stageMul(t.st.def);
    const base = ((2 * a.lv / 5 + 2) * m.pow * atk / def) / 50 + 2;
    const dmg = Math.max(1, Math.floor(base * stab * mul * crit * (0.85 + Math.random() * 0.15)));
    burst(ts, TYPES[m.type].i, mul > 1 ? 13 : 9);
    A.sfx(crit > 1 || mul > 1 ? 'crit' : 'hit');
    if (mul > 1 || crit > 1) { const fl = B.el.querySelector('.flash'); fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); }
    anim(ts, 'hurt', 500);
    popNum(ts, dmg, false);
    t.hp = Math.max(0, t.hp - dmg); drawHud();
    await sleep(450);
    if (crit > 1) await say('きゅうしょに あたった!', 400);
    if (mul > 1) await say('こうかは ばつぐんだ!', 450);
    else if (mul < 1) await say('こうかは いまひとつの ようだ…', 450);
  }

  async function win() {
    const fs = spr(B.f);
    A.sfx('faint'); fs.classList.add('faint');
    await say(`${B.f.name}は めをまわして たおれた!`);
    A.stop(); A.sfx('win');
    await say(`しょうぶに かった! ${B.p.name}は おおよろこび!`, 900);
    const c = B.f.c;
    const list = c.world ? S.world : S.cards;
    const isNew = !list.includes(c.id);
    if (isNew) list.push(c.id);
    S.wins++; save();
    const allWorld = c.world && S.world.length >= WORLD.length && isNew;
    const completeJp = !c.world && isNew && S.cards.length === CHARAS.length;
    showReward(c, isNew, () => {
      if (allWorld) return champion();
      if (completeJp) return unlockWorld();
      homeScreen();
    });
  }
  async function lose() {
    const ps = spr(B.p);
    A.sfx('faint'); ps.classList.add('faint');
    await say(`${B.p.name}は つかれて ねむってしまった…`);
    A.stop(); A.sfx('lose');
    await say('まけちゃった… でも つぎは きっと かてるよ!', 900);
    const foeId = B.foeId;
    const v = h(`<div class="veil center"><div class="reward"><h3>ざんねん…</h3>
      <div style="width:150px">${charaSVG(B.p.c)}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><button class="btn sub" id="home">もどる</button><button class="btn" id="again">もういちど!</button></div></div></div>`);
    v.querySelector('#home').onclick = () => { A.sfx('back'); homeScreen(); };
    v.querySelector('#again').onclick = () => { A.sfx('tap'); startBattle(foeId); };
    B.el.appendChild(v);
  }

  function confetti(root, n = 60) {
    const cols = ['#FF7BA9', '#FFE58A', '#8FDCC4', '#A9DCFF', '#CDBBFF', '#FFFFFF'];
    for (let i = 0; i < n; i++) {
      const d = h(`<span class="confetti" style="left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-duration:${2 + Math.random() * 2.5}s;animation-delay:${Math.random() * .8}s"></span>`);
      root.appendChild(d); setTimeout(() => d.remove(), 5500);
    }
  }
  function showReward(c, isNew, next) {
    const v = h(`<div class="veil center"><div class="reward">
      <h3>${isNew ? 'カードを ゲット!' : 'また かったね!'}</h3>
      ${isNew ? '<span class="new">NEW!</span>' : '<span class="new" style="background:#fff">もう もっている カード</span>'}
      <div class="flip-in">${cardHTML(c, true)}</div>
      <button class="btn" id="next">つぎへ</button></div></div>`);
    setTimeout(() => A.sfx('card'), 500);
    if (isNew) confetti(v);
    v.querySelector('#next').onclick = () => { A.sfx('tap'); next(); };
    B.el.appendChild(v);
  }
  function unlockWorld() {
    homeScreen();
    A.sfx('champ');
    const v = h(`<div class="veil center"><div class="reward">
      <h3>47まい コンプリート!</h3>
      <div style="font-size:72px">🌏</div>
      <p style="margin:0;font-size:15px;line-height:1.7;text-shadow:0 2px 0 rgba(0,0,0,.25)">にっぽんじゅうの ゆるキャラと なかよくなった!<br>海の むこうから ちょうせんじょうが とどいたよ。<br>「せかい大会」に ちょうせんしよう!</p>
      <button class="btn gold" id="ok">いってみる!</button></div></div>`);
    confetti(v, 80);
    v.querySelector('#ok').onclick = () => { A.sfx('tap'); v.remove(); };
    app.querySelector('.screen').appendChild(v);
  }
  function champion() {
    S.champ = true; save();
    homeScreen();
    A.sfx('champ');
    const p = CHARAS[S.partner];
    const v = h(`<div class="veil center"><div class="reward">
      <h3>せかいチャンピオン!</h3>
      <div class="bounce" style="width:170px">${charaSVG(p)}</div>
      <p style="margin:0;font-size:15px;line-height:1.7;text-shadow:0 2px 0 rgba(0,0,0,.25)">${p.name}と いっしょに<br>せかいいちの ゆるキャラマスターに なった!<br>ぜんぶの カードを あつめてくれて ありがとう!</p>
      <button class="btn gold" id="ok">やったね!</button></div></div>`);
    confetti(v, 120);
    v.querySelector('#ok').onclick = () => { A.sfx('tap'); v.remove(); };
    app.querySelector('.screen').appendChild(v);
  }

  // デバッグ/テスト用
  window.__yuru = { S, CHARAS, WORLD, startBattle, homeScreen, save, get B() { return B; } };
  titleScreen();
})();
