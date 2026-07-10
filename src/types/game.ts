/**
 * Core simulation entities for the Tunisia grand-strategy game.
 *
 * These types are the single source of truth for game data shapes;
 * the Zustand store, seed data, and components all derive from them.
 */

/** Slugs for Tunisia's 24 governorates, matching `properties.id` in the GeoJSON. */
export const REGION_IDS = [
  "ariana",
  "beja",
  "ben-arous",
  "bizerte",
  "el-kef",
  "gabes",
  "gafsa",
  "jendouba",
  "kairouan",
  "kasserine",
  "kebili",
  "mahdia",
  "manouba",
  "medenine",
  "monastir",
  "nabeul",
  "sfax",
  "sidi-bouzid",
  "siliana",
  "sousse",
  "tataouine",
  "tozeur",
  "tunis",
  "zaghouan",
] as const;

export type RegionId = (typeof REGION_IDS)[number];

/** One-off consequences of a world event. */
export interface EventEffects {
  /** Applied to `GameState.totalBudget` the month the event fires, in M TND. */
  budgetChange: number;
  /** Applied to `GameState.hardCurrency` the month the event fires, in M USD. */
  hardCurrencyChange?: number;
  /** Net change to the affected region's population (persons), for display. */
  populationChange?: number;
}

/** A random world event that can fire on a monthly tick. */
export interface GameEvent {
  id: string;
  /** Headline (Arabic). */
  title: string;
  /** Narrative text (Arabic). */
  description: string;
  effects: EventEffects;
  /** Socio-political events carry a severity; flavor events omit it. */
  severity?: "crisis" | "boom";
  /** The governorate at the center of the event, when regional. */
  regionId?: RegionId;
  /**
   * Interactive events demand a player decision and pause the game loop
   * until resolved (see `resolvePoliticalChoice`).
   */
  interactive?:
    | { kind: "citizen-initiative"; regionId: RegionId }
    | { kind: "rebel-takeover"; regionId: RegionId };
}

/** Global state of the running simulation. */
export interface GameState {
  /** Current in-game date, ISO 8601 (`YYYY-MM-DD`). */
  currentDate: string;
  /** Total state budget, in million TND. */
  totalBudget: number;
  /** Hard-currency (foreign exchange) reserves, in million USD. */
  hardCurrency: number;
  /** National Tech Level (accumulated science points), 0 upward. */
  techLevel: number;
  /** Event that fired this month, if any; cleared on the next tick. */
  currentEvent: GameEvent | null;
  /** Socio-political event awaiting acknowledgement; pauses the game loop. */
  politicalEvent: GameEvent | null;
  /** Months until any socio-political event may fire again (global pacing). */
  politicalCooldown: number;
  /**
   * Per-(eventType:regionId) cooldown in months, so the same crisis cannot
   * repeat in the same governorate back-to-back (anti-spam / anti-greedy).
   */
  regionEventCooldowns: Record<string, number>;
  /** Regions that already received their one-time FDI boom. */
  boomedRegions: readonly RegionId[];
  /** Terminal state of the campaign, if reached. */
  outcome: GameOutcome | null;
  /** Arabic narrative explaining how the campaign ended. */
  outcomeReason: string | null;
  /**
   * مصداقية الدولة — how much the public still trusts state media, 0–100.
   * Spent by every propaganda campaign (the Lie Tax); the fabricated
   * satisfaction boost a campaign buys shrinks in proportion, so repeated use
   * has strictly diminishing returns.
   */
  stateCredibility: number;
  /**
   * الدين السيادي — accumulated foreign debt, million TND. Only ever rises
   * (via emergency loans); there is no repayment mechanic yet.
   */
  sovereignDebt: number;
}

/** How a campaign can end. */
export type GameOutcome = "collapse" | "victory";

/** One month of national indicators, kept for the analytics dashboard. */
export interface HistoryPoint {
  /** ISO date of the month this snapshot describes. */
  date: string;
  /** Annual national output, million TND. */
  gdp: number;
  /** National stability, 0–100. */
  stability: number;
  /** Treasury balance, million TND. */
  budget: number;
  /** Hard-currency reserves, million USD. */
  hardCurrency: number;
  /** National aggregate population (persons). */
  population: number;
}

/** One of the 24 governorates. */
export interface Region {
  id: RegionId;
  name: string;
  population: number;
  /** Development level of the governorate, 0 (none) to 10 (fully developed). */
  infrastructureLevel: number;
  /** Whether the governorate has a Mediterranean coastline. */
  isCoastal: boolean;
  /** Whether the governorate sits on the Algerian/Libyan land border. */
  isBorder: boolean;
  /** Registered unemployment as a percentage of the active population. */
  unemploymentRate: number;
  /** Composite socio-economic development index, 0 (lowest) to 100. */
  developmentIndex: number;
  /** Schooling / higher-education attainment score, 0–100. */
  educationRate: number;
  /** Public safety and border security score, 0–100. */
  securityLevel: number;
  /** `ProjectTemplate.id`s this governorate needs most, in priority order. */
  currentNeeds: readonly string[];
  /** `ProjectTemplate.id`s of projects completed here (may repeat). */
  completedProjects: readonly string[];
  /**
   * رضا المواطنين — short-term citizen satisfaction with the state, 0–100.
   * Volatile: reacts quickly to jobs, services and events; low values fuel
   * protests, riots and strikes.
   */
  stateSatisfaction: number;
  /**
   * الانتماء الوطني — deep sense of national belonging, 0–100. Slow and
   * inertial: erodes only under prolonged neglect (low development + low
   * education + low satisfaction). When it collapses in a marginalized
   * region, the state's absence invites either extremism or civic self-help.
   */
  nationalBelonging: number;
  /**
   * فقدان السيطرة — an armed rebel faction has seized the governorate. While
   * true it yields no taxes/GDP and its construction is paused, until the
   * State resolves it through the two-stage crisis (diplomacy then war room).
   */
  isUnderRebelControl: boolean;
  /**
   * Set once the diplomatic track of a takeover has failed. It locks the
   * crisis modal into its second (War Room) stage — negotiation is no longer
   * on the table — and is reset when the State finally retakes the region.
   */
  diplomacyExhausted: boolean;
  /**
   * Remaining months of an active Siege & Attrition operation. While > 0 the
   * governorate stays rebel-held (0 GDP) and bleeds satisfaction each month;
   * at 0 the State retakes it automatically.
   */
  siegeTurns: number;
  /**
   * الاقتصاد الموازي — how entrenched cross-border smuggling and informal
   * trade are here, 0–100. Above 30, and absent a crackdown, the state
   * collects no tax from this governorate but locals quietly welcome the
   * income (`stateSatisfaction` drifts up).
   */
  shadowEconomyLevel: number;
  /**
   * Whether a security crackdown on the shadow economy is underway. It
   * restores normal taxation and grinds the shadow economy down (−10/month),
   * but the crackdown is deeply unpopular locally (`stateSatisfaction`
   * −8/month) — a dilemma between fiscal and social stability.
   */
  crackdownActive: boolean;
  /**
   * الحرقة — this coastal governorate lost people to maritime exit this
   * month (struggling development or satisfaction). Recomputed every tick;
   * clears automatically the month the underlying conditions ease.
   */
  activeHarka: boolean;
  /**
   * اختراق حدودي — this border governorate absorbed an undocumented
   * population influx this month (entrenched, un-cracked-down shadow
   * economy). Recomputed every tick.
   */
  activeInfiltration: boolean;
}

/** Region-level consequences of a completed project. */
export interface ProjectEffects {
  /** Applied to `Region.infrastructureLevel` on completion (clamped to 0–10). */
  infrastructureChange: number;
  /** Applied to `Region.educationRate` on completion (clamped to 0–100). */
  educationChange?: number;
  /** Applied to `Region.securityLevel` on completion (clamped to 0–100). */
  securityChange?: number;
}

/** A buildable development project as offered in the build menu. */
export interface ProjectTemplate {
  id: string;
  /** Display name (Arabic). */
  name: string;
  /** Cost in million TND, deducted from `GameState.totalBudget`. */
  costTND: number;
  /** Cost in million USD, deducted from `GameState.hardCurrency`. */
  costUSD: number;
  /** Construction time in in-game months. */
  durationMonths: number;
  /** Recurring upkeep in million TND per month once the project is completed. */
  maintenanceCostTND: number;
  /** Recurring upkeep in million USD per month once completed (advanced tech). */
  maintenanceUSD?: number;
  /** Direct + induced jobs created in the region once completed. */
  jobsCreated: number;
  /** Revenue in million TND per month generated once completed, if any. */
  directIncomeTND?: number;
  /** Export revenue in million USD per month once completed (renews reserves). */
  exportUSD?: number;
  /** Tech points contributed to the National Tech Level each month. */
  techPointsPerMonth?: number;
  /** Restricts construction to regions with `isCoastal: true`. */
  requiresCoastal?: boolean;
  /** Tech tree: template ids that must be completed in the region first. */
  requiresCompleted?: readonly string[];
  /** Advanced gating: minimum National Tech Level required to build. */
  requiresTechLevel?: number;
  effects: ProjectEffects;
}

/** A project under construction in a specific region. */
export interface ActiveProject {
  /** Unique per construction; several instances of one template may coexist. */
  instanceId: string;
  /** References `ProjectTemplate.id`. */
  projectId: string;
  regionId: RegionId;
  monthsRemaining: number;
}

/** A finished project; kept in state because it incurs monthly maintenance. */
export interface CompletedProject {
  instanceId: string;
  /** References `ProjectTemplate.id`. */
  projectId: string;
  regionId: RegionId;
}
