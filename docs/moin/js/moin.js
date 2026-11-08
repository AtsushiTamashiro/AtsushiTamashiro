// 「モイン！」の大声と効果音
// 声の出し方: 端末の読み上げ(speech) / 合成ボイス(synth) / 録音した自分の声(rec)
const REC_KEY = 'moincraft-voice-rec';

export class MoinVoice {
  constructor() {
    this.ctx = null; this.master = null;
    this.mode = 'auto'; this.volume = 1;
    this.recBuffer = null; this.jaVoice = null;
    this.lastShout = 0;
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

  shout() {
    const now = performance.now();
    if (now - this.lastShout < 120) return; // 連打で音が潰れないように
    this.lastShout = now;
    const m = this.resolvedMode();
    if (m === 'speech') this.speak();
    else if (m === 'rec') this.playRec();
    else this.synth();
  }

  speak() {
    if (!('speechSynthesis' in window)) return this.synth();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('モイン！');
    u.lang = 'ja-JP'; if (this.jaVoice) u.voice = this.jaVoice;
    u.volume = Math.min(1, this.volume); u.rate = 1.15; u.pitch = 0.9 + Math.random() * 0.8;
    speechSynthesis.speak(u);
  }

  // フォルマント合成で「モ・イ・ン！」と叫ぶ
  synth() {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + 0.01, p = 0.9 + Math.random() * 0.35;
    const src = ctx.createOscillator(); src.type = 'sawtooth';
    const f0 = 230 * p;
    src.frequency.setValueAtTime(f0 * 0.9, t0);
    src.frequency.linearRampToValueAtTime(f0 * 1.15, t0 + 0.2);
    src.frequency.linearRampToValueAtTime(f0 * 1.25, t0 + 0.38);
    src.frequency.linearRampToValueAtTime(f0 * 0.85, t0 + 0.8);
    const vib = ctx.createOscillator(); vib.frequency.value = 6; const vg = ctx.createGain(); vg.gain.value = f0 * 0.03;
    vib.connect(vg); vg.connect(src.frequency);

    const grit = ctx.createWaveShaper(); const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); }
    grit.curve = curve;
    const out = ctx.createGain(); out.gain.value = 0;
    out.connect(grit); grit.connect(this.master); grit.connect(this.echo);

    // 母音: o → i
    const fm = [[500, 520, 300], [850, 900, 2300], [2500, 2600, 3000]];
    const fg = [1.0, 0.7, 0.35];
    const vowel = ctx.createGain(); vowel.gain.value = 0; vowel.connect(out);
    fm.forEach(([a, b, c], k) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 7;
      bp.frequency.setValueAtTime(a, t0); bp.frequency.setValueAtTime(b, t0 + 0.28); bp.frequency.linearRampToValueAtTime(c, t0 + 0.36);
      const g = ctx.createGain(); g.gain.value = fg[k] * 4;
      src.connect(bp); bp.connect(g); g.connect(vowel);
    });
    // 鼻音: m と n
    const nasal = ctx.createBiquadFilter(); nasal.type = 'lowpass'; nasal.frequency.value = 330; nasal.Q.value = 3;
    const ng = ctx.createGain(); ng.gain.value = 0; src.connect(nasal); nasal.connect(ng); ng.connect(out);

    ng.gain.setValueAtTime(0, t0); ng.gain.linearRampToValueAtTime(1.2, t0 + 0.03); ng.gain.linearRampToValueAtTime(0.1, t0 + 0.09);
    ng.gain.setValueAtTime(0.1, t0 + 0.5); ng.gain.linearRampToValueAtTime(1.3, t0 + 0.58); ng.gain.linearRampToValueAtTime(0, t0 + 0.85);
    vowel.gain.setValueAtTime(0, t0 + 0.05); vowel.gain.linearRampToValueAtTime(1, t0 + 0.1);
    vowel.gain.setValueAtTime(1, t0 + 0.48); vowel.gain.linearRampToValueAtTime(0, t0 + 0.58);
    out.gain.setValueAtTime(0.0001, t0); out.gain.linearRampToValueAtTime(0.9, t0 + 0.04);
    out.gain.setValueAtTime(0.9, t0 + 0.7); out.gain.linearRampToValueAtTime(0, t0 + 0.88);

    src.start(t0); vib.start(t0); src.stop(t0 + 0.95); vib.stop(t0 + 0.95);
  }

  playRec() {
    if (!this.ctx || !this.recBuffer) return this.synth();
    const s = this.ctx.createBufferSource(); s.buffer = this.recBuffer; s.playbackRate.value = 0.92 + Math.random() * 0.22;
    const g = this.ctx.createGain(); g.gain.value = 2.2;
    s.connect(g); g.connect(this.master); g.connect(this.echo); s.start();
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
