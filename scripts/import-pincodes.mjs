// One-time importer for the India pincode directory → public.pincode_directory.
//
// Run the migration first (supabase/migrations/create_pincode_directory.sql),
// then:
//
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/import-pincodes.mjs [--reset] [path-or-url]
//
//   --reset        clear the table first (needed to re-import without duplicates)
//   path-or-url    optional data source; defaults to the dpnkrpl dataset (WTFPL,
//                  derived from India Post's OGD "All India Pincode Directory").
//
// Requires the service role key (bypasses RLS for the bulk insert). Node 18+.

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';

const DEFAULT_SOURCE =
  'https://raw.githubusercontent.com/dpnkrpl/indian-pincodes-database/master/data.json';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const source = args.find((a) => !a.startsWith('--')) || DEFAULT_SOURCE;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clean = (s) => (typeof s === 'string' ? s.trim() : '');

async function loadRows() {
  let raw;
  if (/^https?:\/\//.test(source)) {
    console.log(`Downloading ${source} …`);
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    raw = await res.text();
  } else {
    console.log(`Reading local file ${source} …`);
    raw = await readFile(source, 'utf8');
  }
  const json = JSON.parse(raw);
  // dpnkrpl format is { "Sheet1": [ ... ] }; also accept a bare array.
  const list = Array.isArray(json) ? json : json.Sheet1 || json.data || [];
  if (!Array.isArray(list)) throw new Error('Unrecognized dataset shape (no array found).');
  return list;
}

async function main() {
  const list = await loadRows();
  console.log(`Parsed ${list.length} raw records.`);

  // Normalize + keep only valid 6-digit pincodes with a locality name.
  const rows = [];
  for (const r of list) {
    const pincode = clean(r.Pincode || r.pincode);
    const locality = clean(r.PostOfficeName || r.officename || r.locality);
    if (!/^\d{6}$/.test(pincode) || !locality) continue;
    const district = clean(r.District || r.Districtname || r.district) || null;
    rows.push({
      pincode,
      locality,
      // Some sources (official India Post) have no City column — fall back to district.
      city: clean(r.City || r.city) || district || null,
      district,
      state: clean(r.State || r.statename || r.state) || null,
    });
  }
  console.log(`Kept ${rows.length} valid rows.`);

  const { count: existing } = await supabase
    .from('pincode_directory')
    .select('*', { count: 'exact', head: true });
  if (existing && existing > 0) {
    if (!reset) {
      console.error(
        `pincode_directory already has ${existing} rows. Re-run with --reset to clear and reload, ` +
        `or TRUNCATE public.pincode_directory in the SQL editor first.`,
      );
      process.exit(1);
    }
    console.log(`--reset: clearing ${existing} existing rows …`);
    const { error: delErr } = await supabase.from('pincode_directory').delete().gt('id', 0);
    if (delErr) throw delErr;
  }

  const BATCH = 1000;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('pincode_directory').insert(batch);
    if (error) throw new Error(`Insert failed at row ${i}: ${error.message}`);
    inserted += batch.length;
    if (i % (BATCH * 20) === 0 || inserted === rows.length) {
      console.log(`  inserted ${inserted}/${rows.length}`);
    }
  }

  console.log(`Done. Imported ${inserted} pincode records.`);
}

main().catch((e) => {
  console.error('Import failed:', e.message);
  process.exit(1);
});
