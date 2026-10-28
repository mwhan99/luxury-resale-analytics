/** Small shared building blocks: cards, stats, chips, verdict banners. */
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-2xl border border-line bg-card p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function Chip({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "brass" | "plain" }) {
  const tones = {
    brand: "bg-brand-soft text-brand",
    brass: "bg-brass-soft text-[#7a5717]",
    plain: "bg-sand text-muted",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: ReactNode; tone?: "gain" | "loss" }) {
  const color = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink";
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold tabular-nums sm:text-[1.7rem] ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-faint">{sub}</div>}
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <Card className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">{children}</Card>;
}

export type Tone = "good" | "bad" | "warn" | "info";

export function Verdict({ tone, title, children }: { tone: Tone; title: ReactNode; children?: ReactNode }) {
  const tones = {
    good: "border-gain/30 bg-brand-soft",
    bad: "border-loss/30 bg-loss-soft",
    warn: "border-brass/40 bg-brass-soft",
    info: "border-line bg-sand",
  };
  const marks = { good: "✓", bad: "✕", warn: "!", info: "i" };
  const markColors = { good: "bg-gain", bad: "bg-loss", warn: "bg-brass", info: "bg-muted" };
  return (
    <div role="status" className={`flex gap-3 rounded-2xl border p-4 sm:p-5 ${tones[tone]}`}>
      <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${markColors[tone]}`}>
        {marks[tone]}
      </span>
      <div className="min-w-0">
        <div className="font-semibold text-ink">{title}</div>
        {children && <div className="mt-1 text-sm leading-relaxed text-muted">{children}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">{title}</h2>
      {sub && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}

/** The heading block at the top of each tool page. */
export function PageIntro({ chip, title, children }: { chip: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <Chip>{chip}</Chip>
      <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">{title}</h1>
      {children && <p className="mt-2 max-w-3xl leading-relaxed text-muted">{children}</p>}
    </div>
  );
}

/** A folded section: the details stay one click away. */
export function Fold({ summary, children, open = false }: { summary: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-line bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-ink">
        {summary}
        <span aria-hidden className="text-faint transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-line px-5 py-4">{children}</div>
    </details>
  );
}
