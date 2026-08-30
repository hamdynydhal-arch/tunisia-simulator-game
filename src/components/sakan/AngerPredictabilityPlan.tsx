"use client";

/**
 * Sakan (سَكَن) — Anger Predictability Plan (خطة التوقع الآمن)
 *
 * ██ HUSBAND-ONLY COMPONENT ██
 * Must never be rendered in the wife's session.
 *
 * Purpose
 * ───────
 * Predictability is one of the fastest fear-reduction tools available to
 * the husband.  When the wife knows exactly what he will do when he feels
 * anger rising — before any incident — the unpredictability that causes
 * her nervous system to stay on alert is reduced.
 *
 * UX flow
 * ───────
 * 1. Husband sees 3 strategy cards (multi-select).
 * 2. Selects at least one.
 * 3. Taps "احفظ خطتي" — encrypts + upserts to Supabase.
 * 4. A read-only "plan card" is shown with a soft affirmation.
 * 5. "تعديل" button re-opens editing mode.
 *
 * The plan is stored encrypted in husband_anger_plan_* columns.
 * The wife's client never reads or displays this field.
 */

import { useState, useEffect, useCallback } from "react";
import type { AngerPlan, AngerStrategyId } from "@/types/sakan";
import { encrypt, decrypt, assemblePayload } from "@/lib/sakan/crypto";
import { upsertSession, fetchSession } from "@/lib/sakan/supabase";

// ─── Static data ──────────────────────────────────────────────────────────────

interface StrategyOption {
  id: AngerStrategyId;
  label: string;
  icon: string;
  description: string;
}

const STRATEGY_OPTIONS: StrategyOption[] = [
  {
    id: "leave_room",
    icon: "🚪",
    label: "سأغادر الغرفة فوراً بهدوء",
    description: "بدون كلمات إضافية، بدون إغلاق الأبواب بقوة.",
  },
  {
    id: "silence_15",
    icon: "🤫",
    label: "سأطلب 15 دقيقة من الصمت",
    description: "سأقول فقط: \"أحتاج 15 دقيقة\" ثم أعود هادئًا.",
  },
  {
    id: "go_walk",
    icon: "🚶",
    label: "سأذهب للمشي قليلاً",
    description: "الحركة تساعد الجهاز العصبي على العودة للهدوء.",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  coupleId: string;
  /** Husband's private session passphrase. */
  passphrase: string;
  className?: string;
}

// ─── Strategy card ────────────────────────────────────────────────────────────

function StrategyCard({
  option,
  selected,
  onToggle,
  disabled,
}: {
  option: StrategyOption;
  selected: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        "w-full flex items-start gap-4 rounded-2xl p-5 text-right transition-all duration-200 border-2 focus-visible:outline-none focus-visible:ring-2",
        selected
          ? "border-teal-500 bg-teal-50 shadow-md"
          : "border-stone-200 bg-white/80 hover:border-stone-300 hover:bg-stone-50",
        disabled ? "pointer-events-none opacity-70" : "",
      ].join(" ")}
    >
      {/* Check mark */}
      <div
        aria-hidden
        className={[
          "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 transition-all duration-200",
          selected
            ? "border-teal-600 bg-teal-600"
            : "border-stone-300 bg-white",
        ].join(" ")}
      >
        {selected && (
          <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-none">
            <path
              d="M1 4l2.5 2.5L9 1"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      {/* Content */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl leading-none">{option.icon}</span>
          <span
            className={[
              "text-sm font-bold",
              selected ? "text-teal-800" : "text-stone-800",
            ].join(" ")}
          >
            {option.label}
          </span>
        </div>
        <p className="text-xs text-stone-500 leading-relaxed">{option.description}</p>
      </div>
    </button>
  );
}

// ─── Read-only Plan Card ──────────────────────────────────────────────────────

function SavedPlanCard({
  plan,
  onEdit,
}: {
  plan: AngerPlan;
  onEdit: () => void;
}) {
  const selectedOptions = STRATEGY_OPTIONS.filter((o) =>
    plan.strategies.includes(o.id)
  );

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header */}
      <div
        className="rounded-2xl p-5 border"
        style={{
          background:
            "linear-gradient(135deg, rgba(107,127,120,0.10) 0%, rgba(92,110,104,0.06) 100%)",
          borderColor: "rgba(107,127,120,0.25)",
        }}
      >
        <p className="text-xs text-stone-500 mb-3 font-medium uppercase tracking-wide">
          خطتك حين يشتد الغضب
        </p>
        <div className="flex flex-col gap-3">
          {selectedOptions.map((opt) => (
            <div key={opt.id} className="flex items-center gap-3">
              <span aria-hidden className="text-lg shrink-0">{opt.icon}</span>
              <span className="text-sm font-semibold text-stone-800">
                {opt.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Affirmation */}
      <div className="bg-amber-50/70 border border-amber-100 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700 leading-relaxed">
          🕊️ كلما اتبعت هذه الخطة، أصبح جهازها العصبي يتوقع الأمان
          تلقائيًا. التوقع وحده يُخفف الخوف — حتى قبل أن تبدأ أي محادثة.
        </p>
      </div>

      {/* Edit */}
      <button
        type="button"
        onClick={onEdit}
        className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors self-start"
      >
        تعديل الخطة
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AngerPredictabilityPlan({
  coupleId,
  passphrase,
  className = "",
}: Props) {
  const [selected, setSelected] = useState<AngerStrategyId[]>([]);
  const [savedPlan, setSavedPlan] = useState<AngerPlan | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing plan on mount
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
          session.husband_anger_plan_ciphertext,
          session.husband_anger_plan_iv,
          session.husband_anger_plan_salt
        );
        if (payload) {
          try {
            const plan = await decrypt<AngerPlan>(payload, passphrase);
            if (!cancelled) {
              setSavedPlan(plan);
              setSelected(plan.strategies);
            }
          } catch {
            // Wrong passphrase or corrupted — start fresh
          }
        }
      }
      if (!cancelled) setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [coupleId, passphrase]);

  function toggleStrategy(id: AngerStrategyId) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  const handleSave = useCallback(async () => {
    if (selected.length === 0 || isSaving) return;
    setIsSaving(true);

    try {
      const plan: AngerPlan = {
        strategies: selected,
        savedAt: new Date().toISOString(),
      };

      const payload = await encrypt(plan, passphrase);
      const { error } = await upsertSession(coupleId, {
        husband_anger_plan_ciphertext: payload.ciphertext,
        husband_anger_plan_iv: payload.iv,
        husband_anger_plan_salt: payload.salt,
      });

      if (!error) {
        setSavedPlan(plan);
        setEditMode(false);
      }
    } finally {
      setIsSaving(false);
    }
  }, [coupleId, isSaving, passphrase, selected]);

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

  const showEditor = !savedPlan || editMode;

  return (
    <div className={`flex flex-col gap-6 w-full ${className}`} dir="rtl">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-base font-bold text-stone-800">
          خطة التوقع الآمن
        </h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          اختر ما ستفعله حين تشعر بالغضب. لا يُطلب منك التحكم في مشاعرك —
          فقط أن تكون سلوكك متوقعًا ومعروفًا مسبقًا.
        </p>
      </div>

      {showEditor ? (
        <>
          {/* Strategy cards */}
          <div className="flex flex-col gap-3">
            {STRATEGY_OPTIONS.map((opt) => (
              <StrategyCard
                key={opt.id}
                option={opt}
                selected={selected.includes(opt.id)}
                onToggle={() => toggleStrategy(opt.id)}
                disabled={isSaving}
              />
            ))}
          </div>

          {/* Minimum selection hint */}
          {selected.length === 0 && (
            <p className="text-xs text-stone-400 text-center">
              اختر خطة واحدة على الأقل
            </p>
          )}

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={selected.length === 0 || isSaving}
            className="w-full rounded-xl py-4 px-6 text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
            style={{ background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)" }}
          >
            {isSaving ? "جارٍ الحفظ…" : "احفظ خطتي"}
          </button>
        </>
      ) : (
        <SavedPlanCard plan={savedPlan!} onEdit={() => setEditMode(true)} />
      )}
    </div>
  );
}
