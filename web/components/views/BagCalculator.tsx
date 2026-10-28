"use client";

import { useState } from "react";

import { DataBar } from "@/components/DataBar";
import { DataTable } from "@/components/DataTable";
import { NumberField, PercentSlider, Select } from "@/components/inputs";
import { SellingSetup } from "@/components/SellingSetup";
import { useTracker } from "@/components/TrackerProvider";
import { Card, PageIntro, Verdict } from "@/components/ui";
import { buySignal, comparables } from "@/lib/calc";
import { FEES_CHECKED, perBagTable } from "@/lib/channels";
import { gbp, pct } from "@/lib/format";
import { median } from "@/lib/stats";
import { MIN_COMPS } from "@/lib/tracker";

// The tracker's own condition list (its "Lists" sheet)
const CONDITIONS = ["New with tags", "Excellent", "Very good", "Good", "Satisfactory", "Fair"];

export function BagCalculator() {
  const t = useTracker();
  const brands = [...new Set(t.bags.map((b) => b.brand).filter((b): b is string => !!b))].sort();
  if (!brands.includes("Other")) brands.push("Other");
  const conditions = ["Any", ...new Set([...CONDITIONS, ...t.bags.map((b) => b.condition).filter((c): c is string => !!c)])];

  // Start on the brand of the latest hand-picked bag (this calculator is for those),
  // or else the brand with the most sales, so the first view has real comparables.
  const picked = t.bags.filter((b) => b.sourcing === "Selected single" && b.brand).at(-1)?.brand;
  const sales = (b: string) => t.bags.filter((x) => x.is_sold && x.brand === b).length;
  const startBrand = picked ?? brands.reduce((best, b) => (sales(b) > sales(best) ? b : best), brands[0]);
  const [brand, setBrand] = useState(startBrand);
  const [cond, setCond] = useState("Any");
  const [cost, setCost] = useState(250);
  const [inbound, setInbound] = useState(50);
  const [minMargin, setMinMargin] = useState(0.25);
  // The expected price follows the comparables until you type your own.
  const [override, setOverride] = useState<{ key: string; value: number } | null>(null);

  const shownBrand = brands.includes(brand) ? brand : startBrand;
  const { comps, basis } = comparables(t.bags, shownBrand, cond === "Any" ? null : cond);
  const key = `${t.version}|${shownBrand}|${cond}`;
  const suggested = comps.length ? Math.round(median(comps.map((b) => b.sale))) : 300;
  const price = override?.key === key ? override.value : suggested;

  const landed = cost + inbound;
  const rows = perBagTable(price, landed, t.shop, { business: t.business, fees: t.fees })
    .map((r) => ({ ...r, roi: landed ? r.profit / landed : NaN }))
    .sort((a, b) => b.profit - a.profit);
  const best = rows[0];
  const [sig, why] = buySignal(best.margin, comps.length, minMargin);
  const tone = { BUY: "good", PASS: "bad", CHECK: "warn" } as const;

  return (
    <>
      <PageIntro chip="Bag calculator" title="Is this bag worth buying, and where should I sell it?">
        For hand-picked bags: estimate the sale price from comparable past sales, then compare the profit on every
        channel after fees.
      </PageIntro>
      <DataBar />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">The bag</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Brand" value={shownBrand} options={brands} onChange={setBrand} />
            <Select label="Condition" value={cond} options={conditions} onChange={setCond} />
            <NumberField label="Purchase price" value={cost} onChange={setCost} step={10} />
            <NumberField label="Shipping + duty/VAT + authentication" value={inbound} onChange={setInbound} step={5} />
          </div>
          <div className="mt-5">
            <PercentSlider label="Minimum margin you'll accept" value={minMargin} onChange={setMinMargin} max={80} />
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink">Comparable sales: {comps.length} bag(s)</h2>
          <p className="mb-4 text-xs text-faint">
            Based on {basis}. Narrows to the same sourcing type and condition once there are at least {MIN_COMPS} matches.
          </p>
          {comps.length > 0 && (
            <div className="max-h-56 overflow-y-auto">
              <DataTable rows={comps} rowKey={(b, i) => `${b.id}-${i}`} columns={[
                { label: "Bag", value: (b) => b.id },
                { label: "Sold for", value: (b) => gbp(b.sale), align: "right" },
                { label: "Condition", value: (b) => b.condition ?? "–" },
                { label: "Channel", value: (b) => b.channel ?? "–" },
                { label: "Model", value: (b) => b.model ?? "–" },
              ]} />
            </div>
          )}
          <div className="mt-4 max-w-xs">
            <NumberField
              label="Expected sale price"
              value={price}
              onChange={(v) => setOverride({ key, value: v })}
              step={10}
              hint={comps.length ? "The median of the comparables. Edit freely." : "No comparables: enter your own estimate."}
            />
          </div>
        </Card>
      </div>

      <div className="mt-5">
        <Verdict tone={tone[sig]} title={<>{sig}: best channel is {best.channel}, {gbp(best.profit)} profit at a {pct(best.margin)} margin.</>}>
          {why}
        </Verdict>
      </div>

      <Card className="mt-5">
        <DataTable rows={rows} rowKey={(r) => r.channel} columns={[
          { label: "Channel", value: (r) => r.channel },
          { label: "Platform fees", value: (r) => gbp(r.platform_fees), align: "right" },
          { label: "Shopify-only costs", value: (r) => gbp(r.shopify_costs), align: "right" },
          { label: "Profit per bag", value: (r) => <span className={r.profit < 0 ? "text-loss" : "text-ink"}>{gbp(r.profit)}</span>, align: "right" },
          { label: "Margin", value: (r) => pct(r.margin), align: "right" },
          { label: "Profit per £1", value: (r) => gbp(r.roi, 2), align: "right" },
        ]} />
        <p className="mt-4 text-xs text-faint">
          Platform fees: {t.feeBasis} (published fees checked {FEES_CHECKED}). Shopify costs come from the selling
          setup below. Assumes the same price on every channel.
        </p>
      </Card>

      <div className="mt-5">
        <SellingSetup />
      </div>
    </>
  );
}
