/**
 * اختبار القبول ١٠ — وضع السكون + حلقة التعلّم
 *
 * SPEC §4.3 (حلقة التعلّم) + §4.4 (وضع السكون)
 *
 * ─── ما يُختبر ────────────────────────────────────────────────────────────────
 * §4.4 — وضع السكون:
 *   • isDormant: صحيح بعد ≥21 يوماً بلا حركة في المقاييس
 *   • isDormant: خطأ قبل انتهاء الـ21 يوماً
 *   • shouldShowCardToday: في السكون، خطأ إن مضى أقل من 3 أيام على آخر بطاقة
 *   • shouldShowCardToday: في السكون، صحيح إن مضى ≥3 أيام أو لم تُعرض بطاقة بعد
 *   • selectCardWithLearning: في السكون، تُختار فقط بطاقات intensity=0
 *
 * §4.3 — حلقة التعلّم:
 *   • applyCardSkip: يُفعِّل التهميش (deprioritize) عند التجاوز مرتين
 *   • applyCardSkip: التهميش يمتد 60 يوماً
 *   • applyCardRating: تقييم ≥3 يُنشئ تعزيزاً للعائلة
 *   • applyCardRating: تقييم <3 لا يُنشئ تعزيزاً
 *   • selectCardWithLearning: البطاقات المُهمَّشة تنزل للحضيض
 *   • selectCardWithLearning: عائلات معزَّزة ترتفع في الأولوية
 *   • applyMetricChange: يُحدِّث metricsMovedAt
 *
 * ─── تواريخ ثابتة (لا دالة Date.now) ─────────────────────────────────────────
 * كل الاختبارات تستخدم NOW ثابتاً وتتحكم في التاريخ عبر معامل `now`.
 */

import { describe, it, expect } from "vitest";
import {
  isDormant,
  shouldShowCardToday,
  applyCardSkip,
  applyCardRating,
  applyMetricChange,
  selectCardWithLearning,
} from "@/lib/sakan/engine";
import type { LearningState, Card } from "@/types/sakan";

// ─── ثوابت الاختبار ───────────────────────────────────────────────────────────

/** التاريخ "الآن" المستخدم في كل الاختبارات — ثابت، لا يعتمد على ساعة الجهاز. */
const NOW = "2025-06-15T12:00:00Z";

/** 22 يوماً قبل NOW — يجب أن يُنتج isDormant=true */
const DAYS_22_BEFORE = "2025-05-24T12:00:00Z";

/** 21 يوماً قبل NOW تماماً — عتبة السكون (≥21 يوماً) */
const DAYS_21_BEFORE = "2025-05-25T12:00:00Z";

/** 20 يوماً قبل NOW — يجب أن يُنتج isDormant=false */
const DAYS_20_BEFORE = "2025-05-26T12:00:00Z";

/** 3 أيام قبل NOW — عتبة الإيقاع في السكون */
const DAYS_3_BEFORE = "2025-06-12T12:00:00Z";

/** يومان قبل NOW — ما زال في فترة الانتظار */
const DAYS_2_BEFORE = "2025-06-13T12:00:00Z";

/** 61 يوماً من NOW — ما بعد فترة التهميش */
const DAYS_61_FORWARD = "2025-08-15T12:00:00Z";

// ─── حالة التعلّم الافتراضية ─────────────────────────────────────────────────

const FRESH_LEARNING: LearningState = {
  skipsByCard: {},
  familyBoosts: [],
  metricsMovedAt: NOW,
  lastCardShownAt: null,
};

const DORMANT_LEARNING: LearningState = {
  ...FRESH_LEARNING,
  metricsMovedAt: DAYS_22_BEFORE,
};

// ─── بطاقات الاختبار ─────────────────────────────────────────────────────────

const CARD_INTENSITY_0: Card = {
  id: "TEST-H-00",
  audience: "husband",
  kind: "concept",
  addresses: ["shame"],
  intensity: 0,
  duration_sec: 60,
  body: "بطاقة intensity صفر",
};

const CARD_INTENSITY_2: Card = {
  id: "TEST-H-02",
  audience: "husband",
  kind: "concept",
  addresses: ["shame"],
  intensity: 2,
  duration_sec: 60,
  body: "بطاقة intensity 2",
};

const CARD_MICRO: Card = {
  id: "TEST-H-EX",
  audience: "husband",
  kind: "micro_exercise",
  addresses: ["anger"],
  intensity: 0,
  duration_sec: 60,
  body: "تمرين",
};

const ALL_TEST_CARDS = [CARD_INTENSITY_0, CARD_INTENSITY_2, CARD_MICRO];

const BASE_SELECT = {
  role: "husband" as const,
  ceiling: 5,
  cards: ALL_TEST_CARDS,
  flags: [] as string[],
  shownCardIds: new Set<string>(),
  lastCardId: undefined,
};

// ═══════════════════════════════════════════════════════════════════════════════
// §4.4 — وضع السكون
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #10 (§4.4) — isDormant", () => {
  it("returns true when metricsMovedAt is 22 days before now", () => {
    expect(isDormant(DAYS_22_BEFORE, NOW)).toBe(true);
  });

  it("returns true exactly at the 21-day threshold", () => {
    // DAYS_21_BEFORE = 21 يوماً قبل NOW تماماً — يجب isDormant=true
    expect(isDormant(DAYS_21_BEFORE, NOW)).toBe(true);
  });

  it("returns false when metricsMovedAt is 20 days before now", () => {
    expect(isDormant(DAYS_20_BEFORE, NOW)).toBe(false);
  });

  it("returns false when metricsMovedAt === now (fresh session)", () => {
    expect(isDormant(NOW, NOW)).toBe(false);
  });
});

describe("Acceptance test #10 (§4.4) — shouldShowCardToday", () => {
  it("always true when not in dormancy", () => {
    expect(shouldShowCardToday(false, DAYS_2_BEFORE, NOW)).toBe(true);
    expect(shouldShowCardToday(false, DAYS_3_BEFORE, NOW)).toBe(true);
    expect(shouldShowCardToday(false, null, NOW)).toBe(true);
  });

  it("true in dormancy when lastCardShownAt is null (never shown)", () => {
    expect(shouldShowCardToday(true, null, NOW)).toBe(true);
  });

  it("true in dormancy when ≥3 days since last card", () => {
    expect(shouldShowCardToday(true, DAYS_3_BEFORE, NOW)).toBe(true);
  });

  it("false in dormancy when <3 days since last card", () => {
    expect(shouldShowCardToday(true, DAYS_2_BEFORE, NOW)).toBe(false);
  });
});

describe("Acceptance test #10 (§4.4) — selectCardWithLearning in dormancy", () => {
  it("returns only intensity=0 cards when dormant", () => {
    const card = selectCardWithLearning(BASE_SELECT, DORMANT_LEARNING, NOW);
    expect(card).not.toBeNull();
    expect(card!.intensity).toBe(0);
  });

  it("never returns intensity>0 card in dormancy, even with ceiling=5", () => {
    // CARD_INTENSITY_2 لا يجب أن يُختار في وضع السكون
    const singleCard = {
      ...BASE_SELECT,
      cards: [CARD_INTENSITY_2], // فقط بطاقة intensity=2
    };
    const card = selectCardWithLearning(singleCard, DORMANT_LEARNING, NOW);
    expect(card).toBeNull(); // لا بطاقة مناسبة في السكون
  });

  it("returns null when no intensity=0 cards exist in dormancy", () => {
    const params = { ...BASE_SELECT, cards: [CARD_INTENSITY_2] };
    expect(selectCardWithLearning(params, DORMANT_LEARNING, NOW)).toBeNull();
  });

  it("returns cards normally (up to ceiling) when not dormant", () => {
    const card = selectCardWithLearning(BASE_SELECT, FRESH_LEARNING, NOW);
    expect(card).not.toBeNull();
    // في حالة طبيعية يمكن أن تُعاد أي بطاقة ضمن السقف
    expect(card!.intensity).toBeLessThanOrEqual(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §4.3 — حلقة التعلّم: التهميش (applyCardSkip)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #10 (§4.3) — applyCardSkip", () => {
  it("increments skip count on first skip", () => {
    const result = applyCardSkip(FRESH_LEARNING, "TEST-H-00", NOW);
    expect(result.skipsByCard["TEST-H-00"].count).toBe(1);
  });

  it("no deprioritization after only one skip", () => {
    const result = applyCardSkip(FRESH_LEARNING, "TEST-H-00", NOW);
    expect(result.skipsByCard["TEST-H-00"].deprioritizedUntil).toBeUndefined();
  });

  it("deprioritizes card after 2 skips", () => {
    const after1 = applyCardSkip(FRESH_LEARNING, "TEST-H-00", NOW);
    const after2 = applyCardSkip(after1, "TEST-H-00", NOW);
    expect(after2.skipsByCard["TEST-H-00"].count).toBe(2);
    expect(after2.skipsByCard["TEST-H-00"].deprioritizedUntil).toBeDefined();
  });

  it("deprioritization window is 60 days", () => {
    const after1 = applyCardSkip(FRESH_LEARNING, "TEST-H-00", NOW);
    const after2 = applyCardSkip(after1, "TEST-H-00", NOW);
    const until = after2.skipsByCard["TEST-H-00"].deprioritizedUntil!;
    // يجب أن يكون قبل DAYS_61_FORWARD (60 يوماً من NOW)
    expect(until < DAYS_61_FORWARD).toBe(true);
    // ويجب أن يكون بعد 59 يوماً من NOW تقريباً
    const days59Forward = "2025-08-13T12:00:00Z";
    expect(until > days59Forward).toBe(true);
  });

  it("does not affect other cards", () => {
    const result = applyCardSkip(FRESH_LEARNING, "TEST-H-00", NOW);
    expect(result.skipsByCard["TEST-H-02"]).toBeUndefined();
  });

  it("deprioritized card is pushed to bottom in selection", () => {
    // همِّش TEST-H-00 مرتين
    const after1 = applyCardSkip(FRESH_LEARNING, "TEST-H-00", NOW);
    const learningWithDeprio = applyCardSkip(after1, "TEST-H-00", NOW);

    // الآن الاختيار من بطاقتين: TEST-H-00 (مُهمَّشة) و TEST-H-02 (ceiling=5)
    const params = {
      ...BASE_SELECT,
      cards: [CARD_INTENSITY_0, CARD_INTENSITY_2], // ceiling=5 يسمح بكلتيهما
    };
    const card = selectCardWithLearning(params, learningWithDeprio, NOW);
    // TEST-H-00 مُهمَّشة → يجب أن تُختار TEST-H-02 أولاً
    expect(card?.id).toBe("TEST-H-02");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §4.3 — حلقة التعلّم: تعزيز العائلة (applyCardRating)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #10 (§4.3) — applyCardRating", () => {
  it("rating ≥3 creates a family boost", () => {
    const result = applyCardRating(FRESH_LEARNING, CARD_INTENSITY_0, 3, NOW);
    expect(result.familyBoosts.length).toBe(1);
  });

  it("boost matches the rated card's kind and addresses", () => {
    const result = applyCardRating(FRESH_LEARNING, CARD_INTENSITY_0, 4, NOW);
    const boost = result.familyBoosts[0];
    expect(boost.kind).toBe(CARD_INTENSITY_0.kind);
    expect(boost.addresses).toEqual(CARD_INTENSITY_0.addresses);
  });

  it("rating <3 does not create any boost", () => {
    const result = applyCardRating(FRESH_LEARNING, CARD_INTENSITY_0, 2, NOW);
    expect(result.familyBoosts.length).toBe(0);
  });

  it("rating=1 does not create any boost", () => {
    const result = applyCardRating(FRESH_LEARNING, CARD_INTENSITY_0, 1, NOW);
    expect(result.familyBoosts.length).toBe(0);
  });

  it("boosted family card is ranked higher than unboosted card", () => {
    // عزِّز CARD_MICRO (micro_exercise, addresses: anger)
    const learningWithBoost = applyCardRating(FRESH_LEARNING, CARD_MICRO, 5, NOW);

    // الاختيار من: CARD_INTENSITY_0 (concept/shame) وCARD_MICRO (micro_exercise/anger)
    const params = {
      ...BASE_SELECT,
      cards: [CARD_INTENSITY_0, CARD_MICRO],
    };
    const card = selectCardWithLearning(params, learningWithBoost, NOW);
    // CARD_MICRO معزَّزة → تُختار أولاً
    expect(card?.id).toBe("TEST-H-EX");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §4.3 — applyMetricChange
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #10 (§4.3) — applyMetricChange", () => {
  it("updates metricsMovedAt to provided now", () => {
    const dormant = { ...FRESH_LEARNING, metricsMovedAt: DAYS_22_BEFORE };
    const result = applyMetricChange(dormant, NOW);
    expect(result.metricsMovedAt).toBe(NOW);
  });

  it("after applyMetricChange, isDormant returns false", () => {
    const dormant = { ...FRESH_LEARNING, metricsMovedAt: DAYS_22_BEFORE };
    const recovered = applyMetricChange(dormant, NOW);
    expect(isDormant(recovered.metricsMovedAt, NOW)).toBe(false);
  });

  it("does not change other learning state fields", () => {
    const state: LearningState = {
      skipsByCard: { "X": { count: 1 } },
      familyBoosts: [{ kind: "concept", addresses: ["shame"], expiresAt: DAYS_61_FORWARD }],
      metricsMovedAt: DAYS_22_BEFORE,
      lastCardShownAt: DAYS_3_BEFORE,
    };
    const result = applyMetricChange(state, NOW);
    expect(result.skipsByCard).toEqual(state.skipsByCard);
    expect(result.familyBoosts).toEqual(state.familyBoosts);
    expect(result.lastCardShownAt).toBe(state.lastCardShownAt);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// دمج: حلقة التعلّم + وضع السكون
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #10 — integration: dormancy exits silently on metric change", () => {
  it("session becomes non-dormant after applyMetricChange, selectCardWithLearning returns intensity>0", () => {
    // دخلنا السكون
    const dormant = { ...FRESH_LEARNING, metricsMovedAt: DAYS_22_BEFORE };
    expect(isDormant(dormant.metricsMovedAt, NOW)).toBe(true);

    // حركة في المقاييس → خروج صامت
    const recovered = applyMetricChange(dormant, NOW);
    expect(isDormant(recovered.metricsMovedAt, NOW)).toBe(false);

    // الآن selectCardWithLearning يمكنه إعادة بطاقات intensity>0
    const params = { ...BASE_SELECT, cards: [CARD_INTENSITY_2], ceiling: 5 };
    const card = selectCardWithLearning(params, recovered, NOW);
    expect(card).not.toBeNull();
    expect(card!.id).toBe("TEST-H-02");
  });
});
