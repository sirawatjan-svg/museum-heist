/* sprites.js — ตัวละครและไอคอนพิกเซลอาร์ต วาดด้วยโค้ดทั้งหมด (ไม่มีไฟล์ภาพ)
   Spr.img(name, px)        → <img> ภาพนิ่ง (ไอคอน หรือ 'c:pick' ตัวละคร, 'hd:pick' หน้าตัวละคร)
   Spr.anim(cls, pose, px)  → <span> ตัวละครขยับ (pose: idle | walk | cheer)
   Spr.canvas(name) / Spr.frame(cls, pose, f) → canvas สำหรับ drawImage */
(function () {
  const OUT = '#07060f';
  const SKIN = '#f2c29b', SKIN2 = '#d99b74', MASK = '#1d1b2e', EYE = '#ffffff', MOUTH = '#b5735a';
  const BELT = '#2a2440', GOLD = '#f4b400';
  const LOOK = {
    pick:  { shirt: '#ff5a67', shirt2: '#c23848', pants: '#2b2f55', pants2: '#1f2244', hand: '#2b2540', shoe: '#4a2f25' },
    crack: { shirt: '#3fd0f0', shirt2: '#1e8aa6', pants: '#2a8fae', pants2: '#1d6f8a', hand: '#5a6280', shoe: '#3a3f55' },
    plan:  { shirt: '#9b7bff', shirt2: '#6a4fd0', pants: '#2b2f55', pants2: '#1f2244', hand: SKIN, shoe: '#2a2030' },
    guard: { shirt: '#3ddc97', shirt2: '#1fa874', pants: '#26405a', pants2: '#1b3046', hand: SKIN, shoe: '#2a2a2a' },
    none:  { shirt: '#6b7194', shirt2: '#4c5170', pants: '#2b2f55', pants2: '#1f2244', hand: SKIN, shoe: '#2a2a2a' },
  };
  const CW = 24, CH = 36, OY = 3;

  function outline(g, W, H) {
    const o = g.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y * W + x]) continue;
      if ((x > 0 && g[y * W + x - 1]) || (x < W - 1 && g[y * W + x + 1]) || (y > 0 && g[(y - 1) * W + x]) || (y < H - 1 && g[(y + 1) * W + x])) o[y * W + x] = OUT;
    }
    return o;
  }
  function toCanvas(g, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const v = g[j * W + i]; if (v) { x.fillStyle = v; x.fillRect(i, j, 1, 1); } }
    return c;
  }

  /* ---------- ตัวละคร 24×36 ---------- */
  function charGrid(cls, pose, f) {
    const L = LOOK[cls] || LOOK.none;
    const g = new Array(CW * CH).fill(null);
    let up = 0, jump = 0, legs = 'stand', arms = 'down';
    if (pose === 'idle') up = f ? 1 : 0;
    if (pose === 'walk') { legs = f ? 'pass' : 'spread'; arms = f ? 'swingB' : 'swingA'; up = f ? 0 : 1; }
    if (pose === 'cheer') { arms = 'up'; jump = f ? -3 : 0; legs = f ? 'tuck' : 'stand'; }
    const px = (x, y, c) => { if (x >= 0 && x < CW && y >= 0 && y < CH && c) g[y * CW + x] = c; };
    const rectA = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
    const R = (x, y, w, h, c) => rectA(x, y + OY + jump, w, h, c);          // ช่วงล่าง
    const U = (x, y, w, h, c) => rectA(x, y + OY + jump + up, w, h, c);     // ลำตัวบน

    // ขา
    const leg = (x, foot, out) => { R(x, 19, 3, foot - 20, L.pants); R(out < 0 ? x - 1 : x, foot - 1, 4, 2, L.shoe); };
    R(8, 19, 8, 2, L.pants2);
    if (legs === 'stand') { leg(8, 30, -1); leg(13, 30, 1); }
    if (legs === 'spread') { leg(6, 30, -1); leg(15, 30, 1); R(7, 19, 10, 2, L.pants2); }
    if (legs === 'pass') { leg(8, 30, -1); leg(13, 28, 1); }
    if (legs === 'tuck') { leg(8, 27, -1); leg(13, 27, 1); }
    // ลำตัว
    U(7, 9, 10, 10, L.shirt); U(16, 9, 1, 10, L.shirt2);
    if (cls === 'pick') for (const y of [10, 13, 16]) U(7, y, 10, 1, '#8a2440');
    if (cls === 'crack') U(11, 10, 2, 7, L.shirt2);
    if (cls === 'plan') { U(10, 9, 1, 3, '#4b3585'); U(13, 9, 1, 3, '#4b3585'); U(11, 11, 2, 1, '#4b3585'); U(7, 19, 10, 3, L.shirt); U(16, 19, 1, 3, L.shirt2); }
    if (cls === 'guard') U(9, 11, 2, 2, GOLD);
    U(7, 17, 10, 2, BELT); U(11, 17, 2, 2, GOLD);
    // แขน
    const arm = (x, y, h, sh) => { U(x, y, 2, h, sh); U(x, y + h, 2, 2, L.hand); };
    if (arms === 'down') { arm(5, 10, 6, L.shirt); arm(17, 10, 6, L.shirt2); }
    if (arms === 'swingA') { arm(5, 10, 5, L.shirt); arm(17, 10, 7, L.shirt2); }
    if (arms === 'swingB') { arm(5, 10, 7, L.shirt); arm(17, 10, 5, L.shirt2); }
    if (arms === 'up') { U(5, 2, 2, 8, L.shirt); U(5, 0, 2, 2, L.hand); U(17, 2, 2, 8, L.shirt2); U(17, 0, 2, 2, L.hand); }
    if (cls === 'guard' && arms !== 'up') { U(1, 9, 5, 9, '#1fa874'); U(2, 10, 3, 7, '#3ddc97'); U(3, 12, 1, 3, GOLD); }
    // หัว
    U(8, 1, 8, 8, SKIN); U(15, 1, 1, 8, SKIN2);
    U(7, 4, 10, 2, MASK); U(9, 4, 2, 1, EYE); U(13, 4, 2, 1, EYE);
    if (pose === 'cheer') U(11, 6, 2, 2, '#7a1f2a'); else U(11, 7, 2, 1, MOUTH);
    // หมวกตามอาชีพ
    if (cls === 'pick') { U(8, -2, 8, 1, '#ff5a67'); U(7, -1, 10, 3, '#ff5a67'); U(7, 2, 10, 1, '#c23848'); U(11, -3, 2, 1, '#ffffff'); }
    if (cls === 'crack') { U(8, 0, 8, 2, '#3a2a22'); U(7, 1, 10, 1, MASK); U(9, 0, 2, 2, '#aef4ff'); U(13, 0, 2, 2, '#aef4ff'); }
    if (cls === 'plan') { U(8, -2, 8, 3, '#4b3585'); U(8, 0, 8, 1, '#9b7bff'); U(6, 1, 12, 2, '#3d2a6e'); }
    if (cls === 'guard') { U(8, -2, 8, 1, '#3ddc97'); U(7, -1, 10, 3, '#3ddc97'); U(9, -1, 3, 1, '#b5ffd9'); U(6, 2, 12, 1, '#1fa874'); }
    if (cls === 'none') U(8, 0, 8, 1, '#3a2a22');
    return outline(g, CW, CH);
  }

  /* ---------- ไอคอน (ตาราง → จัดกลางในกรอบอย่างน้อย 16×16) ---------- */
  const PAL = {
    gem:  { W: '#ffffff', L: '#aef4ff', G: '#3fd0f0', D: '#1a8fb8', E: '#126a91' },
    gold: { W: '#fff3b0', Y: '#f4b400', y: '#b07d00', b: '#8a5a2a', d: '#5a3a1a', R: '#ff5a67', G: '#3fd0f0' },
  };
  const ICONS = {
    gem: { p: PAL.gem, r: [
      '....LLWWLLGG....', '...LWWLLGGGGD...', '..LWLLLGGGGGDD..', '.LLLLLLGGGGDDDD.', '.GGGGGGGGDDDDDE.',
      '..GGGGGGDDDDDE..', '...GGGGGDDDDE...', '....GGGGDDDE....', '.....GGGDDE.....', '......GGDE......', '.......GE.......'] },
    safe: { p: { H: '#9aa3c4', K: '#5b6380', k: '#3b4260', Y: GOLD, y: '#b07d00', B: '#1d1b2e' }, r: [
      'HHHHHHHHHHHHHK', 'HKKKKKKKKKKKKk', 'HKkkkkkkkkkKKk', 'HKkKKKKKKKkKKk', 'HKkKKyYYyKkKYk', 'HKkKyYBBYykKYk',
      'HKkKYBYYBYkKKk', 'HKkKYBYYBYkKKk', 'HKkKyYBBYykKYk', 'HKkKKyYYyKkKYk', 'HKkKKKKKKKkKKk', 'HKkkkkkkkkkKKk', 'KKKKKKKKKKKKkk', '.kk........kk.'] },
    star: { p: PAL.gold, r: [
      '.......YY.......', '......YWYY......', '......YWYY......', '.....YWWYYy.....', 'YYYYYWWYYYYYYYYy', '.YYYWWYYYYYYYyy.',
      '..YYYYYYYYYYyy..', '...YYYYYYYYyy...', '....YYYYYYyy....', '....YYYYYYYy....', '...YYYYyYYYYy...', '...YYYy..yYYYy..', '..YYyy....yyYy..', '..Yy........yy..'] },
    sparkle: { p: { W: '#ffffff', L: '#fff3b0' }, noOut: true, r: [
      '.....W.....', '.....W.....', '....LWL....', '...LWWWL...', 'WWWWWWWWWWW', '...LWWWL...', '....LWL....', '.....W.....', '.....W.....'] },
    trophy: { p: PAL.gold, r: [
      '...YYYYYYYYYY...', '.YYYWWYYYYYYyYY.', 'Y..YWYYYYYYYy..Y', 'Y..YWYYYYYYYy..Y', '.Y.YWYYYYYYYy.Y.', '..YYYYYYYYYYyYY.',
      '....YYYYYYYy....', '.....YYYYYy.....', '......YYYy......', '.......Yy.......', '.......Yy.......', '.....YYYYyy.....', '....bbbbbbbb....', '....dddddddd....'] },
    crown: { p: PAL.gold, r: ['Y....Y....Y', 'YY..YYY..YY', 'YYYYYWYYYYY', 'YWYYYYYYYYY', 'YYRYYGYYRYY', 'yyyyyyyyyyy'] },
    siren: { p: { R: '#ff4f5e', W: '#ffd0d4', r: '#b8293a', K: '#4a4f68', k: '#2c3048' }, r: [
      '.....RRRR.....', '....RWWRRR....', '...RWRRRRRr...', '...RWRRRRRr...', '...RRRRRRRr...', '...RRRRRRRr...', '..KKKKKKKKKKk.', '..kkkkkkkkkkk.'] },
    shield: { p: { G: '#3ddc97', g: '#1fa874', W: '#d4ffe9', Y: GOLD }, r: [
      'GGGGGGGGGGGG', 'GWWGGGGGGGgg', 'GWGGGYYGGGgg', 'GWGGYYYYGGgg', 'GGGGGYYGGGgg', 'GGGGGYYGGGgg', '.GGGGGGGGgg.',
      '.GGGGGGGGgg.', '..GGGGGGgg..', '...GGGGgg...', '....GGgg....', '.....Gg.....'] },
    lock: { p: { S: '#c0c6dc', s: '#8890aa', Y: GOLD, W: '#fff3b0', y: '#b07d00', K: '#1d1b2e' }, r: [
      '...ssss....', '..sSSSSs...', '.sS....Ss..', '.sS....Ss..', '.sS....Ss..', 'YYYYYYYYYYy', 'YWYYYYYYYYy', 'YWYYYKKYYYy',
      'YYYYYKKYYYy', 'YYYYYYKYYYy', 'YYYYYYYYYYy', 'yyyyyyyyyyy'] },
    key: { p: { L: '#d8fbff', G: '#3fd0f0', D: '#1a8fb8' }, r: [
      '..GGGG..........', '.GLLLLG.........', 'GL....LG........', 'GL....LGGGGGGGGG', 'GL....LDDDDDDDDD', '.GLLLLG....D.DD.', '..GGGG.....D.D..'] },
    folder: { p: { f: '#6a4fd0', F: '#9b7bff', P: '#f4f1ff', p: '#c9c2e8', Y: GOLD }, r: [
      '.ffff.........', 'ffffffffffffff', 'ffPPPPPPPPPPff', 'ffPppppppppPff', 'ffPPPPPPPPPPff', 'FFFFFFFFFFFFFF',
      'FFFFFFFFFFFFFF', 'FFFFFFYYFFFFFF', 'FFFFFFYYFFFFFF', 'FFFFFFFFFFFFFF', 'ffffffffffffff'] },
    hand: { p: { K: '#2b2540', H: '#4a4268', G: '#3fd0f0', L: '#d8fbff', R: '#ff5a67' }, r: [
      '...H.H.H....', '..HKHKHKH...', '..HKHKHKH...', 'H.HKHKHKH...', 'HKHKKKKKK...', 'HKKKKKKKKG..', '.KKKKKKKGLG.',
      '..KKKKKKKG..', '...KKKKKK...', '....KKKK....', '....RRRR....', '....RRRR....'] },
    bag: { p: { S: '#c9a26b', s: '#8a6a3e', Y: GOLD, R: '#5a3a1a' }, r: [
      '....RRRR....', '.....RR.....', '....SSSS....', '..SSSSSSSS..', '.SSSSSSSSss.', 'SSSSYYYSSSss', 'SSSYYYYYSSss',
      'SSSSYYYSSSss', 'SSSSSSSSSSss', '.SSSSSSSSss.', '..ssssssss..'] },
    bulb: { p: { Y: '#ffe066', W: '#ffffff', y: '#d4a800', g: '#9aa0b8', G: '#6a7090' }, r: [
      '..YYYYY..', '.YWWYYYy.', 'YWYYYYYYy', 'YWYYYYYYy', 'YYYYYYYYy', '.YYYYYYy.', '..YYYYy..', '..gggg...', '..GGGG...', '..gggg...', '...GG....'] },
    balloon: { p: { R: '#ff5a67', W: '#ffd0d4', r: '#c23848', L: '#c0c6dc' }, noOutRows: [8, 9, 10, 11], r: [
      '..RRRR...', '.RWRRRR..', 'RWRRRRRr.', 'RRRRRRRr.', 'RRRRRRRr.', '.RRRRRr..', '..RRRr...', '...rr....', '....L....', '...L.....', '....L....', '.....L...'] },
    museum: { p: { S: '#c9cfe6', s: '#8a92b0', W: '#eef1fb', w: '#a7aecb', Y: GOLD }, r: [
      '.......SS.......', '.....SSSSSS.....', '...SSSSSSSSSS...', '.SSSSSSSSSSSSSS.', 'YYYYYYYYYYYYYYYY', '.Ww..Ww..Ww..Ww.',
      '.Ww..Ww..Ww..Ww.', '.Ww..Ww..Ww..Ww.', '.Ww..Ww..Ww..Ww.', '.Ww..Ww..Ww..Ww.', 'SSSSSSSSSSSSSSSS', 'ssssssssssssssss'] },
    speaker: { p: { K: '#e8ecf8', k: '#9aa3bd', W: '#7fe6fa' }, r: [
      '....K.......', '...KK..W....', '.KKKK...W...', 'KKKKK.W..W..', 'KKKkK..W.W..', 'KKKkK..W.W..', 'KKKKK.W..W..', '.KKKK...W...', '...KK..W....', '....K.......'] },
    mute: { p: { K: '#e8ecf8', k: '#9aa3bd', R: '#ff4f5e' }, r: [
      '....K.......', '...KK.......', '.KKKK.R...R.', 'KKKKK..R.R..', 'KKKkK...R...', 'KKKkK..R.R..', 'KKKKK.R...R.', '.KKKK.......', '...KK.......', '....K.......'] },
    expand: { p: { W: '#e8ecf8' }, r: [
      'WWWW....WWWW', 'WWW......WWW', 'WW.W....W.WW', 'W...W..W...W', '............', '............', 'W...W..W...W', 'WW.W....W.WW', 'WWW......WWW', 'WWWW....WWWW'] },
    pin: { p: { s: '#6a7090', S: '#c0c6dc', W: '#ffffff', K: '#2c3048' }, r: [
      '..ssss..', '.sSSSSs.', 'sSWSSSSs', 'sSKKKKSs', 'sSSSSSSs', '.sSSSSs.', '..ssss..'] },
    check: { p: { G: '#3ddc97', g: '#1fa874' }, r: [
      '.........G', '........GG', '.......GGg', 'G.....GGg.', 'GG...GGg..', '.GG.GGg...', '..GGGg....', '...Gg.....'] },
    cross: { p: { R: '#ff4f5e', r: '#b8293a' }, r: [
      'RR....RR', 'RRR..RRr', '.RRRRRr.', '..RRRr..', '..RRRR..', '.RRrRRR.', 'RRr..RRR', 'Rr....RR'] },
  };
  const SWAP = {
    'trophy-s': ['trophy', { W: '#ffffff', Y: '#d7dce8', y: '#8e96ad' }],
    'trophy-b': ['trophy', { W: '#ffd2a8', Y: '#d08a4a', y: '#8a5428' }],
    vault: ['safe', { H: '#7fe8b9', K: '#2f8f68', k: '#1d5c44' }],
  };
  function iconGrid(name) {
    let def = ICONS[name], extra = null;
    if (!def && SWAP[name]) { def = ICONS[SWAP[name][0]]; extra = SWAP[name][1]; }
    if (!def) return null;
    const pal = Object.assign({}, def.p, extra || {});
    const rows = def.r, h = rows.length, w = Math.max.apply(null, rows.map(r => r.length));
    const S = Math.max(16, w + 2, h + 2), ox = ((S - w) / 2) | 0, oy = ((S - h) / 2) | 0;
    const g = new Array(S * S).fill(null);
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = pal[r[i]]; if (c) g[(oy + j) * S + ox + i] = c; } });
    const o = def.noOut ? g : outline(g, S, S);
    if (def.noOutRows) for (const j of def.noOutRows) for (let i = 0; i < S; i++) { const k = (oy + j) * S + i; if (o[k] === OUT) o[k] = null; }
    return { g: o, w: S, h: S };
  }

  /* ---------- แคช ---------- */
  const cache = {};
  function frame(cls, pose, f) {
    const k = `f:${cls}:${pose}:${f}`;
    return cache[k] || (cache[k] = toCanvas(charGrid(cls, pose, f), CW, CH));
  }
  function canvas(name) {
    if (cache[name]) return cache[name];
    let c;
    if (name.startsWith('c:')) c = frame(name.slice(2), 'idle', 0);
    else if (name.startsWith('hd:')) {
      const src = frame(name.slice(3), 'idle', 0); c = document.createElement('canvas'); c.width = 16; c.height = 16;
      c.getContext('2d').drawImage(src, 4, 0, 16, 16, 0, 0, 16, 16);
    } else { const ig = iconGrid(name) || iconGrid('star'); c = toCanvas(ig.g, ig.w, ig.h); }
    return (cache[name] = c);
  }
  const urls = {};
  const url = (name) => urls[name] || (urls[name] = canvas(name).toDataURL());
  function strip(cls, pose) {
    const k = `s:${cls}:${pose}`;
    if (urls[k]) return urls[k];
    const c = document.createElement('canvas'); c.width = CW * 2; c.height = CH;
    const x = c.getContext('2d'); x.drawImage(frame(cls, pose, 0), 0, 0); x.drawImage(frame(cls, pose, 1), CW, 0);
    return (urls[k] = c.toDataURL());
  }

  function img(name, px, cls) {
    const c = canvas(name), h = Math.round(px * c.height / c.width);
    return `<img class="px ${cls || ''}" src="${url(name)}" width="${px}" height="${h}" alt="" draggable="false">`;
  }
  // px = ความกว้าง; ตัวละครสูง 1.5 เท่าของกว้าง
  function anim(cls, pose, px, extra) {
    const s = px / CW, dur = pose === 'walk' ? 0.36 : pose === 'cheer' ? 0.5 : 1.1;
    return `<span class="spr ${extra || ''}" style="width:${px}px;height:${Math.round(CH * s)}px;background-image:url(${strip(cls, pose)});--sw:${px}px;animation-duration:${dur}s"></span>`;
  }
  const SKILL = { pick: 'hand', crack: 'key', plan: 'folder', guard: 'vault' };
  const EMOJI = { '💎': 'gem', '🏦': 'vault', '🚨': 'siren', '🛡️': 'shield', '🔒': 'lock', '🦹': 'bag', '🧠': 'bulb', '🎈': 'balloon',
    '🧤': 'hand', '⚡': 'star', '📚': 'bulb', '👑': 'crown', '🗝️': 'key', '📂': 'folder', '👐': 'hand', '🏆': 'trophy', '🕸️': 'safe', '🤔': 'bulb', '😱': 'siren', '🔥': 'star', '⏳': 'gem', '🔩': 'pin', '✅': 'check', '❌': 'cross', '🏛️': 'museum', '🔊': 'speaker', '🔇': 'mute' };
  // รับได้ทั้งชื่อไอคอนและอิโมจิเก่า
  const ic = (e) => EMOJI[e] || (ICONS[e] || SWAP[e] ? e : 'star');

  // CSS ของสไปรต์ ใส่เองทุกหน้า (index.html ไม่ได้โหลด style.css)
  const st = document.createElement('style');
  st.textContent = '.px{image-rendering:pixelated;image-rendering:crisp-edges;display:inline-block;vertical-align:middle}' +
    '.spr{display:inline-block;vertical-align:bottom;image-rendering:pixelated;image-rendering:crisp-edges;background-repeat:no-repeat;background-size:calc(var(--sw) * 2) 100%;animation:sprStep 1s steps(1,end) infinite}' +
    '@keyframes sprStep{0%{background-position:0 0}50%,100%{background-position:calc(var(--sw) * -1) 0}}';
  document.head.appendChild(st);

  // <span data-spr="gem" data-px="24"> → เติมภาพเอง
  function fill(root) { (root || document).querySelectorAll('[data-spr]:not([data-done])').forEach(el => { el.innerHTML = img(el.dataset.spr, +(el.dataset.px || 24)); el.dataset.done = 1; }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => fill()); else setTimeout(fill);

  window.Spr = { img, anim, url, canvas, frame, SKILL, ic, fill, CW, CH, names: Object.keys(ICONS).concat(Object.keys(SWAP)) };
})();
