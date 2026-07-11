"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";

const CAMPAIGN_COST_TND = 25;
const CREDIBILITY_COST = 12;
const LOAN_AMOUNT_TND = 500;
const LOAN_BELONGING_HIT = 15;
const LOAN_STABILITY_HIT = 10;

const EXCHANGE_CHUNK_USD = 50;
const USD_TND_RATE = 3;
/** Sovereign loans inject foreign currency, not local budget — the same
 *  conversion `gameStore.ts`'s LOAN_USD_INJECTION uses. */
const LOAN_USD_INJECTION = Math.floor(LOAN_AMOUNT_TND / USD_TND_RATE);
const EXCHANGE_CHUNK_TND = EXCHANGE_CHUNK_USD * USD_TND_RATE;
const LIQUIDATION_INFLATION_HIT = 5;
const DEFLATION_BOOST = 2;
const BCT_BLOCK_THRESHOLD = 70;
const OVERRIDE_CREDIBILITY_HIT = 20;
const OVERRIDE_STABILITY_HIT = 15;
const WESTERN_FRICTION_ALIGNMENT_THRESHOLD = -50;
const WESTERN_FRICTION_RATE = 4;

const OLIGARCHY_CONTROL_THRESHOLD = 50;
const OLIGARCHY_CORRUPTION_DRAIN_TND = 50;
const OLIGARCHY_BLEED_RATE_PCT = 20;
const ANTI_MONOPOLY_CONTROL_PROGRESS = 5;
const ANTI_MONOPOLY_PURCHASING_POWER_RETALIATION = 10;

const EMERGENCY_LOAN_MIN_ALIGNMENT = 0;
const EMERGENCY_LOAN_ALIGNMENT_SHIFT = 20;
const EASTERN_LOAN_ALIGNMENT_SHIFT = 40;
const EASTERN_LOAN_CAPITAL_FLIGHT_USD = 20;

const SOCIAL_PACT_TRUCE_MONTHS = 12;
const SOCIAL_PACT_WAGE_BURDEN_TND = 50;
const TOTAL_SUBMISSION_TRUCE_MONTHS = 24;
const TOTAL_SUBMISSION_WAGE_BURDEN_TND = 120;
const UNION_CRACKDOWN_TRUCE_MONTHS = 36;
const UNION_CRACKDOWN_STABILITY_HIT = 30;

type CommandTab = "economy" | "foreign" | "security" | "internal";

const TABS: readonly { key: CommandTab; label: string; icon: string }[] = [
  { key: "economy", label: "الاقتصاد والمالية", icon: "💰" },
  { key: "foreign", label: "السياسة الخارجية", icon: "🌍" },
  { key: "security", label: "الأمن والسيادة", icon: "🛡️" },
  { key: "internal", label: "الداخلية والمجتمع", icon: "🏘️" },
];

/**
 * The Central Command Room: every global sovereign lever, sorted by domain
 * into four tabs so the dashboard stops reading as one long undifferentiated
 * wall of buttons. Pure UI/UX reorganization of the former SovereignArsenal —
 * every store action, guard and tooltip below is identical to what it
 * replaces; only the layout and risk-tier color-coding changed.
 */
export default function CentralCommand() {
  const [activeTab, setActiveTab] = useState<CommandTab>("economy");

  const stateCredibility = useGameStore(
    (state) => state.gameState.stateCredibility,
  );
  const budget = useGameStore((state) => state.gameState.totalBudget);
  const sovereignDebt = useGameStore((state) => state.gameState.sovereignDebt);
  const launchPropagandaCampaign = useGameStore(
    (state) => state.launchPropagandaCampaign,
  );
  const takeEmergencyLoan = useGameStore((state) => state.takeEmergencyLoan);
  const hardCurrency = useGameStore((state) => state.gameState.hardCurrency);
  const purchasingPowerIndex = useGameStore(
    (state) => state.gameState.purchasingPowerIndex,
  );
  const bctIndependence = useGameStore(
    (state) => state.gameState.bctIndependence,
  );
  const exchangeUsdToTnd = useGameStore((state) => state.exchangeUsdToTnd);
  const exchangeTndToUsd = useGameStore((state) => state.exchangeTndToUsd);
  const overrideBCT = useGameStore((state) => state.overrideBCT);
  const oligarchyControl = useGameStore(
    (state) => state.gameState.oligarchyControl,
  );
  const antiMonopolyActive = useGameStore(
    (state) => state.gameState.antiMonopolyActive,
  );
  const toggleAntiMonopolyCampaign = useGameStore(
    (state) => state.toggleAntiMonopolyCampaign,
  );
  const geopoliticalAlignment = useGameStore(
    (state) => state.gameState.geopoliticalAlignment,
  );
  const takeEasternBlocLoan = useGameStore(
    (state) => state.takeEasternBlocLoan,
  );
  const criticalStabilityMonths = useGameStore(
    (state) => state.gameState.criticalStabilityMonths,
  );
  const isGameOver = useGameStore((state) => state.gameState.isGameOver);
  const nationalUnionTruce = useGameStore(
    (state) => state.gameState.nationalUnionTruce,
  );
  const publicWageBurden = useGameStore(
    (state) => state.gameState.publicWageBurden,
  );
  const signSocialPact = useGameStore((state) => state.signSocialPact);
  const signTotalSubmission = useGameStore(
    (state) => state.signTotalSubmission,
  );
  const launchUnionCrackdown = useGameStore(
    (state) => state.launchUnionCrackdown,
  );

  const boost = Math.max(0, Math.floor(15 * (stateCredibility / 100)));
  const exhausted = stateCredibility <= 0;
  const insufficientFunds = budget < CAMPAIGN_COST_TND;
  const propagandaDisabled = exhausted || insufficientFunds;

  const bctBlocked = purchasingPowerIndex < BCT_BLOCK_THRESHOLD && bctIndependence;
  const liquidateInsufficientReserves = hardCurrency < EXCHANGE_CHUNK_USD;
  const liquidateDisabled = bctBlocked || liquidateInsufficientReserves;
  const westernFriction =
    geopoliticalAlignment < WESTERN_FRICTION_ALIGNMENT_THRESHOLD;
  const buyRate = westernFriction ? WESTERN_FRICTION_RATE : USD_TND_RATE;
  const buyCostTnd = EXCHANGE_CHUNK_USD * buyRate;
  const buyInsufficientBudget = budget < buyCostTnd;

  const imfLoanDisabled = geopoliticalAlignment < EMERGENCY_LOAN_MIN_ALIGNMENT;

  const monthsToCollapse = 3 - criticalStabilityMonths;
  const unionTruceActive = nationalUnionTruce > 0;

  return (
    <div>
      <div
        role="tablist"
        aria-label="غرفة القيادة المركزية"
        className="flex flex-wrap gap-2 border-b border-slate-700 pb-3"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-3 py-2.5 text-sm font-bold transition-colors sm:px-4 ${
              activeTab === tab.key
                ? "bg-sky-600 text-white shadow-lg shadow-sky-950/50"
                : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <span className="me-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {activeTab === "economy" && (
          <>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 shadow-lg shadow-black/20 backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-300">
                  🏛️ البنك المركزي التونسي
                </h3>
                <span
                  title="مؤشر المقدرة الشرائية — يتآكل مع كل تسييل للعملة الصعبة"
                  className={`text-sm font-bold tabular-nums ${
                    purchasingPowerIndex >= 80
                      ? "text-emerald-400"
                      : purchasingPowerIndex >= 50
                        ? "text-amber-300"
                        : "text-red-400"
                  }`}
                >
                  مؤشر المقدرة الشرائية: {Math.round(purchasingPowerIndex)}/100
                </span>
              </div>
              <p
                className={`mt-1 text-xs font-semibold ${
                  bctIndependence ? "text-sky-300" : "text-red-400"
                }`}
              >
                الحالة: {bctIndependence ? "مستقل" : "تم إسقاط استقلاليته"}
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => exchangeTndToUsd(buyCostTnd)}
                  disabled={buyInsufficientBudget}
                  title={
                    buyInsufficientBudget
                      ? "الميزانية غير كافية"
                      : westernFriction
                        ? `-${buyCostTnd}م د.ت (احتكاك مالي غربي) · +${DEFLATION_BOOST} مؤشر المقدرة الشرائية`
                        : `-${buyCostTnd}م د.ت · +${DEFLATION_BOOST} مؤشر المقدرة الشرائية`
                  }
                  className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-4 py-2.5 text-sm font-bold text-sky-200 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  💴 شراء {EXCHANGE_CHUNK_USD}م $ (منخفض المخاطر)
                  <span className="mt-0.5 block text-[11px] font-normal text-sky-300/80">
                    -{buyCostTnd}م د.ت · +{DEFLATION_BOOST} مقدرة شرائية
                    {westernFriction && " (احتكاك مالي غربي)"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => exchangeUsdToTnd(EXCHANGE_CHUNK_USD)}
                  disabled={liquidateDisabled}
                  title={
                    bctBlocked
                      ? "محافظ البنك المركزي يرفض تسييل العملة بسبب التضخم"
                      : liquidateInsufficientReserves
                        ? "احتياطي العملة الصعبة غير كافٍ"
                        : `تحذير (خطر متوسط): يسبب تضخمًا. +${EXCHANGE_CHUNK_TND}م د.ت · -${LIQUIDATION_INFLATION_HIT} مؤشر المقدرة الشرائية`
                  }
                  className="rounded-lg bg-gradient-to-r from-amber-600 to-amber-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/30 transition-all hover:from-amber-500 hover:to-amber-700 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:ring-0"
                >
                  💵 تسييل {EXCHANGE_CHUNK_USD}م $ (خطر متوسط)
                  <span className="mt-0.5 block text-[11px] font-normal text-amber-100/80">
                    +{EXCHANGE_CHUNK_TND}م د.ت · -{LIQUIDATION_INFLATION_HIT}{" "}
                    مقدرة شرائية (تضخم)
                  </span>
                </button>
              </div>

              {bctBlocked && (
                <p className="mt-2 text-[11px] font-semibold text-red-400">
                  ⚠️ محافظ البنك المركزي يرفض تسييل العملة بسبب التضخم
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 shadow-lg shadow-black/20 backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-300">
                  🏭 الاقتصاد الريعي
                </h3>
                <span
                  title="سيطرة الكارتيلات على الاقتصاد — فوق 50٪ تستنزف الميزانية شهريًا ما لم تُواجَه"
                  className={`text-sm font-bold tabular-nums ${
                    oligarchyControl <= 30
                      ? "text-emerald-400"
                      : oligarchyControl <= 60
                        ? "text-amber-300"
                        : "text-red-400"
                  }`}
                >
                  سيطرة الكارتيلات: {Math.round(oligarchyControl)}%
                </span>
              </div>

              <button
                type="button"
                onClick={toggleAntiMonopolyCampaign}
                title={
                  antiMonopolyActive
                    ? `الحملة جارية: -${ANTI_MONOPOLY_PURCHASING_POWER_RETALIATION} مقدرة شرائية شهريًا (انتقام الكارتيلات) مقابل -${ANTI_MONOPOLY_CONTROL_PROGRESS}٪ سيطرة الكارتيلات شهريًا`
                    : `تحذير (خطر مرتفع): إبقاء الوضع كما هو يستنزف -${OLIGARCHY_CORRUPTION_DRAIN_TND}م د.ت أو ${OLIGARCHY_BLEED_RATE_PCT}٪ من العائد الجبائي الوطني شهريًا (أيهما أعلى) طالما السيطرة فوق ${OLIGARCHY_CONTROL_THRESHOLD}٪ — الكارتيلات تكبر مع نجاحك. إطلاق الحملة يوقف النزيف لكن الكارتيلات تنتقم بتهريب البضائع: -${ANTI_MONOPOLY_PURCHASING_POWER_RETALIATION} مقدرة شرائية شهريًا`
                }
                className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
                  antiMonopolyActive
                    ? "border border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                    : "bg-gradient-to-r from-orange-600 to-orange-800 text-white shadow-lg shadow-orange-950/40 ring-1 ring-orange-500/30 hover:from-orange-500 hover:to-orange-700"
                }`}
              >
                {antiMonopolyActive
                  ? "⏹️ إيقاف حملة مكافحة الاحتكار"
                  : "⚔️ إطلاق حملة مكافحة الاحتكار (خطر مرتفع)"}
                <span
                  className={`mt-0.5 block text-[11px] font-normal ${
                    antiMonopolyActive ? "text-amber-300/80" : "text-orange-100/80"
                  }`}
                >
                  {antiMonopolyActive
                    ? `-${ANTI_MONOPOLY_PURCHASING_POWER_RETALIATION} مقدرة شرائية/شهر · -${ANTI_MONOPOLY_CONTROL_PROGRESS}٪ سيطرة الكارتيلات/شهر`
                    : `بدون حملة: -${OLIGARCHY_CORRUPTION_DRAIN_TND}م د.ت أو ${OLIGARCHY_BLEED_RATE_PCT}٪ من العائد الجبائي/شهر (أيهما أعلى)`}
                </span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 shadow-lg shadow-black/20 backdrop-blur-md">
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
              <p className="mt-1 text-[11px] text-slate-500">
                يرتفع فقط، عبر القروض الطارئة الغربية أو الشرقية — انظر تبويب
                السياسة الخارجية.
              </p>
            </div>
          </>
        )}

        {activeTab === "foreign" && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 shadow-lg shadow-black/20 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-300">
                🌍 الاصطفاف الجيوسياسي
              </h3>
              <span className="text-sm font-bold tabular-nums text-slate-100">
                الاصطفاف الجيوسياسي: {Math.round(geopoliticalAlignment)}
              </span>
            </div>

            <div className="relative mt-3 h-2 w-full rounded-full bg-slate-700">
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-sky-400 shadow"
                style={{
                  insetInlineStart: `${((geopoliticalAlignment + 100) / 200) * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-500">
              <span>الشرق (BRICS)</span>
              <span>محايد</span>
              <span>الغرب (IMF)</span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={takeEmergencyLoan}
                disabled={imfLoanDisabled}
                title={
                  imfLoanDisabled
                    ? "صندوق النقد الدولي يرفض التعامل مع دولة مصطفة شرقًا"
                    : `تحذير (خطر متوسط): ضخ +${LOAN_USD_INJECTION} مليون دولار في الاحتياطي (يُسجل كـ ${LOAN_AMOUNT_TND} مليون د.ت دين سيادي)، لكنه يتسبب في انخفاض حاد وفوري في الرضا والاستقرار الوطنيين بسبب التقشف، ويزيد الاصطفاف نحو الغرب +${EMERGENCY_LOAN_ALIGNMENT_SHIFT}`
                }
                className="rounded-lg bg-gradient-to-r from-amber-600 to-amber-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/30 transition-all hover:from-amber-500 hover:to-amber-700 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:ring-0"
              >
                💸 قرض صندوق النقد الدولي (IMF)
                <span className="mt-0.5 block text-[11px] font-normal text-amber-100/80">
                  +{LOAN_USD_INJECTION}م $ (دين: {LOAN_AMOUNT_TND}م د.ت) · تقشف: -
                  {LOAN_BELONGING_HIT} انتماء وطني · -{LOAN_STABILITY_HIT} استقرار
                  وطني · اصطفاف: +{EMERGENCY_LOAN_ALIGNMENT_SHIFT} غربًا
                </span>
              </button>
              <button
                type="button"
                onClick={takeEasternBlocLoan}
                title={`تحذير (خطر متوسط): ضخ +${LOAN_USD_INJECTION} مليون دولار في الاحتياطي (يُسجل كـ ${LOAN_AMOUNT_TND} مليون د.ت دين سيادي)، بدون تقشف، يرافقه هروب -${EASTERN_LOAN_CAPITAL_FLIGHT_USD}M$ فورًا. يحوّل الاصطفاف شرقًا (-${EASTERN_LOAN_ALIGNMENT_SHIFT})`}
                className="rounded-lg bg-gradient-to-r from-rose-700 to-rose-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/30 transition-all hover:from-rose-600 hover:to-rose-800"
              >
                🐉 قرض المعسكر الشرقي (BRICS)
                <span className="mt-0.5 block text-[11px] font-normal text-rose-300/80">
                  +{LOAN_USD_INJECTION}م $ (دين: {LOAN_AMOUNT_TND}م د.ت) · هروب
                  رساميل: -{EASTERN_LOAN_CAPITAL_FLIGHT_USD}م $ · بدون تقشف ·
                  اصطفاف: -{EASTERN_LOAN_ALIGNMENT_SHIFT} شرقًا
                </span>
              </button>
            </div>

            {imfLoanDisabled && (
              <p className="mt-2 text-[11px] font-semibold text-red-400">
                ⚠️ صندوق النقد الدولي يرفض التعامل مع دولة مصطفة شرقًا
              </p>
            )}
          </div>
        )}

        {activeTab === "security" && (
          <>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 shadow-lg shadow-black/20 backdrop-blur-md">
              <h3 className="text-sm font-semibold text-slate-300">
                🎙️ الحرب الإعلامية
              </h3>
              <button
                type="button"
                onClick={launchPropagandaCampaign}
                disabled={propagandaDisabled}
                title={
                  exhausted
                    ? "الشعب لم يعد يصدق الآلة الإعلامية"
                    : insufficientFunds
                      ? "الميزانية غير كافية"
                      : `تحذير (خطر متوسط): يستهلك مصداقية الدولة. التكلفة: ${CAMPAIGN_COST_TND}م د.ت · +${boost} رضا متوقع · -${CREDIBILITY_COST} مصداقية`
                }
                className="mt-3 w-full rounded-lg bg-gradient-to-r from-fuchsia-700 to-fuchsia-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-950/40 ring-1 ring-fuchsia-500/30 transition-all hover:from-fuchsia-600 hover:to-fuchsia-800 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:ring-0"
              >
                📢 تمويل حملة إعلامية (خطر متوسط)
                <span className="mt-0.5 block text-[11px] font-normal text-fuchsia-100/80">
                  التكلفة: {CAMPAIGN_COST_TND}م د.ت · الزيادة المتوقعة: +{boost}{" "}
                  رضا · الأثر على المصداقية: -{CREDIBILITY_COST}
                </span>
              </button>

              {exhausted && (
                <p className="mt-2 text-[11px] font-semibold text-red-400">
                  ⚠️ الشعب لم يعد يصدق الآلة الإعلامية
                </p>
              )}
            </div>

            {bctIndependence && (
              <div className="rounded-xl border-2 border-red-600 bg-red-950/30 p-4 shadow-lg shadow-red-950/50 backdrop-blur-md ring-1 ring-red-500/30">
                <h3 className="text-sm font-semibold text-red-300">
                  ⚠️ منطقة الخطر الأقصى
                </h3>
                <button
                  type="button"
                  onClick={overrideBCT}
                  title={`تحذير (خطر أقصى): خطوة لا رجعة فيها — تُسقط استقلالية البنك المركزي فورًا وتُلحق ضررًا فادحًا: -${OVERRIDE_CREDIBILITY_HIT} مصداقية الدولة و-${OVERRIDE_STABILITY_HIT} استقرار وطني (انهيار استقرار ضخم)`}
                  className="mt-3 w-full rounded-lg bg-gradient-to-r from-red-700 to-red-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-950/50 ring-2 ring-red-500/50 transition-all hover:from-red-600 hover:to-red-800"
                >
                  ⚠️ إسقاط استقلالية البنك المركزي بالقوة (خطر أقصى)
                  <span className="mt-0.5 block text-[11px] font-normal text-red-100/90">
                    -{OVERRIDE_CREDIBILITY_HIT} مصداقية · -{OVERRIDE_STABILITY_HIT}{" "}
                    استقرار وطني · إجراء لا رجعة فيه
                  </span>
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "internal" && (
          <>
            {criticalStabilityMonths > 0 && !isGameOver && (
              <div className="animate-pulse rounded-xl border-2 border-red-500 bg-red-600 p-4 text-center">
                <p className="text-sm font-bold text-white">
                  🚨 تحذير سيادي: النظام مهدد بالسقوط خلال {monthsToCollapse} شهر!
                </p>
              </div>
            )}

            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 shadow-lg shadow-black/20 backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-300">
                  🎗️ مصداقية الدولة
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
            </div>

            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 shadow-lg shadow-black/20 backdrop-blur-md">
              <h3 className="text-sm font-semibold text-slate-300">
                🤝 المركزية النقابية
              </h3>

              {unionTruceActive && (
                <p className="mt-1 text-xs font-semibold text-sky-300">
                  الهدنة النقابية: {nationalUnionTruce} أشهر متبقية
                </p>
              )}
              {publicWageBurden > 0 && (
                <p className="mt-1 text-xs font-semibold text-amber-300">
                  العبء الهيكلي للأجور: -{Math.round(publicWageBurden)} مليون
                  د.ت/شهريًا
                </p>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={signSocialPact}
                  disabled={unionTruceActive}
                  title={`هدوء لـ ${SOCIAL_PACT_TRUCE_MONTHS} شهراً مقابل +${SOCIAL_PACT_WAGE_BURDEN_TND}M عبء أجور شهري دائم.`}
                  className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-4 py-2.5 text-sm font-bold text-sky-200 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  🤝 ميثاق سلم اجتماعي (سنة)
                  <span className="mt-0.5 block text-[11px] font-normal text-sky-300/80">
                    +{SOCIAL_PACT_TRUCE_MONTHS} شهر هدنة · +
                    {SOCIAL_PACT_WAGE_BURDEN_TND}م د.ت/شهر عبء دائم
                  </span>
                </button>
                <button
                  type="button"
                  onClick={signTotalSubmission}
                  disabled={unionTruceActive}
                  title={`هدوء لـ ${TOTAL_SUBMISSION_TRUCE_MONTHS} شهراً مقابل +${TOTAL_SUBMISSION_WAGE_BURDEN_TND}M عبء أجور شهري دائم.`}
                  className="rounded-lg bg-gradient-to-r from-orange-600 to-orange-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-950/40 ring-1 ring-orange-500/30 transition-all hover:from-orange-500 hover:to-orange-700 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:ring-0"
                >
                  💰 شراء ولاء كلي (سنتان)
                  <span className="mt-0.5 block text-[11px] font-normal text-orange-100/80">
                    +{TOTAL_SUBMISSION_TRUCE_MONTHS} شهر هدنة · +
                    {TOTAL_SUBMISSION_WAGE_BURDEN_TND}م د.ت/شهر عبء دائم
                  </span>
                </button>
                <button
                  type="button"
                  onClick={launchUnionCrackdown}
                  disabled={unionTruceActive}
                  title={`هدوء قسري لـ ${UNION_CRACKDOWN_TRUCE_MONTHS} شهراً. لا أعباء مالية، لكن انهيار فوري وعنيف للاستقرار الوطني (-${UNION_CRACKDOWN_STABILITY_HIT}).`}
                  className="rounded-lg bg-gradient-to-r from-red-700 to-red-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-950/50 ring-2 ring-red-500/50 transition-all hover:from-red-600 hover:to-red-800 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:ring-0"
                >
                  ⚔️ صدام شامل وتجميد (3 سنوات)
                  <span className="mt-0.5 block text-[11px] font-normal text-red-100/90">
                    +{UNION_CRACKDOWN_TRUCE_MONTHS} شهر هدنة · بدون عبء مالي ·
                    -{UNION_CRACKDOWN_STABILITY_HIT} استقرار وطني
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
