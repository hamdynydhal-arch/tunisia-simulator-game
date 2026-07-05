"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { formatNetFlow } from "@/lib/format";

/**
 * Announcement banner for the world event of the current month.
 * Dismissal is keyed to the month, so a new month's event always reappears.
 */
export default function EventToast() {
  const currentEvent = useGameStore(
    (state) => state.gameState.currentEvent ?? null,
  );
  const currentDate = useGameStore((state) => state.gameState.currentDate);
  const [dismissedDate, setDismissedDate] = useState<string | null>(null);

  if (!currentEvent || dismissedDate === currentDate) {
    return null;
  }

  const positive = currentEvent.effects.budgetChange >= 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 top-16 z-30 mx-auto max-w-md animate-slide-in-down rounded-xl border border-slate-600 bg-slate-900/95 p-4 shadow-2xl backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-bold text-sky-300">
            حدث عالمي
          </span>
          <h3 className="text-base font-bold text-slate-100">
            {currentEvent.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setDismissedDate(currentDate)}
          aria-label="إغلاق التنبيه"
          className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M4.3 4.3a1 1 0 0 1 1.4 0L10 8.6l4.3-4.3a1 1 0 1 1 1.4 1.4L11.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 0 1-1.4-1.4L8.6 10 4.3 5.7a1 1 0 0 1 0-1.4Z" />
          </svg>
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        {currentEvent.description}
      </p>
      <p
        dir="ltr"
        className={`mt-3 inline-block rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums ${
          positive
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-red-500/10 text-red-400"
        }`}
      >
        {formatNetFlow(currentEvent.effects.budgetChange)}
      </p>
    </div>
  );
}
