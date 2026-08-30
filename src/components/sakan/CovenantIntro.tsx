"use client";

/**
 * Screen 1 — تمهيد الميثاق القصير
 *
 * A single reassuring screen displayed before any questions are asked.
 * Explains: what the app is, who sees the answers (E2EE in plain Arabic),
 * and the user's absolute right NOT to answer any question.
 */

import type { SakanRole } from "@/types/sakan";

interface Props {
  role: SakanRole;
  onContinue: () => void;
}

// Pronoun helpers
const r = {
  subject:  { wife: "كِ",     husband: "كَ"    },
  possess:  { wife: "كِ",     husband: "كَ"    },
  adj_f:    { wife: "كِ",     husband: "كَ"    },
  button:   { wife: "مستعدة، لنبدأ", husband: "مستعد، لنبدأ" },
  you_pl_verb: { wife: "تكتبينه", husband: "تكتبه" },
  you_want:    { wife: "تريدين", husband: "تريد"  },
} as const;

function t(key: keyof typeof r, role: SakanRole): string {
  return r[key][role];
}

export default function CovenantIntro({ role, onContinue }: Props) {
  return (
    <div className="flex flex-col items-center justify-start min-h-screen px-6 py-12 gap-8 max-w-lg mx-auto">

      {/* ── App identity ──────────────────────────────────────────────── */}
      <div className="text-center space-y-3 pt-4">
        {/* Arabic calligraphic mark */}
        <div
          aria-hidden
          className="text-6xl font-bold leading-none select-none"
          style={{ color: "#6b7f78", fontFamily: "var(--font-cairo), serif" }}
        >
          سَكَن
        </div>
        <p className="text-sm tracking-widest uppercase text-stone-400 font-medium">
          مساحتك الآمنة
        </p>
      </div>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div className="w-16 h-px bg-stone-300 rounded-full" />

      {/* ── What is Sakan ─────────────────────────────────────────────── */}
      <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-stone-200 w-full space-y-3">
        <h2 className="text-base font-semibold text-stone-700 flex items-center gap-2">
          <span aria-hidden className="text-lg">🌿</span>
          ما هو سَكَن؟
        </h2>
        <p className="text-sm leading-relaxed text-stone-600">
          سَكَن هو رفيق{t("possess", role)} الخاص في رحلة إعادة بناء الألفة
          والاطمئنان. ليس تطبيقًا طبيًا، وليس جلسة علاجية. هو مساحة هادئة
          تساعدكما على فهم ما يحتاجه كل منكما — دون ضغط، ودون حكم.
        </p>
      </section>

      {/* ── Privacy & E2EE ────────────────────────────────────────────── */}
      <section className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-stone-200 w-full space-y-3">
        <h2 className="text-base font-semibold text-stone-700 flex items-center gap-2">
          <span aria-hidden className="text-lg">🔒</span>
          من يرى إجاباتك؟ لا أحد سوا{t("possess", role)}.
        </h2>
        <p className="text-sm leading-relaxed text-stone-600">
          ما {t("you_pl_verb", role)} هنا <strong>مشفَّر تمامًا</strong> على
          جهاز{t("possess", role)} قبل أن يُخزَّن. المفتاح الوحيد لفكّ هذا
          التشفير موجود على جهاز{t("possess", role)} فقط — حتى نحن لا نستطيع
          الاطلاع عليه.
        </p>
        <ul className="text-sm text-stone-600 space-y-2 mt-1">
          <li className="flex items-start gap-2">
            <span aria-hidden className="text-green-500 mt-0.5 shrink-0">✓</span>
            شريك{t("possess", role)} لا يرى إجاباتك، ولا الأسئلة التي
            أجبتَ عنها.
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="text-green-500 mt-0.5 shrink-0">✓</span>
            لا يُشارَك أي شيء إلا ما تختار{t("possess", role)} أنتَ
            مشاركته بشكل صريح.
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="text-green-500 mt-0.5 shrink-0">✓</span>
            حتى الفريق التقني لا يملك أي وصول إلى محتوى إجاباتك.
          </li>
        </ul>
      </section>

      {/* ── Right to skip ─────────────────────────────────────────────── */}
      <section className="bg-amber-50/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-amber-200 w-full space-y-2">
        <h2 className="text-base font-semibold text-amber-800 flex items-center gap-2">
          <span aria-hidden className="text-lg">🕊️</span>
          حق{t("possess", role)} في التوقف
        </h2>
        <p className="text-sm leading-relaxed text-amber-700">
          لك الحق الكامل في <strong>تجاوز أي سؤال</strong> لا{" "}
          {t("you_want", role)} الإجابة عنه، في أي وقت، دون تفسير أو مبرر.
          لا يوجد سؤال إلزامي في سَكَن.
        </p>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <button
        onClick={onContinue}
        className="w-full max-w-xs rounded-xl px-6 py-4 text-white font-semibold text-base shadow-md transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)",
        }}
        aria-label="المتابعة إلى الأسئلة"
      >
        أنا {t("button", role)}
      </button>

      {/* ── Footer note ───────────────────────────────────────────────── */}
      <p className="text-xs text-stone-400 text-center pb-4 max-w-xs leading-relaxed">
        باستمرارك، أنت توافق على أن هذه المساحة مخصصة للتأمل والنمو
        الشخصي وليست بديلًا عن الرعاية الصحية المتخصصة.
      </p>
    </div>
  );
}
