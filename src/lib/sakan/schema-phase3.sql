-- ─────────────────────────────────────────────────────────────────────────────
-- Sakan (سَكَن) — Phase 3 Schema Migration
-- Run AFTER schema.sql (Phase 2) has already been applied.
--
-- Adds 18 new nullable columns to sakan_sessions for:
--   • Husband's anger predictability plan  (husband-only read/write)
--   • Husband's dopamine recovery log      (husband-only read/write)
--   • Forward-focus messages               (one per role)
--   • Conditions for blind intersection    (one per role)
--
-- All columns hold Base64url-encoded AES-GCM ciphertext / IV / salt.
-- Null = that partner has not yet submitted this payload.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Husband's Anger Predictability Plan ───────────────────────────────────────
ALTER TABLE sakan_sessions
  ADD COLUMN IF NOT EXISTS husband_anger_plan_ciphertext TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS husband_anger_plan_iv          TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS husband_anger_plan_salt        TEXT DEFAULT NULL;

COMMENT ON COLUMN sakan_sessions.husband_anger_plan_ciphertext
  IS 'AES-GCM ciphertext of AngerPlan JSON. Husband-only — wife client never reads this column.';
COMMENT ON COLUMN sakan_sessions.husband_anger_plan_iv
  IS 'Base64url IV for husband_anger_plan_ciphertext.';
COMMENT ON COLUMN sakan_sessions.husband_anger_plan_salt
  IS 'Base64url PBKDF2 salt for husband_anger_plan_ciphertext.';

-- ── Husband's Dopamine Recovery Log ──────────────────────────────────────────
ALTER TABLE sakan_sessions
  ADD COLUMN IF NOT EXISTS husband_dopamine_log_ciphertext TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS husband_dopamine_log_iv          TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS husband_dopamine_log_salt        TEXT DEFAULT NULL;

COMMENT ON COLUMN sakan_sessions.husband_dopamine_log_ciphertext
  IS 'AES-GCM ciphertext of DopamineLog (DopamineLogEntry[]) JSON. Husband-only. No streak counters by design.';
COMMENT ON COLUMN sakan_sessions.husband_dopamine_log_iv
  IS 'Base64url IV for husband_dopamine_log_ciphertext.';
COMMENT ON COLUMN sakan_sessions.husband_dopamine_log_salt
  IS 'Base64url PBKDF2 salt for husband_dopamine_log_ciphertext.';

-- ── Forward-Focus Messages — one per role ─────────────────────────────────────
ALTER TABLE sakan_sessions
  ADD COLUMN IF NOT EXISTS wife_message_ciphertext     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wife_message_iv             TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wife_message_salt           TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS husband_message_ciphertext  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS husband_message_iv          TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS husband_message_salt        TEXT DEFAULT NULL;

COMMENT ON COLUMN sakan_sessions.wife_message_ciphertext
  IS 'AES-GCM ciphertext of ForwardFocusMessage JSON. Wife-authored, wife-read only.';
COMMENT ON COLUMN sakan_sessions.wife_message_iv
  IS 'Base64url IV for wife_message_ciphertext.';
COMMENT ON COLUMN sakan_sessions.wife_message_salt
  IS 'Base64url PBKDF2 salt for wife_message_ciphertext.';
COMMENT ON COLUMN sakan_sessions.husband_message_ciphertext
  IS 'AES-GCM ciphertext of ForwardFocusMessage JSON. Husband-authored, husband-read only.';
COMMENT ON COLUMN sakan_sessions.husband_message_iv
  IS 'Base64url IV for husband_message_ciphertext.';
COMMENT ON COLUMN sakan_sessions.husband_message_salt
  IS 'Base64url PBKDF2 salt for husband_message_ciphertext.';

-- ── Conditions for Blind Intersection — one per role ─────────────────────────
ALTER TABLE sakan_sessions
  ADD COLUMN IF NOT EXISTS wife_conditions_ciphertext     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wife_conditions_iv             TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wife_conditions_salt           TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS husband_conditions_ciphertext  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS husband_conditions_iv          TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS husband_conditions_salt        TEXT DEFAULT NULL;

COMMENT ON COLUMN sakan_sessions.wife_conditions_ciphertext
  IS 'AES-GCM ciphertext of ConditionSelection JSON. Wife-authored. flatIds fed into blind intersection.';
COMMENT ON COLUMN sakan_sessions.wife_conditions_iv
  IS 'Base64url IV for wife_conditions_ciphertext.';
COMMENT ON COLUMN sakan_sessions.wife_conditions_salt
  IS 'Base64url PBKDF2 salt for wife_conditions_ciphertext.';
COMMENT ON COLUMN sakan_sessions.husband_conditions_ciphertext
  IS 'AES-GCM ciphertext of ConditionSelection JSON. Husband-authored. flatIds fed into blind intersection.';
COMMENT ON COLUMN sakan_sessions.husband_conditions_iv
  IS 'Base64url IV for husband_conditions_ciphertext.';
COMMENT ON COLUMN sakan_sessions.husband_conditions_salt
  IS 'Base64url PBKDF2 salt for husband_conditions_ciphertext.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS notes
-- The existing Phase 2 RLS policies on sakan_sessions (SELECT/INSERT/UPDATE
-- gated on auth.jwt() ->> 'couple_id' = couple_id) automatically cover
-- all new columns — no additional policy statements are required.
-- ─────────────────────────────────────────────────────────────────────────────
