"use client";

/**
 * Screen 2 — أسئلة أسبوع صفر
 *
 * Renders the correct questionnaire (wife or husband) based on the active role.
 * Each question type has its own input component.
 * All answers are held in local state only; no network calls in Phase 1.
 *
 * Architectural rules enforced:
 * - Separate form per role — the wrong questionnaire is never rendered.
 * - Every question is skippable (optional flag + explicit "تخطي" affordance).
 * - No guilt or shame language; scale anchors are descriptive, not judgemental.
 */

import { useState } from "react";
import type { AnswerMap, SakanRole } from "@/types/sakan";
import type {
  SakanQuestion,
  ScaleQuestion,
  RadioQuestion,
  MultiSelectQuestion,
  TextareaQuestion,
} from "@/types/sakan";
import { getQuestionnaire } from "@/data/sakan/questionnaires";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  role: SakanRole;
  onComplete: (answers: AnswerMap) => void;
}

// ─── Scale input ──────────────────────────────────────────────────────────────

function ScaleInput({
  question,
  value,
  onChange,
}: {
  question: ScaleQuestion;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const steps = [1, 2, 3, 4, 5] as const;

  return (
    <div className="space-y-4">
      {/* Dot track */}
      <div className="flex items-center justify-between gap-2">
        {steps.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`${n} من 5`}
              aria-pressed={selected}
              className={[
                "flex-1 rounded-xl py-3 text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                selected
                  ? "text-white shadow-md"
                  : "bg-stone-100 text-stone-500 hover:bg-stone-200",
              ].join(" ")}
              style={
                selected
                  ? {
                      background:
                        "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)",
                    }
                  : {}
              }
            >
              {n}
            </button>
          );
        })}
      </div>
      {/* Labels */}
      <div className="flex justify-between text-xs text-stone-400 px-1">
        <span>{question.minLabel}</span>
        <span>{question.maxLabel}</span>
      </div>
    </div>
  );
}

// ─── Radio input ──────────────────────────────────────────────────────────────

function RadioInput({
  question,
  value,
  onChange,
}: {
  question: RadioQuestion;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      {question.options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={[
              "flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-all duration-150 border",
              selected
                ? "border-teal-600 bg-teal-50"
                : "border-stone-200 bg-stone-50 hover:bg-stone-100",
            ].join(" ")}
          >
            <input
              type="radio"
              name={question.id}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="accent-teal-700 w-4 h-4 shrink-0"
            />
            <span
              className={[
                "text-sm",
                selected ? "text-teal-800 font-medium" : "text-stone-600",
              ].join(" ")}
            >
              {opt.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// ─── Multiselect input ────────────────────────────────────────────────────────

function MultiSelectInput({
  question,
  value,
  onChange,
}: {
  question: MultiSelectQuestion;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(optValue: string) {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  }

  return (
    <div className="space-y-2">
      {question.options.map((opt) => {
        const checked = value.includes(opt.value);
        return (
          <label
            key={opt.value}
            className={[
              "flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-all duration-150 border",
              checked
                ? "border-teal-600 bg-teal-50"
                : "border-stone-200 bg-stone-50 hover:bg-stone-100",
            ].join(" ")}
          >
            <input
              type="checkbox"
              value={opt.value}
              checked={checked}
              onChange={() => toggle(opt.value)}
              className="accent-teal-700 w-4 h-4 shrink-0 rounded"
            />
            <span
              className={[
                "text-sm",
                checked ? "text-teal-800 font-medium" : "text-stone-600",
              ].join(" ")}
            >
              {opt.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// ─── Textarea input ───────────────────────────────────────────────────────────

function TextareaInput({
  question,
  value,
  onChange,
}: {
  question: TextareaQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={question.placeholder ?? "اكتب هنا..."}
      rows={3}
      className="w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700 placeholder-stone-400 resize-none focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600 transition-all"
      dir="rtl"
    />
  );
}

// ─── Single question card ─────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  total,
  answers,
  onAnswer,
}: {
  question: SakanQuestion;
  index: number;
  total: number;
  answers: AnswerMap;
  onAnswer: (id: string, value: AnswerMap[string]) => void;
}) {
  const rawValue = answers[question.id] ?? null;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-stone-200 w-full space-y-4">
      {/* Progress hint */}
      <p className="text-xs text-stone-400 font-medium">
        السؤال {index + 1} من {total}
        {question.optional && (
          <span className="mr-2 text-amber-500">• اختياري</span>
        )}
      </p>

      {/* Question text */}
      <p className="text-base font-semibold text-stone-800 leading-relaxed">
        {question.text}
      </p>

      {/* Note */}
      {question.note && (
        <p className="text-xs text-stone-400 leading-relaxed bg-stone-50 rounded-lg px-3 py-2 border border-stone-100">
          {question.note}
        </p>
      )}

      {/* Input by type */}
      {question.type === "scale" && (
        <ScaleInput
          question={question as ScaleQuestion}
          value={typeof rawValue === "number" ? rawValue : null}
          onChange={(v) => onAnswer(question.id, v)}
        />
      )}

      {question.type === "radio" && (
        <RadioInput
          question={question as RadioQuestion}
          value={typeof rawValue === "string" ? rawValue : null}
          onChange={(v) => onAnswer(question.id, v)}
        />
      )}

      {question.type === "multiselect" && (
        <MultiSelectInput
          question={question as MultiSelectQuestion}
          value={Array.isArray(rawValue) ? (rawValue as string[]) : []}
          onChange={(v) => onAnswer(question.id, v)}
        />
      )}

      {question.type === "textarea" && (
        <TextareaInput
          question={question as TextareaQuestion}
          value={typeof rawValue === "string" ? rawValue : ""}
          onChange={(v) => onAnswer(question.id, v)}
        />
      )}

      {/* Skip affordance for non-optional questions too — all are skippable */}
      <button
        type="button"
        onClick={() => onAnswer(question.id, null)}
        className="text-xs text-stone-400 hover:text-stone-500 underline underline-offset-2 transition-colors"
        aria-label={`تخطي السؤال ${index + 1}`}
      >
        تخطي هذا السؤال
      </button>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function WeekZeroForm({ role, onComplete }: Props) {
  const questionnaire = getQuestionnaire(role);
  const { questions, title, subtitle } = questionnaire;

  const [answers, setAnswers] = useState<AnswerMap>({});

  function handleAnswer(id: string, value: AnswerMap[string]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function handleSubmit() {
    onComplete(answers);
  }

  // Count answered (non-null, non-empty) questions for the progress bar
  const answeredCount = questions.filter((q) => {
    const v = answers[q.id];
    if (v === null || v === undefined) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "string") return v.trim().length > 0;
    return true;
  }).length;

  const progressPct = Math.round((answeredCount / questions.length) * 100);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen px-6 py-10 gap-6 max-w-lg mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="text-center space-y-2 w-full">
        <h1 className="text-xl font-bold text-stone-800">{title}</h1>
        <p className="text-sm text-stone-500 leading-relaxed">{subtitle}</p>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────── */}
      <div className="w-full space-y-1">
        <div
          className="h-1.5 rounded-full bg-stone-200 overflow-hidden"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="تقدم الاستبيان"
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #6b7f78, #5c6e68)",
            }}
          />
        </div>
        <p className="text-xs text-stone-400 text-left" dir="ltr">
          {answeredCount}/{questions.length}
        </p>
      </div>

      {/* ── Questions ──────────────────────────────────────────────────── */}
      <div className="w-full space-y-4">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={i}
            total={questions.length}
            answers={answers}
            onAnswer={handleAnswer}
          />
        ))}
      </div>

      {/* ── Skip-all reminder ──────────────────────────────────────────── */}
      <div className="bg-amber-50/80 border border-amber-100 rounded-xl px-4 py-3 w-full">
        <p className="text-xs text-amber-700 leading-relaxed">
          🕊️ يمكنك المتابعة دون الإجابة عن أي سؤال. كل إجابة تختارها هي
          خطوة لصالحك أنت.
        </p>
      </div>

      {/* ── Submit ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleSubmit}
        className="w-full max-w-xs rounded-xl px-6 py-4 text-white font-semibold text-base shadow-md transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 mb-8"
        style={{
          background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)",
        }}
        aria-label="إنهاء الاستبيان والمتابعة"
      >
        أكملتُ الاستبيان، تابِع
      </button>
    </div>
  );
}
