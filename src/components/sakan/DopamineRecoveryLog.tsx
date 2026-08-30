"use client";

/**
 * Sakan (سَكَن) — Dopamine Recovery Log (سجل الانتصارات الصغيرة)
 *
 * ██ HUSBAND-ONLY COMPONENT ██
 * Must never be rendered in the wife's session.
 *
 * ███ NO STREAK COUNTERS — EVER ███
 * This component deliberately has NO consecutive-day tracking.
 * Each logged victory is completely independent.
 * Displaying streak counts causes shame on relapse.
 * The ONLY aggregate shown is total victories: "X انتصار مسجّل".
 *
 * Purpose
 * ───────
 * Helps the husband gently notice and name daily positive choices
 * without imposing rigid expectations. Three quick-log buttons, each
 * framed as a positive act of self-care — not a prohibition.
 *
 * UX flow
 * ───────
 * 1. Load existing encrypted log from Supabase on mount.
 * 2. Show quick-log buttons (always active, no cool-down).
 * 3. On tap — append new entry, re-encrypt whole log, upsert.
 * 4. Victories displayed as individual cards, newest first.
 * 5. Total shown as "X انتصار مسجّل" — no consecutive framing.
 */

import { useState, useEffect, useCallback } from "react";
import type { DopamineLog, DopamineLogEntry } from "@/types/sakan";
import { encrypt, decrypt, assemblePayload } from "@/lib/sakan/crypto";
import { upsertSession, fetchSession } from "@/lib/sakan/supabase";

// ─── Static data ──────────────────────────────────────────────────────────────

interface QuickLogOption {
  id: string;
  label: string;
  icon: string;
  subtext: string;
}

const QUICK_LOG_OPTIONS: QuickLogOption[] = [
  {
    id: "mindful_presence",
    icon: "🧘",
    label: "اخترت الحضور الذهني",
    subtext: "بقيت حاضرًا بدلاً من الهروب.",
  },
  {
    id: "overcame_numbing",
    icon: "🌿",
    label: "تجاوزت الرغبة في التخدير العاطفي",
    subtext: "شعرت بالرغبة، واخترت غير ذلك.",
  },
  {
    id: "clean_space",
    icon: "🔑",
    label: "حافظت على مساحتي النقية اليوم",
    subtext: "يوم آخر يُضاف إلى مسيرتك.",
  },
];

// ─── Date formatter ───────────────────────────────────────────────────────────

function formatVictoryDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("ar-TN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return "";
  }
}

// ─── Victory Card (read-only) ─────────────────────────────────────────────────

function VictoryCard({ entry }: { entry: DopamineLogEntry }) {
  const opt = QUICK_LOG_OPTIONS.find((o) => o.id === entry.choiceId);
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-white/70 border border-stone-100">
      <span aria-hidden className="text-xl shrink-0">
        {opt?.icon ?? "✨"}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-semibold text-stone-800 truncate">
          {entry.choiceLabel}
        </span>
        <span className="text-xs text-stone-400">
          {formatVictoryDate(entry.loggedAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  coupleId: string;
  /** Husband's private session passphrase. */
  passphrase: string;
  className?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DopamineRecoveryLog({
  coupleId,
  passphrase,
  className = "",
}: Props) {
  const [log, setLog] = useState<DopamineLog>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Load existing log on mount
  useEffect(() => {
    if (!coupleId || !passphrase) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      const session = await fetchSession(coupleId);
      if (cancelled) return;

      if (session) {
        const payload = assemblePayload(
          session.husband_dopamine_log_ciphertext,
          session.husband_dopamine_log_iv,
          session.husband_dopamine_log_salt
        );
        if (payload) {
          try {
            const existing = await decrypt<DopamineLog>(payload, passphrase);
            if (!cancelled && Array.isArray(existing)) {
              setLog(existing);
            }
          } catch {
            // Wrong passphrase or corrupted — start with empty log
          }
        }
      }
      if (!cancelled) setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [coupleId, passphrase]);

  const handleLog = useCallback(
    async (option: QuickLogOption) => {
      if (savingId) return;
      setSavingId(option.id);

      const newEntry: DopamineLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        choiceId: option.id,
        choiceLabel: option.label,
        loggedAt: new Date().toISOString(),
      };

      // Append optimistically
      const updatedLog: DopamineLog = [newEntry, ...log];
      setLog(updatedLog);

      try {
        const payload = await encrypt(updatedLog, passphrase);
        await upsertSession(coupleId, {
          husband_dopamine_log_ciphertext: payload.ciphertext,
          husband_dopamine_log_iv: payload.iv,
          husband_dopamine_log_salt: payload.salt,
        });
      } catch {
        // Silent rollback — remove the optimistic entry
        setLog(log);
      } finally {
        setSavingId(null);
      }
    },
    [coupleId, log, passphrase, savingId]
  );

  if (isLoading) {
    return (
      <div className={`flex justify-center py-10 ${className}`}>
        <div
          className="w-8 h-8 rounded-full border-2 border-stone-200"
          style={{
            borderTopColor: "#6b7f78",
            animation: "spin 2s linear infinite",
          }}
          aria-label="جارٍ التحميل"
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 w-full ${className}`} dir="rtl">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-base font-bold text-stone-800">
          سجل الانتصارات الصغيرة
        </h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          كل خطوة مستقلة. لا تسلسل، لا أيام متتالية. فقط لحظة صادقة تستحق
          التسجيل.
        </p>
      </div>

      {/* Quick-log buttons */}
      <div className="flex flex-col gap-3">
        {QUICK_LOG_OPTIONS.map((opt) => {
          const isSaving = savingId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleLog(opt)}
              disabled={!!savingId}
              className={[
                "w-full flex items-center gap-4 rounded-2xl p-4 text-right transition-all duration-150 border focus-visible:outline-none focus-visible:ring-2",
                isSaving
                  ? "border-teal-300 bg-teal-50 opacity-80"
                  : "border-stone-200 bg-white/80 hover:border-teal-300 hover:bg-teal-50/40 active:scale-95",
                savingId && !isSaving ? "opacity-50 pointer-events-none" : "",
              ].join(" ")}
            >
              <span aria-hidden className="text-2xl shrink-0 leading-none">
                {opt.icon}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-stone-800">
                  {opt.label}
                </span>
                <span className="text-xs text-stone-400">{opt.subtext}</span>
              </div>
              {isSaving && (
                <span className="mr-auto text-xs text-teal-600 shrink-0">
                  جارٍ…
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Victory count — total only, NO streak framing */}
      {log.length > 0 && (
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{
              background: "rgba(107,127,120,0.10)",
              color: "#4a6660",
            }}
          >
            {log.length} انتصار مسجّل
          </span>
          {/* Intentionally no "X يوم متتالٍ" text anywhere */}
        </div>
      )}

      {/* Victory list */}
      {log.length > 0 ? (
        <div className="flex flex-col gap-2">
          {log.slice(0, 20).map((entry) => (
            <VictoryCard key={entry.id} entry={entry} />
          ))}
          {log.length > 20 && (
            <p className="text-xs text-center text-stone-400 pt-1">
              و{log.length - 20} انتصار آخر محفوظ
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-200 px-5 py-8 text-center">
          <p className="text-sm text-stone-400 leading-relaxed">
            لم تُسجَّل أي انتصارات بعد.
            <br />
            اضغط على أي خيار أعلاه حين تشعر أنك تستحق ذلك.
          </p>
        </div>
      )}
    </div>
  );
}
