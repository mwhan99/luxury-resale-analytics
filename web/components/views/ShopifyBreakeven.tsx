"use client";

import { useState } from "react";

import { BarList, LineChart, SERIES_COLORS } from "@/components/charts";
import { DataBar } from "@/components/DataBar";
import { DataTable } from "@/components/DataTable";
import { NumberField, PercentSlider, Segmented, Select } from "@/components/inputs";
import { SellingSetup } from "@/components/SellingSetup";
import { useTracker } from "@/components/TrackerProvider";
import { Card, Fold, PageIntro, SectionTitle, Stat, StatRow, Verdict } from "@/components/ui";
import {
  bestMarketplace, breakevenTable, FEES_CHECKED, fixedMonthly, MARKETING_LEVELS, perBagTable, PREMIUMS,
  sensitivity, SOURCES, typicalBags,
} from "@/lib/channels";
import { gbp, num, pct, signedPct } from "@/lib/format";

type Kind = "Clearance lot" | "Selected single";
const FALLBACK: Record<Kind, [number, number]> = { "Clearance lot": [150, 30], "Selected single": [600, 300] };

export function ShopifyBreakeven() {
  const t = useTracker();
  const [kind, setKind] = useState<Kind>("Clearance lot");
  return (
    <>
      <PageIntro chip="Shopify break-even" title="Should he sell through his own store, and which bags?">
        Selling the same bag on his own Shopify store against each marketplace. Most UK marketplaces are now free or
        nearly free for sellers, so his own store only pays off if it earns a higher price or saves fees that outweigh
        its extra costs.
      </PageIntro>
      <DataBar />
      <div className="mb-5">
        <Segmented label="Bag type" value={kind} onChange={setKind} options={[
          { value: "Clearance lot", label: "Clearance-lot bag" },
          { value: "Selected single", label: "Premium selected bag" },
        ]} />
      </div>
      {/* A fresh form per bag type and per data file, like the Streamlit tabs */}
      <Breakeven key={`${kind}|${t.version}`} kind={kind} />
      <div className="mt-8">
        <SellingSetup />
      </div>
    </>
  );
}

function Breakeven({ kind }: { kind: Kind }) {
  const t = useTracker();
  const typ = typicalBags(t.bags)[kind];
  const [price, setPrice] = useState(isFinite(typ.price) ? Math.round(typ.price) : FALLBACK[kind][0]);
  const [landed, setLanded] = useState(isFinite(typ.landed) ? Math.round(typ.landed) : FALLBACK[kind][1]);
  const [monthly, setMonthly] = useState(4);
  const [premium, setPremium] = useState(0);
  const [discount, setDiscount] = useState(0);

  const opts = { business: t.business, shopifyPremium: premium, marketplaceDiscount: discount, fees: t.fees };
  const per = perBagTable(price, landed, t.shop, opts);
  const { rows: be, summary } = breakevenTable(price, landed, t.shop, monthly, opts);
  const best = bestMarketplace(be);
  const beaten = be.filter((r) => r.advantage > 0).map((r) => r.compared_with);
  const [compare, setCompare] = useState<string | null>(null);
  const vs = compare && be.some((r) => r.compared_with === compare) ? compare : best.compared_with;
  const grid = sensitivity(price, landed, t.shop, vs, opts);
  const fixed = fixedMonthly(t.shop);
  const xs = Array.from({ length: 11 }, (_, i) => i);
  const label = kind === "Clearance lot" ? "clearance-lot" : "premium selected";

  return (
    <>
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Typical sale price" value={price} onChange={setPrice} step={5} />
          <NumberField label="Landed cost" value={landed} onChange={setLanded} step={5} />
          <NumberField label="Bags sold on Shopify per month" value={monthly} onChange={setMonthly} prefix="" />
        </div>
        <p className="mt-2 text-xs text-faint">
          Defaults: median sale price and average landed cost of {label} bags in the tracker ({typ.n_sold} sold).
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <PercentSlider label="Price premium on his own store" value={premium} onChange={setPremium} max={50}
            hint="A trusted brand may charge more than a marketplace for the same bag." />
          <PercentSlider label="Discount on Vinted / Depop / eBay" value={discount} onChange={setDiscount} max={50}
            hint="A premium bag may not reach full price on a general marketplace." />
        </div>
      </Card>
      {typ.n_sold < 3 && (
        <p className="mt-3 text-sm text-[#7a5717]">Only {typ.n_sold} sold {label} bag(s) so far: treat these results as illustrative.</p>
      )}

      <div className="mt-5">
        {beaten.length === 0 ? (
          <Verdict tone="bad" title={`Shopify earns less per bag than every marketplace at these assumptions.`}>
            To match {best.compared_with} it would need a price premium of about {pct(best.premium_needed)}.
          </Verdict>
        ) : best.advantage > 0 ? (
          <Verdict tone="good" title="Shopify beats every marketplace per bag.">
            It covers the gap in fixed costs from {num(best.bags_to_beat, 1)} bags a month.
          </Verdict>
        ) : (
          <Verdict tone="info" title={`Shopify beats ${beaten.join(", ")} but not ${best.compared_with}.`}>
            To match {best.compared_with} it needs a price premium of about {pct(best.premium_needed)}
            {best.max_marketing > 0 ? `, or marketing under ${gbp(best.max_marketing)} per sale` : "; even with no marketing spend it falls short"}.
          </Verdict>
        )}
      </div>

      <div className="mt-5">
        <StatRow>
          <Stat label="Shopify profit per bag" value={gbp(summary.shopify_profit)} tone={summary.shopify_profit < 0 ? "loss" : undefined} />
          <Stat label={`Best marketplace: ${best.compared_with}`} value={gbp(best.profit_there)} />
          <Stat label="Shopify advantage per bag" value={gbp(best.advantage)} tone={best.advantage < 0 ? "loss" : "gain"} />
          <Stat label="Shopify bags/month to beat it" value={isFinite(best.bags_to_beat) ? num(best.bags_to_beat, 1) : "Never"}
            sub={`fixed costs ${gbp(fixed, 2)} a month`} />
        </StatRow>
      </div>

      <section className="mt-10 grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-display text-lg font-semibold text-ink">Profit per bag by channel</h3>
          <BarList rows={per.map((r) => ({ label: r.channel, value: r.profit }))} />
        </Card>
        <Card>
          <h3 className="font-display text-lg font-semibold text-ink">Monthly profit: Shopify minus each marketplace</h3>
          <p className="mb-3 text-xs text-faint">Above the dashed £0 line, Shopify earns more that month than selling the same bags there.</p>
          <LineChart xs={xs} xLabel="Shopify bags per month" series={be.map((r, i) => ({
            name: r.compared_with, color: SERIES_COLORS[i % SERIES_COLORS.length],
            values: xs.map((v) => v * r.advantage - fixed),
          }))} />
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle title="Break-even against each marketplace" />
        <Card>
          <DataTable rows={be} rowKey={(r) => r.compared_with} columns={[
            { label: "Compared with", value: (r) => r.compared_with },
            { label: "Profit there", value: (r) => gbp(r.profit_there, 2), align: "right" },
            { label: "Shopify advantage", value: (r) => <span className={r.advantage < 0 ? "text-loss" : "text-gain"}>{gbp(r.advantage, 2)}</span>, align: "right" },
            { label: "Bags/month to beat it", value: (r) => (isFinite(r.bags_to_beat) ? num(r.bags_to_beat, 1) : "Never"), align: "right" },
            { label: "Price premium to match", value: (r) => signedPct(r.premium_needed), align: "right" },
            { label: "Max marketing per sale", value: (r) => gbp(r.max_marketing), align: "right" },
            { label: "Monthly difference", value: (r) => gbp(r.monthly_difference), align: "right" },
            { label: "Setup paid back in", value: (r) => (isFinite(r.payback_months) ? `${num(r.payback_months, 1)} months` : "Never"), align: "right" },
          ]} />
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle title="Sensitivity: Shopify advantage per bag"
          sub="Rows: marketing cost to win each buyer. Columns: how much more the bag sells for on his own store. Green means Shopify earns more per bag (before monthly fixed costs)." />
        <Card>
          <div className="mb-4 max-w-xs">
            <Select label="Compare Shopify with" value={vs} options={be.map((r) => r.compared_with)} onChange={setCompare} />
          </div>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-max border-separate border-spacing-1 text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th scope="col" className="text-left font-medium">Marketing ↓ · Premium →</th>
                  {PREMIUMS.map((p) => <th key={p} scope="col" className="font-medium">+{pct(p)}</th>)}
                </tr>
              </thead>
              <tbody>
                {MARKETING_LEVELS.map((m, i) => (
                  <tr key={m}>
                    <th scope="row" className="pr-2 text-left text-xs font-medium text-muted">£{m} marketing</th>
                    {grid[i].map((v, j) => (
                      <td key={j} className={`rounded-md px-2 py-1.5 text-center font-semibold tabular-nums ${v >= 0 ? "bg-brand-soft text-gain" : "bg-loss-soft text-loss"}`}>
                        {gbp(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="mt-10 space-y-4">
        <Fold summary="Per-bag economics">
          <DataTable rows={per} rowKey={(r) => r.channel} columns={[
            { label: "Channel", value: (r) => r.channel },
            { label: "Sale price", value: (r) => gbp(r.sale_price), align: "right" },
            { label: "Platform fees", value: (r) => gbp(r.platform_fees, 2), align: "right" },
            { label: "Fees % of sale", value: (r) => pct(r.fees_pct, 1), align: "right" },
            { label: "Shopify-only costs", value: (r) => gbp(r.shopify_costs, 2), align: "right" },
            { label: "Landed cost", value: (r) => gbp(r.landed_cost), align: "right" },
            { label: "Profit per bag", value: (r) => gbp(r.profit, 2), align: "right" },
            { label: "Margin", value: (r) => pct(r.margin), align: "right" },
          ]} />
        </Fold>
        <Fold summary="Fee sources and notes">
          <ul className="space-y-2 text-sm text-muted">
            {Object.entries(t.fees).map(([name, f]) => (
              <li key={name}><span className="font-semibold text-ink">{name}:</span> {f.note}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            Published fees checked {FEES_CHECKED}. Sources:{" "}
            {Object.entries(SOURCES).map(([label, href], i) => (
              <span key={href}>{i > 0 && " · "}<a href={href} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{label}</a></span>
            ))}
          </p>
          <p className="mt-2 text-xs text-faint">
            Once trading as a business, buyers have a 14-day right to cancel online purchases on every channel, not just Shopify.
          </p>
        </Fold>
      </section>
    </>
  );
}
