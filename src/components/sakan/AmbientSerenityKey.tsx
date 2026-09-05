"use client";

/**
 * Sakan (سَكَن) — Ambient Serenity Key (مفتاح الزوجة السري الهادئ)
 *
 * ██ WIFE-ONLY COMPONENT ██
 *
 * This component MUST only be rendered inside the wife's interface.
 * It must never appear in the husband's session — not even hidden.
 *
 * Design intent
 * ─────────────
 * The element looks like a decorative botanical motif — three soft petals
 * arranged around a centre point. It does NOT look like a button, a toggle,
 * or an "unlock" affordance. It lives in the UI like an ornamental flourish.
 *
 * Behaviour
 * ─────────
 * • Resting state:  petals are a warm, muted stone (#d6d3d1). Appears inert.
 * • Active state:   a slow 2.4-second CSS transition shifts the colour to a
 *   soft sage green (#a3b18a). The centre brightens very slightly.
 * • NO pop-ups, NO toasts, NO "Unlocked" text, NO confetti, NO sound.
 *   The colour change IS the entire feedback.
 *
 * Under the hood (Phase 4)
 * ────────────────────────
 * Activating the key:
 *   1. Encrypts { isIntimacyUnlocked: true, activatedAt: ISO-timestamp }
 *      with the wife's private passphrase (AES-GCM via SubtleCrypto).
 *   2. Writes the encrypted KeyState to the wife's IndexedDB (key: 'KeyState').
 *      NEVER to Supabase — the husband's device has no access to this value.
 *
 * Structural guarantee (SPEC §3.3, Rule 2, Acceptance test #9):
 *   The husband's IndexedDB store (HUSBAND_STORE_KEYS) does not define 'KeyState'.
 *   writeHusband() is typed to reject 'KeyState' at compile time.
 *   There is no Supabase column for this data post-Phase-4 migration.
 *
 * The `wifeLockPassphrase` prop MUST be the wife's individual session
 * passphrase (NOT the shared couple passphrase used for blind intersection).
 * It should come from sessionStorage via getCachedPassphrase().
 */

import { useState, useCallback } from "react";
import { writeWife, readWife } from "@/lib/sakan/idb";
import type { WifeLockState, KeyState } from "@/types/sakan";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Wife's individual session passphrase — never the shared couple passphrase. */
  wifeLockPassphrase: string;
  /** Controlled initial state (e.g. read from IndexedDB on mount). */
  initiallyUnlocked?: boolean;
  /** Called after the state is successfully written to IndexedDB. */
  onActivated?: () => void;
  /** Additional Tailwind classes for position/margin in the parent layout. */
  className?: string;
}

// ─── The botanical SVG motif ──────────────────────────────────────────────────

interface MotifProps {
  color: string;
  glowing: boolean;
}

function BotanicalMotif({ color, glowing }: MotifProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      width="28"
      height="28"
      aria-hidden="true"
      style={{
        filter: glowing
          ? `drop-shadow(0 0 4px ${color}88)`
          : "none",
        transition: "filter 2.4s ease",
      }}
    >
      {/* Three petals, each an ellipse rotated 120° around (18, 18) */}
      <g transform="translate(18, 18)">
        {[0, 120, 240].map((deg) => (
          <ellipse
            key={deg}
            cx="0"
            cy="-8"
            rx="3.8"
            ry="6.5"
            fill={color}
            style={{ transition: "fill 2.4s ease" }}
            transform={`rotate(${deg})`}
          />
        ))}
        {/* Centre dot — very slightly brighter alpha when active */}
        <circle
          cx="0"
          cy="0"
          r="2.4"
          fill={color}
          style={{
            transition: "fill 2.4s ease, opacity 2.4s ease",
            opacity: glowing ? 0.9 : 0.65,
          }}
        />
      </g>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AmbientSerenityKey({
  wifeLockPassphrase,
  initiallyUnlocked = false,
  onActivated,
  className = "",
}: Props) {
  const [unlocked, setUnlocked] = useState(initiallyUnlocked);
  // isSaving: prevents double-tap while the async write is in flight.
  // No visible loading indicator — the element simply absorbs the tap.
  const [isSaving, setIsSaving] = useState(false);

  const petalColor = unlocked ? "#a3b18a" : "#d6d3d1";

  const handleActivate = useCallback(async () => {
    if (unlocked || isSaving || !wifeLockPassphrase) return;

    setIsSaving(true);

    try {
      // Optimistic UI: show the colour change immediately.
      setUnlocked(true);

      const lockState: WifeLockState = {
        isIntimacyUnlocked: true,
        activatedAt: new Date().toISOString(),
      };

      // Write to wife's IndexedDB only — NEVER to Supabase.
      // SPEC §3.3: KeyState must not exist on husband's device.
      // writeWife enforces WifeStoreKey type — 'KeyState' is valid here.
      await writeWife<WifeLockState>("KeyState", lockState, wifeLockPassphrase);

      onActivated?.();
    } catch {
      // Silently roll back — no visible error message (avoiding anxiety).
      setUnlocked(false);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, onActivated, unlocked, wifeLockPassphrase]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="لمسة هدوء"
      aria-pressed={unlocked}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
      className={[
        "inline-flex items-center justify-center cursor-pointer select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "rounded-full p-1 transition-all duration-300",
        unlocked ? "hover:opacity-80" : "hover:opacity-70",
        isSaving ? "pointer-events-none" : "",
        className,
      ].join(" ")}
      style={{ outlineColor: "transparent" }}
    >
      <BotanicalMotif color={petalColor} glowing={unlocked} />
    </div>
  );
}

// ─── Read helper (for parent components to load initial state) ────────────────

/**
 * يقرأ حالة المفتاح من IndexedDB الزوجة.
 * يُستخدم عند تهيئة الواجهة لتحميل الحالة المخزَّنة.
 *
 * @param passphrase - عبارة مرور الزوجة الشخصية
 * @returns 'open' إن كانت الزوجة قد فعّلت المفتاح، 'locked' بخلاف ذلك
 */
export async function readKeyState(passphrase: string): Promise<KeyState> {
  const lock = await readWife<WifeLockState>("KeyState", passphrase);
  return lock?.isIntimacyUnlocked ? "open" : "locked";
}
