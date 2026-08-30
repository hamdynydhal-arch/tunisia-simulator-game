/**
 * Sakan (سَكَن) — Supabase client singleton
 *
 * Lazily initialised so the module can be imported during static-export
 * build without throwing when the env vars are absent.  The client is only
 * constructed the first time `getSupabaseClient()` is actually called —
 * always inside a Client Component, never during server-side generation.
 *
 * Required environment variables (set in .env.local for development,
 * Vercel Project Settings for production):
 *
 *   NEXT_PUBLIC_SUPABASE_URL  — e.g. https://xxxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — the public anon key
 *
 * Row-Level Security (RLS) in Supabase ensures each couple can only access
 * their own session row.  The anon key alone cannot bypass RLS policies.
 *
 * Note on DB generics: we use the untyped `SupabaseClient` here and apply
 * explicit TypeScript casts at the call site. The Supabase Database generic
 * requires a very specific shape that conflicts with the partial Insert/Update
 * types we need; explicit casts give us the same safety without fighting the
 * inference engine.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SakanSessionRow } from "@/types/sakan";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>;

let _client: AnyClient | null = null;

/**
 * Returns the shared Supabase client.
 * Throws a descriptive error if the environment variables are not configured,
 * so developers get an actionable message rather than a cryptic network failure.
 */
export function getSupabaseClient(): AnyClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "[Sakan] Supabase is not configured.\n" +
        "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "to your .env.local file."
    );
  }

  _client = createClient(url, key, {
    auth: {
      // Sakan uses couple-level auth via RLS, not individual user accounts.
      // Disable auto-refresh token to reduce background network activity.
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        // Identify Sakan requests in Supabase logs.
        "x-application-name": "sakan",
      },
    },
  });

  return _client;
}

// ─── Session helpers ──────────────────────────────────────────────────────────

/** Fields that can be patched on an existing session row. */
type SessionPatch = Partial<
  Omit<SakanSessionRow, "id" | "couple_id" | "created_at" | "updated_at">
>;

/**
 * Upserts a partial session row for the given couple.
 * Only the provided fields are written; existing fields are left untouched
 * (Supabase upsert with onConflict: "couple_id" only updates supplied columns).
 */
export async function upsertSession(
  coupleId: string,
  patch: SessionPatch
): Promise<{ error: string | null }> {
  const db = getSupabaseClient();

  const { error } = await db
    .from("sakan_sessions")
    .upsert({ couple_id: coupleId, ...patch }, { onConflict: "couple_id" });

  if (error) {
    console.error("[Sakan] upsertSession error:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

/**
 * Fetches the session row for the given couple_id.
 * Returns null if no row exists yet or if a network error occurs.
 */
export async function fetchSession(
  coupleId: string
): Promise<SakanSessionRow | null> {
  const db = getSupabaseClient();

  const { data, error } = await db
    .from("sakan_sessions")
    .select("*")
    .eq("couple_id", coupleId)
    .maybeSingle();

  if (error) {
    console.error("[Sakan] fetchSession error:", error.message);
    return null;
  }

  return data as SakanSessionRow | null;
}
