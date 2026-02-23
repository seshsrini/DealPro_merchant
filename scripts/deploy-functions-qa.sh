#!/bin/bash
# Deploy all Edge Functions to QA Supabase project
# Run from: C:\Srini\dealpro\dev\dealpro
# Usage: bash scripts/deploy-functions-qa.sh
#
# Prereq: npx supabase login  (do this once)

QA_PROJECT_REF="brgamwtcsnsnkdssyarn"
SUPABASE_FUNCTIONS_DIR="supabase/functions"
SUPABASE_ROOT_DIR="supabase"

echo "=== Deploying supabase/functions/ to QA ($QA_PROJECT_REF) ==="

# Functions in supabase/functions/
FUNCTIONS_LIST=(
  "fetch-notifications"
  "get-hoardings"
  "manage-fcm-tokens"
  "manage-pinned-deals"
  "merchant-analytics"
  "send-new-deal-notification"
  "update-banners"
  "update-pushnotify-consent"
)

for fn in "${FUNCTIONS_LIST[@]}"; do
  echo "→ Deploying $fn..."
  npx supabase functions deploy "$fn" \
    --project-ref "$QA_PROJECT_REF" \
    --no-verify-jwt \
    --import-map "$SUPABASE_FUNCTIONS_DIR/import_map.json" 2>/dev/null || \
  npx supabase functions deploy "$fn" \
    --project-ref "$QA_PROJECT_REF" \
    --no-verify-jwt
done

echo ""
echo "=== Deploying root-level supabase/ functions to QA ==="

# Root-level functions (in supabase/ directory, not supabase/functions/)
ROOT_FUNCTIONS=(
  "admin-update-campaign"
  "approve-campaign"
  "campaign-update"
  "create"
  "create-campaign"
  "create-claim"
  "dealadmin-analytics"
  "get-all"
  "get-by-merchant"
  "get-by-status"
  "get-campaigns-by-store"
  "get-campaign-specific-clicks"
  "get-campaign-specific-redemptions"
  "get-cities"
  "get-deals-of-day"
  "get-favorites"
  "get-history"
  "get-lifetime-analytics"
  "get-localities"
  "get-merchant-images"
  "get-metrics"
  "get-one"
  "get-pending-feedback-claims"
  "get-pending-surveys"
  "get-profile"
  "get-redemptions"
  "get-states"
  "get-store-categories"
  "get-stores"
  "get-tiers"
  "get-total-invites-accepted"
  "get-total-invites-sent"
  "get-total-lifetime-clicks"
  "get-total-lifetime-deals"
  "get-total-lifetime-redemptions"
  "initiate-penny-drop"
  "log-activity"
  "log-favorites"
  "login"
  "lookup-pincode"
  "manage-subscription"
  "on-invite-sent"
  "on-subscription-active"
  "register-merchant"
  "register-user"
  "repair-translations"
  "request-otp-for-profile"
  "reset-password"
  "search-localities"
  "search-stores"
  "toggle-favorite"
  "update-favorite"
  "update-feedback"
  "update-profile"
  "upload-deal-image"
  "validate-identifier"
  "validate-merchant-field"
  "verify-otp-for-profile"
  "verify-scan"
)

mkdir -p supabase/functions

# Copy _shared directory so relative imports resolve correctly
if [ -d "supabase/_shared" ]; then
  cp -r "supabase/_shared" "supabase/functions/_shared"
fi

for fn in "${ROOT_FUNCTIONS[@]}"; do
  if [ -d "supabase/$fn" ]; then
    echo "→ Deploying $fn..."
    cp -r "supabase/$fn" "supabase/functions/$fn"
    npx supabase functions deploy "$fn" --project-ref "$QA_PROJECT_REF" --no-verify-jwt
    rm -rf "supabase/functions/$fn"
  else
    echo "  (skip $fn - directory not found)"
  fi
done

# Clean up _shared copy
rm -rf "supabase/functions/_shared"

echo ""
echo "=== Done! All functions deployed to QA project ==="
echo "Next: Set secrets in QA dashboard → Settings → Edge Functions"
