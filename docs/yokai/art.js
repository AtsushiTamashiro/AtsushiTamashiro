// ようかい ぽんぽこバトル — ようかいの絵(SVGをパーツから組み立てる)
// data.js の look: { s:からだの形, c:色, a:アクセント色, eyes, mouth, ears, top, tail, hair, ...小物 }
(function () {
  const INK = '#3D2E4F', W = '#FFFFFF', GOLD = '#FFD34E', BLUSH = '#FF9DB8';
  const ST = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
  const sp = ' ' + ST;
  const E = (cx, cy, rx, ry, f, ex = '', rot = 0) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}"${rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : ''}${ex}/>`;
  const C = (cx, cy, r, f, ex = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"${ex}/>`;
  const P = (d, f, ex = '') => `<path d="${d}" fill="${f}"${ex}/>`;
  const L = (d, col = INK, w = 3.5) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  function mix(hex, w, t) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(w.slice(1), 16);
    const r = (x, y) => Math.round(x + (y - x) * t);
    return '#' + [r(a >> 16, b >> 16), r((a >> 8) & 255, (b >> 8) & 255), r(a & 255, b & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  const dark = (c, t = .3) => mix(c, '#2A1E3A', t);
  const light = (c, t = .5) => mix(c, '#FFFFFF', t);

  // ---------- からだの形 ----------
  // fx,fy 顔の中心 / top 頭のてっぺん / ex 耳のx(左) ey 耳のy / gap 目の間かく
  const SHAPES = {
    mochi: c => ({ body: E(100, 124, 68, 58, c, sp), fx: 100, fy: 116, top: 66, ex: 56, ey: 80, gap: 24, arms: [[36, 140, 40], [164, 140, -40]], feet: [[76, 180], [124, 180]], belly: [100, 150, 36, 22] }),
    egg: c => ({ body: E(100, 116, 52, 72, c, sp), fx: 100, fy: 96, top: 44, ex: 64, ey: 58, gap: 20, arms: [[50, 140, 30], [150, 140, -30]], feet: [[82, 186], [118, 186]], belly: [100, 150, 30, 26] }),
    gourd: c => ({ body: E(100, 160, 46, 30, c, sp) + E(100, 86, 52, 56, c, sp), fx: 100, fy: 100, top: 30, ex: 56, ey: 60, gap: 20, arms: [[58, 160, 30], [142, 160, -30]], feet: [[84, 188], [116, 188]], belly: null }),
    ghost: c => ({ body: P('M40 112 Q40 40 100 40 Q160 40 160 112 L160 166 q-10 16 -20 0 q-10 16 -20 0 q-10 16 -20 0 q-10 16 -20 0 q-10 16 -20 0 q-10 16 -20 0 Z', c, sp), fx: 100, fy: 100, top: 40, ex: 60, ey: 56, gap: 22, arms: [[40, 124, 50], [160, 124, -50]], feet: [], belly: null }),
    flame: c => ({
      body: P('M100 28 Q112 58 136 78 Q170 108 160 146 Q150 184 100 184 Q50 184 40 146 Q30 108 64 80 Q72 72 76 56 Q86 70 92 64 Q98 46 100 28 Z', c, sp)
        + P('M100 92 Q114 112 126 126 Q138 148 122 164 Q110 176 100 176 Q90 176 78 164 Q62 148 74 126 Q86 112 100 92 Z', light(c, .55)),
      fx: 100, fy: 134, top: 70, ex: 66, ey: 92, gap: 20, arms: [], feet: [], belly: null,
    }),
    wall: c => ({ body: `<rect x="34" y="34" width="132" height="146" rx="24" fill="${c}"${sp}/>`, fx: 100, fy: 100, top: 34, ex: 50, ey: 40, gap: 26, arms: [[30, 132, 30], [170, 132, -30]], feet: [[72, 186], [128, 186]], belly: null }),
    mound: c => ({ body: P('M14 184 Q18 70 100 52 Q182 70 186 184 Z', c, sp), fx: 100, fy: 112, top: 52, ex: 50, ey: 80, gap: 28, arms: [[32, 156, 20], [168, 156, -20]], feet: [], belly: [100, 162, 48, 18] }),
    umbrella: c => ({
      body: L('M100 120 L100 176', '#C99A66', 7) + `<rect x="84" y="174" width="32" height="10" rx="4" fill="#C99A66"${sp}/>`
        + L('M92 184 L92 190 M108 184 L108 190', INK, 4)
        + P('M24 122 Q34 40 100 24 Q166 40 176 122 Q158 112 144 122 Q128 110 114 122 Q100 110 86 122 Q72 110 56 122 Q42 112 24 122 Z', c, sp)
        + L('M100 24 L100 118 M100 24 Q66 70 56 120 M100 24 Q134 70 144 120', dark(c, .2), 2.5) + C(100, 22, 6, '#C99A66', sp),
      fx: 100, fy: 80, top: 24, ex: 60, ey: 50, gap: 28, arms: [], feet: [], belly: null,
    }),
    lantern: c => ({
      body: `<rect x="70" y="22" width="60" height="16" rx="5" fill="${INK}"/>` + `<rect x="70" y="170" width="60" height="16" rx="5" fill="${INK}"/>`
        + `<rect x="36" y="34" width="128" height="140" rx="56" fill="${c}"${sp}/>`
        + L('M44 64 Q100 74 156 64 M38 96 Q100 106 162 96 M38 130 Q100 140 162 130 M44 160 Q100 168 156 160', dark(c, .18), 2.5)
        + P('M136 46 Q160 60 160 90 L148 88 Z', dark(c, .12)),
      fx: 100, fy: 106, top: 22, ex: 54, ey: 40, gap: 28, arms: [], feet: [], belly: null,
    }),
    cloth: c => ({
      body: P('M40 46 Q100 24 150 44 Q166 58 150 84 Q128 112 96 122 Q70 132 84 156 Q100 176 168 168 L172 188 Q86 200 62 166 Q44 138 78 112 Q116 92 128 76 Q138 62 112 58 Q76 56 46 70 Q30 60 40 46 Z', c, sp)
        + L('M50 60 Q60 54 70 58', dark(c, .15), 2),
      fx: 98, fy: 70, top: 30, ex: 60, ey: 40, gap: 18, arms: [], feet: [], belly: null,
    }),
    neck: c => ({
      body: E(100, 166, 44, 26, c, sp) + P('M84 150 Q60 100 96 82 L118 90 Q86 106 112 152 Z', c, sp) + E(118, 70, 46, 40, c, sp),
      fx: 118, fy: 72, top: 30, ex: 78, ey: 40, gap: 18, arms: [[62, 168, 30], [138, 168, -30]], feet: [], belly: null, kimonoY: 152,
    }),
  };

  // ---------- 耳 ----------
  function ears(kind, g, c, a) {
    const L1 = g.ex, R1 = 200 - g.ex, y = g.ey;
    const pair = f => f(L1, -1) + f(R1, 1);
    switch (kind) {
      case 'cat': return pair((x, s) => P(`M${x - 18 * s} ${y + 16} L${x - 6 * s} ${y - 26} L${x + 20 * s} ${y + 4} Z`, c, sp) + P(`M${x - 10 * s} ${y + 8} L${x - 5 * s} ${y - 12} L${x + 8 * s} ${y + 4} Z`, BLUSH));
      case 'fox': return pair((x, s) => P(`M${x - 18 * s} ${y + 18} L${x - 8 * s} ${y - 36} L${x + 22 * s} ${y + 6} Z`, c, sp) + P(`M${x - 10 * s} ${y + 8} L${x - 7 * s} ${y - 18} L${x + 10 * s} ${y + 4} Z`, a === W ? '#FFE2C8' : light(a, .3)));
      case 'tanuki': return pair((x) => C(x, y, 16, c, sp) + C(x, y + 2, 8, dark(c, .35)));
      case 'round': return pair((x) => C(x, y, 15, c, sp) + C(x, y + 1, 8, light(c, .5)));
      default: return '';
    }
  }

  // ---------- しっぽ・つばさ(からだの後ろ) ----------
  function back(L0, g, c, a) {
    let s = '';
    if (L0.tail === 'tanuki') s += E(162, 150, 22, 36, c, sp, -30) + L('M150 128 Q166 122 176 132 M146 148 Q164 142 178 152', dark(c, .35), 5);
    if (L0.tail === 'fox1') s += P('M150 160 Q190 150 186 96 Q168 120 140 128 Z', c, sp) + P('M186 96 Q184 116 172 124 Q176 106 186 96 Z', W, sp);
    if (L0.tail === 'fox9') {
      for (let i = 0; i < 9; i++) {
        const ang = -80 + i * 20;
        s += `<g transform="rotate(${ang} 100 140)">` + P('M92 140 Q80 70 100 30 Q120 70 108 140 Z', c, sp) + P('M100 30 Q108 46 106 58 Q96 52 94 44 Z', a) + `</g>`;
      }
    }
    if (L0.tail === 'cat2') s += L('M150 160 Q190 150 180 104 Q176 90 188 84', INK, 15) + L('M150 160 Q190 150 180 104 Q176 90 188 84', c, 9)
      + L('M150 166 Q196 172 194 132 Q194 118 200 112', INK, 15) + L('M150 166 Q196 172 194 132 Q194 118 200 112', c, 9);
    if (L0.tail === 'snake') s += L('M150 166 Q192 168 186 130 Q180 104 196 92', INK, 17) + L('M150 166 Q192 168 186 130 Q180 104 196 92', '#9BD39B', 11) + C(194, 90, 9, '#9BD39B', sp) + C(196, 88, 2, INK);
    if (L0.tail === 'dragon') s += P('M140 170 Q196 176 190 128 Q186 96 160 96 Q176 106 176 128 Q178 160 132 156 Z', c, sp) + L('M160 158 l4 -8 M172 146 l6 -6 M178 128 l7 -2', a, 3);
    if (L0.wings) s += [-1, 1].map(k => `<g transform="translate(${100 - 100 * k} 0) scale(${k} 1)">` + P('M50 140 Q8 136 2 96 Q14 102 20 98 Q8 84 10 70 Q26 82 34 80 Q30 96 54 104 Z', dark(c, .45), sp) + L('M20 112 Q34 116 46 116 M26 92 Q38 100 50 106', light(dark(c, .45), .3), 2.5) + `</g>`).join('');
    if (L0.shell) s += E(100, 130, 74, 60, '#6BAF6B', sp) + L('M40 118 Q100 102 160 118', '#4E8A4E', 3);
    if (L0.mane) s += P('M44 100 Q30 60 60 54 Q60 30 92 34 Q112 18 132 36 Q164 30 160 60 Q186 70 170 104 Z', a, sp);
    if (L0.hair === 'long') s += P(`M${g.fx - 58} ${g.fy - 20} Q${g.fx - 70} 120 ${g.fx - 56} 176 L${g.fx + 56} 176 Q${g.fx + 70} 120 ${g.fx + 58} ${g.fy - 20} Z`, '#2E2A44', sp);
    if (L0.hair === 'amabie') s += P(`M50 70 Q20 110 30 168 Q44 150 50 170 Q60 150 64 168 L136 168 Q140 150 150 170 Q156 150 170 168 Q180 110 150 70 Z`, '#B9A2F0', sp);
    if (L0.hair === 'bob') s += P(`M${g.fx - 56} ${g.fy - 10} Q${g.fx - 60} ${g.fy + 36} ${g.fx - 46} ${g.fy + 40} L${g.fx + 46} ${g.fy + 40} Q${g.fx + 60} ${g.fy + 36} ${g.fx + 56} ${g.fy - 10} Z`, '#2E2A44', sp);
    if (L0.hood) s += P('M20 160 Q24 70 100 40 Q176 70 180 160 Q140 140 100 146 Q60 140 20 160 Z', '#E8C77C', sp) + L('M40 110 l14 10 M62 84 l12 12 M100 66 l0 14 M138 84 l-12 12 M160 110 l-14 10', '#C9A458', 3);
    return s;
  }

  // ---------- 頭の上・かみ(からだの前) ----------
  function top(L0, g, c, a) {
    const x = g.fx, t = g.top;
    let s = '';
    switch (L0.top) {
      case 'leaf': s += P(`M${x - 4} ${t + 6} Q${x - 30} ${t - 20} ${x - 8} ${t - 36} Q${x + 22} ${t - 20} ${x - 4} ${t + 6} Z`, '#7DCB6B', sp) + L(`M${x - 4} ${t + 4} Q${x - 8} ${t - 16} ${x - 8} ${t - 30}`, '#4E9A45', 2.5); break;
      case 'dish': s += P(`M${x - 46} ${t + 18} l8 -14 l8 10 l8 -14 l8 10 l8 -14 l8 10 l8 -14 l8 10 l8 -14 l8 10 l6 16 Z`, '#5FB878', sp) + E(x, t + 4, 34, 11, '#EAFBFF', sp) + E(x - 8, t + 1, 12, 3, W); break;
      case 'horn1': s += P(`M${x - 10} ${t + 8} Q${x} ${t - 40} ${x + 6} ${t - 44} Q${x + 12} ${t - 20} ${x + 10} ${t + 8} Z`, GOLD, sp); break;
      case 'horn2': s += [-1, 1].map(k => P(`M${x + 22 * k - 9} ${t + 12} Q${x + 30 * k} ${t - 28} ${x + 36 * k} ${t - 30} Q${x + 34 * k} ${t - 8} ${x + 22 * k + 9} ${t + 10} Z`, a === GOLD || a === '#FFE58A' ? a : GOLD, sp)).join(''); break;
      case 'tokin': s += P(`M${x - 18} ${t + 6} L${x - 14} ${t - 14} L${x} ${t - 22} L${x + 14} ${t - 14} L${x + 18} ${t + 6} Z`, '#2E2A44', sp) + C(x - 26, t + 8, 6, '#FF6B8A', sp) + C(x + 26, t + 8, 6, '#FF6B8A', sp); break;
      case 'bald': s += E(x - 18, t + 16, 12, 6, W, ' opacity=".5"', -20); break;
      case 'topknot': s += P(`M${x - 30} ${t + 12} Q${x} ${t - 10} ${x + 30} ${t + 12} Q${x} ${t + 4} ${x - 30} ${t + 12} Z`, '#2E2A44', sp) + E(x, t - 6, 8, 12, '#2E2A44', sp); break;
      case 'bun': s += P(`M${x - 46} ${g.fy - 4} Q${x - 50} ${t - 6} ${x} ${t - 8} Q${x + 50} ${t - 6} ${x + 46} ${g.fy - 4} Q${x + 20} ${t + 10} ${x - 46} ${g.fy - 4} Z`, '#2E2A44', sp) + C(x, t - 18, 16, '#2E2A44', sp) + L(`M${x + 8} ${t - 30} l18 -10`, a, 4) + C(x + 28, t - 41, 4, a); break;
      case 'mountain': s += P(`M${x - 60} ${t + 16} L${x - 34} ${t - 26} L${x - 8} ${t + 16} Z`, '#7DC87D', sp) + P(`M${x - 20} ${t + 16} L${x + 14} ${t - 40} L${x + 48} ${t + 16} Z`, '#8FD48F', sp)
        + P(`M${x + 2} ${t - 20} L${x + 14} ${t - 40} L${x + 26} ${t - 20} Q${x + 14} ${t - 14} ${x + 2} ${t - 20} Z`, W) + P(`M${x - 42} ${t - 12} L${x - 34} ${t - 26} L${x - 26} ${t - 12} Z`, W); break;
    }
    if (L0.hair === 'bob') s += P(`M${x - 56} ${g.fy} Q${x - 60} ${t - 12} ${x} ${t - 14} Q${x + 60} ${t - 12} ${x + 56} ${g.fy} L${x + 44} ${g.fy - 18} L${x - 44} ${g.fy - 18} Z`, '#2E2A44', sp) + E(x + 30, t + 6, 10, 6, '#FF7BA9', sp);
    if (L0.hair === 'long') s += P(`M${x - 58} ${g.fy - 4} Q${x - 56} ${t - 14} ${x} ${t - 14} Q${x + 56} ${t - 14} ${x + 58} ${g.fy - 4} Q${x + 30} ${t + 18} ${x} ${t + 10} Q${x - 30} ${t + 18} ${x - 58} ${g.fy - 4} Z`, '#2E2A44', sp);
    if (L0.hair === 'amabie') s += P(`M${x - 54} ${g.fy - 2} Q${x - 52} ${t - 12} ${x} ${t - 14} Q${x + 52} ${t - 12} ${x + 54} ${g.fy - 2} Q${x + 26} ${t + 14} ${x} ${t + 6} Q${x - 26} ${t + 14} ${x - 54} ${g.fy - 2} Z`, '#B9A2F0', sp);
    if (L0.hair === 'red') s += P(`M${x - 66} ${g.fy - 4} L${x - 72} ${t - 4} L${x - 48} ${t - 2} L${x - 46} ${t - 30} L${x - 22} ${t - 14} L${x - 10} ${t - 40} L${x + 6} ${t - 16} L${x + 26} ${t - 36} L${x + 30} ${t - 10} L${x + 54} ${t - 24} L${x + 50} ${t} L${x + 72} ${t - 2} L${x + 66} ${g.fy - 4} Q${x + 30} ${t + 18} ${x} ${t + 14} Q${x - 30} ${t + 18} ${x - 66} ${g.fy - 4} Z`, '#FF6B4A', sp);
    if (L0.curly) s += [-30, -15, 0, 15, 30].map(d => C(x + d, t + 6 + Math.abs(d) / 4, 9, '#4A3A5A', sp)).join('');
    return s;
  }

  // ---------- 顔 ----------
  function eyes(kind, g, c) {
    const x = g.fx, y = g.fy - 4, d = g.gap;
    const both = f => f(x - d, -1) + f(x + d, 1);
    switch (kind) {
      case 'big': return both(ex => E(ex, y, 9, 11.5, INK) + C(ex - 3, y - 4, 3.8, W) + C(ex + 3, y + 4, 1.7, W));
      case 'one': return E(x, y - 4, 20, 19, W, sp) + C(x + 2, y - 3, 11, INK) + C(x - 2, y - 8, 4, W) + C(x + 6, y + 1, 1.8, W);
      case 'sleepy': return both(ex => L(`M${ex - 8} ${y} Q${ex} ${y + 6} ${ex + 8} ${y}`));
      case 'happy': return both(ex => L(`M${ex - 8} ${y + 3} Q${ex} ${y - 8} ${ex + 8} ${y + 3}`, INK, 4));
      case 'fox': return both((ex, s) => L(`M${ex - 8} ${y + 2} Q${ex} ${y - 6} ${ex + 8} ${y + 2}`, INK, 4));
      case 'cat': return both(ex => E(ex, y, 8, 10, '#FFE58A', sp) + E(ex, y, 2.6, 7.5, INK) + C(ex - 3, y - 4, 1.8, W));
      case 'mask': return both((ex, s) => E(ex + s * 2, y + 2, 14, 11, dark(c, .45), '', s * 20)) + both(ex => E(ex, y, 5.5, 7, INK) + C(ex - 2, y - 3, 2.3, W));
      case 'sharp': return both((ex, s) => E(ex, y, 6.5, 8.5, INK) + C(ex - 2, y - 3, 2.4, W) + L(`M${ex - 9 * s} ${y - 15} L${ex + 7 * s} ${y - 11}`, INK, 3.5));
      case 'none': return '';
      default: return both(ex => E(ex, y, 6.5, 8.5, INK) + C(ex - 2, y - 3, 2.4, W));
    }
  }
  function mouth(kind, g) {
    const x = g.fx, y = g.fy + 16;
    switch (kind) {
      case 'smile': return L(`M${x - 8} ${y - 2} Q${x} ${y + 6} ${x + 8} ${y - 2}`);
      case 'open': return P(`M${x - 9} ${y - 3} Q${x} ${y - 5} ${x + 9} ${y - 3} Q${x + 8} ${y + 11} ${x} ${y + 11} Q${x - 8} ${y + 11} ${x - 9} ${y - 3} Z`, '#B8455E', sp) + E(x, y + 7, 5, 3, '#FF9DB0');
      case 'tongue': return P(`M${x - 12} ${y - 3} Q${x} ${y + 9} ${x + 12} ${y - 3} Z`, '#B8455E', sp) + P(`M${x - 6} ${y + 2} Q${x - 8} ${y + 26} ${x + 2} ${y + 26} Q${x + 10} ${y + 24} ${x + 6} ${y + 2} Z`, '#FF8FA8', sp) + L(`M${x} ${y + 8} L${x} ${y + 18}`, '#E2657F', 2);
      case 'beak': return P(`M${x - 15} ${y - 6} Q${x} ${y - 13} ${x + 15} ${y - 6} Q${x + 10} ${y + 10} ${x} ${y + 10} Q${x - 10} ${y + 10} ${x - 15} ${y - 6} Z`, GOLD, sp) + L(`M${x - 13} ${y - 2} Q${x} ${y + 1} ${x + 13} ${y - 2}`, INK, 2.5);
      case 'cat': return L(`M${x - 10} ${y - 2} Q${x - 5} ${y + 5} ${x} ${y - 2} Q${x + 5} ${y + 5} ${x + 10} ${y - 2}`);
      case 'fang': return L(`M${x - 11} ${y - 2} Q${x} ${y + 7} ${x + 11} ${y - 2}`) + P(`M${x - 8} ${y} L${x - 5} ${y + 7} L${x - 2} ${y + 2} Z`, W, sp) + P(`M${x + 8} ${y} L${x + 5} ${y + 7} L${x + 2} ${y + 2} Z`, W, sp);
      case 'o': return E(x, y, 5, 6, '#B8455E', sp);
      default: return '';
    }
  }

  // ---------- 小物・もよう ----------
  function deco(L0, g, c, a) {
    let s = '';
    const x = g.fx, y = g.fy;
    if (L0.stripes) s += L('M48 108 l14 6 M44 132 l16 4 M152 108 l-14 6 M156 132 l-16 4 M90 70 l4 12 M110 70 l-4 12', '#5A4A78', 4);
    if (L0.scales) s += [0, 1, 2].map(r => [0, 1, 2, 3].map(k => L(`M${64 + k * 20 + (r % 2) * 10} ${148 + r * 11} q6 7 12 0`, dark(c, .25), 2.5)).join('')).join('');
    if (L0.cracks) s += L('M50 150 l10 -8 l-4 -10 M150 60 l-10 6 l4 10 M140 162 l-8 -6', dark(c, .3), 2.5) + [[56, 52], [140, 150], [64, 168], [150, 96]].map(([px, py]) => C(px, py, 3, dark(c, .2))).join('');
    if (L0.kimono) {
      const ky = g.kimonoY || (g.belly ? g.belly[1] - 14 : 150);
      s += P(`M${x - 30} ${ky - 6} L${x} ${ky + 18} L${x + 30} ${ky - 6}`, 'none', ` stroke="${a}" stroke-width="7" stroke-linecap="round"`) + `<rect x="${x - 40}" y="${ky + 14}" width="80" height="11" rx="5" fill="${a}"${sp}/>`;
    }
    if (L0.pants) s += P('M44 150 Q100 166 156 150 Q160 172 140 178 L60 178 Q40 172 44 150 Z', '#FFD34E', sp) + L('M60 160 l8 14 M82 164 l6 12 M108 164 l-4 12 M130 160 l-6 14', INK, 3.5);
    if (L0.skirt) s += [56, 76, 96, 116, 136].map((px, i) => P(`M${px} 156 Q${px + 10} 182 ${px + 20} 156 Z`, i % 2 ? '#6FBF6F' : '#86D486', sp)).join('');
    if (L0.fluff) s += [[42, 100], [36, 128], [158, 100], [164, 128], [70, 72], [130, 72]].map(([px, py]) => C(px, py, 9, c)).join('');
    if (L0.mark) s += P(`M${x - 4} ${g.top + 14} Q${x} ${g.top + 4} ${x + 4} ${g.top + 14} Q${x} ${g.top + 20} ${x - 4} ${g.top + 14} Z`, L0.mark);
    return s;
  }
  function front(L0, g, c, a) {
    let s = '';
    const x = g.fx, y = g.fy;
    if (L0.nose) s += P(`M${x - 8} ${y + 2} Q${x + 30} ${y - 6} ${x + 46} ${y - 2} Q${x + 30} ${y + 12} ${x - 6} ${y + 14} Z`, '#FF6B5E', sp);
    if (L0.trunk) s += P(`M${x - 10} ${y + 6} Q${x - 12} ${y + 34} ${x + 6} ${y + 40} Q${x + 18} ${y + 42} ${x + 16} ${y + 30} Q${x + 6} ${y + 32} ${x + 6} ${y + 22} L${x + 10} ${y + 6} Z`, c, sp);
    if (L0.whisker) s += L(`M${x - 18} ${y + 14} Q${x - 46} ${y + 10} ${x - 58} ${y + 30} M${x + 18} ${y + 14} Q${x + 46} ${y + 10} ${x + 58} ${y + 30}`, a, 3);
    if (L0.sickle) s += [-1, 1].map(k => P(`M${100 + 60 * k} 150 Q${100 + 92 * k} 120 ${100 + 74 * k} 82 Q${100 + 74 * k} 118 ${100 + 50 * k} 134 Z`, a, sp)).join('');
    if (L0.fan) s += L('M150 160 L164 132', '#C99A66', 6) + P('M164 132 Q150 110 160 92 Q176 96 186 108 Q196 124 184 136 Q176 142 164 132 Z', '#7DCB6B', sp) + L('M164 132 L170 100 M164 132 L184 112', '#4E9A45', 2);
    if (L0.club) s += `<g transform="rotate(-20 168 140)"><rect x="160" y="80" width="18" height="76" rx="8" fill="#C9C2D6"${sp}/>` + [92, 108, 124, 140].map(py => C(169, py, 3, INK)).join('') + `</g>`;
    if (L0.sieve) s += E(100, 164, 40, 14, '#D9B87A', sp) + [84, 94, 104, 114, 90, 100, 110].map((px, i) => C(px, 158 + (i > 3 ? 4 : 0), 4, '#B84A4A')).join('');
    if (L0.cup) s += P('M136 150 L164 150 L160 172 L140 172 Z', '#9ED49E', sp) + L('M144 142 q4 -6 0 -12 M154 142 q4 -6 0 -12', '#BBB', 2);
    if (L0.waves) s += P('M0 168 Q20 152 40 168 Q60 184 80 168 Q100 152 120 168 Q140 184 160 168 Q180 152 200 168 L200 200 L0 200 Z', '#7CC6EE', sp) + L('M14 178 q8 -6 16 0 M110 180 q8 -6 16 0', W, 3);
    if (L0.echo) s += `<g transform="rotate(10 166 44)"><rect x="132" y="26" width="64" height="30" rx="14" fill="${W}"${sp}/>` + P('M146 54 l-6 12 l14 -10 Z', W) + `<text x="164" y="47" text-anchor="middle" font-size="15" font-weight="800" fill="${INK}" font-family="sans-serif">ヤッホー</text></g>`;
    if (L0.hood) s += L(`M${x - 32} ${y + 34} Q${x} ${y + 46} ${x + 32} ${y + 34}`, '#FF8FA8', 6);
    return s;
  }
  function aura(L0) {
    let s = '';
    if (L0.wisps) s += [[24, 60, 1], [176, 54, .8], [18, 150, .7]].map(([px, py, k]) => `<g transform="translate(${px} ${py}) scale(${k})">` + P('M0 -16 Q10 -2 10 6 Q10 16 0 16 Q-10 16 -10 6 Q-10 -2 0 -16 Z', L0.wisps, ` stroke="${INK}" stroke-width="2.5" opacity=".9"`) + `</g>`).join('');
    if (L0.snow) s += [[22, 40], [178, 70], [30, 120], [170, 150]].map(([px, py]) => L(`M${px - 7} ${py} L${px + 7} ${py} M${px} ${py - 7} L${px} ${py + 7} M${px - 5} ${py - 5} L${px + 5} ${py + 5} M${px + 5} ${py - 5} L${px - 5} ${py + 5}`, '#8CC8F0', 2.5)).join('');
    if (L0.stars) s += [[22, 46], [180, 40], [182, 130], [16, 132]].map(([px, py]) => P(`M${px} ${py - 9} L${px + 3} ${py - 3} L${px + 9} ${py} L${px + 3} ${py + 3} L${px} ${py + 9} L${px - 3} ${py + 3} L${px - 9} ${py} L${px - 3} ${py - 3} Z`, GOLD, ` stroke="${INK}" stroke-width="2"`)).join('');
    return s;
  }

  function yokaiSVG(y, opts = {}) {
    const L0 = y.look, c = L0.c, a = L0.a;
    const g = SHAPES[L0.s](c);
    let s = '';
    if (!opts.noShadow) s += E(100, 192, 54, 7, 'rgba(61,46,79,.14)');
    s += aura(L0);
    s += back(L0, g, c, a);
    s += ears(L0.ears, g, c, a);
    // 足と手(からだの後ろ側に少し)
    s += g.feet.map(([fx, fy]) => E(fx, fy, 15, 9, dark(c, .08), sp)).join('');
    s += g.body;
    if (L0.belly && g.belly) s += E(g.belly[0], g.belly[1], g.belly[2], g.belly[3], L0.belly);
    s += deco(L0, g, c, a);
    if (!L0.sickle) s += g.arms.map(([ax, ay, r]) => E(ax, ay, 10, 16, c, sp, r)).join('');
    s += top(L0, g, c, a);
    if (L0.eyes !== 'one') s += E(g.fx - g.gap - 14, g.fy + 10, 9, 5.5, BLUSH, ' opacity=".75"') + E(g.fx + g.gap + 14, g.fy + 10, 9, 5.5, BLUSH, ' opacity=".75"');
    else s += E(g.fx - 32, g.fy + 12, 8, 5, BLUSH, ' opacity=".75"') + E(g.fx + 32, g.fy + 12, 8, 5, BLUSH, ' opacity=".75"');
    s += eyes(L0.eyes, g, c);
    s += mouth(L0.mouth, g);
    s += front(L0, g, c, a);
    const cls = opts.sil ? ' class="sil"' : '';
    return `<svg viewBox="-6 -6 212 212" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${opts.sil ? 'まだ 見ていない ようかい' : y.name}"${cls}>${s}</svg>`;
  }

  window.YokaiArt = { yokaiSVG, mix };
})();
