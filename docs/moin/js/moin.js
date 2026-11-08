// 「モイン！」の大声と効果音
// 声の出し方: 端末の読み上げ(speech) / 合成ボイス(synth) / 録音した自分の声(rec)
const REC_KEY = 'moincraft-voice-rec';

export class MoinVoice {
  constructor() {
    this.ctx = null; this.master = null;
    this.mode = 'auto'; this.volume = 1;
    this.recBuffer = null; this.jaVoice = null;
    this.lastShout = 0; this.variety = true; this.lastStyle = 'normal';
    if ('speechSynthesis' in window) {
      const pick = () => { const vs = speechSynthesis.getVoices(); this.jaVoice = vs.find(v => /ja[-_]JP/i.test(v.lang)) || vs.find(v => /^ja/i.test(v.lang)) || null; };
      pick(); speechSynthesis.addEventListener?.('voiceschanged', pick);
    }
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.15;
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      // 洞窟っぽいこだま
      this.echo = this.ctx.createDelay(1); this.echo.delayTime.value = 0.16;
      const fb = this.ctx.createGain(); fb.gain.value = 0.28; const wet = this.ctx.createGain(); wet.gain.value = 0.35;
      this.echo.connect(fb); fb.connect(this.echo); this.echo.connect(wet); wet.connect(this.master);
      this.loadRecording();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    // iOS などは最初の操作の中で一度話させておくと以後も話せる
    if (!this._spoke && 'speechSynthesis' in window) { this._spoke = true; const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  resolvedMode() {
    if (this.mode !== 'auto') return this.mode === 'rec' && !this.recBuffer ? 'synth' : this.mode;
    if (this.recBuffer) return 'rec';
    if (this.jaVoice) return 'speech';
    return 'synth';
  }

  // 声のスタイル: normal(ふつう) / laugh(笑いながら) / scream(叫ぶ) / timid(自信なし)
  pickStyle() {
    if (!this.variety) return 'normal';
    const r = Math.random();
    return r < 0.34 ? 'normal' : r < 0.56 ? 'laugh' : r < 0.78 ? 'scream' : 'timid';
  }

  shout(style) {
    const now = performance.now();
    if (now - this.lastShout < 120) return this.lastStyle || 'normal'; // 連打で音が潰れないように
    this.lastShout = now;
    style = style || this.pickStyle(); this.lastStyle = style;
    const m = this.resolvedMode();
    if (m === 'speech') this.speak(style);
    else if (m === 'rec') this.playRec(style);
    else this.synth(style);
    return style;
  }

  speak(style = 'normal') {
    if (!('speechSynthesis' in window)) return this.synth(style);
    speechSynthesis.cancel();
    const P = {
      normal: { t: 'モイン！', rate: 1.15, pitch: 0.9 + Math.random() * 0.8, vol: 1 },
      laugh: { t: 'あはははは！モイン！あはは！', rate: 1.3, pitch: 1.5 + Math.random() * 0.4, vol: 1 },
      scream: { t: 'モイーーーン！！！', rate: 0.85, pitch: 1.6 + Math.random() * 0.4, vol: 1 },
      timid: { t: 'も、モイン…？', rate: 0.7, pitch: 0.6 + Math.random() * 0.25, vol: 0.55 },
    }[style];
    const u = new SpeechSynthesisUtterance(P.t);
    u.lang = 'ja-JP'; if (this.jaVoice) u.voice = this.jaVoice;
    u.volume = Math.min(1, this.volume * P.vol); u.rate = P.rate; u.pitch = P.pitch;
    speechSynthesis.speak(u);
  }

  // フォルマント合成で「モ・イ・ン！」。o: f0(基本の高さ), k(時間の伸び), gain, grit(ひずみ), vibD/vibR(ビブラート), pitch(高さの変化), open(口の開き)
  moinSyl(t0, o = {}) {
    const ctx = this.ctx;
    const k = o.k ?? 1, f0 = o.f0 ?? 230, gain = o.gain ?? 0.9, vibD = o.vibD ?? 0.03, vibR = o.vibR ?? 6, open = o.open ?? 1;
    const pitch = o.pitch ?? [[0, 0.9], [0.2, 1.15], [0.38, 1.25], [0.8, 0.85]];
    const end = 0.95 * k;
    const src = ctx.createOscillator(); src.type = 'sawtooth';
    pitch.forEach(([t, m], i) => { const f = f0 * m; if (i === 0) src.frequency.setValueAtTime(f, t0); else src.frequency.linearRampToValueAtTime(f, t0 + t * k); });
    const vib = ctx.createOscillator(); vib.frequency.value = vibR; const vg = ctx.createGain(); vg.gain.value = f0 * vibD;
    vib.connect(vg); vg.connect(src.frequency);
    const grit = ctx.createWaveShaper(); const curve = new Float32Array(256), gk = o.grit ?? 2.2;
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * gk); }
    grit.curve = curve;
    const out = ctx.createGain(); out.gain.value = 0;
    out.connect(grit); grit.connect(this.master); grit.connect(this.echo);
    // 母音: o → i
    const fm = [[500, 520, 300], [850, 900, 2300], [2500, 2600, 3000]], fg = [1.0, 0.7, 0.35];
    const vowel = ctx.createGain(); vowel.gain.value = 0; vowel.connect(out);
    fm.forEach(([a, b, c], j) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 7;
      const m = j === 0 ? 1 : open;
      bp.frequency.setValueAtTime(a * m, t0); bp.frequency.setValueAtTime(b * m, t0 + 0.28 * k); bp.frequency.linearRampToValueAtTime(c * (j === 0 ? 1 : open), t0 + 0.36 * k);
      const g = ctx.createGain(); g.gain.value = fg[j] * 4; src.connect(bp); bp.connect(g); g.connect(vowel);
    });
    // 鼻音: m と n
    const nasal = ctx.createBiquadFilter(); nasal.type = 'lowpass'; nasal.frequency.value = 330; nasal.Q.value = 3;
    const ng = ctx.createGain(); ng.gain.value = 0; src.connect(nasal); nasal.connect(ng); ng.connect(out);
    ng.gain.setValueAtTime(0, t0); ng.gain.linearRampToValueAtTime(1.2, t0 + 0.03 * k); ng.gain.linearRampToValueAtTime(0.1, t0 + 0.09 * k);
    ng.gain.setValueAtTime(0.1, t0 + 0.5 * k); ng.gain.linearRampToValueAtTime(1.3, t0 + 0.58 * k); ng.gain.linearRampToValueAtTime(0, t0 + 0.85 * k);
    vowel.gain.setValueAtTime(0, t0 + 0.05 * k); vowel.gain.linearRampToValueAtTime(1, t0 + 0.1 * k);
    vowel.gain.setValueAtTime(1, t0 + 0.48 * k); vowel.gain.linearRampToValueAtTime(0, t0 + 0.58 * k);
    out.gain.setValueAtTime(0.0001, t0); out.gain.linearRampToValueAtTime(gain, t0 + 0.04 * k);
    out.gain.setValueAtTime(gain, t0 + 0.7 * k); out.gain.linearRampToValueAtTime(0, t0 + 0.88 * k);
    src.start(t0); vib.start(t0); src.stop(t0 + end); vib.stop(t0 + end);
  }

  // 「は!」という笑い声を n 回
  ha(t0, n, f0) {
    const ctx = this.ctx;
    const src = ctx.createOscillator(); src.type = 'sawtooth';
    const total = n * 0.115;
    src.frequency.setValueAtTime(f0, t0); src.frequency.linearRampToValueAtTime(f0 * 0.8, t0 + total);
    const out = ctx.createGain(); out.gain.value = 0; out.connect(this.master); out.connect(this.echo);
    [[820, 1.0], [1250, 0.8], [2600, 0.3]].forEach(([f, g]) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
      const gg = ctx.createGain(); gg.gain.value = g * 4; src.connect(bp); bp.connect(gg); gg.connect(out);
    });
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.115, peak = 0.75 * (1 - i / (n + 2));
      out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(peak, t + 0.012); out.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    }
    src.start(t0); src.stop(t0 + total + 0.05);
    this.noiseAt(t0, total, 5000, 0.18);
  }
  noiseAt(t0, dur, freq, gain) {
    const ctx = this.ctx, n = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur | 0), ctx.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.abs(Math.sin(i / ctx.sampleRate * 55)));
    const s = ctx.createBufferSource(); s.buffer = n; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(this.master); s.start(t0);
  }

  synth(style = 'normal') {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + 0.01, p = 0.9 + Math.random() * 0.35;
    if (style === 'laugh') {
      // 「はは、はは! モイン! はは…」
      this.ha(t0, 4, 330 * p);
      this.moinSyl(t0 + 0.5, { f0: 300 * p, k: 0.85, gain: 0.85, vibD: 0.07, vibR: 11, pitch: [[0, 1.0], [0.2, 1.3], [0.38, 1.4], [0.8, 1.0]], open: 1.1 });
      this.ha(t0 + 1.25, 3, 300 * p);
    } else if (style === 'scream') {
      // のびて高くなる「モイーーン!!」
      this.moinSyl(t0, { f0: 330 * p, k: 1.7, gain: 1.0, grit: 5, vibD: 0.02, vibR: 8, open: 1.25,
        pitch: [[0, 0.9], [0.2, 1.3], [0.38, 1.7], [0.6, 1.75], [0.8, 1.2]] });
      this.noiseAt(t0, 1.2, 2500, 0.1);
    } else if (style === 'timid') {
      // 「も、モイン…?」小さくふるえる声、語尾が上がる
      this.moinSyl(t0, { f0: 170 * p, k: 0.38, gain: 0.3, vibD: 0.06, vibR: 7, pitch: [[0, 1], [0.8, 0.95]] });
      this.moinSyl(t0 + 0.55, { f0: 185 * p, k: 1.35, gain: 0.34, vibD: 0.09, vibR: 5.5, grit: 1.2,
        pitch: [[0, 0.95], [0.3, 0.85], [0.55, 0.8], [0.8, 1.25]] });
    } else {
      this.moinSyl(t0, { f0: 230 * p });
    }
  }

  playRec(style = 'normal') {
    if (!this.ctx || !this.recBuffer) return this.synth(style);
    const ctx = this.ctx, jit = 0.92 + Math.random() * 0.22, now = ctx.currentTime + 0.01;
    const play = (at, rate, gain, offset = 0, dur, sat = 0) => {
      const s = ctx.createBufferSource(); s.buffer = this.recBuffer; s.playbackRate.value = rate;
      const g = ctx.createGain(); g.gain.value = gain; let tail = g;
      if (sat) { const w = ctx.createWaveShaper(), c = new Float32Array(256); for (let i = 0; i < 256; i++) c[i] = Math.tanh((i / 128 - 1) * sat); w.curve = c; g.connect(w); tail = w; }
      s.connect(g); tail.connect(this.master); tail.connect(this.echo);
      if (dur) s.start(at, offset, dur); else s.start(at, offset);
    };
    if (style === 'laugh') { this.ha(now, 3, 320 * jit); play(now + 0.4, 1.12 * jit, 2.0); this.ha(now + 0.4 + this.recBuffer.duration / 1.12 * 0.9, 3, 300); }
    else if (style === 'scream') play(now, 1.2 + Math.random() * 0.2, 3.2, 0, undefined, 4);
    else if (style === 'timid') { play(now, 0.88, 0.7, 0, Math.min(0.25, this.recBuffer.duration)); play(now + 0.55, 0.8 + Math.random() * 0.06, 0.8); }
    else play(now, jit, 2.2);
  }

  // ---- 自分の声を録音 ----
  async record(seconds = 1.6) {
    this.unlock();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } });
    const rec = new MediaRecorder(stream); const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => rec.onstop = r);
    rec.start(); setTimeout(() => rec.stop(), seconds * 1000);
    await done; stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
    const ab = await blob.arrayBuffer();
    this.recBuffer = this.trim(await this.ctx.decodeAudioData(ab.slice(0)));
    try { localStorage.setItem(REC_KEY, await blobToDataURL(blob)); } catch (e) { /* 容量不足なら今回だけ使う */ }
  }
  clearRecording() { this.recBuffer = null; try { localStorage.removeItem(REC_KEY); } catch (e) {} }
  async loadRecording() {
    let url = null; try { url = localStorage.getItem(REC_KEY); } catch (e) {}
    if (!url) return;
    try { const ab = await (await fetch(url)).arrayBuffer(); this.recBuffer = this.trim(await this.ctx.decodeAudioData(ab)); } catch (e) {}
  }
  // 前後の無音を切り詰める
  trim(buf) {
    const d = buf.getChannelData(0); let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    const th = peak * 0.08; let a = 0, b = d.length - 1;
    while (a < d.length && Math.abs(d[a]) < th) a++;
    while (b > a && Math.abs(d[b]) < th) b--;
    a = Math.max(0, a - 800); b = Math.min(d.length, b + 2400);
    if (b - a < 1000) return buf;
    const out = this.ctx.createBuffer(1, b - a, buf.sampleRate);
    const o = out.getChannelData(0), norm = peak > 0 ? 0.9 / peak : 1;
    for (let i = 0; i < b - a; i++) o[i] = d[a + i] * norm;
    return out;
  }

  // ---- 効果音 ----
  noise(dur, freq, gain, type = 'bandpass') {
    const ctx = this.ctx; if (!ctx) return;
    const n = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur | 0), ctx.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const s = ctx.createBufferSource(); s.buffer = n;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.value = gain * 0.6;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
  }
  tick(id) { this.noise(0.05, 900 + (id * 137) % 900, 0.35); }
  place() { this.noise(0.09, 420, 0.8, 'lowpass'); }
  breakSfx() { this.noise(0.18, 600, 0.8); }
  step() { this.noise(0.05, 300, 0.12, 'lowpass'); }
  blip() {
    const ctx = this.ctx; if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = 'square'; o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + 0.06);
    g.gain.setValueAtTime(0.08, t); g.gain.linearRampToValueAtTime(0, t + 0.14);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.15);
  }
  fanfare() {
    const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.1); g.gain.linearRampToValueAtTime(0.2, t + i * 0.1 + 0.02); g.gain.linearRampToValueAtTime(0, t + i * 0.1 + 0.3);
      o.connect(g); g.connect(this.master); o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.35); });
  }
}

function blobToDataURL(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }); }
