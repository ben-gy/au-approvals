// Shape the raw files in tmp/ into the app's public/data JSON, and simplify the
// ABS SA3 boundaries with mapshaper (never by hand).

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import mapshaper from 'mapshaper';
import {
  ACCORD_MONTHLY_TARGET, ACCORD_START,
  buildNational, buildRegions, median, monthAxis, monthLabel,
  parseErp, parseSdmxCsv, windowSum,
} from './parse.mjs';

const TMP = join(import.meta.dirname, 'tmp');
const OUT = join(import.meta.dirname, '..', 'public', 'data');
mkdirSync(OUT, { recursive: true });
const read = (f) => readFileSync(join(TMP, f), 'utf8');

// ── parse raw ────────────────────────────────────────────────────────
const sa3Rows = parseSdmxCsv(read('ba_sa3.csv'));
const valueRows = parseSdmxCsv(read('ba_sa3_value.csv'));
const ausRows = parseSdmxCsv(read('ba_aus.csv'));
const steRows = parseSdmxCsv(read('ba_ste.csv'));
const { pop: popByCode, year: erpYear } = parseErp(read('erp.csv'));

if (sa3Rows.length < 5000) throw new Error(`only ${sa3Rows.length} SA3 rows — source incomplete`);
if (popByCode.size < 300) throw new Error(`only ${popByCode.size} SA3 populations — ERP incomplete`);

// The national AUS series defines the month axis (it is the most complete level
// and drives the hero timeline). SA3/STE align onto it.
const months = monthAxis(ausRows.length ? ausRows : sa3Rows);
if (months.length < 40) throw new Error(`only ${months.length} months — source incomplete`);
const idxLast = months.length - 1;

// ── boundaries: names + geometry ─────────────────────────────────────
const rawGeo = JSON.parse(read('sa3-raw.geojson'));
const nameByCode = new Map();
for (const f of rawGeo.features) {
  const p = f.properties || {};
  if (p.sa3_code_2021) nameByCode.set(String(p.sa3_code_2021), p.sa3_name_2021);
}

const geoCmd =
  '-i raw.geojson ' +
  '-rename-fields code=sa3_code_2021,name=sa3_name_2021 ' +
  '-filter-fields code,name ' +
  '-simplify 1.3% keep-shapes -clean ' +
  '-o format=geojson precision=0.001 sa3.geojson';
const geoOut = await mapshaper.applyCommands(geoCmd, { 'raw.geojson': JSON.stringify(rawGeo) });
writeFileSync(join(OUT, 'sa3.geojson'), geoOut['sa3.geojson'].toString());

// ── regions ──────────────────────────────────────────────────────────
const regions = buildRegions({ sa3Rows, valueRows, popByCode, months });
for (const r of regions) r.name = nameByCode.get(r.code) ?? r.code;
// Drop the "no usable residential activity anywhere" tail so the map/rankings
// aren't padded with permanent zeros (e.g. pure-CBD or reserve SA3s).
const active = regions.filter((r) => r.mTot.some((v) => v > 0) || (r.pop ?? 0) > 0);
if (active.length < 250) throw new Error(`only ${active.length} active SA3 regions — refusing to ship`);

// National-total invariant: the sum of SA3 house + non-house last-12 dwellings
// must equal the SA3 total last-12 dwellings (houses(110) + excl(850) split).
{
  const t = active.reduce((a, r) => a + r.total12, 0);
  const h = active.reduce((a, r) => a + r.houses12, 0);
  const nh = active.reduce((a, r) => a + r.nonHouse12, 0);
  if (t > 0 && Math.abs(t - (h + nh)) / t > 0.0001) {
    throw new Error(`house/non-house split drift: total ${t} != houses ${h} + nonHouse ${nh}`);
  }
  console.log(`  invariant OK: SA3 last-12 total ${t} == houses ${h} + non-house ${nh}`);
}

const rated = active.filter((r) => r.rate !== null);
const medians = {
  rate: median(rated.map((r) => r.rate)),
  houseShare: median(active.map((r) => r.houseShare).filter((x) => x !== null)),
  change: median(active.map((r) => r.change).filter((x) => x !== null)),
  changeLong: median(active.map((r) => r.changeLong).filter((x) => x !== null)),
};

// ── national + states ────────────────────────────────────────────────
const national = buildNational({ ausRows, steRows, months });

// National last-12 aggregates for the About/header/insights.
const ausTot12 = windowSum(national.aus.tot, idxLast, 12);
const ausHouse12 = windowSum(national.aus.house, idxLast, 12);
const ausTown12 = windowSum(national.aus.town, idxLast, 12);
const ausApt12 = windowSum(national.aus.apt, idxLast, 12);

// Peak rolling-12 month, for the "how far off the peak" story.
let peak = { value: 0, month: months[0] };
for (let i = 11; i < months.length; i++) {
  const v = windowSum(national.aus.tot, i, 12);
  if (v > peak.value) peak = { value: v, month: months[i] };
}

const meta = {
  generated: new Date().toISOString(),
  months,
  monthLabels: months.map(monthLabel),
  latestMonth: months[idxLast],
  latestMonthLabel: monthLabel(months[idxLast]),
  firstMonth: months[0],
  firstMonthLabel: monthLabel(months[0]),
  window: 12,
  erpYear,
  accordMonthlyTarget: ACCORD_MONTHLY_TARGET,
  accordStart: ACCORD_START,
  accordStartIndex: months.indexOf(ACCORD_START),
  annotations: [
    { month: '2022-05', text: 'Cash-rate liftoff' },
    { month: ACCORD_START, text: 'Housing Accord begins' },
    { month: '2025-02', text: 'Rate cuts begin' },
  ].filter((a) => months.includes(a.month)),
  national: {
    tot12: ausTot12,
    house12: ausHouse12,
    town12: ausTown12,
    apt12: ausApt12,
    latestMonthly: national.aus.tot[idxLast],
    peak12: peak.value,
    peak12Month: monthLabel(peak.month),
    accordAnnual: ACCORD_MONTHLY_TARGET * 12,
  },
  counts: {
    regions: active.length,
    rated: rated.length,
    suppressed: active.length - rated.length,
    months: months.length,
    states: national.states.length,
  },
  medians,
  source: {
    approvals: 'https://www.abs.gov.au/statistics/industry/building-and-construction/building-approvals-australia',
    api: 'https://data.api.abs.gov.au/rest/data/ABS,BA_SA2',
    erp: 'https://data.api.abs.gov.au/rest/data/ERP_ASGS2021',
    boundaries: 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SA3/MapServer',
  },
};

writeFileSync(join(OUT, 'regions.json'), JSON.stringify(active));
writeFileSync(join(OUT, 'national.json'), JSON.stringify(national));
writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 2));

const kb = (f) => Math.round(statSync(join(OUT, f)).size / 1024);
console.log('Wrote:');
console.log('  regions.json ', kb('regions.json'), 'KB (', active.length, 'SA3s,', rated.length, 'rated )');
console.log('  national.json', kb('national.json'), 'KB (', national.states.length, 'states )');
console.log('  sa3.geojson  ', kb('sa3.geojson'), 'KB');
console.log('  meta.json    ', kb('meta.json'), 'KB');
console.log(`  window: ${meta.firstMonthLabel} .. ${meta.latestMonthLabel}, ERP ${erpYear}`);
console.log(`  national last-12: ${ausTot12.toLocaleString()} dwellings (${Math.round((ausHouse12 / ausTot12) * 100)}% houses); peak-12 ${peak.value.toLocaleString()} in ${monthLabel(peak.month)}`);
console.log(`  median rate ${medians.rate?.toFixed(1)} /10k residents, median house share ${(medians.houseShare * 100).toFixed(0)}%`);
