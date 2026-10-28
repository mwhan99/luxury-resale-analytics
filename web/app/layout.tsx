import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TrackerProvider } from "@/components/TrackerProvider";
import { SITE_URL } from "@/lib/demo";
import "./globals.css";

const instrumentSans = Instrument_Sans({ variable: "--font-instrument-sans", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

const description =
  "Sourcing, pricing and channel decisions for a small vintage luxury bag resale business: " +
  "which stock makes money, what to pay for a lot, where to sell, and when a Shopify store pays off.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Resale Analytics · Case study by Meng Han", template: "%s · Resale Analytics" },
  description,
  openGraph: { title: "Resale Analytics", description, type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${instrumentSans.variable} ${fraunces.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <TrackerProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 sm:pt-10">{children}</main>
          <SiteFooter />
        </TrackerProvider>
      </body>
    </html>
  );
}
