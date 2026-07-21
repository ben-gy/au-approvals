import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Dataset, Region } from '../types';
import { abbr, delta, esc, num, pct, rate, money } from '../format';
import { openRegion } from '../main';
import { gloss } from '../glossary';

type Measure = 'rate' | 'total12' | 'nonHouseShare' | 'change' | 'value12';

const MEASURES: { id: Measure; label: string; blurb: string }[] = [
  { id: 'rate', label: 'Per 10,000 residents', blurb: 'New homes approved over the last 12 months per 10,000 residents. Deepest where supply is most intense relative to the people already there.' },
  { id: 'total12', label: 'Total new homes', blurb: 'Raw 12-month count of dwellings approved — largely a map of the big growth corridors.' },
  { id: 'nonHouseShare', label: 'Apartment & townhouse share', blurb: 'Share of approvals that are NOT detached houses. Deepest in the inner cities where density concentrates.' },
  { id: 'change', label: 'Year-on-year change', blurb: 'Growth in the 12-month total against a year earlier. Blue is falling, red is rising.' },
  { id: 'value12', label: 'Value approved', blurb: 'Dollar value of residential building approved over the last 12 months.' },
];

const RAMP = ['var(--sev-1)', 'var(--sev-2)', 'var(--sev-3)', 'var(--sev-4)', 'var(--sev-5)'];
const DIVERGING = ['#2f6b8f', '#8fb8cc', '#efe9e1', '#d99a6c', '#a8352b'];
const NO_DATA = '#e3ded7';

let measure: Measure = 'rate';
let map: L.Map | null = null;

const val = (r: Region | undefined, m: Measure): number | null => {
  if (!r) return null;
  switch (m) {
    case 'rate': return r.rate;
    case 'total12': return r.total12;
    case 'nonHouseShare': return r.total12 > 0 ? r.nonHouse12 / r.total12 : null;
    case 'change': return r.change;
    case 'value12': return r.value12;
  }
};

export function renderMap(root: HTMLElement, data: Dataset): void {
  root.innerHTML = `
    <div class="view-head">
      <h2>Where the homes are approved</h2>
      <p>All ${num(data.meta.counts.regions)} ${gloss('sa3', 'SA3 regions')} shaded by ${gloss('per 10,000 residents', 'supply intensity')}. Hover any region for its numbers; click to open its full history.</p>
    </div>
    <div class="controls">
      <div class="seg" role="group" aria-label="Map measure">
        ${MEASURES.map((m) => `<button data-measure="${m.id}" aria-pressed="${m.id === measure}">${esc(m.label)}</button>`).join('')}
      </div>
    </div>
    <div class="map-shell"><div class="map-canvas" id="map-canvas"></div></div>
    <div class="map-legend" id="map-legend"></div>
    <p id="map-blurb" style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-top:var(--space-sm)"></p>
  `;

  const byCode = new Map(data.regions.map((r) => [r.code, r]));
  const canvas = root.querySelector<HTMLElement>('#map-canvas')!;

  if (map) { map.remove(); map = null; }
  map = L.map(canvas, { minZoom: 3, maxZoom: 11, zoomControl: true, scrollWheelZoom: false });
  map.attributionControl.setPrefix(false);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: 'Tiles © CARTO', subdomains: 'abcd', minZoom: 3, maxZoom: 11,
  }).addTo(map);

  let layer: L.GeoJSON | null = null;

  const thresholds = (): number[] => {
    const vals = data.regions.map((r) => val(r, measure)).filter((v): v is number => v !== null).sort((a, b) => a - b);
    if (!vals.length) return [0, 0, 0, 0];
    if (measure === 'change') return [-0.25, 0, 0.25, 0.6];
    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
    return [q(0.2), q(0.4), q(0.6), q(0.85)];
  };

  const colourFor = (r: Region | undefined): string => {
    const v = val(r, measure);
    if (v === null) return NO_DATA;
    const t = thresholds();
    const ramp = measure === 'change' ? DIVERGING : RAMP;
    let i = 0;
    while (i < t.length && v >= t[i]) i++;
    return ramp[i];
  };

  const tipHtml = (r: Region | undefined, name: string): string => {
    if (!r) return `<strong>${esc(name)}</strong><br>No data`;
    return `<strong>${esc(r.name)}</strong> <span style="opacity:.7">${esc(abbr(r.state))}</span><br>
      Per 10,000 residents: <b>${rate(r.rate)}</b><br>
      New homes (12 mo): <b>${num(r.total12)}</b><br>
      Detached houses: <b>${pct(r.houseShare, 0)}</b><br>
      Year-on-year: <b>${delta(r.change)}</b><br>
      Value: <b>${money(r.value12)}</b>`;
  };

  const fmt = (v: number): string =>
    measure === 'nonHouseShare' ? pct(v, 0)
    : measure === 'change' ? delta(v)
    : measure === 'rate' ? rate(v)
    : measure === 'value12' ? money(v)
    : num(v);

  const paint = () => {
    layer?.setStyle((f: any) => ({
      fillColor: colourFor(byCode.get(f.properties.code)),
      fillOpacity: 0.85, color: '#ffffff', weight: 0.5,
    }));
    const t = thresholds();
    const ramp = measure === 'change' ? DIVERGING : RAMP;
    root.querySelector<HTMLElement>('#map-legend')!.innerHTML = `
      <span>${esc(MEASURES.find((m) => m.id === measure)!.label)}</span>
      <span class="ramp">${ramp.map((c) => `<span style="background:${c}"></span>`).join('')}</span>
      <span style="color:var(--text-tertiary)">${fmt(t[0])} · ${fmt(t[1])} · ${fmt(t[2])} · ${fmt(t[3])}</span>
      <span class="legend-item"><span class="legend-swatch" style="background:${NO_DATA}"></span>no data</span>`;
    root.querySelector<HTMLElement>('#map-blurb')!.textContent = MEASURES.find((m) => m.id === measure)!.blurb;
  };

  fetch('data/sa3.geojson')
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((geo) => {
      layer = L.geoJSON(geo, {
        attribution: 'Boundaries: ABS ASGS 2021 (CC BY 4.0)',
        style: () => ({ fillOpacity: 0.85, color: '#ffffff', weight: 0.5 }),
        onEachFeature: (f: any, lyr: any) => {
          const r = byCode.get(f.properties.code);
          lyr.bindTooltip(tipHtml(r, f.properties.name), { sticky: true, className: 'map-tip' });
          lyr.on({
            mouseover: () => lyr.setStyle({ weight: 2, color: '#1c1f26' }),
            mouseout: () => layer?.resetStyle(lyr),
            click: () => { if (r) openRegion(r.code); },
          });
        },
      }).addTo(map!);
      paint();

      const bounds = layer.getBounds();
      const fit = () => {
        map?.invalidateSize();
        if (bounds.isValid() && canvas.clientHeight > 50) map?.fitBounds(bounds, { padding: [10, 10] });
      };
      const ro = new ResizeObserver(() => { if (canvas.clientHeight > 50) { fit(); ro.disconnect(); } });
      ro.observe(canvas);
      setTimeout(fit, 400);
    })
    .catch((err) => {
      canvas.innerHTML = `<div class="error-state">Could not load the map boundaries (${esc(err.message)}).</div>`;
    });

  root.querySelectorAll<HTMLButtonElement>('[data-measure]').forEach((b) =>
    b.addEventListener('click', () => {
      measure = b.dataset.measure as Measure;
      root.querySelectorAll<HTMLButtonElement>('[data-measure]').forEach((o) => o.setAttribute('aria-pressed', String(o.dataset.measure === measure)));
      paint();
    }),
  );

  paint();
}
