"use client";

/**
 * Sakan (سَكَن) — Husband Daily View
 *
 * ██ HUSBAND-ONLY COMPONENT ██
 * Must never be rendered in the wife's session.
 *
 * مكوّن عرض نقي — كل حالته تأتي من الوالد (page shell).
 * لا استدعاء IndexedDB مباشر هنا (باستثناء ما يعمل داخل HusbandObservationLog
 * وAngerPredictabilityPlan اللذين يديران تخزينهما بشكل مستقل).
 *
 * ─── قواعد ملزمة ──────────────────────────────────────────────────────────────
 * - لا عدّادات، لا سلاسل، لا نسب إنجاز في أي عنصر (SPEC Rule 4)
 * - تجاوز البطاقة (step="done") لا يُنتج أي عنصر جديد (اختبار القبول ٤)
 * - لا إشارة إلى حالة مفتاح الزوجة أو نشاطها (SPEC Rule 2)
 */

import HusbandObservationLog from "@/components/sakan/HusbandObservationLog";
import AngerPredictabilityPlan from "@/components/sakan/AngerPredictabilityPlan";
import type { Card, HusbandState } from "@/types/sakan";
import { useState } from "react";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export type DailyStep = "card" | "rating" | "done";

export interface HusbandDailyViewProps {
  /** البطاقة المختارة — null تعني لا بطاقة متاحة (لا تُنتج أي عنصر مختلف). */
  card: Card | null;
  /** الخطوة الحالية — يتحكم فيها الوالد (page shell). */
  step: DailyStep;
  /** المزاج المختار (اختياري، مخزَّن مؤقتاً في الذاكرة فقط). */
  moodSelected: string | null;
  /** عبارة مرور جلسة الزوج — تُمرَّر إلى المكوّنات الفرعية. */
  passphrase: string;
  /** حالة الزوج (earnedLevel، إلخ) — للعرض المستقبلي. */
  husbandState: HusbandState;
  /** تُستدعى عند التجاوز الصامت. */
  onSkip: () => void;
  /** تُستدعى عند النقر على مزاج. */
  onMoodTap: (mood: string) => void;
  /** تُستدعى عند الانتهاء من بطاقة غير تمرين. */
  onCardDone: () => void;
  /** تُستدعى عند الانتهاء من تمرين — يُحوّل step إلى "rating". */
  onExerciseDone: () => void;
  /** تُستدعى عند اختيار تقييم الراحة. */
  onRatingSelected: (r: 1 | 2 | 3 | 4 | 5) => void;
}

// ─── الوحدات المساعدة ───────────────────────────────────────────────────────

const MOOD_OPTIONS = [
  { emoji: "😌", key: "calm" },
  { emoji: "😔", key: "heavy" },
  { emoji: "🌀", key: "tense" },
] as const;

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

// ─── قسم المزاج (اختياري) ──────────────────────────────────────────────────

function MoodTap({
  selected,
  onTap,
}: {
  selected: string | null;
  onTap: (key: string) => void;
}) {
  return (
    <div className="flex justify-center gap-6 py-2" aria-label="كيف تشعر الآن؟">
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
      {/* نص البطاقة */}
      <p className="text-base text-stone-800 leading-loose text-right whitespace-pre-wrap">
        {card.body}
      </p>

      {/* أزرار التفاعل */}
      <div className="flex gap-3 justify-start flex-row-reverse">
        {/* تجاوز صامت — بلا تغذية راجعة */}
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-stone-400 hover:text-stone-600 px-3 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300"
        >
          تجاوز
        </button>

        {/* انتهيت */}
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
        كيف تشعر بعد هذا التمرين؟
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

// ─── قسم خطة الغضب (قابل للطي) ────────────────────────────────────────────

function AngerPlanSection({ passphrase }: { passphrase: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 rounded-lg py-1"
      >
        <span className="text-base" aria-hidden>🚪</span>
        <span>خطة إدارة الغضب</span>
        <span className="text-xs text-stone-400 mr-auto">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3">
          <AngerPredictabilityPlan passphrase={passphrase} />
        </div>
      )}
    </div>
  );
}

// ─── المكوّن الرئيسي ────────────────────────────────────────────────────────

export default function HusbandDailyView({
  card,
  step,
  moodSelected,
  passphrase,
  onSkip,
  onMoodTap,
  onCardDone,
  onExerciseDone,
  onRatingSelected,
}: HusbandDailyViewProps) {
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
        لا يوجد شرط على (card !== null && step === "done") هنا — اختبار القبول ٤.
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

      {/* ── سجل الملاحظات (دائماً مرئي) ──────────────────────────────── */}
      <div className="mt-2">
        <HusbandObservationLog passphrase={passphrase} />
      </div>

      {/* ── خطة الغضب (قابلة للطي) ───────────────────────────────────── */}
      <AngerPlanSection passphrase={passphrase} />
    </div>
  );
}
