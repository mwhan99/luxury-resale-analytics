import type { Metadata } from "next";

import { LotCalculator } from "@/components/views/LotCalculator";

export const metadata: Metadata = {
  title: "Lot calculator",
  description: "Expected profit, break-even sell-through and the most to pay for a clearance lot.",
};

export default function Page() {
  return <LotCalculator />;
}
