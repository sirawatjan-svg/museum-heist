// ============================================================
// Rules — ตัวเลขกติกาและอาชีพโจร ใช้ร่วมกันทั้งจอครู (ตัดสินจริง) และมือถือ (แสดงผลทันที)
// ปรับสมดุลเกมได้ที่ TUNE ที่เดียว
// วงจร (21 พ.ย.): ตอบถูกได้เพชร · ถูกสะสมครบทุก 3 ข้อ = ปล้นอัตโนมัติ · ครบทุก 9 ข้อ = สกิลอาชีพทำงานเอง
// ============================================================
const Rules = (() => {
  const TUNE = {
    base: 10,           // ตอบถูกได้เพชรพื้นฐาน
    speedMax: 5,        // โบนัสความเร็วสูงสุด (ตอบภายใน speedMs ได้เต็ม ลดลงเป็นเส้นตรงถึง 0 ที่ครึ่งเวลา)
    speedMs: 4000,
    streakFrom: 3,      // ตอบถูกติดกันตั้งแต่ข้อนี้ได้โบนัส
    streakBonus: 5,
    perHeist: 3,        // ตอบถูกสะสมครบทุกกี่ข้อ → หน้าปล้นเด้งเอง
    perSkill: 9,        // ตอบถูกสะสมครบทุกกี่ข้อ → สกิลอาชีพทำงานเอง
    pickMs: 6000,       // เวลาเลือกเป้า ไม่เลือก = สุ่มให้
    pins: 2,            // สลักที่ต้องงัด
    crackMs: 5000,      // เวลาด่านงัดตู้
    zone: 0.17,         // ความกว้างโซนเขียว (สัดส่วนของวงกลม)
    needleMs: 1500,     // เข็มหมุนครบรอบกี่มิลลิวินาที
    stealFull: 0.25,    // งัดได้ครบ 2/2
    stealPart: 0.12,    // งัดได้ 1/2
    stealMin: 3,        // ขโมยได้อย่างน้อยเท่านี้ (ถ้าเป้าหมายมีพอ)
    protectMs: 25000,   // คนที่เพิ่งโดนปล้น มีโล่คุ้มกันกี่มิลลิวินาที
    // สกิล
    grabRate: 0.08,     // นักล้วงกระเป๋า: ล้วงจากผู้นำ 3 คน
    ghostRate: 0.35,    // นักเจาะตู้เซฟ: การปล้นรอบถัดไปสำเร็จแน่นอน
    intelCount: 3,      // จอมวางแผน: ตอบถูกกี่ข้อถัดไปได้เพชร 2 เท่า
    vaultMs: 45000,     // ผู้พิทักษ์: ปล้นไม่ได้กี่มิลลิวินาที
    vaultFine: 0.10,    // โจรที่มาปล้นตู้นิรภัย เสียเพชรให้ผู้พิทักษ์
    planFloor: 0.08,    // จอมวางแผน: งัดพลาดหมดก็ยังได้เท่านี้
  };

  // อาชีพโจร — พลังติดตัว 1 อย่าง + สกิล 1 อย่าง (ทำงานเองทุก 9 ข้อ)
  const CLASSES = [
    { id: 'pick',  emoji: '🧤', name: 'นักล้วงกระเป๋า', short: 'มือไว',   color: '#ff5a67',
      power: 'ขโมยได้มากกว่าคนอื่น +5%',
      skill: 'ล้วงหมู่', skillEmoji: '👐', skillDesc: 'ล้วงเพชร 8% จากผู้นำ 3 คนพร้อมกัน' },
    { id: 'crack', emoji: '🔐', name: 'นักเจาะตู้เซฟ',  short: 'งัดเก่ง', color: '#3fd0f0',
      power: 'โซนเขียวตอนงัดตู้กว้างขึ้นเกือบเท่าตัว',
      skill: 'กุญแจผี', skillEmoji: '🗝️', skillDesc: 'ปล้นรอบถัดไปสำเร็จแน่นอน ได้ 35%' },
    { id: 'plan',  emoji: '🕵️', name: 'จอมวางแผน',     short: 'ตาไว',    color: '#9b7bff',
      power: 'งัดพลาดหมดก็ยังขโมยได้ 8% สัญญาณไม่ดัง',
      skill: 'ข้อมูลวงใน', skillEmoji: '📂', skillDesc: 'ตอบถูก 3 ข้อถัดไปได้เพชร 2 เท่า' },
    { id: 'guard', emoji: '🛡️', name: 'ผู้พิทักษ์',     short: 'ตู้แข็ง', color: '#3ddc97',
      power: 'โดนขโมยแค่ครึ่งเดียวเสมอ',
      skill: 'ตู้นิรภัย', skillEmoji: '🏦', skillDesc: '45 วินาทีไม่มีใครปล้นได้ ใครมาปล้นเสียเพชรให้แทน' },
  ];
  const cls = (id) => CLASSES.find(c => c.id === id) || CLASSES[0];

  // เพชรที่ได้จากการตอบถูก 1 ข้อ
  function earn(ms, streak, qTime, double) {
    const half = (qTime || 20000) / 2;
    let speed = 0;
    if (ms <= TUNE.speedMs) speed = TUNE.speedMax;
    else if (ms < half) speed = Math.round(TUNE.speedMax * (half - ms) / (half - TUNE.speedMs));
    const st = streak >= TUNE.streakFrom ? TUNE.streakBonus : 0;
    const base = TUNE.base + speed + st;
    return { total: double ? base * 2 : base, speed, streak: st, double: !!double };
  }

  // สัดส่วนที่ขโมยได้: hits = สลักที่งัดได้ (0–2), ghost = ใช้กุญแจผี
  function stealRate(hits, thiefCls, victimCls, ghost) {
    let r = ghost ? TUNE.ghostRate : hits >= TUNE.pins ? TUNE.stealFull : hits >= 1 ? TUNE.stealPart : 0;
    if (!r && thiefCls === 'plan') r = TUNE.planFloor;
    if (!r) return 0;
    if (thiefCls === 'pick') r += 0.05;
    if (victimCls === 'guard') r /= 2;
    return r;
  }
  function cut(victimD, r) {
    if (!r || victimD <= 0) return 0;
    return Math.min(victimD, Math.max(Math.min(TUNE.stealMin, victimD), Math.round(victimD * r)));
  }
  function stealAmount(victimD, hits, thiefCls, victimCls, ghost) { return cut(victimD, stealRate(hits, thiefCls, victimCls, ghost)); }
  function zoneFor(c) { return c === 'crack' ? TUNE.zone * 1.9 : TUNE.zone; }

  return { TUNE, CLASSES, cls, earn, stealRate, stealAmount, cut, zoneFor };
})();
