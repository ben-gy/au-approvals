import type { Dataset, Region } from '../types';
import { abbr, esc, num, pct, tip } from '../format';
import { openRegion } from '../main';
import { gloss } from '../glossary';

function rolling12(s: number[]): number[] {
  const out = new Array(s.length).fill(0);
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    sum += s[i];
    if (i >= 12) sum -= s[i - 12];
    out[i] = i >= 11 ? sum : NaN;
  }
  return out;
}

/** 100%-stacked composition area over months (rolling-12 smoothed). */
function compositionChart(data: Dataset): string {
  const meta = data.meta;
  const a = data.national.aus;
  const house = rolling12(a.house);
  const town = rolling12(a.town);
  const apt = rolling12(a.apt);
  const tot = rolling12(a.tot);
  const other = tot.map((t, i) => Math.max(0, t - house[i] - town[i] - apt[i]));
  const labels = meta.monthLabels;
  const n = labels.length;

  const W = 960;
  const H = 320;
  const padL = 40;
  const padR = 14;
  const padT = 12;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  // Skip the leading gap while the rolling-12 window fills.
  const s = Math.max(0, tot.findIndex((v) => Number.isFinite(v)));
  const x = (i: number) => padL + ((i - s) / Math.max(1, n - 1 - s)) * plotW;
  const y = (v: number) => padT + plotH - v * plotH; // v is a share 0..1

  const order = [
    { key: house, colour: 'var(--house)', label: 'Houses' },
    { key: town, colour: 'var(--townhouse)', label: 'Townhouses' },
    { key: apt, colour: 'var(--apartment)', label: 'Apartments' },
    { key: other, colour: '#b7b1a6', label: 'Other' },
  ];
  const share = (arr: number[], i: number) => (Number.isFinite(tot[i]) && tot[i] > 0 ? arr[i] / tot[i] : NaN);

  const cum = new Array(n).fill(0);
  const bands = order
    .map(({ key, colour }) => {
      const top: string[] = [];
      const bottom: string[] = [];
      let any = false;
      for (let i = 0; i < n; i++) {
        const s = share(key, i);
        if (!Number.isFinite(s)) continue;
        any = true;
        const y0 = cum[i];
        const y1 = y0 + s;
        top.push(`${x(i).toFixed(1)} ${y(y1).toFixed(1)}`);
        bottom.push(`${x(i).toFixed(1)} ${y(y0).toFixed(1)}`);
        cum[i] = y1;
      }
      if (!any) return '';
      return `<path d="M${top.join('L')}L${bottom.reverse().join('L')}Z" fill="${colour}" fill-opacity="0.92"/>`;
    })
    .join('');

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const grid = yTicks
    .map((t) => `<text class="axis-text" x="${padL - 6}" y="${y(t) + 3}" text-anchor="end">${pct(t, 0)}</text>`)
    .join('');
  const step = Math.max(1, Math.round((n - s) / 10));
  const xLabels = labels
    .map((l, i) => (i >= s && (i - s) % step === 0 ? `<text class="axis-text" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>` : ''))
    .join('');
  const hover = labels
    .map((l, i) => {
      if (!Number.isFinite(tot[i]) || tot[i] <= 0) return '';
      const bw = plotW / Math.max(1, n - 1);
      const tt = `${l}\nHouses ${pct(share(house, i), 0)}\nTownhouses ${pct(share(town, i), 0)}\nApartments ${pct(share(apt, i), 0)}`;
      return `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${padT}" width="${bw.toFixed(1)}" height="${plotH}" fill="transparent" data-tip="${tip(tt)}"/>`;
    })
    .join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Composition over time">${grid}${bands}${xLabels}${hover}</svg>`;
}

function leaderColumn(title: string, sub: string, list: Region[], value: (r: Region) => number, colour: string): string {
  const max = Math.max(...list.map(value), 1);
  const rows = list
    .map((r, i) => {
      const v = value(r);
      const w = (v / max) * 100;
      const tt = `${r.name} (${abbr(r.state)})\n${num(v)} of ${num(r.total12)} homes\n${pct(r.houseShare, 0)} houses`;
      return `<tr class="clickable" data-code="${esc(r.code)}" tabindex="0">
        <td class="rank">${i + 1}</td>
        <td class="region-name">${esc(r.name)}<div style="font-size:var(--font-size-xs);color:var(--text-tertiary)">${esc(abbr(r.state))}</div></td>
        <td style="width:52%"><div style="display:flex;align-items:center;gap:8px;min-width:0" data-tip="${tip(tt)}">
          <div style="flex:1 1 auto;min-width:0;background:var(--bg-elevated);border-radius:3px;height:12px;overflow:hidden"><div style="width:${w.toFixed(1)}%;height:100%;background:${colour}"></div></div>
          <span class="num" style="flex:0 0 auto;width:56px;text-align:right">${num(v)}</span>
        </div></td>
      </tr>`;
    })
    .join('');
  return `<div class="panel" style="flex:1 1 340px;min-width:0">
    <div class="panel-head"><h3>${esc(title)}</h3><p>${sub}</p></div>
    <div class="table-scroll"><table><tbody>${rows}</tbody></table></div>
  </div>`;
}

export function renderDensity(root: HTMLElement, data: Dataset): void {
  const meta = data.meta;
  const n = meta.national;
  const big = data.regions.filter((r) => r.total12 >= 150);
  const topApt = [...data.regions].sort((a, b) => b.nonHouse12 - a.nonHouse12).slice(0, 12);
  const topHouse = [...data.regions].sort((a, b) => b.houses12 - a.houses12).slice(0, 12);
  const aptShareNat = (n.town12 + n.apt12) / n.tot12;

  root.innerHTML = `
    <div class="view-head">
      <h2>Houses or apartments?</h2>
      <p>Australia approves ${pct(n.house12 / n.tot12, 0)} of its new homes as detached ${gloss('house', 'houses')} and ${pct(aptShareNat, 0)} as ${gloss('non-house', 'townhouses and apartments')}. But the national average hides two completely different countries — sprawling growth corridors and dense inner cities.</p>
    </div>

    <div class="stat-row">
      <div class="stat"><div class="stat-label">Houses (12 mo)</div><div class="stat-value" style="color:var(--house)">${num(n.house12)}</div></div>
      <div class="stat"><div class="stat-label">Townhouses (12 mo)</div><div class="stat-value" style="color:var(--townhouse)">${num(n.town12)}</div></div>
      <div class="stat"><div class="stat-label">Apartments (12 mo)</div><div class="stat-value" style="color:var(--apartment)">${num(n.apt12)}</div></div>
      <div class="stat"><div class="stat-label">Non-house share</div><div class="stat-value">${pct(aptShareNat, 0)}</div></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>The national mix over time</h3><p>Every month's approvals as a share of the total (rolling 12-month). A rising blue band means the country is densifying; a stable one means it isn't.</p></div>
      <div class="chart-wrap scroll-x">${compositionChart(data)}</div>
      <div class="legend">
        <span class="legend-item"><span class="legend-swatch" style="background:var(--house)"></span>Houses</span>
        <span class="legend-item"><span class="legend-swatch" style="background:var(--townhouse)"></span>Townhouses</span>
        <span class="legend-item"><span class="legend-swatch" style="background:var(--apartment)"></span>Apartments</span>
        <span class="legend-item"><span class="legend-swatch" style="background:#b7b1a6"></span>Other</span>
      </div>
    </div>

    <div style="display:flex;gap:var(--space-lg);flex-wrap:wrap;margin-top:var(--space-lg)">
      ${leaderColumn('Where apartments &amp; townhouses get built', 'Regions by non-house dwellings approved (12 mo). Click to drill in.', topApt, (r) => r.nonHouse12, 'var(--apartment)')}
      ${leaderColumn('Where detached houses get built', 'Regions by detached houses approved (12 mo). Click to drill in.', topHouse, (r) => r.houses12, 'var(--house)')}
    </div>
    <p class="mini-note" style="margin-top:var(--space-md)">${num(big.length)} regions approve at least 150 homes a year. The apartment list is inner-city infill; the house list is the outer-suburban and regional growth frontier.</p>
  `;

  root.querySelectorAll<HTMLElement>('tr.clickable').forEach((tr) => {
    const go = () => openRegion(tr.dataset.code!);
    tr.addEventListener('click', go);
    tr.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') go(); });
  });
}
