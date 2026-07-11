"use client";

import { useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import { computeMonthlyFinances, computeNationalMetrics } from "@/lib/economy";
import { formatGameDate, formatMillions, formatNetFlow } from "@/lib/format";
import type { Difficulty } from "@/types/game";

const DIFFICULTY_BADGE: Record<
  Difficulty,
  { label: string; className: string }
> = {
  easy: {
    label: "مسار شعبوي",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
  normal: {
    label: "حكومة تكنوقراط",
    className: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  },
  hard: {
    label: "رجل دولة",
    className: "border-red-500/40 bg-red-500/15 text-red-300",
  },
};

/** Top bar showing the global game state, plus the end-turn action. */
export default function GameHud() {
  const gameState = useGameStore((state) => state.gameState);
  const regions = useGameStore((state) => state.regions);
  const activeProjects = useGameStore((state) => state.activeProjects);
  const completedProjects = useGameStore((state) => state.completedProjects);
  const advanceTime = useGameStore((state) => state.advanceTime);
  const resetGame = useGameStore((state) => state.resetGame);
  const timeRunning = useGameStore((state) => state.timeRunning);
  const timeSpeed = useGameStore((state) => state.timeSpeed);
  const toggleTimeRunning = useGameStore((state) => state.toggleTimeRunning);
  const setTimeSpeed = useGameStore((state) => state.setTimeSpeed);
  const toggleDashboard = useGameStore((state) => state.toggleDashboard);
  const toggleCrisisCenter = useGameStore((state) => state.toggleCrisisCenter);

  const totalCrises = useMemo(
    () =>
      Object.values(regions).filter(
        (region) =>
          region.isStriking ||
          region.activeHarka ||
          region.activeInfiltration ||
          region.shadowEconomyLevel > 50,
      ).length,
    [regions],
  );

  const { net, hardCurrencyNet } = useMemo(
    () => computeMonthlyFinances(regions, activeProjects, completedProjects),
    [regions, activeProjects, completedProjects],
  );
  const national = useMemo(() => computeNationalMetrics(regions), [regions]);
  const paused = Boolean(
    gameState.politicalEvent ||
      gameState.outcome ||
      gameState.isGameOver ||
      !gameState.gameStarted,
  );

  const inDebt = gameState.totalBudget < 0;
  const monthsToCollapse = 3 - gameState.criticalStabilityMonths;

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      {gameState.criticalStabilityMonths > 0 && !gameState.isGameOver && (
        <div className="animate-pulse bg-red-600 px-4 py-1.5 text-center text-sm font-bold text-white">
          🚨 تحذير سيادي: النظام مهدد بالسقوط خلال {monthsToCollapse} شهر!
        </div>
      )}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div className="me-auto flex items-center gap-3">
          {gameState.playerName || gameState.partyName ? (
            <>
              {gameState.presidentAvatar ? (
                <img
                  src={gameState.presidentAvatar}
                  alt={gameState.playerName}
                  className="h-14 w-14 rounded-full border-2 border-slate-400 object-cover"
                />
              ) : (
                <div
                  role="img"
                  aria-label="لا توجد صورة للرئيس"
                  className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-400 bg-slate-800 text-2xl"
                >
                  👤
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-semibold tracking-wide text-slate-100">
                    الرئيس: {gameState.playerName}
                    {gameState.partyName && ` | ${gameState.partyName}`}
                  </h1>
                  <span
                    title="مستوى الصعوبة المختار عند التنصيب"
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${DIFFICULTY_BADGE[gameState.difficulty].className}`}
                  >
                    {DIFFICULTY_BADGE[gameState.difficulty].label}
                  </span>
                </div>
                {gameState.slogan && (
                  <p className="text-xs italic text-slate-500">
                    {gameState.philosophySymbol} {gameState.slogan}
                  </p>
                )}
              </div>
            </>
          ) : (
            <h1 className="text-base font-semibold tracking-wide text-slate-100">
              محاكي تونس
            </h1>
          )}
        </div>
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
              inDebt
                ? "text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                : "text-slate-100 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]"
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
        <div
          className="flex items-baseline gap-2"
          title="الدين السيادي المتراكم — يرتفع فقط، عبر القروض الطارئة"
        >
          <span className="text-xs text-slate-500">الدين السيادي</span>
          <span className="text-sm font-semibold tabular-nums text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
            {formatMillions(gameState.sovereignDebt, "TND")}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-slate-500">العملة الصعبة</span>
          <span
            className={`text-sm font-semibold tabular-nums ${
              gameState.hardCurrency < 0 ? "text-red-400" : "text-slate-100"
            }`}
          >
            {formatMillions(gameState.hardCurrency, "USD")}
          </span>
          <span
            dir="ltr"
            title="صافي تدفق العملة الصعبة الشهري (الصادرات ناقص الصيانة)"
            className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
              hardCurrencyNet >= 0
                ? "bg-sky-500/10 text-sky-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {formatNetFlow(hardCurrencyNet, "USD")}
          </span>
        </div>
        <div
          className="flex items-baseline gap-2"
          title="المستوى التكنولوجي الوطني — تراكم نقاط العلوم من الجامعات والأقطاب التكنولوجية"
        >
          <span className="text-xs text-slate-500">🔬 التكنولوجيا</span>
          <span className="text-sm font-bold tabular-nums text-violet-300">
            {Math.round(gameState.techLevel)}
          </span>
        </div>
        <div
          className="flex items-baseline gap-2"
          title="رضا المواطنين — معدّل وطني مرجّح بعدد سكان كل ولاية"
        >
          <span className="text-xs text-slate-500">🙂 الرضا</span>
          <span
            className={`text-sm font-bold tabular-nums ${
              national.nationalSatisfaction >= 55
                ? "text-emerald-400"
                : national.nationalSatisfaction >= 40
                  ? "text-amber-300"
                  : "text-red-400"
            }`}
          >
            {Math.round(national.nationalSatisfaction)}/100
          </span>
        </div>
        <div
          className="flex items-baseline gap-2"
          title="الانتماء الوطني — معدّل وطني مرجّح بعدد سكان كل ولاية"
        >
          <span className="text-xs text-slate-500">🇹🇳 الانتماء</span>
          <span
            className={`text-sm font-bold tabular-nums ${
              national.overallNationalBelonging >= 60
                ? "text-emerald-400"
                : national.overallNationalBelonging >= 40
                  ? "text-amber-300"
                  : "text-red-400"
            }`}
          >
            {Math.round(national.overallNationalBelonging)}/100
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
          onClick={toggleCrisisCenter}
          aria-label="المركز الوطني لإدارة الأزمات"
          title={
            totalCrises > 0
              ? `${totalCrises} ولاية في أزمة — المركز الوطني لإدارة الأزمات`
              : "المركز الوطني لإدارة الأزمات"
          }
          className={`relative rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
            totalCrises > 0
              ? "animate-pulse border-red-500 bg-red-600/20 text-red-300 hover:bg-red-600/30"
              : "border-slate-600 hover:bg-slate-800"
          }`}
        >
          🚨
          {totalCrises > 0 && (
            <span className="absolute -top-1.5 -end-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {totalCrises}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={toggleDashboard}
          aria-label="لوحة التحليلات الوطنية"
          title="لوحة التحليلات الوطنية"
          className="rounded-md border border-slate-600 px-2.5 py-1.5 text-sm transition-colors hover:bg-slate-800"
        >
          📊
        </button>
        <div
          className="flex items-center gap-1 rounded-md border border-slate-700 p-0.5"
          role="group"
          aria-label="سرعة الزمن"
        >
          <button
            type="button"
            onClick={toggleTimeRunning}
            disabled={paused}
            aria-label={timeRunning ? "إيقاف الزمن" : "تشغيل الزمن"}
            title={timeRunning ? "إيقاف الزمن" : "تشغيل الزمن"}
            className={`rounded px-2.5 py-1 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:text-slate-600 ${
              timeRunning
                ? "bg-emerald-600 text-white"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {timeRunning ? "⏸" : "▶"}
          </button>
          {([1, 2, 3] as const).map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => setTimeSpeed(speed)}
              aria-pressed={timeSpeed === speed}
              className={`rounded px-2 py-1 text-xs font-bold tabular-nums transition-colors ${
                timeSpeed === speed
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-500 hover:bg-slate-800"
              }`}
            >
              {speed}×
            </button>
          ))}
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
          disabled={paused || timeRunning}
          title={paused ? "يجب مراجعة الحدث السياسي أولًا" : undefined}
          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/50 transition-colors hover:bg-emerald-500 active:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          الشهر التالي
        </button>
      </div>
    </header>
  );
}
