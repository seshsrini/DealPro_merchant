/**
 * Schema Migration Script: DEV → QA
 * Usage: node scripts/migrate-schema.mjs --dev-pass DEV_PASSWORD --qa-pass QA_PASSWORD
 *        node scripts/migrate-schema.mjs --qa-pass QA_PASSWORD --apply-only   (skip DEV dump, apply existing schema-dump.sql)
 */

import pkg from 'pg';
const { Client } = pkg;
import { readFileSync as readFS, existsSync as existsFS, writeFileSync as writeFS } from 'fs';

const args = process.argv.slice(2);
const getArg = (name) => { const idx = args.indexOf(name); return idx !== -1 ? args[idx + 1] : null; };
const hasFlag = (name) => args.includes(name);

const DEV_PASS  = getArg('--dev-pass');
const QA_PASS   = getArg('--qa-pass');
const APPLY_ONLY = hasFlag('--apply-only');

if (!QA_PASS || (!DEV_PASS && !APPLY_ONLY)) {
  console.error('Usage:');
  console.error('  node scripts/migrate-schema.mjs --dev-pass DEV_PASSWORD --qa-pass QA_PASSWORD');
  console.error('  node scripts/migrate-schema.mjs --qa-pass QA_PASSWORD --apply-only');
  process.exit(1);
}

const encodedDevPass = DEV_PASS ? encodeURIComponent(DEV_PASS) : '';
const encodedQaPass  = encodeURIComponent(QA_PASS);
const DEV_URL = `postgresql://postgres:${encodedDevPass}@db.gkulyxglzqlhpqxlwjqw.supabase.co:5432/postgres`;
const QA_URL  = `postgresql://postgres:${encodedQaPass}@db.brgamwtcsnsnkdssyarn.supabase.co:5432/postgres`;

async function safeQuery(client, label, sql, params = []) {
  try {
    const result = params.length ? await client.query(sql, params) : await client.query(sql);
    console.log(`  ✓ ${label}: ${result.rows.length} rows`);
    return result.rows;
  } catch (err) {
    console.warn(`  ✗ ${label} failed: ${err.message}`);
    return [];
  }
}

async function dumpSchema(devUrl) {
  console.log('\nConnecting to DEV database...');
  const c = new Client({ connectionString: devUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log('Connected. Extracting schema...\n');

  // --- Sequences (must exist before tables that use SERIAL/nextval) ---
  const sequences = await safeQuery(c, 'Sequences', `
    SELECT 'CREATE SEQUENCE IF NOT EXISTS public.' || quote_ident(sequence_name) ||
      ' START WITH ' || start_value ||
      ' INCREMENT BY ' || increment ||
      ' MINVALUE ' || minimum_value ||
      ' MAXVALUE ' || maximum_value ||
      CASE WHEN cycle_option = 'YES' THEN ' CYCLE' ELSE ' NO CYCLE' END || ';' AS ddl
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name
  `);

  // --- ENUM types (must come before tables) ---
  const enumTypes = await safeQuery(c, 'ENUM types', `
    SELECT
      'CREATE TYPE public.' || quote_ident(t.typname) || ' AS ENUM (' ||
      string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) ||
      ');' AS ddl
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname
  `);

  // --- Tables ---
  const tables = await safeQuery(c, 'Tables', `
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const tableDDLs = [];
  for (const { table_name } of tables) {
    const cols = await safeQuery(c, `Columns(${table_name})`,
      `SELECT column_name, udt_name, character_maximum_length, numeric_precision, numeric_scale, column_default, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [table_name]);

    if (!cols || cols.length === 0) continue;

    const colDefs = cols.map(col => {
      // Use full type name for ENUMs and arrays
      let type = col.udt_name.startsWith('_') ? col.udt_name.slice(1) + '[]' : col.udt_name;
      if (col.character_maximum_length) type += `(${col.character_maximum_length})`;
      else if (col.numeric_precision && ['numeric','decimal'].includes(col.udt_name))
        type += `(${col.numeric_precision},${col.numeric_scale})`;
      const def = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      const nullable = col.is_nullable === 'NO' ? ' NOT NULL' : '';
      return `  ${col.column_name} ${type}${def}${nullable}`;
    });

    tableDDLs.push(`CREATE TABLE IF NOT EXISTS public.${table_name} (\n${colDefs.join(',\n')}\n);`);
  }

  // --- Primary Keys ---
  const pkeys = await safeQuery(c, 'Primary keys', `
    SELECT 'ALTER TABLE public.' || quote_ident(tc.table_name) ||
      ' ADD CONSTRAINT ' || quote_ident(tc.constraint_name) ||
      ' PRIMARY KEY (' || string_agg(quote_ident(kcu.column_name), ', ' ORDER BY kcu.ordinal_position) || ');' AS ddl
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
    GROUP BY tc.table_name, tc.constraint_name ORDER BY tc.table_name
  `);

  // --- Unique Constraints ---
  const uniques = await safeQuery(c, 'Unique constraints', `
    SELECT 'ALTER TABLE public.' || quote_ident(tc.table_name) ||
      ' ADD CONSTRAINT ' || quote_ident(tc.constraint_name) ||
      ' UNIQUE (' || string_agg(quote_ident(kcu.column_name), ', ' ORDER BY kcu.ordinal_position) || ');' AS ddl
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'UNIQUE'
    GROUP BY tc.table_name, tc.constraint_name ORDER BY tc.table_name
  `);

  // --- Foreign Keys ---
  const fkeys = await safeQuery(c, 'Foreign keys', `
    SELECT 'ALTER TABLE public.' || quote_ident(tc.table_name) ||
      ' ADD CONSTRAINT ' || quote_ident(tc.constraint_name) ||
      ' FOREIGN KEY (' || string_agg(quote_ident(kcu.column_name), ', ') || ')' ||
      ' REFERENCES public.' || quote_ident(ccu.table_name) ||
      ' (' || string_agg(quote_ident(ccu.column_name), ', ') || ');' AS ddl
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    GROUP BY tc.table_name, tc.constraint_name, ccu.table_name
  `);

  // --- Indexes ---
  const indexes = await safeQuery(c, 'Indexes', `
    SELECT indexdef || ';' AS ddl FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname NOT IN (
        SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = 'public'
      )
    ORDER BY tablename, indexname
  `);

  // --- Functions (one at a time, exclude extension-provided functions like PostGIS) ---
  const funcNames = await safeQuery(c, 'Function names', `
    SELECT p.oid, p.proname FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        JOIN pg_extension e ON e.oid = d.refobjid
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
    ORDER BY p.proname
  `);

  const functions = [];
  for (const { oid, proname } of funcNames) {
    try {
      const r = await c.query('SELECT pg_get_functiondef($1) AS ddl', [oid]);
      functions.push(r.rows[0].ddl + ';');
    } catch (err) {
      console.warn(`  ✗ Function ${proname}: ${err.message}`);
    }
  }
  console.log(`  ✓ Functions: ${functions.length}/${funcNames.length} retrieved`);

  // --- Triggers ---
  // Note: action_statement already contains 'EXECUTE FUNCTION/PROCEDURE ...'
  const triggers = await safeQuery(c, 'Triggers', `
    SELECT 'CREATE OR REPLACE TRIGGER ' || quote_ident(trigger_name) ||
      ' ' || action_timing || ' ' || event_manipulation ||
      ' ON public.' || quote_ident(event_object_table) ||
      ' FOR EACH ' || action_orientation ||
      ' ' || action_statement || ';' AS ddl
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name
  `);

  // --- RLS ---
  const rlsEnable = await safeQuery(c, 'RLS enable', `
    SELECT 'ALTER TABLE public.' || quote_ident(tablename) || ' ENABLE ROW LEVEL SECURITY;' AS ddl
    FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true ORDER BY tablename
  `);

  const rlsPolicies = await safeQuery(c, 'RLS policies', `
    SELECT 'CREATE POLICY ' || quote_ident(policyname) ||
      ' ON public.' || quote_ident(tablename) ||
      ' AS ' || permissive || ' FOR ' || cmd ||
      CASE WHEN roles IS NOT NULL THEN ' TO ' || array_to_string(roles, ', ') ELSE '' END ||
      CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END ||
      CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END ||
      ';' AS ddl
    FROM pg_policies WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `);

  await c.end();

  const parts = [
    `-- Schema dump: DEV → QA`,
    `-- Generated: ${new Date().toISOString()}`,
    '',
    '-- EXTENSIONS',
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
    'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
    'CREATE EXTENSION IF NOT EXISTS "postgis";',
    '',
    '-- SEQUENCES (must exist before tables with SERIAL columns)',
    ...sequences.map(r => r.ddl),
    '',
    '-- ENUM TYPES (must exist before tables)',
    ...enumTypes.map(r => r.ddl),
    '',
    '-- TABLES',
    ...tableDDLs.map(d => d + '\n'),
    '-- PRIMARY KEYS',
    ...pkeys.map(r => r.ddl),
    '',
    '-- UNIQUE CONSTRAINTS',
    ...uniques.map(r => r.ddl),
    '',
    '-- FOREIGN KEYS',
    ...fkeys.map(r => r.ddl),
    '',
    '-- INDEXES',
    ...indexes.map(r => r.ddl),
    '',
    '-- FUNCTIONS',
    ...functions.map(f => f + '\n'),
    '-- TRIGGERS',
    ...triggers.map(r => r.ddl),
    '',
    '-- RLS',
    ...rlsEnable.map(r => r.ddl),
    '',
    ...rlsPolicies.map(r => r.ddl),
  ];

  const sql = parts.join('\n');
  writeFS('scripts/schema-dump.sql', sql);
  console.log(`\n✓ Schema written to scripts/schema-dump.sql`);
  console.log(`  ${sequences.length} sequences, ${enumTypes.length} enums, ${tableDDLs.length} tables, ${functions.length} functions, ${rlsPolicies.length} policies`);
  return sql;
}

/**
 * Split SQL into statements, correctly handling $$ and $tag$ dollar-quoting
 * so multi-line function bodies are not broken apart.
 */
function splitSql(sql) {
  const statements = [];
  let current = '';
  let dollarTag = null; // null = outside, string = inside dollar-quote with this tag

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    current += ch;

    // Detect start/end of dollar-quoting: $word$ or $$
    if (ch === '$') {
      const rest = sql.slice(i);
      const match = rest.match(/^\$([a-zA-Z_0-9]*)\$/);
      if (match) {
        const tag = match[0]; // e.g. '$$' or '$function$'
        if (dollarTag === null) {
          dollarTag = tag;
          // Add the rest of the tag chars to current
          for (let j = 1; j < tag.length; j++) { current += sql[++i]; }
        } else if (dollarTag === tag) {
          dollarTag = null;
          for (let j = 1; j < tag.length; j++) { current += sql[++i]; }
        }
        continue;
      }
    }

    // Statement ends at ; only when not inside a dollar-quote
    if (ch === ';' && dollarTag === null) {
      const stmt = current.trim();
      if (stmt.length > 1 && !/^--/.test(stmt)) {
        statements.push(stmt);
      }
      current = '';
    }
  }

  // Catch any trailing statement
  if (current.trim().length > 1) statements.push(current.trim());
  return statements;
}

async function applySchema(qaUrl, sql) {
  console.log('\nConnecting to QA database...');
  const c = new Client({ connectionString: qaUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log('Applying schema to QA...\n');

  // --- Pre-check: PostGIS ---
  // Previous migration runs may have dumped 700+ PostGIS C-functions into public schema.
  // Those orphaned objects block CREATE EXTENSION postgis. We do a full cleanup first.
  try {
    await c.query('SELECT NULL::geography');
    console.log('  ✓ PostGIS (geography type) already available');
  } catch (_) {
    console.log('  PostGIS not active — running full PostGIS cleanup and install...');

    // 1. Drop ALL non-extension-owned functions in public schema.
    //    This removes all orphaned PostGIS functions (700+) from previous migrations.
    //    User-defined functions are few and will be restored later by the migration.
    await c.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN (
          SELECT proname, pg_get_function_identity_arguments(oid) AS args
          FROM pg_proc
          WHERE pronamespace = 'public'::regnamespace
            AND NOT EXISTS (
              SELECT 1 FROM pg_depend d
              WHERE d.objid = pg_proc.oid AND d.deptype = 'e'
            )
        ) LOOP
          BEGIN
            EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.proname, r.args);
          EXCEPTION WHEN OTHERS THEN NULL; END;
        END LOOP;
      END $$
    `);

    // 3. Drop orphaned PostGIS types and tables
    for (const stmt of [
      'DROP TABLE IF EXISTS public.spatial_ref_sys CASCADE',
      'DROP VIEW IF EXISTS public.geometry_columns CASCADE',
      'DROP VIEW IF EXISTS public.geography_columns CASCADE',
      'DROP TYPE IF EXISTS public.geometry CASCADE',
      'DROP TYPE IF EXISTS public.geography CASCADE',
      'DROP TYPE IF EXISTS public.box2d CASCADE',
      'DROP TYPE IF EXISTS public.box3d CASCADE',
    ]) {
      try { await c.query(stmt); } catch (_) {}
    }

    // 4. Now create the extension
    try {
      await c.query('CREATE EXTENSION IF NOT EXISTS "postgis"');
      console.log('  ✓ PostGIS extension installed');
    } catch (err2) {
      console.warn(`  ⚠ PostGIS install still failed: ${err2.message}`);
      console.warn('  → Try enabling PostGIS in Supabase Dashboard → Database → Extensions');
    }
  }

  const statements = splitSql(sql);
  console.log(`  Parsed ${statements.length} statements`);

  let ok = 0, skip = 0;
  for (const stmt of statements) {
    if (stmt.startsWith('--')) { skip++; continue; }
    // Skip extension creation — already handled above
    if (/^CREATE EXTENSION/i.test(stmt)) { skip++; continue; }
    try {
      await c.query(stmt);
      ok++;
    } catch (err) {
      // Silently skip "already exists" errors
      if (['42P07','42710','42723','42P16','42704'].includes(err.code)) {
        skip++;
      } else {
        console.warn(`  [SKIP] ${err.message.substring(0, 120)}`);
        skip++;
      }
    }
  }

  await c.end();
  console.log(`\n✓ Applied: ${ok} succeeded, ${skip} skipped`);
}

try {
  let sql;
  if (APPLY_ONLY) {
    if (!existsFS('scripts/schema-dump.sql')) {
      console.error('❌ scripts/schema-dump.sql not found. Run without --apply-only first.');
      process.exit(1);
    }
    sql = readFS('scripts/schema-dump.sql', 'utf8');
    console.log('Using existing scripts/schema-dump.sql');
  } else {
    sql = await dumpSchema(DEV_URL);
  }

  await applySchema(QA_URL, sql);
  console.log('\n✅ Schema migration complete!');
  console.log('Next: bash scripts/deploy-functions-qa.sh');
} catch (err) {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
}
