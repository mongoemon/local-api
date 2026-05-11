/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TEST TYPE: SCENARIO TEST (MIXED WORKLOAD)                      ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  PURPOSE                                                         ║
 * ║  Run MULTIPLE DIFFERENT USER TYPES simultaneously, each with    ║
 * ║  different request patterns. Real traffic is never uniform —    ║
 * ║  you have fast readers, slow writers, heavy processors, etc.    ║
 * ║                                                                  ║
 * ║  WHEN TO RUN                                                     ║
 * ║  • When your production traffic has distinct user types          ║
 * ║  • Testing that one user type doesn't degrade others             ║
 * ║  • More realistic load simulation than a single-pattern test     ║
 * ║                                                                  ║
 * ║  SCENARIOS IN THIS FILE                                          ║
 * ║  1. light_users    — fast reads, minimal load (most common)     ║
 * ║  2. api_users      — auth + data submission (moderate)          ║
 * ║  3. heavy_users    — CPU/memory/IO intensive (rare but costly)  ║
 * ║  4. constant_rate  — constant-arrival-rate (fixed RPS target)   ║
 * ║                                                                  ║
 * ║  HOW TO RUN                                                      ║
 * ║  k6 run k6/tests/07-scenarios.js                                ║
 * ║  k6 run --env PROJECT_SIZE=medium k6/tests/07-scenarios.js      ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';

import {
  BASE_URL,
  jsonHeaders,
  login,
  getBearerToken,
  parseBody,
  thinkTime,
  randomItem,
} from '../utils/helpers.js';
import { SIZE_LABEL } from '../config/sizes.js';

// ─── Scenario definitions ─────────────────────────────────────────────────────
// k6 `scenarios` runs each named scenario independently in parallel.
// Each scenario has its own VU pool, executor type, and target function.
//
// EXECUTOR TYPES (common ones):
//
//   ramping-vus
//     Ramp VUs up/down via stages. Familiar from basic tests.
//     Good for: simulating a growing/shrinking user base.
//
//   constant-vus
//     Fixed number of VUs for a fixed duration.
//     Good for: sustained steady traffic.
//
//   constant-arrival-rate
//     Deliver a fixed number of REQUESTS PER SECOND regardless of how long
//     each request takes. k6 adds more VUs automatically if needed.
//     Good for: simulating a target RPS from an API gateway or load balancer.
//
//   per-vu-iterations
//     Each VU runs exactly N iterations.
//     Good for: batch jobs, migration testing.
//
export const options = {
  scenarios: {
    // ── Scenario 1: Light users ──────────────────────────────────────────────
    // These represent the majority of your traffic: quick reads, status checks.
    // Fast requests, realistic think time (1–3 seconds between clicks).
    light_users: {
      executor:  'ramping-vus',
      exec:      'lightUserFlow',
      startVUs:  1,
      stages: [
        { duration: '30s', target: 5 }, // ramp up
        { duration: '2m',  target: 5 }, // hold
        { duration: '30s', target: 0 }, // ramp down
      ],
      gracefulRampDown: '10s',
      tags: { scenario: 'light' },
    },

    // ── Scenario 2: API users ────────────────────────────────────────────────
    // Users who authenticate and submit data. Moderate load per request.
    // Starts 30 seconds after light_users to let the server warm up.
    api_users: {
      executor:  'ramping-vus',
      exec:      'apiUserFlow',
      startTime: '30s',    // wait 30s before this scenario starts
      startVUs:  1,
      stages: [
        { duration: '30s', target: 3 },
        { duration: '2m',  target: 3 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
      tags: { scenario: 'api' },
    },

    // ── Scenario 3: Heavy users ──────────────────────────────────────────────
    // Users who trigger CPU/memory/IO-intensive operations.
    // Few in number but each request is expensive. Starts after api_users.
    heavy_users: {
      executor:  'constant-vus',
      exec:      'heavyUserFlow',
      startTime: '1m',     // wait 1 minute before starting
      vus:       2,
      duration:  '2m',
      tags: { scenario: 'heavy' },
    },

    // ── Scenario 4: Constant arrival rate ────────────────────────────────────
    // Delivers a fixed RPS target, simulating a load balancer or gateway.
    // Useful for testing: "can we sustain 10 req/s on /fast endpoints?"
    constant_rate: {
      executor:         'constant-arrival-rate',
      exec:             'constantRateFlow',
      startTime:        '30s',
      rate:             10,          // 10 requests per second
      timeUnit:         '1s',
      duration:         '2m',
      preAllocatedVUs:  15,          // pre-create 15 VUs to handle the rate
      maxVUs:           30,          // allow k6 to add up to 30 if needed
      tags: { scenario: 'constant_rate' },
    },
  },

  thresholds: {
    http_req_duration:                         ['p(95)<1000'],
    http_req_failed:                           ['rate<0.05'],
    // Per-scenario thresholds using the scenario tag
    'http_req_duration{scenario:light}':       ['p(95)<300'],   // light users should be fast
    'http_req_duration{scenario:api}':         ['p(95)<800'],
    'http_req_duration{scenario:heavy}':       ['p(95)<10000'], // heavy requests can be slow
    'http_req_duration{scenario:constant_rate}': ['p(95)<500'],
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────────
export function setup() {
  console.log(`\n🎭 Scenario Test — project size: ${SIZE_LABEL} — target: ${BASE_URL}`);
  console.log('   Running 4 user type scenarios simultaneously.\n');

  return {
    bearerToken: getBearerToken(),
    jwtToken:    login(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO FUNCTIONS
// Each function below is the `exec` target for one scenario.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scenario 1: Light users
 * Quick reads, frequent visits, minimal server load.
 */
export function lightUserFlow() {
  group('light: status check', () => {
    const res = http.get(`${BASE_URL}/status`, { tags: { name: 'light_status' } });
    check(res, { 'status: 200': (r) => r.status === 200 });
  });

  thinkTime(0.5, 1.0);

  group('light: fast endpoint', () => {
    const res = http.get(`${BASE_URL}/fast`, { tags: { name: 'light_fast' } });
    check(res, { 'fast: 200': (r) => r.status === 200 });
  });

  thinkTime(1, 3);
}

/**
 * Scenario 2: API users
 * Authenticate and submit data — realistic backend API usage pattern.
 */
export function apiUserFlow(data) {
  group('api: login', () => {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ username: 'demo', password: 'password' }),
      { headers: jsonHeaders, tags: { name: 'api_login' } }
    );
    check(res, {
      'login: 200':       (r) => r.status === 200,
      'login: has token': (r) => typeof (parseBody(r) || {}).token === 'string',
    });
  });

  thinkTime(0.5, 1.0);

  group('api: submit data', () => {
    const names = ['api-user-a', 'api-user-b', 'api-user-c'];
    const types = ['query', 'update', 'report'];

    const res = http.post(
      `${BASE_URL}/submit-two`,
      JSON.stringify({ name: randomItem(names), type: randomItem(types) }),
      { headers: jsonHeaders, tags: { name: 'api_submit' } }
    );
    check(res, { 'submit: 200': (r) => r.status === 200 });
  });

  thinkTime(1.5, 3);
}

/**
 * Scenario 3: Heavy users
 * CPU/memory/IO intensive — simulates batch jobs, report generation, etc.
 */
export function heavyUserFlow() {
  group('heavy: cpu task', () => {
    const res = http.get(`${BASE_URL}/cpu`, {
      tags:    { name: 'heavy_cpu' },
      timeout: '60s',
    });
    check(res, { 'cpu: responded': (r) => r.status === 200 || r.status === 503 });
  });

  sleep(2); // Heavy users wait longer between tasks

  group('heavy: memory task', () => {
    const res = http.get(`${BASE_URL}/memory`, {
      tags:    { name: 'heavy_memory' },
      timeout: '30s',
    });
    check(res, { 'memory: responded': (r) => r.status === 200 || r.status === 503 });
  });

  sleep(3);

  group('heavy: io task', () => {
    const res = http.get(`${BASE_URL}/io?mode=read`, {
      tags:    { name: 'heavy_io' },
      timeout: '30s',
    });
    check(res, { 'io: responded': (r) => r.status === 200 || r.status === 503 });
  });

  sleep(5); // Long think time — heavy users are rare
}

/**
 * Scenario 4: Constant arrival rate
 * Delivers 10 req/s of /fast requests regardless of how long they take.
 * Simulates traffic arriving at a fixed rate from an upstream load balancer.
 */
export function constantRateFlow() {
  const res = http.get(`${BASE_URL}/fast`, { tags: { name: 'const_rate_fast' } });
  check(res, { 'fast: 200': (r) => r.status === 200 });
  // No sleep! constant-arrival-rate manages pacing itself.
}

export function teardown() {
  http.post(`${BASE_URL}/cleanup`, null, { tags: { name: 'cleanup' } });
}
