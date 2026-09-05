/**
 * اختبار القبول ١١ — صمت وضع السكون والتهميش بصرياً
 *
 * SPEC §4.3 + §4.4: "لا نص ولا إشارة تدل على أن شيئاً تغيّر"
 *
 * ─── ما يُختبر ────────────────────────────────────────────────────────────────
 * AT10 يُغطي الدوال النقية في engine.ts.
 * AT11 يُغطي الناتج المرئي لصفحتَي الزوج والزوجة:
 *   أن learningState — بكل حالاته (سكون / تهميش / طبيعي) — لا تُنتج
 *   أي فرق في HTML المُسلَّم للمستخدم، مهما كانت صيغة الأثر البصري
 *   (نص / شارة / لون / ترتيب).
 *
 * ─── المنهج: تطابق كامل بدلاً من قائمة كلمات ─────────────────────────────────
 * يُصيَّر مكوّن الصفحة مرتين:
 *   - مرة مع learningState عادي.
 *   - مرة مع learningState في وضع السكون / تهميش.
 * البطاقة المعروضة ثابتة في الحالتين.
 * HTML المُسلسَل يجب أن يتطابق حرفاً بحرف.
 * أي نص أو عنصر إضافي — مهما صيغ — يُنتج HTML مختلفاً → يفشل الاختبار.
 *
 * ─── ما يُفشل الاختبار ───────────────────────────────────────────────────────
 * أي إضافة إلى HusbandDailyContent أو WifeDailyContent مشروطة بـ learningState:
 *   {isDormant && <p>...</p>}
 *   {deprioritized && <span className="badge">...</span>}
 *   <Indicator color={dormant ? "red" : "green"} />
 *   // أي صيغة أخرى
 */

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LearningState, Card, HusbandState, WifeState } from "@/types/sakan";

// ─── ثوابت الاختبار ───────────────────────────────────────────────────────────

const NOW             = "2025-06-15T12:00:00Z";
const DAYS_22_BEFORE  = "2025-05-24T12:00:00Z"; // 22 يوماً قبل → سكون
const DAYS_61_FORWARD = "2025-08-15T12:00:00Z"; // انتهاء التهميش

// ─── بطاقات ثابتة ─────────────────────────────────────────────────────────────

const FIXED_HUSBAND_CARD: Card = {
  id: "TEST-AT11-H",
  audience: "husband",
  kind: "concept",
  addresses: ["shame"],
  intensity: 0,
  duration_sec: 60,
  body: "بطاقة الزوج الثابتة للاختبار",
};

const FIXED_WIFE_CARD: Card = {
  id: "TEST-AT11-W",
  audience: "wife",
  kind: "concept",
  addresses: ["trust"],
  intensity: 0,
  duration_sec: 60,
  body: "بطاقة الزوجة الثابتة للاختبار",
};

// ─── حالات الجهاز ─────────────────────────────────────────────────────────────

const MOCK_HUSBAND_STATE: HusbandState = {
  shame: 50,
  earnedCeilingLevel: 0,
  consecutivePositiveSessions: 0,
  updatedAt: NOW,
};

const MOCK_WIFE_STATE: WifeState = {
  safety: 70,
  trust: 60,
  earnedCeilingLevel: 0,
  consecutivePositiveSessions: 0,
  updatedAt: NOW,
};

// ─── حالات التعلّم ────────────────────────────────────────────────────────────

const NORMAL_LEARNING: LearningState = {
  skipsByCard:      {},
  familyBoosts:     [],
  metricsMovedAt:   NOW,
  lastCardShownAt:  null,
};

/** وضع السكون — 22 يوماً بلا حركة في المقاييس. */
const DORMANT_LEARNING: LearningState = {
  ...NORMAL_LEARNING,
  metricsMovedAt: DAYS_22_BEFORE,
};

/** بطاقة الزوج تُجوِّزت مرتين → مُهمَّشة. */
const DEPRIOTIZED_HUSBAND_LEARNING: LearningState = {
  ...NORMAL_LEARNING,
  skipsByCard: {
    [FIXED_HUSBAND_CARD.id]: { count: 2, deprioritizedUntil: DAYS_61_FORWARD },
  },
};

/** بطاقة الزوجة تُجوِّزت مرتين → مُهمَّشة. */
const DEPRIOTIZED_WIFE_LEARNING: LearningState = {
  ...NORMAL_LEARNING,
  skipsByCard: {
    [FIXED_WIFE_CARD.id]: { count: 2, deprioritizedUntil: DAYS_61_FORWARD },
  },
};

// ─── dummies ──────────────────────────────────────────────────────────────────

const NOOP        = () => {};
const NOOP_RATING = (_r: 1 | 2 | 3 | 4 | 5) => {};

// ═══════════════════════════════════════════════════════════════════════════════
// الزوج — المستوى الأول: وضع السكون
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #11 (§4.4 L1) — dormancy is visually silent: husband page", () => {
  it("HTML is byte-identical: normal learning vs dormant learning (same fixed card)", async () => {
    // lazy import — يفشل هنا إن لم يُصدَّر HusbandDailyContent بعد
    const { HusbandDailyContent } = await import("@/app/sakan/husband-daily/page");

    const base = {
      card:              FIXED_HUSBAND_CARD,
      step:              "card" as const,
      moodSelected:      null,
      passphrase:        "test-passphrase",
      husbandState:      MOCK_HUSBAND_STATE,
      onSkip:            NOOP,
      onMoodTap:         NOOP,
      onCardDone:        NOOP,
      onExerciseDone:    NOOP,
      onRatingSelected:  NOOP_RATING,
    };

    const htmlNormal  = renderToStaticMarkup(
      createElement(HusbandDailyContent, { ...base, learningState: NORMAL_LEARNING })
    );
    const htmlDormant = renderToStaticMarkup(
      createElement(HusbandDailyContent, { ...base, learningState: DORMANT_LEARNING })
    );

    // الفرق الوحيد بين الحالتين هو learningState.metricsMovedAt.
    // إن ظهر أي نص أو عنصر مشروط به → HTML مختلف → اختبار يفشل.
    expect(htmlNormal).toBe(htmlDormant);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// الزوج — المستوى الثاني: تهميش البطاقة
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #11 (§4.3 L2) — deprioritization is visually silent: husband page", () => {
  it("HTML is byte-identical: no skips vs card deprioritized after 2 skips (same fixed card)", async () => {
    const { HusbandDailyContent } = await import("@/app/sakan/husband-daily/page");

    const base = {
      card:              FIXED_HUSBAND_CARD,
      step:              "card" as const,
      moodSelected:      null,
      passphrase:        "test-passphrase",
      husbandState:      MOCK_HUSBAND_STATE,
      onSkip:            NOOP,
      onMoodTap:         NOOP,
      onCardDone:        NOOP,
      onExerciseDone:    NOOP,
      onRatingSelected:  NOOP_RATING,
    };

    const htmlNormal       = renderToStaticMarkup(
      createElement(HusbandDailyContent, { ...base, learningState: NORMAL_LEARNING })
    );
    const htmlDeprioritized = renderToStaticMarkup(
      createElement(HusbandDailyContent, { ...base, learningState: DEPRIOTIZED_HUSBAND_LEARNING })
    );

    expect(htmlNormal).toBe(htmlDeprioritized);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// الزوجة — المستوى الثالث (أ): وضع السكون
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #11 (§4.4 L3a) — dormancy is visually silent: wife page", () => {
  it("HTML is byte-identical: normal learning vs dormant learning (same fixed card)", async () => {
    const { WifeDailyContent } = await import("@/app/sakan/wife-daily/page");

    const base = {
      card:              FIXED_WIFE_CARD,
      step:              "card" as const,
      moodSelected:      null,
      passphrase:        "test-passphrase",
      wifeState:         MOCK_WIFE_STATE,
      onSkip:            NOOP,
      onMoodTap:         NOOP,
      onCardDone:        NOOP,
      onExerciseDone:    NOOP,
      onRatingSelected:  NOOP_RATING,
    };

    const htmlNormal  = renderToStaticMarkup(
      createElement(WifeDailyContent, { ...base, learningState: NORMAL_LEARNING })
    );
    const htmlDormant = renderToStaticMarkup(
      createElement(WifeDailyContent, { ...base, learningState: DORMANT_LEARNING })
    );

    expect(htmlNormal).toBe(htmlDormant);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// الزوجة — المستوى الثالث (ب): تهميش البطاقة
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #11 (§4.3 L3b) — deprioritization is visually silent: wife page", () => {
  it("HTML is byte-identical: no skips vs card deprioritized after 2 skips (same fixed card)", async () => {
    const { WifeDailyContent } = await import("@/app/sakan/wife-daily/page");

    const base = {
      card:              FIXED_WIFE_CARD,
      step:              "card" as const,
      moodSelected:      null,
      passphrase:        "test-passphrase",
      wifeState:         MOCK_WIFE_STATE,
      onSkip:            NOOP,
      onMoodTap:         NOOP,
      onCardDone:        NOOP,
      onExerciseDone:    NOOP,
      onRatingSelected:  NOOP_RATING,
    };

    const htmlNormal       = renderToStaticMarkup(
      createElement(WifeDailyContent, { ...base, learningState: NORMAL_LEARNING })
    );
    const htmlDeprioritized = renderToStaticMarkup(
      createElement(WifeDailyContent, { ...base, learningState: DEPRIOTIZED_WIFE_LEARNING })
    );

    expect(htmlNormal).toBe(htmlDeprioritized);
  });
});
