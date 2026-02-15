# Quick Start Guide: Load Testing DealPro

## 5-Minute Setup

### Step 1: Install k6 (1 minute)
```bash
# Windows (PowerShell as Administrator)
choco install k6

# OR download installer from:
# https://github.com/grafana/k6/releases
```

### Step 2: Configure Test (2 minutes)

1. Open `stress-test.js`
2. Update these two lines:
```javascript
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-from-supabase-settings';
```

Find these values in:
- Supabase Dashboard → Settings → API
- Copy "Project URL" and "anon public" key

### Step 3: Optimize Database (2 minutes)

Open Supabase SQL Editor and run:
```sql
-- Critical indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_city_status
ON campaigns(city, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_campaigns_date
ON campaigns(start_date, end_date) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_claims_consumer
ON claims(consumer_id, created_at DESC);

-- Update statistics
ANALYZE campaigns;
ANALYZE claims;
ANALYZE users;
```

### Step 4: Run Test

```bash
cd C:\Srini\dealpro\dev\dealpro\load-testing

# Start with a small test (10 users)
k6 run --vus 10 --duration 1m stress-test.js

# If successful, run the full test (2000 concurrent users)
k6 run stress-test.js
```

## Understanding Results

### Key Metrics

**✅ GOOD Performance:**
```
http_req_duration..........: avg=450ms  med=380ms  p(95)=1200ms
http_req_failed............: 0.12%
iterations.................: 95000
```
- Average response: 450ms ✅
- 95th percentile: 1200ms ✅
- Error rate: 0.12% ✅

**⚠️ WARNING Signs:**
```
http_req_duration..........: avg=2100ms  med=1800ms  p(95)=4500ms
http_req_failed............: 3.45%
iterations.................: 78000
```
- Average response: 2100ms (slow)
- 95th percentile: 4500ms (very slow)
- Error rate: 3.45% (high)
- Need optimization!

**🚨 CRITICAL Issues:**
```
http_req_duration..........: avg=8500ms  med=6200ms  p(95)=15000ms
http_req_failed............: 18.23%
iterations.................: 42000
```
- Average response: 8.5 seconds 🚨
- Massive error rate: 18.23% 🚨
- System is overloaded!

## Common Issues & Fixes

### Issue 1: "Connection refused"
**Symptom:** Tests fail immediately
**Fix:**
```javascript
// Check your Supabase URL is correct
const SUPABASE_URL = 'https://xxxx.supabase.co'; // Must include https://
```

### Issue 2: "401 Unauthorized"
**Symptom:** All API calls fail with 401
**Fix:**
- Verify your `SUPABASE_ANON_KEY` is correct
- Check if RLS (Row Level Security) is blocking requests
- Ensure test users exist in database

### Issue 3: High error rate (>5%)
**Symptom:** `http_req_failed: 12%`
**Possible causes:**
1. Database connection limit reached
2. Missing indexes causing timeouts
3. Supabase rate limiting
4. Edge Functions timing out

**Quick Fix:**
```bash
# Reduce concurrent users
k6 run --vus 500 --duration 5m stress-test.js

# Monitor Supabase Dashboard during test
# Check: Database → Performance
```

### Issue 4: Slow response times (>3s)
**Symptom:** `p(95)=5200ms`
**Fix:** Run database optimizations
```sql
-- Open Supabase SQL Editor
-- Copy/paste from database-optimizations.sql
-- Run sections 1 (Indexes) and 8 (VACUUM)
```

## Test Scenarios Explained

### Scenario 1: Smoke Test (Quick validation)
```bash
k6 run --vus 10 --duration 1m stress-test.js
```
- **Purpose:** Verify test works
- **Duration:** 1 minute
- **Users:** 10
- **When to use:** First test, after code changes

### Scenario 2: Load Test (Normal traffic)
```bash
k6 run --vus 500 --duration 10m stress-test.js
```
- **Purpose:** Test typical load
- **Duration:** 10 minutes
- **Users:** 500 concurrent
- **When to use:** Regular testing

### Scenario 3: Stress Test (Full load - 2000 users)
```bash
k6 run stress-test.js
```
- **Purpose:** Test maximum capacity
- **Duration:** 40 minutes (see stages in script)
- **Users:** Ramps up to 2000, spikes to 5000
- **When to use:** Before launch, major updates

### Scenario 4: Soak Test (Endurance)
```bash
k6 run --vus 1000 --duration 2h stress-test.js
```
- **Purpose:** Find memory leaks
- **Duration:** 2 hours
- **Users:** 1000 steady
- **When to use:** Before production release

## Monitor During Tests

### Supabase Dashboard
While test runs, watch:
1. **Database → Performance**
   - CPU usage (should stay <80%)
   - Active connections
   - Query performance

2. **Functions**
   - Invocation count
   - Error rate
   - Execution time

### k6 Output
Watch these live metrics:
```
✓ login status is 200........: 98.5%
✓ deals loaded successfully..: 99.1%
✓ claim successful...........: 91.2%

http_req_duration............: avg=420ms
vus..........................: 1823 (current)
```

## Next Steps

### If Tests Pass (Error rate <1%, p95 <2s)
✅ Your app can handle the load!
- Document results
- Set up monitoring in production
- Plan for scaling if needed

### If Tests Fail (Error rate >5%, p95 >5s)
📋 Optimization checklist:
1. ☐ Run `database-optimizations.sql` (section 1 & 8)
2. ☐ Check Supabase plan limits
3. ☐ Review slow queries with `monitoring-queries.sql`
4. ☐ Optimize Edge Functions
5. ☐ Add caching layer
6. ☐ Consider upgrading Supabase plan

## Get Help

### Resources
- k6 Docs: https://k6.io/docs/
- Supabase Performance: https://supabase.com/docs/guides/platform/performance
- PostgreSQL Tuning: https://pgtune.leopard.in.ua/

### Debug Mode
Run test with verbose output:
```bash
k6 run --http-debug stress-test.js
```

### Save Results
```bash
# Export to JSON
k6 run --out json=results.json stress-test.js

# Export to CSV
k6 run --out csv=results.csv stress-test.js
```

## Success Criteria

Your app is ready for production if:
- ✅ 95th percentile response time < 2 seconds
- ✅ Error rate < 1%
- ✅ Database CPU stays < 80%
- ✅ No memory leaks in 2-hour soak test
- ✅ Can handle 2x expected peak traffic

Good luck! 🚀
