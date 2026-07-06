"use client";

import { useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import { computeNationalMetrics } from "@/lib/economy";
import { formatGameDate, formatMillions } from "@/lib/format";

/**
 * Terminal screen: regime collapse or the golden era. Covers everything;
 * the only way forward is a new campaign.
 */
export default function OutcomeScreen() {
  const outcome = useGameStore((state) => state.gameState.outcome);
  const outcomeReason = useGameStore((state) => state.gameState.outcomeReason);
  const gameState = useGameStore((state) => state.gameState);
  const regions = useGameStore((state) => state.regions);
  const completedProjects = useGameStore((state) => state.completedProjects);
  const resetGame = useGameStore((state) => state.resetGame);

  const metrics = useMemo(() => computeNationalMetrics(regions), [regions]);

  if (!outcome) {
    return null;
  }

  const victory = outcome === "victory";
  const stats = [
    { label: "نهاية العهدة", value: formatGameDate(gameState.currentDate) },
    { label: "الاستقرار الوطني", value: `${Math.round(metrics.stability)}/100` },
    { label: "التنمية الوطنية", value: `${Math.round(metrics.avgDevelopment)}/100` },
    { label: "البطالة الوطنية", value: `${metrics.avgUnemployment.toFixed(1)}٪` },
    { label: "الميزانية النهائية", value: formatMillions(gameState.totalBudget, "TND") },
    { label: "مشاريع منجزة", value: `${completedProjects.length}` },
  ];

  return (
    <div
      className={`fixed inset-0 z-[70] grid place-items-center overflow-y-auto p-4 ${
        victory
          ? "bg-gradient-to-b from-emerald-950/95 via-slate-950/95 to-slate-950/95"
          : "bg-gradient-to-b from-red-950/95 via-slate-950/95 to-slate-950/95"
      } backdrop-blur`}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full max-w-xl animate-slide-in-down rounded-2xl border-2 bg-slate-900/90 p-8 text-center shadow-2xl ${
          victory ? "border-amber-400/60" : "border-red-600/60"
        }`}
      >
        <div className="text-5xl">{victory ? "🏆" : "🏚️"}</div>
        <h1
          className={`mt-4 text-3xl font-bold ${
            victory ? "text-amber-300" : "text-red-300"
          }`}
        >
          {victory ? "العصر الذهبي" : "سقوط الجمهورية"}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          {outcomeReason}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-700 bg-slate-800/50 p-3"
            >
              <div className="text-xs text-slate-400">{stat.label}</div>
              <div className="mt-1 text-sm font-bold tabular-nums text-slate-100">
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={resetGame}
          className={`mt-8 w-full rounded-lg px-4 py-3 text-sm font-bold text-white transition-colors ${
            victory
              ? "bg-emerald-600 hover:bg-emerald-500"
              : "bg-red-600 hover:bg-red-500"
          }`}
        >
          بداية حملة جديدة
        </button>
      </div>
    </div>
  );
}
