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
 * Under the hood
 * ──────────────
 * Activating the key:
 *   1. Encrypts { isIntimacyUnlocked: true, activatedAt: ISO-timestamp }
 *      with the wife's private passphrase (AES-GCM via SubtleCrypto).
 *   2. Upserts the encrypted blob to sakan_sessions.lock_ciphertext / iv / salt.
 *   3. The husband's client never reads this column.
 *
 * The `wifeLockPassphrase` prop MUST be the wife's individual session
 * passphrase (NOT the shared couple passphrase used for blind intersection).
 * It should come from sessionStorage via getCachedPassphrase().
 */

import { useState, useCallback } from "react";
import { encrypt } from "@/lib/sakan/crypto";
import { upsertSession } from "@/lib/sakan/supabase";
import type { WifeLockState } from "@/types/sakan";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** UUID of the couple's Supabase session row. */
  coupleId: string;
  /** Wife's individual session passphrase — never the shared couple passphrase. */
  wifeLockPassphrase: string;
  /** Controlled initial state (e.g. fetched from Supabase on mount). */
  initiallyUnlocked?: boolean;
  /** Called after the state is successfully written to the backend. */
  onActivated?: () => void;
  /** Additional Tailwind classes for position/margin in the parent layout. */
  className?: string;
}

// ─── The botanical SVG motif ──────────────────────────────────────────────────
//
// Three elliptical petals arranged 120° apart around a shared centre.
// The SVG is 36 × 36 px; scale with width/height props or CSS.

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
  coupleId,
  wifeLockPassphrase,
  initiallyUnlocked = false,
  onActivated,
  className = "",
}: Props) {
  const [unlocked, setUnlocked] = useState(initiallyUnlocked);
  // isSaving: prevents double-tap while the async write is in flight.
  // Crucially, we do NOT show a visible loading indicator — the element
  // simply absorbs the tap and the colour will change when the write resolves.
  const [isSaving, setIsSaving] = useState(false);

  // The petal colour, interpolated via CSS transition (not JS animation).
  const petalColor = unlocked ? "#a3b18a" : "#d6d3d1";

  const handleActivate = useCallback(async () => {
    // Only activate — the key is one-way. Once the wife activates it, she can
    // choose to "rest" it (set unlocked=false) but this requires an explicit
    // secondary UX that is out of Phase 2 scope.
    if (unlocked || isSaving || !coupleId || !wifeLockPassphrase) return;

    setIsSaving(true);

    try {
      // Optimistic UI: show the colour change immediately.
      setUnlocked(true);

      const lockState: WifeLockState = {
        isIntimacyUnlocked: true,
        activatedAt: new Date().toISOString(),
      };

      const payload = await encrypt(lockState, wifeLockPassphrase);

      const { error } = await upsertSession(coupleId, {
        lock_ciphertext: payload.ciphertext,
        lock_iv: payload.iv,
        lock_salt: payload.salt,
      });

      if (error) {
        // Silently roll back the optimistic update — the element returns to
        // its resting colour without any user-visible error message (avoiding
        // anxiety). The wife can try again by touching it again.
        setUnlocked(false);
      } else {
        onActivated?.();
      }
    } catch {
      setUnlocked(false);
    } finally {
      setIsSaving(false);
    }
  }, [coupleId, isSaving, onActivated, unlocked, wifeLockPassphrase]);

  return (
    /*
     * The outer element has role="button" with a vague but real accessibility
     * label. The label "لمسة هدوء" ("touch of calm") is intentionally
     * non-descriptive to an observer, while still giving the wife a meaningful
     * affordance via screen-reader.
     *
     * tabIndex="0" + onKeyDown allows keyboard activation.
     */
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
        // Subtle hover hint — slightly more visible, still not "button-like"
        unlocked
          ? "hover:opacity-80"
          : "hover:opacity-70",
        isSaving ? "pointer-events-none" : "",
        className,
      ].join(" ")}
      style={{
        // No visible focus ring colour that would betray the element's purpose
        // to a viewer behind the wife's shoulder.
        outlineColor: "transparent",
      }}
    >
      <BotanicalMotif color={petalColor} glowing={unlocked} />
    </div>
  );
}
