// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
// Pure histogram binning + bar layout. Kept free of the DOM so the positions can
// be unit-tested (area-only tests pass on visually broken charts).

export interface Bin { x0: number; x1: number; count: number; items: number[] }
export interface BarRect { x: number; y: number; w: number; h: number; bin: Bin }

export function histogram(values: number[], binCount: number, cap?: number): { bins: Bin[]; max: number } {
  const vals = values.filter((v) => Number.isFinite(v));
  if (!vals.length || binCount < 1) return { bins: [], max: 0 };
  const hi = cap ?? Math.max(...vals);
  const lo = Math.min(0, ...vals);
  const span = hi - lo || 1;
  const width = span / binCount;
  const bins: Bin[] = Array.from({ length: binCount }, (_, i) => ({
    x0: lo + i * width,
    x1: lo + (i + 1) * width,
    count: 0,
    items: [],
  }));
  for (const v of vals) {
    let idx = Math.floor((Math.min(v, hi) - lo) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
    bins[idx].items.push(v);
  }
  return { bins, max: Math.max(...bins.map((b) => b.count)) };
}

/**
 * Lay bins out as flush, non-overlapping bars inside the plot box
 * [padL, width-padR] × [padT, height-padB]. Every bar shares the baseline and
 * its height is proportional to the bin count.
 */
export function histogramLayout(
  bins: Bin[],
  max: number,
  opts: { width: number; height: number; padL: number; padR: number; padT: number; padB: number },
): BarRect[] {
  const { width, height, padL, padR, padT, padB } = opts;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const baseY = padT + plotH;
  const bw = plotW / Math.max(1, bins.length);
  return bins.map((b, i) => {
    const h = max > 0 ? (b.count / max) * plotH : 0;
    return { x: padL + i * bw, y: baseY - h, w: bw, h, bin: b };
  });
}
