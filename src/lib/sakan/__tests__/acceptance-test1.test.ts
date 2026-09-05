/**
 * اختبار القبول ١ (SPEC §8.1)
 *
 *   "لا بطاقة `intensity > 0` تُعرض لأي طرف بينما `KeyState === 'locked'`."
 *
 * ─── المنهج: مسح شامل لفضاء المدخلات، لا حالة مفردة ──────────────────────────
 * لا يكفي أن نتحقق من أن computeCeiling تُعيد 0 في حالة واحدة، ولا أن
 * selectCard تحترم السقف في حالة واحدة. الاختبار هنا يمسح فضاء المدخلات
 * بالكامل عند الزوجة وهي في وضع locked:
 *
 *   earnedLevel : 0 … 5              (٦ قيم — كل المستويات المكتسبة الممكنة)
 *   safety      : 0 … 100 خطوة 5     (٢١ قيمة)
 *   flags       : ٤ تشكيلات
 *   learning    : عادي / سكون
 *   shownCards  : فارغ / كل البطاقات معروضة (يُفعِّل مسار إعادة التشغيل)
 *
 * = ٢٠١٦ تركيبة. في كل واحدة **تُعدَّد كل البطاقات الوصولة** لا البطاقة
 * الأولى فقط، ويجب أن تكون كل واحدة منها intensity === 0. لا استثناء.
 *
 * ─── لماذا التعداد الكامل وليس البطاقة المُعادة ──────────────────────────────
 * selectCard تُعيد أعلى بطاقة في الترتيب. لو تسرّبت بطاقة intensity > 0 إلى
 * قائمة المؤهَّلات لكنها لم تتصدّر الترتيب، لمرّ فحصُ البطاقة الأولى بينما
 * الخرق قائم. لذلك يُستنزَف مجموع البطاقات الوصولة عبر تراكم shownCardIds
 * حتى لا تبقى بطاقة جديدة، ويُفحص كل عنصر فيه.
 *
 * ─── لماذا مسار إعادة التشغيل مهم ────────────────────────────────────────────
 * selectCard تعود إلى القائمة الكاملة (`eligible`) إن نفدت البطاقات غير
 * المعروضة. هذا المسار هو أخطر مكان يمكن أن يتسرّب منه تجاوزٌ للسقف،
 * لذا يُمسح صراحةً.
 *
 * ─── ما يُفشل الاختبار ───────────────────────────────────────────────────────
 *   - computeCeiling تُعيد قيمة > 0 عند locked لأي تركيبة.
 *   - selectCard / selectCardWithLearning تُرجع بطاقة intensity > 0 عند locked.
 *   - أي مسار في الترشيح يتخطّى شرط `card.intensity > ceiling`.
 *
 * ─── نطاق هذا الاختبار ───────────────────────────────────────────────────────
 * KeyState موجود على جهاز الزوجة وحده (SPEC §3.3: "جهاز الزوج لا يملك هذا
 * الحقل إطلاقاً"). لذلك المسح هنا يغطّي الطرف الذي يملك الشرط فعلياً.
 * حالة مسار الزوج موثّقة في التقرير المرفوع للمستخدم كتعارض بين §8.1 و§3.3
 * ينتظر قراره — لم تُضَف أي بنية جديدة لسدّه.
 */

import { describe, it, expect } from "vitest";
import { computeCeiling, selectCard, selectCardWithLearning } from "@/lib/sakan/engine";
import { ALL_CARDS } from "@/lib/sakan/cards";
import type { LearningState, Card, CardIntensity, SakanRole } from "@/types/sakan";

// ─── ثوابت ────────────────────────────────────────────────────────────────────

const NOW            = "2025-06-15T12:00:00Z";
const DAYS_22_BEFORE = "2025-05-24T12:00:00Z"; // ← يُدخل وضع السكون

const NORMAL_LEARNING: LearningState = {
  skipsByCard:     {},
  familyBoosts:    [],
  metricsMovedAt:  NOW,
  lastCardShownAt: null,
};

const DORMANT_LEARNING: LearningState = {
  ...NORMAL_LEARNING,
  metricsMovedAt: DAYS_22_BEFORE,
};

// ─── فضاء المدخلات ────────────────────────────────────────────────────────────

const EARNED_LEVELS = [0, 1, 2, 3, 4, 5];
const SAFETY_VALUES = Array.from({ length: 21 }, (_, i) => i * 5); // 0,5,…,100
const FLAG_SETS: string[][] = [
  [],
  ["after_anger_event"],
  ["pain_reported"],
  ["pain_reported", "after_anger_event"],
];
const LEARNING_STATES: Array<[string, LearningState]> = [
  ["normal",  NORMAL_LEARNING],
  ["dormant", DORMANT_LEARNING],
];
/** فارغ، ثم كل البطاقات معروضة — الثاني يُفعِّل مسار إعادة التشغيل. */
const SHOWN_SETS: Array<[string, Set<string>]> = [
  ["none-shown", new Set<string>()],
  ["all-shown",  new Set<string>(ALL_CARDS.map((c) => c.id))],
];

const WIFE_CARD_COUNT = ALL_CARDS.filter((c) => c.audience === "wife").length;


// ─── كتالوج اصطناعي: بطاقات زوجة بكل شدّة ────────────────────────────────────

/**
 * الكتالوج الحقيقي يحوي بطاقة زوجة واحدة بشدّة 1 و٥ بشدّة 0، والترتيب
 * لا يُصعِّدها. هذا الكتالوج يضمن وجود مرشَّح بكل شدّة 0…5 حتى لا يمرّ
 * أي تسرّب في السقف بسبب الترتيب وحده.
 */
const SYNTHETIC_WIFE_CARDS: Card[] = ([0, 1, 2, 3, 4, 5] as CardIntensity[]).map(
  (intensity) => ({
    id: `TEST-AT1-W-${intensity}`,
    audience: "wife" as const,
    kind: "concept" as const,
    addresses: ["trust" as const],
    intensity,
    duration_sec: 60,
    body: `بطاقة زوجة اصطناعية — شدّة ${intensity}`,
  })
);

/**
 * الكتالوج الحقيقي لا يحوي بطاقة زوج واحدة بشدّة > 0 (كلها 0). لذلك المسح
 * على الكتالوج الحقيقي وحده صحيح بالمصادفة ولا يُثبت شيئاً عن السقف.
 * هذا الكتالوج يضمن وجود مرشَّح زوج بكل شدّة 0…5.
 */
const SYNTHETIC_HUSBAND_CARDS: Card[] = ([0, 1, 2, 3, 4, 5] as CardIntensity[]).map(
  (intensity) => ({
    id: `TEST-AT1-H-${intensity}`,
    audience: "husband" as const,
    kind: "concept" as const,
    addresses: ["shame" as const],
    intensity,
    duration_sec: 60,
    body: `بطاقة زوج اصطناعية — شدّة ${intensity}`,
  })
);

// ─── تعداد كل البطاقات الوصولة ───────────────────────────────────────────────

/**
 * يستنزف مجموع البطاقات التي يمكن أن تُعرض تحت سقف معيّن.
 * يستدعي دالة الاختيار مراراً، ويُراكم ما عاد في shownCardIds، ويتوقّف
 * حين تتكرّر بطاقة أو تعود null — أي حين تُستنفَد البطاقات الجديدة.
 */
function collectReachable(
  cards: Card[],
  ceiling: number,
  safety: number,
  flags: string[],
  learning?: LearningState,
  role: SakanRole = "wife"
): Card[] {
  const seen  = new Set<string>();
  const found: Card[] = [];

  for (let i = 0; i < cards.length + 1; i++) {
    const params = {
      role,
      ceiling,
      cards,
      safety,
      flags,
      shownCardIds: new Set(seen),
      lastCardId: undefined,
    };

    const card = learning
      ? selectCardWithLearning(params, learning, NOW)
      : selectCard(params);

    if (card === null) break;      // لا مزيد
    if (seen.has(card.id)) break;  // بدأت إعادة التشغيل — استُنفدت الجديدة

    seen.add(card.id);
    found.push(card);
  }

  return found;
}

// ═══════════════════════════════════════════════════════════════════════════════
// المستوى الأول — السقف نفسه
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #1 (§8.1 L1) — ceiling is 0 for EVERY input while locked", () => {
  it("computeCeiling returns exactly 0 across the full wife input space when locked", () => {
    for (const earnedLevel of EARNED_LEVELS) {
      for (const safety of SAFETY_VALUES) {
        const ceiling = computeCeiling({
          role: "wife",
          keyState: "locked",
          safety,
          earnedLevel,
        });

        expect(
          ceiling,
          `computeCeiling must be 0 while locked, but got ${ceiling} ` +
            `for { earnedLevel: ${earnedLevel}, safety: ${safety} }`
        ).toBe(0);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// المستوى الثاني — البطاقة المختارة فعلياً
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #1 (§8.1 L2) — no intensity > 0 card is ever REACHABLE while locked", () => {
  it("guard: the real catalogue actually contains wife cards to select from", () => {
    // حارس ضد مسح فارغ — لو صار الكتالوج فارغاً لمرّ الاختبار بلا معنى
    expect(WIFE_CARD_COUNT).toBeGreaterThan(0);
  });

  it("guard: the synthetic catalogue really offers a candidate at every intensity 0…5", () => {
    // لولا هذا الحارس لكان مسح الكتالوج الاصطناعي صحيحاً بالمصادفة
    const intensities = SYNTHETIC_WIFE_CARDS.map((c) => c.intensity).sort();
    expect(intensities).toEqual([0, 1, 2, 3, 4, 5]);

    // وبسقف مرتفع تُصبح البطاقات عالية الشدّة وصولةً فعلاً
    const reachableAtCeiling5 = collectReachable(SYNTHETIC_WIFE_CARDS, 5, 100, []);
    expect(reachableAtCeiling5.some((c) => c.intensity > 0)).toBe(true);
  });

  it("selectCard: every reachable card has intensity 0, across both catalogues", () => {
    let combinations = 0;

    for (const [catalogueLabel, catalogue] of [
      ["real", ALL_CARDS],
      ["synthetic", SYNTHETIC_WIFE_CARDS],
    ] as Array<[string, Card[]]>) {
      for (const earnedLevel of EARNED_LEVELS) {
        for (const safety of SAFETY_VALUES) {
          // السقف يُحسب من نفس الدالة التي يستخدمها التطبيق — لا قيمة مُملاة
          const ceiling = computeCeiling({
            role: "wife",
            keyState: "locked",
            safety,
            earnedLevel,
          });

          for (const flags of FLAG_SETS) {
            combinations++;

            for (const card of collectReachable(catalogue, ceiling, safety, flags)) {
              expect(
                card.intensity,
                `card "${card.id}" (intensity ${card.intensity}) is reachable ` +
                  `while KeyState = 'locked' — catalogue: ${catalogueLabel}, ` +
                  `earnedLevel: ${earnedLevel}, safety: ${safety}, ` +
                  `flags: [${flags.join(",")}]`
              ).toBe(0);
            }
          }
        }
      }
    }

    // حارس ضد حلقة لم تدر
    expect(combinations).toBe(
      2 * EARNED_LEVELS.length * SAFETY_VALUES.length * FLAG_SETS.length
    );
  });

  it("selectCardWithLearning: every reachable card has intensity 0 (normal + dormant)", () => {
    let combinations = 0;

    for (const [catalogueLabel, catalogue] of [
      ["real", ALL_CARDS],
      ["synthetic", SYNTHETIC_WIFE_CARDS],
    ] as Array<[string, Card[]]>) {
      for (const earnedLevel of EARNED_LEVELS) {
        for (const safety of SAFETY_VALUES) {
          const ceiling = computeCeiling({
            role: "wife",
            keyState: "locked",
            safety,
            earnedLevel,
          });

          for (const flags of FLAG_SETS) {
            for (const [learningLabel, learning] of LEARNING_STATES) {
              combinations++;

              for (const card of collectReachable(
                catalogue, ceiling, safety, flags, learning
              )) {
                expect(
                  card.intensity,
                  `card "${card.id}" (intensity ${card.intensity}) is reachable ` +
                    `while KeyState = 'locked' — catalogue: ${catalogueLabel}, ` +
                    `earnedLevel: ${earnedLevel}, safety: ${safety}, ` +
                    `flags: [${flags.join(",")}], learning: ${learningLabel}`
                ).toBe(0);
              }
            }
          }
        }
      }
    }

    expect(combinations).toBe(
      2 *
        EARNED_LEVELS.length *
        SAFETY_VALUES.length *
        FLAG_SETS.length *
        LEARNING_STATES.length
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// المستوى الثالث — مسار الزوج
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SPEC §4.1 (بعد تصحيح المواصفة):
 *
 *   "سقف الزوج مقفول عند 0 دائماً. لا يرتفع بحال: لا بـ earnedCeilingLevel،
 *    ولا بجلسات إيجابية، ولا بمرور الوقت، ولا بحالة المفتاح. مساره كله
 *    intensity: 0 — مهارات ومعلومات، بلا أي محتوى اقتراب."
 *
 * هذا يُغلق التعارض الذي كان قائماً بين §8.1 ("لأي طرف") و§3.3 ("جهاز الزوج
 * لا يملك حقل KeyState إطلاقاً"): السقف عند الزوج ثابت بحكم **دوره** لا بحكم
 * المفتاح، فلا يبقى شيء في مساره يُستدل منه على حالة المفتاح.
 *
 * المسح هنا لا يمرّ عبر keyState إطلاقاً — لا وجود له في سياق الزوج.
 * الشرط أقوى: لا بطاقة intensity > 0 وصولة للزوج في **أي** حالة.
 */
describe("Acceptance test #1 (§4.1 L3) — husband ceiling is 0 for EVERY input, always", () => {
  it("computeCeiling returns exactly 0 for the husband across the full input space", () => {
    for (const earnedLevel of EARNED_LEVELS) {
      for (const shame of SAFETY_VALUES) {
        const ceiling = computeCeiling({ role: "husband", shame, earnedLevel });

        expect(
          ceiling,
          `husband ceiling must be 0 always, but got ${ceiling} ` +
            `for { earnedLevel: ${earnedLevel}, shame: ${shame} }`
        ).toBe(0);
      }
    }
  });

  it("guard: the synthetic husband catalogue really offers a candidate at every intensity", () => {
    const intensities = SYNTHETIC_HUSBAND_CARDS.map((c) => c.intensity).sort();
    expect(intensities).toEqual([0, 1, 2, 3, 4, 5]);

    // لو رُفع السقف يدوياً لأصبحت البطاقات عالية الشدّة وصولة — يمنع الصحّة بالمصادفة
    const reachableAtCeiling5 = collectReachable(
      SYNTHETIC_HUSBAND_CARDS, 5, 0, [], undefined, "husband"
    );
    expect(reachableAtCeiling5.some((c) => c.intensity > 0)).toBe(true);
  });

  it("every card reachable by the husband has intensity 0, across both catalogues", () => {
    let combinations = 0;

    for (const [catalogueLabel, catalogue] of [
      ["real", ALL_CARDS],
      ["synthetic", SYNTHETIC_HUSBAND_CARDS],
    ] as Array<[string, Card[]]>) {
      for (const earnedLevel of EARNED_LEVELS) {
        for (const shame of SAFETY_VALUES) {
          // السقف يُحسب من نفس الدالة التي يستخدمها التطبيق — لا قيمة مُملاة
          const ceiling = computeCeiling({ role: "husband", shame, earnedLevel });

          for (const flags of FLAG_SETS) {
            for (const [learningLabel, learning] of LEARNING_STATES) {
              combinations++;

              for (const card of collectReachable(
                catalogue, ceiling, shame, flags, learning, "husband"
              )) {
                expect(
                  card.intensity,
                  `card "${card.id}" (intensity ${card.intensity}) is reachable ` +
                    `by the husband — catalogue: ${catalogueLabel}, ` +
                    `earnedCeilingLevel: ${earnedLevel}, shame: ${shame}, ` +
                    `flags: [${flags.join(",")}], learning: ${learningLabel}`
                ).toBe(0);
              }
            }
          }
        }
      }
    }

    expect(combinations).toBe(
      2 *
        EARNED_LEVELS.length *
        SAFETY_VALUES.length *
        FLAG_SETS.length *
        LEARNING_STATES.length
    );
  });
});
