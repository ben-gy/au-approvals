// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson — https://benrichardson.dev
// Additional terms under AGPL-3.0 section 7(b) apply; see ADDITIONAL-TERMS.md.
const NF = new Intl.NumberFormat('en-AU');

export function num(n: number | null | undefined, dp = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return dp > 0
    ? n.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })
    : NF.format(Math.round(n));
}

export function rate(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(1);
}

export function pct(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(dp)}%`;
}

/** Signed percentage, for change columns. */
export function delta(n: number | null | undefined, dp = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const s = (n * 100).toFixed(dp);
  return `${n > 0 ? '+' : ''}${s}%`;
}

/** Compact AUD, e.g. $1.2bn, $340m, $12k. */
export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}bn`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}m`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

export const STATE_ABBR: Record<string, string> = {
  'New South Wales': 'NSW',
  Victoria: 'Vic',
  Queensland: 'Qld',
  'South Australia': 'SA',
  'Western Australia': 'WA',
  Tasmania: 'Tas',
  'Northern Territory': 'NT',
  'Australian Capital Territory': 'ACT',
  'Other Territories': 'Other',
  Other: 'Other',
};
export const abbr = (state: string): string => STATE_ABBR[state] ?? state;

/** One stable colour per state, used across every view. */
export const STATE_COLOUR: Record<string, string> = {
  'New South Wales': '#3d6fb4',
  Victoria: '#5a4b9c',
  Queensland: '#b5642f',
  'South Australia': '#b03a68',
  'Western Australia': '#c79a33',
  Tasmania: '#2f8f6b',
  'Northern Territory': '#c85a3a',
  'Australian Capital Territory': '#4f8a9c',
  'Other Territories': '#8a837a',
};
export const stateColour = (s: string): string => STATE_COLOUR[s] ?? 'var(--text-tertiary)';

/** Escape text destined for innerHTML. */
export function esc(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

/** Escape for a `data-tip` attribute (rendered as textContent — keep plain). */
export const tip = (s: string): string => esc(s);

/** Colour for a value relative to the median: higher = more supply (good). */
export function ramp5(value: number | null, thresholds: number[]): string {
  const ramp = ['var(--sev-1)', 'var(--sev-2)', 'var(--sev-3)', 'var(--sev-4)', 'var(--sev-5)'];
  if (value === null || !Number.isFinite(value)) return 'var(--text-tertiary)';
  let i = 0;
  while (i < thresholds.length && value >= thresholds[i]) i++;
  return ramp[i];
}
