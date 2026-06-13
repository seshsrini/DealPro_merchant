#!/bin/bash
# Deploy ALL Edge Functions to PROD — discovers functions dynamically so none
# are missed (unlike the hardcoded QA list). Re-running is safe (idempotent).
#
# Prereq: npx supabase login   (once)
# Run from a repo root that contains supabase/ functions, e.g.:
#   bash scripts/deploy-functions-prod.sh
# The DB is shared, so if your CONSUMER repo has functions this repo doesn't,
# run this from that repo too (overlap just re-deploys, which is harmless).

set -u
PROD_REF="lpypcdshtiwkxkelepnl"
FN_DIR="supabase/functions"

IMPORT_MAP=""
[ -f "$FN_DIR/import_map.json" ] && IMPORT_MAP="$FN_DIR/import_map.json"

mkdir -p "$FN_DIR"
[ -d "supabase/_shared" ] && cp -r "supabase/_shared" "$FN_DIR/_shared"

deploy_one() {
  local name="$1"
  echo "→ Deploying $name ..."
  if [ -n "$IMPORT_MAP" ]; then
    npx supabase functions deploy "$name" --project-ref "$PROD_REF" --no-verify-jwt --import-map "$IMPORT_MAP" 2>/dev/null \
      || npx supabase functions deploy "$name" --project-ref "$PROD_REF" --no-verify-jwt
  else
    npx supabase functions deploy "$name" --project-ref "$PROD_REF" --no-verify-jwt
  fi
}

count=0

# 1) Functions already under supabase/functions/
for d in "$FN_DIR"/*/; do
  [ -d "$d" ] || continue
  name="$(basename "$d")"
  [ "$name" = "_shared" ] && continue
  [ -f "$d/index.ts" ] || continue
  deploy_one "$name"; count=$((count+1))
done

# 2) Root-level functions at supabase/<name>/ — copied into functions/ temporarily
for d in supabase/*/; do
  name="$(basename "$d")"
  case "$name" in functions|migrations|_shared) continue;; esac
  [ -f "$d/index.ts" ] || continue
  cp -r "supabase/$name" "$FN_DIR/$name"
  deploy_one "$name"; count=$((count+1))
  rm -rf "$FN_DIR/$name"
done

rm -rf "$FN_DIR/_shared"
echo ""
echo "=== Done: deployed $count functions to PROD ($PROD_REF) ==="
echo "Next: set PROD secrets (Dashboard → Project Settings → Edge Functions → Secrets):"
echo "  npx supabase secrets set --project-ref $PROD_REF KEY=value ..."
