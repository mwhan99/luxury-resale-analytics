"""Channel fee and break-even maths, checked against hand calculations. Run: pytest"""
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import calc  # noqa: E402
import channels as ch  # noqa: E402

DEMO = Path(__file__).resolve().parents[1] / "data" / "demo_tracker.xlsx"
SHOP = ch.ShopifyCosts()   # default assumptions: £61.50 extra per Shopify sale, £46.25 fixed/month


def profit(table, name):
    return table.set_index("Channel").loc[name, "Profit per bag (£)"]


def test_cheap_bag_by_hand():
    # £200 bag, £40 landed cost
    t = ch.per_bag_table(200, 40, SHOP)
    assert profit(t, "Vinted") == pytest.approx(160)                       # no seller fee
    assert profit(t, "Depop") == pytest.approx(200 - (0.029 * 200 + 0.30) - 40)
    assert profit(t, "Vestiaire Collective") == pytest.approx(200 - (24 + 6) - 40)
    assert profit(t, "Shopify (own store)") == pytest.approx(200 - (4 + 0.25) - 61.5 - 40)


def test_expensive_bag_by_hand():
    # £600 bag, £280 landed cost
    t = ch.per_bag_table(600, 280, SHOP)
    assert profit(t, "Vestiaire Collective") == pytest.approx(600 - (72 + 18) - 280)
    assert profit(t, "eBay (business)") == pytest.approx(600 - (77.4 + 0.40 + 2.1) * 1.2 - 280)
    assert profit(t, "Shopify (own store)") == pytest.approx(600 - 12.25 - 61.5 - 280)


def test_breakeven_bags_per_month():
    be, _ = ch.breakeven_table(600, 280, SHOP, monthly_bags=4)
    adv = (600 - 12.25 - 61.5 - 280) - (600 - 90 - 280)
    assert be.set_index("Compared with").loc["Vestiaire Collective", "Shopify bags/month to beat it"] \
        == pytest.approx(46.25 / adv)


def test_required_premium_really_matches():
    be, _ = ch.breakeven_table(200, 40, SHOP, monthly_bags=4)
    prem = be.set_index("Compared with").loc["Vinted", "Price premium needed to match"]
    t = ch.per_bag_table(200, 40, SHOP, shopify_premium=prem)
    assert profit(t, "Shopify (own store)") == pytest.approx(profit(t, "Vinted"))


def test_business_mode_drops_private_ebay():
    t = ch.per_bag_table(200, 40, SHOP, business=True)
    assert "eBay (private)" not in set(t["Channel"])


def test_vestiaire_flat_fee_under_83():
    assert ch.platform_fees(ch.FEES["Vestiaire Collective"], 50) == pytest.approx(10 + 3)


def test_typical_bags_from_tracker():
    df = calc.load_tracker(DEMO)
    typ = ch.typical_bags(df)
    lots = df[df["sourcing"] == "Clearance lot"]
    assert typ["Clearance lot"]["price"] == lots.loc[lots["is_sold"], "sale"].median()
    assert typ["Clearance lot"]["landed"] == pytest.approx(lots["landed_cost"].mean())


def test_observed_vestiaire_rate_from_tracker():
    # Vestiaire sales with recorded fees: roughly 15-19% of the sale price depending on the sale
    obs = ch.observed_fee_rates(calc.load_tracker(DEMO))
    rate, n = obs["Vestiaire Collective"]
    assert n >= 2
    assert 0.12 < rate < 0.22
    assert not any(k.startswith("eBay") for k in obs)   # eBay private vs business is unknown


def test_blank_fees_are_not_treated_as_zero_percent():
    # Vinted/Depop rows with no recorded fee must not create a 0% "observed" rate
    obs = ch.observed_fee_rates(calc.load_tracker(DEMO))
    assert "Vinted" not in obs and "Depop" not in obs


def test_actual_rate_overrides_published_fee():
    table = ch.fee_table({"Vestiaire Collective": (0.19, 2)})
    t = ch.per_bag_table(600, 280, SHOP, fees=table)
    assert profit(t, "Vestiaire Collective") == pytest.approx(600 - 0.19 * 600 - 280)
    assert profit(t, "Vinted") == pytest.approx(320)                  # untouched channels unchanged
