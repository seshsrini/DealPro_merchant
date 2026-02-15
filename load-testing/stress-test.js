// DealPro Load Testing Script with k6
// Install k6: https://k6.io/docs/get-started/installation/
// Run: k6 run stress-test.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const loginSuccessRate = new Rate('login_success_rate');
const dealLoadTime = new Trend('deal_load_time');
const apiErrors = new Counter('api_errors');
const claimSuccessRate = new Rate('claim_success_rate');

// Test configuration
export const options = {
  stages: [
    // Ramp-up: Gradually increase to 2000 concurrent users over 5 minutes
    { duration: '5m', target: 500 },
    { duration: '5m', target: 1000 },
    { duration: '5m', target: 2000 },

    // Sustain: Hold 2000 concurrent users for 20 minutes
    { duration: '20m', target: 2000 },

    // Spike test: Brief spike to 5000 users
    { duration: '2m', target: 5000 },
    { duration: '3m', target: 5000 },

    // Scale down
    { duration: '5m', target: 1000 },
    { duration: '5m', target: 0 },
  ],

  thresholds: {
    // 95% of requests should complete within 2 seconds
    'http_req_duration': ['p(95)<2000'],

    // Less than 1% error rate
    'http_req_failed': ['rate<0.01'],

    // Login success rate should be above 95%
    'login_success_rate': ['rate>0.95'],

    // Deal claim success rate should be above 90%
    'claim_success_rate': ['rate>0.90'],
  },

  // Total virtual users
  vus: 2000,

  // Total iterations (100,000 users = 100,000 iterations)
  iterations: 100000,
};

// Configuration - UPDATE THESE VALUES
const SUPABASE_URL = 'https://gkulyxglzqlhpqxlwjqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrdWx5eGdsenFsaHBxeGx3anF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjA4MjIsImV4cCI6MjA4NDQzNjgyMn0.liawuu5aYsaS6IcELQwGGzsho_ZGBTeGpAwPMCm2l7c';

// Test data pools - USING YOUR REAL EXISTING USERS
// Replace these with your actual user credentials from your app
const TEST_USERS = [
  {
    username: 'srini',     // ← Put your actual username here
    email: 'srini@gmail.com', // ← Put your actual email here
    password: '123India',    // ← Put your actual password here
  },
  // Optional: Add more real users if you have them (1-3 users is enough!)
  // {
  //   username: 'another_user',
  //   email: 'another@example.com',
  //   password: 'AnotherPassword',
  // },
];

const TEST_LOCATIONS = [
  { lat: 12.9716, lng: 77.5946, city: 'Bangalore' },
  { lat: 28.7041, lng: 77.1025, city: 'Delhi' },
  { lat: 19.0760, lng: 72.8777, city: 'Mumbai' },
  { lat: 13.0827, lng: 80.2707, city: 'Chennai' },
  { lat: 22.5726, lng: 88.3639, city: 'Kolkata' },
];

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Main test scenario - simulates realistic user journey
export default function () {
  const user = randomElement(TEST_USERS);
  const location = randomElement(TEST_LOCATIONS);

  let authToken = null;

  // 1. USER LOGIN
  group('User Authentication', () => {
    const loginPayload = JSON.stringify({
      identifier: user.username,
      password: user.password,
    });

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

    const loginSuccess = check(loginRes, {
      'login status is 200': (r) => r.status === 200,
      'login response has session': (r) => {
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
      apiErrors.add(1);
      return; // Skip rest of test if login fails
    }
  });

  sleep(1); // Think time

  // 2. BROWSE DEALS (Location-based query)
  group('Browse Deals', () => {
    const start = Date.now();

    const dealsRes = http.get(
      `${SUPABASE_URL}/rest/v1/campaigns?` +
      `city=eq.${location.city}&` +
      `status=eq.active&` +
      `select=*`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    const loadTime = Date.now() - start;
    dealLoadTime.add(loadTime);

    check(dealsRes, {
      'deals loaded successfully': (r) => r.status === 200,
      'deals response is valid JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch {
          return false;
        }
      },
    });
  });

  sleep(2); // User browses deals

  // 3. VIEW DEAL DETAILS
  group('View Deal Details', () => {
    // Simulate viewing a specific campaign
    const campaignId = `campaign-${Math.floor(Math.random() * 1000)}`;

    const detailsRes = http.get(
      `${SUPABASE_URL}/rest/v1/campaigns?campaign_id=eq.${campaignId}`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    check(detailsRes, {
      'deal details loaded': (r) => r.status === 200,
    });
  });

  sleep(3); // User reads deal details

  // 4. CLAIM DEAL (20% of users claim a deal)
  if (Math.random() < 0.2) {
    group('Claim Deal', () => {
      const claimPayload = JSON.stringify({
        campaign_id: `campaign-${Math.floor(Math.random() * 1000)}`,
        consumer_id: user.username,
      });

      const claimRes = http.post(
        `${SUPABASE_URL}/functions/v1/claim-deal`,
        claimPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      const claimSuccess = check(claimRes, {
        'claim successful': (r) => r.status === 200,
      });

      claimSuccessRate.add(claimSuccess);
    });

    sleep(2);
  }

  // 5. SEARCH FUNCTIONALITY (30% of users search)
  if (Math.random() < 0.3) {
    group('Search Deals', () => {
      const searchQuery = ['food', 'fashion', 'electronics', 'services'][Math.floor(Math.random() * 4)];

      const searchRes = http.get(
        `${SUPABASE_URL}/rest/v1/campaigns?` +
        `category=ilike.%${searchQuery}%&` +
        `status=eq.active`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      check(searchRes, {
        'search successful': (r) => r.status === 200,
      });
    });

    sleep(1);
  }

  // 6. VIEW FAVORITES (10% of users)
  if (Math.random() < 0.1) {
    group('View Favorites', () => {
      const favRes = http.get(
        `${SUPABASE_URL}/rest/v1/favorites?consumer_id=eq.${user.username}`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      check(favRes, {
        'favorites loaded': (r) => r.status === 200,
      });
    });
  }

  sleep(1); // Final think time before session ends
}

// Optional: Setup function runs once per VU at the start
export function setup() {
  console.log('🚀 Starting DealPro Load Test');
  console.log(`📊 Target: 100,000 total users, 2,000 concurrent`);
  return { timestamp: Date.now() };
}

// Optional: Teardown function runs once at the end
export function teardown(data) {
  console.log('✅ Load test completed');
  console.log(`⏱️  Duration: ${(Date.now() - data.timestamp) / 1000}s`);
}
