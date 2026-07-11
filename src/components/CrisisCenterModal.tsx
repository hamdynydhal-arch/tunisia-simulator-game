"use client";

import { useGameStore } from "@/store/gameStore";
import type { Region } from "@/types/game";

/** Lower rank sorts first: strikes are the most acute crisis, shadow economy
 *  the least (it's chronic, not a sudden rupture). */
function severityRank(region: Region): number {
  if (region.isStriking) return 0;
  if (region.activeInfiltration) return 1;
  if (region.activeHarka) return 2;
  return 3;
}

const isInCrisis = (region: Region) =>
  region.isStriking ||
  region.activeHarka ||
  region.activeInfiltration ||
  region.shadowEconomyLevel > 50;

/**
 * National Crisis Center: a single briefing screen aggregating every region
 * currently in crisis, with direct quick-action dispatch — no need to open
 * the RegionSidebar and hunt down each governorate individually.
 */
export default function CrisisCenterModal() {
  const open = useGameStore((state) => state.crisisCenterOpen);
  const toggleCrisisCenter = useGameStore((state) => state.toggleCrisisCenter);
  const regions = useGameStore((state) => state.regions);
  const budget = useGameStore((state) => state.gameState.totalBudget);
  const resolveStrike = useGameStore((state) => state.resolveStrike);
  const crackdownStrike = useGameStore((state) => state.crackdownStrike);
  const toggleCrackdown = useGameStore((state) => state.toggleCrackdown);
  const selectRegion = useGameStore((state) => state.selectRegion);

  if (!open) {
    return null;
  }

  const crises = Object.values(regions)
    .filter(isInCrisis)
    .sort((a, b) => severityRank(a) - severityRank(b));

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="المركز الوطني لإدارة الأزمات"
        className="w-full max-w-2xl animate-slide-in-down rounded-2xl border-2 border-red-600/40 bg-slate-950/95 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-red-900/40 pb-3">
          <div>
            <h2 className="text-xl font-bold text-red-300">
              🚨 المركز الوطني لإدارة الأزمات
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {crises.length > 0
                ? `${crises.length} ولاية تتطلب تدخلاً فوريًا`
                : "لا توجد أزمات نشطة حاليًا"}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleCrisisCenter}
            aria-label="إغلاق المركز"
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M4.3 4.3a1 1 0 0 1 1.4 0L10 8.6l4.3-4.3a1 1 0 1 1 1.4 1.4L11.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 0 1-1.4-1.4L8.6 10 4.3 5.7a1 1 0 0 1 0-1.4Z" />
            </svg>
          </button>
        </div>

        {crises.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">
            ✅ الوضع تحت السيطرة — لا توجد إضرابات أو اختراقات أو اقتصاد موازٍ
            متفشٍّ يتطلب تدخلاً.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {crises.map((region) => {
              const shadowCrisis = region.shadowEconomyLevel > 50;
              return (
                <li
                  key={region.id}
                  className="rounded-xl border border-slate-700 bg-slate-900/60 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        selectRegion(region.id);
                        toggleCrisisCenter();
                      }}
                      className="text-sm font-bold text-slate-100 underline decoration-slate-600 underline-offset-2 hover:text-sky-300"
                    >
                      {region.name}
                    </button>
                    <div className="flex flex-wrap gap-1.5">
                      {region.isStriking && (
                        <span className="rounded-full border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">
                          إضراب عام
                        </span>
                      )}
                      {region.activeInfiltration && (
                        <span className="rounded-full border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">
                          اختراق حدودي
                        </span>
                      )}
                      {region.activeHarka && (
                        <span className="rounded-full border border-orange-500/50 bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                          هجرة بحرية (حرقة)
                        </span>
                      )}
                      {shadowCrisis && (
                        <span className="rounded-full border border-orange-500/50 bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                          اقتصاد موازٍ {Math.round(region.shadowEconomyLevel)}٪
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {region.isStriking && (
                      <>
                        <button
                          type="button"
                          onClick={() => resolveStrike(region.id)}
                          disabled={budget < 50}
                          title={
                            budget < 50
                              ? "الميزانية غير كافية"
                              : "50م د.ت · ينهي الإضراب ويرفع الرضا +15"
                          }
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                        >
                          مفاوضات نقابية (50م)
                        </button>
                        <button
                          type="button"
                          onClick={() => crackdownStrike(region.id)}
                          title="مجاني. ينهي الإضراب فوراً لكنه يدمر الأمن المحلي (-20) ويزيد الاحتقان (-10)، مما قد يشعل تمرداً مسلحاً."
                          className="rounded-lg border border-red-500/60 bg-red-950/40 px-3 py-1.5 text-xs font-bold text-red-300 transition-colors hover:bg-red-950/70"
                        >
                          كسر بالقوة
                        </button>
                      </>
                    )}
                    {shadowCrisis && (
                      <button
                        type="button"
                        onClick={() => toggleCrackdown(region.id)}
                        title={
                          region.crackdownActive
                            ? "إيقاف الحملة الأمنية الجارية"
                            : "تحذير: يوقف نزيف الجباية، لكنه يفتك برضا المواطنين محليًا مع الوقت وقد يشعل التمرد."
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                          region.crackdownActive
                            ? "border border-amber-500/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                            : "bg-orange-700 text-white hover:bg-orange-600"
                        }`}
                      >
                        {region.crackdownActive
                          ? "إيقاف الحملة الأمنية"
                          : "إطلاق حملة أمنية"}
                      </button>
                    )}
                    {(region.activeHarka || region.activeInfiltration) && (
                      <p className="text-[11px] font-medium text-orange-300/90">
                        {region.activeHarka && region.activeInfiltration
                          ? "⚠️ الحرقة والاختراق الحدودي يتطلبان تنمية جهوية أو إجراءات سيادية كبرى — لا حل سريع."
                          : region.activeHarka
                            ? "⚠️ الحرقة تتطلب تنمية جهوية أو معالجة اقتصادية كلية — لا حل سريع."
                            : "⚠️ الاختراق الحدودي يتطلب معالجة الاقتصاد الموازي جذريًا — لا حل سريع."}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
