/**
 * اختبارات القبول ١، ٢، ٥ — SPEC.md §4
 *
 * الترتيب المقصود: هذا الملف يُكتَب قبل engine.ts (TDD).
 *
 * ١ — حساب السقف (computeCeiling) — بما فيه:
 *     - locked → 0 مطلق
 *     - حدود الأمان للزوجة (safety < 40 / 60 / 80)
 *     - الزوج لا يملك keyState ولا safety — earnedLevel فقط
 *
 * ٢ — ناتج واجهة الزوج مُتطابق حرفياً بصرف النظر عن keyState
 *     (بنية HusbandCeilingContext لا تحمل keyState أصلاً)
 *
 * ٥ — تطبيق إشارة الجلسة (applySessionSignal) — عدم التناظر:
 *     - صعود +1 فقط بعد ثلاث جلسات إيجابية متتالية
 *     - نزول −1 فوراً عند أي تجاوز لبطاقة intensity ≥ 1
 */

import { describe, it, expect } from "vitest";
import {
  computeCeiling,
  applySessionSignal,
  selectCard,
} from "@/lib/sakan/engine";
import type {
  WifeCeilingContext,
  HusbandCeilingContext,
  CeilingState,
  SelectCardParams,
} from "@/lib/sakan/engine";
import type { Card, SessionSignal } from "@/types/sakan";

// ─── بطاقات اختبار مبسّطة ────────────────────────────────────────────────────

const makeCard = (
  overrides: Partial<Card> & Pick<Card, "id" | "audience" | "intensity">
): Card => ({
  kind: "concept",
  addresses: ["fear"],
  duration_sec: 60,
  body: "نص الاختبار",
  ...overrides,
});

const WIFE_CARDS: Card[] = [
  makeCard({ id: "W-T0", audience: "wife", intensity: 0, addresses: ["fear"] }),
  makeCard({ id: "W-T1", audience: "wife", intensity: 1, addresses: ["shame"] }),
  makeCard({ id: "W-T2", audience: "wife", intensity: 2, addresses: ["fear"] }),
  makeCard({ id: "W-T3", audience: "wife", intensity: 3, addresses: ["shame"] }),
];

const HUSBAND_CARDS: Card[] = [
  makeCard({ id: "H-T0", audience: "husband", intensity: 0, addresses: ["shame"] }),
  makeCard({ id: "H-T1", audience: "husband", intensity: 1, addresses: ["fear"] }),
  makeCard({ id: "H-T3", audience: "husband", intensity: 3, addresses: ["shame"] }),
];

// ─── اختبار القبول ١: حساب السقف ────────────────────────────────────────────

describe("Acceptance test #1 — computeCeiling", () => {
  // ─── الزوجة (wife) ───────────────────────────────────────────────────────

  it("wife + locked → ceiling = 0, always, regardless of earnedLevel or safety", () => {
    const ctx: WifeCeilingContext = {
      role: "wife",
      keyState: "locked",
      safety: 90,
      earnedLevel: 5,
    };
    expect(computeCeiling(ctx)).toBe(0);
  });

  it("wife + locked + low safety + low earnedLevel → still 0", () => {
    const ctx: WifeCeilingContext = {
      role: "wife",
      keyState: "locked",
      safety: 10,
      earnedLevel: 0,
    };
    expect(computeCeiling(ctx)).toBe(0);
  });

  it("wife + open + safety < 40 → ceiling ≤ 1", () => {
    const ctx: WifeCeilingContext = {
      role: "wife",
      keyState: "open",
      safety: 30,
      earnedLevel: 5,
    };
    expect(computeCeiling(ctx)).toBe(1);
  });

  it("wife + open + safety < 40 + earnedLevel = 0 → ceiling = 0", () => {
    const ctx: WifeCeilingContext = {
      role: "wife",
      keyState: "open",
      safety: 20,
      earnedLevel: 0,
    };
    expect(computeCeiling(ctx)).toBe(0);
  });

  it("wife + open + safety < 60 → ceiling ≤ 2", () => {
    const ctx: WifeCeilingContext = {
      role: "wife",
      keyState: "open",
      safety: 55,
      earnedLevel: 5,
    };
    expect(computeCeiling(ctx)).toBe(2);
  });

  it("wife + open + safety < 80 → ceiling ≤ 3", () => {
    const ctx: WifeCeilingContext = {
      role: "wife",
      keyState: "open",
      safety: 75,
      earnedLevel: 5,
    };
    expect(computeCeiling(ctx)).toBe(3);
  });

  it("wife + open + safety ≥ 80 → ceiling = earnedLevel (up to 5)", () => {
    const ctx: WifeCeilingContext = {
      role: "wife",
      keyState: "open",
      safety: 85,
      earnedLevel: 4,
    };
    expect(computeCeiling(ctx)).toBe(4);
  });

  it("wife + open + safety = 100 + earnedLevel = 5 → ceiling = 5", () => {
    const ctx: WifeCeilingContext = {
      role: "wife",
      keyState: "open",
      safety: 100,
      earnedLevel: 5,
    };
    expect(computeCeiling(ctx)).toBe(5);
  });

  it("wife earnedLevel is capped — never exceeds 5", () => {
    // حتى لو كان earnedLevel أكبر من المتوقع (بيانات قديمة)
    const ctx: WifeCeilingContext = {
      role: "wife",
      keyState: "open",
      safety: 100,
      earnedLevel: 99, // قيمة غير عادية
    };
    expect(computeCeiling(ctx)).toBe(5);
  });

  // ─── الزوج (husband) ─────────────────────────────────────────────────────

  it("husband + earnedLevel = 0 → ceiling = 0", () => {
    const ctx: HusbandCeilingContext = {
      role: "husband",
      shame: 50,
      earnedLevel: 0,
    };
    expect(computeCeiling(ctx)).toBe(0);
  });

  // SPEC §4.1 (بعد تصحيح المواصفة): سقف الزوج مقفول عند 0 دائماً.
  // كان هذان الاختباران يؤكّدان ارتفاعه بـ earnedLevel — وهو ما صحّحته المواصفة.

  it("husband + earnedLevel = 3 → ceiling = 0 (husband ceiling never rises)", () => {
    const ctx: HusbandCeilingContext = {
      role: "husband",
      shame: 80,
      earnedLevel: 3,
    };
    expect(computeCeiling(ctx)).toBe(0);
  });

  it("husband ceiling stays 0 even at an absurd earnedLevel", () => {
    const ctx: HusbandCeilingContext = {
      role: "husband",
      shame: 0,
      earnedLevel: 99,
    };
    expect(computeCeiling(ctx)).toBe(0);
  });

  it("HusbandCeilingContext structurally excludes keyState", () => {
    const ctx: HusbandCeilingContext = {
      role: "husband",
      shame: 50,
      earnedLevel: 2,
    };
    // TypeScript يرفض إضافة keyState بنيوياً؛ هذا الحارس يتحقق في وقت التشغيل
    expect(Object.keys(ctx)).not.toContain("keyState");
  });
});

// ─── اختبار القبول ٢: انظر keystate-isolation.test.ts ──────────────────────
//
// المستوى الأول (بنيوي — فحص الكود المصدري): keystate-isolation.test.ts
// المستوى الثاني (عرض فعلي — مقارنة شجرة الزوج): مؤجَّل حتى بناء الصفحات
//   اليومية في الخطوة ٥.

// ─── اختبار القبول ٥: تطبيق إشارة الجلسة — عدم التناظر ────────────────────

describe("Acceptance test #5 — applySessionSignal asymmetric ceiling", () => {
  const BASE_STATE: CeilingState = {
    earnedLevel: 2,
    consecutivePositiveSessions: 0,
  };

  // ─── الهبوط الفوري ────────────────────────────────────────────────────────

  it("skip + intensity ≥ 1 → earnedLevel drops immediately by 1", () => {
    const signal: SessionSignal = {
      cardId: "W-T1",
      response: "skipped",
      durationSec: 5,
      recordedAt: new Date().toISOString(),
    };
    const next = applySessionSignal(BASE_STATE, signal, 1);
    expect(next.earnedLevel).toBe(1);
    expect(next.consecutivePositiveSessions).toBe(0);
  });

  it("close + intensity ≥ 1 → earnedLevel drops immediately", () => {
    const signal: SessionSignal = {
      cardId: "W-T2",
      response: "closed",
      durationSec: 3,
      recordedAt: new Date().toISOString(),
    };
    const next = applySessionSignal(BASE_STATE, signal, 2);
    expect(next.earnedLevel).toBe(1);
    expect(next.consecutivePositiveSessions).toBe(0);
  });

  it("earnedLevel never drops below 0", () => {
    const atFloor: CeilingState = { earnedLevel: 0, consecutivePositiveSessions: 0 };
    const signal: SessionSignal = {
      cardId: "W-T1",
      response: "skipped",
      durationSec: 2,
      recordedAt: new Date().toISOString(),
    };
    const next = applySessionSignal(atFloor, signal, 1);
    expect(next.earnedLevel).toBe(0); // لا هبوط تحت الصفر
  });

  it("skip + intensity = 0 → no change to earnedLevel, consecutive resets to 0", () => {
    const withStreak: CeilingState = { earnedLevel: 2, consecutivePositiveSessions: 2 };
    const signal: SessionSignal = {
      cardId: "W-T0",
      response: "skipped",
      durationSec: 2,
      recordedAt: new Date().toISOString(),
    };
    // intensity = 0 → لا عقوبة على السقف
    const next = applySessionSignal(withStreak, signal, 0);
    expect(next.earnedLevel).toBe(2);          // لا تغيير
    expect(next.consecutivePositiveSessions).toBe(0); // يُصفَّر التسلسل
  });

  // ─── الصعود البطيء (٣ جلسات إيجابية متتالية) ────────────────────────────

  it("2 positive sessions → no rise yet, consecutive = 2", () => {
    let state: CeilingState = { earnedLevel: 1, consecutivePositiveSessions: 0 };
    const positiveSignal = (id: string): SessionSignal => ({
      cardId: id,
      response: "accepted",
      comfortRating: 4,
      durationSec: 60,
      recordedAt: new Date().toISOString(),
    });

    state = applySessionSignal(state, positiveSignal("W-T0"), 0);
    expect(state.consecutivePositiveSessions).toBe(1);
    expect(state.earnedLevel).toBe(1);

    state = applySessionSignal(state, positiveSignal("W-T1"), 1);
    expect(state.consecutivePositiveSessions).toBe(2);
    expect(state.earnedLevel).toBe(1);
  });

  it("3rd positive session → earnedLevel rises by 1, consecutive resets to 0", () => {
    let state: CeilingState = { earnedLevel: 1, consecutivePositiveSessions: 2 };
    const signal: SessionSignal = {
      cardId: "W-T2",
      response: "accepted",
      comfortRating: 5,
      durationSec: 60,
      recordedAt: new Date().toISOString(),
    };
    state = applySessionSignal(state, signal, 2);
    expect(state.earnedLevel).toBe(2);
    expect(state.consecutivePositiveSessions).toBe(0);
  });

  it("earnedLevel never rises above 5", () => {
    const atCeiling: CeilingState = { earnedLevel: 5, consecutivePositiveSessions: 2 };
    const signal: SessionSignal = {
      cardId: "W-T0",
      response: "accepted",
      comfortRating: 5,
      durationSec: 60,
      recordedAt: new Date().toISOString(),
    };
    const next = applySessionSignal(atCeiling, signal, 0);
    expect(next.earnedLevel).toBe(5); // لا صعود فوق 5
  });

  it("accepted + comfortRating < 3 → no rise, consecutive resets to 0", () => {
    const withStreak: CeilingState = { earnedLevel: 2, consecutivePositiveSessions: 2 };
    const signal: SessionSignal = {
      cardId: "W-T0",
      response: "accepted",
      comfortRating: 2, // أقل من 3 → ليس "إيجابياً" كافياً
      durationSec: 60,
      recordedAt: new Date().toISOString(),
    };
    const next = applySessionSignal(withStreak, signal, 0);
    expect(next.earnedLevel).toBe(2);
    expect(next.consecutivePositiveSessions).toBe(0);
  });

  it("accepted without comfortRating → consecutive resets to 0", () => {
    const withStreak: CeilingState = { earnedLevel: 2, consecutivePositiveSessions: 1 };
    const signal: SessionSignal = {
      cardId: "W-T0",
      response: "accepted",
      // comfortRating absent
      durationSec: 60,
      recordedAt: new Date().toISOString(),
    };
    const next = applySessionSignal(withStreak, signal, 0);
    expect(next.earnedLevel).toBe(2);
    expect(next.consecutivePositiveSessions).toBe(0);
  });

  // ─── العدم-تناظر — مقارنة الهبوط مقابل الصعود ───────────────────────────

  it("asymmetry: one skip undoes two positive sessions instantly", () => {
    // بناء تسلسل جلستين إيجابيتين
    let state: CeilingState = { earnedLevel: 3, consecutivePositiveSessions: 0 };

    const pos: SessionSignal = {
      cardId: "H-T0",
      response: "accepted",
      comfortRating: 4,
      durationSec: 60,
      recordedAt: new Date().toISOString(),
    };
    state = applySessionSignal(state, pos, 0);
    state = applySessionSignal(state, pos, 0);
    expect(state.consecutivePositiveSessions).toBe(2);
    expect(state.earnedLevel).toBe(3); // لم يرتفع بعد

    // تجاوز واحد → يمحو التسلسل ويُنزل السقف
    const skip: SessionSignal = {
      cardId: "H-T1",
      response: "skipped",
      durationSec: 2,
      recordedAt: new Date().toISOString(),
    };
    state = applySessionSignal(state, skip, 1);
    expect(state.earnedLevel).toBe(2);          // نزل −1
    expect(state.consecutivePositiveSessions).toBe(0); // مُصفَّر
  });
});

// ─── دالة selectCard — اختبارات أساسية ──────────────────────────────────────

describe("selectCard — basic filtering", () => {
  it("returns null when no cards pass the ceiling filter", () => {
    const params: SelectCardParams = {
      role: "wife",
      ceiling: 0,
      cards: WIFE_CARDS.filter((c) => c.intensity > 0), // كلها فوق السقف
      flags: [],
      shownCardIds: new Set(),
    };
    expect(selectCard(params)).toBeNull();
  });

  it("only returns cards matching the role's audience", () => {
    const allCards = [...WIFE_CARDS, ...HUSBAND_CARDS];
    const card = selectCard({
      role: "husband",
      ceiling: 5,
      cards: allCards,
      flags: [],
      shownCardIds: new Set(),
    });
    expect(card).not.toBeNull();
    expect(card!.audience).toBe("husband");
  });

  it("never returns a card already in shownCardIds (except when all are shown)", () => {
    const shownIds = new Set(HUSBAND_CARDS.map((c) => c.id));
    // جميع بطاقات الزوج مُعروضة → يُعاد التشغيل من الصفر
    const card = selectCard({
      role: "husband",
      ceiling: 5,
      cards: HUSBAND_CARDS,
      flags: [],
      shownCardIds: shownIds,
    });
    // إعادة التشغيل من الصفر: يُرجع بطاقة رغم shownCardIds الممتلئة
    expect(card).not.toBeNull();
  });

  it("never returns a card with intensity > ceiling", () => {
    const card = selectCard({
      role: "wife",
      ceiling: 1,
      cards: WIFE_CARDS,
      flags: [],
      shownCardIds: new Set(),
    });
    expect(card).not.toBeNull();
    expect(card!.intensity).toBeLessThanOrEqual(1);
  });

  it("avoids lastCardId (immediate repeat prevention)", () => {
    // بطاقة واحدة intensity=0 غير lastCardId
    const twoCards: Card[] = [
      makeCard({ id: "H-A", audience: "husband", intensity: 0 }),
      makeCard({ id: "H-B", audience: "husband", intensity: 0 }),
    ];
    const card = selectCard({
      role: "husband",
      ceiling: 0,
      cards: twoCards,
      flags: [],
      shownCardIds: new Set(),
      lastCardId: "H-A",
    });
    expect(card?.id).toBe("H-B");
  });
});
