# Maestro UI Auto-Tests — Setup Guide

End-to-end UI tests for the merchant app, triggered from the VedicJaalam
dashboard's **Run Auto Tests** button (admin/owner only). Each Maestro flow
runs on a real Android emulator inside GitHub Actions, captures step
screenshots, and live-reports its verdict back to the dashboard report page.

## Architecture

```
VedicJaalam dashboard (admin clicks "Run Auto Tests")
        │
        ▼
POST /api/dealpro-test-plan-results/auto-test/trigger
   • Creates a row in dealpro_test_plan_runs (status=queued)
   • Calls GitHub workflow_dispatch on this repo
        │
        ▼
.github/workflows/maestro-tests.yml
   • Builds debug APK, boots Android emulator
   • For each tests/maestro/*.yaml:
       1. POST flow_started  →  status=running on the report page
       2. Run `maestro test`, capture screenshots
       3. Upload screenshots to Supabase Storage
       4. POST flow_finished →  status=pass|fail + screenshot URLs
        │
        ▼
VedicJaalam /api/dealpro-test-plan-results/auto-test/report (HMAC-verified)
   • Upserts dealpro_test_plan_results rows under the auto-test-bot user
   • Updates dealpro_test_plan_runs with final totals
```

The dashboard report page auto-polls every 5 seconds while a run is active, so
flows light up green/red the moment they finish.

---

## Required GitHub Actions repo secrets

Set these in **Settings → Secrets and variables → Actions** for this repo:

| Secret | Purpose |
|---|---|
| `SUPABASE_URL` | Used by `run-flows.cjs` to upload screenshots |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for Supabase Storage upload |
| `SUPABASE_SCREENSHOT_BUCKET` | (optional) defaults to `auto-test-screenshots` |

> The `report_url` and `report_secret` are passed in via `workflow_dispatch`
> inputs by the dashboard — no secret config on the repo side.

---

## Required Vercel env vars (VedicJaalam)

Set these in the VedicJaalam Vercel project (Production + Preview):

| Env var | Value | Why |
|---|---|---|
| `GITHUB_PAT_AUTO_TEST` | Fine-grained PAT with `actions:write` scope on the merchant + consumer repos | Needed to call `workflow_dispatch` |
| `AUTO_TEST_HMAC_SECRET` | Random 32+ byte hex string — **must match the secret used by GitHub Actions** | HMAC-signs callback bodies so only the runner can write to the report endpoint |
| `DEALPRO_MERCHANT_REPO` | e.g. `seshsrini/dealpro-merchant` | Target repo for the merchant `workflow_dispatch` |
| `DEALPRO_CONSUMER_REPO` | e.g. `seshsrini/dealpro-consumer` | Target repo for the consumer `workflow_dispatch` |

Generate the HMAC secret with: `openssl rand -hex 32`. Save the same value
twice — once in Vercel, once you'll pass via GitHub Actions inputs (the
dashboard relays it automatically, so there's no GitHub secret to set for it).

---

## Required Supabase setup

1. **Storage bucket**: create a bucket named `auto-test-screenshots` and mark
   it **public**. The `run-flows.cjs` uploader writes objects with `x-upsert`
   so re-runs overwrite the same path.

2. **Database migration**: apply
   `supabase/migrations/00009_dealpro_test_plan_auto_test.sql` from the
   VedicJaalam repo. This adds the `running` status, the `is_auto_test` /
   `run_id` / `screenshot_urls` / `duration_ms` / `started_at` columns, and
   the `dealpro_test_plan_runs` table.

3. **Auto-test bot user**: created lazily on first callback. The
   `/auto-test/report` endpoint looks up `auto-test-bot@vedicjaalam.com` and
   creates it via `supabaseAdmin.auth.admin.createUser` if missing. No manual
   step needed.

---

## Phone-number test bypasses

The auto-test bot signs in with `3333333333` (added alongside the existing
`7777777777`, `9999999999`, etc). These numbers:

- Skip the `+91` starting-digit validation in `AuthStack.tsx`
- Skip the Firebase OTP round-trip — the app jumps straight to the
  authenticated state

Make sure the corresponding edge functions (`verify-merchant-otp`,
`signup-consumer`, etc.) also include `3333333333` in their bypass list, or
the round-trip will fail at the server.

---

## Adding a new Maestro flow

1. Pick a test ID from `public/data/dealpro-test-plan.json` (e.g. `M-DEAL-04`).
2. Create `tests/maestro/<test_id>__<short-slug>.yaml`. The `__` separator
   is required — `run-flows.cjs` uses it to extract the test ID from the
   filename.
3. Use shared env vars from `tests/maestro/config.yaml`:
   ```yaml
   - inputText: ${AUTO_TEST_PHONE}
   ```
4. End the flow with a `takeScreenshot` so the report has visible evidence.
5. Push to `main` (or any branch — the dashboard accepts a `branch` input).

Order is alphabetical: prefix with the test ID and Maestro will run flows in
plan order naturally.

---

## Local dry-run (without GitHub Actions)

```bash
# Install Maestro CLI
curl -Ls "https://get.maestro.mobile.dev" | bash

# Boot any Android emulator (e.g. via Android Studio AVD Manager)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Run one flow
maestro test tests/maestro/M-AUTH-01__signup-happy-path.yaml

# Run the whole suite (without the callback POSTs)
maestro test tests/maestro/
```

To exercise the callback path locally, set `RUN_ID`, `REPORT_URL`,
`REPORT_SECRET` and run `node .github/scripts/run-flows.cjs` — same script
the workflow uses.

---

## Where to look when a run breaks

| Symptom | Where to look |
|---|---|
| Dashboard button errors with 500 | Vercel logs for `/api/.../auto-test/trigger`. Usually a missing env var. |
| Dashboard button errors with 502 (`GitHub dispatch failed`) | PAT scope or `WORKFLOW_FILE` path mismatch. The PAT needs `actions:write`. |
| Run sits at `queued` forever | The workflow never started. Check the repo's Actions tab for a failed `workflow_dispatch`. |
| Run flips to `running` but flows never appear | `report.cjs` is failing to POST. Check the workflow log for `[report] flow_started FAILED (401)` — usually means the HMAC secret doesn't match between Vercel and the dashboard. |
| Flows show as `fail` with no notes | Maestro found no matching elements. The expanded row links to the GitHub run for full logs + the debug-output artifacts. |
| Screenshots missing | Supabase Storage bucket missing or `SUPABASE_SERVICE_ROLE_KEY` wrong on the runner. Flow status itself still reports correctly. |
