# Deploy ALL Edge Functions to PROD (PowerShell) — discovers functions
# dynamically so none are missed. Re-running is safe (idempotent).
#
# Prereq:  npx supabase login   (once)
# Run from a repo root that has supabase/ functions:
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-functions-prod.ps1
# The DB is shared, so if your CONSUMER repo has functions this one doesn't,
# run this from that repo too (overlap just re-deploys — harmless).

$ErrorActionPreference = "Continue"
$PROD_REF  = "lpypcdshtiwkxkelepnl"
$FN_DIR    = "supabase/functions"
$importMap = Join-Path $FN_DIR "import_map.json"
$hasImportMap = Test-Path $importMap

New-Item -ItemType Directory -Force -Path $FN_DIR | Out-Null
if (Test-Path "supabase/_shared") {
  Copy-Item -Recurse -Force "supabase/_shared" (Join-Path $FN_DIR "_shared")
}

function Deploy-One($name) {
  Write-Host "-> Deploying $name ..."
  if ($hasImportMap) {
    npx supabase functions deploy $name --project-ref $PROD_REF --no-verify-jwt --import-map $importMap
    if ($LASTEXITCODE -ne 0) {
      npx supabase functions deploy $name --project-ref $PROD_REF --no-verify-jwt
    }
  } else {
    npx supabase functions deploy $name --project-ref $PROD_REF --no-verify-jwt
  }
}

$script:count = 0

# 1) Functions already under supabase/functions/
Get-ChildItem -Directory $FN_DIR -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.Name -eq "_shared") { return }
  if (Test-Path (Join-Path $_.FullName "index.ts")) {
    Deploy-One $_.Name
    $script:count++
  }
}

# 2) Root-level functions at supabase/<name>/ — copied into functions/ temporarily
Get-ChildItem -Directory "supabase" | ForEach-Object {
  $name = $_.Name
  if ($name -eq "functions" -or $name -eq "migrations" -or $name -eq "_shared") { return }
  if (-not (Test-Path (Join-Path $_.FullName "index.ts"))) { return }
  $dest = Join-Path $FN_DIR $name
  Copy-Item -Recurse -Force $_.FullName $dest
  Deploy-One $name
  $script:count++
  Remove-Item -Recurse -Force $dest
}

Remove-Item -Recurse -Force (Join-Path $FN_DIR "_shared") -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "=== Done: deployed $($script:count) functions to PROD ($PROD_REF) ==="
Write-Host "Next: set PROD secrets (see PROD_DEPLOYMENT.md section 1d)."
