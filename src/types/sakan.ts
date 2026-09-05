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
  | "role-select" // 0 – choose husband / wife
  | "covenant"    // 1 – ميثاق سَكَن (شاشة واحدة، تُعرض مرة وتُفتح من الإعدادات)
  | "week-zero";  // 2 – أسئلة أسبوع صفر

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

/**
 * السياق الخفي لوضع الطرف الآخر — يُمرَّر إلى SharedSpaceContent ولا يُعرض أبداً.
 * AT12 يضمن أن أي وصول مشروط به ينتج HTML مختلفاً → يفشل الاختبار.
 *
 * الفرق بين الحالتين الذي يختبره AT12:
 *   partnerHasSubmitted = false → الطرف لم يجب إطلاقاً
 *   partnerHasSubmitted = true  → الطرف أجاب ولم يتقاطع مع شيء
 * في الحالتين تكون التقاطعات الفعلية نفسها والHTML يجب أن يتطابق.
 */
export interface PartnerContext {
  /**
   * هل أرسل الطرف الآخر بياناته المشفّرة إلى الخادم؟
   * آلية داخلية — لا يُعرض، لا يُمرَّر إلى أي مكوّن عرض.
   */
  partnerHasSubmitted: boolean;
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
 *
 * Phase 4 reduction: the table now holds ONLY the two encrypted blobs used
 * for the Blind Intersection engine.  All other personal data (lock state,
 * anger plan, observations, forward-focus, conditions) migrated to each
 * partner's own IndexedDB (`src/lib/sakan/idb.ts`).
 *
 * All `*_ciphertext`, `*_iv`, `*_salt` fields hold Base64url-encoded strings.
 * Null means the partner has not yet submitted their preference array.
 */
export interface SakanSessionRow {
  id: string;
  couple_id: string;

  // Blind Intersection only — the only data that must cross devices
  husband_ciphertext: string | null;
  husband_iv: string | null;
  husband_salt: string | null;
  wife_ciphertext: string | null;
  wife_iv: string | null;
  wife_salt: string | null;

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

// ─── Husband Observation Log ─────────────────────────────────────────────────

/**
 * "ماذا لاحظت" — a single free-text observation entry.
 *
 * ███ NO COUNTERS, NO STREAKS, NO VICTORY FRAMING ███
 * Replaces the removed DopamineRecoveryLog / "small victories" component.
 * Each entry is independent; no total count is ever shown in the UI.
 * SPEC Rule 4: لا عدّادات ولا سلاسل ولا نسب إنجاز.
 */
export interface HusbandObservation {
  /** Locally generated unique ID (timestamp + random suffix). */
  id: string;
  /** Free Arabic text — no label constrains what "noting" means. */
  text: string;
  /** ISO-8601 timestamp of when the observation was written. */
  writtenAt: string;
}

/** The full observation log (array stored as one encrypted blob in IndexedDB). */
export type HusbandObservationLog = HusbandObservation[];

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

// ════════════════════════════════════════════════════════════════════════════
//  PHASE 4 — Engine: Card, State, KeyState
// ════════════════════════════════════════════════════════════════════════════

// ─── Key State (مفتاح الزوجة) ────────────────────────────────────────────────

/**
 * حالة المفتاح — مخزَّنة على جهاز الزوجة فقط (IndexedDB, key: 'KeyState').
 *
 * SPEC §3.3: "لا يُزامَن، ولا يُشتق، ولا يُستدل عليه من أي حقل آخر.
 *            جهاز الزوج لا يملك هذا الحقل إطلاقاً."
 *
 * الضمان البنيوي: HusbandStoreKey في idb.ts لا يشمل 'KeyState'.
 * اختبار القبول ٩ يؤكد هذا الضمان.
 */
export type KeyState = "locked" | "open";

// ─── Card (بطاقة المعرفة) ─────────────────────────────────────────────────────

export type CardAudience = "wife" | "husband";

export type CardTradition =
  | "sunni"       // السنّة
  | "shia"        // الشيعة
  | "shared"      // مشترك
  | "clinical"    // سريري / طبي
  | "conceptual"; // مفاهيمي

export type CardKind =
  | "text"          // نص تراثي من مصدر مُراجَع
  | "concept"       // مفهوم معلوماتي
  | "info"          // معلومة صرفة، intensity: 0 دائماً
  | "micro_exercise" // تمرين قصير (≤ 120 ثانية)
  | "reframe";      // إعادة تأطير معرفي

export type CardAddress =
  | "shame"
  | "fear"
  | "pain"
  | "trust"
  | "distance"
  | "anger"
  | "grief"
  | "ignorance";

/** سقف الشدة: 0 = معلومة صرفة، 5 = قرب جسدي. */
export type CardIntensity = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * شروط نطاقات الحالة التي تصلح فيها هذه البطاقة.
 * أي حقل مفقود يعني "بلا قيد".
 */
export interface CardRequires {
  safety?: [number, number];   // [min, max] — للزوجة
  shame?: [number, number];    // [min, max] — للزوج
  trust?: [number, number];    // [min, max] — للزوجة
  distance?: [number, number]; // [min, max] — مشتق
  flags?: string[];            // مثال: 'pain_reported', 'birth_complications'
}

/**
 * بطاقة معرفة — الوحدة الذرية للمحتوى.
 * SPEC §3.1.
 *
 * قاعدة المصدر: كل بطاقة `kind === 'text'` يجب أن يكون `source.reviewed === true`.
 * البناء يفشل إن وُجدت بطاقة نصية بلا هذه العلامة (اختبار القبول ٧).
 */
export type Card = {
  id: string;
  audience: CardAudience;
  kind: CardKind;

  addresses: CardAddress[];

  /**
   * أي بطاقة intensity > 0 لا تُعرض أبداً قبل فتح المفتاح.
   * SPEC §4.1: ceiling = 0 إذا KeyState === 'locked'.
   */
  intensity: CardIntensity;

  requires?: CardRequires;
  /** يُطبَّق قبل requires — أعلى أولوية. */
  forbidden_when?: string[];

  /** ≤ 120 ثانية — الجرعة الواحدة مقصودة. */
  duration_sec: number;
  /** نص عربي جاهز، لا قوالب برمجية. */
  body: string;

  /** إلزامي لكل kind === 'text'. بطاقة نصية بلا reviewed تفشل البناء. */
  source?: {
    name: string;
    tradition: CardTradition;
    grade?: string;
    reviewed: true; // لا نوع آخر — false أو undefined يعني لم تُراجَع
  };

  followups?: string[];  // card ids
  never_after?: string[]; // card ids
};

// ─── State (نموذج الحالة) ────────────────────────────────────────────────────

/**
 * مقياس الحالة — قيمة 0–100.
 *
 * SPEC §3.2:
 * - safety: الزوجة (يُخزَّن على جهازها فقط)
 * - shame:  الزوج (يُخزَّن على جهازه فقط)
 * - trust:  الزوجة (يُخزَّن على جهازها فقط)
 * - distance: مشتق (لا يُعرض لأي طرف — لا يُخزَّن بشكل مستقل)
 */
export type StateValue = number; // 0–100 inclusive

/**
 * حالة الزوجة — مخزَّنة في IndexedDB تحت key: 'State' في مخزن الزوجة.
 */
export interface WifeState {
  safety: StateValue;   // 0–100
  trust: StateValue;    // 0–100

  /**
   * SPEC §4.1 — سقف الشدة المكتسب.
   * يرتفع +1 بعد 3 جلسات قبول متتالية مع تقييم راحة ≥ 3.
   * ينزل −1 فوراً عند أي تجاوز (skip/close) لبطاقة intensity ≥ 1.
   * المجال: 0–5.
   */
  earnedCeiling: number;

  /**
   * عدد الجلسات الإيجابية المتتالية منذ آخر تغيير في earnedCeiling.
   * يُعاد ضبطه إلى 0 عند كل تجاوز أو عند الارتفاع.
   */
  consecutivePositiveSessions: number;

  updatedAt: string;    // ISO-8601
}

/**
 * حالة الزوج — مخزَّنة في IndexedDB تحت key: 'State' في مخزن الزوج.
 */
export interface HusbandState {
  shame: StateValue;    // 0–100

  /**
   * SPEC §4.1 — سقف الشدة المكتسب (نفس آلية الزوجة، بلا keyState).
   * المجال: 0–5.
   */
  earnedCeiling: number;

  /**
   * عدد الجلسات الإيجابية المتتالية منذ آخر تغيير في earnedCeiling.
   */
  consecutivePositiveSessions: number;

  updatedAt: string;    // ISO-8601
}

// ─── Learning State (حلقة التعلّم — SPEC §4.3 + §4.4) ───────────────────────

/**
 * سجل التجاوزات لبطاقة بعينها.
 * count: عدد التجاوزات الإجمالي.
 * deprioritizedUntil: تاريخ انتهاء التهميش (ISO-8601) — غائب قبل التهميش.
 */
export interface CardSkipEntry {
  /** آلية اختيار داخلية فقط — لا يُعرض، لا يُمرَّر إلى أي مكوّن عرض. */
  count: number;
  deprioritizedUntil?: string; // ISO date
}

/**
 * تعزيز أولوية عائلة بطاقات (نفس kind + addresses مشتركة).
 * يُنشَأ عند تقييم راحة ≥3 لبطاقة من هذه العائلة.
 */
export interface FamilyBoost {
  kind: CardKind;
  addresses: CardAddress[]; // يكفي تطابق عنصر واحد في البطاقة المرشَّحة
  expiresAt: string;        // ISO date
}

/**
 * حالة التعلّم — مخزَّنة في IndexedDB تحت key: 'LearningState' لكل طرف.
 * كل الحقول مُدارة عبر دوال نقية في engine.ts — لا تعديل مباشر.
 *
 * metricsMovedAt: آخر مرة تغيّر فيها earnedCeiling — لحساب السكون.
 * lastCardShownAt: آخر مرة عُرضت فيها بطاقة — لإيقاع السكون (3 أيام).
 */
export interface LearningState {
  skipsByCard: Record<string, CardSkipEntry>;
  familyBoosts: FamilyBoost[];
  metricsMovedAt: string;       // ISO date
  lastCardShownAt: string | null; // ISO date | null إن لم تُعرض بطاقة بعد
}

/**
 * إشارة استجابة الجلسة — تُستخدم لتحديث الحالة في حلقة التعلّم.
 * لا تُخزَّن مستقلة — تُدمج في الحالة فور التسجيل.
 */
export type CardResponse =
  | "accepted"    // قُبلت البطاقة وأُكملت
  | "skipped"     // تُجوزت بصمت (بلا رسالة، بلا تسجيل فشل)
  | "closed";     // أُغلق التطبيق أثناء عرضها (= skipped)

/**
 * سجل استجابة جلسة واحدة — يُستخدم في التعلّم.
 * لا يُخزَّن بشكل دائم؛ يُدمَج في الحالة ثم يُتجاهَل.
 */
export interface SessionSignal {
  cardId: string;
  response: CardResponse;
  /** تقييم راحة الطرف بعد البطاقة (اختياري، 1–5). لا يُعرض بشكل مجمَّع. */
  comfortRating?: 1 | 2 | 3 | 4 | 5;
  /** مدة الجلسة بالثواني. */
  durationSec: number;
  recordedAt: string; // ISO-8601
}
