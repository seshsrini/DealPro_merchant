// DealPro Load Testing - Simplified Version
// Focuses on authentication and basic performance testing
// Works with your actual database schema

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const loginSuccessRate = new Rate('login_success_rate');
const apiResponseTime = new Trend('api_response_time');
const apiErrors = new Counter('api_errors');

// Test configuration - 10 users for 1 minute
export const options = {
  vus: 10,
  duration: '1m',

  thresholds: {
    'http_req_duration': ['p(95)<2000'],  // 95% of requests under 2s
    'http_req_failed': ['rate<0.05'],     // Less than 5% errors
    'login_success_rate': ['rate>0.95'],  // 95%+ login success
  },
};

// Configuration - Already set from your stress-test.js
const SUPABASE_URL = 'https://gkulyxglzqlhpqxlwjqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrdWx5eGdsenFsaHBxeGx3anF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjA4MjIsImV4cCI6MjA4NDQzNjgyMn0.liawuu5aYsaS6IcELQwGGzsho_ZGBTeGpAwPMCm2l7c';

// Your real user credentials
const TEST_USER = {
  username: 'srini',
  email: 'srini@gmail.com',
  password: '123India'
};

// Main test scenario
export default function () {
  let authToken = null;

  // 1. USER LOGIN
  group('Authentication', () => {
    const loginPayload = JSON.stringify({
      identifier: TEST_USER.username,
      password: TEST_USER.password,
    });

    const start = Date.now();
    const loginRes = http.post(
      `${SUPABASE_URL}/functions/v1/login`,
      loginPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
      }
    );
    const duration = Date.now() - start;
    apiResponseTime.add(duration);

    const loginSuccess = check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login has session token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.session && body.session.access_token;
        } catch {
          return false;
        }
      },
    });

    loginSuccessRate.add(loginSuccess);

    if (loginSuccess) {
      const body = JSON.parse(loginRes.body);
      authToken = body.session.access_token;
    } else {
      console.error('Login failed:', loginRes.status, loginRes.body);
      apiErrors.add(1);
      return; // Skip rest if login fails
    }
  });

  sleep(1); // Simulate user think time

  // 2. FETCH USER PROFILE
  if (authToken) {
    group('User Profile', () => {
      const start = Date.now();
      const profileRes = http.get(
        `${SUPABASE_URL}/rest/v1/user_profiles?username=eq.${TEST_USER.username}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );
      const duration = Date.now() - start;
      apiResponseTime.add(duration);

      check(profileRes, {
        'profile loaded': (r) => r.status === 200,
        'profile has data': (r) => {
          try {
            const data = JSON.parse(r.body);
            return Array.isArray(data) && data.length > 0;
          } catch {
            return false;
          }
        },
      });

      if (profileRes.status !== 200) {
        apiErrors.add(1);
      }
    });

    sleep(1);
  }

  // 3. BROWSE ACTIVE CAMPAIGNS
  if (authToken) {
    group('Browse Campaigns', () => {
      const start = Date.now();
      const campaignsRes = http.get(
        `${SUPABASE_URL}/rest/v1/campaigns?status=eq.active&select=campaign_id,deal_heading,shop_name,offer_value,latlong,start_date,end_date&limit=20`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );
      const duration = Date.now() - start;
      apiResponseTime.add(duration);

      check(campaignsRes, {
        'campaigns loaded': (r) => r.status === 200,
        'campaigns has data': (r) => {
          try {
            const data = JSON.parse(r.body);
            return Array.isArray(data);
          } catch {
            return false;
          }
        },
      });

      if (campaignsRes.status !== 200) {
        apiErrors.add(1);
      }
    });

    sleep(2); // User browses campaigns
  }

  // 4. VIEW MERCHANT STORES
  if (authToken && Math.random() < 0.5) { // 50% of users
    group('Merchant Stores', () => {
      const start = Date.now();
      const storesRes = http.get(
        `${SUPABASE_URL}/rest/v1/merchant_stores?select=id,store_name,address,city&limit=10`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );
      const duration = Date.now() - start;
      apiResponseTime.add(duration);

      check(storesRes, {
        'stores loaded': (r) => r.status === 200,
      });

      if (storesRes.status !== 200) {
        apiErrors.add(1);
      }
    });

    sleep(1);
  }

  // 5. CHECK FAVORITES
  if (authToken && Math.random() < 0.3) { // 30% of users
    group('User Favorites', () => {
      const start = Date.now();
      const favoritesRes = http.get(
        `${SUPABASE_URL}/rest/v1/favorites?select=*&limit=10`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );
      const duration = Date.now() - start;
      apiResponseTime.add(duration);

      check(favoritesRes, {
        'favorites loaded': (r) => r.status === 200,
      });

      if (favoritesRes.status !== 200) {
        apiErrors.add(1);
      }
    });

    sleep(1);
  }

  sleep(1); // Final think time
}

// Setup function
export function setup() {
  console.log('🚀 Starting DealPro Load Test (Simplified)');
  console.log(`📊 Testing with user: ${TEST_USER.username}`);
  console.log(`⏱️  Duration: 1 minute with 10 concurrent users`);
  return { timestamp: Date.now() };
}

// Teardown function
export function teardown(data) {
  console.log('✅ Load test completed');
  const duration = (Date.now() - data.timestamp) / 1000;
  console.log(`⏱️  Total duration: ${duration.toFixed(1)}s`);
}
