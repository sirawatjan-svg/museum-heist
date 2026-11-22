// ============================================================
// พื้นหลังหน้าแรก (กลางคืน): โจรตัวจิ๋วย่องในห้องจัดแสดง ฉกเพชรกันไปมา
// ยามส่องไฟฉายกวาดพื้น ใครโดนแสงจะสะดุ้งแล้ววิ่งหนี
// วาดบน canvas ซ้อนเหนือภาพ SVG ของห้อง (ใช้พิกัด viewBox 1600×900 แบบ slice เดียวกัน)
// ============================================================
(function () {
  const hero = document.getElementById('stage');
  const cv = document.getElementById('hero-cv');
  if (!hero || !cv) return;
  const g = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLS = ['#ff5a67', '#3fd0f0', '#9b7bff', '#3ddc97', '#f4b400', '#ff8fc8'];

  let W = 0, H = 0, dpr = 1, s = 1, ox = 0, oy = 0, vx0 = 0, vx1 = 1600;
  function fit() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = hero.clientWidth; H = hero.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    s = Math.max(W / 1600, H / 900); ox = (W - 1600 * s) / 2; oy = (H - 900 * s) / 2;
    vx0 = Math.max(0, -ox / s); vx1 = Math.min(1600, (W - ox) / s);
  }
  const X = (x) => ox + x * s, Y = (y) => oy + y * s;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // พื้นที่เดินได้: พื้นหินอ่อน ยกเว้นรอบแท่นเพชร/เชือกกั้น
  const ok = (x, y) => y >= 705 && y <= 885 && !(x > 540 && x < 1060 && y < 832);
  function spot() {
    const a = vx0 + 50, b = vx1 - 50;
    for (let i = 0; i < 40; i++) { const x = rnd(a, b), y = rnd(705, 885); if (ok(x, y)) return { x, y }; }
    return { x: (a + b) / 2, y: rnd(845, 885) };
  }

  let thieves = [], tags = [], gems = [], motes = [], flash = 0, nextEvent = 1.4, t = 0, beam = { x: 800, y: 800, r: 120 };
  function makeThieves() {
    const n = W < 700 ? 3 : 5;
    thieves = Array.from({ length: n }, (_, i) => { const p = spot(); return { x: p.x, y: p.y, tx: p.x, ty: p.y, col: COLS[i % COLS.length], cls: ['pick', 'crack', 'plan', 'guard'][i % 4], sp: rnd(55, 80), ph: rnd(0, 6), wait: rnd(0, 1.5), mode: 'walk', bag: i % 2 ? 10 + i * 4 : 0, face: 1, shake: 0, shield: 0, seen: 0 }; });
  }
  function makeMotes() {
    motes = Array.from({ length: 34 }, () => ({ x: rnd(700, 900), y: rnd(80, 640), v: rnd(-8, 8), a: rnd(0, 6), r: rnd(0.8, 2.2) }));
  }

  function tag(x, y, text, kind) { tags.push({ x, y, text, kind, life: 1.8 }); }

  function heist() {
    const idle = thieves.filter(th => th.mode === 'walk');
    if (idle.length < 2) return;
    const a = idle[(Math.random() * idle.length) | 0];
    const others = idle.filter(b => b !== a);
    const b = others.sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[Math.min(1, others.length - 1)];
    a.mode = 'dash'; a.target = b; a.sp = 230; a.wait = 0;
  }

  function arrive(a) {
    const b = a.target; a.target = null;
    const r = Math.random();
    if (r < 0.62) {                                    // ปล้นสำเร็จ
      const n = 6 + ((Math.random() * 12) | 0);
      for (let i = 0; i < 7; i++) gems.push({ x: b.x, y: b.y - 40, vx: (a.x - b.x) / 0.7 + rnd(-60, 60), vy: rnd(-280, -170), life: 0.75, age: 0 });
      a.bag += n; b.bag = Math.max(0, b.bag - n);
      tag(a.x, a.y - 100, 'ฉก +' + n + ' 💎', 'gold');
      if (!reduce) b.shake = 0.5; flee(b, 190);
    } else if (r < 0.82) {                             // พลาด สัญญาณดัง
      if (!reduce) flash = 1;
      tag(a.x, a.y - 100, '🚨 สัญญาณดัง!', 'alarm');
      flee(a, 240);
    } else {                                           // เจอล็อก
      b.shield = 1.2;
      tag(b.x, b.y - 100, '🔒 ล็อกไว้!', 'lock');
      flee(a, 150);
    }
    if (a.mode === 'dash') { a.mode = 'walk'; a.sp = rnd(55, 80); a.wait = rnd(0.6, 1.4); }
  }
  function flee(th, sp) { const p = spot(); th.tx = p.x; th.ty = p.y; th.mode = 'flee'; th.sp = sp; th.wait = 0; }

  function step(dt) {
    t += dt;
    // ไฟฉายยามกวาดไปมาบนพื้น
    const cx = (vx0 + vx1) / 2, span = Math.max(80, (vx1 - vx0) / 2 - 80);
    beam.x = cx + Math.sin(t * 0.42) * span; beam.y = 805 + Math.sin(t * 0.83) * 45;
    nextEvent -= dt;
    if (nextEvent <= 0) { heist(); nextEvent = rnd(2.2, 3.4); }
    for (const th of thieves) {
      th.shake = Math.max(0, th.shake - dt); th.shield = Math.max(0, th.shield - dt); th.seen = Math.max(0, th.seen - dt);
      // โดนไฟฉายส่อง → สะดุ้งแล้ววิ่งหนี
      const ex = (th.x - beam.x) / beam.r, ey = (th.y - beam.y) / (beam.r * 0.42);
      if (th.mode === 'walk' && th.seen <= 0 && ex * ex + ey * ey < 0.7) { th.seen = 5; tag(th.x, th.y - 100, '❗', 'seen'); flee(th, 210); }
      if (th.mode === 'dash' && th.target) { th.tx = th.target.x - 44 * Math.sign(th.target.x - th.x || 1); th.ty = th.target.y; }
      const dx = th.tx - th.x, dy = th.ty - th.y, dist = Math.hypot(dx, dy);
      if (dist < 4) {
        if (th.mode === 'dash') { arrive(th); continue; }
        if (th.mode === 'flee') { th.mode = 'walk'; th.sp = rnd(55, 80); th.wait = rnd(0.4, 1.2); }
        th.wait -= dt;
        if (th.wait <= 0) { const p = spot(); th.tx = p.x; th.ty = p.y; th.wait = rnd(0.8, 2.2); }
        th.moving = false;
      } else {
        const v = Math.min(dist, th.sp * dt);
        let nx = th.x + dx / dist * v, ny = th.y + dy / dist * v;
        if (!ok(nx, ny)) ny = Math.max(ny, 838);           // อ้อมแท่นเพชรทางด้านหน้า
        th.x = nx; th.y = ny; th.moving = true; th.ph += dt * (th.sp / 9);
        if (Math.abs(dx) > 2) th.face = dx > 0 ? 1 : -1;
      }
    }
    for (const gm of gems) { gm.age += dt; gm.vy += 620 * dt; gm.x += gm.vx * dt; gm.y += gm.vy * dt; }
    gems = gems.filter(gm => gm.age < gm.life);
    for (const tg of tags) { tg.life -= dt; tg.y -= 18 * dt; }
    tags = tags.filter(tg => tg.life > 0);
    for (const m of motes) { m.y += m.v * dt; m.a += dt; if (m.y < 60 || m.y > 650) m.v *= -1; }
    flash = Math.max(0, flash - dt * 1.4);
  }

  // ---------- วาด ----------
  function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  function drawThief(th) {
    const depth = 0.82 + 0.2 * (th.y - 705) / 180;
    const k = s * depth * 1.4;
    const px = X(th.x) + (th.shake ? Math.sin(t * 60) * 3 * k : 0), py = Y(th.y);
    const bob = th.moving ? Math.abs(Math.sin(th.ph)) * 4 * k : 0;
    g.save();
    // เงา
    g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.ellipse(px, py, 22 * k, 6 * k, 0, 0, Math.PI * 2); g.fill();
    g.translate(px, py - bob); g.scale(th.face * k, k);
    // ถุงเพชรบนหลัง
    if (th.bag > 0) {
      const bs = Math.min(1.35, 0.85 + th.bag / 60);
      g.fillStyle = '#a8865a'; g.beginPath(); g.ellipse(-20, -40, 13 * bs, 15 * bs, -0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3fd0f0'; g.shadowColor = '#3fd0f0'; g.shadowBlur = 8;
      g.beginPath(); g.moveTo(-20, -50 * (0.9 + bs * 0.1)); g.lineTo(-14, -43); g.lineTo(-20, -36); g.lineTo(-26, -43); g.closePath(); g.fill();
      g.shadowBlur = 0;
    }
    // ตัวละครพิกเซล (js/sprites.js) สูงราว 94 หน่วยเท่าของเดิม
    if (window.Spr) {
      const u = 2.75, pose = th.moving ? 'walk' : 'idle';
      const f = th.moving ? (Math.floor(th.ph / Math.PI) & 1) : (Math.floor(t * 1.6 + th.sp) & 1);
      g.imageSmoothingEnabled = false;
      g.drawImage(Spr.frame(th.cls, pose, f), -12 * u, -34 * u, Spr.CW * u, Spr.CH * u);
    }
    g.restore();
    // โล่ล็อก
    if (th.shield > 0) {
      g.save(); g.globalAlpha = Math.min(1, th.shield * 1.5) * 0.9;
      g.strokeStyle = '#3fd0f0'; g.lineWidth = 3 * k; g.fillStyle = 'rgba(63,208,240,.14)'; g.shadowColor = '#3fd0f0'; g.shadowBlur = 16;
      g.beginPath(); g.arc(px, py - 45 * k, 48 * k, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
    }
  }

  function drawLight() {
    if (!isFinite(X(beam.x)) || !isFinite(beam.r * s) || !(beam.r * s > 0)) return;
    const sx = X(beam.x), sy = Y(beam.y), r = beam.r * s;
    g.save();
    g.globalCompositeOperation = 'lighter';
    // ลำแสงจากเพดาน
    const top = X((vx0 + vx1) / 2 + (beam.x - 800) * 0.25);
    const cone = g.createLinearGradient(0, 0, 0, sy);
    cone.addColorStop(0, 'rgba(255,236,190,.0)'); cone.addColorStop(1, 'rgba(255,236,190,.13)');
    g.fillStyle = cone;
    g.beginPath(); g.moveTo(top - 10 * s, 0); g.lineTo(top + 10 * s, 0); g.lineTo(sx + r * 0.95, sy); g.lineTo(sx - r * 0.95, sy); g.closePath(); g.fill();
    // วงแสงบนพื้น
    const grd = g.createRadialGradient(sx, sy, 0, sx, sy, r);
    grd.addColorStop(0, 'rgba(255,236,190,.42)'); grd.addColorStop(0.7, 'rgba(255,236,190,.16)'); grd.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = grd; g.beginPath(); g.ellipse(sx, sy, r, r * 0.42, 0, 0, Math.PI * 2); g.fill();
    // ฝุ่นลอยในแสงสปอตไลต์เหนือเพชร
    for (const m of motes) {
      const a = 0.25 + 0.35 * Math.abs(Math.sin(m.a * 1.3));
      g.fillStyle = `rgba(255,248,225,${a})`; g.beginPath(); g.arc(X(m.x), Y(m.y), m.r * Math.max(0.7, s), 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function drawGem(x, y, k, a) {
    g.save(); g.globalAlpha = a; g.translate(x, y); g.scale(k, k);
    g.shadowColor = '#3fd0f0'; g.shadowBlur = 10;
    g.fillStyle = '#3fd0f0'; g.beginPath(); g.moveTo(-7, -5); g.lineTo(7, -5); g.lineTo(10, -1); g.lineTo(0, 9); g.lineTo(-10, -1); g.closePath(); g.fill();
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(-7, -4, 5, 2.5);
    g.restore();
  }

  const TAGSTYLE = {
    gold: ['#f4b400', '#1a1300', null], alarm: ['#ff4f5e', '#fff', null],
    lock: ['rgba(10,14,30,.85)', '#8fe9ff', '#3fd0f0'], seen: ['#fff3c4', '#1a1300', null]
  };
  function drawTag(tg) {
    const [bg, fg, bd] = TAGSTYLE[tg.kind];
    const a = Math.min(1, tg.life * 2.2), k = Math.max(0.75, s);
    g.save(); g.globalAlpha = a;
    g.font = `700 ${15 * k}px Kanit, sans-serif`;
    const w = g.measureText(tg.text).width + 22 * k, h = 30 * k, x = X(tg.x) - w / 2, y = Y(tg.y) - h / 2;
    g.shadowColor = tg.kind === 'alarm' ? 'rgba(255,79,94,.7)' : 'rgba(0,0,0,.5)'; g.shadowBlur = 14; g.shadowOffsetY = 3;
    g.fillStyle = bg; rr(x, y, w, h, h / 2); g.fill();
    g.shadowColor = 'transparent';
    if (bd) { g.strokeStyle = bd; g.lineWidth = 1.5; g.stroke(); }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tg.text, x + w / 2, y + h / 2 + 1);
    g.restore();
  }

  function draw() {
    if (!(s > 0) || !W || !H) return;   // ขนาด 0 ตอนซ่อนแท็บ → กันค่า NaN
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    drawLight();
    [...thieves].sort((a, b) => a.y - b.y).forEach(drawThief);
    for (const gm of gems) drawGem(X(gm.x), Y(gm.y), s * 1.1, 1 - gm.age / gm.life * 0.6);
    tags.forEach(drawTag);
    if (flash > 0) {
      const grd = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
      grd.addColorStop(0, 'rgba(255,79,94,0)'); grd.addColorStop(1, `rgba(255,79,94,${0.5 * flash})`);
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
    }
  }

  // ---------- ลูป ----------
  // ใช้ requestAnimationFrame เป็นหลัก แต่บางหน้าต่าง (เช่นแผงพรีวิว) ไม่ยิง rAF เลย → มีตัวจับเวลาสำรองเดินแทน
  let lastTick = 0, visible = true;
  function tick(now) {
    if (!visible || document.hidden) { lastTick = now; return; }
    const dt = Math.min(0.05, (now - lastTick) / 1000 || 0); lastTick = now;
    step(dt); draw();
  }
  function frame(now) { tick(now); requestAnimationFrame(frame); }

  // ครูต้องการให้ฉากเคลื่อนไหวเสมอ (เครื่องที่ปิดเอฟเฟกต์ของ Windows จะส่ง reduced-motion มา)
  // → ยังเดินอยู่ แต่ถ้าผู้ใช้ขอลดการเคลื่อนไหว จะตัดจอวาบแดงและอาการสั่นออก
  fit(); makeThieves(); makeMotes();
  lastTick = performance.now();
  requestAnimationFrame(frame);
  setInterval(() => { const now = performance.now(); if (now - lastTick > 120) tick(now); }, 40);
  addEventListener('resize', () => { const oldW = W; fit(); if ((oldW < 700) !== (W < 700)) makeThieves(); thieves.forEach(th => { if (!ok(th.x, th.y) || th.x < vx0 || th.x > vx1) { const p = spot(); th.x = th.tx = p.x; th.y = th.ty = p.y; } }); draw(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(hero);

  // ใช้ตรวจในโหมดทดสอบ
  window.__heroAnim = { step: (sec) => { for (let i = 0; i < sec * 30; i++) step(1 / 30); draw(); }, state: () => ({ thieves: thieves.length, tags: tags.map(t => t.text), t: +t.toFixed(2) }) };
})();
