/**
 * Pure probabilistic math for the two-stage rebel crisis. Shared verbatim by
 * the store (which executes the outcome) and the modal (which displays the
 * odds and costs to the player BEFORE they commit) so what the player is shown
 * is exactly what is rolled.
 */

/**
 * STAGE 1 — Major Concessions (تنازلات كبرى). Buying the region back is more
 * likely the more stable the nation already is; clamped to 20–85%.
 */
export const concessionsChance = (nationalStability: number): number =>
  Math.max(20, Math.min(85, nationalStability));

/**
 * STAGE 1 — Local Mediation (وساطة محلية). Local notables can broker peace
 * more readily in a developed governorate; clamped to 15–60%.
 */
export const mediationChance = (localDevelopment: number): number =>
  Math.max(15, Math.min(60, localDevelopment));

/**
 * STAGE 2 — Surgical Strike (ضربة جراحية). Precision operations land far more
 * reliably where the terrain is developed and mapped; clamped to 15–80%.
 */
export const surgicalChance = (localDevelopment: number): number =>
  Math.max(15, Math.min(80, localDevelopment * 1.5));

/**
 * STAGE 2 — Siege & Attrition (الحصار والاستنزاف). A population that still
 * feels it belongs breaks quickly; deep alienation drags the siege out. 2–6
 * months.
 */
export const siegeTurnsFor = (localBelonging: number): number =>
  Math.max(2, 6 - Math.floor(localBelonging / 2));

/**
 * STAGE 2 — Scorched Earth (الأرض المحروقة) hard-currency loss (M USD),
 * scaled by the population caught in the crossfire; clamped to 5–50.
 */
export const scorchedUsdLoss = (population: number): number =>
  Math.min(50, Math.max(5, Math.floor(population / 50000)));

/**
 * STAGE 2 — Scorched Earth satisfaction collapse (points), scaled by the
 * population that witnessed the devastation.
 */
export const scorchedSatDrop = (population: number): number =>
  Math.floor(5 + population / 100000);

/**
 * The single RNG gate. `true` when the roll lands at or under the odds.
 * Stubbing `Math.random` makes every crisis outcome deterministic in tests.
 */
export const rollSuccess = (successChance: number): boolean =>
  Math.random() * 100 <= successChance;
