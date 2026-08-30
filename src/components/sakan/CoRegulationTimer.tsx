"use client";

/**
 * Sakan (سَكَن) — Co-Regulation Presence Timer (مؤقت الوجود المشترك الصامت)
 *
 * A 15-minute (900-second) ambient visual timer for the "Presence without
 * Pressure" phase of couples co-regulation.
 *
 * Clinical design rules (MUST NOT be violated):
 * ───────────────────────────────────────────────
 * 1. ABSOLUTELY NO NUMBERS OR COUNTDOWNS rendered anywhere in the DOM.
 *    Time passes only as a visual filling ring. `elapsedSeconds` lives
 *    exclusively in state; it is never cast to a string for display.
 * 2. NO alarm sound, NO chime, NO vibration pattern on completion.
 *    Completion is signalled by a slow colour glow on the ring — that's it.
 * 3. No aggressive colours (red, orange, bright yellow).
 *    Progress ring: calm sage (#6b7f78 → #a3b18a on completion).
 * 4. Pause and reset are available with a neutral label — "توقف مؤقت" and
 *    "بدء من جديد". Neither implies failure or punishment.
 *
 * Arabic copy (exact, per spec):
 *   "المطلوب الآن: لا شيء. فقط كونا في نفس المكان بأمان."
 */

import { useEffect, useRef, useReducer, useCallback } from "react";
import type { CoRegTimerPhase, CoRegTimerState } from "@/types/sakan";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TOTAL_SECONDS = 15 * 60; // 900

// SVG ring geometry
const SVG_SIZE = 280;
const CX = SVG_SIZE / 2;   // 140
const CY = SVG_SIZE / 2;   // 140
const RADIUS = 118;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 741.42

// ─── State machine ────────────────────────────────────────────────────────────

type TimerAction =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESET" }
  | { type: "TICK" };

function timerReducer(
  state: CoRegTimerState,
  action: TimerAction
): CoRegTimerState {
  switch (action.type) {
    case "START":
      if (state.phase === "complete") return state; // completed rings don't restart
      return { ...state, phase: "running" };
    case "PAUSE":
      if (state.phase !== "running") return state;
      return { ...state, phase: "idle" };
    case "RESET":
      return { phase: "idle", elapsedSeconds: 0, totalSeconds: state.totalSeconds };
    case "TICK": {
      if (state.phase !== "running") return state;
      const next = state.elapsedSeconds + 1;
      if (next >= state.totalSeconds) {
        return { ...state, elapsedSeconds: state.totalSeconds, phase: "complete" };
      }
      return { ...state, elapsedSeconds: next };
    }
    default:
      return state;
  }
}

// ─── SVG Progress Ring ────────────────────────────────────────────────────────

interface RingProps {
  progress: number;   // 0 → 1
  phase: CoRegTimerPhase;
}

function ProgressRing({ progress, phase }: RingProps) {
  const offset = CIRCUMFERENCE * (1 - progress);
  const isComplete = phase === "complete";
  const isRunning = phase === "running";

  // Ring colour: resting=stone, running=sage, complete=warm-sage (animated via CSS class)
  const strokeColor = isComplete
    ? "#a3b18a"
    : isRunning
    ? "#6b7f78"
    : "#d6d3d1";

  // Smooth transition while counting — but NOT when complete (CSS keyframe takes over)
  const strokeTransition = isComplete ? "none" : "stroke-dashoffset 1.05s linear";

  return (
    <svg
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      width={SVG_SIZE}
      height={SVG_SIZE}
      role="img"
      aria-label="مؤقت الوجود الصامت"
      className="block"
    >
      {/* Background track */}
      <circle
        cx={CX}
        cy={CY}
        r={RADIUS}
        fill="none"
        stroke="#e7e5e4"
        strokeWidth="10"
      />

      {/* Progress arc — starts at 12 o'clock, fills clockwise */}
      <circle
        cx={CX}
        cy={CY}
        r={RADIUS}
        fill="none"
        stroke={strokeColor}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ transition: strokeTransition }}
        className={isComplete ? "cr-ring-complete" : ""}
      />

      {/* Centre motif: a small botanical dot — purely decorative, no numbers */}
      <circle
        cx={CX}
        cy={CY}
        r="6"
        fill={isComplete ? "#a3b18a" : isRunning ? "#6b7f78" : "#d6d3d1"}
        style={{ transition: "fill 2s ease" }}
        aria-hidden="true"
      />
      {/* Three petal hints at the centre — echo of the Serenity Key motif */}
      {[0, 120, 240].map((deg) => (
        <ellipse
          key={deg}
          cx={CX}
          cy={CY - 14}
          rx="2.8"
          ry="5"
          fill={isComplete ? "#a3b18a" : isRunning ? "#6b7f78" : "#d6d3d1"}
          transform={`rotate(${deg} ${CX} ${CY})`}
          style={{ transition: "fill 2s ease" }}
          aria-hidden="true"
        />
      ))}
    </svg>
  );
}

// ─── Control buttons ──────────────────────────────────────────────────────────

interface ControlsProps {
  phase: CoRegTimerPhase;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

function Controls({ phase, onStart, onPause, onReset }: ControlsProps) {
  const btnBase =
    "rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 active:scale-95";

  if (phase === "complete") {
    return (
      <button
        type="button"
        onClick={onReset}
        className={`${btnBase} bg-stone-100 text-stone-600 hover:bg-stone-200`}
        aria-label="بدء جلسة جديدة"
      >
        بدء من جديد
      </button>
    );
  }

  if (phase === "running") {
    return (
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPause}
          className={`${btnBase} bg-stone-100 text-stone-600 hover:bg-stone-200`}
          aria-label="توقف مؤقت"
        >
          توقف مؤقت
        </button>
        <button
          type="button"
          onClick={onReset}
          className={`${btnBase} bg-stone-50 text-stone-400 hover:bg-stone-100 text-xs`}
          aria-label="إلغاء وإعادة الضبط"
        >
          إعادة الضبط
        </button>
      </div>
    );
  }

  // phase === "idle"
  return (
    <button
      type="button"
      onClick={onStart}
      className={`${btnBase} text-white shadow-sm hover:opacity-90`}
      style={{ background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)" }}
      aria-label="بدء مؤقت الوجود المشترك"
    >
      بدء
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  /** Override total duration for testing (default: 900 seconds = 15 min). */
  totalSeconds?: number;
  /** Callback fired once when the timer reaches 100% completion. */
  onComplete?: () => void;
  className?: string;
}

export default function CoRegulationTimer({
  totalSeconds = DEFAULT_TOTAL_SECONDS,
  onComplete,
  className = "",
}: Props) {
  const [state, dispatch] = useReducer(timerReducer, {
    phase: "idle",
    elapsedSeconds: 0,
    totalSeconds,
  } satisfies CoRegTimerState);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Tick every second when running
  useEffect(() => {
    if (state.phase !== "running") return;

    const id = setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  // Fire onComplete exactly once
  const completedRef = useRef(false);
  useEffect(() => {
    if (state.phase === "complete" && !completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current?.();
    }
    if (state.phase === "idle" && state.elapsedSeconds === 0) {
      completedRef.current = false; // reset on full reset
    }
  }, [state.phase, state.elapsedSeconds]);

  const progress = state.elapsedSeconds / state.totalSeconds;

  const handleStart  = useCallback(() => dispatch({ type: "START" }), []);
  const handlePause  = useCallback(() => dispatch({ type: "PAUSE" }), []);
  const handleReset  = useCallback(() => dispatch({ type: "RESET" }), []);

  return (
    <div
      className={`flex flex-col items-center gap-8 select-none ${className}`}
      dir="rtl"
    >
      {/* ── SVG Ring ────────────────────────────────────────────────────── */}
      <div className="relative">
        <ProgressRing progress={progress} phase={state.phase} />

        {/* Completion ambient overlay — fade in only on complete */}
        {state.phase === "complete" && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none cr-complete-text"
            aria-hidden="true"
          >
            <span className="text-4xl">🌸</span>
          </div>
        )}
      </div>

      {/* ── Mandatory Arabic copy (spec: exact text) ────────────────────── */}
      <p
        className="text-base text-stone-600 leading-relaxed text-center max-w-xs font-medium"
        style={{ fontFamily: "var(--font-cairo), serif" }}
      >
        المطلوب الآن: لا شيء.{" "}
        <span className="text-stone-500 font-normal">
          فقط كونا في نفس المكان بأمان.
        </span>
      </p>

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <Controls
        phase={state.phase}
        onStart={handleStart}
        onPause={handlePause}
        onReset={handleReset}
      />

      {/* ── Completion message (no numbers, no explicit "time's up") ─────── */}
      {state.phase === "complete" && (
        <p
          className="text-sm text-stone-500 text-center max-w-xs leading-relaxed cr-complete-text"
          style={{ animationDelay: "0.6s", opacity: 0 }}
        >
          كنتما معًا. هذا وحده يكفي.
        </p>
      )}
    </div>
  );
}
