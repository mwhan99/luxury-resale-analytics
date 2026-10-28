/** Core calculations. A copy of calc.py: same names, same rules. */
import { MIN_COMPS, type Bag } from "./tracker";
import { mean, quantile, sum } from "./stats";

// ---------------------------------------------------------------- summaries
export type Kpis = {
  bags: number;
  sold: number;
  sell_through: number;
  spend: number;
  revenue: number;
  profit: number;
  margin: number;
  roi_sold: number;
  unsold_cost: number;
  avg_days: number;
  days_known: number;
  estimated_rows: number;
};

const isEstimated = (b: Bag) => b.confidence === "Estimated" || b.confidence === "Unknown";

export function kpis(df: Bag[]): Kpis {
  const s = df.filter((b) => b.is_sold);
  const revenue = sum(s.map((b) => b.sale));
  const profit = sum(s.map((b) => b.profit));
  const soldCost = sum(s.map((b) => b.landed_cost));
  return {
    bags: df.length,
    sold: s.length,
    sell_through: df.length ? s.length / df.length : NaN,
    spend: sum(df.map((b) => b.landed_cost)),
    revenue,
    profit,
    margin: revenue ? profit / revenue : NaN,
    roi_sold: soldCost ? profit / soldCost : NaN,
    unsold_cost: sum(df.filter((b) => !b.is_sold).map((b) => b.landed_cost)),
    avg_days: mean(s.map((b) => b.days_to_sell)),
    days_known: s.filter((b) => !isNaN(b.days_to_sell)).length,
    estimated_rows: df.filter(isEstimated).length,
  };
}

export type GroupRow = {
  label: string | null;
  bags: number;
  sold: number;
  spend: number;
  revenue: number;
  profit: number;
  unsold_cost: number;
  sell_through: number;
  margin: number;
  return_per_pound: number;
};

export type GroupBy = "sourcing" | "brand" | "channel" | "lot";

/** One row per group, sorted by profit (highest first). */
export function groupSummary(df: Bag[], by: GroupBy): GroupRow[] {
  const groups = new Map<string | null, Bag[]>();
  for (const b of df) {
    const key = b[by];
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const keys = [...groups.keys()].sort((a, b) =>
    a === null ? 1 : b === null ? -1 : a < b ? -1 : a > b ? 1 : 0,
  );
  const rows = keys.map((label) => {
    const g = groups.get(label)!;
    const sold = g.filter((b) => b.is_sold);
    const revenue = sum(sold.map((b) => b.sale));
    const profit = sum(g.map((b) => b.profit));
    const soldCost = sum(sold.map((b) => b.landed_cost));
    return {
      label,
      bags: g.length,
      sold: sold.length,
      spend: sum(g.map((b) => b.landed_cost)),
      revenue,
      profit,
      unsold_cost: sum(g.filter((b) => !b.is_sold).map((b) => b.landed_cost)),
      sell_through: sold.length / g.length,
      margin: revenue > 0 ? profit / revenue : NaN,
      return_per_pound: soldCost > 0 ? profit / soldCost : NaN,
    };
  });
  return rows.sort((a, b) => b.profit - a.profit);
}

// ---------------------------------------------------------------- lot calculator
export type LotHistory = {
  bags: number;
  lots: number;
  sold: number;
  sell_through: number;
  net_p25: number;
  net_median: number;
  net_p75: number;
  avg_landed: number;
  avg_lot_bags: number;
  avg_lot_price: number;
  avg_lot_inbound: number;
};

/** What past clearance-lot bags tell us. */
export function lotHistory(df: Bag[]): LotHistory {
  const lots = df.filter((b) => b.sourcing === "Clearance lot");
  const sold = lots.filter((b) => b.is_sold);
  const net = sold.map((b) => b.net_after_shipping);
  const byLot = new Map<string, Bag[]>();
  for (const b of lots) byLot.set(b.lot, [...(byLot.get(b.lot) ?? []), b]);
  const perLot = [...byLot.values()];
  return {
    bags: lots.length,
    lots: byLot.size,
    sold: sold.length,
    sell_through: lots.length ? sold.length / lots.length : NaN,
    net_p25: quantile(net, 0.25),
    net_median: quantile(net, 0.5),
    net_p75: quantile(net, 0.75),
    avg_landed: mean(lots.map((b) => b.landed_cost)),
    // typical lot, used as calculator defaults
    avg_lot_bags: mean(perLot.map((g) => g.length)),
    avg_lot_price: mean(perLot.map((g) => sum(g.map((b) => b.purchase_gbp)))),
    avg_lot_inbound: mean(perLot.map((g) => sum(g.map((b) => b.ship_in)) + sum(g.map((b) => b.duty)))),
  };
}

export type LotScenario = {
  cost: number;
  cost_per_bag: number;
  bags_sold: number;
  net_revenue: number;
  profit: number;
  roi: number;
  breakeven_sell_through: number;
};

/** Expected result of buying one lot. */
export function lotScenario(lotPrice: number, nBags: number, inboundTotal: number, otherPerBag: number,
  sellThrough: number, netPerSold: number): LotScenario {
  const cost = lotPrice + inboundTotal + otherPerBag * nBags;
  const sold = nBags * sellThrough;
  const revenue = sold * netPerSold;
  const profit = revenue - cost;
  return {
    cost,
    cost_per_bag: nBags ? cost / nBags : NaN,
    bags_sold: sold,
    net_revenue: revenue,
    profit,
    roi: cost ? profit / cost : NaN,
    breakeven_sell_through: nBags && netPerSold ? cost / (nBags * netPerSold) : NaN,
  };
}

/** Highest lot price that still hits the target return. */
export function maxLotPrice(nBags: number, inboundTotal: number, otherPerBag: number,
  sellThrough: number, netPerSold: number, targetRoi: number): number {
  const revenue = nBags * sellThrough * netPerSold;
  return revenue / (1 + targetRoi) - inboundTotal - otherPerBag * nBags;
}

// ---------------------------------------------------------------- single bag calculator
/** Sold bags of the same brand, narrowed to the same sourcing type and condition
 * when there are enough of them. Returns the bags and a description. */
export function comparables(df: Bag[], brand: string, condition: string | null = null,
  sourcing: string | null = "Selected single"): { comps: Bag[]; basis: string } {
  let s = df.filter((b) => b.is_sold && b.brand === brand);
  let basis = `all sold ${brand} bags`;
  if (sourcing) {
    const same = s.filter((b) => b.sourcing === sourcing);
    if (same.length >= MIN_COMPS) {
      s = same;
      basis = `sold ${brand} bags bought as '${sourcing}'`;
    }
  }
  if (condition) {
    const same = s.filter((b) => b.condition === condition);
    if (same.length >= MIN_COMPS) {
      s = same;
      basis += ` in '${condition}' condition`;
    }
  }
  return { comps: s, basis };
}

export type Signal = "BUY" | "PASS" | "CHECK";

export function buySignal(bestMargin: number, nComps: number, minMargin: number): [Signal, string] {
  const p = `${Math.round(minMargin * 100)}%`;
  if (nComps < MIN_COMPS) {
    return ["CHECK", `Only ${nComps} comparable sale(s): the estimate is a guess. ` +
      "Use your own judgment or enter an expected price manually."];
  }
  if (bestMargin >= minMargin) return ["BUY", `Best channel clears your ${p} minimum margin.`];
  return ["PASS", `No channel reaches your ${p} minimum margin at this price.`];
}

// ---------------------------------------------------------------- data quality
export type QualityIssue = { id: string; brand: string | null; issues: string[] };

/** `today` is passed in so the page can decide when to read the clock. */
export function qualityIssues(df: Bag[], today: Date): QualityIssue[] {
  const out: QualityIssue[] = [];
  for (const r of df) {
    const issues: string[] = [];
    if (r.is_sold) {
      if (isNaN(r.sale)) issues.push("Sold but no sale price");
      if (isNaN(r.payout)) issues.push("Sold but no net payout (fees unknown)");
      if (!r.date_sold || !r.date_listed) issues.push("Missing listed/sold date (can't measure days to sell)");
      if (r.sale > r.list_price) issues.push("Sale price above first list price");
    }
    if (isNaN(r.price_orig)) issues.push("No purchase price");
    if (!r.purchase_date) issues.push("No purchase date");
    else if (r.purchase_date > today) issues.push("Purchase date in the future (day/month swapped?)");
    if (r.sourcing === "Clearance lot" && isNaN(r.lot_total)) issues.push("Lot total price not recorded");
    if (isEstimated(r)) issues.push(`Marked ${r.confidence}`);
    if (issues.length) out.push({ id: r.id, brand: r.brand, issues });
  }
  return out;
}
