import { z } from "zod";

/**
 * Structural schema for the persisted campaign (the `partialize` output).
 * Loaded state is validated against this after migration; anything that
 * fails — corrupted, hand-edited into an invalid shape, or outdated beyond
 * what migration can repair — is rejected so the store falls back to a clean
 * default instead of crashing on malformed data.
 */
const num = z.number().finite();
const idString = z.string();

const regionSchema = z.object({
  id: idString,
  name: z.string(),
  population: num,
  infrastructureLevel: num,
  isCoastal: z.boolean(),
  isBorder: z.boolean(),
  unemploymentRate: num,
  developmentIndex: num,
  educationRate: num,
  securityLevel: num,
  currentNeeds: z.array(z.string()),
  completedProjects: z.array(z.string()),
  stateSatisfaction: num,
  nationalBelonging: num,
  isUnderRebelControl: z.boolean(),
  diplomacyExhausted: z.boolean(),
  siegeTurns: num,
  shadowEconomyLevel: num,
  crackdownActive: z.boolean(),
  activeHarka: z.boolean(),
  activeInfiltration: z.boolean(),
  isStriking: z.boolean(),
  strikeMonths: num,
  securityCampaignMonths: num,
});

const activeProjectSchema = z.object({
  instanceId: z.string(),
  projectId: z.string(),
  regionId: idString,
  monthsRemaining: num,
});

const completedProjectSchema = z.object({
  instanceId: z.string(),
  projectId: z.string(),
  regionId: idString,
});

const gameStateSchema = z.object({
  currentDate: z.string(),
  totalBudget: num,
  hardCurrency: num,
  techLevel: num,
  currentEvent: z.unknown().nullable(),
  politicalEvent: z.unknown().nullable(),
  politicalCooldown: num,
  regionEventCooldowns: z.record(z.string(), num),
  boomedRegions: z.array(idString),
  outcome: z.enum(["collapse", "victory"]).nullable(),
  outcomeReason: z.string().nullable(),
  stateCredibility: num,
  sovereignDebt: num,
  criticalStabilityMonths: num,
  isGameOver: z.boolean(),
  purchasingPowerIndex: num,
  bctIndependence: z.boolean(),
  oligarchyControl: num,
  antiMonopolyActive: z.boolean(),
  geopoliticalAlignment: num,
  nationalUnionTruce: num,
  publicWageBurden: num,
  debtGracePeriod: num,
  isDefaulted: z.boolean(),
  isVictorious: z.boolean(),
  playerName: z.string(),
  partyName: z.string(),
  slogan: z.string(),
  presidentAvatar: z.string().nullable(),
  philosophySymbol: z.string(),
  difficulty: z.enum(["easy", "normal", "hard"]),
  hasCompletedTutorial: z.boolean(),
  gameStarted: z.boolean(),
});

export const persistedStateSchema = z.object({
  gameState: gameStateSchema,
  regions: z.record(idString, regionSchema),
  activeProjects: z.array(activeProjectSchema),
  completedProjects: z.array(completedProjectSchema),
  history: z.array(z.unknown()),
  populationTrends: z.record(idString, num),
});

/** Returns true if `value` is a structurally valid persisted campaign. */
export function isValidPersistedState(value: unknown): boolean {
  return persistedStateSchema.safeParse(value).success;
}
