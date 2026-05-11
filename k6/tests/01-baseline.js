/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TEST TYPE: BASELINE / SMOKE TEST                               ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  PURPOSE                                                         ║
 * ║  Verify every critical endpoint is alive and responds correctly  ║
 * ║  under minimal load (1–2 VUs). This is a sanity check, not a    ║
 * ║  performance test.                                               ║
 * ║                                                                  ║
 * ║  WHEN TO RUN                                                     ║
 * ║  • Before any other k6 test (if this fails, stop here)          ║
 * ║  • After every deployment as a CI/CD gate                        ║
 * ║  • Any time you want a quick "is the API working?" check         ║
 * ║                                                                  ║
 * ║  WHAT IT CATCHES                                                 ║
 * ║  • Broken routes (404/500 responses)                             ║
 * ║  • Auth misconfigurations                                        ║
 * ║  • Obvious performance regressions (e.g., 2s on /fast)          ║
 * ║  • Missing environment variables on the server                   ║
 * ║                                                                  ║
 * ║  HOW TO RUN                                                      ║
 * ║  k6 run k6/tests/01-baseline.js                                 ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';

import { BASE_URL, jsonHeaders, login, getBearerToken, parseBody } from '../utils/helpers.js';
import { baseline, thresholds } from '../config/sizes.js';

// ─── Test options ─────────────────────────────────────────────────────────────
// For a smoke test we always use the minimum config regardless of project size.
// The thresholds come from project size so they're consistent across test types.
export const options = {
  vus: 1,          // exactly 1 virtual user
  duration: '30s', // run for 30 seconds

  thresholds: {
    // Smoke test has stricter thresholds than load/stress tests:
    // if 1 user causes errors, there is definitely something wrong.
    http_req_duration: ['p(95)<2000'],  // every request under 2 seconds
    http_req_failed:   ['rate<0.01'],   // < 1% errors (near zero)
    checks:            ['rate>0.99'],   // > 99% of checks must pass
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────────
// setup() runs ONCE before the test starts, no matter how many VUs you have.
// Return value is passed as `data` to every VU in the default function.
export function setup() {
  console.log(`\n🔍 Baseline Test — target: ${BASE_URL}\n`);

  // Get a JWT token (used for /protected routes)
  const jwtToken = login();

  // Get the static bearer token (used for Bearer-protected routes)
  const bearerToken = getBearerToken();

  if (!jwtToken) console.warn('⚠️  JWT login failed — JWT tests will be skipped');
  if (!bearerToken) console.warn('⚠️  Bearer token fetch failed — bearer tests will be skipped');

  return { jwtToken, bearerToken };
}

// ─── Main test function ───────────────────────────────────────────────────────
// This runs once per VU per iteration. With 1 VU and 30s duration,
// it loops as fast as `sleep()` allows.
export default function (data) {

  // ── Group 1: Public endpoints ─────────────────────────────────────────────
  // No authentication required. Test that these respond correctly.
  group('public endpoints', () => {

    // /fast — should respond near-instantly
    let res = http.get(`${BASE_URL}/fast`, { tags: { name: 'fast' } });
    check(res, {
      '/fast status 200': (r) => r.status === 200,
      '/fast has body':   (r) => r.body.length > 0,
    });

    // /status — health check endpoint
    res = http.get(`${BASE_URL}/status`, { tags: { name: 'status' } });
    check(res, {
      '/status status 200': (r) => r.status === 200,
      '/status has pid':    (r) => (parseBody(r) || {}).pid !== undefined,
    });

    // /metrics — Prometheus metrics endpoint
    res = http.get(`${BASE_URL}/metrics`, { tags: { name: 'metrics' } });
    check(res, {
      '/metrics status 200':    (r) => r.status === 200,
      '/metrics has prometheus': (r) => r.body.includes('# HELP'),
    });
  });

  sleep(0.5);

  // ── Group 2: Error handling ───────────────────────────────────────────────
  // The /error endpoint intentionally returns 500. Verify the server handles
  // it correctly rather than crashing or hanging.
  group('error handling', () => {

    const res = http.get(`${BASE_URL}/error`, { tags: { name: 'error' } });
    check(res, {
      '/error returns 500': (r) => r.status === 500,
      '/error has message': (r) => (parseBody(r) || {}).message !== undefined,
    });
  });

  sleep(0.5);

  // ── Group 3: Data validation endpoints ───────────────────────────────────
  group('data validation', () => {

    // Valid submission with required fields
    let res = http.post(
      `${BASE_URL}/submit-one`,
      JSON.stringify({ name: 'k6-baseline-test' }),
      { headers: jsonHeaders, tags: { name: 'submit_one' } }
    );
    check(res, {
      '/submit-one valid: 200':    (r) => r.status === 200,
      '/submit-one valid: has id': (r) => (parseBody(r) || {}).id !== undefined,
    });

    // Missing required field — should return 400
    res = http.post(
      `${BASE_URL}/submit-one`,
      JSON.stringify({}),
      { headers: jsonHeaders, tags: { name: 'submit_one_invalid' } }
    );
    check(res, {
      '/submit-one invalid: 400': (r) => r.status === 400,
    });

    // Two-field submission
    res = http.post(
      `${BASE_URL}/submit-two`,
      JSON.stringify({ name: 'k6-test', type: 'smoke' }),
      { headers: jsonHeaders, tags: { name: 'submit_two' } }
    );
    check(res, {
      '/submit-two valid: 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // ── Group 4: Authentication ───────────────────────────────────────────────
  group('authentication', () => {

    // JWT login
    let res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ username: 'demo', password: 'password' }),
      { headers: jsonHeaders, tags: { name: 'auth_login' } }
    );
    check(res, {
      'login: 200':          (r) => r.status === 200,
      'login: token exists': (r) => typeof (parseBody(r) || {}).token === 'string',
    });

    // Wrong credentials → 401
    res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ username: 'bad', password: 'wrong' }),
      { headers: jsonHeaders, tags: { name: 'auth_login_bad' } }
    );
    check(res, {
      'bad login: 401': (r) => r.status === 401,
    });

    // Bearer-protected endpoint with correct token
    if (data.bearerToken) {
      res = http.get(`${BASE_URL}/protected`, {
        headers: { Authorization: `Bearer ${data.bearerToken}` },
        tags: { name: 'protected_ok' },
      });
      check(res, { 'protected (valid bearer): 200': (r) => r.status === 200 });
    }

    // Bearer-protected endpoint without token → 401 or 403
    res = http.get(`${BASE_URL}/protected`, { tags: { name: 'protected_no_auth' } });
    check(res, {
      'protected (no token): 401/403': (r) => r.status === 401 || r.status === 403,
    });
  });

  sleep(0.5);

  // ── Group 5: Workload endpoints (light touch only) ────────────────────────
  // In a smoke test we only hit the fast and slow endpoints — NOT /cpu or
  // /memory, which are intentionally resource-heavy.
  group('workload endpoints', () => {

    // /slow adds a 200ms artificial delay (configurable via SLOW_DELAY_MS)
    const res = http.get(`${BASE_URL}/slow`, { tags: { name: 'slow' } });
    check(res, {
      '/slow status 200': (r) => r.status === 200,
      '/slow reasonable':  (r) => r.timings.duration < 5000, // under 5s
    });
  });

  sleep(1);
}

// ─── Teardown ────────────────────────────────────────────────────────────────
// teardown() runs ONCE after all VUs finish.
export function teardown() {
  // Clean up any temp files written by /io tests
  http.post(`${BASE_URL}/cleanup`, null, { tags: { name: 'cleanup' } });
  console.log('\n✅ Baseline test complete.\n');
}
