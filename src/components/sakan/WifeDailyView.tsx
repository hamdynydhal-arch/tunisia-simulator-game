"use client";

/**
 * Sakan (سَكَن) — Wife Daily View
 *
 * مكوّن عرض نقي للزوجة — كل حالته تأتي من الوالد (page shell).
 *
 * ─── قواعد ملزمة ──────────────────────────────────────────────────────────────
 * - لا عدّادات، لا سلاسل، لا نسب إنجاز (SPEC Rule 4)
 * - تجاوز البطاقة (step="done") لا يُنتج أي عنصر جديد (اختبار القبول ٤)
 * - AmbientSerenityKey غائبة تماماً من هذا المكوّن — تظهر في الإعدادات فقط
 * - لا بادجة، لا إشارة بصرية إلى المفتاح، لا أي أثر لـ KeyState هنا
 *
 * ─── ملاحظة ───────────────────────────────────────────────────────────────────
 * صفحة الزوجة (wife-daily/page.tsx) تقرأ حالة المفتاح وتحسب السقف قبل إرسال
 * البيانات إلى هذا المكوّن. هذا المكوّن لا يعرف شيئاً عن المفتاح — لا استيراد
 * ولا قراءة — يتلقى السقف المحسوب مُضمَّناً في اختيار البطاقة فقط.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { Card, WifeState, HusbandObservation } from "@/types/sakan";
import { writeWife, readWife } from "@/lib/sakan/idb";

// ─── الأنواع ─────────────────────────────────────────────────────────────────

export type DailyStep = "card" | "rating" | "done";

export interface WifeDailyViewProps {
  /** البطاقة المختارة — null تعني لا بطاقة متاحة. */
  card: Card | null;
  /** الخطوة الحالية. */
  step: DailyStep;
  /** المزاج المختار (اختياري). */
  moodSelected: string | null;
  /** عبارة مرور جلسة الزوجة. */
  passphrase: string;
  /** حالة الزوجة. */
  wifeState: WifeState;
  onSkip: () => void;
  onMoodTap: (mood: string) => void;
  onCardDone: () => void;
  onExerciseDone: () => void;
  onRatingSelected: (r: 1 | 2 | 3 | 4 | 5) => void;
}

// ─── الوحدات المساعدة ───────────────────────────────────────────────────────

const MOOD_OPTIONS = [
  { emoji: "😌", key: "calm" },
  { emoji: "😔", key: "heavy" },
  { emoji: "🌀", key: "tense" },
] as const;

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

// ─── قسم المزاج ────────────────────────────────────────────────────────────

function MoodTap({
  selected,
  onTap,
}: {
  selected: string | null;
  onTap: (key: string) => void;
}) {
  return (
    <div className="flex justify-center gap-6 py-2" aria-label="كيف تشعرين الآن؟">
      {MOOD_OPTIONS.map(({ emoji, key }) => (
        <button
          key={key}
          type="button"
          onClick={() => onTap(key)}
          aria-pressed={selected === key}
          className={[
            "text-2xl transition-all duration-200 rounded-full p-2",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40",
            selected === key
              ? "opacity-100 scale-110"
              : "opacity-40 hover:opacity-70",
          ].join(" ")}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ─── قسم البطاقة ────────────────────────────────────────────────────────────

function CardSection({
  card,
  onSkip,
  onCardDone,
  onExerciseDone,
}: {
  card: Card;
  onSkip: () => void;
  onCardDone: () => void;
  onExerciseDone: () => void;
}) {
  const isExercise = card.kind === "micro_exercise";

  return (
    <div
      className="w-full rounded-2xl border p-6 space-y-5"
      style={{
        background:
          "linear-gradient(135deg, rgba(107,127,120,0.10) 0%, rgba(92,110,104,0.06) 100%)",
        borderColor: "rgba(107,127,120,0.25)",
      }}
    >
      <p className="text-base text-stone-800 leading-loose text-right whitespace-pre-wrap">
        {card.body}
      </p>

      <div className="flex gap-3 justify-start flex-row-reverse">
        {/* تجاوز صامت — بلا تغذية راجعة */}
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-stone-400 hover:text-stone-600 px-3 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300"
        >
          تجاوز
        </button>

        <button
          type="button"
          onClick={isExercise ? onExerciseDone : onCardDone}
          className="rounded-xl px-5 py-2.5 text-white text-sm font-semibold shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)" }}
        >
          {isExercise ? "انتهيت من التمرين" : "حسنًا"}
        </button>
      </div>
    </div>
  );
}

// ─── قسم تقييم الراحة ──────────────────────────────────────────────────────

function RatingSection({ onSelect }: { onSelect: (r: 1 | 2 | 3 | 4 | 5) => void }) {
  return (
    <div className="w-full rounded-2xl border border-stone-200 bg-white/70 p-5 space-y-4 text-right">
      <p className="text-sm text-stone-600 leading-relaxed">
        كيف تشعرين بعد هذا التمرين؟
      </p>
      <div
        className="flex justify-center gap-3"
        role="group"
        aria-label="تقييم الراحة"
      >
        {RATING_VALUES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onSelect(r)}
            className="w-9 h-9 rounded-full border-2 border-stone-200 bg-white text-sm font-semibold text-stone-600 hover:border-teal-500 hover:text-teal-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40"
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── سجل الملاحظات (للزوجة — بلا عنوان، بلا توجيه يومي) ───────────────────

/**
 * سجل حر بلا عنوان — SPEC §5.2
 * "لا عنوان مُوجِّه ولا نداء يومي"
 * البيانات مشفَّرة في IndexedDB تحت مفتاح 'Observations' لحساب الزوجة.
 */
function WifeNotesLog({ passphrase }: { passphrase: string }) {
  type Note = HusbandObservation; // نفس البنية: id + text + writtenAt
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!passphrase) return;
    let cancelled = false;
    readWife<Note[]>("Observations", passphrase).then((stored) => {
      if (!cancelled) setNotes(stored ?? []);
    });
    return () => { cancelled = true; };
  }, [passphrase]);

  const handleSave = useCallback(async () => {
    const text = draft.trim();
    if (!text || isSaving) return;
    setIsSaving(true);
    try {
      const entry: Note = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text,
        writtenAt: new Date().toISOString(),
      };
      const updated = [entry, ...notes];
      await writeWife<Note[]>("Observations", updated, passphrase);
      setNotes(updated);
      setDraft("");
      textareaRef.current?.focus();
    } finally {
      setIsSaving(false);
    }
  }, [draft, isSaving, notes, passphrase]);

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* textarea بلا عنوان — placeholder محايد */}
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={isSaving}
        placeholder="…"
        rows={3}
        className="w-full resize-none rounded-xl border-2 border-stone-200 bg-white/80 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-300 focus:border-teal-400 focus:outline-none transition-colors leading-relaxed"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            handleSave();
          }
        }}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={!draft.trim() || isSaving}
        className="self-end rounded-xl py-2 px-5 text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
        style={{ background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)" }}
      >
        {isSaving ? "…" : "حفظ"}
      </button>

      {/* السجل السابق — بلا طابع توجيهي */}
      {notes.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-stone-100 bg-white/70 px-4 py-3 text-right"
            >
              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                {note.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── المكوّن الرئيسي ────────────────────────────────────────────────────────

export default function WifeDailyView({
  card,
  step,
  moodSelected,
  passphrase,
  onSkip,
  onMoodTap,
  onCardDone,
  onExerciseDone,
  onRatingSelected,
}: WifeDailyViewProps) {
  return (
    <div
      dir="rtl"
      className="flex flex-col gap-6 min-h-screen px-5 pt-10 pb-16 max-w-sm mx-auto"
    >
      {/* ── المزاج (اختياري، دائماً مرئي) ──────────────────────────────── */}
      <MoodTap selected={moodSelected} onTap={onMoodTap} />

      {/* ── منطقة البطاقة ────────────────────────────────────────────── */}
      {/*
        التجاوز (step="done") لا يُنتج أي عنصر جديد.
        لا شرط على (card !== null && step === "done") هنا — اختبار القبول ٤.
      */}
      {step === "card" && card && (
        <CardSection
          card={card}
          onSkip={onSkip}
          onCardDone={onCardDone}
          onExerciseDone={onExerciseDone}
        />
      )}

      {step === "rating" && (
        <RatingSection onSelect={onRatingSelected} />
      )}

      {/* ── سجل الملاحظات الحر (دائماً مرئي، بلا عنوان) ─────────────── */}
      {/* AmbientSerenityKey غائبة تماماً من هنا — الإعدادات فقط */}
      <div className="mt-2">
        <WifeNotesLog passphrase={passphrase} />
      </div>
    </div>
  );
}
