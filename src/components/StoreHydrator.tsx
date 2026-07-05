"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

/**
 * Loads the saved campaign from localStorage after React has hydrated.
 * The store is created with `skipHydration: true`, so server HTML and the
 * first client render agree on the initial state; rehydrating in an effect
 * then swaps in the persisted campaign without any hydration mismatch.
 */
export default function StoreHydrator() {
  useEffect(() => {
    void useGameStore.persist.rehydrate();
  }, []);

  return null;
}
