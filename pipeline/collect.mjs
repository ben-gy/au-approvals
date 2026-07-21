// Fetch the raw ABS sources into pipeline/tmp/. No shaping here — that lives in
// parse.mjs so it can be unit-tested without the network.
//
// Sources (all free, no auth):
//   1. ABS Building Approvals BA_SA2 dataflow — New residential dwelling units:
//        · SA3 total(100) + houses(110)         — the region grain
//        · SA3 value(measure 2, total 100)       — dollars approved
//        · AUS total/house/townhouse/apartment   — national density mix
//        · STE total/house/townhouse/apartment   — per-state mix
//   2. ABS ERP by SA3 (TOT age)                  — the per-capita denominator
//   3. ABS ASGS 2021 SA3 boundaries              — real polygons, ArcGIS paged

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TMP = join(import.meta.dirname, 'tmp');
mkdirSync(TMP, { recursive: true });

const BA = 'https://data.api.abs.gov.au/rest/data/ABS,BA_SA2/';
const ERP = 'https://data.api.abs.gov.au/rest/data/ERP_ASGS2021/ERP.3.TOT.SA3..A?startPeriod=';
const SA3_GEO = 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/SA3/MapServer/1/query';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const HEADERS = {
  'user-agent': UA,
  accept: 'application/vnd.sdmx.data+csv, text/csv, */*',
  'accept-language': 'en-AU,en;q=0.9',
};

const ATTEMPT_TIMEOUT_MS = 120_000;

async function fetchText(url, { accept } = {}) {
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, {
        headers: { ...HEADERS, ...(accept ? { accept } : {}) },
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      if (res.status === 404) return ''; // no observations for this slice
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      const wait = 4000 * 2 ** i;
      console.log(`  retry ${i + 1}/4 in ${wait}ms — ${err.message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

const csv = 'application/vnd.sdmx.data+csv';

async function fetchSA3Geo() {
  const feats = [];
  const pageSize = 200;
  for (let offset = 0; offset < 2000; offset += pageSize) {
    const url =
      SA3_GEO +
      '?where=1%3D1&outFields=sa3_code_2021,sa3_name_2021&outSR=4326' +
      '&resultRecordCount=' + pageSize + '&resultOffset=' + offset + '&f=geojson';
    const gj = JSON.parse(await fetchText(url, { accept: 'application/json' }));
    const got = gj.features ?? [];
    feats.push(...got);
    console.log(`  SA3 boundaries offset ${offset} -> ${got.length} (total ${feats.length})`);
    if (got.length < pageSize) break;
  }
  if (feats.length < 300) throw new Error(`only ${feats.length} SA3 polygons — refusing to ship`);
  return { type: 'FeatureCollection', features: feats };
}

async function main() {
  // 1a. SA3 dwelling units: total residential + houses, full monthly history
  console.log('1/6 SA3 dwellings (total + houses)...');
  const sa3 = await fetchText(BA + '1.9.1.100+110.SA3..M', { accept: csv });
  writeFileSync(join(TMP, 'ba_sa3.csv'), sa3);
  console.log(`  ${sa3.split('\n').length} lines`);

  // 1b. SA3 value of residential building approved
  console.log('2/6 SA3 value (total residential)...');
  const sa3val = await fetchText(BA + '2.9.1.100.SA3..M', { accept: csv });
  writeFileSync(join(TMP, 'ba_sa3_value.csv'), sa3val);
  console.log(`  ${sa3val.split('\n').length} lines`);

  // 1c. National density mix
  console.log('3/6 National mix (houses/townhouses/apartments)...');
  const aus = await fetchText(BA + '1.9.1.100+110+120+130.AUS..M', { accept: csv });
  writeFileSync(join(TMP, 'ba_aus.csv'), aus);
  console.log(`  ${aus.split('\n').length} lines`);

  // 1d. Per-state density mix
  console.log('4/6 State mix (houses/townhouses/apartments)...');
  const ste = await fetchText(BA + '1.9.1.100+110+120+130.STE..M', { accept: csv });
  writeFileSync(join(TMP, 'ba_ste.csv'), ste);
  console.log(`  ${ste.split('\n').length} lines`);

  // 2. ERP by SA3
  console.log('5/6 ABS ERP by SA3 (TOT age)...');
  const startYear = new Date().getUTCFullYear() - 3;
  const erp = await fetchText(ERP + startYear, { accept: 'text/csv' });
  writeFileSync(join(TMP, 'erp.csv'), erp);
  console.log(`  ${erp.split('\n').length} lines`);

  // 3. SA3 boundaries
  console.log('6/6 ABS ASGS 2021 SA3 boundaries...');
  const geo = await fetchSA3Geo();
  writeFileSync(join(TMP, 'sa3-raw.geojson'), JSON.stringify(geo));
  console.log(`  ${geo.features.length} polygons`);

  console.log('collect done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
