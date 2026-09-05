"use client";

/**
 * Sakan (سَكَن) — شاشة الميثاق (SPEC §الخطوة ٤)
 *
 * شاشة واحدة. تُعرض مرة عند أول تشغيل، وتبقى قابلة لإعادة الفتح من الإعدادات.
 *
 * تحلّ محل المكوّنين المحذوفين CovenantIntro.tsx وSakanCovenant.tsx.
 *
 * ─── قيود اللغة المُطبَّقة هنا ───────────────────────────────────────────────
 * - لا وعد بنتيجة، ولا جدول زمني.
 * - لا كلمة "برنامج" ولا "مراحل" — استُعمل "هذه الأيام" بدلاً منها.
 * - لا لغة تقييم: لا نجاح/فشل، لا تقدّم/تأخّر، لا إنجاز.
 * - نسخة الزوج لا تذكر شيئاً يوحي بوجود قرار بيد الزوجة:
 *   لا انتظار، ولا إذن، ولا استعداد الطرف الآخر، ولا كلمة "مفتاح".
 * - كل نسخة تحت ١٨٠ كلمة.
 *
 * ─── قيود التفاعل ───────────────────────────────────────────────────────────
 * - لا أزرار تأكيد بنود، ولا صناديق اختيار.
 * - لا منع متابعة ولا خطوات — زر خروج واحد، متاح دائماً.
 * - "حسنًا" لا "فهمت": الثانية فيها معنى إقرار.
 *
 * ─── الضمائر ────────────────────────────────────────────────────────────────
 * covenantCopy() دالة نقية تُرجع نسختين مختلفتين فعلاً.
 * اختبار covenant-copy.test.ts يتحقق من ذلك — العيب السابق كان أن
 * SakanCovenant.tsx يُنتج النص نفسه للطرفين رغم استقبال role.
 */

import type { SakanRole } from "@/types/sakan";

// ─── نصّ الميثاق — دالة نقية قابلة للاختبار ──────────────────────────────────

export interface CovenantCopy {
  title: string;
  intro: string;
  criteriaHeading: string;
  /** ثلاثة معايير — الأول بلا ضمير (مشترك)، والثاني والثالث مصرَّفان. */
  criteria: readonly [string, string, string];
  /** جملة واحدة: هذه معايير الآن، لا سقف العلاقة. */
  scopeLine: string;
  rightsHeading: string;
  /** ثلاثة إعلانات: الخصوصية عن الطرف الآخر، عدم تسجيل التوقف، حق الصمت. */
  rights: readonly [string, string, string];
  settingsNote: string;
  dismissLabel: string;
}

const WIFE_COPY: CovenantCopy = {
  title: "ميثاق سَكَن",
  intro: "سَكَن مساحة هادئة. ليس تطبيقًا طبيًا ولا جلسة علاجية.",
  criteriaHeading: "هنا ثلاثة أمور فقط:",
  criteria: [
    "أن يمرّ ما بينكما بلا ألم.",
    "أن تشعري بالأمان.",
    "أن ترغبي في الجلوس معًا مرة أخرى.",
  ],
  scopeLine: "هذه معايير هذه الأيام، لا سقف ما بينكما.",
  rightsHeading: "وثلاثة أمور لكِ:",
  rights: [
    "ما تكتبينه هنا لا يراه أحد سواكِ — مشفَّر على جهازكِ، ولا سبيل لأحد إليه.",
    "إن توقفتِ أو تجاوزتِ شيئًا، لا يُسجَّل ذلك ولا يُعلَّق عليه — لا في جهازكِ ولا في جهازه.",
    "لكِ أن تصمتي. لا سؤال هنا يستوجب جوابًا.",
  ],
  settingsNote: "يمكنكِ فتح هذه الصفحة متى شئتِ من الإعدادات.",
  dismissLabel: "حسنًا",
};

const HUSBAND_COPY: CovenantCopy = {
  title: "ميثاق سَكَن",
  intro: "سَكَن مساحة هادئة. ليس تطبيقًا طبيًا ولا جلسة علاجية.",
  criteriaHeading: "هنا ثلاثة أمور فقط:",
  criteria: [
    "أن يمرّ ما بينكما بلا ألم.",
    "أن تشعر بالأمان.",
    "أن ترغب في الجلوس معًا مرة أخرى.",
  ],
  scopeLine: "هذه معايير هذه الأيام، لا سقف ما بينكما.",
  rightsHeading: "وثلاثة أمور لك:",
  rights: [
    "ما تكتبه هنا لا يراه أحد سواك — مشفَّر على جهازك، ولا سبيل لأحد إليه.",
    "إن توقفت أو تجاوزت شيئًا، لا يُسجَّل ذلك ولا يُعلَّق عليه — لا في جهازك ولا في جهازها.",
    "لك أن تصمت. لا سؤال هنا يستوجب جوابًا.",
  ],
  settingsNote: "يمكنك فتح هذه الصفحة متى شئت من الإعدادات.",
  dismissLabel: "حسنًا",
};

/**
 * يُرجع نسخة الميثاق الخاصة بالدور.
 * دالة نقية — لا قراءة تخزين ولا حالة.
 */
export function covenantCopy(role: SakanRole): CovenantCopy {
  return role === "wife" ? WIFE_COPY : HUSBAND_COPY;
}

// ─── علم "قد عُرضت" — أول تشغيل ──────────────────────────────────────────────

/**
 * مفتاح localStorage محايد الاسم (لا يُفصح عن طبيعة التطبيق).
 * ليس بيانات حساسة — قيمة منطقية واحدة فقط.
 */
const SEEN_KEY = "s.c.v";

/** هل عُرضت شاشة الميثاق على هذا الجهاز من قبل؟ */
export function hasSeenCovenant(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // localStorage محجوب (وضع خاص) — تُعرض الشاشة في كل مرة، وهذا مقبول
    return false;
  }
}

/** يُعلّم أن الشاشة عُرضت. يُستدعى عند الخروج منها. */
export function markCovenantSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // تجاهُل صامت — لا شيء يعتمد على نجاح الكتابة
  }
}

// ─── المكوّن ──────────────────────────────────────────────────────────────────

interface Props {
  role: SakanRole;
  /** يُستدعى عند الضغط على زر الخروج الوحيد. */
  onDismiss: () => void;
  className?: string;
}

export default function SakanCovenantScreen({ role, onDismiss, className = "" }: Props) {
  const copy = covenantCopy(role);

  return (
    <div
      dir="rtl"
      className={`flex flex-col items-center min-h-screen px-6 py-12 gap-7 max-w-lg mx-auto ${className}`}
    >
      {/* ── العنوان ──────────────────────────────────────────────────────── */}
      <header className="text-center space-y-3 pt-2">
        <h1
          className="text-3xl font-bold leading-none select-none"
          style={{ color: "#6b7f78", fontFamily: "var(--font-cairo), serif" }}
        >
          {copy.title}
        </h1>
      </header>

      <div aria-hidden className="w-12 h-px bg-stone-300 rounded-full" />

      {/* ── التمهيد ──────────────────────────────────────────────────────── */}
      <p className="text-sm leading-relaxed text-stone-600 text-center">
        {copy.intro}
      </p>

      {/* ── المعايير ─────────────────────────────────────────────────────── */}
      <section
        className="w-full rounded-2xl p-6 border space-y-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(107,127,120,0.10) 0%, rgba(92,110,104,0.06) 100%)",
          borderColor: "rgba(107,127,120,0.25)",
        }}
      >
        <h2 className="text-sm font-semibold text-stone-700">
          {copy.criteriaHeading}
        </h2>

        <ul className="space-y-3">
          {copy.criteria.map((line) => (
            <li key={line} className="flex items-start gap-3">
              <span
                aria-hidden
                className="shrink-0 w-1.5 h-1.5 rounded-full mt-2"
                style={{ background: "#6b7f78" }}
              />
              <p className="text-base text-stone-800 leading-relaxed">{line}</p>
            </li>
          ))}
        </ul>

        {/* حدود المعايير — جملة واحدة */}
        <p className="text-sm text-stone-600 leading-relaxed pt-1 border-t border-stone-200/70 mt-4 pt-4">
          {copy.scopeLine}
        </p>
      </section>

      {/* ── الإعلانات الثلاثة ────────────────────────────────────────────── */}
      <section className="w-full space-y-4">
        <h2 className="text-sm font-semibold text-stone-700">
          {copy.rightsHeading}
        </h2>

        <ul className="space-y-3">
          {copy.rights.map((line) => (
            <li
              key={line}
              className="rounded-xl border border-stone-200 bg-white/70 px-4 py-3"
            >
              <p className="text-sm text-stone-700 leading-relaxed">{line}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── ملاحظة الإعدادات ─────────────────────────────────────────────── */}
      <p className="text-xs text-stone-400 text-center leading-relaxed max-w-xs">
        {copy.settingsNote}
      </p>

      {/* ── زر الخروج الوحيد — بلا شروط ولا بنود تُؤكَّد ─────────────────── */}
      <button
        type="button"
        onClick={onDismiss}
        className="w-full max-w-xs rounded-xl px-6 py-4 text-white font-semibold text-base shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 mb-6"
        style={{ background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)" }}
      >
        {copy.dismissLabel}
      </button>
    </div>
  );
}
