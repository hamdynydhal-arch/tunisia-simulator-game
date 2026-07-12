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
  easy: { label: "مسار شعبوي", className: "text-emerald-400" },
  normal: { label: "حكومة تكنوقراط", className: "text-amber-400" },
  hard: { label: "رجل دولة", className: "text-red-400" },
};

/** Shared shell for the Resource Ribbon's data-readout entries (Row 2 of the
 *  Top Command Bar) — a thin end-side divider between entries stands in for
 *  `divide-x`, which hardcodes a physical side and would read backwards
 *  under this app's `dir="rtl"`. */
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
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap border-e border-white/10 px-3 py-1.5 text-xs last:border-e-0 md:shrink"
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

  // Rendered twice (see Row 2) so the mobile marquee can loop seamlessly;
  // `idPrefix` is only set on the first copy so `#hud-budget` stays a
  // single, valid element for FloatingEffects' getBoundingClientRect target.
  const renderResourcePills = (idPrefix: string) => [
    <Pill key={`${idPrefix}-budget`} id={idPrefix === "a" ? "hud-budget" : undefined} title="الميزانية العامة">
      <span className="text-slate-400">🏦</span>
      <span className="text-slate-400">الميزانية</span>
      <span
        className={`font-mono font-bold tabular-nums ${
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
    </Pill>,

    <Pill key={`${idPrefix}-debt`} title="الدين السيادي المتراكم — يرتفع فقط، عبر القروض الطارئة">
      <span className="text-slate-400">🧾</span>
      <span className="text-slate-400">الدين</span>
      <span className="font-mono font-bold tabular-nums text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]">
        {formatMillions(gameState.sovereignDebt, "TND")}
      </span>
    </Pill>,

    <Pill key={`${idPrefix}-fx`} title="العملة الصعبة">
      <span className="text-slate-400">💱</span>
      <span className="text-slate-400">العملة الصعبة</span>
      <span
        className={`font-mono font-bold tabular-nums ${
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
    </Pill>,

    <Pill key={`${idPrefix}-tech`} title="المستوى التكنولوجي الوطني — تراكم نقاط العلوم من الجامعات والأقطاب التكنولوجية">
      <span className="text-slate-400">🔬</span>
      <span className="text-slate-400">التكنولوجيا</span>
      <span className="font-mono font-bold tabular-nums text-violet-300">
        {Math.round(gameState.techLevel)}
      </span>
    </Pill>,

    <Pill key={`${idPrefix}-satisfaction`} title="رضا المواطنين — معدّل وطني مرجّح بعدد سكان كل ولاية">
      <span className="text-slate-400">🙂</span>
      <span className="text-slate-400">الرضا</span>
      <span
        className={`font-mono font-bold tabular-nums ${
          national.nationalSatisfaction >= 55
            ? "text-emerald-400"
            : national.nationalSatisfaction >= 40
              ? "text-amber-300"
              : "text-red-400"
        }`}
      >
        {Math.round(national.nationalSatisfaction)}/100
      </span>
    </Pill>,

    <Pill key={`${idPrefix}-belonging`} title="الانتماء الوطني — معدّل وطني مرجّح بعدد سكان كل ولاية">
      <span className="text-slate-400">🇹🇳</span>
      <span className="text-slate-400">الانتماء</span>
      <span
        className={`font-mono font-bold tabular-nums ${
          national.overallNationalBelonging >= 60
            ? "text-emerald-400"
            : national.overallNationalBelonging >= 40
              ? "text-amber-300"
              : "text-red-400"
        }`}
      >
        {Math.round(national.overallNationalBelonging)}/100
      </span>
    </Pill>,

    <Pill key={`${idPrefix}-gdp`} title="الناتج الوطني">
      <span className="text-slate-400">🏭</span>
      <span className="text-slate-400">الناتج الوطني</span>
      <span className="font-mono font-semibold tabular-nums text-white">
        {formatMillions(national.gdpAnnual, "TND")}
        <span className="text-[10px] font-normal text-slate-500"> سنويًا</span>
      </span>
    </Pill>,

    <Pill key={`${idPrefix}-stability`} title="مزيج التشغيل والتنمية والأمن، مخصومًا منه عقوبة التفاوت بين الساحل والداخل">
      <span className="text-slate-400">⚖️</span>
      <span className="text-slate-400">الاستقرار</span>
      <span
        className={`font-mono font-bold tabular-nums ${
          national.stability >= 65
            ? "text-emerald-400"
            : national.stability >= 45
              ? "text-amber-300"
              : "text-red-400"
        }`}
      >
        {Math.round(national.stability)}/100
      </span>
    </Pill>,
  ];

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        {gameState.criticalStabilityMonths > 0 && !gameState.isGameOver && (
          <div className="animate-pulse bg-red-600 px-4 py-1.5 text-center text-sm font-bold text-white">
            🚨 تحذير سيادي: النظام مهدد بالسقوط خلال {monthsToCollapse} شهر!
          </div>
        )}

        {/* Row 1 — Identity */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            {gameState.playerName || gameState.partyName ? (
              <>
                {gameState.presidentAvatar ? (
                  <img
                    src={gameState.presidentAvatar}
                    alt={gameState.playerName}
                    className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-slate-700 md:h-14 md:w-14"
                  />
                ) : (
                  <div
                    role="img"
                    aria-label="لا توجد صورة للرئيس"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/40 text-xl ring-2 ring-slate-700 md:h-14 md:w-14 md:text-2xl"
                  >
                    👤
                  </div>
                )}
                {/* Golden Ratio hierarchy: Crown (name) / Faction (party +
                    tag, one line) / Ideology (slogan). items-start keeps
                    each line pinned to the reading-start edge — the
                    physical right under this app's dir="rtl". */}
                <div className="flex min-w-0 flex-col items-start justify-center gap-1">
                  <h1 className="text-base font-extrabold leading-none text-white md:text-lg">
                    الرئيس: {gameState.playerName}
                  </h1>
                  {gameState.partyName && (
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-xs text-slate-400">
                        {gameState.partyName}
                      </span>
                      <span
                        title="مستوى الصعوبة المختار عند التنصيب"
                        className={`shrink-0 rounded border border-white/10 bg-black/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${DIFFICULTY_BADGE[gameState.difficulty].className}`}
                      >
                        {DIFFICULTY_BADGE[gameState.difficulty].label}
                      </span>
                    </div>
                  )}
                  {gameState.slogan && (
                    <p className="flex min-w-0 items-center gap-1.5 truncate text-sm text-amber-500/90">
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-base leading-none md:h-5 md:w-5 md:text-lg">
                        {gameState.philosophySymbol}
                      </span>
                      <span className="truncate">{gameState.slogan}</span>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <h1 className="truncate text-sm font-extrabold tracking-wide text-white md:text-base">
                محاكي تونس
              </h1>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="hidden text-xs text-slate-400 sm:inline">📅</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-slate-300 md:text-sm">
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
              className="pointer-events-auto shrink-0 rounded border border-white/10 bg-black/40 px-2 py-1 text-[11px] font-semibold text-red-500 transition-colors hover:border-red-600/40 hover:bg-red-950/30 md:px-3 md:py-1.5 md:text-sm"
            >
              <span className="md:hidden">⟲</span>
              <span className="hidden md:inline">بداية جديدة</span>
            </button>
            <img src="/logo.svg" alt="شعار محاكي تونس" className="h-8 w-8 shrink-0" />
          </div>
        </div>

        {/* Row 2 — Resource Ribbon, "the pulse of the nation": a
            continuously auto-scrolling marquee on mobile (no user
            interaction — the ribbon's content is duplicated back to back and
            the whole track loops via the `marquee` keyframe in
            globals.css), wraps and centers as a static readout on desktop. */}
        <div className="overflow-hidden whitespace-nowrap px-3 pb-2 md:overflow-visible md:px-4">
          <div className="flex w-max animate-[marquee_25s_linear_infinite] md:w-full md:animate-none md:flex-wrap md:justify-center">
            <div className="flex shrink-0">{renderResourcePills("a")}</div>
            <div aria-hidden="true" className="flex shrink-0 md:hidden">
              {renderResourcePills("b")}
            </div>
          </div>
        </div>
      </header>

      {/* Floating Action Cluster — overlays the map at the bottom; the
          wrapper only positions it (pointer-events-none), the glass pill
          inside is the actual clickable surface. Sits above the map/sidebar
          but below every modal dialog (z-40+) so a modal still correctly
          blocks it. */}
      <div className="pointer-events-none fixed inset-x-2 bottom-4 z-30 md:inset-x-auto md:bottom-8 md:left-1/2 md:w-max md:-translate-x-1/2 md:px-6">
        <div className="pointer-events-auto flex w-full items-center justify-between gap-1.5 rounded-2xl border border-white/5 bg-black/60 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl md:w-max md:justify-center md:gap-3 md:rounded-full md:px-2 md:py-2">
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
              className={`rounded-md px-2.5 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:text-slate-700 ${
                timeRunning
                  ? "border border-red-600/40 bg-red-950/40 text-red-300"
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
                className={`rounded-md px-2 py-2 font-mono text-xs font-bold tabular-nums transition-colors ${
                  timeSpeed === speed
                    ? "border border-red-600/40 bg-red-950/40 text-red-300"
                    : "text-slate-500 hover:text-white"
                }`}
              >
                {speed}×
              </button>
            ))}
          </div>

          <div className="hidden h-8 w-px bg-white/10 md:block" />

          <button
            type="button"
            onClick={advanceTime}
            disabled={paused || timeRunning}
            title={paused ? "يجب مراجعة الحدث السياسي أولًا" : undefined}
            className="rounded-full border border-slate-700 bg-gradient-to-b from-slate-800 to-black px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/50 transition-all hover:border-red-600/50 hover:shadow-[0_0_20px_rgba(220,38,38,0.35)] active:from-black active:to-slate-950 disabled:cursor-not-allowed disabled:border-white/5 disabled:from-black disabled:to-black disabled:text-slate-600"
          >
            الشهر التالي
          </button>

          <div className="hidden h-8 w-px bg-white/10 md:block" />

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleDashboard}
              aria-label="لوحة التحليلات الوطنية"
              title="لوحة التحليلات الوطنية"
              className="rounded-full border border-white/10 bg-black/40 px-2.5 py-2 text-sm text-slate-300 transition-colors hover:border-white/20 hover:bg-black/60"
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
                  ? "animate-pulse border-red-600/60 bg-red-950/40 text-red-400 hover:bg-red-950/60"
                  : "border-white/10 bg-black/40 text-slate-300 hover:border-white/20 hover:bg-black/60"
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
