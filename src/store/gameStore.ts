import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ActiveProject,
  CompletedProject,
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
};

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
  toggleTimeRunning: () => void;
  setTimeSpeed: (speed: 1 | 2 | 3) => void;
  toggleDashboard: () => void;
  selectRegion: (id: RegionId | null) => void;
  dismissNotice: (instanceId: string) => void;
  /** Closes the socio-political modal and lets the game loop resume. */
  acknowledgePoliticalEvent: () => void;
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

      selectRegion: (id) => set({ selectedRegionId: id }),

      toggleTimeRunning: () =>
        set((state) => ({ timeRunning: !state.timeRunning })),

      setTimeSpeed: (speed) => set({ timeSpeed: speed }),

      toggleDashboard: () =>
        set((state) => ({ dashboardOpen: !state.dashboardOpen })),

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
          // A political event on screen — or a finished campaign — freezes
          // the loop.
          if (state.gameState.politicalEvent || state.gameState.outcome) {
            return state;
          }

          // Finances for the elapsing month, from the pre-tick state.
          const { net, hardCurrencyNet } = computeMonthlyFinances(
            state.regions,
            state.activeProjects,
            state.completedProjects,
          );
          // Science: completed universities / tech hubs / datacenters raise
          // the National Tech Level, which gates the advanced tech tree.
          const techGain = monthlyTechPoints(state.completedProjects);

          // Construction progress and completions.
          const ticked = state.activeProjects.map((project) => ({
            ...project,
            monthsRemaining: project.monthsRemaining - 1,
          }));
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

          // Demographics: natural growth + internal migration / brain drain.
          regions = applyDemographics(regions);

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

          // National snapshot, win/loss evaluation, and history.
          const nextDate = addOneMonth(state.gameState.currentDate);
          const nextBudget =
            state.gameState.totalBudget +
            net +
            eventBudgetChange +
            political.budgetDelta;
          // Exports renew reserves; advanced-project USD upkeep drains them.
          const nextHardCurrency =
            state.gameState.hardCurrency +
            hardCurrencyNet +
            political.hardCurrencyDelta;
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
        }),
    }),
    {
      name: "tunisia-simulator-campaign",
      storage: createJSONStorage(() => localStorage),
      version: 10,
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
