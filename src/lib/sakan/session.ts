/**
 * Sakan (سَكَن) — Session & routing (الجلسة والتنقّل)
 *
 * ─── لماذا وُجدت هذه الوحدة ──────────────────────────────────────────────────
 * كان الدور يعيش في ذاكرة مُختزِل صفحة التهيئة وحدها، فينتهي بانتهاء الصفحة.
 * ولم يكن يُكتب في التخزين المحلي إطلاقاً رغم أن شاشة الإعدادات كانت تقرأه.
 * النتيجة: بعد إتمام أسبوع صفر تقف الرحلة عند شاشة شكر، والمسارات اليومية
 * والمساحة المشتركة والإعدادات مبنيّة لكن لا سبيل إليها من داخل التطبيق.
 *
 * ─── القيود ──────────────────────────────────────────────────────────────────
 * - الدور يُقرأ من التخزين المحلي على جهاز صاحبه وحده (§1.7: جهازان منفصلان).
 *   لا يُزامَن، ولا يُرسل، ولا يظهر في أي واجهة يراها الطرف الآخر.
 * - المفاتيح مختصرة ومحايدة: لا تكشف طبيعة التطبيق لمن يتصفّح التخزين.
 * - لا شيء هنا يحمل أي إشارة إلى الطرف الآخر أو نشاطه.
 *
 * ─── المسارات ────────────────────────────────────────────────────────────────
 * SAKAN_ROUTES هو المصدر الوحيد لعناوين الصفحات. اختبار قابلية البلوغ
 * (reachability.test.ts) يبني رسماً بيانياً من هذه الثوابت ومن روابط الصفحات،
 * ويتحقّق أن كل صفحة مبنيّة يمكن بلوغها من نقطة الدخول — فلا تُبنى شاشة معزولة.
 *
 * ملاحظة basePath: العناوين هنا بلا بادئة. next/link و useRouter يضيفان
 * basePath تلقائياً (‎/tunisia-simulator-game في النشر)، فلا يجوز استعمال
 * window.location مع هذه الثوابت.
 */

import type { SakanRole } from "@/types/sakan";

// ─── المسارات ────────────────────────────────────────────────────────────────

export const SAKAN_ROUTES = {
  /** نقطة الدخول: اختيار الدور ← الميثاق ← أسبوع صفر. */
  home:         "/sakan",
  wifeDaily:    "/sakan/wife-daily",
  husbandDaily: "/sakan/husband-daily",
  shared:       "/sakan/shared",
  settings:     "/sakan/settings",
} as const;

export type SakanRoute = (typeof SAKAN_ROUTES)[keyof typeof SAKAN_ROUTES];

/** المسار اليومي الموافق للدور. */
export function dailyPathFor(role: SakanRole): SakanRoute {
  return role === "wife" ? SAKAN_ROUTES.wifeDaily : SAKAN_ROUTES.husbandDaily;
}

// ─── مفاتيح التخزين المحلي ───────────────────────────────────────────────────

/** الدور على هذا الجهاز. */
export const ROLE_KEY = "s.r";
/** هل أُتمّ أسبوع صفر على هذا الجهاز؟ */
export const WEEK_ZERO_KEY = "s.w0";

/** كل مفاتيح سَكَن في التخزين المحلي — يستعملها زر المسح. */
export const SAKAN_LOCAL_KEYS: readonly string[] = [
  ROLE_KEY,
  WEEK_ZERO_KEY,
  "s.c.v", // الميثاق شوهد
  "s.b.w", // تنبيه المتصفح شوهد
] as const;

// ─── قراءة وكتابة ────────────────────────────────────────────────────────────
// كل دالة تتحمّل غياب localStorage (التصيير على الخادم، أو متصفح يمنع التخزين).

export function readRole(): SakanRole | null {
  try {
    const v = localStorage.getItem(ROLE_KEY);
    return v === "wife" || v === "husband" ? v : null;
  } catch {
    return null;
  }
}

export function writeRole(role: SakanRole): void {
  try { localStorage.setItem(ROLE_KEY, role); } catch { /* صامت */ }
}

export function hasCompletedWeekZero(): boolean {
  try { return localStorage.getItem(WEEK_ZERO_KEY) === "1"; } catch { return false; }
}

export function markWeekZeroComplete(): void {
  try { localStorage.setItem(WEEK_ZERO_KEY, "1"); } catch { /* صامت */ }
}

/** يمسح كل مفاتيح سَكَن المحلية — يُستدعى مع wipeAllLocalData. */
export function clearSakanLocalKeys(): void {
  try {
    for (const k of SAKAN_LOCAL_KEYS) localStorage.removeItem(k);
  } catch { /* صامت */ }
}

/**
 * الوجهة عند فتح التطبيق:
 * من أتمّ أسبوع صفر ويعرف دوره يذهب إلى مساره اليومي مباشرة،
 * ومن لم يُتمّه يبقى في نقطة الدخول.
 */
export function landingPath(): SakanRoute {
  const role = readRole();
  if (role && hasCompletedWeekZero()) return dailyPathFor(role);
  return SAKAN_ROUTES.home;
}
