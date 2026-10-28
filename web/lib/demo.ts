/** The disguised demo data the site starts with (exported by scripts/export_golden.py). */
import demoRows from "./demo-rows.json";
import { loadTracker, type RawRow } from "./tracker";

export const DEMO_BAGS = loadTracker(demoRows as RawRow[]);

/** The public address, used for link previews. */
export const SITE_URL = "https://resale-analytics.vercel.app";
export const REPO_URL = "https://github.com/mwhan99/luxury-resale-analytics";
export const LINKEDIN_URL = "https://www.linkedin.com/in/meng-wen-han";
export const OTHER_PROJECTS = [
  { name: "HiddenHire", href: "https://hidden-hire.vercel.app", blurb: "Which NYC startups are hiring fastest" },
  { name: "VentureLens", href: "https://venturelens-chi.vercel.app", blurb: "How often startups raise again" },
];
