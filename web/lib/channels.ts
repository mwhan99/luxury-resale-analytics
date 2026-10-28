/**
 * Channel fee schedules and Shopify break-even maths. A copy of channels.py.
 *
 * Fees are the published UK seller fees checked on 13 Oct 2026 (see SOURCES).
 * Platforms change fees often: update FEES and FEES_CHECKED here AND in
 * channels.py when they do, then re-run scripts/export_golden.py.
 */
import type { Bag } from "./tracker";
import { mean, median } from "./stats";

export const FEES_CHECKED = "13 Oct 2026";

export type Fees = {
  commission_pct: number;
  flat_fee: number; // flat selling fee charged instead of commission...
  flat_below: number; // ...when the price is below this
  pay_pct: number; // payment processing
  pay_fixed: number;
  pay_min: number;
  order_fee: number;
  reg_pct: number; // regulatory / other % fees
  vat_mult: number; // 1.2 when fees are quoted ex VAT and he can't reclaim it
  private_only: boolean; // not available once trading as a business
  note: string;
};

const fees = (f: Partial<Fees>): Fees => ({
  commission_pct: 0, flat_fee: 0, flat_below: 0, pay_pct: 0, pay_fixed: 0, pay_min: 0,
  order_fee: 0, reg_pct: 0, vat_mult: 1, private_only: false, note: "", ...f,
});

export const SHOPIFY = "Shopify (own store)";

export type FeeTable = Record<string, Fees>;

export const FEES: FeeTable = {
  Vinted: fees({ note: "No seller commission; the buyer pays Vinted's fee at checkout. " +
    "Vinted Pro is also listed as free for business sellers." }),
  Depop: fees({ pay_pct: 0.029, pay_fixed: 0.30,
    note: "UK selling fee removed 20 Mar 2024; 2.9% + 30p payment processing. Optional 12% boost not included." }),
  "eBay (private)": fees({ private_only: true,
    note: "Free for UK private sellers; not available once trading as a business." }),
  "eBay (business)": fees({ commission_pct: 0.129, order_fee: 0.40, reg_pct: 0.0035, vat_mult: 1.2,
    note: "Women's bags 12.9% up to £800 (7% above, not modelled) + 40p/order + 0.35% regulatory; " +
      "quoted ex VAT, ×1.2 if not VAT-registered." }),
  "Vestiaire Collective": fees({ commission_pct: 0.12, flat_fee: 10, flat_below: 83, pay_pct: 0.03, pay_min: 3,
    note: "12% selling fee (flat £10 under £83) + 3% processing, £3 min. GBP listings from 9 Mar 2026." }),
  [SHOPIFY]: fees({ pay_pct: 0.02, pay_fixed: 0.25,
    note: "Shopify Payments, Basic plan, UK online cards: 2% + 25p." }),
};

export const SOURCES: Record<string, string> = {
  "Vinted UK price list": "https://www.vinted.co.uk/pricelist",
  "Vinted Pro in the UK (Value Added Resource)": "https://www.valueaddedresource.net/vinted-pro-launches-in-uk/",
  "Depop UK fees (Margeo)": "https://margeoapp.com/en/blog/depop-seller-fees-explained/",
  "eBay UK private seller fees": "https://www.ebay.co.uk/help/selling/fees-credits-invoices/selling-fees?id=4822",
  "eBay UK business seller fees": "https://www.ebay.co.uk/help/selling/fees-credits-invoices/fees-business-sellers?id=4809",
  "Vestiaire Collective selling fees": "https://faq.vestiairecollective.com/hc/en-gb/articles/24659638721425-Seller-Selling-Fees",
  "Shopify UK pricing (Charle)": "https://www.charle.co.uk/articles/shopify-pricing/",
};

/** Costs of selling through his own store that marketplaces don't have.
 * Defaults are assumptions, not sourced figures. */
export type ShopifyCosts = {
  postage: number; // tracked, signed-for; buyers expect free/cheap shipping
  packaging: number; // branded box / dust bag
  marketing: number; // cost to win each buyer (ads, gifting): the big unknown
  authentication: number; // certificate, since no platform vouches for him
  return_rate: number; // 14-day cancellation right for online business sales
  return_cost: number;
  plan: number; // Basic, monthly billing (£19 if billed annually)
  apps: number;
  domain: number;
  other_fixed: number;
  setup: number; // one-off
};

export const DEFAULT_SHOP: ShopifyCosts = {
  postage: 10, packaging: 5, marketing: 25, authentication: 20, return_rate: 0.10, return_cost: 15,
  plan: 25, apps: 20, domain: 1.25, other_fixed: 0, setup: 150,
};

export const perBag = (s: ShopifyCosts) =>
  s.postage + s.packaging + s.marketing + s.authentication + s.return_rate * s.return_cost;

export const fixedMonthly = (s: ShopifyCosts) => s.plan + s.apps + s.domain + s.other_fixed;

export function platformFees(f: Fees, price: number): number {
  const commission = f.flat_fee > 0 && price < f.flat_below ? f.flat_fee : f.commission_pct * price;
  const payment = f.pay_pct + f.pay_fixed + f.pay_min === 0
    ? 0 : Math.max(f.pay_pct * price + f.pay_fixed, f.pay_min);
  return (commission + payment + f.order_fee + f.reg_pct * price) * f.vat_mult;
}

export type ChannelOptions = {
  business?: boolean;
  shopifyPremium?: number; // how much more the bag sells for on his own store
  marketplaceDiscount?: number; // how much less it sells for on Vinted / Depop / eBay
  fees?: FeeTable;
};

export type PerBagRow = {
  channel: string;
  sale_price: number;
  platform_fees: number;
  fees_pct: number;
  shopify_costs: number;
  landed_cost: number;
  profit: number;
  margin: number;
};

/** Profit on one bag through each channel. */
export function perBagTable(price: number, landed: number, shop: ShopifyCosts,
  { business = false, shopifyPremium = 0, marketplaceDiscount = 0, fees = FEES }: ChannelOptions = {}): PerBagRow[] {
  const rows: PerBagRow[] = [];
  for (const [name, f] of Object.entries(fees)) {
    if (business && f.private_only) continue;
    let p: number;
    let extra = 0;
    if (name === SHOPIFY) {
      p = price * (1 + shopifyPremium);
      extra = perBag(shop);
    } else if (name === "Vestiaire Collective") {
      p = price;
    } else {
      p = price * (1 - marketplaceDiscount);
    }
    const fee = platformFees(f, p);
    const profit = p - fee - extra - landed;
    rows.push({
      channel: name, sale_price: p, platform_fees: fee, fees_pct: p ? fee / p : NaN,
      shopify_costs: extra, landed_cost: landed, profit, margin: p ? profit / p : NaN,
    });
  }
  return rows;
}

export type BreakevenRow = {
  compared_with: string;
  profit_there: number;
  advantage: number; // Shopify profit per bag minus this channel's
  bags_to_beat: number; // Shopify bags a month to beat it
  premium_needed: number; // price premium for Shopify to match
  max_marketing: number; // most Shopify can spend to win a buyer and still match
  monthly_difference: number;
  payback_months: number;
};

export type BreakevenSummary = { shopify_profit: number; fixed: number; bags_to_cover_fixed: number };

export function breakevenTable(price: number, landed: number, shop: ShopifyCosts, monthlyBags: number,
  opts: ChannelOptions = {}): { rows: BreakevenRow[]; summary: BreakevenSummary } {
  const t = perBagTable(price, landed, shop, opts);
  const sp = t.find((r) => r.channel === SHOPIFY)!.profit;
  const f = FEES[SHOPIFY];
  const rate = f.vat_mult * (f.commission_pct + f.pay_pct + f.reg_pct);
  const fixedFee = f.vat_mult * (f.pay_fixed + f.order_fee);
  const fixed = fixedMonthly(shop);
  const rows = t.filter((r) => r.channel !== SHOPIFY).map((r) => {
    const cp = r.profit;
    const adv = sp - cp;
    const pNeeded = (cp + fixedFee + perBag(shop) + landed) / (1 - rate);
    const monthlyDiff = monthlyBags * adv - fixed;
    return {
      compared_with: r.channel,
      profit_there: cp,
      advantage: adv,
      bags_to_beat: adv > 0 ? fixed / adv : NaN,
      premium_needed: pNeeded / price - 1,
      max_marketing: sp + shop.marketing - cp,
      monthly_difference: monthlyDiff,
      payback_months: monthlyDiff > 0 ? shop.setup / monthlyDiff : NaN,
    };
  });
  return { rows, summary: { shopify_profit: sp, fixed, bags_to_cover_fixed: sp > 0 ? fixed / sp : NaN } };
}

/** The marketplace that earns the most per bag (the first one listed wins a tie). */
export function bestMarketplace(rows: BreakevenRow[]): BreakevenRow {
  return rows.reduce((best, r) => (r.profit_there > best.profit_there ? r : best));
}

export const MARKETING_LEVELS = [0, 10, 20, 30, 40, 60, 80];
export const PREMIUMS = [0, 0.05, 0.10, 0.15, 0.20, 0.30];

/** Shopify advantage per bag vs one channel: grid[marketing level][premium]. */
export function sensitivity(price: number, landed: number, shop: ShopifyCosts, compareTo: string,
  opts: ChannelOptions = {}, marketingLevels = MARKETING_LEVELS, premiums = PREMIUMS): number[][] {
  const cp = perBagTable(price, landed, shop, opts).find((r) => r.channel === compareTo)!.profit;
  return marketingLevels.map((m) => premiums.map((prem) => {
    const p = price * (1 + prem);
    return p - platformFees(FEES[SHOPIFY], p) - perBag({ ...shop, marketing: m }) - landed - cp;
  }));
}

export const MIN_OBSERVED_SALES = 2; // need at least this many recorded fees before trusting his own rate

/** His actual fee rate per channel, from sold bags where a fee was really recorded.
 *
 * Only rows with a positive recorded fee count, because a blank fee is stored as
 * "payout = sale price" and would otherwise look like a 0% fee. eBay is skipped:
 * the tracker doesn't say whether a sale was private (free) or business.
 * Returns {channel: [rate, number of sales]}. */
export function observedFeeRates(df: Bag[], minSales = MIN_OBSERVED_SALES): Record<string, [number, number]> {
  const s = df.filter((b) => b.is_sold && b.fees > 0 && b.sale > 0);
  const out: Record<string, [number, number]> = {};
  for (const name of Object.keys(FEES)) {
    if (name === SHOPIFY || name.startsWith("eBay")) continue;
    const x = s.filter((b) => b.channel === name);
    if (x.length >= minSales) {
      const fees = x.reduce((a, b) => a + b.fees, 0);
      const sales = x.reduce((a, b) => a + b.sale, 0);
      out[name] = [fees / sales, x.length];
    }
  }
  return out;
}

/** Published fee schedules, with his actual rate swapped in where observed. */
export function feeTable(observed: Record<string, [number, number]> | null = null): FeeTable {
  const table = { ...FEES };
  for (const [name, [rate, n]] of Object.entries(observed ?? {})) {
    table[name] = fees({
      commission_pct: rate, private_only: FEES[name].private_only,
      note: `His actual rate: ${(rate * 100).toFixed(1)}% of the sale price, from ${n} recorded sales ` +
        `(published schedule: ${FEES[name].note})`,
    });
  }
  return table;
}

export type Typical = { price: number; landed: number; n_sold: number };

/** Typical sale price and landed cost per sourcing type, from the tracker. */
export function typicalBags(df: Bag[]): Record<"Clearance lot" | "Selected single", Typical> {
  const one = (kind: string): Typical => {
    const x = df.filter((b) => b.sourcing === kind);
    const sold = x.filter((b) => b.is_sold);
    return { price: median(sold.map((b) => b.sale)), landed: mean(x.map((b) => b.landed_cost)), n_sold: sold.length };
  };
  return { "Clearance lot": one("Clearance lot"), "Selected single": one("Selected single") };
}
