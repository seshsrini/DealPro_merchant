/**
 * Copy Storage buckets DEV → PROD via the Storage API (service-role key).
 * Raw SQL can't create buckets (storage.buckets is owned by
 * supabase_storage_admin → 42501), so we use the supported API instead.
 *
 * Usage (service-role keys are SECRET — keep them in your terminal, not in chat):
 *   node scripts/copy-buckets.mjs --dev-key <DEV_SERVICE_ROLE> --prod-key <PROD_SERVICE_ROLE>
 *
 * Get the keys from each project: Dashboard → Project Settings → API →
 * "service_role" secret. (NOT the anon key.)
 */
import { createClient } from '@supabase/supabase-js';

const getArg = (n) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : null; };

const DEV_URL  = getArg('--dev-url')  || 'https://gkulyxglzqlhpqxlwjqw.supabase.co';
const PROD_URL = getArg('--prod-url') || 'https://lpypcdshtiwkxkelepnl.supabase.co';
const DEV_KEY  = getArg('--dev-key');
const PROD_KEY = getArg('--prod-key');

if (!DEV_KEY || !PROD_KEY) {
  console.error('Usage: node scripts/copy-buckets.mjs --dev-key <DEV_SERVICE_ROLE> --prod-key <PROD_SERVICE_ROLE>');
  process.exit(1);
}

const dev  = createClient(DEV_URL, DEV_KEY);
const prod = createClient(PROD_URL, PROD_KEY);

const { data: buckets, error } = await dev.storage.listBuckets();
if (error) { console.error('Failed to list DEV buckets:', error.message); process.exit(1); }
console.log(`Found ${buckets.length} bucket(s) in DEV: ${buckets.map(b => b.name).join(', ')}\n`);

for (const b of buckets) {
  const opts = {
    public: b.public,
    fileSizeLimit: b.file_size_limit ?? undefined,
    allowedMimeTypes: b.allowed_mime_types ?? undefined,
  };
  const { error: e } = await prod.storage.createBucket(b.name, opts);
  if (e) {
    if (/already exists|duplicate/i.test(e.message)) console.log(`  = ${b.name} (already exists — skipped)`);
    else console.warn(`  x ${b.name}: ${e.message}`);
  } else {
    console.log(`  + created ${b.name} (public=${b.public})`);
  }
}
console.log('\nDone.');
