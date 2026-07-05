import type { Region, RegionId } from "@/types/game";

/**
 * Seed data for the 24 governorates.
 * `id` stays in English kebab-case — it is the binding key to `properties.id`
 * in the GeoJSON; only the display `name` is localized (Arabic).
 * Populations are 2014 census figures (INS); infrastructure levels are
 * gameplay starting values on the 0–10 scale defined in `Region`.
 * `isCoastal` marks the 13 governorates with a Mediterranean coastline.
 */
const REGION_LIST: readonly Region[] = [
  { id: "tunis", name: "تونس", population: 1_056_247, infrastructureLevel: 8, isCoastal: true },
  { id: "ariana", name: "أريانة", population: 576_088, infrastructureLevel: 7, isCoastal: true },
  { id: "ben-arous", name: "بن عروس", population: 631_842, infrastructureLevel: 7, isCoastal: true },
  { id: "manouba", name: "منوبة", population: 379_518, infrastructureLevel: 6, isCoastal: false },
  { id: "nabeul", name: "نابل", population: 787_920, infrastructureLevel: 6, isCoastal: true },
  { id: "zaghouan", name: "زغوان", population: 176_945, infrastructureLevel: 4, isCoastal: false },
  { id: "bizerte", name: "بنزرت", population: 568_219, infrastructureLevel: 5, isCoastal: true },
  { id: "beja", name: "باجة", population: 303_032, infrastructureLevel: 4, isCoastal: true },
  { id: "jendouba", name: "جندوبة", population: 401_477, infrastructureLevel: 3, isCoastal: true },
  { id: "el-kef", name: "الكاف", population: 243_156, infrastructureLevel: 3, isCoastal: false },
  { id: "siliana", name: "سليانة", population: 223_087, infrastructureLevel: 3, isCoastal: false },
  { id: "sousse", name: "سوسة", population: 674_971, infrastructureLevel: 7, isCoastal: true },
  { id: "monastir", name: "المنستير", population: 548_828, infrastructureLevel: 7, isCoastal: true },
  { id: "mahdia", name: "المهدية", population: 410_812, infrastructureLevel: 5, isCoastal: true },
  { id: "sfax", name: "صفاقس", population: 955_421, infrastructureLevel: 7, isCoastal: true },
  { id: "kairouan", name: "القيروان", population: 570_559, infrastructureLevel: 4, isCoastal: false },
  { id: "kasserine", name: "القصرين", population: 439_243, infrastructureLevel: 2, isCoastal: false },
  { id: "sidi-bouzid", name: "سيدي بوزيد", population: 429_912, infrastructureLevel: 2, isCoastal: false },
  { id: "gabes", name: "قابس", population: 374_300, infrastructureLevel: 5, isCoastal: true },
  { id: "medenine", name: "مدنين", population: 479_520, infrastructureLevel: 5, isCoastal: true },
  { id: "tataouine", name: "تطاوين", population: 149_453, infrastructureLevel: 3, isCoastal: false },
  { id: "gafsa", name: "قفصة", population: 337_331, infrastructureLevel: 4, isCoastal: false },
  { id: "tozeur", name: "توزر", population: 107_912, infrastructureLevel: 4, isCoastal: false },
  { id: "kebili", name: "قبلي", population: 156_961, infrastructureLevel: 3, isCoastal: false },
];

export const INITIAL_REGIONS: Record<RegionId, Region> = Object.fromEntries(
  REGION_LIST.map((region) => [region.id, region]),
) as Record<RegionId, Region>;
