/**
 * اختبار القبول ٨ — الإشعارات معطّلة وعنوانها محايد
 *
 * SPEC §8.2: "الإشعارات معطّلة افتراضياً وأي نص موجود محايد بالكامل"
 *
 * ─── ما يُختبر ────────────────────────────────────────────────────────────────
 * ١. shouldAutoRequestNotificationPermission() يُعيد false.
 *    التطبيق لا يطلب إذن الإشعارات أبداً بمبادرته.
 * ٢. NOTIFICATION_TITLE لا يحتوي على أي كلمة كاشفة من REVEALING_WORDS.
 *    الاسم الظاهر في الإشعارات محايد تماماً.
 *
 * ─── المنهج ───────────────────────────────────────────────────────────────────
 * دوال نقية وثوابت — لا DOM، لا شبكة، لا Browser Notification API.
 *
 * ─── ما يُفشل الاختبار ───────────────────────────────────────────────────────
 * ١. shouldAutoRequestNotificationPermission() تُعيد true.
 * ٢. NOTIFICATION_TITLE يحتوي كلمة من REVEALING_WORDS (مثل "سكن"، "علاجي").
 */

import { describe, it, expect } from "vitest";
import {
  shouldAutoRequestNotificationPermission,
  NOTIFICATION_TITLE,
  REVEALING_WORDS,
} from "@/lib/sakan/notifications";

// ═══════════════════════════════════════════════════════════════════════════════
// AT8 — صمت الإشعارات وحياد نصّها
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #8 (§8.2) — notifications off by default, title is neutral", () => {
  it(
    "shouldAutoRequestNotificationPermission() returns false — never auto-requests permission",
    () => {
      expect(shouldAutoRequestNotificationPermission()).toBe(false);
    }
  );

  it(
    "NOTIFICATION_TITLE contains no revealing words from REVEALING_WORDS",
    () => {
      const title = NOTIFICATION_TITLE.toLowerCase();

      for (const word of REVEALING_WORDS) {
        const found = title.includes(word.toLowerCase());
        expect(found, `NOTIFICATION_TITLE contains revealing word: "${word}"`).toBe(false);
      }
    }
  );
});
