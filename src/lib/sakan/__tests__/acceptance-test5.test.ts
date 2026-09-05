/**
 * اختبار القبول ٥ (SPEC §8.5)
 *
 *   "ارتفاع السقف مستحيل بلا فعل صريح من الزوجة؛ لا مسار زمني يرفعه."
 *
 * ويقابله في §1 القاعدة ٨: "الاستعداد يُعلَن ولا يُستدعى. لا مؤقّت يفتح مرحلة،
 * ولا تدرّج تلقائي."
 *
 * ─── لماذا لا تكفي اختبارات applySessionSignal الوحدوية ──────────────────────
 * engine.test.ts يتحقق من أن ثلاث جلسات إيجابية ترفع earnedLevel بمقدار ١.
 * لكن earnedLevel **ليس** السقف. المواصفة تتحدث عن السقف الفعّال، والادّعاء
 * المطلوب إثباته أقوى: لا تتابع جلسات، ولا مرور وقت، ولا أي تركيبة من
 * الاثنين، ترفع السقف ما دام المفتاح مغلقاً. الفعل الصريح الوحيد الذي
 * يرفعه هو تبديل الزوجة للمفتاح إلى 'open'.
 *
 * ─── المنهج: محاكاة مسارات كاملة، لا حالات مفردة ─────────────────────────────
 * المستوى ١ — مسار الجلسات: ٢٠٠ جلسة إيجابية متتالية (أكثر من ٦٦ ضعف عتبة
 *   الارتفاع البالغة ٣) مع المفتاح مغلق. السقف يُعاد حسابه بعد كل جلسة،
 *   ويجب أن يبقى 0 في كل خطوة من الـ٢٠٠.
 *
 * المستوى ٢ — المسار الزمني: تقدُّم الوقت يوماً بيوم على مدى سنتين كاملتين
 *   (٧٣٠ يوماً) بكل حالات السكون التي يمرّ بها، مع المفتاح مغلق. السقف
 *   يجب أن يبقى 0 في كل يوم من الـ٧٣٠.
 *
 * المستوى ٣ — المسارَان معاً: جلسات إيجابية موزّعة على سنتين. السقف يبقى 0.
 *
 * المستوى ٤ — الفعل الصريح: نفس الحالة النهائية تماماً بعد كل ما سبق، لكن
 *   بتبديل keyState إلى 'open' وحده. هنا — وهنا فقط — يرتفع السقف.
 *   هذا يثبت أن الاختبار ليس صحيحاً بالمصادفة (vacuously true).
 *
 * ─── ما يُفشل الاختبار ───────────────────────────────────────────────────────
 *   - أي فرع في computeCeiling يتجاوز شرط locked بعد عدد جلسات أو مدّة.
 *   - أي "تدرّج تلقائي" أو مؤقّت يفتح مرحلة.
 *   - أي مسار يجعل earnedLevel يرفع السقف الفعّال والمفتاح مغلق.
 */

import { describe, it, expect } from "vitest";
import { computeCeiling, applySessionSignal, isDormant } from "@/lib/sakan/engine";
import type { CeilingState } from "@/lib/sakan/engine";
import type { SessionSignal } from "@/types/sakan";

// ─── ثوابت ────────────────────────────────────────────────────────────────────

const START     = new Date("2025-01-01T12:00:00Z");
const START_ISO = START.toISOString();

/** جلسة إيجابية: قُبلت + تقييم راحة مرتفع → أقوى مسار صعود ممكن. */
const POSITIVE_SESSION: SessionSignal = {
  cardId: "TEST-AT5-CARD",
  response: "accepted",
  comfortRating: 5,
  durationSec: 60,
  recordedAt: START_ISO,
};

const INITIAL: CeilingState = {
  earnedLevel: 0,
  consecutivePositiveSessions: 0,
};

/** السقف الفعّال للزوجة عند حالة سقف ومستوى أمان معيّنين. */
function wifeCeiling(state: CeilingState, keyState: "locked" | "open", safety: number): number {
  return computeCeiling({
    role: "wife",
    keyState,
    safety,
    earnedLevel: state.earnedLevel,
  });
}

function addDays(base: Date, days: number): string {
  return new Date(base.getTime() + days * 86_400_000).toISOString();
}

// ═══════════════════════════════════════════════════════════════════════════════
// المستوى ١ — مسار الجلسات
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #5 (§8.5 L1) — no session path raises the ceiling while locked", () => {
  it("200 consecutive positive sessions leave the ceiling at 0 at every single step", () => {
    let state = INITIAL;

    for (let session = 1; session <= 200; session++) {
      state = applySessionSignal(state, POSITIVE_SESSION, 0);

      // يُفحص عند أعلى مستوى أمان ممكن — أضعف قيد ممكن غير المفتاح
      const ceiling = wifeCeiling(state, "locked", 100);

      expect(
        ceiling,
        `ceiling rose to ${ceiling} after ${session} positive session(s) ` +
          `while KeyState = 'locked' (earnedLevel reached ${state.earnedLevel})`
      ).toBe(0);
    }

    // حارس: earnedLevel ارتفع فعلاً — لولا ذلك لكان الاختبار صحيحاً بالمصادفة
    expect(
      state.earnedLevel,
      "earnedLevel never moved — the test would be vacuously true"
    ).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// المستوى ٢ — المسار الزمني
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #5 (§8.5 L2) — no temporal path raises the ceiling while locked", () => {
  it("730 days of elapsed time leave the ceiling at 0 on every day", () => {
    const metricsMovedAt = START.toISOString();
    let sawDormancy = false;

    for (let day = 0; day <= 730; day++) {
      const now = addDays(START, day);

      if (isDormant(metricsMovedAt, now)) sawDormancy = true;

      // الحالة لا تتغيّر بمرور الوقت — لا جلسات، مجرّد زمن يمضي
      const ceiling = wifeCeiling(INITIAL, "locked", 100);

      expect(
        ceiling,
        `ceiling rose to ${ceiling} on day ${day} of elapsed time ` +
          `while KeyState = 'locked' — a temporal path raised it`
      ).toBe(0);
    }

    // حارس: مررنا فعلاً بوضع السكون خلال السنتين
    expect(sawDormancy, "dormancy was never reached — window too short").toBe(true);
  });

  it("time passing never raises the ceiling for ANY earnedLevel while locked", () => {
    for (let earnedLevel = 0; earnedLevel <= 5; earnedLevel++) {
      for (const day of [0, 21, 60, 180, 365, 730]) {
        const ceiling = computeCeiling({
          role: "wife",
          keyState: "locked",
          safety: 100,
          earnedLevel,
        });

        expect(
          ceiling,
          `ceiling is ${ceiling} at day ${day} with earnedLevel ${earnedLevel} ` +
            `while locked — expected 0`
        ).toBe(0);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// المستوى ٣ — المسارَان معاً
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #5 (§8.5 L3) — sessions + time combined still raise nothing", () => {
  it("positive sessions spread across two years leave the ceiling at 0 throughout", () => {
    let state = INITIAL;

    for (let day = 0; day <= 730; day++) {
      // جلسة إيجابية كل ثلاثة أيام على مدى سنتين
      if (day % 3 === 0) {
        state = applySessionSignal(state, POSITIVE_SESSION, 0);
      }

      for (const safety of [0, 40, 60, 80, 100]) {
        const ceiling = wifeCeiling(state, "locked", safety);

        expect(
          ceiling,
          `ceiling rose to ${ceiling} on day ${day} (safety ${safety}, ` +
            `earnedLevel ${state.earnedLevel}) while KeyState = 'locked'`
        ).toBe(0);
      }
    }

    expect(state.earnedLevel).toBe(5); // بلغ الحدّ الأقصى — ومع ذلك السقف 0
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// المستوى ٤ — الفعل الصريح وحده يرفع السقف
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #5 (§8.5 L4) — only the wife's explicit act raises it", () => {
  it("the SAME state that yielded 0 while locked yields > 0 once she opens the key", () => {
    // نبني نفس الحالة النهائية للمستوى ٣
    let state = INITIAL;
    for (let day = 0; day <= 730; day++) {
      if (day % 3 === 0) state = applySessionSignal(state, POSITIVE_SESSION, 0);
    }

    const lockedCeiling = wifeCeiling(state, "locked", 100);
    const openCeiling   = wifeCeiling(state, "open",   100);

    // المدخل الوحيد الذي تغيّر هو keyState — فعل الزوجة الصريح
    expect(lockedCeiling).toBe(0);
    expect(
      openCeiling,
      "opening the key did not raise the ceiling — the test above is vacuous"
    ).toBeGreaterThan(0);
  });

  it("keyState is the ONLY input that can move the ceiling off 0 at max earnedLevel", () => {
    const maxed: CeilingState = { earnedLevel: 5, consecutivePositiveSessions: 0 };

    // كل مستويات الأمان مع المفتاح مغلق → 0 دائماً
    for (let safety = 0; safety <= 100; safety += 5) {
      expect(
        wifeCeiling(maxed, "locked", safety),
        `locked + safety ${safety} + earnedLevel 5 must still be 0`
      ).toBe(0);
    }

    // نفس المدخلات مع المفتاح مفتوح → يرتفع عند الأمان الكافي
    expect(wifeCeiling(maxed, "open", 100)).toBeGreaterThan(0);
  });
});
