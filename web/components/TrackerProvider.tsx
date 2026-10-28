"use client";

/**
 * Holds the data every tool page uses: the bags (demo or the visitor's own
 * upload) and the "selling setup" (business toggle, fee basis, Shopify costs).
 * It lives in the layout, so it survives moving between pages. Nothing is
 * saved anywhere: closing the tab forgets an uploaded file.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { DEMO_BAGS } from "@/lib/demo";
import { DEFAULT_SHOP, feeTable, observedFeeRates, type FeeTable, type ShopifyCosts } from "@/lib/channels";
import type { Bag } from "@/lib/tracker";

type Tracker = {
  bags: Bag[];
  fileName: string | null; // null = demo data
  version: number; // goes up on every new file, so calculators reset their defaults
  loadFile: (bags: Bag[], fileName: string) => void;
  loadDemo: () => void;
  business: boolean;
  setBusiness: (v: boolean) => void;
  observed: Record<string, [number, number]>;
  useActual: boolean;
  setUseActual: (v: boolean) => void;
  fees: FeeTable;
  feeBasis: string;
  shop: ShopifyCosts;
  setShop: (s: ShopifyCosts) => void;
};

const TrackerContext = createContext<Tracker | null>(null);

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [bags, setBags] = useState<Bag[]>(DEMO_BAGS);
  const [fileName, setFileName] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [business, setBusiness] = useState(false);
  const [actualChoice, setUseActual] = useState(true);
  const [shop, setShop] = useState<ShopifyCosts>(DEFAULT_SHOP);

  const value = useMemo<Tracker>(() => {
    const observed = observedFeeRates(bags);
    const hasObserved = Object.keys(observed).length > 0;
    const useActual = hasObserved && actualChoice;
    return {
      bags, fileName, version,
      loadFile: (b, name) => { setBags(b); setFileName(name); setVersion((v) => v + 1); },
      loadDemo: () => { setBags(DEMO_BAGS); setFileName(null); setVersion((v) => v + 1); },
      business, setBusiness,
      observed, useActual, setUseActual,
      fees: feeTable(useActual ? observed : null),
      feeBasis: useActual ? "his actual fee rates where known, published UK seller fees elsewhere"
        : "published UK seller fees",
      shop, setShop,
    };
  }, [bags, fileName, version, business, actualChoice, shop]);

  return <TrackerContext value={value}>{children}</TrackerContext>;
}

export function useTracker(): Tracker {
  const t = useContext(TrackerContext);
  if (!t) throw new Error("useTracker must be used inside <TrackerProvider>");
  return t;
}
