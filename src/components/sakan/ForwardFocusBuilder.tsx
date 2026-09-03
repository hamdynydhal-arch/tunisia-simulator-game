"use client";

/**
 * Sakan (سَكَن) — Forward-Focus Communicator (بناء رسالة التوجه للأمام)
 *
 * Phase 4: data stored per-device in IndexedDB (key: 'ForwardFocusMessage').
 * No Supabase columns for this field post-Phase-4 migration.
 */

import { useState, useEffect, useCallback } from "react";
import type { SakanRole, ForwardFocusMessage } from "@/types/sakan";
import { writeWife, readWife, writeHusband, readHusband } from "@/lib/sakan/idb";

// ─── Static options ───────────────────────────────────────────────────────────

interface DropdownOption { id: string; label: string; }

const ACTION_OPTIONS: DropdownOption[] = [
  { id: "quiet_presence", label: "الحضور الهادئ بلا كلام" },
  { id: "gentle_touch",   label: "لمسة لطيفة فقط" },
  { id: "shared_silence", label: "الجلوس معاً في صمت" },
  { id: "slow_breathing", label: "التنفس ببطء معاً" },
];

const FEELING_OPTIONS: DropdownOption[] = [
  { id: "safe",      label: "الأمان" },
  { id: "seen",      label: "الرؤية" },
  { id: "calm",      label: "الهدوء" },
  { id: "connected", label: "الاتصال" },
];

// ─── IDB helpers per role ─────────────────────────────────────────────────────

async function loadMessage(role: SakanRole, passphrase: string): Promise<ForwardFocusMessage | null> {
  if (role === "wife") return readWife<ForwardFocusMessage>("ForwardFocusMessage", passphrase);
  return readHusband<ForwardFocusMessage>("ForwardFocusMessage", passphrase);
}

async function saveMessage(role: SakanRole, msg: ForwardFocusMessage, passphrase: string): Promise<void> {
  if (role === "wife") return writeWife<ForwardFocusMessage>("ForwardFocusMessage", msg, passphrase);
  return writeHusband<ForwardFocusMessage>("ForwardFocusMessage", msg, passphrase);
}

// ─── Saved message card ───────────────────────────────────────────────────────

function SavedMessageCard({ message, onEdit }: { message: ForwardFocusMessage; onEdit: () => void }) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div
        className="rounded-2xl p-5 border"
        style={{
          background: "linear-gradient(135deg, rgba(107,127,120,0.10) 0%, rgba(92,110,104,0.06) 100%)",
          borderColor: "rgba(107,127,120,0.25)",
        }}
      >
        <p className="text-xs text-stone-500 mb-3 font-medium uppercase tracking-wide">رسالتك اليوم</p>
        <p className="text-base font-semibold text-stone-800 leading-relaxed">{message.sentence}</p>
      </div>

      <div className="bg-amber-50/70 border border-amber-100 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700 leading-relaxed">
          🌱 رسالتك محفوظة لك وحدك — لا يرى الطرف الآخر صياغتها، فقط ما يتقاطع معه من احتياجاتك.
        </p>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors self-start"
      >
        تعديل الرسالة
      </button>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  passphrase: string;
  role: SakanRole;
  className?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ForwardFocusBuilder({ passphrase, role, className = "" }: Props) {
  const [actionId, setActionId] = useState<string>(ACTION_OPTIONS[0].id);
  const [feelingId, setFeelingId] = useState<string>(FEELING_OPTIONS[0].id);
  const [savedMessage, setSavedMessage] = useState<ForwardFocusMessage | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load from IndexedDB on mount
  useEffect(() => {
    if (!passphrase) { setIsLoading(false); return; }
    let cancelled = false;

    async function load() {
      const msg = await loadMessage(role, passphrase);
      if (!cancelled) {
        if (msg) { setSavedMessage(msg); setActionId(msg.actionId); setFeelingId(msg.feelingId); }
        setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [passphrase, role]);

  const actionLabel = ACTION_OPTIONS.find((a) => a.id === actionId)?.label ?? "";
  const feelingLabel = FEELING_OPTIONS.find((f) => f.id === feelingId)?.label ?? "";
  const previewSentence = `اليوم، أحتاج إلى ${actionLabel} لكي أشعر بـ ${feelingLabel}.`;

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const msg: ForwardFocusMessage = {
        actionId, actionLabel, feelingId, feelingLabel,
        sentence: previewSentence,
        composedAt: new Date().toISOString(),
      };
      await saveMessage(role, msg, passphrase);
      setSavedMessage(msg);
      setEditMode(false);
    } finally {
      setIsSaving(false);
    }
  }, [actionId, actionLabel, feelingId, feelingLabel, isSaving, passphrase, previewSentence, role]);

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

  const showEditor = !savedMessage || editMode;

  return (
    <div className={`flex flex-col gap-6 w-full ${className}`} dir="rtl">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-stone-800">رسالة التوجه للأمام</h2>
        <p className="text-sm text-stone-500 leading-relaxed">جملة واحدة تصف حاجتك الآن — بدون لوم، بدون ماضٍ.</p>
      </div>

      {showEditor ? (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">أحتاج إلى…</label>
            <div className="relative">
              <select
                value={actionId}
                onChange={(e) => setActionId(e.target.value)}
                disabled={isSaving}
                className="w-full appearance-none rounded-xl border-2 border-stone-200 bg-white/80 px-4 py-3 text-sm font-semibold text-stone-800 focus:border-teal-400 focus:outline-none transition-colors"
              >
                {ACTION_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">▾</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">لكي أشعر بـ…</label>
            <div className="relative">
              <select
                value={feelingId}
                onChange={(e) => setFeelingId(e.target.value)}
                disabled={isSaving}
                className="w-full appearance-none rounded-xl border-2 border-stone-200 bg-white/80 px-4 py-3 text-sm font-semibold text-stone-800 focus:border-teal-400 focus:outline-none transition-colors"
              >
                {FEELING_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">▾</span>
            </div>
          </div>

          <div className="rounded-xl border px-5 py-4" style={{ background: "rgba(107,127,120,0.06)", borderColor: "rgba(107,127,120,0.20)" }}>
            <p className="text-xs text-stone-400 mb-1">معاينة:</p>
            <p className="text-sm font-semibold text-stone-800 leading-relaxed">{previewSentence}</p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-xl py-4 px-6 text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
            style={{ background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)" }}
          >
            {isSaving ? "جارٍ الحفظ…" : "احفظ رسالتي"}
          </button>
        </>
      ) : (
        <SavedMessageCard message={savedMessage!} onEdit={() => setEditMode(true)} />
      )}
    </div>
  );
}
