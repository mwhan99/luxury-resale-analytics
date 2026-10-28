# Resale Analytics

**Live site: [resale-analytics.vercel.app](https://resale-analytics.vercel.app)** · the original Streamlit app stays up as a backup.

Sourcing, pricing and channel decisions for a small vintage luxury bag resale business that buys stock in Tokyo and sells it in the UK on Vinted, Depop, eBay and Vestiaire Collective, ahead of launching its own brand on Shopify.

## The problem

The founder had been running the business on instinct: buying clearance lots from a Japanese store, pricing by feel, and selling wherever was convenient. Before investing in his own brand and store, he needed to know which parts of the business actually make money.

Key questions:

1. **Sourcing:** is cheap clearance stock (lots he can't pick bag by bag) or hand-picked premium bags the better use of money?
2. **Lot pricing:** what's the most he should pay for a lot and still hit his target return?
3. **Channels:** after fees, which platform earns the most per bag, and when does his own Shopify store make sense?
4. **Pricing:** are some bags underpriced or overpriced compared with what similar bags sold for?

## What I built

- **Tracking system:** a spreadsheet template the founder fills in for every bag (landed cost, lot, listing, sale, payout), with built-in calculations and data-confidence flags. Replaced an informal sheet where swapped dates, ignored fees and unsold bags counted as sales overstated profit by roughly 45%.
- **This app**, which reads the tracker and recalculates everything from raw inputs:
  - **Performance:** profit, margin, sell-through and unsold stock by sourcing type, brand, channel and lot.
  - **Lot calculator:** expected profit, break-even sell-through, and the maximum lot price for a target return, with cautious/expected/strong scenarios from past payouts.
  - **Single-bag calculator:** expected sale price from comparable past sales, net profit by channel after fees, and a buy / pass / check signal.
  - **Shopify break-even:** compares his own store with Vinted, Depop, eBay and Vestiaire Collective for a typical clearance bag and a premium bag, using published UK seller fees and adjustable Shopify costs (marketing, authentication, postage, packaging, returns). Shows profit per bag, the bags per month needed to cover Shopify's fixed costs, the price premium or marketing budget that makes Shopify worth it, and a sensitivity grid.
  - **Data quality:** flags missing fees, dates, lot prices and suspicious entries.

## Method and judgment calls

- **Comparables, not machine learning, for now.** With a few dozen bags, a predictive model would mostly fit noise. The app uses medians and quartiles of comparable sales and says how many bags each estimate rests on. A regression model is planned at ~80–100 sold bags.
- **Lots are priced as a whole.** Because clearance lots arrive unselected, the decision is the lot price, not individual bags, so the lot calculator works from sell-through and net payout per sold bag.
- **Fees come from each platform's published UK seller fees, not his records,** because most of his sales had no fee recorded. They're kept in one file with sources and a check date, since platforms change fees often. Shopify's extra costs are labelled assumptions the user can adjust.
- **Shopify is judged against each marketplace, not in isolation.** Most UK marketplaces are now free or nearly free for sellers, so his own store only pays off if it adds price or saves fees that outweigh its extra costs. A toggle switches to business-seller fees, since eBay's free private-seller option ends once he trades as a registered brand. Another swaps in his actual fee rate on any platform where at least two sales have a recorded fee, without treating blank fees as zero.
- **Estimated data is flagged, not hidden.** Rows with unrecorded fees are marked so overstated profit is visible.

## Findings so far (3 shipments plus a Vinted collab, 62 bags: patterns to test, not conclusions)

- **The founder's own records overstated profit.** At first review his sheet booked profit on bags still in stock and left recorded platform fees out of the profit formula (overstating realized profit by roughly 45% at the time), and his ROI column multiplied by 100 twice. Later, two purchase prices typed with comma decimals were read as text and silently dropped from cost.
- **The cheap first lot was by far the best use of money.** Shipment 1, a clearance lot of low-cost bags, returned several times its cost. Shipments 2 and 3 were much larger lots of higher-value bags and returned about 40% each: more profit at risk, much lower return per pound.
- **Fast exit vs. margin.** Selling a whole lot to a trade buyer cleared stock quickly with no platform fees, but at about a third margin on the sale price; Vinted and Depop sales of cheap stock kept far more of each sale.
- **Real Vestiaire fees vary by sale.** Across 12 recorded sales his fees average about 16% of the sale price, with two early sales at about 19%; the app uses his actual average where at least two fees are recorded.
- **Cost allocation matters.** In one lot, per-bag costs were split in proportion to sale price, which makes every bag's margin identical by construction. Lot-level results are reliable; per-bag comparisons inside that lot are not.
- **Shopify only pays off for higher-value bags,** and only if winning each buyer stays cheap: on low-priced stock his own store earns well under Vinted once marketing, authentication, postage, packaging and returns are counted.
- Listing and sale dates are still missing, so days-to-sell can't be measured yet.

## How it's built

- **Analysis in Python.** `calc.py` and `channels.py` hold every calculation, in plain pandas, tested with `pytest` against the tracker spreadsheet's own formulas and hand calculations. `app.py` is the original Streamlit app.
- **Website in Next.js on Vercel** (`web/`). The same calculations in TypeScript (`web/lib/`), running in the visitor's browser. There is no server or database, so every page is prebuilt and loads instantly. An opened tracker is read by the browser itself and never leaves the device.
- **Golden tests keep the two in step.** `scripts/export_golden.py` saves the Python results for the demo data and a set of fixed inputs; `npm test` checks the TypeScript gives the same answers to 9 significant digits, including reading the `.xlsx` file.

## Run it

The website:

```bash
cd web
npm install
npm run dev        # then open http://localhost:3000
npm test           # TypeScript vs Python
```

The original Streamlit app:

```bash
pip install -r requirements.txt
streamlit run app.py
pytest
```

Both open with the disguised demo data. To see real figures, open a real tracker: on the website it is read only by your browser; on Streamlit it is used only for your session. Neither saves it or shows it to other visitors.

Marketplace fees live in `channels.py` and `web/lib/channels.ts` (checked 13 Oct 2026, with sources). When platforms change their fees, update both, run `python scripts/export_golden.py`, then `npm test` in `web/`.

## Data and privacy

- `data/demo_tracker.xlsx`: **demo data.** Based on the business's real shipments, with each bag's amounts randomly scaled (by up to ±15%) and bag IDs, supplier names, lot names and serial codes replaced. Margins, rankings and conclusions match the real data; individual figures do not.
- `data/blank_tracker.xlsx`: the empty template the founder fills in.
- Real data is never committed: `.gitignore` blocks it. Each new shipment is disguised the same way before it is added.
