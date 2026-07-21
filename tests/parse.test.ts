import { describe, expect, it } from 'vitest';
import {
  splitCsvLine, parseSdmxCsv, parseErp, stateForCode, monthAxis, monthLabel,
  alignSeries, rolling, windowSum, buildRegions, buildNational, median, BLD,
} from '../pipeline/parse.mjs';

describe('splitCsvLine', () => {
  it('splits a plain line', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });
  it('honours quoted commas', () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });
  it('handles escaped quotes inside a field', () => {
    expect(splitCsvLine('"he said ""hi""",x')).toEqual(['he said "hi"', 'x']);
  });
  it('keeps trailing empty field', () => {
    expect(splitCsvLine('a,b,')).toEqual(['a', 'b', '']);
  });
});

const SDMX =
  'DATAFLOW,MEASURE,SECTOR,WORK_TYPE,BUILDING_TYPE,REGION_TYPE,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,UNIT_MULT,OBS_STATUS,OBS_COMMENT\n' +
  'ABS:BA_SA2(2.0.0),1,9,1,100,SA3,10102,M,2024-01,50,NUM,0,,\n' +
  'ABS:BA_SA2(2.0.0),1,9,1,110,SA3,10102,M,2024-01,30,NUM,0,,\n' +
  'ABS:BA_SA2(2.0.0),1,9,1,100,SA3,10102,M,2024-02,,NUM,0,,\n'; // non-numeric OBS_VALUE dropped

describe('parseSdmxCsv', () => {
  it('addresses columns by header name and types the value', () => {
    const rows = parseSdmxCsv(SDMX);
    expect(rows.length).toBe(2); // the empty OBS_VALUE row is dropped
    expect(rows[0]).toMatchObject({ measure: '1', bld: '100', regionType: 'SA3', region: '10102', time: '2024-01', value: 50 });
  });
  it('returns [] for empty input', () => {
    expect(parseSdmxCsv('')).toEqual([]);
  });
});

describe('parseErp', () => {
  it('keeps only TOT age and the latest year per region', () => {
    const csv =
      'DATAFLOW,MEASURE,SEX,AGE,REGION_TYPE,ASGS_2021,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE,OBS_STATUS,OBS_COMMENT\n' +
      'x,ERP,3,A20,SA3,10102,A,2024,999,PSNS,,\n' + // wrong age, ignored
      'x,ERP,3,TOT,SA3,10102,A,2023,1000,PSNS,,\n' +
      'x,ERP,3,TOT,SA3,10102,A,2024,1100,PSNS,,\n';
    const { pop, year } = parseErp(csv);
    expect(year).toBe(2024);
    expect(pop.get('10102')).toBe(1100);
  });
});

describe('stateForCode', () => {
  it('maps the leading digit to a state', () => {
    expect(stateForCode('10102')).toBe('New South Wales');
    expect(stateForCode('20604')).toBe('Victoria');
    expect(stateForCode('80109')).toBe('Australian Capital Territory');
  });
});

describe('month helpers', () => {
  it('monthAxis returns sorted unique months', () => {
    const rows = [{ time: '2024-02' }, { time: '2024-01' }, { time: '2024-02' }] as any;
    expect(monthAxis(rows)).toEqual(['2024-01', '2024-02']);
  });
  it('monthLabel abbreviates', () => {
    expect(monthLabel('2024-07')).toBe('Jul 24');
  });
});

describe('alignSeries', () => {
  it('sums rows into the right month slots, absent = 0', () => {
    const months = ['2024-01', '2024-02', '2024-03'];
    const rows = [
      { time: '2024-01', value: 5 },
      { time: '2024-01', value: 3 },
      { time: '2024-03', value: 2 },
    ] as any;
    expect(alignSeries(rows, months)).toEqual([8, 0, 2]);
  });
});

describe('rolling / windowSum', () => {
  it('rolling is null until the window fills, then a trailing sum', () => {
    const s = Array.from({ length: 13 }, (_, i) => i + 1); // 1..13
    const r = rolling(s, 12);
    expect(r[10]).toBeNull();
    expect(r[11]).toBe(78); // 1+..+12
    expect(r[12]).toBe(90); // 2+..+13
  });
  it('windowSum sums the w months ending at end', () => {
    expect(windowSum([1, 2, 3, 4, 5], 4, 3)).toBe(12); // 3+4+5
    expect(windowSum([1, 2, 3, 4, 5], 1, 3)).toBe(3); // clamped: 1+2
  });
});

describe('buildRegions', () => {
  const months = Array.from({ length: 24 }, (_, i) => `Y-${String(i).padStart(2, '0')}`);
  // region 10102: 10 houses + 5 non-house = 15/month total, every month
  const sa3Rows = months.flatMap((m) => [
    { region: '10102', bld: BLD.totalResidential, time: m, value: 15, mult: 0 },
    { region: '10102', bld: BLD.houses, time: m, value: 10, mult: 0 },
  ]);
  const valueRows = months.map((m) => ({ region: '10102', bld: BLD.totalResidential, time: m, value: 1000, mult: 3 }));
  const popByCode = new Map([['10102', 5000]]);

  it('computes trailing-12 totals, split and rate', () => {
    const [r] = buildRegions({ sa3Rows, valueRows, popByCode, months });
    expect(r.total12).toBe(180); // 15 * 12
    expect(r.houses12).toBe(120);
    expect(r.nonHouse12).toBe(60);
    expect(r.houseShare).toBeCloseTo(120 / 180, 6);
    expect(r.rate).toBeCloseTo((180 / 5000) * 10000, 6); // 360
    expect(r.value12).toBe(12 * 1000 * 1000); // mult 3 -> *1000
  });
  it('year-on-year change is 0 for a flat series', () => {
    const [r] = buildRegions({ sa3Rows, valueRows, popByCode, months });
    expect(r.change).toBeCloseTo(0, 6);
  });
  it('leaves rate null when population is missing', () => {
    const [r] = buildRegions({ sa3Rows, valueRows, popByCode: new Map(), months });
    expect(r.rate).toBeNull();
  });
});

describe('buildNational', () => {
  it('aligns AUS and per-state series', () => {
    const months = ['2024-01', '2024-02'];
    const ausRows = [
      { region: 'AUS', bld: BLD.totalResidential, time: '2024-01', value: 100, mult: 0 },
      { region: 'AUS', bld: BLD.houses, time: '2024-01', value: 60, mult: 0 },
    ];
    const steRows = [
      { region: '1', bld: BLD.totalResidential, time: '2024-01', value: 40, mult: 0 },
    ];
    const nat = buildNational({ ausRows, steRows, months });
    expect(nat.aus.tot).toEqual([100, 0]);
    expect(nat.aus.house).toEqual([60, 0]);
    expect(nat.states[0].state).toBe('New South Wales');
    expect(nat.states[0].tot).toEqual([40, 0]);
  });
});

describe('median', () => {
  it('handles odd and even lengths and ignores nulls', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([null, 5, null, 1])).toBe(3);
  });
});
