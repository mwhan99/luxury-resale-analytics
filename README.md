# Resale Analytics

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
- **Shopify is judged against each marketplace, not in isolation.** Most UK marketplaces are now free or nearly free for sellers, so his own store only pays off if it adds price or saves fees that outweigh its extra costs. A toggle switches to business-seller fees, since eBay's free private-seller option ends once he trades as a registered brand.
- **Estimated data is flagged, not hidden.** Rows with unrecorded fees are marked so overstated profit is visible.

## Early findings (shipment 1, 14 bags: patterns to test, not conclusions)

- **The founder's own records overstated profit by roughly 45%**, mainly because unsold bags were counted as sales and recorded platform fees were left out of the profit formula.
- **Clearance lots beat hand-picked stock on return.** Clearance-lot bags earned about an 80% margin; the one hand-picked premium bag earned about 33% while tying up roughly ten times as much money.
- **Fees differ sharply by channel.** Vestiaire Collective takes about 15% of the sale; Vinted takes nothing from the seller and Depop about 3%.
- **Shopify only pays off for premium bags.** On a typical clearance bag, his own store earns about half what Vinted does once marketing, authentication, postage, packaging and returns are counted, and would need a ~40% higher price to match. On a premium bag it beats Vestiaire Collective by a few percent of the sale price and covers its fixed costs from about 2–3 sales a month, provided winning each buyer costs under roughly £40.
- Fees and listing/sale dates were missing for most bags, so days-to-sell can't be measured yet and profit is likely still overstated.

## Run it

```bash
pip install -r requirements.txt
streamlit run app.py
```

The app opens with the disguised demo data. To see real figures, upload a real tracker in the sidebar: it is used only in your own browser session and is never saved or shown to other visitors. Run `pytest` to check the calculations against the tracker spreadsheet's own formulas and against hand calculations.

Marketplace fees live in `channels.py` (checked 13 Oct 2026, with sources). Update them there when platforms change their fees.

## Data and privacy

- `data/demo_tracker.xlsx`: **demo data.** Based on the business's real first shipment, with each bag's amounts randomly scaled (by up to ±15%) and bag IDs, supplier names, lot names and serial codes replaced. Margins, rankings and conclusions match the real data; individual figures do not.
- `data/blank_tracker.xlsx`: the empty template the founder fills in.
- Real data is never committed: `.gitignore` blocks it. Each new shipment is disguised the same way before it is added.
