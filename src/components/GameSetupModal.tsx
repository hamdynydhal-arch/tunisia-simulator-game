"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import type { Difficulty } from "@/types/game";

// The 33-66-99 scaling: each tier's absolute values, mirroring gameStore.ts's
// EASY_*/HARD_* starting-conditions constants (display copy only).
const NORMAL_STARTING_BUDGET_TND = 5_000;
const NORMAL_STARTING_HARD_CURRENCY_USD = 2_400;
const EASY_STARTING_BUDGET_TND = 7_500;
const EASY_STARTING_HARD_CURRENCY_USD = 3_600;
const HARD_STARTING_BUDGET_TND = 2_500;
const HARD_STARTING_HARD_CURRENCY_USD = 0;
const HARD_STARTING_SOVEREIGN_DEBT_TND = 1_000;

/** Explicit comma-grouped thousands, e.g. "7,500 مليون دينار" — distinct
 *  from the rest of the app's ar-TN (period-grouped) `formatMillions`,
 *  scoped to this briefing view only per the exact copy requested. */
function formatMillionsComma(value: number, unit: "دينار" | "دولار"): string {
  return `${value.toLocaleString("en-US")} مليون ${unit}`;
}

// Win/loss thresholds mirror gameStore.ts's HISTORICAL_TRIUMPH_*/COLLAPSE_*/
// CRITICAL_STABILITY_* constants — display copy only, not re-derived logic.
const WIN_STABILITY_THRESHOLD = 85;
const WIN_PURCHASING_POWER_THRESHOLD = 60;
const COLLAPSE_STABILITY = 15;
const COLLAPSE_BUDGET_TND = 2_000;
const SUSTAINED_COLLAPSE_STABILITY = 25;
const SUSTAINED_COLLAPSE_MONTHS = 3;

const DIFFICULTIES: readonly {
  key: Difficulty;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    key: "easy",
    label: "مسار شعبوي",
    icon: "📢",
    description: "ميزانية ضخمة 7500م د.ت واحتياطي 3600م$. تهرب ضريبي منخفض جداً.",
  },
  {
    key: "normal",
    label: "حكومة تكنوقراط",
    icon: "⚖️",
    description: "الوضع الأساسي القياسي: ميزانية 5000م د.ت واحتياطي 2400م$.",
  },
  {
    key: "hard",
    label: "رجل دولة",
    icon: "🎖️",
    description: "ديون سيادية خانقة 1000م د.ت، صفر احتياطي $، وتهرب ضريبي مستفحل (+30%).",
  },
];

function startingStatsFor(difficulty: Difficulty) {
  if (difficulty === "easy") {
    return {
      budget: EASY_STARTING_BUDGET_TND,
      hardCurrency: EASY_STARTING_HARD_CURRENCY_USD,
      sovereignDebt: 0,
      shadowNote: "تقلص بـ 30% (ميزة)",
    };
  }
  if (difficulty === "hard") {
    return {
      budget: HARD_STARTING_BUDGET_TND,
      hardCurrency: HARD_STARTING_HARD_CURRENCY_USD,
      sovereignDebt: HARD_STARTING_SOVEREIGN_DEBT_TND,
      shadowNote: "تضخم بـ 30% (عقوبة)",
    };
  }
  return {
    budget: NORMAL_STARTING_BUDGET_TND,
    hardCurrency: NORMAL_STARTING_HARD_CURRENCY_USD,
    sovereignDebt: 0,
    shadowNote: "معدل طبيعي (بلا تغيير)",
  };
}

/**
 * The Inauguration: a 3-step wizard (persona → difficulty → briefing) that
 * gates the very first tick. Renders exactly while `gameStarted === false` —
 * `startGame` (called by the final step's oath button) flips it true and
 * applies the chosen difficulty tier's one-time starting-conditions
 * overrides, permanently dismissing this modal for the rest of the campaign.
 */
export default function GameSetupModal() {
  const gameStarted = useGameStore((state) => state.gameState.gameStarted);
  const startGame = useGameStore((state) => state.startGame);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [playerName, setPlayerName] = useState("");
  const [partyName, setPartyName] = useState("");
  const [slogan, setSlogan] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");

  if (gameStarted) {
    return null;
  }

  const personaValid =
    playerName.trim().length > 0 && partyName.trim().length > 0;
  const stats = startingStatsFor(difficulty);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="مراسم التنصيب"
        className="w-full max-w-xl animate-slide-in-down rounded-2xl border border-slate-700/50 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
      >
        <div className="mb-6 flex items-center justify-center gap-2">
          {([0, 1, 2] as const).map((s) => (
            <div
              key={s}
              className={`h-1.5 w-10 rounded-full transition-colors ${
                s <= step ? "bg-sky-500" : "bg-slate-700"
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <div>
            <h2 className="text-center text-xl font-bold text-slate-100">
              مراسم التنصيب
            </h2>
            <p className="mt-1 text-center text-sm text-slate-400">
              من أنت أيها الرئيس القادم؟
            </p>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-400">
                  اسم الرئيس
                </span>
                <input
                  type="text"
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  placeholder="مثال: الطيب الوزير"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-sky-500/50"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-400">
                  اسم الحزب/الحركة
                </span>
                <input
                  type="text"
                  value={partyName}
                  onChange={(event) => setPartyName(event.target.value)}
                  placeholder="مثال: حركة النهضة الوطنية"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-sky-500/50"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-400">
                  الشعار (اختياري)
                </span>
                <input
                  type="text"
                  value={slogan}
                  onChange={(event) => setSlogan(event.target.value)}
                  placeholder="مثال: تونس أولاً"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-sky-500/50"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={!personaValid}
              title={
                personaValid
                  ? undefined
                  : "أدخل اسم الرئيس واسم الحزب للمتابعة"
              }
              className="mt-6 w-full rounded-lg bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-950/40 ring-1 ring-sky-500/30 transition-all hover:from-sky-500 hover:to-sky-700 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:ring-0"
            >
              التالي
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-center text-xl font-bold text-slate-100">
              اختر مستوى الحكم
            </h2>
            <p className="mt-1 text-center text-sm text-slate-400">
              كل مسار يبدأ من ظروف اقتصادية مختلفة
            </p>
            <div className="mt-6 space-y-3">
              {DIFFICULTIES.map((tier) => (
                <button
                  key={tier.key}
                  type="button"
                  onClick={() => setDifficulty(tier.key)}
                  aria-pressed={difficulty === tier.key}
                  className={`w-full rounded-lg border p-3 text-start transition-all ${
                    difficulty === tier.key
                      ? "border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/50"
                      : "border-slate-700 bg-slate-800/40 hover:bg-slate-800/70"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-100">
                    <span>{tier.icon}</span>
                    {tier.label}
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">
                    {tier.description}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-800"
              >
                رجوع
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full rounded-lg bg-gradient-to-r from-sky-600 to-sky-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-950/40 ring-1 ring-sky-500/30 transition-all hover:from-sky-500 hover:to-sky-700"
              >
                التالي
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-center text-xl font-bold text-slate-100">
              الإحاطة الرئاسية
            </h2>
            <p className="mt-1 text-center text-sm text-slate-400">
              الرئيس {playerName} · {partyName}
            </p>

            <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                نقطة الانطلاق
              </h3>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-slate-500">الميزانية</dt>
                  <dd className="font-bold text-slate-100">
                    {formatMillionsComma(stats.budget, "دينار")}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">العملة الصعبة</dt>
                  <dd className="font-bold text-slate-100">
                    {formatMillionsComma(stats.hardCurrency, "دولار")}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">الدين السيادي</dt>
                  <dd className="font-bold text-slate-100">
                    {formatMillionsComma(stats.sovereignDebt, "دينار")}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">الاقتصاد الموازي</dt>
                  <dd className="font-bold text-slate-100">
                    {stats.shadowNote}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-3 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-400">
                شروط الانتصار (العبور التاريخي)
              </h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-emerald-100/80">
                <li>سداد الدين السيادي بالكامل (0)</li>
                <li>استقرار وطني {WIN_STABILITY_THRESHOLD}+/100</li>
                <li>صفر إضرابات عامة نشطة</li>
                <li>مقدرة شرائية {WIN_PURCHASING_POWER_THRESHOLD}+/100</li>
              </ul>
            </div>

            <div className="mt-3 rounded-xl border border-red-700/40 bg-red-950/20 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-red-400">
                شروط السقوط
              </h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-100/80">
                <li>انهيار فوري: استقرار وطني دون {COLLAPSE_STABILITY}/100</li>
                <li>
                  إفلاس فوري: ميزانية الدولة تنخفض دون -{COLLAPSE_BUDGET_TND}م
                  د.ت
                </li>
                <li>
                  سقوط تدريجي: استقرار دون {SUSTAINED_COLLAPSE_STABILITY} لمدة{" "}
                  {SUSTAINED_COLLAPSE_MONTHS} أشهر متتالية
                </li>
              </ul>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-800"
              >
                رجوع
              </button>
              <button
                type="button"
                onClick={() =>
                  startGame(
                    playerName.trim(),
                    partyName.trim(),
                    slogan.trim(),
                    difficulty,
                  )
                }
                className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40 transition-all hover:from-emerald-500 hover:to-emerald-700"
              >
                أداء اليمين الدستورية
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
