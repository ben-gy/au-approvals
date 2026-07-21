export interface Region {
  code: string;
  name: string;
  state: string;
  pop: number | null;
  /** New residential dwelling units approved in the trailing 12 months. */
  total12: number;
  houses12: number;
  /** Townhouses + apartments + other — everything that is not a detached house. */
  nonHouse12: number;
  /** Value of residential building approved in the trailing 12 months, AUD. */
  value12: number;
  /** Detached-house share of the trailing-12 dwellings. Null when total is 0. */
  houseShare: number | null;
  /** Dwellings approved per 10,000 residents (trailing 12 months). */
  rate: number | null;
  prev12: number;
  /** Year-on-year change in trailing-12 dwellings. */
  change: number | null;
  /** ~3-year change, for the trajectory view. */
  changeLong: number | null;
  /** Rolling 12-month dwelling totals, one per month (null until the window fills). */
  series: (number | null)[];
  /** Raw monthly dwelling totals (all residential) — for the drill-down. */
  mTot: number[];
  /** Raw monthly detached-house dwellings — for the drill-down. */
  mHouse: number[];
}

export interface StateSeries {
  code: string;
  state: string;
  tot: number[];
  house: number[];
  town: number[];
  apt: number[];
}

export interface National {
  aus: { tot: number[]; house: number[]; town: number[]; apt: number[] };
  states: StateSeries[];
}

export interface Meta {
  generated: string;
  months: string[];
  monthLabels: string[];
  latestMonth: string;
  latestMonthLabel: string;
  firstMonth: string;
  firstMonthLabel: string;
  window: number;
  erpYear: number;
  accordMonthlyTarget: number;
  accordStart: string;
  accordStartIndex: number;
  annotations: { month: string; text: string }[];
  national: {
    tot12: number;
    house12: number;
    town12: number;
    apt12: number;
    latestMonthly: number;
    peak12: number;
    peak12Month: string;
    accordAnnual: number;
  };
  counts: { regions: number; rated: number; suppressed: number; months: number; states: number };
  medians: { rate: number; houseShare: number; change: number; changeLong: number };
  source: Record<string, string>;
}

export interface Dataset {
  regions: Region[];
  national: National;
  meta: Meta;
}
