/**
 * Sakan (سَكَن) — Trauma-informed couples companion
 *
 * Type definitions for the MVP Phase 1 onboarding flow.
 * All fields that will eventually reach Supabase are stored only in their
 * encrypted form (EncryptedPayload).  Raw answer values must never leave the
 * device in plaintext.
 */

// ─── Role ───────────────────────────────────────────────────────────────────

/** The two completely separate interfaces. */
export type SakanRole = "wife" | "husband";

// ─── Questionnaire schema ────────────────────────────────────────────────────

/** A 1–5 Likert-scale item. */
export interface ScaleQuestion {
  id: string;
  type: "scale";
  text: string;
  /** Short label shown under the lowest value (1). */
  minLabel: string;
  /** Short label shown under the highest value (5). */
  maxLabel: string;
  /** Shown below the question text in lighter type. */
  note?: string;
  optional?: boolean;
}

/** A single-choice radio group. */
export interface RadioQuestion {
  id: string;
  type: "radio";
  text: string;
  options: { value: string; label: string }[];
  note?: string;
  optional?: boolean;
}

/** A multi-select checkbox group. */
export interface MultiSelectQuestion {
  id: string;
  type: "multiselect";
  text: string;
  options: { value: string; label: string }[];
  note?: string;
  optional?: boolean;
}

/** A free-text area. */
export interface TextareaQuestion {
  id: string;
  type: "textarea";
  text: string;
  placeholder?: string;
  note?: string;
  optional?: boolean;
}

export type SakanQuestion =
  | ScaleQuestion
  | RadioQuestion
  | MultiSelectQuestion
  | TextareaQuestion;

export interface SakanQuestionnaire {
  role: SakanRole;
  /** Human-readable section title shown at the top of the form. */
  title: string;
  /** Reassuring subtitle. */
  subtitle: string;
  questions: SakanQuestion[];
}

// ─── Answer map ─────────────────────────────────────────────────────────────

/** Raw answer values keyed by question id. */
export type AnswerMap = Record<
  string,
  number | string | string[] | null
>;

// ─── E2EE payload ────────────────────────────────────────────────────────────

/**
 * What is stored in Supabase.
 * The `ciphertext` is the Base64url-encoded result of AES-GCM encryption.
 * The `iv` is the Base64url-encoded Initialization Vector (random per save).
 * The `salt` is the Base64url-encoded PBKDF2 salt used to derive the key.
 *
 * The decryption key is NEVER stored; it is derived on-device from the user's
 * passphrase via PBKDF2.  Only the person who knows the passphrase can decrypt.
 */
export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  salt: string;
}

// ─── App flow state ──────────────────────────────────────────────────────────

/** Which screen is currently visible in the onboarding wizard. */
export type SakanStep =
  | "role-select"   // 0 – choose husband / wife
  | "covenant-intro" // 1 – تمهيد الميثاق القصير
  | "week-zero"      // 2 – أسئلة أسبوع صفر
  | "full-covenant"; // 3 – ميثاق سكن الكامل

export interface SakanFlowState {
  step: SakanStep;
  role: SakanRole | null;
  /** Answers collected during week-zero form (held only in memory until E2EE save). */
  answers: AnswerMap;
  /** True once the user has completed and agreed to the full covenant. */
  covenantAgreed: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
//  PHASE 2 — Blind Intersection, Ambient Key, Co-regulation Timer
// ════════════════════════════════════════════════════════════════════════════

// ─── Preference IDs ─────────────────────────────────────────────────────────

/**
 * An opaque string ID referencing a specific desire, comfort level, or
 * readiness signal from a future preference catalogue.
 * The ID itself carries no PII; its meaning is only known to the catalogue,
 * not to the Supabase row.
 */
export type PreferenceId = string;

/**
 * The in-memory plaintext form of what each partner encrypted in Supabase.
 * These arrays are used ONLY inside the Blind Intersection computation and
 * MUST be wiped from RAM immediately after the intersection is resolved.
 */
export interface PreferenceArray {
  ids: PreferenceId[];
}

// ─── Blind Intersection ──────────────────────────────────────────────────────

export type IntersectionStatus =
  | "idle"        // hook not yet triggered
  | "loading"     // fetching encrypted blobs from Supabase
  | "decrypting"  // SubtleCrypto running
  | "done"        // intersection ready (may be empty)
  | "error";      // passphrase wrong or network failure

export interface BlindIntersectionHookResult {
  /** Only the matched IDs — unmatched data is wiped from state. */
  intersection: PreferenceId[];
  status: IntersectionStatus;
  /** Arabic error message, suitable for display. Null when status !== 'error'. */
  error: string | null;
  /** Re-attempt the fetch+decrypt cycle. */
  retry: () => void;
}

// ─── Wife Lock State ──────────────────────────────────────────────────────────

/**
 * Stored encrypted in Supabase column `lock_ciphertext`.
 * The husband's client never reads this column.
 * The intimacy track is shown only when `isIntimacyUnlocked === true`
 * AND the decryption succeeds with the wife's private passphrase.
 */
export interface WifeLockState {
  isIntimacyUnlocked: boolean;
  /** ISO-8601 timestamp of when the wife activated the serenity key. Null if not yet activated. */
  activatedAt: string | null;
}

// ─── Co-regulation Timer ─────────────────────────────────────────────────────

export type CoRegTimerPhase =
  | "idle"      // not started
  | "running"   // timer counting
  | "complete"; // 15 minutes elapsed

export interface CoRegTimerState {
  phase: CoRegTimerPhase;
  /** Elapsed seconds — drives the SVG ring; NEVER rendered as a number in the UI. */
  elapsedSeconds: number;
  /** Fixed duration in seconds (default: 900 = 15 min). */
  totalSeconds: number;
}

// ─── Supabase row shape ──────────────────────────────────────────────────────

/**
 * TypeScript mirror of the `sakan_sessions` Supabase table.
 * All `*_ciphertext`, `*_iv`, `*_salt` fields hold Base64url-encoded strings.
 * Null means the partner has not yet submitted their payload.
 */
export interface SakanSessionRow {
  id: string;
  couple_id: string;

  // Phase 2 — Week-Zero preference arrays (blind intersection)
  husband_ciphertext: string | null;
  husband_iv: string | null;
  husband_salt: string | null;
  wife_ciphertext: string | null;
  wife_iv: string | null;
  wife_salt: string | null;

  // Phase 2 — Wife-only intimacy lock
  lock_ciphertext: string | null;
  lock_iv: string | null;
  lock_salt: string | null;

  // Phase 3 — Husband's anger predictability plan (husband-only)
  husband_anger_plan_ciphertext: string | null;
  husband_anger_plan_iv: string | null;
  husband_anger_plan_salt: string | null;

  // Phase 3 — Husband's dopamine recovery log (append-only encrypted array)
  husband_dopamine_log_ciphertext: string | null;
  husband_dopamine_log_iv: string | null;
  husband_dopamine_log_salt: string | null;

  // Phase 3 — Forward-focus messages (one per role)
  wife_message_ciphertext: string | null;
  wife_message_iv: string | null;
  wife_message_salt: string | null;
  husband_message_ciphertext: string | null;
  husband_message_iv: string | null;
  husband_message_salt: string | null;

  // Phase 3 — Conditions for blind intersection (each role's remembered contexts)
  wife_conditions_ciphertext: string | null;
  wife_conditions_iv: string | null;
  wife_conditions_salt: string | null;
  husband_conditions_ciphertext: string | null;
  husband_conditions_iv: string | null;
  husband_conditions_salt: string | null;

  created_at: string;
  updated_at: string;
}

// ════════════════════════════════════════════════════════════════════════════
//  PHASE 3 — The Crucible, Communicator, Preferences, Conditions
// ════════════════════════════════════════════════════════════════════════════

// ─── Anger Predictability Plan ───────────────────────────────────────────────

/** IDs matching the three options in AngerPredictabilityPlan. */
export type AngerStrategyId =
  | "leave_room"  // سأغادر الغرفة فوراً بهدوء
  | "silence_15"  // سأطلب 15 دقيقة من الصمت
  | "go_walk";    // سأذهب للمشي قليلاً

export interface AngerPlan {
  /** One or more chosen strategies — the husband commits to at least one. */
  strategies: AngerStrategyId[];
  savedAt: string; // ISO-8601
}

// ─── Dopamine Recovery Log ────────────────────────────────────────────────────

/**
 * A single Small Victory entry.
 *
 * ███ NO CONSECUTIVE-DAY COUNTING ███
 * This record deliberately has NO "streakDay" or "dayNumber" field.
 * Each entry is independent.  Shame on relapse is prevented by design.
 */
export interface DopamineLogEntry {
  /** Locally generated unique ID (timestamp + random suffix). */
  id: string;
  /** One of the three choice IDs from the quick-log options. */
  choiceId: string;
  /** Arabic label copied at save time (survives catalogue changes). */
  choiceLabel: string;
  /** ISO-8601 timestamp of when this victory was logged. */
  loggedAt: string;
}

/** The full encrypted log (array stored as one ciphertext). */
export type DopamineLog = DopamineLogEntry[];

// ─── Forward-Focus Message ───────────────────────────────────────────────────

/**
 * The result of the Mad-Libs template builder.
 * Every field is determined by client-side dropdown selection —
 * no server, no AI, no free text that could become blaming.
 */
export interface ForwardFocusMessage {
  actionId: string;
  actionLabel: string;
  feelingId: string;
  feelingLabel: string;
  /** The assembled Arabic sentence. Client-side string concatenation only. */
  sentence: string;
  composedAt: string; // ISO-8601
}

// ─── Conditions Extractor ─────────────────────────────────────────────────────

/** Allowed values for the time-of-day category. */
export type TimeOfDayId = "morning" | "evening" | "midnight";

/** Allowed values for the lighting category. */
export type LightingId = "natural" | "dim" | "dark";

/** Allowed values for the state-of-mind category. */
export type StateOfMindId =
  | "after_comfortable_discussion"
  | "quiet_holiday"
  | "after_absence";

/** All condition IDs in a flat list, used as the preference array for blind intersection. */
export type ConditionId = TimeOfDayId | LightingId | StateOfMindId;

/** A partner's selected positive-context conditions (stored encrypted per role). */
export interface ConditionSelection {
  timeOfDay: TimeOfDayId[];
  lighting: LightingId[];
  stateOfMind: StateOfMindId[];
  /** Flat union of all selected IDs — what's passed to useBlindIntersection. */
  flatIds: ConditionId[];
  savedAt: string; // ISO-8601
}

// ─── Preferences Catalog item ─────────────────────────────────────────────────

export type SafetyLevel = 1 | 2 | 3; // 1 = gentlest, 3 = more progressed

export interface PreferenceCatalogItem {
  id: string;
  label: string;
  /** Broad category for future UI grouping in Phase 4. */
  category: "safety" | "comfort" | "intimacy";
  /**
   * How graduated the step is.
   * 1 = ambient/environment (no body contact required)
   * 2 = gentle, bounded physical contact
   * 3 = explicit agreements about shared presence
   */
  safetyLevel: SafetyLevel;
}
