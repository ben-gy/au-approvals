import type { Dataset, Region } from '../types';
import { abbr, esc, num, rate, pct, delta, money, tip, stateColour } from '../format';
import { openRegion } from '../main';
import { gloss } from '../glossary';

type MetricId = 'rate' | 'total12' | 'houseShare' | 'nonHouseShare' | 'change' | 'value12';

interface Metric {
  id: MetricId;
  label: string;
  blurb: string;
  value: (r: Region) => number | null;
  fmt: (v: number | null) => string;
  floor?: (r: Region) => boolean;
  diverging?: boolean;
}

const METRICS: Metric[] = [
  { id: 'rate', label: 'Supply intensity', blurb: 'New homes approved per 10,000 residents over the last 12 months — the fairest way to compare a growth corridor with an established suburb.', value: (r) => r.rate, fmt: (v) => rate(v), floor: (r) => r.rate !== null },
  { id: 'total12', label: 'Total new homes', blurb: 'Raw count of dwellings approved in the last 12 months — largely a map of where the big growth corridors are.', value: (r) => r.total12, fmt: (v) => num(v) },
  { id: 'houseShare', label: 'Most detached houses', blurb: 'Detached-house share of approvals — highest in outer-suburban and regional Australia.', value: (r) => r.houseShare, fmt: (v) => pct(v, 0), floor: (r) => r.total12 >= 200 },
  { id: 'nonHouseShare', label: 'Most apartments & townhouses', blurb: 'Share that is NOT a detached house — the density story, highest in inner cities.', value: (r) => (r.total12 > 0 ? r.nonHouse12 / r.total12 : null), fmt: (v) => pct(v, 0), floor: (r) => r.total12 >= 200 },
  { id: 'change', label: 'Fastest growing', blurb: 'Year-on-year change in approvals (regions with at least 100 homes a year earlier). Green rising, red falling.', value: (r) => r.change, fmt: (v) => delta(v), floor: (r) => r.prev12 >= 100 && r.change !== null, diverging: true },
  { id: 'value12', label: 'Value approved', blurb: 'Dollar value of residential building approved in the last 12 months.', value: (r) => r.value12, fmt: (v) => money(v) },
];

let metricId: MetricId = 'rate';
const TOP = 40;

export function renderRankings(root: HTMLElement, data: Dataset): void {
  const metric = METRICS.find((m) => m.id === metricId)!;

  const draw = () => {
    const m = METRICS.find((x) => x.id === metricId)!;
    const pool = data.regions.filter((r) => (m.floor ? m.floor(r) : true) && m.value(r) !== null);
    const sorted = [...pool].sort((a, b) => (m.value(b) as number) - (m.value(a) as number)).slice(0, TOP);
    const maxAbs = Math.max(...sorted.map((r) => Math.abs(m.value(r) as number)), 1e-9);

    const rows = sorted
      .map((r, i) => {
        const v = m.value(r) as number;
        const w = (Math.abs(v) / maxAbs) * 100;
        const barColour = m.diverging ? (v >= 0 ? 'var(--status-good)' : 'var(--status-bad)') : stateColour(r.state);
        const tt = `${r.name} (${abbr(r.state)})\n${m.label}: ${m.fmt(v)}\n${num(r.total12)} homes · ${pct(r.houseShare, 0)} houses`;
        return `<tr class="clickable" data-code="${esc(r.code)}" tabindex="0">
          <td class="rank">${i + 1}</td>
          <td class="region-name">${esc(r.name)}</td>
          <td><span class="state-pill" style="background:${stateColour(r.state)};color:#fff">${esc(abbr(r.state))}</span></td>
          <td style="width:44%">
            <div style="display:flex;align-items:center;gap:8px;min-width:0" data-tip="${tip(tt)}">
              <div style="flex:1 1 auto;min-width:0;background:var(--bg-elevated);border-radius:3px;height:12px;overflow:hidden">
                <div style="width:${w.toFixed(1)}%;height:100%;background:${barColour}"></div>
              </div>
              <span class="num" style="flex:0 0 auto;width:74px;text-align:right">${m.fmt(v)}</span>
            </div>
          </td>
        </tr>`;
      })
      .join('');

    root.querySelector<HTMLElement>('#rank-body')!.innerHTML = rows;
    root.querySelector<HTMLElement>('#rank-blurb')!.textContent = m.blurb;
    root.querySelectorAll<HTMLElement>('#rank-body tr').forEach((tr) => {
      const go = () => openRegion(tr.dataset.code!);
      tr.addEventListener('click', go);
      tr.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') go(); });
    });
  };

  root.innerHTML = `
    <div class="view-head">
      <h2>The leaderboard</h2>
      <p>Australia's ${gloss('sa3', 'SA3 regions')} ranked. Switch the measure — raw volume flatters big regions, so ${gloss('per 10,000 residents', 'supply per resident')} is the fairer read. Click any region for its full history.</p>
    </div>
    <div class="controls">
      <div class="seg" role="group" aria-label="Ranking measure">
        ${METRICS.map((m) => `<button data-metric="${m.id}" aria-pressed="${m.id === metricId}">${esc(m.label)}</button>`).join('')}
      </div>
    </div>
    <p id="rank-blurb" style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-md)">${esc(metric.blurb)}</p>
    <div class="panel table-scroll">
      <table>
        <thead><tr><th>#</th><th>Region</th><th>State</th><th>Top ${TOP}</th></tr></thead>
        <tbody id="rank-body"></tbody>
      </table>
    </div>
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
