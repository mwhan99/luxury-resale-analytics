# CLAUDE.md

Guide to this repository for Claude and for Meng (the owner). Meng is new to
web development: **explain each step in plain English**, what you are about to
do, why, and how to check it worked.

Resale analytics for a small vintage luxury bag business (bought in Tokyo,
sold in the UK). Meng calls it "LongStory". The README deliberately doesn't
name the business: don't add the name anywhere public without the founder's OK.

- Website: https://resale-analytics.vercel.app (Next.js on Vercel, in `web/`;
  Vercel project `resale-analytics`, Root Directory = `web`). Vercel redeploys
  on every push to `main`. Also reachable at web-theta-topaz-onn4siex8q.vercel.app.
- Backup: the original Streamlit app, `app.py`, with a "faster new home"
  banner at the top (`NEW_SITE_URL`). Keep it working: older applications
  link to it.
- Sibling projects with the same setup: `~/Documents/HiddenHire` and
  `~/Documents/VentureLens`. Their CLAUDE.md files are useful references.

## Working rules

- **Never commit real business data.** Only `data/demo_tracker.xlsx` (disguised)
  and `data/blank_tracker.xlsx` belong in the repo; `.gitignore` blocks the rest.
  `web/public/` holds copies of those two files for download.
- Work on a branch and merge with a pull request.
- **The maths exists twice**, in Python (`calc.py`, `channels.py`) and in
  TypeScript (`web/lib/calc.ts`, `web/lib/channels.ts`, `web/lib/tracker.ts`).
  After changing either, run `python scripts/export_golden.py`, then `npm test`
  in `web/`, and fix the TypeScript until it passes. Commit the regenerated
  `web/lib/demo-rows.json` and `web/lib/__fixtures__/golden.json`.
- Fees are hand-written in both `channels.py` and `web/lib/channels.ts`, and the
  method text in `web/app/method/page.tsx` quotes the Shopify defaults. Change
  them together.
- Python: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`,
  then `.venv/bin/pytest` (15 tests).
- Web: in `web/`, `npm run dev` (http://localhost:3000), `npm test` (18 tests),
  `npm run lint`, `npm run build`. Don't run `build` while `dev` is running.
- `web/AGENTS.md` is written by Next.js: this version (16.4) differs from older
  ones, so read the matching guide in `web/node_modules/next/dist/docs/` first.

## The website (`web/`)

| File | What it does |
|---|---|
| `app/page.tsx` | The case study: problem, "finding zero" (the old sheet overstated profit by ~45%), four questions and answers, what was built, judgment calls. Every number is calculated from the demo data at build time with the same functions the tools use. |
| `app/performance`, `lot`, `bag`, `shopify`, `data-quality` | Thin pages; the tools themselves are client components in `components/views/`. |
| `app/method/page.tsx` | Definitions, lot maths, comparables, fees and sources, Shopify assumptions, limitations, how it's built. |
| `components/TrackerProvider.tsx` | Holds the bags (demo or an opened file) and the selling setup, in the layout, so they survive moving between pages. Nothing is saved. `version` goes up on each new file so calculators reset their defaults. |
| `components/DataBar.tsx`, `lib/read-xlsx.ts` | "Open a tracker (.xlsx)". SheetJS (installed from cdn.sheetjs.com, not npm's outdated copy) reads the "Bags" sheet in the browser, header on row 2. |
| `lib/tracker.ts` | `load_tracker` + `derive`: missing numbers are NaN like pandas, dates are read day-first and stored as UTC midnight. |
| `lib/calc.ts`, `lib/channels.ts`, `lib/stats.ts` | Copies of the Python functions. `stats.ts` copies pandas' sum/mean/quantile (linear). |
| `lib/calc.test.ts` | Golden tests against Python, plus reading the real `.xlsx` files. |
| `app/opengraph-image.tsx` | Link-preview image (Fraunces from Google Fonts, built once). |
| Design | "Atelier": ivory `#f6f1e9`, espresso ink, bottle-green `brand` `#1f4d3a`, brass accent, Fraunces headings and Instrument Sans text. Tokens in `app/globals.css`. |

Differences from the Streamlit app, on purpose: the condition list includes
"Satisfactory" (the most common condition in the data); the bag calculator
starts on the latest hand-picked bag's brand instead of the first alphabetically;
a blank "Data confidence" cell doesn't crash the data-quality checks.
