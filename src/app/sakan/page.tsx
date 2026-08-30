"use client";

/**
 * Sakan (سَكَن) — Main onboarding page
 *
 * A client-side step wizard that orchestrates the three MVP Phase 1 screens:
 *   Step 0 — Role selection (husband / wife)
 *   Step 1 — تمهيد الميثاق القصير  (CovenantIntro)
 *   Step 2 — أسئلة أسبوع صفر       (WeekZeroForm)
 *   Step 3 — ميثاق سكن الكامل      (SakanCovenant)
 *   Step 4 — Completion state
 *
 * Architectural rules enforced here:
 * - Role is chosen BEFORE any content is shown — the wrong form is never rendered.
 * - Answers are held only in memory (AnswerMap); no persistence in Phase 1.
 * - Transition animations use CSS opacity + translate for a calm, unhurried feel.
 */

import { useReducer, useTransition } from "react";
import type { SakanRole, SakanStep, AnswerMap } from "@/types/sakan";
import CovenantIntro from "@/components/sakan/CovenantIntro";
import WeekZeroForm from "@/components/sakan/WeekZeroForm";
import SakanCovenant from "@/components/sakan/SakanCovenant";

// ─── State machine ────────────────────────────────────────────────────────────

interface State {
  step: SakanStep | "complete";
  role: SakanRole | null;
  answers: AnswerMap;
}

type Action =
  | { type: "SELECT_ROLE"; role: SakanRole }
  | { type: "NEXT_FROM_INTRO" }
  | { type: "COMPLETE_FORM"; answers: AnswerMap }
  | { type: "AGREE_COVENANT" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SELECT_ROLE":
      return { ...state, role: action.role, step: "covenant-intro" };
    case "NEXT_FROM_INTRO":
      return { ...state, step: "week-zero" };
    case "COMPLETE_FORM":
      return { ...state, answers: action.answers, step: "full-covenant" };
    case "AGREE_COVENANT":
      return { ...state, step: "complete" };
    default:
      return state;
  }
}

const initialState: State = {
  step: "role-select",
  role: null,
  answers: {},
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

function CompletionScreen({ role }: { role: SakanRole | null }) {
  const pronoun = role === "wife" ? "كِ" : "كَ";
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-8 max-w-sm mx-auto text-center">
      <div className="text-6xl">🌿</div>
      <h1 className="text-xl font-bold text-stone-800">شكرًا ل{pronoun}</h1>
      <p className="text-sm text-stone-600 leading-relaxed">
        لقد أكملتَ مرحلة الأسبوع الصفر. إجاباتُ{pronoun} محفوظة وآمنة. سيواصل
        سَكَن رفقتَ{pronoun} في المراحل القادمة.
      </p>
      <div
        className="rounded-2xl p-6 border w-full"
        style={{
          background:
            "linear-gradient(135deg, rgba(107,127,120,0.1) 0%, rgba(92,110,104,0.06) 100%)",
          borderColor: "rgba(107,127,120,0.25)",
        }}
      >
        <p className="text-sm text-stone-700 font-semibold mb-2">
          تذكُّر الميثاق:
        </p>
        <p className="text-sm text-stone-600 leading-relaxed italic">
          "النجاح هو الانتهاء من جلسة دون ألم، والشعور بالأمان، والرغبة في
          الجلوس معًا مرة أخرى."
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SakanPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [, startTransition] = useTransition();

  function advance(action: Action) {
    startTransition(() => dispatch(action));
  }

  return (
    <>
      {state.step === "role-select" && (
        <RoleSelectScreen
          onSelect={(role) => advance({ type: "SELECT_ROLE", role })}
        />
      )}

      {state.step === "covenant-intro" && state.role && (
        <CovenantIntro
          role={state.role}
          onContinue={() => advance({ type: "NEXT_FROM_INTRO" })}
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

      {state.step === "full-covenant" && state.role && (
        <SakanCovenant
          role={state.role}
          onAgree={() => advance({ type: "AGREE_COVENANT" })}
        />
      )}

      {state.step === "complete" && <CompletionScreen role={state.role} />}
    </>
  );
}
