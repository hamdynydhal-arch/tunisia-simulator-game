/**
 * Sakan (سَكَن) — Blind Intersection Engine (محرك التقاطع الأعمى)
 *
 * React hook that:
 *   1. Fetches both the husband's and wife's encrypted preference arrays
 *      from Supabase (identified by `coupleId`).
 *   2. Decrypts them entirely in the client's RAM using SubtleCrypto (AES-GCM).
 *   3. Computes the intersection: wifeIds ∩ husbandIds.
 *   4. Immediately wipes the raw decrypted arrays from memory — the full arrays
 *      NEVER enter React state or the render path.
 *   5. Stores only the matched IDs in state.
 *
 * Architectural constraints enforced:
 *   - Neither the wife's nor the husband's full preference list is ever rendered.
 *   - Unmatched IDs are garbage-collected before the first re-render after decryption.
 *   - A wrong passphrase surfaces as a neutral Arabic error string (no technical leak).
 *   - The hook is side-effect-free when `enabled` is false, allowing the parent
 *     to gate it behind passphrase entry without unconditional fetching.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PreferenceId, BlindIntersectionHookResult } from "@/types/sakan";
import { decrypt, wipeArray, assemblePayload } from "@/lib/sakan/crypto";
import { fetchSession } from "@/lib/sakan/supabase";

export interface UseBlindIntersectionOptions {
  /** UUID identifying the couple's shared session row in Supabase. */
  coupleId: string;
  /** The couple's shared passphrase, agreed upon together. */
  couplePassphrase: string;
  /**
   * Set to true to trigger the fetch+decrypt cycle.
   * Defaults to false so the hook is inert until the passphrase is confirmed.
   */
  enabled?: boolean;
}

export function useBlindIntersection({
  coupleId,
  couplePassphrase,
  enabled = false,
}: UseBlindIntersectionOptions): BlindIntersectionHookResult {
  const [intersection, setIntersection] = useState<PreferenceId[]>([]);
  const [status, setStatus] = useState<BlindIntersectionHookResult["status"]>("idle");
  const [error, setError] = useState<string | null>(null);

  // runId lets us cancel in-flight async work when the hook re-runs.
  const runIdRef = useRef(0);

  const run = useCallback(async () => {
    if (!coupleId || !couplePassphrase) return;

    const myRunId = ++runIdRef.current;

    setStatus("loading");
    setError(null);
    setIntersection([]);

    // ── 1. Fetch encrypted blobs from Supabase ───────────────────────────────
    let sessionRow;
    try {
      sessionRow = await fetchSession(coupleId);
    } catch {
      if (runIdRef.current !== myRunId) return;
      setStatus("error");
      setError("تعذّر الاتصال بالخادم. تحقق من الاتصال بالإنترنت وأعد المحاولة.");
      return;
    }

    if (runIdRef.current !== myRunId) return; // stale run — abort

    if (!sessionRow) {
      setStatus("error");
      setError("لم يتم العثور على جلسة مشتركة. تحقق من رمز الزوجين.");
      return;
    }

    const husbandPayload = assemblePayload(
      sessionRow.husband_ciphertext,
      sessionRow.husband_iv,
      sessionRow.husband_salt
    );
    const wifePayload = assemblePayload(
      sessionRow.wife_ciphertext,
      sessionRow.wife_iv,
      sessionRow.wife_salt
    );

    if (!husbandPayload || !wifePayload) {
      setStatus("error");
      setError(
        "لم يكمل أحد الطرفين الاستبيان بعد. انتظرا حتى يكمل كلاكما قبل الاستعراض."
      );
      return;
    }

    // ── 2. Decrypt both arrays ────────────────────────────────────────────────
    setStatus("decrypting");

    let husbandIds: string[] = [];
    let wifeIds: string[] = [];

    try {
      const [hDecrypted, wDecrypted] = await Promise.all([
        decrypt<string[]>(husbandPayload, couplePassphrase),
        decrypt<string[]>(wifePayload, couplePassphrase),
      ]);
      husbandIds = hDecrypted;
      wifeIds = wDecrypted;
    } catch {
      // Wipe whatever was decrypted before surfacing the error
      wipeArray(husbandIds);
      wipeArray(wifeIds);

      if (runIdRef.current !== myRunId) return;
      setStatus("error");
      setError(
        "عبارة المرور غير صحيحة أو البيانات تالفة. تأكد من الكلمة المشتركة وأعد المحاولة."
      );
      return;
    }

    if (runIdRef.current !== myRunId) {
      // Run was superseded — wipe and bail without touching state
      wipeArray(husbandIds);
      wipeArray(wifeIds);
      return;
    }

    // ── 3. Compute intersection IN PLACE — never store full arrays in state ───
    //
    // A Set<string> of husband IDs allows O(n) lookup.
    // We compute the result synchronously before releasing the arrays.
    const husbandSet = new Set(husbandIds);
    const matched: PreferenceId[] = wifeIds.filter((id) => husbandSet.has(id));

    // ── 4. WIPE non-intersecting data immediately ─────────────────────────────
    //
    // `wipeArray` overwrites each entry with null-byte strings and truncates the
    // array to length 0, releasing the string contents to the GC before any
    // re-render. The local variable references are then reassigned to [] so no
    // reachable path keeps the plaintext alive.
    wipeArray(husbandIds);
    wipeArray(wifeIds);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    husbandIds = [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    wifeIds = [];

    // ── 5. Commit only the intersection to state ──────────────────────────────
    setIntersection(matched);
    setStatus("done");
  }, [coupleId, couplePassphrase]);

  // Effect: run when enabled transitions to true
  useEffect(() => {
    if (!enabled) return;
    run();
  }, [enabled, run]);

  // Cleanup: increment runId to cancel any in-flight async work on unmount
  useEffect(() => {
    return () => {
      runIdRef.current++;
    };
  }, []);

  return { intersection, status, error, retry: run };
}
