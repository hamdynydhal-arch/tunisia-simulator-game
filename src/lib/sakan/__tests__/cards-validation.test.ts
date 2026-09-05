/**
 * اختبار القبول رقم ٧ — SPEC.md §8
 *
 * "كل بطاقة kind: 'text' لها source.reviewed === true؛
 *  وإلا تفشل عملية البناء."
 *
 * يتحقق هذا الاختبار من:
 * 1. validateCards() تمرّر ALL_CARDS بنجاح (لا بطاقة نصية غير مراجَعة).
 * 2. validateCards() ترمي خطأً إن كانت هناك بطاقة نصية بلا source.reviewed.
 * 3. لا بطاقة تتجاوز duration_sec = 120.
 * 4. كل بطاقة لها audience صريح (wife أو husband).
 */

import { describe, it, expect } from "vitest";
import { validateCards, ALL_CARDS } from "@/lib/sakan/cards";
import type { Card } from "@/types/sakan";

describe("Acceptance test #7 — card source validation (build-time gate)", () => {
  it("ALL_CARDS passes validateCards() — no unreviewed text cards", () => {
    expect(() => validateCards(ALL_CARDS)).not.toThrow();
  });

  it("a text card without source.reviewed throws at build time", () => {
    const bad: Card[] = [
      {
        id: "BAD-01",
        audience: "wife",
        kind: "text",
        addresses: ["fear"],
        intensity: 0,
        duration_sec: 60,
        body: "نص تراثي بدون مراجعة",
        // source intentionally absent — should fail validation
      },
    ];
    expect(() => validateCards(bad)).toThrow(/source\.reviewed === true/);
  });

  it("a text card with source but reviewed field missing throws", () => {
    const bad: Card[] = [
      {
        id: "BAD-02",
        audience: "husband",
        kind: "text",
        addresses: ["shame"],
        intensity: 0,
        duration_sec: 60,
        body: "نص تراثي",
        // @ts-expect-error — deliberately testing runtime guard
        source: { name: "مصدر ما", tradition: "sunni", grade: "حسن" },
      },
    ];
    expect(() => validateCards(bad)).toThrow(/source\.reviewed === true/);
  });

  it("no card in ALL_CARDS exceeds duration_sec 120", () => {
    const violations = ALL_CARDS.filter((c) => c.duration_sec > 120);
    expect(violations).toHaveLength(0);
  });

  it("ALL_CARDS contains 15 initial cards", () => {
    expect(ALL_CARDS).toHaveLength(15);
  });

  it("every card has audience 'wife' or 'husband'", () => {
    const invalid = ALL_CARDS.filter((c) => c.audience !== "wife" && c.audience !== "husband");
    expect(invalid).toHaveLength(0);
  });

  it("wife cards and husband cards are both present", () => {
    const wifeCards = ALL_CARDS.filter((c) => c.audience === "wife");
    const husbandCards = ALL_CARDS.filter((c) => c.audience === "husband");
    expect(wifeCards.length).toBeGreaterThan(0);
    expect(husbandCards.length).toBeGreaterThan(0);
  });
});
