// 音:三線風の旋律(琉球音階)と効果音を WebAudio で合成
const NOTE = (n) => 261.63 * Math.pow(2, n / 12);
// 琉球音階: ド ミ ファ ソ シ
const RYU = [-12, -8, -7, -5, -1, 0, 4, 5, 7, 11, 12, 16, 17, 19];
// 旋律(RYU の添字, -1 = 休符)8分音符単位
const MELODY = [
  7, -1, 8, 9, 10, -1, 9, 8, 7, -1, 5, 6, 7, -1, -1, -1,
  9, -1, 10, 11, 10, 9, 8, -1, 9, -1, 8, 7, 6, -1, -1, -1,
  7, 8, 9, -1, 10, 11, 12, -1, 11, 10, 9, -1, 10, -1, 9, 8,
  7, -1, 6, 5, 6, -1, 7, -1, 5, -1, -1, -1, -1, -1, -1, -1,
];
const BATTLE = [
  5, 7, 9, 7, 10, 9, 7, 9, 5, 7, 9, 10, 12, 10, 9, 7,
  6, 7, 9, 7, 6, 4, 5, -1, 7, 9, 10, 12, 10, 9, 7, -1,
];

export class AudioSys {
  constructor() { this.ctx = null; this.battle = 0; this.step = 0; this.enabled = true; this.boss = false; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = 0.32; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    // 簡易リバーブ
    const len = ctx.sampleRate * 1.6, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.rev = ctx.createConvolver(); this.rev.buffer = buf; const rg = ctx.createGain(); rg.gain.value = 0.25; this.rev.connect(rg); rg.connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = this.noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 50);
  }
  setMuted(m) { this.enabled = !m; if (this.master) this.master.gain.value = m ? 0 : 0.7; }
  schedule() {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    const tempo = this.battle > 0.5 ? (this.boss ? 150 : 132) : 96, e8 = 60 / tempo / 2;
    while (this.nextTime < ctx.currentTime + 0.25) {
      const t = this.nextTime, st = this.step;
      const battle = this.battle > 0.5;
      const mel = battle ? BATTLE : MELODY; const idx = mel[st % mel.length];
      if (idx >= 0) this.sanshin(NOTE(RYU[idx]), t, battle ? 0.16 : 0.2);
      if (st % 4 === 0) this.sanshin(NOTE(RYU[st % 16 === 8 ? 3 : 0] - 12), t, 0.12, 1.4);
      if (battle) {
        if (st % 4 === 0) this.taiko(t, 1); if (st % 8 === 6) this.taiko(t, 0.7);
        if (st % 2 === 1) this.ka(t, 0.25); if (this.boss && st % 4 === 2) this.taiko(t, 0.6);
      } else if (st % 8 === 4) this.ka(t, 0.08);
      this.nextTime += e8; this.step++;
    }
  }
  sanshin(f, t, v, dec = 0.7) {
    const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'square'; o.frequency.setValueAtTime(f * 1.012, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05); o2.frequency.value = f * 2.003;
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 8, t); fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + dec * 0.6); fl.Q.value = 3;
    const g2 = ctx.createGain(); g2.gain.value = 0.15;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + dec);
    o.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g); g.connect(this.music); g.connect(this.rev);
    o.start(t); o2.start(t); o.stop(t + dec + 0.05); o2.stop(t + dec + 0.05);
  }
  taiko(t, v) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
    g.gain.setValueAtTime(v * 0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.45);
    this.noise(t, 0.06, 900, v * 0.3, this.music, 'lowpass');
  }
  ka(t, v) { this.noise(t, 0.03, 3500, v, this.music, 'bandpass'); }
  noise(t, dur, freq, v, dest, type = 'bandpass', q = 1) {
    const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  tone(f0, f1, dur, v, type = 'sine', delay = 0) {
    const ctx = this.ctx; if (!ctx) return; const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
  }
  play(name) {
    const ctx = this.ctx; if (!ctx || !this.enabled) return; const t = ctx.currentTime;
    switch (name) {
      case 'swing': this.noise(t, 0.16, 1400, 0.25, null, 'bandpass', 0.8); break;
      case 'swingBig': this.noise(t, 0.28, 700, 0.35, null, 'bandpass', 0.7); break;
      case 'hit': this.noise(t, 0.09, 2200, 0.5); this.tone(180, 60, 0.15, 0.6, 'sine'); break;
      case 'hitHeavy': this.noise(t, 0.15, 1500, 0.7); this.tone(140, 40, 0.25, 0.8, 'sine'); break;
      case 'hurt': this.tone(300, 120, 0.2, 0.35, 'square'); this.noise(t, 0.1, 800, 0.4); break;
      case 'block': this.tone(900, 700, 0.12, 0.25, 'triangle'); this.noise(t, 0.05, 4000, 0.3); break;
      case 'parry': this.tone(1400, 1400, 0.4, 0.3, 'triangle'); this.tone(2100, 2100, 0.35, 0.15, 'sine'); this.noise(t, 0.08, 5000, 0.4); break;
      case 'jump': this.tone(220, 330, 0.1, 0.12, 'triangle'); break;
      case 'dodge': this.noise(t, 0.2, 600, 0.25, null, 'lowpass'); break;
      case 'pickup': [0, 4, 7, 12].forEach((n, i) => this.tone(NOTE(n + 12), NOTE(n + 12), 0.25, 0.15, 'triangle', i * 0.07)); break;
      case 'checkpoint': [0, 4, 5, 7, 11, 12].forEach((n, i) => this.tone(NOTE(n), NOTE(n), 0.6, 0.12, 'triangle', i * 0.1)); break;
      case 'ki': [0, 7, 12, 19].forEach((n, i) => this.tone(NOTE(n), NOTE(n), 0.3, 0.12, 'square', i * 0.05)); break;
      case 'special': this.tone(80, 300, 0.6, 0.5, 'sawtooth'); this.noise(t, 0.8, 500, 0.5, null, 'lowpass'); break;
      case 'roar': this.tone(90, 50, 1.2, 0.6, 'sawtooth'); this.noise(t, 1.0, 300, 0.4, null, 'lowpass'); break;
      case 'slam': this.tone(70, 25, 0.6, 0.9, 'sine'); this.noise(t, 0.4, 400, 0.8, null, 'lowpass'); break;
      case 'warn': this.tone(1200, 1200, 0.06, 0.12, 'square'); break;
      case 'grunt': this.tone(140, 90, 0.18, 0.3, 'sawtooth'); break;
      case 'hiss': this.noise(t, 0.4, 6000, 0.25, null, 'highpass'); break;
      case 'die': this.tone(200, 50, 0.6, 0.4, 'triangle'); break;
      case 'text': this.tone(900, 900, 0.03, 0.04, 'square'); break;
      case 'victory': [0, 4, 7, 11, 12, 16, 19, 24].forEach((n, i) => this.tone(NOTE(n), NOTE(n), 0.8, 0.14, 'triangle', i * 0.12)); break;
    }
  }
}
