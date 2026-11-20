// ============================================================
// Rules — ตัวเลขกติกาและอาชีพโจร ใช้ร่วมกันทั้งจอครู (ตัดสินจริง) และมือถือ (แสดงผลทันที)
// ปรับสมดุลเกมได้ที่ TUNE ที่เดียว
// ============================================================
const Rules = (() => {
  const TUNE = {
    base: 10,           // ตอบถูกได้เพชรพื้นฐาน
    speedMax: 5,        // โบนัสความเร็วสูงสุด (ตอบภายใน speedMs ได้เต็ม ลดลงเป็นเส้นตรงถึง 0 ที่ครึ่งเวลา)
    speedMs: 4000,
    streakFrom: 3,      // ตอบถูกติดกันตั้งแต่ข้อนี้ได้โบนัส
    streakBonus: 5,
    perTicket: 3,       // ตอบถูกครบกี่ข้อได้ "ตั๋วปล้น" 1 ใบ
    maxTickets: 2,
    stealFull: 0.25,    // งัดตู้ได้ 3/3 สลัก
    stealPart: 0.15,    // งัดได้ 2/3 สลัก
    stealMin: 3,        // ขโมยได้อย่างน้อยเท่านี้ (ถ้าเป้าหมายมีพอ)
    protectMs: 25000,   // คนที่เพิ่งโดนปล้น มีโล่คุ้มกันกี่มิลลิวินาที
    lockCost: 20,       // ราคาล็อกตู้เซฟ (กันการปล้นได้ 1 ครั้ง)
    zone: 0.16,         // ความกว้างโซนเขียวของเข็มงัดตู้ (สัดส่วนของวงกลม)
    needleMs: 1500,     // เข็มหมุนครบรอบกี่มิลลิวินาที
    crackMs: 9000,      // เวลาทั้งหมดของด่านงัดตู้
  };

  // อาชีพโจร — แต่ละแบบมีพลังเดียว อ่านเข้าใจได้ในประโยคเดียว
  const CLASSES = [
    { id: 'pick',  emoji: '🧤', name: 'นักล้วงกระเป๋า', short: 'มือไว',     power: 'ขโมยได้มากกว่าคนอื่น +5%', color: '#e8505b' },
    { id: 'crack', emoji: '🔐', name: 'นักเจาะตู้เซฟ',  short: 'งัดเก่ง',   power: 'โซนเขียวตอนงัดตู้กว้างขึ้นเกือบเท่าตัว', color: '#2a9d8f' },
    { id: 'plan',  emoji: '🕵️', name: 'จอมวางแผน',     short: 'ตาไว',      power: 'มองเห็นว่าตู้ของใครติดล็อกไว้', color: '#7b5cd6' },
    { id: 'guard', emoji: '🛡️', name: 'ผู้พิทักษ์',     short: 'ตู้แข็ง',   power: 'เริ่มเกมมีล็อก 1 อัน และโดนขโมยแค่ครึ่งเดียว', color: '#e0a100' },
  ];
  const cls = (id) => CLASSES.find(c => c.id === id) || CLASSES[0];

  // เพชรที่ได้จากการตอบถูก 1 ข้อ
  function earn(ms, streak, qTime) {
    const half = (qTime || 20000) / 2;
    let speed = 0;
    if (ms <= TUNE.speedMs) speed = TUNE.speedMax;
    else if (ms < half) speed = Math.round(TUNE.speedMax * (half - ms) / (half - TUNE.speedMs));
    const st = streak >= TUNE.streakFrom ? TUNE.streakBonus : 0;
    return { total: TUNE.base + speed + st, speed, streak: st };
  }

  // สัดส่วนที่ขโมยได้จากจำนวนสลักที่งัดสำเร็จ (0–3)
  function stealRate(hits, thiefCls, victimCls) {
    let r = hits >= 3 ? TUNE.stealFull : hits === 2 ? TUNE.stealPart : 0;
    if (!r) return 0;
    if (thiefCls === 'pick') r += 0.05;
    if (victimCls === 'guard') r /= 2;
    return r;
  }
  function stealAmount(victimD, hits, thiefCls, victimCls) {
    const r = stealRate(hits, thiefCls, victimCls);
    if (!r || victimD <= 0) return 0;
    return Math.min(victimD, Math.max(Math.min(TUNE.stealMin, victimD), Math.round(victimD * r)));
  }
  function zoneFor(c) { return c === 'crack' ? TUNE.zone * 1.9 : TUNE.zone; }
  function lockCost() { return TUNE.lockCost; }

  return { TUNE, CLASSES, cls, earn, stealRate, stealAmount, zoneFor, lockCost };
})();
