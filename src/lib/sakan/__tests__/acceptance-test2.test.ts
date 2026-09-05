/**
 * اختبار القبول ٢ (SPEC §8.2)
 *
 *   "شجرة عرض واجهة الزوج **متطابقة بايت-ببايت** في الحالتين `locked` و`open`
 *    عند تثبيت باقي المدخلات."
 *
 * ويقابله في §1 القاعدة ٢: "الزوج لا يعلم بوجود المفتاح. شجرة العرض في واجهته
 * متطابقة سواء كان المفتاح مفتوحاً أو مغلقاً. لا قفل، لا تظليل، لا عنصر رمادي،
 * لا مساحة فارغة محجوزة."
 *
 * ─── لماذا لا يكفي المسح النصّي للمصدر ───────────────────────────────────────
 * keystate-isolation.test.ts يمسح ملفات الزوج بحثاً عن readKeyState وعن
 * السلسلة 'KeyState'. ذلك يمنع التسريب **المباشر** فقط، ولا يثبت التطابق
 * بايت-ببايت الذي تطلبه المواصفة: تسريب عبر وسيط، أو عبر استيراد ثانوي،
 * أو عبر مكوّن مشترك يقرأ المفتاح، يمرّ من المسح النصّي.
 *
 * ─── المنهج: تحميل الوحدة مرّتين تحت حالتَي مفتاح مختلفتين ───────────────────
 * الوحدة الوحيدة التي تملك المفتاح هي AmbientSerenityKey (مكوّن الزوجة).
 * نُبدِّلها بنسخة وهمية تُعيد 'locked' في التحميل الأول و'open' في الثاني،
 * ومكوّنها الافتراضي يُصيِّر علامة تحمل الحالة نصّاً.
 *
 * ثم يُصيَّر HusbandDailyContent على **فضاء المدخلات كاملاً** في التحميلين،
 * ويُقارَن HTML الناتج حرفاً بحرف لكل تركيبة:
 *
 *   step         : card | rating | done          (٣)
 *   card         : null + بطاقة لكل شدّة 0…5      (٧)
 *   moodSelected : null | "calm"                  (٢)
 *   husbandState : earnedLevel 0…5 × shame 0/50/100 (١٨)
 *
 * = ٧٥٦ تركيبة × تحميلين. أي اختلاف في أي بايت يُفشل الاختبار.
 *
 * ─── ما يُفشل الاختبار ───────────────────────────────────────────────────────
 *   - أي مسار في شجرة الزوج يستورد readKeyState أو AmbientSerenityKey.
 *   - أي عنصر مشروط بحالة المفتاح: قفل، تظليل، عنصر رمادي، مساحة محجوزة.
 *   - أي فرق ولو في سمة واحدة أو مسافة واحدة.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Card, HusbandState, LearningState, CardIntensity } from "@/types/sakan";

// ─── ثوابت ────────────────────────────────────────────────────────────────────

const NOW = "2025-06-15T12:00:00Z";

const NORMAL_LEARNING: LearningState = {
  skipsByCard:     {},
  familyBoosts:    [],
  metricsMovedAt:  NOW,
  lastCardShownAt: null,
};

const NOOP        = () => {};
const NOOP_RATING = (_r: 1 | 2 | 3 | 4 | 5) => {};

// ─── فضاء المدخلات ────────────────────────────────────────────────────────────

const STEPS = ["card", "rating", "done"] as const;
const MOODS = [null, "calm"];

/** بطاقة لكل شدّة ممكنة — الشدّة هي المحور الذي يربطه المفتاح بالسقف. */
const CARDS: Array<Card | null> = [
  null,
  ...([0, 1, 2, 3, 4, 5] as CardIntensity[]).map((intensity) => ({
    id: `TEST-AT2-H-${intensity}`,
    audience: "husband" as const,
    kind: "concept" as const,
    addresses: ["shame" as const],
    intensity,
    duration_sec: 60,
    body: `بطاقة الزوج الثابتة — شدّة ${intensity}`,
  })),
];

const HUSBAND_STATES: HusbandState[] = [];
for (const earned of [0, 1, 2, 3, 4, 5]) {
  for (const shame of [0, 50, 100]) {
    HUSBAND_STATES.push({
      shame,
      earnedCeilingLevel: earned,
      consecutivePositiveSessions: 0,
      updatedAt: NOW,
    });
  }
}

const EXPECTED_COMBINATIONS =
  STEPS.length * CARDS.length * MOODS.length * HUSBAND_STATES.length;

// ─── تصيير فضاء المدخلات كاملاً تحت حالة مفتاح محدّدة ────────────────────────

/**
 * يُحمِّل وحدة صفحة الزوج من جديد بعد تثبيت حالة المفتاح في الوحدة الوهمية،
 * ثم يُصيِّر كل تركيبة ويُعيد قائمة HTML مرتّبة ترتيباً ثابتاً.
 */
async function renderAllUnderKeyState(keyState: "locked" | "open"): Promise<string[]> {
  vi.resetModules();

  // الوحدة الوحيدة التي تملك المفتاح — تُستبدل بنسخة تكشف الحالة لو قُرئت.
  vi.doMock("@/components/sakan/AmbientSerenityKey", () => ({
    __esModule: true,
    default: () =>
      createElement("div", { "data-key-state": keyState }, `KEY:${keyState}`),
    readKeyState: async () => keyState,
  }));

  const { HusbandDailyContent } = await import("@/app/sakan/husband-daily/page");

  const out: string[] = [];

  for (const step of STEPS) {
    for (const card of CARDS) {
      for (const moodSelected of MOODS) {
        for (const husbandState of HUSBAND_STATES) {
          out.push(
            renderToStaticMarkup(
              createElement(HusbandDailyContent, {
                card,
                step,
                moodSelected,
                passphrase: "test-passphrase",
                husbandState,
                learningState: NORMAL_LEARNING,
                onSkip: NOOP,
                onMoodTap: NOOP,
                onCardDone: NOOP,
                onExerciseDone: NOOP,
                onRatingSelected: NOOP_RATING,
              })
            )
          );
        }
      }
    }
  }

  return out;
}

/** وسم يصف تركيبة برقمها — لرسالة فشل تدلّ على الموضع بدقّة. */
function describeCombination(index: number): string {
  const perStep = CARDS.length * MOODS.length * HUSBAND_STATES.length;
  const perCard = MOODS.length * HUSBAND_STATES.length;
  const perMood = HUSBAND_STATES.length;

  const step = STEPS[Math.floor(index / perStep)];
  const card = CARDS[Math.floor((index % perStep) / perCard)];
  const mood = MOODS[Math.floor((index % perCard) / perMood)];
  const hs   = HUSBAND_STATES[index % perMood];

  return (
    `step=${step}, card=${card ? `${card.id}(i${card.intensity})` : "null"}, ` +
    `mood=${mood ?? "null"}, earnedLevel=${hs.earnedCeilingLevel}, shame=${hs.shame}`
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AT2 — تطابق بايت-ببايت
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #2 (§8.2) — husband render tree is byte-identical: locked vs open", () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(()  => { vi.doUnmock("@/components/sakan/AmbientSerenityKey"); vi.resetModules(); });

  it("renders the full husband input space under both key states, byte for byte", async () => {
    const lockedRenders = await renderAllUnderKeyState("locked");
    const openRenders   = await renderAllUnderKeyState("open");

    // حارس ضد مسح فارغ أو حلقة لم تدر
    expect(lockedRenders).toHaveLength(EXPECTED_COMBINATIONS);
    expect(openRenders).toHaveLength(EXPECTED_COMBINATIONS);
    expect(lockedRenders.every((h) => h.length > 0)).toBe(true);

    // مقارنة حرفية لكل تركيبة على حدة — الرسالة تدلّ على التركيبة الفاشلة
    for (let i = 0; i < lockedRenders.length; i++) {
      expect(
        lockedRenders[i],
        `husband render differs between locked and open at [${describeCombination(i)}]`
      ).toBe(openRenders[i]);
    }
  });

  it("no husband render leaks the key-state marker from the mocked wife-only module", async () => {
    const lockedRenders = await renderAllUnderKeyState("locked");

    const leaked = lockedRenders.filter(
      (html) => html.includes("KEY:") || html.includes("data-key-state")
    );

    expect(
      leaked.length,
      `${leaked.length} husband render(s) contain the wife-only key marker — ` +
        `the husband tree reached AmbientSerenityKey / readKeyState`
    ).toBe(0);
  });
});
