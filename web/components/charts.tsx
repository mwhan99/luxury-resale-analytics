/** Hand-drawn charts (plain HTML and SVG, no chart library). */
import { gbp } from "@/lib/format";

/** Horizontal bars that start at £0, sorted, with losses in red. */
export function BarList({ rows, format = (v) => gbp(v) }: {
  rows: { label: string; value: number }[]; format?: (v: number) => string;
}) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((r) => Math.abs(r.value)), 1);
  return (
    <ul className="space-y-2.5">
      {sorted.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
          <span className="truncate text-muted" title={r.label}>{r.label}</span>
          <span className="h-2.5 rounded-full bg-sand">
            <span
              className={`block h-full rounded-full ${r.value < 0 ? "bg-loss" : "bg-brand"}`}
              style={{ width: `${(Math.abs(r.value) / max) * 100}%` }}
            />
          </span>
          <span className={`text-right font-semibold tabular-nums ${r.value < 0 ? "text-loss" : "text-ink"}`}>{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Lines of £ per month against Shopify bags per month, with the £0 line marked. */
export function LineChart({ series, xs, xLabel }: {
  series: { name: string; values: number[]; color: string }[]; xs: number[]; xLabel: string;
}) {
  const W = 560, H = 260, L = 56, R = 12, T = 12, B = 40;
  const all = series.flatMap((s) => s.values).concat(0);
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 10;
  lo -= pad; hi += pad;
  const x = (i: number) => L + (i / (xs.length - 1)) * (W - L - R);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const step = niceStep((hi - lo) / 4);
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Monthly profit difference chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#6c6157" : "#e6ddd0"} strokeWidth={t === 0 ? 1.2 : 1} strokeDasharray={t === 0 ? "4 3" : undefined} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#958a7e">{gbp(t)}</text>
          </g>
        ))}
        {xs.map((v, i) => (i % 2 === 0 ? (
          <text key={v} x={x(i)} y={H - B + 18} textAnchor="middle" fontSize="11" fill="#958a7e">{v}</text>
        ) : null))}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="#6c6157">{xLabel}</text>
        {series.map((s) => (
          <polyline key={s.name} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round"
            points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        ))}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded" style={{ background: s.color }} />
            vs {s.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
}

// Series colours: distinct in hue and lightness, readable on the ivory card.
export const SERIES_COLORS = ["#1f4d3a", "#a87b2f", "#5b6ea8", "#a5362a", "#7a5b8c", "#3f8f8a"];
