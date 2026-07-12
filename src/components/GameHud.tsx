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

/** Shared shell for the Resource Ribbon's pill badges (Row 2 of the Top
 *  Command Bar) — each metric supplies only its own icon/value/color. */
function Pill({
  id,
  title,
  children,
}: {
  id?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      title={title}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-xs shadow-sm shadow-black/20 md:shrink"
    >
      {children}
    </div>
  );
}

/**
 * Top Command Bar (Identity row + swipeable/wrapping Resource Ribbon) plus a
 * bottom-floating Action Cluster overlaying the map — a mobile thumb-zone
 * dock that becomes a centered desktop dock at `md:`.
 */
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
    <>
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        {gameState.criticalStabilityMonths > 0 && !gameState.isGameOver && (
          <div className="animate-pulse bg-red-600 px-4 py-1.5 text-center text-sm font-bold text-white">
            🚨 تحذير سيادي: النظام مهدد بالسقوط خلال {monthsToCollapse} شهر!
          </div>
        )}

        {/* Row 1 — Identity */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 md:px-4">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            {gameState.playerName || gameState.partyName ? (
              <>
                {gameState.presidentAvatar ? (
                  <img
                    src={gameState.presidentAvatar}
                    alt={gameState.playerName}
                    className="h-8 w-8 shrink-0 rounded-full border-2 border-slate-400 object-cover md:h-10 md:w-10"
                  />
                ) : (
                  <div
                    role="img"
                    aria-label="لا توجد صورة للرئيس"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-slate-400 bg-slate-800 text-base md:h-10 md:w-10 md:text-xl"
                  >
                    👤
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h1 className="truncate text-sm font-semibold tracking-wide text-slate-100 md:text-base">
                      الرئيس: {gameState.playerName}
                      {gameState.partyName && ` | ${gameState.partyName}`}
                    </h1>
                    <span
                      title="مستوى الصعوبة المختار عند التنصيب"
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${DIFFICULTY_BADGE[gameState.difficulty].className}`}
                    >
                      {DIFFICULTY_BADGE[gameState.difficulty].label}
                    </span>
                  </div>
                  {gameState.slogan && (
                    <p className="truncate text-[11px] italic text-slate-500 md:text-xs">
                      {gameState.philosophySymbol} {gameState.slogan}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <h1 className="truncate text-sm font-semibold tracking-wide text-slate-100 md:text-base">
                محاكي تونس
              </h1>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="hidden text-xs text-slate-500 sm:inline">📅</span>
              <span className="text-xs font-semibold tabular-nums text-slate-200 md:text-sm">
                {formatGameDate(gameState.currentDate)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "هل تريد بدء حملة جديدة؟ سيتم مسح كل التقدم الحالي.",
                  )
                ) {
                  resetGame();
                }
              }}
              title="بداية حملة جديدة"
              className="shrink-0 rounded-md border border-red-500/40 px-2 py-1 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-500/10 md:px-3 md:py-1.5 md:text-sm"
            >
              <span className="md:hidden">⟲</span>
              <span className="hidden md:inline">بداية جديدة</span>
            </button>
            <img src="/logo.svg" alt="شعار محاكي تونس" className="h-8 w-8 shrink-0" />
          </div>
        </div>

        {/* Row 2 — Resource Ribbon: swipeable strip on mobile, wraps and
            centers on desktop. */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-2 md:flex-wrap md:justify-center md:gap-4 md:overflow-visible md:px-4">
          <Pill id="hud-budget" title="الميزانية العامة">
            <span>🏦</span>
            <span className="text-slate-500">الميزانية</span>
            <span
              className={`font-bold tabular-nums ${
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
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                net >= 0
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {formatNetFlow(net)}
            </span>
          </Pill>

          <Pill title="الدين السيادي المتراكم — يرتفع فقط، عبر القروض الطارئة">
            <span>🧾</span>
            <span className="text-slate-500">الدين</span>
            <span className="font-bold tabular-nums text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
              {formatMillions(gameState.sovereignDebt, "TND")}
            </span>
          </Pill>

          <Pill title="العملة الصعبة">
            <span>💱</span>
            <span className="text-slate-500">العملة الصعبة</span>
            <span
              className={`font-bold tabular-nums ${
                gameState.hardCurrency < 0 ? "text-red-400" : "text-slate-100"
              }`}
            >
              {formatMillions(gameState.hardCurrency, "USD")}
            </span>
            <span
              dir="ltr"
              title="صافي تدفق العملة الصعبة الشهري (الصادرات ناقص الصيانة)"
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                hardCurrencyNet >= 0
                  ? "bg-sky-500/10 text-sky-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {formatNetFlow(hardCurrencyNet, "USD")}
            </span>
          </Pill>

          <Pill title="المستوى التكنولوجي الوطني — تراكم نقاط العلوم من الجامعات والأقطاب التكنولوجية">
            <span>🔬</span>
            <span className="text-slate-500">التكنولوجيا</span>
            <span className="font-bold tabular-nums text-violet-300">
              {Math.round(gameState.techLevel)}
            </span>
          </Pill>

          <Pill title="رضا المواطنين — معدّل وطني مرجّح بعدد سكان كل ولاية">
            <span>🙂</span>
            <span className="text-slate-500">الرضا</span>
            <span
              className={`font-bold tabular-nums ${
                national.nationalSatisfaction >= 55
                  ? "text-emerald-400"
                  : national.nationalSatisfaction >= 40
                    ? "text-amber-300"
                    : "text-red-400"
              }`}
            >
              {Math.round(national.nationalSatisfaction)}/100
            </span>
          </Pill>

          <Pill title="الانتماء الوطني — معدّل وطني مرجّح بعدد سكان كل ولاية">
            <span>🇹🇳</span>
            <span className="text-slate-500">الانتماء</span>
            <span
              className={`font-bold tabular-nums ${
                national.overallNationalBelonging >= 60
                  ? "text-emerald-400"
                  : national.overallNationalBelonging >= 40
                    ? "text-amber-300"
                    : "text-red-400"
              }`}
            >
              {Math.round(national.overallNationalBelonging)}/100
            </span>
          </Pill>

          <Pill title="الناتج الوطني">
            <span>🏭</span>
            <span className="text-slate-500">الناتج الوطني</span>
            <span className="font-semibold tabular-nums text-slate-100">
              {formatMillions(national.gdpAnnual, "TND")}
              <span className="text-[10px] font-normal text-slate-500"> سنويًا</span>
            </span>
          </Pill>

          <Pill title="مزيج التشغيل والتنمية والأمن، مخصومًا منه عقوبة التفاوت بين الساحل والداخل">
            <span>⚖️</span>
            <span className="text-slate-500">الاستقرار</span>
            <span
              className={`font-bold tabular-nums ${
                national.stability >= 65
                  ? "text-emerald-400"
                  : national.stability >= 45
                    ? "text-amber-300"
                    : "text-red-400"
              }`}
            >
              {Math.round(national.stability)}/100
            </span>
          </Pill>
        </div>
      </header>

      {/* Floating Action Cluster — overlays the map at the bottom; the
          wrapper only positions it (pointer-events-none), the glass pill
          inside is the actual clickable surface. Sits above the map/sidebar
          but below every modal dialog (z-40+) so a modal still correctly
          blocks it. */}
      <div className="pointer-events-none fixed inset-x-2 bottom-4 z-30 md:inset-x-auto md:bottom-8 md:left-1/2 md:w-max md:-translate-x-1/2 md:px-6">
        <div className="pointer-events-auto flex w-full items-center justify-between gap-1.5 rounded-2xl border border-slate-700/60 bg-slate-900/75 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl md:w-max md:justify-center md:gap-3 md:rounded-full md:px-2 md:py-2">
          <div
            className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 p-0.5"
            role="group"
            aria-label="سرعة الزمن"
          >
            <button
              type="button"
              onClick={toggleTimeRunning}
              disabled={paused}
              aria-label={timeRunning ? "إيقاف الزمن" : "تشغيل الزمن"}
              title={timeRunning ? "إيقاف الزمن" : "تشغيل الزمن"}
              className={`rounded-full px-2.5 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:text-slate-600 ${
                timeRunning
                  ? "bg-emerald-600 text-white"
                  : "text-slate-300 hover:bg-slate-700"
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
                className={`rounded-full px-2 py-2 text-xs font-bold tabular-nums transition-colors ${
                  timeSpeed === speed
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-500 hover:bg-slate-700"
                }`}
              >
                {speed}×
              </button>
            ))}
          </div>

          <div className="hidden h-8 w-px bg-slate-700/60 md:block" />

          <button
            type="button"
            onClick={advanceTime}
            disabled={paused || timeRunning}
            title={paused ? "يجب مراجعة الحدث السياسي أولًا" : undefined}
            className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/50 transition-colors hover:bg-emerald-500 active:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          >
            الشهر التالي
          </button>

          <div className="hidden h-8 w-px bg-slate-700/60 md:block" />

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleDashboard}
              aria-label="لوحة التحليلات الوطنية"
              title="لوحة التحليلات الوطنية"
              className="rounded-full border border-slate-600 bg-slate-800/60 px-2.5 py-2 text-sm transition-colors hover:bg-slate-700"
            >
              📊
            </button>
            <button
              type="button"
              onClick={toggleCrisisCenter}
              aria-label="المركز الوطني لإدارة الأزمات"
              title={
                totalCrises > 0
                  ? `${totalCrises} ولاية في أزمة — المركز الوطني لإدارة الأزمات`
                  : "المركز الوطني لإدارة الأزمات"
              }
              className={`relative rounded-full border px-2.5 py-2 text-sm transition-colors ${
                totalCrises > 0
                  ? "animate-pulse border-red-500 bg-red-600/20 text-red-300 hover:bg-red-600/30"
                  : "border-slate-600 bg-slate-800/60 hover:bg-slate-700"
              }`}
            >
              🚨
              {totalCrises > 0 && (
                <span className="absolute -top-1.5 -end-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {totalCrises}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
