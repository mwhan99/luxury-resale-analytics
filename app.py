"""Resale Analytics: sourcing, pricing and channel decisions for a
vintage luxury bag resale business (Tokyo -> UK).

Run locally:  streamlit run app.py
"""
from pathlib import Path

import altair as alt
import numpy as np
import pandas as pd
import streamlit as st

import calc
import channels as ch_mod

st.set_page_config(page_title="Resale Analytics", page_icon="👜", layout="wide")

DATA = Path(__file__).parent / "data" / "demo_tracker.xlsx"


def gbp(x, dp=0):
    if x is None or pd.isna(x):
        return "–"
    return f"-£{abs(x):,.{dp}f}" if x < 0 else f"£{x:,.{dp}f}"


def pct(x):
    return "–" if x is None or pd.isna(x) else f"{x:.0%}"


def stat(col, label, value, sub=None):
    """A metric with a plain grey note underneath (no up/down arrow)."""
    col.metric(label, value)
    if sub:
        col.caption(sub)


def hbar(series: pd.Series, title: str):
    """Horizontal bar chart that always starts at £0, sorted, losses in red."""
    d = series.rename("value").rename_axis("label").reset_index()
    d["sign"] = np.where(d["value"] < 0, "Loss", "Profit")
    chart = (alt.Chart(d)
             .mark_bar()
             .encode(y=alt.Y("label:N", sort="-x", title=None),
                     x=alt.X("value:Q", title=title, scale=alt.Scale(zero=True)),
                     color=alt.Color("sign:N", scale=alt.Scale(domain=["Profit", "Loss"],
                                                                range=["#2E5E8C", "#C0392B"]),
                                     legend=None),
                     tooltip=[alt.Tooltip("label:N", title=""),
                              alt.Tooltip("value:Q", title=title, format=",.0f")])
             .properties(height=max(140, 34 * len(d))))
    st.altair_chart(chart, use_container_width=True)


# ---------------------------------------------------------------- data
st.sidebar.header("Data")
upload = st.sidebar.file_uploader("Upload the latest tracker (.xlsx)", type=["xlsx"],
                                  help="Your file is only used in your own browser session. It is not saved "
                                       "or shown to anyone else, and is gone when you close the tab.")
source = upload if upload is not None else DATA
try:
    df = calc.load_tracker(source)
except Exception as e:  # noqa: BLE001
    st.error(f"Couldn't read the tracker: {e}")
    st.stop()
st.sidebar.caption("Using: your uploaded file (visible only to you)" if upload is not None
                   else "Using: demo data (disguised shipment 1)")
st.sidebar.caption(f"{len(df)} bags · {df['lot'].nunique()} lot(s)/purchase(s)")

lots = sorted(df["lot"].dropna().unique())
chosen = st.sidebar.multiselect("Filter by lot / shipment", lots, default=lots)
view = df[df["lot"].isin(chosen)] if chosen else df

st.sidebar.header("Selling setup")
business = st.sidebar.toggle("Trading as a registered business", value=False,
                             help="Removes eBay's free private-seller option and uses business fees.")
with st.sidebar.expander("Shopify cost assumptions"):
    st.caption("Assumptions, not sourced figures. Used by the break-even and single-bag tabs.")
    shop = ch_mod.ShopifyCosts(
        marketing=st.number_input("Marketing to win each buyer (£)", 0.0, 500.0, 25.0, 5.0),
        authentication=st.number_input("Authentication per bag (£)", 0.0, 200.0, 20.0, 5.0),
        postage=st.number_input("Postage per order (£)", 0.0, 100.0, 10.0, 1.0),
        packaging=st.number_input("Branded packaging per bag (£)", 0.0, 50.0, 5.0, 1.0),
        return_rate=st.slider("Return rate", 0, 50, 10, 1, format="%d%%") / 100,
        return_cost=st.number_input("Cost per return (£)", 0.0, 100.0, 15.0, 1.0),
        plan=st.number_input("Shopify plan per month (£)", 0.0, 500.0, 25.0, 1.0),
        apps=st.number_input("Apps & theme per month (£)", 0.0, 500.0, 20.0, 5.0),
        domain=st.number_input("Domain per month (£)", 0.0, 20.0, 1.25, 0.25),
        other_fixed=st.number_input("Other fixed marketing per month (£)", 0.0, 2000.0, 0.0, 10.0),
        setup=st.number_input("One-off setup cost (£)", 0.0, 5000.0, 150.0, 25.0),
    )
    st.caption(f"= {gbp(shop.per_bag, 2)} extra per Shopify sale, {gbp(shop.fixed_monthly, 2)} fixed per month")

st.title("Resale Analytics")
if upload is None:
    st.info("**Demo data.** Based on a real first shipment from a small UK resale business, with each bag's "
            "amounts randomly scaled (up to ±15%) and identifying details removed for the founder's privacy. "
            "Patterns and conclusions match the real data; individual figures do not.")
st.caption("Vintage luxury bags sourced in Tokyo, sold in the UK. "
           "Decide what to buy, what to pay, and where to sell.")
if len(df) < calc.SMALL_SAMPLE:
    st.warning(f"Small sample: {len(df)} bags so far. Treat results as early patterns to test, "
               "not proven conclusions. They'll firm up as more shipments are added.")

tab_dash, tab_lot, tab_single, tab_shop, tab_quality, tab_about = st.tabs(
    ["📊 Performance", "📦 Lot calculator", "👜 Single-bag calculator", "🛍️ Shopify break-even",
     "🔍 Data quality", "ℹ️ How it works"])

# ---------------------------------------------------------------- dashboard
with tab_dash:
    k = calc.kpis(view)
    c = st.columns(5)
    stat(c[0], "Bags sold", f"{k['sold']} / {k['bags']}", f"{pct(k['sell_through'])} sell-through")
    c[1].metric("Revenue (sold bags)", gbp(k["revenue"]))
    stat(c[2], "Profit (sold bags)", gbp(k["profit"]), f"{pct(k['margin'])} margin")
    c[3].metric("Return per £ on sold bags", pct(k["roi_sold"]))
    c[4].metric("Unsold stock at cost", gbp(k["unsold_cost"]))
    if k["days_known"] == 0:
        st.info("Days to sell can't be measured yet: no bag has both a listed and a sold date.")
    else:
        st.caption(f"Average days to sell: {k['avg_days']:.0f} (from {k['days_known']} bags with dates)")
    if k["estimated_rows"]:
        st.caption(f"⚠️ {k['estimated_rows']} bag(s) include estimated data, mostly unrecorded "
                   "platform fees, so profit may be overstated. See the Data quality tab.")

    fmt = {"Spend (£)": "£{:,.0f}", "Revenue (£)": "£{:,.0f}", "Profit (£)": "£{:,.0f}",
           "Unsold stock at cost (£)": "£{:,.0f}", "Sell-through": "{:.0%}", "Margin": "{:.0%}",
           "Return per £ on sold bags": "{:.0%}"}

    st.subheader("Clearance lots vs. selected single bags")
    st.caption("The key sourcing question: is cheap bulk stock or hand-picked premium stock the "
               "better use of money?")
    st.dataframe(calc.group_summary(view, "sourcing").rename_axis("Sourcing type").style.format(fmt, na_rep="–"),
                 use_container_width=True)

    left, right = st.columns(2)
    with left:
        st.subheader("By brand")
        b = calc.group_summary(view, "brand").rename_axis("Brand")
        hbar(b["Profit (£)"], "Profit (£)")
        st.dataframe(b.style.format(fmt, na_rep="–"), use_container_width=True)
    with right:
        st.subheader("By channel")
        ch = calc.group_summary(view, "channel").rename_axis("Channel")
        hbar(ch["Profit (£)"], "Profit (£)")
        st.dataframe(ch.style.format(fmt, na_rep="–"), use_container_width=True)

    if view["lot"].nunique() > 1:
        st.subheader("By lot / shipment")
        st.dataframe(calc.group_summary(view, "lot").rename_axis("Lot / shipment").style.format(fmt, na_rep="–"),
                     use_container_width=True)

    with st.expander("All bags"):
        cols = ["id", "brand", "model", "condition", "sourcing", "lot", "channel", "status",
                "landed_cost", "list_price", "sale", "fees", "profit", "margin", "confidence"]
        nice = {"id": "Bag ID", "brand": "Brand", "model": "Model", "condition": "Condition",
                "sourcing": "Sourcing", "lot": "Lot", "channel": "Channel", "status": "Status",
                "landed_cost": "Landed cost (£)", "list_price": "First list price (£)",
                "sale": "Sale price (£)", "fees": "Fees (£)", "profit": "Profit (£)",
                "margin": "Margin", "confidence": "Data confidence"}
        st.dataframe(view[cols].rename(columns=nice).style.format(
            {"Landed cost (£)": "£{:,.0f}", "First list price (£)": "£{:,.0f}", "Sale price (£)": "£{:,.0f}",
             "Fees (£)": "£{:,.0f}", "Profit (£)": "£{:,.0f}", "Margin": "{:.0%}"}, na_rep="–"),
            use_container_width=True, hide_index=True)

# ---------------------------------------------------------------- lot calculator
with tab_lot:
    h = calc.lot_history(df)
    st.subheader("Should I buy this lot, and what's the most I should pay?")
    if h["bags"] == 0:
        st.info("No bags marked 'Clearance lot' yet. Set Sourcing type in the tracker.")
    else:
        st.caption(f"Defaults come from {h['bags']} clearance-lot bags across {h['lots']} lot(s): "
                   f"{h['sold']} sold, typical net per sold bag {gbp(h['net_median'])} "
                   f"(middle half {gbp(h['net_p25'])}–{gbp(h['net_p75'])}). "
                   "Change any input to test your own assumptions.")
        a, b = st.columns(2)
        with a:
            st.markdown("**The offer**")
            st.caption("Pre-filled with his typical past lot. Type in the new offer.")
            lot_price = st.number_input("Lot price (£)", min_value=0.0,
                                        value=float(round(h["avg_lot_price"])), step=25.0)
            n_bags = st.number_input("Number of bags in the lot", min_value=1,
                                     value=int(round(h["avg_lot_bags"])), step=1)
            inbound = st.number_input("Shipping + import duty/VAT for the whole lot (£)",
                                      min_value=0.0, value=float(round(h["avg_lot_inbound"])),
                                      step=10.0)
            other = st.number_input("Cleaning / repair / other per bag (£)", min_value=0.0,
                                    value=0.0, step=5.0)
        with b:
            st.markdown("**Your assumptions**")
            st_default = float(h["sell_through"]) if pd.notna(h["sell_through"]) else 0.7
            sell_through = st.slider("Share of bags you expect to sell", 0, 100,
                                     int(round(st_default * 100)), 5, format="%d%%") / 100
            net_default = float(h["net_median"]) if pd.notna(h["net_median"]) else 100.0
            net_sold = st.number_input("Net received per sold bag, after fees & postage (£)",
                                       min_value=0.0, value=float(round(net_default)), step=5.0)
            target = st.slider("Return you want on the money spent", 0, 300, 100, 10,
                               format="%d%%") / 100
            st.caption("100% = double your money (£1 profit for every £1 spent).")

        r = calc.lot_scenario(lot_price, n_bags, inbound, other, sell_through, net_sold)
        m = st.columns(4)
        stat(m[0], "Total cost", gbp(r["cost"]), f"{gbp(r['cost_per_bag'])} per bag")
        stat(m[1], "Expected net revenue", gbp(r["net_revenue"]), f"{r['bags_sold']:.1f} bags sold")
        stat(m[2], "Expected profit", gbp(r["profit"]), f"{pct(r['roi'])} return")
        m[3].metric("Break-even sell-through", pct(r["breakeven_sell_through"]))

        mx = calc.max_lot_price(n_bags, inbound, other, sell_through, net_sold, target)
        if mx <= 0:
            st.error(f"At these assumptions, no lot price reaches a {target:.0%} return.")
        elif lot_price <= mx:
            st.success(f"✅ Worth it: pay up to **{gbp(mx)}** for this lot and still hit a "
                       f"{target:.0%} return. The offer is {gbp(mx - lot_price)} under that.")
        else:
            st.warning(f"⚠️ Too expensive: to hit a {target:.0%} return, pay at most **{gbp(mx)}** "
                       f"({gbp(lot_price - mx)} less than the offer).")

        st.markdown("**Scenarios**")
        if pd.notna(h["net_p25"]):
            rows = []
            for name, stv, net in [("Cautious", max(sell_through - 0.15, 0), h["net_p25"]),
                                   ("Expected", sell_through, net_sold),
                                   ("Strong", min(sell_through + 0.1, 1), h["net_p75"])]:
                s = calc.lot_scenario(lot_price, n_bags, inbound, other, stv, net)
                rows.append({"Scenario": name, "Sell-through": stv, "Net per sold bag (£)": net,
                             "Profit (£)": s["profit"], "Return": s["roi"]})
            st.dataframe(pd.DataFrame(rows).style.format(
                {"Sell-through": "{:.0%}", "Net per sold bag (£)": "£{:,.0f}",
                 "Profit (£)": "£{:,.0f}", "Return": "{:.0%}"}), hide_index=True,
                use_container_width=True)
            st.caption("Cautious and Strong use the lower and upper quartile of past net "
                       "payouts per sold bag.")

# ---------------------------------------------------------------- single bag
with tab_single:
    st.subheader("Is this individual bag worth buying, and where should I sell it?")
    a, b = st.columns(2)
    brands = sorted(df["brand"].dropna().unique().tolist())
    with a:
        brand = st.selectbox("Brand", brands + ["Other"], index=0)
        cond_opts = ["Any"] + ["New with tags", "Excellent", "Very good", "Good", "Fair"]
        cond = st.selectbox("Condition", cond_opts, index=0)
        cost = st.number_input("Purchase price (£)", min_value=0.0, value=250.0, step=10.0)
        inbound1 = st.number_input("Shipping + duty/VAT + authentication (£)", min_value=0.0,
                                   value=50.0, step=5.0)
        min_margin = st.slider("Minimum margin you'll accept", 0, 80, 25, 5, format="%d%%") / 100
    comps, basis = calc.comparables(df, brand, None if cond == "Any" else cond)
    with b:
        st.markdown(f"**Comparable sales: {len(comps)} bag(s)**")
        st.caption(f"Based on {basis}. Narrows to the same sourcing type and condition once "
                   f"there are at least {calc.MIN_COMPS} matches.")
        if len(comps):
            st.dataframe(comps[["id", "model", "condition", "sourcing", "channel", "sale"]]
                         .rename(columns={"sale": "Sold for (£)"}), hide_index=True,
                         use_container_width=True)
        default_price = float(comps["sale"].median()) if len(comps) else 300.0
        exp_price = st.number_input("Expected sale price (£): median of comparables, edit freely",
                                    min_value=0.0, value=float(round(default_price)), step=10.0)

    landed = cost + inbound1
    out = ch_mod.per_bag_table(exp_price, landed, shop, business=business)
    out["Return per £"] = out["Profit per bag (£)"] / landed if landed else np.nan
    out = out.sort_values("Profit per bag (£)", ascending=False)
    st.dataframe(out[["Channel", "Platform fees (£)", "Shopify-only costs (£)", "Profit per bag (£)",
                      "Margin", "Return per £"]].style.format(
        {"Platform fees (£)": "£{:,.0f}", "Shopify-only costs (£)": "£{:,.0f}",
         "Profit per bag (£)": "£{:,.0f}", "Margin": "{:.0%}", "Return per £": "{:.0%}"}, na_rep="–"),
        hide_index=True, use_container_width=True)
    best = out.iloc[0]
    sig, why = calc.buy_signal(best["Margin"], len(comps), min_margin)
    msg = f"**{sig}**: best channel is {best['Channel']} ({gbp(best['Profit per bag (£)'])} profit, " \
          f"{pct(best['Margin'])} margin). {why}"
    {"BUY": st.success, "PASS": st.error, "CHECK": st.warning}[sig](msg)
    st.caption(f"Platform fees: published UK seller fees checked {ch_mod.FEES_CHECKED}. Shopify costs "
               "come from the sidebar assumptions. Assumes the same price on every channel.")

# ---------------------------------------------------------------- shopify break-even
with tab_shop:
    st.subheader("Should he sell through his own Shopify store, and which bags?")
    st.caption("Compares selling the same bag on his own store with each marketplace, using "
               f"published UK seller fees (checked {ch_mod.FEES_CHECKED}) and the Shopify assumptions "
               "in the sidebar.")
    typ = ch_mod.typical_bags(df)
    kind = st.radio("Bag type", ["Clearance lot", "Selected single"], horizontal=True,
                    format_func=lambda k: {"Clearance lot": "Clearance-lot bag",
                                           "Selected single": "Premium selected bag"}[k])
    t = typ[kind]
    fallback = {"Clearance lot": (150.0, 30.0), "Selected single": (600.0, 300.0)}[kind]
    a1, a2, a3 = st.columns(3)
    price = a1.number_input("Typical sale price (£)", 0.0, 50000.0,
                            float(round(t["price"])) if pd.notna(t["price"]) else fallback[0], 5.0,
                            key=f"price_{kind}")
    landed_b = a2.number_input("Landed cost (£)", 0.0, 50000.0,
                               float(round(t["landed"])) if pd.notna(t["landed"]) else fallback[1], 5.0,
                               key=f"landed_{kind}")
    monthly = a3.number_input("Bags sold on Shopify per month", 0.0, 500.0, 4.0, 1.0, key=f"vol_{kind}")
    st.caption(f"Defaults: median sale price and average landed cost of {kind.lower()} bags in the "
               f"tracker ({t['n_sold']} sold).")
    if t["n_sold"] < 3:
        st.warning(f"Only {t['n_sold']} sold {kind.lower()} bag(s) so far: treat these results as "
                   "illustrative.")
    b1, b2 = st.columns(2)
    prem = b1.slider("Price premium on his own store", 0, 50, 0, 5, format="%d%%", key=f"prem_{kind}",
                     help="A trusted brand may charge more than a marketplace for the same bag.")
    disc = b2.slider("Discount on Vinted / Depop / eBay", 0, 50, 0, 5, format="%d%%", key=f"disc_{kind}",
                     help="A premium bag may not reach full price on a general marketplace.")
    prem, disc = prem / 100, disc / 100
    kw = dict(business=business, shopify_premium=prem, marketplace_discount=disc)

    per = ch_mod.per_bag_table(price, landed_b, shop, **kw)
    be, summ = ch_mod.breakeven_table(price, landed_b, shop, monthly, **kw)
    best_mkt = be.sort_values("Profit there (£)", ascending=False).iloc[0]

    m = st.columns(4)
    m[0].metric("Shopify profit per bag", gbp(summ["shopify_profit"]))
    m[1].metric(f"Best marketplace: {best_mkt['Compared with']}", gbp(best_mkt["Profit there (£)"]))
    m[2].metric("Shopify advantage per bag", gbp(best_mkt["Shopify advantage per bag (£)"]))
    need = best_mkt["Shopify bags/month to beat it"]
    m[3].metric("Shopify bags/month to beat it", f"{need:.1f}" if pd.notna(need) else "Never")

    beaten = be[be["Shopify advantage per bag (£)"] > 0]["Compared with"].tolist()
    if not beaten:
        st.error(f"At these assumptions Shopify earns less per bag than every marketplace. To match "
                 f"{best_mkt['Compared with']} it would need a price premium of about "
                 f"{best_mkt['Price premium needed to match']:.0%}.")
    elif best_mkt["Shopify advantage per bag (£)"] > 0:
        st.success(f"Shopify beats every marketplace per bag. It covers its fixed costs from "
                   f"{need:.1f} bags a month.")
    else:
        mx_mkt = best_mkt["Max marketing per sale to match (£)"]
        how = (f"marketing under {gbp(mx_mkt)} per sale" if mx_mkt > 0
               else "even with no marketing spend it falls short")
        st.info(f"Shopify beats {', '.join(beaten)} but not {best_mkt['Compared with']}. "
                f"To match {best_mkt['Compared with']} it needs a price premium of about "
                f"{best_mkt['Price premium needed to match']:.0%} ({how}).")

    left, right = st.columns(2)
    with left:
        st.markdown("**Profit per bag by channel**")
        hbar(per.set_index("Channel")["Profit per bag (£)"], "Profit per bag (£)")
    with right:
        st.markdown("**Monthly profit: Shopify minus each marketplace**")
        vols = np.arange(0, 11)
        lines = pd.DataFrame({r["Compared with"]: vols * r["Shopify advantage per bag (£)"] - shop.fixed_monthly
                              for _, r in be.iterrows()}, index=vols)
        lines.index.name = "Shopify bags per month"
        st.line_chart(lines, y_label="£ per month", x_label="Shopify bags per month")
        st.caption("Above zero = Shopify earns more that month than selling the same bags on that "
                   "marketplace.")

    st.markdown("**Per-bag economics**")
    st.dataframe(per.style.format({"Sale price (£)": "£{:,.0f}", "Platform fees (£)": "£{:,.2f}",
                                   "Fees % of sale": "{:.1%}", "Shopify-only costs (£)": "£{:,.2f}",
                                   "Landed cost (£)": "£{:,.0f}", "Profit per bag (£)": "£{:,.2f}",
                                   "Margin": "{:.0%}"}, na_rep="–"),
                 hide_index=True, use_container_width=True)
    st.markdown("**Break-even against each marketplace**")
    st.dataframe(be.style.format({"Profit there (£)": "£{:,.2f}",
                                  "Shopify advantage per bag (£)": "£{:,.2f}",
                                  "Shopify bags/month to beat it": "{:.1f}",
                                  "Price premium needed to match": "{:+.0%}",
                                  "Max marketing per sale to match (£)": "£{:,.0f}",
                                  "Monthly profit difference (£)": "£{:,.0f}",
                                  "Setup paid back in (months)": "{:.1f}"}, na_rep="Never"),
                 hide_index=True, use_container_width=True)

    st.markdown("**Sensitivity: Shopify advantage per bag (£)**")
    compare = st.selectbox("Compare Shopify with", be["Compared with"].tolist(),
                           index=be["Compared with"].tolist().index(best_mkt["Compared with"]),
                           key=f"cmp_{kind}")
    grid = ch_mod.sensitivity(price, landed_b, shop, compare, **kw)
    color = lambda v: ("background-color: #C6EFCE; color: #006100" if v >= 0
                       else "background-color: #FFC7CE; color: #9C0006")
    st.dataframe(grid.style.format("£{:,.0f}").map(color), use_container_width=True)
    st.caption("Rows: marketing cost to win each buyer. Columns: how much more the bag sells for on "
               "his own store. Green = Shopify earns more per bag (before monthly fixed costs).")

    with st.expander("Fee sources and notes"):
        for name, f in ch_mod.FEES.items():
            st.markdown(f"- **{name}**: {f.note}")
        st.markdown("Sources: " + " · ".join(f"[{k}]({v})" for k, v in ch_mod.SOURCES.items()))
        st.caption("Once trading as a business, buyers have a 14-day right to cancel online purchases "
                   "on every channel, not just Shopify.")

# ---------------------------------------------------------------- quality
with tab_quality:
    st.subheader("Data quality")
    q = calc.quality_issues(df)
    c = st.columns(3)
    c[0].metric("Bags with at least one issue", f"{len(q)} / {len(df)}")
    c[1].metric("Sold bags with estimated data",
                int((df["is_sold"] & df["confidence"].isin(["Estimated", "Unknown"])).sum()))
    c[2].metric("Sold bags without dates", int((df["is_sold"] & df["days_to_sell"].isna()).sum()))
    st.dataframe(q.sort_values("Count", ascending=False), hide_index=True, use_container_width=True)
    st.caption("Fixing these in the tracker and re-uploading makes every number in the app more "
               "reliable.")

# ---------------------------------------------------------------- about
with tab_about:
    st.markdown("""
**What this tool does**

- **Performance**: profit, margin, sell-through and unsold stock by sourcing type, brand,
  channel and lot, recalculated from the raw tracker inputs.
- **Lot calculator**: the business buys clearance lots it doesn't pick bag by bag, so the
  real decision is *what to pay for a whole lot*. The calculator uses past sell-through and
  net payout per sold bag to estimate profit, the break-even sell-through, and the maximum
  price that still hits a target return.
- **Single-bag calculator**: for hand-picked bags, it estimates the sale price from comparable
  past sales and compares net profit across channels after fees.
- **Shopify break-even**: compares his own store with each marketplace for a typical
  clearance bag and a premium bag: profit per bag, bags per month needed to cover Shopify's
  fixed costs, the price premium or marketing budget that makes Shopify worth it, and a
  sensitivity grid. Marketplace fees are the published UK seller fees; Shopify's extra costs
  (marketing, authentication, postage, packaging, returns) are adjustable assumptions.

**Definitions**

- *Landed cost* = purchase price (converted to £) + inbound shipping + duty/VAT +
  authentication + other costs.
- *Profit* = net payout − seller-paid outbound shipping − landed cost (sold bags only).
- *Margin* = profit ÷ sale price. *Return per £* = profit ÷ landed cost.

**Limitations**

- Early data: estimates use simple comparables and medians rather than a predictive model,
  because a model trained on a few dozen bags would mostly fit noise. A regression model is
  planned once there are ~80–100 sold bags.
- Sell-through counts bags still listed as unsold, so recent lots look worse until they sell.
- Rows marked *Estimated* (mostly unrecorded platform fees) may overstate profit.
""")
