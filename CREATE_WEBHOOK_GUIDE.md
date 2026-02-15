# 🔗 How to Create Database Webhook in Supabase

This guide shows you how to create a webhook that triggers push notifications when a new campaign/deal is added to your database.

---

## 📋 Before You Start

Make sure you've completed these steps:

- ✅ Edge function deployed: `send-new-deal-notification`
- ✅ Firebase secrets added to Supabase
- ✅ `fcm_tokens` table created in database

---

## 🎯 Method 1: Supabase Dashboard (Recommended)

### Step 1: Navigate to Webhooks

1. Go to: https://supabase.com/dashboard
2. Select your **DealPro** project
3. Click **"Database"** in the left sidebar
4. Click **"Webhooks"**

### Step 2: Create New Hook

Click the **"Create a new hook"** button (or **"Enable Webhooks"** if first time)

### Step 3: Configure the Webhook

Fill in these values:

| Field | Value |
|-------|-------|
| **Name** | `new-deal-notification` |
| **Schema** | `public` |
| **Table** | `campaigns` (select from dropdown) |
| **Events** | ✅ Insert (check this box only) |
| **Type** | `Supabase Edge Function` |
| **Edge Function** | `send-new-deal-notification` |
| **Method** | `POST` |

### Step 4: Save

Click **"Confirm"** or **"Create webhook"**

### Step 5: Verify

- Webhook should appear in the list
- Status should be **"Active"**
- Green checkmark or indicator

---

## 🎯 Method 2: SQL Approach

If the dashboard method doesn't work, use SQL instead:

### Step 1: Get Your Project Details

You'll need:
- **Project Reference ID**: Found in Project Settings → General
  - Example: `gkulyxglzqlhpqxlwjqw`
- **Service Role Key**: Found in Project Settings → API → `service_role` (secret)

### Step 2: Open SQL Editor

1. Click **"SQL Editor"** in Supabase Dashboard
2. Click **"New query"**

### Step 3: Run This SQL

```sql
-- ============================================================================
-- CREATE WEBHOOK FOR NEW CAMPAIGN NOTIFICATIONS
-- ============================================================================
-- Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with your actual values

-- Enable the http extension
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Create trigger function
CREATE OR REPLACE FUNCTION public.notify_new_campaign()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
BEGIN
  -- Log the trigger
  RAISE NOTICE 'New campaign created: %', NEW.campaign_id;

  -- Call the Edge Function asynchronously
  SELECT extensions.http_post(
    'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-new-deal-notification',
    json_build_object('record', row_to_json(NEW))::text,
    'application/json',
    ARRAY[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY')
    ]
  ) INTO request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_new_campaign_notification ON public.campaigns;

CREATE TRIGGER trigger_new_campaign_notification
AFTER INSERT ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_campaign();

-- Verify trigger was created
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_new_campaign_notification';
```

**⚠️ IMPORTANT: Replace these values:**

1. **YOUR_PROJECT_REF**
   - Find it in: Project Settings → General → Reference ID
   - Example: `gkulyxglzqlhpqxlwjqw`

2. **YOUR_SERVICE_ROLE_KEY**
   - Find it in: Project Settings → API → `service_role` key
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (very long key)

### Step 4: Run the Query

Click **"Run"** button

You should see:
```
Success. No rows returned
```

---

## ✅ Verify the Webhook Works

### Test 1: Check if Trigger Exists

Run this SQL to verify:

```sql
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_new_campaign_notification';
```

**Expected result:**
```
trigger_name                      | event_manipulation | event_object_table
----------------------------------|--------------------|-----------------
trigger_new_campaign_notification | INSERT             | campaigns
```

### Test 2: Insert a Test Campaign

```sql
INSERT INTO public.campaigns (
  campaign_id,
  shop_name,
  deal_heading,
  offer_value,
  category,
  city,
  start_date,
  end_date,
  status
) VALUES (
  gen_random_uuid(),
  'Test Store',
  'Test Push Notification Deal',
  '50% Off',
  'Food & Dining',
  'Bangalore',
  NOW(),
  NOW() + INTERVAL '7 days',
  'active'
);
```

### Test 3: Check Edge Function Logs

1. Go to: **Edge Functions** → **send-new-deal-notification** → **Logs**
2. You should see:
   ```
   [Webhook] Received payload
   [FCM] Found X active tokens
   [FCM] Notifications sent: X success, 0 failed
   ```

---

## 🐛 Troubleshooting

### ❌ "Edge function not found in dropdown"

**Solution:** Deploy the edge function first:
```bash
supabase functions deploy send-new-deal-notification
```

### ❌ "Webhook shows but doesn't trigger"

**Solution:** Check if trigger exists:
```sql
SELECT * FROM information_schema.triggers
WHERE trigger_name LIKE '%notification%';
```

### ❌ "Edge function errors in logs"

**Solution:** Check if you added all 3 Firebase secrets:
- Project Settings → Edge Functions → Secrets
- Should see: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

### ❌ "No notifications received on phone"

**Possible causes:**
1. FCM token not registered - Check:
   ```sql
   SELECT * FROM fcm_tokens WHERE user_id = 'YOUR_USER_ID';
   ```
2. Firebase credentials wrong - Re-check the 3 secrets
3. App not running - Test with app open

---

## 📊 Monitor Webhook Activity

### View Recent Triggers

```sql
-- This won't show webhook calls directly, but you can check when campaigns were added
SELECT
  campaign_id,
  shop_name,
  deal_heading,
  created_at
FROM campaigns
ORDER BY created_at DESC
LIMIT 10;
```

### Check Edge Function Invocations

Go to: **Edge Functions** → **send-new-deal-notification** → **Metrics**

You'll see:
- Total invocations
- Success rate
- Error rate
- Response time

---

## 🎯 Final Verification Checklist

```
[ ] Webhook created in Supabase Dashboard (or via SQL)
[ ] Webhook status shows "Active"
[ ] Trigger exists in database
[ ] Test campaign inserted successfully
[ ] Edge function logs show the trigger received
[ ] Notification received on phone (if FCM setup complete)
```

---

## 🔗 Related Files

- Edge Function: `supabase/functions/send-new-deal-notification/index.ts`
- Firebase Setup: `FIREBASE_SUPABASE_SETUP.md`
- FCM Service: `services/fcmService.ts`

---

**Need help?** Check the edge function logs in Supabase Dashboard for error messages.
