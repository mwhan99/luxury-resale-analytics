import type { Metadata } from "next";

import { Card, PageIntro } from "@/components/ui";
import { DEFAULT_SHOP, FEES, FEES_CHECKED, MIN_OBSERVED_SALES, SOURCES } from "@/lib/channels";
import { REPO_URL } from "@/lib/demo";
import { gbp, pct } from "@/lib/format";
import { MIN_COMPS } from "@/lib/tracker";

export const metadata: Metadata = {
  title: "Method",
  description: "Definitions, fee sources, judgment calls and limitations behind the resale analytics.",
};

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "definitions", title: "Definitions",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li><b>Landed cost</b> = purchase price (converted to £) + inbound shipping + import duty/VAT + authentication + other costs.</li>
        <li><b>Profit</b> = net payout − seller-paid outbound shipping − landed cost. Only sold bags have a profit.</li>
        <li><b>Margin</b> = profit ÷ sale price. <b>Profit per £1</b> (return) = profit ÷ landed cost.</li>
        <li><b>Fees</b> = sale price − net payout received.</li>
        <li><b>Sell-through</b> = bags sold ÷ bags bought. It counts bags still listed as unsold, so recent lots look worse until they sell.</li>
      </ul>
    ),
  },
  {
    id: "lots", title: "Lot calculator",
    body: (
      <>
        <p>Cost = lot price + shipping and duty for the whole lot + other costs per bag × bags. Expected net revenue = bags × sell-through × net received per sold bag.</p>
        <p className="mt-2">The <b>most to pay</b> for a target return R is: net revenue ÷ (1 + R) − shipping and duty − other costs. At that price, profit ÷ cost is exactly R.</p>
        <p className="mt-2">Break-even sell-through = cost ÷ (bags × net per sold bag). Cautious and Strong scenarios use the lower and upper quartile of past net payouts per sold clearance-lot bag.</p>
      </>
    ),
  },
  {
    id: "comparables", title: "Comparable sales",
    body: (
      <p>
        The bag calculator starts from every sold bag of the same brand. It narrows to bags bought the same way
        (hand-picked), then to the same condition, but only when at least {MIN_COMPS} sales would remain. The
        expected price is the median of what is left. With fewer than {MIN_COMPS} comparables, the signal is
        <b> CHECK</b> rather than BUY or PASS, because the estimate is a guess.
      </p>
    ),
  },
  {
    id: "fees", title: "Platform fees",
    body: (
      <>
        <p>Published UK seller fees, checked {FEES_CHECKED}:</p>
        <ul className="mt-2 space-y-1.5">
          {Object.entries(FEES).map(([name, f]) => <li key={name}><b>{name}:</b> {f.note}</li>)}
        </ul>
        <p className="mt-3">
          Where at least {MIN_OBSERVED_SALES} sales on a platform have a recorded fee, his actual average rate replaces the
          published schedule. Blank fees are not treated as zero. eBay is skipped because the tracker doesn&apos;t say
          whether a sale was private (free) or business.
        </p>
        <p className="mt-2 text-sm">
          Sources: {Object.entries(SOURCES).map(([label, href], i) => (
            <span key={href}>{i > 0 && " · "}<a href={href} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{label}</a></span>
          ))}
        </p>
      </>
    ),
  },
  {
    id: "shopify", title: "Shopify break-even",
    body: (
      <>
        <p>
          His own store is judged against each marketplace, not on its own. It pays its payment fee plus extra costs a
          marketplace doesn&apos;t have. The defaults are assumptions you can change: marketing to win each buyer{" "}
          {gbp(DEFAULT_SHOP.marketing)}, authentication {gbp(DEFAULT_SHOP.authentication)}, postage {gbp(DEFAULT_SHOP.postage)},
          packaging {gbp(DEFAULT_SHOP.packaging)}, and returns at {pct(DEFAULT_SHOP.return_rate)} × {gbp(DEFAULT_SHOP.return_cost)}.
          The fixed costs are the plan, apps and domain each month, plus a one-off setup cost.
        </p>
        <p className="mt-2">
          For each marketplace the page shows the Shopify advantage per bag, the bags a month needed to cover the fixed
          costs, the price premium that would make Shopify match, and the most it could spend on marketing per sale and
          still match.
        </p>
      </>
    ),
  },
  {
    id: "limitations", title: "Limitations",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Early data: a few dozen bags. Estimates use simple comparables and medians rather than a predictive model, which would mostly fit noise. A regression model is planned at about 80–100 sold bags.</li>
        <li>Rows marked <i>Estimated</i>, mostly unrecorded platform fees, may overstate profit.</li>
        <li>Listing and sale dates are still missing, so days-to-sell can&apos;t be measured yet.</li>
        <li>In one lot, per-bag costs were split in proportion to sale price, which makes every bag&apos;s margin identical by construction. Lot-level results are reliable; per-bag comparisons inside that lot are not.</li>
        <li>eBay&apos;s lower 7% rate above £800 isn&apos;t modelled.</li>
      </ul>
    ),
  },
  {
    id: "built", title: "How this site is built",
    body: (
      <>
        <p>
          The analysis was first built in Python (pandas) as a Streamlit app. This site is a Next.js rebuild on Vercel
          with the same calculations in TypeScript, running in your browser. There is no server or database, so pages
          load instantly. An opened tracker is read by the browser and never leaves your device.
        </p>
        <p className="mt-2">
          A script saves the Python results for the demo data and a set of fixed inputs, and automated tests check the
          TypeScript matches them to 9 significant digits. <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Source on GitHub ↗</a>
        </p>
      </>
    ),
  },
];

export default function Method() {
  return (
    <>
      <PageIntro chip="Method" title="How the numbers are worked out">
        All rules are plain arithmetic on the tracker. No AI model is involved.
      </PageIntro>
      <div className="grid gap-8 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="block rounded-lg px-3 py-1.5 text-muted hover:bg-sand hover:text-ink">{s.title}</a></li>
            ))}
          </ul>
        </nav>
        <div className="space-y-5">
          {SECTIONS.map((s) => (
            <Card key={s.id}>
              <section id={s.id} className="scroll-mt-28">
                <h2 className="mb-3 font-display text-xl font-semibold text-ink">{s.title}</h2>
                <div className="leading-relaxed text-muted [&_b]:text-ink">{s.body}</div>
              </section>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
