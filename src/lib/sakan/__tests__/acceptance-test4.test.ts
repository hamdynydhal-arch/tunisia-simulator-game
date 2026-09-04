/**
 * اختبار القبول ٤ — تجاوز البطاقة أو الخروج لا يُنتج عنصر واجهة جديد
 *
 * SPEC: "تجاوز البطاقة أو الخروج لا يُنتج أي عنصر واجهة جديد ولا أي نص"
 *
 * ─── ما يُتحقَّق منه ──────────────────────────────────────────────────────────
 * ١. المسح المصدري: لا نص تغذية راجعة عن التجاوز في واجهتي الزوج/الزوجة
 * ٢. اختبار العرض: الصفحة بعد التجاوز (step="done", card موجودة)
 *    مطابقة حرفياً لصفحة "لا بطاقة" (step="done", card=null)
 *    ← يفشل لو أضاف أحد عنصراً مشروطاً بـ card !== null && step === "done"
 *
 * ─── كيف يفشل الاختبار عند الخرق ──────────────────────────────────────────────
 * الخرق النموذجي:
 *   {step === "done" && card !== null && <p>تجاوزتَ هذه البطاقة</p>}
 * هذا يُنتج HTML مختلفاً بين حالة "تجاوز" وحالة "لا بطاقة" → يفشل الاختبار #٢.
 * وكذلك: نمط "تجاوز" في النص الظاهر → يفشل الاختبار #١.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ─── المسارات ────────────────────────────────────────────────────────────────

const HUSBAND_VIEW_PATH = resolve(__dirname, "../../../components/sakan/HusbandDailyView.tsx");
const WIFE_VIEW_PATH    = resolve(__dirname, "../../../components/sakan/WifeDailyView.tsx");

// ─── الأنماط المحظورة (تغذية راجعة مرئية عن التجاوز) ────────────────────────

/**
 * كلمات لا يجوز أن تظهر في HTML المُوَلَّد كرد فعل على التجاوز.
 * هذه الأنماط تُفحَص في المصدر (ليس في HTML) — أي نص داخل JSX.
 */
const SKIP_FEEDBACK_VISIBLE: Array<{ regex: RegExp; label: string }> = [
  { regex: /تجاوزتَ|تجاوزتِ|تم التجاوز|تخطيت|تخطيتِ/, label: "Arabic skip-feedback text" },
  { regex: /skipFeedback|SkipFeedback|skip_feedback/, label: "skip feedback identifier" },
  { regex: /wasSkipped|was_skipped|skipDone|skip_done/,  label: "post-skip state label" },
];

// ─── ١. مسح المصدر ───────────────────────────────────────────────────────────

describe("Acceptance test #4 (Level 1) — no skip feedback in source", () => {
  const sources: Array<{ label: string; src: string }> = [
    { label: "HusbandDailyView", src: readFileSync(HUSBAND_VIEW_PATH, "utf-8") },
    { label: "WifeDailyView",    src: readFileSync(WIFE_VIEW_PATH,    "utf-8") },
  ];

  for (const { label, src } of sources) {
    for (const { regex, label: patLabel } of SKIP_FEEDBACK_VISIBLE) {
      it(`${label}: no "${patLabel}" in source`, () => {
        expect(regex.test(src)).toBe(false);
      });
    }
  }
});

// ─── ٢. اختبار العرض — التجاوز لا يُنتج عنصراً جديداً ──────────────────────

/**
 * تعريف بيانات وهمية مطلوبة للعرض.
 * لا IndexedDB — useEffect لا يعمل في renderToStaticMarkup.
 */
const MOCK_CARD = {
  id: "H-01",
  audience: "husband" as const,
  kind: "concept" as const,
  addresses: ["shame" as const],
  intensity: 0 as const,
  duration_sec: 60,
  body: "نص تجريبي",
};

const MOCK_HUSBAND_STATE = {
  shame: 50,
  earnedCeilingLevel: 0,
  consecutivePositiveSessions: 0,
  updatedAt: "2024-01-01T00:00:00Z",
};

const MOCK_WIFE_STATE = {
  safety: 70,
  trust: 60,
  earnedCeilingLevel: 0,
  consecutivePositiveSessions: 0,
  updatedAt: "2024-01-01T00:00:00Z",
};

const NOOP = () => {};

describe("Acceptance test #4 (Level 2) — post-skip render is byte-identical to no-card render", () => {
  it("HusbandDailyView: step=done + card=MOCK produces same HTML as step=done + card=null", async () => {
    // Lazy import to avoid top-level error when file is missing during TDD red phase
    const mod = await import("@/components/sakan/HusbandDailyView");
    const HusbandDailyView = mod.default;

    const baseProps = {
      step: "done" as const,
      moodSelected: null,
      passphrase: "test-passphrase",
      husbandState: MOCK_HUSBAND_STATE,
      onSkip: NOOP,
      onMoodTap: NOOP,
      onCardDone: NOOP,
      onExerciseDone: NOOP,
      onRatingSelected: NOOP,
    };

    // State post-skip: step="done", card is present (but hidden)
    const htmlPostSkip = renderToStaticMarkup(
      createElement(HusbandDailyView, { ...baseProps, card: MOCK_CARD })
    );

    // State no-card: step="done", card is null (no card was ever selected)
    const htmlNoCard = renderToStaticMarkup(
      createElement(HusbandDailyView, { ...baseProps, card: null })
    );

    // Must be byte-identical: skip must not produce any new UI element
    expect(htmlPostSkip).toBe(htmlNoCard);
  });

  it("WifeDailyView: step=done + card=MOCK produces same HTML as step=done + card=null", async () => {
    const mod = await import("@/components/sakan/WifeDailyView");
    const WifeDailyView = mod.default;

    const MOCK_WIFE_CARD = { ...MOCK_CARD, audience: "wife" as const, id: "W-01" };

    const baseProps = {
      step: "done" as const,
      moodSelected: null,
      passphrase: "test-passphrase",
      wifeState: MOCK_WIFE_STATE,
      onSkip: NOOP,
      onMoodTap: NOOP,
      onCardDone: NOOP,
      onExerciseDone: NOOP,
      onRatingSelected: NOOP,
    };

    const htmlPostSkip = renderToStaticMarkup(
      createElement(WifeDailyView, { ...baseProps, card: MOCK_WIFE_CARD })
    );

    const htmlNoCard = renderToStaticMarkup(
      createElement(WifeDailyView, { ...baseProps, card: null })
    );

    expect(htmlPostSkip).toBe(htmlNoCard);
  });
});
