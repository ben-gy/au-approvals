// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { Dataset, Region } from './types';
import { abbr, esc, num, rate, pct, delta, money, tip, stateColour } from './format';
import { gloss } from './glossary';

/** Small stacked monthly bar chart: houses (warm) below, non-house (cool) above. */
function monthlyBars(r: Region, labels: string[]): string {
  const w = 512;
  const h = 150;
  const padL = 30;
  const padB = 18;
  const padT = 8;
  const n = r.mTot.length;
  const max = Math.max(...r.mTot, 1);
  const plotW = w - padL - 6;
  const plotH = h - padT - padB;
  const bw = plotW / n;
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const bars = r.mTot
    .map((totv, i) => {
      const hou = r.mHouse[i] ?? 0;
      const non = Math.max(0, totv - hou);
      const x = padL + i * bw;
      const bwi = Math.max(0.8, bw - 0.6);
      const yHouseTop = y(hou);
      const yNonTop = y(totv);
      const tipTxt = `${labels[i]}\nTotal ${num(totv)} homes\nHouses ${num(hou)} · other ${num(non)}`;
      const houseRect = hou > 0
        ? `<rect x="${x.toFixed(1)}" y="${yHouseTop.toFixed(1)}" width="${bwi.toFixed(1)}" height="${(padT + plotH - yHouseTop).toFixed(1)}" fill="var(--house)"/>`
        : '';
      const nonRect = non > 0
        ? `<rect x="${x.toFixed(1)}" y="${yNonTop.toFixed(1)}" width="${bwi.toFixed(1)}" height="${(yHouseTop - yNonTop).toFixed(1)}" fill="var(--apartment)"/>`
        : '';
      return `<g data-tip="${tip(tipTxt)}">${houseRect}${nonRect}<rect x="${x.toFixed(1)}" y="${padT}" width="${bwi.toFixed(1)}" height="${plotH}" fill="transparent"/></g>`;
    })
    .join('');

  const ticks = [0, max / 2, max].map(
    (v) => `<text class="axis-text" x="${padL - 4}" y="${y(v) + 3}" text-anchor="end">${num(v)}</text>`,
  ).join('');
  const step = Math.max(1, Math.round(n / 6));
  const xlabels = labels
    .map((l, i) => (i % step === 0 ? `<text class="axis-text" x="${padL + i * bw + bw / 2}" y="${h - 5}" text-anchor="middle">${esc(l)}</text>` : ''))
    .join('');

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Monthly approvals">
    ${ticks}${bars}
    <line class="axis-line" x1="${padL}" y1="${padT + plotH}" x2="${w - 6}" y2="${padT + plotH}"/>
    ${xlabels}
  </svg>`;
}

export function renderDrawer(el: HTMLElement, r: Region, data: Dataset): void {
  const { regions, meta } = data;
  const byTotal = [...regions].sort((a, b) => b.total12 - a.total12);
  const rankTotal = byTotal.findIndex((x) => x.code === r.code) + 1;
  const rated = regions.filter((x) => x.rate !== null).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  const rankRate = r.rate !== null ? rated.findIndex((x) => x.code === r.code) + 1 : null;

  const houseShare = r.houseShare ?? 0;
  const nonShare = 1 - houseShare;
  const rateVsMedian = r.rate !== null ? r.rate / (meta.medians.rate || 1) : null;

  el.innerHTML = `
    <button class="icon-btn drawer-close" aria-label="Close detail">✕</button>
    <h2>${esc(r.name)}</h2>
    <p class="sub"><span class="state-pill" style="background:${stateColour(r.state)};color:#fff">${esc(abbr(r.state))}</span>
      &nbsp;${gloss('sa3', 'SA3 region')}${r.pop !== null ? ` · ${num(r.pop)} residents` : ''}</p>

    <dl class="kv">
      <dt>New homes approved (12 mo)</dt><dd>${num(r.total12)}</dd>
      <dt>Rank by volume</dt><dd>#${rankTotal} of ${num(regions.length)}</dd>
      <dt>${gloss('per 10,000 residents', 'Per 10,000 residents')}</dt><dd>${rate(r.rate)}${rankRate ? ` (#${rankRate})` : ''}</dd>
      <dt>vs national median rate</dt><dd>${rateVsMedian ? `${rateVsMedian.toFixed(1)}×` : '—'}</dd>
      <dt>${gloss('house', 'Detached houses')}</dt><dd>${num(r.houses12)} (${pct(houseShare, 0)})</dd>
      <dt>${gloss('non-house', 'Townhouses + apartments')}</dt><dd>${num(r.nonHouse12)} (${pct(nonShare, 0)})</dd>
      <dt>Year-on-year change</dt><dd class="${(r.change ?? 0) >= 0 ? 'up' : 'down'}">${delta(r.change)}</dd>
      <dt>${gloss('value', 'Value approved (12 mo)')}</dt><dd>${money(r.value12)}</dd>
    </dl>

    <h3>The mix</h3>
    <div class="mixbar" style="width:100%;height:14px" role="img" aria-label="House vs non-house mix"
      data-tip="${tip(`Detached houses ${pct(houseShare, 0)} · townhouses & apartments ${pct(nonShare, 0)}`)}">
      <span style="width:${(houseShare * 100).toFixed(1)}%;background:var(--house)"></span>
      <span style="width:${(nonShare * 100).toFixed(1)}%;background:var(--apartment)"></span>
    </div>
    <div class="legend" style="margin-top:6px">
      <span class="legend-item"><span class="legend-swatch" style="background:var(--house)"></span>Houses ${pct(houseShare, 0)}</span>
      <span class="legend-item"><span class="legend-swatch" style="background:var(--apartment)"></span>Townhouses &amp; apartments ${pct(nonShare, 0)}</span>
    </div>

    <h3>Monthly approvals — ${esc(meta.firstMonthLabel)} to ${esc(meta.latestMonthLabel)}</h3>
    <div class="chart-wrap">${monthlyBars(r, meta.monthLabels)}</div>
    <p class="mini-note">Each bar is one month. Warm = detached houses, cool = townhouses &amp; apartments. Hover for exact counts. Single tall bars are usually one big apartment project approved that month.</p>
  `;
}
