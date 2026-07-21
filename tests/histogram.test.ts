import { describe, expect, it } from 'vitest';
import { histogram, histogramLayout, type BarRect } from '../src/utils/histogram';

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('histogram', () => {
  it('bins values into the requested number of buckets', () => {
    const { bins, max } = histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5);
    expect(bins.length).toBe(5);
    expect(bins.reduce((a, b) => a + b.count, 0)).toBe(10);
    expect(max).toBe(bins.reduce((m, b) => Math.max(m, b.count), 0));
  });
  it('caps values into the last bin', () => {
    const { bins } = histogram([0, 5, 500], 5, 10);
    // 500 is capped to <=10 so it lands in the final bin, never out of range.
    expect(bins.every((b) => b.count >= 0)).toBe(true);
    expect(bins[bins.length - 1].count).toBeGreaterThanOrEqual(1);
  });
  it('returns empty for no data', () => {
    expect(histogram([], 5).bins).toEqual([]);
  });
  it('every value lands in exactly one bin', () => {
    const rnd = mulberry32(7);
    const vals = Array.from({ length: 300 }, () => rnd() * 240);
    const { bins } = histogram(vals, 26, 250);
    expect(bins.reduce((a, b) => a + b.count, 0)).toBe(300);
  });
});

function overlap(a: BarRect, b: BarRect): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}

describe('histogramLayout positions', () => {
  const rnd = mulberry32(99);
  const vals = Array.from({ length: 337 }, () => rnd() * 250);
  const { bins, max } = histogram(vals, 26, 250);
  const box = { width: 900, height: 380, padL: 44, padR: 16, padT: 16, padB: 44 };
  const rects = histogramLayout(bins, max, box);

  it('produces one rect per bin', () => {
    expect(rects.length).toBe(bins.length);
  });
  it('keeps every bar inside the plot box', () => {
    const baseY = box.padT + (box.height - box.padT - box.padB);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(box.padL - 1e-6);
      expect(r.x + r.w).toBeLessThanOrEqual(box.width - box.padR + 1e-6);
      expect(r.y).toBeGreaterThanOrEqual(box.padT - 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(baseY + 1e-6);
      expect(Number.isFinite(r.x + r.y + r.w + r.h)).toBe(true);
    }
  });
  it('has no pairwise overlap beyond a hairline', () => {
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        expect(overlap(rects[i], rects[j])).toBeLessThan(0.5);
  });
  it('bars are flush — widths tile the plot width exactly', () => {
    const plotW = box.width - box.padL - box.padR;
    const sum = rects.reduce((a, r) => a + r.w, 0);
    expect(sum).toBeCloseTo(plotW, 6);
    for (let i = 1; i < rects.length; i++) expect(rects[i].x).toBeCloseTo(rects[i - 1].x + rects[i - 1].w, 6);
  });
  it('bar height is proportional to count (tallest == max)', () => {
    const plotH = box.height - box.padT - box.padB;
    const tallest = rects.find((r) => r.bin.count === max)!;
    expect(tallest.h).toBeCloseTo(plotH, 6);
  });
});
