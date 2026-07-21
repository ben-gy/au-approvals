# Building Approvals

**Every home Australia approves to build — by region, house versus apartment, and against the 1.2-million target.**

🔗 **Live:** [https://au-approvals.benrichardson.dev](https://au-approvals.benrichardson.dev)

## What is this?

Australia is in the middle of a housing-supply crisis, and everyone quotes the national approvals headline. Almost nobody can see *where* the homes are being approved, *what kind* they are (a detached house on the fringe, or an apartment in the inner city), and *how far behind* the National Housing Accord's 1.2-million-homes target the country is running.

This site pulls the ABS Building Approvals series straight from the ABS Data API — new residential dwelling units approved every month by councils and private certifiers — and turns it into nine interactive views. It maps every one of ~337 SA3 regions, joins them to resident population so a booming growth corridor can be compared fairly with an established suburb, and stacks the national trend against the ~20,000-a-month completions pace the Accord implies.

Approvals are the *leading* indicator of housing supply: they happen before construction starts and long before anyone moves in. Because not every approval is built, approvals need to run comfortably above the target for completions to keep pace — so when approvals slip below it, that is the earliest warning sign the country will miss its target.

## Who is this for?

Anyone following the housing debate who wants the supply side rather than prices: would-be buyers and renters wondering whether homes are actually being approved near them, journalists and policy watchers tracking the Accord, and council and industry people who need the regional detail. It works on a phone and rewards exploration on a desktop.

## Data Sources

| Source | What it provides | Update frequency |
|--------|-------------------|-----------------|
| ABS Building Approvals (BA_SA2 dataflow, ABS Data API) | New residential dwellings approved by SA3 / state / national, split into houses, townhouses and apartments, plus the dollar value of work approved. Monthly from July 2021. | Monthly |
| ABS Estimated Resident Population (ERP_ASGS2021) | Resident population per SA3 — the per-capita denominator | Annual |
| ABS ASGS 2021 SA3 boundaries | Real polygons for the choropleth map | Static |

## Features

- **Accord tracker** — national monthly approvals stacked by dwelling type, against the ~20,000/month pace the 1.2-million target implies, with the rate-hike cycle and Accord start annotated; togglable by state and between monthly and rolling-12-month.
- **Map** — Leaflet choropleth of every SA3 region, shaded by supply per resident, total volume, apartment share, growth, or value.
- **Rankings** — leaderboard by supply intensity, volume, house share, apartment share, growth or value.
- **Trajectory** — each region's current supply intensity against its three-year change, with zoom/pan — separating regions that always built a lot from those ramping up or collapsing.
- **Houses vs apartments** — the national density mix over time, plus where apartments and where detached houses actually get approved.
- **States** — per-state small multiples and a state × building-type matrix.
- **Explorer** — searchable, sortable table of every region with rolling-12-month sparklines.
- **Distribution** and **Insights** — a histogram with a median marker, and automatically-detected findings.
- **Per-region drill-down** — hash-linkable, with monthly history, house/apartment mix, value and rank.

## Tech Stack

- **Runtime:** Vanilla TypeScript
- **Build:** Vite 6
- **Testing:** Vitest (pipeline parse logic + position-asserting layout tests)
- **Hosting:** GitHub Pages (static, no backend)
- **Data:** GitHub Actions pipeline, refreshed monthly
- **Libraries:** Leaflet for the map; every other chart is hand-rolled SVG

## Local Development

```bash
npm install        # app dependencies
npm run dev        # dev server
npm test           # unit tests
npm run build      # production build
npm run preview    # preview the built site

# Rebuild the data (needs pipeline deps for boundary simplification):
cd pipeline && npm install && cd ..
node pipeline/collect.mjs      # fetch raw ABS data to pipeline/tmp
node pipeline/aggregate.mjs    # shape it into public/data/*.json
```

## How it works

`pipeline/collect.mjs` fetches the ABS Building Approvals series (SA3 dwellings + houses, value, and the national/state building-type mix), the ABS resident population by SA3, and the ABS SA3 boundaries. `pipeline/parse.mjs` — dependency-free and unit-tested — turns the raw SDMX CSV into aligned monthly series, trailing-12-month aggregates, per-capita rates and the house/non-house split. `pipeline/aggregate.mjs` simplifies the boundaries with mapshaper, asserts the house + non-house split reproduces the total exactly, and writes `public/data/{meta,regions,national}.json` plus `sa3.geojson`. The frontend reads those static files and renders everything client-side. A monthly GitHub Actions job re-runs the pipeline to match the ABS release cadence.

## License

MIT
