/**
 * The case study. Every number here is calculated from the demo data at build
 * time with the same functions the tools use, so the story and the tools agree.
 */
import Link from "next/link";

import { BarList } from "@/components/charts";
import { Card, Chip, SectionTitle } from "@/components/ui";
import { groupSummary, kpis, lotHistory, maxLotPrice } from "@/lib/calc";
import { bestMarketplace, breakevenTable, DEFAULT_SHOP, feeTable, observedFeeRates, typicalBags } from "@/lib/channels";
import { DEMO_BAGS, REPO_URL } from "@/lib/demo";
import { gbp, pct } from "@/lib/format";

const df = DEMO_BAGS;
const k = kpis(df);
const byLot = groupSummary(df, "lot");
const lot = (id: string) => byLot.find((r) => r.label === id)!;
const byChannel = groupSummary(df, "channel");
const channel = (id: string) => byChannel.find((r) => r.label === id)!;

const h = lotHistory(df);
// The same rounded defaults the lot calculator starts with
const typicalMax = maxLotPrice(Math.round(h.avg_lot_bags), Math.round(h.avg_lot_inbound), 0,
  Math.round(h.sell_through * 100) / 100, Math.round(h.net_median), 1);

const fees = feeTable(observedFeeRates(df));
const typ = typicalBags(df);
const shopify = (kind: "Clearance lot" | "Selected single") => {
  const be = breakevenTable(typ[kind].price, typ[kind].landed, DEFAULT_SHOP, 4, { fees });
  const best = bestMarketplace(be.rows);
  const beaten = be.rows.filter((r) => r.advantage > 0);
  return { price: typ[kind].price, own: be.summary.shopify_profit, best, beaten };
};
const cheap = shopify("Clearance lot");
const premium = shopify("Selected single");
const vestiaire = premium.beaten.find((r) => r.compared_with === "Vestiaire Collective");

const QUESTIONS = [
  {
    n: "01", topic: "Sourcing",
    q: "Is cheap clearance stock or hand-picked premium stock the better use of money?",
    a: "The cheap first lot was by far the best use of money.",
    body: `Lot A cost ${gbp(lot("LOT-A").spend)} and made ${gbp(lot("LOT-A").profit)}: ${gbp(lot("LOT-A").return_per_pound, 2)} profit for every £1 spent. ` +
      `The two much larger lots of higher-value bags returned ${pct(lot("LOT-B").return_per_pound)} and ${pct(lot("LOT-C").return_per_pound)}: more profit at risk, far less per pound.`,
    chartTitle: "Profit per £1 spent, by lot",
    chart: ["LOT-A", "LOT-B", "LOT-C"].map((id) => ({ label: `Lot ${id.slice(-1)}`, value: lot(id).return_per_pound })),
    money: true,
    href: "/performance", cta: "Compare lots",
  },
  {
    n: "02", topic: "Lot pricing",
    q: "What's the most he should pay for a lot and still hit his target return?",
    a: `To double his money on a typical lot, pay at most ${gbp(typicalMax)}.`,
    body: `A typical lot is ${Math.round(h.avg_lot_bags)} bags; ${pct(h.sell_through)} of clearance bags sold, netting about ${gbp(h.net_median)} each after fees and postage. ` +
      `His lots so far averaged ${gbp(h.avg_lot_price)}, so the calculator gives him a walk-away price before he bids.`,
    href: "/lot", cta: "Price a lot",
  },
  {
    n: "03", topic: "Channels",
    q: "After fees, which platform earns the most per bag?",
    a: "A quick exit costs margin.",
    body: `Selling to a trade buyer cleared stock fast with no platform fees, but kept only ${pct(channel("Trade buyer (wholesale)").margin)} of the sale price as profit. ` +
      `Vinted and Depop sales of cheap stock kept ${pct(channel("Vinted").margin)} and ${pct(channel("Depop").margin)}. His real Vestiaire fees came to ${pct(fees["Vestiaire Collective"].commission_pct, 1)} of the sale price, above the published rate.`,
    chartTitle: "Margin by channel (5+ sales)",
    chart: byChannel.filter((r) => r.sold >= 5).map((r) => ({ label: r.label ?? "–", value: r.margin })),
    money: false,
    href: "/bag", cta: "Check a bag",
  },
  {
    n: "04", topic: "Own store",
    q: "When does launching his own Shopify store make sense?",
    a: "Only for higher-value bags, and only if winning each buyer stays cheap.",
    body: `On a typical ${gbp(cheap.price)} clearance bag, his own store would earn ${gbp(cheap.own)} after marketing, authentication, postage, packaging and returns, against ${gbp(cheap.best.profit_there)} on ${cheap.best.compared_with}. ` +
      (vestiaire ? `On a ${gbp(premium.price)} premium bag it beats Vestiaire Collective by ${gbp(vestiaire.advantage)} a bag, ` : `On a ${gbp(premium.price)} premium bag it does better, `) +
      `but needs about a ${pct(premium.best.premium_needed)} higher price to match ${premium.best.compared_with}.`,
    href: "/shopify", cta: "Run the break-even",
  },
];

const ERRORS = [
  "Profit was booked on bags still in stock.",
  "Recorded platform fees were left out of the profit formula.",
  "The ROI column multiplied by 100 twice.",
  "Two purchase prices typed with comma decimals were read as text and silently dropped from cost.",
];

const CALLS = [
  ["Comparables, not machine learning (yet)", "With a few dozen bags, a predictive model would mostly fit noise. Estimates use medians and quartiles of comparable sales and say how many bags they rest on. A regression model is planned at 80–100 sold bags."],
  ["Lots are priced as a whole", "Clearance lots arrive unselected, so the real decision is the lot price, not each bag. The lot calculator works from sell-through and net payout per sold bag."],
  ["Published fees, with his own where he has them", "Most sales had no fee recorded, so fees come from each platform's published UK schedule, kept in one place with sources and a check date. Where at least two sales have a real fee, his actual rate is used instead."],
  ["Estimated data is flagged, not hidden", "Rows with unrecorded fees are marked, so any overstated profit stays visible. A data-quality page lists every gap to fix."],
];

const TOOLS = [
  ["/performance", "Performance", "Profit, margin, sell-through and unsold stock by sourcing type, brand, channel and lot."],
  ["/lot", "Lot calculator", "Expected profit, break-even sell-through and the most to pay for a lot, with cautious and strong scenarios."],
  ["/bag", "Bag calculator", "Expected sale price from comparable sales, profit on every channel after fees, and a buy / pass / check signal."],
  ["/shopify", "Shopify break-even", "His own store against each marketplace: profit per bag, bags a month to cover fixed costs, and a sensitivity grid."],
  ["/data-quality", "Data quality", "Flags missing fees, dates and lot prices, and suspicious entries such as swapped days and months."],
  ["/method", "Method", "Definitions, fee sources, judgment calls and limitations, in plain English."],
];

const TRUST = [
  ["Disguised demo data", "Built from the real shipments, with every bag's amounts randomly scaled by up to ±15% and names, IDs and serial codes replaced. Margins and rankings match the real data; individual figures don't."],
  ["Your file stays with you", "The founder opens his real tracker here. The spreadsheet is read by the browser itself and never uploaded, saved or shown to anyone else."],
  ["Checked against the original", "The maths was first written and tested in Python. This site runs a TypeScript copy, and automated tests check it gives the same answers to 9 significant digits."],
];

export default function Home() {
  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Hero */}
      <section className="grid items-start gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
        <div>
          <div className="flex flex-wrap gap-2">
            <Chip>Case study</Chip>
            <Chip tone="plain">Small-business analytics</Chip>
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
            Which part of a luxury resale business <em className="text-brass">actually</em> makes money?
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            A founder buys vintage designer bags in Tokyo and sells them in the UK on Vinted, Depop, eBay and
            Vestiaire Collective. Before launching his own brand, he needed to know what was really working.
            I rebuilt his records, then built the tools he uses to decide what to buy, what to pay and where to sell.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/lot" className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark">
              Try the lot calculator
            </Link>
            <a href="#findings" className="rounded-full border border-line bg-card px-5 py-2.5 font-semibold text-ink hover:border-brand">
              See the findings
            </a>
          </div>
        </div>

        <Card>
          <div className="text-xs font-semibold tracking-wide text-faint">THE BUSINESS SO FAR</div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5">
            {[
              ["Bags tracked", `${k.bags}`, `${k.sold} sold · ${pct(k.sell_through)}`],
              ["Profit on sold bags", gbp(k.profit), `${pct(k.margin)} margin`],
              ["Profit per £1", gbp(k.roi_sold, 2), "on bags sold"],
              ["Shipments", "3 + collab", "Tokyo to London"],
            ].map(([label, value, sub]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">{value}</dd>
                <dd className="text-xs text-faint">{sub}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 rounded-xl bg-loss-soft p-4">
            <div className="font-display text-3xl font-semibold text-loss">~45%</div>
            <p className="mt-1 text-sm leading-snug text-ink">
              How much his own spreadsheet overstated realised profit when I first reviewed it.
            </p>
          </div>
        </Card>
      </section>

      {/* The first finding */}
      <section className="grid gap-8 lg:grid-cols-[1fr_1.35fr]">
        <div>
          <Chip tone="brass">Finding zero</Chip>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">
            Before any analysis, the numbers had to be right.
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            He had been running the business on instinct: buying clearance lots, pricing by feel and selling
            wherever was convenient. His informal sheet made the business look far more profitable than it was.
            I replaced it with a tracking template that records every bag from purchase to payout and recalculates
            everything from raw inputs.
          </p>
          <a href="/blank_tracker.xlsx" download className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
            Download the blank tracker template (.xlsx)
          </a>
        </div>
        <Card>
          <div className="text-sm font-semibold text-ink">What the old sheet got wrong</div>
          <ol className="mt-3 space-y-3">
            {ERRORS.map((e, i) => (
              <li key={e} className="flex gap-3 text-sm leading-relaxed text-muted">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-loss-soft text-xs font-bold text-loss">{i + 1}</span>
                {e}
              </li>
            ))}
          </ol>
        </Card>
      </section>

      {/* Four questions */}
      <section id="findings" className="scroll-mt-28">
        <SectionTitle
          title="Four questions, four answers"
          sub={`From ${k.bags} bags across three shipments and a Vinted collab. These are patterns to test as more shipments arrive, not final conclusions.`}
        />
        <div className="grid gap-5 md:grid-cols-2">
          {QUESTIONS.map((x) => (
            <Card key={x.n} className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="font-display text-sm font-semibold text-brass">{x.n}</span>
                <Chip tone="plain">{x.topic}</Chip>
              </div>
              <p className="mt-3 text-sm text-muted">{x.q}</p>
              <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-ink">{x.a}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{x.body}</p>
              {x.chart && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium text-faint">{x.chartTitle}</div>
                  <BarList rows={x.chart} format={(v) => (x.money ? gbp(v, 2) : pct(v))} />
                </div>
              )}
              <Link href={x.href} className="mt-auto pt-5 text-sm font-semibold text-brand hover:underline">
                {x.cta} →
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* What I built */}
      <section>
        <SectionTitle title="What I built" sub="A tracking system the founder fills in, and five tools that read it." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(([href, title, text]) => (
            <Link key={href} href={href} className="group rounded-2xl border border-line bg-card p-5 transition hover:border-brand">
              <div className="font-display text-lg font-semibold text-ink group-hover:text-brand">{title} →</div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Judgment calls */}
      <section>
        <SectionTitle title="Judgment calls" />
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          {CALLS.map(([title, text]) => (
            <div key={title} className="border-l-2 border-brass pl-4">
              <h3 className="font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy and build */}
      <section>
        <div className="grid gap-6 rounded-2xl bg-brand p-6 text-white sm:p-8 md:grid-cols-3">
          {TRUST.map(([title, text]) => (
            <div key={title}>
              <h3 className="font-display text-lg font-semibold text-brass-soft">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/80">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          Read the <Link href="/method" className="font-semibold text-brand hover:underline">method</Link> or the{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">source code on GitHub ↗</a>.
        </p>
      </section>
    </div>
  );
}
