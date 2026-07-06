"use client";

import { useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import { computeMonthlyFinances, computeNationalMetrics } from "@/lib/economy";
import { formatGameDate, formatMillions, formatNetFlow } from "@/lib/format";

/** Top bar showing the global game state, plus the end-turn action. */
export default function GameHud() {
  const gameState = useGameStore((state) => state.gameState);
  const regions = useGameStore((state) => state.regions);
  const activeProjects = useGameStore((state) => state.activeProjects);
  const completedProjects = useGameStore((state) => state.completedProjects);
  const advanceTime = useGameStore((state) => state.advanceTime);
  const resetGame = useGameStore((state) => state.resetGame);

  const { net } = useMemo(
    () => computeMonthlyFinances(regions, activeProjects, completedProjects),
    [regions, activeProjects, completedProjects],
  );
  const national = useMemo(() => computeNationalMetrics(regions), [regions]);

  const inDebt = gameState.totalBudget < 0;

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="me-auto text-base font-semibold tracking-wide text-slate-100">
          محاكي تونس
        </h1>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-slate-500">التاريخ</span>
          <span className="text-sm font-semibold tabular-nums text-slate-100">
            {formatGameDate(gameState.currentDate)}
          </span>
        </div>
        <div id="hud-budget" className="flex items-baseline gap-2">
          <span className="text-xs text-slate-500">الميزانية العامة</span>
          <span
            className={`text-sm font-semibold tabular-nums ${
              inDebt ? "text-red-400" : "text-slate-100"
            }`}
          >
            {formatMillions(gameState.totalBudget, "TND")}
          </span>
          <span
            dir="ltr"
            title="صافي التدفق النقدي الشهري"
            className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
              net >= 0
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {formatNetFlow(net)}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-slate-500">العملة الصعبة</span>
          <span className="text-sm font-semibold tabular-nums text-slate-100">
            {formatMillions(gameState.hardCurrency, "USD")}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-slate-500">الناتج الوطني</span>
          <span className="text-sm font-semibold tabular-nums text-slate-100">
            {formatMillions(national.gdpAnnual, "TND")}
            <span className="text-xs font-normal text-slate-500"> سنويًا</span>
          </span>
        </div>
        <div
          className="flex items-baseline gap-2"
          title="مزيج التشغيل والتنمية والأمن، مخصومًا منه عقوبة التفاوت بين الساحل والداخل"
        >
          <span className="text-xs text-slate-500">الاستقرار</span>
          <span
            className={`text-sm font-bold tabular-nums ${
              national.stability >= 65
                ? "text-emerald-400"
                : national.stability >= 45
                  ? "text-amber-300"
                  : "text-red-400"
            }`}
          >
            {Math.round(national.stability)}/100
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("هل تريد بدء حملة جديدة؟ سيتم مسح كل التقدم الحالي.")) {
              resetGame();
            }
          }}
          className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/10"
        >
          بداية جديدة
        </button>
        <button
          type="button"
          onClick={advanceTime}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/50 transition-colors hover:bg-emerald-500 active:bg-emerald-700"
        >
          الشهر التالي
        </button>
      </div>
    </header>
  );
}
