"use client";

/**
 * Sakan (سَكَن) — Forward-Focus Communicator (بناء رسالة التوجه للأمام)
 *
 * Purpose
 * ───────
 * Gives each partner a structured, non-blaming way to name a present need.
 * The template is fixed: "اليوم، أحتاج إلى [Action] لكي أشعر بـ [Feeling]."
 * Client-side string concatenation ONLY — no AI, no server, no free text.
 * Fixed grammar prevents passive-aggressive or blaming language by design.
 *
 * UX flow
 * ───────
 * 1. Two dropdowns: Action + Feeling.
 * 2. Live preview of the assembled sentence.
 * 3. "احفظ رسالتي" encrypts the ForwardFocusMessage object → upserts to
 *    wife_message_* or husband_message_* based on the `role` prop.
 * 4. Saved view shows the sentence with a soft affirmation.
 * 5. "تعديل" re-opens editing mode.
 */

import { useState, useEffect, useCallback } from "react";
import type { SakanRole, ForwardFocusMessage } from "@/types/sakan";
import { encrypt, decrypt, assemblePayload } from "@/lib/sakan/crypto";
import { upsertSession, fetchSession } from "@/lib/sakan/supabase";

// ─── Static options ───────────────────────────────────────────────────────────

interface DropdownOption {
  id: string;
  label: string;
}

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

// ─── Column keys per role ─────────────────────────────────────────────────────

type MessageColumns = {
  ciphertext: "wife_message_ciphertext" | "husband_message_ciphertext";
  iv:         "wife_message_iv"         | "husband_message_iv";
  salt:       "wife_message_salt"       | "husband_message_salt";
};

function columnsForRole(role: SakanRole): MessageColumns {
  if (role === "wife") {
    return {
      ciphertext: "wife_message_ciphertext",
      iv:         "wife_message_iv",
      salt:       "wife_message_salt",
    };
  }
  return {
    ciphertext: "husband_message_ciphertext",
    iv:         "husband_message_iv",
    salt:       "husband_message_salt",
  };
}

// ─── Saved-message card ───────────────────────────────────────────────────────

function SavedMessageCard({
  message,
  onEdit,
}: {
  message: ForwardFocusMessage;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div
        className="rounded-2xl p-5 border"
        style={{
          background:
            "linear-gradient(135deg, rgba(107,127,120,0.10) 0%, rgba(92,110,104,0.06) 100%)",
          borderColor: "rgba(107,127,120,0.25)",
        }}
      >
        <p className="text-xs text-stone-500 mb-3 font-medium uppercase tracking-wide">
          رسالتك اليوم
        </p>
        <p className="text-base font-semibold text-stone-800 leading-relaxed">
          {message.sentence}
        </p>
      </div>

      <div className="bg-amber-50/70 border border-amber-100 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700 leading-relaxed">
          🌱 رسالتك محفوظة لك وحدك — لا يرى الطرف الآخر صياغتها، فقط ما يتقاطع
          معه من احتياجاتك.
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
  coupleId: string;
  passphrase: string;
  role: SakanRole;
  className?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ForwardFocusBuilder({
  coupleId,
  passphrase,
  role,
  className = "",
}: Props) {
  const [actionId, setActionId] = useState<string>(ACTION_OPTIONS[0].id);
  const [feelingId, setFeelingId] = useState<string>(FEELING_OPTIONS[0].id);
  const [savedMessage, setSavedMessage] = useState<ForwardFocusMessage | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const cols = columnsForRole(role);

  // Load existing message on mount
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
          session[cols.ciphertext],
          session[cols.iv],
          session[cols.salt]
        );
        if (payload) {
          try {
            const msg = await decrypt<ForwardFocusMessage>(payload, passphrase);
            if (!cancelled && msg) {
              setSavedMessage(msg);
              setActionId(msg.actionId);
              setFeelingId(msg.feelingId);
            }
          } catch {
            // Wrong passphrase or corrupted — start fresh
          }
        }
      }
      if (!cancelled) setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  // cols members are derived from role (stable string) — safe to stringify
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, passphrase, role]);

  // Live sentence assembly (client-side only)
  const actionLabel =
    ACTION_OPTIONS.find((a) => a.id === actionId)?.label ?? "";
  const feelingLabel =
    FEELING_OPTIONS.find((f) => f.id === feelingId)?.label ?? "";
  const previewSentence = `اليوم، أحتاج إلى ${actionLabel} لكي أشعر بـ ${feelingLabel}.`;

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const msg: ForwardFocusMessage = {
        actionId,
        actionLabel,
        feelingId,
        feelingLabel,
        sentence: previewSentence,
        composedAt: new Date().toISOString(),
      };

      const payload = await encrypt(msg, passphrase);
      const { error } = await upsertSession(coupleId, {
        [cols.ciphertext]: payload.ciphertext,
        [cols.iv]:         payload.iv,
        [cols.salt]:       payload.salt,
      });

      if (!error) {
        setSavedMessage(msg);
        setEditMode(false);
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    actionId, actionLabel, cols, coupleId,
    feelingId, feelingLabel, isSaving, passphrase, previewSentence,
  ]);

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

  const showEditor = !savedMessage || editMode;

  return (
    <div className={`flex flex-col gap-6 w-full ${className}`} dir="rtl">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-base font-bold text-stone-800">
          رسالة التوجه للأمام
        </h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          جملة واحدة تصف حاجتك الآن — بدون لوم، بدون ماضٍ.
        </p>
      </div>

      {showEditor ? (
        <>
          {/* Action dropdown */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              أحتاج إلى…
            </label>
            <div className="relative">
              <select
                value={actionId}
                onChange={(e) => setActionId(e.target.value)}
                disabled={isSaving}
                className="w-full appearance-none rounded-xl border-2 border-stone-200 bg-white/80 px-4 py-3 text-sm font-semibold text-stone-800 focus:border-teal-400 focus:outline-none transition-colors"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
              >
                ▾
              </span>
            </div>
          </div>

          {/* Feeling dropdown */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              لكي أشعر بـ…
            </label>
            <div className="relative">
              <select
                value={feelingId}
                onChange={(e) => setFeelingId(e.target.value)}
                disabled={isSaving}
                className="w-full appearance-none rounded-xl border-2 border-stone-200 bg-white/80 px-4 py-3 text-sm font-semibold text-stone-800 focus:border-teal-400 focus:outline-none transition-colors"
              >
                {FEELING_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
              >
                ▾
              </span>
            </div>
          </div>

          {/* Live preview */}
          <div
            className="rounded-xl border px-5 py-4"
            style={{
              background: "rgba(107,127,120,0.06)",
              borderColor: "rgba(107,127,120,0.20)",
            }}
          >
            <p className="text-xs text-stone-400 mb-1">معاينة:</p>
            <p className="text-sm font-semibold text-stone-800 leading-relaxed">
              {previewSentence}
            </p>
          </div>

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-xl py-4 px-6 text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
            style={{
              background:
                "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)",
            }}
          >
            {isSaving ? "جارٍ الحفظ…" : "احفظ رسالتي"}
          </button>
        </>
      ) : (
        <SavedMessageCard
          message={savedMessage!}
          onEdit={() => setEditMode(true)}
        />
      )}
    </div>
  );
}
