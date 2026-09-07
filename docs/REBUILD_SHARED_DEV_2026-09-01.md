# Rebuilding the shared DEV database — `hyijwfovsvetpyrbqfcd`

Context: on 2026-09-01 the shared DEV project `gkulyxglzqlhpqxlwjqw` was deleted.
It hosted vedicjaalam.com, ConsumerDEV and MerchantDEV. This rebuilds all three
on the new project **VedicJaalam / `hyijwfovsvetpyrbqfcd`**.

PROD (`trrinhrajmsnkjnwtncz`) was never affected and is the source for the schema.

**Before starting:** if Supabase restores `gkulyxglzqlhpqxlwjqw`, stop and merge
from the restore instead. Only a restore recovers *data*; this rebuilds structure.

---

## What this recovers, and what it does not

| | |
|---|---|
| Schema (100 tables, 40 functions, 109 policies, 213 indexes, 94 FKs) | recovered from PROD dump |
| Lookup data (states, cities, store_categories, subscription_tiers) | recovered from seed export |
| Edge functions (77 consumer / 95 merchant) | redeployed from git |
| **User accounts, merchants, deals, claims, all transactional rows** | **NOT recoverable — restore only** |
| **Storage objects (uploaded images/files)** | **NOT recoverable — restore only** |
| Vault secrets, edge function secrets, auth config | recreate by hand (steps 4–7) |

---

## Step 0 — Snapshot PROD first

Nothing below writes to PROD, but there is currently no backup you control.

```powershell
cd C:\Srini\dealpro\MerchantPROD\dealpro
node scripts/migrate-schema.mjs --source-ref trrinhrajmsnkjnwtncz --dev-pass "<PROD_DB_PASSWORD>" --dump-only
copy scripts\schema-dump.sql scripts\prod-schema-2026-09-01.sql
```

Keep that file somewhere off this machine.

---

## Step 1 — Apply the schema

`scripts/schema-dump.sql` (fresh from PROD, 2026-09-01) covers DealFynd **and**
25 of the 27 vedicjaalam.com tables. Audited clean: no embedded project URLs, no
embedded JWTs, no placeholder tokens.

Dashboard → `hyijwfovsvetpyrbqfcd` → SQL Editor → paste and run.

Verify:

```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- expect ~100
```

---

## Step 2 — The two tables the dump lacks

Only `00002` is not satisfied by the dump. **Do not run the original** — its
section 5 adds owner policies to `"VEDIC_profiles"` and `user_app_registry`,
which already arrive with the dump, so it aborts with:

```
42710: policy "profiles: owners can read all" for table "VEDIC_profiles" already exists
```

Run this trimmed, idempotent replacement instead, from
`C:\Srini\VedicJaalam\supabase\migrations`:

```
00002b_shared_services_and_subscriptions_ONLY.sql
```

It creates `shared_services` and `subscriptions` with their own triggers,
indexes, RLS and policies, seeds three sample services, and omits section 5.
Note `public.subscriptions` is the **website's** table (FKs to `VEDIC_profiles`,
`apps`, `shared_services`) — unrelated to DealFynd's `merchant_subscriptions`.

The other 18 migrations are already satisfied — do **not** replay them.

Verify:

```sql
SELECT to_regclass('public.shared_services') AS services,
       to_regclass('public.subscriptions')   AS subs,
       (SELECT count(*) FROM public.shared_services) AS seeded;
-- expect both non-null, seeded = 3

SELECT tablename, count(*) FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('shared_services','subscriptions')
GROUP BY tablename;
-- expect shared_services = 4, subscriptions = 5
```

---

## Step 3 — Seed the lookup tables

```powershell
cd C:\Srini\dealpro\MerchantPROD\dealpro
node scripts/migrate-schema.mjs --source-ref trrinhrajmsnkjnwtncz --dev-pass "<PROD_DB_PASSWORD>" --seed-data
```

Writes `scripts/seed-data.sql` (subscription_tiers, store_categories, states,
cities). Paste into the new project's SQL Editor.

Verify:

```sql
SELECT (SELECT count(*) FROM states)          AS states,
       (SELECT count(*) FROM cities)          AS cities,
       (SELECT count(*) FROM store_categories) AS categories,
       (SELECT count(*) FROM subscription_tiers) AS tiers;
-- expect roughly 28 / 279 / 32 / 5
```

### Step 3b — geo data (localities)

`seed-data.sql` deliberately excludes `localities` (large). The consumer app
needs it: locality search, the home-screen locality chip, and the
`search-localities-by-city` function all read it.

```powershell
node scripts/copy-geo-data.mjs `
  --source-ref trrinhrajmsnkjnwtncz --target-ref hyijwfovsvetpyrbqfcd `
  --dev-pass "<PROD_DB_PASSWORD>" --qa-pass "<NEW_PROJECT_DB_PASSWORD>"
```

`--source-ref` / `--target-ref` were added 2026-09-01; without them the script
targets the deleted DEV project. It copies states, cities, localities,
subscription_tiers, hoardings and store_categories with
`INSERT ... ON CONFLICT DO NOTHING`, so it is safe to re-run and will not
duplicate what step 3 already seeded.

Confirmed run 2026-09-01: 28 states, 279 cities, 489 localities, 5 tiers,
3 hoardings, 33 categories.

Still unseeded, and fine to leave: `pincode_directory` and `geocode_cache`
repopulate lazily (geocode_cache misses cost Google API calls until warm).

---

## Step 4 — Point the database at itself

Two triggers dispatch to edge functions. Neither hardcodes anything; they read
config, which is why the dump was safe to move. But config is data, so it is
empty on the new project.

`public.edge_function_url(fn)` builds the URL from `app_config.project_ref`:

```sql
INSERT INTO public.app_config (key, value)
VALUES ('project_ref', 'hyijwfovsvetpyrbqfcd')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

`public.app_secret_get('service_role_key')` reads Supabase **Vault**:

```sql
SELECT vault.create_secret('<NEW_PROJECT_SERVICE_ROLE_KEY>', 'service_role_key');
```

Until both exist, the affected paths log
`edge_function_url/service_role_key not configured — skipping` and continue.
Nothing breaks, but subscription renewal reminders and referral rewards will not
fire.

Verify:

```sql
SELECT public.edge_function_url('process-referral-reward') AS url,
       public.app_secret_get('service_role_key') IS NOT NULL AS has_key;
```

---

## Step 5 — Deploy edge functions

```powershell
npx supabase login
npx supabase link --project-ref hyijwfovsvetpyrbqfcd
```

Consumer (77) from `C:\Srini\dealpro\dev\dealpro`, merchant (95) from
`C:\Srini\dealpro\MerchantDEV\dealpro`. Use the existing helpers rather than
deploying one at a time — `scripts/deploy-all-functions.ps1`, `deploy-fn-dev.ps1`.

Check each script's target ref before running.

---

## Step 6 — Edge function secrets

Dashboard → Settings → Edge Functions. At minimum `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` for the new project, plus anything the functions
read (Razorpay, Resend, Cloudinary, Gemini keys).

Grep the function sources for `Deno.env.get(` to enumerate what is actually
required.

---

## Step 7 — Storage, auth, cron

- **Storage buckets and policies** — `scripts/copy-buckets.mjs` recreates buckets;
  objects themselves are gone unless restored.
- **Auth** — providers, redirect URLs, email templates.
- **pg_cron schedules** — not captured by the dump; recreate any jobs.

---

## Step 8 — Repoint the apps

`.env.local` in each of:

- `C:\Srini\VedicJaalam` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`
- `C:\Srini\dealpro\dev\dealpro` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `C:\Srini\dealpro\MerchantDEV\dealpro` — same
- `C:\Srini\dealpro\MerchantWeb\dealpro` — same

All four currently point at the deleted `gkulyxglzqlhpqxlwjqw`.

**Do not touch** `ConsumerPROD` or `MerchantPROD` — they use
`trrinhrajmsnkjnwtncz` and are unaffected.

vedicjaalam.com is deployed on Vercel: update the environment variables there
too, then redeploy. Local `.env.local` changes do not reach production.

---

## Credentials to rotate when the rebuild is finished

- **PROD database password** — exposed in terminal screenshots on 2026-09-01.
- **New DEV project database password** — was set to the same value as PROD.
  Give them different passwords; a single leak currently reaches both.

Nothing but these scripts uses the DB password (the apps authenticate with
anon/service keys), so rotating only means re-running commands with the new one.

## Known drift

- `dealpro_test_plan_summary` is referenced by a policy in `00008` but defined
  nowhere in the repo — created by hand in the dashboard. Recreate it if the test
  tooling needs it.
- The DEV project had drifted from PROD in unknown ways. This rebuild produces a
  DEV database shaped like PROD, which is generally an improvement but is not a
  faithful reproduction of what was lost.
