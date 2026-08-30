"use client";

/**
 * Sakan (سَكَن) — Blind Intersection View (عرض التقاطع الأعمى)
 *
 * Shows ONLY the items that both partners selected.
 * Non-matching preferences are never rendered — they don't exist as far as
 * the DOM is concerned.
 *
 * Usage:
 *   <BlindIntersectionView
 *     coupleId="uuid-here"
 *     renderItem={(id) => <MyPreferenceCard preferenceId={id} />}
 *   />
 *
 * The component manages the shared-passphrase entry gate.  The passphrase is
 * held in local state only; it is passed to the hook and cleared when the
 * component unmounts.
 */

import { useState, useCallback, useRef } from "react";
import { useBlindIntersection } from "@/lib/sakan/useBlindIntersection";
import type { PreferenceId } from "@/types/sakan";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** UUID of the couple's Supabase session row. */
  coupleId: string;
  /**
   * Render prop: given a matched PreferenceId, return the node to display.
   * This keeps the view decoupled from Phase 3's preference catalogue.
   */
  renderItem: (id: PreferenceId, index: number) => React.ReactNode;
  /**
   * Shown when the intersection is empty (both submitted, nothing matched).
   * Defaults to a clinically neutral message that doesn't assign blame.
   */
  emptyMessage?: string;
  /** Additional Tailwind classes for the root wrapper. */
  className?: string;
}

// ─── Passphrase gate ──────────────────────────────────────────────────────────

interface PassphraseGateProps {
  onSubmit: (passphrase: string) => void;
}

function PassphraseGate({ onSubmit }: PassphraseGateProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col items-center gap-5 w-full max-w-sm mx-auto"
    >
      <div className="text-center space-y-2">
        <div aria-hidden className="text-3xl">🌿</div>
        <p className="text-sm font-semibold text-stone-700">
          عبارة المرور المشتركة
        </p>
        <p className="text-xs text-stone-500 leading-relaxed">
          هذه الكلمة يعرفها الطرفان معًا. أدخلاها على جهاز واحد لاستعراض ما
          يتشاركانه.
        </p>
      </div>

      <div className="w-full relative">
        <input
          ref={inputRef}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="••••••••••••"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          dir="ltr"
          className="w-full rounded-xl border border-stone-200 bg-white/80 px-4 py-3 text-center text-base tracking-widest text-stone-700 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-500 transition-all"
          aria-label="عبارة المرور المشتركة للزوجين"
        />
      </div>

      <button
        type="submit"
        disabled={!value.trim()}
        className="w-full rounded-xl py-3 px-6 text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
        style={{ background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)" }}
        aria-label="بدء استعراض نقاط التقاطع"
      >
        استعراض نقاط التقاطع
      </button>
    </form>
  );
}

// ─── Status states ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      {/* Calm, non-anxious loader — a slow breathing ring */}
      <div
        className="w-12 h-12 rounded-full border-2 border-stone-200"
        style={{
          borderTopColor: "#6b7f78",
          animation: "spin 2.5s linear infinite",
        }}
        aria-hidden
      />
      <p className="text-sm text-stone-500">…جارٍ الاسترداد والفك</p>
      <p className="text-xs text-stone-400">
        لا شيء يُرسَل خارج جهازك أثناء هذه العملية
      </p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div
        aria-hidden
        className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg"
      >
        🕊️
      </div>
      <p className="text-sm text-stone-600 leading-relaxed max-w-xs">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs text-teal-700 underline underline-offset-2 hover:no-underline transition-all"
        aria-label="إعادة المحاولة"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BlindIntersectionView({
  coupleId,
  renderItem,
  emptyMessage = "ما تزال الأرضية المشتركة تتشكّل. استمرّا في مسيرتكما.",
  className = "",
}: Props) {
  const [passphrase, setPassphrase] = useState("");
  const [enabled, setEnabled] = useState(false);

  const handlePassphraseSubmit = useCallback((phrase: string) => {
    setPassphrase(phrase);
    setEnabled(true);
  }, []);

  const { intersection, status, error, retry } = useBlindIntersection({
    coupleId,
    couplePassphrase: passphrase,
    enabled,
  });

  // Allow re-entering the passphrase on error
  const handleRetry = useCallback(() => {
    setEnabled(false);
    setPassphrase("");
    retry();
  }, [retry]);

  return (
    <div className={`flex flex-col gap-6 w-full ${className}`}>

      {/* ── Passphrase gate ────────────────────────────────────────────── */}
      {status === "idle" && (
        <PassphraseGate onSubmit={handlePassphraseSubmit} />
      )}

      {/* ── Loading / decrypting ───────────────────────────────────────── */}
      {(status === "loading" || status === "decrypting") && <LoadingState />}

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {status === "error" && (
        <ErrorState message={error ?? "حدث خطأ غير متوقع."} onRetry={handleRetry} />
      )}

      {/* ── Results ────────────────────────────────────────────────────── */}
      {status === "done" && (
        <div className="flex flex-col gap-4">

          {/* Privacy reminder */}
          <div className="bg-white/60 rounded-xl border border-stone-100 px-4 py-3">
            <p className="text-xs text-stone-400 text-center leading-relaxed">
              🔒 هذه النتائج تُعرض على جهازك فقط ولا تُخزَّن في أي مكان.
            </p>
          </div>

          {intersection.length === 0 ? (
            // Clinically neutral empty state — no blame, no disappointment framing
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span aria-hidden className="text-4xl">🌱</span>
              <p className="text-sm text-stone-600 leading-relaxed max-w-xs">
                {emptyMessage}
              </p>
            </div>
          ) : (
            // Matched items — rendered via the caller's renderItem prop
            <div className="flex flex-col gap-3">
              <p className="text-xs text-stone-400 text-center">
                ما يتقاطع بينكما في هذه المرحلة
              </p>
              <ul className="flex flex-col gap-2" role="list" aria-label="نقاط التقاطع المشتركة">
                {intersection.map((id, i) => (
                  <li key={id} role="listitem">
                    {renderItem(id, i)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Allow a fresh lookup */}
          <button
            type="button"
            onClick={handleRetry}
            className="text-xs text-stone-400 hover:text-stone-500 underline underline-offset-2 transition-colors text-center mt-1"
          >
            إعادة الاستعراض
          </button>
        </div>
      )}
    </div>
  );
}
