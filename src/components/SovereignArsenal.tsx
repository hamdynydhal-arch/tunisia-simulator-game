"use client";

import { useGameStore } from "@/store/gameStore";

const CAMPAIGN_COST_TND = 25;
const CREDIBILITY_COST = 12;
const LOAN_AMOUNT_TND = 500;
const LOAN_BELONGING_HIT = 15;
const LOAN_STABILITY_HIT = 10;

/**
 * The state's proactive lever: fabricate national satisfaction on demand via
 * a media campaign. Each use spends state credibility (the Lie Tax), and the
 * next campaign's payoff shrinks in proportion — diminishing returns, so the
 * tool decays itself into uselessness rather than becoming a free win button.
 */
export default function SovereignArsenal() {
  const stateCredibility = useGameStore(
    (state) => state.gameState.stateCredibility,
  );
  const budget = useGameStore((state) => state.gameState.totalBudget);
  const sovereignDebt = useGameStore((state) => state.gameState.sovereignDebt);
  const launchPropagandaCampaign = useGameStore(
    (state) => state.launchPropagandaCampaign,
  );
  const takeEmergencyLoan = useGameStore((state) => state.takeEmergencyLoan);

  const boost = Math.max(0, Math.floor(15 * (stateCredibility / 100)));
  const exhausted = stateCredibility <= 0;
  const insufficientFunds = budget < CAMPAIGN_COST_TND;
  const disabled = exhausted || insufficientFunds;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-300">
            🎙️ الترسانة السيادية
          </h3>
          <span
            title="مصداقية الدولة — تتآكل مع كل حملة إعلامية، وتحدّ من مفعول التالية"
            className={`text-sm font-bold tabular-nums ${
              stateCredibility >= 55
                ? "text-emerald-400"
                : stateCredibility >= 25
                  ? "text-amber-300"
                  : "text-red-400"
            }`}
          >
            مصداقية الدولة: {Math.round(stateCredibility)}/100
          </span>
        </div>

        <button
          type="button"
          onClick={launchPropagandaCampaign}
          disabled={disabled}
          title={
            exhausted
              ? "الشعب لم يعد يصدق الآلة الإعلامية"
              : insufficientFunds
                ? "الميزانية غير كافية"
                : undefined
          }
          className="mt-3 w-full rounded-lg bg-fuchsia-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-fuchsia-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
        >
          📢 تمويل حملة إعلامية
          <span className="mt-0.5 block text-[11px] font-normal text-fuchsia-100/80">
            التكلفة: {CAMPAIGN_COST_TND}م د.ت · الزيادة المتوقعة: +{boost} رضا ·
            الأثر على المصداقية: -{CREDIBILITY_COST}
          </span>
        </button>

        {exhausted && (
          <p className="mt-2 text-[11px] font-semibold text-red-400">
            ⚠️ الشعب لم يعد يصدق الآلة الإعلامية
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-300">
            🏦 الدين السيادي
          </h3>
          <span
            title="الدين السيادي المتراكم — يرتفع فقط، عبر القروض الطارئة"
            className="text-sm font-bold tabular-nums text-amber-300"
          >
            {Math.round(sovereignDebt)}م د.ت
          </span>
        </div>

        <button
          type="button"
          onClick={takeEmergencyLoan}
          title={`تحذير: +${LOAN_AMOUNT_TND}م د.ت فورًا، لكنه يتسبب في انخفاض حاد وفوري في الرضا والاستقرار الوطنيين بسبب التقشف`}
          className="mt-3 w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600"
        >
          💸 طلب قرض دولي طارئ
          <span className="mt-0.5 block text-[11px] font-normal text-amber-100/80">
            +{LOAN_AMOUNT_TND}م د.ت فورًا · تقشف: -{LOAN_BELONGING_HIT} انتماء
            وطني · -{LOAN_STABILITY_HIT} استقرار وطني
          </span>
        </button>
      </div>
    </div>
  );
}
