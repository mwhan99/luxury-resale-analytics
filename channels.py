"""Channel fee schedules and Shopify break-even maths.

Fees are the published UK seller fees checked on 13 Oct 2026 (see SOURCES).
Platforms change fees often: update FEES and FEES_CHECKED when they do.
The same formulas are used in Shopify_Breakeven_Model.xlsx, and the tests
check the two agree.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

FEES_CHECKED = "13 Oct 2026"


@dataclass(frozen=True)
class Fees:
    commission_pct: float = 0.0
    flat_fee: float = 0.0          # flat selling fee charged instead of commission...
    flat_below: float = 0.0        # ...when the price is below this
    pay_pct: float = 0.0           # payment processing
    pay_fixed: float = 0.0
    pay_min: float = 0.0
    order_fee: float = 0.0
    reg_pct: float = 0.0           # regulatory / other % fees
    vat_mult: float = 1.0          # 1.2 when fees are quoted ex VAT and he can't reclaim it
    private_only: bool = False     # not available once trading as a business
    note: str = ""


FEES: dict[str, Fees] = {
    "Vinted": Fees(note="No seller commission; the buyer pays Vinted's fee at checkout. "
                        "Vinted Pro is also listed as free for business sellers."),
    "Depop": Fees(pay_pct=0.029, pay_fixed=0.30,
                  note="UK selling fee removed 20 Mar 2024; 2.9% + 30p payment processing. "
                       "Optional 12% boost not included."),
    "eBay (private)": Fees(private_only=True,
                           note="Free for UK private sellers; not available once trading as a business."),
    "eBay (business)": Fees(commission_pct=0.129, order_fee=0.40, reg_pct=0.0035, vat_mult=1.2,
                            note="Women's bags 12.9% up to £800 (7% above, not modelled) + 40p/order "
                                 "+ 0.35% regulatory; quoted ex VAT, ×1.2 if not VAT-registered."),
    "Vestiaire Collective": Fees(commission_pct=0.12, flat_fee=10, flat_below=83, pay_pct=0.03, pay_min=3,
                                 note="12% selling fee (flat £10 under £83) + 3% processing, £3 min. "
                                      "GBP listings from 9 Mar 2026."),
    "Shopify (own store)": Fees(pay_pct=0.02, pay_fixed=0.25,
                                note="Shopify Payments, Basic plan, UK online cards: 2% + 25p."),
}
SHOPIFY = "Shopify (own store)"

SOURCES = {
    "Vinted UK price list": "https://www.vinted.co.uk/pricelist",
    "Vinted Pro in the UK (Value Added Resource)": "https://www.valueaddedresource.net/vinted-pro-launches-in-uk/",
    "Depop UK fees (Margeo)": "https://margeoapp.com/en/blog/depop-seller-fees-explained/",
    "eBay UK private seller fees": "https://www.ebay.co.uk/help/selling/fees-credits-invoices/selling-fees?id=4822",
    "eBay UK business seller fees": "https://www.ebay.co.uk/help/selling/fees-credits-invoices/fees-business-sellers?id=4809",
    "Vestiaire Collective selling fees": "https://faq.vestiairecollective.com/hc/en-gb/articles/24659638721425-Seller-Selling-Fees",
    "Shopify UK pricing (Charle)": "https://www.charle.co.uk/articles/shopify-pricing/",
}


@dataclass
class ShopifyCosts:
    """Costs of selling through his own store that marketplaces don't have.
    Defaults are assumptions, not sourced figures."""
    postage: float = 10.0          # tracked, signed-for; buyers expect free/cheap shipping
    packaging: float = 5.0         # branded box / dust bag
    marketing: float = 25.0        # cost to win each buyer (ads, gifting): the big unknown
    authentication: float = 20.0   # certificate, since no platform vouches for him
    return_rate: float = 0.10      # 14-day cancellation right for online business sales
    return_cost: float = 15.0
    plan: float = 25.0             # Basic, monthly billing (£19 if billed annually)
    apps: float = 20.0
    domain: float = 1.25
    other_fixed: float = 0.0
    setup: float = 150.0           # one-off

    @property
    def per_bag(self) -> float:
        return (self.postage + self.packaging + self.marketing + self.authentication
                + self.return_rate * self.return_cost)

    @property
    def fixed_monthly(self) -> float:
        return self.plan + self.apps + self.domain + self.other_fixed


def platform_fees(f: Fees, price: float) -> float:
    if f.flat_fee > 0 and price < f.flat_below:
        commission = f.flat_fee
    else:
        commission = f.commission_pct * price
    if f.pay_pct + f.pay_fixed + f.pay_min == 0:
        payment = 0.0
    else:
        payment = max(f.pay_pct * price + f.pay_fixed, f.pay_min)
    return (commission + payment + f.order_fee + f.reg_pct * price) * f.vat_mult


def per_bag_table(price: float, landed: float, shop: ShopifyCosts, *, business: bool = False,
                  shopify_premium: float = 0.0, marketplace_discount: float = 0.0,
                  fees: dict[str, Fees] = FEES) -> pd.DataFrame:
    """Profit on one bag through each channel.

    shopify_premium: how much more the bag sells for on his own store.
    marketplace_discount: how much less it sells for on Vinted / Depop / eBay
    (e.g. a premium bag may not reach full price on a general marketplace).
    """
    rows = []
    for name, f in fees.items():
        if business and f.private_only:
            continue
        if name == SHOPIFY:
            p = price * (1 + shopify_premium)
            extra = shop.per_bag
        elif name == "Vestiaire Collective":
            p, extra = price, 0.0
        else:
            p, extra = price * (1 - marketplace_discount), 0.0
        fee = platform_fees(f, p)
        profit = p - fee - extra - landed
        rows.append({"Channel": name, "Sale price (£)": p, "Platform fees (£)": fee,
                     "Fees % of sale": fee / p if p else np.nan,
                     "Shopify-only costs (£)": extra, "Landed cost (£)": landed,
                     "Profit per bag (£)": profit, "Margin": profit / p if p else np.nan})
    return pd.DataFrame(rows)


def breakeven_table(price: float, landed: float, shop: ShopifyCosts, monthly_bags: float,
                    **kw) -> tuple[pd.DataFrame, dict]:
    t = per_bag_table(price, landed, shop, **kw)
    s = t.set_index("Channel").loc[SHOPIFY]
    sp = s["Profit per bag (£)"]
    f = FEES[SHOPIFY]
    rate = f.vat_mult * (f.commission_pct + f.pay_pct + f.reg_pct)
    fixed_fee = f.vat_mult * (f.pay_fixed + f.order_fee)
    out = []
    for _, r in t[t["Channel"] != SHOPIFY].iterrows():
        cp = r["Profit per bag (£)"]
        adv = sp - cp
        p_needed = (cp + fixed_fee + shop.per_bag + landed) / (1 - rate)
        monthly_diff = monthly_bags * adv - shop.fixed_monthly
        out.append({
            "Compared with": r["Channel"],
            "Profit there (£)": cp,
            "Shopify advantage per bag (£)": adv,
            "Shopify bags/month to beat it": shop.fixed_monthly / adv if adv > 0 else np.nan,
            "Price premium needed to match": p_needed / price - 1,
            "Max marketing per sale to match (£)": sp + shop.marketing - cp,
            "Monthly profit difference (£)": monthly_diff,
            "Setup paid back in (months)": shop.setup / monthly_diff if monthly_diff > 0 else np.nan,
        })
    summary = {"shopify_profit": sp, "fixed": shop.fixed_monthly,
               "bags_to_cover_fixed": shop.fixed_monthly / sp if sp > 0 else np.nan}
    return pd.DataFrame(out), summary


def sensitivity(price: float, landed: float, shop: ShopifyCosts, compare_to: str,
                marketing_levels=(0, 10, 20, 30, 40, 60, 80),
                premiums=(0, 0.05, 0.10, 0.15, 0.20, 0.30), **kw) -> pd.DataFrame:
    """Shopify advantage per bag vs one channel, across marketing cost × price premium."""
    base = per_bag_table(price, landed, shop, **kw).set_index("Channel")
    cp = base.loc[compare_to, "Profit per bag (£)"]
    grid = {}
    for prem in premiums:
        col = []
        for m in marketing_levels:
            s = ShopifyCosts(**{**shop.__dict__, "marketing": m})
            p = price * (1 + prem)
            col.append(p - platform_fees(FEES[SHOPIFY], p) - s.per_bag - landed - cp)
        grid[f"+{prem:.0%}"] = col
    return pd.DataFrame(grid, index=[f"£{m} marketing" for m in marketing_levels])


MIN_OBSERVED_SALES = 2   # need at least this many recorded fees before trusting his own rate


def observed_fee_rates(df: pd.DataFrame, min_sales: int = MIN_OBSERVED_SALES) -> dict:
    """His actual fee rate per channel, from sold bags where a fee was really recorded.

    Only rows with a positive recorded fee count, because a blank fee is stored as
    "payout = sale price" and would otherwise look like a 0% fee. eBay is skipped:
    the tracker doesn't say whether a sale was private (free) or business.
    Returns {channel: (rate, number_of_sales)}.
    """
    s = df[df["is_sold"] & df["fees"].notna() & (df["fees"] > 0) & (df["sale"] > 0)]
    out = {}
    for name in FEES:
        if name == SHOPIFY or name.startswith("eBay"):
            continue
        x = s[s["channel"] == name]
        if len(x) >= min_sales:
            out[name] = (float(x["fees"].sum() / x["sale"].sum()), len(x))
    return out


def fee_table(observed: dict | None = None) -> dict[str, Fees]:
    """Published fee schedules, with his actual rate swapped in where observed."""
    table = dict(FEES)
    for name, (rate, n) in (observed or {}).items():
        table[name] = Fees(commission_pct=rate, private_only=FEES[name].private_only,
                           note=f"His actual rate: {rate:.1%} of the sale price, from {n} recorded sales "
                                f"(published schedule: {FEES[name].note})")
    return table


def typical_bags(df: pd.DataFrame) -> dict:
    """Typical sale price and landed cost per sourcing type, from the tracker."""
    out = {}
    for kind in ("Clearance lot", "Selected single"):
        x = df[df["sourcing"] == kind]
        sold = x[x["is_sold"]]
        out[kind] = {
            "price": float(sold["sale"].median()) if len(sold) else np.nan,
            "landed": float(x["landed_cost"].mean()) if len(x) else np.nan,
            "n_sold": len(sold),
        }
    return out
