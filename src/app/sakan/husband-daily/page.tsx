"use client";

/**
 * Sakan (سَكَن) — Husband Daily Page (الصفحة اليومية للزوج)
 *
 * ██ HUSBAND-ONLY PAGE ██
 * هذه الصفحة للزوج فقط. لا تُعرض للزوجة ولا تعرف عن حالة مفتاحها.
 *
 * ─── مسار البيانات ────────────────────────────────────────────────────────────
 * ١. يقرأ HusbandState من IndexedDB (ولا شيء من مخزن الزوجة)
 * ٢. يحسب السقف عبر computeCeiling (بلا keyState — ضمان بنيوي)
 * ٣. يختار بطاقة عبر selectCard
 * ٤. يُمرّر كل شيء إلى HusbandDailyView (مكوّن عرض نقي)
 *
 * ─── عدم التناظر بين المخازن ──────────────────────────────────────────────────
 * الزوج لا يقرأ من مخزن الزوجة ولا يكتب فيه.
 * اختبار القبول ٢ (المستوى الثاني) يؤكد هذا الضمان بالعرض.
 */

import { useReducer, useEffect, useCallback } from "react";
import type { HusbandState, SessionSignal, Card } from "@/types/sakan";
import { readHusband, writeHusband } from "@/lib/sakan/idb";
import { computeCeiling, selectCard, applySessionSignal } from "@/lib/sakan/engine";
import { ALL_CARDS } from "@/lib/sakan/cards";
import HusbandDailyView, { type DailyStep } from "@/components/sakan/HusbandDailyView";

// ─── حالة الصفحة ────────────────────────────────────────────────────────────

interface PageState {
  /** null = جارٍ التحميل، undefined = لا عبارة مرور بعد. */
  passphrase: string | null;
  passphraseInput: string;
  husbandState: HusbandState | null;
  card: Card | null;
  step: DailyStep;
  moodSelected: string | null;
  shownCardIds: Set<string>;
  lastCardId: string | undefined;
  isLoading: boolean;
  error: string | null;
}

const INITIAL_STATE: PageState = {
  passphrase: null,
  passphraseInput: "",
  husbandState: null,
  card: null,
  step: "done",
  moodSelected: null,
  shownCardIds: new Set(),
  lastCardId: undefined,
  isLoading: false,
  error: null,
};

const DEFAULT_HUSBAND_STATE: HusbandState = {
  shame: 50,
  earnedCeilingLevel: 0,
  consecutivePositiveSessions: 0,
  updatedAt: new Date().toISOString(),
};

type Action =
  | { type: "SET_INPUT"; value: string }
  | { type: "LOAD_START" }
  | { type: "LOAD_DONE"; passphrase: string; husbandState: HusbandState; card: Card | null }
  | { type: "LOAD_ERROR"; message: string }
  | { type: "SET_MOOD"; mood: string }
  | { type: "SKIP" }
  | { type: "CARD_DONE" }
  | { type: "EXERCISE_DONE" }
  | { type: "RATING_SELECTED"; rating: 1 | 2 | 3 | 4 | 5 }
  | { type: "STATE_SAVED"; husbandState: HusbandState };

function reducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, passphraseInput: action.value };

    case "LOAD_START":
      return { ...state, isLoading: true, error: null };

    case "LOAD_DONE": {
      const shown = new Set(state.shownCardIds);
      if (action.card) shown.add(action.card.id);
      return {
        ...state,
        passphrase: action.passphrase,
        husbandState: action.husbandState,
        card: action.card,
        step: action.card ? "card" : "done",
        shownCardIds: shown,
        lastCardId: action.card?.id,
        isLoading: false,
      };
    }

    case "LOAD_ERROR":
      return { ...state, isLoading: false, error: action.message };

    case "SET_MOOD":
      return { ...state, moodSelected: action.mood };

    case "SKIP":
      // صامت — step="done" فقط، لا عنصر جديد (اختبار القبول ٤)
      return { ...state, step: "done" };

    case "CARD_DONE":
      return { ...state, step: "done" };

    case "EXERCISE_DONE":
      return { ...state, step: "rating" };

    case "RATING_SELECTED":
      return { ...state, step: "done" };

    case "STATE_SAVED":
      return { ...state, husbandState: action.husbandState };

    default:
      return state;
  }
}

// ─── دالة التحميل ───────────────────────────────────────────────────────────

async function loadSession(
  passphrase: string,
  shownCardIds: Set<string>,
  lastCardId: string | undefined,
): Promise<{ husbandState: HusbandState; card: Card | null }> {
  const stored = await readHusband<HusbandState>("State", passphrase);
  const husbandState = stored ?? { ...DEFAULT_HUSBAND_STATE, updatedAt: new Date().toISOString() };

  const ceiling = computeCeiling({
    role: "husband",
    shame: husbandState.shame,
    earnedLevel: husbandState.earnedCeilingLevel,
  });

  const card = selectCard({
    role: "husband",
    ceiling,
    cards: ALL_CARDS,
    shame: husbandState.shame,
    flags: [],
    shownCardIds,
    lastCardId,
  });

  return { husbandState, card };
}

// ─── مربع عبارة المرور ──────────────────────────────────────────────────────

function PassphraseGate({
  value,
  isLoading,
  error,
  onChange,
  onSubmit,
}: {
  value: string;
  isLoading: boolean;
  error: string | null;
  onChange: (v: string) => void;
  onSubmit: (pp: string) => void;
}) {
  return (
    <div
      dir="rtl"
      className="flex flex-col items-center justify-center min-h-screen px-6 gap-8 max-w-sm mx-auto"
    >
      <div className="text-center space-y-2">
        <div
          className="text-5xl font-bold leading-none select-none"
          style={{ color: "#6b7f78", fontFamily: "var(--font-cairo), serif" }}
        >
          سَكَن
        </div>
      </div>

      <form
        className="w-full flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="عبارة المرور"
          autoComplete="current-password"
          className="w-full rounded-xl border-2 border-stone-200 bg-white/80 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-teal-400 focus:outline-none transition-colors text-right"
        />
        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}
        <button
          type="submit"
          disabled={!value.trim() || isLoading}
          className="w-full rounded-xl px-6 py-3 text-white font-semibold text-sm shadow-sm transition-all duration-200 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #6b7f78 0%, #5c6e68 100%)" }}
        >
          {isLoading ? "…" : "دخول"}
        </button>
      </form>
    </div>
  );
}

// ─── الصفحة ─────────────────────────────────────────────────────────────────

export default function HusbandDailyPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // عند التحميل: ابحث عن عبارة مرور في sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cached = window.sessionStorage.getItem("s.pp");
      if (cached) {
        dispatch({ type: "LOAD_START" });
        loadSession(cached, state.shownCardIds, state.lastCardId).then(
          ({ husbandState, card }) => {
            dispatch({ type: "LOAD_DONE", passphrase: cached, husbandState, card });
          },
          () => {
            // عبارة المرور المخزَّنة لم تعد صالحة
            window.sessionStorage.removeItem("s.pp");
          }
        );
      }
    } catch {
      // sessionStorage محجوب
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePassphraseSubmit = useCallback(
    async (pp: string) => {
      dispatch({ type: "LOAD_START" });
      try {
        const { husbandState, card } = await loadSession(
          pp,
          state.shownCardIds,
          state.lastCardId
        );
        // خزِّن في sessionStorage (يُمسح تلقائياً عند إغلاق المتصفح)
        try {
          window.sessionStorage.setItem("s.pp", pp);
        } catch { /* صامت */ }
        dispatch({ type: "LOAD_DONE", passphrase: pp, husbandState, card });
      } catch {
        dispatch({ type: "LOAD_ERROR", message: "عبارة المرور غير صحيحة" });
      }
    },
    [state.shownCardIds, state.lastCardId]
  );

  const handleRatingSelected = useCallback(
    async (rating: 1 | 2 | 3 | 4 | 5) => {
      dispatch({ type: "RATING_SELECTED", rating });

      const { passphrase, husbandState, card } = state;
      if (!passphrase || !husbandState || !card) return;

      const signal: SessionSignal = {
        cardId: card.id,
        response: "accepted",
        comfortRating: rating,
        durationSec: 0, // لا يُتتبع في Phase 1
        recordedAt: new Date().toISOString(),
      };

      const newCeiling = applySessionSignal(
        {
          earnedLevel: husbandState.earnedCeilingLevel,
          consecutivePositiveSessions: husbandState.consecutivePositiveSessions,
        },
        signal,
        card.intensity,
      );

      const updated: HusbandState = {
        ...husbandState,
        earnedCeilingLevel: newCeiling.earnedLevel,
        consecutivePositiveSessions: newCeiling.consecutivePositiveSessions,
        updatedAt: new Date().toISOString(),
      };

      await writeHusband<HusbandState>("State", updated, passphrase);
      dispatch({ type: "STATE_SAVED", husbandState: updated });
    },
    [state]
  );

  const handleSkip = useCallback(async () => {
    dispatch({ type: "SKIP" });

    const { passphrase, husbandState, card } = state;
    if (!passphrase || !husbandState || !card || card.intensity < 1) return;

    const signal: SessionSignal = {
      cardId: card.id,
      response: "skipped",
      durationSec: 0,
      recordedAt: new Date().toISOString(),
    };

    const newCeiling = applySessionSignal(
      {
        earnedLevel: husbandState.earnedCeilingLevel,
        consecutivePositiveSessions: husbandState.consecutivePositiveSessions,
      },
      signal,
      card.intensity,
    );

    const updated: HusbandState = {
      ...husbandState,
      earnedCeilingLevel: newCeiling.earnedLevel,
      consecutivePositiveSessions: newCeiling.consecutivePositiveSessions,
      updatedAt: new Date().toISOString(),
    };

    await writeHusband<HusbandState>("State", updated, passphrase);
    dispatch({ type: "STATE_SAVED", husbandState: updated });
  }, [state]);

  // ─── عرض ───────────────────────────────────────────────────────────────────

  if (state.isLoading && !state.passphrase) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div
          className="w-8 h-8 rounded-full border-2 border-stone-200"
          style={{ borderTopColor: "#6b7f78", animation: "spin 2s linear infinite" }}
          aria-label="جارٍ التحميل"
        />
      </div>
    );
  }

  if (!state.passphrase) {
    return (
      <PassphraseGate
        value={state.passphraseInput}
        isLoading={state.isLoading}
        error={state.error}
        onChange={(v) => dispatch({ type: "SET_INPUT", value: v })}
        onSubmit={handlePassphraseSubmit}
      />
    );
  }

  return (
    <HusbandDailyView
      card={state.card}
      step={state.step}
      moodSelected={state.moodSelected}
      passphrase={state.passphrase}
      husbandState={state.husbandState ?? DEFAULT_HUSBAND_STATE}
      onSkip={handleSkip}
      onMoodTap={(mood) => dispatch({ type: "SET_MOOD", mood })}
      onCardDone={() => dispatch({ type: "CARD_DONE" })}
      onExerciseDone={() => dispatch({ type: "EXERCISE_DONE" })}
      onRatingSelected={handleRatingSelected}
    />
  );
}
