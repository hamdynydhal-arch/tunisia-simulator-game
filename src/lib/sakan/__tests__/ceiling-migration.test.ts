/**
 * ترحيل صامت — earnedCeilingLevel ← earnedCeiling
 *
 * الحقل أُعيدت تسميته لأن كلمة "Level" كانت تُوقعه تحت التعبير المحظور
 * في §8.3، رغم أنه سقف §4.1 العلاجي لا عدّاد إنجاز. استُبعد الاستثناء
 * لصالح تسمية صحيحة: قاعدة بلا استثناء أمتن من قاعدة بحارس.
 *
 * الأجهزة التي كتبت الاسم القديم قبل التغيير يجب أن تُقرأ صحيحة:
 *   - بلا فقدان: القيمة تصل كما هي.
 *   - بلا أثر مرئي: الاسم القديم يختفي، ولا شيء يُضاف يدلّ على الترحيل.
 *   - الجديد يعلو على القديم إن وُجدا معاً.
 */

import { describe, it, expect } from "vitest";
import { migrateStoredValue } from "@/lib/sakan/idb";
import type { WifeState, HusbandState, LearningState } from "@/types/sakan";

const NOW = "2025-06-15T12:00:00Z";

/** الشكل المخزَّن قبل إعادة التسمية — كما كتبته الأجهزة القديمة حرفياً. */
const LEGACY_WIFE_STATE = {
  safety: 70,
  trust: 60,
  earnedCeilingLevel: 4,
  consecutivePositiveSessions: 2,
  updatedAt: NOW,
};

const LEGACY_HUSBAND_STATE = {
  shame: 55,
  earnedCeilingLevel: 3,
  consecutivePositiveSessions: 1,
  updatedAt: NOW,
};

describe("silent migration — legacy earnedCeilingLevel is read correctly", () => {
  it("wife state written under the old name reads back with no loss", () => {
    const migrated = migrateStoredValue<WifeState>(LEGACY_WIFE_STATE as never);

    // القيمة وصلت كما هي تحت الاسم الجديد
    expect(migrated.earnedCeiling).toBe(4);

    // وبقيّة الحقول لم تُمسّ
    expect(migrated.safety).toBe(70);
    expect(migrated.trust).toBe(60);
    expect(migrated.consecutivePositiveSessions).toBe(2);
    expect(migrated.updatedAt).toBe(NOW);
  });

  it("husband state written under the old name reads back with no loss", () => {
    const migrated = migrateStoredValue<HusbandState>(LEGACY_HUSBAND_STATE as never);

    expect(migrated.earnedCeiling).toBe(3);
    expect(migrated.shame).toBe(55);
    expect(migrated.consecutivePositiveSessions).toBe(1);
  });

  it("the old field name is gone — no visible trace of the migration", () => {
    const migrated = migrateStoredValue(LEGACY_WIFE_STATE as never) as Record<string, unknown>;

    expect("earnedCeilingLevel" in migrated).toBe(false);

    // ولا حقل جديد يشي بأن ترحيلاً جرى (نسخة، طابع، راية)
    expect(Object.keys(migrated).sort()).toEqual([
      "consecutivePositiveSessions",
      "earnedCeiling",
      "safety",
      "trust",
      "updatedAt",
    ]);
  });

  it("value 0 migrates correctly — not swallowed as falsy", () => {
    const migrated = migrateStoredValue<HusbandState>(
      { ...LEGACY_HUSBAND_STATE, earnedCeilingLevel: 0 } as never
    );
    expect(migrated.earnedCeiling).toBe(0);
  });

  it("the new name wins when both are present", () => {
    const migrated = migrateStoredValue<WifeState>(
      { ...LEGACY_WIFE_STATE, earnedCeiling: 1 } as never
    );
    expect(migrated.earnedCeiling).toBe(1);
    expect("earnedCeilingLevel" in (migrated as unknown as Record<string, unknown>)).toBe(false);
  });

  it("already-migrated data passes through untouched", () => {
    const fresh: HusbandState = {
      shame: 20,
      earnedCeiling: 2,
      consecutivePositiveSessions: 0,
      updatedAt: NOW,
    };
    expect(migrateStoredValue(fresh)).toEqual(fresh);
  });

  it("values without the field are returned unchanged", () => {
    const learning: LearningState = {
      skipsByCard:     {},
      familyBoosts:    [],
      metricsMovedAt:  NOW,
      lastCardShownAt: null,
    };
    expect(migrateStoredValue(learning)).toEqual(learning);
    expect(migrateStoredValue(null)).toBe(null);
    expect(migrateStoredValue("plain")).toBe("plain");
    expect(migrateStoredValue([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("a migrated object carries no field the §8.3 pattern forbids", () => {
    // الغاية من إعادة التسمية أصلاً — الناتج يجب أن يمرّ اختبار ٣
    const migrated = migrateStoredValue(LEGACY_WIFE_STATE as never) as Record<string, unknown>;
    for (const key of Object.keys(migrated)) {
      expect(
        /streak|progress|completed_days|score|level/i.test(key),
        `migrated object still carries forbidden key "${key}"`
      ).toBe(false);
    }
  });
});
