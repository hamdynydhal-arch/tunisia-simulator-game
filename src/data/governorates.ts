import type { Region, RegionId } from "@/types/game";

/**
 * Human-geography configuration for the 24 governorates.
 *
 * `id` stays in English kebab-case — it is the binding key to `properties.id`
 * in the GeoJSON; only the display `name` is localized (Arabic).
 *
 * Figures are gameplay estimates shaped by real regional patterns:
 * - population: 2014 census (INS);
 * - unemploymentRate (%): low on the Sahel coast (~9–13), high in the
 *   interior and mining/border regions (~19–29);
 * - developmentIndex (0–100): follows the INS regional development index —
 *   Greater Tunis / Sahel high, north-west and centre-west low;
 * - currentNeeds: ProjectTemplate ids in priority order, mapped to real
 *   geography (livestock for the pastoral interior, archaeology where the
 *   heritage sites actually are — Dougga in Béja, El Jem in Mahdia,
 *   Kairouan's medina, the ksour of Tataouine…);
 * - educationRate / securityLevel (0–100): schooling attainment and
 *   public/border safety — lowest along the Algerian/Libyan borders;
 * - infrastructureLevel: 0–10 starting values (drives tax income);
 * - completedProjects: starts empty, appended to as construction finishes.
 */
const REGION_LIST: readonly Omit<
  Region,
  | "stateSatisfaction"
  | "nationalBelonging"
  | "isUnderRebelControl"
  | "diplomacyExhausted"
  | "siegeTurns"
  | "shadowEconomyLevel"
  | "crackdownActive"
  | "isBorder"
  | "activeHarka"
  | "activeInfiltration"
  | "isStriking"
  | "strikeMonths"
  | "securityCampaignMonths"
>[] = [
  {
    id: "tunis",
    name: "تونس",
    population: 1_056_247,
    infrastructureLevel: 8,
    isCoastal: true,
    unemploymentRate: 14.1,
    developmentIndex: 76,
    educationRate: 72,
    securityLevel: 80,
    currentNeeds: ["archaeological-restoration", "regional-hospital"],
    completedProjects: [],
  },
  {
    id: "ariana",
    name: "أريانة",
    population: 576_088,
    infrastructureLevel: 7,
    isCoastal: true,
    unemploymentRate: 12.5,
    developmentIndex: 73,
    educationRate: 74,
    securityLevel: 82,
    currentNeeds: ["industrial-zone", "regional-hospital"],
    completedProjects: [],
  },
  {
    id: "ben-arous",
    name: "بن عروس",
    population: 631_842,
    infrastructureLevel: 7,
    isCoastal: true,
    unemploymentRate: 13.2,
    developmentIndex: 70,
    educationRate: 70,
    securityLevel: 80,
    currentNeeds: ["commercial-port", "industrial-zone"],
    completedProjects: [],
  },
  {
    id: "manouba",
    name: "منوبة",
    population: 379_518,
    infrastructureLevel: 6,
    isCoastal: false,
    unemploymentRate: 16.8,
    developmentIndex: 52,
    educationRate: 62,
    securityLevel: 75,
    currentNeeds: ["industrial-zone", "highway", "livestock-program"],
    completedProjects: [],
  },
  {
    id: "nabeul",
    name: "نابل",
    population: 787_920,
    infrastructureLevel: 6,
    isCoastal: true,
    unemploymentRate: 10.8,
    developmentIndex: 60,
    educationRate: 66,
    securityLevel: 80,
    currentNeeds: ["desalination-plant", "archaeological-restoration"],
    completedProjects: [],
  },
  {
    id: "zaghouan",
    name: "زغوان",
    population: 176_945,
    infrastructureLevel: 4,
    isCoastal: false,
    unemploymentRate: 15.9,
    developmentIndex: 50,
    educationRate: 55,
    securityLevel: 72,
    currentNeeds: ["industrial-zone", "livestock-program", "highway"],
    completedProjects: [],
  },
  {
    id: "bizerte",
    name: "بنزرت",
    population: 568_219,
    infrastructureLevel: 5,
    isCoastal: true,
    unemploymentRate: 13.6,
    developmentIndex: 57,
    educationRate: 63,
    securityLevel: 78,
    currentNeeds: ["commercial-port", "industrial-zone", "regional-hospital"],
    completedProjects: [],
  },
  {
    id: "beja",
    name: "باجة",
    population: 303_032,
    infrastructureLevel: 4,
    isCoastal: true,
    unemploymentRate: 18.2,
    developmentIndex: 44,
    educationRate: 52,
    securityLevel: 70,
    currentNeeds: ["archaeological-restoration", "livestock-program", "school-network", "highway"],
    completedProjects: [],
  },
  {
    id: "jendouba",
    name: "جندوبة",
    population: 401_477,
    infrastructureLevel: 3,
    isCoastal: true,
    unemploymentRate: 21.4,
    developmentIndex: 38,
    educationRate: 47,
    securityLevel: 58,
    currentNeeds: ["regional-hospital", "school-network", "archaeological-restoration", "livestock-program", "defense-base"],
    completedProjects: [],
  },
  {
    id: "el-kef",
    name: "الكاف",
    population: 243_156,
    infrastructureLevel: 3,
    isCoastal: false,
    unemploymentRate: 20.6,
    developmentIndex: 43,
    educationRate: 50,
    securityLevel: 62,
    currentNeeds: ["livestock-program", "school-network", "highway", "defense-base"],
    completedProjects: [],
  },
  {
    id: "siliana",
    name: "سليانة",
    population: 223_087,
    infrastructureLevel: 3,
    isCoastal: false,
    unemploymentRate: 19.3,
    developmentIndex: 40,
    educationRate: 48,
    securityLevel: 64,
    currentNeeds: ["livestock-program", "school-network", "highway", "regional-hospital"],
    completedProjects: [],
  },
  {
    id: "sousse",
    name: "سوسة",
    population: 674_971,
    infrastructureLevel: 7,
    isCoastal: true,
    unemploymentRate: 12.9,
    developmentIndex: 65,
    educationRate: 68,
    securityLevel: 80,
    currentNeeds: ["commercial-port", "archaeological-restoration"],
    completedProjects: [],
  },
  {
    id: "monastir",
    name: "المنستير",
    population: 548_828,
    infrastructureLevel: 7,
    isCoastal: true,
    unemploymentRate: 9.8,
    developmentIndex: 68,
    educationRate: 71,
    securityLevel: 83,
    currentNeeds: ["desalination-plant", "industrial-zone"],
    completedProjects: [],
  },
  {
    id: "mahdia",
    name: "المهدية",
    population: 410_812,
    infrastructureLevel: 5,
    isCoastal: true,
    unemploymentRate: 13.4,
    developmentIndex: 48,
    educationRate: 58,
    securityLevel: 76,
    currentNeeds: ["archaeological-restoration", "desalination-plant", "regional-hospital"],
    completedProjects: [],
  },
  {
    id: "sfax",
    name: "صفاقس",
    population: 955_421,
    infrastructureLevel: 7,
    isCoastal: true,
    unemploymentRate: 11.2,
    developmentIndex: 63,
    educationRate: 67,
    securityLevel: 79,
    currentNeeds: ["commercial-port", "desalination-plant", "industrial-zone"],
    completedProjects: [],
  },
  {
    id: "kairouan",
    name: "القيروان",
    population: 570_559,
    infrastructureLevel: 4,
    isCoastal: false,
    unemploymentRate: 18.9,
    developmentIndex: 38,
    educationRate: 45,
    securityLevel: 65,
    currentNeeds: ["regional-hospital", "school-network", "archaeological-restoration", "livestock-program"],
    completedProjects: [],
  },
  {
    id: "kasserine",
    name: "القصرين",
    population: 439_243,
    infrastructureLevel: 2,
    isCoastal: false,
    unemploymentRate: 25.3,
    developmentIndex: 35,
    educationRate: 40,
    securityLevel: 45,
    currentNeeds: ["regional-hospital", "school-network", "livestock-program", "highway", "defense-base"],
    completedProjects: [],
  },
  {
    id: "sidi-bouzid",
    name: "سيدي بوزيد",
    population: 429_912,
    infrastructureLevel: 2,
    isCoastal: false,
    unemploymentRate: 22.7,
    developmentIndex: 37,
    educationRate: 42,
    securityLevel: 55,
    currentNeeds: ["livestock-program", "school-network", "regional-hospital", "highway"],
    completedProjects: [],
  },
  {
    id: "gabes",
    name: "قابس",
    population: 374_300,
    infrastructureLevel: 5,
    isCoastal: true,
    unemploymentRate: 21.8,
    developmentIndex: 48,
    educationRate: 55,
    securityLevel: 70,
    currentNeeds: ["desalination-plant", "commercial-port", "regional-hospital"],
    completedProjects: [],
  },
  {
    id: "medenine",
    name: "مدنين",
    population: 479_520,
    infrastructureLevel: 5,
    isCoastal: true,
    unemploymentRate: 18.4,
    developmentIndex: 49,
    educationRate: 54,
    securityLevel: 68,
    currentNeeds: ["desalination-plant", "commercial-port", "archaeological-restoration", "defense-base"],
    completedProjects: [],
  },
  {
    id: "tataouine",
    name: "تطاوين",
    population: 149_453,
    infrastructureLevel: 3,
    isCoastal: false,
    unemploymentRate: 28.6,
    developmentIndex: 40,
    educationRate: 43,
    securityLevel: 52,
    currentNeeds: ["archaeological-restoration", "livestock-program", "defense-base", "school-network"],
    completedProjects: [],
  },
  {
    id: "gafsa",
    name: "قفصة",
    population: 337_331,
    infrastructureLevel: 4,
    isCoastal: false,
    unemploymentRate: 26.2,
    developmentIndex: 42,
    educationRate: 48,
    securityLevel: 58,
    currentNeeds: ["industrial-zone", "school-network", "regional-hospital", "defense-base"],
    completedProjects: [],
  },
  {
    id: "tozeur",
    name: "توزر",
    population: 107_912,
    infrastructureLevel: 4,
    isCoastal: false,
    unemploymentRate: 19.6,
    developmentIndex: 46,
    educationRate: 52,
    securityLevel: 66,
    currentNeeds: ["archaeological-restoration", "livestock-program"],
    completedProjects: [],
  },
  {
    id: "kebili",
    name: "قبلي",
    population: 156_961,
    infrastructureLevel: 3,
    isCoastal: false,
    unemploymentRate: 20.1,
    developmentIndex: 45,
    educationRate: 50,
    securityLevel: 63,
    currentNeeds: ["livestock-program", "school-network", "highway"],
    completedProjects: [],
  },
];

/**
 * Governorates on the Algerian/Libyan land border — the historical
 * infiltration and smuggling corridors. Canonical list: exported so
 * `eventManager.ts` shares it instead of keeping a second copy that could
 * drift out of sync.
 */
export const BORDER_REGION_IDS: readonly RegionId[] = [
  "jendouba",
  "el-kef",
  "kasserine",
  "gafsa",
  "tozeur",
  "kebili",
  "tataouine",
  "medenine",
];

/**
 * Lightweight geographic grouping into Tunisia's seven standard statistical
 * macro-regions (the INS "grandes régions": Grand Tunis, Nord Est, Nord
 * Ouest, Centre Est, Centre Ouest, Sud Est, Sud Ouest). Two governorates in
 * the same group are treated as "neighbors" for the spatial spillover engine
 * in `gameStore.ts` — a lookup table, not a precise border-adjacency graph,
 * per Phase 28's "lightweight, logical grouping" scope.
 */
export const REGION_GROUP: Record<RegionId, string> = {
  tunis: "grand-tunis",
  ariana: "grand-tunis",
  "ben-arous": "grand-tunis",
  manouba: "grand-tunis",
  nabeul: "north-east",
  zaghouan: "north-east",
  bizerte: "north-east",
  beja: "north-west",
  jendouba: "north-west",
  "el-kef": "north-west",
  siliana: "north-west",
  sousse: "center-east",
  monastir: "center-east",
  mahdia: "center-east",
  sfax: "center-east",
  kairouan: "center-west",
  kasserine: "center-west",
  "sidi-bouzid": "center-west",
  gabes: "south-east",
  medenine: "south-east",
  tataouine: "south-east",
  gafsa: "south-west",
  tozeur: "south-west",
  kebili: "south-west",
};

const clampPct = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/**
 * Seed values for the socio-demographic variables, derived from each
 * governorate's development, employment, security and education so the coast
 * starts content and well-anchored while the marginalized interior starts
 * lower — the initial gradient the Equation of Belonging then evolves.
 */
type RegionSeed = Omit<
  Region,
  | "stateSatisfaction"
  | "nationalBelonging"
  | "isUnderRebelControl"
  | "diplomacyExhausted"
  | "siegeTurns"
  | "shadowEconomyLevel"
  | "crackdownActive"
  | "isBorder"
  | "activeHarka"
  | "activeInfiltration"
  | "isStriking"
  | "strikeMonths"
  | "securityCampaignMonths"
>;

function seedStateSatisfaction(region: RegionSeed): number {
  const employment = 100 - region.unemploymentRate * 2.2;
  return clampPct(
    0.45 * region.developmentIndex + 0.35 * employment + 0.2 * region.securityLevel,
  );
}

function seedNationalBelonging(region: RegionSeed): number {
  // Belonging starts high across Tunisia (strong national identity) but is
  // thinner where the state has historically been least present.
  return clampPct(
    45 + 0.3 * region.developmentIndex + 0.15 * region.educationRate,
  );
}

/** Deterministic 0–1 pseudo-random draw from a region id, stable across the
 *  server prerender and the client's own module evaluation (unlike
 *  `Math.random`, which would diverge between the two and hydrate-mismatch). */
function hashUnit(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

/**
 * الاقتصاد الموازي seed: landlocked interior governorates — the historical
 * smuggling corridors along the Algerian/Libyan borders — start heavily
 * entrenched (60–90); the coast starts only lightly exposed (10–40).
 */
function seedShadowEconomyLevel(region: RegionSeed): number {
  const [lo, hi] = region.isCoastal ? [10, 40] : [60, 90];
  return Math.round(lo + hashUnit(region.id) * (hi - lo));
}

export const INITIAL_REGIONS: Record<RegionId, Region> = Object.fromEntries(
  REGION_LIST.map((region) => [
    region.id,
    {
      ...region,
      stateSatisfaction: seedStateSatisfaction(region),
      nationalBelonging: seedNationalBelonging(region),
      isUnderRebelControl: false,
      diplomacyExhausted: false,
      siegeTurns: 0,
      shadowEconomyLevel: seedShadowEconomyLevel(region),
      crackdownActive: false,
      isBorder: BORDER_REGION_IDS.includes(region.id),
      activeHarka: false,
      activeInfiltration: false,
      isStriking: false,
      strikeMonths: 0,
      securityCampaignMonths: 0,
    },
  ]),
) as Record<RegionId, Region>;
