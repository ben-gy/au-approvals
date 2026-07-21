// Pure, dependency-free, network-free transforms for the ABS Building Approvals
// data. Everything here is unit-tested in tests/parse.test.ts and imported by
// aggregate.mjs — keep it free of `fs`/`fetch` so CI never installs anything.
//
// All series are New residential DWELLING UNITS approved (MEASURE 1, WORK_TYPE
// "New", Total Sectors) unless a value series (MEASURE 2, AUD thousands).

// ── ABS codes ────────────────────────────────────────────────────────────────
export const BLD = {
  totalResidential: '100',
  houses: '110',
  townhouses: '120', // Semi-detached / row / terrace / townhouses — Total
  apartments: '130', // Apartments — Total including those attached to a house
};

export const STATE_BY_DIGIT = {
  1: 'New South Wales',
  2: 'Victoria',
  3: 'Queensland',
  4: 'South Australia',
  5: 'Western Australia',
  6: 'Tasmania',
  7: 'Northern Territory',
  8: 'Australian Capital Territory',
  9: 'Other Territories',
};

export function stateForCode(code) {
  return STATE_BY_DIGIT[Number(String(code)[0])] ?? 'Other Territories';
}

// The 1.2M-homes-in-5-years National Housing Accord implies this many dwellings
// a month (240,000/yr). It is a COMPLETIONS target; approvals lead completions
// and not every approval is built — shown as a reference benchmark, not a claim
// that approvals should equal it. See the glossary.
export const ACCORD_MONTHLY_TARGET = 20000;
export const ACCORD_START = '2024-07';

// ── CSV ──────────────────────────────────────────────────────────────────────
/** Split one CSV line, honouring double-quoted fields that may contain commas. */
export function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Parse an ABS SDMX "data+csv" response into typed rows. Columns are addressed
 * by header name so a reordering upstream cannot silently misalign them.
 */
export function parseSdmxCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return [];
  const head = splitCsvLine(lines[0]);
  const col = (name) => head.indexOf(name);
  const iBld = col('BUILDING_TYPE');
  const iRegT = col('REGION_TYPE');
  const iReg = col('REGION');
  const iTime = col('TIME_PERIOD');
  const iVal = col('OBS_VALUE');
  const iMult = col('UNIT_MULT');
  const iMeas = col('MEASURE');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsvLine(lines[i]);
    if (f.length < head.length) continue;
    // Skip blank observations explicitly — Number('') is 0, not NaN, so an empty
    // OBS_VALUE would otherwise be silently counted as a real zero.
    if (f[iVal] === undefined || f[iVal].trim() === '') continue;
    const v = Number(f[iVal]);
    if (!Number.isFinite(v)) continue;
    rows.push({
      measure: f[iMeas],
      bld: f[iBld],
      regionType: f[iRegT],
      region: f[iReg],
      time: f[iTime], // "YYYY-MM"
      value: v,
      mult: iMult >= 0 ? Number(f[iMult]) || 0 : 0,
    });
  }
  return rows;
}

/** Parse the ERP TOT-age SA3 CSV into a Map code -> latest-year population. */
export function parseErp(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return { pop: new Map(), year: 0 };
  const head = splitCsvLine(lines[0]);
  const iReg = head.indexOf('ASGS_2021');
  const iTime = head.indexOf('TIME_PERIOD');
  const iVal = head.indexOf('OBS_VALUE');
  const iAge = head.indexOf('AGE');
  const byCode = new Map(); // code -> {year, pop}
  let year = 0;
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsvLine(lines[i]);
    if (iAge >= 0 && f[iAge] !== 'TOT') continue;
    const code = f[iReg];
    const yr = Number(f[iTime]);
    const pop = Number(f[iVal]);
    if (!Number.isFinite(pop) || !code) continue;
    year = Math.max(year, yr);
    const cur = byCode.get(code);
    if (!cur || yr >= cur.year) byCode.set(code, { year: yr, pop });
  }
  const pop = new Map([...byCode].map(([c, v]) => [c, v.pop]));
  return { pop, year };
}

// ── month axis + series ──────────────────────────────────────────────────────
export function monthAxis(rows) {
  const set = new Set(rows.map((r) => r.time));
  return [...set].sort();
}

export function monthLabel(m) {
  const [y, mo] = m.split('-').map(Number);
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mo - 1]} ${String(y).slice(2)}`;
}

/**
 * Build an aligned monthly series over `months` for rows matching (region, bld).
 * A month with no published row is 0 — building approvals are not person-level,
 * so an absent SA3-month means no dwellings were approved, not a withheld cell.
 */
export function alignSeries(rows, months) {
  const idx = new Map(months.map((m, i) => [m, i]));
  const out = new Array(months.length).fill(0);
  for (const r of rows) {
    const i = idx.get(r.time);
    if (i !== undefined) out[i] += r.value;
  }
  return out;
}

/** Trailing-window rolling sum; null until the window fills. */
export function rolling(series, w = 12) {
  const out = new Array(series.length).fill(null);
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    sum += series[i];
    if (i >= w) sum -= series[i - w];
    if (i >= w - 1) out[i] = sum;
  }
  return out;
}

/** Sum of the w months ending at index `end` (inclusive). */
export function windowSum(series, end, w = 12) {
  let s = 0;
  for (let i = Math.max(0, end - w + 1); i <= end; i++) s += series[i] ?? 0;
  return s;
}

// ── builders ─────────────────────────────────────────────────────────────────
/**
 * Region-level (SA3) aggregates from the total+houses dwelling rows, the value
 * rows and the population map.
 */
export function buildRegions({ sa3Rows, valueRows, popByCode, months }) {
  const idxLast = months.length - 1;
  const byRegion = new Map();
  const ensure = (code) => {
    let g = byRegion.get(code);
    if (!g) { g = { code, tot: [], hou: [], val: [] }; byRegion.set(code, g); }
    return g;
  };

  const totRows = sa3Rows.filter((r) => r.bld === BLD.totalResidential);
  const houRows = sa3Rows.filter((r) => r.bld === BLD.houses);
  const codes = new Set([...totRows, ...houRows].map((r) => r.region));

  for (const code of codes) {
    const g = ensure(code);
    g.tot = alignSeries(totRows.filter((r) => r.region === code), months);
    g.hou = alignSeries(houRows.filter((r) => r.region === code), months);
    // value rows are AUD thousands (mult 3) -> raw AUD
    const vrows = valueRows.filter((r) => r.region === code);
    g.val = alignSeries(vrows.map((r) => ({ ...r, value: r.value * 10 ** (r.mult || 0) })), months);
  }

  const regions = [];
  for (const g of byRegion.values()) {
    const pop = popByCode.get(g.code) ?? null;
    const total12 = windowSum(g.tot, idxLast, 12);
    const houses12 = windowSum(g.hou, idxLast, 12);
    const nonHouse12 = Math.max(0, total12 - houses12);
    const value12 = windowSum(g.val, idxLast, 12);
    const prev12 = windowSum(g.tot, idxLast - 12, 12);
    const change = prev12 > 0 ? (total12 - prev12) / prev12 : null;

    // 3-year change for the trajectory view: this trailing-12 vs the trailing-12
    // ending 36 months earlier, when the series is long enough.
    const base36 = idxLast - 36;
    const long12 = base36 >= 11 ? windowSum(g.tot, base36, 12) : null;
    const changeLong = long12 && long12 > 0 ? (total12 - long12) / long12 : null;

    regions.push({
      code: g.code,
      name: g.code, // filled from geojson in aggregate
      state: stateForCode(g.code),
      pop,
      total12,
      houses12,
      nonHouse12,
      value12,
      houseShare: total12 > 0 ? houses12 / total12 : null,
      rate: pop && pop > 0 ? (total12 / pop) * 10000 : null,
      prev12,
      change,
      changeLong,
      series: rolling(g.tot, 12), // rolling-12 dwellings, for sparkline/trajectory
      mTot: g.tot,
      mHouse: g.hou,
    });
  }
  regions.sort((a, b) => b.total12 - a.total12);
  return regions;
}

/** National + per-state monthly building-type series for the Accord/States views. */
export function buildNational({ ausRows, steRows, months }) {
  const pick = (rows, region, bld) =>
    alignSeries(rows.filter((r) => r.region === region && r.bld === bld), months);

  const aus = {
    tot: pick(ausRows, 'AUS', BLD.totalResidential),
    house: pick(ausRows, 'AUS', BLD.houses),
    town: pick(ausRows, 'AUS', BLD.townhouses),
    apt: pick(ausRows, 'AUS', BLD.apartments),
  };

  const stateCodes = [...new Set(steRows.map((r) => r.region))].sort();
  const states = stateCodes.map((code) => ({
    code,
    state: stateForCode(code),
    tot: pick(steRows, code, BLD.totalResidential),
    house: pick(steRows, code, BLD.houses),
    town: pick(steRows, code, BLD.townhouses),
    apt: pick(steRows, code, BLD.apartments),
  }));

  return { aus, states };
}

export function median(nums) {
  const a = nums.filter((n) => n !== null && Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
