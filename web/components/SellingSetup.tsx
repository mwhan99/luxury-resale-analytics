"use client";

/** The "selling setup" panel shared by the bag calculator and the Shopify page. */
import { fixedMonthly, MIN_OBSERVED_SALES, perBag, platformFees, FEES, type ShopifyCosts } from "@/lib/channels";
import { gbp, pct } from "@/lib/format";
import { NumberField, PercentSlider, Toggle } from "./inputs";
import { useTracker } from "./TrackerProvider";
import { Fold } from "./ui";

export function SellingSetup({ open = false }: { open?: boolean }) {
  const t = useTracker();
  const observed = Object.entries(t.observed);
  const set = (k: keyof ShopifyCosts) => (v: number) => t.setShop({ ...t.shop, [k]: v });
  return (
    <Fold summary="Selling setup and Shopify cost assumptions" open={open}>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-4">
          <Toggle
            label="Trading as a registered business"
            checked={t.business}
            onChange={t.setBusiness}
            hint="Removes eBay's free private-seller option and uses business fees."
          />
          <Toggle
            label="Use his actual fee rates where known"
            checked={t.useActual}
            onChange={t.setUseActual}
            disabled={!observed.length}
            hint={`Where at least ${MIN_OBSERVED_SALES} sales on a platform have a recorded fee, use the real rate instead of the published one.`}
          />
          <ul className="space-y-1 text-xs text-faint">
            {observed.length ? observed.map(([name, [rate, n]]) => (
              <li key={name}>{name}: his actual {pct(rate, 1)} from {n} sales vs ~{pct(platformFees(FEES[name], 500) / 500)} published</li>
            )) : <li>No platform has {MIN_OBSERVED_SALES}+ sales with recorded fees yet, so published fees are used.</li>}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs text-faint">Assumptions, not sourced figures. Change them to test your own view.</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <NumberField label="Marketing to win each buyer" value={t.shop.marketing} onChange={set("marketing")} step={5} />
            <NumberField label="Authentication per bag" value={t.shop.authentication} onChange={set("authentication")} step={5} />
            <NumberField label="Postage per order" value={t.shop.postage} onChange={set("postage")} />
            <NumberField label="Branded packaging per bag" value={t.shop.packaging} onChange={set("packaging")} />
            <NumberField label="Cost per return" value={t.shop.return_cost} onChange={set("return_cost")} />
            <PercentSlider label="Return rate" value={t.shop.return_rate} onChange={set("return_rate")} max={50} step={1} />
            <NumberField label="Shopify plan per month" value={t.shop.plan} onChange={set("plan")} />
            <NumberField label="Apps & theme per month" value={t.shop.apps} onChange={set("apps")} step={5} />
            <NumberField label="Domain per month" value={t.shop.domain} onChange={set("domain")} step={0.25} />
            <NumberField label="Other fixed marketing per month" value={t.shop.other_fixed} onChange={set("other_fixed")} step={10} />
            <NumberField label="One-off setup cost" value={t.shop.setup} onChange={set("setup")} step={25} />
          </div>
          <p className="mt-4 text-sm text-muted">
            = <span className="font-semibold text-ink">{gbp(perBag(t.shop), 2)}</span> extra per Shopify sale,{" "}
            <span className="font-semibold text-ink">{gbp(fixedMonthly(t.shop), 2)}</span> fixed per month
          </p>
        </div>
      </div>
    </Fold>
  );
}
