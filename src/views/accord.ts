import type { Dataset, StateSeries } from '../types';
import { abbr, esc, num, pct, tip } from '../format';
import { gloss } from '../glossary';
import { ticks } from '../charts';

type Mode = 'monthly' | 'rolling';
type Scope = 'AUS' | string; // 'AUS' or a state code

let mode: Mode = 'rolling';
let scope: Scope = 'AUS';

interface Bands { house: number[]; town: number[]; apt: number[]; other: number[]; tot: number[] }

function rolling12(s: number[]): number[] {
  const out = new Array(s.length).fill(0);
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    sum += s[i];
    if (i >= 12) sum -= s[i - 12];
    out[i] = i >= 11 ? sum : NaN; // NaN before the window fills -> gap
  }
  return out;
}

function bandsFor(data: Dataset): { bands: Bands; label: string } {
  const src =
    scope === 'AUS'
      ? { ...data.national.aus, state: 'Australia' }
      : (data.national.states.find((s) => s.code === scope) as StateSeries);
  const tot = src.tot;
  const house = src.house;
  const town = src.town;
  const apt = src.apt;
  const other = tot.map((t, i) => Math.max(0, t - (house[i] ?? 0) - (town[i] ?? 0) - (apt[i] ?? 0)));
  const raw: Bands = { house, town, apt, other, tot };
  if (mode === 'monthly') return { bands: raw, label: scope === 'AUS' ? 'Australia' : ((src as StateSeries).state) };
  return {
    bands: {
      house: rolling12(house),
      town: rolling12(town),
      apt: rolling12(apt),
      other: rolling12(other),
      tot: rolling12(tot),
    },
    label: scope === 'AUS' ? 'Australia' : (src as StateSeries).state,
  };
}

function chart(data: Dataset, bands: Bands): string {
  const meta = data.meta;
  const labels = meta.monthLabels;
  const n = labels.length;
  const width = 960;
  const height = 400;
  const padL = 52;
  const padR = 14;
  const padT = 16;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const target = scope === 'AUS' ? (mode === 'monthly' ? meta.accordMonthlyTarget : meta.accordMonthlyTarget * 12) : null;
  const seriesMax = Math.max(...bands.tot.filter((v) => Number.isFinite(v)), target ?? 0, 1);
  const tk = ticks(seriesMax, 5);
  const max = tk[tk.length - 1];

  // In rolling mode the first 11 months are gaps (the window has not filled), so
  // start the plot at the first month with data instead of leaving dead space.
  const s = Math.max(0, bands.tot.findIndex((v) => Number.isFinite(v)));
  const x = (i: number) => padL + ((i - s) / Math.max(1, n - 1 - s)) * plotW;
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const grid = tk
    .map(
      (t) =>
        `<line class="grid-line" x1="${padL}" y1="${y(t)}" x2="${width - padR}" y2="${y(t)}"/>
         <text class="axis-text" x="${padL - 6}" y="${y(t)}" text-anchor="end" dominant-baseline="middle">${t >= 1000 ? `${(t / 1000).toFixed(0)}k` : t}</text>`,
    )
    .join('');

  // Stacked bands bottom-up: houses, townhouses, apartments, other.
  const order: { key: keyof Bands; colour: string; label: string }[] = [
    { key: 'house', colour: 'var(--house)', label: 'Houses' },
    { key: 'town', colour: 'var(--townhouse)', label: 'Townhouses' },
    { key: 'apt', colour: 'var(--apartment)', label: 'Apartments' },
    { key: 'other', colour: '#b7b1a6', label: 'Other' },
  ];
  const cum = new Array(n).fill(0);
  const bandPaths = order
    .map(({ key, colour }) => {
      const top: string[] = [];
      const bottom: string[] = [];
      let any = false;
      for (let i = 0; i < n; i++) {
        const v = bands[key][i];
        if (!Number.isFinite(v)) { // gap: close current path segment
          continue;
        }
        any = true;
        const y0 = cum[i];
        const y1 = y0 + v;
        top.push(`${x(i).toFixed(1)} ${y(y1).toFixed(1)}`);
        bottom.push(`${x(i).toFixed(1)} ${y(y0).toFixed(1)}`);
        cum[i] = y1;
      }
      if (!any) return '';
      const d = `M${top.join('L')}L${bottom.reverse().join('L')}Z`;
      return `<path d="${d}" fill="${colour}" fill-opacity="0.92" stroke="none"/>`;
    })
    .join('');

  // Benchmark line + label.
  const benchmark = target
    ? `<line x1="${padL}" y1="${y(target)}" x2="${width - padR}" y2="${y(target)}"
         stroke="var(--status-bad)" stroke-width="1.6" stroke-dasharray="6 4"/>
       <text class="axis-text" x="${width - padR}" y="${y(target) - 5}" text-anchor="end"
         style="fill:var(--status-bad);font-weight:600">Accord pace ≈ ${target >= 1000 ? `${(target / 1000).toFixed(0)}k` : target}/${mode === 'monthly' ? 'mo' : 'yr'}</text>`
    : '';

  // Annotations.
  const notes = meta.annotations
    .map((a, i) => {
      const idx = meta.months.indexOf(a.month);
      if (idx < s) return '';
      const flip = x(idx) + 8 * a.text.length > width - padR;
      const labelY = padT + 12 + (i % 2) * 14;
      return `<line x1="${x(idx)}" y1="${padT}" x2="${x(idx)}" y2="${padT + plotH}" stroke="var(--text-primary)" stroke-width="1" stroke-dasharray="3 3" opacity=".4"/>
        <text class="axis-text" x="${x(idx) + (flip ? -4 : 4)}" y="${labelY}" text-anchor="${flip ? 'end' : 'start'}" style="fill:var(--text-secondary)">${esc(a.text)}</text>`;
    })
    .join('');

  const step = Math.max(1, Math.round((n - s) / 10));
  const xLabels = labels
    .map((l, i) => (i >= s && (i - s) % step === 0 ? `<text class="axis-text" x="${x(i)}" y="${height - 8}" text-anchor="middle">${esc(l)}</text>` : ''))
    .join('');

  // Hover columns.
  const hover = labels
    .map((l, i) => {
      const bw = plotW / Math.max(1, n - 1);
      if (!Number.isFinite(bands.tot[i])) return '';
      const parts = order
        .map((o) => `${o.label}: ${num(bands[o.key][i])}`)
        .filter((_, k) => Number.isFinite(bands[order[k].key][i]))
        .reverse()
        .join('\n');
      const tt = `${l}\nTotal: ${num(bands.tot[i])}${target ? `\nAccord pace: ${num(target)}` : ''}\n${parts}`;
      return `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${padT}" width="${bw.toFixed(1)}" height="${plotH}" fill="transparent" data-tip="${tip(tt)}"/>`;
    })
    .join('');

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Approvals over time">
    ${grid}${bandPaths}${benchmark}${notes}
    <line class="axis-line" x1="${padL}" y1="${padT + plotH}" x2="${width - padR}" y2="${padT + plotH}"/>
    ${xLabels}${hover}
  </svg>`;
}

export function renderAccord(root: HTMLElement, data: Dataset): void {
  const meta = data.meta;
  const n = meta.national;
  const paceShare = n.tot12 / n.accordAnnual;
  const houseShare = n.house12 / n.tot12;

  root.innerHTML = `
    <div class="view-head">
      <h2>Is Australia approving enough homes?</h2>
      <p>New residential ${gloss('dwelling unit', 'dwellings')} approved each month, stacked by type, against the pace the ${gloss('housing accord', '1.2-million-homes target')} implies. Approvals are the leading edge of supply — they ${gloss('commencement', 'come before homes are built')}, so they need to run above the line, not on it.</p>
    </div>

    <div class="stat-row">
      <div class="stat"><div class="stat-label">Approved, last 12 months</div><div class="stat-value">${num(n.tot12)}</div><div class="stat-note">new homes nationally</div></div>
      <div class="stat"><div class="stat-label">Share of Accord pace</div><div class="stat-value" style="color:${paceShare >= 1 ? 'var(--status-good)' : 'var(--status-warn)'}">${pct(paceShare, 0)}</div><div class="stat-note">of ${num(n.accordAnnual)}/yr implied</div></div>
      <div class="stat"><div class="stat-label">Detached houses</div><div class="stat-value" style="color:var(--house)">${pct(houseShare, 0)}</div><div class="stat-note">rest townhouses &amp; apartments</div></div>
      <div class="stat"><div class="stat-label">Rolling-12 peak</div><div class="stat-value">${num(n.peak12)}</div><div class="stat-note">reached ${esc(n.peak12Month)}</div></div>
    </div>

    <div class="controls">
      <span class="control-label">Measure</span>
      <div class="seg" role="group" aria-label="Measure">
        <button data-mode="rolling" aria-pressed="${mode === 'rolling'}">Rolling 12-month</button>
        <button data-mode="monthly" aria-pressed="${mode === 'monthly'}">Monthly</button>
      </div>
      <span class="control-label">Region</span>
      <div class="seg" role="group" aria-label="Region scope">
        <button data-scope="AUS" aria-pressed="${scope === 'AUS'}">Australia</button>
        ${data.national.states
          .filter((s) => s.tot.reduce((a, b) => a + b, 0) > 2000)
          .map((s) => `<button data-scope="${s.code}" aria-pressed="${scope === s.code}">${esc(abbr(s.state))}</button>`)
          .join('')}
      </div>
    </div>

    <div class="panel">
      <div class="chart-wrap scroll-x" id="accord-chart"></div>
      <div class="legend">
        <span class="legend-item"><span class="legend-swatch" style="background:var(--house)"></span>Houses</span>
        <span class="legend-item"><span class="legend-swatch" style="background:var(--townhouse)"></span>Townhouses</span>
        <span class="legend-item"><span class="legend-swatch" style="background:var(--apartment)"></span>Apartments</span>
        <span class="legend-item"><span class="legend-swatch" style="background:#b7b1a6"></span>Other</span>
        <span class="legend-item"><span class="legend-swatch" style="background:var(--status-bad)"></span>Accord pace (national only)</span>
      </div>
      <p class="mini-note" id="accord-note"></p>
    </div>
  `;

  const draw = () => {
    const { bands, label } = bandsFor(data);
    root.querySelector<HTMLElement>('#accord-chart')!.innerHTML = chart(data, bands);
    const scopeNote =
      scope === 'AUS'
        ? 'The dashed line is the ≈20,000-a-month (240,000-a-year) completions pace the 1.2-million target implies. Approvals sitting below it is an early warning; sitting above it is necessary but not sufficient, because some approvals are never built.'
        : `Showing ${esc(label)}. The Accord target is national, so no benchmark line is drawn for a single state.`;
    root.querySelector<HTMLElement>('#accord-note')!.innerHTML = scopeNote;
  };

  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode as Mode;
      root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.mode === mode)));
      draw();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach((b) =>
    b.addEventListener('click', () => {
      scope = b.dataset.scope!;
      root.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.scope === scope)));
      draw();
    }),
  );

  draw();
}
