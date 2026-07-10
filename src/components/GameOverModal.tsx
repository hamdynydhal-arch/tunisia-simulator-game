"use client";

import { useGameStore } from "@/store/gameStore";

/**
 * Terminal, unclosable overlay for the sustained-collapse endgame (three
 * consecutive months of national stability under 25) — distinct from the
 * instant `OutcomeScreen` collapse. No backdrop dismiss, no acknowledge
 * button: the only way out is a hard reload.
 */
export default function GameOverModal() {
  const isGameOver = useGameStore((state) => state.gameState.isGameOver);

  if (!isGameOver) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/95 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="نهاية اللعبة"
        className="w-full max-w-xl animate-slide-in-down rounded-2xl border-2 border-red-600/60 bg-slate-900 p-8 text-center shadow-2xl"
      >
        <div className="text-5xl">💀</div>
        <h1 className="mt-4 text-3xl font-bold text-red-400">
          نهاية اللعبة - سقوط النظام
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          انهارت مؤسسات الدولة بسبب تدني الاستقرار.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-500"
        >
          إعادة بناء الدولة
        </button>
      </div>
    </div>
  );
}
