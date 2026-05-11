/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TEST TYPE: LOAD TEST                                           ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  PURPOSE                                                         ║
 * ║  Verify the API handles the EXPECTED normal daily traffic with   ║
 * ║  acceptable response times and error rates.                      ║
 * ║                                                                  ║
 * ║  WHEN TO RUN                                                     ║
 * ║  • Weekly or before major feature releases                       ║
 * ║  • After infrastructure changes (new server, DB upgrade)         ║
 * ║  • As a performance regression baseline in CI/CD                 ║
 * ║                                                                  ║
 * ║  WHAT IT CATCHES                                                 ║
 * ║  • Performance degradation from code changes                     ║
 * ║  • Insufficient server capacity for real-world usage             ║
 * ║  • Slow endpoints that only show up under concurrent load        ║
 * ║                                                                  ║
 * ║  LOAD PROFILE                                                    ║
 * ║  VUs:  0 ──ramp──▶ peak ──hold──── peak ──ramp──▶ 0             ║
 * ║                                                                  ║
 * ║  HOW TO RUN                                                      ║
 * ║  k6 run k6/tests/02-load.js                                     ║
 * ║  k6 run --env PROJECT_SIZE=medium k6/tests/02-load.js           ║
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
import { load, thresholds, SIZE_LABEL } from '../config/sizes.js';

// ─── Test options ─────────────────────────────────────────────────────────────
const loadThresholds = Object.assign({}, thresholds, {
  checks: ['rate>0.95'], // > 95% of all check assertions must pass
});

export const options = {
  stages: load.stages,
  thresholds: loadThresholds,
};

// ─── Setup ────────────────────────────────────────────────────────────────────
export function setup() {
  console.log(`\n📊 Load Test — project size: ${SIZE_LABEL} — target: ${BASE_URL}`);
  console.log(`   Stages: ${JSON.stringify(load.stages)}\n`);

  const jwtToken    = login();
  const bearerToken = getBearerToken();

  return { jwtToken, bearerToken };
}

// ─── Main test function ───────────────────────────────────────────────────────
// Simulates a realistic mix of requests that typical API users make.
// Each VU picks a scenario randomly on each iteration.
export default function (data) {
  const scenario = randomItem(['fast_requests', 'auth_flow', 'data_submission', 'slow_requests']);

  switch (scenario) {
    case 'fast_requests':
      fastRequestFlow();
      break;
    case 'auth_flow':
      authFlow(data.bearerToken);
      break;
    case 'data_submission':
      dataSubmissionFlow();
      break;
    case 'slow_requests':
      slowRequestFlow();
      break;
  }
}

// ─── Flow: Fast requests ──────────────────────────────────────────────────────
// Simulates users who hit quick endpoints (health checks, fast data reads).
function fastRequestFlow() {
  group('fast requests', () => {

    let res = http.get(`${BASE_URL}/fast`, { tags: { name: 'fast' } });
    check(res, {
      'fast: 200': (r) => r.status === 200,
    });

    thinkTime(0.3, 0.8);

    res = http.get(`${BASE_URL}/status`, { tags: { name: 'status' } });
    check(res, {
      'status: 200':     (r) => r.status === 200,
      'status: has uptime': (r) => (parseBody(r) || {}).uptime !== undefined,
    });
  });

  thinkTime(0.5, 1.5);
}

// ─── Flow: Authentication ─────────────────────────────────────────────────────
// Simulates users logging in and accessing protected resources.
function authFlow(bearerToken) {
  group('auth flow', () => {

    // Step 1: Login
    let res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ username: 'demo', password: 'password' }),
      { headers: jsonHeaders, tags: { name: 'login' } }
    );
    const ok = check(res, {
      'login: 200':       (r) => r.status === 200,
      'login: has token': (r) => typeof (parseBody(r) || {}).token === 'string',
    });

    if (!ok) return;

    const token = parseBody(res).token;
    thinkTime(0.5, 1.0);

    // Step 2: Verify token
    res = http.post(
      `${BASE_URL}/auth/verify`,
      JSON.stringify({ token }),
      { headers: jsonHeaders, tags: { name: 'verify' } }
    );
    check(res, { 'verify: 200': (r) => r.status === 200 });

    thinkTime(0.3, 0.7);

    // Step 3: Access protected resource
    if (bearerToken) {
      res = http.get(`${BASE_URL}/protected`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        tags: { name: 'protected' },
      });
      check(res, { 'protected: 200': (r) => r.status === 200 });
    }
  });

  thinkTime(1, 2);
}

// ─── Flow: Data submission ────────────────────────────────────────────────────
// Simulates users submitting form data.
function dataSubmissionFlow() {
  const names  = ['alice', 'bob', 'carol', 'dave', 'eve'];
  const types  = ['report', 'feedback', 'request', 'alert'];

  group('data submission', () => {

    // Single-field submission
    let res = http.post(
      `${BASE_URL}/submit-one`,
      JSON.stringify({ name: randomItem(names) }),
      { headers: jsonHeaders, tags: { name: 'submit_one' } }
    );
    check(res, {
      'submit-one: 200':    (r) => r.status === 200,
      'submit-one: has id': (r) => (parseBody(r) || {}).id !== undefined,
    });

    thinkTime(0.5, 1.0);

    // Two-field submission
    res = http.post(
      `${BASE_URL}/submit-two`,
      JSON.stringify({ name: randomItem(names), type: randomItem(types) }),
      { headers: jsonHeaders, tags: { name: 'submit_two' } }
    );
    check(res, {
      'submit-two: 200': (r) => r.status === 200,
    });
  });

  thinkTime(0.8, 1.5);
}

// ─── Flow: Slow requests ──────────────────────────────────────────────────────
// Simulates users hitting endpoints that have inherent latency.
// This tests that the server handles concurrent slow requests gracefully.
function slowRequestFlow() {
  group('slow requests', () => {

    const res = http.get(`${BASE_URL}/slow`, { tags: { name: 'slow' } });
    check(res, {
      'slow: 200':         (r) => r.status === 200,
      'slow: responded':   (r) => r.body.length > 0,
    });
  });

  thinkTime(1, 2);
}

export function teardown() {
  http.post(`${BASE_URL}/cleanup`, null, { tags: { name: 'cleanup' } });
}
