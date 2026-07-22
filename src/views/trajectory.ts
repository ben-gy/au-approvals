// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { Dataset, Region } from '../types';
import { abbr, esc, num, rate, delta, tip, stateColour } from '../format';
import { openRegion } from '../main';
import { gloss } from '../glossary';
import { attachSvgZoom } from '../utils/svgZoom';

export function renderTrajectory(root: HTMLElement, data: Dataset): void {
  const pts = data.regions.filter((r) => r.rate !== null && r.changeLong !== null && r.total12 >= 100);
  const medRate = data.meta.medians.rate;
  const medChange = data.meta.medians.changeLong;

  const W = 960;
  const H = 560;
  const padL = 56;
  const padR = 20;
  const padT = 20;
  const padB = 48;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // x: supply intensity on a log scale (right-skewed). y: 3-year change, clamped.
  const xMin = 5;
  const xMax = Math.max(...pts.map((r) => r.rate as number), 100);
  const lx = (v: number) => Math.log10(Math.max(xMin, Math.min(xMax, v)));
  const x = (v: number) => padL + ((lx(v) - lx(xMin)) / (lx(xMax) - lx(xMin))) * plotW;
  const yLo = -0.6;
  const yHi = 1.5;
  const yc = (v: number) => padT + plotH - ((Math.max(yLo, Math.min(yHi, v)) - yLo) / (yHi - yLo)) * plotH;

  const xTicks = [10, 25, 50, 100, 200, 400].filter((t) => t >= xMin && t <= xMax * 1.05);
  const yTicks = [-0.5, 0, 0.5, 1, 1.5];

  const grid = `
    ${xTicks.map((t) => `<line class="grid-line" x1="${x(t)}" y1="${padT}" x2="${x(t)}" y2="${padT + plotH}"/>
      <text class="axis-text" x="${x(t)}" y="${H - padB + 16}" text-anchor="middle">${t}</text>`).join('')}
    ${yTicks.map((t) => `<line class="grid-line" x1="${padL}" y1="${yc(t)}" x2="${padL + plotW}" y2="${yc(t)}"/>
      <text class="axis-text" x="${padL - 8}" y="${yc(t) + 3}" text-anchor="end">${delta(t)}</text>`).join('')}
    <line x1="${x(medRate)}" y1="${padT}" x2="${x(medRate)}" y2="${padT + plotH}" stroke="var(--text-tertiary)" stroke-dasharray="4 3" opacity=".7"/>
    <line x1="${padL}" y1="${yc(medChange)}" x2="${padL + plotW}" y2="${yc(medChange)}" stroke="var(--text-tertiary)" stroke-dasharray="4 3" opacity=".7"/>
  `;

  const quad = (qx: number, qy: number, anchor: string, t1: string, t2: string) =>
    `<text x="${qx}" y="${qy}" text-anchor="${anchor}" style="fill:var(--text-tertiary);font-size:11px;font-weight:600">${esc(t1)}</text>
     <text x="${qx}" y="${qy + 13}" text-anchor="${anchor}" style="fill:var(--text-muted);font-size:10px">${esc(t2)}</text>`;
  const quads = `
    ${quad(padL + plotW - 4, padT + 14, 'end', 'Building a lot, ramping up', 'high supply · rising')}
    ${quad(padL + 4, padT + 14, 'start', 'Ramping up from a low base', 'low supply · rising')}
    ${quad(padL + plotW - 4, padT + plotH - 8, 'end', 'Building a lot but slowing', 'high supply · falling')}
    ${quad(padL + 4, padT + plotH - 8, 'start', 'Low and falling', 'low supply · falling')}
  `;

  const rMax = Math.max(...pts.map((r) => r.total12));
  const rad = (r: Region) => 3 + Math.sqrt(r.total12 / rMax) * 12;

  const dots = pts
    .map((r) => {
      const tt = `${r.name} (${abbr(r.state)})\nPer 10,000 residents: ${rate(r.rate)}\n3-year change: ${delta(r.changeLong)}\n${num(r.total12)} homes/yr`;
      return `<circle class="dot" cx="${x(r.rate as number).toFixed(1)}" cy="${yc(r.changeLong as number).toFixed(1)}" r="${rad(r).toFixed(1)}"
        fill="${stateColour(r.state)}" fill-opacity="0.62" stroke="${stateColour(r.state)}" stroke-width="1"
        data-code="${esc(r.code)}" data-tip="${tip(tt)}" aria-label="${esc(r.name)}"/>`;
    })
    .join('');

  // Label the dozen biggest so the chart has anchors without collision soup.
  const labels = [...pts]
    .sort((a, b) => b.total12 - a.total12)
    .slice(0, 12)
    .map((r) => {
      const px = x(r.rate as number);
      const py = yc(r.changeLong as number);
      const flip = px > padL + plotW * 0.72;
      return `<text x="${(px + (flip ? -rad(r) - 3 : rad(r) + 3)).toFixed(1)}" y="${(py + 3).toFixed(1)}" text-anchor="${flip ? 'end' : 'start'}"
        style="fill:var(--text-secondary);font-size:10px;pointer-events:none">${esc(r.name)}</text>`;
    })
    .join('');

  root.innerHTML = `
    <div class="view-head">
      <h2>Ramping up or winding down?</h2>
      <p>Each region's current ${gloss('per 10,000 residents', 'supply intensity')} (across) against its three-year change (up the side). A league table can't tell a region that has always built a lot from one that is accelerating — this can. Dot size is total homes approved. Dashed lines are the national medians. Scroll to zoom, drag to pan, click a dot for detail.</p>
    </div>
    <div class="panel chart-wrap">
      <svg class="chart" id="traj-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trajectory scatter" style="max-height:72vh">
        ${grid}${quads}
        <text class="axis-title" x="${padL + plotW / 2}" y="${H - 6}" text-anchor="middle">New homes approved per 10,000 residents (log scale) →</text>
        <text class="axis-title" transform="translate(16 ${padT + plotH / 2}) rotate(-90)" text-anchor="middle">3-year change in approvals →</text>
        ${dots}${labels}
      </svg>
    </div>
  `;

  const svg = root.querySelector<SVGSVGElement>('#traj-svg')!;
  attachSvgZoom(svg, { maxScale: 12 });
  svg.querySelectorAll<SVGCircleElement>('circle.dot').forEach((c) =>
    c.addEventListener('click', () => openRegion(c.dataset.code!)),
  );
}
