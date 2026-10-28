/**
 * The TypeScript maths must give the same answers as calc.py and channels.py.
 * The expected answers come from Python: run `python scripts/export_golden.py`
 * after changing the Python, then `npm test`.
 */
import { describe, expect, it } from "vitest";
import golden from "./__fixtures__/golden.json";
import demoRows from "./demo-rows.json";
import * as calc from "./calc";
import * as ch from "./channels";
import { readFileSync } from "node:fs";
import { readTracker } from "./read-xlsx";
import { loadTracker, toDate, toNumber, type RawRow } from "./tracker";

const df = loadTracker(demoRows as RawRow[]);
type G = Record<string, unknown>;

/** Python's NaN arrives as null. Numbers must agree to 9 significant digits. */
function same(actual: unknown, expected: unknown, where: string) {
  if (expected === null) {
    expect(actual === null || (typeof actual === "number" && isNaN(actual)), `${where}: expected empty, got ${actual}`).toBe(true);
  } else if (typeof expected === "number") {
    expect(typeof actual, where).toBe("number");
    expect(Math.abs((actual as number) - expected), `${where}: ${actual} vs ${expected}`)
      .toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(expected)));
  } else {
    expect(actual, where).toEqual(expected);
  }
}

function sameObject(actual: G, expected: G, where: string) {
  for (const [k, v] of Object.entries(expected)) same(actual[k], v, `${where}.${k}`);
}

// Python column names -> TypeScript field names
const GROUP_COLS: Record<string, string> = {
  label: "label", Bags: "bags", Sold: "sold", "Spend (£)": "spend", "Revenue (£)": "revenue",
  "Profit (£)": "profit", "Unsold stock at cost (£)": "unsold_cost", "Sell-through": "sell_through",
  Margin: "margin", "Return per £ on sold bags": "return_per_pound",
};
const PER_BAG_COLS: Record<string, string> = {
  Channel: "channel", "Sale price (£)": "sale_price", "Platform fees (£)": "platform_fees",
  "Fees % of sale": "fees_pct", "Shopify-only costs (£)": "shopify_costs", "Landed cost (£)": "landed_cost",
  "Profit per bag (£)": "profit", Margin: "margin",
};
const BREAKEVEN_COLS: Record<string, string> = {
  "Compared with": "compared_with", "Profit there (£)": "profit_there",
  "Shopify advantage per bag (£)": "advantage", "Shopify bags/month to beat it": "bags_to_beat",
  "Price premium needed to match": "premium_needed", "Max marketing per sale to match (£)": "max_marketing",
  "Monthly profit difference (£)": "monthly_difference", "Setup paid back in (months)": "payback_months",
};
const rename = (row: G, cols: Record<string, string>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [cols[k], v]));

describe("reading the tracker", () => {
  it("keeps every demo bag", () => expect(df.length).toBe(62));

  it("derives the same per-bag numbers", () => {
    golden.derived.forEach((row, i) => {
      const b = df[i] as unknown as G;
      expect(b.id).toBe(row.id);
      sameObject(b, row as G, `bag ${row.id}`);
    });
  });

  it("reads numbers and dates like pandas", () => {
    expect(toNumber(" 12.5 ")).toBe(12.5);
    expect(toNumber("12,5")).toBeNaN(); // comma decimals are not numbers
    expect(toNumber("")).toBeNaN();
    expect(toDate("03/04/2026")?.toISOString().slice(0, 10)).toBe("2026-04-03"); // day first
    expect(toDate("2026-07-12")?.toISOString().slice(0, 10)).toBe("2026-07-12");
    expect(toDate("31/02/2026")).toBeNull();
  });

  it("reads the .xlsx file the same way the upload button does", async () => {
    const file = (name: string) => new Uint8Array(readFileSync(new URL(`../../data/${name}`, import.meta.url))).buffer;
    const fromFile = await readTracker(file("demo_tracker.xlsx"));
    expect(fromFile.map((b) => b.id)).toEqual(df.map((b) => b.id));
    sameObject(calc.kpis(fromFile) as unknown as G, golden.kpis, "kpis from .xlsx");
    expect(fromFile.map((b) => b.purchase_date?.toISOString().slice(0, 10) ?? null))
      .toEqual(df.map((b) => b.purchase_date?.toISOString().slice(0, 10) ?? null));
    expect(await readTracker(file("blank_tracker.xlsx"))).toEqual([]);
  });

  it("skips blank and EXAMPLE rows", () => {
    const rows = loadTracker([{ "Bag ID": "EXAMPLE" }, { "Bag ID": " " }, { "Bag ID": null }, { "Bag ID": "B1" }]);
    expect(rows.map((b) => b.id)).toEqual(["B1"]);
    expect(rows[0].sourcing).toBe("Unspecified");
    expect(rows[0].lot).toBe("No lot ID");
  });
});

describe("performance", () => {
  it("matches the headline numbers", () => {
    sameObject(calc.kpis(df) as unknown as G, golden.kpis, "kpis");
    const ab = df.filter((b) => b.lot === "LOT-A" || b.lot === "LOT-B");
    sameObject(calc.kpis(ab) as unknown as G, golden.kpis_lots_ab, "kpis A+B");
  });

  it.each(["sourcing", "brand", "channel", "lot"] as const)("matches the summary by %s", (by) => {
    const ours = calc.groupSummary(df, by);
    const theirs = (golden.group_summary as Record<string, G[]>)[by].map((r) => rename(r, GROUP_COLS));
    expect(ours.length).toBe(theirs.length);
    for (const row of theirs) {
      const mine = ours.find((r) => r.label === row.label);
      expect(mine, `group ${row.label}`).toBeDefined();
      sameObject(mine as unknown as G, row, `${by}=${row.label}`);
    }
    ours.slice(1).forEach((r, i) => expect(r.profit).toBeLessThanOrEqual(ours[i].profit));
  });
});

describe("lot calculator", () => {
  it("matches the lot history", () => {
    sameObject(calc.lotHistory(df) as unknown as G, golden.lot_history, "lot history");
  });

  it("matches every lot scenario and maximum price", () => {
    for (const c of golden.lot_cases) {
      const i = c.input;
      const r = calc.lotScenario(i.lot_price, i.n_bags, i.inbound_total, i.other_per_bag, i.sell_through, i.net_per_sold);
      sameObject(r as unknown as G, c.scenario, "scenario");
      same(calc.maxLotPrice(i.n_bags, i.inbound_total, i.other_per_bag, i.sell_through, i.net_per_sold, i.target_roi),
        c.max_lot_price, "max lot price");
    }
  });
});

describe("single-bag calculator", () => {
  it("picks the same comparable sales", () => {
    for (const c of golden.comparables) {
      const { comps, basis } = calc.comparables(df, c.brand, c.condition);
      const where = `${c.brand} / ${c.condition}`;
      expect(comps.map((b) => b.id), where).toEqual(c.ids);
      expect(basis, where).toBe(c.basis);
    }
  });

  it("gives the same buy signals", () => {
    expect(calc.buySignal(0.9, 1, 0.25)[0]).toBe("CHECK");
    expect(calc.buySignal(0.3, 5, 0.25)[0]).toBe("BUY");
    expect(calc.buySignal(0.1, 5, 0.25)[0]).toBe("PASS");
  });
});

describe("data quality", () => {
  it("flags the same issues", () => {
    const ours = calc.qualityIssues(df, new Date());
    expect(ours.map((q) => [q.id, q.issues.join("; ")]))
      .toEqual(golden.quality_issues.map((q) => [q["Bag ID"], q.Issues]));
  });
});

describe("channels", () => {
  it("charges the same platform fees", () => {
    for (const c of golden.platform_fees) same(ch.platformFees(ch.FEES[c.channel], c.price), c.fee, `${c.channel} @ ${c.price}`);
  });

  it("finds the same actual fee rates and typical bags", () => {
    const obs = ch.observedFeeRates(df);
    expect(Object.keys(obs)).toEqual(Object.keys(golden.observed_fee_rates));
    for (const [k, [rate, n]] of Object.entries(golden.observed_fee_rates as unknown as Record<string, [number, number]>)) {
      same(obs[k][0], rate, k);
      expect(obs[k][1]).toBe(n);
    }
    const typ = ch.typicalBags(df);
    for (const [k, v] of Object.entries(golden.typical_bags)) sameObject(typ[k as keyof typeof typ] as unknown as G, v as G, k);
  });

  it("matches every per-bag, break-even and sensitivity table", () => {
    const observed = ch.observedFeeRates(df);
    const shops = golden.shops as Record<string, ch.ShopifyCosts>;
    for (const c of golden.channel_cases) {
      const i = c.input;
      const shop = shops[i.shop];
      const opts = { business: i.business, shopifyPremium: i.premium, marketplaceDiscount: i.discount,
        fees: ch.feeTable(i.actual_fees ? observed : null) };
      const where = JSON.stringify(i);

      const per = ch.perBagTable(i.price, i.landed, shop, opts);
      expect(per.map((r) => r.channel), where).toEqual(c.per_bag.map((r) => r.Channel));
      c.per_bag.forEach((r, k) => sameObject(per[k] as unknown as G, rename(r as G, PER_BAG_COLS), where));

      const be = ch.breakevenTable(i.price, i.landed, shop, i.monthly, opts);
      c.breakeven.forEach((r, k) => sameObject(be.rows[k] as unknown as G, rename(r as G, BREAKEVEN_COLS), where));
      sameObject(be.summary as unknown as G, c.summary, where);

      expect(ch.bestMarketplace(be.rows).compared_with, where).toBe(c.sensitivity_vs);
      const grid = ch.sensitivity(i.price, i.landed, shop, c.sensitivity_vs, opts);
      c.sensitivity.forEach((row, m) => row.forEach((v, p) => same(grid[m][p], v, `${where} grid ${m},${p}`)));
    }
  });
});
