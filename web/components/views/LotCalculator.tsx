"use client";

import { useState } from "react";

import { DataBar } from "@/components/DataBar";
import { DataTable } from "@/components/DataTable";
import { NumberField, PercentSlider } from "@/components/inputs";
import { useTracker } from "@/components/TrackerProvider";
import { Card, PageIntro, SectionTitle, Stat, StatRow, Verdict } from "@/components/ui";
import { lotHistory, lotScenario, maxLotPrice } from "@/lib/calc";
import { gbp, pct } from "@/lib/format";
import type { Bag } from "@/lib/tracker";

export function LotCalculator() {
  const { bags, version } = useTracker();
  return (
    <>
      <PageIntro chip="Lot calculator" title="Should I buy this lot, and what's the most I should pay?">
        Clearance lots arrive unselected, so the real decision is the price of the whole lot. Defaults come from
        past clearance-lot bags; type in a new offer to test it.
      </PageIntro>
      <DataBar />
      <LotBody key={version} bags={bags} />
    </>
  );
}

const roundOr = (x: number, fallback: number) => (isFinite(x) ? Math.round(x) : fallback);

function LotBody({ bags }: { bags: Bag[] }) {
  const h = lotHistory(bags);
  const [lotPrice, setLotPrice] = useState(roundOr(h.avg_lot_price, 1000));
  const [nBags, setNBags] = useState(Math.max(1, roundOr(h.avg_lot_bags, 15)));
  const [inbound, setInbound] = useState(roundOr(h.avg_lot_inbound, 150));
  const [other, setOther] = useState(0);
  const [sellThrough, setSellThrough] = useState(isFinite(h.sell_through) ? Math.round(h.sell_through * 100) / 100 : 0.7);
  const [net, setNet] = useState(roundOr(h.net_median, 100));
  const [target, setTarget] = useState(1);

  if (h.bags === 0) {
    return <Verdict tone="info" title="No clearance-lot bags yet">Set “Sourcing type” to “Clearance lot” in the tracker to use this calculator.</Verdict>;
  }

  const r = lotScenario(lotPrice, nBags, inbound, other, sellThrough, net);
  const mx = maxLotPrice(nBags, inbound, other, sellThrough, net, target);
  const scenarios = isFinite(h.net_p25) ? [
    { name: "Cautious", st: Math.max(sellThrough - 0.15, 0), net: h.net_p25 },
    { name: "Expected", st: sellThrough, net },
    { name: "Strong", st: Math.min(sellThrough + 0.1, 1), net: h.net_p75 },
  ].map((s) => ({ ...s, ...lotScenario(lotPrice, nBags, inbound, other, s.st, s.net) })) : [];

  return (
    <>
      <p className="mb-5 text-sm text-muted">
        Based on {h.bags} clearance-lot bags across {h.lots} lot(s): {h.sold} sold, typical net per sold bag{" "}
        <span className="font-semibold text-ink">{gbp(h.net_median)}</span> (middle half {gbp(h.net_p25)}–{gbp(h.net_p75)}).
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink">The offer</h2>
          <p className="mb-4 text-xs text-faint">Pre-filled with his typical past lot.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Lot price" value={lotPrice} onChange={setLotPrice} step={25} />
            <NumberField label="Bags in the lot" value={nBags} onChange={(v) => setNBags(Math.max(1, Math.round(v)))} min={1} prefix="" />
            <NumberField label="Shipping + import duty/VAT (whole lot)" value={inbound} onChange={setInbound} step={10} />
            <NumberField label="Cleaning / repair per bag" value={other} onChange={setOther} step={5} />
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink">Your assumptions</h2>
          <p className="mb-4 text-xs text-faint">Pre-filled from what past lots actually did.</p>
          <div className="space-y-5">
            <PercentSlider label="Share of bags you expect to sell" value={sellThrough} onChange={setSellThrough} step={1} />
            <NumberField label="Net received per sold bag, after fees & postage" value={net} onChange={setNet} step={5} />
            <PercentSlider label="Return you want on the money spent" value={target} onChange={setTarget} max={300} step={10}
              hint="100% = double your money (£1 profit for every £1 spent)." />
          </div>
        </Card>
      </div>

      <div className="mt-5">
        {mx <= 0 ? (
          <Verdict tone="bad" title={`At these assumptions, no lot price reaches a ${pct(target)} return.`} />
        ) : lotPrice <= mx ? (
          <Verdict tone="good" title={<>Worth it: pay up to {gbp(mx)} and still hit a {pct(target)} return.</>}>
            The offer is {gbp(mx - lotPrice)} under that walk-away price.
          </Verdict>
        ) : (
          <Verdict tone="warn" title={<>Too expensive: to hit a {pct(target)} return, pay at most {gbp(mx)}.</>}>
            That&apos;s {gbp(lotPrice - mx)} less than the offer.
          </Verdict>
        )}
      </div>

      <div className="mt-5">
        <StatRow>
          <Stat label="Total cost" value={gbp(r.cost)} sub={`${gbp(r.cost_per_bag)} per bag`} />
          <Stat label="Expected net revenue" value={gbp(r.net_revenue)} sub={`${r.bags_sold.toFixed(1)} bags sold`} />
          <Stat label="Expected profit" value={gbp(r.profit)} sub={`${pct(r.roi)} return`} tone={r.profit < 0 ? "loss" : "gain"} />
          <Stat label="Break-even sell-through" value={pct(r.breakeven_sell_through)} sub="share of bags that must sell to cover cost" />
        </StatRow>
      </div>

      {scenarios.length > 0 && (
        <section className="mt-10">
          <SectionTitle title="Scenarios" sub="Cautious and Strong use the lower and upper quartile of past net payouts per sold bag, with sell-through 15 points lower or 10 points higher." />
          <Card>
            <DataTable rows={scenarios} rowKey={(s) => s.name} columns={[
              { label: "Scenario", value: (s) => s.name },
              { label: "Sell-through", value: (s) => pct(s.st), align: "right" },
              { label: "Net per sold bag", value: (s) => gbp(s.net), align: "right" },
              { label: "Profit", value: (s) => <span className={s.profit < 0 ? "text-loss" : "text-ink"}>{gbp(s.profit)}</span>, align: "right" },
              { label: "Return", value: (s) => pct(s.roi), align: "right" },
            ]} />
          </Card>
        </section>
      )}
    </>
  );
}
