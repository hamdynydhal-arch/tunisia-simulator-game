"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

/** Milliseconds per game month at 1× speed. */
const BASE_INTERVAL_MS = 2_400;

/**
 * Drives auto-advance: while running, ticks the month on an interval scaled
 * by speed. A political event (or a finished campaign) clears the interval
 * entirely — time resumes only after the player acknowledges the modal,
 * which flips `politicalEvent` back to null and re-arms the effect.
 */
export default function AutoAdvance() {
  const running = useGameStore((state) => state.timeRunning);
  const speed = useGameStore((state) => state.timeSpeed);
  const frozen = useGameStore((state) =>
    Boolean(
      state.gameState.politicalEvent ||
        state.gameState.outcome ||
        state.gameState.isGameOver ||
        !state.gameState.gameStarted,
    ),
  );

  useEffect(() => {
    if (!running || frozen) {
      return;
    }
    const id = setInterval(
      () => useGameStore.getState().advanceTime(),
      BASE_INTERVAL_MS / speed,
    );
    return () => clearInterval(id);
  }, [running, frozen, speed]);

  return null;
}
