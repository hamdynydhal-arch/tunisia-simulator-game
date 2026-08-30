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
