"""Core calculations for the resale analytics app.

Everything here is plain pandas so it can be tested without Streamlit.
All derived numbers are recomputed from the tracker's input columns
(not read from the spreadsheet's cached formulas), so the app works the
same whether the file was saved from Excel, Google Sheets or LibreOffice.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

# Tracker column names (row 2 of the "Bags" sheet)
COL = {
    "id": "Bag ID",
    "brand": "Brand",
    "model": "Model / style",
    "condition": "Condition",
    "source": "Supplier / source",
    "sourcing": "Sourcing type",
    "lot": "Lot ID",
    "lot_total": "Lot total price (£)",
    "purchase_date": "Purchase date",
    "price_orig": "Purchase price (original currency)",
    "fx": "FX rate to GBP",
    "ship_in": "Shipping to London (£)",
    "duty": "Import duty & VAT (£)",
    "auth": "Authentication cost (£)",
    "other": "Other costs (£)",
    "channel": "Channel",
    "date_listed": "Date listed",
    "list_price": "First list price (£)",
    "status": "Status",
    "date_sold": "Date sold",
    "sale": "Sale price (£)",
    "payout": "Net payout received (£)",
    "ship_out": "Seller-paid shipping / packaging (£)",
    "confidence": "Data confidence",
    "notes": "Notes",
}
NUMERIC = ["price_orig", "fx", "ship_in", "duty", "auth", "other", "lot_total",
           "list_price", "sale", "payout", "ship_out"]
DATES = ["purchase_date", "date_listed", "date_sold"]
MIN_COMPS = 3          # fewer comparable sales than this = "not enough data"
SMALL_SAMPLE = 30      # below this, the app shows a small-sample warning


def load_tracker(file) -> pd.DataFrame:
    """Read the Bags sheet of the tracker and return a tidy dataframe."""
    raw = pd.read_excel(file, sheet_name="Bags", header=1)
    missing = [v for v in COL.values() if v not in raw.columns]
    if missing:
        raise ValueError("This doesn't look like the tracker template. Missing columns: "
                         + ", ".join(missing))
    df = raw[list(COL.values())].rename(columns={v: k for k, v in COL.items()})
    df = df[df["id"].notna() & (df["id"].astype(str).str.strip() != "")]
    df = df[df["id"].astype(str).str.upper() != "EXAMPLE"].copy()

    for c in NUMERIC:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    for c in DATES:
        df[c] = pd.to_datetime(df[c], errors="coerce", dayfirst=True)
    for c in ["brand", "condition", "sourcing", "lot", "channel", "status", "confidence", "source"]:
        df[c] = df[c].astype("string").str.strip()
    df["fx"] = df["fx"].fillna(1.0)
    df["sourcing"] = df["sourcing"].fillna("Unspecified")
    df["lot"] = df["lot"].fillna("No lot ID")
    return derive(df.reset_index(drop=True))


def derive(df: pd.DataFrame) -> pd.DataFrame:
    """Add the calculated columns (same definitions as the spreadsheet)."""
    df = df.copy()
    df["purchase_gbp"] = df["price_orig"] * df["fx"]
    extra = df[["ship_in", "duty", "auth", "other"]].fillna(0).sum(axis=1)
    df["landed_cost"] = df["purchase_gbp"] + extra
    df["is_sold"] = df["status"].str.lower().eq("sold").fillna(False)
    sold = df["is_sold"]
    df["fees"] = np.where(sold, df["sale"] - df["payout"], np.nan)
    df["net_after_shipping"] = np.where(sold, df["payout"] - df["ship_out"].fillna(0), np.nan)
    df["profit"] = np.where(sold, df["net_after_shipping"] - df["landed_cost"], np.nan)
    df["margin"] = df["profit"] / df["sale"].where(df["sale"] > 0)
    df["roi"] = df["profit"] / df["landed_cost"].where(df["landed_cost"] > 0)
    df["fee_rate"] = df["fees"] / df["sale"].where(df["sale"] > 0)
    df["days_to_sell"] = np.where(sold, (df["date_sold"] - df["date_listed"]).dt.days, np.nan)
    return df


# ---------------------------------------------------------------- summaries
def kpis(df: pd.DataFrame) -> dict:
    s = df[df["is_sold"]]
    revenue = s["sale"].sum()
    profit = s["profit"].sum()
    return {
        "bags": len(df),
        "sold": int(df["is_sold"].sum()),
        "sell_through": df["is_sold"].mean() if len(df) else np.nan,
        "spend": df["landed_cost"].sum(),
        "revenue": revenue,
        "profit": profit,
        "margin": profit / revenue if revenue else np.nan,
        "roi_sold": profit / s["landed_cost"].sum() if s["landed_cost"].sum() else np.nan,
        "unsold_cost": df.loc[~df["is_sold"], "landed_cost"].sum(),
        "avg_days": s["days_to_sell"].mean(),
        "days_known": int(s["days_to_sell"].notna().sum()),
        "estimated_rows": int(df["confidence"].isin(["Estimated", "Unknown"]).sum()),
    }


def group_summary(df: pd.DataFrame, by: str) -> pd.DataFrame:
    g = df.groupby(by, dropna=False)
    out = pd.DataFrame({
        "Bags": g.size(),
        "Sold": g["is_sold"].sum().astype(int),
        "Spend (£)": g["landed_cost"].sum(),
        "Revenue (£)": g.apply(lambda x: x.loc[x["is_sold"], "sale"].sum(), include_groups=False),
        "Profit (£)": g["profit"].sum(),
        "Unsold stock at cost (£)": g.apply(lambda x: x.loc[~x["is_sold"], "landed_cost"].sum(),
                                            include_groups=False),
    })
    out["Sell-through"] = out["Sold"] / out["Bags"]
    out["Margin"] = out["Profit (£)"] / out["Revenue (£)"].where(out["Revenue (£)"] > 0)
    sold_cost = g.apply(lambda x: x.loc[x["is_sold"], "landed_cost"].sum(), include_groups=False)
    out["Return per £ on sold bags"] = out["Profit (£)"] / sold_cost.where(sold_cost > 0)
    return out.sort_values("Profit (£)", ascending=False)


# ---------------------------------------------------------------- lot calculator
def lot_history(df: pd.DataFrame) -> dict:
    """What past clearance-lot bags tell us."""
    lots = df[df["sourcing"] == "Clearance lot"]
    sold = lots[lots["is_sold"]]
    net = sold["net_after_shipping"].dropna()
    return {
        "bags": len(lots),
        "lots": lots["lot"].nunique(),
        "sold": len(sold),
        "sell_through": lots["is_sold"].mean() if len(lots) else np.nan,
        "net_p25": net.quantile(0.25) if len(net) else np.nan,
        "net_median": net.median() if len(net) else np.nan,
        "net_p75": net.quantile(0.75) if len(net) else np.nan,
        "avg_landed": lots["landed_cost"].mean() if len(lots) else np.nan,
        # typical lot, used as calculator defaults
        "avg_lot_bags": lots.groupby("lot").size().mean() if len(lots) else np.nan,
        "avg_lot_price": lots.groupby("lot")["purchase_gbp"].sum().mean() if len(lots) else np.nan,
        "avg_lot_inbound": (lots.groupby("lot")[["ship_in", "duty"]].sum().sum(axis=1).mean()
                            if len(lots) else np.nan),
    }


def lot_scenario(lot_price: float, n_bags: int, inbound_total: float, other_per_bag: float,
                 sell_through: float, net_per_sold: float) -> dict:
    """Expected result of buying one lot."""
    cost = lot_price + inbound_total + other_per_bag * n_bags
    sold = n_bags * sell_through
    revenue = sold * net_per_sold
    profit = revenue - cost
    breakeven_st = cost / (n_bags * net_per_sold) if n_bags and net_per_sold else np.nan
    return {"cost": cost, "cost_per_bag": cost / n_bags if n_bags else np.nan,
            "bags_sold": sold, "net_revenue": revenue, "profit": profit,
            "roi": profit / cost if cost else np.nan,
            "breakeven_sell_through": breakeven_st}


def max_lot_price(n_bags: int, inbound_total: float, other_per_bag: float,
                  sell_through: float, net_per_sold: float, target_roi: float) -> float:
    """Highest lot price that still hits the target return."""
    revenue = n_bags * sell_through * net_per_sold
    return revenue / (1 + target_roi) - inbound_total - other_per_bag * n_bags


# ---------------------------------------------------------------- single bag calculator
def comparables(df: pd.DataFrame, brand: str, condition: str | None = None,
                sourcing: str | None = "Selected single") -> tuple[pd.DataFrame, str]:
    """Sold bags of the same brand, narrowed to the same sourcing type and
    condition when there are enough of them. Returns (comps, description)."""
    s = df[df["is_sold"] & (df["brand"] == brand)]
    basis = f"all sold {brand} bags"
    if sourcing:
        same = s[s["sourcing"] == sourcing]
        if len(same) >= MIN_COMPS:
            s, basis = same, f"sold {brand} bags bought as '{sourcing}'"
    if condition:
        same = s[s["condition"] == condition]
        if len(same) >= MIN_COMPS:
            s, basis = same, basis + f" in '{condition}' condition"
    return s, basis


def buy_signal(best_margin: float, n_comps: int, min_margin: float) -> tuple[str, str]:
    if n_comps < MIN_COMPS:
        return ("CHECK", f"Only {n_comps} comparable sale(s): the estimate is a guess. "
                         "Use your own judgment or enter an expected price manually.")
    if best_margin >= min_margin:
        return ("BUY", f"Best channel clears your {min_margin:.0%} minimum margin.")
    return ("PASS", f"No channel reaches your {min_margin:.0%} minimum margin at this price.")


# ---------------------------------------------------------------- data quality
def quality_issues(df: pd.DataFrame) -> pd.DataFrame:
    checks = []
    for _, r in df.iterrows():
        issues = []
        if r["is_sold"]:
            if pd.isna(r["sale"]):
                issues.append("Sold but no sale price")
            if pd.isna(r["payout"]):
                issues.append("Sold but no net payout (fees unknown)")
            if pd.isna(r["date_sold"]) or pd.isna(r["date_listed"]):
                issues.append("Missing listed/sold date (can't measure days to sell)")
            if pd.notna(r["sale"]) and pd.notna(r["list_price"]) and r["sale"] > r["list_price"]:
                issues.append("Sale price above first list price")
        if pd.isna(r["price_orig"]):
            issues.append("No purchase price")
        if pd.isna(r["purchase_date"]):
            issues.append("No purchase date")
        elif r["purchase_date"] > pd.Timestamp.today():
            issues.append("Purchase date in the future (day/month swapped?)")
        if r["sourcing"] == "Clearance lot" and pd.isna(r["lot_total"]):
            issues.append("Lot total price not recorded")
        if r["confidence"] in ("Estimated", "Unknown"):
            issues.append(f"Marked {r['confidence']}")
        if issues:
            checks.append({"Bag ID": r["id"], "Brand": r["brand"], "Issues": "; ".join(issues),
                           "Count": len(issues)})
    return pd.DataFrame(checks, columns=["Bag ID", "Brand", "Issues", "Count"])
