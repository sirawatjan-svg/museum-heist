// ============================================================
// Player — มือถือนักเรียน: เข้าห้อง → เลือกอาชีพ → ตอบคำถาม / ปล้น / ล็อกตู้ → ผลส่วนตัว
// เพชรจริงอยู่ที่จอครู (board) มือถือแค่ส่งการกระทำขึ้น acts และฟังผลจาก msg/{pid}
// ============================================================
const Player = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TU = Rules.TUNE;
  const gem = '<svg class="gem-ico" viewBox="0 0 64 64"><use href="#gem"/></svg>';
  let code = null, R = null, pid = null, name = '', meta = null, me = null, board = {}, questions = [], players = {};
  let unsubs = [], phase = null, round = 0;
  let order = [], qi = 0, qStart = 0, locked = true, streak = 0, inHeist = false, nextT = null;
  let myCor = 0, pending = 0; // ตอบถูกสะสม (นับในเครื่องให้ตอบสนองทันที) · รอบปล้นที่ค้าง
  const store = Net.isLocal ? sessionStorage : localStorage; // โหมดทดสอบ: แต่ละแท็บเป็นคนละคน
  const KEY = () => 'mh-pid-' + code;

  function show(id) { document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === id)); window.scrollTo(0, 0); }
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.style.display = ''; clearTimeout(el._t); el._t = setTimeout(() => el.style.display = 'none', ms || 1800); }
  function vib(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
  const myB = () => board[pid] || null;

  // ---------------- เข้าห้อง ----------------
  function initJoin() {
    const rc = new URL(location.href).searchParams.get('room');
    if (rc) $('j-code').value = rc;
    $('j-name').value = localStorage.getItem('mh-name') || '';
    $('btn-join').onclick = join;
    $('j-name').onkeydown = (e) => { if (e.key === 'Enter') join(); };
  }
  async function join() {
    code = $('j-code').value.trim(); name = $('j-name').value.trim();
    if (!/^\d{6}$/.test(code)) { $('j-msg').textContent = 'รหัสห้องต้องเป็นตัวเลข 6 หลัก'; return; }
    if (!name) { $('j-msg').textContent = 'ใส่ชื่อเล่นก่อนนะ'; return; }
    SFX.ensure();
    $('btn-join').disabled = true; $('j-msg').textContent = '';
    R = 'mh/' + code;
    await Net.ready();
    const m = await Net.once(R + '/meta');
    if (!m) { $('j-msg').textContent = 'ไม่พบห้องนี้ ลองเช็กรหัสอีกครั้ง'; $('btn-join').disabled = false; return; }
    localStorage.setItem('mh-name', name);
    pid = store.getItem(KEY());
    const existing = pid ? await Net.once(R + '/players/' + pid) : null;
    if (!existing) { pid = 'p' + Math.random().toString(36).slice(2, 10); store.setItem(KEY(), pid); await Net.set(R + '/players/' + pid, { name, joinedAt: Net.now(), uid: Net.uid() || null }); }
    else if (existing.name !== name) await Net.update(R + '/players/' + pid, { name });
    location.hash = 'p' + code;
    bind();
  }

  function bind() {
    unsubs.forEach(u => u()); unsubs = [];
    $('lb-code').textContent = code; $('lb-name').textContent = name;
    unsubs.push(Net.on(R + '/meta', v => { if (!v) { alert('ครูปิดห้องแล้ว'); location.href = location.pathname + location.search.replace(/[?&]room=\d+/, ''); return; } meta = v; onMeta(); }));
    unsubs.push(Net.on(R + '/players', v => { players = v || {}; $('lb-count').textContent = Object.keys(players).length + ' คน'; renderClasses(); }));
    unsubs.push(Net.on(R + '/board', v => { board = v || {}; renderHud(); if (inHeist && $('h-pick').style.display !== 'none') renderTargets(); }));
    unsubs.push(Net.on(R + '/msg/' + pid, onMsg));
    Net.once(R + '/questions').then(q => { questions = q || []; });
  }

  // ---------------- เฟส ----------------
  function onMeta() {
    if (meta.round !== round) { round = meta.round; streak = 0; }
    if (meta.phase === phase) return;
    phase = meta.phase;
    if (phase === 'lobby') { closeHeist(); show('v-lobby'); renderClasses(); }
    else if (phase === 'play') startPlay();
    else if (phase === 'end') { stopQ(); closeHeist(); show('v-end'); Net.once(R + '/results').then(renderEnd); }
  }

  // ---------------- เลือกอาชีพ ----------------
  function renderClasses() {
    const mine = players[pid] && players[pid].cls;
    $('cls-grid').innerHTML = Rules.CLASSES.map(c => `<button class="cls ${mine === c.id ? 'on' : ''}" data-c="${c.id}" style="--cc:${c.color}"><div class="e">${c.emoji}</div><b>${c.name}</b><small>${c.power}</small><small style="color:var(--gold-ink)">${c.skillEmoji} ${c.skill}</small></button>`).join('');
    $('cls-grid').querySelectorAll('.cls').forEach(b => b.onclick = () => { if (phase !== 'lobby') return; Net.update(R + '/players/' + pid, { cls: b.dataset.c }); SFX.play('pop'); vib(30); });
    const c = mine ? Rules.cls(mine) : null;
    $('lb-pick').innerHTML = c ? `${c.emoji} คุณคือ <b>${c.name}</b><br><span class="muted" style="font-size:.92rem">${c.power}</span><br><span style="font-size:.92rem;color:var(--gold-ink)">${c.skillEmoji} สกิล ${c.skill}: ${c.skillDesc}</span>` : 'ยังไม่ได้เลือก (ถ้าไม่เลือกจะได้แบบสุ่ม)';
  }

  // ---------------- เล่น ----------------
  function seededShuffle(arr, seed) {
    let h = 2166136261; for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => { h += 0x6D2B79F5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
  }
  async function startPlay() {
    if (!questions.length) questions = (await Net.once(R + '/questions')) || [];
    order = seededShuffle(questions.map((_, i) => i), pid + ':' + round);
    qi = 0; show('v-play');
    const P0 = myB(); myCor = P0 && meta.startAt && Net.now() > meta.startAt ? (P0.cor || 0) : 0; pending = P0 && myCor ? (P0.hq || 0) : 0;
    renderHud();
    const ov = $('p-countdown');
    const tick = () => {
      const left = meta.startAt - Net.now();
      if (left <= 0) { ov.style.display = 'none'; nextQuestion(); return; }
      ov.style.display = 'flex';
      const n = String(Math.ceil(left / 1000)); if ($('p-cd').textContent !== n) { $('p-cd').textContent = n; SFX.play('count'); }
      setTimeout(tick, 60);
    };
    tick();
    clearInterval(timeT); timeT = setInterval(renderTime, 500); renderTime();
  }
  let timeT = null;
  function gameLeft() { return meta && meta.endAt ? meta.endAt - Net.now() : 0; }
  function renderTime() {
    if (phase !== 'play') return;
    const sec = Math.max(0, Math.ceil(gameLeft() / 1000));
    $('p-time').textContent = 'เหลือ ' + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    $('p-time').style.color = sec <= 30 ? 'var(--bad)' : '';
    if (sec <= 0) stopQ();
    renderProgress();
  }

  let lastD = null;
  function renderHud() {
    if (phase !== 'play') return;
    const P = myB();
    const list = Object.entries(board).sort((a, b) => (b[1].d - a[1].d) || (b[1].cor - a[1].cor) || a[1].n.localeCompare(b[1].n));
    const rank = list.findIndex(x => x[0] === pid) + 1;
    $('p-rank').textContent = rank ? '#' + rank : '#–';
    $('p-of').textContent = 'จาก ' + list.length + ' คน';
    $('p-top3').innerHTML = list.slice(0, 3).map(([id, x], i) => `<div class="${id === pid ? 'me' : ''}"><b>${['🥇', '🥈', '🥉'][i]}</b><span class="n">${esc(x.n)}</span><b>${x.d}</b></div>`).join('');
    if (!P) return;
    $('p-cls').textContent = Rules.cls(P.c).emoji;
    $('p-dia').innerHTML = P.d + gem;
    if (lastD != null && P.d !== lastD) { $('p-dia').classList.remove('bump'); void $('p-dia').offsetWidth; $('p-dia').classList.add('bump'); }
    lastD = P.d;
    renderProgress();
  }
  // ความคืบหน้า: ปล้นอัตโนมัติ (ทุก 3 ข้อ) + สกิล (ทุก 9 ข้อ) + เอฟเฟกต์ที่กำลังทำงาน
  function renderProgress() {
    const P = myB(); if (!P) return;
    const c = Rules.cls(P.c);
    const h = myCor % TU.perHeist, s = myCor % TU.perSkill;
    $('hz-dots').innerHTML = Array.from({ length: TU.perHeist }, (_, i) => `<i class="${i < h ? 'on' : ''}"></i>`).join('');
    $('hz-text').textContent = pending > 0 ? `รอปล้น ${pending} รอบ (รอเป้าหมดโล่)` : h === TU.perHeist - 1 ? 'อีก 1 ข้อ ได้ปล้น!' : `ตอบถูกอีก ${TU.perHeist - h} ข้อ`;
    $('pg-heist').classList.toggle('full', pending > 0 || h === TU.perHeist - 1);
    $('sk-name').textContent = `${c.skillEmoji} ${c.skill}`;
    $('sk-bar').style.width = (s / TU.perSkill * 100) + '%';
    $('sk-text').textContent = s === TU.perSkill - 1 ? 'อีก 1 ข้อ สกิลทำงาน!' : `ตอบถูกอีก ${TU.perSkill - s} ข้อ`;
    $('pg-skill').classList.toggle('full', s >= TU.perSkill - 2);
    const now = Net.now(), fx = [];
    if (P.gk > 0) fx.push('🗝️ กุญแจผีพร้อม: ปล้นครั้งหน้าสำเร็จแน่');
    if (P.dbl > 0) fx.push(`📂 เพชร ×2 อีก ${P.dbl} ข้อ`);
    if (now < P.vault) fx.push(`🏦 ตู้นิรภัย ${Math.ceil((P.vault - now) / 1000)} วิ`);
    if (now < P.sh) fx.push(`🛡️ โล่คุ้มกัน ${Math.ceil((P.sh - now) / 1000)} วิ`);
    $('p-fx').innerHTML = fx.map(t => `<span>${t}</span>`).join('');
  }

  function nextQuestion() {
    if (phase !== 'play' || gameLeft() <= 0 || inHeist) return;
    if (pending > 0 && eligible() > 0) { openHeist(); return; }   // ครบ 3 ข้อ → เด้งหน้าปล้นเอง (ถ้าทุกคนมีโล่ เก็บรอบปล้นไว้ก่อน)
    if (!order.length) return;
    const q = questions[order[qi % order.length]]; qi++;
    locked = false; qStart = Date.now();
    $('p-qt').textContent = q.text; $('p-explain').textContent = '';
    $('p-choices').innerHTML = '';
    ['a', 'b', 'c', 'd'].forEach((k, i) => {
      const b = document.createElement('button'); b.className = 'choice';
      b.innerHTML = `<span class="k">${'กขคง'[i]}</span><span>${esc(q[k])}</span>`;
      b.onclick = () => answer(q, i);
      $('p-choices').appendChild(b);
    });
    runBar(meta.qTime || 20000, () => { if (!locked) answer(q, -1); });
  }
  let barRaf = null;
  function runBar(ms, onEnd) {
    stopBar(); const t0 = performance.now(); const bar = $('p-qtime');
    const loop = (now) => { const p = Math.max(0, 1 - (now - t0) / ms); bar.style.width = (p * 100) + '%'; bar.style.background = p < .25 ? 'var(--alarm)' : ''; if (p > 0) barRaf = requestAnimationFrame(loop); else { barRaf = null; onEnd(); } };
    barRaf = requestAnimationFrame(loop);
  }
  function stopBar() { if (barRaf) cancelAnimationFrame(barRaf); barRaf = null; }
  function stopQ() { stopBar(); locked = true; }

  function answer(q, i) {
    if (locked) return; locked = true; stopBar();
    const ms = Date.now() - qStart, ok = i === q.correct;
    const ch = $('p-choices').children;
    for (let k = 0; k < 4; k++) ch[k].classList.add(k === q.correct ? 'ok' : k === i ? 'no' : 'dim');
    if (ok) {
      streak++; myCor++;
      const P = myB();
      const g = Rules.earn(ms, streak, meta.qTime, P && P.dbl > 0);
      SFX.play('correct'); vib(40);
      const el = $('gain'); el.innerHTML = '+' + g.total + gem + (g.double ? ' ×2' : ''); el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      if (g.streak) toast(`🔥 ถูกติดกัน ${streak} ข้อ โบนัส +${g.streak}`, 1200);
      if (myCor % TU.perHeist === 0) pending++;
      renderProgress();
    } else {
      streak = 0; SFX.play('wrong'); vib([30, 30, 30]);
      if (q.explain) $('p-explain').textContent = '💡 ' + q.explain;
      if (i < 0) $('p-explain').textContent = '⏰ หมดเวลา' + (q.explain ? ' · ' + q.explain : '');
    }
    Net.push(R + '/acts', { pid, type: 'ans', ok, ms, streak, t: Net.now() });
    clearTimeout(nextT); nextT = setTimeout(nextQuestion, ok ? 800 : 1900);
  }

  // ---------------- ปล้น (เด้งเองทุก 3 ข้อ) ----------------
  let target = null, crack = null, pickT = null, pickEnd = 0;
  function openHeist() {
    const P = myB(); if (!P || inHeist || pending <= 0) return;
    inHeist = true; stopQ(); clearTimeout(nextT); SFX.play('whoosh'); vib([60, 40, 60]);
    $('heist').classList.add('on'); $('h-pick').style.display = ''; $('h-crack').style.display = 'none'; $('h-result').style.display = 'none';
    $('h-hint').textContent = P.gk > 0 ? '🗝️ คุณมีกุญแจผี เลือกตู้ไหนก็เปิดได้แน่นอน ได้ 35%' : 'ตู้ที่มีเพชรเยอะ ขโมยได้เยอะ · ถ้าไม่เลือก ระบบจะสุ่มให้';
    candidates = null; renderTargets();
    clearInterval(pickT); pickEnd = performance.now() + TU.pickMs;
    const tickPick = () => {
      const left = pickEnd - performance.now();
      $('h-ptime').style.width = Math.max(0, left / TU.pickMs * 100) + '%';
      $('h-pleft').textContent = Math.max(0, Math.ceil(left / 1000));
      if (left <= 0) { clearInterval(pickT); pickT = null; autoPick(); }
    };
    tickPick(); pickT = setInterval(tickPick, 100);
  }
  function autoPick() {
    if (!inHeist || target) return;
    const btns = [...$('h-list').querySelectorAll('.tgt:not([disabled])')];
    const safe = btns.filter(b => !b.dataset.vault);           // สุ่มเลี่ยงตู้นิรภัยถ้ามีทางเลือก
    const pool = safe.length ? safe : btns;
    if (!pool.length) { noTarget(); return; }
    toast('⏱️ หมดเวลาเลือก ระบบสุ่มเป้าให้', 1500);
    chooseTarget(pool[Math.floor(Math.random() * pool.length)].dataset.id);
  }
  // เป้าที่ปล้นได้ตอนนี้ (ไม่นับคนที่มีโล่)
  function eligible() { const now = Net.now(); return Object.entries(board).filter(([id, x]) => id !== pid && now >= (x.sh || 0)).length; }
  function noTarget() {
    clearInterval(pickT); pickT = null;   // รอบปล้นยังอยู่ ได้ปล้นข้อต่อไปเมื่อมีเป้าว่าง
    closeHeist(); toast('ทุกคนมีโล่อยู่ เก็บรอบปล้นไว้ก่อน', 1600); nextQuestion();
  }
  function chooseTarget(id) {
    if (target) return;
    clearInterval(pickT); pickT = null; pending = Math.max(0, pending - 1);
    const P = myB();
    if (P && P.gk > 0) ghostHeist(id); else startCrack(id);
  }
  function ghostHeist(id) {
    target = id; const V = board[id]; if (!V) return;
    crack = { done: true, hits: TU.pins };
    $('h-pick').style.display = 'none'; $('h-result').style.display = '';
    $('r-e').textContent = '🗝️'; $('r-e').className = 'big pop'; $('r-h').textContent = 'กุญแจผีเปิดตู้…'; $('r-p').textContent = 'ตู้ของ ' + V.n;
    SFX.play('lock');
    gotResult = false; crackEndAt = performance.now();
    $('r-back').onclick = () => { closeHeist(); nextQuestion(); };
    Net.push(R + '/acts', { pid, type: 'heist', target, hits: TU.pins, t: Net.now() });
    clearTimeout(resultWait);
    resultWait = setTimeout(() => { if (!gotResult) showResult('🤔', 'ยังไม่ได้รับผล', 'ดูผลบนจอหน้าห้องได้เลย'); }, 7000);
  }
  let candidates = null;
  function renderTargets() {
    const P = myB(); if (!P) return;
    const others = Object.entries(board).filter(([id]) => id !== pid).sort((a, b) => b[1].d - a[1].d);
    if (!candidates) {
      // ผู้นำ 3 คนแรก + สุ่มอีกไม่เกิน 5 คน เพื่อไม่ให้รายชื่อยาวเกินจอ
      const top = others.slice(0, 3).map(x => x[0]);
      const rest = others.slice(3).map(x => x[0]); for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      candidates = top.concat(rest.slice(0, 5));
    }
    const now = Net.now();
    const rows = candidates.map(id => [id, board[id]]).filter(x => x[1]).sort((a, b) => b[1].d - a[1].d);
    if (!rows.length) { $('h-list').innerHTML = '<p class="muted">ยังไม่มีเป้าหมายในห้อง</p>'; return; }
    $('h-list').innerHTML = rows.map(([id, x]) => {
      const sh = now < x.sh, vt = now < x.vault, c = Rules.cls(x.c);
      const tags = [];
      if (sh) tags.push(`🛡️ เพิ่งโดนปล้น รออีก ${Math.ceil((x.sh - now) / 1000)} วิ`);
      if (vt) tags.push('🏦 เปิดตู้นิรภัยอยู่ ปล้นแล้วเสียเพชร!');
      if (x.c === 'guard') tags.push('🛡️ โดนขโมยครึ่งเดียว');
      return `<button class="tgt" data-id="${id}" ${vt ? 'data-vault="1"' : ''} ${sh ? 'disabled' : ''}><span class="e">${c.emoji}</span><span><b>${esc(x.n)}</b><small>${tags.join(' · ') || c.name}</small></span><span class="d">${x.d}${gem}</span></button>`;
    }).join('');
    $('h-list').querySelectorAll('.tgt').forEach(b => b.onclick = () => chooseTarget(b.dataset.id));
  }
  function startCrack(id) {
    target = id; const V = board[id]; if (!V) return;
    SFX.play('pop');
    $('h-pick').style.display = 'none'; $('h-crack').style.display = '';
    $('h-vname').textContent = V.n;
    const pins = $('pins').children; for (const p of pins) { p.className = ''; p.textContent = '🔩'; }
    const zone = Rules.zoneFor(myB().c) * Math.PI * 2;
    crack = { i: 0, hits: 0, t0: performance.now(), ang: 0, dir: 1, speed: Math.PI * 2 / TU.needleMs, zones: Array.from({ length: TU.pins }, (_, k) => ({ at: Math.random() * Math.PI * 2, w: zone * [1, 0.85, 0.7][k] })), done: false, last: performance.now() };
    $('h-tap').disabled = false;
    $('h-tap').onclick = tapCrack;
    $('dial').onpointerdown = (e) => { e.preventDefault(); tapCrack(); };
    requestAnimationFrame(drawDial);
    // กันค้าง: ถ้าเฟรมภาพหยุด (เช่นสลับแอป) ยังจบด่านเองตามเวลา
    const my = crack;
    setTimeout(() => { if (crack !== my || my.done) return; while (my.i < TU.pins) { const pin = $('pins').children[my.i]; pin.className = 'miss'; pin.textContent = '⌛'; my.i++; } finishCrack(); }, TU.crackMs + 250);
  }
  const norm = (a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  function inZone(a, z) { let d = Math.abs(norm(a) - norm(z.at)); d = Math.min(d, Math.PI * 2 - d); return d <= z.w / 2; }
  function tapCrack() {
    if (!crack || crack.done) return;
    const z = crack.zones[crack.i]; const ok = inZone(crack.ang, z);
    const pin = $('pins').children[crack.i];
    pin.className = ok ? 'hit pop' : 'miss shake'; pin.textContent = ok ? '✅' : '❌';
    if (ok) { crack.hits++; SFX.play('lock'); vib(40); } else { SFX.play('wrong'); vib([20, 20, 20]); }
    crack.i++; crack.dir *= -1; crack.speed *= 1.12;
    if (crack.i >= TU.pins) finishCrack();
  }
  function drawDial(now) {
    if (!crack) return;
    const cv = $('dial'), c = cv.getContext('2d'), W = cv.width, cx = W / 2, r = W * 0.4;
    const dt = Math.min(50, now - crack.last); crack.last = now;
    if (!crack.done) crack.ang += crack.dir * crack.speed * dt;
    const leftMs = TU.crackMs - (now - crack.t0);
    if (!crack.done && leftMs <= 0) { while (crack.i < TU.pins) { const pin = $('pins').children[crack.i]; pin.className = 'miss'; pin.textContent = '⌛'; crack.i++; } finishCrack(); }
    c.clearRect(0, 0, W, W);
    // ตัวตู้
    c.fillStyle = '#1b2348'; c.beginPath(); c.arc(cx, cx, r + 46, 0, Math.PI * 2); c.fill();
    c.lineWidth = 10; c.strokeStyle = '#33407e'; c.stroke();
    c.fillStyle = '#0d1330'; c.beginPath(); c.arc(cx, cx, r, 0, Math.PI * 2); c.fill();
    // ขีดหน้าปัด
    c.strokeStyle = '#3a4790'; c.lineWidth = 4;
    for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; const r1 = r - (k % 5 ? 14 : 28); c.beginPath(); c.moveTo(cx + Math.cos(a) * r1, cx + Math.sin(a) * r1); c.lineTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r); c.stroke(); }
    // โซนเขียว
    if (crack.i < TU.pins) {
      const z = crack.zones[crack.i];
      c.strokeStyle = '#3ddc97'; c.lineWidth = 34; c.lineCap = 'round';
      c.beginPath(); c.arc(cx, cx, r - 30, z.at - z.w / 2, z.at + z.w / 2); c.stroke(); c.lineCap = 'butt';
    }
    // เข็ม
    const hot = crack.i < TU.pins && inZone(crack.ang, crack.zones[crack.i]);
    c.strokeStyle = hot ? '#3ddc97' : '#f2f4fb'; c.lineWidth = 12; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, cx); c.lineTo(cx + Math.cos(crack.ang) * (r - 10), cx + Math.sin(crack.ang) * (r - 10)); c.stroke(); c.lineCap = 'butt';
    c.fillStyle = '#f2f4fb'; c.beginPath(); c.arc(cx, cx, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f4b400'; c.beginPath(); c.arc(cx, cx, 10, 0, Math.PI * 2); c.fill();
    // เวลาที่เหลือ (วงนอก)
    const frac = Math.max(0, leftMs / TU.crackMs);
    c.strokeStyle = frac < .3 ? '#ff4f5e' : '#f4b400'; c.lineWidth = 12;
    c.beginPath(); c.arc(cx, cx, r + 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); c.stroke();
    if (!crack.done) requestAnimationFrame(drawDial);
  }
  let resultWait = null;
  function finishCrack() {
    if (crack.done) return; crack.done = true;
    $('h-tap').disabled = true;
    const hits = crack.hits;
    gotResult = false; crackEndAt = performance.now();
    $('r-back').onclick = () => { closeHeist(); nextQuestion(); };
    Net.push(R + '/acts', { pid, type: 'heist', target, hits, t: Net.now() });
    setTimeout(() => {
      if (gotResult || !inHeist) return; // ผลมาถึงก่อนแล้ว (เครือข่ายเร็ว) ไม่ต้องขึ้นหน้ารอ
      $('h-crack').style.display = 'none'; $('h-result').style.display = '';
      $('r-e').textContent = '⏳'; $('r-e').className = 'big'; $('r-h').textContent = 'กำลังขนเพชร…'; $('r-p').textContent = '';
      clearTimeout(resultWait);
      resultWait = setTimeout(() => { if (!gotResult) showResult('🤔', 'ยังไม่ได้รับผล', 'ดูผลบนจอหน้าห้องได้เลย'); }, 7000);
    }, 600);
  }
  let gotResult = true, crackEndAt = 0;
  function showResult(e, h, p) {
    clearTimeout(resultWait); gotResult = true;
    // ให้เห็นสลักตัวสุดท้ายก่อนค่อยเปลี่ยนหน้าผล
    const wait = 700 - (performance.now() - crackEndAt);
    if (wait > 0) { setTimeout(() => showResult(e, h, p), wait); return; }
    if (!$('heist').classList.contains('on')) { toast(e + ' ' + h, 2600); return; }
    $('h-crack').style.display = 'none'; $('h-result').style.display = '';
    $('r-e').textContent = e; $('r-e').className = 'big pop'; $('r-h').textContent = h; $('r-p').textContent = p || '';
    // กลับไปตอบคำถามเองหลังเห็นผล (ไม่ต้องกดปุ่ม)
    clearTimeout(backT); backT = setTimeout(() => { if (inHeist && $('h-result').style.display !== 'none') { closeHeist(); nextQuestion(); } }, 2400);
  }
  let backT = null;
  function closeHeist() { inHeist = false; crack = null; target = null; clearInterval(pickT); pickT = null; clearTimeout(backT); $('heist').classList.remove('on'); renderHud(); }

  function skillFx(s, extra) {
    const c = Rules.cls(s);
    const el = $('skillfx'); el.style.setProperty('--tc', c.color);
    $('sf-em').textContent = c.skillEmoji; $('sf-name').textContent = c.skill;
    $('sf-desc').textContent = extra || c.skillDesc;
    el.classList.add('on'); SFX.play('skillready'); vib([60, 40, 60, 40, 160]);
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2200);
    el.onclick = () => el.classList.remove('on');
  }

  // ---------------- ข้อความจากจอครู ----------------
  const handled = new Set();
  function onMsg(v) {
    if (!v) return;
    for (const key of Object.keys(v).sort()) {
      if (handled.has(key)) continue; handled.add(key);
      Net.remove(R + '/msg/' + pid + '/' + key);
      const m = v[key];
      if (m.k === 'stole') { showResult('💎', `ได้มา ${m.amt} เม็ด!`, m.ghost ? `กุญแจผีเปิดตู้ของ ${m.vn}` : m.hits >= TU.pins ? `งัดตู้ของ ${m.vn} ครบทุกสลัก` : m.hits ? `งัดตู้ของ ${m.vn} ได้ ${m.hits}/${TU.pins} สลัก` : `แผนสำรองของจอมวางแผน (ตู้ของ ${m.vn})`); SFX.play('win'); vib([60, 40, 160]); }
      else if (m.k === 'fail') { showResult('🚨', 'สัญญาณกันขโมยดัง!', 'งัดไม่ได้สักสลัก รอบหน้าเอาใหม่'); SFX.play('buzz'); vib([200]); }
      else if (m.k === 'vaulted') { showResult('🏦', 'เจอตู้นิรภัย!', `${m.vn} เปิดตู้นิรภัยอยู่ คุณโดนปรับ ${m.amt} เม็ด`); SFX.play('shield'); vib([200]); }
      else if (m.k === 'empty') { showResult('🕸️', 'ตู้ว่างเปล่า', `${m.vn} ยังไม่มีเพชรเลย`); SFX.play('wrong'); }
      else if (m.k === 'shielded') { pending++; showResult('🛡️', 'เป้าหมายมีโล่คุ้มกัน', `${m.vn} เพิ่งโดนปล้น เดี๋ยวได้เลือกใหม่`); }
      else if (m.k === 'notarget') { /* แจ้งไปแล้วในเครื่อง */ }
      else if (m.k === 'robbed') { alertBanner('red', '😱', `${esc(m.tn)} ขโมยเพชรคุณไป ${m.amt} เม็ด!`, 'คุณมีโล่คุ้มกัน 25 วินาที'); SFX.play('break'); vib([200, 80, 200]); }
      else if (m.k === 'grabbed') { alertBanner('red', '👐', `${esc(m.tn)} ใช้สกิลล้วงหมู่! เสียไป ${m.amt} เม็ด`, 'เพราะคุณติดอันดับผู้นำ'); SFX.play('break'); vib([120, 60, 120]); }
      else if (m.k === 'vaultwin') { alertBanner('gold', '🏦', `ตู้นิรภัยกัน ${esc(m.tn)} ไว้ได้!`, m.amt ? `ได้ค่าปรับ ${m.amt} เม็ด` : ''); SFX.play('shield'); vib(80); }
      else if (m.k === 'skill') skillFx(m.s, m.s === 'pick' ? (m.amt ? `ล้วงจากผู้นำ ${m.n} คน ได้ ${m.amt} เม็ด!` : 'ผู้นำทุกคนมีโล่อยู่ ล้วงไม่ได้รอบนี้') : null);
    }
  }
  function alertBanner(kind, e, t, sub) {
    const el = $('alert'); el.className = 'alert on ' + kind + ' shake';
    $('al-e').textContent = e; $('al-t').innerHTML = t + (sub ? `<small>${sub}</small>` : '');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 3200);
  }

  // ---------------- จบ ----------------
  function renderEnd(res) {
    if (!res) return;
    const p = res.personal && res.personal[pid];
    if (!p) { $('e-rank').textContent = '–'; $('e-of').textContent = 'ไม่มีข้อมูลของคุณในรอบนี้'; return; }
    $('e-rank').textContent = '#' + p.rank; $('e-of').textContent = `จาก ${res.total} คน`;
    $('e-dia').innerHTML = p.d + ' ' + gem;
    $('e-stats').innerHTML = `<div><b>${p.cor}/${p.ans}</b><span>ตอบถูก</span></div><div><b>${p.stl}</b><span>ขโมยได้</span></div><div><b>${p.sk || 0}</b><span>ใช้สกิล</span></div>`;
    let h = '';
    for (const a of p.awards) h += `<div class="aw gold pop"><div class="em">${a.emoji}</div><div><span class="label">รางวัลพิเศษ</span><div class="display" style="font-size:1.3rem">${a.name}</div><div class="muted">${esc(a.value)}</div></div></div>`;
    if (p.badge) h += `<div class="aw pop"><div class="em">${p.badge.emoji}</div><div><span class="label">เหรียญของคุณ</span><div class="display" style="font-size:1.2rem">${p.badge.name}</div><div class="muted">${esc(p.badge.desc)}</div></div></div>`;
    $('e-aw').innerHTML = h;
    if (p.awards.length || p.rank <= 3) { SFX.play('win'); vib([80, 40, 80, 40, 200]); } else SFX.play('award');
  }

  // ---------------- เริ่ม ----------------
  function boot() {
    Net.init(); initJoin();
    const m = location.hash.match(/^#p(\d{6})$/);
    if (m) {
      code = m[1]; R = 'mh/' + code; pid = store.getItem(KEY()); name = localStorage.getItem('mh-name') || '';
      if (pid && name) Net.ready().then(() => Net.once(R + '/players/' + pid)).then(p => { if (p) { name = p.name; bind(); } else { location.hash = ''; $('j-code').value = code; } });
    }
  }
  boot();
  // ใช้ทดสอบอัตโนมัติในโหมดทดลองเท่านั้น
  if (Net.isLocal) window.__mh = { get crack() { return crack; }, inZone, tap: () => tapCrack(), get pending() { return pending; }, get myCor() { return myCor; } };
  return {};
})();
