/* scene.js — ฉากพื้นหลังห้องพิพิธภัณฑ์ยามค่ำแบบพิกเซล (320×180 ขยายเต็มจอ)
   Scene.mount({ dim })  ใส่ฉากหลังทุกหน้า · Scene.alarm()  จอวาบแดงตอนปล้นใหญ่
   วิ่งด้วย setInterval เสมอ (เครื่องครูปิดแอนิเมชัน + แผงพรีวิวไม่ยิง rAF) */
(function () {
  const W = 320, H = 180;
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const PEDS = [64, 160, 256], PILLARS = [22, 104, 200, 282];

  function drawStatic(b) {
    const r = rng(11);
    const R = (x, y, w, h, c) => { b.fillStyle = c; b.fillRect(x, y, w, h); };
    // ผนังอิฐ
    R(0, 0, W, 118, '#0d1230');
    for (let row = 0, y = 11; y < 96; row++, y += 6) {
      const off = row % 2 ? 8 : 0;
      for (let x = -16; x < W + 16; x += 16) R(x + off + 1, y + 1, 15, 5, ['#161d44', '#18204a', '#141a3d', '#1a2250'][r() * 4 | 0]);
    }
    // บัวด้านบน
    R(0, 0, W, 9, '#090c20'); R(0, 9, W, 1, '#8a6410'); R(0, 10, W, 1, '#3a2c08');
    // หน้าต่างโค้ง + พระจันทร์
    const cx = 152;
    const arch = (rad, top, bot, c) => { for (let y = top - rad; y < top; y++) { const h = Math.round(Math.sqrt(rad * rad - (top - y) * (top - y))); R(cx - h, y, h * 2, 1, c); } R(cx - rad, top, rad * 2, bot - top, c); };
    arch(23, 38, 84, '#2a3264'); arch(20, 38, 81, '#0a1540');
    for (let i = 0; i < 26; i++) { const x = cx - 18 + r() * 36 | 0, y = 20 + r() * 58 | 0; R(x, y, 1, 1, r() < .3 ? '#ffffff' : '#7f8fc8'); }
    R(158, 24, 9, 9, '#f3eccf'); R(157, 26, 11, 5, '#f3eccf'); R(160, 23, 5, 11, '#f3eccf'); R(160, 27, 2, 2, '#d8cfa8'); R(164, 30, 2, 1, '#d8cfa8');
    R(cx - 1, 16, 2, 66, '#2a3264'); R(cx - 20, 56, 40, 2, '#2a3264');
    // ภาพวาดในกรอบทอง
    const frame = (x, y, w, h) => { R(x - 1, y - 1, w + 2, h + 2, '#07060f'); R(x, y, w, h, '#b07d00'); R(x + 1, y + 1, w - 2, h - 2, '#f4b400'); R(x + 3, y + 3, w - 6, h - 6, '#7a5400'); };
    frame(40, 24, 48, 40); R(44, 28, 40, 32, '#1e2a5a');
    for (let x = 44; x < 84; x++) { const y1 = 48 + Math.round(Math.sin(x / 6) * 4), y2 = 52 + Math.round(Math.cos(x / 5) * 3); R(x, y1, 1, 60 - y1, '#24544a'); R(x, y2, 1, 60 - y2, '#183c36'); }
    R(72, 32, 5, 5, '#f3eccf'); R(50, 34, 1, 1, '#fff'); R(60, 30, 1, 1, '#fff');
    frame(226, 22, 40, 46); R(230, 26, 32, 38, '#4a2232');
    R(240, 33, 12, 14, '#e3b48c'); R(238, 30, 16, 5, '#2a1a12'); R(238, 33, 2, 12, '#2a1a12'); R(252, 33, 2, 12, '#2a1a12');
    R(243, 38, 2, 1, '#2a1a12'); R(248, 38, 2, 1, '#2a1a12'); R(244, 43, 4, 1, '#a0604a'); R(236, 48, 20, 16, '#3a2a5a'); R(244, 48, 4, 4, '#e3b48c');
    // ไฟส่องภาพ
    for (const lx of [64, 246]) { R(lx - 5, 14, 10, 3, '#3a4480'); R(lx - 1, 11, 2, 3, '#2a3264'); }
    // ไม้บุผนังล่าง
    R(0, 96, W, 22, '#0f1438'); R(0, 96, W, 1, '#8a6410'); R(0, 97, W, 1, '#3a2c08');
    for (let x = 0; x < W; x += 40) { R(x + 4, 101, 32, 13, '#131a46'); R(x + 4, 101, 32, 1, '#1d2660'); R(x + 4, 113, 32, 1, '#0a0e2a'); }
    // เสา
    for (const x of PILLARS) {
      R(x, 11, 16, 107, '#2a3264'); R(x + 2, 11, 3, 107, '#3a4682'); R(x + 12, 11, 4, 107, '#1d2450');
      for (let y = 20; y < 108; y += 9) R(x + 7, y, 1, 6, '#222a5a');
      R(x - 3, 11, 22, 5, '#3a4682'); R(x - 3, 16, 22, 2, '#1d2450'); R(x - 3, 110, 22, 8, '#3a4682'); R(x - 3, 110, 22, 1, '#4c5ba0');
    }
    // พื้นกระเบื้องหมากรุก (ใกล้กล้องยิ่งใหญ่)
    let y = 118;
    const rows = [[6, 12], [7, 14], [8, 16], [9, 19], [10, 23], [12, 27], [10, 32]];
    rows.forEach(([h, w], i) => {
      const n = Math.ceil(W / w / 2) + 2, start = 160 - n * w;
      for (let k = 0; k < n * 2; k++) R(start + k * w, y, w, h, (k + i) % 2 ? '#1a2152' : '#11173a');
      y += h;
    });
    R(0, 118, W, 1, '#2f3a78');
    // แท่นตู้กระจก
    for (const px of PEDS) {
      R(px - 13, 150, 26, 3, 'rgba(0,0,0,.35)');
      R(px - 10, 128, 20, 22, '#2a3264'); R(px - 10, 128, 3, 22, '#3a4682'); R(px + 7, 128, 3, 22, '#1d2450');
      R(px - 12, 125, 24, 3, '#4c5ba0'); R(px - 12, 128, 24, 1, '#1d2450');
      R(px - 6, 136, 12, 6, '#1d2450'); R(px - 5, 137, 10, 4, '#8a6410');
      R(px - 9, 104, 18, 21, 'rgba(150,215,255,.10)');
      R(px - 9, 104, 18, 1, '#9fdcff'); R(px - 9, 104, 1, 21, 'rgba(159,220,255,.55)'); R(px + 8, 104, 1, 21, 'rgba(159,220,255,.35)');
      R(px - 7, 106, 1, 8, 'rgba(255,255,255,.35)');
    }
    // เสาเชือกกั้น
    for (const [a, c] of [[86, 134], [182, 230]]) {
      for (const x of [a, c]) { R(x, 136, 2, 14, '#f4b400'); R(x - 1, 135, 4, 2, '#ffd36b'); R(x - 1, 149, 4, 2, '#b07d00'); }
      for (let x = a + 2; x < c; x++) { const k = (x - a) / (c - a), yy = 138 + Math.round(Math.sin(k * Math.PI) * 5); R(x, yy, 1, 2, '#c0283a'); }
    }
    // กล้องวงจรปิด
    R(300, 9, 2, 5, '#3b4260'); R(292, 14, 14, 7, '#5b6380'); R(292, 14, 14, 1, '#8890aa'); R(288, 15, 4, 5, '#1d1b2e');
  }

  let alarmT = 0;
  function mount(opts) {
    opts = opts || {};
    if (document.querySelector('.scene-cv')) return;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'scene-cv';
    const vig = document.createElement('div'); vig.className = 'scene-vig';
    if (opts.dim != null) vig.style.setProperty('--dim', opts.dim);
    document.body.prepend(vig); document.body.prepend(cv);
    const g = cv.getContext('2d');
    const base = document.createElement('canvas'); base.width = W; base.height = H;
    drawStatic(base.getContext('2d'));
    const r = rng(5);
    const motes = Array.from({ length: 26 }, () => ({ x: r() * W, y: 20 + r() * 140, v: 2 + r() * 4, p: r() * 6 }));
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); };
    const laser = (y0, y1, a) => {
      for (let x = 0; x < W; x++) { const y = Math.round(y0 + (y1 - y0) * x / W); R(x, y - 1, 1, 3, `rgba(255,60,80,${0.18 * a})`); R(x, y, 1, 1, `rgba(255,90,105,${0.85 * a})`); }
    };
    const t0 = performance.now();
    function frame() {
      const t = (performance.now() - t0) / 1000;
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.drawImage(base, 0, 0);
      // แสงส่องภาพวาด
      g.globalCompositeOperation = 'lighter';
      for (const lx of [64, 246]) { g.fillStyle = 'rgba(255,220,150,.07)'; g.beginPath(); g.moveTo(lx - 4, 17); g.lineTo(lx + 4, 17); g.lineTo(lx + 28, 70); g.lineTo(lx - 28, 70); g.fill(); }
      // ไฟฉายยามกวาด
      const sx = 160 + Math.sin(t * 0.33) * 128, top = 160 + (sx - 160) * 0.25;
      g.fillStyle = 'rgba(255,236,190,.06)'; g.beginPath(); g.moveTo(top - 4, 10); g.lineTo(top + 4, 10); g.lineTo(sx + 26, 150); g.lineTo(sx - 26, 150); g.fill();
      for (let k = 0; k < 4; k++) { g.fillStyle = `rgba(255,236,190,${0.05 + k * 0.025})`; g.beginPath(); g.ellipse(sx, 150, 30 - k * 6, 8 - k * 1.6, 0, 0, Math.PI * 2); g.fill(); }
      // ฝุ่นลอย
      for (const m of motes) {
        m.y -= m.v / 12; if (m.y < 14) m.y = 160; m.x += Math.sin(t + m.p) * 0.08;
        const near = Math.abs(m.x - (sx + (m.y - 150) * (sx - top) / 140 * -1)) < 24;
        R(m.x, m.y, 1, 1, `rgba(255,248,225,${near ? 0.55 : 0.12})`);
      }
      g.globalCompositeOperation = 'source-over';
      // เพชรในตู้
      PEDS.forEach((px, i) => {
        const bob = Math.round(Math.sin(t * 2.2 + i * 2));
        if (window.Spr) { g.imageSmoothingEnabled = false; g.drawImage(Spr.canvas('gem'), px - 7, 107 + bob, 14, 14); }
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = 'rgba(63,208,240,.10)'; g.beginPath(); g.arc(px, 114, 9, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
        const sp = (t * 1.3 + i * 0.7) % 3;
        if (sp < 0.5) { const x = px - 4 + i * 3, y = 108 + i; const c = '#ffffff'; R(x, y - 2, 1, 5, c); R(x - 2, y, 5, 1, c); }
      });
      // ดาวกะพริบนอกหน้าต่าง
      if (Math.sin(t * 3) > 0.6) R(141, 30, 1, 1, '#ffffff');
      if (Math.sin(t * 2.3 + 1) > 0.6) R(163, 64, 1, 1, '#ffffff');
      // เลเซอร์กันขโมย
      const a = 0.75 + 0.25 * Math.sin(t * 9);
      laser(128 + Math.sin(t * 0.5) * 8, 170 + Math.cos(t * 0.4) * 6, a);
      laser(172 + Math.sin(t * 0.37 + 1) * 6, 132 + Math.cos(t * 0.45) * 8, a * 0.8);
      // ไฟกล้อง
      R(289, 16, 2, 2, (t % 1.2) < 0.6 ? '#ff4f5e' : '#4a1a22');
      // สัญญาณกันขโมย
      if (alarmT > t) { const k = Math.abs(Math.sin((alarmT - t) * 9)); g.fillStyle = `rgba(255,40,60,${0.32 * k})`; g.fillRect(0, 0, W, H); }
      g.__t = t;
    }
    frame();
    setInterval(frame, 83);
    window.Scene._now = () => (performance.now() - t0) / 1000;
  }
  window.Scene = { mount, alarm: (sec) => { alarmT = (window.Scene._now ? window.Scene._now() : 0) + (sec || 1.4); } };
})();
