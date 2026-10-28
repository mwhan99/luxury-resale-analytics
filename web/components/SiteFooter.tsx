import Link from "next/link";

import { LINKEDIN_URL, OTHER_PROJECTS, REPO_URL } from "@/lib/demo";
import { NAV_LINKS } from "@/lib/nav";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Built by <span className="font-semibold text-ink">Meng Han</span>, M.S. Management and
            Analytics (Business Analytics), New York University.
          </p>
          <p className="mt-2 max-w-sm text-sm text-faint">
            Analytics for a real small business. Figures shown are disguised demo data.
          </p>
        </div>
        <nav aria-label="Footer" className="text-sm">
          <div className="font-semibold text-ink">Explore</div>
          <ul className="mt-2 space-y-1 text-muted">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-block py-1 hover:text-brand">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="text-sm">
          <div className="font-semibold text-ink">More projects</div>
          <ul className="mt-2 space-y-2 text-muted">
            {OTHER_PROJECTS.map((p) => (
              <li key={p.name}>
                <a href={p.href} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
                  <span className="font-medium text-ink">{p.name} ↗</span>
                  <span className="block text-xs text-faint">{p.blurb}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <div className="font-semibold text-ink">Connect</div>
          <ul className="mt-2 space-y-1 text-muted">
            <li><a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className="inline-block py-1 hover:text-brand">LinkedIn ↗</a></li>
            <li><a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-block py-1 hover:text-brand">Source on GitHub ↗</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
