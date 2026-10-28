import type { Metadata } from "next";

import { ShopifyBreakeven } from "@/components/views/ShopifyBreakeven";

export const metadata: Metadata = {
  title: "Shopify break-even",
  description: "When does an own Shopify store beat Vinted, Depop, eBay and Vestiaire Collective?",
};

export default function Page() {
  return <ShopifyBreakeven />;
}
