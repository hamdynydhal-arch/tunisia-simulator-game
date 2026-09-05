"use client";

/**
 * Sakan (سَكَن) — تنقّل هادئ بين شاشات المسار الواحد
 *
 * ─── قيود صريحة ──────────────────────────────────────────────────────────────
 * - لا شارة، ولا عدّاد، ولا نقطة تنبيه، ولا أي رقم. (§1.4)
 * - لا شيء يشير إلى الطرف الآخر أو نشاطه أو توقّفه. (§1.5)
 * - الروابط ثابتة تماماً: لا تتغيّر بحال، ولا تحمل أي معلومة عن الحالة.
 *   هذا شرط بقاء اختبارات التطابق البايتي (٢ و٤ و١١) خضراء — أي عنصر
 *   مشروط بحالة هنا يُنتج HTML مختلفاً بين تصييرين فيُفشلها.
 * - next/link يضيف basePath تلقائياً، فلا يجوز استعمال window.location.
 */

import Link from "next/link";
import { SAKAN_ROUTES } from "@/lib/sakan/session";

interface Props {
  /** المسار الحالي — يُستثنى من الروابط المعروضة. */
  current: "daily" | "settings" | "shared";
  /** المسار اليومي لهذا الجهاز (يُمرَّر من الصفحة التي تعرف الدور). */
  dailyPath?: string;
}

const linkClass =
  "text-xs text-stone-400 hover:text-stone-600 transition-colors " +
  "underline underline-offset-4 decoration-stone-200 hover:decoration-stone-400 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30 rounded";

export default function SakanNav({ current, dailyPath }: Props) {
  return (
    <nav
      className="flex items-center justify-center gap-6 pt-8 pb-2"
      aria-label="التنقّل"
      dir="rtl"
    >
      {current !== "daily" && dailyPath && (
        <Link href={dailyPath} className={linkClass}>
          اليوم
        </Link>
      )}

      {current !== "shared" && (
        <Link href={SAKAN_ROUTES.shared} className={linkClass}>
          المساحة المشتركة
        </Link>
      )}

      {current !== "settings" && (
        <Link href={SAKAN_ROUTES.settings} className={linkClass}>
          الإعدادات
        </Link>
      )}
    </nav>
  );
}
