import type { ProjectTemplate } from "@/types/game";

/** Buildable projects offered in every region. Costs are in millions. */
export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: "regional-hospital",
    name: "مستشفى جهوي",
    costTND: 180,
    costUSD: 40,
    durationMonths: 18,
    maintenanceCostTND: 5,
    effects: { infrastructureChange: 1 },
  },
  {
    id: "highway",
    name: "طريق سريع",
    costTND: 450,
    costUSD: 120,
    durationMonths: 30,
    maintenanceCostTND: 8,
    effects: { infrastructureChange: 2 },
  },
  {
    id: "industrial-zone",
    name: "منطقة صناعية",
    costTND: 260,
    costUSD: 90,
    durationMonths: 24,
    maintenanceCostTND: 6,
    directIncomeTND: 12,
    effects: { infrastructureChange: 2 },
  },
  {
    id: "commercial-port",
    name: "ميناء تجاري",
    costTND: 850,
    costUSD: 300,
    durationMonths: 36,
    maintenanceCostTND: 10,
    directIncomeTND: 20,
    requiresCoastal: true,
    effects: { infrastructureChange: 2 },
  },
  {
    id: "desalination-plant",
    name: "محطة تحلية مياه",
    costTND: 320,
    costUSD: 150,
    durationMonths: 20,
    maintenanceCostTND: 7,
    requiresCoastal: true,
    effects: { infrastructureChange: 1 },
  },
  {
    // Historical assets (Dougga, El Jem, Carthage…) restored into
    // revenue-generating cultural-tourism sites.
    id: "archaeological-restoration",
    name: "ترميم المواقع الأثرية",
    costTND: 120,
    costUSD: 25,
    durationMonths: 12,
    maintenanceCostTND: 3,
    directIncomeTND: 8,
    effects: { infrastructureChange: 1 },
  },
  {
    // Goat & sheep breeding program: food security plus steady rural income.
    id: "livestock-program",
    name: "تطوير الثروة الحيوانية",
    costTND: 90,
    costUSD: 15,
    durationMonths: 10,
    maintenanceCostTND: 2,
    directIncomeTND: 5,
    effects: { infrastructureChange: 1 },
  },
];

const TEMPLATES_BY_ID = new Map(
  PROJECT_TEMPLATES.map((template) => [template.id, template]),
);

export function getProjectTemplate(id: string): ProjectTemplate | undefined {
  return TEMPLATES_BY_ID.get(id);
}
