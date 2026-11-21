// ようかい ぽんぽこバトル — ゲーム本体
(function () {
  const { AREAS, YOKAI, STARTERS, SECRET } = window.YOKAI_DATA;
  const { yokaiSVG, mix } = window.YokaiArt;
  const A = window.YokaiAudio;
  const app = document.getElementById('app');

  const TYPES = {
    fire: { n: 'ほのお', i: '🔥', c: '#FFB9A8', d: '#E88676', s: ['wind', 'dark'] },
    water: { n: 'みず', i: '💧', c: '#AEDDFF', d: '#74B6E6', s: ['fire', 'earth'] },
    wind: { n: 'かぜ', i: '🍃', c: '#C6EEB4', d: '#8CC97A', s: ['water', 'earth'] },
    earth: { n: 'つち', i: '🪨', c: '#F0D4AC', d: '#CFA772', s: ['fire'] },
    light: { n: 'ひかり', i: '✨', c: '#FFF0A0', d: '#E4CC52', s: ['dark'] },
    dark: { n: 'やみ', i: '🌙', c: '#D9CCF7', d: '#A796DE', s: ['light'] },
  };
  const EFF = {
    heal: { n: 'かいふく', i: '💖', c: '#FFD1E3', d: '#F0A2C0', note: 'HPを40%かいふく' },
    'atk+': { n: 'つよくなる', i: '💪', c: '#FFF0B8', d: '#E4CF73', note: 'じぶんのこうげき↑' },
    'def+': { n: 'まもる', i: '🛡️', c: '#E2F5D8', d: '#AFD69E', note: 'じぶんのぼうぎょ↑' },
    'atk-': { n: 'よわらせる', i: '💫', c: '#E6E0FF', d: '#B5A9E6', note: 'あいてのこうげき↓' },
    'def-': { n: 'くずす', i: '💥', c: '#FFE0D0', d: '#E8B39C', note: 'あいてのぼうぎょ↓' },
  };
  const tmult = (mt, dt) => TYPES[mt].s.includes(dt) ? 2 : TYPES[dt].s.includes(mt) ? 0.5 : 1;
  const STARS = n => '★'.repeat(n);

  // ---------------- セーブ ----------------
  const KEY = 'yokai-ponpoko-v1';
  const fresh = () => ({ started: false, friends: {}, party: [], seen: [], area: 1, dango: 3, cleared: false, muted: false, wins: 0 });
  let S = fresh();
  try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) { }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
  A.muted = !!S.muted;
  const isFriend = id => !!S.friends[id];
  const isSeen = id => isFriend(id) || S.seen.includes(id);
  const markSeen = id => { if (!S.seen.includes(id)) { S.seen.push(id); save(); } };
  const needExp = lv => lv * 10 + 10;
  function addFriend(id, lv) {
    if (!S.friends[id]) S.friends[id] = { lv: Math.max(3, lv), exp: 0 };
    markSeen(id);
    if (S.party.length < 3 && !S.party.includes(id)) S.party.push(id);
    save();
  }

  // ---------------- 小道具 ----------------
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function show(el) { app.innerHTML = ''; app.appendChild(el); app.scrollTop = 0; }
  function muteBtn() {
    const b = h(`<button class="icon-btn" aria-label="おと">${A.muted ? '🔇' : '🔊'}</button>`);
    b.onclick = () => { A.init(); A.setMuted(!A.muted); S.muted = A.muted; save(); b.textContent = A.muted ? '🔇' : '🔊'; };
    return b;
  }
  const typeChip = t => `<span class="ty" style="--tc:${TYPES[t].c}">${TYPES[t].i} ${TYPES[t].n}</span>`;
  function closeVeil(v) { v.remove(); }
  function veil(inner, center) {
    const v = h(`<div class="veil${center ? ' center' : ''}"></div>`);
    v.appendChild(inner);
    v.addEventListener('click', e => { if (e.target === v && !center) { A.sfx('back'); closeVeil(v); } });
    app.querySelector('.screen').appendChild(v);
    return v;
  }
  function confetti(root, n = 50) {
    const cols = ['#FF8FB1', '#FFD34E', '#8FDCC4', '#A9DCFF', '#CDBBFF', '#FFB66B'];
    for (let i = 0; i < n; i++) {
      const c = h(`<i class="confetti" style="left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-duration:${1.8 + Math.random() * 1.6}s;animation-delay:${Math.random() * .6}s"></i>`);
      root.appendChild(c); setTimeout(() => c.remove(), 4200);
    }
  }

  // ---------------- タイトル ----------------
  function titleScreen() {
    A.play('home');
    const picks = [24, 6, 2, 1, 12];
    const pos = [[2, 30, 34], [68, 30, 30], [35, 31, 46], [-3, 24, 0], [79, 24, 0]]; // [left%, width%, bottom px]
    const el = h(`<section class="screen" id="title">
      <div class="moon"></div>
      ${Array.from({ length: 22 }, (_, i) => `<i class="star" style="left:${(i * 37) % 100}%;top:${(i * 23) % 55}%;animation-delay:${(i % 7) * .4}s"></i>`).join('')}
      <div class="logo-wrap">
        <div class="logo-small">あつめて まなべる ようかいずかん</div>
        <h1 class="logo"><span class="l1">ようかい</span><br><span class="l2">ぽんぽこ</span>バトル</h1>
      </div>
      <div class="title-charas">
        ${picks.map((id, i) => `<div class="tc bounce" style="left:${pos[i][0]}%;bottom:${pos[i][2]}px;width:${pos[i][1]}%;z-index:${i < 3 ? 2 : 1};animation-delay:${-i * .37}s">${yokaiSVG(YOKAI[id])}</div>`).join('')}
      </div>
      <div class="title-menu">
        ${S.started ? `<button class="btn" id="go">▶ つづきから</button>` : `<button class="btn" id="go">▶ はじめる</button>`}
        <button class="btn sub" id="book">📖 ようかいずかん</button>
        <button class="btn sub small" id="help">❓ あそびかた</button>
      </div>
      <p class="title-note">にほんに つたわる ようかいを もとにした オリジナルキャラクターです</p>
    </section>`);
    el.prepend(Object.assign(muteBtn(), { style: 'position:absolute;top:14px;right:14px;z-index:5' }));
    el.querySelector('#go').onclick = () => { A.init(); A.play('home'); A.sfx('tap'); S.started ? homeScreen() : starterScreen(); };
    el.querySelector('#book').onclick = () => { A.init(); A.play('home'); A.sfx('tap'); bookScreen(titleScreen); };
    el.querySelector('#help').onclick = () => { A.init(); A.sfx('tap'); helpSheet(); };
    show(el);
  }

  // ---------------- あそびかた ----------------
  function helpSheet() {
    const order = ['fire', 'wind', 'water'];
    const sh = h(`<div class="sheet">
      <h3>❓ あそびかた</h3>
      <ol class="howto">
        <li><b>さんぽ</b>すると やせいの ようかいが あらわれるよ。わざを えらんで たたかおう。</li>
        <li>かったら <b>ともだち</b>に さそえるよ。🍡おだんごを あげると なかまに なりやすい!</li>
        <li>エリアの <b>ぬし</b>を たおすと、つぎの エリアへ いけるよ。</li>
        <li>ともだちに なった ようかいは <b>ずかん</b>で くわしく しらべられるよ。ぜんぶ あつめよう!</li>
      </ol>
      <div class="section-title">🔄 タイプの あいしょう</div>
      <div class="chart">
        ${Object.keys(TYPES).map(t => `<div class="chart-row">${typeChip(t)}<span>は</span><span class="strong">${TYPES[t].s.map(typeChip).join('')}</span><span>に つよい</span></div>`).join('')}
      </div>
      <p class="hint">こうかは ばつぐん = 2ばいの ダメージ!</p>
      <div class="sheet-actions"><button class="btn sub" id="ok">とじる</button></div>
    </div>`);
    const v = veil(sh);
    sh.querySelector('#ok').onclick = () => { A.sfx('back'); closeVeil(v); };
  }

  // ---------------- さいしょの1ぴき ----------------
  function starterScreen() {
    const el = h(`<section class="screen" id="starter">
      <div class="bar"><h2>さいしょの ともだちを えらぼう</h2></div>
      <div class="scroll">
        <p class="lead">ようかいの くにへ ようこそ! いっしょに ぼうけんする ようかいを 1ぴき えらんでね。</p>
        <div class="starters">
          ${STARTERS.map(id => {
            const y = YOKAI[id];
            return `<button class="starter" data-id="${id}" style="--tc:${TYPES[y.type].c}">
              <div class="st-art bounce" style="animation-delay:${-id * .2}s">${yokaiSVG(y)}</div>
              <div class="st-info"><b>${y.name}</b>${typeChip(y.type)}<small>${y.text.slice(0, 32)}…</small></div>
            </button>`;
          }).join('')}
        </div>
      </div>
    </section>`);
    el.querySelectorAll('.starter').forEach(b => b.onclick = () => {
      A.sfx('tap');
      const y = YOKAI[+b.dataset.id];
      detailSheet(y, { full: true, lv: 5, actions: [['この子に きめた!', 'btn', () => {
        S = Object.assign(fresh(), { started: true, muted: S.muted });
        addFriend(y.id, 5);
        A.sfx('card'); homeScreen(true);
      }]] });
    });
    show(el);
  }

  // ---------------- 図鑑の詳細シート ----------------
  function statRows(y, lv) {
    const f = makeFighter(y, lv);
    const rows = [['HP', f.maxhp, y.stats.hp], ['こうげき', f.atk, y.stats.atk], ['ぼうぎょ', f.def, y.stats.def], ['すばやさ', f.spd, y.stats.spd]];
    return `<div class="stats">${rows.map(([n, v, b]) => `<span>${n}</span><div class="meter"><i style="width:${Math.min(100, b / 1.6)}%"></i></div><b>${v}</b>`).join('')}</div>`;
  }
  function moveInfo(m) {
    if (m.eff) return `<div class="mv-info" style="background:${EFF[m.eff].c}"><b>${EFF[m.eff].i} ${m.name}</b><small>${EFF[m.eff].note}</small></div>`;
    return `<div class="mv-info" style="background:${TYPES[m.type].c}"><b>${TYPES[m.type].i} ${m.name}</b><small>いりょく ${m.pow}</small></div>`;
  }
  function detailSheet(y, opts = {}) {
    const fr = S.friends[y.id], full = opts.full || !!fr, lv = opts.lv || (fr ? fr.lv : 5);
    const sh = h(`<div class="sheet">
      <div class="sheet-head">
        <div class="sheet-art" style="background:${TYPES[y.type].c}">${yokaiSVG(y)}</div>
        <div style="min-width:0">
          <div class="pref">No.${String(y.no).padStart(2, '0')} ・ ${AREAS[y.area].i} ${AREAS[y.area].n}</div>
          <h3>${y.name}</h3>
          <div class="kanji">${y.kanji}</div>
          <div class="pc-meta">${typeChip(y.type)}<span class="rare r${y.rare}">${STARS(y.rare)}</span>${fr ? `<span class="pill">Lv.${fr.lv}</span>` : ''}</div>
        </div>
      </div>
      ${full ? `
        <div class="facts"><div><small>すきなもの</small><b>${y.like}</b></div><div><small>おおきさ</small><b>${y.size}</b></div></div>
        <p class="lore">${y.text}</p>
        ${statRows(y, lv)}
        <div class="moves-list">${y.moves.map(moveInfo).join('')}</div>` : `
        <p class="lore locked-lore">🔒 ともだちに なると、くわしい ことが わかるよ。<br>${AREAS[y.area].n}に いるみたい。</p>`}
      <div class="sheet-actions"></div>
    </div>`);
    const act = sh.querySelector('.sheet-actions');
    const v = veil(sh);
    (opts.actions || []).forEach(([label, cls, fn]) => { const b = h(`<button class="${cls}">${label}</button>`); b.onclick = () => { closeVeil(v); fn(); }; act.appendChild(b); });
    const close = h(`<button class="btn sub">とじる</button>`); close.onclick = () => { A.sfx('back'); closeVeil(v); }; act.appendChild(close);
  }

  // ---------------- ホーム ----------------
  function homeScreen(welcome) {
    A.play('home');
    const found = YOKAI.filter(y => isSeen(y.id)).length, fr = Object.keys(S.friends).length;
    const el = h(`<section class="screen" id="home">
      <div class="bar"><h2>👻 ようかいの くに</h2><span class="pill" title="おだんご">🍡 ${S.dango}</span></div>
      <div class="scroll">
        <div class="party-row">
          ${[0, 1, 2].map(i => {
            const id = S.party[i];
            if (id == null) return `<button class="pslot empty" data-go="party"><span>+</span><small>あき</small></button>`;
            const y = YOKAI[id];
            return `<button class="pslot${i === 0 ? ' lead' : ''}" data-id="${id}" style="--tc:${TYPES[y.type].c}">
              ${i === 0 ? '<em>リーダー</em>' : ''}<div class="ps-art${i === 0 ? ' bounce' : ''}">${yokaiSVG(y, { noShadow: true })}</div>
              <b>${y.name}</b><small>Lv.${S.friends[id].lv}</small></button>`;
          }).join('')}
        </div>
        <div class="progress">
          <div class="row"><span>📖 ずかん</span><span><span class="big">${fr}</span> / ${YOKAI.length} ともだち ・ みつけた ${found}</span></div>
          <div class="pbar"><i style="width:${fr / YOKAI.length * 100}%"></i></div>
        </div>
        <div class="home-actions">
          <button class="btn mint" id="book">📖 ずかん</button>
          <button class="btn sub" id="party">👥 なかま</button>
        </div>
        <div class="section-title">🗺️ どこへ いく?</div>
        <div class="areas">
          ${AREAS.map((a, i) => {
            const open = i < S.area, ys = YOKAI.filter(y => y.area === i && y.rare < 4), got = ys.filter(y => isFriend(y.id)).length;
            const boss = YOKAI[a.boss], beat = isFriend(a.boss);
            if (!open) return `<div class="area locked"><div class="a-ico">🔒</div><div class="a-info"><b>？？？</b><small>${AREAS[i - 1].n}の ぬしを たおすと いけるよ</small></div></div>`;
            return `<div class="area" style="--s1:${a.sky[0]};--s2:${a.sky[1]};--s3:${a.sky[3]}">
              <div class="a-ico">${a.i}</div>
              <div class="a-info"><b>${a.n}</b><small>Lv.${a.lv}〜 ・ ともだち ${got}/${ys.length}</small><p>${a.text}</p></div>
              <div class="a-btns">
                <button class="btn small walk" data-area="${i}">👣 さんぽ</button>
                <button class="btn small boss${beat ? ' done' : ''}" data-boss="${i}">${beat ? '👑' : '⚔️'} ぬし</button>
              </div>
              <div class="a-boss">${isSeen(boss.id) ? yokaiSVG(boss, { noShadow: true }) : yokaiSVG(boss, { noShadow: true, sil: true })}</div>
            </div>`;
          }).join('')}
        </div>
        ${S.cleared ? `<div class="secret-note">✨ ようかいやしきに なにか ありがたい けはいが…</div>` : ''}
        <div class="home-foot">
          <button class="link" id="help">❓ あそびかた</button>
          <button class="link" id="title">🏠 タイトル</button>
        </div>
      </div>
    </section>`);
    el.querySelector('.bar').appendChild(muteBtn());
    el.querySelectorAll('.pslot[data-id]').forEach(b => b.onclick = () => { A.sfx('tap'); detailSheet(YOKAI[+b.dataset.id], { actions: [['👥 なかまを へんしゅう', 'btn', partyScreen]] }); });
    el.querySelectorAll('[data-go="party"]').forEach(b => b.onclick = () => { A.sfx('tap'); partyScreen(); });
    el.querySelectorAll('.walk').forEach(b => b.onclick = () => { A.sfx('tap'); startBattle(pickWild(+b.dataset.area), +b.dataset.area, false); });
    el.querySelectorAll('.boss').forEach(b => b.onclick = () => { A.sfx('tap'); bossIntro(+b.dataset.boss); });
    el.querySelector('#book').onclick = () => { A.sfx('tap'); bookScreen(homeScreen); };
    el.querySelector('#party').onclick = () => { A.sfx('tap'); partyScreen(); };
    el.querySelector('#help').onclick = () => { A.sfx('tap'); helpSheet(); };
    el.querySelector('#title').onclick = () => { A.sfx('back'); titleScreen(); };
    show(el);
    if (welcome) {
      const y = YOKAI[S.party[0]];
      const box = h(`<div class="reward"><div class="new">はじめての ともだち!</div><div class="big-art flip-in">${yokaiSVG(y)}</div>
        <h3>${y.name}</h3><p class="rw-text">まずは 🌳さとやまを さんぽ してみよう!</p><button class="btn gold" id="ok">しゅっぱつ!</button></div>`);
      const v = veil(box, true); confetti(v);
      box.querySelector('#ok').onclick = () => { A.sfx('tap'); closeVeil(v); };
    }
  }

  function pickWild(area) {
    let pool = YOKAI.filter(y => y.area === area && y.rare <= 2);
    if (area === 5) pool = pool.concat(YOKAI.filter(y => y.area < 5 && y.rare === 2));
    if (area === 5 && S.cleared && Math.random() < 0.15) return SECRET;
    const w = pool.map(y => y.rare === 1 ? 3 : 2), tot = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot;
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r < 0) return pool[i].id; }
    return pool[0].id;
  }

  function bossIntro(area) {
    const a = AREAS[area], y = YOKAI[a.boss], seen = isSeen(y.id), beat = isFriend(y.id);
    const sh = h(`<div class="sheet boss-sheet">
      <div class="boss-art">${yokaiSVG(y, { sil: !seen })}</div>
      <h3>${a.i} ${a.n}の ぬし</h3>
      <p class="lore">${seen ? `<b>${y.name}</b>が まちかまえている!` : 'なにか 大きな ようかいの けはいが する…'}<br>おすすめ レベル: <b>${a.lv + 5}</b></p>
      ${beat ? '<p class="hint">いちど たおした ぬしだよ。なんどでも ちょうせん できる!</p>' : '<p class="hint">たおすと ともだちに なって、つぎの エリアへ いけるよ。</p>'}
      <div class="sheet-actions"><button class="btn" id="go">⚔️ いどむ!</button><button class="btn sub" id="no">やめる</button></div>
    </div>`);
    const v = veil(sh);
    sh.querySelector('#go').onclick = () => { closeVeil(v); A.sfx('tap'); startBattle(y.id, area, true); };
    sh.querySelector('#no').onclick = () => { A.sfx('back'); closeVeil(v); };
  }

  // ---------------- なかま ----------------
  function partyScreen() {
    const el = h(`<section class="screen" id="partyScr">
      <div class="bar"><button class="icon-btn" id="back" aria-label="もどる">←</button><h2>👥 なかま</h2><span class="pill">${S.party.length}/3</span></div>
      <div class="scroll">
        <p class="lead">タップで パーティに 入れたり 外したり できるよ。いちばん 左が <b>リーダー</b>(さいしょに たたかう)。</p>
        <div class="party-row" id="pr"></div>
        <div class="section-title">🤝 ともだち いちらん</div>
        <div class="grid" id="fg"></div>
      </div>
    </section>`);
    function draw() {
      el.querySelector('.pill').textContent = `${S.party.length}/3`;
      el.querySelector('#pr').innerHTML = [0, 1, 2].map(i => {
        const id = S.party[i];
        if (id == null) return `<div class="pslot empty"><span>+</span><small>あき</small></div>`;
        const y = YOKAI[id];
        return `<button class="pslot${i === 0 ? ' lead' : ''}" data-id="${id}" style="--tc:${TYPES[y.type].c}">${i === 0 ? '<em>リーダー</em>' : ''}
          <div class="ps-art">${yokaiSVG(y, { noShadow: true })}</div><b>${y.name}</b><small>Lv.${S.friends[id].lv}</small></button>`;
      }).join('');
      const ids = Object.keys(S.friends).map(Number).sort((a, b) => a - b);
      el.querySelector('#fg').innerHTML = ids.map(id => {
        const y = YOKAI[id], inP = S.party.includes(id);
        return `<button class="tile${inP ? ' sel' : ''}" data-id="${id}"><div class="tbg" style="background:${TYPES[y.type].c}"></div>${yokaiSVG(y)}
          <div class="tc-name">${y.name}</div><div class="tn">Lv.${S.friends[id].lv}</div>${inP ? `<span class="stamp">${S.party.indexOf(id) + 1}</span>` : ''}</button>`;
      }).join('');
      el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
        const id = +b.dataset.id, y = YOKAI[id], inP = S.party.includes(id);
        A.sfx('tap');
        const acts = [];
        if (inP && S.party.indexOf(id) > 0) acts.push(['👑 リーダーにする', 'btn', () => { S.party = [id].concat(S.party.filter(x => x !== id)); save(); draw(); }]);
        if (inP && S.party.length > 1) acts.push(['はずす', 'btn sub', () => { S.party = S.party.filter(x => x !== id); save(); draw(); }]);
        if (!inP && S.party.length < 3) acts.push(['＋ パーティに いれる', 'btn mint', () => { S.party.push(id); save(); draw(); }]);
        if (!inP && S.party.length >= 3) acts.push(['リーダーと いれかえ', 'btn mint', () => { S.party[0] = id; save(); draw(); }]);
        detailSheet(y, { actions: acts });
      });
    }
    el.querySelector('#back').onclick = () => { A.sfx('back'); homeScreen(); };
    show(el); draw();
  }

  // ---------------- ずかん ----------------
  let bookTab = -1;
  function bookScreen(back) {
    const el = h(`<section class="screen" id="book">
      <div class="bar"><button class="icon-btn" id="back" aria-label="もどる">←</button><h2>📖 ようかいずかん</h2><span class="pill">${Object.keys(S.friends).length}/${YOKAI.length}</span></div>
      <div class="scroll">
        <div class="book-sum">
          <div><small>みつけた</small><b>${YOKAI.filter(y => isSeen(y.id)).length}</b></div>
          <div><small>ともだち</small><b>${Object.keys(S.friends).length}</b></div>
          <div><small>ぜんぶで</small><b>${YOKAI.length}</b></div>
        </div>
        <div class="tabs" role="tablist"></div>
        <div class="grid" id="bg"></div>
        <p class="empty-note">シルエットは「みつけた」ようかい。たたかって ともだちに なろう!</p>
      </div>
    </section>`);
    const tabs = el.querySelector('.tabs');
    function draw() {
      tabs.innerHTML = [`<button class="tab${bookTab === -1 ? ' on' : ''}" data-t="-1">ぜんぶ</button>`]
        .concat(AREAS.map((a, i) => `<button class="tab${bookTab === i ? ' on' : ''}" data-t="${i}">${a.i} ${a.n}</button>`)).join('');
      tabs.querySelectorAll('.tab').forEach(t => t.onclick = () => { A.sfx('tap'); bookTab = +t.dataset.t; draw(); });
      const list = YOKAI.filter(y => bookTab === -1 || y.area === bookTab);
      el.querySelector('#bg').innerHTML = list.map(y => {
        const fr = isFriend(y.id), seen = isSeen(y.id);
        const secretHidden = y.id === SECRET && !seen;
        return `<button class="tile${fr ? '' : ' unk'}" data-id="${y.id}" ${seen ? '' : 'aria-disabled="true"'}>
          ${fr ? `<div class="tbg" style="background:${TYPES[y.type].c}"></div>` : ''}
          <div class="tn">No.${String(y.no).padStart(2, '0')}</div>
          ${seen || !secretHidden ? yokaiSVG(y, { sil: !fr, noShadow: !fr }) : '<div class="q">？</div>'}
          <div class="tc-name">${seen ? y.name : '？？？'}</div>
          ${fr ? '<span class="stamp">🤝</span>' : ''}
        </button>`;
      }).join('');
      el.querySelectorAll('#bg .tile').forEach(b => b.onclick = () => {
        const y = YOKAI[+b.dataset.id];
        if (!isSeen(y.id)) { A.sfx('miss'); return; }
        A.sfx('tap'); detailSheet(y);
      });
    }
    el.querySelector('#back').onclick = () => { A.sfx('back'); back(); };
    show(el); draw();
  }

  // ---------------- バトル ----------------
  function makeFighter(y, lv, boost = 1) {
    const st = y.stats;
    const calc = b => Math.floor(b * 2 * lv / 100 * boost) + 5;
    const hp = Math.floor(st.hp * 2 * lv / 100 * boost) + lv + 12;
    return { y, id: y.id, name: y.name, lv, maxhp: hp, hp, atk: calc(st.atk), def: calc(st.def), spd: calc(st.spd), st: { atk: 0, def: 0 }, moves: y.moves.map(m => Object.assign({}, m, { pp: m.maxpp })) };
  }
  const stageMul = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);

  let B = null, msgSkip = null;
  function startBattle(foeId, area, boss) {
    const foeY = YOKAI[foeId], a = AREAS[area];
    markSeen(foeId);
    const lv = boss ? a.lv + 5 : foeId === SECRET ? 30 : a.lv + Math.floor(Math.random() * 4) - 1;
    const team = S.party.map(id => makeFighter(YOKAI[id], S.friends[id].lv));
    B = { team, pi: 0, f: makeFighter(foeY, Math.max(2, lv), boss ? 1.12 : 1), boss, area, busy: true, foeId };
    B.p = team[0];
    A.play(boss || foeId === SECRET ? 'boss' : 'battle');
    const sky = a.sky, night = area === 2 || area >= 4;
    const el = h(`<section class="screen" id="battle">
      <div class="arena${night ? ' night' : ''}" style="--sky1:${sky[0]};--sky2:${sky[1]};--grass1:${sky[2]};--grass2:${sky[3]}">
        ${night ? Array.from({ length: 14 }, (_, i) => `<i class="star" style="left:${(i * 41) % 100}%;top:${(i * 17) % 40}%;animation-delay:${(i % 5) * .5}s"></i>`).join('') : ''}
        <div class="hill" style="width:70%;height:30%;left:-15%;top:44%"></div><div class="hill" style="width:60%;height:26%;right:-10%;top:47%"></div>
        <div class="floor fl-foe"></div><div class="floor fl-ply"></div>
        <div class="fighter enter-r" id="foeSpr"><div class="bounce">${yokaiSVG(foeY, { noShadow: true })}</div></div>
        <div class="fighter enter-l" id="plySpr"></div>
        <div class="hud" id="foeHud"></div>
        <div class="hud" id="plyHud"></div>
        <div class="flash"></div>
      </div>
      <div class="panel">
        <div class="msg" id="msg" aria-live="polite"></div>
        <div class="moves" id="moves"></div>
        <div class="panel-foot"><span>${a.i} ${a.n}${boss ? ' ・ ぬし戦' : ''}</span>
          <span class="foot-btns"><button id="swap">🔄 いれかえ</button><button id="run">${boss ? 'こうさん' : 'にげる'} 🏃</button></span></div>
      </div>
    </section>`);
    show(el);
    B.el = el;
    drawPlayerSprite();
    el.querySelector('#run').onclick = async () => {
      if (B.busy) return; B.busy = true; drawMoves(); A.sfx('back');
      await say(boss ? 'いったん ひきかえそう…' : 'うまく にげきれた!');
      homeScreen();
    };
    el.querySelector('#swap').onclick = () => { if (B.busy) return; A.sfx('tap'); swapSheet(false); };
    el.querySelector('#msg').onclick = () => { if (msgSkip) msgSkip(); };
    drawHud(); drawMoves();
    (async () => {
      await sleep(500);
      if (foeId === SECRET) await say('あたりが まばゆい ひかりに つつまれた…!');
      await say(boss ? `${a.n}の ぬし ${B.f.name}が あらわれた!` : `やせいの ${B.f.name}が とびだしてきた!`);
      await say(`いけっ! ${B.p.name}!`);
      B.busy = false; drawMoves();
      setMsg(`${B.p.name}は どうする?`);
    })();
  }
  function drawPlayerSprite(enter = true) {
    const s = B.el.querySelector('#plySpr');
    s.className = 'fighter' + (enter ? ' enter-l' : '');
    s.innerHTML = `<div class="bounce" style="animation-delay:-.6s"><div class="flip">${yokaiSVG(B.p.y, { noShadow: true })}</div></div>`;
  }

  function hudHTML(f, me) {
    const r = f.hp / f.maxhp, cls = r <= .2 ? 'low' : r <= .5 ? 'mid' : '';
    const st = [];
    for (const k of ['atk', 'def']) {
      const v = f.st[k]; if (!v) continue;
      st.push(`<em class="${v < 0 ? 'dn' : ''}">${k === 'atk' ? 'こうげき' : 'ぼうぎょ'}${v > 0 ? '↑' : '↓'}${Math.abs(v) > 1 ? '×' + Math.abs(v) : ''}</em>`);
    }
    const balls = me ? `<span class="balls">${B.team.map(t => `<i class="${t.hp <= 0 ? 'out' : ''}"></i>`).join('')}</span>` : (B.boss ? '<span class="crown">👑 ぬし</span>' : '');
    return `<div class="hn"><b>${f.name}</b><span class="lv">${TYPES[f.y.type].i} Lv.${f.lv}</span></div>
      <div class="hp"><span>HP</span><div class="track"><i class="${cls}" style="width:${r * 100}%"></i></div></div>
      <div class="hpfoot">${balls}${me ? `<span class="hpnum">${f.hp} / ${f.maxhp}</span>` : ''}</div>
      <div class="stages">${st.join('')}</div>`;
  }
  function drawHud() {
    B.el.querySelector('#foeHud').innerHTML = hudHTML(B.f, false);
    B.el.querySelector('#plyHud').innerHTML = hudHTML(B.p, true);
  }
  function drawMoves() {
    const box = B.el.querySelector('#moves');
    box.innerHTML = B.p.moves.map((m, i) => {
      const t = m.eff ? EFF[m.eff] : TYPES[m.type];
      let tag = '';
      if (m.pow) { const mul = tmult(m.type, B.f.y.type); tag = mul > 1 ? '<span class="eff">ばつぐん!</span>' : mul < 1 ? '<span class="eff weak">いまひとつ</span>' : ''; }
      return `<button class="mv" data-i="${i}" style="--tc:${t.c};--tcd:${t.d}" ${B.busy || m.pp <= 0 ? 'disabled' : ''}>${tag}
        <b>${t.i} ${m.name}</b><small><span>${m.pow ? 'いりょく ' + m.pow : t.n}</span><span>${m.pp}/${m.maxpp}</span></small></button>`;
    }).join('');
    box.querySelectorAll('.mv').forEach(b => b.onclick = () => { A.sfx('tap'); turn(+b.dataset.i); });
    const sw = B.el.querySelector('#swap'), run = B.el.querySelector('#run');
    sw.disabled = B.busy || B.team.filter(t => t.hp > 0).length < 2; run.disabled = B.busy;
  }
  function setMsg(t) { const m = B.el.querySelector('#msg'); m.textContent = t; }
  function say(text, hold = 650) {
    return new Promise(res => {
      const m = B.el.querySelector('#msg');
      let i = 0, done = false, timer;
      const end = () => { msgSkip = null; res(); };
      const finish = () => {
        if (done) return; done = true; clearInterval(timer); m.textContent = text;
        m.insertAdjacentHTML('beforeend', '<span class="caret">▼</span>');
        const wait = setTimeout(end, hold);
        msgSkip = () => { clearTimeout(wait); end(); };
      };
      msgSkip = finish;
      m.textContent = '';
      timer = setInterval(() => { i++; m.textContent = text.slice(0, i); if (i >= text.length) finish(); }, 28);
    });
  }

  function spr(f) { return B.el.querySelector(f === B.f ? '#foeSpr' : '#plySpr'); }
  function anim(el, cls, ms) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); return sleep(ms).then(() => el.classList.remove(cls)); }
  function burst(target, emoji, n = 9) {
    const ar = B.el.querySelector('.arena'), ab = ar.getBoundingClientRect(), r = target.getBoundingClientRect();
    const x = r.left - ab.left + r.width / 2, y = r.top - ab.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
      const p = h(`<span class="pt" style="left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--r:${(Math.random() - .5) * 120}deg;animation-delay:${i * 25}ms">${emoji}</span>`);
      ar.appendChild(p); setTimeout(() => p.remove(), 1100);
    }
  }
  function popNum(target, txt, heal) {
    const ar = B.el.querySelector('.arena'), ab = ar.getBoundingClientRect(), r = target.getBoundingClientRect();
    const p = h(`<span class="dmg${heal ? ' heal' : ''}" style="left:${r.left - ab.left + r.width / 2}px;top:${r.top - ab.top + r.height * .25}px">${txt}</span>`);
    ar.appendChild(p); setTimeout(() => p.remove(), 1100);
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
    if (Math.random() < 0.35) return atks[Math.floor(Math.random() * atks.length)][1];
    const score = m => m.pow * tmult(m.type, p.y.type) * (m.type === f.y.type ? 1.25 : 1);
    atks.sort((a, b) => score(b[0]) - score(a[0]));
    return atks[0][1];
  }
  function foeMove() {
    const fi = aiPick();
    return fi >= 0 ? B.f.moves[fi] : { name: 'じたばた', type: B.f.y.type, pow: 40, acc: 100, pp: 99 };
  }

  async function turn(i) {
    if (!B || B.busy) return;
    const pm = B.p.moves[i]; if (pm.pp <= 0) return;
    B.busy = true; drawMoves();
    const fm = foeMove();
    const order = [[B.p, B.f, pm]];
    const foeFirst = B.f.spd > B.p.spd || (B.f.spd === B.p.spd && Math.random() < .5);
    if (foeFirst) order.unshift([B.f, B.p, fm]); else order.push([B.f, B.p, fm]);
    for (const [a, t, m] of order) {
      if (a.hp <= 0 || t.hp <= 0) continue;
      await doMove(a, t, m);
      if (t.hp <= 0) break;
    }
    await afterTurn();
  }
  async function afterTurn() {
    if (B.f.hp <= 0) return win();
    if (B.p.hp <= 0) {
      A.sfx('faint'); B.el.querySelector('#plySpr').classList.add('faint');
      await say(`${B.p.name}は たおれてしまった…`);
      drawHud();
      if (B.team.some(t => t.hp > 0)) { swapSheet(true); return; }
      return lose();
    }
    if (B.p.moves.every(m => m.pp <= 0)) B.p.moves.forEach(m => m.pp = m.maxpp);
    B.busy = false; drawMoves();
    setMsg(`${B.p.name}は どうする?`);
  }

  function swapSheet(forced) {
    B.busy = true; drawMoves();
    const opts = B.team.map((t, i) => [t, i]).filter(([t, i]) => i !== B.pi && t.hp > 0);
    const sh = h(`<div class="sheet">
      <h3>${forced ? 'つぎは だれが でる?' : 'だれと いれかえる?'}</h3>
      <div class="swap-list">${opts.map(([t, i]) => `<button class="swap-item" data-i="${i}" style="--tc:${TYPES[t.y.type].c}">
        <div class="sw-art">${yokaiSVG(t.y, { noShadow: true })}</div>
        <div class="sw-info"><b>${t.name}</b><small>${TYPES[t.y.type].i} Lv.${t.lv} ・ HP ${t.hp}/${t.maxhp}</small>
        <div class="hp"><div class="track"><i class="${t.hp / t.maxhp <= .2 ? 'low' : t.hp / t.maxhp <= .5 ? 'mid' : ''}" style="width:${t.hp / t.maxhp * 100}%"></i></div></div></div></button>`).join('')}</div>
      ${forced ? '' : '<p class="hint">いれかえると あいてが こうげきしてくるよ。</p><div class="sheet-actions"><button class="btn sub" id="no">やめる</button></div>'}
    </div>`);
    const v = h(`<div class="veil"></div>`); v.appendChild(sh); B.el.appendChild(v);
    if (!forced) {
      const cancel = () => { A.sfx('back'); v.remove(); B.busy = false; drawMoves(); };
      sh.querySelector('#no').onclick = cancel;
      v.addEventListener('click', e => { if (e.target === v) cancel(); });
    }
    sh.querySelectorAll('.swap-item').forEach(b => b.onclick = async () => {
      A.sfx('tap'); v.remove();
      const prev = B.p;
      if (!forced) { A.sfx('whoosh'); await say(`もどれ、${prev.name}!`, 300); }
      B.pi = +b.dataset.i; B.p = B.team[B.pi];
      B.p.st = { atk: 0, def: 0 };
      drawPlayerSprite(); drawHud();
      await say(`いけっ! ${B.p.name}!`);
      if (!forced) {
        const fm = foeMove();
        await doMove(B.f, B.p, fm);
        return afterTurn();
      }
      B.busy = false; drawMoves(); setMsg(`${B.p.name}は どうする?`);
    });
  }

  async function doMove(a, t, m) {
    m.pp--;
    const me = a !== B.f;
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
    const mul = tmult(m.type, t.y.type), stab = m.type === a.y.type ? 1.25 : 1, crit = Math.random() < 1 / 16 ? 1.5 : 1;
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
    await say(`${B.f.name}を やっつけた!`);
    A.stop(); A.sfx('win');
    S.wins++;
    // けいけんち(パーティ全員に)
    const gain = Math.round(B.f.lv * 7 * (B.boss ? 2 : 1));
    await say(`みんな けいけんちを ${gain} もらった!`, 500);
    for (const t of B.team) {
      const fr = S.friends[t.id];
      fr.exp += gain;
      let up = false;
      while (fr.exp >= needExp(fr.lv) && fr.lv < 60) { fr.exp -= needExp(fr.lv); fr.lv++; up = true; }
      if (up) { A.sfx('up'); await say(`${t.name}は レベル ${fr.lv}に あがった!`, 500); }
    }
    save();
    const y = B.f.y;
    if (B.boss) {
      const first = !isFriend(y.id);
      S.dango += 3;
      if (first) addFriend(y.id, B.f.lv - 2);
      S.area = Math.min(AREAS.length, Math.max(S.area, B.area + 2));
      save();
      if (first) {
        await say(`${y.name}は きみの つよさを みとめた!`, 500);
        return reward(y, true, () => {
          if (B.area === AREAS.length - 1 && !S.cleared) { S.cleared = true; save(); return ending(); }
          if (B.area < AREAS.length - 1) return unlockArea(B.area + 1);
          homeScreen();
        }, '🍡 おだんご ×3 も もらった!');
      }
      await say('🍡 おだんごを 3こ もらった!');
      return homeScreen();
    }
    if (isFriend(y.id)) {
      if (Math.random() < 0.35) { S.dango++; save(); await say(`${y.name}が 🍡おだんごを おとしていった!`); }
      return homeScreen();
    }
    befriendChoice();
  }

  function befriendChoice() {
    const y = B.f.y;
    const base = { 1: .6, 2: .4, 3: 1, 4: .35 }[y.rare];
    setMsg(`${y.name}が もじもじ している…。ともだちに なりたい みたい!`);
    const box = B.el.querySelector('#moves');
    box.innerHTML = `<button class="mv" id="dg" style="--tc:#FFE0EA;--tcd:#F0A2C0" ${S.dango ? '' : 'disabled'}><b>🍡 おだんごを あげる</b><small><span>なかまに なりやすい!</span><span>のこり ${S.dango}</span></small></button>
      <button class="mv" id="iv" style="--tc:#D9F3E8;--tcd:#9ED6BF"><b>🤝 ともだちに さそう</b><small><span>そのまま さそう</span></small></button>
      <button class="mv wide" id="bye" style="--tc:#F1E8EE;--tcd:#D8C6D0"><b>👋 またね</b></button>`;
    B.el.querySelector('#swap').disabled = true; B.el.querySelector('#run').disabled = true;
    const go = async useDango => {
      box.querySelectorAll('button').forEach(b => b.disabled = true);
      let ch = base;
      if (useDango) { S.dango--; save(); ch = Math.min(.95, base + .35); A.sfx('heal'); burst(spr(B.f), '🍡', 6); await say(`${y.name}に おだんごを あげた! うれしそう!`); }
      await say('ドキドキ…', 300); await say('ドキドキ…', 500);
      if (Math.random() < ch) {
        addFriend(y.id, B.f.lv);
        A.sfx('card');
        await say(`やったね! ${y.name}が ともだちに なった!`, 500);
        reward(y, true, () => homeScreen(), S.party.includes(y.id) ? 'パーティに くわわったよ!' : 'なかまの がめんで パーティに いれられるよ');
      } else {
        A.sfx('miss');
        await say(`${y.name}は はずかしがって にげちゃった…`);
        await say('また あおうね!', 500);
        homeScreen();
      }
    };
    box.querySelector('#dg').onclick = () => go(true);
    box.querySelector('#iv').onclick = () => go(false);
    box.querySelector('#bye').onclick = async () => { A.sfx('back'); box.innerHTML = ''; await say(`${y.name}に てを ふって わかれた。`); homeScreen(); };
  }

  async function lose() {
    A.stop(); A.sfx('lose');
    await say('みんな つかれて しまった…');
    await say('おうちに かえって ひとやすみ しよう。', 900);
    homeScreen();
  }

  function reward(y, isNew, next, sub) {
    const box = h(`<div class="reward">
      ${isNew ? '<div class="new">ずかんに とうろく!</div>' : ''}
      <div class="zcard flip-in" style="--cc:${TYPES[y.type].c}">
        <div class="zc-top"><span class="cno">No.${String(y.no).padStart(2, '0')}</span><span>${typeChip(y.type)}</span></div>
        <div class="zc-art">${yokaiSVG(y)}</div>
        <div class="zc-name">${y.name}<small>${y.kanji}</small></div>
        <div class="zc-txt">${y.text}</div>
        <div class="shine"></div>
      </div>
      ${sub ? `<p class="rw-text">${sub}</p>` : ''}
      <button class="btn gold" id="ok">やったね!</button>
    </div>`);
    const v = veil(box, true); confetti(v);
    box.querySelector('#ok').onclick = () => { A.sfx('tap'); v.remove(); next(); };
  }
  function unlockArea(i) {
    const a = AREAS[i];
    homeScreen();
    const box = h(`<div class="reward"><div class="new">あたらしい エリア!</div><div class="area-pop flip-in">${a.i}</div>
      <h3>${a.n}へ いけるように なった!</h3><p class="rw-text">${a.text}</p><button class="btn gold" id="ok">いってみよう!</button></div>`);
    const v = veil(box, true); confetti(v, 30); A.sfx('champ');
    box.querySelector('#ok').onclick = () => { A.sfx('tap'); v.remove(); };
  }
  function ending() {
    homeScreen();
    const fr = Object.keys(S.friends).length;
    const box = h(`<div class="reward ending">
      <div class="new">ぜんエリア クリア!</div>
      <div class="end-charas">${S.party.map(id => `<div class="bounce">${yokaiSVG(YOKAI[id])}</div>`).join('')}</div>
      <h3>ようかいの くに に へいわが もどった!</h3>
      <p class="rw-text">きみと ともだちの ようかい ${fr}ひきの おかげだよ。<br>…ようかいやしきの おくから、ありがたい ひかりが みえる。<br>まだ 見ぬ ようかいを さがしに いこう!</p>
      <button class="btn gold" id="ok">ぼうけんを つづける</button></div>`);
    const v = veil(box, true); confetti(v, 90); A.sfx('champ');
    box.querySelector('#ok').onclick = () => { A.sfx('tap'); v.remove(); homeScreen(); };
  }

  titleScreen();
})();
