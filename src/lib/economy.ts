import type {
  ActiveProject,
  CompletedProject,
  Region,
  RegionId,
} from "@/types/game";
import { getProjectTemplate } from "@/data/projects";

/** A region may not run more construction sites than this at once. */
export const MAX_ACTIVE_PROJECTS_PER_REGION = 2;

/** Flat upkeep of an ongoing construction site, in million TND per month. */
export const ACTIVE_PROJECT_UPKEEP_TND = 2;

/** Share of regional economic output collected by the state each year. */
const ANNUAL_TAX_RATE = 0.05;

/**
 * Monthly tax income of one region in million TND:
 * (population × (infrastructureLevel / 10) × 0.05) / 12, with population
 * counted in thousands so national income (~25M TND/month at campaign start)
 * stays on the same order of magnitude as project costs and maintenance —
 * counting raw inhabitants would yield ~25,000M/month and make debt
 * unreachable.
 */
export function monthlyRegionIncome(region: Region): number {
  return (
    ((region.population / 1_000) *
      (region.infrastructureLevel / 10) *
      ANNUAL_TAX_RATE) /
    12
  );
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
