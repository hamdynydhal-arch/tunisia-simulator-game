"use client";

/**
 * Sakan (سَكَن) — Conditions Extractor (مُستخرِج الظروف الملائمة)
 *
 * Purpose
 * ───────
 * Lets each partner privately select the positive-context conditions under
 * which they feel most open and safe.  These conditions are the input to the
 * Blind Intersection engine (useBlindIntersection) — only mutually selected
 * conditions surface to the shared experience; the non-matching items are
 * silently discarded.
 *
 * Three category sections:
 *   Time of Day  : morning / evening / midnight
 *   Lighting     : natural / dim / dark
 *   State of Mind: after_comfortable_discussion / quiet_holiday / after_absence
 *
 * UX flow
 * ───────
 * 1. Chips displayed per category — multi-select within each.
 * 2. "احفظ ظروفي" encrypts ConditionSelection → upserts to
 *    wife_conditions_* or husband_conditions_* based on the `role` prop.
 * 3. Saved view with soft confirmation + edit button.
 *
 * The flatIds field is what gets passed to useBlindIntersection.
 */

import { useState, useEffect, useCallback } from "react";
import type {
  SakanRole,
  TimeOfDayId,
  LightingId,
  StateOfMindId,
  ConditionId,
  ConditionSelection,
} from "@/types/sakan";
import { encrypt, decrypt, assemblePayload } from "@/lib/sakan/crypto";
import { upsertSession, fetchSession } from "@/lib/sakan/supabase";

// ─── Catalog ──────────────────────────────────────────────────────────────────

interface ConditionChip<T extends string> {
  id: T;
  label: string;
  icon: string;
}

const TIME_OPTIONS: ConditionChip<TimeOfDayId>[] = [
  { id: "morning", icon: "🌅", label: "الصباح" },
  { id: "evening", icon: "🌆", label: "المساء" },
  { id: "midnight", icon: "🌙", label: "منتصف الليل" },
];

const LIGHTING_OPTIONS: ConditionChip<LightingId>[] = [
  { id: "natural", icon: "☀️", label: "إضاءة طبيعية" },
  { id: "dim",     icon: "🕯️", label: "إضاءة خافتة" },
  { id: "dark",    icon: "🌑", label: "ظلام تام" },
];

const STATE_OPTIONS: ConditionChip<StateOfMindId>[] = [
  {
    id: "after_comfortable_discussion",
    icon: "💬",
    label: "بعد نقاش مريح",
  },
  {
    id: "quiet_holiday",
    icon: "🏡",
    label: "في عطلة هادئة",
  },
  {
    id: "after_absence",
    icon: "✈️",
    label: "بعد غياب وعودة",
  },
];

// ─── Column keys per role ─────────────────────────────────────────────────────

type ConditionColumns = {
  ciphertext: "wife_conditions_ciphertext" | "husband_conditions_ciphertext";
  iv:         "wife_conditions_iv"         | "husband_conditions_iv";
  salt:       "wife_conditions_salt"       | "husband_conditions_salt";
};

function columnsForRole(role: SakanRole): ConditionColumns {
  if (role === "wife") {
    return {
      ciphertext: "wife_conditions_ciphertext",
      iv:         "wife_conditions_iv",
      salt:       "wife_conditions_salt",
    };
  }
  return {
    ciphertext: "husband_conditions_ciphertext",
    iv:         "husband_conditions_iv",
    salt:       "husband_conditions_salt",
  };
}

// ─── Chip component ───────────────────────────────────────────────────────────

function Chip<T extends string>({
  chip,
  selected,
  onToggle,
  disabled,
}: {
  chip: ConditionChip<T>;
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
        "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2",
        selected
          ? "border-teal-500 bg-teal-50 text-teal-800"
          : "border-stone-200 bg-white/80 text-stone-600 hover:border-stone-300",
        disabled ? "pointer-events-none opacity-60" : "",
      ].join(" ")}
    >
      <span aria-hidden className="text-base leading-none">{chip.icon}</span>
      {chip.label}
    </button>
  );
}

// ─── Saved view ───────────────────────────────────────────────────────────────

function SavedConditionsCard({
  selection,
  onEdit,
}: {
  selection: ConditionSelection;
  onEdit: () => void;
}) {
  const allChips: ConditionChip<ConditionId>[] = [
    ...(TIME_OPTIONS as ConditionChip<ConditionId>[]),
    ...(LIGHTING_OPTIONS as ConditionChip<ConditionId>[]),
    ...(STATE_OPTIONS as ConditionChip<ConditionId>[]),
  ];
  const selectedChips = allChips.filter((c) =>
    selection.flatIds.includes(c.id)
  );

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
          ظروفك الملائمة المحفوظة
        </p>
        <div className="flex flex-wrap gap-2">
          {selectedChips.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium border border-teal-300 bg-teal-50 text-teal-800"
            >
              <span aria-hidden>{c.icon}</span>
              {c.label}
            </span>
          ))}
          {selectedChips.length === 0 && (
            <span className="text-sm text-stone-400">لم يتم اختيار أي ظرف.</span>
          )}
        </div>
      </div>

      <div className="bg-amber-50/70 border border-amber-100 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700 leading-relaxed">
          🔒 لا يرى الطرف الآخر اختياراتك — فقط ما يتطابق بينكما سيظهر في
          اللقاء المشترك.
        </p>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2 transition-colors self-start"
      >
        تعديل الظروف
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

export default function ConditionsExtractor({
  coupleId,
  passphrase,
  role,
  className = "",
}: Props) {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayId[]>([]);
  const [lighting, setLighting] = useState<LightingId[]>([]);
  const [stateOfMind, setStateOfMind] = useState<StateOfMindId[]>([]);
  const [savedSelection, setSavedSelection] = useState<ConditionSelection | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const cols = columnsForRole(role);

  // Load existing selection on mount
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
            const sel = await decrypt<ConditionSelection>(payload, passphrase);
            if (!cancelled && sel) {
              setSavedSelection(sel);
              setTimeOfDay(sel.timeOfDay);
              setLighting(sel.lighting);
              setStateOfMind(sel.stateOfMind);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, passphrase, role]);

  function toggleItem<T extends string>(
    arr: T[],
    setArr: React.Dispatch<React.SetStateAction<T[]>>,
    id: T
  ) {
    setArr(arr.includes(id) ? arr.filter((v) => v !== id) : [...arr, id]);
  }

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const flatIds: ConditionId[] = [
        ...timeOfDay,
        ...lighting,
        ...stateOfMind,
      ];
      const selection: ConditionSelection = {
        timeOfDay,
        lighting,
        stateOfMind,
        flatIds,
        savedAt: new Date().toISOString(),
      };

      const payload = await encrypt(selection, passphrase);
      const { error } = await upsertSession(coupleId, {
        [cols.ciphertext]: payload.ciphertext,
        [cols.iv]:         payload.iv,
        [cols.salt]:       payload.salt,
      });

      if (!error) {
        setSavedSelection(selection);
        setEditMode(false);
      }
    } finally {
      setIsSaving(false);
    }
  }, [cols, coupleId, isSaving, lighting, passphrase, stateOfMind, timeOfDay]);

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

  const showEditor = !savedSelection || editMode;
  const hasAnySelection =
    timeOfDay.length > 0 || lighting.length > 0 || stateOfMind.length > 0;

  return (
    <div className={`flex flex-col gap-6 w-full ${className}`} dir="rtl">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-base font-bold text-stone-800">
          الظروف الملائمة
        </h2>
        <p className="text-sm text-stone-500 leading-relaxed">
          اختر الأوقات والظروف التي تشعر فيها بأكبر قدر من الراحة والانفتاح.
          اختياراتك سرية تماماً.
        </p>
      </div>

      {showEditor ? (
        <>
          {/* Time of Day */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              وقت اليوم
            </p>
            <div className="flex flex-wrap gap-2">
              {TIME_OPTIONS.map((chip) => (
                <Chip
                  key={chip.id}
                  chip={chip}
                  selected={timeOfDay.includes(chip.id)}
                  onToggle={() =>
                    toggleItem(timeOfDay, setTimeOfDay, chip.id)
                  }
                  disabled={isSaving}
                />
              ))}
            </div>
          </div>

          {/* Lighting */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              الإضاءة
            </p>
            <div className="flex flex-wrap gap-2">
              {LIGHTING_OPTIONS.map((chip) => (
                <Chip
                  key={chip.id}
                  chip={chip}
                  selected={lighting.includes(chip.id)}
                  onToggle={() =>
                    toggleItem(lighting, setLighting, chip.id)
                  }
                  disabled={isSaving}
                />
              ))}
            </div>
          </div>

          {/* State of Mind */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              الحالة الذهنية
            </p>
            <div className="flex flex-wrap gap-2">
              {STATE_OPTIONS.map((chip) => (
                <Chip
                  key={chip.id}
                  chip={chip}
                  selected={stateOfMind.includes(chip.id)}
                  onToggle={() =>
                    toggleItem(stateOfMind, setStateOfMind, chip.id)
                  }
                  disabled={isSaving}
                />
              ))}
            </div>
          </div>

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasAnySelection || isSaving}
            className="w-full rounded-xl py-4 px-6 text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
            style={{
              background:
                "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)",
            }}
          >
            {isSaving ? "جارٍ الحفظ…" : "احفظ ظروفي"}
          </button>

          {!hasAnySelection && (
            <p className="text-xs text-stone-400 text-center -mt-3">
              اختر ظرفاً واحداً على الأقل
            </p>
          )}
        </>
      ) : (
        <SavedConditionsCard
          selection={savedSelection!}
          onEdit={() => setEditMode(true)}
        />
      )}
    </div>
  );
}
