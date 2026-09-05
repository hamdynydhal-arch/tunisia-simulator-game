"use client";

/**
 * Sakan (سَكَن) — Main onboarding page
 *
 * A client-side step wizard:
 *   Step 0 — Role selection (husband / wife)
 *   Step 1 — ميثاق سَكَن            (SakanCovenantScreen) — شاشة واحدة
 *   Step 2 — أسئلة أسبوع صفر        (WeekZeroForm)
 *   Step 3 — Completion state
 *
 * Architectural rules enforced here:
 * - Role is chosen BEFORE any content is shown — the wrong form is never rendered.
 * - Answers are held only in memory (AnswerMap); no persistence in Phase 1.
 * - The covenant screen is shown once on first run (localStorage flag), and stays
 *   re-openable at any time from the settings entry — it never gates progress.
 */

import { useReducer, useTransition, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SakanRole, SakanStep, AnswerMap } from "@/types/sakan";
import {
  readRole,
  writeRole,
  hasCompletedWeekZero,
  markWeekZeroComplete,
  dailyPathFor,
} from "@/lib/sakan/session";
import WeekZeroForm from "@/components/sakan/WeekZeroForm";
import SakanCovenantScreen, {
  hasSeenCovenant,
  markCovenantSeen,
} from "@/components/sakan/SakanCovenantScreen";

// ─── State machine ────────────────────────────────────────────────────────────

interface State {
  step: SakanStep | "complete";
  role: SakanRole | null;
  answers: AnswerMap;
  /** True while the covenant is re-opened from the settings entry. */
  covenantReopened: boolean;
}

type Action =
  | { type: "SELECT_ROLE"; role: SakanRole }
  | { type: "DISMISS_COVENANT" }
  | { type: "COMPLETE_FORM"; answers: AnswerMap }
  | { type: "OPEN_COVENANT" }
  | { type: "CLOSE_REOPENED_COVENANT" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SELECT_ROLE":
      // الدور يُحفظ على هذا الجهاز وحده — لا يُزامَن ولا يظهر للطرف الآخر
      writeRole(action.role);
      // شاشة الميثاق تُعرض مرة عند أول تشغيل فقط
      return {
        ...state,
        role: action.role,
        step: hasSeenCovenant() ? "week-zero" : "covenant",
      };
    case "DISMISS_COVENANT":
      markCovenantSeen();
      return { ...state, step: "week-zero" };
    case "COMPLETE_FORM":
      markWeekZeroComplete();
      return { ...state, answers: action.answers, step: "complete" };
    case "OPEN_COVENANT":
      return { ...state, covenantReopened: true };
    case "CLOSE_REOPENED_COVENANT":
      return { ...state, covenantReopened: false };
    default:
      return state;
  }
}

const initialState: State = {
  step: "role-select",
  role: null,
  answers: {},
  covenantReopened: false,
};

// ─── Role selection screen ────────────────────────────────────────────────────

function RoleSelectScreen({
  onSelect,
}: {
  onSelect: (role: SakanRole) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-10 max-w-sm mx-auto">
      {/* Brand mark */}
      <div className="text-center space-y-2">
        <div
          className="text-7xl font-bold leading-none select-none"
          style={{ color: "#6b7f78", fontFamily: "var(--font-cairo), serif" }}
        >
          سَكَن
        </div>
        <p className="text-sm text-stone-400 tracking-widest uppercase font-medium">
          مساحتك الآمنة
        </p>
      </div>

      {/* Role prompt */}
      <div className="text-center space-y-2">
        <p className="text-base font-semibold text-stone-700">
          قبل أن نبدأ، أخبرنا:
        </p>
        <p className="text-sm text-stone-500">
          كلٌّ منكما يستخدم التطبيق بشكل منفصل وخاص.
        </p>
      </div>

      {/* Role buttons */}
      <div className="flex flex-col gap-4 w-full">
        <RoleButton
          role="wife"
          label="الزوجة"
          description="مساحتك الخاصة والسرية"
          emoji="🌸"
          onSelect={onSelect}
        />
        <RoleButton
          role="husband"
          label="الزوج"
          description="مساحتك الخاصة والسرية"
          emoji="🌿"
          onSelect={onSelect}
        />
      </div>

      {/* Privacy micro-assurance */}
      <p className="text-xs text-stone-400 text-center max-w-xs leading-relaxed">
        🔒 لا يمكن لأي طرف رؤية ما يختاره الطرف الآخر. كل واجهة مشفّرة
        ومستقلة تمامًا.
      </p>
    </div>
  );
}

function RoleButton({
  role,
  label,
  description,
  emoji,
  onSelect,
}: {
  role: SakanRole;
  label: string;
  description: string;
  emoji: string;
  onSelect: (r: SakanRole) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(role)}
      className="flex items-center gap-4 w-full rounded-2xl p-5 bg-white/70 backdrop-blur-sm border border-stone-200 shadow-sm hover:shadow-md hover:bg-white/90 transition-all duration-200 text-right active:scale-98 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50"
    >
      <span className="text-3xl shrink-0" aria-hidden>
        {emoji}
      </span>
      <div className="flex flex-col">
        <span className="text-base font-bold text-stone-800">{label}</span>
        <span className="text-xs text-stone-500">{description}</span>
      </div>
      {/* Arrow (flipped for RTL) */}
      <svg
        className="mr-auto shrink-0 text-stone-300"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
      >
        <path
          d="M10 3L5 8l5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ─── Completion screen ────────────────────────────────────────────────────────

/**
 * ملاحظة: النص هنا كان يقتبس الميثاق القديم حرفياً ("النجاح هو…") ويستعمل
 * "مرحلة" و"المراحل القادمة". حُدِّث ليطابق لغة الميثاق الجديد بعد حذف
 * SakanCovenant.tsx — وإلا بقي اقتباس ليتيم بلغة ممنوعة.
 */
function CompletionScreen({
  role,
  onOpenCovenant,
}: {
  role: SakanRole | null;
  onOpenCovenant: () => void;
}) {
  const router = useRouter();
  const dailyPath = role ? dailyPathFor(role) : null;

  // الانتقال إلى المسار اليومي بعد لحظة قصيرة تكفي لقراءة الشكر.
  // الرابط أدناه يبقى ظاهراً حتى لا يعتمد التنقّل على المؤقّت وحده.
  useEffect(() => {
    if (!dailyPath) return;
    const t = setTimeout(() => router.replace(dailyPath), 2200);
    return () => clearTimeout(t);
  }, [dailyPath, router]);

  const isWife = role === "wife";
  const thanks = isWife ? "شكرًا لكِ" : "شكرًا لك";
  const body = isWife
    ? "ما كتبتِه محفوظ على جهازكِ وحده."
    : "ما كتبته محفوظ على جهازك وحده.";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-8 max-w-sm mx-auto text-center" dir="rtl">
      <div className="text-6xl" aria-hidden>🌿</div>
      <h1 className="text-xl font-bold text-stone-800">{thanks}</h1>
      <p className="text-sm text-stone-600 leading-relaxed">{body}</p>

      <div
        className="rounded-2xl p-6 border w-full"
        style={{
          background:
            "linear-gradient(135deg, rgba(107,127,120,0.1) 0%, rgba(92,110,104,0.06) 100%)",
          borderColor: "rgba(107,127,120,0.25)",
        }}
      >
        <p className="text-sm text-stone-600 leading-relaxed">
          هذه معايير هذه الأيام، لا سقف ما بينكما.
        </p>
      </div>

      {/* الانتقال إلى المسار اليومي — لا تنتهي الرحلة هنا */}
      {dailyPath && (
        <Link
          href={dailyPath}
          className="w-full rounded-xl py-3 px-6 text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2"
          style={{ background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)" }}
        >
          المتابعة
        </Link>
      )}

      {/* مدخل الإعدادات الدائم إلى الميثاق */}
      <button
        type="button"
        onClick={onOpenCovenant}
        className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-4 transition-colors"
      >
        فتح ميثاق سَكَن
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SakanPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [, startTransition] = useTransition();
  const router = useRouter();

  /**
   * التخزين المحلي لا يُقرأ أثناء التصيير الثابت، فيُؤجَّل الفحص إلى ما بعد
   * الترطيب. `resolved` يمنع وميض شاشة اختيار الدور لمن أتمّ أسبوع صفر.
   */
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const role = readRole();
    if (role && hasCompletedWeekZero()) {
      // أتمّ أسبوع صفر سابقاً — إلى مساره اليومي مباشرة،
      // لا إلى اختيار الدور ولا إلى الاستبيان من جديد
      router.replace(dailyPathFor(role));
      return;
    }
    // بوّابة ترطيب لمرّة واحدة: التخزين المحلي غير متاح أثناء التصيير الثابت،
    // فلا سبيل لحسم الوجهة قبل الترطيب. البديل — التصيير ثم إعادة التوجيه —
    // يجعل من أتمّ أسبوع صفر يلمح شاشة اختيار الدور، وهو ما يمنعه المطلوب.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolved(true);
  }, [router]);

  function advance(action: Action) {
    startTransition(() => dispatch(action));
  }

  // ريثما يُحسم مصير الجلسة لا تُعرض أي شاشة
  if (!resolved) {
    return <div className="min-h-screen" aria-hidden />;
  }

  // الميثاق المُعاد فتحه من الإعدادات يعلو على أي شاشة أخرى
  if (state.covenantReopened && state.role) {
    return (
      <SakanCovenantScreen
        role={state.role}
        onDismiss={() => advance({ type: "CLOSE_REOPENED_COVENANT" })}
      />
    );
  }

  return (
    <>
      {state.step === "role-select" && (
        <RoleSelectScreen
          onSelect={(role) => advance({ type: "SELECT_ROLE", role })}
        />
      )}

      {state.step === "covenant" && state.role && (
        <SakanCovenantScreen
          role={state.role}
          onDismiss={() => advance({ type: "DISMISS_COVENANT" })}
        />
      )}

      {state.step === "week-zero" && state.role && (
        <WeekZeroForm
          role={state.role}
          onComplete={(answers) =>
            advance({ type: "COMPLETE_FORM", answers })
          }
        />
      )}

      {state.step === "complete" && (
        <CompletionScreen
          role={state.role}
          onOpenCovenant={() => advance({ type: "OPEN_COVENANT" })}
        />
      )}
    </>
  );
}
