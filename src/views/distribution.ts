// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { Dataset } from '../types';
import { esc, num, rate, tip } from '../format';
import { navigate } from '../main';
import { gloss } from '../glossary';
import { histogram, histogramLayout } from '../utils/histogram';

type MetricId = 'rate' | 'houseShare';
const METRICS: { id: MetricId; label: string; unit: string; cap: number; bins: number; get: (r: any) => number | null; fmt: (v: number) => string }[] = [
  { id: 'rate', label: 'Supply intensity (per 10,000 residents)', unit: ' /10k', cap: 250, bins: 26, get: (r) => r.rate, fmt: (v) => rate(v) },
  { id: 'houseShare', label: 'Detached-house share', unit: '', cap: 1, bins: 20, get: (r) => (r.total12 >= 100 ? r.houseShare : null), fmt: (v) => `${Math.round(v * 100)}%` },
];
let metricId: MetricId = 'rate';

export function renderDistribution(root: HTMLElement, data: Dataset): void {
  const draw = () => {
    const m = METRICS.find((x) => x.id === metricId)!;
    const rows = data.regions.map(m.get).filter((v): v is number => v !== null && Number.isFinite(v));
    const { bins, max } = histogram(rows, m.bins, m.cap);

    const W = 900;
    const H = 380;
    const pad = { padL: 44, padR: 16, padT: 16, padB: 44 };
    const rects = histogramLayout(bins, max, { width: W, height: H, ...pad });
    const median = [...rows].sort((a, b) => a - b)[Math.floor(rows.length / 2)];

    const bars = rects
      .map((r) => {
        const lo = m.fmt(r.bin.x0);
        const hi = m.fmt(r.bin.x1);
        const tt = `${lo} – ${hi}${m.unit}\n${r.bin.count} region${r.bin.count === 1 ? '' : 's'}`;
        return `<rect class="bar" x="${(r.x + 1).toFixed(1)}" y="${r.y.toFixed(1)}" width="${Math.max(0, r.w - 2).toFixed(1)}" height="${r.h.toFixed(1)}" rx="2"
          fill="var(--sev-4)" data-lo="${r.bin.x0}" data-hi="${r.bin.x1}" style="cursor:pointer"
          data-tip="${tip(tt)}" aria-label="${esc(lo)} to ${esc(hi)}: ${r.bin.count}"/>`;
      })
      .join('');

    const yTicks = [0, Math.ceil(max / 2), max];
    const baseY = H - pad.padB;
    const plotH = H - pad.padT - pad.padB;
    const yAxis = yTicks
      .map((t) => {
        const y = baseY - (max > 0 ? (t / max) * plotH : 0);
        return `<line class="grid-line" x1="${pad.padL}" y1="${y}" x2="${W - pad.padR}" y2="${y}"/><text class="axis-text" x="${pad.padL - 6}" y="${y + 3}" text-anchor="end">${t}</text>`;
      })
      .join('');
    const plotW = W - pad.padL - pad.padR;
    const xStep = Math.max(1, Math.round(bins.length / 8));
    const xAxis = bins
      .map((b, i) => (i % xStep === 0 ? `<text class="axis-text" x="${pad.padL + (i / bins.length) * plotW}" y="${H - 24}" text-anchor="middle">${esc(m.fmt(b.x0))}</text>` : ''))
      .join('');
    // median marker
    const medX = pad.padL + (Math.min(median, m.cap) / m.cap) * plotW;
    const medLine = `<line x1="${medX}" y1="${pad.padT}" x2="${medX}" y2="${baseY}" stroke="var(--accent-primary)" stroke-dasharray="4 3"/>
      <text class="axis-text" x="${medX + 4}" y="${pad.padT + 10}" style="fill:var(--accent-primary);font-weight:600">median ${esc(m.fmt(median))}</text>`;

    root.querySelector<HTMLElement>('#dist-chart')!.innerHTML = `
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribution histogram">
        ${yAxis}${bars}${medLine}
        <line class="axis-line" x1="${pad.padL}" y1="${baseY}" x2="${W - pad.padR}" y2="${baseY}"/>
        ${xAxis}
        <text class="axis-title" x="${pad.padL + plotW / 2}" y="${H - 4}" text-anchor="middle">${esc(m.label)}</text>
      </svg>`;

    root.querySelectorAll<SVGRectElement>('#dist-chart rect.bar').forEach((rect) =>
      rect.addEventListener('click', () => {
        // Click-through: send the user to the Explorer. The rate range is not a
        // text filter, so we just open the Explorer sorted view.
        navigate({ view: 'explorer' as any, filter: undefined });
      }),
    );
  };

  root.innerHTML = `
    <div class="view-head">
      <h2>How regions are distributed</h2>
      <p>Most of Australia clusters at a modest ${gloss('per 10,000 residents', 'supply intensity')}, with a long tail of booming growth corridors far to the right. Switch to house share to see how sharply regions split between detached-house suburbs and apartment districts.</p>
    </div>
    <div class="controls">
      <div class="seg" role="group" aria-label="Distribution metric">
        ${METRICS.map((m) => `<button data-metric="${m.id}" aria-pressed="${m.id === metricId}">${esc(m.label)}</button>`).join('')}
      </div>
    </div>
    <div class="panel chart-wrap" id="dist-chart"></div>
    <p class="mini-note">Each bar counts regions whose value falls in that range (values above the cap are grouped into the last bar). Click a bar to open the Explorer. ${num(data.regions.length)} regions total.</p>
  `;

  root.querySelectorAll<HTMLButtonElement>('[data-metric]').forEach((b) =>
    b.addEventListener('click', () => {
      metricId = b.dataset.metric as MetricId;
      root.querySelectorAll<HTMLButtonElement>('[data-metric]').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.metric === metricId)));
      draw();
    }),
  );

  draw();
}
