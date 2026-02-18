/**
 * Copy states, cities, localities from DEV → QA
 * Usage: node scripts/copy-geo-data.mjs --dev-pass DEV_PW --qa-pass QA_PW
 */

import pg from 'pg';
const { Client } = pg;

const DEV_REF = 'gkulyxglzqlhpqxlwjqw';
const QA_REF  = 'brgamwtcsnsnkdssyarn';

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
  };
  const devPass = get('--dev-pass');
  const qaPass  = get('--qa-pass');
  if (!devPass || !qaPass) {
    console.error('Usage: node scripts/copy-geo-data.mjs --dev-pass DEV_PW --qa-pass QA_PW');
    process.exit(1);
  }
  return { devPass, qaPass };
}

async function connect(ref, pass) {
  const encodedPass = encodeURIComponent(pass);
  const c = new Client({ connectionString: `postgresql://postgres:${encodedPass}@db.${ref}.supabase.co:5432/postgres` });
  await c.connect();
  return c;
}

async function copyTable(dev, qa, table, orderBy = 'id') {
  const { rows } = await dev.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
  if (rows.length === 0) { console.log(`  ${table}: 0 rows (skipped)`); return; }

  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(', ');

  // Build parameterised bulk insert
  const valuePlaceholders = rows.map((_, ri) =>
    '(' + cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', ') + ')'
  ).join(', ');
  const flatValues = rows.flatMap(row => cols.map(c => row[c]));

  await qa.query(
    `INSERT INTO ${table} (${colList}) VALUES ${valuePlaceholders} ON CONFLICT DO NOTHING`,
    flatValues
  );
  console.log(`  ${table}: ${rows.length} rows copied`);
}

async function main() {
  const { devPass, qaPass } = parseArgs();

  console.log('Connecting to DEV and QA...');
  const [dev, qa] = await Promise.all([
    connect(DEV_REF, devPass),
    connect(QA_REF,  qaPass),
  ]);

  try {
    console.log('\nCopying reference data...');
    await copyTable(dev, qa, 'states');
    await copyTable(dev, qa, 'cities');
    await copyTable(dev, qa, 'localities');
    await copyTable(dev, qa, 'subscription_tiers');
    await copyTable(dev, qa, 'hoardings');
    await copyTable(dev, qa, 'store_categories');
    console.log('\nDone!');
  } finally {
    await dev.end();
    await qa.end();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
