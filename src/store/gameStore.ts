import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { checksummedStorage } from "@/store/persistStorage";
import { isValidPersistedState } from "@/store/schema";
import type {
  ActiveProject,
  CompletedProject,
  Difficulty,
  GameEvent,
  GameOutcome,
  GameState,
  HistoryPoint,
  Region,
  RegionId,
} from "@/types/game";
import { INITIAL_REGIONS } from "@/data/governorates";
import { getProjectTemplate } from "@/data/projects";
import { EVENT_CHANCE, GAME_EVENTS } from "@/data/events";
import {
  MAX_ACTIVE_PROJECTS_PER_REGION,
  applyMonthlyDrift,
  applyProjectCompletion,
  computeMonthlyFinances,
  computeNationalMetrics,
  monthlyTechPoints,
} from "@/lib/economy";
import {
  POLITICAL_COOLDOWN_MONTHS,
  REGION_EVENT_COOLDOWN_MONTHS,
  evaluatePoliticalEvents,
} from "@/lib/eventManager";
import { applyDemographics } from "@/lib/demographics";
import { applyDevelopmentMigration, applyHarkaAndInfiltration } from "@/lib/migration";
import {
  concessionsChance,
  mediationChance,
  rollSuccess,
  scorchedSatDrop,
  scorchedUsdLoss,
  siegeTurnsFor,
  surgicalChance,
} from "@/lib/rebelCrisis";

/** The five committing moves of the two-stage rebel crisis (Martial Law is a
 *  UI-only stage switch and never reaches the store). */
export type RebelAction =
  | "concessions"
  | "mediation"
  | "surgical"
  | "scorched"
  | "siege";

const INITIAL_GAME_STATE: GameState = {
  currentDate: "2026-01-01",
  totalBudget: 5_000,
  hardCurrency: 2_400,
  techLevel: 0,
  currentEvent: null,
  politicalEvent: null,
  politicalCooldown: 0,
  regionEventCooldowns: {},
  boomedRegions: [],
  outcome: null,
  outcomeReason: null,
  stateCredibility: 100,
  sovereignDebt: 0,
  criticalStabilityMonths: 0,
  isGameOver: false,
  purchasingPowerIndex: 100,
  bctIndependence: true,
  oligarchyControl: 80,
  antiMonopolyActive: false,
  geopoliticalAlignment: 50,
  nationalUnionTruce: 0,
  publicWageBurden: 0,
  debtGracePeriod: 0,
  isDefaulted: false,
  isVictorious: false,
  playerName: "",
  partyName: "",
  slogan: "",
  difficulty: "normal",
  hasCompletedTutorial: false,
  gameStarted: false,
};

/** Fixed cost of one propaganda campaign, million TND. */
const PROPAGANDA_COST_TND = 25;
/** Credibility spent per campaign — the Lie Tax. */
const PROPAGANDA_CREDIBILITY_COST = 12;

/** Below this national stability, a month counts toward sustained collapse. */
const CRITICAL_STABILITY_THRESHOLD = 25;
/** Consecutive months at/under the threshold before the regime falls. */
const CRITICAL_STABILITY_MONTHS_LIMIT = 3;
/** Below this local satisfaction, organized labour shuts a region down. */
const STRIKE_SATISFACTION_THRESHOLD = 20;
/** Cost of a union negotiation that ends a strike, million TND. */
const STRIKE_RESOLUTION_COST_TND = 50;
/** Satisfaction restored by resolving a strike. */
const STRIKE_RESOLUTION_SATISFACTION_GAIN = 15;
/** Security cost of breaking a strike by force. */
const STRIKE_CRACKDOWN_SECURITY_HIT = 20;
/** Satisfaction cost of breaking a strike by force. */
const STRIKE_CRACKDOWN_SATISFACTION_HIT = 10;

/**
 * Sovereign debt raised by one emergency loan, million TND — a bookkeeping
 * figure only. Sovereign loans inject foreign currency, not local budget; see
 * LOAN_USD_INJECTION below, which converts this at the Central Bank's rate.
 */
const LOAN_AMOUNT_TND = 500;
/** Austerity hit to every region's nationalBelonging, applied immediately. */
const LOAN_BELONGING_HIT = 15;
/**
 * National stability = 0.4·employment + 0.3·avgDevelopment + 0.3·avgSecurity
 * (see `computeNationalMetrics`). Splitting a flat −10 target evenly across
 * the two 0.3-weighted regional fields (development, security) lands the
 * national stability hit at exactly −10 the moment the loan is taken, and
 * reads as austerity cutting both public investment and security funding.
 */
const LOAN_STABILITY_HIT_PER_FIELD = 10 / 0.6;

/** Abstract fixed exchange rate at the Central Bank: 1 USD = 3 TND. */
const USD_TND_RATE = 3;
/**
 * Hard-currency actually delivered by an emergency loan (IMF or Eastern
 * Bloc): sovereign loans are drawn in foreign currency, converted at the
 * Central Bank's fixed rate — the state must liquidate it for TND like any
 * other reserves. `sovereignDebt` still books the full LOAN_AMOUNT_TND.
 */
const LOAN_USD_INJECTION = Math.floor(LOAN_AMOUNT_TND / USD_TND_RATE);
/** Reference chunk the inflation/deflation rates below are quoted per. */
const EXCHANGE_CHUNK_USD = 50;
/** purchasingPowerIndex lost per EXCHANGE_CHUNK_USD of reserves liquidated. */
const LIQUIDATION_INFLATION_HIT = 5;
/** purchasingPowerIndex gained per EXCHANGE_CHUNK_USD of USD repurchased. */
const DEFLATION_BOOST = 2;
/** Below this index, an independent BCT refuses to liquidate reserves. */
const BCT_BLOCK_THRESHOLD = 70;
/** Sovereign credibility cost of forcing the Central Bank's hand. */
const OVERRIDE_CREDIBILITY_HIT = 20;
/** Same LOAN_STABILITY_HIT_PER_FIELD split (see above) for the override's
 *  −15 national-stability target. */
const OVERRIDE_STABILITY_HIT_PER_FIELD = 15 / 0.6;
/** Below this purchasing power, the cost of living bites nationally. */
const INFLATION_BLEED_THRESHOLD = 80;
/** stateSatisfaction lost per 10 points purchasingPowerIndex sits under 80. */
const INFLATION_BLEED_PER_10_POINTS = 2;

/**
 * National Union Agreements: three ways to buy an end to the strike death
 * spiral, each trading a different structural cost for months of guaranteed
 * labour peace (`nationalUnionTruce`). All three resolve every active strike
 * immediately; none can be re-signed while a truce is already running.
 */
const SOCIAL_PACT_TRUCE_MONTHS = 12;
const SOCIAL_PACT_WAGE_BURDEN_TND = 50;
const TOTAL_SUBMISSION_TRUCE_MONTHS = 24;
const TOTAL_SUBMISSION_WAGE_BURDEN_TND = 120;
const UNION_CRACKDOWN_TRUCE_MONTHS = 36;
/** Flat hit to developmentIndex and securityLevel, per the crackdown's
 *  immediate, violent stability collapse (no payroll cost, unlike the two
 *  pacts above). */
const UNION_CRACKDOWN_STABILITY_HIT_PER_FIELD = 15;

/**
 * Sovereign Debt Servicing: automated monthly interest/principal payments
 * once any debt exists, plus three strategic scenarios (early payoff,
 * restructuring, and outright default) to manage it.
 */
/** Share of outstanding sovereignDebt bled from the budget every month. */
const DEBT_SERVICE_RATE = 0.02;
/** Debt service never falls below this floor, million TND. */
const DEBT_SERVICE_MIN_TND = 10;
/** Early payoff: hard-currency cost and matching debt reduction. */
const EARLY_PAYOFF_USD_COST = 100;
const EARLY_PAYOFF_DEBT_REDUCTION_TND = 300;
const EARLY_PAYOFF_CREDIBILITY_BOOST = 15;
/** Restructuring: months of suspended debt service, at a compounding cost. */
const DEBT_RESTRUCTURE_GRACE_MONTHS = 12;
const DEBT_RESTRUCTURE_PENALTY_MULTIPLIER = 1.2;
/** Default: halves the debt outright, at a catastrophic macro cost. */
const DEFAULT_DEBT_REDUCTION_RATE = 0.5;
const DEFAULT_PURCHASING_POWER_FLOOR = 10;
/** Flat hit to developmentIndex and securityLevel, mirroring the Union
 *  Crackdown's -30 stability collapse math. */
const DEFAULT_STABILITY_HIT_PER_FIELD = 15;

/**
 * Historical Triumph: the legendary win state, checked every tick after all
 * other calculations. All four conditions must hold simultaneously.
 */
const HISTORICAL_TRIUMPH_STABILITY_THRESHOLD = 85;
const HISTORICAL_TRIUMPH_PURCHASING_POWER_THRESHOLD = 60;

/**
 * The Inauguration: starting-conditions tiers applied once by `startGame`.
 * Only the fields named per tier change — everything else keeps
 * INITIAL_GAME_STATE's baseline (the "حكومة تكنوقراط" / Normal tier).
 */
const EASY_STARTING_BUDGET_TND = 200;
const EASY_STARTING_HARD_CURRENCY_USD = 50;
const EASY_SHADOW_ECONOMY_MULTIPLIER = 0.8;
const HARD_STARTING_SOVEREIGN_DEBT_TND = 500;
const HARD_STARTING_HARD_CURRENCY_USD = 0;
const HARD_SHADOW_ECONOMY_MULTIPLIER = 1.2;

/** Above this oligarchy grip, absent a campaign, corruption bleeds the budget. */
const OLIGARCHY_CONTROL_THRESHOLD = 50;
/** Floor of the monthly corruption/monopoly drain, million TND — the
 *  cartels never take less than this even in a poor month. */
const OLIGARCHY_CORRUPTION_DRAIN_TND = 50;
/** Share of national tax revenue the cartels skim instead, if larger. */
const OLIGARCHY_BLEED_RATE = 0.2;
/** Monthly oligarchyControl progress while the campaign is active. */
const ANTI_MONOPOLY_CONTROL_PROGRESS = 5;
/** Monthly purchasing-power retaliation from cartels while the campaign is active. */
const ANTI_MONOPOLY_PURCHASING_POWER_RETALIATION = 10;

/** Prosperity Trap 1 (Tocqueville effect): rising expectations sour
 *  satisfaction once a region is genuinely developed. */
const TOCQUEVILLE_THRESHOLD = 75;
const TOCQUEVILLE_PENALTY = 3;
const TOCQUEVILLE_HIGH_THRESHOLD = 90;
const TOCQUEVILLE_HIGH_PENALTY = 5;
/** Prosperity Trap 2 (industrial burnout): infrastructure wears out faster
 *  than it can coast once a region is highly developed. */
const BURNOUT_THRESHOLD = 80;
const BURNOUT_PENALTY = 1;
const BURNOUT_HIGH_THRESHOLD = 95;
const BURNOUT_HIGH_PENALTY = 2;

/** IMF/Western emergency loan: minimum alignment required to qualify. */
const EMERGENCY_LOAN_MIN_ALIGNMENT = 0;
/** IMF/Western loan pulls alignment toward the West. */
const EMERGENCY_LOAN_ALIGNMENT_SHIFT = 20;
/** BRICS/Eastern loan pulls alignment toward the East. */
const EASTERN_LOAN_ALIGNMENT_SHIFT = 40;
/** Capital flight cost of an Eastern loan (Western retaliation), million USD. */
const EASTERN_LOAN_CAPITAL_FLIGHT_USD = 20;
/** Below this alignment, Western financial friction raises the USD price. */
const WESTERN_FRICTION_ALIGNMENT_THRESHOLD = -50;
/** TND per USD once Western friction applies (vs. the normal USD_TND_RATE). */
const WESTERN_FRICTION_RATE = 4;

/** Regime collapse: stability below this is the point of no return. */
const COLLAPSE_STABILITY = 15;
/** Regime collapse: national debt beyond this is unrecoverable, M TND. */
const COLLAPSE_DEBT = -2_000;
/** Victory window opens after this many months in power (10 years). */
const VICTORY_MONTHS = 120;
const VICTORY_DEVELOPMENT = 80;
const VICTORY_UNEMPLOYMENT = 10;
/** Rolling window of national indicators kept for the dashboard. */
const HISTORY_LIMIT = 60;

function monthsSinceStart(isoDate: string): number {
  const [year, month] = isoDate.split("-").map(Number);
  return (year - 2026) * 12 + (month - 1);
}

/** Game dates always sit on the 1st of the month, so this never skips/clamps days. */
function addOneMonth(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

interface GameStore {
  gameState: GameState;
  regions: Record<RegionId, Region>;
  activeProjects: readonly ActiveProject[];
  completedProjects: readonly CompletedProject[];
  /** Projects that finished on the latest tick; transient, not persisted. */
  completionNotices: readonly CompletedProject[];
  /** Rolling monthly snapshots of national indicators (max 60). */
  history: readonly HistoryPoint[];
  /** Last month's per-region population change (persons), for trend arrows. */
  populationTrends: Record<RegionId, number>;
  selectedRegionId: RegionId | null;
  /** Auto-advance timer; transient UI state. */
  timeRunning: boolean;
  timeSpeed: 1 | 2 | 3;
  dashboardOpen: boolean;
  /** National Crisis Center overlay; transient UI state. */
  crisisCenterOpen: boolean;
  toggleTimeRunning: () => void;
  setTimeSpeed: (speed: 1 | 2 | 3) => void;
  toggleDashboard: () => void;
  toggleCrisisCenter: () => void;
  selectRegion: (id: RegionId | null) => void;
  dismissNotice: (instanceId: string) => void;
  /** Closes the socio-political modal and lets the game loop resume. */
  acknowledgePoliticalEvent: () => void;
  /**
   * Resolves an interactive event (currently the Citizen Initiative): the
   * state responds with political praise (free, modest belonging gain) or
   * financial support (costs TND, larger belonging + development gain).
   */
  resolvePoliticalChoice: (choice: "praise" | "support") => void;
  /**
   * Resolves a rebel takeover through the two-stage crisis engine. Stage 1
   * (diplomacy: `concessions` | `mediation`) is probabilistic — success
   * restores control, failure exhausts the diplomatic track and forces the
   * War Room. Stage 2 (`surgical` | `scorched` | `siege`) is the military
   * response, each with its own odds, collateral and timeline. Outcomes are
   * rolled with the exact odds the modal displayed to the player.
   */
  resolveRebelAction: (action: RebelAction) => void;
  /**
   * Fires a media propaganda campaign: 25M TND buys a national satisfaction
   * boost that shrinks with `stateCredibility` (diminishing returns), then
   * spends 12 points of that same credibility — the Lie Tax. No-op if the
   * budget can't cover it.
   */
  launchPropagandaCampaign: () => void;
  /**
   * Toggles a region's security crackdown on its shadow economy: on, it
   * restores normal taxation and grinds the shadow economy down over time at
   * the cost of local satisfaction; off, it halts that satisfaction bleed
   * (see the passive drift in `advanceTime`).
   */
  toggleCrackdown: (regionId: RegionId) => void;
  /**
   * Draws a 500M TND (booked as sovereign debt) IMF/Western emergency loan:
   * sovereign loans are foreign currency, so the actual injection lands in
   * hardCurrency (LOAN_USD_INJECTION, the same amount converted at the
   * Central Bank rate) — not the local budget directly. Paid for with a
   * severe, immediate austerity hit to every region's belonging, development
   * and security (see the LOAN_* constants for the exact math), and shifts
   * geopolitical alignment +20 toward the West. Fails — no-op, returns
   * false — if alignment has already tipped negative (East-leaning).
   */
  takeEmergencyLoan: () => boolean;
  /**
   * Draws the same 500M TND BRICS/Eastern loan (same USD injection and debt
   * rise as the Western loan), but with NO austerity — instead it shifts
   * alignment -40 toward the East and triggers -20M USD of Western capital
   * flight from reserves (netting +146M USD into reserves). Always available.
   */
  takeEasternBlocLoan: () => void;
  /**
   * Negotiates an end to a region's general strike: costs 50M TND, clears
   * `isStriking`, and restores 15 points of local satisfaction (clamped 100).
   * No-op if the budget can't cover it.
   */
  resolveStrike: (regionId: RegionId) => void;
  /**
   * Breaks a region's strike by force: free, clears `isStriking` instantly,
   * but costs -20 local security and -10 local satisfaction (both clamped
   * 0) — a brutal, budget-free alternative that risks armed rebellion.
   */
  crackdownStrike: (regionId: RegionId) => void;
  /**
   * Signs a National Social Pact with the unions: 12 months of guaranteed
   * truce (no new strikes), ends every currently active strike, at the cost
   * of +50M TND added permanently to `publicWageBurden`. No-op if a truce is
   * already running.
   */
  signSocialPact: () => void;
  /**
   * Buys total union loyalty: 24 months of truce, ends every active strike,
   * at a heavier permanent cost of +120M TND to `publicWageBurden`. No-op if
   * a truce is already running.
   */
  signTotalSubmission: () => void;
  /**
   * Forces labour peace by crackdown instead of payroll: 36 months of truce,
   * ends every active strike, adds no wage burden, but immediately and
   * violently collapses stability — -15 to every region's developmentIndex
   * and securityLevel (both clamped 0-100), and stateCredibility dropped to
   * 0. No-op if a truce is already running.
   */
  launchUnionCrackdown: () => void;
  /**
   * Pays down 300M TND of sovereignDebt for 100M USD from hardCurrency
   * reserves and boosts stateCredibility +15 (clamped 100). No-op if
   * reserves are short of the 100M USD cost.
   */
  payDebtEarly: () => void;
  /**
   * Suspends automated monthly debt servicing for 12 months
   * (`debtGracePeriod`), at the cost of compounding sovereignDebt by 20%
   * (floored) immediately. No-op while a grace period is already running.
   */
  restructureDebt: () => void;
  /**
   * The Nuclear Option: declares sovereign default, halving sovereignDebt
   * outright. Wipes hardCurrency to 0, crashes purchasingPowerIndex to 10,
   * drops stateCredibility to 0, and collapses stability via a flat -15 hit
   * to every region's developmentIndex and securityLevel (both clamped
   * 0-100). Sets the one-way `isDefaulted` flag; no-op if already defaulted.
   */
  declareSovereignDefault: () => void;
  /**
   * Liquidates `usdAmount` of hard-currency reserves at the Central Bank's
   * fixed 1:3 rate (USD→TND), scaling the inflation hit proportionally
   * (−5 purchasingPowerIndex per 50M USD). Fails — no-op, returns false —
   * if reserves don't cover it, or if purchasing power has already fallen
   * below 70 and the Bank is still independent (it refuses to print more).
   */
  exchangeUsdToTnd: (usdAmount: number) => boolean;
  /**
   * Buys back `tndAmount` worth of USD reserves (TND→USD), restoring
   * purchasing power proportionally to the USD actually gained (+2 per 50M
   * USD, clamped 100). The rate is the normal 1:3 unless geopolitical
   * alignment has fallen below -50 (Western financial friction), in which
   * case it costs 4 TND per USD instead. Fails — no-op, returns false — if
   * the budget can't cover it.
   */
  exchangeTndToUsd: (tndAmount: number) => boolean;
  /**
   * Forces the Central Bank's independence off, permanently unlocking
   * `exchangeUsdToTnd` regardless of inflation. Costs -20 state credibility
   * and a further -15 national-stability-equivalent hit (split across every
   * region's development and security, mirroring the emergency-loan
   * austerity math). No-op if the Bank is already overridden.
   */
  overrideBCT: () => void;
  /**
   * Toggles the state's anti-monopoly campaign against the rentier
   * oligarchy: while off and `oligarchyControl > 50`, corruption bleeds the
   * budget every month; while on, cartels retaliate against purchasing
   * power but oligarchyControl steadily falls (see `advanceTime`).
   */
  toggleAntiMonopolyCampaign: () => void;
  /**
   * Starts a project if funds cover it, the region is below its project
   * limit, and geography/tech-tree prerequisites are met.
   */
  startProject: (projectId: string, regionId: RegionId) => boolean;
  /**
   * Advances the game by one month: finances, construction, completions,
   * the neural economic drift, then the socio-political event engine.
   * No-op while a political event is awaiting acknowledgement.
   */
  advanceTime: () => void;
  /** Wipes the campaign back to the initial state. */
  resetGame: () => void;
  /**
   * Completes The Inauguration: sets the player's persona, applies the
   * chosen difficulty tier's starting-conditions overrides (budget, hard
   * currency, sovereignDebt, shadowEconomyLevel — see the EASY_ and HARD_
   * constants), and sets `gameStarted = true`, dismissing `GameSetupModal`.
   */
  startGame: (
    playerName: string,
    partyName: string,
    slogan: string,
    difficulty: Difficulty,
  ) => void;
  /** Marks the onboarding bubble tutorial as seen, dismissing `TutorialOverlay`. */
  completeTutorial: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      gameState: INITIAL_GAME_STATE,
      regions: INITIAL_REGIONS,
      activeProjects: [],
      completedProjects: [],
      completionNotices: [],
      history: [],
      populationTrends: {} as Record<RegionId, number>,
      selectedRegionId: null,
      timeRunning: false,
      timeSpeed: 1,
      dashboardOpen: false,
      crisisCenterOpen: false,

      selectRegion: (id) => set({ selectedRegionId: id }),

      toggleTimeRunning: () =>
        set((state) => ({ timeRunning: !state.timeRunning })),

      setTimeSpeed: (speed) => set({ timeSpeed: speed }),

      toggleDashboard: () =>
        set((state) => ({ dashboardOpen: !state.dashboardOpen })),

      toggleCrisisCenter: () =>
        set((state) => ({ crisisCenterOpen: !state.crisisCenterOpen })),

      dismissNotice: (instanceId) =>
        set((state) => ({
          completionNotices: state.completionNotices.filter(
            (notice) => notice.instanceId !== instanceId,
          ),
        })),

      acknowledgePoliticalEvent: () =>
        set((state) => ({
          gameState: { ...state.gameState, politicalEvent: null },
        })),

      resolvePoliticalChoice: (choice) =>
        set((state) => {
          const event = state.gameState.politicalEvent;
          if (!event?.interactive) {
            return state;
          }
          const { regionId } = event.interactive;
          const region = state.regions[regionId];
          const clampPct = (v: number) => Math.min(100, Math.max(0, v));

          // Praise: a free morale gesture. Support: real money, real impact.
          const belongingGain = choice === "support" ? 18 : 8;
          const satisfactionGain = choice === "support" ? 8 : 4;
          const cost = choice === "support" ? 60 : 0;
          const infraGain = choice === "support" ? 1 : 0;

          return {
            gameState: {
              ...state.gameState,
              politicalEvent: null,
              totalBudget: state.gameState.totalBudget - cost,
            },
            regions: {
              ...state.regions,
              [regionId]: {
                ...region,
                nationalBelonging: clampPct(
                  region.nationalBelonging + belongingGain,
                ),
                stateSatisfaction: clampPct(
                  region.stateSatisfaction + satisfactionGain,
                ),
                infrastructureLevel: Math.min(
                  10,
                  region.infrastructureLevel + infraGain,
                ),
              },
            },
          };
        }),

      resolveRebelAction: (action) =>
        set((state) => {
          const event = state.gameState.politicalEvent;
          if (event?.interactive?.kind !== "rebel-takeover") {
            return state;
          }
          const { regionId } = event.interactive;
          const region = state.regions[regionId];
          const gs = state.gameState;
          const clampPct = (v: number) => Math.min(100, Math.max(0, v));

          // Retaking the region clears every crisis flag, so a FUTURE takeover
          // of the same governorate opens fresh at Stage 1.
          const restored = (patch: Partial<Region>): Region => ({
            ...region,
            ...patch,
            isUnderRebelControl: false,
            diplomacyExhausted: false,
            siegeTurns: 0,
          });
          const withRegion = (next: Region) => ({
            ...state.regions,
            [regionId]: next,
          });

          switch (action) {
            // ---- STAGE 1: DIPLOMACY ----
            case "concessions": {
              // Odds ride the national mood. Win or lose, the concessions cost
              // 100M TND and bruise the region's security by 20; success buys
              // the region back, failure burns the diplomatic track.
              const chance = concessionsChance(
                computeNationalMetrics(state.regions).stability,
              );
              const win = rollSuccess(chance);
              const security = clampPct(region.securityLevel - 20);
              return {
                gameState: {
                  ...gs,
                  politicalEvent: win ? null : gs.politicalEvent,
                  totalBudget: gs.totalBudget - 100,
                },
                regions: withRegion(
                  win
                    ? restored({ securityLevel: security })
                    : { ...region, securityLevel: security, diplomacyExhausted: true },
                ),
              };
            }
            case "mediation": {
              // Cheap local brokering. On failure the mediators are humiliated
              // (−10 development) and diplomacy is spent.
              const chance = mediationChance(region.developmentIndex);
              const win = rollSuccess(chance);
              return {
                gameState: {
                  ...gs,
                  politicalEvent: win ? null : gs.politicalEvent,
                  totalBudget: gs.totalBudget - 20,
                },
                regions: withRegion(
                  win
                    ? restored({})
                    : {
                        ...region,
                        developmentIndex: clampPct(region.developmentIndex - 10),
                        diplomacyExhausted: true,
                      },
                ),
              };
            }

            // ---- STAGE 2: WAR ROOM ----
            case "surgical": {
              // Precision at a premium (300M). Clean when it lands; on a miss
              // the region stays lost and the botched raid costs 15 security.
              const chance = surgicalChance(region.developmentIndex);
              const win = rollSuccess(chance);
              return {
                gameState: {
                  ...gs,
                  politicalEvent: win ? null : gs.politicalEvent,
                  totalBudget: gs.totalBudget - 300,
                },
                regions: withRegion(
                  win
                    ? restored({})
                    : { ...region, securityLevel: clampPct(region.securityLevel - 15) },
                ),
              };
            }
            case "scorched": {
              // Guaranteed but brutal: the region is retaken at the cost of its
              // development, its people's trust, and hard currency scaled to
              // the population caught in it.
              const usdLoss = scorchedUsdLoss(region.population);
              const satDrop = scorchedSatDrop(region.population);
              return {
                gameState: {
                  ...gs,
                  politicalEvent: null,
                  totalBudget: gs.totalBudget - 100,
                  hardCurrency: gs.hardCurrency - usdLoss,
                },
                regions: withRegion(
                  restored({
                    developmentIndex: clampPct(region.developmentIndex - 40),
                    stateSatisfaction: clampPct(region.stateSatisfaction - satDrop),
                  }),
                ),
              };
            }
            case "siege": {
              // Starve them out. Cheap up front (30M, −10 security) but the
              // governorate stays rebel-held and bleeds for `turns` months
              // before the State walks back in (see advanceTime).
              const turns = siegeTurnsFor(region.nationalBelonging);
              return {
                gameState: {
                  ...gs,
                  politicalEvent: null,
                  totalBudget: gs.totalBudget - 30,
                },
                regions: withRegion({
                  ...region,
                  securityLevel: clampPct(region.securityLevel - 10),
                  siegeTurns: turns,
                }),
              };
            }
            default:
              return state;
          }
        }),

      launchPropagandaCampaign: () =>
        set((state) => {
          const { totalBudget, stateCredibility } = state.gameState;
          if (totalBudget < PROPAGANDA_COST_TND) {
            return state;
          }
          const clampPct = (v: number) => Math.min(100, Math.max(0, v));
          // Diminishing returns: the same lie buys less satisfaction the more
          // spent credibility has already burned through.
          const boost = Math.max(0, Math.floor(15 * (stateCredibility / 100)));

          const regions = { ...state.regions };
          for (const region of Object.values(state.regions)) {
            regions[region.id] = {
              ...region,
              stateSatisfaction: clampPct(region.stateSatisfaction + boost),
            };
          }

          return {
            gameState: {
              ...state.gameState,
              totalBudget: totalBudget - PROPAGANDA_COST_TND,
              stateCredibility: clampPct(
                stateCredibility - PROPAGANDA_CREDIBILITY_COST,
              ),
            },
            regions,
          };
        }),

      toggleCrackdown: (regionId) =>
        set((state) => {
          const region = state.regions[regionId];
          return {
            regions: {
              ...state.regions,
              [regionId]: { ...region, crackdownActive: !region.crackdownActive },
            },
          };
        }),

      takeEmergencyLoan: () => {
        if (get().gameState.geopoliticalAlignment < EMERGENCY_LOAN_MIN_ALIGNMENT) {
          return false;
        }
        set((state) => {
          const clampPct = (v: number) => Math.min(100, Math.max(0, v));
          const clampAlign = (v: number) => Math.min(100, Math.max(-100, v));
          const regions = { ...state.regions };
          for (const region of Object.values(state.regions)) {
            regions[region.id] = {
              ...region,
              nationalBelonging: clampPct(
                region.nationalBelonging - LOAN_BELONGING_HIT,
              ),
              developmentIndex: clampPct(
                region.developmentIndex - LOAN_STABILITY_HIT_PER_FIELD,
              ),
              securityLevel: clampPct(
                region.securityLevel - LOAN_STABILITY_HIT_PER_FIELD,
              ),
            };
          }
          return {
            gameState: {
              ...state.gameState,
              hardCurrency: state.gameState.hardCurrency + LOAN_USD_INJECTION,
              sovereignDebt: state.gameState.sovereignDebt + LOAN_AMOUNT_TND,
              geopoliticalAlignment: clampAlign(
                state.gameState.geopoliticalAlignment +
                  EMERGENCY_LOAN_ALIGNMENT_SHIFT,
              ),
            },
            regions,
          };
        });
        return true;
      },

      takeEasternBlocLoan: () =>
        set((state) => {
          const clampAlign = (v: number) => Math.min(100, Math.max(-100, v));
          return {
            gameState: {
              ...state.gameState,
              sovereignDebt: state.gameState.sovereignDebt + LOAN_AMOUNT_TND,
              geopoliticalAlignment: clampAlign(
                state.gameState.geopoliticalAlignment -
                  EASTERN_LOAN_ALIGNMENT_SHIFT,
              ),
              hardCurrency:
                state.gameState.hardCurrency +
                LOAN_USD_INJECTION -
                EASTERN_LOAN_CAPITAL_FLIGHT_USD,
            },
          };
        }),

      resolveStrike: (regionId) =>
        set((state) => {
          if (state.gameState.totalBudget < STRIKE_RESOLUTION_COST_TND) {
            return state;
          }
          const region = state.regions[regionId];
          return {
            gameState: {
              ...state.gameState,
              totalBudget: state.gameState.totalBudget - STRIKE_RESOLUTION_COST_TND,
            },
            regions: {
              ...state.regions,
              [regionId]: {
                ...region,
                isStriking: false,
                stateSatisfaction: Math.min(
                  100,
                  region.stateSatisfaction + STRIKE_RESOLUTION_SATISFACTION_GAIN,
                ),
              },
            },
          };
        }),

      crackdownStrike: (regionId) =>
        set((state) => {
          const region = state.regions[regionId];
          const clampPct = (v: number) => Math.min(100, Math.max(0, v));
          return {
            regions: {
              ...state.regions,
              [regionId]: {
                ...region,
                isStriking: false,
                securityLevel: clampPct(
                  region.securityLevel - STRIKE_CRACKDOWN_SECURITY_HIT,
                ),
                stateSatisfaction: clampPct(
                  region.stateSatisfaction - STRIKE_CRACKDOWN_SATISFACTION_HIT,
                ),
              },
            },
          };
        }),

      signSocialPact: () =>
        set((state) => {
          if (state.gameState.nationalUnionTruce > 0) {
            return state;
          }
          const regions = { ...state.regions };
          for (const region of Object.values(state.regions)) {
            if (region.isStriking) {
              regions[region.id] = { ...region, isStriking: false };
            }
          }
          return {
            gameState: {
              ...state.gameState,
              nationalUnionTruce: SOCIAL_PACT_TRUCE_MONTHS,
              publicWageBurden:
                state.gameState.publicWageBurden + SOCIAL_PACT_WAGE_BURDEN_TND,
            },
            regions,
          };
        }),

      signTotalSubmission: () =>
        set((state) => {
          if (state.gameState.nationalUnionTruce > 0) {
            return state;
          }
          const regions = { ...state.regions };
          for (const region of Object.values(state.regions)) {
            if (region.isStriking) {
              regions[region.id] = { ...region, isStriking: false };
            }
          }
          return {
            gameState: {
              ...state.gameState,
              nationalUnionTruce: TOTAL_SUBMISSION_TRUCE_MONTHS,
              publicWageBurden:
                state.gameState.publicWageBurden +
                TOTAL_SUBMISSION_WAGE_BURDEN_TND,
            },
            regions,
          };
        }),

      launchUnionCrackdown: () =>
        set((state) => {
          if (state.gameState.nationalUnionTruce > 0) {
            return state;
          }
          const clampPct = (v: number) => Math.min(100, Math.max(0, v));
          const regions = { ...state.regions };
          for (const region of Object.values(state.regions)) {
            regions[region.id] = {
              ...region,
              isStriking: false,
              developmentIndex: clampPct(
                region.developmentIndex - UNION_CRACKDOWN_STABILITY_HIT_PER_FIELD,
              ),
              securityLevel: clampPct(
                region.securityLevel - UNION_CRACKDOWN_STABILITY_HIT_PER_FIELD,
              ),
            };
          }
          return {
            gameState: {
              ...state.gameState,
              nationalUnionTruce: UNION_CRACKDOWN_TRUCE_MONTHS,
              stateCredibility: 0,
            },
            regions,
          };
        }),

      payDebtEarly: () =>
        set((state) => {
          if (state.gameState.hardCurrency < EARLY_PAYOFF_USD_COST) {
            return state;
          }
          return {
            gameState: {
              ...state.gameState,
              hardCurrency: state.gameState.hardCurrency - EARLY_PAYOFF_USD_COST,
              sovereignDebt: Math.max(
                0,
                state.gameState.sovereignDebt - EARLY_PAYOFF_DEBT_REDUCTION_TND,
              ),
              stateCredibility: Math.min(
                100,
                state.gameState.stateCredibility + EARLY_PAYOFF_CREDIBILITY_BOOST,
              ),
            },
          };
        }),

      restructureDebt: () =>
        set((state) => {
          if (state.gameState.debtGracePeriod > 0) {
            return state;
          }
          return {
            gameState: {
              ...state.gameState,
              debtGracePeriod: DEBT_RESTRUCTURE_GRACE_MONTHS,
              sovereignDebt: Math.floor(
                state.gameState.sovereignDebt * DEBT_RESTRUCTURE_PENALTY_MULTIPLIER,
              ),
            },
          };
        }),

      declareSovereignDefault: () =>
        set((state) => {
          if (state.gameState.isDefaulted) {
            return state;
          }
          const clampPct = (v: number) => Math.min(100, Math.max(0, v));
          const regions = { ...state.regions };
          for (const region of Object.values(state.regions)) {
            regions[region.id] = {
              ...region,
              developmentIndex: clampPct(
                region.developmentIndex - DEFAULT_STABILITY_HIT_PER_FIELD,
              ),
              securityLevel: clampPct(
                region.securityLevel - DEFAULT_STABILITY_HIT_PER_FIELD,
              ),
            };
          }
          return {
            gameState: {
              ...state.gameState,
              isDefaulted: true,
              sovereignDebt: Math.floor(
                state.gameState.sovereignDebt * (1 - DEFAULT_DEBT_REDUCTION_RATE),
              ),
              hardCurrency: 0,
              purchasingPowerIndex: DEFAULT_PURCHASING_POWER_FLOOR,
              stateCredibility: 0,
            },
            regions,
          };
        }),

      exchangeUsdToTnd: (usdAmount) => {
        const { gameState } = get();
        if (
          gameState.purchasingPowerIndex < BCT_BLOCK_THRESHOLD &&
          gameState.bctIndependence
        ) {
          return false;
        }
        if (gameState.hardCurrency < usdAmount) {
          return false;
        }
        const inflationHit =
          (usdAmount / EXCHANGE_CHUNK_USD) * LIQUIDATION_INFLATION_HIT;
        set((state) => ({
          gameState: {
            ...state.gameState,
            hardCurrency: state.gameState.hardCurrency - usdAmount,
            totalBudget: state.gameState.totalBudget + usdAmount * USD_TND_RATE,
            purchasingPowerIndex: Math.min(
              100,
              Math.max(0, state.gameState.purchasingPowerIndex - inflationHit),
            ),
          },
        }));
        return true;
      },

      exchangeTndToUsd: (tndAmount) => {
        const { gameState } = get();
        if (gameState.totalBudget < tndAmount) {
          return false;
        }
        // Western financial friction: a deep Eastern lean makes USD costlier
        // to buy back (4 TND/USD instead of the normal 3).
        const effectiveRate =
          gameState.geopoliticalAlignment < WESTERN_FRICTION_ALIGNMENT_THRESHOLD
            ? WESTERN_FRICTION_RATE
            : USD_TND_RATE;
        const usdGained = tndAmount / effectiveRate;
        const boost = (usdGained / EXCHANGE_CHUNK_USD) * DEFLATION_BOOST;
        set((state) => ({
          gameState: {
            ...state.gameState,
            totalBudget: state.gameState.totalBudget - tndAmount,
            hardCurrency: state.gameState.hardCurrency + usdGained,
            purchasingPowerIndex: Math.min(
              100,
              Math.max(0, state.gameState.purchasingPowerIndex + boost),
            ),
          },
        }));
        return true;
      },

      overrideBCT: () =>
        set((state) => {
          if (!state.gameState.bctIndependence) {
            return state;
          }
          const clampPct = (v: number) => Math.min(100, Math.max(0, v));
          const regions = { ...state.regions };
          for (const region of Object.values(state.regions)) {
            regions[region.id] = {
              ...region,
              developmentIndex: clampPct(
                region.developmentIndex - OVERRIDE_STABILITY_HIT_PER_FIELD,
              ),
              securityLevel: clampPct(
                region.securityLevel - OVERRIDE_STABILITY_HIT_PER_FIELD,
              ),
            };
          }
          return {
            gameState: {
              ...state.gameState,
              bctIndependence: false,
              stateCredibility: clampPct(
                state.gameState.stateCredibility - OVERRIDE_CREDIBILITY_HIT,
              ),
            },
            regions,
          };
        }),

      toggleAntiMonopolyCampaign: () =>
        set((state) => ({
          gameState: {
            ...state.gameState,
            antiMonopolyActive: !state.gameState.antiMonopolyActive,
          },
        })),

      startProject: (projectId, regionId) => {
        const template = getProjectTemplate(projectId);
        if (!template) {
          return false;
        }
        const { gameState, activeProjects, regions } = get();
        if (template.requiresCoastal && !regions[regionId].isCoastal) {
          return false;
        }
        const prerequisitesMet = (template.requiresCompleted ?? []).every(
          (requiredId) =>
            regions[regionId].completedProjects.includes(requiredId),
        );
        if (!prerequisitesMet) {
          return false;
        }
        if (
          template.requiresTechLevel !== undefined &&
          gameState.techLevel < template.requiresTechLevel
        ) {
          return false;
        }
        const regionActiveCount = activeProjects.filter(
          (project) => project.regionId === regionId,
        ).length;
        if (regionActiveCount >= MAX_ACTIVE_PROJECTS_PER_REGION) {
          return false;
        }
        if (
          gameState.totalBudget < template.costTND ||
          gameState.hardCurrency < template.costUSD
        ) {
          return false;
        }
        set((state) => ({
          gameState: {
            ...state.gameState,
            totalBudget: state.gameState.totalBudget - template.costTND,
            hardCurrency: state.gameState.hardCurrency - template.costUSD,
          },
          activeProjects: [
            ...state.activeProjects,
            {
              instanceId: crypto.randomUUID(),
              projectId,
              regionId,
              monthsRemaining: template.durationMonths,
            },
          ],
        }));
        return true;
      },

      advanceTime: () =>
        set((state) => {
          // A political event on screen, a finished campaign, a sustained
          // regime collapse, or an un-inaugurated campaign (GameSetupModal
          // still showing) all freeze the loop.
          if (
            state.gameState.politicalEvent ||
            state.gameState.outcome ||
            state.gameState.isGameOver ||
            !state.gameState.gameStarted
          ) {
            return state;
          }

          // National Union Truce: whether labour peace holds THIS elapsing
          // month (checked before decrementing, so a truce set to N months
          // protects exactly N ticks, not N-1).
          const unionTruceActive = state.gameState.nationalUnionTruce > 0;
          const nextNationalUnionTruce = Math.max(
            0,
            state.gameState.nationalUnionTruce - 1,
          );

          // Sovereign Debt Servicing: while a restructuring grace period is
          // running, it just ticks down and no service is charged. Otherwise,
          // any outstanding debt bleeds 2% of itself (10M TND floor) from the
          // budget every month, automatically.
          let nextDebtGracePeriod = 0;
          let debtServiceDelta = 0;
          if (state.gameState.debtGracePeriod > 0) {
            nextDebtGracePeriod = state.gameState.debtGracePeriod - 1;
          } else if (state.gameState.sovereignDebt > 0) {
            debtServiceDelta = -Math.max(
              DEBT_SERVICE_MIN_TND,
              Math.floor(state.gameState.sovereignDebt * DEBT_SERVICE_RATE),
            );
          }

          // Finances for the elapsing month, from the pre-tick state.
          const { income, net, hardCurrencyNet } = computeMonthlyFinances(
            state.regions,
            state.activeProjects,
            state.completedProjects,
          );
          // Science: completed universities / tech hubs / datacenters raise
          // the National Tech Level, which gates the advanced tech tree.
          const techGain = monthlyTechPoints(state.completedProjects);

          // Construction progress and completions. Projects in a rebel-held
          // governorate are frozen — their timer does not advance.
          const ticked = state.activeProjects.map((project) =>
            state.regions[project.regionId].isUnderRebelControl
              ? project
              : { ...project, monthsRemaining: project.monthsRemaining - 1 },
          );
          const completed = ticked.filter(
            (project) => project.monthsRemaining <= 0,
          );

          let regions = state.regions;
          let completedProjects = state.completedProjects;
          if (completed.length > 0) {
            regions = { ...regions };
            for (const project of completed) {
              const template = getProjectTemplate(project.projectId);
              if (!template) {
                continue;
              }
              regions[project.regionId] = applyProjectCompletion(
                regions[project.regionId],
                template,
              );
            }
            completedProjects = [
              ...completedProjects,
              ...completed.map(({ instanceId, projectId, regionId }) => ({
                instanceId,
                projectId,
                regionId,
              })),
            ];
          }

          // Neural economy: monthly education→employment→development
          // cascade runs for every governorate after completions.
          {
            const drifted = { ...regions };
            for (const region of Object.values(regions)) {
              drifted[region.id] = applyMonthlyDrift(drifted[region.id]);
            }
            regions = drifted;
          }

          // Prosperity Traps: late-game scaling challenges so success stops
          // being linear. Rising expectations (Tocqueville effect) sour
          // satisfaction in genuinely developed regions, and their
          // infrastructure burns out faster than it can coast — both force
          // constant reinvestment instead of a one-time snowball to 100.
          {
            let trapped: Record<RegionId, Region> | null = null;
            for (const region of Object.values(regions)) {
              const satisfactionPenalty =
                region.developmentIndex >= TOCQUEVILLE_HIGH_THRESHOLD
                  ? TOCQUEVILLE_HIGH_PENALTY
                  : region.developmentIndex >= TOCQUEVILLE_THRESHOLD
                    ? TOCQUEVILLE_PENALTY
                    : 0;
              const burnoutPenalty =
                region.developmentIndex >= BURNOUT_HIGH_THRESHOLD
                  ? BURNOUT_HIGH_PENALTY
                  : region.developmentIndex >= BURNOUT_THRESHOLD
                    ? BURNOUT_PENALTY
                    : 0;
              if (satisfactionPenalty > 0 || burnoutPenalty > 0) {
                trapped ??= { ...regions };
                trapped[region.id] = {
                  ...region,
                  stateSatisfaction: Math.max(
                    0,
                    region.stateSatisfaction - satisfactionPenalty,
                  ),
                  developmentIndex: Math.max(
                    0,
                    region.developmentIndex - burnoutPenalty,
                  ),
                };
              }
            }
            if (trapped) {
              regions = trapped;
            }
          }

          // Demographics: natural growth + internal migration / brain drain.
          regions = applyDemographics(regions);

          // Siege & Attrition: tick down any active siege. A besieged
          // governorate stays rebel-held (0 GDP) and bleeds −5 satisfaction
          // each month; when the counter hits zero the State retakes it and
          // every crisis flag clears.
          {
            let besieged: Record<RegionId, Region> | null = null;
            for (const region of Object.values(regions)) {
              if (region.siegeTurns > 0) {
                besieged ??= { ...regions };
                const siegeTurns = region.siegeTurns - 1;
                const ongoing = siegeTurns > 0;
                besieged[region.id] = {
                  ...region,
                  siegeTurns,
                  stateSatisfaction: Math.max(0, region.stateSatisfaction - 5),
                  isUnderRebelControl: ongoing,
                  diplomacyExhausted: ongoing ? region.diplomacyExhausted : false,
                };
              }
            }
            if (besieged) {
              regions = besieged;
            }
          }

          // Shadow Economy: an entrenched, untaxed smuggling economy quietly
          // buys local goodwill (+2 satisfaction/month, capped) as long as the
          // State looks away. A crackdown reverses the trade-off — it grinds
          // the shadow economy down (−10/month) but the crackdown itself is
          // deeply unpopular (−8 satisfaction/month).
          {
            let shadowed: Record<RegionId, Region> | null = null;
            for (const region of Object.values(regions)) {
              if (region.crackdownActive) {
                shadowed ??= { ...regions };
                shadowed[region.id] = {
                  ...region,
                  shadowEconomyLevel: Math.max(0, region.shadowEconomyLevel - 10),
                  stateSatisfaction: Math.max(0, region.stateSatisfaction - 8),
                };
              } else if (region.shadowEconomyLevel > 30) {
                shadowed ??= { ...regions };
                shadowed[region.id] = {
                  ...region,
                  stateSatisfaction: Math.min(100, region.stateSatisfaction + 2),
                };
              }
            }
            if (shadowed) {
              regions = shadowed;
            }
          }

          // Demographic migration: failing governorates (developmentIndex <
          // 25) shed 1% of their population every month to the single most
          // developed governorate, which pays an overcrowding cost in
          // exchange.
          regions = applyDevelopmentMigration(regions);

          // Harka (maritime exit) & border infiltration: two more RNG-free
          // consequences layered on the same migration engine, running after
          // internal migration so both read this month's true post-migration
          // figures.
          const harkaResult = applyHarkaAndInfiltration(regions);
          regions = harkaResult.regions;

          // Inflation Bleed: once purchasing power falls below 80, the cost
          // of living erodes citizen satisfaction everywhere — −2 per 10
          // points the index sits under 80 (e.g. index 60 → −4/month). Runs
          // before the strike loop so this month's inflation can itself tip
          // a region into a strike.
          if (state.gameState.purchasingPowerIndex < INFLATION_BLEED_THRESHOLD) {
            const deficitUnits = Math.floor(
              (INFLATION_BLEED_THRESHOLD - state.gameState.purchasingPowerIndex) / 10,
            );
            const bleed = deficitUnits * INFLATION_BLEED_PER_10_POINTS;
            if (bleed > 0) {
              const inflated = { ...regions };
              for (const region of Object.values(regions)) {
                inflated[region.id] = {
                  ...region,
                  stateSatisfaction: Math.max(0, region.stateSatisfaction - bleed),
                };
              }
              regions = inflated;
            }
          }

          // Organized resistance: satisfaction collapsing below 20 triggers a
          // general strike (0 GDP/taxes via `monthlyRegionIncome`). Unlike the
          // other systemic loops this does NOT auto-resolve — only the
          // player's `resolveStrike` negotiation lifts it.
          if (!unionTruceActive) {
            let struck: Record<RegionId, Region> | null = null;
            for (const region of Object.values(regions)) {
              if (
                !region.isStriking &&
                !region.isUnderRebelControl &&
                region.stateSatisfaction < STRIKE_SATISFACTION_THRESHOLD
              ) {
                struck ??= { ...regions };
                struck[region.id] = { ...region, isStriking: true };
              }
            }
            if (struck) {
              regions = struck;
            }
          }

          // Socio-political engine: weighted, seasonal, per-region cooldowns.
          const elapsingMonth = Number(
            state.gameState.currentDate.slice(5, 7),
          );
          const political = evaluatePoliticalEvents({
            regions,
            completedProjects,
            globalCooldown: state.gameState.politicalCooldown,
            regionCooldowns: state.gameState.regionEventCooldowns,
            boomedRegions: state.gameState.boomedRegions,
            month: elapsingMonth,
          });
          regions = political.regions;
          completedProjects = political.completedProjects;

          // Tick down every per-region cooldown; arm the fired one.
          const regionEventCooldowns: Record<string, number> = {};
          for (const [key, months] of Object.entries(
            state.gameState.regionEventCooldowns,
          )) {
            if (months > 1) {
              regionEventCooldowns[key] = months - 1;
            }
          }
          if (political.cooldownKey) {
            regionEventCooldowns[political.cooldownKey] =
              REGION_EVENT_COOLDOWN_MONTHS;
          }

          // Random flavor event, only in politically quiet months.
          let currentEvent: GameEvent | null = null;
          let eventBudgetChange = 0;
          if (!political.event && Math.random() < EVENT_CHANCE) {
            currentEvent =
              GAME_EVENTS[Math.floor(Math.random() * GAME_EVENTS.length)];
            eventBudgetChange = currentEvent.effects.budgetChange;
          }

          // Rentier Oligarchy: entrenched cartel control quietly bleeds the
          // budget every month unless the state is actively fighting it —
          // and it scales with success: the cartels skim 20% of national tax
          // revenue, or the 50M TND floor, whichever is higher, so a thriving
          // economy doesn't just out-earn the corruption. The fight itself
          // invites retaliation against purchasing power while steadily
          // grinding oligarchyControl down.
          let oligarchyBudgetDelta = 0;
          let nextOligarchyControl = state.gameState.oligarchyControl;
          let nextPurchasingPowerIndex = state.gameState.purchasingPowerIndex;
          if (
            state.gameState.oligarchyControl > OLIGARCHY_CONTROL_THRESHOLD &&
            !state.gameState.antiMonopolyActive
          ) {
            oligarchyBudgetDelta = -Math.max(
              OLIGARCHY_CORRUPTION_DRAIN_TND,
              Math.floor(income * OLIGARCHY_BLEED_RATE),
            );
          }
          if (state.gameState.antiMonopolyActive) {
            nextOligarchyControl = Math.max(
              0,
              nextOligarchyControl - ANTI_MONOPOLY_CONTROL_PROGRESS,
            );
            nextPurchasingPowerIndex = Math.max(
              0,
              nextPurchasingPowerIndex - ANTI_MONOPOLY_PURCHASING_POWER_RETALIATION,
            );
          }

          // National snapshot, win/loss evaluation, and history.
          const nextDate = addOneMonth(state.gameState.currentDate);
          const nextBudget =
            state.gameState.totalBudget +
            net +
            eventBudgetChange +
            political.budgetDelta +
            oligarchyBudgetDelta -
            state.gameState.publicWageBurden +
            debtServiceDelta;
          // Exports renew reserves; advanced-project USD upkeep drains them.
          // Harka exits add their own diplomatic-friction drain on top.
          const nextHardCurrency =
            state.gameState.hardCurrency +
            hardCurrencyNet +
            political.hardCurrencyDelta +
            harkaResult.hardCurrencyDelta;
          const nextTechLevel = state.gameState.techLevel + techGain;
          const metrics = computeNationalMetrics(regions);

          let outcome: GameOutcome | null = null;
          let outcomeReason: string | null = null;
          if (metrics.stability < COLLAPSE_STABILITY) {
            outcome = "collapse";
            outcomeReason = `انهار الاستقرار الوطني إلى ${Math.round(metrics.stability)}/100. عمّت الاضطرابات البلاد وفقدت الدولة السيطرة على الشارع، فسقطت الحكومة.`;
          } else if (nextBudget < COLLAPSE_DEBT) {
            outcome = "collapse";
            outcomeReason = `تجاوز الدين العمومي حدود القدرة على السداد (${Math.round(nextBudget)} مليون دينار). أعلنت الدولة إفلاسها وانهارت الثقة في الاقتصاد.`;
          } else if (
            monthsSinceStart(nextDate) >= VICTORY_MONTHS &&
            metrics.avgDevelopment > VICTORY_DEVELOPMENT &&
            metrics.avgUnemployment < VICTORY_UNEMPLOYMENT
          ) {
            outcome = "victory";
            outcomeReason = `عشر سنوات من الحكم الرشيد: تنمية وطنية بلغت ${Math.round(metrics.avgDevelopment)}/100 وبطالة دون ${Math.round(metrics.avgUnemployment)}٪. دخلت تونس عصرها الذهبي.`;
          }

          // Endgame: sustained (not just momentary) sub-critical stability.
          // Distinct from the instant `outcome: "collapse"` above — this is
          // three consecutive months under 25, not one catastrophic crash.
          const criticalStabilityMonths =
            metrics.stability < CRITICAL_STABILITY_THRESHOLD
              ? state.gameState.criticalStabilityMonths + 1
              : 0;
          const isGameOver =
            criticalStabilityMonths >= CRITICAL_STABILITY_MONTHS_LIMIT;

          // Historical Triumph: a one-way milestone banner, checked last
          // against this tick's fully-settled figures. Never reverts once
          // achieved, even if a later month slips back under a threshold.
          const noActiveStrikes = Object.values(regions).every(
            (region) => !region.isStriking,
          );
          const isVictorious =
            state.gameState.isVictorious ||
            (state.gameState.sovereignDebt <= 0 &&
              metrics.stability >= HISTORICAL_TRIUMPH_STABILITY_THRESHOLD &&
              noActiveStrikes &&
              nextPurchasingPowerIndex >=
                HISTORICAL_TRIUMPH_PURCHASING_POWER_THRESHOLD);

          const history = [
            ...state.history,
            {
              date: nextDate,
              gdp: Math.round(metrics.gdpAnnual),
              stability: Math.round(metrics.stability * 10) / 10,
              budget: Math.round(nextBudget),
              hardCurrency: Math.round(nextHardCurrency),
              population: metrics.totalPopulation,
            },
          ].slice(-HISTORY_LIMIT);

          // Per-region population delta vs the start of this tick (previous
          // month), for the sidebar's growth/decline trend arrows.
          const populationTrends = {} as Record<RegionId, number>;
          for (const id of Object.keys(regions) as RegionId[]) {
            populationTrends[id] =
              regions[id].population - state.regions[id].population;
          }

          return {
            history,
            populationTrends,
            gameState: {
              ...state.gameState,
              currentDate: nextDate,
              totalBudget: nextBudget,
              hardCurrency: nextHardCurrency,
              techLevel: nextTechLevel,
              outcome,
              outcomeReason,
              currentEvent,
              politicalEvent: political.event,
              politicalCooldown: political.event
                ? POLITICAL_COOLDOWN_MONTHS
                : Math.max(0, state.gameState.politicalCooldown - 1),
              regionEventCooldowns,
              boomedRegions: political.boomedRegion
                ? [...state.gameState.boomedRegions, political.boomedRegion]
                : state.gameState.boomedRegions,
              criticalStabilityMonths,
              isGameOver,
              oligarchyControl: nextOligarchyControl,
              purchasingPowerIndex: nextPurchasingPowerIndex,
              nationalUnionTruce: nextNationalUnionTruce,
              debtGracePeriod: nextDebtGracePeriod,
              isVictorious,
            },
            activeProjects: ticked.filter(
              (project) => project.monthsRemaining > 0,
            ),
            completedProjects,
            completionNotices: completed.map(
              ({ instanceId, projectId, regionId }) => ({
                instanceId,
                projectId,
                regionId,
              }),
            ),
            regions,
          };
        }),

      resetGame: () =>
        set({
          gameState: INITIAL_GAME_STATE,
          regions: INITIAL_REGIONS,
          activeProjects: [],
          completedProjects: [],
          completionNotices: [],
          history: [],
          populationTrends: {} as Record<RegionId, number>,
          selectedRegionId: null,
          timeRunning: false,
          dashboardOpen: false,
          crisisCenterOpen: false,
        }),

      startGame: (playerName, partyName, slogan, difficulty) =>
        set((state) => {
          const clampPct = (v: number) => Math.min(100, Math.max(0, v));
          let regions = state.regions;
          let overrides: Partial<GameState> = {};

          if (difficulty === "easy") {
            overrides = {
              totalBudget: EASY_STARTING_BUDGET_TND,
              hardCurrency: EASY_STARTING_HARD_CURRENCY_USD,
            };
            regions = { ...regions };
            for (const region of Object.values(state.regions)) {
              regions[region.id] = {
                ...region,
                shadowEconomyLevel: clampPct(
                  region.shadowEconomyLevel * EASY_SHADOW_ECONOMY_MULTIPLIER,
                ),
              };
            }
          } else if (difficulty === "hard") {
            overrides = {
              sovereignDebt: HARD_STARTING_SOVEREIGN_DEBT_TND,
              hardCurrency: HARD_STARTING_HARD_CURRENCY_USD,
            };
            regions = { ...regions };
            for (const region of Object.values(state.regions)) {
              regions[region.id] = {
                ...region,
                shadowEconomyLevel: clampPct(
                  region.shadowEconomyLevel * HARD_SHADOW_ECONOMY_MULTIPLIER,
                ),
              };
            }
          }

          return {
            gameState: {
              ...state.gameState,
              ...overrides,
              playerName,
              partyName,
              slogan,
              difficulty,
              gameStarted: true,
            },
            regions,
          };
        }),

      completeTutorial: () =>
        set((state) => ({
          gameState: { ...state.gameState, hasCompletedTutorial: true },
        })),
    }),
    {
      name: "tunisia-simulator-campaign",
      // Checksummed + Base64 storage: hand-edited saves fail verification and
      // are dropped (anti-cheat).
      storage: createJSONStorage(() => checksummedStorage),
      version: 25,
      // Zod gate: after migration, a save that isn't a structurally valid
      // campaign is discarded and the clean default state is used instead of
      // crashing on malformed data.
      merge: (persistedState, currentState) =>
        isValidPersistedState(persistedState)
          ? { ...currentState, ...(persistedState as object) }
          : currentState,
      migrate: (persisted, version) => {
        const state = persisted as {
          gameState: GameState;
          regions: Record<RegionId, Region>;
          activeProjects: ActiveProject[];
          completedProjects: CompletedProject[];
          history: HistoryPoint[];
        };
        // v1 saves predate the event system; give them an empty event slot.
        if (version < 2) {
          state.gameState.currentEvent = null;
        }
        // v2 saves predate geography; backfill isCoastal from the seed data.
        if (version < 3) {
          for (const region of Object.values(state.regions)) {
            region.isCoastal = INITIAL_REGIONS[region.id].isCoastal;
          }
        }
        // v3 saves may contain coastal-only projects built in landlocked
        // regions before the constraint existed; demolish them.
        if (version < 4) {
          const violates = (project: ActiveProject | CompletedProject) =>
            Boolean(getProjectTemplate(project.projectId)?.requiresCoastal) &&
            !state.regions[project.regionId].isCoastal;
          state.activeProjects = state.activeProjects.filter(
            (project) => !violates(project),
          );
          state.completedProjects = state.completedProjects.filter(
            (project) => !violates(project),
          );
        }
        // v4 saves predate the socio-economic layer; backfill the new
        // per-region fields and rebuild per-region completion lists.
        if (version < 5) {
          for (const region of Object.values(state.regions)) {
            const seed = INITIAL_REGIONS[region.id];
            region.unemploymentRate = seed.unemploymentRate;
            region.developmentIndex = seed.developmentIndex;
            region.currentNeeds = seed.currentNeeds;
            region.completedProjects = state.completedProjects
              .filter((project) => project.regionId === region.id)
              .map((project) => project.projectId);
          }
        }
        // v5 saves predate the neural economy; backfill education/security.
        if (version < 6) {
          for (const region of Object.values(state.regions)) {
            const seed = INITIAL_REGIONS[region.id];
            region.educationRate = seed.educationRate;
            region.securityLevel = seed.securityLevel;
          }
        }
        // v6 saves predate the political engine; add its state slots.
        if (version < 7) {
          state.gameState.politicalEvent = null;
          state.gameState.politicalCooldown = 0;
          state.gameState.boomedRegions = [];
        }
        // v7 saves predate outcomes and the analytics history.
        if (version < 8) {
          state.gameState.outcome = null;
          state.gameState.outcomeReason = null;
          state.history = [];
        }
        // v8 saves predate the macro-economy; start the tech level at zero.
        if (version < 9) {
          state.gameState.techLevel = 0;
        }
        // v9 saves predate demographics and per-region event cooldowns.
        if (version < 10) {
          state.gameState.regionEventCooldowns = {};
          for (const point of state.history) {
            (point as { population?: number }).population ??= 0;
          }
        }
        // v10 → v11: the Living Map derives its choropleth, construction rings
        // and event markers entirely from existing state (regions,
        // activeProjects.monthsRemaining, regionEventCooldowns). No new fields
        // are stored; this guard simply guarantees old saves carry valid
        // construction timers and an event-cooldown map so the new overlays
        // render without gaps.
        if (version < 11) {
          state.gameState.regionEventCooldowns ??= {};
          state.activeProjects = state.activeProjects.filter((project) => {
            const template = getProjectTemplate(project.projectId);
            if (!template) {
              return false;
            }
            if (
              typeof project.monthsRemaining !== "number" ||
              project.monthsRemaining < 0
            ) {
              project.monthsRemaining = template.durationMonths;
            }
            return true;
          });
        }
        // v11 → v12: the socio-demographic engine. Backfill each region's
        // satisfaction and belonging from the seed values.
        if (version < 12) {
          for (const region of Object.values(state.regions)) {
            const seed = INITIAL_REGIONS[region.id];
            region.stateSatisfaction ??= seed.stateSatisfaction;
            region.nationalBelonging ??= seed.nationalBelonging;
          }
        }
        // v12 → v13: rebel-takeover state. No governorate starts rebel-held.
        if (version < 13) {
          for (const region of Object.values(state.regions)) {
            region.isUnderRebelControl ??= false;
          }
        }
        // v13 → v14: the two-stage probabilistic crisis. Backfill the new
        // per-region flags — no region starts with a spent diplomatic track or
        // an active siege.
        if (version < 14) {
          for (const region of Object.values(state.regions)) {
            region.diplomacyExhausted ??= false;
            region.siegeTurns ??= 0;
          }
        }
        // v14 → v15: the media propaganda engine. No campaign has run yet, so
        // credibility starts untouched.
        if (version < 15) {
          state.gameState.stateCredibility ??= 100;
        }
        // v15 → v16: the Shadow Economy. Backfill each region's smuggling
        // level from the seed data and start every crackdown switched off.
        if (version < 16) {
          for (const region of Object.values(state.regions)) {
            const seed = INITIAL_REGIONS[region.id];
            region.shadowEconomyLevel ??= seed.shadowEconomyLevel;
            region.crackdownActive ??= false;
          }
        }
        // v16 → v17: sovereign debt. No loan has been drawn yet.
        if (version < 17) {
          state.gameState.sovereignDebt ??= 0;
        }
        // v17 → v18: Harka & border infiltration. Backfill each region's
        // static isBorder geography flag and start both monthly status flags
        // clear.
        if (version < 18) {
          for (const region of Object.values(state.regions)) {
            const seed = INITIAL_REGIONS[region.id];
            region.isBorder ??= seed.isBorder;
            region.activeHarka ??= false;
            region.activeInfiltration ??= false;
          }
        }
        // v18 → v19: organized resistance & the sustained-collapse endgame.
        // No region starts on strike; no prior sub-critical months banked.
        if (version < 19) {
          for (const region of Object.values(state.regions)) {
            region.isStriking ??= false;
          }
          state.gameState.criticalStabilityMonths ??= 0;
          state.gameState.isGameOver ??= false;
        }
        // v19 → v20: the Central Bank. Purchasing power starts undamaged and
        // the Bank starts independent.
        if (version < 20) {
          state.gameState.purchasingPowerIndex ??= 100;
          state.gameState.bctIndependence ??= true;
        }
        // v20 → v21: the Rentier Oligarchy & Geopolitical Alignment. Cartels
        // start entrenched (80), no campaign running, alignment neutral-lean-
        // West (50, matching the campaign's initial IMF-friendly posture).
        if (version < 21) {
          state.gameState.oligarchyControl ??= 80;
          state.gameState.antiMonopolyActive ??= false;
          state.gameState.geopoliticalAlignment ??= 50;
        }
        // v21 → v22: National Union Agreements. No truce running, no
        // structural wage burden yet.
        if (version < 22) {
          state.gameState.nationalUnionTruce ??= 0;
          state.gameState.publicWageBurden ??= 0;
        }
        // v22 → v23: Sovereign Debt Servicing. No grace period running, no
        // default declared yet — existing sovereignDebt carries over as-is.
        if (version < 23) {
          state.gameState.debtGracePeriod ??= 0;
          state.gameState.isDefaulted ??= false;
        }
        // v23 → v24: the Historical Triumph. No existing save has already
        // met the win condition retroactively — it only ever evaluates going
        // forward, on the next tick.
        if (version < 24) {
          state.gameState.isVictorious ??= false;
        }
        // v24 → v25: The Inauguration (persona, difficulty, onboarding).
        // Any save reaching this migration already exists, meaning that
        // campaign was already started and played under the old flow — so,
        // unlike a genuinely new campaign, it backfills gameStarted and
        // hasCompletedTutorial to true rather than their fresh-game default
        // of false, or every existing save would resurface the setup modal
        // and tutorial bubbles retroactively.
        if (version < 25) {
          state.gameState.playerName ??= "";
          state.gameState.partyName ??= "";
          state.gameState.slogan ??= "";
          state.gameState.difficulty ??= "normal";
          state.gameState.hasCompletedTutorial ??= true;
          state.gameState.gameStarted ??= true;
        }
        return persisted;
      },
      // Selection and notices are transient UI state; only the campaign
      // itself is saved.
      partialize: (state) => ({
        gameState: state.gameState,
        regions: state.regions,
        activeProjects: state.activeProjects,
        completedProjects: state.completedProjects,
        history: state.history,
        populationTrends: state.populationTrends,
      }),
      // SSR and the first client render both use the initial state; the saved
      // campaign is loaded after mount (see StoreHydrator) so the HTML always
      // matches and React never sees a hydration mismatch.
      skipHydration: true,
    },
  ),
);
