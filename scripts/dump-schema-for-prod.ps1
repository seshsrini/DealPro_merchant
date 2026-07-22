# Dump the LIVE schema and audit it before applying to a new PROD database.
#
# Why not just use scripts/schema-dump.sql? That committed file is stale — it is
# missing merchant_profiles and geocode_cache entirely and lacks the extended
# merchant_stores columns. Building PROD from it yields a database the code cannot
# run against. Always dump from the live database.
#
# Usage (read-only against the source DB):
#   .\scripts\dump-schema-for-prod.ps1 -DbUrl "postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres"
#   .\scripts\dump-schema-for-prod.ps1 -DbUrl "..." -OutFile prod-schema.sql
#
# Get the connection string from: Dashboard -> Settings -> Database -> Connection string (URI).

param(
  [Parameter(Mandatory = $true)] [string] $DbUrl,
  [string] $OutFile = "prod-schema.sql"
)

Write-Host "-> Dumping schema (structure only, public schema)..." -ForegroundColor Cyan
npx supabase db dump --db-url $DbUrl --schema public -f $OutFile
if ($LASTEXITCODE -ne 0) {
  Write-Host "Dump failed. Check the connection string and that the Supabase CLI is available." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $OutFile)) {
  Write-Host "Dump reported success but $OutFile was not created." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "=== AUDIT: things that must NOT be carried into PROD as-is ===" -ForegroundColor Yellow

# A dashboard-created webhook is a real Postgres trigger, so pg_dump DOES capture
# it -- URL and service_role key included. Applying such a dump to PROD recreates a
# PROD table whose trigger calls the DEV project. This is exactly how a bad
# campaigns trigger URL took deal creation down (libcurl error 21).
$refHits = Select-String -Path $OutFile -Pattern '[a-z]{20}\.supabase\.co' -AllMatches
if ($refHits) {
  $refs = $refHits.Matches.Value | Sort-Object -Unique
  Write-Host "  [!] Project URLs embedded in the dump (triggers/webhooks):" -ForegroundColor Red
  $refs | ForEach-Object { Write-Host "        $_" -ForegroundColor Red }
  Write-Host "      -> Repoint every one at the PROD project before applying." -ForegroundColor Red
} else {
  Write-Host "  [ok] No project URLs embedded." -ForegroundColor Green
}

# JWTs (service_role / anon keys) baked into trigger definitions. Count only --
# never print them.
$jwtCount = (Select-String -Path $OutFile -Pattern 'eyJ[A-Za-z0-9_-]{10,}' -AllMatches |
             ForEach-Object { $_.Matches.Count } | Measure-Object -Sum).Sum
if ($jwtCount -gt 0) {
  Write-Host "  [!] $jwtCount embedded JWT/API key(s) found (values hidden)." -ForegroundColor Red
  Write-Host "      -> These are almost certainly service_role keys inside webhook triggers." -ForegroundColor Red
  Write-Host "      -> Replace with the PROD key, and ROTATE the source key: it is now in a file." -ForegroundColor Red
} else {
  Write-Host "  [ok] No embedded JWTs." -ForegroundColor Green
}

# Placeholders that must never reach a database. A runnable placeholder is worse
# than a missing one: it installs silently and fails at runtime.
$ph = Select-String -Path $OutFile -Pattern 'YOUR_PROJECT_REF|YOUR_SERVICE_ROLE_KEY|<PROJECT_REF>|<SERVICE_ROLE_KEY>'
if ($ph) {
  Write-Host "  [!] Placeholder tokens present -- do NOT apply until replaced:" -ForegroundColor Red
  $ph | ForEach-Object { Write-Host "        line $($_.LineNumber): $($_.Line.Trim())" -ForegroundColor Red }
} else {
  Write-Host "  [ok] No placeholder tokens." -ForegroundColor Green
}

Write-Host ""
Write-Host "=== NOT captured by this dump -- set up manually on PROD ===" -ForegroundColor Yellow
Write-Host "  * Per-database settings the triggers read:"
Write-Host "      ALTER DATABASE postgres SET app.settings.project_ref      = '<prod-ref>';"
Write-Host "      ALTER DATABASE postgres SET app.settings.service_role_key = '<prod-key>';"
Write-Host "  * Edge function secrets (Dashboard -> Settings -> Edge Functions)"
Write-Host "  * Storage buckets / policies, and any cron (pg_cron) schedules"
Write-Host "  * Auth settings: providers, redirect URLs, email templates"
Write-Host ""
Write-Host "Wrote $OutFile -- review it before applying. See docs/PROD_SETUP_CHECKLIST.md" -ForegroundColor Green
