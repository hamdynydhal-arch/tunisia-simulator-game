/**
 * اختبار القبول ٦ (SPEC §8.6)
 *
 *   "لا طلب شبكة إلى نطاق غير نطاق التطبيق."
 *
 * ─── لماذا وُسِّع هذا الاختبار ───────────────────────────────────────────────
 * النسخة الأولى فحصت توجيه `font-src` وحده. ذلك يمنع خطوط CDN فقط، ويترك
 * `connect-src` و`img-src` و`script-src` و`style-src` بلا فحص — وأي منها
 * يكفي لإخراج طلب شبكة إلى نطاق خارجي. الاختبار الآن يفحص **كل** مصادر
 * السياسة، ويثبّت مجموعة النطاقات الخارجية المسموحة إثباتاً حرفياً.
 *
 * ─── المنهج: نقطة الإنفاذ نفسها، لا نيّة الكود ───────────────────────────────
 * السياسة مُنفَّذة في موضعين يجب أن يتطابقا:
 *   src/app/layout.tsx — وسم <meta> (التصدير الثابت بلا خادم يضع ترويسات)
 *   vercel.json        — ترويسة الحافة (تضيف frame-ancestors)
 * انحرافهما عن بعضهما ثغرة حقيقية، فيُفحص التطابق أولاً.
 *
 * ثم تُستخرج كل النطاقات الخارجية من كل التوجيهات وتُقارن بمجموعة مُراجَعة
 * حرفياً. أي نطاق جديد — في أي توجيه — يُفشل الاختبار.
 *
 * ─── النطاقات الخارجية المُراجَعة ────────────────────────────────────────────
 * ١. *.supabase.co — واجهة Supabase التي يستعملها سَكَن (§7). أقرّها المستخدم
 *    صراحةً: "لا طلب شبكة إلى نطاق غير نطاق التطبيق وSupabase".
 * ٢. *.arcgisonline.com — بلاطات خرائط Leaflet، تخصّ لعبة "محاكي تونس"
 *    المضيفة ولا تُحمَّل في أي مسار /sakan. موجودة قبل سَكَن في المستودع.
 *
 * ─── ما يُفشل الاختبار ───────────────────────────────────────────────────────
 *   - إضافة أي نطاق خارجي إلى أي توجيه (خط، صورة، سكربت، اتصال…).
 *   - انحراف نسخة vercel.json عن نسخة layout.tsx.
 *   - غياب توجيه من التوجيهات المُقفَلة، أو تحوّله إلى `*`.
 *   - أي رابط https خارجي مكتوب داخل مصدر سَكَن.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { SAKAN_CAMOUFLAGE_NAME, CSP_FONT_SRC, REVEALING_WORDS } from "@/lib/sakan/camouflage";

const ROOT = resolve(__dirname, "../../../..");

// ─── النطاقات الخارجية المُراجَعة ────────────────────────────────────────────

const REVIEWED_EXTERNAL_ORIGINS = [
  "https://*.arcgisonline.com",
  "https://*.supabase.co",
  "https://server.arcgisonline.com",
  "wss://*.supabase.co",
] as const;

/** التوجيهات التي يجب أن تبقى بلا أي نطاق خارجي مهما حدث. */
const MUST_BE_PURELY_LOCAL = ["default-src", "base-uri", "script-src", "style-src", "font-src"];

// ─── استخراج السياسة ─────────────────────────────────────────────────────────

/** يستخرج سلسلة CSP من مصدر layout.tsx (مصفوفة تُدمج بـ "; "). */
function cspFromLayout(): string {
  const src = readFileSync(resolve(ROOT, "src/app/layout.tsx"), "utf-8");
  const start = src.indexOf("const CONTENT_SECURITY_POLICY = [");
  const end   = src.indexOf('].join("; ")', start);
  expect(start, "CONTENT_SECURITY_POLICY not found in layout.tsx").toBeGreaterThan(-1);

  const body = src.slice(src.indexOf("[", start) + 1, end);

  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//"))
    // يقبل السلاسل النصية والقوالب `font-src ${CSP_FONT_SRC}`
    .map((l) => l.replace(/^[`"']/, "").replace(/[`"'],?$/, ""))
    .map((l) => l.replace(/\$\{CSP_FONT_SRC\}/, CSP_FONT_SRC))
    .join("; ");
}

function cspFromVercel(): string {
  const json = JSON.parse(readFileSync(resolve(ROOT, "vercel.json"), "utf-8"));
  const headers = json.headers?.flatMap((h: { headers: Array<{ key: string; value: string }> }) => h.headers) ?? [];
  const csp = headers.find((h: { key: string }) => h.key === "Content-Security-Policy");
  expect(csp, "Content-Security-Policy header not found in vercel.json").toBeTruthy();
  return csp.value as string;
}

/** يُفكِّك سلسلة CSP إلى خريطة توجيه ← مصادر. */
function parseCsp(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of csp.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) out[name] = sources;
  }
  return out;
}

/** كل مصدر يشير إلى نطاق خارجي (بروتوكول صريح)، عبر كل التوجيهات. */
function externalOrigins(csp: string): string[] {
  const found = new Set<string>();
  for (const sources of Object.values(parseCsp(csp))) {
    for (const s of sources) {
      if (/^(https?|wss?):\/\//.test(s)) found.add(s);
    }
  }
  return [...found].sort();
}

// ─── مسح مصدر سَكَن بحثاً عن روابط خارجية ────────────────────────────────────

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "__tests__" && entry !== "node_modules") walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AT6 — المستوى الأول: تطابق نسختَي السياسة
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #6 (§8.6 L1) — the two CSP copies do not drift", () => {
  it("layout.tsx and vercel.json declare the same directives and sources", () => {
    const layout = parseCsp(cspFromLayout());
    const vercel = parseCsp(cspFromVercel());

    // vercel.json يضيف frame-ancestors عند الحافة — بقيّة التوجيهات تتطابق
    for (const directive of Object.keys(layout)) {
      expect(
        vercel[directive]?.join(" "),
        `directive "${directive}" differs between layout.tsx and vercel.json`
      ).toBe(layout[directive].join(" "));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AT6 — المستوى الثاني: النطاقات الخارجية مثبَّتة
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #6 (§8.6 L2) — no network request to any unreviewed origin", () => {
  it("guard: the parser actually finds directives (no empty scan)", () => {
    const parsed = parseCsp(cspFromLayout());
    expect(Object.keys(parsed).length).toBeGreaterThan(5);
    expect(parsed["connect-src"], "connect-src missing from the policy").toBeTruthy();
    expect(parsed["font-src"], "font-src missing from the policy").toBeTruthy();
  });

  it("every external origin across ALL directives is in the reviewed set", () => {
    for (const source of [cspFromLayout(), cspFromVercel()]) {
      for (const origin of externalOrigins(source)) {
        expect(
          REVIEWED_EXTERNAL_ORIGINS.includes(origin as never),
          `CSP allows unreviewed external origin "${origin}" — ` +
            `SPEC §8.6 forbids any request outside the app domain`
        ).toBe(true);
      }
    }
  });

  it("the reviewed set has not silently grown", () => {
    // يمنع تمرير نطاق جديد بإضافته إلى القائمة المُراجَعة بلا مراجعة
    expect([...REVIEWED_EXTERNAL_ORIGINS].sort()).toEqual([
      "https://*.arcgisonline.com",
      "https://*.supabase.co",
      "https://server.arcgisonline.com",
      "wss://*.supabase.co",
    ]);
  });

  it("locked-down directives carry no external origin at all", () => {
    const layout = parseCsp(cspFromLayout());

    for (const directive of MUST_BE_PURELY_LOCAL) {
      const sources = layout[directive] ?? [];
      expect(sources.length, `directive "${directive}" is missing entirely`).toBeGreaterThan(0);

      for (const s of sources) {
        expect(
          /^(https?|wss?):\/\//.test(s) || s === "*",
          `directive "${directive}" allows "${s}" — it must stay purely local`
        ).toBe(false);
      }
    }
  });

  it("connect-src reaches nothing beyond self and Supabase", () => {
    const sources = parseCsp(cspFromLayout())["connect-src"] ?? [];
    const external = sources.filter((s) => /^(https?|wss?):\/\//.test(s));

    for (const origin of external) {
      expect(
        /supabase\.co$/.test(origin) || /arcgisonline\.com$/.test(origin),
        `connect-src reaches "${origin}" — only Supabase (and the host game's ` +
          `map tiles) are reviewed for outbound connections`
      ).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AT6 — المستوى الثالث: لا رابط خارجي مكتوب في مصدر سَكَن
// ═══════════════════════════════════════════════════════════════════════════════

describe("Acceptance test #6 (§8.6 L3) — no external URL hardcoded in Sakan source", () => {
  const SAKAN_DIRS = ["src/app/sakan", "src/components/sakan", "src/lib/sakan"];

  it("guard: the scan actually reaches Sakan files", () => {
    const files = SAKAN_DIRS.flatMap((d) => walk(resolve(ROOT, d)));
    expect(files.length, "no Sakan source files scanned").toBeGreaterThan(10);
  });

  it("no Sakan source file hardcodes an external https/wss URL", () => {
    const files = SAKAN_DIRS.flatMap((d) => walk(resolve(ROOT, d)));

    for (const file of files) {
      const src = readFileSync(file, "utf-8");
      const urls = src.match(/(https?|wss):\/\/[^\s"'`)]+/g) ?? [];

      for (const url of urls) {
        // روابط التوثيق داخل التعليقات مسموحة — الممنوع ما يُستدعى وقت التشغيل
        const inComment = src
          .split("\n")
          .find((l) => l.includes(url))
          ?.trim()
          .match(/^(\*|\/\/|\/\*)/);

        if (inComment) continue;

        expect(
          /supabase/.test(url),
          `${file.replace(ROOT + "/", "")} hardcodes external URL "${url}" — ` +
            `SPEC §8.6 forbids requests outside the app domain`
        ).toBe(true);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §8.1 (مساند، ليس من العشرة) — الاسم المحايد
// ═══════════════════════════════════════════════════════════════════════════════

describe("§8.1 (supporting) — the camouflage name carries no revealing word", () => {
  it("SAKAN_CAMOUFLAGE_NAME contains no revealing word", () => {
    const name = SAKAN_CAMOUFLAGE_NAME.toLowerCase();
    for (const word of REVEALING_WORDS) {
      expect(
        name.includes(word.toLowerCase()),
        `SAKAN_CAMOUFLAGE_NAME contains revealing word: "${word}"`
      ).toBe(false);
    }
  });
});
