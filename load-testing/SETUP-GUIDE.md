# Step-by-Step Setup Guide for k6 Load Testing

Follow these steps exactly to set up and run your first load test.

## Step 1: Install k6 (5 minutes)

### Option A: Using Chocolatey (Recommended)

1. **Open PowerShell as Administrator**
   - Press `Win + X`
   - Click "Windows PowerShell (Admin)" or "Terminal (Admin)"

2. **Install Chocolatey** (if not already installed)
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

3. **Install k6**
   ```powershell
   choco install k6
   ```

4. **Verify Installation**
   ```powershell
   k6 version
   ```

   Expected output: `k6 v0.48.0 (or newer)`

### Option B: Manual Installation

1. Download k6 from: https://github.com/grafana/k6/releases
2. Download the `.msi` installer for Windows
3. Run the installer
4. Verify by opening Command Prompt and running: `k6 version`

---

## Step 2: Get Supabase Credentials (2 minutes)

1. **Open your Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your DealPro project

2. **Navigate to Settings → API**

3. **Copy these values:**
   - **Project URL:** `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

4. **Save them temporarily** - You'll need them in the next step

---

## Step 3: Configure the Test Script (2 minutes)

1. **Open the test script**
   - File: `C:\Srini\dealpro\dev\dealpro\load-testing\stress-test.js`
   - Use any text editor (VS Code, Notepad++, etc.)

2. **Find these lines** (around line 54-55):
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```

3. **Replace with your actual values:**
   ```javascript
   const SUPABASE_URL = 'https://xxxxxxxxxxxxx.supabase.co';  // Your Project URL
   const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';  // Your anon key
   ```

4. **Save the file** (Ctrl+S)

---

## Step 4: Optimize Database (5 minutes)

This step is CRITICAL for good performance!

1. **Open Supabase SQL Editor**
   - In Supabase Dashboard → SQL Editor
   - Click "New query"

2. **Copy and paste this essential optimization:**
   ```sql
   -- Essential indexes for load testing
   CREATE INDEX IF NOT EXISTS idx_campaigns_city_status
   ON campaigns(city, status) WHERE status = 'active';

   CREATE INDEX IF NOT EXISTS idx_campaigns_date
   ON campaigns(start_date, end_date) WHERE status = 'active';

   CREATE INDEX IF NOT EXISTS idx_claims_consumer
   ON claims(consumer_id, created_at DESC);

   CREATE INDEX IF NOT EXISTS idx_favorites_consumer
   ON favorites(consumer_id);

   CREATE INDEX IF NOT EXISTS idx_users_username
   ON users(username);

   -- Update statistics
   ANALYZE campaigns;
   ANALYZE claims;
   ANALYZE users;
   ANALYZE favorites;
   ```

3. **Run the query** (Click "Run" or press F5)

4. **Wait for completion** - Should take 10-30 seconds

5. **Verify indexes were created:**
   ```sql
   SELECT schemaname, tablename, indexname
   FROM pg_indexes
   WHERE schemaname = 'public'
   ORDER BY tablename, indexname;
   ```

---

## Step 5: Run Your First Test - Smoke Test (2 minutes)

Let's start with a small test to make sure everything works!

1. **Open Command Prompt or PowerShell**

2. **Navigate to the load-testing directory:**
   ```bash
   cd C:\Srini\dealpro\dev\dealpro\load-testing
   ```

3. **Run a SMOKE TEST (10 users for 1 minute):**
   ```bash
   k6 run --vus 10 --duration 1m stress-test.js
   ```

4. **Watch the output!** You should see:
   ```
   running (1m00.0s), 00/10 VUs, 1234 complete and 0 interrupted iterations
   default ✓ [======================================] 10 VUs  1m0s

   ✓ login status is 200
   ✓ deals loaded successfully
   ✓ claim successful

   checks.........................: 98.5% ✓ 1234 ✗ 19
   data_received..................: 12 MB  200 kB/s
   data_sent......................: 4.5 MB 75 kB/s
   http_req_duration..............: avg=450ms min=120ms med=380ms max=2.3s p(95)=1.2s
   http_req_failed................: 0.12% ✓ 5    ✗ 4123
   iterations.....................: 1234   20.5/s
   vus............................: 10     min=10 max=10
   ```

### ✅ Success Criteria for Smoke Test:
- **No errors during startup** ✓
- **http_req_failed < 5%** ✓
- **http_req_duration p(95) < 3s** ✓
- **Some iterations completed** ✓

### 🚨 If You See Errors:

**Error: "Connection refused"**
- Check your `SUPABASE_URL` is correct
- Make sure it includes `https://`

**Error: "401 Unauthorized"**
- Verify your `SUPABASE_ANON_KEY` is correct
- Check for extra spaces or quotes

**Error: "Cannot find module"**
- Make sure you're in the correct directory
- Run `pwd` or `cd` to check your location

---

## Step 6: Analyze the Results (3 minutes)

After the smoke test completes, look at these key metrics:

### 1. **Overall Error Rate**
```
http_req_failed................: 0.12%
```
- **Good:** < 1%
- **Warning:** 1-5%
- **Bad:** > 5%

### 2. **Response Times**
```
http_req_duration..............: avg=450ms med=380ms p(95)=1.2s
```
- **avg (average):** Should be < 1000ms
- **p(95) (95th percentile):** Should be < 2000ms
- **max:** Can spike occasionally

### 3. **Custom Metrics**
```
login_success_rate.............: 98.5%
deal_load_time (avg)...........: 450ms
claim_success_rate.............: 91.2%
```
- **login_success_rate:** Should be > 95%
- **claim_success_rate:** Should be > 90%

### 4. **Throughput**
```
http_reqs......................: 4128   68.8/s
iterations.....................: 1234   20.5/s
```
- This tells you how many requests per second your app handled
- Higher is better!

---

## Step 7: Run Incremental Load Tests

Once smoke test passes, gradually increase load:

### Test 1: Light Load (100 users)
```bash
k6 run --vus 100 --duration 5m stress-test.js
```

### Test 2: Medium Load (500 users)
```bash
k6 run --vus 500 --duration 10m stress-test.js
```

### Test 3: Heavy Load (1000 users)
```bash
k6 run --vus 1000 --duration 15m stress-test.js
```

### Test 4: FULL STRESS TEST (2000 users)
```bash
k6 run stress-test.js
```
This runs the full test with ramp-up, spike, and scale-down stages (40 minutes total).

---

## Step 8: Monitor During Test

### Open Supabase Dashboard
1. Go to **Database → Performance**
2. Watch:
   - **CPU Usage** (should stay < 80%)
   - **Active Connections** (should stay under limit)
   - **Query Performance**

### Run Monitoring Queries
Open another terminal and connect to your database:

```bash
# In Supabase SQL Editor, run this during test:
SELECT count(*) as active_connections,
       state
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;
```

---

## Step 9: Document Results

1. **Copy the results template:**
   ```bash
   copy RESULTS_TEMPLATE.md results-2024-02-14.md
   ```

2. **Fill in the metrics:**
   - Copy k6 output into the template
   - Add screenshots from Supabase Dashboard
   - Document any errors or issues

3. **Save for future reference**

---

## Troubleshooting Common Issues

### Issue 1: k6 command not found
**Solution:**
```bash
# Close and reopen your terminal
# OR add k6 to PATH manually
```

### Issue 2: Test users don't exist
**Solution:**
Create test users in Supabase:
```sql
-- Create a test user
INSERT INTO users (username, email, password_hash, role)
VALUES ('testuser0', 'testuser0@loadtest.com', crypt('TestPassword123!', gen_salt('bf')), 'consumer');
```

### Issue 3: High error rate (> 10%)
**Solution:**
- Reduce concurrent users: `--vus 100`
- Check database indexes were created
- Review Supabase logs for specific errors

### Issue 4: Very slow response times (> 10s)
**Solution:**
1. Run database optimizations again
2. Check if database is underpowered
3. Consider upgrading Supabase plan

---

## Next Steps After Successful Test

1. ✅ **Smoke test passed** → Run medium load test
2. ✅ **Medium test passed** → Run heavy load test
3. ✅ **Heavy test passed** → Run full stress test
4. ✅ **Full test passed** → Your app is production-ready! 🎉

5. **Set up monitoring in production:**
   - Configure alerts for high error rates
   - Monitor response times
   - Track database performance

6. **Plan for scaling:**
   - If tests show bottlenecks, apply recommendations
   - Consider upgrading Supabase plan
   - Implement caching if needed

---

## Quick Reference

### Run Tests
```bash
# Smoke test (1 min, 10 users)
k6 run --vus 10 --duration 1m stress-test.js

# Light load (5 min, 100 users)
k6 run --vus 100 --duration 5m stress-test.js

# Full stress test (40 min, up to 2000 users)
k6 run stress-test.js

# Save results to file
k6 run --out json=results.json stress-test.js
```

### View Results
```bash
# Real-time output (default)
k6 run stress-test.js

# Detailed HTTP debugging
k6 run --http-debug stress-test.js

# Summary only
k6 run --summary-export=summary.json stress-test.js
```

---

## Support

If you get stuck:
1. Check [README.md](README.md) for detailed docs
2. Review [quick-start.md](quick-start.md) for troubleshooting
3. Search k6 docs: https://k6.io/docs/
4. Check Supabase status: https://status.supabase.com/

Good luck! 🚀
