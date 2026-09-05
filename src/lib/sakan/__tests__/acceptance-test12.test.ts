/**
 * اختبار القبول ١٢ — صمت سياق الشريك بصرياً في المساحة المشتركة
 *
 * SPEC §7: "لا مؤشر مشترك يكشف نشاط طرف أو توقفه"
 *
 * ─── ما يُختبر ────────────────────────────────────────────────────────────────
 * SharedSpaceContent يستقبل PartnerContext الذي يحمل:
 *   partnerHasSubmitted = false  → الطرف الآخر لم يجب إطلاقاً
 *   partnerHasSubmitted = true   → الطرف الآخر أجاب ولكن إجاباته لم تتقاطع
 *
 * في الحالتين تكون التقاطعات الفعلية نفسها.
 * HTML المُسلسَل يجب أن يتطابق حرفاً بحرف.
 *
 * ─── المنهج: تطابق كامل ───────────────────────────────────────────────────────
 * يُصيَّر SharedSpaceContent مرتين بنفس الـ intersection المثبَّت:
 *   - مرة مع partnerHasSubmitted = false
 *   - مرة مع partnerHasSubmitted = true
 * أي نص أو عنصر أو شارة مشروط بـ partnerContext ينتج HTML مختلفاً → يفشل.
 *
 * ─── ما يُفشل الاختبار ───────────────────────────────────────────────────────
 * أي إضافة إلى SharedSpaceContent مشروطة بـ partnerContext:
 *   {partnerContext.partnerHasSubmitted && <p>الطرف الآخر استجاب</p>}
 *   {!partnerContext.partnerHasSubmitted && <span className="badge">…</span>}
 *   <Indicator active={partnerContext.partnerHasSubmitted} />
 *   // أي صيغة أخرى
 */

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PreferenceId, PartnerContext } from "@/types/sakan";

// ─── ثوابت الاختبار ───────────────────────────────────────────────────────────

/** التقاطع المثبَّت — نفسه في كلا الحالتين. */
const FIXED_INTERSECTION: PreferenceId[] = ["pref-morning", "pref-quiet-space"];

/** دالة تصيير ثابتة — لا تعتمد على partnerContext. */
const FIXED_RENDER_ITEM = (id: PreferenceId, _index: number) =>
  createElement("div", { className: "pref-card" }, id);

// ─── سياقا الشريك ─────────────────────────────────────────────────────────────

/** الطرف الآخر لم يجب إطلاقاً. */
const PARTNER_NOT_SUBMITTED: PartnerContext = {
  partnerHasSubmitted: false,
};

/**
 * الطرف الآخر أجاب — لكن إجاباته لم تتقاطع مع التقاطع المثبَّت.
 * (التقاطعات الفعلية هي FIXED_INTERSECTION في الحالتين.)
 */
const PARTNER_HAS_SUBMITTED: PartnerContext = {
  partnerHasSubmitted: true,
};

// ─── dummy ────────────────────────────────────────────────────────────────────

const NOOP = () => {};

// ═══════════════════════════════════════════════════════════════════════════════
// AT12 — صمت سياق الشريك
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #12 (§7) — partner context is visually silent: shared space", () => {
  it(
    "HTML is byte-identical: " +
      "partnerHasSubmitted=false vs partnerHasSubmitted=true (same fixed intersections)",
    async () => {
      // lazy import — يفشل هنا إن لم يُصدَّر SharedSpaceContent
      const { SharedSpaceContent } = await import("@/app/sakan/shared/page");

      const base = {
        intersection:  FIXED_INTERSECTION,
        renderItem:    FIXED_RENDER_ITEM,
        passphrase:    "test-passphrase",
        role:          "husband" as const,
      };

      const htmlNotSubmitted = renderToStaticMarkup(
        createElement(SharedSpaceContent, {
          ...base,
          partnerContext: PARTNER_NOT_SUBMITTED,
        })
      );

      const htmlHasSubmitted = renderToStaticMarkup(
        createElement(SharedSpaceContent, {
          ...base,
          partnerContext: PARTNER_HAS_SUBMITTED,
        })
      );

      // الفرق الوحيد بين الحالتين هو partnerContext.partnerHasSubmitted.
      // إن ظهر أي نص أو عنصر مشروط به → HTML مختلف → اختبار يفشل.
      expect(htmlNotSubmitted).toBe(htmlHasSubmitted);
    }
  );
});
