# 📋 Campaign Approval & Notification Workflow

This document explains the complete workflow from campaign creation to user notification.

---

## 🔄 Complete Workflow

### Step 1: Merchant Creates Campaign
```
Merchant → Create Campaign Form → Submit
↓
INSERT INTO campaigns (status = 'review', ...)
↓
Campaign awaits admin approval ⏳
```

### Step 2: Admin Reviews Campaign
```
Admin → Review Dashboard → View pending campaigns
↓
Admin approves or rejects
```

### Step 3: Admin Approves Campaign
```
Admin → Click "Approve" button
↓
UPDATE campaigns SET status = 'active' WHERE campaign_id = '...'
↓
Database trigger fires! 🔔
```

### Step 4: Notification Sent
```
Trigger → Calls Edge Function
↓
Edge Function → Finds users who favorited this merchant
↓
Edge Function → Sends FCM notifications
↓
Users receive: "🎉 New Deal Live!" 📱
```

---

## 📊 Campaign Status Flow

```
[Merchant Creates]
       ↓
   'review' ⏳ (Awaiting admin approval)
       ↓
   [Admin Reviews]
       ↓
   ┌─────────┴──────────┐
   ↓                    ↓
'active' ✅         'rejected' ❌
(Approved)          (Rejected)
   ↓
🔔 NOTIFICATION SENT
```

---

## 🔧 Setup Instructions

### Step 1: Delete Old Webhook (If Exists)

If you created a webhook for INSERT events, delete it:

**Via Dashboard:**
1. Go to: Database → Webhooks
2. Find: `new-deal-notification`
3. Click **Delete**

**Via SQL:**
```sql
DROP TRIGGER IF EXISTS trigger_new_campaign_notification ON public.campaigns;
DROP FUNCTION IF EXISTS public.notify_new_campaign();
```

---

### Step 2: Create New Trigger for UPDATE Events

**Get your credentials:**
1. **Project Reference:** Supabase Dashboard → Project Settings → General → Reference ID
   - Example: `gkulyxglzqlhpqxlwjqw`

2. **Service Role Key:** Supabase Dashboard → Project Settings → API → `service_role` (secret)
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**Update the SQL file:**

Open: `supabase/migrations/create_campaign_approval_trigger.sql`

Replace these values:
- `YOUR_PROJECT_REF` → Your project reference
- `YOUR_SERVICE_ROLE_KEY` → Your service role key

**Run the SQL:**
1. Copy the entire file contents
2. Go to: Supabase Dashboard → SQL Editor
3. Click "New query"
4. Paste the SQL
5. Click **Run**

**Verify:**
```sql
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_campaign_approved_notification';
```

**Expected result:**
```
trigger_name                          | event_manipulation | event_object_table
--------------------------------------|--------------------|-----------------
trigger_campaign_approved_notification| UPDATE             | campaigns
```

---

## 🧪 Testing the Workflow

### Setup Phase:

**1. Create a test campaign as merchant:**
```sql
INSERT INTO campaigns (
  campaign_id,
  merchant_id,
  shop_name,
  deal_heading,
  offer_value,
  category,
  city,
  start_date,
  end_date,
  status  -- 'review' by default
) VALUES (
  gen_random_uuid(),
  'YOUR_MERCHANT_USER_ID',
  'Test Shop',
  'Test Deal - Approval Required',
  '50% Off',
  'Food & Dining',
  'Bangalore',
  NOW(),
  NOW() + INTERVAL '7 days',
  'review'  -- ← Campaign in review status
);
```

**2. Verify campaign is in review:**
```sql
SELECT campaign_id, deal_heading, status
FROM campaigns
WHERE deal_heading LIKE '%Approval Required%';
```

**3. Ensure consumer has favorited the merchant:**
```sql
SELECT * FROM favorites
WHERE merchant_id = 'YOUR_MERCHANT_USER_ID';
```

---

### Test Phase:

**4. Admin approves the campaign (This should trigger notification):**
```sql
UPDATE campaigns
SET status = 'active'
WHERE deal_heading LIKE '%Approval Required%'
  AND status = 'review';
```

**5. Check Edge Function logs:**
- Go to: Supabase Dashboard → Edge Functions → send-new-deal-notification → Logs
- You should see:
  ```
  [Webhook] New deal created: { id: "...", status: "active" }
  [FCM] Found X users who favorited this merchant
  [FCM] Notifications sent: X success, 0 failed
  ```

**6. Consumer receives notification on phone!** 🎉

---

## 📱 Real-World Testing (2 Phones)

### Phone 1 - Merchant:
```
1. Login as merchant
2. Create new campaign
3. Campaign status = 'review'
4. Wait for admin approval
```

### Computer - Admin:
```
1. Login to admin dashboard
2. View pending campaigns (status = 'review')
3. Review the campaign
4. Click "Approve" button
5. Status changes to 'active' ✅
```

### Phone 2 - Consumer:
```
1. Already favorited the merchant ⭐
2. App can be closed
3. Receives notification when admin approves! 📱
```

---

## 🔍 Trigger Logic Explained

### The Trigger Condition:
```sql
IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
  -- Send notification
END IF;
```

**What this means:**
- `NEW.status = 'active'` → New status must be 'active'
- `OLD.status != 'active'` → Old status was NOT 'active'
- **Result:** Only triggers when status **changes TO** 'active'

### Examples:

| Old Status | New Status | Notification Sent? | Why? |
|------------|------------|-------------------|------|
| `review` | `active` | ✅ YES | Status changed to active |
| `pending` | `active` | ✅ YES | Status changed to active |
| `active` | `active` | ❌ NO | Already active (no change) |
| `review` | `pending` | ❌ NO | Not active yet |
| `active` | `expired` | ❌ NO | Changed away from active |
| NULL (new) | `active` | ✅ YES | Direct insert as active |

---

## 🎯 Why This Approach is Better

### Before (Wrong):
```
Merchant creates campaign
  ↓
INSERT with status = 'review'
  ↓
Notification sent immediately ❌
  ↓
Users see unapproved deals ❌
```

### After (Correct):
```
Merchant creates campaign
  ↓
INSERT with status = 'review'
  ↓
No notification yet ✅
  ↓
Admin reviews and approves
  ↓
UPDATE status = 'active'
  ↓
Notification sent ✅
  ↓
Users see only approved deals ✅
```

---

## 🐛 Troubleshooting

### ❌ "Notification not sent when campaign approved"

**Check 1: Is trigger active?**
```sql
SELECT * FROM information_schema.triggers
WHERE trigger_name = 'trigger_campaign_approved_notification';
```
**Expected:** 1 row

**Check 2: Did status actually change?**
```sql
SELECT campaign_id, status
FROM campaigns
WHERE campaign_id = 'YOUR_CAMPAIGN_ID';
```
**Expected:** status = 'active'

**Check 3: Check Edge Function logs**
- Supabase Dashboard → Edge Functions → Logs
- Should see: "Campaign approved and activated"

**Check 4: Are there users who favorited this merchant?**
```sql
SELECT COUNT(*) FROM favorites
WHERE merchant_id = (
  SELECT merchant_id FROM campaigns WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
);
```
**Expected:** > 0

---

### ❌ "Got duplicate notifications"

**Cause:** Trigger fired multiple times

**Solution:** The trigger already prevents this with:
```sql
AND (OLD.status IS NULL OR OLD.status != 'active')
```

If you still get duplicates, check if you have multiple triggers:
```sql
SELECT * FROM information_schema.triggers
WHERE event_object_table = 'campaigns';
```

---

## ✅ Final Checklist

```
[ ] Old INSERT webhook deleted
[ ] New UPDATE trigger created
[ ] Trigger verified in database
[ ] Test campaign created with status = 'review'
[ ] Consumer favorited merchant
[ ] Campaign approved (UPDATE status = 'active')
[ ] Edge function logs show notification sent
[ ] Consumer received notification on phone
```

---

## 📊 Database Schema Requirements

Your campaigns table must have these columns:
- `status` (text) - Values: 'review', 'active', 'pending', 'expired', 'rejected'
- `merchant_id` (uuid) - Reference to merchant user

Verify:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'campaigns'
  AND column_name IN ('status', 'merchant_id');
```

---

## 🎉 Summary

**Trigger:** UPDATE on campaigns table
**Condition:** status changes to 'active'
**Action:** Send notification to users who favorited the merchant
**Result:** Users only get notified about approved, active deals! ✅

---

**Ready to test?** Follow the setup instructions and test the approval workflow! 🚀
