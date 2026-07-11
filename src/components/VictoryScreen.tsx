"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";

/**
 * Historical Triumph banner: a dismissible celebration overlay for reaching
 * the legendary win state (sovereignDebt <= 0, stability >= 85, zero active
 * strikes, purchasingPowerIndex >= 60 — see `isVictorious` in gameStore.ts).
 * Unlike `GameOverModal`, dismissing it does not reset the campaign — it
 * just hides the banner ("spectator mode") so the player can keep playing
 * or admire their stats; `isVictorious` itself is a one-way flag and stays
 * true for the rest of the campaign.
 */
export default function VictoryScreen() {
  const isVictorious = useGameStore((state) => state.gameState.isVictorious);
  const [dismissed, setDismissed] = useState(false);

  if (!isVictorious || dismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="العبور التاريخي"
        className="w-full max-w-xl animate-slide-in-down rounded-2xl border border-emerald-500/50 bg-emerald-950/80 p-8 text-center shadow-2xl backdrop-blur-xl"
      >
        <div className="animate-pulse text-6xl drop-shadow-[0_0_20px_rgba(52,211,153,0.8)]">
          🏆
        </div>
        <h1 className="mt-4 bg-gradient-to-r from-amber-300 via-emerald-300 to-amber-300 bg-clip-text text-3xl font-bold text-transparent">
          العبور التاريخي
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-emerald-100/90">
          لقد حققت المستحيل. سددت ديون الدولة بالكامل، وأرسيت السلم الاجتماعي،
          وبنيت اقتصاداً سيادياً حقيقياً. لقد أنقذت الجمهورية من الانهيار.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-8 w-full rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-800 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/40 transition-all hover:from-emerald-500 hover:to-emerald-700"
        >
          العودة للواجهة (وضع المراقبة)
        </button>
      </div>
    </div>
  );
}
