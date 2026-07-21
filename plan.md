# Site Plan: Building Approvals

## Overview
- **Name:** Building Approvals
- **Repo name:** au-approvals
- **Tagline:** Every home Australia approves to build — by region, house versus apartment, and against the 1.2-million target.

### Naming Convention
Plain topic name, no country code. `country: "AU"` in the index entry renders the flag.

## Target Audience
People following Australia's housing crisis who want the *supply* side, not prices: would-be buyers and renters wondering whether homes are actually being approved near them; journalists and policy watchers tracking the National Housing Accord; council and industry people. General public on light theme, but data-dense enough to reward exploration.

## Value Proposition
Everyone quotes the national approvals figure. Nobody can see *where* the homes are being approved, *what kind* (detached house vs apartment), and *how far behind the 1.2-million target* the country is running — all in one place, mapped to real regions and comparable per-resident. Approvals are the leading indicator: they happen before commencements and completions, so this is the earliest read on the pipeline.

## Data Sources
| Source | URL | What it provides | Update frequency | Auth |
|--------|-----|-------------------|-----------------|------|
| ABS Building Approvals (BA_SA2 SDMX dataflow) | data.api.abs.gov.au/rest/data/ABS,BA_SA2 | New residential dwelling units approved, by SA3 / state / national, houses vs townhouses vs apartments, monthly from Jul 2021; also value ($) | Monthly | No |
| ABS ERP (ERP_ASGS2021 SDMX) | data.api.abs.gov.au/rest/data/ERP_ASGS2021 | Resident population by SA3 — the per-capita denominator | Annual | No |
| ABS ASGS 2021 SA3 boundaries | geo.abs.gov.au ArcGIS | Real polygons for the map | Static | No |

## Key Features
1. **Accord tracker** — national monthly new-dwelling approvals stacked houses vs apartments, against the ~20,000/month the 1.2M target implies, annotated with the rate-hike cycle and the Accord start.
2. **Map** — SA3 choropleth: approvals per 10,000 residents, total, house share, growth (diverging), value.
3. **Rankings** — leaderboard by supply intensity, volume, house share, apartment share, growth.
4. **Trajectory** — each region's current approval rate against its multi-year change; separates a region that always builds a lot from one ramping up or collapsing.
5. **Density** — the houses-vs-apartments story: national composition over time + where apartments actually get approved.
6. **States** — state comparison and a state × building-type matrix.
7. **Explorer** — searchable SA3 table with rolling-12-month sparklines.
8. **Distribution** + **Insights** — histogram with click-through, auto-detected findings.
9. Per-region **drill-down** with monthly history, house/apartment mix, value and rank (hash-linkable).

## Style Direction
**Tone:** civic / practical. **Palette:** warm architectural — houses in terracotta/amber (`--house`), apartments/other in steel-blue (`--apartment`), deep slate-blue accent. Light theme. Balanced density. Reference feel: a clean government housing portal crossed with the fleet's au-insolvency.

## Technical Architecture
- **Stack:** Vanilla TypeScript + Vite (matches the SA3-grain fleet template).
- **Data strategy:** pipeline. **Cron: monthly** — ABS releases Building Approvals monthly (proportional cadence, monthly is the fastest allowed).
- **Key libraries:** Leaflet (map). Everything else is hand-rolled SVG from `patterns/`/`charts.ts`.

## Layout
Fixed sticky header (title + nav tabs), max-width 1600px content, sticky footer with attribution + feedback. Panels stack below 768px; charts live in `overflow-x:auto` scrollers; map 640px.

## Visualization Strategy (≥5 views)
- **Accord line/stack + benchmark** — answers "is the country building enough, and is the mix shifting to apartments?"
- **Choropleth map** — "where are homes being approved, per resident?"
- **Trajectory scatter (zoom/pan)** — "who's ramping up vs collapsing?" (a league table can't show this).
- **Density composition + apartment-hotspot scatter** — "houses or apartments, and where?"
- **State × building-type matrix heatmap** — "which states build which form?"
- **Rankings bars, Explorer table w/ sparklines, Distribution histogram, Insights** — the floor.
Every mark gets a `[data-tip]` hover; dense SVG gets zoom/pan; colour for houses/apartments is identical across every view.
