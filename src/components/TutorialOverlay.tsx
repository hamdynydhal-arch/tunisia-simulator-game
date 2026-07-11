"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";

interface TutorialStep {
  message: string;
  buttonLabel: string;
  position: string;
}

const STEPS: readonly TutorialStep[] = [
  {
    message: "مرحباً بك في قصر قرطاج. مهمتك إنقاذ الجمهورية.",
    buttonLabel: "التالي",
    position: "fixed left-1/2 top-1/2 w-[min(90vw,22rem)] -translate-x-1/2 -translate-y-1/2",
  },
  {
    message: "هذا شريط المؤشرات. راقب الميزانية والعملة الصعبة بعناية.",
    buttonLabel: "التالي",
    position: "fixed left-4 top-20 w-[min(90vw,20rem)]",
  },
  {
    message: "جرس الإنذار 🚨. هنا تدير الأزمات والإضرابات وطنياً.",
    buttonLabel: "التالي",
    position: "fixed right-4 top-20 w-[min(90vw,20rem)]",
  },
  {
    message: "غرفة العمليات. من هنا تقترض، تفاوض النقابات، وتدير البنك المركزي.",
    buttonLabel: "ابدأ الحكم!",
    position: "fixed bottom-6 left-1/2 w-[min(90vw,22rem)] -translate-x-1/2",
  },
];

/**
 * Lightweight bubble onboarding: four coach-mark tooltips walking a
 * brand-new president through the HUD, crisis alarm, and command room.
 * Unlike the full-screen modals, this does NOT dim or block the rest of the
 * UI (`pointer-events-none` on the wrapper, `pointer-events-auto` on each
 * bubble) — it's a light overlay, not a gate.
 */
export default function TutorialOverlay() {
  const gameStarted = useGameStore((state) => state.gameState.gameStarted);
  const hasCompletedTutorial = useGameStore(
    (state) => state.gameState.hasCompletedTutorial,
  );
  const completeTutorial = useGameStore((state) => state.completeTutorial);
  const [tutorialStep, setTutorialStep] = useState(0);

  if (!gameStarted || hasCompletedTutorial) {
    return null;
  }

  const step = STEPS[tutorialStep];
  const isLastStep = tutorialStep === STEPS.length - 1;

  const advance = () => {
    if (isLastStep) {
      completeTutorial();
      return;
    }
    setTutorialStep((current) => current + 1);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div
        role="dialog"
        aria-label="جولة تعريفية"
        className={`${step.position} pointer-events-auto animate-slide-in-down rounded-xl border-2 border-sky-400/60 bg-slate-900/95 p-4 shadow-[0_0_25px_rgba(56,189,248,0.5)] backdrop-blur-md`}
      >
        <p className="text-sm leading-relaxed text-slate-100">{step.message}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] tabular-nums text-slate-500">
            {tutorialStep + 1}/{STEPS.length}
          </span>
          <button
            type="button"
            onClick={advance}
            className="rounded-lg bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-1.5 text-xs font-bold text-white shadow shadow-sky-950/40 ring-1 ring-sky-500/30 transition-all hover:from-sky-500 hover:to-sky-700"
          >
            {step.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
