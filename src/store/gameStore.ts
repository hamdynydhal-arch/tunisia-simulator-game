import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ActiveProject,
  CompletedProject,
  GameEvent,
  GameState,
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
} from "@/lib/economy";
import {
  POLITICAL_COOLDOWN_MONTHS,
  evaluatePoliticalEvents,
} from "@/lib/eventManager";

const INITIAL_GAME_STATE: GameState = {
  currentDate: "2026-01-01",
  totalBudget: 5_000,
  hardCurrency: 2_400,
  currentEvent: null,
  politicalEvent: null,
  politicalCooldown: 0,
  boomedRegions: [],
};

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
  selectedRegionId: RegionId | null;
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
      selectedRegionId: null,

      selectRegion: (id) => set({ selectedRegionId: id }),

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
          // A political event on screen pauses the loop until acknowledged.
          if (state.gameState.politicalEvent) {
            return state;
          }

          // Finances for the elapsing month, from the pre-tick state.
          const { net } = computeMonthlyFinances(
            state.regions,
            state.activeProjects,
            state.completedProjects,
          );

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

          // Socio-political engine (riots / border crises / booms).
          const political = evaluatePoliticalEvents({
            regions,
            completedProjects,
            cooldown: state.gameState.politicalCooldown,
            boomedRegions: state.gameState.boomedRegions,
          });
          regions = political.regions;
          completedProjects = political.completedProjects;

          // Random flavor event, only in politically quiet months.
          let currentEvent: GameEvent | null = null;
          let eventBudgetChange = 0;
          if (!political.event && Math.random() < EVENT_CHANCE) {
            currentEvent =
              GAME_EVENTS[Math.floor(Math.random() * GAME_EVENTS.length)];
            eventBudgetChange = currentEvent.effects.budgetChange;
          }

          return {
            gameState: {
              ...state.gameState,
              currentDate: addOneMonth(state.gameState.currentDate),
              totalBudget:
                state.gameState.totalBudget +
                net +
                eventBudgetChange +
                political.budgetDelta,
              hardCurrency:
                state.gameState.hardCurrency + political.hardCurrencyDelta,
              currentEvent,
              politicalEvent: political.event,
              politicalCooldown: political.event
                ? POLITICAL_COOLDOWN_MONTHS
                : Math.max(0, state.gameState.politicalCooldown - 1),
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
          selectedRegionId: null,
        }),
    }),
    {
      name: "tunisia-simulator-campaign",
      storage: createJSONStorage(() => localStorage),
      version: 7,
      migrate: (persisted, version) => {
        const state = persisted as {
          gameState: GameState;
          regions: Record<RegionId, Region>;
          activeProjects: ActiveProject[];
          completedProjects: CompletedProject[];
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
        return persisted;
      },
      // Selection and notices are transient UI state; only the campaign
      // itself is saved.
      partialize: (state) => ({
        gameState: state.gameState,
        regions: state.regions,
        activeProjects: state.activeProjects,
        completedProjects: state.completedProjects,
      }),
      // SSR and the first client render both use the initial state; the saved
      // campaign is loaded after mount (see StoreHydrator) so the HTML always
      // matches and React never sees a hydration mismatch.
      skipHydration: true,
    },
  ),
);
