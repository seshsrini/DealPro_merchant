# 🚀 Deploy Pinned Deals Edge Function

This guide explains how to deploy the `manage-pinned-deals` Edge Function to Supabase.

---

## 📁 Files Created

1. **Edge Function:** `supabase/functions/manage-pinned-deals/index.ts`
2. **Updated Service:** `services/pinnedDealsService.ts` (now uses Edge Function)
3. **This Guide:** `DEPLOY_PINNED_DEALS_FUNCTION.md`

---

## 🔧 Deployment Steps

### Option 1: Deploy via Supabase CLI (Recommended)

#### 1. Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

#### 2. Login to Supabase

```bash
supabase login
```

#### 3. Link Your Project

```bash
supabase link --project-ref gkulyxglzqlhpqxlwjqw
```

**When prompted for password:** Use your Supabase database password

#### 4. Deploy the Function

```bash
supabase functions deploy manage-pinned-deals
```

**Expected output:**
```
Deploying manage-pinned-deals (project ref: gkulyxglzqlhpqxlwjqw)
✔ Deployed manage-pinned-deals function successfully
```

---

### Option 2: Deploy via Supabase Dashboard (Alternative)

If the CLI doesn't work, you can deploy manually:

1. **Go to:** Supabase Dashboard → Edge Functions
2. **Click:** "New Function"
3. **Function Name:** `manage-pinned-deals`
4. **Copy the code** from: `supabase/functions/manage-pinned-deals/index.ts`
5. **Paste** into the editor
6. **Click:** "Deploy Function"

---

## ✅ Verification

After deployment, verify the function works:

### 1. Test via Supabase Dashboard

1. Go to: **Edge Functions** → **manage-pinned-deals** → **Logs**
2. Click: **Invoke Function**
3. Use this test payload:

```json
{
  "action": "check",
  "userId": "YOUR_USER_ID",
  "campaignId": "test-campaign"
}
```

4. **Expected response:**
```json
{
  "success": true,
  "isPinned": false
}
```

### 2. Test in Your App

1. Open your app and login as a consumer
2. Go to any deal details page
3. Click the pin icon 📌
4. Check browser console for:

```
[Pin] Attempting to toggle pin with: {userId: "...", campaignId: "...", merchantId: "..."}
[PinnedDeals] Deal pinned successfully
[Pin] Deal pinned
```

5. Icon should turn blue! ✅

---

## 🔍 Troubleshooting

### ❌ Function not found

**Error:** `Function 'manage-pinned-deals' not found`

**Solution:** Redeploy the function:
```bash
supabase functions deploy manage-pinned-deals
```

---

### ❌ CORS error

**Error:** `CORS policy: No 'Access-Control-Allow-Origin' header`

**Solution:** The function already has CORS headers. Check if the function deployed correctly.

---

### ❌ Permission denied

**Error:** `You do not have permission to run this command`

**Solution:** Ensure you're logged in to Supabase CLI:
```bash
supabase login
```

---

## 📊 Edge Function Actions

The function supports these actions:

| Action | Description | Required Fields |
|--------|-------------|-----------------|
| `check` | Check if deal is pinned | userId, campaignId |
| `pin` | Pin a deal | userId, campaignId, merchantId |
| `unpin` | Unpin a deal | userId, campaignId |
| `toggle` | Toggle pin status | userId, campaignId, merchantId |
| `list` | Get all pinned deals | userId |

---

## 🎯 Next Steps

After successful deployment:

1. ✅ Database table `pinned_deals` created
2. ✅ Edge Function `manage-pinned-deals` deployed
3. ✅ Service updated to use Edge Function
4. ✅ UI shows pin button in deal details

**You're all set!** The pin feature should now work without any authorization issues. 🎉

---

## 📝 Notes

- **No RLS issues:** Edge Function uses service role key, bypasses RLS
- **Secure:** User validation happens in the function
- **Fast:** Direct database access via Edge Function
- **Scalable:** Can handle many users simultaneously

---

## 🐛 If Still Not Working

Check these:

1. **Function deployed?**
   ```bash
   supabase functions list
   ```
   You should see `manage-pinned-deals` in the list

2. **Environment variables set in Supabase?**
   - Dashboard → Project Settings → Edge Functions
   - Should have `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   (These are automatically available, no need to set manually)

3. **Browser console logs:**
   - Look for `[PinnedDeals]` messages
   - Share the full error if it still fails

---

Ready to deploy? Run:

```bash
supabase functions deploy manage-pinned-deals
```

🚀
