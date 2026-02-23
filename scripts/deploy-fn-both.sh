#!/usr/bin/env bash
# Deploy one or more edge functions to BOTH DEV and QA
# Usage: bash scripts/deploy-fn-both.sh register-merchant register-user
# Run from: C:\Srini\dealpro\dev\dealpro (in Git Bash)

set -e

DEV_PROJECT_REF="gkulyxglzqlhpqxlwjqw"
QA_PROJECT_REF="brgamwtcsnsnkdssyarn"
FUNCTIONS=("$@")

if [ ${#FUNCTIONS[@]} -eq 0 ]; then
  echo "Usage: bash scripts/deploy-fn-both.sh <fn1> [fn2] ..."
  exit 1
fi

mkdir -p supabase/functions

# Copy _shared so relative imports resolve
if [ -d "supabase/_shared" ]; then
  cp -r "supabase/_shared" "supabase/functions/_shared"
fi

for fn in "${FUNCTIONS[@]}"; do
  if [ ! -d "supabase/$fn" ]; then
    echo "  (skip $fn - directory not found)"
    continue
  fi

  cp -r "supabase/$fn" "supabase/functions/$fn"

  echo "→ [$fn] Deploying to DEV..."
  npx supabase functions deploy "$fn" --project-ref "$DEV_PROJECT_REF" --no-verify-jwt

  echo "→ [$fn] Deploying to QA..."
  npx supabase functions deploy "$fn" --project-ref "$QA_PROJECT_REF" --no-verify-jwt

  rm -rf "supabase/functions/$fn"
  echo "✓ $fn done"
done

rm -rf "supabase/functions/_shared"
echo ""
echo "=== Done ==="
