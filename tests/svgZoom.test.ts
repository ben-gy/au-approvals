import { describe, expect, it } from 'vitest';
import { zoomViewBox, clampViewBox, type ViewBox } from '../src/utils/svgZoom';

const base: ViewBox = { x: 0, y: 0, w: 100, h: 100 };

describe('clampViewBox', () => {
  it('keeps a zoomed box inside the base bounds', () => {
    const c = clampViewBox({ x: -20, y: 120, w: 50, h: 50 }, base);
    expect(c.x).toBe(0);
    expect(c.y).toBe(50); // base.y + base.h - h
  });
  it('leaves an in-bounds box untouched', () => {
    expect(clampViewBox({ x: 10, y: 10, w: 50, h: 50 }, base)).toEqual({ x: 10, y: 10, w: 50, h: 50 });
  });
});

describe('zoomViewBox', () => {
  it('zooming in shrinks the viewBox', () => {
    const z = zoomViewBox(base, base, 2, 50, 50);
    expect(z.w).toBeCloseTo(50, 6);
    expect(z.h).toBeCloseTo(50, 6);
  });
  it('respects the max scale', () => {
    const z = zoomViewBox(base, base, 100, 50, 50, 1, 8);
    expect(z.w).toBeCloseTo(100 / 8, 6);
  });
  it('never zooms out past the base (min scale 1)', () => {
    const z = zoomViewBox(base, base, 0.1, 50, 50, 1, 8);
    expect(z.w).toBeLessThanOrEqual(100);
    expect(z.h).toBeLessThanOrEqual(100);
  });
  it('keeps the focus point stationary when zooming', () => {
    const z = zoomViewBox(base, base, 2, 25, 25);
    // focus (25,25) should map to the same relative spot after zoom
    const relXBefore = (25 - base.x) / base.w;
    const relXAfter = (25 - z.x) / z.w;
    expect(relXAfter).toBeCloseTo(relXBefore, 6);
  });
});
