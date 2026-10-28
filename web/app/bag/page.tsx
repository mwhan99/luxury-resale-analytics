import type { Metadata } from "next";

import { BagCalculator } from "@/components/views/BagCalculator";

export const metadata: Metadata = {
  title: "Bag calculator",
  description: "Expected sale price from comparable sales and profit on every channel after fees.",
};

export default function Page() {
  return <BagCalculator />;
}
