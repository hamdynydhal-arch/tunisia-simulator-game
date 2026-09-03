"use client";

/**
 * Sakan (سَكَن) — Husband Observation Log ("ماذا لاحظت")
 *
 * ██ HUSBAND-ONLY COMPONENT ██
 * Must never be rendered in the wife's session.
 *
 * Replaces the removed DopamineRecoveryLog / "small victories" component.
 *
 * # Design intent (SPEC §5.3)
 * سجل بلا تتابع: "ماذا لاحظت" لا "كم يوماً صمدت".
 *
 * # Hard constraints (SPEC Rule 4 + §2)
 * - NO total count displayed anywhere (لا عدّادات ولا سلاسل ولا نسب إنجاز)
 * - NO victory / defeat framing in any label or prompt
 * - NO consecutive-day counting — each entry is completely independent
 * - Free text — no dropdown forces a label onto what "noting" means
 * - Data stored in husband's IndexedDB (key: 'Observations'), never Supabase
 *
 * # Storage
 * HusbandObservationLog[] → encrypted blob → IndexedDB key 'Observations'.
 * The wife's device never reads or displays this data.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { HusbandObservation, HusbandObservationLog } from "@/types/sakan";
import { writeHusband, readHusband } from "@/lib/sakan/idb";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Husband's individual session passphrase. */
  passphrase: string;
  className?: string;
}

// ─── Observation item ─────────────────────────────────────────────────────────

function ObservationItem({ obs }: { obs: HusbandObservation }) {
  const date = new Date(obs.writtenAt);
  // Arabic-formatted date, no time displayed (SPEC Rule 4: no timestamps as
  // progress markers — just a natural date reference)
  const dateLabel = date.toLocaleDateString("ar-DZ", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="rounded-xl border border-stone-100 bg-white/70 px-4 py-3 text-right">
      <p className="text-xs text-stone-400 mb-1.5">{dateLabel}</p>
      <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{obs.text}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HusbandObservationLog({ passphrase, className = "" }: Props) {
  const [log, setLog] = useState<HusbandObservationLog>([]);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load from IndexedDB on mount
  useEffect(() => {
    if (!passphrase) { setIsLoading(false); return; }
    let cancelled = false;

    async function load() {
      const stored = await readHusband<HusbandObservationLog>("Observations", passphrase);
      if (!cancelled) {
        setLog(stored ?? []);
        setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [passphrase]);

  const handleAdd = useCallback(async () => {
    const text = draft.trim();
    if (!text || isSaving) return;

    setIsSaving(true);
    try {
      const entry: HusbandObservation = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text,
        writtenAt: new Date().toISOString(),
      };

      // Prepend so most recent appears first
      const updated: HusbandObservationLog = [entry, ...log];
      await writeHusband<HusbandObservationLog>("Observations", updated, passphrase);
      setLog(updated);
      setDraft("");
      textareaRef.current?.focus();
    } finally {
      setIsSaving(false);
    }
  }, [draft, isSaving, log, passphrase]);

  if (isLoading) {
    return (
      <div className={`flex justify-center py-10 ${className}`}>
        <div
          className="w-8 h-8 rounded-full border-2 border-stone-200"
          style={{ borderTopColor: "#6b7f78", animation: "spin 2s linear infinite" }}
          aria-label="جارٍ التحميل"
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-5 w-full ${className}`} dir="rtl">
      {/* Header — neutral, no "victory" framing */}
      <div className="space-y-1">
        <h2 className="text-base font-bold text-stone-800">ماذا لاحظت</h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          سجّل ما تلاحظه — أي لحظة، أي تحوّل، أي شيء. لا توقعات، لا قياس.
        </p>
      </div>

      {/* Input area */}
      <div className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={isSaving}
          placeholder="اكتب ما لاحظته الآن…"
          rows={3}
          className="w-full resize-none rounded-xl border-2 border-stone-200 bg-white/80 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-300 focus:border-teal-400 focus:outline-none transition-colors leading-relaxed"
          onKeyDown={(e) => {
            // Ctrl+Enter / Cmd+Enter submits
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim() || isSaving}
          className="self-end rounded-xl py-2.5 px-5 text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
          style={{ background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)" }}
        >
          {isSaving ? "…" : "سجّل"}
        </button>
      </div>

      {/* Log entries — NO total count shown anywhere */}
      {log.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {log.map((obs) => (
            <ObservationItem key={obs.id} obs={obs} />
          ))}
        </div>
      )}

      {log.length === 0 && !isLoading && (
        <p className="text-center text-xs text-stone-300 py-4">
          لا شيء بعد — ابدأ بما يخطر على بالك.
        </p>
      )}
    </div>
  );
}
