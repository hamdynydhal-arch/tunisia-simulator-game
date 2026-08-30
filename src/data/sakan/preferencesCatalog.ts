/**
 * Sakan (سَكَن) — Blind Intersection Preferences Catalog
 *
 * The canonical list of preference/readiness IDs that partners select from.
 * These IDs are what get stored in each partner's encrypted preference array
 * and fed to the useBlindIntersection hook from Phase 2.
 *
 * Clinical design rules:
 * - Items are ordered from most ambient/least contact (safetyLevel 1) to more
 *   graduated presence (safetyLevel 3). Nothing here is explicit or pressure-based.
 * - The labels are phrased as positive capabilities, never as requirements.
 * - safetyLevel 1 = environmental/ambient (no body contact required)
 * - safetyLevel 2 = bounded, consensual touch
 * - safetyLevel 3 = explicit mutual agreements about session conduct
 *
 * Extending this catalogue in Phase 4: add items to the array.
 * NEVER remove or rename existing IDs — encrypted blobs in Supabase still
 * reference them and would silently lose their meaning.
 */

import type { PreferenceCatalogItem } from "@/types/sakan";

export const preferencesCatalog: PreferenceCatalogItem[] = [
  // ── Level 1: Ambient / Environmental ──────────────────────────────────────

  {
    id: "dim_lights",
    label: "إضاءة خافتة جداً أو إطفاء الأنوار بالكامل",
    category: "comfort",
    safetyLevel: 1,
  },
  {
    id: "no_expectations",
    label: "التقارب دون أي توقع للوصول إلى الجماع",
    category: "safety",
    safetyLevel: 1,
  },

  // ── Level 2: Bounded, consensual touch ───────────────────────────────────

  {
    id: "face_hands_only",
    label: "لمس الوجه واليدين فقط",
    category: "comfort",
    safetyLevel: 2,
  },
  {
    id: "silent_aftercare",
    label: "البقاء في صمت تام وعناق بعد اللقاء",
    category: "comfort",
    safetyLevel: 2,
  },

  // ── Level 3: Explicit mutual agreements ──────────────────────────────────

  {
    id: "stop_word_check",
    label: "التأكيد المتبادل على صلاحية إشارة التوقف في أي لحظة",
    category: "safety",
    safetyLevel: 3,
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Returns a catalog item by id, or undefined if not found. */
export function getCatalogItem(
  id: string
): PreferenceCatalogItem | undefined {
  return preferencesCatalog.find((item) => item.id === id);
}

/** Returns only the IDs, for passing to the blind intersection engine. */
export const allPreferenceIds: string[] = preferencesCatalog.map((p) => p.id);

/** Returns items filtered by safety level (≤ maxLevel). */
export function getItemsUpToLevel(
  maxLevel: 1 | 2 | 3
): PreferenceCatalogItem[] {
  return preferencesCatalog.filter((p) => p.safetyLevel <= maxLevel);
}
