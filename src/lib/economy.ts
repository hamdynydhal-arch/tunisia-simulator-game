import type {
  ActiveProject,
  CompletedProject,
  ProjectTemplate,
  Region,
  RegionId,
} from "@/types/game";
import { UNLOCK_CHAINS, getProjectTemplate } from "@/data/projects";

/** A region may not run more construction sites than this at once. */
export const MAX_ACTIVE_PROJECTS_PER_REGION = 2;

/** Flat upkeep of an ongoing construction site, in million TND per month. */
export const ACTIVE_PROJECT_UPKEEP_TND = 2;

/** Share of the active population actually in the labour market. */
export const WORKFORCE_PARTICIPATION = 0.35;

/** Structural floor below which unemployment cannot fall. */
export const MIN_UNEMPLOYMENT_RATE = 4;

const MAX_INFRASTRUCTURE_LEVEL = 10;
const MAX_DEVELOPMENT_INDEX = 100;

/** Share of regional economic output collected by the state each year. */
export const ANNUAL_TAX_RATE = 0.075;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Monthly tax income of one region in million TND.
 *
 * Model: each employed worker produces ~1,000 TND of taxable annual output,
 * scaled by how developed the region is — infrastructure (0–1) opens markets
 * and the development index (0.5–1.0) raises productivity — and the state
 * collects ANNUAL_TAX_RATE of it, split into monthly instalments:
 *
 *   income = workers_employed(k) × (infra/10) × (0.5 + dev/200) × rate / 12
 *
 * Population is counted in thousands so national income (~25M TND/month at
 * campaign start) stays on the same order of magnitude as project costs.
 * Completing projects lowers unemployment and raises infrastructure and
 * development, so tax revenue keeps compounding on every later tick.
 */
export function monthlyRegionIncome(region: Region): number {
  const employedThousands =
    (region.population / 1_000) * (1 - region.unemploymentRate / 100);
  return (
    (employedThousands *
      (region.infrastructureLevel / 10) *
      (0.5 + region.developmentIndex / 200) *
      ANNUAL_TAX_RATE) /
    12
  );
}

/**
 * Socio-economic consequences of finishing one project in a region.
 *
 * 1. Employment: the project's jobs absorb part of the unemployed pool —
 *    newRate = (unemployed − jobsCreated) / workforce, floored at the
 *    structural minimum. Bigger regions therefore feel the same project
 *    less than small ones, which is the real dynamic.
 * 2. Development: rises with the hard infrastructure delivered (×2) and
 *    with every point of unemployment absorbed (×1.5), capped at 100.
 * 3. Infrastructure: the template's direct effect, clamped to 0–10.
 *
 * Higher employment, development, and infrastructure all feed
 * `monthlyRegionIncome`, which is how completions turn into continuous
 * tax revenue for the national budget on subsequent months.
 */
export function applyProjectCompletion(
  region: Region,
  template: ProjectTemplate,
): Region {
  const workforce = region.population * WORKFORCE_PARTICIPATION;
  const unemployed = workforce * (region.unemploymentRate / 100);
  const stillUnemployed = Math.max(0, unemployed - template.jobsCreated);
  const newUnemploymentRate = Math.max(
    MIN_UNEMPLOYMENT_RATE,
    (stillUnemployed / workforce) * 100,
  );
  const unemploymentDrop = region.unemploymentRate - newUnemploymentRate;

  const completedProjects = [...region.completedProjects, template.id];

  // Dynamic needs: the fulfilled need is retired, and completing a chain
  // project unlocks the next tier (school → university → tech hub, …).
  const remainingNeeds = region.currentNeeds.filter(
    (needId) => needId !== template.id,
  );
  const unlockedNeeds = (UNLOCK_CHAINS[template.id] ?? []).filter(
    (nextId) =>
      !remainingNeeds.includes(nextId) && !completedProjects.includes(nextId),
  );

  return {
    ...region,
    infrastructureLevel: clamp(
      region.infrastructureLevel + template.effects.infrastructureChange,
      0,
      MAX_INFRASTRUCTURE_LEVEL,
    ),
    unemploymentRate: round2(newUnemploymentRate),
    developmentIndex: round2(
      clamp(
        region.developmentIndex +
          template.effects.infrastructureChange * 2 +
          unemploymentDrop * 1.5,
        0,
        MAX_DEVELOPMENT_INDEX,
      ),
    ),
    educationRate: clamp(
      region.educationRate + (template.effects.educationChange ?? 0),
      0,
      100,
    ),
    securityLevel: clamp(
      region.securityLevel + (template.effects.securityChange ?? 0),
      0,
      100,
    ),
    currentNeeds: [...remainingNeeds, ...unlockedNeeds],
    completedProjects,
  };
}

/**
 * The "neural" monthly cascade, applied to every region on each tick:
 *
 *   education → unemployment: attainment above 50 slowly absorbs the
 *   unemployed pool (up to −0.2 pts/month at 100), below 50 lets it creep
 *   back up — so a school built today keeps paying off for years;
 *
 *   employment + infrastructure + education → development: the index
 *   converges 3%/month toward the region's structural potential
 *   (0.35·infra + 0.35·education + 0.30·employment score), which then
 *   feeds `monthlyRegionIncome` — the regional-wealth link.
 */
export function applyMonthlyDrift(region: Region): Region {
  const unemploymentRate = clamp(
    region.unemploymentRate - (region.educationRate - 50) * 0.004,
    MIN_UNEMPLOYMENT_RATE,
    35,
  );
  const employmentScore = clamp(100 - unemploymentRate * 2.5, 0, 100);
  const potential =
    0.35 * region.infrastructureLevel * 10 +
    0.35 * region.educationRate +
    0.3 * employmentScore;
  const developmentIndex = clamp(
    region.developmentIndex + (potential - region.developmentIndex) * 0.03,
    0,
    MAX_DEVELOPMENT_INDEX,
  );
  return {
    ...region,
    unemploymentRate: round2(unemploymentRate),
    developmentIndex: round2(developmentIndex),
  };
}

export interface NationalMetrics {
  /** Annual national output in million TND (sum of regional output). */
  gdpAnnual: number;
  /** Overall national stability, 0–100. */
  stability: number;
  /** Population-weighted national development index, 0–100. */
  avgDevelopment: number;
  /** Population-weighted development gap between coast and interior. */
  coastInteriorGap: number;
  /** Population-weighted national unemployment, %. */
  avgUnemployment: number;
  /** National aggregate population (persons). */
  totalPopulation: number;
}

/**
 * National metrics as population-weighted aggregates of the 24 governorates.
 * Stability blends employment (40%), development (30%) and security (30%),
 * then subtracts a wealth-distribution-equity penalty: every point of
 * coast-vs-interior development gap beyond 15 costs 1.2 stability — growing
 * the Sahel while ignoring the interior destabilises the whole country.
 */
export function computeNationalMetrics(
  regions: Record<RegionId, Region>,
): NationalMetrics {
  let pop = 0;
  let dev = 0;
  let sec = 0;
  let unemp = 0;
  let coastPop = 0;
  let coastDev = 0;
  let interiorPop = 0;
  let interiorDev = 0;
  let gdpAnnual = 0;

  for (const region of Object.values(regions)) {
    pop += region.population;
    dev += region.developmentIndex * region.population;
    sec += region.securityLevel * region.population;
    unemp += region.unemploymentRate * region.population;
    gdpAnnual += (monthlyRegionIncome(region) * 12) / ANNUAL_TAX_RATE;
    if (region.isCoastal) {
      coastPop += region.population;
      coastDev += region.developmentIndex * region.population;
    } else {
      interiorPop += region.population;
      interiorDev += region.developmentIndex * region.population;
    }
  }

  const avgDev = dev / pop;
  const avgSec = sec / pop;
  const avgUnemployment = unemp / pop;
  const employmentScore = clamp(100 - avgUnemployment * 2.5, 0, 100);
  const coastInteriorGap = coastDev / coastPop - interiorDev / interiorPop;
  const inequalityPenalty = Math.max(0, coastInteriorGap - 15) * 1.2;

  return {
    gdpAnnual,
    avgDevelopment: avgDev,
    stability: clamp(
      0.4 * employmentScore + 0.3 * avgDev + 0.3 * avgSec - inequalityPenalty,
      0,
      100,
    ),
    coastInteriorGap,
    avgUnemployment,
    totalPopulation: pop,
  };
}

export interface MonthlyFinances {
  /** Total tax income across all regions, million TND. */
  income: number;
  /** Construction upkeep plus completed-project maintenance, million TND. */
  expenses: number;
  /** income − expenses; applied to the budget on every tick. */
  net: number;
  /** Export earnings, million USD/month (renews hard-currency reserves). */
  hardCurrencyIncome: number;
  /** Advanced-project upkeep in million USD/month. */
  hardCurrencyExpense: number;
  /** hardCurrencyIncome − hardCurrencyExpense; applied to reserves each tick. */
  hardCurrencyNet: number;
}

/** Finances for the coming month, derived from the current state. */
export function computeMonthlyFinances(
  regions: Record<RegionId, Region>,
  activeProjects: readonly ActiveProject[],
  completedProjects: readonly CompletedProject[],
): MonthlyFinances {
  let income = 0;
  for (const region of Object.values(regions)) {
    income += monthlyRegionIncome(region);
  }

  let expenses = activeProjects.length * ACTIVE_PROJECT_UPKEEP_TND;
  let hardCurrencyIncome = 0;
  let hardCurrencyExpense = 0;
  for (const project of completedProjects) {
    const template = getProjectTemplate(project.projectId);
    if (!template) {
      continue;
    }
    expenses += template.maintenanceCostTND;
    income += template.directIncomeTND ?? 0;
    hardCurrencyIncome += template.exportUSD ?? 0;
    hardCurrencyExpense += template.maintenanceUSD ?? 0;
  }

  return {
    income,
    expenses,
    net: income - expenses,
    hardCurrencyIncome,
    hardCurrencyExpense,
    hardCurrencyNet: hardCurrencyIncome - hardCurrencyExpense,
  };
}

/** Tech points added to the National Tech Level this month. */
export function monthlyTechPoints(
  completedProjects: readonly CompletedProject[],
): number {
  let points = 0;
  for (const project of completedProjects) {
    points += getProjectTemplate(project.projectId)?.techPointsPerMonth ?? 0;
  }
  return points;
}
