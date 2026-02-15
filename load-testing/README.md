# DealPro Load Testing Guide

## Overview
This directory contains load testing scripts to stress test the DealPro application with up to 100,000 users and 2,000 concurrent connections.

## Prerequisites

### 1. Install k6
**Windows (Chocolatey):**
```bash
choco install k6
```

**Windows (Manual):**
Download from https://k6.io/docs/get-started/installation/

**Verify installation:**
```bash
k6 version
```

### 2. Update Configuration
Edit `stress-test.js` and update these values:
```javascript
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### 3. Prepare Test Data
Before running the load test, ensure you have:
- Test user accounts in your database
- Active deals/campaigns to browse
- Proper database indexes on frequently queried fields

## Running the Tests

### Basic Test Run
```bash
cd C:\Srini\dealpro\dev\dealpro\load-testing
k6 run stress-test.js
```

### Run with Custom VUs (Virtual Users)
```bash
k6 run --vus 2000 --duration 30m stress-test.js
```

### Run with Cloud Output (k6 Cloud)
```bash
k6 cloud stress-test.js
```

### Run with InfluxDB + Grafana Dashboard
```bash
k6 run --out influxdb=http://localhost:8086/k6 stress-test.js
```

## Test Scenarios

### 1. Smoke Test (Quick validation)
```bash
k6 run --vus 10 --duration 1m stress-test.js
```

### 2. Load Test (Normal traffic)
```bash
k6 run --vus 500 --duration 10m stress-test.js
```

### 3. Stress Test (Peak traffic - 2000 concurrent)
```bash
k6 run --vus 2000 --duration 30m stress-test.js
```

### 4. Spike Test (Sudden traffic surge)
```bash
k6 run --stage 1m:0,1m:5000,1m:0 stress-test.js
```

### 5. Soak Test (Extended duration)
```bash
k6 run --vus 1000 --duration 2h stress-test.js
```

## Metrics to Monitor

### k6 Metrics
- **http_req_duration**: Response time (p95, p99)
- **http_req_failed**: Error rate
- **iterations**: Total completed user journeys
- **vus**: Active virtual users
- **http_reqs**: Requests per second

### Custom App Metrics
- **login_success_rate**: Authentication success %
- **deal_load_time**: Deal browsing performance
- **claim_success_rate**: Deal redemption success %
- **api_errors**: Total API errors

### Supabase Dashboard
Monitor during tests:
1. **Database Performance**
   - Active connections
   - Query performance
   - Index usage
   - Table sizes

2. **Edge Functions**
   - Invocation count
   - Error rate
   - Average execution time
   - Memory usage

3. **Storage**
   - Bandwidth usage
   - File operations/sec

4. **Auth**
   - Active sessions
   - Login attempts
   - Token validation rate

## Interpreting Results

### Good Performance Indicators
✅ p95 response time < 2000ms
✅ Error rate < 1%
✅ Login success rate > 95%
✅ Claim success rate > 90%
✅ No database connection pool exhaustion
✅ No memory leaks

### Warning Signs
⚠️ p95 response time > 3000ms
⚠️ Error rate > 5%
⚠️ Database CPU > 80%
⚠️ Memory usage climbing continuously
⚠️ Connection timeouts increasing

### Critical Issues
🚨 p95 response time > 10000ms
🚨 Error rate > 20%
🚨 Database connections maxed out
🚨 Edge Function cold starts causing timeouts
🚨 Rate limiting triggered

## Bottleneck Analysis

### Common Bottlenecks

1. **Database Queries**
   - Missing indexes on `city`, `status`, `start_date`
   - N+1 query problems
   - Full table scans
   - **Fix**: Add indexes, optimize queries, use database views

2. **Supabase Connection Limits**
   - Free tier: 60 connections
   - Pro tier: 200 connections
   - **Fix**: Upgrade plan, implement connection pooling

3. **Edge Function Cold Starts**
   - First request after idle is slow
   - **Fix**: Use keep-alive, upgrade to paid tier

4. **API Rate Limits**
   - Supabase: 1000 req/sec (free), higher for paid
   - Google Maps API: Check your quota
   - **Fix**: Implement caching, upgrade plans

5. **Image Loading**
   - Large images slow page load
   - **Fix**: Use CDN, optimize images, lazy loading

6. **Real-time Subscriptions**
   - Too many concurrent WebSocket connections
   - **Fix**: Implement reconnection logic, batch updates

## Optimization Recommendations

### Database Optimizations
```sql
-- Add indexes for common queries
CREATE INDEX idx_campaigns_city_status ON campaigns(city, status);
CREATE INDEX idx_campaigns_start_date ON campaigns(start_date) WHERE status = 'active';
CREATE INDEX idx_favorites_consumer ON favorites(consumer_id);
CREATE INDEX idx_claims_campaign ON claims(campaign_id, created_at);

-- Add composite index for location queries
CREATE INDEX idx_campaigns_location ON campaigns USING GIST (
  ll_to_earth(
    CAST(SPLIT_PART(latlong, ',', 1) AS FLOAT),
    CAST(SPLIT_PART(latlong, ',', 2) AS FLOAT)
  )
);

-- Enable query plan analysis
EXPLAIN ANALYZE SELECT * FROM campaigns WHERE city = 'Bangalore' AND status = 'active';
```

### Supabase Edge Function Optimizations
```typescript
// Use connection pooling
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    db: {
      schema: 'public',
    },
    global: {
      headers: { 'x-connection-pooling': 'true' },
    },
  }
);
```

### Frontend Optimizations
- Implement infinite scroll instead of loading all deals
- Add request debouncing for search
- Cache API responses with React Query
- Use React.memo for expensive components
- Implement virtual scrolling for long lists

## Alternative Tools

### 1. Apache JMeter
- GUI-based, beginner-friendly
- Good for complex scenarios
- Heavy on resources

### 2. Artillery
- YAML configuration
- Great for serverless/APIs
- Easy CI/CD integration

### 3. Locust
- Python-based
- Web UI for monitoring
- Distributed testing

### 4. Gatling
- Scala-based
- Beautiful HTML reports
- Enterprise-grade

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Load Test

on:
  schedule:
    - cron: '0 2 * * 1' # Weekly on Monday 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run k6 load test
        uses: grafana/k6-action@v0.3.0
        with:
          filename: load-testing/stress-test.js
          cloud: true
          token: ${{ secrets.K6_CLOUD_TOKEN }}
```

## Support

For issues or questions:
- k6 Documentation: https://k6.io/docs/
- Supabase Performance: https://supabase.com/docs/guides/platform/performance
- DealPro Team: Contact via app's Help & Feedback

## Test Data Cleanup

After load testing, clean up test data:
```sql
-- Remove test users
DELETE FROM users WHERE email LIKE '%@loadtest.com';

-- Remove test claims
DELETE FROM claims WHERE created_at > '2024-XX-XX' AND consumer_id LIKE 'testuser%';

-- Vacuum database
VACUUM ANALYZE;
```
