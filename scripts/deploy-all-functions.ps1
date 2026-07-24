# Deploy every edge function in this repo to a named Supabase project.
#
# WHY THIS EXISTS
#   The older prod script hardcoded a project ref (lpypcdshtiwkxkelepnl). Running it
#   after the prod project changed would have silently deployed to the WRONG project.
#   Here -ProjectRef is MANDATORY: there is no default to be stale.
#
# CANONICAL-COPY RULE
#   Functions can live in supabase/functions/<name>/ (canonical) or supabase/<name>/
#   (legacy root). When a name exists in BOTH, supabase/functions/ WINS. The root
#   copies have drifted before — a stale root get-deals-of-day would have undone a
#   live bug fix. Root copies are deployed only when there is no canonical version.
#
# USAGE
#   .\scripts\deploy-all-functions.ps1 -ProjectRef trrinhrajmsnkjnwtncz -DryRun
#   .\scripts\deploy-all-functions.ps1 -ProjectRef trrinhrajmsnkjnwtncz
#   .\scripts\deploy-all-functions.ps1 -ProjectRef trrinhrajmsnkjnwtncz -Only get-deals-of-day,get-all
#
# PREREQ: npx supabase login   (once per machine)

param(
  [Parameter(Mandatory = $true)] [string]   $ProjectRef,
  [string[]] $Only,
  [switch]   $DryRun
)

$ErrorActionPreference = "Continue"
$root   = Split-Path $PSScriptRoot            # repo root
Set-Location $root
$FN_DIR = "supabase/functions"

# A directory is only a deployable function if its index.ts actually serves HTTP.
# Some folders hold leftover helper files (e.g. supabase/supabase/index.ts, a dead
# client-init note) that would otherwise be deployed as junk functions.
function Test-IsEdgeFunction([string]$dir) {
  $idx = Join-Path $dir 'index.ts'
  if (-not (Test-Path $idx)) { return $false }
  return [bool](Select-String -Path $idx -Pattern 'Deno\.serve\s*\(|(^|[^.\w])serve\s*\(' -Quiet)
}

# ── Build the deploy list, canonical first ────────────────────────────────────
$plan = @{}   # name -> source directory
$skipped = @()

Get-ChildItem $FN_DIR -Directory -ErrorAction SilentlyContinue |
  ForEach-Object {
    if (Test-IsEdgeFunction $_.FullName) { $plan[$_.Name] = $_.FullName }
    elseif (Test-Path (Join-Path $_.FullName 'index.ts')) { $skipped += $_.Name }
  }

$canonicalCount = $plan.Count
$shadowed = @()

Get-ChildItem "supabase" -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -notin @('functions','migrations','_shared') } |
  ForEach-Object {
    if (-not (Test-IsEdgeFunction $_.FullName)) {
      if (Test-Path (Join-Path $_.FullName 'index.ts')) { $skipped += $_.Name }
      return
    }
    if ($plan.ContainsKey($_.Name)) { $shadowed += $_.Name }   # root copy ignored
    else { $plan[$_.Name] = $_.FullName }
  }

if ($Only) { $plan = @{} + ($plan.GetEnumerator() | Where-Object { $Only -contains $_.Key } | ForEach-Object -Begin { $h=@{} } -Process { $h[$_.Key]=$_.Value } -End { $h }) }

$names = $plan.Keys | Sort-Object
Write-Host ""
Write-Host "Target project : $ProjectRef" -ForegroundColor Cyan
Write-Host "To deploy      : $($names.Count) function(s)  ($canonicalCount canonical, $($names.Count - $canonicalCount) root-only)"
if ($shadowed.Count) {
  Write-Host "Root copies IGNORED (canonical wins): $($shadowed.Count)" -ForegroundColor Yellow
  $shadowed | Sort-Object | ForEach-Object { Write-Host "   - $_" -ForegroundColor DarkYellow }
}
if ($skipped.Count) {
  Write-Host "SKIPPED - has index.ts but no serve() handler, not a function: $($skipped.Count)" -ForegroundColor DarkGray
  $skipped | Sort-Object -Unique | ForEach-Object { Write-Host "   - $_" -ForegroundColor DarkGray }
}
Write-Host ""

if ($DryRun) {
  $names | ForEach-Object { Write-Host ("   {0,-38} <- {1}" -f $_, (Resolve-Path $plan[$_] -Relative)) }
  Write-Host ""
  Write-Host "DRY RUN - nothing deployed. Re-run without -DryRun." -ForegroundColor Yellow
  return
}

# ── Stage shared helpers ──────────────────────────────────────────────────────
# Root-hosted functions import '../_shared/cors.ts' etc. When such a function is
# staged into supabase/functions/, that relative path only resolves if _shared is
# ALSO present there. Without this, every function importing _shared fails to
# bundle (11 of them did on the first run).
$sharedSrc  = "supabase/_shared"
$sharedDest = Join-Path $FN_DIR "_shared"
$sharedTemp = $false
if ((Test-Path $sharedSrc) -and -not (Test-Path $sharedDest)) {
  Copy-Item -Recurse $sharedSrc $sharedDest -Force
  $sharedTemp = $true
  Write-Host "Staged supabase/_shared -> $sharedDest" -ForegroundColor DarkGray
}

# ── Deploy ────────────────────────────────────────────────────────────────────
$ok = @(); $failed = @(); $i = 0
foreach ($name in $names) {
  $i++
  $src  = $plan[$name]
  $dest = Join-Path $FN_DIR $name
  $temp = $false

  # Root-hosted function: stage a copy under supabase/functions so the CLI finds it.
  if ((Resolve-Path $src).Path -ne (Resolve-Path $dest -ErrorAction SilentlyContinue).Path) {
    if (-not (Test-Path $dest)) { Copy-Item -Recurse $src $dest -Force; $temp = $true }
  }

  Write-Host ("[{0}/{1}] {2}" -f $i, $names.Count, $name) -ForegroundColor Cyan
  npx supabase functions deploy $name --project-ref $ProjectRef --no-verify-jwt 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { $ok += $name } else { $failed += $name; Write-Host "      FAILED" -ForegroundColor Red }

  if ($temp) { Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue }
}

if ($sharedTemp) { Remove-Item -Recurse -Force $sharedDest -ErrorAction SilentlyContinue }

Write-Host ""
Write-Host "=== Done: $($ok.Count) deployed, $($failed.Count) failed -> $ProjectRef ===" -ForegroundColor Green
if ($failed.Count) {
  Write-Host "Failed:" -ForegroundColor Red
  $failed | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
  Write-Host "Retry just those with:  -Only $($failed -join ',')" -ForegroundColor Yellow
}
