"use client";

import { useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import { computeMonthlyFinances, computeNationalMetrics } from "@/lib/economy";
import { formatGameDate, formatMillions, formatNetFlow } from "@/lib/format";
import type { Difficulty } from "@/types/game";

const DIFFICULTY_BADGE: Record<
  Difficulty,
  {
    label: string;
    textClassName: string;
    borderClassName: string;
    glowClassName: string;
  }
> = {
  easy: {
    label: "مسار شعبوي",
    textClassName: "text-emerald-400",
    borderClassName: "border-emerald-900",
    glowClassName: "shadow-[0_0_6px_rgba(16,185,129,0.25)]",
  },
  normal: {
    label: "حكومة تكنوقراط",
    textClassName: "text-amber-400",
    borderClassName: "border-amber-900",
    glowClassName: "shadow-[0_0_6px_rgba(245,158,11,0.25)]",
  },
  hard: {
    label: "رجل دولة",
    textClassName: "text-red-400",
    borderClassName: "border-red-900",
    glowClassName: "shadow-[0_0_6px_rgba(239,68,68,0.25)]",
  },
};

/** Shared shell for the Stats Ribbon's data-readout entries (Row 2 of the
 *  Top Command Bar) — a thin end-side divider stands in for `divide-x`,
 *  which hardcodes a physical side and would read backwards under this
 *  app's `dir="rtl"`; `snap-start` gives the horizontal scroll a resting
 *  point per item for thumb-friendly swiping. */
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
      className="flex shrink-0 snap-start items-center gap-2 whitespace-nowrap border-e border-white/10 pe-5 text-xs last:border-e-0 last:pe-0"
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
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 border-b border-white/5 bg-black/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_40px_-15px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        {gameState.criticalStabilityMonths > 0 && !gameState.isGameOver && (
          <div className="animate-pulse bg-red-600 px-4 py-1.5 text-center text-sm font-bold text-white shadow-[0_2px_16px_rgba(220,38,38,0.4)]">
            🚨 تحذير سيادي: النظام مهدد بالسقوط خلال {monthsToCollapse} شهر!
          </div>
        )}

        {/* Row 1 — Presidential Profile. Nothing here truncates: every line
            wraps (flex-wrap/break-words) instead of clipping with an
            ellipsis, so a long name or party never silently loses text. */}
        <div className="flex w-full items-center justify-between p-3 md:gap-3 md:p-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {gameState.playerName || gameState.partyName ? (
              <>
                {gameState.presidentAvatar ? (
                  <img
                    src={gameState.presidentAvatar}
                    alt={gameState.playerName}
                    className="relative h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-slate-700/80 md:h-13 md:w-13"
                  />
                ) : (
                  <div
                    role="img"
                    aria-label="لا توجد صورة للرئيس"
                    className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/40 text-xl ring-2 ring-slate-700/80 md:h-13 md:w-13 md:text-2xl"
                  >
                    👤
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-light tracking-wide text-slate-400 text-xs">الرئيس:</span>
                    <span className="break-words text-base font-extrabold tracking-wide text-white md:text-lg">
                      {gameState.playerName}
                    </span>
                  </div>
                  {gameState.partyName && (
                    <div className="flex flex-row items-center gap-2">
                      <span className="min-w-0 flex-1 break-words text-xs font-light tracking-wide text-slate-300">
                        {gameState.partyName}
                      </span>
                      <span
                        title="مستوى الصعوبة المختار عند التنصيب"
                        className={`shrink-0 rounded border bg-black/60 px-1.5 py-[2px] font-mono text-[10px] uppercase tracking-widest ${DIFFICULTY_BADGE[gameState.difficulty].borderClassName} ${DIFFICULTY_BADGE[gameState.difficulty].textClassName} ${DIFFICULTY_BADGE[gameState.difficulty].glowClassName}`}
                      >
                        {DIFFICULTY_BADGE[gameState.difficulty].label}
                      </span>
                    </div>
                  )}
                  {gameState.slogan && (
                    <div className="flex items-center gap-1.5 text-xs tracking-wide text-amber-400/90">
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-base leading-none">
                        {gameState.philosophySymbol}
                      </span>
                      <span className="break-words">{gameState.slogan}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <h1 className="text-sm font-extrabold tracking-wide text-white md:text-base">
                محاكي تونس
              </h1>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="hidden text-xs text-slate-400 sm:inline">📅</span>
              <span className="font-mono text-xs font-semibold tracking-wide tabular-nums text-slate-300 md:text-sm">
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
              className="pointer-events-auto shrink-0 rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] font-semibold text-slate-400 transition-all hover:border-red-600/40 hover:bg-red-950/30 hover:text-red-400 md:px-3 md:py-1.5 md:text-sm"
            >
              <span className="md:hidden">⟲</span>
              <span className="hidden md:inline">بداية جديدة</span>
            </button>
            <img
              src="/logo.svg"
              alt="شعار محاكي تونس"
              className="h-8 w-8 shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
            />
          </div>
        </div>

        {/* Row 2 — Stats Ribbon: a static, purely user-swiped strip (zero
            animation) with a snap point per item and a left-edge fade mask
            hinting that more content continues past the visible edge. */}
        <div className="relative w-full border-t border-white/5 bg-black/30 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)]">
          <div
            className="no-scrollbar pointer-events-auto flex snap-x items-center gap-5 overflow-x-auto overscroll-contain whitespace-nowrap px-3 py-2.5 md:gap-6 md:px-4"
            style={{
              maskImage: "linear-gradient(to right, transparent, black 5%)",
              WebkitMaskImage: "linear-gradient(to right, transparent, black 5%)",
            }}
          >
            <Pill id="hud-budget" title="الميزانية العامة">
              <span className="font-light tracking-wide text-slate-400">🏦</span>
              <span className="font-light tracking-wide text-slate-400">الميزانية</span>
              <span
                className={`font-mono font-extrabold tabular-nums ${
                  inDebt
                    ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                    : "text-white"
                }`}
              >
                {formatMillions(gameState.totalBudget, "TND")}
              </span>
              <span
                dir="ltr"
                title="صافي التدفق النقدي الشهري"
                className={`font-mono text-[10px] font-bold tabular-nums ${
                  net >= 0
                    ? "text-emerald-400 shadow-lg shadow-emerald-500/20"
                    : "text-red-400"
                }`}
              >
                {formatNetFlow(net)}
              </span>
            </Pill>

            <Pill title="الدين السيادي المتراكم — يرتفع فقط، عبر القروض الطارئة">
              <span className="font-light tracking-wide text-slate-400">🧾</span>
              <span className="font-light tracking-wide text-slate-400">الدين</span>
              <span className="font-mono font-extrabold tabular-nums text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                {formatMillions(gameState.sovereignDebt, "TND")}
              </span>
            </Pill>

            <Pill title="العملة الصعبة">
              <span className="font-light tracking-wide text-slate-400">💱</span>
              <span className="font-light tracking-wide text-slate-400">العملة الصعبة</span>
              <span
                className={`font-mono font-extrabold tabular-nums ${
                  gameState.hardCurrency < 0 ? "text-red-500" : "text-white"
                }`}
              >
                {formatMillions(gameState.hardCurrency, "USD")}
              </span>
              <span
                dir="ltr"
                title="صافي تدفق العملة الصعبة الشهري (الصادرات ناقص الصيانة)"
                className={`font-mono text-[10px] font-bold tabular-nums ${
                  hardCurrencyNet >= 0 ? "text-sky-400" : "text-red-400"
                }`}
              >
                {formatNetFlow(hardCurrencyNet, "USD")}
              </span>
            </Pill>

            <Pill title="المستوى التكنولوجي الوطني — تراكم نقاط العلوم من الجامعات والأقطاب التكنولوجية">
              <span className="font-light tracking-wide text-slate-400">🔬</span>
              <span className="font-light tracking-wide text-slate-400">التكنولوجيا</span>
              <span className="font-mono font-extrabold tabular-nums text-violet-300">
                {Math.round(gameState.techLevel)}
              </span>
            </Pill>

            <Pill title="رضا المواطنين — معدّل وطني مرجّح بعدد سكان كل ولاية">
              <span className="font-light tracking-wide text-slate-400">🙂</span>
              <span className="font-light tracking-wide text-slate-400">الرضا</span>
              <span
                className={`font-mono font-extrabold tabular-nums ${
                  national.nationalSatisfaction >= 55
                    ? "text-emerald-400"
                    : national.nationalSatisfaction >= 40
                      ? "text-amber-300"
                      : "text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                }`}
              >
                {Math.round(national.nationalSatisfaction)}/100
              </span>
            </Pill>

            <Pill title="الانتماء الوطني — معدّل وطني مرجّح بعدد سكان كل ولاية">
              <span className="font-light tracking-wide text-slate-400">🇹🇳</span>
              <span className="font-light tracking-wide text-slate-400">الانتماء</span>
              <span
                className={`font-mono font-extrabold tabular-nums ${
                  national.overallNationalBelonging >= 60
                    ? "text-emerald-400"
                    : national.overallNationalBelonging >= 40
                      ? "text-amber-300"
                      : "text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                }`}
              >
                {Math.round(national.overallNationalBelonging)}/100
              </span>
            </Pill>

            <Pill title="الناتج الوطني">
              <span className="font-light tracking-wide text-slate-400">🏭</span>
              <span className="font-light tracking-wide text-slate-400">الناتج الوطني</span>
              <span className="font-mono font-semibold tabular-nums text-white">
                {formatMillions(national.gdpAnnual, "TND")}
                <span className="text-[10px] font-normal text-slate-500"> سنويًا</span>
              </span>
            </Pill>

            <Pill title="مزيج التشغيل والتنمية والأمن، مخصومًا منه عقوبة التفاوت بين الساحل والداخل">
              <span className="font-light tracking-wide text-slate-400">⚖️</span>
              <span className="font-light tracking-wide text-slate-400">الاستقرار</span>
              <span
                className={`font-mono font-extrabold tabular-nums ${
                  national.stability >= 65
                    ? "text-emerald-400"
                    : national.stability >= 45
                      ? "text-amber-300"
                      : "text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                }`}
              >
                {Math.round(national.stability)}/100
              </span>
            </Pill>
          </div>
        </div>
      </header>

      {/* Floating Action Cluster — overlays the map at the bottom; the
          wrapper only positions it (pointer-events-none), the glass pill
          inside is the actual clickable surface. Sits above the map/sidebar
          but below every modal dialog (z-40+) so a modal still correctly
          blocks it. */}
      <div className="pointer-events-none fixed inset-x-2 bottom-4 z-30 md:inset-x-auto md:bottom-8 md:left-1/2 md:w-max md:-translate-x-1/2 md:px-6">
        <div className="pointer-events-auto flex w-full items-center justify-between gap-1.5 rounded-2xl border border-white/5 bg-black/60 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl md:w-max md:justify-center md:gap-3 md:rounded-full md:px-2 md:py-2">
          <div
            className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-0.5"
            role="group"
            aria-label="سرعة الزمن"
          >
            <button
              type="button"
              onClick={toggleTimeRunning}
              disabled={paused}
              aria-label={timeRunning ? "إيقاف الزمن" : "تشغيل الزمن"}
              title={timeRunning ? "إيقاف الزمن" : "تشغيل الزمن"}
              className={`rounded-md px-2.5 py-2 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:text-slate-700 ${
                timeRunning
                  ? "border border-red-600/40 bg-red-950/40 text-red-300 shadow-[0_0_10px_rgba(220,38,38,0.25)]"
                  : "text-slate-500 hover:text-white"
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
                className={`rounded-md px-2 py-2 font-mono text-xs font-bold tracking-wide tabular-nums transition-all ${
                  timeSpeed === speed
                    ? "border border-red-600/40 bg-red-950/40 text-red-300 shadow-[0_0_10px_rgba(220,38,38,0.25)]"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                {speed}×
              </button>
            ))}
          </div>

          <div className="hidden h-8 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent md:block" />

          <button
            type="button"
            onClick={advanceTime}
            disabled={paused || timeRunning}
            title={paused ? "يجب مراجعة الحدث السياسي أولًا" : undefined}
            className="rounded-full border border-white/10 bg-gradient-to-b from-slate-800 to-black px-5 py-2.5 text-sm font-extrabold tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_20px_-6px_rgba(0,0,0,0.6)] transition-all hover:border-red-600/50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_24px_rgba(220,38,38,0.4)] active:from-black active:to-slate-950 disabled:cursor-not-allowed disabled:border-white/5 disabled:from-black disabled:to-black disabled:text-slate-600 disabled:shadow-none"
          >
            الشهر التالي
          </button>

          <div className="hidden h-8 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent md:block" />

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleDashboard}
              aria-label="لوحة التحليلات الوطنية"
              title="لوحة التحليلات الوطنية"
              className="rounded-full border border-white/10 bg-black/40 px-2.5 py-2 text-sm text-slate-300 transition-all hover:border-white/20 hover:bg-black/60 hover:shadow-[0_0_10px_rgba(255,255,255,0.08)]"
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
              className={`relative rounded-full border px-2.5 py-2 text-sm transition-all ${
                totalCrises > 0
                  ? "animate-pulse border-red-600/60 bg-red-950/40 text-red-400 shadow-[0_0_10px_rgba(220,38,38,0.25)] hover:bg-red-950/60"
                  : "border-white/10 bg-black/40 text-slate-300 hover:border-white/20 hover:bg-black/60 hover:shadow-[0_0_10px_rgba(255,255,255,0.08)]"
              }`}
            >
              🚨
              {totalCrises > 0 && (
                <span className="absolute -top-1.5 -end-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-[0_0_6px_rgba(220,38,38,0.6)]">
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
