import type { Region, RegionId } from "@/types/game";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Baseline monthly natural growth (~1.05%/yr nationally). Less-developed
 * governorates carry a higher fertility premium, mirroring Tunisia's
 * demographic transition — the interior grows faster than the Sahel.
 */
const BASE_NATURAL_MONTHLY = 0.00087;

function naturalGrowthRate(region: Region): number {
  const devPremium = clamp((60 - region.developmentIndex) / 60, -0.35, 0.6);
  return BASE_NATURAL_MONTHLY * (1 + devPremium);
}

/**
 * Monthly share of a struggling region's population that emigrates. Tuned so
 * that a genuinely struggling governorate (unemployment >20%, low development)
 * shows *net* population decline — outflow outweighs its fertility premium —
 * while a region that fixes its unemployment reverts to natural growth.
 */
const EMIGRATION_RATE = 0.006;
/** A governorate never falls below this floor. */
const MIN_POPULATION = 20_000;

/**
 * Monthly demographic tick for all 24 governorates:
 *
 * 1. Natural growth — births minus deaths, fertility-weighted by development.
 * 2. Internal migration (the neural link) — governorates with high
 *    unemployment (>20%) and low development shed workers; the pool is
 *    redistributed to attractive governorates (development >60, unemployment
 *    <18%) in proportion to their pull. When nowhere is attractive, the pool
 *    emigrates abroad (net national loss) — Tunisia's real brain-drain valve.
 *
 * Population feeds `monthlyRegionIncome`, the workforce in project
 * completions, and every population-weighted national metric, so these
 * shifts ripple through the whole economy automatically.
 */
export function applyDemographics(
  regions: Record<RegionId, Region>,
): Record<RegionId, Region> {
  const list = Object.values(regions);

  // 1. Emigration pool from high-unemployment, low-development regions.
  const emigrants: Partial<Record<RegionId, number>> = {};
  let pool = 0;
  for (const region of list) {
    if (region.unemploymentRate > 20 && region.developmentIndex < 55) {
      const intensity =
        ((region.unemploymentRate - 20) / 15) *
        ((55 - region.developmentIndex) / 55 + 0.5);
      const leaving = Math.round(
        region.population * EMIGRATION_RATE * clamp(intensity, 0.35, 2),
      );
      emigrants[region.id] = leaving;
      pool += leaving;
    }
  }

  // 2. Attractiveness weights for the destinations of internal migration.
  const attract: Partial<Record<RegionId, number>> = {};
  let totalAttract = 0;
  for (const region of list) {
    if (region.developmentIndex > 60 && region.unemploymentRate < 18) {
      const pull =
        region.developmentIndex - 60 + (18 - region.unemploymentRate);
      attract[region.id] = pull;
      totalAttract += pull;
    }
  }

  // 3. Apply natural growth and net migration.
  const next: Record<RegionId, Region> = { ...regions };
  for (const region of list) {
    const natural = region.population * naturalGrowthRate(region);
    const out = emigrants[region.id] ?? 0;
    const inflow =
      totalAttract > 0 && attract[region.id]
        ? ((attract[region.id] as number) / totalAttract) * pool
        : 0;
    const population = Math.max(
      MIN_POPULATION,
      Math.round(region.population + natural - out + inflow),
    );
    if (population !== region.population) {
      next[region.id] = { ...region, population };
    }
  }
  return next;
}
