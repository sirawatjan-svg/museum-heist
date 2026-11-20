// ============================================================
// Host — จอครู: ตั้งค่า → ล็อบบี้ → เล่น (จอครูเป็นผู้ตัดสินเพชรทั้งหมด) → ทำเนียบจอมโจร
// ข้อมูลอยู่ใต้ mh/{code}: meta, questions, players, acts (มือถือส่งมา), board (จอครูเขียน), msg/{pid}, results
// ============================================================
const Host = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TU = Rules.TUNE;
  let code = null, R = null, meta = null, players = {};
  let unsubs = [], actUnsub = null;
  let cfg = { dur: 7, qt: 20, setId: null };
  let B = {}, dirty = false, writeTimer = null, clockTimer = null, ending = false, started = false;
  const done = new Set();
  let totals = { stolen: 0, heists: 0, blocks: 0 };
  let leader = null, lastSec = -1;

  function show(id) { document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === id)); }
  function unsubAll() { unsubs.forEach(u => u && u()); unsubs = []; if (actUnsub) actUnsub(); actUnsub = null; }
  function joinUrl() { return location.origin + location.pathname.replace(/host\.html$/, '') + 'play.html?room=' + code + (Net.isLocal ? '&local=1' : ''); }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const gem = '<svg class="gem-ico" viewBox="0 0 64 64"><use href="#gem"/></svg>';

  // ---------------- ตั้งค่า ----------------
  function initSetup() {
    const d = Bank.load();
    const sel = $('s-set');
    sel.innerHTML = d.sets.map(s => `<option value="${s.id}">${esc(s.name)} (${s.questions.length} ข้อ)</option>`).join('');
    const upd = () => { const s = d.sets.find(x => x.id === sel.value); cfg.setId = sel.value; $('s-set-info').textContent = s ? `${s.questions.length} ข้อ · เพิ่มหรือแก้คำถามได้ที่หน้าคลังคำถาม` : ''; };
    sel.onchange = upd; upd();
    for (const [gid, key] of [['s-dur', 'dur'], ['s-qt', 'qt']]) {
      $(gid).querySelectorAll('button').forEach(b => b.onclick = () => { $(gid).querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); cfg[key] = +b.dataset.v; SFX.play('pop'); });
    }
    $('s-classes').innerHTML = Rules.CLASSES.map(c => `<div class="cl"><div class="e">${c.emoji}</div><b>${c.name}</b><small>${c.power}</small></div>`).join('');
    $('s-mode').innerHTML = Net.isLocal
      ? 'โหมดทดลองในเครื่อง: สแกน QR ไม่ได้ ให้เปิดลิงก์นักเรียนในแท็บใหม่ของเบราว์เซอร์นี้ (หลายแท็บ = หลายคน)'
      : 'ห้องออนไลน์: นักเรียนสแกน QR ด้วยมือถือ · <a href="host.html?local=1">ทดลองในเครื่องนี้แทน</a>';
    SFX.ambient('heist', 100);   // เพลงประจำเกมนี้ (ไม่ใช้เพลงชิลของสงครามสี)
    $('btn-create').onclick = create;
    ['btn-mute1', 'btn-mute2', 'btn-mute3'].forEach(id => $(id).onclick = toggleMute);
  }
  function toggleMute() { SFX.setMuted(!SFX.isMuted()); const t = SFX.isMuted() ? '🔇' : '🔊'; ['btn-mute1', 'btn-mute2', 'btn-mute3'].forEach(id => $(id).textContent = t); }

  async function create() {
    const set = Bank.getSet(cfg.setId);
    if (!set || set.questions.length < 5) { alert('ชุดคำถามต้องมีอย่างน้อย 5 ข้อ'); return; }
    SFX.ensure();
    $('btn-create').disabled = true;
    await Net.ready();
    const questions = set.questions.map(q => ({ text: q.text, a: q.a, b: q.b, c: q.c, d: q.d, correct: q.correct, explain: q.explain || '' }));
    code = String(Math.floor(100000 + Math.random() * 900000));
    R = 'mh/' + code;
    try {
      await Promise.race([
        Net.set(R, { meta: { hostUid: Net.uid(), createdAt: Net.now(), phase: 'lobby', duration: cfg.dur * 60000, qTime: cfg.qt * 1000, setName: set.name, round: 1 }, questions }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 8000)),
      ]);
    } catch (e) {
      $('btn-create').disabled = false;
      const denied = /PERMISSION/i.test(e.message);
      $('s-mode').innerHTML = `<span style="color:var(--bad)">${denied ? 'สร้างห้องออนไลน์ไม่ได้: ฐานข้อมูลยังไม่อนุญาต (ต้องวางกฎ Firebase ส่วน mh/ ก่อน)' : 'เชื่อมต่อฐานข้อมูลไม่ได้ ลองเช็กอินเทอร์เน็ตแล้วกดใหม่'}</span><br><a class="btn btn-sm" style="margin-top:10px" href="host.html?local=1">ทดลองเล่นในเครื่องนี้แทน</a>`;
      SFX.play('wrong');
      return;
    }
    location.hash = 'h' + code;
    bindRoom();
    show('v-lobby');
  }

  // ---------------- ห้อง ----------------
  function bindRoom() {
    unsubAll();
    unsubs.push(Net.on(R + '/meta', v => { meta = v || meta; }));
    unsubs.push(Net.on(R + '/players', v => { players = v || {}; onPlayers(); }));
    $('l-code').textContent = code;
    $('l-url').textContent = joinUrl();
    $('qr-box').innerHTML = '';
    try { new QRCode($('qr-box'), { text: joinUrl(), width: 240, height: 240, correctLevel: QRCode.CorrectLevel.M }); } catch (e) {}
    // โหมดทดลองในเครื่อง: ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น มือถือที่สแกนจะเข้า localhost ของมือถือเอง (เปิดไม่ได้)
    $('l-local').hidden = !Net.isLocal;
    $('btn-start').onclick = startGame;
    $('btn-close1').onclick = $('btn-close2').onclick = closeRoom;
    $('btn-endnow').onclick = () => { if (confirm('จบเกมตอนนี้?')) endGame(); };
    $('btn-fs').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); };
    $('btn-rematch').onclick = rematch;
    $('btn-next').onclick = nextReveal;
    document.onkeydown = (e) => { if (e.code === 'Space' && $('v-end').classList.contains('on')) { e.preventDefault(); nextReveal(); } };
  }
  async function closeRoom() { if (confirm('ปิดห้องนี้? นักเรียนจะหลุดออกทั้งหมด')) { stopLoops(); await Net.remove(R); location.href = location.pathname + location.search; } }

  const seen = new Set();
  function onPlayers() {
    const list = Object.entries(players);
    $('l-count').textContent = list.length;
    $('hud-players').textContent = list.length + ' คน';
    $('l-chips').innerHTML = list.map(([pid, p]) => { const c = p.cls ? Rules.cls(p.cls) : null; return `<div class="chip ${seen.has(pid) ? '' : 'pop'}"><span class="e">${c ? c.emoji : '❔'}</span>${esc(p.name)}</div>`; }).join('');
    for (const [pid] of list) if (!seen.has(pid)) { seen.add(pid); if ($('v-lobby').classList.contains('on')) SFX.play('pop'); }
    // คนเข้าช้าระหว่างเล่น → สร้างตู้ให้ทันที
    if (started && !ending) for (const [pid, p] of list) if (!B[pid]) { B[pid] = blank(p); dirty = true; }
  }
  function blank(p) {
    const c = p.cls || pick(Rules.CLASSES).id;
    return { n: p.name, c, d: 0, lk: c === 'guard' ? 1 : 0, sh: 0, tk: 0, cc: 0, cor: 0, ans: 0, stl: 0, hz: 0, ht: 0, lost: 0, rob: 0, blk: 0, bs: 0, lkb: 0 };
  }

  // ---------------- เริ่มเกม ----------------
  async function startGame() {
    const list = Object.entries(players);
    if (!list.length) { alert('ยังไม่มีนักเรียนในห้อง'); return; }
    SFX.ensure();
    B = {}; done.clear(); totals = { stolen: 0, heists: 0, blocks: 0 }; leader = null; lastSec = -1; ending = false;
    const clsUpd = {};
    for (const [pid, p] of list) { B[pid] = blank(p); if (!p.cls) clsUpd[pid + '/cls'] = B[pid].c; }
    if (Object.keys(clsUpd).length) await Net.update(R + '/players', clsUpd);
    await Net.remove(R + '/acts'); await Net.remove(R + '/msg'); await Net.remove(R + '/results');
    await Net.set(R + '/board', B);
    const startAt = Net.now() + 3800;
    await Net.update(R + '/meta', { phase: 'play', startAt, endAt: startAt + meta.duration });
    meta.startAt = startAt; meta.endAt = startAt + meta.duration;
    enterPlay(true);
  }
  function enterPlay(withCountdown) {
    show('v-play');
    $('hud-room').textContent = 'ห้อง ' + code;
    $('feed').innerHTML = '';
    renderTotals(); renderBoard();
    if (withCountdown) {
      const ov = $('countdown'); ov.style.display = 'flex';
      const tick = () => {
        const left = meta.startAt - Net.now();
        if (left <= 0) { ov.style.display = 'none'; SFX.play('go'); SFX.startMusic(112, 'chase'); SFX.setMusic({ intensity: 0.3 }); started = true; return; }
        const n = String(Math.ceil(left / 1000)); if ($('cd-num').textContent !== n) { $('cd-num').textContent = n; $('cd-num').classList.remove('pop'); void $('cd-num').offsetWidth; $('cd-num').classList.add('pop'); SFX.play('count'); }
        setTimeout(tick, 60);
      };
      tick();
    } else { started = true; SFX.startMusic(112, 'chase'); }
    actUnsub = Net.on(R + '/acts', onActs);
    if (writeTimer) clearInterval(writeTimer);
    writeTimer = setInterval(() => { if (dirty) { dirty = false; Net.set(R + '/board', B); renderBoard(); renderTotals(); } }, 400);
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(clock, 200);
  }
  function stopLoops() { if (writeTimer) clearInterval(writeTimer); if (clockTimer) clearInterval(clockTimer); writeTimer = clockTimer = null; if (actUnsub) actUnsub(); actUnsub = null; SFX.stopMusic(); }

  function clock() {
    if (!meta || !meta.endAt) return;
    const left = meta.endAt - Net.now();
    const sec = Math.max(0, Math.ceil(left / 1000));
    $('hud-timer').textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    $('hud-timer').classList.toggle('hot', sec <= 30);
    if (sec !== lastSec && started) {
      lastSec = sec;
      const f10 = sec <= 10 && sec > 0;
      $('final10').style.display = f10 ? 'flex' : 'none'; $('alarmedge').classList.toggle('on', f10);
      if (f10) { $('f10').textContent = sec; $('f10').classList.remove('pop'); void $('f10').offsetWidth; $('f10').classList.add('pop'); SFX.play('ticklow'); }
      else if (sec <= 30 && sec > 0) SFX.play('tick');
      const frac = 1 - left / meta.duration;
      SFX.setMusic({ bpm: 112 + Math.round(frac * 24) + (sec <= 30 ? 14 : 0), intensity: Math.min(1, 0.3 + frac * 0.6 + (sec <= 30 ? 0.3 : 0)) });
    }
    if (left <= 0 && started && !ending) endGame();
  }

  // ---------------- ตัดสินการกระทำจากมือถือ ----------------
  function onActs(v) {
    if (!v || ending) return;
    const keys = Object.keys(v).sort();
    for (const key of keys) {
      if (done.has(key)) continue;
      done.add(key);
      Net.remove(R + '/acts/' + key);
      if (!started) continue;
      const a = v[key];
      if (!B[a.pid]) { if (!players[a.pid]) continue; B[a.pid] = blank(players[a.pid]); }
      try {
        if (a.type === 'ans') doAnswer(a);
        else if (a.type === 'heist') doHeist(a);
        else if (a.type === 'lock') doLock(a);
      } catch (e) { console.error(e); }
      dirty = true;
    }
  }
  function msg(pid, o) { Net.push(R + '/msg/' + pid, Object.assign({ t: Net.now() }, o)); }

  function doAnswer(a) {
    const P = B[a.pid];
    P.ans++;
    if (!a.ok) return;
    P.cor++;
    const streak = Math.max(0, a.streak | 0);
    P.bs = Math.max(P.bs, streak);
    P.d += Rules.earn(+a.ms || 99999, streak, meta.qTime).total;
    P.cc++;
    if (P.cc >= TU.perTicket) { P.cc = 0; P.tk = Math.min(TU.maxTickets, P.tk + 1); }
    if (streak === 5 || streak === 10 || streak === 15) news({ e: '🔥', big: false, h: `<b>${esc(P.n)}</b> ตอบถูก ${streak} ข้อติด!` });
  }

  function doHeist(a) {
    const T = B[a.pid], V = B[a.target];
    if (!T || T.tk <= 0 || !V || a.target === a.pid) return;
    const now = Net.now();
    if (now < V.sh) { msg(a.pid, { k: 'shielded', vn: V.n }); return; } // ตั๋วไม่เสีย
    T.tk--; T.ht++;
    const hits = Math.max(0, Math.min(3, a.hits | 0));
    if (hits < 2) {
      msg(a.pid, { k: 'fail', vn: V.n, hits });
      news({ e: '🚨', big: false, h: pick([`สัญญาณกันขโมยดัง! <b>${esc(T.n)}</b> งัดตู้ <b>${esc(V.n)}</b> ไม่ทัน`, `<b>${esc(T.n)}</b> มือสั่น งัดตู้ <b>${esc(V.n)}</b> พลาด`]) });
      SFX.play('buzz');
      return;
    }
    if (V.lk > 0) {
      V.lk--; V.blk++; totals.blocks++;
      msg(a.pid, { k: 'blocked', vn: V.n });
      msg(a.target, { k: 'saved', tn: T.n });
      news({ e: '🔒', big: true, h: pick([`<b>${esc(T.n)}</b> งัดตู้ <b>${esc(V.n)}</b> ไม่เข้า!`, `ตู้ของ <b>${esc(V.n)}</b> ล็อกแน่นหนา <b>${esc(T.n)}</b> กลับมือเปล่า`]), sub: 'ล็อกตู้เซฟช่วยไว้ได้ทันเวลา' });
      SFX.play('shield');
      return;
    }
    const amt = Rules.stealAmount(V.d, hits, T.c, V.c);
    if (amt <= 0) {
      msg(a.pid, { k: 'empty', vn: V.n });
      news({ e: '🕸️', big: false, h: `<b>${esc(T.n)}</b> งัดตู้ <b>${esc(V.n)}</b> สำเร็จ แต่ตู้ว่างเปล่า!` });
      return;
    }
    V.d -= amt; T.d += amt; T.stl += amt; T.hz++; V.lost += amt; V.rob++; V.sh = now + TU.protectMs;
    totals.stolen += amt; totals.heists++;
    msg(a.pid, { k: 'stole', vn: V.n, amt, hits });
    msg(a.target, { k: 'robbed', tn: T.n, amt });
    const tc = Rules.cls(T.c);
    news({ e: tc.emoji, big: true, flash: [a.pid, a.target], h: pick([
      `<b>${esc(T.n)}</b> ฉกเพชร ${amt} เม็ดจาก <b>${esc(V.n)}</b>!`,
      `ตู้เซฟของ <b>${esc(V.n)}</b> ถูกงัด! หายไป ${amt} เม็ด`,
      `<b>${esc(T.n)}</b> ${tc.short}! ขนเพชรของ <b>${esc(V.n)}</b> ไป ${amt} เม็ด`,
    ]), sub: hits === 3 ? 'งัดสลักครบทั้ง 3 ตัว' : 'งัดได้ 2 จาก 3 สลัก' });
    SFX.play('break');
  }

  function doLock(a) {
    const P = B[a.pid];
    const cost = Rules.lockCost();
    if (P.lk > 0 || P.d < cost) { msg(a.pid, { k: 'nolock' }); return; }
    P.d -= cost; P.lk = 1; P.lkb++;
    msg(a.pid, { k: 'locked' });
    news({ e: '🔒', big: false, h: `<b>${esc(P.n)}</b> ติดตั้งล็อกตู้เซฟ` });
  }

  // ---------------- ข่าว ----------------
  let lastBig = 0;
  function news(o) {
    const d = document.createElement('div'); d.className = 'it fadeup';
    const tm = meta && meta.endAt ? Math.max(0, Math.ceil((meta.endAt - Net.now()) / 1000)) : 0;
    d.innerHTML = `<span class="e">${o.e}</span><span>${o.h}</span><span class="t">${Math.floor(tm / 60)}:${String(tm % 60).padStart(2, '0')}</span>`;
    $('feed').prepend(d);
    while ($('feed').children.length > 7) $('feed').lastChild.remove();
    // หัวข่าวใหญ่: ข่าวสำคัญขึ้นทันที ข่าวเล็กขึ้นเฉพาะตอนจอว่างนาน
    const now = performance.now();
    if (o.big || now - lastBig > 6000) {
      if (o.big) lastBig = now;
      $('brk').innerHTML = `<div class="ico pop">${o.e}</div><div><h2 class="fadeup">${o.h}</h2>${o.sub ? `<div class="sub">${esc(o.sub)}</div>` : ''}</div>`;
    }
    if (o.flash) flashRows(o.flash);
  }
  let flashQ = null;
  function flashRows(pids) { flashQ = { up: pids[0], down: pids[1], until: performance.now() + 1600 }; }

  // ---------------- ตารางอันดับ ----------------
  function ranked() { return Object.entries(B).sort((a, b) => (b[1].d - a[1].d) || (b[1].cor - a[1].cor) || a[1].n.localeCompare(b[1].n)); }
  function renderBoard() {
    const host = $('rows');
    const list = ranked();
    const avail = host.clientHeight || 560;
    const rowH = 56;
    const max = Math.max(3, Math.min(10, Math.floor(avail / rowH)));
    const top = list.slice(0, max);
    const keep = new Set(top.map(x => x[0]));
    host.querySelectorAll('.lrow').forEach(el => { if (!keep.has(el.dataset.pid)) el.remove(); });
    const fl = flashQ && performance.now() < flashQ.until ? flashQ : null;
    top.forEach(([pid, P], i) => {
      let el = host.querySelector(`.lrow[data-pid="${pid}"]`);
      if (!el) { el = document.createElement('div'); el.className = 'lrow'; el.dataset.pid = pid; el.style.top = (max * rowH) + 'px'; host.appendChild(el); void el.offsetWidth; }
      el.style.top = (i * rowH) + 'px';
      el.className = 'lrow' + (i < 3 ? ' r' + (i + 1) : '') + (fl && fl.up === pid ? ' flash-up' : '') + (fl && fl.down === pid ? ' flash-down' : '');
      el.innerHTML = `<span class="rk">${i === 0 ? '👑' : i + 1}</span><span class="e">${Rules.cls(P.c).emoji}</span><span class="nm">${esc(P.n)}</span><span class="d">${P.d}${gem}</span>`;
    });
    // เปลี่ยนผู้นำ
    if (list.length && list[0][1].d > 0) {
      const lp = list[0][0];
      if (leader !== lp) {
        const first = leader == null; leader = lp;
        if (!first && meta && Net.now() - meta.startAt > 15000) { news({ e: '👑', big: true, h: `<b>${esc(list[0][1].n)}</b> ขึ้นเป็นจอมโจรอันดับ 1!`, sub: `ถือเพชรอยู่ ${list[0][1].d} เม็ด` }); SFX.play('award'); }
      }
    }
  }
  function renderTotals() { $('st-stolen').textContent = totals.stolen; $('st-heists').textContent = totals.heists; $('st-blocks').textContent = totals.blocks; }

  // ---------------- จบเกม ----------------
  let results = null, revealStep = 0;
  async function endGame() {
    if (ending) return; ending = true;
    stopLoops();
    $('final10').style.display = 'none'; $('alarmedge').classList.remove('on');
    SFX.play('drum');
    await Net.set(R + '/board', B);
    results = computeResults();
    await Net.set(R + '/results', results);
    await Net.update(R + '/meta', { phase: 'end' });
    setTimeout(showEnd, 900);
  }
  function computeResults() {
    const list = ranked();
    const personal = {};
    list.forEach(([pid, P], i) => { personal[pid] = { rank: i + 1, name: P.n, c: P.c, d: P.d, cor: P.cor, ans: P.ans, stl: P.stl, hz: P.hz, ht: P.ht, rob: P.rob, lost: P.lost, blk: P.blk, bs: P.bs, lkb: P.lkb, awards: [] }; });
    const best = (key, tie) => { let b = null; for (const [pid, P] of list) { if (!(P[key] > 0)) continue; if (!b || P[key] > B[b][key] || (P[key] === B[b][key] && tie && tie(P, B[b]) > 0)) b = pid; } return b; };
    const awards = [];
    const add = (pid, a, value) => { if (!pid) return; const x = Object.assign({ pid, pname: B[pid].n, value }, a); awards.push(x); personal[pid].awards.push(x); };
    const acc = (P) => P.ans ? P.cor / P.ans : 0;
    const t1 = best('stl'); add(t1, { emoji: '🦹', name: 'จอมโจรผู้ยิ่งใหญ่', desc: 'ขโมยเพชรได้มากที่สุดในห้อง' }, t1 && `ขโมยได้ ${B[t1].stl} เม็ด`);
    const t2 = best('blk'); add(t2, { emoji: '🛡️', name: 'ผู้พิทักษ์ตู้เซฟ', desc: 'ล็อกตู้กันโจรได้มากที่สุด' }, t2 && `กันได้ ${B[t2].blk} ครั้ง`);
    const t3 = best('cor', (a, b) => acc(a) - acc(b)); add(t3, { emoji: '🧠', name: 'นักคิดแม่นที่สุด', desc: 'ตอบคำถามถูกมากที่สุด' }, t3 && `ถูก ${B[t3].cor} จาก ${B[t3].ans} ข้อ`);
    const t4 = best('rob'); add(t4, { emoji: '🎈', name: 'ผู้ถูกปล้นมากที่สุด', desc: 'รางวัลปลอบใจ ตู้นี้เป็นที่หมายปองของทุกคน' }, t4 && `โดนปล้น ${B[t4].rob} ครั้ง`);
    for (const pid in personal) {
      const p = personal[pid]; if (p.awards.length) continue;
      p.badge = p.hz > 0 ? { emoji: '🧤', name: 'มือไว', desc: `ปล้นสำเร็จ ${p.hz} ครั้ง` }
        : p.blk > 0 ? { emoji: '🔒', name: 'ตู้เหล็ก', desc: `ล็อกกันโจรได้ ${p.blk} ครั้ง` }
        : p.cor >= 5 ? { emoji: '📚', name: 'หัวไว', desc: `ตอบถูก ${p.cor} ข้อ` }
        : p.lkb > 0 ? { emoji: '🧰', name: 'รอบคอบ', desc: 'รู้จักป้องกันตู้ของตัวเอง' }
        : { emoji: '💎', name: 'ผู้ร่วมปฏิบัติการ', desc: 'ขอบคุณที่ร่วมภารกิจครั้งนี้' };
    }
    return { at: Net.now(), podium: list.slice(0, 3).map(([pid]) => pid), awards, personal, total: list.length };
  }
  function showEnd() {
    show('v-end'); SFX.startMusic(92, 'heist');
    revealStep = 0; $('e-award').innerHTML = ''; $('e-board').style.display = 'none'; $('btn-next').style.display = '';
    const pp = results.podium.map(pid => results.personal[pid]);
    const slot = (p, cls, n) => p ? `<div class="pod ${cls} hidden" data-n="${n}"><div class="e">${Rules.cls(p.c).emoji}</div><div class="who">${esc(p.name)}</div><div class="dd">${p.d} ${gem}</div><div class="block">${n}</div></div>` : `<div class="pod ${cls} hidden" data-n="${n}"></div>`;
    $('podium').innerHTML = slot(pp[1], 'p2', 2) + slot(pp[0], 'p1', 1) + slot(pp[2], 'p3', 3);
    $('podium').classList.remove('compact');
    $('btn-next').textContent = 'เปิดอันดับ 3 ▶';
  }
  function nextReveal() {
    revealStep++;
    const podN = [3, 2, 1];
    if (revealStep <= 3) {
      const n = podN[revealStep - 1];
      const el = $('podium').querySelector(`[data-n="${n}"]`);
      if (el) { el.classList.remove('hidden'); el.classList.add('pop'); }
      if (n === 1) { SFX.play('win'); confetti(); } else SFX.play('award');
      $('btn-next').textContent = revealStep < 3 ? `เปิดอันดับ ${podN[revealStep]} ▶` : (results.awards.length ? 'ประกาศรางวัลพิเศษ ▶' : 'ดูตารางทั้งหมด ▶');
      return;
    }
    const ai = revealStep - 4;
    if (ai < results.awards.length) {
      const a = results.awards[ai];
      $('e-award').innerHTML = `<div class="award pop"><div class="em">${a.emoji}</div><div style="text-align:left"><div class="an">รางวัลพิเศษ ${ai + 1}/${results.awards.length} · ${a.name}</div><div class="pn">${esc(a.pname)}</div><div class="muted" style="font-size:1.1rem">${esc(a.desc)}</div><span class="tag tag-gold" style="margin-top:12px">${esc(a.value)}</span></div></div>`;
      $('podium').classList.add('compact');
      setTimeout(() => $('e-award').scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      SFX.play('award'); confetti(70);
      $('btn-next').textContent = ai + 1 < results.awards.length ? 'รางวัลถัดไป ▶' : 'ดูตารางทั้งหมด ▶';
      return;
    }
    $('e-award').innerHTML = ''; $('btn-next').style.display = 'none'; $('e-board').style.display = '';
    const rows = Object.values(results.personal).sort((a, b) => a.rank - b.rank);
    $('e-table').innerHTML = `<tr><th>#</th><th>ชื่อ</th><th>อาชีพ</th><th>เพชร</th><th>ตอบถูก</th><th>ขโมยได้</th><th>โดนปล้น</th><th>กันได้</th></tr>` +
      rows.map(p => `<tr><td><b>${p.rank}</b></td><td><b>${esc(p.name)}</b></td><td>${Rules.cls(p.c).emoji} ${Rules.cls(p.c).name}</td><td><b>${p.d}</b></td><td>${p.cor}/${p.ans}</td><td>${p.stl}</td><td>${p.rob} ครั้ง</td><td>${p.blk}</td></tr>`).join('');
  }
  async function rematch() {
    await Net.remove(R + '/acts'); await Net.remove(R + '/msg'); await Net.remove(R + '/results'); await Net.remove(R + '/board');
    await Net.update(R + '/meta', { round: (meta.round || 1) + 1, phase: 'lobby', startAt: null, endAt: null });
    started = false; ending = false; B = {};
    show('v-lobby'); onPlayers();
  }

  // ---------------- คอนเฟตตี ----------------
  let confs = [], confRaf = null;
  function confetti(n) {
    const cv = $('confetti'); cv.width = innerWidth; cv.height = innerHeight; const c = cv.getContext('2d');
    const cols = ['#19a7c9', '#e0a100', '#e8505b', '#7b5cd6', '#8fe6f7'];
    for (let i = 0; i < (n || 180); i++) confs.push({ x: Math.random() * cv.width, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: 5 + Math.random() * 6, color: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3 });
    if (confRaf) return;
    const loop = () => {
      c.clearRect(0, 0, cv.width, cv.height);
      confs = confs.filter(p => p.y < cv.height + 20);
      for (const p of confs) { p.x += p.vx; p.y += p.vy; p.rot += p.vr; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color; c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); c.restore(); }
      confRaf = confs.length ? requestAnimationFrame(loop) : null;
    };
    confRaf = requestAnimationFrame(loop);
  }

  // ---------------- เริ่มต้น / กู้ห้องหลังรีเฟรช ----------------
  function boot() {
    Net.init();
    initSetup();
    addEventListener('resize', () => { if ($('v-play').classList.contains('on')) renderBoard(); });
    const m = location.hash.match(/^#h(\d{6})$/);
    if (!m) return;
    code = m[1]; R = 'mh/' + code;
    Net.ready().then(() => Net.once(R + '/meta')).then(async v => {
      if (!v) { location.hash = ''; return; }
      meta = v; bindRoom();
      if (v.phase === 'play' && v.endAt > Net.now()) {
        // จอครูรีเฟรชกลางเกม: ดึงตู้ทุกคนกลับมาจากฐานข้อมูลแล้วเล่นต่อ
        B = (await Net.once(R + '/board')) || {};
        players = (await Net.once(R + '/players')) || {};
        for (const pid in players) if (!B[pid]) B[pid] = blank(players[pid]);
        enterPlay(false);
      } else if (v.phase === 'play' || v.phase === 'end') {
        B = (await Net.once(R + '/board')) || {};
        results = (await Net.once(R + '/results')) || null;
        if (!results) { results = computeResults(); await Net.set(R + '/results', results); await Net.update(R + '/meta', { phase: 'end' }); }
        ending = true; showEnd();
      } else show('v-lobby');
    });
  }
  boot();
  return { get B() { return B; } };
})();
