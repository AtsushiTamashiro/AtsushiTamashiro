// ようかい ぽんぽこバトル — BGM & 効果音(Web Audio でその場で合成)
(function () {
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(tok) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(tok);
    if (!m) return null;
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);

  // トークン列 → [{n, len}|null]  "-" は前の音をのばす / "." は休符
  function parse(str) {
    const toks = str.split(/\s+/).filter(t => t && t !== '|');
    const out = toks.map(() => null);
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t === '.' || t === '-') continue;
      let len = 1;
      while (toks[i + len] === '-') len++;
      out[i] = /^[kshc]$/.test(t) ? { d: t } : { n: midi(t), len };
    }
    return out;
  }
  function rep(s, n) { return Array(n).fill(s).join(' '); }

  const SONGS = {
    // ホーム:陽音階(D E G A B)のおまつりばやし風
    home: {
      bpm: 118,
      tracks: {
        lead: parse(`D5 E5 G5 A5 B5 - A5 G5 | A5 - G5 E5 D5 - . . | E5 G5 A5 B5 D6 - B5 A5 | B5 - A5 G5 A5 - . .
                     D6 - B5 A5 G5 - A5 B5 | A5 G5 E5 G5 A5 - . . | G5 A5 B5 A5 G5 E5 D5 E5 | D5 - - - . . A4 .`),
        arp: parse(`D4 A4 D5 A4 D4 A4 D5 A4 | G3 D4 G4 D4 G3 D4 G4 D4 | E4 B4 E5 B4 E4 B4 E5 B4 | A3 E4 A4 E4 A3 E4 A4 E4
                    G3 D4 G4 D4 G3 D4 G4 D4 | A3 E4 A4 E4 A3 E4 A4 E4 | E4 B4 E5 B4 A3 E4 A4 E4 | D4 A4 D5 A4 D4 A4 D5 A4`),
        bass: parse(`D3 - A2 - D3 - A2 - | G2 - D3 - G2 - D3 - | E2 - B2 - E2 - B2 - | A2 - E3 - A2 - E3 -
                     G2 - D3 - G2 - D3 - | A2 - E3 - A2 - E3 - | E2 - B2 - A2 - E3 - | D3 - A2 - D3 - - -`),
        drum: parse(Array(8).fill('k . s . k k s h').join(' ')),
      },
      vol: { lead: 0.07, arp: 0.03, bass: 0.13, drum: 0.6 },
    },
    // バトル:ちょっとあやしい五音音階(A C D E G)
    battle: {
      bpm: 160,
      tracks: {
        lead: parse(`A5 . A5 G5 A5 C6 D6 C6 | A5 - G5 E5 G5 - . . | D5 E5 G5 A5 G5 E5 D5 C5 | D5 - E5 - . . . .
                     A5 C6 D6 E6 D6 C6 A5 G5 | A5 - C6 - D6 - . . | E6 D6 C6 A5 G5 A5 C6 D6 | E6 - - - A5 - - -`),
        arp: parse(`A4 E5 A4 E5 A4 E5 A4 E5 | A4 E5 A4 E5 G4 D5 G4 D5 | D4 A4 D5 A4 D4 A4 D5 A4 | E4 B4 E5 B4 E4 B4 E5 B4
                    A4 E5 A4 E5 A4 E5 A4 E5 | F4 C5 F5 C5 F4 C5 F5 C5 | C4 G4 C5 G4 C4 G4 C5 G4 | E4 B4 E5 B4 E4 B4 E5 B4`),
        bass: parse(`A2 A3 A2 A3 A2 A3 A2 A3 | A2 A3 A2 A3 G2 G3 G2 G3 | D2 D3 D2 D3 D2 D3 D2 D3 | E2 E3 E2 E3 E2 E3 E2 E3
                     A2 A3 A2 A3 A2 A3 A2 A3 | F2 F3 F2 F3 F2 F3 F2 F3 | C3 C4 C3 C4 C3 C4 C3 C4 | E2 E3 E2 E3 E2 E3 E2 E3`),
        drum: parse(Array(7).fill('k h s h k k s h').join(' ') + ' k s k s s s s s'),
      },
      vol: { lead: 0.065, arp: 0.025, bass: 0.12, drum: 0.75 },
    },
    boss: null,
  };
  // ぬし戦はバトル曲を少し速く
  SONGS.boss = Object.assign({}, SONGS.battle, { bpm: 178 });

  const M = {
    ctx: null, master: null, bgm: null, muted: false, cur: null, curName: null, step: 0, nextT: 0, timer: null, pending: null,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.bgm = this.ctx.createGain(); this.bgm.gain.value = 1; this.bgm.connect(this.master);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.timer = setInterval(() => this.tick(), 25);
      if (this.pending) { const p = this.pending; this.pending = null; this.play(p); }
    },
    setMuted(v) {
      this.muted = v;
      if (this.master) this.master.gain.setTargetAtTime(v ? 0 : 0.9, this.ctx.currentTime, 0.05);
    },
    play(name) {
      if (!this.ctx) { this.pending = name; return; }
      if (this.curName === name) return;
      this.curName = name; this.cur = SONGS[name];
      this.step = 0; this.nextT = this.ctx.currentTime + 0.08;
      this.bgm.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bgm.gain.setValueAtTime(1, this.ctx.currentTime);
    },
    stop() { this.cur = null; this.curName = null; if (!this.ctx) this.pending = null; },
    tick() {
      const s = this.cur; if (!s || !this.ctx) return;
      const dt = 60 / s.bpm / 2;
      const total = s.tracks.lead.length;
      while (this.nextT < this.ctx.currentTime + 0.15) {
        for (const k in s.tracks) {
          const ev = s.tracks[k][this.step % s.tracks[k].length];
          if (!ev) continue;
          if (ev.d) this.drum(ev.d, this.nextT, s.vol.drum);
          else this.voice(k, ev.n, this.nextT, ev.len * dt, s.vol[k], this.bgm);
        }
        this.step = (this.step + 1) % total;
        this.nextT += dt;
      }
    },
    voice(kind, n, t, dur, vol, dest) {
      const c = this.ctx, f = hz(n);
      const g = c.createGain(); g.connect(dest || this.master);
      if (kind === 'lead') {
        const o1 = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter();
        o1.type = 'square'; o2.type = 'triangle'; o1.frequency.value = f; o2.frequency.value = f * 2.002;
        lp.type = 'lowpass'; lp.frequency.value = 2600;
        const g2 = c.createGain(); g2.gain.value = 0.5;
        o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g);
        const end = t + Math.max(0.09, dur * 0.92);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(vol * 0.55, t + 0.12); g.gain.setValueAtTime(vol * 0.55, end - 0.03);
        g.gain.linearRampToValueAtTime(0.0001, end + 0.04);
        [o1, o2].forEach(o => { o.start(t); o.stop(end + 0.06); });
      } else if (kind === 'arp') {
        const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * 2;
        const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f;
        o.connect(g); o2.connect(g);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
        [o, o2].forEach(x => { x.start(t); x.stop(t + 0.34); });
      } else if (kind === 'bass') {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        o.connect(g);
        const end = t + Math.min(dur, 0.5) * 0.85;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(vol * 0.4, end);
        g.gain.linearRampToValueAtTime(0.0001, end + 0.03);
        o.start(t); o.stop(end + 0.05);
      } else { // sfx / fanfare
        const o = c.createOscillator(); o.type = kind === 'sq' ? 'square' : kind === 'tri' ? 'triangle' : 'sine';
        o.frequency.value = f; o.connect(g);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.start(t); o.stop(t + dur + 0.02);
      }
    },
    drum(d, t, vol) {
      const c = this.ctx;
      if (d === 'k') {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.32 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g); g.connect(this.bgm); o.start(t); o.stop(t + 0.18);
      } else {
        const src = c.createBufferSource(); src.buffer = this.noise;
        const f = c.createBiquadFilter(), g = c.createGain();
        if (d === 'h') { f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.05 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); }
        else { f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8; g.gain.setValueAtTime(0.16 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13); }
        src.connect(f); f.connect(g); g.connect(this.bgm); src.start(t); src.stop(t + 0.15);
      }
    },
    seq(notes, step, kind, vol) { // [[note, beats]...]
      if (!this.ctx) return;
      let t = this.ctx.currentTime + 0.02;
      for (const [n, b] of notes) {
        if (n) this.voice(kind || 'sq', midi(n), t, Math.max(0.12, b * step * 1.4), vol || 0.08);
        t += b * step;
      }
    },
    sfx(name) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      switch (name) {
        case 'tap': this.seq([['E6', 1], ['A6', 1]], 0.045, 'sq', 0.05); break;
        case 'back': this.seq([['A5', 1], ['E5', 1]], 0.05, 'sq', 0.05); break;
        case 'heal': this.seq([['C5', 1], ['E5', 1], ['G5', 1], ['C6', 1], ['E6', 2]], 0.07, 'sine', 0.12); break;
        case 'up': this.seq([['C5', 1], ['G5', 1], ['C6', 1], ['G6', 2]], 0.06, 'tri', 0.12); break;
        case 'down': this.seq([['G5', 1], ['D5', 1], ['A4', 1], ['E4', 2]], 0.07, 'tri', 0.12); break;
        case 'miss': this.seq([['C5', 1], ['B4', 3]], 0.08, 'tri', 0.1); break;
        case 'card': this.seq([['C6', 1], ['E6', 1], ['G6', 1], ['C7', 1], ['G6', 1], ['C7', 3]], 0.07, 'sine', 0.1); break;
        case 'faint': {
          const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle';
          o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.7);
          g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
          o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.8); break;
        }
        case 'hit': case 'crit': {
          const src = c.createBufferSource(); src.buffer = this.noise;
          const f = c.createBiquadFilter(), g = c.createGain();
          f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.2);
          g.gain.setValueAtTime(name === 'crit' ? 0.5 : 0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
          src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + 0.25);
          const o = c.createOscillator(), g2 = c.createGain(); o.type = 'square';
          o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.15);
          g2.gain.setValueAtTime(0.08, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
          o.connect(g2); g2.connect(this.master); o.start(t); o.stop(t + 0.18); break;
        }
        case 'whoosh': {
          const src = c.createBufferSource(); src.buffer = this.noise;
          const f = c.createBiquadFilter(), g = c.createGain(); f.type = 'bandpass'; f.Q.value = 2;
          f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3500, t + 0.18);
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
          src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + 0.25); break;
        }
        case 'win': this.seq([['G5', 1], ['C6', 1], ['E6', 1], ['G6', 3], ['E6', 1], ['G6', 4]], 0.12, 'sq', 0.08);
          this.seq([['C4', 3], ['G4', 3], ['C5', 4]], 0.12, 'tri', 0.14); break;
        case 'lose': this.seq([['E5', 2], ['D#5', 2], ['D5', 2], ['C#5', 6]], 0.14, 'tri', 0.12); break;
        case 'champ': this.seq([['C5', 1], ['E5', 1], ['G5', 1], ['C6', 2], ['A5', 1], ['C6', 1], ['D6', 2], ['E6', 6]], 0.13, 'sq', 0.09);
          this.seq([['C4', 4], ['F4', 2], ['G4', 2], ['C5', 6]], 0.13, 'tri', 0.14); break;
      }
    },
    duck(on) { if (this.bgm) this.bgm.gain.setTargetAtTime(on ? 0 : 1, this.ctx.currentTime, on ? 0.05 : 0.4); },
  };
  window.YokaiAudio = M;
})();
