"use client";

/**
 * Sakan (سَكَن) — Wife Daily Page (الصفحة اليومية للزوجة)
 *
 * ─── مسار البيانات ────────────────────────────────────────────────────────────
 * ١. يقرأ WifeState + LearningState من IndexedDB
 * ٢. يقرأ KeyState عبر readKeyState (من AmbientSerenityKey) لحساب السقف
 * ٣. يتحقق من وضع السكون (§4.4) وإيقاع البطاقة
 * ٤. يحسب السقف عبر computeCeiling (مع keyState)
 * ٥. يختار بطاقة عبر selectCardWithLearning (§4.3 + §4.4)
 * ٦. يُمرّر كل شيء إلى WifeDailyView (مكوّن عرض)
 *
 * ─── AmbientSerenityKey ──────────────────────────────────────────────────────
 * هذه الصفحة تقرأ حالة المفتاح (readKeyState) لحساب السقف فقط.
 * المكوّن المرئي (البتلات الزهرية) لا يظهر هنا — الإعدادات فقط.
 * بلا بادجة، بلا أثر بصري، بلا إشارة إلى المفتاح في هذه الصفحة.
 *
 * ─── حلقة التعلّم (§4.3) ──────────────────────────────────────────────────────
 * - بطاقة تُجوَّز مرتين → تهميش 60 يوماً (applyCardSkip)
 * - تقييم راحة ≥3 → تعزيز عائلة البطاقة (applyCardRating)
 * - تغيّر earnedLevel → تسجيل حركة المقاييس (applyMetricChange)
 *
 * ─── وضع السكون (§4.4) ─────────────────────────────────────────────────────────
 * - 21 يوماً بلا حركة → intensity=0 فقط، بطاقة كل 3 أيام.
 * - الانتقال والخروج صامتان — لا نص، لا إشارة.
 */

import { useReducer, useEffect, useCallback } from "react";
import type { WifeState, SessionSignal, Card, KeyState, LearningState } from "@/types/sakan";
import { readWife, writeWife } from "@/lib/sakan/idb";
import {
  computeCeiling,
  selectCardWithLearning,
  applySessionSignal,
  applyCardSkip,
  applyCardRating,
  applyMetricChange,
  isDormant,
  shouldShowCardToday,
} from "@/lib/sakan/engine";
import { ALL_CARDS } from "@/lib/sakan/cards";
import { readKeyState } from "@/components/sakan/AmbientSerenityKey";
import WifeDailyView, { type DailyStep } from "@/components/sakan/WifeDailyView";
import SakanNav from "@/components/sakan/SakanNav";
import { SAKAN_ROUTES } from "@/lib/sakan/session";

// ─── مكوّن المحتوى المُصادَق عليه (مُصدَّر للاختبار) ───────────────────────────

/**
 * الجزء المرئي من صفحة الزوجة بعد المصادقة — مُصدَّر ليكون اختباراً قابلاً
 * للعزل في acceptance-test11.test.ts.
 *
 * يستقبل learningState لأن أي محاولة لإظهار نص مشروط بوضع السكون أو
 * التهميش ستقع هنا بالضرورة — والاختبار يقارن HTML حرفياً.
 *
 * @testonly — لا يُستدعى من أي مكان آخر خارج الصفحة والاختبار.
 */
export interface WifeDailyContentProps {
  card: Card | null;
  step: DailyStep;
  moodSelected: string | null;
  passphrase: string;
  wifeState: WifeState;
  /** مُستقبَل لإتاحة اختبار الصمت البصري — لا يُمرَّر إلى WifeDailyView. */
  learningState: LearningState;
  onSkip: () => void;
  onMoodTap: (mood: string) => void;
  onCardDone: () => void;
  onExerciseDone: () => void;
  onRatingSelected: (r: 1 | 2 | 3 | 4 | 5) => void;
}

export function WifeDailyContent({
  card, step, moodSelected, passphrase, wifeState,
  // learningState مُستقبَل ولا يُمرَّر للعرض — أي إضافة مشروطة به تُفشل AT11
  onSkip, onMoodTap, onCardDone, onExerciseDone, onRatingSelected,
}: WifeDailyContentProps) {
  return (
    <>
      <WifeDailyView
        card={card}
        step={step}
        moodSelected={moodSelected}
        passphrase={passphrase}
        wifeState={wifeState}
        onSkip={onSkip}
        onMoodTap={onMoodTap}
        onCardDone={onCardDone}
        onExerciseDone={onExerciseDone}
        onRatingSelected={onRatingSelected}
      />
      {/* تنقّل ثابت تماماً — لا يعتمد على أي حالة، فلا يكسر اختبارات التطابق */}
      <SakanNav current="daily" dailyPath={SAKAN_ROUTES.wifeDaily} />
    </>
  );
}

// ─── حالة الصفحة ────────────────────────────────────────────────────────────

interface PageState {
  passphrase: string | null;
  passphraseInput: string;
  wifeState: WifeState | null;
  learningState: LearningState | null;
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
  learningState: null,
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
  earnedCeiling: 0,
  consecutivePositiveSessions: 0,
  updatedAt: new Date().toISOString(),
};

function makeDefaultLearning(now: string): LearningState {
  return {
    skipsByCard: {},
    familyBoosts: [],
    metricsMovedAt: now, // جلسة جديدة → ليس في وضع السكون
    lastCardShownAt: null,
  };
}

type Action =
  | { type: "SET_INPUT"; value: string }
  | { type: "LOAD_START" }
  | { type: "LOAD_DONE"; passphrase: string; wifeState: WifeState; learningState: LearningState; keyState: KeyState; card: Card | null }
  | { type: "LOAD_ERROR"; message: string }
  | { type: "SET_MOOD"; mood: string }
  | { type: "SKIP" }
  | { type: "CARD_DONE" }
  | { type: "EXERCISE_DONE" }
  | { type: "RATING_SELECTED"; rating: 1 | 2 | 3 | 4 | 5 }
  | { type: "STATE_SAVED"; wifeState: WifeState; learningState: LearningState };

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
        learningState: action.learningState,
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
      return { ...state, wifeState: action.wifeState, learningState: action.learningState };

    default:
      return state;
  }
}

// ─── دالة التحميل ───────────────────────────────────────────────────────────

async function loadSession(
  passphrase: string,
  shownCardIds: Set<string>,
  lastCardId: string | undefined,
): Promise<{ wifeState: WifeState; learningState: LearningState; keyState: KeyState; card: Card | null }> {
  const now = new Date().toISOString();

  const [stored, learnStored, ks] = await Promise.all([
    readWife<WifeState>("State", passphrase),
    readWife<LearningState>("LearningState", passphrase),
    readKeyState(passphrase),
  ]);

  const wifeState = stored ?? { ...DEFAULT_WIFE_STATE, updatedAt: now };
  const learning = learnStored ?? makeDefaultLearning(now);

  // §4.4: تحقق من وضع السكون وإيقاع البطاقة
  const dormant = isDormant(learning.metricsMovedAt, now);
  if (!shouldShowCardToday(dormant, learning.lastCardShownAt, now)) {
    return { wifeState, learningState: learning, keyState: ks, card: null };
  }

  const ceiling = computeCeiling({
    role: "wife",
    keyState: ks,
    safety: wifeState.safety,
    earnedLevel: wifeState.earnedCeiling,
  });

  const card = selectCardWithLearning(
    {
      role: "wife",
      ceiling,
      cards: ALL_CARDS,
      safety: wifeState.safety,
      flags: [],
      shownCardIds,
      lastCardId,
    },
    learning,
    now,
  );

  // تسجيل أن بطاقة عُرضت — يُحدِّث lastCardShownAt في IndexedDB
  let updatedLearning = learning;
  if (card) {
    updatedLearning = { ...learning, lastCardShownAt: now };
    await writeWife<LearningState>("LearningState", updatedLearning, passphrase);
  }

  return { wifeState, learningState: updatedLearning, keyState: ks, card };
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
          ({ wifeState, learningState, keyState, card }) => {
            dispatch({ type: "LOAD_DONE", passphrase: cached, wifeState, learningState, keyState, card });
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
        const { wifeState, learningState, keyState, card } = await loadSession(
          pp,
          state.shownCardIds,
          state.lastCardId
        );
        try { window.sessionStorage.setItem("s.pp", pp); } catch { /* صامت */ }
        dispatch({ type: "LOAD_DONE", passphrase: pp, wifeState, learningState, keyState, card });
      } catch {
        dispatch({ type: "LOAD_ERROR", message: "عبارة المرور غير صحيحة" });
      }
    },
    [state.shownCardIds, state.lastCardId]
  );

  const handleRatingSelected = useCallback(
    async (rating: 1 | 2 | 3 | 4 | 5) => {
      dispatch({ type: "RATING_SELECTED", rating });

      const { passphrase, wifeState, card, learningState } = state;
      if (!passphrase || !wifeState || !card || !learningState) return;

      const now = new Date().toISOString();

      const signal: SessionSignal = {
        cardId: card.id,
        response: "accepted",
        comfortRating: rating,
        durationSec: 0,
        recordedAt: now,
      };

      const newCeiling = applySessionSignal(
        {
          earnedLevel: wifeState.earnedCeiling,
          consecutivePositiveSessions: wifeState.consecutivePositiveSessions,
        },
        signal,
        card.intensity,
      );

      const updated: WifeState = {
        ...wifeState,
        earnedCeiling: newCeiling.earnedLevel,
        consecutivePositiveSessions: newCeiling.consecutivePositiveSessions,
        updatedAt: now,
      };

      // §4.3: تسجيل تقييم الراحة → تعزيز العائلة
      let updatedLearning = applyCardRating(learningState, card, rating, now);

      // §4.3: إن تغيّر earnedLevel → تسجيل حركة المقاييس
      if (newCeiling.earnedLevel !== wifeState.earnedCeiling) {
        updatedLearning = applyMetricChange(updatedLearning, now);
      }

      await Promise.all([
        writeWife<WifeState>("State", updated, passphrase),
        writeWife<LearningState>("LearningState", updatedLearning, passphrase),
      ]);
      dispatch({ type: "STATE_SAVED", wifeState: updated, learningState: updatedLearning });
    },
    [state]
  );

  const handleSkip = useCallback(async () => {
    dispatch({ type: "SKIP" });

    const { passphrase, wifeState, card, learningState } = state;
    if (!passphrase || !wifeState || !card || !learningState) return;

    const now = new Date().toISOString();

    // §4.3: تسجيل التجاوز → قد يُفعِّل التهميش
    let updatedLearning = applyCardSkip(learningState, card.id, now);

    if (card.intensity < 1) {
      // بطاقة intensity=0 لا تُغيِّر earnedLevel → نحفظ فقط التعلّم
      await writeWife<LearningState>("LearningState", updatedLearning, passphrase);
      dispatch({
        type: "STATE_SAVED",
        wifeState,
        learningState: updatedLearning,
      });
      return;
    }

    const signal: SessionSignal = {
      cardId: card.id,
      response: "skipped",
      durationSec: 0,
      recordedAt: now,
    };

    const newCeiling = applySessionSignal(
      {
        earnedLevel: wifeState.earnedCeiling,
        consecutivePositiveSessions: wifeState.consecutivePositiveSessions,
      },
      signal,
      card.intensity,
    );

    const updated: WifeState = {
      ...wifeState,
      earnedCeiling: newCeiling.earnedLevel,
      consecutivePositiveSessions: newCeiling.consecutivePositiveSessions,
      updatedAt: now,
    };

    // §4.3: إن تغيّر earnedLevel → تسجيل حركة المقاييس
    if (newCeiling.earnedLevel !== wifeState.earnedCeiling) {
      updatedLearning = applyMetricChange(updatedLearning, now);
    }

    await Promise.all([
      writeWife<WifeState>("State", updated, passphrase),
      writeWife<LearningState>("LearningState", updatedLearning, passphrase),
    ]);
    dispatch({ type: "STATE_SAVED", wifeState: updated, learningState: updatedLearning });
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
    <WifeDailyContent
      card={state.card}
      step={state.step}
      moodSelected={state.moodSelected}
      passphrase={state.passphrase}
      wifeState={state.wifeState ?? DEFAULT_WIFE_STATE}
      learningState={state.learningState ?? makeDefaultLearning(new Date().toISOString())}
      onSkip={handleSkip}
      onMoodTap={(mood) => dispatch({ type: "SET_MOOD", mood })}
      onCardDone={() => dispatch({ type: "CARD_DONE" })}
      onExerciseDone={() => dispatch({ type: "EXERCISE_DONE" })}
      onRatingSelected={handleRatingSelected}
    />
  );
}
