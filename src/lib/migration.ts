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

/** Below this development, or below this satisfaction, a coastal governorate
 *  bleeds people to the sea. */
const HARKA_DEVELOPMENT_THRESHOLD = 35;
const HARKA_SATISFACTION_THRESHOLD = 30;
/** Share of a Harka-eligible governorate's population lost each month. */
const HARKA_POPULATION_RATE = 0.005;
/** EU diplomatic friction / brain-drain cost per affected governorate, M USD. */
const HARKA_HARD_CURRENCY_COST = 2;

/** Above this shadow-economy level, and absent a crackdown, a border
 *  governorate absorbs an undocumented population influx. */
const INFILTRATION_SHADOW_THRESHOLD = 50;
/** Share of population gained by an infiltration-eligible governorate. */
const INFILTRATION_POPULATION_RATE = 0.005;
const INFILTRATION_SATISFACTION_PENALTY = 3;

export interface HarkaInfiltrationResult {
  regions: Record<RegionId, Region>;
  /** Applied to `GameState.hardCurrency`; ≤ 0, million USD. */
  hardCurrencyDelta: number;
}

/**
 * Two deterministic, RNG-free monthly consequences layered on the internal
 * migration engine:
 *
 * - الحرقة (Harka, maritime exit): a struggling COASTAL governorate — low
 *   development or low satisfaction — bleeds 0.5% of its population to
 *   Europe every month, and the exodus costs the state hard currency (EU
 *   diplomatic friction, brain drain).
 * - اختراق حدودي (border infiltration): a BORDER governorate whose shadow
 *   economy has taken over, and that the State isn't actively cracking down
 *   on, absorbs an undocumented 0.5% population influx that strains local
 *   satisfaction.
 *
 * A region can be both (e.g. Médenine, coastal and a border governorate at
 * once). `activeHarka`/`activeInfiltration` are recomputed fresh every call,
 * so a region that resolves its conditions clears its flag the same month.
 */
export function applyHarkaAndInfiltration(
  regions: Record<RegionId, Region>,
): HarkaInfiltrationResult {
  let next: Record<RegionId, Region> | null = null;
  let hardCurrencyDelta = 0;

  for (const region of Object.values(regions)) {
    const harka =
      region.isCoastal &&
      (region.developmentIndex < HARKA_DEVELOPMENT_THRESHOLD ||
        region.stateSatisfaction < HARKA_SATISFACTION_THRESHOLD);
    const infiltration =
      region.isBorder &&
      region.shadowEconomyLevel > INFILTRATION_SHADOW_THRESHOLD &&
      !region.crackdownActive;

    if (!harka && !infiltration) {
      if (region.activeHarka || region.activeInfiltration) {
        next ??= { ...regions };
        next[region.id] = {
          ...region,
          activeHarka: false,
          activeInfiltration: false,
        };
      }
      continue;
    }

    next ??= { ...regions };
    let updated = region;
    if (harka) {
      const lost = Math.floor(region.population * HARKA_POPULATION_RATE);
      updated = {
        ...updated,
        population: Math.max(0, updated.population - lost),
      };
      hardCurrencyDelta -= HARKA_HARD_CURRENCY_COST;
    }
    if (infiltration) {
      const gained = Math.floor(region.population * INFILTRATION_POPULATION_RATE);
      updated = {
        ...updated,
        population: updated.population + gained,
        stateSatisfaction: clamp(
          updated.stateSatisfaction - INFILTRATION_SATISFACTION_PENALTY,
          0,
          100,
        ),
      };
    }
    next[region.id] = { ...updated, activeHarka: harka, activeInfiltration: infiltration };
  }

  return { regions: next ?? regions, hardCurrencyDelta };
}
