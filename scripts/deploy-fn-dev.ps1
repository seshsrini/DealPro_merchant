# Deploy one or more root-level edge functions to DEV
# Usage: .\scripts\deploy-fn-dev.ps1 register-merchant validate-merchant-field
# Run from: C:\Srini\dealpro\dev\dealpro

param([Parameter(Mandatory=$true, ValueFromRemainingArguments=$true)][string[]]$Functions)

$DEV_PROJECT_REF = "gkulyxglzqlhpqxlwjqw"
$ROOT = $PSScriptRoot | Split-Path  # = project root

Set-Location $ROOT

foreach ($fn in $Functions) {
    $src = "supabase\$fn"
    $dst = "supabase\functions\$fn"

    if (-not (Test-Path $src)) {
        Write-Host "  (skip $fn - directory not found)" -ForegroundColor Yellow
        continue
    }

    Write-Host "-> Deploying $fn ..." -ForegroundColor Cyan
    Copy-Item -Recurse $src $dst -Force
    npx supabase functions deploy $fn --project-ref $DEV_PROJECT_REF --no-verify-jwt
    Remove-Item -Recurse -Force $dst
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
