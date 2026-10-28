import type { Metadata } from "next";

import { DataQuality } from "@/components/views/DataQuality";

export const metadata: Metadata = {
  title: "Data quality",
  description: "Missing fees, dates and lot prices, and suspicious entries in the tracker.",
};

export default function Page() {
  return <DataQuality />;
}
