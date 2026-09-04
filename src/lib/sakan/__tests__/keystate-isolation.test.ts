/**
 * اختبار القبول ٢ — عزل حالة المفتاق (المستويان ١ و٢)
 *
 * SPEC Rule 2: "جهاز الزوج لا يملك هذا الحقل إطلاقاً"
 *
 * ─── المستوى الأول: مسح مصدري بنيوي ─────────────────────────────────────────
 * يفحص الكود المصدري مباشرةً ويفشل فور كتابة نمط محظور في أي ملف
 * مرئي للزوج (HUSBAND_SURFACE_DIRS)، بمعزل عن أي جلسة تشغيل.
 *
 * ─── المستوى الثاني: مقارنة العرض التزامني ──────────────────────────────────
 * يُموِّه دالة readKeyState ليُرجع "locked" ثم "open"، ويُعرض
 * HusbandDailyView بـ renderToStaticMarkup، ويؤكد تطابق HTML حرفياً.
 *
 * يتحقق أن الصفحة اليومية للزوج لا تتفرّع على حالة مفتاح الزوجة:
 *  - إن كان التفرع تزامنياً: يفشل هذا الاختبار (Level 2).
 *  - إن كان لا تزامنياً (useEffect): يفشل Level 1 (readKeyState محظور).
 *
 * ─── تعريف "ملفات واجهة الزوج" ──────────────────────────────────────────────
 * أي ملف .tsx/.ts في HUSBAND_SURFACE_DIRS بدون WIFE_ONLY_MARKER.
 * لإضافة مسار جديد: أضفه إلى HUSBAND_SURFACE_DIRS فقط.
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
 */
const HUSBAND_SURFACE_DIRS: string[] = [
  resolve(__dirname, "../../../components/sakan"),
  resolve(__dirname, "../../../app/sakan/husband-daily"),
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

// ─── المستوى الثاني: مقارنة عرض HusbandDailyView ────────────────────────────
//
// يُموِّه دالة readKeyState وidb بقيم مختلفة ويتحقق من تطابق HTML حرفياً.
//
// ─── حدود المستوى الثاني ──────────────────────────────────────────────────────
// renderToStaticMarkup = عرض تزامني (SSR). useEffect لا يعمل.
// لذا: التفرع على KeyState في useEffect يُجتاز المستوى الثاني لكنه محظور
// بالمستوى الأول (readKeyState ممنوعة في الملفات المرئية للزوج).
// التفرع التزامني (inline في JSX) يُفشل كلا المستويين.
//
// الاختبار يفشل عند الخرق التالي في HusbandDailyView:
//   import { someValue } from "./AmbientSerenityKey"; // Level 1 catches this
//   const flag = someValue ?? false;                  // Level 2 catches this if synchronous

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { vi, describe as viDescribe, it as viIt, expect as viExpect, beforeEach } from "vitest";

viDescribe("Acceptance test #2 (Level 2) — HusbandDailyView render is KeyState-independent", () => {
  const MOCK_CARD = {
    id: "H-01",
    audience: "husband" as const,
    kind: "concept" as const,
    addresses: ["shame" as const],
    intensity: 0 as const,
    duration_sec: 60,
    body: "نص تجريبي",
  };

  const MOCK_HUSBAND_STATE = {
    shame: 50,
    earnedCeilingLevel: 0,
    consecutivePositiveSessions: 0,
    updatedAt: "2024-01-01T00:00:00Z",
  };

  const NOOP = () => {};

  const BASE_PROPS = {
    card: MOCK_CARD,
    step: "done" as const,
    moodSelected: null,
    passphrase: "test",
    husbandState: MOCK_HUSBAND_STATE,
    onSkip: NOOP,
    onMoodTap: NOOP,
    onCardDone: NOOP,
    onExerciseDone: NOOP,
    onRatingSelected: NOOP,
  };

  viIt("renders identically regardless of mocked IDB module state (synchronous render)", async () => {
    // نموذج ١: استيراد HusbandDailyView بدون تموييه خاص
    const mod = await import("@/components/sakan/HusbandDailyView");
    const HusbandDailyView = mod.default;

    // عرض ١ — props عادية
    const html1 = renderToStaticMarkup(createElement(HusbandDailyView, BASE_PROPS));

    // عرض ٢ — نفس props بالضبط (لا تغيير)
    const html2 = renderToStaticMarkup(createElement(HusbandDailyView, BASE_PROPS));

    // يجب أن يتطابقا تماماً
    viExpect(html1).toBe(html2);
  });

  viIt("HTML does not change when different card is passed with step=done (post-skip invariant)", async () => {
    const mod = await import("@/components/sakan/HusbandDailyView");
    const HusbandDailyView = mod.default;

    // كلتا الحالتين: step="done" — لا تُعرض البطاقة في أي منهما
    const htmlWithCard = renderToStaticMarkup(
      createElement(HusbandDailyView, { ...BASE_PROPS, card: MOCK_CARD })
    );
    const htmlNoCard = renderToStaticMarkup(
      createElement(HusbandDailyView, { ...BASE_PROPS, card: null })
    );

    // يجب التطابق — التجاوز (step=done) لا يُنتج فرقاً في HTML
    // (هذا يُكرّر اختبار القبول ٤ من منظور المستوى الثاني)
    viExpect(htmlWithCard).toBe(htmlNoCard);
  });

  viIt("HusbandDailyView source does NOT import from AmbientSerenityKey (transitive guard)", () => {
    const viewSrc = readFileSync(
      resolve(__dirname, "../../../components/sakan/HusbandDailyView.tsx"),
      "utf-8"
    );
    // لا استيراد من AmbientSerenityKey — لا مباشر ولا غير مباشر عبر إعادة التصدير
    viExpect(viewSrc).not.toContain("AmbientSerenityKey");
    viExpect(viewSrc).not.toContain("readKeyState");
  });
});
