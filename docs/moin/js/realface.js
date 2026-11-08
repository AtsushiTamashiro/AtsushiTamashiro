// リアルおじさんの顔テクスチャ。
// 顔写真は「この端末の中だけ」に保存し、リポジトリには含めません。
//   優先順: ① 設定画面で選んだ写真(localStorage) ② assets/oyaji-face.jpg ③ 仮の描き顔
import * as THREE from 'three';

export const FACE_W = 480, FACE_H = 640;
const KEY = 'moincraft-oyaji-face';

export const realFace = {
  canvas: document.createElement('canvas'),
  tex: null, img: null, hasPhoto: false,
  zoom: 1.3, dx: 0, dy: 0,
  skinMat: new THREE.MeshLambertMaterial({ color: '#d9a584' }),
  hairColor: '#4d4944',

  init(zoom, dx, dy) {
    this.zoom = zoom ?? 1.3; this.dx = dx ?? 0; this.dy = dy ?? 0;
    this.canvas.width = FACE_W; this.canvas.height = FACE_H;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.redraw();
    // 保存済みの写真 → なければ assets の写真
    let url = null; try { url = localStorage.getItem(KEY); } catch (e) {}
    if (url) this.loadUrl(url);
    else this.loadUrl('./assets/oyaji-face.jpg', true);
  },

  loadUrl(url, quiet) {
    const im = new Image();
    im.onload = () => { this.img = im; this.hasPhoto = true; this.redraw(); this.onChange?.(); };
    im.onerror = () => { if (!quiet) { this.img = null; this.hasPhoto = false; this.redraw(); } };
    im.src = url;
  },

  // 選んだ画像ファイルを縮小して保存
  async setFile(file) {
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 720 / Math.max(im.width, im.height));
    const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const small = c.toDataURL('image/jpeg', 0.86);
    try { localStorage.setItem(KEY, small); } catch (e) { /* 保存できなくても今回は使える */ }
    this.loadUrl(small);
  },
  clear() { try { localStorage.removeItem(KEY); } catch (e) {} this.img = null; this.hasPhoto = false; this.redraw(); this.loadUrl('./assets/oyaji-face.jpg', true); this.onChange?.(); },

  redraw() {
    const c = this.canvas, x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = this.hairColor; x.fillRect(0, 0, FACE_W, FACE_H);
    if (this.img) this.drawPhoto(x); else this.drawFallback(x);
    if (this.tex) this.tex.needsUpdate = true;
  },

  drawPhoto(x) {
    const t = document.createElement('canvas'); t.width = FACE_W; t.height = FACE_H;
    const g = t.getContext('2d'), im = this.img;
    const s = Math.max(FACE_W / im.width, FACE_H / im.height) * this.zoom;
    g.drawImage(im, FACE_W / 2 - im.width * s / 2 + this.dx * FACE_W, FACE_H / 2 - im.height * s / 2 + this.dy * FACE_H, im.width * s, im.height * s);
    // 頬の色から肌の色を決める(耳・首・手に使う)
    try {
      let r = 0, gg = 0, b = 0, n = 0;
      for (const px of [0.3, 0.7]) { const d = g.getImageData(FACE_W * px - 12, FACE_H * 0.56, 24, 24).data; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
      this.skinMat.color.setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
    } catch (e) {}
    // 楕円のふちをぼかして、髪色の頭にじんわりなじませる
    g.globalCompositeOperation = 'destination-in';
    const rx = FACE_W * 0.47, ry = FACE_H * 0.5;
    g.translate(FACE_W / 2, FACE_H / 2); g.scale(1, ry / rx);
    const grad = g.createRadialGradient(0, 0, rx * 0.62, 0, 0, rx);
    grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(-rx, -rx * (FACE_H / FACE_W) * 1.2, rx * 2, rx * 2.6);
    x.drawImage(t, 0, 0);
  },

  // 写真がないときの仮の顔(中年男性ふうの描き顔)
  drawFallback(x) {
    const skin = '#d6a07f'; this.skinMat.color.set(skin);
    const cx = FACE_W / 2;
    // 顔
    const grad = x.createRadialGradient(cx, FACE_H * 0.5, 40, cx, FACE_H * 0.5, 250);
    grad.addColorStop(0, '#e2b393'); grad.addColorStop(0.75, skin); grad.addColorStop(1, '#b98466');
    x.fillStyle = grad; x.beginPath(); x.ellipse(cx, FACE_H * 0.5, FACE_W * 0.41, FACE_H * 0.46, 0, 0, Math.PI * 2); x.fill();
    // 髪(生えぎわが少し後退)
    x.fillStyle = this.hairColor; x.beginPath();
    x.moveTo(cx - 200, FACE_H * 0.4); x.quadraticCurveTo(cx - 205, FACE_H * 0.1, cx, FACE_H * 0.06);
    x.quadraticCurveTo(cx + 205, FACE_H * 0.1, cx + 200, FACE_H * 0.4);
    x.quadraticCurveTo(cx + 175, FACE_H * 0.2, cx + 90, FACE_H * 0.2); x.quadraticCurveTo(cx, FACE_H * 0.26, cx - 90, FACE_H * 0.2);
    x.quadraticCurveTo(cx - 175, FACE_H * 0.2, cx - 200, FACE_H * 0.4); x.fill();
    // 白髪まじり
    x.strokeStyle = 'rgba(210,210,210,.5)'; x.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const a = Math.random() * 2 - 1, px = cx + a * 185, py = FACE_H * (0.1 + Math.random() * 0.08); x.beginPath(); x.moveTo(px, py); x.lineTo(px + a * 14, py + 22); x.stroke(); }
    // 眉
    x.fillStyle = '#3a3330';
    for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(cx + sx * 40, FACE_H * 0.4); x.quadraticCurveTo(cx + sx * 100, FACE_H * 0.355, cx + sx * 165, FACE_H * 0.39); x.quadraticCurveTo(cx + sx * 100, FACE_H * 0.375, cx + sx * 40, FACE_H * 0.425); x.fill(); }
    // 目
    for (const sx of [-1, 1]) {
      const ex = cx + sx * 88, ey = FACE_H * 0.46;
      x.fillStyle = '#f3ede4'; x.beginPath(); x.ellipse(ex, ey, 38, 17, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#4a3322'; x.beginPath(); x.arc(ex, ey, 14, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#111'; x.beginPath(); x.arc(ex, ey, 7, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(ex - 5, ey - 5, 3.5, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(90,50,40,.7)'; x.lineWidth = 3; x.beginPath(); x.ellipse(ex, ey, 40, 19, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
      x.strokeStyle = 'rgba(120,70,55,.45)'; x.lineWidth = 2; x.beginPath(); x.ellipse(ex, ey + 20, 34, 9, 0, 0.1, Math.PI - 0.1); x.stroke(); // 目の下のたるみ
    }
    // 鼻
    x.strokeStyle = 'rgba(120,70,55,.55)'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx - 12, FACE_H * 0.48); x.quadraticCurveTo(cx - 24, FACE_H * 0.6, cx - 30, FACE_H * 0.625); x.quadraticCurveTo(cx, FACE_H * 0.65, cx + 30, FACE_H * 0.625); x.stroke();
    x.fillStyle = 'rgba(90,40,30,.5)'; x.beginPath(); x.ellipse(cx - 17, FACE_H * 0.63, 7, 4, 0, 0, 7); x.ellipse(cx + 17, FACE_H * 0.63, 7, 4, 0, 0, 7); x.fill();
    // ほうれい線
    x.strokeStyle = 'rgba(130,80,60,.4)'; x.lineWidth = 3;
    for (const sx of [-1, 1]) { x.beginPath(); x.moveTo(cx + sx * 48, FACE_H * 0.62); x.quadraticCurveTo(cx + sx * 75, FACE_H * 0.7, cx + sx * 70, FACE_H * 0.78); x.stroke(); }
    // 無精ひげ
    for (let i = 0; i < 1400; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()), px = cx + Math.cos(a) * r * 175, py = FACE_H * 0.5 + Math.sin(a) * r * 270;
      if (py < FACE_H * 0.64) continue; x.fillStyle = `rgba(50,40,36,${0.12 + Math.random() * 0.2})`; x.fillRect(px, py, 2, 2);
    }
    // 口(にっこり)
    x.fillStyle = '#9a5a4c'; x.beginPath(); x.moveTo(cx - 62, FACE_H * 0.74); x.quadraticCurveTo(cx, FACE_H * 0.8, cx + 62, FACE_H * 0.74); x.quadraticCurveTo(cx, FACE_H * 0.765, cx - 62, FACE_H * 0.74); x.fill();
    x.fillStyle = '#f4efe6'; x.beginPath(); x.moveTo(cx - 48, FACE_H * 0.7435); x.quadraticCurveTo(cx, FACE_H * 0.78, cx + 48, FACE_H * 0.7435); x.quadraticCurveTo(cx, FACE_H * 0.758, cx - 48, FACE_H * 0.7435); x.fill();
  },
};
