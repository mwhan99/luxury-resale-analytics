"use client";

import { useSyncExternalStore } from "react";

import { DataBar } from "@/components/DataBar";
import { DataTable } from "@/components/DataTable";
import { useTracker } from "@/components/TrackerProvider";
import { Card, PageIntro, Stat, StatRow } from "@/components/ui";
import { qualityIssues } from "@/lib/calc";

// Today's date, read in the browser only. The prebuilt page skips the
// "date in the future" check, then the browser adds it straight away.
const noop = () => () => {};
const todayISO = () => new Date().toISOString().slice(0, 10);

export function DataQuality() {
  const { bags } = useTracker();
  const today = useSyncExternalStore(noop, todayISO, () => null);
  const issues = qualityIssues(bags, today ? new Date(today) : new Date(8.64e15)).sort((a, b) => b.issues.length - a.issues.length);
  const estimatedSold = bags.filter((b) => b.is_sold && (b.confidence === "Estimated" || b.confidence === "Unknown")).length;
  const undated = bags.filter((b) => b.is_sold && isNaN(b.days_to_sell)).length;

  // How often each kind of issue appears, e.g. "Marked Estimated" × 32
  const counts = new Map<string, number>();
  for (const q of issues) for (const i of q.issues) counts.set(i, (counts.get(i) ?? 0) + 1);

  return (
    <>
      <PageIntro chip="Data quality" title="What's missing or suspicious in the tracker">
        Every number on this site is only as good as the tracker. These checks flag gaps to fix; fixing them and
        re-opening the file makes every result more reliable.
      </PageIntro>
      <DataBar />
      <StatRow>
        <Stat label="Bags with at least one issue" value={`${issues.length} / ${bags.length}`} />
        <Stat label="Sold bags with estimated data" value={String(estimatedSold)} sub="mostly unrecorded platform fees" />
        <Stat label="Sold bags without dates" value={String(undated)} sub="so days to sell can't be measured" />
        <Stat label="Kinds of issue" value={String(counts.size)} />
      </StatRow>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_2fr]">
        <Card>
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">Most common issues</h2>
          <ul className="space-y-2 text-sm">
            {[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([issue, n]) => (
              <li key={issue} className="flex justify-between gap-4">
                <span className="text-muted">{issue}</span>
                <span className="font-semibold tabular-nums text-ink">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">By bag</h2>
          <div className="max-h-[32rem] overflow-y-auto">
            <DataTable rows={issues} rowKey={(q, i) => `${q.id}-${i}`} columns={[
              { label: "Bag ID", value: (q) => q.id },
              { label: "Brand", value: (q) => q.brand ?? "–" },
              { label: "Issues", value: (q) => <span className="whitespace-normal">{q.issues.join("; ")}</span> },
              { label: "Count", value: (q) => q.issues.length, align: "right" },
            ]} />
          </div>
        </Card>
      </div>
    </>
  );
}
