// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
import type { Dataset } from '../types';
import { esc } from '../format';
import { computeInsights } from '../analysis';
import { openRegion, navigate } from '../main';
import { gloss } from '../glossary';

export function renderInsights(root: HTMLElement, data: Dataset): void {
  const insights = computeInsights(data);
  root.innerHTML = `
    <div class="view-head">
      <h2>What the data is telling us</h2>
      <p>Findings computed automatically from the latest release — the national ${gloss('housing accord', 'Accord')} pace, the busiest regions, the sharpest movers and the density extremes. Click through to the region or the Explorer.</p>
    </div>
    <div class="insight-grid">
      ${insights
        .map(
          (ins) => `<div class="insight ${ins.severity}">
            <h3>${esc(ins.title)}</h3>
            <p>${esc(ins.body)}</p>
            ${ins.region ? `<button data-region="${esc(ins.region)}">Open region →</button>` : ins.filter !== undefined ? `<button data-filter="${esc(ins.filter)}">See in Explorer →</button>` : ''}
          </div>`,
        )
        .join('')}
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>('[data-region]').forEach((b) =>
    b.addEventListener('click', () => openRegion(b.dataset.region!)),
  );
  root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => navigate({ view: 'explorer' as any, filter: b.dataset.filter })),
  );
}
