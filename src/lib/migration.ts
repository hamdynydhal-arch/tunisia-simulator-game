import type { Region, RegionId } from "@/types/game";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Below this development score a governorate is "failing" and sheds
 *  population toward the single most developed governorate nationally. */
const FAILING_DEVELOPMENT_THRESHOLD = 25;
/** Share of a failing region's population that migrates out each month. */
const MIGRATION_RATE = 0.01;
/** Overcrowding cost the destination pays per contributing region ("batch")
 *  it absorbs migrants from this month. */
const OVERCROWDING_DEV_PENALTY = 1;
const OVERCROWDING_SATISFACTION_PENALTY = 2;

/**
 * Deterministic, RNG-free internal migration: any governorate whose
 * developmentIndex has collapsed below 25 sheds 1% of its population every
 * month to the single most-developed governorate in the country. The
 * receiving governorate pays an overcrowding cost — a flat development and
 * satisfaction hit per contributing region this month — modelling a magnet
 * city straining under an influx it never planned for.
 */
export function applyDevelopmentMigration(
  regions: Record<RegionId, Region>,
): Record<RegionId, Region> {
  const list = Object.values(regions);
  let destination = list[0];
  for (const region of list) {
    if (region.developmentIndex > destination.developmentIndex) {
      destination = region;
    }
  }

  const next = { ...regions };
  let migrantsTotal = 0;
  let batches = 0;
  for (const region of list) {
    if (
      region.id === destination.id ||
      region.developmentIndex >= FAILING_DEVELOPMENT_THRESHOLD
    ) {
      continue;
    }
    const migrants = Math.floor(region.population * MIGRATION_RATE);
    if (migrants <= 0) {
      continue;
    }
    next[region.id] = {
      ...region,
      population: Math.max(0, region.population - migrants),
    };
    migrantsTotal += migrants;
    batches += 1;
  }

  if (batches === 0) {
    return regions;
  }

  next[destination.id] = {
    ...destination,
    population: destination.population + migrantsTotal,
    developmentIndex: clamp(
      destination.developmentIndex - OVERCROWDING_DEV_PENALTY * batches,
      0,
      100,
    ),
    stateSatisfaction: clamp(
      destination.stateSatisfaction - OVERCROWDING_SATISFACTION_PENALTY * batches,
      0,
      100,
    ),
  };
  return next;
}
