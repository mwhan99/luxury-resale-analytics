"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { NAV_LINKS } from "@/lib/nav";

import { Logo } from "./Logo";

export function SiteHeader() {
  const path = usePathname();
  const current = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const phoneNav = useRef<HTMLElement>(null);
  // On phones the menu scrolls sideways: bring the current page's link into view.
  useEffect(() => {
    // (scrollIntoView would also shift the whole page sideways, so scroll only the menu.)
    const nav = phoneNav.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && link) nav.scrollLeft = link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
  }, [path]);
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" aria-label="Resale Analytics home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="no-scrollbar -mx-4 hidden min-w-0 flex-1 overflow-x-auto px-4 lg:block">
          <NavItems current={current} />
        </nav>
      </div>
      <nav ref={phoneNav} aria-label="Main" className="no-scrollbar overflow-x-auto border-t border-line px-4 py-2 lg:hidden">
        <NavItems current={current} />
      </nav>
    </header>
  );
}

function NavItems({ current }: { current: (href: string) => boolean }) {
  return (
    <ul className="flex w-max gap-1 lg:ml-auto">
      {NAV_LINKS.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            aria-current={current(l.href) ? "page" : undefined}
            className={`block whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
              current(l.href) ? "bg-brand text-white" : "text-muted hover:bg-sand hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
