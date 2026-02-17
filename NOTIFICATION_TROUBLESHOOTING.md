# 🔔 Notification Troubleshooting - Why Notifications Didn't Work

## ✅ What's Already Done

1. ✅ **FCM Service Created** - `services/fcmService.ts` using Capacitor
2. ✅ **Notification Edge Function Exists** - `supabase/functions/send-new-deal-notification/index.ts`
3. ✅ **FCM Service Integrated into Login** - Will register tokens on login
4. ✅ **FCM Service Integrated into Logout** - Will cleanup on logout
5. ✅ **Android Manifest Configured** - Firebase services added
6. ✅ **Capacitor Push Plugin Installed** - `@capacitor/push-notifications@6.0.5`

---

## ❌ What's Missing (Why Notifications Didn't Work)

### Issue 1: No FCM Tokens in Database

**Problem:** Users haven't registered FCM tokens yet because the app wasn't built/deployed with the new code.

**Solution:**
```bash
# 1. Build the app with FCM integration
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Open in Android Studio
npx cap open android

# 4. Rebuild and reinstall the app on your mobile
# (Click "Run" button in Android Studio)
```

**Verify:**
```sql
-- Check Supabase database for FCM tokens
SELECT * FROM fcm_tokens WHERE is_active = true;
```

You should see tokens after users login with the new build.

---

### Issue 2: google-services.json Missing

**Problem:** Android app needs `google-services.json` to communicate with Firebase.

**Solution:**
1. Go to: https://console.firebase.google.com/project/dealpro-eacaf/settings/general
2. Add Android app with package: `com.dealpro.app`
3. Download `google-services.json`
4. Place it at: `C:\Srini\dealpro\dev\dealpro\android\app\google-services.json`

**Quick command:**
```powershell
.\move-google-services.ps1
```

**Verify:**
```bash
ls android/app | grep google-services.json
# Should output: google-services.json
```

---

### Issue 3: Firebase Environment Variables Not Set

**Problem:** The Edge Function `send-new-deal-notification` needs Firebase credentials to send notifications.

**What's Needed:**
The function uses Firebase Admin SDK which requires:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

**Where to Find These:**

You already have the Firebase Admin SDK key file:
`dealpro-eacaf-firebase-adminsdk-fbsvc-8c29c46deb.json`

Open this file and extract:
```json
{
  "project_id": "dealpro-eacaf",  ← FIREBASE_PROJECT_ID
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",  ← FIREBASE_PRIVATE_KEY
  "client_email": "firebase-adminsdk-...@dealpro-eacaf.iam.gserviceaccount.com"  ← FIREBASE_CLIENT_EMAIL
}
```

**How to Set in Supabase:**

1. Go to: https://dashboard.supabase.com/project/gkulyxglzqlhpqxlwjqw/settings/functions
2. Click "Edge Functions"
3. Scroll to "Environment variables"
4. Add three variables:

| Variable | Value |
|----------|-------|
| `FIREBASE_PROJECT_ID` | `dealpro-eacaf` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-...@dealpro-eacaf.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | (Entire private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`) |

**IMPORTANT:** For `FIREBASE_PRIVATE_KEY`, paste the ENTIRE private key exactly as it appears in the JSON file, including:
```
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQ...
...
-----END PRIVATE KEY-----
```

---

### Issue 4: Database Webhook Not Configured

**Problem:** When you approve a campaign (change status to 'active'), nothing triggers the notification Edge Function.

**Solution:** Create a Database Webhook in Supabase

**Steps:**

1. Go to: https://dashboard.supabase.com/project/gkulyxglzqlhpqxlwjqw/database/hooks
2. Click **"Create a new hook"**
3. Select **"Database Webhooks"**
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `send-notification-on-campaign-approval` |
| **Table** | `campaigns` |
| **Events** | ☑️ UPDATE (check this) |
| **Type** | `supabase_function` |
| **Function** | `send-new-deal-notification` |
| **HTTP Headers** | Leave default |

5. Click **"Create webhook"**

**What This Does:**
- Whenever a row in `campaigns` table is **UPDATED** (e.g., status changes from 'pending' to 'active')
- Supabase automatically calls the `send-new-deal-notification` Edge Function
- The function checks if status is 'active'
- If active, it finds users who favorited that merchant
- Sends push notifications to those users

---

### Issue 5: Edge Function Not Deployed

**Problem:** The Edge Function might not be deployed to Supabase.

**Solution:**
```bash
supabase functions deploy send-new-deal-notification
```

**Verify:**
```bash
supabase functions list
```

You should see:
```
Function Name                 Status    Created At
-------------------------------------------------
send-new-deal-notification   deployed  2024-XX-XX
manage-pinned-deals          deployed  2024-XX-XX
```

---

## 🧪 Testing Checklist

### Step 1: Deploy Everything

```bash
# 1. Deploy Edge Function
supabase functions deploy send-new-deal-notification

# 2. Build app with FCM integration
npm run build

# 3. Sync to Android
npx cap sync android

# 4. Open in Android Studio
npx cap open android

# 5. Run on device (click green "Run" button)
```

### Step 2: Set Firebase Environment Variables

1. Open `dealpro-eacaf-firebase-adminsdk-fbsvc-8c29c46deb.json`
2. Copy `project_id`, `client_email`, and `private_key`
3. Add to Supabase Edge Functions environment variables

### Step 3: Create Database Webhook

1. Supabase Dashboard → Database → Hooks
2. Create new webhook on `campaigns` table for UPDATE events
3. Set webhook to call `send-new-deal-notification` function

### Step 4: Test Flow

**A. Consumer Favorites a Merchant:**
1. Login as consumer
2. Go to merchant profile
3. Tap the heart icon to favorite
4. Check Supabase `favorites` table - should have a new row

**B. Consumer Enables Notifications:**
1. Consumer logs into the app (with new build)
2. App requests notification permission
3. Consumer taps "Allow"
4. Check console logs:
   ```
   [FCM] Initializing FCM for user: ...
   [FCM] Permission granted
   [FCM] Push registration success, token: ...
   [FCM] Token registered successfully: ...
   ```
5. Check Supabase `fcm_tokens` table - should have consumer's token

**C. Merchant Creates Campaign:**
1. Login as merchant
2. Create a new campaign
3. Submit for approval (status: 'pending')

**D. Admin Approves Campaign:**
1. Login as dealAdmin
2. Go to Review Deals
3. Approve the campaign (status changes to 'active')
4. **This triggers the webhook!**

**E. Check Notification Sent:**

**Supabase Edge Function Logs:**
1. Go to: https://dashboard.supabase.com/project/gkulyxglzqlhpqxlwjqw/functions/send-new-deal-notification/logs
2. You should see:
   ```
   [Webhook] Received payload: {...}
   [Webhook] Campaign updated: {...}
   [FCM] Campaign is active, proceeding with notification...
   [FCM] Found X users who favorited this merchant
   [FCM] Found X active tokens
   [FCM] Notification sent successfully
   [FCM] Notifications sent: X success, 0 failed
   ```

**Consumer's Mobile Device:**
- Should receive a push notification:
  ```
  🎉 New Deal Live!
  50% OFF at Pizza Palace in Chennai
  ```

---

## 🐛 Common Issues

### No tokens in database

**Symptoms:**
- Edge Function logs: `[FCM] No active tokens found`

**Causes:**
1. Users haven't logged in with the new build
2. Users denied notification permissions
3. Testing on web (FCM only works on native Android/iOS)

**Fix:**
- Rebuild app, reinstall on device
- Login and grant permission when prompted
- Test on real device, not browser

### Firebase authentication error

**Symptoms:**
- Edge Function logs: `[FCM] Error getting access token`

**Causes:**
- Firebase environment variables not set
- Private key format incorrect (missing newlines)

**Fix:**
- Double-check all 3 environment variables are set correctly
- For `FIREBASE_PRIVATE_KEY`, ensure newlines are preserved
- Try wrapping the entire key in quotes if needed

### Webhook not triggering

**Symptoms:**
- No logs appear in Edge Function when campaign approved
- Webhook shows error in Supabase dashboard

**Causes:**
- Webhook not created
- Webhook configured on wrong table/event
- Edge Function not deployed

**Fix:**
- Check Supabase Dashboard → Database → Hooks
- Verify webhook is enabled and shows "Active"
- Ensure it's listening to `campaigns` table UPDATE events

### Notification sent but not received

**Symptoms:**
- Edge Function logs: `[FCM] Notifications sent: 1 success, 0 failed`
- But device doesn't show notification

**Causes:**
- google-services.json missing or incorrect
- Firebase Cloud Messaging not enabled in Firebase Console
- Device notification permissions denied

**Fix:**
- Ensure google-services.json is in `android/app/`
- Go to Firebase Console → Cloud Messaging (enable it)
- Check device Settings → Apps → DealPro → Notifications (must be allowed)

---

## 📊 Full Notification Flow

```
1. Consumer favorites merchant
   ↓
2. Consumer logs in (new build)
   ↓
3. fcmService.initialize() called
   ↓
4. FCM token registered in Supabase
   ↓
5. Merchant creates campaign
   ↓
6. Admin approves campaign (status: 'active')
   ↓
7. Database webhook triggers Edge Function
   ↓
8. Edge Function finds users who favorited merchant
   ↓
9. Edge Function gets FCM tokens for those users
   ↓
10. Edge Function sends notification via Firebase
    ↓
11. Firebase delivers to device
    ↓
12. Device shows notification
    ↓
13. User taps notification → App opens to deal details
```

---

## ✅ Complete Setup Checklist

- [ ] Download google-services.json and place in `android/app/`
- [ ] Set 3 Firebase environment variables in Supabase
- [ ] Create database webhook on `campaigns` table (UPDATE event)
- [ ] Deploy `send-new-deal-notification` Edge Function
- [ ] Build app: `npm run build`
- [ ] Sync to Android: `npx cap sync android`
- [ ] Open in Android Studio: `npx cap open android`
- [ ] Run on device (rebuild/reinstall app)
- [ ] Login as consumer → Grant notification permission
- [ ] Favorite a merchant
- [ ] Check `fcm_tokens` table has token
- [ ] Login as merchant → Create campaign
- [ ] Login as admin → Approve campaign
- [ ] Consumer receives notification 🎉

---

## 🎯 Quick Test (After Setup)

**Fastest way to test:**

1. **Manual trigger** (bypass webhook):
   ```bash
   curl -X POST \
     'https://gkulyxglzqlhpqxlwjqw.supabase.co/functions/v1/send-new-deal-notification' \
     -H 'Authorization: Bearer YOUR_ANON_KEY' \
     -H 'Content-Type: application/json' \
     -d '{
       "record": {
         "campaign_id": "test-123",
         "deal_heading": "Test Deal",
         "shop_name": "Test Shop",
         "city": "Chennai",
         "category": "Food",
         "offer_value": "50% OFF",
         "merchant_id": "MERCHANT_USER_ID",
         "status": "active"
       }
     }'
   ```

2. Replace:
   - `YOUR_ANON_KEY` with Supabase anon key
   - `MERCHANT_USER_ID` with a real merchant ID that consumers have favorited

3. Check Edge Function logs for success

---

**You're close! Just need to:**
1. Download google-services.json
2. Set Firebase environment variables
3. Create database webhook
4. Rebuild and redeploy app
