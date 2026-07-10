"use client";

import { useGameStore } from "@/store/gameStore";

const CAMPAIGN_COST_TND = 25;
const CREDIBILITY_COST = 12;
const LOAN_AMOUNT_TND = 500;
const LOAN_BELONGING_HIT = 15;
const LOAN_STABILITY_HIT = 10;

const EXCHANGE_CHUNK_USD = 50;
const USD_TND_RATE = 3;
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
const ANTI_MONOPOLY_CONTROL_PROGRESS = 5;
const ANTI_MONOPOLY_PURCHASING_POWER_RETALIATION = 10;

const EMERGENCY_LOAN_MIN_ALIGNMENT = 0;
const EMERGENCY_LOAN_ALIGNMENT_SHIFT = 20;
const EASTERN_LOAN_ALIGNMENT_SHIFT = 40;
const EASTERN_LOAN_CAPITAL_FLIGHT_USD = 20;

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

  const boost = Math.max(0, Math.floor(15 * (stateCredibility / 100)));
  const exhausted = stateCredibility <= 0;
  const insufficientFunds = budget < CAMPAIGN_COST_TND;
  const disabled = exhausted || insufficientFunds;

  const bctBlocked = purchasingPowerIndex < BCT_BLOCK_THRESHOLD && bctIndependence;
  const liquidateInsufficientReserves = hardCurrency < EXCHANGE_CHUNK_USD;
  const liquidateDisabled = bctBlocked || liquidateInsufficientReserves;
  const westernFriction =
    geopoliticalAlignment < WESTERN_FRICTION_ALIGNMENT_THRESHOLD;
  const buyRate = westernFriction ? WESTERN_FRICTION_RATE : USD_TND_RATE;
  const buyCostTnd = EXCHANGE_CHUNK_USD * buyRate;
  const buyInsufficientBudget = budget < buyCostTnd;

  const imfLoanDisabled = geopoliticalAlignment < EMERGENCY_LOAN_MIN_ALIGNMENT;

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
        <p className="mt-1 text-[11px] text-slate-500">
          يرتفع فقط، عبر القروض الطارئة الغربية أو الشرقية — انظر بطاقة
          الاصطفاف الجيوسياسي أدناه.
        </p>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
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
            onClick={() => exchangeUsdToTnd(EXCHANGE_CHUNK_USD)}
            disabled={liquidateDisabled}
            title={
              bctBlocked
                ? "محافظ البنك المركزي يرفض تسييل العملة بسبب التضخم"
                : liquidateInsufficientReserves
                  ? "احتياطي العملة الصعبة غير كافٍ"
                  : `+${EXCHANGE_CHUNK_TND}م د.ت · -${LIQUIDATION_INFLATION_HIT} مؤشر المقدرة الشرائية`
            }
            className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          >
            💵 تسييل {EXCHANGE_CHUNK_USD}م $
            <span className="mt-0.5 block text-[11px] font-normal text-sky-100/80">
              +{EXCHANGE_CHUNK_TND}م د.ت · -{LIQUIDATION_INFLATION_HIT} مقدرة
              شرائية
            </span>
          </button>
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
            💴 شراء {EXCHANGE_CHUNK_USD}م $
            <span className="mt-0.5 block text-[11px] font-normal text-sky-300/80">
              -{buyCostTnd}م د.ت · +{DEFLATION_BOOST} مقدرة شرائية
              {westernFriction && " (احتكاك مالي غربي)"}
            </span>
          </button>
        </div>

        {bctBlocked && (
          <p className="mt-2 text-[11px] font-semibold text-red-400">
            ⚠️ محافظ البنك المركزي يرفض تسييل العملة بسبب التضخم
          </p>
        )}

        {bctIndependence && (
          <button
            type="button"
            onClick={overrideBCT}
            title={`تحذير: خطوة لا رجعة فيها — تُسقط استقلالية البنك المركزي فورًا وتُلحق ضررًا فادحًا: -${OVERRIDE_CREDIBILITY_HIT} مصداقية الدولة و-${OVERRIDE_STABILITY_HIT} استقرار وطني`}
            className="mt-3 w-full rounded-lg border-2 border-red-500 bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-600"
          >
            ⚠️ إسقاط استقلالية البنك المركزي بالقوة
            <span className="mt-0.5 block text-[11px] font-normal text-red-100/90">
              -{OVERRIDE_CREDIBILITY_HIT} مصداقية · -{OVERRIDE_STABILITY_HIT}{" "}
              استقرار وطني · إجراء لا رجعة فيه
            </span>
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
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
              : `تحذير: إبقاء الوضع كما هو يستنزف -${OLIGARCHY_CORRUPTION_DRAIN_TND}م د.ت شهريًا (فساد واحتكار) طالما السيطرة فوق ${OLIGARCHY_CONTROL_THRESHOLD}٪. إطلاق الحملة يوقف النزيف لكن الكارتيلات تنتقم بتهريب البضائع: -${ANTI_MONOPOLY_PURCHASING_POWER_RETALIATION} مقدرة شرائية شهريًا`
          }
          className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
            antiMonopolyActive
              ? "border border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
              : "bg-orange-700 text-white hover:bg-orange-600"
          }`}
        >
          {antiMonopolyActive
            ? "⏹️ إيقاف حملة مكافحة الاحتكار"
            : "⚔️ إطلاق حملة مكافحة الاحتكار"}
          <span
            className={`mt-0.5 block text-[11px] font-normal ${
              antiMonopolyActive ? "text-amber-300/80" : "text-orange-100/80"
            }`}
          >
            {antiMonopolyActive
              ? `-${ANTI_MONOPOLY_PURCHASING_POWER_RETALIATION} مقدرة شرائية/شهر · -${ANTI_MONOPOLY_CONTROL_PROGRESS}٪ سيطرة الكارتيلات/شهر`
              : `بدون حملة: -${OLIGARCHY_CORRUPTION_DRAIN_TND}م د.ت/شهر فسادًا`}
          </span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
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
                : `تحذير: +${LOAN_AMOUNT_TND}م د.ت فورًا، لكنه يتسبب في انخفاض حاد وفوري في الرضا والاستقرار الوطنيين بسبب التقشف، ويزيد الاصطفاف نحو الغرب +${EMERGENCY_LOAN_ALIGNMENT_SHIFT}`
            }
            className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          >
            💸 قرض صندوق النقد الدولي (IMF)
            <span className="mt-0.5 block text-[11px] font-normal text-amber-100/80">
              +{LOAN_AMOUNT_TND}م د.ت · تقشف: -{LOAN_BELONGING_HIT} انتماء وطني
              · -{LOAN_STABILITY_HIT} استقرار وطني · اصطفاف: +
              {EMERGENCY_LOAN_ALIGNMENT_SHIFT} غربًا
            </span>
          </button>
          <button
            type="button"
            onClick={takeEasternBlocLoan}
            title={`+${LOAN_AMOUNT_TND}م د.ت، بدون تقشف. يحوّل الاصطفاف شرقًا (-${EASTERN_LOAN_ALIGNMENT_SHIFT})، ويثير هروب رساميل غربية (-${EASTERN_LOAN_CAPITAL_FLIGHT_USD}م $ من الاحتياطي)`}
            className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-200 transition-colors hover:bg-rose-500/20"
          >
            🐉 قرض المعسكر الشرقي (BRICS)
            <span className="mt-0.5 block text-[11px] font-normal text-rose-300/80">
              +{LOAN_AMOUNT_TND}م د.ت · بدون تقشف · اصطفاف: -
              {EASTERN_LOAN_ALIGNMENT_SHIFT} شرقًا · هروب رساميل: -
              {EASTERN_LOAN_CAPITAL_FLIGHT_USD}م $
            </span>
          </button>
        </div>

        {imfLoanDisabled && (
          <p className="mt-2 text-[11px] font-semibold text-red-400">
            ⚠️ صندوق النقد الدولي يرفض التعامل مع دولة مصطفة شرقًا
          </p>
        )}
      </div>
    </div>
  );
}
