/**
 * Sakan (سَكَن) — محرّك الاختيار النقي
 *
 * SPEC §4.1 — سقف الشدة (Intensity Ceiling)
 * SPEC §4.2 — حلقة الاختيار (Card Selection Loop)
 *
 * # قيود بنيوية مطلقة
 * - هذه الدوال نقية (pure functions): لا استدعاء شبكة، لا قراءة تخزين،
 *   لا آثار جانبية. المدخلات فقط هي المصدر.
 * - HusbandCeilingContext لا يحمل حقل keyState أبداً — ضمان بنيوي
 *   يُفشل اختبار القبول ٢ إن خُرق.
 */

import type {
  Card,
  CardIntensity,
  SakanRole,
  SessionSignal,
  LearningState,
  FamilyBoost,
  CardSkipEntry,
} from "@/types/sakan";

// ─── سياق السقف ──────────────────────────────────────────────────────────────

/**
 * سياق حساب السقف للزوجة.
 * يحمل keyState لأن المفتاح يُخزَّن على جهاز الزوجة فقط.
 */
export interface WifeCeilingContext {
  role: "wife";
  /** حالة المفتاح — locked يجعل السقف = 0 مطلقاً. */
  keyState: "locked" | "open";
  /** مستوى أمان الزوجة (0–100). */
  safety: number;
  /** السقف المكتسب (0–5). */
  earnedLevel: number;
}

/**
 * سياق حساب السقف للزوج.
 *
 * ██ keyState مُحذوف عمداً ██
 * جهاز الزوج لا يعرف حالة المفتاح — هذا قيد بنيوي وليس سياسياً.
 * اختبار القبول ٢ يتحقق من أن ناتج واجهة الزوج لا يتأثر بأي حالة
 * مفتاح، لأن هذا الهيكل لا يملك الحقل أصلاً.
 */
export interface HusbandCeilingContext {
  role: "husband";
  // keyState — مُحذوف عمداً. أي إضافة هنا تكسر اختبار القبول ٢.
  /** مستوى الخجل/العار (0–100). */
  shame: number;
  /** السقف المكتسب (0–5). */
  earnedLevel: number;
}

export type CeilingContext = WifeCeilingContext | HusbandCeilingContext;

// ─── حالة السقف (للتحديث عبر applySessionSignal) ─────────────────────────────

export interface CeilingState {
  earnedLevel: number;                 // 0–5
  consecutivePositiveSessions: number; // عدد الجلسات الإيجابية المتتالية
}

// ─── §4.1 — حساب السقف ───────────────────────────────────────────────────────

const MAX_CEILING = 5;

/**
 * يحسب سقف الشدة الفعلي بناءً على سياق الطرف.
 *
 * قواعد الزوجة (مرتّبة حسب الأولوية):
 *   locked           → 0 (مطلق، لا استثناء)
 *   safety < 40      → min(earned, 1)
 *   safety < 60      → min(earned, 2)
 *   safety < 80      → min(earned, 3)
 *   safety ≥ 80      → min(earned, 5)
 *
 * قواعد الزوج:
 *   0 دائماً → مساره كله intensity 0 (SPEC §4.1)
 *   (لا مفتاح، لا حد safety، ولا يرفعه earnedLevel)
 */
export function computeCeiling(ctx: CeilingContext): number {
  const earned = Math.min(ctx.earnedLevel, MAX_CEILING);

  if (ctx.role === "wife") {
    if (ctx.keyState === "locked") return 0;

    if (ctx.safety < 40)  return Math.min(earned, 1);
    if (ctx.safety < 60)  return Math.min(earned, 2);
    if (ctx.safety < 80)  return Math.min(earned, 3);
    return Math.min(earned, MAX_CEILING); // safety ≥ 80
  }

  // ─── الزوج — السقف مقفول عند 0 دائماً (SPEC §4.1) ────────────────────────
  // لا يرفعه earnedCeiling، ولا الجلسات الإيجابية، ولا مرور الوقت،
  // ولا حالة المفتاح. مساره كله intensity 0: مهارات ومعلومات بلا محتوى اقتراب.
  //
  // هذا لا يُضعف العزل البنيوي في §3.3 — بل يُقوّيه: السقف ثابت بحكم الدور
  // لا بحكم المفتاح، فلا يبقى في مسار الزوج شيء يُستدل منه على حالة المفتاح.
  // `earned` يُحسب أعلاه ويبقى في نموذج الزوج لأن applySessionSignal يستخدمه
  // في إشارات الجلسة، لكنه لا يدخل في حساب السقف.
  void earned;
  return 0;
}

// ─── §4.1 — تطبيق إشارة الجلسة ───────────────────────────────────────────────

/**
 * يُحدِّث حالة السقف بناءً على استجابة جلسة واحدة.
 *
 * عدم التناظر (SPEC §4.1):
 * - تجاوز (skip/close) لبطاقة intensity ≥ 1 → earnedLevel −= 1 فوراً
 * - قبول + comfortRating ≥ 3 → consecutivePositiveSessions += 1
 *   إذا بلغ 3: earnedLevel += 1، إعادة ضبط المتتالية إلى 0
 * - أي حالة أخرى → إعادة ضبط المتتالية فقط (لا تغيير في earnedLevel)
 *
 * @param current   الحالة الحالية للسقف
 * @param signal    إشارة الجلسة (ردّ الفعل + تقييم الراحة)
 * @param cardIntensity  شدة البطاقة التي جرت الاستجابة عليها
 */
export function applySessionSignal(
  current: CeilingState,
  signal: SessionSignal,
  cardIntensity: CardIntensity,
): CeilingState {
  const isSkip = signal.response === "skipped" || signal.response === "closed";
  const isPositive =
    signal.response === "accepted" &&
    signal.comfortRating !== undefined &&
    signal.comfortRating >= 3;

  // ─── هبوط فوري ────────────────────────────────────────────────────────────
  if (isSkip && cardIntensity >= 1) {
    return {
      earnedLevel: Math.max(0, current.earnedLevel - 1),
      consecutivePositiveSessions: 0,
    };
  }

  // ─── صعود تدريجي (3 جلسات متتالية) ──────────────────────────────────────
  if (isPositive) {
    const next = current.consecutivePositiveSessions + 1;
    if (next >= 3) {
      return {
        earnedLevel: Math.min(MAX_CEILING, current.earnedLevel + 1),
        consecutivePositiveSessions: 0,
      };
    }
    return {
      earnedLevel: current.earnedLevel,
      consecutivePositiveSessions: next,
    };
  }

  // ─── كل حالة أخرى → إعادة ضبط المتتالية فقط ─────────────────────────────
  return {
    earnedLevel: current.earnedLevel,
    consecutivePositiveSessions: 0,
  };
}

// ─── §4.2 — حلقة الاختيار ────────────────────────────────────────────────────

/**
 * مدخلات دالة الاختيار — دالة نقية بالكامل.
 */
export interface SelectCardParams {
  role: SakanRole;
  /** السقف المحسوب من computeCeiling — يُمرَّر من الخارج. */
  ceiling: number;
  /** قائمة كل البطاقات (عادةً ALL_CARDS من cards.ts). */
  cards: Card[];
  /** مستوى الأمان للزوجة (0–100) — اختياري، يُستخدم في الترتيب. */
  safety?: number;
  /** مستوى العار للزوج (0–100) — اختياري، يُستخدم في الترتيب. */
  shame?: number;
  /** أعلام السياق النشطة (مثل: 'after_anger_event'). */
  flags: string[];
  /** معرّفات البطاقات المعروضة سابقاً في هذه الجلسة. */
  shownCardIds: Set<string>;
  /** معرّف آخر بطاقة عُرضت — يمنع التكرار الفوري. */
  lastCardId?: string;
}

// ─── §4.3 + §4.4 — ثوابت حلقة التعلّم ووضع السكون ──────────────────────────

/** أيام بلا تغيّر في المقاييس قبل الدخول في وضع السكون. */
const DORMANCY_DAYS = 21;
/** أيام الانتظار بين بطاقة وأخرى في وضع السكون. */
const DORMANCY_CADENCE_DAYS = 3;
/** أيام التهميش بعد تجاوز البطاقة مرتين. */
const DEPRIORITIZE_DAYS = 60;
/** عدد التجاوزات التي تُفعِّل التهميش. */
const SKIP_THRESHOLD = 2;
/** درجة التهميش في الترتيب — تُدفع البطاقة للحضيض. */
const DEPRIO_SCORE = -10_000;
/** درجة تعزيز العائلة في الترتيب — ترتفع البطاقة في الأولوية. */
const BOOST_SCORE = 1_000;

// ─── §4.4 — وضع السكون ───────────────────────────────────────────────────────

/**
 * هل دخلنا وضع السكون؟
 * يعود true إن مضى ≥21 يوماً على آخر تغيّر في المقاييس.
 *
 * @param metricsMovedAt  تاريخ آخر تغيّر في earnedCeiling (ISO-8601)
 * @param now             التاريخ الحالي (اختياري — للاختبارات، افتراضيه new Date())
 */
export function isDormant(metricsMovedAt: string, now?: string): boolean {
  const nowMs  = now ? Date.parse(now) : Date.now();
  const lastMs = Date.parse(metricsMovedAt);
  return nowMs - lastMs >= DORMANCY_DAYS * 24 * 60 * 60 * 1_000;
}

/**
 * هل يُفترض عرض بطاقة اليوم؟
 * - خارج السكون: دائماً true.
 * - في السكون: true إن لم تُعرض بطاقة من قبل، أو مضى ≥3 أيام على آخر بطاقة.
 *
 * @param dormant          ناتج isDormant
 * @param lastCardShownAt  تاريخ آخر بطاقة (ISO-8601 | null)
 * @param now              التاريخ الحالي (اختياري)
 */
export function shouldShowCardToday(
  dormant: boolean,
  lastCardShownAt: string | null,
  now?: string,
): boolean {
  if (!dormant) return true;
  if (!lastCardShownAt) return true;
  const nowMs  = now ? Date.parse(now) : Date.now();
  const lastMs = Date.parse(lastCardShownAt);
  return nowMs - lastMs >= DORMANCY_CADENCE_DAYS * 24 * 60 * 60 * 1_000;
}

// ─── §4.3 — حلقة التعلّم ─────────────────────────────────────────────────────

/**
 * يُسجِّل تجاوزاً لبطاقة ويُفعِّل التهميش عند بلوغ العتبة.
 * دالة نقية — لا آثار جانبية.
 *
 * @param state   حالة التعلّم الحالية
 * @param cardId  معرّف البطاقة المتجاوَزة
 * @param now     التاريخ الحالي (اختياري)
 */
export function applyCardSkip(
  state: LearningState,
  cardId: string,
  now?: string,
): LearningState {
  const existing: CardSkipEntry = state.skipsByCard[cardId] ?? { count: 0 };
  const newCount = existing.count + 1;

  const entry: CardSkipEntry = { count: newCount };

  if (newCount >= SKIP_THRESHOLD) {
    const base = now ? new Date(now) : new Date();
    const until = new Date(base.getTime() + DEPRIORITIZE_DAYS * 24 * 60 * 60 * 1_000);
    entry.deprioritizedUntil = until.toISOString();
  }

  return {
    ...state,
    skipsByCard: { ...state.skipsByCard, [cardId]: entry },
  };
}

/**
 * يُعدِّل أولوية عائلة البطاقة استناداً إلى تقييم الراحة.
 * تقييم ≥3 يُنشئ تعزيزاً للعائلة (نفس kind + addresses مشتركة) لمدة 60 يوماً.
 * تقييم <3 لا يُغيِّر شيئاً.
 * دالة نقية — لا آثار جانبية.
 */
export function applyCardRating(
  state: LearningState,
  card: Card,
  rating: 1 | 2 | 3 | 4 | 5,
  now?: string,
): LearningState {
  if (rating < 3) return state;

  const base = now ? new Date(now) : new Date();
  const expiresAt = new Date(
    base.getTime() + DEPRIORITIZE_DAYS * 24 * 60 * 60 * 1_000,
  ).toISOString();

  const boost: FamilyBoost = {
    kind: card.kind,
    addresses: card.addresses,
    expiresAt,
  };

  // أبقِ فقط التعزيزات غير المنتهية الصلاحية
  const nowStr = now ?? new Date().toISOString();
  const active = state.familyBoosts.filter((b) => b.expiresAt > nowStr);

  return { ...state, familyBoosts: [...active, boost] };
}

/**
 * يُسجِّل حركة في المقاييس (تغيّر earnedCeiling) — يُعيد ضبط مؤقّت السكون.
 * يُستدعى من page shell كلما تغيّر earnedLevel نتيجة applySessionSignal.
 * دالة نقية — لا آثار جانبية.
 */
export function applyMetricChange(
  state: LearningState,
  now?: string,
): LearningState {
  return {
    ...state,
    metricsMovedAt: now ?? new Date().toISOString(),
  };
}

/**
 * يختار بطاقة واحدة للعرض، أو null إن لم تتوفر بطاقة مناسبة.
 *
 * خوارزمية الاختيار (§4.2):
 * 1. ترشيح: audience + intensity ≤ ceiling + forbidden_when
 * 2. استبعاد shownCardIds (مع إعادة التشغيل عند نفاد المرشحين)
 * 3. تجنّب lastCardId إن أمكن
 * 4. ترتيب الأولوية: intensity أولاً (الأخف حمولةً) → التنويع
 * 5. إرجاع أول بطاقة في القائمة المرتّبة
 */
export function selectCard(params: SelectCardParams): Card | null {
  const { role, ceiling, cards, flags, shownCardIds, lastCardId } = params;

  // ─── المرحلة ١: الترشيح الأساسي ──────────────────────────────────────────
  const audience = role; // 'wife' | 'husband'

  const eligible = cards.filter((card) => {
    // جمهور البطاقة
    if (card.audience !== audience) return false;
    // سقف الشدة
    if (card.intensity > ceiling) return false;
    // الشروط المحظورة
    if (card.forbidden_when?.some((f) => flags.includes(f))) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  // ─── المرحلة ٢: استبعاد البطاقات المعروضة سابقاً ─────────────────────────
  const unseen = eligible.filter((c) => !shownCardIds.has(c.id));

  // إعادة التشغيل: إن نفدت البطاقات غير المعروضة، نعود إلى القائمة الكاملة
  const pool = unseen.length > 0 ? unseen : eligible;

  // ─── المرحلة ٣: تجنّب التكرار الفوري ─────────────────────────────────────
  const withoutLast = pool.filter((c) => c.id !== lastCardId);
  const finalPool = withoutLast.length > 0 ? withoutLast : pool;

  // ─── المرحلة ٤: ترتيب الأولوية ───────────────────────────────────────────
  // الأخف حمولةً أولاً (intensity أصغر → يُعرض قبل الأشد)
  // عند التعادل: الترتيب الأصلي محفوظ (sort مستقر في ES2019+)
  const sorted = [...finalPool].sort((a, b) => a.intensity - b.intensity);

  // ─── المرحلة ٥: الإرجاع ──────────────────────────────────────────────────
  return sorted[0] ?? null;
}

// ─── §4.3 + §4.4 — الاختيار مع التعلّم ──────────────────────────────────────

/**
 * يختار بطاقة مع مراعاة حالة التعلّم ووضع السكون.
 *
 * فوق selectCard القاعدية، تضيف هذه الدالة:
 * §4.4 — السكون: في حالة السكون يُقيَّد السقف إلى 0 (intensity=0 فقط).
 * §4.3 — التهميش: البطاقات المُهمَّشة تُدفع للحضيض في الترتيب.
 * §4.3 — التعزيز: البطاقات ذات العائلة المعزَّزة ترتفع في الأولوية.
 *
 * يُستدعى من page shell بدلاً من selectCard.
 * دالة نقية — لا آثار جانبية، لا استدعاء شبكة.
 *
 * @param params   نفس معاملات selectCard
 * @param learning حالة التعلّم الحالية
 * @param now      التاريخ الحالي (اختياري — للاختبارات)
 */
export function selectCardWithLearning(
  params: SelectCardParams,
  learning: LearningState,
  now?: string,
): Card | null {
  const nowStr = now ?? new Date().toISOString();
  const dormant = isDormant(learning.metricsMovedAt, nowStr);

  // §4.4: في السكون، السقف الفعّال = 0 (intensity=0 فقط)
  const effectiveCeiling = dormant ? 0 : params.ceiling;
  const effectiveParams  = dormant ? { ...params, ceiling: 0 } : params;

  // ─── نفس خطوات selectCard (الترشيح + الاستبعاد + تجنّب التكرار) ────────
  const { role, cards, flags, shownCardIds, lastCardId } = effectiveParams;
  const audience = role;

  const eligible = cards.filter((card) => {
    if (card.audience !== audience)                                return false;
    if (card.intensity > effectiveCeiling)                        return false;
    if (card.forbidden_when?.some((f) => flags.includes(f)))      return false;
    return true;
  });

  if (eligible.length === 0) return null;

  const unseen    = eligible.filter((c) => !shownCardIds.has(c.id));
  const pool      = unseen.length > 0 ? unseen : eligible;
  const withoutLast = pool.filter((c) => c.id !== lastCardId);
  const finalPool = withoutLast.length > 0 ? withoutLast : pool;

  // ─── §4.3: تسجيل نقاط التعلّم لكل بطاقة ─────────────────────────────────
  function learningScore(card: Card): number {
    let score = 0;

    // التهميش: بطاقة تجاوَزت مرتين → حضيض الأولوية
    const skipEntry = learning.skipsByCard[card.id];
    if (skipEntry?.deprioritizedUntil && skipEntry.deprioritizedUntil > nowStr) {
      score += DEPRIO_SCORE;
    }

    // التعزيز: عائلة معزَّزة (نفس kind + address مشتركة) → قمة الأولوية
    const hasBoostedFamily = learning.familyBoosts.some(
      (b) =>
        b.expiresAt > nowStr &&
        b.kind === card.kind &&
        b.addresses.some((a) => (card.addresses as string[]).includes(a)),
    );
    if (hasBoostedFamily) score += BOOST_SCORE;

    // الأخف حمولةً أولاً — نفس منطق selectCard (عند التعادل في التعلّم)
    score -= card.intensity;

    return score;
  }

  const scored = finalPool
    .map((card) => ({ card, score: learningScore(card) }))
    .sort((a, b) => b.score - a.score); // أعلى نقطة أولاً

  return scored[0]?.card ?? null;
}
