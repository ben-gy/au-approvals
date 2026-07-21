import type { Dataset, Region } from '../types';
import { abbr, esc, num, rate, pct, delta, money, tip, stateColour } from '../format';
import { openRegion, navigate } from '../main';
import { gloss } from '../glossary';
import { sparkline } from '../charts';

type SortKey = 'name' | 'total12' | 'rate' | 'houseShare' | 'change' | 'value12';
let sortKey: SortKey = 'total12';
let sortDir: 1 | -1 = -1;
let query = '';

const COLS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Region' },
  { key: 'total12', label: 'Homes (12mo)', align: 'right' },
  { key: 'rate', label: 'Per 10k', align: 'right' },
  { key: 'houseShare', label: 'Houses', align: 'right' },
  { key: 'change', label: 'YoY', align: 'right' },
  { key: 'value12', label: 'Value', align: 'right' },
];

function val(r: Region, k: SortKey): number | string | null {
  switch (k) {
    case 'name': return r.name;
    case 'total12': return r.total12;
    case 'rate': return r.rate;
    case 'houseShare': return r.houseShare;
    case 'change': return r.change;
    case 'value12': return r.value12;
  }
}

export function renderExplorer(root: HTMLElement, data: Dataset, filter?: string): void {
  if (filter !== undefined) query = filter;

  root.innerHTML = `
    <div class="view-head">
      <h2>Explore every region</h2>
      <p>All ${num(data.regions.length)} ${gloss('sa3', 'SA3 regions')}. Search, sort any column, and click a row for the full monthly history. Sparkline is the rolling 12-month trend.</p>
    </div>
    <div class="controls">
      <input type="search" id="explorer-q" placeholder="Search a region or state…" value="${esc(query)}" aria-label="Search regions" />
      <span class="control-label" id="explorer-count"></span>
    </div>
    <div class="panel table-scroll">
      <table>
        <thead><tr>
          ${COLS.map((c) => `<th class="sortable ${c.align === 'right' ? 'right' : ''}" data-key="${c.key}">${esc(c.label)}<span data-arrow="${c.key}"></span></th>`).join('')}
          <th>Trend</th>
        </tr></thead>
        <tbody id="explorer-body"></tbody>
      </table>
    </div>
  `;

  const body = root.querySelector<HTMLElement>('#explorer-body')!;
  const countEl = root.querySelector<HTMLElement>('#explorer-count')!;

  const draw = () => {
    const q = query.trim().toLowerCase();
    let rows = data.regions.filter(
      (r) => !q || r.name.toLowerCase().includes(q) || r.state.toLowerCase().includes(q) || abbr(r.state).toLowerCase().includes(q),
    );
    rows.sort((a, b) => {
      const va = val(a, sortKey);
      const vb = val(b, sortKey);
      if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb)) * sortDir;
      const na = va === null ? -Infinity : va;
      const nb = vb === null ? -Infinity : vb;
      return (na - nb) * sortDir;
    });

    countEl.textContent = `${rows.length} region${rows.length === 1 ? '' : 's'}`;
    body.innerHTML = rows
      .map((r) => {
        const nonShare = r.houseShare === null ? 0 : 1 - r.houseShare;
        const mix = `<span class="mixbar" data-tip="${tip(`Houses ${pct(r.houseShare, 0)} · non-house ${pct(nonShare, 0)}`)}"><span style="width:${((r.houseShare ?? 0) * 100).toFixed(0)}%;background:var(--house)"></span><span style="width:${(nonShare * 100).toFixed(0)}%;background:var(--apartment)"></span></span>`;
        return `<tr class="clickable" data-code="${esc(r.code)}" tabindex="0">
          <td class="region-name">${esc(r.name)} <span class="state-pill" style="background:${stateColour(r.state)};color:#fff">${esc(abbr(r.state))}</span></td>
          <td class="right num">${num(r.total12)}</td>
          <td class="right num">${rate(r.rate)}</td>
          <td class="right">${mix} <span class="num" style="font-size:var(--font-size-xs)">${pct(r.houseShare, 0)}</span></td>
          <td class="right num ${(r.change ?? 0) >= 0 ? 'up' : 'down'}">${delta(r.change)}</td>
          <td class="right num">${money(r.value12)}</td>
          <td>${sparkline(r.series, 96, 24, 'var(--accent-primary)')}</td>
        </tr>`;
      })
      .join('');

    body.querySelectorAll<HTMLElement>('tr').forEach((tr) => {
      const go = () => openRegion(tr.dataset.code!);
      tr.addEventListener('click', go);
      tr.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') go(); });
    });

    root.querySelectorAll<HTMLElement>('[data-arrow]').forEach((el) => {
      el.textContent = el.dataset.arrow === sortKey ? (sortDir === 1 ? ' ▲' : ' ▼') : '';
    });
  };

  root.querySelectorAll<HTMLElement>('th.sortable').forEach((th) =>
    th.addEventListener('click', () => {
      const k = th.dataset.key as SortKey;
      if (k === sortKey) sortDir = (sortDir * -1) as 1 | -1;
      else { sortKey = k; sortDir = k === 'name' ? 1 : -1; }
      draw();
    }),
  );

  let t: number | undefined;
  root.querySelector<HTMLInputElement>('#explorer-q')!.addEventListener('input', (e) => {
    query = (e.target as HTMLInputElement).value;
    clearTimeout(t);
    t = window.setTimeout(() => { navigate({ filter: query || undefined }, true); }, 300);
  });

  draw();
}
