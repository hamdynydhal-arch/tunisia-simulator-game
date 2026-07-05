import type {
  ActiveProject,
  CompletedProject,
  ProjectTemplate,
  Region,
  RegionId,
} from "@/types/game";
import { getProjectTemplate } from "@/data/projects";

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
const ANNUAL_TAX_RATE = 0.075;

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

  return {
    ...region,
    infrastructureLevel: Math.min(
      MAX_INFRASTRUCTURE_LEVEL,
      Math.max(
        0,
        region.infrastructureLevel + template.effects.infrastructureChange,
      ),
    ),
    unemploymentRate: Math.round(newUnemploymentRate * 10) / 10,
    developmentIndex: Math.min(
      MAX_DEVELOPMENT_INDEX,
      Math.round(
        (region.developmentIndex +
          template.effects.infrastructureChange * 2 +
          unemploymentDrop * 1.5) *
          10,
      ) / 10,
    ),
    completedProjects: [...region.completedProjects, template.id],
  };
}

export interface MonthlyFinances {
  /** Total tax income across all regions, million TND. */
  income: number;
  /** Construction upkeep plus completed-project maintenance, million TND. */
  expenses: number;
  /** income − expenses; applied to the budget on every tick. */
  net: number;
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
  for (const project of completedProjects) {
    const template = getProjectTemplate(project.projectId);
    if (!template) {
      continue;
    }
    expenses += template.maintenanceCostTND;
    income += template.directIncomeTND ?? 0;
  }

  return { income, expenses, net: income - expenses };
}
