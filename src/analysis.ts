// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Auto-detected findings. Pure functions over the dataset — no DOM — so they are
// unit-testable and the Insights view is just a renderer.

import type { Dataset, Region } from './types';
import { abbr, num, pct, rate, delta, money } from './format';

export interface Insight {
  severity: 'info' | 'warn' | 'alert' | 'good';
  title: string;
  body: string;
  region?: string; // code, for a drill-down link
  filter?: string; // explorer query, for a click-through
}

const MIN = 200; // ignore tiny regions when hunting for superlatives

export function computeInsights(data: Dataset): Insight[] {
  const out: Insight[] = [];
  const { regions, meta } = data;
  const n = meta.national;
  const big = regions.filter((r) => r.total12 >= MIN);

  // National pace against the Accord benchmark.
  const paceShare = n.tot12 / n.accordAnnual;
  out.push({
    severity: paceShare >= 1 ? 'good' : 'warn',
    title: `Approvals are running at ${pct(paceShare, 0)} of the 1.2-million pace`,
    body: `Australia approved ${num(n.tot12)} new homes over the last 12 months. The National Housing Accord implies about ${num(n.accordAnnual)} a year of completions — and because not every approval is built, approvals need to sit above that line, not below it. The current mix is ${pct(n.house12 / n.tot12, 0)} detached houses.`,
  });

  // Recovery vs the peak.
  const peakShare = n.tot12 / n.peak12;
  out.push({
    severity: peakShare >= 0.97 ? 'good' : 'info',
    title:
      peakShare >= 0.97
        ? `Approvals have climbed back to their ${meta.national.peak12Month} peak`
        : `Approvals sit ${pct(1 - peakShare, 0)} below the ${meta.national.peak12Month} peak`,
    body: `The rolling twelve-month total peaked at ${num(n.peak12)} in ${n.peak12Month}. It now stands at ${num(n.tot12)}.`,
  });

  // Top growth corridor by volume.
  const topVol = [...regions].sort((a, b) => b.total12 - a.total12)[0];
  if (topVol) {
    out.push({
      severity: 'info',
      title: `${topVol.name} approves the most new homes in the country`,
      body: `${num(topVol.total12)} dwellings in the last 12 months (${pct(topVol.houseShare, 0)} detached houses) — the single busiest ${'SA3'} region, in ${abbr(topVol.state)}.`,
      region: topVol.code,
    });
  }

  // Highest supply intensity per resident.
  const topRate = big.filter((r) => r.rate !== null).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0];
  if (topRate) {
    out.push({
      severity: 'good',
      title: `${topRate.name} builds fastest relative to its size`,
      body: `${rate(topRate.rate)} new dwellings approved per 10,000 residents a year — ${((topRate.rate ?? 0) / (meta.medians.rate || 1)).toFixed(1)}× the national median of ${rate(meta.medians.rate)}.`,
      region: topRate.code,
    });
  }

  // Most apartment-dominated region.
  const apt = big
    .filter((r) => r.houseShare !== null)
    .sort((a, b) => (a.houseShare ?? 1) - (b.houseShare ?? 1))[0];
  if (apt) {
    out.push({
      severity: 'info',
      title: `${apt.name} is almost all apartments and townhouses`,
      body: `Just ${pct(apt.houseShare, 0)} of its ${num(apt.total12)} approved homes are detached houses — the rest are higher-density dwellings. Inner-city infill looks nothing like the growth corridors.`,
      region: apt.code,
    });
  }

  // Biggest 12-month surge.
  const surge = big
    .filter((r) => r.change !== null && r.prev12 >= MIN)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
  if (surge && (surge.change ?? 0) > 0.4) {
    out.push({
      severity: 'good',
      title: `${surge.name} approvals jumped ${delta(surge.change)} in a year`,
      body: `Up from ${num(surge.prev12)} to ${num(surge.total12)} new homes year on year — one of the sharpest accelerations in the country.`,
      region: surge.code,
    });
  }

  // Biggest 12-month collapse.
  const slump = big
    .filter((r) => r.change !== null && r.prev12 >= MIN)
    .sort((a, b) => (a.change ?? 0) - (b.change ?? 0))[0];
  if (slump && (slump.change ?? 0) < -0.3) {
    out.push({
      severity: 'alert',
      title: `${slump.name} approvals fell ${delta(slump.change)} in a year`,
      body: `Down from ${num(slump.prev12)} to ${num(slump.total12)} new homes — a sharp pull-back in a single region.`,
      region: slump.code,
    });
  }

  // Value leader.
  const val = [...regions].sort((a, b) => b.value12 - a.value12)[0];
  if (val) {
    out.push({
      severity: 'info',
      title: `${val.name} leads on the value of building approved`,
      body: `About ${money(val.value12)} of residential building work approved in the last 12 months across ${num(val.total12)} dwellings.`,
      region: val.code,
    });
  }

  // Concentration: how much of national supply the top regions carry.
  const sorted = [...regions].sort((a, b) => b.total12 - a.total12);
  const natTot = regions.reduce((a, r) => a + r.total12, 0);
  let acc = 0;
  let k = 0;
  while (k < sorted.length && acc < natTot * 0.25) { acc += sorted[k].total12; k++; }
  out.push({
    severity: 'info',
    title: `A quarter of all new homes are approved in just ${k} regions`,
    body: `Of ${num(regions.length)} SA3 regions, the busiest ${k} account for 25% of every dwelling approved nationally — housing supply is highly concentrated in a handful of growth corridors.`,
  });

  return out;
}

/** Median helper reused by views. */
export function median(nums: (number | null)[]): number {
  const a = nums.filter((x): x is number => x !== null && Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Non-house (townhouse + apartment) share of a region. */
export function nonHouseShare(r: Region): number | null {
  return r.total12 > 0 ? r.nonHouse12 / r.total12 : null;
}
