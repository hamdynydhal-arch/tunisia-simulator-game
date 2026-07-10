"use client";

import { useGameStore } from "@/store/gameStore";
import { PROJECT_TEMPLATES, getProjectTemplate } from "@/data/projects";
import { MAX_ACTIVE_PROJECTS_PER_REGION } from "@/lib/economy";
import { formatMillions, formatMonths, formatNumber } from "@/lib/format";

/**
 * Placeholder detail panel for the selected governorate.
 * Renders as a bottom sheet on mobile; on desktop it is a static column at
 * inline-start (the physical right edge in RTL) and slides in from there.
 */
export default function RegionSidebar() {
  const region = useGameStore((state) =>
    state.selectedRegionId ? state.regions[state.selectedRegionId] : null,
  );
  const selectRegion = useGameStore((state) => state.selectRegion);
  const gameState = useGameStore((state) => state.gameState);
  const activeProjects = useGameStore((state) => state.activeProjects);
  const startProject = useGameStore((state) => state.startProject);
  const toggleCrackdown = useGameStore((state) => state.toggleCrackdown);
  const resolveStrike = useGameStore((state) => state.resolveStrike);
  const populationTrend = useGameStore((state) =>
    state.selectedRegionId
      ? (state.populationTrends[state.selectedRegionId] ?? 0)
      : 0,
  );

  if (!region) {
    return null;
  }

  const regionProjects = activeProjects.filter(
    (project) => project.regionId === region.id,
  );
  const atCapacity = regionProjects.length >= MAX_ACTIVE_PROJECTS_PER_REGION;

  // Recommended projects (the region's needs, in priority order) come first.
  // A project is locked by an unmet tech-tree prerequisite OR by the national
  // tech level being below its requirement.
  const isLocked = (template: (typeof PROJECT_TEMPLATES)[number]) =>
    (template.requiresCompleted ?? []).some(
      (requiredId) => !region.completedProjects.includes(requiredId),
    ) ||
    (template.requiresTechLevel !== undefined &&
      gameState.techLevel < template.requiresTechLevel);
  const needRank = (template: (typeof PROJECT_TEMPLATES)[number]) => {
    if (isLocked(template)) {
      return Number.MAX_SAFE_INTEGER; // tech-tree-locked projects sink last
    }
    const rank = region.currentNeeds.indexOf(template.id);
    return rank === -1 ? 1_000 : rank;
  };
  const orderedTemplates = [...PROJECT_TEMPLATES].sort(
    (a, b) => needRank(a) - needRank(b),
  );

  return (
    <aside
      aria-label={`تفاصيل ولاية ${region.name}`}
      className="fixed inset-x-0 bottom-0 z-10 max-h-[70dvh] animate-slide-in-up overflow-y-auto rounded-t-2xl border-t border-slate-700 bg-slate-900/95 p-5 shadow-2xl backdrop-blur md:static md:z-auto md:max-h-none md:w-80 md:shrink-0 md:animate-slide-in-right md:rounded-none md:border-e md:border-t-0"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">{region.name}</h2>
          <p className="text-sm text-slate-400">ولاية</p>
        </div>
        <button
          type="button"
          onClick={() => selectRegion(null)}
          aria-label="إغلاق اللوحة"
          className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M4.3 4.3a1 1 0 0 1 1.4 0L10 8.6l4.3-4.3a1 1 0 1 1 1.4 1.4L11.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 0 1-1.4-1.4L8.6 10 4.3 5.7a1 1 0 0 1 0-1.4Z" />
          </svg>
        </button>
      </div>

      <dl className="mt-6 space-y-5">
        <div>
          <dt className="text-xs text-slate-400">عدد السكان</dt>
          <dd className="mt-1 flex items-center gap-2 text-lg font-medium tabular-nums text-slate-100">
            <span>{formatNumber(region.population)}</span>
            {populationTrend !== 0 && (
              <span
                dir="ltr"
                title={
                  populationTrend > 0
                    ? "نمو سكاني (توافد) — التغير الشهري"
                    : "تراجع سكاني (نزوح) — التغير الشهري"
                }
                aria-label={
                  populationTrend > 0
                    ? `نمو سكاني بمقدار ${formatNumber(populationTrend)} شهريًا`
                    : `تراجع سكاني بمقدار ${formatNumber(Math.abs(populationTrend))} شهريًا`
                }
                className={`inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold ${
                  populationTrend > 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current" aria-hidden="true">
                  {populationTrend > 0 ? (
                    <path d="M6 2.5 10 9H2z" />
                  ) : (
                    <path d="M6 9.5 2 3h8z" />
                  )}
                </svg>
                {populationTrend > 0 ? "+" : "−"}
                {formatNumber(Math.abs(populationTrend))}
              </span>
            )}
          </dd>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <dt className="text-xs text-slate-400">نسبة البطالة</dt>
            <dd
              className={`mt-1 text-lg font-medium tabular-nums ${
                region.unemploymentRate >= 20
                  ? "text-red-400"
                  : region.unemploymentRate >= 15
                    ? "text-amber-300"
                    : "text-emerald-400"
              }`}
            >
              {region.unemploymentRate.toFixed(1)}٪
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">مؤشر التنمية</dt>
            <dd className="mt-1 text-lg font-medium tabular-nums text-slate-100">
              {Math.round(region.developmentIndex)}/100
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">نسبة التعليم</dt>
            <dd className="mt-1 text-lg font-medium tabular-nums text-slate-100">
              {Math.round(region.educationRate)}/100
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">مستوى الأمن</dt>
            <dd
              className={`mt-1 text-lg font-medium tabular-nums ${
                region.securityLevel < 55 ? "text-red-400" : "text-slate-100"
              }`}
            >
              {Math.round(region.securityLevel)}/100
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">رضا المواطنين</dt>
            <dd
              className={`mt-1 text-lg font-medium tabular-nums ${
                region.stateSatisfaction < 40
                  ? "text-red-400"
                  : region.stateSatisfaction < 55
                    ? "text-amber-300"
                    : "text-emerald-400"
              }`}
            >
              {Math.round(region.stateSatisfaction)}/100
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">الانتماء الوطني</dt>
            <dd
              className={`mt-1 text-lg font-medium tabular-nums ${
                region.nationalBelonging < 40
                  ? "text-red-400"
                  : region.nationalBelonging < 60
                    ? "text-amber-300"
                    : "text-emerald-400"
              }`}
            >
              {Math.round(region.nationalBelonging)}/100
            </dd>
          </div>
        </div>
        {region.currentNeeds.length > 0 && (
          <div>
            <dt className="text-xs text-slate-400">الاحتياجات الحالية</dt>
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {region.currentNeeds.map((needId) => (
                <span
                  key={needId}
                  className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-300"
                >
                  {getProjectTemplate(needId)?.name ?? needId}
                </span>
              ))}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-slate-400">مستوى البنية التحتية</dt>
          <dd className="mt-2 flex items-center gap-3">
            <div className="flex flex-1 gap-1" aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 flex-1 rounded-sm ${
                    i < region.infrastructureLevel
                      ? "bg-emerald-500"
                      : "bg-slate-700"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-medium tabular-nums text-slate-100">
              {region.infrastructureLevel}/10
            </span>
          </dd>
        </div>
      </dl>

      {!region.isUnderRebelControl && (
        <section className="mt-8">
          <h3 className="text-sm font-semibold text-slate-300">
            الاقتصاد الموازي
          </h3>
          <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/40 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">حجم التهريب</span>
              <span
                className={`font-bold tabular-nums ${
                  region.shadowEconomyLevel > 60
                    ? "text-red-400"
                    : region.shadowEconomyLevel > 30
                      ? "text-amber-300"
                      : "text-emerald-400"
                }`}
              >
                {Math.round(region.shadowEconomyLevel)}٪
              </span>
            </div>
            {region.crackdownActive ? (
              <>
                <p className="mt-2 text-xs text-amber-300">
                  ⚠️ حملة أمنية جارية: الاقتصاد الموازي يتراجع لكن رضا
                  المواطنين ينهار شهريًا.
                </p>
                <button
                  type="button"
                  onClick={() => toggleCrackdown(region.id)}
                  className="mt-3 w-full rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-200 transition-colors hover:bg-amber-500/20"
                >
                  إيقاف الحملة الأمنية
                </button>
              </>
            ) : (
              <>
                {region.shadowEconomyLevel > 30 && (
                  <p className="mt-2 text-xs text-slate-400">
                    الجباية معطّلة هنا بسبب اتساع الاقتصاد الموازي — لكن
                    الأهالي راضون عن العائد غير المعلن.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => toggleCrackdown(region.id)}
                  title="تحذير: يوقف نزيف الجباية، لكنه يفتك برضا المواطنين محليًا مع الوقت وقد يشعل التمرد."
                  className="mt-3 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-500"
                >
                  إطلاق حملة أمنية لتجفيف المنابع
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {(region.activeHarka || region.activeInfiltration) && (
        <div className="mt-4 space-y-2">
          {region.activeHarka && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
              🚨 أزمة هجرة بحرية (الحرقة): نزيف ديموغرافي وعقوبات مالية
            </p>
          )}
          {region.activeInfiltration && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
              🚨 اختراق حدودي بري: احتقان اجتماعي بسبب التدفق غير النظامي
            </p>
          )}
        </div>
      )}

      {region.isStriking && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
          <p className="text-xs font-semibold text-red-300">
            🚨 إضراب عام: شلل اقتصادي تام
          </p>
          <button
            type="button"
            onClick={() => resolveStrike(region.id)}
            disabled={gameState.totalBudget < 50}
            title={gameState.totalBudget < 50 ? "الميزانية غير كافية" : undefined}
            className="mt-2 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          >
            مفاوضات نقابية (تكلفة: 50 مليون)
          </button>
        </div>
      )}

      <section className="mt-8">
        <h3 className="text-sm font-semibold text-slate-300">المشاريع المتاحة</h3>
        {atCapacity && (
          <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
            الحد الأقصى للمشاريع النشطة ممتلئ
          </p>
        )}
        <ul className="mt-3 space-y-3">
          {orderedTemplates.map((template) => {
            const recommended = region.currentNeeds.includes(template.id);
            const affordable =
              gameState.totalBudget >= template.costTND &&
              gameState.hardCurrency >= template.costUSD;
            const coastalBlocked =
              (template.requiresCoastal ?? false) && !region.isCoastal;
            const prereqMissing = (template.requiresCompleted ?? []).filter(
              (id) => !region.completedProjects.includes(id),
            );
            const techLocked =
              template.requiresTechLevel !== undefined &&
              gameState.techLevel < template.requiresTechLevel;
            const locked = prereqMissing.length > 0 || techLocked;
            const lockReason = techLocked
              ? `يتطلب مستوى تكنولوجي ${template.requiresTechLevel} (الحالي ${Math.round(gameState.techLevel)})`
              : prereqMissing.length > 0
                ? `يتطلب إنجاز: ${prereqMissing
                    .map((id) => getProjectTemplate(id)?.name ?? id)
                    .join("، ")}`
                : undefined;
            return (
              <li
                key={template.id}
                className={`rounded-lg border p-3 ${
                  recommended
                    ? "border-sky-500/50 bg-sky-500/5"
                    : "border-slate-700 bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-100">
                    {template.name}
                    {recommended && (
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                        موصى به
                      </span>
                    )}
                    {locked && (
                      <span
                        role="img"
                        aria-label="مقفل"
                        title={lockReason}
                        className="text-xs"
                      >
                        🔒
                      </span>
                    )}
                    {template.requiresCoastal && (
                      <span
                        role="img"
                        aria-label="مشروع ساحلي"
                        title="مشروع ساحلي"
                        className="text-xs"
                      >
                        🌊
                      </span>
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={() => startProject(template.id, region.id)}
                    disabled={locked || coastalBlocked || !affordable || atCapacity}
                    aria-label={`بناء ${template.name}`}
                    title={
                      locked
                        ? lockReason
                        : coastalBlocked
                          ? "يتطلب ولاية ساحلية"
                          : atCapacity
                            ? "الحد الأقصى للمشاريع النشطة ممتلئ"
                            : affordable
                              ? undefined
                              : "الأموال غير كافية"
                    }
                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-emerald-500 active:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                  >
                    بناء
                  </button>
                </div>
                {coastalBlocked && (
                  <p className="mt-2 text-xs font-medium text-sky-400">
                    🌊 يتطلب ولاية ساحلية
                  </p>
                )}
                {locked && (
                  <p className="mt-2 text-xs font-medium text-slate-400">
                    🔒 {lockReason}
                  </p>
                )}
                <p className="mt-2 text-xs tabular-nums text-slate-400">
                  {formatMillions(template.costTND, "TND")}
                  {" · "}
                  {formatMillions(template.costUSD, "USD")}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  المدة: {formatMonths(template.durationMonths)} · الأثر: بنية
                  تحتية +{template.effects.infrastructureChange}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  الصيانة: {formatMillions(template.maintenanceCostTND, "TND")}{" "}
                  شهريًا · التشغيل: {formatNumber(template.jobsCreated)} موطن
                  شغل
                </p>
                {template.maintenanceUSD !== undefined && (
                  <p className="mt-1 text-xs text-slate-500">
                    صيانة بالعملة الصعبة: {template.maintenanceUSD}م $/شهر
                  </p>
                )}
                {template.directIncomeTND !== undefined && (
                  <p className="mt-1 text-xs font-semibold text-emerald-400">
                    العائد المباشر: +{template.directIncomeTND}م د.ت/شهر
                  </p>
                )}
                {template.exportUSD !== undefined && (
                  <p className="mt-1 text-xs font-semibold text-sky-400">
                    صادرات: +{template.exportUSD}م $/شهر
                  </p>
                )}
                {template.techPointsPerMonth !== undefined && (
                  <p className="mt-1 text-xs font-semibold text-violet-300">
                    🔬 نقاط علمية: +{template.techPointsPerMonth}/شهر
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h3 className="text-sm font-semibold text-slate-300">قيد الإنجاز</h3>
        {regionProjects.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-slate-700 p-3 text-sm text-slate-500">
            لا توجد مشاريع قيد الإنجاز في هذه الولاية.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {regionProjects.map((project) => (
              <li
                key={project.instanceId}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-3"
              >
                <span className="text-sm font-medium text-slate-100">
                  {getProjectTemplate(project.projectId)?.name ?? project.projectId}
                </span>
                <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium tabular-nums text-amber-300">
                  متبقي {formatMonths(project.monthsRemaining)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
