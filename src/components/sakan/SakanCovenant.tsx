"use client";

/**
 * Screen 3 — ميثاق سكن الكامل (معايير النجاح)
 *
 * Displayed AFTER the Week Zero questionnaire.
 * Redefines success for THIS PHASE ONLY:
 *   "النجاح هو الانتهاء من جلسة دون ألم، والشعور بالأمان،
 *    والرغبة في الجلوس معًا مرة أخرى."
 * Clarifies this is a phase limit, not the ceiling of the relationship.
 *
 * Architectural rules enforced:
 * - Forward-Focus: zero references to past failures.
 * - No guilt language — all covenant items use affirming, equitable phrasing.
 * - Phase boundary is explicit so neither partner misreads it as a permanent ceiling.
 */

import { useState } from "react";
import type { SakanRole } from "@/types/sakan";

interface Props {
  role: SakanRole;
  onAgree: () => void;
}

const covenantItems = [
  {
    icon: "🌱",
    text: "لن تُقاس هذه المرحلة بما حدث أو لم يحدث جسديًا.",
  },
  {
    icon: "🌿",
    text: "كل تقدم، مهما بدا صغيرًا، هو إنجاز حقيقي يستحق الاعتراف.",
  },
  {
    icon: "🕊️",
    text: "الشعور بالأمان المتبادل هو الأساس الذي تُبنى عليه كل خطوة تالية.",
  },
  {
    icon: "🤲",
    text: "لكل منكما الحق في التوقف أو التمهّل في أي لحظة، دون تفسير.",
  },
  {
    icon: "🔭",
    text: "هذه المرحلة لها حدودها الطبيعية، والمراحل التالية مفتوحة على قدر ما تنضجان معًا.",
  },
] as const;

export default function SakanCovenant({ role, onAgree }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  function toggleItem(i: number) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function handleAgree() {
    setAgreed(true);
    // Small delay so the visual confirmation is visible before advancing
    setTimeout(onAgree, 900);
  }

  const allChecked = checkedItems.size === covenantItems.length;

  const pronoun = role === "wife" ? "أنا أوافق على هذا الميثاق" : "أنا أوافق على هذا الميثاق";

  return (
    <div className="flex flex-col items-center justify-start min-h-screen px-6 py-10 gap-8 max-w-lg mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="text-center space-y-3">
        <div
          aria-hidden
          className="text-4xl"
        >
          🌸
        </div>
        <h1 className="text-xl font-bold text-stone-800">
          ميثاق سَكَن
        </h1>
        <p className="text-sm text-stone-500">
          معايير النجاح في هذه المرحلة
        </p>
      </div>

      {/* ── Core success redefinition ───────────────────────────────────── */}
      <section
        className="w-full rounded-2xl p-6 shadow-md border"
        style={{
          background:
            "linear-gradient(135deg, rgba(107,127,120,0.12) 0%, rgba(92,110,104,0.08) 100%)",
          borderColor: "rgba(107,127,120,0.3)",
        }}
      >
        <p className="text-sm text-stone-500 mb-3 font-medium uppercase tracking-wide">
          النجاح في هذه المرحلة هو…
        </p>
        <blockquote className="text-lg font-bold text-stone-800 leading-relaxed text-center border-r-4 pr-4"
          style={{ borderColor: "#6b7f78" }}
        >
          الانتهاء من جلسة دون ألم،
          <br />
          والشعور بالأمان،
          <br />
          والرغبة في الجلوس معًا مرة أخرى.
        </blockquote>

        {/* Phase boundary clarification */}
        <div className="mt-5 bg-white/60 rounded-xl p-4 border border-stone-200">
          <p className="text-sm text-stone-600 leading-relaxed">
            <span className="font-semibold text-stone-700">ملاحظة مهمة:</span>{" "}
            هذا ليس سقف علاقتكما، بل هو بداية مرحلتها الأولى. المراحل
            التالية مفتوحة وستُكشف بحسب إيقاعكما أنتما.
          </p>
        </div>
      </section>

      {/* ── Covenant items ─────────────────────────────────────────────── */}
      <section className="w-full space-y-3">
        <h2 className="text-sm font-semibold text-stone-600 mb-1">
          بنود الميثاق — اضغط على كل بند لتأكيد استيعابه:
        </h2>
        {covenantItems.map((item, i) => {
          const checked = checkedItems.has(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggleItem(i)}
              aria-pressed={checked}
              className={[
                "w-full flex items-start gap-4 rounded-xl p-4 text-right transition-all duration-200 border focus-visible:outline-none focus-visible:ring-2",
                checked
                  ? "border-teal-200 bg-teal-50 shadow-sm"
                  : "border-stone-200 bg-white/70 hover:bg-stone-50",
              ].join(" ")}
            >
              {/* Checkmark */}
              <div
                className={[
                  "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all duration-200",
                  checked
                    ? "border-teal-600 bg-teal-600"
                    : "border-stone-300 bg-white",
                ].join(" ")}
                aria-hidden
              >
                {checked && (
                  <svg viewBox="0 0 12 10" className="w-3 h-3 fill-white">
                    <path d="M1 5l3 3 7-7" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              {/* Content */}
              <div className="flex items-start gap-2">
                <span aria-hidden className="text-base leading-none mt-0.5">
                  {item.icon}
                </span>
                <p
                  className={[
                    "text-sm leading-relaxed",
                    checked ? "text-teal-800 font-medium" : "text-stone-700",
                  ].join(" ")}
                >
                  {item.text}
                </p>
              </div>
            </button>
          );
        })}
      </section>

      {/* ── Encourage checking all ─────────────────────────────────────── */}
      {!allChecked && (
        <p className="text-xs text-stone-400 text-center -mt-2">
          اضغط على كل بند لتأكيد استيعابه قبل الموافقة
        </p>
      )}

      {/* ── Agreement button ───────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleAgree}
        disabled={agreed}
        className={[
          "w-full max-w-xs rounded-xl px-6 py-4 font-semibold text-base shadow-md transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 mb-8",
          agreed
            ? "bg-teal-600 text-white scale-95 cursor-not-allowed"
            : allChecked
            ? "text-white hover:opacity-90 active:scale-95 cursor-pointer"
            : "text-white opacity-70 cursor-pointer",
        ].join(" ")}
        style={
          !agreed
            ? {
                background:
                  "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)",
              }
            : undefined
        }
        aria-label="الموافقة على ميثاق سكن"
      >
        {agreed ? "✓ تم الاتفاق — شكرًا لك" : pronoun}
      </button>

      {/* ── Reassurance footer ─────────────────────────────────────────── */}
      <p className="text-xs text-stone-400 text-center pb-6 max-w-xs leading-relaxed -mt-4">
        يمكنك العودة إلى هذا الميثاق في أي وقت من قائمة الإعدادات.
        هو مرجع لكما، لا التزام قانوني.
      </p>
    </div>
  );
}
