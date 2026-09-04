"use client";

/**
 * Sakan (سَكَن) — Wife Daily Page (الصفحة اليومية للزوجة)
 *
 * ─── مسار البيانات ────────────────────────────────────────────────────────────
 * ١. يقرأ WifeState من IndexedDB
 * ٢. يقرأ KeyState عبر readKeyState (من AmbientSerenityKey) لحساب السقف
 * ٣. يحسب السقف عبر computeCeiling (مع keyState)
 * ٤. يختار بطاقة عبر selectCard
 * ٥. يُمرّر كل شيء إلى WifeDailyView (مكوّن عرض)
 *
 * ─── AmbientSerenityKey ──────────────────────────────────────────────────────
 * هذه الصفحة تقرأ حالة المفتاح (readKeyState) لحساب السقف فقط.
 * المكوّن المرئي (البتلات الزهرية) لا يظهر هنا — الإعدادات فقط.
 * بلا بادجة، بلا أثر بصري، بلا إشارة إلى المفتاح في هذه الصفحة.
 */

import { useReducer, useEffect, useCallback } from "react";
import type { WifeState, SessionSignal, Card, KeyState } from "@/types/sakan";
import { readWife, writeWife } from "@/lib/sakan/idb";
import { computeCeiling, selectCard, applySessionSignal } from "@/lib/sakan/engine";
import { ALL_CARDS } from "@/lib/sakan/cards";
import { readKeyState } from "@/components/sakan/AmbientSerenityKey";
import WifeDailyView, { type DailyStep } from "@/components/sakan/WifeDailyView";

// ─── حالة الصفحة ────────────────────────────────────────────────────────────

interface PageState {
  passphrase: string | null;
  passphraseInput: string;
  wifeState: WifeState | null;
  keyState: KeyState;
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
  wifeState: null,
  keyState: "locked",
  card: null,
  step: "done",
  moodSelected: null,
  shownCardIds: new Set(),
  lastCardId: undefined,
  isLoading: false,
  error: null,
};

const DEFAULT_WIFE_STATE: WifeState = {
  safety: 50,
  trust: 50,
  earnedCeilingLevel: 0,
  consecutivePositiveSessions: 0,
  updatedAt: new Date().toISOString(),
};

type Action =
  | { type: "SET_INPUT"; value: string }
  | { type: "LOAD_START" }
  | { type: "LOAD_DONE"; passphrase: string; wifeState: WifeState; keyState: KeyState; card: Card | null }
  | { type: "LOAD_ERROR"; message: string }
  | { type: "SET_MOOD"; mood: string }
  | { type: "SKIP" }
  | { type: "CARD_DONE" }
  | { type: "EXERCISE_DONE" }
  | { type: "RATING_SELECTED"; rating: 1 | 2 | 3 | 4 | 5 }
  | { type: "STATE_SAVED"; wifeState: WifeState };

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
        wifeState: action.wifeState,
        keyState: action.keyState,
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
      return { ...state, step: "done" };

    case "CARD_DONE":
      return { ...state, step: "done" };

    case "EXERCISE_DONE":
      return { ...state, step: "rating" };

    case "RATING_SELECTED":
      return { ...state, step: "done" };

    case "STATE_SAVED":
      return { ...state, wifeState: action.wifeState };

    default:
      return state;
  }
}

// ─── دالة التحميل ───────────────────────────────────────────────────────────

async function loadSession(
  passphrase: string,
  shownCardIds: Set<string>,
  lastCardId: string | undefined,
): Promise<{ wifeState: WifeState; keyState: KeyState; card: Card | null }> {
  const [stored, ks] = await Promise.all([
    readWife<WifeState>("State", passphrase),
    readKeyState(passphrase),
  ]);

  const wifeState = stored ?? { ...DEFAULT_WIFE_STATE, updatedAt: new Date().toISOString() };

  const ceiling = computeCeiling({
    role: "wife",
    keyState: ks,
    safety: wifeState.safety,
    earnedLevel: wifeState.earnedCeilingLevel,
  });

  const card = selectCard({
    role: "wife",
    ceiling,
    cards: ALL_CARDS,
    safety: wifeState.safety,
    flags: [],
    shownCardIds,
    lastCardId,
  });

  return { wifeState, keyState: ks, card };
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

export default function WifeDailyPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cached = window.sessionStorage.getItem("s.pp");
      if (cached) {
        dispatch({ type: "LOAD_START" });
        loadSession(cached, state.shownCardIds, state.lastCardId).then(
          ({ wifeState, keyState, card }) => {
            dispatch({ type: "LOAD_DONE", passphrase: cached, wifeState, keyState, card });
          },
          () => {
            window.sessionStorage.removeItem("s.pp");
          }
        );
      }
    } catch { /* sessionStorage محجوب */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePassphraseSubmit = useCallback(
    async (pp: string) => {
      dispatch({ type: "LOAD_START" });
      try {
        const { wifeState, keyState, card } = await loadSession(
          pp,
          state.shownCardIds,
          state.lastCardId
        );
        try { window.sessionStorage.setItem("s.pp", pp); } catch { /* صامت */ }
        dispatch({ type: "LOAD_DONE", passphrase: pp, wifeState, keyState, card });
      } catch {
        dispatch({ type: "LOAD_ERROR", message: "عبارة المرور غير صحيحة" });
      }
    },
    [state.shownCardIds, state.lastCardId]
  );

  const handleRatingSelected = useCallback(
    async (rating: 1 | 2 | 3 | 4 | 5) => {
      dispatch({ type: "RATING_SELECTED", rating });

      const { passphrase, wifeState, card } = state;
      if (!passphrase || !wifeState || !card) return;

      const signal: SessionSignal = {
        cardId: card.id,
        response: "accepted",
        comfortRating: rating,
        durationSec: 0,
        recordedAt: new Date().toISOString(),
      };

      const newCeiling = applySessionSignal(
        {
          earnedLevel: wifeState.earnedCeilingLevel,
          consecutivePositiveSessions: wifeState.consecutivePositiveSessions,
        },
        signal,
        card.intensity,
      );

      const updated: WifeState = {
        ...wifeState,
        earnedCeilingLevel: newCeiling.earnedLevel,
        consecutivePositiveSessions: newCeiling.consecutivePositiveSessions,
        updatedAt: new Date().toISOString(),
      };

      await writeWife<WifeState>("State", updated, passphrase);
      dispatch({ type: "STATE_SAVED", wifeState: updated });
    },
    [state]
  );

  const handleSkip = useCallback(async () => {
    dispatch({ type: "SKIP" });

    const { passphrase, wifeState, card } = state;
    if (!passphrase || !wifeState || !card || card.intensity < 1) return;

    const signal: SessionSignal = {
      cardId: card.id,
      response: "skipped",
      durationSec: 0,
      recordedAt: new Date().toISOString(),
    };

    const newCeiling = applySessionSignal(
      {
        earnedLevel: wifeState.earnedCeilingLevel,
        consecutivePositiveSessions: wifeState.consecutivePositiveSessions,
      },
      signal,
      card.intensity,
    );

    const updated: WifeState = {
      ...wifeState,
      earnedCeilingLevel: newCeiling.earnedLevel,
      consecutivePositiveSessions: newCeiling.consecutivePositiveSessions,
      updatedAt: new Date().toISOString(),
    };

    await writeWife<WifeState>("State", updated, passphrase);
    dispatch({ type: "STATE_SAVED", wifeState: updated });
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
    <WifeDailyView
      card={state.card}
      step={state.step}
      moodSelected={state.moodSelected}
      passphrase={state.passphrase}
      wifeState={state.wifeState ?? DEFAULT_WIFE_STATE}
      onSkip={handleSkip}
      onMoodTap={(mood) => dispatch({ type: "SET_MOOD", mood })}
      onCardDone={() => dispatch({ type: "CARD_DONE" })}
      onExerciseDone={() => dispatch({ type: "EXERCISE_DONE" })}
      onRatingSelected={handleRatingSelected}
    />
  );
}
