/**
 * اختبار القبول ٣ (SPEC §8.3)
 *
 *   "لا حقل باسم يطابق `/streak|progress|completed_days|score|level/`
 *    في أي نموذج مخزَّن."
 *
 * ويقابله في §1 القاعدة ٤: "لا عدّادات ولا سلاسل ولا نسب إنجاز، في أي واجهة
 * وفي أي نموذج مخزَّن. لا حقل `streak`، ولا `days_completed`، ولا `progress_percent`."
 *
 * ─── لماذا المسح غير حسّاس لحالة الأحرف، وبلا استثناء واحد ───────────────────
 * المواصفة كتبت التعبير بلا راية `i`. لكن تعبيراً حسّاساً لحالة الأحرف يمرّره
 * `streakCount` أو `progressPercent` أو `Level` بحرف كبير. لذلك يُطبَّق هنا
 * غير حسّاس — وهو القراءة الوحيدة التي تجعل الاختبار ذا معنى.
 *
 * ولا توجد قائمة استثناءات إطلاقاً. الحقل الوحيد الذي كان يقع تحت التعبير
 * (`earnedCeilingLevel`) أُعيدت تسميته إلى `earnedCeiling` بدل استثنائه:
 * قاعدة بلا استثناء أمتن من قاعدة بحارس يحرس استثناءها، ومن يقرأ المواصفة
 * لاحقاً لا يعرف سياق الاستثناء — والاستثناء الأول يجعل الثاني أسهل.
 * البيانات القائمة بالاسم القديم تُرحَّل صامتةً في migrateStoredValue.
 *
 * ─── المنهج: مصدر + وقت تشغيل ────────────────────────────────────────────────
 * المستوى ١ — مسح إعلانات الأنواع: تُستخرج أسماء الحقول من كل واجهة تُخزَّن
 *   فعلاً (المذكورة في WIFE_STORE_KEYS و HUSBAND_STORE_KEYS)، وتُفحص.
 *   هذا يلتقط الحقل حتى لو لم يُبنَ منه كائن قط.
 *
 * المستوى ٢ — مشي عميق على كائنات حقيقية: تُبنى نماذج مخزَّنة فعلية ويُمشى
 *   على كل مفاتيحها بما فيها المتداخلة. هذا يلتقط الحقل المُضاف وقت التشغيل
 *   بلا إعلان نوع (Record<string, …> مثلاً).
 *
 * ─── ما يُفشل الاختبار ───────────────────────────────────────────────────────
 *   - إضافة `streak` أو `streakCount` أو `currentStreak` إلى أي نموذج مخزَّن.
 *   - إضافة `progress` أو `progressPercent` أو `completed_days` أو `score`.
 *   - أي حقل يحوي `level` بأي حالة أحرف.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { WIFE_STORE_KEYS, HUSBAND_STORE_KEYS } from "@/lib/sakan/idb";
import type {
  WifeState,
  HusbandState,
  LearningState,
  WifeLockState,
} from "@/types/sakan";

// ─── التعبير المحظور (SPEC §8.3، غير حسّاس لحالة الأحرف) ─────────────────────

const FORBIDDEN_FIELD = /streak|progress|completed_days|score|level/i;

// ─── المستوى ١: مسح إعلانات الأنواع ──────────────────────────────────────────

const TYPES_PATH = resolve(__dirname, "../../../types/sakan.ts");

/**
 * الواجهات التي تُخزَّن فعلاً على القرص.
 * كل واحدة تقابل مفتاحاً في WIFE_STORE_KEYS أو HUSBAND_STORE_KEYS،
 * أو هي نوع متداخل داخل واحدة منها.
 */
const STORED_INTERFACES = [
  "WifeState",       // ← State
  "HusbandState",    // ← State
  "LearningState",   // ← LearningState
  "WifeLockState",   // ← KeyState
  "CardSkipEntry",   // ← متداخل في LearningState
  "FamilyBoost",     // ← متداخل في LearningState
] as const;

/** يستخرج أسماء حقول واجهة واحدة من مصدر TypeScript. */
function extractFields(source: string, interfaceName: string): string[] {
  const start = source.indexOf(`export interface ${interfaceName} {`);
  if (start === -1) return [];

  const bodyStart = source.indexOf("{", start) + 1;
  const bodyEnd   = source.indexOf("\n}", bodyStart);
  const body      = source.slice(bodyStart, bodyEnd);

  // يتجاهل التعليقات ويلتقط `name:` و `name?:` في بداية السطر
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !line.startsWith("*") && !line.startsWith("//") && !line.startsWith("/*"))
    .map((line) => /^([A-Za-z_][A-Za-z0-9_]*)\??\s*:/.exec(line)?.[1])
    .filter((name): name is string => Boolean(name));
}

// ─── المستوى ٢: نماذج مخزَّنة حقيقية ─────────────────────────────────────────

const NOW = "2025-06-15T12:00:00Z";

const SAMPLE_WIFE_STATE: WifeState = {
  safety: 70,
  trust: 60,
  earnedCeiling: 3,
  consecutivePositiveSessions: 2,
  updatedAt: NOW,
};

const SAMPLE_HUSBAND_STATE: HusbandState = {
  shame: 50,
  earnedCeiling: 0,
  consecutivePositiveSessions: 0,
  updatedAt: NOW,
};

const SAMPLE_LEARNING: LearningState = {
  skipsByCard:     { "W-01": { count: 2, deprioritizedUntil: NOW } },
  familyBoosts:    [{ kind: "concept", addresses: ["trust"], expiresAt: NOW }],
  metricsMovedAt:  NOW,
  lastCardShownAt: NOW,
};

const SAMPLE_LOCK: WifeLockState = {
  isIntimacyUnlocked: true,
  activatedAt: NOW,
};

/**
 * يجمع كل مفاتيح كائن بما فيها المتداخلة.
 * مفاتيح Record الديناميكية (معرّفات البطاقات) تُجمع أيضاً — فلو صار أحدها
 * اسم حقل محظور لالتُقط.
 */
function deepKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) deepKeys(item, acc);
    return acc;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      acc.push(k);
      deepKeys(v, acc);
    }
  }
  return acc;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AT3 — المستوى الأول: إعلانات الأنواع
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #3 (§8.3 L1) — no forbidden field name in any stored type", () => {
  const source = readFileSync(TYPES_PATH, "utf-8");

  it("guard: every stored interface is found and yields fields (no empty scan)", () => {
    for (const name of STORED_INTERFACES) {
      const fields = extractFields(source, name);
      expect(fields.length, `interface ${name} yielded no fields — scan is broken`)
        .toBeGreaterThan(0);
    }
  });

  it("guard: the store-key catalogues are non-empty", () => {
    expect(Object.keys(WIFE_STORE_KEYS).length).toBeGreaterThan(0);
    expect(Object.keys(HUSBAND_STORE_KEYS).length).toBeGreaterThan(0);
  });

  it("guard: the pattern really does catch the names §1.4 forbids", () => {
    // لولا هذا لكان تعبيراً لا يمسك شيئاً وتمرّ كل الفحوص بالمصادفة
    for (const bad of [
      "streak", "currentStreak", "streak_count",
      "progress", "progressPercent",
      "completed_days", "score", "level", "earnedLevel", "Level",
    ]) {
      expect(FORBIDDEN_FIELD.test(bad), `pattern failed to catch "${bad}"`).toBe(true);
    }
  });

  for (const interfaceName of STORED_INTERFACES) {
    it(`${interfaceName} declares no field matching the forbidden pattern`, () => {
      const fields = extractFields(source, interfaceName);

      for (const field of fields) {
        expect(
          FORBIDDEN_FIELD.test(field),
          `stored model ${interfaceName} declares forbidden field "${field}" ` +
            `— matches /streak|progress|completed_days|score|level/i (SPEC §8.3)`
        ).toBe(false);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AT3 — المستوى الثاني: كائنات حقيقية
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #3 (§8.3 L2) — no forbidden key in any real stored object", () => {
  const SAMPLES: Array<[string, unknown]> = [
    ["WifeState",     SAMPLE_WIFE_STATE],
    ["HusbandState",  SAMPLE_HUSBAND_STATE],
    ["LearningState", SAMPLE_LEARNING],
    ["WifeLockState", SAMPLE_LOCK],
  ];

  it("guard: deepKeys actually walks nested structures", () => {
    const keys = deepKeys(SAMPLE_LEARNING);
    expect(keys).toContain("skipsByCard");
    expect(keys).toContain("count");        // متداخل داخل CardSkipEntry
    expect(keys).toContain("addresses");    // متداخل داخل FamilyBoost
  });

  for (const [label, sample] of SAMPLES) {
    it(`${label} contains no forbidden key at any depth`, () => {
      for (const key of deepKeys(sample)) {
        expect(
          FORBIDDEN_FIELD.test(key),
          `stored object ${label} carries forbidden key "${key}" ` +
            `— matches /streak|progress|completed_days|score|level/i (SPEC §8.3)`
        ).toBe(false);
      }
    });
  }
});
