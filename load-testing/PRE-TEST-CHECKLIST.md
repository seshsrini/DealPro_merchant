# Pre-Test Checklist for DealPro Load Testing

Complete this checklist before running load tests to ensure accurate results and prevent issues.

## 📋 Environment Preparation

### Supabase Configuration
- [ ] **Verify Supabase plan** - Note current plan (Free/Pro/Team)
- [ ] **Check database size** - Run: `SELECT pg_size_pretty(pg_database_size(current_database()));`
- [ ] **Document connection limits** - Free: 60, Pro: 200, Team: 500
- [ ] **Note current usage** - Check active connections in Supabase Dashboard
- [ ] **Backup database** - Create snapshot before test
- [ ] **Review RLS policies** - Ensure they won't block test users
- [ ] **Check rate limits** - Understand current API quotas

### Database Optimization
- [ ] **Apply essential indexes** - Run `database-optimizations.sql` sections 1-2
- [ ] **Run VACUUM ANALYZE** - Clean up dead tuples
- [ ] **Check table bloat** - Run bloat queries from monitoring SQL
- [ ] **Verify pg_stat_statements is enabled** - For query monitoring
- [ ] **Reset statistics** - `SELECT pg_stat_statements_reset();`
- [ ] **Document baseline performance** - Run monitoring queries before test

### Application Configuration
- [ ] **Update test script** - Set correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- [ ] **Verify API endpoints** - Test manually that all endpoints work
- [ ] **Check Edge Functions** - Ensure all functions are deployed
- [ ] **Review error handling** - Confirm graceful degradation works
- [ ] **Test biometric auth** - Ensure fallback login works

## 🧪 Test Data Preparation

### User Accounts
- [ ] **Create test users** - Generate 1,000+ test accounts
- [ ] **Verify credentials** - Ensure test users can log in
- [ ] **Assign roles** - Mix of consumers and merchants
- [ ] **Add diversity** - Different cities, preferences, etc.
- [ ] **Document test accounts** - Save credentials securely

### Campaign Data
- [ ] **Seed campaigns** - Create 500+ active campaigns
- [ ] **Distribute geographically** - Cover major cities (Bangalore, Mumbai, Delhi, etc.)
- [ ] **Vary categories** - Food, Fashion, Electronics, Services
- [ ] **Set realistic dates** - Mix of current and future deals
- [ ] **Add images** - Use actual image URLs or placeholders
- [ ] **Verify visibility** - Ensure campaigns show up in app

### Merchant Data
- [ ] **Create merchant accounts** - At least 100 merchants
- [ ] **Add store locations** - Multiple stores per merchant
- [ ] **Verify store addresses** - Ensure coordinates are valid
- [ ] **Test deal creation** - Merchants can create deals
- [ ] **Check store hours** - Data is properly formatted

## 🔧 Tool Setup

### k6 Installation
- [ ] **Install k6** - Run `k6 version` to verify
- [ ] **Update k6** - Ensure latest version (0.48+)
- [ ] **Test k6** - Run simple test: `k6 run --vus 1 --duration 10s stress-test.js`
- [ ] **Check permissions** - Can write to output directory
- [ ] **Verify network access** - k6 can reach Supabase

### Monitoring Tools
- [ ] **Supabase Dashboard access** - Can view Database → Performance
- [ ] **Database client** - psql or GUI client connected
- [ ] **Browser DevTools** - For manual testing
- [ ] **Optional: Grafana** - For real-time visualization
- [ ] **Optional: Sentry** - For error tracking

## 📊 Monitoring Setup

### Supabase Monitoring
- [ ] **Open Supabase Dashboard** - Keep it visible during test
- [ ] **Database Performance tab** - Monitor CPU, memory, connections
- [ ] **Functions tab** - Watch invocations and errors
- [ ] **API tab** - Check request rates
- [ ] **Storage tab** - Monitor bandwidth if testing images

### Database Monitoring
- [ ] **Prepare monitoring queries** - Have `monitoring-queries.sql` ready
- [ ] **Open SQL editor** - Ready to run queries during test
- [ ] **Set up auto-refresh** - For real-time monitoring (if available)
- [ ] **Document baseline metrics** - Before test starts

### System Monitoring
- [ ] **Check client machine resources** - CPU, RAM, network
- [ ] **Close unnecessary apps** - Free up resources for k6
- [ ] **Disable antivirus temporarily** - May interfere with k6
- [ ] **Ensure stable network** - Wired connection preferred

## 🛡️ Safety Measures

### Backup and Recovery
- [ ] **Database backup created** - Can restore if needed
- [ ] **Document restore procedure** - Know how to rollback
- [ ] **Test data isolated** - Can identify and delete test data
- [ ] **Production data protected** - Not testing on production!

### Communication
- [ ] **Notify team** - Inform others about test
- [ ] **Schedule test time** - Off-peak hours preferred
- [ ] **Set up alerts** - Notify if critical issues occur
- [ ] **Prepare escalation plan** - Who to contact if issues arise

### Rollback Plan
- [ ] **Document how to stop test** - Ctrl+C, then verify stopped
- [ ] **Cleanup script ready** - To remove test data
- [ ] **Restore procedure tested** - Can quickly revert changes
- [ ] **Emergency contacts** - Supabase support, team leads

## 📝 Documentation

### Pre-Test Documentation
- [ ] **Document test objectives** - What are we measuring?
- [ ] **Define success criteria** - What results indicate success?
- [ ] **List known issues** - Existing bugs to ignore
- [ ] **Note environment state** - Current system status

### Results Template
- [ ] **Copy RESULTS_TEMPLATE.md** - Save as `results-YYYY-MM-DD.md`
- [ ] **Fill in test metadata** - Date, engineer, environment
- [ ] **Prepare screenshots folder** - To capture important graphs
- [ ] **Set up recording** - Screen recording for critical tests (optional)

## 🎯 Final Checks

### Functional Testing
- [ ] **Manual login test** - Can log in as test user
- [ ] **Browse deals** - Deals load correctly
- [ ] **Claim deal** - Claim flow works end-to-end
- [ ] **Favorite deal** - Favorites work
- [ ] **Search deals** - Search returns results
- [ ] **View profile** - User profile accessible

### Performance Baseline
- [ ] **Single user test** - Measure baseline performance
- [ ] **10 user smoke test** - Run `k6 run --vus 10 --duration 1m stress-test.js`
- [ ] **Review smoke test results** - No errors, reasonable times
- [ ] **Document baseline** - Save metrics for comparison

### Test Configuration Review
- [ ] **Verify VU count** - 2,000 concurrent users configured
- [ ] **Check total iterations** - 100,000 total users
- [ ] **Review test stages** - Ramp-up/sustain/spike periods correct
- [ ] **Validate thresholds** - Success criteria properly defined
- [ ] **Check think times** - Realistic user behavior simulated

## 🚀 Ready to Test!

Once all items are checked:

1. **Save this checklist** - With completion date and your name
2. **Take system snapshot** - Current state of all metrics
3. **Run final smoke test** - Quick validation
4. **Start monitoring** - Open all dashboards
5. **Execute test** - `k6 run stress-test.js`
6. **Monitor closely** - Watch for anomalies
7. **Document results** - Fill in RESULTS_TEMPLATE.md

## ⚠️ Stop Test If:

- Error rate exceeds 10%
- Database CPU stays at 100% for >2 minutes
- Connection pool exhausted
- Disk space running low (<10%)
- Unexpected errors in production-like environment

## 📞 Emergency Contacts

- **Supabase Support:** support@supabase.io
- **Team Lead:** [Name, Phone]
- **Database Admin:** [Name, Phone]
- **DevOps:** [Name, Phone]

---

**Checklist Completed By:** _________________
**Date:** _________________
**Time:** _________________

**Ready to Proceed:** ☐ YES ☐ NO (if NO, list blockers below)

**Blockers:**
1.
2.
3.

**Notes:**
