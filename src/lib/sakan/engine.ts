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

import type { Card, CardIntensity, SakanRole, SessionSignal } from "@/types/sakan";

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
 *   earnedLevel فقط → min(earned, 5)
 *   (لا مفتاح، لا حد safety)
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

  // husband — earnedLevel فقط
  return earned;
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
