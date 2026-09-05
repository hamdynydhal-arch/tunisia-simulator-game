/**
 * اختبار القبول ٦ — التمويه الكامل: لا خطوط ولا موارد خارجية
 *
 * SPEC §8.1: "توحيد التمويه بالكامل"
 * SPEC §8.6: "لا خطوط ولا موارد من CDN خارجي"
 *
 * ─── ما يُختبر ────────────────────────────────────────────────────────────────
 * ١. SAKAN_CAMOUFLAGE_NAME لا يحتوي على أي كلمة كاشفة من REVEALING_WORDS.
 *    (الكلمات الكاشفة تكشف الطبيعة العلاجية للتطبيق.)
 * ٢. CSP_FONT_SRC لا يحتوي على أي نطاق https:// خارجي.
 *    (next/font/google يُضمِّن الخطوط وقت البناء — لا طلب شبكي وقت التشغيل.)
 *
 * ─── المنهج ───────────────────────────────────────────────────────────────────
 * دوال نقية على ثوابت — لا DOM، لا شبكة، لا مكوّنات.
 * AT6 يفشل إن أُضيف https:// إلى CSP_FONT_SRC أو أي كلمة كاشفة إلى SAKAN_CAMOUFLAGE_NAME.
 *
 * ─── ما يُفشل الاختبار ───────────────────────────────────────────────────────
 * ١. SAKAN_CAMOUFLAGE_NAME = "مساحة آمنة" أو أي قيمة تحتوي كلمة من REVEALING_WORDS.
 * ٢. CSP_FONT_SRC = "'self' data: https://fonts.googleapis.com" أو أي https://.
 */

import { describe, it, expect } from "vitest";
import { SAKAN_CAMOUFLAGE_NAME, CSP_FONT_SRC, REVEALING_WORDS } from "@/lib/sakan/camouflage";

// ═══════════════════════════════════════════════════════════════════════════════
// AT6 — التمويه الكامل
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #6 (§8.1/§8.6) — camouflage & no external resources", () => {
  it(
    "SAKAN_CAMOUFLAGE_NAME contains no revealing words from REVEALING_WORDS",
    () => {
      // SAKAN_CAMOUFLAGE_NAME يجب ألا يحتوي على أي كلمة كاشفة
      const name = SAKAN_CAMOUFLAGE_NAME.toLowerCase();

      for (const word of REVEALING_WORDS) {
        const found = name.includes(word.toLowerCase());
        expect(found, `SAKAN_CAMOUFLAGE_NAME contains revealing word: "${word}"`).toBe(false);
      }
    }
  );

  it(
    "CSP_FONT_SRC contains no external https:// domain",
    () => {
      // CSP_FONT_SRC يجب ألا يحتوي على https:// — الخطوط مُضمَّنة وقت البناء
      const hasExternalHttps = /https:\/\//.test(CSP_FONT_SRC);
      expect(
        hasExternalHttps,
        `CSP_FONT_SRC must not reference external HTTPS domains. Got: "${CSP_FONT_SRC}"`
      ).toBe(false);
    }
  );
});
