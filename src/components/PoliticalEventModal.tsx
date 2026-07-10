"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { computeNationalMetrics } from "@/lib/economy";
import {
  concessionsChance,
  mediationChance,
  scorchedSatDrop,
  scorchedUsdLoss,
  siegeTurnsFor,
  surgicalChance,
} from "@/lib/rebelCrisis";
import { formatNetFlow, formatNumber } from "@/lib/format";

/**
 * Full-screen dialog for socio-political events (riots, border crises,
 * investment booms). While it is open, `advanceTime` is a no-op — the
 * month cannot advance until the player acknowledges the situation.
 */
export default function PoliticalEventModal() {
  const event = useGameStore((state) => state.gameState.politicalEvent ?? null);
  const acknowledge = useGameStore((state) => state.acknowledgePoliticalEvent);
  const resolveChoice = useGameStore((state) => state.resolvePoliticalChoice);
  const resolveRebel = useGameStore((state) => state.resolveRebelAction);
  const regions = useGameStore((state) => state.regions);
  const budget = useGameStore((state) => state.gameState.totalBudget);
  const nationalStability = useGameStore(
    (state) => computeNationalMetrics(state.regions).stability,
  );

  // Martial Law is a pure UI switch into the War Room. Reset it whenever the
  // crisis changes (a new takeover, or this one resolving/closing) using the
  // render-phase "adjust state when a prop changes" pattern — no effect.
  const [martialLaw, setMartialLaw] = useState(false);
  const [lastEventId, setLastEventId] = useState(event?.id);
  if (event?.id !== lastEventId) {
    setLastEventId(event?.id);
    setMartialLaw(false);
  }

  if (!event) {
    return null;
  }

  const isBoom = event.severity === "boom";
  const isRebel = event.interactive?.kind === "rebel-takeover";
  const isInitiative = event.interactive?.kind === "citizen-initiative";
  const isInteractive = Boolean(event.interactive);
  const SUPPORT_COST = 60;
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
          {isRebel
            ? "🏴 فقدان السيطرة — قرار سيادي"
            : isInitiative
              ? "🤝 مبادرة مواطنية — قرار الدولة"
              : isBoom
                ? "🚀 ازدهار اقتصادي"
                : "🔥 أزمة سياسية واجتماعية"}
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

        {isRebel && region ? (
          region.diplomacyExhausted || martialLaw ? (
            // ===== STAGE 2 — WAR ROOM (غرفة العمليات) =====
            <div className="mt-6 space-y-2">
              <p className="text-xs font-bold text-red-300">
                {region.diplomacyExhausted
                  ? "⚠️ فشل المسار الدبلوماسي — لم يبقَ إلا الحسم العسكري"
                  : "🎖️ غرفة العمليات — الخيار العسكري"}
              </p>
              <button
                type="button"
                onClick={() => resolveRebel("surgical")}
                className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-right text-sm font-bold text-white transition-colors hover:bg-red-500"
              >
                🎯 ضربة جراحية
                <span className="mt-0.5 block text-[11px] font-normal text-red-100/80">
                  300م د.ت · احتمال النجاح {Math.round(surgicalChance(region.developmentIndex))}٪ · دون خسائر جانبية
                </span>
              </button>
              <button
                type="button"
                onClick={() => resolveRebel("scorched")}
                className="w-full rounded-lg bg-orange-700 px-4 py-2.5 text-right text-sm font-bold text-white transition-colors hover:bg-orange-600"
              >
                🔥 الأرض المحروقة
                <span className="mt-0.5 block text-[11px] font-normal text-orange-100/80">
                  نجاح مؤكد 100٪ · 100م د.ت · −40 تنمية · −{scorchedUsdLoss(region.population)}م$ · −{scorchedSatDrop(region.population)} رضا
                </span>
              </button>
              <button
                type="button"
                onClick={() => resolveRebel("siege")}
                className="w-full rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-right text-sm font-bold text-amber-200 transition-colors hover:bg-amber-500/20"
              >
                ⏳ الحصار والاستنزاف
                <span className="mt-0.5 block text-[11px] font-normal text-amber-300/80">
                  30م د.ت · {siegeTurnsFor(region.nationalBelonging)} أشهر حصار · لا ناتج وتراجع الرضا شهريًا
                </span>
              </button>
            </div>
          ) : (
            // ===== STAGE 1 — DIPLOMACY (المسار الدبلوماسي) =====
            <div className="mt-6 space-y-2">
              <p className="text-xs font-bold text-sky-300">
                🕊️ المسار الدبلوماسي — حاول استعادة الولاية دون حرب
              </p>
              <button
                type="button"
                onClick={() => resolveRebel("concessions")}
                className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-right text-sm font-bold text-white transition-colors hover:bg-sky-500"
              >
                🤝 تنازلات كبرى
                <span className="mt-0.5 block text-[11px] font-normal text-sky-100/80">
                  100م د.ت · احتمال النجاح {Math.round(concessionsChance(nationalStability))}٪ · −20 أمن
                </span>
              </button>
              <button
                type="button"
                onClick={() => resolveRebel("mediation")}
                className="w-full rounded-lg border border-sky-500/50 bg-sky-500/10 px-4 py-2.5 text-right text-sm font-bold text-sky-200 transition-colors hover:bg-sky-500/20"
              >
                🗣️ وساطة محلية
                <span className="mt-0.5 block text-[11px] font-normal text-sky-300/80">
                  20م د.ت · احتمال النجاح {Math.round(mediationChance(region.developmentIndex))}٪ · عند الفشل −10 تنمية
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMartialLaw(true)}
                className="w-full rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-right text-sm font-bold text-red-300 transition-colors hover:bg-red-500/20"
              >
                ⚔️ إعلان الأحكام العرفية
                <span className="mt-0.5 block text-[11px] font-normal text-red-300/70">
                  تجاوز التفاوض والانتقال مباشرة إلى غرفة العمليات
                </span>
              </button>
            </div>
          )
        ) : isInteractive ? (
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => resolveChoice("praise")}
              className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-4 py-2.5 text-sm font-bold text-sky-200 transition-colors hover:bg-sky-500/20"
            >
              🎖️ ثناء سياسي
              <span className="mt-0.5 block text-[11px] font-normal text-sky-300/80">
                مجاني · دعم معنوي للانتماء
              </span>
            </button>
            <button
              type="button"
              onClick={() => resolveChoice("support")}
              disabled={budget < SUPPORT_COST}
              title={budget < SUPPORT_COST ? "الميزانية غير كافية" : undefined}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
            >
              💰 دعم مالي
              <span className="mt-0.5 block text-[11px] font-normal text-emerald-100/80">
                {SUPPORT_COST}م د.ت · تعزيز قوي للانتماء والتنمية
              </span>
            </button>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
