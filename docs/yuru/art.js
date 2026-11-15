// ゆるっと!ご当地バトル — キャラクターの絵(SVGをパーツから組み立てる)
// LOOKS で キャラごとに「からだの形・耳・目・口・ぼうし・小物・もよう」を指定する。
(function () {
  const INK = '#5B3A4A', W = '#FFFFFF', GOLD = '#FFD34E', PINK = '#FF8FB1';
  const ST = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
  const E = (cx, cy, rx, ry, f, rot, ex = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}${ex}/>`;
  const C = (cx, cy, r, f, ex = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"${ex}/>`;
  const P = (d, f, ex = '') => `<path d="${d}" fill="${f}"${ex}/>`;
  const L = (d, col = INK, w = 3.5) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const sp = ` ${ST}`;
  function mix(hex, w, t) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(w.slice(1), 16);
    const r = (x, y) => Math.round(x + (y - x) * t);
    return '#' + [r(a >> 16, b >> 16), r((a >> 8) & 255, (b >> 8) & 255), r(a & 255, b & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // ---------- からだの形 ----------
  // fx,fy: 顔の中心 / top: 頭のてっぺん / hw: 頭の半分の幅 / ex,ey: 耳の位置 / neck: 首の高さ
  const SHAPES = {
    blob: b => ({ body: [E(100, 152, 46, 36, b), E(100, 94, 72, 60, b)], fx: 100, fy: 104, top: 34, hw: 72, ex: 52, ey: 50, neck: 142, arms: [[54, 148, 35], [146, 148, -35]], feet: [[80, 183], [120, 183]], belly: [100, 162, 27, 19] }),
    ball: b => ({ body: [E(100, 120, 78, 70, b)], fx: 100, fy: 112, top: 50, hw: 74, ex: 50, ey: 64, neck: 160, arms: [[26, 140, 55], [174, 140, -55]], feet: [[72, 187], [128, 187]], belly: [100, 156, 40, 26] }),
    egg: b => ({ body: [E(100, 110, 60, 80, b)], fx: 100, fy: 96, top: 30, hw: 60, ex: 40, ey: 44, neck: 134, arms: [[42, 140, 30], [158, 140, -30]], feet: [[80, 188], [120, 188]], belly: [100, 152, 34, 28] }),
    tri: b => ({ body: [P('M100 24 Q114 24 122 38 L176 148 Q186 180 156 182 L44 182 Q14 180 24 148 L78 38 Q86 24 100 24 Z', b)], fx: 100, fy: 126, top: 24, hw: 50, ex: 30, ey: 62, neck: 168, arms: [[30, 152, 40], [170, 152, -40]], feet: [[74, 188], [126, 188]], belly: null }),
    square: b => ({ body: [`<rect x="24" y="30" width="152" height="154" rx="50" fill="${b}"/>`], fx: 100, fy: 102, top: 30, hw: 70, ex: 54, ey: 40, neck: 146, arms: [[24, 140, 30], [176, 140, -30]], feet: [[76, 188], [124, 188]], belly: [100, 156, 38, 20] }),
    cup: b => ({ body: [P('M28 46 Q28 30 46 30 L154 30 Q172 30 172 46 L162 160 Q158 186 132 186 L68 186 Q42 186 38 160 Z', b)], fx: 100, fy: 100, top: 30, hw: 68, ex: 54, ey: 38, neck: 150, arms: [[30, 128, 30], [170, 128, -30]], feet: [[76, 190], [124, 190]], belly: null }),
    daruma: b => ({ body: [E(100, 116, 76, 78, b)], fx: 100, fy: 102, top: 38, hw: 70, ex: 50, ey: 50, neck: 160, arms: [], feet: [], belly: null }),
    drop: b => ({ body: [P('M100 12 Q122 50 160 96 Q188 140 160 172 Q132 194 100 192 Q68 194 40 172 Q12 140 40 96 Q78 50 100 12 Z', b)], fx: 100, fy: 130, top: 12, hw: 56, ex: 42, ey: 84, neck: 168, arms: [[30, 152, 40], [170, 152, -40]], feet: [[78, 192], [122, 192]], belly: [100, 166, 34, 18] }),
    fruit: b => ({ body: [P('M100 50 Q132 22 166 46 Q194 76 182 126 Q170 180 124 186 Q110 188 100 180 Q90 188 76 186 Q30 180 18 126 Q6 76 34 46 Q68 22 100 50 Z', b)], fx: 100, fy: 116, top: 42, hw: 76, ex: 48, ey: 52, neck: 164, arms: [[20, 132, 45], [180, 132, -45]], feet: [[74, 190], [126, 190]], belly: null }),
    wide: b => ({ body: [E(100, 128, 88, 56, b)], fx: 100, fy: 122, top: 72, hw: 80, ex: 56, ey: 84, neck: 168, arms: [[14, 142, 65], [186, 142, -65]], feet: [[70, 184], [130, 184]], belly: [100, 154, 52, 18] }),
    berry: b => ({ body: [P('M100 192 Q58 182 30 122 Q14 82 40 58 Q70 36 100 46 Q130 36 160 58 Q186 82 170 122 Q142 182 100 192 Z', b)], fx: 100, fy: 100, top: 44, hw: 70, ex: 52, ey: 56, neck: 150, arms: [[30, 116, 45], [170, 116, -45]], feet: [], belly: null }),
    grape: b => {
      const g = [[66, 62], [100, 56], [134, 62], [46, 98], [82, 94], [118, 94], [154, 98], [62, 132], [100, 130], [138, 132], [80, 164], [120, 164], [100, 190]];
      return { body: g.map(([x, y]) => C(x, y, 25, b)), fx: 100, fy: 108, top: 32, hw: 72, ex: 46, ey: 42, neck: 160, arms: [], feet: [], belly: null };
    },
    peanut: b => ({ body: [E(100, 142, 58, 46, b), E(100, 82, 54, 50, b)], fx: 100, fy: 88, top: 32, hw: 54, ex: 38, ey: 42, neck: 128, arms: [[44, 146, 30], [156, 146, -30]], feet: [[80, 188], [120, 188]], belly: null }),
    bowl: b => ({ body: [E(100, 92, 74, 50, b)], front: [P('M14 104 L186 104 Q184 176 112 182 L88 182 Q16 176 14 104 Z', '#E86A6A'), `<rect x="70" y="178" width="60" height="12" rx="4" fill="#C9504F"/>`], fx: 100, fy: 90, top: 42, hw: 70, ex: 52, ey: 56, neck: 104, arms: [[14, 116, 60], [186, 116, -60]], feet: [], belly: null }),
    disc: b => ({ body: [C(100, 112, 80, b)], fx: 100, fy: 104, top: 32, hw: 76, ex: 52, ey: 48, neck: 170, arms: [[22, 136, 55], [178, 136, -55]], feet: [[74, 192], [126, 192]], belly: null }),
    cherry: b => ({ body: [E(46, 150, 30, 28, b), E(114, 122, 66, 62, b)], fx: 114, fy: 120, top: 60, hw: 62, ex: 46, ey: 70, neck: 170, arms: [[178, 136, -50]], feet: [[96, 186], [132, 186]], belly: null }),
  };

  // ---------- 耳(左右対称) X,Y=付け根 o=-1左 +1右 ----------
  function ear(t, X, Y, o, body, acc) {
    const inner = '#FFB7CC', dark = mix(body, INK, 0.2);
    const kp = (pts, cx, cy, k) => pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
    const catD = (k, dy = 0) => {
      const cx = X + o * 2, cy = Y + 4;
      const [a, b2, c, d, e] = kp([[X - o * 20, Y + 14], [X - o * 8, Y - 20], [X + o * 4, Y - 32], [X + o * 20, Y - 14], [X + o * 22, Y + 20]], cx, cy, k);
      return `M${a[0]} ${a[1] + dy} Q${b2[0]} ${b2[1] + dy} ${c[0]} ${c[1] + dy} Q${d[0]} ${d[1] + dy} ${e[0]} ${e[1] + dy} Z`;
    };
    switch (t) {
      case 'bear': return { s: [C(X, Y, 21, body)], d: [C(X, Y + 2, 11, inner)] };
      case 'cat': return { s: [P(catD(1), body)], d: [P(catD(0.5, 4), inner)] };
      case 'squirrel': return { s: [P(catD(1.1), body), L(`M${X + o * 4} ${Y - 34} q${o * 4} -10 ${o * 12} -12`, acc, 6)], d: [P(catD(0.5, 4), inner)] };
      case 'bunny': return { s: [E(X + o * 6, Y - 24, 14, 36, body, o * 10)], d: [E(X + o * 6, Y - 22, 7, 26, inner, o * 10)] };
      case 'dog': return { s: [E(X + o * 18, Y + 38, 17, 32, dark, -o * 18)], d: [] };
      case 'round': return { s: [C(X, Y, 14, body)], d: [C(X, Y + 1, 7, inner)] };
      case 'oni': return { s: [P(`M${X - 9} ${Y + 8} L${X + o * 6} ${Y - 30} L${X + 11} ${Y + 6} Z`, '#FFE58A')], d: [] };
      case 'cow': return { s: [E(X + o * 26, Y + 22, 19, 9, body, -o * 18), P(`M${X - 6} ${Y + 4} Q${X + o * 4} ${Y - 26} ${X + o * 14} ${Y - 22} Q${X + o * 8} ${Y - 8} ${X + 8} ${Y + 6} Z`, '#FFE58A')], d: [E(X + o * 28, Y + 22, 11, 4.5, inner, -o * 18)] };
      case 'horse': return { s: [E(X, Y - 14, 11, 24, body, o * 16)], d: [E(X, Y - 12, 5, 15, inner, o * 16)] };
      case 'fin': return { s: [E(X + o * 40, Y + 46, 15, 9, acc, o * 28)], d: [] };
      case 'deer': return {
        s: [L(`M${X} ${Y} Q${X + o * 4} ${Y - 26} ${X - o * 4} ${Y - 44} M${X + o * 2} ${Y - 22} Q${X + o * 14} ${Y - 30} ${X + o * 18} ${Y - 42}`, '#C79565', 7), E(X + o * 18, Y + 18, 17, 9, body, o * 22)],
        d: [E(X + o * 18, Y + 18, 9, 4, inner, o * 22)],
      };
      default: return { s: [], d: [] };
    }
  }

  // ---------- ぼうし(頭の上にのせる。blob の頭 = 中心100, てっぺん34, 半幅72 を基準に描く) ----------
  function hat(t, k) {
    const g = k.acc;
    switch (t) {
      case 'knit': return P('M36 68 Q34 4 100 2 Q166 4 164 68 Z', k.hc || '#FF9DB8', sp) + P('M30 60 Q100 44 170 60 L172 76 Q100 60 28 76 Z', W, sp) + L('M70 30 L72 50 M100 20 L100 46 M130 30 L128 50', mix(k.hc || '#FF9DB8', INK, .25), 3) + C(100, -2, 13, W, sp);
      case 'kabuto': return P('M28 78 Q28 16 100 14 Q172 16 172 78 Q100 58 28 78 Z', '#4A4F80', sp) + P('M40 -6 Q100 70 160 -6 Q100 44 40 -6 Z', GOLD, sp) + C(100, 46, 7, GOLD, sp);
      case 'bowlhat': return P('M62 42 Q62 4 100 2 Q138 4 138 42 Z', '#E0504B', sp) + P('M56 38 L144 38 L142 48 L58 48 Z', '#3B2A2A', sp) + L('M72 20 Q100 12 128 20', '#FFD38A', 2.5);
      case 'crown': return P('M64 46 L58 4 L82 24 L100 -4 L118 24 L142 4 L136 46 Z', GOLD, sp) + C(100, 32, 6, '#FF7BA9', sp) + C(77, 36, 4, '#8FDCC4', sp) + C(123, 36, 4, '#A9DCFF', sp);
      case 'leaf': return L('M100 40 Q96 22 102 8', '#7A5A3A', 6) + P('M102 14 Q128 -6 146 10 Q126 32 102 14 Z', '#8EDB7F', sp) + L('M108 14 Q124 10 136 10', '#5DAE55', 2);
      case 'vine': return L('M100 34 Q98 18 104 8', '#7A5A3A', 6) + P('M104 12 Q92 -14 120 -12 Q140 -8 134 10 Q128 26 104 12 Z', '#8EDB7F', sp) + L('M86 26 q-14 -4 -10 -14 q4 -8 12 -2', '#7DBF6A', 3);
      case 'calyx': return [-160, -125, -90, -55, -20].map(a => { const r = a * Math.PI / 180; return E(100 + Math.cos(r) * 20, 50 + Math.sin(r) * 12, 18, 8, '#7DD87D', a, sp); }).join('') + L('M100 40 L100 22', '#5DAE55', 6);
      case 'hachimaki': return P('M26 72 Q100 46 174 72 L174 88 Q100 62 26 88 Z', k.hc || W, sp) + (k.hm ? C(100, 62, 8, k.hm, sp) : '') + P('M170 76 Q194 64 198 80 Q186 82 172 84 Z', k.hc || W, sp) + P('M168 82 Q188 96 182 110 Q174 96 164 88 Z', k.hc || W, sp);
      case 'nejiri': return P('M26 72 Q100 46 174 72 L174 88 Q100 62 26 88 Z', W, sp) + L('M40 74 l8 -8 M62 66 l8 -8 M86 60 l8 -8 M110 58 l8 -8 M134 62 l8 -8 M156 68 l8 -8', '#3F7CC8', 4) + P('M168 76 Q196 70 194 88 Q182 86 170 86 Z', W, sp);
      case 'castle': return `<rect x="74" y="20" width="52" height="22" fill="${W}" ${ST}/>` + P('M62 24 L138 24 L122 8 L78 8 Z', '#6EA592', sp) + `<rect x="86" y="-4" width="28" height="12" fill="${W}" ${ST}/>` + P('M78 -2 L122 -2 L110 -16 L90 -16 Z', '#6EA592', sp) + C(90, -16, 3, GOLD) + C(110, -16, 3, GOLD) + `<rect x="94" y="28" width="12" height="14" fill="#5B3A4A"/>`;
      case 'tower': return P('M90 42 L100 -34 L110 42 Z', '#FF8A8A', sp) + L('M94 18 L106 18 M96 2 L104 2 M98 -14 L102 -14', W, 4) + E(100, 10, 14, 5, '#BFE3FF', 0, sp) + C(100, -36, 6, '#FFE58A', sp);
      case 'wave': return P('M58 44 Q56 -2 104 0 Q146 4 144 34 Q132 14 112 20 Q128 30 116 44 Z', '#7EC8F2', sp) + C(122, 14, 4, W) + C(132, 22, 3, W) + C(110, 8, 3, W);
      case 'shachi': return P('M70 42 Q64 10 90 2 Q114 -4 118 16 Q124 -8 144 -14 Q138 4 128 12 Q144 14 136 30 Q120 22 112 34 Q102 48 70 42 Z', GOLD, sp) + C(82, 18, 3.5, INK) + L('M92 28 q6 4 12 0 M98 16 q6 4 12 0', '#E4A82A', 2.5);
      case 'ninja': return P('M22 98 Q22 22 100 22 Q178 22 178 98 Q178 154 100 156 Q22 154 22 98 Z M42 100 Q100 74 158 100 Q158 130 100 132 Q42 130 42 100 Z', k.hc || '#7B6AA8', `${sp} fill-rule="evenodd"`) + P('M26 92 Q2 80 -2 98 Q12 104 24 104 Z', k.hc || '#7B6AA8', sp) + P('M26 100 Q6 116 10 132 Q20 116 30 108 Z', k.hc || '#7B6AA8', sp);
      case 'maiko': return P('M26 92 Q18 12 100 8 Q182 12 174 92 Q162 48 100 46 Q38 48 26 92 Z', '#3A2A35', sp) + E(100, 2, 32, 18, '#3A2A35', 0, sp) + `<rect x="66" y="-2" width="68" height="7" rx="3" fill="#FF7BA9"/>` + C(148, 30, 9, '#FF9DC0', sp) + C(162, 42, 8, W, sp) + C(140, 46, 7, '#FFD34E', sp) + L('M154 50 L156 76 M162 52 L166 72 M146 52 L146 70', '#FF9DC0', 3) + C(156, 78, 3, '#FF9DC0') + C(166, 74, 3, W) + C(146, 72, 3, '#FFD34E');
      case 'amigasa': return P('M28 56 Q100 -28 172 56 Q100 32 28 56 Z', '#EBC98A', sp) + L('M50 40 Q100 -6 150 40 M70 26 Q100 4 130 26', '#C9A060', 2.5) + L('M40 54 Q36 76 46 92 M160 54 Q164 76 154 92', '#FF7BA9', 3);
      case 'straw': return E(100, 42, 92, 16, '#F2D58A', 0, sp) + P('M62 42 Q62 2 100 2 Q138 2 138 42 Z', '#F2D58A', sp) + P('M62 28 L138 28 L138 38 L62 38 Z', '#FF7B8C', sp);
      case 'towel': return P('M58 44 Q56 22 80 20 L122 20 Q146 22 142 44 Q100 36 58 44 Z', W, sp) + L('M70 28 L130 28 M68 36 L132 36', '#7EC8F2', 3);
      case 'momiji': return P('M100 -14 L109 10 L132 0 L122 22 L146 26 L120 36 L126 48 L100 38 L74 48 L80 36 L54 26 L78 22 L68 0 L91 10 Z', '#FF6F5E', sp) + L('M100 38 L100 52', '#C24A3E', 4) + L('M100 36 L100 0 M100 30 L120 14 M100 30 L80 14', '#E24E40', 2);
      case 'goggles': return P('M24 72 Q100 46 176 72 L176 82 Q100 58 24 82 Z', '#A0704F', sp) + C(80, 58, 15, '#BFE8FF', sp) + C(120, 58, 15, '#BFE8FF', sp) + C(76, 54, 4, W) + C(116, 54, 4, W);
      case 'bigbow': return P('M100 36 Q58 -6 50 28 Q56 60 100 36 Z', '#FF7BA9', sp) + P('M100 36 Q142 -6 150 28 Q144 60 100 36 Z', '#FF7BA9', sp) + P('M100 30 C96 22 86 26 90 34 L100 44 L110 34 C114 26 104 22 100 30 Z', W, sp);
      case 'hibiscus': return [0, 72, 144, 216, 288].map(a => { const r = (a - 90) * Math.PI / 180; return E(150 + Math.cos(r) * 12, 40 + Math.sin(r) * 12, 11, 8, '#FF6F8E', a - 90, sp); }).join('') + C(150, 40, 6, '#FFE58A', sp) + L('M150 40 l12 -10', '#FFE58A', 2.5);
      case 'eboshi': return P('M66 46 Q62 6 98 -4 Q126 -10 134 46 Z', '#4E5878', sp) + L('M72 34 Q100 26 128 34', '#8C97B8', 3);
      case 'liberty': return [-150, -125, -100, -80, -55, -30].map(a => { const r = a * Math.PI / 180; const x = 100 + Math.cos(r) * 46, y = 50 + Math.sin(r) * 34; const x2 = 100 + Math.cos(r) * 80, y2 = 50 + Math.sin(r) * 62; return P(`M${x - 7} ${y} L${x2} ${y2} L${x + 7} ${y} Z`, '#7FD3B8', sp); }).join('') + P('M50 46 Q100 18 150 46 L148 56 Q100 30 52 56 Z', '#7FD3B8', sp);
      case 'beret': return E(94, 32, 56, 17, '#E8505B', -8, sp) + C(94, 14, 5, '#E8505B', sp);
      case 'chef': return `<rect x="66" y="16" width="68" height="26" rx="6" fill="${W}" ${ST}/>` + C(74, 4, 20, W, sp) + C(100, -8, 24, W, sp) + C(126, 4, 20, W, sp) + `<rect x="68" y="18" width="64" height="20" fill="${W}"/>`;
      case 'pharaoh': return P('M24 112 Q12 28 100 20 Q188 28 176 112 L188 176 L148 158 Q158 104 150 72 Q100 52 50 72 Q42 104 52 158 L12 176 Z', GOLD, sp) + L('M22 132 L48 128 M20 150 L50 146 M152 128 L178 132 M150 146 L180 150 M40 52 Q100 26 160 52', '#5A8FE0', 6) + P('M92 28 Q100 10 108 28 Q104 36 100 32 Q96 36 92 28 Z', '#5A8FE0', sp);
      case 'feathers': return ['#FF6F8E', '#FFD34E', '#7DD87D', '#6EC1FF', '#B9A8FF', '#FF9C6E', '#FF6F8E'].map((col, i) => { const a = -160 + i * 23.3, r = a * Math.PI / 180; return E(100 + Math.cos(r) * 46, 40 + Math.sin(r) * 40, 10, 26, col, a + 90, sp); }).join('') + P('M44 50 Q100 24 156 50 L154 60 Q100 36 46 60 Z', GOLD, sp);
      case 'wara': return P('M84 44 L70 0 L84 6 L92 -6 L100 4 L108 -6 L116 6 L130 0 L116 44 Z', '#E8D08A', sp) + `<rect x="80" y="26" width="40" height="8" rx="3" fill="#B58A4A" ${ST}/>`;
      case 'momotaro': return P('M26 72 Q100 46 174 72 L174 88 Q100 62 26 88 Z', W, sp) + P('M100 50 Q88 52 90 64 Q94 74 100 70 Q106 74 110 64 Q112 52 100 50 Z', '#FFA6B6', sp) + P('M100 50 q6 -8 14 -6 q-4 8 -14 6', '#7DD87D') + P('M170 76 Q194 64 198 80 Q186 82 172 84 Z', W, sp);
      case 'magma': return '';
      default: return '';
    }
  }
  const UNDER_HATS = ['ninja', 'maiko', 'pharaoh'];

  // ---------- 目 ----------
  function eyes(t, fx, y, dx, acc) {
    const xs = [fx - dx, fx + dx];
    const big = x => E(x, y, 7.5, 10, INK) + C(x - 2.6, y - 3.8, 3.2, W) + C(x + 2.4, y + 3.4, 1.4, W);
    const arcUp = x => L(`M${x - 8} ${y + 3} Q${x} ${y - 9} ${x + 8} ${y + 3}`, INK, 4.5);
    switch (t) {
      case 'dot': return xs.map(x => E(x, y, 5, 6.5, INK) + C(x - 1.6, y - 2.2, 1.9, W)).join('');
      case 'happy': return xs.map(arcUp).join('');
      case 'sleepy': return xs.map(x => L(`M${x - 8} ${y} Q${x} ${y + 7} ${x + 8} ${y}`, INK, 4)).join('');
      case 'round': return xs.map(x => C(x, y, 11, W, sp) + C(x + 1.5, y + 1.5, 5.5, INK) + C(x, y - .5, 1.8, W)).join('');
      case 'sparkle': return xs.map(x => E(x, y, 8.5, 11.5, INK) + E(x, y + 4, 6, 6, mix(acc, INK, .1)) + P(`M${x - 3} ${y - 9} l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6 Z`, W) + C(x + 3, y + 5, 1.6, W)).join('');
      case 'lash': return xs.map((x, i) => big(x) + L(i ? `M${x + 6} ${y - 6} l6 -4 M${x + 7} ${y - 1} l7 -1` : `M${x - 6} ${y - 6} l-6 -4 M${x - 7} ${y - 1} l-7 -1`, INK, 2.6)).join('');
      case 'liner': return xs.map((x, i) => big(x) + L(i ? `M${x - 8} ${y - 8} Q${x + 4} ${y - 14} ${x + 16} ${y - 6}` : `M${x + 8} ${y - 8} Q${x - 4} ${y - 14} ${x - 16} ${y - 6}`, INK, 3.2)).join('');
      case 'wink': return big(xs[0]) + arcUp(xs[1]);
      case 'sharp': return xs.map((x, i) => big(x) + L(i ? `M${x - 9} ${y - 16} L${x + 9} ${y - 19}` : `M${x + 9} ${y - 16} L${x - 9} ${y - 19}`, INK, 4)).join('');
      case 'heart': return xs.map(x => P(`M${x} ${y + 9} L${x - 9} ${y} Q${x - 13} ${y - 8} ${x - 6} ${y - 10} Q${x - 1} ${y - 10} ${x} ${y - 5} Q${x + 1} ${y - 10} ${x + 6} ${y - 10} Q${x + 13} ${y - 8} ${x + 9} ${y} Z`, '#FF6F8E', ` stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`) + C(x - 5, y - 5, 2, W)).join('');
      case 'sour': return L(`M${xs[0] - 7} ${y - 7} L${xs[0] + 6} ${y} L${xs[0] - 7} ${y + 7}`, INK, 4.2) + L(`M${xs[1] + 7} ${y - 7} L${xs[1] - 6} ${y} L${xs[1] + 7} ${y + 7}`, INK, 4.2);
      case 'star': return xs.map(x => P(`M${x} ${y - 11} L${x + 3.4} ${y - 3.5} L${x + 11} ${y - 3} L${x + 5} ${y + 2.5} L${x + 7} ${y + 10} L${x} ${y + 6} L${x - 7} ${y + 10} L${x - 5} ${y + 2.5} L${x - 11} ${y - 3} L${x - 3.4} ${y - 3.5} Z`, INK)).join('');
      case 'shades': return P(`M${fx - dx - 16} ${y - 9} L${fx - 6} ${y - 9} Q${fx - 6} ${y + 10} ${fx - dx - 2} ${y + 10} Q${fx - dx - 16} ${y + 10} ${fx - dx - 16} ${y - 9} Z`, '#3E3550', sp) + P(`M${fx + dx + 16} ${y - 9} L${fx + 6} ${y - 9} Q${fx + 6} ${y + 10} ${fx + dx + 2} ${y + 10} Q${fx + dx + 16} ${y + 10} ${fx + dx + 16} ${y - 9} Z`, '#3E3550', sp) + L(`M${fx - 6} ${y - 6} L${fx + 6} ${y - 6}`, INK, 3.5) + L(`M${fx - dx - 10} ${y - 4} l6 0 M${fx + dx - 2} ${y - 4} l6 0`, '#FF9DC0', 3);
      default: return xs.map(big).join('');
    }
  }
  // ---------- 口 ----------
  function mouth(t, x, y) {
    switch (t) {
      case 'cat': return L(`M${x - 9} ${y - 2} Q${x - 4.5} ${y + 5} ${x} ${y - 1} Q${x + 4.5} ${y + 5} ${x + 9} ${y - 2}`, INK, 3.5);
      case 'small': return L(`M${x - 5} ${y} Q${x} ${y + 5} ${x + 5} ${y}`, INK, 3.5);
      case 'open': return P(`M${x - 11} ${y - 2} Q${x} ${y - 4} ${x + 11} ${y - 2} Q${x + 8} ${y + 14} ${x} ${y + 14} Q${x - 8} ${y + 14} ${x - 11} ${y - 2} Z`, '#C9405A', sp) + E(x, y + 9, 6, 4, '#FF8FA0');
      case 'fang': return L(`M${x - 10} ${y - 2} Q${x - 5} ${y + 5} ${x} ${y - 1} Q${x + 5} ${y + 5} ${x + 10} ${y - 2}`, INK, 3.5) + P(`M${x + 3} ${y + 1} L${x + 6} ${y + 9} L${x + 8.5} ${y + 1} Z`, W, ` stroke="${INK}" stroke-width="2" stroke-linejoin="round"`);
      case 'o': return E(x, y + 3, 5, 6, '#C9405A', 0, sp);
      case 'tongue': return P(`M${x - 2} ${y + 1} Q${x - 3} ${y + 13} ${x + 4} ${y + 12} Q${x + 9} ${y + 10} ${x + 7} ${y + 1} Z`, '#FF7B8C', sp) + L(`M${x - 10} ${y - 1} Q${x} ${y + 5} ${x + 10} ${y - 1}`, INK, 3.5);
      case 'grin': return P(`M${x - 14} ${y - 3} Q${x} ${y} ${x + 14} ${y - 3} Q${x + 10} ${y + 12} ${x} ${y + 12} Q${x - 10} ${y + 12} ${x - 14} ${y - 3} Z`, W, sp) + L(`M${x - 12} ${y + 2} Q${x} ${y + 5} ${x + 12} ${y + 2}`, INK, 2);
      case 'beak': return P(`M${x - 12} ${y - 4} Q${x} ${y - 10} ${x + 12} ${y - 4} L${x} ${y + 10} Z`, '#FFB84E', sp) + L(`M${x - 10} ${y - 2} L${x + 10} ${y - 2}`, INK, 2);
      case 'lips': return E(x, y + 2, 5, 3.5, '#E8405A');
      case 'none': return '';
      default: return P(`M${x - 8} ${y} Q${x} ${y + 10} ${x + 8} ${y} Q${x} ${y + 3} ${x - 8} ${y} Z`, '#FF7B8C', ` stroke="${INK}" stroke-width="3" stroke-linejoin="round"`);
    }
  }

  // ---------- 小物・もよう ----------
  function extras(list, k, sh) {
    const back = [], pat = [], front = [], under = [];
    const b = k.body, acc = k.acc, n = sh.neck, fx = sh.fx, fy = sh.fy;
    for (const x of list) switch (x) {
      // 輪郭の内側(後ろ)にくっつく形
      case 'mane': {
        const cx = fx, cy = sh.top + (fy - sh.top) * .95, rx = sh.hw + 4, ry = (fy - sh.top) + 8;
        for (let a = 140; a <= 400; a += 26) { const r = a * Math.PI / 180; back.push(C(cx + Math.cos(r) * rx, cy + Math.sin(r) * ry, 19, k.mc || acc)); }
        break;
      }
      case 'tentacles': [44, 70, 100, 130, 156].forEach((x, i) => back.push(E(x, 180, 10, 18, k.tc || b, (i - 2) * 16))); break;
      case 'tail': back.push(P('M140 172 Q192 172 198 128 Q178 150 140 140 Z', b)); break;
      case 'bushytail': back.push(P('M136 176 Q200 176 194 110 Q190 64 148 74 Q178 96 164 128 Q154 152 128 152 Z', k.tlc || acc)); break;
      case 'wings': back.push(E(26, 128, 15, 32, k.wc || acc, 35), E(174, 128, 15, 32, k.wc || acc, -35)); break;
      case 'humps': back.push(E(74, 44, 22, 18, b), E(124, 36, 24, 20, b)); break;
      case 'spikes': for (let a = 0; a < 360; a += 30) { const r = a * Math.PI / 180, cx = 100 + Math.cos(r) * 74, cy = 120 + Math.sin(r) * 66; back.push(P(`M${cx + Math.cos(r + 1.6) * 9} ${cy + Math.sin(r + 1.6) * 9} L${cx + Math.cos(r) * 22} ${cy + Math.sin(r) * 22} L${cx + Math.cos(r - 1.6) * 9} ${cy + Math.sin(r - 1.6) * 9} Z`, mix(b, INK, .12))); } break;
      case 'squidhead': back.push(P('M40 70 L100 -10 L160 70 Z', b)); break;
      case 'dinospikes': back.push(P('M70 40 L80 10 L94 34 Z', acc), P('M90 32 L102 0 L114 32 Z', acc), P('M108 34 L122 10 L132 40 Z', acc), P('M130 46 L148 26 L150 56 Z', acc)); break;
      case 'shrimptail': back.push(P('M150 170 Q176 176 196 160 Q190 182 176 186 Q186 196 168 198 Q160 186 146 180 Z', acc)); break;
      case 'dorsal': back.push(P(`M70 ${sh.top + 6} Q96 ${sh.top - 30} 134 ${sh.top + 4} Z`, acc)); break;
      case 'stems': back.push(L('M46 124 Q60 70 96 40 M100 62 Q100 50 96 40', '#7A9A4A', 6), P('M96 40 Q118 18 140 30 Q120 50 96 40 Z', '#8EDB7F')); break;
      // 体のもよう(体のかたちで切り抜く)
      case 'spots': [[62, 70, 15, 11], [140, 132, 16, 12], [126, 50, 11, 8], [66, 160, 12, 9], [162, 92, 10, 13], [96, 172, 10, 7]].forEach(([x, y, rx, ry]) => pat.push(E(x, y, rx, ry, k.sc || INK, 20, k.sc ? '' : ' opacity=".75"'))); break;
      case 'seeds': for (let y = 70; y < 190; y += 22) for (let x = 30 + (y % 44 ? 11 : 0); x < 175; x += 24) if (Math.hypot(x - fx, y - fy) > 34) pat.push(E(x, y, 2.6, 4, '#FFE58A')); break;
      case 'pores': for (let y = 44; y < 196; y += 16) for (let x = 20 + (y % 32 ? 8 : 0); x < 185; x += 17) if (Math.hypot(x - fx, y - fy) > 38) pat.push(C(x, y, 2, mix(b, INK, .14))); break;
      case 'net': for (let y = 30; y < 200; y += 16) pat.push(L(`M10 ${y} L190 ${y + 20}`, mix(b, INK, .14), 2.5)); for (let x = 20; x < 200; x += 18) pat.push(L(`M${x} 20 L${x - 14} 200`, mix(b, INK, .14), 2.5)); break;
      case 'stripes': for (let y = 132; y < 200; y += 16) pat.push(`<rect x="0" y="${y}" width="200" height="7" fill="${k.stc || '#5A7AC8'}"/>`); break;
      case 'scales': for (let y = 132; y < 190; y += 14) for (let x = 20 + (y % 28 ? 9 : 0); x < 190; x += 18) pat.push(L(`M${x - 8} ${y} Q${x} ${y + 9} ${x + 8} ${y}`, mix(b, INK, .2), 2.4)); break;
      case 'glow': [[50, 70], [150, 76], [40, 128], [160, 136], [76, 168], [126, 172], [100, 40]].forEach(([x, y]) => pat.push(C(x, y, 9, '#7FE8FF', ' opacity=".45"'), C(x, y, 4, '#4FC8F0'))); break;
      case 'rice': for (let y = 50; y < 160; y += 14) for (let x = 40 + (y % 28 ? 7 : 0); x < 165; x += 15) if (Math.hypot(x - fx, y - fy + 4) > 36) pat.push(E(x, y, 3.2, 5, 'none', (x * 7) % 90 - 45, ` stroke="#E5DCCB" stroke-width="1.6"`)); break;
      case 'nori': pat.push(`<rect x="58" y="${fy + 26}" width="84" height="80" fill="#2F3B33"/>`, L(`M64 ${fy + 34} L136 ${fy + 34}`, '#4D5E50', 2)); break;
      case 'sauce': pat.push(P('M0 0 L200 0 L200 82 Q186 96 176 80 Q166 104 152 82 Q140 98 128 80 Q114 102 100 82 Q86 100 74 80 Q60 102 48 82 Q36 96 24 80 Q12 92 0 82 Z', '#8A4A2A'), L('M30 64 l10 -8 10 8 10 -8 10 8 10 -8 10 8 10 -8 10 8 10 -8 10 8 10 -8 10 8 10 -8', '#FFF8E0', 3.5), C(64, 56, 2.5, '#5DAE55'), C(110, 52, 2.5, '#5DAE55'), C(140, 62, 2.5, '#5DAE55'), C(84, 70, 2.5, '#5DAE55')); break;
      case 'magma': pat.push(P('M60 40 L140 40 L140 62 Q128 74 120 60 Q110 78 100 62 Q88 76 80 60 Q70 72 60 62 Z', '#FF8A5C')); break;
      case 'castella': pat.push(`<rect x="0" y="0" width="200" height="54" fill="#B8733E"/>`, `<rect x="0" y="176" width="200" height="20" fill="#F5E9D0"/>`); break;
      case 'akabeko': pat.push(C(54, 150, 9, GOLD), C(146, 150, 9, GOLD), C(72, 176, 6, W), C(128, 176, 6, W), C(100, 182, 7, GOLD)); break;
      case 'peachline': pat.push(L('M100 52 Q90 80 96 104', mix(b, INK, .22), 3)); break;
      case 'noodles': for (let y = 58; y < 104; y += 9) pat.push(L(`M20 ${y} q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0`, mix(b, '#C9A060', .35), 2)); break;
      case 'facepatch': under.push(E(fx, fy - 2, 52, 44, k.fp || '#FFF6EC')); break;
      case 'shine': front.push(E(fx - sh.hw * .55, sh.top + 26, 10, 16, W, 35, ' opacity=".75"')); break;
      // 顔の上にのる小物
      case 'bell': front.push(L(`M58 ${n} Q100 ${n + 16} 142 ${n}`, '#E8505B', 7), C(100, n + 14, 8, GOLD, sp), L(`M96 ${n + 16} L104 ${n + 16}`, INK, 2)); break;
      case 'scarf': front.push(P(`M54 ${n - 6} Q100 ${n + 14} 146 ${n - 6} L150 ${n + 8} Q100 ${n + 30} 50 ${n + 8} Z`, k.scc || acc, sp), P(`M120 ${n + 16} L136 ${n + 44} L114 ${n + 40} Z`, k.scc || acc, sp)); break;
      case 'sailor': front.push(P(`M52 ${n - 4} L100 ${n + 30} L148 ${n - 4} L146 ${n + 12} L100 ${n + 44} L54 ${n + 12} Z`, '#4A6CC8', sp), L(`M58 ${n + 4} L100 ${n + 34} L142 ${n + 4}`, W, 2.5), P(`M92 ${n + 30} L108 ${n + 30} L100 ${n + 46} Z`, '#FF6F6F', sp)); break;
      case 'eyepatch': front.push(L(`M${fx - 70} ${fy - 22} L${fx + 70} ${fy - 4}`, INK, 3), E(fx + 24, fy - 4, 13, 12, INK)); break;
      case 'mino': front.push(P(`M40 ${n + 2} Q100 ${n + 18} 160 ${n + 2} L166 ${n + 40} L154 ${n + 30} L146 ${n + 44} L132 ${n + 32} L122 ${n + 46} L110 ${n + 34} L100 ${n + 48} L90 ${n + 34} L78 ${n + 46} L68 ${n + 32} L54 ${n + 44} L46 ${n + 30} L34 ${n + 40} Z`, '#E8D08A', sp)); break;
      case 'darumabrows': front.push(L(`M${fx - 34} ${fy - 22} Q${fx - 24} ${fy - 32} ${fx - 10} ${fy - 22}`, '#3B2A2A', 6), L(`M${fx + 34} ${fy - 22} Q${fx + 24} ${fy - 32} ${fx + 10} ${fy - 22}`, '#3B2A2A', 6), P(`M${fx - 46} ${fy - 24} Q${fx} ${fy - 60} ${fx + 46} ${fy - 24}`, 'none', ` stroke="${GOLD}" stroke-width="5" stroke-linecap="round"`)); break;
      case 'mustache': front.push(P(`M${fx} ${fy + 8} Q${fx - 10} ${fy + 2} ${fx - 20} ${fy + 8} Q${fx - 28} ${fy + 12} ${fx - 30} ${fy + 4} Q${fx - 26} ${fy + 20} ${fx - 12} ${fy + 16} Q${fx - 4} ${fy + 14} ${fx} ${fy + 12} Q${fx + 4} ${fy + 14} ${fx + 12} ${fy + 16} Q${fx + 26} ${fy + 20} ${fx + 30} ${fy + 4} Q${fx + 28} ${fy + 12} ${fx + 20} ${fy + 8} Q${fx + 10} ${fy + 2} ${fx} ${fy + 8} Z`, k.mus || '#4A3428')); break;
      case 'whiskers': front.push(L(`M${fx - 46} ${fy + 4} l-18 -4 M${fx - 46} ${fy + 12} l-18 2 M${fx + 46} ${fy + 4} l18 -4 M${fx + 46} ${fy + 12} l18 2`, INK, 2.4)); break;
      case 'antennae': front.push(L(`M${fx - 12} ${sh.top + 6} Q${fx - 30} ${sh.top - 40} ${fx - 60} ${sh.top - 36} M${fx + 12} ${sh.top + 6} Q${fx + 30} ${sh.top - 40} ${fx + 60} ${sh.top - 36}`, '#E86A4A', 3.5)); break;
      case 'sparkles': [[22, 40, 9], [180, 66, 7], [170, 16, 10], [28, 150, 6]].forEach(([x, y, r]) => front.push(P(`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`, GOLD, ` stroke="${INK}" stroke-width="2"`))); break;
      case 'steam': front.push(L(`M78 ${sh.top - 4} q-8 -10 0 -18 q8 -8 0 -18 M100 ${sh.top - 10} q-8 -10 0 -18 q8 -8 0 -18 M122 ${sh.top - 4} q-8 -10 0 -18 q8 -8 0 -18`, '#B9C8E8', 4.5)); break;
      case 'smoke': front.push(C(104, 14, 16, '#F1EAF4', sp), C(122, -2, 12, '#F1EAF4', sp), C(136, -18, 9, '#F1EAF4', sp)); break;
      case 'sweat': front.push(P(`M${fx + 60} ${fy - 34} Q${fx + 70} ${fy - 20} ${fx + 64} ${fy - 14} Q${fx + 56} ${fy - 14} ${fx + 56} ${fy - 22} Z`, '#9CD8FF', ` stroke="${INK}" stroke-width="2.4"`)); break;
      case 'threads': front.push(L('M40 60 q-14 -8 -22 4 q-6 12 -20 4 M160 70 q16 -6 22 8 q4 10 16 6 M150 176 q12 8 22 -2', '#F5F0E4', 3)); break;
      case 'bubbles': front.push(C(176, 50, 8, '#DFF4FF', sp), C(186, 28, 5, '#DFF4FF', sp), C(170, 12, 3.5, '#DFF4FF', sp)); break;
      case 'balloon': front.push(L('M178 134 Q186 90 176 56', INK, 2), P('M176 56 Q150 50 150 24 Q150 -2 176 -4 Q202 -2 202 24 Q202 50 176 56 Z', '#FF9DC0', sp), L('M160 10 Q176 30 160 46 M192 10 Q176 30 192 46', '#FFE58A', 3), `<rect x="170" y="56" width="12" height="9" rx="2" fill="#C9935A" ${ST}/>`); break;
      case 'torch': front.push(`<rect x="164" y="104" width="12" height="40" rx="4" fill="${GOLD}" ${ST}/>`, P('M170 104 Q156 92 164 78 Q168 86 172 80 Q170 70 178 62 Q188 82 180 96 Q178 102 170 104 Z', '#FF8A5C', sp)); break;
      case 'cheeks': break;
    }
    return { back, pat, front, under };
  }

  // ---------- キャラごとの見た目 ----------
  // s:形 e:耳 y:目 m:口 h:ぼうし x:小物 noi:手持ちアイコンなし
  const LOOKS = {
    '北海道': { s: 'blob', e: 'bear', y: 'big', m: 'cat', x: ['spots', 'bell'] },
    '青森県': { s: 'fruit', e: '', y: 'dot', m: 'smile', h: 'leaf', x: ['shine'], noi: 1 },
    '岩手県': { s: 'blob', e: 'dog', y: 'happy', m: 'open', h: 'bowlhat', x: ['scarf'], scc: '#E86A6A' },
    '宮城県': { s: 'egg', e: '', y: 'big', m: 'grin', h: 'kabuto', x: ['eyepatch', 'scarf'], scc: '#FFD34E' },
    '秋田県': { s: 'ball', e: 'oni', y: 'sharp', m: 'fang', x: ['mane', 'mino'], mc: '#F2E2B0' },
    '山形県': { s: 'cherry', e: '', y: 'sparkle', m: 'small', x: ['stems', 'shine'], noi: 1 },
    '福島県': { s: 'ball', e: 'cow', y: 'round', m: 'smile', x: ['akabeko'] },
    '茨城県': { s: 'egg', e: '', y: 'sleepy', m: 'cat', h: 'wara', x: ['threads', 'shine'] },
    '栃木県': { s: 'berry', e: '', y: 'big', m: 'open', h: 'calyx', x: ['seeds', 'shine'], noi: 1 },
    '群馬県': { s: 'daruma', e: '', y: 'round', m: 'small', x: ['facepatch', 'darumabrows', 'mustache'], mus: '#3B2A2A', noi: 1 },
    '埼玉県': { s: 'disc', e: 'dog', y: 'dot', m: 'tongue', x: ['pores', 'nori'], noi: 1 },
    '千葉県': { s: 'peanut', e: 'round', y: 'happy', m: 'smile', x: ['net'], noi: 1 },
    '東京都': { s: 'egg', e: '', y: 'sparkle', m: 'open', h: 'tower', x: ['sparkles', 'scarf'], scc: '#FF7BA9' },
    '神奈川県': { s: 'blob', e: 'cat', y: 'wink', m: 'smile', h: 'wave', x: ['sailor'] },
    '新潟県': { s: 'tri', e: '', y: 'dot', m: 'smile', x: ['rice', 'nori'], noi: 1 },
    '富山県': { s: 'egg', e: '', y: 'round', m: 'o', x: ['squidhead', 'tentacles', 'glow'] },
    '石川県': { s: 'blob', e: 'cat', y: 'sparkle', m: 'cat', h: 'crown', x: ['sparkles', 'shine'] },
    '福井県': { s: 'egg', e: '', y: 'big', m: 'fang', x: ['dinospikes', 'tail'] },
    '山梨県': { s: 'grape', e: '', y: 'happy', m: 'smile', h: 'vine', x: ['shine'], noi: 1 },
    '長野県': { s: 'blob', e: 'squirrel', y: 'dot', m: 'cat', h: 'knit', x: ['bushytail'], hc: '#8CCBF5', tlc: '#C9A87A' },
    '岐阜県': { s: 'egg', e: '', y: 'round', m: 'beak', h: 'eboshi', x: ['wings'], wc: '#6F86AE' },
    '静岡県': { s: 'cup', e: '', y: 'sleepy', m: 'small', h: 'leaf', x: ['steam'] },
    '愛知県': { s: 'blob', e: '', y: 'big', m: 'grin', h: 'shachi', x: ['shine'] },
    '三重県': { s: 'blob', e: '', y: 'sharp', m: 'small', h: 'ninja', x: ['shrimptail', 'antennae'], hc: '#7B6AA8' },
    '滋賀県': { s: 'wide', e: 'fin', y: 'round', m: 'o', x: ['dorsal', 'scales', 'bubbles'] },
    '京都府': { s: 'egg', e: '', y: 'lash', m: 'lips', h: 'maiko', x: [] },
    '大阪府': { s: 'ball', e: '', y: 'happy', m: 'open', h: 'nejiri', x: ['sauce', 'tentacles'], tc: '#FF9C8A', noi: 1 },
    '兵庫県': { s: 'blob', e: 'cat', y: 'lash', m: 'cat', h: 'castle', x: ['whiskers'] },
    '奈良県': { s: 'blob', e: 'deer', y: 'big', m: 'small', x: ['spots'], sc: '#FFF6EA' },
    '和歌山県': { s: 'fruit', e: '', y: 'sour', m: 'o', h: 'leaf', x: ['shine', 'sweat'], noi: 1 },
    '鳥取県': { s: 'blob', e: 'round', y: 'sleepy', m: 'cat', x: ['humps', 'scarf'], scc: '#7EC8F2' },
    '島根県': { s: 'blob', e: 'bunny', y: 'heart', m: 'smile', h: 'bigbow', x: [] },
    '岡山県': { s: 'fruit', e: '', y: 'sharp', m: 'open', h: 'momotaro', x: ['peachline'] },
    '広島県': { s: 'blob', e: 'cat', y: 'big', m: 'smile', h: 'momiji', x: [] },
    '山口県': { s: 'ball', e: 'fin', y: 'round', m: 'o', x: ['spikes'] },
    '徳島県': { s: 'ball', e: '', y: 'happy', m: 'open', h: 'amigasa', x: ['pores'] },
    '香川県': { s: 'bowl', e: 'dog', y: 'dot', m: 'tongue', x: ['noodles'] },
    '愛媛県': { s: 'ball', e: 'cat', y: 'sparkle', m: 'cat', h: 'leaf', x: ['pores', 'scarf'], scc: '#8CCBF5', noi: 1 },
    '高知県': { s: 'egg', e: 'fin', y: 'sharp', m: 'grin', h: 'hachimaki', x: ['stripes', 'dorsal'], stc: '#6F8FC8', hm: '#FF6F6F' },
    '福岡県': { s: 'peanut', e: '', y: 'happy', m: 'tongue', x: ['pores', 'sweat'] },
    '佐賀県': { s: 'blob', e: 'cat', y: 'big', m: 'open', h: 'goggles', x: ['balloon'], noi: 1 },
    '長崎県': { s: 'square', e: 'bear', y: 'dot', m: 'smile', x: ['castella'] },
    '熊本県': { s: 'egg', e: 'horse', y: 'big', m: 'grin', x: ['mane'], mc: '#FF7A5C' },
    '大分県': { s: 'drop', e: '', y: 'sleepy', m: 'small', h: 'towel', x: ['steam'] },
    '宮崎県': { s: 'drop', e: '', y: 'shades', m: 'grin', h: 'straw', x: ['shine'] },
    '鹿児島県': { s: 'tri', e: '', y: 'big', m: 'open', x: ['magma', 'smoke'] },
    '沖縄県': { s: 'blob', e: 'cat', y: 'big', m: 'fang', h: 'hibiscus', x: ['mane'], mc: '#FF9C5C' },
    'アメリカ': { s: 'blob', e: 'bear', y: 'sparkle', m: 'grin', h: 'liberty', x: ['torch'], noi: 1 },
    'フランス': { s: 'blob', e: 'bunny', y: 'lash', m: 'small', h: 'beret', x: ['stripes'], stc: '#6E8BE0' },
    'イタリア': { s: 'blob', e: 'cat', y: 'happy', m: 'open', h: 'chef', x: ['mustache'] },
    'エジプト': { s: 'egg', e: 'cat', y: 'liner', m: 'small', h: 'pharaoh', x: [] },
    'ブラジル': { s: 'egg', e: '', y: 'big', m: 'beak', h: 'feathers', x: ['wings'], wc: '#7DD87D' },
  };

  let uid = 0;
  function outline(s) {
    if (/stroke=/.test(s)) return s.replace(/stroke="[^"]*"/, `stroke="${INK}"`).replace(/stroke-width="([\d.]+)"/, (m, w) => `stroke-width="${+w + 8}"`);
    return s.replace(/fill="[^"]*"/, `fill="${INK}"`).replace(/\/>$/, ` stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>`);
  }

  function charaSVG(c, o = {}) {
    const k = Object.assign({ s: 'blob', e: '', y: 'big', m: 'smile', x: [] }, LOOKS[c.pref] || {});
    k.body = c.col; k.acc = c.acc === '#FFFFFF' ? '#FF7BA9' : c.acc;
    const sh = SHAPES[k.s](k.body);
    const ex = extras(k.x, k, sh);
    const sil = [...ex.back];
    const deco = [];
    if (k.e) for (const side of [-1, 1]) {
      const r = ear(k.e, side < 0 ? 100 - sh.ex : 100 + sh.ex, sh.ey, side, k.body, k.acc);
      sil.push(...r.s); deco.push(...r.d);
    }
    sh.feet.forEach(([x, y]) => sil.push(E(x, y, 17, 10, k.body)));
    sh.arms.forEach(([x, y, r]) => sil.push(E(x, y, 12, 17, k.body, r)));
    sil.push(...sh.body);
    if (sh.front) sil.push(...sh.front);
    const id = 'yc' + (++uid);
    const clip = `<clipPath id="${id}">${sh.body.join('')}</clipPath>`;
    const belly = sh.belly && !k.x.includes('stripes') ? E(sh.belly[0], sh.belly[1], sh.belly[2], sh.belly[3], mix(k.body, W, .55)) : '';
    const sc = Math.min(1.08, Math.max(.72, sh.hw / 72));
    const hatSvg = k.h ? `<g transform="translate(100 ${sh.top}) scale(${sc}) translate(-100 -34)">${hat(k.h, k)}</g>` : '';
    const under = UNDER_HATS.includes(k.h);
    const dx = Math.round(24 * Math.min(1.05, Math.max(.85, sh.hw / 72)));
    const ey = sh.fy - 4, my = sh.fy + 12;
    const blush = k.y === 'shades' ? '' : (k.s === 'ball' && k.x.includes('spikes')
      ? C(sh.fx - 44, sh.fy + 12, 13, PINK, ' opacity=".55"') + C(sh.fx + 44, sh.fy + 12, 13, PINK, ' opacity=".55"')
      : E(sh.fx - dx - 18, sh.fy + 13, 12, 7, PINK, 0, ' opacity=".55"') + E(sh.fx + dx + 18, sh.fy + 13, 12, 7, PINK, 0, ' opacity=".55"'));
    let item = '';
    if (!k.noi) {
      const a = sh.arms[sh.arms.length - 1] || [158, 166];
      item = `<g transform="translate(${a[0] + 4} ${a[1] + 12}) rotate(-10)"><circle r="19" fill="#fff" stroke="${INK}" stroke-width="3.5"/><text y="8" font-size="22" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${c.emoji}</text></g>`;
    }
    const shadow = o.noShadow ? '' : `<ellipse cx="100" cy="198" rx="64" ry="7" fill="${INK}" opacity=".12"/>`;
    return `<svg viewBox="-6 -40 212 246" xmlns="http://www.w3.org/2000/svg" aria-label="${c.name}">${shadow}<defs>${clip}</defs>`
      + `<g>${sil.map(outline).join('')}</g><g>${sil.join('')}</g>`
      + `<g clip-path="url(#${id})">${belly}${ex.pat.join('')}</g>${deco.join('')}${ex.under.join('')}`
      + (under ? hatSvg : '')
      + eyes(k.y, sh.fx, ey, dx, k.acc) + blush + mouth(k.m, sh.fx, my)
      + ex.front.join('') + (under ? '' : hatSvg) + item + `</svg>`;
  }

  window.YuruArt = { charaSVG, LOOKS };
})();
