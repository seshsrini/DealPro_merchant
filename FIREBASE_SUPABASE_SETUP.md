# 🔑 Firebase Service Account Values for Supabase

## ✅ Step 1: Add These 3 Secrets to Supabase

Go to your Supabase Dashboard:
1. Open your project: https://supabase.com/dashboard
2. Click **Project Settings** (⚙️ gear icon)
3. Click **Edge Functions** in the left sidebar
4. Scroll down to **Secrets** section
5. Click **Add new secret** for each of these:

---

### Secret #1: FIREBASE_PROJECT_ID

**Name:**
```
FIREBASE_PROJECT_ID
```

**Value:**
```
dealpro-eacaf
```

---

### Secret #2: FIREBASE_CLIENT_EMAIL

**Name:**
```
FIREBASE_CLIENT_EMAIL
```

**Value:**
```
firebase-adminsdk-fbsvc@dealpro-eacaf.iam.gserviceaccount.com
```

---

### Secret #3: FIREBASE_PRIVATE_KEY

**Name:**
```
FIREBASE_PRIVATE_KEY
```

**Value:** (Copy EXACTLY as shown, including the `-----BEGIN` and `-----END` lines)
```
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC5K03S/ZvYkRwr
OVeHB14QqCd4SYdgkansrVvqlK+6dUX6slQyfZUUj9LlYgNHvHsigBnsK3xxakw/
1IKt1hN9M6CBYyjZ5ZFBOkNa4TZI5kwQ4OoYDjqWPrfSxq84i44MrcXPSzVS4czz
gdmNecIqglkoM6upzcpPy3fdxHCfYdGtU91uXnjNln4q9wKbLxGgzKxxdG/bLvDl
8vHnUur/D5o2LzQGvdkEXhAZBf0hJZK2dV21TlU5oFwGTBWfGcegCPX9essrt6sL
2gK/BJRYW7lW90XzXW4kKSwFVYHLXVBcy4kpQGtfPfvBS37uZPATlZyfgvhWR9LN
bpFXJOG1AgMBAAECggEAHSjCQaE++H9UG0PAEnseMgCjmTVNr0Rg/kIH1ndW+5ra
IUdnK5L2dgghYuPotlQ/uR1zzOrFgaqxRTVMOt8aWeirtD8O63lTmBz6XFuuIRQQ
aHFdYS+5xCKDmhqVnzxCwKELecBTLlvGhZYuJzGZr6Nah5J+IZL5nU/iRAxaMTmB
UpEpKn4V2wQTgxSzW1AOKCnWBF8++hOTFwOLheYQq13h/sKkSCPuImh6NQgF/dN8
63wTtLibnZqW2EWtRLpN16gVtxGx7ckQRF2cKTaZxtI0WIt/z3/rmjRbJKK0fjs8
VdfY/eZcPyXjJu91g/VsZQRIPmrQNIOjVhI3q57TJQKBgQDcacIS6yqu3TvqulIZ
E7fX39NauguxNE3lyi7MsWl5IZ0dqxO7X2CiVZM0rNxQyMziBbhg1xEzhXV4aorl
JDZr/HTnGmdRza+p0beE9Z67gU8KvKZ5UapbK7ZI9kf1fzfAJ1JeMtHOb9OkXCLw
7ZsLFd0TXNPIm9WxytCb0dcz2wKBgQDXENJ7Xfivei69boFyOR67q7lf6qAzcblV
hs+ATTKl4SeB4IvOPv6IaH7J2x6xL5ZpjrSOtlxHZPvOOscDdNq+nyxN8mEMhH8R
xRj+jlE5yR4duH24q+0O7rFpqVAuL/U+sCgCNq+VP90/xK1X5oE0todytikKOQHB
hELY0yv9rwKBgQCPj5rGs8GDT7m880qR5tPxmWmSSGdhLg4mw3+j91IZgZlSP6GE
g2TvlwlgX87IF2HLPaqP+MTNZ/nRSqPZB7MitrZ16C6vi2cFFwGPamPPATQ4bBOK
JXTuGRSLhU3tSsVHNNVjYXpiGVgiT5i6kChSGhV6jRWsLkQLn2wscYrXzQKBgF2E
0SIYINWdWcnBzcQvlm+hIsDUs8jrAN5x+rUd3JJJL/bH/8M1nVUPq2J3SAdgXBWW
mmkcX1AkV2K8KGIWZDBT4t4aMZ1R2DeP72hx1lw8Wj4uRW0SRckifj8mAtmyvP//
dcZQpVVPKhRan84DS9fyLz/wejQZyeuuaasDWLO9AoGBAMzWtI3amFsKjuQTpp2F
/+440V7oxvTo5CEOzdWaTkZ3TgQr1hJALDuYcMyCYkqNmw21cQXduSG4YNip2HCd
xbxvxeq2kXK7/a/PeUNRr6jNPnCWClCSKwA+BftUCtPYvpgRvFgE4at2esUcUFwW
8f9QkGEfkneDn19BfmCo2F1N
-----END PRIVATE KEY-----
```

⚠️ **IMPORTANT:** Make sure to copy the ENTIRE key including:
- The `-----BEGIN PRIVATE KEY-----` line
- All the middle content (all lines)
- The `-----END PRIVATE KEY-----` line
- DO NOT modify any characters or spaces

---

## ✅ Step 2: Verify Secrets Were Added

After adding all 3 secrets, you should see them listed in the Secrets section:

```
✓ FIREBASE_PROJECT_ID
✓ FIREBASE_CLIENT_EMAIL
✓ FIREBASE_PRIVATE_KEY
```

---

## 🔒 Security Reminder

✅ The JSON file has been added to `.gitignore`
✅ Never commit this file to Git
✅ Keep it in a secure location
✅ Don't share it publicly

---

## 🚀 Next Steps

After adding the secrets to Supabase:

1. **Deploy the Edge Function:**
   ```bash
   supabase functions deploy send-new-deal-notification
   ```

2. **Create the Database Webhook:**
   - Go to Supabase Dashboard → Database → Webhooks
   - Click "Create a new hook"
   - Configure:
     - Name: `new-deal-notification`
     - Table: `campaigns`
     - Events: `INSERT`
     - Type: `supabase_function`
     - Function: `send-new-deal-notification`

3. **Test it:**
   ```sql
   INSERT INTO campaigns (
     campaign_id, shop_name, deal_heading, offer_value,
     city, category, status, start_date, end_date
   ) VALUES (
     gen_random_uuid(), 'Test Store', 'Test Deal',
     '50% Off', 'Bangalore', 'Food & Dining',
     'active', NOW(), NOW() + INTERVAL '7 days'
   );
   ```

You should receive a notification: "🎉 New Deal Live!"

---

## 📋 Quick Checklist

```
[ ] Added FIREBASE_PROJECT_ID to Supabase secrets
[ ] Added FIREBASE_CLIENT_EMAIL to Supabase secrets
[ ] Added FIREBASE_PRIVATE_KEY to Supabase secrets
[ ] Verified all 3 secrets appear in Supabase Dashboard
[ ] Ready to deploy edge function
```

---

All values extracted from: `dealpro-eacaf-firebase-adminsdk-fbsvc-8c29c46deb.json`
