"use client";

import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import CentralCommand from "@/components/CentralCommand";
import { formatGameDate, formatMillions, formatNumber } from "@/lib/format";
import type { HistoryPoint } from "@/types/game";

// Series colors validated (dataviz six checks) against the dark surface.
const SERIES = {
  gdp: "#059669",
  hardCurrency: "#0284c7",
  budget: "#d97706",
  stability: "#9333ea",
  population: "#0d9488",
} as const;

const CHART_W = 300;
const CHART_H = 96;
const PAD = 6;

interface TrendChartProps {
  title: string;
  color: string;
  points: readonly HistoryPoint[];
  pick: (point: HistoryPoint) => number;
  /** Fixed y-domain (e.g. stability 0–100); otherwise fit to data. */
  domain?: [number, number];
  formatValue: (value: number) => string;
}

/**
 * Single-series line + area chart with a crosshair hover. Text stays in ink
 * tokens; the series color only paints the mark. The plot itself is LTR
 * (chronological left→right) inside the RTL page.
 */
function TrendChart({
  title,
  color,
  points,
  pick,
  domain,
  formatValue,
}: TrendChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const values = points.map(pick);
  const latest = values[values.length - 1];

  if (values.length < 2) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <p className="mt-4 text-xs text-slate-500">
          البيانات تتجمع مع مرور الأشهر — قدّم الزمن لرؤية المنحنى.
        </p>
      </div>
    );
  }

  let min = domain ? domain[0] : Math.min(...values);
  let max = domain ? domain[1] : Math.max(...values);
  if (!domain) {
    const span = Math.max(max - min, Math.abs(max) * 0.05, 1);
    min -= span * 0.08;
    max += span * 0.08;
  }
  const x = (i: number) =>
    PAD + (i / (values.length - 1)) * (CHART_W - PAD * 2);
  const y = (v: number) =>
    CHART_H - PAD - ((v - min) / (max - min)) * (CHART_H - PAD * 2);

  const linePath = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join("");
  const areaPath = `${linePath}L${x(values.length - 1).toFixed(1)},${CHART_H - PAD}L${PAD},${CHART_H - PAD}Z`;

  const hoverIndex = hover !== null ? hover : null;
  const shown = hoverIndex !== null ? values[hoverIndex] : latest;
  const shownDate =
    hoverIndex !== null
      ? points[hoverIndex].date
      : points[points.length - 1].date;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <span className="text-xs text-slate-500">
          {formatGameDate(shownDate)}
        </span>
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums text-slate-100">
        {formatValue(shown)}
      </div>
      <div dir="ltr" className="mt-2">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${title}: ${formatValue(latest)}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const rel = (event.clientX - rect.left) / rect.width;
            const index = Math.round(rel * (values.length - 1));
            setHover(Math.max(0, Math.min(values.length - 1, index)));
          }}
        >
          {/* recessive grid */}
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={PAD}
              x2={CHART_W - PAD}
              y1={PAD + t * (CHART_H - PAD * 2)}
              y2={PAD + t * (CHART_H - PAD * 2)}
              stroke="#334155"
              strokeWidth="0.5"
            />
          ))}
          <path d={areaPath} fill={color} opacity="0.14" />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {hoverIndex !== null && (
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={PAD}
              y2={CHART_H - PAD}
              stroke="#64748b"
              strokeWidth="0.75"
              strokeDasharray="3 3"
            />
          )}
          <circle
            cx={x(hoverIndex ?? values.length - 1)}
            cy={y(shown)}
            r="3.5"
            fill={color}
            stroke="#0f172a"
            strokeWidth="2"
          />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-500">
        <span>الأدنى: {formatValue(Math.min(...values))}</span>
        <span>الأقصى: {formatValue(Math.max(...values))}</span>
      </div>
    </div>
  );
}

/** National analytics: GDP, stability, treasury and reserves over time. */
export default function AnalyticsDashboard() {
  const open = useGameStore((state) => state.dashboardOpen);
  const toggleDashboard = useGameStore((state) => state.toggleDashboard);
  const history = useGameStore((state) => state.history);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="لوحة التحليلات الوطنية"
        className="w-full max-w-3xl animate-slide-in-down rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">
              لوحة التحليلات الوطنية
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              آخر {history.length} شهرًا (نافذة متحركة بحد أقصى 60)
            </p>
          </div>
          <button
            type="button"
            onClick={toggleDashboard}
            aria-label="إغلاق اللوحة"
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M4.3 4.3a1 1 0 0 1 1.4 0L10 8.6l4.3-4.3a1 1 0 1 1 1.4 1.4L11.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 0 1-1.4-1.4L8.6 10 4.3 5.7a1 1 0 0 1 0-1.4Z" />
            </svg>
          </button>
        </div>

        <div className="mt-5">
          <CentralCommand />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TrendChart
            title="الناتج الوطني (سنوي)"
            color={SERIES.gdp}
            points={history}
            pick={(p) => p.gdp}
            formatValue={(v) => formatMillions(v, "TND")}
          />
          <TrendChart
            title="الاستقرار الوطني"
            color={SERIES.stability}
            points={history}
            pick={(p) => p.stability}
            domain={[0, 100]}
            formatValue={(v) => `${Math.round(v)}/100`}
          />
          <TrendChart
            title="الميزانية العامة"
            color={SERIES.budget}
            points={history}
            pick={(p) => p.budget}
            formatValue={(v) => formatMillions(v, "TND")}
          />
          <TrendChart
            title="العملة الصعبة"
            color={SERIES.hardCurrency}
            points={history}
            pick={(p) => p.hardCurrency}
            formatValue={(v) => formatMillions(v, "USD")}
          />
          <TrendChart
            title="عدد السكان الوطني"
            color={SERIES.population}
            points={history}
            pick={(p) => p.population}
            formatValue={(v) => formatNumber(Math.round(v))}
          />
        </div>
      </div>
    </div>
  );
}
