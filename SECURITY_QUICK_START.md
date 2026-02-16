# Security Quick Start Guide - DealPro

## 🔴 IMMEDIATE ACTIONS SUMMARY

### Current Security Status:
- ✅ Network Security Config created for Android
- ⚠️ 5 NPM vulnerabilities need attention
- ⚠️ Database RLS policies need to be enabled
- ⚠️ Input validation needs enhancement

---

## 1. Fix NPM Vulnerabilities

**Run this command:**
```bash
cd "C:\Srini\dealpro\dev\dealpro"
npm audit fix --force
```

**Note:** Test the app after running this command as it may include breaking changes.

---

## 2. Enable Database Row Level Security

**Go to Supabase Dashboard > SQL Editor and run:**

```sql
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_deals ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- Campaign policies
CREATE POLICY "View active campaigns" ON campaigns FOR SELECT USING (status = 'active');
CREATE POLICY "Merchants create campaigns" ON campaigns FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'merchant')
);
CREATE POLICY "Merchants edit own campaigns" ON campaigns FOR UPDATE USING (merchant_id = auth.uid());

-- Favorites policies
CREATE POLICY "Users view own favorites" ON favorites FOR SELECT USING (consumer_id = auth.uid());
CREATE POLICY "Users add favorites" ON favorites FOR INSERT WITH CHECK (consumer_id = auth.uid());
CREATE POLICY "Users delete own favorites" ON favorites FOR DELETE USING (consumer_id = auth.uid());
```

---

## 3. Next Steps

See the full guide in **SECURITY_AUDIT.md** for:
- Input validation
- Rate limiting
- Security headers
- Error monitoring
- And much more...

---

**Quick Reference:**
- Full Audit: `SECURITY_AUDIT.md`
- Priority: 🔴 Critical
- Time Needed: 2-3 hours for immediate fixes
