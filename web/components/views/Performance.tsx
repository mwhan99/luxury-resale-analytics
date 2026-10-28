"use client";

import { useState } from "react";

import { BarList } from "@/components/charts";
import { DataBar } from "@/components/DataBar";
import { DataTable, type Column } from "@/components/DataTable";
import { useTracker } from "@/components/TrackerProvider";
import { Card, Fold, PageIntro, SectionTitle, Stat, StatRow } from "@/components/ui";
import { groupSummary, kpis, type GroupBy, type GroupRow } from "@/lib/calc";
import { gbp, pct } from "@/lib/format";
import type { Bag } from "@/lib/tracker";

const groupColumns = (first: string): Column<GroupRow>[] => [
  { label: first, value: (r) => r.label ?? "–" },
  { label: "Bags", value: (r) => r.bags, align: "right" },
  { label: "Sold", value: (r) => r.sold, align: "right" },
  { label: "Spend", value: (r) => gbp(r.spend), align: "right" },
  { label: "Revenue", value: (r) => gbp(r.revenue), align: "right" },
  { label: "Profit", value: (r) => <span className={r.profit < 0 ? "text-loss" : "text-ink"}>{gbp(r.profit)}</span>, align: "right" },
  { label: "Unsold at cost", value: (r) => gbp(r.unsold_cost), align: "right" },
  { label: "Sell-through", value: (r) => pct(r.sell_through), align: "right" },
  { label: "Margin", value: (r) => pct(r.margin), align: "right" },
  { label: "Profit per £1", value: (r) => gbp(r.return_per_pound, 2), align: "right" },
];

const bagColumns: Column<Bag>[] = [
  { label: "Bag ID", value: (b) => b.id },
  { label: "Brand", value: (b) => b.brand ?? "–" },
  { label: "Model", value: (b) => b.model ?? "–" },
  { label: "Condition", value: (b) => b.condition ?? "–" },
  { label: "Sourcing", value: (b) => b.sourcing },
  { label: "Lot", value: (b) => b.lot },
  { label: "Channel", value: (b) => b.channel ?? "–" },
  { label: "Status", value: (b) => b.status ?? "–" },
  { label: "Landed cost", value: (b) => gbp(b.landed_cost), align: "right" },
  { label: "First list price", value: (b) => gbp(b.list_price), align: "right" },
  { label: "Sale price", value: (b) => gbp(b.sale), align: "right" },
  { label: "Fees", value: (b) => gbp(b.fees), align: "right" },
  { label: "Profit", value: (b) => gbp(b.profit), align: "right" },
  { label: "Margin", value: (b) => pct(b.margin), align: "right" },
  { label: "Confidence", value: (b) => b.confidence ?? "–" },
];

function Group({ view, by, first }: { view: Bag[]; by: GroupBy; first: string }) {
  const rows = groupSummary(view, by);
  return (
    <Card>
      <h3 className="mb-4 font-display text-lg font-semibold text-ink">By {first.toLowerCase()}</h3>
      <BarList rows={rows.map((r) => ({ label: r.label ?? "–", value: r.profit }))} />
      <div className="mt-5">
        <Fold summary={`Table by ${first.toLowerCase()}`}>
          <DataTable rows={rows} columns={groupColumns(first)} rowKey={(r) => String(r.label)} />
        </Fold>
      </div>
    </Card>
  );
}

export function Performance() {
  const { bags, version } = useTracker();
  return <PerformanceBody key={version} bags={bags} />;
}

function PerformanceBody({ bags }: { bags: Bag[] }) {
  const lots = [...new Set(bags.map((b) => b.lot))].sort();
  const [chosen, setChosen] = useState<string[]>(lots);
  const view = chosen.length ? bags.filter((b) => chosen.includes(b.lot)) : bags;
  const k = kpis(view);
  const toggle = (l: string) => setChosen((c) => (c.includes(l) ? c.filter((x) => x !== l) : [...c, l]));

  return (
    <>
      <PageIntro chip="Performance" title="What's making money, and what isn't">
        Profit, margin, sell-through and unsold stock, recalculated from the raw tracker inputs.
      </PageIntro>
      <DataBar />

      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by lot or shipment">
        <span className="mr-1 text-sm font-medium text-muted">Lots:</span>
        {lots.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={chosen.includes(l)}
            onClick={() => toggle(l)}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
              chosen.includes(l) ? "border-brand bg-brand-soft text-brand" : "border-line bg-card text-faint line-through"
            }`}
          >
            {l}
          </button>
        ))}
        {chosen.length !== lots.length && (
          <button type="button" onClick={() => setChosen(lots)} className="text-sm font-semibold text-brand hover:underline">Show all</button>
        )}
      </div>

      <StatRow>
        <Stat label="Bags sold" value={`${k.sold} / ${k.bags}`} sub={`${pct(k.sell_through)} sell-through`} />
        <Stat label="Profit on sold bags" value={gbp(k.profit)} sub={`${pct(k.margin)} margin on ${gbp(k.revenue)} revenue`} tone={k.profit < 0 ? "loss" : undefined} />
        <Stat label="Profit per £1 spent" value={gbp(k.roi_sold, 2)} sub="on bags sold" />
        <Stat label="Unsold stock at cost" value={gbp(k.unsold_cost)} sub={`${k.bags - k.sold} bag(s) in stock`} />
      </StatRow>
      <div className="mt-3 space-y-1 text-xs text-faint">
        <p>
          {k.days_known === 0
            ? "Days to sell can't be measured yet: no bag has both a listed and a sold date."
            : `Average days to sell: ${Math.round(k.avg_days)} (from ${k.days_known} bags with dates).`}
        </p>
        {k.estimated_rows > 0 && (
          <p>{k.estimated_rows} bag(s) include estimated data, mostly unrecorded platform fees, so profit may be overstated. See Data quality.</p>
        )}
      </div>

      <section className="mt-10">
        <SectionTitle title="Clearance lots vs selected single bags" sub="The key sourcing question: is cheap bulk stock or hand-picked premium stock the better use of money?" />
        <Card>
          <DataTable rows={groupSummary(view, "sourcing")} columns={groupColumns("Sourcing type")} rowKey={(r) => String(r.label)} />
        </Card>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        <Group view={view} by="brand" first="Brand" />
        <Group view={view} by="channel" first="Channel" />
      </section>

      {new Set(view.map((b) => b.lot)).size > 1 && (
        <section className="mt-10">
          <SectionTitle title="By lot / shipment" />
          <Card>
            <DataTable rows={groupSummary(view, "lot")} columns={groupColumns("Lot")} rowKey={(r) => String(r.label)} />
          </Card>
        </section>
      )}

      <section className="mt-10">
        <Fold summary={`All ${view.length} bags`}>
          <DataTable rows={view} columns={bagColumns} rowKey={(b, i) => `${b.id}-${i}`} />
        </Fold>
      </section>
    </>
  );
}
