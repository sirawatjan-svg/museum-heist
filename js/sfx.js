// ============================================================
// SFX — เสียงสังเคราะห์ด้วย WebAudio ทั้งหมด (ไม่ต้องมีไฟล์เสียง)
// เอฟเฟกต์: correct, wrong, spawn, lock, crack, break, laser, blast, split, wave,
//           swarm, freeze, shield, combo, skillready, count, go, win, bite, tick, award
// เพลง: ซีเควนเซอร์ลูป เร่งจังหวะได้ (ช่วงท้ายเกม)
// ============================================================
const SFX = (() => {
  let ctx = null, master = null, musicBus = null, fxBus = null;
  let muted = false;
  let off = false, tOff = 0, vnow = 0; // โหมดเรนเดอร์ออฟไลน์ (ใช้ตรวจเสียงด้วย earshot)
  const last = {};

  const MASTER = 0.6; // ยกระดับรวม (วัดด้วย earshot: ก่อนแก้ -25.5 LUFS เบาเกินไปสำหรับโปรเจกเตอร์ห้องเรียน)
  function buildGraph() {
    master = ctx.createGain(); master.gain.value = MASTER;
    const comp = ctx.createDynamicsCompressor(); // คุมยอดเสียง ไม่ให้แตกเวลาเอฟเฟกต์ซ้อนกันเยอะ
    comp.threshold.value = -13; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.18;
    const lim = ctx.createDynamicsCompressor(); // ลิมิตเตอร์กันยอดเกินเต็มสเกล (ไม่งั้นลำโพงแตก)
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
    const sat = ctx.createWaveShaper(); // ซอฟต์คลิป tanh: ยอดไม่เกิน ±1 เด็ดขาด (ไม่แตกแบบดิจิทัล)
    const N = 2048, curve = new Float32Array(N); for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; curve[i] = Math.tanh(1.5 * x) / Math.tanh(1.5) * 0.89; }
    sat.curve = curve;
    master.connect(comp); comp.connect(lim); lim.connect(sat); sat.connect(ctx.destination);
    fxBus = ctx.createGain(); fxBus.gain.value = 0.85; fxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.62; musicBus.connect(master);
  }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      buildGraph();
    }
    if (ctx.state === 'suspended' && !off) ctx.resume();
    return true;
  }

  function osc(o) {
    // o: {f, f2, type, dur, vol, a, d, delay, bus, detune, slideType}
    const t0 = ctx.currentTime + tOff + (o.delay || 0);
    const g = ctx.createGain();
    const v = (o.vol == null ? 0.25 : o.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.2));
    const x = ctx.createOscillator();
    x.type = o.type || 'sine';
    x.frequency.setValueAtTime(o.f || 440, t0);
    if (o.f2) x.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.dur || 0.2) * (o.slide || 1));
    if (o.detune) x.detune.value = o.detune;
    x.connect(g); g.connect(o.bus || fxBus);
    x.start(t0); x.stop(t0 + (o.dur || 0.2) + 0.05);
  }
  let noiseBuf = null;
  function noise(o) {
    const t0 = ctx.currentTime + tOff + (o.delay || 0);
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.ftype || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + (o.dur || 0.2));
    f.Q.value = o.q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol == null ? 0.2 : o.vol, t0 + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.2));
    s.connect(f); f.connect(g); g.connect(o.bus || fxBus);
    s.start(t0); s.stop(t0 + (o.dur || 0.2) + 0.05);
  }

  const RATE = { paint: 60, lock: 90, crack: 120, bite: 150, laser: 100, blast: 120, split: 200, die: 150 };
  function play(name, opt) {
    if (muted || !ensure()) return;
    const now = off ? vnow : performance.now();
    if (RATE[name] && now - (last[name] || 0) < RATE[name]) return;
    last[name] = now;
    const p = opt || {};
    switch (name) {
      case 'correct':
        osc({ f: 660, type: 'triangle', dur: 0.12, vol: 0.3 }); osc({ f: 880, type: 'triangle', dur: 0.14, vol: 0.3, delay: 0.09 }); osc({ f: 1320, type: 'triangle', dur: 0.25, vol: 0.28, delay: 0.18 });
        break;
      case 'wrong':
        osc({ f: 220, f2: 140, type: 'sawtooth', dur: 0.35, vol: 0.2 }); osc({ f: 165, f2: 110, type: 'square', dur: 0.35, vol: 0.08, delay: 0.02 });
        break;
      case 'progress': // ติ๊ก 1/3 2/3
        osc({ f: 520 + (p.n || 0) * 160, type: 'sine', dur: 0.1, vol: 0.2 });
        break;
      case 'spawn':
        osc({ f: 150, f2: 38, type: 'sine', dur: 0.4, vol: 0.55 }); noise({ f: 400, f2: 4000, dur: 0.25, vol: 0.18, q: 2 }); osc({ f: 200, f2: 900, type: 'sawtooth', dur: 0.3, vol: 0.18 }); osc({ f: 1200, type: 'sine', dur: 0.4, vol: 0.12, delay: 0.1 });
        break;
      case 'skillready':
        [0, 0.1, 0.2, 0.3].forEach((d, i) => osc({ f: 523 * Math.pow(2, i / 3), type: 'triangle', dur: 0.35, vol: 0.22, delay: d }));
        osc({ f: 1568, type: 'sine', dur: 0.8, vol: 0.15, delay: 0.4 });
        break;
      case 'paint': osc({ f: 900 + Math.random() * 300, type: 'sine', dur: 0.04, vol: 0.04 }); break;
      case 'lock': osc({ f: 95, f2: 48, type: 'sine', dur: 0.12, vol: 0.28 }); osc({ f: 180, f2: 120, type: 'square', dur: 0.12, vol: 0.12 }); osc({ f: 1400, type: 'sine', dur: 0.08, vol: 0.06, delay: 0.02 }); break;
      case 'crack': noise({ f: 2500, dur: 0.06, vol: 0.1, q: 3 }); break;
      case 'break': osc({ f: 120, f2: 40, type: 'sine', dur: 0.2, vol: 0.4 }); noise({ f: 1800, f2: 300, dur: 0.25, vol: 0.2, q: 1 }); osc({ f: 300, f2: 80, type: 'square', dur: 0.2, vol: 0.12 }); break;
      case 'laser': osc({ f: 1800, f2: 400, type: 'sawtooth', dur: 0.18, vol: 0.1 }); break;
      case 'laserstorm':
        for (let i = 0; i < 6; i++) osc({ f: 2200 - i * 150, f2: 300, type: 'sawtooth', dur: 0.35, vol: 0.12, delay: i * 0.05 });
        noise({ f: 3000, f2: 500, dur: 0.6, vol: 0.2 });
        break;
      case 'blast': noise({ f: 300, f2: 80, dur: 0.22, vol: 0.18, ftype: 'lowpass' }); osc({ f: 120, f2: 50, type: 'sine', dur: 0.25, vol: 0.2 }); break;
      case 'megablast':
        osc({ f: 60, f2: 30, type: 'sine', dur: 1.2, vol: 0.5 }); noise({ f: 200, f2: 60, dur: 1.0, vol: 0.35, ftype: 'lowpass' }); noise({ f: 5000, f2: 800, dur: 0.5, vol: 0.2 });
        break;
      case 'split': osc({ f: 700, f2: 1400, type: 'square', dur: 0.08, vol: 0.06 }); break;
      case 'swarm':
        for (let i = 0; i < 12; i++) osc({ f: 600 + Math.random() * 900, f2: 1800, type: 'square', dur: 0.12, vol: 0.07, delay: i * 0.04 });
        noise({ f: 1500, f2: 3500, dur: 0.6, vol: 0.15 });
        break;
      case 'wave': noise({ f: 300, f2: 1500, dur: 1.3, vol: 0.3, ftype: 'lowpass', a: 0.2 }); osc({ f: 80, f2: 160, type: 'sine', dur: 1.2, vol: 0.25 }); break;
      case 'freeze': osc({ f: 1800, f2: 2600, type: 'sine', dur: 0.6, vol: 0.15 }); osc({ f: 2400, f2: 3200, type: 'triangle', dur: 0.8, vol: 0.1, delay: 0.1 }); noise({ f: 6000, dur: 0.7, vol: 0.08, q: 5 }); break;
      case 'shield': osc({ f: 330, f2: 660, type: 'triangle', dur: 0.4, vol: 0.2 }); osc({ f: 495, f2: 990, type: 'triangle', dur: 0.4, vol: 0.15, delay: 0.05 }); break;
      case 'speed': for (let i = 0; i < 5; i++) osc({ f: 400 + i * 120, type: 'square', dur: 0.08, vol: 0.1, delay: i * 0.05 }); break;
      case 'combo': [0, 0.08, 0.16].forEach((d, i) => osc({ f: 440 * Math.pow(1.26, i), type: 'square', dur: 0.2, vol: 0.14, delay: d })); osc({ f: 880, type: 'triangle', dur: 0.6, vol: 0.2, delay: 0.25 }); break;
      case 'bite': noise({ f: 1200, dur: 0.05, vol: 0.06, q: 2 }); break;
      case 'die': osc({ f: 500, f2: 120, type: 'triangle', dur: 0.15, vol: 0.06 }); break;
      case 'count': osc({ f: 880, type: 'sine', dur: 0.15, vol: 0.3 }); break;
      case 'go': osc({ f: 1320, type: 'sine', dur: 0.6, vol: 0.35 }); osc({ f: 660, type: 'triangle', dur: 0.6, vol: 0.2 }); noise({ f: 800, f2: 6000, dur: 0.5, vol: 0.15 }); break;
      case 'tick': osc({ f: 1000, type: 'square', dur: 0.05, vol: 0.12 }); break;
      case 'ticklow': osc({ f: 500, type: 'square', dur: 0.08, vol: 0.14 }); break;
      case 'win':
        [0, 0.15, 0.3, 0.45, 0.6].forEach((d, i) => osc({ f: [523, 659, 784, 1047, 1319][i], type: 'triangle', dur: 0.7, vol: 0.25, delay: d }));
        noise({ f: 1000, f2: 8000, dur: 1.2, vol: 0.15, delay: 0.6 });
        break;
      case 'award': osc({ f: 784, type: 'triangle', dur: 0.2, vol: 0.25 }); osc({ f: 1175, type: 'triangle', dur: 0.45, vol: 0.25, delay: 0.12 }); break;
      case 'drum': noise({ f: 150, f2: 60, dur: 0.3, vol: 0.4, ftype: 'lowpass' }); osc({ f: 90, f2: 40, type: 'sine', dur: 0.3, vol: 0.4 }); break;
      case 'whoosh': noise({ f: 300, f2: 3000, dur: 0.4, vol: 0.2, a: 0.1 }); break;
      case 'pop': osc({ f: 500, f2: 1000, type: 'sine', dur: 0.08, vol: 0.2 }); break;
      case 'buzz': osc({ f: 110, type: 'sawtooth', dur: 0.5, vol: 0.2 }); break;
    }
  }

  // ---------------- เพลงลูป ----------------
  const music = { mode: "battle", want: null, on: false, bpm: 120, step: 0, next: 0, timer: null, intensity: 0 };
  const ROOT = 55; // A1
  const nf = (semi) => ROOT * Math.pow(2, semi / 12);
  const ROOTS = [0, -4, 3, -2];                       // Am F C G (กึ่งเสียงจาก A)
  const CHORDS = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
  const BASSPAT = [1, 0, 0, 1, 1, 0, 0, 1];          // ซิงโคเปต
  const ARP = [0, 3, 7, 10, 12, 10, 7, 3];
  // ท่อนฮุค 4 ห้อง (null = พัก) เป็นกึ่งเสียงจาก A3
  const HOOK = [12, null, 15, 12, 17, 15, 12, null,  15, null, 12, 15, 17, 15, 12, null,
                19, null, 15, 19, 22, 19, 15, null,  14, null, 17, 14, 12, 10, 12, null];
  // ---- โหมดชิล (ล็อบบี้/หน้าแรก): คอร์ดนุ่ม อาร์เพจจิโอเบาๆ เบสช้า ไม่มีเสียงแหลม ----
  const CH_ROOTS = [3, 0, -4, -2];                    // C Am F G
  const CH_CHORDS = [[3, 7, 10], [0, 3, 7], [-4, 0, 3], [-2, 2, 5]];
  const CH_MEL = [24, null, null, 19, null, 22, null, null,  null, 19, null, null, 17, null, 19, null,
                  24, null, 22, null, null, 19, null, null,  17, null, null, 19, null, null, null, null];
  function chillStep(t, step) {
    const bar = (step / 8) | 0, s = step % 8, d = t - ctx.currentTime, ci = bar % 4, root = CH_ROOTS[ci];
    const at = (o) => { o.delay = d; o.bus = musicBus; return o; };
    if (s === 0 || s === 4) osc(at({ f: 130, f2: 50, type: "sine", dur: 0.22, vol: s ? 0.3 : 0.4 }));
    if (s % 2) noise(at({ f: 7000, dur: 0.04, vol: 0.05, q: 1, ftype: "highpass" }));
    if (s === 2 || s === 6) noise(at({ f: 2200, dur: 0.1, vol: 0.07, q: 0.8 }));
    if (s === 0 || s === 5) osc(at({ f: nf(root), type: "sine", dur: 0.5, vol: 0.34 }));
    if (s === 0) for (const n of CH_CHORDS[ci]) { osc(at({ f: nf(24 + n), type: "sine", dur: 1.9, vol: 0.06 })); osc(at({ f: nf(36 + n) * 1.003, type: "triangle", dur: 1.6, vol: 0.025 })); }
    const arp = CH_CHORDS[ci][(s >> 1) % 3];
    if (s % 2 === 0) osc(at({ f: nf(36 + arp), type: "triangle", dur: 0.32, vol: 0.06 }));
    const m = CH_MEL[(bar % 4) * 8 + s]; if (m != null) { osc(at({ f: nf(24 + m + 12), type: "sine", dur: 0.55, vol: 0.09 })); osc(at({ f: nf(24 + m + 24), type: "sine", dur: 0.3, vol: 0.025 })); }
  }
  // ---- โหมดย่องเบา (หน้าแรกปล้นพิพิธภัณฑ์): Dm สวิง เบสพิซซิคาโตเดินโครมาติก ดีดนิ้ว ไวบราโฟน ทำนองแอบ ๆ ----
  // กึ่งเสียงจาก A1 (เบส) / จาก A3 (คอร์ด/ทำนอง)
  const HB_BASS = [[5, 8, 12, 11], [10, 13, 17, 16], [1, 5, 8, 7], [0, 4, 7, 10],
                   [5, 8, 12, 11], [10, 13, 17, 16], [1, 5, 8, 9], [0, 4, 7, 4]];
  const HB_CH = [[5, 8, 12, 15], [10, 13, 17, 20], [1, 5, 8, 12], [0, 4, 7, 10]];
  const HB_MEL = [
    [17, null, null, 20, null, 19, null, 17], [null, null, 22, null, 25, null, 24, 22],
    [20, null, 17, null, null, 20, 22, null], [23, null, null, 24, null, null, null, null],
    [29, null, 27, null, 25, null, 24, null], [22, null, 25, 24, null, 22, 20, null],
    [19, null, 20, null, 22, null, 24, null], [23, null, 24, null, 28, null, null, null]];
  function heistStep(t, step) {
    const bar = ((step / 8) | 0) % 8, s = step % 8, ci = bar % 4;
    const swing = (s % 2) ? (60 / music.bpm / 2) * 0.32 : 0;          // สวิงจังหวะยก
    const d = t - ctx.currentTime + swing;
    // วัดด้วย earshot รอบแรก: -22.3 LUFS เบสหนา กลาง/เสียงทำนองจม → ยกทำนอง/ไวบ์/ดีดนิ้ว กดเบสลง แล้วคูณรวม
    const HG = 2.1;   // รอบ 2: 1.55 → -19.0 LUFS; รอบ 3: 2.3 → -17.1 LUFS แต่ true peak -0.9 (เกิน -1) → ถอยนิด
    const at = (o) => { o.delay = d; o.bus = musicBus; o.vol *= HG; return o; };
    // กลองเตะนุ่ม ๆ
    if (s === 0 || s === 5) osc(at({ f: 120, f2: 45, type: "sine", dur: 0.2, vol: s ? 0.32 : 0.46 }));
    // ดีดนิ้ว จังหวะ 2 และ 4
    if (s === 2 || s === 6) { noise(at({ f: 2600, dur: 0.05, vol: 0.34, q: 1.4 })); noise(at({ f: 5200, dur: 0.02, vol: 0.18, q: 2, ftype: "highpass" })); }
    // แปรงไฮแฮต
    noise(at({ f: 7500, dur: s % 2 ? 0.05 : 0.09, vol: s % 2 ? 0.07 : 0.1, q: 0.8, ftype: "highpass" }));
    // เบสพิซซิคาโตเดินโครมาติก (ตัวดำ) + โน้ตผีท้ายห้อง
    if (s % 2 === 0) { const n = HB_BASS[bar][s >> 1]; osc(at({ f: nf(n + 12), type: "triangle", dur: 0.2, vol: 0.26 })); osc(at({ f: nf(n), type: "sine", dur: 0.24, vol: 0.28 })); }
    if (s === 7 && bar % 2) osc(at({ f: nf(HB_BASS[bar][3] + 13), type: "triangle", dur: 0.08, vol: 0.12 }));
    // ไวบราโฟน: คอร์ดสะดุดจังหวะ (ต้นห้อง + จังหวะยกของบีต 2)
    if (s === 0 || s === 3) for (const n of HB_CH[ci]) { osc(at({ f: nf(24 + n), type: "sine", dur: s ? 0.5 : 1.1, vol: s ? 0.07 : 0.1 })); osc(at({ f: nf(36 + n), type: "sine", dur: 0.35, vol: 0.03 })); }
    // ทำนองแอบ ๆ (ห้อง 1–4 ต่ำ, 5–8 ตอบกลับสูงขึ้น) — ชั้นสี่เหลี่ยมบาง ๆ ให้ช่วงกลางชัดเหมือนทรัมเป็ตอุดปาก
    const m = HB_MEL[bar][s];
    if (m != null) { osc(at({ f: nf(m + 12), type: "triangle", dur: 0.26, vol: 0.28 })); osc(at({ f: nf(m + 12) * 1.003, type: "square", dur: 0.18, vol: 0.05 })); osc(at({ f: nf(m + 24), type: "sine", dur: 0.16, vol: 0.06 })); }
    // ฉาบเบา ๆ ต้นรอบ 8 ห้อง
    if (bar === 0 && s === 0) noise(at({ f: 6000, dur: 1.4, vol: 0.09, q: 0.5, ftype: "highpass" }));
  }
  // ---- โหมดไล่ล่า (ระหว่างเล่นเกมปล้นพิพิธภัณฑ์): Dm i-i-VI-V เบสโอสตินาโต กลองขับ ทำนองโครมาติก
  //      intensity 0→1 ค่อย ๆ เพิ่มชั้น: แคลป → สแตบ → ทำนอง → ทอมส่งท้ายห้อง → ไซเรนช่วงท้าย ----
  const CH_BASS = [[5, 5, 17, 5, 5, 17, 8, 10], [5, 5, 17, 5, 5, 17, 8, 10], [1, 1, 13, 1, 1, 13, 5, 6], [0, 0, 12, 0, 0, 12, 4, 7]];
  const CH_STAB = [[5, 8, 12], [5, 8, 12], [1, 5, 8], [0, 4, 7]];
  const CH_HOOK = [
    [17, null, 18, null, 19, null, 18, null], [17, null, null, 20, null, null, 22, 20],
    [21, null, 20, null, 17, null, null, null], [16, null, 19, null, 22, null, 25, null],
    [29, null, 30, null, 31, null, 30, null], [29, null, null, 32, null, null, 34, 32],
    [33, null, 32, null, 29, null, 28, null], [28, null, 31, null, 34, null, 37, null]];
  function chaseStep(t, step) {
    const bar = ((step / 8) | 0) % 8, s = step % 8, ci = bar % 4, I = music.intensity, d = t - ctx.currentTime;
    // earshot รอบแรก: -19.4 LUFS, เบสหนัก ช่วงกลางจม → คูณรวม + ยกทำนอง/สแตบ
    const HG = 1.65;
    const at = (o) => { o.delay = d; o.bus = musicBus; o.vol *= HG; return o; };
    // กลองเตะสี่จังหวะ
    if (s % 2 === 0) { osc(at({ f: 160, f2: 42, type: "sine", dur: 0.22, vol: 0.62 })); noise(at({ f: 3200, dur: 0.012, vol: 0.1, q: 1, ftype: "highpass" })); }
    // ไฮแฮต 8 ส่วน (ตัวยกดังกว่า = ขับ)
    noise(at({ f: 8500, dur: s % 2 ? 0.06 : 0.03, vol: s % 2 ? 0.18 : 0.09, q: 1.5, ftype: "highpass" }));
    // สแนร์/แคลป จังหวะ 2 และ 4
    if (I > 0.12 && (s === 2 || s === 6)) { noise(at({ f: 1800, dur: 0.13, vol: 0.26, q: 0.7 })); noise(at({ f: 5000, dur: 0.07, vol: 0.2, q: 1, ftype: "highpass" })); osc(at({ f: 220, f2: 160, type: "triangle", dur: 0.08, vol: 0.12 })); }
    // เบสโอสตินาโต (ทุกจังหวะ 8 ส่วน) ซับ + สี่เหลี่ยมบาง ๆ ให้หัวโน้ตคม
    const b = CH_BASS[ci][s];
    osc(at({ f: nf(b), type: "sine", dur: 0.17, vol: 0.34 })); osc(at({ f: nf(b + 12), type: "square", dur: 0.1, vol: 0.06 }));
    // สแตบเครื่องเป่า (ตัวยกของบีต 4) + ต้นห้อง
    if (I > 0.25 && (s === 0 || s === 7)) for (const n of CH_STAB[ci]) { osc(at({ f: nf(24 + n), type: "sawtooth", dur: s ? 0.12 : 0.2, vol: 0.07 })); osc(at({ f: nf(24 + n) * 1.006, type: "square", dur: 0.12, vol: 0.04 })); }
    // ทำนอง (ครึ่งหลังขึ้นอ็อกเทฟเมื่อใกล้จบ)
    if (I > 0.38) {
      const hb = I > 0.72 ? bar : bar % 4;
      const m = CH_HOOK[hb][s];
      if (m != null) { osc(at({ f: nf(m + 12), type: "square", dur: 0.16, vol: 0.11 })); osc(at({ f: nf(m + 12) * 1.005, type: "sawtooth", dur: 0.16, vol: 0.06 })); osc(at({ f: nf(m + 24), type: "triangle", dur: 0.1, vol: 0.06 })); }
    }
    // ทอมส่งท้ายทุก 4 ห้อง
    if (I > 0.55 && ci === 3 && s >= 5) osc(at({ f: [196, 165, 131][s - 5], f2: 70, type: "sine", dur: 0.16, vol: 0.4 }));
    // ฉาบต้นรอบ 4 ห้อง
    if (I > 0.45 && ci === 0 && s === 0) noise(at({ f: 6200, dur: 1.2, vol: 0.18, q: 0.4, ftype: "highpass" }));
    // ไซเรนเบา ๆ ช่วงท้ายเกม
    if (I > 0.85 && s === 0 && bar % 2 === 0) osc(at({ f: 660, f2: 990, type: "triangle", dur: 0.55, vol: 0.06 }));
  }
  function scheduleStep(t, step) {
    if (music.mode === "chill") return chillStep(t, step);
    if (music.mode === "heist") return heistStep(t, step);
    if (music.mode === "chase") return chaseStep(t, step);
    const bar = (step / 8) | 0, s = step % 8, I = music.intensity, d = t - ctx.currentTime, root = ROOTS[bar % 4];
    const at = (o) => { o.delay = d; o.bus = musicBus; return o; };
    // กลองเตะสี่จังหวะ + หัวคลิก (ซับหนักๆ ที่ earshot ว่าขาด)
    if (s % 2 === 0) { osc(at({ f: 175, f2: 44, type: 'sine', dur: 0.24, vol: 0.72 })); noise(at({ f: 3500, dur: 0.012, vol: 0.12, q: 1, ftype: 'highpass' })); }
    if (I > 0.6 && s === 7) osc(at({ f: 150, f2: 44, type: 'sine', dur: 0.14, vol: 0.5 }));
    // ไฮแฮต (ปิด/เปิดสลับ)
    noise(at({ f: 8000, dur: s % 2 ? 0.07 : 0.03, vol: s % 2 ? 0.22 : 0.1, q: 2, ftype: 'highpass' }));
    // แคลป/สแนร์ จังหวะ 2 และ 4
    if (I > 0.12 && (s === 2 || s === 6)) { noise(at({ f: 1900, dur: 0.14, vol: 0.28, q: 0.7 })); noise(at({ f: 5200, dur: 0.08, vol: 0.24, q: 1, ftype: 'highpass' })); }
    // เบส: ซับไซน์ + ชั้นสามเหลี่ยมอ็อกเทฟสูง ตามรูปซิงโคเปต
    if (BASSPAT[s]) { osc(at({ f: nf(root), type: 'sine', dur: 0.26, vol: 0.4 })); osc(at({ f: nf(root + 12), type: 'triangle', dur: 0.2, vol: 0.2 })); }
    // คอร์ดสแตบ
    if (I > 0.28 && (s === 0 || s === 3 || s === 4)) for (const n of CHORDS[bar % 4]) osc(at({ f: nf(24 + n), type: 'triangle', dur: s === 0 ? 0.42 : 0.2, vol: 0.05 }));
    // ท่อนฮุค (เมโลดี้หลัก)
    if (I > 0.42) { const n = HOOK[(bar % 4) * 8 + s]; if (n != null) { osc(at({ f: nf(24 + n), type: 'square', dur: 0.2, vol: 0.1 })); osc(at({ f: nf(24 + n) * 1.004, type: 'sawtooth', dur: 0.2, vol: 0.05 })); osc(at({ f: nf(36 + n), type: 'square', dur: 0.12, vol: 0.035 })); } }
    // อาร์เพจจิโอ + เลเยอร์สูง เมื่อใกล้จบ
    if (I > 0.62) osc(at({ f: nf(root + 36 + ARP[s] % 12), type: 'square', dur: 0.1, vol: 0.05 + I * 0.04 }));
    // ฉาบเปิดทุก 4 ห้อง
    if (I > 0.4 && s === 0 && bar % 4 === 0) noise(at({ f: 6500, dur: 1.3, vol: 0.2, q: 0.4, ftype: 'highpass' }));
  }
  function musicLoop() {
    if (!music.on) return;
    const spb = 60 / music.bpm / 2; // 8th notes
    while (music.next < ctx.currentTime + 0.25) {
      scheduleStep(music.next, music.step);
      music.step++; music.next += spb;
    }
  }
  function startMusic(bpm, mode) {
    mode = mode || "battle";
    music.want = { bpm, mode };
    if (muted || !ensure()) return;
    music.mode = mode; music.bpm = bpm || (mode === "chill" ? 84 : 120); music.on = true; music.step = 0; music.next = ctx.currentTime + 0.05;
    if (mode === "chill") music.intensity = 0;
    if (music.timer) clearInterval(music.timer);
    music.timer = setInterval(musicLoop, 60);
  }
  function halt() { music.on = false; if (music.timer) clearInterval(music.timer); music.timer = null; }
  function stopMusic() { music.want = null; halt(); }
  function setMusic(o) { if (o.bpm) music.bpm = o.bpm; if (o.intensity != null) music.intensity = o.intensity; if (o.vol != null && musicBus) musicBus.gain.setTargetAtTime(o.vol, ctx.currentTime, 0.2); }
  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : MASTER; if (m) halt(); else if (music.want) startMusic(music.want.bpm, music.want.mode); }
  // เปิดเพลงชิลทันทีที่ผู้ใช้แตะ/คลิกครั้งแรก (เบราว์เซอร์ห้ามเล่นเสียงเองก่อนมีการแตะ)
  function ambient(mode, bpm, onStart) {
    mode = mode || "chill"; bpm = bpm || 84;
    music.want = { bpm, mode };
    const go = () => { removeEventListener("pointerdown", go, true); removeEventListener("keydown", go, true); if (!music.on || music.mode !== mode) { if (!music.want || music.want.mode === mode) { startMusic(bpm, mode); if (onStart) onStart(); } } };
    addEventListener("pointerdown", go, true); addEventListener("keydown", go, true);
  }

  // เรนเดอร์ไทม์ไลน์เกมจำลองเป็นเสียงจริง → คืน Float32Array (mono)
  async function renderOffline(dur, events, bpmAt, intensityAt, sr, mFrom, mTo, mode) {
    sr = sr || 44100;
    const prevMode = music.mode; if (mode) music.mode = mode;
    const real = { ctx, master, fxBus, musicBus, noiseBuf };
    off = true; ctx = new OfflineAudioContext(1, Math.ceil(dur * sr), sr); noiseBuf = null;
    buildGraph();
    tOff = 0; let t = mFrom || 0, step = 0;
    const mEnd = mTo == null ? dur : mTo;
    while (t < mEnd) { music.intensity = intensityAt(t); music.bpm = bpmAt(t); scheduleStep(t, step); step++; t += 60 / bpmAt(t) / 2; }
    for (const e of events) { tOff = e.t; vnow = e.t * 1000; play(e.name, e.opt); }
    tOff = 0;
    const buf = await ctx.startRendering();
    const out = buf.getChannelData(0).slice();
    off = false; ({ ctx, master, fxBus, musicBus, noiseBuf } = real); music.mode = prevMode;
    return out;
  }

  return { ambient, renderOffline, ensure, play, startMusic, stopMusic, setMusic, setMuted, isMuted: () => muted, debug: () => ({ state: ctx && ctx.state, t: ctx && ctx.currentTime, musicOn: music.on, step: music.step, muted }) };
})();
