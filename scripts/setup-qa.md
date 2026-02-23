# QA Environment Setup Guide

## Supabase Projects
- **DEV**: `gkulyxglzqlhpqxlwjqw` → https://gkulyxglzqlhpqxlwjqw.supabase.co
- **QA**:  `brgamwtcsnsnkdssyarn` → https://brgamwtcsnsnkdssyarn.supabase.co

---

## Step 1 — Supabase CLI Login

You need a personal access token from: https://supabase.com/dashboard/account/tokens

```bash
npx supabase login
# This opens a browser — log in and paste the access token
```

---

## Step 2 — Export Full Schema from DEV

Get your DEV database password from:
> Supabase Dashboard → DEV Project → Settings → Database → Connection string → "URI" format

The password is the part between `postgres:` and `@` in the URI.

```bash
# From C:\Srini\dealpro\dev\dealpro
npx supabase db dump \
  --db-url "postgresql://postgres.[DEV_DB_PASSWORD_HERE]@db.gkulyxglzqlhpqxlwjqw.supabase.co:5432/postgres" \
  > scripts/schema-dump.sql
```

---

## Step 3 — Apply Schema to QA

Get your QA database password from:
> Supabase Dashboard → QA Project → Settings → Database

```bash
npx supabase db dump \
  --db-url "postgresql://postgres.[QA_DB_PASSWORD_HERE]@db.brgamwtcsnsnkdssyarn.supabase.co:5432/postgres" \
  --file scripts/schema-dump.sql \
  --restore
```

Or apply directly via psql (if installed):
```bash
psql "postgresql://postgres.[QA_DB_PASSWORD_HERE]@db.brgamwtcsnsnkdssyarn.supabase.co:5432/postgres" \
  < scripts/schema-dump.sql
```

### Alternative: Dashboard SQL Editor

If you prefer not to use the CLI:
1. DEV Project → SQL Editor → Run: `SELECT * FROM information_schema.tables WHERE table_schema = 'public'`
2. Or export via: DEV Project → Settings → Migrations → Export

---

## Step 4 — Apply Known Migrations to QA

Run these in QA SQL Editor (in order):

```
supabase/migrations/create_fcm_tokens_table.sql
supabase/migrations/create_pinned_deals_table.sql
supabase/migrations/create_campaign_approval_trigger.sql
supabase/migrations/add_unique_claim_no_constraint.sql
```

---

## Step 5 — Deploy Edge Functions to QA

```bash
# Link CLI to QA project
npx supabase link --project-ref brgamwtcsnsnkdssyarn

# Deploy all functions from supabase/functions/ directory
npx supabase functions deploy fetch-notifications --project-ref brgamwtcsnsnkdssyarn
npx supabase functions deploy get-hoardings --project-ref brgamwtcsnsnkdssyarn
npx supabase functions deploy manage-fcm-tokens --project-ref brgamwtcsnsnkdssyarn
npx supabase functions deploy manage-pinned-deals --project-ref brgamwtcsnsnkdssyarn
npx supabase functions deploy merchant-analytics --project-ref brgamwtcsnsnkdssyarn
npx supabase functions deploy send-new-deal-notification --project-ref brgamwtcsnsnkdssyarn
npx supabase functions deploy update-banners --project-ref brgamwtcsnsnkdssyarn
npx supabase functions deploy update-pushnotify-consent --project-ref brgamwtcsnsnkdssyarn
```

For the 50 root-level functions, deploy from the supabase/ root:
```bash
# Run from C:\Srini\dealpro\dev\dealpro\supabase\
npx supabase functions deploy login --project-ref brgamwtcsnsnkdssyarn
npx supabase functions deploy register-user --project-ref brgamwtcsnsnkdssyarn
# ... etc for each function listed in supabase/ root
```

---

## Step 6 — Set Edge Function Secrets in QA

From QA Project Dashboard → Settings → Edge Functions → Add Secret:

| Secret | Value |
|--------|-------|
| `SUPABASE_URL` | `https://brgamwtcsnsnkdssyarn.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(QA service role key from Settings → API)* |
| Any other secrets your functions use | *(same values as DEV or QA-specific)* |

---

## Step 7 — Verify .env.local in QA Directory

File already created at: `C:\Srini\dealpro\QA\dealpro\.env.local`

Contains QA Supabase URL and anon key.

---

## Ongoing Workflow

```
DEV (dev branch, dev\dealpro)
  ↓  test & validate
QA  (main branch, QA\dealpro)
  ← git merge dev   (when stable)
  ← push to origin/main
  ← deploy functions to QA project if changed
```
