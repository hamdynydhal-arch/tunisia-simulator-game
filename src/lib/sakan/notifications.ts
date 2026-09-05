/**
 * Sakan (سَكَن) — Notification constants (ثوابت الإشعارات)
 *
 * SPEC §8.2: "الإشعارات معطّلة افتراضياً وأي نص موجود محايد بالكامل"
 *
 * ─── القواعد ────────────────────────────────────────────────────────────────
 * ١. shouldAutoRequestNotificationPermission() يُعيد false دائماً.
 *    الإذن لا يُطلب تلقائياً في أي وقت — التطبيق لا يسأل أبداً.
 * ٢. NOTIFICATION_TITLE يستخدم SAKAN_CAMOUFLAGE_NAME حرفياً.
 *    لا وصف علاجي، لا كلمة "سكن" أو مشتقاتها.
 *
 * AT8 يتحقق من:
 *   ١. shouldAutoRequestNotificationPermission() === false
 *   ٢. NOTIFICATION_TITLE لا يحتوي على أي كلمة كاشفة من REVEALING_WORDS
 */

import { SAKAN_CAMOUFLAGE_NAME, REVEALING_WORDS } from "./camouflage";

// ─── عنوان الإشعار الموحَّد ───────────────────────────────────────────────────

/**
 * يُستخدم كعنوان في أي إشعار Push أو Local يصدره التطبيق.
 * يطابق SAKAN_CAMOUFLAGE_NAME حرفياً بلا إضافة.
 */
export const NOTIFICATION_TITLE: string = SAKAN_CAMOUFLAGE_NAME;

// ─── دالة التحكم في طلب الإذن ─────────────────────────────────────────────────

/**
 * هل يجب على التطبيق طلب إذن الإشعارات تلقائياً عند التشغيل؟
 *
 * يُعيد false دائماً — التطبيق لا يطلب الإذن أبداً بمبادرته.
 * إن احتاج المستخدم للإشعارات مستقبلاً، يُفعِّلها صراحةً من الإعدادات.
 *
 * AT8 يختبر هذه الدالة بشكل مباشر.
 */
export function shouldAutoRequestNotificationPermission(): boolean {
  return false;
}

// ─── re-export ────────────────────────────────────────────────────────────────
// تُتاح REVEALING_WORDS للاختبارات دون استيراد ثانوي من camouflage.ts
export { REVEALING_WORDS };
