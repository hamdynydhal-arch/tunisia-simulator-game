/**
 * اختبار القبول ٨ (SPEC §8.8)
 *
 *   "نص أي إشعار لا يحتوي محتوى بطاقة ولا اسم قسم."
 *
 * ويقابله في §1 القاعدة ٩: "لا إشعارات تحمل محتوى. نص الإشعار الوحيد المسموح:
 * اسم محايد بلا تفصيل. ويُفضّل تعطيلها افتراضياً."
 *
 * ─── لماذا حُذفت قائمة الكلمات ───────────────────────────────────────────────
 * النسخة الأولى قارنت نصّ الإشعار بقائمة كلمات كاشفة مكتوبة يدوياً. أي مرادف
 * لم يخطر ببال كاتب القائمة كان يمرّ. الاختبار الآن لا يحوي قائمة إطلاقاً:
 *
 *   ١. النصّ يُقارَن **بثابت واحد** معرَّف في notifications.ts. أي ناتج آخر
 *      — مهما صيغ — يختلف عن الثابت فيفشل.
 *   ٢. محتوى البطاقات لا يأتي من قائمة بل من ALL_CARDS الحقيقية: كل قيمة
 *      نصّية في كل بطاقة تُفحص مقابل نصّ الإشعار.
 *   ٣. أسماء الأقسام تأتي من الكتالوج نفسه (CardAddress، CardKind) ومن
 *      مفاتيح المخازن — لا من قائمة مكتوبة.
 *
 * ─── الضمان البنيوي ──────────────────────────────────────────────────────────
 * buildNotificationText() لا تأخذ معاملات إطلاقاً. ما لا يدخل الدالة لا يمكن
 * أن يتسرّب منها. الاختبار يثبّت هذا: أي معامل يُضاف يُفشل فحص البصمة.
 *
 * ─── ما يُفشل الاختبار ───────────────────────────────────────────────────────
 *   - buildNotificationText تُعيد نصاً غير الثابت.
 *   - إضافة معامل إلى buildNotificationText (بطاقة، قسم، حالة…).
 *   - ظهور أي قيمة من أي بطاقة حقيقية في نصّ الإشعار.
 *   - shouldAutoRequestNotificationPermission تُعيد true.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  shouldAutoRequestNotificationPermission,
  buildNotificationText,
  NOTIFICATION_TITLE,
  NOTIFICATION_BODY,
} from "@/lib/sakan/notifications";
import { SAKAN_CAMOUFLAGE_NAME } from "@/lib/sakan/camouflage";
import { ALL_CARDS } from "@/lib/sakan/cards";
import { WIFE_STORE_KEYS, HUSBAND_STORE_KEYS } from "@/lib/sakan/idb";

// ─── النصّ الكامل الذي يراه المستخدم ─────────────────────────────────────────

function fullNotificationText(): string {
  const { title, body } = buildNotificationText();
  return `${title} ${body}`.trim();
}

// ─── أسماء الأقسام، مشتقّة من الكتالوج لا من قائمة ───────────────────────────

function sectionNames(): string[] {
  const names = new Set<string>();
  for (const card of ALL_CARDS) {
    names.add(card.kind);
    for (const a of card.addresses) names.add(a);
  }
  for (const k of Object.keys(WIFE_STORE_KEYS))    names.add(k);
  for (const k of Object.keys(HUSBAND_STORE_KEYS)) names.add(k);
  return [...names];
}

// ─── كل قيمة نصّية في كل بطاقة حقيقية ────────────────────────────────────────

function cardStringValues(): Array<{ cardId: string; field: string; value: string }> {
  const out: Array<{ cardId: string; field: string; value: string }> = [];

  for (const card of ALL_CARDS) {
    for (const [field, value] of Object.entries(card)) {
      if (typeof value === "string" && value.length > 0) {
        out.push({ cardId: card.id, field, value });
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" && item.length > 0) {
            out.push({ cardId: card.id, field, value: item });
          }
        }
      }
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AT8 — المستوى الأول: الإشعارات معطّلة
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #8 (§8.8 L1) — notifications are never auto-requested", () => {
  it("shouldAutoRequestNotificationPermission() returns false", () => {
    expect(shouldAutoRequestNotificationPermission()).toBe(false);
  });

  it("it returns false on every call — no state makes it flip", () => {
    for (let i = 0; i < 50; i++) {
      expect(shouldAutoRequestNotificationPermission()).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AT8 — المستوى الثاني: النصّ هو الثابت، لا شيء غيره
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #8 (§8.8 L2) — notification text IS the single constant", () => {
  it("buildNotificationText() returns exactly the declared constants", () => {
    expect(buildNotificationText()).toEqual({
      title: NOTIFICATION_TITLE,
      body:  NOTIFICATION_BODY,
    });
  });

  it("the title is the camouflage name verbatim — not derived, not decorated", () => {
    expect(NOTIFICATION_TITLE).toBe(SAKAN_CAMOUFLAGE_NAME);
  });

  it("the body carries no detail at all", () => {
    expect(NOTIFICATION_BODY).toBe("");
  });

  it("buildNotificationText takes NO parameters — nothing can enter, nothing can leak", () => {
    expect(
      buildNotificationText.length,
      `buildNotificationText declares ${buildNotificationText.length} parameter(s) — ` +
        `any input opens a path for card content to reach the notification`
    ).toBe(0);
  });

  it("forcing arguments in anyway changes nothing", () => {
    const forced = (buildNotificationText as (...a: unknown[]) => unknown)(
      ALL_CARDS[0],
      "KeyState",
      { safety: 10 },
      "أي شيء"
    );
    expect(forced).toEqual({ title: NOTIFICATION_TITLE, body: NOTIFICATION_BODY });
  });

  it("repeated calls are byte-identical — the text never varies", () => {
    const first = fullNotificationText();
    for (let i = 0; i < 50; i++) {
      expect(fullNotificationText()).toBe(first);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AT8 — المستوى الثالث: لا محتوى بطاقة ولا اسم قسم
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #8 (§8.8 L3) — no card content, no section name", () => {
  it("guard: the real catalogue yields card values and section names to test against", () => {
    // لولا هذين الحارسين لكان المسح فارغاً وصحيحاً بالمصادفة
    expect(cardStringValues().length).toBeGreaterThan(20);
    expect(sectionNames().length).toBeGreaterThan(5);
  });

  it("the notification text contains no value from any real card", () => {
    const text = fullNotificationText();

    for (const { cardId, field, value } of cardStringValues()) {
      expect(
        text.includes(value),
        `notification text contains card content — card "${cardId}", ` +
          `field "${field}", value "${value.slice(0, 40)}…" (SPEC §8.8)`
      ).toBe(false);
    }
  });

  it("the notification text contains no section name", () => {
    const text = fullNotificationText();

    for (const name of sectionNames()) {
      expect(
        text.includes(name),
        `notification text contains section name "${name}" (SPEC §8.8)`
      ).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AT8 — المستوى الرابع: لا مسار ثانٍ يُنتج نصّ إشعار
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #8 (§8.8 L4) — no second path builds notification text", () => {
  const SOURCE = readFileSync(
    resolve(__dirname, "../notifications.ts"),
    "utf-8"
  );

  it("notifications.ts never imports a card or a stored model", () => {
    // اقتران بالبطاقات أو بالحالة هو المقدّمة الوحيدة لتسريب المحتوى
    for (const forbidden of ["from \"@/lib/sakan/cards\"", "Card", "WifeState", "HusbandState", "LearningState"]) {
      expect(
        SOURCE.includes(forbidden),
        `notifications.ts references "${forbidden}" — the notification module ` +
          `must stay structurally unable to reach card or state content`
      ).toBe(false);
    }
  });

  it("the title and body are declared as plain constants, not built by interpolation", () => {
    // قالب نصّي في تعريف أيّ منهما يعني أن قيمة ما تُحقن وقت التشغيل
    const titleDecl = /export const NOTIFICATION_TITLE[^;]*;/.exec(SOURCE)?.[0] ?? "";
    const bodyDecl  = /export const NOTIFICATION_BODY[^;]*;/.exec(SOURCE)?.[0]  ?? "";

    expect(titleDecl, "NOTIFICATION_TITLE declaration not found").not.toBe("");
    expect(bodyDecl,  "NOTIFICATION_BODY declaration not found").not.toBe("");

    for (const [label, decl] of [["TITLE", titleDecl], ["BODY", bodyDecl]] as const) {
      expect(
        /\$\{/.test(decl),
        `NOTIFICATION_${label} is built by interpolation: ${decl.trim()}`
      ).toBe(false);
    }
  });
});
