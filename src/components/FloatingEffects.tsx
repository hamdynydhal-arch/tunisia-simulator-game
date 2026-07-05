"use client";

import { useEffect, useState } from "react";
import { onArrival } from "@/lib/mapBus";

interface FloatingStat {
  id: number;
  label: string;
  color: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  delayMs: number;
}

let nextId = 1;

/**
 * When the camera arrives at a completed project (via a toast's
 * "Go to Region"), floats "+توظيف" and "+ضرائب" from the marker's screen
 * position up toward the HUD budget counter.
 */
export default function FloatingEffects() {
  const [stats, setStats] = useState<readonly FloatingStat[]>([]);

  useEffect(
    () =>
      onArrival(({ x, y }) => {
        // Aim at the budget counter; fall back to the top center of the page.
        const target = document
          .getElementById("hud-budget")
          ?.getBoundingClientRect();
        const tx = target ? target.left + target.width / 2 : window.innerWidth / 2;
        const ty = target ? target.top + target.height / 2 : 24;

        const spawned: FloatingStat[] = [
          { label: "+توظيف", color: "#34d399", delayMs: 0 },
          { label: "+ضرائب", color: "#fbbf24", delayMs: 280 },
        ].map((base, i) => ({
          id: nextId++,
          x: x + (i === 0 ? -14 : 14),
          y,
          dx: tx - x,
          dy: ty - y,
          ...base,
        }));

        setStats((current) => [...current, ...spawned]);
        const ids = spawned.map((s) => s.id);
        setTimeout(() => {
          setStats((current) => current.filter((s) => !ids.includes(s.id)));
        }, 2400);
      }),
    [],
  );

  return (
    <>
      {stats.map((stat) => (
        <span
          key={stat.id}
          aria-hidden="true"
          className="floating-stat"
          style={{
            left: stat.x,
            top: stat.y,
            color: stat.color,
            animationDelay: `${stat.delayMs}ms`,
            ["--fx-dx" as string]: `${stat.dx}px`,
            ["--fx-dy" as string]: `${stat.dy}px`,
          }}
        >
          {stat.label}
        </span>
      ))}
    </>
  );
}
