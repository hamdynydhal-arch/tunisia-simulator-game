import type {
  CompletedProject,
  GameEvent,
  Region,
  RegionId,
} from "@/types/game";
import { getProjectTemplate } from "@/data/projects";
import { BORDER_REGION_IDS as BORDER_REGIONS } from "@/data/governorates";
import { computeNationalMetrics } from "@/lib/economy";

/** Coastal governorates that draw seasonal tourism. */
const TOURISM_REGIONS: readonly RegionId[] = [
  "sousse",
  "monastir",
  "nabeul",
  "medenine",
  "mahdia",
  "bizerte",
  "tunis",
];

/** Interior grain- and olive-belt governorates. */
const AGRICULTURAL_REGIONS: readonly RegionId[] = [
  "beja",
  "jendouba",
  "siliana",
  "kairouan",
  "el-kef",
  "zaghouan",
];

/** Heritage-rich governorates hosting cultural festivals. */
const HERITAGE_REGIONS: readonly RegionId[] = [
  "tunis",
  "mahdia",
  "el-kef",
  "kairouan",
  "tataouine",
];

/**
 * Hardcoded terrain/history bias for insurgency & terrorism risk, 0–1.
 * Anchored to Tunisia's real geography: the Chaambi and Sammama massifs in
 * Kasserine (highest), the neglected centre-west (Sidi Bouzid, Gafsa,
 * Kairouan), the north-west mountains (Jendouba, Le Kef) and the southern
 * desert border (Tataouine, Kébili, Médenine). Regions absent here are not
 * eligible for terrorism events at all.
 */
const TERRAIN_VULNERABILITY: Partial<Record<RegionId, number>> = {
  kasserine: 1.0,
  "sidi-bouzid": 0.7,
  gafsa: 0.55,
  kairouan: 0.35,
  jendouba: 0.5,
  "el-kef": 0.45,
  tataouine: 0.6,
  kebili: 0.45,
  medenine: 0.4,
};

/** Belonging at or below this in a marginalized region invites vacuum events. */
const BELONGING_CRITICAL = 40;

/** Global spacing between any two socio-political events (short — the
 *  per-region cooldown now carries anti-spam duty). */
export const POLITICAL_COOLDOWN_MONTHS = 2;
/** A given (eventType, region) cannot recur for this many months. */
export const REGION_EVENT_COOLDOWN_MONTHS = 15;
/** Monthly probability that the event pool is evaluated at all. */
const EVENT_EVAL_CHANCE = 0.22;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface PoliticalEvaluationInput {
  regions: Record<RegionId, Region>;
  completedProjects: readonly CompletedProject[];
  /** Global cooldown remaining; the engine is silent while > 0. */
  globalCooldown: number;
  /** Per-`type:region` cooldowns remaining, in months. */
  regionCooldowns: Readonly<Record<string, number>>;
  boomedRegions: readonly RegionId[];
  /** Calendar month of the tick, 1–12 (for seasonal events). */
  month: number;
}

export interface PoliticalOutcome {
  event: GameEvent | null;
  regions: Record<RegionId, Region>;
  completedProjects: readonly CompletedProject[];
  budgetDelta: number;
  hardCurrencyDelta: number;
  boomedRegion: RegionId | null;
  /** `type:region` key to place on cooldown, if an event fired. */
  cooldownKey: string | null;
}

/** A weighted, ready-to-apply event proposal for one region. */
interface Candidate {
  type: string;
  region: Region;
  weight: number;
  build: () => Omit<PoliticalOutcome, "cooldownKey">;
}

function weightedPick(candidates: Candidate[]): Candidate {
  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * total;
  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) {
      return candidate;
    }
  }
  return candidates[candidates.length - 1];
}

/**
 * The socio-political engine. Rather than always striking the single worst
 * region (the old greedy flaw), it gathers every eligible event across all
 * governorates — crises AND geo-cultural booms — weights each by how acute
 * its trigger is, filters out anything still on a per-region cooldown, and
 * draws ONE by weighted probability. The top-risk region is the most likely
 * flashpoint, not the only one, and a region that just rioted is silenced
 * for ~15 months so the pressure surfaces elsewhere.
 */
export function evaluatePoliticalEvents(
  input: PoliticalEvaluationInput,
): PoliticalOutcome {
  const base: Omit<PoliticalOutcome, "cooldownKey"> = {
    event: null,
    regions: input.regions,
    completedProjects: input.completedProjects,
    budgetDelta: 0,
    hardCurrencyDelta: 0,
    boomedRegion: null,
  };
  const none: PoliticalOutcome = { ...base, cooldownKey: null };

  if (input.globalCooldown > 0 || Math.random() >= EVENT_EVAL_CHANCE) {
    return none;
  }

  const metrics = computeNationalMetrics(input.regions);
  const list = Object.values(input.regions);
  const onCooldown = (type: string, id: RegionId) =>
    (input.regionCooldowns[`${type}:${id}`] ?? 0) > 0;
  const isSummer = input.month >= 6 && input.month <= 8;
  const isHarvest = input.month >= 5 && input.month <= 6;

  const candidates: Candidate[] = [];
  const add = (
    type: string,
    region: Region,
    weight: number,
    build: () => Omit<PoliticalOutcome, "cooldownKey">,
  ) => {
    if (weight > 0 && !onCooldown(type, region.id)) {
      candidates.push({ type, region, weight, build });
    }
  };

  for (const region of list) {
    const withRegion = (patch: Partial<Region>) => ({
      ...input.regions,
      [region.id]: { ...region, ...patch },
    });

    // A governorate already lost to rebels generates no further events until
    // the State resolves it.
    if (region.isUnderRebelControl) {
      continue;
    }

    // ---- Rebel takeover (فقدان السيطرة): total belonging collapse (<10) in a
    // vulnerable region. This supersedes every other event there and forces a
    // sovereign decision. ----
    if ((TERRAIN_VULNERABILITY[region.id] ?? 0) > 0 && region.nationalBelonging < 10) {
      add("rebel-takeover", region, 100, () => ({
        ...base,
        event: {
          id: `rebel-takeover-${region.id}`,
          severity: "crisis",
          regionId: region.id,
          title: `فقدان السيطرة على ${region.name}`,
          description: `انهار الانتماء الوطني في ${region.name} (${Math.round(region.nationalBelonging)}/100) وسيطر مسلحون على الجهة بالكامل. توقّفت الجباية والمشاريع، وباتت الولاية خارج سلطة الدولة. على الدولة أن تحسم موقفها.`,
          effects: { budgetChange: 0 },
          interactive: { kind: "rebel-takeover", regionId: region.id },
        },
        regions: withRegion({
          isUnderRebelControl: true,
          securityLevel: clamp(region.securityLevel - 20, 0, 100),
        }),
      }));
      if (!onCooldown("rebel-takeover", region.id)) {
        continue;
      }
    }

    // ---- Riots: unemployment past the boiling point. ----
    if (region.unemploymentRate > 25) {
      const weight =
        (region.unemploymentRate - 25) * 0.5 +
        (metrics.coastInteriorGap > 22 ? 1.5 : 0);
      add("riots", region, weight, () => {
        const destroyables = input.completedProjects.filter(
          (p) => p.regionId === region.id,
        );
        if (destroyables.length > 0 && Math.random() < 0.5) {
          const victim =
            destroyables[Math.floor(Math.random() * destroyables.length)];
          const template = getProjectTemplate(victim.projectId);
          const regionCompleted = region.completedProjects.filter(
            (id, i) =>
              i !== region.completedProjects.indexOf(victim.projectId),
          );
          return {
            ...base,
            event: {
              id: `riots-${region.id}`,
              severity: "crisis",
              regionId: region.id,
              title: `احتجاجات واسعة في ${region.name}`,
              description: `تجاوزت البطالة في ${region.name} عتبة الغليان (${region.unemploymentRate.toFixed(1)}٪). أضرمت مسيرات غاضبة النار في منشأة «${template?.name ?? victim.projectId}» وأخرجتها من الخدمة. الشارع يطالب بالتشغيل والتنمية العادلة.`,
              effects: { budgetChange: 0 },
            },
            regions: {
              ...input.regions,
              [region.id]: {
                ...region,
                completedProjects: regionCompleted,
                infrastructureLevel: clamp(
                  region.infrastructureLevel -
                    (template?.effects.infrastructureChange ?? 1),
                  0,
                  10,
                ),
                securityLevel: clamp(region.securityLevel - 5, 0, 100),
              },
            },
            completedProjects: input.completedProjects.filter(
              (p) => p.instanceId !== victim.instanceId,
            ),
          };
        }
        const cost = Math.round(80 + (region.unemploymentRate - 25) * 20);
        return {
          ...base,
          event: {
            id: `riots-${region.id}`,
            severity: "crisis",
            regionId: region.id,
            title: `احتجاجات واسعة في ${region.name}`,
            description: `أسابيع من الاعتصامات في ${region.name} بسبب بطالة بلغت ${region.unemploymentRate.toFixed(1)}٪. اضطرت الحكومة إلى حزمة تهدئة اجتماعية عاجلة.`,
            effects: { budgetChange: -cost },
          },
          regions: withRegion({
            securityLevel: clamp(region.securityLevel - 8, 0, 100),
          }),
          budgetDelta: -cost,
        };
      });
    }

    // ---- Border crisis: fragile, undefended frontier. ----
    if (
      BORDER_REGIONS.includes(region.id) &&
      region.securityLevel < 50 &&
      region.developmentIndex < 45 &&
      !region.completedProjects.includes("defense-base")
    ) {
      add("border-crisis", region, (50 - region.securityLevel) * 0.14, () => ({
        ...base,
        event: {
          id: `border-crisis-${region.id}`,
          severity: "crisis",
          regionId: region.id,
          title: `أزمة أمنية على الحدود — ${region.name}`,
          description: `تسللات عبر الشريط الحدودي في ${region.name} حيث الأمن (${Math.round(region.securityLevel)}/100) في أدنى مستوياته. استنزفت العمليات الطارئة احتياطي العملة الصعبة. يبقى الخطر قائمًا حتى بناء قاعدة أمنية في الجهة.`,
          effects: { budgetChange: 0, hardCurrencyChange: -120 },
        },
        regions: withRegion({
          securityLevel: clamp(region.securityLevel - 10, 0, 100),
        }),
        hardCurrencyDelta: -120,
      }));
    }

    // ---- Smuggling spike: porous low-security border. ----
    if (BORDER_REGIONS.includes(region.id) && region.securityLevel < 55) {
      add("smuggling", region, (55 - region.securityLevel) * 0.1, () => {
        const drain = Math.round(40 + (55 - region.securityLevel) * 3);
        return {
          ...base,
          event: {
            id: `smuggling-${region.id}`,
            severity: "crisis",
            regionId: region.id,
            title: `تصاعد التهريب في ${region.name}`,
            description: `ازدهرت السوق الموازية عبر حدود ${region.name}، فتبخّرت مداخيل جبائية كبيرة للدولة — رغم أن الاقتصاد الموازي امتصّ جزءًا من البطالة المحلية مؤقتًا.`,
            effects: { budgetChange: -drain },
          },
          regions: withRegion({
            unemploymentRate:
              Math.round((region.unemploymentRate - 0.6) * 100) / 100,
          }),
          budgetDelta: -drain,
        };
      });
    }

    // ---- Sea migration (حرقة): boats leave only from an ACTUAL coast. A
    // border governorate — even a coastal one like Médenine — is modelled as
    // a land frontier here, so its irregular migration is land-based
    // (smuggling / infiltration) above, never boats. Landlocked Tataouine is
    // excluded automatically. ----
    if (
      region.isCoastal &&
      !BORDER_REGIONS.includes(region.id) &&
      region.unemploymentRate > 20
    ) {
      add("harga", region, (region.unemploymentRate - 20) * 0.22, () => {
        const lost = Math.round(region.population * 0.008);
        return {
          ...base,
          event: {
            id: `harga-${region.id}`,
            severity: "crisis",
            regionId: region.id,
            title: `موجة هجرة غير نظامية من ${region.name}`,
            description: `أبحرت قوارب «الحرقة» من سواحل ${region.name} حاملةً آلاف الشبان العاطلين نحو أوروبا. نزيف في القوى العاملة وصدمة اجتماعية هزّت الاستقرار الوطني.`,
            effects: { budgetChange: 0, populationChange: -lost },
          },
          regions: withRegion({
            population: Math.max(20_000, region.population - lost),
            securityLevel: clamp(region.securityLevel - 6, 0, 100),
          }),
        };
      });
    }

    // ---- Terrorism / armed insurgency: only in terrain-vulnerable regions,
    // and only once the state has truly receded — collapsed belonging, or
    // collapsed security in an under-developed governorate. The Chaambi
    // reality: the mountains fill with what the state left behind. ----
    const terrain = TERRAIN_VULNERABILITY[region.id] ?? 0;
    if (terrain > 0 && region.developmentIndex < 48) {
      const belongingDeficit = Math.max(
        0,
        BELONGING_CRITICAL - region.nationalBelonging,
      );
      const securityDeficit = Math.max(0, 45 - region.securityLevel);
      const weight = terrain * (belongingDeficit * 0.05 + securityDeficit * 0.03);
      add("terrorism", region, weight, () => {
        const cost = Math.round(70 + securityDeficit * 5);
        return {
          ...base,
          event: {
            id: `terrorism-${region.id}`,
            severity: "crisis",
            regionId: region.id,
            title: `عملية إرهابية في ${region.name}`,
            description: `في جبال ${region.name} حيث تراجعت الدولة (الانتماء ${Math.round(region.nationalBelonging)}/100، الأمن ${Math.round(region.securityLevel)}/100)، ملأ التطرف الفراغ. كلّفت العملية الأمنية الخزينة غاليًا وهزّت الاستقرار الوطني.`,
            effects: { budgetChange: -cost },
          },
          regions: withRegion({
            securityLevel: clamp(region.securityLevel - 15, 0, 100),
            infrastructureLevel: clamp(region.infrastructureLevel - 1, 0, 10),
            developmentIndex: clamp(region.developmentIndex - 2, 0, 100),
            nationalBelonging: clamp(region.nationalBelonging - 3, 0, 100),
          }),
          budgetDelta: -cost,
        };
      });
    }

    // ---- Citizen initiative (مبادرة مواطنية): where belonging has fallen but
    // the community is resilient (educated), citizens organize to fix their
    // own region. Interactive — the state must decide how to respond. ----
    const belongingDeficit = Math.max(
      0,
      BELONGING_CRITICAL + 5 - region.nationalBelonging,
    );
    if (belongingDeficit > 0 && region.developmentIndex < 55) {
      const resilience = clamp(region.educationRate / 100, 0.2, 0.9);
      add("citizen-initiative", region, belongingDeficit * 0.05 * resilience, () => ({
        ...base,
        event: {
          id: `citizen-initiative-${region.id}`,
          severity: "boom",
          regionId: region.id,
          title: `مبادرة مواطنية في ${region.name}`,
          description: `أمام غياب الدولة، نظّم أبناء ${region.name} أنفسهم لترميم مدرسة وإصلاح طرقات جهتهم بسواعدهم. لحظة فارقة: كيف تردّ الدولة؟`,
          effects: { budgetChange: 0 },
          interactive: { kind: "citizen-initiative", regionId: region.id },
        },
        // Self-organizing already lifts belonging a little; the player's
        // response (see resolvePoliticalChoice) can lift it much more.
        regions: withRegion({
          nationalBelonging: clamp(region.nationalBelonging + 4, 0, 100),
        }),
      }));
    }

    // ---- Tourism boom: summer on a secure coast. ----
    if (
      TOURISM_REGIONS.includes(region.id) &&
      isSummer &&
      region.securityLevel > 70
    ) {
      add("tourism", region, 2, () => {
        const usd = Math.round(90 + region.developmentIndex);
        return {
          ...base,
          event: {
            id: `tourism-${region.id}`,
            severity: "boom",
            regionId: region.id,
            title: `موسم سياحي استثنائي في ${region.name}`,
            description: `اكتظّت شواطئ ${region.name} ونُزُلها بالسياح هذا الصيف، فتدفقت العملة الصعبة وتراجعت البطالة الموسمية.`,
            effects: { budgetChange: 20, hardCurrencyChange: usd },
          },
          regions: withRegion({
            unemploymentRate: Math.max(
              4,
              Math.round((region.unemploymentRate - 1.2) * 100) / 100,
            ),
          }),
          budgetDelta: 20,
          hardCurrencyDelta: usd,
        };
      });
    }

    // ---- Agricultural harvest: interior belt, harvest months. ----
    if (AGRICULTURAL_REGIONS.includes(region.id) && isHarvest) {
      add("harvest", region, 1.5, () => {
        const gain = Math.round(40 + region.infrastructureLevel * 12);
        return {
          ...base,
          event: {
            id: `harvest-${region.id}`,
            severity: "boom",
            regionId: region.id,
            title: `موسم فلاحي وفير في ${region.name}`,
            description: `حصاد قياسي من الحبوب والزيتون في ${region.name} رفد خزينة الدولة وأنعش الاقتصاد الريفي.`,
            effects: { budgetChange: gain },
          },
          regions: input.regions,
          budgetDelta: gain,
        };
      });
    }

    // ---- Cultural festival: heritage region, summer. ----
    if (HERITAGE_REGIONS.includes(region.id) && isSummer) {
      add("festival", region, 1.2, () => ({
        ...base,
        event: {
          id: `festival-${region.id}`,
          severity: "boom",
          regionId: region.id,
          title: `مهرجان ثقافي في ${region.name}`,
          description: `أضاء مهرجان ${region.name} الصيفي سمعة الجهة، فارتفعت التنمية المحلية وتعزّز الاستقرار الوطني بفعل الإشعاع الثقافي.`,
          effects: { budgetChange: 15 },
        },
        regions: withRegion({
          developmentIndex: clamp(region.developmentIndex + 2, 0, 100),
        }),
        budgetDelta: 15,
      }));
    }

    // ---- FDI boom: connectivity + security, once per region. ----
    if (
      !input.boomedRegions.includes(region.id) &&
      region.completedProjects.includes("highway") &&
      region.completedProjects.includes("airport") &&
      region.securityLevel >= 70
    ) {
      add("fdi", region, 2, () => ({
        ...base,
        event: {
          id: `fdi-${region.id}`,
          severity: "boom",
          regionId: region.id,
          title: `طفرة استثمارية في ${region.name}`,
          description: `مزيج الطريق السريع والمطار والأمن المستقر وضع ${region.name} على خارطة الاستثمار العالمي: تدفق استثمار أجنبي مباشر ضخم.`,
          effects: { budgetChange: 100, hardCurrencyChange: 200 },
        },
        regions: withRegion({
          developmentIndex: clamp(region.developmentIndex + 3, 0, 100),
        }),
        budgetDelta: 100,
        hardCurrencyDelta: 200,
        boomedRegion: region.id,
      }));
    }
  }

  if (candidates.length === 0) {
    return none;
  }

  const chosen = weightedPick(candidates);
  return { ...chosen.build(), cooldownKey: `${chosen.type}:${chosen.region.id}` };
}
