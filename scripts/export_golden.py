"""Save the demo data and Python's answers for the website's tests.

The website (web/) re-does the calculations in TypeScript, in the visitor's
browser. This script writes two files so the two versions can't drift apart:

- web/lib/demo-rows.json: the demo tracker's input columns, one object per
  row, exactly as the tracker names them. The website starts with this data.
- web/lib/__fixtures__/golden.json: calc.py and channels.py results for the
  demo data and a set of fixed inputs. `npm test` in web/ checks that the
  TypeScript gives the same numbers.

Run it after any change to calc.py or channels.py:  python scripts/export_golden.py
"""
from __future__ import annotations

import json
import math
import sys
from dataclasses import asdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import calc  # noqa: E402
import channels as ch  # noqa: E402

DEMO = ROOT / "data" / "demo_tracker.xlsx"
OUT_ROWS = ROOT / "web" / "lib" / "demo-rows.json"
OUT_GOLDEN = ROOT / "web" / "lib" / "__fixtures__" / "golden.json"


def clean(x):
    """Make a value JSON-friendly: NaN becomes null, numpy numbers become floats."""
    if isinstance(x, dict):
        return {str(k): clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [clean(v) for v in x]
    if x is None or x is pd.NA or x is pd.NaT:
        return None
    if isinstance(x, pd.Timestamp):
        return x.strftime("%Y-%m-%d")
    if hasattr(x, "item"):  # numpy scalar
        x = x.item()
    if isinstance(x, float) and math.isnan(x):
        return None
    return x


def records(frame: pd.DataFrame, index_name: str | None = None) -> list[dict]:
    if index_name:
        frame = frame.rename_axis(index_name).reset_index()
    return clean(frame.to_dict(orient="records"))


def demo_rows() -> list[dict]:
    """The tracker's input columns as stored in the spreadsheet (formulas are skipped)."""
    raw = pd.read_excel(DEMO, sheet_name="Bags", header=1)
    raw = raw[list(calc.COL.values())]
    return [clean(r) for r in raw.to_dict(orient="records")]


def golden() -> dict:
    df = calc.load_tracker(DEMO)
    out: dict = {}

    # Performance
    out["kpis"] = clean(calc.kpis(df))
    some = df[df["lot"].isin(["LOT-A", "LOT-B"])]
    out["kpis_lots_ab"] = clean(calc.kpis(some))
    out["group_summary"] = {by: records(calc.group_summary(df, by), "label")
                            for by in ["sourcing", "brand", "channel", "lot"]}
    out["derived"] = records(df[["id", "landed_cost", "is_sold", "fees", "profit", "margin", "roi"]])

    # Lot calculator
    h = calc.lot_history(df)
    out["lot_history"] = clean(h)
    cases = [
        (round(h["avg_lot_price"]), round(h["avg_lot_bags"]), round(h["avg_lot_inbound"]), 0.0,
         h["sell_through"], round(h["net_median"]), 1.0),
        (500.0, 20, 120.0, 5.0, 0.6, 90.0, 0.5),
        (2000.0, 12, 300.0, 0.0, 0.9, 400.0, 2.0),
    ]
    out["lot_cases"] = []
    for price, n, inbound, other, st_, net, target in cases:
        out["lot_cases"].append(clean({
            "input": {"lot_price": price, "n_bags": n, "inbound_total": inbound,
                      "other_per_bag": other, "sell_through": st_, "net_per_sold": net,
                      "target_roi": target},
            "scenario": calc.lot_scenario(price, n, inbound, other, st_, net),
            "max_lot_price": calc.max_lot_price(n, inbound, other, st_, net, target),
        }))

    # Single-bag calculator: comparables for every brand and condition choice
    out["comparables"] = []
    for brand in sorted(df["brand"].dropna().unique().tolist()) + ["Other", "Hermès"]:
        for cond in [None, "New with tags", "Excellent", "Very good", "Good", "Fair", "Satisfactory"]:
            comps, basis = calc.comparables(df, brand, cond)
            out["comparables"].append(clean({
                "brand": brand, "condition": cond, "basis": basis,
                "ids": comps["id"].tolist(),
                "median": comps["sale"].median() if len(comps) else None,
            }))
    out["quality_issues"] = records(calc.quality_issues(df))

    # Channels
    prices = [0, 20, 50, 82.99, 83, 150, 312.5, 500, 900]
    out["platform_fees"] = [{"channel": name, "price": p, "fee": clean(ch.platform_fees(f, p))}
                            for name, f in ch.FEES.items() for p in prices]
    observed = ch.observed_fee_rates(df)
    out["observed_fee_rates"] = clean({k: list(v) for k, v in observed.items()})
    out["typical_bags"] = clean(ch.typical_bags(df))

    shops = {"default": ch.ShopifyCosts(),
             "cheap": ch.ShopifyCosts(marketing=5, authentication=0, return_rate=0.02, plan=19, apps=0)}
    out["shops"] = {k: clean(asdict(v)) for k, v in shops.items()}
    out["channel_cases"] = []
    for price, landed in [(150.0, 30.0), (600.0, 300.0), (60.0, 55.0)]:
        for shop_name, shop in shops.items():
            for business in [False, True]:
                for premium, discount in [(0.0, 0.0), (0.15, 0.1)]:
                    for actual in [False, True]:
                        fees = ch.fee_table(observed if actual else None)
                        kw = dict(business=business, shopify_premium=premium,
                                  marketplace_discount=discount, fees=fees)
                        per = ch.per_bag_table(price, landed, shop, **kw)
                        be, summ = ch.breakeven_table(price, landed, shop, 4, **kw)
                        best = be.sort_values("Profit there (£)", ascending=False).iloc[0]["Compared with"]
                        grid = ch.sensitivity(price, landed, shop, best, **kw)
                        out["channel_cases"].append({
                            "input": {"price": price, "landed": landed, "shop": shop_name,
                                      "business": business, "premium": premium, "discount": discount,
                                      "actual_fees": actual, "monthly": 4},
                            "per_bag": records(per),
                            "breakeven": records(be),
                            "summary": clean(summ),
                            "sensitivity_vs": best,
                            "sensitivity": clean(grid.values.tolist()),
                        })
    return out


def main() -> None:
    OUT_GOLDEN.parent.mkdir(parents=True, exist_ok=True)
    rows = demo_rows()
    OUT_ROWS.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n")
    OUT_GOLDEN.write_text(json.dumps(golden(), ensure_ascii=False) + "\n")
    print(f"Wrote {len(rows)} demo rows to {OUT_ROWS.relative_to(ROOT)}")
    print(f"Wrote {OUT_GOLDEN.relative_to(ROOT)} ({OUT_GOLDEN.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
