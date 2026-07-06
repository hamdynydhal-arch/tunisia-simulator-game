import type {
  CompletedProject,
  GameEvent,
  Region,
  RegionId,
} from "@/types/game";
import { getProjectTemplate } from "@/data/projects";
import { computeNationalMetrics } from "@/lib/economy";

/** Governorates on the Algerian/Libyan land borders. */
export const BORDER_REGIONS: readonly RegionId[] = [
  "jendouba",
  "el-kef",
  "kasserine",
  "gafsa",
  "tozeur",
  "kebili",
  "tataouine",
  "medenine",
];

/** Months of quiet enforced after any socio-political event fires. */
export const POLITICAL_COOLDOWN_MONTHS = 6;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface PoliticalEvaluationInput {
  regions: Record<RegionId, Region>;
  completedProjects: readonly CompletedProject[];
  /** Remaining cooldown from previous events; engine is silent while > 0. */
  cooldown: number;
  boomedRegions: readonly RegionId[];
}

export interface PoliticalOutcome {
  event: GameEvent | null;
  regions: Record<RegionId, Region>;
  completedProjects: readonly CompletedProject[];
  budgetDelta: number;
  hardCurrencyDelta: number;
  boomedRegion: RegionId | null;
}

/**
 * The socio-political engine, evaluated once per month AFTER the economic
 * tick. At most one event fires per month, followed by a cooldown.
 * Priority: riots (worst unemployment) > border crisis (weakest security)
 * > investment boom. All thresholds are real state — only the dice that
 * decide *whether this is the month it boils over* are random.
 */
export function evaluatePoliticalEvents(
  input: PoliticalEvaluationInput,
): PoliticalOutcome {
  const none: PoliticalOutcome = {
    event: null,
    regions: input.regions,
    completedProjects: input.completedProjects,
    budgetDelta: 0,
    hardCurrencyDelta: 0,
    boomedRegion: null,
  };
  if (input.cooldown > 0) {
    return none;
  }

  const metrics = computeNationalMetrics(input.regions);
  const regionList = Object.values(input.regions);

  // ---- 1. Riots: unemployment above 25% builds pressure every month; an
  // aggressive coast/interior gap (> 22 pts) pours fuel on it.
  const hot = regionList
    .filter((region) => region.unemploymentRate > 25)
    .sort((a, b) => b.unemploymentRate - a.unemploymentRate)[0];
  if (hot) {
    const chance = Math.min(
      0.5,
      (hot.unemploymentRate - 25) * 0.08 +
        (metrics.coastInteriorGap > 22 ? 0.1 : 0),
    );
    if (Math.random() < chance) {
      const destroyables = input.completedProjects.filter(
        (project) => project.regionId === hot.id,
      );
      if (destroyables.length > 0 && Math.random() < 0.5) {
        // Consequence A: rioters destroy a completed project.
        const victim =
          destroyables[Math.floor(Math.random() * destroyables.length)];
        const template = getProjectTemplate(victim.projectId);
        const regionCompleted = [...hot.completedProjects];
        regionCompleted.splice(regionCompleted.indexOf(victim.projectId), 1);
        return {
          ...none,
          event: {
            id: `riots-${hot.id}`,
            severity: "crisis",
            regionId: hot.id,
            title: `احتجاجات واسعة في ${hot.name}`,
            description: `تجاوزت البطالة في ${hot.name} عتبة الغليان (${hot.unemploymentRate.toFixed(1)}٪). خرجت مسيرات غاضبة أضرمت النار في منشأة «${template?.name ?? victim.projectId}» وأخرجتها من الخدمة نهائيًا. الشارع يطالب بالتشغيل والتنمية العادلة.`,
            effects: { budgetChange: 0 },
          },
          regions: {
            ...input.regions,
            [hot.id]: {
              ...hot,
              completedProjects: regionCompleted,
              infrastructureLevel: clamp(
                hot.infrastructureLevel -
                  (template?.effects.infrastructureChange ?? 1),
                0,
                10,
              ),
              securityLevel: clamp(hot.securityLevel - 5, 0, 100),
            },
          },
          completedProjects: input.completedProjects.filter(
            (project) => project.instanceId !== victim.instanceId,
          ),
        };
      }
      // Consequence B: an expensive emergency pacification package.
      const cost = Math.round(80 + (hot.unemploymentRate - 25) * 20);
      return {
        ...none,
        event: {
          id: `riots-${hot.id}`,
          severity: "crisis",
          regionId: hot.id,
          title: `احتجاجات واسعة في ${hot.name}`,
          description: `أسابيع من الاعتصامات والإضرابات في ${hot.name} بسبب بطالة بلغت ${hot.unemploymentRate.toFixed(1)}٪. اضطرت الحكومة إلى حزمة تهدئة اجتماعية عاجلة لامتصاص الغضب.`,
          effects: { budgetChange: -cost },
        },
        regions: {
          ...input.regions,
          [hot.id]: {
            ...hot,
            securityLevel: clamp(hot.securityLevel - 8, 0, 100),
          },
        },
        budgetDelta: -cost,
      };
    }
  }

  // ---- 2. Border crisis: fragile, under-developed border regions with no
  // defense base are exposed. Persists as a threat until one is built.
  const exposed = BORDER_REGIONS.map((id) => input.regions[id])
    .filter(
      (region) =>
        region.securityLevel < 50 &&
        region.developmentIndex < 45 &&
        !region.completedProjects.includes("defense-base"),
    )
    .sort((a, b) => a.securityLevel - b.securityLevel)[0];
  if (exposed && Math.random() < 0.12) {
    return {
      ...none,
      event: {
        id: `border-crisis-${exposed.id}`,
        severity: "crisis",
        regionId: exposed.id,
        title: `أزمة أمنية على الحدود — ${exposed.name}`,
        description: `تسللات وتهريب عبر الشريط الحدودي في ${exposed.name} حيث الأمن (${Math.round(exposed.securityLevel)}/100) والتنمية في أدنى مستوياتهما. استنزفت العمليات الطارئة احتياطي العملة الصعبة، وسيبقى الخطر قائمًا حتى بناء قاعدة أمنية وعسكرية في الجهة.`,
        effects: { budgetChange: 0, hardCurrencyChange: -120 },
      },
      regions: {
        ...input.regions,
        [exposed.id]: {
          ...exposed,
          securityLevel: clamp(exposed.securityLevel - 10, 0, 100),
        },
      },
      hardCurrencyDelta: -120,
    };
  }

  // ---- 3. Investment boom: highway + airport + strong security in one
  // region attract foreign capital, once per region per campaign.
  const boomRegion = regionList
    .filter(
      (region) =>
        !input.boomedRegions.includes(region.id) &&
        region.completedProjects.includes("highway") &&
        region.completedProjects.includes("airport") &&
        region.securityLevel >= 70,
    )
    .sort((a, b) => b.securityLevel - a.securityLevel)[0];
  if (boomRegion && Math.random() < 0.15) {
    return {
      ...none,
      event: {
        id: `fdi-boom-${boomRegion.id}`,
        severity: "boom",
        regionId: boomRegion.id,
        title: `طفرة استثمارية في ${boomRegion.name}`,
        description: `مزيج الطريق السريع والمطار الدولي والمناخ الأمني المستقر (${Math.round(boomRegion.securityLevel)}/100) وضع ${boomRegion.name} على خارطة الاستثمار العالمي: تدفق استثمارات أجنبية مباشرة ضخمة نحو الجهة.`,
        effects: { budgetChange: 100, hardCurrencyChange: 200 },
      },
      regions: {
        ...input.regions,
        [boomRegion.id]: {
          ...boomRegion,
          developmentIndex: clamp(boomRegion.developmentIndex + 3, 0, 100),
        },
      },
      budgetDelta: 100,
      hardCurrencyDelta: 200,
      boomedRegion: boomRegion.id,
    };
  }

  return none;
}
