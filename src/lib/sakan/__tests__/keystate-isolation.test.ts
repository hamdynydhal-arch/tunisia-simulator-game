/**
 * اختبار القبول ٢ — المستوى الأول: عزل حالة المفتاح بنيوياً
 *
 * SPEC Rule 2: "جهاز الزوج لا يملك هذا الحقل إطلاقاً"
 *
 * ─── المشكلة التي يمنعها هذا الاختبار ────────────────────────────────────────
 * التسريب المحتمل لا يأتي من المحرّك (engine.ts) — بل من مكوّن واجهة يستدعي
 * readKeyState() أو يقرأ 'KeyState' ثم يُقرّر ما يُعرض للزوج بناءً عليه.
 * هذا الاختبار يفحص الكود المصدري مباشرةً ويفشل فور كتابة السطر الخاطئ،
 * بمعزل عن أي جلسة تشغيل أو حالة IndexedDB.
 *
 * ─── المستوى الثاني (مؤجَّل) ────────────────────────────────────────────────
 * اختبار العرض الفعلي (تهيئة IndexedDB بـ KeyState=locked ثم open، مقارنة
 * شجرة الزوج المُسلسَلة حرفياً) يُنفَّذ بعد بناء صفحة الزوج اليومية
 * في الخطوة ٥.
 *
 * ─── تعريف "ملفات واجهة الزوج" ──────────────────────────────────────────────
 * أي ملف .tsx/.ts في مسارات واجهة الزوج (انظر HUSBAND_SURFACE_DIRS) لا يحمل
 * العلامة WIFE_ONLY_MARKER يُعدّ "مرئياً للزوج". يجب ألا يحتوي على
 * أي نمط من FORBIDDEN_PATTERNS.
 *
 * لإضافة مسار جديد لواجهة الزوج: أضفه إلى HUSBAND_SURFACE_DIRS فقط.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join, extname } from "node:path";

// ─── الثوابت ──────────────────────────────────────────────────────────────────

/**
 * العلامة التي تُستخدم لاستثناء مكوّنات الزوجة الحصرية من الفحص.
 * أي ملف يحمل هذه السلسلة لا يُعرض للزوج ولا يُفحص.
 */
const WIFE_ONLY_MARKER = "██ WIFE-ONLY COMPONENT ██";

/**
 * الأنماط المحظورة في أي ملف مرئي للزوج.
 *
 * readKeyState  — دالة تقرأ حالة المفتاح من IndexedDB الزوجة
 * 'KeyState'    — المفتاح المخزَّن في مخزن الزوجة فقط (WifeStoreKey)
 * WIFE_ONLY_KEYS — مصفوفة تحتوي 'KeyState' ضمن مفاتيح الزوجة الحصرية
 *
 * ملاحظة: يبحث النمط عن كلا شكلَي التنصيص ('...' و"...") لـ KeyState.
 */
const FORBIDDEN_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /readKeyState/,          label: "readKeyState" },
  { regex: /['"]KeyState['"]/,      label: "'KeyState' or \"KeyState\"" },
  { regex: /WIFE_ONLY_KEYS/,        label: "WIFE_ONLY_KEYS" },
];

/**
 * مسارات المجلدات التي تُشكّل واجهة الزوج.
 * وسِّع هذه القائمة عند إضافة صفحات أو مكوّنات جديدة للزوج.
 *
 * المستوى الثاني سيُضيف هنا:
 *   resolve(__dirname, "../../../app/sakan/husband-daily")
 */
const HUSBAND_SURFACE_DIRS: string[] = [
  resolve(__dirname, "../../../components/sakan"),
];

// ─── أدوات مساعدة ─────────────────────────────────────────────────────────────

/** يجمع كل ملفات .tsx/.ts في مجلد (غير متعمّق — يُعدَّل إن أُضيفت مجلدات فرعية). */
function collectSourceFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && (extname(e.name) === ".tsx" || extname(e.name) === ".ts"))
      .map((e) => join(dir, e.name));
  } catch {
    // المجلد غير موجود بعد (مسارات الخطوة ٥ ستُضاف لاحقاً)
    return [];
  }
}

/** يُرجع كل الملفات المرئية للزوج: في مسارات واجهته، بدون علامة WIFE-ONLY. */
function husbandVisibleFiles(): Array<{ path: string; src: string }> {
  return HUSBAND_SURFACE_DIRS
    .flatMap(collectSourceFiles)
    .map((filePath) => ({ path: filePath, src: readFileSync(filePath, "utf-8") }))
    .filter(({ src }) => !src.includes(WIFE_ONLY_MARKER));
}

// ─── الاختبارات ───────────────────────────────────────────────────────────────

describe("Acceptance test #2 (Level 1) — structural keystate isolation", () => {
  const files = husbandVisibleFiles();

  it("finds at least one husband-visible file to scan (guard against empty scan)", () => {
    // إن نجح هذا الاختبار بقائمة فارغة، فالحارس الحقيقي لم يفحص شيئاً
    expect(files.length).toBeGreaterThan(0);
  });

  it("lists all scanned husband-visible files (informational snapshot)", () => {
    // لا assertions هنا — فقط ليكون واضحاً في مخرجات الاختبار ما الذي فُحص
    const names = files.map(({ path }) => path.replace(/.*\/components\/sakan\//, ""));
    expect(names).toEqual(expect.arrayContaining(names)); // always passes — for listing
    // طباعة القائمة في وضع verbose
    if (process.env.VITEST_VERBOSE) {
      console.info("Scanned husband-visible files:", names);
    }
  });

  // ─── النمط المحظور الأول: readKeyState ─────────────────────────────────────

  it("no husband-visible file imports or calls readKeyState", () => {
    const violations = files
      .filter(({ src }) => FORBIDDEN_PATTERNS[0].regex.test(src))
      .map(({ path }) => path);

    expect(violations).toHaveLength(0);
    // رسالة الفشل تذكر الملفات المخالِفة بأسمائها
    if (violations.length > 0) {
      throw new Error(
        `readKeyState found in husband-visible files:\n${violations.join("\n")}\n\n` +
        "Rule 2: the husband's device must never read KeyState. " +
        "Move this logic to a wife-only component or a server boundary."
      );
    }
  });

  // ─── النمط المحظور الثاني: 'KeyState' / "KeyState" ─────────────────────────

  it("no husband-visible file references the string literal 'KeyState' or \"KeyState\"", () => {
    const violations = files
      .filter(({ src }) => FORBIDDEN_PATTERNS[1].regex.test(src))
      .map(({ path }) => path);

    expect(violations).toHaveLength(0);
    if (violations.length > 0) {
      throw new Error(
        `String literal 'KeyState' found in husband-visible files:\n${violations.join("\n")}\n\n` +
        "Rule 2: 'KeyState' is a WifeStoreKey and must never appear in the husband's UI surface."
      );
    }
  });

  // ─── النمط المحظور الثالث: WIFE_ONLY_KEYS ──────────────────────────────────

  it("no husband-visible file references WIFE_ONLY_KEYS", () => {
    const violations = files
      .filter(({ src }) => FORBIDDEN_PATTERNS[2].regex.test(src))
      .map(({ path }) => path);

    expect(violations).toHaveLength(0);
    if (violations.length > 0) {
      throw new Error(
        `WIFE_ONLY_KEYS found in husband-visible files:\n${violations.join("\n")}\n\n` +
        "Rule 2: WIFE_ONLY_KEYS contains 'KeyState' — referencing it in the husband's " +
        "UI surface risks leaking key state awareness into his session."
      );
    }
  });

  // ─── اختبار شامل واحد بجميع الأنماط معاً ───────────────────────────────────

  it("zero violations across all forbidden patterns (combined gate)", () => {
    const allViolations: string[] = [];

    for (const file of files) {
      for (const { regex, label } of FORBIDDEN_PATTERNS) {
        if (regex.test(file.src)) {
          allViolations.push(`  ${label}  →  ${file.path}`);
        }
      }
    }

    expect(allViolations).toHaveLength(0);
  });
});

// ─── اختبار دفاعي: التحقق من أن AmbientSerenityKey محمية بالعلامة ─────────────

describe("WIFE-ONLY marker integrity", () => {
  it("AmbientSerenityKey.tsx carries the WIFE-ONLY marker (so it is excluded from scan)", () => {
    const keyComponentPath = resolve(
      __dirname,
      "../../../components/sakan/AmbientSerenityKey.tsx"
    );
    const src = readFileSync(keyComponentPath, "utf-8");
    expect(src).toContain(WIFE_ONLY_MARKER);
  });

  it("AmbientSerenityKey.tsx contains readKeyState (confirms exclusion matters)", () => {
    const keyComponentPath = resolve(
      __dirname,
      "../../../components/sakan/AmbientSerenityKey.tsx"
    );
    const src = readFileSync(keyComponentPath, "utf-8");
    // هذا الملف يحتوي readKeyState بشكل مقصود — لكنه مستثنى من الفحص
    expect(src).toContain("readKeyState");
  });
});
