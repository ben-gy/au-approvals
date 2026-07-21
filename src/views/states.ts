import type { Dataset, StateSeries } from '../types';
import { abbr, esc, num, rate, pct, tip, stateColour } from '../format';
import { gloss } from '../glossary';
import { sparkline } from '../charts';

const sumLast = (a: number[], w = 12) => a.slice(-w).reduce((x, y) => x + y, 0);

function rolling12(s: number[]): (number | null)[] {
  const out: (number | null)[] = new Array(s.length).fill(null);
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    sum += s[i];
    if (i >= 12) sum -= s[i - 12];
    if (i >= 11) out[i] = sum;
  }
  return out;
}

interface Row {
  s: StateSeries;
  tot: number; house: number; town: number; apt: number; other: number;
  pop: number; rate: number | null;
}

function matrix(rows: Row[]): string {
  const cols = [
    { key: 'house' as const, label: 'Houses', colour: 'var(--house)' },
    { key: 'town' as const, label: 'Townhouses', colour: 'var(--townhouse)' },
    { key: 'apt' as const, label: 'Apartments', colour: 'var(--apartment)' },
    { key: 'other' as const, label: 'Other', colour: '#b7b1a6' },
  ];
  const W = 720;
  const labelW = 150;
  const rowH = 40;
  const headH = 26;
  const cellW = (W - labelW) / cols.length;
  const H = headH + rows.length * rowH + 6;

  const header = cols
    .map((c, j) => `<text class="axis-text" x="${labelW + j * cellW + cellW / 2}" y="${headH - 8}" text-anchor="middle" style="font-weight:600;fill:var(--text-secondary)">${esc(c.label)}</text>`)
    .join('');

  const body = rows
    .map((r, i) => {
      const y = headH + i * rowH;
      const label = `<text x="${labelW - 8}" y="${y + rowH / 2}" text-anchor="end" dominant-baseline="middle" style="font-size:12px;fill:var(--text-primary)">${esc(r.s.state)}</text>`;
      const cells = cols
        .map((c, j) => {
          const share = r.tot > 0 ? (r as any)[c.key] / r.tot : 0;
          const x = labelW + j * cellW;
          const tt = `${r.s.state} — ${c.label}\n${num((r as any)[c.key])} homes\n${pct(share, 0)} of the state's approvals`;
          const textCol = share > 0.5 ? '#fff' : 'var(--text-secondary)';
          return `<g data-tip="${tip(tt)}">
            <rect class="matrix-cell" x="${x + 2}" y="${y + 3}" width="${cellW - 4}" height="${rowH - 6}" rx="4"
              fill="${c.colour}" fill-opacity="${(0.12 + share * 0.85).toFixed(3)}"/>
            <text x="${x + cellW / 2}" y="${y + rowH / 2}" text-anchor="middle" dominant-baseline="middle" style="font-size:12px;font-weight:600;fill:${textCol}">${pct(share, 0)}</text>
          </g>`;
        })
        .join('');
      return label + cells;
    })
    .join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="State by building type matrix" style="min-width:640px">${header}${body}</svg>`;
}

export function renderStates(root: HTMLElement, data: Dataset): void {
  // state population from summed SA3 populations
  const popByState = new Map<string, number>();
  for (const r of data.regions) if (r.pop) popByState.set(r.state, (popByState.get(r.state) ?? 0) + r.pop);

  const rows: Row[] = data.national.states
    .map((s) => {
      const tot = sumLast(s.tot);
      const house = sumLast(s.house);
      const town = sumLast(s.town);
      const apt = sumLast(s.apt);
      const other = Math.max(0, tot - house - town - apt);
      const pop = popByState.get(s.state) ?? 0;
      return { s, tot, house, town, apt, other, pop, rate: pop > 0 ? (tot / pop) * 10000 : null };
    })
    .filter((r) => r.tot > 0)
    .sort((a, b) => b.tot - a.tot);

  const cells = rows
    .map((r) => {
      const spark = sparkline(rolling12(r.s.tot), 150, 40, stateColour(r.s.state));
      return `<div class="cell">
        <h4><span><span class="state-pill" style="background:${stateColour(r.s.state)};color:#fff">${esc(abbr(r.s.state))}</span> ${esc(r.s.state)}</span></h4>
        <div class="big">${num(r.tot)}</div>
        <div style="font-size:var(--font-size-xs);color:var(--text-tertiary);margin-bottom:6px">homes/yr · ${rate(r.rate)} per 10k · ${pct(r.house / r.tot, 0)} houses</div>
        <div data-tip="${tip(`${r.s.state}\nRolling 12-month approvals\nLatest: ${num(r.tot)}`)}">${spark}</div>
      </div>`;
    })
    .join('');

  root.innerHTML = `
    <div class="view-head">
      <h2>State by state</h2>
      <p>How the states compare on volume, ${gloss('per 10,000 residents', 'supply per resident')} and the ${gloss('house', 'house')}-versus-${gloss('apartment', 'apartment')} mix. The matrix makes the density difference stark: some states build almost only houses, others lean hard into apartments.</p>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Rolling 12-month approvals by state</h3><p>Latest annual total, supply per 10,000 residents, and detached-house share. Line is the 12-month rolling trend since ${esc(data.meta.firstMonthLabel)}.</p></div>
      <div class="small-mult">${cells}</div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>What each state builds</h3><p>Share of the last 12 months' approvals by dwelling type. Hover a cell for exact counts.</p></div>
      <div class="scroll-x">${matrix(rows)}</div>
    </div>
  `;
}
