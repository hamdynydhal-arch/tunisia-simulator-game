/**
 * اختبار القبول رقم ٩ — SPEC.md §8
 *
 * "جهاز الزوج لا يحتوي حقل `KeyState` في أي مخزَن"
 *
 * يتحقق هذا الاختبار من أن:
 * 1. مخطط قاعدة البيانات الخاصة بالزوج (HUSBAND_STORE_KEYS) لا يشمل حقل `KeyState`.
 * 2. القاموس WIFE_ONLY_KEYS يشمل حقل `KeyState` (ليُؤكَّد أنه حقل موجود فعلاً، لكن حصري للزوجة).
 * 3. لا يوجد حقل باسم `KeyState` (أو أي تسمية مشابهة) ضمن أيٍّ من مخازن الزوج.
 *
 * SPEC Rule 2: "جهاز الزوج لا يملك هذا الحقل إطلاقاً"
 * SPEC §3.3: KeyState يُخزَّن على جهاز الزوجة فقط.
 */

import { describe, it, expect } from "vitest";
import {
  HUSBAND_STORE_KEYS,
  WIFE_STORE_KEYS,
  WIFE_ONLY_KEYS,
} from "@/lib/sakan/idb";

describe("Acceptance test #9 — husband device KeyState isolation", () => {
  /**
   * الاختبار الأساسي: مخطط مخزن الزوج يجب أن يخلو تماماً من حقل KeyState.
   * هذا ضمان بنيوي: الحقل غير موجود في تعريف المخزن، بصرف النظر عن السياسة.
   */
  it("HUSBAND_STORE_KEYS does not contain KeyState", () => {
    const forbidden = ["KeyState", "keyState", "key_state", "lockState", "lock_state"];
    for (const name of forbidden) {
      expect(
        Object.keys(HUSBAND_STORE_KEYS).includes(name),
        `Husband store must not define key "${name}" — SPEC §3.3 and Rule 2`
      ).toBe(false);
    }
  });

  /**
   * التحقق التقابلي: الزوجة تمتلك الحقل (ليُؤكَّد أن الحقل موجود بالتصميم لا مجرد منسي).
   */
  it("WIFE_STORE_KEYS contains KeyState (confirming it exists for the wife)", () => {
    expect(
      Object.keys(WIFE_STORE_KEYS).includes("KeyState"),
      "Wife store must define KeyState — SPEC §3.3"
    ).toBe(true);
  });

  /**
   * التحقق من أن WIFE_ONLY_KEYS تحدد KeyState كحقل حصري للزوجة.
   * هذه الثابتة تُستخدم لإثبات الفصل عند كل عملية كتابة.
   */
  it("WIFE_ONLY_KEYS marks KeyState as wife-exclusive", () => {
    expect(
      WIFE_ONLY_KEYS.includes("KeyState"),
      "WIFE_ONLY_KEYS must include 'KeyState' — guards all write paths"
    ).toBe(true);
  });

  /**
   * تحقق شامل: لا يوجد تقاطع بين مفاتيح مخزن الزوجة الحصرية ومفاتيح مخزن الزوج.
   */
  it("HUSBAND_STORE_KEYS has no overlap with WIFE_ONLY_KEYS", () => {
    const husbandKeys = new Set(Object.keys(HUSBAND_STORE_KEYS));
    const overlap = WIFE_ONLY_KEYS.filter((k) => husbandKeys.has(k));
    expect(
      overlap,
      `Husband store must not contain any wife-only keys: ${overlap.join(", ")}`
    ).toHaveLength(0);
  });
});
