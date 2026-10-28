import type { Metadata } from "next";

import { Performance } from "@/components/views/Performance";

export const metadata: Metadata = {
  title: "Performance",
  description: "Profit, margin, sell-through and unsold stock by sourcing type, brand, channel and lot.",
};

export default function Page() {
  return <Performance />;
}
