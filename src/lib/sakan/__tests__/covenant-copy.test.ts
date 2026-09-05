/**
 * اختبار نصّ الميثاق — SPEC §الخطوة ٤
 *
 * ─── العيب الذي يمنعه هذا الملف ─────────────────────────────────────────────
 * SakanCovenant.tsx المحذوف كان يستقبل `role` ثم يتجاهله:
 *
 *   const pronoun = role === "wife" ? "أنا أوافق…" : "أنا أوافق…";
 *
 * الطرفان يريان النص نفسه حرفياً رغم وجود تفريع ظاهري.
 * هذه الاختبارات تفشل إن تكرّر ذلك.
 *
 * ─── ما يُتحقَّق منه ─────────────────────────────────────────────────────────
 * 1. النسختان مختلفتان نصياً (لا تطابق مُسلسَل).
 * 2. كل حقل يحمل ضميراً مختلف فعلاً بين النسختين.
 * 3. نسخة الزوج خالية من أي إيحاء بقرار بيد الزوجة.
 * 4. لا لغة تقييم ولا كلمات ممنوعة في أي نسخة.
 * 5. كل نسخة تحت ١٨٠ كلمة.
 * 6. الإعلانات الثلاثة حاضرة في كلتا النسختين.
 */

import { describe, it, expect } from "vitest";
import { covenantCopy } from "@/components/sakan/SakanCovenantScreen";
import type { CovenantCopy } from "@/components/sakan/SakanCovenantScreen";

const wife = covenantCopy("wife");
const husband = covenantCopy("husband");

/** يجمع كل نص النسخة في سلسلة واحدة. */
function flatten(copy: CovenantCopy): string {
  return [
    copy.title,
    copy.intro,
    copy.criteriaHeading,
    ...copy.criteria,
    copy.scopeLine,
    copy.rightsHeading,
    ...copy.rights,
    copy.settingsNote,
    copy.dismissLabel,
  ].join(" ");
}

/** عدّ الكلمات العربية (فصل بالمسافات، تجاهل علامات الترقيم المنفردة). */
function wordCount(text: string): number {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[—.،:]/g, ""))
    .filter((w) => w.length > 0).length;
}

// ─── ١. النسختان مختلفتان فعلاً ──────────────────────────────────────────────

describe("covenantCopy — the two versions are genuinely different", () => {
  it("serialized wife copy differs from husband copy", () => {
    // الحارس الأساسي ضد عيب السطر ٦٩ في SakanCovenant.tsx المحذوف
    expect(JSON.stringify(wife)).not.toBe(JSON.stringify(husband));
  });

  it("flattened text differs between the two versions", () => {
    expect(flatten(wife)).not.toBe(flatten(husband));
  });

  // ─── كل حقل يحمل ضميراً يجب أن يختلف ──────────────────────────────────────

  it("criteria[1] (feeling safe) differs — تشعري vs تشعر", () => {
    expect(wife.criteria[1]).not.toBe(husband.criteria[1]);
  });

  it("criteria[2] (wanting to sit again) differs — ترغبي vs ترغب", () => {
    expect(wife.criteria[2]).not.toBe(husband.criteria[2]);
  });

  it("rightsHeading differs — لكِ vs لك", () => {
    expect(wife.rightsHeading).not.toBe(husband.rightsHeading);
  });

  it("all three rights differ between versions", () => {
    for (let i = 0; i < 3; i++) {
      expect(wife.rights[i]).not.toBe(husband.rights[i]);
    }
  });

  it("settingsNote differs — يمكنكِ vs يمكنك", () => {
    expect(wife.settingsNote).not.toBe(husband.settingsNote);
  });

  // ─── الحقول المشتركة عمداً (بلا ضمائر) ────────────────────────────────────

  it("criteria[0] is intentionally identical — it carries no pronoun", () => {
    expect(wife.criteria[0]).toBe(husband.criteria[0]);
    expect(wife.criteria[0]).toBe("أن يمرّ ما بينكما بلا ألم.");
  });

  it("scopeLine is intentionally identical — it carries no pronoun", () => {
    expect(wife.scopeLine).toBe(husband.scopeLine);
  });

  it("dismiss label is 'حسنًا' in both — not 'فهمت' (which implies acknowledgement)", () => {
    expect(wife.dismissLabel).toBe("حسنًا");
    expect(husband.dismissLabel).toBe("حسنًا");
    expect(flatten(wife)).not.toContain("فهمت");
    expect(flatten(husband)).not.toContain("فهمت");
  });
});

// ─── ٢. نسخة الزوج لا توحي بقرار بيد الزوجة ─────────────────────────────────

describe("husband copy implies no decision held by the wife", () => {
  const text = flatten(husband);

  const FORBIDDEN_IN_HUSBAND_COPY = [
    "مفتاح",     // مفتاح الطمأنينة تملكه الزوجة وحدها
    "انتظر",
    "بانتظار",
    "تنتظر",
    "إذن",
    "تسمح",
    "موافقتها",
    "مستعدة",
    "حين تكون",
    "عندما تكون",
    "ترغب هي",
    "قرارها",
  ];

  for (const word of FORBIDDEN_IN_HUSBAND_COPY) {
    it(`husband copy does not contain "${word}"`, () => {
      expect(text).not.toContain(word);
    });
  }

  it("husband copy mentions her device only as a place his data is absent from", () => {
    // "لا في جهازك ولا في جهازها" — طمأنة متناظرة، لا سلطة
    expect(husband.rights[1]).toContain("ولا في جهازها");
    // ولا يذكر أنها ترى أو تقرر شيئاً
    expect(husband.rights[1]).not.toContain("ترى");
  });
});

// ─── ٣. لا لغة تقييم ولا كلمات ممنوعة في أي نسخة ────────────────────────────

describe("both versions avoid evaluative and staged language", () => {
  const FORBIDDEN_EVERYWHERE = [
    "النجاح",
    "نجاح",
    "فشل",
    "تقدّم",
    "تقدم",
    "تأخّر",
    "تأخر",
    "إنجاز",
    "برنامج",
    "مراحل",
    "مرحلة",
    "أسبوع",   // لا جدول زمني
    "يوماً",
    "خلال",    // "خلال شهر" ونحوها
  ];

  for (const role of ["wife", "husband"] as const) {
    const text = flatten(covenantCopy(role));
    for (const word of FORBIDDEN_EVERYWHERE) {
      it(`${role} copy does not contain "${word}"`, () => {
        expect(text).not.toContain(word);
      });
    }
  }
});

// ─── ٤. حدّ الكلمات ─────────────────────────────────────────────────────────

describe("each version stays under 180 words", () => {
  it("wife copy is under 180 words", () => {
    const count = wordCount(flatten(wife));
    expect(count).toBeLessThan(180);
  });

  it("husband copy is under 180 words", () => {
    const count = wordCount(flatten(husband));
    expect(count).toBeLessThan(180);
  });
});

// ─── ٥. الإعلانات الثلاثة حاضرة ─────────────────────────────────────────────

describe("all three required disclosures are present in both versions", () => {
  for (const role of ["wife", "husband"] as const) {
    const copy = covenantCopy(role);

    it(`${role}: disclosure 1 — the partner cannot see what is written`, () => {
      expect(copy.rights[0]).toMatch(/لا يراه أحد سوا/);
      expect(copy.rights[0]).toContain("مشفَّر");
    });

    it(`${role}: disclosure 2 — stopping or skipping is neither recorded nor remarked upon`, () => {
      expect(copy.rights[1]).toContain("لا يُسجَّل");
      expect(copy.rights[1]).toContain("ولا يُعلَّق عليه");
    });

    it(`${role}: disclosure 3 — the right not to answer`, () => {
      expect(copy.rights[2]).toContain("لا سؤال هنا يستوجب جوابًا");
    });

    it(`${role}: encryption claim is not absolute (no "ولا لنا")`, () => {
      // التقاطع الأعمى يمرّ عبر خادم — الإطلاق غير دقيق
      expect(copy.rights[0]).not.toContain("ولا لنا");
    });

    it(`${role}: criteria are declared explicitly (three of them)`, () => {
      expect(copy.criteria).toHaveLength(3);
      expect(copy.criteria.every((c) => c.trim().length > 0)).toBe(true);
    });

    it(`${role}: scope line states these are not the ceiling of the relationship`, () => {
      expect(copy.scopeLine).toContain("لا سقف ما بينكما");
    });
  }
});
