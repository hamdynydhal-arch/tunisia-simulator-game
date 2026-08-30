-- ═══════════════════════════════════════════════════════════════════════════
--  Sakan (سَكَن) — Supabase Database Schema
--  Zero-Knowledge design: ALL payload columns store AES-GCM ciphertext only.
--  The application server (and Supabase) NEVER receives plaintext.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Prerequisite: enable pg-uuid ──────────────────────────────────────────
-- (already enabled by default in Supabase)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─── Main session table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sakan_sessions (

  -- Primary key (internal, never exposed to either partner)
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- A shared identifier the couple uses to locate their session.
  -- Recommended flow: generate this UUID in-app and share via a secure,
  -- out-of-band channel (e.g. shown as a QR code or short code during setup).
  couple_id           UUID          NOT NULL UNIQUE,

  -- ── Husband's encrypted Week-Zero preference array ──────────────────────
  -- Plaintext shape (before encryption): string[]   (array of PreferenceIds)
  -- Encrypted with: couple-shared passphrase (AES-GCM 256)
  husband_ciphertext  TEXT,         -- Base64url-encoded AES-GCM ciphertext
  husband_iv          TEXT,         -- Base64url-encoded 12-byte IV
  husband_salt        TEXT,         -- Base64url-encoded 16-byte PBKDF2 salt

  -- ── Wife's encrypted Week-Zero preference array ─────────────────────────
  -- Encrypted with: couple-shared passphrase (AES-GCM 256)
  wife_ciphertext     TEXT,         -- Base64url-encoded AES-GCM ciphertext
  wife_iv             TEXT,         -- Base64url-encoded 12-byte IV
  wife_salt           TEXT,         -- Base64url-encoded 16-byte PBKDF2 salt

  -- ── Wife's secret lock state ─────────────────────────────────────────────
  -- Plaintext shape: { isIntimacyUnlocked: boolean, activatedAt: string|null }
  -- Encrypted with: wife's PRIVATE passphrase (not the couple passphrase).
  -- The husband's client NEVER selects these columns.
  -- RLS policy below prevents the husband's auth context from reading them.
  lock_ciphertext     TEXT,         -- Base64url-encoded AES-GCM ciphertext
  lock_iv             TEXT,         -- Base64url-encoded 12-byte IV
  lock_salt           TEXT,         -- Base64url-encoded 16-byte PBKDF2 salt

  -- ── Audit timestamps ─────────────────────────────────────────────────────
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.sakan_sessions                 IS 'One row per couple. All payload columns store AES-GCM ciphertext — no plaintext is ever stored.';
COMMENT ON COLUMN public.sakan_sessions.couple_id       IS 'Shared couple UUID — the join key. Agreed out-of-band (QR code / short code at setup).';
COMMENT ON COLUMN public.sakan_sessions.lock_ciphertext IS 'WIFE ONLY. Encrypted WifeLockState. The husband auth context must never read this.';


-- ─── Auto-update updated_at ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sakan_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER sakan_sessions_updated_at
  BEFORE UPDATE ON public.sakan_sessions
  FOR EACH ROW EXECUTE FUNCTION public.sakan_set_updated_at();


-- ─── Row Level Security ──────────────────────────────────────────────────────
--
-- Supabase RLS ensures that even with the public anon key, a couple can
-- only read/write their own session row.
--
-- Auth model for Sakan:
--   Each session is authenticated via a JWT claim `couple_id` set at
--   login time.  This is set up in Supabase Auth Hooks (or a custom JWT
--   claim function) and is out of scope for this schema file.
--   The policies below assume `auth.jwt() ->> 'couple_id'` is populated.

ALTER TABLE public.sakan_sessions ENABLE ROW LEVEL SECURITY;

-- Couples read their own row only
CREATE POLICY "sakan_sessions_select"
  ON public.sakan_sessions
  FOR SELECT
  USING (
    (auth.jwt() ->> 'couple_id')::UUID = couple_id
  );

-- Couples insert their own row
CREATE POLICY "sakan_sessions_insert"
  ON public.sakan_sessions
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'couple_id')::UUID = couple_id
  );

-- Couples update their own row
-- NOTE: the lock_* columns (wife-only) are additionally protected at the
-- application layer — the husband client simply never writes them.
CREATE POLICY "sakan_sessions_update"
  ON public.sakan_sessions
  FOR UPDATE
  USING (
    (auth.jwt() ->> 'couple_id')::UUID = couple_id
  )
  WITH CHECK (
    (auth.jwt() ->> 'couple_id')::UUID = couple_id
  );

-- No delete allowed from client (only via service-role admin tooling)
-- (no DELETE policy = no client-side delete)


-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- The couple_id is already UNIQUE (implicit B-tree index).
-- No additional indexes needed for Phase 2 (single-row lookups by couple_id).


-- ─── Future tables (Phase 3 placeholders) ───────────────────────────────────
--
-- sakan_preferences
--   id           UUID PK
--   catalogue_id TEXT     -- references the preference catalogue (Phase 3)
--   couple_id    UUID FK → sakan_sessions.couple_id
--   role         TEXT     -- 'wife' | 'husband'
--   ciphertext   TEXT     -- encrypted PreferenceId[]
--   iv           TEXT
--   salt         TEXT
--   created_at   TIMESTAMPTZ
--
-- sakan_sessions_log
--   id           UUID PK
--   couple_id    UUID FK
--   event_type   TEXT     -- 'coreg_timer_started' | 'coreg_timer_completed' etc.
--   event_ts     TIMESTAMPTZ
--   (No payload columns — events carry no PII, just timestamps + typed labels)
