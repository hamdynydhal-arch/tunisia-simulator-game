"use client";

import { useGameStore } from "@/store/gameStore";
import { formatNetFlow, formatNumber } from "@/lib/format";

/**
 * Full-screen dialog for socio-political events (riots, border crises,
 * investment booms). While it is open, `advanceTime` is a no-op — the
 * month cannot advance until the player acknowledges the situation.
 */
export default function PoliticalEventModal() {
  const event = useGameStore((state) => state.gameState.politicalEvent ?? null);
  const acknowledge = useGameStore((state) => state.acknowledgePoliticalEvent);
  const regions = useGameStore((state) => state.regions);

  if (!event) {
    return null;
  }

  const isBoom = event.severity === "boom";
  const region = event.regionId ? regions[event.regionId] : null;
  const impacts = [
    event.effects.budgetChange !== 0 && {
      label: "الميزانية العامة",
      value: event.effects.budgetChange,
      unit: "TND" as const,
    },
    (event.effects.hardCurrencyChange ?? 0) !== 0 && {
      label: "العملة الصعبة",
      value: event.effects.hardCurrencyChange ?? 0,
      unit: "USD" as const,
    },
    (event.effects.populationChange ?? 0) !== 0 && {
      label: "السكان",
      value: event.effects.populationChange ?? 0,
      unit: "people" as const,
    },
  ].filter(Boolean) as {
    label: string;
    value: number;
    unit: "TND" | "USD" | "people";
  }[];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
        className={`w-full max-w-lg animate-slide-in-down rounded-2xl border-2 bg-slate-900 p-6 shadow-2xl ${
          isBoom ? "border-emerald-500/60" : "border-red-500/60"
        }`}
      >
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
            isBoom
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-red-500/15 text-red-300"
          }`}
        >
          {isBoom ? "🚀 ازدهار اقتصادي" : "🔥 أزمة سياسية واجتماعية"}
        </span>
        <h2 className="mt-4 text-2xl font-bold text-slate-50">{event.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {event.description}
        </p>

        {(impacts.length > 0 || region) && (
          <div className="mt-5 space-y-2 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            {impacts.map((impact) => (
              <div
                key={impact.label}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-400">{impact.label}</span>
                <span
                  dir="ltr"
                  className={`font-bold tabular-nums ${
                    impact.value >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {impact.unit === "people"
                    ? `${impact.value >= 0 ? "+" : "-"}${formatNumber(Math.abs(impact.value))}`
                    : formatNetFlow(impact.value, impact.unit)}
                </span>
              </div>
            ))}
            {region && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">الولاية المعنية</span>
                <span className="font-bold text-slate-100">{region.name}</span>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={acknowledge}
          className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-colors ${
            isBoom
              ? "bg-emerald-600 hover:bg-emerald-500"
              : "bg-red-600 hover:bg-red-500"
          }`}
        >
          متابعة الحكم
        </button>
      </div>
    </div>
  );
}
