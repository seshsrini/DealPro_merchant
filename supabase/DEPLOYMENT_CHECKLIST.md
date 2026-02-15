# Supabase Deployment Checklist

## Current Issues to Fix

### 1. Store Search Not Fetching Records
**Problem:** ConsumerStack store search returns no results

**Root Cause:** The `searchable_stores` database view doesn't exist

**Fix:**
1. Open Supabase Dashboard → SQL Editor
2. Run the SQL file: `create-searchable-stores-view.sql`
3. Verify the view exists:
   ```sql
   SELECT * FROM searchable_stores LIMIT 5;
   ```
4. Deploy the Edge Function (if not already deployed):
   ```bash
   supabase functions deploy search-stores
   ```

### 2. 401 Unauthorized Errors on Edge Functions
**Problem:** Getting 401 errors when accessing merchant pages

**Affected Functions:**
- `manage-subscription` (merchant dashboard, new campaigns page)
- Possibly other functions

**Fix:**
1. Deploy the manage-subscription Edge Function:
   ```bash
   supabase functions deploy manage-subscription
   ```

2. Verify deployment:
   ```bash
   supabase functions list
   ```

3. Test the function:
   ```bash
   curl -i --location --request POST \
     'https://gkulyxglzqlhpqxlwjqw.supabase.co/functions/v1/manage-subscription' \
     --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
     --header 'Content-Type: application/json' \
     --data '{"action":"check"}'
   ```

## All Edge Functions That Need Deployment

Run these commands to ensure all Edge Functions are deployed:

```bash
# Core authentication and user management
supabase functions deploy login
supabase functions deploy register-merchant

# Campaign/Deal management
supabase functions deploy create-campaign
supabase functions deploy get-all
supabase functions deploy get-by-merchant
supabase functions deploy get-by-status
supabase functions deploy get-campaigns-by-store
supabase functions deploy get-deals-of-day
supabase functions deploy get-favorites
supabase functions deploy get-one
supabase functions deploy update-campaign

# Store management
supabase functions deploy get-stores
supabase functions deploy search-stores

# Subscription management
supabase functions deploy manage-subscription

# Activity tracking
supabase functions deploy track-activity
```

## Database Setup Checklist

### Tables
- [x] user_profiles
- [x] merchant_stores
- [x] campaigns
- [x] subscription_tiers
- [x] merchant_subscriptions

### Views
- [ ] **searchable_stores** - NEEDS TO BE CREATED (run `create-searchable-stores-view.sql`)

### RLS Policies
Run these SQL files in Supabase SQL Editor:
1. `rls-policy-merchant-subscriptions.sql`
2. `rls-policy-subscription-tiers.sql`

### Seed Data
Run this SQL file to populate subscription tiers:
- `seed-subscription-tiers.sql`

## Verification Steps

### 1. Test Store Search
1. Login as consumer
2. Navigate to Store Search screen
3. Type a store name (e.g., "test", "store")
4. Verify results appear

### 2. Test Campaign Counter
1. Login as merchant
2. Navigate to Dashboard or New Campaigns page
3. Verify campaign counter shows (e.g., "5/5 this month")
4. Verify no 401 errors in console

### 3. Test Subscription Check
1. Login as merchant
2. Navigate to Merchant Subscriptions page
3. Verify current subscription displays
4. Verify no errors in console

## Common Issues

### Issue: "Failed to fetch" or 401 Unauthorized
**Solution:**
- Ensure Edge Function is deployed
- Check that JWT token is being passed in Authorization header
- Verify RLS policies are set correctly

### Issue: "relation 'searchable_stores' does not exist"
**Solution:**
- Run `create-searchable-stores-view.sql` in Supabase SQL Editor

### Issue: Campaign counter shows 0/0
**Solution:**
- Verify subscription_tiers table has data (run `seed-subscription-tiers.sql`)
- Verify merchant has an active subscription
- Check console for errors

## Deployment Commands Summary

```bash
# Deploy all Edge Functions at once
cd C:/Srini/dealpro/dev/dealpro

# Deploy search-stores (fixes store search)
supabase functions deploy search-stores

# Deploy manage-subscription (fixes campaign counter and subscription checks)
supabase functions deploy manage-subscription

# Verify deployments
supabase functions list
```

## SQL Setup Summary

Run these in Supabase Dashboard → SQL Editor in order:

1. **Create searchable_stores view:**
   ```sql
   -- Run contents of: create-searchable-stores-view.sql
   ```

2. **Setup RLS policies (if not already done):**
   ```sql
   -- Run contents of: rls-policy-merchant-subscriptions.sql
   -- Run contents of: rls-policy-subscription-tiers.sql
   ```

3. **Seed subscription tiers (if not already done):**
   ```sql
   -- Run contents of: seed-subscription-tiers.sql
   ```
