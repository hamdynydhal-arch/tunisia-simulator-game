/**
 * قابلية البلوغ — كل صفحة مبنيّة يجب أن تُبلَغ من داخل التطبيق
 *
 * ─── لماذا وُجد هذا الاختبار ────────────────────────────────────────────────
 * بُنيت صفحات wife-daily و husband-daily و shared و settings ونُشرت كلها،
 * ثم تبيّن أن أياً منها لا يمكن بلوغه: بعد إتمام أسبوع صفر كانت الرحلة تقف
 * عند شاشة شكر بلا رابط ولا انتقال. البناء كان أخضر، والصفحات موجودة في
 * الناتج المنشور، ومع ذلك كان التطبيق مسدوداً.
 *
 * لا اختبار من العشرة يلتقط هذا: كلها تفحص محتوى الشاشات وصمتها، ولا واحد
 * منها يسأل "هل يصل المستخدم إلى هذه الشاشة أصلاً؟".
 *
 * ─── المنهج: رسم بياني من المصدر ─────────────────────────────────────────────
 * ١. تُكتشف الصفحات من نظام الملفات (كل src/app/sakan/**‎/page.tsx) — لا قائمة
 *    مكتوبة يدوياً، فأي صفحة جديدة تدخل الفحص تلقائياً.
 * ٢. تُستخرج الروابط الصادرة من كل صفحة، ولا تُحتسب حافةً إلا إن وردت في
 *    سياق تنقّل فعلي: href، أو router.push/replace، أو تمرير dailyPath.
 *    مجرّد ذكر عنوان في تعليق لا يصنع حافة.
 *    وتُتبع المكوّنات التي تستوردها الصفحة (SakanNav مثلاً) لأن الروابط
 *    تعيش فيها لا في الصفحة — **عدا** وحدة session.ts نفسها: هي سجلّ
 *    الثوابت، ولو تُبعت لتبرّعت بكل المسارات فصار الرسم كاملاً بالمصادفة
 *    ومرّ الاختبار مهما كان التطبيق مسدوداً.
 * ٣. عبور من نقطة الدخول /sakan، ثم يُتحقّق أن كل صفحة مُكتشَفة بُلغت.
 *
 * ─── ما يُفشل الاختبار ───────────────────────────────────────────────────────
 *   - إضافة صفحة بلا أي رابط يؤدّي إليها (شاشة معزولة).
 *   - حذف رابط التنقّل من شاشة، فتنقطع فرعٌ من الرسم.
 *   - عودة شاشة الشكر إلى كونها نهاية الرحلة بلا انتقال.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { SAKAN_ROUTES } from "@/lib/sakan/session";

const ROOT     = resolve(__dirname, "../../../..");
const SAKAN_APP = resolve(ROOT, "src/app/sakan");

// ─── اكتشاف الصفحات من نظام الملفات ──────────────────────────────────────────

/** يُعيد خريطة: المسار المُوجَّه ← ملف الصفحة. */
function discoverRoutes(dir: string, base = "/sakan"): Map<string, string> {
  const out = new Map<string, string>();

  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      for (const [r, f] of discoverRoutes(full, `${base}/${entry}`)) out.set(r, f);
    } else if (entry === "page.tsx") {
      out.set(base, full);
    }
  }
  return out;
}

// ─── استخراج الروابط الصادرة ─────────────────────────────────────────────────

/** يحلّ استيرادات "@/..." إلى مسار ملف حقيقي. */
function resolveImport(spec: string, fromFile: string): string | null {
  let p: string;
  if (spec.startsWith("@/"))      p = resolve(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) p = resolve(dirname(fromFile), spec);
  else return null;

  for (const cand of [`${p}.tsx`, `${p}.ts`, `${p}/index.tsx`, p]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

/** سطر يحمل تنقّلاً فعلياً — لا مجرّد ذكر لعنوان. */
const NAV_CONTEXT = /href|router\.(push|replace)|dailyPath/;

/** سجلّ المسارات — يُستثنى من التتبّع لئلا يتبرّع بكل العناوين. */
const ROUTE_REGISTRY = resolve(ROOT, "src/lib/sakan/session.ts");

/** كل المسارات التي يمكن لهذا الملف (وما يستورده محلياً) أن ينقل إليها. */
function outgoingRoutes(file: string, seen = new Set<string>()): Set<string> {
  const found = new Set<string>();
  if (seen.has(file) || file === ROUTE_REGISTRY) return found;
  seen.add(file);

  const src = readFileSync(file, "utf-8");

  for (const line of src.split("\n")) {
    if (!NAV_CONTEXT.test(line)) continue;

    // ١. عنوان صريح في سياق تنقّل
    for (const m of line.matchAll(/["'`](\/sakan(?:\/[a-z0-9-]+)*)["'`]/g)) {
      found.add(m[1]);
    }
    // ٢. عبر ثوابت المسارات
    for (const m of line.matchAll(/SAKAN_ROUTES\.([A-Za-z]+)/g)) {
      const v = (SAKAN_ROUTES as Record<string, string>)[m[1]];
      if (v) found.add(v);
    }
  }

  // ٣. dailyPathFor(role) — تُستدعى للتنقّل، وتُغطّي المسارين لأن الدور
  //    يُحسم وقت التشغيل من التخزين المحلي
  if (/dailyPathFor\s*\(/.test(src)) {
    found.add(SAKAN_ROUTES.wifeDaily);
    found.add(SAKAN_ROUTES.husbandDaily);
  }

  // ٤. تتبّع المكوّنات المستوردة — الروابط قد تعيش فيها لا في الصفحة
  for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
    const target = resolveImport(m[1], file);
    if (target && target.startsWith(resolve(ROOT, "src"))) {
      for (const r of outgoingRoutes(target, seen)) found.add(r);
    }
  }

  return found;
}

// ─── العبور ──────────────────────────────────────────────────────────────────

const ROUTES = discoverRoutes(SAKAN_APP);
const ENTRY  = SAKAN_ROUTES.home;

function reachableFrom(entry: string): Set<string> {
  const visited = new Set<string>();
  const queue   = [entry];

  while (queue.length > 0) {
    const route = queue.shift()!;
    if (visited.has(route)) continue;
    visited.add(route);

    const file = ROUTES.get(route);
    if (!file) continue;

    for (const next of outgoingRoutes(file)) {
      if (ROUTES.has(next) && !visited.has(next)) queue.push(next);
    }
  }
  return visited;
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("reachability — every built page is reachable from inside the app", () => {
  it("guard: pages are discovered from the filesystem, and the entry point exists", () => {
    // لولا هذا الحارس لكان رسماً فارغاً يمرّ بالمصادفة
    expect(ROUTES.size).toBeGreaterThanOrEqual(5);
    expect(ROUTES.has(ENTRY), `entry point ${ENTRY} has no page.tsx`).toBe(true);
  });

  it("guard: the five known screens are all present on disk", () => {
    for (const route of Object.values(SAKAN_ROUTES)) {
      expect(ROUTES.has(route), `${route} is declared in SAKAN_ROUTES but has no page`).toBe(true);
    }
  });

  it("every discovered page is reachable from the entry point", () => {
    const reachable = reachableFrom(ENTRY);
    const orphans   = [...ROUTES.keys()].filter((r) => !reachable.has(r));

    expect(
      orphans,
      `these pages are built and deployed but cannot be reached from ${ENTRY}: ` +
        `${orphans.join(", ")} — an isolated screen is a screen no user will ever see`
    ).toEqual([]);
  });

  it("the entry point leads to a daily path (week zero is not a dead end)", () => {
    const fromEntry = outgoingRoutes(ROUTES.get(ENTRY)!);

    expect(
      fromEntry.has(SAKAN_ROUTES.wifeDaily) && fromEntry.has(SAKAN_ROUTES.husbandDaily),
      `${ENTRY} does not navigate to both daily paths — completing week zero would dead-end`
    ).toBe(true);
  });

  it("each daily path reaches settings and the shared space", () => {
    for (const daily of [SAKAN_ROUTES.wifeDaily, SAKAN_ROUTES.husbandDaily]) {
      const out = outgoingRoutes(ROUTES.get(daily)!);

      expect(out.has(SAKAN_ROUTES.settings),
        `${daily} has no entry to settings`).toBe(true);
      expect(out.has(SAKAN_ROUTES.shared),
        `${daily} has no entry to the shared space`).toBe(true);
    }
  });

  it("settings leads back to a daily path", () => {
    const out = outgoingRoutes(ROUTES.get(SAKAN_ROUTES.settings)!);

    expect(
      out.has(SAKAN_ROUTES.wifeDaily) || out.has(SAKAN_ROUTES.husbandDaily),
      "settings is a one-way door — no way back to the daily path"
    ).toBe(true);
  });
});
