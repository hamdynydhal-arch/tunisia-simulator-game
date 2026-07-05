import type { GameEvent } from "@/types/game";

/** Probability that a random event fires on any given monthly tick. */
export const EVENT_CHANCE = 0.1;

/** World events; one may fire per month and lasts exactly that month. */
export const GAME_EVENTS: readonly GameEvent[] = [
  {
    id: "excellent-tourism-season",
    title: "موسم سياحي ممتاز",
    description:
      "تدفق قياسي للسياح على المدن الساحلية والواحات رفع مداخيل الدولة هذا الشهر.",
    effects: { budgetChange: 150 },
  },
  {
    id: "global-energy-crisis",
    title: "أزمة طاقة عالمية",
    description:
      "ارتفاع حاد في أسعار المحروقات في الأسواق العالمية ضاعف نفقات الدعم.",
    effects: { budgetChange: -100 },
  },
  {
    id: "foreign-direct-investment",
    title: "استثمار أجنبي مباشر",
    description:
      "مجموعة صناعية عالمية اختارت تونس لإقامة مركز إنتاج جديد بتمويل فوري للخزينة.",
    effects: { budgetChange: 200 },
  },
  {
    id: "major-archaeological-discovery",
    title: "اكتشاف أثري مهم",
    description:
      "اكتشاف فسيفساء رومانية نادرة قرب دقة أعاد تونس إلى واجهة الإعلام العالمي وأنعش السياحة الثقافية.",
    effects: { budgetChange: 120 },
  },
  {
    id: "agricultural-surge",
    title: "طفرة في الإنتاج الفلاحي",
    description:
      "موسم أمطار استثنائي ضاعف إنتاج الحبوب والماشية وقلّص فاتورة واردات الغذاء.",
    effects: { budgetChange: 90 },
  },
];
